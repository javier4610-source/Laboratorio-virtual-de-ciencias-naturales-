import { useSyncExternalStore } from 'react';
import type { DatasetAnalysis, PracticeSession } from '../core/types';
import { api, ApiError, normalizeServerUrl, saveServerUrl, type SyncSummary } from './api';
import { keysWithPrefix, loadJSON, removeKey, saveJSON } from './storage';
import { SESSION_PREFIX } from './session';

/**
 * Conexión del estudiante con su curso (servidor institucional opcional).
 * Envía de forma discreta un resumen del avance de cada práctica. Si no hay red,
 * los cambios esperan en una cola local y se envían al volver la conexión.
 * Nada de esto bloquea el laboratorio: cualquier error queda solo como estado visible.
 */
const ENROLLMENT_KEY = 'lvcn:mi-curso';
const QUEUE_KEY = 'lvcn:cola-sincronizacion';
const DEBOUNCE_MS = 2500;
const RETRY_MS = 30_000;

export interface Enrollment {
  server: string;
  token: string;
  expiresAt: number;
  student: { id: number; name: string };
  course: { name: string; joinCode: string };
  joinedAt: number;
}

export type SyncState = 'inactivo' | 'pendiente' | 'enviando' | 'sincronizado' | 'sin-conexion' | 'error';
export interface SyncStatus { state: SyncState; lastSyncAt: number | null; pending: number; message: string; }
interface Queue { progress: Record<string, SyncSummary>; events: { practiceId: string; at: number }[]; }

export const SYNC_TEXT: Record<SyncState, string> = {
  inactivo: 'Conectado al curso',
  pendiente: 'Cambios por enviar',
  enviando: 'Sincronizando…',
  sincronizado: 'Sincronizado',
  'sin-conexion': 'Sin conexión: se enviará después',
  error: 'No se pudo sincronizar',
};

let enrollment: Enrollment | null = loadEnrollment();
let status: SyncStatus = { state: 'inactivo', lastSyncAt: null, pending: pendingCount(loadQueue()), message: '' };
let snapshot = { enrollment, status };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let started = false;

function loadEnrollment(): Enrollment | null {
  const e = loadJSON<Enrollment | null>(ENROLLMENT_KEY, null);
  if (!e || typeof e.token !== 'string' || !e.course || !e.student) return null;
  if (e.expiresAt && e.expiresAt < Date.now()) return null;
  return e;
}
function loadQueue(): Queue {
  const q = loadJSON<Queue | null>(QUEUE_KEY, null);
  return { progress: q?.progress ?? {}, events: Array.isArray(q?.events) ? q!.events : [] };
}
function saveQueue(q: Queue) { saveJSON(QUEUE_KEY, q); }
function pendingCount(q: Queue) { return Object.keys(q.progress).length + q.events.length; }

function emit() {
  snapshot = { enrollment, status };
  listeners.forEach((l) => l());
}
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, pending: pendingCount(loadQueue()), ...patch };
  emit();
}

export function getEnrollment(): Enrollment | null { return enrollment; }

function setEnrollment(e: Enrollment | null) {
  enrollment = e;
  if (e) saveJSON(ENROLLMENT_KEY, e); else { removeKey(ENROLLMENT_KEY); removeKey(QUEUE_KEY); }
  status = { state: e ? 'inactivo' : 'inactivo', lastSyncAt: null, pending: e ? pendingCount(loadQueue()) : 0, message: '' };
  emit();
}

/** Estado reactivo de la conexión con el curso (para el encabezado y la práctica). */
export function useClassroom() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => snapshot, () => snapshot);
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void flush(); }, ms);
}

/** Pone en cola el resumen de una práctica (se conserva solo el más reciente) y lo envía con antirrebote. */
export function queueProgress(practiceId: string, summary: SyncSummary) {
  if (!enrollment) return;
  const q = loadQueue();
  q.progress[practiceId] = summary;
  saveQueue(q);
  setStatus({ state: status.state === 'sin-conexion' ? 'sin-conexion' : 'pendiente' });
  schedule(DEBOUNCE_MS);
}

/** Registra la apertura de una práctica (cuenta como ingreso del día). */
export function queuePracticeOpen(practiceId: string) {
  if (!enrollment) return;
  const q = loadQueue();
  if (q.events.length >= 50) q.events.shift();
  q.events.push({ practiceId, at: Date.now() });
  saveQueue(q);
  schedule(DEBOUNCE_MS);
}

function isOffline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }

/** Envía la cola. Nunca lanza errores: los convierte en estado visible. */
export async function flush(): Promise<void> {
  const e = enrollment;
  if (!e || flushing) return;
  let q = loadQueue();
  if (pendingCount(q) === 0) { if (status.state === 'pendiente') setStatus({ state: 'sincronizado', lastSyncAt: Date.now() }); return; }
  if (isOffline()) { setStatus({ state: 'sin-conexion' }); return; }
  flushing = true;
  setStatus({ state: 'enviando', message: '' });
  let failure: { state: SyncState; message: string } | null = null;
  try {
    for (const ev of [...q.events]) {
      try {
        await api.studentEvent(e.server, e.token, ev.practiceId);
      } catch (err) {
        const st = (err as ApiError).status;
        if (st === 0 || st === 429 || st >= 500) throw err;
        if (st === 401) throw err;
        // Otros errores (p. ej., práctica no válida): se descarta el evento.
      }
      q = loadQueue();
      q.events = q.events.filter((x) => !(x.practiceId === ev.practiceId && x.at === ev.at));
      saveQueue(q);
    }
    for (const [practiceId, summary] of Object.entries(loadQueue().progress)) {
      try {
        await api.syncProgress(e.server, e.token, practiceId, summary);
      } catch (err) {
        const st = (err as ApiError).status;
        if (st === 0 || st === 429 || st >= 500 || st === 401) throw err;
        failure = { state: 'error', message: (err as Error).message };
      }
      q = loadQueue();
      // Solo se quita si no llegó una versión más nueva mientras se enviaba.
      if (q.progress[practiceId]?.version === summary.version) { delete q.progress[practiceId]; saveQueue(q); }
    }
  } catch (err) {
    const st = (err as ApiError).status;
    if (st === 401) {
      setEnrollment(null);
      status = { ...status, state: 'error', message: 'Tu sesión del curso expiró. Vuelve a unirte con tu alias y PIN.' };
      emit();
      flushing = false;
      return;
    }
    failure = st === 0 ? { state: 'sin-conexion', message: '' } : { state: 'error', message: (err as Error).message };
  } finally {
    flushing = false;
  }
  if (failure) {
    setStatus(failure);
    if (failure.state === 'sin-conexion' || pendingCount(loadQueue()) > 0) schedule(RETRY_MS);
  } else {
    setStatus({ state: 'sincronizado', lastSyncAt: Date.now(), message: '' });
    if (pendingCount(loadQueue()) > 0) schedule(DEBOUNCE_MS);
  }
}

/** Arranca la sincronización (una vez, al cargar la aplicación). */
export function startClassroomSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { void flush(); });
  window.addEventListener('offline', () => { if (enrollment) setStatus({ state: 'sin-conexion' }); });
  const e = enrollment;
  if (!e) return;
  // Valida la sesión (y registra el ingreso del día). Sin red, simplemente se reintenta luego.
  api.studentMe(e.server, e.token).then((me) => {
    if (enrollment?.token !== e.token) return;
    enrollment = { ...e, course: { name: me.course.name, joinCode: me.course.joinCode }, student: me.student };
    saveJSON(ENROLLMENT_KEY, enrollment);
    setStatus({ state: pendingCount(loadQueue()) ? 'pendiente' : 'sincronizado', lastSyncAt: pendingCount(loadQueue()) ? status.lastSyncAt : Date.now() });
    void flush();
  }).catch((err: ApiError) => {
    if (err.status === 401) { setEnrollment(null); status = { ...status, state: 'error', message: err.message }; emit(); }
    else setStatus({ state: err.status === 0 ? 'sin-conexion' : 'error', message: err.status === 0 ? '' : err.message });
    if (err.status !== 401) schedule(RETRY_MS);
  });
}

/* ------------------------------------------------------------------ inscripción */

const isEmptySession = (s: PracticeSession | null) =>
  !s || (s.trials.length === 0 && !s.hypothesis?.savedAt && Object.keys(s.answers).length === 0 && !s.conclusion.claim.trim());

/** Reconstruye una sesión local a partir del resumen guardado en el servidor (otro equipo). */
export function sessionFromSummary(practiceId: string, x: SyncSummary): PracticeSession {
  const analysis: Record<string, DatasetAnalysis> = {};
  for (const f of x.fits) analysis[f.d] = { x: f.x, y: f.y, group: '', model: f.model, ...(f.xT ? { xT: f.xT } : {}), ...(f.yT ? { yT: f.yT } : {}) };
  return {
    practiceId, mode: x.mode,
    trials: x.trials.map((t, i) => ({ id: t.id || `r${i}-${t.t}`, datasetId: t.d, createdAt: t.t, values: t.v, ...(t.n ? { note: t.n } : {}) })),
    stepsDone: x.stepsDone, interpretations: x.interpretations,
    conclusion: x.conclusion, application: '', answers: x.answers, visited: x.visited,
    ...(Object.keys(analysis).length ? { analysis } : {}),
    startedAt: x.trials[0]?.t ?? x.version, updatedAt: x.version,
  };
}

export interface JoinResult { created: boolean; restored: number; uploaded: number; }

/**
 * Se une al curso (o vuelve con nombre + PIN). Después:
 *  - recupera en este equipo las prácticas guardadas en el servidor que aquí están vacías;
 *  - pone en cola el avance local más reciente que el del servidor.
 */
export async function joinCourse(server: string, joinCode: string, name: string, pin: string): Promise<JoinResult> {
  const url = normalizeServerUrl(server);
  const r = await api.joinCourse(url, { joinCode: joinCode.trim().toUpperCase(), name: name.trim(), pin });
  saveServerUrl(url);
  removeKey(QUEUE_KEY);
  setEnrollment({ server: url, token: r.token, expiresAt: r.expiresAt, student: r.student, course: r.course, joinedAt: Date.now() });
  let restored = 0, uploaded = 0;
  try {
    const { progress } = await api.studentProgress(url, r.token);
    const remote = new Map(progress.map((p) => [p.practiceId, p]));
    for (const p of progress) {
      const local = loadJSON<PracticeSession | null>(SESSION_PREFIX + p.practiceId, null);
      if (isEmptySession(local)) {
        saveJSON(SESSION_PREFIX + p.practiceId, sessionFromSummary(p.practiceId, p.summary));
        const all = loadJSON<Record<string, number>>('lvcn:progreso', {});
        saveJSON('lvcn:progreso', { ...all, [p.practiceId]: p.summary.percent });
        restored++;
      }
    }
    // Avance hecho en este equipo antes de unirse: se envía si es más reciente.
    const localIds = keysWithPrefix(SESSION_PREFIX).map((k) => k.slice(SESSION_PREFIX.length));
    const pendingIds = localIds.filter((id) => {
      const s = loadJSON<PracticeSession | null>(SESSION_PREFIX + id, null);
      return s && !isEmptySession(s) && s.updatedAt > (remote.get(id)?.version ?? 0);
    });
    if (pendingIds.length) {
      const [{ loadPractice }, { buildSyncSummary, activeTimeOf }] = await Promise.all([import('../curriculum/loader'), import('./syncSummary')]);
      for (const id of pendingIds) {
        try {
          const def = await loadPractice(id);
          const s = loadJSON<PracticeSession | null>(SESSION_PREFIX + id, null);
          if (s) { queueProgress(id, buildSyncSummary(def, s, activeTimeOf(id))); uploaded++; }
        } catch { /* práctica que ya no existe: se omite */ }
      }
    } else {
      setStatus({ state: 'sincronizado', lastSyncAt: Date.now() });
    }
  } catch {
    // La inscripción ya quedó hecha; la recuperación se puede intentar en otro momento.
  }
  return { created: r.created, restored, uploaded };
}

/** Sale del curso en este equipo. El avance queda en el servidor y en este navegador. */
export async function leaveCourse() {
  const e = enrollment;
  setEnrollment(null);
  if (e) { try { await api.studentLogout(e.server, e.token); } catch { /* sin red: el token expira solo */ } }
}

export function syncNow() { void flush(); }

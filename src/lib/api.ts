import { loadJSON, saveJSON } from './storage';
import type { StudentReport } from './report';

/**
 * Cliente del servidor institucional opcional (carpeta server/).
 * Sin servidor configurado, la aplicación sigue funcionando con archivos y códigos.
 */
const SERVER_KEY = 'lvcn:servidor';
const TOKEN_KEY = 'lvcn:servidor-sesion';

export function defaultServerUrl(): string {
  return loadJSON<string>(SERVER_KEY, (import.meta.env.VITE_API_URL as string | undefined) ?? '');
}
export function saveServerUrl(url: string) { saveJSON(SERVER_KEY, url.trim().replace(/\/+$/, '')); }

export interface TeacherSession { token: string; teacher: { id: number; name: string; email: string }; server: string; }
export function loadTeacherSession(): TeacherSession | null { return loadJSON<TeacherSession | null>(TOKEN_KEY, null); }
export function saveTeacherSession(s: TeacherSession | null) { saveJSON(TOKEN_KEY, s); }

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export function normalizeServerUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/.test(u)) throw new ApiError(0, 'Escribe la dirección completa del servidor, por ejemplo https://laboratorio.micolegio.edu.co');
  return u;
}

async function call<T>(server: string, method: string, path: string, body?: unknown, token?: string): Promise<T> {
  return (await request(server, method, path, body, token, 'json')) as T;
}

async function request(server: string, method: string, path: string, body: unknown, token: string | undefined, as: 'json' | 'text'): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(normalizeServerUrl(server) + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa la dirección y tu conexión a internet.');
  }
  if (as === 'text' && res.ok) return res.text();
  let json: unknown = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string } | null)?.error ?? `Error ${res.status} del servidor.`);
  return json;
}

export const api = {
  health: (server: string) => call<{ ok: boolean }>(server, 'GET', '/api/salud'),
  register: (server: string, data: { registrationCode: string; name: string; email: string; password: string }) =>
    call<{ token: string; teacher: TeacherSession['teacher'] }>(server, 'POST', '/api/docentes', data),
  login: (server: string, email: string, password: string) =>
    call<{ token: string; teacher: TeacherSession['teacher'] }>(server, 'POST', '/api/sesion', { email, password }),
  logout: (s: TeacherSession) => call(s.server, 'DELETE', '/api/sesion', undefined, s.token),
  courses: (s: TeacherSession) => call<{ courses: ServerCourse[] }>(s.server, 'GET', '/api/cursos', undefined, s.token),
  createCourse: (s: TeacherSession, name: string) => call<{ course: ServerCourse }>(s.server, 'POST', '/api/cursos', { name }, s.token),
  setCourseOpen: (s: TeacherSession, id: number, open: boolean) => call(s.server, 'PATCH', `/api/cursos/${id}`, { open }, s.token),
  deleteCourse: (s: TeacherSession, id: number) => call(s.server, 'DELETE', `/api/cursos/${id}`, undefined, s.token),
  reports: (s: TeacherSession, id: number) => call<{ reports: ServerReport[] }>(s.server, 'GET', `/api/cursos/${id}/informes`, undefined, s.token),
  submitReport: (server: string, joinCode: string, report: StudentReport) =>
    call<{ ok: boolean; duplicate: boolean; course: string }>(server, 'POST', '/api/informes', { joinCode, report }),

  // Seguimiento del curso: estudiante (token propio, distinto del docente)
  joinCourse: (server: string, data: { joinCode: string; name: string; pin: string }) =>
    call<{ token: string; expiresAt: number; created: boolean; student: { id: number; name: string }; course: { name: string; joinCode: string } }>(server, 'POST', '/api/estudiantes', data),
  studentMe: (server: string, token: string) =>
    call<{ student: { id: number; name: string }; course: { name: string; joinCode: string; open: number }; expiresAt: number }>(server, 'GET', '/api/estudiante', undefined, token),
  studentLogout: (server: string, token: string) => call(server, 'DELETE', '/api/estudiante/sesion', undefined, token),
  studentProgress: (server: string, token: string) =>
    call<{ progress: { practiceId: string; version: number; summary: SyncSummary }[] }>(server, 'GET', '/api/estudiante/progreso', undefined, token),
  studentEvent: (server: string, token: string, practiceId: string) =>
    call<{ ok: boolean; recorded: boolean }>(server, 'POST', '/api/estudiante/eventos', { kind: 'practica', practiceId }, token),
  syncProgress: (server: string, token: string, practiceId: string, summary: SyncSummary) =>
    call<{ ok: boolean; stale?: boolean; duplicate?: boolean; version: number }>(server, 'PUT', `/api/estudiante/progreso/${encodeURIComponent(practiceId)}`, summary, token),

  // Seguimiento del curso: docente (solo sus cursos)
  tracking: (s: TeacherSession, id: number) => call<CourseTracking>(s.server, 'GET', `/api/cursos/${id}/seguimiento`, undefined, s.token),
  trackingStudent: (s: TeacherSession, id: number, studentId: number) =>
    call<StudentDetail>(s.server, 'GET', `/api/cursos/${id}/estudiantes/${studentId}`, undefined, s.token),
  deleteStudent: (s: TeacherSession, id: number, studentId: number) => call(s.server, 'DELETE', `/api/cursos/${id}/estudiantes/${studentId}`, undefined, s.token),
  trackingCsv: async (s: TeacherSession, id: number) => (await request(s.server, 'GET', `/api/cursos/${id}/seguimiento.csv`, undefined, s.token, 'text')) as string,
};

/** Resumen del avance de una práctica que se sincroniza con el servidor (ver server/README.md). */
export interface SyncSummary {
  version: number;
  mode: 'guiada' | 'libre' | 'evaluacion';
  stages: string[];
  percent: number;
  trialsCount: number;
  trials: { id: string; d: string; t: number; v: Record<string, number | string | null>; n?: string }[];
  hypothesis: { text: string; trend: string; pairIndex: number; savedAt?: number };
  comparison: { verdict: string; justification: string };
  conclusion: { claim: string; evidence: string; reasoning: string };
  interpretations: Record<string, string>;
  answers: Record<string, { chosen: string; correct: boolean; firstTryCorrect: boolean; attempts: number; firstChosen?: string; at?: number }>;
  visited: string[];
  stepsDone: number[];
  score: { answered: number; total: number; correct: number; byCompetency: Record<'uso' | 'explicacion' | 'indagacion', { answered: number; correct: number }> };
  fits: { d: string; x: string; y: string; model: string; xT?: string; yT?: string }[];
  activeMs: number;
  lastActivity: number;
}

export type Competencies = Record<'uso' | 'explicacion' | 'indagacion', { answered: number; correct: number }>;
export interface PracticeProgress { percent: number; answered: number; correct: number; trials: number; activeMs: number; lastActivity: number; stages: string[]; total: number; }
export interface TrackedStudent {
  id: number; name: string; createdAt: number; lastSeenAt: number; lastActivity: number | null;
  practices: Record<string, PracticeProgress>; avgPercent: number | null; score: { answered: number; correct: number };
  trials: number; activeMs: number; byCompetency: Competencies;
}
export interface TrackingAlert { kind: 'inactivo' | 'puntaje-bajo' | 'estancada'; studentId: number; name: string; practiceId?: string; competency?: 'uso' | 'explicacion' | 'indagacion'; since?: number; message: string; }
export interface QuestionStat { questionId: string; practiceIds: string[]; answered: number; firstTryCorrect: number; percent: number; wrong: Record<string, number>; topWrong: { option: string; count: number } | null; }
export interface CourseTracking {
  summary: {
    course: { id: number; name: string; joinCode: string; open: number };
    generatedAt: number; today: string; enrolled: number; activeToday: number; active7: number;
    avgPercent: number | null; avgScore: number | null; totalTrials: number;
    practices: { practiceId: string; students: number; avgPercent: number; avgScore: number | null; trials: number; activeMs: number }[];
    daily: { day: string; active: number; logins: number }[];
    competencies: Competencies; alertCount: number;
  };
  students: TrackedStudent[];
  questions: QuestionStat[];
  alerts: TrackingAlert[];
}
export interface StudentDetail {
  student: { id: number; name: string; createdAt: number; lastSeenAt: number };
  practices: (SyncSummary & { practiceId: string; updatedAt: number })[];
  timeline: { kind: string; practiceId: string | null; detail: string | null; at: number }[];
}

export interface ServerCourse { id: number; name: string; joinCode: string; open: number; reportCount: number; studentCount?: number; createdAt?: number; }
export interface ServerReport { id: number; studentName: string; studentCourse: string; practiceId: string; generatedAt: number; receivedAt: number; report: StudentReport; }

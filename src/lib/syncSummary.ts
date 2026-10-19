import { useCallback, useEffect, useRef } from 'react';
import type { PracticeDef, PracticeSession } from '../core/types';
import type { SyncSummary } from './api';
import { progressPercent, stageDone, STAGES } from './progress';
import { scoreSession } from './report';
import { loadJSON, saveJSON } from './storage';

/** Límites que también valida el servidor (server/app.mjs → validateProgress). */
const MAX_TRIALS = 30;
const MAX_BYTES = 60 * 1024;
const KEY_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const OPTION_RE = /^[A-Za-z0-9]{1,4}$/;
const clip = (t: string | undefined, n: number) => (t ?? '').slice(0, n);
const pickMap = <T, U>(obj: Record<string, T> | undefined, max: number, fn: (v: T) => U | null): Record<string, U> => {
  const out: Record<string, U> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (Object.keys(out).length >= max) break;
    if (!KEY_RE.test(k)) continue;
    const x = fn(v);
    if (x !== null) out[k] = x;
  }
  return out;
};

/** Resumen compacto y acotado de una práctica para el seguimiento del docente. */
export function buildSyncSummary(p: PracticeDef, s: PracticeSession, activeMs: number): SyncSummary {
  const done = stageDone(p, s);
  const score = scoreSession(p, s);
  const summary: SyncSummary = {
    version: s.updatedAt,
    mode: s.mode,
    stages: STAGES.filter((st) => done[st.id]).map((st) => st.id),
    percent: progressPercent(p, s),
    trialsCount: s.trials.length,
    trials: s.trials.slice(-MAX_TRIALS).filter((t) => KEY_RE.test(t.datasetId)).map((t) => ({
      id: clip(t.id, 40), d: t.datasetId, t: t.createdAt,
      v: pickMap(t.values, 24, (v) => (typeof v === 'number' ? (Number.isFinite(v) ? v : null) : typeof v === 'string' ? clip(v, 80) : null)),
      ...(t.note ? { n: clip(t.note, 300) } : {}),
    })),
    conclusion: { claim: clip(s.conclusion.claim, 2000), evidence: clip(s.conclusion.evidence, 2000), reasoning: clip(s.conclusion.reasoning, 2000) },
    interpretations: pickMap(s.interpretations, 12, (v) => (v.trim() ? clip(v, 2000) : null)),
    answers: pickMap(s.answers, 60, (a) => (OPTION_RE.test(a.chosen) ? {
      chosen: a.chosen, correct: !!a.correct, firstTryCorrect: !!a.firstTryCorrect, attempts: Math.min(99, Math.max(1, a.attempts || 1)),
      ...(a.firstChosen && OPTION_RE.test(a.firstChosen) ? { firstChosen: a.firstChosen } : {}), ...(a.at ? { at: a.at } : {}),
    } : null)),
    visited: s.visited.filter((v) => KEY_RE.test(v)).slice(0, 12),
    stepsDone: s.stepsDone.filter((n) => Number.isInteger(n) && n >= 0 && n <= 99).slice(0, 40),
    score: { answered: score.answered, total: score.total, correct: score.firstTryCorrect, byCompetency: score.byCompetency },
    fits: Object.entries(s.analysis ?? {})
      .filter(([d, a]) => KEY_RE.test(d) && a.model && a.model !== 'none' && KEY_RE.test(a.x) && KEY_RE.test(a.y))
      .slice(0, 8)
      .map(([d, a]) => ({ d, x: a.x, y: a.y, model: a.model!, ...(a.xT && KEY_RE.test(a.xT) ? { xT: a.xT } : {}), ...(a.yT && KEY_RE.test(a.yT) ? { yT: a.yT } : {}) })),
    activeMs: Math.round(Math.min(activeMs, 90 * 86_400_000)),
    lastActivity: s.updatedAt,
  };
  // Si el resumen es demasiado grande, se recortan primero los ensayos más antiguos.
  while (summary.trials.length > 0 && JSON.stringify(summary).length > MAX_BYTES) summary.trials.shift();
  return summary;
}

/* --------------------------------------------------- tiempo activo aproximado */

const TIME_KEY = 'lvcn:tiempo-activo';
const TICK_MS = 15_000;
const IDLE_MS = 60_000;

export function activeTimeOf(practiceId: string): number {
  return loadJSON<Record<string, number>>(TIME_KEY, {})[practiceId] ?? 0;
}

/**
 * Cuenta el tiempo con la pestaña visible y alguna interacción en el último minuto.
 * Es una aproximación (bloques de 15 s); devuelve una función que lee el total actual.
 */
export function useActiveTime(practiceId: string): () => number {
  const last = useRef(Date.now());
  useEffect(() => {
    const mark = () => { last.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - last.current > IDLE_MS) return;
      const all = loadJSON<Record<string, number>>(TIME_KEY, {});
      saveJSON(TIME_KEY, { ...all, [practiceId]: (all[practiceId] ?? 0) + TICK_MS });
    }, TICK_MS);
    return () => { events.forEach((e) => window.removeEventListener(e, mark)); window.clearInterval(id); };
  }, [practiceId]);
  return useCallback(() => activeTimeOf(practiceId), [practiceId]);
}

import type { PracticeDef, PracticeSession } from '../core/types';
import { loadSession } from './session';
import { keysWithPrefix } from './storage';
import { SESSION_PREFIX } from './session';

export type StageId = 'preparacion' | 'hipotesis' | 'experimento' | 'analisis' | 'evaluacion' | 'modelo';

export const STAGES: { id: StageId; label: string }[] = [
  { id: 'preparacion', label: 'Preparación' },
  { id: 'hipotesis', label: 'Hipótesis' },
  { id: 'experimento', label: 'Experimento' },
  { id: 'analisis', label: 'Análisis y conclusión' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'modelo', label: 'Modelo y referencias' },
];

export const MIN_TRIALS = 3;

/** Criterios explícitos para considerar completa cada etapa. */
export function stageDone(p: PracticeDef, s: PracticeSession): Record<StageId, boolean> {
  const answeredAll = p.assessment.every((q) => s.answers[q.id]);
  return {
    preparacion: s.visited.includes('preparacion'),
    hipotesis: !!s.hypothesis.savedAt,
    experimento: s.trials.length >= MIN_TRIALS,
    analisis: !!s.comparison.verdict && s.conclusion.claim.trim().length > 0 && Object.values(s.interpretations).some((t) => t.trim().length > 0),
    evaluacion: answeredAll,
    modelo: s.visited.includes('modelo'),
  };
}

export function progressPercent(p: PracticeDef, s: PracticeSession): number {
  const d = stageDone(p, s);
  const main: StageId[] = ['preparacion', 'hipotesis', 'experimento', 'analisis', 'evaluacion'];
  return Math.round((main.filter((k) => d[k]).length / main.length) * 100);
}

/** Progreso guardado en este navegador para cada práctica (sin servidor). */
export function storedProgress(practices: PracticeDef[]): Record<string, number> {
  const keys = new Set(keysWithPrefix(SESSION_PREFIX));
  const out: Record<string, number> = {};
  for (const p of practices) {
    if (!keys.has(SESSION_PREFIX + p.id)) continue;
    out[p.id] = progressPercent(p, loadSession(p.id));
  }
  return out;
}

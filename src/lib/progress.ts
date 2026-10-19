import type { PracticeDef, PracticeSession } from '../core/types';
import { keysWithPrefix, loadJSON, saveJSON } from './storage';
import { SESSION_PREFIX } from './session';

/**
 * Etapas de una práctica. La antigua etapa «hipotesis» se retiró (ADR 0006); el servidor la sigue
 * aceptando en `stages` para no romper resúmenes guardados por versiones anteriores.
 */
export type StageId = 'preparacion' | 'experimento' | 'analisis' | 'evaluacion' | 'modelo';

export const STAGES: { id: StageId; label: string }[] = [
  { id: 'preparacion', label: 'Preparación' },
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
    experimento: s.trials.length >= MIN_TRIALS,
    analisis: s.conclusion.claim.trim().length > 0 && Object.values(s.interpretations).some((t) => t.trim().length > 0),
    evaluacion: answeredAll,
    modelo: s.visited.includes('modelo'),
  };
}

export function progressPercent(p: PracticeDef, s: PracticeSession): number {
  const d = stageDone(p, s);
  const main: StageId[] = ['preparacion', 'experimento', 'analisis', 'evaluacion'];
  return Math.round((main.filter((k) => d[k]).length / main.length) * 100);
}

const PROGRESS_KEY = 'lvcn:progreso';

/** Guarda el porcentaje de avance (lo usa el catálogo sin cargar el contenido completo). */
export function saveProgress(id: string, percent: number): void {
  const all = loadJSON<Record<string, number>>(PROGRESS_KEY, {});
  if (all[id] === percent) return;
  saveJSON(PROGRESS_KEY, { ...all, [id]: percent });
}

/** Progreso guardado en este navegador para cada práctica (sin servidor). */
export function storedProgress(): Record<string, number> {
  const all = loadJSON<Record<string, number>>(PROGRESS_KEY, {});
  // Solo prácticas con sesión guardada (si se reinició, no se muestra progreso).
  const keys = new Set(keysWithPrefix(SESSION_PREFIX));
  return Object.fromEntries(Object.entries(all).filter(([id]) => keys.has(SESSION_PREFIX + id)));
}

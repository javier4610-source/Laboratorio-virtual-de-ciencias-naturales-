import type { Competency } from '../../core/types';
import { BLOQUES } from './bloques';
import { BLOCKS, type AdvancedItem, type BlockId, type Key } from './types';
import { BLOCK_IDS, COMPETENCIES } from './labels';

/**
 * Banco avanzado tipo Saber 11 armado con los bloques registrados en ./bloques.ts, ordenado por número global.
 * Puede estar vacío o incompleto mientras se incorporan los seis bloques.
 */
export const ADVANCED_BANK: readonly AdvancedItem[] = [...BLOQUES.flat()].sort((a, b) => a.n - b.n);

/** Bloques con al menos un ítem, en orden A–F. */
export function blocksIn(items: readonly AdvancedItem[]): BlockId[] {
  const present = new Set(items.map((it) => it.block));
  return BLOCK_IDS.filter((b) => present.has(b));
}

export const blockName = (b: BlockId) => `Bloque ${b} · ${BLOCKS[b].name}`;

export interface Tally { total: number; correct: number }
export interface ScoreBreakdown {
  total: number;
  correct: number;
  answered: number;
  byCompetency: Record<Competency, Tally>;
  byBlock: Partial<Record<BlockId, Tally>>;
}
export type Answers = Record<string, Key | undefined>;

/** Puntaje de un conjunto de respuestas (las no respondidas cuentan como no acertadas). */
export function scoreAnswers(items: readonly AdvancedItem[], answers: Answers): ScoreBreakdown {
  const byCompetency = Object.fromEntries(COMPETENCIES.map((c) => [c, { total: 0, correct: 0 }])) as Record<Competency, Tally>;
  const byBlock: Partial<Record<BlockId, Tally>> = {};
  let correct = 0;
  let answered = 0;
  for (const it of items) {
    const a = answers[it.id];
    const ok = a === it.key;
    if (a) answered++;
    if (ok) correct++;
    byCompetency[it.competency].total++;
    if (ok) byCompetency[it.competency].correct++;
    const t = (byBlock[it.block] ??= { total: 0, correct: 0 });
    t.total++;
    if (ok) t.correct++;
  }
  return { total: items.length, correct, answered, byCompetency, byBlock };
}

export const pct = (t: Tally) => (t.total ? Math.round((t.correct / t.total) * 100) : 0);

/**
 * Lo más débil de un simulacro: la competencia y el bloque con menor porcentaje de aciertos (entre los que tuvieron
 * ítems). En empate gana el que tuvo más ítems (la estimación es menos frágil).
 */
export function weakest(score: ScoreBreakdown): { competency: Competency | null; block: BlockId | null } {
  const pick = <T extends string>(entries: [T, Tally][]): T | null => {
    const withItems = entries.filter(([, t]) => t.total > 0);
    if (!withItems.length) return null;
    withItems.sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total || b.total - a.total);
    return withItems[0][0];
  };
  return {
    competency: pick(Object.entries(score.byCompetency) as [Competency, Tally][]),
    block: pick(Object.entries(score.byBlock) as [BlockId, Tally][]),
  };
}

/**
 * Preguntas sugeridas para refuerzo: primero las que falló en el simulacro dentro de la competencia o el bloque más
 * débil; luego, entre las que no estaban en el simulacro, las de esa competencia y ese bloque, las de la competencia y
 * las del bloque.
 */
export function suggestReinforcement(bank: readonly AdvancedItem[], score: ScoreBreakdown, answers: Answers, limit = 10): AdvancedItem[] {
  const { competency, block } = weakest(score);
  if (!competency && !block) return [];
  const failed = bank.filter((it) => it.id in answers && answers[it.id] !== it.key && (it.competency === competency || it.block === block));
  const fresh = bank.filter((it) => !(it.id in answers));
  const ordered = [
    ...failed,
    ...fresh.filter((it) => it.competency === competency && it.block === block),
    ...fresh.filter((it) => it.competency === competency),
    ...fresh.filter((it) => it.block === block),
  ];
  return [...new Set(ordered)].slice(0, limit);
}

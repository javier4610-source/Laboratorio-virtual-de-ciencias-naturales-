import type { PracticeDef, Question } from '../core/types';

/**
 * Reparte la posición de la respuesta correcta entre A, B, C y D.
 * Las preguntas se redactaron con la correcta casi siempre en B; un estudiante que
 * marcara siempre B acertaría la mayoría. Cada pregunta se reordena de forma estable
 * (la misma posición en cada carga, según su id) sin cambiar ningún texto: las demás
 * opciones conservan su orden relativo y las letras se reasignan en el nuevo orden.
 */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const LETTERS = 'abcdefgh';

export function balanceQuestion(q: Question): Question {
  const correct = q.options.find((o) => o.id === q.correct);
  if (!correct) throw new Error(`La pregunta ${q.id} no tiene la opción correcta «${q.correct}».`);
  const target = hash(q.id) % q.options.length;
  const ordered = q.options.filter((o) => o !== correct);
  ordered.splice(target, 0, correct);
  return { ...q, options: ordered.map((o, i) => ({ ...o, id: LETTERS[i] })), correct: LETTERS[target] };
}

export function balancePractice(p: PracticeDef): PracticeDef {
  return { ...p, assessment: p.assessment.map(balanceQuestion) };
}

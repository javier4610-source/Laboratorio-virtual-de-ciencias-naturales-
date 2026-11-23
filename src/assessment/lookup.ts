import type { PracticeDef, Question } from '../core/types';
import { BANK_GRADES, loadBank, loadBankGrade } from './banco/cargar';

/**
 * Preguntas de transferencia de una práctica (tipo Saber 11) resueltas desde el banco, sin importar el currículo
 * completo ni el banco entero: así la página de una práctica no descarga las fichas de todas las prácticas (ver
 * docs/v2/REDISENO-2026-10.md, hallazgo 11) ni las preguntas de los otros grados (docs/v2/RENDIMIENTO.md).
 *
 * `loadPractice` (curriculum/loader.ts) llama a `ensureTransferQuestions` antes de entregar la ficha, así que en la
 * página `transferQuestions` ya es síncrono. El currículo completo (curriculum/index.ts) registra el banco entero con
 * `registerQuestions`. Una prueba unitaria verifica que el resultado es idéntico al de `questionById` del currículo.
 */
const BY_ID = new Map<string, Question>();

export function registerQuestions(qs: readonly Question[]): void {
  for (const q of qs) if (!BY_ID.has(q.id)) BY_ID.set(q.id, q);
}

export function bankQuestionById(id: string): Question | undefined {
  return BY_ID.get(id);
}

/**
 * Descarga las preguntas de transferencia de la práctica: el archivo del grado de la práctica (donde están todas, lo
 * verifica una prueba unitaria) y, si alguna faltara, el banco completo.
 */
export async function ensureTransferQuestions(p: PracticeDef): Promise<void> {
  const missing = () => p.transferQuestionIds.some((id) => !BY_ID.has(id));
  if (!missing()) return;
  if (BANK_GRADES.includes(p.grade)) registerQuestions(await loadBankGrade(p.grade));
  if (missing()) registerQuestions(await loadBank());
}

export function transferQuestions(p: PracticeDef): Question[] {
  return p.transferQuestionIds.map((id) => BY_ID.get(id)).filter((q): q is Question => !!q);
}

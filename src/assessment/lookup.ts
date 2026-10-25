import type { PracticeDef, Question } from '../core/types';
import { SABER_BANK } from './bank';

/**
 * Preguntas de transferencia de una práctica (tipo Saber 11) resueltas desde el banco, sin importar el currículo
 * completo: así la página de una práctica no descarga las 65 fichas (ver docs/v2/REDISENO-2026-10.md, hallazgo 11).
 * Una prueba unitaria verifica que el resultado es idéntico al de `questionById` del currículo.
 */
const BY_ID = new Map<string, Question>();
for (const q of SABER_BANK) if (!BY_ID.has(q.id)) BY_ID.set(q.id, q);

export function bankQuestionById(id: string): Question | undefined {
  return BY_ID.get(id);
}

export function transferQuestions(p: PracticeDef): Question[] {
  return p.transferQuestionIds.map((id) => BY_ID.get(id)).filter((q): q is Question => !!q);
}

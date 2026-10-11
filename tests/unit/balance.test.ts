import { describe, expect, it } from 'vitest';
import { balanceQuestion } from '../../src/assessment/balance';
import { ALL_QUESTIONS, PRACTICES } from '../../src/curriculum/index';
import { SABER_BANK } from '../../src/assessment/bank';
import { loadPractice } from '../../src/curriculum/loader';
import type { Question } from '../../src/core/types';

const q: Question = {
  id: 'prueba-1', grade: 9, topic: 't', competency: 'uso', component: 'fisico', skill: 's', difficulty: 'baja',
  stem: '¿?', correct: 'b', explanation: 'e', review: 'r',
  options: [
    { id: 'a', text: 'uno', feedback: 'no' }, { id: 'b', text: 'dos', feedback: 'Correcto.' },
    { id: 'c', text: 'tres', feedback: 'no' }, { id: 'd', text: 'cuatro', feedback: 'no' },
  ],
};

describe('reparto de la respuesta correcta', () => {
  it('conserva los textos, reasigna letras en orden y mantiene la correcta', () => {
    const b = balanceQuestion(q);
    expect(b.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(b.options.find((o) => o.id === b.correct)!.text).toBe('dos');
    expect(b.options.map((o) => o.text).sort()).toEqual(['cuatro', 'dos', 'tres', 'uno']);
    // Las incorrectas conservan su orden relativo.
    expect(b.options.filter((o) => o.text !== 'dos').map((o) => o.text)).toEqual(['uno', 'tres', 'cuatro']);
  });

  it('es estable: la misma pregunta queda siempre igual', () => {
    expect(balanceQuestion(q)).toEqual(balanceQuestion(q));
  });

  it('reparte las respuestas correctas entre A, B, C y D', () => {
    const counts: Record<string, number> = {};
    for (const x of ALL_QUESTIONS) counts[x.correct] = (counts[x.correct] ?? 0) + 1;
    const n = ALL_QUESTIONS.length;
    for (const letter of ['a', 'b', 'c', 'd']) {
      expect(counts[letter] / n).toBeGreaterThan(0.15);
      expect(counts[letter] / n).toBeLessThan(0.35);
    }
  });

  it('el banco, el índice y la carga bajo demanda entregan la misma versión', async () => {
    expect(SABER_BANK.every((x) => x.options.some((o) => o.id === x.correct && o.feedback.startsWith('Correcto')))).toBe(true);
    for (const p of PRACTICES) {
      const loaded = await loadPractice(p.id);
      expect(loaded.assessment).toEqual(p.assessment);
    }
  });
});

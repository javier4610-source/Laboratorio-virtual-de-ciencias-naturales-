import { describe, expect, it } from 'vitest';
import { detectTrend } from '../../src/lib/trend';
import { fmt, fmtSig, parseLocaleNumber } from '../../src/lib/format';
import { decodeCode, encodeAssignment, encodeList } from '../../src/lib/codes';
import { buildReport, scoreSession, validateReport } from '../../src/lib/report';
import { emptySession } from '../../src/lib/session';
import { practiceById } from '../../src/curriculum';
import { niceTicks } from '../../src/components/Chart';
import { simulateEnzyme } from '../../src/models/enzyme';
import { simulateStoichiometry } from '../../src/models/stoichiometry';

const pts = (xs: number[], f: (x: number) => number) => xs.map((x) => ({ x, y: f(x) }));

describe('detección de tendencias', () => {
  it('aumenta, disminuye y no cambia', () => {
    expect(detectTrend(pts([1, 2, 3, 4], (x) => 2 * x)).trend).toBe('aumenta');
    expect(detectTrend(pts([1, 2, 3, 4], (x) => 10 - x)).trend).toBe('disminuye');
    expect(detectTrend(pts([1, 2, 3, 4], () => 2.7)).trend).toBe('no cambia');
  });
  it('requiere al menos 3 valores distintos de x', () => {
    expect(detectTrend(pts([1, 1, 2], (x) => x)).trend).toBe('');
  });
  it('detecta el máximo de la curva de temperatura de una enzima simulada', () => {
    const data = [5, 15, 25, 37, 45, 55, 70].map((t) => ({ x: t, y: simulateEnzyme({ enzymeId: 'amilasa', temperature: t, pH: 7, substrate: 10, enzyme: 1, duration: 5 }).v0 }));
    expect(detectTrend(data).trend).toBe('máximo');
  });
  it('detecta la estabilización por reactivo limitante', () => {
    const data = [2, 4, 6, 8, 10, 14, 18, 22, 26].map((m) => ({ x: m, y: simulateStoichiometry({ reactionId: 'bicarbonato-vinagre', massA: m, massB: 6, yieldPercent: 100 }).theoreticalProducts[2] }));
    expect(detectTrend(data).trend).toBe('se estabiliza');
  });
});

describe('formato numérico colombiano', () => {
  it('usa coma decimal y acepta coma o punto al escribir', () => {
    expect(fmt(2.5, 2)).toBe('2,50');
    expect(parseLocaleNumber('2,5')).toBe(2.5);
    expect(parseLocaleNumber('2.5')).toBe(2.5);
    expect(Number.isNaN(parseLocaleNumber('abc'))).toBe(true);
    expect(fmtSig(0.000361, 3)).toContain('10⁻⁴');
  });
  it('marcas de eje "redondas"', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
});

describe('códigos de asignación y listas', () => {
  it('codifica y decodifica con tildes', () => {
    const a = { id: 'x1', course: '8-1', practiceId: 'mendel', objectives: 'Predecir proporciones genéticas', activities: 'Cuaderno: análisis', due: '2026-11-01', createdAt: 1 };
    const d = decodeCode(encodeAssignment(a));
    expect(d.kind).toBe('asignacion');
    expect(d.value).toEqual(a);
    const l = { id: 'l1', name: 'Unidad célula', unit: 'Periodo I', practiceIds: ['osmosis'], notes: 'ñ', createdAt: 2 };
    expect(decodeCode(encodeList(l)).value).toEqual(l);
  });
  it('rechaza códigos inválidos con un mensaje claro', () => {
    expect(() => decodeCode('hola')).toThrow(/No es un código/);
    expect(() => decodeCode('LVCN-A:%%%')).toThrow(/incompleto/);
  });
});

describe('informes', () => {
  it('construye, puntúa y valida un informe', () => {
    const p = practiceById('densidad')!;
    const s = emptySession('densidad');
    s.answers['den-1'] = { chosen: 'b', correct: true, attempts: 1, firstTryCorrect: true };
    s.answers['den-2'] = { chosen: 'a', correct: false, attempts: 2, firstTryCorrect: false };
    const score = scoreSession(p, s);
    expect(score.answered).toBe(2);
    expect(score.firstTryCorrect).toBe(1);
    expect(score.percent).toBe(50);
    const r = buildReport(p, s, { name: 'Ana', course: '6-1' });
    expect(validateReport(JSON.parse(JSON.stringify(r)))).toBeNull();
    expect(validateReport({ format: 'otro' })).toMatch(/formato/);
  });
});

import { emptyValidation, exportValidations, mergeValidations } from '../../src/lib/validation';

describe('validación curricular', () => {
  it('importa y conserva la validación más reciente por práctica', () => {
    const mine = { ph: { ...emptyValidation('ph'), status: 'validado' as const, dbaNumber: 'DBA 2', updatedAt: 200 } };
    const theirs = exportValidations({
      ph: { ...emptyValidation('ph'), status: 'ajustado', dbaNumber: 'DBA 3', updatedAt: 100 },
      ondas: { ...emptyValidation('ondas'), status: 'validado', updatedAt: 150 },
    });
    const { merged, updated } = mergeValidations(mine, JSON.parse(JSON.stringify(theirs)));
    expect(updated).toBe(1);
    expect(merged.ph.dbaNumber).toBe('DBA 2'); // la mía es más reciente
    expect(merged.ondas.status).toBe('validado');
  });
  it('rechaza archivos que no son validaciones y descarta estados inválidos', () => {
    expect(() => mergeValidations({}, { format: 'otro' })).toThrow(/no es una exportación/);
    const { merged } = mergeValidations({}, { format: 'lvcn-validacion-v1', validations: [{ practiceId: 'x', status: 'inventado' }] });
    expect(merged).toEqual({});
  });
});

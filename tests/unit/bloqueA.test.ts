import { describe, expect, it } from 'vitest';
import { BLOQUE_A } from '../../src/assessment/avanzado/bloqueA';
import { BLOCK_TARGET, BLOCKS, QA_CRITERIA, type Key } from '../../src/assessment/avanzado/types';

const KEYS: Key[] = ['A', 'B', 'C', 'D'];
const FICTICIOS = /datos ficticios con fines didácticos/i;

describe('Banco avanzado — Bloque A (entrega 1)', () => {
  it('tiene 30 ítems con ids SN-A-001…SN-A-030 y n 1–30 en orden', () => {
    const [from, to] = BLOCKS.A.range;
    expect(BLOQUE_A).toHaveLength(to - from + 1);
    BLOQUE_A.forEach((it, i) => {
      const n = from + i;
      expect(it.n).toBe(n);
      expect(it.id).toBe(`SN-A-${String(n).padStart(3, '0')}`);
      expect(it.block).toBe('A');
    });
    expect(new Set(BLOQUE_A.map((it) => it.id)).size).toBe(BLOQUE_A.length);
  });

  it('cumple la matriz de competencias (10/10/10) y niveles (10/12/8)', () => {
    for (const c of ['uso', 'explicacion', 'indagacion'] as const) {
      expect(BLOQUE_A.filter((it) => it.competency === c)).toHaveLength(BLOCK_TARGET.perCompetency);
    }
    for (const l of [1, 2, 3] as const) {
      expect(BLOQUE_A.filter((it) => it.level === l)).toHaveLength(BLOCK_TARGET.levels[l]);
    }
  });

  it('incluye al menos el mínimo de ítems con datos, y cada recurso trae su representación', () => {
    const data = BLOQUE_A.filter((it) => it.resource !== 'texto');
    expect(data.length).toBeGreaterThanOrEqual(Math.max(BLOCK_TARGET.minData, 10));
    for (const it of BLOQUE_A) {
      if (it.resource === 'tabla') expect(it.table, it.id).toBeDefined();
      if (it.resource === 'grafica') expect(it.chart, it.id).toBeDefined();
      if (it.resource === 'esquema') expect(it.schemeDescription, it.id).toBeTruthy();
      if (it.table) {
        expect(it.table.headers.length, it.id).toBeGreaterThan(1);
        it.table.rows.forEach((r) => expect(r.length, it.id).toBe(it.table!.headers.length));
      }
      if (it.chart) {
        expect(it.chart.xLabel, it.id).toMatch(/\(.+\)/); // unidad entre paréntesis
        expect(it.chart.yLabel, it.id).toMatch(/\(.+\)/);
        expect(it.chart.description.length, it.id).toBeGreaterThan(80);
        expect(it.chart.series.length, it.id).toBeGreaterThan(0);
        if (it.chart.kind === 'barras') {
          for (const s of it.chart.series) expect(s.points.length, it.id).toBe(it.chart.categories?.length);
        }
      }
    }
  });

  it('distribuye las claves entre 6 y 9 por letra, sin rachas de más de 3 iguales', () => {
    const keys = BLOQUE_A.map((it) => it.key);
    for (const k of KEYS) {
      const c = keys.filter((x) => x === k).length;
      expect(c, k).toBeGreaterThanOrEqual(BLOCK_TARGET.keyMin);
      expect(c, k).toBeLessThanOrEqual(BLOCK_TARGET.keyMax);
    }
    let run = 1;
    for (let i = 1; i < keys.length; i++) {
      run = keys[i] === keys[i - 1] ? run + 1 : 1;
      expect(run, `racha en ${i + 1}`).toBeLessThanOrEqual(BLOCK_TARGET.maxRun);
    }
    // sin ciclo mecánico: el patrón de 4 no se repite de forma consecutiva
    const quads = new Set<string>();
    let repeated = 0;
    for (let i = 0; i + 4 <= keys.length; i += 4) {
      const q = keys.slice(i, i + 4).join('');
      if (quads.has(q)) repeated++;
      quads.add(q);
    }
    expect(repeated).toBeLessThanOrEqual(1);
  });

  it('la clave no es sistemáticamente la opción más larga', () => {
    const longest = BLOQUE_A.filter((it) => {
      const len = (k: Key) => it.options[k].length;
      return KEYS.every((k) => k === it.key || len(it.key) > len(k));
    }).length;
    expect(longest).toBeLessThanOrEqual(10);
  });

  it('cada ítem tiene opciones distintas y distractores exactamente en las letras no clave', () => {
    for (const it of BLOQUE_A) {
      const texts = KEYS.map((k) => it.options[k].trim());
      texts.forEach((t) => expect(t.length, it.id).toBeGreaterThan(0));
      expect(new Set(texts).size, it.id).toBe(4);
      expect(Object.keys(it.distractors).sort(), it.id).toEqual(KEYS.filter((k) => k !== it.key));
      for (const d of Object.values(it.distractors)) {
        expect(d!.why.length, it.id).toBeGreaterThan(20);
        expect(d!.misconception.length, it.id).toBeGreaterThan(10);
      }
      for (const t of texts) expect(t, it.id).not.toMatch(/(todas|ninguna) de las anteriores/i);
      expect(it.justification.length, it.id).toBeGreaterThan(150);
      expect(it.pitfall && it.strategy, it.id).toBeTruthy();
    }
  });

  it('tiene la revisión de 15 criterios, todos en «Cumple»', () => {
    for (const it of BLOQUE_A) {
      expect(it.qa, it.id).toHaveLength(QA_CRITERIA.length);
      expect(it.qa.every((c) => c === 'Cumple'), it.id).toBe(true);
    }
  });

  it('rotula los datos simulados en el contexto o en la tabla', () => {
    for (const it of BLOQUE_A) {
      const label = FICTICIOS.test(it.context) || FICTICIOS.test(it.table?.caption ?? '');
      expect(label, it.id).toBe(it.simulatedData);
    }
  });

  it('las prácticas enlazadas existen', async () => {
    const { PRACTICES } = await import('../../src/curriculum');
    const ids = new Set(PRACTICES.map((p: { id: string }) => p.id));
    for (const it of BLOQUE_A) if (it.practiceId) expect(ids.has(it.practiceId), `${it.id} → ${it.practiceId}`).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { BLOQUE_D } from '../../src/assessment/avanzado/bloqueD';
import { BLOQUE_A } from '../../src/assessment/avanzado/bloqueA';
import { BLOQUE_B } from '../../src/assessment/avanzado/bloqueB';
import { BLOQUE_C } from '../../src/assessment/avanzado/bloqueC';
import { BLOCK_TARGET, BLOCKS, QA_CRITERIA, type Key } from '../../src/assessment/avanzado/types';
import { findKeyCycle, formatProblems, normalizeText, validateBlock, validateItem } from '../../src/assessment/avanzado/validate';

const KEYS: Key[] = ['A', 'B', 'C', 'D'];
const FICTICIOS = /datos ficticios con fines didácticos/i;

describe('Banco avanzado — Bloque D (entrega 4)', () => {
  it('tiene 30 ítems con ids SN-D-091…SN-D-120 y n 91–120 en orden', () => {
    const [from, to] = BLOCKS.D.range;
    expect(BLOQUE_D).toHaveLength(to - from + 1);
    BLOQUE_D.forEach((it, i) => {
      const n = from + i;
      expect(it.n).toBe(n);
      expect(it.id).toBe(`SN-D-${String(n).padStart(3, '0')}`);
      expect(it.block).toBe('D');
    });
    expect(new Set(BLOQUE_D.map((it) => it.id)).size).toBe(BLOQUE_D.length);
  });

  it('cumple la matriz de competencias (10/10/10) y niveles (10/12/8)', () => {
    for (const c of ['uso', 'explicacion', 'indagacion'] as const) {
      expect(BLOQUE_D.filter((it) => it.competency === c)).toHaveLength(BLOCK_TARGET.perCompetency);
    }
    for (const l of [1, 2, 3] as const) {
      expect(BLOQUE_D.filter((it) => it.level === l)).toHaveLength(BLOCK_TARGET.levels[l]);
    }
  });

  it('incluye al menos el mínimo de ítems con datos, y cada recurso trae su representación', () => {
    const data = BLOQUE_D.filter((it) => it.resource !== 'texto');
    expect(data.length).toBeGreaterThanOrEqual(Math.max(BLOCK_TARGET.minData, 10));
    for (const it of BLOQUE_D) {
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
    const keys = BLOQUE_D.map((it) => it.key);
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
    const longest = BLOQUE_D.filter((it) => {
      const len = (k: Key) => it.options[k].length;
      return KEYS.every((k) => k === it.key || len(it.key) > len(k));
    }).length;
    expect(longest).toBeLessThanOrEqual(10);
  });

  it('cada ítem tiene opciones distintas y distractores exactamente en las letras no clave', () => {
    for (const it of BLOQUE_D) {
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
    for (const it of BLOQUE_D) {
      expect(it.qa, it.id).toHaveLength(QA_CRITERIA.length);
      expect(it.qa.every((c) => c === 'Cumple'), it.id).toBe(true);
    }
  });

  it('rotula los datos simulados en el contexto o en la tabla', () => {
    for (const it of BLOQUE_D) {
      const label = FICTICIOS.test(it.context) || FICTICIOS.test(it.table?.caption ?? '');
      expect(label, it.id).toBe(it.simulatedData);
    }
  });

  it('las prácticas enlazadas existen', async () => {
    const { PRACTICES } = await import('../../src/curriculum');
    const ids = new Set(PRACTICES.map((p: { id: string }) => p.id));
    for (const it of BLOQUE_D) if (it.practiceId) expect(ids.has(it.practiceId), `${it.id} → ${it.practiceId}`).toBe(true);
  });
  it('pasa el validador del bloque sin errores ni avisos (incluido el ciclo de claves)', () => {
    const ps = [...BLOQUE_D.flatMap((it) => validateItem(it)), ...validateBlock('D', BLOQUE_D)];
    expect(ps, formatProblems(ps)).toEqual([]);
    expect(findKeyCycle(BLOQUE_D)).toBeNull();
  });

  it('reparte el nivel 3 entre las tres competencias (al menos uno de uso)', () => {
    for (const c of ['uso', 'explicacion', 'indagacion'] as const) {
      expect(BLOQUE_D.filter((it) => it.level === 3 && it.competency === c).length, c).toBeGreaterThanOrEqual(1);
    }
  });

  it('no repite contextos ni enunciados de los bloques A, B y C ni dentro del bloque', () => {
    const otros = [...BLOQUE_A, ...BLOQUE_B, ...BLOQUE_C];
    const ctx = new Set(otros.map((it) => normalizeText(it.context)));
    const stems = new Set(otros.map((it) => normalizeText(it.stem)));
    for (const it of BLOQUE_D) {
      expect(ctx.has(normalizeText(it.context)), it.id).toBe(false);
      expect(stems.has(normalizeText(it.stem)), it.id).toBe(false);
    }
    expect(new Set(BLOQUE_D.map((it) => normalizeText(it.context))).size).toBe(BLOQUE_D.length);
    expect(new Set(BLOQUE_D.map((it) => normalizeText(it.stem))).size).toBe(BLOQUE_D.length);
  });

  it('las gráficas de posición, velocidad y fuerza contra tiempo son centrales en el bloque', () => {
    const graficas = BLOQUE_D.filter((it) => it.chart && /^Tiempo \((s|ms|min)\)$/.test(it.chart.xLabel));
    expect(graficas.length).toBeGreaterThanOrEqual(5);
    const ejes = graficas.map((it) => it.chart!.yLabel).join(' ');
    expect(ejes).toMatch(/Posición/);
    expect(ejes).toMatch(/Velocidad/);
  });

  it('declara el valor de g cuando un ítem lo usa y escribe los decimales con coma', () => {
    for (const it of BLOQUE_D) {
      const texto = [it.context, it.stem, ...Object.values(it.options), it.schemeDescription ?? ''].join(' ');
      if (/9,8 m\/s²|peso|g = /.test(it.justification) && /g = 9,8|g = 10/.test(it.justification + texto)) {
        expect(texto + it.justification, it.id).toMatch(/g = (9,8|10) m\/s²|9,8 m\/s²/);
      }
      // sin decimales con punto en los textos que lee el estudiante (las gráficas usan números)
      expect(texto, it.id).not.toMatch(/\d\.\d/);
    }
  });
});

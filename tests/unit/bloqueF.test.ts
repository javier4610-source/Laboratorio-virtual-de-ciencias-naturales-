import { describe, expect, it } from 'vitest';
import { BLOQUE_F } from '../../src/assessment/avanzado/bloqueF';
import { BLOQUE_A } from '../../src/assessment/avanzado/bloqueA';
import { BLOQUE_B } from '../../src/assessment/avanzado/bloqueB';
import { BLOQUE_C } from '../../src/assessment/avanzado/bloqueC';
import { BLOQUE_D } from '../../src/assessment/avanzado/bloqueD';
import { BLOQUE_E } from '../../src/assessment/avanzado/bloqueE';
import { BLOQUES } from '../../src/assessment/avanzado/bloques';
import { BLOCK_TARGET, BLOCKS, QA_CRITERIA, type Key } from '../../src/assessment/avanzado/types';
import { GLOBAL_TARGET, findKeyCycle, formatProblems, keyStats, normalizeText, validateBank, validateBlock, validateItem } from '../../src/assessment/avanzado/validate';

const KEYS: Key[] = ['A', 'B', 'C', 'D'];
const FICTICIOS = /datos ficticios con fines didácticos/i;

describe('Banco avanzado — Bloque F (entrega 6)', () => {
  it('tiene 30 ítems con ids SN-F-151…SN-F-180 y n 151–180 en orden', () => {
    const [from, to] = BLOCKS.F.range;
    expect(BLOQUE_F).toHaveLength(to - from + 1);
    BLOQUE_F.forEach((it, i) => {
      const n = from + i;
      expect(it.n).toBe(n);
      expect(it.id).toBe(`SN-F-${String(n).padStart(3, '0')}`);
      expect(it.block).toBe('F');
    });
    expect(new Set(BLOQUE_F.map((it) => it.id)).size).toBe(BLOQUE_F.length);
  });

  it('cumple la matriz de competencias (10/10/10) y niveles (10/12/8)', () => {
    for (const c of ['uso', 'explicacion', 'indagacion'] as const) {
      expect(BLOQUE_F.filter((it) => it.competency === c)).toHaveLength(BLOCK_TARGET.perCompetency);
    }
    for (const l of [1, 2, 3] as const) {
      expect(BLOQUE_F.filter((it) => it.level === l)).toHaveLength(BLOCK_TARGET.levels[l]);
    }
  });

  it('incluye al menos el mínimo de ítems con datos, y cada recurso trae su representación', () => {
    const data = BLOQUE_F.filter((it) => it.resource !== 'texto');
    expect(data.length).toBeGreaterThanOrEqual(Math.max(BLOCK_TARGET.minData, 15));
    for (const it of BLOQUE_F) {
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
    const keys = BLOQUE_F.map((it) => it.key);
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
    const longest = BLOQUE_F.filter((it) => {
      const len = (k: Key) => it.options[k].length;
      return KEYS.every((k) => k === it.key || len(it.key) > len(k));
    }).length;
    expect(longest).toBeLessThanOrEqual(10);
  });

  it('cada ítem tiene opciones distintas y distractores exactamente en las letras no clave', () => {
    for (const it of BLOQUE_F) {
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

  it('usa coma decimal en los textos (no «0.5», «2.4»…)', () => {
    for (const it of BLOQUE_F) {
      const texts = [it.context, it.stem, it.justification, it.schemeDescription ?? '', it.chart?.description ?? '', ...KEYS.map((k) => it.options[k]),
        ...(it.table ? [it.table.caption, ...it.table.headers, ...it.table.rows.flat().map(String)] : [])];
      for (const t of texts) expect(t, it.id).not.toMatch(/\d\.\d/);
    }
  });

  it('tiene la revisión de 15 criterios, todos en «Cumple»', () => {
    for (const it of BLOQUE_F) {
      expect(it.qa, it.id).toHaveLength(QA_CRITERIA.length);
      expect(it.qa.every((c) => c === 'Cumple'), it.id).toBe(true);
    }
  });

  it('rotula los datos simulados en el contexto o en la tabla', () => {
    for (const it of BLOQUE_F) {
      const label = FICTICIOS.test(it.context) || FICTICIOS.test(it.table?.caption ?? '');
      expect(label, it.id).toBe(it.simulatedData);
    }
  });

  it('las tablas o gráficas con datos no ficticios citan una fuente', () => {
    for (const it of BLOQUE_F) if (!it.simulatedData && (it.table || it.chart)) expect(it.source, it.id).toBeTruthy();
  });

  it('las prácticas enlazadas existen', async () => {
    const { PRACTICES } = await import('../../src/curriculum');
    const ids = new Set(PRACTICES.map((p: { id: string }) => p.id));
    for (const it of BLOQUE_F) if (it.practiceId) expect(ids.has(it.practiceId), `${it.id} → ${it.practiceId}`).toBe(true);
  });

  it('pasa el validador del bloque sin errores ni avisos (incluido el ciclo de claves)', () => {
    const ps = [...BLOQUE_F.flatMap((it) => validateItem(it)), ...validateBlock('F', BLOQUE_F)];
    expect(ps, formatProblems(ps)).toEqual([]);
    expect(findKeyCycle(BLOQUE_F)).toBeNull();
  });

  it('reparte el nivel 3 entre las tres competencias', () => {
    for (const c of ['uso', 'explicacion', 'indagacion'] as const) {
      expect(BLOQUE_F.filter((it) => it.level === 3 && it.competency === c).length, c).toBeGreaterThanOrEqual(1);
    }
  });

  it('no repite contextos ni enunciados de los bloques A, B, C, D y E', () => {
    const others = [...BLOQUE_A, ...BLOQUE_B, ...BLOQUE_C, ...BLOQUE_D, ...BLOQUE_E];
    const ctx = new Set(others.map((it) => normalizeText(it.context)));
    const stems = new Set(others.map((it) => normalizeText(it.stem)));
    for (const it of BLOQUE_F) {
      expect(ctx.has(normalizeText(it.context)), it.id).toBe(false);
      expect(stems.has(normalizeText(it.stem)), it.id).toBe(false);
    }
  });

  it('no repite enunciados dentro del bloque', () => {
    const stems = BLOQUE_F.map((it) => normalizeText(it.stem));
    expect(new Set(stems).size).toBe(stems.length);
  });

  it('no forma una racha de más de 3 claves iguales en la frontera con el bloque E', () => {
    const keys = [...BLOQUE_E.slice(-3), ...BLOQUE_F.slice(0, 3)].map((it) => it.key);
    let run = 1;
    for (let i = 1; i < keys.length; i++) {
      run = keys[i] === keys[i - 1] ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(BLOCK_TARGET.maxRun);
    }
  });

  it('el banco completo (seis bloques, 180 ítems) cumple las metas globales sin errores ni avisos', () => {
    const all = BLOQUES.flat();
    expect(BLOQUES).toHaveLength(6);
    expect(all).toHaveLength(GLOBAL_TARGET.total);
    const report = validateBank(all);
    expect(report.complete).toBe(true);
    expect(report.problems, formatProblems(report.problems)).toEqual([]);
    for (const c of ['uso', 'explicacion', 'indagacion'] as const) expect(all.filter((it) => it.competency === c)).toHaveLength(GLOBAL_TARGET.perCompetency);
    for (const l of [1, 2, 3] as const) expect(all.filter((it) => it.level === l)).toHaveLength(GLOBAL_TARGET.levels[l]);
    expect(all.filter((it) => it.resource !== 'texto').length).toBeGreaterThanOrEqual(GLOBAL_TARGET.minData);
    expect(keyStats(all).longestRun.length).toBeLessThanOrEqual(BLOCK_TARGET.maxRun);
    all.forEach((it, i) => expect(it.n, it.id).toBe(i + 1));
  });
});

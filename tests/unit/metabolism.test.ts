import { describe, expect, it } from 'vitest';
import ref from '../fixtures/cobra-fba.json';
import {
  BIOMASS_ID, CARBON_SOURCES, ECOLI_CORE, ESSENTIAL_THRESHOLD, MAP_EDGES, MAP_ENERGY, MAP_NODES, REFERENCE_CONDITION, UNLIMITED,
  compileModel, conditionBounds, evalGpr, fluxVariability, geneKnockoutScan, gprGenes, massBalanceResidual, oxygenSeries, parseGpr,
  pathwayOf, roundGrowth, runFba, solveLP, type CarbonId, type FbaCondition,
} from '../../src/models/metabolism';

/** Tolerancia de la validación: error relativo 1e-6 en el crecimiento (con piso absoluto 1e-9 para valores ≈ 0). */
const REL = 1e-6;
const close = (a: number, b: number, rel = REL) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)) || Math.abs(a - b) <= 1e-9;

interface RefCondition {
  label: string; carbon: string; uptake: number; o2: number; status: string; growth: number | null;
  exchanges?: Record<string, number>; exchangeRanges?: Record<string, [number, number]>;
}
const conditions = ref.conditions as RefCondition[];
const toCond = (c: RefCondition): FbaCondition => ({ carbon: c.carbon as CarbonId, uptake: c.uptake, oxygen: c.o2 });
type KoRef = { wildType: number; growth: Record<string, number | null>; essential: string[] };
const fva = ref as unknown as Record<string, Record<string, [number, number]>>;

describe('modelo E. coli core exportado de COBRApy', () => {
  it('trae 95 reacciones, 72 metabolitos y 137 genes con la procedencia del archivo del paquete cobra', () => {
    expect(ECOLI_CORE.reactions).toHaveLength(95);
    expect(ECOLI_CORE.metabolites).toHaveLength(72);
    expect(ECOLI_CORE.genes).toHaveLength(137);
    expect(ECOLI_CORE.meta.modelId).toBe('e_coli_core');
    expect(ECOLI_CORE.meta.source.file).toBe('cobra/data/textbook.xml.gz');
    expect(ECOLI_CORE.meta.source.version).toBe(ref.cobra);
    expect(ECOLI_CORE.meta.source.sha256Gz).toBe(ref.modelSha256Gz);
    const atpm = ECOLI_CORE.reactions.find((r) => r.id === 'ATPM')!;
    expect(atpm.lb).toBe(8.39);
    // cada metabolito de cada reacción existe y la matriz S tiene las dimensiones del modelo
    const S = compileModel().A;
    expect(S).toHaveLength(72);
    expect(S[0]).toHaveLength(95);
  });
});

describe('FBA frente a COBRApy (glpk) — tests/fixtures/cobra-fba.json', () => {
  it('glucosa 10 mmol/gDW/h: aerobio 0,873921506968 h⁻¹ y anaerobio 0,211662949735 h⁻¹ (≈ 0,874 y ≈ 0,21 del programa)', () => {
    const aer = runFba(REFERENCE_CONDITION);
    const ana = runFba({ ...REFERENCE_CONDITION, oxygen: 0 });
    expect(aer.status).toBe('optimal');
    expect(close(aer.growth, conditions[0].growth!)).toBe(true);
    expect(close(ana.growth, conditions[1].growth!)).toBe(true);
    // valores de referencia del programa v2 (tolerancia declarada: ±0,001 y ±0,005 h⁻¹)
    expect(Math.abs(aer.growth - 0.874)).toBeLessThan(0.001);
    expect(Math.abs(ana.growth - 0.21)).toBeLessThan(0.005);
    expect(roundGrowth(aer.growth)).toBe(0.8739);
    expect(roundGrowth(ana.growth)).toBe(0.2117);
  });

  it(`las ${conditions.length} condiciones (fuentes de carbono, series de O₂ y de glucosa) dan el mismo crecimiento o la misma infactibilidad`, () => {
    let maxRel = 0;
    for (const c of conditions) {
      const r = runFba(toCond(c));
      if (c.status !== 'optimal') {
        expect(r.status, c.label).toBe('infeasible');
        expect(r.growth).toBe(0);
        continue;
      }
      expect(r.status, c.label).toBe('optimal');
      expect(close(r.growth, c.growth!), `${c.label}: ${r.growth} vs ${c.growth}`).toBe(true);
      maxRel = Math.max(maxRel, Math.abs(r.growth - c.growth!) / Math.max(1e-12, Math.abs(c.growth!)));
    }
    expect(maxRel).toBeLessThan(REL);
  });

  it('los intercambios de la solución están dentro del intervalo FVA de COBRApy y coinciden cuando el flujo es único', () => {
    for (const c of conditions) {
      if (c.status !== 'optimal') continue;
      const r = runFba(toCond(c));
      for (const [ex, [lo, hi]] of Object.entries(c.exchangeRanges!)) {
        const v = r.fluxes[ex];
        const a = Math.min(lo, hi), b = Math.max(lo, hi);
        expect(v, `${c.label} ${ex}`).toBeGreaterThanOrEqual(a - 1e-6 * Math.max(1, Math.abs(a)));
        expect(v, `${c.label} ${ex}`).toBeLessThanOrEqual(b + 1e-6 * Math.max(1, Math.abs(b)));
        if (b - a < 1e-9) expect(close(v, c.exchanges![ex]), `${c.label} ${ex}`).toBe(true);
      }
    }
  });

  it('la captación de glucosa y de O₂ restringidas toman exactamente su límite (10 y la serie de 1 a 21)', () => {
    for (const c of conditions.filter((x) => x.label.startsWith('serie O2') && x.o2 >= 1 && x.o2 <= 21)) {
      const r = runFba(toCond(c));
      expect(close(r.fluxes.EX_o2_e, -c.o2)).toBe(true);
      expect(close(r.fluxes.EX_glc__D_e, -10)).toBe(true);
    }
  });

  it('serie de O₂: el crecimiento no disminuye al permitir más oxígeno y se satura en 0,8739 h⁻¹ desde ≈ 21,8 mmol/gDW/h', () => {
    const s = oxygenSeries(REFERENCE_CONDITION, Array.from({ length: 31 }, (_, i) => i));
    for (let i = 1; i < s.length; i++) expect(s[i].growth).toBeGreaterThanOrEqual(s[i - 1].growth - 1e-12);
    const fromRef = conditions.filter((x) => x.label.startsWith('serie O2'));
    s.forEach((p, i) => expect(close(p.growth, fromRef[i].growth!)).toBe(true));
    expect(close(s[22].growth, s[30].growth)).toBe(true);
    expect(s[21].growth).toBeLessThan(s[22].growth);
  });
});

describe('eliminaciones de genes y reacciones (reglas GPR)', () => {
  for (const tag of ['aerobio', 'anaerobio'] as const) {
    it(`eliminación de cada uno de los 137 genes (${tag}) igual que cobra.Gene.knock_out()`, () => {
      const koRef = (ref as unknown as Record<string, KoRef>)[`geneKnockouts_${tag}`];
      const cond = tag === 'aerobio' ? REFERENCE_CONDITION : { ...REFERENCE_CONDITION, oxygen: 0 };
      const scan = geneKnockoutScan(cond);
      expect(close(scan.wildType, koRef.wildType)).toBe(true);
      expect(scan.rows).toHaveLength(137);
      for (const row of scan.rows) {
        const g = koRef.growth[row.id];
        if (g === null) expect(row.status, row.id).toBe('infeasible');
        else expect(close(row.growth, g), `${row.id}: ${row.growth} vs ${g}`).toBe(true);
      }
      // mismo conjunto de genes esenciales que cobra.flux_analysis.find_essential_genes (umbral 1 %)
      expect(ESSENTIAL_THRESHOLD).toBe(0.01);
      expect(scan.rows.filter((r) => r.essential).map((r) => r.id).sort()).toEqual(koRef.essential);
    });
  }

  it('eliminación de cada una de las 95 reacciones (aerobio) igual que cobra.Reaction.knock_out()', () => {
    const rko = ref.reactionKnockouts_aerobio as Record<string, number | null>;
    for (const r of ECOLI_CORE.reactions) {
      const res = runFba({ ...REFERENCE_CONDITION, reactionKnockouts: [r.id] });
      const g = rko[r.id];
      if (g === null) expect(res.status, r.id).toBe('infeasible');
      else expect(close(res.growth, g), `${r.id}: ${res.growth} vs ${g}`).toBe(true);
    }
  });

  it('interpreta las reglas GPR con «and» antes que «or» y paréntesis', () => {
    const atps = parseGpr(ECOLI_CORE.reactions.find((r) => r.id === 'ATPS4r')!.gpr);
    expect(gprGenes(atps).size).toBe(9);
    expect(evalGpr(atps, new Set(['b3739']))).toBe(true); // queda el primer complejo
    expect(evalGpr(atps, new Set(['b3738']))).toBe(false); // subunidad de ambos complejos
    expect(evalGpr(parseGpr('a or b and c'), new Set(['c']))).toBe(true); // = a or (b and c)
    expect(evalGpr(parseGpr('(a or b) and c'), new Set(['c']))).toBe(false);
    expect(evalGpr(parseGpr('a or b and c'), new Set(['a', 'b']))).toBe(false);
    expect(evalGpr(parseGpr(''), new Set(['x']))).toBe(true);
    expect(() => parseGpr('b1 and (b2 or')).toThrow(SyntaxError);
    expect(() => parseGpr('b1 b2')).toThrow(SyntaxError);
    // pgi (b4025): su eliminación apaga solo PGI y desvía el flujo a la vía de las pentosas
    const { disabled } = conditionBounds({ ...REFERENCE_CONDITION, geneKnockouts: ['b4025'] });
    expect(disabled).toEqual(['PGI']);
    const r = runFba({ ...REFERENCE_CONDITION, geneKnockouts: ['b4025'] });
    expect(r.fluxes.PGI).toBe(0);
    // la G6P solo puede ir a la vía de las pentosas o a la biomasa (0,205 mmol/gDW por unidad de biomasa)
    expect(r.fluxes.G6PDH2r).toBeCloseTo(10 - 0.205 * r.growth, 9);
  });
});

describe('análisis de variabilidad de flujos (FVA)', () => {
  for (const key of ['fva_aerobio_100', 'fva_aerobio_99', 'fva_anaerobio_100', 'fva_anaerobio_99']) {
    it(`${key}: mínimos y máximos de las 95 reacciones iguales a COBRApy`, () => {
      const cond = key.includes('anaerobio') ? { ...REFERENCE_CONDITION, oxygen: 0 } : REFERENCE_CONDITION;
      const mine = fluxVariability(cond, undefined, key.endsWith('99') ? 0.99 : 1)!;
      for (const [id, [lo, hi]] of Object.entries(fva[key])) {
        expect(Math.abs(mine[id][0] - lo), `${id} mín`).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(lo)));
        expect(Math.abs(mine[id][1] - hi), `${id} máx`).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(hi)));
      }
    });
  }
});

describe('calidad de las soluciones', () => {
  it('toda solución cumple el balance de masa |S·v| < 1e-9 y respeta los límites (± 1e-9)', () => {
    const conds: FbaCondition[] = [
      ...conditions.filter((c) => c.status === 'optimal').map(toCond),
      { ...REFERENCE_CONDITION, geneKnockouts: ['b1136'] }, { ...REFERENCE_CONDITION, reactionKnockouts: ['CYTBD', 'PFL'] },
    ];
    for (const cond of conds) {
      const r = runFba(cond);
      if (r.status !== 'optimal') continue;
      expect(r.balanceResidual).toBeLessThan(1e-9);
      expect(massBalanceResidual(r.fluxes)).toBeLessThan(1e-9);
      const { lb, ub } = conditionBounds(cond);
      ECOLI_CORE.reactions.forEach((rx, j) => {
        expect(r.fluxes[rx.id]).toBeGreaterThanOrEqual(lb[j] - 1e-9);
        expect(r.fluxes[rx.id]).toBeLessThanOrEqual(ub[j] + 1e-9);
      });
      expect(r.fluxes[BIOMASS_ID]).toBeCloseTo(r.growth, 12);
    }
  });

  it('es determinista: dos ejecuciones devuelven exactamente el mismo vector de flujos', () => {
    const a = runFba({ carbon: 'succ', uptake: 7.5, oxygen: 12 });
    const b = runFba({ carbon: 'succ', uptake: 7.5, oxygen: 12 });
    expect(a.fluxes).toEqual(b.fluxes);
    expect(a.iterations).toBe(b.iterations);
  });

  it('valida las entradas: rangos, fuente de carbono, genes y reacciones desconocidos', () => {
    expect(() => runFba({ ...REFERENCE_CONDITION, uptake: 25 })).toThrow(RangeError);
    expect(() => runFba({ ...REFERENCE_CONDITION, uptake: Number.NaN })).toThrow(RangeError);
    expect(() => runFba({ ...REFERENCE_CONDITION, oxygen: -1 })).toThrow(RangeError);
    expect(() => runFba({ ...REFERENCE_CONDITION, carbon: 'sacarosa' as CarbonId })).toThrow(RangeError);
    expect(() => runFba({ ...REFERENCE_CONDITION, geneKnockouts: ['b9999'] })).toThrow(RangeError);
    expect(() => runFba({ ...REFERENCE_CONDITION, reactionKnockouts: ['XYZ'] })).toThrow(RangeError);
    expect(() => fluxVariability(REFERENCE_CONDITION, ['PGI'], 1.5)).toThrow(RangeError);
    expect(UNLIMITED).toBe(1000);
  });

  it('sin fuente de carbono (captación 0) no se puede cubrir el mantenimiento ATPM ≥ 8,39: problema no factible', () => {
    const r = runFba({ ...REFERENCE_CONDITION, uptake: 0 });
    expect(r.status).toBe('infeasible');
    expect(r.growth).toBe(0);
  });
});

describe('símplex: casos límite', () => {
  it('resuelve un problema pequeño conocido (máx 3x + 2y; x + y ≤ 4; x + 3y ≤ 6) → 12 en (4, 0)', () => {
    const r = solveLP({ A: [[1, 1, 1, 0], [1, 3, 0, 1]], b: [4, 6], c: [3, 2, 0, 0], lb: [0, 0, 0, 0], ub: [Infinity, Infinity, Infinity, Infinity], maximize: true });
    expect(r.status).toBe('optimal');
    expect(r.objective).toBeCloseTo(12, 12);
    expect(r.x[0]).toBeCloseTo(4, 12);
    expect(r.x[1]).toBeCloseTo(0, 12);
  });

  it('detecta un problema no factible (x₁ + x₂ = 5 con 0 ≤ x ≤ 1) y límites inconsistentes', () => {
    expect(solveLP({ A: [[1, 1]], b: [5], c: [1, 0], lb: [0, 0], ub: [1, 1] }).status).toBe('infeasible');
    expect(solveLP({ A: [[1]], b: [0], c: [1], lb: [2], ub: [1] }).status).toBe('infeasible');
  });

  it('detecta un problema no acotado (máx x₁ con x₁ − x₂ = 0, x ≥ 0) y uno acotado con variable libre', () => {
    const u = solveLP({ A: [[1, -1]], b: [0], c: [1, 0], lb: [0, 0], ub: [Infinity, Infinity], maximize: true });
    expect(u.status).toBe('unbounded');
    expect(u.objective).toBe(Infinity);
    // mín x con x − y = −3, x libre, 0 ≤ y ≤ 2 → x = −3
    const f = solveLP({ A: [[1, -1]], b: [-3], c: [1, 0], lb: [-Infinity, 0], ub: [Infinity, 2] });
    expect(f.status).toBe('optimal');
    expect(f.objective).toBeCloseTo(-3, 12);
  });

  it('no cicla en el ejemplo degenerado de Beale (1955): óptimo −1,25', () => {
    const r = solveLP({
      A: [[1, 0, 0, 0.25, -8, -1, 9], [0, 1, 0, 0.5, -12, -0.5, 3], [0, 0, 1, 0, 0, 1, 0]],
      b: [0, 0, 1], c: [0, 0, 0, -0.75, 20, -0.5, 6], lb: new Array(7).fill(0), ub: new Array(7).fill(Infinity),
    });
    expect(r.status).toBe('optimal');
    expect(r.objective).toBeCloseTo(-1.25, 12);
    expect(r.iterations).toBeLessThan(100);
  });

  it('rechaza datos no finitos o dimensiones inconsistentes', () => {
    expect(() => solveLP({ A: [[1, Number.NaN]], b: [0], c: [1, 1], lb: [0, 0], ub: [1, 1] })).toThrow(RangeError);
    expect(() => solveLP({ A: [[1]], b: [0, 1], c: [1], lb: [0], ub: [1] })).toThrow(RangeError);
  });
});

describe('mapa de rutas', () => {
  it('cada flecha une un sustrato y un producto reales de su reacción, y los nodos son metabolitos del modelo', () => {
    const mets = new Set(ECOLI_CORE.metabolites.map((m) => m[0]));
    for (const id of Object.keys(MAP_NODES)) expect(mets.has(id), id).toBe(true);
    const seen = new Set<string>();
    for (const e of MAP_EDGES) {
      const rx = ECOLI_CORE.reactions.find((r) => r.id === e.r);
      expect(rx, e.r).toBeDefined();
      expect(seen.has(e.r), `${e.r} repetida`).toBe(false);
      seen.add(e.r);
      expect(rx!.mets[e.from], `${e.r} ${e.from}`).toBeLessThan(0);
      expect(rx!.mets[e.to], `${e.r} ${e.to}`).toBeGreaterThan(0);
      if (e.join) expect(rx!.mets[e.join], `${e.r} ${e.join}`).toBeLessThan(0);
      if (e.split) expect(rx!.mets[e.split], `${e.r} ${e.split}`).toBeGreaterThan(0);
    }
    for (const id of MAP_ENERGY) expect(ECOLI_CORE.reactions.some((r) => r.id === id)).toBe(true);
    // las 14 fuentes de carbono tienen intercambio en el modelo y una vía de entrada dibujada
    for (const s of CARBON_SOURCES) expect(ECOLI_CORE.reactions.some((r) => r.id === s.exchange)).toBe(true);
    expect(pathwayOf('PFK')).toBe('glucolisis');
    expect(pathwayOf('EX_o2_e')).toBe('intercambio');
  });
});

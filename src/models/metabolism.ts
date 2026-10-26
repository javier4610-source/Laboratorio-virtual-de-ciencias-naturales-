import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';
import coreJson from '../data/ecoli_core.json';
import type { ModelCondition } from './conditions';

/**
 * Metabolismo celular: análisis de balance de flujos (FBA) del modelo E. coli core en el navegador
 * (programa v2, sección 10.7; grado 11.º).
 *
 * El modelo NO se inventa: src/data/ecoli_core.json se exportó con scripts/validacion/cobra_fba.py desde el archivo
 * cobra/data/textbook.xml.gz que viene dentro del paquete COBRApy 0.32.1 (id del modelo «e_coli_core»; 95 reacciones,
 * 72 metabolitos y 137 genes). El FBA plantea un problema de programación lineal:
 *     maximizar v_biomasa   sujeto a   S·v = 0   y   lb ≤ v ≤ ub,
 * que aquí se resuelve con un símplex de variables acotadas, de dos fases, determinista (regla de Dantzig con cambio
 * a la regla de Bland ante degeneración, prueba de razón de Harris y reinversión periódica de la base con
 * eliminación gaussiana con pivoteo parcial). Las eliminaciones de genes se evalúan con las reglas gen-proteína-reacción
 * (GPR) del modelo, igual que cobra.Gene.knock_out(). Los resultados se validan contra COBRApy 0.32.1 + GLPK 5.0
 * (tests/fixtures/cobra-fba.json; tests/unit/metabolism.test.ts).
 * Funciones puras (sin React ni navegador).
 */

/* ------------------------------------------------------------------ datos del modelo */

export interface CoreReaction {
  id: string;
  name: string;
  lb: number;
  ub: number;
  /** Regla gen-proteína-reacción del archivo (vacía si la reacción no tiene genes asociados). */
  gpr: string;
  subsystem: string;
  /** Coeficientes estequiométricos: negativo = sustrato, positivo = producto (sentido de la ecuación del archivo). */
  mets: Record<string, number>;
}

export interface CoreModel {
  meta: {
    generator: string; exported: string; modelId: string; objective: string; units: string; note: string;
    source: { package: string; version: string; file: string; sha256Gz: string; loadCall: string; format: string; packageLicense: string };
    counts: { reactions: number; metabolites: number; genes: number };
  };
  /** [id, nombre, fórmula, compartimento]. */
  metabolites: [string, string, string, string][];
  /** [id (locus b-number de E. coli K-12 o s0001), nombre del gen en el archivo]. */
  genes: [string, string][];
  reactions: CoreReaction[];
}

export const ECOLI_CORE = coreJson as unknown as CoreModel;
export const BIOMASS_ID = 'Biomass_Ecoli_core';

/** Procedencia exacta del modelo (para la interfaz y las exportaciones). */
export const MODEL_PROVENANCE = {
  modelId: ECOLI_CORE.meta.modelId,
  file: `${ECOLI_CORE.meta.source.file} (paquete ${ECOLI_CORE.meta.source.package} ${ECOLI_CORE.meta.source.version}, PyPI)`,
  sha256Gz: ECOLI_CORE.meta.source.sha256Gz,
  loadCall: ECOLI_CORE.meta.source.loadCall,
  exported: ECOLI_CORE.meta.exported,
  reference: 'Orth, J. D., Fleming, R. M. T. y Palsson, B. Ø. (2010). Reconstruction and use of microbial metabolic networks: the core Escherichia coli metabolic model as an educational guide. EcoSal Plus, 4(1). doi:10.1128/ecosalplus.10.2.1 (PubMed 26443778).',
  referenceNote: 'El archivo SBML incluido en COBRApy no trae anotación de cita ni licencia propias; la cita del modelo E. coli core se verificó en PubMed. Licencia del archivo del modelo: por verificar (el paquete cobra declara LGPL-2.0-or-later o GPL-2.0-or-later).',
  validation: 'COBRApy 0.32.1, optlang 1.9.1, GLPK 5.0 (swiglpk 5.0.13), Python 3.13.16',
} as const;

/* ------------------------------------------------------------------ programación lineal */

export type LPStatus = 'optimal' | 'infeasible' | 'unbounded' | 'iteration_limit';

export interface LPProblem {
  /** Matriz de restricciones de igualdad A·x = b (m filas × n columnas, densa por filas). */
  A: number[][];
  b: number[];
  /** Coeficientes de la función objetivo. */
  c: number[];
  /** Límites de cada variable (se admiten −Infinity e Infinity). */
  lb: number[];
  ub: number[];
  /** true: maximizar; false (por defecto): minimizar. */
  maximize?: boolean;
}

export interface LPResult {
  status: LPStatus;
  /** Valores de las variables (solo con status «optimal»; si no, vector vacío). */
  x: number[];
  /** Valor de la función objetivo (NaN si no es óptimo; ±Infinity si no está acotado). */
  objective: number;
  iterations: number;
  /** Suma de las variables artificiales al terminar la fase 1 (0 si el problema es factible). */
  infeasibility: number;
}

export const LP_TOL = {
  /** Tolerancia de factibilidad primal (prueba de razón de Harris). */
  primal: 1e-10,
  /** Tolerancia de optimalidad (costos reducidos). */
  dual: 1e-9,
  /** Pivote mínimo aceptado. */
  pivot: 1e-9,
  /** Infactibilidad residual máxima de la fase 1 (relativa a 1 + máx|b| + máx|límites finitos usados|). */
  infeasible: 1e-8,
} as const;

const REINVERT_EVERY = 50;
const DEGENERATE_TO_BLAND = 25;

/**
 * Símplex primal de variables acotadas, en dos fases, con tableau denso.
 * Determinista: con los mismos datos siempre recorre las mismas bases y devuelve la misma solución.
 * Pensado para problemas pequeños (cientos de variables); el modelo E. coli core tiene 72 filas y 95 columnas.
 */
export function solveLP(p: LPProblem, opts: { maxIterations?: number } = {}): LPResult {
  const m = p.A.length;
  const n = p.c.length;
  if (p.b.length !== m || p.lb.length !== n || p.ub.length !== n) throw new RangeError('Dimensiones inconsistentes del problema lineal.');
  for (let i = 0; i < m; i++) {
    if (p.A[i].length !== n) throw new RangeError(`La fila ${i} de A no tiene ${n} columnas.`);
    if (!Number.isFinite(p.b[i])) throw new RangeError('b debe ser finito.');
    for (let j = 0; j < n; j++) if (!Number.isFinite(p.A[i][j])) throw new RangeError('A debe ser finita.');
  }
  for (let j = 0; j < n; j++) {
    if (Number.isNaN(p.lb[j]) || Number.isNaN(p.ub[j]) || !Number.isFinite(p.c[j])) throw new RangeError('Límites u objetivo no válidos.');
    if (p.lb[j] > p.ub[j]) return { status: 'infeasible', x: [], objective: NaN, iterations: 0, infeasibility: p.lb[j] - p.ub[j] };
  }
  const maxIter = opts.maxIterations ?? 20000;
  const N = n + m;
  const lo = new Float64Array(N);
  const hi = new Float64Array(N);
  const x = new Float64Array(N);
  let scale = 1;
  for (let j = 0; j < n; j++) {
    lo[j] = p.lb[j]; hi[j] = p.ub[j];
    x[j] = lo[j] > 0 ? lo[j] : hi[j] < 0 ? hi[j] : 0; // valor más cercano a 0 dentro de los límites
    scale = Math.max(scale, Math.abs(x[j]));
  }
  // Matriz completa [A | diag(signo)] y base inicial de variables artificiales.
  const M: Float64Array[] = [];
  const T: Float64Array[] = [];
  const basis = new Int32Array(m);
  const isBasic = new Uint8Array(N);
  for (let i = 0; i < m; i++) {
    let r = p.b[i];
    for (let j = 0; j < n; j++) r -= p.A[i][j] * x[j];
    scale = Math.max(scale, Math.abs(p.b[i]));
    const s = r >= 0 ? 1 : -1;
    const row = new Float64Array(N);
    for (let j = 0; j < n; j++) row[j] = p.A[i][j];
    row[n + i] = s;
    M.push(row);
    const t = new Float64Array(N);
    for (let j = 0; j < N; j++) t[j] = s * row[j];
    T.push(t);
    lo[n + i] = 0; hi[n + i] = Infinity; x[n + i] = Math.abs(r);
    basis[i] = n + i; isBasic[n + i] = 1;
  }
  const d = new Float64Array(N);
  let iterations = 0;

  /** Recalcula B⁻¹ desde los datos originales: tableau T = B⁻¹·M y valores básicos exactos para la base actual. */
  const reinvert = () => {
    if (m === 0) return;
    // Gauss-Jordan con pivoteo parcial sobre [B | M | rhs].
    const W = m + N + 1;
    const G: Float64Array[] = [];
    for (let i = 0; i < m; i++) {
      const g = new Float64Array(W);
      for (let k = 0; k < m; k++) g[k] = M[i][basis[k]];
      for (let j = 0; j < N; j++) g[m + j] = M[i][j];
      let rhs = p.b[i];
      for (let j = 0; j < N; j++) if (!isBasic[j] && x[j] !== 0) rhs -= M[i][j] * x[j];
      g[W - 1] = rhs;
      G.push(g);
    }
    for (let k = 0; k < m; k++) {
      let piv = k, best = Math.abs(G[k][k]);
      for (let i = k + 1; i < m; i++) { const a = Math.abs(G[i][k]); if (a > best) { best = a; piv = i; } }
      if (best < 1e-12) throw new Error('Base singular al reinvertir (problema mal condicionado).');
      if (piv !== k) { const tmp = G[k]; G[k] = G[piv]; G[piv] = tmp; }
      const gk = G[k];
      const inv = 1 / gk[k];
      for (let j = k; j < W; j++) gk[j] *= inv;
      for (let i = 0; i < m; i++) {
        if (i === k) continue;
        const f = G[i][k];
        if (f === 0) continue;
        const gi = G[i];
        for (let j = k; j < W; j++) gi[j] -= f * gk[j];
      }
    }
    // Tras Gauss-Jordan, la fila k corresponde a la variable básica basis[k].
    for (let k = 0; k < m; k++) {
      const t = T[k], g = G[k];
      for (let j = 0; j < N; j++) t[j] = g[m + j];
      x[basis[k]] = g[W - 1];
    }
  };

  const computeReduced = (cost: Float64Array) => {
    for (let j = 0; j < N; j++) d[j] = cost[j];
    for (let i = 0; i < m; i++) {
      const cb = cost[basis[i]];
      if (cb === 0) continue;
      const t = T[i];
      for (let j = 0; j < N; j++) d[j] -= cb * t[j];
    }
    for (let i = 0; i < m; i++) d[basis[i]] = 0;
  };

  /** Recorre bases hasta el óptimo de `cost` (minimización). */
  const runPhase = (cost: Float64Array): LPStatus => {
    computeReduced(cost);
    let sinceReinvert = 0;
    let degenerate = 0;
    let bland = false;
    for (;;) {
      if (iterations >= maxIter) return 'iteration_limit';
      if (sinceReinvert >= REINVERT_EVERY) { reinvert(); computeReduced(cost); sinceReinvert = 0; }
      // Precio: elegir la variable que entra.
      let q = -1, dir = 0, bestScore = 0;
      for (let j = 0; j < N; j++) {
        if (isBasic[j] || hi[j] - lo[j] <= 0) continue;
        const dj = d[j];
        let s = 0, dj2 = 0;
        if (dj < -LP_TOL.dual && x[j] < hi[j]) { s = 1; dj2 = -dj; }
        else if (dj > LP_TOL.dual && x[j] > lo[j]) { s = -1; dj2 = dj; }
        if (s === 0) continue;
        if (bland) { q = j; dir = s; break; }
        if (dj2 > bestScore) { bestScore = dj2; q = j; dir = s; }
      }
      if (q < 0) {
        if (sinceReinvert === 0) return 'optimal';
        reinvert(); computeReduced(cost); sinceReinvert = 0;
        continue; // confirmar el óptimo con un tableau recién calculado
      }
      // Prueba de razón (Harris, dos pasadas; en modo Bland, razón mínima con desempate por índice).
      const tEnter = dir > 0 ? hi[q] - x[q] : x[q] - lo[q];
      let tBound = tEnter;
      for (let i = 0; i < m; i++) {
        const a = dir * T[i][q];
        const bi = basis[i];
        if (a > LP_TOL.pivot && lo[bi] > -Infinity) tBound = Math.min(tBound, (x[bi] - lo[bi] + LP_TOL.primal) / a);
        else if (a < -LP_TOL.pivot && hi[bi] < Infinity) tBound = Math.min(tBound, (hi[bi] - x[bi] + LP_TOL.primal) / -a);
      }
      let r = -1, tStep = Infinity, bestA = 0;
      for (let i = 0; i < m; i++) {
        const a = dir * T[i][q];
        const bi = basis[i];
        let ti = Infinity;
        if (a > LP_TOL.pivot && lo[bi] > -Infinity) ti = Math.max(0, (x[bi] - lo[bi]) / a);
        else if (a < -LP_TOL.pivot && hi[bi] < Infinity) ti = Math.max(0, (hi[bi] - x[bi]) / -a);
        else continue;
        if (bland) {
          if (ti < tStep - 1e-15 || (Math.abs(ti - tStep) <= 1e-15 && r >= 0 && bi < basis[r])) { tStep = ti; r = i; }
        } else if (ti <= tBound && Math.abs(a) > bestA) { bestA = Math.abs(a); tStep = ti; r = i; }
      }
      if (r < 0 && !Number.isFinite(tEnter)) return 'unbounded';
      iterations++; sinceReinvert++;
      if (r < 0 || tEnter <= tStep) {
        // La variable que entra llega a su otro límite: cambio de límite sin pivoteo.
        const t = tEnter;
        for (let i = 0; i < m; i++) x[basis[i]] -= dir * t * T[i][q];
        x[q] = dir > 0 ? hi[q] : lo[q];
        degenerate = 0; bland = false;
        continue;
      }
      const t = tStep;
      for (let i = 0; i < m; i++) x[basis[i]] -= dir * t * T[i][q];
      x[q] += dir * t;
      const leaving = basis[r];
      const aLeave = dir * T[r][q];
      x[leaving] = aLeave > 0 ? lo[leaving] : hi[leaving];
      // Pivoteo en (r, q).
      const tr = T[r];
      const inv = 1 / tr[q];
      for (let j = 0; j < N; j++) tr[j] *= inv;
      for (let i = 0; i < m; i++) {
        if (i === r) continue;
        const f = T[i][q];
        if (f === 0) continue;
        const ti = T[i];
        for (let j = 0; j < N; j++) ti[j] -= f * tr[j];
      }
      const fq = d[q];
      if (fq !== 0) for (let j = 0; j < N; j++) d[j] -= fq * tr[j];
      isBasic[leaving] = 0; isBasic[q] = 1; basis[r] = q;
      d[q] = 0;
      if (t <= 1e-12) { degenerate++; if (degenerate > DEGENERATE_TO_BLAND) bland = true; }
      else { degenerate = 0; bland = false; }
    }
  };

  // Fase 1: minimizar la suma de las artificiales.
  const cost1 = new Float64Array(N);
  for (let i = 0; i < m; i++) cost1[n + i] = 1;
  const s1 = runPhase(cost1);
  if (s1 === 'iteration_limit') return { status: s1, x: [], objective: NaN, iterations, infeasibility: NaN };
  reinvert();
  let infeas = 0;
  for (let i = 0; i < m; i++) infeas += Math.max(0, x[n + i]);
  if (infeas > LP_TOL.infeasible * scale) return { status: 'infeasible', x: [], objective: NaN, iterations, infeasibility: infeas };
  // Las artificiales quedan fijas en 0 (las básicas con valor ~0 salen en pivotes degenerados si hace falta).
  for (let i = 0; i < m; i++) { hi[n + i] = 0; if (!isBasic[n + i]) x[n + i] = 0; }
  // Fase 2.
  const sign = p.maximize ? -1 : 1;
  const cost2 = new Float64Array(N);
  for (let j = 0; j < n; j++) cost2[j] = sign * p.c[j];
  const s2 = runPhase(cost2);
  if (s2 === 'unbounded') return { status: 'unbounded', x: [], objective: p.maximize ? Infinity : -Infinity, iterations, infeasibility: infeas };
  if (s2 === 'iteration_limit') return { status: s2, x: [], objective: NaN, iterations, infeasibility: infeas };
  reinvert();
  const out: number[] = new Array(n);
  let obj = 0;
  for (let j = 0; j < n; j++) {
    let v = x[j];
    if (Math.abs(v) < 1e-13) v = 0; // limpia ceros numéricos (−0, 1e-16)
    out[j] = v;
    obj += p.c[j] * v;
  }
  return { status: 'optimal', x: out, objective: obj, iterations, infeasibility: infeas };
}

/* ------------------------------------------------------------------ reglas gen-proteína-reacción */

export type GprNode = { kind: 'gene'; id: string } | { kind: 'and' | 'or'; args: GprNode[] };

/** Interpreta una regla GPR («b0001 and (b0002 or b0003)»); «and» tiene prioridad sobre «or», como en COBRApy. */
export function parseGpr(rule: string): GprNode | null {
  const tokens = rule.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const parseOr = (): GprNode => {
    const args = [parseAnd()];
    while (peek() !== undefined && peek().toLowerCase() === 'or') { pos++; args.push(parseAnd()); }
    return args.length === 1 ? args[0] : { kind: 'or', args };
  };
  const parseAnd = (): GprNode => {
    const args = [parseAtom()];
    while (peek() !== undefined && peek().toLowerCase() === 'and') { pos++; args.push(parseAtom()); }
    return args.length === 1 ? args[0] : { kind: 'and', args };
  };
  const parseAtom = (): GprNode => {
    const t = tokens[pos++];
    if (t === undefined) throw new SyntaxError(`Regla GPR incompleta: «${rule}».`);
    if (t === '(') {
      const node = parseOr();
      if (tokens[pos++] !== ')') throw new SyntaxError(`Falta «)» en la regla GPR «${rule}».`);
      return node;
    }
    if (t === ')' || /^(and|or)$/i.test(t)) throw new SyntaxError(`Símbolo inesperado «${t}» en la regla GPR «${rule}».`);
    if (!/^[A-Za-z0-9_.:-]+$/.test(t)) throw new SyntaxError(`Identificador de gen no válido «${t}».`);
    return { kind: 'gene', id: t };
  };
  const node = parseOr();
  if (pos !== tokens.length) throw new SyntaxError(`Sobran símbolos en la regla GPR «${rule}».`);
  return node;
}

/** true si la reacción sigue activa cuando los genes de `knocked` están eliminados. */
export function evalGpr(node: GprNode | null, knocked: ReadonlySet<string>): boolean {
  if (!node) return true;
  if (node.kind === 'gene') return !knocked.has(node.id);
  return node.kind === 'and' ? node.args.every((a) => evalGpr(a, knocked)) : node.args.some((a) => evalGpr(a, knocked));
}

export function gprGenes(node: GprNode | null, out: Set<string> = new Set()): Set<string> {
  if (!node) return out;
  if (node.kind === 'gene') out.add(node.id);
  else node.args.forEach((a) => gprGenes(a, out));
  return out;
}

/* ------------------------------------------------------------------ condiciones del experimento */

export const CARBON_SOURCES = [
  { id: 'glc__D', label: 'Glucosa', exchange: 'EX_glc__D_e' },
  { id: 'fru', label: 'Fructosa', exchange: 'EX_fru_e' },
  { id: 'ac', label: 'Acetato', exchange: 'EX_ac_e' },
  { id: 'succ', label: 'Succinato', exchange: 'EX_succ_e' },
  { id: 'pyr', label: 'Piruvato', exchange: 'EX_pyr_e' },
  { id: 'mal__L', label: 'L-malato', exchange: 'EX_mal__L_e' },
  { id: 'fum', label: 'Fumarato', exchange: 'EX_fum_e' },
  { id: 'akg', label: '2-oxoglutarato', exchange: 'EX_akg_e' },
  { id: 'lac__D', label: 'D-lactato', exchange: 'EX_lac__D_e' },
  { id: 'glu__L', label: 'L-glutamato', exchange: 'EX_glu__L_e' },
  { id: 'gln__L', label: 'L-glutamina', exchange: 'EX_gln__L_e' },
  { id: 'etoh', label: 'Etanol', exchange: 'EX_etoh_e' },
  { id: 'acald', label: 'Acetaldehído', exchange: 'EX_acald_e' },
  { id: 'for', label: 'Formiato', exchange: 'EX_for_e' },
] as const;
export type CarbonId = (typeof CARBON_SOURCES)[number]['id'];

export const FBA_LIMITS = {
  /** Captación máxima de la fuente de carbono, mmol/gDW/h. */
  uptake: [0, 20] as [number, number],
  /** Captación máxima de O₂, mmol/gDW/h (1000 = límite del archivo, «ilimitado»). */
  oxygen: [0, 1000] as [number, number],
  /** Fracción del óptimo exigida en el FVA. */
  fraction: [0, 1] as [number, number],
  maxKnockouts: 10,
};
export const UNLIMITED = 1000;
/** Resolución con que se muestran y guardan los resultados. */
export const GROWTH_RES = 0.0001; // h⁻¹
export const FLUX_RES = 0.01; // mmol/gDW/h

export interface FbaCondition {
  carbon: CarbonId;
  /** Captación máxima de la fuente de carbono (mmol/gDW/h): límite inferior del intercambio = −uptake. */
  uptake: number;
  /** Captación máxima de O₂ (mmol/gDW/h): límite inferior de EX_o2_e = −oxygen. */
  oxygen: number;
  geneKnockouts?: string[];
  reactionKnockouts?: string[];
}

export const REFERENCE_CONDITION: FbaCondition = { carbon: 'glc__D', uptake: 10, oxygen: UNLIMITED, geneKnockouts: [], reactionKnockouts: [] };

interface Compiled { A: number[][]; metIds: string[]; rxnIds: string[]; rxnIndex: Map<string, number>; gpr: (GprNode | null)[]; geneIds: Set<string> }
const compiledCache = new WeakMap<CoreModel, Compiled>();

/** Matriz estequiométrica S (metabolitos × reacciones) y reglas GPR interpretadas (en caché por modelo). */
export function compileModel(model: CoreModel = ECOLI_CORE): Compiled {
  const hit = compiledCache.get(model);
  if (hit) return hit;
  const metIds = model.metabolites.map((x) => x[0]);
  const metIndex = new Map(metIds.map((id, i) => [id, i]));
  const rxnIds = model.reactions.map((r) => r.id);
  const A = metIds.map(() => new Array<number>(rxnIds.length).fill(0));
  model.reactions.forEach((r, j) => {
    for (const [met, coef] of Object.entries(r.mets)) {
      const i = metIndex.get(met);
      if (i === undefined) throw new Error(`La reacción ${r.id} usa el metabolito desconocido ${met}.`);
      A[i][j] = coef;
    }
  });
  const out: Compiled = {
    A, metIds, rxnIds, rxnIndex: new Map(rxnIds.map((id, j) => [id, j])),
    gpr: model.reactions.map((r) => parseGpr(r.gpr)), geneIds: new Set(model.genes.map((g) => g[0])),
  };
  compiledCache.set(model, out);
  return out;
}

export function validateCondition(cond: FbaCondition, model: CoreModel = ECOLI_CORE): void {
  if (!CARBON_SOURCES.some((c) => c.id === cond.carbon)) throw new RangeError(`Fuente de carbono desconocida: ${cond.carbon}.`);
  assertInRange('La captación de la fuente de carbono', cond.uptake, ...FBA_LIMITS.uptake);
  assertInRange('La captación de oxígeno', cond.oxygen, ...FBA_LIMITS.oxygen);
  const c = compileModel(model);
  const genes = cond.geneKnockouts ?? [], rxns = cond.reactionKnockouts ?? [];
  if (genes.length + rxns.length > FBA_LIMITS.maxKnockouts) throw new RangeError(`Se admiten como máximo ${FBA_LIMITS.maxKnockouts} eliminaciones a la vez.`);
  for (const g of genes) if (!c.geneIds.has(g)) throw new RangeError(`El gen ${g} no está en el modelo.`);
  for (const r of rxns) if (!c.rxnIndex.has(r)) throw new RangeError(`La reacción ${r} no está en el modelo.`);
}

/** Límites de cada reacción en una condición: fuente de carbono, oxígeno y eliminaciones. */
export function conditionBounds(cond: FbaCondition, model: CoreModel = ECOLI_CORE): { lb: number[]; ub: number[]; disabled: string[] } {
  validateCondition(cond, model);
  const c = compileModel(model);
  const lb = model.reactions.map((r) => r.lb);
  const ub = model.reactions.map((r) => r.ub);
  for (const src of CARBON_SOURCES) lb[c.rxnIndex.get(src.exchange)!] = 0;
  const ex = CARBON_SOURCES.find((s) => s.id === cond.carbon)!.exchange;
  lb[c.rxnIndex.get(ex)!] = -cond.uptake;
  lb[c.rxnIndex.get('EX_o2_e')!] = -cond.oxygen;
  const knocked = new Set(cond.geneKnockouts ?? []);
  const disabled = new Set<string>(cond.reactionKnockouts ?? []);
  if (knocked.size > 0) model.reactions.forEach((r, j) => { if (!evalGpr(c.gpr[j], knocked)) disabled.add(r.id); });
  for (const id of disabled) { const j = c.rxnIndex.get(id)!; lb[j] = 0; ub[j] = 0; }
  return { lb, ub, disabled: model.reactions.filter((r) => disabled.has(r.id)).map((r) => r.id) };
}

export interface FbaResult {
  status: LPStatus;
  /** Crecimiento óptimo (flujo de la reacción de biomasa, h⁻¹); 0 si no hay solución factible. */
  growth: number;
  /** Flujo de cada reacción en la solución devuelta (mmol/gDW/h); vacío si no es factible. */
  fluxes: Record<string, number>;
  /** Reacciones bloqueadas por las eliminaciones. */
  disabled: string[];
  iterations: number;
  /** máx |S·v| de la solución (balance de masa). */
  balanceResidual: number;
}

function lpFor(cond: FbaCondition, model: CoreModel, objective: string, maximize: boolean, extra?: (lb: number[], ub: number[]) => void) {
  const c = compileModel(model);
  const { lb, ub, disabled } = conditionBounds(cond, model);
  extra?.(lb, ub);
  const cost = new Array<number>(c.rxnIds.length).fill(0);
  cost[c.rxnIndex.get(objective)!] = 1;
  const problem: LPProblem = { A: c.A, b: new Array<number>(c.metIds.length).fill(0), c: cost, lb, ub, maximize };
  return { problem, disabled, c };
}

/** Residuo máximo del balance de masa |S·v| para un vector de flujos. */
export function massBalanceResidual(fluxes: Record<string, number>, model: CoreModel = ECOLI_CORE): number {
  const c = compileModel(model);
  let worst = 0;
  for (const row of c.A) {
    let s = 0;
    for (let j = 0; j < row.length; j++) if (row[j] !== 0) s += row[j] * (fluxes[c.rxnIds[j]] ?? 0);
    worst = Math.max(worst, Math.abs(s));
  }
  return worst;
}

/** FBA: maximiza la reacción de biomasa en la condición dada. */
export function runFba(cond: FbaCondition, model: CoreModel = ECOLI_CORE): FbaResult {
  const { problem, disabled, c } = lpFor(cond, model, BIOMASS_ID, true);
  const res = solveLP(problem);
  if (res.status !== 'optimal') return { status: res.status, growth: 0, fluxes: {}, disabled, iterations: res.iterations, balanceResidual: NaN };
  const fluxes: Record<string, number> = {};
  c.rxnIds.forEach((id, j) => { fluxes[id] = res.x[j]; });
  return { status: 'optimal', growth: Math.max(0, res.objective), fluxes, disabled, iterations: res.iterations, balanceResidual: massBalanceResidual(fluxes, model) };
}

/**
 * Análisis de variabilidad de flujos (FVA): mínimo y máximo de cada reacción manteniendo la biomasa ≥ fracción × óptimo
 * (misma definición que cobra.flux_analysis.flux_variability_analysis, sin restricciones de lazos).
 */
export function fluxVariability(cond: FbaCondition, reactionIds?: string[], fraction = 1, model: CoreModel = ECOLI_CORE): Record<string, [number, number]> | null {
  assertInRange('La fracción del óptimo', fraction, ...FBA_LIMITS.fraction);
  const base = runFba(cond, model);
  if (base.status !== 'optimal') return null;
  const ids = reactionIds ?? model.reactions.map((r) => r.id);
  const out: Record<string, [number, number]> = {};
  const c = compileModel(model);
  const bio = c.rxnIndex.get(BIOMASS_ID)!;
  const floor = fraction * base.growth;
  for (const id of ids) {
    if (!c.rxnIndex.has(id)) throw new RangeError(`La reacción ${id} no está en el modelo.`);
    const range: number[] = [];
    for (const maximize of [false, true]) {
      const { problem } = lpFor(cond, model, id, maximize, (lb, ub) => { lb[bio] = Math.min(floor, ub[bio]); });
      const r = solveLP(problem);
      range.push(r.status === 'optimal' ? r.objective : NaN);
    }
    out[id] = [range[0], range[1]];
  }
  return out;
}

export interface KnockoutRow { id: string; name: string; growth: number; ratio: number; essential: boolean; status: LPStatus; disabled: string[] }

/** Umbral de esencialidad: crecimiento < 1 % del óptimo de referencia (por defecto de cobra.flux_analysis.find_essential_genes). */
export const ESSENTIAL_THRESHOLD = 0.01;

/** Elimina cada gen por separado y clasifica como esencial si el crecimiento cae por debajo del umbral. */
export function geneKnockoutScan(cond: FbaCondition, model: CoreModel = ECOLI_CORE, threshold = ESSENTIAL_THRESHOLD): { wildType: number; rows: KnockoutRow[] } {
  const wt = runFba(cond, model);
  const base = cond.geneKnockouts ?? [];
  const rows = model.genes.map(([id, name]) => {
    const kc = { ...cond, geneKnockouts: base.includes(id) ? base : [...base, id] };
    const { disabled } = conditionBounds(kc, model);
    const unchanged = disabled.length === conditionBounds(cond, model).disabled.length;
    const r = unchanged ? wt : runFba(kc, model);
    const ratio = wt.growth > 0 ? r.growth / wt.growth : 0;
    return { id, name, growth: r.growth, ratio, essential: r.growth < threshold * wt.growth || r.status !== 'optimal', status: r.status, disabled };
  });
  return { wildType: wt.growth, rows };
}

/** Crecimiento óptimo frente a la captación máxima de O₂ (serie calculada con el mismo FBA). */
export function oxygenSeries(cond: FbaCondition, values: number[], model: CoreModel = ECOLI_CORE): { oxygen: number; growth: number; status: LPStatus }[] {
  return values.map((o) => { const r = runFba({ ...cond, oxygen: o }, model); return { oxygen: o, growth: r.growth, status: r.status }; });
}

/* ------------------------------------------------------------------ lecturas para la interfaz */

export const roundGrowth = (v: number) => roundToResolution(v, GROWTH_RES);
export const roundFlux = (v: number) => roundToResolution(v, FLUX_RES);

/** Intercambios que se muestran en la tabla de resultados (signo del modelo: negativo = captación, positivo = secreción). */
export const KEY_EXCHANGES = [
  { id: 'EX_glc__D_e', label: 'Glucosa' }, { id: 'EX_o2_e', label: 'O₂' }, { id: 'EX_co2_e', label: 'CO₂' },
  { id: 'EX_ac_e', label: 'Acetato' }, { id: 'EX_etoh_e', label: 'Etanol' }, { id: 'EX_for_e', label: 'Formiato' },
  { id: 'EX_lac__D_e', label: 'D-lactato' }, { id: 'EX_succ_e', label: 'Succinato' }, { id: 'EX_nh4_e', label: 'Amonio (NH₄⁺)' },
] as const;

/** Reacciones internas destacadas por vía (agrupación didáctica de este laboratorio; el archivo del modelo no trae subsistemas). */
export const KEY_REACTIONS = [
  { id: 'GLCpts', label: 'Entrada de glucosa (PTS)' }, { id: 'PGI', label: 'Glucosa-6-P isomerasa' }, { id: 'PFK', label: 'Fosfofructocinasa' },
  { id: 'GAPD', label: 'Gliceraldehído-3-P deshidrogenasa' }, { id: 'PYK', label: 'Piruvato cinasa' }, { id: 'G6PDH2r', label: 'Glucosa-6-P deshidrogenasa (pentosas)' },
  { id: 'PDH', label: 'Piruvato deshidrogenasa' }, { id: 'PFL', label: 'Piruvato formiato liasa' }, { id: 'CS', label: 'Citrato sintasa' },
  { id: 'AKGDH', label: '2-oxoglutarato deshidrogenasa' }, { id: 'ICL', label: 'Isocitrato liasa (glioxilato)' }, { id: 'PPC', label: 'PEP carboxilasa' },
  { id: 'NADH16', label: 'NADH deshidrogenasa (complejo I)' }, { id: 'CYTBD', label: 'Citocromo oxidasa bd' }, { id: 'ATPS4r', label: 'ATP sintasa' },
  { id: 'ATPM', label: 'ATP de mantenimiento' },
] as const;

export type PathwayGroup = 'glucolisis' | 'pentosas' | 'krebs' | 'glioxilato' | 'anaplerosis' | 'fermentacion' | 'respiracion' | 'nitrogeno' | 'transporte' | 'intercambio' | 'biomasa';

export const PATHWAY_LABEL: Record<PathwayGroup, string> = {
  glucolisis: 'Glucólisis y gluconeogénesis', pentosas: 'Vía de las pentosas fosfato', krebs: 'Ciclo de Krebs', glioxilato: 'Ciclo del glioxilato',
  anaplerosis: 'Reacciones anapleróticas', fermentacion: 'Fermentación', respiracion: 'Fosforilación oxidativa y energía', nitrogeno: 'Glutamato y glutamina',
  transporte: 'Transporte por la membrana', intercambio: 'Intercambio con el medio', biomasa: 'Biomasa (objetivo)',
};

const GROUPS: Record<Exclude<PathwayGroup, 'transporte' | 'intercambio'>, string[]> = {
  glucolisis: ['PGI', 'PFK', 'FBP', 'FBA', 'TPI', 'GAPD', 'PGK', 'PGM', 'ENO', 'PYK', 'PPS'],
  pentosas: ['G6PDH2r', 'PGL', 'GND', 'RPI', 'RPE', 'TKT1', 'TKT2', 'TALA'],
  krebs: ['PDH', 'CS', 'ACONTa', 'ACONTb', 'ICDHyr', 'AKGDH', 'SUCOAS', 'SUCDi', 'FRD7', 'FUM', 'MDH'],
  glioxilato: ['ICL', 'MALS'],
  anaplerosis: ['PPC', 'PPCK', 'ME1', 'ME2'],
  fermentacion: ['PFL', 'LDH_D', 'PTAr', 'ACKr', 'ACALD', 'ALCD2x'],
  respiracion: ['NADH16', 'CYTBD', 'ATPS4r', 'THD2', 'NADTRHD', 'ADK1', 'ATPM'],
  nitrogeno: ['GLUDy', 'GLNS', 'GLUN', 'GLUSy'],
  biomasa: [BIOMASS_ID],
};

/** Vía (agrupación didáctica) de una reacción. */
export function pathwayOf(id: string): PathwayGroup {
  if (id.startsWith('EX_')) return 'intercambio';
  for (const [g, ids] of Object.entries(GROUPS)) if (ids.includes(id)) return g as PathwayGroup;
  return 'transporte';
}

/* ------------------------------------------------------------------ mapa de rutas (coordenadas del dibujo) */

/** Nodo del mapa: metabolito del modelo, posición en el lienzo de 1040 × 772 y rótulo corto. */
export const MAP_NODES: Record<string, { x: number; y: number; label: string }> = {
  glc__D_e: { x: 200, y: 22, label: 'Glucosa' }, fru_e: { x: 40, y: 165, label: 'Fructosa' },
  g6p_c: { x: 200, y: 100, label: 'G6P' }, f6p_c: { x: 200, y: 165, label: 'F6P' }, fdp_c: { x: 200, y: 230, label: 'FBP' },
  dhap_c: { x: 115, y: 262, label: 'DHAP' }, g3p_c: { x: 200, y: 295, label: 'G3P' }, '13dpg_c': { x: 200, y: 355, label: '1,3-BPG' },
  '3pg_c': { x: 200, y: 410, label: '3PG' }, '2pg_c': { x: 200, y: 465, label: '2PG' }, pep_c: { x: 200, y: 520, label: 'PEP' },
  pyr_c: { x: 200, y: 600, label: 'Piruvato' }, pyr_e: { x: 40, y: 600, label: 'Piruvato' },
  lac__D_c: { x: 125, y: 662, label: 'Lactato' }, lac__D_e: { x: 40, y: 662, label: 'D-lactato' },
  '6pgl_c': { x: 330, y: 100, label: '6PGL' }, '6pgc_c': { x: 440, y: 100, label: '6PG' }, ru5p__D_c: { x: 550, y: 100, label: 'Ru5P' },
  xu5p__D_c: { x: 550, y: 165, label: 'Xu5P' }, r5p_c: { x: 660, y: 100, label: 'R5P' }, s7p_c: { x: 660, y: 225, label: 'S7P' }, e4p_c: { x: 440, y: 225, label: 'E4P' },
  accoa_c: { x: 400, y: 400, label: 'Acetil-CoA' }, for_c: { x: 330, y: 668, label: 'Formiato' }, for_e: { x: 320, y: 736, label: 'Formiato' },
  actp_c: { x: 560, y: 360, label: 'Acetil-P' }, ac_c: { x: 760, y: 360, label: 'Acetato' }, ac_e: { x: 1002, y: 360, label: 'Acetato' },
  acald_c: { x: 560, y: 300, label: 'Acetaldehído' }, etoh_c: { x: 760, y: 300, label: 'Etanol' }, etoh_e: { x: 1002, y: 300, label: 'Etanol' },
  acald_e: { x: 1002, y: 248, label: 'Acetaldehído' },
  oaa_c: { x: 523, y: 463, label: 'Oxalacetato' }, cit_c: { x: 600, y: 435, label: 'Citrato' }, acon_C_c: { x: 677, y: 463, label: 'cis-Aconitato' },
  icit_c: { x: 718, y: 534, label: 'Isocitrato' }, akg_c: { x: 704, y: 615, label: '2-Oxoglutarato' }, succoa_c: { x: 655, y: 668, label: 'Succinil-CoA' },
  succ_c: { x: 545, y: 668, label: 'Succinato' }, fum_c: { x: 496, y: 615, label: 'Fumarato' }, mal__L_c: { x: 482, y: 534, label: 'Malato' },
  glx_c: { x: 600, y: 555, label: 'Glioxilato' },
  succ_e: { x: 575, y: 736, label: 'Succinato' }, fum_e: { x: 485, y: 736, label: 'Fumarato' }, mal__L_e: { x: 400, y: 736, label: 'L-malato' },
  akg_e: { x: 704, y: 736, label: '2-Oxoglutarato' },
  glu__L_c: { x: 845, y: 615, label: 'Glutamato' }, gln__L_c: { x: 845, y: 535, label: 'Glutamina' },
  glu__L_e: { x: 845, y: 736, label: 'Glutamato' }, gln__L_e: { x: 1002, y: 535, label: 'Glutamina' },
};

/**
 * Flechas del mapa: cada una une un sustrato principal (`from`, coeficiente negativo en la ecuación del archivo) con un
 * producto principal (`to`, coeficiente positivo). Los cofactores no se dibujan. `join`/`split`: cosustrato o
 * coproducto de carbono unido al punto medio. `off`: desplazamiento lateral (px) para reacciones paralelas.
 * `bend`: desplazamiento del punto de control de una curva.
 */
export interface MapEdge { r: string; from: string; to: string; join?: string; split?: string; off?: number; bend?: number }
export const MAP_EDGES: MapEdge[] = [
  { r: 'GLCpts', from: 'glc__D_e', to: 'g6p_c' },
  { r: 'FRUpts2', from: 'fru_e', to: 'f6p_c' },
  { r: 'PGI', from: 'g6p_c', to: 'f6p_c' }, { r: 'PFK', from: 'f6p_c', to: 'fdp_c', off: -7 }, { r: 'FBP', from: 'fdp_c', to: 'f6p_c', off: -7 },
  { r: 'FBA', from: 'fdp_c', to: 'g3p_c', split: 'dhap_c' }, { r: 'TPI', from: 'dhap_c', to: 'g3p_c' },
  { r: 'GAPD', from: 'g3p_c', to: '13dpg_c' }, { r: 'PGK', from: '3pg_c', to: '13dpg_c' }, { r: 'PGM', from: '2pg_c', to: '3pg_c' },
  { r: 'ENO', from: '2pg_c', to: 'pep_c' }, { r: 'PYK', from: 'pep_c', to: 'pyr_c', off: 7 }, { r: 'PPS', from: 'pyr_c', to: 'pep_c', off: 7 },
  { r: 'PYRt2', from: 'pyr_e', to: 'pyr_c' },
  { r: 'LDH_D', from: 'lac__D_c', to: 'pyr_c' }, { r: 'D_LACt2', from: 'lac__D_e', to: 'lac__D_c' },
  { r: 'G6PDH2r', from: 'g6p_c', to: '6pgl_c' }, { r: 'PGL', from: '6pgl_c', to: '6pgc_c' }, { r: 'GND', from: '6pgc_c', to: 'ru5p__D_c' },
  { r: 'RPE', from: 'ru5p__D_c', to: 'xu5p__D_c' }, { r: 'RPI', from: 'r5p_c', to: 'ru5p__D_c' },
  { r: 'TKT1', from: 'r5p_c', to: 's7p_c', join: 'xu5p__D_c' }, { r: 'TALA', from: 's7p_c', to: 'e4p_c' },
  { r: 'TKT2', from: 'e4p_c', to: 'f6p_c', join: 'xu5p__D_c', bend: 0 },
  { r: 'PDH', from: 'pyr_c', to: 'accoa_c', off: -8 }, { r: 'PFL', from: 'pyr_c', to: 'accoa_c', off: 8, split: 'for_c' },
  { r: 'FORti', from: 'for_c', to: 'for_e', off: -7 }, { r: 'FORt2', from: 'for_e', to: 'for_c', off: -7 },
  { r: 'CS', from: 'oaa_c', to: 'cit_c', join: 'accoa_c' }, { r: 'ACONTa', from: 'cit_c', to: 'acon_C_c' }, { r: 'ACONTb', from: 'acon_C_c', to: 'icit_c' },
  { r: 'ICDHyr', from: 'icit_c', to: 'akg_c' }, { r: 'AKGDH', from: 'akg_c', to: 'succoa_c' }, { r: 'SUCOAS', from: 'succ_c', to: 'succoa_c' },
  { r: 'SUCDi', from: 'succ_c', to: 'fum_c', off: 7 }, { r: 'FRD7', from: 'fum_c', to: 'succ_c', off: 7 },
  { r: 'FUM', from: 'fum_c', to: 'mal__L_c' }, { r: 'MDH', from: 'mal__L_c', to: 'oaa_c' },
  { r: 'ICL', from: 'icit_c', to: 'glx_c', split: 'succ_c' }, { r: 'MALS', from: 'glx_c', to: 'mal__L_c', join: 'accoa_c' },
  { r: 'PPC', from: 'pep_c', to: 'oaa_c', off: -7 }, { r: 'PPCK', from: 'oaa_c', to: 'pep_c', off: -7 },
  { r: 'ME1', from: 'mal__L_c', to: 'pyr_c', off: -7 }, { r: 'ME2', from: 'mal__L_c', to: 'pyr_c', off: 7 },
  { r: 'PTAr', from: 'accoa_c', to: 'actp_c' }, { r: 'ACKr', from: 'ac_c', to: 'actp_c' }, { r: 'ACt2r', from: 'ac_e', to: 'ac_c' },
  { r: 'ACALD', from: 'acald_c', to: 'accoa_c' }, { r: 'ALCD2x', from: 'etoh_c', to: 'acald_c' }, { r: 'ETOHt2r', from: 'etoh_e', to: 'etoh_c' },
  { r: 'ACALDt', from: 'acald_e', to: 'acald_c' },
  { r: 'SUCCt2_2', from: 'succ_e', to: 'succ_c', off: -7 }, { r: 'SUCCt3', from: 'succ_c', to: 'succ_e', off: -7 },
  { r: 'FUMt2_2', from: 'fum_e', to: 'fum_c' }, { r: 'MALt2_2', from: 'mal__L_e', to: 'mal__L_c' },
  { r: 'AKGt2r', from: 'akg_e', to: 'akg_c' },
  { r: 'GLUDy', from: 'glu__L_c', to: 'akg_c', off: -7 }, { r: 'GLNS', from: 'glu__L_c', to: 'gln__L_c', off: -7 }, { r: 'GLUN', from: 'gln__L_c', to: 'glu__L_c', off: -7 },
  { r: 'GLUSy', from: 'akg_c', to: 'glu__L_c', off: -7, join: 'gln__L_c' },
  { r: 'GLUt2r', from: 'glu__L_e', to: 'glu__L_c' }, { r: 'GLNabc', from: 'gln__L_e', to: 'gln__L_c' },
];

/** Reacciones sin flecha propia en el mapa: se muestran como barras en el panel de energía. */
export const MAP_ENERGY = ['NADH16', 'CYTBD', 'ATPS4r', 'THD2', 'ATPM'] as const;

/* ------------------------------------------------------------------ ficha del modelo */

export const metabolismModelSpec: ModelSpec = {
  name: 'Análisis de balance de flujos (FBA) del modelo E. coli core (e_coli_core, archivo textbook.xml.gz de COBRApy 0.32.1)',
  inputs: [
    { symbol: 'fuente C', name: 'Fuente de carbono disponible (intercambios del modelo)', unit: '—', initial: 'glucosa' },
    { symbol: 'q_C', name: 'Captación máxima de la fuente de carbono', unit: 'mmol/gDW/h', range: FBA_LIMITS.uptake, initial: 10 },
    { symbol: 'q_O₂', name: 'Captación máxima de oxígeno (1000 = sin límite práctico)', unit: 'mmol/gDW/h', range: FBA_LIMITS.oxygen, initial: UNLIMITED },
    { symbol: 'Δgen', name: 'Genes eliminados (se apagan las reacciones cuya regla GPR queda falsa)', unit: '—', initial: 'ninguno' },
    { symbol: 'Δreacción', name: 'Reacciones eliminadas (límites 0, 0)', unit: '—', initial: 'ninguna' },
  ],
  outputs: [
    { symbol: 'μ', name: 'Crecimiento óptimo estimado (flujo de la reacción de biomasa)', unit: 'h⁻¹' },
    { symbol: 'v', name: 'Flujos de las 95 reacciones en la solución devuelta', unit: 'mmol/gDW/h' },
    { symbol: '[v_min, v_max]', name: 'Intervalo de cada flujo compatible con el óptimo (FVA)', unit: 'mmol/gDW/h' },
    { symbol: 'μ/μ_ref', name: 'Crecimiento relativo a la condición de referencia', unit: '%' },
  ],
  equations: [
    'maximizar μ = v_biomasa   sujeto a   S·v = 0   y   lb_j ≤ v_j ≤ ub_j (j = 1…95).',
    'S: matriz estequiométrica de 72 metabolitos × 95 reacciones del archivo; v en mmol/gDW/h; la biomasa en h⁻¹.',
    'Fuente de carbono: lb(EX_C) = −q_C; las demás fuentes de carbono: lb = 0. Oxígeno: lb(EX_o2_e) = −q_O₂. Mantenimiento: v_ATPM ≥ 8,39.',
    'Eliminación de un gen g: toda reacción cuya regla GPR es falsa sin g queda con lb = ub = 0 («and» = complejo; «or» = isoenzimas).',
    'FVA: para cada reacción, mín y máx de v_j con v_biomasa ≥ f·μ_óptimo (f = 1 o 0,99).',
    'Gen esencial: μ(sin el gen) < 0,01·μ_ref o problema no factible (umbral por defecto de COBRApy).',
  ],
  initialConditions: ['Glucosa con captación máxima 10 mmol/gDW/h, oxígeno sin límite (1000), sin eliminaciones: μ = 0,8739 h⁻¹ (COBRApy: 0,873921506968).'],
  assumptions: [
    'Estado estacionario: ningún metabolito interno se acumula ni se agota (S·v = 0).',
    'La célula se comporta como si maximizara su crecimiento con los recursos disponibles (hipótesis de optimalidad).',
    'Los límites de los flujos y la composición de la biomasa son los del archivo; el mantenimiento exige 8,39 mmol ATP/gDW/h.',
    'El símplex devuelve UNA solución óptima: cuando hay óptimos alternativos, otros vectores de flujo dan el mismo crecimiento (el FVA muestra el intervalo).',
  ],
  limits: [
    'FBA es un modelo de restricciones: no representa regulación génica, cinética enzimática, concentraciones ni el espacio dentro de la célula.',
    'Predice un óptimo posible, no lo que la célula necesariamente hace; no es una medición.',
    'El modelo core solo tiene el metabolismo central (95 reacciones): no incluye la síntesis detallada de aminoácidos, lípidos ni nucleótidos.',
    'Un gen cuya eliminación no cambia el crecimiento predicho puede ser importante en la célula real (regulación, condiciones distintas, funciones fuera del modelo).',
    'No se impide que aparezcan ciclos sin sentido termodinámico (p. ej. SUCDi + FRD7); el FVA lo muestra como un intervalo enorme.',
  ],
  testCases: [
    'Glucosa aerobia: μ = 0,873921506968 h⁻¹ y anaerobia: μ = 0,211662949735 h⁻¹, iguales a COBRApy 0.32.1 + GLPK con error relativo < 1e-6.',
    'Las 14 fuentes de carbono en aerobiosis y anaerobiosis, la serie de O₂ de 0 a 30 y la de glucosa de 0 a 20: mismo crecimiento (o la misma infactibilidad) que COBRApy.',
    'Eliminación de cada uno de los 137 genes (aerobio y anaerobio) y de cada una de las 95 reacciones: mismo crecimiento que COBRApy; mismos genes esenciales.',
    'FVA al 100 % y al 99 % del óptimo de todas las reacciones: mismos intervalos que COBRApy.',
    'Balance de masa |S·v| < 1e-9 y límites respetados en toda solución; casos de prueba del símplex: infactible, no acotado, degenerado, variables libres.',
  ],
};

/* ------------------------------------------------------------------ condiciones y correcciones */

/** Avisos del resultado del FBA con su nivel y su corrección. */
export function metabolismConditions(s: { infeasible: boolean; alternativeOptima: boolean; carbon: CarbonId; knockouts: number }): ModelCondition[] {
  const out: ModelCondition[] = [];
  if (s.infeasible) {
    out.push({
      text: 'El problema no es factible: con estas restricciones no existe ningún vector de flujos que cumpla el balance de masa, los límites y el mantenimiento mínimo (ATPM ≥ 8,39 mmol/gDW/h). El modelo predice que no hay crecimiento.',
      level: 'invalido',
      fix: `Afloja las restricciones: sube la «Captación máxima de la fuente de carbono» o el oxígeno disponible${s.carbon === 'for' ? ', elige otra «Fuente de carbono»' : ''}${s.knockouts > 0 ? ' o quita eliminaciones (botones ✕)' : ''}, y vuelve a pulsar «Calcular el óptimo».`,
    });
  }
  if (s.alternativeOptima) {
    out.push({
      text: 'Hay óptimos alternativos: algunos flujos de intercambio pueden tomar distintos valores con el mismo crecimiento máximo. La tabla muestra el intervalo (FVA); el valor puntual es solo una de las soluciones.',
      level: 'nota',
      fix: 'No hace falta corregirlo: compara los intervalos mínimo–máximo de la tabla, no solo el valor puntual.',
    });
  }
  if (s.carbon === 'for') {
    out.push({
      text: 'El formiato no aporta carbono para la biomasa en este modelo: espera un problema no factible.',
      level: 'advertencia',
      fix: `En «Fuente de carbono», elige una que sí aporte carbono, por ejemplo ${CARBON_SOURCES[0].label.toLowerCase()}.`,
    });
  }
  return out;
}

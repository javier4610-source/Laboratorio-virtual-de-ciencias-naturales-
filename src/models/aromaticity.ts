/**
 * Modelo de la práctica «Hidrocarburos aromáticos» (reutilizable; ver docs/organica/README.md).
 *
 * - Conteo de electrones π de un anillo y regla de Hückel (4n + 2) con tres condiciones: cíclico, conjugado (todos los átomos del
 *   anillo con orbital p disponible) y plano (desviación del plano medida sobre el confórmero de PubChem).
 * - Método de Hückel de orbitales moleculares (HMO): energías E = α + xβ de los orbitales π, donde x son los valores propios de la
 *   matriz de adyacencia del sistema π (diagonalización de Jacobi). Supuestos del método: solo electrones π, β igual para todos los
 *   enlaces y heteroátomos tratados como carbono (aproximación declarada). Es un modelo calculado clásico (Hückel, 1931).
 * - Nomenclatura orto/meta/para de los bencenos disustituidos.
 */
import { bondBetween, implicitH, neighbors, ringInfo, type OMolecule } from './organicGraph';
import type { ModelSpec } from './types';

/* ------------------------------------------------------------------ álgebra */

/** Valores propios de una matriz simétrica (método de Jacobi), en orden descendente. */
export function symmetricEigenvalues(A: number[][]): number[] {
  const n = A.length;
  const a = A.map((r) => [...r]);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
    }
  }
  return a.map((r, i) => r[i]).sort((x, y) => y - x);
}

/** Desviación de un conjunto de puntos respecto de su plano medio (RMS y máxima, Å): menor valor propio de la covarianza. */
export function planarity(pts: { x: number; y: number; z: number }[]): { rms: number; max: number } {
  const n = pts.length;
  const c = pts.reduce((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n, z: s.z + p.z / n }), { x: 0, y: 0, z: 0 });
  const d = pts.map((p) => [p.x - c.x, p.y - c.y, p.z - c.z]);
  const C = [0, 1, 2].map((i) => [0, 1, 2].map((j) => d.reduce((s, v) => s + v[i] * v[j], 0) / n));
  const ev = symmetricEigenvalues(C);
  const lmin = Math.max(0, ev[2]);
  // normal = vector propio del menor valor propio: se obtiene resolviendo (C − λI)v = 0 con productos cruz de filas
  const M = C.map((r, i) => r.map((v, j) => v - (i === j ? lmin : 0)));
  const cross = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const cands = [cross(M[0], M[1]), cross(M[0], M[2]), cross(M[1], M[2])];
  const nrm = cands.sort((u, v) => Math.hypot(...v) - Math.hypot(...u))[0];
  const L = Math.hypot(...nrm) || 1;
  const dev = d.map((v) => Math.abs((v[0] * nrm[0] + v[1] * nrm[1] + v[2] * nrm[2]) / L));
  return { rms: Math.sqrt(lmin), max: Math.max(...dev) };
}

/* ------------------------------------------------------------------ electrones π y Hückel */

export interface PiAtom { atom: number; el: string; electrons: number; reason: string }

/** Aporte de electrones π de cada átomo de un anillo; null en un átomo que rompe la conjugación (sp³ sin par ni carga). */
export function piContributions(m: OMolecule, ring: number[]): (PiAtom | { atom: number; el: string; electrons: null; reason: string })[] {
  return ring.map((i) => {
    const a = m.atoms[i];
    const q = a.charge ?? 0;
    const ringNb = ring.filter((j) => j !== i && bondBetween(m, i, j));
    const inRingDouble = ringNb.some((j) => bondBetween(m, i, j)!.order === 2);
    const anyDouble = neighbors(m, i).some((j) => bondBetween(m, i, j)!.order === 2);
    if (inRingDouble) return { atom: i, el: a.el, electrons: 1, reason: 'un electrón en el orbital p del enlace doble del anillo' };
    if (a.el === 'C') {
      if (q < 0) return { atom: i, el: a.el, electrons: 2, reason: 'carbanión: el par libre ocupa el orbital p' };
      if (q > 0) return { atom: i, el: a.el, electrons: 0, reason: 'carbocatión: orbital p vacío' };
      if (anyDouble) return { atom: i, el: a.el, electrons: 0, reason: 'doble enlace fuera del anillo' };
      return { atom: i, el: a.el, electrons: null, reason: `carbono sp³ (${implicitH(m, i)} H): no tiene orbital p y rompe la conjugación` };
    }
    if (a.el === 'N' || a.el === 'O' || a.el === 'S') return { atom: i, el: a.el, electrons: 2, reason: `par libre del ${a.el} en el orbital p` };
    return { atom: i, el: a.el, electrons: null, reason: 'átomo sin orbital p disponible' };
  });
}

export type Verdict = 'aromático' | 'antiaromático' | 'no aromático';

export interface HuckelAnalysis {
  ring: number[];
  contributions: ReturnType<typeof piContributions>;
  conjugated: boolean;
  piElectrons: number | null;
  /** n tal que π = 4n + 2 (o 4n si antiaromático). */
  n: number | null;
  rule: '4n+2' | '4n' | null;
  planar: boolean | null;
  planarity?: { rms: number; max: number };
  verdict: Verdict;
  /** Veredicto solo con el conteo electrónico (sin exigir la planaridad medida): sirve para discutir los límites del confórmero. */
  electronic: Verdict;
  reason: string;
  /** Energías HMO en unidades de β (x en E = α + xβ; β < 0, así que x > 0 es enlazante), con ocupación. */
  levels: { x: number; electrons: number }[] | null;
}

export const PLANAR_TOLERANCE = 0.1; // Å de desviación máxima respecto del plano medio

/** Orbitales π de Hückel de los átomos dados (energías x, descendentes) llenados con `electrons` (Aufbau y Hund). */
export function huckelLevels(m: OMolecule, piAtoms: number[], electrons: number): { x: number; electrons: number }[] {
  const idx = new Map(piAtoms.map((a, k) => [a, k]));
  const A = piAtoms.map(() => piAtoms.map(() => 0));
  for (const b of m.bonds) {
    const i = idx.get(b.a), j = idx.get(b.b);
    if (i === undefined || j === undefined) continue;
    A[i][j] = A[j][i] = 1;
  }
  const xs = symmetricEigenvalues(A).map((x) => Math.round(x * 1e6) / 1e6);
  const levels = xs.map((x) => ({ x, electrons: 0 }));
  let left = electrons;
  // agrupar degenerados y llenar con regla de Hund
  for (let k = 0; k < levels.length && left > 0;) {
    let e = k; while (e + 1 < levels.length && Math.abs(levels[e + 1].x - levels[k].x) < 1e-4) e++;
    const g = e - k + 1;
    const take = Math.min(left, 2 * g);
    for (let r = 0; r < take; r++) levels[k + (r % g)].electrons++;
    left -= take; k = e + 1;
  }
  return levels;
}

/** Análisis de Hückel del anillo (o del perímetro de un sistema fusionado) con coordenadas 3D opcionales para la planaridad. */
export function huckelAnalysis(m: OMolecule, xyz?: { x: number; y: number; z: number }[], ringOverride?: number[]): HuckelAnalysis {
  const { rings } = ringInfo(m);
  let ring = ringOverride ?? rings[0];
  const fused = rings.length > 1;
  if (!ring) throw new RangeError('La molécula no tiene anillos.');
  if (fused && !ringOverride) {
    // perímetro de un sistema fusionado: todos los átomos de anillo (para naftaleno, los 10 C)
    ring = [...new Set(rings.flat())];
  }
  const contributions = piContributions(m, ring);
  const conjugated = contributions.every((c) => c.electrons !== null);
  const pi = conjugated ? contributions.reduce((s, c) => s + (c.electrons ?? 0), 0) : null;
  const pl = xyz ? planarity(ring.map((i) => xyz[i])) : undefined;
  const planar = pl ? pl.max <= PLANAR_TOLERANCE : null;
  let rule: HuckelAnalysis['rule'] = null, n: number | null = null;
  if (pi !== null) {
    if ((pi - 2) % 4 === 0 && pi >= 2) { rule = '4n+2'; n = (pi - 2) / 4; } else if (pi % 4 === 0 && pi > 0) { rule = '4n'; n = pi / 4; }
  }
  let verdict: Verdict = 'no aromático', reason: string;
  if (!conjugated) reason = 'El anillo no está totalmente conjugado: al menos un átomo no tiene orbital p (rompe el ciclo de orbitales p).';
  else if (planar === false) reason = `El anillo no es plano (se aleja hasta ${pl!.max.toFixed(2).replace('.', ',')} Å de su plano medio): los orbitales p no se solapan en todo el ciclo.`;
  else if (rule === '4n+2') { verdict = 'aromático'; reason = `Cíclico, conjugado${planar ? ' y plano' : ''}, con ${pi} electrones π = 4·${n} + 2: cumple la regla de Hückel.`; }
  else if (rule === '4n') { verdict = 'antiaromático'; reason = `Cíclico, conjugado${planar ? ' y plano' : ''}, con ${pi} electrones π = 4·${n}: es antiaromático (inestable).`; }
  else reason = `${pi} electrones π no cumplen 4n + 2.`;
  const electronic: Verdict = !conjugated ? 'no aromático' : rule === '4n+2' ? 'aromático' : rule === '4n' ? 'antiaromático' : 'no aromático';
  if (fused && !ringOverride) reason += ' (Para sistemas fusionados la regla de Hückel es una aproximación: se aplica al perímetro.)';
  const piAtoms = ring.filter((i) => contributions.find((c) => c.atom === i)?.electrons !== null);
  const levels = conjugated && pi !== null ? huckelLevels(m, piAtoms, pi) : null;
  return { ring, contributions, conjugated, piElectrons: pi, n, rule, planar, planarity: pl, verdict, electronic, reason, levels };
}

/** Energía π total (en unidades de β) y energía de deslocalización respecto de enlaces π aislados (eteno: x = 1). */
export function piEnergy(levels: { x: number; electrons: number }[]): number {
  return levels.reduce((s, l) => s + l.x * l.electrons, 0);
}
export function delocalizationEnergy(levels: { x: number; electrons: number }[], piElectrons: number): number {
  return piEnergy(levels) - piElectrons; // cada par en un enlace π aislado aporta 2β (x = 1 por electrón)
}

/* ------------------------------------------------------------------ orto, meta, para */

export function orthoMetaPara(loc1: number, loc2: number): 'orto' | 'meta' | 'para' | null {
  const d = Math.abs(loc1 - loc2) % 6;
  const e = Math.min(d, 6 - d);
  return e === 1 ? 'orto' : e === 2 ? 'meta' : e === 3 ? 'para' : null;
}

export const aromaticsModelSpec: ModelSpec = {
  name: 'Aromaticidad: regla de Hückel, orbitales π de Hückel (HMO), longitudes de enlace en confórmeros de PubChem y sustitución electrofílica',
  inputs: [
    { symbol: 'anillo', name: 'Molécula cíclica (benceno, ciclobutadieno, ciclooctatetraeno, iones C₅H₅⁻ y C₇H₇⁺, heterociclos…)', unit: '—', initial: 'benceno' },
    { symbol: 'sustituyentes', name: 'Dos sustituyentes del benceno y sus posiciones', unit: '—' },
    { symbol: 'reacción', name: 'Sustitución electrofílica (bromación, cloración, nitración)', unit: '—' },
  ],
  outputs: [
    { symbol: 'Nπ', name: 'Electrones π del anillo', unit: '—' },
    { symbol: 'x', name: 'Energías de los orbitales π (E = α + xβ)', unit: 'β' },
    { symbol: 'desv', name: 'Desviación máxima del plano medio del anillo', unit: 'Å' },
    { symbol: 'd(C–C)', name: 'Longitudes C–C medidas sobre los confórmeros', unit: 'Å' },
  ],
  equations: [
    'Aromático si es cíclico, conjugado, plano y Nπ = 4n + 2 (n = 0, 1, 2…); antiaromático si Nπ = 4n con las demás condiciones',
    'Hückel: det(A − xI) = 0 con A = matriz de adyacencia de los átomos π; E = α + xβ (β < 0: x > 0 enlazante)',
    'Benceno: x = 2, 1, 1, −1, −1, −2; energía π = 8β; deslocalización = 8β − 6β = 2β',
    'Planaridad: desviación respecto del plano de mínimos cuadrados (menor valor propio de la covarianza de las posiciones)',
  ],
  initialConditions: ['Benceno (confórmero 3D de PubChem, CID 241).'],
  assumptions: [
    'Hückel: solo electrones π; la misma β para todos los enlaces; los heteroátomos (N, O) se tratan como carbono para las energías (aproximación).',
    'Las coordenadas son confórmeros de PubChem (MMFF94s): predicción computacional. Tolerancia de planaridad: 0,1 Å.',
    'La sustitución electrofílica en 3D es una interpolación entre reactivos y productos (ilustración), no el mecanismo.',
  ],
  limits: [
    'La regla 4n + 2 es estricta para monociclos; para sistemas fusionados (naftaleno) es una aproximación.',
    'El ciclobutadieno real es una especie muy reactiva que solo se observa a muy baja temperatura; su confórmero es un cálculo.',
    'Los efectos orientadores de los sustituyentes (orto/para o meta) se describen cualitativamente; no se calculan.',
  ],
  testCases: [
    'HMO del benceno: 2, 1, 1, −1, −1, −2 (β); ciclobutadieno: 2, 0, 0, −2; naftaleno: orbital ocupado más alto x = 0,618.',
    'Benceno: 6 e⁻ π, aromático; ciclobutadieno: 4, antiaromático; ciclooctatetraeno: 8, no plano → no aromático; C₅H₅⁻ y C₇H₇⁺: 6, aromáticos; ciclopentadieno: CH₂ sp³ → no aromático.',
    'Longitudes C–C del benceno iguales entre sí (± 0,01 Å) y entre las de C–C y C=C del ciclohexeno.',
    'orto/meta/para: (1,2) orto, (1,3) meta, (1,4) para.',
  ],
};

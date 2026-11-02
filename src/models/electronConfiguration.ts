import { periodicElement } from './periodicTrends';
import { seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Configuración electrónica (grado 10.º): principio de construcción (Aufbau) con la regla de Madelung (n + ℓ, luego n),
 * principio de exclusión de Pauli, regla de Hund y comparación con el estado fundamental MEDIDO (configuraciones de la
 * tabla periódica de PubChem, src/data/quimica/tabla-periodica-pubchem.json, consulta 2026-11-01; son los mismos estados
 * fundamentales que publica el NIST a partir de la espectroscopía atómica).
 *
 * Formas de los orbitales: funciones del átomo de hidrógeno (un electrón, Z = 1) en unidades del radio de Bohr a₀:
 *   ψ ∝ R_nℓ(r)·Y(θ, φ),  R_nℓ ∝ ρ^ℓ·e^(−ρ/2)·L^(2ℓ+1)_(n−ℓ−1)(ρ), ρ = 2r/n   (Laguerre generalizado)
 * con los armónicos esféricos REALES (pₓ, p_y, p_z; d_xy, d_yz, d_z², d_xz, d_x²−y²). Se muestrean puntos con densidad
 * |ψ|² (nube de probabilidad). En un átomo con varios electrones los orbitales se parecen a estos en FORMA y orientación,
 * pero no en tamaño ni en energía: la vista 3D es una ilustración cualitativa calculada con el modelo del hidrógeno.
 *
 * Este archivo no depende de React ni del navegador.
 */

export const MAX_Z = 54; // hasta el xenón: subniveles 1s a 5p
const L_LETTER = 'spdf';
export interface Subshell { n: number; l: number; key: string; cap: number }
/** Subniveles hasta Z = 54 en el orden de Madelung (n + ℓ creciente; a igual n + ℓ, primero el de menor n). */
export const ORDER: Subshell[] = (() => {
  const out: Subshell[] = [];
  for (let n = 1; n <= 5; n++) for (let l = 0; l < Math.min(n, 3); l++) out.push({ n, l, key: `${n}${L_LETTER[l]}`, cap: 2 * (2 * l + 1) });
  return out.sort((a, b) => a.n + a.l - (b.n + b.l) || a.n - b.n).filter((s) => s.n + s.l <= 6);
})();
export const subshell = (key: string): Subshell => {
  const s = ORDER.find((x) => x.key === key);
  if (!s) throw new RangeError(`Subnivel desconocido: ${key}`);
  return s;
};

/** Nombre del orbital real que corresponde a cada mℓ (convención de los manuales: m < 0 → combinación con seno). */
const REAL_NAME: Record<number, Record<number, string>> = {
  0: { 0: 's' },
  1: { [-1]: 'py', 0: 'pz', 1: 'px' },
  2: { [-2]: 'dxy', [-1]: 'dyz', 0: 'dz²', 1: 'dxz', 2: 'dx²−y²' },
};
export interface OrbitalBox { id: string; sub: string; n: number; l: number; ml: number; real: string }
export function boxesOf(s: Subshell): OrbitalBox[] {
  return Array.from({ length: 2 * s.l + 1 }, (_, k) => ({ id: `${s.key}${k}`, sub: s.key, n: s.n, l: s.l, ml: k - s.l, real: REAL_NAME[s.l][k - s.l] }));
}
export const ALL_BOXES: OrbitalBox[] = ORDER.flatMap(boxesOf);
export const boxById = (id: string) => {
  const b = ALL_BOXES.find((x) => x.id === id);
  if (!b) throw new RangeError(`Orbital desconocido: ${id}`);
  return b;
};

/** Espín de un electrón: +½ (↑) o −½ (↓). */
export type Spin = 1 | -1;
/** Diagrama de cajas: para cada orbital, los espines de sus electrones (0, 1 o 2; con 2 iguales viola Pauli). */
export type Boxes = Record<string, Spin[]>;

export type Occupancy = Record<string, number>;

/* ------------------------------------------------------------------ Aufbau, Hund y Pauli */

/** Orden en que el principio de construcción coloca los electrones: subnivel por subnivel (Madelung), primero uno ↑ en
 * cada orbital del subnivel (Hund) y después los ↓ (Pauli). */
export function fillingSequence(z: number): { box: string; spin: Spin }[] {
  if (!Number.isInteger(z) || z < 1 || z > MAX_Z) throw new RangeError(`Z debe ser un entero entre 1 y ${MAX_Z}.`);
  const out: { box: string; spin: Spin }[] = [];
  for (const s of ORDER) {
    const bx = boxesOf(s);
    for (const spin of [1, -1] as Spin[]) for (const b of bx) if (out.length < z) out.push({ box: b.id, spin });
    if (out.length >= z) break;
  }
  return out;
}
export function boxesFromSequence(seq: { box: string; spin: Spin }[], k = seq.length): Boxes {
  const b: Boxes = {};
  for (const step of seq.slice(0, k)) (b[step.box] ??= []).push(step.spin);
  return b;
}
/** Diagrama de cajas de una ocupación por subniveles, repartido según la regla de Hund. */
export function hundBoxes(occ: Occupancy): Boxes {
  const b: Boxes = {};
  for (const s of ORDER) {
    const e = occ[s.key] ?? 0;
    if (!e) continue;
    const bx = boxesOf(s);
    for (let i = 0; i < e; i++) (b[bx[i % bx.length].id] ??= []).push(i < bx.length ? 1 : -1);
  }
  return b;
}
export function occupancyOf(boxes: Boxes): Occupancy {
  const occ: Occupancy = {};
  for (const [id, spins] of Object.entries(boxes)) if (spins.length) { const s = boxById(id).sub; occ[s] = (occ[s] ?? 0) + spins.length; }
  return occ;
}
export const electronCount = (occ: Occupancy) => Object.values(occ).reduce((a, b) => a + b, 0);
export function aufbauOccupancy(z: number): Occupancy { return occupancyOf(boxesFromSequence(fillingSequence(z))); }

const NOBLE_CORES: { sym: string; z: number; occ: Occupancy }[] = [
  { sym: 'He', z: 2, occ: { '1s': 2 } },
  { sym: 'Ne', z: 10, occ: { '1s': 2, '2s': 2, '2p': 6 } },
  { sym: 'Ar', z: 18, occ: { '1s': 2, '2s': 2, '2p': 6, '3s': 2, '3p': 6 } },
  { sym: 'Kr', z: 36, occ: { '1s': 2, '2s': 2, '2p': 6, '3s': 2, '3p': 6, '4s': 2, '3d': 10, '4p': 6 } },
];

/** Lee una configuración como la escribe PubChem: «[Ar]4s1 3d5», «[He] 2s2 2p3», «1s2». */
export function parseConfiguration(text: string): Occupancy {
  const occ: Occupancy = {};
  const core = /^\[(He|Ne|Ar|Kr|Xe)\]/.exec(text.trim());
  if (core) Object.assign(occ, NOBLE_CORES.find((c) => c.sym === core[1])!.occ);
  for (const m of text.replace(/^\[[A-Za-z]+\]/, '').matchAll(/(\d)([spdf])(\d+)/g)) occ[`${m[1]}${m[2]}`] = Number(m[3]);
  return occ;
}
/** Estado fundamental medido (tabla periódica de PubChem). */
export function groundState(z: number): Occupancy {
  if (z < 1 || z > MAX_Z) throw new RangeError(`Z debe estar entre 1 y ${MAX_Z}.`);
  return parseConfiguration(periodicElement(z).configuracion);
}
export const sameOccupancy = (a: Occupancy, b: Occupancy) => ORDER.every((s) => (a[s.key] ?? 0) === (b[s.key] ?? 0));
/** ¿El estado fundamental medido es distinto del que predice el principio de construcción? */
export const isException = (z: number) => !sameOccupancy(groundState(z), aufbauOccupancy(z));
export const EXCEPTIONS_UP_TO_XE = Array.from({ length: MAX_Z }, (_, i) => i + 1).filter(isException).map((z) => periodicElement(z).sym);

/* ------------------------------------------------------------------ notación */

const SUP = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
/** Configuración en el orden de llenado (Madelung): «1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶». */
export function configString(occ: Occupancy, skip: Occupancy = {}): string {
  return ORDER.filter((s) => (occ[s.key] ?? 0) > 0 && !(skip[s.key])).map((s) => `${s.key}${SUP(occ[s.key])}`).join(' ');
}
/** Notación abreviada con el gas noble anterior: «[Ar] 4s¹ 3d⁵». */
export function nobleGasString(occ: Occupancy): string {
  const core = [...NOBLE_CORES].reverse().find((c) => electronCount(occ) > c.z && Object.entries(c.occ).every(([k, e]) => (occ[k] ?? 0) === e));
  if (!core) return configString(occ);
  return `[${core.sym}] ${configString(occ, core.occ)}`;
}

/* ------------------------------------------------------------------ análisis del diagrama del estudiante */

export interface BoxAnalysis {
  z: number; electrons: number; charge: number;
  occupancy: Occupancy;
  /** Orbitales con dos electrones del mismo espín (o más de dos). */
  pauli: string[];
  /** Subniveles que no siguen la regla de Hund (un orbital lleno con otro vacío, o electrones solos con espines opuestos). */
  hund: string[];
  /** Subniveles ocupados antes de llenar uno de menor energía (estado excitado). */
  aufbau: { filled: string; before: string }[];
  unpaired: number;
  /** La ocupación coincide con el estado fundamental medido y el diagrama respeta Pauli y Hund. */
  matchesGround: boolean;
  /** Coincide con el estado fundamental medido, que es una excepción del principio de construcción (Cr, Cu…). */
  matchesException: boolean;
}
export function analyzeBoxes(boxes: Boxes, z: number): BoxAnalysis {
  const occupancy = occupancyOf(boxes);
  const electrons = electronCount(occupancy);
  const pauli = Object.entries(boxes).filter(([, s]) => s.length > 2 || (s.length === 2 && s[0] === s[1])).map(([id]) => id);
  const hund: string[] = [];
  let unpaired = 0;
  for (const s of ORDER) {
    const bx = boxesOf(s).map((b) => boxes[b.id] ?? []);
    const singles = bx.filter((x) => x.length === 1);
    unpaired += singles.length;
    const hasEmpty = bx.some((x) => x.length === 0), hasPair = bx.some((x) => x.length >= 2);
    const mixed = singles.length > 1 && new Set(singles.map((x) => x[0])).size > 1;
    if ((hasEmpty && hasPair) || mixed) hund.push(s.key);
  }
  const aufbau: { filled: string; before: string }[] = [];
  ORDER.forEach((s, i) => {
    if (!(occupancy[s.key] ?? 0)) return;
    const lower = ORDER.slice(0, i).find((p) => (occupancy[p.key] ?? 0) < p.cap);
    if (lower) aufbau.push({ filled: s.key, before: lower.key });
  });
  const gs = groundState(z);
  const matchesGround = electrons === z && pauli.length === 0 && hund.length === 0 && sameOccupancy(occupancy, gs);
  return { z, electrons, charge: z - electrons, occupancy, pauli, hund, aufbau, unpaired, matchesGround, matchesException: matchesGround && isException(z) };
}

export interface ConfigCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function configurationConditions(a: BoxAnalysis): ConfigCondition[] {
  const out: ConfigCondition[] = [];
  const sym = periodicElement(a.z).sym;
  for (const id of a.pauli) {
    const b = boxById(id);
    out.push({ level: 'invalido', text: `El orbital ${b.sub} (mℓ = ${b.ml > 0 ? '+' : ''}${b.ml}) tiene dos electrones con el mismo espín: viola el principio de exclusión de Pauli (dos electrones de un átomo no pueden tener los cuatro números cuánticos iguales).`,
      fix: `Quita uno de los electrones de ese orbital, o cámbialo por uno de espín opuesto (↑↓).` });
  }
  for (const k of a.hund) out.push({ level: 'advertencia', text: `En el subnivel ${k} hay electrones apareados mientras otro orbital del mismo subnivel está vacío, o electrones solos con espines opuestos: no sigue la regla de Hund.`,
    fix: `Pon primero un electrón ↑ en cada orbital ${k} y solo después aparea con ↓.` });
  for (const x of a.aufbau.slice(0, 2)) {
    if (a.matchesException) break;
    out.push({ level: 'advertencia', text: `Hay electrones en ${x.filled} aunque ${x.before} (de menor energía según n + ℓ) no está lleno: sería un estado excitado, no el fundamental.`,
      fix: `Completa primero ${x.before}. Excepción comprobada con datos: en el Cr, el Cu, el Mo y la Ag (entre otros) el estado fundamental medido sí deja el ns con un electrón.` });
  }
  if (a.electrons !== a.z) {
    const ion = a.charge > 0 ? `catión ${sym}${a.charge > 1 ? SUP(a.charge) : ''}⁺` : `anión ${sym}${-a.charge > 1 ? SUP(-a.charge) : ''}⁻`;
    out.push({ level: a.electrons === 0 ? 'nota' : 'advertencia', text: a.electrons === 0 ? `El diagrama está vacío: el ${sym} neutro tiene ${a.z} electrones.` : `Hay ${a.electrons} electrones y el ${sym} neutro tiene ${a.z}: así sería el ${ion}.`,
      fix: a.electrons < a.z ? `Agrega ${a.z - a.electrons} electrón${a.z - a.electrons > 1 ? 'es' : ''} más (o usa «Siguiente electrón»).` : `Quita ${a.electrons - a.z} electrón${a.electrons - a.z > 1 ? 'es' : ''}.` });
  }
  return out;
}

/* ------------------------------------------------------------------ relación con la tabla periódica */

export interface TablePlace {
  period: number; group: number | null; block: 's' | 'p' | 'd';
  /** Electrones de valencia (grupos principales: ns + np) o electrones externos ns + (n − 1)d (transición). */
  valence: number; valenceText: string;
  /** Período y grupo reales de la tabla (IUPAC), para comparar. */
  tablePeriod: number; tableGroup: number | null;
}
/** Período, grupo y bloque DEDUCIDOS de la configuración del principio de construcción (como se enseña). */
export function tablePlace(z: number): TablePlace {
  const occ = aufbauOccupancy(z);
  const last = [...ORDER].reverse().find((s) => (occ[s.key] ?? 0) > 0)!;
  const nMax = Math.max(...ORDER.filter((s) => (occ[s.key] ?? 0) > 0).map((s) => s.n));
  const ns = occ[`${nMax}s`] ?? 0, np = occ[`${nMax}p`] ?? 0, nd = occ[`${nMax - 1}d`] ?? 0;
  const el = periodicElement(z);
  const block = (z === 2 ? 's' : L_LETTER[last.l]) as 's' | 'p' | 'd';
  let group: number;
  if (z === 2) group = 18;
  else if (block === 's') group = ns;
  else if (block === 'p') group = 10 + ns + np;
  else group = ns + nd;
  const valence = block === 'd' ? ns + nd : ns + np;
  const valenceText = block === 'd' ? `${valence} (${nMax}s + ${nMax - 1}d)` : `${valence} (${nMax}s${np ? ` + ${nMax}p` : ''})`;
  return { period: nMax, group, block, valence, valenceText, tablePeriod: el.period, tableGroup: el.group };
}

/** Números cuánticos (n, ℓ, mℓ, mₛ) del último electrón del principio de construcción. */
export function lastElectron(z: number): { n: number; l: number; ml: number; ms: number; box: string } {
  const seq = fillingSequence(z);
  const s = seq[seq.length - 1];
  const b = boxById(s.box);
  return { n: b.n, l: b.l, ml: b.ml, ms: s.spin / 2, box: b.id };
}

/* ------------------------------------------------------------------ orbitales del hidrógeno (forma) */

/** Polinomio de Laguerre generalizado L^a_k(x) por recurrencia. */
export function laguerre(k: number, a: number, x: number): number {
  if (k === 0) return 1;
  let l0 = 1, l1 = 1 + a - x;
  for (let j = 1; j < k; j++) { const l2 = ((2 * j + 1 + a - x) * l1 - (j + a) * l0) / (j + 1); l0 = l1; l1 = l2; }
  return l1;
}
/** Parte radial del hidrógeno (sin normalizar), r en radios de Bohr. */
export function radialR(n: number, l: number, r: number): number {
  const rho = (2 * r) / n;
  return rho ** l * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
}
/** Valor medio de r en el hidrógeno: ⟨r⟩ = a₀·(3n² − ℓ(ℓ + 1))/2. */
export const meanRadius = (n: number, l: number) => (3 * n * n - l * (l + 1)) / 2;
/** Parte angular real (misma normalización para todos los orbitales de un subnivel), con u unitario. */
export function angularPart(l: number, ml: number, u: readonly [number, number, number]): number {
  const [x, y, z] = u;
  if (l === 0) return 1;
  if (l === 1) return ml === 1 ? x : ml === -1 ? y : z;
  const s3 = Math.sqrt(3);
  switch (ml) {
    case -2: return s3 * x * y;
    case -1: return s3 * y * z;
    case 0: return (3 * z * z - 1) / 2;
    case 1: return s3 * x * z;
    default: return (s3 / 2) * (x * x - y * y);
  }
}
/**
 * Puntos (en a₀, ejes del orbital: z hacia arriba) con densidad |ψ|²: el radio se toma de la distribución radial
 * r²·R² (función acumulada en una rejilla) y la dirección por rechazo con |Y|². Reproducible con la semilla.
 */
export function sampleOrbital(n: number, l: number, ml: number, count: number, seed: number): [number, number, number][] {
  const rand = seededRandom(seed);
  const rMax = 4 * n * n + 12, N = 800, h = rMax / N;
  const cdf: number[] = [0];
  for (let i = 1; i <= N; i++) { const r = i * h; const R = radialR(n, l, r); cdf.push(cdf[i - 1] + r * r * R * R * h); }
  const tot = cdf[N];
  const pts: [number, number, number][] = [];
  let guard = 0;
  while (pts.length < count && guard++ < count * 200) {
    const target = rand() * tot;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m] < target) lo = m; else hi = m; }
    const r = (lo + (target - cdf[lo]) / Math.max(1e-300, cdf[hi] - cdf[lo])) * h;
    // dirección uniforme y rechazo con |Y|² (el máximo de |Y| es 1 con esta normalización)
    let u: [number, number, number] = [0, 0, 1];
    for (let t = 0; t < 400; t++) {
      const zc = 2 * rand() - 1, ph = 2 * Math.PI * rand(), s = Math.sqrt(1 - zc * zc);
      u = [s * Math.cos(ph), s * Math.sin(ph), zc];
      if (rand() <= angularPart(l, ml, u) ** 2) break;
    }
    pts.push([r * u[0], r * u[1], r * u[2]]);
  }
  return pts;
}

export const electronConfigurationSpec: ModelSpec = {
  name: 'Configuración electrónica: principio de construcción (Madelung), Pauli y Hund, comparada con el estado fundamental medido',
  inputs: [
    { symbol: 'Z', name: 'Número atómico del elemento', unit: '—', range: [1, MAX_Z], initial: 26 },
    { symbol: 'diagrama', name: 'Electrones colocados en las cajas de orbitales (con su espín ↑ o ↓)', unit: '—', initial: 'vacío' },
  ],
  outputs: [
    { symbol: 'configuración', name: 'Configuración electrónica y notación abreviada con el gas noble', unit: '—' },
    { symbol: 'e⁻ desapareados', name: 'Electrones desapareados (regla de Hund)', unit: '—' },
    { symbol: 'período, grupo, bloque', name: 'Ubicación en la tabla deducida de la configuración', unit: '—' },
    { symbol: 'e⁻ de valencia', name: 'Electrones de valencia (ns + np) o externos (ns + (n − 1)d)', unit: '—' },
  ],
  equations: [
    'Orden de llenado: n + ℓ creciente; a igual n + ℓ, primero el de menor n (regla de Madelung o de las diagonales)',
    'Capacidad: 2·(2ℓ + 1) electrones por subnivel; 2 por orbital con espines opuestos (Pauli)',
    'Hund: en un subnivel, un electrón en cada orbital con el mismo espín antes de aparear',
    'Grupo (bloque s) = e⁻ en ns; (bloque p) = 10 + ns + np; (bloque d) = ns + (n − 1)d; período = n mayor',
    'Forma 3D: |ψ|² del hidrógeno, ψ ∝ ρ^ℓ·e^(−ρ/2)·L^(2ℓ+1)_(n−ℓ−1)(ρ)·Y_real(θ, φ), ρ = 2r/(n·a₀)',
  ],
  initialConditions: [
    'Átomo neutro en su estado fundamental; elementos del hidrógeno (Z = 1) al xenón (Z = 54).',
    'Estado fundamental medido: configuraciones de la tabla periódica de PubChem (los mismos que publica el NIST), consultadas el 2026-11-01.',
  ],
  assumptions: [
    'El orden de Madelung es una regla empírica: predice bien la mayoría de los estados fundamentales, no todos.',
    'Las cajas con mℓ = −ℓ … +ℓ son la convención escolar; en 3D se dibujan los orbitales reales (pₓ, p_y, p_z…), combinaciones de los de mℓ = ±1, ±2.',
    'Las formas 3D son las del hidrógeno (un electrón): sirven para la forma y la orientación, no para el tamaño real en átomos con muchos electrones.',
  ],
  limits: [
    'El principio de construcción no predice 8 de los 54 primeros elementos (Cr, Cu, Nb, Mo, Ru, Rh, Pd y Ag): se comparan con el dato medido.',
    'La regla de «subnivel lleno o semilleno más estable» explica el Cr, el Cu, el Mo y la Ag, pero no el Nb, el Ru, el Rh ni el Pd.',
    'En la vista 3D el radio se comprime (raíz cuadrada de r) para que quepan en la misma escena orbitales de distintas capas.',
  ],
  testCases: [
    'Fe (Z = 26): 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶ = [Ar] 4s² 3d⁶, 4 electrones desapareados, período 4, grupo 8, bloque d.',
    'Cr (Z = 24): el principio de construcción predice [Ar] 4s² 3d⁴ (4 desapareados); el estado medido es [Ar] 4s¹ 3d⁵ (6 desapareados).',
    'Cu (Z = 29): predicho [Ar] 4s² 3d⁹; medido [Ar] 4s¹ 3d¹⁰ (1 desapareado).',
    'Hidrógeno: ⟨r⟩ = 1,5 a₀ (1s), 5 a₀ (2p) y 10,5 a₀ (3d); la muestra de puntos lo reproduce.',
  ],
};

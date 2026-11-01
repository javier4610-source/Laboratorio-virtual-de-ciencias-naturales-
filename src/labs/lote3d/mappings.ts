/**
 * Correspondencias PURAS entre el estado de cada laboratorio del lote 3D-1 y lo que dibuja su vista 3D (se prueban en
 * tests/unit/lote3d.test.ts). Ningún número científico nuevo: las cantidades salen de los modelos de cada práctica
 * (coeficientes, moles, avance, molaridad, codones) y de datos ya incluidos en el repositorio (masas atómicas CIAAW de
 * balancing.ts, radios iónicos de Shannon del kit, N_A exacta, estructuras PDB/AlphaFold incluidas).
 */
import { ATOMIC_MASS, parseFormula } from '../../models/balancing';
import { domainDirections, type Species3D, type V3 } from '../../chem/species';
import { ionicRadius } from '../../chem/elements';

/* ------------------------------------------------------------------ paquetes de partículas (reactivo limitante) */

export interface Packets {
  /** Partículas de cada reactivo que se dibujan antes de reaccionar. */
  a: number; b: number;
  /** «Unidades de reacción» (veces que ocurre la ecuación) que caben en las partículas dibujadas. */
  units: number;
  /** Partículas que sobran de cada reactivo si la reacción se completa. */
  leftA: number; leftB: number;
  /** Reactivo limitante: 0 (A), 1 (B) o null si están en proporción exacta (o no hay reacción). */
  limiting: 0 | 1 | null;
}

/**
 * Pasa cantidades reales (moles) a un número pequeño de partículas que se puedan dibujar, CONSERVANDO lo que importa:
 * cuál es el reactivo limitante (el de menor n/ν, la misma regla de los modelos), que el limitante se consume entero y
 * que la proporción entre los dos reactivos se respeta tanto como lo permiten los enteros.
 * La mayor de n_A/ν_A y n_B/ν_B se dibuja como `maxUnits` unidades de reacción.
 */
export function packets(molesA: number, coefA: number, molesB: number, coefB: number, maxUnits: number): Packets {
  if (![molesA, molesB].every((x) => x >= 0) || !(coefA > 0 && coefB > 0) || !(maxUnits >= 1)) throw new RangeError('Cantidades no válidas para los paquetes de partículas.');
  const xa = molesA / coefA, xb = molesB / coefB;
  const xmax = Math.max(xa, xb);
  if (!(xmax > 0)) return { a: 0, b: 0, units: 0, leftA: 0, leftB: 0, limiting: null };
  if (!Number.isFinite(xa) && !Number.isFinite(xb)) throw new RangeError('Los dos reactivos no pueden ser ilimitados.');
  const limiting: 0 | 1 | null = Math.abs(xa - xb) <= 1e-12 * Math.max(xa, xb, 1) ? null : xa < xb ? 0 : 1;
  // B ilimitado (p. ej., oxígeno del aire en un sistema abierto): A limita y B solo lo necesario.
  if (!Number.isFinite(xb)) { const u = maxUnits; return { a: u * coefA, b: u * coefB, units: u, leftA: 0, leftB: 0, limiting: 0 }; }
  if (!Number.isFinite(xa)) { const u = maxUnits; return { a: u * coefA, b: u * coefB, units: u, leftA: 0, leftB: 0, limiting: 1 }; }
  const s = maxUnits / xmax;
  const xmin = Math.min(xa, xb);
  const units = xmin > 0 ? Math.max(1, Math.round(xmin * s)) : 0;
  const scaled = (x: number, nu: number, isLimiting: boolean) => (isLimiting ? units * nu : Math.max(units * nu, Math.round(x * s * nu)));
  const a = limiting === 1 ? scaled(xa, coefA, false) : limiting === 0 ? scaled(xa, coefA, true) : units * coefA;
  const b = limiting === 0 ? scaled(xb, coefB, false) : limiting === 1 ? scaled(xb, coefB, true) : units * coefB;
  return { a, b, units, leftA: a - units * coefA, leftB: b - units * coefB, limiting };
}

/** Unidades que ya reaccionaron para un avance 0–1 de la animación del laboratorio (redondeo al entero más cercano). */
export const unitsAt = (units: number, extent: number) => Math.max(0, Math.min(units, Math.round(units * Math.max(0, Math.min(1, extent)))));

/** Unidades que llegan a producto con un rendimiento porcentual (las demás quedan como reactivo sin transformar). */
export const unitsWithYield = (units: number, yieldPercent: number) => Math.max(0, Math.min(units, Math.round((units * yieldPercent) / 100)));

/* ------------------------------------------------------------------ masas */

/** Masa molar (g/mol) de los átomos dibujados, con las masas atómicas de balancing.ts (CIAAW). */
export function atomsMass(atoms: { el: string }[]): number {
  return atoms.reduce((s, a) => s + (ATOMIC_MASS[a.el] ?? NaN), 0);
}

/** ¿La especie 3D tiene exactamente los átomos de la fórmula? (comprobación de integridad de la escena) */
export function matchesFormula(s: Species3D, formula: string): boolean {
  const want = parseFormula(formula.split('·')[0]);
  const have: Record<string, number> = {};
  for (const a of s.atoms) have[a.el] = (have[a.el] ?? 0) + 1;
  const keys = new Set([...Object.keys(want), ...Object.keys(have)]);
  return [...keys].every((k) => (want[k] ?? 0) === (have[k] ?? 0));
}

/* ------------------------------------------------------------------ soluciones: iones en un volumen fijo */

/** Constante de Avogadro (mol⁻¹), exacta desde el SI de 2019 (la misma de src/models/mole.ts). */
export const N_A = 6.02214076e23;
/** Lado del cubo de disolución que se dibuja (nm). */
export const BOX_NM = 5;
/** Máximo de unidades fórmula (o moléculas) que se dibujan en el cubo; si hay más, se dice cuántas son. */
export const BOX_MAX_DRAWN = 120;

/** Unidades fórmula (o moléculas) de soluto en un cubo de `sideNm` nm de lado: N = c·N_A·V (V en litros). */
export function unitsInBox(molarity: number, sideNm = BOX_NM): number {
  if (!(molarity >= 0) || !(sideNm > 0)) throw new RangeError('Molaridad o lado del cubo no válidos.');
  const litres = (sideNm * 1e-9) ** 3 * 1000;
  return molarity * N_A * litres;
}

/** Generador determinista (mulberry32): posiciones estables al cambiar el número de partículas. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n posiciones al azar (deterministas) dentro de un cubo de lado L (Å) centrado en el origen, con margen m. */
export function boxPositions(n: number, sideA: number, margin: number, seed = 20261101): V3[] {
  const rnd = seeded(seed);
  const h = sideA / 2 - margin;
  return Array.from({ length: n }, () => [(rnd() * 2 - 1) * h, (rnd() * 2 - 1) * h, (rnd() * 2 - 1) * h] as V3);
}

/* ------------------------------------------------------------------ soluciones: capa de hidratación */

type M3 = [V3, V3, V3];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mulS = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: V3): V3 => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rotación que lleva el vector unitario u sobre el vector unitario v (fórmula de Rodrigues). */
export function rotationBetween(u: V3, v: V3): M3 {
  const a = unit(u), b = unit(v);
  const c = dot(a, b);
  if (c > 1 - 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (c < -1 + 1e-12) {
    // Giro de 180° alrededor de cualquier eje perpendicular a u.
    const p = unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
    return [0, 1, 2].map((i) => [0, 1, 2].map((j) => 2 * p[i] * p[j] - (i === j ? 1 : 0))) as M3;
  }
  const k = cross(a, b);
  const K: M3 = [[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]];
  const f = 1 / (1 + c);
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + K[i][j] + f * [0, 1, 2].reduce((s, m) => s + K[i][m] * K[m][j], 0))) as M3;
}
const apply = (R: M3, p: V3): V3 => [dot(R[0], p), dot(R[1], p), dot(R[2], p)];

/**
 * Distancia ion–oxígeno del agua en la capa de hidratación: suma de radios iónicos de Shannon (1976) del ion (número
 * de coordinación 6) y del O²⁻ con coordinación 3 (el O del agua está unido a 2 H y al ion). Es una ESTIMACIÓN con datos
 * del kit (Na–O ≈ 2,38 Å, K–O ≈ 2,74 Å, Cl–O ≈ 3,17 Å), del orden de las distancias de difracción en disolución.
 */
export function ionWaterDistance(el: string): number {
  return ionicRadius(el, 6) + ionicRadius('O', 3);
}

/**
 * Capa de hidratación ILUSTRATIVA: n moléculas de agua (geometría de PubChem) en las direcciones del poliedro VSEPR de
 * n dominios alrededor del ion, con el O a `ionWaterDistance`. Cationes: el O mira al ion (los H hacia afuera, el
 * dipolo hacia afuera). Aniones: un enlace O–H apunta al ion (puente de hidrógeno).
 */
export function hydrationShell(water: Species3D, ionEl: string, ionCharge: number, n = 6, center: V3 = [0, 0, 0]): { atoms: { el: string; x: number; y: number; z: number }[]; bonds: { a: number; b: number; order: 1 | 2 | 3 | 4 }[] } {
  const oi = water.atoms.findIndex((a) => a.el === 'O');
  const hs = water.atoms.map((a, i) => (a.el === 'H' ? i : -1)).filter((i) => i >= 0);
  if (oi < 0 || hs.length !== 2) throw new RangeError('La especie de agua no es H₂O.');
  const O: V3 = [water.atoms[oi].x, water.atoms[oi].y, water.atoms[oi].z];
  const local = water.atoms.map((a) => sub([a.x, a.y, a.z], O));
  const bis = unit(add(local[hs[0]], local[hs[1]]));
  const d = ionWaterDistance(ionEl);
  const atoms: { el: string; x: number; y: number; z: number }[] = [];
  const bonds: { a: number; b: number; order: 1 | 2 | 3 | 4 }[] = [];
  domainDirections(n).forEach((dir) => {
    const u = unit(dir);
    // Catión: bisectriz H–O–H hacia afuera (+u). Anión: el primer O–H hacia el ion (−u).
    const R = ionCharge > 0 ? rotationBetween(bis, u) : rotationBetween(unit(local[hs[0]]), mulS(u, -1));
    const o = add(center, mulS(u, d));
    const start = atoms.length;
    water.atoms.forEach((a, i) => { const p = add(o, apply(R, local[i])); atoms.push({ el: a.el, x: p[0], y: p[1], z: p[2] }); });
    for (const b of water.bonds) bonds.push({ a: start + b.a, b: start + b.b, order: b.order });
  });
  return { atoms, bonds };
}

/* ------------------------------------------------------------------ proteínas: del codón al residuo de la estructura */

export interface ResidueRef { chains: string[]; resSeq: number }
export interface StructureMap {
  /** Archivo incluido en src/data/proteinas (clave de STRUCTURE_LOADERS). */
  file: string;
  id: string;
  name: string;
  kind: 'experimental' | 'prediccion';
  /** Codón de la proteína completa (Met inicial = 1) → residuo de la estructura, o motivo por el que no está. */
  residueFor: (codon: number) => ResidueRef | { missing: string };
  /** Cadenas que corresponden al producto del gen (las demás se dibujan en gris). */
  geneChains: string[];
}

/**
 * β-globina (gen HBB) en la desoxihemoglobina 2HHB: la metionina inicial se retira después de la traducción, así que el
 * codón c corresponde al residuo c − 1 de las cadenas β (B y D). El codón 7 (GAG, anemia falciforme) es el β6 Glu.
 */
export function hbbResidue(codon: number): ResidueRef | { missing: string } {
  if (codon === 1) return { missing: 'la metionina inicial se retira de la β-globina madura' };
  if (codon >= 2 && codon <= 147) return { chains: ['B', 'D'], resSeq: codon - 1 };
  return { missing: 'el codón queda fuera de los 146 residuos de la β-globina' };
}

/**
 * Preproinsulina (gen INS, 110 aminoácidos) e insulina madura 3I40: péptido señal 1–24 y péptido C (con sus pares
 * básicos) 55–89 se retiran; la cadena B son los codones 25–54 y la cadena A los 90–110.
 */
export function insResidue(codon: number): ResidueRef | { missing: string } {
  if (codon >= 25 && codon <= 54) return { chains: ['B'], resSeq: codon - 24 };
  if (codon >= 90 && codon <= 110) return { chains: ['A'], resSeq: codon - 89 };
  if (codon >= 1 && codon <= 24) return { missing: 'el codón está en el péptido señal, que se corta al entrar al retículo endoplasmático' };
  if (codon >= 55 && codon <= 89) return { missing: 'el codón está en el péptido C, que se retira al formarse la insulina madura' };
  return { missing: 'el codón queda fuera de la preproinsulina' };
}

/** Diferencias de secuencia que declara el propio archivo 3I40 respecto de UniProt P01308 (_struct_ref_seq_dif). */
export const INS_SEQ_DIFF: { chain: string; resSeq: number; note: string }[] = [
  { chain: 'B', resSeq: 30, note: 'en el cristal 3I40 el residuo B30 es Ala (la insulina humana tiene Thr); el archivo lo declara como diferencia con UniProt' },
];

/** Proteína P de OCA2 (838 aa): el modelo de AlphaFold numera los residuos igual que la secuencia de UniProt Q04671. */
export function oca2Residue(codon: number): ResidueRef | { missing: string } {
  if (codon >= 1 && codon <= 838) return { chains: ['A'], resSeq: codon };
  return { missing: 'el codón queda fuera de los 838 residuos del modelo' };
}

/** Estructura incluida en el repositorio para cada gen del rastreo (null: el repositorio no la incluye). */
export const GENE_STRUCTURES: Record<string, StructureMap | null> = {
  HBB: { file: '2HHB.cif', id: '2HHB', name: 'Hemoglobina humana (desoxi)', kind: 'experimental', residueFor: hbbResidue, geneChains: ['B', 'D'] },
  INS: { file: '3I40.cif', id: '3I40', name: 'Insulina humana', kind: 'experimental', residueFor: insResidue, geneChains: ['A', 'B'] },
  OCA2: { file: 'AF-Q04671-F1-model_v6.cif', id: 'AF-Q04671-F1', name: 'Proteína P de OCA2 (modelo de AlphaFold)', kind: 'prediccion', residueFor: oca2Residue, geneChains: ['A'] },
  LCT: null,
  lacZ: null,
};

/**
 * Residuos de la estructura que ya no se fabricarían cuando la proteína mutante termina antes (sin sentido) o cambia
 * desde un punto (corrimiento): desde el residuo del codón `fromCodon` hasta el final de cada cadena del gen.
 */
export function affectedFrom(map: StructureMap, fromCodon: number): ResidueRef | null {
  for (let c = Math.max(1, fromCodon); c < fromCodon + 400; c++) {
    const r = map.residueFor(c);
    if ('chains' in r) return r;
  }
  return null;
}

/* ------------------------------------------------------------------ enzimas */

/** Sitio activo de la lisozima del fago T4 (2LZM): Glu11 (donador de protones) y Asp20 (nucleófilo), cadena A. */
export const LYSOZYME_ACTIVE_SITE: { chain: string; resSeq: number; name: string; role: string }[] = [
  { chain: 'A', resSeq: 11, name: 'Glu11', role: 'donador de protones' },
  { chain: 'A', resSeq: 20, name: 'Asp20', role: 'nucleófilo' },
];


/* ------------------------------------------------------------------ rastreo génico: variante → residuos marcados */

export interface VariantLike { consequence: string; aaPosition: number | null; refAa: string | null; altAa: string | null; altLength: number | null; refLength: number }

/** Marcas de una variante del rastreo (consecuencia calculada por src/models/geneTrace.ts) sobre la estructura del gen. */
export function variantMarks(map: StructureMap, v: VariantLike | null, three: (aa: string) => string, prefix = ''): ProteinMarks {
  if (!v) return { marks: [], fadedFrom: [], headline: 'Sin variante analizada: se ve la proteína de referencia.' };
  if (v.aaPosition === null || v.consequence === 'no-codificante') return { marks: [], fadedFrom: [], headline: 'La variante está fuera de la región codificante: la secuencia de la proteína no cambia.' };
  const r = map.residueFor(v.aaPosition);
  const where = 'chains' in r ? `${prefix}${r.resSeq}` : null;
  if (v.consequence === 'sentido-erroneo' || v.consequence === 'sinonima' || v.consequence === 'en-marco' || v.consequence === 'perdida-terminacion') {
    if (!('chains' in r)) return { marks: [], fadedFrom: [], headline: `El aminoácido ${v.aaPosition} no está en la estructura: ${r.missing}.` };
    const lbl = v.consequence === 'sentido-erroneo' && v.refAa && v.altAa ? `${where} ${three(v.refAa)}→${three(v.altAa)}` : v.consequence === 'sinonima' && v.refAa ? `${where} ${three(v.refAa)} (igual)` : `${where}`;
    const text = v.consequence === 'sentido-erroneo' ? `Cambia un aminoácido en ${where}.` : v.consequence === 'sinonima' ? `El aminoácido ${where} no cambia (variante sinónima).` : v.consequence === 'en-marco' ? `Se gana o se pierde un aminoácido cerca de ${where}; el resto conserva el marco.` : `Se pierde el codón de terminación: la proteína sigue después del último residuo (${where}).`;
    return { marks: r.chains.map((chain) => ({ chain, resSeq: r.resSeq, label: lbl })), fadedFrom: [], headline: text };
  }
  // Sin sentido, cambio del marco o pérdida del inicio: lo que sigue ya no se fabrica igual.
  const from = affectedFrom(map, v.aaPosition);
  if (!from) return { marks: [], fadedFrom: [], headline: `La proteína cambia desde el aminoácido ${v.aaPosition}, fuera de la parte que está en la estructura.` };
  const stop = v.consequence === 'sin-sentido';
  return {
    marks: from.chains.map((chain) => ({ chain, resSeq: from.resSeq, label: `${prefix}${from.resSeq}: ${stop ? 'aquí termina' : 'desde aquí cambia'}` })),
    fadedFrom: from.chains.map((chain) => ({ chain, resSeq: from.resSeq })),
    headline: stop ? `Codón de terminación prematuro: la proteína queda de ${v.altLength ?? '?'} de ${v.refLength} aminoácidos; lo atenuado no se fabricaría.` : `La secuencia cambia desde el aminoácido ${v.aaPosition}: lo atenuado ya no sería la misma proteína.`,
  };
}

/* ------------------------------------------------------------------ expresión génica y rastreo: qué se marca */

export interface ProteinMarks {
  marks: { chain: string; resSeq: number; label: string }[];
  fadedFrom: { chain: string; resSeq: number }[];
  /** Frase que resume lo que se ve. */
  headline: string;
}

const firstDiffIndex = (a: string, b: string) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };

/**
 * Lo que se marca en la estructura a partir de la proteína silvestre y la mutante (letras de una sola letra, Met
 * inicial = codón 1) y del codón de interés. `three` convierte una letra en su abreviatura de tres letras y `prefix`
 * nombra la cadena (p. ej., «β» en la hemoglobina).
 *  - Mismo largo y un solo cambio (o ninguno): se marca ese residuo (sentido erróneo o silenciosa).
 *  - La proteína mutante termina antes o cambia desde un punto: se marca el primer residuo afectado y se atenúa desde
 *    ahí hasta el final de la cadena (lo que la célula ya no fabricaría así).
 */
export function proteinMarks(map: StructureMap, wild: string, mutant: string | null, focusCodon: number | null, three: (aa: string) => string, prefix = ''): ProteinMarks {
  const at = (codon: number, label: (res: number) => string) => {
    const r = map.residueFor(codon);
    return 'chains' in r ? r.chains.map((chain) => ({ chain, resSeq: r.resSeq, label: label(r.resSeq) })) : [];
  };
  if (mutant === null || mutant === wild) {
    if (focusCodon === null) return { marks: [], fadedFrom: [], headline: mutant === wild && mutant !== null ? 'La mutación no cambia la proteína.' : 'Proteína silvestre.' };
    const r = map.residueFor(focusCodon);
    const aa = wild[focusCodon - 1];
    if (!('chains' in r)) return { marks: [], fadedFrom: [], headline: `El codón ${focusCodon} no está en la estructura: ${r.missing}.` };
    return { marks: at(focusCodon, (res) => `${prefix}${res} ${three(aa)}`), fadedFrom: [], headline: `Codón ${focusCodon} → residuo ${prefix}${r.resSeq} (${three(aa)}) de la proteína plegada${mutant === wild && mutant !== null ? '; la mutación no cambia la proteína' : ''}.` };
  }
  const i = firstDiffIndex(wild, mutant);
  const codon = i + 1;
  const r = map.residueFor(codon);
  const sameLength = wild.length === mutant.length;
  const single = sameLength && [...wild].filter((c, k) => c !== mutant[k]).length === 1;
  if (single) {
    if (!('chains' in r)) return { marks: [], fadedFrom: [], headline: `El cambio (codón ${codon}) cae fuera de la proteína madura: ${r.missing}.` };
    return { marks: at(codon, (res) => `${prefix}${res} ${three(wild[i])}→${three(mutant[i])}`), fadedFrom: [], headline: `Cambia un aminoácido: ${three(wild[i])} → ${three(mutant[i])} en el residuo ${prefix}${r.resSeq}; el resto de la cadena es igual.` };
  }
  // Truncada o cambiada desde un punto: el primer residuo de la estructura a partir de ese codón.
  const from = affectedFrom(map, codon);
  if (!from) return { marks: [], fadedFrom: [], headline: `La proteína cambia desde el codón ${codon}, fuera de la parte que está en la estructura.` };
  const truncated = mutant.length === i && wild.startsWith(mutant);
  const label = (res: number) => `${prefix}${res}: ${truncated ? 'aquí termina' : 'desde aquí cambia'}`;
  return {
    marks: from.chains.map((chain) => ({ chain, resSeq: from.resSeq, label: label(from.resSeq) })),
    fadedFrom: from.chains.map((chain) => ({ chain, resSeq: from.resSeq })),
    headline: truncated
      ? `La proteína mutante termina en el aminoácido ${mutant.length} de ${wild.length}: la parte atenuada (desde ${prefix}${from.resSeq}) no se fabricaría.`
      : `La secuencia cambia desde el codón ${codon} (${mutant.length} aminoácidos en lugar de ${wild.length}): la parte atenuada (desde ${prefix}${from.resSeq}) ya no sería la misma.`,
  };
}

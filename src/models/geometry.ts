import { fmt } from '../lib/format';
import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Geometría molecular en 3D y modelo VSEPR (grado 10.º).
 *
 * Las coordenadas NO se inventan ni se dibujan a mano: vienen de archivos SDF (MDL V2000) de confórmeros 3D
 * calculados por PubChem (PubChem3D), incluidos en src/data/conformers.ts o descargados en vivo. Este modelo:
 *   1. Lee el SDF de forma segura (límites de tamaño, de átomos y de enlaces; valida cada campo).
 *   2. Calcula distancias d = |r_B − r_A| y ángulos θ = arccos[(u·v)/(|u||v|)] con u = r_A − r_V, v = r_C − r_V.
 *   3. Toma los enlaces del bloque de enlaces del archivo (no los adivina por distancia).
 *   4. Predice con VSEPR el número de dominios electrónicos del átomo central (AXₘEₙ) a partir de los electrones de
 *      valencia, los órdenes de enlace y la carga formal del propio archivo, y lo compara con el ángulo calculado.
 * Funciones puras y deterministas (sin React ni navegador) para probarlas con Vitest.
 */

/* ------------------------------------------------------------------ tipos */

export interface SdfAtom {
  /** Índice desde 0 en el orden del archivo. */
  index: number;
  element: string;
  x: number; y: number; z: number;
  /** Carga formal (bloque de átomos o líneas «M  CHG», que tienen prioridad). */
  charge: number;
  /** Radical declarado en el archivo (código 4 del bloque de átomos o «M  RAD»). */
  radical: boolean;
  /** Etiqueta para la interfaz: símbolo + número del átomo en el archivo (p. ej. «O1»). */
  label: string;
}

export interface SdfBond {
  /** Índices desde 0. */
  a: number; b: number;
  /** 1 sencillo, 2 doble, 3 triple, 4 aromático (convención V2000). */
  order: 1 | 2 | 3 | 4;
}

export interface Molecule {
  title: string;
  atoms: SdfAtom[];
  bonds: SdfBond[];
  /** Campos de datos «> <NOMBRE>» del archivo (p. ej. PUBCHEM_COMPOUND_CID). */
  props: Record<string, string>;
  /** Dimensión declarada en la línea 2 del encabezado («2D», «3D» o vacía). */
  dimension: '2D' | '3D' | '';
  /** Verdadero si el archivo declara 3D o tiene alguna coordenada z distinta de cero. */
  is3D: boolean;
}

/** Error de lectura de un SDF con un mensaje comprensible para el estudiante. */
export class SdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SdfError';
  }
}

/** Límites de seguridad del lector (un archivo mayor se rechaza sin procesarlo). */
export const SDF_LIMITS = {
  /** Caracteres del texto completo (≈ 200 kB). */
  maxChars: 200_000,
  maxAtoms: 255,
  maxBonds: 300,
  maxProps: 120,
  /** Valor absoluto máximo de una coordenada, en Å. */
  maxCoord: 1000,
} as const;

/** Resoluciones con que el laboratorio informa las mediciones. */
export const RESOLUTION = { distance: 0.001, angle: 0.1 } as const;

/** Ángulo tetraédrico ideal: arccos(−1/3) ≈ 109,47°. */
export const TETRAHEDRAL = (Math.acos(-1 / 3) * 180) / Math.PI;

/* ------------------------------------------------------------------ lector de SDF (V2000) */

const ELEMENT_RE = /^[A-Z][a-z]?$/;
/** Códigos de carga del bloque de átomos V2000 (columna ccc). 4 = radical doblete. */
const CHARGE_CODE: Record<number, number> = { 0: 0, 1: 3, 2: 2, 3: 1, 4: 0, 5: -1, 6: -2, 7: -3 };

function intField(line: string, from: number, to: number, what: string): number {
  const raw = line.slice(from, to).trim();
  if (!/^-?\d+$/.test(raw)) throw new SdfError(`${what}: se esperaba un número entero y se encontró «${raw.slice(0, 12)}».`);
  return Number(raw);
}

function coord(raw: string, what: string): number {
  const t = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new SdfError(`${what}: coordenada no válida («${t.slice(0, 12)}»).`);
  const v = Number(t);
  if (!Number.isFinite(v) || Math.abs(v) > SDF_LIMITS.maxCoord) throw new SdfError(`${what}: coordenada fuera del límite de ±${SDF_LIMITS.maxCoord} Å.`);
  return v;
}

/**
 * Lee el PRIMER registro de un archivo SDF/MOL en formato V2000. Lanza SdfError si el texto es demasiado grande,
 * está mal formado o usa el formato V3000 (no admitido).
 */
export function parseSdf(text: unknown): Molecule {
  if (typeof text !== 'string') throw new SdfError('El archivo no es texto.');
  if (text.length === 0) throw new SdfError('El archivo está vacío.');
  if (text.length > SDF_LIMITS.maxChars) throw new SdfError(`El archivo supera el límite de ${SDF_LIMITS.maxChars} caracteres.`);
  const record = text.replace(/\r\n?/g, '\n').split(/^\$\$\$\$/m)[0];
  const lines = record.split('\n');
  if (lines.length < 4) throw new SdfError('Faltan las líneas del encabezado y de conteos.');
  const counts = lines[3];
  if (/V3000/.test(counts)) throw new SdfError('El formato V3000 no está admitido; usa un archivo V2000.');
  if (!/V2000/.test(counts)) throw new SdfError('La línea de conteos no indica el formato V2000.');
  const nAtoms = intField(counts, 0, 3, 'Número de átomos');
  const nBonds = intField(counts, 3, 6, 'Número de enlaces');
  if (nAtoms < 1 || nAtoms > SDF_LIMITS.maxAtoms) throw new SdfError(`El número de átomos debe estar entre 1 y ${SDF_LIMITS.maxAtoms} (archivo: ${nAtoms}).`);
  if (nBonds < 0 || nBonds > SDF_LIMITS.maxBonds) throw new SdfError(`El número de enlaces debe estar entre 0 y ${SDF_LIMITS.maxBonds} (archivo: ${nBonds}).`);
  if (lines.length < 4 + nAtoms + nBonds) throw new SdfError('El archivo termina antes de completar los bloques de átomos y enlaces.');

  const atoms: SdfAtom[] = [];
  for (let i = 0; i < nAtoms; i++) {
    const l = lines[4 + i];
    const what = `Átomo ${i + 1}`;
    const element = l.slice(31, 34).trim();
    if (!ELEMENT_RE.test(element)) throw new SdfError(`${what}: símbolo de elemento no válido («${element.slice(0, 4)}»).`);
    const code = l.length >= 39 && l.slice(36, 39).trim() !== '' ? intField(l, 36, 39, `${what} (carga)`) : 0;
    if (!(code in CHARGE_CODE)) throw new SdfError(`${what}: código de carga no válido (${code}).`);
    atoms.push({
      index: i, element,
      x: coord(l.slice(0, 10), what), y: coord(l.slice(10, 20), what), z: coord(l.slice(20, 30), what),
      charge: CHARGE_CODE[code], radical: code === 4, label: `${element}${i + 1}`,
    });
  }

  const bonds: SdfBond[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nBonds; i++) {
    const l = lines[4 + nAtoms + i];
    const what = `Enlace ${i + 1}`;
    const a = intField(l, 0, 3, what) - 1;
    const b = intField(l, 3, 6, what) - 1;
    const order = intField(l, 6, 9, `${what} (tipo)`);
    if (a < 0 || b < 0 || a >= nAtoms || b >= nAtoms) throw new SdfError(`${what}: une átomos que no existen.`);
    if (a === b) throw new SdfError(`${what}: une un átomo consigo mismo.`);
    if (order < 1 || order > 4) throw new SdfError(`${what}: tipo de enlace ${order} no admitido (solo 1, 2, 3 o 4).`);
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) throw new SdfError(`${what}: enlace repetido.`);
    seen.add(key);
    bonds.push({ a, b, order: order as SdfBond['order'] });
  }

  // Bloque de propiedades hasta «M  END»: las cargas «M  CHG» reemplazan las del bloque de átomos.
  let k = 4 + nAtoms + nBonds;
  let chgSeen = false;
  for (; k < lines.length; k++) {
    const l = lines[k];
    if (l.startsWith('M  END')) { k++; break; }
    if (l.startsWith('M  CHG') || l.startsWith('M  RAD')) {
      const isChg = l.startsWith('M  CHG');
      const tokens = l.slice(6).trim().split(/\s+/).map(Number);
      const n = tokens[0];
      if (!Number.isInteger(n) || n < 1 || n > 8 || tokens.length < 1 + 2 * n) throw new SdfError(`Línea «${l.slice(0, 6)}» mal formada.`);
      if (isChg && !chgSeen) { for (const at of atoms) at.charge = 0; chgSeen = true; }
      for (let p = 0; p < n; p++) {
        const idx = tokens[1 + 2 * p] - 1, val = tokens[2 + 2 * p];
        if (!Number.isInteger(idx) || idx < 0 || idx >= nAtoms || !Number.isInteger(val) || Math.abs(val) > 8) throw new SdfError(`Línea «${l.slice(0, 6)}» con valores no válidos.`);
        if (isChg) atoms[idx].charge = val; else atoms[idx].radical = val !== 0;
      }
    }
  }

  const props: Record<string, string> = {};
  let nProps = 0;
  for (; k < lines.length; k++) {
    const m = /^>.*<([^>]{1,80})>/.exec(lines[k]);
    if (!m) continue;
    if (++nProps > SDF_LIMITS.maxProps) throw new SdfError(`El archivo tiene más de ${SDF_LIMITS.maxProps} campos de datos.`);
    const value: string[] = [];
    for (k = k + 1; k < lines.length && lines[k].trim() !== ''; k++) value.push(lines[k]);
    props[m[1]] = value.join('\n');
  }

  const dimRaw = (lines[1] ?? '').slice(20, 22);
  const dimension = dimRaw === '3D' || dimRaw === '2D' ? dimRaw : '';
  return {
    title: lines[0].trim().slice(0, 80), atoms, bonds, props, dimension,
    is3D: dimension === '3D' || atoms.some((a) => Math.abs(a.z) > 1e-6),
  };
}

/* ------------------------------------------------------------------ vectores, distancias y ángulos */

export type Vec3 = [number, number, number];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3) => Math.sqrt(dot(a, a));
const pos = (a: SdfAtom): Vec3 => [a.x, a.y, a.z];

/** Distancia euclidiana entre dos puntos (en las unidades de las coordenadas: Å en PubChem3D). */
export function distance(p: Vec3, q: Vec3): number {
  return norm(sub(p, q));
}

/** Ángulo p–v–q (en grados) con vértice en v. Lanza un error si dos puntos coinciden. */
export function angleDeg(p: Vec3, v: Vec3, q: Vec3): number {
  const u = sub(p, v), w = sub(q, v);
  const nu = norm(u), nw = norm(w);
  if (nu < 1e-9 || nw < 1e-9) throw new RangeError('El ángulo no está definido: dos átomos ocupan el mismo lugar.');
  const c = Math.min(1, Math.max(-1, dot(u, w) / (nu * nw)));
  return (Math.acos(c) * 180) / Math.PI;
}

function checkIndex(mol: Molecule, i: number, name: string) {
  assertInRange(name, i, 0, mol.atoms.length - 1);
  if (!Number.isInteger(i)) throw new RangeError(`${name} debe ser un número entero.`);
}

/** Vecinos de un átomo según el bloque de enlaces del archivo (en orden creciente). */
export function neighbors(mol: Molecule, i: number): number[] {
  checkIndex(mol, i, 'El átomo');
  return mol.bonds.flatMap((b) => (b.a === i ? [b.b] : b.b === i ? [b.a] : [])).sort((x, y) => x - y);
}

export function bondBetween(mol: Molecule, i: number, j: number): SdfBond | undefined {
  return mol.bonds.find((b) => (b.a === i && b.b === j) || (b.a === j && b.b === i));
}

/** Distancia entre dos átomos del archivo, redondeada a 0,001 Å. */
export function measureDistance(mol: Molecule, i: number, j: number): number {
  checkIndex(mol, i, 'El primer átomo'); checkIndex(mol, j, 'El segundo átomo');
  if (i === j) throw new RangeError('Elige dos átomos distintos.');
  return roundToResolution(distance(pos(mol.atoms[i]), pos(mol.atoms[j])), RESOLUTION.distance);
}

/** Ángulo i–v–k (vértice v) entre átomos del archivo, redondeado a 0,1°. */
export function measureAngle(mol: Molecule, i: number, v: number, k: number): number {
  checkIndex(mol, i, 'El primer átomo'); checkIndex(mol, v, 'El átomo del vértice'); checkIndex(mol, k, 'El tercer átomo');
  if (i === v || k === v || i === k) throw new RangeError('Elige tres átomos distintos.');
  return roundToResolution(angleDeg(pos(mol.atoms[i]), pos(mol.atoms[v]), pos(mol.atoms[k])), RESOLUTION.angle);
}

export interface BondRow { a: number; b: number; order: SdfBond['order']; length: number }
export interface AngleRow { a: number; v: number; c: number; angle: number }

/** Tabla de enlaces del archivo con su longitud (sin redondear). */
export function bondTable(mol: Molecule): BondRow[] {
  return mol.bonds.map((b) => ({ ...b, length: distance(pos(mol.atoms[b.a]), pos(mol.atoms[b.b])) }));
}

/** Todos los ángulos de enlace A–V–C (A y C enlazados a V), sin redondear. */
export function angleTable(mol: Molecule): AngleRow[] {
  const out: AngleRow[] = [];
  for (const at of mol.atoms) {
    const ns = neighbors(mol, at.index);
    for (let p = 0; p < ns.length; p++) for (let q = p + 1; q < ns.length; q++) {
      out.push({ a: ns[p], v: at.index, c: ns[q], angle: angleDeg(pos(mol.atoms[ns[p]]), pos(at), pos(mol.atoms[ns[q]])) });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ VSEPR */

/** Electrones de valencia de elementos de los grupos principales (los que puede tener un confórmero de PubChem3D y algunos más). */
export const VALENCE_ELECTRONS: Record<string, number> = {
  H: 1, Li: 1, Be: 2, B: 3, Al: 3, C: 4, Si: 4, Ge: 4, N: 5, P: 5, As: 5, O: 6, S: 6, Se: 6,
  F: 7, Cl: 7, Br: 7, I: 7, Xe: 8, Kr: 8,
};

export interface VseprShape {
  /** Número estérico (dominios electrónicos) = átomos unidos + pares libres. */
  domains: number;
  bonded: number;
  lonePairs: number;
  /** Notación AXₘEₙ (con dígitos normales: «AX2E2»). */
  notation: string;
  electronGeometry: string;
  molecularShape: string;
  /** Ángulos ideales del poliedro de dominios (°). */
  idealAngles: number[];
  /** Qué predice VSEPR para el ángulo real respecto al ideal. */
  expectation: 'igual' | 'menor';
}

const ELECTRON_GEOMETRY: Record<number, { name: string; angles: number[] }> = {
  2: { name: 'lineal', angles: [180] },
  3: { name: 'trigonal plana', angles: [120] },
  4: { name: 'tetraédrica', angles: [TETRAHEDRAL] },
  5: { name: 'bipirámide trigonal', angles: [90, 120, 180] },
  6: { name: 'octaédrica', angles: [90, 180] },
};

const SHAPE: Record<string, string> = {
  AX2: 'lineal',
  AX3: 'trigonal plana', AX2E1: 'angular',
  AX4: 'tetraédrica', AX3E1: 'piramidal trigonal', AX2E2: 'angular',
  AX5: 'bipirámide trigonal', AX4E1: 'balancín', AX3E2: 'forma de T', AX2E3: 'lineal',
  AX6: 'octaédrica', AX5E1: 'pirámide cuadrada', AX4E2: 'cuadrada plana',
};

/** Formas con pares libres en las que la simetría mantiene el ángulo ideal (180° o 90°). */
const SYMMETRIC_WITH_E = new Set(['AX2E3', 'AX4E2']);

/** Clasificación VSEPR a partir del número de átomos unidos y de pares libres. */
export function vseprShape(bonded: number, lonePairs: number): VseprShape | null {
  if (!Number.isInteger(bonded) || !Number.isInteger(lonePairs) || bonded < 2 || lonePairs < 0) return null;
  const domains = bonded + lonePairs;
  const geo = ELECTRON_GEOMETRY[domains];
  const key = lonePairs > 0 ? `AX${bonded}E${lonePairs}` : `AX${bonded}`;
  const shape = SHAPE[key];
  if (!geo || !shape) return null;
  const notation = lonePairs === 0 ? `AX${bonded}` : lonePairs === 1 ? `AX${bonded}E` : `AX${bonded}E${lonePairs}`;
  return {
    domains, bonded, lonePairs, notation,
    electronGeometry: geo.name, molecularShape: shape, idealAngles: geo.angles,
    expectation: lonePairs > 0 && !SYMMETRIC_WITH_E.has(key) ? 'menor' : 'igual',
  };
}

export type VseprResult =
  | ({ ok: true; atom: number; valence: number; bondOrderSum: number; lonePairElectrons: number; hasMultipleBond: boolean } & VseprShape)
  | { ok: false; atom: number; reason: string };

/**
 * VSEPR de un átomo del archivo: pares libres = (electrones de valencia − carga formal − Σ órdenes de enlace) / 2.
 * No se clasifica si el átomo tiene menos de dos vecinos, enlaces aromáticos, es un radical o un elemento sin tabla.
 */
export function vseprAt(mol: Molecule, i: number): VseprResult {
  const ns = neighbors(mol, i);
  const at = mol.atoms[i];
  if (ns.length < 2) return { ok: false, atom: i, reason: `${at.label} está unido a ${ns.length} átomo${ns.length === 1 ? '' : 's'}: no es un átomo central.` };
  const valence = VALENCE_ELECTRONS[at.element];
  if (valence === undefined) return { ok: false, atom: i, reason: `No hay electrones de valencia tabulados para ${at.element}.` };
  if (at.radical) return { ok: false, atom: i, reason: `${at.label} es un radical: VSEPR básico no lo clasifica.` };
  const own = mol.bonds.filter((b) => b.a === i || b.b === i);
  if (own.some((b) => b.order === 4)) return { ok: false, atom: i, reason: `${at.label} tiene enlaces aromáticos: el archivo no fija órdenes enteros.` };
  const sum = own.reduce((s, b) => s + b.order, 0);
  const lone = valence - at.charge - sum;
  if (lone < 0 || lone % 2 !== 0) return { ok: false, atom: i, reason: `Los electrones no compartidos de ${at.label} (${lone}) no forman pares completos.` };
  const shape = vseprShape(ns.length, lone / 2);
  if (!shape) return { ok: false, atom: i, reason: `${at.label} tiene ${ns.length + lone / 2} dominios: fuera de las formas de VSEPR básico (2 a 6).` };
  return { ok: true, atom: i, valence, bondOrderSum: sum, lonePairElectrons: lone, hasMultipleBond: own.some((b) => b.order > 1), ...shape };
}

/** Átomo central por defecto: el que no es hidrógeno y tiene más vecinos (en empate, el primero del archivo). */
export function centralAtom(mol: Molecule): number {
  let best = -1, bestN = -1;
  for (const at of mol.atoms) {
    if (at.element === 'H') continue;
    const n = neighbors(mol, at.index).length;
    if (n > bestN) { best = at.index; bestN = n; }
  }
  return best < 0 ? 0 : best;
}

/** Átomos que pueden ser centro VSEPR (dos o más vecinos). */
export function centerCandidates(mol: Molecule): number[] {
  return mol.atoms.filter((a) => neighbors(mol, a.index).length >= 2).map((a) => a.index);
}

/** Ángulo ideal más cercano al medido entre los del poliedro de dominios. */
export function nearestIdeal(angle: number, ideals: number[]): number {
  return ideals.reduce((best, a) => (Math.abs(a - angle) < Math.abs(best - angle) ? a : best), ideals[0]);
}

export interface AngleComparison {
  measured: number;
  ideal: number;
  /** Medido − ideal, en grados (redondeado a 0,1°). */
  difference: number;
  verdict: string;
}

/** Compara un ángulo medido con el ideal VSEPR y redacta la conclusión cualitativa. */
export function compareWithVsepr(measured: number, v: VseprShape): AngleComparison {
  assertInRange('El ángulo medido', measured, 0, 180);
  const ideal = nearestIdeal(measured, v.idealAngles);
  const difference = roundToResolution(measured - ideal, RESOLUTION.angle);
  let verdict: string;
  if (v.expectation === 'menor') {
    verdict = difference < 0
      ? 'Menor que el ideal, como predice VSEPR: los pares libres ocupan más espacio que los pares de enlace.'
      : 'No es menor que el ideal: el confórmero no sigue aquí la predicción cualitativa de VSEPR.';
  } else {
    verdict = Math.abs(difference) <= 1
      ? 'Coincide con el ideal (diferencia de 1° o menos).'
      : `Se aparta del ideal en ${fmt(Math.abs(difference), 1)}°: los dominios no son equivalentes (por ejemplo, un enlace doble ocupa más espacio).`;
  }
  return { measured, ideal, difference, verdict };
}

export interface CenterAnalysis {
  center: number;
  vsepr: VseprResult;
  /** Ángulos alrededor del centro, sin redondear. */
  angles: AngleRow[];
  meanAngle: number | null;
  /** Suma de los ángulos alrededor de un centro con 3 vecinos (360° si es plano). */
  angleSum3: number | null;
}

export function analyzeCenter(mol: Molecule, center: number): CenterAnalysis {
  const vsepr = vseprAt(mol, center);
  const angles = angleTable(mol).filter((r) => r.v === center);
  const meanAngle = angles.length ? angles.reduce((s, r) => s + r.angle, 0) / angles.length : null;
  const angleSum3 = angles.length === 3 && neighbors(mol, center).length === 3 ? angles.reduce((s, r) => s + r.angle, 0) : null;
  return { center, vsepr, angles, meanAngle, angleSum3 };
}

/* ------------------------------------------------------------------ fórmula y descripción textual */

/** Fórmula a partir de los átomos del archivo, en orden de Hill (C, H y luego alfabético; sin C, todo alfabético). */
export function hillFormula(mol: Molecule): string {
  const count: Record<string, number> = {};
  for (const a of mol.atoms) count[a.element] = (count[a.element] ?? 0) + 1;
  const els = Object.keys(count);
  const order = count.C ? ['C', ...(count.H ? ['H'] : []), ...els.filter((e) => e !== 'C' && e !== 'H').sort()] : els.sort();
  return order.map((e) => `${e}${count[e] > 1 ? count[e] : ''}`).join('');
}

const ORDER_NAME: Record<SdfBond['order'], string> = { 1: 'sencillo', 2: 'doble', 3: 'triple', 4: 'aromático' };

/**
 * Descripción textual de la escena 3D para lectores de pantalla (prompt, sección 11). No revela distancias ni
 * ángulos: esos valores los obtiene el estudiante al medir.
 */
export function describeMolecule(mol: Molecule, name: string, cid: number | null, center: number): string {
  const elems = Object.entries(mol.atoms.reduce<Record<string, number>>((m, a) => ({ ...m, [a.element]: (m[a.element] ?? 0) + 1 }), {}))
    .map(([e, n]) => `${n} de ${e}`).join(', ');
  const bonds = mol.bonds.map((b) => `${mol.atoms[b.a].label}–${mol.atoms[b.b].label} (${ORDER_NAME[b.order]})`).join('; ');
  const v = vseprAt(mol, center);
  const vs = v.ok
    ? `Átomo central ${mol.atoms[center].label}: ${v.bonded} átomos unidos y ${v.lonePairs} par${v.lonePairs === 1 ? '' : 'es'} libre${v.lonePairs === 1 ? '' : 's'} (${v.notation}); VSEPR predice geometría electrónica ${v.electronGeometry} y forma ${v.molecularShape}.`
    : `Átomo central ${mol.atoms[center]?.label ?? '—'}: ${v.reason}`;
  return `${name}${cid ? ` (PubChem CID ${cid})` : ''}: ${mol.atoms.length} átomos (${elems}). Enlaces: ${bonds || 'ninguno'}. ${vs}`;
}

/* ------------------------------------------------------------------ consulta a PubChem (validación pura) */

export const PUBCHEM_REST = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

export type PubChemQuery = { kind: 'cid'; cid: number } | { kind: 'name'; name: string };

/**
 * Valida lo que escribe el estudiante: un CID («962» o «CID 962») o un nombre en inglés de hasta 60 caracteres
 * (letras, números, espacios y - , ( ) ' [ ]). Lanza RangeError con un mensaje claro si no es válido.
 */
export function parsePubChemQuery(input: string): PubChemQuery {
  const t = input.trim().replace(/\s+/g, ' ');
  if (t === '') throw new RangeError('Escribe un nombre (en inglés) o un número CID.');
  const cidMatch = /^(?:cid\s*)?(\d{1,10})$/i.exec(t);
  if (cidMatch) {
    const cid = Number(cidMatch[1]);
    if (cid < 1 || cid > 999_999_999) throw new RangeError('El CID debe ser un entero positivo.');
    return { kind: 'cid', cid };
  }
  if (t.length > 60) throw new RangeError('El nombre es demasiado largo (máximo 60 caracteres).');
  if (!/^[A-Za-z0-9 ,()'[\]-]+$/.test(t)) throw new RangeError('Usa solo letras sin tilde, números, espacios y - , ( ) \' [ ] (los nombres de PubChem están en inglés).');
  return { kind: 'name', name: t };
}

export const pubchemNameToCidUrl = (name: string) => `${PUBCHEM_REST}/compound/name/${encodeURIComponent(name)}/cids/TXT`;
export const pubchemSdf3dUrl = (cid: number) => `${PUBCHEM_REST}/compound/cid/${cid}/record/SDF?record_type=3d`;

/** Primer CID de la respuesta de texto de PUG REST (una línea por CID); null si no hay ninguno válido. */
export function firstCid(txt: string): number | null {
  const first = txt.trim().split(/\s+/)[0] ?? '';
  return /^\d{1,10}$/.test(first) && Number(first) > 0 ? Number(first) : null;
}

/* ------------------------------------------------------------------ ficha del modelo */

export const geometryModelSpec: ModelSpec = {
  name: 'Geometría molecular a partir de confórmeros 3D de PubChem y predicción VSEPR',
  inputs: [
    { symbol: 'molécula', name: 'Confórmero 3D de PubChem (archivo SDF V2000)', unit: '—', initial: 'agua (CID 962)' },
    { symbol: 'A, B', name: 'Átomos para medir una distancia (número del átomo en el archivo)', unit: '—', range: [1, SDF_LIMITS.maxAtoms], initial: 'O1 y H2' },
    { symbol: 'A, V, C', name: 'Átomos para medir un ángulo (V es el vértice)', unit: '—', range: [1, SDF_LIMITS.maxAtoms], initial: 'H2–O1–H3' },
    { symbol: 'central', name: 'Átomo central para la predicción VSEPR', unit: '—', initial: 'el no hidrógeno con más vecinos' },
  ],
  outputs: [
    { symbol: 'd', name: 'Distancia entre núcleos (redondeada a 0,001 Å)', unit: 'Å' },
    { symbol: 'θ', name: 'Ángulo A–V–C (redondeado a 0,1°)', unit: '°' },
    { symbol: 'AXₘEₙ', name: 'Notación VSEPR: m átomos unidos y n pares libres', unit: '—' },
    { symbol: 'θ_ideal', name: 'Ángulo ideal del poliedro de dominios', unit: '°' },
    { symbol: 'Δθ', name: 'Diferencia θ − θ_ideal', unit: '°' },
  ],
  equations: [
    'd = √[(x_B − x_A)² + (y_B − y_A)² + (z_B − z_A)²]',
    'θ = arccos[(u·v)/(|u|·|v|)], con u = r_A − r_V y v = r_C − r_V',
    'Pares libres del átomo central: n = (electrones de valencia − carga formal − Σ órdenes de enlace) / 2',
    'Número estérico (dominios) = m + n → 2 lineal (180°), 3 trigonal plana (120°), 4 tetraédrica (arccos(−1/3) ≈ 109,5°), 5 bipirámide trigonal (90° y 120°), 6 octaédrica (90°)',
    'VSEPR cualitativo: pares libres > enlaces múltiples > enlaces sencillos en espacio ocupado; cada par libre cierra los ángulos de enlace por debajo del ideal',
  ],
  initialConditions: ['Agua (PubChem CID 962), átomo central O1, ángulo H2–O1–H3.'],
  assumptions: [
    'Las coordenadas son las del confórmero 3D que PubChem calcula con OMEGA y el campo de fuerza MMFF94s: una predicción computacional, no una medición experimental.',
    'Los enlaces y sus órdenes son los del bloque de enlaces del archivo (estructura de Lewis de PubChem); no se deducen de las distancias.',
    'VSEPR trata cada enlace (sencillo, doble o triple) como un dominio y cada par no compartido como otro; solo predice tendencias cualitativas, no el valor exacto del ángulo.',
    'La carga formal se toma del archivo; los electrones de valencia, de la tabla periódica (grupos principales).',
  ],
  limits: [
    'PubChem3D solo calcula confórmeros de compuestos con H, C, N, O, F, Si, P, S, Cl, Br o I; por eso BF₃, PCl₅ y SF₆ no tienen confórmero 3D y no se incluyen.',
    'Según PubChem, cada confórmero calculado no está en un mínimo de energía; las distancias y ángulos pueden diferir de los experimentales (espectroscopia de microondas, difracción de electrones o de rayos X).',
    'VSEPR no explica por sí solo los ángulos cercanos a 90° de H₂S o PH₃, ni los átomos con enlaces aromáticos, radicales o metales de transición (se marcan como no clasificables).',
    'El lector admite solo el primer registro de archivos SDF V2000 de hasta 200 000 caracteres, 255 átomos y 300 enlaces.',
  ],
  testCases: [
    'Lector: una molécula de prueba escrita a mano da los átomos, enlaces, cargas «M  CHG» y campos de datos esperados; rechaza texto vacío, V3000, conteos imposibles, coordenadas no numéricas, enlaces a átomos inexistentes y archivos mayores que el límite.',
    'Distancia y ángulo calculados a mano: (0,0,0)–(3,4,0) = 5; ángulo de 90° entre los ejes; 180° en línea recta.',
    'Metano (CID 297): todos los ángulos H–C–H = 109,5° ± 0,5°. CO₂ (CID 280): 180° ± 0,5°.',
    'Formaldehído y eteno: la suma de los tres ángulos alrededor del carbono es 360° ± 0,5° (centro plano, ideal 120°).',
    'Agua (CID 962): AX₂E₂ y ángulo menor que 109,5°; amoníaco AX₃E; CO₂, etino y HCN AX₂; SO₂ AX₂E.',
    'Cada confórmero incluido tiene CID, URL de origen, fecha de descarga y su CID coincide con PUBCHEM_COMPOUND_CID del archivo.',
  ],
};

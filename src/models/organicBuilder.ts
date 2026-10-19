/**
 * Constructor de moléculas para el laboratorio de nomenclatura (reutilizable; ver docs/organica/README.md).
 *
 * El estudiante elige un esqueleto (cadena de 1 a 20 carbonos, cicloalcano de 3 a 8 o benceno), el orden de cada enlace del
 * esqueleto, los sustituyentes de cada posición y, si corresponde, la configuración cis/trans de los dobles enlaces de la cadena.
 * `buildMolecule()` convierte ese estado en un grafo (OMolecule) y explica por qué un estado no es válido (valencia).
 * La numeración del constructor (posición 1, 2, 3… del dibujo) NO es la numeración IUPAC: el motor la calcula aparte.
 *
 * Punto de extensión: SUBSTITUENTS es una tabla de fragmentos SMILES; para grupos funcionales basta agregar entradas
 * (p. ej. { id: 'oh', smiles: 'O' }) cuando el motor sepa nombrarlos.
 */
import { implicitH, parseSmiles, type DoubleBondStereo, type OMolecule } from './organicGraph';

export type Skeleton = { kind: 'cadena'; n: number } | { kind: 'anillo'; n: number } | { kind: 'benceno' };

export interface SubstituentDef {
  id: string;
  /** Nombre en el menú (español). */
  label: string;
  /** Fragmento SMILES; el átomo 0 se une al esqueleto. */
  smiles: string;
  /** Orden del enlace con el esqueleto. */
  bond: 1 | 2;
  /** Grupo del menú. */
  group: 'Alquilo' | 'Insaturado' | 'Anillo' | 'Halógeno';
}

export const SUBSTITUENTS: SubstituentDef[] = [
  { id: 'metil', label: 'metil (–CH₃)', smiles: 'C', bond: 1, group: 'Alquilo' },
  { id: 'etil', label: 'etil (–CH₂CH₃)', smiles: 'CC', bond: 1, group: 'Alquilo' },
  { id: 'propil', label: 'propil', smiles: 'CCC', bond: 1, group: 'Alquilo' },
  { id: 'isopropil', label: 'propan-2-il (isopropil)', smiles: 'C(C)C', bond: 1, group: 'Alquilo' },
  { id: 'butil', label: 'butil', smiles: 'CCCC', bond: 1, group: 'Alquilo' },
  { id: 'secbutil', label: 'butan-2-il (sec-butil)', smiles: 'C(C)CC', bond: 1, group: 'Alquilo' },
  { id: 'isobutil', label: '2-metilpropil (isobutil)', smiles: 'CC(C)C', bond: 1, group: 'Alquilo' },
  { id: 'tercbutil', label: 'terc-butil', smiles: 'C(C)(C)C', bond: 1, group: 'Alquilo' },
  { id: 'etenil', label: 'etenil (vinil, –CH=CH₂)', smiles: 'C=C', bond: 1, group: 'Insaturado' },
  { id: 'etinil', label: 'etinil (–C≡CH)', smiles: 'C#C', bond: 1, group: 'Insaturado' },
  { id: 'metiliden', label: 'metiliden (=CH₂)', smiles: 'C', bond: 2, group: 'Insaturado' },
  { id: 'ciclohexil', label: 'ciclohexil', smiles: 'C1CCCCC1', bond: 1, group: 'Anillo' },
  { id: 'fenil', label: 'fenil (–C₆H₅)', smiles: 'c1ccccc1', bond: 1, group: 'Anillo' },
  { id: 'F', label: 'fluoro (–F)', smiles: 'F', bond: 1, group: 'Halógeno' },
  { id: 'Cl', label: 'cloro (–Cl)', smiles: 'Cl', bond: 1, group: 'Halógeno' },
  { id: 'Br', label: 'bromo (–Br)', smiles: 'Br', bond: 1, group: 'Halógeno' },
  { id: 'I', label: 'yodo (–I)', smiles: 'I', bond: 1, group: 'Halógeno' },
];
export const substituentById = (id: string) => SUBSTITUENTS.find((s) => s.id === id);

export interface BuilderState {
  skeleton: Skeleton;
  /** Orden de cada enlace del esqueleto: cadena n−1 enlaces (i entre posición i e i+1), anillo n (el último cierra). Benceno: ignorado. */
  bondOrders: (1 | 2 | 3)[];
  /** Sustituyentes por posición del esqueleto (índice 0 = posición 1). */
  subs: string[][];
  /** Configuración de dobles enlaces de la cadena, por índice de enlace: relación entre los carbonos vecinos de la cadena. */
  stereo: Record<number, 'cis' | 'trans' | undefined>;
}

export const MAX_SKELETON = { cadena: 20, anillo: 8 } as const;

export function emptyState(skeleton: Skeleton = { kind: 'cadena', n: 4 }): BuilderState {
  const n = skeleton.kind === 'benceno' ? 6 : skeleton.n;
  const nb = skeleton.kind === 'cadena' ? Math.max(0, n - 1) : skeleton.kind === 'anillo' ? n : 6;
  return { skeleton, bondOrders: new Array(nb).fill(1), subs: Array.from({ length: n }, () => []), stereo: {} };
}

/** Cambia el esqueleto conservando lo que siga siendo válido. */
export function resizeState(s: BuilderState, skeleton: Skeleton): BuilderState {
  const e = emptyState(skeleton);
  const sameKind = s.skeleton.kind === skeleton.kind && skeleton.kind !== 'benceno';
  if (sameKind) {
    const keep = skeleton.kind === 'cadena' ? Math.min(e.bondOrders.length, s.bondOrders.length) : Math.min(e.bondOrders.length, s.bondOrders.length) - 1;
    for (let i = 0; i < keep; i++) e.bondOrders[i] = s.bondOrders[i];
  }
  e.subs = e.subs.map((_, i) => (i < s.subs.length ? [...s.subs[i]] : []));
  for (const [k, v] of Object.entries(s.stereo)) if (Number(k) < e.bondOrders.length && e.bondOrders[Number(k)] === 2) e.stereo[Number(k)] = v;
  // quita los sustituyentes que ya no caben (p. ej. un carbono que pasó a ser extremo o a tener un doble enlace)
  for (let p = 0; p < e.subs.length; p++) while (e.subs[p].length && usedValence(e, p) > 4) e.subs[p].pop();
  return e;
}

export interface BuildResult {
  mol: OMolecule | null;
  errors: string[];
  /** Átomo del grafo que corresponde a cada posición del esqueleto. */
  skeletonAtoms: number[];
  /** Átomos de cada sustituyente (por posición y orden). */
  substituentAtoms: number[][][];
}

const ringSize = (s: Skeleton) => (s.kind === 'benceno' ? 6 : s.n);

/** Valencia usada por el esqueleto en cada posición (enlaces del esqueleto + sustituyentes). */
export function usedValence(s: BuilderState, pos: number): number {
  const n = ringSize(s.skeleton);
  let v = 0;
  if (s.skeleton.kind === 'benceno') v = 3;
  else {
    const left = s.skeleton.kind === 'cadena' ? (pos > 0 ? s.bondOrders[pos - 1] : 0) : s.bondOrders[(pos - 1 + n) % n];
    const right = s.skeleton.kind === 'cadena' ? (pos < n - 1 ? s.bondOrders[pos] : 0) : s.bondOrders[pos];
    v = left + right;
  }
  for (const id of s.subs[pos] ?? []) v += substituentById(id)?.bond ?? 1;
  return v;
}

export function freeValence(s: BuilderState, pos: number): number { return 4 - usedValence(s, pos); }

/** ¿Se puede poner este orden en el enlace k sin pasar de 4 enlaces en sus dos carbonos? */
export function canSetBond(s: BuilderState, k: number, order: 1 | 2 | 3): boolean {
  if (s.skeleton.kind === 'benceno') return false;
  const n = ringSize(s.skeleton);
  const a = k, b = (k + 1) % n;
  const delta = order - s.bondOrders[k];
  if (s.skeleton.kind === 'anillo' && order === 3) return false; // anillos pequeños con triple: fuera del alcance
  return usedValence(s, a) + delta <= 4 && usedValence(s, b) + delta <= 4;
}

export function canAddSub(s: BuilderState, pos: number, id: string): boolean {
  const d = substituentById(id);
  if (!d) return false;
  return freeValence(s, pos) >= d.bond;
}

/** ¿El doble enlace k de la cadena puede ser cis/trans? (cada carbono con dos grupos distintos se decide luego con CIP). */
export function stereoPossible(s: BuilderState, k: number, mol?: OMolecule | null, atoms?: number[]): boolean {
  if (s.skeleton.kind !== 'cadena' || s.bondOrders[k] !== 2) return false;
  const n = s.skeleton.n;
  if (k === 0 || k === n - 2) {
    // un extremo de la cadena: necesita un sustituyente en ese extremo para tener dos grupos
    const end = k === 0 ? 0 : n - 1;
    if (!(s.subs[end] ?? []).length) return false;
  }
  if (mol && atoms) {
    const a = atoms[k], b = atoms[k + 1];
    if (implicitH(mol, a) === 2 || implicitH(mol, b) === 2) return false;
  }
  return true;
}

export function buildMolecule(s: BuilderState): BuildResult {
  const errors: string[] = [];
  const atoms: OMolecule['atoms'] = [];
  const bonds: OMolecule['bonds'] = [];
  const stereo: DoubleBondStereo[] = [];
  const n = ringSize(s.skeleton);
  const sk: number[] = [];
  for (let i = 0; i < n; i++) { atoms.push({ el: 'C' }); sk.push(i); }
  if (s.skeleton.kind === 'benceno') {
    for (let i = 0; i < 6; i++) bonds.push({ a: i, b: (i + 1) % 6, order: i % 2 === 0 ? 2 : 1 });
  } else {
    const nb = s.skeleton.kind === 'cadena' ? n - 1 : n;
    if (s.skeleton.kind === 'anillo' && n < 3) errors.push('Un anillo necesita al menos 3 carbonos.');
    for (let k = 0; k < nb; k++) bonds.push({ a: k, b: (k + 1) % n, order: s.bondOrders[k] ?? 1 });
  }
  const subAtoms: number[][][] = [];
  for (let p = 0; p < n; p++) {
    subAtoms.push([]);
    for (const id of s.subs[p] ?? []) {
      const d = substituentById(id);
      if (!d) { errors.push(`Sustituyente desconocido: ${id}.`); continue; }
      const frag = parseSmiles(d.smiles);
      const base = atoms.length;
      frag.atoms.forEach((a) => atoms.push({ el: a.el }));
      frag.bonds.forEach((b) => bonds.push({ a: base + b.a, b: base + b.b, order: b.order }));
      bonds.push({ a: p, b: base, order: d.bond });
      subAtoms[p].push(frag.atoms.map((_, k) => base + k));
    }
    const used = usedValence(s, p);
    if (used > 4) errors.push(`El carbono ${p + 1} tendría ${used} enlaces (máximo 4).`);
  }
  if (s.skeleton.kind === 'cadena') {
    for (const [k, rel] of Object.entries(s.stereo)) {
      const i = Number(k);
      if (!rel || s.bondOrders[i] !== 2) continue;
      const a = i, b = i + 1;
      // vecinos de referencia: el carbono anterior de la cadena (o el primer sustituyente en el extremo)
      const x = a > 0 ? a - 1 : subAtoms[a][0]?.[0];
      const y = b < n - 1 ? b + 1 : subAtoms[b][0]?.[0];
      if (x === undefined || y === undefined) continue;
      stereo.push({ a, b, x, y, relation: rel });
    }
  }
  const mol: OMolecule = { atoms, bonds, stereo };
  return { mol: errors.length ? null : mol, errors, skeletonAtoms: sk, substituentAtoms: subAtoms };
}

/** Texto corto del estado (para registros y ejercicios). */
export function describeState(s: BuilderState): string {
  const sk = s.skeleton.kind === 'benceno' ? 'benceno' : s.skeleton.kind === 'anillo' ? `anillo de ${s.skeleton.n} C` : `cadena de ${s.skeleton.n} C`;
  const bonds = s.skeleton.kind === 'benceno' ? '' : s.bondOrders.map((o, k) => (o > 1 ? `${o === 2 ? '=' : '≡'} en ${k + 1}-${k + 2 > ringSize(s.skeleton) ? 1 : k + 2}` : '')).filter(Boolean).join(', ');
  const subs = s.subs.map((l, p) => l.map((id) => `${substituentById(id)?.label.split(' ')[0]} en ${p + 1}`)).flat().join(', ');
  return [sk, bonds, subs].filter(Boolean).join('; ');
}

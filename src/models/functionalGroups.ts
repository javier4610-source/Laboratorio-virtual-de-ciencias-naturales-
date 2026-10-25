/**
 * GRUPOS FUNCIONALES ORGÁNICOS (modelo calculado sobre el grafo; prácticas «grupos-oxigenados», «grupos-nitrogenados» y
 * «reacciones-organicas»).
 *
 * Reconoce en un grafo molecular (src/models/organicGraph.ts, con hidrógenos implícitos o explícitos) los grupos característicos
 * de 11.º: ácido carboxílico, éster, amida, aldehído, cetona, alcohol, fenol, éter, amina, nitro y halógeno; clasifica alcoholes,
 * aminas y amidas (primario, secundario, terciario), cuenta donadores y aceptores de puentes de hidrógeno y da la prioridad de
 * los grupos para la nomenclatura (orden de clases de las Recomendaciones IUPAC 2013, P-41: ácidos > ésteres > amidas >
 * aldehídos > cetonas > alcoholes y fenoles > aminas; los éteres, los halógenos y el grupo nitro solo se citan como prefijos).
 *
 * Es un cálculo sobre la conectividad: no usa geometría ni consulta servicios.
 */
import { bondBetween, implicitH, neighbors, ringInfo, type OMolecule } from './organicGraph';

export type GroupKind = 'acido' | 'ester' | 'amida' | 'aldehido' | 'cetona' | 'alcohol' | 'fenol' | 'eter' | 'amina' | 'nitro' | 'halogeno' | 'urea';

export const GROUP_LABEL: Record<GroupKind, string> = {
  acido: 'Ácido carboxílico (–COOH)', ester: 'Éster (–COO–)', amida: 'Amida (–CONH–)', aldehido: 'Aldehído (–CHO)', cetona: 'Cetona (C=O)',
  alcohol: 'Alcohol (–OH en C sp³)', fenol: 'Fenol (–OH en un anillo aromático)', eter: 'Éter (C–O–C)', amina: 'Amina (–N<)',
  nitro: 'Nitro (–NO₂)', halogeno: 'Halógeno (–X)', urea: 'Urea (diamida del ácido carbónico)',
};

/** Fórmula del grupo para mostrar. */
export const GROUP_FORMULA: Record<GroupKind, string> = {
  acido: 'R–COOH', ester: 'R–COO–R′', amida: 'R–CO–NR′R″', aldehido: 'R–CHO', cetona: 'R–CO–R′', alcohol: 'R–OH', fenol: 'Ar–OH', eter: 'R–O–R′',
  amina: 'R–NH₂, R₂NH, R₃N', nitro: 'R–NO₂', halogeno: 'R–X', urea: 'H₂N–CO–NH₂',
};

/**
 * Prioridad de las clases como grupo principal (sufijo), Recomendaciones IUPAC 2013, P-41 (1 = la más alta). Los éteres, halógenos
 * y nitro no tienen sufijo: siempre son prefijos (prioridad 0 = no compite).
 */
export const SENIORITY: Record<GroupKind, number> = {
  acido: 1, ester: 2, amida: 3, aldehido: 4, cetona: 5, alcohol: 6, fenol: 6, amina: 7, urea: 3, eter: 0, nitro: 0, halogeno: 0,
};

/** Sufijo y prefijo de cada clase (Recomendaciones IUPAC 2013; en español, adaptación usual). */
export const SUFFIX_PREFIX: Record<GroupKind, { sufijo: string; prefijo: string }> = {
  acido: { sufijo: 'ácido …-oico (…-carboxílico)', prefijo: 'carboxi-' },
  ester: { sufijo: '…-oato de alquilo', prefijo: 'alcoxicarbonil- / aciloxi-' },
  amida: { sufijo: '…-amida (…-carboxamida)', prefijo: 'carbamoil- / acilamino-' },
  aldehido: { sufijo: '…-al (…-carbaldehído)', prefijo: 'oxo- / formil-' },
  cetona: { sufijo: '…-ona', prefijo: 'oxo-' },
  alcohol: { sufijo: '…-ol', prefijo: 'hidroxi-' },
  fenol: { sufijo: '…-ol (fenol)', prefijo: 'hidroxi-' },
  amina: { sufijo: '…-amina', prefijo: 'amino-' },
  eter: { sufijo: '— (no tiene sufijo)', prefijo: 'alcoxi- (metoxi-, etoxi-…)' },
  nitro: { sufijo: '— (no tiene sufijo)', prefijo: 'nitro-' },
  halogeno: { sufijo: '— (no tiene sufijo)', prefijo: 'fluoro-, cloro-, bromo-, yodo-' },
  urea: { sufijo: 'urea (nombre retenido)', prefijo: 'carbamoilamino-' },
};

export type Degree = 'metanol' | 'primario' | 'secundario' | 'terciario' | 'cuaternario';
export const DEGREE_LABEL: Record<Degree, string> = { metanol: 'caso especial (sin C vecinos)', primario: 'primario (1.º)', secundario: 'secundario (2.º)', terciario: 'terciario (3.º)', cuaternario: 'cuaternario' };

export interface FunctionalGroup {
  kind: GroupKind;
  /** Átomo característico: C del carbonilo (ácido, éster, amida, aldehído, cetona), O (alcohol, fenol, éter), N (amina, nitro) o X. */
  center: number;
  /** Átomos pesados que forman el grupo (para resaltarlo). */
  atoms: number[];
  /** Carbono que lleva el grupo (alcoholes, fenoles, aminas, nitro y halógenos). */
  carrier?: number;
  /** Alcoholes: según el carbono que lleva el –OH; aminas y amidas: según los C unidos al N. */
  degree?: Degree;
}

const isEl = (m: OMolecule, i: number, el: string) => m.atoms[i].el === el;
/** H unidos (explícitos como átomos o implícitos). */
export function hCount(m: OMolecule, i: number): number {
  return implicitH(m, i) + neighbors(m, i).filter((v) => m.atoms[v].el === 'H').length;
}
const heavy = (m: OMolecule, i: number) => neighbors(m, i).filter((v) => m.atoms[v].el !== 'H');

/** Átomos de anillos bencénicos (anillo de 6 C con enlaces alternados o marcados como aromáticos). */
export function aromaticAtoms(m: OMolecule): Set<number> {
  const out = new Set<number>();
  for (const r of ringInfo(m).rings) {
    if (r.length !== 6 || !r.every((a) => isEl(m, a, 'C'))) continue;
    let doubles = 0, arom = 0;
    for (let k = 0; k < 6; k++) { const b = bondBetween(m, r[k], r[(k + 1) % 6]); if (!b) { doubles = -99; break; } if (b.order === 2) doubles++; if (b.aromatic) arom++; }
    if (doubles === 3 || arom === 6) r.forEach((a) => out.add(a));
  }
  return out;
}

/** O doble enlazado (carbonilo) de un carbono, si existe. */
export function carbonylO(m: OMolecule, c: number): number | null {
  if (!isEl(m, c, 'C')) return null;
  for (const v of neighbors(m, c)) if (isEl(m, v, 'O') && bondBetween(m, c, v)!.order === 2 && heavy(m, v).length === 1) return v;
  return null;
}

/** ¿Es N de un grupo nitro (N unido a dos O)? */
export function isNitroN(m: OMolecule, n: number): boolean {
  return isEl(m, n, 'N') && neighbors(m, n).filter((v) => isEl(m, v, 'O')).length === 2;
}

/** Clase con el género correcto: «alcohol primario», «amina primaria», «amida primaria». */
export function degreeText(kind: GroupKind, d: Degree): string {
  if (kind !== 'amina' && kind !== 'amida') return DEGREE_LABEL[d];
  return ({ metanol: 'caso especial', primario: 'primaria (1.ª)', secundario: 'secundaria (2.ª)', terciario: 'terciaria (3.ª)', cuaternario: 'cuaternaria' } as Record<Degree, string>)[d];
}

const degreeOf = (nC: number): Degree => (nC <= 0 ? 'metanol' : nC === 1 ? 'primario' : nC === 2 ? 'secundario' : nC === 3 ? 'terciario' : 'cuaternario');

/** Reconoce todos los grupos funcionales de la molécula (cada átomo pertenece como mucho a un grupo «principal»). */
export function detectGroups(m: OMolecule): FunctionalGroup[] {
  const out: FunctionalGroup[] = [];
  const used = new Set<number>();
  const arom = aromaticAtoms(m);
  // 1) carbonilos
  m.atoms.forEach((a, c) => {
    if (a.el !== 'C') return;
    const o = carbonylO(m, c);
    if (o === null) return;
    const nb = heavy(m, c).filter((v) => v !== o);
    const singleO = nb.filter((v) => isEl(m, v, 'O') && bondBetween(m, c, v)!.order === 1);
    const singleN = nb.filter((v) => isEl(m, v, 'N') && bondBetween(m, c, v)!.order === 1 && !isNitroN(m, v));
    const cN = nb.filter((v) => isEl(m, v, 'C'));
    if (singleN.length === 2 && nb.length === 2) {
      out.push({ kind: 'urea', center: c, atoms: [c, o, ...singleN] });
      [c, o, ...singleN].forEach((x) => used.add(x));
      return;
    }
    if (singleO.length === 1 && singleN.length === 0) {
      const ox = singleO[0];
      const oNb = heavy(m, ox).filter((v) => v !== c);
      if (oNb.length === 0 && hCount(m, ox) >= 1) { out.push({ kind: 'acido', center: c, atoms: [c, o, ox] }); [c, o, ox].forEach((x) => used.add(x)); return; }
      if (oNb.length === 1 && isEl(m, oNb[0], 'C')) { out.push({ kind: 'ester', center: c, atoms: [c, o, ox] }); [c, o, ox].forEach((x) => used.add(x)); return; }
      return;
    }
    if (singleN.length === 1 && singleO.length === 0) {
      const n = singleN[0];
      const nC = heavy(m, n).filter((v) => v !== c && isEl(m, v, 'C')).length;
      out.push({ kind: 'amida', center: c, atoms: [c, o, n], degree: degreeOf(1 + nC) });
      [c, o, n].forEach((x) => used.add(x));
      return;
    }
    if (singleO.length || singleN.length) return;
    if (cN.length <= 1 && hCount(m, c) >= 1) { out.push({ kind: 'aldehido', center: c, atoms: [c, o] }); used.add(c); used.add(o); return; }
    if (cN.length === 2) { out.push({ kind: 'cetona', center: c, atoms: [c, o] }); used.add(c); used.add(o); }
  });
  // 2) O sencillos: alcoholes, fenoles y éteres
  m.atoms.forEach((a, o) => {
    if (a.el !== 'O' || used.has(o) || (a.charge ?? 0) !== 0) return;
    const nb = heavy(m, o);
    if (nb.some((v) => bondBetween(m, o, v)!.order !== 1)) return;
    if (nb.length === 1 && isEl(m, nb[0], 'C') && hCount(m, o) === 1) {
      const c = nb[0];
      if (arom.has(c)) out.push({ kind: 'fenol', center: o, carrier: c, atoms: [o] });
      else out.push({ kind: 'alcohol', center: o, carrier: c, atoms: [o], degree: degreeOf(heavy(m, c).filter((v) => isEl(m, v, 'C')).length) });
      used.add(o);
    } else if (nb.length === 2 && nb.every((v) => isEl(m, v, 'C') && carbonylO(m, v) === null)) {
      out.push({ kind: 'eter', center: o, atoms: [o] });
      used.add(o);
    }
  });
  // 3) N: nitro y aminas
  m.atoms.forEach((a, n) => {
    if (a.el !== 'N' || used.has(n)) return;
    if (isNitroN(m, n)) {
      const os = neighbors(m, n).filter((v) => isEl(m, v, 'O'));
      out.push({ kind: 'nitro', center: n, carrier: heavy(m, n).find((v) => isEl(m, v, 'C')), atoms: [n, ...os] });
      return;
    }
    const nb = heavy(m, n);
    if ((a.charge ?? 0) !== 0 || nb.some((v) => !isEl(m, v, 'C') || bondBetween(m, n, v)!.order !== 1)) return;
    if (nb.some((v) => carbonylO(m, v) !== null)) return;
    out.push({ kind: 'amina', center: n, carrier: nb[0], atoms: [n], degree: degreeOf(nb.length) });
  });
  // 4) halógenos
  m.atoms.forEach((a, x) => {
    if (!['F', 'Cl', 'Br', 'I'].includes(a.el)) return;
    out.push({ kind: 'halogeno', center: x, carrier: heavy(m, x)[0], atoms: [x] });
  });
  return out;
}

/** Grupo principal (el de mayor prioridad P-41) o null si solo hay éteres, halógenos o nitro. */
export function principalGroup(groups: FunctionalGroup[]): GroupKind | null {
  const cand = groups.filter((g) => SENIORITY[g.kind] > 0).sort((a, b) => SENIORITY[a.kind] - SENIORITY[b.kind]);
  return cand.length ? cand[0].kind : null;
}

export interface HBondCount { donors: number; acceptors: number; donorAtoms: number[]; acceptorAtoms: number[] }

/**
 * Donadores (H unidos a O o N) y aceptores (O y N con pares libres) de puentes de hidrógeno. Criterio de clase (Lipinski simplificado):
 * cada H en O–H o N–H es un donador; cada O y cada N de amina es aceptor. El N de una amida y el del grupo nitro no se cuentan como
 * aceptores (su par está deslocalizado por resonancia).
 */
export function hBondSites(m: OMolecule): HBondCount {
  const donorAtoms: number[] = [];
  const acceptorAtoms: number[] = [];
  let donors = 0;
  m.atoms.forEach((a, i) => {
    if (a.el !== 'O' && a.el !== 'N') return;
    const h = hCount(m, i);
    if (h > 0) { donors += h; donorAtoms.push(i); }
    const amideN = a.el === 'N' && heavy(m, i).some((v) => carbonylO(m, v) !== null);
    if (a.el === 'O' || (!amideN && !isNitroN(m, i) && (a.charge ?? 0) === 0)) acceptorAtoms.push(i);
  });
  return { donors, acceptors: acceptorAtoms.length, donorAtoms, acceptorAtoms };
}

/** Resumen de clasificación en español para un compuesto (p. ej. «alcohol secundario»). */
export function classify(m: OMolecule): { principal: GroupKind | null; texto: string; groups: FunctionalGroup[] } {
  const groups = detectGroups(m);
  const principal = principalGroup(groups);
  const parts = groups.filter((g) => g.kind !== 'halogeno').map((g) => {
    const base = GROUP_LABEL[g.kind].replace(/ \(.*$/, '').toLowerCase();
    return g.degree && g.degree !== 'metanol' && ['alcohol', 'amina', 'amida'].includes(g.kind) ? `${base} ${degreeText(g.kind, g.degree).split(' ')[0]}` : base;
  });
  const uniq = [...new Set(parts)];
  return { principal, groups, texto: uniq.length ? uniq.join(', ') : 'hidrocarburo' };
}

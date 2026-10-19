/**
 * MOTOR DE NOMENCLATURA ORGÁNICA (modelo calculado; API en docs/organica/README.md).
 *
 * Calcula el nombre sistemático de un hidrocarburo (o de un haloderivado) a partir de su grafo, en inglés y en español, siguiendo las
 * Recomendaciones IUPAC 2013 (Favre y Powell, «Nomenclature of Organic Chemistry. IUPAC Recommendations and Preferred Names 2013»,
 * RSC, 2014), con estas reglas implementadas:
 *  - Hidruro progenitor: si hay anillos, el anillo es progenitor aunque la cadena sea más larga (P-44.1.2.2, novedad de 2013); entre
 *    anillos, el de más átomos y luego el de más enlaces múltiples. Sin anillos, la cadena principal es la MÁS LARGA (P-44.3, novedad de
 *    2013: antes se prefería la cadena con más insaturaciones), luego la de más enlaces múltiples y la de más dobles enlaces.
 *  - Numeración y desempates (P-31.1.4 y P-45): localizadores más bajos para la valencia libre (en sustituyentes), para los enlaces
 *    múltiples en conjunto, para los dobles enlaces, mayor número de sustituyentes, localizadores más bajos para todos los prefijos, para
 *    el prefijo que se cita primero en orden alfabético y, al final, el nombre completo que va primero en orden alfanumérico (P-45.5).
 *  - Prefijos sustituyentes en orden alfabético (sin contar di-, tri-…, ni terc-/sec-; los prefijos compuestos se alfabetizan por su
 *    primera letra, incluida la de su multiplicador), multiplicadores di/tri/tetra… y bis/tris/tetrakis para prefijos sustituidos,
 *    paréntesis para prefijos con localizadores (p. ej. «4-(propan-2-il)heptano»), elisiones («pent-1-en-4-ino») y la «a» eufónica
 *    («buta-1,3-dieno»).
 *  - Sustituyentes: alquilo de cadena simple o ramificada por el método «-ano-ilo» (propan-2-ilo, butan-2-ilo, 2-metilpropilo…), terc-butilo,
 *    alquenilo/alquinilo (etenilo, prop-2-en-1-ilo, etinilo…), -ilideno (metilideno, etilideno…), cicloalquilo, fenilo, bencilo y halógenos.
 *  - Estereodescriptores E/Z de los dobles enlaces de la cadena principal con las reglas de prioridad CIP (número atómico con átomos
 *    duplicados para los enlaces múltiples).
 * En español, el orden alfabético se hace con los nombres en español (por eso «1-iodo-2-methylbutane» es «2-metil-1-yodobutano»).
 *
 * Fuera de alcance (devuelve { ok: false, motivo }): grupos funcionales con O, N, S… (punto de extensión: `CharacteristicGroup`),
 * cargas, sistemas de anillos fusionados, puenteados o espiro (salvo el naftaleno sin sustituir), estereocentros (R/S) y la
 * configuración de anillos (cis/trans en cicloalcanos).
 *
 * Validación: tests/unit/organicNomenclature.test.ts compara este motor con el «IUPACName» de PubChem (calculado con LexiChem TK de
 * OpenEye) para las estructuras de tests/fixtures/pubchem-nomenclatura.json; las diferencias legítimas están clasificadas allí.
 */
import {
  bondBetween, implicitH, isConnected, neighbors, parseSmiles, ringInfo, ATOMIC_NUMBER, type OMolecule,
} from './organicGraph';

export type Lang = 'en' | 'es';

/* ------------------------------------------------------------------ vocabulario */

const STEM_EN = ['', 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec', 'undec', 'dodec', 'tridec', 'tetradec', 'pentadec',
  'hexadec', 'heptadec', 'octadec', 'nonadec', 'icos', 'henicos', 'docos', 'tricos', 'tetracos', 'pentacos', 'hexacos', 'heptacos', 'octacos', 'nonacos', 'triacont'];
const STEM_ES = ['', 'met', 'et', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec', 'undec', 'dodec', 'tridec', 'tetradec', 'pentadec',
  'hexadec', 'heptadec', 'octadec', 'nonadec', 'icos', 'henicos', 'docos', 'tricos', 'tetracos', 'pentacos', 'hexacos', 'heptacos', 'octacos', 'nonacos', 'triacont'];
export const MAX_CHAIN = STEM_EN.length - 1;
const MULT = ['', '', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca', 'undeca', 'dodeca'];
const MULT_COMPLEX = ['', '', 'bis', 'tris', 'tetrakis', 'pentakis', 'hexakis', 'heptakis', 'octakis', 'nonakis', 'decakis'];
const HALO: Record<string, { en: string; es: string }> = { F: { en: 'fluoro', es: 'fluoro' }, Cl: { en: 'chloro', es: 'cloro' }, Br: { en: 'bromo', es: 'bromo' }, I: { en: 'iodo', es: 'yodo' } };

const V = {
  en: { ane: 'ane', ene: 'ene', yne: 'yne', yl: 'yl', ylidene: 'ylidene', ylidyne: 'ylidyne', an: 'an', cyclo: 'cyclo', benzene: 'benzene', phenyl: 'phenyl', benzyl: 'benzyl', tbutyl: 'tert-butyl', naphthalene: 'naphthalene' },
  es: { ane: 'ano', ene: 'eno', yne: 'ino', yl: 'il', ylidene: 'iliden', ylidyne: 'ilidin', an: 'an', cyclo: 'ciclo', benzene: 'benceno', phenyl: 'fenil', benzyl: 'bencil', tbutyl: 'terc-butil', naphthalene: 'naftaleno' },
};

/** Nombres retenidos de uso general (no son el nombre sistemático; se muestran como «nombre común aceptado»). */
const RETAINED: Record<string, { en: string; es: string; pin: boolean; note: string }> = {
  methylbenzene: { en: 'toluene', es: 'tolueno', pin: true, note: 'Nombre retenido: en 2013 «tolueno» es el nombre preferido IUPAC (sin sustitución).' },
  '1,2-dimethylbenzene': { en: 'o-xylene', es: 'o-xileno', pin: false, note: 'Nombre común aceptado solo en nomenclatura general.' },
  '1,3-dimethylbenzene': { en: 'm-xylene', es: 'm-xileno', pin: false, note: 'Nombre común aceptado solo en nomenclatura general.' },
  '1,4-dimethylbenzene': { en: 'p-xylene', es: 'p-xileno', pin: false, note: 'Nombre común aceptado solo en nomenclatura general.' },
  ethenylbenzene: { en: 'styrene', es: 'estireno', pin: false, note: 'Nombre común aceptado solo en nomenclatura general.' },
  '(propan-2-yl)benzene': { en: 'cumene', es: 'cumeno', pin: false, note: 'Nombre común; también «isopropilbenceno».' },
  ethyne: { en: 'acetylene', es: 'acetileno', pin: false, note: 'Nombre común aceptado en nomenclatura general; el preferido es «etino».' },
  ethene: { en: 'ethylene', es: 'etileno', pin: false, note: 'Nombre común; el preferido es «eteno».' },
  'prop-1-ene': { en: 'propylene', es: 'propileno', pin: false, note: 'Nombre común; el preferido es «prop-1-eno».' },
  'cycloocta-1,3,5,7-tetraene': { en: 'cyclooctatetraene', es: 'ciclooctatetraeno', pin: false, note: 'Nombre común; el sistemático cita los localizadores.' },
  trichloromethane: { en: 'chloroform', es: 'cloroformo', pin: false, note: 'Nombre común aceptado en nomenclatura general.' },
  '2-methylpropane': { en: 'isobutane', es: 'isobutano', pin: false, note: 'Nombre común; no se usa en nombres sistemáticos.' },
  '2-methylbutane': { en: 'isopentane', es: 'isopentano', pin: false, note: 'Nombre común; no se usa en nombres sistemáticos.' },
  '2,2-dimethylpropane': { en: 'neopentane', es: 'neopentano', pin: false, note: 'Nombre común; no se usa en nombres sistemáticos.' },
  '2,2,4-trimethylpentane': { en: 'isooctane', es: 'isooctano', pin: false, note: 'Nombre comercial (combustibles: «octanaje»).' },
};

/* ------------------------------------------------------------------ tipos de resultado */

export interface NamedSubstituent {
  /** Localizador en el progenitor. */
  locant: number;
  /** Átomo del progenitor al que se une. */
  parentAtom: number;
  /** Átomos del sustituyente. */
  atoms: number[];
  en: string; es: string;
}

export type ParentKind = 'cadena' | 'anillo' | 'benceno' | 'naftaleno';

export interface NameStep { titulo: string; texto: string }

export interface NameOk {
  ok: true;
  /** Nombre sistemático según las Recomendaciones IUPAC 2013, en inglés (el que se compara con PubChem). */
  en: string;
  /** El mismo nombre en español. */
  es: string;
  /** Si el nombre preferido es un nombre retenido (tolueno), aquí va el sistemático (metilbenceno). */
  sistematico?: { en: string; es: string };
  /** Nombre retenido (común) si existe: tolueno, xileno, estireno… */
  retenido?: { en: string; es: string; pin: boolean; nota: string };
  parent: { kind: ParentKind; atoms: number[]; size: number; en: string; es: string };
  /** Localizador de cada átomo del progenitor (átomo → número). */
  locants: Map<number, number>;
  substituents: NamedSubstituent[];
  /** Enlaces múltiples del progenitor: localizador y orden. */
  multiples: { locant: number; order: 2 | 3; atoms: [number, number] }[];
  stereo: { locant: number; descriptor: 'E' | 'Z' }[];
  /** Explicación de cada decisión, en español, para el estudiante. */
  pasos: NameStep[];
  /** Clase de compuesto para el estudiante. */
  clase: string;
  avisos: string[];
}
export interface NameFail { ok: false; motivo: string }
export type NameResult = NameOk | NameFail;

/* ------------------------------------------------------------------ punto de extensión para grupos funcionales */

/**
 * Grupo característico que puede citarse como sufijo o prefijo (alcoholes, aldehídos, cetonas, ácidos, aminas…).
 * HOY EL MOTOR NO REGISTRA NINGUNO: las moléculas con O, N o S devuelven «fuera de alcance». Para ampliarlo, un módulo nuevo debe:
 *  1) reconocer el grupo en el grafo (`detect`) y devolver el átomo de carbono que lo lleva;
 *  2) dar su sufijo («ol», «al», «one», «oic acid», «amine»…) y su prefijo («hydroxy», «oxo», «amino»…) en inglés y español;
 *  3) declarar su seniority (P-41) para elegir el grupo principal.
 * El motor ya trata la valencia libre de los sustituyentes como «grupo principal» en los criterios de numeración (P-31.1.4 c), que es
 * el mismo lugar que ocupará el sufijo; ver `Features.principal`.
 */
export interface CharacteristicGroup {
  id: string;
  seniority: number;
  suffix: { en: string; es: string };
  prefix: { en: string; es: string };
  detect: (m: OMolecule) => { carbon: number; atoms: number[] }[];
}
export const CHARACTERISTIC_GROUPS: CharacteristicGroup[] = [];

/* ------------------------------------------------------------------ utilidades */

/** Compara listas de localizadores por el primer punto de diferencia (menor es mejor). */
export function compareLocants(a: number[], b: number[]): number {
  const x = [...a].sort((p, q) => p - q), y = [...b].sort((p, q) => p - q);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}

/** Clave alfanumérica de un prefijo: primero las letras (sin terc-/sec- ni signos), luego los localizadores. */
function alphaKey(name: string, simple: boolean): string {
  let n = name.replace(/^[()]+/, '');
  if (simple) n = n.replace(/^(tert|terc|sec)-/, '');
  const letters = n.replace(/[^a-záéíóúñ]/gi, '').toLowerCase();
  const digits = n.replace(/[^0-9,]/g, '');
  return `${letters}\u0000${digits}`;
}

interface Prefix {
  en: string; es: string;
  /** Prefijo sin localizadores internos (metil, cloro, terc-butil, fenil, etenil…). */
  simple: boolean;
  /** Prefijo sustituido (lleva sus propios sustituyentes): se multiplica con bis/tris. */
  substituted: boolean;
  atoms: number[];
}


/** Une grupos de prefijos ya ordenados: «2,2-dimetil», «4-(propan-2-il)», «bis(2-metilpropil)». */
function assemblePrefixes(groups: { p: Prefix; locants: number[] }[], lang: Lang, omitLocants: boolean): string {
  const parts = groups.map(({ p, locants }) => {
    const nm = p[lang];
    const n = locants.length;
    const needParen = !p.simple || /\d/.test(nm);
    let part: string;
    if (n === 1) part = needParen ? `(${nm})` : nm;
    else if (p.substituted) part = `${MULT_COMPLEX[n] ?? `${n}-`}(${nm})`;
    else part = `${MULT[n] ?? `${n}-`}${needParen ? `(${nm})` : nm}`;
    return (omitLocants ? '' : `${[...locants].sort((x, y) => x - y).join(',')}-`) + part;
  });
  // entre dos prefijos va un guion solo si el segundo empieza con localizador
  return parts.reduce((acc, part, k) => (k === 0 ? part : acc + (/^\d/.test(part) ? '-' : '') + part), '');
}

/* ------------------------------------------------------------------ contexto */

interface Ctx {
  m: OMolecule;
  carbon: boolean[];
  inRing: boolean[];
  rings: number[][];
  ringOf: number[]; // índice del anillo de cada átomo (−1 si no)
  memo: Map<string, Prefix>;
}

function makeCtx(m: OMolecule): Ctx {
  const ri = ringInfo(m);
  const ringOf = new Array(m.atoms.length).fill(-1);
  ri.rings.forEach((r, k) => r.forEach((a) => { ringOf[a] = k; }));
  return { m, carbon: m.atoms.map((a) => a.el === 'C'), inRing: ri.atomInRing, rings: ri.rings, ringOf, memo: new Map() };
}

function isBenzeneRing(ctx: Ctx, ring: number[]): boolean {
  if (ring.length !== 6 || !ring.every((a) => ctx.carbon[a])) return false;
  let doubles = 0;
  for (let i = 0; i < 6; i++) { const b = bondBetween(ctx.m, ring[i], ring[(i + 1) % 6]); if (!b) return false; if (b.order === 2) doubles++; }
  return doubles === 3;
}

/* ------------------------------------------------------------------ candidatos y criterios */

interface Candidate {
  /** Átomos del progenitor en orden de numeración (posición k → localizador k+1). */
  atoms: number[];
  ring: boolean;
  benzene: boolean;
  /** En modo sustituyente: localizador de la valencia libre. */
  fv?: number;
  mult: { locant: number; order: 2 | 3; atoms: [number, number] }[];
  prefixes: { locant: number; parentAtom: number; p: Prefix }[];
}

/** Criterios en orden; devuelve <0 si a es mejor, >0 si b, 0 si empatan, y el índice del criterio que decidió. */
const CRITERIA_NAMES = [
  'tiene más átomos de carbono',
  'tiene más enlaces múltiples',
  'tiene más dobles enlaces',
  'la valencia libre del sustituyente lleva el localizador más bajo',
  'los enlaces múltiples llevan los localizadores más bajos',
  'los dobles enlaces llevan los localizadores más bajos',
  'tiene más sustituyentes',
  'los sustituyentes llevan los localizadores más bajos',
  'el sustituyente que se cita primero en orden alfabético lleva el localizador más bajo',
  'su nombre completo va primero en orden alfanumérico',
];

function compareCandidates(a: Candidate, b: Candidate, lang: Lang, fullName: (c: Candidate) => string): { cmp: number; criterion: number } {
  const steps: (() => number)[] = [
    () => b.atoms.length - a.atoms.length,
    () => b.mult.length - a.mult.length,
    () => b.mult.filter((x) => x.order === 2).length - a.mult.filter((x) => x.order === 2).length,
    () => (a.fv ?? 0) - (b.fv ?? 0),
    () => compareLocants(a.mult.map((x) => x.locant), b.mult.map((x) => x.locant)),
    () => compareLocants(a.mult.filter((x) => x.order === 2).map((x) => x.locant), b.mult.filter((x) => x.order === 2).map((x) => x.locant)),
    () => b.prefixes.length - a.prefixes.length,
    () => compareLocants(a.prefixes.map((x) => x.locant), b.prefixes.map((x) => x.locant)),
    () => {
      const order = (c: Candidate) => c.prefixes.slice().sort((x, y) => {
        const kx = alphaKey(x.p[lang], x.p.simple), ky = alphaKey(y.p[lang], y.p.simple);
        return kx < ky ? -1 : kx > ky ? 1 : x.locant - y.locant;
      }).map((x) => x.locant);
      const oa = order(a), ob = order(b);
      for (let i = 0; i < Math.min(oa.length, ob.length); i++) if (oa[i] !== ob[i]) return oa[i] - ob[i];
      return 0;
    },
    () => { const na = fullName(a), nb = fullName(b); return na < nb ? -1 : na > nb ? 1 : 0; },
  ];
  for (let k = 0; k < steps.length; k++) { const c = steps[k](); if (c !== 0) return { cmp: c, criterion: k }; }
  return { cmp: 0, criterion: -1 };
}

/* ------------------------------------------------------------------ sustituyentes (recursivo) */

function haloPrefix(el: string): Prefix | null {
  const h = HALO[el];
  return h ? { en: h.en, es: h.es, simple: true, substituted: false, atoms: [] } : null;
}

/** Átomos alcanzables desde root sin pasar por from. */
function branchAtoms(m: OMolecule, root: number, from: number): number[] {
  const seen = new Set([from, root]);
  const out = [root];
  const st = [root];
  while (st.length) { const u = st.pop()!; for (const v of neighbors(m, u)) if (!seen.has(v)) { seen.add(v); out.push(v); st.push(v); } }
  return out;
}

class Unsupported extends Error {}

/** Prefijos de los átomos de un progenitor (todo lo que cuelga de él). */
function prefixesFor(ctx: Ctx, parent: number[], exclude: Set<number>): { locant: number; parentAtom: number; p: Prefix }[] {
  const inParent = new Set(parent);
  const out: { locant: number; parentAtom: number; p: Prefix }[] = [];
  parent.forEach((a, k) => {
    for (const v of neighbors(ctx.m, a)) {
      if (inParent.has(v) || exclude.has(v)) continue;
      const el = ctx.m.atoms[v].el;
      let p: Prefix | null;
      if (el === 'C') p = substituentPrefix(ctx, v, a);
      else p = haloPrefix(el);
      if (!p) throw new Unsupported(`El átomo ${el} unido a la cadena no es un sustituyente que el motor sepa nombrar todavía.`);
      if (el !== 'C') p = { ...p, atoms: [v] };
      out.push({ locant: k + 1, parentAtom: a, p });
    }
  });
  return out;
}

function multiplesOf(ctx: Ctx, atoms: number[], ring: boolean, benzene: boolean) {
  const out: { locant: number; order: 2 | 3; atoms: [number, number] }[] = [];
  if (benzene) return out;
  const n = atoms.length;
  for (let k = 0; k < (ring ? n : n - 1); k++) {
    const a = atoms[k], b = atoms[(k + 1) % n];
    const bd = bondBetween(ctx.m, a, b)!;
    if (bd.order > 1) out.push({ locant: k + 1, order: bd.order as 2 | 3, atoms: [a, b] });
  }
  return out;
}

/** Caminos simples entre todos los pares de átomos de un conjunto acíclico (árbol). */
function treePaths(ctx: Ctx, nodes: number[]): number[][] {
  const set = new Set(nodes);
  const paths: number[][] = [];
  for (const s of nodes) {
    const prev = new Map<number, number>([[s, -1]]);
    const q = [s];
    while (q.length) { const u = q.shift()!; for (const v of neighbors(ctx.m, u)) if (set.has(v) && !prev.has(v)) { prev.set(v, u); q.push(v); } }
    for (const t of nodes) {
      if (t < s) continue;
      if (!prev.has(t)) continue;
      const p: number[] = [];
      for (let x = t; x !== -1; x = prev.get(x)!) p.push(x);
      paths.push(p.reverse());
    }
  }
  return paths;
}

function bestCandidate(cands: Candidate[], lang: Lang, fullName: (c: Candidate) => string): { best: Candidate; decided: Map<Candidate, number> } {
  let best = cands[0];
  for (const c of cands.slice(1)) if (compareCandidates(c, best, lang, fullName).cmp < 0) best = c;
  const decided = new Map<Candidate, number>();
  for (const c of cands) if (c !== best) decided.set(c, compareCandidates(best, c, lang, fullName).criterion);
  return { best, decided };
}

/** Prefijo de un sustituyente con carbono en `root`, unido al progenitor por el átomo `from`. */
function substituentPrefix(ctx: Ctx, root: number, from: number): Prefix {
  const key = `${root}<${from}`;
  const hit = ctx.memo.get(key);
  if (hit) return hit;
  const m = ctx.m;
  const order = bondBetween(m, root, from)!.order;
  const atoms = branchAtoms(m, root, from);
  let result: Prefix;
  if (ctx.inRing[root]) {
    result = ringSubstituent(ctx, root, from, order, atoms);
  } else {
    // cadena del sustituyente: carbonos acíclicos de la rama
    const acyclicC = atoms.filter((a) => ctx.carbon[a] && !ctx.inRing[a]);
    const paths = treePaths(ctx, acyclicC).filter((p) => p.includes(root));
    const cands: Candidate[] = [];
    for (const p of paths) for (const dir of p.length > 1 ? [p, [...p].reverse()] : [p]) {
      const exclude = new Set([from]);
      cands.push({ atoms: dir, ring: false, benzene: false, fv: dir.indexOf(root) + 1, mult: multiplesOf(ctx, dir, false, false), prefixes: prefixesFor(ctx, dir, exclude) });
    }
    const nameOf = (c: Candidate, lang: Lang) => chainSubstituentName(c, order, lang);
    const { best } = bestCandidate(cands, 'en', (c) => nameOf(c, 'en'));
    const bestEs = bestCandidate(cands, 'es', (c) => nameOf(c, 'es')).best;
    const en = nameOf(best, 'en'), es = nameOf(bestEs, 'es');
    result = { en, es, simple: best.prefixes.length === 0 && !/\d/.test(en), substituted: best.prefixes.length > 0, atoms };
    // nombres retenidos de prefijos (2013: terc-butil y bencil son prefijos preferidos sin sustituir)
    if (en === '2-methylpropan-2-yl') result = { en: V.en.tbutyl, es: V.es.tbutyl, simple: true, substituted: false, atoms };
    if (en === 'phenylmethyl') result = { en: V.en.benzyl, es: V.es.benzyl, simple: true, substituted: false, atoms };
  }
  ctx.memo.set(key, result);
  return result;
}

function unsaturationEnding(c: Candidate, lang: Lang, tail: 'ane' | 'yl'): { body: string; needsA: boolean } {
  const L = V[lang];
  const enes = c.mult.filter((x) => x.order === 2).map((x) => x.locant).sort((a, b) => a - b);
  const ynes = c.mult.filter((x) => x.order === 3).map((x) => x.locant).sort((a, b) => a - b);
  if (!enes.length && !ynes.length) return { body: '', needsA: false };
  const enePart = enes.length ? `${MULT[enes.length] ?? ''}${L.ene}` : '';
  const ynePart = ynes.length ? `${MULT[ynes.length] ?? ''}${L.yne}` : '';
  const vowelStart = (s: string) => /^[aeiouy]/.test(s);
  const parts: string[] = [];
  if (enes.length) {
    const next = ynes.length ? ynePart : tail === 'yl' ? L.yl : '';
    parts.push(`${enes.join(',')}-${next && vowelStart(next) ? enePart.slice(0, -1) : enePart}`);
  }
  if (ynes.length) {
    const next = tail === 'yl' ? L.yl : '';
    parts.push(`${ynes.join(',')}-${next && vowelStart(next) ? ynePart.slice(0, -1) : ynePart}`);
  }
  const first = enes.length ? enePart : ynePart;
  return { body: parts.join('-'), needsA: !vowelStart(first) };
}

function chainSubstituentName(c: Candidate, bondOrder: number, lang: Lang): string {
  const L = V[lang];
  const n = c.atoms.length;
  const stem = (lang === 'en' ? STEM_EN : STEM_ES)[n];
  if (!stem) throw new Unsupported(`Cadena de ${n} carbonos: el motor nombra cadenas de hasta ${MAX_CHAIN}.`);
  const yl = bondOrder === 1 ? L.yl : bondOrder === 2 ? L.ylidene : L.ylidyne;
  const unsat = unsaturationEnding(c, lang, 'yl');
  let core: string;
  if (!unsat.body) {
    core = c.fv === 1 ? `${stem}${yl}` : `${stem}${L.an}-${c.fv}-${yl}`;
  } else if (n === 2 && c.fv === 1 && bondOrder === 1) {
    // etenil, etinil (sin localizadores)
    core = `${stem}${unsat.body.replace(/^\d+-/, '').replace(/^(.*)$/, '$1')}${yl}`;
  } else {
    core = `${stem}${unsat.needsA ? 'a' : ''}-${unsat.body}-${c.fv}-${yl}`;
  }
  const groups = groupPrefixes(c.prefixes, lang);
  const pre = assemblePrefixes(groups, lang, false);
  return pre + core;
}

function ringSubstituent(ctx: Ctx, root: number, from: number, bondOrder: number, atoms: number[]): Prefix {
  const ring = ctx.rings[ctx.ringOf[root]];
  checkSimpleRing(ctx, ring);
  const benzene = isBenzeneRing(ctx, ring);
  const cands: Candidate[] = [];
  const k0 = ring.indexOf(root);
  for (const dir of [1, -1]) {
    const seq = ring.map((_, i) => ring[(k0 + dir * i + ring.length * 2) % ring.length]);
    cands.push({ atoms: seq, ring: true, benzene, fv: 1, mult: multiplesOf(ctx, seq, true, benzene), prefixes: prefixesFor(ctx, seq, new Set([from])) });
  }
  const nameOf = (c: Candidate, lang: Lang) => {
    const L = V[lang];
    const yl = bondOrder === 1 ? L.yl : bondOrder === 2 ? L.ylidene : L.ylidyne;
    let core: string;
    if (benzene) core = bondOrder === 1 ? L.phenyl : `${L.cyclo}hexa-2,4-dien-1-${yl}`;
    else {
      const stem = (lang === 'en' ? STEM_EN : STEM_ES)[c.atoms.length];
      const unsat = unsaturationEnding(c, lang, 'yl');
      core = unsat.body ? `${L.cyclo}${stem}${unsat.needsA ? 'a' : ''}-${unsat.body}-1-${yl}` : `${L.cyclo}${stem}${yl}`;
    }
    return assemblePrefixes(groupPrefixes(c.prefixes, lang), lang, false) + core;
  };
  const best = bestCandidate(cands, 'en', (c) => nameOf(c, 'en')).best;
  const bestEs = bestCandidate(cands, 'es', (c) => nameOf(c, 'es')).best;
  const en = nameOf(best, 'en');
  return { en, es: nameOf(bestEs, 'es'), simple: best.prefixes.length === 0 && !/\d/.test(en), substituted: best.prefixes.length > 0, atoms };
}

function checkSimpleRing(ctx: Ctx, ring: number[]) {
  if (!ring.every((a) => ctx.carbon[a])) throw new Unsupported('Anillos con heteroátomos (O, N, S…): fuera del alcance del motor.');
  // anillo fusionado o puenteado: algún átomo del anillo pertenece a otro anillo
  for (const a of ring) {
    const owners = ctx.rings.filter((r) => r.includes(a)).length;
    if (owners > 1) throw new Unsupported('Sistemas de anillos fusionados, puenteados o espiro: fuera del alcance del motor (salvo el naftaleno sin sustituir).');
  }
}

function groupPrefixes(list: { locant: number; p: Prefix }[], lang: Lang): { p: Prefix; locants: number[] }[] {
  const map = new Map<string, { p: Prefix; locants: number[] }>();
  for (const x of list) {
    const k = x.p[lang];
    const g = map.get(k);
    if (g) g.locants.push(x.locant); else map.set(k, { p: x.p, locants: [x.locant] });
  }
  return [...map.values()].sort((a, b) => {
    const ka = alphaKey(a.p[lang], a.p.simple), kb = alphaKey(b.p[lang], b.p.simple);
    return ka < kb ? -1 : ka > kb ? 1 : compareLocants(a.locants, b.locants);
  });
}

/* ------------------------------------------------------------------ CIP y E/Z */

/** Compara dos ramas por las reglas de prioridad CIP (regla 1a con duplicados). >0 si la rama de `a` tiene prioridad. */
export function cipCompare(m: OMolecule, center: number, a: number, b: number): number {
  interface Node { atom: number; z: number; parent: Node | null; dup: boolean; path: Set<number> }
  const Z = (i: number) => ATOMIC_NUMBER[m.atoms[i].el];
  const children = (n: Node): Node[] => {
    if (n.dup || n.z === 1 || n.atom < 0) return [];
    const out: Node[] = [];
    const prev = n.parent?.atom ?? center;
    for (const v of neighbors(m, n.atom)) {
      const bd = bondBetween(m, n.atom, v)!;
      if (v === prev) {
        // el enlace al padre: sus órdenes múltiples dan duplicados del padre
        for (let k = 1; k < bd.order; k++) out.push({ atom: v, z: Z(v), parent: n, dup: true, path: n.path });
        continue;
      }
      if (n.path.has(v)) { out.push({ atom: v, z: Z(v), parent: n, dup: true, path: n.path }); continue; }
      const path = new Set(n.path); path.add(v);
      out.push({ atom: v, z: Z(v), parent: n, dup: false, path });
      for (let k = 1; k < bd.order; k++) out.push({ atom: v, z: Z(v), parent: n, dup: true, path: n.path });
    }
    for (let k = 0; k < implicitH(m, n.atom); k++) out.push({ atom: -1, z: 1, parent: n, dup: true, path: n.path });
    // los duplicados tienen tres sustituyentes fantasma (z = 0): no se agregan (comparan como vacío)
    return out.sort((x, y) => y.z - x.z);
  };
  const rootA: Node = { atom: a, z: Z(a), parent: null, dup: false, path: new Set([center, a]) };
  const rootB: Node = { atom: b, z: Z(b), parent: null, dup: false, path: new Set([center, b]) };
  if (rootA.z !== rootB.z) return rootA.z - rootB.z;
  let la: Node[] = [rootA], lb: Node[] = [rootB];
  for (let depth = 0; depth < 25; depth++) {
    const ca = la.map((n) => children(n)), cb = lb.map((n) => children(n));
    // comparar conjunto por conjunto en el orden jerárquico
    const n = Math.max(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
      const sa = (ca[i] ?? []).map((x) => x.z), sb = (cb[i] ?? []).map((x) => x.z);
      for (let j = 0; j < Math.max(sa.length, sb.length); j++) {
        const d = (sa[j] ?? 0) - (sb[j] ?? 0);
        if (d !== 0) return d;
      }
    }
    la = ca.flat(); lb = cb.flat();
    if (!la.length && !lb.length) return 0;
  }
  return 0;
}

function ezDescriptor(m: OMolecule, a: number, b: number): 'E' | 'Z' | null {
  const st = m.stereo.find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a));
  if (!st) return null;
  const [A, B, X, Y] = st.a === a ? [st.a, st.b, st.x, st.y] : [st.b, st.a, st.y, st.x];
  const high = (center: number, other: number): number | null => {
    const nb = neighbors(m, center).filter((v) => v !== other);
    const h = implicitH(m, center);
    if (nb.length === 1) return h === 1 ? nb[0] : null; // un vecino pesado y un H: el pesado gana
    if (nb.length !== 2) return null;
    const c = cipCompare(m, center, nb[0], nb[1]);
    if (c === 0) return null;
    return c > 0 ? nb[0] : nb[1];
  };
  const hA = high(A, B), hB = high(B, A);
  if (hA === null || hB === null) return null;
  const sameAsRef = (hA === X) === (hB === Y);
  const cis = st.relation === 'cis' ? sameAsRef : !sameAsRef;
  return cis ? 'Z' : 'E';
}

/* ------------------------------------------------------------------ progenitor y nombre completo */

const CLASS_ES = (c: Candidate, hasHalo: boolean, ringKind: ParentKind): string => {
  const d = c.mult.filter((x) => x.order === 2).length, t = c.mult.filter((x) => x.order === 3).length;
  let base: string;
  if (ringKind === 'benceno' || ringKind === 'naftaleno') base = 'hidrocarburo aromático';
  else if (c.ring) base = d ? (d > 1 ? 'cicloalqueno (polieno cíclico)' : 'cicloalqueno') : 'cicloalcano';
  else base = d && t ? 'enino (alqueno y alquino)' : t ? (t > 1 ? 'alquino (diino o poliino)' : 'alquino') : d ? (d > 1 ? 'alqueno (dieno o polieno)' : 'alqueno') : 'alcano';
  return hasHalo ? `${base} halogenado (haluro orgánico)` : base;
};

function parentName(c: Candidate, lang: Lang): string {
  const L = V[lang];
  const n = c.atoms.length;
  const stem = (lang === 'en' ? STEM_EN : STEM_ES)[n];
  if (c.benzene) return L.benzene;
  if (!stem) throw new Unsupported(`Cadena de ${n} carbonos: el motor nombra cadenas de hasta ${MAX_CHAIN}.`);
  const unsat = unsaturationEnding(c, lang, 'ane');
  const cy = c.ring ? L.cyclo : '';
  if (!unsat.body) return `${cy}${stem}${L.ane}`;
  // eteno, etino; cicloalqueno con un solo doble enlace y sin sustituyentes: sin localizador
  const single = c.mult.length === 1;
  if (single && (n === 2 || (c.ring && c.prefixes.length === 0))) return `${cy}${stem}${c.mult[0].order === 2 ? L.ene : L.yne}`;
  return `${cy}${stem}${unsat.needsA ? 'a' : ''}-${unsat.body}`;
}

function omitPrefixLocants(c: Candidate): boolean {
  if (c.atoms.length === 1) return true;
  const saturatedRing = c.ring && (c.benzene || c.mult.length === 0);
  if (saturatedRing && c.prefixes.length === 1) return true;
  if (!c.ring && c.atoms.length === 2 && c.prefixes.length === 1) return true;
  return false;
}

function fullName(c: Candidate, lang: Lang, stereo: string): string {
  const groups = groupPrefixes(c.prefixes, lang);
  const pre = assemblePrefixes(groups, lang, omitPrefixLocants(c));
  // un prefijo que empieza con paréntesis queda bien («(propan-2-il)benceno»); la estereo va al inicio
  return (stereo ? `${stereo}-` : '') + pre + parentName(c, lang);
}

/** Nombra una molécula (grafo). Nunca lanza: devuelve { ok: false, motivo } si está fuera de alcance. */
export function nameMolecule(m: OMolecule): NameResult {
  try {
    return nameInternal(m);
  } catch (e) {
    if (e instanceof Unsupported) return { ok: false, motivo: e.message };
    throw e;
  }
}

/** Atajo: SMILES → nombre. */
export function nameSmiles(smiles: string): NameResult {
  try {
    return nameMolecule(parseSmiles(smiles));
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'SMILES no válido.' };
  }
}

function nameInternal(m: OMolecule): NameResult {
  if (!m.atoms.length) return { ok: false, motivo: 'La estructura está vacía.' };
  if (!isConnected(m)) return { ok: false, motivo: 'La estructura tiene fragmentos separados: une todos los átomos.' };
  const avisos: string[] = [];
  for (const [i, a] of m.atoms.entries()) {
    if (a.charge) return { ok: false, motivo: 'Iones (átomos con carga): fuera del alcance del motor de nomenclatura.' };
    if (!['C', 'F', 'Cl', 'Br', 'I'].includes(a.el)) {
      return { ok: false, motivo: a.el === 'H' ? 'Hidrógeno explícito: escribe la estructura sin H.' : `Grupos funcionales con ${a.el}: aún no los nombra este motor (está preparado para ampliarse; ver CharacteristicGroup).` };
    }
    if (a.el !== 'C' && neighbors(m, i).length !== 1) return { ok: false, motivo: `El ${a.el} debe estar unido a un solo átomo.` };
    if (a.el === 'C') {
      const used = neighbors(m, i).reduce((s, v) => s + bondBetween(m, i, v)!.order, 0);
      if (used > 4) return { ok: false, motivo: 'Un carbono tiene más de cuatro enlaces.' };
    }
  }
  const ctx = makeCtx(m);
  const carbons = m.atoms.map((_, i) => i).filter((i) => ctx.carbon[i]);
  if (!carbons.length) return { ok: false, motivo: 'La estructura no tiene carbono.' };
  const pasos: NameStep[] = [];
  const hasHalo = m.atoms.some((a) => a.el !== 'C');

  // naftaleno sin sustituir
  if (ctx.rings.length >= 2) {
    const ringC = carbons.filter((a) => ctx.inRing[a]);
    if (ctx.rings.length === 2 && carbons.length === 10 && ringC.length === 10 && m.atoms.length === 10 && m.bonds.length === 11
      && m.bonds.filter((b) => b.order === 2).length === 5 && carbons.every((a) => implicitH(m, a) === (neighbors(m, a).length === 3 ? 0 : 1))) {
      const shared = ctx.rings[0].filter((a) => ctx.rings[1].includes(a));
      if (shared.length === 2) {
        return {
          ok: true, en: V.en.naphthalene, es: V.es.naphthalene,
          parent: { kind: 'naftaleno', atoms: carbons, size: 10, en: V.en.naphthalene, es: V.es.naphthalene },
          locants: new Map(), substituents: [], multiples: [], stereo: [], clase: 'hidrocarburo aromático policíclico',
          pasos: [{ titulo: 'Progenitor', texto: 'Dos anillos de benceno fusionados (comparten un enlace): naftaleno, nombre retenido. La numeración del naftaleno es fija (no se calcula aquí).' }],
          avisos: [],
        };
      }
    }
  }

  let cands: Candidate[] = [];
  let kind: ParentKind = 'cadena';
  if (ctx.rings.length) {
    // anillo progenitor: el de más átomos y luego el de más enlaces múltiples (benceno cuenta como 3)
    const ringsOk = ctx.rings.map((r) => { checkSimpleRing(ctx, r); return r; });
    const score = (r: number[]) => [r.length, isBenzeneRing(ctx, r) ? 3 : multiplesOf(ctx, r, true, false).length];
    const best = ringsOk.slice().sort((x, y) => { const a = score(x), b = score(y); return b[0] - a[0] || b[1] - a[1]; });
    const top = score(best[0]);
    const tied = best.filter((r) => { const s = score(r); return s[0] === top[0] && s[1] === top[1]; });
    for (const ring of tied) {
      const benzene = isBenzeneRing(ctx, ring);
      for (let k0 = 0; k0 < ring.length; k0++) for (const dir of [1, -1]) {
        const seq = ring.map((_, i) => ring[(k0 + dir * i + ring.length * 2) % ring.length]);
        cands.push({ atoms: seq, ring: true, benzene, mult: multiplesOf(ctx, seq, true, benzene), prefixes: prefixesFor(ctx, seq, new Set()) });
      }
    }
    kind = cands[0].benzene ? 'benceno' : 'anillo';
    const others = ctx.rings.length - 1;
    pasos.push({
      titulo: '1. Hidruro progenitor',
      texto: `La molécula tiene ${ctx.rings.length === 1 ? 'un anillo' : `${ctx.rings.length} anillos`}: según las Recomendaciones IUPAC 2013 el anillo es el progenitor aunque haya cadenas más largas${kind === 'benceno' ? ' (aquí, el benceno)' : ''}; las cadenas se nombran como sustituyentes${others ? '; entre varios anillos se prefiere el de más átomos y, si empatan, el de más enlaces múltiples' : ''}.`,
    });
  } else {
    const paths = treePaths(ctx, carbons);
    for (const p of paths) for (const dir of p.length > 1 ? [p, [...p].reverse()] : [p]) {
      cands.push({ atoms: dir, ring: false, benzene: false, mult: multiplesOf(ctx, dir, false, false), prefixes: prefixesFor(ctx, dir, new Set()) });
    }
  }

  // estereodescriptores dependen de la numeración: se calculan por candidato
  const stereoOf = (c: Candidate) => {
    const list: { locant: number; descriptor: 'E' | 'Z' }[] = [];
    if (!c.ring) for (const x of c.mult) if (x.order === 2) { const d = ezDescriptor(m, x.atoms[0], x.atoms[1]); if (d) list.push({ locant: x.locant, descriptor: d }); }
    return list;
  };
  const stereoText = (c: Candidate) => {
    const s = stereoOf(c);
    if (!s.length) return '';
    return s.length === 1 ? `(${s[0].descriptor})` : `(${s.map((x) => `${x.locant}${x.descriptor}`).join(',')})`;
  };
  const nameOf = (c: Candidate, lang: Lang) => fullName(c, lang, stereoText(c));
  const pickEn = bestCandidate(cands, 'en', (c) => nameOf(c, 'en'));
  const pickEs = bestCandidate(cands, 'es', (c) => nameOf(c, 'es'));
  const best = pickEn.best;
  const en = nameOf(best, 'en');
  const es = nameOf(pickEs.best, 'es');

  // estereo de dobles enlaces fuera del progenitor: aviso
  const parentBonds = new Set(best.mult.map((x) => x.atoms.slice().sort((a, b) => a - b).join('-')));
  for (const s of m.stereo) if (!parentBonds.has([s.a, s.b].sort((a, b) => a - b).join('-'))) avisos.push('Hay un doble enlace con configuración fuera de la cadena principal: el motor no cita su descriptor E/Z.');
  for (const x of best.mult) if (x.order === 2 && !best.ring && !m.stereo.some((s) => (s.a === x.atoms[0] && s.b === x.atoms[1]) || (s.a === x.atoms[1] && s.b === x.atoms[0]))) {
    const A = x.atoms[0], B = x.atoms[1];
    const two = (c: number, o: number) => { const nb = neighbors(m, c).filter((v) => v !== o); return nb.length === 2 ? cipCompare(m, c, nb[0], nb[1]) !== 0 : nb.length === 1 && implicitH(m, c) === 1; };
    if (two(A, B) && two(B, A)) avisos.push(`El doble enlace en la posición ${x.locant} puede ser E o Z (isomería geométrica); la estructura no indica cuál, así que el nombre no lleva descriptor.`);
  }

  // pasos para el estudiante
  if (!ctx.rings.length) {
    const sameLength = cands.filter((c) => c.atoms.length === best.atoms.length);
    const chainsMax = new Set(sameLength.map((c) => [...c.atoms].sort((a, b) => a - b).join(','))).size;
    const decidedChain = [...pickEn.decided.entries()].filter(([c]) => c.atoms.length === best.atoms.length && [...c.atoms].sort().join() !== [...best.atoms].sort().join()).map(([, k]) => k);
    const crit = decidedChain.length ? Math.min(...decidedChain.filter((k) => k > 0), 99) : 99;
    pasos.push({
      titulo: '1. Cadena principal',
      texto: best.atoms.length === 1 ? 'Un solo carbono: metano.' : `La cadena más larga tiene ${best.atoms.length} carbonos (raíz «${STEM_ES[best.atoms.length]}-»).` +
        (chainsMax > 1 ? ` Hay ${chainsMax} cadenas posibles de esa longitud; ${crit < 99 ? (CRITERIA_NAMES[crit].startsWith('tiene') || CRITERIA_NAMES[crit].startsWith('su ') ? `se elige la que ${CRITERIA_NAMES[crit]}` : `se elige aquella en la que ${CRITERIA_NAMES[crit]}`) : 'todas dan el mismo nombre (son equivalentes)'}.` : ' Es la única cadena de esa longitud.') +
        (m.bonds.some((b) => b.order > 1 && ctx.carbon[b.a] && ctx.carbon[b.b]) ? ' Desde 2013 la cadena principal es la más larga aunque no contenga todos los enlaces múltiples (antes se elegía la que tuviera más).' : ''),
    });
  }
  if (best.atoms.length > 1) {
    const rev = cands.filter((c) => c !== best && [...c.atoms].sort().join() === [...best.atoms].sort().join());
    const ks = rev.map((c) => pickEn.decided.get(c) ?? -1).filter((k) => k >= 0);
    const k = ks.length ? Math.min(...ks) : -1;
    pasos.push({
      titulo: '2. Numeración',
      texto: k < 0 || k === 9
        ? 'Cualquier sentido de numeración da los mismos localizadores.'
        : `Se numera en el sentido (y desde el átomo) en que ${CRITERIA_NAMES[k]}. Localizadores: ${best.mult.length ? `enlaces múltiples ${best.mult.map((x) => x.locant).join(', ')}` : ''}${best.mult.length && best.prefixes.length ? '; ' : ''}${best.prefixes.length ? `sustituyentes ${best.prefixes.map((x) => x.locant).sort((a, b) => a - b).join(', ')}` : ''}.`,
    });
  }
  const groupsEs = groupPrefixes(pickEs.best.prefixes, 'es');
  if (groupsEs.length) {
    pasos.push({
      titulo: '3. Sustituyentes',
      texto: groupsEs.map((g) => `${g.p.es} en ${g.locants.sort((a, b) => a - b).join(', ')}${g.locants.length > 1 ? ` (×${g.locants.length}: prefijo «${g.p.substituted ? MULT_COMPLEX[g.locants.length] : MULT[g.locants.length]}»)` : ''}`).join('; ') +
        `. Se escriben en orden alfabético${groupsEs.length > 1 ? ` (${groupsEs.map((g) => g.p.es).join(', ')})` : ''}, sin contar los multiplicadores di-, tri-… ni «terc-».`,
    });
  }
  const st = stereoOf(best);
  if (st.length) pasos.push({ titulo: '4. Isomería geométrica', texto: `Doble enlace con configuración ${st.map((x) => `${x.descriptor} en ${x.locant}`).join(', ')}: Z si los grupos de mayor prioridad (reglas CIP: mayor número atómico) quedan del mismo lado; E si quedan en lados opuestos.` });
  pasos.push({ titulo: st.length ? '5. Nombre' : groupsEs.length ? '4. Nombre' : '3. Nombre', texto: `${es} (en inglés: ${en}).` });

  const retained = RETAINED[en];
  const loc = new Map<number, number>();
  best.atoms.forEach((a, k) => loc.set(a, k + 1));
  const pin = retained?.pin;
  return {
    ok: true, en: pin ? retained.en : en, es: pin ? retained.es : es,
    sistematico: pin ? { en, es } : undefined,
    retenido: retained && !/^\([0-9EZ,]+\)-/.test(en) ? { en: retained.en, es: retained.es, pin: retained.pin, nota: retained.note } : undefined,
    parent: { kind, atoms: best.atoms, size: best.atoms.length, en: parentName(best, 'en'), es: parentName(pickEs.best, 'es') },
    locants: loc,
    substituents: best.prefixes.map((x) => ({ locant: x.locant, parentAtom: x.parentAtom, atoms: x.p.atoms, en: x.p.en, es: x.p.es })),
    multiples: best.mult,
    stereo: st,
    pasos,
    clase: CLASS_ES(best, hasHalo, kind),
    avisos: [...new Set(avisos)],
  };
}

/* ------------------------------------------------------------------ comparación con otros nombres (validación y ejercicios) */

/**
 * Normaliza un nombre para compararlo con otra convención: minúsculas, sin espacios, y opcionalmente sin paréntesis (LexiChem escribe
 * «4-propan-2-ylheptane» donde 2013 pide «4-(propan-2-yl)heptane»).
 */
export function normalizeName(name: string, { dropParens = false } = {}): string {
  let s = name.trim().toLowerCase().replace(/\s+/g, '');
  if (dropParens) s = s.replace(/[()[\]]/g, '');
  return s;
}

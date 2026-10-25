/**
 * MOTOR DE NOMENCLATURA DE FUNCIONES ORGÁNICAS (modelo calculado; prácticas «grupos-oxigenados», «grupos-nitrogenados»).
 *
 * Amplía el motor de hidrocarburos (src/models/organicNomenclature.ts, que se usa sin modificar para las moléculas que solo tienen
 * C, H y halógenos) a la nomenclatura sustitutiva con grupo principal, en inglés y en español, siguiendo las Recomendaciones IUPAC
 * 2013 (Favre y Powell, «Nomenclature of Organic Chemistry. IUPAC Recommendations and Preferred Names 2013», RSC, 2014):
 *  - Grupo principal por el orden de clases (P-41): ácido > éster > amida > aldehído > cetona > alcohol/fenol > amina. Los grupos de
 *    menor prioridad se citan como prefijos: hidroxi, oxo, amino (y alquilamino), alcoxi, aciloxi, acilamino (acetamido…), nitro, halógenos.
 *  - Progenitor (P-44): 1) el que lleva más grupos principales; 2) un anillo antes que una cadena (novedad de 2013); 3) el anillo con
 *    más átomos o la cadena más larga; 4) más enlaces múltiples y más dobles enlaces.
 *  - Numeración (P-31.1.4): localizadores más bajos para el grupo principal (sufijo), luego para los enlaces múltiples en conjunto, para
 *    los dobles enlaces, para todos los prefijos y para el prefijo que se cita primero en orden alfabético.
 *  - Sufijos: -oic acid / -carboxylic acid, -oate (ésteres «alquil …-oato»), -amide / -carboxamide, -al / -carbaldehyde, -one, -ol,
 *    -amine, con multiplicadores (diol, dioic acid…), elisión de la «e» («propan-2-ol», pero «etano-1,2-diol»), sustituyentes en el
 *    N («N,N-dimetil…») y nombres retenidos que 2013 acepta como preferidos: ácido fórmico, acético, oxálico y benzoico, formaldehído,
 *    acetaldehído, benzaldehído, formamida, acetamida, benzamida, fenol, anilina y urea.
 * Fuera de alcance (devuelve { ok: false, motivo }): anillos con heteroátomos, sistemas fusionados, anhídridos, haluros de ácido,
 * nitrilos, más de un grupo éster, estereodescriptores R/S y grupos principales dentro de un sustituyente (carboxi-, carbamoil-…).
 *
 * Validación: tests/unit/functionalNomenclature.test.ts compara el nombre en inglés con el «IUPACName» de PubChem (LexiChem TK, de
 * OpenEye) para las estructuras de tests/fixtures/funcionales-nomenclatura.json; cada diferencia legítima está clasificada allí.
 */
import { bondBetween, implicitH, isConnected, neighbors, parseSmiles, ringInfo, stripHydrogens, type OMolecule } from './organicGraph';
import { nameMolecule, compareLocants, normalizeName, type NameStep } from './organicNomenclature';
import { aromaticAtoms, carbonylO, detectGroups, hCount, isNitroN, principalGroup, SENIORITY, type FunctionalGroup, type GroupKind } from './functionalGroups';

export type Lang = 'en' | 'es';

const STEM: Record<Lang, string[]> = {
  en: ['', 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec', 'undec', 'dodec', 'tridec', 'tetradec', 'pentadec', 'hexadec', 'heptadec', 'octadec', 'nonadec', 'icos'],
  es: ['', 'met', 'et', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec', 'undec', 'dodec', 'tridec', 'tetradec', 'pentadec', 'hexadec', 'heptadec', 'octadec', 'nonadec', 'icos'],
};
const MAXC = STEM.en.length - 1;
const MULT = ['', '', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
const MULT_COMPLEX = ['', '', 'bis', 'tris', 'tetrakis', 'pentakis', 'hexakis'];
const HALO: Record<string, Record<Lang, string>> = { F: { en: 'fluoro', es: 'fluoro' }, Cl: { en: 'chloro', es: 'cloro' }, Br: { en: 'bromo', es: 'bromo' }, I: { en: 'iodo', es: 'yodo' } };

class Unsupported extends Error {}

/* ------------------------------------------------------------------ tipos */

type Loc = number | 'N';

interface Prefix {
  en: string; es: string;
  /** Sin localizadores internos ni sustituyentes (metil, hidroxi, acetamido…). */
  simple: boolean;
  /** Prefijo sustituido (lleva prefijos propios): se multiplica con bis/tris. */
  substituted: boolean;
  atoms: number[];
}

interface PlacedPrefix { locant: Loc; parentAtom: number; p: Prefix }

type SuffixKind = 'acido' | 'ester' | 'amida' | 'aldehido' | 'cetona' | 'alcohol' | 'amina';

interface Candidate {
  atoms: number[];
  ring: boolean;
  benzene: boolean;
  /** Localizador de la valencia libre (solo en sustituyentes). */
  fv?: number;
  mult: { locant: number; order: 2 | 3; atoms: [number, number] }[];
  /** Localizadores del grupo principal (un elemento por grupo; el C del grupo externo en anillos usa el átomo del anillo). */
  principal: number[];
  /** El grupo principal es externo al anillo (…-carboxylic acid, …-carbaldehyde, …-carboxamide, …-carboxylate). */
  external: boolean;
  prefixes: PlacedPrefix[];
}

export interface FunctionalNameOk {
  ok: true;
  en: string; es: string;
  /** Clase del grupo principal (o null si es un hidrocarburo, un haluro o un nitroderivado). */
  principal: GroupKind | null;
  /** Átomos del progenitor (cadena o anillo) en orden de numeración. */
  parentAtoms: number[];
  parentKind: 'cadena' | 'anillo' | 'benceno';
  /** Localizador de cada átomo del progenitor. */
  locants: Map<number, number>;
  /** Átomos de los grupos que nombra el sufijo. */
  principalAtoms: number[];
  /** Átomos de cada prefijo con su nombre en español. */
  prefixes: { locant: string; es: string; atoms: number[] }[];
  pasos: NameStep[];
  /** Nombre común aceptado (acetona, glicerol, anisol…), si lo hay. */
  comun?: string;
  avisos: string[];
  groups: FunctionalGroup[];
}
export interface FunctionalNameFail { ok: false; motivo: string }
export type FunctionalNameResult = FunctionalNameOk | FunctionalNameFail;

/* ------------------------------------------------------------------ contexto */

interface Ctx {
  m: OMolecule;
  rings: number[][];
  ringOf: number[];
  inRing: boolean[];
  arom: Set<number>;
  groups: FunctionalGroup[];
  principalKind: SuffixKind | null;
  /** Grupos principales (instancias) con su «sitio». */
  sites: { g: FunctionalGroup; carbon: number; carriers: number[] }[];
  /** Átomos excluidos de los prefijos (pertenecen al grupo principal o a la parte alcohólica de un éster). */
  excluded: Set<number>;
  /** En los ésteres: raíz de la parte alquílica (C unido al O) y el O. */
  ester?: { o: number; alkylRoot: number; cg: number };
  memo: Map<string, Prefix>;
}

const isC = (ctx: Ctx, i: number) => ctx.m.atoms[i].el === 'C';
const heavyNb = (m: OMolecule, i: number) => neighbors(m, i).filter((v) => m.atoms[v].el !== 'H');

function branchAtoms(m: OMolecule, root: number, from: number): number[] {
  const seen = new Set([from, root]);
  const out = [root];
  const st = [root];
  while (st.length) { const u = st.pop()!; for (const v of heavyNb(m, u)) if (!seen.has(v)) { seen.add(v); out.push(v); st.push(v); } }
  return out;
}

/* ------------------------------------------------------------------ utilidades de nombres */

function alphaKey(name: string, simple: boolean): string {
  let n = name.replace(/^[()[\]{}]+/, '');
  if (simple) n = n.replace(/^(tert|terc|sec)-/, '');
  return n.replace(/[^a-záéíóúñ]/gi, '').toLowerCase();
}

/** Encierra un prefijo compuesto: ( ), y [ ] si ya tiene paréntesis, { } si ya tiene corchetes. */
function enclose(s: string): string {
  if (s.includes('[')) return `{${s}}`;
  if (s.includes('(')) return `[${s}]`;
  return `(${s})`;
}

const locStr = (ls: Loc[]) => [...ls].sort((a, b) => (a === 'N' ? (b === 'N' ? 0 : -1) : b === 'N' ? 1 : a - b)).join(',');

function groupPrefixes(list: PlacedPrefix[], lang: Lang): { p: Prefix; locants: Loc[] }[] {
  const map = new Map<string, { p: Prefix; locants: Loc[] }>();
  for (const x of list) {
    const k = x.p[lang];
    const g = map.get(k);
    if (g) g.locants.push(x.locant); else map.set(k, { p: x.p, locants: [x.locant] });
  }
  return [...map.values()].sort((a, b) => {
    const ka = alphaKey(a.p[lang], a.p.simple), kb = alphaKey(b.p[lang], b.p.simple);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

function assemblePrefixes(groups: { p: Prefix; locants: Loc[] }[], lang: Lang, omitCLocants: boolean): string {
  const parts = groups.map(({ p, locants }) => {
    const nm = p[lang];
    const n = locants.length;
    const need = !p.simple || /\d/.test(nm);
    let part: string;
    if (n === 1) part = need ? enclose(nm) : nm;
    else if (p.substituted) part = `${MULT_COMPLEX[n] ?? `${n}-`}${enclose(nm)}`;
    else part = `${MULT[n] ?? `${n}-`}${need ? enclose(nm) : nm}`;
    const showLoc = !omitCLocants || locants.some((l) => l === 'N');
    return (showLoc ? `${locStr(locants)}-` : '') + part;
  });
  return parts.reduce((acc, part, k) => (k === 0 ? part : acc + (/^[\dN]/.test(part) ? '-' : '') + part), '');
}

/** Terminación de insaturaciones («-2-en», «-1,3-dien», «-2-yn»…) y si el tallo necesita la «a» eufónica. */
function unsaturation(c: Candidate, lang: Lang): { body: string; needsA: boolean } {
  const enes = c.mult.filter((x) => x.order === 2).map((x) => x.locant).sort((a, b) => a - b);
  const ynes = c.mult.filter((x) => x.order === 3).map((x) => x.locant).sort((a, b) => a - b);
  if (!enes.length && !ynes.length) return { body: '', needsA: false };
  const ene = lang === 'en' ? 'en' : 'en', yne = lang === 'en' ? 'yn' : 'in';
  const parts: string[] = [];
  if (enes.length) parts.push(`${enes.join(',')}-${MULT[enes.length] ?? ''}${ene}`);
  if (ynes.length) parts.push(`${ynes.join(',')}-${MULT[ynes.length] ?? ''}${yne}`);
  const first = enes.length ? `${MULT[enes.length] ?? ''}${ene}` : `${MULT[ynes.length] ?? ''}${yne}`;
  return { body: parts.join('-'), needsA: !/^[aeiouy]/.test(first) };
}

/**
 * Hidruro progenitor sin la vocal final: «ethan», «prop-2-en», «cyclohexan», «buta-1,3-dien». Devuelve también la vocal final
 * («e» en inglés, «o» en español) que se escribe si el sufijo empieza por consonante.
 */
function hydrideCore(c: Candidate, lang: Lang): { core: string; vowel: string } {
  const n = c.atoms.length;
  const stem = STEM[lang][n];
  if (!stem) throw new Unsupported(`Cadena o anillo de ${n} carbonos: el motor nombra hasta ${MAXC}.`);
  const cy = c.ring ? (lang === 'en' ? 'cyclo' : 'ciclo') : '';
  const vowel = lang === 'en' ? 'e' : 'o';
  const u = unsaturation(c, lang);
  if (!u.body) return { core: `${cy}${stem}an`, vowel };
  // eteno/etino y cicloalquenos con un solo enlace múltiple en el C1 (sin localizador)
  if (c.mult.length === 1 && (n === 2 || (c.ring && c.mult[0].locant === 1 && !c.principal.length && !c.prefixes.length))) {
    return { core: `${cy}${stem}${c.mult[0].order === 2 ? 'en' : lang === 'en' ? 'yn' : 'in'}`, vowel };
  }
  return { core: `${cy}${stem}${u.needsA ? 'a' : ''}-${u.body}`, vowel };
}

const startsVowel = (s: string) => /^[aeiouáéíóú]/.test(s);

interface SuffixWord { en: string; es: string; terminal: boolean }

function suffixWord(kind: SuffixKind, n: number, external: boolean): SuffixWord {
  const mul = MULT[n] ?? '';
  switch (kind) {
    case 'acido': return external ? { en: `${mul}carboxylic acid`, es: `${mul}carboxílico`, terminal: true } : { en: `${mul}oic acid`, es: `${mul}oico`, terminal: true };
    case 'ester': return external ? { en: `${mul}carboxylate`, es: `${mul}carboxilato`, terminal: true } : { en: `${mul}oate`, es: `${mul}oato`, terminal: true };
    case 'amida': return external ? { en: `${mul}carboxamide`, es: `${mul}carboxamida`, terminal: true } : { en: `${mul}amide`, es: `${mul}amida`, terminal: true };
    case 'aldehido': return external ? { en: `${mul}carbaldehyde`, es: `${mul}carbaldehído`, terminal: true } : { en: `${mul}al`, es: `${mul}al`, terminal: true };
    case 'cetona': return { en: `${mul}one`, es: `${mul}ona`, terminal: false };
    case 'alcohol': return { en: `${mul}ol`, es: `${mul}ol`, terminal: false };
    case 'amina': return { en: `${mul}amine`, es: `${mul}amina`, terminal: false };
  }
}

/* ------------------------------------------------------------------ contexto y grupos */

function makeCtx(m: OMolecule): Ctx {
  const ri = ringInfo(m);
  const ringOf = new Array(m.atoms.length).fill(-1);
  ri.rings.forEach((r, k) => r.forEach((a) => { ringOf[a] = k; }));
  const groups = detectGroups(m);
  const pk = principalGroup(groups);
  const ctx: Ctx = { m, rings: ri.rings, ringOf, inRing: ri.atomInRing, arom: aromaticAtoms(m), groups, principalKind: null, sites: [], excluded: new Set(), memo: new Map() };
  if (pk === 'urea') throw new Unsupported('Derivados de la urea: el motor solo nombra la urea sin sustituir.');
  if (!pk) return ctx;
  ctx.principalKind = (pk === 'fenol' ? 'alcohol' : pk) as SuffixKind;
  const ofKind = groups.filter((g) => (pk === 'alcohol' || pk === 'fenol' ? g.kind === 'alcohol' || g.kind === 'fenol' : g.kind === pk));
  for (const g of ofKind) {
    if (g.kind === 'amina') {
      const n = g.center;
      ctx.sites.push({ g, carbon: -1, carriers: heavyNb(m, n).filter((v) => m.atoms[v].el === 'C') });
      ctx.excluded.add(n);
    } else if (g.kind === 'alcohol' || g.kind === 'fenol') {
      ctx.sites.push({ g, carbon: g.carrier!, carriers: [g.carrier!] });
      ctx.excluded.add(g.center);
    } else {
      ctx.sites.push({ g, carbon: g.center, carriers: [g.center] });
      for (const a of g.atoms) if (a !== g.center) ctx.excluded.add(a);
    }
  }
  if (pk === 'ester') {
    if (ofKind.length > 1) throw new Unsupported('Moléculas con más de un grupo éster (p. ej. triglicéridos): fuera del alcance del motor.');
    const g = ofKind[0];
    const o = g.atoms[2];
    const alkylRoot = heavyNb(m, o).find((v) => v !== g.center)!;
    ctx.ester = { o, alkylRoot, cg: g.center };
    for (const a of branchAtoms(m, alkylRoot, o)) ctx.excluded.add(a);
  }
  return ctx;
}

/** Carbonos del grupo principal que pueden ser extremo de cadena (ácido, éster, amida, aldehído). */
const isTerminalKind = (k: SuffixKind | null) => k === 'acido' || k === 'ester' || k === 'amida' || k === 'aldehido';

/* ------------------------------------------------------------------ prefijos */

function prefixesFor(ctx: Ctx, parent: number[], from: Set<number>, nAtoms: number[] = [], useExcluded = true): PlacedPrefix[] {
  const m = ctx.m;
  const inParent = new Set(parent);
  const out: PlacedPrefix[] = [];
  parent.forEach((a, k) => {
    for (const v of heavyNb(m, a)) {
      if (inParent.has(v) || from.has(v) || (useExcluded && ctx.excluded.has(v))) continue;
      out.push({ locant: k + 1, parentAtom: a, p: prefixOf(ctx, v, a) });
    }
  });
  // sustituyentes en el N del grupo principal (aminas y amidas)
  for (const nA of nAtoms) {
    for (const v of heavyNb(m, nA)) {
      if (inParent.has(v) || from.has(v) || ctx.sites.some((s) => s.carbon === v)) continue;
      if (m.atoms[v].el !== 'C') throw new Unsupported('El N lleva un sustituyente que no es un grupo carbonado.');
      if (nAtoms.length > 1) throw new Unsupported('Varios grupos N-sustituidos en el mismo progenitor (N,N′-…): fuera de alcance.');
      out.push({ locant: 'N', parentAtom: nA, p: substituentPrefix(ctx, v, nA) });
    }
  }
  return out;
}

const oxyName = (alkyl: Prefix): Prefix => {
  const contracted: Record<string, [string, string]> = { methyl: ['methoxy', 'metoxi'], ethyl: ['ethoxy', 'etoxi'], propyl: ['propoxy', 'propoxi'], butyl: ['butoxy', 'butoxi'], phenyl: ['phenoxy', 'fenoxi'], 'tert-butyl': ['tert-butoxy', 'terc-butoxi'] };
  const c = contracted[alkyl.en];
  if (c) return { en: c[0], es: c[1], simple: true, substituted: false, atoms: alkyl.atoms };
  const need = !alkyl.simple || /\d/.test(alkyl.en);
  return { en: `${need ? enclose(alkyl.en) : alkyl.en}oxy`, es: `${need ? enclose(alkyl.es) : alkyl.es}oxi`, simple: false, substituted: true, atoms: alkyl.atoms };
};

/** Prefijo para el átomo v (fuera del progenitor) unido al átomo a del progenitor. */
function prefixOf(ctx: Ctx, v: number, a: number): Prefix {
  const m = ctx.m;
  const el = m.atoms[v].el;
  const order = bondBetween(m, a, v)!.order;
  if (HALO[el]) return { ...HALO[el], simple: true, substituted: false, atoms: [v] };
  if (el === 'O') {
    if (order === 2) return { en: 'oxo', es: 'oxo', simple: true, substituted: false, atoms: [v] };
    const others = heavyNb(m, v).filter((x) => x !== a);
    if (!others.length) return { en: 'hydroxy', es: 'hidroxi', simple: true, substituted: false, atoms: [v] };
    const w = others[0];
    if (m.atoms[w].el !== 'C') throw new Unsupported('Grupo O–X con X distinto de carbono (peróxidos…): fuera de alcance.');
    if (carbonylO(m, w) !== null) {
      const acyl = acylPrefix(ctx, w, v);
      const need = !acyl.simple || /\d/.test(acyl.en);
      return { en: `${need ? enclose(acyl.en) : acyl.en}oxy`, es: `${need ? enclose(acyl.es) : acyl.es}oxi`, simple: false, substituted: true, atoms: [v, ...acyl.atoms] };
    }
    const alk = substituentPrefix(ctx, w, v);
    const ox = oxyName(alk);
    return { ...ox, atoms: [v, ...alk.atoms] };
  }
  if (el === 'N') {
    if (isNitroN(m, v)) return { en: 'nitro', es: 'nitro', simple: true, substituted: false, atoms: [v, ...neighbors(m, v).filter((x) => m.atoms[x].el === 'O')] };
    if (order !== 1) throw new Unsupported('Iminas y grupos C=N: fuera del alcance del motor.');
    const others = heavyNb(m, v).filter((x) => x !== a);
    const acyl = others.filter((x) => m.atoms[x].el === 'C' && carbonylO(m, x) !== null);
    if (acyl.length) {
      if (others.length > 1) throw new Unsupported('Grupos acilamino con el N sustituido: fuera de alcance.');
      const ac = acylPrefix(ctx, acyl[0], v);
      const contracted: Record<string, [string, string]> = { acetyl: ['acetamido', 'acetamido'], formyl: ['formamido', 'formamido'], benzoyl: ['benzamido', 'benzamido'] };
      const c = contracted[ac.en];
      if (c) return { en: c[0], es: c[1], simple: true, substituted: false, atoms: [v, ...ac.atoms] };
      return { en: `${enclose(ac.en)}amino`, es: `${enclose(ac.es)}amino`, simple: false, substituted: true, atoms: [v, ...ac.atoms] };
    }
    if (!others.length) return { en: 'amino', es: 'amino', simple: true, substituted: false, atoms: [v] };
    if (others.some((x) => m.atoms[x].el !== 'C')) throw new Unsupported('N unido a heteroátomos: fuera de alcance.');
    const subs = others.map((x) => substituentPrefix(ctx, x, v));
    if (subs.length === 2 && subs[0].en !== subs[1].en) throw new Unsupported('Grupo amino con dos sustituyentes distintos en el N: fuera de alcance.');
    const s0 = subs[0];
    const wrapS = (x: string) => (!s0.simple || /\d/.test(x) ? enclose(x) : x);
    const mul = subs.length === 2 ? (s0.substituted ? 'bis' : 'di') : '';
    return { en: `${mul}${wrapS(s0.en)}amino`, es: `${mul}${wrapS(s0.es)}amino`, simple: false, substituted: true, atoms: [v, ...subs.flatMap((x) => x.atoms)] };
  }
  if (el === 'C') {
    if (carbonylO(m, v) !== null && !ctx.inRing[v]) {
      // grupo acilo como prefijo (p. ej. «acetil»): solo si es una cetona; los ácidos/ésteres/amidas sustituyentes están fuera de alcance
      const hetero = heavyNb(m, v).filter((x) => x !== a && m.atoms[x].el !== 'C' && bondBetween(m, v, x)!.order === 1);
      if (hetero.length) throw new Unsupported('Un grupo ácido, éster o amida dentro de un sustituyente (carboxi-, carbamoil-…): fuera de alcance.');
      if (heavyNb(m, v).filter((x) => x !== a).length === 1 && hCount(m, v) === 1) throw new Unsupported('Un aldehído dentro de un sustituyente (formil-): fuera de alcance.');
      return acylPrefix(ctx, v, a);
    }
    return substituentPrefix(ctx, v, a);
  }
  throw new Unsupported(`El átomo ${el} unido a la cadena no es un sustituyente que el motor sepa nombrar.`);
}

/** Sustituyente carbonado con raíz en `root`, unido por `from` (alquilo, alquenilo, cicloalquilo, fenilo, bencilo…). */
function substituentPrefix(ctx: Ctx, root: number, from: number): Prefix {
  const key = `${root}<${from}`;
  const hit = ctx.memo.get(key);
  if (hit) return hit;
  const m = ctx.m;
  const order = bondBetween(m, root, from)!.order;
  const atoms = branchAtoms(m, root, from);
  for (const x of atoms) {
    if (m.atoms[x].el === 'C' && carbonylO(m, x) !== null && heavyNb(m, x).some((y) => m.atoms[y].el !== 'C' && bondBetween(m, x, y)!.order === 1 && y !== from)) {
      throw new Unsupported('Un grupo ácido, éster o amida dentro de un sustituyente: fuera de alcance.');
    }
  }
  let result: Prefix;
  if (ctx.inRing[root]) result = ringSubstituent(ctx, root, from, order, atoms);
  else {
    const acyclicC = atoms.filter((x) => isC(ctx, x) && !ctx.inRing[x]);
    const paths = treePaths(ctx.m, acyclicC).filter((p) => p.includes(root));
    const cands: Candidate[] = [];
    const ex = new Set([from]);
    for (const p of paths) for (const dir of p.length > 1 ? [p, [...p].reverse()] : [p]) {
      cands.push({ atoms: dir, ring: false, benzene: false, fv: dir.indexOf(root) + 1, mult: multiplesOf(ctx, dir, false, false), principal: [], external: false, prefixes: prefixesFor(ctx, dir, ex, [], false) });
    }
    const nameOf = (c: Candidate, lang: Lang) => chainSubstituentName(c, order, lang);
    const best = bestOf(cands, 'en', (c) => nameOf(c, 'en'));
    const bestEs = bestOf(cands, 'es', (c) => nameOf(c, 'es'));
    const en = nameOf(best, 'en'), es = nameOf(bestEs, 'es');
    result = { en, es, simple: best.prefixes.length === 0 && !/\d/.test(en), substituted: best.prefixes.length > 0, atoms };
    if (en === '2-methylpropan-2-yl') result = { en: 'tert-butyl', es: 'terc-butil', simple: true, substituted: false, atoms };
    if (en === 'phenylmethyl') result = { en: 'benzyl', es: 'bencil', simple: true, substituted: false, atoms };
  }
  ctx.memo.set(key, result);
  return result;
}

/** Acilo con el C del carbonilo en `cg`, unido por `from`: formil, acetil, propanoil, benzoil, 2-aminoacetil… */
function acylPrefix(ctx: Ctx, cg: number, from: number): Prefix {
  const m = ctx.m;
  const o = carbonylO(m, cg)!;
  const rest = heavyNb(m, cg).filter((x) => x !== from && x !== o);
  if (rest.some((x) => m.atoms[x].el !== 'C')) throw new Unsupported('Grupo acilo con heteroátomos en el carbonilo: fuera de alcance.');
  if (!rest.length) return { en: 'formyl', es: 'formil', simple: true, substituted: false, atoms: [cg, o] };
  const r = rest[0];
  if (ctx.inRing[r]) {
    const ring = ringSubstituent(ctx, r, cg, 1, branchAtoms(m, r, cg));
    if (ring.en === 'phenyl') return { en: 'benzoyl', es: 'benzoil', simple: true, substituted: false, atoms: [cg, o, ...ring.atoms] };
    throw new Unsupported('Grupos acilo de anillos distintos del benceno: fuera de alcance.');
  }
  const atoms = branchAtoms(m, r, cg).filter((x) => isC(ctx, x) && !ctx.inRing[x]);
  const paths = treePaths(m, atoms).filter((p) => p[0] === r || p[p.length - 1] === r).map((p) => (p[0] === r ? p : [...p].reverse()));
  const ex = new Set([from, o]);
  const cands: Candidate[] = paths.map((p) => {
    const chain = [cg, ...p];
    return { atoms: chain, ring: false, benzene: false, fv: 1, mult: multiplesOf(ctx, chain, false, false), principal: [], external: false, prefixes: prefixesFor(ctx, chain, ex, [], false) };
  });
  const name = (c: Candidate, lang: Lang) => {
    const pre = assemblePrefixes(groupPrefixes(c.prefixes, lang), lang, false);
    if (c.atoms.length === 2) return `${pre}${lang === 'en' ? 'acetyl' : 'acetil'}`;
    const { core } = hydrideCore(c, lang);
    return `${pre}${core}oyl`.replace(/oyl$/, lang === 'en' ? 'oyl' : 'oil');
  };
  const best = bestOf(cands, 'en', (c) => name(c, 'en'));
  const bestEs = bestOf(cands, 'es', (c) => name(c, 'es'));
  const en = name(best, 'en');
  return { en, es: name(bestEs, 'es'), simple: best.prefixes.length === 0, substituted: best.prefixes.length > 0, atoms: [cg, o, ...branchAtoms(m, r, cg)] };
}

function ringSubstituent(ctx: Ctx, root: number, from: number, bondOrder: number, atoms: number[]): Prefix {
  const ring = ctx.rings[ctx.ringOf[root]];
  checkRing(ctx, ring);
  const benzene = ring.every((a) => ctx.arom.has(a));
  const k0 = ring.indexOf(root);
  const cands: Candidate[] = [];
  for (const dir of [1, -1]) {
    const seq = ring.map((_, i) => ring[(k0 + dir * i + ring.length * 2) % ring.length]);
    cands.push({ atoms: seq, ring: true, benzene, fv: 1, mult: multiplesOf(ctx, seq, true, benzene), principal: [], external: false, prefixes: prefixesFor(ctx, seq, new Set([from]), [], false) });
  }
  const nameOf = (c: Candidate, lang: Lang) => {
    if (bondOrder !== 1) throw new Unsupported('Anillo unido por un doble enlace: fuera de alcance.');
    let core: string;
    if (benzene) core = lang === 'en' ? 'phenyl' : 'fenil';
    else {
      const { core: hc } = hydrideCore(c, lang);
      core = c.mult.length ? `${hc}-1-${lang === 'en' ? 'yl' : 'il'}` : `${hc.replace(/an$/, '')}${lang === 'en' ? 'yl' : 'il'}`;
    }
    return assemblePrefixes(groupPrefixes(c.prefixes, lang), lang, false) + core;
  };
  const best = bestOf(cands, 'en', (c) => nameOf(c, 'en'));
  const bestEs = bestOf(cands, 'es', (c) => nameOf(c, 'es'));
  const en = nameOf(best, 'en');
  return { en, es: nameOf(bestEs, 'es'), simple: best.prefixes.length === 0 && !/\d/.test(en), substituted: best.prefixes.length > 0, atoms };
}

function chainSubstituentName(c: Candidate, bondOrder: number, lang: Lang): string {
  const yl = lang === 'en' ? (bondOrder === 1 ? 'yl' : bondOrder === 2 ? 'ylidene' : 'ylidyne') : bondOrder === 1 ? 'il' : bondOrder === 2 ? 'iliden' : 'ilidin';
  const n = c.atoms.length;
  const stem = STEM[lang][n];
  if (!stem) throw new Unsupported(`Sustituyente de ${n} carbonos: fuera de alcance.`);
  const u = unsaturation(c, lang);
  let core: string;
  if (!u.body) core = c.fv === 1 ? `${stem}${yl}` : `${stem}an-${c.fv}-${yl}`;
  else if (n === 2 && c.fv === 1 && bondOrder === 1) core = `${stem}${c.mult[0].order === 2 ? 'en' : lang === 'en' ? 'yn' : 'in'}${yl}`;
  else core = `${stem}${u.needsA ? 'a' : ''}-${u.body}-${c.fv}-${yl}`;
  return assemblePrefixes(groupPrefixes(c.prefixes, lang), lang, n === 1) + core;
}

/* ------------------------------------------------------------------ candidatos */

function treePaths(m: OMolecule, nodes: number[]): number[][] {
  const set = new Set(nodes);
  const paths: number[][] = [];
  for (const s of nodes) {
    const prev = new Map<number, number>([[s, -1]]);
    const q = [s];
    while (q.length) { const u = q.shift()!; for (const v of neighbors(m, u)) if (set.has(v) && !prev.has(v)) { prev.set(v, u); q.push(v); } }
    for (const t of nodes) {
      if (t < s || !prev.has(t)) continue;
      const p: number[] = [];
      for (let x = t; x !== -1; x = prev.get(x)!) p.push(x);
      paths.push(p.reverse());
    }
  }
  return paths;
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

function checkRing(ctx: Ctx, ring: number[]) {
  if (!ring.every((a) => isC(ctx, a))) throw new Unsupported('Anillos con heteroátomos (O, N…): fuera del alcance del motor.');
  for (const a of ring) if (ctx.rings.filter((r) => r.includes(a)).length > 1) throw new Unsupported('Sistemas de anillos fusionados, puenteados o espiro: fuera de alcance.');
}

const CRITERIA = [
  'lleva más grupos principales (sufijo)',
  'es un anillo (en 2013 el anillo es progenitor antes que la cadena)',
  'tiene más átomos de carbono',
  'tiene más enlaces múltiples',
  'tiene más dobles enlaces',
  'la valencia libre lleva el localizador más bajo',
  'el grupo principal lleva los localizadores más bajos',
  'los enlaces múltiples llevan los localizadores más bajos',
  'los dobles enlaces llevan los localizadores más bajos',
  'tiene más sustituyentes',
  'los prefijos llevan los localizadores más bajos',
  'el prefijo que se cita primero en orden alfabético lleva el localizador más bajo',
  'su nombre completo va primero en orden alfanumérico',
];

const cLocs = (c: Candidate) => c.prefixes.filter((x) => x.locant !== 'N').map((x) => x.locant as number);

function compare(a: Candidate, b: Candidate, lang: Lang, full: (c: Candidate) => string): { cmp: number; k: number } {
  const steps: (() => number)[] = [
    () => b.principal.length - a.principal.length,
    () => Number(b.ring) - Number(a.ring),
    () => b.atoms.length - a.atoms.length,
    () => b.mult.length - a.mult.length,
    () => b.mult.filter((x) => x.order === 2).length - a.mult.filter((x) => x.order === 2).length,
    () => (a.fv ?? 0) - (b.fv ?? 0),
    () => compareLocants(a.principal, b.principal),
    () => compareLocants(a.mult.map((x) => x.locant), b.mult.map((x) => x.locant)),
    () => compareLocants(a.mult.filter((x) => x.order === 2).map((x) => x.locant), b.mult.filter((x) => x.order === 2).map((x) => x.locant)),
    () => b.prefixes.length - a.prefixes.length,
    () => compareLocants(cLocs(a), cLocs(b)),
    () => {
      const ord = (c: Candidate) => c.prefixes.filter((x) => x.locant !== 'N').slice().sort((x, y) => {
        const kx = alphaKey(x.p[lang], x.p.simple), ky = alphaKey(y.p[lang], y.p.simple);
        return kx < ky ? -1 : kx > ky ? 1 : (x.locant as number) - (y.locant as number);
      }).map((x) => x.locant as number);
      const oa = ord(a), ob = ord(b);
      for (let i = 0; i < Math.min(oa.length, ob.length); i++) if (oa[i] !== ob[i]) return oa[i] - ob[i];
      return 0;
    },
    () => { const x = full(a), y = full(b); return x < y ? -1 : x > y ? 1 : 0; },
  ];
  for (let k = 0; k < steps.length; k++) { const c = steps[k](); if (c !== 0) return { cmp: c, k }; }
  return { cmp: 0, k: -1 };
}

function bestOf(cands: Candidate[], lang: Lang, full: (c: Candidate) => string): Candidate {
  if (!cands.length) throw new Unsupported('No hay una cadena o un anillo que pueda ser progenitor.');
  let best = cands[0];
  for (const c of cands.slice(1)) if (compare(c, best, lang, full).cmp < 0) best = c;
  return best;
}

/** Candidatos a progenitor (cadenas y anillos con cada numeración posible). */
function candidates(ctx: Ctx): Candidate[] {
  const m = ctx.m;
  const out: Candidate[] = [];
  const pool = m.atoms.map((_, i) => i).filter((i) => isC(ctx, i) && !ctx.excluded.has(i));
  // cadenas
  const acyclic = pool.filter((i) => !ctx.inRing[i]);
  let firstError: Unsupported | null = null;
  const tryAdd = (make: () => Candidate) => {
    try { out.push(make()); } catch (e) { if (e instanceof Unsupported) { firstError ??= e; return; } throw e; }
  };
  for (const p of treePaths(m, acyclic)) {
    for (const dir of p.length > 1 ? [p, [...p].reverse()] : [p]) tryAdd(() => chainCandidate(ctx, dir));
  }
  // anillos
  for (const ring of ctx.rings) {
    if (!ring.every((a) => pool.includes(a))) continue;
    checkRing(ctx, ring);
    const benzene = ring.every((a) => ctx.arom.has(a));
    for (let k0 = 0; k0 < ring.length; k0++) for (const dir of [1, -1]) {
      const seq = ring.map((_, i) => ring[(k0 + dir * i + ring.length * 2) % ring.length]);
      tryAdd(() => ringCandidate(ctx, seq, benzene));
    }
  }
  // solo cuentan los candidatos que llevan el máximo de grupos principales; si ninguno se pudo nombrar, se informa el motivo
  if (!out.length && firstError) throw firstError;
  const maxP = Math.max(0, ...out.map((c) => c.principal.length));
  if (firstError && ctx.sites.length && maxP < ctx.sites.length) throw firstError;
  return out;
}

/** N del grupo principal (aminas y amidas) cuyos sustituyentes se citan con el localizador N. */
function nAtomsOf(s: Ctx['sites'][number], kind: SuffixKind | null): number[] {
  if (kind === 'amina') return [s.g.center];
  if (kind === 'amida') return [s.g.atoms[2]];
  return [];
}

function chainCandidate(ctx: Ctx, atoms: number[]): Candidate {
  const principal: number[] = [];
  const nAtoms: number[] = [];
  for (const s of ctx.sites) {
    const k = ctx.principalKind === 'amina' ? atoms.findIndex((a) => s.carriers.includes(a)) : atoms.indexOf(s.carbon);
    if (k >= 0) { principal.push(k + 1); nAtoms.push(...nAtomsOf(s, ctx.principalKind)); }
  }
  const prefixes = prefixesFor(ctx, atoms, new Set(), nAtoms);
  return { atoms, ring: false, benzene: false, mult: multiplesOf(ctx, atoms, false, false), principal, external: false, prefixes };
}

function ringCandidate(ctx: Ctx, atoms: number[], benzene: boolean): Candidate {
  const m = ctx.m;
  const principal: number[] = [];
  const nAtoms: number[] = [];
  const from = new Set<number>();
  let external = false;
  for (const s of ctx.sites) {
    let k: number;
    if (ctx.principalKind === 'amina') k = atoms.findIndex((a) => s.carriers.includes(a));
    else if (isTerminalKind(ctx.principalKind)) {
      // grupo externo: el C del grupo está unido a un átomo del anillo («…-carboxylic acid»)
      k = atoms.findIndex((a) => heavyNb(m, a).includes(s.carbon));
      if (k >= 0) { external = true; from.add(s.carbon); }
    } else k = atoms.indexOf(s.carbon);
    if (k >= 0) { principal.push(k + 1); nAtoms.push(...nAtomsOf(s, ctx.principalKind)); }
  }
  const prefixes = prefixesFor(ctx, atoms, from, nAtoms);
  return { atoms, ring: true, benzene, mult: multiplesOf(ctx, atoms, true, benzene), principal, external, prefixes };
}

/* ------------------------------------------------------------------ nombre completo */


function fullName(ctx: Ctx, c: Candidate, lang: Lang): string {
  const kind = ctx.principalKind;
  const n = c.atoms.length;
  const cPrefixes = c.prefixes.filter((x) => x.locant !== 'N');
  const nP = c.principal.length;
  // omisión de localizadores
  const terminal = isTerminalKind(kind) && !c.ring;
  const omitPrefixLoc = n === 1
    || (terminal && n === 2 && cPrefixes.every((x) => x.locant === 2))
    || (!kind && ((c.ring && (c.benzene || !c.mult.length) && cPrefixes.length === 1) || (!c.ring && n === 2 && cPrefixes.length === 1)));
  const groups = groupPrefixes(c.prefixes, lang);
  const pre = assemblePrefixes(groups, lang, omitPrefixLoc);
  if (!kind) return pre + hydrideName(c, lang);
  const sw = suffixWord(kind, nP, c.external)[lang];
  const omitSuffixLoc = (suffixWord(kind, nP, c.external).terminal && !c.ring) || n === 1
    || (!c.ring && n === 2 && nP === 1 && cPrefixes.length === 0)
    || (c.ring && nP === 1 && cPrefixes.length === 0 && !c.mult.length);
  // nombres retenidos
  const retained = retainedParent(ctx, c, lang);
  if (retained) {
    const r = assembleRetained(pre, retained, lang, kind);
    return kind === 'ester' ? esterName(ctx, r, lang) : r;
  }
  const { core, vowel } = c.benzene ? { core: lang === 'en' ? 'benzen' : 'bencen', vowel: lang === 'en' ? 'e' : 'o' } : hydrideCore(c, lang);
  const locs = omitSuffixLoc ? '' : `${[...c.principal].sort((a, b) => a - b).join(',')}-`;
  const body = locs ? `${core}${startsVowel(sw) ? '' : vowel}-${locs}${sw}` : `${core}${startsVowel(sw) ? '' : vowel}${sw}`;
  if (kind === 'acido') return lang === 'en' ? `${pre}${body}` : `ácido ${pre}${body}`;
  if (kind === 'ester') return esterName(ctx, `${pre}${body}`, lang);
  return `${pre}${body}`;
}

function hydrideName(c: Candidate, lang: Lang): string {
  if (c.benzene) return lang === 'en' ? 'benzene' : 'benceno';
  const { core, vowel } = hydrideCore(c, lang);
  return core + vowel;
}

/** Progenitores con nombre retenido (preferidos en 2013). Devuelve el nombre sin el «ácido». */
function retainedParent(ctx: Ctx, c: Candidate, lang: Lang): string | null {
  const kind = ctx.principalKind;
  const n = c.atoms.length, nP = c.principal.length;
  const en = lang === 'en';
  if (c.benzene && nP === 1) {
    if (kind === 'alcohol') return en ? 'phenol' : 'fenol';
    if (kind === 'amina') return en ? 'aniline' : 'anilina';
    if (kind === 'acido') return en ? 'benzoic acid' : 'benzoico';
    if (kind === 'ester') return en ? 'benzoate' : 'benzoato';
    if (kind === 'aldehido') return en ? 'benzaldehyde' : 'benzaldehído';
    if (kind === 'amida') return en ? 'benzamide' : 'benzamida';
  }
  if (!c.ring && !c.mult.length && (kind === 'acido' || kind === 'ester' || kind === 'aldehido' || kind === 'amida')) {
    if (n === 1 && nP === 1) return { acido: en ? 'formic acid' : 'fórmico', ester: en ? 'formate' : 'formiato', aldehido: en ? 'formaldehyde' : 'formaldehído', amida: en ? 'formamide' : 'formamida' }[kind];
    if (n === 2 && nP === 1) return { acido: en ? 'acetic acid' : 'acético', ester: en ? 'acetate' : 'acetato', aldehido: en ? 'acetaldehyde' : 'acetaldehído', amida: en ? 'acetamide' : 'acetamida' }[kind];
    if (n === 2 && nP === 2 && kind === 'acido') return en ? 'oxalic acid' : 'oxálico';
  }
  return null;
}

function assembleRetained(pre: string, parent: string, lang: Lang, kind: SuffixKind): string {
  return kind === 'acido' && lang === 'es' ? `ácido ${pre}${parent}` : `${pre}${parent}`;
}

/** «alquil …-oato»: en inglés «ethyl acetate»; en español «acetato de etilo». */
function esterName(ctx: Ctx, acylate: string, lang: Lang): string {
  const e = ctx.ester!;
  const alk = substituentPrefix(ctx, e.alkylRoot, e.o);
  if (lang === 'en') return `${alk.en} ${acylate}`;
  return `${acylate} de ${alk.es}o`;
}

/* ------------------------------------------------------------------ API */

/** Nombres comunes aceptados en nomenclatura general (no son el nombre preferido de 2013). */
const COMMON: Record<string, string> = {
  'propan-2-one': 'acetona', 'propane-1,2,3-triol': 'glicerol (glicerina)', 'ethane-1,2-diol': 'etilenglicol', methoxybenzene: 'anisol',
  ethoxyethane: 'éter dietílico («éter»)', methoxymethane: 'éter dimetílico', 'propan-2-ol': 'alcohol isopropílico (isopropanol)',
  '2-methylpropan-2-ol': 'alcohol terc-butílico', 'aminoacetic acid': 'glicina', '2-aminopropanoic acid': 'alanina', 'N-(4-hydroxyphenyl)acetamide': 'paracetamol (acetaminofén)',
  'N-methylmethanamine': 'dimetilamina', 'N,N-dimethylmethanamine': 'trimetilamina', methanamine: 'metilamina', ethanamine: 'etilamina',
  'N,N-dimethylformamide': 'DMF', '2-hydroxybenzoic acid': 'ácido salicílico', '2-hydroxypropanoic acid': 'ácido láctico', 'butanoic acid': 'ácido butírico',
  '1-phenylethan-1-one': 'acetofenona', phenylmethanol: 'alcohol bencílico', '4-methylphenol': 'p-cresol', '2-(acetyloxy)benzoic acid': 'ácido acetilsalicílico (aspirina)',
  '3-methylbutyl acetate': 'acetato de isoamilo (aroma de banano)', 'benzene-1,4-dicarboxylic acid': 'ácido tereftálico', 'propanedioic acid': 'ácido malónico',
  'hexanedioic acid': 'ácido adípico', 'octadecanoic acid': 'ácido esteárico', 'N-phenylacetamide': 'acetanilida', 'butan-2-one': 'metiletilcetona (MEK)',
  'diphenylmethanone': 'benzofenona', 'prop-2-enal': 'acroleína', 'prop-2-enoic acid': 'ácido acrílico', '2-methoxy-2-methylpropane': 'MTBE (metil terc-butil éter)',
};

const CLASS_ES: Record<SuffixKind, string> = { acido: 'ácido carboxílico', ester: 'éster', amida: 'amida', aldehido: 'aldehído', cetona: 'cetona', alcohol: 'alcohol', amina: 'amina' };

/** Nombra una molécula (grafo). Nunca lanza: devuelve { ok: false, motivo } si está fuera de alcance. */
export function nameFunctional(input: OMolecule): FunctionalNameResult {
  try {
    const m = input.atoms.some((a) => a.el === 'H') ? stripHydrogens(input).mol : input;
    return nameInternal(m);
  } catch (e) {
    if (e instanceof Unsupported) return { ok: false, motivo: e.message };
    throw e;
  }
}

/** Atajo: SMILES → nombre. */
export function nameFunctionalSmiles(smiles: string): FunctionalNameResult {
  try { return nameFunctional(parseSmiles(smiles)); } catch (e) { return { ok: false, motivo: e instanceof Error ? e.message : 'SMILES no válido.' }; }
}

function nameInternal(m: OMolecule): FunctionalNameResult {
  if (!m.atoms.length) return { ok: false, motivo: 'La estructura está vacía.' };
  if (!isConnected(m)) return { ok: false, motivo: 'La estructura tiene fragmentos separados.' };
  for (const [i, a] of m.atoms.entries()) {
    if (!['C', 'O', 'N', 'F', 'Cl', 'Br', 'I'].includes(a.el)) return { ok: false, motivo: `Elemento ${a.el}: fuera del alcance del motor (C, H, O, N y halógenos).` };
    if (a.charge && !(a.el === 'N' && isNitroN(m, i)) && !(a.el === 'O' && neighbors(m, i).some((v) => isNitroN(m, v)))) return { ok: false, motivo: 'Iones y sales: el motor nombra moléculas neutras.' };
  }
  // urea
  if (m.atoms.length === 4 && m.atoms.filter((a) => a.el === 'N').length === 2 && m.atoms.filter((a) => a.el === 'C').length === 1) {
    const c = m.atoms.findIndex((a) => a.el === 'C');
    if (carbonylO(m, c) !== null && neighbors(m, c).filter((v) => m.atoms[v].el === 'N' && hCount(m, v) === 2).length === 2) {
      return {
        ok: true, en: 'urea', es: 'urea', principal: 'urea', parentAtoms: [c], parentKind: 'cadena', locants: new Map([[c, 1]]), principalAtoms: m.atoms.map((_, i) => i),
        prefixes: [], comun: 'carbamida', avisos: [], groups: detectGroups(m),
        pasos: [{ titulo: '1. Clase', texto: 'Diamida del ácido carbónico: H₂N–CO–NH₂. «Urea» es el nombre retenido preferido por la IUPAC (2013).' }],
      };
    }
  }
  const onlyHydrocarbon = m.atoms.every((a) => ['C', 'F', 'Cl', 'Br', 'I'].includes(a.el));
  if (onlyHydrocarbon) {
    const r = nameMolecule(m);
    if (!r.ok) return { ok: false, motivo: r.motivo };
    return {
      ok: true, en: r.en, es: r.es, principal: null, parentAtoms: r.parent.atoms, parentKind: r.parent.kind === 'naftaleno' ? 'anillo' : r.parent.kind,
      locants: r.locants, principalAtoms: [], prefixes: r.substituents.map((s) => ({ locant: String(s.locant), es: s.es, atoms: s.atoms })),
      pasos: [{ titulo: '0. Motor de hidrocarburos', texto: 'La molécula no tiene grupos con O ni N: se nombra con el motor de hidrocarburos del laboratorio.' }, ...r.pasos],
      avisos: r.avisos, groups: detectGroups(m),
    };
  }
  for (const [i, a] of m.atoms.entries()) {
    if (a.el === 'C') {
      const used = neighbors(m, i).reduce((s, v) => s + bondBetween(m, i, v)!.order, 0);
      if (used > 4) return { ok: false, motivo: 'Un carbono tiene más de cuatro enlaces.' };
    }
    void implicitH;
  }
  const ctx = makeCtx(m);
  const kind = ctx.principalKind;
  // el éster: los átomos de la parte alquílica no son candidatos; el progenitor debe llevar el C del grupo
  const cands = candidates(ctx);
  const nameOf = (c: Candidate, lang: Lang) => fullName(ctx, c, lang);
  const best = bestOf(cands, 'en', (c) => nameOf(c, 'en'));
  const bestEs = bestOf(cands, 'es', (c) => nameOf(c, 'es'));
  if (kind && best.principal.length !== ctx.sites.length) {
    throw new Unsupported('Los grupos principales no caben en un mismo progenitor (harían falta prefijos carboxi-, formil-… o nomenclatura multiplicativa): fuera de alcance.');
  }
  const en = nameOf(best, 'en');
  const es = nameOf(bestEs, 'es');

  // pasos para el estudiante
  const pasos: NameStep[] = [];
  const groupsTxt = ctx.groups.map((g) => g.kind);
  const present = [...new Set(groupsTxt)];
  pasos.push({
    titulo: '1. Grupos funcionales y grupo principal',
    texto: kind
      ? `Grupos presentes: ${present.join(', ')}. Por el orden de prioridad de la IUPAC (ácido > éster > amida > aldehído > cetona > alcohol > amina) el grupo principal es ${CLASS_ES[kind]}${ctx.sites.length > 1 ? ` (${ctx.sites.length} grupos)` : ''}: se nombra con el sufijo «-${suffixWord(kind, 1, best.external).es}»; los demás van como prefijos.`
      : 'No hay grupo con sufijo (solo éteres, halógenos o nitro): todos se citan como prefijos del hidrocarburo progenitor.',
  });
  pasos.push({
    titulo: '2. Progenitor',
    texto: best.ring
      ? `El anillo de ${best.atoms.length} carbonos${best.benzene ? ' (benceno)' : ''} es el progenitor${kind ? `: lleva ${best.principal.length} grupo(s) principal(es)` : ''}${best.external ? '; el C del grupo queda fuera del anillo y se usa el sufijo «-carboxílico / -carbaldehído / -carboxamida»' : ''}. Desde 2013 un anillo se prefiere a una cadena cuando ambos llevan el mismo número de grupos principales.`
      : `Cadena de ${best.atoms.length} carbono(s) («${STEM.es[best.atoms.length]}-»)${kind ? ` que contiene ${isTerminalKind(kind) ? 'el C del grupo principal' : 'los C que llevan el grupo principal'}` : ''}: entre las cadenas posibles se elige la que más grupos principales lleva y, después, la más larga.`,
  });
  const loc = new Map<number, number>();
  best.atoms.forEach((a, k) => loc.set(a, k + 1));
  pasos.push({
    titulo: '3. Numeración',
    texto: kind ? `Se numera para dar al grupo principal el localizador más bajo (${[...best.principal].sort((a, b) => a - b).join(', ')}${isTerminalKind(kind) && !best.ring ? ': el C del grupo es siempre el 1 y no se escribe' : ''}); después, a los enlaces múltiples y a los prefijos.` : 'Localizadores más bajos para los enlaces múltiples y luego para los prefijos.',
  });
  const gEs = groupPrefixes(bestEs.prefixes, 'es');
  if (gEs.length) pasos.push({ titulo: '4. Prefijos', texto: `${gEs.map((g) => `${g.p.es} en ${locStr(g.locants)}`).join('; ')}. Se escriben en orden alfabético, sin contar los multiplicadores (di-, tri-…).` });
  pasos.push({ titulo: gEs.length ? '5. Nombre' : '4. Nombre', texto: `${es} (en inglés: ${en}).` });

  const principalAtoms = ctx.sites.flatMap((s) => s.g.atoms.concat(s.g.kind === 'alcohol' || s.g.kind === 'fenol' ? [s.g.carrier!] : []));
  return {
    ok: true, en, es, principal: kind === 'alcohol' && ctx.sites.some((s) => s.g.kind === 'fenol') && best.benzene ? 'fenol' : kind,
    parentAtoms: best.atoms, parentKind: best.benzene ? 'benceno' : best.ring ? 'anillo' : 'cadena', locants: loc, principalAtoms,
    prefixes: bestEs.prefixes.map((x) => ({ locant: String(x.locant), es: x.p.es, atoms: x.p.atoms })),
    pasos, comun: COMMON[en], avisos: [], groups: ctx.groups,
  };
}

export { CRITERIA as FUNCTIONAL_CRITERIA, SENIORITY };

/* ------------------------------------------------------------------ comparación con PubChem (LexiChem) */

/** LexiChem usa un nombre retenido solo aceptado en nomenclatura general; el motor da el preferido de 2013. */
const RETAINED_GENERAL: Record<string, string> = {
  anisole: 'methoxybenzene', 'terephthalic acid': 'benzene-1,4-dicarboxylic acid', chloroform: 'trichloromethane',
};

export type PubChemMatch = 'idéntico' | 'paréntesis y corchetes (2013)' | 'localizador 1 del sufijo (2013 lo cita)' | 'localizador 2 en derivados de acético/acetaldehído/acetamida'
  | 'nombre retenido (LexiChem)' | 'localizador 1 innecesario (LexiChem)' | 'NO CLASIFICADA';

/** Explicación para el estudiante de cada clase de diferencia. */
export const MATCH_EXPLAIN: Record<PubChemMatch, string> = {
  'idéntico': 'El nombre coincide letra por letra con el de PubChem.',
  'paréntesis y corchetes (2013)': 'Mismo nombre; las Recomendaciones 2013 encierran los prefijos compuestos entre paréntesis y LexiChem no.',
  'localizador 1 del sufijo (2013 lo cita)': 'Mismo compuesto; 2013 escribe el localizador 1 del sufijo cuando hay prefijos («2-cloroetan-1-ol»), LexiChem lo omite.',
  'localizador 2 en derivados de acético/acetaldehído/acetamida': 'Mismo compuesto; en el ácido acético solo se puede sustituir el C2, así que 2013 omite el «2-»; LexiChem lo escribe.',
  'nombre retenido (LexiChem)': 'LexiChem usa un nombre común aceptado en nomenclatura general; el motor da el nombre preferido de 2013.',
  'localizador 1 innecesario (LexiChem)': 'Mismo compuesto; con un solo sustituyente en una cadena de dos carbonos el localizador no hace falta.',
  'NO CLASIFICADA': 'Diferencia no explicada: revisar.',
};

export function compareWithPubChem(pubchem: string, en: string): PubChemMatch {
  if (en === pubchem) return 'idéntico';
  const np = (x: string) => normalizeName(x, { dropParens: true });
  if (np(en) === np(pubchem)) return 'paréntesis y corchetes (2013)';
  if (en.replace(/an-1-(ol|one|amine)$/, 'an$1') === pubchem) return 'localizador 1 del sufijo (2013 lo cita)';
  if (/(acetic acid|acetaldehyde|acetamide)$/.test(en) && np(pubchem.replace(/^2(,2)*-/, '')) === np(en)) return 'localizador 2 en derivados de acético/acetaldehído/acetamida';
  if (RETAINED_GENERAL[pubchem] === en) return 'nombre retenido (LexiChem)';
  if (pubchem === `1-${en}`) return 'localizador 1 innecesario (LexiChem)';
  return 'NO CLASIFICADA';
}

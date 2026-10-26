/**
 * Vistas 3D del Taller de formación de compuestos, construidas SOLO con el kit src/chem (nunca coordenadas a mano):
 *  - molécula con confórmero 3D de PubChem de la biblioteca del kit (o su geometría VSEPR rotulada);
 *  - geometría VSEPR calculada por el kit (buildVsepr) para oxoácidos, oxoaniones e hidruros con UN átomo central
 *    que no están en la biblioteca;
 *  - red cristalina (Crystal3D) para los sólidos con estructura publicada en el kit (iónicos y la red covalente del
 *    cuarzo, SiO₂);
 *  - ion amonio NH₄⁺ (biblioteca del kit, con sus cuatro enlaces N–H) y oxoaniones para las sales de amonio;
 *  - geometría VSEPR para los compuestos binarios entre no metales con un átomo central (PCl₃, PCl₅, SF₆, CCl₄…);
 *  - si no hay geometría fiable (dos átomos centrales, polímeros, redes covalentes, sólidos sin parámetro de red), se
 *    dice y se muestra solo el modelo 2D de cargas.
 * La reacción en 3D (Reaction3D) se arma cuando todas las especies tienen geometría; los compuestos iónicos sin red se
 * dibujan con ionAssembly (rotulado como ilustración).
 */
import {
  atomSpecies, buildReactionScene, buildVsepr, crystalForComposition, hillFormulaOf, ionAssembly, latticeFragment, MOLECULES, moleculeSpecies, singleAtom,
  type CrystalDef, type Reaction3DDef, type Species3D, type VseprLigand,
} from '../chem';
import { solveBalance, type ReactionDef } from '../models/balancing';
import { chargeParts, ionLabel, isMolecular, type ForgeOk, type ForgeTerm } from '../models/compoundForge';
import { el as engineEl, hillFormula, oxoacid, type Compound } from '../models/inorganicNomenclature';

/* ------------------------------------------------------------------ índices de la biblioteca */

let molIndex: Map<string, string> | null = null;
let ionIndex: Map<string, string> | null = null;
function indices() {
  if (!molIndex || !ionIndex) {
    molIndex = new Map(); ionIndex = new Map();
    for (const m of MOLECULES) {
      try {
        const s = moleculeSpecies(m.id);
        const hill = hillFormulaOf(s.atoms);
        if (m.categoria === 'ion') ionIndex.set(`${hill}|${s.charge}`, m.id);
        else if (!molIndex.has(hill)) molIndex.set(hill, m.id);
      } catch { /* sin SDF */ }
    }
  }
  return { mol: molIndex, ion: ionIndex };
}

/* ------------------------------------------------------------------ geometrías VSEPR generadas */

/** Electrones de valencia del átomo central (grupos principales). En los metales de transición (d⁰ en sus oxoaniones:
 * Cr(VI), Mn(VII), V(V), Mo(VI), W(VI), Re(VII)) los electrones d no cuentan como pares VSEPR. */
const VALENCE: Record<string, number> = { B: 3, Si: 4, P: 5, S: 6, Cl: 7, Br: 7, I: 7, As: 5, Se: 6, Te: 6 };
const TRANSITION = new Set(['Cr', 'Mn', 'V', 'Mo', 'W', 'Re']);
/**
 * Oxoácidos sin molécula aislada que dibujar: el ácido real es otra especie (H₆TeO₆, H[Sb(OH)₆]) o un óxido hidratado
 * polimérico (MoO₃·H₂O, WO₃·H₂O, vanádico), así que no se calcula una geometría VSEPR de una fórmula formal.
 */
const ACID_NO_3D: Record<string, string> = {
  'Te:6': 'El ácido telúrico real es H₆TeO₆ = Te(OH)₆ (octaédrico), no la molécula H₂TeO₄: el kit no la dibuja.',
  'Sb:5': 'El «ácido antimónico» H₃SbO₄ no existe como molécula (en agua es H[Sb(OH)₆]): no se dibuja.',
  'Mo:6': 'El ácido molíbdico es MoO₃ hidratado, un sólido en capas (no una molécula aislada): no se dibuja.',
  'W:6': 'El ácido wolfrámico es WO₃ hidratado, un sólido (no una molécula aislada): no se dibuja.',
  'V:5': 'El ácido vanádico no se aísla (solo existen sus sales, los vanadatos): no se dibuja una molécula formal.',
  'Re:7': 'El ácido perrénico solo existe en disolución (como iones H₃O⁺ y ReO₄⁻): el kit dibuja el ion perrenato en sus sales, no una molécula HReO₄.',
};

/**
 * Oxoácido u oxoanión con UN átomo central X: h grupos O–H, (−carga) O con carga −1 y el resto O con doble enlace
 * (centros del 3.er período o mayores, que expanden el octeto). Pares libres = (electrones de valencia − n.o.)/2.
 * Devuelve null si el caso no es fiable (C y N se toman de la biblioteca; B y Si solo con enlaces sencillos).
 */
function oxoSpecies(x: string, ox: number, h: number, o: number, charge: number, id: string, name: string, label: string): Species3D | null {
  if (x === 'C' || x === 'N') return null;
  const neg = -charge;
  const dbl = o - h - neg;
  if (dbl < 0) return null;
  if ((x === 'B' || x === 'Si') && dbl > 0) return null;
  let lp = 0;
  if (!TRANSITION.has(x)) {
    const v = VALENCE[x];
    if (v === undefined || (v - ox) % 2 !== 0 || v < ox) return null;
    lp = (v - ox) / 2;
  }
  if (o + lp > 6) return null;
  const single: 1 | 2 = x === 'B' || x === 'Si' ? 1 : 2;
  const ligands: VseprLigand[] = [
    ...Array.from({ length: dbl }, () => ({ el: 'O', order: 2 as const })),
    ...Array.from({ length: neg }, () => ({ el: 'O', order: 1 as const, charge: -1, lengthOrder: single })),
    ...Array.from({ length: h }, () => ({ el: 'O', order: 1 as const, h: 1 })),
  ];
  try { return buildVsepr({ id, name, label, center: x, ligands, lonePairs: lp }); } catch { return null; }
}

/** Hidruros no metálicos sin confórmero en la biblioteca (un átomo central). */
const HYDRIDE_VSEPR: Record<string, { lp: number; label: string; name: string }> = {
  P: { lp: 1, label: 'PH₃', name: 'Fosfano (fosfina)' }, Si: { lp: 0, label: 'SiH₄', name: 'Silano' }, B: { lp: 0, label: 'BH₃', name: 'Borano (monómero)' },
  As: { lp: 1, label: 'AsH₃', name: 'Arsano (arsina)' },
};

/** Ion poliatómico de un oxoácido (para las sales y el modelo iónico). */
function oxoanion(acid: { el: string; ox: number; form?: 'normal' | 'meta' | 'di' }, hLeft: number): Species3D | null {
  const a = oxoacid(acid.el, acid.ox, acid.form ?? 'normal');
  if (a.x !== 1 || (acid.form && acid.form !== 'normal') || (acid.el === 'P' && acid.ox === 3)) return null;
  // Los teluratos (Te(VI)) del sólido tienen Te octaédrico: no hay un ion TeO₄²⁻ tetraédrico que dibujar.
  if (acid.el === 'Te' && acid.ox === 6) return null;
  const q = -(a.h - hLeft);
  const formula = `${hLeft ? `H${hLeft > 1 ? hLeft : ''}` : ''}${acid.el}O${a.o > 1 ? a.o : ''}`;
  const comp: Record<string, number> = { O: a.o, [acid.el]: 1, ...(hLeft ? { H: hLeft } : {}) };
  const key = `${hillFormula(comp)}|${q}`;
  const lib = indices().ion.get(key);
  if (lib) return moleculeSpecies(lib);
  return oxoSpecies(acid.el, acid.ox, hLeft, a.o, q, `ion-${formula}`, `Ion ${formula}`, ionLabel(formula, q));
}

/* ------------------------------------------------------------------ vista estática */

export type StaticView =
  | { kind: 'molecula'; species: Species3D; note?: string }
  | { kind: 'cristal'; crystal: CrystalDef }
  | { kind: 'ionico'; ions: Species3D[]; note: string }
  | { kind: 'sin-geometria'; note: string };

/** Cristal del kit con la misma composición (sólidos iónicos y la red covalente del cuarzo). */
function crystalFor(c: Compound): CrystalDef | null {
  return crystalForComposition(c.composition);
}

/** Electrones de valencia de los átomos centrales de los binarios entre no metales (B, C, Si, N, P, S). */
const BINARY_VALENCE: Record<string, number> = { B: 3, C: 4, Si: 4, N: 5, P: 5, S: 6 };

/**
 * Molécula binaria entre no metales con UN átomo central (PCl₃, PCl₅, CCl₄, CS₂, SF₄, SF₆, BF₃…): geometría VSEPR
 * calculada por el kit. Orden de enlace = n.o. del central / número de ligandos (1 o 2, p. ej. S=C=S); pares libres =
 * (electrones de valencia − n.o.)/2.
 */
function binarySpecies(c: Compound): Species3D | null {
  const s = c.spec;
  if (s.kind !== 'sal-binaria' || s.cation.el === 'NH4') return null;
  const center = s.cation.el;
  const ox = (s.cation as { ox: number }).ox;
  const v = BINARY_VALENCE[center];
  const m = c.composition[s.anion];
  if (v === undefined || c.composition[center] !== 1 || !m) return null;
  const order = ox / m;
  if (order !== 1 && order !== 2) return null;
  if ((v - ox) % 2 !== 0 || v < ox) return null;
  const lp = (v - ox) / 2;
  try {
    return buildVsepr({ id: `binario-${c.formula}`, name: c.names.sistematica[0].toUpperCase() + c.names.sistematica.slice(1), label: c.formulaPretty, center, ligands: Array.from({ length: m }, () => ({ el: s.anion, order: order as 1 | 2 })), lonePairs: lp });
  } catch { return null; }
}

/** Especie molecular del compuesto (biblioteca, molécula real múltiplo o VSEPR generada); null si no hay geometría fiable. */
function molecularSpecies(c: Compound): { species: Species3D; formula3d: string; note?: string } | null {
  const { mol } = indices();
  const hill = hillFormula(c.composition);
  const id = mol.get(hill);
  if (id) return { species: moleculeSpecies(id), formula3d: c.formula };
  const doubled = Object.fromEntries(Object.entries(c.composition).map(([k, v]) => [k, 2 * v]));
  const id2 = mol.get(hillFormula(doubled));
  if (id2 && c.fn === 'oxido-acido') {
    const s = moleculeSpecies(id2);
    return { species: s, formula3d: Object.entries(doubled).map(([k, v]) => `${k}${v > 1 ? v : ''}`).join(''), note: `La molécula real es ${s.label}: ${c.formulaPretty} es su fórmula empírica (la que da la neutralidad de cargas).` };
  }
  const s = c.spec;
  if (s.kind === 'oxacido') {
    const a = oxoacid(s.el, s.ox, s.form ?? 'normal');
    if (a.x !== 1 || (s.form && s.form !== 'normal') || (s.el === 'P' && s.ox === 3) || ACID_NO_3D[`${s.el}:${s.ox}`]) return null;
    const sp = oxoSpecies(s.el, s.ox, a.h, a.o, 0, `acido-${c.formula}`, c.names.tradicional ? c.names.tradicional[0].toUpperCase() + c.names.tradicional.slice(1) : c.formula, c.formulaPretty);
    return sp ? { species: sp, formula3d: c.formula } : null;
  }
  if (c.fn === 'binario-no-metalico') {
    const b = binarySpecies(c);
    return b ? { species: b, formula3d: c.formula, note: c.key === 'sal:P5-Cl' ? 'Se muestra la molécula del PCl₅ gaseoso (bipirámide trigonal); en el sólido es iónico, [PCl₄]⁺[PCl₆]⁻.' : undefined } : null;
  }
  if (s.kind === 'hidruro' && HYDRIDE_VSEPR[s.el]) {
    const v = HYDRIDE_VSEPR[s.el];
    const n = c.composition.H;
    const sp = buildVsepr({ id: `hidruro-${s.el}`, name: v.name, label: v.label, center: s.el, ligands: Array.from({ length: n }, () => ({ el: 'H', order: 1 as const })), lonePairs: v.lp });
    return { species: sp, formula3d: c.formula, note: s.el === 'B' ? 'El BH₃ no se aísla: forma el dímero B₂H₆ (diborano). Se muestra la geometría VSEPR del monómero.' : undefined };
  }
  return null;
}

function noGeometryReason(c: Compound): string {
  const k = c.key;
  if (k === 'oxido:B3') return 'El B₂O₃ forma una red (vítrea) de unidades BO₃: no hay una molécula aislada. Solo se muestra el modelo 2D.';
  if (k === 'oxido:Cr6') return 'El CrO₃ sólido está formado por cadenas de tetraedros CrO₄ (un polímero): no hay una molécula aislada que dibujar. Solo se muestra el modelo 2D.';
  if (c.spec.kind === 'oxacido' && (c.spec.form === 'meta')) return 'Los metaácidos forman cadenas o anillos (polímeros), no moléculas sueltas: no hay geometría fiable. Solo se muestra el modelo 2D.';
  if (c.spec.kind === 'oxacido' && c.spec.el === 'P' && c.spec.ox === 3) return 'El H₃PO₃ tiene un H unido al P (es HPO(OH)₂): el kit no tiene su confórmero ni una geometría VSEPR fiable. Solo se muestra el modelo 2D.';
  if (c.key === 'oxido:Cl7') return 'PubChem no tiene confórmero 3D del Cl₂O₇ y el kit no calcula geometrías con dos átomos centrales. Solo se muestra el modelo 2D.';
  if (c.spec.kind === 'oxacido' && ACID_NO_3D[`${c.spec.el}:${c.spec.ox}`]) return `${ACID_NO_3D[`${c.spec.el}:${c.spec.ox}`]} Solo se muestra el modelo 2D.`;
  if (c.spec.kind === 'oxido' && engineEl(c.spec.el).kind === 'metal' && k !== 'oxido:Mn7') return `El ${c.formulaPretty} es un sólido formado por una red extendida (no hay una molécula aislada que dibujar) y el kit no incluye su red. Solo se muestra el modelo 2D.`;
  if (k === 'oxido:As3') return 'La molécula real es As₄O₆ (dos o más átomos centrales): el kit no tiene su confórmero ni calcula esa geometría. Solo se muestra el modelo 2D.';
  if (k === 'oxido:Se4' || k === 'oxido:Te4') return `El ${c.formulaPretty} sólido es un polímero (cadenas o red): no hay una molécula aislada que dibujar. Solo se muestra el modelo 2D.`;
  return 'No hay confórmero 3D de PubChem en el kit ni una geometría VSEPR fiable (especie con dos o más átomos centrales): no se dibuja a mano. Solo se muestra el modelo 2D.';
}

/** Iones poliatómicos (con geometría) que forman un compuesto iónico del taller. */
function polyatomicIons(c: Compound): (Species3D | null)[] {
  const s = c.spec;
  const nh4 = (s.kind === 'sal-binaria' || s.kind === 'oxisal') && s.cation.el === 'NH4' ? [moleculeSpecies('amonio')] : [];
  if (s.kind === 'hidroxido') return [moleculeSpecies('hidroxido')];
  if (s.kind === 'oxisal') return [...nh4, oxoanion(s.acid, s.hLeft ?? 0)];
  if (s.kind === 'sal-binaria' && nh4.length) return nh4;
  if (s.kind === 'peroxido' && s.el !== 'H') return [null];
  return [];
}

export function staticView(c: Compound): StaticView {
  const cr = crystalFor(c);
  if (cr) return { kind: 'cristal', crystal: cr };
  if (isMolecular(c)) {
    const m = molecularSpecies(c);
    return m ? { kind: 'molecula', species: m.species, note: m.note } : { kind: 'sin-geometria', note: noGeometryReason(c) };
  }
  const all = polyatomicIons(c);
  const ions = all.filter((x): x is Species3D => x !== null);
  const isNH4 = ions.some((x) => x.id === 'amonio');
  if (ions.length) return { kind: 'ionico', ions, note: isNH4
    ? `Sólido iónico formado por iones amonio, NH₄⁺, y ${ions.length > 1 ? 'el anión poliatómico' : 'aniones monoatómicos'}. El kit no dibuja su red: en el cristal el NH₄⁺ gira o se desordena, y una red con iones fijos sería engañosa. Abajo ${ions.length > 1 ? 'se ven los dos iones poliatómicos' : 'se ve el ion amonio'} con sus enlaces covalentes (N–H${ions.length > 1 ? ' y los del anión' : ''}).${all.length > ions.length ? ' (El anión de esta sal no tiene una geometría fiable en el kit).' : ''}`
    : `Sólido iónico: el kit no tiene el parámetro de red publicado de ${c.formulaPretty}, así que no se dibuja su red (solo el modelo 2D de cargas). Abajo se ve el ion poliatómico que lo forma, con su geometría calculada.` };
  const poly = polyatomicIons(c);
  return { kind: 'sin-geometria', note: poly.length
    ? `Sólido iónico: el kit no tiene el parámetro de red publicado de ${c.formulaPretty} ni una geometría fiable de su ion poliatómico, así que no se dibuja en 3D. Solo se muestra el modelo 2D de cargas.`
    : `Sólido iónico: el kit no tiene el parámetro de red publicado de ${c.formulaPretty} y sus iones son monoatómicos (no hay una molécula que dibujar), así que no se dibuja en 3D. Solo se muestra el modelo 2D de cargas; la reacción en 3D sí muestra sus iones por separado.` };
}

/* ------------------------------------------------------------------ reacción en 3D */

const DIATOMIC_LIB: Record<string, string> = { H: 'hidrogeno', O: 'oxigeno', N: 'nitrogeno', Cl: 'cloro' };

function elementSpecies(t: ForgeTerm): Species3D | null {
  const sym = t.formula.replace(/2$/, '');
  if (t.formula.endsWith('2')) {
    if (DIATOMIC_LIB[sym]) return moleculeSpecies(DIATOMIC_LIB[sym]);
    try { return buildVsepr({ id: `${sym}2`, name: t.name, label: t.pretty, center: sym, ligands: [{ el: sym, order: 1 }], lonePairs: 3 }); } catch { return null; }
  }
  return atomSpecies(sym, t.name);
}

function interleave<T>(a: T[], b: T[]): T[] {
  const [big, small] = a.length >= b.length ? [a, b] : [b, a];
  const out: T[] = [];
  let j = 0;
  const target = (k: number) => Math.ceil(((k + 1) * big.length) / (small.length + 1));
  big.forEach((x, i) => { out.push(x); while (j < small.length && i + 1 >= target(j)) out.push(small[j++]); });
  while (j < small.length) out.push(small[j++]);
  return out;
}

/** Especie 3D de una unidad fórmula de un compuesto iónico sin red: iones dibujados por separado. */
function ionicAssembly(c: Compound): Species3D | null {
  const parts = chargeParts(c);
  const ionsOf = (p: (typeof parts)[number]): Species3D | null => {
    if (p.label === 'Hg₂²⁺' || p.label === 'O₂²⁻') return null;
    if (p.label === 'OH⁻') return moleculeSpecies('hidroxido');
    if (p.label === 'NH₄⁺') return moleculeSpecies('amonio');
    const mono = /^([A-Z][a-z]?)[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]$/.exec(p.label);
    if (mono) return singleAtom(`ion-${mono[1]}${p.charge}`, `Ion ${engineEl(mono[1]).es}`, mono[1], p.charge, p.label);
    const s = c.spec;
    if (s.kind === 'oxisal') return oxoanion(s.acid, s.hLeft ?? 0);
    return null;
  };
  const cats: Species3D[] = [], ans: Species3D[] = [];
  for (const p of parts) {
    const sp = ionsOf(p);
    if (!sp) return null;
    for (let i = 0; i < p.count; i++) (p.charge > 0 ? cats : ans).push(sp);
  }
  return ionAssembly(`unidad-${c.formula}`, `${c.names.stock ?? c.names.sistematica} (iones)`, c.formulaPretty, interleave(ans, cats));
}

function compoundSpecies(t: ForgeTerm): { species: Species3D; formula3d: string; note?: string } | null {
  const c = t.compound;
  if (!c) return null;
  const cr = crystalFor(c);
  if (cr) return { species: latticeFragment(cr, 1), formula3d: c.formula };
  if (isMolecular(c)) return molecularSpecies(c);
  const asm = ionicAssembly(c);
  return asm ? { species: asm, formula3d: c.formula } : null;
}

export type Reaction3DResult = { def: Reaction3DDef; note?: string } | { reason: string };

const MAX_ATOMS = 120;

/** Reacción 3D de un resultado del taller, o el motivo por el que no se puede dibujar. */
export function forgeReaction3D(r: ForgeOk): Reaction3DResult {
  const terms = [...r.reactants, ...r.products];
  const built = terms.map((t) => (t.role === 'elemento' ? (() => { const s = elementSpecies(t); return s ? { species: s, formula3d: t.formula } : null; })() : compoundSpecies(t)));
  const missing = terms.filter((_, i) => !built[i]).map((t) => t.pretty);
  if (missing.length) return { reason: `No hay geometría fiable para ${missing.join(' y ')}: la reacción no se anima en 3D (no se dibujan coordenadas a mano). La ecuación balanceada sigue siendo válida.` };
  const b = built as { species: Species3D; formula3d: string; note?: string }[];
  const nR = r.reactants.length;
  const rd: ReactionDef = {
    id: 'taller-3d', name: 'Taller 3D', level: 1, context: '',
    reactants: b.slice(0, nR).map((x, i) => ({ formula: x.formula3d, name: terms[i].name, kind: 'unidad' })),
    products: b.slice(nR).map((x, i) => ({ formula: x.formula3d, name: terms[nR + i].name, kind: 'unidad' })),
    answer: [],
  };
  const sol = solveBalance(rd);
  if (!sol.coefficients) return { reason: 'No se pudo balancear la ecuación con las especies 3D.' };
  const coefs = sol.coefficients;
  const atoms = b.reduce((s, x, i) => s + coefs[i] * x.species.atoms.length, 0);
  if (atoms > MAX_ATOMS) return { reason: `La animación tendría ${atoms} átomos (más de ${MAX_ATOMS}): sería ilegible en una pantalla pequeña, así que no se anima. La ecuación balanceada sigue siendo válida.` };
  const mk = (x: { species: Species3D; formula3d: string }, i: number) => ({ species: x.species, coef: coefs[i], formula: x.formula3d, name: terms[i].name });
  const def: Reaction3DDef = {
    id: `taller-${r.product.key}-${r.route.id}`, title: `${r.route.label.split('→')[0].trim()} → ${r.product.formulaPretty}`,
    reactants: b.slice(0, nR).map((x, i) => mk(x, i)), products: b.slice(nR).map((x, i) => mk(x, nR + i)),
  };
  try { buildReactionScene(def); } catch (e) { return { reason: `La reacción no se puede animar: ${(e as Error).message}` }; }
  const note = b.map((x) => x.note).find(Boolean);
  const changed = b.some((x, i) => x.formula3d !== terms[i].formula);
  return { def, note: changed ? `${note ?? ''} Por eso en 3D la ecuación se escribe con la molécula real.`.trim() : note };
}

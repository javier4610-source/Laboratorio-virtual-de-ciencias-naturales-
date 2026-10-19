import { gcd, prettyFormula, type Composition } from './balancing';
import { seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Motor de nomenclatura química inorgánica (grado 10.º).
 *
 * A partir de los elementos y sus estados de oxidación calcula la fórmula por NEUTRALIDAD DE CARGAS
 * (n·carga del catión + m·carga del anión = 0 con los menores enteros: n = |q_anión|/mcd, m = q_catión/mcd) y genera
 * los nombres en tres sistemas:
 *  - Sistemática estequiométrica (IUPAC, Recomendaciones 2005, «Libro Rojo», cap. IR-5): prefijos multiplicadores
 *    (mono-, di-, tri-…; bis-, tris-… para iones poliatómicos): «trióxido de dihierro».
 *  - Stock (IUPAC 2005, IR-5.4.2.2): número de oxidación en romanos entre paréntesis cuando el elemento tiene más de
 *    uno: «óxido de hierro(III)». Para los oxoácidos la IUPAC 2005 usa la nomenclatura de hidrógeno
 *    («dihidrogeno(tetraoxidosulfato)», IR-8.4) y acepta los nombres tradicionales («ácido sulfúrico», tabla IR-8.1).
 *  - Tradicional (sufijos -oso/-ico, prefijos hipo-/per-, anhídrido…): la IUPAC 2005 NO la recomienda para óxidos,
 *    hidróxidos y sales; solo acepta algunos nombres tradicionales de oxoácidos y oxoaniones y nombres comunes como
 *    agua y amoníaco.
 * Cada compuesto trae también los nombres en inglés que se usan para VALIDAR el motor contra los sinónimos reales de
 * PubChem (tests/unit/inorganicNomenclature.test.ts y scripts/validacion/nomenclatura_pubchem.mjs).
 * Funciones puras y deterministas.
 */

/* ------------------------------------------------------------------ elementos */

export type ElKind = 'metal' | 'nometal';

export interface ElementInfo {
  sym: string; z: number; es: string; en: string; group: number; period: number; kind: ElKind;
  /** Estados de oxidación positivos como catión (metales) o en óxidos (no metales). */
  ox: number[];
  /** Estados que forman oxoácidos. */
  acid?: number[];
  /** Carga como anión monoatómico en compuestos binarios (−1 halógenos, −2 S). */
  anion?: number;
  /** Adjetivos tradicionales por estado (es / en). */
  tradEs?: Record<number, string>;
  tradEn?: Record<number, string>;
}

const E = (sym: string, z: number, es: string, en: string, group: number, period: number, kind: ElKind, ox: number[], extra: Partial<ElementInfo> = {}): ElementInfo => ({ sym, z, es, en, group, period, kind, ox, ...extra });

export const ELEMENTS: ElementInfo[] = [
  E('H', 1, 'hidrógeno', 'hydrogen', 1, 1, 'nometal', [1]),
  E('Li', 3, 'litio', 'lithium', 1, 2, 'metal', [1], { tradEs: { 1: 'lítico' } }),
  E('Na', 11, 'sodio', 'sodium', 1, 3, 'metal', [1], { tradEs: { 1: 'sódico' } }),
  E('K', 19, 'potasio', 'potassium', 1, 4, 'metal', [1], { tradEs: { 1: 'potásico' } }),
  E('Mg', 12, 'magnesio', 'magnesium', 2, 3, 'metal', [2], { tradEs: { 2: 'magnésico' } }),
  E('Ca', 20, 'calcio', 'calcium', 2, 4, 'metal', [2], { tradEs: { 2: 'cálcico' } }),
  E('Ba', 56, 'bario', 'barium', 2, 6, 'metal', [2], { tradEs: { 2: 'bárico' } }),
  E('Cr', 24, 'cromo', 'chromium', 6, 4, 'metal', [2, 3], { acid: [6], tradEs: { 2: 'cromoso', 3: 'crómico' }, tradEn: { 2: 'chromous', 3: 'chromic' } }),
  E('Mn', 25, 'manganeso', 'manganese', 7, 4, 'metal', [2, 3, 4], { acid: [6, 7], tradEs: { 2: 'manganoso', 3: 'mangánico' }, tradEn: { 2: 'manganous', 3: 'manganic' } }),
  E('Fe', 26, 'hierro', 'iron', 8, 4, 'metal', [2, 3], { tradEs: { 2: 'ferroso', 3: 'férrico' }, tradEn: { 2: 'ferrous', 3: 'ferric' } }),
  E('Co', 27, 'cobalto', 'cobalt', 9, 4, 'metal', [2, 3], { tradEs: { 2: 'cobaltoso', 3: 'cobáltico' }, tradEn: { 2: 'cobaltous', 3: 'cobaltic' } }),
  E('Ni', 28, 'níquel', 'nickel', 10, 4, 'metal', [2, 3], { tradEs: { 2: 'niqueloso', 3: 'niquélico' }, tradEn: { 2: 'nickelous', 3: 'nickelic' } }),
  E('Cu', 29, 'cobre', 'copper', 11, 4, 'metal', [1, 2], { tradEs: { 1: 'cuproso', 2: 'cúprico' }, tradEn: { 1: 'cuprous', 2: 'cupric' } }),
  E('Ag', 47, 'plata', 'silver', 11, 5, 'metal', [1], { tradEs: { 1: 'argéntico' } }),
  E('Au', 79, 'oro', 'gold', 11, 6, 'metal', [1, 3], { tradEs: { 1: 'auroso', 3: 'áurico' }, tradEn: { 1: 'aurous', 3: 'auric' } }),
  E('Zn', 30, 'cinc', 'zinc', 12, 4, 'metal', [2], { tradEs: { 2: 'cíncico' } }),
  E('Hg', 80, 'mercurio', 'mercury', 12, 6, 'metal', [1, 2], { tradEs: { 1: 'mercurioso', 2: 'mercúrico' }, tradEn: { 1: 'mercurous', 2: 'mercuric' } }),
  E('Al', 13, 'aluminio', 'aluminum', 13, 3, 'metal', [3], { tradEs: { 3: 'alumínico' } }),
  E('Sn', 50, 'estaño', 'tin', 14, 5, 'metal', [2, 4], { tradEs: { 2: 'estannoso', 4: 'estánnico' }, tradEn: { 2: 'stannous', 4: 'stannic' } }),
  E('Pb', 82, 'plomo', 'lead', 14, 6, 'metal', [2, 4], { tradEs: { 2: 'plumboso', 4: 'plúmbico' }, tradEn: { 2: 'plumbous', 4: 'plumbic' } }),
  E('B', 5, 'boro', 'boron', 13, 2, 'nometal', [3], { acid: [3] }),
  E('C', 6, 'carbono', 'carbon', 14, 2, 'nometal', [2, 4], { acid: [4] }),
  E('Si', 14, 'silicio', 'silicon', 14, 3, 'nometal', [4], { acid: [4] }),
  E('N', 7, 'nitrógeno', 'nitrogen', 15, 2, 'nometal', [1, 2, 3, 4, 5], { acid: [3, 5] }),
  E('P', 15, 'fósforo', 'phosphorus', 15, 3, 'nometal', [3, 5], { acid: [3, 5] }),
  E('O', 8, 'oxígeno', 'oxygen', 16, 2, 'nometal', []),
  E('S', 16, 'azufre', 'sulfur', 16, 3, 'nometal', [4, 6], { acid: [4, 6], anion: -2 }),
  E('F', 9, 'flúor', 'fluorine', 17, 2, 'nometal', [], { anion: -1 }),
  E('Cl', 17, 'cloro', 'chlorine', 17, 3, 'nometal', [1, 3, 5, 7], { acid: [1, 3, 5, 7], anion: -1 }),
  E('Br', 35, 'bromo', 'bromine', 17, 4, 'nometal', [1], { acid: [1, 3, 5, 7], anion: -1 }),
  E('I', 53, 'yodo', 'iodine', 17, 5, 'nometal', [5], { acid: [1, 5, 7], anion: -1 }),
];

export function el(sym: string): ElementInfo {
  const e = ELEMENTS.find((x) => x.sym === sym);
  if (!e) throw new RangeError(`Elemento no incluido en el motor: ${sym}`);
  return e;
}

/** Estados positivos de un elemento en todos sus compuestos del motor (para decidir si lleva número romano). */
export function positiveStates(sym: string): number[] {
  const e = el(sym);
  return [...new Set([...e.ox, ...(e.acid ?? [])])].sort((a, b) => a - b);
}
const variable = (sym: string) => positiveStates(sym).length > 1;

export function roman(n: number): string {
  const R = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  if (!Number.isInteger(n) || n < 1 || n > 8) throw new RangeError('Número de oxidación fuera de 1–8.');
  return R[n];
}

/** Símbolos de todos los elementos (para validar lo que escribe el estudiante). */
const ALL_SYMBOLS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));

/**
 * Cuenta los átomos de una fórmula con paréntesis («Fe2(SO4)3», «Hg2Cl2»), con subíndices normales o Unicode.
 * Lanza un error comprensible si la fórmula no es válida.
 */
export function parseFormula(formula: string): Composition {
  const s = formula.replace(/\s/g, '').replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '');
  if (!s) throw new Error('La fórmula está vacía.');
  if (/[^A-Za-z0-9()[\]]/.test(s)) throw new Error(`La fórmula «${formula}» tiene caracteres no válidos.`);
  let i = 0;
  const num = () => { let t = ''; while (i < s.length && /\d/.test(s[i])) t += s[i++]; return t ? Number(t) : 1; };
  const group = (close: string | null): Composition => {
    const out: Composition = {};
    while (i < s.length) {
      const ch = s[i];
      if (ch === '(' || ch === '[') { i++; const inner = group(ch === '(' ? ')' : ']'); const n = num(); for (const [k, v] of Object.entries(inner)) out[k] = (out[k] ?? 0) + v * n; continue; }
      if (ch === ')' || ch === ']') { if (ch !== close) throw new Error(`Paréntesis sin pareja en «${formula}».`); i++; return out; }
      if (/[A-Z]/.test(ch)) {
        let e = ch; i++;
        if (i < s.length && /[a-z]/.test(s[i])) e += s[i++];
        if (!ALL_SYMBOLS.has(e)) throw new Error(`«${e}» no es el símbolo de un elemento (revisa mayúsculas y minúsculas).`);
        const n = num();
        out[e] = (out[e] ?? 0) + n;
        continue;
      }
      throw new Error(`No se entiende «${ch}» en «${formula}»: los símbolos empiezan con mayúscula.`);
    }
    if (close) throw new Error(`Falta cerrar un paréntesis en «${formula}».`);
    return out;
  };
  return group(null);
}

/* ------------------------------------------------------------------ prefijos */

const PRE_ES = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
const PRE_EN = PRE_ES;
const PRE_POLY_ES = ['', '', 'bis', 'tris', 'tetrakis', 'pentakis', 'hexakis'];

/** Prefijo + nombre con elisión solo en «monóxido» (IUPAC 2005 en español no elide las demás vocales). */
function preEs(n: number, word: string, mono: boolean): string {
  if (n === 1 && !mono) return word;
  const p = PRE_ES[n];
  if (p === 'mono' && word.startsWith('ó')) return `monó${word.slice(1)}`;
  return p + word;
}
function preEn(n: number, word: string, mono: boolean): string {
  if (n === 1 && !mono) return word;
  const p = PRE_EN[n];
  if (p === 'mono' && word.startsWith('o')) return `mon${word}`;
  if (p.endsWith('a') && word.startsWith('o')) return p.slice(0, -1) + word; // pentoxide, heptoxide (uso de PubChem)
  return p + word;
}

/* ------------------------------------------------------------------ oxoácidos y oxoaniones */

export type AcidForm = 'normal' | 'meta' | 'di';

interface AcidName { es: string; en: string; anionEs: string; anionEn: string; stemEs: string; icoEs: string }

/** Nombres tradicionales (aceptados por la IUPAC 2005 para oxoácidos y oxoaniones, tabla IR-8.1) por elemento y estado. */
const ACID_NAMES: Record<string, Record<number, AcidName>> = {
  Cl: {
    1: { es: 'hipocloroso', en: 'hypochlorous', anionEs: 'hipoclorito', anionEn: 'hypochlorite', stemEs: 'clorato', icoEs: 'clórico' },
    3: { es: 'cloroso', en: 'chlorous', anionEs: 'clorito', anionEn: 'chlorite', stemEs: 'clorato', icoEs: 'clórico' },
    5: { es: 'clórico', en: 'chloric', anionEs: 'clorato', anionEn: 'chlorate', stemEs: 'clorato', icoEs: 'clórico' },
    7: { es: 'perclórico', en: 'perchloric', anionEs: 'perclorato', anionEn: 'perchlorate', stemEs: 'clorato', icoEs: 'clórico' },
  },
  Br: {
    1: { es: 'hipobromoso', en: 'hypobromous', anionEs: 'hipobromito', anionEn: 'hypobromite', stemEs: 'bromato', icoEs: 'brómico' },
    3: { es: 'bromoso', en: 'bromous', anionEs: 'bromito', anionEn: 'bromite', stemEs: 'bromato', icoEs: 'brómico' },
    5: { es: 'brómico', en: 'bromic', anionEs: 'bromato', anionEn: 'bromate', stemEs: 'bromato', icoEs: 'brómico' },
    7: { es: 'perbrómico', en: 'perbromic', anionEs: 'perbromato', anionEn: 'perbromate', stemEs: 'bromato', icoEs: 'brómico' },
  },
  I: {
    1: { es: 'hipoyodoso', en: 'hypoiodous', anionEs: 'hipoyodito', anionEn: 'hypoiodite', stemEs: 'yodato', icoEs: 'yódico' },
    5: { es: 'yódico', en: 'iodic', anionEs: 'yodato', anionEn: 'iodate', stemEs: 'yodato', icoEs: 'yódico' },
    7: { es: 'peryódico', en: 'periodic', anionEs: 'peryodato', anionEn: 'periodate', stemEs: 'yodato', icoEs: 'yódico' },
  },
  S: {
    4: { es: 'sulfuroso', en: 'sulfurous', anionEs: 'sulfito', anionEn: 'sulfite', stemEs: 'sulfato', icoEs: 'sulfúrico' },
    6: { es: 'sulfúrico', en: 'sulfuric', anionEs: 'sulfato', anionEn: 'sulfate', stemEs: 'sulfato', icoEs: 'sulfúrico' },
  },
  N: {
    3: { es: 'nitroso', en: 'nitrous', anionEs: 'nitrito', anionEn: 'nitrite', stemEs: 'nitrato', icoEs: 'nítrico' },
    5: { es: 'nítrico', en: 'nitric', anionEs: 'nitrato', anionEn: 'nitrate', stemEs: 'nitrato', icoEs: 'nítrico' },
  },
  P: {
    3: { es: 'fosforoso', en: 'phosphorous', anionEs: 'fosfito', anionEn: 'phosphite', stemEs: 'fosfato', icoEs: 'fosfórico' },
    5: { es: 'fosfórico', en: 'phosphoric', anionEs: 'fosfato', anionEn: 'phosphate', stemEs: 'fosfato', icoEs: 'fosfórico' },
  },
  C: { 4: { es: 'carbónico', en: 'carbonic', anionEs: 'carbonato', anionEn: 'carbonate', stemEs: 'carbonato', icoEs: 'carbónico' } },
  Si: { 4: { es: 'silícico', en: 'silicic', anionEs: 'silicato', anionEn: 'silicate', stemEs: 'silicato', icoEs: 'silícico' } },
  B: { 3: { es: 'bórico', en: 'boric', anionEs: 'borato', anionEn: 'borate', stemEs: 'borato', icoEs: 'bórico' } },
  Mn: {
    6: { es: 'mangánico', en: 'manganic', anionEs: 'manganato', anionEn: 'manganate', stemEs: 'manganato', icoEs: 'mangánico' },
    7: { es: 'permangánico', en: 'permanganic', anionEs: 'permanganato', anionEn: 'permanganate', stemEs: 'manganato', icoEs: 'mangánico' },
  },
  Cr: { 6: { es: 'crómico', en: 'chromic', anionEs: 'cromato', anionEn: 'chromate', stemEs: 'cromato', icoEs: 'crómico' } },
};

/** Elementos cuyo ácido «normal» es el orto (máxima hidratación habitual): P y B con 3 H₂O, Si con 2 H₂O. */
const ORTHO_WATERS: Record<string, number> = { P: 3, B: 3, Si: 2 };
/** Formas di- (dos unidades de óxido y una de agua, o piro- = di- en el fósforo) admitidas. */
const DI_ALLOWED: Record<string, number[]> = { S: [6], Cr: [6], P: [5] };
const META_ALLOWED = new Set(['P', 'B', 'Si']);

/** Notas de rigor sobre la existencia de algunos compuestos (se muestran en la ficha del compuesto). */
const ACID_NOTES: Record<string, string> = {
  'C:4': 'El ácido carbónico solo existe en disolución acuosa (CO₂ disuelto); al calentarlo se descompone en CO₂ y H₂O.',
  'S:4': 'El ácido sulfuroso no se ha aislado: en el agua se encuentra como SO₂ disuelto; sus sales (sulfitos) sí existen.',
  'N:3': 'El ácido nitroso solo existe en disolución diluida y fría; se descompone con facilidad.',
  'Cl:1': 'El ácido hipocloroso solo existe en disolución (es el desinfectante del agua de la piscina y del blanqueador).',
  'Cl:3': 'El ácido cloroso es inestable y solo se conoce en disolución.',
  'Cl:5': 'El ácido clórico solo se conoce en disolución; sus sales, los cloratos, son oxidantes fuertes.',
  'Br:1': 'El ácido hipobromoso solo existe en disolución.',
  'Br:3': 'El ácido bromoso es muy inestable; se conoce poco.',
  'Br:7': 'El ácido perbrómico se sintetizó por primera vez en 1968; es poco común.',
  'I:1': 'El ácido hipoyodoso es inestable.',
  'I:7': 'Con yodo(VII) el ácido más común es el ortoperyódico H₅IO₆; HIO₄ es el metaperyódico.',
  'P:3': 'El ácido fosforoso H₃PO₃ es diprótico: uno de sus tres H está unido al P, no a un O. La IUPAC 2005 lo llama ácido fosfónico, HPO(OH)₂.',
  'B:3': 'El ácido bórico es un ácido débil que actúa aceptando OH⁻ del agua, no cediendo H⁺.',
  'Mn:6': 'El ácido mangánico no se ha aislado; existen sus sales, los manganatos (verdes).',
  'Mn:7': 'El ácido permangánico solo existe en disolución; su sal de potasio (KMnO₄, violeta) es muy común.',
  'Cr:6': 'El ácido crómico existe en disolución; sus sales, cromatos (amarillos) y dicromatos (naranja), son tóxicas.',
  'Si:4': 'Los ácidos silícicos se condensan con facilidad; los silicatos forman redes y cadenas (minerales y vidrio).',
};

export interface Oxoacid {
  el: string; ox: number; form: AcidForm;
  h: number; x: number; o: number;
  /** Hidrógenos ácidos (cedibles): 2 en H₃PO₃. */
  acidicH: number;
}

/** Fórmula del oxoácido: óxido + agua (orto/meta/di) y simplificación por el mcd. */
export function oxoacid(sym: string, ox: number, form: AcidForm = 'normal'): Oxoacid {
  const info = el(sym);
  if (!info.acid?.includes(ox) || !ACID_NAMES[sym]?.[ox]) throw new RangeError(`${info.es} no forma oxoácido con número de oxidación +${ox} en este motor.`);
  if (form === 'meta' && (!META_ALLOWED.has(sym) || (sym === 'P' && ox !== 5))) throw new RangeError('El prefijo meta- solo se usa aquí con P(V), B y Si.');
  if (form === 'di' && !DI_ALLOWED[sym]?.includes(ox)) throw new RangeError('La forma di- (piro-) solo se usa aquí con S(VI), Cr(VI) y P(V).');
  // Óxido X₂Oₙ (n impar) o XOₙ/₂ (n par)
  const [x0, o0] = ox % 2 ? [2, ox] : [1, ox / 2];
  let units = 1, waters = 1;
  if (form === 'normal') waters = ORTHO_WATERS[sym] ?? 1;
  if (form === 'di') { if (sym === 'P') { units = 1; waters = 2; } else { units = 2; waters = 1; } }
  let h = 2 * waters, x = x0 * units, o = o0 * units + waters;
  if (form !== 'di') { const g = gcd(gcd(h, x), o); h /= g; x /= g; o /= g; }
  return { el: sym, ox, form, h, x, o, acidicH: sym === 'P' && ox === 3 && form === 'normal' ? 2 : h };
}

const PREFIX_FORM_ES: Record<AcidForm, string> = { normal: '', meta: 'meta', di: 'di' };
const PREFIX_FORM_EN: Record<AcidForm, string> = { normal: '', meta: 'meta', di: 'di' };

function acidNames(a: Oxoacid) {
  const n = ACID_NAMES[a.el][a.ox];
  return { ...n, adjEs: PREFIX_FORM_ES[a.form] + n.es, adjEn: PREFIX_FORM_EN[a.form] + n.en, anEs: PREFIX_FORM_ES[a.form] + n.anionEs, anEn: PREFIX_FORM_EN[a.form] + n.anionEn };
}

/** Grupo de átomos de un oxoanión (X y O; los H que queden se escriben aparte). */
const groupFormula = (a: Oxoacid) => `${a.el}${a.x > 1 ? a.x : ''}O${a.o > 1 ? a.o : ''}`;

/* ------------------------------------------------------------------ especies del constructor */

export type FunctionId =
  | 'oxido-basico' | 'oxido-anfotero' | 'oxido-acido' | 'oxido-neutro' | 'peroxido' | 'hidroxido' | 'hidruro-metalico'
  | 'hidruro-no-metalico' | 'hidracido' | 'oxacido' | 'sal-haloidea' | 'oxisal' | 'sal-acida' | 'sal-basica' | 'binario-no-metalico';

export const FUNCTION_LABEL: Record<FunctionId, string> = {
  'oxido-basico': 'Óxido básico (metal + oxígeno)',
  'oxido-anfotero': 'Óxido anfótero (metal + oxígeno; reacciona con ácidos y con bases)',
  'oxido-acido': 'Óxido ácido (no metal + oxígeno; antes llamado anhídrido)',
  'oxido-neutro': 'Óxido neutro (no metal + oxígeno que no forma oxoácido)',
  peroxido: 'Peróxido (contiene el ion O₂²⁻, con O en −1)',
  hidroxido: 'Hidróxido (metal + ion OH⁻)',
  'hidruro-metalico': 'Hidruro metálico (metal + H⁻)',
  'hidruro-no-metalico': 'Hidruro no metálico (no metal + H, con nombre propio)',
  hidracido: 'Hidrácido (H + halógeno o azufre; ácido en disolución acuosa)',
  oxacido: 'Oxácido (H + no metal + O)',
  'sal-haloidea': 'Sal haloidea o binaria (metal + anión de un hidrácido)',
  oxisal: 'Oxisal neutra (metal + oxoanión)',
  'sal-acida': 'Sal ácida (conserva H del ácido)',
  'sal-basica': 'Sal básica (contiene OH⁻ además del anión)',
  'binario-no-metalico': 'Compuesto binario entre no metales',
};

/** Catión: elemento con su número de oxidación, o el ion amonio. */
export type CationRef = { el: string; ox: number } | { el: 'NH4' };

export type Spec =
  | { kind: 'oxido'; el: string; ox: number }
  | { kind: 'peroxido'; el: string }
  | { kind: 'hidroxido'; el: string; ox: number }
  | { kind: 'hidruro'; el: string }
  | { kind: 'hidracido'; el: string }
  | { kind: 'oxacido'; el: string; ox: number; form?: AcidForm }
  | { kind: 'sal-binaria'; cation: CationRef; anion: string }
  | { kind: 'oxisal'; cation: CationRef; acid: { el: string; ox: number; form?: AcidForm }; hLeft?: number }
  | { kind: 'sal-basica'; cation: { el: string; ox: number }; anion: string | { el: string; ox: number; form?: AcidForm } };

export interface Names {
  /** Sistemática estequiométrica (o de hidrógeno en los oxoácidos), IUPAC 2005. */
  sistematica: string;
  /** Stock (número de oxidación); null si no aplica. */
  stock: string | null;
  /** Tradicional; null si no existe o no se usa. */
  tradicional: string | null;
  /** Nombre común aceptado por la IUPAC (agua, amoníaco) o de uso diario. */
  comun?: string;
  /** Forma de los textos escolares anteriores (no recomendada por la IUPAC 2005). */
  antigua?: string;
  /** Variantes aceptadas en los retos, por sistema (p. ej., «pentóxido» con elisión). */
  variantes: { sistematica?: string[]; stock?: string[]; tradicional?: string[] };
}

export interface Compound {
  key: string;
  spec: Spec;
  /** Fórmula ASCII (Fe2(SO4)3) y con subíndices (Fe₂(SO₄)₃). */
  formula: string;
  formulaPretty: string;
  composition: Composition;
  fn: FunctionId;
  names: Names;
  /** Nombres en inglés (para la validación con PubChem). */
  en: { sistematica: string | null; stock: string | null; tradicional: string | null; comun?: string };
  /** Sistema recomendado por la IUPAC 2005 para este compuesto. */
  recommended: string;
  /** Explicación de la neutralidad de cargas, paso a paso. */
  neutrality: string[];
  notes: string[];
}

/* ------------------------------------------------------------------ partes de nombre */

interface Part { formula: string; charge: number; atoms: number; es: string; en: string; poly: boolean }

function cationPart(c: CationRef): Part & { info?: ElementInfo; ox?: number } {
  if (c.el === 'NH4') return { formula: 'NH4', charge: 1, atoms: 5, es: 'amonio', en: 'ammonium', poly: true };
  const info = el(c.el);
  const ox = (c as { ox: number }).ox;
  if (c.el === 'Hg' && ox === 1) return { formula: 'Hg2', charge: 2, atoms: 2, es: 'mercurio', en: 'mercury', poly: false, info, ox };
  return { formula: c.el, charge: ox, atoms: 1, es: info.es, en: info.en, poly: false, info, ox };
}

const ANION_BIN: Record<string, { es: string; en: string; hydracidEs: string; hydracidEn: string }> = {
  F: { es: 'fluoruro', en: 'fluoride', hydracidEs: 'fluorhídrico', hydracidEn: 'hydrofluoric' },
  Cl: { es: 'cloruro', en: 'chloride', hydracidEs: 'clorhídrico', hydracidEn: 'hydrochloric' },
  Br: { es: 'bromuro', en: 'bromide', hydracidEs: 'bromhídrico', hydracidEn: 'hydrobromic' },
  I: { es: 'yoduro', en: 'iodide', hydracidEs: 'yodhídrico', hydracidEn: 'hydroiodic' },
  S: { es: 'sulfuro', en: 'sulfide', hydracidEs: 'sulfhídrico', hydracidEn: 'hydrosulfuric' },
};

const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
const ionStr = (f: string, q: number) => `${prettyFormula(f)}${Math.abs(q) > 1 ? sup(Math.abs(q)) : ''}${q > 0 ? '⁺' : '⁻'}`;

/** n y m para que n·q₊ + m·q₋ = 0 con los menores enteros. */
export function neutralCounts(qPlus: number, qMinus: number): [number, number] {
  if (qPlus <= 0 || qMinus >= 0) throw new RangeError('Se necesita un catión con carga positiva y un anión con carga negativa.');
  const g = gcd(qPlus, -qMinus);
  return [-qMinus / g, qPlus / g];
}

const join = (p: Part, n: number) => (n === 1 ? p.formula : p.poly || p.formula === 'Hg2' || (p.atoms > 1 && p.formula !== 'O2') ? `(${p.formula})${n}` : `${p.formula}${n}`);

function neutralitySteps(c: Part, a: Part, n: number, m: number): string[] {
  return [
    `Catión ${ionStr(c.formula, c.charge)} (carga +${c.charge}) y anión ${ionStr(a.formula, a.charge)} (carga −${-a.charge}).`,
    `Neutralidad: ${n} · (+${c.charge}) + ${m} · (−${-a.charge}) = 0 → ${n} ${prettyFormula(c.formula)} y ${m} ${prettyFormula(a.formula)} (menores enteros: se cruzan las cargas y se simplifica por el m.c.d.).`,
  ];
}


/* ------------------------------------------------------------------ constructor */

const AMPHOTERIC = new Set(['Al:3', 'Zn:2', 'Sn:2', 'Sn:4', 'Pb:2', 'Pb:4', 'Cr:3', 'Mn:4']);
const NEUTRAL_OXIDES = new Set(['C:2', 'N:1', 'N:2']);
const PEROXIDE_EL = new Set(['H', 'Li', 'Na', 'K', 'Mg', 'Ca', 'Ba']);
const HYDRIDE_METALS = new Set(['Li', 'Na', 'K', 'Mg', 'Ca', 'Ba', 'Al']);
const NONMETAL_HYDRIDES: Record<string, { formula: string; es: string; iupac: string; sistAntigua: string; en: string; note?: string }> = {
  B: { formula: 'BH3', es: 'borano', iupac: 'borano', sistAntigua: 'trihidruro de boro', en: 'borane', note: 'El BH₃ no se aísla: forma el dímero diborano, B₂H₆.' },
  C: { formula: 'CH4', es: 'metano', iupac: 'metano', sistAntigua: 'tetrahidruro de carbono', en: 'methane' },
  Si: { formula: 'SiH4', es: 'silano', iupac: 'silano', sistAntigua: 'tetrahidruro de silicio', en: 'silane' },
  N: { formula: 'NH3', es: 'amoníaco', iupac: 'azano', sistAntigua: 'trihidruro de nitrógeno', en: 'ammonia' },
  P: { formula: 'PH3', es: 'fosfina', iupac: 'fosfano', sistAntigua: 'trihidruro de fósforo', en: 'phosphine', note: 'La IUPAC 2005 recomienda «fosfano»; «fosfina» ya no se recomienda.' },
  O: { formula: 'H2O', es: 'agua', iupac: 'oxidano', sistAntigua: 'monóxido de dihidrógeno', en: 'water' },
};
/** No metales que pueden actuar como «catión» (elemento menos electronegativo) frente a halógenos o S. */
const NONMETAL_CATIONS: Record<string, { ox: number[]; with: string[] }> = {
  B: { ox: [3], with: ['F', 'Cl', 'Br'] },
  C: { ox: [4], with: ['F', 'Cl', 'Br', 'S'] },
  Si: { ox: [4], with: ['F', 'Cl'] },
  N: { ox: [3], with: ['F', 'Cl'] },
  P: { ox: [3, 5], with: ['F', 'Cl', 'Br'] },
  S: { ox: [4, 6], with: ['F'] },
};

const recommendedText = {
  binario: 'IUPAC 2005: sistemática estequiométrica o Stock (ambas aceptadas); la tradicional no se recomienda.',
  oxacido: 'IUPAC 2005: el nombre tradicional del oxoácido está aceptado (tabla IR-8.1); el sistemático es el de hidrógeno.',
  sal: 'IUPAC 2005: Stock o estequiométrica con el nombre aceptado del oxoanión; la tradicional (-oso/-ico del metal) no se recomienda.',
  especial: 'IUPAC 2005: nombre común aceptado (agua, amoníaco) o nombre del hidruro progenitor (oxidano, azano, fosfano).',
};

function metalAdjEs(info: ElementInfo, ox: number): string | null { return info.tradEs?.[ox] ?? null; }
function metalAdjEn(info: ElementInfo, ox: number): string | null { return info.tradEn?.[ox] ?? null; }

/** Construye un compuesto a partir de su especificación (lanza RangeError si la combinación no es válida). */
export function buildCompound(spec: Spec): Compound {
  switch (spec.kind) {
    case 'oxido': return buildOxide(spec.el, spec.ox, spec);
    case 'peroxido': return buildPeroxide(spec.el, spec);
    case 'hidroxido': return buildHydroxide(spec.el, spec.ox, spec);
    case 'hidruro': return buildHydride(spec.el, spec);
    case 'hidracido': return buildHydracid(spec.el, spec);
    case 'oxacido': return buildOxoacid(spec.el, spec.ox, spec.form ?? 'normal', spec);
    case 'sal-binaria': return buildBinarySalt(spec.cation, spec.anion, spec);
    case 'oxisal': return buildOxisalt(spec.cation, spec.acid, spec.hLeft ?? 0, spec);
    case 'sal-basica': return buildBasicSalt(spec.cation, spec.anion, spec);
  }
}

export function specKey(spec: Spec): string {
  const c = (x: CationRef) => (x.el === 'NH4' ? 'NH4' : `${x.el}${(x as { ox: number }).ox}`);
  switch (spec.kind) {
    case 'oxido': return `oxido:${spec.el}${spec.ox}`;
    case 'peroxido': return `peroxido:${spec.el}`;
    case 'hidroxido': return `hidroxido:${spec.el}${spec.ox}`;
    case 'hidruro': return `hidruro:${spec.el}`;
    case 'hidracido': return `hidracido:${spec.el}`;
    case 'oxacido': return `oxacido:${spec.el}${spec.ox}${spec.form && spec.form !== 'normal' ? `-${spec.form}` : ''}`;
    case 'sal-binaria': return `sal:${c(spec.cation)}-${spec.anion}`;
    case 'oxisal': return `oxisal:${c(spec.cation)}-${spec.acid.el}${spec.acid.ox}${spec.acid.form && spec.acid.form !== 'normal' ? `-${spec.acid.form}` : ''}${spec.hLeft ? `-H${spec.hLeft}` : ''}`;
    case 'sal-basica': return `basica:${c(spec.cation)}-${typeof spec.anion === 'string' ? spec.anion : `${spec.anion.el}${spec.anion.ox}`}`;
  }
}

function finish(spec: Spec, formula: string, fn: FunctionId, names: Names, en: Compound['en'], recommended: string, neutrality: string[], notes: string[] = []): Compound {
  return { key: specKey(spec), spec, formula, formulaPretty: prettyFormula(formula), composition: parseFormula(formula), fn, names: { ...names, variantes: Object.fromEntries(Object.entries(names.variantes).map(([k, v]) => [k, [...new Set(v)].filter((x) => x && x !== names[k as NameSystem])])) }, en, recommended, neutrality, notes };
}

function buildOxide(sym: string, ox: number, spec: Spec): Compound {
  const info = el(sym);
  if (sym === 'H') throw new RangeError('El óxido de hidrógeno es el agua: elige «hidruro no metálico» de O.');
  const isMetal = info.kind === 'metal';
  const allowed = [...info.ox, ...(isMetal ? (info.acid ?? []) : [])];
  if (!allowed.includes(ox)) throw new RangeError(`${info.es} no forma óxido con +${ox} en este motor.`);
  const c = cationPart({ el: sym, ox });
  const a: Part = { formula: 'O', charge: -2, atoms: 1, es: 'óxido', en: 'oxide', poly: false };
  const [n, m] = neutralCounts(c.charge, a.charge);
  const formula = `${join(c, n)}${join(a, m)}`;
  const acidState = !isMetal || (info.acid ?? []).includes(ox);
  const keyS = `${sym}:${ox}`;
  const fn: FunctionId = NEUTRAL_OXIDES.has(keyS) ? 'oxido-neutro' : acidState ? 'oxido-acido' : AMPHOTERIC.has(keyS) ? 'oxido-anfotero' : 'oxido-basico';
  const v = variable(sym);
  const cnt = sym === 'Hg' && ox === 1 ? 2 * n : n;
  const sist = `${preEs(m, 'óxido', v)} de ${preEs(cnt, info.es, false)}`;
  const stock = `óxido de ${info.es}${v ? `(${roman(ox)})` : ''}`;
  const sistEn = `${preEn(cnt, info.en, false)} ${preEn(m, 'oxide', v)}`;
  const stockEn = `${info.en}${v ? `(${roman(ox)})` : ''} oxide`;
  let trad: string | null = null, tradEn: string | null = null;
  const vs: string[] = [];
  const notes: string[] = [];
  if (sym === 'Mn' && ox === 6) throw new RangeError('El MnO₃ no se ha aislado: el manganeso(VI) solo forma sales (manganatos).');
  if (isMetal && !acidState) {
    const adj = metalAdjEs(info, ox);
    trad = adj ? `óxido ${adj}` : null;
    const aEn = metalAdjEn(info, ox);
    tradEn = aEn ? `${aEn} oxide` : null;
  } else if (ACID_NAMES[sym]?.[ox]) {
    trad = `anhídrido ${ACID_NAMES[sym][ox].es}`;
    notes.push('«Anhídrido» es un nombre antiguo que la IUPAC ya no recomienda: hoy se dice óxido.');
  }
  if (keyS === 'N:1') { trad = 'óxido nitroso'; tradEn = 'nitrous oxide'; notes.push('Es un óxido neutro: no forma un oxoácido con el agua. Se usa como anestésico («gas de la risa»).'); }
  if (keyS === 'N:2') { trad = 'óxido nítrico'; tradEn = 'nitric oxide'; notes.push('Es un óxido neutro y un radical (tiene un electrón desapareado).'); }
  if (keyS === 'C:2') notes.push('Es un óxido neutro: no forma oxoácido. Es muy tóxico (se une a la hemoglobina).');
  if (keyS === 'N:4') notes.push('El NO₂ es un radical que se dimeriza a N₂O₄; con agua da una mezcla de HNO₃ y HNO₂ (óxido ácido mixto).');
  if (keyS === 'P:5') notes.push('La molécula real es P₄O₁₀ (fórmula molecular); P₂O₅ es la fórmula empírica que da la neutralidad de cargas.');
  if (keyS === 'P:3') notes.push('La molécula real es P₄O₆; P₂O₃ es la fórmula empírica.');
  if (keyS === 'Cl:3' || keyS === 'Cl:5') notes.push('Este óxido no se ha aislado como compuesto estable: es un «anhídrido» formal del ácido.');
  if (sym === 'Hg' && ox === 1) notes.push('El mercurio(I) existe como el ion dímero Hg₂²⁺ (Hg–Hg): por eso Hg₂O y no «HgO₀,₅».');
  if (AMPHOTERIC.has(keyS)) notes.push('Óxido anfótero: reacciona con ácidos (como óxido básico) y con bases fuertes (como óxido ácido).');
  if (keyS === 'Si:4') notes.push('El SiO₂ es un sólido de red covalente (cuarzo, arena), no una molécula aislada.');
  if (v && m === 1) vs.push(`óxido de ${preEs(cnt, info.es, false)}`);
  for (const w of ['tetraóxido', 'pentaóxido', 'heptaóxido', 'hexaóxido']) if (sist.startsWith(w)) vs.push(sist.replace(w, w.replace('aóxido', 'óxido')));
  return finish(spec, formula, fn, { sistematica: sist, stock, tradicional: trad, variantes: { sistematica: vs } }, { sistematica: sistEn, stock: stockEn, tradicional: tradEn }, recommendedText.binario, neutralitySteps(c, a, n, m), notes);
}

function buildPeroxide(sym: string, spec: Spec): Compound {
  if (!PEROXIDE_EL.has(sym)) throw new RangeError('En el motor solo forman peróxido el H y los metales de los grupos 1 y 2.');
  const info = el(sym);
  const ox = info.ox[0];
  const c = cationPart({ el: sym, ox });
  const a: Part = { formula: 'O2', charge: -2, atoms: 2, es: 'peróxido', en: 'peroxide', poly: false };
  const [n] = neutralCounts(c.charge, a.charge);
  const formula = `${join(c, n)}O2`;
  const oCount = 2;
  const sist = `${preEs(oCount, 'óxido', false)} de ${preEs(n, info.es, false)}`;
  const isH = sym === 'H';
  const names: Names = { sistematica: sist, stock: `peróxido de ${info.es}`, tradicional: isH ? null : `peróxido ${info.tradEs![ox]}`, comun: isH ? 'agua oxigenada' : undefined, variantes: {} };
  return finish(spec, formula, 'peroxido', names, { sistematica: `${preEn(n, info.en, false)} dioxide`, stock: `${info.en} peroxide`, tradicional: null }, recommendedText.binario,
    [`Ion peróxido O₂²⁻: dos O unidos entre sí (O–O), cada uno con número de oxidación −1.`, ...neutralitySteps(c, a, n, 1).slice(1)],
    ['No se simplifica el O₂²⁻: H₂O₂ y no «HO»; BaO₂ y no «BaO» (que sería el óxido).']);
}

function buildHydroxide(sym: string, ox: number, spec: Spec): Compound {
  const info = el(sym);
  if (info.kind !== 'metal' || !info.ox.includes(ox)) throw new RangeError('Los hidróxidos se forman con un metal en uno de sus números de oxidación como catión.');
  if (sym === 'Hg' && ox === 1) throw new RangeError('El hidróxido de mercurio(I) no existe como compuesto estable.');
  if (sym === 'Mn' && ox === 4) throw new RangeError('El motor no incluye «Mn(OH)₄»: el manganeso(IV) forma MnO₂.');
  const c = cationPart({ el: sym, ox });
  const a: Part = { formula: 'OH', charge: -1, atoms: 2, es: 'hidróxido', en: 'hydroxide', poly: true };
  const [n, m] = neutralCounts(c.charge, a.charge);
  const formula = `${join(c, n)}${join(a, m)}`;
  const v = variable(sym);
  const adj = metalAdjEs(info, ox), aEn = metalAdjEn(info, ox);
  const notes: string[] = [];
  if (sym === 'Ag') notes.push('El AgOH es inestable: en agua se transforma en Ag₂O.');
  if (sym === 'Cu' && ox === 1) notes.push('El CuOH es inestable y no se aísla.');
  if ((sym === 'Co' || sym === 'Ni') && ox === 3) notes.push('Más que M(OH)₃, el sólido real es un oxihidróxido MO(OH).');
  if (sym === 'Au') notes.push('Los «hidróxidos de oro» se describen mejor como óxidos hidratados.');
  if (AMPHOTERIC.has(`${sym}:${ox}`)) notes.push('Hidróxido anfótero: se disuelve en ácidos y también en bases fuertes.');
  return finish(spec, formula, 'hidroxido', {
    sistematica: `${preEs(m, 'hidróxido', v)} de ${info.es}`, stock: `hidróxido de ${info.es}${v ? `(${roman(ox)})` : ''}`, tradicional: adj ? `hidróxido ${adj}` : null, variantes: {},
  }, { sistematica: `${info.en} ${preEn(m, 'hydroxide', v)}`, stock: `${info.en}${v ? `(${roman(ox)})` : ''} hydroxide`, tradicional: aEn ? `${aEn} hydroxide` : null }, recommendedText.binario, neutralitySteps(c, a, n, m), notes);
}

function buildHydride(sym: string, spec: Spec): Compound {
  const special = NONMETAL_HYDRIDES[sym];
  if (special) {
    return finish(spec, special.formula, 'hidruro-no-metalico', { sistematica: special.iupac, stock: null, tradicional: null, comun: special.es, antigua: special.sistAntigua, variantes: { sistematica: sym === 'P' ? ['fosfano'] : [] } },
      { sistematica: null, stock: null, tradicional: null, comun: special.en }, recommendedText.especial,
      [`El hidrógeno (+1) se une al ${el(sym).es}; la fórmula sigue la valencia habitual del ${el(sym).es} (${special.formula.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])}).`], special.note ? [special.note] : []);
  }
  if (!HYDRIDE_METALS.has(sym)) throw new RangeError('En el motor forman hidruro metálico Li, Na, K, Mg, Ca, Ba y Al; los hidruros de B, C, Si, N, P y O tienen nombre propio.');
  const info = el(sym);
  const ox = info.ox[0];
  const c = cationPart({ el: sym, ox });
  const a: Part = { formula: 'H', charge: -1, atoms: 1, es: 'hidruro', en: 'hydride', poly: false };
  const [n, m] = neutralCounts(c.charge, a.charge);
  const formula = `${join(c, n)}${join(a, m)}`;
  return finish(spec, formula, 'hidruro-metalico', { sistematica: `${preEs(m, 'hidruro', false)} de ${info.es}`, stock: `hidruro de ${info.es}`, tradicional: `hidruro ${info.tradEs![ox]}`, variantes: {} },
    { sistematica: `${info.en} ${preEn(m, 'hydride', false)}`, stock: `${info.en} hydride`, tradicional: null }, recommendedText.binario,
    [`En los hidruros metálicos el hidrógeno actúa como anión hidruro H⁻ (número de oxidación −1).`, ...neutralitySteps(c, a, n, m).slice(1)]);
}

function buildHydracid(sym: string, spec: Spec): Compound {
  const an = ANION_BIN[sym];
  if (!an) throw new RangeError('Los hidrácidos del motor son HF, HCl, HBr, HI y H₂S.');
  const info = el(sym);
  const q = info.anion!;
  const n = -q;
  const formula = `H${n > 1 ? n : ''}${sym}`;
  return finish(spec, formula, 'hidracido', {
    sistematica: `${an.es} de ${preEs(n, 'hidrógeno', false)}`, stock: null, tradicional: `ácido ${an.hydracidEs}`, variantes: { sistematica: n > 1 ? [`${an.es} de hidrógeno`] : [] },
  }, { sistematica: `${n > 1 ? 'di' : ''}hydrogen ${an.en}`, stock: null, tradicional: `${an.hydracidEn} acid` }, 'IUPAC 2005: «cloruro de hidrógeno» para la sustancia pura; «ácido clorhídrico» (nombre tradicional aceptado) para su disolución acuosa.',
    [`H⁺ (+1) y ${ionStr(sym, q)} (−${-q}): ${n} · (+1) + 1 · (−${-q}) = 0.`], ['Como gas o líquido puro se nombra «… de hidrógeno»; disuelto en agua, «ácido …hídrico».']);
}

function buildOxoacid(sym: string, ox: number, form: AcidForm, spec: Spec): Compound {
  const a = oxoacid(sym, ox, form);
  const nm = acidNames(a);
  const formula = `H${a.h > 1 ? a.h : ''}${groupFormula(a)}`;
  const oxPre = (k: number) => (k === 1 ? '' : PRE_ES[k]);
  const xPre = a.x > 1 ? PRE_ES[a.x] : '';
  const isPhosphonic = sym === 'P' && ox === 3 && form === 'normal';
  const hydrogen = isPhosphonic ? 'dihidrogeno(hidridotrioxidofosfato)' : `${a.h > 1 ? PRE_ES[a.h] : ''}hidrogeno(${oxPre(a.o)}oxido${xPre}${nm.stemEs})`;
  const icoForm = PREFIX_FORM_ES[form] === 'di' ? `di${nm.icoEs}` : nm.icoEs;
  const oxo = `${a.o === 1 ? '' : PRE_ES[a.o]}oxo`;
  const antigua = `ácido ${oxo}${icoForm}(${roman(ox)})`;
  const vSist = [`${oxo}${xPre}${nm.stemEs}(${roman(ox)}) de hidrógeno`];
  const vTrad: string[] = [];
  if (form === 'normal' && ORTHO_WATERS[sym]) vTrad.push(`ácido orto${nm.es}`);
  if (form === 'di' && sym === 'P') vTrad.push('ácido pirofosfórico');
  if (form === 'di' && sym === 'S') vTrad.push('ácido pirosulfúrico');
  if (isPhosphonic) vTrad.push('ácido fosfónico');
  const oxide = ox % 2 ? `${sym}₂O${ox > 1 ? '₀₁₂₃₄₅₆₇₈₉'[ox] : ''}` : `${sym}O${ox / 2 > 1 ? '₀₁₂₃₄₅₆₇₈₉'[ox / 2] : ''}`;
  const waters = form === 'normal' ? ORTHO_WATERS[sym] ?? 1 : form === 'di' ? (sym === 'P' ? 2 : 1) : 1;
  const units = form === 'di' && sym !== 'P' ? 2 : 1;
  const steps = [
    `Óxido ácido de ${el(sym).es}(${roman(ox)}): ${oxide}. ${units > 1 ? `${units} ${oxide}` : oxide} + ${waters > 1 ? `${waters} ` : ''}H₂O → ${prettyFormula(formula)}${form !== 'di' ? ' (simplificando por el m.c.d.)' : ''}.`,
    `Comprobación: ${a.h} · (+1) + ${a.x} · (+${ox}) + ${a.o} · (−2) = ${a.h + a.x * ox - 2 * a.o}.`,
  ];
  const notes = [ACID_NOTES[`${sym}:${ox}`]].filter(Boolean) as string[];
  if (form !== 'normal' || ORTHO_WATERS[sym]) notes.push('orto-, meta- y di-/piro- indican el grado de hidratación del óxido: orto = la forma más hidratada habitual, meta = óxido + 1 H₂O, di- (piro-) = dos unidades condensadas con pérdida de agua.');
  return finish(spec, formula, 'oxacido', { sistematica: hydrogen, stock: null, tradicional: `ácido ${nm.adjEs}`, antigua, variantes: { sistematica: vSist, tradicional: vTrad } }, { sistematica: null, stock: null, tradicional: `${nm.adjEn} acid` }, recommendedText.oxacido, steps, notes);
}

function anionFromAcid(acid: { el: string; ox: number; form?: AcidForm }, hLeft: number): Part & { acidH: number; a: Oxoacid } {
  const a = oxoacid(acid.el, acid.ox, acid.form ?? 'normal');
  const nm = acidNames(a);
  if (acid.el === 'P' && acid.ox === 3) throw new RangeError('Las sales del ácido fosfónico (H₃PO₃, diprótico) no se incluyen en el motor.');
  if (acid.el === 'B') throw new RangeError('Los boratos forman aniones poliméricos; no se incluyen en el motor.');
  if (hLeft < 0 || hLeft >= a.acidicH) throw new RangeError(`El ácido tiene ${a.acidicH} hidrógenos ácidos: una sal ácida conserva de 1 a ${a.acidicH - 1}.`);
  if (hLeft > 0 && !(a.form === 'normal' && ['C:4', 'S:4', 'S:6', 'P:5'].includes(`${acid.el}:${acid.ox}`))) throw new RangeError('El motor incluye sales ácidas solo de los ácidos carbónico, sulfuroso, sulfúrico y fosfórico.');
  const g = groupFormula(a);
  const formula = hLeft ? `H${hLeft > 1 ? hLeft : ''}${g}` : g;
  const hEs = hLeft ? `${hLeft > 1 ? PRE_ES[hLeft] : ''}hidrogeno` : '';
  const hEn = hLeft ? `${hLeft > 1 ? PRE_EN[hLeft] : ''}hydrogen ` : '';
  return { formula, charge: -(a.h - hLeft), atoms: a.x + a.o + hLeft, es: `${hEs}${nm.anEs}`, en: `${hEn}${nm.anEn}`, poly: true, acidH: a.h, a };
}

/** Cationes que el motor no usa en sales (sus sales son inestables o casi inexistentes). */
function guardSaltCation(c: { info?: ElementInfo; ox?: number }) {
  const k = c.info ? `${c.info.sym}:${c.ox}` : '';
  if (k === 'Mn:4' || k === 'Ni:3' || k === 'Co:3') throw new RangeError('El motor no forma sales con Mn(IV), Co(III) ni Ni(III): son inestables o casi inexistentes; ese estado aparece en óxidos.');
}

function buildBinarySalt(cation: CationRef, anionEl: string, spec: Spec): Compound {
  const an = ANION_BIN[anionEl];
  if (!an) throw new RangeError('Aniones binarios del motor: F⁻, Cl⁻, Br⁻, I⁻ y S²⁻.');
  const a: Part = { formula: anionEl, charge: el(anionEl).anion!, atoms: 1, es: an.es, en: an.en, poly: false };
  if (cation.el !== 'NH4' && el(cation.el).kind === 'nometal') {
    const ox = (cation as { ox: number }).ox;
    const nc = NONMETAL_CATIONS[cation.el];
    if (!nc || !nc.ox.includes(ox) || !nc.with.includes(anionEl)) throw new RangeError('Esa combinación de no metales no está en el motor.');
    const info = el(cation.el);
    const c: Part = { formula: cation.el, charge: ox, atoms: 1, es: info.es, en: info.en, poly: false };
    const [n, m] = neutralCounts(ox, a.charge);
    const formula = `${join(c, n)}${join(a, m)}`;
    const v = variable(cation.el);
    return finish(spec, formula, 'binario-no-metalico', {
      sistematica: `${preEs(m, an.es, v)} de ${preEs(n, info.es, false)}`, stock: `${an.es} de ${info.es}${v ? `(${roman(ox)})` : ''}`, tradicional: null, variantes: {},
    }, { sistematica: `${preEn(n, info.en, false)} ${preEn(m, an.en, v)}`, stock: `${info.en}${v ? `(${roman(ox)})` : ''} ${an.en}`, tradicional: null },
    'IUPAC 2005: sistemática estequiométrica (la más usada entre no metales) o Stock.', [`El elemento menos electronegativo (${info.es}) se escribe primero y actúa con +${ox}; el ${el(anionEl).es} con −${-a.charge}.`, ...neutralitySteps(c, a, n, m).slice(1)],
    ['Entre no metales no hay iones: los números de oxidación son cargas formales para escribir la fórmula.']);
  }
  const c = cationPart(cation);
  if (c.info && c.info.kind === 'metal' && !c.info.ox.includes(c.ox!)) throw new RangeError(`${c.info.es} no actúa como catión con +${c.ox}.`);
  guardSaltCation(c);
  const [n, m] = neutralCounts(c.charge, a.charge);
  const formula = `${join(c, n)}${join(a, m)}`;
  return saltNames(spec, formula, c, a, n, m, 'sal-haloidea', []);
}

function saltNames(spec: Spec, formula: string, c: ReturnType<typeof cationPart>, a: Part, n: number, m: number, fn: FunctionId, extraNotes: string[], antiguaAnion?: string, tradAnionEs?: string, tradAnionEn?: string | null): Compound {
  const isNH4 = !c.info;
  const v = isNH4 ? false : variable(c.info!.sym);
  const ox = c.ox ?? 1;
  const cnt = c.formula === 'Hg2' ? 2 * n : n;
  const romanTxt = v ? `(${roman(ox)})` : '';
  const anionMult = (k: number, w: string) => (k === 1 ? w : a.poly ? `${PRE_POLY_ES[k]}(${w})` : preEs(k, w, false));
  const anionMultEn = (k: number, w: string) => (k === 1 ? w : a.poly ? `${PRE_POLY_ES[k]}(${w})` : preEn(k, w, false));
  const sist = `${a.poly ? anionMult(m, a.es) : preEs(m, a.es, v)} de ${preEs(cnt, c.es, false)}`;
  const stock = `${a.es} de ${c.es}${romanTxt}`;
  const adj = isNH4 ? 'amónico' : metalAdjEs(c.info!, ox);
  const adjEn = isNH4 ? null : metalAdjEn(c.info!, ox);
  const tAn = tradAnionEs ?? a.es;
  const trad = adj ? `${tAn} ${adj}` : null;
  const variantes = { tradicional: [!v ? `${tAn} de ${c.es}` : ''].filter(Boolean) };
  const notes = [...extraNotes];
  if (c.formula === 'Hg2') notes.push('El mercurio(I) es el ion dímero Hg₂²⁺: Hg₂Cl₂ y no «HgCl».');
  const enStock = `${c.en}${romanTxt} ${a.en}`;
  return finish(spec, formula, fn, { sistematica: sist, stock, tradicional: trad, antigua: antiguaAnion ? `${antiguaAnion} de ${c.es}${romanTxt}` : undefined, variantes },
    { sistematica: `${preEn(cnt, c.en, false)} ${a.poly ? anionMultEn(m, a.en) : preEn(m, a.en, v)}`, stock: enStock, tradicional: adjEn ? `${adjEn} ${a.en}` : tradAnionEn ? `${c.en} ${tradAnionEn}` : null },
    recommendedText.sal, neutralitySteps(c, a, n, m), notes);
}

function buildOxisalt(cation: CationRef, acid: { el: string; ox: number; form?: AcidForm }, hLeft: number, spec: Spec): Compound {
  const c = cationPart(cation);
  if (c.info && (c.info.kind !== 'metal' || !c.info.ox.includes(c.ox!))) throw new RangeError('Las oxisales del motor llevan un metal (en un número de oxidación de catión) o el ion amonio.');
  guardSaltCation(c);
  const a = anionFromAcid(acid, hLeft);
  const [n, m] = neutralCounts(c.charge, a.charge);
  const formula = `${join(c, n)}${join(a, m)}`;
  const nm = acidNames(a.a);
  const oxo = `${a.a.o === 1 ? '' : PRE_ES[a.a.o]}oxo`;
  const antigua = hLeft ? undefined : `${oxo}${a.a.x > 1 ? PRE_ES[a.a.x] : ''}${nm.stemEs}(${roman(a.a.ox)})`;
  let tradAn: string | undefined, tradAnEn: string | null = null;
  if (hLeft) {
    if (a.acidH === 2) { tradAn = `bi${nm.anEs}`; tradAnEn = `bi${nm.anEn}`; }
    else if (a.acidH === 3) tradAn = `${nm.anEs} ${hLeft === 2 ? 'diácido' : 'monoácido'}`;
  }
  const notes: string[] = [];
  if (hLeft) notes.push('Sal ácida: el anión conserva hidrógeno del ácido; la IUPAC 2005 lo nombra con el prefijo «hidrogeno» unido (hidrogenocarbonato).');
  const fn: FunctionId = hLeft ? 'sal-acida' : 'oxisal';
  const out = saltNames(spec, formula, c, a, n, m, fn, notes, antigua, tradAn, tradAnEn);
  if (hLeft && tradAn) out.names.variantes.tradicional = [...new Set([...(out.names.variantes.tradicional ?? []), `${tradAn} de ${c.es}`, `${nm.anEs} ácido de ${c.es}`])];
  return out;
}

function buildBasicSalt(cation: { el: string; ox: number }, anion: string | { el: string; ox: number; form?: AcidForm }, spec: Spec): Compound {
  const c = cationPart(cation);
  if (!c.info || c.info.kind !== 'metal' || !c.info.ox.includes(cation.ox) || c.charge !== 2) throw new RangeError('El motor forma sales básicas M(OH)X con cationes de carga +2 y aniones de carga −1.');
  const an: Part = typeof anion === 'string'
    ? { formula: anion, charge: el(anion).anion ?? 0, atoms: 1, es: ANION_BIN[anion]?.es ?? '', en: ANION_BIN[anion]?.en ?? '', poly: false }
    : anionFromAcid(anion, 0);
  if (an.charge !== -1) throw new RangeError('Para la sal básica M(OH)X elige un anión de carga −1 (Cl⁻, NO₃⁻…).');
  // Fórmula con los aniones en orden alfabético de su primer símbolo (IUPAC 2005, IR-4.4.2.1): MgCl(OH), Cu(NO3)(OH).
  const anionsSorted = [{ f: an.formula, part: an }, { f: 'OH', part: { formula: 'OH', charge: -1, atoms: 2, es: 'hidróxido', en: 'hydroxide', poly: true } as Part }].sort((p, q) => p.f.localeCompare(q.f));
  const fpart = (x: Part) => (x.poly || x.atoms > 1 ? `(${x.formula})` : x.formula);
  const formula = `${c.formula}${anionsSorted.map((x) => fpart(x.part)).join('')}`;
  const v = variable(cation.el);
  const r = v ? `(${roman(cation.ox)})` : '';
  const namesSorted = [an.es, 'hidróxido'].sort((p, q) => p.localeCompare(q, 'es'));
  const enSorted = [an.en, 'hydroxide'].sort();
  const adj = metalAdjEs(c.info, cation.ox);
  const name = `${namesSorted.join(' ')} de ${c.es}${r}`;
  return finish(spec, formula, 'sal-basica', {
    sistematica: `${namesSorted.join(' ')} de ${c.es}`, stock: name, tradicional: adj ? `${an.es} básico ${adj}` : null,
    variantes: { tradicional: [`hidroxi${an.es} de ${c.es}${r}`, `${an.es} básico de ${c.es}${r}`] },
  }, { sistematica: null, stock: `${c.en}${r} ${enSorted.join(' ')}`, tradicional: null }, 'IUPAC 2005: los aniones se nombran en orden alfabético («cloruro hidróxido»); la tradicional («cloruro básico») no se recomienda.',
  [`${ionStr(c.formula, 2)} (+2) con un OH⁻ (−1) y un ${ionStr(an.formula, -1)} (−1): (+2) + (−1) + (−1) = 0.`], ['Sal básica: proviene de neutralizar solo en parte un hidróxido con un ácido.']);
}

/* ------------------------------------------------------------------ enumeración, búsqueda y comparación */

/** Todos los compuestos que el motor puede formar (para el buscador, los retos y la validación). */
export function enumerateCompounds(): Compound[] {
  const out: Compound[] = [];
  const tryAdd = (s: Spec) => { try { out.push(buildCompound(s)); } catch { /* combinación no válida */ } };
  const metals = ELEMENTS.filter((e) => e.kind === 'metal');
  for (const e of ELEMENTS) for (const ox of [...e.ox, ...(e.kind === 'metal' ? e.acid ?? [] : [])]) tryAdd({ kind: 'oxido', el: e.sym, ox });
  for (const s of PEROXIDE_EL) tryAdd({ kind: 'peroxido', el: s });
  for (const m of metals) for (const ox of m.ox) tryAdd({ kind: 'hidroxido', el: m.sym, ox });
  for (const s of [...HYDRIDE_METALS, ...Object.keys(NONMETAL_HYDRIDES)]) tryAdd({ kind: 'hidruro', el: s });
  for (const s of Object.keys(ANION_BIN)) tryAdd({ kind: 'hidracido', el: s });
  const acids: { el: string; ox: number; form: AcidForm }[] = [];
  for (const [s, states] of Object.entries(ACID_NAMES)) for (const ox of Object.keys(states).map(Number)) for (const form of ['normal', 'meta', 'di'] as AcidForm[]) { try { oxoacid(s, ox, form); acids.push({ el: s, ox, form }); } catch { /* no aplica */ } }
  for (const a of acids) tryAdd({ kind: 'oxacido', el: a.el, ox: a.ox, form: a.form });
  const cations: CationRef[] = [...metals.flatMap((m) => m.ox.map((ox) => ({ el: m.sym, ox }))), { el: 'NH4' }];
  for (const c of cations) for (const an of Object.keys(ANION_BIN)) tryAdd({ kind: 'sal-binaria', cation: c, anion: an });
  for (const [s, nc] of Object.entries(NONMETAL_CATIONS)) for (const ox of nc.ox) for (const an of nc.with) tryAdd({ kind: 'sal-binaria', cation: { el: s, ox }, anion: an });
  for (const c of cations) for (const a of acids) for (let h = 0; h < 3; h++) tryAdd({ kind: 'oxisal', cation: c, acid: a, hLeft: h });
  for (const m of metals) for (const ox of m.ox) for (const an of ['Cl', 'Br', { el: 'N', ox: 5 }] as const) tryAdd({ kind: 'sal-basica', cation: { el: m.sym, ox }, anion: an });
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
}

/** Normaliza un nombre para compararlo: minúsculas, espacios simples, sin espacios antes de «(», tildes opcionales. */
export function normalizeName(s: string, keepAccents = true): string {
  let t = s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\)(?=[a-záéíóúñ])/g, ') ');
  if (!keepAccents) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  return t;
}

export type NameSystem = 'sistematica' | 'stock' | 'tradicional';
export const SYSTEM_LABEL: Record<NameSystem, string> = { sistematica: 'Sistemática (IUPAC)', stock: 'Stock', tradicional: 'Tradicional' };
/** Frase para «la nomenclatura …». */
export const SYSTEM_PHRASE: Record<NameSystem, string> = { sistematica: 'sistemática (IUPAC)', stock: 'Stock', tradicional: 'tradicional' };

export interface NameCheck { ok: boolean; accentsOnly: boolean; otherSystem: NameSystem | 'comun' | 'antigua' | null; message: string }

type AnySystem = NameSystem | 'comun' | 'antigua';
const ALL_SYSTEMS: AnySystem[] = ['sistematica', 'stock', 'tradicional', 'comun', 'antigua'];

/** Nombres aceptados de un compuesto en un sistema (nombre principal y variantes). */
export function acceptedNames(c: Compound, sys: AnySystem): string[] {
  const main = c.names[sys as keyof Names];
  const base = typeof main === 'string' ? [main] : [];
  const extra = sys === 'comun' || sys === 'antigua' ? [] : c.names.variantes[sys] ?? [];
  return [...base, ...extra];
}

/** Compara un nombre escrito con los del compuesto. Con `system`, solo vale ese sistema (y sus variantes). */
export function checkName(c: Compound, answer: string, system?: NameSystem): NameCheck {
  const a = normalizeName(answer), aN = normalizeName(answer, false);
  if (!a) return { ok: false, accentsOnly: false, otherSystem: null, message: 'Escribe un nombre.' };
  const target: AnySystem[] = system ? [system] : ALL_SYSTEMS;
  for (const s of target) for (const n of acceptedNames(c, s)) {
    if (normalizeName(n) === a) return { ok: true, accentsOnly: false, otherSystem: null, message: `Correcto: «${n}».` };
    if (normalizeName(n, false) === aN) return { ok: true, accentsOnly: true, otherSystem: null, message: `Correcto, pero revisa las tildes: se escribe «${n}».` };
  }
  if (system) for (const s of ALL_SYSTEMS.filter((x) => x !== system)) for (const n of acceptedNames(c, s)) if (normalizeName(n, false) === aN) {
    return { ok: false, accentsOnly: false, otherSystem: s, message: `«${n}» es un nombre válido, pero de otro sistema (${s === 'comun' ? 'nombre común' : s === 'antigua' ? 'forma antigua de los textos escolares' : SYSTEM_LABEL[s]}). Aquí se pide la nomenclatura ${SYSTEM_PHRASE[system]}.` };
  }
  return { ok: false, accentsOnly: false, otherSystem: null, message: 'No coincide con ningún nombre aceptado de este compuesto: revisa el número de oxidación y los prefijos o sufijos.' };
}

export interface FormulaCheck { ok: boolean; message: string }

/** Compara una fórmula escrita con la del compuesto (conteo de átomos y agrupación). */
export function checkFormula(c: Compound, answer: string): FormulaCheck {
  let comp: Composition;
  try { comp = parseFormula(answer); } catch (e) { return { ok: false, message: (e as Error).message }; }
  const els = [...new Set([...Object.keys(comp), ...Object.keys(c.composition)])];
  const diff = els.filter((k) => (comp[k] ?? 0) !== (c.composition[k] ?? 0));
  if (!diff.length) {
    const clean = answer.replace(/\s/g, '').replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
    if (clean !== c.formula) return { ok: true, message: `Correcto: los átomos coinciden. La forma convencional es ${c.formulaPretty}.` };
    return { ok: true, message: `Correcto: ${c.formulaPretty}.` };
  }
  const missingEls = diff.filter((k) => !c.composition[k]);
  if (missingEls.length) return { ok: false, message: `Sobra ${missingEls.map((k) => el(k)?.es ?? k).join(' y ')}: revisa qué elementos forman el compuesto.` };
  return { ok: false, message: `El número de átomos no cuadra (${diff.map((k) => `${k}: escribiste ${comp[k] ?? 0}`).join('; ')}). Aplica la neutralidad de cargas: la suma de cargas debe ser cero.` };
}

/** Busca un compuesto del motor por su fórmula (por composición). */
export function findByFormula(formula: string, pool: Compound[] = enumerateCompounds()): Compound | undefined {
  let comp: Composition;
  try { comp = parseFormula(formula); } catch { return undefined; }
  const key = (x: Composition) => Object.entries(x).sort(([p], [q]) => p.localeCompare(q)).map(([k, v]) => `${k}${v}`).join('');
  const k = key(comp);
  return pool.find((c) => key(c.composition) === k);
}

/** Fórmula de Hill (sin C: orden alfabético incluido el H), como la reporta PubChem. */
export function hillFormula(comp: Composition): string {
  const keys = Object.keys(comp).sort();
  const order = comp.C ? ['C', ...(comp.H ? ['H'] : []), ...keys.filter((k) => k !== 'C' && k !== 'H')] : keys;
  return order.map((k) => `${k}${comp[k] > 1 ? comp[k] : ''}`).join('');
}

/* ------------------------------------------------------------------ retos */

export type ChallengeMode = 'nombrar' | 'formular';
export interface Challenge { id: string; mode: ChallengeMode; system: NameSystem; compound: Compound; prompt: string }

/** Conjunto curado de compuestos para los retos (de uso común en el aula; todos generados por el motor). */
export const CHALLENGE_SPECS: Spec[] = [
  { kind: 'oxido', el: 'Fe', ox: 3 }, { kind: 'oxido', el: 'Fe', ox: 2 }, { kind: 'oxido', el: 'Cu', ox: 1 }, { kind: 'oxido', el: 'Cu', ox: 2 },
  { kind: 'oxido', el: 'Ca', ox: 2 }, { kind: 'oxido', el: 'Na', ox: 1 }, { kind: 'oxido', el: 'Al', ox: 3 }, { kind: 'oxido', el: 'Pb', ox: 4 },
  { kind: 'oxido', el: 'Sn', ox: 2 }, { kind: 'oxido', el: 'C', ox: 4 }, { kind: 'oxido', el: 'S', ox: 6 }, { kind: 'oxido', el: 'S', ox: 4 },
  { kind: 'oxido', el: 'N', ox: 5 }, { kind: 'oxido', el: 'Cl', ox: 7 }, { kind: 'oxido', el: 'P', ox: 5 },
  { kind: 'hidroxido', el: 'Na', ox: 1 }, { kind: 'hidroxido', el: 'Ca', ox: 2 }, { kind: 'hidroxido', el: 'Fe', ox: 3 }, { kind: 'hidroxido', el: 'Cu', ox: 2 }, { kind: 'hidroxido', el: 'Al', ox: 3 },
  { kind: 'peroxido', el: 'H' }, { kind: 'peroxido', el: 'Na' }, { kind: 'hidruro', el: 'Na' }, { kind: 'hidruro', el: 'N' },
  { kind: 'hidracido', el: 'Cl' }, { kind: 'hidracido', el: 'S' },
  { kind: 'oxacido', el: 'S', ox: 6 }, { kind: 'oxacido', el: 'N', ox: 5 }, { kind: 'oxacido', el: 'Cl', ox: 1 }, { kind: 'oxacido', el: 'Cl', ox: 7 },
  { kind: 'oxacido', el: 'C', ox: 4 }, { kind: 'oxacido', el: 'P', ox: 5 }, { kind: 'oxacido', el: 'N', ox: 3 },
  { kind: 'sal-binaria', cation: { el: 'Na', ox: 1 }, anion: 'Cl' }, { kind: 'sal-binaria', cation: { el: 'Fe', ox: 3 }, anion: 'Cl' }, { kind: 'sal-binaria', cation: { el: 'Hg', ox: 1 }, anion: 'Cl' },
  { kind: 'sal-binaria', cation: { el: 'Pb', ox: 2 }, anion: 'S' },
  { kind: 'oxisal', cation: { el: 'Ca', ox: 2 }, acid: { el: 'C', ox: 4 } }, { kind: 'oxisal', cation: { el: 'Cu', ox: 2 }, acid: { el: 'S', ox: 6 } },
  { kind: 'oxisal', cation: { el: 'Fe', ox: 3 }, acid: { el: 'S', ox: 6 } }, { kind: 'oxisal', cation: { el: 'K', ox: 1 }, acid: { el: 'N', ox: 5 } },
  { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'Cl', ox: 1 } }, { kind: 'oxisal', cation: { el: 'K', ox: 1 }, acid: { el: 'Mn', ox: 7 } },
  { kind: 'oxisal', cation: { el: 'NH4' }, acid: { el: 'S', ox: 6 } }, { kind: 'oxisal', cation: { el: 'Ca', ox: 2 }, acid: { el: 'P', ox: 5 } },
  { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'C', ox: 4 }, hLeft: 1 }, { kind: 'oxisal', cation: { el: 'K', ox: 1 }, acid: { el: 'P', ox: 5 }, hLeft: 2 },
];

/** Genera n retos reproducibles con una semilla. */
export function makeChallenges(seed: number, n = 10): Challenge[] {
  const rnd = seededRandom(seed);
  const pool = CHALLENGE_SPECS.map(buildCompound);
  const out: Challenge[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < pool.length) {
    const i = Math.floor(rnd() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    const c = pool[i];
    const mode: ChallengeMode = rnd() < 0.5 ? 'nombrar' : 'formular';
    const systems: NameSystem[] = (['sistematica', 'stock', 'tradicional'] as NameSystem[]).filter((s) => c.names[s]);
    const system = systems[Math.floor(rnd() * systems.length)];
    const shown = c.names[system] ?? c.names.comun ?? c.names.sistematica;
    out.push({ id: `${seed}-${out.length + 1}`, mode, system, compound: c, prompt: mode === 'nombrar' ? `Escribe el nombre en la nomenclatura ${SYSTEM_PHRASE[system]} de ${c.formulaPretty}` : `Escribe la fórmula de «${shown}»` });
  }
  return out;
}

/* ------------------------------------------------------------------ ficha del modelo */

export const nomenclatureModelSpec: ModelSpec = {
  name: 'Motor de nomenclatura inorgánica: fórmula por neutralidad de cargas y nombres sistemático, Stock y tradicional',
  inputs: [
    { symbol: 'A', name: 'Elemento que actúa como catión (metal, NH₄⁺ o no metal menos electronegativo)', unit: '—', initial: 'Fe' },
    { symbol: 'n.o.(A)', name: 'Número de oxidación del catión', unit: '—', initial: 3 },
    { symbol: 'B', name: 'Parte negativa: O²⁻, O₂²⁻, OH⁻, H⁻, X⁻, S²⁻ u oxoanión', unit: '—', initial: 'O²⁻' },
  ],
  outputs: [
    { symbol: 'fórmula', name: 'Fórmula con los menores enteros que hacen neutro el compuesto', unit: '—' },
    { symbol: 'nombres', name: 'Nombres sistemático (prefijos), Stock (romanos) y tradicional (-oso/-ico)', unit: '—' },
    { symbol: 'función', name: 'Función química (óxido básico/ácido, hidróxido, hidrácido, oxácido, sal, hidruro, peróxido)', unit: '—' },
  ],
  equations: [
    'Neutralidad: n·q(catión) + m·q(anión) = 0 → n = |q(anión)|/mcd, m = q(catión)/mcd',
    'Oxoácido: óxido ácido + k·H₂O (k = 1; orto: P, B con 3 y Si con 2; di-/piro-: 2 óxidos + 1 H₂O o P₂O₅ + 2 H₂O), simplificado por el mcd',
    'Oxoanión: -oso → -ito, -ico → -ato (hipo-…-ito, per-…-ato); sal ácida: prefijo hidrogeno-',
    'Stock: número de oxidación en romanos solo si el elemento tiene más de uno',
  ],
  initialConditions: ['Hierro(III) con óxido: Fe₂O₃, trióxido de dihierro, óxido de hierro(III), óxido férrico.'],
  assumptions: [
    'Se usan los números de oxidación habituales que se enseñan en 10.º; el motor no predice si un compuesto es estable.',
    'El mercurio(I) se trata como el ion dímero Hg₂²⁺ y el peróxido como O₂²⁻ (no se simplifican).',
    'Las notas de cada compuesto advierten cuando la fórmula es empírica (P₂O₅ ↔ P₄O₁₀) o el compuesto no se ha aislado.',
  ],
  limits: [
    'No incluye compuestos de coordinación, hidratos, oxosales dobles, tioácidos ni los nombres aditivos completos de la IUPAC.',
    'Los nombres tradicionales de metales con un solo número de oxidación (óxido sódico) son de uso escolar; la IUPAC no los recomienda.',
    'Las sales del ácido fosfónico (H₃PO₃) y los boratos no se incluyen por su estructura especial.',
  ],
  testCases: [
    '≥ 80 compuestos de referencia: la fórmula coincide con la de PubChem y los nombres en inglés generados por el mismo motor aparecen entre los sinónimos del CID (tests/unit/inorganicNomenclature.test.ts).',
    'Casos difíciles: FeO/Fe₂O₃, Cu₂O/CuO, SnO/SnO₂, PbO/PbO₂, Hg₂Cl₂/HgCl₂, ácidos del Cl, Br, I, S, N, P, C, Mn y Cr, peróxidos e hidruros.',
    'Neutralidad: la suma de cargas de cada fórmula generada es cero.',
  ],
};

import { equationText, prettyFormula, solveBalance, type ReactionDef, type SpeciesDef } from './balancing';
import {
  buildCompound, el as engineEl, ELEMENTS, FUNCTION_LABEL, oxoacid, roman, specKey, type AcidForm, type Compound, type Spec,
} from './inorganicNomenclature';
import { CATEGORY_LABEL, isRadioactive, isSynthetic, ptElement, type PtElement } from './periodicTable';
import type { ModelSpec } from './types';

/**
 * Taller de formación de compuestos (grado 10.º): el estudiante elige los elementos (y sus números de oxidación) en
 * la tabla periódica y una ruta de formación; el taller
 *  1. valida químicamente la combinación y, si no es posible, explica por qué (gases nobles, estados que el elemento no
 *     presenta, metales que no forman oxácidos, dos metales, etc.);
 *  2. construye el producto con el motor de nomenclatura (src/models/inorganicNomenclature.ts, validado con 149
 *     compuestos y los sinónimos de PubChem): fórmula por neutralidad de cargas, función y nombres sistemático, Stock
 *     y tradicional;
 *  3. balancea la ecuación con el método algebraico de src/models/balancing.ts (espacio nulo exacto);
 *  4. declara si la ecuación es una reacción directa conocida, si requiere condiciones especiales o si solo es una
 *     relación formal de composición (no la vía real de obtención).
 * La marca «registrado en PubChem / fórmula formal» se lee del archivo precalculado src/data/quimica/
 * compuestos-pubchem.json (scripts/validacion/compuestos_pubchem.mjs) en src/models/compoundForgeRegistry.ts.
 * Funciones puras y deterministas.
 */

/* ------------------------------------------------------------------ rutas */

export type RouteId = 'metal-o2' | 'nometal-o2' | 'peroxido' | 'metal-h2' | 'oxido-agua' | 'anhidrido-agua' | 'h2-nometal' | 'neutralizacion' | 'metal-nometal';
export type ForgeFamily = 'oxidos' | 'hidroxidos-acidos' | 'sales';

export interface RouteDef {
  id: RouteId;
  label: string;
  family: ForgeFamily;
  slots: 1 | 2;
  /** Rótulo de cada casilla de elemento. */
  slotLabels: string[];
  help: string;
}

export const ROUTES: RouteDef[] = [
  { id: 'metal-o2', label: 'Metal + O₂ → óxido básico', family: 'oxidos', slots: 1, slotLabels: ['Metal'], help: 'Elige un metal y su número de oxidación; el oxígeno actúa con −2. (Cr con +6 y Mn con +7 forman óxidos ácidos).' },
  { id: 'nometal-o2', label: 'No metal + O₂ → óxido ácido (anhídrido)', family: 'oxidos', slots: 1, slotLabels: ['No metal'], help: 'Elige un no metal y su número de oxidación positivo; el oxígeno actúa con −2.' },
  { id: 'peroxido', label: 'Metal (grupos 1 y 2) o H₂ + O₂ → peróxido', family: 'oxidos', slots: 1, slotLabels: ['Metal de los grupos 1 o 2, o H'], help: 'El ion peróxido O₂²⁻ tiene dos O unidos entre sí, cada uno con −1.' },
  { id: 'metal-h2', label: 'Metal + H₂ → hidruro metálico', family: 'oxidos', slots: 1, slotLabels: ['Metal'], help: 'Con los metales más activos el hidrógeno actúa como ion hidruro H⁻ (−1).' },
  { id: 'oxido-agua', label: 'Óxido básico + H₂O → hidróxido', family: 'hidroxidos-acidos', slots: 1, slotLabels: ['Metal del óxido'], help: 'Elige el metal del óxido y su número de oxidación: el óxido básico con agua da el hidróxido (ion OH⁻).' },
  { id: 'anhidrido-agua', label: 'Óxido ácido + H₂O → oxácido', family: 'hidroxidos-acidos', slots: 1, slotLabels: ['No metal del óxido (o metal en estado alto)'], help: 'Elige el no metal (o un metal en su estado más alto: V, Cr, Mo, W, Mn, Re o Sb) y su número de oxidación: óxido ácido + agua → oxácido.' },
  { id: 'h2-nometal', label: 'H₂ + halógeno o calcógeno → hidrácido', family: 'hidroxidos-acidos', slots: 1, slotLabels: ['No metal'], help: 'Con F, Cl, Br, I, S, Se o Te se forma un hidrácido; con N, P, As, C, Si, B u O, un hidruro no metálico (NH₃, AsH₃, CH₄, H₂O…).' },
  { id: 'neutralizacion', label: 'Ácido + hidróxido → sal + agua', family: 'sales', slots: 2, slotLabels: ['Metal del hidróxido', 'No metal del ácido'], help: 'Casilla 1: el metal del hidróxido. Casilla 2: el no metal del ácido (estado negativo = hidrácido; positivo = oxácido).' },
  { id: 'metal-nometal', label: 'Metal + no metal → sal binaria', family: 'sales', slots: 2, slotLabels: ['Metal', 'No metal (halógeno, S, Se o Te)'], help: 'Casilla 1: el metal. Casilla 2: un halógeno (F, Cl, Br, I) o un calcógeno (S, Se, Te), que actúan como aniones.' },
];

export const FAMILY_LABEL: Record<ForgeFamily, string> = { oxidos: 'Óxidos, peróxidos e hidruros', 'hidroxidos-acidos': 'Hidróxidos y ácidos', sales: 'Sales' };

export function routeById(id: RouteId): RouteDef {
  const r = ROUTES.find((x) => x.id === id);
  if (!r) throw new RangeError(`Ruta desconocida: ${id}`);
  return r;
}

/* ------------------------------------------------------------------ estados de oxidación conocidos */

/** Elementos que incluye el motor (77 desde la v2.5.0; 31 hasta la v2.4.0): los únicos con estados y nombres documentados. */
export const ENGINE_SYMBOLS: string[] = ELEMENTS.map((e) => e.sym);
const ENGINE = new Set(ENGINE_SYMBOLS);

/**
 * Números de oxidación habituales (los que se enseñan en 10.º y 11.º y usa el motor, más los negativos de los no metales).
 * Fuentes: Greenwood, N. N. y Earnshaw, A. (1997). Chemistry of the Elements (2.ª ed.), capítulo del grupo de cada
 * elemento; la tabla de estados de oxidación de la IUPAC; y, para cada compuesto, el CRC Handbook of Chemistry and
 * Physics («Physical Constants of Inorganic Compounds») y su registro en PubChem (src/data/quimica/compuestos-pubchem.json).
 * Los lantánidos actúan con +3 (el Ce también con +4 y el Eu con +2, ambos habituales); el Pm no se incluye (sintético).
 */
export const KNOWN_STATES: Record<string, number[]> = {
  H: [-1, 1], Li: [1], Na: [1], K: [1], Rb: [1], Cs: [1], Be: [2], Mg: [2], Ca: [2], Sr: [2], Ba: [2], Al: [3],
  Sc: [3], Y: [3], La: [3], Ce: [3, 4], Pr: [3], Nd: [3], Sm: [3], Eu: [2, 3], Gd: [3], Tb: [3], Dy: [3], Ho: [3], Er: [3], Tm: [3], Yb: [3], Lu: [3],
  Ti: [3, 4], Zr: [4], Hf: [4], V: [2, 3, 4, 5], Nb: [5], Ta: [5], Cr: [2, 3, 6], Mo: [4, 6], W: [4, 6], Mn: [2, 3, 4, 6, 7], Re: [4, 7],
  Fe: [2, 3], Ru: [3, 4], Os: [4], Co: [2, 3], Rh: [3], Ir: [3, 4], Ni: [2, 3], Pd: [2], Pt: [2, 4],
  Cu: [1, 2], Ag: [1], Au: [1, 3], Zn: [2], Cd: [2], Hg: [1, 2], Ga: [3], In: [3], Tl: [1, 3], Ge: [2, 4], Sn: [2, 4], Pb: [2, 4], Sb: [3, 5], Bi: [3], Po: [2, 4],
  B: [3], C: [-4, 2, 4], Si: [-4, 4], N: [-3, 1, 2, 3, 4, 5], P: [-3, 3, 5], As: [-3, 3, 5], O: [-2, -1], S: [-2, 4, 6], Se: [-2, 4, 6], Te: [-2, 4, 6],
  F: [-1], Cl: [-1, 1, 3, 5, 7], Br: [-1, 1, 3, 5, 7], I: [-1, 1, 5, 7],
};

/** Estados reales pero poco comunes, con un ejemplo documentado (el taller no los incluye y lo explica). */
export const RARE_STATES: Record<string, { states: number[]; example: string }> = {
  Cr: { states: [1, 4, 5], example: 'el CrO₂ de las cintas magnéticas (+4)' },
  Mn: { states: [5], example: 'el ion MnO₄³⁻ (+5)' },
  Fe: { states: [4, 6], example: 'los ferratos, FeO₄²⁻ (+6)' },
  Co: { states: [4], example: 'algunos óxidos mixtos de las baterías (+4)' },
  Ni: { states: [4], example: 'el K₂NiF₆ (+4)' },
  Cu: { states: [3], example: 'algunos superconductores y complejos (+3)' },
  Ag: { states: [2, 3], example: 'el AgF₂ (+2)' },
  Au: { states: [5], example: 'el fluoruro de oro(V) (+5)' },
  C: { states: [-3, -2, -1, 1, 3], example: 'los compuestos orgánicos (estados intermedios)' },
  Si: { states: [2], example: 'el SiO gaseoso (+2)' },
  N: { states: [-2, -1], example: 'la hidracina N₂H₄ (−2) y la hidroxilamina NH₂OH (−1)' },
  P: { states: [1], example: 'el ácido hipofosforoso H₃PO₂ (+1)' },
  S: { states: [-1, 2], example: 'la pirita FeS₂ (−1) y el SCl₂ (+2)' },
  O: { states: [1, 2], example: 'el OF₂ (+2) y el O₂F₂ (+1)' },
  Cl: { states: [4, 6], example: 'el ClO₂ (+4) y el Cl₂O₆ (+6)' },
  Br: { states: [4], example: 'el BrO₂ (+4)' },
  I: { states: [3], example: 'el ICl₃ (+3)' },
  // v2.5.0
  Ti: { states: [2], example: 'el TiO y el TiCl₂ (+2)' },
  Zr: { states: [2, 3], example: 'el ZrCl₃ (+3)' },
  Nb: { states: [3, 4], example: 'el NbCl₄ (+4)' },
  Ta: { states: [3, 4], example: 'el TaCl₄ (+4)' },
  Mo: { states: [2, 3, 5], example: 'el MoCl₃ (+3) y el MoCl₅ (+5)' },
  W: { states: [2, 3, 5], example: 'el WCl₅ (+5)' },
  Re: { states: [3, 5, 6], example: 'el ReO₃ (+6) y el ReCl₃ (+3)' },
  Ru: { states: [2, 6], example: 'los rutenatos, RuO₄²⁻ (+6), y el RuO₄ (+8)' },
  Os: { states: [2, 3, 6], example: 'el osmato de potasio, K₂OsO₄ (+6), y el OsO₄ (+8)' },
  Rh: { states: [1, 4], example: 'el catalizador de Wilkinson (+1) y el RhO₂ (+4)' },
  Ir: { states: [1, 6], example: 'el complejo de Vaska (+1) y el IrF₆ (+6)' },
  Pd: { states: [4], example: 'el PdO₂ y el K₂PdCl₆ (+4)' },
  Pt: { states: [5, 6], example: 'el PtF₆ (+6)' },
  Ga: { states: [1], example: 'el Ga₂O (+1)' },
  In: { states: [1], example: 'el InCl (+1)' },
  Bi: { states: [5], example: 'el bismutato de sodio, NaBiO₃ (+5)' },
  Po: { states: [-2, 6], example: 'el polonuro de plomo, PbPo (−2)' },
  Se: { states: [2], example: 'el SeCl₂ (+2)' },
  Te: { states: [2], example: 'el TeCl₂ (+2)' },
  Sm: { states: [2], example: 'el SmI₂ (+2), un reductor muy usado en síntesis' },
  Yb: { states: [2], example: 'el YbCl₂ (+2)' },
  Tb: { states: [4], example: 'el TbO₂ (+4)' },
  Pr: { states: [4], example: 'el PrO₂ (+4)' },
};

/** Rango de números de oxidación que ofrece la interfaz (para que el estudiante pueda equivocarse y aprender). */
export const STATE_CHOICES = [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7];

export const stateLabel = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
const listStates = (a: number[]) => a.map(stateLabel).join(', ');

/** Aniones monoatómicos de los hidrácidos y las sales binarias. */
const ANION_STATE: Record<string, number> = { F: -1, Cl: -1, Br: -1, I: -1, S: -2, Se: -2, Te: -2 };
/** Número de oxidación del no metal en los hidruros no metálicos (según la electronegatividad relativa al H). */
const HYDRIDE_STATES: Record<string, number[]> = { N: [-3], P: [-3], As: [-3], C: [-4], Si: [4, -4], B: [3], O: [-2] };
const HYDRIDE_METALS = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Mg', 'Ca', 'Sr', 'Ba', 'Al']);
const PEROXIDE_EL = new Set(['H', 'Li', 'Na', 'K', 'Rb', 'Cs', 'Mg', 'Ca', 'Sr', 'Ba']);
/** Elementos que en las ecuaciones se escriben como moléculas diatómicas. */
const DIATOMIC = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I']);

const isMetal = (sym: string) => engineEl(sym).kind === 'metal';
/** «Cr(+6) → H₂CrO₄, Mn(+6, +7) → …»: metales del motor que forman oxácidos, para las explicaciones. */
const ACID_METALS = ELEMENTS.filter((e) => e.kind === 'metal' && e.acid?.length).map((e) => `${e.sym}(${e.acid!.map((x) => `+${x}`).join(', ')}) → ${e.acid!.map((x) => buildCompound({ kind: 'oxacido', el: e.sym, ox: x }).formulaPretty).join(', ')}`).join('; ');
const nameOf = (sym: string) => ptElement(sym).es;
/** «el calcio», «la plata». */
const art = (sym: string) => (sym === 'Ag' ? `la ${nameOf(sym)}` : `el ${nameOf(sym)}`);
const Art = (sym: string) => { const s = art(sym); return s[0].toUpperCase() + s.slice(1); };
const del = (sym: string) => (sym === 'Ag' ? `de la ${nameOf(sym)}` : `del ${nameOf(sym)}`);
const elementFormula = (sym: string) => (DIATOMIC.has(sym) ? `${sym}2` : sym);

/** Estados con los que el elemento cumple cada papel en el motor (para marcar los «habituales» en la interfaz). */
export function suggestedStates(route: RouteId, slot: 0 | 1, sym: string | null): number[] {
  if (!sym || !ENGINE.has(sym)) return [];
  const e = engineEl(sym);
  const metal = e.kind === 'metal';
  switch (route) {
    case 'metal-o2': return metal ? [...e.ox, ...(e.acid ?? []).filter((x) => !(sym === 'Mn' && x === 6))] : [];
    case 'nometal-o2': return metal || sym === 'O' || sym === 'H' ? [] : e.ox;
    case 'peroxido': return PEROXIDE_EL.has(sym) ? [e.ox[0]] : [];
    case 'metal-h2': return HYDRIDE_METALS.has(sym) ? [e.ox[0]] : [];
    case 'oxido-agua': return metal ? e.ox.filter((x) => !(sym === 'Hg' && x === 1) && !(sym === 'Mn' && x === 4)) : [];
    case 'anhidrido-agua': return e.acid ?? [];
    case 'h2-nometal': return ANION_STATE[sym] !== undefined ? [ANION_STATE[sym]] : HYDRIDE_STATES[sym] ?? [];
    case 'neutralizacion': return slot === 0 ? (metal ? e.ox : []) : [...(ANION_STATE[sym] !== undefined ? [ANION_STATE[sym]] : []), ...(e.acid ?? [])];
    case 'metal-nometal': return slot === 0 ? (metal ? e.ox : []) : ANION_STATE[sym] !== undefined ? [ANION_STATE[sym]] : [];
  }
}

/* ------------------------------------------------------------------ resultado */

export interface ForgeInput {
  route: RouteId;
  a: string | null;
  oxA?: number | null;
  b?: string | null;
  oxB?: number | null;
  /** Grado de hidratación del oxácido (normal = orto habitual, meta, di-/piro-). */
  form?: AcidForm;
  /** Hidrógenos que conserva la sal (neutralización parcial → sal ácida). */
  hLeft?: number;
}

export interface ForgeTerm {
  formula: string;
  pretty: string;
  name: string;
  coef: number;
  role: 'elemento' | 'compuesto' | 'formal';
  compound?: Compound;
}

export type Pathway = 'directa' | 'condiciones' | 'formal';
export const PATHWAY_LABEL: Record<Pathway, string> = {
  directa: 'Reacción directa conocida',
  condiciones: 'Ocurre solo en condiciones especiales',
  formal: 'Relación formal de composición (no es la vía real de obtención)',
};

export interface ForgeOk {
  ok: true;
  input: ForgeInput;
  route: RouteDef;
  product: Compound;
  /** Agua de la neutralización. */
  byproduct?: Compound;
  reactants: ForgeTerm[];
  products: ForgeTerm[];
  /** Ecuación balanceada con subíndices y coeficientes («2 Ca + O₂ → 2 CaO»). */
  equation: string;
  /** Ecuaciones del método algebraico, una por elemento. */
  balanceSteps: string[];
  pathway: Pathway;
  pathwayNote: string;
  notes: string[];
  /** Elementos elegidos con su número de oxidación («Ca (+2)»). */
  chosen: string;
}

export type ForgeErrorCode =
  | 'sin-elemento' | 'sin-estado' | 'gas-noble' | 'fuera-del-taller' | 'estado-inexistente' | 'estado-raro' | 'papel'
  | 'no-es-metal' | 'no-es-no-metal' | 'metal-sin-oxacido' | 'oxido-neutro' | 'dos-metales' | 'dos-no-metales' | 'motor';

export interface ForgeError { ok: false; code: ForgeErrorCode; title: string; message: string; hint?: string }
export type ForgeOutcome = ForgeOk | ForgeError;

const err = (code: ForgeErrorCode, title: string, message: string, hint?: string): ForgeError => ({ ok: false, code, title, message, hint });

/* ------------------------------------------------------------------ validación de elementos y estados */

/**
 * Elementos que el taller NO habilita (además de los gases nobles), con el motivo que se explica al tocarlos.
 * Todos son radiactivos; la mayoría, además, sintéticos o sin compuestos que se estudien en 10.º–11.º.
 */
export const EXCLUDED_REASON: Record<string, string> = {
  Fr: 'El francio es radiactivo: su isótopo más estable dura unos 22 minutos y nunca se ha reunido una cantidad visible. Por su grupo formaría compuestos como los del cesio (Fr₂O, FrOH), pero no se han preparado ni estudiado.',
  Ra: 'El radio es muy radiactivo. Su química se parece a la del bario (RaCl₂, RaSO₄), pero solo se trabaja en laboratorios especiales y no forma parte de la química escolar.',
  Tc: 'El tecnecio es sintético y radiactivo (no tiene isótopos estables). Forma, por ejemplo, el ion pertecnetato TcO₄⁻ que se usa en medicina nuclear, pero solo se manipula en instalaciones especiales.',
  Pm: 'El prometio es sintético y radiactivo (no tiene isótopos estables); como los demás lantánidos actuaría con +3, pero casi no se ha estudiado.',
  At: 'El astato es radiactivo y extremadamente escaso (su isótopo más estable dura unas 8 horas): solo se han estudiado cantidades diminutas y casi no se conoce su química.',
  Ac: 'El actinio es muy radiactivo; su química (+3) se parece a la del lantano, pero solo se trabaja en laboratorios especiales.',
  Th: 'El torio es radiactivo. Forma compuestos conocidos (ThO₂, ThCl₄, con +4), pero su manejo requiere instalaciones especiales y no forma parte de la química escolar.',
  Pa: 'El protactinio es muy radiactivo y escaso; su química casi no se estudia fuera de los laboratorios nucleares.',
  U: 'El uranio es radiactivo. Tiene compuestos conocidos (UO₂, UF₆ y el ion uranilo UO₂²⁺, con +4 y +6), pero su química (muchos estados y oxocationes) no se trabaja en 10.º–11.º y su manejo requiere instalaciones especiales.',
};
const ACTINIDE_REASON = 'Es un actínido sintético y radiactivo: solo se han obtenido cantidades pequeñas (a veces unos pocos átomos) en reactores o aceleradores, así que su química no se estudia en el colegio.';

function nobleGasError(pt: PtElement): ForgeError {
  const shell = pt.sym === 'He' ? '1s²' : 'ns² np⁶';
  let extra = '';
  if (pt.sym === 'Xe' || pt.sym === 'Kr') extra = ' Solo el xenón (y en menor medida el kriptón) forma unos pocos compuestos con flúor y oxígeno en condiciones especiales (por ejemplo, XeF₂ o XeO₃), que no pertenecen a estas funciones.';
  else if (pt.sym === 'Rn') extra = ' Además, el radón es radiactivo; de él solo se conoce algún fluoruro.';
  else if (pt.sym === 'Og') extra = ' Además, el oganesón es sintético: solo se han obtenido unos pocos átomos que duran milésimas de segundo.';
  else extra = ` No se conoce ningún compuesto estable del ${pt.es} en condiciones ordinarias.`;
  return err('gas-noble', `El ${pt.es} es un gas noble: no forma estos compuestos`,
    `El ${pt.es} (${pt.sym}) tiene su capa de valencia completa (${shell}): casi no gana, pierde ni comparte electrones, por eso no forma óxidos, hidróxidos, ácidos ni sales.${extra}`,
    'Prueba con un metal (por ejemplo, Ca) o con un no metal (por ejemplo, S).');
}

function outOfEngineError(pt: PtElement): ForgeError {
  const cat = CATEGORY_LABEL[pt.category];
  if (pt.z >= 104) return err('fuera-del-taller', `El ${pt.es} es un elemento superpesado`, `El ${pt.es} (${pt.sym}) es un elemento sintético superpesado: solo se han producido unos pocos átomos de vida muy corta y su química casi no se conoce.`, 'Elige uno de los elementos resaltados de la tabla.');
  const reason = EXCLUDED_REASON[pt.sym] ?? (pt.category === 'actinido' ? ACTINIDE_REASON : `El ${pt.es} es ${isSynthetic(pt.z) ? 'sintético y ' : ''}${isRadioactive(pt.z) ? 'radiactivo' : 'un elemento sin compuestos escolares documentados'}.`);
  return err('fuera-del-taller', `El taller no incluye el ${pt.es}`,
    `${reason} Por eso el taller no lo incluye: trabaja con los ${ENGINE_SYMBOLS.length} elementos cuyos números de oxidación y nombres están documentados y validados con PubChem (resaltados en la tabla). (${pt.sym}: ${cat}).`,
    'Elige uno de los elementos resaltados de la tabla.');
}

function groupReason(sym: string, ox: number): string {
  const pt = ptElement(sym);
  const g = pt.group ?? 0;
  const valence = g <= 2 ? g : g >= 13 ? g - 10 : 0;
  const parts: string[] = [];
  if (g === 1 && sym !== 'H') parts.push('Los metales alcalinos tienen un solo electrón de valencia (ns¹): al perderlo quedan con +1.');
  else if (g === 2) parts.push('Los metales alcalinotérreos tienen dos electrones de valencia (ns²): al perderlos quedan con +2.');
  else if (sym === 'Al' || sym === 'Ga' || sym === 'In') parts.push(`${Art(sym)} pierde sus tres electrones de valencia (ns² np¹) y queda con +3.`);
  else if (sym === 'Tl') parts.push('El talio actúa con +1 (pierde solo el electrón 6p: «efecto del par inerte») y con +3.');
  else if (g === 3 || pt.category === 'lantanido') parts.push(`${Art(sym)} pierde sus tres electrones de valencia y queda con +3${sym === 'Ce' ? ' (el cerio también llega a +4, con la configuración del xenón)' : sym === 'Eu' ? ' (el europio también actúa con +2, con la subcapa 4f semillena)' : ''}.`);
  else if (sym === 'Cd') parts.push('El cadmio, como el cinc, pierde sus dos electrones 5s y queda con +2.');
  else if (g >= 4 && g <= 7 && ox > g) parts.push(`En los grupos 4 a 7 el número de oxidación máximo es el número del grupo: ${g} para ${art(sym)}.`);
  else if (sym === 'Zn') parts.push('El cinc pierde sus dos electrones 4s y queda con +2 (su capa 3d está llena).');
  else if (sym === 'Ag') parts.push('La plata pierde su electrón 5s y queda con +1.');
  else if (sym === 'F') parts.push('El flúor es el elemento más electronegativo: en sus compuestos siempre tiene −1.');
  else if (sym === 'O') parts.push('El oxígeno actúa con −2 (−1 en los peróxidos).');
  else if (sym === 'Cl' || sym === 'Br' || sym === 'I') parts.push('Con metales e hidrógeno los halógenos actúan con −1; con el oxígeno, con estados positivos impares (+1, +3, +5, +7).');
  else if (sym === 'B') parts.push('El boro tiene tres electrones de valencia: actúa con +3.');
  if (valence && ox > valence && g >= 13) parts.push(`Ningún elemento de los grupos principales supera su número de electrones de valencia (${valence} para ${art(sym)}).`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/** Comprueba que el elemento exista en el taller (no gas noble, incluido en el motor). */
function elementGate(sym: string | null | undefined, slotLabel: string): ForgeError | null {
  if (!sym) return err('sin-elemento', 'Falta elegir un elemento', `Elige en la tabla periódica el elemento de la casilla «${slotLabel}».`);
  const pt = ptElement(sym);
  if (pt.category === 'gas-noble') return nobleGasError(pt);
  if (!ENGINE.has(sym)) return outOfEngineError(pt);
  return null;
}

/** Comprueba que el elemento presente ese número de oxidación (en algún compuesto real). */
function stateGate(sym: string, ox: number | null | undefined): ForgeError | null {
  if (ox === null || ox === undefined || ox === 0) return err('sin-estado', 'Falta el número de oxidación', `Elige el número de oxidación ${del(sym)}.`);
  const known = KNOWN_STATES[sym];
  if (known.includes(ox)) return null;
  const rare = RARE_STATES[sym];
  if (rare?.states.includes(ox)) {
    return err('estado-raro', `${Art(sym)} con ${stateLabel(ox)} es poco común`,
      `${Art(sym)} presenta ${stateLabel(ox)} solo en compuestos poco comunes (por ejemplo, ${rare.example}); el taller trabaja con sus estados habituales: ${listStates(known)}.`,
      `Elige ${known.length > 1 ? 'uno de estos estados' : 'este estado'}: ${listStates(known)}.`);
  }
  return err('estado-inexistente', `${Art(sym)} no presenta ${stateLabel(ox)}`,
    `${Art(sym)} no presenta el número de oxidación ${stateLabel(ox)}. Sus estados habituales son: ${listStates(known)}.${groupReason(sym, ox)}`,
    `Elige ${known.length > 1 ? 'uno de estos estados' : 'este estado'}: ${listStates(known)}.`);
}

/** Comprueba la combinación elemento + estado de una casilla. */
function slotGate(sym: string | null | undefined, ox: number | null | undefined, slotLabel: string): ForgeError | null {
  return elementGate(sym, slotLabel) ?? stateGate(sym as string, ox);
}

function engine<T>(f: () => T, title: string): T | ForgeError {
  try { return f(); } catch (e) { return err('motor', title, (e as Error).message); }
}
const isErr = (x: unknown): x is ForgeError => typeof x === 'object' && x !== null && (x as ForgeError).ok === false;

/* ------------------------------------------------------------------ vía real de obtención */

function metalOxidePathway(sym: string, ox: number): [Pathway, string] {
  switch (sym) {
    case 'Li': case 'Mg': case 'Ca': case 'Ba': case 'Al': case 'Zn': case 'Be': case 'Sr': case 'Cd': return ['directa', `${Art(sym)} arde en el aire (o en oxígeno) y forma este óxido.`];
    case 'Rb': case 'Cs': return ['condiciones', `Al arder en el aire ${art(sym)} forma sobre todo superóxido (${sym}O₂); el ${sym}₂O se obtiene con oxígeno limitado.`];
    case 'Sc': case 'Y': case 'La': case 'Pr': case 'Nd': case 'Sm': case 'Gd': case 'Tb': case 'Dy': case 'Ho': case 'Er': case 'Tm': case 'Yb': case 'Lu':
      return ['directa', `${Art(sym)} arde al calentarlo en el aire y forma el óxido ${sym}₂O₃ (los lantánidos son metales muy reactivos).`];
    case 'Ce': return ox === 4 ? ['directa', 'El cerio arde en el aire (sus chispas se usan en los encendedores) y forma CeO₂.'] : ['condiciones', 'El Ce₂O₃ se obtiene reduciendo el CeO₂ con hidrógeno a alta temperatura.'];
    case 'Eu': return ox === 3 ? ['directa', 'El europio arde en el aire y forma Eu₂O₃.'] : ['condiciones', 'El EuO se obtiene reduciendo el Eu₂O₃ con europio metálico.'];
    case 'Ti': case 'Zr': case 'Hf': return ox === 4 ? ['directa', `${Art(sym)} arde en oxígeno a alta temperatura y forma ${sym}O₂ (a temperatura ambiente lo protege una capa de óxido).`] : ['condiciones', 'Los óxidos de titanio de estados bajos se obtienen reduciendo el TiO₂ (con hidrógeno o con titanio metálico) a alta temperatura.'];
    case 'V': case 'Nb': case 'Ta': return ox === 5 ? ['directa', `${Art(sym)} calentado en oxígeno forma ${sym}₂O₅.`] : ['condiciones', 'Los óxidos de vanadio de estados bajos se obtienen reduciendo el V₂O₅ (con hidrógeno o con carbono).'];
    case 'Mo': case 'W': return ox === 6 ? ['directa', `${Art(sym)} calentado en el aire forma ${sym}O₃.`] : ['condiciones', `El ${sym}O₂ se obtiene reduciendo el ${sym}O₃ con hidrógeno.`];
    case 'Re': return ox === 7 ? ['directa', 'El renio arde en oxígeno y forma Re₂O₇ (volátil, amarillo).'] : ['condiciones', 'El ReO₂ se obtiene reduciendo el Re₂O₇ o descomponiendo el perrenato de amonio.'];
    case 'Ru': case 'Os': case 'Rh': case 'Ir': case 'Pd': return ['condiciones', sym === 'Os' ? 'El osmio en polvo se oxida en el aire a OsO₄ (+8, muy tóxico); el OsO₂ se obtiene por otras rutas.' : `${Art(sym)} es un metal noble: solo se oxida al calentarlo fuertemente en oxígeno, y el óxido se descompone a más alta temperatura.`];
    case 'Pt': return ['formal', 'El platino no reacciona con el oxígeno del aire (es un metal noble); sus óxidos se preparan por otras rutas.'];
    case 'Ga': case 'In': return ['directa', `${Art(sym)} calentado en el aire forma ${sym}₂O₃.`];
    case 'Tl': return ox === 1 ? ['condiciones', 'El talio se oxida en el aire húmedo; el Tl₂O se obtiene calentando el TlOH.'] : ['condiciones', 'El Tl₂O₃ se forma con oxidantes fuertes; al calentarlo pierde oxígeno y da Tl₂O.'];
    case 'Ge': return ox === 4 ? ['directa', 'El germanio calentado en oxígeno forma GeO₂.'] : ['condiciones', 'El GeO se obtiene calentando GeO₂ con germanio metálico.'];
    case 'Sb': return ox === 3 ? ['directa', 'El antimonio arde en el aire y forma Sb₂O₃ (humo blanco).'] : ['formal', 'El Sb₂O₅ se prepara oxidando el antimonio con ácido nítrico concentrado, no quemándolo.'];
    case 'Bi': return ['directa', 'El bismuto arde en el aire con llama azulada y forma Bi₂O₃.'];
    case 'Po': return ['condiciones', 'El polonio se oxida en oxígeno al calentarlo y forma PoO₂; por su radiactividad solo se estudia en cantidades diminutas.'];
    case 'Na': return ['condiciones', 'Al arder en el aire el sodio forma sobre todo peróxido (Na₂O₂); el Na₂O se obtiene con oxígeno limitado.'];
    case 'K': return ['condiciones', 'Al arder en el aire el potasio forma sobre todo superóxido (KO₂); el K₂O se obtiene por otras rutas.'];
    case 'Fe': return ['condiciones', 'El hierro al rojo en oxígeno forma sobre todo Fe₃O₄ (óxido mixto de Fe(II) y Fe(III)); la herrumbre es Fe₂O₃ hidratado, y el FeO solo es estable por encima de unos 570 °C.'];
    case 'Cu': return ox === 2 ? ['directa', 'Al calentar el cobre en el aire se cubre de CuO negro.'] : ['condiciones', 'El Cu₂O (rojo) se forma al calentar el cobre a más de unos 1000 °C o al reducir sales de cobre(II).'];
    case 'Ag': case 'Au': return ['formal', `${Art(sym)} no reacciona con el oxígeno del aire (es un metal noble); su óxido se prepara por otras rutas (precipitación) y se descompone al calentarlo.`];
    case 'Hg': return ox === 2 ? ['condiciones', 'Al calentar el mercurio en el aire a unos 350 °C se forma HgO rojo (el experimento de Lavoisier); a mayor temperatura se descompone.'] : ['formal', 'El «Hg₂O» es dudoso: los estudios indican que es una mezcla de HgO y Hg.'];
    case 'Sn': return ox === 4 ? ['directa', 'El estaño arde en el aire y forma SnO₂.'] : ['condiciones', 'El SnO se obtiene sin oxígeno en exceso (por ejemplo, descomponiendo el oxalato de estaño(II)).'];
    case 'Pb': return ox === 2 ? ['directa', 'Al calentar el plomo en el aire se forma PbO (litargirio).'] : ['condiciones', 'El PbO₂ se obtiene oxidando compuestos de plomo(II) con oxidantes fuertes (así se forma en la batería del carro).'];
    case 'Cr': return ox === 3 ? ['directa', 'El cromo arde a alta temperatura y forma Cr₂O₃ (verde).'] : ox === 6 ? ['formal', 'El CrO₃ se prepara con dicromato de potasio y ácido sulfúrico concentrado, no quemando el cromo.'] : ['formal', 'El CrO es inestable y no se forma al quemar el cromo.'];
    case 'Mn': return ox === 7 ? ['formal', 'El Mn₂O₇ (un aceite explosivo) se prepara con KMnO₄ y ácido sulfúrico concentrado, no quemando el manganeso.'] : ['condiciones', 'Al quemar el manganeso se forma sobre todo Mn₃O₄; cada óxido se obtiene en condiciones distintas.'];
    default: return ox === 2 ? ['condiciones', 'Que se forme este óxido depende de la temperatura y de la cantidad de oxígeno.'] : ['formal', 'Este óxido no se obtiene quemando el metal; se prepara por otras rutas (precipitación o descomposición térmica).'];
  }
}

function nonmetalOxidePathway(sym: string, ox: number): [Pathway, string] {
  const k = `${sym}:${ox}`;
  if (k === 'C:4') return ['directa', 'Combustión completa del carbono con oxígeno en exceso.'];
  if (k === 'C:2') return ['condiciones', 'Combustión incompleta: se forma CO cuando falta oxígeno (por eso es peligroso un fogón en un cuarto cerrado).'];
  if (k === 'S:4') return ['directa', 'El azufre arde en el aire con llama azul y forma SO₂.'];
  if (k === 'S:6') return ['condiciones', 'Al arder, el azufre forma SO₂; el SO₃ se obtiene oxidando el SO₂ con un catalizador (V₂O₅, proceso de contacto). La ecuación S + O₂ resume la composición.'];
  if (k === 'P:5') return ['directa', 'El fósforo arde con oxígeno en exceso y forma P₄O₁₀ (humo blanco).'];
  if (k === 'P:3') return ['condiciones', 'Con poco oxígeno el fósforo forma P₄O₆.'];
  if (k === 'B:3' || k === 'Si:4') return ['directa', `${Art(sym)} arde a alta temperatura y forma su óxido.`];
  if (k === 'N:2') return ['condiciones', 'El nitrógeno no arde en el aire: el NO se forma a muy alta temperatura (rayos, motores): N₂ + O₂ → 2 NO.'];
  if (k === 'As:3') return ['directa', 'El arsénico arde en el aire y forma As₄O₆ (el «arsénico blanco»), con olor a ajo.'];
  if (k === 'As:5') return ['formal', 'El As₂O₅ no se forma quemando el arsénico: se obtiene deshidratando el ácido arsénico (que se prepara oxidando el As con ácido nítrico).'];
  if (k === 'Se:4' || k === 'Te:4') return ['directa', `${Art(sym)} arde en el aire y forma ${sym}O₂.`];
  if (k === 'Se:6' || k === 'Te:6') return ['formal', `El ${sym}O₃ no se forma quemando el ${nameOf(sym)}: se obtiene deshidratando su ácido (${sym === 'Se' ? 'H₂SeO₄' : 'H₆TeO₆'}).`];
  if (sym === 'N') return ['formal', 'El nitrógeno no arde en el aire; este óxido se obtiene por otras rutas (por ejemplo, el NO₂ a partir del NO).'];
  return ['formal', 'Los halógenos no reaccionan directamente con el oxígeno: sus óxidos se preparan por otras rutas y varios son inestables o explosivos.'];
}

const WATER_REACTIVE: Record<string, Pathway> = { Li: 'directa', Na: 'directa', K: 'directa', Rb: 'directa', Cs: 'directa', Ca: 'directa', Sr: 'directa', Ba: 'directa', Mg: 'condiciones' };

function acidPathway(sym: string, ox: number, form: AcidForm): [Pathway, string] {
  if (form === 'di') {
    if (sym === 'S') return ['condiciones', 'El ácido disulfúrico (óleum) se forma al disolver SO₃ en ácido sulfúrico concentrado.'];
    if (sym === 'P') return ['condiciones', 'El ácido difosfórico se obtiene calentando el ácido fosfórico (pierde agua).'];
    return ['formal', 'El ácido dicrómico solo existe en disolución, en equilibrio con el ácido crómico.'];
  }
  if (form === 'meta') return ['formal', 'La forma meta- es una relación de composición: estos ácidos forman cadenas o anillos (polímeros), no moléculas sueltas.'];
  const k = `${sym}:${ox}`;
  const direct: Record<string, string> = {
    'C:4': 'El CO₂ se disuelve en el agua y una pequeña parte forma H₂CO₃ (por eso el agua con gas es ácida).',
    'S:4': 'El SO₂ se disuelve en el agua; el ácido sulfuroso no se aísla (es SO₂ disuelto).',
    'S:6': 'El SO₃ reacciona con el agua de forma muy exotérmica; en la industria se absorbe en H₂SO₄ concentrado.',
    'N:5': 'El N₂O₅ reacciona con el agua y forma ácido nítrico.',
    'N:3': 'El N₂O₃ con agua fría forma ácido nitroso (inestable).',
    'P:5': 'El P₄O₁₀ reacciona con avidez con el agua (por eso se usa como desecante).',
    'P:3': 'El P₄O₆ reacciona con agua fría y forma H₃PO₃.',
    'B:3': 'El B₂O₃ se disuelve lentamente en el agua y forma ácido bórico.',
    'Cl:1': 'El Cl₂O con agua forma ácido hipocloroso (en equilibrio).',
    'Cl:7': 'El Cl₂O₇ con agua forma ácido perclórico.',
    'I:5': 'El I₂O₅ se disuelve en el agua y forma ácido yódico.',
    'Cr:6': 'El CrO₃ se disuelve en el agua y forma ácido crómico (en disolución).',
    'As:3': 'El As₂O₃ (As₄O₆) se disuelve lentamente en el agua y forma ácido arsenioso.',
    'As:5': 'El As₂O₅ es muy soluble en agua y forma ácido arsénico.',
    'Se:4': 'El SeO₂ se disuelve en el agua y forma ácido selenioso.',
    'Se:6': 'El SeO₃ reacciona con el agua y forma ácido selénico.',
    'Re:7': 'El Re₂O₇ se disuelve en el agua y forma ácido perrénico.',
  };
  if (direct[k]) return ['directa', direct[k]];
  if (k === 'Mn:7') return ['condiciones', 'El Mn₂O₇ (explosivo) con agua forma ácido permangánico, que solo existe en disolución.'];
  if (k === 'Si:4') return ['formal', 'El SiO₂ (arena, cuarzo) es insoluble y no reacciona con el agua; los ácidos silícicos se obtienen a partir de silicatos.'];
  if (k === 'Mo:6' || k === 'W:6' || k === 'V:5' || k === 'Te:4' || k === 'Te:6' || k === 'Sb:5') return ['formal', `El óxido es muy poco soluble en agua: el ácido (o sus sales) se obtiene por otras rutas, por ejemplo acidificando ${k === 'Mo:6' ? 'un molibdato' : k === 'W:6' ? 'un wolframato' : k === 'V:5' ? 'un vanadato' : k === 'Sb:5' ? 'un antimoniato' : 'un telurito o un telurato'}.`];
  return ['formal', 'Este óxido no se ha aislado o es muy inestable: la ecuación óxido + agua es una relación formal; el ácido (o sus sales) se obtiene por otras rutas.'];
}

/* ------------------------------------------------------------------ notas de compuestos poco estables */

/** Sales y compuestos que el motor puede escribir pero que no se pueden obtener como sustancias estables. */
const UNSTABLE_NOTES: Record<string, string> = {
  'sal:Fe3-I': 'El yoduro de hierro(III) no se puede aislar: el Fe³⁺ oxida al I⁻ (2 Fe³⁺ + 2 I⁻ → 2 Fe²⁺ + I₂).',
  'sal:Cu2-I': 'El yoduro de cobre(II) no se aísla: el Cu²⁺ oxida al I⁻ y se forman CuI e I₂.',
  'sal:Au3-I': 'El yoduro de oro(III) es inestable: el Au³⁺ oxida al I⁻.',
  'oxisal:Al3-C4': 'El carbonato de aluminio no se obtiene en agua: el Al³⁺ se hidroliza, precipita Al(OH)₃ y se libera CO₂.',
  'oxisal:Fe3-C4': 'El carbonato de hierro(III) no se obtiene en agua: el Fe³⁺ se hidroliza, precipita Fe(OH)₃ y se libera CO₂.',
  'oxisal:Cr3-C4': 'El carbonato de cromo(III) no se obtiene en agua: el Cr³⁺ se hidroliza y se libera CO₂.',
  'sal:Al3-S': 'El Al₂S₃ se obtiene en seco (Al + S); en contacto con el agua se hidroliza a Al(OH)₃ y H₂S.',
  'sal:Fe3-S': 'El Fe₂S₃ es inestable: se descompone en FeS y FeS₂ (pirita).',
  'sal:Tl3-I': 'El sólido de fórmula TlI₃ existe, pero es triyoduro de talio(I), Tl⁺ I₃⁻: el Tl³⁺ oxidaría al I⁻.',
  'sal:Ce4-Cl': 'El cloruro de cerio(IV) no se aísla: el Ce⁴⁺ oxida al Cl⁻. Del cerio(IV) se conocen el CeF₄ y sales oxigenadas como el Ce(SO₄)₂.',
  'sal:Ce4-Br': 'El bromuro de cerio(IV) no existe: el Ce⁴⁺ oxida al Br⁻.',
  'sal:Ce4-I': 'El yoduro de cerio(IV) no existe: el Ce⁴⁺ oxida al I⁻.',
  'sal:Pb4-I': 'El yoduro de plomo(IV) no se aísla: el Pb⁴⁺ oxida al I⁻ (se forma PbI₂ e I₂).',
  'sal:Pb4-Br': 'El bromuro de plomo(IV) no se aísla: es inestable y se descompone en PbBr₂ y Br₂.',
};

/* ------------------------------------------------------------------ construcción */

const water = () => buildCompound({ kind: 'hidruro', el: 'O' });

function elementTerm(sym: string): Omit<ForgeTerm, 'coef'> {
  const f = elementFormula(sym);
  return { formula: f, pretty: prettyFormula(f), name: nameOf(sym), role: 'elemento' };
}
const compoundTerm = (c: Compound): Omit<ForgeTerm, 'coef'> => ({ formula: c.formula, pretty: c.formulaPretty, name: c.names.stock ?? c.names.comun ?? c.names.tradicional ?? c.names.sistematica, role: 'compuesto', compound: c });

/** Balancea con el método algebraico de balancing.ts. */
function balance(reactants: Omit<ForgeTerm, 'coef'>[], products: Omit<ForgeTerm, 'coef'>[]): { reactants: ForgeTerm[]; products: ForgeTerm[]; equation: string; steps: string[] } | ForgeError {
  const sp = (t: Omit<ForgeTerm, 'coef'>): SpeciesDef => ({ formula: t.formula, name: t.name, kind: t.role === 'elemento' ? 'atomo' : 'unidad' });
  const r: ReactionDef = { id: 'taller', name: 'Taller', level: 1, context: '', reactants: reactants.map(sp), products: products.map(sp), answer: [] };
  const sol = solveBalance(r);
  if (!sol.coefficients) return err('motor', 'No se pudo balancear', 'La ecuación no tiene una solución única con coeficientes positivos.');
  const c = sol.coefficients;
  return {
    reactants: reactants.map((t, i) => ({ ...t, coef: c[i] })),
    products: products.map((t, i) => ({ ...t, coef: c[reactants.length + i] })),
    equation: equationText(r, c),
    steps: sol.equations,
  };
}

const ELEMENT_NOTES: Record<string, string> = {
  S: 'El azufre sólido está formado por moléculas S₈; en las ecuaciones escolares se escribe como S.',
  P: 'El fósforo blanco está formado por moléculas P₄; en las ecuaciones escolares se escribe como P.',
};

function finish(input: ForgeInput, product: Compound, reactants: Omit<ForgeTerm, 'coef'>[], products: Omit<ForgeTerm, 'coef'>[], path: [Pathway, string], notes: string[], byproduct?: Compound): ForgeOutcome {
  const bal = balance(reactants, products);
  if (isErr(bal)) return bal;
  const chosen = [input.a && `${input.a} (${stateLabel(input.oxA ?? 0)})`, routeById(input.route).slots === 2 && input.b ? `${input.b} (${stateLabel(input.oxB ?? 0)})` : null].filter(Boolean).join(' y ');
  const elementNotes = reactants.filter((t) => t.role === 'elemento' && ELEMENT_NOTES[t.formula]).map((t) => ELEMENT_NOTES[t.formula]);
  const unstable = UNSTABLE_NOTES[product.key];
  return {
    ok: true, input, route: routeById(input.route), product, byproduct,
    reactants: bal.reactants, products: bal.products, equation: bal.equation, balanceSteps: bal.steps,
    pathway: path[0], pathwayNote: path[1], notes: [...(unstable ? [unstable] : []), ...notes, ...elementNotes], chosen,
  };
}

/** Óxido de un elemento: compuesto del motor o, si el motor no lo incluye (no aislado), término formal. */
function oxideTerm(sym: string, ox: number): Omit<ForgeTerm, 'coef'> {
  try { return compoundTerm(buildCompound({ kind: 'oxido', el: sym, ox })); } catch {
    const [x, o] = ox % 2 ? [2, ox] : [1, ox / 2];
    const f = `${sym}${x > 1 ? x : ''}O${o > 1 ? o : ''}`;
    return { formula: f, pretty: prettyFormula(f), name: `óxido de ${nameOf(sym)}(${roman(ox)}) (fórmula formal)`, role: 'formal' };
  }
}

/** Forma el compuesto de una ruta con los elementos elegidos, o explica por qué no es posible. */
export function forge(input: ForgeInput): ForgeOutcome {
  const route = routeById(input.route);
  const a = input.a ?? null;
  const g1 = slotGate(a, input.oxA, route.slotLabels[0]);
  if (g1) return g1;
  const A = a as string, oxA = input.oxA as number;
  const nameA = nameOf(A);

  switch (input.route) {
    case 'metal-o2': {
      if (A === 'O') return err('papel', 'El oxígeno ya es el otro reactivo', 'En esta ruta el oxígeno (O₂) es el segundo reactivo: elige el metal que se combina con él.');
      if (A === 'H') return err('no-es-metal', 'El hidrógeno no es un metal', 'El hidrógeno es un no metal: con el oxígeno forma agua (H₂O). Para formarla usa la ruta «H₂ + halógeno o calcógeno» con el oxígeno, o la ruta «peróxido» para el agua oxigenada.');
      if (!isMetal(A)) return err('no-es-metal', `El ${nameA} es un no metal`, `El ${nameA} es un no metal: con el oxígeno forma un óxido ácido (antes llamado anhídrido), no un óxido básico.`, 'Usa la ruta «No metal + O₂».');
      if (oxA < 0) return err('papel', 'Frente al oxígeno el metal es positivo', `Frente al oxígeno, ${art(A)} cede electrones y actúa con número de oxidación positivo.`);
      const ox = engine(() => buildCompound({ kind: 'oxido', el: A, ox: oxA }), `${Art(A)} no forma este óxido`);
      if (isErr(ox)) return ox;
      const notes: string[] = [];
      if (ox.fn === 'oxido-acido') notes.push(`Aunque ${art(A)} es un metal, en ${stateLabel(oxA)} su óxido es ácido: con agua forma un oxácido (ruta «Óxido ácido + H₂O»).`);
      return finish(input, ox, [elementTerm(A), elementTerm('O')], [compoundTerm(ox)], metalOxidePathway(A, oxA), notes);
    }
    case 'nometal-o2': {
      if (A === 'O') return err('papel', 'El oxígeno ya es el otro reactivo', 'En esta ruta el oxígeno (O₂) es el segundo reactivo: elige el no metal que se combina con él.');
      if (A === 'H') return err('papel', 'El «óxido de hidrógeno» es el agua', 'El hidrógeno con el oxígeno forma agua (H₂O), que no es un óxido ácido. Usa la ruta «H₂ + halógeno o calcógeno» y elige el oxígeno.');
      if (A === 'F') return err('papel', 'El flúor no forma óxidos', 'El flúor es más electronegativo que el oxígeno: el OF₂ es un fluoruro de oxígeno (con O en +2), no un óxido. El taller no lo incluye.');
      if (isMetal(A)) return err('no-es-no-metal', `${Art(A)} es un metal`, `${Art(A)} es un metal: con el oxígeno forma un óxido básico.${engineEl(A).acid ? ` (Sus óxidos ácidos, con ${listStates(engineEl(A).acid!)}, se forman en la ruta «Metal + O₂» eligiendo ese estado).` : ''}`, 'Usa la ruta «Metal + O₂».');
      if (oxA < 0) return err('papel', 'Frente al oxígeno el no metal es positivo', `Frente al oxígeno (más electronegativo) el ${nameA} actúa con número de oxidación positivo; ${stateLabel(oxA)} lo usa frente a metales e hidrógeno.`);
      const ox = engine(() => buildCompound({ kind: 'oxido', el: A, ox: oxA }), `El taller no incluye este óxido del ${nameA}`);
      if (isErr(ox)) return { ...ox, message: `${ox.message} (Ese óxido no se ha aislado o es muy inestable, por eso el motor no lo incluye).`, hint: `Estados con óxido en el taller: ${listStates(engineEl(A).ox)}.` };
      return finish(input, ox, [elementTerm(A), elementTerm('O')], [compoundTerm(ox)], nonmetalOxidePathway(A, oxA), []);
    }
    case 'peroxido': {
      if (!PEROXIDE_EL.has(A)) {
        return isMetal(A)
          ? err('papel', `${Art(A)} no forma un peróxido simple`, `Los peróxidos iónicos estables (con el ion O₂²⁻) los forman sobre todo los metales de los grupos 1 y 2${A === 'Be' ? ' (salvo el berilio, cuyo ion es tan pequeño que no se conoce un BeO₂)' : ''}. ${Art(A)} no forma un peróxido simple en este taller.`, 'Prueba con Na, K, Ba o con el H.')
          : err('papel', 'Los no metales no forman peróxidos iónicos', `Los no metales no forman peróxidos iónicos; el único peróxido de un no metal en el taller es el del hidrógeno (H₂O₂).`, 'Prueba con el H o con un metal de los grupos 1 y 2.');
      }
      const st = engineEl(A).ox[0];
      if (oxA !== st) return err('papel', `En el peróxido ${art(A)} actúa con ${stateLabel(st)}`, `En los peróxidos el oxígeno tiene −1 y ${art(A)} actúa con ${stateLabel(st)}.`);
      const p = buildCompound({ kind: 'peroxido', el: A });
      const path: Record<string, [Pathway, string]> = {
        Na: ['directa', 'El sodio arde en el aire y forma sobre todo Na₂O₂ (amarillo pálido).'],
        Ba: ['condiciones', 'El BaO₂ se forma calentando BaO en el aire a unos 500 °C.'],
        Sr: ['formal', 'El SrO₂ se prepara con hidróxido de estroncio y agua oxigenada, no quemando el estroncio.'],
        Rb: ['formal', 'Al arder, el rubidio forma sobre todo superóxido (RbO₂); el Rb₂O₂ se obtiene por otras rutas.'],
        Cs: ['formal', 'Al arder, el cesio forma sobre todo superóxido (CsO₂); el Cs₂O₂ se obtiene por otras rutas.'],
        K: ['formal', 'Al arder, el potasio forma sobre todo superóxido (KO₂, con el ion O₂⁻); el K₂O₂ se obtiene por otras rutas.'],
        H: ['formal', 'H₂ + O₂ forma agua, no agua oxigenada: el H₂O₂ se fabrica por otras rutas (proceso de la antraquinona).'],
      };
      return finish(input, p, [elementTerm(A), elementTerm('O')], [compoundTerm(p)], path[A] ?? ['formal', `Al quemar ${art(A)} se forma sobre todo el óxido; el peróxido se prepara por otras rutas (por ejemplo, con agua oxigenada).`], []);
    }
    case 'metal-h2': {
      if (!isMetal(A)) return err('no-es-metal', `El ${nameA} es un no metal`, `El ${nameA} es un no metal: con el hidrógeno forma ${ANION_STATE[A] !== undefined ? 'un hidrácido' : 'un hidruro no metálico'}, en el que el H no actúa como ion hidruro.`, 'Usa la ruta «H₂ + halógeno o calcógeno».');
      if (!HYDRIDE_METALS.has(A)) return err('papel', `${Art(A)} no forma un hidruro iónico`, `Los hidruros metálicos iónicos (con el ion H⁻) los forman los metales más activos: los de los grupos 1 y 2 y el aluminio${A === 'Be' ? ' (el BeH₂ es un sólido covalente polimérico que se prepara por otras rutas)' : ''}. Los metales de transición no forman hidruros estequiométricos sencillos; algunos (como el paladio o el titanio) absorben hidrógeno formando hidruros intersticiales de composición variable.`, 'Prueba con Na, Ca o Al.');
      const st = engineEl(A).ox[0];
      if (oxA !== st) return err('papel', `${Art(A)} actúa con ${stateLabel(st)}`, `En el hidruro el hidrógeno tiene −1 y ${art(A)} actúa con ${stateLabel(st)}.`);
      const h = buildCompound({ kind: 'hidruro', el: A });
      const path: [Pathway, string] = A === 'Al' ? ['formal', 'El AlH₃ no se forma con aluminio e hidrógeno: se prepara con LiAlH₄ y AlCl₃ en éter.'] : ['condiciones', `${Art(A)} reacciona con el hidrógeno al calentarlo (en el caso del magnesio, además, a alta presión).`];
      return finish(input, h, [elementTerm(A), elementTerm('H')], [compoundTerm(h)], path, []);
    }
    case 'oxido-agua': {
      if (A === 'O' || A === 'H') return err('papel', 'Elige el metal del óxido', 'En esta ruta eliges el metal cuyo óxido reacciona con el agua.');
      if (!isMetal(A)) return err('no-es-metal', `El óxido del ${nameA} es ácido`, `El ${nameA} es un no metal: su óxido es ácido y con agua forma un oxácido, no un hidróxido.`, 'Usa la ruta «Óxido ácido + H₂O».');
      if (oxA < 0) return err('papel', 'El metal es positivo', `En el óxido, ${art(A)} actúa con número de oxidación positivo.`);
      if ((engineEl(A).acid ?? []).includes(oxA)) return err('papel', `En ${stateLabel(oxA)} el óxido ${del(A)} es ácido`, `Con ${stateLabel(oxA)} el óxido ${del(A)} es ácido: con agua forma un oxácido (${buildCompound({ kind: 'oxacido', el: A, ox: oxA }).names.tradicional}), no un hidróxido.`, 'Usa la ruta «Óxido ácido + H₂O».');
      const oxide = engine(() => buildCompound({ kind: 'oxido', el: A, ox: oxA }), `${Art(A)} no forma este óxido`);
      if (isErr(oxide)) return oxide;
      const hyd = engine(() => buildCompound({ kind: 'hidroxido', el: A, ox: oxA }), `${Art(A)} no forma este hidróxido`);
      if (isErr(hyd)) return hyd;
      const p = WATER_REACTIVE[A];
      const path: [Pathway, string] = p === 'directa' ? ['directa', `El óxido ${del(A)} reacciona con el agua (de forma exotérmica) y forma el hidróxido.`]
        : p === 'condiciones' ? ['condiciones', 'El MgO reacciona lentamente con el agua; el Mg(OH)₂ es poco soluble.']
          : ['formal', `Este óxido es insoluble y no reacciona con el agua: el hidróxido se obtiene precipitando una sal soluble ${del(A)} con una base (por ejemplo, FeCl₃ + 3 NaOH → Fe(OH)₃ + 3 NaCl). La ecuación óxido + agua muestra la relación de composición.`];
      return finish(input, hyd, [compoundTerm(oxide), compoundTerm(water())], [compoundTerm(hyd)], path, []);
    }
    case 'anhidrido-agua': {
      if (A === 'O' || A === 'H') return err('papel', 'Elige el no metal del óxido', 'En esta ruta eliges el no metal cuyo óxido ácido reacciona con el agua.');
      if (A === 'F') return err('papel', 'El flúor no forma oxácidos', 'El flúor no forma óxidos ni oxácidos (es más electronegativo que el oxígeno); su único ácido es el hidrácido HF.', 'Usa la ruta «H₂ + halógeno o calcógeno».');
      if (oxA < 0) return err('papel', 'En el oxácido el no metal es positivo', `En un oxácido el ${nameA} está unido al oxígeno y actúa con número de oxidación positivo.`);
      const e = engineEl(A);
      if (e.kind === 'metal' && !(e.acid ?? []).includes(oxA)) {
        const amph = (A === 'Cr' && oxA === 3) ? ` En +3 el óxido de cromo (Cr₂O₃) es anfótero; solo el cromo(+6) forma el ácido crómico, H₂CrO₄.` : '';
        return err('metal-sin-oxacido', `${Art(A)} es un metal: no forma oxácido con ${stateLabel(oxA)}`,
          `${Art(A)} es un metal: su óxido con ${stateLabel(oxA)} es básico${amph ? ' o anfótero' : ''} y con agua formaría un hidróxido, no un oxácido. Solo algunos metales en estados altos forman oxácidos: ${ACID_METALS}.${amph}`,
          e.acid ? `Elige ${listStates(e.acid)} para ${art(A)}, o usa la ruta «Óxido básico + H₂O».` : 'Usa la ruta «Óxido básico + H₂O».');
      }
      const k = `${A}:${oxA}`;
      if (k === 'C:2' || k === 'N:1' || k === 'N:2') {
        const f = k === 'C:2' ? 'CO' : k === 'N:1' ? 'N₂O' : 'NO';
        return err('oxido-neutro', `El ${f} es un óxido neutro`, `El ${f} es un óxido neutro: no reacciona con el agua para dar un oxácido.`, A === 'C' ? 'El carbono forma el ácido carbónico con +4 (CO₂).' : 'El nitrógeno forma oxácidos con +3 (nitroso) y +5 (nítrico).');
      }
      if (k === 'N:4') return err('oxido-neutro', 'El NO₂ no forma un único oxácido', 'El NO₂ con agua dismuta: 3 NO₂ + H₂O → 2 HNO₃ + NO. No forma un oxácido propio con +4.', 'Elige +3 (ácido nitroso) o +5 (ácido nítrico).');
      const form = input.form ?? 'normal';
      const acid = engine(() => buildCompound({ kind: 'oxacido', el: A, ox: oxA, form }), `El ${nameA} no forma este oxácido`);
      if (isErr(acid)) return { ...acid, hint: e.acid?.length ? `Estados que forman oxácido: ${listStates(e.acid)}.` : `El ${nameA} no forma oxácidos en el taller.` };
      const oxT = oxideTerm(A, oxA);
      const notes = oxT.role === 'formal' ? [`El óxido ${oxT.pretty} no se ha aislado como compuesto estable (el motor no lo incluye): aquí aparece solo como fórmula formal del «anhídrido».`] : [];
      return finish(input, acid, [oxT, compoundTerm(water())], [compoundTerm(acid)], oxT.role === 'formal' ? ['formal', 'El óxido no se ha aislado: la ecuación es una relación formal y el ácido (o sus sales) se obtiene por otras rutas.'] : acidPathway(A, oxA, form), notes);
    }
    case 'h2-nometal': {
      if (A === 'H') return err('papel', 'El hidrógeno ya es el primer reactivo', 'En esta ruta el hidrógeno (H₂) es el primer reactivo: elige el no metal que se combina con él.');
      if (isMetal(A)) return err('no-es-no-metal', `${Art(A)} es un metal`, `${Art(A)} es un metal: con el hidrógeno ${HYDRIDE_METALS.has(A) ? 'forma un hidruro metálico (con el ion H⁻), que no es un ácido' : 'no forma un hidrácido'}.`, HYDRIDE_METALS.has(A) ? 'Usa la ruta «Metal + H₂».' : 'Elige un halógeno (F, Cl, Br, I) o el azufre.');
      const anion = ANION_STATE[A];
      if (anion !== undefined) {
        if (oxA !== anion) return err('papel', `Frente al hidrógeno el ${nameA} actúa con ${stateLabel(anion)}`, `El ${nameA} es más electronegativo que el hidrógeno: en el hidrácido actúa con ${stateLabel(anion)} y el hidrógeno con +1.`);
        const h = buildCompound({ kind: 'hidracido', el: A });
        const path: Record<string, [Pathway, string]> = {
          F: ['directa', 'El flúor reacciona con el hidrógeno de forma explosiva, incluso en la oscuridad.'],
          Cl: ['directa', 'El cloro y el hidrógeno reaccionan con la luz (de forma explosiva); así se fabrica el HCl.'],
          Br: ['directa', 'El bromo reacciona con el hidrógeno al calentarlo (con un catalizador de platino).'],
          I: ['condiciones', 'H₂ + I₂ ⇌ 2 HI es un equilibrio: la reacción no es completa (se estudia en la práctica de equilibrio químico).'],
          S: ['condiciones', 'El azufre reacciona con el hidrógeno al calentarlo; en el laboratorio el H₂S se obtiene con FeS y un ácido.'],
          Se: ['condiciones', 'El selenio reacciona con el hidrógeno a unos 400 °C; el H₂Se (muy tóxico) se obtiene mejor con seleniuros metálicos y ácidos.'],
          Te: ['formal', 'El H₂Te es inestable y casi no se forma con telurio e hidrógeno: se obtiene con telururos metálicos y ácidos.'],
        };
        return finish(input, h, [elementTerm('H'), elementTerm(A)], [compoundTerm(h)], path[A], ['En estado puro es un gas molecular; disuelto en agua forma el ácido («ácido …hídrico»).']);
      }
      const hs = HYDRIDE_STATES[A];
      if (!hs) return err('papel', `El ${nameA} no forma un hidrácido`, 'Los hidrácidos se forman con los halógenos (F, Cl, Br, I) y con S, Se y Te.');
      if (!hs.includes(oxA)) return err('papel', `En el hidruro el ${nameA} actúa con ${listStates(hs)}`, `En el hidruro del ${nameA} el número de oxidación del ${nameA} es ${listStates(hs)}.`);
      const h = buildCompound({ kind: 'hidruro', el: A });
      const path: Record<string, [Pathway, string]> = {
        O: ['directa', 'El hidrógeno arde en el oxígeno y forma agua (así funcionan las celdas de combustible).'],
        N: ['condiciones', 'Proceso de Haber-Bosch: N₂ + 3 H₂ ⇌ 2 NH₃ con catalizador de hierro, unos 450 °C y 200 atm.'],
        C: ['formal', 'El carbono casi no reacciona con el hidrógeno; el metano se obtiene del gas natural o del biogás.'],
        Si: ['formal', 'El silano se obtiene con siliciuros metálicos y ácidos, no con silicio e hidrógeno.'],
        P: ['formal', 'El PH₃ se obtiene con fosfuros metálicos y agua, no con fósforo e hidrógeno.'],
        As: ['formal', 'La arsina (AsH₃, muy tóxica) se obtiene con arseniuros metálicos y ácidos, no con arsénico e hidrógeno.'],
        B: ['formal', 'El BH₃ no se aísla (forma el dímero B₂H₆) y no se obtiene con boro e hidrógeno.'],
      };
      const notes = A === 'Si' ? ['Como el H (2,20) es algo más electronegativo que el Si (1,90), en el SiH₄ el H tiene −1 y el Si +4; muchos textos escolares escriben −4 por analogía con el CH₄.'] : [];
      return finish(input, h, [elementTerm('H'), elementTerm(A)], [compoundTerm(h)], path[A], notes);
    }
    case 'neutralizacion': {
      if (!isMetal(A)) return err('no-es-metal', 'El hidróxido necesita un metal', `El hidróxido es un metal unido a iones OH⁻; el ${nameA} es un no metal. En la casilla 1 elige un metal (por ejemplo, Ca o Na).`);
      if (oxA < 0) return err('papel', 'El metal del hidróxido es positivo', `En el hidróxido, ${art(A)} es un catión con número de oxidación positivo.`);
      const hyd = engine(() => buildCompound({ kind: 'hidroxido', el: A, ox: oxA }), `${Art(A)} no forma este hidróxido`);
      if (isErr(hyd)) return hyd;
      const g2 = slotGate(input.b, input.oxB, route.slotLabels[1]);
      if (g2) return g2;
      const B = input.b as string, oxB = input.oxB as number;
      const nameB = nameOf(B);
      const eB = engineEl(B);
      if (B === 'O' || B === 'H') return err('papel', 'Elige el no metal del ácido', 'En la casilla 2 va el elemento característico del ácido: un halógeno o el azufre (hidrácidos) o un no metal que forme oxácido (S, N, C, P, Cl…).');
      if (B === A) return err('papel', 'El mismo metal en el catión y en el anión', `El taller no forma sales en las que ${art(A)} es a la vez el catión y el átomo central del anión (como un «permanganato de manganeso»): son raras o inestables.`, `Combina el ácido ${del(B)} con el hidróxido de otro metal (por ejemplo, K o Na).`);
      if (eB.kind === 'metal' && !(eB.acid ?? []).includes(oxB)) {
        return err('dos-metales', 'Dos metales no forman una sal', `${Art(B)} es un metal${eB.acid ? ` y con ${stateLabel(oxB)} no forma un ácido` : ' y no forma ácidos'}. Una sal necesita el anión de un ácido; dos metales juntos forman una aleación (una mezcla metálica, como el bronce Cu–Sn), sin cationes y aniones que se neutralicen.${eB.acid ? ` (${Art(B)} sí forma oxácidos con ${listStates(eB.acid)}).` : ''}`, 'En la casilla 2 elige un no metal (por ejemplo, S con +6 o Cl con −1).');
      }
      let acid: Compound | ForgeError;
      let saltSpec: Spec;
      const hLeft = input.hLeft ?? 0;
      if (oxB < 0) {
        const an = ANION_STATE[B];
        if (an === undefined) return err('papel', `El ${nameB} no forma un hidrácido`, `Con número de oxidación negativo el no metal formaría un hidrácido, y solo los halógenos (F, Cl, Br, I) y los calcógenos S, Se y Te los forman. ${eB.acid ? `El ${nameB} forma oxácidos con ${listStates(eB.acid)}.` : ''}`);
        if (oxB !== an) return err('papel', `En el hidrácido el ${nameB} actúa con ${stateLabel(an)}`, `En el hidrácido y en sus sales el ${nameB} es el anión ${B}${an === -2 ? '²⁻' : '⁻'} (${stateLabel(an)}).`);
        if (hLeft > 0) return err('papel', 'Sal ácida de un hidrácido', 'El taller no incluye las sales ácidas de los hidrácidos (por ejemplo, el NaHS). Usa la neutralización total.');
        acid = buildCompound({ kind: 'hidracido', el: B });
        saltSpec = { kind: 'sal-binaria', cation: { el: A, ox: oxA }, anion: B };
      } else {
        if (B === 'F') return err('papel', 'El flúor no forma oxácidos', 'El flúor solo forma el hidrácido HF (elige −1).');
        const k = `${B}:${oxB}`;
        if (k === 'C:2' || k === 'N:1' || k === 'N:2' || k === 'N:4') return err('oxido-neutro', `El ${nameB} no forma un oxácido con ${stateLabel(oxB)}`, `Con ${stateLabel(oxB)} el óxido del ${nameB} ${k === 'N:4' ? 'dismuta en agua' : 'es neutro'}: no hay un oxácido, así que tampoco hay sal.`, `Estados que forman oxácido: ${listStates(eB.acid ?? [])}.`);
        acid = engine(() => buildCompound({ kind: 'oxacido', el: B, ox: oxB, form: input.form ?? 'normal' }), `El ${nameB} no forma este oxácido`);
        if (isErr(acid)) return { ...acid, hint: eB.acid?.length ? `Estados que forman oxácido: ${listStates(eB.acid)}.` : undefined };
        saltSpec = { kind: 'oxisal', cation: { el: A, ox: oxA }, acid: { el: B, ox: oxB, form: input.form ?? 'normal' }, hLeft };
      }
      const salt = engine(() => buildCompound(saltSpec), 'El taller no forma esta sal');
      if (isErr(salt)) return salt;
      const path: [Pathway, string] = acid.key === 'oxacido:C4'
        ? ['condiciones', 'El ácido carbónico solo existe en disolución: los carbonatos se forman haciendo burbujear CO₂ en la disolución de la base (o precipitando con carbonato de sodio).']
        : ['directa', `Neutralización: los H⁺ del ácido y los OH⁻ del hidróxido forman agua (H⁺ + OH⁻ → H₂O)${hLeft ? '; con menos base, la sal conserva hidrógeno (sal ácida)' : ''}. Los hidróxidos insolubles también se neutralizan disolviéndose en el ácido.`];
      return finish(input, salt, [compoundTerm(acid), compoundTerm(hyd)], [compoundTerm(salt), compoundTerm(water())], path, [], water());
    }
    case 'metal-nometal': {
      const g2 = elementGate(input.b, route.slotLabels[1]);
      const B = input.b ?? null;
      if (!isMetal(A)) {
        if (B && !g2 && !isMetal(B)) return err('dos-no-metales', 'Dos no metales no forman una sal', `El ${nameA} y el ${nameOf(B)} son no metales: comparten electrones y forman un compuesto molecular (como el CCl₄), no una sal con cationes y aniones.`, 'En la casilla 1 elige un metal.');
        if (B && !g2 && isMetal(B)) return err('papel', 'El metal va en la casilla 1', `En la fórmula de la sal se escribe primero el metal (el elemento menos electronegativo): pon ${art(B)} en la casilla 1 y el ${nameA} en la casilla 2.`);
        return err('no-es-metal', `El ${nameA} es un no metal`, `En la casilla 1 va el metal (el catión). El ${nameA} es un no metal.`);
      }
      if (oxA < 0) return err('papel', 'El metal es positivo', `En la sal, ${art(A)} es el catión y actúa con número de oxidación positivo.`);
      if (g2) return g2;
      const b = B as string;
      const nameB = nameOf(b);
      if (isMetal(b)) return err('dos-metales', 'Dos metales no forman una sal', `${Art(A)} y ${art(b)} son metales: al fundirlos juntos forman una aleación (una mezcla metálica, como el bronce Cu–Sn o el latón Cu–Zn), sin cationes y aniones que se neutralicen.`, 'En la casilla 2 elige un halógeno (F, Cl, Br, I) o el azufre.');
      if (b === 'O') return err('papel', 'Con el oxígeno se forma un óxido', 'El metal con el oxígeno forma un óxido, no una sal binaria.', 'Usa la ruta «Metal + O₂».');
      if (b === 'H') return err('papel', 'Con el hidrógeno se forma un hidruro', 'El metal con el hidrógeno forma un hidruro metálico, no una sal binaria.', 'Usa la ruta «Metal + H₂».');
      const an = ANION_STATE[b];
      if (an === undefined) return err('papel', `El taller no incluye los compuestos ${del(b)} con metales`, `Los metales sí forman compuestos con el ${nameB} (nitruros, fosfuros, arseniuros, carburos, siliciuros o boruros, como el Li₃N, el GaAs o el CaC₂), pero el taller solo incluye las sales binarias con halógenos (F, Cl, Br, I) y calcógenos (S, Se, Te).`, 'En la casilla 2 elige F, Cl, Br, I, S, Se o Te.');
      if (input.oxB !== an) {
        const sg = input.oxB !== undefined && input.oxB !== null ? stateGate(b, input.oxB) : null;
        if (sg) return sg;
        return err('papel', `En la sal el ${nameB} actúa con ${stateLabel(an)}`, `En una sal binaria el ${nameB} es el anión ${b}${an === -2 ? '²⁻' : '⁻'}: gana ${-an === 1 ? 'un electrón' : 'dos electrones'} y actúa con ${stateLabel(an)}.`);
      }
      const salt = engine(() => buildCompound({ kind: 'sal-binaria', cation: { el: A, ox: oxA }, anion: b }), 'El taller no forma esta sal');
      if (isErr(salt)) return salt;
      const variable = engineEl(A).ox.length > 1;
      const path: [Pathway, string] = variable
        ? ['condiciones', `La reacción directa es posible, pero el estado que alcanza ${art(A)} depende del no metal: con F₂ o Cl₂ (muy oxidantes) suele formarse el estado más alto; con S o I₂, el más bajo.`]
        : ['directa', `${Art(A)} reacciona directamente con el ${nameB}${b === 'S' ? ' al calentar la mezcla' : ''}.`];
      return finish(input, salt, [elementTerm(A), elementTerm(b)], [compoundTerm(salt)], path, []);
    }
  }
}

/* ------------------------------------------------------------------ modelo 2D de cargas */

export interface ChargePart { label: string; charge: number; count: number }

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const ionLabel = (formula: string, q: number) => `${prettyFormula(formula)}${Math.abs(q) > 1 ? String(Math.abs(q)).replace(/\d/g, (d) => SUP[+d]) : ''}${q > 0 ? '⁺' : '⁻'}`;

/**
 * Partes con carga (o con número de oxidación, en las especies moleculares) de un compuesto del taller: la suma de
 * count · charge es cero (neutralidad de cargas).
 */
export function chargeParts(c: Compound): ChargePart[] {
  const s = c.spec;
  const comp = c.composition;
  const cat = (el: string, ox: number): ChargePart => (el === 'Hg' && ox === 1 ? { label: 'Hg₂²⁺', charge: 2, count: comp.Hg / 2 } : { label: ionLabel(el, ox), charge: ox, count: comp[el] });
  switch (s.kind) {
    case 'oxido': return [cat(s.el, s.ox), { label: 'O²⁻', charge: -2, count: comp.O }];
    case 'peroxido': return [s.el === 'H' ? { label: 'H⁺', charge: 1, count: 2 } : cat(s.el, engineEl(s.el).ox[0]), { label: 'O₂²⁻', charge: -2, count: 1 }];
    case 'hidroxido': return [cat(s.el, s.ox), { label: 'OH⁻', charge: -1, count: comp.O }];
    case 'hidruro': {
      const e = engineEl(s.el);
      if (e.kind === 'metal') return [cat(s.el, e.ox[0]), { label: 'H⁻', charge: -1, count: comp.H }];
      const ox = HYDRIDE_STATES[s.el][0];
      return ox > 0 ? [{ label: ionLabel(s.el, ox), charge: ox, count: 1 }, { label: 'H⁻', charge: -1, count: comp.H }] : [{ label: 'H⁺', charge: 1, count: comp.H }, { label: ionLabel(s.el, ox), charge: ox, count: 1 }];
    }
    case 'hidracido': return [{ label: 'H⁺', charge: 1, count: comp.H }, { label: ionLabel(s.el, ANION_STATE[s.el]), charge: ANION_STATE[s.el], count: 1 }];
    case 'oxacido': {
      const a = oxoacid(s.el, s.ox, s.form ?? 'normal');
      const g = `${s.el}${a.x > 1 ? a.x : ''}O${a.o > 1 ? a.o : ''}`;
      return [{ label: 'H⁺', charge: 1, count: a.h }, { label: ionLabel(g, -a.h), charge: -a.h, count: 1 }];
    }
    case 'sal-binaria': {
      if (s.cation.el === 'NH4') return [{ label: 'NH₄⁺', charge: 1, count: comp.N }, { label: ionLabel(s.anion, ANION_STATE[s.anion]), charge: ANION_STATE[s.anion], count: comp[s.anion] }];
      const cp = cat(s.cation.el, (s.cation as { ox: number }).ox);
      const q = engineEl(s.cation.el).kind === 'metal' ? ANION_STATE[s.anion] : -(cp.charge * cp.count) / comp[s.anion];
      return [cp, { label: ionLabel(s.anion, q), charge: q, count: comp[s.anion] }];
    }
    case 'oxisal': {
      const a = oxoacid(s.acid.el, s.acid.ox, s.acid.form ?? 'normal');
      const h = s.hLeft ?? 0;
      const g = `${h ? `H${h > 1 ? h : ''}` : ''}${s.acid.el}${a.x > 1 ? a.x : ''}O${a.o > 1 ? a.o : ''}`;
      const q = -(a.h - h);
      const m = comp[s.acid.el] / a.x;
      const cp: ChargePart = s.cation.el === 'NH4' ? { label: 'NH₄⁺', charge: 1, count: (comp.N ?? 0) - (s.acid.el === 'N' ? m : 0) } : cat(s.cation.el, (s.cation as { ox: number }).ox);
      return [cp, { label: ionLabel(g, q), charge: q, count: m }];
    }
    case 'sal-basica': {
      const cp = cat(s.cation.el, s.cation.ox);
      const an = typeof s.anion === 'string' ? ionLabel(s.anion, -1) : 'NO₃⁻';
      return [cp, { label: 'OH⁻', charge: -1, count: 1 }, { label: an, charge: -1, count: 1 }];
    }
  }
}

/** ¿Es una especie molecular (enlaces covalentes) en el modelo escolar? Los compuestos de metal se tratan como iónicos. */
export function isMolecular(c: Compound): boolean {
  return ['oxido-acido', 'oxido-neutro', 'hidruro-no-metalico', 'hidracido', 'oxacido', 'binario-no-metalico'].includes(c.fn) || c.key === 'peroxido:H';
}

/* ------------------------------------------------------------------ enumeración (para el script de PubChem y las pruebas) */

const FORMS: AcidForm[] = ['normal', 'meta', 'di'];

/** Todas las entradas que el taller acepta (conjunto finito). */
export function enumerateForgeInputs(): ForgeInput[] {
  const out: ForgeInput[] = [];
  for (const route of ROUTES) {
    if (route.slots === 1) {
      for (const a of ENGINE_SYMBOLS) for (const oxA of KNOWN_STATES[a]) for (const form of route.id === 'anhidrido-agua' ? FORMS : ['normal' as AcidForm]) out.push({ route: route.id, a, oxA, ...(route.id === 'anhidrido-agua' ? { form } : {}) });
    } else if (route.id === 'metal-nometal') {
      for (const a of ENGINE_SYMBOLS) for (const oxA of KNOWN_STATES[a]) for (const b of ENGINE_SYMBOLS) if (ANION_STATE[b] !== undefined) out.push({ route: route.id, a, oxA, b, oxB: ANION_STATE[b] });
    } else {
      for (const a of ENGINE_SYMBOLS) for (const oxA of KNOWN_STATES[a]) for (const b of ENGINE_SYMBOLS) for (const oxB of KNOWN_STATES[b]) {
        if (oxB < 0) { out.push({ route: route.id, a, oxA, b, oxB }); continue; }
        for (const form of FORMS) for (const hLeft of [0, 1, 2]) out.push({ route: route.id, a, oxA, b, oxB, form, hLeft });
      }
    }
  }
  return out;
}

/** Resultados válidos del taller (sin repetir entradas equivalentes). */
export function enumerateForgeResults(): ForgeOk[] {
  const seen = new Set<string>();
  const out: ForgeOk[] = [];
  for (const inp of enumerateForgeInputs()) {
    const r = forge(inp);
    if (!r.ok) continue;
    const k = `${inp.route}|${r.product.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Todos los compuestos que aparecen en las ecuaciones del taller (productos, agua y reactivos compuestos). */
export function forgeCompounds(results: ForgeOk[] = enumerateForgeResults()): Compound[] {
  const map = new Map<string, Compound>();
  for (const r of results) for (const t of [...r.reactants, ...r.products]) if (t.compound && !map.has(t.compound.key)) map.set(t.compound.key, t.compound);
  return [...map.values()].sort((p, q) => p.key.localeCompare(q.key));
}

/* ------------------------------------------------------------------ retos */

export interface ForgeChallenge { id: string; text: string; target: string; hint: string; route?: RouteId }

export const FORGE_CHALLENGES: ForgeChallenge[] = [
  { id: 'acido-sulfurico', text: 'Forma el ácido sulfúrico.', target: 'oxacido:S6', hint: 'Primero forma el óxido de azufre con +6 y luego hazlo reaccionar con agua.' },
  { id: 'nitrato-calcio', text: 'Forma la sal del calcio con el ácido nítrico.', target: 'oxisal:Ca2-N5', hint: 'Neutraliza el ácido nítrico (N con +5) con el hidróxido de calcio.' },
  { id: 'cal-apagada', text: 'Forma la cal apagada, Ca(OH)₂.', target: 'hidroxido:Ca2', hint: 'El óxido de calcio (cal viva) reacciona con el agua.' },
  { id: 'herrumbre', text: 'Forma el óxido de hierro(III), el principal componente de la herrumbre.', target: 'oxido:Fe3', hint: 'Metal + O₂ con el hierro en +3.' },
  { id: 'sal-cocina', text: 'Forma la sal de cocina directamente a partir de sus elementos.', target: 'sal:Na1-Cl', route: 'metal-nometal', hint: 'Metal + no metal: sodio y cloro.' },
  { id: 'bicarbonato', text: 'Forma el bicarbonato de sodio (una sal ácida).', target: 'oxisal:Na1-C4-H1', hint: 'Neutralización parcial del ácido carbónico (C con +4) con NaOH: la sal conserva 1 H.' },
  { id: 'clorhidrico', text: 'Forma el cloruro de hidrógeno, que en agua es el ácido clorhídrico.', target: 'hidracido:Cl', hint: 'H₂ + halógeno.' },
  { id: 'permanganato', text: 'Forma el permanganato de potasio.', target: 'oxisal:K1-Mn7', hint: 'El manganeso con +7 forma el ácido permangánico; neutralízalo con KOH.' },
  { id: 'yeso', text: 'Forma el sulfato de calcio (yeso sin agua de cristalización).', target: 'oxisal:Ca2-S6', hint: 'Neutraliza el ácido sulfúrico con el hidróxido de calcio.' },
  { id: 'agua-oxigenada', text: 'Forma el agua oxigenada.', target: 'peroxido:H', hint: 'Ruta del peróxido con el hidrógeno.' },
];

export function challengeMet(ch: ForgeChallenge, r: ForgeOutcome): boolean {
  return r.ok && r.product.key === ch.target && (!ch.route || r.input.route === ch.route);
}

export const familyOfCompound = (c: Compound) => FUNCTION_LABEL[c.fn];
export { specKey };

/* ------------------------------------------------------------------ ficha del modelo */

export const compoundForgeModelSpec: ModelSpec = {
  name: 'Taller de formación de compuestos: elementos elegidos → fórmula, ecuación balanceada, función y nombres',
  inputs: [
    { symbol: 'ruta', name: 'Ruta de formación (metal + O₂, no metal + O₂, peróxido, hidruro, óxido + agua, H₂ + no metal, neutralización, metal + no metal)', unit: '—', initial: 'metal + O₂' },
    { symbol: 'A, n.o.(A)', name: 'Primer elemento y su número de oxidación', unit: '—', initial: 'Ca, +2' },
    { symbol: 'B, n.o.(B)', name: 'Segundo elemento (rutas de sales) y su número de oxidación', unit: '—', initial: '—' },
  ],
  outputs: [
    { symbol: 'fórmula', name: 'Fórmula por neutralidad de cargas (motor de nomenclatura)', unit: '—' },
    { symbol: 'ecuación', name: 'Ecuación balanceada por el método algebraico (espacio nulo exacto)', unit: '—' },
    { symbol: 'registro', name: 'Compuesto registrado en PubChem (CID) o fórmula formal', unit: '—' },
  ],
  equations: [
    'Neutralidad: n·q(catión) + m·q(anión) = 0 con los menores enteros',
    'Balanceo: A·x = 0 (A = matriz de composición; productos con signo negativo); x = vector del espacio nulo con enteros mínimos positivos',
  ],
  initialConditions: ['Calcio (+2) + O₂ → 2 Ca + O₂ → 2 CaO, óxido de calcio.'],
  assumptions: [
    `Solo se usan los ${ENGINE_SYMBOLS.length} elementos y los estados de oxidación del motor de nomenclatura (validado con compuestos de referencia contra los sinónimos de PubChem).`,
    'Cada ecuación se rotula como reacción directa, reacción en condiciones especiales o relación formal de composición.',
    'Que un compuesto esté registrado en PubChem no garantiza que sea estable; que no esté registrado no prueba que no exista.',
  ],
  limits: [
    'No predice si una reacción ocurre ni su rapidez: la vía real de obtención es una nota curada, no un cálculo.',
    'Los S y P elementales se escriben como átomos (no S₈ ni P₄), como en los textos escolares.',
  ],
  testCases: ['2 Ca + O₂ → 2 CaO; CaO + H₂O → Ca(OH)₂; 2 S + 3 O₂ → 2 SO₃; SO₃ + H₂O → H₂SO₄; H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2 H₂O; He rechazado (gas noble).'],
};

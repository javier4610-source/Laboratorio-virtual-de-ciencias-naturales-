/**
 * Tabla periódica completa (118 elementos) para el «Taller de formación de compuestos».
 *
 * Datos: número atómico, símbolo y nombre en español (nombres recomendados por la RAE/IUPAC en español: «cinc»,
 * «wolframio», «oganesón»…), grupo y período según la tabla de 18 columnas de la IUPAC, y la familia escolar
 * (metal alcalino, metal de transición, metaloide, no metal, halógeno, gas noble, lantánido, actínido).
 * La clasificación de metaloides (B, Si, Ge, As, Sb, Te) es la habitual en los textos escolares; no hay una frontera
 * única aceptada. Funciones puras.
 */

export type PtCategory =
  | 'alcalino' | 'alcalinoterreo' | 'transicion' | 'postransicion' | 'metaloide' | 'nometal' | 'halogeno' | 'gas-noble' | 'lantanido' | 'actinido';

export interface PtElement {
  z: number; sym: string; es: string;
  /** Grupo 1–18 (null para lantánidos y actínidos, que se dibujan en las filas inferiores). */
  group: number | null;
  period: number;
  category: PtCategory;
  /** Fila y columna en la cuadrícula de dibujo (1–9 filas; las filas 8 y 9 son el bloque f). */
  row: number; col: number;
}

const NAMES = 'H hidrógeno|He helio|Li litio|Be berilio|B boro|C carbono|N nitrógeno|O oxígeno|F flúor|Ne neón|Na sodio|Mg magnesio|Al aluminio|Si silicio|P fósforo|S azufre|Cl cloro|Ar argón|K potasio|Ca calcio|Sc escandio|Ti titanio|V vanadio|Cr cromo|Mn manganeso|Fe hierro|Co cobalto|Ni níquel|Cu cobre|Zn cinc|Ga galio|Ge germanio|As arsénico|Se selenio|Br bromo|Kr kriptón|Rb rubidio|Sr estroncio|Y itrio|Zr circonio|Nb niobio|Mo molibdeno|Tc tecnecio|Ru rutenio|Rh rodio|Pd paladio|Ag plata|Cd cadmio|In indio|Sn estaño|Sb antimonio|Te telurio|I yodo|Xe xenón|Cs cesio|Ba bario|La lantano|Ce cerio|Pr praseodimio|Nd neodimio|Pm prometio|Sm samario|Eu europio|Gd gadolinio|Tb terbio|Dy disprosio|Ho holmio|Er erbio|Tm tulio|Yb iterbio|Lu lutecio|Hf hafnio|Ta tantalio|W wolframio|Re renio|Os osmio|Ir iridio|Pt platino|Au oro|Hg mercurio|Tl talio|Pb plomo|Bi bismuto|Po polonio|At astato|Rn radón|Fr francio|Ra radio|Ac actinio|Th torio|Pa protactinio|U uranio|Np neptunio|Pu plutonio|Am americio|Cm curio|Bk berkelio|Cf californio|Es einstenio|Fm fermio|Md mendelevio|No nobelio|Lr laurencio|Rf rutherfordio|Db dubnio|Sg seaborgio|Bh bohrio|Hs hasio|Mt meitnerio|Ds darmstatio|Rg roentgenio|Cn copernicio|Nh nihonio|Fl flerovio|Mc moscovio|Lv livermorio|Ts teneso|Og oganesón'
  .split('|').map((x) => { const i = x.indexOf(' '); return [x.slice(0, i), x.slice(i + 1)] as const; });

const METALLOIDS = new Set(['B', 'Si', 'Ge', 'As', 'Sb', 'Te']);
const NONMETALS = new Set(['H', 'C', 'N', 'O', 'P', 'S', 'Se']);
const HALOGENS = new Set(['F', 'Cl', 'Br', 'I', 'At', 'Ts']);
const NOBLE = new Set(['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og']);

/** Período y grupo de un número atómico en la tabla de 18 columnas (null = bloque f). */
function position(z: number): { period: number; group: number | null } {
  if (z <= 2) return { period: 1, group: z === 1 ? 1 : 18 };
  const starts = [3, 11, 19, 37, 55, 87];
  let p = 0;
  while (p + 1 < starts.length && z >= starts[p + 1]) p++;
  const period = p + 2;
  const k = z - starts[p]; // 0-based dentro del período
  if (period <= 3) return { period, group: k < 2 ? k + 1 : k + 11 };
  if (period <= 5) return { period, group: k + 1 };
  // Períodos 6 y 7: 2 del bloque s, 15 del bloque f (La–Lu, Ac–Lr) y luego grupos 4–18.
  if (k < 2) return { period, group: k + 1 };
  if (k < 17) return { period, group: null };
  return { period, group: k - 13 };
}

function categoryOf(sym: string, z: number, group: number | null): PtCategory {
  if (NOBLE.has(sym)) return 'gas-noble';
  if (HALOGENS.has(sym)) return 'halogeno';
  if (METALLOIDS.has(sym)) return 'metaloide';
  if (NONMETALS.has(sym)) return 'nometal';
  if (group === null) return z < 89 ? 'lantanido' : 'actinido';
  if (group === 1) return 'alcalino';
  if (group === 2) return 'alcalinoterreo';
  if (group >= 3 && group <= 12) return 'transicion';
  return 'postransicion';
}

export const PT_ELEMENTS: PtElement[] = NAMES.map(([sym, es], i) => {
  const z = i + 1;
  const { period, group } = position(z);
  const fRow = group === null;
  const row = fRow ? (period === 6 ? 8 : 9) : period;
  const col = fRow ? 3 + (z - (period === 6 ? 57 : 89)) : (group as number);
  return { z, sym, es, group, period, category: categoryOf(sym, z, group), row, col };
});

export const CATEGORY_LABEL: Record<PtCategory, string> = {
  alcalino: 'metal alcalino', alcalinoterreo: 'metal alcalinotérreo', transicion: 'metal de transición', postransicion: 'metal del bloque p',
  metaloide: 'metaloide', nometal: 'no metal', halogeno: 'halógeno (no metal)', 'gas-noble': 'gas noble', lantanido: 'lantánido (metal)', actinido: 'actínido (metal)',
};

export const isMetalCategory = (c: PtCategory) => c === 'alcalino' || c === 'alcalinoterreo' || c === 'transicion' || c === 'postransicion' || c === 'lantanido' || c === 'actinido';

export function ptElement(sym: string): PtElement {
  const e = PT_ELEMENTS.find((x) => x.sym === sym);
  if (!e) throw new RangeError(`Símbolo desconocido: ${sym}`);
  return e;
}

/** Elementos radiactivos sin isótopos estables (Tc, Pm y Z ≥ 84). */
export const isRadioactive = (z: number) => z === 43 || z === 61 || z >= 84;
/** Elementos sintéticos (no se encuentran en cantidades apreciables en la naturaleza): Tc, Pm y Z ≥ 93. */
export const isSynthetic = (z: number) => z === 43 || z === 61 || z >= 93;

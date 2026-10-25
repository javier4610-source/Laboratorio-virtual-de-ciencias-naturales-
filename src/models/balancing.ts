import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Balanceo de ecuaciones químicas por conteo de átomos (grado 8.º).
 *
 * Una ecuación está balanceada cuando, para cada elemento E,
 *   Σ νᵢ·nᵢ(E) en los reactivos = Σ νⱼ·nⱼ(E) en los productos,
 * donde ν son los coeficientes (enteros positivos) y n(E) el número de átomos de E en cada fórmula.
 * Equivale a buscar el espacio nulo de la matriz de composición A (elementos × sustancias, con los
 * productos en negativo): A·ν = 0. Si ese espacio tiene dimensión 1, la solución es única salvo un
 * factor común, y la forma convencional es la de menores enteros (mcd de los coeficientes = 1).
 *
 * Al leer los coeficientes como moles, Σ ν·M de los reactivos = Σ ν·M de los productos: la
 * conservación de los átomos implica la conservación de la masa (ley de Lavoisier).
 */

/* ------------------------------------------------------------------ elementos */

/** Masas atómicas estándar abreviadas (g/mol), CIAAW/IUPAC. */
export const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18,
  Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.95, K: 39.098, Ca: 40.078,
  Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Br: 79.904, Ag: 107.87,
  Sn: 118.71, I: 126.9, Ba: 137.33, Au: 196.97, Hg: 200.59, Pb: 207.2,
  // Elementos del Taller de formación de compuestos (v2.5.0): pesos atómicos estándar abreviados de la CIAAW (IUPAC),
  // transcritos de la base de datos «mendeleev» 1.3.0 y redondeados a 5 cifras significativas como los anteriores.
  Sc: 44.956, Ti: 47.867, V: 50.942, Ga: 69.723, Ge: 72.63, As: 74.922, Se: 78.971, Rb: 85.468, Sr: 87.62, Y: 88.906,
  Zr: 91.224, Nb: 92.906, Mo: 95.95, Ru: 101.07, Rh: 102.91, Pd: 106.42, Cd: 112.41, In: 114.82, Sb: 121.76, Te: 127.6,
  Cs: 132.91, La: 138.91, Ce: 140.12, Pr: 140.91, Nd: 144.24, Sm: 150.36, Eu: 151.96, Gd: 157.25, Tb: 158.93, Dy: 162.5,
  Ho: 164.93, Er: 167.26, Tm: 168.93, Yb: 173.05, Lu: 174.97, Hf: 178.49, Ta: 180.95, W: 183.84, Re: 186.21, Os: 190.23,
  Ir: 192.22, Pt: 195.08, Tl: 204.38, Bi: 208.98,
  // El polonio no tiene peso atómico estándar (no tiene isótopos estables): se usa el número másico de su isótopo de
  // vida más larga, ²⁰⁹Po, como hace la tabla de la IUPAC entre corchetes.
  Po: 209,
};

/** Nombres en español de los elementos que aparecen en las reacciones de la práctica. */
export const ELEMENT_NAME: Record<string, string> = {
  H: 'hidrógeno', C: 'carbono', O: 'oxígeno', N: 'nitrógeno', Na: 'sodio', Cl: 'cloro', Fe: 'hierro', Al: 'aluminio',
  Ca: 'calcio', P: 'fósforo', S: 'azufre', K: 'potasio', Mg: 'magnesio', Cu: 'cobre',
};

/** Colores CPK (convención de los modelos de esferas y varillas), con ajustes de contraste. */
export const CPK: Record<string, string> = {
  H: '#f4f6f7', C: '#3a3f44', O: '#e0322b', N: '#3050f8', Na: '#9c5ce0', Cl: '#2f9e44', Fe: '#c0602a',
  Al: '#b8a4a4', Ca: '#6dbb3c', P: '#ff8000', S: '#e8c300', K: '#8f40d4', Mg: '#5fa83a', Cu: '#c88033',
};

export type Composition = Record<string, number>;

/* ------------------------------------------------------------------ analizador de fórmulas */

function addInto(target: Composition, src: Composition, mult: number) {
  for (const [el, n] of Object.entries(src)) target[el] = (target[el] ?? 0) + n * mult;
}

/**
 * Cuenta los átomos de una fórmula: admite subíndices, paréntesis y corchetes anidados
 * («Ca3(PO4)2», «K4[Fe(CN)6]») e hidratos con «·», «*» o «.» («CuSO4·5H2O»).
 * Acepta subíndices Unicode (₀–₉). Lanza un error explicativo si la fórmula no es válida.
 */
export function parseFormula(formula: string): Composition {
  const clean = formula.replace(/\s/g, '').replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080));
  if (clean === '') throw new Error('La fórmula está vacía.');
  const total: Composition = {};
  for (const part of clean.split(/[·.*]/)) {
    if (part === '') throw new Error(`Falta una parte del hidrato en «${formula}».`);
    const m = part.match(/^(\d*)(.*)$/)!;
    const mult = m[1] ? parseInt(m[1], 10) : 1;
    if (mult === 0) throw new Error(`Multiplicador cero en «${formula}».`);
    if (m[2] === '') throw new Error(`Falta la fórmula después de ${mult} en «${formula}».`);
    addInto(total, parseGroup(m[2], formula), mult);
  }
  return total;
}

function parseGroup(s: string, original: string): Composition {
  const stack: { comp: Composition; open: string }[] = [{ comp: {}, open: '' }];
  let i = 0;
  const readNumber = () => {
    let num = '';
    while (i < s.length && /\d/.test(s[i])) num += s[i++];
    if (num === '') return 1;
    const n = parseInt(num, 10);
    if (n === 0) throw new Error(`Subíndice cero en «${original}».`);
    return n;
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(' || ch === '[') { stack.push({ comp: {}, open: ch }); i++; }
    else if (ch === ')' || ch === ']') {
      const top = stack.pop();
      if (!top || stack.length === 0 || top.open !== (ch === ')' ? '(' : '[')) throw new Error(`Paréntesis desbalanceados en «${original}».`);
      if (Object.keys(top.comp).length === 0) throw new Error(`Paréntesis vacíos en «${original}».`);
      i++;
      addInto(stack[stack.length - 1].comp, top.comp, readNumber());
    } else if (/[A-Z]/.test(ch)) {
      let el = ch; i++;
      while (i < s.length && /[a-z]/.test(s[i])) el += s[i++];
      if (!(el in ATOMIC_MASS)) throw new Error(`Elemento desconocido «${el}» en «${original}».`);
      const n = readNumber();
      const top = stack[stack.length - 1].comp;
      top[el] = (top[el] ?? 0) + n;
    } else {
      throw new Error(`Carácter no válido «${ch}» en «${original}».`);
    }
  }
  if (stack.length !== 1) throw new Error(`Paréntesis desbalanceados en «${original}».`);
  return stack[0].comp;
}

/** Masa molar (g/mol) a partir de la fórmula. */
export function molarMass(formula: string): number {
  return Object.entries(parseFormula(formula)).reduce((sum, [el, n]) => sum + ATOMIC_MASS[el] * n, 0);
}

/** Fórmula con subíndices Unicode para la interfaz («Ca3(PO4)2» → «Ca₃(PO₄)₂»). */
export function prettyFormula(formula: string): string {
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return formula.replace(/(?<=[A-Za-z)\]])(\d+)/g, (d) => [...d].map((c) => sub[+c]).join(''));
}

/* ------------------------------------------------------------------ aritmética entera y racional */

export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export function lcm(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : Math.abs((a / gcd(a, b)) * b);
}
/** Máximo común divisor de una lista de enteros (0 si la lista está vacía). */
export function gcdAll(values: number[]): number {
  return values.reduce((g, v) => gcd(g, v), 0);
}

/** Fracción exacta n/d con d > 0 y en términos mínimos. */
export interface Frac { n: number; d: number }
export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new RangeError('División entre cero.');
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new RangeError('La aritmética racional excede los enteros seguros.');
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
}
const fsub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const fmul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const fdiv = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);

/**
 * Forma escalonada reducida por filas (Gauss-Jordan) con fracciones exactas.
 * Devuelve la matriz reducida y las columnas pivote.
 */
export function rref(matrix: number[][]): { rows: Frac[][]; pivots: number[] } {
  const m = matrix.map((r) => r.map((v) => frac(v)));
  const nRows = m.length, nCols = nRows ? m[0].length : 0;
  const pivots: number[] = [];
  let row = 0;
  for (let col = 0; col < nCols && row < nRows; col++) {
    let p = row;
    while (p < nRows && m[p][col].n === 0) p++;
    if (p === nRows) continue;
    [m[row], m[p]] = [m[p], m[row]];
    const pv = m[row][col];
    m[row] = m[row].map((v) => fdiv(v, pv));
    for (let r = 0; r < nRows; r++) {
      if (r === row || m[r][col].n === 0) continue;
      const f = m[r][col];
      m[r] = m[r].map((v, c) => fsub(v, fmul(f, m[row][c])));
    }
    pivots.push(col);
    row++;
  }
  return { rows: m, pivots };
}

/** Base entera del espacio nulo de una matriz (cada vector escalado a enteros con mcd 1). */
export function nullspace(matrix: number[][]): number[][] {
  const nCols = matrix.length ? matrix[0].length : 0;
  const { rows, pivots } = rref(matrix);
  const free = Array.from({ length: nCols }, (_, c) => c).filter((c) => !pivots.includes(c));
  return free.map((f) => {
    const v: Frac[] = Array.from({ length: nCols }, () => frac(0));
    v[f] = frac(1);
    pivots.forEach((pc, r) => { v[pc] = frac(-rows[r][f].n, rows[r][f].d); });
    const den = v.reduce((l, x) => lcm(l, x.d), 1);
    const ints = v.map((x) => (x.n * den) / x.d);
    const g = gcdAll(ints) || 1;
    return ints.map((x) => x / g);
  });
}

/* ------------------------------------------------------------------ reacciones */

export type Level = 1 | 2 | 3;
export type SpeciesKind = 'molecula' | 'unidad' | 'atomo';

export interface SpeciesDef { formula: string; name: string; kind: SpeciesKind }
export interface ReactionDef {
  id: string;
  name: string;
  level: Level;
  context: string;
  reactants: SpeciesDef[];
  products: SpeciesDef[];
  /** Coeficientes de la forma balanceada con menores enteros (reactivos y luego productos). */
  answer: number[];
}

const sp = (formula: string, name: string, kind: SpeciesKind = 'molecula'): SpeciesDef => ({ formula, name, kind });
const H2O = sp('H2O', 'agua');
const O2 = sp('O2', 'oxígeno');
const CO2 = sp('CO2', 'dióxido de carbono');

export const LEVEL_NAME: Record<Level, string> = { 1: 'Básico', 2: 'Intermedio', 3: 'Avanzado' };

/** Doce reacciones ordenadas por dificultad (número de sustancias, de elementos y tamaño de los coeficientes). */
export const REACTIONS: ReactionDef[] = [
  { id: 'agua', name: 'Síntesis del agua', level: 1, context: 'El hidrógeno arde en el oxígeno y forma agua (así funcionan las celdas de combustible).', reactants: [sp('H2', 'hidrógeno'), O2], products: [H2O], answer: [2, 1, 2] },
  { id: 'peroxido', name: 'Descomposición del agua oxigenada', level: 1, context: 'El agua oxigenada (H₂O₂) del botiquín burbujea en una herida: se descompone en agua y oxígeno.', reactants: [sp('H2O2', 'peróxido de hidrógeno')], products: [H2O, O2], answer: [2, 2, 1] },
  { id: 'neutralizacion', name: 'Neutralización: HCl + NaOH', level: 1, context: 'Un ácido y una base se neutralizan y forman sal de cocina y agua.', reactants: [sp('HCl', 'ácido clorhídrico'), sp('NaOH', 'hidróxido de sodio', 'unidad')], products: [sp('NaCl', 'cloruro de sodio', 'unidad'), H2O], answer: [1, 1, 1, 1] },
  { id: 'hierroacido', name: 'Hierro con ácido clorhídrico', level: 1, context: 'Una puntilla de hierro en ácido clorhídrico libera burbujas de hidrógeno.', reactants: [sp('Fe', 'hierro', 'atomo'), sp('HCl', 'ácido clorhídrico')], products: [sp('FeCl2', 'cloruro de hierro(II)', 'unidad'), sp('H2', 'hidrógeno')], answer: [1, 2, 1, 1] },
  { id: 'bicarbonato', name: 'Bicarbonato de sodio con vinagre', level: 1, context: 'El bicarbonato y el ácido acético del vinagre producen el gas que infla un globo.', reactants: [sp('NaHCO3', 'bicarbonato de sodio', 'unidad'), sp('CH3COOH', 'ácido acético')], products: [sp('CH3COONa', 'acetato de sodio', 'unidad'), H2O, CO2], answer: [1, 1, 1, 1, 1] },
  { id: 'metano', name: 'Combustión del metano', level: 2, context: 'El biogás de un biodigestor de una finca de Urabá es casi todo metano; al arder produce CO₂ y agua.', reactants: [sp('CH4', 'metano'), O2], products: [CO2, H2O], answer: [1, 2, 1, 2] },
  { id: 'aluminio', name: 'Oxidación del aluminio', level: 2, context: 'El aluminio de una olla se cubre de una capa delgada de óxido que lo protege.', reactants: [sp('Al', 'aluminio', 'atomo'), O2], products: [sp('Al2O3', 'óxido de aluminio', 'unidad')], answer: [4, 3, 2] },
  { id: 'herrumbre', name: 'Formación del óxido de hierro(III)', level: 2, context: 'Las rejas y puntillas de hierro de las casas de Apartadó se oxidan con el oxígeno y la humedad del aire.', reactants: [sp('Fe', 'hierro', 'atomo'), O2], products: [sp('Fe2O3', 'óxido de hierro(III)', 'unidad')], answer: [4, 3, 2] },
  { id: 'propano', name: 'Combustión del propano', level: 3, context: 'El gas de pipeta de las cocinas es principalmente propano.', reactants: [sp('C3H8', 'propano'), O2], products: [CO2, H2O], answer: [1, 5, 3, 4] },
  { id: 'fosfato', name: 'Hidróxido de calcio con ácido fosfórico', level: 3, context: 'La cal neutraliza el ácido fosfórico y forma fosfato de calcio, el mineral de los huesos.', reactants: [sp('Ca(OH)2', 'hidróxido de calcio', 'unidad'), sp('H3PO4', 'ácido fosfórico')], products: [sp('Ca3(PO4)2', 'fosfato de calcio', 'unidad'), H2O], answer: [3, 2, 1, 6] },
  { id: 'respiracion', name: 'Respiración celular de la glucosa', level: 3, context: 'Las mitocondrias de tus células oxidan la glucosa para obtener energía.', reactants: [sp('C6H12O6', 'glucosa'), O2], products: [CO2, H2O], answer: [1, 6, 6, 6] },
  { id: 'fotosintesis', name: 'Fotosíntesis', level: 3, context: 'Las hojas de una plantación de banano fabrican glucosa con CO₂, agua y luz.', reactants: [CO2, H2O], products: [sp('C6H12O6', 'glucosa'), O2], answer: [6, 6, 1, 6] },
];

export function reactionById(id: string): ReactionDef {
  const r = REACTIONS.find((x) => x.id === id);
  if (!r) throw new RangeError(`Reacción desconocida: ${id}`);
  return r;
}

export const allSpecies = (r: ReactionDef) => [...r.reactants, ...r.products];

/** Límites de los coeficientes que el estudiante puede elegir. */
export const COEF_LIMITS = { min: 1, max: 12 } as const;

/** Valida que haya un coeficiente entero entre 1 y 12 para cada sustancia. */
export function assertCoefficients(r: ReactionDef, coefs: number[]): void {
  const species = allSpecies(r);
  if (coefs.length !== species.length) throw new RangeError(`Se esperaban ${species.length} coeficientes y se recibieron ${coefs.length}.`);
  coefs.forEach((c, i) => {
    assertInRange(`El coeficiente de ${prettyFormula(species[i].formula)}`, c, COEF_LIMITS.min, COEF_LIMITS.max);
    if (!Number.isInteger(c)) throw new RangeError(`El coeficiente de ${prettyFormula(species[i].formula)} debe ser un número entero.`);
  });
}

/** Elementos de la reacción en orden de aparición. */
export function elementsOf(r: ReactionDef): string[] {
  const out: string[] = [];
  for (const s of allSpecies(r)) for (const el of Object.keys(parseFormula(s.formula))) if (!out.includes(el)) out.push(el);
  return out;
}

/** Átomos totales de cada elemento en una lista de sustancias multiplicadas por sus coeficientes. */
export function countAtoms(species: { formula: string }[], coefs: number[]): Composition {
  const total: Composition = {};
  species.forEach((s, i) => addInto(total, parseFormula(s.formula), coefs[i]));
  return total;
}

export interface ElementRow { element: string; left: number; right: number; diff: number }

/** Conteo por elemento: reactivos (left), productos (right) y diferencia productos − reactivos. */
export function countSides(r: ReactionDef, coefs: number[]): ElementRow[] {
  assertCoefficients(r, coefs);
  const nR = r.reactants.length;
  const L = countAtoms(r.reactants, coefs.slice(0, nR));
  const R = countAtoms(r.products, coefs.slice(nR));
  return elementsOf(r).map((element) => {
    const left = L[element] ?? 0, right = R[element] ?? 0;
    return { element, left, right, diff: right - left };
  });
}

/** Matriz de composición: filas = elementos, columnas = sustancias (productos con signo negativo). */
export function compositionMatrix(r: ReactionDef): number[][] {
  const species = allSpecies(r);
  const nR = r.reactants.length;
  return elementsOf(r).map((el) => species.map((s, j) => (parseFormula(s.formula)[el] ?? 0) * (j < nR ? 1 : -1)));
}

export interface SolverResult {
  /** Dimensión del espacio nulo: 1 = solución única salvo un factor común. */
  nullity: number;
  unique: boolean;
  /** Coeficientes mínimos positivos (null si no hay solución única con todos positivos). */
  coefficients: number[] | null;
  /** Ecuaciones del método algebraico, una por elemento («H: 2a = 2c»). */
  equations: string[];
}

const LETTERS = 'abcdefghij';

/** Resuelve el balanceo por el método algebraico (espacio nulo con aritmética racional exacta). */
export function solveBalance(r: ReactionDef): SolverResult {
  const A = compositionMatrix(r);
  const basis = nullspace(A);
  const nullity = basis.length;
  let coefficients: number[] | null = null;
  if (nullity === 1) {
    const v = basis[0];
    const sign = v.find((x) => x !== 0)! < 0 ? -1 : 1;
    const w = v.map((x) => x * sign);
    if (w.every((x) => x > 0)) coefficients = w;
  }
  const nR = r.reactants.length;
  const term = (n: number, j: number) => `${n === 1 ? '' : n}${LETTERS[j]}`;
  const equations = A.map((row, i) => {
    const left = row.map((v, j) => (j < nR && v ? term(v, j) : '')).filter(Boolean).join(' + ');
    const right = row.map((v, j) => (j >= nR && v ? term(-v, j) : '')).filter(Boolean).join(' + ');
    return `${elementsOf(r)[i]}: ${left || '0'} = ${right || '0'}`;
  });
  return { nullity, unique: nullity === 1 && coefficients !== null, coefficients, equations };
}

/* ------------------------------------------------------------------ masa y verificación */

/** Resolución con la que se informan las masas (g). */
export const MASS_RES = 0.01;

export interface MassResult { reactants: number; products: number; difference: number }

/** Masas Σ ν·M de cada lado, leyendo los coeficientes como moles (g). */
export function sideMasses(r: ReactionDef, coefs: number[]): MassResult {
  assertCoefficients(r, coefs);
  const nR = r.reactants.length;
  const sum = (list: SpeciesDef[], cs: number[]) => list.reduce((a, s, i) => a + cs[i] * molarMass(s.formula), 0);
  const reactants = sum(r.reactants, coefs.slice(0, nR));
  const products = sum(r.products, coefs.slice(nR));
  return { reactants, products, difference: products - reactants };
}

export type BalanceStatus = 'balanceada' | 'no minima' | 'no balanceada';

export interface CheckResult {
  rows: ElementRow[];
  balanced: boolean;
  /** Máximo común divisor de los coeficientes elegidos. */
  divisor: number;
  minimal: boolean;
  status: BalanceStatus;
  /** Suma de |diferencia| de átomos sobre todos los elementos. */
  imbalance: number;
  atomsLeft: number;
  atomsRight: number;
  mass: MassResult;
  /** Lecturas redondeadas a 0,01 g. */
  massReactants: number;
  massProducts: number;
  massDifference: number;
  solver: SolverResult;
  /** Si está balanceada: k tal que coeficientes = k × solución mínima. */
  multiple: number | null;
}

/** Verificación completa de unos coeficientes. Función pura y determinista. */
export function checkEquation(r: ReactionDef, coefs: number[]): CheckResult {
  const rows = countSides(r, coefs);
  const balanced = rows.every((x) => x.diff === 0);
  const divisor = gcdAll(coefs);
  const minimal = divisor === 1;
  const mass = sideMasses(r, coefs);
  const solver = solveBalance(r);
  let multiple: number | null = null;
  if (balanced && solver.coefficients) {
    const k = coefs[0] / solver.coefficients[0];
    if (coefs.every((c, i) => c === k * solver.coefficients![i])) multiple = k;
  }
  const massReactants = roundToResolution(mass.reactants, MASS_RES);
  const massProducts = roundToResolution(mass.products, MASS_RES);
  return {
    rows, balanced, divisor, minimal,
    status: !balanced ? 'no balanceada' : minimal ? 'balanceada' : 'no minima',
    imbalance: rows.reduce((a, x) => a + Math.abs(x.diff), 0),
    atomsLeft: rows.reduce((a, x) => a + x.left, 0),
    atomsRight: rows.reduce((a, x) => a + x.right, 0),
    mass, massReactants, massProducts,
    massDifference: balanced ? 0 : roundToResolution(mass.difference, MASS_RES),
    solver, multiple,
  };
}

export interface Hint { element: string | null; text: string }

/**
 * Pista: señala el elemento más desbalanceado (mayor |diferencia| de átomos; si hay empate, el que
 * aparece en menos sustancias, que es por donde conviene empezar) y en qué lado faltan átomos.
 */
export function hintFor(r: ReactionDef, coefs: number[]): Hint {
  const rows = countSides(r, coefs);
  const divisor = gcdAll(coefs);
  const off = rows.filter((x) => x.diff !== 0);
  if (off.length === 0) {
    return divisor > 1
      ? { element: null, text: `La ecuación está balanceada, pero todos los coeficientes se pueden dividir entre ${divisor}. Simplifícalos para obtener los menores enteros.` }
      : { element: null, text: 'La ecuación ya está balanceada con los menores enteros posibles.' };
  }
  const species = allSpecies(r);
  const appearances = (el: string) => species.filter((s) => parseFormula(s.formula)[el]).length;
  const worst = [...off].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || appearances(a.element) - appearances(b.element))[0];
  const lacking = worst.diff > 0 ? 'reactivos' : 'productos';
  const nR = r.reactants.length;
  const candidates = species.filter((s, j) => parseFormula(s.formula)[worst.element] && (lacking === 'reactivos' ? j < nR : j >= nR)).map((s) => prettyFormula(s.formula));
  const name = ELEMENT_NAME[worst.element] ?? worst.element;
  return {
    element: worst.element,
    text: `Revisa el ${name} (${worst.element}): hay ${worst.left} átomo${worst.left === 1 ? '' : 's'} en los reactivos y ${worst.right} en los productos. ` +
      `Faltan ${Math.abs(worst.diff)} en los ${lacking}: aumenta el coeficiente de ${candidates.join(' o ')}. Nunca cambies los subíndices: cambiarías la sustancia.`,
  };
}

/**
 * Inclinación (grados) de la balanza de dos platos: positiva si bajan los productos (plato derecho).
 * Idealizada: θ = 14°·tanh(3·|Δm|/m_mayor), con un mínimo visible de 2° si los átomos no cuadran.
 */
export const TILT_MAX = 14;
export function tiltAngle(massLeft: number, massRight: number, balanced: boolean): number {
  if (balanced) return 0;
  const d = massRight - massLeft;
  const big = Math.max(massLeft, massRight);
  if (big <= 0) return 0;
  const mag = Math.max(2, TILT_MAX * Math.tanh((3 * Math.abs(d)) / big));
  return d === 0 ? 0 : Math.sign(d) * mag;
}

/** Ecuación con coeficientes para la interfaz («2 H₂ + O₂ → 2 H₂O»; se omite el 1). */
export function equationText(r: ReactionDef, coefs: number[]): string {
  const nR = r.reactants.length;
  const side = (list: SpeciesDef[], cs: number[]) => list.map((s, i) => `${cs[i] === 1 ? '' : `${cs[i]} `}${prettyFormula(s.formula)}`).join(' + ');
  return `${side(r.reactants, coefs.slice(0, nR))} → ${side(r.products, coefs.slice(nR))}`;
}

/* ------------------------------------------------------------------ modelos de esferas y varillas */

/** Átomo [elemento, x, y] y enlace [i, j, orden] (orden 0 = atracción iónica, dibujada punteada). */
export interface MoleculeLayout { atoms: [string, number, number][]; bonds: [number, number, number][] }

/** Coordenadas 2D esquemáticas (longitud de enlace ≈ 1). Las pruebas verifican que coinciden con la fórmula. */
export const LAYOUTS: Record<string, MoleculeLayout> = {
  H2: { atoms: [['H', -0.45, 0], ['H', 0.45, 0]], bonds: [[0, 1, 1]] },
  O2: { atoms: [['O', -0.55, 0], ['O', 0.55, 0]], bonds: [[0, 1, 2]] },
  H2O: { atoms: [['O', 0, -0.2], ['H', -0.8, 0.45], ['H', 0.8, 0.45]], bonds: [[0, 1, 1], [0, 2, 1]] },
  H2O2: { atoms: [['O', -0.55, 0], ['O', 0.55, 0], ['H', -1.15, 0.7], ['H', 1.15, -0.7]], bonds: [[0, 1, 1], [0, 2, 1], [1, 3, 1]] },
  CO2: { atoms: [['O', -1.15, 0], ['C', 0, 0], ['O', 1.15, 0]], bonds: [[0, 1, 2], [1, 2, 2]] },
  CH4: { atoms: [['C', 0, 0], ['H', 0, -1], ['H', 1, 0], ['H', 0, 1], ['H', -1, 0]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
  C3H8: {
    atoms: [['C', -1.1, 0], ['C', 0, 0], ['C', 1.1, 0], ['H', -2.05, 0], ['H', -1.1, -0.95], ['H', -1.1, 0.95], ['H', 0, -0.95], ['H', 0, 0.95], ['H', 2.05, 0], ['H', 1.1, -0.95], ['H', 1.1, 0.95]],
    bonds: [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [1, 6, 1], [1, 7, 1], [2, 8, 1], [2, 9, 1], [2, 10, 1]],
  },
  C6H12O6: {
    atoms: [
      ['C', -2.5, 0], ['C', -1.5, 0], ['C', -0.5, 0], ['C', 0.5, 0], ['C', 1.5, 0], ['C', 2.5, 0],
      ['O', -2.5, -1], ['H', -3.35, 0.5],
      ['O', -1.5, 1], ['H', -1.5, 1.8], ['H', -1.5, -0.9],
      ['O', -0.5, -1], ['H', -0.5, -1.8], ['H', -0.5, 0.9],
      ['O', 0.5, 1], ['H', 0.5, 1.8], ['H', 0.5, -0.9],
      ['O', 1.5, 1], ['H', 1.5, 1.8], ['H', 1.5, -0.9],
      ['O', 3.35, -0.5], ['H', 4.1, -0.1], ['H', 2.5, -0.95], ['H', 2.5, 0.95],
    ],
    bonds: [
      [0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 1], [0, 6, 2], [0, 7, 1],
      [1, 8, 1], [8, 9, 1], [1, 10, 1], [2, 11, 1], [11, 12, 1], [2, 13, 1],
      [3, 14, 1], [14, 15, 1], [3, 16, 1], [4, 17, 1], [17, 18, 1], [4, 19, 1],
      [5, 20, 1], [20, 21, 1], [5, 22, 1], [5, 23, 1],
    ],
  },
  Fe: { atoms: [['Fe', 0, 0]], bonds: [] },
  Al: { atoms: [['Al', 0, 0]], bonds: [] },
  HCl: { atoms: [['H', -0.55, 0], ['Cl', 0.55, 0]], bonds: [[0, 1, 1]] },
  NaOH: { atoms: [['Na', -1.05, 0], ['O', 0.1, 0], ['H', 0.95, 0]], bonds: [[0, 1, 0], [1, 2, 1]] },
  NaCl: { atoms: [['Na', -0.6, 0], ['Cl', 0.6, 0]], bonds: [[0, 1, 0]] },
  FeCl2: { atoms: [['Cl', -1.15, 0], ['Fe', 0, 0], ['Cl', 1.15, 0]], bonds: [[0, 1, 0], [1, 2, 0]] },
  Fe2O3: { atoms: [['O', -1.9, 0.45], ['Fe', -0.95, -0.2], ['O', 0, 0.45], ['Fe', 0.95, -0.2], ['O', 1.9, 0.45]], bonds: [[0, 1, 0], [1, 2, 0], [2, 3, 0], [3, 4, 0]] },
  Al2O3: { atoms: [['O', -1.9, 0.45], ['Al', -0.95, -0.2], ['O', 0, 0.45], ['Al', 0.95, -0.2], ['O', 1.9, 0.45]], bonds: [[0, 1, 0], [1, 2, 0], [2, 3, 0], [3, 4, 0]] },
  NaHCO3: {
    atoms: [['C', 0, 0], ['O', 0, -1.1], ['O', -1, 0.6], ['H', -1.8, 0.15], ['O', 1, 0.6], ['Na', 2.05, 0.15]],
    bonds: [[0, 1, 2], [0, 2, 1], [2, 3, 1], [0, 4, 1], [4, 5, 0]],
  },
  CH3COOH: {
    atoms: [['C', -0.6, 0], ['C', 0.6, 0], ['H', -1.55, 0], ['H', -0.6, -0.95], ['H', -0.6, 0.95], ['O', 1.15, -0.9], ['O', 1.3, 0.75], ['H', 2.15, 0.6]],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 2], [1, 6, 1], [6, 7, 1]],
  },
  CH3COONa: {
    atoms: [['C', -0.6, 0], ['C', 0.6, 0], ['H', -1.55, 0], ['H', -0.6, -0.95], ['H', -0.6, 0.95], ['O', 1.15, -0.9], ['O', 1.3, 0.75], ['Na', 2.35, 0.55]],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 2], [1, 6, 1], [6, 7, 0]],
  },
  'Ca(OH)2': { atoms: [['O', -1.15, 0.2], ['Ca', 0, 0], ['O', 1.15, 0.2], ['H', -1.9, -0.35], ['H', 1.9, -0.35]], bonds: [[0, 1, 0], [1, 2, 0], [0, 3, 1], [2, 4, 1]] },
  H3PO4: {
    atoms: [['P', 0, 0], ['O', 0, -1.1], ['O', -1.1, 0.3], ['H', -1.85, -0.25], ['O', 1.1, 0.3], ['H', 1.85, -0.25], ['O', 0, 1.1], ['H', 0.75, 1.65]],
    bonds: [[0, 1, 2], [0, 2, 1], [2, 3, 1], [0, 4, 1], [4, 5, 1], [0, 6, 1], [6, 7, 1]],
  },
  'Ca3(PO4)2': {
    atoms: [
      ['P', -1.5, 0], ['O', -1.5, -1], ['O', -2.5, 0], ['O', -1.5, 1], ['O', -0.5, 0],
      ['P', 1.5, 0], ['O', 1.5, -1], ['O', 2.5, 0], ['O', 1.5, 1], ['O', 0.5, 0],
      ['Ca', 0, -1.25], ['Ca', 0, 1.25], ['Ca', -3.45, 0.55],
    ],
    bonds: [
      [0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [5, 6, 1], [5, 7, 1], [5, 8, 1], [5, 9, 1],
      [10, 4, 0], [10, 9, 0], [10, 1, 0], [10, 6, 0], [11, 4, 0], [11, 9, 0], [11, 3, 0], [11, 8, 0], [12, 2, 0],
    ],
  },
};

/** Caja que contiene el dibujo de una molécula (unidades de enlace, sin el radio de los átomos). */
export function layoutBox(l: MoleculeLayout): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = l.atoms.map((a) => a[1]), ys = l.atoms.map((a) => a[2]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Radio relativo de cada átomo en el dibujo (H más pequeño, metales más grandes). */
export function atomRadius(el: string): number {
  if (el === 'H') return 0.3;
  if (['Na', 'Fe', 'Al', 'Ca', 'K', 'Cu', 'Mg'].includes(el)) return 0.48;
  if (['Cl', 'P', 'S'].includes(el)) return 0.44;
  return 0.38;
}

/* ------------------------------------------------------------------ ficha técnica */

export const balancingModelSpec: ModelSpec = {
  name: 'Balanceo de ecuaciones químicas por conteo de átomos y método algebraico (ley de Lavoisier)',
  inputs: [
    { symbol: 'reacción', name: 'Ecuación química (12, en tres niveles de dificultad)', unit: '—', initial: 'Síntesis del agua' },
    { symbol: 'νᵢ', name: 'Coeficiente estequiométrico de cada sustancia (entero)', unit: '—', range: [1, 12], initial: 1 },
  ],
  outputs: [
    { symbol: 'N_R(E), N_P(E)', name: 'Átomos de cada elemento en los reactivos y en los productos', unit: 'átomos' },
    { symbol: 'Σ|ΔN|', name: 'Átomos desbalanceados (suma sobre los elementos)', unit: 'átomos' },
    { symbol: 'm_R, m_P', name: 'Masa de reactivos y de productos, Σ ν·M (coeficientes leídos como moles)', unit: 'g' },
    { symbol: 'Δm', name: 'Diferencia de masa m_P − m_R', unit: 'g' },
    { symbol: 'mcd(ν)', name: 'Máximo común divisor de los coeficientes', unit: '—' },
    { symbol: 'dim N(A)', name: 'Dimensión del espacio nulo de la matriz de composición (1 = solución única)', unit: '—' },
  ],
  equations: [
    'Conteo: N_R(E) = Σ_reactivos νᵢ·nᵢ(E);  N_P(E) = Σ_productos νⱼ·nⱼ(E).',
    'Balanceada ⇔ N_R(E) = N_P(E) para todo elemento E.',
    'Método algebraico: A·ν = 0, con A(E, i) = nᵢ(E) en reactivos y −nᵢ(E) en productos; se resuelve por Gauss-Jordan con fracciones exactas.',
    'Forma convencional: ν enteros positivos con mcd(ν₁, …, νₖ) = 1.',
    'Lavoisier: Σ_reactivos νᵢ·Mᵢ = Σ_productos νⱼ·Mⱼ, con M = Σ n(E)·A_r(E) (g/mol).',
    'Balanza de dos platos (representación): θ = 14°·tanh(3·|Δm|/m_mayor), mínimo 2° si no está balanceada.',
  ],
  initialConditions: [
    'Síntesis del agua con todos los coeficientes en 1: H₂ + O₂ → H₂O (2 átomos de O en los reactivos y 1 en los productos).',
    'Masas atómicas estándar abreviadas (CIAAW): H 1,008; C 12,011; O 15,999; Na 22,99; P 30,974; Cl 35,45; Ca 40,078; Fe 55,845; Al 26,982.',
  ],
  assumptions: [
    'Las fórmulas de reactivos y productos están dadas y son correctas: balancear solo cambia coeficientes, nunca subíndices.',
    'Los coeficientes son enteros entre 1 y 12; ninguna sustancia puede desaparecer de la ecuación (coeficiente 0).',
    'Al leer los coeficientes como moles, la masa de cada lado es Σ ν·M; las masas se informan con resolución de 0,01 g.',
    'Los modelos de esferas y varillas son esquemas planos: las distancias y ángulos no son reales, y los colores siguen la convención CPK.',
    'Los compuestos iónicos (NaCl, NaOH, Fe₂O₃, Al₂O₃, Ca(OH)₂, Ca₃(PO₄)₂…) se dibujan como una unidad fórmula, con atracciones iónicas punteadas; los metales Fe y Al, como un átomo.',
    'La balanza de dos platos es un instrumento idealizado: su inclinación exagera las diferencias pequeñas (mínimo 2°) para que se vean.',
  ],
  limits: [
    'Una ecuación balanceada no garantiza que la reacción ocurra, ni dice su rapidez, su energía o su rendimiento.',
    'No se modelan reacciones redox con cargas ni ecuaciones iónicas: el balanceo es solo por átomos (la carga no se verifica).',
    'Si el espacio nulo tuviera dimensión mayor que 1 (varias reacciones independientes en la misma ecuación) no hay una única forma mínima; las 12 reacciones de la práctica tienen solución única.',
    'La respiración y la fotosíntesis se representan con la ecuación global: en la célula ocurren en decenas de pasos con enzimas.',
    'La conservación de la masa es exacta en las reacciones químicas; la variación por la energía liberada (E = mc²) es inmedible.',
  ],
  testCases: [
    'Analizador: H₂O, Ca(OH)₂, Ca₃(PO₄)₂, K₄[Fe(CN)₆] y el hidrato CuSO₄·5H₂O; errores con elementos desconocidos, paréntesis desbalanceados y fórmulas vacías.',
    'Conteo por lados de la síntesis del agua con coeficientes 1 y con 2, 1, 2.',
    'El solucionador (espacio nulo exacto) da la respuesta esperada de las 12 reacciones con dimensión 1 (solución única).',
    'mcd = 1 en las respuestas; 4, 2, 4 está balanceada pero no es mínima (mcd 2).',
    'Masa de reactivos = masa de productos en toda ecuación balanceada; con coeficientes 1, Δm = −15,999 g en la síntesis del agua.',
    'La pista señala el elemento más desbalanceado y la balanza se inclina hacia el lado más pesado.',
    'Cada dibujo de esferas y varillas tiene exactamente los átomos de su fórmula.',
    'Validación de coeficientes (enteros entre 1 y 12).',
  ],
};

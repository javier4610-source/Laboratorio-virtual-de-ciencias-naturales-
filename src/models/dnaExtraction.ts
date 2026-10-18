import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Extracción casera de ADN de frutas y modelo de complementariedad de la doble hebra (grado 8.º).
 *
 * PARTE 1. Extracción (modelo SEMICUANTITATIVO, calculado; no reproduce mediciones reales).
 *   Pasos: machacar la fruta con un tampón de lisis (agua + detergente + sal), filtrar, agregar alcohol frío
 *   por la pared del tubo y enrollar con una varilla el ADN que precipita en la interfase.
 *   El modelo calcula un ÍNDICE DE RENDIMIENTO RELATIVO (0 a 100 unidades arbitrarias, u.a.) como producto de
 *   factores adimensionales entre 0 y 1, cada uno asociado a un paso:
 *     Y = 100 · k_fruta · f_det · f_mach · f_sal · f_alc
 *     f_det  = 0,05 + 0,95 · D/(D + K_D)                         lisis de membranas por el detergente (saturable)
 *     f_mach = (1 − e^(−t/τ_fruta)) · e^(−t/T_corte)              rotura de tejidos y paredes; el exceso fragmenta el ADN
 *     f_sal  = 0,10 + 0,90 · S/(S + K_S)                         Na⁺ neutraliza los fosfatos y el ADN se agrega
 *     f_alc  = 0,35 + 0,65 / (1 + e^((T − T₀)/ΔT))               el ADN es menos soluble en alcohol frío
 *   Las constantes son SUPUESTOS DIDÁCTICOS elegidos para reproducir tendencias cualitativas conocidas
 *   (más detergente y sal ayudan hasta saturarse; el alcohol frío precipita más; machacar demasiado fragmenta).
 *   No son parámetros medidos ni ajustados a datos experimentales.
 *
 * PARTE 2. Complementariedad (reglas exactas de apareamiento de Watson y Crick).
 *   A se aparea con T mediante 2 puentes de hidrógeno y G con C mediante 3. Las hebras son antiparalelas:
 *   si la hebra molde se escribe 5'→3' de izquierda a derecha, la complementaria queda 3'→5' debajo.
 *   %GC = 100·(G + C)/N. Regla de Wallace: Tm ≈ 2·(A + T) + 4·(G + C) °C, contando las bases de UNA hebra;
 *   es una estimación empírica válida solo para oligonucleótidos cortos (menos de 14 nucleótidos).
 *   Reglas de Chargaff en la doble hebra: A = T y G = C (en una sola hebra no tienen por qué cumplirse).
 */

/* ================================================================== PARTE 1: extracción */

export type FruitId = 'fresa' | 'banano' | 'cebolla';

export interface Fruit {
  id: FruitId;
  name: string;
  /** Factor relativo de ADN recuperable por gramo de tejido (supuesto didáctico; fresa = 1). */
  k: number;
  /** Constante de tiempo del machacado (min): tejidos más firmes necesitan más tiempo (supuesto). */
  tau: number;
  /** Color del puré (dibujo). */
  color: string;
}

/**
 * Frutas y hortalizas disponibles en los laboratorios escolares de Urabá. Los factores son SUPUESTOS del modelo
 * (orden cualitativo frecuente en guías escolares: la fresa madura es blanda y suele dar mucho precipitado; la cebolla
 * es más firme y acuosa). No son mediciones.
 */
export const FRUITS: Fruit[] = [
  { id: 'fresa', name: 'Fresa', k: 1, tau: 0.5, color: '#c8323c' },
  { id: 'banano', name: 'Banano', k: 0.6, tau: 0.8, color: '#e8d98a' },
  { id: 'cebolla', name: 'Cebolla', k: 0.45, tau: 1.5, color: '#e9e2cf' },
];

export function findFruit(id: string): Fruit {
  const f = FRUITS.find((x) => x.id === id);
  if (!f) throw new Error(`Fruta desconocida: ${id}`);
  return f;
}

/** Rangos de las entradas: sal (g en 100 mL de tampón), detergente (mL en 100 mL), alcohol (°C), machacado (min). */
export const EXTRACTION_LIMITS = {
  salt: [0, 5] as [number, number],
  detergent: [0, 20] as [number, number],
  ethanolT: [-18, 30] as [number, number],
  mash: [0, 5] as [number, number],
};

/** Constantes del modelo (supuestos didácticos, ver encabezado). */
export const EXTRACTION_CONST = {
  /** mL de detergente en 100 mL de tampón que dan la mitad de la lisis posible. */
  KD: 2,
  /** g de sal en 100 mL de tampón que dan la mitad del efecto de la sal. */
  KS: 0.5,
  /** Tiempo característico de fragmentación del ADN por machacado excesivo (min). */
  Tshear: 10,
  /** Temperatura media (°C) y anchura (°C) de la transición de solubilidad en el alcohol. */
  T0: 10,
  dT: 6,
  /** Resolución con la que se lee el índice (escala visual de referencia). */
  resolution: 1,
};

export interface ExtractionInput {
  fruit: FruitId;
  /** Sal de cocina (NaCl) disuelta en 100 mL de tampón, g. */
  salt: number;
  /** Detergente lavaloza en 100 mL de tampón, mL. */
  detergent: number;
  /** Temperatura del alcohol que se agrega, °C. */
  ethanolT: number;
  /** Tiempo de machacado de la fruta en la bolsa, min. */
  mash: number;
}

/** Lisis de membranas por el detergente (fracción 0,05 a 1). Sin detergente casi no se liberan los núcleos. */
export function detergentFactor(detergentMl: number): number {
  assertInRange('El detergente', detergentMl, ...EXTRACTION_LIMITS.detergent);
  return 0.05 + (0.95 * detergentMl) / (detergentMl + EXTRACTION_CONST.KD);
}

/** Machacado: rompe tejidos y paredes celulares (1 − e^(−t/τ)), pero el exceso fragmenta el ADN (e^(−t/T_corte)). */
export function mashFactor(minutes: number, tau: number): number {
  assertInRange('El tiempo de machacado', minutes, ...EXTRACTION_LIMITS.mash);
  if (!(tau > 0)) throw new RangeError('La constante de tiempo del machacado debe ser positiva.');
  return (1 - Math.exp(-minutes / tau)) * Math.exp(-minutes / EXTRACTION_CONST.Tshear);
}

/** Sal: los iones Na⁺ neutralizan las cargas negativas de los fosfatos y el ADN se agrega (fracción 0,10 a 1). */
export function saltFactor(saltG: number): number {
  assertInRange('La sal', saltG, ...EXTRACTION_LIMITS.salt);
  return 0.1 + (0.9 * saltG) / (saltG + EXTRACTION_CONST.KS);
}

/** Alcohol: el ADN es menos soluble cuanto más frío está el alcohol (fracción 0,35 a 1, transición logística). */
export function ethanolFactor(tempC: number): number {
  assertInRange('La temperatura del alcohol', tempC, ...EXTRACTION_LIMITS.ethanolT);
  return 0.35 + 0.65 / (1 + Math.exp((tempC - EXTRACTION_CONST.T0) / EXTRACTION_CONST.dT));
}

export type FactorKey = 'fruta' | 'detergente' | 'machacado' | 'sal' | 'alcohol';

export const FACTOR_LABEL: Record<FactorKey, string> = {
  fruta: 'tipo de fruta',
  detergente: 'detergente (lisis de membranas)',
  machacado: 'machacado',
  sal: 'sal (neutralización de los fosfatos)',
  alcohol: 'temperatura del alcohol',
};

export interface ExtractionResult {
  fruit: Fruit;
  factors: Record<FactorKey, number>;
  /** Índice de rendimiento relativo, u.a. (0 a 100; 100 = fresa en condiciones ideales del modelo). */
  yieldIndex: number;
  /** Paso que más limita el resultado (factor más pequeño, sin contar la fruta). */
  limiting: Exclude<FactorKey, 'fruta'>;
  /** Descripción cualitativa del precipitado esperada según el índice. */
  appearance: string;
  /** Avisos de condiciones que el modelo no representa bien. */
  warnings: string[];
}

/** Aspecto esperado del precipitado según el índice (umbrales del modelo, didácticos). */
export function appearanceOf(index: number): string {
  if (index < 5) return 'Casi no se observa precipitado';
  if (index < 20) return 'Pocas fibras blancas sueltas, difíciles de enrollar';
  if (index < 50) return 'Hebras blancas que se enrollan en la varilla';
  return 'Ovillo abundante de hebras blancas';
}

export function simulateExtraction(input: ExtractionInput): ExtractionResult {
  const fruit = findFruit(input.fruit);
  const factors: Record<FactorKey, number> = {
    fruta: fruit.k,
    detergente: detergentFactor(input.detergent),
    machacado: mashFactor(input.mash, fruit.tau),
    sal: saltFactor(input.salt),
    alcohol: ethanolFactor(input.ethanolT),
  };
  const yieldIndex = 100 * factors.fruta * factors.detergente * factors.machacado * factors.sal * factors.alcohol;
  const steps: Exclude<FactorKey, 'fruta'>[] = ['detergente', 'machacado', 'sal', 'alcohol'];
  const limiting = steps.reduce((a, b) => (factors[b] < factors[a] ? b : a));
  const warnings: string[] = [];
  if (input.detergent > 12) warnings.push('Con tanto detergente se forma mucha espuma que puede pasar al tubo y confundirse con el ADN (el modelo no la representa).');
  if (input.salt > 3) warnings.push('La sal en exceso puede precipitar junto con el ADN y enturbiar la interfase (el modelo no lo representa).');
  if (input.ethanolT > 20) warnings.push('El alcohol a temperatura ambiente precipita menos ADN; en la práctica se enfría en la nevera o en hielo.');
  if (input.mash === 0) warnings.push('Sin machacar, las paredes celulares quedan casi enteras y el tampón apenas llega a las células.');
  return { fruit, factors, yieldIndex, limiting, appearance: appearanceOf(yieldIndex), warnings };
}

/** Lectura del índice con la escala visual de referencia (resolución 1 u.a.). Sin −0. */
export function yieldReading(index: number): number {
  const v = roundToResolution(Math.max(0, index), EXTRACTION_CONST.resolution);
  return Object.is(v, -0) ? 0 : v;
}

/* ================================================================== PARTE 2: complementariedad */

export type Base = 'A' | 'T' | 'G' | 'C';
export const BASES: Base[] = ['A', 'T', 'G', 'C'];
export const BASE_NAME: Record<Base, string> = { A: 'adenina', T: 'timina', G: 'guanina', C: 'citosina' };

/** Longitud máxima de la hebra molde en el laboratorio y límite de validez de la regla de Wallace. */
export const MAX_STRAND = 20;
export const MIN_STRAND = 4;
export const WALLACE_MAX_VALID = 13;

/** Limpia y valida una secuencia de ADN (solo A, T, G, C; de 4 a 20 nucleótidos). */
export function normalizeSequence(raw: string): Base[] {
  const s = raw.toUpperCase().replace(/[\s\-–5'′’3]/g, '');
  if (!/^[ATGC]*$/.test(s)) throw new RangeError('La secuencia solo puede tener las letras A, T, G y C.');
  if (s.length < MIN_STRAND || s.length > MAX_STRAND) throw new RangeError(`La secuencia debe tener entre ${MIN_STRAND} y ${MAX_STRAND} nucleótidos (tiene ${s.length}).`);
  return s.split('') as Base[];
}

const PAIR: Record<Base, Base> = { A: 'T', T: 'A', G: 'C', C: 'G' };

export const complementBase = (b: Base): Base => PAIR[b];

/** Hebra complementaria escrita posición por posición bajo la molde (queda en sentido 3'→5'). */
export const complementStrand = (seq: Base[]): Base[] => seq.map(complementBase);

/** Complementaria inversa: la hebra complementaria leída en sentido 5'→3'. */
export const reverseComplement = (seq: Base[]): Base[] => complementStrand(seq).reverse();

/** Puentes de hidrógeno de un par: A–T 2, G–C 3; 0 si las bases no son complementarias. */
export function hydrogenBonds(a: Base, b: Base): number {
  if (PAIR[a] !== b) return 0;
  return a === 'A' || a === 'T' ? 2 : 3;
}

export function baseCounts(seq: Base[]): Record<Base, number> {
  const c: Record<Base, number> = { A: 0, T: 0, G: 0, C: 0 };
  for (const b of seq) c[b]++;
  return c;
}

/** Porcentaje de G + C de una secuencia. */
export function gcPercent(seq: Base[]): number {
  if (seq.length === 0) throw new RangeError('La secuencia está vacía.');
  const c = baseCounts(seq);
  return (100 * (c.G + c.C)) / seq.length;
}

/** Regla de Wallace: Tm ≈ 2·(A + T) + 4·(G + C) °C con las bases de una hebra. `valid` = menos de 14 nucleótidos. */
export function wallaceTm(seq: Base[]): { tm: number; valid: boolean } {
  if (seq.length === 0) throw new RangeError('La secuencia está vacía.');
  const c = baseCounts(seq);
  return { tm: 2 * (c.A + c.T) + 4 * (c.G + c.C), valid: seq.length <= WALLACE_MAX_VALID };
}

export interface ChargaffResult {
  /** Conteos en la doble hebra (las dos hebras juntas). */
  counts: Record<Base, number>;
  /** A/T y G/C en la doble hebra (1 si se cumplen las reglas de Chargaff). */
  ratioAT: number;
  ratioGC: number;
  /** A/T y G/C en la hebra molde sola (en general distintos de 1). */
  singleAT: number;
  singleGC: number;
  /** (A + G)/(T + C) en la doble hebra: purinas/pirimidinas = 1. */
  purinePyrimidine: number;
}

const ratio = (a: number, b: number) => (b === 0 ? (a === 0 ? 1 : Infinity) : a / b);

/** Reglas de Chargaff en la doble hebra formada por la molde y otra hebra (misma longitud). */
export function chargaff(top: Base[], bottom: Base[]): ChargaffResult {
  if (top.length !== bottom.length) throw new RangeError('Las dos hebras deben tener la misma longitud.');
  const t = baseCounts(top), b = baseCounts(bottom);
  const counts: Record<Base, number> = { A: t.A + b.A, T: t.T + b.T, G: t.G + b.G, C: t.C + b.C };
  return {
    counts,
    ratioAT: ratio(counts.A, counts.T),
    ratioGC: ratio(counts.G, counts.C),
    singleAT: ratio(t.A, t.T),
    singleGC: ratio(t.G, t.C),
    purinePyrimidine: ratio(counts.A + counts.G, counts.T + counts.C),
  };
}

export type Orientation = 'antiparalela' | 'paralela';
export type SlotStatus = 'vacio' | 'correcto' | 'error';

export interface DuplexCheck {
  n: number;
  status: SlotStatus[];
  correct: number;
  mismatches: number;
  empty: number;
  complete: boolean;
  antiparallel: boolean;
  /** Doble hebra completa, sin errores de apareamiento y antiparalela. */
  valid: boolean;
  /** Puentes de hidrógeno de los pares correctos. */
  hBonds: number;
  /** %GC de la hebra molde (igual al de la doble hebra cuando es válida). */
  gc: number;
  /** Tm de Wallace (solo si la doble hebra es válida) y si la longitud está en el rango de validez. */
  tm: number | null;
  tmInRange: boolean;
  chargaff: ChargaffResult | null;
  /** Hebra nueva leída 5'→3' (las posiciones vacías como «·»). */
  newStrand53: string;
}

/**
 * Comprueba una doble hebra construida por el estudiante. `built[i]` es la base colocada bajo la base i de la molde
 * (molde 5'→3' de izquierda a derecha). Con orientación antiparalela la hebra nueva va 3'→5' de izquierda a derecha.
 */
export function checkDuplex(template: Base[], built: (Base | null)[], orientation: Orientation): DuplexCheck {
  if (template.length < MIN_STRAND || template.length > MAX_STRAND) throw new RangeError('Longitud de la hebra molde fuera de rango.');
  if (built.length !== template.length) throw new RangeError('La hebra nueva debe tener tantos espacios como la molde.');
  const status: SlotStatus[] = template.map((b, i) => (built[i] === null ? 'vacio' : PAIR[b] === built[i] ? 'correcto' : 'error'));
  const correct = status.filter((s) => s === 'correcto').length;
  const mismatches = status.filter((s) => s === 'error').length;
  const empty = status.filter((s) => s === 'vacio').length;
  const complete = empty === 0;
  const antiparallel = orientation === 'antiparalela';
  const valid = complete && mismatches === 0 && antiparallel;
  const hBonds = template.reduce((acc, b, i) => (status[i] === 'correcto' ? acc + hydrogenBonds(b, built[i] as Base) : acc), 0);
  const w = wallaceTm(template);
  const chars = built.map((b) => b ?? '·');
  const newStrand53 = (antiparallel ? [...chars].reverse() : chars).join('');
  return {
    n: template.length, status, correct, mismatches, empty, complete, antiparallel, valid, hBonds,
    gc: gcPercent(template), tm: valid ? w.tm : null, tmInRange: w.valid,
    chargaff: complete && mismatches === 0 ? chargaff(template, built as Base[]) : null,
    newStrand53,
  };
}

/* ================================================================== instrumentos y ficha del modelo */

/** Ficha del «instrumento» (misma forma que src/labs/instruments.ts), usada como respaldo por useMeasure. */
export const DNA_EXTRACTION_INSTRUMENTS = [
  {
    id: 'escala', name: 'Escala visual de referencia del precipitado (1 u.a.)', quantity: 'Índice de rendimiento relativo del ADN enrollado', unit: 'u.a.',
    resolution: EXTRACTION_CONST.resolution, sigma: 2, relSigma: 0.15, nonNegative: true,
    note: 'Ilustrativo: variabilidad entre frutas (madurez, variedad), pérdidas al filtrar y apreciación visual del ovillo.',
  },
];

export const dnaExtractionModelSpec: ModelSpec = {
  name: 'Extracción casera de ADN (modelo semicuantitativo de factores) y complementariedad de la doble hebra (Watson y Crick, Chargaff, regla de Wallace)',
  inputs: [
    { symbol: 'fruta', name: 'Material vegetal: fresa, banano o cebolla', unit: '—', initial: 'fresa' },
    { symbol: 'S', name: 'Sal de cocina en 100 mL de tampón', unit: 'g', range: EXTRACTION_LIMITS.salt, initial: 1.5 },
    { symbol: 'D', name: 'Detergente lavaloza en 100 mL de tampón', unit: 'mL', range: EXTRACTION_LIMITS.detergent, initial: 10 },
    { symbol: 'T', name: 'Temperatura del alcohol agregado', unit: '°C', range: EXTRACTION_LIMITS.ethanolT, initial: 4 },
    { symbol: 't', name: 'Tiempo de machacado', unit: 'min', range: EXTRACTION_LIMITS.mash, initial: 2 },
    { symbol: 'molde', name: 'Hebra molde de ADN (5\'→3\'), de 4 a 20 nucleótidos', unit: '—', initial: 'GATTACAGGA' },
    { symbol: 'orientación', name: 'Orientación de la hebra nueva (antiparalela o paralela)', unit: '—', initial: 'antiparalela' },
  ],
  outputs: [
    { symbol: 'Y', name: 'Índice de rendimiento relativo de la extracción (modelo calculado, no una masa medida)', unit: 'u.a.' },
    { symbol: 'aspecto', name: 'Aspecto esperado del precipitado', unit: '—' },
    { symbol: 'n_H', name: 'Puentes de hidrógeno de la doble hebra', unit: '—' },
    { symbol: '%GC', name: 'Porcentaje de guanina + citosina', unit: '%' },
    { symbol: 'Tm', name: 'Temperatura de fusión estimada con la regla de Wallace', unit: '°C' },
    { symbol: 'A/T, G/C', name: 'Razones de Chargaff en la doble hebra y en una sola hebra', unit: '—' },
  ],
  equations: [
    'Y = 100 · k_fruta · f_det · f_mach · f_sal · f_alc   (índice relativo, u.a.)',
    'f_det = 0,05 + 0,95 · D/(D + 2 mL)',
    'f_mach = (1 − e^(−t/τ_fruta)) · e^(−t/10 min)',
    'f_sal = 0,10 + 0,90 · S/(S + 0,5 g)',
    'f_alc = 0,35 + 0,65 / (1 + e^((T − 10 °C)/6 °C))',
    'Apareamiento: A–T (2 puentes de hidrógeno), G–C (3 puentes de hidrógeno); hebras antiparalelas 5\'→3\' / 3\'→5\'',
    '%GC = 100 · (G + C) / N',
    'Regla de Wallace: Tm ≈ 2·(A + T) + 4·(G + C) °C   (bases de una hebra; válida para N < 14)',
    'Chargaff en la doble hebra: A = T, G = C, (A + G)/(T + C) = 1',
  ],
  initialConditions: [
    'Fresa madura en una bolsa resellable con 100 mL de tampón: agua, 1,5 g de sal de cocina y 10 mL de detergente lavaloza.',
    'Machacado de 2 min; filtrado con un filtro de café o un paño limpio; alcohol antiséptico frío (4 °C, nevera) agregado por la pared del tubo en volumen parecido al del filtrado.',
    'Hebra molde de 10 nucleótidos 5\'-GATTACAGGA-3\' y hebra nueva vacía, con orientación antiparalela.',
  ],
  assumptions: [
    'El índice de rendimiento es un MODELO CALCULADO semicuantitativo: un producto de factores entre 0 y 1 cuyas constantes (K_D = 2 mL, K_S = 0,5 g, T_corte = 10 min, T₀ = 10 °C, ΔT = 6 °C) son supuestos didácticos elegidos para reproducir tendencias cualitativas, no valores medidos ni ajustados a datos.',
    'Los factores de cada fruta (fresa 1; banano 0,6; cebolla 0,45) y sus tiempos de machacado (0,5; 0,8 y 1,5 min) son supuestos que representan un orden cualitativo frecuente en guías escolares (tejido blando y maduro frente a tejido firme), no rendimientos reales.',
    'Cada paso actúa de forma independiente (factores multiplicativos): el detergente disuelve las membranas, el machacado rompe tejidos y paredes, la sal aporta Na⁺ que neutraliza los fosfatos, y el alcohol frío disminuye la solubilidad del ADN.',
    'El volumen de alcohol es parecido al del filtrado y su concentración es la del alcohol antiséptico casero (70 % o más); se agrega despacio por la pared para que forme una capa.',
    'En el modelo de complementariedad, la doble hebra se dibuja como una escalera plana; solo se aceptan los pares A–T y G–C (no se consideran pares raros ni bases modificadas).',
    'La regla de Wallace usa solo la composición de la hebra; no tiene en cuenta el orden de las bases, la concentración de sal ni la de ADN.',
  ],
  limits: [
    'El índice no es una masa ni una concentración de ADN: no debe compararse con rendimientos de laboratorio. El precipitado casero contiene además ARN, proteínas y polisacáridos (por ejemplo, pectinas de la fruta).',
    'El modelo no representa la espuma por exceso de detergente, la sal que precipita en exceso, la madurez de la fruta ni el tiempo de espera antes de enrollar; la variabilidad real entre ensayos es grande.',
    'La regla de Wallace es una aproximación empírica para oligonucleótidos de menos de 14 nucleótidos; para hebras más largas subestima o sobreestima la Tm y se usan modelos de vecinos más cercanos, que no se incluyen aquí.',
    'Las reglas de Chargaff (A = T, G = C) valen para ADN de doble hebra; no se cumplen necesariamente en una sola hebra ni en virus de ADN de una hebra.',
    'La doble hebra real es una hélice dextrógira con surcos mayor y menor; el dibujo en escalera es una ilustración educativa.',
  ],
  testCases: [
    'Valores a mano: f_det(10 mL) = 0,05 + 0,95·10/12 ≈ 0,8417; f_sal(1,5 g) = 0,10 + 0,90·1,5/2 = 0,775; f_alc(10 °C) = 0,675.',
    'Más sal, más detergente y alcohol más frío nunca disminuyen el índice; el machacado tiene un máximo (fragmenta el ADN si se excede).',
    'Sin sal y con alcohol tibio el índice cae por debajo del umbral de «hebras que se enrollan».',
    'Regla de Wallace calculada a mano: GATTACAGGA → 2·6 + 4·4 = 28 °C; GCCGTAGCGGCA → 2·3 + 4·9 = 42 °C.',
    'Complementaria inversa de 5\'-GATTACAGGA-3\' = 5\'-TCCTGTAATC-3\'; la complementaria de la complementaria es la molde.',
    'Chargaff: en la doble hebra válida A/T = G/C = 1 para cualquier molde; en la molde sola GATTACAGGA da A/T = 2 y G/C = 3.',
    'Puentes de hidrógeno: 2 por cada par A–T y 3 por cada G–C; un error de apareamiento aporta 0 y anula la Tm.',
    'Una doble hebra paralela no es válida aunque las bases sean complementarias.',
    'Las entradas fuera de rango y las secuencias con letras distintas de A, T, G y C se rechazan.',
  ],
};

import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Descomposición de la materia orgánica (grado 7.º): bolsas de malla (litterbags)
 * enterradas en la compostera escolar.
 *   Modelo exponencial de Olson (1963): M(t) = M0·e^(−k·t)
 *   k = k_ref(material) · f_T · f_humedad · f_oxígeno · f_tamaño   (k en 1/semana)
 * Los valores de k_ref son ILUSTRATIVOS (del orden de los reportados para residuos
 * tropicales), no mediciones de un sitio concreto.
 */

export const INITIAL_MASS = 50; // g de peso seco por bolsa
export const BALANCE_RES = 0.1; // g, balanza digital del kit
export const PILE_THERMO_RES = 1; // °C, termómetro de compost del kit
export const Q10 = 2;
export const T_REF = 25; // °C
/** Por encima de esta temperatura los microorganismos empiezan a inhibirse. */
export const T_INHIBITION = 40; // °C
export const CHOPPED_FACTOR = 1.5;
export const NO_AIR_FACTOR = 0.5;
/** k de referencia de la mezcla de la pila (para estimar su calentamiento). */
export const PILE_K_REF = 0.1; // 1/semana

export const DECOMP_LIMITS = {
  weeks: [0, 12] as [number, number],
  temperature: [5, 45] as [number, number],
  moisture: [10, 90] as [number, number],
  initialMass: [1, 1000] as [number, number],
};

export const DECOMP_DEFAULTS = { materialId: 'banano', weeks: 4, temperature: 25, moisture: 55, aerated: true, chopped: false };

export interface DecompMaterial {
  id: string;
  name: string;
  /** k a 25 °C, humedad óptima, con aireación y en trozos enteros (1/semana). Ilustrativo. */
  kRef: number;
  /** Color del material fresco (para la ilustración). */
  color: string;
  note: string;
}

export const DECOMP_MATERIALS: DecompMaterial[] = [
  { id: 'banano', name: 'Cáscara de banano', kRef: 0.15, color: '#e0c03c', note: 'Rica en agua, azúcares y nitrógeno: alimento fácil para hongos y bacterias.' },
  { id: 'hojas', name: 'Hojas secas', kRef: 0.06, color: '#b07a35', note: 'Contienen celulosa y algo de lignina; se descomponen a ritmo medio.' },
  { id: 'papel', name: 'Papel', kRef: 0.05, color: '#ece6d6', note: 'Casi pura celulosa, pero pobre en nitrógeno.' },
  { id: 'aserrin', name: 'Aserrín', kRef: 0.015, color: '#d6b277', note: 'Mucha lignina, difícil de romper para la mayoría de microorganismos.' },
  { id: 'plastico', name: 'Plástico (control)', kRef: 0, color: '#3d8fd1', note: 'Polímero sintético: los descomponedores del suelo no lo degradan en semanas.' },
];

export function findDecompMaterial(id: string): DecompMaterial {
  const m = DECOMP_MATERIALS.find((x) => x.id === id);
  if (!m) throw new Error(`Material desconocido: ${id}`);
  return m;
}

/** Factor de temperatura: Q10 = 2 respecto a 25 °C; por encima de 40 °C cae linealmente (inhibición microbiana). */
export function temperatureFactor(temperature: number): number {
  assertInRange('La temperatura', temperature, ...DECOMP_LIMITS.temperature);
  const q = Q10 ** ((temperature - T_REF) / 10);
  const inhibition = temperature <= T_INHIBITION ? 1 : Math.max(0, 1 - (temperature - T_INHIBITION) / 10);
  return q * inhibition;
}

/** Factor de humedad: 1 entre 50 % y 60 %; cae en seco (falta agua) y en saturación (falta oxígeno). */
export function moistureFactor(moisture: number): number {
  assertInRange('La humedad', moisture, ...DECOMP_LIMITS.moisture);
  if (moisture < 50) return Math.exp(-(((moisture - 50) / 22) ** 2));
  if (moisture > 60) return Math.exp(-(((moisture - 60) / 18) ** 2));
  return 1;
}

export const oxygenFactor = (aerated: boolean) => (aerated ? 1 : NO_AIR_FACTOR);
export const sizeFactor = (chopped: boolean) => (chopped ? CHOPPED_FACTOR : 1);

export interface DecompInput {
  materialId: string;
  weeks: number;
  temperature: number; // °C
  moisture: number; // % de humedad del material
  aerated: boolean; // volteo semanal
  chopped: boolean; // trozos picados
  initialMass?: number; // g (50 g por defecto)
}

/** Constante de descomposición k (1/semana). */
export function decayConstant(input: Omit<DecompInput, 'weeks' | 'initialMass'>): number {
  const m = findDecompMaterial(input.materialId);
  return m.kRef * temperatureFactor(input.temperature) * moistureFactor(input.moisture) * oxygenFactor(input.aerated) * sizeFactor(input.chopped);
}

/** Masa restante exacta según el modelo (g). Nunca negativa. */
export function remainingMass(m0: number, k: number, weeks: number): number {
  return Math.max(0, m0 * Math.exp(-k * weeks));
}

/** Vida media ln2/k (semanas); null si el material no se descompone. */
export function halfLife(k: number): number | null {
  return k > 0 ? Math.LN2 / k : null;
}

export interface DecompObservations {
  fungi: 'no visibles' | 'pocos' | 'abundantes';
  smell: string;
  anaerobic: boolean;
  worms: boolean;
  /** Temperatura en el centro de la pila (lectura del termómetro, °C). */
  pileTemperature: number;
}

export interface DecompResult {
  material: DecompMaterial;
  k: number;
  halfLife: number | null;
  trueMass: number; // g, valor del modelo
  massReading: number; // g, lectura de la balanza (0,1 g)
  lossPercent: number; // % calculado con la lectura
  observations: DecompObservations;
}

/** Temperatura de la pila: ambiente + calentamiento por actividad microbiana (ilustrativo, máx. 20 °C). */
export function pileTemperature(input: Omit<DecompInput, 'materialId' | 'initialMass' | 'chopped'>): number {
  const kPile = PILE_K_REF * temperatureFactor(input.temperature) * moistureFactor(input.moisture) * oxygenFactor(input.aerated);
  const heating = Math.min(20, 60 * kPile * Math.exp(-kPile * input.weeks));
  return input.temperature + heating;
}

export function simulateDecomposition(input: DecompInput): DecompResult {
  assertInRange('La semana de muestreo', input.weeks, ...DECOMP_LIMITS.weeks);
  const m0 = input.initialMass ?? INITIAL_MASS;
  assertInRange('La masa inicial', m0, ...DECOMP_LIMITS.initialMass);
  const material = findDecompMaterial(input.materialId);
  const k = decayConstant(input);
  const trueMass = remainingMass(m0, k, input.weeks);
  const massReading = roundToResolution(trueMass, BALANCE_RES);
  const lossPercent = ((m0 - massReading) / m0) * 100;
  const organic = material.kRef > 0;
  const anaerobic = organic && (!input.aerated || input.moisture >= 80);
  let fungi: DecompObservations['fungi'] = 'no visibles';
  if (organic && input.moisture >= 25 && input.temperature <= 42) {
    if (lossPercent >= 15 && input.moisture >= 40) fungi = 'abundantes';
    else if (lossPercent >= 5) fungi = 'pocos';
  }
  const smell = !organic || lossPercent < 3
    ? 'Sin olor apreciable'
    : anaerobic ? 'Agrio o a podrido (fermentación sin oxígeno)' : 'A tierra húmeda de bosque';
  const worms = organic && input.weeks >= 2 && input.moisture >= 35 && input.moisture <= 80
    && input.temperature >= 12 && input.temperature <= 32 && !(anaerobic && input.moisture >= 70);
  return {
    material, k, halfLife: halfLife(k), trueMass, massReading,
    lossPercent: roundToResolution(lossPercent, 0.01),
    observations: {
      fungi, smell, anaerobic, worms,
      pileTemperature: roundToResolution(pileTemperature(input), PILE_THERMO_RES),
    },
  };
}

/** Curva M(t) semana a semana (para gráficas o comparaciones). */
export function massCurve(input: Omit<DecompInput, 'weeks'>, maxWeeks = 12): { week: number; mass: number }[] {
  const k = decayConstant(input);
  const m0 = input.initialMass ?? INITIAL_MASS;
  return Array.from({ length: maxWeeks + 1 }, (_, w) => ({ week: w, mass: remainingMass(m0, k, w) }));
}

export const decompositionModelSpec: ModelSpec = {
  name: 'Descomposición exponencial de primer orden (Olson) en bolsas de malla',
  inputs: [
    { symbol: 'material', name: 'Material de la bolsa', unit: '—', initial: 'cáscara de banano' },
    { symbol: 't', name: 'Semana de muestreo', unit: 'semanas', range: DECOMP_LIMITS.weeks, initial: 4 },
    { symbol: 'T', name: 'Temperatura de la compostera', unit: '°C', range: DECOMP_LIMITS.temperature, initial: 25 },
    { symbol: 'H', name: 'Humedad del material', unit: '%', range: DECOMP_LIMITS.moisture, initial: 55 },
    { symbol: 'aireación', name: 'Volteo semanal (oxígeno)', unit: 'sí/no', initial: 'sí' },
    { symbol: 'tamaño', name: 'Tamaño de los trozos', unit: '—', initial: 'enteros' },
    { symbol: 'M₀', name: 'Masa seca inicial', unit: 'g', initial: INITIAL_MASS },
  ],
  outputs: [
    { symbol: 'M', name: 'Masa restante (balanza, 0,1 g)', unit: 'g' },
    { symbol: '%P', name: 'Porcentaje de masa perdida', unit: '%' },
    { symbol: 'k', name: 'Constante de descomposición', unit: '1/semana' },
    { symbol: 't½', name: 'Vida media', unit: 'semanas' },
    { symbol: 'T_pila', name: 'Temperatura en la pila (termómetro, 1 °C)', unit: '°C' },
  ],
  equations: [
    'M(t) = M₀·e^(−k·t)',
    'k = k_ref · f_T · f_H · f_O₂ · f_tamaño',
    'f_T = 2^((T − 25)/10) (Q10 = 2); si T > 40 °C se multiplica por 1 − (T − 40)/10',
    'f_H = 1 entre 50 % y 60 %; e^(−((H − 50)/22)²) si H < 50; e^(−((H − 60)/18)²) si H > 60',
    'f_O₂ = 1 con volteo, 0,5 sin volteo;  f_tamaño = 1,5 si está picado, 1 si está entero',
    '%P = (M₀ − M)/M₀ · 100;  t½ = ln 2 / k',
  ],
  initialConditions: ['Bolsas de 50 g de peso seco de cada material, enterradas el mismo día en la compostera escolar; cáscara de banano, semana 4, 25 °C, 55 % de humedad, con volteo, trozos enteros.'],
  assumptions: [
    'La pérdida de masa sigue una cinética de primer orden: cada semana se pierde la misma fracción de lo que queda.',
    'Los factores ambientales actúan de forma multiplicativa e independiente y permanecen constantes durante el ensayo.',
    'Los valores de k_ref son ilustrativos (banano rápido, hojas y papel medios, aserrín lento por la lignina, plástico ≈ 0).',
    'La masa se mide en seco con una balanza de 0,1 g; el porcentaje de pérdida se calcula con esa lectura.',
    'Hongos, olor, lombrices y temperatura de la pila son observaciones cualitativas derivadas de reglas sencillas del modelo.',
  ],
  limits: [
    'No representa la fracción resistente que en la realidad hace que la curva se aplane (modelos de dos compartimentos).',
    'No incluye la pérdida de fragmentos por la malla, el aporte de raíces ni la variación diaria de temperatura y lluvia.',
    'El calentamiento de la pila es ilustrativo y no retroalimenta la velocidad de descomposición.',
    'Los valores numéricos no sustituyen mediciones locales; sirven para comparar tendencias.',
  ],
  testCases: [
    'La masa disminuye exponencialmente (cociente constante entre semanas) y nunca es negativa.',
    'El plástico conserva 50,0 g en todas las semanas.',
    'Con Q10 = 2, k a 35 °C es el doble que a 25 °C; por encima de 40 °C k disminuye.',
    'La humedad intermedia (50–60 %) da el mayor k; en seco y en saturación es menor.',
    'Sin volteo k se reduce a la mitad; picado lo multiplica por 1,5.',
    'A t = ln2/k queda la mitad de la masa.',
    'Las entradas fuera de rango lanzan un error.',
  ],
};

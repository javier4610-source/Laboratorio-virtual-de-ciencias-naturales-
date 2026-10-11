import { assertInRange, roundToResolution, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Selección natural sobre un rasgo cuantitativo (grado 9.º): color de escarabajos y depredación por aves.
 *   Rasgo z (0 = claro, 1 = oscuro) con distribución normal N(z̄, σ²).
 *   Supervivencia por contraste con el fondo B:  s(z) = 1 − p·(1 − exp(−(z − B)² / (2w²))).
 *   Diferencial de selección:  S = z̄ (sobrevivientes) − z̄ (antes de la selección).
 *   Ecuación del criador:      R = h²·S;  la descendencia es N(z̄ + R, σ²) (modelo infinitesimal).
 * Determinista: no hay azar en la evolución; el generador con semilla solo ubica los dibujos.
 */

export const SEL_LIMITS = {
  variation: [0.02, 0.2] as [number, number], // σ del color
  predation: [0, 90] as [number, number], // % de los escarabajos muy contrastados que cazan las aves
  heritability: [0, 1] as [number, number], // h²
  generations: [0, 200] as [number, number],
  trait: [0, 1] as [number, number],
};

/** Color medio inicial de la población (escarabajos más bien claros). */
export const INITIAL_MEAN = 0.3;
/** Ancho de la "ventana de camuflaje" (agudeza visual de las aves, valor ilustrativo): diferencia de color a la que el escarabajo ya es bastante visible. */
export const CONTRAST_WIDTH = 0.3;
/** Número de clases de color en que se discretiza la distribución. */
export const N_CLASSES = 201;
/** Resolución del colorímetro con que se mide el color medio. */
export const COLOR_RES = 0.001;
/** Resolución con que se informa la supervivencia (%). */
export const SURVIVAL_RES = 0.1;

export interface Background { id: string; name: string; short: string; }
export const BACKGROUNDS: Background[] = [
  { id: 'corteza', name: 'Corteza clara (B = 0,2)', short: 'Corteza clara' },
  { id: 'hojarasca', name: 'Hojarasca (B = 0,5)', short: 'Hojarasca' },
  { id: 'volcanico', name: 'Suelo volcánico oscuro (B = 0,8)', short: 'Suelo volcánico' },
  { id: 'hollin', name: 'Cambio ambiental: corteza que se oscurece por hollín', short: 'Corteza con hollín' },
];

/** El hollín oscurece la corteza 0,03 por generación, de 0,2 hasta 0,8 (generación 20 en adelante). */
export const SOOT = { start: 0.2, end: 0.8, perGeneration: 0.03 };

export function findBackground(id: string): Background {
  const b = BACKGROUNDS.find((x) => x.id === id);
  if (!b) throw new Error(`Fondo desconocido: ${id}`);
  return b;
}

/** Valor de color del fondo B durante la selección que ocurre en la generación `generation` (0, 1, 2…). */
export function backgroundValue(id: string, generation: number): number {
  findBackground(id);
  assertInRange('La generación', generation, 0, Number.MAX_SAFE_INTEGER);
  if (id === 'corteza') return 0.2;
  if (id === 'hojarasca') return 0.5;
  if (id === 'volcanico') return 0.8;
  return Math.min(SOOT.end, SOOT.start + SOOT.perGeneration * generation);
}

/** Probabilidad de sobrevivir a las aves para un escarabajo de color z sobre un fondo B. p entre 0 y 1. */
export function survival(z: number, B: number, p: number, w = CONTRAST_WIDTH): number {
  assertInRange('La intensidad de depredación', p, 0, 1);
  if (!(w > 0)) throw new RangeError('El ancho de contraste debe ser positivo.');
  const d = z - B;
  return 1 - p * (1 - Math.exp(-(d * d) / (2 * w * w)));
}

/** Distribución normal discretizada en N_CLASSES clases entre z̄ − 5σ y z̄ + 5σ (frecuencias que suman 1). */
export function discretize(mean: number, sd: number, classes = N_CLASSES): { z: number[]; f: number[] } {
  assertInRange('La desviación del color', sd, 1e-6, 1);
  const z: number[] = [], f: number[] = [];
  const lo = mean - 5 * sd, step = (10 * sd) / (classes - 1);
  let total = 0;
  for (let i = 0; i < classes; i++) {
    const zi = lo + i * step;
    const u = (zi - mean) / sd;
    const fi = Math.exp(-0.5 * u * u);
    z.push(zi); f.push(fi); total += fi;
  }
  return { z, f: f.map((v) => v / total) };
}

export interface SelectionStep {
  meanBefore: number;
  meanSurvivors: number;
  /** Diferencial de selección S. */
  S: number;
  /** Respuesta a la selección R = h²·S. */
  R: number;
  meanAfter: number;
  /** Fracción de la población que sobrevive (0 a 1). */
  survival: number;
}

/** Una generación: selección por las aves, diferencial S y respuesta R = h²·S. */
export function selectionStep(mean: number, sd: number, B: number, p: number, h2: number, w = CONTRAST_WIDTH): SelectionStep {
  assertInRange('La heredabilidad', h2, ...SEL_LIMITS.heritability);
  assertInRange('El fondo', B, ...SEL_LIMITS.trait);
  const { z, f } = discretize(mean, sd);
  let sBar = 0, zs = 0, zb = 0;
  for (let i = 0; i < z.length; i++) {
    const s = survival(z[i], B, p, w);
    sBar += f[i] * s;
    zs += f[i] * s * z[i];
    zb += f[i] * z[i];
  }
  const meanSurvivors = sBar > 0 ? zs / sBar : zb;
  const S = meanSurvivors - zb;
  const R = h2 * S;
  return { meanBefore: zb, meanSurvivors, S, R, meanAfter: mean + R, survival: sBar };
}

/** Resultado analítico (población normal continua) para comprobar la discretización. */
export function analyticSelection(mean: number, sd: number, B: number, p: number, w = CONTRAST_WIDTH): { S: number; survival: number } {
  const v = w * w + sd * sd;
  const A = (w / Math.sqrt(v)) * Math.exp(-((mean - B) ** 2) / (2 * v));
  const sBar = 1 - p + p * A;
  const S = sBar > 0 ? (p * A * sd * sd * (B - mean)) / (v * sBar) : 0;
  return { S, survival: sBar };
}

export interface SelectionInput {
  backgroundId: string;
  /** % (0–90). */
  predation: number;
  heritability: number;
  variation: number;
  generations: number;
  initialMean?: number;
}

export interface GenerationRecord {
  generation: number;
  mean: number;
  /** Fondo en el que vivió (y fue seleccionada) esta generación. */
  background: number;
  /** Datos de la selección que produjo esta generación (nulos en la generación 0). */
  S: number | null;
  R: number | null;
  survival: number | null;
}

export interface SelectionResult {
  history: GenerationRecord[];
  finalMean: number;
  /** Lectura del colorímetro (resolución 0,001). */
  finalMeanReading: number;
  change: number;
  changeReading: number;
  /** % de supervivencia de la última ronda de depredación (null si no se ha avanzado). */
  lastSurvivalPercent: number | null;
  lastS: number | null;
  lastR: number | null;
}

export function simulateSelection(input: SelectionInput): SelectionResult {
  assertInRange('La intensidad de depredación', input.predation, ...SEL_LIMITS.predation);
  assertInRange('La heredabilidad', input.heritability, ...SEL_LIMITS.heritability);
  assertInRange('La variación del color', input.variation, ...SEL_LIMITS.variation);
  assertInRange('El número de generaciones', input.generations, ...SEL_LIMITS.generations);
  if (!Number.isInteger(input.generations)) throw new RangeError('El número de generaciones debe ser entero.');
  const m0 = input.initialMean ?? INITIAL_MEAN;
  assertInRange('El color medio inicial', m0, ...SEL_LIMITS.trait);
  const p = input.predation / 100;
  let mean = m0;
  const history: GenerationRecord[] = [{ generation: 0, mean, background: backgroundValue(input.backgroundId, 0), S: null, R: null, survival: null }];
  for (let g = 0; g < input.generations; g++) {
    const B = backgroundValue(input.backgroundId, g);
    const st = selectionStep(mean, input.variation, B, p, input.heritability);
    mean = st.meanAfter;
    history.push({ generation: g + 1, mean, background: backgroundValue(input.backgroundId, g + 1), S: st.S, R: st.R, survival: st.survival });
  }
  const last = history[history.length - 1];
  return {
    history,
    finalMean: mean,
    finalMeanReading: roundToResolution(mean, COLOR_RES),
    change: mean - m0,
    changeReading: roundToResolution(mean - m0, COLOR_RES),
    lastSurvivalPercent: last.survival === null ? null : roundToResolution(last.survival * 100, SURVIVAL_RES),
    lastS: last.S,
    lastR: last.R,
  };
}

/** Fracción de la población en cada uno de `bins` intervalos iguales de [0, 1] (las colas se suman a los extremos). */
export function histogram(mean: number, sd: number, bins = 20): number[] {
  const { z, f } = discretize(mean, sd);
  const out = new Array<number>(bins).fill(0);
  for (let i = 0; i < z.length; i++) {
    const k = Math.min(bins - 1, Math.max(0, Math.floor(z[i] * bins)));
    out[k] += f[i];
  }
  return out;
}

/** Inversa de la distribución normal estándar (aproximación racional de Acklam, error < 1,2 × 10⁻⁹). */
export function normalQuantile(prob: number): number {
  assertInRange('La probabilidad', prob, 1e-12, 1 - 1e-12);
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (prob < pl) {
    const q = Math.sqrt(-2 * Math.log(prob));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (prob > 1 - pl) return -normalQuantile(1 - prob);
  const q = prob - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Muestra representativa de n escarabajos: cuantiles de la distribución actual, recortados a [0, 1]. */
export function beetleSample(mean: number, sd: number, n = 40): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.min(1, Math.max(0, mean + sd * normalQuantile((i + 0.5) / n))));
  return out;
}

/** Posiciones fijas (fracciones 0–1 del área de dibujo) y orientación de los escarabajos; solo para el dibujo. */
export function beetlePositions(n = 40, seed = 2024): { x: number; y: number; angle: number }[] {
  const rand = seededRandom(seed);
  const cols = 8, rows = Math.ceil(n / cols);
  const pos: { x: number; y: number; angle: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    pos.push({ x: (c + 0.2 + 0.6 * rand()) / cols, y: (r + 0.2 + 0.6 * rand()) / rows, angle: Math.round(rand() * 360) });
  }
  // Barajado determinista: los colores (ordenados por cuantil) no quedan en franjas.
  for (let i = pos.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pos[i], pos[j]] = [pos[j], pos[i]];
  }
  return pos;
}

export const selectionModelSpec: ModelSpec = {
  name: 'Selección natural sobre un rasgo cuantitativo (ecuación del criador)',
  inputs: [
    { symbol: 'B', name: 'Color del fondo (0 claro, 1 oscuro)', unit: '—', initial: 'suelo volcánico oscuro (0,8)' },
    { symbol: 'p', name: 'Intensidad de depredación', unit: '%', range: SEL_LIMITS.predation, initial: 60 },
    { symbol: 'h²', name: 'Heredabilidad del color', unit: '—', range: SEL_LIMITS.heritability, initial: 0.5 },
    { symbol: 'σ', name: 'Variación del color (desviación estándar)', unit: '—', range: SEL_LIMITS.variation, initial: 0.15 },
  ],
  outputs: [
    { symbol: 'z̄', name: 'Color medio de la población', unit: '—' },
    { symbol: 'S', name: 'Diferencial de selección', unit: '—' },
    { symbol: 'R', name: 'Respuesta a la selección', unit: '—' },
    { symbol: 's̄', name: 'Supervivencia media', unit: '%' },
  ],
  equations: [
    's(z) = 1 − p·[1 − exp(−(z − B)²/(2w²))],  w = 0,30',
    's̄ = Σ f(z)·s(z)  (201 clases de color)',
    'S = z̄ sobrevivientes − z̄ antes = Σ f·s·z / s̄ − Σ f·z',
    'R = h²·S  (ecuación del criador)',
    'z̄ siguiente = z̄ + R;  σ se mantiene (modelo infinitesimal)',
  ],
  initialConditions: [
    'Población con color medio 0,3 (escarabajos claros) y σ = 0,15.',
    'Fondo inicial: suelo volcánico oscuro (B = 0,8). En el escenario de hollín, B = 0,2 en la generación 0 y aumenta 0,03 por generación hasta 0,8.',
  ],
  assumptions: [
    'El color tiene distribución normal y lo determinan muchos genes de efecto pequeño (modelo infinitesimal): la varianza no cambia.',
    'La única causa de muerte que depende del color es la depredación por aves que cazan por contraste.',
    'La agudeza visual de las aves se resume en w = 0,30 (valor ilustrativo, no medido): a una diferencia de color de 0,30 con el fondo, el escarabajo ya es bastante visible; con un w menor la selección casi desaparece cuando la población está lejos del fondo.',
    'Población muy grande: no hay deriva génica; la simulación es determinista.',
    'Generaciones sin solapamiento; todos los sobrevivientes se reproducen por igual.',
  ],
  limits: [
    'La distribución normal tiene colas fuera de [0, 1]; en el dibujo los colores se recortan a ese intervalo.',
    'En poblaciones reales la selección reduce la varianza y la heredabilidad puede cambiar; aquí se mantienen fijas.',
    'El ritmo de oscurecimiento por hollín es ilustrativo, no medido.',
  ],
  testCases: [
    'Con h² = 0 no hay evolución aunque haya selección (S ≠ 0, R = 0).',
    'Sin depredación (p = 0) S = 0 y el color medio no cambia.',
    'R = h²·S y S coincide con el cálculo analítico para una población normal.',
    'La media se acerca a B y se estabiliza cuando z̄ ≈ B; la supervivencia es mayor cuando la población coincide con el fondo.',
    'Más variación produce un cambio más rápido; el resultado es simétrico respecto a B.',
  ],
};

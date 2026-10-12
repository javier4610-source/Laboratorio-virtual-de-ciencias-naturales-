/**
 * Medición realista (lógica pura, sin React): ruido gaussiano reproducible, cuantización a la
 * resolución del instrumento, estadística de mediciones repetidas y propagación de incertidumbre.
 *
 * En modo «ideal» una lectura solo se cuantiza; en modo «real» se suma ruido gaussiano cuya
 * semilla depende de la práctica, de la clave de la lectura y de un contador de repetición que
 * cambia cada vez que el estudiante vuelve a medir. Así, la misma lectura con el mismo contador
 * siempre da el mismo valor (reproducible), y al repetir la medición se obtiene otro.
 */
import { roundToResolution, seededRandom } from '../models/math';

export type MeasurementMode = 'ideal' | 'real';

export interface MeasureOptions {
  /** Resolución del instrumento (en la unidad de la lectura). */
  resolution: number;
  /** Desviación típica absoluta del ruido (en la unidad de la lectura). */
  sigma?: number;
  /** Desviación típica relativa (fracción del valor, p. ej. 0,005 = 0,5 %). Se combina en cuadratura con sigma. */
  relSigma?: number;
  /** Resolución con la que se registra la lectura en modo ideal (por defecto, la del instrumento; 0 = sin cuantizar). */
  idealResolution?: number;
  /** La magnitud no puede ser negativa (p. ej. una corriente medida en un solo sentido): la lectura se limita a 0. */
  nonNegative?: boolean;
}

/** Hash FNV-1a de 32 bits: convierte texto en una semilla entera. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Normal estándar N(0, 1) por el método de Box-Muller con un generador con semilla. */
export function gaussian(seed: number): number {
  const r = seededRandom(seed);
  const u1 = Math.max(r(), 1e-12), u2 = r();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Desviación típica total: σ_abs y σ_rel·|valor| combinadas en cuadratura. */
export function combinedSigma(value: number, o: Pick<MeasureOptions, 'sigma' | 'relSigma'>): number {
  const a = o.sigma ?? 0, b = (o.relSigma ?? 0) * Math.abs(value);
  return Math.sqrt(a * a + b * b);
}

/** Semilla de una lectura: práctica + clave de la lectura + contador de repetición. */
export function readingSeed(practiceId: string, key: string, repetition: number): number {
  return hashSeed(practiceId, key, repetition);
}

/** Lectura de un instrumento. Modo ideal: solo cuantiza. Modo real: suma ruido gaussiano reproducible y cuantiza. */
export function measureValue(trueValue: number, o: MeasureOptions & { mode: MeasurementMode; seed: number }): number {
  if (!Number.isFinite(trueValue)) return trueValue;
  if (o.mode === 'ideal') {
    const v = roundToResolution(trueValue, o.idealResolution ?? o.resolution);
    return o.nonNegative ? Math.max(0, v) : v;
  }
  const noisy = trueValue + gaussian(o.seed) * combinedSigma(trueValue, o);
  const v = roundToResolution(o.nonNegative ? Math.max(0, noisy) : noisy, o.resolution);
  return Object.is(v, -0) ? 0 : v;
}

/** Incertidumbre típica de tipo B debida a la resolución (distribución rectangular): res/√12. */
export const resolutionUncertainty = (resolution: number) => resolution / Math.sqrt(12);

/* ------------------------------------------------------------------ estadística */

export interface Stats { n: number; mean: number; sd: number; sem: number; }

/** n, media, desviación estándar muestral (n − 1) y error estándar de la media (DE/√n). Con n = 1, DE y EE son NaN. */
export function describe(values: number[]): Stats {
  const xs = values.filter((v) => Number.isFinite(v));
  const n = xs.length;
  if (n === 0) return { n: 0, mean: NaN, sd: NaN, sem: NaN };
  const mean = xs.reduce((s, v) => s + v, 0) / n;
  if (n === 1) return { n, mean, sd: NaN, sem: NaN };
  const ss = xs.reduce((s, v) => s + (v - mean) ** 2, 0);
  const sd = Math.sqrt(ss / (n - 1));
  return { n, mean, sd, sem: sd / Math.sqrt(n) };
}

/* ------------------------------------------------------------------ propagación */

export type Operation = 'divide' | 'multiply';

export interface Quantity { value: number; u: number; }

/**
 * Propagación para q = a/b o q = a·b con incertidumbres independientes:
 * u_q / |q| = √((u_a/a)² + (u_b/b)²).
 */
export function propagate(op: Operation, a: Quantity, b: Quantity): { value: number; u: number; rel: number } {
  const value = op === 'divide' ? a.value / b.value : a.value * b.value;
  if (!Number.isFinite(value) || a.value === 0 || b.value === 0) return { value, u: NaN, rel: NaN };
  const rel = Math.sqrt((a.u / a.value) ** 2 + (b.u / b.value) ** 2);
  return { value, u: Math.abs(value) * rel, rel };
}

/**
 * Incertidumbre típica de una magnitud a partir de sus repeticiones: el error estándar de la
 * media (tipo A) combinado con la de la resolución (tipo B). Con una sola lectura queda solo la de tipo B.
 */
export function standardUncertainty(stats: Stats, resolution?: number): number {
  const b = resolution ? resolutionUncertainty(resolution) : 0;
  const a = stats.n >= 2 && Number.isFinite(stats.sem) ? stats.sem : 0;
  return Math.sqrt(a * a + b * b);
}

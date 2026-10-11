/**
 * Lógica pura del registrador de datos (sensores virtuales tipo Vernier LabQuest / PASCO Capstone).
 * Sin React ni navegador: se prueba con Vitest.
 *
 *  - Muestreo a frecuencia fija en tiempo simulado: la muestra i ocurre en t = i / frecuencia.
 *  - Ruido gaussiano con semilla (reproducible) y cuantización por la resolución del instrumento.
 *  - Disparo por umbral (flanco de subida o de bajada) sobre un canal.
 *  - Estadísticas de una selección de tiempo: mínimo, máximo, media y pendiente (mínimos cuadrados).
 */
import { seededRandom } from '../models/math';

export interface LoggerChannel {
  /** Identificador estable (se usa en la exportación). */
  id: string;
  /** Nombre visible del sensor, p. ej. «Volumen de gas». */
  name: string;
  unit: string;
  /** Resolución del instrumento (paso de cuantización), p. ej. 0,1 mL. */
  resolution: number;
  /** Valor del modelo en el tiempo simulado t (s). */
  sample: (t: number) => number;
  /** Desviación estándar del ruido gaussiano (misma unidad del canal). 0 o ausente: sin ruido. */
  noise?: number;
  /** Límites físicos del sensor: la lectura se satura en ellos. */
  min?: number;
  max?: number;
  /** Color CSS del trazo (variable CSS). */
  color?: string;
}

export interface LoggerSample { t: number; values: number[]; }
export type TriggerEdge = 'subida' | 'bajada';
export interface TriggerSpec { channel: number; level: number; edge: TriggerEdge; }
export interface LoggerMarker { t: number; label: string; }

export interface LoggerRun {
  /** Muestras por segundo (tiempo simulado). */
  rate: number;
  ideal: boolean;
  channels: { id: string; name: string; unit: string; resolution: number; color?: string }[];
  samples: LoggerSample[];
  markers: LoggerMarker[];
  /** Instante (s) en que se cumplió el disparo, o null si se registró sin disparo. */
  triggerTime: number | null;
  /** Condiciones del montaje en que se registró (texto libre). */
  label?: string;
}

/** Número de decimales que corresponde a una resolución (0,1 → 1; 0,05 → 2; 2 → 0). */
export function decimalsFor(resolution: number): number {
  if (!(resolution > 0)) return 2;
  return Math.max(0, Math.min(6, Math.ceil(-Math.log10(resolution) - 1e-9)));
}

/** Cuantiza un valor a la resolución del instrumento, sin errores de coma flotante. */
export function quantize(value: number, resolution: number): number {
  if (!(resolution > 0) || !Number.isFinite(value)) return value;
  const d = decimalsFor(resolution);
  return Number((Math.round(value / resolution) * resolution).toFixed(d));
}

/** Generador de números con distribución normal estándar (Box–Muller) a partir de un generador uniforme. */
export function gaussian(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0;
    while (u <= 1e-12) u = rand();
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

export interface Sampler {
  /** Lectura del instrumento (con ruido y cuantización) de todos los canales en t. */
  read: (t: number) => number[];
}

/**
 * Crea un muestreador reproducible: con la misma semilla y la misma secuencia de instantes
 * produce exactamente las mismas lecturas.
 */
export function createSampler(channels: LoggerChannel[], seed: number, ideal: boolean): Sampler {
  const normal = gaussian(seededRandom(seed));
  return {
    read: (t) => channels.map((c) => {
      let v = c.sample(t);
      if (!ideal && c.noise && c.noise > 0) v += c.noise * normal();
      if (c.min !== undefined) v = Math.max(c.min, v);
      if (c.max !== undefined) v = Math.min(c.max, v);
      return ideal ? v : quantize(v, c.resolution);
    }),
  };
}

/** Instante de la muestra i a una frecuencia dada (evita acumular error de coma flotante). */
export const sampleTime = (i: number, rate: number) => Number((i / rate).toFixed(6));


/** ¿Hubo cruce del umbral entre la lectura anterior y la actual? */
export function crossed(prev: number | null, cur: number, spec: TriggerSpec): boolean {
  if (prev === null) return false;
  return spec.edge === 'subida' ? prev < spec.level && cur >= spec.level : prev > spec.level && cur <= spec.level;
}

/**
 * Estado del registro que avanza muestra a muestra. Permite adquirir por tramos (animación)
 * o todo de una vez (movimiento reducido) con resultados idénticos.
 */
export interface Acquisition {
  rate: number;
  duration: number;
  trigger: TriggerSpec | null;
  /** Lectura más reciente (aunque aún no se registre, esperando el disparo). */
  last: { t: number; values: number[] } | null;
  triggerTime: number | null;
  samples: LoggerSample[];
  /** Índice de la próxima muestra por adquirir. */
  next: number;
  done: boolean;
}

export function startAcquisition(rate: number, duration: number, trigger: TriggerSpec | null): Acquisition {
  return { rate, duration, trigger, last: null, triggerTime: null, samples: [], next: 0, done: false };
}

/** Adquiere todas las muestras hasta el tiempo simulado tNow (inclusive). Muta y devuelve el estado. */
export function advance(acq: Acquisition, sampler: Sampler, tNow: number): Acquisition {
  if (acq.done) return acq;
  const last = Math.floor(acq.duration * acq.rate + 1e-9);
  const to = Math.min(last, Math.floor(Math.min(tNow, acq.duration) * acq.rate + 1e-9));
  for (let i = acq.next; i <= to; i++) {
    const t = sampleTime(i, acq.rate);
    const values = sampler.read(t);
    const armed = acq.trigger !== null && acq.triggerTime === null;
    if (armed) {
      const prev = acq.last ? acq.last.values[acq.trigger!.channel] : null;
      if (crossed(prev, values[acq.trigger!.channel], acq.trigger!)) acq.triggerTime = t;
    }
    if (acq.trigger === null || acq.triggerTime !== null) acq.samples.push({ t, values });
    acq.last = { t, values };
  }
  acq.next = Math.max(acq.next, to + 1);
  if (acq.next > last) acq.done = true;
  return acq;
}

export interface RangeStats { n: number; min: number; max: number; mean: number; slope: number | null; intercept: number | null; t0: number; t1: number; }

/** Estadísticas del canal ch en la selección [t0, t1] (null si no hay muestras). */
export function rangeStats(samples: LoggerSample[], ch: number, t0 = -Infinity, t1 = Infinity): RangeStats | null {
  const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
  let n = 0, min = Infinity, max = -Infinity, sx = 0, sy = 0, sxx = 0, sxy = 0, first = Infinity, lastT = -Infinity;
  for (const s of samples) {
    if (s.t < lo - 1e-9 || s.t > hi + 1e-9) continue;
    const y = s.values[ch];
    if (!Number.isFinite(y)) continue;
    n++; min = Math.min(min, y); max = Math.max(max, y);
    sx += s.t; sy += y; sxx += s.t * s.t; sxy += s.t * y;
    first = Math.min(first, s.t); lastT = Math.max(lastT, s.t);
  }
  if (n === 0) return null;
  const den = n * sxx - sx * sx;
  const slope = n >= 2 && Math.abs(den) > 1e-12 ? (n * sxy - sx * sy) / den : null;
  const intercept = slope === null ? null : (sy - slope * sx) / n;
  return { n, min, max, mean: sy / n, slope, intercept, t0: first, t1: lastT };
}

const num = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '');
const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Exporta la corrida en CSV (separador punto y coma y coma decimal, como Excel en español). */
export function runToCSV(run: LoggerRun): string {
  const td = decimalsFor(1 / run.rate);
  const header = ['Tiempo (s)', ...run.channels.map((c) => `${c.name} (${c.unit})`)];
  const markerAt = new Map(run.markers.map((m) => [m.t.toFixed(6), m.label]));
  const hasMarkers = run.markers.length > 0;
  if (hasMarkers) header.push('Marcador');
  const rows = run.samples.map((s) => {
    const r = [num(s.t, td), ...s.values.map((v, i) => num(v, decimalsFor(run.channels[i].resolution) + (run.ideal ? 2 : 0)))];
    if (hasMarkers) r.push(markerAt.get(s.t.toFixed(6)) ?? '');
    return r;
  });
  const meta = [
    ...(run.label ? [[`# ${run.label}`]] : []),
    [`# Frecuencia de muestreo: ${num(run.rate, 0)} muestras/s`],
    [`# Modo: ${run.ideal ? 'ideal (sin ruido ni cuantización)' : 'instrumento (con ruido y resolución)'}`],
    ...(run.triggerTime !== null ? [[`# Disparo en t = ${num(run.triggerTime, td)} s`]] : []),
  ];
  return [...meta, header, ...rows].map((r) => r.map(cell).join(';')).join('\n');
}

/** Ajusta la marca de tiempo a la muestra más cercana del registro (los marcadores caen sobre muestras). */
export function snapToSample(samples: LoggerSample[], t: number): number | null {
  if (samples.length === 0) return null;
  let best = samples[0].t;
  for (const s of samples) if (Math.abs(s.t - t) < Math.abs(best - t)) best = s.t;
  return best;
}

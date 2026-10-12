/**
 * Partes puras del sistema de sonido: envolventes, limitador de repeticiones, ajustes persistentes
 * y escalas de volumen. No dependen de la Web Audio API, así que se prueban en Node.
 */

export interface EnvelopeSpec {
  /** Subida hasta el pico (s). */
  attack: number;
  /** Tiempo en el pico (s). */
  hold?: number;
  /** Caída exponencial hasta el sostenido o hasta el silencio (s). */
  decay: number;
  /** Nivel de sostenido como fracción del pico (0 a 1). Solo se usa si hay `sustainTime`. */
  sustain?: number;
  sustainTime?: number;
  /** Caída final desde el sostenido (s). Por defecto, igual a `decay`. */
  release?: number;
  /** Nivel máximo (ganancia lineal). Por defecto 1. */
  peak?: number;
}

export interface EnvPoint { t: number; v: number; curve: 'set' | 'lin' | 'exp' }

/** Silencio práctico: las rampas exponenciales no pueden llegar a 0. */
export const ENV_FLOOR = 1e-4;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Puntos de una envolvente AHDSR listos para programar en un AudioParam. */
export function envelopePoints(e: EnvelopeSpec): EnvPoint[] {
  const peak = Math.max(ENV_FLOOR, e.peak ?? 1);
  const pts: EnvPoint[] = [{ t: 0, v: ENV_FLOOR, curve: 'set' }];
  let t = Math.max(0.0005, e.attack);
  pts.push({ t, v: peak, curve: 'lin' });
  if (e.hold && e.hold > 0) { t += e.hold; pts.push({ t, v: peak, curve: 'lin' }); }
  const sustain = clamp(e.sustain ?? 0, 0, 1) * peak;
  const decay = Math.max(0.001, e.decay);
  if (sustain > ENV_FLOOR && e.sustainTime !== undefined && e.sustainTime >= 0) {
    t += decay; pts.push({ t, v: sustain, curve: 'exp' });
    if (e.sustainTime > 0) { t += e.sustainTime; pts.push({ t, v: sustain, curve: 'lin' }); }
    t += Math.max(0.001, e.release ?? decay); pts.push({ t, v: ENV_FLOOR, curve: 'exp' });
  } else {
    t += decay; pts.push({ t, v: ENV_FLOOR, curve: 'exp' });
  }
  return pts;
}

export function envelopeDuration(e: EnvelopeSpec): number {
  const pts = envelopePoints(e);
  return pts[pts.length - 1].t;
}

/** Valor de la envolvente en el instante t (misma interpolación que la Web Audio API). */
export function envelopeValueAt(points: EnvPoint[], t: number): number {
  if (t <= points[0].t) return points[0].v;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      if (b.curve === 'exp') return a.v * Math.pow(b.v / a.v, f);
      if (b.curve === 'set') return b.v;
      return a.v + (b.v - a.v) * f;
    }
  }
  return points[points.length - 1].v;
}

/** Limitador de repeticiones por clave: evita ráfagas al arrastrar deslizadores o en animaciones. */
export function createRateLimiter(defaultMs: number, perKey: Record<string, number> = {}) {
  const last = new Map<string, number>();
  return {
    allow(key: string, now: number): boolean {
      const min = perKey[key] ?? defaultMs;
      const prev = last.get(key);
      if (prev !== undefined && now - prev < min && now >= prev) return false;
      last.set(key, now);
      return true;
    },
    reset() { last.clear(); },
  };
}

/* ------------------------------------------------------------------ */
/* Ajustes                                                             */
/* ------------------------------------------------------------------ */

export interface SoundSettings { enabled: boolean; volume: number }
export const SOUND_KEY = 'lvcn:sonido';
export const DEFAULT_SOUND_SETTINGS: SoundSettings = { enabled: true, volume: 0.6 };

type KV = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): KV | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

export function clampVolume(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_SOUND_SETTINGS.volume;
  return clamp(n, 0, 1);
}

export function loadSoundSettings(storage: KV | null = defaultStorage()): SoundSettings {
  try {
    const raw = storage?.getItem(SOUND_KEY);
    if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
    const data = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_SOUND_SETTINGS.enabled,
      volume: data.volume === undefined ? DEFAULT_SOUND_SETTINGS.volume : clampVolume(data.volume),
    };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

export function saveSoundSettings(s: SoundSettings, storage: KV | null = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SOUND_KEY, JSON.stringify({ enabled: !!s.enabled, volume: clampVolume(s.volume) }));
    return true;
  } catch {
    return false;
  }
}

/** Volumen del deslizador (0 a 1) → ganancia maestra con curva perceptual (cuadrática). */
export function volumeToGain(volume: number): number {
  const v = clampVolume(volume);
  return v <= 0 ? 0 : v * v;
}

/** Intensidad de un golpe (0 a 1) a partir de la rapidez de impacto; crece como la raíz cuadrada. */
export function impactIntensity(speed: number, reference: number): number {
  if (!Number.isFinite(speed) || !(reference > 0)) return 0;
  return clamp(Math.sqrt(Math.abs(speed) / reference), 0, 1);
}

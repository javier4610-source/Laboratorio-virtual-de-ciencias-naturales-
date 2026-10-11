import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Ondas mecánicas (grado 8.º): onda transversal en una cuerda y sonido en el aire.
 *   v = √(T/μ)    λ = v/f    T = 1/f    y(x,t) = A·sen(2π(x/λ − f·t))
 */

export const WAVE_LIMITS = {
  frequency: [0.5, 10] as [number, number], // Hz (cuerda)
  amplitude: [1, 10] as [number, number], // cm
  tension: [5, 80] as [number, number], // N
  soundFrequency: [20, 20000] as [number, number], // Hz
  airTemperature: [-10, 40] as [number, number], // °C
};

export interface Rope { id: string; name: string; mu: number; /** kg/m */ }
export const ROPES: Rope[] = [
  { id: 'liviana', name: 'Cuerda liviana (nylon)', mu: 0.05 },
  { id: 'media', name: 'Cuerda media (algodón)', mu: 0.2 },
  { id: 'pesada', name: 'Cuerda pesada (cadena)', mu: 0.8 },
];

export function findRope(id: string): Rope {
  const r = ROPES.find((x) => x.id === id);
  if (!r) throw new Error(`Cuerda desconocida: ${id}`);
  return r;
}

/** Rapidez de una onda transversal en una cuerda tensa (m/s). */
export function ropeSpeed(tensionN: number, muKgPerM: number): number {
  if (tensionN <= 0 || muKgPerM <= 0) throw new RangeError('La tensión y la densidad lineal deben ser positivas.');
  return Math.sqrt(tensionN / muKgPerM);
}

/** Rapidez del sonido en aire seco (m/s), aproximación lineal válida entre −20 y 40 °C. */
export function soundSpeedAir(tempC: number): number {
  return 331.3 + 0.606 * tempC;
}

export interface RopeWaveInput { ropeId: string; tension: number; frequency: number; amplitude: number; }
export interface RopeWaveResult { speed: number; wavelength: number; period: number; angularFrequency: number; waveNumber: number; relativeEnergy: number; }

export function ropeWave(input: RopeWaveInput): RopeWaveResult {
  assertInRange('La tensión', input.tension, ...WAVE_LIMITS.tension);
  assertInRange('La frecuencia', input.frequency, ...WAVE_LIMITS.frequency);
  assertInRange('La amplitud', input.amplitude, ...WAVE_LIMITS.amplitude);
  const v = ropeSpeed(input.tension, findRope(input.ropeId).mu);
  const lambda = v / input.frequency;
  return {
    speed: v, wavelength: lambda, period: 1 / input.frequency,
    angularFrequency: 2 * Math.PI * input.frequency, waveNumber: (2 * Math.PI) / lambda,
    // La energía transportada por unidad de longitud es proporcional a A²·f² (relativa a A = 1 cm, f = 1 Hz).
    relativeEnergy: input.amplitude ** 2 * input.frequency ** 2,
  };
}

/** Desplazamiento transversal (cm) en la posición x (m) y el tiempo t (s). */
export function displacement(x: number, t: number, amplitude: number, wavelength: number, frequency: number): number {
  return amplitude * Math.sin(2 * Math.PI * (x / wavelength - frequency * t));
}

export interface SoundInput { frequency: number; temperature: number; }
export interface SoundResult { speed: number; wavelength: number; period: number; audible: boolean; range: 'infrasonido' | 'audible' | 'ultrasonido'; }

export function soundWave(input: SoundInput): SoundResult {
  assertInRange('La frecuencia', input.frequency, 1, 100000);
  assertInRange('La temperatura del aire', input.temperature, ...WAVE_LIMITS.airTemperature);
  const v = soundSpeedAir(input.temperature);
  const range = input.frequency < 20 ? 'infrasonido' : input.frequency > 20000 ? 'ultrasonido' : 'audible';
  return { speed: v, wavelength: v / input.frequency, period: 1 / input.frequency, audible: range === 'audible', range };
}

export const wavesModelSpec: ModelSpec = {
  name: 'Ondas transversales en una cuerda y ondas sonoras en el aire',
  inputs: [
    { symbol: 'f', name: 'Frecuencia del generador', unit: 'Hz', range: WAVE_LIMITS.frequency, initial: 2 },
    { symbol: 'A', name: 'Amplitud', unit: 'cm', range: WAVE_LIMITS.amplitude, initial: 4 },
    { symbol: 'T', name: 'Tensión de la cuerda', unit: 'N', range: WAVE_LIMITS.tension, initial: 20 },
    { symbol: 'μ', name: 'Densidad lineal de la cuerda', unit: 'kg/m', initial: 0.2 },
    { symbol: 'f_sonido', name: 'Frecuencia del sonido', unit: 'Hz', range: WAVE_LIMITS.soundFrequency, initial: 440 },
    { symbol: 'T_aire', name: 'Temperatura del aire', unit: '°C', range: WAVE_LIMITS.airTemperature, initial: 20 },
  ],
  outputs: [
    { symbol: 'v', name: 'Rapidez de propagación', unit: 'm/s' },
    { symbol: 'λ', name: 'Longitud de onda', unit: 'm' },
    { symbol: 'T', name: 'Periodo', unit: 's' },
    { symbol: 'E_rel', name: 'Energía relativa transportada', unit: '∝ A²f²' },
  ],
  equations: [
    'v = λ·f   →   λ = v/f',
    'T = 1/f',
    'Cuerda: v = √(T/μ)',
    'Aire seco: v ≈ 331,3 + 0,606·T(°C) m/s',
    'y(x,t) = A·sen[2π(x/λ − f·t)]',
    'Energía transportada ∝ A²·f²',
  ],
  initialConditions: ['Cuerda media (μ = 0,2 kg/m) con 20 N de tensión, f = 2 Hz, A = 4 cm.'],
  assumptions: [
    'Cuerda ideal: flexible, homogénea, sin pérdidas de energía y suficientemente larga para no reflejar la onda.',
    'Ondas armónicas (sinusoidales) de amplitud pequeña.',
    'El sonido viaja en aire seco; se ignoran la humedad y el viento.',
  ],
  limits: [
    'No se representan reflexiones, ondas estacionarias, interferencia ni amortiguamiento.',
    'La fórmula de la rapidez del sonido es una aproximación lineal válida para temperaturas ambientales.',
    'La animación se ralentiza en pantalla para poder observarla; los valores numéricos no cambian.',
  ],
  testCases: [
    'v = λ·f en todos los casos; duplicar f reduce λ a la mitad.',
    'Cuadruplicar la tensión duplica la rapidez.',
    'v del sonido a 20 °C ≈ 343 m/s; λ de 440 Hz ≈ 0,78 m.',
    'La frecuencia no cambia la rapidez en un medio dado.',
  ],
};

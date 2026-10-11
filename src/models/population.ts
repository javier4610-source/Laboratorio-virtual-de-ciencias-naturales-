import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Crecimiento poblacional (grado 11.º, ciencias ambientales):
 * modelo logístico con cosecha/mortalidad adicional proporcional.
 *
 *   dN/dt = r·N·(1 − N/K) − h·N
 */

export const POPULATION_LIMITS = {
  n0: [2, 500] as [number, number],
  r: [0.05, 1.5] as [number, number], // 1/año
  k: [100, 5000] as [number, number],
  h: [0, 1] as [number, number], // 1/año
  years: [5, 100] as [number, number],
};

export interface PopulationInput { n0: number; r: number; k: number; h: number; years: number; model: 'exponencial' | 'logistico'; }

export interface PopulationResult {
  series: { t: number; n: number }[];
  finalN: number;
  equilibrium: number; // población de equilibrio (logístico) o Infinity (exponencial)
  timeToHalfK: number | null; // años para llegar a K/2
  doublingTime: number | null; // años (crecimiento exponencial, r−h > 0)
  extinct: boolean;
}

/** Solución analítica del modelo logístico con cosecha: es logística con r' = r − h y K' = K(1 − h/r). */
export function logisticAt(n0: number, r: number, k: number, h: number, t: number): number {
  const rEff = r - h;
  if (Math.abs(rEff) < 1e-12) return n0 / (1 + (r * n0 * t) / k);
  const kEff = k * (1 - h / r);
  if (rEff < 0) {
    // La población decrece hacia 0; misma forma analítica con K' negativo.
    return (kEff * n0) / (n0 + (kEff - n0) * Math.exp(-rEff * t));
  }
  return kEff / (1 + ((kEff - n0) / n0) * Math.exp(-rEff * t));
}

export function simulatePopulation(input: PopulationInput): PopulationResult {
  assertInRange('La población inicial', input.n0, ...POPULATION_LIMITS.n0);
  assertInRange('La tasa de crecimiento', input.r, ...POPULATION_LIMITS.r);
  assertInRange('La capacidad de carga', input.k, ...POPULATION_LIMITS.k);
  assertInRange('La tasa de cosecha', input.h, ...POPULATION_LIMITS.h);
  assertInRange('El tiempo', input.years, ...POPULATION_LIMITS.years);
  const series: { t: number; n: number }[] = [];
  const steps = 200;
  const rEff = input.r - input.h;
  for (let i = 0; i <= steps; i++) {
    const t = (input.years * i) / steps;
    const n = input.model === 'exponencial'
      ? input.n0 * Math.exp(rEff * t)
      : logisticAt(input.n0, input.r, input.k, input.h, t);
    series.push({ t, n: Math.max(0, n) });
  }
  const finalN = series[series.length - 1].n;
  const equilibrium = input.model === 'exponencial' ? (rEff > 0 ? Infinity : 0) : Math.max(0, input.k * (1 - input.h / input.r));
  let timeToHalfK: number | null = null;
  const half = input.k / 2;
  for (const p of series) if (p.n >= half) { timeToHalfK = p.t; break; }
  return {
    series, finalN, equilibrium, timeToHalfK,
    doublingTime: rEff > 0 ? Math.LN2 / rEff : null,
    extinct: finalN < 2,
  };
}

export const populationModelSpec: ModelSpec = {
  name: 'Crecimiento poblacional exponencial y logístico con cosecha',
  inputs: [
    { symbol: 'N₀', name: 'Población inicial', unit: 'individuos', range: POPULATION_LIMITS.n0, initial: 20 },
    { symbol: 'r', name: 'Tasa intrínseca de crecimiento', unit: '1/año', range: POPULATION_LIMITS.r, initial: 0.5 },
    { symbol: 'K', name: 'Capacidad de carga', unit: 'individuos', range: POPULATION_LIMITS.k, initial: 1000 },
    { symbol: 'h', name: 'Tasa de cosecha o mortalidad adicional (pesca, caza, contaminación)', unit: '1/año', range: POPULATION_LIMITS.h, initial: 0 },
  ],
  outputs: [
    { symbol: 'N(t)', name: 'Tamaño de la población', unit: 'individuos' },
    { symbol: 'N*', name: 'Población de equilibrio', unit: 'individuos' },
  ],
  equations: [
    'Exponencial: dN/dt = (r − h)·N  →  N(t) = N₀·e^((r−h)t)',
    'Logístico: dN/dt = r·N·(1 − N/K) − h·N',
    'Equilibrio con cosecha: N* = K·(1 − h/r) (si h < r)',
    'Tiempo de duplicación (fase exponencial): t₂ = ln 2 / (r − h)',
  ],
  initialConditions: ['N₀ = 20 individuos, r = 0,5 por año, K = 1000, sin cosecha.'],
  assumptions: [
    'Población cerrada (sin migración), con generaciones superpuestas y crecimiento continuo.',
    'K y r constantes en el tiempo; todos los individuos son equivalentes (sin estructura de edades).',
    'La cosecha o mortalidad adicional es proporcional al tamaño de la población.',
  ],
  limits: [
    'No representa variabilidad ambiental, efecto Allee, interacciones con otras especies ni retardos.',
    'Con poblaciones muy pequeñas, el azar demográfico (no modelado) puede causar extinción.',
    'Los valores numéricos son ilustrativos, no corresponden a una especie concreta.',
  ],
  testCases: [
    'Con h = 0, la población logística tiende a K.',
    'Con h > 0, el equilibrio es K(1 − h/r); si h ≥ r la población disminuye hacia 0.',
    'El modelo exponencial duplica la población cada ln2/r años.',
    'La solución analítica coincide con la integración numérica.',
  ],
};

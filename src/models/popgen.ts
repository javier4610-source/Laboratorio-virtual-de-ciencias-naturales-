import { assertInRange, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Genética de poblaciones (grado 11.º): Hardy-Weinberg y fuerzas evolutivas.
 * Un gen con dos alelos, A (frecuencia p) y a (frecuencia q = 1 − p).
 * Orden en cada generación: mutación → migración → selección → deriva (muestreo de 2N gametos, Wright-Fisher).
 */

export const POPGEN_LIMITS = {
  p0: [0.01, 0.99] as [number, number],
  n: [10, 5000] as [number, number],
  generations: [10, 300] as [number, number],
  fitness: [0, 1] as [number, number],
  mutation: [0, 0.01] as [number, number],
  migration: [0, 0.2] as [number, number],
  replicates: [1, 8] as [number, number],
};

export interface PopGenInput {
  p0: number;
  n: number; // tamaño poblacional (individuos diploides)
  generations: number;
  fitness: { AA: number; Aa: number; aa: number };
  mutationAtoa: number; // tasa A → a por generación
  migration: number; // fracción de migrantes por generación
  migrantP: number; // frecuencia de A en los migrantes
  drift: boolean;
  replicates: number;
  seed: number;
}

export interface HardyWeinberg { AA: number; Aa: number; aa: number; }

export function hardyWeinberg(p: number): HardyWeinberg {
  const q = 1 - p;
  return { AA: p * p, Aa: 2 * p * q, aa: q * q };
}

/** Frecuencia de A tras la selección (fórmula determinista). */
export function afterSelection(p: number, w: { AA: number; Aa: number; aa: number }): number {
  const q = 1 - p;
  const wbar = p * p * w.AA + 2 * p * q * w.Aa + q * q * w.aa;
  if (wbar <= 0) return p;
  return (p * p * w.AA + p * q * w.Aa) / wbar;
}

/** Muestreo binomial (2N ensayos) con generador reproducible; aproximación normal para 2N grande. */
function binomial(nTrials: number, prob: number, rand: () => number): number {
  if (prob <= 0) return 0;
  if (prob >= 1) return nTrials;
  if (nTrials <= 1000) {
    let k = 0;
    for (let i = 0; i < nTrials; i++) if (rand() < prob) k++;
    return k;
  }
  const mean = nTrials * prob, sd = Math.sqrt(nTrials * prob * (1 - prob));
  const u1 = Math.max(rand(), 1e-12), u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.min(nTrials, Math.max(0, Math.round(mean + sd * z)));
}

export function nextGeneration(p: number, input: PopGenInput, rand: () => number): number {
  let x = p * (1 - input.mutationAtoa); // mutación A → a
  x = (1 - input.migration) * x + input.migration * input.migrantP; // migración
  x = afterSelection(x, input.fitness); // selección
  if (input.drift) x = binomial(2 * input.n, x, rand) / (2 * input.n); // deriva génica
  return x;
}

export interface PopGenResult {
  series: { generation: number; p: number[] }[]; // una frecuencia por réplica
  finalP: number[];
  meanFinalP: number;
  fixedA: number; // réplicas donde p = 1
  lostA: number; // réplicas donde p = 0
  heterozygosityFinal: number; // promedio de 2pq
  deterministicFinalP: number; // sin deriva, como referencia
  equilibriumP: number | null; // equilibrio por ventaja del heterocigoto, si existe
}

export function simulatePopGen(input: PopGenInput): PopGenResult {
  assertInRange('La frecuencia inicial de A', input.p0, ...POPGEN_LIMITS.p0);
  assertInRange('El tamaño de la población', input.n, ...POPGEN_LIMITS.n);
  assertInRange('El número de generaciones', input.generations, ...POPGEN_LIMITS.generations);
  for (const [k, v] of Object.entries(input.fitness)) assertInRange(`La eficacia de ${k}`, v, ...POPGEN_LIMITS.fitness);
  assertInRange('La tasa de mutación', input.mutationAtoa, ...POPGEN_LIMITS.mutation);
  assertInRange('La tasa de migración', input.migration, ...POPGEN_LIMITS.migration);
  assertInRange('El número de réplicas', input.replicates, ...POPGEN_LIMITS.replicates);
  if (Math.max(input.fitness.AA, input.fitness.Aa, input.fitness.aa) <= 0) throw new RangeError('Al menos un genotipo debe tener eficacia mayor que cero.');

  const reps = input.drift ? input.replicates : 1;
  const ps = Array.from({ length: reps }, () => input.p0);
  const rands = Array.from({ length: reps }, (_, i) => seededRandom(input.seed * 1000 + i));
  const series = [{ generation: 0, p: [...ps] }];
  let det = input.p0;
  const detInput = { ...input, drift: false };
  for (let g = 1; g <= input.generations; g++) {
    for (let r = 0; r < reps; r++) ps[r] = nextGeneration(ps[r], input, rands[r]);
    det = nextGeneration(det, detInput, () => 0.5);
    series.push({ generation: g, p: [...ps] });
  }
  const { AA, Aa, aa } = input.fitness;
  // Ventaja del heterocigoto: s = 1 − wAA/wAa, t = 1 − waa/wAa; equilibrio p* = t/(s + t).
  let eq: number | null = null;
  if (Aa > AA && Aa > aa) {
    const s = 1 - AA / Aa, t = 1 - aa / Aa;
    eq = t / (s + t);
  }
  return {
    series, finalP: [...ps],
    meanFinalP: ps.reduce((a, b) => a + b, 0) / reps,
    fixedA: ps.filter((x) => x >= 1 - 1e-12).length,
    lostA: ps.filter((x) => x <= 1e-12).length,
    heterozygosityFinal: ps.reduce((acc, x) => acc + 2 * x * (1 - x), 0) / reps,
    deterministicFinalP: det, equilibriumP: eq,
  };
}

export const popGenModelSpec: ModelSpec = {
  name: 'Equilibrio de Hardy-Weinberg y fuerzas evolutivas (selección, mutación, migración y deriva)',
  inputs: [
    { symbol: 'p₀', name: 'Frecuencia inicial del alelo A', unit: '—', range: POPGEN_LIMITS.p0, initial: 0.5 },
    { symbol: 'N', name: 'Tamaño de la población', unit: 'individuos', range: POPGEN_LIMITS.n, initial: 100 },
    { symbol: 'w', name: 'Eficacia biológica de AA, Aa y aa', unit: '0–1', range: POPGEN_LIMITS.fitness, initial: 1 },
    { symbol: 'μ', name: 'Tasa de mutación A → a', unit: 'por generación', range: POPGEN_LIMITS.mutation, initial: 0 },
    { symbol: 'm', name: 'Fracción de migrantes', unit: 'por generación', range: POPGEN_LIMITS.migration, initial: 0 },
    { symbol: 'réplicas', name: 'Poblaciones simuladas en paralelo', unit: '—', range: POPGEN_LIMITS.replicates, initial: 5 },
  ],
  outputs: [
    { symbol: 'p(t)', name: 'Frecuencia del alelo A en cada generación', unit: '—' },
    { symbol: 'p², 2pq, q²', name: 'Frecuencias genotípicas de Hardy-Weinberg', unit: '—' },
    { symbol: 'H', name: 'Heterocigosidad 2pq', unit: '—' },
  ],
  equations: [
    'Hardy-Weinberg: p² + 2pq + q² = 1',
    'Selección: p\' = (p²·w_AA + pq·w_Aa) / w̄,  w̄ = p²w_AA + 2pq·w_Aa + q²w_aa',
    'Mutación: p\' = p(1 − μ)   ·   Migración: p\' = (1 − m)p + m·p_migrantes',
    'Deriva (Wright-Fisher): número de alelos A ~ Binomial(2N, p)',
    'Ventaja del heterocigoto: p* = t/(s + t), con s = 1 − w_AA/w_Aa y t = 1 − w_aa/w_Aa',
  ],
  initialConditions: ['p₀ = 0,5; N = 100; sin selección, mutación ni migración; 5 réplicas con deriva.'],
  assumptions: [
    'Organismos diploides con generaciones discretas y apareamiento al azar.',
    'Un solo gen con dos alelos; la eficacia es constante en el tiempo.',
    'La deriva se modela con muestreo binomial de los gametos (el azar tiene justificación biológica); la semilla hace reproducible el resultado.',
  ],
  limits: [
    'No representa apareamiento no aleatorio, estructura de edades, ligamiento ni variación ambiental de la eficacia.',
    'Los valores de eficacia en el escenario de anemia falciforme son ilustrativos, no mediciones de una población concreta.',
    'Para 2N > 1000 la deriva se aproxima con una distribución normal.',
  ],
  testCases: [
    'Sin fuerzas evolutivas, p se mantiene y las frecuencias genotípicas son p², 2pq, q².',
    'La selección contra el alelo recesivo reduce q cada vez más lentamente.',
    'Con ventaja del heterocigoto la frecuencia tiende a p* = t/(s + t).',
    'La deriva fija o pierde alelos con más frecuencia en poblaciones pequeñas.',
    'La misma semilla reproduce exactamente la misma trayectoria.',
  ],
};

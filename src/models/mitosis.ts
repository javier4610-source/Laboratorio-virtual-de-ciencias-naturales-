import { assertInRange, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Ciclo celular y mitosis (grado 7.º).
 *
 * En una población de células que se dividen de forma asincrónica, la fracción de
 * células que se observa en cada fase es aproximadamente proporcional a la duración
 * de esa fase (aproximación de distribución uniforme de edades). Así se estima la
 * duración de una fase a partir de un conteo: t_fase ≈ (n_fase / N) · T_ciclo.
 */

export type Phase = 'interfase' | 'profase' | 'metafase' | 'anafase' | 'telofase';
export const PHASES: Phase[] = ['interfase', 'profase', 'metafase', 'anafase', 'telofase'];
export const MITOTIC_PHASES: Phase[] = ['profase', 'metafase', 'anafase', 'telofase'];

export const PHASE_INFO: Record<Phase, { name: string; description: string }> = {
  interfase: { name: 'Interfase', description: 'Núcleo con envoltura; cromatina sin condensar. Incluye G1, S (replicación del ADN) y G2.' },
  profase: { name: 'Profase', description: 'Los cromosomas se condensan y se hacen visibles; se forma el huso y desaparece la envoltura nuclear.' },
  metafase: { name: 'Metafase', description: 'Los cromosomas se alinean en el plano ecuatorial de la célula.' },
  anafase: { name: 'Anafase', description: 'Las cromátidas hermanas se separan hacia polos opuestos.' },
  telofase: { name: 'Telofase', description: 'Se forman dos núcleos y comienza la división del citoplasma (citocinesis).' },
};

export interface Tissue {
  id: string;
  name: string;
  cycleHours: number;
  /** Duración de cada fase en horas (la interfase incluye G1 + S + G2). */
  durations: Record<Phase, number>;
  /** Fracción de células que están en ciclo (el resto, en G0, aparecen en interfase). */
  proliferating: number;
}

/** Valores ilustrativos del orden de magnitud reportado para meristemos de raíz de cebolla (Allium cepa) a ~20–25 °C. */
export const TISSUES: Tissue[] = [
  {
    id: 'meristemo', name: 'Meristemo apical de raíz de cebolla', cycleHours: 18,
    durations: { interfase: 16, profase: 1.0, metafase: 0.35, anafase: 0.2, telofase: 0.45 }, proliferating: 1,
  },
  {
    id: 'elongacion', name: 'Zona de elongación de la raíz', cycleHours: 18,
    durations: { interfase: 16, profase: 1.0, metafase: 0.35, anafase: 0.2, telofase: 0.45 }, proliferating: 0.08,
  },
];

export const MITOSIS_LIMITS = { cells: [20, 400] as [number, number], colchicine: [0, 6] as [number, number] };

export function findTissue(id: string): Tissue {
  const t = TISSUES.find((x) => x.id === id);
  if (!t) throw new Error(`Tejido desconocido: ${id}`);
  return t;
}

/**
 * Fracción esperada de células en cada fase. La colchicina impide formar el huso:
 * las células que llegan a metafase quedan detenidas, por lo que la metafase se
 * acumula y anafase y telofase se vacían (modelo simplificado).
 */
export function expectedFractions(tissue: Tissue, colchicineHours = 0): Record<Phase, number> {
  assertInRange('El tiempo con colchicina', colchicineHours, ...MITOSIS_LIMITS.colchicine);
  const d = tissue.durations;
  const E = colchicineHours;
  const raw: Record<Phase, number> = {
    interfase: Math.max(0, d.interfase - E),
    profase: d.profase,
    metafase: d.metafase + E, // las células se acumulan en metafase
    anafase: Math.max(0, d.anafase - E),
    telofase: Math.max(0, d.telofase - Math.max(0, E - d.anafase)),
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  const f = {} as Record<Phase, number>;
  for (const p of PHASES) f[p] = (raw[p] / sum) * tissue.proliferating;
  f.interfase += 1 - tissue.proliferating; // células en G0
  return f;
}

export interface FieldCell { id: number; phase: Phase; x: number; y: number; angle: number; }

/** Genera un campo del microscopio con N células. El azar representa qué células caen en el campo observado. */
export function generateField(tissue: Tissue, n: number, seed: number, colchicineHours = 0): FieldCell[] {
  assertInRange('El número de células', n, ...MITOSIS_LIMITS.cells);
  const f = expectedFractions(tissue, colchicineHours);
  const rand = seededRandom(seed);
  const cum: [Phase, number][] = [];
  let acc = 0;
  for (const p of PHASES) { acc += f[p]; cum.push([p, acc]); }
  const cols = Math.ceil(Math.sqrt(n * 1.6));
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    const phase = (cum.find(([, c]) => r < c) ?? cum[cum.length - 1])[0];
    return { id: i, phase, x: i % cols, y: Math.floor(i / cols), angle: Math.round((rand() - 0.5) * 40) };
  });
}

export function countPhases(cells: { phase: Phase }[]): Record<Phase, number> {
  const c = { interfase: 0, profase: 0, metafase: 0, anafase: 0, telofase: 0 } as Record<Phase, number>;
  for (const cell of cells) c[cell.phase]++;
  return c;
}

/** Índice mitótico (%) = células en mitosis / total × 100. */
export function mitoticIndex(counts: Record<Phase, number>): number {
  const total = PHASES.reduce((s, p) => s + counts[p], 0);
  const mit = MITOTIC_PHASES.reduce((s, p) => s + counts[p], 0);
  return total ? (mit / total) * 100 : 0;
}

/** Duración estimada de una fase (h) a partir del conteo. */
export function estimatedDuration(counts: Record<Phase, number>, phase: Phase, cycleHours: number): number {
  const total = PHASES.reduce((s, p) => s + counts[p], 0);
  return total ? (counts[phase] / total) * cycleHours : 0;
}

/** Fase del ciclo y contenido de ADN (en valores C) a lo largo de un ciclo; 2n = 16 en la cebolla. */
export const ONION_2N = 16;
export interface CycleState { stage: 'G1' | 'S' | 'G2' | Phase; dnaC: number; chromosomes: number; chromatidsPerChromosome: number; nuclei: number; }

export const CYCLE_STAGES = { G1: 7, S: 6, G2: 3 }; // h (suman 16 = interfase del meristemo)

export function cycleState(tHours: number, tissue: Tissue = TISSUES[0]): CycleState {
  const T = tissue.cycleHours;
  const t = ((tHours % T) + T) % T;
  const { G1, S, G2 } = CYCLE_STAGES;
  const d = tissue.durations;
  const n2 = ONION_2N;
  if (t < G1) return { stage: 'G1', dnaC: 2, chromosomes: n2, chromatidsPerChromosome: 1, nuclei: 1 };
  if (t < G1 + S) return { stage: 'S', dnaC: 2 + 2 * ((t - G1) / S), chromosomes: n2, chromatidsPerChromosome: 1, nuclei: 1 };
  if (t < G1 + S + G2) return { stage: 'G2', dnaC: 4, chromosomes: n2, chromatidsPerChromosome: 2, nuclei: 1 };
  let m = t - (G1 + S + G2);
  if (m < d.profase) return { stage: 'profase', dnaC: 4, chromosomes: n2, chromatidsPerChromosome: 2, nuclei: 1 };
  m -= d.profase;
  if (m < d.metafase) return { stage: 'metafase', dnaC: 4, chromosomes: n2, chromatidsPerChromosome: 2, nuclei: 1 };
  m -= d.metafase;
  // En anafase las cromátidas separadas pasan a contarse como cromosomas independientes.
  if (m < d.anafase) return { stage: 'anafase', dnaC: 4, chromosomes: 2 * n2, chromatidsPerChromosome: 1, nuclei: 1 };
  return { stage: 'telofase', dnaC: 4, chromosomes: 2 * n2, chromatidsPerChromosome: 1, nuclei: 2 };
}

export const mitosisModelSpec: ModelSpec = {
  name: 'Ciclo celular, fases de la mitosis e índice mitótico',
  inputs: [
    { symbol: 'tejido', name: 'Tejido observado', unit: '—', initial: 'meristemo' },
    { symbol: 'N', name: 'Células en el campo', unit: 'células', range: MITOSIS_LIMITS.cells, initial: 100 },
    { symbol: 'E', name: 'Tiempo de exposición a colchicina', unit: 'h', range: MITOSIS_LIMITS.colchicine, initial: 0 },
    { symbol: 'semilla', name: 'Campo del microscopio (semilla)', unit: '—', initial: 1 },
    { symbol: 't', name: 'Tiempo dentro del ciclo', unit: 'h', range: [0, 18], initial: 0 },
  ],
  outputs: [
    { symbol: 'IM', name: 'Índice mitótico', unit: '%' },
    { symbol: 't_fase', name: 'Duración estimada de cada fase', unit: 'h' },
    { symbol: 'C', name: 'Contenido de ADN por célula', unit: 'valor C' },
    { symbol: '2n', name: 'Número de cromosomas', unit: 'cromosomas' },
  ],
  equations: [
    'Fracción en una fase ≈ duración de la fase / duración del ciclo (población asincrónica)',
    'IM = (profase + metafase + anafase + telofase) / N × 100',
    't_fase ≈ (n_fase / N) · T_ciclo',
    'ADN: 2C en G1 → aumenta linealmente en S → 4C en G2 y mitosis → 2C en cada célula hija',
    'Colchicina (E horas): metafase + E; anafase y telofase se vacían',
  ],
  initialConditions: ['Meristemo de raíz de cebolla, ciclo de 18 h, 100 células, sin colchicina.'],
  assumptions: [
    'Las células se dividen de forma independiente y asincrónica.',
    'Se usa una distribución uniforme de edades; en una población que crece exponencialmente hay algo más de células jóvenes (G1).',
    'Las duraciones de las fases son valores ilustrativos del orden de magnitud reportado para la cebolla; dependen de la temperatura y de la variedad.',
    'La colchicina detiene todas las células en metafase sin otros efectos.',
  ],
  limits: [
    'No representa la regulación del ciclo (puntos de control, ciclinas) ni la muerte celular.',
    'La identificación de fases en preparaciones reales es más difícil (planos de corte, tinción).',
    'Con pocas células observadas, la estimación de duraciones es muy variable.',
  ],
  testCases: [
    'Sin colchicina, el índice mitótico esperado del meristemo es 2/18 ≈ 11 %.',
    'La zona de elongación tiene un índice mitótico mucho menor.',
    'La colchicina aumenta la fracción en metafase y vacía anafase.',
    'El ADN se duplica en S (2C → 4C) y el número de cromosomas se duplica en anafase.',
    'Con más células contadas, el índice observado se acerca al esperado.',
  ],
};

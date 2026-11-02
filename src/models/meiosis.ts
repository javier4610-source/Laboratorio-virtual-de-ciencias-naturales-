import { seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Meiosis (grado 8.º): etapas, número de cromosomas y de ADN por célula, segregación independiente (2ⁿ combinaciones),
 * entrecruzamiento (frecuencia de recombinación r = distancia/100 cM, Morgan; válido para r ≤ 0,5) y no disyunción.
 *
 * Organismo modelo: 2n = 2, 4 o 6 (1 a 3 pares de homólogos). Par 1 con dos genes ligados A/a y B/b (en las posiciones
 * 0,25 y 0,75 del cromosoma); par 2 con el gen D/d; par 3 con el gen E/e (en el centro). El homólogo materno lleva los
 * alelos A, B, D, E y el paterno a, b, d, e. Una célula que hace meiosis produce 4 gametos haploides.
 * Este archivo no depende de React ni del navegador.
 */

export const STAGES = [
  { id: 'g1', name: 'Interfase (G1)', text: 'Los cromosomas están sin duplicar: cada uno es una sola cromátida.' },
  { id: 's', name: 'Interfase (S y G2)', text: 'El ADN se replica: cada cromosoma queda con dos cromátidas hermanas unidas por el centrómero.' },
  { id: 'profase1', name: 'Profase I', text: 'Los homólogos se aparean (sinapsis) y forman bivalentes; entre cromátidas no hermanas ocurre el entrecruzamiento (quiasma).' },
  { id: 'metafase1', name: 'Metafase I', text: 'Los bivalentes se alinean en el ecuador; la orientación de cada par es al azar (segregación independiente).' },
  { id: 'anafase1', name: 'Anafase I', text: 'Se separan los HOMÓLOGOS hacia polos opuestos; las cromátidas hermanas siguen unidas.' },
  { id: 'telofase1', name: 'Telofase I y citocinesis', text: 'Se forman dos células haploides (n), cada cromosoma todavía con dos cromátidas.' },
  { id: 'profase2', name: 'Profase II', text: 'En cada célula los cromosomas se condensan otra vez; no hay replicación del ADN.' },
  { id: 'metafase2', name: 'Metafase II', text: 'Los cromosomas se alinean en el ecuador de cada célula.' },
  { id: 'anafase2', name: 'Anafase II', text: 'Se separan las CROMÁTIDAS hermanas hacia polos opuestos.' },
  { id: 'telofase2', name: 'Telofase II y citocinesis', text: 'Resultan cuatro células haploides (gametos), genéticamente distintas.' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];

export interface StageCounts { cells: number; chromosomes: number; chromatids: number; dnaC: number; ploidy: '2n' | 'n' }
/** Cromosomas, cromátidas y cantidad de ADN (c = ADN de un juego haploide sin replicar) POR CÉLULA en cada etapa. */
export function stageCounts(stage: number, n2: number): StageCounts {
  const n = n2 / 2;
  if (!Number.isInteger(n) || n < 1) throw new RangeError('2n debe ser un número par positivo.');
  const id = STAGES[stage]?.id;
  switch (id) {
    case 'g1': return { cells: 1, chromosomes: n2, chromatids: n2, dnaC: 2, ploidy: '2n' };
    case 's': case 'profase1': case 'metafase1': case 'anafase1': return { cells: 1, chromosomes: n2, chromatids: 2 * n2, dnaC: 4, ploidy: '2n' };
    case 'telofase1': case 'profase2': case 'metafase2': return { cells: 2, chromosomes: n, chromatids: n2, dnaC: 2, ploidy: 'n' };
    case 'anafase2': return { cells: 2, chromosomes: n2, chromatids: n2, dnaC: 2, ploidy: 'n' };
    case 'telofase2': return { cells: 4, chromosomes: n, chromatids: n, dnaC: 1, ploidy: 'n' };
    default: throw new RangeError(`Etapa desconocida: ${stage}`);
  }
}
/** Mitosis de la misma célula: 2 células 2n idénticas, cada una con 2c. */
export const mitosisResult = (n2: number) => ({ cells: 2, chromosomes: n2, dnaC: 2, identical: true });

/** Combinaciones de cromosomas (sin entrecruzamiento) en los gametos: 2ⁿ. */
export const gameteCombinations = (n: number) => 2 ** n;
/** Cigotos distintos de una pareja solo por segregación independiente: (2ⁿ)². */
export const zygoteCombinations = (n: number) => (2 ** n) ** 2;

/* ------------------------------------------------------------------ cromátidas y una meiosis concreta */

export const LOCI: { pair: number; gene: string; pos: number }[] = [
  { pair: 0, gene: 'A', pos: 0.25 }, { pair: 0, gene: 'B', pos: 0.75 }, { pair: 1, gene: 'D', pos: 0.5 }, { pair: 2, gene: 'E', pos: 0.5 },
];
export type Origin = 'm' | 'p';
export interface Segment { from: number; to: number; origin: Origin }
export interface Chromatid { pair: number; homolog: Origin; sister: 0 | 1; segments: Segment[] }
export const alleleAt = (c: Chromatid, gene: string): string => {
  const l = LOCI.find((x) => x.gene === gene && x.pair === c.pair)!;
  const seg = c.segments.find((s) => l.pos >= s.from && l.pos < s.to) ?? c.segments[c.segments.length - 1];
  return seg.origin === 'm' ? gene : gene.toLowerCase();
};

export type Nondisjunction = 'ninguna' | 'meiosis1' | 'meiosis2';
export interface MeiosisConfig {
  pairs: 1 | 2 | 3;
  /** Posición (0–1) del entrecruzamiento en el par 1, entre la cromátida materna 1 y la paterna 0; null = sin entrecruzamiento. */
  crossover: number | null;
  /** Orientación en la metafase I de cada par: true = el materno va al polo izquierdo. */
  orientation: boolean[];
  nondisjunction: Nondisjunction;
}

/** Las cuatro cromátidas de cada par después de la replicación (y del entrecruzamiento, si lo hay). */
export function chromatidsOf(cfg: MeiosisConfig, afterCrossover: boolean): Chromatid[] {
  const out: Chromatid[] = [];
  for (let k = 0; k < cfg.pairs; k++) for (const h of ['m', 'p'] as Origin[]) for (const s of [0, 1] as const) {
    let segments: Segment[] = [{ from: 0, to: 1, origin: h }];
    const x = cfg.crossover;
    if (afterCrossover && k === 0 && x !== null && ((h === 'm' && s === 1) || (h === 'p' && s === 0))) {
      segments = [{ from: 0, to: x, origin: h }, { from: x, to: 1, origin: h === 'm' ? 'p' : 'm' }];
    }
    out.push({ pair: k, homolog: h, sister: s, segments });
  }
  return out;
}

export interface Gamete { index: number; chromatids: Chromatid[]; genotype: string; chromosomeCount: number; recombinant: boolean }
/**
 * Reparto de una meiosis concreta. Meiosis I: cada par va al polo izquierdo (célula 0) o derecho (célula 1) según su
 * orientación; con no disyunción en la meiosis I, el par 1 va entero a la célula 0. Meiosis II: la hermana 0 va al gameto
 * superior y la 1 al inferior; con no disyunción en la meiosis II, las dos hermanas del par 1 de la célula 0 van juntas.
 * Gametos: 0 y 1 vienen de la célula izquierda; 2 y 3, de la derecha.
 */
export function meiosisGametes(cfg: MeiosisConfig): Gamete[] {
  const chs = chromatidsOf(cfg, true);
  const cellOf = (c: Chromatid): 0 | 1 => {
    if (cfg.nondisjunction === 'meiosis1' && c.pair === 0) return 0;
    const left = cfg.orientation[c.pair] ? 'm' : 'p';
    return c.homolog === left ? 0 : 1;
  };
  const gametes: Chromatid[][] = [[], [], [], []];
  for (const c of chs) {
    const cell = cellOf(c);
    let g = cell * 2 + c.sister;
    if (cfg.nondisjunction === 'meiosis2' && c.pair === 0 && cell === 0) g = 0;
    if (cfg.nondisjunction === 'meiosis1' && c.pair === 0) g = c.sister; // gametos 0 y 1 reciben una cromátida de cada homólogo
    gametes[g].push(c);
  }
  return gametes.map((list, index) => {
    const genotype = Array.from({ length: cfg.pairs }, (_, k) => {
      const genes = LOCI.filter((l) => l.pair === k);
      return list.filter((c) => c.pair === k).map((c) => genes.map((l) => alleleAt(c, l.gene)).join('')).join('/') || '–';
    }).join(' ');
    const p0 = list.filter((c) => c.pair === 0);
    const recombinant = p0.length === 1 && (alleleAt(p0[0], 'A') === 'A') !== (alleleAt(p0[0], 'B') === 'B');
    return { index, chromatids: list, genotype, chromosomeCount: list.length, recombinant };
  });
}

/* ------------------------------------------------------------------ muchas meiosis: frecuencias de gametos */

export interface SampleResult { meioses: number; gametes: number; counts: Record<string, number>; expected: Record<string, number>; recombinantFraction: number }
/** Frecuencia esperada de cada gameto: par 1 parental (1 − r)/2, recombinante r/2; cada par no ligado, 1/2. */
export function expectedFrequencies(pairs: number, distanceCM: number): Record<string, number> {
  const r = Math.min(0.5, distanceCM / 100);
  let freq: Record<string, number> = { AB: (1 - r) / 2, ab: (1 - r) / 2, Ab: r / 2, aB: r / 2 };
  for (const g of ['D', 'E'].slice(0, pairs - 1)) {
    const next: Record<string, number> = {};
    for (const [k, f] of Object.entries(freq)) { next[`${k} ${g}`] = f / 2; next[`${k} ${g.toLowerCase()}`] = f / 2; }
    freq = next;
  }
  return Object.fromEntries(Object.entries(freq).filter(([, f]) => f > 0));
}

/** Simula `meioses` células con semilla: orientación al azar, entrecruzamiento entre A y B con probabilidad 2r y reparto
 * al azar de las cromátidas en la meiosis II. Devuelve el conteo de cada tipo de gameto. */
export function sampleGametes(pairs: 1 | 2 | 3, distanceCM: number, meioses: number, seed: number): SampleResult {
  const rand = seededRandom(seed);
  const r = Math.min(0.5, distanceCM / 100);
  const counts: Record<string, number> = {};
  let rec = 0;
  for (let i = 0; i < meioses; i++) {
    const cross = rand() < 2 * r;
    // posición del cruce entre los dos genes (0,25–0,75) y cromátidas no hermanas elegidas al azar
    const x = 0.25 + 0.5 * rand();
    const ms = rand() < 0.5 ? 0 : 1, ps = rand() < 0.5 ? 0 : 1;
    const orientation = Array.from({ length: pairs }, () => rand() < 0.5);
    const swapII = Array.from({ length: 2 * pairs }, () => rand() < 0.5);
    const chs: Chromatid[] = [];
    for (let k = 0; k < pairs; k++) for (const h of ['m', 'p'] as Origin[]) for (const s of [0, 1] as const) {
      const crossed = cross && k === 0 && ((h === 'm' && s === ms) || (h === 'p' && s === ps));
      chs.push({ pair: k, homolog: h, sister: s, segments: crossed ? [{ from: 0, to: x, origin: h }, { from: x, to: 1, origin: h === 'm' ? 'p' : 'm' }] : [{ from: 0, to: 1, origin: h }] });
    }
    const gam: Chromatid[][] = [[], [], [], []];
    for (const c of chs) {
      const cell = c.homolog === (orientation[c.pair] ? 'm' : 'p') ? 0 : 1;
      const s = swapII[cell * pairs + c.pair] ? 1 - c.sister : c.sister;
      gam[cell * 2 + s].push(c);
    }
    for (const g of gam) {
      const genes = LOCI.filter((l) => l.pair < pairs);
      const parts = [genes.slice(0, 2).map((l) => alleleAt(g.find((c) => c.pair === 0)!, l.gene)).join(''), ...genes.slice(2).map((l) => alleleAt(g.find((c) => c.pair === l.pair)!, l.gene))];
      const k = parts.join(' ');
      counts[k] = (counts[k] ?? 0) + 1;
      if (parts[0] === 'Ab' || parts[0] === 'aB') rec++;
    }
  }
  const total = meioses * 4;
  const exp = expectedFrequencies(pairs, distanceCM);
  return { meioses, gametes: total, counts, expected: Object.fromEntries(Object.entries(exp).map(([k, f]) => [k, f * total])), recombinantFraction: rec / total };
}

export interface MeiosisCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function meiosisConditions(cfg: MeiosisConfig, distanceCM: number): MeiosisCondition[] {
  const out: MeiosisCondition[] = [];
  if (cfg.nondisjunction !== 'ninguna') out.push({ level: 'advertencia', text: `No disyunción en la ${cfg.nondisjunction === 'meiosis1' ? 'meiosis I (los homólogos del par 1 no se separan)' : 'meiosis II (las cromátidas hermanas del par 1 no se separan en una célula)'}: resultan gametos con un cromosoma de más (n + 1) o de menos (n − 1). Si uno de ellos se une a un gameto normal, el cigoto tiene 2n + 1 (trisomía) o 2n − 1 (monosomía).`,
    fix: 'Para ver una meiosis normal elige «Sin no disyunción».' });
  if (distanceCM > 50) out.push({ level: 'invalido', text: 'Una frecuencia de recombinación no puede pasar del 50 %: genes muy lejanos se comportan como si estuvieran en cromosomas distintos.', fix: 'Usa una distancia entre 0 y 50 cM.' });
  if (cfg.crossover !== null && (cfg.crossover < 0.25 || cfg.crossover > 0.75)) out.push({ level: 'nota', text: `El entrecruzamiento ocurrió ${cfg.crossover < 0.25 ? 'antes del gen A' : 'después del gen B'}: intercambia segmentos, pero no cambia la combinación de los alelos A y B.`, fix: 'Mueve el punto de cruce entre los genes A y B (0,25 a 0,75) para obtener gametos recombinantes Ab y aB.' });
  return out;
}

export const meiosisSpec: ModelSpec = {
  name: 'Meiosis: etapas, segregación independiente (2ⁿ), entrecruzamiento (Morgan) y no disyunción',
  inputs: [
    { symbol: '2n', name: 'Número de cromosomas de la célula (1 a 3 pares de homólogos)', unit: '—', range: [2, 6], initial: 4 },
    { symbol: 'x', name: 'Punto de entrecruzamiento en el par 1 (fracción del cromosoma)', unit: '—', range: [0.05, 0.95], initial: 0.5 },
    { symbol: 'orientación', name: 'Orientación de cada bivalente en la metafase I', unit: '—', initial: 'materno a la izquierda' },
    { symbol: 'd', name: 'Distancia entre los genes A y B', unit: 'cM', range: [0, 50], initial: 20 },
    { symbol: 'N', name: 'Células que hacen meiosis (muestreo)', unit: '—', range: [10, 1000], initial: 100 },
  ],
  outputs: [
    { symbol: 'cromosomas, ADN', name: 'Cromosomas, cromátidas y cantidad de ADN por célula en cada etapa', unit: '—' },
    { symbol: 'gametos', name: 'Genotipo de los cuatro gametos de una meiosis', unit: '—' },
    { symbol: 'frecuencias', name: 'Frecuencias de los tipos de gametos en N meiosis (observadas y esperadas)', unit: '—' },
  ],
  equations: [
    'Combinaciones por segregación independiente: 2ⁿ (n = número de pares); humano: 2²³ = 8 388 608',
    'Gametos recombinantes del par 1: r = d/100 (1 cM = 1 % de recombinación; r ≤ 0,5)',
    'Un entrecruzamiento afecta a 2 de las 4 cromátidas: probabilidad de cruce entre A y B = 2r',
    'ADN por célula: G1 2c → tras S 4c → tras la meiosis I 2c → gametos 1c',
  ],
  initialConditions: [
    'Célula diploide heterocigota: homólogos maternos A B / D / E y paternos a b / d / e.',
    'Muestreo con semilla reproducible: la misma semilla da los mismos gametos.',
  ],
  assumptions: [
    'Como máximo un entrecruzamiento entre A y B por meiosis (sin dobles cruces) y sin interferencia.',
    'La orientación de cada bivalente y el reparto de las cromátidas en la meiosis II son al azar (probabilidad 1/2).',
    'Los genes D y E están en cromosomas distintos del par 1 (segregan de forma independiente).',
  ],
  limits: [
    'Para distancias grandes la frecuencia de recombinación no crece linealmente (dobles cruces): la relación r = d/100 vale para distancias pequeñas.',
    'Los cromosomas 3D son dibujos sin escala; los organismos reales tienen muchos más cromosomas y entrecruzamientos.',
    'La no disyunción se muestra solo en el par 1 y no se calcula su frecuencia real (que aumenta, por ejemplo, con la edad materna).',
  ],
  testCases: [
    '2n = 4: G1 4 cromosomas y 2c; tras la meiosis I, 2 células con 2 cromosomas (4 cromátidas) y 2c; al final, 4 gametos con 2 cromosomas y 1c.',
    'n = 23 (humano): 2²³ = 8 388 608 combinaciones de gametos; (2²³)² ≈ 7,04 × 10¹³ cigotos posibles.',
    'd = 20 cM: gametos AB y ab 40 % cada uno, Ab y aB 10 % cada uno.',
  ],
};

import { chiSquarePValue, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Herencia mendeliana (grado 8.º): cruces monohíbridos y dihíbridos.
 * Supone segregación de alelos (1.ª ley) y transmisión independiente de genes
 * ubicados en cromosomas distintos (2.ª ley), sin ligamiento ni mutación.
 */

export type Dominance = 'completa' | 'incompleta';

export interface Gene {
  id: string;
  trait: string;
  dominant: string; // símbolo del alelo dominante, p. ej. "Y"
  recessive: string; // p. ej. "y"
  dominantPhenotype: string;
  recessivePhenotype: string;
  heterozygotePhenotype?: string; // solo para dominancia incompleta
  dominance: Dominance;
}

export interface Organism {
  id: string;
  name: string;
  scientificName: string;
  genes: Gene[];
}

export const ORGANISMS: Organism[] = [
  {
    id: 'guisante',
    name: 'Guisante (arveja)',
    scientificName: 'Pisum sativum',
    genes: [
      { id: 'color', trait: 'Color de la semilla', dominant: 'Y', recessive: 'y', dominantPhenotype: 'amarilla', recessivePhenotype: 'verde', dominance: 'completa' },
      { id: 'forma', trait: 'Forma de la semilla', dominant: 'R', recessive: 'r', dominantPhenotype: 'lisa', recessivePhenotype: 'rugosa', dominance: 'completa' },
      { id: 'flor', trait: 'Color de la flor', dominant: 'P', recessive: 'p', dominantPhenotype: 'púrpura', recessivePhenotype: 'blanca', dominance: 'completa' },
    ],
  },
  {
    id: 'boca-dragon',
    name: 'Boca de dragón',
    scientificName: 'Antirrhinum majus',
    genes: [
      { id: 'color-flor', trait: 'Color de la flor', dominant: 'R', recessive: 'r', dominantPhenotype: 'roja', recessivePhenotype: 'blanca', heterozygotePhenotype: 'rosada', dominance: 'incompleta' },
      { id: 'hoja', trait: 'Forma de la hoja', dominant: 'H', recessive: 'h', dominantPhenotype: 'ancha', recessivePhenotype: 'angosta', dominance: 'completa' },
    ],
  },
];

export function findOrganism(id: string): Organism {
  const o = ORGANISMS.find((x) => x.id === id);
  if (!o) throw new Error(`Organismo desconocido: ${id}`);
  return o;
}

/** Genotipo de un gen: dos alelos, normalizados con el dominante primero ("Yy", nunca "yY"). */
export function normalizePair(pair: string, gene: Gene): string {
  if (pair.length !== 2) throw new Error(`El genotipo de ${gene.trait} debe tener dos alelos.`);
  for (const a of pair) {
    if (a !== gene.dominant && a !== gene.recessive) {
      throw new Error(`Alelo "${a}" no válido para ${gene.trait}; usa ${gene.dominant} o ${gene.recessive}.`);
    }
  }
  const dom = [...pair].filter((a) => a === gene.dominant).length;
  return gene.dominant.repeat(dom) + gene.recessive.repeat(2 - dom);
}

export type Genotype = string[]; // un par de alelos por gen, en el orden de `genes`

export function genotypeLabel(g: Genotype): string {
  return g.join('');
}

export function phenotypeOfGene(pair: string, gene: Gene): string {
  const dom = [...pair].filter((a) => a === gene.dominant).length;
  if (dom === 2) return gene.dominantPhenotype;
  if (dom === 0) return gene.recessivePhenotype;
  return gene.dominance === 'incompleta' && gene.heterozygotePhenotype ? gene.heterozygotePhenotype : gene.dominantPhenotype;
}

export function phenotype(g: Genotype, genes: Gene[]): string {
  return genes.map((gene, i) => phenotypeOfGene(g[i], gene)).join(', ');
}

/** Gametos posibles con su probabilidad (transmisión independiente). */
export function gametes(g: Genotype): { gamete: string; p: number }[] {
  let result: { gamete: string; p: number }[] = [{ gamete: '', p: 1 }];
  for (const pair of g) {
    const next: { gamete: string; p: number }[] = [];
    for (const r of result) {
      for (const allele of [pair[0], pair[1]]) {
        const key = r.gamete + allele;
        const existing = next.find((x) => x.gamete === key);
        if (existing) existing.p += r.p / 2;
        else next.push({ gamete: key, p: r.p / 2 });
      }
    }
    result = next;
  }
  return result;
}

/** Gametos sin fusionar duplicados: filas/columnas del cuadro de Punnett (2ⁿ gametos). */
export function punnettGametes(g: Genotype): string[] {
  let result = [''];
  for (const pair of g) result = result.flatMap((r) => [r + pair[0], r + pair[1]]);
  return result;
}

export function fuse(g1: string, g2: string, genes: Gene[]): Genotype {
  return genes.map((gene, i) => normalizePair(g1[i] + g2[i], gene));
}

export interface PunnettSquare {
  rows: string[];
  cols: string[];
  cells: Genotype[][];
}

export function punnettSquare(p1: Genotype, p2: Genotype, genes: Gene[]): PunnettSquare {
  const rows = punnettGametes(p1);
  const cols = punnettGametes(p2);
  return { rows, cols, cells: rows.map((r) => cols.map((c) => fuse(r, c, genes))) };
}

export interface Category { key: string; probability: number; }

export function genotypeDistribution(p1: Genotype, p2: Genotype, genes: Gene[]): Category[] {
  const map = new Map<string, number>();
  for (const a of gametes(p1)) for (const b of gametes(p2)) {
    const key = genotypeLabel(fuse(a.gamete, b.gamete, genes));
    map.set(key, (map.get(key) ?? 0) + a.p * b.p);
  }
  return [...map.entries()].map(([key, probability]) => ({ key, probability })).sort((x, y) => y.probability - x.probability || x.key.localeCompare(y.key));
}

export function phenotypeDistribution(p1: Genotype, p2: Genotype, genes: Gene[]): Category[] {
  const map = new Map<string, number>();
  for (const a of gametes(p1)) for (const b of gametes(p2)) {
    const key = phenotype(fuse(a.gamete, b.gamete, genes), genes);
    map.set(key, (map.get(key) ?? 0) + a.p * b.p);
  }
  return [...map.entries()].map(([key, probability]) => ({ key, probability })).sort((x, y) => y.probability - x.probability || x.key.localeCompare(y.key));
}

/** Expresa probabilidades como proporción entera mínima (p. ej. 9:3:3:1). */
export function ratioString(cats: Category[]): string {
  const denom = 64; // suficiente para hasta 3 genes
  const ints = cats.map((c) => Math.round(c.probability * denom));
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = ints.reduce((acc, v) => gcd(acc, v), 0) || 1;
  return ints.map((v) => v / g).join(' : ');
}

/**
 * Simula N descendientes: cada progenitor aporta un gameto al azar.
 * El azar aquí tiene justificación biológica (segregación aleatoria en la meiosis
 * y fecundación al azar). La semilla hace el resultado reproducible.
 */
export function sampleOffspring(p1: Genotype, p2: Genotype, genes: Gene[], n: number, seed: number): Map<string, number> {
  if (!Number.isInteger(n) || n < 1 || n > 100000) throw new RangeError('El número de descendientes debe ser un entero entre 1 y 100 000.');
  const rand = seededRandom(seed);
  const counts = new Map<string, number>();
  for (const cat of phenotypeDistribution(p1, p2, genes)) counts.set(cat.key, 0);
  for (let i = 0; i < n; i++) {
    const child = genes.map((gene, gi) => {
      const a = p1[gi][rand() < 0.5 ? 0 : 1];
      const b = p2[gi][rand() < 0.5 ? 0 : 1];
      return normalizePair(a + b, gene);
    });
    const key = phenotype(child, genes);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export interface ChiSquareResult {
  chi2: number;
  df: number;
  pValue: number;
  rows: { key: string; observed: number; expected: number; contribution: number }[];
  consistent: boolean; // p ≥ 0,05
}

export function chiSquareTest(observed: Map<string, number>, expected: Category[]): ChiSquareResult {
  const total = [...observed.values()].reduce((a, b) => a + b, 0);
  const rows = expected.map((cat) => {
    const o = observed.get(cat.key) ?? 0;
    const e = cat.probability * total;
    return { key: cat.key, observed: o, expected: e, contribution: e > 0 ? (o - e) ** 2 / e : 0 };
  });
  const chi2 = rows.reduce((a, r) => a + r.contribution, 0);
  const df = Math.max(1, expected.length - 1);
  const pValue = expected.length > 1 ? chiSquarePValue(chi2, df) : 1;
  return { chi2, df, pValue, rows, consistent: pValue >= 0.05 };
}

/** Datos históricos publicados por Mendel (1866), ampliamente reproducidos en textos de genética. */
export const MENDEL_HISTORICAL = {
  monohybridShape: { lisa: 5474, rugosa: 1850 },
  dihybrid: { 'amarilla, lisa': 315, 'verde, lisa': 108, 'amarilla, rugosa': 101, 'verde, rugosa': 32 },
};

export const mendelModelSpec: ModelSpec = {
  name: 'Herencia mendeliana: segregación y transmisión independiente',
  inputs: [
    { symbol: 'organismo', name: 'Organismo y características', unit: '—', initial: 'guisante' },
    { symbol: 'G₁, G₂', name: 'Genotipos de los progenitores', unit: '—', initial: 'Yy × Yy' },
    { symbol: 'N', name: 'Número de descendientes simulados', unit: 'individuos', range: [1, 10000], initial: 100 },
    { symbol: 'semilla', name: 'Semilla del generador aleatorio', unit: '—', initial: 1 },
  ],
  outputs: [
    { symbol: 'P(genotipo)', name: 'Probabilidades esperadas de genotipos y fenotipos', unit: 'fracción' },
    { symbol: 'O', name: 'Frecuencias observadas en la descendencia simulada', unit: 'individuos' },
    { symbol: 'χ²', name: 'Estadístico chi-cuadrado y valor p', unit: '—' },
  ],
  equations: [
    'Cada progenitor heterocigoto produce gametos A y a con probabilidad 1/2 (segregación).',
    'P(gameto con varios genes) = producto de las probabilidades de cada gen (transmisión independiente).',
    'P(hijo) = P(gameto 1) × P(gameto 2) (fecundación al azar).',
    'χ² = Σ (O − E)² / E,  gl = número de categorías − 1.',
  ],
  initialConditions: ['Cruce F1 × F1 (Yy × Yy) de guisante.', 'Semilla aleatoria = 1 (resultados reproducibles).'],
  assumptions: [
    'Cada característica depende de un único gen con dos alelos.',
    'Los genes se encuentran en cromosomas distintos (sin ligamiento).',
    'Todos los cigotos sobreviven por igual (sin selección ni letalidad).',
    'Dominancia completa, salvo el color de la flor en boca de dragón (dominancia incompleta).',
  ],
  limits: [
    'La mayoría de las características humanas y de interés agrícola son poligénicas y dependen del ambiente.',
    'No se modelan ligamiento, recombinación, mutación, epistasis, ni alelos múltiples.',
    'El valor p es una herramienta estadística: un p alto no "demuestra" la hipótesis, solo indica que los datos son compatibles con ella.',
  ],
  testCases: [
    'Yy × Yy → genotipos 1:2:1 y fenotipos 3:1.',
    'YyRr × YyRr → fenotipos 9:3:3:1 (16 casillas en el cuadro de Punnett).',
    'Yy × yy → 1:1 (cruce de prueba).',
    'Rr × Rr en boca de dragón → roja : rosada : blanca = 1:2:1.',
    'Con N grande, las proporciones observadas se acercan a las esperadas; la misma semilla reproduce el mismo resultado.',
    'χ² de los datos históricos de Mendel (5474:1850) es compatible con 3:1.',
  ],
};

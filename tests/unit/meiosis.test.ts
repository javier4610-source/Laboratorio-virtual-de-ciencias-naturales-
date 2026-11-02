import { describe, expect, it } from 'vitest';
import {
  chromatidsOf, expectedFrequencies, gameteCombinations, meiosisConditions, meiosisGametes, mitosisResult, sampleGametes, STAGES, stageCounts,
  zygoteCombinations, type MeiosisConfig,
} from '../../src/models/meiosis';

const base: MeiosisConfig = { pairs: 2, crossover: null, orientation: [true, true], nondisjunction: 'ninguna' };

describe('etapas: cromosomas y ADN por célula', () => {
  it('2n = 4 de G1 a los gametos', () => {
    expect(STAGES).toHaveLength(10);
    expect(stageCounts(0, 4)).toEqual({ cells: 1, chromosomes: 4, chromatids: 4, dnaC: 2, ploidy: '2n' });
    expect(stageCounts(3, 4)).toMatchObject({ chromosomes: 4, chromatids: 8, dnaC: 4 });
    expect(stageCounts(5, 4)).toEqual({ cells: 2, chromosomes: 2, chromatids: 4, dnaC: 2, ploidy: 'n' });
    expect(stageCounts(8, 4)).toMatchObject({ cells: 2, chromosomes: 4, chromatids: 4 });
    expect(stageCounts(9, 4)).toEqual({ cells: 4, chromosomes: 2, chromatids: 2, dnaC: 1, ploidy: 'n' });
    expect(stageCounts(5, 46)).toMatchObject({ chromosomes: 23, chromatids: 46 });
    expect(mitosisResult(46)).toMatchObject({ cells: 2, chromosomes: 46, dnaC: 2 });
  });
  it('2ⁿ combinaciones: humano 8 388 608 gametos y ≈ 7,04 × 10¹³ cigotos', () => {
    expect(gameteCombinations(23)).toBe(8388608);
    expect(zygoteCombinations(23) / 1e13).toBeCloseTo(7.0369, 3);
  });
});

describe('una meiosis concreta', () => {
  it('sin entrecruzamiento: gametos parentales y la orientación decide las combinaciones', () => {
    const g = meiosisGametes(base);
    expect(g.map((x) => x.genotype)).toEqual(['AB D', 'AB D', 'ab d', 'ab d']);
    const g2 = meiosisGametes({ ...base, orientation: [true, false] });
    expect(g2.map((x) => x.genotype)).toEqual(['AB d', 'AB d', 'ab D', 'ab D']);
    expect(g.every((x) => x.chromosomeCount === 2 && !x.recombinant)).toBe(true);
  });
  it('un cruce entre A y B da 2 gametos recombinantes de 4; fuera de ese tramo, ninguno', () => {
    const g = meiosisGametes({ ...base, crossover: 0.5 });
    expect(g.map((x) => x.genotype)).toEqual(['AB D', 'Ab D', 'aB d', 'ab d']);
    expect(g.filter((x) => x.recombinant)).toHaveLength(2);
    expect(meiosisGametes({ ...base, crossover: 0.1 }).filter((x) => x.recombinant)).toHaveLength(0);
    expect(chromatidsOf({ ...base, crossover: 0.5 }, false).every((c) => c.segments.length === 1)).toBe(true);
    expect(meiosisConditions({ ...base, crossover: 0.9 }, 20)[0].level).toBe('nota');
  });
  it('no disyunción: n + 1 y n − 1', () => {
    expect(meiosisGametes({ ...base, nondisjunction: 'meiosis1' }).map((x) => x.chromosomeCount)).toEqual([3, 3, 1, 1]);
    expect(meiosisGametes({ ...base, nondisjunction: 'meiosis2' }).map((x) => x.chromosomeCount)).toEqual([3, 1, 2, 2]);
    expect(meiosisConditions({ ...base, nondisjunction: 'meiosis1' }, 20)[0].text).toContain('trisomía');
  });
});

describe('muchas meiosis', () => {
  it('frecuencias esperadas con d = 20 cM', () => {
    expect(expectedFrequencies(1, 20)).toEqual({ AB: 0.4, ab: 0.4, Ab: 0.1, aB: 0.1 });
    const e = expectedFrequencies(3, 20);
    expect(Object.keys(e)).toHaveLength(16);
    expect(Object.values(e).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it('la muestra reproduce r ≈ d/100 y la segregación independiente, y es reproducible', () => {
    const s = sampleGametes(2, 20, 5000, 11);
    expect(s.gametes).toBe(20000);
    expect(Math.abs(s.recombinantFraction - 0.2)).toBeLessThan(0.015);
    expect(Math.abs(s.counts['AB D'] / s.expected['AB D'] - 1)).toBeLessThan(0.06);
    expect(sampleGametes(2, 20, 50, 3)).toEqual(sampleGametes(2, 20, 50, 3));
    expect(sampleGametes(1, 0, 200, 1).recombinantFraction).toBe(0);
    expect(meiosisConditions(base, 60).some((c) => c.level === 'invalido')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { solvePH } from '../../src/models/acidbase';
import { alphas, hydroxide2Solubility, KSP, mixturePHGeneral, SOLUTES } from '../../src/models/aqueousEquilibria';
import { burn, dissolve, litmus, molar, phenolphthalein, substanceById, SUBSTANCES, universal } from '../../src/models/oxidesHydroxides';
import { equivalenceVolumes, neutralization, saltSolution, titrationCurve, titrationPH, hydracidSolution } from '../../src/models/acidsSalts';

describe('equilibrios ácido-base generales (reutilizan acidbase.ts)', () => {
  it('coincide con solvePH de acidbase.ts para un ácido monoprótico con NaOH', () => {
    for (const [ca, cb, ka] of [[0.1, 0, null], [0.1, 0.05, 1.8e-5], [0.01, 0.0099, 1.8e-5], [1e-8, 0, null], [0.05, 0.08, null]] as [number, number, number | null][]) {
      expect(mixturePHGeneral({ solutes: [{ c: ca, ka: [ka] }], cations: cb })).toBeCloseTo(solvePH(ca, cb, ka), 8);
    }
  });
  it('las fracciones α suman 1 y el pH de referencia del prompt (9.2) se reproduce', () => {
    const a = alphas([1e-2, 1e-7], 1e-5);
    expect(a.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
    expect(mixturePHGeneral({ solutes: [SOLUTES.HCl(0.1)] })).toBeCloseTo(1.0, 2);
    expect(mixturePHGeneral({ solutes: [SOLUTES.CH3COOH(0.1)] })).toBeCloseTo(2.87, 1);
  });
  it('anfolitos: NaHCO₃ ≈ (pKa₁ + pKa₂)/2 y KH₂PO₄ ≈ (pKa₁ + pKa₂)/2', () => {
    expect(saltSolution('nahco3', 0.1).pH).toBeCloseTo((6.351 + 10.329) / 2, 1);
    expect(saltSolution('kh2po4', 0.1).pH).toBeCloseTo((2.148 + 7.198) / 2, 0);
  });
});

describe('óxidos e hidróxidos', () => {
  it('2 Mg + O₂ → 2 MgO: m(MgO)/m(Mg) = 40,304/24,305 y 0,50 g → 0,83 g', () => {
    const r = burn('mg', 0.5);
    expect(r.ratio).toBeCloseTo(40.304 / 24.305, 6);
    expect(r.massReading).toBe(0.83);
    expect(r.equation).toBe('2 Mg + O₂ → 2 MgO');
    expect(r.oxide.names.stock).toBe('óxido de magnesio');
    expect(r.oxide.fn).toBe('oxido-basico');
  });
  it('conservación de la masa: m(óxido) = m(metal) + m(O₂) consumido', () => {
    for (const s of SUBSTANCES.filter((x) => x.burn)) {
      const r = burn(s.id, 1);
      const o2 = (r.molesElement * s.burn!.o2 / s.burn!.el) * molar('O2');
      expect(r.massOxide, s.id).toBeCloseTo(1 + o2, 9);
    }
  });
  it('óxidos básicos dan disoluciones básicas; óxidos ácidos, ácidas; insolubles, neutras', () => {
    const mg = dissolve('mg', burn('mg', 0.5).molesOxide, 100);
    const sat = hydroxide2Solubility(KSP.MgOH2);
    expect(mg.limitedBy).toBe('Kps');
    expect(mg.pH).toBeCloseTo(14 + Math.log10(2 * sat), 3);
    expect(mg.pHReading).toBe(10.35);
    expect(mg.product?.names.stock).toBe('hidróxido de magnesio');
    expect(dissolve('ca', burn('ca', 0.5).molesOxide, 100).pHReading).toBe(12.33);
    const na = dissolve('na2o', 0.31 / molar('Na2O'), 100);
    expect(na.pHReading).toBe(13);
    expect(na.character).toBe('básico');
    expect(dissolve('s', burn('s', 0.2).molesOxide, 100).character).toBe('ácido');
    expect(dissolve('p', burn('p', 0.2).molesOxide, 100).product?.formula).toBe('H3PO4');
    const co2 = dissolve('c', burn('c', 0.5).molesOxide, 100);
    expect(co2.limitedBy).toBe('Henry');
    expect(co2.pH).toBeGreaterThan(3.5);
    expect(co2.pH).toBeLessThan(4.5);
    expect(dissolve('cu', burn('cu', 0.5).molesOxide, 100).pH).toBe(7);
    expect(dissolve('fe2o3', 0.01, 100).character).toBe('neutro');
  });
  it('indicadores: fenolftaleína incolora en ácido y fucsia en base; tornasol rojo/azul; universal verde en 7', () => {
    expect(phenolphthalein(3).text).toBe('incolora');
    expect(phenolphthalein(12).text).toBe('fucsia');
    expect(litmus(3).text).toBe('papel rojo');
    expect(litmus(11).text).toBe('papel azul');
    expect(universal(7).text).toBe('verde');
  });
  it('valida entradas', () => {
    expect(() => burn('mg', 5)).toThrow();
    expect(() => burn('na2o', 0.5)).toThrow();
    expect(() => dissolve('mg', 0.01, 10)).toThrow();
    expect(substanceById('s').note).toMatch(/SO₃/);
  });
});

describe('ácidos y sales', () => {
  it('titulación HCl 0,100 M + NaOH 0,100 M: pH 1,00 al inicio y 7,00 en la equivalencia (25,00 mL)', () => {
    expect(titrationPH('hcl', 0.1, 25, 0.1, 0)).toBeCloseTo(1, 2);
    expect(titrationPH('hcl', 0.1, 25, 0.1, 25)).toBeCloseTo(7, 2);
    expect(equivalenceVolumes('hcl', 0.1, 25, 0.1)).toEqual([25]);
    expect(titrationPH('hno3', 0.1, 25, 0.1, 25)).toBeCloseTo(7, 2);
  });
  it('H₂SO₄ diprótico: dos equivalencias y pH básico pasada la segunda', () => {
    expect(equivalenceVolumes('h2so4', 0.05, 25, 0.1)).toEqual([12.5, 25]);
    expect(titrationPH('h2so4', 0.05, 25, 0.1, 60)).toBeGreaterThan(11);
    const curve = titrationCurve('h3po4', 0.05, 25, 0.1, 50, 50);
    for (let i = 1; i < curve.length; i++) expect(curve[i].pH).toBeGreaterThanOrEqual(curve[i - 1].pH - 1e-9);
  });
  it('neutralización: sal formada con sus nombres', () => {
    expect(neutralization('h2so4').salt.names.stock).toBe('sulfato de sodio');
    expect(neutralization('h2so4').equation).toBe('H₂SO₄ + 2 NaOH → Na₂SO₄ + 2 H₂O');
    expect(neutralization('hcl').salt.formula).toBe('NaCl');
  });
  it('sales: neutras, ácidas y básicas (una «sal ácida» puede dar disolución básica)', () => {
    expect(saltSolution('nacl', 0.1).pHReading).toBe(7);
    expect(saltSolution('nh4cl', 0.1).pH).toBeCloseTo(5.12, 1);
    expect(saltSolution('ch3coona', 0.1).pH).toBeCloseTo(8.87, 1);
    expect(saltSolution('na2co3', 0.1).character).toBe('básica');
    expect(saltSolution('nahco3', 0.1).character).toBe('básica');
    expect(saltSolution('nahco3', 0.1).saltClass).toMatch(/sal ácida/);
    expect(saltSolution('nahso4', 0.1).character).toBe('ácida');
    expect(hydracidSolution(0.01, 100)).toBeCloseTo(1, 2);
  });
});

import { buildReactionScene, checkBalanced, countsAt } from '../../src/chem';
import { INORGANIC_REACTION_IDS, inorganicReaction } from '../../src/labs/inorganicReactions3d';

describe('reacciones 3D de las prácticas inorgánicas', () => {
  it('todas están balanceadas y conservan los átomos en todo t', () => {
    for (const id of INORGANIC_REACTION_IDS) {
      const def = inorganicReaction(id);
      expect(checkBalanced(def).balanced, id).toBe(true);
      const s = buildReactionScene(def);
      for (const t of [0, 0.5, 1]) expect(countsAt(s, t), id).toEqual(s.counts);
    }
  });
});

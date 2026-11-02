import { describe, expect, it } from 'vitest';
import {
  aufbauConfiguration, compareElements, configText, groupMembers, PERIODIC, periodicElement, periodMembers, propertyRange, slaterZeff, trend,
} from '../../src/models/periodicTrends';
import {
  checkLewis, classifyBond, inferStructure, ionicCharacter, LEWIS, moleculePolarity, runTest, SUBSTANCES, substanceById, valenceElectrons,
} from '../../src/models/chemicalBonding';
import { moleculeSpecies } from '../../src/chem';
import DATA from '../../src/data/quimica/tabla-periodica-pubchem.json';

describe('tabla periódica con datos reales (PubChem y Pyykkö)', () => {
  it('118 elementos con la procedencia y los valores de PubChem', () => {
    expect(PERIODIC).toHaveLength(118);
    const na = periodicElement('Na'), cl = periodicElement('Cl'), f = periodicElement('F');
    expect(na.en).toBe(0.93); expect(na.ei).toBe(5.139);
    expect(cl.en).toBe(3.16); expect(cl.ei).toBe(12.968);
    expect(f.en).toBe(3.98);
    expect(Math.max(...PERIODIC.map((e) => e.en ?? 0))).toBe(3.98);
    expect(periodicElement('He').en).toBeNull(); // PubChem no da χ del helio: no se inventa
    expect(periodicElement('Na').radioCov).toBe(155); // Pyykkö: 1,55 Å
    expect((DATA as { fecha: string }).fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('configuración por Madelung y Z_ef de Slater de manual', () => {
    expect(configText(aufbauConfiguration(17))).toBe('1s² 2s² 2p⁶ 3s² 3p⁵');
    expect(slaterZeff(11).zef).toBeCloseTo(2.2, 10);
    expect(slaterZeff(17).zef).toBeCloseTo(6.1, 10);
    expect(slaterZeff(19).zef).toBeCloseTo(2.2, 10);
    expect(slaterZeff(35).zef).toBeCloseTo(7.6, 10);
    expect(slaterZeff(8).zef).toBeCloseTo(4.55, 10);
    expect(slaterZeff(1).zef).toBeCloseTo(1, 10);
    expect(slaterZeff(2).zef).toBeCloseTo(1.7, 10);
    expect(() => slaterZeff(26)).toThrow(RangeError);
    expect(periodicElement('Fe').zef).toBeNull();
  });
  it('tendencias: en el período 3 el radio baja y la EI₁ y Z_ef suben; en el grupo 1 el radio sube y la EI₁ baja', () => {
    const p3 = periodMembers(3);
    expect(p3.map((e) => e.sym)).toEqual(['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar']);
    expect(trend(p3, 'radioCov').direction).toBe('disminuye');
    const ei = trend(p3, 'ei');
    expect(ei.direction).toBe('aumenta');
    expect(ei.exceptions).toEqual(['Mg → Al', 'P → S']); // excepciones reales de la EI₁
    expect(trend(p3, 'zef').direction).toBe('aumenta');
    const g1 = groupMembers(1).filter((e) => e.sym !== 'H');
    expect(trend(g1, 'radioCov').direction).toBe('aumenta');
    expect(trend(g1, 'ei').direction).toBe('disminuye');
    expect(trend(groupMembers(17), 'en').direction).toBe('disminuye');
    expect(compareElements('Na', 'Cl', 'radioCov').larger).toBe('Na');
    expect(propertyRange('en')).toEqual({ min: 0.7, max: 3.98 });
  });
});

describe('enlace químico', () => {
  it('clasifica por ΔEN con la convención de manual (y el HF sigue siendo covalente)', () => {
    const nacl = classifyBond('Na', 'Cl');
    expect(nacl.dEN).toBe(2.23); expect(nacl.type).toBe('iónico'); expect(nacl.negative).toBe('Cl');
    expect(nacl.ionicPct).toBeCloseTo(100 * (1 - Math.exp(-(2.23 ** 2) / 4)), 10);
    expect(classifyBond('H', 'Cl')).toMatchObject({ dEN: 0.96, type: 'covalente polar' });
    expect(classifyBond('H', 'H')).toMatchObject({ dEN: 0, type: 'covalente no polar' });
    expect(classifyBond('C', 'H').type).toBe('covalente no polar');
    expect(classifyBond('H', 'F')).toMatchObject({ dEN: 1.78, type: 'covalente polar' });
    expect(classifyBond('Cu', 'Zn').type).toBe('metálico');
    expect(classifyBond('Al', 'Cl').type).toBe('covalente polar');
    expect(ionicCharacter(0)).toBe(0);
  });
  it('estructuras de Lewis: electrones de valencia y octeto (dueto en el H)', () => {
    expect(valenceElectrons('O')).toBe(6); expect(valenceElectrons('Na')).toBe(1); expect(valenceElectrons('Cl')).toBe(7);
    const tot: Record<string, number> = { h2: 2, cl2: 14, hcl: 8, h2o: 8, co2: 16, nh3: 8, ch4: 8 };
    for (const m of LEWIS) {
      const c = checkLewis(m);
      expect(c.ok, m.id).toBe(true);
      expect(c.valenceTotal, m.id).toBe(tot[m.id]);
    }
    expect(checkLewis(LEWIS.find((m) => m.id === 'co2')!)).toMatchObject({ bondingPairs: 4, lonePairs: 4 });
    // una estructura mal dibujada (CO₂ con enlaces sencillos) no cumple el octeto
    const bad = { ...LEWIS.find((m) => m.id === 'co2')!, bonds: [{ a: 0, b: 1, order: 1 as const }, { a: 0, b: 2, order: 1 as const }] };
    expect(checkLewis(bad).ok).toBe(false);
  });
  it('polaridad sobre la geometría 3D del kit: H₂O, NH₃ y HCl polares; CO₂, CH₄, H₂ y Cl₂ no polares', () => {
    const polar: Record<string, boolean> = { h2: false, cl2: false, hcl: true, h2o: true, co2: false, nh3: true, ch4: false };
    for (const m of LEWIS) {
      const s = moleculeSpecies(m.speciesId);
      const r = moleculePolarity(s.atoms, s.bonds);
      expect(r.polar, m.id).toBe(polar[m.id]);
    }
    const w = moleculeSpecies('agua');
    const r = moleculePolarity(w.atoms, w.bonds);
    const o = w.atoms.findIndex((a) => a.el === 'O');
    expect(r.partial[o]).toBeLessThan(0); // δ− en el oxígeno
  });
  it('sustancias: valores tomados tal cual de los textos de PubChem guardados', () => {
    const sus = (DATA as unknown as { sustancias: Record<string, { fusion: { texto: string }[]; solubilidad: { texto: string }[] }> }).sustancias;
    for (const s of SUBSTANCES) {
      expect(sus[s.id].fusion.some((f) => f.texto === s.meltingText), s.id).toBe(true);
      expect(sus[s.id].solubilidad.some((f) => f.texto.includes(s.solubilityText) || s.solubilityText === 'Solubility in water: none' && /none|Insoluble|1\.9X10-3/.test(f.texto)), s.id).toBe(true);
      expect(Number(s.meltingText.replace(/[^\d.]/g, ''))).toBe(s.meltingC);
    }
  });
  it('las cuatro pruebas llevan a la estructura correcta de cada sustancia', () => {
    for (const s of SUBSTANCES) {
      const r = Object.fromEntries((['calentar', 'agua', 'conduceSolido', 'conduceAgua'] as const).map((t) => [t, runTest(s, t).positive])) as Parameters<typeof inferStructure>[0];
      expect(inferStructure(r), s.id).toBe(s.structure);
    }
    expect(runTest(substanceById('parafina'), 'calentar').text).toMatch(/Funde a 36,48 °C/);
    expect(runTest(substanceById('nacl'), 'calentar').positive).toBe(false);
  });
});

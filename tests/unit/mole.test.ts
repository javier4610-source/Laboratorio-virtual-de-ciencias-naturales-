import { describe, expect, it } from 'vitest';
import {
  AVOGADRO, BEAKER_MASS, BOAT_MASS, countEntities, CRUCIBLE_MASS, findSubstance, gasVolumeL, massFromMoles, molarMassInfo,
  molarVolumeL, moleModelSpec, PAPER_MASS, reactionsBalanced, readingDuring, readingSigFigs, ROOM, runMolReaction, STP, SUBSTANCES, weigh,
} from '../../src/models/mole';
import { molarMass } from '../../src/models/balancing';
import { molarMass as stoichMolarMass } from '../../src/models/chemistry';

// Tolerancia declarada para las masas molares: ± 0,005 g/mol (la mitad del último decimal informado de 342,30).
const TOL_M = 0.005;

describe('masa molar a partir de la fórmula (masas atómicas abreviadas IUPAC)', () => {
  it('coincide con los valores calculados a mano', () => {
    // NaCl: 22,99 + 35,45 = 58,44
    expect(Math.abs(molarMassInfo('NaCl').value - 58.44)).toBeLessThan(TOL_M);
    // H₂O: 2·1,008 + 15,999 = 18,015
    expect(Math.abs(molarMassInfo('H2O').value - 18.015)).toBeLessThan(TOL_M);
    // C₁₂H₂₂O₁₁: 12·12,011 + 22·1,008 + 11·15,999 = 144,132 + 22,176 + 175,989 = 342,297 ≈ 342,30
    expect(Math.abs(molarMassInfo('C12H22O11').value - 342.30)).toBeLessThan(TOL_M);
    expect(molarMassInfo('CaCO3').value).toBeCloseTo(100.086, 3);
    expect(molarMassInfo('NaHCO3').value).toBeCloseTo(84.006, 3);
  });

  it('informa los decimales del término menos preciso y el aporte de cada elemento', () => {
    expect(molarMassInfo('NaCl').decimals).toBe(2); // el cloro se publica como 35,45
    expect(molarMassInfo('H2O').decimals).toBe(3);
    const s = molarMassInfo('C12H22O11');
    expect(s.contributions.map((c) => [c.element, c.count])).toEqual([['C', 12], ['H', 22], ['O', 11]]);
    expect(s.contributions.reduce((a, c) => a + c.subtotal, 0)).toBeCloseTo(s.value, 10);
  });

  it('usa las mismas masas atómicas que las prácticas de balanceo y estequiometría', () => {
    for (const s of SUBSTANCES) {
      expect(molarMassInfo(s.formula).value).toBe(molarMass(s.formula));
      expect(molarMassInfo(s.formula).value).toBeCloseTo(stoichMolarMass(s.formula), 9);
    }
  });
});

describe('el mol y el número de Avogadro', () => {
  it('N_A es el valor exacto del SI de 2019', () => {
    expect(AVOGADRO).toBe(6.02214076e23);
  });

  it('una masa molar de sustancia contiene N_A entidades y los átomos son N × subíndice', () => {
    const c = countEntities(molarMass('C12H22O11'), 'C12H22O11');
    expect(c.moles).toBeCloseTo(1, 12);
    expect(c.entities / AVOGADRO).toBeCloseTo(1, 12);
    expect(c.atoms.C / c.entities).toBeCloseTo(12, 12);
    expect(c.atoms.H / c.entities).toBeCloseTo(22, 12);
    expect(c.totalAtoms / c.entities).toBeCloseTo(45, 12);
  });

  it('caso a mano: 1,250 g de NaCl = 0,02139 mol = 1,288 × 10²² unidades fórmula', () => {
    const c = countEntities(1.25, 'NaCl');
    expect(c.moles).toBeCloseTo(1.25 / 58.44, 10);
    expect(Number(c.moles.toPrecision(4))).toBe(0.02139);
    expect(Number((c.entities / 1e22).toPrecision(4))).toBe(1.288);
    expect(c.atoms.Na).toBeCloseTo(c.atoms.Cl, 0);
    expect(c.massPerEntity).toBeCloseTo(58.44 / 6.02214076e23, 30);
  });

  it('n es proporcional a la masa e inversamente proporcional a M (misma masa: menos moles de sacarosa que de agua)', () => {
    const a = countEntities(2, 'H2O'), b = countEntities(4, 'H2O');
    expect(b.moles / a.moles).toBeCloseTo(2, 12);
    expect(countEntities(10, 'C12H22O11').moles).toBeLessThan(countEntities(10, 'H2O').moles);
    expect(massFromMoles(countEntities(3.21, 'CaCO3').moles, 'CaCO3')).toBeCloseTo(3.21, 10);
    expect(countEntities(0, 'Fe').entities).toBe(0);
  });
});

describe('gas ideal', () => {
  it('1 mol a 273,15 K y 101,325 kPa ocupa 22,414 L', () => {
    expect(Math.abs(molarVolumeL(STP.T, STP.P) - 22.414)).toBeLessThan(0.001);
    expect(molarVolumeL(ROOM.T, ROOM.P)).toBeCloseTo(24.465, 2);
    expect(gasVolumeL(0.5)).toBeCloseTo(11.207, 2);
  });
});

describe('balanza con navecilla y tara', () => {
  it('con tara correcta la lectura es la masa de la muestra, cuantizada a 0,001 g', () => {
    const w = weigh({ substanceId: 'sal', portions: 1, boatOnPan: true, tare: BOAT_MASS });
    expect(w.tareStatus).toBe('correcta');
    expect(w.reading).toBe(1.25);
    const al = weigh({ substanceId: 'aluminio', portions: 3, boatOnPan: true, tare: BOAT_MASS });
    expect(al.reading).toBe(1.296);
  });

  it('sin tarar la lectura incluye la navecilla; tarada con muestra la omite', () => {
    const w = weigh({ substanceId: 'sal', portions: 2, boatOnPan: true, tare: 0 });
    expect(w.tareStatus).toBe('sin tarar');
    expect(w.reading).toBeCloseTo(2.5 + BOAT_MASS, 9);
    const t = weigh({ substanceId: 'sal', portions: 2, boatOnPan: true, tare: BOAT_MASS + 1.25 });
    expect(t.tareStatus).toBe('tarada con muestra');
    expect(t.reading).toBe(1.25);
    expect(weigh({ substanceId: 'sal', portions: 0, boatOnPan: false, tare: 0 }).reading).toBe(0);
  });

  it('cifras significativas de la lectura', () => {
    expect(readingSigFigs(1.25)).toBe(4);
    expect(readingSigFigs(0.432)).toBe(3);
    expect(readingSigFigs(0.05)).toBe(2);
    expect(readingSigFigs(12.345)).toBe(5);
  });

  it('las porciones del cobre y del aluminio coinciden con su geometría y densidad', () => {
    const cu = Math.PI * 0.1026 ** 2 * 5 * 8.96;
    expect(findSubstance('cobre').portionMass).toBeCloseTo(cu, 2);
    expect(findSubstance('aluminio').portionMass).toBeCloseTo(100 * 0.0016 * 2.7, 6);
  });
});

describe('estequiometría masa–masa sobre la balanza', () => {
  it('las ecuaciones están balanceadas', () => {
    expect(reactionsBalanced()).toBe(true);
  });

  it('conservación de la masa en las dos reacciones y en todo el rango', () => {
    for (const reaction of ['vinagre', 'calor'] as const) {
      for (const solidMass of [0.5, 2, 3.7, 5]) {
        for (const vinegarMl of [10, 50, 100]) {
          const r = runMolReaction({ reaction, solidMass, vinegarMl });
          expect(r.productsMass).toBeCloseTo(r.reactantsMass, 9);
          expect(r.massInitial - r.massFinal).toBeCloseTo(r.gasLost, 9);
          expect(r.gasLost).toBeGreaterThan(0);
          const leftover = r.excess.reduce((a, b) => a + b, 0);
          const before = reaction === 'vinagre' ? solidMass + vinegarMl * 0.05 : solidMass;
          expect(r.reactantsMass + leftover).toBeCloseTo(before, 9);
        }
      }
    }
  });

  it('caso a mano: 2,00 g de NaHCO₃ y 50 mL de vinagre al 5 %', () => {
    const r = runMolReaction({ reaction: 'vinagre', solidMass: 2, vinegarMl: 50 });
    // n(NaHCO₃) = 2/84,006 = 0,02381 mol; n(ácido) = 2,5/60,052 = 0,04163 mol → limita el bicarbonato.
    expect(r.limiting).toBe('bicarbonato de sodio');
    expect(r.molesSolid).toBeCloseTo(0.023808, 5);
    expect(r.co2Mass).toBeCloseTo(1.0478, 3);
    expect(r.massInitial).toBeCloseTo(BEAKER_MASS + PAPER_MASS + 50 * 1.006 + 2, 9);
    expect(r.readingInitial).toBe(120.927);
    expect(r.readingFinal).toBe(119.879);
    expect(r.co2VolumeStpL).toBeCloseTo(0.5336, 3);
    // Más vinagre que el necesario no forma más CO₂.
    expect(runMolReaction({ reaction: 'vinagre', solidMass: 2, vinegarMl: 100 }).co2Mass).toBeCloseTo(r.co2Mass, 12);
    // Con poco vinagre, el ácido limita.
    expect(runMolReaction({ reaction: 'vinagre', solidMass: 5, vinegarMl: 10 }).limiting).toBe('ácido acético');
  });

  it('el bicarbonato calentado pierde el 36,92 % de su masa', () => {
    const r = runMolReaction({ reaction: 'calor', solidMass: 2, vinegarMl: 50 });
    expect(r.lossFraction).toBeCloseTo(62.024 / 168.012, 4);
    expect(r.lossFraction * 100).toBeCloseTo(36.92, 2);
    expect(r.massFinal - CRUCIBLE_MASS).toBeCloseTo(2 * 105.988 / 168.012, 6);
    expect(r.vaporMass / r.co2Mass).toBeCloseTo(18.015 / 44.009, 9);
    expect(readingDuring(r, 0)).toBe(r.readingInitial);
    expect(readingDuring(r, 1)).toBe(r.readingFinal);
    expect(readingDuring(r, 2)).toBe(r.readingFinal);
  });
});

describe('validación de entradas', () => {
  it('rechaza valores fuera de rango con mensajes en español', () => {
    expect(() => countEntities(-1, 'NaCl')).toThrow(/masa de la muestra/);
    expect(() => countEntities(1001, 'NaCl')).toThrow(/entre/);
    expect(() => weigh({ substanceId: 'sal', portions: 11, boatOnPan: true, tare: 0 })).toThrow(/porciones/);
    expect(() => runMolReaction({ reaction: 'vinagre', solidMass: 0.1, vinegarMl: 50 })).toThrow(/bicarbonato/);
    expect(() => runMolReaction({ reaction: 'vinagre', solidMass: 2, vinegarMl: 500 })).toThrow(/vinagre/);
    expect(() => molarVolumeL(Number.NaN, 100)).toThrow(/número válido/);
    expect(() => findSubstance('oro')).toThrow(/desconocida/);
  });

  it('la ficha del modelo declara entradas con rango, ecuaciones y casos de prueba', () => {
    expect(moleModelSpec.inputs.length).toBeGreaterThanOrEqual(4);
    expect(moleModelSpec.equations.some((e) => e.includes('6,022 140 76'))).toBe(true);
    expect(moleModelSpec.testCases.length).toBeGreaterThanOrEqual(5);
  });
});

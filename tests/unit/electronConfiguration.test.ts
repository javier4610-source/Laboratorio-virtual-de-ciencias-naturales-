import { describe, expect, it } from 'vitest';
import {
  analyzeBoxes, aufbauOccupancy, boxesFromSequence, configString, configurationConditions, EXCEPTIONS_UP_TO_XE, fillingSequence, groundState,
  hundBoxes, isException, laguerre, lastElectron, MAX_Z, meanRadius, nobleGasString, ORDER, parseConfiguration, radialR, sampleOrbital, tablePlace,
  type Boxes,
} from '../../src/models/electronConfiguration';
import { periodicElement } from '../../src/models/periodicTrends';

describe('principio de construcción (Madelung), Pauli y Hund', () => {
  it('el orden de llenado es el de las diagonales y la capacidad total llega al xenón', () => {
    expect(ORDER.map((s) => s.key)).toEqual(['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p']);
    expect(ORDER.reduce((a, s) => a + s.cap, 0)).toBe(MAX_Z);
  });
  it('el hierro: 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶, cuatro desapareados', () => {
    const occ = aufbauOccupancy(26);
    expect(configString(occ)).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶');
    expect(nobleGasString(occ)).toBe('[Ar] 4s² 3d⁶');
    const a = analyzeBoxes(hundBoxes(occ), 26);
    expect(a).toMatchObject({ electrons: 26, unpaired: 4, matchesGround: true, matchesException: false });
    expect(a.pauli).toEqual([]); expect(a.hund).toEqual([]); expect(a.aufbau).toEqual([]);
  });
  it('Hund: el nitrógeno pone un electrón ↑ en cada orbital 2p antes de aparear', () => {
    const seq = fillingSequence(7);
    expect(seq.slice(4)).toEqual([{ box: '2p0', spin: 1 }, { box: '2p1', spin: 1 }, { box: '2p2', spin: 1 }]);
    expect(analyzeBoxes(boxesFromSequence(seq), 7).unpaired).toBe(3);
    expect(analyzeBoxes(boxesFromSequence(fillingSequence(8)), 8).unpaired).toBe(2);
  });
  it('detecta Pauli, Hund y estados excitados con su corrección', () => {
    const pauli: Boxes = { '1s0': [1, 1] };
    const a = analyzeBoxes(pauli, 2);
    expect(a.pauli).toEqual(['1s0']);
    expect(configurationConditions(a)[0]).toMatchObject({ level: 'invalido' });
    const hund: Boxes = { '1s0': [1, -1], '2s0': [1, -1], '2p0': [1, -1], '2p1': [1] };
    const h = analyzeBoxes(hund, 7);
    expect(h.hund).toEqual(['2p']);
    expect(h.matchesGround).toBe(false);
    expect(configurationConditions(h).some((c) => c.fix.includes('un electrón ↑ en cada orbital 2p'))).toBe(true);
    const opposite: Boxes = { '1s0': [1, -1], '2s0': [1, -1], '2p0': [1], '2p1': [-1] };
    expect(analyzeBoxes(opposite, 6).hund).toEqual(['2p']);
    const excited: Boxes = { '1s0': [1], '2s0': [1] };
    const e = analyzeBoxes(excited, 2);
    expect(e.aufbau).toEqual([{ filled: '2s', before: '1s' }]);
    expect(configurationConditions(e).map((c) => c.level)).toContain('advertencia');
  });
  it('un diagrama con menos electrones que Z se reconoce como catión', () => {
    const c = configurationConditions(analyzeBoxes(hundBoxes({ '1s': 2, '2s': 2, '2p': 6 }), 11));
    expect(c[0].text).toContain('catión Na⁺');
  });
});

describe('estado fundamental medido (NIST vía PubChem) y excepciones', () => {
  it('lee la notación de PubChem', () => {
    expect(parseConfiguration('[Ar]3d5 4s1')).toMatchObject({ '3s': 2, '3p': 6, '3d': 5, '4s': 1 });
    expect(parseConfiguration('[He] 2s2 2p3')).toMatchObject({ '1s': 2, '2s': 2, '2p': 3 });
  });
  it('cromo y cobre: el dato medido difiere de la predicción', () => {
    expect(nobleGasString(aufbauOccupancy(24))).toBe('[Ar] 4s² 3d⁴');
    expect(nobleGasString(groundState(24))).toBe('[Ar] 4s¹ 3d⁵');
    expect(nobleGasString(groundState(29))).toBe('[Ar] 4s¹ 3d¹⁰');
    const cr = analyzeBoxes(hundBoxes(groundState(24)), 24);
    expect(cr).toMatchObject({ unpaired: 6, matchesGround: true, matchesException: true });
    expect(configurationConditions(cr)).toEqual([]);
    expect(analyzeBoxes(hundBoxes(aufbauOccupancy(24)), 24)).toMatchObject({ unpaired: 4, matchesGround: false });
    expect(analyzeBoxes(hundBoxes(groundState(29)), 29).unpaired).toBe(1);
  });
  it('hasta el xenón hay exactamente 8 excepciones en los datos', () => {
    expect(EXCEPTIONS_UP_TO_XE).toEqual(['Cr', 'Cu', 'Nb', 'Mo', 'Ru', 'Rh', 'Pd', 'Ag']);
    expect(isException(26)).toBe(false);
    for (let z = 1; z <= MAX_Z; z++) expect(Object.values(groundState(z)).reduce((a, b) => a + b, 0), `Z = ${z}`).toBe(z);
  });
});

describe('relación con la tabla periódica', () => {
  it('el período, el grupo y el bloque deducidos coinciden con la tabla de la IUPAC en los 54 elementos', () => {
    for (let z = 1; z <= MAX_Z; z++) {
      const p = tablePlace(z);
      expect(p.period, periodicElement(z).sym).toBe(p.tablePeriod);
      expect(p.group, periodicElement(z).sym).toBe(p.tableGroup);
    }
  });
  it('electrones de valencia y último electrón', () => {
    expect(tablePlace(17)).toMatchObject({ block: 'p', group: 17, valence: 7 });
    expect(tablePlace(20)).toMatchObject({ block: 's', group: 2, valence: 2 });
    expect(tablePlace(26)).toMatchObject({ block: 'd', group: 8, valence: 8 });
    expect(lastElectron(8)).toEqual({ n: 2, l: 1, ml: -1, ms: -0.5, box: '2p0' });
  });
});

describe('formas de los orbitales (hidrógeno)', () => {
  it('Laguerre y nodos radiales: 2s tiene un nodo en r = 2 a₀ y 3s en r = (9 ± 3√3)/2 a₀', () => {
    expect(laguerre(1, 1, 2)).toBeCloseTo(0, 12);
    expect(radialR(2, 0, 2)).toBeCloseTo(0, 12);
    expect(radialR(3, 0, (9 - 3 * Math.sqrt(3)) / 2)).toBeCloseTo(0, 10);
    expect(radialR(3, 0, (9 + 3 * Math.sqrt(3)) / 2)).toBeCloseTo(0, 10);
  });
  it('la nube de puntos reproduce ⟨r⟩ = (3n² − ℓ(ℓ+1))/2 y la orientación de pz y dxy', () => {
    for (const [n, l, ml] of [[1, 0, 0], [2, 1, 0], [3, 2, 0]] as const) {
      const pts = sampleOrbital(n, l, ml, 6000, 7);
      const mean = pts.reduce((a, p) => a + Math.hypot(...p), 0) / pts.length;
      expect(Math.abs(mean / meanRadius(n, l) - 1), `${n}${l}`).toBeLessThan(0.03);
    }
    const pz = sampleOrbital(2, 1, 0, 5000, 3);
    const zz = pz.reduce((a, p) => a + p[2] ** 2, 0), rr = pz.reduce((a, p) => a + p[0] ** 2 + p[1] ** 2 + p[2] ** 2, 0);
    expect(zz / rr).toBeCloseTo(0.6, 1); // ⟨cos²θ⟩ = 3/5 para pz
    const dxy = sampleOrbital(3, 2, -2, 3000, 4);
    expect(dxy.filter((p) => Math.abs(p[2]) < Math.hypot(p[0], p[1])).length / dxy.length).toBeGreaterThan(0.85);
    expect(sampleOrbital(2, 1, 0, 50, 3)).toEqual(sampleOrbital(2, 1, 0, 50, 3));
  });
});

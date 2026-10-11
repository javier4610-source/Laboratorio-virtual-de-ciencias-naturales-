import { describe, expect, it } from 'vitest';
import {
  BAR, BULB_R, CELL, CELL_EMF, CELL_R, CLASS_THRESHOLDS, NOMINAL_POWER, SAMPLES,
  circuitCurrent, classifyByFraction, sampleResistance, testSample,
} from '../../src/models/conductors';

const METALS = ['cobre', 'aluminio', 'hierro'];
const INSULATORS = ['madera', 'pvc', 'vidrio', 'caucho', 'aire'];

describe('materiales conductores y aislantes (7.º)', () => {
  it('R = ρL/A: barra de cobre ≈ 4,2 × 10⁻⁴ Ω y celda de agua con sal = 50 Ω', () => {
    expect(sampleResistance(1.68e-8, BAR.length, BAR.area)).toBeCloseTo(4.2e-4, 8);
    expect(testSample({ sampleId: 'salada', cells: 1 }).sampleR).toBeCloseTo(0.2 * 0.1 / 4e-4, 9); // 50 Ω
    expect(CELL.area).toBe(4e-4);
  });

  it('valor calculado a mano: cobre con 1,5 V → 1,5/(10 + 0,3 + 0,00042) A = 145,6 mA', () => {
    const r = testSample({ sampleId: 'cobre', cells: 1 });
    expect(r.current).toBeCloseTo(1.5 / 10.30042, 9);
    expect(r.currentReading).toBe(145.6);
    expect(r.brightness).toBe(26.5); // (0,14563² · 10) / 0,8010 W
  });

  it('los metales encienden el bombillo con casi la corriente de cortocircuito', () => {
    for (const id of METALS) {
      for (const cells of [1, 2]) {
        const r = testSample({ sampleId: id, cells });
        expect(r.currentFraction).toBeGreaterThan(0.97);
        expect(r.visible).toBe(true);
        expect(r.classification).toBe('conductor');
      }
    }
    // Con dos pilas y un metal el bombillo trabaja a su potencia nominal.
    expect(testSample({ sampleId: 'cobre', cells: 2 }).brightness).toBe(100);
  });

  it('los aislantes y el aire dan una corriente prácticamente nula y el bombillo no enciende', () => {
    for (const id of INSULATORS) {
      const r = testSample({ sampleId: id, cells: 2 });
      expect(r.current).toBeLessThan(1e-12);
      expect(r.currentReading).toBe(0);
      expect(r.brightness).toBe(0);
      expect(r.visible).toBe(false);
      expect(r.classification).toBe('aislante');
    }
  });

  it('el agua con sal conduce miles de veces más que la destilada; la de la llave queda en medio', () => {
    const sal = testSample({ sampleId: 'salada', cells: 1 });
    const llave = testSample({ sampleId: 'llave', cells: 1 });
    const dest = testSample({ sampleId: 'destilada', cells: 1 });
    expect(sal.current / dest.current).toBeGreaterThan(1e4);
    expect(llave.current).toBeGreaterThan(dest.current);
    expect(llave.current).toBeLessThan(sal.current);
    expect(sal.currentReading).toBe(24.9);
    expect(dest.currentReading).toBe(0);
    expect(sal.classification).toBe('debil');
    expect(llave.classification).toBe('debil');
    expect(dest.classification).toBe('aislante');
  });

  it('el grafito conduce menos que los metales, pero sigue siendo conductor', () => {
    const g = testSample({ sampleId: 'grafito', cells: 1 });
    for (const id of METALS) expect(g.current).toBeLessThan(testSample({ sampleId: id, cells: 1 }).current);
    expect(g.currentReading).toBe(135.7);
    expect(g.classification).toBe('conductor');
  });

  it('duplicar el voltaje duplica la corriente con la misma muestra (muestras de gran resistencia)', () => {
    for (const id of ['llave', 'destilada']) {
      const a = testSample({ sampleId: id, cells: 1 }).current;
      const b = testSample({ sampleId: id, cells: 2 }).current;
      expect(b / a).toBeCloseTo(2, 3);
    }
    // Con un metal la resistencia interna de la segunda pila hace que la razón sea algo menor que 2.
    const c1 = testSample({ sampleId: 'cobre', cells: 1 }).current;
    const c2 = testSample({ sampleId: 'cobre', cells: 2 }).current;
    expect(c2 / c1).toBeGreaterThan(1.9);
    expect(c2 / c1).toBeLessThan(2);
  });

  it('el brillo solo es visible con agua con sal si se usan dos pilas (umbral del 1 %)', () => {
    expect(testSample({ sampleId: 'salada', cells: 1 }).visible).toBe(false);
    const two = testSample({ sampleId: 'salada', cells: 2 });
    expect(two.visible).toBe(true);
    expect(two.brightness).toBe(3.1);
    expect(NOMINAL_POWER).toBeCloseTo((3 / 10.6) ** 2 * 10, 10);
  });

  it('la corriente disminuye al aumentar la resistividad (con el mismo voltaje)', () => {
    const ordered = [...SAMPLES].sort((a, b) => a.rho - b.rho);
    const currents = ordered.map((s) => testSample({ sampleId: s.id, cells: 1 }).current);
    for (let i = 1; i < currents.length; i++) expect(currents[i]).toBeLessThanOrEqual(currents[i - 1]);
  });

  it('conservación de la energía: la suma de las caídas de voltaje es igual al voltaje de la fuente', () => {
    for (const s of SAMPLES) {
      for (const cells of [1, 2]) {
        const r = testSample({ sampleId: s.id, cells });
        expect(r.drops.sample + r.drops.bulb + r.drops.internal).toBeCloseTo(cells * CELL_EMF, 9);
      }
    }
    expect(circuitCurrent(1, 0)).toBeCloseTo(CELL_EMF / (BULB_R + CELL_R), 12);
  });

  it('umbrales de clasificación declarados', () => {
    expect(classifyByFraction(CLASS_THRESHOLDS.conductor)).toBe('conductor');
    expect(classifyByFraction(0.49)).toBe('debil');
    expect(classifyByFraction(CLASS_THRESHOLDS.debil)).toBe('debil');
    expect(classifyByFraction(9e-5)).toBe('aislante');
  });

  it('valida los rangos de entrada', () => {
    expect(() => testSample({ sampleId: 'cobre', cells: 3 })).toThrow(RangeError);
    expect(() => testSample({ sampleId: 'cobre', cells: 0 })).toThrow(RangeError);
    expect(() => circuitCurrent(1.5, 10)).toThrow(RangeError);
    expect(() => circuitCurrent(1, -1)).toThrow(RangeError);
    expect(() => sampleResistance(-1, 0.1, 4e-6)).toThrow(RangeError);
    expect(() => sampleResistance(1, 0, 4e-6)).toThrow(RangeError);
    expect(() => testSample({ sampleId: 'oro', cells: 1 })).toThrow();
    expect(() => testSample({ sampleId: 'cobre', cells: Number.NaN })).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import {
  decayConstant, DECOMP_DEFAULTS, DECOMP_MATERIALS, halfLife, massCurve, moistureFactor, pileTemperature,
  remainingMass, simulateDecomposition, temperatureFactor,
} from '../../src/models/decomposition';

const base = { ...DECOMP_DEFAULTS };

describe('descomposición de la materia orgánica (7.º)', () => {
  it('caso inicial calculado a mano: banano, 4 semanas, 25 °C, 55 %, con volteo, entero', () => {
    const r = simulateDecomposition(base);
    expect(r.k).toBeCloseTo(0.15, 12);
    expect(r.trueMass).toBeCloseTo(50 * Math.exp(-0.6), 10); // 27,44 g
    expect(r.massReading).toBe(27.4);
    expect(r.lossPercent).toBeCloseTo(45.2, 10);
    expect(r.observations.fungi).toBe('abundantes');
    expect(r.observations.pileTemperature).toBe(29); // 25 + 6·e^(−0,4) ≈ 29,0
  });

  it('la masa decrece exponencialmente (cociente constante) y nunca es negativa', () => {
    const curve = massCurve({ ...base, temperature: 40, chopped: true });
    const ratios = curve.slice(1).map((p, i) => p.mass / curve[i].mass);
    for (const q of ratios) expect(q).toBeCloseTo(ratios[0], 10);
    for (let i = 1; i < curve.length; i++) expect(curve[i].mass).toBeLessThan(curve[i - 1].mass);
    const extreme = simulateDecomposition({ ...base, weeks: 12, temperature: 40, chopped: true });
    expect(extreme.massReading).toBeGreaterThanOrEqual(0);
    expect(remainingMass(50, 100, 12)).toBeGreaterThanOrEqual(0);
  });

  it('el plástico (control) no cambia en ninguna condición', () => {
    for (const weeks of [0, 6, 12]) {
      const r = simulateDecomposition({ ...base, materialId: 'plastico', weeks, temperature: 40, chopped: true });
      expect(r.massReading).toBe(50);
      expect(r.lossPercent).toBe(0);
      expect(r.halfLife).toBeNull();
      expect(r.observations.fungi).toBe('no visibles');
    }
  });

  it('Q10 = 2: k se duplica de 25 °C a 35 °C y cae por encima de 40 °C', () => {
    const k25 = decayConstant({ ...base, temperature: 25 });
    const k35 = decayConstant({ ...base, temperature: 35 });
    expect(k35 / k25).toBeCloseTo(2, 12);
    expect(temperatureFactor(15)).toBeCloseTo(0.5, 12);
    expect(temperatureFactor(45)).toBeLessThan(temperatureFactor(40));
    expect(temperatureFactor(45)).toBeCloseTo(4 * 0.5, 12);
  });

  it('el óptimo de humedad es intermedio: en seco y en saturación se descompone menos', () => {
    expect(moistureFactor(55)).toBe(1);
    expect(moistureFactor(20)).toBeLessThan(0.2);
    expect(moistureFactor(90)).toBeLessThan(0.2);
    const loss = (moisture: number) => simulateDecomposition({ ...base, moisture, weeks: 8 }).lossPercent;
    expect(loss(55)).toBeGreaterThan(loss(20));
    expect(loss(55)).toBeGreaterThan(loss(90));
    expect(simulateDecomposition({ ...base, moisture: 90 }).observations.anaerobic).toBe(true);
  });

  it('sin oxígeno (sin volteo) es más lento y huele a fermentación', () => {
    const kAir = decayConstant({ ...base, aerated: true });
    const kNo = decayConstant({ ...base, aerated: false });
    expect(kNo).toBeCloseTo(kAir / 2, 12);
    const r = simulateDecomposition({ ...base, aerated: false });
    expect(r.lossPercent).toBeLessThan(simulateDecomposition(base).lossPercent);
    expect(r.observations.smell).toMatch(/fermentación/);
    expect(simulateDecomposition(base).observations.smell).toMatch(/tierra/);
  });

  it('el material picado se descompone 1,5 veces más rápido', () => {
    expect(decayConstant({ ...base, chopped: true }) / decayConstant(base)).toBeCloseTo(1.5, 12);
    expect(simulateDecomposition({ ...base, chopped: true }).lossPercent).toBeGreaterThan(simulateDecomposition(base).lossPercent);
  });

  it('la vida media ln2/k deja la mitad de la masa y el orden de los materiales es el esperado', () => {
    const k = decayConstant(base);
    const t = halfLife(k)!;
    expect(t).toBeCloseTo(Math.LN2 / 0.15, 10); // ≈ 4,62 semanas
    expect(remainingMass(50, k, t)).toBeCloseTo(25, 10);
    const losses = DECOMP_MATERIALS.map((m) => simulateDecomposition({ ...base, materialId: m.id, weeks: 8 }).lossPercent);
    for (let i = 1; i < losses.length; i++) expect(losses[i]).toBeLessThan(losses[i - 1]);
  });

  it('en la semana 0 no hay pérdida ni hongos, y la pila se calienta más con mayor actividad', () => {
    const r = simulateDecomposition({ ...base, weeks: 0 });
    expect(r.massReading).toBe(50);
    expect(r.observations.fungi).toBe('no visibles');
    expect(pileTemperature({ weeks: 0, temperature: 25, moisture: 55, aerated: true })).toBeCloseTo(31, 10);
    expect(pileTemperature({ weeks: 0, temperature: 25, moisture: 10, aerated: true })).toBeLessThan(26);
  });

  it('valida los rangos de las entradas', () => {
    expect(() => simulateDecomposition({ ...base, weeks: -1 })).toThrow(RangeError);
    expect(() => simulateDecomposition({ ...base, weeks: 13 })).toThrow(RangeError);
    expect(() => simulateDecomposition({ ...base, temperature: 50 })).toThrow(RangeError);
    expect(() => simulateDecomposition({ ...base, moisture: 5 })).toThrow(RangeError);
    expect(() => simulateDecomposition({ ...base, initialMass: 0 })).toThrow(RangeError);
    expect(() => simulateDecomposition({ ...base, weeks: Number.NaN })).toThrow(RangeError);
    expect(() => simulateDecomposition({ ...base, materialId: 'vidrio' })).toThrow();
  });
});

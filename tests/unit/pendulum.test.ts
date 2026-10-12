import { describe, expect, it } from 'vitest';
import {
  analyzePeriod, energyPerMass, exactPeriod, photogatePeriod, REACTION_ERROR, seriesPeriod, simulatePendulum,
  smallAnglePeriod, stopwatchTenOscillations, turningPoints, type PendulumInput,
} from '../../src/models/pendulum';
import { linearRegression } from '../../src/models/math';

const base: PendulumInput = { length: 1, massG: 100, amplitudeDeg: 10, placeId: 'apartado', dampingId: 'ninguno' };
/** Período del modelo a partir de los pasos por el punto más bajo (sin redondear). */
const periodOf = (inp: Partial<PendulumInput>) => {
  const r = simulatePendulum({ ...base, ...inp });
  return r.passages[2] - r.passages[0];
};

describe('péndulo simple (10.º)', () => {
  it('con amplitud pequeña, T ≈ 2π√(L/g) dentro de 0,1 %', () => {
    const T = periodOf({ amplitudeDeg: 2 });
    const T0 = 2 * Math.PI * Math.sqrt(1 / 9.78); // ≈ 2,0091 s calculado a mano
    expect(T0).toBeCloseTo(2.0091, 3);
    expect(Math.abs(T - T0) / T0).toBeLessThan(0.001);
    expect(smallAnglePeriod(1, 9.78)).toBeCloseTo(T0, 12);
  });

  it('la integración RK4 reproduce el período exacto no lineal', () => {
    for (const a of [5, 30, 60, 80]) {
      const T = periodOf({ amplitudeDeg: a });
      expect(Math.abs(T - exactPeriod(1, 9.78, a)) / T).toBeLessThan(1e-6);
    }
  });

  it('el período no depende de la masa de la lenteja', () => {
    const T20 = periodOf({ massG: 20 });
    const T500 = periodOf({ massG: 500 });
    expect(T500).toBeCloseTo(T20, 12);
  });

  it('a 60° el período es cerca de 7 % mayor que T₀ y concuerda con la serie', () => {
    const ratio = periodOf({ amplitudeDeg: 60 }) / smallAnglePeriod(1, 9.78);
    expect(ratio).toBeGreaterThan(1.07);
    expect(ratio).toBeLessThan(1.08);
    // La serie hasta θ⁴ queda a menos de 0,1 % del valor exacto a 60°.
    expect(Math.abs(seriesPeriod(1, 9.78, 60) - exactPeriod(1, 9.78, 60)) / exactPeriod(1, 9.78, 60)).toBeLessThan(0.001);
  });

  it('T² es proporcional a L (y la pendiente da g)', () => {
    const Ls = [0.25, 0.5, 1, 1.5, 2];
    const T2 = Ls.map((L) => periodOf({ length: L, amplitudeDeg: 5 }) ** 2);
    const ratios = T2.map((t2, i) => t2 / Ls[i]);
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0], 9);
    const fit = linearRegression(Ls, T2)!;
    expect(fit.intercept).toBeCloseTo(0, 6);
    const gFromSlope = (4 * Math.PI ** 2) / fit.slope;
    expect(gFromSlope).toBeGreaterThan(9.75); // a 5° el período es 0,05 % mayor que T₀
    expect(gFromSlope).toBeLessThan(9.78);
  });

  it('sin amortiguamiento, la energía mecánica se conserva (error < 0,1 %)', () => {
    const r = simulatePendulum({ ...base, amplitudeDeg: 70 });
    const E0 = energyPerMass(1, 9.78, r.theta[0], r.omega[0]);
    let worst = 0;
    for (let i = 0; i < r.t.length; i += 50) worst = Math.max(worst, Math.abs(energyPerMass(1, 9.78, r.theta[i], r.omega[i]) - E0) / E0);
    expect(worst).toBeLessThan(0.001);
    expect(r.t[r.t.length - 1]).toBeGreaterThan(10 * exactPeriod(1, 9.78, 70));
  });

  it('con la aleta en aceite la amplitud decae exponencialmente (constante b/2)', () => {
    const r = simulatePendulum({ ...base, amplitudeDeg: 4, dampingId: 'aceite' });
    const tp = turningPoints(r);
    expect(tp.length).toBeGreaterThan(10);
    const fit = linearRegression(tp.map((p) => p.t), tp.map((p) => Math.log(p.amplitude)))!;
    expect(fit.slope).toBeCloseTo(-0.25 / 2, 2);
    expect(fit.r2).toBeGreaterThan(0.9999);
    // Sin amortiguamiento, la amplitud no cambia.
    const ideal = turningPoints(simulatePendulum({ ...base, amplitudeDeg: 4 }));
    expect(ideal[ideal.length - 1].amplitude).toBeCloseTo(ideal[0].amplitude, 6);
  });

  it('en la Luna el período es √(9,78/1,62) veces el de Apartadó', () => {
    const ratio = periodOf({ placeId: 'luna' }) / periodOf({ placeId: 'apartado' });
    expect(ratio).toBeCloseTo(Math.sqrt(9.78 / 1.62), 6);
    expect(ratio).toBeCloseTo(2.457, 3);
  });

  it('la fotopuerta mide con 1 ms y el cronómetro manual es reproducible y con error ≤ 0,15 s', () => {
    const r = simulatePendulum({ ...base, dampingId: 'aire' });
    const Tg = photogatePeriod(r);
    expect(Math.round(Tg * 1000)).toBeCloseTo(Tg * 1000, 9);
    expect(Tg).toBeCloseTo(exactPeriod(1, 9.78, 10), 3);
    const a = stopwatchTenOscillations(r, 7);
    const b = stopwatchTenOscillations(r, 7);
    expect(a).toEqual(b);
    for (let seed = 1; seed < 200; seed++) {
      const m = stopwatchTenOscillations(r, seed);
      expect(Math.abs(m.error)).toBeLessThanOrEqual(REACTION_ERROR + 1e-12);
      expect(Math.abs(m.reading - m.trueT10)).toBeLessThanOrEqual(REACTION_ERROR + 0.005 + 1e-9);
      // Al dividir entre 10, el error del período es como máximo 0,015 s.
      expect(Math.abs(m.reading / 10 - m.trueT10 / 10)).toBeLessThan(0.016);
    }
  });

  it('g = 4π²L/T² recupera la gravedad del lugar', () => {
    const T = exactPeriod(0.8, 9.77, 2);
    const res = analyzePeriod(0.8, T);
    expect(res.gCalculated).toBeCloseTo(9.77 / (exactPeriod(1, 1, 2) / smallAnglePeriod(1, 1)) ** 2, 9);
    expect(res.gCalculated).toBeGreaterThan(9.76);
    expect(res.frequency).toBeCloseTo(1 / T, 12);
    expect(res.period2).toBeCloseTo(T * T, 12);
  });

  it('valida los rangos y los identificadores', () => {
    expect(() => simulatePendulum({ ...base, length: 0.05 })).toThrow(RangeError);
    expect(() => simulatePendulum({ ...base, length: 2.5 })).toThrow(RangeError);
    expect(() => simulatePendulum({ ...base, massG: 600 })).toThrow(RangeError);
    expect(() => simulatePendulum({ ...base, amplitudeDeg: 85 })).toThrow(RangeError);
    expect(() => simulatePendulum({ ...base, amplitudeDeg: Number.NaN })).toThrow(RangeError);
    expect(() => simulatePendulum({ ...base, placeId: 'jupiter' })).toThrow();
    expect(() => simulatePendulum({ ...base, dampingId: 'miel' })).toThrow();
    expect(() => analyzePeriod(1, 0)).toThrow(RangeError);
  });
});

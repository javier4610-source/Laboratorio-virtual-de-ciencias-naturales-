import { describe, expect, it } from 'vitest';
import {
  applyFePerturbation, compareText, feResponse, FE_INITIAL, kFeSCN, kpNO2, no2Response, NO2_INITIAL,
  relaxProgress, shiftDirection, solveComplex, solveFeSCN, solveNO2, type FePerturbation, type FeState,
} from '../../src/models/equilibrium';

describe('equilibrio Fe³⁺ + SCN⁻ ⇌ FeSCN²⁺ (11.º)', () => {
  it('mezcla inicial resuelta a mano con la cuadrática', () => {
    // 110x² − 1,22x + 1,1 × 10⁻⁴ = 0 → discriminante 1,44 → x = (1,22 − 1,2)/220 = 1/11000 mol/L
    const eq = solveFeSCN(FE_INITIAL);
    expect(eq.complex).toBeCloseTo(1 / 11000, 12);
    expect(eq.fe).toBeCloseTo(1e-3 - 1 / 11000, 12);
    expect(eq.Q).toBeCloseTo(110, 8);
    expect(eq.absorbanceReading).toBe(0.427); // 4700 × 9,0909 × 10⁻⁵ = 0,42727
    expect(solveComplex(110, 0, 1e-3)).toBe(0);
  });

  it('Kc se conserva tras cada perturbación a temperatura constante', () => {
    const steps: FePerturbation[] = [{ kind: 'fe' }, { kind: 'scn' }, { kind: 'agua' }, { kind: 'ag' }, { kind: 'fe' }, { kind: 'agua' }, { kind: 'scn' }];
    let s: FeState = FE_INITIAL;
    for (const p of steps) {
      s = applyFePerturbation(s, p);
      const eq = solveFeSCN(s);
      expect(eq.K).toBeCloseTo(110, 10);
      expect(eq.complex / (eq.fe * eq.scn)).toBeCloseTo(110, 6);
    }
  });

  it('agregar un reactivo: Q inmediato < K y aumenta el producto (cálculo a mano de Q)', () => {
    const next = applyFePerturbation(FE_INITIAL, { kind: 'fe' });
    const r = feResponse(FE_INITIAL, next);
    // Q = n(C)·V / (n(Fe)·n(SCN)) = 9,0909e-4 × 10,05 / (0,0190909 × 0,0090909) ≈ 52,64
    expect(r.qImmediate).toBeCloseTo(52.64, 1);
    expect(r.direction).toBe('productos');
    expect(compareText(r.qImmediate, r.K)).toBe('Q < K: se desplaza hacia los productos.');
    expect(r.after.complex).toBeGreaterThan(r.before.complex * (10 / 10.05));
    expect(r.after.absorbance).toBeGreaterThan(r.before.absorbance);
    const scn = feResponse(FE_INITIAL, applyFePerturbation(FE_INITIAL, { kind: 'scn' }));
    expect(scn.after.absorbance).toBeGreaterThan(scn.before.absorbance);
  });

  it('más gotas de Fe³⁺ dan más absorbancia, con tendencia a estabilizarse (SCN⁻ limitante)', () => {
    const abs = [0, 2, 4, 6, 8, 10].map((g) => solveFeSCN({ ...FE_INITIAL, gotasFe: g }).absorbance);
    for (let i = 1; i < abs.length; i++) expect(abs[i]).toBeGreaterThan(abs[i - 1]);
    expect(abs[5] - abs[4]).toBeLessThan(abs[1] - abs[0]);
    // nunca supera la absorbancia de todo el SCN⁻ convertido en complejo
    expect(abs[5]).toBeLessThan(4700 * (0.01 / 10.5));
  });

  it('quitar SCN⁻ con Ag⁺ disminuye el color; con exceso de Ag⁺ desaparece', () => {
    const one = feResponse(FE_INITIAL, applyFePerturbation(FE_INITIAL, { kind: 'ag' }));
    expect(one.direction).toBe('reactivos');
    expect(one.after.absorbance).toBeLessThan(one.before.absorbance);
    const all = solveFeSCN({ ...FE_INITIAL, gotasAg: 10 }); // 10 × 0,05 mL × 0,02 M = 0,01 mmol = todo el SCN⁻
    expect(all.complex).toBe(0);
    expect(all.absorbanceReading).toBe(0);
    expect(all.warnings.some((w) => w.includes('AgSCN'))).toBe(true);
  });

  it('calentar una reacción exotérmica disminuye K y desplaza hacia reactivos', () => {
    // K(60 °C) = 110·exp[(6000/8,314)(1/333,15 − 1/298,15)] ≈ 85,3
    expect(kFeSCN(60)).toBeCloseTo(85.3, 1);
    expect(kFeSCN(5)).toBeGreaterThan(110);
    const r = feResponse(FE_INITIAL, applyFePerturbation(FE_INITIAL, { kind: 'temperatura', value: 60 }));
    expect(r.qImmediate).toBeCloseTo(110, 8); // las concentraciones no cambian al instante
    expect(r.direction).toBe('reactivos');
    expect(r.after.absorbance).toBeLessThan(r.before.absorbance);
  });

  it('diluir desplaza hacia el lado con más partículas disueltas (reactivos)', () => {
    const r = feResponse(FE_INITIAL, { ...FE_INITIAL, aguaML: 10 });
    expect(r.qImmediate).toBeCloseTo(220, 6); // Q = K·V'/V = 110 × 20/10
    expect(r.direction).toBe('reactivos');
    const fracBefore = r.before.complex / (r.before.feTotal / r.before.volumeML);
    const fracAfter = r.after.complex / (r.after.feTotal / r.after.volumeML);
    expect(fracAfter).toBeLessThan(fracBefore);
  });
});

describe('equilibrio 2 NO₂ ⇌ N₂O₄ en jeringa sellada (11.º)', () => {
  it('Kp de referencia, Q = K en el equilibrio y calentar disminuye K', () => {
    const eq = solveNO2(NO2_INITIAL);
    expect(eq.K).toBeCloseTo(6.7, 10);
    expect(eq.Q).toBeCloseTo(6.7, 8);
    expect(eq.nNO2 + 2 * eq.nN2O4).toBeCloseTo(2, 10); // conservación del nitrógeno
    expect(eq.intensityReading).toBe(100);
    expect(eq.pTotal).toBeGreaterThan(0.9);
    expect(eq.pTotal).toBeLessThan(1.1);
    expect(kpNO2(50)).toBeLessThan(kpNO2(25));
    const hot = no2Response(NO2_INITIAL, { volumen: 60, temperatura: 50 });
    expect(hot.direction).toBe('reactivos');
    expect(hot.after.fractionNO2).toBeGreaterThan(hot.before.fractionNO2);
    expect(hot.after.intensity).toBeGreaterThan(100);
  });

  it('comprimir: el color se intensifica al instante, pero se desplaza hacia N₂O₄', () => {
    const r = no2Response(NO2_INITIAL, { volumen: 30, temperatura: 25 });
    expect(r.immediate.intensity).toBeCloseTo(200, 8); // misma cantidad en la mitad del volumen
    expect(r.qImmediate).toBeCloseTo(6.7 / 2, 8); // Q = K·V'/V
    expect(r.direction).toBe('productos');
    expect(r.after.intensity).toBeLessThan(r.immediate.intensity);
    expect(r.after.intensity).toBeGreaterThan(100);
    expect(r.after.fractionNO2).toBeLessThan(r.before.fractionNO2);
    expect(r.after.Q).toBeCloseTo(r.after.K, 8);
  });
});

describe('utilidades y validación de rangos', () => {
  it('sentido según Q y K, y relajación acotada', () => {
    expect(shiftDirection(5, 10)).toBe('productos');
    expect(shiftDirection(20, 10)).toBe('reactivos');
    expect(shiftDirection(10, 10)).toBe('ninguno');
    expect(shiftDirection(Infinity, 10)).toBe('reactivos');
    expect(relaxProgress(0)).toBe(0);
    expect(relaxProgress(3)).toBeCloseTo(1, 12);
    expect(relaxProgress(99)).toBeCloseTo(1, 12);
    expect(relaxProgress(-5)).toBe(0);
  });

  it('rechaza entradas fuera de rango o perturbaciones imposibles', () => {
    expect(() => solveFeSCN({ ...FE_INITIAL, gotasFe: 11 })).toThrow(RangeError);
    expect(() => solveFeSCN({ ...FE_INITIAL, temperatura: 90 })).toThrow(RangeError);
    expect(() => solveFeSCN({ ...FE_INITIAL, aguaML: Number.NaN })).toThrow(RangeError);
    expect(() => applyFePerturbation({ ...FE_INITIAL, aguaML: 10 }, { kind: 'agua' })).toThrow(RangeError);
    expect(() => feResponse({ ...FE_INITIAL, gotasFe: 2 }, FE_INITIAL)).toThrow(RangeError);
    expect(() => solveNO2({ volumen: 10, temperatura: 25 })).toThrow(RangeError);
    expect(() => solveNO2({ volumen: 60, temperatura: 120 })).toThrow(RangeError);
  });
});

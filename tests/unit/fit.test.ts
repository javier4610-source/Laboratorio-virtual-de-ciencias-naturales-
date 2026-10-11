import { describe, expect, it } from 'vitest';
import { applyTransform, fitModel, formatWithUncertainty, invert, propagateTransform, transformAxis, type FitResult } from '../../src/lib/fit';

const ok = (o: ReturnType<typeof fitModel>): FitResult => {
  if (!o.ok) throw new Error(o.reason);
  return o.fit;
};
const param = (f: FitResult, name: string) => f.params.find((p) => p.name === name)!;

describe('ajuste lineal y = m·x + b', () => {
  it('coincide con el cálculo a mano (x = 0..3, y = 1, 3, 4, 8)', () => {
    // x̄ = 1,5; ȳ = 4; Sxx = 5; Sxy = 11 → m = 2,2; b = 0,7; SSres = 1,8; s² = 0,9
    const f = ok(fitModel('linear', [0, 1, 2, 3], [1, 3, 4, 8], { x: 's', y: 'm' }));
    expect(param(f, 'm').value).toBeCloseTo(2.2, 12);
    expect(param(f, 'b').value).toBeCloseTo(0.7, 12);
    // σ_m = √(s²/Sxx); σ_b = √(s²·Σx²/(n·Sxx))
    expect(param(f, 'm').se).toBeCloseTo(Math.sqrt(0.9 / 5), 12);
    expect(param(f, 'b').se).toBeCloseTo(Math.sqrt((0.9 * 14) / (4 * 5)), 12);
    expect(f.r2).toBeCloseTo(1 - 1.8 / 26, 12);
    expect(f.n).toBe(4);
    expect(f.dof).toBe(2);
    expect(f.s).toBeCloseTo(Math.sqrt(0.9), 12);
    expect(param(f, 'm').unit).toBe('m/s');
    const expected = [0.3, 0.1, -1.1, 0.7];
    f.residuals.forEach((r, i) => expect(r.r).toBeCloseTo(expected[i], 12));
  });

  it('recupera una recta exacta con incertidumbre nula y R² = 1', () => {
    const xs = [1, 2, 3, 4, 5, 6];
    const f = ok(fitModel('linear', xs, xs.map((x) => -1.5 * x + 4)));
    expect(param(f, 'm').value).toBeCloseTo(-1.5, 12);
    expect(param(f, 'b').value).toBeCloseTo(4, 12);
    expect(param(f, 'm').se).toBeLessThan(1e-9);
    expect(f.r2).toBeCloseTo(1, 12);
  });

  it('con dos puntos no hay grados de libertad: incertidumbre no definida', () => {
    const f = ok(fitModel('linear', [0, 2], [1, 5]));
    expect(param(f, 'm').value).toBeCloseTo(2, 12);
    expect(Number.isNaN(param(f, 'm').se)).toBe(true);
  });

  it('rechaza datos insuficientes o con una sola x', () => {
    expect(fitModel('linear', [1], [2]).ok).toBe(false);
    expect(fitModel('linear', [1, 1, 1], [2, 3, 4]).ok).toBe(false);
    expect(fitModel('none', [1, 2], [2, 3]).ok).toBe(false);
  });
});

describe('ajuste proporcional y = k·x', () => {
  it('k = Σxy/Σx² y σ_k = √(s²/Σx²) con s² = SSres/(n − 1)', () => {
    const f = ok(fitModel('proportional', [1, 2, 3], [2, 4, 7], { x: 'N', y: 'm/s²' }));
    expect(param(f, 'k').value).toBeCloseTo(31 / 14, 12);
    // SSres = Σy² − k·Σxy = 69 − 961/14 = 5/14
    expect(param(f, 'k').se).toBeCloseTo(Math.sqrt(5 / 14 / 2 / 14), 12);
    expect(f.dof).toBe(2);
    expect(param(f, 'k').unit).toBe('(m/s²)/N');
  });
});

describe('ajuste cuadrático', () => {
  it('recupera y = 2x² − 3x + 1', () => {
    const xs = [-2, -1, 0, 1, 2, 3, 4];
    const f = ok(fitModel('quadratic', xs, xs.map((x) => 2 * x * x - 3 * x + 1)));
    expect(param(f, 'A').value).toBeCloseTo(2, 9);
    expect(param(f, 'B').value).toBeCloseTo(-3, 9);
    expect(param(f, 'C').value).toBeCloseTo(1, 9);
    expect(f.r2).toBeCloseTo(1, 12);
  });

  it('errores estándar = √(s²·[(XᵀX)⁻¹]ᵢᵢ)', () => {
    const xs = [0, 1, 2, 3, 4], ys = [1.2, 1.9, 5.1, 10.2, 16.8];
    const f = ok(fitModel('quadratic', xs, ys));
    const X = xs.map((x) => [x * x, x, 1]);
    const XtX = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
    const inv = invert(XtX)!;
    const ssr = f.residuals.reduce((s, r) => s + r.r * r.r, 0);
    const s2 = ssr / (xs.length - 3);
    expect(param(f, 'A').se).toBeCloseTo(Math.sqrt(s2 * inv[0][0]), 10);
    expect(param(f, 'B').se).toBeCloseTo(Math.sqrt(s2 * inv[1][1]), 10);
    expect(param(f, 'C').se).toBeCloseTo(Math.sqrt(s2 * inv[2][2]), 10);
  });

  it('necesita tres valores distintos de x', () => {
    expect(fitModel('quadratic', [1, 1, 2, 2], [1, 2, 3, 4]).ok).toBe(false);
  });
});

describe('ajustes por linealización', () => {
  it('exponencial: recupera y = 3·e^(0,5x)', () => {
    const xs = [0, 1, 2, 3, 4];
    const f = ok(fitModel('exponential', xs, xs.map((x) => 3 * Math.exp(0.5 * x))));
    expect(param(f, 'A').value).toBeCloseTo(3, 10);
    expect(param(f, 'k').value).toBeCloseTo(0.5, 10);
    expect(f.linearized).toBe(true);
  });

  it('exponencial: incertidumbres iguales a las de la recta ln y contra x (σ_A = A·σ_b)', () => {
    const xs = [0, 1, 2, 3, 4], ys = [2.9, 5.1, 8.0, 13.9, 22.5];
    const f = ok(fitModel('exponential', xs, ys));
    const lin = ok(fitModel('linear', xs, ys.map(Math.log)));
    expect(param(f, 'k').se).toBeCloseTo(param(lin, 'm').se, 12);
    expect(param(f, 'A').se).toBeCloseTo(param(f, 'A').value * param(lin, 'b').se, 12);
  });

  it('exponencial: exige y > 0', () => {
    const o = fitModel('exponential', [0, 1, 2], [1, 0, 2]);
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.reason).toMatch(/y > 0/);
  });

  it('potencia: recupera y = 2·x^1,5 y exige x, y > 0', () => {
    const xs = [0.5, 1, 2, 4, 8];
    const f = ok(fitModel('power', xs, xs.map((x) => 2 * x ** 1.5)));
    expect(param(f, 'A').value).toBeCloseTo(2, 10);
    expect(param(f, 'n').value).toBeCloseTo(1.5, 10);
    expect(fitModel('power', [0, 1, 2], [1, 2, 3]).ok).toBe(false);
  });

  it('logarítmico: recupera y = 1 + 2·ln x', () => {
    const xs = [1, 2, 5, 10, 20];
    const f = ok(fitModel('logarithmic', xs, xs.map((x) => 1 + 2 * Math.log(x))));
    expect(param(f, 'a').value).toBeCloseTo(1, 10);
    expect(param(f, 'b').value).toBeCloseTo(2, 10);
    expect(fitModel('logarithmic', [-1, 1, 2], [1, 2, 3]).ok).toBe(false);
  });
});

describe('linealización de ejes', () => {
  it('transforma valores y descarta los que no pertenecen al dominio', () => {
    expect(applyTransform('x2', -3)).toBe(9);
    expect(applyTransform('inv', 4)).toBe(0.25);
    expect(applyTransform('sqrt', 9)).toBe(3);
    expect(applyTransform('ln', Math.E)).toBeCloseTo(1, 12);
    expect(applyTransform('ln', 0)).toBeNaN();
    expect(applyTransform('inv', 0)).toBeNaN();
    expect(applyTransform('sqrt', -1)).toBeNaN();
  });

  it('propaga la incertidumbre con la derivada', () => {
    expect(propagateTransform('x2', 3, 0.1)).toBeCloseTo(0.6, 12);
    expect(propagateTransform('inv', 2, 0.1)).toBeCloseTo(0.025, 12);
    expect(propagateTransform('sqrt', 4, 0.1)).toBeCloseTo(0.025, 12);
    expect(propagateTransform('ln', 5, 0.1)).toBeCloseTo(0.02, 12);
  });

  it('actualiza la etiqueta y la unidad del eje', () => {
    expect(transformAxis('x2', 'Tiempo', 's').text).toBe('Tiempo² (s²)');
    expect(transformAxis('inv', 'Volumen', 'mL').text).toBe('1/Volumen (1/mL)');
    expect(transformAxis('sqrt', 'Longitud', 'm').text).toBe('√Longitud (√m)');
    expect(transformAxis('ln', 'Presión', 'kPa').text).toBe('ln(Presión/kPa)');
    expect(transformAxis('x', 'Masa', 'g').text).toBe('Masa (g)');
  });
});

describe('formato con incertidumbre', () => {
  it('redondea la incertidumbre a 2 cifras y el valor a la misma posición', () => {
    expect(formatWithUncertainty(2.2, Math.sqrt(0.18))).toBe('2,20 ± 0,42');
    expect(formatWithUncertainty(9.81234, 0.0567)).toBe('9,812 ± 0,057');
    expect(formatWithUncertainty(1234567, 2345)).toBe('(1,2346 ± 0,0023) × 10⁶');
    expect(formatWithUncertainty(2, NaN)).toBe('2,000 ± —');
  });
});

import { describe, expect, it } from 'vitest';
import {
  AIRY_ZEROS, GRATINGS, airyDarkRing, airyIntensity, analyzeCursors, apertureFor, besselJ1, doubleSlitIntensity, findGrating,
  findSource, fringeSpacingSmallAngle, gratingIntensity, gratingOrders, intensity, interferenceModelSpec, nSlitFactor, screenColor,
  screenPosition, sensorIntensity, singleSlitIntensity, singleSlitMinima, sinThetaOnScreen, thinFilmColor, thinFilmConstructive,
  thinFilmReflectance, wavelengthLinearRgb, wavelengthToHex,
} from '../../src/models/interference';

const nm = 1e-9, um = 1e-6;

describe('rendija simple (sinc²)', () => {
  it('es 1 en el centro y se anula exactamente donde a·sen θ = m·λ', () => {
    const a = 80 * um, l = 650 * nm;
    expect(singleSlitIntensity(0, a, l)).toBe(1);
    for (const m of [1, 2, 3, -1, -2]) expect(singleSlitIntensity((m * l) / a, a, l)).toBeLessThan(1e-25);
  });
  it('el primer máximo secundario vale ≈ 4,72 % (β ≈ 1,4303π)', () => {
    const a = 80 * um, l = 650 * nm;
    expect(singleSlitIntensity((1.4303 * l) / a, a, l)).toBeCloseTo(0.0472, 4);
  });
  it('los mínimos en la pantalla usan y = L·tan θ (exacto) y se separan al estrechar la rendija', () => {
    const wide = singleSlitMinima(100 * um, 650 * nm, 1)[0];
    const narrow = singleSlitMinima(50 * um, 650 * nm, 1)[0];
    expect(wide.y_mm).toBeCloseTo(1000 * Math.tan(Math.asin(0.0065)), 9);
    expect(narrow.y_mm / wide.y_mm).toBeCloseTo(2, 3);
  });
});

describe('doble rendija', () => {
  it('Δy ≈ λL/d = 2,60 mm con 650 nm, d = 0,25 mm y L = 1 m; los máximos caen en d·sen θ = m·λ', () => {
    expect(fringeSpacingSmallAngle(650 * nm, 1, 250 * um) * 1000).toBeCloseTo(2.6, 10);
    const orders = gratingOrders(250 * um, 650 * nm, 1).filter((o) => o.m > 0);
    expect(orders[0].y_mm).toBeCloseTo(2.6, 2);
    expect(orders[1].y_mm - orders[0].y_mm).toBeCloseTo(2.6, 2);
    for (const m of [1, 2, 3]) {
      const s = (m * 650 * nm) / (250 * um);
      // Máximo de interferencia (cos² = 1): la intensidad es la de la envolvente.
      expect(doubleSlitIntensity(s, 250 * um, 50 * um, 650 * nm)).toBeCloseTo(singleSlitIntensity(s, 50 * um, 650 * nm), 12);
    }
  });
  it('mínimos de interferencia en d·sen θ = (m + ½)·λ y orden ausente cuando d/a es entero', () => {
    expect(doubleSlitIntensity((0.5 * 650 * nm) / (250 * um), 250 * um, 50 * um, 650 * nm)).toBeLessThan(1e-25);
    // d/a = 5: el 5.º máximo coincide con el primer cero de la envolvente.
    expect(doubleSlitIntensity((5 * 650 * nm) / (250 * um), 250 * um, 50 * um, 650 * nm)).toBeLessThan(1e-20);
  });
  it('más λ o más L separa las franjas; más d las junta', () => {
    const base = fringeSpacingSmallAngle(532 * nm, 1, 250 * um);
    expect(fringeSpacingSmallAngle(650 * nm, 1, 250 * um)).toBeGreaterThan(base);
    expect(fringeSpacingSmallAngle(532 * nm, 2, 250 * um)).toBeCloseTo(2 * base, 12);
    expect(fringeSpacingSmallAngle(532 * nm, 1, 500 * um)).toBeCloseTo(base / 2, 12);
  });
});

describe('red de difracción (ángulos exactos)', () => {
  it('600 líneas/mm y 532 nm: θ₁ = arcsen(0,3192) ≈ 18,61°, distinto de la aproximación de ángulo pequeño', () => {
    const d = 1e-3 / 600;
    const o = gratingOrders(d, 532 * nm, 0.5);
    const first = o.find((x) => x.m === 1)!;
    expect(first.sinTheta).toBeCloseTo(0.3192, 10);
    expect(first.thetaDeg).toBeCloseTo((Math.asin(0.3192) * 180) / Math.PI, 10);
    expect(first.thetaDeg).toBeCloseTo(18.61, 2);
    expect(first.y_mm).toBeCloseTo(500 * Math.tan(Math.asin(0.3192)), 8);
    expect(first.y_mm).toBeGreaterThan(500 * 0.3192 * 1.05); // L·sen θ subestima en más de 5 %
  });
  it('solo existen los órdenes con |m·λ/d| < 1', () => {
    expect(Math.max(...gratingOrders(1e-3 / 600, 650 * nm, 1).map((o) => o.m))).toBe(2);
    expect(gratingOrders(1e-3 / 1350, 650 * nm, 1).map((o) => o.m)).toEqual([-1, 0, 1]);
    expect(Math.max(...gratingOrders(1.6 * um, 405 * nm, 1).map((o) => o.m))).toBe(3);
  });
  it('los máximos principales valen sinc² de la envolvente y son muy estrechos (N rendijas)', () => {
    const ap = apertureFor({ kind: 'red', a_um: 50, d_um: 250, D_um: 100, gratingId: 'r300' });
    expect(ap.N).toBe(300);
    const s1 = (650 * nm) / ap.d;
    expect(gratingIntensity(s1, ap.d, ap.a, ap.N, 650 * nm)).toBeCloseTo(singleSlitIntensity(s1, ap.a, 650 * nm), 9);
    // Primer cero junto al máximo: φ/2 desplazado en π/N.
    const sZero = s1 + (650 * nm) / (ap.N * ap.d);
    expect(gratingIntensity(sZero, ap.d, ap.a, ap.N, 650 * nm)).toBeLessThan(1e-12);
    expect(nSlitFactor(2 * Math.PI * 3, 1000)).toBe(1);
  });
  it('CD ≈ 625 líneas/mm y DVD ≈ 1350 líneas/mm', () => {
    expect(findGrating('cd').linesPerMm).toBeCloseTo(625, 6);
    expect(findGrating('dvd').linesPerMm).toBeCloseTo(1351.35, 1);
    expect(GRATINGS.filter((g) => g.hidden).map((g) => g.id)).toEqual(['cd', 'dvd']);
  });
});

describe('abertura circular (Airy)', () => {
  it('J₁ coincide con valores de tabla y con su representación integral', () => {
    expect(besselJ1(1)).toBeCloseTo(0.4400506, 6);
    expect(besselJ1(5)).toBeCloseTo(-0.3275791, 6);
    expect(besselJ1(3.831706)).toBeCloseTo(0, 6);
    const integral = (x: number) => { let s = 0; const n = 400; for (let i = 0; i < n; i++) { const t = ((i + 0.5) * Math.PI) / n; s += Math.cos(t - x * Math.sin(t)); } return s / n; };
    for (const x of [0.3, 2.2, 3.1, 7.5, 12]) expect(besselJ1(x)).toBeCloseTo(integral(x), 6);
  });
  it('primer anillo oscuro en D·sen θ = 1,22·λ', () => {
    expect(AIRY_ZEROS[0]).toBeCloseTo(1.2197, 4);
    const D = 100 * um, l = 532 * nm;
    expect(airyIntensity(0, D, l)).toBe(1);
    expect(airyIntensity((AIRY_ZEROS[0] * l) / D, D, l)).toBeLessThan(1e-12);
    expect(airyIntensity((1.635 * l) / D, D, l)).toBeCloseTo(0.0175, 3); // primer anillo brillante ≈ 1,75 %
    expect(airyDarkRing(D, l, 1)).toBeCloseTo(1000 * Math.tan(Math.asin((1.2197 * l) / D)), 2);
  });
});

describe('color de la longitud de onda (CIE)', () => {
  const dominant = (l: number) => { const c = wavelengthLinearRgb(l); return c.indexOf(Math.max(...c)); };
  it('rojo, verde y azul quedan en el canal correcto; el violeta mezcla azul con algo de rojo', () => {
    expect(dominant(650)).toBe(0);
    expect(dominant(532)).toBe(1);
    expect(dominant(450)).toBe(2);
    const v = wavelengthLinearRgb(405);
    expect(v[2]).toBe(1);
    expect(v[0]).toBeGreaterThan(v[1]);
    const y = wavelengthLinearRgb(580);
    expect(y[0]).toBe(1); expect(y[1]).toBeGreaterThan(0.3); expect(y[2]).toBeLessThan(0.05); // amarillo anaranjado
    expect(wavelengthToHex(300)).toBe('#000000');
    expect(wavelengthToHex(650)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('la luz blanca se ve blanca en el centro y descompuesta en el primer orden de una red', () => {
    const ap = apertureFor({ kind: 'red', a_um: 50, d_um: 250, D_um: 100, gratingId: 'r300' });
    const white = findSource('blanca');
    const c = screenColor(ap, white, 0);
    expect(c.lum).toBeCloseTo(1, 6);
    for (const ch of c.rgb) expect(ch).toBeCloseTo(1, 6);
    const red = screenColor(ap, white, 650 * nm * 300e3);
    expect(red.rgb[0]).toBeGreaterThan(5 * red.rgb[2]);
    const blue = screenColor(ap, white, 450 * nm * 300e3);
    expect(blue.rgb[2]).toBeGreaterThan(blue.rgb[0]);
  });
});

describe('sensor, cursores, validación y película delgada', () => {
  const sel = { kind: 'doble' as const, a_um: 50, d_um: 250, D_um: 100, gratingId: 'r600' };
  it('el sensor marca 100 % en el centro y casi nada en un mínimo de interferencia', () => {
    const ap = apertureFor(sel);
    const c = sensorIntensity(ap, findSource('rojo'), 100, 0); // ventana de 0,2 mm: promedio algo menor que 100 %
    expect(c).toBeGreaterThan(99.3); expect(c).toBeLessThan(100);
    expect(sensorIntensity(ap, findSource('rojo'), 100, 1.3)).toBeLessThan(1);
    expect(intensity(ap, sinThetaOnScreen(2.6, 1000), 650 * nm)).toBeGreaterThan(0.85);
  });
  it('los cursores en el 2.º máximo (±5,20 mm, L = 100 cm) devuelven λ ≈ 650 nm y d ≈ 250 µm', () => {
    const r = analyzeCursors({ kind: 'doble', dim_um: 250, lambda_nm: 650, L_cm: 100, yA_mm: -5.2, yB_mm: 5.2, m: 2 });
    expect(r.dy).toBeCloseTo(10.4, 10);
    expect(r.lambdaCalc!).toBeCloseTo(649.99, 2);
    expect(r.dimCalc!).toBeCloseTo(250.0, 1);
    const cd = analyzeCursors({ kind: 'red', dim_um: null, lambda_nm: 650, L_cm: 30, yA_mm: -screenPosition(0.65 / 1.6, 300), yB_mm: screenPosition(0.65 / 1.6, 300), m: 1 });
    expect(cd.lambdaCalc).toBeNull();
    expect(cd.dimCalc!).toBeCloseTo(1.6, 6);
    const ring = analyzeCursors({ kind: 'circular', dim_um: 100, lambda_nm: null, L_cm: 100, yA_mm: -airyDarkRing(100 * um, 532 * nm, 1)!, yB_mm: airyDarkRing(100 * um, 532 * nm, 1)!, m: 1 });
    expect(ring.lambdaCalc!).toBeCloseTo(532, 6);
  });
  it('rechaza entradas fuera de rango', () => {
    expect(() => apertureFor({ ...sel, a_um: 10 })).toThrow(RangeError);
    expect(() => apertureFor({ ...sel, a_um: 200, d_um: 150 })).toThrow(RangeError);
    expect(() => apertureFor({ ...sel, kind: 'circular', D_um: 900 })).toThrow(RangeError);
    expect(() => sensorIntensity(apertureFor(sel), findSource('rojo'), 300, 0)).toThrow(RangeError);
    expect(() => analyzeCursors({ kind: 'circular', dim_um: 100, lambda_nm: 532, L_cm: 100, yA_mm: 0, yB_mm: 1, m: 4 })).toThrow(RangeError);
    expect(() => findSource('azul')).toThrow();
  });
  it('película de jabón: negra cuando es muy delgada y refuerzo donde 2nt = (m + ½)λ', () => {
    expect(thinFilmReflectance(550, 0)).toBe(0);
    expect(thinFilmColor(0)).toBe('#000000');
    const t = 100; // 4·n·t = 532 nm
    expect(thinFilmReflectance(4 * 1.33 * t, t)).toBeCloseTo(1, 12);
    expect(thinFilmConstructive(t)).toEqual([4 * 1.33 * t]);
    expect(thinFilmConstructive(900).length).toBe(3);
  });
  it('la ficha del modelo declara supuestos, límites y casos de prueba', () => {
    expect(interferenceModelSpec.assumptions.some((a) => a.includes('Fraunhofer'))).toBe(true);
    expect(interferenceModelSpec.limits.length).toBeGreaterThanOrEqual(4);
    expect(interferenceModelSpec.testCases.length).toBeGreaterThanOrEqual(5);
  });
});

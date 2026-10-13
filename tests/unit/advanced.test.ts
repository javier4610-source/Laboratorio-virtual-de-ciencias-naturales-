import { describe, expect, it } from 'vitest';
import {
  clampParam, effectiveParams, equationSteps, equationText, formatQuantity, isModified, mathToText, modifiedSummary, parseMath,
  varsIn, type ModelParamSpec,
} from '../../src/lib/advanced';
import { CURVE_MODELS, fixedInputsText, hasModelCurve, modelCurve } from '../../src/labs/modelCurves';
import { MODEL_PARAMS } from '../../src/labs/modelParams';
import { simulateCart } from '../../src/models/newton';
import { simulateGas } from '../../src/models/gases';
import { idealRange, simulateShot } from '../../src/models/projectile';
import { exactPeriod } from '../../src/models/pendulum';
import { simulateTrack } from '../../src/models/energy';
import { analyzeManometer, simulateProbe } from '../../src/models/pressure';
import { simulateKinetics } from '../../src/models/kinetics';

describe('notación de ecuaciones', () => {
  it('reconoce fracciones, raíces, subíndices, superíndices y variables', () => {
    const n = parseMath('\\frac{[m]}{[V]}');
    expect(n).toEqual([{ k: 'frac', n: [{ k: 'var', key: 'm' }], d: [{ k: 'var', key: 'V' }] }]);
    expect(mathToText(parseMath('v_{0}^{2}'))).toBe('v₀²');
    expect(mathToText(parseMath('T = 2\\pi\\sqrt{\\frac{L}{g}}'))).toBe('T = 2π√(L / g)');
    expect(mathToText(parseMath('E_{p} = m·g·h'))).toBe('E_p = m · g · h');
    expect(mathToText(parseMath('a = \\frac{F − f}{m}'))).toBe('a = (F − f) / m');
    expect(mathToText(parseMath('v_{1}\\prime'))).toBe('v₁′');
    expect(equationText({ lhs: 'vx', expr: '[v]·\\cos [t]' }, { vx: { sym: 'v_{x}', value: 3.9, unit: 'm/s', decimals: 2 }, v: { sym: 'v_{0}', value: 4.5, unit: 'm/s', decimals: 1 }, t: { sym: '\\theta', value: 30, unit: '°', decimals: 0 } }))
      .toBe('v_x = v₀ · cos θ = 4,5 m/s · cos 30 ° = 3,90 m/s');
    expect(varsIn('\\frac{[m]·[g]}{[V]} + [m]')).toEqual(['m', 'g', 'V']);
  });

  it('rechaza llaves sin cerrar y comandos desconocidos', () => {
    expect(() => parseMath('\\frac{a}{b')).toThrow(/Falta/);
    expect(() => parseMath('\\foo')).toThrow(/desconocido/);
  });

  it('formatea magnitudes con coma decimal y unidades', () => {
    expect(formatQuantity({ sym: 'm', value: 21.6, unit: 'g', decimals: 1 })).toBe('21,6 g');
    expect(formatQuantity({ sym: 'P', value: 101325, unit: 'Pa' })).toBe('1,01 × 10⁵ Pa');
    expect(formatQuantity({ sym: 'I', value: 0.0005, unit: 'A' })).toBe('5,00 × 10⁻⁴ A');
    expect(formatQuantity({ sym: 'x', value: null, unit: 'm' })).toBe('—');
  });
});

describe('sustitución de valores paso a paso', () => {
  const vars = {
    rho: { sym: '\\rho', value: 2.7, unit: 'g/cm³', decimals: 2 },
    m: { sym: 'm', value: 21.6, unit: 'g', decimals: 1 },
    V: { sym: 'V', value: 8, unit: 'cm³', decimals: 2 },
  };
  it('densidad: símbolos, valores y resultado', () => {
    expect(equationText({ lhs: 'rho', expr: '\\frac{[m]}{[V]}' }, vars)).toBe('ρ = m / V = 21,6 g / 8,00 cm³ = 2,70 g/cm³');
  });
  it('productos con unidades y valores negativos entre paréntesis', () => {
    const v = { F: { sym: 'F_{neta}', value: -1.5, unit: 'N', decimals: 2 }, m: { sym: 'm', value: 0.5, unit: 'kg', decimals: 2 }, a: { sym: 'a', value: -3, unit: 'm/s²', decimals: 2 } };
    expect(equationText({ lhs: 'F', expr: '[m]·[a]' }, v)).toBe('F_neta = m · a = 0,50 kg · (−3,00 m/s²) = (−1,50 N)');
  });
  it('si falta un valor solo se muestra la forma simbólica', () => {
    const s = equationSteps({ lhs: 'rho', expr: '\\frac{[m]}{[V]}' }, { ...vars, m: { ...vars.m, value: null } });
    expect(s.missing).toEqual(['m']);
    expect(s.steps).toHaveLength(1);
    expect(s.text).toBe('ρ = m / V');
  });
  it('las potencias de magnitudes con unidad van entre paréntesis y −0 se escribe 0', () => {
    const v = { E: { sym: 'E_{c}', value: 0.0375, unit: 'J', decimals: 4 }, m: { sym: 'm', value: 0.3, unit: 'kg', decimals: 2 }, v: { sym: 'v', value: 0.5, unit: 'm/s', decimals: 2 } };
    expect(equationText({ lhs: 'E', expr: '\\frac{1}{2}·[m]·[v]^{2}' }, v)).toBe('E_c = 1 / 2 · m · v² = 1 / 2 · 0,30 kg · (0,50 m/s)² = 0,0375 J');
    expect(formatQuantity({ sym: 'x', value: -0.00001, decimals: 3 })).toBe('0,000');
    expect(formatQuantity({ sym: 'x', value: -2.5, decimals: 1 })).toBe('−2,5');
  });
  it('raíces y potencias con valores', () => {
    const v = { T: { sym: 'T', value: 2.006, unit: 's', decimals: 3 }, L: { sym: 'L', value: 1, unit: 'm', decimals: 2 }, g: { sym: 'g', value: 9.81, unit: 'm/s²', decimals: 2 } };
    expect(equationText({ lhs: 'T', expr: '2\\pi\\sqrt{\\frac{[L]}{[g]}}' }, v)).toBe('T = 2π√(L / g) = 2π√(1,00 m / 9,81 m/s²) = 2,006 s');
  });
});

describe('parámetros editables', () => {
  const g: ModelParamSpec = MODEL_PARAMS.newton[0];
  it('acota al rango seguro y redondea al paso', () => {
    expect(clampParam(g, 100)).toBe(25);
    expect(clampParam(g, -3)).toBe(1);
    expect(clampParam(g, 1.623)).toBe(1.62);
    expect(clampParam(g, NaN)).toBe(9.8);
  });
  it('sin modo avanzado siempre se usan los valores de referencia', () => {
    expect(effectiveParams([g], { g: 1.62 }, false)).toEqual({ g: 9.8 });
    expect(effectiveParams([g], { g: 1.62 }, true)).toEqual({ g: 1.62 });
    expect(isModified(g, 9.8)).toBe(false);
    expect(isModified(g, 9.7)).toBe(true);
  });
  it('resumen para la observación del ensayo', () => {
    expect(modifiedSummary([g], { g: 1.62 })).toBe('Parámetro del modelo modificado: g = 1,62 m/s² (referencia 9,80)');
    expect(modifiedSummary([g], { g: 9.8 })).toBe('');
  });
  it('al menos 6 prácticas tienen parámetros editables y los modelos los usan', () => {
    expect(Object.keys(MODEL_PARAMS).length).toBeGreaterThanOrEqual(6);
    expect(simulateCart({ mass: 1, force: 5, surfaceId: 'madera', g: 1.62 }).acceleration).toBeCloseTo(5 - 0.15 * 1.62, 6);
    expect(simulateCart({ mass: 1, force: 5, surfaceId: 'madera' }).acceleration).toBeCloseTo(5 - 0.15 * 9.8, 6);
    expect(simulateShot({ v0: 5, angle: 45, height: 0, sphereId: 'acero', air: false, g: 1.62 }).range).toBeCloseTo(25 / 1.62, 3);
    expect(simulateGas({ law: 'boyle', volume: 100, temperature: 25, pressure: 101.3, moles: 0.00818 }).pressure).toBeCloseTo(202.8, 0);
    const e1 = simulateTrack({ mass: 0.5, startHeight: 1, hillHeight: 0.5, mu: 0, rolling: false });
    const e2 = simulateTrack({ mass: 0.5, startHeight: 1, hillHeight: 0.5, mu: 0, rolling: false, g: 1.62 });
    expect(e2.speedBottom / e1.speedBottom).toBeCloseTo(Math.sqrt(1.62 / 9.8), 2);
    const probe = simulateProbe({ liquid: 'dulce', depthCm: 10, orientationDeg: 0, altitudeM: 0, atmosphere: 'estandar', g: 1.62 });
    expect(probe.gauge).toBeCloseTo(probe.rho * 1.62 * 0.1, 6);
    expect(analyzeManometer(100, 1000, 1.62).gauge).toBeCloseTo(997 * 1.62 * 0.1, 6);
    const k45 = simulateKinetics({ reaction: 'marmol', concentration: 1, temperature: 35 }).rateConstant;
    const k80 = simulateKinetics({ reaction: 'marmol', concentration: 1, temperature: 35, eaMarble: 80000 }).rateConstant;
    expect(k80).toBeGreaterThan(k45);
  });
});

describe('curvas del modelo', () => {
  it('hay curvas para al menos 8 prácticas', () => {
    expect(Object.keys(CURVE_MODELS).length).toBeGreaterThanOrEqual(8);
    expect(hasModelCurve('densidad', 'medidas')).toBe(true);
    expect(hasModelCurve('mendel', 'cruces')).toBe(false);
  });
  it('densidad: m = ρ·V (recta de pendiente ρ) también con x = V desplazado', () => {
    const f = modelCurve('densidad', 'medidas', 'vdesp', 'masa', { material: 'Aluminio', lado: 2, vi: 50, flota: 'no' })!;
    expect(f(8)).toBeCloseTo(21.6, 6);
    expect(f(20)).toBeCloseTo(54, 6);
    // El corcho flota: con x = V desplazado la masa es ρ_agua·V (Arquímedes).
    const c = modelCurve('densidad', 'medidas', 'vdesp', 'masa', { material: 'Corcho', lado: 2, vi: 50, flota: 'sí' })!;
    expect(c(5)).toBeCloseTo(0.998 * 5, 6);
  });
  it('newton: a(F) coincide con el modelo y respeta la fricción estática y g modificada', () => {
    const f = modelCurve('newton', 'carrito', 'fuerza', 'aMedida', { superficie: 'Madera pulida', masa: 1, fuerza: 2 })!;
    expect(f(5)).toBeCloseTo(5 - 0.15 * 9.8, 6);
    expect(f(1)).toBe(0); // no supera la fricción estática (0,2·9,8 N)
    const fl = modelCurve('newton', 'carrito', 'fuerza', 'aMedida', { superficie: 'Madera pulida', masa: 1, fuerza: 2 }, { g: 1.62 })!;
    expect(fl(5)).toBeCloseTo(5 - 0.15 * 1.62, 6);
    const inv = modelCurve('newton', 'carrito', 'inversoMasa', 'aMedida', { superficie: 'Riel de colchón de aire (casi sin fricción)', masa: 1, fuerza: 2 })!;
    expect(inv(2)).toBeCloseTo(4, 6);
  });
  it('gases: Boyle P = nRT/V y 1/V lineal', () => {
    const f = modelCurve('gases', 'mediciones', 'volumen', 'presion', { ley: 'Temperatura constante (Boyle)', volumen: 100, temperatura: 25 })!;
    expect(f(50)).toBeCloseTo(simulateGas({ law: 'boyle', volume: 50, temperature: 25, pressure: 0 }).pressure, 6);
    const g = modelCurve('gases', 'mediciones', 'inversoV', 'presion', { ley: 'Temperatura constante (Boyle)', volumen: 100, temperatura: 25 })!;
    expect(g(0.02)).toBeCloseTo(f(50), 6);
    const c = modelCurve('gases', 'mediciones', 'temperaturaK', 'volumen', { ley: 'Presión constante (Charles)', volumen: 100, temperatura: 25 })!;
    expect(c(373.15)).toBeCloseTo(simulateGas({ law: 'charles', volume: 0, temperature: 100, pressure: 0 }).volume, 6);
  });
  it('péndulo, proyectiles y ondas', () => {
    const T = modelCurve('pendulo', 'oscilaciones', 'longitud', 'periodo', { lugar: 'Luna', longitud: 1, amplitud: 10 })!;
    expect(T(0.5)).toBeCloseTo(exactPeriod(0.5, 1.62, 10), 9);
    const R = modelCurve('proyectiles', 'disparos', 'angulo', 'alcance', { esfera: 'Acero', aire: 'Sin aire (ideal)', v0: 4.5, angulo: 30, altura: 0 })!;
    expect(R(45)).toBeCloseTo(idealRange(4.5, 45, 0), 6);
    expect(R(120)).toBeNaN(); // fuera del rango del lanzador
    const L = modelCurve('ondas', 'cuerda', 'frecuencia', 'lambda', { cuerda: 'Cuerda media (algodón)', tension: 20, frecuencia: 5 })!;
    expect(L(10)).toBeCloseTo(10 / 10, 6);
  });
  it('óptica, cinemática, energía y presión', () => {
    const s = modelCurve('optica', 'rayos', 'senoI', 'senoT', { medio1: 'Aire', medio2: 'Agua', incidencia: 30 })!;
    expect(s(0.5)).toBeCloseTo((1.0003 / 1.333) * 0.5, 6);
    const x = modelCurve('cinematica', 'recorridos', 'tiempo', 'distancia', { v0: 2, aceleracion: 1, tiempo: 4 })!;
    expect(x(4)).toBeCloseTo(16, 6);
    const v = modelCurve('energia', 'recorridos', 'altura', 'vValle', { masa: 0.5, altura: 1, colina: 0.5, mu: 0, rueda: 'no' })!;
    expect(v(1)).toBeCloseTo(Math.sqrt(2 * 9.8 * 1), 1);
    const p = modelCurve('presion', 'presion', 'profundidad', 'pMan', { montaje: 'Tanque con sonda', densidad: 1000, profundidad: 10, orientacion: 0 })!;
    expect(p(20)).toBeCloseTo(1000 * 9.78 * 0.2, 6);
    const pg = modelCurve('presion', 'presion', 'profundidad', 'pMan', { montaje: 'Tanque con sonda', densidad: 1000, profundidad: 10, orientacion: 0 }, { g: 1.62 })!;
    expect(pg(20)).toBeCloseTo(1000 * 1.62 * 0.2, 6);
  });
  it('sin relación en el modelo no hay curva', () => {
    expect(modelCurve('densidad', 'medidas', 'masa', 'flota', { material: 'Aluminio', lado: 2, vi: 50 })).toBeNull();
    expect(modelCurve('newton', 'carrito', 'tiempo', 'aMedida', { superficie: 'Madera pulida', masa: 1, fuerza: 2 })).toBeNull();
    expect(modelCurve('newton', 'carrito', 'fuerza', 'aMedida', { superficie: 'Otra', masa: 1, fuerza: 2 })).toBeNull();
  });
  it('describe las condiciones fijas', () => {
    const t = fixedInputsText('newton', 'carrito', 'fuerza', { superficie: 'Madera pulida', masa: 0.5, fuerza: 2 }, { superficie: { label: 'Superficie' }, masa: { label: 'Masa', unit: 'kg' }, fuerza: { label: 'Fuerza', unit: 'N' } });
    expect(t).toBe('Superficie: Madera pulida · Masa: 0,5 kg');
  });
});

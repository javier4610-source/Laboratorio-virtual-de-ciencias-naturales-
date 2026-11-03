import { describe, expect, it } from 'vitest';
import {
  boilingPointC, C_ICE, curveConditions, heatingCurve, isaPressure, L_FUS, L_VAP, particlePositions, plateau, saturationTemperatureK, stateAtQ, stateAtTime, vRms, N_PARTICLES,
} from '../../src/models/statesOfMatter';
import { changeConditions, checkClassification, evaluateChange, gasVolumeML, PROCESSES } from '../../src/models/chemicalChanges';
import { carOnCurve, curveConditions as carConditions, diskAt, maxCurveSpeed, ucm, ucmConditions } from '../../src/models/circularMotion';
import { bench, benchConditions, eyeImage, findEye, power, principalRays, thinLens } from '../../src/models/lenses';
import { compassAt, compassConditions, dipoleField, EARTH, electromagnet, fieldLine, findMagnet, magnetField, magnetsForce, MAGNETS, startDirections, wireField, type V3 } from '../../src/models/magnetism';

describe('estados de la materia', () => {
  it('calores latentes de las entalpías del NIST (6,01 y 40,65 kJ/mol) y ebullición IAPWS-IF97', () => {
    expect(L_FUS).toBe(334);
    expect(L_VAP).toBe(2256);
    expect(boilingPointC(101325)).toBeCloseTo(99.974, 2);
    expect(boilingPointC(1e5)).toBeCloseTo(99.606, 2); // tablas de vapor: 99,61 °C a 1 bar
    expect(saturationTemperatureK(1e6)).toBeCloseTo(453.03, 1); // 179,88 °C a 10 bar
    expect(isaPressure(0)).toBeCloseTo(101325, 6);
    expect(isaPressure(2640)).toBeCloseTo(73379, -1);
    expect(boilingPointC(isaPressure(2640))).toBeCloseTo(91.18, 1);
    expect(boilingPointC(isaPressure(30))).toBeCloseTo(99.87, 2);
  });
  it('curva de 200 g de hielo a −20 °C con 500 W: tramos, mesetas y L = P·Δt/m', () => {
    const c = heatingCurve({ mass: 200, power: 500, t0: -20, tEnd: 110, place: 'apartado' });
    expect(c.segments.map((s) => s.phase)).toEqual(['solido', 'fusion', 'liquido', 'ebullicion', 'vapor']);
    expect(c.segments[0].q1).toBeCloseTo(200 * C_ICE * 20, 9);
    const f = plateau(c, 'fusion')!, b = plateau(c, 'ebullicion')!;
    expect(f.duration).toBeCloseTo(133.6, 9);
    expect(b.duration).toBeCloseTo(902.4, 9);
    expect(f.latent).toBeCloseTo(334, 9);
    expect(b.latent).toBeCloseTo(2256, 9);
    // en la meseta la temperatura no cambia y las fracciones sí
    const mid = stateAtQ(c, (c.segments[1].q0 + c.segments[1].q1) / 2);
    expect(mid).toMatchObject({ phase: 'fusion', T: 0 });
    expect(mid.solid).toBeCloseTo(0.5, 9);
    expect(stateAtTime(c, 1e6).T).toBeCloseTo(110, 9);
    expect(stateAtQ(c, 0).T).toBe(-20);
  });
  it('sin hielo no hay meseta de fusión; la olla a presión hierve a ≈ 120 °C; avisos', () => {
    const c = heatingCurve({ mass: 100, power: 500, t0: 25, tEnd: 90, place: 'apartado' });
    expect(c.segments.map((s) => s.phase)).toEqual(['liquido']);
    expect(heatingCurve({ mass: 100, power: 500, t0: 25, tEnd: 130, place: 'olla' }).tBoil).toBeCloseTo(120.4, 0);
    expect(curveConditions({ mass: 100, power: 500, t0: 25, tEnd: 110, place: 'apartado' }).map((x) => x.text).join(' ')).toMatch(/meseta de la fusión/);
    expect(curveConditions({ mass: 200, power: 500, t0: -20, tEnd: 110, place: 'apartado' })[0].fix).toMatch(/temperatura final/);
    expect(() => heatingCurve({ mass: 10, power: 500, t0: -20, tEnd: 110, place: 'apartado' })).toThrow(RangeError);
  });
  it('partículas: la agitación sigue a √T y en la meseta solo cambia cuántas dejaron la red', () => {
    expect(vRms(100)).toBeCloseTo(718.8, 0);
    const a = particlePositions({ T: 0, solid: 1, gas: 0 }, 0), b = particlePositions({ T: 0, solid: 0.5, gas: 0 }, 0);
    expect(a.amplitude).toBe(b.amplitude);
    expect(a.kind.filter((k) => k === 'red')).toHaveLength(N_PARTICLES);
    expect(b.kind.filter((k) => k === 'red')).toHaveLength(Math.round(0.5 * N_PARTICLES));
    expect(particlePositions({ T: 100, solid: 0, gas: 0 }, 0).amplitude).toBeGreaterThan(a.amplitude);
    const g = particlePositions({ T: 110, solid: 0, gas: 1 }, 3.7);
    expect(g.kind.every((k) => k === 'gas')).toBe(true);
    expect(g.pos.every((p) => p.every((x) => Math.abs(x) <= 2))).toBe(true);
  });
});

describe('cambios físicos y químicos', () => {
  const end = (id: string, a?: number, b?: number) => {
    const p = PROCESSES.find((x) => x.id === id)!;
    const A = a ?? p.amounts[0].initial;
    return evaluateChange({ id: p.id, a: A, b: b ?? p.amounts[1]?.initial, t: p.id === 'vela' ? A : p.duration, prep: 'humeda' });
  };
  const val = (r: ReturnType<typeof evaluateChange>, k: string) => r.quantities.find((x) => x.key === k)!.value;
  it('vinagre + bicarbonato: reactivo límite, CO₂ en el globo con Henry y enfriamiento (ΔH = +31,1 kJ/mol)', () => {
    const r = evaluateChange({ id: 'vinagre-bicarbonato', a: 2, b: 50, t: 1e9 > 30 ? 30 : 0 });
    expect(r.limiting).toBe('el bicarbonato');
    const nMax = 2 / 84.006;
    expect(val(r, 'nCO2') / 1000).toBeCloseTo(nMax * r.progress, 9);
    expect(gasVolumeML(nMax - 1.666e-3)).toBeCloseTo(549, -1);
    expect(val(r, 'dT')).toBeCloseTo(-(nMax * r.progress * 31100) / (52 * 4.18), 9);
    expect(val(r, 'dT')).toBeLessThan(-3);
    expect(end('vinagre-bicarbonato', 5, 10).limiting).toBe('el ácido acético del vinagre');
  });
  it('precipitado: 1,00 mmol = 0,100 g de CaCO₃; hierro: el agua sube el 20,95 % del aire', () => {
    expect(val(end('precipitado'), 'mCaCO3')).toBeCloseTo(0.1001, 3);
    const fe = evaluateChange({ id: 'oxidacion-hierro', a: 1, b: 50, t: 72, prep: 'humeda' });
    expect(val(fe, 'subida')).toBeCloseTo(0.2095 * 50 * fe.progress, 9);
    expect(evaluateChange({ id: 'oxidacion-hierro', a: 1, b: 50, t: 72, prep: 'seca' }).progress).toBeLessThan(0.04);
    expect(val(fe, 'dm')).toBeCloseTo(0.0134, 3);
  });
  it('vela, azúcar y agua: masas de la estequiometría y física de la evaporación', () => {
    const v = end('vela', 10);
    expect(val(v, 'mParafina')).toBeCloseTo(1, 9);
    expect(val(v, 'mCO2')).toBeCloseTo((25 * 44.009) / 352.691, 9);
    const q = end('quemar-azucar', 5);
    expect(val(q, 'carbono') + val(q, 'agua')).toBeCloseTo(5 * q.progress, 9);
    expect(val(end('disolver-azucar', 250, 100), 'sinDisolver')).toBeGreaterThan(49);
    expect(val(end('hervir-agua', 100), 'evaporada')).toBeCloseTo((500 * 300) / 2256, 9);
  });
  it('clasificación y evidencias: burbujas no bastan; el azúcar disuelto se recupera', () => {
    expect(PROCESSES.filter((p) => p.kind === 'fisico').map((p) => p.id)).toEqual(['disolver-azucar', 'hervir-agua']);
    expect(end('hervir-agua').evidence.gas).toMatch(/vapor de agua/);
    expect(end('hervir-agua').evidence.newSubstance).toBe(false);
    expect(checkClassification('hervir-agua', 'quimico').correct).toBe(false);
    expect(checkClassification('precipitado', 'quimico')).toMatchObject({ correct: true });
    expect(end('disolver-azucar').evidence.recover).toMatch(/misma masa/);
    expect(changeConditions({ id: 'oxidacion-hierro', a: 1, b: 50, prep: 'seca' })[0].fix).toMatch(/Humedece/);
    expect(changeConditions({ id: 'vinagre-bicarbonato', a: 5, b: 100 })[0].text).toMatch(/globo/);
    expect(() => evaluateChange({ id: 'precipitado', a: 1, b: 10, t: 0 })).toThrow(RangeError);
  });
});

describe('movimiento circular', () => {
  it('caso de referencia: r = 0,50 m, 200 g, T = 1,00 s', () => {
    const r = ucm({ radius: 0.5, massG: 200, period: 1 });
    expect(r.v).toBeCloseTo(Math.PI, 12);
    expect(r.ac).toBeCloseTo(2 * Math.PI ** 2, 12);
    expect(r.force).toBeCloseTo(0.2 * 2 * Math.PI ** 2, 12);
    expect(r.omega ** 2 * 0.5).toBeCloseTo(r.ac, 12);
  });
  it('proporcionalidades: F ∝ 1/T², F ∝ m, F ∝ r con T fijo', () => {
    const a = ucm({ radius: 0.5, massG: 200, period: 1 }).force;
    expect(ucm({ radius: 0.5, massG: 200, period: 2 }).force).toBeCloseTo(a / 4, 12);
    expect(ucm({ radius: 0.5, massG: 400, period: 1 }).force).toBeCloseTo(2 * a, 12);
    expect(ucm({ radius: 1, massG: 200, period: 1 }).force).toBeCloseTo(2 * a, 12);
  });
  it('la cuerda cortada: velocidad tangente y movimiento rectilíneo uniforme', () => {
    const i = { radius: 0.5, massG: 200, period: 1 };
    const s0 = diskAt(i, 0.3);
    expect(s0.pos[0] * s0.vel[0] + s0.pos[1] * s0.vel[1]).toBeCloseTo(0, 12); // v ⟂ r
    expect(Math.hypot(...s0.acc)).toBeCloseTo(2 * Math.PI ** 2, 9);
    const s1 = diskAt(i, 0.8, 0.3);
    expect(s1.cut).toBe(true);
    expect(s1.acc).toEqual([0, 0]);
    expect(s1.vel).toEqual(s0.vel);
    expect(s1.dist).toBeCloseTo(Math.hypot(0.5, Math.PI * 0.5), 9);
  });
  it('curva: v_máx = √(μgr) = 79,6 km/h seco; derrapa por encima', () => {
    expect(maxCurveSpeed(1, 50) * 3.6).toBeCloseTo(79.6, 1);
    expect(maxCurveSpeed(0.5, 50) * 3.6).toBeCloseTo(56.3, 1);
    expect(carOnCurve({ radius: 50, surface: 'mojado', speedKmh: 60, massKg: 1000 }).skids).toBe(true);
    expect(carConditions({ radius: 50, surface: 'mojado', speedKmh: 60, massKg: 1000 })[0].fix).toMatch(/56 km\/h/);
    expect(ucmConditions({ radius: 1, massG: 500, period: 0.4 })[0].level).toBe('invalido');
  });
});

describe('lentes', () => {
  it('ecuación de las lentes (casos de manual)', () => {
    expect(thinLens(10, 30)).toMatchObject({ real: true, upright: false });
    expect(thinLens(10, 30).di).toBeCloseTo(15, 12);
    expect(thinLens(10, 30).M).toBeCloseTo(-0.5, 12);
    expect(thinLens(10, 20).di).toBeCloseTo(20, 12);
    expect(thinLens(10, 5)).toMatchObject({ real: false, upright: true });
    expect(thinLens(10, 5).M).toBeCloseTo(2, 12);
    expect(thinLens(-15, 30).di).toBeCloseTo(-10, 12);
    expect(thinLens(10, 10).atInfinity).toBe(true);
    expect(power(-50)).toBe(-2);
  });
  it('banco: imagen nítida en la pantalla y mancha borrosa fuera de foco', () => {
    const b = bench({ lens: 'c10', objectX: 10, lensX: 40, screenX: 55, objectH: 3 });
    expect(b.sharp).toBe(true);
    expect(b.hi).toBeCloseTo(-1.5, 12);
    const off = bench({ lens: 'c10', objectX: 10, lensX: 40, screenX: 70, objectH: 3 });
    expect(off.blur).toBeCloseTo((4 * 15) / 15, 12);
    expect(benchConditions({ lens: 'c10', objectX: 10, lensX: 40, screenX: 70, objectH: 3 })[0].fix).toMatch(/pantalla/);
    expect(benchConditions({ lens: 'd15', objectX: 10, lensX: 40, screenX: 70, objectH: 3 })[0].text).toMatch(/divergente/);
  });
  it('los tres rayos principales se cruzan en la imagen real', () => {
    const rays = principalRays(10, 10, 40, 3, 100);
    for (const r of rays) {
      const [p, q] = [r.pts[1], r.pts[2]];
      const y = p[1] + ((q[1] - p[1]) / (q[0] - p[0])) * (55 - p[0]);
      expect(y).toBeCloseTo(-1.5, 9);
    }
  });
  it('el ojo: miopía delante de la retina y corrección con −2 D; hipermetropía detrás y +2,67 D', () => {
    expect(eyeImage('normal', Infinity).where).toBe('retina');
    expect(eyeImage('normal', 25).accommodation).toBeCloseTo(4, 9);
    expect(eyeImage('miopia', Infinity).where).toBe('delante');
    expect(eyeImage('miopia', Infinity, findEye('miopia').correction).where).toBe('retina');
    expect(eyeImage('hipermetropia', 25).where).toBe('detras');
    expect(findEye('hipermetropia').correction).toBeCloseTo(2.667, 3);
    expect(eyeImage('hipermetropia', 25, findEye('hipermetropia').correction).where).toBe('retina');
  });
});

describe('magnetismo', () => {
  const mag = { magnet: findMagnet('ferrita'), center: [0, 0, 0] as V3, angle: 0 };
  it('momentos m = B_r·V/μ₀ y el campo de dos polos tiende al del dipolo lejos del imán', () => {
    expect(MAGNETS[0].moment).toBeCloseTo(1.955, 3);
    const far: V3 = [1, 0.3, 0.2];
    const a = magnetField(mag, far), b = dipoleField([MAGNETS[0].moment, 0, 0], far);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.hypot(...b)).toBeLessThan(0.01);
    expect(magnetField(mag, [0.1, 0, 0])[0]).toBeCloseTo(4.72e-4, 5);
  });
  it('brújula: sin imán apunta 7,5° al oeste (WMM2025) y cerca del polo norte se aleja de él', () => {
    expect(EARTH.H).toBe(26967e-9);
    expect(compassAt(null, 0, 0).angle).toBeCloseTo(-7.48, 9);
    expect(compassAt(mag, 0.1, 0).angle).toBeGreaterThan(80); // la aguja apunta lejos del N (hacia el este; la Tierra la tuerce 3°)
    expect(compassAt(mag, -0.1, 0).angle).toBeGreaterThan(80); // del lado del S apunta hacia el imán (este)
    expect(compassConditions(mag, 0.02, 0)[0].level).toBe('invalido');
  });
  it('líneas de campo: salen del norte, llegan al sur y en 3D salen en todas las direcciones', () => {
    const l = fieldLine(mag, [0, 1, 0]);
    expect(l[l.length - 1]).toEqual([-0.03, 0, 0]);
    const dirs = startDirections(0, 8, true);
    expect(dirs.some((d) => Math.abs(d[2]) > 0.5)).toBe(true);
    expect(startDirections(0, 8, false).every((d) => Math.abs(d[2]) < 1e-12)).toBe(true);
  });
  it('polos iguales se repelen, distintos se atraen, y la fuerza baja con la distancia', () => {
    const m = MAGNETS[0];
    expect(magnetsForce(m, 0.02, 'NN')).toBeGreaterThan(0);
    expect(magnetsForce(m, 0.02, 'SS')).toBeCloseTo(magnetsForce(m, 0.02, 'NN'), 12);
    expect(magnetsForce(m, 0.02, 'NS')).toBeCloseTo(-magnetsForce(m, 0.02, 'NN'), 12);
    expect(magnetsForce(m, 0.04, 'NN')).toBeLessThan(magnetsForce(m, 0.02, 'NN'));
  });
  it('Oersted: cable de 1 A a 2 cm da 10 µT y 20,3°; la bobina crece con N·I', () => {
    expect(wireField(1, 0.02)).toBeCloseTo(1e-5, 12);
    expect(electromagnet({ source: 'cable', turns: 50, current: 1, distanceCm: 2 }).deflection).toBeCloseTo(20.35, 1);
    const b1 = electromagnet({ source: 'bobina', turns: 50, current: 1, distanceCm: 10 }).B;
    expect(electromagnet({ source: 'bobina', turns: 100, current: 1, distanceCm: 10 }).B).toBeCloseTo(2 * b1, 15);
    expect(electromagnet({ source: 'bobina', turns: 50, current: 2, distanceCm: 10 }).B).toBeCloseTo(2 * b1, 15);
  });
});

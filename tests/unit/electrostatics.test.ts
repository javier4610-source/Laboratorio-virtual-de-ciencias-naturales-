import { describe, expect, it } from 'vitest';
import {
  chargesFrom, coulombConditions, coulombForce, coulombStation, dipoleBisectorField, equipotentialPoints, equipotentialSegments, fieldAt, fieldLines,
  K_COULOMB, minDistanceForSensor, potentialAt, PRESETS, probe, systemEnergy, type PointCharge,
} from '../../src/models/electrostatics';

const q = (uC: number, x: number, y = 0, z = 0): PointCharge => ({ id: `q${x}${y}`, q: uC * 1e-6, pos: [x, y, z] });

describe('ley de Coulomb', () => {
  it('k = 8,99 × 10⁹ y el caso de referencia: 2 µC y −3 µC a 30 cm → 0,599 N de atracción', () => {
    expect(K_COULOMB).toBe(8.99e9);
    const r = coulombStation({ q1uC: 2, q2uC: -3, rCm: 30 });
    expect(r.F).toBeCloseTo((8.99e9 * 2e-6 * -3e-6) / 0.09, 12);
    expect(r.magnitude).toBeCloseTo(0.5993, 4);
    expect(r.kind).toBe('atracción');
  });
  it('inverso del cuadrado y proporcionalidad con la carga', () => {
    expect(coulombForce(1e-6, 1e-6, 0.2) / coulombForce(1e-6, 1e-6, 0.4)).toBeCloseTo(4, 12);
    expect(coulombForce(2e-6, 1e-6, 0.2) / coulombForce(1e-6, 1e-6, 0.2)).toBeCloseTo(2, 12);
    expect(() => coulombForce(1, 1, 0)).toThrow(RangeError);
  });
  it('avisos con su corrección: la distancia propuesta deja la fuerza dentro del dinamómetro', () => {
    const c = coulombConditions({ q1uC: 10, q2uC: 10, rCm: 5 });
    expect(c[0].level).toBe('invalido');
    const rmin = minDistanceForSensor(10, 10);
    expect(coulombStation({ q1uC: 10, q2uC: 10, rCm: rmin }).overRange).toBe(false);
    expect(coulombStation({ q1uC: 10, q2uC: 10, rCm: rmin - 0.5 }).overRange).toBe(true);
    expect(coulombConditions({ q1uC: 0, q2uC: 3, rCm: 20 })[0].level).toBe('advertencia');
  });
});

describe('campo y potencial (superposición)', () => {
  it('una carga: E = kq/r² radial y V = kq/r', () => {
    const c = [q(2, 0)];
    const E = fieldAt(c, [0.3, 0, 0]);
    expect(E[0]).toBeCloseTo((K_COULOMB * 2e-6) / 0.09, 6);
    expect(E[1]).toBeCloseTo(0, 12);
    expect(potentialAt(c, [0, 0.3, 0])).toBeCloseTo((K_COULOMB * 2e-6) / 0.3, 6);
    expect(fieldAt([q(-2, 0)], [0.3, 0, 0])[0]).toBeLessThan(0); // hacia la carga negativa
  });
  it('dos cargas iguales: E = 0 en el punto medio; dipolo: mediatriz con la fórmula analítica', () => {
    const iguales = chargesFrom(PRESETS.find((p) => p.id === 'iguales')!.charges);
    const E0 = fieldAt(iguales, [0, 0, 0]);
    expect(Math.hypot(...E0)).toBeLessThan(1e-6);
    const dip = chargesFrom(PRESETS.find((p) => p.id === 'dipolo')!.charges);
    const y = 0.15, a = 0.1;
    const E = fieldAt(dip, [0, y, 0]);
    expect(E[0]).toBeCloseTo(dipoleBisectorField(2e-6, a, y), 4);
    expect(E[1]).toBeCloseTo(0, 6);
    expect(potentialAt(dip, [0, 0.2, 0])).toBeCloseTo(0, 6); // la mediatriz del dipolo es equipotencial V = 0
  });
  it('fuerza sobre la carga de prueba = q₀·E y la lectura en cm', () => {
    const dip = chargesFrom(PRESETS.find((p) => p.id === 'dipolo')!.charges);
    const r = probe(dip, 10, [0, 15, 0]);
    expect(r.Fmag).toBeCloseTo(r.Emag * 10e-9, 12);
    expect(r.angleDeg).toBeCloseTo(0, 6); // de + (izquierda) hacia − (derecha)
    expect(probe(dip, 10, [-10, 0.5, 0]).warnings[0]).toMatch(/encima/);
  });
  it('energía del sistema U = k·q₁·q₂/r', () => {
    expect(systemEnergy([q(2, 0), q(-3, 0.3)])).toBeCloseTo((K_COULOMB * 2e-6 * -3e-6) / 0.3, 9);
  });
});

describe('líneas de campo y equipotenciales', () => {
  it('las líneas del dipolo salen de + y terminan en −; su número es proporcional a la carga', () => {
    const dip = chargesFrom(PRESETS.find((p) => p.id === 'dipolo')!.charges);
    const lines = fieldLines(dip, { perCharge: 12, step: 0.005, box: 0.5, maxSteps: 600, dims: 2 });
    expect(lines).toHaveLength(12);
    const ending = lines.filter((l) => { const e = l[l.length - 1]; return Math.hypot(e[0] - 0.1, e[1]) < 1e-9; });
    expect(ending.length).toBeGreaterThanOrEqual(8);
    // Cada tramo sigue la dirección del campo
    const l = lines[0];
    const mid = l[Math.floor(l.length / 2)], next = l[Math.floor(l.length / 2) + 1];
    const E = fieldAt(dip, mid);
    const d = [next[0] - mid[0], next[1] - mid[1]];
    expect((E[0] * d[0] + E[1] * d[1]) / (Math.hypot(E[0], E[1]) * Math.hypot(d[0], d[1]))).toBeGreaterThan(0.99);
    const tres = chargesFrom(PRESETS.find((p) => p.id === 'tres')!.charges);
    expect(fieldLines(tres, { perCharge: 10, step: 0.01, box: 0.5, maxSteps: 50, dims: 3 })).toHaveLength(20);
  });
  it('las equipotenciales tienen V constante y son perpendiculares al campo', () => {
    const c = [q(2, 0)];
    const level = (K_COULOMB * 2e-6) / 0.2;
    const [{ segs }] = equipotentialSegments(c, [level], 0.4, 80);
    expect(segs.length).toBeGreaterThan(20);
    for (const [a] of segs) expect(Math.hypot(a[0], a[1])).toBeCloseTo(0.2, 2);
    const pts = equipotentialPoints(c, level, 0.5, 60);
    expect(pts.length).toBe(60);
    for (const p of pts) expect(Math.hypot(...p)).toBeCloseTo(0.2, 6); // una esfera: superficie, no línea
    const ys = pts.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.3); // tiene extensión en las tres dimensiones
  });
});

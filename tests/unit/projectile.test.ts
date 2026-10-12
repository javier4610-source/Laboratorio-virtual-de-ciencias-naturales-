import { describe, expect, it } from 'vitest';
import {
  G, SPHERES, checkTarget, findSphere, idealAnglesToHit, idealFlightTime, idealMaxHeight, idealOptimalAngle, idealRange,
  idealState, mechanicalEnergy, optimalAngle, rangeOf, simulateShot, targetDistance, terminalSpeed,
} from '../../src/models/projectile';

const base = { v0: 5, angle: 30, height: 0, sphereId: 'acero', air: false };

describe('movimiento de proyectiles: modelo ideal (10.º)', () => {
  it('con h = 0 el alcance es v0²·sen2θ/g (5 m/s, 30° → 2,209 m)', () => {
    const r = simulateShot(base);
    const expected = (25 * Math.sin(Math.PI / 3)) / G; // 2,20925…
    expect(r.range).toBeCloseTo(expected, 9);
    expect(r.rangeReading).toBe(2.209);
    expect(r.v0Reading).toBe(5);
  });

  it('ángulos complementarios dan el mismo alcance (h = 0, sin aire)', () => {
    for (const [a, b] of [[30, 60], [15, 75], [20, 70]]) {
      expect(idealRange(6, a, 0)).toBeCloseTo(idealRange(6, b, 0), 9);
    }
    // Y ambos ángulos aparecen como solución para acertar a esa distancia.
    const hit = idealAnglesToHit(5, 0, idealRange(5, 30, 0));
    expect(hit[0]).toBeCloseTo(30, 6);
    expect(hit[1]).toBeCloseTo(60, 6);
  });

  it('con h = 0 el máximo alcance está en 45°; con h > 0 el óptimo es menor que 45°', () => {
    expect(idealOptimalAngle(5, 0)).toBeCloseTo(45, 9);
    const opt = idealOptimalAngle(4.5, 1);
    expect(opt).toBeLessThan(45);
    // tanθ* = v0/√(v0² + 2gh) = 4,5/√(20,25 + 19,6) ≈ 0,7128 → 35,48°
    expect(opt).toBeCloseTo(35.48, 2);
    // Comprobación por barrido: ningún ángulo supera al óptimo.
    const best = idealRange(4.5, opt, 1);
    for (let a = 0; a <= 90; a += 1) expect(idealRange(4.5, a, 1)).toBeLessThanOrEqual(best + 1e-12);
    expect(idealRange(4.5, 45, 1)).toBeLessThan(best);
  });

  it('altura máxima: h + (v0·senθ)²/(2g); a 90° sube v0²/(2g)', () => {
    expect(idealMaxHeight(4.5, 30, 1)).toBeCloseTo(1 + (2.25 * 2.25) / (2 * 9.8), 12); // 1,2583 m
    expect(idealMaxHeight(9.8, 90, 0)).toBeCloseTo(4.9, 12);
    const r = simulateShot({ ...base, v0: 4.5, height: 1 });
    expect(r.maxHeight).toBeCloseTo(1.2583, 4);
    // La imagen estroboscópica más alta, leída al centímetro.
    expect(r.maxHeightReading).toBe(1.26);
  });

  it('tiempo de vuelo: 2v0·senθ/g con h = 0; caída horizontal desde h: √(2h/g)', () => {
    expect(idealFlightTime(9.8, 30, 0)).toBeCloseTo(1, 12);
    expect(idealFlightTime(5, 0, 1.225)).toBeCloseTo(0.5, 12);
    expect(idealRange(5, 0, 1.225)).toBeCloseTo(2.5, 12);
    const r = simulateShot({ ...base, v0: 4.5, height: 1 });
    // t = [2,25 + √(2,25² + 19,6)]/9,8 = 0,7357 s
    expect(r.timeReading).toBe(0.736);
    expect(r.rangeReading).toBe(2.87);
    expect(r.path[r.path.length - 1].y).toBe(0);
    expect(r.strobe.every((p, i) => Math.abs(p.t - i * 0.05) < 1e-9)).toBe(true);
  });

  it('la energía mecánica se conserva sin aire', () => {
    const m = 0.0674;
    const tf = idealFlightTime(6, 50, 1.2);
    const s0 = idealState(6, 50, 1.2, 0);
    const e0 = mechanicalEnergy(m, s0.y, s0.vx, s0.vy);
    for (const f of [0.25, 0.5, 0.75, 1]) {
      const s = idealState(6, 50, 1.2, tf * f);
      expect(mechanicalEnergy(m, s.y, s.vx, s.vy)).toBeCloseTo(e0, 12);
    }
    // Rapidez de impacto: √(v0² + 2gh)
    expect(simulateShot({ ...base, v0: 6, angle: 50, height: 1.2 }).impactSpeed).toBeCloseTo(Math.sqrt(36 + 2 * G * 1.2), 9);
  });
});

describe('movimiento de proyectiles: resistencia del aire', () => {
  it('con arrastre el alcance es menor, sobre todo para el icopor', () => {
    const cond = { v0: 6, angle: 40, height: 1 };
    const ideal = idealRange(6, 40, 1);
    const ranges = SPHERES.map((s) => rangeOf({ ...cond, sphereId: s.id, air: true }));
    for (const r of ranges) expect(r).toBeLessThan(ideal);
    const [acero, plastico, icopor] = ranges;
    expect(acero).toBeGreaterThan(plastico);
    expect(plastico).toBeGreaterThan(icopor);
    expect((ideal - acero) / ideal).toBeLessThan(0.03); // el acero casi no lo nota
    expect(icopor / ideal).toBeLessThan(0.6); // el icopor pierde más del 40 %
  });

  it('con arrastre el ángulo óptimo baja de 45° (h = 0)', () => {
    const acero = optimalAngle({ v0: 12, height: 0, sphereId: 'acero', air: true });
    const icopor = optimalAngle({ v0: 12, height: 0, sphereId: 'icopor', air: true });
    expect(acero.angle).toBeLessThan(45);
    expect(icopor.angle).toBeLessThan(acero.angle);
    expect(icopor.angle).toBeLessThan(40);
    // El óptimo numérico es de verdad un máximo.
    expect(acero.range).toBeGreaterThanOrEqual(rangeOf({ v0: 12, height: 0, sphereId: 'acero', air: true, angle: 45 }) - 1e-9);
  });

  it('la energía mecánica disminuye con aire y la rapidez terminal es √(m·g/k)', () => {
    const shot = simulateShot({ v0: 8, angle: 45, height: 1, sphereId: 'plastico', air: true });
    const ideal = Math.sqrt(64 + 2 * G * 1);
    expect(shot.impactSpeed).toBeLessThan(ideal);
    const s = findSphere('icopor');
    const k = 0.5 * 1.2 * 0.47 * Math.PI * 0.0127 ** 2;
    expect(terminalSpeed(s)).toBeCloseTo(Math.sqrt((s.mass * G) / k), 9);
    expect(terminalSpeed(s)).toBeLessThan(5);
  });

  it('el integrador RK4 sin arrastre efectivo reproduce el modelo analítico', () => {
    // Con el acero y v0 baja el arrastre es mínimo: el resultado debe quedar muy cerca del ideal.
    const r = rangeOf({ v0: 2, angle: 45, height: 0, sphereId: 'acero', air: true });
    expect(r).toBeCloseTo(idealRange(2, 45, 0), 2);
  });
});

describe('movimiento de proyectiles: reto y validación', () => {
  it('el blanco es reproducible con la semilla y alcanzable', () => {
    const d1 = targetDistance(7, 3);
    expect(targetDistance(7, 3)).toBe(d1);
    expect(d1).toBeGreaterThanOrEqual(1.05);
    expect(d1).toBeLessThanOrEqual(2.7);
    expect(idealAnglesToHit(4.5, 1, d1).length).toBeGreaterThan(0);
    expect(checkTarget(d1 + 0.04, d1).hit).toBe(true);
    expect(checkTarget(d1 - 0.08, d1)).toEqual({ hit: false, miss: expect.closeTo(-0.08, 9) });
  });

  it('rechaza entradas fuera de rango o esferas desconocidas', () => {
    expect(() => simulateShot({ ...base, v0: 1 })).toThrow(RangeError);
    expect(() => simulateShot({ ...base, v0: 13 })).toThrow(RangeError);
    expect(() => simulateShot({ ...base, angle: -5 })).toThrow(/ángulo/);
    expect(() => simulateShot({ ...base, angle: 95 })).toThrow(RangeError);
    expect(() => simulateShot({ ...base, height: 2 })).toThrow(/altura/);
    expect(() => simulateShot({ ...base, v0: Number.NaN })).toThrow(RangeError);
    expect(() => simulateShot({ ...base, sphereId: 'vidrio' })).toThrow(/desconocida/);
  });

  it('casos límite: θ = 0 y h = 0 no hay vuelo; θ = 90° el alcance es cero', () => {
    const flat = simulateShot({ ...base, angle: 0 });
    expect(flat.flightTime).toBe(0);
    expect(flat.rangeReading).toBe(0);
    expect(simulateShot({ ...base, angle: 0, air: true }).flightTime).toBe(0);
    expect(simulateShot({ ...base, angle: 90 }).rangeReading).toBe(0);
  });
});

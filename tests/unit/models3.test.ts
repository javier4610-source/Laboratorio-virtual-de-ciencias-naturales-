import { describe, expect, it } from 'vitest';
import { applyMethod, evaluate, evaporationMinutes, initialState, type Masses } from '../../src/models/mixtures';
import { criticalAngle, refract } from '../../src/models/optics';
import { simulateCart } from '../../src/models/newton';
import { molesInSyringe, simulateGas } from '../../src/models/gases';
import { simulateTrack } from '../../src/models/energy';
import { linearRegression } from '../../src/models/math';

const mix: Masses = { hierro: 5, arena: 5, sal: 5, aserrin: 0, aceite: 0 };

describe('separación de mezclas (6.º)', () => {
  it('imán → agua → filtración → evaporación separa con alta pureza', () => {
    let s = initialState(mix);
    s = applyMethod(s, 'iman');
    s = applyMethod(s, 'agua', { water: 100 });
    s = applyMethod(s, 'filtracion');
    s = applyMethod(s, 'evaporacion', { power: 500 });
    const ev = Object.fromEntries(evaluate(s, mix).map((e) => [e.component.id, e]));
    expect(ev.hierro.recoveryPercent).toBe(100);
    expect(ev.hierro.purity).toBe(100);
    expect(ev.sal.recoveryPercent).toBeCloseTo(97, 5); // 3 % queda en el papel
    expect(ev.sal.purity).toBe(100);
    expect(ev.arena.purity).toBeGreaterThan(90);
  });
  it('evaporar antes de filtrar deja la sal mezclada con la arena', () => {
    let s = initialState({ ...mix, hierro: 0 });
    s = applyMethod(s, 'agua', { water: 100 });
    s = applyMethod(s, 'evaporacion', { power: 500 });
    const sal = evaluate(s, { ...mix, hierro: 0 }).find((e) => e.component.id === 'sal')!;
    expect(sal.purity).toBeCloseTo(50, 5);
  });
  it('la filtración no separa el aceite; la decantación sí', () => {
    const m = { ...mix, hierro: 0, sal: 0, aceite: 10 };
    let s = applyMethod(applyMethod(initialState(m), 'agua', { water: 100 }), 'filtracion');
    expect(s.vessel.aceite).toBe(10);
    s = applyMethod(s, 'decantacion');
    expect(s.vessel.aceite).toBeCloseTo(0.2, 10);
  });
  it('se conserva la masa total', () => {
    const m = { hierro: 3, arena: 4, sal: 5, aserrin: 2, aceite: 6 };
    let s = initialState(m);
    for (const step of ['iman', 'agua', 'decantacion', 'decantacion', 'filtracion', 'evaporacion'] as const) s = applyMethod(s, step, { water: 150, power: 400 });
    const separated = s.separated.reduce((acc, f) => acc + Object.values(f.masses).reduce((a, b) => a + b, 0), 0);
    const remaining = Object.values(s.vessel).reduce((a, b) => a + b, 0);
    expect(separated + remaining).toBeCloseTo(20, 10);
  });
  it('duplicar la potencia reduce a la mitad el tiempo de evaporación', () => {
    expect(evaporationMinutes(100, 1000)).toBeCloseTo(evaporationMinutes(100, 500) / 2, 10);
    expect(evaporationMinutes(100, 500)).toBeCloseTo((100 * (4.18 * 80 + 2257)) / 300 / 60, 10);
  });
});

describe('óptica (8.º)', () => {
  it('Snell aire → agua y reflexión', () => {
    const r = refract('aire', 'agua', 40);
    expect(r.refraction!).toBeCloseTo(28.8, 1);
    expect(r.reflection).toBe(40);
    expect(r.bendsToward).toBe('la normal');
  });
  it('ángulo crítico y reflexión total interna', () => {
    expect(criticalAngle(1.333, 1.0003)!).toBeCloseTo(48.6, 1);
    expect(criticalAngle(1.52, 1.0003)!).toBeCloseTo(41.15, 1);
    const tir = refract('agua', 'aire', 60);
    expect(tir.totalInternalReflection).toBe(true);
    expect(tir.reflectance).toBe(1);
    expect(criticalAngle(1, 1.5)).toBeNull();
  });
  it('reflectancia a incidencia normal ≈ ((n−1)/(n+1))²', () => {
    expect(refract('aire', 'vidrio', 0).reflectance).toBeCloseTo(((1.52 - 1.0003) / (1.52 + 1.0003)) ** 2, 6);
  });
  it('la pendiente de sen θ₂ contra sen θ₁ es n₁/n₂ (permite hallar n del material misterioso)', () => {
    const xs: number[] = [], ys: number[] = [];
    for (const a of [10, 20, 30, 40, 50, 60]) { const r = refract('aire', 'misterio', a); xs.push(Math.sin((a * Math.PI) / 180)); ys.push(Math.sin((r.refraction! * Math.PI) / 180)); }
    expect(1.0003 / linearRegression(xs, ys)!.slope).toBeCloseTo(1.4, 6);
  });
});

describe('leyes de Newton (9.º)', () => {
  it('sin fricción a = F/m y la medición con fotopuertas coincide', () => {
    const r = simulateCart({ mass: 0.5, force: 2, surfaceId: 'colchon' });
    expect(r.acceleration).toBeCloseTo(4, 10);
    expect(r.measuredAcceleration!).toBeCloseTo(4, 2);
    expect(r.time!).toBeCloseTo(Math.sqrt(0.5), 3);
  });
  it('proporcionalidad con F e inversa con m', () => {
    const a = (F: number, m: number) => simulateCart({ mass: m, force: F, surfaceId: 'colchon' }).acceleration;
    expect(a(4, 0.5) / a(2, 0.5)).toBeCloseTo(2, 10);
    expect(a(2, 1) / a(2, 0.5)).toBeCloseTo(0.5, 10);
  });
  it('fricción estática: fuerza pequeña no mueve el carrito; fricción cinética reduce a', () => {
    expect(simulateCart({ mass: 1, force: 1.5, surfaceId: 'madera' }).moves).toBe(false); // μs·m·g = 1,96 N
    const r = simulateCart({ mass: 1, force: 3, surfaceId: 'madera' });
    expect(r.moves).toBe(true);
    expect(r.acceleration).toBeCloseTo(3 - 0.15 * 9.8, 10);
    expect(simulateCart({ mass: 1, force: 0, surfaceId: 'colchon' }).moves).toBe(false);
  });
});

describe('leyes de los gases (10.º)', () => {
  it('cantidad de gas inicial', () => {
    expect(molesInSyringe()).toBeCloseTo(4.09e-3, 5);
  });
  it('Boyle: P·V constante', () => {
    const a = simulateGas({ law: 'boyle', volume: 100, temperature: 25, pressure: 0 });
    const b = simulateGas({ law: 'boyle', volume: 50, temperature: 25, pressure: 0 });
    expect(a.pressure).toBeCloseTo(101.3, 6);
    expect(b.pressure).toBeCloseTo(202.6, 6);
    expect(a.pv).toBeCloseTo(b.pv, 6);
  });
  it('Charles: la recta V–T(°C) corta el eje en −273,15 °C', () => {
    const ts = [-20, 0, 25, 50, 75, 100];
    const vs = ts.map((t) => simulateGas({ law: 'charles', volume: 0, temperature: t, pressure: 0 }).volume);
    const reg = linearRegression(ts, vs)!;
    expect(-reg.intercept / reg.slope).toBeCloseTo(-273.15, 6);
  });
  it('Gay-Lussac: P/T constante', () => {
    const a = simulateGas({ law: 'gay-lussac', volume: 0, temperature: 0, pressure: 0 });
    const b = simulateGas({ law: 'gay-lussac', volume: 0, temperature: 100, pressure: 0 });
    expect(a.pOverT).toBeCloseTo(b.pOverT, 10);
    expect(b.pressure / a.pressure).toBeCloseTo(373.15 / 273.15, 10);
  });
});

describe('energía mecánica (10.º)', () => {
  const base = { mass: 0.5, startHeight: 1, hillHeight: 0.6, mu: 0, rolling: false };
  it('sin fricción la energía mecánica se conserva y v = √(2gh₀) en el valle', () => {
    const r = simulateTrack(base);
    for (const p of r.points) expect(p.ep + p.ek).toBeCloseTo(r.totalEnergy, 9);
    expect(r.speedBottom).toBeCloseTo(Math.sqrt(2 * 9.8 * 1), 6);
    expect(r.passesHill).toBe(true);
  });
  it('la rapidez no depende de la masa', () => {
    expect(simulateTrack({ ...base, mass: 2 }).speedBottom).toBeCloseTo(simulateTrack(base).speedBottom, 10);
    expect(simulateTrack({ ...base, mass: 2, mu: 0.05 }).speedEnd!).toBeCloseTo(simulateTrack({ ...base, mu: 0.05 }).speedEnd!, 10);
  });
  it('no supera una colina más alta que el punto de salida', () => {
    const r = simulateTrack({ ...base, hillHeight: 1.2 });
    expect(r.passesHill).toBe(false);
    expect(r.stopX!).toBeGreaterThan(1.5);
    expect(r.stopX!).toBeLessThan(2.25);
  });
  it('con fricción la energía mecánica disminuye y la diferencia es la disipada', () => {
    const r = simulateTrack({ ...base, mu: 0.05 });
    expect(r.passesHill).toBe(true);
    const last = r.points[r.points.length - 1];
    expect(last.ep + last.ek).toBeLessThan(r.totalEnergy);
    expect(last.ep + last.ek + last.ef).toBeCloseTo(r.totalEnergy, 9);
  });
  it('al rodar la rapidez es menor (√(10gh/7))', () => {
    expect(simulateTrack({ ...base, rolling: true }).speedBottom).toBeCloseTo(Math.sqrt((10 * 9.8 * 1) / 7), 6);
  });
});

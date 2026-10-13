import { describe, expect, it } from 'vitest';
import {
  MOVERS, REACTION, TIMER_RES, findMover, handTiming, meanSpeed, motionModelSpec, pathLengthAt, positionAt, race,
  simulateMotion, speedAt, stopDistance, timeToReach, toKmh, toMs, tripPosition, validateCourse,
} from '../../src/models/motion';
import { linearRegression } from '../../src/models/math';

describe('movimiento y distancia recorrida', () => {
  it('rapidez constante: 20 m a 4,5 m/s tardan 4,44 s (lectura de fotopuertas)', () => {
    const r = simulateMotion({ moverId: 'corredor', start: 5, finish: 25, trip: 'ida' });
    expect(r.d).toBe(20);
    expect(r.time).toBeCloseTo(40 / 9, 10);
    expect(r.gateTime).toBe(4.44);
    expect(r.meanSpeed).toBeCloseTo(4.5, 10);
    // Con las lecturas redondeadas: 20,00 m / 4,44 s = 4,50 m/s = 16,2 km/h.
    expect(meanSpeed(20, r.gateTime)).toBeCloseTo(4.5045, 4);
    expect(toKmh(meanSpeed(20, r.gateTime))).toBeCloseTo(16.216, 3);
  });

  it('la distancia es proporcional al tiempo y la pendiente de x–t es la rapidez', () => {
    for (const m of MOVERS.filter((x) => x.decel === 0)) {
      const r = simulateMotion({ moverId: m.id, start: 0, finish: 40, trip: 'ida' });
      expect(r.splits.map((s) => s.x)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40]);
      const fit = linearRegression(r.splits.map((s) => s.t), r.splits.map((s) => s.x))!;
      expect(fit.slope).toBeCloseTo(m.v0, 10);
      expect(fit.intercept).toBeCloseTo(0, 10);
      expect(fit.r2).toBeCloseTo(1, 12);
      expect(positionAt(m, 2 * 3)).toBeCloseTo(2 * positionAt(m, 3), 12);
    }
  });

  it('convierte m/s ↔ km/h con el factor 3,6', () => {
    expect(toKmh(1)).toBeCloseTo(3.6, 12);
    expect(toKmh(4.5)).toBeCloseTo(16.2, 12);
    expect(toMs(36)).toBeCloseTo(10, 12);
    expect(toMs(toKmh(1.4))).toBeCloseTo(1.4, 12);
  });

  it('el balón frena: 40 m en 10 s, llega a 2 m/s y su rapidez media baja con la distancia', () => {
    const ball = findMover('balon');
    expect(stopDistance(ball)).toBeCloseTo(45, 12);
    expect(timeToReach(ball, 40)).toBeCloseTo(10, 12);
    expect(speedAt(ball, 10)).toBeCloseTo(2, 12);
    expect(timeToReach(ball, 50)).toBeNull();
    expect(positionAt(ball, 100)).toBeCloseTo(45, 12); // se queda quieto, no retrocede
    const short = simulateMotion({ moverId: 'balon', start: 0, finish: 10, trip: 'ida' });
    const long = simulateMotion({ moverId: 'balon', start: 0, finish: 40, trip: 'ida' });
    expect(long.meanSpeed).toBeCloseTo(4, 12);
    expect(short.meanSpeed).toBeGreaterThan(long.meanSpeed);
    // Los tramos sucesivos de 5 m tardan cada vez más.
    const dt = long.splits.slice(1).map((s, i) => s.t - long.splits[i].t);
    for (let i = 1; i < dt.length; i++) expect(dt[i]).toBeGreaterThan(dt[i - 1]);
    expect(long.warnings.length).toBeGreaterThan(0);
  });

  it('ida y vuelta: distancia 2·d, desplazamiento 0 y velocidad media 0', () => {
    const r = simulateMotion({ moverId: 'caminante', start: 10, finish: 24, trip: 'idavuelta' });
    expect(r.pathLength).toBe(28);
    expect(r.displacement).toBe(0);
    expect(r.meanVelocity).toBe(0);
    expect(r.time).toBeCloseTo(20, 12);
    expect(r.meanSpeed).toBeCloseTo(1.4, 12);
    const m = findMover('caminante');
    expect(tripPosition(m, 14, 'idavuelta', 10)).toBeCloseTo(14, 12);
    expect(tripPosition(m, 14, 'idavuelta', 15)).toBeCloseTo(7, 12);
    expect(tripPosition(m, 14, 'idavuelta', 20)).toBeCloseTo(0, 12);
    expect(pathLengthAt(m, 14, 'idavuelta', 15)).toBeCloseTo(21, 12);
    expect(r.splits[r.splits.length - 1]).toMatchObject({ x: 0, path: 28 });
    expect(() => simulateMotion({ moverId: 'balon', start: 0, finish: 20, trip: 'idavuelta' })).toThrow(RangeError);
  });

  it('carrera balón contra corredor: el resultado depende de la distancia (adelantamiento en 33,75 m)', () => {
    const r20 = race('balon', 'corredor', 20);
    expect(r20.winner).toBe(1);
    expect(r20.overtake).toBeNull();
    const r35 = race('balon', 'corredor', 35);
    expect(r35.winner).toBe(2);
    expect(r35.overtake!.x).toBeCloseTo(33.75, 6);
    expect(r35.overtake!.t).toBeCloseTo(7.5, 6);
    const tie = race('corredor', 'corredor', 30);
    expect(tie.winner).toBe('empate');
    const walkCar = race('caminante', 'carrito', 10);
    expect(walkCar.winner).toBe(1);
    expect(walkCar.gate2).toBeCloseTo(11.11, 10);
  });

  it('cronómetro de mano: reproducible con la semilla, sesgo ≈ −0,2 s y dispersión ≈ 0,08 s', () => {
    const t = 40 / 9;
    expect(handTiming(t, 7)).toEqual(handTiming(t, 7));
    const readings = Array.from({ length: 2000 }, (_, i) => handTiming(t, i + 1));
    const errs = readings.map((r) => r.error);
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    const sd = Math.sqrt(errs.reduce((a, b) => a + (b - mean) ** 2, 0) / (errs.length - 1));
    expect(mean).toBeGreaterThan(-0.24);
    expect(mean).toBeLessThan(-0.16);
    expect(sd).toBeGreaterThan(0.06);
    expect(sd).toBeLessThan(0.1);
    expect(new Set(readings.slice(0, 20).map((r) => r.reading)).size).toBeGreaterThan(3);
    for (const r of readings.slice(0, 200)) {
      expect(r.startDelay).toBeGreaterThanOrEqual(REACTION.startMin);
      expect(Math.round(r.reading / TIMER_RES) * TIMER_RES).toBeCloseTo(r.reading, 10);
    }
    // Un compañero más lento al arrancar hace que el tiempo de mano sea aún más corto.
    const slow = handTiming(t, 3, 0.35);
    const fast = handTiming(t, 3, 0.15);
    expect(slow.reading).toBeLessThan(fast.reading);
  });

  it('rechaza entradas fuera de rango y metas a menos de 5 m de la salida', () => {
    expect(() => validateCourse({ start: -1, finish: 20 })).toThrow(RangeError);
    expect(() => validateCourse({ start: 0, finish: 41 })).toThrow(RangeError);
    expect(() => validateCourse({ start: 20, finish: 23 })).toThrow(RangeError);
    expect(() => validateCourse({ start: 35, finish: 40 })).not.toThrow();
    expect(() => meanSpeed(10, 0)).toThrow(RangeError);
    expect(() => handTiming(5, 1, 0.9)).toThrow(RangeError);
    expect(() => findMover('cohete')).toThrow();
  });

  it('la ficha del modelo declara supuestos, límites y casos de prueba', () => {
    expect(motionModelSpec.inputs.length).toBeGreaterThanOrEqual(4);
    expect(motionModelSpec.assumptions.length).toBeGreaterThanOrEqual(4);
    expect(motionModelSpec.limits.length).toBeGreaterThanOrEqual(3);
    expect(motionModelSpec.testCases.length).toBeGreaterThanOrEqual(8);
  });
});

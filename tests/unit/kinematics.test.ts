import { describe, expect, it } from 'vitest';
import {
  CHALLENGES, MATCH_TOLERANCE, TRACK_LENGTH, challengeError, findChallenge, sampleCurve, simulateRun, stateAt,
} from '../../src/models/kinematics';
import { linearRegression } from '../../src/models/math';

describe('cinemática: MRU y MRUA (9.º)', () => {
  it('MRU (a = 0): la posición crece linealmente y la velocidad es constante', () => {
    const r = simulateRun({ v0: 4, acceleration: 0, duration: 6 });
    expect(r.distance).toBe(24);
    expect(r.finalSpeed).toBe(4);
    expect(r.meanSpeed).toBeCloseTo(4, 10);
    expect(r.endReason).toBe('tiempo');
    for (const p of r.strobe) expect(p.v).toBe(4);
    const fit = linearRegression(r.strobe.map((p) => p.t), r.strobe.map((p) => p.x))!;
    expect(fit.slope).toBeCloseTo(4, 6);
    expect(fit.intercept).toBeCloseTo(0, 6);
    expect(fit.r2).toBeCloseTo(1, 10);
    // Distancias iguales en intervalos iguales entre fotos estroboscópicas.
    const gaps = r.strobe.slice(1).map((p, i) => p.x - r.strobe[i].x);
    for (const g of gaps) expect(g).toBeCloseTo(2, 6);
  });

  it('desde el reposo: d = ½·a·t² y v = a·t', () => {
    const r = simulateRun({ v0: 0, acceleration: 1.5, duration: 4 });
    expect(r.distance).toBe(12);
    expect(r.finalSpeed).toBeCloseTo(6, 10);
    expect(r.meanSpeed).toBeCloseTo(3, 10); // la mitad de la velocidad final
    // Con aceleración constante los espacios entre fotos crecen en progresión aritmética (1:3:5:7…).
    const r2 = simulateRun({ v0: 0, acceleration: 2, duration: 2 });
    const gaps = r2.strobe.slice(1).map((p, i) => p.x - r2.strobe[i].x);
    expect(gaps).toEqual([0.25, 0.75, 1.25, 1.75]);
  });

  it('valores iniciales del laboratorio: 2 m/s, 1 m/s², 5 s → 22,5 m; 7 m/s; 4,5 m/s', () => {
    const r = simulateRun({ v0: 2, acceleration: 1, duration: 5 });
    expect(r.distance).toBe(22.5);
    expect(r.finalSpeed).toBeCloseTo(7, 10);
    expect(r.meanSpeed).toBeCloseTo(4.5, 10);
    expect(r.time).toBe(5);
    expect(r.strobe).toHaveLength(11);
  });

  it('la pendiente de x–t (derivada numérica) es la velocidad en cada instante', () => {
    const v0 = 3, a = 1.2, h = 1e-4;
    for (const t of [0.5, 1, 2.3, 4, 5.5]) {
      const slope = (stateAt(v0, a, t + h).x - stateAt(v0, a, t - h).x) / (2 * h);
      expect(slope).toBeCloseTo(stateAt(v0, a, t).v, 5);
    }
    // También al frenar, antes de detenerse.
    for (const t of [0.5, 1.5, 3]) {
      const slope = (stateAt(8, -2, t + h).x - stateAt(8, -2, t - h).x) / (2 * h);
      expect(slope).toBeCloseTo(stateAt(8, -2, t).v, 5);
    }
  });

  it('el área bajo la gráfica v–t es igual al desplazamiento', () => {
    for (const input of [
      { v0: 2, acceleration: 1, duration: 5 },
      { v0: 8, acceleration: -2, duration: 6 },
      { v0: 5, acceleration: 0, duration: 7 },
    ]) {
      const pts = sampleCurve(input, 0.001);
      let area = 0;
      for (let i = 1; i < pts.length; i++) area += ((pts[i].v + pts[i - 1].v) / 2) * (pts[i].t - pts[i - 1].t);
      expect(area).toBeCloseTo(pts[pts.length - 1].x, 3);
    }
  });

  it('al frenar se detiene en t = v₀/|a| con d = v₀²/(2|a|) y no retrocede', () => {
    const r = simulateRun({ v0: 8, acceleration: -2, duration: 6 });
    expect(r.endReason).toBe('frenado');
    expect(r.stopTime).toBeCloseTo(4, 10);
    expect(r.distance).toBe(16); // 64 / 4
    expect(r.finalSpeed).toBe(0);
    expect(r.meanSpeed).toBeCloseTo(16 / 6, 10);
    expect(r.warnings.join(' ')).toMatch(/se detuvo a los 4,00 s/);
    // Después de detenerse la posición no cambia.
    expect(stateAt(8, -2, 4.5).x).toBe(16);
    expect(stateAt(8, -2, 10).x).toBe(16);
    expect(stateAt(8, -2, 10).v).toBe(0);
    const xs = r.strobe.map((p) => p.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
  });

  it('al llegar al final de la pista el recorrido termina allí y se avisa', () => {
    const r = simulateRun({ v0: 10, acceleration: 0, duration: 8 });
    expect(r.endReason).toBe('pista');
    expect(r.time).toBe(5);
    expect(r.distance).toBe(TRACK_LENGTH);
    expect(r.finalSpeed).toBe(10);
    expect(r.warnings[0]).toMatch(/final de la pista/);
    expect(stateAt(10, 0, 7).x).toBe(TRACK_LENGTH);
    // Con aceleración: 50 = 5t + 1,5t² → t = 4,3 s (aprox.)
    const r2 = simulateRun({ v0: 5, acceleration: 3, duration: 10 });
    expect(r2.endReason).toBe('pista');
    expect(r2.time).toBeCloseTo((-5 + Math.sqrt(25 + 300)) / 3, 2);
    expect(r2.distance).toBe(50);
  });

  it('las lecturas respetan la resolución de los instrumentos (1 cm y 0,01 s)', () => {
    const r = simulateRun({ v0: 1.37, acceleration: 0.73, duration: 3.33 });
    expect(Math.abs(r.distance * 100 - Math.round(r.distance * 100))).toBeLessThan(1e-9);
    expect(Math.abs(r.time * 100 - Math.round(r.time * 100))).toBeLessThan(1e-9);
    for (const p of r.strobe) expect(Math.abs(p.x * 100 - Math.round(p.x * 100))).toBeLessThan(1e-9);
    // Fotos estroboscópicas cada 0,5 s desde t = 0.
    expect(r.strobe.map((p) => p.t)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
  });

  it('rechaza entradas fuera de rango o no numéricas', () => {
    expect(() => simulateRun({ v0: -1, acceleration: 0, duration: 5 })).toThrow(RangeError);
    expect(() => simulateRun({ v0: 11, acceleration: 0, duration: 5 })).toThrow(RangeError);
    expect(() => simulateRun({ v0: 2, acceleration: 3.5, duration: 5 })).toThrow(RangeError);
    expect(() => simulateRun({ v0: 2, acceleration: -4, duration: 5 })).toThrow(RangeError);
    expect(() => simulateRun({ v0: 2, acceleration: 0, duration: 0.5 })).toThrow(RangeError);
    expect(() => simulateRun({ v0: 2, acceleration: 0, duration: 12 })).toThrow(RangeError);
    expect(() => simulateRun({ v0: NaN, acceleration: 0, duration: 5 })).toThrow(/número válido/);
    expect(() => findChallenge('nada')).toThrow();
  });

  it('sin velocidad inicial ni aceleración positiva no hay movimiento', () => {
    const r = simulateRun({ v0: 0, acceleration: -1, duration: 5 });
    expect(r.distance).toBe(0);
    expect(r.finalSpeed).toBe(0);
    expect(r.meanSpeed).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/no se mueve/);
  });
});

describe('reto de gráficas', () => {
  it('el error es 0 cuando los parámetros coinciden con el objetivo', () => {
    for (const c of CHALLENGES) {
      expect(challengeError({ v0: c.v0, acceleration: c.acceleration, duration: c.duration }, c)).toBeCloseTo(0, 12);
      // Un recorrido más largo con los mismos v0 y a también coincide en el intervalo del reto.
      expect(challengeError({ v0: c.v0, acceleration: c.acceleration, duration: 10 }, c)).toBeCloseTo(0, 12);
    }
  });
  it('parámetros distintos o un recorrido demasiado corto superan la tolerancia', () => {
    const c = findChallenge('mru');
    expect(challengeError({ v0: 6, acceleration: 0, duration: 6 }, c)).toBeGreaterThan(MATCH_TOLERANCE);
    expect(challengeError({ v0: 4, acceleration: 0, duration: 3 }, c)).toBeGreaterThan(MATCH_TOLERANCE);
    // Un error pequeño de la velocidad queda dentro de la tolerancia.
    expect(challengeError({ v0: 4.1, acceleration: 0, duration: 6 }, c)).toBeLessThan(MATCH_TOLERANCE);
    // MRU a 4 m/s: error cuadrático medio de una diferencia lineal de 2 m/s·t sobre 0–6 s.
    const e = challengeError({ v0: 2, acceleration: 0, duration: 6 }, c);
    const n = 61;
    let s = 0;
    for (let i = 0; i < n; i++) s += (2 * i * 0.1) ** 2;
    expect(e).toBeCloseTo(Math.sqrt(s / n), 6);
  });
});

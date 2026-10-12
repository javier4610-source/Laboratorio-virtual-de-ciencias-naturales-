import { describe, expect, it } from 'vitest';
import {
  BAR, DYNAMOMETER_MAX, G, fromReadings, leverEffort, leverOrderError, pulleyEffort, sheaveCounts, simpleMachinesModelSpec,
  simulateLever, simulatePulley, supportingStrands, type LeverClass, type LeverInput, type PulleyInput,
} from '../../src/models/simpleMachines';

const lever: LeverInput = { cls: 1, loadMass: 0.4, dR: 0.2, dF: 0.4, barMass: false };
const pulley: PulleyInput = { setup: 'movil', strands: 4, loadMass: 0.4, blockMass: 0, efficiency: 1, rope: 0.4 };
const SIN10 = Math.sin(Math.PI / 18);

describe('palancas (6.º)', () => {
  it('caso inicial calculado a mano: 1.er género, 400 g a 20 cm y la fuerza a 40 cm', () => {
    const r = simulateLever(lever);
    expect(r.R).toBeCloseTo(3.92, 12);
    expect(r.F).toBeCloseTo(1.96, 12);
    expect(r.direction).toBe('abajo'); // en el 1.er género se empuja hacia abajo para subir la carga
    expect(r.vmIdeal).toBeCloseTo(2, 12);
    expect(r.fulcrumForce).toBeCloseTo(3.92 + 1.96, 12); // el fulcro sostiene la carga y la fuerza
    expect(r.loadReading).toBe(3.9);
    expect(r.effortReading).toBe(2.0);
    expect(r.sEffortReading).toBe(6.9); // 40 cm · sen 10° = 6,946 cm
    expect(r.sLoadReading).toBe(3.5); // 20 cm · sen 10° = 3,473 cm
    expect(r.xLoad).toBeCloseTo(0.3, 12);
    expect(r.xEffort).toBeCloseTo(0.9, 12);
  });

  it('cumple la ley de la palanca F·dF = R·dR en los tres géneros', () => {
    const cases: [LeverClass, number, number, number][] = [
      [1, 0.1, 0.05, 0.5], [1, 1, 0.5, 0.05], [1, 0.65, 0.35, 0.15],
      [2, 0.3, 0.1, 1], [2, 1, 0.45, 0.5], [2, 0.75, 0.2, 0.6],
      [3, 0.2, 0.9, 0.3], [3, 0.5, 1, 0.95], [3, 0.1, 0.4, 0.05],
    ];
    for (const [cls, m, dR, dF] of cases) {
      const r = simulateLever({ cls, loadMass: m, dR, dF, barMass: false });
      expect(r.torqueEffort, `${cls}`).toBeCloseTo(r.torqueLoad, 12);
      expect(r.F).toBeCloseTo(leverEffort(m * G, dR, dF), 12);
      expect(r.vm).toBeCloseTo(r.vmIdeal, 12);
    }
  });

  it('el 2.º género siempre ahorra fuerza (VM > 1), el 3.er género nunca (VM < 1)', () => {
    for (let dR = 0.05; dR < 1; dR += 0.05) {
      for (let dF = dR + 0.05; dF <= 1.0001; dF += 0.05) {
        const a = Math.round(dR * 100) / 100, b = Math.min(1, Math.round(dF * 100) / 100);
        expect(simulateLever({ cls: 2, loadMass: 0.5, dR: a, dF: b, barMass: false }).vm).toBeGreaterThan(1);
        expect(simulateLever({ cls: 3, loadMass: 0.5, dR: b, dF: a, barMass: false }).vm).toBeLessThan(1);
      }
    }
    // F es inversamente proporcional a dF: al duplicar dF, la fuerza se reduce a la mitad.
    const f1 = simulateLever({ cls: 2, loadMass: 0.6, dR: 0.2, dF: 0.4, barMass: false }).F;
    const f2 = simulateLever({ cls: 2, loadMass: 0.6, dR: 0.2, dF: 0.8, barMass: false }).F;
    expect(f2).toBeCloseTo(f1 / 2, 12);
  });

  it('la masa de la barra no influye con el fulcro en el centro y aumenta F con el fulcro en el extremo', () => {
    const a = simulateLever({ ...lever, barMass: false });
    const b = simulateLever({ ...lever, barMass: true });
    expect(b.F).toBeCloseTo(a.F, 12);
    expect(b.fulcrumForce - a.fulcrumForce).toBeCloseTo(BAR.mass * G, 12);
    const c2 = { cls: 2 as const, loadMass: 0.5, dR: 0.3, dF: 0.9 };
    const sin = simulateLever({ ...c2, barMass: false }), con = simulateLever({ ...c2, barMass: true });
    expect(con.F - sin.F).toBeCloseTo((BAR.mass * G * 0.5) / 0.9, 12); // 1,96 N · 0,5 m / 0,9 m = 1,0889 N
    expect(con.vm).toBeLessThan(con.vmIdeal);
    expect(con.efficiency).toBeLessThan(1);
  });

  it('palanca ideal: lo que se gana en fuerza se pierde en distancia (W entrada = W salida)', () => {
    for (const cls of [1, 2, 3] as const) {
      const input = cls === 1 ? lever : cls === 2 ? { ...lever, cls, dR: 0.25, dF: 0.75 } : { ...lever, cls, dR: 0.8, dF: 0.2 };
      const r = simulateLever(input);
      expect(r.sEffort / r.sLoad).toBeCloseTo(input.dF / input.dR, 12);
      expect(r.workIn).toBeCloseTo(r.workOut, 12);
      expect(r.efficiency).toBeCloseTo(1, 12);
      expect(r.sLoad).toBeCloseTo(input.dR * SIN10, 12);
    }
  });

  it('rechaza un orden que no corresponde al género y las entradas fuera de rango', () => {
    expect(leverOrderError(2, 0.5, 0.3)).toMatch(/2\.º género/);
    expect(leverOrderError(3, 0.3, 0.5)).toMatch(/3\.er género/);
    expect(leverOrderError(1, 0.3, 0.3)).toBeNull();
    expect(() => simulateLever({ ...lever, cls: 2, dR: 0.5, dF: 0.5 })).toThrow(RangeError);
    expect(() => simulateLever({ ...lever, dF: 0.6 })).toThrow(RangeError); // 1.er género: máximo 50 cm a cada lado
    expect(() => simulateLever({ ...lever, loadMass: 1.5 })).toThrow(RangeError);
    expect(() => simulateLever({ ...lever, cls: 4 as LeverClass })).toThrow();
    expect(() => leverEffort(-1, 0.2, 0.4)).toThrow(RangeError);
  });

  it('el dinamómetro se sale de la escala por encima de 10 N', () => {
    const r = simulateLever({ cls: 3, loadMass: 1, dR: 1, dF: 0.5, barMass: false }); // F = 19,6 N
    expect(r.F).toBeCloseTo(19.6, 12);
    expect(r.F).toBeGreaterThan(DYNAMOMETER_MAX);
    expect(r.overload).toBe(true);
    expect(r.effortReading).toBeNull();
    expect(fromReadings(r.loadReading, r.effortReading, r.sEffortReading, r.sLoadReading).vm).toBeNull();
  });
});

describe('poleas (6.º)', () => {
  it('poleas ideales: F = R/n, h = s/n y el trabajo se conserva', () => {
    for (const [setup, n] of [['fija', 1], ['movil', 2], ['polipasto', 2], ['polipasto', 3], ['polipasto', 4], ['polipasto', 5], ['polipasto', 6]] as const) {
      const r = simulatePulley({ ...pulley, setup, strands: n });
      expect(r.n).toBe(n);
      expect(r.F).toBeCloseTo(r.R / n, 12);
      expect(r.rise).toBeCloseTo(0.4 / n, 12);
      expect(r.workIn).toBeCloseTo(r.workOut, 12);
      expect(r.vm).toBeCloseTo(n, 12);
    }
  });

  it('caso inicial de la polea móvil y lecturas de los instrumentos', () => {
    const r = simulatePulley(pulley);
    expect(r.F).toBeCloseTo(1.96, 12);
    expect(r.direction).toBe('arriba');
    expect(r.effortReading).toBe(2.0);
    expect(r.ropeReading).toBe(40);
    expect(r.riseReading).toBe(20);
    const p3 = simulatePulley({ ...pulley, setup: 'polipasto', strands: 3 });
    expect(p3.riseReading).toBe(13.3); // 40 cm / 3 = 13,33 cm, regla de 1 mm
    expect(p3.effortReading).toBe(1.3); // 3,92 N / 3 = 1,307 N
  });

  it('la polea fija no ahorra fuerza: solo cambia la dirección (y su masa no influye)', () => {
    const a = simulatePulley({ ...pulley, setup: 'fija', blockMass: 0 });
    const b = simulatePulley({ ...pulley, setup: 'fija', blockMass: 0.2 });
    expect(a.F).toBeCloseTo(a.R, 12);
    expect(a.direction).toBe('abajo');
    expect(b.F).toBeCloseTo(a.F, 12);
    expect(a.rise).toBeCloseTo(a.rope, 12);
  });

  it('la masa de la polea móvil también se levanta: F = (R + W_bloque)/2', () => {
    const r = simulatePulley({ ...pulley, blockMass: 0.1 });
    expect(r.F).toBeCloseTo((0.4 * G + 0.1 * G) / 2, 12); // 2,45 N
    expect(r.vm).toBeCloseTo(3.92 / 2.45, 12);
    expect(r.efficiency).toBeCloseTo(0.4 / 0.5, 12);
  });

  it('rozamiento: valores calculados a mano y eficiencia que baja con más poleas', () => {
    const W = 0.4 * G;
    expect(simulatePulley({ ...pulley, setup: 'fija', efficiency: 0.9 }).F).toBeCloseTo(W / 0.9, 12);
    // Polea móvil: T1 + T1/0,9 = W y F = T2 = T1/0,9
    const T1 = W / (1 + 1 / 0.9);
    expect(simulatePulley({ ...pulley, efficiency: 0.9 }).F).toBeCloseTo(T1 / 0.9, 12);
    expect(pulleyEffort(W, 2, 0.9, 1)).toBeCloseTo(T1 / 0.81, 12);
    let prev = 1;
    for (let n = 2; n <= 6; n++) {
      const r = simulatePulley({ ...pulley, setup: 'polipasto', strands: n, efficiency: 0.9 });
      expect(r.F).toBeGreaterThan(r.R / n); // se necesita más fuerza que en el caso ideal
      expect(r.workIn).toBeGreaterThan(r.workOut); // nunca sale más trabajo del que entra
      expect(r.efficiency).toBeLessThan(prev);
      prev = r.efficiency;
    }
  });

  it('número de poleas de cada bloque y validación de entradas', () => {
    expect(sheaveCounts('polipasto', 4)).toEqual({ fixed: 2, movable: 2 });
    expect(sheaveCounts('polipasto', 5)).toEqual({ fixed: 3, movable: 2 });
    expect(supportingStrands('fija', 6)).toBe(1);
    expect(() => supportingStrands('polipasto', 7)).toThrow(RangeError);
    expect(() => supportingStrands('polipasto', 2.5)).toThrow(RangeError);
    expect(() => simulatePulley({ ...pulley, efficiency: 0.5 })).toThrow(RangeError);
    expect(() => simulatePulley({ ...pulley, rope: 0.8 })).toThrow(RangeError);
    expect(() => simulatePulley({ ...pulley, setup: 'grua' as never })).toThrow();
    // 1 kg en una polea fija con rozamiento: 12,25 N, fuera de la escala del dinamómetro
    const big = simulatePulley({ ...pulley, setup: 'fija', loadMass: 1, efficiency: 0.8 });
    expect(big.F).toBeCloseTo(12.25, 12);
    expect(big.effortReading).toBeNull();
  });

  it('la ficha del modelo declara supuestos, límites y casos de prueba', () => {
    expect(simpleMachinesModelSpec.assumptions.join(' ')).toMatch(/g = 9,8/);
    expect(simpleMachinesModelSpec.limits.length).toBeGreaterThanOrEqual(4);
    expect(simpleMachinesModelSpec.testCases.length).toBeGreaterThanOrEqual(8);
  });
});

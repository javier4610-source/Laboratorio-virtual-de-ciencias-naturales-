import { describe, expect, it } from 'vitest';
import {
  actionPotential, conductionTimeMs, dropDistance, exampleCatch, fiber, FIBERS, reactionTime, reflexArc, rulerConditions, stats, V_PEAK, V_REST,
} from '../../src/models/nervousSystem';

describe('regla que cae', () => {
  it('t = √(2d/g) y su inversa', () => {
    expect(reactionTime(23.7)).toBeCloseTo(Math.sqrt(0.474 / 9.8), 12);
    expect(reactionTime(23.7)).toBeCloseTo(0.22, 3);
    expect(dropDistance(reactionTime(17.3))).toBeCloseTo(17.3, 10);
    expect(dropDistance(0.1)).toBeCloseTo(4.9, 10);
  });
  it('avisos: se escapó, anticipación y vacío, con su corrección', () => {
    expect(rulerConditions(31)[0]).toMatchObject({ level: 'invalido' });
    const a = rulerConditions(3);
    expect(a[0].level).toBe('advertencia');
    expect(a[0].fix).toContain('4,9 cm');
    expect(rulerConditions(0)[0].level).toBe('nota');
    expect(rulerConditions(20)).toEqual([]);
  });
  it('datos de ejemplo reproducibles con la media supuesta', () => {
    expect(exampleCatch('visual', 5)).toBe(exampleCatch('visual', 5));
    const ts = Array.from({ length: 400 }, (_, i) => reactionTime(exampleCatch('visual', i + 1)));
    expect(stats(ts).mean).toBeCloseTo(0.22, 2);
    const ta = Array.from({ length: 400 }, (_, i) => reactionTime(exampleCatch('auditivo', i + 1)));
    expect(stats(ta).mean).toBeLessThan(stats(ts).mean);
    expect(stats([1, 2, 3])).toEqual({ n: 3, mean: 2, sd: 1 });
  });
});

describe('potencial de acción (umbral, todo o nada)', () => {
  it('bajo el umbral no hay disparo; por encima, el pico es siempre +30 mV', () => {
    const sub = actionPotential(10);
    expect(sub.fired).toBe(false);
    expect(sub.peak).toBeCloseTo(-60, 9);
    expect(sub.v[sub.v.length - 1]).toBeGreaterThan(V_REST - 0.01);
    for (const s of [15, 25, 40]) {
      const ap = actionPotential(s);
      expect(ap.fired).toBe(true);
      expect(ap.peak).toBeCloseTo(V_PEAK, 6);
      expect(Math.min(...ap.v)).toBeCloseTo(-80, 6);
    }
    expect(actionPotential(0).v.every((v) => v === V_REST)).toBe(true);
  });
});

describe('conducción y arco reflejo', () => {
  it('las velocidades están dentro de los rangos de Kandel y la mielina acelera', () => {
    for (const f of FIBERS) { expect(f.v).toBeGreaterThanOrEqual(f.range[0]); expect(f.v).toBeLessThanOrEqual(f.range[1]); }
    expect(conductionTimeMs(1, fiber('aa').v)).toBeCloseTo(12.5, 12);
    expect(conductionTimeMs(1, fiber('c').v)).toBe(1000);
  });
  it('arco reflejo con 0,8 m y Aδ: 66,3 ms, mucho menos que una reacción voluntaria', () => {
    const r = reflexArc(0.8, 'ad');
    expect(r.totalMs).toBeCloseTo(0.8 / 15 * 1000 + 10 + 3, 9);
    expect(r.totalMs).toBeLessThan(reactionTime(23.7) * 1000);
  });
});

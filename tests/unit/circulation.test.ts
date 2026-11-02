import { describe, expect, it } from 'vitest';
import { cardiacOutput, circulationConditions, cycleAt, exercise, hrMax, pulseFrom15s, recoveryHr, RECOVERY_TAU_MIN, systoleFraction } from '../../src/models/circulation';

const rest = { age: 15, hrRest: 72, svRest: 70, intensity: 0 };

describe('gasto cardíaco y ejercicio', () => {
  it('reposo: 72 × 70 mL = 5,04 L/min y una vuelta de la sangre en ≈ 60 s', () => {
    expect(cardiacOutput(72, 70)).toBeCloseTo(5.04, 12);
    const e = exercise(rest);
    expect(e.co).toBeCloseTo(5.04, 12);
    expect(e.circulationS).toBeCloseTo(59.52, 2);
    expect(e.map).toBeCloseTo(75 + 40 / 3, 12);
  });
  it('Tanaka y Karvonen: FC_máx 197,5 a los 15 años; al 50 %, 134,75 lpm', () => {
    expect(hrMax(15)).toBeCloseTo(197.5, 12);
    const e = exercise({ ...rest, intensity: 50 });
    expect(e.hr).toBeCloseTo(134.75, 12);
    expect(e.sv).toBeCloseTo(105, 12);
    expect(exercise({ ...rest, intensity: 100 }).sv).toBeCloseTo(105, 12);
    expect(exercise({ ...rest, intensity: 100 }).hr).toBeCloseTo(197.5, 12);
  });
  it('con más intensidad suben FC, gasto y PAS; la PAD casi no cambia', () => {
    const a = exercise({ ...rest, intensity: 20 }), b = exercise({ ...rest, intensity: 60 });
    expect(b.hr).toBeGreaterThan(a.hr); expect(b.co).toBeGreaterThan(a.co); expect(b.sbp).toBeGreaterThan(a.sbp);
    expect(Math.abs(b.dbp - a.dbp)).toBeLessThan(3);
  });
  it('recuperación exponencial y pulso de 15 s', () => {
    expect(recoveryHr(72, 160, 0)).toBe(160);
    expect(recoveryHr(72, 160, RECOVERY_TAU_MIN)).toBeCloseTo(72 + 88 / Math.E, 12);
    expect(pulseFrom15s(18)).toBe(72);
  });
});

describe('ciclo cardíaco y válvulas', () => {
  it('fracción sistólica de Guyton: 0,4 a 72 lpm y 0,65 a 216 lpm', () => {
    expect(systoleFraction(72)).toBeCloseTo(0.4, 12);
    expect(systoleFraction(216)).toBeCloseTo(0.65, 12);
  });
  it('en la sístole ventricular las AV se cierran y las semilunares se abren; en la diástole, al revés', () => {
    const s = cycleAt(0.2, 72);
    expect(s).toMatchObject({ phase: 'sistole-ventricular', avOpen: false, semilunarOpen: true });
    expect(s.ventricle).toBeLessThan(1);
    expect(cycleAt(0.6, 72)).toMatchObject({ phase: 'diastole', avOpen: true, semilunarOpen: false, ventricle: 1 });
    expect(cycleAt(0.95, 72)).toMatchObject({ phase: 'sistole-auricular', avOpen: true });
    expect(cycleAt(0.95, 72).atrium).toBeLessThan(1);
    expect(cycleAt(0, 72).periodS).toBeCloseTo(60 / 72, 12);
    expect(cycleAt(0, 72).systoleS).toBeCloseTo(0.3333, 4);
  });
  it('avisos prudentes con corrección', () => {
    const c = circulationConditions({ ...rest, intensity: 90 }, null);
    expect(c[0].level).toBe('advertencia');
    expect(c[0].fix).toContain('avisa al docente');
    expect(circulationConditions(rest, 60)[0].fix).toContain('no es un diagnóstico');
    expect(circulationConditions(rest, 18)).toEqual([]);
  });
});

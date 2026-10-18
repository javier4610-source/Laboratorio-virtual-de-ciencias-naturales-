import { describe, expect, it } from 'vitest';
import {
  DRIFT_TOLERANCE, FALL_LIMITS, GRAVITY_PRESETS, idealFall, linearDragExact, simulateFall, stepFall,
  type FallState,
} from '../../src/models/energyTime';
import { simulateTrack } from '../../src/models/energy';

const REF = { mass: 1, height: 10, v0: 0, g: 9.81 };
const DTS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05];

describe('energyTime · caso de referencia (prompt 9.1)', () => {
  it('m = 1 kg, h = 10 m, g = 9,81 m/s²: Ep₀ = 98,1 J, v = 14,007 m/s, t = 1,4278 s', () => {
    const r = simulateFall({ ...REF, dt: 0.01 });
    expect(r.ep0).toBeCloseTo(98.1, 10);
    expect(r.ek0).toBe(0);
    expect(r.landed).toBe(true);
    expect(r.vGround!).toBeCloseTo(Math.sqrt(2 * 9.81 * 10), 9);
    expect(r.vGround!).toBeCloseTo(14.007, 3);
    expect(r.tGround!).toBeCloseTo(Math.sqrt((2 * 10) / 9.81), 9);
    expect(r.tGround!).toBeCloseTo(1.4278, 4);
    const last = r.points[r.points.length - 1];
    expect(last.y).toBe(0);
    expect(last.t).toBe(r.tGround);
  });

  it('el cruce con el suelo se interpola: no coincide con un múltiplo de Δt y no depende del paso', () => {
    for (const dt of DTS) {
      const r = simulateFall({ ...REF, dt });
      expect(Math.abs(r.tGround! - Math.sqrt(20 / 9.81))).toBeLessThan(1e-9);
      expect(Math.abs(r.vGround! - Math.sqrt(2 * 9.81 * 10))).toBeLessThan(1e-9);
    }
    // con Δt = 0,05 s el último paso completo antes del suelo es t = 1,40 s: la interpolación da 1,4278 s.
    expect(simulateFall({ ...REF, dt: 0.05 }).tGround!).not.toBeCloseTo(1.4, 2);
  });
});

describe('energyTime · conservación de la energía (tolerancia declarada)', () => {
  it(`sin aire, RK4: deriva relativa máxima de Em < ${DRIFT_TOLERANCE} para todo Δt del rango`, () => {
    expect(DRIFT_TOLERANCE).toBe(1e-6);
    for (const dt of DTS) {
      for (const v0 of [-20, -5, 0, 5, 20]) {
        const r = simulateFall({ ...REF, v0, dt });
        expect(r.maxDrift).toBeLessThan(DRIFT_TOLERANCE);
        expect(r.withinTolerance).toBe(true);
        for (const p of r.points) expect(Math.abs(p.em - r.em0) / r.em0).toBeLessThan(DRIFT_TOLERANCE);
      }
    }
  });

  it('Euler explícito (comparación): la deriva supera la tolerancia y crece en proporción a Δt (1.er orden)', () => {
    const d1 = simulateFall({ ...REF, dt: 0.01, method: 'euler' }).maxDrift;
    const d2 = simulateFall({ ...REF, dt: 0.005, method: 'euler' }).maxDrift;
    expect(d1).toBeGreaterThan(DRIFT_TOLERANCE);
    expect(d1 / d2).toBeGreaterThan(1.8);
    expect(d1 / d2).toBeLessThan(2.2);
    expect(simulateFall({ ...REF, dt: 0.01, method: 'euler' }).withinTolerance).toBe(false);
  });

  it('convergencia de RK4 con arrastre lineal (solución exacta): el error baja ≈ 16 veces al reducir Δt a la mitad', () => {
    const P = { mass: 0.5, height: 50, v0: 8, g: 9.81, b: 0.4 };
    const p = { m: P.mass, g: P.g, drag: 'lineal' as const, k: P.b };
    const errAt = (dt: number) => {
      let s: FallState = { t: 0, y: P.height, v: P.v0, edis: 0 };
      const n = Math.round(2 / dt);
      for (let i = 0; i < n; i++) s = stepFall(s, dt, p, 'rk4');
      const ex = linearDragExact(2, P);
      return Math.abs(s.y - ex.y) + Math.abs(s.v - ex.v);
    };
    const e1 = errAt(0.05), e2 = errAt(0.025), e3 = errAt(0.0125);
    expect(e1).toBeGreaterThan(0);
    expect(e1 / e2).toBeGreaterThan(12);
    expect(e1 / e2).toBeLessThan(20);
    expect(e2 / e3).toBeGreaterThan(12);
    expect(e2 / e3).toBeLessThan(20);
    // y la simulación completa coincide con la solución exacta en el instante de llegada
    const r = simulateFall({ mass: P.mass, height: P.height, v0: P.v0, g: P.g, dt: 0.01, drag: 'lineal', dragCoef: P.b });
    expect(Math.abs(linearDragExact(r.tGround!, P).y)).toBeLessThan(1e-6);
  });
});

describe('energyTime · lanzamiento hacia arriba', () => {
  it('altura máxima h₀ + v₀²/(2g) y llegada con √(v₀² + 2gh₀)', () => {
    const r = simulateFall({ mass: 1, height: 10, v0: 10, g: 9.81, dt: 0.01 });
    const ideal = idealFall({ mass: 1, height: 10, v0: 10, g: 9.81 });
    expect(r.apex).not.toBeNull();
    expect(r.apex!.y).toBeCloseTo(10 + 100 / (2 * 9.81), 8);
    expect(r.apex!.t).toBeCloseTo(10 / 9.81, 8);
    expect(ideal.maxHeight).toBeCloseTo(15.0968, 4);
    expect(r.vGround!).toBeCloseTo(ideal.vGround, 8);
    expect(r.tGround!).toBeCloseTo(ideal.tGround, 8);
    expect(r.em0).toBeCloseTo(98.1 + 50, 9);
  });

  it('lanzada hacia abajo no hay punto más alto por encima de h₀', () => {
    const r = simulateFall({ mass: 1, height: 10, v0: -5, g: 9.81, dt: 0.01 });
    expect(r.apex).toBeNull();
    expect(r.vGround!).toBeCloseTo(Math.sqrt(25 + 2 * 9.81 * 10), 8);
  });
});

describe('energyTime · rozamiento con el aire', () => {
  it('con arrastre lineal o cuadrático Em disminuye y Em + E_dis se conserva', () => {
    for (const [drag, c] of [['lineal', 0.5], ['cuadratico', 0.05]] as const) {
      const r = simulateFall({ ...REF, dt: 0.01, drag, dragCoef: c });
      const last = r.points[r.points.length - 1];
      expect(r.edisFinal).toBeGreaterThan(1);
      expect(last.em).toBeLessThan(r.em0 - 1);
      expect(r.vGround!).toBeLessThan(Math.sqrt(2 * 9.81 * 10));
      expect(r.tGround!).toBeGreaterThan(Math.sqrt(20 / 9.81));
      expect(r.maxDrift).toBeLessThan(DRIFT_TOLERANCE); // balance Em + E_dis con RK4 a Δt = 0,01 s
      // E_dis nunca disminuye
      for (let i = 1; i < r.points.length; i++) expect(r.points[i].edis).toBeGreaterThanOrEqual(r.points[i - 1].edis);
    }
  });

  it('con arrastre cuadrático la rapidez no supera la terminal √(m·g/c)', () => {
    const r = simulateFall({ mass: 0.2, height: 50, v0: 0, g: 9.81, dt: 0.01, drag: 'cuadratico', dragCoef: 0.05 });
    const vt = Math.sqrt((0.2 * 9.81) / 0.05);
    expect(r.vGround!).toBeLessThan(vt);
    expect(r.vGround!).toBeGreaterThan(0.99 * vt);
  });

  it('con coeficiente 0 el arrastre coincide con el caso ideal', () => {
    const a = simulateFall({ ...REF, dt: 0.01, drag: 'lineal', dragCoef: 0 });
    expect(a.edisFinal).toBe(0);
    expect(a.vGround!).toBeCloseTo(14.007, 3);
  });
});

describe('energyTime · gravedad de la Luna y de Marte', () => {
  it('presets: Tierra 9,81; Luna 1,62; Marte 3,71 m/s²', () => {
    expect(GRAVITY_PRESETS).toEqual({ tierra: 9.81, luna: 1.62, marte: 3.71 });
  });

  it('desde 10 m: v = √(2gh) y t = √(2h/g); la rapidez no depende de la masa', () => {
    for (const g of [GRAVITY_PRESETS.luna, GRAVITY_PRESETS.marte]) {
      for (const mass of [0.1, 1, 10]) {
        const r = simulateFall({ mass, height: 10, v0: 0, g, dt: 0.01 });
        expect(r.ep0).toBeCloseTo(mass * g * 10, 9);
        expect(r.vGround!).toBeCloseTo(Math.sqrt(2 * g * 10), 8);
        expect(r.tGround!).toBeCloseTo(Math.sqrt(20 / g), 8);
        expect(r.maxDrift).toBeLessThan(DRIFT_TOLERANCE);
      }
    }
    expect(simulateFall({ ...REF, g: 1.62, dt: 0.01 }).vGround!).toBeCloseTo(5.692, 3);
    expect(simulateFall({ ...REF, g: 3.71, dt: 0.01 }).vGround!).toBeCloseTo(8.614, 3);
  });
});

describe('energyTime · validación', () => {
  it('rechaza valores no finitos y fuera de rango', () => {
    const ok = { ...REF, dt: 0.01 };
    expect(() => simulateFall({ ...ok, mass: Number.NaN })).toThrow(RangeError);
    expect(() => simulateFall({ ...ok, height: Number.POSITIVE_INFINITY })).toThrow(/número válido/);
    expect(() => simulateFall({ ...ok, v0: 21 })).toThrow(RangeError);
    expect(() => simulateFall({ ...ok, g: 0 })).toThrow(RangeError);
    expect(() => simulateFall({ ...ok, dt: 0.1 })).toThrow(/paso de tiempo/);
    expect(() => simulateFall({ ...ok, dt: 0.0001 })).toThrow(RangeError);
    expect(() => simulateFall({ ...ok, height: 0 })).toThrow(RangeError);
    expect(() => simulateFall({ ...ok, drag: 'lineal', dragCoef: 1 })).toThrow(/arrastre lineal/);
    expect(() => simulateFall({ ...ok, drag: 'cuadratico', dragCoef: -0.01 })).toThrow(/arrastre cuadrático/);
    expect(() => simulateFall({ ...ok, drag: 'cuadratico', dragCoef: Number.NaN })).toThrow(RangeError);
    expect(() => simulateFall({ ...ok, method: 'verlet' as never })).toThrow(RangeError);
    expect(FALL_LIMITS.height[1]).toBeGreaterThanOrEqual(10); // el caso de referencia es ejecutable
  });

  it('los puntos guardados son finitos, acotados en número y ordenados en el tiempo', () => {
    const r = simulateFall({ mass: 0.1, height: 50, v0: 20, g: 1.62, dt: 0.001 });
    expect(r.points.length).toBeLessThanOrEqual(1000);
    expect(r.steps).toBeGreaterThan(20000);
    for (let i = 1; i < r.points.length; i++) {
      expect(r.points[i].t).toBeGreaterThan(r.points[i - 1].t);
      for (const v of Object.values(r.points[i])) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('energyTime · preservación', () => {
  it('la pista existente sigue dando los mismos valores (Ep = 19,62 J y 6,264 m/s con h = 2 m)', () => {
    const r = simulateTrack({ mass: 1, startHeight: 2, hillHeight: 0.6, mu: 0, rolling: false, g: 9.81 });
    expect(r.totalEnergy).toBeCloseTo(19.62, 10);
    expect(r.speedBottom).toBeCloseTo(6.264, 3);
  });
});

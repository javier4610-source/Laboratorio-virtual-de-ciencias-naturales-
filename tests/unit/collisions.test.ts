import { describe, expect, it } from 'vitest';
import {
  balanceReading, centerOfMassVelocity, collide1D, contactSamples, energyLost, explosionVelocities, finalVelocities,
  gateTime, kineticEnergy, simulateCollision, stateAt, timeline, velocityFromGate, type CollisionInput,
} from '../../src/models/collisions';

const base: CollisionInput = { type: 'elastico', m1: 0.3, m2: 0.2, v1: 0.5, v2: -0.3, e: 0.5, energy: 0.05 };

describe('choques en una dimensión (10.º)', () => {
  it('conserva la cantidad de movimiento en todos los tipos y para muchos casos', () => {
    for (const type of ['elastico', 'parcial', 'inelastico', 'explosion'] as const) {
      for (const [m1, m2, v1, v2, e] of [[0.1, 1, 1, -1, 0.3], [0.5, 0.5, 0.8, 0, 0.7], [0.9, 0.2, 0.2, -0.6, 0], [0.25, 0.75, 1, 0.4, 1]]) {
        const r = simulateCollision({ type, m1, m2, v1, v2, e, energy: 0.1 });
        expect(r.model.pAfter, `${type}`).toBeCloseTo(r.model.pBefore, 12);
      }
    }
  });

  it('valores calculados a mano para el caso inicial (elástico)', () => {
    const r = simulateCollision(base);
    expect(r.model.v1f).toBeCloseTo(-0.14, 12);
    expect(r.model.v2f).toBeCloseTo(0.66, 12);
    expect(r.model.pBefore).toBeCloseTo(0.09, 12);
    expect(r.model.ecBefore).toBeCloseTo(0.0465, 12);
    // Lecturas de las fotopuertas (bandera de 10,0 cm, resolución 0,1 ms)
    expect(r.gates).toEqual({ before1: 0.2, before2: 0.3333, after1: 0.7143, after2: 0.1515 });
    expect(r.measured.v2f).toBeCloseTo(0.1 / 0.1515, 12);
    expect(r.measured.v1f).toBeLessThan(0); // la fotopuerta registra el sentido
    expect(r.balance1).toBe(300);
  });

  it('con e = 1 se conserva la energía cinética; con e < 1 disminuye', () => {
    const el = simulateCollision(base);
    expect(el.model.ecAfter).toBeCloseTo(el.model.ecBefore, 12);
    const part = simulateCollision({ ...base, type: 'parcial', e: 0.5 });
    expect(part.model.ecAfter).toBeLessThan(part.model.ecBefore);
    // e = −(v2' − v1')/(v2 − v1)
    expect(-(part.model.v2f - part.model.v1f) / (part.model.v2 - part.model.v1)).toBeCloseTo(0.5, 12);
  });

  it('con e = 0 (velcro) ambos terminan con la velocidad del centro de masa', () => {
    const r = simulateCollision({ ...base, type: 'inelastico', e: 0.9 });
    expect(r.e).toBe(0);
    expect(r.model.v1f).toBeCloseTo(r.model.v2f, 12);
    expect(r.model.v1f).toBeCloseTo(centerOfMassVelocity(0.3, 0.2, 0.5, -0.3), 12);
    expect(r.model.v1f).toBeCloseTo(0.18, 12);
  });

  it('masas iguales en choque elástico intercambian velocidades', () => {
    const { v1f, v2f } = finalVelocities(0.4, 0.4, 0.7, -0.2, 1);
    expect(v1f).toBeCloseTo(-0.2, 12);
    expect(v2f).toBeCloseTo(0.7, 12);
  });

  it('contra una masa mucho mayor en reposo el deslizador rebota casi con −v', () => {
    const big = collide1D(0.1, 1000, 0.5, 0, 1);
    expect(big.v1f).toBeCloseTo(-0.5, 3);
    expect(big.v2f).toBeLessThan(0.001);
    // Dentro del montaje (1:10) la tendencia ya se nota: el rebote crece con m2
    const r1 = finalVelocities(0.1, 0.5, 0.5, 0, 1).v1f, r2 = finalVelocities(0.1, 1, 0.5, 0, 1).v1f;
    expect(r2).toBeLessThan(r1);
    expect(r2).toBeCloseTo((-0.9 / 1.1) * 0.5, 12);
  });

  it('la energía perdida coincide con ½·μ·(1 − e²)·(v1 − v2)²', () => {
    for (const e of [0, 0.25, 0.5, 0.8, 1]) {
      const r = simulateCollision({ ...base, type: 'parcial', m1: 0.6, m2: 0.35, v1: 0.9, v2: -0.4, e });
      const mu = (0.6 * 0.35) / 0.95;
      expect(r.model.ecLost).toBeCloseTo(0.5 * mu * (1 - e * e) * 1.3 ** 2, 12);
      expect(energyLost(0.6, 0.35, 0.9, -0.4, e)).toBeCloseTo(r.model.ecLost, 12);
    }
  });

  it('una explosión desde el reposo deja p total = 0 y libera la energía elegida', () => {
    const r = simulateCollision({ ...base, type: 'explosion', m1: 0.2, m2: 0.6, energy: 0.12 });
    expect(r.model.pBefore).toBe(0);
    expect(r.model.pAfter).toBeCloseTo(0, 12);
    expect(r.model.ecAfter).toBeCloseTo(0.12, 12);
    expect(r.model.ecLost).toBeCloseTo(-0.12, 12); // se gana energía cinética
    const ex = explosionVelocities(0.2, 0.6, 0.12);
    expect(ex.v1f / ex.v2f).toBeCloseTo(-3, 12); // v1'/v2' = −m2/m1
  });

  it('el centro de masa se mueve con velocidad constante, también durante el contacto', () => {
    for (const type of ['elastico', 'parcial', 'inelastico', 'explosion'] as const) {
      const r = simulateCollision({ ...base, type });
      const tl = timeline(r);
      const xcm = (t: number) => { const s = stateAt(r, tl, t); return (r.m1 * s.x1 + r.m2 * s.x2) / (r.m1 + r.m2); };
      const ts = [0, tl.tContact * 0.5, tl.tContact + tl.tau * 0.3, tl.tContact + tl.tau * 0.8, tl.tEnd];
      const vcm = (xcm(ts[4]) - xcm(ts[0])) / (ts[4] - ts[0]);
      expect(vcm, type).toBeCloseTo(r.vcm, 10);
      for (let i = 1; i < ts.length; i++) expect((xcm(ts[i]) - xcm(ts[0])) / (ts[i] - ts[0]), `${type}:${i}`).toBeCloseTo(r.vcm, 10);
      // p(t) total constante en todas las muestras del contacto
      for (const smp of contactSamples(r)) expect(smp.p, type).toBeCloseTo(r.model.pBefore, 12);
    }
  });

  it('durante el contacto elástico la Ec baja (resorte comprimido) y luego se recupera', () => {
    const r = simulateCollision(base);
    const s = contactSamples(r);
    const min = Math.min(...s.map((q) => q.ec));
    expect(min).toBeLessThan(r.model.ecBefore * 0.9);
    expect(s[s.length - 1].ec).toBeCloseTo(r.model.ecBefore, 12);
  });

  it('si el deslizador 1 no alcanza al 2 no hay choque', () => {
    const r = simulateCollision({ ...base, v1: 0.2, v2: 0.5 });
    expect(r.collides).toBe(false);
    expect(r.model.v1f).toBe(0.2);
    expect(r.model.ecLost).toBe(0);
  });

  it('instrumentos: fotopuerta, sentido, desborde y balanza', () => {
    expect(gateTime(0.3)).toBe(0.3333);
    expect(gateTime(0)).toBeNull();
    expect(gateTime(0.005)).toBeNull(); // > 10 s: el temporizador lo da por detenido
    expect(velocityFromGate(0.25, -1)).toBeCloseTo(-0.4, 12);
    expect(velocityFromGate(null, 1)).toBe(0);
    expect(balanceReading(0.25)).toBe(250);
    expect(kineticEnergy(0.2, 1)).toBeCloseTo(0.1, 12);
  });

  it('rechaza entradas fuera de rango', () => {
    expect(() => simulateCollision({ ...base, m1: 0.05 })).toThrow(RangeError);
    expect(() => simulateCollision({ ...base, m2: 1.5 })).toThrow(RangeError);
    expect(() => simulateCollision({ ...base, v1: 1.2 })).toThrow(RangeError);
    expect(() => simulateCollision({ ...base, e: -0.1 })).toThrow(RangeError);
    expect(() => simulateCollision({ ...base, energy: 1 })).toThrow(RangeError);
    expect(() => simulateCollision({ ...base, v2: Number.NaN })).toThrow(RangeError);
    expect(() => simulateCollision({ ...base, type: 'rebote' as never })).toThrow();
  });
});

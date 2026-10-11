import { describe, expect, it } from 'vitest';
import {
  carryingCapacity, derivatives, EFFICIENCY, FOODWEB_DEFAULTS, INITIAL_BIOMASS, K_NORMAL, percentChange,
  simulateFoodWeb, SPECIES_IDS, type FoodWebInput,
} from '../../src/models/foodweb';

const run = (over: Partial<FoodWebInput> = {}) => simulateFoodWeb({ ...FOODWEB_DEFAULTS, ...over });
const base = run();

describe('red alimentaria del potrero (6.º)', () => {
  it('escenario base: coexisten las 6 especies en un equilibrio estable', () => {
    expect(base.extinct).toEqual([]);
    for (const id of SPECIES_IDS) {
      expect(base.finalRaw[id]).toBeGreaterThan(0.1 * INITIAL_BIOMASS[id]);
      expect(base.lastYearsVariation[id]).toBeLessThan(0.01);
    }
    // Equilibrio calibrado: ≈ 4000; 60; 8; 6; 2; 0,3 kg/ha.
    expect(base.finalRaw.pastos).toBeCloseTo(4000, -2);
    expect(base.finalRaw.saltamontes).toBeGreaterThan(55);
    expect(base.finalRaw.saltamontes).toBeLessThan(65);
    expect(base.finalRaw.gavilanes).toBeGreaterThan(0.25);
    expect(base.finalRaw.gavilanes).toBeLessThan(0.35);
  });

  it('el equilibrio no depende de la biomasa inicial (atractor estable)', () => {
    const other = run({ initial: { pastos: 5000, saltamontes: 10, ratones: 20, ranas: 1, serpientes: 4, gavilanes: 0.5 } });
    for (const id of SPECIES_IDS) expect(other.finalRaw[id] / base.finalRaw[id]).toBeCloseTo(1, 2);
  });

  it('caza alta de gavilanes: aumentan ratones y serpientes y bajan los pastos (cascada trófica)', () => {
    const c = run({ hunting: 100 });
    const d = percentChange(c.finalRaw, base.finalRaw);
    expect(d.gavilanes).toBeLessThan(-80);
    expect(d.ratones).toBeGreaterThan(10);
    expect(d.serpientes).toBeGreaterThan(10);
    expect(d.pastos).toBeLessThan(-3);
    // La respuesta es gradual: la mitad de la caza produce un efecto intermedio.
    const half = percentChange(run({ hunting: 50 }).finalRaw, base.finalRaw);
    expect(half.ratones).toBeGreaterThan(0);
    expect(half.ratones).toBeLessThan(d.ratones);
  });

  it('pesticida alto: caen saltamontes y ranas; las serpientes bajan menos porque cambian a ratones', () => {
    const p = run({ pesticide: 100 });
    const d = percentChange(p.finalRaw, base.finalRaw);
    expect(d.saltamontes).toBeLessThan(-15);
    expect(d.ranas).toBeLessThan(-20);
    expect(d.serpientes).toBeGreaterThan(d.ranas + 5);
    expect(d.ratones).toBeGreaterThan(0); // menos competencia por el pasto y menos presión de las serpientes
  });

  it('la dieta de las serpientes se desplaza hacia los ratones cuando escasean las ranas', () => {
    const share = (b: Record<string, number>) => {
      const ranas = 1.04 * b.ranas, ratones = 0.333 * b.ratones;
      return ratones / (ranas + ratones);
    };
    expect(share(run({ pesticide: 100 }).finalRaw)).toBeGreaterThan(share(base.finalRaw) + 0.1);
  });

  it('sequía (40 %): baja la biomasa de todos los niveles; más lluvia favorece a los gavilanes', () => {
    const s = run({ rain: 40 });
    for (const id of SPECIES_IDS) expect(s.finalRaw[id]).toBeLessThan(base.finalRaw[id] * 0.9);
    expect(run({ rain: 120 }).finalRaw.gavilanes).toBeGreaterThan(base.finalRaw.gavilanes);
    expect(carryingCapacity(40)).toBeCloseTo(0.4 * K_NORMAL, 10);
  });

  it('pirámide de biomasa: productor > herbívoros > carnívoros > depredador tope', () => {
    const l = base.levels;
    expect(l.productor).toBeGreaterThan(l.herbivoro);
    expect(l.herbivoro).toBeGreaterThan(l.carnivoro);
    expect(l.carnivoro).toBeGreaterThan(l.tope);
    expect(l.herbivoro / l.productor).toBeLessThan(0.1);
  });

  it('sin productor no sobrevive ningún consumidor', () => {
    const r = run({ initial: { pastos: 0 } });
    expect(r.finalRaw.pastos).toBe(0);
    for (const id of SPECIES_IDS) expect(r.extinct).toContain(id);
    // Todos los consumidores siguen disminuyendo al final: no hay un equilibrio con vida.
    for (const id of SPECIES_IDS.slice(1)) {
      const s = r.series[id];
      expect(s[s.length - 1]).toBeLessThan(s[s.length - 11]);
    }
  });

  it('derivadas calculadas a mano: solo productor crece logísticamente y la regla del 10 %', () => {
    // Solo pasto: r·P·(1 − P/K) = 2 × 1000 × (1 − 1000/5260)
    const d = derivatives([1000, 0, 0, 0, 0, 0], K_NORMAL, 0, 0);
    expect(d[0]).toBeCloseTo(2 * 1000 * (1 - 1000 / 5260), 9);
    expect(d.slice(1).every((v) => v === 0)).toBe(true);
    // Pasto + saltamontes: lo que gana el saltamontes es el 10 % de lo que pierde el pasto (menos sus pérdidas propias).
    const P = 4000, S = 10;
    const eat = (0.00938 * P * S) / (1 + 0.00667 * 0.00938 * P);
    const d2 = derivatives([P, S, 0, 0, 0, 0], 1e12, 0, 0);
    expect(-d2[0]).toBeCloseTo(eat - 2 * P * (1 - P / 1e12), 6);
    expect(d2[1]).toBeCloseTo(EFFICIENCY * eat - 0.2 * S - 0.005 * S * S, 9);
  });

  it('la caza y el pesticida actúan como tasas proporcionales', () => {
    const y = [4000, 60, 8, 6, 2, 0.3];
    const d0 = derivatives(y, K_NORMAL, 0, 0), d1 = derivatives(y, K_NORMAL, 0.5, 0.2);
    expect(d0[5] - d1[5]).toBeCloseTo(0.5 * 0.3, 12);
    expect(d0[1] - d1[1]).toBeCloseTo(0.2 * 60, 12);
  });

  it('las lecturas finales respetan la resolución y la serie dura los años pedidos', () => {
    const r = run({ years: 5 });
    expect(r.times[r.times.length - 1]).toBeCloseTo(5, 10);
    expect(r.times.length).toBe(51);
    expect(Number.isInteger(r.final.pastos)).toBe(true);
    expect(r.final.gavilanes).toBeCloseTo(Math.round(r.finalRaw.gavilanes * 1000) / 1000, 10);
  });

  it('valida los rangos de entrada', () => {
    expect(() => run({ rain: 30 })).toThrow(RangeError);
    expect(() => run({ rain: 130 })).toThrow(RangeError);
    expect(() => run({ hunting: -1 })).toThrow(RangeError);
    expect(() => run({ pesticide: 101 })).toThrow(RangeError);
    expect(() => run({ years: 4 })).toThrow(RangeError);
    expect(() => run({ years: Number.NaN })).toThrow(RangeError);
    expect(() => run({ initial: { ranas: -1 } })).toThrow(RangeError);
  });
});

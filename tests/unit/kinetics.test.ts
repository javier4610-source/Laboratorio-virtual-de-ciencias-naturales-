import { describe, expect, it } from 'vitest';
import {
  arrheniusFactor, EA_MARBLE, KINETICS_LIMITS, marbleRateConstant, molarVolume, molesCaCO3, molesH2O2,
  peroxideRateConstant, simulateKinetics, SETUP, type KineticsInput, type Particle,
} from '../../src/models/kinetics';

const marble = (over: Partial<KineticsInput> = {}) => simulateKinetics({ reaction: 'marmol', concentration: 1, temperature: 25, particle: 'granulado', ...over });
const peroxide = (over: Partial<KineticsInput> = {}) => simulateKinetics({ reaction: 'peroxido', concentration: 3, temperature: 25, catalyst: 'mno2', ...over });

describe('velocidad de reacción (10.º)', () => {
  it('estequiometría: 0,40 g de CaCO₃ producen ≈ 98 mL de CO₂ a 25 °C y 101,3 kPa', () => {
    expect(molesCaCO3()).toBeCloseTo(0.4 / 100.09, 10);
    expect(molarVolume(25)).toBeCloseTo(24471, 0); // mL/mol = 8,314 × 298,15 / 101,3
    const r = marble({ particle: 'polvo', concentration: 2, temperature: 50 });
    expect(r.totalVolume).toBeCloseTo(0.0039964 * 24471, 0);
    expect(r.totalReading).toBe(98);
    expect(r.vFinalReading).toBe(98); // todo el CaCO₃ reaccionó
    // 5 mL de H₂O₂ al 5 %: 0,25 g / 34,01 = 7,35 mmol → 3,68 mmol de O₂ → 90 mL
    expect(molesH2O2(5)).toBeCloseTo(0.25 / 34.01, 10);
    expect(peroxide({ concentration: 5 }).totalReading).toBe(90);
  });

  it('el volumen final cabe en la jeringa de 100 mL en todo el rango de entradas', () => {
    for (const c of [0.5, 1, 2]) for (const T of [10, 30, 50]) for (const p of ['trozos', 'granulado', 'polvo'] as Particle[]) {
      const r = marble({ concentration: c, temperature: T, particle: p });
      expect(r.totalVolume).toBeLessThanOrEqual(SETUP.syringeMax);
      expect(r.vFinalReading).toBeLessThanOrEqual(SETUP.syringeMax);
    }
    for (const c of [1, 5]) for (const T of [10, 60]) for (const cat of ['ninguno', 'mno2', 'catalasa'] as const) {
      expect(peroxide({ concentration: c, temperature: T, catalyst: cat }).totalVolume).toBeLessThanOrEqual(SETUP.syringeMax);
    }
    // El HCl siempre está en exceso: con 0,5 mol/L hay 0,025 mol y se necesitan 0,008 mol.
    expect(KINETICS_LIMITS.hcl[0] * SETUP.acidVolume).toBeGreaterThan(2 * molesCaCO3());
  });

  it('más concentración, temperatura o área → mayor velocidad inicial', () => {
    expect(marble({ concentration: 2 }).instantRate).toBeCloseTo(2 * marble({ concentration: 1 }).instantRate, 10);
    expect(marble({ concentration: 1.5 }).initialRate).toBeGreaterThan(marble({ concentration: 0.5 }).initialRate);
    expect(marble({ temperature: 40 }).initialRate).toBeGreaterThan(marble({ temperature: 20 }).initialRate);
    expect(marble({ particle: 'granulado' }).initialRate).toBeGreaterThan(marble({ particle: 'trozos' }).initialRate);
    expect(peroxide({ concentration: 5 }).instantRate).toBeGreaterThan(peroxide({ concentration: 2 }).instantRate);
  });

  it('polvo frente a trozos: ≈ 12 veces más rápido al inicio (factor de área)', () => {
    const ratio = marble({ particle: 'polvo' }).instantRate / marble({ particle: 'trozos' }).instantRate;
    expect(ratio).toBeCloseTo(12, 10);
    // Valor calculado a mano: v₀ = k·F·n₀·[HCl]·V_m = 1,5e-3 × 1 × 0,0039964 × 1 × 24 471 ≈ 0,147 mL/s
    expect(marble({ particle: 'trozos' }).instantRate).toBeCloseTo(1.5e-3 * 0.0039964 * 24471, 3);
  });

  it('Arrhenius con Eₐ = 45 kJ/mol: la velocidad casi se duplica cada 10 °C', () => {
    const r = marbleRateConstant(35) / marbleRateConstant(25);
    expect(r).toBeGreaterThan(1.7);
    expect(r).toBeLessThan(2.1);
    expect(arrheniusFactor(EA_MARBLE, 25)).toBe(1);
  });

  it('el volumen final no depende de la temperatura ni del tamaño de partícula (mismo reactivo limitante)', () => {
    const long = { duration: 3600 };
    const vols = [marble({ temperature: 10, particle: 'trozos', ...long }), marble({ temperature: 50, particle: 'polvo', ...long }), marble({ temperature: 25, particle: 'granulado', concentration: 0.5, ...long })];
    for (const r of vols) expect(r.totalVolume).toBeCloseTo(vols[0].totalVolume, 10);
    expect(vols[1].vFinalReading).toBe(98);
    expect(vols[2].vFinalReading).toBe(98);
    // El gas se lee a la temperatura del laboratorio: el volumen molar es el mismo en todos los ensayos.
    expect(marble({ temperature: 10 }).totalVolume).toBe(marble({ temperature: 50 }).totalVolume);
  });

  it('el catalizador acelera la descomposición pero no cambia el O₂ total', () => {
    const none = peroxide({ catalyst: 'ninguno' });
    const mno2 = peroxide({ catalyst: 'mno2' });
    const cat = peroxide({ catalyst: 'catalasa' });
    expect(none.vFinalReading).toBeLessThanOrEqual(1); // casi nada en 3 min
    expect(mno2.initialRate).toBeGreaterThan(none.initialRate);
    expect(cat.initialRate).toBeGreaterThan(none.initialRate);
    expect(none.totalVolume).toBe(mno2.totalVolume);
    // Si da tiempo, ambos catalizadores liberan el mismo volumen: 54 mL con H₂O₂ al 3 %
    expect(peroxide({ catalyst: 'mno2', duration: 3600 }).vFinalReading).toBe(54);
    expect(peroxide({ catalyst: 'catalasa', duration: 3600 }).vFinalReading).toBe(54);
  });

  it('la catalasa pierde actividad a 60 °C mientras el MnO₂ la aumenta', () => {
    expect(peroxideRateConstant('catalasa', 60)).toBeLessThan(0.2 * peroxideRateConstant('catalasa', 37));
    expect(peroxideRateConstant('catalasa', 60)).toBeLessThan(peroxideRateConstant('catalasa', 25));
    expect(peroxideRateConstant('mno2', 60)).toBeGreaterThan(5 * peroxideRateConstant('mno2', 25));
    const hot = peroxide({ catalyst: 'catalasa', temperature: 60 });
    expect(hot.initialRate).toBeLessThan(peroxide({ catalyst: 'catalasa', temperature: 25 }).initialRate);
    expect(hot.warnings.some((w) => w.includes('desnaturaliza'))).toBe(true);
  });

  it('la curva volumen–tiempo es creciente y se aplana', () => {
    for (const r of [marble(), marble({ particle: 'polvo' }), peroxide()]) {
      for (let i = 1; i < r.series.length; i++) expect(r.series[i].v).toBeGreaterThanOrEqual(r.series[i - 1].v - 1e-12);
      const early = r.series[10].v - r.series[0].v;
      const late = r.series[180].v - r.series[170].v;
      expect(late).toBeLessThan(early);
    }
    // Primer orden: V(t) = V_total·(1 − e^(−k·t))
    const p = peroxide();
    expect(p.v30).toBeCloseTo(p.totalVolume * (1 - Math.exp(-p.rateConstant * 30)), 10);
  });

  it('mediciones con la resolución de los instrumentos y t₂₀', () => {
    const r = marble();
    expect(Number.isInteger(r.v30Reading)).toBe(true);
    expect(r.initialRate).toBeCloseTo(r.v30Reading / 30, 2);
    expect(r.t20).not.toBeNull();
    expect(Number.isInteger(r.t20!)).toBe(true);
    // Trozos, HCl 0,5 mol/L a 10 °C: no alcanza 20 mL en 3 min
    expect(marble({ particle: 'trozos', concentration: 0.5, temperature: 10 }).t20).toBeNull();
    // Con H₂O₂ al 1 % solo se pueden producir ≈ 18 mL
    expect(peroxide({ concentration: 1 }).t20).toBeNull();
  });

  it('valida los rangos de entrada', () => {
    expect(() => marble({ concentration: 3 })).toThrow(RangeError);
    expect(() => marble({ temperature: 60 })).toThrow(RangeError);
    expect(() => peroxide({ concentration: 0.5 })).toThrow(RangeError);
    expect(() => peroxide({ temperature: 70 })).toThrow(RangeError);
    expect(() => peroxide({ temperature: Number.NaN })).toThrow(RangeError);
    expect(() => marble({ duration: 5 })).toThrow(RangeError);
  });
});

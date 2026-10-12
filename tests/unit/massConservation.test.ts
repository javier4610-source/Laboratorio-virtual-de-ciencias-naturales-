import { describe, expect, it } from 'vitest';
import {
  airDensity, balloonBuoyancy, extentAt, gasVolumeMl, limitingReagent, MOLAR_MASS, molarVolumeMl, reactionById,
  readingAt, REACTIONS, simulateConservation, type ReactionId, type SystemId,
} from '../../src/models/massConservation';

const base = (reaction: ReactionId, system: SystemId, reactantMass?: number, liquidVolume?: number) => {
  const r = reactionById(reaction);
  return simulateConservation({ reaction, system, reactantMass: reactantMass ?? r.initialMass, liquidVolume: liquidVolume ?? r.initialVolume });
};

describe('conservación de la masa (8.º)', () => {
  it('las ecuaciones están balanceadas en masa (masas molares)', () => {
    const M = MOLAR_MASS;
    expect(M.NaHCO3 + M.CH3COOH).toBeCloseTo(M.CH3COONa + M.H2O + M.CO2, 2);
    expect(3 * M.NaHCO3 + M.C6H8O7).toBeCloseTo(M.Na3C6H5O7 + 3 * M.H2O + 3 * M.CO2, 1);
    expect(M.CaCl2 + M.Na2CO3).toBeCloseTo(M.CaCO3 + 2 * M.NaCl, 1);
    expect(3 * M.Fe + 2 * M.O2).toBeCloseTo(M.Fe3O4, 1);
  });

  it('en sistema cerrado la masa total se conserva para todas las reacciones', () => {
    for (const r of REACTIONS) {
      for (const sys of r.systems.filter((s) => s !== 'abierto')) {
        for (const m of [r.massRange[0], r.initialMass, r.massRange[1]]) {
          const res = base(r.id, sys, m);
          expect(res.massFinal).toBe(res.massInitial);
          expect(res.exchanged).toBe(0);
          // Sin el empuje del globo, la balanza no cambiaría.
          expect(res.readingFinal + res.buoyancyLoss).toBeCloseTo(res.readingInitial, 1);
        }
      }
    }
    const sealed = base('bicarbonato', 'sellado');
    expect(sealed.difference).toBe(0);
  });

  it('caso calculado a mano: 2,00 g de bicarbonato con 50 mL de vinagre en sistema abierto', () => {
    const res = base('bicarbonato', 'abierto', 2, 50);
    // n(NaHCO₃) = 2/84,007 = 0,02381 mol < n(ácido) = 2,5/60,052 = 0,04163 mol → limita el bicarbonato.
    expect(res.limiting.limiting).toBe('bicarbonato de sodio');
    expect(res.gasProduced).toBeCloseTo((2 / 84.007) * 44.01, 6);
    expect(res.gasProduced).toBeCloseTo(1.0478, 3);
    expect(res.readingInitial).toBe(218.5); // 165,40 + 0,80 + 50,30 + 2,00
    expect(res.readingFinal).toBe(217.45);
    expect(res.difference).toBe(-1.05);
    expect(res.massInitial - res.massFinal).toBeCloseTo(res.gasProduced, 10);
  });

  it('en sistema abierto la pérdida es la masa de CO₂ calculada y crece con la masa de reactivo', () => {
    const losses = [1, 2, 3].map((m) => {
      const res = base('bicarbonato', 'abierto', m, 200);
      expect(res.massInitial - res.massFinal).toBeCloseTo(res.gasProduced, 10);
      return res.massInitial - res.massFinal;
    });
    expect(losses[1]).toBeCloseTo(2 * losses[0], 10);
    expect(losses[2]).toBeGreaterThan(losses[1]);
    const tab = base('efervescente', 'abierto', 4, 100);
    // 4 g: 1,80 g NaHCO₃ (0,02143 mol) frente a 3 × 1,40/192,123 = 0,02186 mol → limita el bicarbonato.
    expect(tab.limiting.limiting).toBe('bicarbonato de la pastilla');
    expect(tab.gasProduced).toBeCloseTo(((4 * 0.45) / 84.007) * 44.01, 6);
    expect(tab.massInitial - tab.massFinal).toBeCloseTo(tab.gasProduced, 10);
  });

  it('con poco vinagre el limitante es el ácido acético y el CO₂ deja de crecer con el bicarbonato', () => {
    const a = base('bicarbonato', 'abierto', 3, 10);
    const b = base('bicarbonato', 'abierto', 5, 10);
    expect(a.limiting.limiting).toBe('ácido acético del vinagre');
    expect(a.gasProduced).toBeCloseTo(((10 * 0.05) / 60.052) * 44.01, 6);
    expect(b.gasProduced).toBeCloseTo(a.gasProduced, 10);
    expect(a.limiting.excessLeft).toBeCloseTo(3 - (0.5 / 60.052) * 84.007, 6);
  });

  it('la precipitación no cambia la masa ni siquiera en sistema abierto', () => {
    for (const sys of ['abierto', 'globo', 'sellado'] as const) {
      const res = base('precipitacion', sys, 3, 100);
      expect(res.gasProduced).toBe(0);
      expect(res.difference).toBe(0);
      expect(res.balloonVolume).toBe(0);
    }
    const p = base('precipitacion', 'abierto', 3, 100);
    // n(Na₂CO₃) = 0,02831 mol < n(CaCl₂) = 10/110,98 = 0,09011 mol.
    expect(p.limiting.limiting).toBe('carbonato de sodio');
    expect(p.productMass).toBeCloseTo((3 / 105.988) * 100.086, 6);
  });

  it('la oxidación de la lana de acero en sistema abierto aumenta la masa en la del O₂ fijado', () => {
    const res = base('oxidacion', 'abierto', 1);
    const o2 = (2 / 3) * (1 / 55.845) * 31.998;
    expect(res.oxygenFixed).toBeCloseTo(o2, 8);
    expect(res.massFinal - res.massInitial).toBeCloseTo(o2, 10);
    expect(res.difference).toBeCloseTo(0.38, 10);
    expect(res.productMass).toBeCloseTo(1 + o2, 3);
    expect(res.limiting.limiting).toBe('hierro de la lana de acero');
  });

  it('en el frasco sellado el O₂ limita con mucha lana de acero y la presión baja', () => {
    const res = base('oxidacion', 'sellado', 2);
    expect(res.limiting.limiting).toBe('oxígeno del aire del frasco');
    expect(res.difference).toBe(0);
    expect(res.jarPressure!).toBeLessThan(101.325 * (1 - 0.2));
    const small = base('oxidacion', 'sellado', 0.2);
    expect(small.limiting.limiting).toBe('hierro de la lana de acero');
  });

  it('volumen del globo por gas ideal y empuje = ρ·V·g', () => {
    expect(molarVolumeMl()).toBeCloseTo(24465, 0);
    expect(airDensity() * 1e3).toBeCloseTo(1.184, 3); // kg/m³
    const res = base('bicarbonato', 'globo', 2, 50);
    const n = 2 / 84.007;
    expect(res.balloonVolume).toBeCloseTo(n * 24465.4, 0);
    expect(res.balloonVolume).toBeCloseTo(gasVolumeMl(n), 10);
    expect(res.buoyancyForce).toBeCloseTo(airDensity() * 1000 * (res.balloonVolume * 1e-6) * 9.8, 12);
    expect(res.buoyancyLoss).toBeCloseTo(0.69, 2);
    expect(res.difference).toBe(-0.69);
    expect(balloonBuoyancy(1000).apparentLossG).toBeCloseTo(1.184, 3);
  });

  it('el frasco sellado acumula presión de CO₂', () => {
    const res = base('bicarbonato', 'sellado', 1, 50);
    const n = 1 / 84.007;
    expect(res.jarPressure!).toBeCloseTo(101.325 + (n * 8.314462618 * 298.15) / 0.44, 6); // J/L = kPa
    expect(base('bicarbonato', 'sellado', 5, 200).warnings.some((w) => w.includes('200 kPa'))).toBe(true);
  });

  it('reactivo limitante genérico y lecturas durante la reacción', () => {
    const lr = limitingReagent({ name: 'A', moles: 3, coef: 3, molarMass: 10 }, { name: 'B', moles: 2, coef: 1, molarMass: 5 });
    expect(lr.limiting).toBe('A');
    expect(lr.extent).toBe(1);
    expect(lr.excessLeft).toBeCloseTo(5, 10);
    const res = base('bicarbonato', 'abierto', 2, 50);
    expect(readingAt(res, 0)).toBe(res.readingInitial);
    expect(readingAt(res, 1)).toBe(res.readingFinal);
    expect(readingAt(res, 0.5)).toBeLessThan(res.readingInitial);
    expect(extentAt(-1, 4)).toBe(0);
    expect(extentAt(10, 4)).toBe(1);
  });

  it('valida rangos y combinaciones', () => {
    expect(() => simulateConservation({ reaction: 'bicarbonato', system: 'abierto', reactantMass: 0.1, liquidVolume: 50 })).toThrow(RangeError);
    expect(() => simulateConservation({ reaction: 'bicarbonato', system: 'abierto', reactantMass: 2, liquidVolume: 500 })).toThrow(RangeError);
    expect(() => simulateConservation({ reaction: 'efervescente', system: 'abierto', reactantMass: Number.NaN, liquidVolume: 100 })).toThrow(RangeError);
    expect(() => simulateConservation({ reaction: 'oxidacion', system: 'globo', reactantMass: 1, liquidVolume: 0 })).toThrow(RangeError);
    expect(() => gasVolumeMl(-1)).toThrow(RangeError);
  });
});

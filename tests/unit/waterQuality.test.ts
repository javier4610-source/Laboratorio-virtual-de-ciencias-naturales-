import { describe, expect, it } from 'vitest';
import {
  bmwpClass, bmwpCol, bod5FromUltimate, complies, criticalPoint, deoxygenation20, doSaturation, FAMILIES, hydraulics,
  idealReadings, mix, NORMS, oxygenProfile, reaerationOConnorDobbins, roundSig, saturationReading, simulateRiver,
  streeterPhelps, ultimateFromBod5, waterQualityIndex, wqiClass, wqiFromReadings, WQI_WEIGHTS, type WaterInput,
} from '../../src/models/waterQuality';

const base: WaterInput = { river: 'apartado', source: 'domestico', riverFlow: 3, dischargeFlow: 300, riverTemp: 27, distance: 5 };
const sim = (o: Partial<WaterInput> = {}) => simulateRiver({ ...base, ...o });

describe('calidad del agua (11.º): fisicoquímica básica', () => {
  it('saturación de oxígeno de Benson y Krause coincide con las tablas de APHA', () => {
    expect(doSaturation(20, 0)).toBeCloseTo(9.092, 2);
    expect(doSaturation(25, 0)).toBeCloseTo(8.263, 2);
    expect(doSaturation(30, 0)).toBeCloseTo(7.559, 2);
    // A 30 m de altitud la presión es ≈ 0,4 % menor y la saturación también.
    expect(doSaturation(25, 30) / doSaturation(25, 0)).toBeCloseTo(0.9965, 3);
    // El agua caliente disuelve menos oxígeno.
    expect(doSaturation(32)).toBeLessThan(doSaturation(22));
  });

  it('mezcla completa: promedio ponderado por caudal (cálculo a mano)', () => {
    // (3 m³/s × 10 + 0,3 m³/s × 100)/3,3 = 18,18
    expect(mix(10, 3, 100, 0.3)).toBeCloseTo(18.1818, 3);
    expect(mix(7, 5, 2, 0)).toBe(7);
    expect(() => mix(1, 0, 1, 0)).toThrow(RangeError);
  });

  it('DBO₅ y DBO última: 1 − e^(−5·0,23) = 0,6834', () => {
    expect(bod5FromUltimate(100)).toBeCloseTo(68.34, 2);
    expect(bod5FromUltimate(ultimateFromBod5(220))).toBeCloseTo(220, 9);
  });

  it('hidráulica y constantes de velocidad (O’Connor–Dobbins y k_d según la profundidad)', () => {
    expect(reaerationOConnorDobbins(0.5, 1)).toBeCloseTo(3.93 * Math.sqrt(0.5), 9);
    expect(deoxygenation20(2.4)).toBeCloseTo(0.3, 9);
    expect(deoxygenation20(5)).toBe(0.3);
    expect(deoxygenation20(0.6)).toBeCloseTo(0.3 * 4 ** 0.434, 9);
    for (const river of ['apartado', 'leon'] as const) {
      const h = hydraulics(river, 3);
      expect(h.u * h.H * h.W).toBeCloseTo(3, 9); // continuidad Q = u·H·W
    }
    // El río de llanura es más lento y profundo: reairea mucho menos.
    const a = sim(), l = sim({ river: 'leon' });
    expect(l.hyd.u).toBeLessThan(a.hyd.u);
    expect(l.hyd.H).toBeGreaterThan(a.hyd.H);
    expect(l.ka).toBeLessThan(a.ka / 4);
  });
});

describe('Streeter–Phelps', () => {
  it('caso calculado a mano: L₀ = 20, D₀ = 1, k_d = 0,5, k_a = 1,0 d⁻¹', () => {
    // t_c = 1/0,5·ln[2·(1 − 1·0,5/(0,5·20))] = 2·ln 1,9 = 1,2837 d; D_c = (k_d/k_a)·L₀·e^(−k_d t_c) = 5,2632 mg/L
    const { tc, Dc } = criticalPoint(20, 1, 0.5, 1);
    expect(tc).toBeCloseTo(2 * Math.log(1.9), 9);
    expect(Dc).toBeCloseTo(5.26316, 4);
    expect(Dc).toBeCloseTo(0.5 * 20 * Math.exp(-0.5 * tc), 9);
    expect(streeterPhelps(20, 1, 0.5, 1, 0)).toBe(1);
    // En t_c la derivada es nula: es un máximo del déficit.
    const h = 1e-4;
    expect(streeterPhelps(20, 1, 0.5, 1, tc - h)).toBeLessThan(Dc);
    expect(streeterPhelps(20, 1, 0.5, 1, tc + h)).toBeLessThan(Dc);
  });

  it('el caso k_a = k_d es continuo y sin carga orgánica el déficit solo se recupera', () => {
    expect(streeterPhelps(20, 1, 0.5, 0.5, 2)).toBeCloseTo(streeterPhelps(20, 1, 0.5, 0.5 + 1e-7, 2), 5);
    expect(criticalPoint(0, 2, 0.5, 1)).toEqual({ tc: 0, Dc: 2 });
    expect(streeterPhelps(0, 2, 0.5, 1, 1)).toBeCloseTo(2 * Math.exp(-1), 9);
    expect(() => streeterPhelps(1, 1, 0.5, 1, -1)).toThrow(RangeError);
  });

  it('aguas abajo el oxígeno forma una comba: baja hasta el punto crítico y luego se recupera', () => {
    const r = sim();
    expect(r.xc).toBeGreaterThan(5);
    expect(r.xc).toBeLessThan(30);
    const profile = oxygenProfile(base);
    const min = profile.reduce((a, p) => (p.od < a.od ? p : a));
    expect(min.od).toBeCloseTo(r.odMin, 1);
    expect(Math.abs(min.x - r.xc)).toBeLessThan(0.5);
    const odUp = sim({ distance: -1 }).site.od;
    expect(sim({ distance: 0 }).site.od).toBeLessThan(odUp);
    expect(sim({ distance: 30 }).site.od).toBeGreaterThan(r.odMin);
    expect(r.site.od).toBeGreaterThan(r.odMin);
  });

  it('tendencias: más vertimiento o más calor bajan el oxígeno mínimo; más caudal del río lo sube', () => {
    expect(sim({ dischargeFlow: 600 }).odMin).toBeLessThan(sim({ dischargeFlow: 300 }).odMin);
    expect(sim({ riverTemp: 31 }).odMin).toBeLessThan(sim({ riverTemp: 23 }).odMin);
    expect(sim({ riverFlow: 10 }).odMin).toBeGreaterThan(sim({ riverFlow: 3 }).odMin);
    // El efluente tratado afecta mucho menos que el agua residual cruda.
    expect(sim({ source: 'tratada' }).odMin).toBeGreaterThan(sim().odMin + 1);
    // El río León, lento y profundo, llega a la anoxia con la misma descarga.
    const l = sim({ river: 'leon' });
    expect(l.anoxic).toBe(true);
    expect(l.odMin).toBe(0);
  });

  it('sin vertimiento el río conserva su calidad de fondo en todo el tramo', () => {
    const r = sim({ dischargeFlow: 0, distance: 20 });
    expect(r.site.od).toBeCloseTo(r.upstream.od, 9);
    expect(r.site.bod5).toBeCloseTo(r.upstream.bod5, 9);
    expect(r.site.coliforms).toBeCloseTo(r.upstream.coliforms, 9);
    expect(r.site.ec).toBeCloseTo(r.upstream.ec, 9);
    expect(r.L0).toBe(0);
    expect(r.warnings).toHaveLength(0);
  });
});

describe('indicadores biológicos e índice de calidad', () => {
  it('BMWP/Col: el agua de fondo es clase I y en el punto crítico baja a clase IV', () => {
    const up = sim({ distance: -1 }).bmwp;
    expect(up.score).toBe(FAMILIES.filter((f) => f.onlyBelowDOsat === undefined).reduce((s, f) => s + f.score, 0));
    expect(up.score).toBe(165);
    expect(up.cls.roman).toBe('I');
    const crit = sim({ distance: 12 }).bmwp;
    expect(crit.cls.roman).toBe('IV');
    expect(crit.families.some((f) => f.name === 'Perlidae')).toBe(false);
    expect(crit.families.some((f) => f.name === 'Chironomidae')).toBe(true);
    // Sin oxígeno solo quedan los tolerantes (quironómidos, sírfidos y tubifícidos): 2 + 2 + 1 = 5.
    const anox = bmwpCol({ doSatPercent: 0, bod5: 50, turbidity: 100 });
    expect(anox.score).toBe(5);
    expect(anox.cls.roman).toBe('V');
    expect(anox.aspt).toBeCloseTo(5 / 3, 9);
  });

  it('clases BMWP/Col (Roldán) y del índice de calidad en sus límites', () => {
    expect([101, 100, 61, 60, 36, 35, 16, 15].map((s) => bmwpClass(s).roman)).toEqual(['I', 'II', 'II', 'III', 'III', 'IV', 'IV', 'V']);
    expect([91, 90.9, 71, 51, 50.9, 26, 25.9].map((v) => wqiClass(v).quality)).toEqual(['Excelente', 'Buena', 'Buena', 'Regular', 'Mala', 'Mala', 'Muy mala']);
  });

  it('índice tipo NSF: los pesos suman 1 y el índice baja aguas abajo del vertimiento', () => {
    expect(Object.values(WQI_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const clean = waterQualityIndex({ doSatPercent: 100, coliforms: 1, pH: 7.3, bod5: 0, deltaT: 0, phosphate: 0, nitrate: 0, turbidity: 0, ec: 120 });
    expect(clean.value).toBeGreaterThan(95);
    const r = sim();
    const upQ = wqiFromReadings(idealReadings(r.upstream), 27);
    const siteQ = wqiFromReadings(idealReadings(r.site), 27);
    expect(upQ.cls.quality).toBe('Buena');
    expect(siteQ.value).toBeLessThan(upQ.value - 15);
    expect(siteQ.sub.coliformsLog).toBeLessThan(5);
  });

  it('lecturas ideales con la resolución de cada instrumento (escenario inicial)', () => {
    const rd = idealReadings(sim().site);
    expect(rd.od).toBe(5.31);
    expect(rd.temp).toBe(27.3);
    expect(rd.doSat).toBe(saturationReading(rd.od, rd.temp));
    expect(Number.isInteger(rd.ec)).toBe(true);
    expect(roundSig(723456, 2)).toBe(720000);
    expect(roundSig(0.01234, 2)).toBe(0.012);
  });

  it('comparación con las normas de referencia', () => {
    const od = NORMS.find((n) => n.id === 'od-fauna')!;
    expect(complies(od, 4)).toBe(true);
    expect(complies(od, 3.99)).toBe(false);
    const dbo = NORMS.find((n) => n.id === 'dbo-631')!;
    expect(complies(dbo, 220)).toBe(false); // agua residual cruda
    expect(complies(dbo, 30)).toBe(true); // efluente tratado
    const ph = NORMS.find((n) => n.id === 'ph-2115')!;
    expect(complies(ph, 6.4)).toBe(false);
    expect(complies(ph, 9)).toBe(true);
  });

  it('valida los rangos de entrada', () => {
    expect(() => sim({ riverFlow: 0 })).toThrow(RangeError);
    expect(() => sim({ dischargeFlow: -1 })).toThrow(RangeError);
    expect(() => sim({ riverTemp: 40 })).toThrow(RangeError);
    expect(() => sim({ distance: 31 })).toThrow(RangeError);
    expect(() => sim({ river: 'magdalena' as never })).toThrow(RangeError);
    expect(() => doSaturation(Number.NaN)).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ATP_FERMENTATION, CAPILLARY_AREA, GLUCOSE_COUNTS, SUBSTRATES, TRIOLEIN_COUNTS, analyzeReadings, atpBreakdown, atpPerGlucoseAerobic, atpPerO2,
  capillaryReading, gasMicromoles, gasRates, idealReadings, indicatorColor, indicatorPH, optimalTemperature, q10From, respirometerModel,
  rqFromFormula, temperatureFactor, type RespInput,
} from '../../src/models/respiration';

const base: RespInput = { sample: 'maiz', atmosphere: 'aire', temperature: 25, mass: 3, minutes: 20 };
const ctxOf = (i: RespInput) => ({ ...i, shuttle: 'malato' as const, accounting: 'moderna' as const });
const run = (i: RespInput) => {
  const m = respirometerModel(i);
  return { m, r: idealReadings(m), a: analyzeReadings(idealReadings(m), ctxOf(i)) };
};

describe('respiración celular: estequiometría y cociente respiratorio', () => {
  it('calcula el CR a partir de la fórmula del sustrato', () => {
    expect(rqFromFormula(6, 12, 6)).toBeCloseTo(1, 12); // glucosa
    expect(rqFromFormula(57, 104, 6)).toBeCloseTo(57 / 80, 12); // trioleína
    expect(rqFromFormula(51, 98, 6)).toBeCloseTo(51 / 72.5, 12); // tripalmitina ≈ 0,703
    expect(SUBSTRATES.carbohidrato.rq).toBe(1);
    expect(SUBSTRATES.lipido.rq).toBeCloseTo(0.7125, 12);
    expect(SUBSTRATES.proteina.rq).toBeCloseTo(0.8, 12);
    expect(() => rqFromFormula(0, 4, 0)).toThrow(RangeError);
  });

  it('el O₂ consumido es la mitad de los pares de electrones (NADH + FADH₂)', () => {
    for (const c of [GLUCOSE_COUNTS, TRIOLEIN_COUNTS]) expect((c.nadhMito + c.nadhCyto + c.fadh2) / 2).toBe(c.o2);
  });
});

describe('balance de ATP', () => {
  it('ATP por glucosa: 32/30 con P/O modernas y 38/36 con las clásicas; fermentación 2', () => {
    expect(atpPerGlucoseAerobic('malato', 'moderna')).toBeCloseTo(32, 12);
    expect(atpPerGlucoseAerobic('glicerol', 'moderna')).toBeCloseTo(30, 12);
    expect(atpPerGlucoseAerobic('malato', 'clasica')).toBeCloseTo(38, 12);
    expect(atpPerGlucoseAerobic('glicerol', 'clasica')).toBeCloseTo(36, 12);
    expect(ATP_FERMENTATION).toBe(2);
    const b = atpBreakdown(GLUCOSE_COUNTS, 'malato', 'moderna');
    expect(b.substrateLevel).toBe(4);
    expect(b.fromNadhMito + b.fromNadhCyto).toBeCloseTo(25, 12);
    expect(b.fromFadh2).toBeCloseTo(3, 12);
  });

  it('la trioleína da 374 ATP, pero menos ATP por O₂ que la glucosa', () => {
    expect(atpBreakdown(TRIOLEIN_COUNTS, 'malato', 'moderna').total).toBeCloseTo(374, 12);
    const glc = atpPerO2('carbohidrato', 'malato', 'moderna')!, lip = atpPerO2('lipido', 'malato', 'moderna')!;
    expect(glc).toBeCloseTo(32 / 6, 12);
    expect(lip).toBeCloseTo(374 / 80, 12);
    expect(lip).toBeLessThan(glc);
    expect(atpPerO2('proteina', 'malato', 'moderna')).toBeNull();
  });
});

describe('respirómetro de tres tubos', () => {
  it('valores calculados a mano para el caso inicial (maíz, aire, 25 °C, 3 g, 20 min)', () => {
    const { m, r, a } = run(base);
    expect(m.vO2).toBeCloseTo(120, 9); // 120 µL/(g·h) · 3 g · 1/3 h
    expect(m.vCO2).toBeCloseTo(120, 9);
    // Deriva: 15 000 µL · (0,2 °C/h · 1/3 h)/298,15 K = 3,354 µL → 1,068 mm hacia afuera
    expect(m.vDrift).toBeCloseTo((15000 * 0.2 / 3) / 298.15, 9);
    expect(r).toEqual({ a: 37, b: -1, c: -1 });
    expect(a.corrA).toBe(38);
    expect(a.corrB).toBe(0);
    expect(a.rq).toBeCloseTo(1, 12);
    expect(a.vO2).toBeCloseTo(38 * Math.PI, 9);
    expect(a.rateO2).toBeCloseTo(38 * Math.PI, 9); // 3 g · 1/3 h = 1 g·h
    expect(gasMicromoles(24.465, 25)).toBeCloseTo(1, 3); // 1 µmol ≈ 24,47 µL a 25 °C
    expect(a.atpPerGlucose).toBeCloseTo(32, 12);
    expect(a.atpUmol).toBeCloseTo(gasMicromoles(38 * Math.PI, 25) * 32 / 6, 9);
    expect(a.efficiency).toBeCloseTo(32 * 30.5 / 2870, 12);
  });

  it('las semillas de maní (lípidos) dan CR ≈ 0,71 y su gota del tubo B sí avanza', () => {
    const { m, a } = run({ ...base, sample: 'mani', mass: 5, minutes: 30 });
    expect(m.vCO2 / m.vO2).toBeCloseTo(0.7125, 12);
    expect(a.rq!).toBeCloseTo(0.7125, 1);
    expect(a.corrB!).toBeGreaterThan(10);
    expect(a.atpPerGlucose).toBeNull(); // no oxidan glucosa
    expect(a.atpUmol!).toBeCloseTo(a.o2Umol! * 374 / 80, 9);
  });

  it('Q₁₀ ≈ 2 a temperaturas bajas, óptimo cerca de 36 °C y caída por desnaturalización', () => {
    expect(temperatureFactor(25)).toBeCloseTo(1, 12);
    const r10 = gasRates('maiz', 'aire', 10).o2, r20 = gasRates('maiz', 'aire', 20).o2;
    expect(q10From(r10, r20, 10, 20)).toBeCloseTo(2, 2);
    const opt = optimalTemperature();
    expect(opt).toBeGreaterThan(35.5);
    expect(opt).toBeLessThan(37);
    const rOpt = gasRates('maiz', 'aire', opt).o2;
    expect(gasRates('maiz', 'aire', 45).o2).toBeLessThan(0.5 * rOpt);
    expect(gasRates('maiz', 'aire', 50).o2).toBeLessThan(0.05 * rOpt);
    // Tendencia creciente por debajo del óptimo
    let prev = 0;
    for (let t = 5; t <= 35; t += 5) { const v = gasRates('maiz', 'aire', t).o2; expect(v).toBeGreaterThan(prev); prev = v; }
  });

  it('el control hervido y la anoxia con KOH solo muestran la deriva del termobarómetro', () => {
    const boiled = run({ ...base, sample: 'hervido' });
    expect(boiled.m.vO2).toBe(0);
    expect(boiled.r.a).toBe(boiled.r.c);
    expect(boiled.a.corrA).toBe(0);
    expect(boiled.a.rq).toBeNull();
    expect(boiled.a.atpUmol).toBe(0);
    const anox = run({ ...base, atmosphere: 'n2' });
    expect(anox.m.vO2).toBe(0);
    expect(anox.a.corrA).toBe(0);
    expect(anox.r.b!).toBeLessThan(anox.r.c!); // el CO₂ de la fermentación empuja la gota hacia afuera
    // CO₂ de la fermentación: 2 · (2 · 120/6) µL/(g·h) · 1 g·h = 80 µL
    expect(anox.m.vCO2).toBeCloseTo(80, 9);
    expect(anox.a.pathway).toBe('fermentacion');
    expect(anox.a.atpPerGlucose).toBe(2);
    // Con aire el ATP producido es mucho mayor aunque se use menos glucosa
    const aer = run(base);
    expect(aer.a.atpUmol! / anox.a.atpUmol!).toBeGreaterThan(5);
    expect(aer.a.glucoseUmol!).toBeLessThan(anox.a.glucoseUmol!);
  });

  it('el O₂ consumido es proporcional a la masa y al tiempo; el CR no depende de T ni de m', () => {
    const v1 = respirometerModel({ ...base, mass: 1, minutes: 10 }).vO2;
    expect(respirometerModel({ ...base, mass: 4, minutes: 10 }).vO2).toBeCloseTo(4 * v1, 9);
    expect(respirometerModel({ ...base, mass: 1, minutes: 30 }).vO2).toBeCloseTo(3 * v1, 9);
    for (const temperature of [10, 25, 35]) {
      for (const mass of [1, 5]) {
        const m = respirometerModel({ ...base, sample: 'mani', temperature, mass });
        expect(m.vCO2 / m.vO2).toBeCloseTo(0.7125, 12);
      }
    }
  });

  it('el azul de bromotimol vira de azul a verde y a amarillo con el CO₂ acumulado', () => {
    expect(indicatorColor(indicatorPH(0.0004))).toBe('azul');
    expect(indicatorPH(0.0004)).toBeCloseTo(6.35 + Math.log10(5e-4 / (0.034 * 0.0004)), 9);
    const m = respirometerModel(base);
    expect(m.co2FractionB).toBeCloseTo(0.0004 + 120 / 15000, 12);
    expect(m.indicator).toBe('verde');
    expect(indicatorColor(indicatorPH(0.03))).toBe('amarillo');
    expect(respirometerModel({ ...base, sample: 'hervido' }).indicator).toBe('azul');
  });

  it('cuantiza las lecturas del capilar y rechaza entradas fuera de rango', () => {
    expect(capillaryReading(12.26)).toBe(12.5);
    expect(capillaryReading(-0.2)).toBe(0);
    expect(capillaryReading(260)).toBeNull();
    expect(CAPILLARY_AREA).toBeCloseTo(Math.PI, 12);
    expect(() => respirometerModel({ ...base, temperature: 60 })).toThrow(RangeError);
    expect(() => respirometerModel({ ...base, mass: 0 })).toThrow(RangeError);
    expect(() => respirometerModel({ ...base, minutes: 45 })).toThrow(RangeError);
    expect(() => respirometerModel({ ...base, sample: 'trigo' as never })).toThrow();
    expect(() => q10From(0, 1, 10, 20)).toThrow(RangeError);
    // En todo el rango la gota queda dentro de la escala
    for (const sample of ['maiz', 'mani'] as const) for (const atmosphere of ['aire', 'n2'] as const) {
      const r = idealReadings(respirometerModel({ sample, atmosphere, temperature: 36, mass: 5, minutes: 30 }));
      expect(r.a).not.toBeNull(); expect(r.b).not.toBeNull(); expect(r.c).not.toBeNull();
    }
  });
});

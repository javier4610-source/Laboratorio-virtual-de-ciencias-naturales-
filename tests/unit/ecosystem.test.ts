import { describe, expect, it } from 'vitest';
import {
  CO2_PER_O2, ECO_DEFAULT, ECO_INSTRUMENTS, MAX_DAY, O2_BUBBLE, O2_CRIT_FISH, O2_INITIAL, PH_INITIAL, SPRIG_G, bromothymolColor, bromothymolName,
  co2FromPh, countOf, ecosystemModelSpec, lightAtJar, odReading, phChartReading, phFromCO2, simulateEcosystem, stateAt, totalNitrogen, waterLook,
  type EcoInput,
} from '../../src/models/ecosystem';

const run = (p: Partial<EcoInput> = {}) => simulateEcosystem({ ...ECO_DEFAULT, ...p });

describe('luz de la lámpara y química del CO₂', () => {
  it('luz: valores a mano, inverso del cuadrado y atenuador', () => {
    expect(lightAtJar(60, 30)).toBeCloseTo(400 * 0.6 * (25 / 30) ** 2, 9); // 166,67 µmol/(m²·s)
    expect(lightAtJar(100, 25)).toBeCloseTo(400, 9);
    expect(lightAtJar(80, 20) / lightAtJar(80, 40)).toBeCloseTo(4, 9);
    expect(lightAtJar(0, 30)).toBe(0);
    expect(() => lightAtJar(50, 10)).toThrow(RangeError);
    expect(() => lightAtJar(120, 30)).toThrow(RangeError);
  });

  it('pH del sistema carbonato: 6,35 + log₁₀(22/CO₂); más CO₂, menor pH', () => {
    expect(co2FromPh(7)).toBeCloseTo(22 / 10 ** 0.65, 9); // ≈ 4,92 mg/L
    expect(phFromCO2(22)).toBeCloseTo(6.35, 9);
    expect(phFromCO2(2.2)).toBeCloseTo(7.35, 9);
    expect(phFromCO2(co2FromPh(6.4))).toBeCloseTo(6.4, 9);
    expect(phFromCO2(10)).toBeLessThan(phFromCO2(5));
    expect(() => phFromCO2(0)).toThrow(RangeError);
  });

  it('azul de bromotimol: amarillo en ácido, verde cerca de 7 y azul en básico; lectura de la carta cada 0,2', () => {
    expect(bromothymolName(5.9)).toBe('amarillo');
    expect(bromothymolName(6.9)).toBe('verde');
    expect(bromothymolName(7.9)).toBe('azul');
    expect(bromothymolColor(5.5)).toBe('#e2c028');
    expect(bromothymolColor(9)).toBe('#204296');
    expect(phChartReading(6.99)).toBe(7);
    expect(phChartReading(7.31)).toBe(7.4);
    expect(phChartReading(9.1)).toBe(8);
    expect(phChartReading(5.1)).toBe(5.8);
    expect(odReading(7.96)).toBe(8);
    expect(odReading(-0.2)).toBe(0);
    expect(waterLook(0.3)).toBe('transparente');
    expect(waterLook(20)).toMatch(/opaca/);
  });
});

describe('simulación del frasco cerrado', () => {
  it('condiciones iniciales y día 0 a las 6:00', () => {
    const r = run();
    expect(r.days).toHaveLength(MAX_DAY + 1);
    const s = stateAt(r, 0, 'amanecer');
    expect(s.o2).toBe(O2_INITIAL);
    expect(s.pH).toBeCloseTo(PH_INITIAL, 9);
    expect(s.elodea).toBe(3 * SPRIG_G);
    expect(s.snails).toBe(4);
    expect(() => stateAt(r, 31, 'amanecer')).toThrow(RangeError);
  });

  it('ciclo diario: con luz el O₂ y el pH suben; de noche bajan', () => {
    const r = run();
    for (const d of [0, 3, 7]) {
      const day = r.days[d];
      expect(day.dusk.o2).toBeGreaterThan(day.dawn.o2 + 1);
      expect(day.dusk.pH).toBeGreaterThan(day.dawn.pH);
      expect(r.days[d + 1].dawn.o2).toBeLessThan(day.dusk.o2);
    }
    expect(bromothymolName(r.days[0].dusk.pH)).toBe('azul');
  });

  it('el montaje inicial es un ecosistema estable durante 30 días', () => {
    const r = run();
    expect(r.fishGoneDay).toBeNull();
    expect(r.snailsGoneDay).toBeNull();
    expect(r.hypoxiaDay).toBeNull();
    expect(r.warnings).toHaveLength(0);
    for (const d of r.days) expect(d.dawn.o2).toBeGreaterThan(O2_CRIT_FISH);
    expect(countOf(r.days[30].dawn.fish)).toBe(1);
  });

  it('oscuridad: no hay fotosíntesis, el O₂ se agota, el pH baja y mueren los animales', () => {
    const r = run({ lightHours: 0 });
    expect(r.days.every((d) => d.gpp === 0)).toBe(true);
    expect(r.days[3].dawn.o2).toBeLessThan(0.1);
    expect(r.fishGoneDay).not.toBeNull();
    expect(r.fishGoneDay!).toBeLessThanOrEqual(3);
    expect(r.snailsGoneDay!).toBeLessThanOrEqual(4);
    expect(r.days[30].dawn.pH).toBeLessThan(6.0);
    expect(bromothymolName(r.days[30].dawn.pH)).toBe('amarillo');
    expect(r.warnings.some((w) => w.startsWith('Oscuridad'))).toBe(true);
    // el atenuador en 0 equivale a la oscuridad
    expect(run({ dimmer: 0 }).days[5].dawn.o2).toBeCloseTo(r.days[5].dawn.o2, 9);
  });

  it('más horas de luz → más O₂ al amanecer; más consumidores → menos O₂', () => {
    const o2At7 = (p: Partial<EcoInput>) => stateAt(run(p), 7, 'amanecer').o2;
    const byLight = [6, 9, 12, 16, 20].map((h) => o2At7({ lightHours: h }));
    for (let i = 1; i < byLight.length; i++) expect(byLight[i]).toBeGreaterThan(byLight[i - 1]);
    const bySnails = [0, 2, 4, 6, 8, 10].map((n) => o2At7({ snails: n }));
    for (let i = 1; i < bySnails.length; i++) expect(bySnails[i]).toBeLessThan(bySnails[i - 1]);
    expect(o2At7({ distance: 60 })).toBeLessThan(o2At7({ distance: 20 }));
  });

  it('sobrepoblación: los caracoles superan la capacidad de carga y disminuyen hacia K', () => {
    const r = run({ snails: 10, fish: 4 });
    expect(r.warnings.some((w) => w.startsWith('Sobrepoblación'))).toBe(true);
    expect(r.days[0].snailK).toBeLessThan(10);
    expect(r.days[5].dawn.snails).toBeLessThan(10);
    // con pocos caracoles y alimento la población crece hacia K, sin pasarla
    const g = run({ snails: 2 });
    expect(g.days[20].dawn.snails).toBeGreaterThan(2);
    expect(g.days[30].dawn.snails).toBeLessThan(g.days[30].snailK * 1.05);
  });

  it('sin descomponedores: los detritos se acumulan, los nutrientes se agotan y la elodea crece menos', () => {
    const con = run(), sin = run({ decomposers: false });
    expect(sin.days.every((d) => d.decomposition === 0)).toBe(true);
    expect(sin.days[20].dawn.detritus).toBeGreaterThan(2 * con.days[20].dawn.detritus);
    expect(sin.days[20].dawn.nutrients).toBeLessThan(0.05);
    expect(con.days[20].dawn.nutrients).toBeGreaterThan(0.5);
    expect(sin.days[30].dawn.elodea).toBeLessThan(con.days[30].dawn.elodea);
    // al principio hay más O₂ (nadie descompone), pero después el sistema se deteriora
    expect(sin.days[3].dawn.o2).toBeGreaterThan(con.days[3].dawn.o2);
    expect(sin.days[30].dawn.o2).toBeLessThan(con.days[30].dawn.o2);
  });

  it('exceso de alimento: la descomposición agota el O₂ y proliferan las algas', () => {
    const r = run({ food: 'exceso' });
    expect(r.hypoxiaDay).not.toBeNull();
    expect(r.fishGoneDay!).toBeLessThan(15);
    expect(r.days[14].dawn.algae).toBeGreaterThan(10 * run().days[14].dawn.algae);
    expect(r.days[3].decomposition).toBeGreaterThan(run().days[3].decomposition);
  });

  it('conservación: sin descomposición anaerobia ni burbujas, O₂ + CO₂/1,375 no cambia; sin descomponedores el nitrógeno disuelto no regresa', () => {
    const r = run({ food: 'ninguno', decomposers: false });
    const inv = (s: { o2: number; co2: number }) => s.o2 + s.co2 / CO2_PER_O2;
    const ref = inv(r.days[0].dawn);
    for (const d of r.days.slice(0, 15)) {
      expect(d.dusk.o2).toBeLessThan(O2_BUBBLE);
      expect(inv(d.dawn)).toBeCloseTo(ref, 6);
      expect(inv(d.dusk)).toBeCloseTo(ref, 6);
    }
    // Los descomponedores devuelven el nitrógeno de los detritos al agua: sin ellos, el nitrógeno disuelto solo baja.
    const nut = r.days.slice(0, 15).map((d) => d.dawn.nutrients);
    for (let i = 1; i < nut.length; i++) expect(nut[i]).toBeLessThanOrEqual(nut[i - 1] + 1e-12);
    expect(totalNitrogen(run().days[30].dawn)).toBeGreaterThan(0);
  });

  it('valida las entradas y declara la ficha del modelo', () => {
    expect(() => run({ lightHours: 25 })).toThrow(RangeError);
    expect(() => run({ snails: 11 })).toThrow(RangeError);
    expect(() => run({ plants: -1 })).toThrow(RangeError);
    expect(() => run({ food: 'mucho' as never })).toThrow(RangeError);
    expect(ecosystemModelSpec.assumptions.length).toBeGreaterThan(3);
    expect(ecosystemModelSpec.limits.length).toBeGreaterThan(3);
    expect(ECO_INSTRUMENTS.map((i) => i.id)).toEqual(['oximetro', 'carta', 'conteo', 'biomasa']);
    // determinista
    expect(run().days[12].dawn.o2).toBe(run().days[12].dawn.o2);
  });
});

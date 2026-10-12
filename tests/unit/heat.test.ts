import { describe, expect, it } from 'vitest';
import {
  C_WATER, CONTAINERS, ROOM_T, analyzeReadings, closestMaterial, containerHeatCapacity, equilibriumTemperature, findMetal, heat, heatFromSample,
  heatToCalorimeter, heatToSurroundings, newtonCooling, simulate, specificHeatFromMixture, temperatureSeries, temperaturesAt, thermometerReading,
  thermometerSeries, vesselCapacityFromMixture, type HeatInput, type HeatSim,
} from '../../src/models/heat';

const base: HeatInput = { experiment: 'agua', metal: 'aluminio', container: 'icopor', sampleMass: 100, sampleTemp: 60, waterMass: 100, waterTemp: 20 };
const metalIn = (metal: HeatInput['metal'], container: HeatInput['container'] = 'icopor'): HeatInput =>
  ({ experiment: 'metal', metal, container, sampleMass: 100, sampleTemp: 99, waterMass: 100, waterTemp: 20 });

/** Integración numérica independiente (RK4 del sistema 2×2) para comparar con la solución exacta. */
function integrate(sim: HeatSim, tEnd: number, dt = 0.01): { sample: number; water: number } {
  const f = (y: [number, number]): [number, number] => [
    (-sim.G * (y[0] - y[1])) / sim.C1,
    (sim.G * (y[0] - y[1]) - sim.L * (y[1] - sim.input.ambient)) / sim.C2,
  ];
  let y: [number, number] = [sim.input.sampleTemp, sim.input.waterTemp];
  const n = Math.round(tEnd / dt);
  for (let i = 0; i < n; i++) {
    const k1 = f(y);
    const k2 = f([y[0] + (dt * k1[0]) / 2, y[1] + (dt * k1[1]) / 2]);
    const k3 = f([y[0] + (dt * k2[0]) / 2, y[1] + (dt * k2[1]) / 2]);
    const k4 = f([y[0] + dt * k3[0], y[1] + dt * k3[1]]);
    y = [y[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
  }
  return { sample: y[0], water: y[1] };
}

describe('calor y temperatura de equilibrio', () => {
  it('Q = m·c·ΔT y T_e = Σ m·c·T / Σ m·c con valores calculados a mano', () => {
    expect(heat(100, C_WATER, 10)).toBeCloseTo(4180, 9);
    expect(heat(50, 0.897, -20)).toBeCloseTo(-897, 9);
    expect(() => heat(-1, 4.18, 1)).toThrow(RangeError);
    // Agua con agua: masas iguales → promedio; masas distintas → promedio ponderado.
    expect(equilibriumTemperature([{ C: 100 * C_WATER, T: 60 }, { C: 100 * C_WATER, T: 20 }])).toBeCloseTo(40, 12);
    expect(equilibriumTemperature([{ C: 200 * C_WATER, T: 20 }, { C: 100 * C_WATER, T: 50 }])).toBeCloseTo(30, 12);
    // 100 g de aluminio a 99 °C en 100 g de agua a 20 °C (sin vaso): (89,7·99 + 418·20)/(507,7) = 33,96 °C.
    expect(equilibriumTemperature([{ C: 100 * 0.897, T: 99 }, { C: 418, T: 20 }])).toBeCloseTo(33.958, 3);
    expect(() => equilibriumTemperature([])).toThrow(RangeError);
  });

  it('la temperatura de equilibrio queda entre las iniciales; el calor cedido es igual al ganado (sin pérdidas)', () => {
    const bodies = [{ C: 120 * 0.385, T: 95 }, { C: 150 * C_WATER + 12, T: 18 }];
    const te = equilibriumTemperature(bodies);
    expect(te).toBeGreaterThan(18);
    expect(te).toBeLessThan(95);
    const given = bodies[0].C * (bodies[0].T - te), gained = bodies[1].C * (te - bodies[1].T);
    expect(given).toBeCloseTo(gained, 9);
  });

  it('la temperatura es intensiva y el calor no: duplicar las dos masas no cambia T_e pero duplica el calor transferido', () => {
    const one = simulate({ ...base, container: 'icopor' });
    const two = simulate({ ...base, sampleMass: 150, waterMass: 150 });
    // Sin vaso, T_e no depende de la cantidad total (40 °C en ambos casos).
    expect(one.teNoVessel).toBeCloseTo(40, 12);
    expect(two.teNoVessel).toBeCloseTo(40, 12);
    expect(heat(150, C_WATER, 60 - two.teNoVessel) / heat(100, C_WATER, 60 - one.teNoVessel)).toBeCloseTo(1.5, 12);
  });
});

describe('dinámica del calorímetro (dos nodos y ley de Newton)', () => {
  it('la solución exacta coincide con una integración numérica', () => {
    for (const inp of [base, metalIn('cobre', 'vidrio'), metalIn('plomo', 'lata')]) {
      const sim = simulate(inp);
      for (const t of [2, 30, 200, 600]) {
        const exact = temperaturesAt(sim, t), num = integrate(sim, t);
        expect(exact.water).toBeCloseTo(num.water, 4);
        expect(exact.sample).toBeCloseTo(num.sample, 4);
      }
    }
  });

  it('balance de energía: calor cedido por la muestra = calor ganado por el calorímetro + calor que sale al aire', () => {
    for (const inp of [base, metalIn('aluminio', 'lata'), metalIn('cobre', 'vidrio')]) {
      const sim = simulate(inp);
      for (const t of [10, 100, 600]) {
        expect(heatFromSample(sim, t)).toBeCloseTo(heatToCalorimeter(sim, t) + heatToSurroundings(sim, t), 6);
      }
    }
  });

  it('sin pérdidas (vaso ideal) se conserva C₁T₁ + C₂T₂ y el estado final es T_e = Σ m·c·T / Σ m·c', () => {
    const sim = simulate({ ...base, lossless: true });
    expect(sim.L).toBe(0);
    expect(sim.lambdaSlow).toBeCloseTo(0, 12);
    const E0 = sim.C1 * 60 + sim.C2 * 20;
    for (const t of [1, 5, 30, 600]) {
      const T = temperaturesAt(sim, t);
      expect(sim.C1 * T.sample + sim.C2 * T.water).toBeCloseTo(E0, 6);
      expect(heatFromSample(sim, t)).toBeCloseTo(heatToCalorimeter(sim, t), 6);
    }
    expect(temperaturesAt(sim, 600).water).toBeCloseTo(sim.teIdeal, 9);
    expect(heatToSurroundings(sim, 600)).toBe(0);
    // Con el vaso real de icopor, durante la mezcla (≈ 24 s) se pierde menos del 1 % del calor transferido.
    const real = simulate(base);
    expect(Math.abs(heatToSurroundings(real, real.tEq))).toBeLessThan(0.01 * heatFromSample(real, real.tEq));
  });

  it('caso inicial: icopor, 100 g a 60 °C + 100 g a 20 °C → T_e teórica 39,9 °C; lectura 39,8 °C; luego deriva hacia 28 °C', () => {
    const sim = simulate(base);
    const C2 = 100 * C_WATER + containerHeatCapacity('icopor');
    expect(sim.teIdeal).toBeCloseTo((418 * 60 + C2 * 20) / (418 + C2), 9);
    expect(thermometerReading(sim.teIdeal)).toBe(39.9);
    expect(thermometerReading(sim.teTrue)).toBe(39.8);
    expect(sim.tEq).toBeGreaterThan(15);
    expect(sim.tEq).toBeLessThan(40);
    const series = temperatureSeries(sim);
    expect(series).toHaveLength(121);
    const peak = Math.max(...series.map((p) => p.water));
    expect(peak).toBeLessThan(sim.teIdeal);
    expect(series[120].water).toBeLessThan(peak);
    expect(series[120].water).toBeGreaterThan(ROOM_T);
    expect(temperaturesAt(sim, 1e6).water).toBeCloseTo(ROOM_T, 6);
  });

  it('la constante de tiempo de las pérdidas depende del recipiente: el icopor conserva mejor la temperatura', () => {
    const tau = Object.fromEntries(CONTAINERS.map((c) => [c.id, simulate({ ...base, container: c.id }).tauSlow]));
    expect(tau.icopor).toBeGreaterThan(2.5 * tau.vidrio);
    expect(tau.icopor).toBeGreaterThan(tau.lata);
    const drop = (container: HeatInput['container']) => {
      const s = simulate({ ...base, container });
      return s.teTrue - temperaturesAt(s, 600).water;
    };
    expect(drop('icopor')).toBeLessThan(drop('vidrio'));
    expect(drop('icopor')).toBeLessThan(drop('lata'));
    // Un cuerpo solo: Newton con τ.
    expect(newtonCooling(60, 28, 600, 600)).toBeCloseTo(28 + 32 / Math.E, 12);
    expect(() => newtonCooling(60, 28, 0, 1)).toThrow(RangeError);
  });

  it('si la mezcla queda por debajo de 28 °C el salón le entrega calor (pérdidas negativas)', () => {
    const sim = simulate(metalIn('plomo', 'vidrio'));
    expect(sim.teTrue).toBeLessThan(ROOM_T);
    expect(heatToSurroundings(sim, 600)).toBeLessThan(0);
    expect(temperaturesAt(sim, 600).water).toBeGreaterThan(sim.teTrue);
  });
});

describe('metales, calor específico y análisis de lecturas', () => {
  it('con igual masa y temperatura, el aluminio calienta más el agua que el hierro, el cobre y el plomo', () => {
    const te = (m: HeatInput['metal']) => simulate(metalIn(m)).teIdeal;
    expect(te('aluminio')).toBeGreaterThan(te('hierro'));
    expect(te('hierro')).toBeGreaterThan(te('cobre'));
    expect(te('cobre')).toBeGreaterThan(te('plomo'));
  });

  it('recupera el calor específico del metal a partir de las lecturas (aluminio y muestra desconocida)', () => {
    expect(specificHeatFromMixture({ waterMass: 100, waterTemp: 20, vesselC: 0, sampleMass: 100, sampleTemp: 99, te: 34 })).toBeCloseTo((418 * 14) / (100 * 65), 12);
    for (const [metal, ref] of [['aluminio', 0.897], ['desconocido', 0.523], ['cobre', 0.385]] as const) {
      const inp = metalIn(metal);
      const sim = simulate(inp);
      const a = analyzeReadings({ sampleMass: 100, sampleTemp: 99, waterMass: 100, waterTemp: 20, te: thermometerReading(sim.teTrue) }, inp);
      expect(a.cSample).not.toBeNull();
      expect(Math.abs((a.cSample as number) - ref) / ref).toBeLessThan(0.05);
    }
    expect(closestMaterial(0.52).name).toBe('Titanio');
    expect(findMetal('desconocido').identity).toBe('titanio');
    const unknown = analyzeReadings({ sampleMass: 100, sampleTemp: 99, waterMass: 100, waterTemp: 20, te: 28.7 }, metalIn('desconocido'));
    expect(unknown.qGiven).toBeNull();
    expect(unknown.tePredicted).toBeNull();
  });

  it('el método de las mezclas da la capacidad calorífica del vaso de vidrio (≈ 109 J/°C)', () => {
    const C = containerHeatCapacity('vidrio');
    expect(C).toBeCloseTo(130 * 0.84, 12);
    const te = equilibriumTemperature([{ C: 100 * C_WATER, T: 60 }, { C: 100 * C_WATER + C, T: 20 }]);
    expect(vesselCapacityFromMixture({ coldMass: 100, coldTemp: 20, hotMass: 100, hotTemp: 60, te })).toBeCloseTo(C, 9);
    const inp = { ...base, container: 'vidrio' as const };
    const sim = simulate(inp);
    const a = analyzeReadings({ sampleMass: 100, sampleTemp: 60, waterMass: 100, waterTemp: 20, te: thermometerReading(sim.teTrue) }, inp);
    expect(a.cVessel as number).toBeGreaterThan(90);
    expect(a.cVessel as number).toBeLessThan(140);
    expect(a.qGiven as number).toBeGreaterThan(a.qGained);
    expect(a.qDiff as number).toBeCloseTo((a.qGiven as number) - a.qGained, 9);
  });

  it('las lecturas se cuantizan a 0,1 °C y el ruido del termómetro es reproducible', () => {
    expect(thermometerReading(39.8449)).toBe(39.8);
    expect(thermometerReading(-0.04)).toBe(0);
    const series = temperatureSeries(simulate(base));
    const a = thermometerSeries(series, 0.1, 7), b = thermometerSeries(series, 0.1, 7), c = thermometerSeries(series, 0.1, 8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(thermometerSeries(series)[60].T).toBe(thermometerReading(series[60].water));
  });

  it('rechaza entradas fuera de rango o desconocidas', () => {
    expect(() => simulate({ ...base, waterMass: 10 })).toThrow(RangeError);
    expect(() => simulate({ ...base, waterTemp: 50 })).toThrow(RangeError);
    expect(() => simulate({ ...base, sampleMass: 500 })).toThrow(RangeError);
    expect(() => simulate({ ...base, sampleTemp: 120 })).toThrow(RangeError);
    expect(() => simulate({ ...base, sampleTemp: Number.NaN })).toThrow(RangeError);
    expect(() => simulate({ ...base, container: 'olla' as never })).toThrow();
    expect(() => simulate({ ...base, metal: 'oro' as never })).toThrow();
  });
});

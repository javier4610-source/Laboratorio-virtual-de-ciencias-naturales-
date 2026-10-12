import { describe, expect, it } from 'vitest';
import {
  G, ISA_EXPONENT, LIQUIDS, P0_HPA, PLACES, RHO_MANOMETER, VESSELS, absolutePressure, analyzeManometer, atmosphere, atmosphereISA,
  atmosphereIsothermal, barometerReading, baseAreaCm2, findLiquid, findVessel, gaugeFromManometer, hydrostaticGauge, jet, manometerReading,
  manometerRise, membraneGauge, mercuryColumnMm, pascalVessel, scaleHeight, simulateProbe, speedFromRange, tapeReading, torricelliSpeed,
  uTubeOmega, uTubeResponse, vesselRadius, vesselVolume, waterColumnM, type ProbeInput,
} from '../../src/models/pressure';

const base: ProbeInput = { liquid: 'dulce', depthCm: 10, orientationDeg: 90, altitudeM: 30, atmosphere: 'estandar' };

describe('presión hidrostática p = p_atm + ρ·g·h', () => {
  it('valores calculados a mano', () => {
    expect(hydrostaticGauge(997, 0.1)).toBeCloseTo(975.066, 6); // 997·9,78·0,10
    expect(hydrostaticGauge(1258, 0.2)).toBeCloseTo(2460.648, 6);
    expect(hydrostaticGauge(1000, 10, 9.8)).toBeCloseTo(98000, 6); // 10 m de agua ≈ 1 atmósfera
    expect(absolutePressure(101325, 997, 0.1)).toBeCloseTo(101325 + 975.066, 6);
    expect(hydrostaticGauge(997, 0)).toBe(0);
    expect(() => hydrostaticGauge(997, -0.01)).toThrow(RangeError);
    expect(() => hydrostaticGauge(0, 0.1)).toThrow(RangeError);
  });

  it('crece en proporción directa a la profundidad y a la densidad del líquido', () => {
    const p1 = hydrostaticGauge(997, 0.05), p2 = hydrostaticGauge(997, 0.10), p3 = hydrostaticGauge(997, 0.20);
    expect(p2 / p1).toBeCloseTo(2, 12);
    expect(p3 / p1).toBeCloseTo(4, 12);
    const order = [...LIQUIDS].sort((a, b) => a.rho - b.rho).map((l) => simulateProbe({ ...base, liquid: l.id }).gauge);
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    expect(findLiquid('alcohol').rho).toBeLessThan(findLiquid('aceite').rho);
    expect(findLiquid('glicerina').rho).toBeGreaterThan(findLiquid('salada').rho);
  });
});

describe('manómetro en U y membrana de la sonda', () => {
  it('en agua dulce el desnivel del manómetro de agua es igual a la profundidad; en glicerina es ρ/ρ_m veces mayor', () => {
    expect(simulateProbe(base).riseMm).toBeCloseTo(100, 9);
    expect(simulateProbe({ ...base, liquid: 'glicerina' }).riseMm).toBeCloseTo((100 * 1258) / RHO_MANOMETER, 9);
    expect(manometerRise(gaugeFromManometer(0.137))).toBeCloseTo(0.137, 12);
    expect(manometerReading(126.18)).toBe(126);
    expect(manometerReading(-0.2)).toBe(0);
    // Cálculo del estudiante: 100 mm → 975 Pa; absoluta = barómetro + manométrica.
    const a = analyzeManometer(100, 1009.7);
    expect(a.gauge).toBeCloseTo(975.066, 6);
    expect(a.pAbs).toBeCloseTo(1019.45066, 6);
  });

  it('a la misma profundidad la presión es igual en todas las direcciones (membrana sumergida)', () => {
    const ref = membraneGauge(1023, 12, 0);
    for (const ang of [15, 45, 90, 135, 180]) expect(membraneGauge(1023, 12, ang)).toBeCloseTo(ref, 9);
    expect(ref).toBeCloseTo(1023 * G * 0.12, 9);
    // Si la membrana corta la superficie, la parte en el aire no aporta y la orientación sí importa.
    const up = membraneGauge(997, 0.5, 0), side = membraneGauge(997, 0.5, 90);
    expect(up).toBeCloseTo(997 * G * 0.005, 9);
    expect(side).toBeGreaterThan(up);
    // Promedio numérico sobre el disco: solo la mitad positiva de un campo lineal centrado en la superficie.
    // Media de max(0, r·cos φ) sobre todo el disco de radio R: (½ área)·(centroide 4R/3π)/área = 2R/(3π).
    expect(membraneGauge(997, 0, 90)).toBeCloseTo((997 * G * ((2 * 1.5) / (3 * Math.PI))) / 100, 1);
  });

  it('la columna del manómetro oscila con período 2π·√(L/2g) y se amortigua hacia el desnivel final', () => {
    const w = uTubeOmega(0.5);
    expect((2 * Math.PI) / w).toBeCloseTo(2 * Math.PI * Math.sqrt(0.5 / (2 * G)), 12);
    expect((2 * Math.PI) / w).toBeCloseTo(1.0046, 3);
    expect(uTubeResponse(0, 100, 0, 0.5)).toBeCloseTo(0, 12);
    const late = uTubeResponse(0, 100, 20, 0.5);
    expect(Math.abs(late - 100)).toBeLessThan(0.01);
    // Sobrepasa el valor final en la primera media oscilación (subamortiguado).
    expect(uTubeResponse(0, 100, Math.PI / (w * Math.sqrt(1 - 0.18 ** 2)), 0.5)).toBeGreaterThan(100);
    expect(() => uTubeOmega(0)).toThrow(RangeError);
  });
});

describe('vasos de Pascal (paradoja hidrostática)', () => {
  it('misma altura → misma presión y misma fuerza en la base, aunque el peso del líquido sea distinto', () => {
    const results = VESSELS.map((v) => pascalVessel(v.id, 997, 20));
    for (const r of results) {
      expect(r.gauge).toBeCloseTo(results[0].gauge, 9);
      expect(r.baseForce).toBeCloseTo(results[0].baseForce, 9);
    }
    const cyl = pascalVessel('cilindro', 997, 20), wide = pascalVessel('ancho', 997, 20), narrow = pascalVessel('estrecho', 997, 20), tilt = pascalVessel('inclinado', 997, 20);
    expect(cyl.ratio).toBeCloseTo(1, 12); // en el cilindro el fondo sostiene exactamente el peso
    expect(wide.weight).toBeGreaterThan(wide.baseForce);
    expect(narrow.weight).toBeLessThan(narrow.baseForce);
    expect(tilt.volume).toBeCloseTo(cyl.volume, 9); // Cavalieri
    expect(cyl.volume).toBeCloseTo(Math.PI * 9 * 20, 9);
    expect(cyl.baseForce).toBeCloseTo(997 * G * 0.2 * Math.PI * 9e-4, 9);
    expect(baseAreaCm2()).toBeCloseTo(Math.PI * 9, 12);
  });

  it('volumen de los vasos: tronco de cono exacto y comparación con integración numérica', () => {
    const wide = findVessel('ancho');
    const r1 = vesselRadius(wide, 20);
    expect(vesselVolume(wide, 20)).toBeCloseTo((Math.PI * 20 * (9 + 3 * r1 + r1 * r1)) / 3, 9);
    for (const v of VESSELS) {
      const n = 4000, h = 23;
      let num = 0;
      for (let i = 0; i < n; i++) { const r = vesselRadius(v, ((i + 0.5) / n) * h); num += Math.PI * r * r * (h / n); }
      expect(vesselVolume(v, h)).toBeCloseTo(num, 2);
    }
    expect(() => pascalVessel('cilindro', 997, 40)).toThrow(RangeError);
  });
});

describe('chorros de la botella (Torricelli)', () => {
  it('v = √(2·g·h) y alcance R = 2·C_v·√(h·y)', () => {
    expect(torricelliSpeed(0.2)).toBeCloseTo(Math.sqrt(2 * 9.78 * 0.2), 12);
    expect(torricelliSpeed(0.2)).toBeCloseTo(1.9779, 4);
    const j = jet(5, 25);
    expect(j.headCm).toBe(20);
    expect(j.rangeIdeal).toBeCloseTo(2 * Math.sqrt(20 * 5), 9); // 20 cm
    expect(j.range).toBeCloseTo(0.97 * 20, 9);
    // Rapidez recuperada desde el alcance ideal = Torricelli.
    expect(speedFromRange(j.rangeIdeal, 5)).toBeCloseTo(j.vIdeal, 9);
    expect(tapeReading(23.76)).toBe(24);
  });

  it('el chorro más rápido no es el que llega más lejos: alcances simétricos y máximo a la mitad del nivel', () => {
    const r = [5, 10, 15, 20].map((y) => jet(y, 25));
    expect(r[0].v).toBeGreaterThan(r[3].v);
    expect(r[0].range).toBeCloseTo(r[3].range, 9);
    expect(r[1].range).toBeCloseTo(r[2].range, 9);
    let best = 0, bestY = 0;
    for (let y = 1; y <= 24; y += 0.5) { const R = jet(y, 24).range; if (R > best) { best = R; bestY = y; } }
    expect(bestY).toBe(12);
    // Agujero por encima del agua: no sale chorro.
    const dry = jet(20, 15);
    expect(dry.flows).toBe(false);
    expect(dry.range).toBe(0);
    expect(() => jet(5, 40)).toThrow(RangeError);
  });
});

describe('presión atmosférica y altitud', () => {
  it('atmósfera estándar: valores de referencia y conversiones', () => {
    expect(atmosphereISA(0)).toBeCloseTo(P0_HPA, 9);
    expect(ISA_EXPONENT).toBeCloseTo(5.2559, 3);
    expect(atmosphereISA(1000)).toBeCloseTo(898.75, 0); // tabla ISA: 898,76 hPa
    expect(atmosphereISA(30)).toBeCloseTo(1009.65, 1);
    expect(barometerReading(atmosphereISA(30))).toBe(1009.7);
    expect(atmosphereISA(1495)).toBeCloseTo(846.1, 0);
    expect(atmosphereISA(2640)).toBeCloseTo(733.8, 0);
    expect(mercuryColumnMm(P0_HPA)).toBeCloseTo(760, 1);
    expect(waterColumnM(P0_HPA)).toBeCloseTo(10.39, 2);
  });

  it('la presión baja con la altitud; la isotérmica da valores un poco mayores en altura que la ISA', () => {
    const isa = PLACES.map((p) => atmosphereISA(p.altitude));
    for (let i = 1; i < isa.length; i++) expect(isa[i]).toBeLessThan(isa[i - 1]);
    expect(scaleHeight()).toBeCloseTo(8434.7, 0);
    expect(atmosphereIsothermal(8434.657451769897)).toBeCloseTo(P0_HPA / Math.E, 6);
    for (const p of PLACES.slice(1)) expect(atmosphere('isoterma', p.altitude)).toBeGreaterThan(atmosphere('estandar', p.altitude));
    // A poca altura las dos coinciden (diferencia < 0,01 hPa en Apartadó).
    expect(Math.abs(atmosphereIsothermal(30) - atmosphereISA(30))).toBeLessThan(0.01);
    // Bogotá: unas tres cuartas partes de la presión al nivel del mar.
    expect(atmosphereISA(2640) / P0_HPA).toBeCloseTo(0.724, 3);
  });

  it('la lectura del manómetro no depende del lugar; la presión absoluta sí', () => {
    const apa = simulateProbe(base), bog = simulateProbe({ ...base, altitudeM: 2640 });
    expect(bog.gauge).toBeCloseTo(apa.gauge, 12);
    expect(bog.riseMm).toBeCloseTo(apa.riseMm, 12);
    expect(apa.pAbs - bog.pAbs).toBeCloseTo(apa.pAtm - bog.pAtm, 9);
    expect(apa.pAbs).toBeCloseTo(apa.pAtm + 9.75066, 6);
  });
});

describe('validación de entradas', () => {
  it('rechaza valores fuera de rango o desconocidos', () => {
    expect(() => simulateProbe({ ...base, depthCm: 31 })).toThrow(RangeError);
    expect(() => simulateProbe({ ...base, depthCm: Number.NaN })).toThrow(RangeError);
    expect(() => simulateProbe({ ...base, orientationDeg: 200 })).toThrow(RangeError);
    expect(() => simulateProbe({ ...base, altitudeM: 6000 })).toThrow(RangeError);
    expect(() => findLiquid('mercurio')).toThrow();
    expect(() => findVessel('esfera')).toThrow();
    expect(() => atmosphere('polar' as never, 0)).toThrow();
    expect(() => scaleHeight(0)).toThrow(RangeError);
  });
});

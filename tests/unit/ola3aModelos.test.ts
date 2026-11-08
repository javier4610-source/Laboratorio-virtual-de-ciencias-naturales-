import { describe, expect, it } from 'vitest';
import {
  AU_PER_YEAR_KMS, findPair, forceConditions, G_CONST, geostationaryAltitude, gravForce, integrateOrbit, keplerPeriod, keplerTable, M_EARTH, MU_SUN_AU,
  orbitAt, orbitConditions, PLANETS, R_EARTH_MEAN, satellitePeriod, surfaceGravity, visViva,
} from '../../src/models/gravitation';
import { calConditions, DH_NEUT, dissolution, hessSolidInAcid, neutralization, runCalorimeter, SOLUTES, T_ROOM, tempAt } from '../../src/models/thermochem';
import { atomizer, G, hose, hoseConditions, minAirSpeed, RHO_ETHANOL, RHO_WATER, venturi, venturiConditions } from '../../src/models/bernoulli';

describe('termoquímica en el calorímetro de vaso', () => {
  it('valores de referencia: neutralización −55,8 kJ/mol (CODATA) y disoluciones del CRC; sin pérdidas se recuperan exactos', () => {
    expect(DH_NEUT).toBeCloseTo(-55.815, 9);
    for (const s of SOLUTES) {
      const run = runCalorimeter(dissolution(s.id, 2, 100), 'icopor');
      expect(run.dHideal, s.id).toBeCloseTo(s.dH, 9);
    }
    expect(runCalorimeter(neutralization(1, 50), 'icopor').dHideal).toBeCloseTo(DH_NEUT, 9);
    expect(hessSolidInAcid(2).dHref).toBeCloseTo(-44.51 - 55.815, 9);
  });
  it('2,00 g de NaOH en 100 g de agua: n = 0,0500 mol, q = 2226 J y ΔT_ad = 5,04 °C; NH₄NO₃ enfría', () => {
    const run = runCalorimeter(dissolution('naoh', 2, 100), 'icopor');
    expect(run.exp.n).toBeCloseTo(0.050004, 6);
    expect(run.q).toBeCloseTo(2225.7, 1);
    expect(run.Ctot).toBeCloseTo(102 * 4.18 + 15, 9);
    expect(run.dTad).toBeCloseTo(5.043, 3);
    const cold = runCalorimeter(dissolution('nh4no3', 5, 100), 'icopor');
    expect(cold.dTad).toBeLessThan(0);
    expect(cold.maxObs.T).toBeLessThan(T_ROOM);
    expect(cold.dHmax).toBeGreaterThan(0);
  });
  it('neutralización 50 + 50 mL de 1,0 M: ΔT_ad = 6,45 °C; el máximo medido es menor y la extrapolación se acerca más', () => {
    const run = runCalorimeter(neutralization(1, 50), 'icopor');
    expect(run.exp.n).toBeCloseTo(0.05, 12);
    expect(run.dTad).toBeCloseTo(6.445, 3);
    expect(run.maxObs.T - T_ROOM).toBeLessThan(run.dTad);
    expect(Math.abs(run.errExtrapPct)).toBeLessThan(Math.abs(run.errMaxPct));
    expect(Math.abs(run.errExtrapPct)).toBeLessThan(2);
    const glass = runCalorimeter(neutralization(1, 50), 'vidrio');
    expect(Math.abs(glass.errMaxPct)).toBeGreaterThan(Math.abs(run.errMaxPct));
    // Reactivo limitante: con la base más diluida reaccionan menos moles.
    expect(neutralization(1, 50, 0.5).n).toBeCloseTo(0.025, 12);
  });
  it('curva de temperatura: empieza en T_aire, sube a un máximo y se enfría; lecturas cada 10 s de 0,1 °C', () => {
    const run = runCalorimeter(dissolution('naoh', 2, 100), 'icopor');
    expect(run.readings).toHaveLength(31);
    expect(run.readings[0].T).toBe(T_ROOM);
    for (const r of run.readings) expect(Math.abs(r.T * 10 - Math.round(r.T * 10))).toBeLessThan(1e-9);
    expect(run.readings[run.readings.length - 1].T).toBeLessThan(run.maxObs.T);
    expect(tempAt(5, 10, 0, 1e6)).toBeCloseTo(T_ROOM + 5, 9);
    expect(tempAt(5, 10, 0.1, 10)).toBeCloseTo(T_ROOM + 5 * 10 / 10 * Math.exp(-1), 9);
  });
  it('avisos con su corrección: ΔT pequeño, solución concentrada y vaso de vidrio', () => {
    expect(calConditions(runCalorimeter(dissolution('nacl', 2, 100), 'icopor'), 'icopor')[0].fix).toContain('más soluto');
    expect(calConditions(runCalorimeter(dissolution('cacl2', 10, 20), 'icopor'), 'icopor').some((c) => c.text.includes('muy concentrada'))).toBe(true);
    expect(calConditions(runCalorimeter(neutralization(1, 50), 'vidrio'), 'vidrio').some((c) => c.fix.includes('icopor'))).toBe(true);
    expect(() => hessSolidInAcid(5)).toThrow(RangeError);
  });
});

describe('continuidad y Bernoulli (fluido ideal)', () => {
  it('continuidad: 10 L en 30 s por una manguera de ½ in y la boquilla de la mitad del diámetro cuadruplica la rapidez', () => {
    const h = hose(10, 30, 12.7);
    expect(h.Q * 1000).toBeCloseTo(0.3333, 4);
    expect(h.v1).toBeCloseTo(2.631, 3);
    const n = hose(10, 30, 6.35);
    expect(n.v2 / n.v1).toBeCloseTo(4, 12);
    expect(n.v2).toBeCloseTo(10.525, 3);
    expect(n.A2 * n.v2).toBeCloseTo(n.A1 * n.v1, 15);
    expect(hoseConditions(hose(10, 10, 2))[0].fix).toContain('boquilla más ancha');
    expect(() => hose(10, 30, 20)).toThrow(RangeError);
  });
  it('Venturi 25/12,5 mm con 0,3 L/s: Δp = 2796 Pa, Δh = 28,6 cm, la energía se conserva y el medidor devuelve el caudal', () => {
    const r = venturi(0.3, 25, 12.5);
    expect(r.v1).toBeCloseTo(0.6112, 4);
    expect(r.v2).toBeCloseTo(2.4446, 4);
    expect(r.dp).toBeCloseTo(2796.3, 1);
    expect(r.dh * 100).toBeCloseTo(28.64, 2);
    expect(r.energy2).toBeCloseTo(r.energy1, 9);
    expect(r.flowFromDh * 1000).toBeCloseTo(0.3, 12);
    expect(r.dp).toBeCloseTo(RHO_WATER * G * r.dh, 9);
    expect(r.re2).toBeGreaterThan(4000);
    expect(venturiConditions(r).map((c) => c.level)).toEqual(['nota']);
    // Garganta igual a la entrada: no hay caída.
    expect(venturi(0.3, 25, 25).dh).toBeCloseTo(0, 15);
    const vac = venturiConditions(venturi(1, 25, 8));
    expect(vac[0].level).toBe('invalido');
    expect(vac[0].fix).toContain('Baja el caudal');
  });
  it('atomizador: aire a 20 m/s sube el agua 2,47 cm y el etanol 3,12 cm; rapidez mínima para un pitillo de 2 cm', () => {
    const w = atomizer(20, 2, RHO_WATER);
    expect(w.dp).toBeCloseTo(240.8, 1);
    expect(w.rise * 100).toBeCloseTo(2.467, 3);
    expect(w.sprays).toBe(true);
    expect(atomizer(20, 2, RHO_ETHANOL).rise * 100).toBeCloseTo(3.12, 2);
    const vmin = minAirSpeed(2, RHO_WATER);
    expect(atomizer(vmin, 2, RHO_WATER).rise * 100).toBeCloseTo(2, 9);
    expect(atomizer(vmin * 0.99, 2, RHO_WATER).sprays).toBe(false);
  });
});

describe('gravitación universal y leyes de Kepler', () => {
  it('ley de Newton: fuerza Tierra–Luna, peso de 50 kg y la ley del inverso del cuadrado', () => {
    const p = findPair('tierra-luna');
    expect(gravForce(p.m1, p.m2, p.r)).toBeCloseTo(1.98e20, -18);
    expect(gravForce(M_EARTH, 50, R_EARTH_MEAN)).toBeCloseTo(491.0, 0);
    expect(surfaceGravity(M_EARTH, R_EARTH_MEAN)).toBeCloseTo(9.82, 2);
    expect(gravForce(1, 1, 2) / gravForce(1, 1, 1)).toBeCloseTo(0.25, 12);
    expect(G_CONST).toBe(6.6743e-11);
    expect(() => gravForce(1, 1, 0)).toThrow(RangeError);
    expect(forceConditions(0.5, 'tierra-estudiante')[0].fix).toContain('1 radio terrestre');
    expect(forceConditions(0.5, 'tierra-luna')).toEqual([]);
  });
  it('tercera ley con los datos de la NASA: todos los planetas a menos de 1 % y T²/a³ ≈ 1 año²/UA³', () => {
    const rows = keplerTable();
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      expect(Math.abs(r.diffPct), r.planet.id).toBeLessThan(1);
      expect(r.ratio, r.planet.id).toBeGreaterThan(0.98);
      expect(r.ratio, r.planet.id).toBeLessThan(1.02);
    }
    // Mercurio a Júpiter: mejor que 0,1 %.
    for (const r of rows.slice(0, 5)) expect(Math.abs(r.diffPct), r.planet.id).toBeLessThan(0.1);
    const earth = rows.find((r) => r.planet.id === 'tierra')!;
    expect(earth.Tcalc).toBeCloseTo(365.26, 1);
    expect(rows.find((r) => r.planet.id === 'mercurio')!.Tcalc).toBeCloseTo(87.97, 1);
    expect(rows.find((r) => r.planet.id === 'marte')!.Tcalc).toBeCloseTo(687.0, 0);
    expect(PLANETS.every((p) => p.e < 0.21)).toBe(true);
  });
  it('μ del Sol en UA y años ≈ 4π²; la Tierra va a 29,78 km/s; vis-viva v_p/v_a = (1 + e)/(1 − e)', () => {
    expect(MU_SUN_AU / (4 * Math.PI ** 2)).toBeCloseTo(1, 4);
    expect(keplerPeriod(1) * 365.25).toBeCloseTo(365.257, 2);
    expect(visViva(1, 1) * AU_PER_YEAR_KMS).toBeCloseTo(29.78, 2);
    const e = 0.3;
    expect(visViva(1 - e, 1) / visViva(1 + e, 1)).toBeCloseTo((1 + e) / (1 - e), 12);
  });
  it('órbita integrada (RK4): energía y momento angular conservados, áreas iguales en tiempos iguales y el período de Kepler', () => {
    for (const e of [0, 0.3, 0.6]) {
      const run = integrateOrbit(1.5, e);
      expect(run.energy.maxRelDrift, `energía e=${e}`).toBeLessThan(1e-8);
      expect(run.angMom.maxRelDrift, `momento e=${e}`).toBeLessThan(1e-8);
      expect(run.energy.start).toBeCloseTo(-MU_SUN_AU / (2 * 1.5), 10);
      const mean = run.areas.reduce((s, x) => s + x, 0) / 8;
      for (const A of run.areas) expect(Math.abs(A - mean) / mean, `áreas e=${e}`).toBeLessThan(1e-6);
      expect((mean * 8) / run.ellipseArea).toBeCloseTo(1, 6);
      // Tras un período vuelve al perihelio.
      const end = run.samples[run.samples.length - 1];
      expect(Math.hypot(end.x - run.rp, end.y)).toBeLessThan(1e-7);
    }
    const run = integrateOrbit(1, 0.5);
    const half = orbitAt(run, run.period / 2);
    expect(half.r).toBeCloseTo(run.ra, 6);
    expect(half.v).toBeCloseTo(run.va, 6);
    expect(orbitAt(run, run.period * 1.25).t).toBeCloseTo(run.period / 4, 12);
    expect(() => integrateOrbit(1, 0.5, MU_SUN_AU, 1001)).toThrow(RangeError);
    expect(() => integrateOrbit(1, 0.95)).toThrow(RangeError);
  });
  it('satélites: geoestacionario a 35 786 km y la Estación Espacial a 420 km da una vuelta en ≈ 93 min', () => {
    expect(geostationaryAltitude() / 1000).toBeCloseTo(35786, 0);
    expect(satellitePeriod(420e3) / 60).toBeCloseTo(93.0, 1);
  });
  it('avisos con su corrección: perihelio dentro del Sol y órbita de cometa', () => {
    expect(orbitConditions(0.2, 0.9)[0].level).toBe('advertencia');
    expect(orbitConditions(0.2, 0.99).some((c) => c.level === 'invalido')).toBe(true);
    expect(orbitConditions(1, 0.8).some((c) => c.text.includes('cometas'))).toBe(true);
    expect(orbitConditions(1, 0.0167)).toEqual([]);
  });
});

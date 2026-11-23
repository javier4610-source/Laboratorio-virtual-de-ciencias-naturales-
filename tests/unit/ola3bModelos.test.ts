import { describe, expect, it } from 'vitest';
import {
  carnotCycle, cycleConditions, enclosedArea, gasProcess, initialState, N0, ottoCycle, processConditions, R, stateAlong,
} from '../../src/models/thermodynamics';
import { dopplerLine, lineConditions, machCone, passBy, soundSpeed, wavefronts } from '../../src/models/doppler';
import { activity, DEFAULT_MEAL, DIGESTIVE_ENZYMES, digestMeal, mealAt, mealConditions, testTube, tubeConditions } from '../../src/models/digestion';
import { pHFactor, findEnzyme } from '../../src/models/enzyme';
import {
  amplify, bindingFraction, calibrate, checkPrimers, LADDER_100BP, migration, PRIMER_PAIRS, pcrConditions, revComp, TEMPLATE, wallaceTm,
} from '../../src/models/pcr';
import {
  antibodyResponse, coverageNeeded, finalSize, herdThreshold, MEASLES_VACCINE, PRIMARY, responseAt, SECONDARY, simulateSIR, sirConditions,
} from '../../src/models/immunity';

describe('termodinámica: primera ley con un gas ideal', () => {
  const s0 = initialState();
  it('estado inicial 100 kPa, 1 L y 300 K: n = PV/RT', () => {
    expect(N0).toBeCloseTo(100 / (R * 300), 12);
    expect(N0).toBeCloseTo(0.040090, 5);
  });
  it('isotérmico ×2: W = Q = 100·ln 2 J y ΔU = 0; isobárico ×2: W = 100 J, ΔU = 250 J, Q = 350 J', () => {
    const iso = gasProcess('isotermico', N0, 'diatomico', s0, 2);
    expect(iso.W).toBeCloseTo(100 * Math.LN2, 9);
    expect(iso.Q).toBeCloseTo(iso.W, 9);
    expect(iso.dU).toBeCloseTo(0, 9);
    const bar = gasProcess('isobarico', N0, 'diatomico', s0, 2);
    expect(bar.W).toBeCloseTo(100, 9);
    expect(bar.s2.T).toBeCloseTo(600, 9);
    expect(bar.dU).toBeCloseTo(250, 9);
    expect(bar.Q).toBeCloseTo(350, 9);
    // Helio: ΔU = 3/2·nRΔT = 150 J y Q = 250 J.
    const he = gasProcess('isobarico', N0, 'monoatomico', s0, 2);
    expect(he.dU).toBeCloseTo(150, 9);
    expect(he.Q).toBeCloseTo(250, 9);
  });
  it('isocórico: W = 0 y Q = ΔU; adiabático: Q = 0, ΔU = −W y P·V^γ constante', () => {
    const v = gasProcess('isocorico', N0, 'diatomico', s0, 2);
    expect(v.W).toBe(0);
    expect(v.Q).toBeCloseTo(v.dU, 12);
    expect(v.s2.P).toBeCloseTo(200_000, 6);
    const ad = gasProcess('adiabatico', N0, 'diatomico', s0, 2);
    expect(ad.Q).toBe(0);
    expect(ad.dU).toBeCloseTo(-ad.W, 9);
    expect(ad.s2.P * ad.s2.V ** 1.4).toBeCloseTo(s0.P * s0.V ** 1.4, 9);
    expect(ad.s2.P / 1000).toBeCloseTo(37.893, 3);
    expect(ad.s2.T).toBeCloseTo(227.36, 2);
    expect(ad.W).toBeCloseTo(60.535, 3);
    // El trabajo es el área bajo la curva: trapecios sobre la trayectoria.
    const area = ad.path.slice(1).reduce((s, p, i) => s + ((p.P + ad.path[i].P) / 2) * (p.V - ad.path[i].V), 0);
    expect(area).toBeCloseTo(ad.W, 1);
  });
  it('Otto con r = 8: η = 1 − 8^(−0,4) = 56,47 % con los calores y con la fórmula; área encerrada = trabajo neto', () => {
    const c = ottoCycle(8, 1800);
    expect(c.etaFormula).toBeCloseTo(1 - 8 ** -0.4, 12);
    expect(c.eta).toBeCloseTo(c.etaFormula, 9);
    expect(c.legs.reduce((s, l) => s + l.dU, 0)).toBeCloseTo(0, 9);
    expect(c.Wnet).toBeCloseTo(c.Qin + c.Qout, 9);
    expect(Math.abs(c.area - c.Wnet) / c.Wnet).toBeLessThan(2e-3);
    expect(c.eta).toBeLessThan(c.etaCarnotLimit);
    expect(() => ottoCycle(8, 500)).toThrow(RangeError);
    expect(cycleConditions(ottoCycle(12, 1800), 12).some((x) => x.text.includes('detonación'))).toBe(true);
  });
  it('Carnot entre 600 K y 300 K: η = 50 %; Q_sale/Q_entra = T_f/T_c', () => {
    const c = carnotCycle(600, 300);
    expect(c.eta).toBeCloseTo(0.5, 9);
    expect(-c.Qout / c.Qin).toBeCloseTo(0.5, 9);
    expect(Math.abs(c.area - c.Wnet) / c.Wnet).toBeLessThan(2e-3);
    expect(() => carnotCycle(300, 300)).toThrow(RangeError);
  });
  it('estado a lo largo del recorrido y avisos', () => {
    const c = ottoCycle(8, 1800);
    expect(stateAlong(c.legs, 0).s.V).toBeCloseTo(1e-3, 12);
    expect(stateAlong(c.legs, 0.25).leg).toBe(1);
    expect(stateAlong(c.legs, 1).s.T).toBeCloseTo(c.legs[3].s2.T, 6);
    expect(stateAlong(c.legs, 0.1).dWsign).toBe(-1);
    expect(stateAlong(c.legs, 0.3).dQsign).toBe(1);
    expect(processConditions(gasProcess('isocorico', N0, 'diatomico', initialState(), 10)).some((x) => x.level === 'advertencia')).toBe(true);
    expect(processConditions(gasProcess('adiabatico', N0, 'diatomico', initialState(), 2)).some((x) => x.level === 'nota')).toBe(true);
    expect(enclosedArea([{ V: 0, P: 0 }, { V: 0, P: 1 }, { V: 1, P: 1 }, { V: 1, P: 0 }])).toBeCloseTo(1, 12);
  });
});

describe('efecto Doppler y cono de Mach', () => {
  it('c(0 °C) = 331,3 m/s y c(20 °C) = 343,21 m/s', () => {
    expect(soundSpeed(0)).toBe(331.3);
    expect(soundSpeed(20)).toBeCloseTo(343.215, 3);
    expect(() => soundSpeed(100)).toThrow(RangeError);
  });
  it('700 Hz a 25 m/s: 755,0 Hz al acercarse, 652,5 al alejarse; observador que se acerca: 751,0', () => {
    expect(dopplerLine(700, 25, 0).fObs).toBeCloseTo(754.994, 3);
    expect(dopplerLine(700, -25, 0).fObs).toBeCloseTo(652.473, 3);
    expect(dopplerLine(700, 0, 25).fObs).toBeCloseTo(750.989, 3);
    const r = dopplerLine(700, 25, 0);
    expect(r.c / r.lambdaFront).toBeCloseTo(r.fObs, 9); // observador quieto: f' = c/λ_delante
    expect(dopplerLine(700, 400, 0).shock).toBe(true);
    expect(lineConditions(dopplerLine(700, 400, 0), 400, 0)[0].level).toBe('invalido');
  });
  it('paso de la ambulancia: lejos tiende a f/(1 ∓ v/c) y al frente vale f', () => {
    const p = passBy(700, 25, 10);
    expect(p.points[0].f).toBeGreaterThan(745);
    expect(p.points[p.points.length - 1].f).toBeLessThan(660);
    expect(p.points[120].f).toBeCloseTo(700, 9);
    expect(p.fApproach).toBeCloseTo(754.994, 3);
    // Monótona: la frecuencia oída solo baja.
    expect(p.points.every((x, i) => i === 0 || x.f <= p.points[i - 1].f + 1e-9)).toBe(true);
  });
  it('Mach 2: 30°; subsónico: sin cono; frentes con centro donde se emitieron', () => {
    const c = soundSpeed(20);
    expect(machCone(2 * c).angleDeg).toBeCloseTo(30, 9);
    expect(machCone(0.9 * c).angleDeg).toBeNull();
    const fr = wavefronts(0.5, 1, 4, 1);
    expect(fr).toHaveLength(5);
    expect(fr[4]).toEqual({ center: 0, radius: 4 });
    expect(fr[0]).toEqual({ center: 2, radius: 0 });
  });
});

describe('digestión: enzimas y pH a lo largo del tubo', () => {
  it('actividad 1 en el óptimo; pepsina a pH 7 y amilasa salival a pH 2 por debajo del 5 %', () => {
    for (const e of DIGESTIVE_ENZYMES) expect(activity(e.id, e.pHopt), e.id).toBeCloseTo(1, 12);
    expect(activity('pepsina', 7)).toBeLessThan(0.05);
    expect(activity('amilasa-salival', 2)).toBeLessThan(0.05);
    // Misma curva que la práctica de enzimas (amilasa salival 6,8 y anchura 1,6).
    expect(activity('amilasa-salival', 5.3)).toBeCloseTo(pHFactor(findEnzyme('amilasa'), 5.3), 12);
  });
  it('almuerzo típico: saliva ≈ 35 % del almidón, pepsina ≈ 15 % de las proteínas y casi todo digerido al final del íleon', () => {
    const r = digestMeal(DEFAULT_MEAL);
    expect(r.shareSaliva).toBeGreaterThan(30);
    expect(r.shareSaliva).toBeLessThan(40);
    expect(r.shareStomach.proteina).toBeGreaterThan(10);
    expect(r.shareStomach.proteina).toBeLessThan(20);
    for (const n of ['almidon', 'proteina', 'grasa'] as const) expect(r.digestedPct[n], n).toBeGreaterThan(95);
    expect(r.totalMinutes).toBe(451);
    expect(mealConditions(r)).toEqual([]);
    expect(mealAt(r, 0).remaining.almidon).toBe(1);
    expect(mealAt(r, 451).remaining.grasa).toBeCloseTo(r.segments[4].remaining.grasa, 12);
  });
  it('sin bilis queda grasa sin digerir; con antiácido la pepsina casi no actúa', () => {
    const sb = digestMeal({ ...DEFAULT_MEAL, situation: 'sin-bilis' });
    expect(100 - sb.digestedPct.grasa).toBeGreaterThan(20);
    expect(mealConditions(sb).some((c) => c.level === 'advertencia')).toBe(true);
    expect(mealConditions(sb).some((c) => c.text.includes('consultar al médico'))).toBe(true);
    const aa = digestMeal({ ...DEFAULT_MEAL, situation: 'antiacido' });
    expect(aa.shareStomach.proteina).toBeLessThan(3);
    const pa = digestMeal({ ...DEFAULT_MEAL, situation: 'pancreas' });
    expect(100 - pa.digestedPct.proteina).toBeGreaterThan(20);
  });
  it('tubo de ensayo con lugol: a pH 6,8 el almidón desaparece; a pH 2 sigue azul oscuro', () => {
    expect(testTube('amilasa-salival', 6.8, 30).lugol).toBe('amarillo');
    expect(testTube('amilasa-salival', 2, 30).lugol).toBe('azul oscuro');
    expect(testTube('pepsina', 2, 10).lugol).toBeNull();
    expect(tubeConditions(testTube('pepsina', 8, 10))[0].level).toBe('advertencia');
  });
});

describe('PCR y electroforesis', () => {
  it('molde de 600 pb reproducible y pares de cebadores de 20 nt', () => {
    expect(TEMPLATE).toHaveLength(600);
    expect(/^[ACGT]+$/.test(TEMPLATE)).toBe(true);
    for (const p of PRIMER_PAIRS) { expect(p.forward).toHaveLength(20); expect(p.reverse).toHaveLength(20); }
    expect(revComp('AACG')).toBe('CGTT');
  });
  it('regla de Wallace: ATGCATGCATGCATGCATGC → 60 °C', () => {
    expect(wallaceTm('ATGCATGCATGCATGCATGC')).toBe(60);
    expect(wallaceTm('AAAA')).toBe(8);
    expect(() => wallaceTm('ATGX')).toThrow(RangeError);
  });
  it('productos de 220, 350 y 570 pb; el reverso sin complemento inverso no da producto', () => {
    expect(checkPrimers('p1').product).toBe(220);
    expect(checkPrimers('p2').product).toBe(350);
    expect(checkPrimers('p3').product).toBe(570);
    const bad = checkPrimers('p4');
    expect(bad.product).toBeNull();
    expect(pcrConditions(bad, 55, 30)[0].level).toBe('invalido');
    for (const id of ['p1', 'p2', 'p3']) { const c = checkPrimers(id); expect(Math.abs(c.tmF - c.tmR), id).toBeLessThanOrEqual(5); }
  });
  it('N = N₀(1 + E)ⁿ: 2³⁰ con E = 1; la meseta limita el real', () => {
    expect(amplify(1, 1, 30).finalIdeal).toBe(2 ** 30);
    expect(amplify(1000, 0.9, 30).finalIdeal).toBeCloseTo(1000 * 1.9 ** 30, -3);
    const r = amplify(1e6, 1, 40);
    expect(r.final).toBeLessThanOrEqual(1e12);
    expect(r.final).toBeGreaterThan(0.99e12);
    expect(amplify(1000, 0.9, 30).cyclesToThreshold).toBe(26); // 1,9ⁿ ≥ 10⁷ → n = 26
  });
  it('gel: la recta de calibración con la escalera de 100 pb recupera los tamaños con menos del 2 % de error', () => {
    const fit = calibrate();
    expect(fit.r2).toBeCloseTo(1, 9);
    for (const bp of [220, 350, 570]) expect(Math.abs(fit.estimate(migration(bp)) - bp) / bp).toBeLessThan(0.02);
    expect(migration(100)).toBeGreaterThan(migration(1517));
    expect(LADDER_100BP).toHaveLength(12);
    expect(bindingFraction(50, 60)).toBeGreaterThan(0.99);
    expect(bindingFraction(66, 60)).toBe(0);
    expect(bindingFraction(59, 60)).toBeCloseTo(0.6, 12);
  });
});

describe('sistema inmune: respuesta de anticuerpos, SIR e inmunidad colectiva', () => {
  it('respuesta primaria y secundaria (forma ilustrativa): la secundaria llega antes y es 20 veces mayor', () => {
    expect(responseAt(PRIMARY, PRIMARY.peakDay)).toBeCloseTo(1, 12);
    expect(responseAt(PRIMARY, 3)).toBe(0);
    const run = antibodyResponse([{ day: 0, kind: 'vacuna' }, { day: 30, kind: 'infeccion' }]);
    expect(run.peaks[1].secondary).toBe(true);
    expect(run.peaks[1].titer / run.peaks[0].titer).toBeGreaterThan(19);
    expect(SECONDARY.peakDay).toBeLessThan(PRIMARY.peakDay);
  });
  it('umbral 1 − 1/R₀: sarampión 91,7–94,4 %; influenza 21,9 %; cobertura con 97 % de eficacia: 96,2 %', () => {
    expect(herdThreshold(12)).toBeCloseTo(0.91667, 5);
    expect(herdThreshold(18)).toBeCloseTo(0.94444, 5);
    expect(herdThreshold(1.28)).toBeCloseTo(0.21875, 5);
    expect(coverageNeeded(15, MEASLES_VACCINE.twoDoses)).toBeCloseTo(0.93333 / 0.97, 4);
    expect(herdThreshold(0.8)).toBe(0);
  });
  it('SIR sin vacunas con R₀ = 2 termina como la ecuación del tamaño final (79,7 %)', () => {
    const run = simulateSIR({ R0: 2, infectiousDays: 7, coverage: 0, efficacy: 1, N: 1e6, I0: 1, days: 600 });
    expect(finalSize(2)).toBeCloseTo(0.7968, 4);
    expect(run.attackRate).toBeCloseTo(finalSize(2), 3);
    const last = run.points[run.points.length - 1];
    expect(last.S + last.I + last.R + last.V).toBeCloseTo(1e6, 3);
  });
  it('con cobertura sobre el umbral el brote no crece; por debajo sí', () => {
    const base = { R0: 15, infectiousDays: 8, efficacy: 0.97, N: 10000, I0: 5, days: 200 };
    const high = simulateSIR({ ...base, coverage: 0.98 });
    expect(high.herd).toBe(true);
    expect(high.Reff0).toBeLessThan(1);
    expect(high.peak.I).toBeCloseTo(5, 6);
    const low = simulateSIR({ ...base, coverage: 0.8 });
    expect(low.herd).toBe(false);
    expect(low.peak.I).toBeGreaterThan(50);
    expect(sirConditions(low, 'sarampion').some((c) => c.text.includes('no alcanza el umbral'))).toBe(true);
    expect(sirConditions(simulateSIR({ ...base, R0: 18, efficacy: 0.9, coverage: 0.5 }), 'imaginaria')[0].level).toBe('advertencia');
  });
});

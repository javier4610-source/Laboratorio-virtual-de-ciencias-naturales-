import { describe, expect, it } from 'vitest';
import { length, type ArrowItem, type BoxItem, type ParticlesItem, type RodItem, type SceneItem, type SphereItem, type Vec3 } from '../../src/three/scene';
import { bounce, boxParticles, electronsAlong, glassColor, pathLength, pointAt, seeds } from '../../src/labs/lote3d4/elec3d';
import { DRIFT_CAP, DRIFT_CURRENT, driftSpeed, nodePos, simpleCircuitScene } from '../../src/labs/lote3d4/simpleCircuits3d';
import { circuitScene, V_SCALE } from '../../src/labs/lote3d4/circuits3d';
import { chargeSpeed, conductorScene, FULL_SPEED, LIQUID_IONS } from '../../src/labs/lote3d4/conductors3d';
import { EMF_ARROW_CM, fieldLine, GALV_FULL_MV, inductionScene, LINES_PER_PLANE, loopPsi, PLANES, PSI_STEP, threadingLines } from '../../src/labs/lote3d4/induction3d';
import { drawnPressure, gasLength, gasScene, P_ARROW, particleSpeed, SPEED_25C } from '../../src/labs/lote3d4/gas3d';
import { E_SCALE, effectiveFraction, kineticsScene, reactantCount } from '../../src/labs/lote3d4/kinetics3d';
import { dotsFor, feScene, no2Scene } from '../../src/labs/lote3d4/equilibrium3d';
import { ions, logDots, mixHex, phScene } from '../../src/labs/lote3d4/ph3d';
import { solveSimpleCircuit, type NetPart } from '../../src/models/simpleCircuits';
import { solveCircuit } from '../../src/models/circuits';
import { testSample } from '../../src/models/conductors';
import { coilLinkage, dipoleLoopFlux, signedMoment } from '../../src/models/induction';
import { INITIAL, simulateGas } from '../../src/models/gases';
import { CATALYSTS, simulateKinetics, volumeAt } from '../../src/models/kinetics';
import { FE_INITIAL, NO2_INITIAL, solveFeSCN, solveNO2 } from '../../src/models/equilibrium';
import { dilutedPH, titrate } from '../../src/models/acidbase';
import { R_GAS } from '../../src/models/math';

const byId = (items: SceneItem[], id: string) => items.find((i) => i.id === id);
const ids = (items: SceneItem[]) => items.map((i) => i.id);

describe('piezas comunes', () => {
  it('electrones a lo largo de un camino: densidad fija y avance contrario a la corriente convencional', () => {
    const path: Vec3[] = [[0, 0, 0], [2, 0, 0]];
    expect(pathLength(path)).toBe(2);
    expect(pointAt(path, 0.5)).toEqual([0.5, 0, 0]);
    const a = electronsAlong(path, 0, 0.25), b = electronsAlong(path, 0.1, 0.25);
    expect(a).toHaveLength(8);
    // Con un avance de 0,1 cada electrón retrocede 0,1 (va al revés del camino convencional), módulo la separación.
    expect(b[0][0]).toBeCloseTo(a[1][0] - 0.1, 12);
    expect(bounce(0.2, 1, 1.5, 1)).toBeCloseTo(0.3, 12);
    const pts = boxParticles(seeds(20, 1), [0, 0, 0], [1, 2, 3], 5, 7.3);
    for (const p of pts) { expect(p[0]).toBeGreaterThanOrEqual(0); expect(p[1]).toBeLessThanOrEqual(2); expect(p[2]).toBeLessThanOrEqual(3); }
    expect(glassColor(0)).not.toBe(glassColor(1));
  });
});

describe('circuitos simples: la mesa y el modelo', () => {
  const net: NetPart[] = [
    { id: 'P1', kind: 'pila', a: 'r2c0', b: 'r1c0' },
    { id: 'P2', kind: 'pila', a: 'r3c0', b: 'r2c0' },
    { id: 'S1', kind: 'interruptor', a: 'r1c0', b: 'r1c1', closed: true },
    { id: 'B1', kind: 'bombillo', a: 'r1c1', b: 'r1c2' },
    { id: 'B2', kind: 'bombillo', a: 'r1c2', b: 'r1c3' },
    { id: 'C1', kind: 'cable', a: 'r1c3', b: 'r3c3' },
    { id: 'C2', kind: 'cable', a: 'r3c3', b: 'r3c0' },
  ];
  it('brillo del modelo, electrones con rapidez ∝ corriente de cada tramo', () => {
    const res = solveSimpleCircuit(net);
    expect(res.status).toBe('cerrado');
    const s = simpleCircuitScene({ netlist: net, res, wireColor: { C1: 0, C2: 1 }, t: 0 });
    // En serie la corriente es la misma en todos los tramos: todos con la misma rapidez dibujada.
    const speeds = s.flowing.map((f) => f.speed);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeLessThan(1e-9);
    expect(speeds[0]).toBeCloseTo(Math.abs(res.parts.B1.current) / DRIFT_CURRENT, 9);
    expect(s.electrons).toBeGreaterThan(10);
    // El bombillo: halo presente porque brilla; el color de la ampolla depende de P/Pₙ.
    expect((byId(s.items, 'B1') as SphereItem).color).toBe(glassColor(res.parts.B1.brightness));
    expect(ids(s.items)).toContain('B1-halo');
    // La pieza está entre sus bornes.
    const pila = byId(s.items, 'P1') as RodItem;
    expect(pila.from[0]).toBeCloseTo(nodePos('r2c0')[0], 12);
    expect(s.description).toContain('El circuito está cerrado');
    expect(driftSpeed(100)).toBe(DRIFT_CAP);
  });
  it('con el interruptor abierto no hay electrones en movimiento ni brillo', () => {
    const open = net.map((p) => (p.id === 'S1' ? { ...p, closed: false } : p));
    const res = solveSimpleCircuit(open);
    const s = simpleCircuitScene({ netlist: open, res, wireColor: {}, t: 3 });
    expect(s.electrons).toBe(0);
    expect(ids(s.items)).not.toContain('B1-halo');
    expect(s.description).toContain('abierto');
  });
});

describe('circuitos: paisaje de potencial', () => {
  const base = { emf: 6, internalResistance: 0.5, resistances: [10, 20, 30] as [number, number, number], closed: [true, true, true] as [boolean, boolean, boolean], mainSwitch: true };
  it('en serie, la pila sube al voltaje de los bornes y cada bombillo baja su caída del modelo hasta 0 V', () => {
    const res = solveCircuit({ ...base, topology: 'serie' });
    const s = circuitScene({ topology: 'serie', res, emf: 6, closed: base.closed, main: true, t: 0 });
    expect(s.heights.battery).toBeCloseTo(res.terminalVoltage * V_SCALE, 12);
    expect(s.heights.afterR[0]).toBeCloseTo((res.terminalVoltage - res.elements[0].voltage) * V_SCALE, 12);
    expect(s.heights.afterR[2]).toBeCloseTo(0, 9);
    expect(s.segments).toHaveLength(1);
    expect(s.segments[0].current).toBeCloseTo(res.totalCurrent, 12);
  });
  it('en paralelo, las corrientes de los tramos son las del modelo y se conservan en los nudos', () => {
    const res = solveCircuit({ ...base, topology: 'paralelo' });
    const s = circuitScene({ topology: 'paralelo', res, emf: 6, closed: base.closed, main: true, t: 0 });
    const cur = s.segments.map((x) => x.current);
    expect(cur[0]).toBeCloseTo(res.totalCurrent, 12);
    expect(cur[1]).toBeCloseTo(res.elements[1].current + res.elements[2].current, 12);
    expect(res.elements.reduce((a, e) => a + e.current, 0)).toBeCloseTo(res.totalCurrent, 9);
    // Cada rama baja del cable de arriba a ~0 V.
    for (const h of s.heights.afterR) expect(h).toBeCloseTo(0, 9);
  });
  it('abierto: sin electrones y con el escalón en el interruptor', () => {
    const res = solveCircuit({ ...base, topology: 'serie', mainSwitch: false });
    const s = circuitScene({ topology: 'serie', res, emf: 6, closed: base.closed, main: false, t: 2 });
    expect(s.segments).toHaveLength(0);
    expect(ids(s.items)).not.toContain('electrones');
    expect(s.description).toContain('interruptor abierto');
  });
});

describe('conductores: cargas libres y ligadas según el modelo', () => {
  it('cobre: electrones libres que avanzan con rapidez ∝ I/I_cc; PVC: ligados y quietos', () => {
    const cu = testSample({ sampleId: 'cobre', cells: 1 });
    const a = conductorScene({ res: cu, closed: true, glow: 0.2, t: 0 }), b = conductorScene({ res: cu, closed: true, glow: 0.2, t: 0.5 });
    expect(a.free).toBeGreaterThan(0);
    expect(a.speed).toBeCloseTo(FULL_SPEED * cu.currentFraction, 12);
    expect((byId(a.items, 'electrones') as ParticlesItem).points).not.toEqual((byId(b.items, 'electrones') as ParticlesItem).points);
    expect(conductorScene({ res: cu, closed: false, glow: 0, t: 1 }).speed).toBe(0);
    const pvc = testSample({ sampleId: 'pvc', cells: 2 });
    const p = conductorScene({ res: pvc, closed: true, glow: 0, t: 0 });
    expect(p.free).toBe(0);
    expect(p.bound).toBeGreaterThan(0);
    expect(p.description).toContain('ligados');
  });
  it('agua con sal: iones (los mismos del banco) que se mueven en sentidos opuestos', () => {
    const r = testSample({ sampleId: 'salada', cells: 1 });
    const s0 = conductorScene({ res: r, closed: true, glow: 0, t: 0 });
    expect(s0.free).toBe(LIQUID_IONS.salada);
    expect(chargeSpeed(r)).toBeCloseTo(FULL_SPEED * r.currentFraction, 12);
    const s1 = conductorScene({ res: r, closed: true, glow: 0, t: 0.2 });
    const dx = (id: string) => (byId(s1.items, id) as ParticlesItem).points[0][0] - (byId(s0.items, id) as ParticlesItem).points[0][0];
    expect(dx('iones-pos')).toBeLessThan(0);
    expect(dx('iones-neg')).toBeGreaterThan(0);
  });
});

describe('inducción: líneas de campo y corriente inducida', () => {
  it('las líneas que cruzan la espira central son proporcionales al flujo del dipolo por ella', () => {
    expect(threadingLines(0)).toBe(LINES_PER_PLANE);
    expect(threadingLines(20)).toBe(0);
    for (const d of [0.5, 1, 2, 3, 4]) {
      // floor(ψ/Δ): y el flujo del modelo por una espira es ∝ ψ (función de flujo del dipolo en su borde).
      expect(threadingLines(d)).toBe(Math.floor(loopPsi(d) / PSI_STEP + 1e-9));
      expect(dipoleLoopFlux(1, 0.02, d / 100) / dipoleLoopFlux(1, 0.02, 0.005)).toBeCloseTo(loopPsi(d) / loopPsi(0.5), 6);
    }
    // Cada punto de una línea cumple r = r₀ sin²θ.
    for (const p of fieldLine(-5, 8, 0.3, () => false)) {
      const x = p[0] + 5, rho = Math.hypot(p[1], p[2]), r = Math.hypot(x, rho);
      expect(r).toBeCloseTo(8 * (rho / r) ** 2, 9);
    }
  });
  it('la corriente inducida sigue el signo y el tamaño de la fem; el flujo es el del modelo', () => {
    const m = signedMoment('ferrita', 'N');
    const lk = coilLinkage(m, 200, -0.03);
    const pos = inductionScene({ magnet: 'ferrita', pole: 'N', turns: 200, xm: -0.03, emfMv: 500, linkage: lk, moving: true });
    const neg = inductionScene({ magnet: 'ferrita', pole: 'N', turns: 200, xm: -0.03, emfMv: -500, linkage: lk, moving: true });
    const a = byId(pos.items, 'I-0') as ArrowItem, b = byId(neg.items, 'I-0') as ArrowItem;
    expect(length(a.vector)).toBeCloseTo((500 / GALV_FULL_MV) * EMF_ARROW_CM, 9);
    expect(a.vector[1]).toBeCloseTo(-b.vector[1], 12);
    expect((byId(pos.items, 'B-inducido') as ArrowItem).vector[0]).toBeGreaterThan(0);
    expect(neg.description).toContain('polo norte');
    expect(pos.description).toContain(`${(Math.abs(lk) * 1000).toFixed(3).replace('.', ',')} mWb`);
    const still = inductionScene({ magnet: 'ferrita', pole: 'S', turns: 50, xm: -0.2, emfMv: 0, linkage: 0, moving: false });
    expect(ids(still.items)).not.toContain('I-0');
    expect(still.threading).toBe(0);
    expect(PLANES).toBe(6);
  });
});

describe('gases: émbolo, rapidez y presión del dibujo = la del modelo', () => {
  it('el largo del gas es el volumen; la rapidez ∝ √T; la flecha ∝ P', () => {
    for (const [law, volume, temperature] of [['boyle', 50, 25], ['charles', 100, 80], ['gay-lussac', 100, -10]] as const) {
      const r = simulateGas({ law, volume, temperature, pressure: INITIAL.pressure });
      const s = gasScene({ law, volume: r.volume, pressure: r.pressure, temperatureK: r.temperatureK, temperatureC: r.temperatureC, t: 1.3 });
      expect(s.length).toBeCloseTo(gasLength(r.volume), 12);
      expect((byId(s.items, 'embolo') as RodItem).from[0]).toBeCloseTo(s.length, 12);
      expect(s.speed).toBeCloseTo(SPEED_25C * Math.sqrt(r.temperatureK / 298.15), 12);
      expect((byId(s.items, 'P') as ArrowItem).vector[0]).toBeCloseTo(r.pressure * P_ARROW, 12);
      // (choques/s)·(empuje por choque) del dibujo = P/P₀ del gas ideal del modelo.
      expect(drawnPressure(r.temperatureK, r.volume).pressure).toBeCloseTo(r.pressure / INITIAL.pressure, 3);
      for (const p of s.points) expect(p[0]).toBeLessThanOrEqual(s.length);
    }
    expect(particleSpeed(4 * 298.15)).toBeCloseTo(2 * SPEED_25C, 12);
  });
});

describe('cinética: gas producido, barrera y fracción de choques efectivos', () => {
  it('1 punto por mL del modelo en ese instante; barrera ∝ Eₐ; catalizador baja la barrera', () => {
    const res = simulateKinetics({ reaction: 'peroxido', concentration: 3, temperature: 35, catalyst: 'mno2' });
    const v = volumeAt(res.series, 60);
    const mno2 = CATALYSTS.find((c) => c.id === 'mno2')!, none = CATALYSTS.find((c) => c.id === 'ninguno')!;
    const s = kineticsScene({ marble: false, concentration: 3, temperature: 35, particle: 'granulado', catalyst: 'mno2', ea: mno2.ea, eaUncatalyzed: none.ea, rateConstant: res.rateConstant, simT: 60, volume: v, remaining: 1, speedUp: 30 });
    expect(s.gasDots).toBe(Math.floor(v));
    expect((byId(s.items, 'gas') as ParticlesItem).points).toHaveLength(Math.floor(v));
    expect((byId(s.items, 'Ea') as ArrowItem).vector[1]).toBeCloseTo(mno2.ea * E_SCALE, 12);
    expect(ids(s.items).some((i) => i.startsWith('sin-catalizador'))).toBe(true);
    expect(s.fraction).toBeCloseTo(Math.exp(-mno2.ea / (R_GAS * 308.15)), 15);
    expect(effectiveFraction(45000, 35) / effectiveFraction(45000, 25)).toBeGreaterThan(1.5);
    expect(s.reactants).toBe(reactantCount(false, 3));
    expect(reactantCount(true, 2)).toBeGreaterThan(reactantCount(true, 1));
    expect(s.description).toContain('A los 60 s');
  });
});

describe('equilibrio: proporciones del modelo', () => {
  it('sistema A: 1 punto por µmol de cada especie en el tubo', () => {
    const eq = solveFeSCN({ ...FE_INITIAL, gotasFe: 2 });
    const s = feScene({ fe: eq.fe, scn: eq.scn, complex: eq.complex, volumeML: eq.volumeML, precipitated: eq.precipitated, K: eq.K, Q: eq.Q, temperature: 25, direction: 'productos', settled: true, perturbed: true, liquid: 'rgb(226, 96, 38)' });
    expect(s.counts.complex).toBe(dotsFor(eq.complex, eq.volumeML));
    expect(s.counts.fe).toBe(Math.round(eq.fe * eq.volumeML * 1000));
    expect((byId(s.items, 'liquido') as RodItem).color).toBe('#e26026');
    expect(s.description).toContain('hacia los productos');
  });
  it('sistema B: 1 molécula por 0,05 mmol; al comprimir hay más N₂O₄', () => {
    const a = solveNO2(NO2_INITIAL), b = solveNO2({ ...NO2_INITIAL, volumen: 30 });
    const mk = (e: typeof a, v: number) => no2Scene({ nNO2: e.nNO2, nN2O4: e.nN2O4, volume: v, temperature: 25, intensity: e.intensity, K: e.K, Q: e.Q, direction: 'ninguno', settled: true, perturbed: false });
    const sa = mk(a, 60), sb = mk(b, 30);
    expect(sa.counts.no2).toBe(Math.round(a.nNO2 / 0.05));
    expect(sb.counts.n2o4).toBeGreaterThan(sa.counts.n2o4);
    expect((byId(sb.items, 'embolo') as RodItem).from[0]).toBeCloseTo(1.5, 12);
  });
});

describe('pH: escala logarítmica', () => {
  it('3 puntos por potencia de 10: H₃O⁺ = 3(14 − pH) y OH⁻ = 3·pH', () => {
    const r = titrate({ acidId: 'hcl', acidConc: 0.1, acidVolume: 25, baseConc: 0.1, baseVolume: 10 });
    const s = phScene({ pH: r.pH, context: 'prueba;', indicator: null });
    expect(s.counts.h3o).toBe(Math.round(3 * (14 - r.pH)));
    expect(s.counts.oh).toBe(Math.round(3 * r.pH));
    const { h3o, oh } = ions(r.pH);
    expect(h3o * oh).toBeCloseTo(1e-14, 25);
    expect(logDots(1e-7)).toBe(21);
    expect((byId(s.items, 'col-H3O') as BoxItem).size[1]).toBeGreaterThan((byId(s.items, 'col-OH') as BoxItem).size[1]);
    expect(s.description).toContain('LOGARÍTMICA');
    const d = phScene({ pH: dilutedPH('hcl', 0.1, 1e3), context: 'diluido;', indicator: null });
    expect(d.counts.h3o).toBe(Math.round(3 * (14 - dilutedPH('hcl', 0.1, 1e3))));
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

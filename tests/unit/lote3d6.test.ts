import { describe, expect, it } from 'vitest';
import type { ArrowItem, EllipsoidItem, ParticlesItem, RodItem, SceneItem } from '../../src/three/scene';
import { cylinderPoints, hash01, tempColor, TEMP_STOPS } from '../../src/labs/lote3d6/common';
import { mixturesScene, particleCount, PER_G, waterLevel } from '../../src/labs/lote3d6/mixtures3d';
import { agitation, heatScene, FLOW_LEN, type HeatSceneInput } from '../../src/labs/lote3d6/heat3d';
import { conductionScene, reachAbove, segmentTemps } from '../../src/labs/lote3d6/conduction3d';
import { motionScene, pathFromPos } from '../../src/labs/lote3d6/motion3d';
import { A_SCALE, kinematicsScene, V_LEN, wallY } from '../../src/labs/lote3d6/kinematics3d';
import { classCounts, pigmentHex, selectionScene } from '../../src/labs/lote3d6/selection3d';
import { hwCounts, popGenScene } from '../../src/labs/lote3d6/popgen3d';
import { applyMethod, COMPONENTS, initialState } from '../../src/models/mixtures';
import { findMetal, heatFlows, simulate, temperaturesAt } from '../../src/models/heat';
import { simulateConduction, temperatureAt, WAX_MELT_T } from '../../src/models/conduction';
import { findMover, tripPosition, pathLengthAt } from '../../src/models/motion';
import { sampleCurve, simulateRun, stateAt } from '../../src/models/kinematics';
import { beetlePositions, beetleSample, survival } from '../../src/models/selection';
import { hardyWeinberg, simulatePopGen } from '../../src/models/popgen';

const byId = <T extends SceneItem = SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T | undefined;
const nPoints = (items: SceneItem[], id: string) => (byId<ParticlesItem>(items, id)?.points.length ?? 0);

describe('piezas comunes', () => {
  it('reparto reproducible y escala fija de temperatura', () => {
    expect(hash01(3, 1)).toBe(hash01(3, 1));
    const pts = cylinderPoints(50, [1, 0, 2], 0.5, 1, 3, 9);
    for (const p of pts) { expect(Math.hypot(p[0] - 1, p[2] - 2)).toBeLessThanOrEqual(0.5 + 1e-12); expect(p[1]).toBeGreaterThanOrEqual(1); expect(p[1]).toBeLessThanOrEqual(3); }
    expect(tempColor(5)).toBe(TEMP_STOPS[0][1]);
    expect(tempColor(100)).toBe(TEMP_STOPS[3][1]);
    expect(tempColor(150)).toBe(TEMP_STOPS[3][1]);
  });
});

describe('mezclas: cada componente donde lo deja el modelo, con partículas ∝ masa', () => {
  const m0 = { hierro: 5, arena: 5, sal: 5, aserrin: 0, aceite: 0 };
  it('mezcla seca: todo en el vaso', () => {
    const s = mixturesScene({ state: initialState(m0), last: null });
    for (const c of COMPONENTS) expect(nPoints(s.items, `vaso-${c.id}`)).toBe(particleCount(m0[c.id]));
    expect(particleCount(5)).toBe(5 * PER_G);
    expect(byId(s.items, 'agua')).toBeUndefined();
    expect(s.description).toContain('Aún no se ha separado nada');
  });
  it('imán → agua → filtración → evaporación: cada fracción en su herramienta', () => {
    let st = initialState(m0);
    for (const m of ['iman', 'agua', 'filtracion', 'evaporacion'] as const) st = applyMethod(st, m, { water: 100, power: 500 });
    const s = mixturesScene({ state: st, last: 'evaporacion' });
    // Fracciones del modelo, en orden: imán (hierro), papel filtro (arena + algo de sal), cápsula (sal).
    st.separated.forEach((f, i) => { for (const c of COMPONENTS) expect(nPoints(s.items, `f${i}-${c.id}`)).toBe(particleCount(f.masses[c.id])); });
    expect(byId(s.items, 'f0-a')?.label).toBe('1. Imán');
    expect(byId(s.items, 'f2-capsula')?.label).toBe('3. Cápsula de evaporación');
    expect(nPoints(s.items, 'f0-hierro')).toBe(15);
    expect(nPoints(s.items, 'f1-arena')).toBe(15);
    expect(st.separated[2].masses.sal).toBeCloseTo(5 * 0.97, 9);
    // El vaso quedó vacío y sin agua.
    for (const c of COMPONENTS) expect(nPoints(s.items, `vaso-${c.id}`)).toBe(0);
  });
  it('con agua la sal se dibuja disuelta en toda el agua; el agua sube ∝ masa', () => {
    const st = applyMethod(initialState(m0), 'agua', { water: 100 });
    const s = mixturesScene({ state: st, last: 'agua' });
    const sal = byId<ParticlesItem>(s.items, 'vaso-sal')!;
    expect(sal.label).toBe('Sal disuelta');
    expect(Math.max(...sal.points.map((p) => p[1]))).toBeGreaterThan(waterLevel(100) - 0.8);
    expect((byId<RodItem>(s.items, 'agua')!.to[1])).toBeCloseTo(waterLevel(100), 12);
    expect(waterLevel(200) - 0.3).toBeCloseTo(2 * (waterLevel(100) - 0.3), 12);
  });
});

describe('calor: temperaturas, agitación ∝ √T y flujo de calor del modelo', () => {
  const sim = simulate({ experiment: 'metal', metal: 'cobre', container: 'icopor', sampleMass: 100, sampleTemp: 99, waterMass: 100, waterTemp: 20 });
  const at = (t: number, transfer = 1): HeatSceneInput => {
    const T = transfer >= 1 ? temperaturesAt(sim, t) : { sample: 99, water: 20 };
    const f = transfer >= 1 ? heatFlows(sim, t) : { toWater: 0, toAir: 0 };
    const m = findMetal('cobre');
    return { isMetal: true, metalName: m.name, metalColor: m.color, density: m.density, container: 'icopor', sampleMass: 100, waterMass: 100, transfer, simT: t, poured: 0,
      sampleT: T.sample, waterT: T.water, toWater: f.toWater, toAir: f.toAir, G: sim.G, L: sim.L, sampleTemp0: 99, waterTemp0: 20, ambient: 28, lcd: T.water, clock: 0, done: false };
  };
  it('la agitación es ∝ √T absoluta', () => {
    expect(agitation(100) / agitation(0)).toBeCloseTo(Math.sqrt(373.15 / 273.15), 12);
    const s = heatScene(at(10));
    const T = temperaturesAt(sim, 10);
    expect(s.amps.sample / s.amps.water).toBeCloseTo(Math.sqrt((T.sample + 273.15) / (T.water + 273.15)), 12);
    expect(byId<ParticlesItem>(s.items, 'p-muestra')!.color).toBe(tempColor(T.sample));
    expect(byId<ParticlesItem>(s.items, 'p-agua')!.color).toBe(tempColor(T.water));
  });
  it('la flecha de calor mide ∝ G·(T₁ − T₂) y se acorta hasta desaparecer', () => {
    const a0 = byId<ArrowItem>(heatScene(at(0)).items, 'calor')!;
    expect(a0.vector[0]).toBeCloseTo(FLOW_LEN, 9);
    const a1 = byId<ArrowItem>(heatScene(at(20)).items, 'calor')!;
    expect(a1.vector[0]).toBeCloseTo((FLOW_LEN * heatFlows(sim, 20).toWater) / (sim.G * 79), 9);
    expect(a1.vector[0]).toBeLessThan(a0.vector[0]);
    const late = heatScene(at(600));
    expect(byId(late.items, 'calor')).toBeUndefined();
    expect(late.description).toContain('equilibrio térmico');
    // Antes de mezclar no hay flecha y la muestra está en la parrilla.
    const before = heatScene(at(0, 0));
    expect(byId(before.items, 'calor')).toBeUndefined();
    expect(before.description).toContain('Antes de mezclar');
  });
  it('el metal tiene el volumen m/ρ del modelo (cilindro de altura = diámetro)', () => {
    const s = heatScene(at(5));
    const V = 100 / findMetal('cobre').density;
    expect((Math.PI / 4) * s.metalD ** 3).toBeCloseTo(V, 9);
  });
});

describe('conduccion: el mapa de color es el perfil del modelo', () => {
  const sim = simulateConduction({ rod: 'cobre', cover: 'aire', bathT: 90 });
  const base = { cover: 'aire' as const, bathT: 90, indicator: 'tachuelas' as const, nTacks: 9, probes: [5, 15, 25], lcd: [50, 40, 30], started: true, done: false };
  it('cada centímetro tiene el color de temperatureAt en su centro', () => {
    const s = conductionScene({ ...base, main: { short: 'Cobre', solution: sim.solution }, compare: null, simT: 300 });
    for (const i of [0, 7, 29]) {
      const T = temperatureAt(sim.solution, (i + 0.5) / 100, 300);
      expect(s.temps[i]).toBeCloseTo(T, 12);
      expect(byId<RodItem>(s.items, `varilla-${i}`)!.color).toBe(tempColor(T));
    }
  });
  it('las tachuelas caen cuando el modelo dice que la cera llegó a 55 °C', () => {
    const t = 600;
    const s = conductionScene({ ...base, main: { short: 'Cobre', solution: sim.solution }, compare: null, simT: t });
    const expected = sim.solution.tackFall.filter((tf) => tf !== null && tf <= t).length;
    expect(s.fallen.length).toBe(expected);
    expect(s.description).toContain(`Cayeron ${expected} de 9`);
    expect(reachAbove(segmentTemps(sim.solution, t), WAX_MELT_T)).toBeGreaterThan(0);
  });
  it('la varilla de comparación es otra corrida del mismo modelo: el cobre conduce más lejos que la madera', () => {
    const wood = simulateConduction({ rod: 'madera', cover: 'aire', bathT: 90 });
    const s = conductionScene({ ...base, main: { short: 'Cobre', solution: sim.solution }, compare: { short: 'Madera', solution: wood.solution }, simT: 900 });
    expect(s.compareTemps![10]).toBeCloseTo(temperatureAt(wood.solution, 0.105, 900), 12);
    expect(reachAbove(s.temps, 40)).toBeGreaterThan(reachAbove(s.compareTemps!, 40));
    const before = conductionScene({ ...base, main: { short: 'Cobre', solution: sim.solution }, compare: null, simT: 0, started: false });
    expect(before.fallen).toHaveLength(0);
    expect(before.description).toContain('Aún no se ha encendido');
  });
});

describe('movimiento: camino recorrido y desplazamiento', () => {
  const m = findMover('corredor');
  it('el camino de la vista es pathLengthAt del modelo y el desplazamiento la posición', () => {
    const d = 20;
    for (const t of [1, 3, 5, 7, 8.8]) {
      const pos = tripPosition(m, d, 'idavuelta', t);
      const returning = t > d / m.v0;
      expect(pathFromPos(pos, d, 'idavuelta', returning)).toBeCloseTo(pathLengthAt(m, d, 'idavuelta', t), 9);
    }
  });
  it('al volver a la salida no hay flecha de desplazamiento y el camino es 2d', () => {
    const s = motionScene({ lanes: [{ kind: 'persona', name: m.name, pos: 0, returning: true }], start: 5, finish: 25, tape: 20, trip: 'idavuelta', isRace: false, gates: [0, 5, 10, 15, 20], phase: 'medido' });
    expect(s.paths[0]).toBe(40);
    expect(byId(s.items, 'desplazamiento-0')).toBeUndefined();
    expect(s.description).toContain('su desplazamiento es 0');
    const mid = motionScene({ lanes: [{ kind: 'persona', name: m.name, pos: 12, returning: false }], start: 5, finish: 25, tape: 20, trip: 'idavuelta', isRace: false, gates: [], phase: 'corriendo' });
    expect(byId<ArrowItem>(mid.items, 'desplazamiento-0')!.vector[0]).toBe(12);
    expect(byId<RodItem>(mid.items, 'camino-ida-0')!.to[0]).toBe(17);
    expect(mid.description).toContain('entre las marcas de 15 y 20 m');
  });
});

describe('cinematica: el ciclista, sus vectores y la pared x–t', () => {
  const input = { v0: 2, acceleration: 1, duration: 5 };
  const res = simulateRun(input), curve = sampleCurve(input);
  const vMax = Math.max(2, ...curve.map((p) => p.v));
  const at = (t: number, done = false) => {
    const s = stateAt(2, 1, t);
    return kinematicsScene({ x: s.x, v: s.v, t, acceleration: 1, vMax, strobe: res.strobe.filter((p) => p.t <= t + 1e-9), curve, target: [], tMax: 5, stopped: false, atEnd: s.x >= 50, started: true, running: !done, done, finalSpeed: res.finalSpeed, distance: res.distance, time: res.time });
  };
  it('posición, flecha v ∝ v(t) y flecha a ∝ a con escalas fijas', () => {
    const s = at(2.3);
    const st = stateAt(2, 1, 2.3);
    expect(byId<EllipsoidItem>(s.items, 'ciclista')!.center[0]).toBeCloseTo(st.x - 0.1, 12);
    expect(s.vLen).toBeCloseTo((st.v * V_LEN) / vMax, 12);
    expect(s.aLen).toBeCloseTo(A_SCALE, 12);
    expect(at(5).vLen).toBeCloseTo(V_LEN, 12);
  });
  it('solo las fotos ya tomadas, cada una a la altura de su instante; la curva continua al terminar', () => {
    const s = at(1.2);
    expect(nPoints(s.items, 'puntos-xt')).toBe(3);
    expect(byId<ParticlesItem>(s.items, 'puntos-xt')!.points[2][1]).toBeCloseTo(wallY(1, 5), 12);
    expect(byId(s.items, 'curva-1')).toBeUndefined();
    expect(byId(at(5, true).items, 'curva-1')).toBeDefined();
  });
  it('al frenar hasta detenerse desaparecen v y a', () => {
    const s = kinematicsScene({ x: 2, v: 0, t: 3, acceleration: -2, vMax: 2, strobe: [], curve: [], target: [], tMax: 5, stopped: true, atEnd: false, started: true, running: true, done: false, finalSpeed: 0, distance: 1, time: 5 });
    expect(byId(s.items, 'v')).toBeUndefined();
    expect(byId(s.items, 'a')).toBeUndefined();
  });
});

describe('seleccion: los conteos de cada color son los de la muestra del modelo', () => {
  const sample = beetleSample(0.3, 0.15, 40);
  const base = { backgroundName: 'Suelo volcánico', B: 0.8, mean: 0.3, sample, positions: beetlePositions(40, 2024), predation: 0.6, generation: 0 };
  it('40 escarabajos con su pigmento y columnas por clase de color', () => {
    const s = selectionScene({ ...base, measured: false });
    expect(s.items.filter((i) => i.id.startsWith('escarabajo-'))).toHaveLength(40);
    expect(byId<EllipsoidItem>(s.items, 'escarabajo-7')!.color).toBe(pigmentHex(sample[7]));
    expect(s.counts).toEqual(classCounts(sample));
    expect(s.counts.reduce((a, b) => a + b, 0)).toBe(40);
    expect(s.survivors).toBeNull();
    expect(s.description).toContain('Avanza una generación');
  });
  it('después de depredar: escapan n·s(z) de cada clase según el modelo', () => {
    const s = selectionScene({ ...base, measured: true });
    s.counts.forEach((n, k) => expect(s.survivors![k]).toBeCloseTo(n * survival((k + 0.5) / 10, 0.8, 0.6), 12));
    // Sobre un suelo oscuro, los claros escapan menos que los oscuros.
    expect(survival(0.25, 0.8, 0.6)).toBeLessThan(survival(0.75, 0.8, 0.6));
  });
});

describe('popgen: alelos de la isla y migrantes del modelo', () => {
  const r = simulatePopGen({ p0: 0.5, n: 30, generations: 50, fitness: { AA: 1, Aa: 1, aa: 1 }, mutationAtoa: 0, migration: 0.1, migrantP: 0.9, drift: true, replicates: 3, seed: 4 });
  it('copias de A = 2N·p del modelo (entero con deriva) y genotipos de Hardy-Weinberg', () => {
    const p = r.series[50].p[1];
    const s = popGenScene({ p, n: 30, generation: 50, replicate: 1, replicates: 3, drift: true, migration: 0.1, migrantP: 0.9 });
    expect(s.copiesA).toBe(Math.round(60 * p));
    expect(Math.abs(60 * p - s.copiesA)).toBeLessThan(1e-9);
    expect(s.shown).toBe(30);
    expect(s.counts).toEqual(hwCounts(p, 30));
    expect(s.counts.reduce((a, b) => a + b, 0)).toBe(30);
    // Bolitas de alelos: 2 por individuo.
    expect(nPoints(s.items, 'isla-A') + nPoints(s.items, 'isla-a')).toBe(60);
    expect(nPoints(s.items, 'isla-A')).toBe(2 * s.counts[0] + s.counts[1]);
    expect(s.migrants).toBe(3);
    expect(s.description).toContain(`${s.copiesA} copias del alelo A de 60`);
  });
  it('la cuenta de Hardy-Weinberg es la de la poza génica (mayores restos)', () => {
    expect(hwCounts(0.5)).toEqual([25, 50, 25]);
    const hw = hardyWeinberg(0.3);
    const c = hwCounts(0.3);
    expect(c[0]).toBe(Math.round(hw.AA * 100));
    expect(c.reduce((a, b) => a + b, 0)).toBe(100);
    const big = popGenScene({ p: 0.3, n: 5000, generation: 0, replicate: 0, replicates: 1, drift: false, migration: 0, migrantP: 0.5 });
    expect(big.shown).toBe(100);
    expect(big.copiesA).toBe(3000);
    expect(big.description).toContain('Sin migración');
  });
});

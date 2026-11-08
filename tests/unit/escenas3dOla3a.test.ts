import { describe, expect, it } from 'vitest';
import { K_FORCE, K_SPEED, orbitScene, sceneScale } from '../../src/labs/gravitation3d';
import { AU_PER_YEAR_KMS, integrateOrbit, orbitAt } from '../../src/models/gravitation';
import { diameterAt, K_HEAD, K_RADIUS, K_VEL, tracerXs, venturiScene } from '../../src/labs/venturi3d';
import { venturi } from '../../src/models/bernoulli';
import { carbonScene, fluxRadius, side } from '../../src/labs/carbon3d';
import { A_1750, atmosphereRate, findReservoir, GROSS, simulateCarbon } from '../../src/models/carbon';
import { calorimeterScene, K_ENERGY, K_THERMO, N_IONS } from '../../src/labs/calorimeter3d';
import { dissolution, neutralization, runCalorimeter, tempAt } from '../../src/models/thermochem';
import type { ArrowItem, ParticlesItem, SceneItem, SphereItem } from '../../src/three/scene';

const byId = <T extends SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T;
const len = (a: ArrowItem) => Math.hypot(...a.vector);

describe('ciclo del carbono 3D', () => {
  const s = { fossil2050: 9.6, landUse: 1.6, reforest: 0 };
  const run = simulateCarbon(s);
  const boxSide = (sc: ReturnType<typeof carbonScene>, id: string) => byId<Extract<SceneItem, { kind: 'box' }>>(sc.items, id).size[0];
  it('el volumen de cada cubo es proporcional al carbono del reservorio y la atmósfera crece con el año', () => {
    const sc = carbonScene({ run, s, year: 2019, mode: 'natural' });
    const vol = (id: string) => boxSide(sc, id) ** 3;
    expect(vol('oceano-profundo') / vol('oceano-superficie')).toBeCloseTo(37100 / 900, 6);
    expect(vol('suelos') / vol('vegetacion')).toBeCloseTo(findReservoir('suelos').mid / findReservoir('vegetacion').mid, 6);
    expect(boxSide(sc, 'atmosfera')).toBeCloseTo(side(A_1750), 12); // ciclo natural: la atmósfera de 1750
    expect(boxSide(carbonScene({ run, s, year: 2019, mode: 'humano' }), 'atmosfera')).toBeCloseTo(side(run.points[0].A), 12);
    const later = carbonScene({ run, s, year: 2100, mode: 'humano' });
    expect(later.atm).toBeGreaterThan(sc.atm);
    expect(boxSide(later, 'atmosfera')).toBeGreaterThan(boxSide(sc, 'atmosfera'));
  });
  it('flechas: el área de la sección es proporcional al flujo; naturales en «Reservorios» y humanas con sumideros en los escenarios', () => {
    const nat = carbonScene({ run, s, year: 2019, mode: 'natural' });
    expect(byId<ArrowItem>(nat.items, 'fotosintesis').radius).toBeCloseTo(fluxRadius(GROSS.photosynthesis), 12);
    expect(byId(nat.items, 'emision-fosil')).toBeUndefined();
    const hum = carbonScene({ run, s, year: 2019, mode: 'humano' });
    const r = atmosphereRate(run.points[0].A, s, 2019);
    const area = (id: string) => byId<ArrowItem>(hum.items, id).radius! ** 2;
    expect(area('emision-fosil') / area('sumidero-oceano')).toBeCloseTo(9.6 / r.ocean, 9);
    expect(byId(hum.items, 'fotosintesis')).toBeUndefined();
    expect(hum.description).toContain('Año 2019');
    // Sin deforestación no hay flecha de deforestación.
    const s0 = { fossil2050: 0, landUse: 0, reforest: 0 };
    expect(byId(carbonScene({ run: simulateCarbon(s0), s: s0, year: 2060, mode: 'humano' }).items, 'deforestacion')).toBeUndefined();
  });
});

describe('calorímetro 3D (termoquímica)', () => {
  const run = runCalorimeter(dissolution('naoh', 2, 100), 'icopor');
  it('los iones siguen la fracción disuelta y el sólido se achica', () => {
    const start = calorimeterScene(run, 0, 'icopor');
    expect(byId(start.items, 'cationes')).toBeUndefined();
    expect(byId(start.items, 'energia')).toBeUndefined();
    expect(byId(start.items, 'solido')).toBeDefined();
    const mid = calorimeterScene(run, run.exp.tau, 'icopor');
    const n = (s: ReturnType<typeof calorimeterScene>) => ((byId<ParticlesItem>(s.items, 'cationes')?.points.length ?? 0) + (byId<ParticlesItem>(s.items, 'aniones')?.points.length ?? 0));
    expect(n(mid)).toBe(Math.round(N_IONS * (1 - Math.exp(-1))));
    const end = calorimeterScene(run, 300, 'icopor');
    expect(n(end)).toBe(N_IONS);
    expect(byId(end.items, 'solido')).toBeUndefined();
  });
  it('el termómetro marca la temperatura del modelo y la flecha de energía va hacia afuera (exo) o hacia adentro (endo)', () => {
    const sc = calorimeterScene(run, 60, 'icopor');
    expect(sc.T).toBeCloseTo(tempAt(run.dTad, run.exp.tau, run.k, 60), 12);
    const col = byId<Extract<SceneItem, { kind: 'rod' }>>(sc.items, 'columna');
    expect(col.to[1] - col.from[1]).toBeCloseTo(1.2 + (sc.T - 25) * K_THERMO, 12);
    const e = byId<ArrowItem>(sc.items, 'energia');
    expect(e.vector[0]).toBeGreaterThan(0);
    expect(len(e)).toBeCloseTo(run.q * sc.reacted * K_ENERGY, 12);
    const cold = runCalorimeter(dissolution('nh4no3', 5, 100), 'icopor');
    const sc2 = calorimeterScene(cold, 60, 'icopor');
    expect(byId<ArrowItem>(sc2.items, 'energia').vector[0]).toBeLessThan(0);
    expect(sc2.description).toContain('endotérmico');
    // Vaso de vidrio: sin tapa; neutralización: sin sólido.
    const glass = calorimeterScene(runCalorimeter(neutralization(1, 50), 'vidrio'), 10, 'vidrio');
    expect(byId(glass.items, 'tapa')).toBeUndefined();
    expect(byId(glass.items, 'solido')).toBeUndefined();
  });
});

describe('tubo de Venturi 3D (Bernoulli)', () => {
  it('el radio del tubo sigue el diámetro y los trazadores se separan (D₁/D₂)² veces más en la garganta', () => {
    expect(diameterAt(-2.5, 25, 12.5)).toBe(25);
    expect(diameterAt(0, 25, 12.5)).toBe(12.5);
    expect(diameterAt(-0.85, 25, 12.5)).toBeCloseTo(18.75, 12);
    const xs = tracerXs(25, 12.5);
    const gapIn = xs[2] - xs[1];
    const inThroat = xs.filter((x) => x > -0.5 && x < 0.5);
    expect(inThroat.length).toBeGreaterThanOrEqual(1);
    // La separación mayor (un tramo recorrido casi todo en la garganta) se acerca a 4 veces la de la entrada.
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    expect(Math.max(...gaps) / gapIn).toBeGreaterThan(3.3);
    expect(Math.max(...gaps) / gapIn).toBeLessThanOrEqual(4 + 1e-6);
    expect(gapIn).toBeCloseTo(0.25, 2);
    // Sin garganta (D₂ = D₁) todos los trazadores quedan igual de separados.
    const flat = tracerXs(25, 25);
    for (let i = 1; i < flat.length; i++) expect(flat[i] - flat[i - 1]).toBeCloseTo(0.25, 2);
  });
  it('las flechas miden la rapidez y las columnas la altura de presión del modelo (la garganta es la más baja)', () => {
    const sc = venturiScene(0.3, 25, 12.5);
    const r = venturi(0.3, 25, 12.5);
    expect(len(byId<ArrowItem>(sc.items, 'v-entrada'))).toBeCloseTo(r.v1 * K_VEL, 12);
    expect(len(byId<ArrowItem>(sc.items, 'v-garganta'))).toBeCloseTo(r.v2 * K_VEL, 12);
    const col = (id: string) => { const c = byId<Extract<SceneItem, { kind: 'rod' }>>(sc.items, `columna-${id}`); return c.to[1] - c.from[1]; };
    expect(col('entrada')).toBeCloseTo(r.h1 * K_HEAD, 12);
    expect(col('garganta')).toBeCloseTo(r.h2 * K_HEAD, 12);
    expect(col('salida')).toBeCloseTo(col('entrada'), 12);
    expect(col('garganta')).toBeLessThan(col('entrada'));
    expect(sc.description).toContain('Δh = 28,6 cm');
    // Columna vacía: no se dibuja.
    expect(byId(venturiScene(1, 25, 8).items, 'columna-garganta')).toBeUndefined();
    expect(Math.abs(byId<Extract<SceneItem, { kind: 'rod' }>>(sc.items, 'tubo-20').radius - 12.5 / 2 * K_RADIUS)).toBeLessThan(1e-12);
  });
});

describe('órbita 3D (gravitación)', () => {
  const run = integrateOrbit(1, 0.6);
  it('el Sol está en el foco, el planeta en la posición integrada y la velocidad mide la rapidez del modelo', () => {
    const t = run.period * 0.3;
    const sc = orbitScene({ run, t, inclDeg: 0, name: 'Planeta imaginario' });
    expect(byId<SphereItem>(sc.items, 'sol').center).toEqual([0, 0, 0]);
    const st = orbitAt(run, t);
    const p = byId<SphereItem>(sc.items, 'planeta');
    expect(Math.hypot(...p.center)).toBeCloseTo(st.r * sceneScale(run), 9);
    const v = byId<ArrowItem>(sc.items, 'velocidad');
    expect(len(v)).toBeCloseTo(st.v * AU_PER_YEAR_KMS * K_SPEED, 9);
    // La velocidad es tangente: perpendicular al radio solo en perihelio y afelio; aquí, paralela a (vx, vy).
    expect(v.vector[0] / len(v)).toBeCloseTo(st.vx / st.v, 9);
    const f = byId<ArrowItem>(sc.items, 'fuerza');
    expect(len(f)).toBeCloseTo((1 / st.r ** 2) * K_FORCE, 9);
    // La fuerza apunta al Sol.
    const dot = (f.vector[0] * -p.center[0] + f.vector[1] * -p.center[1] + f.vector[2] * -p.center[2]) / (len(f) * Math.hypot(...p.center));
    expect(dot).toBeCloseTo(1, 9);
    expect(sc.description).toContain('excentricidad 0,600');
  });
  it('va más rápido en el perihelio que en el afelio y la fuerza es mayor cerca del Sol', () => {
    const peri = orbitScene({ run, t: 0, inclDeg: 0, name: 'x' });
    const aph = orbitScene({ run, t: run.period / 2, inclDeg: 0, name: 'x' });
    expect(len(byId<ArrowItem>(peri.items, 'velocidad')) / len(byId<ArrowItem>(aph.items, 'velocidad'))).toBeCloseTo(1.6 / 0.4, 4);
    expect(len(byId<ArrowItem>(peri.items, 'fuerza'))).toBeGreaterThan(len(byId<ArrowItem>(aph.items, 'fuerza')));
  });
  it('las áreas rellenas del perihelio y del afelio, los 8 radios y la inclinación del plano', () => {
    const sc = orbitScene({ run, t: 0, inclDeg: 7, name: 'Mercurio' });
    expect(sc.items.filter((i) => i.id.startsWith('radio-'))).toHaveLength(8);
    const a1 = byId<ParticlesItem>(sc.items, 'area-perihelio'), a2 = byId<ParticlesItem>(sc.items, 'area-afelio');
    expect(a1.points.length).toBe(a2.points.length);
    // El relleno del afelio llega más lejos del Sol.
    const far = (q: ParticlesItem) => Math.max(...q.points.map((pt) => Math.hypot(...pt)));
    expect(far(a2)).toBeGreaterThan(far(a1));
    // Inclinación de 7°: los puntos de la órbita salen del plano y = 0.
    const ys = sc.items.filter((i) => i.id.startsWith('orbita-')).map((i) => (i as Extract<SceneItem, { kind: 'rod' }>).from[1]);
    expect(Math.max(...ys.map(Math.abs))).toBeGreaterThan(0.1);
    const flat = orbitScene({ run, t: 0, inclDeg: 0, name: 'x' });
    expect(flat.items.filter((i) => i.id.startsWith('orbita-')).every((i) => Math.abs((i as Extract<SceneItem, { kind: 'rod' }>).from[1]) < 1e-12)).toBe(true);
  });
});

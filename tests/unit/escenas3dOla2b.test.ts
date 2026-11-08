import { describe, expect, it } from 'vitest';
import { earthScene, K_FLUX, K_FORCING, R_EARTH, R_LAYER } from '../../src/labs/greenhouse3d';
import { layerModel, co2Forcing } from '../../src/models/greenhouse';
import { glucoseScene, K_GLUCOSE, K_INSULIN, PER_GLUCAGON, PER_GLUCOSE, PER_INSULIN } from '../../src/labs/glucose3d';
import { fluxesAt, simulateGlucose, stateAt, type GlucoseInput } from '../../src/models/glucose';
import { specimenItems, specimenScene, trayScene } from '../../src/labs/classification3d';
import { buildKey, findOrganism, ORGANISMS } from '../../src/models/classification';
import type { ArrowItem, EllipsoidItem, ParticlesItem, SceneItem, SphereItem } from '../../src/three/scene';

const byId = <T extends SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T;
const len = (a: ArrowItem) => Math.hypot(...a.vector);

describe('la Tierra y su atmósfera en 3D (efecto invernadero)', () => {
  it('la sombra es un disco del radio de la Tierra y los rayos paralelos tocan la superficie del lado de día', () => {
    const sc = earthScene({ S: 1361, albedo: 0.3, eps: 0.78 });
    const shadow = byId<EllipsoidItem>(sc.items, 'sombra');
    expect(shadow.radii[1]).toBe(R_EARTH);
    expect(shadow.radii[2]).toBe(R_EARTH);
    expect(shadow.radii[0]).toBeLessThan(0.05);
    const rays = sc.items.filter((i) => i.id.startsWith('rayo-')) as Extract<SceneItem, { kind: 'rod' }>[];
    expect(rays.length).toBeGreaterThan(5);
    for (const r of rays) {
      expect(Math.hypot(...r.to)).toBeCloseTo(R_EARTH, 9);
      expect(r.to[0]).toBeLessThan(0);
      expect(r.from[1]).toBe(r.to[1]);
      expect(r.from[2]).toBe(r.to[2]);
    }
  });
  it('cada flecha mide lo que el flujo del modelo (escala fija) y apunta hacia arriba o hacia abajo', () => {
    const eps = 0.78;
    const r = layerModel({ S: 1361, albedo: 0.3, eps });
    const sc = earthScene({ S: 1361, albedo: 0.3, eps });
    const want: [string, number, number][] = [['reflejada', r.reflected, 1], ['solar-absorbida', r.absorbed, -1], ['ir-superficie', r.surfaceIR, 1], ['ventana', r.window, 1], ['capa-arriba', r.layerUp, 1], ['capa-abajo', r.layerDown, -1]];
    for (const [id, flux, dir] of want) {
      const a = byId<ArrowItem>(sc.items, id);
      expect(len(a), id).toBeCloseTo(flux * K_FLUX, 12);
      expect(Math.sign(a.vector[1]), id).toBe(dir);
    }
    // La capa emite desde su superficie y la flecha que baja no atraviesa la Tierra.
    const down = byId<ArrowItem>(sc.items, 'capa-abajo');
    expect(Math.hypot(...down.from)).toBeCloseTo(R_LAYER, 9);
    const end: [number, number, number] = [down.from[0] + down.vector[0], down.from[1] + down.vector[1], down.from[2] + down.vector[2]];
    expect(Math.hypot(...end)).toBeGreaterThanOrEqual(R_EARTH - 1e-9);
    expect(sc.description).toContain('Al espacio salen 238,2 W/m², lo mismo que se absorbe');
  });
  it('sin capa no hay atmósfera ni flechas de la capa; con capa opaca la superficie emite más', () => {
    const none = earthScene({ S: 1361, albedo: 0.3, eps: 0 });
    expect(byId(none.items, 'capa')).toBeUndefined();
    expect(byId(none.items, 'capa-abajo')).toBeUndefined();
    expect(none.description).toContain('254,6 K');
    const opaque = earthScene({ S: 1361, albedo: 0.3, eps: 1 });
    expect(byId<SphereItem>(opaque.items, 'capa').opacity).toBeCloseTo(0.2, 12);
    expect(len(byId<ArrowItem>(opaque.items, 'ir-superficie'))).toBeGreaterThan(len(byId<ArrowItem>(none.items, 'ir-superficie')));
    expect(byId(opaque.items, 'ventana')).toBeUndefined();
  });
  it('rótulos cortos en la escena: las flechas llevan su número y la leyenda el nombre completo', () => {
    const sc = earthScene({ S: 1361, albedo: 0.3, eps: 0.78 });
    const arrows = sc.items.filter((i) => i.kind === 'arrow');
    expect(arrows.map((a) => a.tag)).toEqual(['1', '2', '3', '4', '5', '6']);
    for (const a of arrows) expect(a.label?.startsWith(`${a.tag} · `)).toBe(true);
    // La Tierra y la capa quedan solo en la leyenda (sus rótulos tapaban las flechas del polo).
    expect(byId(sc.items, 'tierra').tag).toBe('');
    expect(byId(sc.items, 'capa').tag).toBe('');
    // Flechas separadas al menos 0,3 radios para que el número de una no tape la siguiente.
    const xs = arrows.map((a) => (a as ArrowItem).from[0]).sort((p, q) => p - q);
    for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeGreaterThanOrEqual(0.3);
  });
  it('el forzamiento del CO₂ tiene su propia escala y su signo', () => {
    const up = earthScene({ S: 1361, albedo: 0.3, eps: 0.78, co2: { C: 556.6, ecs: 3 } });
    const f = byId<ArrowItem>(up.items, 'forzamiento');
    expect(len(f)).toBeCloseTo(co2Forcing(556.6) * K_FORCING, 12);
    expect(f.vector[1]).toBeGreaterThan(0);
    expect(up.description).toContain('3,00 °C');
    const down = earthScene({ S: 1361, albedo: 0.3, eps: 0.78, co2: { C: 185, ecs: 3 } });
    expect(byId<ArrowItem>(down.items, 'forzamiento').vector[1]).toBeLessThan(0);
    expect(byId(earthScene({ S: 1361, albedo: 0.3, eps: 0.78, co2: { C: 278.3, ecs: 3 } }).items, 'forzamiento')).toBeUndefined();
  });
});

const gBase: GlucoseInput = { profile: 'normal', meal: 'ptog', exerciseStart: null, bolus: 0, insulinOn: true, glucagonOn: true };
describe('glucosa, insulina y glucagón en 3D (homeostasis)', () => {
  it('el número de partículas es proporcional a cada concentración y crece después de comer', () => {
    const run = simulateGlucose(gBase);
    const s0 = stateAt(run, 0), s30 = stateAt(run, 30);
    const a = glucoseScene(run, s0), b = glucoseScene(run, s30);
    const n = (sc: ReturnType<typeof glucoseScene>, id: string) => byId<ParticlesItem>(sc.items, id)?.points.length ?? 0;
    expect(n(a, 'glucosa')).toBe(Math.round(85 / PER_GLUCOSE));
    expect(n(b, 'glucosa')).toBe(Math.round(s30.G / PER_GLUCOSE));
    expect(n(b, 'glucosa')).toBeGreaterThan(n(a, 'glucosa'));
    expect(n(b, 'insulina')).toBe(Math.round(s30.I / PER_INSULIN));
    expect(n(b, 'glucagon')).toBe(Math.round(s30.N / PER_GLUCAGON));
    for (const q of byId<ParticlesItem>(b.items, 'glucosa').points) { expect(Math.hypot(q[1], q[2])).toBeLessThan(0.42); expect(Math.abs(q[0])).toBeLessThanOrEqual(3); }
    expect(b.description).toContain(`glucosa ${Math.round(s30.G)} mg/dL`);
  });
  it('las flechas miden los flujos del modelo en ese minuto (escala fija)', () => {
    const run = simulateGlucose(gBase);
    const s = stateAt(run, 20), f = fluxesAt(run, s), sc = glucoseScene(run, s);
    expect(len(byId<ArrowItem>(sc.items, 'entrada-intestino'))).toBeCloseTo(f.gut * K_GLUCOSE, 12);
    expect(len(byId<ArrowItem>(sc.items, 'salida-higado'))).toBeCloseTo(f.liver * K_GLUCOSE, 12);
    expect(len(byId<ArrowItem>(sc.items, 'captacion'))).toBeCloseTo(f.uptake * K_GLUCOSE, 12);
    expect(len(byId<ArrowItem>(sc.items, 'secrecion-insulina'))).toBeCloseTo(f.secretion * K_INSULIN, 12);
    // En ayunas no hay comida que entre ni insulina que secretar.
    const fast = simulateGlucose({ ...gBase, meal: 'ayuno' });
    const sf = glucoseScene(fast, stateAt(fast, 60));
    expect(byId(sf.items, 'entrada-intestino')).toBeUndefined();
    expect(byId(sf.items, 'secrecion-insulina')).toBeUndefined();
    expect(len(byId<ArrowItem>(sf.items, 'captacion'))).toBeCloseTo(len(byId<ArrowItem>(sf.items, 'salida-higado')), 12);
  });
  it('la sangre avanza con el tiempo sin cambiar el número de partículas; el ejercicio se dice en la descripción', () => {
    const run = simulateGlucose({ ...gBase, meal: 'ayuno', exerciseStart: 0 });
    const a = glucoseScene(run, { ...stateAt(run, 10) }), b = glucoseScene(run, { ...stateAt(run, 10), t: 11 });
    const pa = byId<ParticlesItem>(a.items, 'glucosa').points, pb = byId<ParticlesItem>(b.items, 'glucosa').points;
    expect(pb.length).toBe(pa.length);
    expect(pb[0][0]).not.toBe(pa[0][0]);
    expect(pb[0][1]).toBe(pa[0][1]);
    expect(a.description).toContain('Hay ejercicio');
  });
});

describe('ejemplares 3D (clasificación de los seres vivos)', () => {
  it('cada organismo se dibuja con ids únicos, dentro de su caja y con al menos un rótulo', () => {
    for (const o of ORGANISMS) {
      const items = specimenItems(o, [0, 0, 0], 1);
      expect(items.length, o.id).toBeGreaterThan(0);
      expect(new Set(items.map((i) => i.id)).size, o.id).toBe(items.length);
      expect(items.some((i) => i.label), o.id).toBe(true);
      for (const i of items) {
        const pts = i.kind === 'particles' ? i.points : i.kind === 'rod' ? [i.from, i.to] : 'center' in i ? [i.center] : [];
        for (const q of pts) expect(Math.max(...q.map(Math.abs)), `${o.id} ${i.id}`).toBeLessThan(1.6);
      }
    }
  });
  it('el número de patas y las antenas salen de los datos del modelo', () => {
    const labels = (id: string) => specimenItems(findOrganism(id), [0, 0, 0], 1).map((i) => i.label ?? '').join(' | ');
    expect(labels('arriera')).toContain('6 patas articuladas');
    expect(labels('arriera')).toContain('antenas');
    expect(labels('arana')).toContain('8 patas articuladas');
    expect(labels('arana')).toContain('sin antenas');
    expect(labels('cangrejo')).toContain('10 patas articuladas');
    expect(labels('helecho')).toContain('esporas');
    expect(labels('pino')).toContain('sin flores');
    expect(labels('banano')).toContain('nervaduras paralelas');
    expect(labels('ecoli')).toContain('sin núcleo');
    // patas del insecto: 3 pares × 2 lados × 2 tramos
    const legRods = (id: string) => specimenItems(findOrganism(id), [0, 0, 0], 1).filter((i) => i.kind === 'rod' && i.radius <= 0.035 && i.radius >= 0.03).length;
    expect(legRods('arriera')).toBe(12);
    expect(legRods('arana')).toBe(16);
    expect(specimenScene(findOrganism('arriera')).description).toContain('6 patas, antenas');
  });
  it('la bandeja muestra el grupo, escala los ejemplares y atenúa los que ya están separados', () => {
    const members = ['iguana', 'sapo', 'garza'].map(findOrganism);
    const sc = trayScene(members, new Set(['iguana', 'sapo']));
    const iguana = sc.items.filter((i) => i.id.startsWith('b-iguana-'));
    const garza = sc.items.filter((i) => i.id.startsWith('b-garza-'));
    expect(iguana.every((i) => (i.opacity ?? 1) > 0.5)).toBe(true);
    expect(garza.every((i) => (i.opacity ?? 1) <= 0.25)).toBe(true);
    expect(garza[0].label).toBe('Garza blanca');
    expect(sc.description).toContain('Falta separar (se ven opacos): Iguana verde, Sapo común');
    const b = buildKey('animales', {});
    expect(trayScene(b.root.members, new Set()).description).toContain('Tu clave ya separa a todos');
  });
});

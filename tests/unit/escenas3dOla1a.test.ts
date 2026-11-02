import { describe, expect, it } from 'vitest';
import { experimentScene, modelsScene, nucleusScene, IMPACTS, SAMPLE_PATHS } from '../../src/labs/atomic3d';
import { barHeight, cellCenter, MAX_HEIGHT, periodicScene } from '../../src/labs/periodic3d';
import { metalScene, partialToken, polarityScene } from '../../src/labs/bonding3d';
import { fieldScene, toScene } from '../../src/labs/electrostatics3d';
import { rutherfordAngle, rutherfordSetup } from '../../src/models/atomicModels';
import { periodicElement, propertyRange } from '../../src/models/periodicTrends';
import { chargesFrom, fieldAt, PRESETS, potentialAt } from '../../src/models/electrostatics';
import { moleculeSpecies } from '../../src/chem';
import type { ArrowItem, BoxItem, ParticlesItem, RodItem, SceneItem, SphereItem } from '../../src/three/scene';

const byId = <T extends SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T;
const ids = (items: SceneItem[]) => items.map((i) => i.id);

describe('escena 3D de la lámina (modelos atómicos)', () => {
  const s = rutherfordSetup({ foilId: 'oro', energyMeV: 5, thicknessUm: 0.4 });
  it('el detector está en el ángulo del laboratorio y la muestra de alfas sigue el avance del conteo', () => {
    const sc = experimentScene({ setup: s, thetaDeg: 60, progress: 0, counts: 0, seed: 3 });
    const det = byId<BoxItem>(sc.items, 'detector');
    expect((Math.atan2(det.center[2], det.center[0]) * 180) / Math.PI).toBeCloseTo(60, 9);
    expect(sc.items.filter((i) => i.id.startsWith('alfa-'))).toHaveLength(0);
    expect(sc.description).toContain('Aún no se ha disparado');
    const half = experimentScene({ setup: s, thetaDeg: 60, progress: 0.5, counts: 120, seed: 3 });
    expect(half.items.filter((i) => i.id.startsWith('alfa-'))).toHaveLength(SAMPLE_PATHS / 2);
    expect(half.description).toContain('120 centelleos');
    // mismas trayectorias para la misma semilla (la escena no cambia sola)
    expect(experimentScene({ setup: s, thetaDeg: 60, progress: 0.5, counts: 120, seed: 3 }).items).toEqual(half.items);
  });
  it('las trayectorias cerca del núcleo salen con el ángulo de Rutherford, cada una en su plano', () => {
    const sc = nucleusScene(s);
    IMPACTS.forEach((b, k) => {
      const segs = sc.items.filter((i) => i.id.startsWith(`tray-${k}-`)) as RodItem[];
      const last = segs[segs.length - 1];
      const d = [last.to[0] - last.from[0], last.to[1] - last.from[1], last.to[2] - last.from[2]];
      const ang = Math.atan2(Math.hypot(d[1], d[2]), d[0]);
      expect(ang).toBeCloseTo(rutherfordAngle(b, 1), 1);
    });
    expect(sc.status).toBe('modelo');
  });
  it('los modelos lado a lado: órbitas de Bohr ∝ n² y fotón al emitir', () => {
    const sc = modelsScene({ nUpper: 3, nLower: 2, emitted: true });
    const r = (n: number) => { const p = (byId<ParticlesItem>(sc.items, `orbita-${n}`)).points[0]; return Math.hypot(p[0] - 4.8, p[2]); };
    expect(r(2) / r(1)).toBeCloseTo(4, 9);
    expect(byId<ArrowItem>(sc.items, 'foton').label).toMatch(/656,3 nm \(rojo\)/);
    expect(sc.status).toBe('ilustracion');
    expect(ids(modelsScene({ nUpper: 3, nLower: 2, emitted: false }).items)).not.toContain('foton');
  });
});

describe('relieve periódico 3D', () => {
  it('una columna por elemento con altura proporcional al dato (losa sin dato) y esferas a escala del radio', () => {
    const sc = periodicScene({ property: 'en', selected: 'Na', spheres: 'periodo' });
    expect(sc.items.filter((i) => i.id.startsWith('el-'))).toHaveLength(118);
    const { max } = propertyRange('en');
    const f = byId<BoxItem>(sc.items, 'el-F');
    expect(f.size[1]).toBeCloseTo(MAX_HEIGHT, 9);
    expect(byId<BoxItem>(sc.items, 'el-Na').size[1]).toBeCloseTo((0.93 / max) * MAX_HEIGHT, 9);
    expect(byId<BoxItem>(sc.items, 'el-He').size[1]).toBeCloseTo(0.04, 9);
    expect(barHeight(null, 1)).toBeNull();
    const [x, z] = cellCenter(periodicElement('Na'));
    expect(byId<BoxItem>(sc.items, 'el-Na').center[0]).toBe(x);
    expect(byId<BoxItem>(sc.items, 'el-Na').center[2]).toBe(z);
    const na = byId<SphereItem>(sc.items, 'esf-Na'), cl = byId<SphereItem>(sc.items, 'esf-Cl');
    expect(na.radius / cl.radius).toBeCloseTo(155 / 99, 9);
    expect(sc.items.filter((i) => i.id.startsWith('esf-'))).toHaveLength(8);
    expect(sc.description).toContain('Elegido: Na (sodio)');
    expect(periodicScene({ property: 'en', selected: 'Na', spheres: 'ninguna' }).items.some((i) => i.id.startsWith('esf-'))).toBe(false);
  });
});

describe('polaridad 3D y mar de electrones', () => {
  it('el agua: O en rojo (δ−), H en azul (δ+) y dipolo neto; el CO₂ sin dipolo neto', () => {
    const w = polarityScene(moleculeSpecies('agua'), 'H₂O');
    const atoms = moleculeSpecies('agua').atoms;
    atoms.forEach((a, i) => expect(byId<SphereItem>(w.items, `at-${i}`).color).toBe(a.el === 'O' ? 'series-1' : 'series-2'));
    expect(ids(w.items)).toContain('neto');
    expect(w.description).toContain('Molécula polar');
    const c = polarityScene(moleculeSpecies('co2'), 'CO₂');
    expect(ids(c.items)).not.toContain('neto');
    expect(c.description).toContain('se cancelan');
    expect(partialToken(0)).toBe('series-8');
    expect(polarityScene(moleculeSpecies('hidrogeno'), 'H₂').description).toContain('no son polares');
  });
  it('el cobre: red cúbica de caras centradas (a = 3,615 Å) con un electrón por ion', () => {
    const m = metalScene(1);
    const cores = byId<ParticlesItem>(m.items, 'cationes').points;
    const e = byId<ParticlesItem>(m.items, 'electrones').points;
    expect(e.length).toBe(cores.length);
    const d = Math.min(...cores.slice(1).map((p) => Math.hypot(p[0] - cores[0][0], p[1] - cores[0][1], p[2] - cores[0][2])));
    expect(d).toBeCloseTo(3.615 / Math.SQRT2, 6); // vecinos más cercanos de la fcc: a/√2
  });
});

describe('campo eléctrico 3D', () => {
  const dip = chargesFrom(PRESETS.find((p) => p.id === 'dipolo')!.charges);
  it('cargas sobre la mesa, flecha del campo en la dirección del modelo y superficie con V constante', () => {
    const sc = fieldScene({ charges: dip, probe: [0, 0.15, 0], q0: 10e-9, showLines: true, showSurface: true });
    expect(byId<SphereItem>(sc.items, 'carga-0').center).toEqual(toScene(dip[0].pos));
    expect(byId<SphereItem>(sc.items, 'carga-0').center[1]).toBe(0); // en el plano de la mesa (y = 0 en la escena)
    const E = fieldAt(dip, [0, 0.15, 0]);
    const arrow = byId<ArrowItem>(sc.items, 'campo');
    // E del modelo (x, y) → escena (x, −z)
    expect(Math.atan2(-arrow.vector[2], arrow.vector[0])).toBeCloseTo(Math.atan2(E[1], E[0]), 9);
    expect(sc.items.some((i) => i.id.startsWith('l0-'))).toBe(true);
    // en la mediatriz del dipolo V = 0: no hay superficie que dibujar
    expect(sc.level).toBeNull();
    const one = chargesFrom([{ q: 2, x: 0, y: 0 }]);
    const s1 = fieldScene({ charges: one, probe: [0.2, 0, 0], q0: 10e-9, showLines: false, showSurface: true });
    const pts = byId<ParticlesItem>(s1.items, 'equipotencial').points;
    for (const p of pts) expect(Math.hypot(p[0], p[1], p[2])).toBeCloseTo(2, 4); // esfera de 20 cm (1 unidad = 10 cm)
    expect(potentialAt(one, [0, 0.2, 0])).toBeCloseTo(s1.level!, 6);
    expect(s1.description).toContain('superficie equipotencial');
    expect(sc.items.some((i) => i.id.startsWith('l'))).toBe(true);
    expect(fieldScene({ charges: one, probe: [0.2, 0, 0], q0: 10e-9, showLines: false, showSurface: false }).items.some((i) => /^l\d/.test(i.id))).toBe(false);
  });
  it('la fuerza sobre una carga negativa apunta contra el campo', () => {
    const one = chargesFrom([{ q: 2, x: 0, y: 0 }]);
    const sc = fieldScene({ charges: one, probe: [0.2, 0, 0], q0: -10e-9, showLines: false, showSurface: false });
    expect(byId<ArrowItem>(sc.items, 'campo').vector[0]).toBeGreaterThan(0);
    expect(byId<ArrowItem>(sc.items, 'fuerza').vector[0]).toBeLessThan(0);
  });
});

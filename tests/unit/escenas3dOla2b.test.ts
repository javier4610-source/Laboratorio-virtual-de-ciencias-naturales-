import { describe, expect, it } from 'vitest';
import { earthScene, K_FLUX, K_FORCING, R_EARTH, R_LAYER } from '../../src/labs/greenhouse3d';
import { layerModel, co2Forcing } from '../../src/models/greenhouse';
import type { ArrowItem, EllipsoidItem, SceneItem, SphereItem } from '../../src/three/scene';

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

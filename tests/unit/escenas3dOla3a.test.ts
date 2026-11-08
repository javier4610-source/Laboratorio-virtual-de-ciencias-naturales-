import { describe, expect, it } from 'vitest';
import { K_FORCE, K_SPEED, orbitScene, sceneScale } from '../../src/labs/gravitation3d';
import { AU_PER_YEAR_KMS, integrateOrbit, orbitAt } from '../../src/models/gravitation';
import type { ArrowItem, ParticlesItem, SceneItem, SphereItem } from '../../src/three/scene';

const byId = <T extends SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T;
const len = (a: ArrowItem) => Math.hypot(...a.vector);

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

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { labelAnchor, length, rotateZ, type ArrowItem, type BoxItem, type SceneItem } from '../../src/three/scene';
import { barHeight, energyBars } from '../../src/labs/lote3d3/mech3d';
import { positionAt, projectileArrowScale, projectileScene, velocityAt } from '../../src/labs/lote3d3/projectile3d';
import { ACCEL_CAP, ACCEL_SCALE, FORCE_SCALE, newtonScene } from '../../src/labs/lote3d3/newton3d';
import { collisionsScene, maxMomentum, P_ARROW_LENGTH } from '../../src/labs/lote3d3/collisions3d';
import { BAR_MAX, energyScene, trackPoints } from '../../src/labs/lote3d3/energy3d';
import { rampAxes, travelled, WORK_FORCE_SCALE, workScene } from '../../src/labs/lote3d3/work3d';
import { FORCE_ARROW, leverAngle, leverScene, pulleyScene } from '../../src/labs/lote3d3/machines3d';
import { kpScene } from '../../src/labs/lote3d3/kp3d';
import { findSphere, idealState, simulateShot } from '../../src/models/projectile';
import { positionAt as cartPositionAt, simulateCart, SURFACES } from '../../src/models/newton';
import { simulateCollision, stateAt, timeline } from '../../src/models/collisions';
import { simulateTrack, trackHeight } from '../../src/models/energy';
import { blockMass, simulateRamp } from '../../src/models/workPower';
import { LEVER_TILT_DEG, sheaveCounts, simulateLever, simulatePulley } from '../../src/models/simpleMachines';
import { cartMass, simulateSpring, springStateAt } from '../../src/models/kineticPotential';

const byId = (items: SceneItem[], id: string) => items.find((i) => i.id === id);
const arrow = (items: SceneItem[], id: string) => byId(items, id) as ArrowItem;
const ids = (items: SceneItem[]) => items.map((i) => i.id);

describe('kit: cajas giradas (rotationZ)', () => {
  it('rotateZ gira de +x hacia +y y el rótulo de una caja girada queda sobre su cara superior', () => {
    const r = rotateZ([1, 0, 0], Math.PI / 2);
    expect(r[0]).toBeCloseTo(0, 12);
    expect(r[1]).toBeCloseTo(1, 12);
    const box: BoxItem = { id: 'b', kind: 'box', center: [0, 0, 0], size: [1, 0.2, 0.1], rotationZ: Math.PI / 6, color: 'ink' };
    const a = labelAnchor(box);
    expect(a[0]).toBeCloseTo(-0.1 * Math.sin(Math.PI / 6), 12);
    expect(a[1]).toBeCloseTo(0.1 * Math.cos(Math.PI / 6), 12);
  });
});

describe('barras de energía', () => {
  it('la energía total mide la altura máxima y cada barra es proporcional a su energía', () => {
    const items = energyBars([0, 0, 0], [{ id: 'a', label: 'A', value: 3, color: 'fis' }, { id: 'b', label: 'B', value: 1, color: 'data' }], 4, { maxHeight: 2, width: 0.2, gap: 0.1 });
    expect((byId(items, 'a') as BoxItem).size[1]).toBeCloseTo(1.5, 12);
    expect((byId(items, 'b') as BoxItem).size[1]).toBeCloseTo(0.5, 12);
    expect((byId(items, 'a-total') as BoxItem).size[1]).toBe(2);
    expect(barHeight(2, 4, 2)).toBe(1);
  });
});

describe('proyectiles: trayectoria y vectores del modelo', () => {
  const base = { v0: 4.5, angle: 30, height: 1, sphereId: 'acero', air: false } as const;
  const sphere = findSphere('acero');
  const mk = (air: boolean, t: number, flags: { fired: boolean; landed: boolean; measured: boolean }) => {
    const shot = simulateShot({ ...base, air });
    return {
      shot,
      scene: projectileScene({
        path: shot.path, strobe: shot.strobe, flightTime: shot.flightTime, t, ...flags, v0: base.v0, angle: base.angle, height: base.height, g: 9.8, air,
        spanX: 3, spanY: 1.5, sphereName: sphere.name, sphereColor: sphere.color, sphereDiameter: sphere.diameter, target: null, rangeReading: shot.rangeReading,
      }),
    };
  };

  it('sin aire, la posición y la velocidad son las del modelo ideal; vx constante y vy cambia con g', () => {
    for (const t of [0.05, 0.2, 0.37]) {
      const { scene } = mk(false, t, { fired: true, landed: false, measured: false });
      const s = idealState(4.5, 30, 1, t);
      expect(scene.position.x).toBeCloseTo(s.x, 3);
      expect(scene.position.y).toBeCloseTo(s.y, 3);
      expect(scene.velocity.vx).toBeCloseTo(s.vx, 10);
      expect(scene.velocity.vy).toBeCloseTo(s.vy, 10);
      // Las flechas son las componentes del modelo con la escala fija de la corrida.
      expect(arrow(scene.items, 'vx').vector[0]).toBeCloseTo(s.vx * scene.k, 10);
      expect(arrow(scene.items, 'vx').vector[1]).toBe(0);
      expect(arrow(scene.items, 'vy').vector[1]).toBeCloseTo(s.vy * scene.k, 10);
      expect(arrow(scene.items, 'v').vector[0]).toBeCloseTo(s.vx * scene.k, 10);
    }
    // Escala fija por corrida: no depende del instante.
    expect(mk(false, 0.1, { fired: true, landed: false, measured: false }).scene.k).toBe(mk(false, 0.3, { fired: true, landed: false, measured: false }).scene.k);
    expect(projectileArrowScale(4.5, 1, 9.8, 3)).toBeCloseTo((0.22 * 3) / Math.sqrt(4.5 ** 2 + 2 * 9.8), 12);
  });

  it('con aire, vx disminuye (pendiente de las muestras del modelo)', () => {
    const shot = simulateShot({ ...base, sphereId: 'icopor', air: true });
    const inp = { path: shot.path, air: true, v0: 4.5, angle: 30, height: 1, g: 9.8, flightTime: shot.flightTime };
    expect(velocityAt(inp, 0.3).vx).toBeLessThan(velocityAt(inp, 0.05).vx);
    expect(positionAt(shot.path, 0.2).x).toBeGreaterThan(0);
  });

  it('antes de disparar muestra la velocidad de salida; al caer no hay flechas y no se dice el alcance antes de medir', () => {
    const ready = mk(false, 0, { fired: false, landed: false, measured: false }).scene;
    expect(arrow(ready.items, 'v').vector[0]).toBeCloseTo(4.5 * Math.cos(Math.PI / 6) * ready.k, 10);
    expect(ready.description).toContain('La esfera está en el lanzador');
    const { scene: landed, shot } = mk(false, 5, { fired: true, landed: true, measured: false });
    expect(ids(landed.items)).not.toContain('v');
    expect(landed.description).toContain('falta medir');
    expect(landed.description).not.toContain('plomada');
    expect(byId(landed.items, 'sombra')).toBeTruthy();
    const measured = mk(false, 5, { fired: true, landed: true, measured: true }).scene;
    expect(measured.description).toContain(`cayó a ${shot.rangeReading.toFixed(3).replace('.', ',')} m de la plomada`);
  });
});

describe('newton: diagrama de cuerpo libre', () => {
  const surf = SURFACES[1];
  const scene = (force: number, mass: number, t = 0, done = false) => {
    const r = simulateCart({ mass, force, surfaceId: surf.id });
    return { r, s: newtonScene({ mass, force, surfaceId: surf.id, surfaceName: surf.name, moves: r.moves, weight: r.weight, normal: r.normal, friction: r.friction, netForce: r.netForce, acceleration: r.acceleration, x: r.moves ? cartPositionAt(r.acceleration, t) : 0, t, running: !done, done }) };
  };
  it('las flechas miden la fuerza del modelo con la escala fija y apuntan en su sentido', () => {
    const { r, s } = scene(5, 1, 0.3);
    expect(arrow(s.items, 'F').vector).toEqual([5 * FORCE_SCALE, 0, 0]);
    expect(arrow(s.items, 'Fr').vector[0]).toBeCloseTo(-r.friction * FORCE_SCALE, 12);
    expect(arrow(s.items, 'P').vector[1]).toBeCloseTo(-r.weight * FORCE_SCALE, 12);
    expect(arrow(s.items, 'N').vector[1]).toBeCloseTo(r.normal * FORCE_SCALE, 12);
    expect(arrow(s.items, 'a').vector[0]).toBeCloseTo(r.acceleration * ACCEL_SCALE, 12);
    // El carrito está donde lo pone el modelo: x = ½·a·t².
    expect((byId(s.items, 'carrito') as BoxItem).center[0]).toBeCloseTo(0.5 * r.acceleration * 0.09, 12);
    // Más fuerza → flecha F más larga; más masa → peso más largo.
    expect(length(arrow(scene(8, 1).s.items, 'F').vector)).toBeGreaterThan(length(arrow(s.items, 'F').vector));
    expect(length(arrow(scene(5, 2).s.items, 'P').vector)).toBeGreaterThan(length(arrow(s.items, 'P').vector));
  });
  it('sin movimiento no hay aceleración; la aceleración enorme se recorta y se avisa', () => {
    const still = scene(0.5, 1).s;
    expect(ids(still.items)).not.toContain('a');
    expect(still.description).toContain('no acelera');
    const r = simulateCart({ mass: 0.1, force: 10, surfaceId: 'colchon' });
    const s = newtonScene({ mass: 0.1, force: 10, surfaceId: 'colchon', surfaceName: 'colchón', moves: true, weight: r.weight, normal: r.normal, friction: r.friction, netForce: r.netForce, acceleration: r.acceleration, x: 1, t: 1, running: false, done: true });
    expect(s.accelCapped).toBe(true);
    expect(arrow(s.items, 'a').vector[0]).toBeCloseTo(ACCEL_CAP * ACCEL_SCALE, 12);
    expect(arrow(s.items, 'a').label).toContain('recortada');
  });
});

describe('choques: cantidad de movimiento sincronizada', () => {
  const res = simulateCollision({ type: 'elastico', m1: 0.3, m2: 0.2, v1: 0.5, v2: -0.3, e: 1, energy: 0.05 });
  const tl = timeline(res);
  const at = (t: number, done = false) => collisionsScene({ res, st: stateAt(res, tl, t), pastContact: t >= tl.tContact, done, typeName: 'Elástico' });
  it('cada flecha es m·v del modelo en el mismo instante, con una escala fija por ensayo', () => {
    const k = P_ARROW_LENGTH / maxMomentum(res);
    for (const t of [0.1, tl.tContact + tl.tau / 2, tl.tEnd]) {
      const st = stateAt(res, tl, t);
      const s = at(t);
      expect(s.k).toBeCloseTo(k, 12);
      expect(arrow(s.items, 'p1').vector[0]).toBeCloseTo(0.3 * st.v1 * k, 12);
      expect(arrow(s.items, 'p2').vector[0]).toBeCloseTo(0.2 * st.v2 * k, 12);
      // El total se conserva en todo momento (también durante el contacto).
      expect(arrow(s.items, 'p').vector[0]).toBeCloseTo(res.model.pBefore * k, 10);
      expect((byId(s.items, 'carrito-1') as BoxItem).center[0]).toBeCloseTo(st.x1, 12);
    }
  });
  it('después del choque quedan las flechas de antes (tenues) y la descripción da p antes y después', () => {
    const s = at(tl.tEnd, true);
    expect(ids(s.items)).toEqual(expect.arrayContaining(['p1-antes', 'p2-antes', 'p-antes']));
    expect(s.description).toContain('antes 0,090 kg·m/s y después 0,090 kg·m/s');
    expect(ids(at(0.1).items)).not.toContain('p1-antes');
  });
});

describe('energia: pista, esfera y barras', () => {
  const res = simulateTrack({ mass: 0.5, startHeight: 1, hillHeight: 0.6, mu: 0.05, rolling: false });
  const scene = (i: number) => energyScene({ h0: 1, hc: 0.6, point: res.points[i], total: res.totalEnergy, passesHill: res.passesHill, stopX: res.stopX, done: false, mass: 0.5, rolling: false });
  it('la pista es trackHeight del modelo y la esfera está en el punto del modelo', () => {
    for (const p of trackPoints(1, 0.6)) expect(p[1]).toBe(trackHeight(p[0], 1, 0.6));
    const i = 300, p = res.points[i];
    const ball = byId(scene(i).items, 'esfera')!;
    expect(ball.kind === 'sphere' && ball.center[0]).toBe(p.x);
  });
  it('las barras son Ep, Ec y disipada con la energía total = BAR_MAX, y siempre suman la total', () => {
    for (const i of [0, 200, 500]) {
      const p = res.points[i], items = scene(i).items;
      const h = (id: string) => ((byId(items, id) as BoxItem).size[1] > 0.004 ? (byId(items, id) as BoxItem).size[1] : 0);
      expect(h('ep')).toBeCloseTo(barHeight(p.ep, res.totalEnergy, BAR_MAX), 10);
      expect(h('ep') + h('ec') + h('ed')).toBeCloseTo(BAR_MAX, 2);
    }
  });
});

describe('trabajo: plano inclinado', () => {
  const ramp = simulateRamp({ angleDeg: 30, mass: blockMass(2), surface: 'madera', drive: 'mano', handSpeed: 0.2, motorPower: 1.5 });
  it('fuerzas del modelo en las direcciones de la rampa y el bloque en el punto del avance', () => {
    const s = workScene({ ramp, slots: 2, surfaceName: 'Madera', motion: 0.5, phase: 'midiendo', drive: 'mano' });
    const { u, n } = rampAxes(30);
    const F = arrow(s.items, 'F').vector;
    expect(F[0]).toBeCloseTo(u[0] * ramp.F * WORK_FORCE_SCALE, 12);
    expect(F[1]).toBeCloseTo(u[1] * ramp.F * WORK_FORCE_SCALE, 12);
    expect(arrow(s.items, 'N').vector[1]).toBeCloseTo(n[1] * ramp.normal * WORK_FORCE_SCALE, 12);
    expect(arrow(s.items, 'f').vector[0]).toBeCloseTo(-u[0] * ramp.friction * WORK_FORCE_SCALE, 12);
    expect(s.dNow).toBeCloseTo(travelled(0.5), 12);
    expect(s.hNow).toBeCloseTo(0.3 * 0.5, 12);
    expect((byId(s.items, 'tabla') as BoxItem).rotationZ).toBeCloseTo(Math.PI / 6, 12);
  });
  it('el área de cada rectángulo es proporcional al trabajo: F·d y m·g·h', () => {
    const s = workScene({ ramp, slots: 2, surfaceName: 'Madera', motion: 1, phase: 'medido', drive: 'mano' });
    const area = (id: string) => { const b = byId(s.items, id) as BoxItem; return b.size[0] * b.size[1]; };
    expect(area('area-Fd') / WORK_FORCE_SCALE).toBeCloseTo(ramp.workIn, 10);
    expect(area('area-mgh') / WORK_FORCE_SCALE).toBeCloseTo(ramp.workLift, 10);
    expect(s.description).toContain('Según el modelo');
    expect(ids(workScene({ ramp, slots: 2, surfaceName: 'Madera', motion: 0, phase: 'listo', drive: 'mano' }).items)).not.toContain('F');
  });
});

describe('maquinas: palanca y poleas', () => {
  it('palanca: R y F con la misma escala y el sentido del modelo; la barra gira LEVER_TILT_DEG', () => {
    const lever = simulateLever({ cls: 1, loadMass: 0.4, dR: 0.2, dF: 0.4, barMass: false });
    const s = leverScene({ lever, ease: 1, measured: true, dRcm: 20, dFcm: 40, massG: 400, className: 'Primer género' });
    const R = arrow(s.items, 'R').vector[1], F = arrow(s.items, 'F').vector[1];
    expect(Math.abs(R) / Math.abs(F)).toBeCloseTo(lever.R / lever.F, 10);
    expect(Math.max(Math.abs(R), Math.abs(F))).toBeCloseTo(FORCE_ARROW, 12);
    expect(Math.sign(F)).toBe(lever.effortSigned >= 0 ? 1 : -1);
    expect(Math.abs(s.alpha)).toBeCloseTo((LEVER_TILT_DEG * Math.PI) / 180, 12);
    expect(leverAngle(1, 0)).toBe(-0);
    expect(s.description).toContain('F = 1,96 N');
  });
  it('poleas: la cuerda jalada es n veces la subida y las fuerzas tienen la misma escala', () => {
    for (const setup of ['fija', 'movil', 'polipasto'] as const) {
      const pulley = simulatePulley({ setup, strands: 4, loadMass: 0.4, blockMass: 0, efficiency: 1, rope: 0.4 });
      const c = sheaveCounts(setup, pulley.n);
      const s = pulleyScene({ pulley, ease: 0.5, measured: false, setupName: setup, fixedSheaves: c.fixed, movableSheaves: c.movable });
      expect(s.ropeNow / s.riseNow).toBeCloseTo(pulley.n, 10);
      expect(length(arrow(s.items, 's').vector)).toBeCloseTo(0.2, 12);
      expect(Math.abs(arrow(s.items, 'F').vector[1]) / Math.abs(arrow(s.items, 'R').vector[1])).toBeCloseTo(pulley.F / pulley.R, 10);
    }
  });
});

describe('cinetica-potencial: estaciones y barras', () => {
  it('elástica: el resorte llega hasta el carrito comprimido y las barras son las del banco', () => {
    const sp = simulateSpring({ mass: cartMass(3), k: 50, compression: 0.05 });
    const s0 = springStateAt(sp, 0);
    const s = kpScene({ station: 'elastica', position: s0.q, objY: 0, height: 2, v: s0.v, vMax: 0.05 * Math.sqrt(50 / cartMass(3)), ep: s0.ep, ek: s0.ek, heat: s0.heat, total: sp.epElastic, compression: 0.05, caption: 'resorte comprimido', massKg: cartMass(3) });
    expect(s0.q).toBeCloseTo(-0.05, 12);
    const spring = byId(s.items, 'resorte')!;
    expect(spring.kind === 'spring' && spring.to[0]).toBeCloseTo(-0.05 - 0.08, 12);
    expect((byId(s.items, 'ep') as BoxItem).size[1]).toBeCloseTo(0.6, 10);
    expect(s.description).toContain('comprimido 5,0 cm');
  });
  it('gravitatoria: el objeto a la altura del modelo y la flecha v hacia abajo', () => {
    const s = kpScene({ station: 'gravitatoria', position: 0, objY: 1.2, height: 2, v: 2.8, vMax: Math.sqrt(2 * 9.81 * 2), ep: 11.8, ek: 3.9, heat: 0, total: 19.6, compression: 0, caption: 'cayendo', massKg: 1 });
    const o = byId(s.items, 'objeto')!;
    expect(o.kind === 'sphere' && o.center[1]).toBe(1.2);
    expect(arrow(s.items, 'v').vector[1]).toBeLessThan(0);
  });
});

describe('carga diferida', () => {
  it('cada práctica importa su vista con lazy() y no importa el kit directamente', () => {
    const pairs: [string, string][] = [
      ['ProjectileLab', 'ProyectilesView3D'], ['NewtonLab', 'NewtonView3D'], ['CollisionsLab', 'ChoquesView3D'], ['EnergyLab', 'EnergiaView3D'],
      ['WorkLab', 'TrabajoView3D'], ['MachinesLab', 'MaquinasView3D'], ['KineticPotentialLab', 'CineticaPotencialView3D'],
    ];
    for (const [lab, v] of pairs) {
      const src = readFileSync(`src/labs/${lab}.tsx`, 'utf8');
      expect(src).toContain(`lazy(() => import('./lote3d3/${v}'))`);
      expect(src).not.toMatch(/from '\.\.\/three'|from '\.\/lote3d3\//);
    }
  });
});


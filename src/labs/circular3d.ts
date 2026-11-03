/**
 * Movimiento circular en 3D (kit src/three). Funciones PURAS con el MISMO estado del laboratorio: el disco de la mesa de
 * aire en la posición que da `diskAt` (círculo o, si la cuerda se cortó, la recta tangente), la cuerda con la tensión
 * hacia el eje, y las flechas de la velocidad (tangente) y de la aceleración centrípeta (hacia el centro), con escalas
 * fijas por corrida. En la curva, el carro con su velocidad y la fricción que apunta al centro (o el derrape).
 */
import { fmt } from '../lib/format';
import { carOnCurve, diskAt, ucm, type CurveInput, type UcmInput } from '../models/circularMotion';
import { arrowScale, physicalArrow, type SceneItem, type Vec3 } from '../three/scene';

/** 1 m de la mesa = 2,5 unidades de la escena. Mesa: x a la derecha, y del modelo hacia el fondo (−z de la escena). */
export const S = 2.5;
const toScene = (p: readonly [number, number], h = 0.08): Vec3 => [p[0] * S, h, -p[1] * S];
const vec = (v: readonly [number, number]): Vec3 => [v[0], 0, -v[1]];

export interface DiskSceneInput { input: UcmInput; t: number; cutAt: number | null }
export function diskScene({ input, t, cutAt }: DiskSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const st = diskAt(input, t, cutAt);
  const r = ucm(input);
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0, 0, 0], size: [6.4, 6.4], color: 'surface-3', opacity: 0.8 },
    { id: 'eje', kind: 'rod', from: [0, 0, 0], to: [0, 0.35, 0], radius: 0.06, color: 'ink-2', label: 'eje con el sensor de fuerza' },
  ];
  const ring = Array.from({ length: 48 }, (_, k): Vec3 => toScene([input.radius * Math.cos((k / 48) * 2 * Math.PI), input.radius * Math.sin((k / 48) * 2 * Math.PI)], 0.02));
  items.push({ id: 'trayectoria', kind: 'particles', points: ring, radius: 0.025, color: 'ink-3', opacity: 0.8 });
  const at = toScene(st.pos);
  items.push({ id: 'disco', kind: 'ellipsoid', center: at, radii: [0.17, 0.07, 0.17], color: 'series-4', label: `disco de ${fmt(input.massG, 0)} g` });
  const kV = arrowScale(r.v, 0.9), kA = arrowScale(r.ac, 0.75);
  if (!st.cut) {
    items.push({ id: 'cuerda', kind: 'rod', from: [0, 0.08, 0], to: at, radius: 0.015, color: 'ink' });
    const tension = physicalArrow([at[0], 0.32, at[2]], vec([(-st.pos[0] / st.dist) * r.force, (-st.pos[1] / st.dist) * r.force]), kA / Math.max(1e-9, r.m), 0.05);
    if (tension) items.push({ id: 'tension', kind: 'arrow', ...tension, radius: 0.035, color: 'series-6', label: `tensión T = ${fmt(r.force, 2)} N (hacia el eje)` });
    const a = physicalArrow(at, vec(st.acc), kA, 0.05);
    if (a) items.push({ id: 'aceleracion', kind: 'arrow', ...a, radius: 0.045, color: 'series-2', label: `a_c = v²/r = ${fmt(r.ac, 2)} m/s² (hacia el centro)` });
  } else {
    const cutPos = diskAt(input, cutAt as number, null).pos;
    const line = Array.from({ length: 16 }, (_, k): Vec3 => toScene([cutPos[0] + st.vel[0] * k * 0.12, cutPos[1] + st.vel[1] * k * 0.12], 0.03));
    items.push({ id: 'tangente', kind: 'particles', points: line, radius: 0.03, color: 'data', opacity: 0.9, label: 'recta tangente: el disco sigue derecho' });
    items.push({ id: 'cuerda-cortada', kind: 'rod', from: [0, 0.08, 0], to: [cutPos[0] * S * 0.45, 0.08, -cutPos[1] * S * 0.45], radius: 0.015, color: 'ink-2', label: 'cuerda cortada (sin tensión)' });
  }
  const v = physicalArrow(at, vec(st.vel), kV, 0.05);
  if (v) items.push({ id: 'velocidad', kind: 'arrow', ...v, radius: 0.045, color: 'data', label: `v = ${fmt(r.v, 2)} m/s (tangente)` });
  const ang = ((((st.angle * 180) / Math.PI) % 360) + 360) % 360;
  const description = st.cut
    ? `La cuerda se cortó cuando el disco estaba a ${fmt(ang, 0)}° del eje x: desde entonces no hay fuerza neta y el disco sigue en línea recta por la TANGENTE con v = ${fmt(r.v, 2)} m/s (no sale hacia afuera en dirección radial). Ahora está a ${fmt(st.dist * 100, 0)} cm del eje.`
    : `Disco de ${fmt(input.massG, 0)} g girando en un círculo de ${fmt(input.radius * 100, 0)} cm con período ${fmt(input.period, 2)} s, a ${fmt(ang, 0)}° del eje x. La velocidad (${fmt(r.v, 2)} m/s) es tangente al círculo; la aceleración centrípeta (${fmt(r.ac, 2)} m/s²) y la tensión de la cuerda (${fmt(r.force, 2)} N) apuntan hacia el eje.`;
  // encuadre fijo por corrida (la cámara no salta al cortar la cuerda)
  return { items, extent: Math.max(1.6, input.radius * S * 1.5 + 0.4), target: [0, 0.1, 0], description };
}

/** Carro en una curva plana: el radio se dibuja a escala reducida (2,8 unidades) y el carro con su vector velocidad. */
export function curveScene(i: CurveInput, phase: number): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const c = carOnCurve(i);
  const R = 2.8;
  const items: SceneItem[] = [{ id: 'suelo', kind: 'plane', center: [0, 0, 0], size: [8, 8], color: 'surface-3', opacity: 0.8 }];
  const arc = Array.from({ length: 40 }, (_, k): Vec3 => { const a = (k / 39) * Math.PI; return [R * Math.cos(a), 0.02, -R * Math.sin(a)]; });
  items.push({ id: 'via', kind: 'particles', points: arc, radius: 0.09, color: 'ink-3', label: `curva de ${fmt(i.radius, 0)} m de radio (${c.mu === 1 ? 'seca' : `μ = ${fmt(c.mu, 2)}`})` });
  const th = Math.PI * (0.25 + 0.5 * phase);
  const pos: Vec3 = [R * Math.cos(th), 0.2, -R * Math.sin(th)];
  const tang: Vec3 = [-Math.sin(th), 0, -Math.cos(th)];
  const inward: Vec3 = [-Math.cos(th), 0, Math.sin(th)];
  items.push({ id: 'carro', kind: 'box', center: pos, size: [0.45, 0.25, 0.45], color: 'series-1', label: `carro a ${fmt(i.speedKmh, 0)} km/h` });
  items.push({ id: 'v-carro', kind: 'arrow', from: [pos[0], 0.45, pos[2]], vector: [tang[0] * 1.1, 0, tang[2] * 1.1], radius: 0.04, color: 'data', label: 'velocidad (tangente)' });
  const fLen = 1.1 * Math.min(c.needed, c.available) / Math.max(c.needed, c.available);
  items.push({ id: 'friccion', kind: 'arrow', from: [pos[0], 0.1, pos[2]], vector: [inward[0] * fLen, 0, inward[2] * fLen], radius: 0.04, color: 'series-6', label: c.skids ? `fricción máxima ${fmt(c.available, 0)} N: no alcanza (${fmt(c.needed, 0)} N)` : `fricción ${fmt(c.needed, 0)} N hacia el centro` });
  if (c.skids) {
    const path = Array.from({ length: 10 }, (_, k): Vec3 => [pos[0] + tang[0] * k * 0.3, 0.05, pos[2] + tang[2] * k * 0.3]);
    items.push({ id: 'derrape', kind: 'particles', points: path, radius: 0.04, color: 'bad', label: 'derrape: sale por la tangente' });
  }
  const description = `Carro en una curva plana de ${fmt(i.radius, 0)} m con coeficiente de fricción ${fmt(c.mu, 2)}: necesita ${fmt(c.needed, 0)} N hacia el centro a ${fmt(i.speedKmh, 0)} km/h y la fricción da como máximo ${fmt(c.available, 0)} N. ` +
    (c.skids ? `No alcanza: el carro derrapa y sale por la tangente. Rapidez máxima: ${fmt(c.vmaxKmh, 1)} km/h.` : `Toma la curva; rapidez máxima ${fmt(c.vmaxKmh, 1)} km/h.`);
  return { items, extent: 3.6, target: [0, 0.2, -1.2], description };
}

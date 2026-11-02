/**
 * «newton» (lote 3D-3): el carrito en la pista con su diagrama de cuerpo libre en 3D (fuerza aplicada, normal, peso y
 * rozamiento) y la aceleración. Funciones PURAS a partir del MISMO resultado del modelo que usa el laboratorio
 * (src/models/newton.ts → simulateCart y positionAt): fuerzas, aceleración y posición x(t) = ½·a·t² del mismo instante.
 * Escalas FIJAS (no dependen de la corrida, así las flechas cambian de tamaño con los controles):
 *   fuerzas 0,03 m por newton (10 N = 0,30 m) y aceleración 0,02 m por m/s² (recortada a 40 m/s², y se avisa).
 */
import { fmt } from '../../lib/format';
import { TRACK_LENGTH } from '../../models/newton';
import type { SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';
import { cart, cartTop, compact, photogate, xArrow } from './mech3d';

export const FORCE_SCALE = 0.03; // m de escena por N
export const ACCEL_SCALE = 0.02; // m de escena por m/s²
export const ACCEL_CAP = 40; // m/s²
const CART: Vec3 = [0.2, 0.07, 0.12];
const FLOOR = 0.02; // cara superior de la pista

export interface NewtonSceneInput {
  mass: number;
  force: number;
  surfaceId: string;
  surfaceName: string;
  moves: boolean;
  weight: number;
  normal: number;
  friction: number;
  netForce: number;
  acceleration: number;
  /** Posición del carrito desde la fotopuerta 1 (m) y tiempo (s). */
  x: number;
  t: number;
  running: boolean;
  done: boolean;
}

const SURFACE_COLOR: Record<string, SceneColor> = { colchon: 'series-8', madera: 'series-6', lija: 'amb' };

export function newtonScene(inp: NewtonSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; accelCapped: boolean } {
  const x = Math.max(0, Math.min(TRACK_LENGTH, inp.x));
  const top = cartTop(FLOOR, CART);
  const cy = (FLOOR + top) / 2 + 0.01;
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0.55, -0.62, 0], size: [1.7, 0.6], color: 'surface-3' },
    { id: 'pista', kind: 'box', center: [0.55, FLOOR - 0.02, 0], size: [1.6, 0.04, 0.18], color: SURFACE_COLOR[inp.surfaceId] ?? 'series-8', label: inp.surfaceId === 'colchon' ? 'Riel de aire' : inp.surfaceId === 'madera' ? 'Madera' : 'Lija' },
    { id: 'pata-1', kind: 'rod', from: [-0.15, -0.62, 0], to: [-0.15, FLOOR - 0.04, 0], radius: 0.015, color: 'ink-2' },
    { id: 'pata-2', kind: 'rod', from: [1.25, -0.62, 0], to: [1.25, FLOOR - 0.04, 0], radius: 0.015, color: 'ink-2' },
    ...photogate('fotopuerta-1', 0, FLOOR, 0.3, 0.12),
    ...photogate('fotopuerta-2', TRACK_LENGTH, FLOOR, 0.3, 0.12),
    ...cart('carrito', x, FLOOR, CART, 'series-2'),
  ];
  // Pesas encima: una lámina por cada 250 g, como el banco 2D.
  const discs = Math.max(1, Math.min(8, Math.round(inp.mass / 0.25)));
  items.push({ id: 'pesas', kind: 'box', center: [x, top + discs * 0.006, 0], size: [0.1, discs * 0.012, 0.08], color: 'series-6', edges: true });

  const r = 0.012;
  const c: Vec3 = [x, cy, 0];
  const capped = inp.acceleration > ACCEL_CAP;
  const a = Math.min(inp.acceleration, ACCEL_CAP);
  const showNumbersA = inp.done && inp.moves;
  items.push(...compact<SceneItem>([
    xArrow('F', [x + CART[0] / 2, cy, 0], inp.force, FORCE_SCALE, 'fis', `F = ${fmt(inp.force, 1)} N`, r),
    xArrow('Fr', [x - CART[0] / 2, FLOOR + 0.012, 0], -inp.friction, FORCE_SCALE, 'bad', `Fr = ${fmt(inp.friction, 2)} N`, r),
    { id: 'P', kind: 'arrow', from: c, vector: [0, -inp.weight * FORCE_SCALE, 0], radius: r, color: 'ink', label: `P = ${fmt(inp.weight, 1)} N` },
    { id: 'N', kind: 'arrow', from: [x, top + 0.03, 0.03], vector: [0, inp.normal * FORCE_SCALE, 0], radius: r, color: 'ok', label: `N = ${fmt(inp.normal, 1)} N` },
    inp.moves && a > 0 ? xArrow('a', [x - CART[0] / 2, top + 0.13, 0], a, ACCEL_SCALE, 'data', showNumbersA ? `a = ${fmt(inp.acceleration, 2)} m/s²${capped ? ' (recortada)' : ''}` : 'a', r * 0.9) : null,
  ]));

  const pos = inp.done || inp.t > 0 ? ` El carrito está a ${fmt(x, 2)} m de la fotopuerta 1${inp.done && inp.moves ? ' (llegó a la fotopuerta 2)' : ''}.` : ' El carrito está en reposo en la fotopuerta 1.';
  let description = `Diagrama de cuerpo libre en 3D: carrito de ${fmt(inp.mass, 2)} kg sobre ${inp.surfaceName.toLowerCase()}. Fuerzas: aplicada ${fmt(inp.force, 1)} N hacia la derecha, rozamiento ${fmt(inp.friction, 2)} N hacia la izquierda, peso ${fmt(inp.weight, 2)} N hacia abajo y normal ${fmt(inp.normal, 2)} N hacia arriba (el peso y la normal se equilibran). `;
  if (!inp.moves) description += 'La fuerza aplicada no supera el rozamiento estático máximo: la fuerza neta es cero y el carrito no acelera.';
  else description += `Fuerza neta ${fmt(inp.netForce, 2)} N hacia la derecha: la flecha a apunta en el mismo sentido${showNumbersA ? ` y mide a = F neta / m = ${fmt(inp.acceleration, 2)} m/s²` : ''}.${capped ? ' La flecha de la aceleración está recortada a 40 m/s² para que quepa.' : ''}`;
  description += pos;
  return { items, extent: 0.78, target: [0.55, 0, 0], description, accelCapped: capped };
}

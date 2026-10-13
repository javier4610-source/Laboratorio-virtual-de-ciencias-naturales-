import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Leyes de Newton (grado 9.º): carrito en una pista horizontal.
 *   Si F ≤ μs·m·g, el carrito no se mueve (fricción estática).
 *   Si se mueve: a = (F − μk·m·g)/m;  x = ½·a·t².
 */

export const G = 9.8; // m/s²
export const TRACK_LENGTH = 1.0; // m entre las dos fotopuertas
export const TIMER_RES = 0.001; // s

export interface Surface { id: string; name: string; muS: number; muK: number; }
export const SURFACES: Surface[] = [
  { id: 'colchon', name: 'Riel de colchón de aire (casi sin fricción)', muS: 0, muK: 0 },
  { id: 'madera', name: 'Madera pulida', muS: 0.2, muK: 0.15 },
  { id: 'lija', name: 'Papel de lija', muS: 0.5, muK: 0.4 },
];

export const NEWTON_LIMITS = { mass: [0.1, 2] as [number, number], force: [0, 10] as [number, number] };

export function findSurface(id: string): Surface {
  const s = SURFACES.find((x) => x.id === id);
  if (!s) throw new Error(`Superficie desconocida: ${id}`);
  return s;
}

export interface NewtonInput { mass: number; force: number; surfaceId: string; /** Gravedad (m/s²); por defecto G. Parámetro editable del modo avanzado. */ g?: number; }
export interface NewtonResult {
  moves: boolean;
  weight: number; normal: number;
  friction: number; // N, valor de la fuerza de fricción
  netForce: number; acceleration: number;
  time: number | null; // s para recorrer la pista (lectura del cronómetro)
  finalSpeed: number | null; // m/s al final de la pista
  measuredAcceleration: number | null; // 2d/t² con la lectura del cronómetro
}

export function simulateCart(input: NewtonInput): NewtonResult {
  assertInRange('La masa del carrito', input.mass, ...NEWTON_LIMITS.mass);
  assertInRange('La fuerza aplicada', input.force, ...NEWTON_LIMITS.force);
  const s = findSurface(input.surfaceId);
  const weight = input.mass * (input.g ?? G);
  const normal = weight;
  const maxStatic = s.muS * normal;
  if (input.force <= maxStatic && !(s.muS === 0 && input.force > 0)) {
    // Sin movimiento: la fricción estática iguala a la fuerza aplicada (tercera ley en el contacto).
    return { moves: false, weight, normal, friction: input.force, netForce: 0, acceleration: 0, time: null, finalSpeed: null, measuredAcceleration: null };
  }
  const friction = s.muK * normal;
  const net = input.force - friction;
  const a = net / input.mass;
  if (a <= 0) return { moves: false, weight, normal, friction: input.force, netForce: 0, acceleration: 0, time: null, finalSpeed: null, measuredAcceleration: null };
  const t = Math.sqrt((2 * TRACK_LENGTH) / a);
  const tRead = roundToResolution(t, TIMER_RES);
  return {
    moves: true, weight, normal, friction, netForce: net, acceleration: a,
    time: tRead, finalSpeed: a * t, measuredAcceleration: (2 * TRACK_LENGTH) / tRead ** 2,
  };
}

/** Posición (m) del carrito en el tiempo t (para la animación). */
export function positionAt(a: number, t: number): number {
  return Math.min(TRACK_LENGTH, 0.5 * a * t * t);
}

export const newtonModelSpec: ModelSpec = {
  name: 'Segunda ley de Newton con fricción en una pista horizontal',
  inputs: [
    { symbol: 'm', name: 'Masa del carrito (con pesas)', unit: 'kg', range: NEWTON_LIMITS.mass, initial: 0.5 },
    { symbol: 'F', name: 'Fuerza aplicada por el dinamómetro', unit: 'N', range: NEWTON_LIMITS.force, initial: 2 },
    { symbol: 'superficie', name: 'Superficie de la pista', unit: '—', initial: 'colchón de aire' },
  ],
  outputs: [
    { symbol: 'a', name: 'Aceleración', unit: 'm/s²' },
    { symbol: 't', name: 'Tiempo para recorrer 1,00 m (fotopuertas)', unit: 's' },
    { symbol: 'F_r', name: 'Fuerza de fricción', unit: 'N' },
  ],
  equations: [
    'ΣF = m·a',
    'Peso: P = m·g (g = 9,8 m/s²);  normal: N = P (pista horizontal)',
    'Fricción estática máxima: μs·N;  fricción cinética: μk·N',
    'a = (F − μk·N)/m',
    'Desde el reposo: d = ½·a·t²  →  a = 2d/t²',
  ],
  initialConditions: ['Carrito de 0,5 kg en reposo sobre riel de colchón de aire; fuerza constante de 2 N.'],
  assumptions: [
    'La fuerza aplicada es constante y horizontal.',
    'Los coeficientes de fricción son constantes; se ignoran la resistencia del aire y la rotación de las ruedas.',
    'El cronómetro de las fotopuertas tiene resolución de 1 ms.',
  ],
  limits: [
    'Los coeficientes de fricción son valores típicos aproximados.',
    'No representa fuerzas variables, planos inclinados ni choques (pueden agregarse en otra práctica).',
  ],
  testCases: [
    'Sin fricción: a = F/m (2 N y 0,5 kg → 4 m/s²).',
    'Duplicar la fuerza duplica la aceleración; duplicar la masa la reduce a la mitad.',
    'Con fricción, una fuerza menor que μs·m·g no mueve el carrito.',
    'La aceleración medida con las fotopuertas coincide con la del modelo.',
  ],
};

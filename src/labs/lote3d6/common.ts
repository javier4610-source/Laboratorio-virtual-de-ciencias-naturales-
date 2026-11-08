/**
 * Lote 3D-6 «materia, calor, movimiento y evolución»: piezas comunes de las escenas (funciones PURAS, sin three.js ni
 * DOM). Cada práctica arma su escena con el MISMO estado de su laboratorio; aquí solo hay geometría de dibujo, un
 * generador determinista para repartir partículas y la escala fija de color de temperatura. Ver docs/v2/KIT-3D.md.
 */
import type { SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';
import { mixHex } from '../lote3d5/common';

/** Número «aleatorio» reproducible en [0, 1) para el índice i y la semilla s (solo para ubicar dibujos). */
export function hash01(i: number, s = 0): number {
  const x = Math.sin(i * 12.9898 + s * 78.233 + 0.5) * 43758.5453;
  return x - Math.floor(x);
}

/** Puntos repartidos (de forma fija) dentro de un cilindro vertical de radio r entre las alturas y0 y y1. */
export function cylinderPoints(n: number, center: Vec3, r: number, y0: number, y1: number, seed: number): Vec3[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const a = 2 * Math.PI * hash01(i, seed), rr = r * Math.sqrt(hash01(i, seed + 1));
    return [center[0] + rr * Math.cos(a), y0 + (y1 - y0) * hash01(i, seed + 2), center[2] + rr * Math.sin(a)] as Vec3;
  });
}

/**
 * Escala FIJA de color de temperatura de las vistas de calor (no depende de la corrida): 20 °C azul, 45 °C amarillo,
 * 70 °C naranja y 100 °C rojo, con interpolación lineal entre esas paradas (por debajo o por encima, el color del extremo).
 */
export const TEMP_STOPS: readonly [number, string][] = [[20, '#3f7fd6'], [45, '#e9cf5c'], [70, '#ee8a3c'], [100, '#c8322b']];
export function tempColor(T: number): `#${string}` {
  const s = TEMP_STOPS;
  if (!(T > s[0][0])) return s[0][1] as `#${string}`;
  for (let i = 1; i < s.length; i++) if (T <= s[i][0]) return mixHex(s[i - 1][1], s[i][1], (T - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
  return s[s.length - 1][1] as `#${string}`;
}

/**
 * Cono vertical dibujado con varillas apiladas (el kit no tiene conos): de radio r0 en y0 a radio r1 en y1. Sirve para
 * embudos, conos de la pista y llamas.
 */
export function stackedCone(id: string, x: number, z: number, y0: number, y1: number, r0: number, r1: number, color: SceneColor, n = 6, opacity?: number): SceneItem[] {
  return Array.from({ length: n }, (_, i) => {
    const a = y0 + ((y1 - y0) * i) / n, b = y0 + ((y1 - y0) * (i + 1)) / n;
    const r = r0 + ((r1 - r0) * (i + 0.5)) / n;
    return { id: `${id}-${i}`, kind: 'rod' as const, from: [x, a, z] as Vec3, to: [x, b, z] as Vec3, radius: Math.max(0.01, r), color, ...(opacity !== undefined ? { opacity } : {}) };
  });
}

/** Tiempo «mm:ss» como el cronómetro del banco. */
export const clockText = (s: number) => {
  const r = Math.round(Math.max(0, s));
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
};

/**
 * Lote 3D-7 «ecología, ambiente y datos»: piezas comunes de las escenas (funciones PURAS, sin three.js ni DOM). Cada
 * práctica arma su escena con el MISMO estado de su laboratorio; aquí solo hay utilidades de dibujo y la escala FIJA de
 * color del oxígeno disuelto. Ver docs/v2/KIT-3D.md.
 */
import type { SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';
import { mixHex } from '../lote3d5/common';

/**
 * Escala FIJA de color del oxígeno disuelto (mg/L; no depende de la corrida): 0 rojo oscuro, 2 rojo, 4 naranja (la
 * referencia para la fauna de la práctica `agua`), 6 amarillo verdoso, 8 azul; interpolación lineal entre paradas.
 */
export const OD_STOPS: readonly [number, string][] = [[0, '#7a1712'], [2, '#c8322b'], [4, '#ee8a3c'], [6, '#b9c94a'], [8, '#2f7fd0']];
export const OD_SCALE_TEXT = '0 mg/L rojo oscuro, 2 rojo, 4 naranja, 6 amarillo verdoso, 8 o más azul';
export function odColor(od: number): `#${string}` {
  const s = OD_STOPS;
  if (!(od > s[0][0])) return s[0][1] as `#${string}`;
  for (let i = 1; i < s.length; i++) if (od <= s[i][0]) return mixHex(s[i - 1][1], s[i][1], (od - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
  return s[s.length - 1][1] as `#${string}`;
}

/** Flecha vertical u horizontal de dibujo con un grosor dado (el kit escala la punta con el radio). */
export function fatArrow(id: string, from: Vec3, vector: Vec3, radius: number, color: SceneColor, label?: string, tag?: string): SceneItem {
  return { id, kind: 'arrow', from, vector, radius, color, ...(label ? { label } : {}), ...(tag !== undefined ? { tag } : {}) };
}

/** Grosor de una flecha de flujo con una escala FIJA: r0 + k·√(v/vRef), con tope en vMax (dibujo proporcional a √v). */
export function sqrtRadius(v: number, vRef: number, r0: number, k: number, vMax = Infinity): number {
  const x = Math.max(0, Math.min(v, vMax));
  return r0 + k * Math.sqrt(x / vRef);
}

/**
 * Lote 3D-5 «ondas, luz y fluidos»: piezas comunes de las escenas (funciones PURAS, sin three.js ni DOM). Cada práctica
 * arma su escena con el MISMO estado de su laboratorio; aquí solo hay geometría de dibujo y utilidades de color.
 * Ver docs/v2/KIT-3D.md.
 */
import { normalizeHex, type SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';

/** Mezcla lineal de dos colores «#rrggbb» (t = 0 → a; t = 1 → b). */
export function mixHex(a: string, b: string, t: number): `#${string}` {
  const A = normalizeHex(a) ?? '#ffffff', B = normalizeHex(b) ?? '#ffffff';
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const k = Math.max(0, Math.min(1, t));
  return `#${[0, 1, 2].map((i) => Math.round(ch(A, i) + (ch(B, i) - ch(A, i)) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** Color «#rrggbb» de una terna RGB en 0–1 (sRGB ya codificado). */
export function rgbHex([r, g, b]: readonly [number, number, number]): `#${string}` {
  const c = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Varillas entre puntos consecutivos de una poligonal (cuerdas, chorros, arcos). */
export function polyRods(id: string, pts: readonly Vec3[], radius: number, color: SceneColor, opacity?: number): SceneItem[] {
  const out: SceneItem[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-9) continue;
    out.push({ id: `${id}-${i}`, kind: 'rod', from: a, to: b, radius, color, ...(opacity !== undefined ? { opacity } : {}) });
  }
  return out;
}

/** Puntos de un arco de circunferencia en el plano que forman los vectores unitarios `u` y `v`, de `a0` a `a1` (rad). */
export function arcPoints(center: Vec3, r: number, u: Vec3, v: Vec3, a0: number, a1: number, n: number): Vec3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    const c = Math.cos(a) * r, s = Math.sin(a) * r;
    return [center[0] + c * u[0] + s * v[0], center[1] + c * u[1] + s * v[1], center[2] + c * u[2] + s * v[2]] as Vec3;
  });
}

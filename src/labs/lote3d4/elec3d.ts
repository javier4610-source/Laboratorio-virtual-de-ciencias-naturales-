/**
 * Lote 3D-4 «electricidad, campos y partículas»: piezas comunes de las escenas (funciones PURAS, sin three.js ni DOM).
 * Cada práctica arma su escena con el MISMO estado de su laboratorio; aquí solo hay geometría de dibujo (cables con
 * electrones, bombillos que brillan, cajas de partículas que rebotan) y utilidades. Ver docs/v2/KIT-3D.md.
 */
import type { SceneColor } from '../../three/colors';
import { seededRandom } from '../../models/math';
import type { SceneItem, Vec3 } from '../../three/scene';

/** Longitud de una poligonal. */
export function pathLength(path: readonly Vec3[]): number {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
  return L;
}

/** Punto a la distancia `d` (unidades de la escena) desde el inicio de una poligonal; `d` se recorta al largo. */
export function pointAt(path: readonly Vec3[], d: number): Vec3 {
  let rest = Math.max(0, d);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (rest <= L || i === path.length - 1) {
      const t = L > 0 ? Math.min(1, rest / L) : 0;
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
    }
    rest -= L;
  }
  return path[path.length - 1];
}

/** Separación entre electrones dibujados a lo largo de un conductor (unidades de la escena). */
export const ELECTRON_SPACING = 0.25;

/**
 * Electrones (puntos) a lo largo de una poligonal recorrida en el sentido de la corriente CONVENCIONAL. Los electrones
 * van al revés: a la distancia s = s₀ − v·t. La densidad de puntos es la misma en todos los conductores, así que el
 * número de electrones que pasa por segundo es proporcional a la rapidez dibujada, y esta a la corriente del modelo.
 * `drift` es lo que ya avanzaron (unidades de la escena, = rapidez·t).
 */
export function electronsAlong(path: readonly Vec3[], drift: number, spacing = ELECTRON_SPACING, lift: Vec3 = [0, 0, 0]): Vec3[] {
  const L = pathLength(path);
  if (L < 1e-9) return [];
  const n = Math.max(1, Math.round(L / spacing));
  const step = L / n;
  const off = (((-drift % step) + step) % step);
  return Array.from({ length: n }, (_, i) => {
    const p = pointAt(path, off + i * step);
    return [p[0] + lift[0], p[1] + lift[1], p[2] + lift[2]] as Vec3;
  });
}

/** Varillas (cables) entre puntos consecutivos de una poligonal. */
export function wireRods(id: string, path: readonly Vec3[], radius: number, color: SceneColor, opacity?: number): SceneItem[] {
  const out: SceneItem[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-9) continue;
    out.push({ id: `${id}-${i}`, kind: 'rod', from: a, to: b, radius, color, ...(opacity !== undefined ? { opacity } : {}) });
  }
  return out;
}

/** Color «real» del vidrio de un bombillo: gris apagado → amarillo blanquecino según el brillo (0–1). */
export function glassColor(b: number): `#${string}` {
  const t = Math.max(0, Math.min(1, b));
  if (t <= 0.005) return '#c9d1d6';
  const mix = (a: number, c: number) => Math.round(a + (c - a) * t).toString(16).padStart(2, '0');
  return `#${mix(232, 255)}${mix(214, 240)}${mix(150, 170)}`;
}

/**
 * Bombillo: casquillo, ampolla (color según el brillo) y, si brilla, un halo translúcido cuyo radio y opacidad crecen
 * con el brillo relativo `b` (P/P_nominal del modelo; se recorta a 1,5 para dibujar).
 */
export function bulb(id: string, base: Vec3, size: number, b: number, label?: string): SceneItem[] {
  const g = Math.max(0, Math.min(1.5, b));
  const glass: Vec3 = [base[0], base[1] + size * 1.25, base[2]];
  const items: SceneItem[] = [
    { id: `${id}-casquillo`, kind: 'rod', from: base, to: [base[0], base[1] + size * 0.55, base[2]], radius: size * 0.32, color: 'series-8' },
    { id, kind: 'sphere', center: glass, radius: size * 0.62, color: glassColor(g), opacity: 0.92, ...(label ? { label } : {}) },
  ];
  if (g > 0.01) items.push({ id: `${id}-halo`, kind: 'sphere', center: glass, radius: size * (0.8 + 0.9 * Math.sqrt(g)), color: '#ffd54a', opacity: Math.min(0.45, 0.1 + 0.3 * g) });
  return items;
}

/** Rebote de ida y vuelta en [0, len]: posición de una partícula que salió de `x0` con velocidad `v` hace `t`. */
export function bounce(x0: number, v: number, t: number, len: number): number {
  if (len <= 0) return 0;
  const raw = (x0 + v * t) % (2 * len);
  const u = raw < 0 ? raw + 2 * len : raw;
  return u > len ? 2 * len - u : u;
}

/** Semillas estables de partículas: posición (0–1) y dirección de la velocidad (componentes en −0,5…0,5). */
export interface Seed { p: Vec3; v: Vec3 }
export function seeds(n: number, seed: number): Seed[] {
  const r = seededRandom(seed);
  return Array.from({ length: n }, () => ({ p: [r(), r(), r()] as Vec3, v: [r() - 0.5, r() - 0.5, r() - 0.5] as Vec3 }));
}

/** Posiciones de partículas que rebotan dentro de una caja [min, max] con rapidez común `speed` (unidades/s). */
export function boxParticles(list: readonly Seed[], min: Vec3, max: Vec3, speed: number, t: number): Vec3[] {
  return list.map(({ p, v }) => {
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return [0, 1, 2].map((k) => {
      const len = max[k] - min[k];
      return min[k] + bounce(p[k] * len, (v[k] / n) * speed, t, len);
    }) as unknown as Vec3;
  });
}

/** Quita nulos. */
export const compact = <T,>(list: readonly (T | null | undefined | false)[]): T[] => list.filter((x): x is T => !!x);

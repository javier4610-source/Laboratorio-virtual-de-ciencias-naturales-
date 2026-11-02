/**
 * Lote 3D-3 «mecánica»: piezas comunes de las escenas (funciones PURAS, sin three.js). Cada práctica arma su escena con el
 * MISMO estado que dibuja su banco 2D; aquí solo hay geometría de dibujo (barras de energía, fotopuertas, carritos) y
 * utilidades de texto. Ver docs/v2/KIT-3D.md.
 */
import type { SceneColor } from '../../three/colors';
import { arrowScale, physicalArrow, type SceneItem, type Vec3 } from '../../three/scene';

export interface EnergyBar {
  id: string;
  /** Rótulo corto (también va a la leyenda). */
  label: string;
  /** Energía (J) en el instante actual. */
  value: number;
  color: SceneColor;
}

/**
 * Barras de energía 3D de pie sobre `base` (centro de la primera barra al ras del piso), una al lado de la otra a lo
 * largo de x. La altura de cada barra es value/total·`maxHeight` (escala FIJA por corrida: la energía total de la corrida
 * mide `maxHeight`). Detrás de cada barra hay un tablero translúcido de la altura total, para leer la fracción.
 */
export function energyBars(base: Vec3, bars: readonly EnergyBar[], total: number, opts: { maxHeight: number; width: number; gap: number }): SceneItem[] {
  const items: SceneItem[] = [];
  const k = total > 1e-12 ? opts.maxHeight / total : 0;
  bars.forEach((b, i) => {
    const x = base[0] + i * (opts.width + opts.gap);
    const h = Math.max(0, Math.min(1.02 * opts.maxHeight, b.value * k));
    // Tablero de fondo detrás de la barra (no la envuelve: así el orden de dibujo de lo translúcido es estable).
    items.push({ id: `${b.id}-total`, kind: 'box', center: [x, base[1] + opts.maxHeight / 2, base[2] - opts.width * 0.62], size: [opts.width * 1.12, opts.maxHeight, opts.width * 0.12], color: 'ink-3', opacity: 0.22, edges: true });
    // Una barra vacía se dibuja como una lámina (altura mínima) para que su rótulo siga en su lugar.
    items.push({ id: b.id, kind: 'box', center: [x, base[1] + Math.max(h, 0.004) / 2, base[2]], size: [opts.width, Math.max(h, 0.004), opts.width], color: b.color, label: b.label });
  });
  return items;
}

/** Altura (en unidades de la escena) de la barra de una energía con la escala de `energyBars`. */
export const barHeight = (value: number, total: number, maxHeight: number) => (total > 1e-12 ? Math.max(0, Math.min(1.02 * maxHeight, (value / total) * maxHeight)) : 0);

/** Fotopuerta en U: dos postes verticales a ambos lados (z) del riel y el cabezal arriba, centrada en x. */
export function photogate(id: string, x: number, y0: number, y1: number, halfWidth: number, label?: string): SceneItem[] {
  const r = halfWidth * 0.12;
  return [
    { id: `${id}-a`, kind: 'rod', from: [x, y0, -halfWidth], to: [x, y1, -halfWidth], radius: r, color: 'ink-2' },
    { id: `${id}-b`, kind: 'rod', from: [x, y0, halfWidth], to: [x, y1, halfWidth], radius: r, color: 'ink-2' },
    { id, kind: 'box', center: [x, y1, 0], size: [halfWidth * 0.5, halfWidth * 0.45, halfWidth * 2.3], color: 'series-7', ...(label ? { label } : {}) },
  ];
}

/** Carrito: cuerpo (caja) con cuatro ruedas, apoyado en y = `floor`, centrado en x. */
export function cart(id: string, x: number, floor: number, size: Vec3, color: SceneColor, label?: string): SceneItem[] {
  const [L, H, W] = size;
  const r = H * 0.28;
  const wheels: Vec3[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wheels.push([x + sx * L * 0.32, floor + r, sz * W * 0.42]);
  return [
    { id, kind: 'box', center: [x, floor + 2 * r * 0.8 + H / 2, 0], size, color, ...(label ? { label } : {}) },
    { id: `${id}-ruedas`, kind: 'particles', points: wheels, radius: r, color: 'ink' },
  ];
}
/** Altura de la cara superior del carrito de `cart`. */
export const cartTop = (floor: number, size: Vec3) => floor + 2 * size[1] * 0.28 * 0.8 + size[1];

/** Flecha horizontal (eje x) con una magnitud física con signo; `null` si mediría casi cero. */
export function xArrow(id: string, from: Vec3, value: number, k: number, color: SceneColor, label: string, radius: number, minLength = 0.004): SceneItem | null {
  const a = physicalArrow(from, [value, 0, 0], k, minLength);
  return a ? { id, kind: 'arrow', from: a.from, vector: a.vector, radius, color, label } : null;
}

export { arrowScale };

/** «hacia la derecha» / «hacia la izquierda» / «en reposo» según el signo. */
export const sense = (v: number, eps = 1e-6) => (v > eps ? 'hacia la derecha' : v < -eps ? 'hacia la izquierda' : 'nula');

/** Quita nulos. */
export const compact = <T,>(list: readonly (T | null | undefined | false)[]): T[] => list.filter((x): x is T => !!x);

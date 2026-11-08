/**
 * «presion» (lote 3D-5): dos montajes del banco en 3D, en centímetros reales. Funciones PURAS con el MISMO modelo
 * (src/models/pressure.ts):
 *   - Sonda en el tanque: el líquido en capas coloreadas por su presión manométrica ρ·g·h (hydrostaticGauge del modelo;
 *     escala de color fija: 0 Pa claro → 4000 Pa oscuro), la cápsula a la profundidad y con la orientación del banco, la
 *     flecha de la presión sobre la membrana (∝ presión del modelo, 4000 Pa = 6 cm) y el manómetro en U con el desnivel
 *     que muestra el banco (el mismo valor animado, a escala real: 1 mm = 0,1 cm).
 *   - Botella con agujeros: el agua en capas coloreadas igual, una flecha de presión en cada agujero abierto (∝ ρ·g·h) y,
 *     al medir, los chorros con la trayectoria del modelo: sale horizontal con v = C_v·√(2gh) y cae y metros en t = √(2y/g);
 *     llega a la bandeja al alcance R del modelo (la cinta métrica está a escala real).
 */
import { fmt } from '../../lib/format';
import { hydrostaticGauge, type JetResult } from '../../models/pressure';
import type { SceneItem, Vec3 } from '../../three/scene';
import { mixHex } from './common';

export const P_COLOR_MAX = 4000; // Pa
export const P_ARROW = 6 / 4000; // cm por Pa
const LOW = '#dbeef8', HIGH = '#1f4e8c';
export const pressureColor = (pa: number) => mixHex(LOW, HIGH, pa / P_COLOR_MAX);

export interface ProbeSceneInput {
  liquidName: string;
  rho: number; // kg/m³
  g: number;
  depth: number; // cm
  orientation: number; // °
  /** Presión manométrica del modelo sobre la membrana (Pa). */
  gauge: number;
  /** Desnivel que muestra el manómetro del banco en este instante (mm; oscila al cambiar y se asienta). */
  shownRise: number;
  done: boolean;
  /** Lectura del desnivel (mm), solo se dice después de medir. */
  riseReading: number;
}

const TANK_W = 22, TANK_H = 35, TANK_D = 14, LIQ = 32;
const MANO_X = [24, 30] as const, MANO_ZERO = 22, MANO_TOP = 44;

/** Capas del líquido (cada `step` cm) con la presión manométrica del modelo en su punto medio. */
export function layers(rho: number, g: number, surface: number, step: number): { y0: number; y1: number; gauge: number }[] {
  const out: { y0: number; y1: number; gauge: number }[] = [];
  for (let y0 = 0; y0 < surface - 1e-9; y0 += step) {
    const y1 = Math.min(surface, y0 + step);
    out.push({ y0, y1, gauge: hydrostaticGauge(rho, (surface - (y0 + y1) / 2) / 100, g) });
  }
  return out;
}

export function probeScene(inp: ProbeSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const o = (inp.orientation * Math.PI) / 180;
  const n: Vec3 = [Math.sin(o), Math.cos(o), 0];
  const c: Vec3 = [2, LIQ - inp.depth, 0];
  const at = (k: number): Vec3 => [c[0] + n[0] * k, c[1] + n[1] * k, c[2] + n[2] * k];
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [12, -0.3, 0], size: [56, 24], color: 'surface-3' },
    { id: 'tanque', kind: 'box', center: [0, TANK_H / 2, 0], size: [TANK_W, TANK_H, TANK_D], color: 'line-strong', opacity: 0.08, edges: true },
  ];
  const ls = layers(inp.rho, inp.g, LIQ, 4);
  ls.forEach((l, i) => items.push({
    id: `capa-${i}`, kind: 'box', center: [0, (l.y0 + l.y1) / 2, 0], size: [TANK_W - 0.6, l.y1 - l.y0 - 0.05, TANK_D - 0.6], color: pressureColor(l.gauge), opacity: 0.42,
    ...(i === ls.length - 1 ? { label: 'Superficie: p man. = 0' } : {}),
  }));
  items.push(
    { id: 'tubo-sonda', kind: 'rod', from: at(-1.3), to: [2 - 0.01, LIQ + 9, 0], radius: 0.35, color: 'ink-3' },
    { id: 'capsula', kind: 'rod', from: at(-1.3), to: at(-0.1), radius: 1.75, color: '#2f393c' },
    { id: 'membrana', kind: 'rod', from: at(-0.1), to: at(0.05), radius: 1.5, color: '#4f8fd6', label: 'Membrana' },
  );
  const len = inp.gauge * P_ARROW;
  if (len > 0.05) items.push({ id: 'p', kind: 'arrow', from: at(len + 0.5), vector: [-n[0] * len, -n[1] * len, 0], radius: 0.28, color: 'data', label: 'p' });
  // Manguera y manómetro en U (líquido rojo del banco); el desnivel es el que muestra el banco, a escala real.
  const dh = inp.shownRise / 10;
  const left = MANO_ZERO - dh / 2, right = MANO_ZERO + dh / 2;
  items.push(
    { id: 'manguera-1', kind: 'rod', from: [2, LIQ + 9, 0], to: [2, MANO_TOP + 3, 0], radius: 0.3, color: 'ink-3' },
    { id: 'manguera-2', kind: 'rod', from: [2, MANO_TOP + 3, 0], to: [MANO_X[0], MANO_TOP + 3, 0], radius: 0.3, color: 'ink-3' },
    { id: 'manguera-3', kind: 'rod', from: [MANO_X[0], MANO_TOP + 3, 0], to: [MANO_X[0], MANO_TOP, 0], radius: 0.3, color: 'ink-3' },
    { id: 'tablero', kind: 'box', center: [(MANO_X[0] + MANO_X[1]) / 2, MANO_TOP / 2, -1.2], size: [9, MANO_TOP + 2, 0.6], color: 'surface-2' },
    { id: 'rama-izq', kind: 'rod', from: [MANO_X[0], 1, 0], to: [MANO_X[0], MANO_TOP, 0], radius: 0.7, color: 'line-strong', opacity: 0.2 },
    { id: 'rama-der', kind: 'rod', from: [MANO_X[1], 1, 0], to: [MANO_X[1], MANO_TOP, 0], radius: 0.7, color: 'line-strong', opacity: 0.2, label: 'Manómetro en U' },
    { id: 'codo', kind: 'rod', from: [MANO_X[0], 1, 0], to: [MANO_X[1], 1, 0], radius: 0.6, color: '#d2453b' },
    { id: 'columna-izq', kind: 'rod', from: [MANO_X[0], 1, 0], to: [MANO_X[0], left, 0], radius: 0.6, color: '#d2453b' },
    { id: 'columna-der', kind: 'rod', from: [MANO_X[1], 1, 0], to: [MANO_X[1], right, 0], radius: 0.6, color: '#d2453b' },
    { id: 'cero', kind: 'rod', from: [MANO_X[0] - 1.5, MANO_ZERO, 0.1], to: [MANO_X[1] + 1.5, MANO_ZERO, 0.1], radius: 0.08, color: 'ink-2' },
  );
  const dir = inp.orientation === 0 ? 'mira hacia arriba' : inp.orientation === 90 ? 'mira hacia un lado' : inp.orientation === 180 ? 'mira hacia abajo' : inp.orientation < 90 ? 'está inclinada hacia arriba' : 'está inclinada hacia abajo';
  const bottom = hydrostaticGauge(inp.rho, LIQ / 100, inp.g);
  const description = `Tanque en 3D con ${inp.liquidName.toLowerCase()} (32 cm de líquido) coloreado por capas según la presión manométrica: casi blanco en la superficie (0 Pa) y más oscuro hacia el fondo (${fmt(bottom, 0)} Pa), porque cada capa soporta el peso del líquido que tiene encima. `
    + `La membrana de la sonda está a ${fmt(inp.depth, 1)} cm de profundidad y ${dir}; la flecha p empuja perpendicular a la membrana desde el líquido, con el mismo largo en cualquier orientación si la membrana está sumergida (${fmt(inp.gauge, 0)} Pa en el modelo). `
    + (inp.done ? `El manómetro en U marca un desnivel de ${fmt(inp.riseReading, 0)} mm: la rama de la sonda baja y la otra sube.` : 'El manómetro en U muestra el desnivel del banco; mide para leerlo.');
  return { items, extent: 30, target: [13, 22, 0], description };
}

export interface JetsSceneInput {
  level: number; // cm
  g: number;
  rho: number; // del agua (kg/m³)
  holes: readonly boolean[];
  jets: readonly JetResult[];
  /** Avance del frente de los chorros (0–1, ya suavizado), el mismo del banco. */
  front: number;
  /** Fase del banco: 'listo' = agujeros tapados con cinta. */
  taped: boolean;
  done: boolean;
  /** Lecturas de la cinta (cm) por agujero, o null. */
  ranges: readonly (number | null)[];
}

const BOTTLE_R = 5.5;

/** Puntos de un chorro: sale horizontal del agujero y cae y₀ en el tiempo de caída; x = R·f, y = y₀·(1 − f²), f ≤ frente. */
export function jetPoints(j: JetResult, front: number, n = 16): Vec3[] {
  const u = Math.max(0, Math.min(1, front));
  return Array.from({ length: n + 1 }, (_, k) => {
    const f = (k / n) * u;
    return [BOTTLE_R + 0.2 + j.range * f, j.holeCm * (1 - f * f), 0] as Vec3;
  });
}

export function jetsScene(inp: JetsSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const items: SceneItem[] = [
    { id: 'bandeja', kind: 'plane', center: [16, -0.05, 0], size: [60, 16], color: 'surface-3' },
    { id: 'botella', kind: 'rod', from: [0, 0, 0], to: [0, 30, 0], radius: BOTTLE_R, color: 'line-strong', opacity: 0.14, label: 'Botella' },
    { id: 'cuello', kind: 'rod', from: [0, 30, 0], to: [0, 35, 0], radius: 1.6, color: 'line-strong', opacity: 0.25 },
    // Cinta métrica sobre la bandeja, desde la pared de la botella, con una marca cada 5 cm.
    { id: 'cinta', kind: 'box', center: [BOTTLE_R + 0.2 + 20, 0.05, 4], size: [40, 0.1, 1.6], color: '#f2c94c', label: 'Cinta métrica' },
  ];
  for (let x = 0; x <= 40; x += 5) items.push({ id: `marca-${x}`, kind: 'rod', from: [BOTTLE_R + 0.2 + x, 0.12, 3.2], to: [BOTTLE_R + 0.2 + x, 0.12, x % 10 === 0 ? 4.6 : 4], radius: 0.07, color: '#4d3b1c' });
  const ls = layers(inp.rho, inp.g, inp.level, 2.5);
  ls.forEach((l, i) => items.push({ id: `capa-${i}`, kind: 'rod', from: [0, l.y0 + 0.02, 0], to: [0, l.y1 - 0.02, 0], radius: BOTTLE_R - 0.25, color: pressureColor(l.gauge), opacity: 0.5 }));
  const open: number[] = [];
  inp.jets.forEach((j, i) => {
    if (!inp.holes[i]) return;
    items.push({ id: `agujero-${i}`, kind: 'sphere', center: [BOTTLE_R + 0.05, j.holeCm, 0], radius: 0.3, color: '#1f2a2c' });
    if (inp.taped) items.push({ id: `cinta-${i}`, kind: 'box', center: [BOTTLE_R + 0.2, j.holeCm, 0], size: [0.15, 1.4, 1.1], color: '#f2c94c' });
    if (!j.flows) return;
    open.push(i);
    const gauge = hydrostaticGauge(inp.rho, j.headCm / 100, inp.g);
    const len = gauge * P_ARROW;
    if (len > 0.05) items.push({ id: `p-${i}`, kind: 'arrow', from: [-BOTTLE_R - 0.2, j.holeCm, 0], vector: [-len, 0, 0], radius: 0.22, color: 'data', ...(open.length === 1 ? { label: 'p = ρ·g·h' } : {}) });
    if (!inp.taped && inp.front > 0) {
      items.push({ id: `chorro-${i}`, kind: 'particles', points: jetPoints(j, inp.front), radius: 0.32, color: '#3f86d6', ...(open.length === 1 ? { label: 'Chorros' } : {}) });
    }
  });
  const holesText = inp.holes.some((h) => h)
    ? `Agujeros abiertos a ${inp.jets.filter((_, i) => inp.holes[i]).map((j) => `${fmt(j.holeCm, 0)} cm`).join(', ')}.`
    : 'No hay agujeros abiertos.';
  const jetsText = inp.taped
    ? 'Los agujeros siguen tapados con cinta: mide para destaparlos.'
    : open.length === 0
      ? 'Ningún agujero abierto está bajo el agua: no sale agua.'
      : `Los chorros salen horizontales y caen en parábola: ${open.map((i) => {
        const j = inp.jets[i];
        return `el del agujero a ${fmt(j.holeCm, 0)} cm tiene ${fmt(j.headCm, 0)} cm de agua encima${inp.done && inp.ranges[i] !== null ? ` y la cinta marca ${fmt(inp.ranges[i], 1)} cm de alcance` : ''}`;
      }).join('; ')}. Más agua encima, más presión y mayor rapidez de salida; el alcance depende además de la altura de caída.`;
  const description = `Botella en 3D con agua hasta ${fmt(inp.level, 0)} cm sobre la bandeja, coloreada por capas según la presión manométrica (más oscura abajo). ${holesText} Las flechas p, en la pared de enfrente, miden cuánto empuja el agua hacia afuera a la altura de cada agujero. ${jetsText}`;
  return { items, extent: 25, target: [17, 13, 0], description };
}

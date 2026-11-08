/**
 * «seleccion» (lote 3D-6): el suelo donde viven los escarabajos, visto desde donde está el ave, en 3D. Funciones PURAS con
 * el MISMO resultado del modelo (src/models/selection.ts → simulateSelection, beetleSample, beetlePositions, survival):
 *   - el suelo tiene el color del fondo B que muestra el banco y los 40 escarabajos son la MISMA muestra del banco (los
 *     cuantiles de la distribución actual, en las mismas posiciones), con su color de pigmento;
 *   - al lado, columnas con cuántos de esos 40 escarabajos hay en cada clase de color (10 clases de 0 a 1);
 *   - después de la primera ronda de depredación (cuando el banco ya muestra la supervivencia), cada columna tiene dentro
 *     otra más oscura: los que se espera que escapen de las aves en la próxima ronda, n·s(z) con la supervivencia del
 *     modelo s(z) = 1 − p·(1 − e^(−(z − B)²/(2w²))) en el centro de la clase.
 * Dibujo: forma de los escarabajos y del ave, tamaño del terreno y altura de las columnas (1 escarabajo = 0,5 de alto).
 */
import { fmt } from '../../lib/format';
import { survival } from '../../models/selection';
import type { SceneItem, Vec3 } from '../../three/scene';

export const CLASSES = 10;
export const COL_H = 0.5; // alto de la columna por escarabajo
const W = 26, D = 15; // terreno (dibujo)

/** Color de pigmento del banco: crema (0, claro) → pardo casi negro (1, oscuro). */
export function pigmentHex(z: number): `#${string}` {
  const t = Math.min(1, Math.max(0, z));
  const light = [233, 220, 190], dark = [38, 30, 26];
  return `#${light.map((l, i) => Math.round(l + (dark[i] - l) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Cuántos escarabajos de la muestra caen en cada clase de color (10 clases iguales de [0, 1]). */
export function classCounts(sample: readonly number[], classes = CLASSES): number[] {
  const out = Array<number>(classes).fill(0);
  for (const z of sample) out[Math.min(classes - 1, Math.max(0, Math.floor(z * classes)))]++;
  return out;
}

export interface SelectionSceneInput {
  backgroundName: string;
  /** Fondo B y color medio que muestra el banco en este instante. */
  B: number;
  mean: number;
  sample: readonly number[];
  positions: readonly { x: number; y: number; angle: number }[];
  /** Intensidad de depredación (0–1). */
  predation: number;
  generation: number;
  /** ¿Ya hubo al menos una ronda de depredación? (el banco muestra la supervivencia). */
  measured: boolean;
}

export function selectionScene(inp: SelectionSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; counts: number[]; survivors: number[] | null } {
  const items: SceneItem[] = [
    { id: 'suelo', kind: 'box', center: [0, -0.15, 0], size: [W, 0.3, D], color: pigmentHex(inp.B), label: `Suelo: ${inp.backgroundName.toLowerCase()}` },
    // Ave posada en una rama, mirando el suelo.
    { id: 'rama', kind: 'rod', from: [-W / 2 - 1, 7, -D / 2], to: [-W / 2 + 4, 7.3, -D / 2 + 1], radius: 0.25, color: '#6b4a2b' },
    { id: 'ave', kind: 'ellipsoid', center: [-W / 2 + 2, 8, -D / 2 + 0.6], radii: [1, 0.75, 0.7], color: '#5d6670', label: 'Ave (depredador)' },
    { id: 'ave-cabeza', kind: 'sphere', center: [-W / 2 + 3, 8.6, -D / 2 + 0.9], radius: 0.45, color: '#5d6670' },
    { id: 'pico', kind: 'arrow', from: [-W / 2 + 3.4, 8.55, -D / 2 + 1.05], vector: [0.5, -0.15, 0.2], radius: 0.1, color: '#e0a030' },
  ];
  inp.sample.forEach((z, i) => {
    const p = inp.positions[i] ?? { x: 0.5, y: 0.5, angle: 0 };
    const along = Math.round(p.angle / 90) % 2 === 0;
    const c: Vec3 = [-W / 2 + 1 + p.x * (W - 2), 0.2, -D / 2 + 1 + p.y * (D - 2)];
    items.push({ id: `escarabajo-${i}`, kind: 'ellipsoid', center: c, radii: along ? [0.56, 0.28, 0.4] : [0.4, 0.28, 0.56], color: pigmentHex(z), ...(i === 0 ? { label: 'Escarabajos (muestra de 40)' } : {}) });
  });
  // Columnas por clase de color: cuántos hay y cuántos se espera que escapen.
  const counts = classCounts(inp.sample);
  const survivors = inp.measured ? counts.map((n, k) => n * survival((k + 0.5) / CLASSES, inp.B, inp.predation)) : null;
  const X0 = -W / 2 + 1.2, Z = D / 2 + 3, step = (W - 2.4) / CLASSES;
  counts.forEach((n, k) => {
    const x = X0 + (k + 0.5) * step, col = pigmentHex((k + 0.5) / CLASSES);
    items.push({ id: `base-${k}`, kind: 'box', center: [x, 0.05, Z], size: [step * 0.9, 0.1, 1.6], color: col });
    if (n > 0) items.push({ id: `columna-${k}`, kind: 'box', center: [x, 0.1 + (n * COL_H) / 2, Z], size: [step * 0.7, n * COL_H, 1.2], color: col, opacity: survivors ? 0.35 : 0.95, ...(k === counts.findIndex((m) => m > 0) ? { label: 'Escarabajos por clase de color' } : {}) });
    if (survivors && survivors[k] > 0.02) items.push({ id: `escapan-${k}`, kind: 'box', center: [x, 0.1 + (survivors[k] * COL_H) / 2, Z], size: [step * 0.45, survivors[k] * COL_H, 0.8], color: col, ...(k === counts.findIndex((m) => m > 0) ? { label: 'Escaparían de las aves' } : {}) });
  });

  const third = (lo: number, hi: number) => inp.sample.filter((z) => z >= lo && (hi >= 1 ? z <= 1 : z < hi)).length;
  const light = third(0, 1 / 3), mid = third(1 / 3, 2 / 3), dark = third(2 / 3, 1);
  const contrast = Math.abs(inp.mean - inp.B);
  const survText = survivors
    ? ` Las columnas oscuras de adentro son los que se espera que escapen en la próxima ronda: escapan ${fmt(survival(Math.min(1, Math.max(0, inp.B)), inp.B, inp.predation) * 100, 0)} % de los que tienen el color del suelo y solo ${fmt(survival(inp.B > 0.5 ? 0 : 1, inp.B, inp.predation) * 100, 0)} % de los del color más contrastado.`
    : ' Avanza una generación para ver, en cada columna, cuántos escaparían de las aves.';
  const description = `Suelo de ${inp.backgroundName.toLowerCase()} en 3D (color ${fmt(inp.B, 2)} de 0 claro a 1 oscuro), visto desde la rama del ave, con la misma muestra de 40 escarabajos del banco en la generación ${inp.generation}: ${light} claros, ${mid} intermedios y ${dark} oscuros. `
    + `${contrast < 0.1 ? 'La mayoría se confunde con el suelo: el ave los ve poco.' : `La mayoría es más ${inp.mean < inp.B ? 'clara' : 'oscura'} que el suelo: resaltan y el ave los ve con facilidad.`} Al lado, columnas con cuántos hay en cada clase de color.${survText}`;
  return { items, extent: 12, target: [0, 1.5, 2], narrow: { extent: 15, target: [0, 1.5, 2] as Vec3 }, description, counts, survivors };
}

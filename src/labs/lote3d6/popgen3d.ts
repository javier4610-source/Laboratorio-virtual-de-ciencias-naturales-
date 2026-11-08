/**
 * «popgen» (lote 3D-6): dos poblaciones en un paisaje 3D. Funciones PURAS con el MISMO resultado del modelo
 * (src/models/popgen.ts → simulatePopGen):
 *   - la isla es la población que se elige (una réplica, o la única sin deriva) en la generación que se elige; su
 *     frecuencia p de A es la del modelo y el número de copias de A, 2N·p (entero con deriva: el modelo muestrea 2N
 *     gametos);
 *   - se dibujan hasta 100 individuos con las proporciones de Hardy-Weinberg de ese p (la misma regla de los mayores
 *     restos que la poza génica del banco); cada individuo lleva sus dos alelos (azul A, naranja a);
 *   - el continente es la población de donde llegan los migrantes, con la frecuencia p_m del modelo; cuando hay migración,
 *     un puente lleva m·(individuos dibujados) migrantes por generación.
 * Dibujo: formas, paisaje y lugar de cada individuo; con N > 100 los 100 individuos son una muestra con esas proporciones.
 */
import { fmt } from '../../lib/format';
import { hardyWeinberg } from '../../models/popgen';
import type { SceneItem, Vec3 } from '../../three/scene';
import { hash01 } from './common';

export const MAX_SHOWN = 100;
const COL_A = 'series-2' as const, COL_a = 'series-1' as const;
const ISLAND: Vec3 = [8, 0, 0], CONT: Vec3 = [-12, 0, 0];

/** Individuos AA, Aa y aa entre `n` según Hardy-Weinberg (mayores restos; suman n). */
export function hwCounts(p: number, n = 100): [number, number, number] {
  const hw = hardyWeinberg(Math.min(1, Math.max(0, p)));
  const raw = [hw.AA * n, hw.Aa * n, hw.aa * n];
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k++, left--) out[order[k % 3][1]]++;
  return [out[0], out[1], out[2]];
}

/** Bolitas de los dos alelos de una lista de individuos repartidos en un disco de radio R alrededor de `c`. */
function people(prefix: string, counts: [number, number, number], c: Vec3, R: number, seed: number, label?: string): SceneItem[] {
  const A: Vec3[] = [], a: Vec3[] = [];
  let i = 0;
  counts.forEach((n, g) => {
    for (let k = 0; k < n; k++, i++) {
      const ang = 2 * Math.PI * hash01(i, seed), r = R * Math.sqrt(hash01(i, seed + 1));
      const x = c[0] + r * Math.cos(ang), z = c[2] + r * Math.sin(ang), y = c[1] + 0.7;
      const left: Vec3 = [x - 0.22, y, z], right: Vec3 = [x + 0.22, y, z];
      (g < 2 ? A : a).push(left);
      (g === 0 ? A : a).push(right);
    }
  });
  const out: SceneItem[] = [];
  if (A.length) out.push({ id: `${prefix}-A`, kind: 'particles', points: A, radius: 0.3, color: COL_A, ...(label ? { label: 'Alelo A' } : {}) });
  if (a.length) out.push({ id: `${prefix}-a`, kind: 'particles', points: a, radius: 0.3, color: COL_a, ...(label ? { label: 'Alelo a' } : {}) });
  return out;
}

export interface PopGenSceneInput {
  /** Frecuencia de A del modelo en la población y generación elegidas. */
  p: number;
  n: number;
  generation: number;
  replicate: number;
  replicates: number;
  drift: boolean;
  migration: number;
  migrantP: number;
}

export function popGenScene(inp: PopGenSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; shown: number; counts: [number, number, number]; copiesA: number; migrants: number } {
  const shown = Math.min(inp.n, MAX_SHOWN);
  const counts = hwCounts(inp.p, shown);
  const copiesA = Math.round(2 * inp.n * inp.p);
  const migrants = inp.migration > 0 ? Math.max(1, Math.round(inp.migration * shown)) : 0;
  const items: SceneItem[] = [
    { id: 'mar', kind: 'plane', center: [-2, -0.05, 0], size: [44, 26], color: '#5aa9de', opacity: 0.55 },
    { id: 'isla', kind: 'rod', from: [ISLAND[0], -0.05, ISLAND[2]], to: [ISLAND[0], 0.4, ISLAND[2]], radius: 7.2, color: '#9cc27a', label: inp.drift ? `Isla: población ${inp.replicate + 1}` : 'Isla: la población' },
    { id: 'continente', kind: 'rod', from: [CONT[0], -0.05, CONT[2]], to: [CONT[0], 0.4, CONT[2]], radius: 6, color: '#c9b27a', label: 'Continente: origen de los migrantes' },
    ...people('isla', counts, [ISLAND[0], 0.4, ISLAND[2]], 6.4, 7, 'azul'),
    ...people('cont', hwCounts(inp.migrantP, 60), [CONT[0], 0.4, CONT[2]], 5.2, 13),
  ];
  if (migrants) {
    items.push({ id: 'puente', kind: 'box', center: [-2.5, 0.25, 0], size: [8, 0.3, 1.6], color: '#8d6b45', label: `Migrantes: ${fmt(inp.migration * 100, 0)} % por generación` });
    const mc = hwCounts(inp.migrantP, migrants);
    const pts = { A: [] as Vec3[], a: [] as Vec3[] };
    let i = 0;
    mc.forEach((n, g) => { for (let k = 0; k < n; k++, i++) {
      const x = -6 + (7 * (i + 0.5)) / migrants, z = (i % 2 ? 0.35 : -0.35);
      (g < 2 ? pts.A : pts.a).push([x - 0.15, 1, z]);
      (g === 0 ? pts.A : pts.a).push([x + 0.15, 1, z]);
    } });
    if (pts.A.length) items.push({ id: 'migr-A', kind: 'particles', points: pts.A, radius: 0.18, color: COL_A });
    if (pts.a.length) items.push({ id: 'migr-a', kind: 'particles', points: pts.a, radius: 0.18, color: COL_a });
    items.push({ id: 'flujo', kind: 'arrow', from: [-6, 1.9, 0], vector: [7.5, 0, 0], radius: 0.12, color: 'ink-2' });
  }
  const sample = inp.n > MAX_SHOWN ? ` (muestra de ${MAX_SHOWN} de los ${inp.n.toLocaleString('es-CO')} individuos, con las proporciones de Hardy-Weinberg)` : '';
  const description = `Paisaje en 3D con dos poblaciones. Isla${inp.drift ? `, población ${inp.replicate + 1} de ${inp.replicates}` : ''}, generación ${inp.generation}: p = ${fmt(inp.p, 3)}, es decir ${copiesA.toLocaleString('es-CO')} copias del alelo A de ${(2 * inp.n).toLocaleString('es-CO')}. `
    + `Se dibujan ${counts[0]} AA, ${counts[1]} Aa y ${counts[2]} aa${sample}; cada individuo lleva sus dos alelos (azul A, naranja a). `
    + (inp.p >= 1 - 1e-12 ? 'El alelo A está fijado: ya no hay a en la isla. ' : inp.p <= 1e-12 ? 'El alelo A se perdió: solo queda a en la isla. ' : '')
    + (migrants ? `Del continente (p = ${fmt(inp.migrantP, 2)}) llegan por el puente ${migrants} migrantes por cada ${shown} individuos en cada generación: el flujo génico acerca la frecuencia de la isla a la del continente.` : 'Sin migración: el continente no intercambia individuos con la isla.');
  return { items, extent: 14, target: [-2, 1, 0], narrow: { extent: 17, target: [-2, 1, 0] as Vec3 }, description, shown, counts, copiesA, migrants };
}

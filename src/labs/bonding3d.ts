/**
 * Escenas 3D de la práctica de enlace químico (kit src/three). Funciones PURAS.
 *  - Polaridad: la MISMA geometría 3D de la molécula que muestra el visor molecular (confórmero de PubChem o VSEPR del
 *    kit), con cada átomo coloreado según su carga parcial cualitativa (δ− rojo, δ+ azul, casi neutro gris), los dipolos
 *    de enlace (flechas hacia el átomo más electronegativo, ∝ ΔEN de Pauling) y el dipolo neto (su suma vectorial).
 *  - Mar de electrones del cobre: cationes Cu⁺ en una red cúbica centrada en las caras (a = 3,6150 Å, Wyckoff 1963) y
 *    los electrones de valencia (uno por átomo) repartidos al azar con semilla: ilustración del enlace metálico.
 */
import { fmt } from '../lib/format';
import type { ColorToken } from '../three/colors';
import type { SceneItem, Vec3 } from '../three/scene';
import { ballRadius } from '../chem/elements';
import type { Species3D } from '../chem/species';
import { moleculePolarity, type PolarityResult } from '../models/chemicalBonding';
import { seededRandom } from '../models/math';

export interface BondScene { items: SceneItem[]; extent: number; target: Vec3; description: string }

/** Color de un átomo según su carga parcial cualitativa (umbral 0,15 en unidades de ΔEN). */
export function partialToken(q: number): ColorToken {
  return q < -0.15 ? 'series-1' : q > 0.15 ? 'series-2' : 'series-8';
}
export const partialText = (q: number) => (q < -0.15 ? 'δ−' : q > 0.15 ? 'δ+' : 'casi neutro');

export function polarityScene(s: Species3D, label: string): BondScene & { polarity: PolarityResult } {
  const pol = moleculePolarity(s.atoms, s.bonds);
  const n = s.atoms.length || 1;
  const c: Vec3 = [s.atoms.reduce((t, a) => t + a.x, 0) / n, s.atoms.reduce((t, a) => t + a.y, 0) / n, s.atoms.reduce((t, a) => t + a.z, 0) / n];
  const P = (i: number): Vec3 => [s.atoms[i].x - c[0], s.atoms[i].y - c[1], s.atoms[i].z - c[2]];
  const items: SceneItem[] = [];
  s.atoms.forEach((a, i) => {
    const q = pol.partial[i];
    items.push({ id: `at-${i}`, kind: 'sphere', center: P(i), radius: ballRadius(a.el) * 1.25, color: partialToken(q), label: `${a.el} ${partialText(q)}${Math.abs(q) > 0.15 ? ` (${fmt(Math.abs(q), 2)})` : ''}` });
  });
  s.bonds.forEach((b, k) => items.push({ id: `en-${k}`, kind: 'rod', from: P(b.a), to: P(b.b), radius: 0.09, color: 'ink-3' }));
  // Dipolos de enlace: flecha desde el punto medio, hacia el átomo más electronegativo; 1 unidad de ΔEN = 0,7 Å.
  const K = 0.7;
  pol.bondDipoles.forEach((d, k) => {
    if (d.dEN < 0.05) return;
    const a = P(d.a), b = P(d.b);
    const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const v: Vec3 = [d.vector[0] * K, d.vector[1] * K, d.vector[2] * K];
    items.push({ id: `dip-${k}`, kind: 'arrow', from: [mid[0] - v[0] / 2, mid[1] - v[1] / 2 + 0.45, mid[2] - v[2] / 2], vector: v, radius: 0.045, color: 'series-5' });
  });
  const total = pol.bondDipoles.reduce((t, d) => t + d.dEN, 0);
  if (pol.polar) {
    const v: Vec3 = [pol.net[0] * K, pol.net[1] * K, pol.net[2] * K];
    items.push({ id: 'neto', kind: 'arrow', from: [-v[0] / 2, -v[1] / 2, -v[2] / 2], vector: v, radius: 0.08, color: 'data', label: `dipolo neto (${fmt(pol.netMagnitude, 2)})` });
  }
  const ext = Math.max(1.6, ...s.atoms.map((_, i) => Math.hypot(...P(i)))) + 0.55;
  const description = `${label} en 3D con sus cargas parciales: ${s.atoms.map((a, i) => `${a.el} ${partialText(pol.partial[i])}`).join(', ')}. ` +
    (total < 0.05 ? 'Los enlaces no son polares: no hay dipolos. Molécula no polar.' : pol.polar
      ? `Los dipolos de enlace (flechas hacia el átomo más electronegativo) no se cancelan: dipolo neto ${fmt(pol.netMagnitude, 2)} (en unidades de ΔEN). Molécula polar.`
      : 'Los enlaces son polares, pero por la simetría de la molécula sus dipolos se cancelan: dipolo neto ≈ 0. Molécula no polar.');
  return { items, extent: ext, target: [0, 0, 0], description, polarity: pol };
}

/** Constante de red del cobre (Å), Wyckoff (1963), y los cuatro sitios de la red cúbica centrada en las caras. */
export const CU_A = 3.615;
const FCC: Vec3[] = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];

export function metalScene(seed = 1): BondScene {
  const items: SceneItem[] = [];
  const cores: Vec3[] = [];
  const n = 2;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) for (const f of FCC) {
    const p: Vec3 = [(i + f[0]) * CU_A, (j + f[1]) * CU_A, (k + f[2]) * CU_A];
    if (p.every((v) => v <= n * CU_A + 1e-9)) cores.push(p);
  }
  const off = (n * CU_A) / 2;
  const C = cores.map((p) => [p[0] - off, p[1] - off, p[2] - off] as Vec3);
  items.push({ id: 'cationes', kind: 'particles', points: C, radius: 0.55, color: '#b87333', label: `${C.length} iones Cu⁺ (red cúbica de caras centradas)` });
  const rand = seededRandom(seed);
  const e: Vec3[] = Array.from({ length: C.length }, () => [(rand() - 0.5) * 2 * off, (rand() - 0.5) * 2 * off, (rand() - 0.5) * 2 * off]);
  items.push({ id: 'electrones', kind: 'particles', points: e, radius: 0.18, color: 'series-2', label: 'electrones deslocalizados (uno por átomo)' });
  items.push({ id: 'celda', kind: 'box', center: [-off + CU_A / 2, -off + CU_A / 2, -off + CU_A / 2], size: [CU_A, CU_A, CU_A], color: 'ink-3', opacity: 0.08, edges: true, label: `celda: a = ${fmt(CU_A, 3)} Å` });
  return {
    items, extent: off * 1.9, target: [0, 0, 0],
    description: `Cobre en 3D: ${C.length} iones Cu⁺ ordenados en una red cúbica de caras centradas (a = ${fmt(CU_A, 3)} Å) y ${e.length} electrones de valencia que no pertenecen a ningún átomo: forman un «mar» que se mueve por toda la red. Por eso el cobre conduce la electricidad en estado sólido.`,
  };
}

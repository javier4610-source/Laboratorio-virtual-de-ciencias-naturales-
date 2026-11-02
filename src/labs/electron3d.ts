/**
 * Orbitales en 3D (kit src/three) para «Configuración electrónica». Funciones PURAS: cada orbital ocupado del diagrama de
 * cajas del estudiante se dibuja como una nube de puntos muestreada con |ψ|² del hidrógeno (modelo en
 * src/models/electronConfiguration.ts). Los orbitales se llenan a medida que se agregan electrones: con 1 electrón la
 * nube es tenue, con 2 es intensa. Ejes del orbital → escena: x → x, z → vertical (y de la escena), y → −z.
 */
import { boxById, boxesOf, ORDER, sampleOrbital, type Boxes } from '../models/electronConfiguration';
import type { SceneColor } from '../three/colors';
import type { SceneItem, Vec3 } from '../three/scene';

export type OrbitalView = 'valencia' | 'todos' | 'subnivel';
/** Puntos por orbital (suficientes para ver la forma; la escena se mantiene liviana). */
export const POINTS_PER_ORBITAL = 90;
/** Escala radial comprimida: r (a₀) → 0,9·√r unidades de la escena. */
export const radialScale = (r: number) => 0.9 * Math.sqrt(r);

const COLOR: Record<string, SceneColor> = {
  s: 'series-1', px: 'series-2', py: 'series-3', pz: 'series-5', dxy: 'series-4', dyz: 'series-6', 'dz²': 'series-7', dxz: 'series-8', 'dx²−y²': 'qui',
};
const cache = new Map<string, Vec3[]>();
/** Puntos de un orbital ya en coordenadas de la escena (memorizados: la nube no cambia entre cuadros). */
export function orbitalPoints(boxId: string): Vec3[] {
  const hit = cache.get(boxId);
  if (hit) return hit;
  const b = boxById(boxId);
  const seed = 1000 * b.n + 100 * b.l + 10 * (b.ml + 2) + 7;
  const pts = sampleOrbital(b.n, b.l, b.ml, POINTS_PER_ORBITAL, seed).map(([x, y, z]): Vec3 => {
    const r = Math.hypot(x, y, z) || 1e-9;
    const k = radialScale(r) / r;
    return [x * k, z * k, -y * k];
  });
  cache.set(boxId, pts);
  return pts;
}

const spinText = (s: number[]) => s.map((x) => (x > 0 ? '↑' : '↓')).join('');

export interface OrbitalSceneInput { boxes: Boxes; view: OrbitalView }
export interface OrbitalScene { items: SceneItem[]; extent: number; target: Vec3; description: string; shown: string[] }

/** Qué orbitales se dibujan: la capa de valencia (n mayor y el (n − 1)d), todos los ocupados o el último subnivel. */
export function shownOrbitals(boxes: Boxes, view: OrbitalView): string[] {
  const occupied = ORDER.flatMap(boxesOf).filter((b) => (boxes[b.id] ?? []).length > 0);
  if (!occupied.length) return [];
  if (view === 'todos') return occupied.map((b) => b.id);
  const lastSub = [...ORDER].reverse().find((s) => boxesOf(s).some((b) => (boxes[b.id] ?? []).length > 0))!;
  if (view === 'subnivel') return occupied.filter((b) => b.sub === lastSub.key).map((b) => b.id);
  const nMax = Math.max(...occupied.map((b) => b.n));
  return occupied.filter((b) => b.n === nMax || (b.l === 2 && b.n === nMax - 1) || b.sub === lastSub.key).map((b) => b.id);
}

export function orbitalScene({ boxes, view }: OrbitalSceneInput): OrbitalScene {
  const items: SceneItem[] = [{ id: 'nucleo', kind: 'sphere', center: [0, 0, 0], radius: 0.16, color: 'ink', label: 'núcleo' }];
  const shown = shownOrbitals(boxes, view);
  const inner = ORDER.flatMap(boxesOf).filter((b) => (boxes[b.id] ?? []).length > 0 && !shown.includes(b.id));
  if (inner.length) {
    const rIn = Math.max(...inner.map((b) => radialScale((3 * b.n * b.n - b.l * (b.l + 1)) / 2)));
    items.push({ id: 'internas', kind: 'sphere', center: [0, 0, 0], radius: rIn, color: 'ink-3', opacity: 0.12, label: `orbitales internos (${inner.reduce((a, b) => a + (boxes[b.id] ?? []).length, 0)} e⁻)` });
  }
  for (const id of shown) {
    const b = boxById(id);
    const spins = boxes[id] ?? [];
    items.push({
      id: `orb-${id}`, kind: 'particles', points: orbitalPoints(id), radius: b.l === 0 ? 0.11 : 0.1,
      color: COLOR[b.real] ?? 'accent', opacity: spins.length >= 2 ? 0.9 : 0.4,
      label: `${b.n}${b.real} ${spinText(spins)}`,
    });
  }
  // ejes de referencia (x, y, z del orbital)
  items.push({ id: 'eje-x', kind: 'arrow', from: [0, 0, 0], vector: [4.6, 0, 0], radius: 0.015, color: 'line-strong', label: 'x' });
  items.push({ id: 'eje-z', kind: 'arrow', from: [0, 0, 0], vector: [0, 4.6, 0], radius: 0.015, color: 'line-strong', label: 'z' });
  items.push({ id: 'eje-y', kind: 'arrow', from: [0, 0, 0], vector: [0, 0, -4.6], radius: 0.015, color: 'line-strong', label: 'y' });
  const list = shown.map((id) => { const b = boxById(id); return `${b.n}${b.real} con ${(boxes[id] ?? []).length === 2 ? '2 electrones' : '1 electrón'}`; });
  const description = shown.length === 0
    ? 'Solo el núcleo: todavía no hay electrones en el diagrama de cajas.'
    : `Nubes de probabilidad de ${shown.length} orbital${shown.length > 1 ? 'es' : ''}: ${list.join('; ')}. Los orbitales s son esféricos; los p tienen dos lóbulos a lo largo de x, y o z; los d tienen cuatro lóbulos (el dz², dos lóbulos y un anillo).` +
      (inner.length ? ` La esfera tenue representa los ${inner.length} orbitales internos ocupados.` : '') + ' Nube intensa: orbital con 2 electrones; tenue: con 1.';
  return { items, extent: 5, target: [0, 0, 0], description, shown };
}

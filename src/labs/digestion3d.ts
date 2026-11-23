/**
 * Tubo digestivo en 3D (kit src/three), con el MISMO modelo del laboratorio (src/models/digestion.ts): cada tramo
 * tiene el color de su pH (ácido, ligeramente ácido, neutro o ligeramente básico) y el bolo de alimento avanza por
 * los tramos con el tiempo del recorrido; en el bolo, el número de partículas de almidón, proteínas y grasas es
 * proporcional a la fracción que aún no se ha digerido. La forma y el tamaño de los órganos son un ESQUEMA (no
 * anatomía a escala) y las partículas no son moléculas.
 */
import { fmt } from '../lib/format';
import { seededRandom } from '../models/math';
import { mealAt, type MealResult, type Nutrient } from '../models/digestion';
import type { SceneColor } from '../three/colors';
import type { SceneItem, Vec3 } from '../three/scene';

export const N_PER_NUTRIENT = 12;

/** Color según el pH (escala por intervalos, igual en la leyenda). */
export function pHColor(pH: number): SceneColor {
  if (pH < 3.5) return 'bad';
  if (pH < 6.5) return 'warn';
  if (pH <= 7.2) return 'ok';
  return 'info';
}

/** Recorrido del bolo: punto inicial y final de cada tramo (en el orden de SEGMENTS). */
export const PATH: [Vec3, Vec3][] = [
  [[0, 3.1, 0], [0.1, 2.7, 0]], // boca
  [[0.45, 1.85, 0], [0.6, 1.65, 0]], // estómago (fondo)
  [[0.6, 1.65, 0], [0.95, 1.3, 0]], // estómago mezclado
  [[1.05, 1.2, 0], [0.95, 0.85, 0]], // duodeno
  [[0.7, 0.75, 0], [-0.4, 0.15, 0]], // yeyuno e íleon
  [[-0.9, 0.1, 0], [-0.9, -0.6, 0]], // intestino grueso
];

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function digestionScene(r: MealResult, minute: number): { items: SceneItem[]; extent: number; target: Vec3; description: string; at: ReturnType<typeof mealAt> } {
  const at = mealAt(r, minute);
  const ph = (i: number) => r.segments[i].pH;
  const lab = (i: number, name: string) => `${name}: pH ${fmt(ph(i), 1)}`;
  const items: SceneItem[] = [
    { id: 'boca', kind: 'ellipsoid', center: [0, 3.05, 0], radii: [0.35, 0.18, 0.25], color: pHColor(ph(0)), opacity: 0.45, label: lab(0, 'boca'), tag: `boca pH ${fmt(ph(0), 1)}` },
    { id: 'esofago', kind: 'rod', from: [0.05, 2.9, 0], to: [0.4, 1.95, 0], radius: 0.07, color: 'line-strong', opacity: 0.5, label: 'esófago', tag: '' },
    { id: 'estomago', kind: 'ellipsoid', center: [0.7, 1.55, 0], radii: [0.5, 0.36, 0.3], color: pHColor(ph(2)), opacity: 0.35, label: lab(2, 'estómago'), tag: `estómago pH ${fmt(ph(2), 1)}` },
    { id: 'duodeno', kind: 'rod', from: [1.05, 1.25, 0], to: [0.95, 0.8, 0], radius: 0.11, color: pHColor(ph(3)), opacity: 0.5, label: lab(3, 'duodeno'), tag: `duodeno pH ${fmt(ph(3), 1)}` },
    { id: 'higado', kind: 'ellipsoid', center: [1.55, 1.75, -0.2], radii: [0.42, 0.22, 0.3], color: 'series-6', opacity: 0.35, label: 'hígado y vesícula (bilis)', tag: 'bilis' },
    { id: 'pancreas', kind: 'ellipsoid', center: [1.45, 1.05, -0.2], radii: [0.32, 0.08, 0.1], color: 'series-4', opacity: 0.55, label: 'páncreas (amilasa, tripsina y lipasa)', tag: 'páncreas' },
  ];
  // Intestino delgado: zigzag de varillas.
  const zz: Vec3[] = [[0.7, 0.75, 0], [-0.3, 0.7, 0.05], [0.6, 0.5, 0], [-0.3, 0.42, 0.05], [0.5, 0.25, 0], [-0.4, 0.15, 0]];
  for (let i = 0; i < zz.length - 1; i++) items.push({ id: `delgado-${i}`, kind: 'rod', from: zz[i], to: zz[i + 1], radius: 0.07, color: pHColor(ph(4)), opacity: 0.5, label: i === 0 ? lab(4, 'yeyuno e íleon') : undefined, tag: i === 0 ? `íleon pH ${fmt(ph(4), 1)}` : '' });
  // Intestino grueso: marco alrededor.
  const gg: Vec3[] = [[0.95, -0.3, 0], [0.95, 0.95, 0], [-0.9, 0.95, 0], [-0.9, -0.6, 0]];
  for (let i = 0; i < gg.length - 1; i++) items.push({ id: `grueso-${i}`, kind: 'rod', from: gg[i], to: gg[i + 1], radius: 0.13, color: pHColor(ph(5)), opacity: 0.22, label: i === 0 ? lab(5, 'intestino grueso') : undefined, tag: i === 1 ? 'intestino grueso' : '' });
  // Bolo: partículas alrededor del punto actual, en número proporcional a lo que queda sin digerir.
  const [a, b] = PATH[at.index];
  const c = lerp(a, b, at.within);
  const colors: Record<Nutrient, SceneColor> = { almidon: 'series-2', proteina: 'series-1', grasa: 'series-6' };
  const names: Record<Nutrient, string> = { almidon: 'almidón sin digerir', proteina: 'proteínas sin digerir', grasa: 'grasas sin digerir' };
  const rnd = seededRandom(3);
  for (const n of ['almidon', 'proteina', 'grasa'] as Nutrient[]) {
    const count = Math.round(N_PER_NUTRIENT * at.remaining[n]);
    const pts: Vec3[] = [];
    for (let i = 0; i < N_PER_NUTRIENT; i++) {
      const p: Vec3 = [c[0] + (rnd() - 0.5) * 0.3, c[1] + (rnd() - 0.5) * 0.3, c[2] + (rnd() - 0.5) * 0.3];
      if (i < count) pts.push(p);
    }
    if (pts.length) items.push({ id: `bolo-${n}`, kind: 'particles', points: pts, radius: 0.045, color: colors[n], label: `${names[n]} (${fmt(at.remaining[n] * 100, 0)} %)`, tag: '' });
  }
  const seg = r.segments[at.index];
  const description = `A los ${fmt(Math.min(minute, r.totalMinutes), 0)} minutos de comer, el alimento está en ${seg.segment.name.toLowerCase()} (pH ${fmt(seg.pH, 1)}). `
    + `Queda sin digerir el ${fmt(at.remaining.almidon * 100, 0)} % del almidón, el ${fmt(at.remaining.proteina * 100, 0)} % de las proteínas y el ${fmt(at.remaining.grasa * 100, 0)} % de las grasas. `
    + 'Los colores de los órganos indican su pH; la forma del tubo es un esquema y las partículas no son moléculas.';
  return { items, extent: 2.3, target: [0.3, 1.2, 0], description, at };
}

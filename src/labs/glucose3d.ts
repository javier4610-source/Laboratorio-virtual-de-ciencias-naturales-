/**
 * Glucosa, insulina y glucagón en 3D (kit src/three). Funciones PURAS con el MISMO modelo del laboratorio (modelo mínimo
 * de Bergman con sus extensiones): un vaso sanguíneo con partículas de glucosa cuyo NÚMERO es proporcional a la
 * concentración (1 partícula por cada 8 mg/dL), de insulina (1 por cada 3 µU/mL) y de glucagón (1 por cada 10 pg/mL), que
 * avanzan con la sangre; y el intestino, el hígado, el páncreas y el músculo con flechas cuya longitud es proporcional a
 * los flujos del modelo en ese minuto (escala fija). Los órganos son un esquema, no anatomía a escala.
 */
import { fmt } from '../lib/format';
import { seededRandom } from '../models/math';
import { fluxesAt, type GlucoseRun, type GlucoseState } from '../models/glucose';
import { arrowScale, type SceneItem, type Vec3 } from '../three/scene';

export const PER_GLUCOSE = 8; // mg/dL por partícula
export const PER_INSULIN = 3; // µU/mL por partícula
export const PER_GLUCAGON = 10; // pg/mL por partícula
/** Flujos de glucosa: 10 mg/dL por minuto = 1,2 unidades. Secreción de insulina: 8 µU/mL por minuto = 1 unidad. */
export const K_GLUCOSE = arrowScale(10, 1.2);
export const K_INSULIN = arrowScale(8, 1);
const HALF = 3; // el vaso va de x = −3 a x = 3
const TUBE = 0.42;

const counts = (s: GlucoseState) => ({ glucose: Math.round(s.G / PER_GLUCOSE), insulin: Math.round(s.I / PER_INSULIN), glucagon: Math.round(s.N / PER_GLUCAGON) });

/** Partículas en el tubo con posiciones fijas por índice (semilla) que avanzan con la sangre según `flow` (unidades). */
function inTube(n: number, seed: number, flow: number): Vec3[] {
  const rnd = seededRandom(seed);
  const pts: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const x0 = rnd() * 2 * HALF, a = rnd() * 2 * Math.PI, r = Math.sqrt(rnd()) * (TUBE - 0.1);
    const x = ((x0 + flow) % (2 * HALF) + 2 * HALF) % (2 * HALF) - HALF;
    pts.push([x, r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

export function glucoseScene(run: GlucoseRun, s: GlucoseState): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const f = fluxesAt(run, s);
  const n = counts(s);
  const flow = s.t * 0.05;
  const items: SceneItem[] = [
    { id: 'vaso', kind: 'rod', from: [-HALF - 0.1, 0, 0], to: [HALF + 0.1, 0, 0], radius: TUBE, color: 'bad', opacity: 0.16, label: 'vaso sanguíneo' },
    { id: 'higado', kind: 'ellipsoid', center: [-1.2, 1.55, 0], radii: [0.95, 0.42, 0.5], color: '#8b3a2e', label: 'hígado' },
    { id: 'pancreas', kind: 'ellipsoid', center: [1.4, 1.35, 0], radii: [0.85, 0.17, 0.22], color: '#d9a07a', label: 'páncreas' },
    { id: 'musculo', kind: 'ellipsoid', center: [1.7, -1.55, 0], radii: [0.95, 0.38, 0.42], color: '#b5524a', label: 'músculo y tejido adiposo' },
  ];
  // Intestino: un tubo en zigzag bajo el vaso, a la izquierda.
  const gut: Vec3[] = [[-2.8, -1.2, 0], [-2.2, -1.9, 0], [-1.6, -1.2, 0], [-1.0, -1.9, 0], [-0.5, -1.25, 0]];
  for (let k = 0; k + 1 < gut.length; k++) items.push({ id: `intestino-${k}`, kind: 'rod', from: gut[k], to: gut[k + 1], radius: 0.17, color: '#d9a59a', ...(k === 0 ? { label: 'intestino' } : {}) });
  const gutLeft = run.meal.grams > 0 ? s.Q / (run.meal.grams * 1000) : 0;
  if (gutLeft > 0.02) items.push({ id: 'comida', kind: 'particles', points: inTube(Math.max(1, Math.round(gutLeft * 12)), 7, 0).map(([x, y, z]): Vec3 => [-1.65 + x * 0.33, -1.55 + y * 0.6, z * 0.6]), radius: 0.07, color: 'warn', opacity: 0.8 });
  if (n.glucose > 0) items.push({ id: 'glucosa', kind: 'particles', points: inTube(n.glucose, 11, flow), radius: 0.075, color: 'warn', label: 'glucosa' });
  if (n.insulin > 0) items.push({ id: 'insulina', kind: 'particles', points: inTube(n.insulin, 23, flow), radius: 0.05, color: 'series-2', label: 'insulina' });
  if (n.glucagon > 0) items.push({ id: 'glucagon', kind: 'particles', points: inTube(n.glucagon, 37, flow), radius: 0.05, color: 'series-4', label: 'glucagón' });
  const arrow = (id: string, from: Vec3, dir: Vec3, value: number, k: number, color: SceneItem['color'], label: string) => {
    const len = value * k;
    if (len < 0.03) return;
    items.push({ id, kind: 'arrow', from, vector: [dir[0] * len, dir[1] * len, dir[2] * len], radius: 0.06, color, label });
  };
  arrow('entrada-intestino', [-0.5, -1.2, 0], [0, 1, 0], f.gut, K_GLUCOSE, 'warn', 'glucosa que entra del intestino');
  arrow('salida-higado', [-1.2, 1.1, 0], [0, -1, 0], f.liver, K_GLUCOSE, 'warn', 'glucosa que libera el hígado');
  arrow('captacion', [1.7, -0.45, 0], [0, -1, 0], f.uptake, K_GLUCOSE, 'ok', 'glucosa que captan los tejidos');
  arrow('secrecion-insulina', [1.4, 1.15, 0], [0, -1, 0], f.secretion, K_INSULIN, 'series-2', 'insulina que secreta el páncreas');
  const ex = f.exercising ? ' Hay ejercicio: los músculos captan glucosa extra.' : '';
  const description = `Minuto ${fmt(s.t, 0)}: glucosa ${fmt(s.G, 0)} mg/dL (${n.glucose} partículas en el vaso, una por cada ${PER_GLUCOSE} mg/dL), insulina ${fmt(s.I, 1)} µU/mL (${n.insulin} partículas) y glucagón ${fmt(s.N, 0)} pg/mL (${n.glucagon} partículas). Del intestino entran ${fmt(f.gut, 2)} mg/dL por minuto, el hígado libera ${fmt(f.liver, 2)} y los tejidos captan ${fmt(f.uptake, 2)}; el páncreas secreta ${fmt(f.secretion, 2)} µU/mL de insulina por minuto.${ex} Las flechas miden lo que cada flujo.`;
  return { items, extent: 2.6, target: [0, 0, 0], description };
}

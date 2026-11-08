/**
 * «cinematica» (lote 3D-6): la ciclorruta de 50 m en 3D, en metros, con el ciclista, sus vectores y una «pared» x–t.
 * Funciones PURAS con el MISMO resultado del modelo (src/models/kinematics.ts → simulateRun, stateAt, sampleCurve) en el
 * mismo instante del banco:
 *   - el ciclista está en x(t) del modelo; la flecha v mide ∝ v(t) (escala fija por corrida: la mayor rapidez del
 *     recorrido mide V_LEN) y la flecha a, ∝ la aceleración elegida (escala fija: 3 m/s² = A_LEN), que desaparece cuando
 *     el ciclista se detiene o llega al final de la pista (allí ya no acelera);
 *   - las fotos estroboscópicas son las del banco (cada 0,5 s, solo las ya tomadas), cada una con su flecha v;
 *   - detrás de la pista, una pared con la gráfica x–t girada: cada foto está sobre su posición x y a una altura
 *     proporcional a su instante t (el tiempo sube). La curva continua del modelo aparece al terminar, como las gráficas
 *     del banco; la del reto, si hay uno, siempre.
 * Dibujo: la bicicleta, la escala de la pared (T_LEN de alto para la duración del gráfico) y los colores.
 */
import { fmt } from '../../lib/format';
import { KIN_LIMITS, TRACK_LENGTH, type StrobePoint } from '../../models/kinematics';
import type { SceneItem, Vec3 } from '../../three/scene';
import { polyRods } from '../lote3d5/common';

export const V_LEN = 6; // m de flecha para la mayor rapidez del recorrido
export const A_LEN = 3; // m de flecha para |a| = 3 m/s²
export const T_LEN = 8; // m de alto de la pared x–t para la duración del gráfico
const WALL_Z = -4, ROAD_Y = 0;

export interface KinematicsSceneInput {
  /** Posición (m), velocidad (m/s) y tiempo (s) del banco en este instante. */
  x: number;
  v: number;
  t: number;
  acceleration: number;
  /** Mayor rapidez del recorrido (m/s), para la escala fija de la flecha v. */
  vMax: number;
  /** Fotos ya tomadas (las del banco) y la curva continua del modelo. */
  strobe: readonly StrobePoint[];
  curve: readonly StrobePoint[];
  target: readonly StrobePoint[];
  /** Duración del eje t del gráfico (s): la del banco. */
  tMax: number;
  stopped: boolean;
  atEnd: boolean;
  started: boolean;
  running: boolean;
  done: boolean;
  finalSpeed: number;
  distance: number;
  time: number;
}

export const vScale = (vMax: number) => (vMax > 1e-9 ? V_LEN / vMax : 0);
export const A_SCALE = A_LEN / Math.max(Math.abs(KIN_LIMITS.acceleration[0]), Math.abs(KIN_LIMITS.acceleration[1]));
/** Altura (m) en la pared para el instante t. */
export const wallY = (t: number, tMax: number) => 0.3 + (T_LEN * t) / Math.max(1e-9, tMax);

function bike(x: number): SceneItem[] {
  return [
    { id: 'rueda-t', kind: 'rod', from: [x - 0.55, 0.35, -0.04], to: [x - 0.55, 0.35, 0.04], radius: 0.35, color: '#2a2f32' },
    { id: 'rueda-d', kind: 'rod', from: [x + 0.55, 0.35, -0.04], to: [x + 0.55, 0.35, 0.04], radius: 0.35, color: '#2a2f32' },
    { id: 'cuadro', kind: 'rod', from: [x - 0.55, 0.4, 0], to: [x + 0.45, 0.85, 0], radius: 0.05, color: '#d23c35' },
    { id: 'ciclista', kind: 'ellipsoid', center: [x - 0.1, 1.25, 0], radii: [0.2, 0.32, 0.16], color: 'series-1', label: 'Ciclista' },
    { id: 'casco', kind: 'sphere', center: [x + 0.05, 1.68, 0], radius: 0.14, color: '#f2c94c' },
  ];
}

export function kinematicsScene(inp: KinematicsSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; vLen: number; aLen: number } {
  const kv = vScale(inp.vMax);
  // Detenido (frenó hasta v = 0, o nunca arrancó) o al final de la pista: ya no acelera.
  const accelerating = inp.stopped || inp.atEnd ? 0 : inp.acceleration;
  const items: SceneItem[] = [
    { id: 'anden', kind: 'plane', center: [25, -0.02, -1], size: [62, 16], color: '#7aa36a' },
    { id: 'ciclorruta', kind: 'plane', center: [25, ROAD_Y, 0], size: [TRACK_LENGTH, 2.4], color: '#8a8f94' },
    { id: 'fin', kind: 'box', center: [TRACK_LENGTH, 0.6, 0], size: [0.1, 1.2, 2.6], color: 'bad', opacity: 0.8, label: 'Fin de la pista (50 m)' },
    { id: 'pared', kind: 'box', center: [25, 0.3 + T_LEN / 2 + 0.2, WALL_Z - 0.05], size: [TRACK_LENGTH, T_LEN + 0.6, 0.04], color: 'surface-2', opacity: 0.55, label: 'Pared x–t (el tiempo sube)' },
  ];
  // Cinta métrica (marcas cada 5 m) y eje del tiempo de la pared (marcas cada segundo).
  for (let m = 0; m <= TRACK_LENGTH; m += 5) items.push({ id: `marca-${m}`, kind: 'rod', from: [m, 0.02, 1.3], to: [m, 0.02, m % 10 === 0 ? 2.2 : 1.8], radius: 0.05, color: 'ink-2', ...(m % 25 === 0 ? { label: `${m} m` } : {}) });
  for (let s = 0; s <= Math.floor(inp.tMax + 1e-9); s++) items.push({ id: `seg-${s}`, kind: 'rod', from: [-0.6, wallY(s, inp.tMax), WALL_Z], to: [0, wallY(s, inp.tMax), WALL_Z], radius: 0.04, color: 'ink-2', ...(s === Math.floor(inp.tMax + 1e-9) ? { label: `t = ${fmt(s, 0)} s` } : {}) });
  items.push({ id: 'eje-t', kind: 'rod', from: [0, 0.3, WALL_Z], to: [0, wallY(inp.tMax, inp.tMax), WALL_Z], radius: 0.05, color: 'ink-2' });
  items.push(...bike(inp.x));
  // Vectores sobre el ciclista.
  if (inp.v * kv > 0.05) items.push({ id: 'v', kind: 'arrow', from: [inp.x, 2.1, 0], vector: [inp.v * kv, 0, 0], radius: 0.08, color: 'series-2', label: inp.done ? `v = ${fmt(inp.finalSpeed, 2)} m/s` : 'v (velocidad)' });
  if (Math.abs(accelerating) * A_SCALE > 0.05) items.push({ id: 'a', kind: 'arrow', from: [inp.x, 2.7, 0], vector: [accelerating * A_SCALE, 0, 0], radius: 0.08, color: 'data', label: `a = ${fmt(inp.acceleration, 1)} m/s²` });
  // Fotos estroboscópicas y sus puntos en la pared.
  inp.strobe.forEach((p, i) => {
    items.push({ id: `foto-${i}`, kind: 'sphere', center: [p.x, 1.2, 0.9], radius: 0.22, color: 'data', opacity: 0.45, ...(i === 0 ? { label: 'Fotos cada 0,5 s' } : {}) });
    if (p.v * kv > 0.05) items.push({ id: `foto-v-${i}`, kind: 'arrow', from: [p.x, 1.2, 0.9], vector: [p.v * kv * 0.5, 0, 0], radius: 0.04, color: 'series-2', opacity: 0.6 });
  });
  if (inp.strobe.length) items.push({ id: 'puntos-xt', kind: 'particles', points: inp.strobe.map((p) => [p.x, wallY(p.t, inp.tMax), WALL_Z + 0.08] as Vec3), radius: 0.2, color: 'data' });
  if (inp.target.length) items.push(...polyRods('reto', inp.target.map((p) => [p.x, wallY(p.t, inp.tMax), WALL_Z + 0.05] as Vec3), 0.05, 'ink-2', 0.7).map((it, i) => (i === 0 ? { ...it, label: 'Reto (objetivo)' } : it)));
  if (inp.done && inp.curve.length) items.push(...polyRods('curva', inp.curve.map((p) => [p.x, wallY(p.t, inp.tMax), WALL_Z + 0.06] as Vec3), 0.08, 'series-1').map((it, i) => (i === 0 ? { ...it, label: 'Tu recorrido x–t' } : it)));
  if (inp.started && !inp.done) {
    const y = wallY(inp.t, inp.tMax);
    items.push({ id: 'ahora', kind: 'sphere', center: [inp.x, y, WALL_Z + 0.1], radius: 0.26, color: 'series-1' });
    items.push({ id: 'guia', kind: 'rod', from: [inp.x, 0.05, WALL_Z + 0.1], to: [inp.x, y, WALL_Z + 0.1], radius: 0.02, color: 'series-1', opacity: 0.6 });
  }

  const aText = inp.acceleration > 0 ? 'acelera (la flecha a apunta hacia adelante, como v)' : inp.acceleration < 0 ? 'frena (la flecha a apunta hacia atrás, contra v)' : 'va con velocidad constante (sin flecha a)';
  const state = !inp.started
    ? `El ciclista está en la salida; con estas condiciones ${aText}.`
    : inp.done
      ? `Recorrido terminado: ${fmt(inp.distance, 2)} m en ${fmt(inp.time, 2)} s; ${inp.strobe.length} fotos sobre la pista y sus puntos en la pared${inp.stopped ? '. Se detuvo antes de terminar el tiempo: ya no hay flechas v ni a' : inp.atEnd ? '. Llegó al final de la pista' : ''}.`
      : `${inp.running ? 'El ciclista avanza' : 'Recorrido en pausa'}; cronómetro en ${fmt(inp.t, 2)} s, ${inp.strobe.length} ${inp.strobe.length === 1 ? 'foto tomada' : 'fotos tomadas'}. ${inp.stopped ? 'Ya se detuvo: v = 0 y no hay flecha a.' : `El ciclista ${aText}.`}`;
  const wall = inp.strobe.length > 1
    ? ` En la pared, los puntos de las fotos ${inp.acceleration > 0 ? 'se separan cada vez más a lo largo de la pista (cada vez recorre más en 0,5 s)' : inp.acceleration < 0 ? 'se juntan a lo largo de la pista (cada vez recorre menos en 0,5 s)' : 'quedan igual de separados (recorre lo mismo cada 0,5 s)'}.`
    : '';
  const description = `Ciclorruta recta de 50 m en 3D con el ciclista, la flecha v de su velocidad, la flecha a de la aceleración y, detrás, una pared con la gráfica posición–tiempo girada (la posición a lo largo de la pista y el tiempo hacia arriba). ${state}${wall}`;
  return { items, extent: 27, target: [25, 3.5, -1], description, vLen: inp.v * kv, aLen: accelerating * A_SCALE };
}

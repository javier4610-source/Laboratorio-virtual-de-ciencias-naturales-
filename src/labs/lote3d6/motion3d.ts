/**
 * «movimiento» (lote 3D-6): la pista de 40 m de la cancha en 3D, en metros, vista desde arriba. Funciones PURAS con el
 * MISMO estado del banco (src/models/motion.ts → simulateMotion, tripPosition, pathLengthAt) en el mismo instante:
 *   - el cono de salida, la bandera de meta, la cinta métrica, las marcas cada 5 m y las fotopuertas están donde los puso
 *     el estudiante;
 *   - cada móvil está en la posición que dibuja el banco (la misma función del modelo; con movimiento reducido, en la marca
 *     de 5 m anterior, como el banco);
 *   - la DISTANCIA RECORRIDA es el camino que deja el móvil sobre la pista (en ida y vuelta, el de ida y el de vuelta, uno
 *     al lado del otro) y el DESPLAZAMIENTO es la flecha de la salida a donde está el móvil: en ida y vuelta, al volver, la
 *     flecha se acorta hasta desaparecer aunque el camino siga creciendo.
 * Dibujo: personas a escala; la bicicleta, el balón y el carrito, ampliados para que se vean; colores y formas.
 */
import { fmt } from '../../lib/format';
import { MARK_SPACING, TRACK_LENGTH, type MoverKind, type Trip } from '../../models/motion';
import type { SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';
import { stackedCone } from './common';

export interface MotionLane {
  kind: MoverKind;
  name: string;
  /** Posición desde el cono de salida (m) que dibuja el banco (negativa antes de la salida lanzada). */
  pos: number;
  /** ¿Va de regreso (ida y vuelta)? */
  returning: boolean;
}

export interface MotionSceneInput {
  lanes: MotionLane[];
  start: number;
  finish: number;
  tape: number;
  trip: Trip;
  isRace: boolean;
  /** Fotopuertas (m desde la salida) cuando el cronometraje es automático; vacío si es a mano. */
  gates: readonly number[];
  phase: 'listo' | 'corriendo' | 'pausa' | 'medido';
}

const LANE_Z = (li: number, race: boolean) => (race ? (li === 0 ? -1.3 : 1.3) : 0);
const COLORS: SceneColor[] = ['series-1', 'series-2'];

/** Camino recorrido (m) a partir de la posición del banco: en ida y vuelta, al regresar es 2d − posición. */
export function pathFromPos(pos: number, d: number, trip: Trip, returning: boolean): number {
  const p = Math.max(0, pos);
  return trip === 'idavuelta' && returning ? 2 * d - p : p;
}

function moverItems(id: string, kind: MoverKind, x: number, z: number, color: SceneColor, label: string): SceneItem[] {
  if (kind === 'persona') return [
    { id: `${id}-piernas`, kind: 'ellipsoid', center: [x, 0.45, z], radii: [0.16, 0.45, 0.16], color: '#2f3a4a' },
    { id: `${id}-cuerpo`, kind: 'ellipsoid', center: [x, 1.15, z], radii: [0.22, 0.35, 0.16], color, label },
    { id: `${id}-cabeza`, kind: 'sphere', center: [x, 1.62, z], radius: 0.13, color: '#c99a6e' },
  ];
  if (kind === 'bicicleta') return [
    { id: `${id}-rueda1`, kind: 'rod', from: [x - 0.55, 0.35, z - 0.04], to: [x - 0.55, 0.35, z + 0.04], radius: 0.35, color: '#2a2f32' },
    { id: `${id}-rueda2`, kind: 'rod', from: [x + 0.55, 0.35, z - 0.04], to: [x + 0.55, 0.35, z + 0.04], radius: 0.35, color: '#2a2f32' },
    { id: `${id}-cuadro`, kind: 'rod', from: [x - 0.55, 0.4, z], to: [x + 0.45, 0.85, z], radius: 0.05, color },
    { id: `${id}-ciclista`, kind: 'ellipsoid', center: [x - 0.1, 1.25, z], radii: [0.2, 0.32, 0.16], color, label },
    { id: `${id}-cabeza`, kind: 'sphere', center: [x + 0.05, 1.68, z], radius: 0.13, color: '#c99a6e' },
  ];
  if (kind === 'balon') return [{ id: `${id}-balon`, kind: 'sphere', center: [x, 0.3, z], radius: 0.3, color: '#f2f2f2', label }];
  return [
    { id: `${id}-carrito`, kind: 'box', center: [x, 0.22, z], size: [0.6, 0.25, 0.4], color, label },
    { id: `${id}-ruedas`, kind: 'rod', from: [x, 0.09, z - 0.24], to: [x, 0.09, z + 0.24], radius: 0.09, color: '#2a2f32' },
  ];
}

export function motionScene(inp: MotionSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; paths: number[]; displacements: number[] } {
  const d = inp.finish - inp.start;
  const items: SceneItem[] = [
    { id: 'cancha', kind: 'plane', center: [20, -0.02, 0], size: [52, 16], color: '#3f8f4a' },
    { id: 'carril', kind: 'plane', center: [20, 0, 0], size: [TRACK_LENGTH, inp.isRace ? 5.6 : 3.2], color: '#b5643c' },
  ];
  // Marcas pintadas cada 5 m.
  for (let m = 0; m <= TRACK_LENGTH; m += MARK_SPACING) {
    const hw = inp.isRace ? 2.8 : 1.6;
    items.push({ id: `marca-${m}`, kind: 'rod', from: [m, 0.02, -hw], to: [m, 0.02, hw], radius: 0.05, color: '#f4f4f4', ...(m % 20 === 0 ? { label: `${m} m` } : {}) });
  }
  // Cono de salida y bandera de meta.
  items.push(...stackedCone('cono', inp.start, -2.4, 0, 0.6, 0.22, 0.03, '#f07a1a', 4).map((it, i) => (i === 0 ? { ...it, label: 'Cono de salida' } : it)));
  items.push({ id: 'asta', kind: 'rod', from: [inp.finish, 0, -2.4], to: [inp.finish, 1.8, -2.4], radius: 0.04, color: 'ink-2' });
  items.push({ id: 'bandera', kind: 'box', center: [inp.finish + 0.35, 1.55, -2.4], size: [0.7, 0.45, 0.03], color: '#d23c35', label: 'Bandera de meta' });
  // Cinta métrica desde el cono.
  if (inp.tape > 0.01) items.push({ id: 'cinta', kind: 'box', center: [inp.start + inp.tape / 2, 0.02, 2.2], size: [inp.tape, 0.03, 0.18], color: '#e8c33a', label: 'Cinta métrica' });
  // Fotopuertas.
  inp.gates.forEach((g, i) => {
    const x = inp.start + g, hw = inp.isRace ? 2.9 : 1.7;
    items.push({ id: `puerta-a-${i}`, kind: 'rod', from: [x, 0, -hw], to: [x, 1, -hw], radius: 0.05, color: '#2a2f32', ...(i === 0 ? { label: 'Fotopuertas' } : {}) });
    items.push({ id: `puerta-b-${i}`, kind: 'rod', from: [x, 0, hw], to: [x, 1, hw], radius: 0.05, color: '#2a2f32' });
    items.push({ id: `haz-${i}`, kind: 'rod', from: [x, 0.8, -hw], to: [x, 0.8, hw], radius: 0.015, color: 'bad', opacity: 0.6 });
  });
  const paths: number[] = [], displacements: number[] = [];
  inp.lanes.forEach((ln, li) => {
    const z = LANE_Z(li, inp.isRace);
    const x = inp.start + ln.pos;
    const color = COLORS[li];
    items.push(...moverItems(`movil${li}`, ln.kind, x, z, color, inp.isRace ? `Carril ${li + 1}: ${ln.name}` : ln.name));
    const path = pathFromPos(ln.pos, d, inp.isRace ? 'ida' : inp.trip, ln.returning);
    const disp = Math.max(0, ln.pos);
    paths.push(path); displacements.push(disp);
    // Camino recorrido: el de ida y, al regresar, el de vuelta a su lado.
    const goEnd = inp.trip === 'idavuelta' && ln.returning ? d : Math.max(0, ln.pos);
    if (goEnd > 0.02) items.push({ id: `camino-ida-${li}`, kind: 'rod', from: [inp.start, 0.04, z + 0.45], to: [inp.start + goEnd, 0.04, z + 0.45], radius: 0.07, color: 'data', label: inp.isRace ? undefined : 'Distancia recorrida (camino)' });
    if (inp.trip === 'idavuelta' && ln.returning && d - ln.pos > 0.02) {
      items.push({ id: `camino-vuelta-${li}`, kind: 'rod', from: [inp.finish, 0.04, z - 0.45], to: [inp.start + Math.max(0, ln.pos), 0.04, z - 0.45], radius: 0.07, color: 'data' });
    }
    if (!inp.isRace && disp > 0.05) items.push({ id: `desplazamiento-${li}`, kind: 'arrow', from: [inp.start, 2.2, z], vector: [disp, 0, 0], radius: 0.07, color: 'accent', label: 'Desplazamiento' });
  });

  const lane = inp.lanes[0];
  const where = (pos: number) => {
    if (pos <= 0) return 'detrás del cono de salida';
    const abs = inp.start + pos;
    const k = Math.floor(abs / MARK_SPACING + 1e-9) * MARK_SPACING;
    return Math.abs(abs - k) < 0.05 ? `en la marca de ${fmt(k, 0)} m` : `entre las marcas de ${fmt(k, 0)} y ${fmt(k + MARK_SPACING, 0)} m`;
  };
  let state: string;
  if (inp.isRace) {
    state = `Carrera: ${inp.lanes.map((l, i) => `carril ${i + 1}, ${l.name.toLowerCase()}, ${where(l.pos)}`).join('; ')}.`;
  } else if (inp.phase === 'listo') {
    state = `${lane.name} espera ${where(lane.pos)}.`;
  } else if (inp.trip === 'idavuelta') {
    state = lane.returning
      ? `${lane.name} ya fue hasta la bandera y regresa: está ${where(lane.pos)}. El camino recorrido (líneas de ida y de vuelta) sigue creciendo, pero la flecha del desplazamiento se acorta${paths[0] >= 2 * d - 0.05 ? ' y desaparece: volvió a la salida, así que su desplazamiento es 0 aunque recorrió el doble de la distancia entre el cono y la bandera' : ''}.`
      : `${lane.name} va hacia la bandera, ${where(lane.pos)}: por ahora el camino recorrido y el desplazamiento miden lo mismo.`;
  } else {
    state = `${lane.name} ${inp.phase === 'medido' ? 'terminó el recorrido y está' : 'está'} ${where(lane.pos)}. En un recorrido de ida en línea recta, el camino recorrido y el desplazamiento miden lo mismo.`;
  }
  const description = `Pista recta de 40 m en 3D vista desde arriba, con marcas cada 5 m: cono de salida en ${fmt(inp.start, 0)} m, bandera de meta en ${fmt(inp.finish, 0)} m y cinta métrica de ${fmt(inp.tape, 1)} m${inp.gates.length ? ', con fotopuertas cada 5 m' : ''}. ${state} La línea pintada sobre la pista es la distancia recorrida (el camino) y la flecha, el desplazamiento.`;
  return { items, extent: 16, target: [20, 0.5, 0], description, paths, displacements };
}

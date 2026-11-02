/**
 * «trabajo» (lote 3D-3): el plano inclinado en 3D con el bloque, las fuerzas (aplicada F paralela a la rampa, peso P,
 * normal N y rozamiento f), el desplazamiento d y la altura ganada h; detrás, dos rectángulos cuya ÁREA es el trabajo:
 * «F·d» (lo que hace quien jala) y «m·g·h» (lo que costaría subirlo derecho). Funciones PURAS a partir del MISMO resultado
 * del modelo (src/models/workPower.ts → simulateRamp) y del mismo avance de la medición que anima el banco.
 * Escala FIJA: 0,033 m por newton (12 N = 0,40 m) para las flechas y la altura de los rectángulos; distancias 1:1 (m),
 * así el área de cada rectángulo es proporcional al trabajo en J.
 */
import { fmt } from '../../lib/format';
import { BLOCK, RAMP, supportHeight, type RampResult } from '../../models/workPower';
import { add, arrowScale, scale, type SceneItem, type Vec3 } from '../../three/scene';

export const WORK_FORCE_SCALE = arrowScale(12, 0.4);
const BOARD_T = 0.03, BOARD_W = 0.3;
const BLOCK_L = 0.1, BLOCK_H = 0.05, BLOCK_W = 0.08;

export interface WorkSceneInput {
  ramp: RampResult;
  slots: number;
  surfaceName: string;
  /** Avance de la subida (0–1) y fase de la medición. */
  motion: number;
  phase: 'listo' | 'midiendo' | 'pausa' | 'medido';
  drive: 'mano' | 'torno';
}

/** Ejes de la rampa: u a lo largo (hacia arriba de la rampa) y n perpendicular (hacia afuera de la tabla). */
export function rampAxes(angleDeg: number): { u: Vec3; n: Vec3 } {
  const a = (angleDeg * Math.PI) / 180;
  return { u: [Math.cos(a), Math.sin(a), 0], n: [-Math.sin(a), Math.cos(a), 0] };
}

/** Distancia recorrida (m) sobre la rampa con el avance dado, igual que el banco: de la marca 10 a la marca 70. */
export const travelled = (motion: number) => RAMP.travel * Math.max(0, Math.min(1, motion));

export function workScene(inp: WorkSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; dNow: number; hNow: number } {
  const r = inp.ramp;
  const th = (r.angleDeg * Math.PI) / 180;
  const { u, n } = rampAxes(r.angleDeg);
  const along = (s: number, up = 0): Vec3 => add(scale(u, s), scale(n, up));
  const moving = !r.overload && inp.phase !== 'listo' && inp.motion > 0;
  const dNow = r.overload ? 0 : travelled(inp.phase === 'listo' ? 0 : inp.motion);
  const hNow = dNow * Math.sin(th);
  const s = RAMP.startMark + dNow; // borde trasero del bloque
  const k = WORK_FORCE_SCALE;
  const stack = inp.slots * 0.012;

  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0.45, -0.005, -0.15], size: [1.6, 0.9], color: 'surface-3' },
    { id: 'tabla', kind: 'box', center: along(RAMP.length / 2, -BOARD_T / 2), size: [RAMP.length, BOARD_T, BOARD_W], rotationZ: th, color: 'series-6' },
    // Soporte universal a 0,60 m de la bisagra con la pinza a la altura que da el ángulo.
    { id: 'soporte', kind: 'rod', from: [RAMP.postDistance, 0, -0.21], to: [RAMP.postDistance, supportHeight(r.angleDeg) + 0.08, -0.21], radius: 0.008, color: 'ink-2' },
    { id: 'pinza', kind: 'rod', from: [RAMP.postDistance, supportHeight(r.angleDeg) - BOARD_T, -0.21], to: [RAMP.postDistance, supportHeight(r.angleDeg) - BOARD_T, -0.15], radius: 0.006, color: 'ink-2' },
    // Marcas de inicio (10 cm) y fin (70 cm).
    ...[RAMP.startMark, RAMP.endMark].map((m, i): SceneItem => ({ id: `marca-${i}`, kind: 'box', center: along(m, 0.001), size: [0.006, 0.003, BOARD_W * 1.05], rotationZ: th, color: 'data' })),
    { id: 'bloque', kind: 'box', center: along(s + BLOCK_L / 2, BLOCK_H / 2), size: [BLOCK_L, BLOCK_H, BLOCK_W], rotationZ: th, color: 'series-6', edges: true },
  ];
  if (inp.slots > 0) items.push({ id: 'pesas', kind: 'box', center: along(s + BLOCK_L / 2, BLOCK_H + stack / 2), size: [0.06, stack, 0.06], rotationZ: th, color: 'amb', edges: true });

  // Fuerzas desde el centro del bloque (la normal y el rozamiento, en la cara de contacto).
  const c = along(s + BLOCK_L / 2, (BLOCK_H + stack) / 2);
  const rad = 0.009;
  items.push({ id: 'P', kind: 'arrow', from: c, vector: [0, -r.weight * k, 0], radius: rad, color: 'ink', label: 'P' });
  items.push({ id: 'N', kind: 'arrow', from: along(s + BLOCK_L * 0.25, BLOCK_H + stack + 0.005), vector: scale(n, r.normal * k), radius: rad, color: 'ok', label: 'N' });
  if (moving || inp.phase === 'medido') {
    items.push({ id: 'F', kind: 'arrow', from: along(s + BLOCK_L, BLOCK_H / 2), vector: scale(u, r.F * k), radius: rad, color: 'fis', label: 'F' });
    if (r.friction * k > 0.004) items.push({ id: 'f', kind: 'arrow', from: along(s, 0.006), vector: scale(u, -r.friction * k), radius: rad * 0.85, color: 'bad', label: 'f' });
  }
  // Desplazamiento d (sobre la rampa) y altura ganada h (vertical, junto a la regla).
  const dStart = along(RAMP.startMark, BLOCK_H + 0.09);
  if (dNow > 0.004) {
    items.push({ id: 'd', kind: 'arrow', from: dStart, vector: scale(u, dNow), radius: 0.006, color: 'series-5', label: 'd' });
    const base = along(RAMP.startMark, 0);
    items.push({ id: 'h', kind: 'arrow', from: [base[0] - 0.08, base[1], 0.2], vector: [0, hNow, 0], radius: 0.006, color: 'series-4', label: 'h' });
  }
  // Rectángulos de trabajo detrás de la rampa: ancho = distancia (m), alto = fuerza × k. Área ∝ trabajo.
  if (dNow > 0.004) {
    const wIn = r.F * k, wLift = r.weight * k;
    items.push({ id: 'area-Fd', kind: 'box', center: [-0.05 - dNow / 2, wIn / 2, -0.35], size: [dNow, wIn, 0.01], color: 'fis', opacity: 0.45, edges: true, label: 'F·d' });
    items.push({ id: 'area-mgh', kind: 'box', center: [-0.05 - dNow - 0.08 - hNow / 2, wLift / 2, -0.35], size: [Math.max(hNow, 0.002), wLift, 0.01], color: 'ink-3', opacity: 0.45, edges: true, label: 'm·g·h' });
  }

  const massText = `${fmt(BLOCK.mass + inp.slots * BLOCK.slotMass, 1)} kg`;
  let description = `Plano inclinado en 3D a ${fmt(r.angleDeg, 0)}° con ${inp.surfaceName.toLowerCase()}: bloque de ${massText}. Flechas (todas con la misma escala): peso P hacia abajo, normal N perpendicular a la rampa`;
  if (r.overload) description += '. La fuerza necesaria pasa de 10 N: el dinamómetro se sale de la escala y el bloque no sube.';
  else if (!(moving || inp.phase === 'medido')) description += '. Al medir aparecen la fuerza F, paralela a la rampa y hacia arriba, y el rozamiento f, hacia abajo de la rampa.';
  else {
    description += `, fuerza F paralela a la rampa hacia arriba y rozamiento f hacia abajo de la rampa. El bloque recorrió d = ${fmt(dNow * 100, 0)} cm sobre la rampa y subió h = ${fmt(hNow * 100, 1)} cm. Detrás, dos rectángulos: su ancho es la distancia y su alto la fuerza, así su área es el trabajo; «F·d» (jalando por la rampa) es más grande que «m·g·h» (subirlo derecho) en lo que se va en calor por el rozamiento.`;
    if (inp.phase === 'medido') description += ` Según el modelo: F·d = ${fmt(r.workIn, 3)} J, m·g·h = ${fmt(r.workLift, 3)} J y calor ${fmt(r.heat, 3)} J.`;
  }
  return { items, extent: 0.62, target: [0.32, 0.22, -0.1], description, dNow, hNow };
}


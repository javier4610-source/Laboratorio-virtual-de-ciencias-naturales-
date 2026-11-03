/**
 * Imanes y campo magnético en 3D (kit src/three). Funciones PURAS con el MISMO modelo del laboratorio: el imán de barra
 * con sus polos, líneas de campo integradas en el ESPACIO (salen del polo norte en todas las direcciones y llegan al
 * sur, no solo sobre la mesa), brújulas en la mesa orientadas con el campo horizontal total (imán + Tierra, WMM2025) y
 * la brújula del estudiante resaltada. Estaciones de dos imanes (fuerzas) y de la corriente (cable o bobina).
 * Escala: 1 cm = 0,4 unidades. Mesa: x = este, y del modelo = norte (−z de la escena), z del modelo = arriba (y).
 */
import { fmt } from '../lib/format';
import { compassAt, COIL, electromagnet, fieldLine, magnetsForce, poles, startDirections, type EmInput, type MagnetDef, type PlacedMagnet, type V3 } from '../models/magnetism';
import type { SceneItem, Vec3 } from '../three/scene';

export const K = 40; // unidades de la escena por metro
const toScene = (p: readonly number[]): Vec3 => [p[0] * K, p[2] * K + 0.12, -p[1] * K];
const compassDir = (angleDeg: number): Vec3 => { const a = (angleDeg * Math.PI) / 180; return [Math.sin(a), 0, -Math.cos(a)]; };

function magnetBoxes(p: PlacedMagnet, id: string, label = true): SceneItem[] {
  const { N, S } = poles(p);
  const c = toScene(p.center), n = toScene(N), s = toScene(S);
  const L = p.magnet.length * K, w = p.magnet.width * K, h = p.magnet.height * K;
  const along = (q: Vec3, k: number): Vec3 => [c[0] + (q[0] - c[0]) * k, c[1], c[2] + (q[2] - c[2]) * k];
  const horizontal = Math.abs(Math.cos(p.angle)) > 0.5;
  const size = (x: number): Vec3 => (horizontal ? [x, h, w] : [w, h, x]);
  return [
    { id: `${id}-n`, kind: 'box', center: along(n, 0.5), size: size(L / 2), color: 'series-1', ...(label ? { label: 'polo norte (N)' } : {}) },
    { id: `${id}-s`, kind: 'box', center: along(s, 0.5), size: size(L / 2), color: 'series-2', ...(label ? { label: 'polo sur (S)' } : {}) },
  ];
}

const lineCache = new Map<string, V3[][]>();
/** Líneas de campo 3D de un imán (se calculan una vez por imán y orientación). */
export function magnetLines(m: MagnetDef, angle: number, space = true): V3[][] {
  const key = `${m.id}-${angle}-${space}`;
  const hit = lineCache.get(key);
  if (hit) return hit;
  const p: PlacedMagnet = { magnet: m, center: [0, 0, 0], angle };
  const lines = startDirections(angle, space ? 12 : 6, space).map((d) => fieldLine(p, d, { step: 0.002, box: 0.11, maxSteps: 400 }));
  lineCache.set(key, lines);
  return lines;
}

export interface MagnetSceneInput { placed: PlacedMagnet; compass: [number, number]; showLines: boolean }
export function magnetScene({ placed, compass, showLines }: MagnetSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const items: SceneItem[] = [{ id: 'mesa', kind: 'plane', center: [0, 0, 0], size: [12.4, 12.4], color: 'surface-3', opacity: 0.8 }];
  items.push(...magnetBoxes(placed, 'iman'));
  if (showLines) {
    magnetLines(placed.magnet, placed.angle).forEach((l, k) => {
      const pts = l.filter((_, i) => i % 3 === 0 || i === l.length - 1);
      for (let i = 0; i + 1 < pts.length; i++) items.push({ id: `l${k}-${i}`, kind: 'rod', from: toScene(pts[i]), to: toScene(pts[i + 1]), radius: 0.022, color: 'ink-2', opacity: 0.7, ...(k === 0 && i === 0 ? { label: 'líneas de campo: salen del N y llegan al S' } : {}) });
      const m = Math.floor(l.length / 2);
      if (l.length > 6) {
        const a = toScene(l[m]), b = toScene(l[m + 1]);
        const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const n = Math.hypot(...d) || 1;
        items.push({ id: `l${k}-punta`, kind: 'arrow', from: a, vector: [(d[0] / n) * 0.3, (d[1] / n) * 0.3, (d[2] / n) * 0.3], radius: 0.03, color: 'ink-2' });
      }
    });
  }
  // brújulas pequeñas en un anillo (como limaduras orientadas) y la del estudiante
  const ring: [number, number][] = [];
  for (const r of [0.06, 0.095]) for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI + (r > 0.08 ? Math.PI / 12 : 0); ring.push([r * Math.cos(a), r * Math.sin(a)]); }
  ring.forEach(([x, y], k) => {
    const c = compassAt(placed, x, y);
    const d = compassDir(c.angle);
    const at: Vec3 = [x * K, 0.05, -y * K];
    items.push({ id: `b${k}`, kind: 'arrow', from: [at[0] - d[0] * 0.25, 0.05, at[2] - d[2] * 0.25], vector: [d[0] * 0.5, 0, d[2] * 0.5], radius: 0.03, color: 'ink-3' });
  });
  const c = compassAt(placed, compass[0], compass[1]);
  const d = compassDir(c.angle);
  const at: Vec3 = [compass[0] * K, 0.08, -compass[1] * K];
  items.push({ id: 'brujula-caja', kind: 'ellipsoid', center: at, radii: [0.5, 0.05, 0.5], color: 'surface', opacity: 0.8 });
  items.push({ id: 'brujula', kind: 'arrow', from: [at[0] - d[0] * 0.42, 0.14, at[2] - d[2] * 0.42], vector: [d[0] * 0.84, 0, d[2] * 0.84], radius: 0.05, color: 'data', label: `tu brújula: ${fmt(c.angle, 0)}° desde el norte` });
  items.push({ id: 'norte', kind: 'arrow', from: [-5.6, 0.02, 5.4], vector: [0, 0, -1.2], radius: 0.04, color: 'ink', label: 'norte geográfico' });
  const description = `Imán de ${fmt(placed.magnet.length * 100, 0)} cm con el polo norte hacia ${fmt(((placed.angle * 180) / Math.PI + 360) % 360, 0)}° desde el este.` +
    (showLines ? ' Las líneas de campo salen del polo norte en todas las direcciones del espacio (también por encima y por debajo de la mesa) y llegan al polo sur.' : '') +
    ` Las 24 brújulas pequeñas se alinean con el campo; la tuya, en (${fmt(compass[0] * 100, 1)}; ${fmt(compass[1] * 100, 1)}) cm, apunta ${fmt(c.angle, 0)}° desde el norte geográfico (el campo del imán allí es ${fmt(c.magnetToEarth, 1)} veces el horizontal de la Tierra).`;
  return { items, extent: 5.4, target: [0, 0.2, 0], description };
}

export function twoMagnetsScene(m: MagnetDef, gapCm: number, facing: 'NN' | 'NS' | 'SS'): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const F = magnetsForce(m, gapCm / 100, facing);
  const L = m.length;
  const g = gapCm / 100;
  // imán 1 a la izquierda: su extremo derecho en x = −g/2. Imán 2 a la derecha.
  const a1 = facing === 'SS' ? Math.PI : 0; // el polo derecho del imán 1 es N salvo en «sur con sur»
  const a2 = facing === 'NN' ? Math.PI : 0; // el polo izquierdo del imán 2 es N solo en «norte con norte»
  const p1: PlacedMagnet = { magnet: m, center: [-g / 2 - L / 2, 0, 0], angle: a1 };
  const p2: PlacedMagnet = { magnet: m, center: [g / 2 + L / 2, 0, 0], angle: a2 };
  const items: SceneItem[] = [{ id: 'mesa', kind: 'plane', center: [0, 0, 0], size: [10, 4], color: 'surface-3', opacity: 0.8 }];
  items.push(...magnetBoxes(p1, 'iman1'), ...magnetBoxes(p2, 'iman2', false));
  const len = Math.min(1.6, 0.25 + Math.abs(F) * 0.6);
  const dir = F > 0 ? 1 : -1; // repulsión: se alejan
  items.push({ id: 'f1', kind: 'arrow', from: [toScene(p1.center)[0], 0.5, 0], vector: [-dir * len, 0, 0], radius: 0.05, color: 'data', label: `${F > 0 ? 'repulsión' : 'atracción'}: ${fmt(Math.abs(F), 3)} N` });
  items.push({ id: 'f2', kind: 'arrow', from: [toScene(p2.center)[0], 0.5, 0], vector: [dir * len, 0, 0], radius: 0.05, color: 'data' });
  const names = { NN: 'norte con norte', NS: 'norte con sur', SS: 'sur con sur' };
  return { items, extent: 4.6, target: [0, 0.2, 0], description: `Dos imanes iguales con los polos ${names[facing]} enfrentados a ${fmt(gapCm, 1)} cm: ${F > 0 ? 'se repelen' : 'se atraen'} con ${fmt(Math.abs(F), 3)} N (modelo de polos). Las flechas muestran la fuerza sobre cada imán (iguales y opuestas).` };
}

/** Escala de la estación de la corriente: 1 cm = 0,15 unidades (la brújula puede estar a 30 cm). */
export const KC = 15;
export function currentScene(i: EmInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const r = electromagnet(i);
  const d = i.distanceCm / 100;
  const items: SceneItem[] = [{ id: 'mesa', kind: 'plane', center: [0, 0, 0], size: [9, 6], color: 'surface-3', opacity: 0.8 }];
  let comp: Vec3, angle: number;
  if (i.source === 'cable') {
    // cable de sur a norte a la altura d sobre la brújula; la corriente va hacia el norte
    items.push({ id: 'cable', kind: 'rod', from: [0, d * KC + 0.1, 2.6], to: [0, d * KC + 0.1, -2.6], radius: 0.05, color: 'series-6', label: `cable: ${fmt(i.current, 2)} A hacia el norte` });
    items.push({ id: 'i-flecha', kind: 'arrow', from: [0.25, d * KC + 0.1, 1.2], vector: [0, 0, -1], radius: 0.04, color: 'series-6' });
    comp = [0, 0.08, 0];
    // la corriente hacia el norte crea, DEBAJO del cable, un campo hacia el oeste (regla de la mano derecha)
    angle = compassAt(null, 0, 0, [-r.B, 0]).angle;
  } else {
    const x0 = -2.4; // centro de la bobina
    items.push({ id: 'bobina', kind: 'spring', from: [x0 - (COIL.length * KC) / 2, 0.35, 0], to: [x0 + (COIL.length * KC) / 2, 0.35, 0], coils: Math.max(6, Math.round(i.turns / 10)), radius: COIL.radius * KC, wire: 0.025, color: 'series-6', label: `bobina de ${i.turns} espiras con ${fmt(i.current, 2)} A` });
    comp = [x0 + d * KC, 0.08, 0];
    // la bobina apunta al este: su campo en el eje va hacia el este (+x)
    angle = compassAt(null, 0, 0, [r.B, 0]).angle;
    if (r.B > 0) items.push({ id: 'campo', kind: 'arrow', from: [x0 + (COIL.length * KC) / 2 + 0.1, 0.35, 0], vector: [Math.min(1.5, 0.3 + r.B * 2e4), 0, 0], radius: 0.04, color: 'series-2', label: `B en el eje: ${fmt(r.B * 1e6, 2)} µT` });
  }
  const dd = compassDir(angle);
  items.push({ id: 'brujula-caja', kind: 'ellipsoid', center: comp, radii: [0.4, 0.04, 0.4], color: 'surface', opacity: 0.8 });
  items.push({ id: 'brujula', kind: 'arrow', from: [comp[0] - dd[0] * 0.34, 0.12, comp[2] - dd[2] * 0.34], vector: [dd[0] * 0.68, 0, dd[2] * 0.68], radius: 0.04, color: 'data', label: `brújula: desviada ${fmt(r.deflection, 1)}°` });
  items.push({ id: 'norte', kind: 'arrow', from: [-3.9, 0.02, 2.4], vector: [0, 0, -0.8], radius: 0.03, color: 'ink', label: 'norte geográfico' });
  return {
    items, extent: 3.8, target: [0, 0.3, 0],
    description: `${i.source === 'cable' ? `Cable recto con ${fmt(i.current, 2)} A de sur a norte, ${fmt(i.distanceCm, 0)} cm encima de la brújula` : `Bobina de ${i.turns} espiras con ${fmt(i.current, 2)} A apuntando al este; brújula en su eje a ${fmt(i.distanceCm, 0)} cm`}: el campo de la corriente es ${fmt(r.B * 1e6, 2)} µT, perpendicular al de la Tierra (${fmt(26.967, 1)} µT), y la aguja se desvía ${fmt(r.deflection, 1)}° (tan θ = B/H).`,
  };
}

/**
 * Escena 3D de una célula de la muestra del microscopio (piloto del kit src/three). Funciones PURAS a partir de los datos
 * que ya usa la práctica «celulas» (src/models/microscope.ts): tamaños de cada muestra (µm), estructuras que se estudian
 * con sus nombres y la observación actual (qué se ve al microscopio y por qué no). No añade estructuras que la práctica
 * no trabaja salvo la membrana celular, que tienen todas las células (el fondo de la práctica la nombra).
 * Proporciones aproximadas; los colores identifican estructuras y no son los reales.
 */
import { findSample, STRUCTURES, type Observation, type SampleId, type Structure } from '../models/microscope';
import { fmt } from '../lib/format';
import type { ColorToken } from '../three/colors';
import type { SceneItem, Vec3 } from '../three/scene';

export type CellPartId = Structure['id'];

/** Función de cada estructura, a partir del fondo y la evaluación de la práctica (lenguaje de grado 6.º). */
export const PART_FUNCTION: Record<CellPartId, string> = {
  pared: 'Capa rígida por fuera de la membrana que da forma y soporte a la célula. En las plantas es de celulosa; los hongos, como la levadura, también tienen pared.',
  membrana: 'Capa delgada que rodea la célula y controla qué sustancias entran y salen (se relaciona con la práctica de ósmosis). Las células animales solo tienen membrana, sin pared.',
  nucleo: 'Estructura que guarda el material hereditario y dirige la célula. Es casi transparente: se distingue al teñirlo (lugol o azul de metileno).',
  cloroplastos: 'Organelos verdes con clorofila, el pigmento que capta la luz. Solo los tienen las células vegetales que reciben luz; por eso la cebolla, que crece bajo tierra, no los tiene.',
  yemas: 'Células hijas pequeñas que brotan de la levadura cuando se reproduce por gemación, la forma típica de reproducción de este hongo unicelular.',
};

const PART_COLOR: Record<CellPartId, ColorToken> = { pared: 'amb', membrana: 'series-5', nucleo: 'series-4', cloroplastos: 'bio', yemas: 'series-6' };

export interface CellPart { id: CellPartId; name: string; fn: string; inPractice: boolean }

/** Estructuras que dibuja la escena para la muestra: las de la práctica y, si falta, la membrana celular. */
export function cellParts(sampleId: SampleId): CellPart[] {
  const list = STRUCTURES[sampleId].map((s) => ({ id: s.id, name: s.name, fn: PART_FUNCTION[s.id], inPractice: true }));
  if (!list.some((p) => p.id === 'membrana')) list.splice(list.findIndex((p) => p.id === 'pared') + 1, 0, { id: 'membrana', name: 'Membrana celular', fn: PART_FUNCTION.membrana, inPractice: false });
  return list;
}

/** Qué dice la observación actual sobre una estructura (se ve / no se ve y por qué). */
export function microscopeStatus(part: CellPart, obs: Observation): string {
  const v = obs.structures.find((x) => x.structure.id === part.id);
  if (!v) return 'En esta muestra no es una de las estructuras que se registran al microscopio.';
  return v.visible ? `Al microscopio, con esta preparación (${obs.magnification}×, ${obs.stain.name.toLowerCase()}), se ve.` : `Al microscopio, con esta preparación, no se ve: ${v.reasonText}.`;
}

export interface CellScene { items: SceneItem[]; extent: number; description: string; parts: CellPart[] }

/** Puntos repartidos sobre un óvalo de semiejes (a, b) en el plano x–z, a la altura y (cloroplastos junto a la pared). */
function ring(a: number, b: number, y: number, n: number, phase = 0): Vec3[] {
  return Array.from({ length: n }, (_, i) => { const t = phase + (i / n) * 2 * Math.PI; return [a * Math.cos(t), y, b * Math.sin(t)] as Vec3; });
}

export function cellScene(sampleId: SampleId, selected: string | null): CellScene {
  const s = findSample(sampleId);
  const parts = cellParts(sampleId);
  const has = (id: CellPartId) => parts.some((p) => p.id === id);
  const nameOf = (id: CellPartId) => parts.find((p) => p.id === id)?.name ?? id;
  const base = (id: CellPartId) => ({ id, label: nameOf(id), selectable: true, color: PART_COLOR[id] });
  const L = s.lengthUm, W = s.widthUm;
  const items: SceneItem[] = [];
  let extent: number;
  if (sampleId === 'cebolla' || sampleId === 'elodea') {
    // Célula en forma de ladrillo: largo L (x), ancho W (z) y un grosor algo menor que el ancho (y).
    const T = 0.75 * W;
    items.push({ ...base('pared'), kind: 'box', center: [0, 0, 0], size: [L, T, W], edges: true, opacity: 0.22 });
    const inset = Math.min(4, 0.06 * W);
    items.push({ ...base('membrana'), kind: 'box', center: [0, 0, 0], size: [L - 2 * inset, T - 2 * inset, W - 2 * inset], opacity: 0.16 });
    if (has('nucleo')) items.push({ ...base('nucleo'), kind: 'ellipsoid', center: [-0.12 * L, 0, 0], radii: [10, 8, 8] });
    if (has('cloroplastos')) {
      const y = 0.28 * T, a = L / 2 - 4, b = W / 2 - 4;
      items.push({ ...base('cloroplastos'), kind: 'particles', radius: 2.4, points: [...ring(a, b, y, 14), ...ring(a, b, -y, 14, Math.PI / 14)] });
    }
    extent = 0.55 * Math.hypot(L, T, W);
  } else if (sampleId === 'mucosa') {
    // Célula plana e irregular del epitelio: un disco aplanado de unos 55 µm.
    items.push({ ...base('membrana'), kind: 'ellipsoid', center: [0, 0, 0], radii: [L / 2, 6, 0.46 * W], opacity: 0.4 });
    items.push({ ...base('nucleo'), kind: 'sphere', center: [2, 0, -1], radius: 4 });
    extent = 0.6 * L;
  } else {
    // Levadura: célula ovalada de unos 6 × 5 µm con una yema.
    items.push({ ...base('pared'), kind: 'ellipsoid', center: [0, 0, 0], radii: [L / 2, W / 2, W / 2], opacity: 0.28 });
    items.push({ ...base('membrana'), kind: 'ellipsoid', center: [0, 0, 0], radii: [L / 2 - 0.35, W / 2 - 0.35, W / 2 - 0.35], opacity: 0.2 });
    items.push({ ...base('nucleo'), kind: 'sphere', center: [-0.4, 0.2, 0], radius: 0.75 });
    items.push({ ...base('yemas'), kind: 'sphere', center: [L / 2 + 0.55, 0.9, 0], radius: 0.95 });
    extent = 0.75 * L;
  }
  const sel = parts.find((p) => p.id === selected);
  const dims = sampleId === 'mucosa' ? `unos ${fmt(L, 0)} µm de diámetro y muy delgada` : `unos ${fmt(L, 0)} × ${fmt(W, 0)} µm`;
  const description = `Modelo 3D de una célula de la muestra «${s.name}», ${dims}. Estructuras dibujadas: ${parts.map((p) => p.name.toLowerCase()).join(', ')}.`
    + (sel ? ` Elegida: ${sel.name}.` : ' Elige una estructura en la escena o en la lista para ver qué función cumple.');
  return { items, extent, description, parts };
}

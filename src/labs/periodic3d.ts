/**
 * «Relieve periódico» en 3D (kit src/three): una columna por elemento, en su casilla de la tabla de 18 grupos, con altura
 * proporcional a la propiedad elegida (los MISMOS datos del laboratorio: PubChem y Pyykkö). Elementos sin dato: losa
 * plana gris. Al elegir un elemento se resalta su columna y aparecen esferas con el radio covalente real de los
 * elementos de su período (o de su grupo), para ver la tendencia del tamaño a escala. Funciones puras.
 */
import { fmt } from '../lib/format';
import type { ColorToken } from '../three/colors';
import type { SceneItem, Vec3 } from '../three/scene';
import { groupMembers, PERIODIC, periodMembers, PROPERTY_INFO, propertyRange, type PeriodicElement, type PeriodicProperty } from '../models/periodicTrends';

export const BLOCK_TOKEN: Record<PeriodicElement['bloque'], ColorToken> = { s: 'series-1', p: 'series-3', d: 'series-2', f: 'series-4' };
export const BLOCK_NAME: Record<PeriodicElement['bloque'], string> = { s: 'bloque s', p: 'bloque p', d: 'bloque d', f: 'bloque f' };
/** Altura máxima de una columna (unidades de la escena: 1 = ancho de una casilla). */
export const MAX_HEIGHT = 4;

/** Centro de la casilla en el plano (x hacia la derecha por grupos, z hacia el frente por períodos; bloque f aparte). */
export function cellCenter(e: Pick<PeriodicElement, 'row' | 'col'>): [number, number] {
  return [e.col - 9.5, e.row - 4.5 + (e.row >= 8 ? 0.6 : 0)];
}
/** Altura de la columna: proporcional al valor (desde 0), o null sin dato. */
export function barHeight(v: number | null, max: number): number | null {
  return v === null ? null : Math.max(0.06, (v / max) * MAX_HEIGHT);
}

export interface PeriodicSceneInput { property: PeriodicProperty; selected: string | null; spheres: 'periodo' | 'grupo' | 'ninguna' }
export interface PeriodicScene { items: SceneItem[]; extent: number; target: Vec3; description: string }

export function periodicScene(p: PeriodicSceneInput): PeriodicScene {
  const info = PROPERTY_INFO[p.property];
  const { max } = propertyRange(p.property);
  const sel = p.selected ? PERIODIC.find((e) => e.sym === p.selected) ?? null : null;
  const items: SceneItem[] = [
    { id: 'base', kind: 'plane', center: [0, -0.02, 0.4], size: [19.5, 11.2], color: 'surface-3' },
  ];
  let withData = 0;
  for (const e of PERIODIC) {
    const [x, z] = cellCenter(e);
    const v = e[p.property];
    const h = barHeight(v, max);
    const isSel = sel?.sym === e.sym;
    if (h !== null) withData++;
    items.push({
      id: `el-${e.sym}`, kind: 'box', center: [x, (h ?? 0.04) / 2, z], size: [0.82, h ?? 0.04, 0.82],
      color: h === null ? 'line-strong' : isSel ? 'data' : BLOCK_TOKEN[e.bloque], opacity: h === null ? 0.5 : 1, selectable: true, edges: isSel,
      label: isSel ? `${e.sym} (${e.es}): ${v === null ? 'sin dato' : `${fmt(v, info.decimals)}${info.unit ? ` ${info.unit}` : ''}`}` : undefined,
    });
  }
  let sphereNote = '';
  if (sel && p.spheres !== 'ninguna') {
    const members = p.spheres === 'periodo' ? periodMembers(sel.period) : groupMembers(sel.group ?? -1);
    const shown = members.filter((m) => m.radioCov !== null);
    // Esferas a escala entre sí: 100 pm = 0,32 unidades de la escena, encima de la columna más alta.
    const y = MAX_HEIGHT + 1.1;
    for (const m of shown) {
      const [x, z] = cellCenter(m);
      items.push({ id: `esf-${m.sym}`, kind: 'sphere', center: [x, y, z], radius: (m.radioCov as number) * 0.0032, color: m.sym === sel.sym ? 'data' : BLOCK_TOKEN[m.bloque], opacity: 0.9, selectable: true });
    }
    if (shown.length) sphereNote = ` Encima flotan esferas con el radio covalente real (a escala entre sí) de los elementos del ${p.spheres === 'periodo' ? `período ${sel.period}` : `grupo ${sel.group}`}: de ${shown[0].sym} (${shown[0].radioCov} pm) a ${shown[shown.length - 1].sym} (${shown[shown.length - 1].radioCov} pm).`;
  }
  const selTxt = sel ? ` Elegido: ${sel.sym} (${sel.es}), período ${sel.period}${sel.group ? `, grupo ${sel.group}` : ''}, ${info.short} ${sel[p.property] === null ? 'sin dato' : `${fmt(sel[p.property] as number, info.decimals)}${info.unit ? ` ${info.unit}` : ''}`}.` : ' Ningún elemento elegido.';
  return {
    items, extent: 8.6, target: [0, 1.4, 0.6],
    description: `Relieve periódico (${info.label.toLowerCase()}): ${withData} de 118 elementos tienen dato y su columna mide en proporción al valor (la más alta, ${fmt(max, info.decimals)}${info.unit ? ` ${info.unit}` : ''}); losas grises = sin dato. Colores por bloque: s, p, d y f.${selTxt}${sphereNote}`,
  };
}

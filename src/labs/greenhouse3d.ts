/**
 * La Tierra y su atmósfera en 3D (kit src/three). Funciones PURAS con el MISMO modelo del laboratorio (balance de
 * energía y modelo de una capa): la luz del Sol llega desde −x en rayos paralelos que tocan el hemisferio de día, la
 * sombra que proyecta la Tierra es un disco de radio R (área πR²) y la Tierra emite por toda la esfera (4πR²). Sobre el
 * polo, en el plano z = 0, una fila de flechas con longitud PROPORCIONAL a cada flujo promedio del modelo (W/m²) con una
 * escala fija para todas las corridas: luz absorbida y reflejada, infrarrojo de la superficie, el que se escapa por la
 * ventana y el que la capa emite hacia arriba y hacia abajo. Radio de la Tierra = 1 unidad (sin escala con la capa).
 */
import { fmt } from '../lib/format';
import { co2Warming, kelvinToC, layerModel, type LayerInput } from '../models/greenhouse';
import { arrowScale, type SceneItem, type Vec3 } from '../three/scene';

export const R_EARTH = 1;
export const R_LAYER = 1.6;
/** Escala de los flujos: 500 W/m² = 1,8 unidades (fija). */
export const K_FLUX = arrowScale(500, 1.8);
/** Escala del forzamiento (otra unidad de escala): 8 W/m² = 0,8 unidades. */
export const K_FORCING = arrowScale(8, 0.8);
const SUN = '#e3a008';

const surfaceY = (x: number) => Math.sqrt(Math.max(0, R_EARTH ** 2 - x * x));
const layerY = (x: number) => Math.sqrt(Math.max(0, R_LAYER ** 2 - x * x));

export interface EarthSceneInput extends LayerInput { co2?: { C: number; ecs: number } | null }
export function earthScene(i: EarthSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const r = layerModel(i);
  const items: SceneItem[] = [
    { id: 'tierra', kind: 'sphere', center: [0, 0, 0], radius: R_EARTH, color: '#2f6fb0', label: 'Tierra: emite por toda la esfera (4πR²)' },
    { id: 'sombra', kind: 'ellipsoid', center: [2.5, 0, 0], radii: [0.02, R_EARTH, R_EARTH], color: 'ink', opacity: 0.35, label: 'sombra: un disco de área πR²' },
    { id: 'sol', kind: 'sphere', center: [-3.4, -0.1, 0], radius: 0.28, color: SUN, label: 'luz del Sol' },
  ];
  if (i.eps > 0) items.push({ id: 'capa', kind: 'sphere', center: [0, 0, 0], radius: R_LAYER, color: 'info', opacity: 0.05 + 0.15 * i.eps, label: 'capa de atmósfera' });
  // Rayos paralelos por debajo de y = 0,3 (no tocan la fila de flechas del polo).
  let n = 0;
  for (const [y, z] of [[0.3, 0], [0, 0], [-0.35, 0], [-0.7, 0], [0, 0.55], [0, -0.55], [-0.4, 0.45], [-0.4, -0.45]] as [number, number][]) {
    const x = -Math.sqrt(R_EARTH ** 2 - y * y - z * z);
    items.push({ id: `rayo-${n++}`, kind: 'rod', from: [-3.1, y, z], to: [x, y, z], radius: 0.018, color: SUN, opacity: 0.8 });
  }
  // Fila de flujos sobre el polo (plano z = 0): x de −0,6 a 0,9; las de la capa salen de su superficie.
  const flux = (id: string, x: number, value: number, dir: 1 | -1, fromLayer: boolean, color: SceneItem['color'], label: string, opacity = 1) => {
    const len = value * K_FLUX;
    if (len < 0.02) return;
    const y0 = dir === 1 ? (fromLayer ? layerY(x) : surfaceY(x)) : (fromLayer ? layerY(x) : surfaceY(x) + len);
    items.push({ id, kind: 'arrow', from: [x, y0, 0], vector: [0, dir * len, 0], radius: 0.05, color, opacity, label });
  };
  flux('reflejada', -0.6, r.reflected, 1, false, SUN, 'luz reflejada', 0.7);
  flux('solar-absorbida', -0.3, r.absorbed, -1, false, SUN, 'luz absorbida');
  flux('ir-superficie', 0, r.surfaceIR, 1, false, 'bad', 'infrarrojo de la superficie');
  if (i.eps > 0) {
    flux('ventana', 0.3, r.window, 1, true, 'bad', 'infrarrojo al espacio', 0.6);
    flux('capa-arriba', 0.6, r.layerUp, 1, true, 'series-4', 'capa hacia arriba');
    flux('capa-abajo', 0.9, r.layerDown, -1, true, 'series-4', 'capa hacia abajo');
  }
  let co2Txt = '';
  if (i.co2) {
    const w = co2Warming(i.co2.C, i.co2.ecs);
    const len = Math.abs(w.forcing) * K_FORCING;
    if (len >= 0.02) items.push({ id: 'forzamiento', kind: 'arrow', from: [1.3, w.forcing > 0 ? -0.5 : 0.3, 0], vector: [0, (w.forcing > 0 ? 1 : -1) * len, 0], radius: 0.06, color: 'data', label: 'forzamiento del CO₂ (otra escala)' });
    co2Txt = ` Con ${fmt(i.co2.C, 0)} ppm de CO₂ el forzamiento es ${fmt(w.forcing, 2)} W/m² (flecha a la derecha de la Tierra, con otra escala) y el calentamiento de equilibrio, ${fmt(w.dT, 2)} °C con una sensibilidad de ${fmt(i.co2.ecs, 1)} °C.`;
  }
  const layerTxt = i.eps > 0
    ? ` La capa absorbe el ${fmt(i.eps * 100, 0)} % del infrarrojo de la superficie (${fmt(r.layerAbsorbs, 1)} W/m²), está a ${fmt(r.Ta ?? 0, 1)} K y emite ${fmt(r.layerUp, 1)} W/m² hacia arriba y otro tanto hacia abajo; por la ventana escapan ${fmt(r.window, 1)} W/m².`
    : ' No hay capa que absorba infrarrojo: todo el infrarrojo de la superficie sale al espacio.';
  const description = `La luz del Sol llega desde la izquierda y la Tierra la intercepta con un disco de radio R: su sombra. Cada metro cuadrado recibe en promedio ${fmt(r.incoming, 1)} W/m², refleja ${fmt(r.reflected, 1)} y absorbe ${fmt(r.absorbed, 1)} W/m². La superficie está a ${fmt(r.Ts, 1)} K (${fmt(kelvinToC(r.Ts), 1)} °C) y emite ${fmt(r.surfaceIR, 1)} W/m² de infrarrojo.${layerTxt} Al espacio salen ${fmt(r.olr, 1)} W/m², lo mismo que se absorbe.${co2Txt} Las flechas sobre el polo miden lo que cada flujo.`;
  return { items, extent: 2.15, target: [-0.4, 0.7, 0], description };
}

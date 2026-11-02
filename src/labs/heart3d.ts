/**
 * Corazón y circulación doble en 3D (kit src/three). Funciones PURAS con el MISMO estado del laboratorio: las cavidades se
 * contraen según la fase del ciclo (cycleAt), las válvulas se abren o se cierran, y las gotas de sangre recorren la
 * circulación pulmonar y la sistémica con un avance proporcional al gasto cardíaco. Rojo: sangre oxigenada; azul:
 * desoxigenada (convención de los esquemas; la sangre venosa real es rojo oscuro). Vista frontal: el lado derecho del
 * corazón queda a la izquierda de la pantalla. Esquema sin escala, no anatomía exacta.
 */
import { fmt } from '../lib/format';
import { cycleAt } from '../models/circulation';
import type { SceneItem, Vec3 } from '../three/scene';

export const OXY = '#c62828', DEOXY = '#1e63c4';
const C = { ra: [-0.95, 0.9, 0] as Vec3, rv: [-0.6, -0.55, 0.25] as Vec3, la: [0.95, 1.0, -0.3] as Vec3, lv: [0.75, -0.6, -0.05] as Vec3 };

/** Recorrido cerrado de la sangre con su estado de oxigenación en cada tramo. */
export const PATH: { p: Vec3; oxy: boolean }[] = [
  { p: [-0.95, 0.9, 0], oxy: false }, { p: [-0.7, -0.4, 0.25], oxy: false }, { p: [-0.3, 0.6, 0.55], oxy: false }, { p: [-0.4, 2.0, 0.5], oxy: false },
  { p: [-2.6, 2.6, 0], oxy: false }, { p: [-2.9, 2.2, -0.4], oxy: true }, { p: [-1.2, 1.6, -0.6], oxy: true }, { p: [0.95, 1.0, -0.3], oxy: true },
  { p: [0.7, -0.5, -0.05], oxy: true }, { p: [0.25, 1.0, 0.1], oxy: true }, { p: [0.4, 2.7, 0], oxy: true }, { p: [1.5, 2.5, 0], oxy: true },
  { p: [1.7, -3.2, 0], oxy: true }, { p: [0, -4.0, 0], oxy: false }, { p: [-1.7, -3.2, 0], oxy: false }, { p: [-1.3, -1.2, 0], oxy: false }, { p: [-0.95, 0.9, 0], oxy: false },
];
/** Punto del recorrido a la fracción s (por número de tramos) y si la sangre allí está oxigenada. */
export function bloodAt(s: number): { p: Vec3; oxy: boolean } {
  const n = PATH.length - 1;
  const x = (((s % 1) + 1) % 1) * n;
  const i = Math.min(n - 1, Math.floor(x)), t = x - i;
  const a = PATH[i].p, b = PATH[i + 1].p;
  return { p: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])], oxy: PATH[i].oxy };
}

export interface HeartSceneInput { hr: number; beatPhase: number; flowPhase: number; co: number }
export function heartScene({ hr, beatPhase, flowPhase, co }: HeartSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const c = cycleAt(beatPhase, hr);
  const v = c.ventricle, a = c.atrium;
  const items: SceneItem[] = [
    { id: 'aur-der', kind: 'ellipsoid', center: C.ra, radii: [0.62 * a, 0.55 * a, 0.55 * a], color: DEOXY, opacity: 0.5, label: 'aurícula derecha' },
    { id: 'ven-der', kind: 'ellipsoid', center: C.rv, radii: [0.62 * v, 0.95 * v, 0.6 * v], color: DEOXY, opacity: 0.5, label: 'ventrículo derecho' },
    { id: 'aur-izq', kind: 'ellipsoid', center: C.la, radii: [0.62 * a, 0.55 * a, 0.55 * a], color: OXY, opacity: 0.5, label: 'aurícula izquierda' },
    { id: 'ven-izq', kind: 'ellipsoid', center: C.lv, radii: [0.75 * v, 1.1 * v, 0.7 * v], color: OXY, opacity: 0.5, label: 'ventrículo izquierdo (pared más gruesa)' },
    { id: 'tabique', kind: 'box', center: [0.08, 0.1, 0.05], size: [0.12, 2.6, 0.9], color: 'ink-3', opacity: 0.55 },
  ];
  const valve = (id: string, at: Vec3, open: boolean, name: string) => items.push({ id, kind: 'box', center: at, size: open ? [0.36, 0.05, 0.36] : [0.5, 0.12, 0.5], color: open ? 'ok' : 'bad', opacity: open ? 0.45 : 0.95, label: `${name} (${open ? 'abierta' : 'cerrada'})` });
  valve('tricuspide', [-0.82, 0.3, 0.12], c.avOpen, 'válvula tricúspide');
  valve('mitral', [0.86, 0.38, -0.18], c.avOpen, 'válvula mitral');
  valve('pulmonar', [-0.32, 0.75, 0.5], c.semilunarOpen, 'válvula pulmonar');
  valve('aortica', [0.25, 0.95, 0.1], c.semilunarOpen, 'válvula aórtica');
  // vasos (siguen el recorrido)
  const vessel = (id: string, from: number, to: number, label?: string) => {
    for (let i = from; i < to; i++) items.push({ id: `${id}-${i}`, kind: 'rod', from: PATH[i].p, to: PATH[i + 1].p, radius: 0.12, color: PATH[i].oxy ? OXY : DEOXY, opacity: 0.35, label: i === from ? label : undefined });
  };
  vessel('arteria-pulmonar', 2, 4, 'arteria pulmonar');
  vessel('venas-pulmonares', 5, 7, 'venas pulmonares');
  vessel('aorta', 9, 12, 'arteria aorta');
  vessel('venas-cavas', 14, 16, 'venas cavas');
  items.push({ id: 'pulmon-der', kind: 'ellipsoid', center: [-2.8, 2.4, -0.2], radii: [0.75, 1.0, 0.6], color: 'series-5', opacity: 0.25, label: 'pulmones (recoge O₂)' });
  items.push({ id: 'pulmon-izq', kind: 'ellipsoid', center: [2.8, 2.4, -0.2], radii: [0.7, 0.95, 0.6], color: 'series-5', opacity: 0.2 });
  items.push({ id: 'cuerpo', kind: 'box', center: [0, -3.6, 0], size: [3.8, 1.0, 1.2], color: 'surface-3', opacity: 0.35, edges: true, label: 'órganos del cuerpo (entrega O₂)' });
  const N = 28;
  const pts = Array.from({ length: N }, (_, k) => bloodAt(k / N + flowPhase));
  const ox = pts.filter((x) => x.oxy).map((x) => x.p), de = pts.filter((x) => !x.oxy).map((x) => x.p);
  if (ox.length) items.push({ id: 'sangre-oxigenada', kind: 'particles', points: ox, radius: 0.13, color: OXY, label: 'sangre oxigenada' });
  if (de.length) items.push({ id: 'sangre-desoxigenada', kind: 'particles', points: de, radius: 0.13, color: DEOXY, label: 'sangre desoxigenada' });
  return {
    items, extent: 4.2, target: [0, -0.3, 0],
    description: `Corazón visto de frente (el lado derecho del corazón a la izquierda de la pantalla) a ${fmt(hr, 0)} latidos por minuto: ${c.name}. Válvulas tricúspide y mitral ${c.avOpen ? 'abiertas' : 'cerradas'}; pulmonar y aórtica ${c.semilunarOpen ? 'abiertas' : 'cerradas'}. ` +
      `Circulación doble: el lado derecho envía sangre desoxigenada (azul) a los pulmones y el izquierdo envía sangre oxigenada (roja) al cuerpo; gasto cardíaco ${fmt(co, 2)} L/min.`,
  };
}

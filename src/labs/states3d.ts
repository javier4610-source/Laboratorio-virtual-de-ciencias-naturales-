/**
 * Caja de partículas de agua en 3D (kit src/three). Funciones PURAS con el MISMO estado del laboratorio (curva de
 * calentamiento): las partículas que siguen en la red del hielo, las que forman el líquido y las que vuelan como vapor
 * salen de las fracciones de sólido, líquido y gas del modelo; su agitación crece con √T. En una meseta la temperatura
 * no cambia, así que la agitación tampoco: lo único que cambia es cuántas partículas dejaron la red (o el líquido).
 * Termómetro al lado con la columna a la temperatura del modelo. `phase` avanza con el tiempo SIMULADO (en pausa, quieta).
 */
import { fmt } from '../lib/format';
import { BOX, particlePositions, PHASE_NAME, vRms, type CurveState } from '../models/statesOfMatter';
import type { SceneItem, Vec3 } from '../three/scene';

export const T_MIN = -30, T_MAX = 150;
/** Altura de la columna del termómetro (unidades de la escena) para la temperatura T. */
export const thermoHeight = (T: number) => 0.2 + (3.4 * (Math.min(T_MAX, Math.max(T_MIN, T)) - T_MIN)) / (T_MAX - T_MIN);

export interface StatesSceneInput { state: CurveState; tBoil: number; phase: number }
export function statesScene({ state, tBoil, phase }: StatesSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const { pos, kind, amplitude } = particlePositions(state, phase);
  const h = BOX / 2;
  const items: SceneItem[] = [
    { id: 'base', kind: 'plane', center: [0.6, -h - 0.02, 0], size: [7.4, 5], color: 'surface-3', opacity: 0.7 },
    { id: 'caja', kind: 'box', center: [0, 0, 0], size: [BOX, BOX, BOX], color: 'line-strong', opacity: 0.14 },
  ];
  const groups: { k: 'red' | 'liquido' | 'gas'; color: SceneItem['color']; label: string }[] = [
    { k: 'red', color: 'series-2', label: 'hielo: partículas en una red que vibran en su sitio' },
    { k: 'liquido', color: 'series-5', label: 'líquido: partículas juntas que se deslizan' },
    { k: 'gas', color: 'series-1', label: 'vapor: partículas separadas que vuelan y rebotan' },
  ];
  for (const g of groups) {
    const pts = pos.filter((_, i) => kind[i] === g.k) as Vec3[];
    if (pts.length) items.push({ id: `p-${g.k}`, kind: 'particles', points: pts, radius: 0.3, color: g.color, label: `${g.label} (${pts.length})` });
  }
  // termómetro
  const tx = h + 1.1;
  items.push({ id: 'termo-tubo', kind: 'rod', from: [tx, -h, 0], to: [tx, -h + 3.8, 0], radius: 0.12, color: 'surface', opacity: 0.9 });
  items.push({ id: 'termo-columna', kind: 'rod', from: [tx, -h, 0], to: [tx, -h + thermoHeight(state.T), 0], radius: 0.07, color: 'bad', label: `termómetro: ${fmt(state.T, 1)} °C` });
  items.push({ id: 'termo-bulbo', kind: 'sphere', center: [tx, -h, 0], radius: 0.18, color: 'bad' });
  const n = (k: string) => kind.filter((x) => x === k).length;
  const plateau = state.phase === 'fusion' || state.phase === 'ebullicion';
  const description = `Caja con 27 partículas de agua a ${fmt(state.T, 1)} °C: ${PHASE_NAME[state.phase]}. ` +
    `${n('red')} en la red del hielo, ${n('liquido')} en el líquido y ${n('gas')} en el vapor (fracciones del modelo: ${fmt(state.solid * 100, 0)} % sólido, ${fmt(state.liquid * 100, 0)} % líquido, ${fmt(state.gas * 100, 0)} % gas). ` +
    (plateau ? `Meseta: la energía de la parrilla separa partículas sin aumentar su agitación; la temperatura se queda en ${fmt(state.phase === 'fusion' ? 0 : tBoil, 1)} °C. ` : '') +
    `La agitación crece con la temperatura absoluta (rapidez media real de las moléculas: ${fmt(vRms(state.T), 0)} m/s; amplitud dibujada ${fmt(amplitude, 2)}).`;
  return { items, extent: 3.9, target: [0.6, -0.1, 0], description };
}

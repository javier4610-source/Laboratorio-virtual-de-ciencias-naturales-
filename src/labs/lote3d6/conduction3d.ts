/**
 * «conduccion» (lote 3D-6): la varilla del aparato de Ingenhousz en 3D, en centímetros, con su mapa de color de
 * temperatura. Funciones PURAS con el MISMO resultado del modelo (src/models/conduction.ts → simulateConduction,
 * temperatureAt: ecuación de la aleta resuelta con Crank–Nicolson) en el mismo instante del banco:
 *   - cada centímetro de la varilla tiene el color de la temperatura del modelo en su centro, con la escala FIJA de
 *     common.ts (de 20 °C azul a 100 °C rojo), así que dos materiales se comparan a simple vista;
 *   - las tachuelas caen cuando el modelo dice que su gota de cera llegó a 55 °C (`tackFall`), como en el banco;
 *   - los termopares están donde los puso el estudiante y su rótulo es la lectura del registrador del banco;
 *   - la varilla de comparación (opcional) es OTRA corrida del mismo modelo con el mismo baño, la misma funda y el mismo
 *     tiempo, con el material que se elija en la vista.
 * Dibujo: el grosor de la varilla (×1,5), el baño, el mechero, las formas y la bandeja.
 */
import { fmt } from '../../lib/format';
import { TACK_SLOTS_CM, WAX_MELT_T, temperatureAt, type CoverId, type RodSolution } from '../../models/conduction';
import type { SceneItem, Vec3 } from '../../three/scene';
import { stackedCone, tempColor, TEMP_SCALE_TEXT } from './common';

export const ROD_Y = 8; // cm sobre la mesa
export const ROD_R = 0.6; // cm (dibujo: 1,5 veces el radio real de 4 mm)
export const SEG_CM = 1;
const CMP_Z = -6;

export interface RodRun { short: string; solution: RodSolution }

export interface ConductionSceneInput {
  main: RodRun;
  compare: RodRun | null;
  cover: CoverId;
  bathT: number;
  /** Tiempo simulado del banco (s). */
  simT: number;
  indicator: 'tachuelas' | 'cinta';
  nTacks: number;
  /** Posiciones de los termopares (cm) y lo que marca el registrador del banco (°C). */
  probes: readonly number[];
  lcd: readonly number[];
  started: boolean;
  done: boolean;
}

/** Temperatura del modelo en el centro de cada segmento de 1 cm (°C), de la pared del baño a la punta. */
export function segmentTemps(sol: RodSolution, simT: number): number[] {
  return Array.from({ length: 30 / SEG_CM }, (_, i) => temperatureAt(sol, ((i + 0.5) * SEG_CM) / 100, simT));
}

/** Distancia (cm) hasta donde la varilla supera la temperatura T (0 si ni el primer segmento la supera). */
export function reachAbove(temps: readonly number[], T: number): number {
  let x = 0;
  temps.forEach((t, i) => { if (t >= T) x = (i + 1) * SEG_CM; });
  return x;
}

function rodItems(prefix: string, temps: number[], z: number, label: string): SceneItem[] {
  return temps.map((T, i) => ({
    id: `${prefix}-${i}`, kind: 'rod' as const, from: [i * SEG_CM, ROD_Y, z] as Vec3, to: [(i + 1) * SEG_CM, ROD_Y, z] as Vec3, radius: ROD_R, color: tempColor(T),
    ...(i === 29 ? { label } : {}),
  }));
}

export function conductionScene(inp: ConductionSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; temps: number[]; compareTemps: number[] | null; fallen: number[] } {
  const temps = segmentTemps(inp.main.solution, inp.simT);
  const cmp = inp.compare ? segmentTemps(inp.compare.solution, inp.simT) : null;
  const bz = cmp ? -3 : 0;
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [6, -0.02, -2], size: [56, 30], color: 'surface-3' },
    { id: 'bano', kind: 'box', center: [-6.5, 8.5, bz], size: [13, 10, cmp ? 16 : 10], color: '#9aa5a9', opacity: 0.2, edges: true, label: `Baño de agua a ${fmt(inp.bathT, 0)} °C` },
    { id: 'agua-bano', kind: 'box', center: [-6.5, 8.2, bz], size: [12, 8.6, cmp ? 15 : 9], color: tempColor(inp.bathT), opacity: 0.3 },
    // Trípode y mechero bajo el baño (la llama crece con la temperatura del baño, como en el banco).
    { id: 'pata-1', kind: 'rod', from: [-11.5, 0, bz - 3], to: [-11, 3.5, bz - 2.5], radius: 0.15, color: '#4a5356' },
    { id: 'pata-2', kind: 'rod', from: [-1.5, 0, bz - 3], to: [-2, 3.5, bz - 2.5], radius: 0.15, color: '#4a5356' },
    { id: 'pata-3', kind: 'rod', from: [-6.5, 0, bz + 4], to: [-6.5, 3.5, bz + 3.5], radius: 0.15, color: '#4a5356' },
    { id: 'mechero', kind: 'rod', from: [-6.5, 0, bz], to: [-6.5, 1, bz], radius: 0.6, color: '#8d989c' },
  ];
  items.push(...stackedCone('llama', -6.5, bz, 1, 1 + 0.9 + 1.6 * ((inp.bathT - 40) / 58), 0.45, 0.05, '#4d7dff', 4, 0.75));
  items.push(...rodItems('varilla', temps, 0, `Varilla de ${inp.main.short.toLowerCase()}`));
  items.push({ id: 'tapon', kind: 'rod', from: [-0.6, ROD_Y, 0], to: [0.2, ROD_Y, 0], radius: ROD_R + 0.5, color: '#3a3f42' });
  if (cmp && inp.compare) {
    items.push(...rodItems('comparacion', cmp, CMP_Z, `${inp.compare.short} (comparación)`));
    items.push({ id: 'tapon-cmp', kind: 'rod', from: [-0.6, ROD_Y, CMP_Z], to: [0.2, ROD_Y, CMP_Z], radius: ROD_R + 0.5, color: '#3a3f42' });
  }
  if (inp.cover === 'icopor') {
    items.push({ id: 'funda', kind: 'rod', from: [0.2, ROD_Y, 0], to: [30, ROD_Y, 0], radius: 1.5, color: '#f3f2ea', opacity: 0.32, label: 'Funda de icopor' });
    if (cmp) items.push({ id: 'funda-cmp', kind: 'rod', from: [0.2, ROD_Y, CMP_Z], to: [30, ROD_Y, CMP_Z], radius: 1.5, color: '#f3f2ea', opacity: 0.32 });
  }
  // Tachuelas pegadas con cera: caen cuando el modelo dice que la gota llegó a 55 °C.
  const fallen: number[] = [];
  if (inp.indicator === 'tachuelas') {
    items.push({ id: 'bandeja', kind: 'box', center: [15, 0.15, 0], size: [31, 0.3, 4], color: '#b9c3c6' });
    const hang = ROD_Y - (inp.cover === 'icopor' ? 1.5 : ROD_R);
    TACK_SLOTS_CM.slice(0, inp.nTacks).forEach((x, i) => {
      const tf = inp.main.solution.tackFall[i];
      const down = inp.started && tf !== null && inp.simT >= tf;
      if (down) {
        fallen.push(x);
        items.push({ id: `tachuela-${i}`, kind: 'rod', from: [x, 0.45, -0.5], to: [x, 0.45, 0.5], radius: 0.1, color: 'ink-2', ...(fallen.length === 1 ? { label: 'Tachuelas caídas' } : {}) });
      } else {
        items.push({ id: `cera-${i}`, kind: 'sphere', center: [x, hang - 0.15, 0], radius: 0.32, color: '#efe6c6' });
        items.push({ id: `tachuela-${i}`, kind: 'rod', from: [x, hang - 0.3, 0], to: [x, hang - 1.4, 0], radius: 0.08, color: 'ink-2', ...(i === 0 ? { label: 'Tachuelas con cera' } : {}) });
      }
    });
  }
  // Termopares con la lectura del registrador.
  inp.probes.forEach((x, i) => {
    items.push({ id: `termopar-${i}`, kind: 'rod', from: [x, ROD_Y + ROD_R, 0], to: [x, ROD_Y + 4 + i * 1.6, 0], radius: 0.07, color: (['series-1', 'series-2', 'series-3'] as const)[i] });
    items.push({ id: `termopar-p-${i}`, kind: 'sphere', center: [x, ROD_Y + 4 + i * 1.6, 0], radius: 0.25, color: (['series-1', 'series-2', 'series-3'] as const)[i], label: `T${i + 1}: ${fmt(inp.lcd[i], 1)} °C` });
  });
  // Regla con marcas cada 5 cm.
  items.push({ id: 'regla', kind: 'box', center: [15, 0.1, 3.4], size: [30, 0.2, 1.6], color: '#d9b77e' });
  for (let c = 0; c <= 30; c += 5) items.push({ id: `marca-${c}`, kind: 'rod', from: [c, 0.22, 2.7], to: [c, 0.22, 3.6], radius: 0.06, color: '#4d3b1c' });

  const reachText = (name: string, t: number[]) => {
    const h = reachAbove(t, WAX_MELT_T), w = reachAbove(t, 40);
    return w === 0 ? `la ${name} sigue casi toda a la temperatura del salón` : `en la ${name}, más de 40 °C llega hasta ${fmt(w, 0)} cm${h > 0 ? ` y más de ${WAX_MELT_T} °C (la cera se ablanda) hasta ${fmt(h, 0)} cm` : ''}`;
  };
  const time = inp.done ? 'a los 30 min' : `a los ${fmt(inp.simT, 0)} s`;
  const state = !inp.started
    ? 'Aún no se ha encendido el mechero: la varilla está a la temperatura del salón (azul).'
    : `${time.charAt(0).toUpperCase()}${time.slice(1)}, ${reachText(`varilla de ${inp.main.short.toLowerCase()}`, temps)}; los termopares marcan ${inp.lcd.map((T, i) => `${fmt(T, 1)} °C a ${fmt(inp.probes[i], 1)} cm`).join(', ')}.`
      + (inp.indicator === 'tachuelas' ? ` Cayeron ${fallen.length} de ${inp.nTacks} tachuelas.` : '')
      + (cmp && inp.compare ? ` En el mismo tiempo, ${reachText(`varilla de ${inp.compare.short.toLowerCase()} (comparación)`, cmp)}.` : '');
  const description = `Varilla de ${inp.main.short.toLowerCase()} de 30 cm ${inp.cover === 'icopor' ? 'con funda de icopor ' : ''}en 3D, con un extremo en el baño a ${fmt(inp.bathT, 0)} °C${cmp && inp.compare ? ` y, al lado, una varilla de ${inp.compare.short.toLowerCase()} para comparar` : ''}. Cada centímetro tiene el color de su temperatura (escala fija: ${TEMP_SCALE_TEXT}). ${state}`;
  return { items, extent: 16.5, target: [8.5, 6, bz], narrow: { extent: 21, target: [8.5, 6, bz] as Vec3 }, description, temps, compareTemps: cmp, fallen };
}

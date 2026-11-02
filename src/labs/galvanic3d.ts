/**
 * Pila galvánica en 3D (kit src/three). Funciones PURAS con el MISMO estado del laboratorio: dos vasos con su solución
 * (el azul del Cu²⁺ se aclara al bajar la concentración), electrodos cuyo grosor sigue la masa calculada con Faraday
 * (cambio EXAGERADO ×20 para que se vea), el cable con los electrones que van del ánodo al cátodo y el puente salino con
 * los cationes K⁺ hacia el cátodo y los aniones hacia el ánodo. `phase` (0–1) avanza con el tiempo de la simulación.
 */
import { fmt } from '../lib/format';
import { halfCell, initialMass, type CellResult, type DischargeInput, type DischargeState } from '../models/electrochemicalCell';
import type { SceneColor } from '../three/colors';
import type { SceneItem, Vec3 } from '../three/scene';

export const MASS_EXAGGERATION = 20;
export const METAL_COLOR: Record<string, SceneColor> = { Zn: '#9ea7ad', Fe: '#6d6f73', Ni: '#a8a29e', Pb: '#5f6b73', Cu: '#c77d3b', Ag: '#d7dde2' };
const XL = -3, XR = 3, TOP = 4.6, WIRE_Y = 5.8;

/** Punto a la fracción s (0–1) de la longitud de una poligonal. */
export function alongPath(path: readonly Vec3[], s: number): Vec3 {
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1], p[2] - path[i][2]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = ((s % 1) + 1) % 1 * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, d / seg[i]) : 0;
      const a = path[i], b = path[i + 1];
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
    }
    d -= seg[i];
  }
  return path[path.length - 1];
}

/** Grosor dibujado de un electrodo: 0,16 unidades con su masa inicial; el cambio relativo se exagera ×20. */
export const electrodeThickness = (mass: number, m0: number) => Math.max(0.03, 0.16 * (1 + MASS_EXAGGERATION * (mass - m0) / m0));

export interface CellSceneInput { input: DischargeInput; cell: CellResult; state: DischargeState; phase: number; running: boolean }
export function cellScene({ input, cell, state, phase, running }: CellSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const L = halfCell(input.left), R = halfCell(input.right);
  const items: SceneItem[] = [{ id: 'mesa', kind: 'plane', center: [0, 0, 0], size: [12, 6], color: 'surface-3', opacity: 0.7 }];
  const side = (h: typeof L, x: number, c: number, mass: number, key: 'izq' | 'der') => {
    const role = cell.anode === (key === 'izq' ? 'left' : 'right') ? 'ánodo (−): oxidación' : cell.cathode === (key === 'izq' ? 'left' : 'right') ? 'cátodo (+): reducción' : 'electrodo';
    items.push({ id: `vaso-${key}`, kind: 'box', center: [x, 1.6, 0], size: [3, 3.2, 2.6], color: 'line-strong', opacity: 0.18 });
    const tint = h.metal === 'Cu' ? Math.min(0.75, 0.12 + 0.6 * Math.min(1, c)) : 0.3;
    items.push({ id: `sol-${key}`, kind: 'box', center: [x, 1.15, 0], size: [2.9, 2.3, 2.5], color: h.ionColor as SceneColor, opacity: tint, label: `${h.ion} ${fmt(c, 3)} mol/L` });
    items.push({ id: `elec-${key}`, kind: 'box', center: [x, 2.4, 0], size: [1.0, 4.2, electrodeThickness(mass, initialMass(h))], color: METAL_COLOR[h.metal], label: `${h.metal}: ${fmt(mass, 3)} g · ${role}` });
  };
  side(L, XL, state.cLeft, state.massLeft, 'izq');
  side(R, XR, state.cRight, state.massRight, 'der');
  // cable y voltímetro / carga
  const anodeX = cell.anode === 'right' ? XR : XL, cathX = cell.anode === 'right' ? XL : XR;
  const wire: Vec3[] = [[anodeX, TOP, 0], [anodeX, WIRE_Y, 0], [cathX, WIRE_Y, 0], [cathX, TOP, 0]];
  const wireL: Vec3[] = [[XL, TOP, 0], [XL, WIRE_Y, 0], [XR, WIRE_Y, 0], [XR, TOP, 0]];
  for (let i = 0; i < 3; i++) items.push({ id: `cable-${i}`, kind: 'rod', from: wireL[i], to: wireL[i + 1], radius: 0.05, color: 'ink-2' });
  items.push({ id: 'medidor', kind: 'box', center: [0, WIRE_Y, 0], size: [1.6, 0.9, 0.5], color: 'surface',
    label: input.currentMA > 0 ? `carga ${fmt(input.currentMA, 0)} mA` : `voltímetro ${fmt(cell.voltmeter, 3)} V` });
  // puente salino en U
  const bridge: Vec3[] = [[XL + 1.0, 1.0, 0], [XL + 1.0, 3.9, 0], [XR - 1.0, 3.9, 0], [XR - 1.0, 1.0, 0]];
  if (cell.closed) {
    for (let i = 0; i < 3; i++) items.push({ id: `puente-${i}`, kind: 'rod', from: bridge[i], to: bridge[i + 1], radius: 0.3, color: 'surface-2', opacity: 0.55 });
  }
  const flowing = cell.closed && !!cell.anode && input.currentMA > 0 && !state.depleted;
  if (flowing) {
    const pts = Array.from({ length: 8 }, (_, k) => alongPath(wire, k / 8 + phase));
    items.push({ id: 'electrones', kind: 'particles', points: pts, radius: 0.12, color: 'data', label: 'e⁻ por el cable: del ánodo al cátodo' });
    items.push({ id: 'flecha-e', kind: 'arrow', from: [anodeX * 0.55, WIRE_Y + 0.6, 0], vector: [(cathX - anodeX) * 0.35, 0, 0], radius: 0.05, color: 'data' });
    // por el puente: cationes hacia el cátodo y aniones hacia el ánodo (sentido del recorrido del puente: izquierda → derecha)
    const toRight = cathX > anodeX ? 1 : -1;
    const cat = Array.from({ length: 5 }, (_, k) => alongPath(bridge, toRight > 0 ? (k / 5 + phase * 0.6) % 1 : 1 - ((k / 5 + phase * 0.6) % 1)));
    const an = Array.from({ length: 5 }, (_, k) => alongPath(bridge, toRight > 0 ? 1 - ((k / 5 + 0.1 + phase * 0.6) % 1) : (k / 5 + 0.1 + phase * 0.6) % 1)).map((p): Vec3 => [p[0], p[1], p[2] + 0.12]);
    items.push({ id: 'cationes', kind: 'particles', points: cat, radius: 0.13, color: 'series-1', label: 'K⁺ hacia el cátodo' });
    items.push({ id: 'aniones', kind: 'particles', points: an, radius: 0.13, color: 'series-2', label: `${input.bridge === 'KCl' ? 'Cl⁻' : 'NO₃⁻'} hacia el ánodo` });
    // iones que salen del ánodo y llegan al cátodo
    const A = cell.anode === 'right' ? R : L;
    const out = Array.from({ length: 4 }, (_, k): Vec3 => { const f = (k / 4 + phase) % 1; return [anodeX + (0.6 + 0.8 * f) * (k % 2 ? 1 : -1), 2.0 - 1.4 * f, 0.4 * (k - 1.5)]; });
    const C = cell.anode === 'right' ? L : R;
    const inn = Array.from({ length: 4 }, (_, k): Vec3 => { const f = (k / 4 + phase) % 1; return [cathX + (1.4 - 0.8 * f) * (k % 2 ? 1 : -1), 0.6 + 1.4 * f, 0.4 * (k - 1.5)]; });
    items.push({ id: 'iones-anodo', kind: 'particles', points: out, radius: 0.11, color: 'series-4', label: `${A.ion} que se forman` });
    items.push({ id: 'iones-catodo', kind: 'particles', points: inn, radius: 0.11, color: 'series-5', label: `${C.ion} que se reducen` });
  }
  const dTxt = (d: number) => `${d >= 0 ? '+' : '−'}${fmt(Math.abs(d), 4)} g`;
  const description = `Pila de ${L.name} (izquierda) y ${R.name} (derecha)${cell.closed ? ' unidas por un puente salino' : ' SIN puente salino (circuito abierto)'}.` +
    (cell.anode ? ` El ${cell.anode === 'left' ? L.name : R.name} es el ánodo (se oxida) y el ${cell.cathode === 'left' ? L.name : R.name} el cátodo.` : ' Las semiceldas son iguales: no hay reacción neta.') +
    (flowing ? ` Los electrones van por el cable del ánodo al cátodo; por el puente, los cationes van hacia el cátodo y los aniones hacia el ánodo${running ? '' : ' (en pausa)'}.` : input.currentMA > 0 ? ' No circula corriente.' : ` Voltímetro en circuito abierto: ${fmt(cell.voltmeter, 3)} V.`) +
    ` A los ${fmt(state.t, 1)} min: electrodo izquierdo ${fmt(state.massLeft, 3)} g (${dTxt(state.dLeft)}), derecho ${fmt(state.massRight, 3)} g (${dTxt(state.dRight)}); el grosor dibujado exagera el cambio ×${MASS_EXAGGERATION}.`;
  return { items, extent: 5, target: [0, 2.8, 0], description };
}

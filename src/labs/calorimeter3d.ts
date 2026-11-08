/**
 * Calorímetro de vaso en 3D, en corte (kit src/three). Funciones PURAS con el MISMO modelo del laboratorio
 * (src/models/thermochem.ts): el vaso de icopor (o de vidrio) con su tapa, la solución (el ENTORNO) con partículas de
 * agua, los iones del SISTEMA que se van disolviendo o neutralizando (su número es proporcional a la fracción que ya
 * reaccionó, 1 − e^(−t/τ)), el sólido que queda sin disolver, el termómetro cuya columna sube o baja con la lectura del
 * modelo y una flecha de energía del sistema al entorno (exotérmico) o del entorno al sistema (endotérmico) con
 * longitud proporcional al calor liberado hasta ese instante. La agitación de las partículas de agua crece con la
 * temperatura con una escala ILUSTRATIVA (no son moléculas reales ni a escala).
 */
import { fmt } from '../lib/format';
import { seededRandom } from '../models/math';
import { tempAt, T_ROOM, type CalRun } from '../models/thermochem';
import type { SceneItem, Vec3 } from '../three/scene';

export const N_IONS = 24; // iones dibujados cuando todo reaccionó
export const N_WATER = 70;
export const K_THERMO = 0.09; // unidades de columna por °C
/** Flecha de energía: 3000 J = 1,2 unidades. */
export const K_ENERGY = 1.2 / 3000;
const R_LIQ = 1, H_LIQ = 1.6;

export function calorimeterScene(run: CalRun, t: number, cupName: string): { items: SceneItem[]; extent: number; target: Vec3; description: string; T: number; reacted: number } {
  const tau = run.exp.tau;
  const reacted = t <= 0 ? 0 : 1 - Math.exp(-t / tau);
  const T = tempAt(run.dTad, tau, run.k, t);
  const items: SceneItem[] = [
    { id: 'vaso', kind: 'rod', from: [0, -0.1, 0], to: [0, 2.1, 0], radius: 1.18, color: run.k > 0.001 ? 'info' : 'line-strong', opacity: 0.14, label: cupName, tag: '' },
    ...(run.k > 0.001 ? [] : [{ id: 'tapa', kind: 'box', center: [0, 2.15, 0], size: [2.5, 0.1, 2.5], color: 'line-strong', opacity: 0.35, label: 'tapa', tag: '' } as SceneItem]),
    { id: 'solucion', kind: 'rod', from: [0, 0, 0], to: [0, H_LIQ, 0], radius: R_LIQ, color: 'series-5', opacity: 0.12, label: 'entorno: la solución (agua)', tag: 'entorno' },
  ];
  // Agua: posiciones fijas por semilla con un vaivén cuya amplitud crece con la temperatura (ilustrativo).
  const rnd = seededRandom(7);
  const amp = 0.02 + Math.max(0, T - 15) * 0.006;
  const water: Vec3[] = [];
  for (let i = 0; i < N_WATER; i++) {
    const a = rnd() * 2 * Math.PI, r = Math.sqrt(rnd()) * (R_LIQ - 0.12), y = 0.1 + rnd() * (H_LIQ - 0.2), ph = rnd() * 2 * Math.PI;
    const w = Math.sin(ph + t * 0.9);
    water.push([r * Math.cos(a) + amp * w, y + amp * Math.cos(ph + t * 1.1), r * Math.sin(a) - amp * w]);
  }
  items.push({ id: 'agua', kind: 'particles', points: water, radius: 0.045, color: 'series-2', opacity: 0.7, label: 'moléculas de agua (agitación según T, ilustrativa)', tag: '' });
  // Iones del sistema, alrededor del centro del vaso.
  const nIons = Math.round(N_IONS * reacted);
  const rnd2 = seededRandom(11);
  const cations: Vec3[] = [], anions: Vec3[] = [];
  for (let i = 0; i < N_IONS; i++) {
    const a = rnd2() * 2 * Math.PI, r = 0.15 + Math.sqrt(rnd2()) * 0.6, y = 0.25 + rnd2() * 1.1;
    if (i < nIons) (i % 2 ? anions : cations).push([r * Math.cos(a), y, r * Math.sin(a)]);
  }
  const kind = run.exp.kind;
  const ionName = kind === 'neutralizacion' ? ['H⁺ que se neutraliza', 'OH⁻ que se neutraliza'] : ['catión disuelto', 'anión disuelto'];
  if (cations.length) items.push({ id: 'cationes', kind: 'particles', points: cations, radius: 0.08, color: 'series-1', label: `sistema: ${ionName[0]}`, tag: 'sistema' });
  if (anions.length) items.push({ id: 'aniones', kind: 'particles', points: anions, radius: 0.08, color: 'series-4', label: `sistema: ${ionName[1]}`, tag: '' });
  // Sólido sin disolver (disolución y Hess).
  if (kind !== 'neutralizacion' && reacted < 0.98) {
    const s = 0.45 * Math.cbrt(1 - reacted);
    items.push({ id: 'solido', kind: 'box', center: [0.3, s / 2 + 0.02, 0.2], size: [s, s, s], color: 'ink-3', label: 'sólido sin disolver', tag: 'sólido' });
  }
  // Termómetro.
  items.push({ id: 'termometro', kind: 'rod', from: [-0.7, 0.15, 0.3], to: [-0.7, 3.2, 0.3], radius: 0.06, color: 'line-strong', opacity: 0.4 });
  items.push({ id: 'bulbo', kind: 'sphere', center: [-0.7, 0.15, 0.3], radius: 0.1, color: 'bad' });
  const col = Math.max(0.02, 1.2 + (T - T_ROOM) * K_THERMO);
  items.push({ id: 'columna', kind: 'rod', from: [-0.7, 0.15, 0.3], to: [-0.7, 0.15 + col, 0.3], radius: 0.035, color: 'bad', label: `termómetro: ${fmt(T, 1)} °C`, tag: `${fmt(T, 1)} °C` });
  // Energía liberada hasta t (J): q·(fracción que reaccionó). Flecha horizontal del centro hacia la pared o al revés.
  const qNow = run.q * reacted;
  const L = Math.min(1.6, Math.abs(qNow) * K_ENERGY);
  if (L > 0.03) {
    const exo = qNow > 0;
    items.push({ id: 'energia', kind: 'arrow', from: exo ? [0.15, 1.75, 0] : [0.15 + L, 1.75, 0], vector: [exo ? L : -L, 0, 0], radius: 0.06, color: 'data', label: exo ? 'energía: del sistema al entorno (exotérmico)' : 'energía: del entorno al sistema (endotérmico)', tag: exo ? 'calor →' : '← calor' });
  }
  const description = `${run.exp.label} en ${cupName.toLowerCase()}, a los ${fmt(t, 0)} s: ha reaccionado el ${fmt(reacted * 100, 0)} % y el termómetro marca ${fmt(T, 1)} °C (empezó en ${fmt(T_ROOM, 1)} °C). `
    + (run.q >= 0 ? `Es exotérmico: el sistema ha cedido ${fmt(Math.abs(qNow), 0)} J a la solución.` : `Es endotérmico: el sistema ha tomado ${fmt(Math.abs(qNow), 0)} J de la solución, que se enfría.`)
    + ' Las partículas de agua se agitan más cuanto más caliente está la solución (escala ilustrativa).';
  return { items, extent: 1.9, target: [0, 1.3, 0], description, T, reacted };
}

/**
 * Cilindro con émbolo en 3D (kit src/three), con el MISMO estado del laboratorio (src/models/thermodynamics.ts): la
 * altura del gas es proporcional a su volumen, las partículas se reparten en ese espacio y se agitan más cuanto mayor
 * es la temperatura (amplitud ∝ √T, escala ILUSTRATIVA: no son moléculas a escala ni su número real), la fuente
 * caliente y la fría están debajo y al lado, y las flechas de calor y de trabajo aparecen con el sentido de la etapa
 * en curso: Q entra (desde la fuente caliente) o sale (hacia la fría), W hacia arriba si el gas empuja el émbolo
 * (se expande) o hacia abajo si el émbolo lo comprime.
 */
import { fmt } from '../lib/format';
import { seededRandom } from '../models/math';
import type { GasState } from '../models/thermodynamics';
import type { SceneItem, Vec3 } from '../three/scene';

export const N_PARTICLES = 36;
export const R_CYL = 0.7;
/** Altura del gas con el volumen máximo del recorrido; la altura es proporcional al volumen. */
export const H_MAX = 3.2;

export interface PistonInput { s: GasState; Vmax: number; dQsign: number; dWsign: number; t: number; stageLabel: string }

export function heightOf(V: number, Vmax: number): number {
  return (H_MAX * V) / Vmax;
}

export function pistonScene({ s, Vmax, dQsign, dWsign, t, stageLabel }: PistonInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; h: number } {
  const h = heightOf(s.V, Vmax);
  const y0 = 0.3; // fondo del cilindro (sobre la fuente caliente)
  const items: SceneItem[] = [
    { id: 'cilindro', kind: 'rod', from: [0, y0, 0], to: [0, y0 + H_MAX + 0.3, 0], radius: R_CYL + 0.05, color: 'line-strong', opacity: 0.14, label: 'cilindro', tag: '' },
    { id: 'gas', kind: 'rod', from: [0, y0, 0], to: [0, y0 + h, 0], radius: R_CYL, color: 'series-5', opacity: 0.12, label: `gas: ${fmt(s.V * 1000, 2)} L a ${fmt(s.T, 0)} K`, tag: '' },
    { id: 'embolo', kind: 'box', center: [0, y0 + h + 0.08, 0], size: [1.45, 0.16, 1.45], color: 'ink-3', label: `émbolo: ${fmt(s.P / 1000, 1)} kPa`, tag: 'émbolo' },
    { id: 'varilla', kind: 'rod', from: [0, y0 + h + 0.16, 0], to: [0, y0 + h + 1.1, 0], radius: 0.06, color: 'ink-3', tag: '' },
    { id: 'caliente', kind: 'box', center: [0, 0.1, 0], size: [1.9, 0.2, 1.9], color: 'bad', opacity: 0.8, label: 'fuente caliente', tag: 'fuente caliente' },
    { id: 'fria', kind: 'box', center: [2.0, 0.5, 0], size: [0.9, 0.9, 0.9], color: 'info', opacity: 0.8, label: 'fuente fría', tag: 'fuente fría' },
  ];
  // Partículas: posiciones fijas por semilla, escaladas a la altura del gas, con un vaivén ∝ √T (ilustrativo).
  const rnd = seededRandom(5);
  const amp = 0.03 * Math.sqrt(s.T / 300);
  const pts: Vec3[] = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    const a = rnd() * 2 * Math.PI, r = Math.sqrt(rnd()) * (R_CYL - 0.1), y = 0.06 + rnd() * 0.88, ph = rnd() * 2 * Math.PI;
    pts.push([r * Math.cos(a) + amp * Math.sin(ph + 7 * t), y0 + y * h + amp * Math.cos(ph + 9 * t), r * Math.sin(a) + amp * Math.cos(ph + 5 * t)]);
  }
  items.push({ id: 'particulas', kind: 'particles', points: pts, radius: 0.06, color: 'series-1', label: 'partículas del gas (agitación según T, ilustrativa)', tag: '' });
  if (dQsign > 0) items.push({ id: 'calor', kind: 'arrow', from: [-1.1, 0.25, 0], vector: [0, 0.9, 0], radius: 0.07, color: 'bad', label: 'calor: entra al gas desde la fuente caliente', tag: 'Q entra' });
  if (dQsign < 0) items.push({ id: 'calor', kind: 'arrow', from: [0.8, y0 + h / 2, 0], vector: [0.9, 0, 0], radius: 0.07, color: 'info', label: 'calor: sale del gas hacia la fuente fría', tag: 'Q sale' });
  if (dWsign !== 0) items.push({ id: 'trabajo', kind: 'arrow', from: dWsign > 0 ? [0, y0 + h + 1.15, 0] : [0, y0 + h + 2.0, 0], vector: [0, dWsign > 0 ? 0.8 : -0.8, 0], radius: 0.07, color: 'data', label: dWsign > 0 ? 'trabajo: el gas empuja el émbolo (W > 0)' : 'trabajo: el émbolo comprime el gas (W < 0)', tag: dWsign > 0 ? 'W > 0' : 'W < 0' });
  const description = `${stageLabel}: el gas ocupa ${fmt(s.V * 1000, 2)} L a ${fmt(s.P / 1000, 1)} kPa y ${fmt(s.T, 0)} K. `
    + (dQsign > 0 ? 'Recibe calor de la fuente caliente. ' : dQsign < 0 ? 'Cede calor a la fuente fría. ' : 'No intercambia calor. ')
    + (dWsign > 0 ? 'Se expande y empuja el émbolo hacia arriba.' : dWsign < 0 ? 'El émbolo baja y lo comprime.' : 'El émbolo no se mueve.')
    + ' La altura del gas es proporcional al volumen; la agitación de las partículas es ilustrativa.';
  return { items, extent: 2.6, target: [0.6, 1.9, 0], description, h };
}

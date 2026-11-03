/**
 * «equilibrio» (lote 3D-4): las partículas de reactivos y productos en las proporciones del equilibrio del modelo
 * (src/models/equilibrium.ts), con los MISMOS valores que muestra el banco en cada instante (también durante la
 * relajación ilustrativa tras una perturbación):
 *   - Sistema A, Fe³⁺ + SCN⁻ ⇌ FeSCN²⁺, en el tubo de ensayo: 1 punto por cada µmol de cada especie EN EL TUBO
 *     (cantidad = concentración × volumen), el AgSCN precipitado en el fondo y el color del líquido del banco;
 *   - Sistema B, 2 NO₂ ⇌ N₂O₄, en la jeringa: 1 molécula dibujada por cada 0,05 mmol (la misma cuenta que el banco); el
 *     N₂O₄ es un par de esferas; el largo del gas es el volumen y el tinte pardo sigue la intensidad del color del NO₂.
 */
import { fmt, fmtSig } from '../../lib/format';
import { normalizeHex } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';
import { seeds } from './elec3d';

export const UMOL_PER_DOT = 1; // sistema A
export const MMOL_PER_MOLECULE = 0.05; // sistema B (como el banco)
const S_FE = seeds(160, 41), S_SCN = seeds(160, 43), S_CX = seeds(160, 47), S_PPT = seeds(80, 53);
const S_NO2 = seeds(80, 59), S_N2O4 = seeds(60, 61);

/** Puntos dibujados para una concentración (mol/L) en un volumen (mL): 1 por µmol. */
export const dotsFor = (conc: number, volumeMl: number) => Math.max(0, Math.round((conc * volumeMl * 1000) / UMOL_PER_DOT));

const DIR: Record<string, string> = { productos: 'hacia los productos', reactivos: 'hacia los reactivos', ninguno: 'no se desplaza' };

export interface FeSceneInput {
  fe: number; scn: number; complex: number; // mol/L (los mostrados por el banco)
  volumeML: number;
  precipitated: number; // mmol de AgSCN
  K: number; Q: number;
  temperature: number;
  direction: 'productos' | 'reactivos' | 'ninguno';
  settled: boolean;
  perturbed: boolean;
  liquid: string; // color del líquido del banco
}

export function feScene(inp: FeSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; counts: { fe: number; scn: number; complex: number; ppt: number } } {
  const h = 4 * Math.min(1, inp.volumeML / 25); // nivel del líquido (25 mL = 4 unidades, como el banco)
  const inTube = (s: { p: Vec3 }): Vec3 => {
    const a = s.p[0] * 2 * Math.PI, r = 0.42 * Math.sqrt(s.p[2]);
    return [r * Math.cos(a), 0.15 + s.p[1] * Math.max(0.1, h - 0.25), r * Math.sin(a)];
  };
  const counts = {
    fe: Math.min(160, dotsFor(inp.fe, inp.volumeML)),
    scn: Math.min(160, dotsFor(inp.scn, inp.volumeML)),
    complex: Math.min(160, dotsFor(inp.complex, inp.volumeML)),
    ppt: Math.min(80, Math.round(inp.precipitated * 1000 / UMOL_PER_DOT)),
  };
  const hex = normalizeHex(inp.liquid) as `#${string}` | null;
  const items: SceneItem[] = [
    { id: 'gradilla', kind: 'box', center: [0, -0.15, 0], size: [2.2, 0.3, 1.6], color: 'series-6' },
    { id: 'tubo', kind: 'rod', from: [0, 0, 0], to: [0, 4.4, 0], radius: 0.5, color: 'line-strong', opacity: 0.15 },
    { id: 'liquido', kind: 'rod', from: [0, 0.02, 0], to: [0, h, 0], radius: 0.47, color: hex ?? 'series-1', opacity: 0.22 },
  ];
  if (counts.fe) items.push({ id: 'Fe', kind: 'particles', points: S_FE.slice(0, counts.fe).map(inTube), radius: 0.055, color: 'series-6', label: 'Fe³⁺' });
  if (counts.scn) items.push({ id: 'SCN', kind: 'particles', points: S_SCN.slice(0, counts.scn).map(inTube), radius: 0.055, color: 'series-5', label: 'SCN⁻' });
  if (counts.complex) items.push({ id: 'FeSCN', kind: 'particles', points: S_CX.slice(0, counts.complex).map(inTube), radius: 0.08, color: 'bad', label: 'FeSCN²⁺' });
  if (counts.ppt) items.push({ id: 'AgSCN', kind: 'particles', points: S_PPT.slice(0, counts.ppt).map((s) => [(s.p[0] - 0.5) * 0.7, 0.06 + s.p[1] * 0.12, (s.p[2] - 0.5) * 0.7] as Vec3), radius: 0.05, color: 'surface', label: 'AgSCN' });
  const q = Number.isFinite(inp.Q) ? fmtSig(inp.Q, 3) : Number.isNaN(inp.Q) ? '—' : '∞';
  let description = `Tubo de ensayo en 3D con ${fmt(inp.volumeML, 2)} mL a ${fmt(inp.temperature, 0)} °C. Cada punto es 1 µmol en el tubo: ${counts.fe} de Fe³⁺ (ocre), ${counts.scn} de SCN⁻ (celeste) y ${counts.complex} de FeSCN²⁺ (rojo, el que da el color)${counts.ppt ? `, y ${counts.ppt} de AgSCN precipitado en el fondo` : ''}. `;
  description += `Q = ${q} y K = ${fmtSig(inp.K, 3)} L/mol. `;
  description += !inp.perturbed ? 'Reactivos y producto coexisten: la reacción directa y la inversa ocurren a la vez con la misma rapidez.'
    : inp.settled ? `Tras la perturbación, el sistema se desplazó ${DIR[inp.direction]} y volvió al equilibrio.`
      : `El sistema está respondiendo a la perturbación: se desplaza ${DIR[inp.direction]}.`;
  return { items, extent: 2.6, target: [0, 2, 0], description, counts };
}

export interface No2SceneInput {
  nNO2: number; nN2O4: number; // mmol (los mostrados por el banco)
  volume: number; // mL
  temperature: number;
  intensity: number; // relativa (100 = inicial)
  K: number; Q: number;
  direction: 'productos' | 'reactivos' | 'ninguno';
  settled: boolean;
  perturbed: boolean;
}

export function no2Scene(inp: No2SceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; counts: { no2: number; n2o4: number } } {
  const L = 5 * (inp.volume / 100); // 100 mL = 5 unidades
  const no2 = Math.min(80, Math.round(inp.nNO2 / MMOL_PER_MOLECULE));
  const n2o4 = Math.min(60, Math.round(inp.nN2O4 / MMOL_PER_MOLECULE));
  const inGas = (s: { p: Vec3 }): Vec3 => [0.15 + s.p[0] * Math.max(0.1, L - 0.3), (s.p[1] - 0.5) * 0.9, (s.p[2] - 0.5) * 0.9];
  const pairs: Vec3[] = [];
  S_N2O4.slice(0, n2o4).forEach((s) => { const c = inGas(s); pairs.push([c[0] - 0.07, c[1], c[2]], [c[0] + 0.07, c[1], c[2]]); });
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [2.8, -1.2, 0], size: [8, 3], color: 'surface-3' },
    { id: 'jeringa', kind: 'rod', from: [0, 0, 0], to: [5.3, 0, 0], radius: 0.72, color: 'line-strong', opacity: 0.16 },
    { id: 'gas', kind: 'rod', from: [0.02, 0, 0], to: [L, 0, 0], radius: 0.68, color: '#8b3a1a', opacity: Math.min(0.45, 0.05 + 0.13 * (inp.intensity / 100)) },
    { id: 'embolo', kind: 'rod', from: [L, 0, 0], to: [L + 0.15, 0, 0], radius: 0.7, color: '#3a4448', label: `${fmt(inp.volume, 0)} mL` },
    { id: 'vastago', kind: 'rod', from: [L + 0.15, 0, 0], to: [L + 1.8, 0, 0], radius: 0.1, color: 'ink-3' },
    { id: 'tapon', kind: 'rod', from: [-0.4, 0, 0], to: [0, 0, 0], radius: 0.18, color: 'ink-2' },
  ];
  if (no2) items.push({ id: 'NO2', kind: 'particles', points: S_NO2.slice(0, no2).map(inGas), radius: 0.09, color: '#a0461e', label: 'NO₂' });
  if (pairs.length) items.push({ id: 'N2O4', kind: 'particles', points: pairs, radius: 0.075, color: 'series-8', label: 'N₂O₄' });
  if (inp.temperature !== 25) items.push({ id: 'bano', kind: 'box', center: [2.65, -0.1, 0], size: [6, 1.9, 1.9], color: inp.temperature > 25 ? 'series-1' : 'series-5', opacity: Math.min(0.25, 0.06 + Math.abs(inp.temperature - 25) / 250), label: `Baño ${fmt(inp.temperature, 0)} °C` });
  const q = Number.isFinite(inp.Q) ? fmtSig(inp.Q, 3) : '∞';
  let description = `Jeringa sellada en 3D con ${fmt(inp.volume, 0)} mL a ${fmt(inp.temperature, 0)} °C. Cada molécula dibujada es 0,05 mmol: ${no2} de NO₂ (pardo, colorea el gas) y ${n2o4} de N₂O₄ (pares de esferas grises, incoloro). Intensidad del color ${fmt(inp.intensity, 0)} (100 = inicial). Q = ${q} y K = ${fmtSig(inp.K, 3)} bar⁻¹. `;
  description += !inp.perturbed ? 'Las dos reacciones, 2 NO₂ → N₂O₄ y N₂O₄ → 2 NO₂, ocurren a la vez y con la misma rapidez.'
    : inp.settled ? `Tras el cambio, el sistema se desplazó ${DIR[inp.direction]} (Le Châtelier) y quedó en un nuevo equilibrio.`
      : `El sistema está respondiendo: se desplaza ${DIR[inp.direction]}.`;
  return { items, extent: 3.3, target: [2.6, 0, 0], description, counts: { no2, n2o4 } };
}

/**
 * «ph» (lote 3D-4): el vaso de la solución en 3D con iones H₃O⁺ y OH⁻. Funciones PURAS a partir del pH del MISMO modelo
 * (src/models/acidbase.ts → titrate o dilutedPH, con lo que muestra el banco):
 *   [H₃O⁺] = 10^(−pH) y [OH⁻] = Kw/[H₃O⁺] = 10^(pH − 14) mol/L.
 * Entre pH 1 y pH 13 esas concentraciones difieren hasta 10¹² veces: dibujadas en proporción real, uno de los dos iones
 * no tendría ni un punto. Por eso la escala es LOGARÍTMICA y se dice: cada potencia de 10 vale 3 puntos, desde 10⁻¹⁴ mol/L
 * (n = 3·(14 + log₁₀ c)). Así H₃O⁺ tiene 3·(14 − pH) puntos y OH⁻ 3·pH: a pH 7 hay los mismos, y cada unidad de pH que
 * cambia mueve 3 puntos de un ion al otro. Dos columnas con una marca por potencia de 10 muestran la misma escala.
 */
import { fmt, fmtSig } from '../../lib/format';
import { normalizeHex } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';
import { seeds } from './elec3d';

export const DOTS_PER_DECADE = 3;
const DECADE_H = 0.17;
const S_H = seeds(45, 71), S_OH = seeds(45, 73);

/** Puntos dibujados para una concentración (mol/L) con la escala logarítmica. */
export const logDots = (c: number) => Math.max(0, Math.round(DOTS_PER_DECADE * (14 + Math.log10(Math.max(1e-14, c)))));
export const ions = (pH: number) => ({ h3o: 10 ** -pH, oh: 10 ** (pH - 14) });

/** Mezcla lineal de dos colores «#rrggbb» (o rgba/rgb), para el viraje del indicador. */
export function mixHex(a: string, b: string, t: number): `#${string}` {
  const A = normalizeHex(a) ?? '#ffffff', B = normalizeHex(b) ?? '#ffffff';
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const k = Math.max(0, Math.min(1, t));
  return `#${[0, 1, 2].map((i) => Math.round(ch(A, i) + (ch(B, i) - ch(A, i)) * k).toString(16).padStart(2, '0')).join('')}`;
}

export interface PhSceneInput {
  pH: number;
  /** Qué pasa en el banco (titulación o dilución), para la descripción. */
  context: string;
  /** Indicador de la titulación (color ácido y básico, zona de viraje); null en la dilución. */
  indicator: { name: string; low: number; high: number; acidColor: string; baseColor: string } | null;
}

export function phScene(inp: PhSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; counts: { h3o: number; oh: number } } {
  const { h3o, oh } = ions(inp.pH);
  const counts = { h3o: Math.min(45, logDots(h3o)), oh: Math.min(45, logDots(oh)) };
  const H = 2.2, R = 1.1;
  const inBeaker = (s: { p: Vec3 }): Vec3 => { const a = s.p[0] * 2 * Math.PI, r = (R - 0.15) * Math.sqrt(s.p[2]); return [r * Math.cos(a), 0.12 + s.p[1] * (H - 0.3), r * Math.sin(a)]; };
  let liquid: `#${string}` = '#9fd3ea';
  if (inp.indicator) {
    const ind = inp.indicator;
    liquid = mixHex(ind.acidColor, ind.baseColor, (inp.pH - ind.low) / (ind.high - ind.low));
  }
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0.8, -0.01, 0], size: [5, 3], color: 'surface-3' },
    { id: 'vaso', kind: 'rod', from: [0, 0, 0], to: [0, H + 0.4, 0], radius: R + 0.05, color: 'line-strong', opacity: 0.14 },
    { id: 'solucion', kind: 'rod', from: [0, 0.02, 0], to: [0, H, 0], radius: R, color: liquid, opacity: 0.22 },
  ];
  if (counts.h3o) items.push({ id: 'H3O', kind: 'particles', points: S_H.slice(0, counts.h3o).map(inBeaker), radius: 0.08, color: 'series-1', label: 'H₃O⁺' });
  if (counts.oh) items.push({ id: 'OH', kind: 'particles', points: S_OH.slice(0, counts.oh).map(inBeaker), radius: 0.08, color: 'series-2', label: 'OH⁻' });
  // Columnas logarítmicas: altura = 14 + log₁₀ c (una marca por potencia de 10).
  const col = (id: string, x: number, c: number, color: SceneItem['color']) => {
    const dec = 14 + Math.log10(Math.max(1e-14, c));
    items.push({ id, kind: 'box', center: [x, (dec * DECADE_H) / 2, -0.2], size: [0.32, Math.max(0.01, dec * DECADE_H), 0.32], color });
  };
  col('col-H3O', 1.9, h3o, 'series-1');
  col('col-OH', 2.4, oh, 'series-2');
  for (let d = 0; d <= 14; d += 1) items.push({ id: `marca-${d}`, kind: 'rod', from: [1.65, d * DECADE_H, -0.42], to: [2.65, d * DECADE_H, -0.42], radius: d % 7 === 0 ? 0.014 : 0.007, color: 'ink-3', opacity: 0.8 });

  const ratio = 10 ** Math.abs(14 - 2 * inp.pH);
  const more = inp.pH < 7 ? 'H₃O⁺ que OH⁻' : 'OH⁻ que H₃O⁺';
  const description = `Vaso de la solución en 3D: ${inp.context} pH ${fmt(inp.pH, 2)}, así que [H₃O⁺] = ${fmtSig(h3o, 2)} mol/L y [OH⁻] = ${fmtSig(oh, 2)} mol/L${Math.abs(inp.pH - 7) < 0.005 ? ' (iguales: neutra)' : `: hay ${ratio >= 1e4 ? `unas 10^${fmt(Math.abs(14 - 2 * inp.pH), 1)}` : fmtSig(ratio, 2)} veces más ${more}`}. `
    + `Escala LOGARÍTMICA, no proporcional: cada potencia de 10 vale 3 puntos, así que hay ${counts.h3o} puntos rojos de H₃O⁺ y ${counts.oh} azules de OH⁻ (a pH 7 serían 21 y 21; cada unidad de pH pasa 3 puntos de un ion al otro). Las dos columnas tienen una marca por cada potencia de 10 desde 10⁻¹⁴ mol/L.`
    + (inp.indicator ? ` El líquido tiene el color del indicador ${inp.indicator.name.toLowerCase()} a ese pH.` : '');
  return { items, extent: 2.3, target: [0.9, 1.2, 0], description, counts };
}

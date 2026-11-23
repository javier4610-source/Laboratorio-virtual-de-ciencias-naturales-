/**
 * «reto» (lote 3D-7): gráfico de dispersión 3D de los datos sintéticos del reto. Funciones PURAS con los MISMOS datos del
 * banco (src/models/inquiry.ts → collect y analyze) y la misma recolección:
 *   - cada muestra ya recolectada es un punto con x = variable independiente, profundidad = variable de confusión
 *     registrada y altura = respuesta y (la lectura con ruido del modelo); se ven solo las muestras que el banco ya mostró;
 *   - las «sombras» de los puntos en la pared del fondo forman la gráfica y–x del banco y en la pared lateral, la
 *     gráfica y–confusión: al girar la nube se ve si la respuesta sigue a x, a la otra variable o a las dos;
 *   - al terminar la recolección, la recta de mínimos cuadrados del análisis del banco va en la pared y–x y el texto da la
 *     correlación entre la confusión y x que calcula el análisis.
 * Escalas: los ejes se fijan con TODAS las muestras de la campaña (no cambian mientras se recolecta) y miden 10 (x), 6
 * (confusión) y 6 (y) unidades; si la confusión no varía, su eje es un punto medio. Dibujo: paredes, postes y colores.
 */
import { fmt } from '../../lib/format';
import type { ConfoundMode, InquiryAnalysis, Sample, SystemDef } from '../../models/inquiry';
import type { SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';

export const X_LEN = 10, Z_LEN = 6, Y_LEN = 6;
const TERCILE: SceneColor[] = ['series-2', 'series-5', 'series-1'];

/** Escala lineal de [a, b] a [0, L] (si a = b, el punto medio). */
export function axisScale(values: readonly number[], L: number): { lo: number; hi: number; at: (v: number) => number } {
  const lo = Math.min(...values), hi = Math.max(...values);
  if (!(hi - lo > 1e-12)) return { lo, hi, at: () => L / 2 };
  return { lo, hi, at: (v: number) => ((v - lo) / (hi - lo)) * L };
}

export interface InquirySceneInput {
  sys: SystemDef;
  /** Todas las muestras de la campaña (para fijar los ejes) y cuántas ya mostró el banco. */
  samples: readonly Sample[];
  shown: number;
  confound: ConfoundMode;
  /** Análisis del banco (solo al terminar la recolección). */
  analysis: InquiryAnalysis | null;
  seed: number;
}

export function inquiryScene(inp: InquirySceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; points: Vec3[] } {
  const { sys } = inp;
  const items: SceneItem[] = [
    { id: 'piso', kind: 'plane', center: [X_LEN / 2, 0, Z_LEN / 2], size: [X_LEN, Z_LEN], color: 'surface-3', opacity: 0.6 },
    { id: 'pared-yx', kind: 'box', center: [X_LEN / 2, Y_LEN / 2, -0.03], size: [X_LEN, Y_LEN, 0.04], color: 'surface-2', opacity: 0.45 },
    { id: 'pared-yz', kind: 'box', center: [-0.03, Y_LEN / 2, Z_LEN / 2], size: [0.04, Y_LEN, Z_LEN], color: 'surface-2', opacity: 0.45 },
    { id: 'eje-x', kind: 'arrow', from: [0, 0, Z_LEN], vector: [X_LEN + 0.7, 0, 0], radius: 0.05, color: 'ink-2', label: `${sys.x.label} (${sys.x.unit}): variable independiente`, tag: 'x' },
    { id: 'eje-z', kind: 'arrow', from: [X_LEN, 0, 0], vector: [0, 0, Z_LEN + 0.7], radius: 0.05, color: 'ink-2', label: `${sys.confound.label} (${sys.confound.unit}): variable de confusión`, tag: 'confusión' },
    { id: 'eje-y', kind: 'arrow', from: [0, 0, 0], vector: [0, Y_LEN + 0.7, 0], radius: 0.05, color: 'ink-2', label: `${sys.y.label} (${sys.y.unit}): respuesta`, tag: 'y' },
  ];
  const points: Vec3[] = [];
  if (!inp.samples.length) {
    return { items, extent: 7, target: [X_LEN / 2, Y_LEN / 2, Z_LEN / 2], narrow: { extent: 8.4, target: [X_LEN / 2, Y_LEN / 2, Z_LEN / 2] },
      description: `Gráfico de dispersión 3D vacío: eje x, ${sys.x.label.toLowerCase()}; profundidad, ${sys.confound.label.toLowerCase()}; altura, ${sys.y.label.toLowerCase()}. Pulsa «Recolectar datos» para ver aparecer las muestras.`, points };
  }
  const sx = axisScale(inp.samples.map((s) => s.x), X_LEN), sz = axisScale(inp.samples.map((s) => s.confound), Z_LEN), sy = axisScale(inp.samples.map((s) => s.y), Y_LEN);
  const vis = inp.samples.slice(0, inp.shown);
  const third = (c: number) => (sz.hi - sz.lo > 1e-12 ? Math.min(2, Math.floor(((c - sz.lo) / (sz.hi - sz.lo)) * 3)) : 1);
  const groups: Vec3[][] = [[], [], []];
  const wallYX: Vec3[] = [], wallYZ: Vec3[] = [];
  vis.forEach((s, i) => {
    const p: Vec3 = [sx.at(s.x), sy.at(s.y), sz.at(s.confound)];
    points.push(p);
    groups[third(s.confound)].push(p);
    wallYX.push([p[0], p[1], 0.04]);
    wallYZ.push([0.04, p[1], p[2]]);
    items.push({ id: `poste-${i}`, kind: 'rod', from: [p[0], 0, p[2]], to: p, radius: 0.025, color: 'line-strong', opacity: 0.7 });
  });
  const names = [`${sys.confound.label} baja`, `${sys.confound.label} media`, `${sys.confound.label} alta`];
  groups.forEach((g, t) => { if (g.length) items.push({ id: `muestras-${t}`, kind: 'particles', points: g, radius: 0.17, color: TERCILE[t], label: `Muestras: ${names[t].toLowerCase()} (tercio de su rango)`, tag: '' }); });
  if (wallYX.length) items.push({ id: 'sombra-yx', kind: 'particles', points: wallYX, radius: 0.09, color: 'ink-3', opacity: 0.7, label: 'Sombra en la pared del fondo: y contra x (la gráfica del banco)', tag: '' });
  if (wallYZ.length) items.push({ id: 'sombra-yz', kind: 'particles', points: wallYZ, radius: 0.09, color: 'ink-3', opacity: 0.7, label: 'Sombra en la pared lateral: y contra la variable de confusión', tag: '' });
  const a = inp.analysis;
  if (a && Number.isFinite(a.slope) && Number.isFinite(a.intercept)) {
    const yAt = (x: number) => a.slope * x + a.intercept;
    const p0: Vec3 = [0, sy.at(yAt(sx.lo)), 0.08], p1: Vec3 = [X_LEN, sy.at(yAt(sx.hi)), 0.08];
    const clampY = (p: Vec3): Vec3 => [p[0], Math.max(-0.5, Math.min(Y_LEN + 0.5, p[1])), p[2]];
    items.push({ id: 'recta', kind: 'rod', from: clampY(p0), to: clampY(p1), radius: 0.05, color: 'series-3', label: `Recta de mínimos cuadrados: pendiente ${fmt(a.slope, 3)} ${sys.y.unit} por ${sys.x.unit}`, tag: 'ajuste' });
  }
  const confText = { constante: 'se mantuvo constante', aleatorizado: 'se aleatorizó', 'sin-control': 'no se controló' }[inp.confound];
  let description = `Gráfico de dispersión 3D (datos sintéticos, semilla ${inp.seed}): ${vis.length} de ${inp.samples.length} muestras. Eje x, ${sys.x.label.toLowerCase()} (${fmt(sx.lo, sys.x.decimals)} a ${fmt(sx.hi, sys.x.decimals)} ${sys.x.unit}); profundidad, ${sys.confound.label.toLowerCase()}`
    + (sz.hi - sz.lo > 1e-12 ? ` (del rango de la campaña; color por tercios)` : ' (constante en toda la campaña)')
    + `; altura, ${sys.y.label.toLowerCase()}. La variable de confusión ${confText}. Las sombras en la pared del fondo son la gráfica y–x del banco; las de la pared lateral muestran y contra la variable de confusión. Gira la nube para ver de cuál de las dos depende la respuesta.`;
  if (a) {
    description += ` Análisis del banco: pendiente ${fmt(a.slope, 3)} ${sys.y.unit} por ${sys.x.unit}, r = ${fmt(a.r, 2)}${Number.isFinite(a.confoundR) ? `; la variable de confusión tiene r = ${fmt(a.confoundR, 2)} con x en este diseño${Math.abs(a.confoundR) >= 0.5 ? ': cambia junto con x, así que puede explicar parte de la tendencia' : ''}` : ''}.`;
  }
  return { items, extent: 7, target: [X_LEN / 2, Y_LEN / 2, Z_LEN / 2], narrow: { extent: 8.4, target: [X_LEN / 2, Y_LEN / 2, Z_LEN / 2] }, description, points };
}

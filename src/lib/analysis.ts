/**
 * Prepara los datos del cuaderno para graficar y ajustar: elige columnas, aplica la
 * linealización de ejes y calcula las barras de incertidumbre (± media resolución).
 * Lo comparten el cuaderno (DataPanel) y el informe del estudiante.
 */
import type { Column, Dataset, DatasetAnalysis, Trial, TrialValue } from '../core/types';
import { AXIS_TRANSFORMS, FIT_MODELS, applyTransform, fitModel, propagateTransform, transformAxis, type AxisTransform, type FitModel, type FitOutcome } from './fit';
import { describe, type Stats } from './measurement';
import { fmt } from './format';

export interface AnalysisPoint { x: number; y: number; label: string; ex?: number; ey?: number; }

/** Qué se grafica: cada ensayo, o el promedio de los ensayos repetidos con barras de ±1 DE o ±EE. */
export type AverageMode = '' | 'sd' | 'sem';

export interface NormalizedAnalysis { x: string; y: string; group: string; model: FitModel; xT: AxisTransform; yT: AxisTransform; avg: AverageMode; }

const isModel = (v: unknown): v is FitModel => FIT_MODELS.some((m) => m.value === v);
const isTransform = (v: unknown): v is AxisTransform => AXIS_TRANSFORMS.some((t) => t.value === v);

export function normalizeAnalysis(ds: Dataset, a?: Partial<DatasetAnalysis>): NormalizedAnalysis {
  const numeric = ds.columns.filter((c) => c.numeric).map((c) => c.key);
  const text = ds.columns.filter((c) => !c.numeric).map((c) => c.key);
  return {
    x: a?.x && numeric.includes(a.x) ? a.x : ds.defaultX,
    y: a?.y && numeric.includes(a.y) ? a.y : ds.defaultY,
    group: a?.group && text.includes(a.group) ? a.group : '',
    model: isModel(a?.model) ? a.model : 'none',
    xT: isTransform(a?.xT) ? a.xT : 'x',
    yT: isTransform(a?.yT) ? a.yT : 'x',
    avg: a?.avg === 'sd' || a?.avg === 'sem' ? a.avg : '',
  };
}

/* ------------------------------------------------------------------ ensayos repetidos */

export interface RepeatGroup {
  /** Clave estable formada por los valores de las columnas de entrada. */
  key: string;
  /** Descripción legible de las condiciones (p. ej. «Aluminio · Arista 2,0 cm · V inicial 50,0 mL»). */
  label: string;
  inputs: Record<string, TrialValue>;
  trials: Trial[];
  /** Estadística de cada columna numérica medida (no de entrada). */
  stats: Record<string, Stats>;
}

/** Columnas numéricas medidas: las que no son variables de entrada. */
export const measuredColumns = (ds: Dataset) => ds.columns.filter((c) => c.numeric && !c.input);

const inputText = (c: Column, v: TrialValue) =>
  v === null || v === undefined ? '—' : typeof v === 'number' ? `${fmt(v, c.decimals ?? 2)}${c.unit ? ` ${c.unit}` : ''}` : v;

/**
 * Agrupa los ensayos que comparten exactamente las mismas variables de entrada (columnas `input: true`)
 * y calcula n, media, DE y EE de cada columna medida. Conserva el orden de aparición.
 */
export function groupTrials(ds: Dataset, trials: Trial[]): RepeatGroup[] {
  const inputs = ds.columns.filter((c) => c.input);
  const map = new Map<string, RepeatGroup>();
  for (const t of trials) {
    if (t.datasetId !== ds.id) continue;
    const key = JSON.stringify(inputs.map((c) => t.values[c.key] ?? null));
    let g = map.get(key);
    if (!g) {
      g = {
        key, trials: [], stats: {},
        inputs: Object.fromEntries(inputs.map((c) => [c.key, t.values[c.key] ?? null])),
        label: inputs.map((c) => (c.numeric ? `${c.label} ${inputText(c, t.values[c.key] ?? null)}` : inputText(c, t.values[c.key] ?? null))).join(' · ') || 'Todos los ensayos',
      };
      map.set(key, g);
    }
    g.trials.push(t);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    for (const c of ds.columns.filter((x) => x.numeric)) {
      g.stats[c.key] = describe(g.trials.map((t) => t.values[c.key]).filter((v): v is number => typeof v === 'number'));
    }
  }
  return groups;
}

export const columnAxisText = (c?: Pick<Column, 'label' | 'unit'>) => (c ? `${c.label}${c.unit ? ` (${c.unit})` : ''}` : '');

export interface AnalysisData {
  ax: NormalizedAnalysis;
  xc?: Column; yc?: Column;
  xAxis: { label: string; unit: string; text: string };
  yAxis: { label: string; unit: string; text: string };
  series: { label: string; points: AnalysisPoint[] }[];
  /** Puntos descartados porque la transformación no está definida (p. ej. ln de 0). */
  dropped: number;
  /** Ajuste del conjunto (solo si no hay agrupación y se eligió un modelo). */
  fit: FitOutcome | null;
}

export function buildAnalysis(ds: Dataset, trials: Trial[], raw?: Partial<DatasetAnalysis>): AnalysisData {
  const ax = normalizeAnalysis(ds, raw);
  const xc = ds.columns.find((c) => c.key === ax.x);
  const yc = ds.columns.find((c) => c.key === ax.y);
  const xAxis = transformAxis(ax.xT, xc?.label ?? '', xc?.unit ?? '');
  const yAxis = transformAxis(ax.yT, yc?.label ?? '', yc?.unit ?? '');
  const groups = new Map<string, AnalysisPoint[]>();
  let dropped = 0;
  const push = (g: string, p: AnalysisPoint) => { const arr = groups.get(g) ?? []; arr.push(p); groups.set(g, arr); };
  if (ax.avg) {
    // Promedios de los ensayos repetidos con barras de ±1 DE o ±EE (propagadas a través de la linealización).
    for (const rg of groupTrials(ds, trials)) {
      const sx = rg.stats[ax.x], sy = rg.stats[ax.y];
      if (!sx || !sy || sx.n === 0 || sy.n === 0) continue;
      const x = applyTransform(ax.xT, sx.mean), y = applyTransform(ax.yT, sy.mean);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { dropped++; continue; }
      const spread = (s: Stats) => (s.n >= 2 ? (ax.avg === 'sd' ? s.sd : s.sem) : NaN);
      const p: AnalysisPoint = { x, y, label: `${rg.label} (n = ${sy.n})` };
      const dx = spread(sx), dy = spread(sy);
      // Con una sola lectura se usa la media resolución, como en los ensayos individuales.
      const ux = Number.isFinite(dx) ? dx : xc?.resolution ? xc.resolution / 2 : 0;
      const uy = Number.isFinite(dy) ? dy : yc?.resolution ? yc.resolution / 2 : 0;
      if (ux > 0) p.ex = propagateTransform(ax.xT, sx.mean, ux);
      if (uy > 0) p.ey = propagateTransform(ax.yT, sy.mean, uy);
      push(ax.group ? String(rg.trials[0].values[ax.group] ?? '—') : 'Promedios', p);
    }
  } else trials.filter((t) => t.datasetId === ds.id).forEach((t, i) => {
    const xr = t.values[ax.x], yr = t.values[ax.y];
    if (typeof xr !== 'number' || typeof yr !== 'number') return;
    const x = applyTransform(ax.xT, xr), y = applyTransform(ax.yT, yr);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { dropped++; return; }
    const p: AnalysisPoint = { x, y, label: `Ensayo ${i + 1}` };
    if (xc?.resolution) p.ex = propagateTransform(ax.xT, xr, xc.resolution / 2);
    if (yc?.resolution) p.ey = propagateTransform(ax.yT, yr, yc.resolution / 2);
    push(ax.group ? String(t.values[ax.group] ?? '—') : 'Ensayos', p);
  });
  const series = [...groups.entries()].map(([label, points]) => ({ label, points }));
  const fit = ax.model !== 'none' && series.length === 1
    ? fitModel(ax.model, series[0].points.map((p) => p.x), series[0].points.map((p) => p.y), { x: xAxis.unit, y: yAxis.unit })
    : null;
  return { ax, xc, yc, xAxis, yAxis, series, dropped, fit };
}

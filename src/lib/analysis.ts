/**
 * Prepara los datos del cuaderno para graficar y ajustar: elige columnas, aplica la
 * linealización de ejes y calcula las barras de incertidumbre (± media resolución).
 * Lo comparten el cuaderno (DataPanel) y el informe del estudiante.
 */
import type { Column, Dataset, DatasetAnalysis, Trial } from '../core/types';
import { AXIS_TRANSFORMS, FIT_MODELS, applyTransform, fitModel, propagateTransform, transformAxis, type AxisTransform, type FitModel, type FitOutcome } from './fit';

export interface AnalysisPoint { x: number; y: number; label: string; ex?: number; ey?: number; }

export interface NormalizedAnalysis { x: string; y: string; group: string; model: FitModel; xT: AxisTransform; yT: AxisTransform; }

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
  };
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
  trials.filter((t) => t.datasetId === ds.id).forEach((t, i) => {
    const xr = t.values[ax.x], yr = t.values[ax.y];
    if (typeof xr !== 'number' || typeof yr !== 'number') return;
    const x = applyTransform(ax.xT, xr), y = applyTransform(ax.yT, yr);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { dropped++; return; }
    const p: AnalysisPoint = { x, y, label: `Ensayo ${i + 1}` };
    if (xc?.resolution) p.ex = propagateTransform(ax.xT, xr, xc.resolution / 2);
    if (yc?.resolution) p.ey = propagateTransform(ax.yT, yr, yc.resolution / 2);
    const g = ax.group ? String(t.values[ax.group] ?? '—') : 'Ensayos';
    const arr = groups.get(g) ?? [];
    arr.push(p);
    groups.set(g, arr);
  });
  const series = [...groups.entries()].map(([label, points]) => ({ label, points }));
  const fit = ax.model !== 'none' && series.length === 1
    ? fitModel(ax.model, series[0].points.map((p) => p.x), series[0].points.map((p) => p.y), { x: xAxis.unit, y: yAxis.unit })
    : null;
  return { ax, xc, yc, xAxis, yAxis, series, dropped, fit };
}

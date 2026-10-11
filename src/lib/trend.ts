import { linearRegression } from '../models/math';
import type { Trend } from '../core/types';

export const TREND_LABEL: Record<Exclude<Trend, ''>, string> = {
  'aumenta': 'aumenta',
  'disminuye': 'disminuye',
  'no cambia': 'no cambia',
  'máximo': 'aumenta y luego disminuye (tiene un máximo)',
  'se estabiliza': 'aumenta y luego se estabiliza',
};

export interface TrendAnalysis { trend: Trend; n: number; r: number | null; detail: string; }

/**
 * Clasifica la relación entre x e y en los datos del estudiante.
 * Reglas explícitas (no aprendizaje automático):
 *  - Se promedian los valores de y con el mismo x y se ordena por x.
 *  - "no cambia": la variación de y es menor al 3 % de su valor medio.
 *  - "máximo": el mayor valor de y está en un punto interior y ambos extremos están al menos 15 % del rango por debajo.
 *  - "se estabiliza": crece, y el último tercio varía menos del 10 % del rango total.
 *  - En otro caso, el signo del coeficiente de correlación (|r| ≥ 0,5) decide entre aumenta / disminuye.
 */
export function detectTrend(points: { x: number; y: number }[]): TrendAnalysis {
  const groups = new Map<number, number[]>();
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const arr = groups.get(p.x) ?? [];
    arr.push(p.y);
    groups.set(p.x, arr);
  }
  const pts = [...groups.entries()].map(([x, ys]) => ({ x, y: ys.reduce((a, b) => a + b, 0) / ys.length })).sort((a, b) => a.x - b.x);
  const n = pts.length;
  if (n < 3) return { trend: '', n, r: null, detail: 'Se necesitan al menos 3 valores distintos de la variable independiente para identificar una tendencia.' };
  const ys = pts.map((p) => p.y);
  const max = Math.max(...ys), min = Math.min(...ys);
  const range = max - min;
  const mean = ys.reduce((a, b) => a + b, 0) / n;
  const reg = linearRegression(pts.map((p) => p.x), ys);
  const r = reg ? reg.r : 0;
  if (range <= Math.max(1e-12, Math.abs(mean) * 0.03)) {
    return { trend: 'no cambia', n, r, detail: 'Los valores de la variable dependiente son prácticamente iguales.' };
  }
  const iMax = ys.indexOf(max);
  if (iMax > 0 && iMax < n - 1 && ys[0] < max - 0.15 * range && ys[n - 1] < max - 0.15 * range) {
    return { trend: 'máximo', n, r, detail: `El valor más alto se observa en x = ${pts[iMax].x}, y disminuye a ambos lados.` };
  }
  if (n >= 4 && r > 0.5) {
    const third = Math.max(2, Math.ceil(n / 3));
    const tail = ys.slice(n - third);
    const tailRange = Math.max(...tail) - Math.min(...tail);
    if (tailRange < 0.1 * range && ys[n - 1] >= max - 0.1 * range) {
      return { trend: 'se estabiliza', n, r, detail: 'Crece al principio y luego casi no cambia en los valores más altos.' };
    }
  }
  if (r >= 0.5) return { trend: 'aumenta', n, r, detail: `Correlación positiva (r = ${r.toFixed(2)}).` };
  if (r <= -0.5) return { trend: 'disminuye', n, r, detail: `Correlación negativa (r = ${r.toFixed(2)}).` };
  return { trend: '', n, r, detail: `No hay una tendencia clara (r = ${r.toFixed(2)}). Revisa si cambiaste más de una variable a la vez.` };
}

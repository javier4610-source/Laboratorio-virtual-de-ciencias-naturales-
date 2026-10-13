/**
 * Ajustes por mínimos cuadrados y linealización de ejes para el cuaderno de laboratorio.
 * Funciones puras (sin React ni navegador) para poder probarlas con Vitest.
 *
 * Incertidumbres: error estándar de cada parámetro a partir de la matriz de covarianza
 * s²·(XᵀX)⁻¹, con s² = Σ residuos² / (n − p) (p = número de parámetros).
 * En los modelos que se ajustan por linealización (exponencial y potencia) el error de A
 * se propaga con el método delta: σ_A = A·σ_ln A.
 */
import { fmt, fmtSig } from './format';

export type FitModel = 'none' | 'linear' | 'proportional' | 'quadratic' | 'exponential' | 'power' | 'logarithmic';

export const FIT_MODELS: { value: FitModel; label: string; equation: string }[] = [
  { value: 'none', label: 'Ninguno', equation: '' },
  { value: 'linear', label: 'Lineal: y = m·x + b', equation: 'y = m·x + b' },
  { value: 'proportional', label: 'Proporcional: y = k·x', equation: 'y = k·x' },
  { value: 'quadratic', label: 'Cuadrático: y = A·x² + B·x + C', equation: 'y = A·x² + B·x + C' },
  { value: 'exponential', label: 'Exponencial: y = A·e^(k·x)', equation: 'y = A·e^(k·x)' },
  { value: 'power', label: 'Potencia: y = A·xⁿ', equation: 'y = A·xⁿ' },
  { value: 'logarithmic', label: 'Logarítmico: y = a + b·ln x', equation: 'y = a + b·ln x' },
];

export const FIT_LABEL: Record<FitModel, string> = Object.fromEntries(FIT_MODELS.map((m) => [m.value, m.label.split(':')[0].toLowerCase()])) as Record<FitModel, string>;

export interface FitParam { name: string; value: number; se: number; unit: string; }

export interface FitResult {
  model: Exclude<FitModel, 'none'>;
  equation: string;
  params: FitParam[];
  /** Coeficiente de determinación calculado en la escala original de y: 1 − SSres/SStot. */
  r2: number;
  n: number;
  /** Desviación estándar de los residuos, √(SSres/(n − p)). NaN si no hay grados de libertad. */
  s: number;
  /** Grados de libertad n − p. */
  dof: number;
  /** El ajuste se hizo transformando los datos (ln y o ln x). */
  linearized: boolean;
  predict: (x: number) => number;
  residuals: { x: number; y: number; fit: number; r: number }[];
}

export type FitOutcome = { ok: true; fit: FitResult } | { ok: false; reason: string };

/** Mínimos cuadrados lineales generales: y ≈ X·β. Devuelve β, su covarianza (sin escalar por s²) y SSres. */
export function leastSquares(X: number[][], y: number[]): { beta: number[]; inv: number[][]; ssr: number } | null {
  const n = X.length, p = X[0]?.length ?? 0;
  if (n < p || p === 0) return null;
  // Escala de columnas para mejorar el condicionamiento de XᵀX.
  const scale = Array.from({ length: p }, (_, j) => Math.max(...X.map((r) => Math.abs(r[j]))) || 1);
  const Z = X.map((r) => r.map((v, j) => v / scale[j]));
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0)));
  const inv = invert(A);
  if (!inv) return null;
  const zty = Array.from({ length: p }, (_, i) => Z.reduce((s, r, k) => s + r[i] * y[k], 0));
  const g = inv.map((row) => row.reduce((s, v, j) => s + v * zty[j], 0));
  const beta = g.map((v, j) => v / scale[j]);
  const invScaled = inv.map((row, i) => row.map((v, j) => v / (scale[i] * scale[j])));
  const ssr = X.reduce((s, r, k) => { const e = y[k] - r.reduce((t, v, j) => t + v * beta[j], 0); return s + e * e; }, 0);
  return { beta, inv: invScaled, ssr };
}

/** Inversa por Gauss-Jordan con pivoteo parcial; null si la matriz es singular. */
export function invert(M: number[][]): number[][] | null {
  const n = M.length;
  const a = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  const norm = Math.max(...M.flat().map(Math.abs)) || 1;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    if (Math.abs(a[piv][c]) < 1e-12 * norm) return null;
    [a[c], a[piv]] = [a[piv], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f !== 0) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((r) => r.slice(n));
}

const MIN_POINTS: Record<Exclude<FitModel, 'none'>, number> = { linear: 2, proportional: 1, quadratic: 3, exponential: 2, power: 2, logarithmic: 2 };

function rSquared(ys: number[], fits: number[]): number {
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sst = ys.reduce((s, y) => s + (y - mean) ** 2, 0);
  const ssr = ys.reduce((s, y, i) => s + (y - fits[i]) ** 2, 0);
  if (sst <= 1e-300) return ssr <= 1e-300 ? 1 : 0;
  return 1 - ssr / sst;
}

const wrapUnit = (u: string) => (/[/·\s]/.test(u) ? `(${u})` : u);
/** Unidad de un cociente a/b (cadena vacía si no hay unidades). */
export function unitRatio(num: string, den: string): string {
  if (!num && !den) return '';
  if (!den) return num;
  return `${num ? wrapUnit(num) : '1'}/${wrapUnit(den)}`;
}

/** Ajusta el modelo indicado a los puntos (x, y). Los valores no finitos se descartan. */
export function fitModel(model: FitModel, xsIn: number[], ysIn: number[], units: { x?: string; y?: string } = {}): FitOutcome {
  if (model === 'none') return { ok: false, reason: 'Sin modelo de ajuste.' };
  const pts = xsIn.map((x, i) => ({ x, y: ysIn[i] })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const n = pts.length;
  const xu = units.x ?? '', yu = units.y ?? '';
  const need = MIN_POINTS[model];
  if (n < need) return { ok: false, reason: `El ajuste ${FIT_LABEL[model]} necesita al menos ${need} ${need === 1 ? 'punto' : 'puntos'}.` };
  if (new Set(xs).size < Math.min(need, 2) && model !== 'proportional') return { ok: false, reason: 'Los puntos deben tener al menos dos valores distintos de x.' };

  let X: number[][], Y: number[], linearized = false;
  switch (model) {
    case 'linear': X = xs.map((x) => [x, 1]); Y = ys; break;
    case 'proportional': X = xs.map((x) => [x]); Y = ys; break;
    case 'quadratic':
      if (new Set(xs).size < 3) return { ok: false, reason: 'El ajuste cuadrático necesita al menos tres valores distintos de x.' };
      X = xs.map((x) => [x * x, x, 1]); Y = ys; break;
    case 'exponential':
      if (ys.some((y) => y <= 0)) return { ok: false, reason: 'El ajuste exponencial se calcula linealizando con ln y: todos los valores de y deben ser positivos (y > 0).' };
      X = xs.map((x) => [x, 1]); Y = ys.map(Math.log); linearized = true; break;
    case 'power':
      if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) return { ok: false, reason: 'El ajuste de potencia se calcula linealizando con ln x y ln y: todos los valores de x y de y deben ser positivos.' };
      X = xs.map((x) => [Math.log(x), 1]); Y = ys.map(Math.log); linearized = true; break;
    case 'logarithmic':
      if (xs.some((x) => x <= 0)) return { ok: false, reason: 'El ajuste logarítmico requiere que todos los valores de x sean positivos (x > 0).' };
      X = xs.map((x) => [Math.log(x), 1]); Y = ys; break;
  }
  const ls = leastSquares(X, Y);
  if (!ls) return { ok: false, reason: 'Los datos no permiten calcular el ajuste (sistema singular).' };
  const p = ls.beta.length;
  const dof = n - p;
  const s2 = dof > 0 ? ls.ssr / dof : NaN;
  const se = ls.inv.map((row, i) => Math.sqrt(Math.max(0, s2 * row[i])));
  const b = ls.beta;

  let params: FitParam[], predict: (x: number) => number;
  switch (model) {
    case 'linear':
      params = [{ name: 'm', value: b[0], se: se[0], unit: unitRatio(yu, xu) }, { name: 'b', value: b[1], se: se[1], unit: yu }];
      predict = (x) => b[0] * x + b[1]; break;
    case 'proportional':
      params = [{ name: 'k', value: b[0], se: se[0], unit: unitRatio(yu, xu) }];
      predict = (x) => b[0] * x; break;
    case 'quadratic':
      params = [
        { name: 'A', value: b[0], se: se[0], unit: unitRatio(yu, xu ? `${wrapUnit(xu)}²` : '') },
        { name: 'B', value: b[1], se: se[1], unit: unitRatio(yu, xu) },
        { name: 'C', value: b[2], se: se[2], unit: yu },
      ];
      predict = (x) => b[0] * x * x + b[1] * x + b[2]; break;
    case 'exponential': {
      const A = Math.exp(b[1]);
      params = [{ name: 'A', value: A, se: A * se[1], unit: yu }, { name: 'k', value: b[0], se: se[0], unit: xu ? unitRatio('', xu) : '' }];
      predict = (x) => A * Math.exp(b[0] * x); break;
    }
    case 'power': {
      const A = Math.exp(b[1]);
      params = [{ name: 'A', value: A, se: A * se[1], unit: '' }, { name: 'n', value: b[0], se: se[0], unit: '' }];
      predict = (x) => A * x ** b[0]; break;
    }
    case 'logarithmic':
      params = [{ name: 'a', value: b[1], se: se[1], unit: yu }, { name: 'b', value: b[0], se: se[0], unit: yu }];
      predict = (x) => b[1] + b[0] * Math.log(x); break;
  }
  const fits = xs.map(predict);
  const residuals = pts.map((pt, i) => ({ x: pt.x, y: pt.y, fit: fits[i], r: pt.y - fits[i] }));
  const ssrOrig = residuals.reduce((s, r) => s + r.r * r.r, 0);
  return {
    ok: true,
    fit: {
      model, equation: FIT_MODELS.find((m) => m.value === model)!.equation, params,
      r2: rSquared(ys, fits), n, dof, s: dof > 0 ? Math.sqrt(ssrOrig / dof) : NaN,
      linearized, predict, residuals,
    },
  };
}

/* ---------- Linealización de ejes ---------- */

export type AxisTransform = 'x' | 'x2' | 'inv' | 'sqrt' | 'ln';

export const AXIS_TRANSFORMS: { value: AxisTransform; label: (v: string) => string }[] = [
  { value: 'x', label: (v) => v },
  { value: 'x2', label: (v) => `${v}²` },
  { value: 'inv', label: (v) => `1/${v}` },
  { value: 'sqrt', label: (v) => `√${v}` },
  { value: 'ln', label: (v) => `ln ${v}` },
];

/** Aplica la transformación; NaN si el valor no pertenece al dominio (p. ej. ln de un negativo). */
export function applyTransform(t: AxisTransform, v: number): number {
  switch (t) {
    case 'x': return v;
    case 'x2': return v * v;
    case 'inv': return v === 0 ? NaN : 1 / v;
    case 'sqrt': return v < 0 ? NaN : Math.sqrt(v);
    case 'ln': return v <= 0 ? NaN : Math.log(v);
  }
}

/** Inversa de la linealización de un eje: devuelve el valor original a partir del transformado (NaN si no existe). */
export function inverseTransform(t: AxisTransform, v: number): number {
  switch (t) {
    case 'x': return v;
    case 'x2': return v >= 0 ? Math.sqrt(v) : NaN;
    case 'inv': return v === 0 ? NaN : 1 / v;
    case 'sqrt': return v >= 0 ? v * v : NaN;
    case 'ln': return Math.exp(v);
  }
}

/** Propaga una incertidumbre δ a través de la transformación: |f′(v)|·δ. */
export function propagateTransform(t: AxisTransform, v: number, delta: number): number {
  switch (t) {
    case 'x': return delta;
    case 'x2': return 2 * Math.abs(v) * delta;
    case 'inv': return delta / (v * v);
    case 'sqrt': return v > 0 ? delta / (2 * Math.sqrt(v)) : NaN;
    case 'ln': return v > 0 ? delta / v : NaN;
  }
}

/** Etiqueta y unidad del eje transformado. */
export function transformAxis(t: AxisTransform, label: string, unit = ''): { label: string; unit: string; text: string } {
  let l = label, u = unit;
  const w = (s: string) => (/[\s/·()]/.test(s) ? `(${s})` : s);
  switch (t) {
    case 'x': break;
    case 'x2': l = `${w(label)}²`; u = unit ? `${w(unit)}²` : ''; break;
    case 'inv': l = `1/${w(label)}`; u = unit ? `1/${w(unit)}` : ''; break;
    case 'sqrt': l = `√${w(label)}`; u = unit ? `√${w(unit)}` : ''; break;
    case 'ln': l = unit ? `ln(${label}/${unit})` : `ln(${label})`; u = ''; break;
  }
  return { label: l, unit: u, text: u ? `${l} (${u})` : l };
}

/** Ecuación del ajuste con los valores numéricos sustituidos (4 cifras significativas). */
export function equationWithValues(f: Pick<FitResult, 'model' | 'params'>): string {
  const v = (name: string) => f.params.find((p) => p.name === name)?.value ?? NaN;
  const s = (x: number) => fmtSig(x, 4).replace("-", "−");
  const term = (x: number, suffix: string) => `${x < 0 ? '−' : '+'} ${s(Math.abs(x))}${suffix}`;
  switch (f.model) {
    case 'linear': return `y = ${s(v('m'))}·x ${term(v('b'), '')}`;
    case 'proportional': return `y = ${s(v('k'))}·x`;
    case 'quadratic': return `y = ${s(v('A'))}·x² ${term(v('B'), '·x')} ${term(v('C'), '')}`;
    case 'exponential': return `y = ${s(v('A'))}·e^(${s(v('k'))}·x)`;
    case 'power': return `y = ${s(v('A'))}·x^${s(v('n'))}`;
    case 'logarithmic': return `y = ${s(v('a'))} ${term(v('b'), '·ln x')}`;
  }
}

/* ---------- Formato con incertidumbre ---------- */

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => String(n).split('').map((c) => SUP[c] ?? c).join('');

/**
 * Escribe «valor ± incertidumbre» con la incertidumbre redondeada a 2 cifras significativas
 * y el valor redondeado a la misma posición decimal (convención de los informes de laboratorio).
 */
export function formatWithUncertainty(value: number, se: number): string {
  if (!Number.isFinite(value)) return '—';
  if (!Number.isFinite(se) || se <= 0) return `${fmtSig(value, 4)} ± —`;
  // Datos ideales sin dispersión: la incertidumbre del ajuste es solo error de redondeo de la máquina.
  if (se <= Math.max(Math.abs(value), 1e-6) * 1e-9) return `${fmtSig(Math.abs(value) < 1e-9 ? 0 : value, 6).replace('-', '−')} ± 0`;
  const big = Math.max(Math.abs(value), se);
  const exp = big >= 1e5 || big < 1e-3 ? Math.floor(Math.log10(big)) : 0;
  const v = value / 10 ** exp, e = se / 10 ** exp;
  const decimals = Math.max(0, Math.min(8, 1 - Math.floor(Math.log10(e))));
  const body = `${fmt(v, decimals).replace("-", "−")} ± ${fmt(e, decimals)}`;
  return exp === 0 ? body : `(${body}) × 10${sup(exp)}`;
}

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { linearRegression } from '../models/math';
import { fmt, fmtSig } from '../lib/format';

export interface Series {
  label: string;
  color?: string; // variable CSS, p. ej. 'var(--series-1)'
  points: { x: number; y: number; label?: string }[];
  kind?: 'line' | 'scatter' | 'both';
  dashed?: boolean;
}

interface ChartProps {
  series: Series[];
  xLabel: string;
  yLabel: string;
  title: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  /** Dibuja la recta de mejor ajuste de la primera serie y muestra su ecuación. */
  fit?: boolean;
  height?: number;
  /** Líneas de referencia horizontales. */
  hLines?: { y: number; label: string }[];
  emptyText?: string;
}

/** Calcula marcas "redondas" (1, 2, 5 × 10ⁿ) para un eje. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) { const d = Math.abs(min) || 1; min -= d * 0.5; max += d * 0.5; }
  const span = max - min;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => span / s <= count) ?? 10 * pow;
  const start = Math.ceil(min / unit - 1e-9) * unit;
  const ticks: number[] = [];
  for (let v = start; v <= max + unit * 1e-9; v += unit) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

function domainOf(values: number[], pad = 0.05, includeZero = true): [number, number] {
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values), max = Math.max(...values);
  if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (min === max) { max = min + 1; }
  const p = (max - min) * pad;
  return [min === 0 ? 0 : min - p, max + p];
}

const tickText = (v: number, ticks: number[]) => {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
  if (step !== 0 && (step < 0.001 || Math.abs(v) >= 1e5)) return fmtSig(v, 2);
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(step || 1)) + (step / 10 ** Math.floor(Math.log10(step || 1)) === 2.5 ? 1 : 0)));
  return fmt(v, decimals);
};

/**
 * Gráfica SVG accesible. Incluye título y descripción para lectores de pantalla
 * y una tabla alternativa con los mismos datos.
 */
export function Chart({ series, xLabel, yLabel, title, xDomain, yDomain, fit, height = 300, hLines, emptyText = 'Aún no hay datos para graficar.' }: ChartProps) {
  const id = useId();
  const [showTable, setShowTable] = useState(false);
  const figRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = figRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // El ancho lógico sigue al contenedor para que el texto conserve su tamaño real en pantallas pequeñas.
  const W = Math.max(300, Math.min(960, width || 640));
  const narrow = W < 480;
  const hasData = series.some((s) => s.points.length > 0);
  const H = hasData ? (narrow ? Math.min(height, 260) : height) : Math.min(height, 170);
  const m = { l: narrow ? 52 : 64, r: 12, t: 14, b: 50 };
  const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const [x0, x1] = xDomain ?? domainOf(all.map((p) => p.x));
  const [y0, y1] = yDomain ?? domainOf([...all.map((p) => p.y), ...(hLines ?? []).map((h) => h.y)]);
  const xt = niceTicks(x0, x1, narrow ? 4 : 6);
  const yt = niceTicks(y0, y1);
  const sx = (x: number) => m.l + ((x - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const sy = (y: number) => H - m.b - ((y - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);
  const clipId = `${id}-clip`.replace(/:/g, '');

  const regression = useMemo(() => {
    if (!fit || !series[0] || series[0].points.length < 2) return null;
    return linearRegression(series[0].points.map((p) => p.x), series[0].points.map((p) => p.y));
  }, [fit, series]);

  const desc = all.length === 0
    ? emptyText
    : `Gráfica de ${yLabel} en función de ${xLabel}. ${series.map((s) => `${s.label}: ${s.points.length} puntos`).join('; ')}.` +
      (regression ? ` Recta de ajuste: y = ${fmtSig(regression.slope, 3)}·x + ${fmtSig(regression.intercept, 3)}, R² = ${fmt(regression.r2, 3)}.` : '');

  return (
    <figure className="chart" style={{ margin: 0 }} ref={figRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} preserveAspectRatio="xMidYMid meet">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        <defs><clipPath id={clipId}><rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} /></clipPath></defs>
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line className="gridline" x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} />
            <text x={m.l - 6} y={sy(t)} textAnchor="end" dominantBaseline="middle">{tickText(t, yt)}</text>
          </g>
        ))}
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line className="gridline" x1={sx(t)} x2={sx(t)} y1={m.t} y2={H - m.b} />
            <text x={sx(t)} y={H - m.b + 16} textAnchor="middle">{tickText(t, xt)}</text>
          </g>
        ))}
        <line className="axis" x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} />
        <line className="axis" x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} />
        <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle">{xLabel}</text>
        <text className="axis-title" transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
        <g clipPath={`url(#${clipId})`}>
          {(hLines ?? []).map((h) => (
            <g key={h.label}>
              <line x1={m.l} x2={W - m.r} y1={sy(h.y)} y2={sy(h.y)} stroke="var(--ink-2)" strokeDasharray="5 4" />
              <text x={W - m.r - 4} y={sy(h.y) - 5} textAnchor="end">{h.label}</text>
            </g>
          ))}
          {regression && (
            <line x1={sx(x0)} y1={sy(regression.slope * x0 + regression.intercept)} x2={sx(x1)} y2={sy(regression.slope * x1 + regression.intercept)} stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="6 4" />
          )}
          {series.map((s, si) => {
            const color = s.color ?? `var(--series-${(si % 4) + 1})`;
            const pts = s.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
            const kind = s.kind ?? 'scatter';
            const sorted = kind === 'scatter' ? pts : pts;
            return (
              <g key={s.label}>
                {(kind === 'line' || kind === 'both') && sorted.length > 1 && (
                  <polyline fill="none" stroke={color} strokeWidth={2.4} strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" points={sorted.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
                )}
                {(kind === 'scatter' || kind === 'both') && pts.map((p, i) => (
                  <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={5} fill={color} stroke="var(--surface)" strokeWidth={1.5}>
                    <title>{`${p.label ? p.label + ': ' : ''}(${fmtSig(p.x, 4)}; ${fmtSig(p.y, 4)})`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </g>
        {all.length === 0 && <text x={(m.l + W - m.r) / 2} y={(m.t + H - m.b) / 2} textAnchor="middle" style={{ fontSize: 14 }}>{emptyText}</text>}
      </svg>
      <figcaption className="stack-sm" style={{ marginTop: 6 }}>
        {series.length > 1 && (
          <div className="legend">
            {series.map((s, si) => <span key={s.label}><i style={{ background: s.color ?? `var(--series-${(si % 4) + 1})` }} />{s.label}</span>)}
          </div>
        )}
        {regression && (
          <div className="small">
            Recta de ajuste: <span className="num">y = {fmtSig(regression.slope, 4)}·x {regression.intercept >= 0 ? '+' : '−'} {fmtSig(Math.abs(regression.intercept), 3)}</span> · <span className="num">R² = {fmt(regression.r2, 4)}</span>
          </div>
        )}
        {all.length > 0 && (
          <div className="no-print">
            <button type="button" className="btn small ghost" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Ocultar' : 'Ver'} los datos de la gráfica como tabla
            </button>
            {showTable && (
              <div className="table-wrap" style={{ marginTop: 6, maxHeight: 260, overflowY: 'auto' }}>
                <table>
                  <caption>{title}</caption>
                  <thead><tr><th>Serie</th><th className="n">{xLabel}</th><th className="n">{yLabel}</th></tr></thead>
                  <tbody>
                    {series.flatMap((s) => s.points.map((p, i) => (
                      <tr key={`${s.label}-${i}`}><td>{s.label}</td><td className="n">{fmtSig(p.x, 4)}</td><td className="n">{fmtSig(p.y, 4)}</td></tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </figcaption>
    </figure>
  );
}

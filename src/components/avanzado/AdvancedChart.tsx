import { useId } from 'react';
import type { ItemChart } from '../../assessment/avanzado/types';

/**
 * Gráfica estática y accesible de un ítem del banco avanzado (línea, barras o dispersión), en SVG:
 * ejes con rótulo y unidad, marcas con valores, leyenda con color y forma (no solo color), título y descripción
 * para lectores de pantalla, y debajo un desplegable con la descripción textual completa y los datos en tabla.
 */
const W = 480;
const H = 300;
const M = { l: 72, r: 14, t: 14, b: 50 };
const COLORS = ['var(--series-2)', 'var(--series-1)', 'var(--series-3)', 'var(--series-4)'];
const SHAPES = ['círculo', 'cuadrado', 'triángulo', 'rombo'] as const;

/** Parte un rótulo largo del eje y en dos líneas (magnitud y unidad) para que quepa a lo alto del área de datos. */
export function splitAxisLabel(label: string, max = 30): string[] {
  if (label.length <= max) return [label];
  const i = label.lastIndexOf(' (');
  if (i > 0) return [label.slice(0, i), label.slice(i + 1)];
  const mid = label.lastIndexOf(' ', Math.ceil(label.length / 2));
  return mid > 0 ? [label.slice(0, mid), label.slice(mid + 1)] : [label];
}

export const fmtAxis = (v: number) => {
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 1000) / 1000;
  return String(r).replace('.', ',').replace(/^-/, '−');
};

/** Marcas «redondas» (1, 2 o 5 × 10ⁿ) que cubren [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function Marker({ shape, x, y, color }: { shape: number; x: number; y: number; color: string }) {
  const s = 4.5;
  const common = { fill: color, stroke: 'var(--surface)', strokeWidth: 1.2 };
  switch (shape % 4) {
    case 1: return <rect x={x - s} y={y - s} width={2 * s} height={2 * s} {...common} />;
    case 2: return <polygon points={`${x},${y - s - 1} ${x + s + 1},${y + s} ${x - s - 1},${y + s}`} {...common} />;
    case 3: return <polygon points={`${x},${y - s - 1} ${x + s + 1},${y} ${x},${y + s + 1} ${x - s - 1},${y}`} {...common} />;
    default: return <circle cx={x} cy={y} r={s} {...common} />;
  }
}

export function AdvancedChart({ chart }: { chart: ItemChart }) {
  const id = useId();
  const titleId = `${id}-t`;
  const descId = `${id}-d`;
  const bars = chart.kind === 'barras';
  const all = chart.series.flatMap((s) => s.points);
  const ys = all.map((p) => p[1]);
  const yT = niceTicks(Math.min(0, ...ys), Math.max(...ys));
  const y0 = yT[0];
  const y1 = yT[yT.length - 1];
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;
  const yLines = splitAxisLabel(chart.yLabel);
  const sy = (v: number) => M.t + ph - ((v - y0) / (y1 - y0)) * ph;

  // Eje x: numérico (línea, dispersión) o por categorías (barras).
  const cats = bars ? chart.categories ?? all.map((p) => fmtAxis(p[0])) : [];
  const nCats = bars ? Math.max(cats.length, ...chart.series.map((s) => s.points.length)) : 0;
  const xs = all.map((p) => p[0]);
  const xT = bars ? [] : niceTicks(Math.min(...xs), Math.max(...xs));
  const x0 = xT[0] ?? 0;
  const x1 = xT[xT.length - 1] ?? 1;
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * pw;
  const band = bars ? pw / Math.max(1, nCats) : 0;
  const barW = bars ? (band * 0.7) / chart.series.length : 0;

  return (
    <figure className="adv-chart">
      <figcaption className="adv-chart-title">{chart.title}</figcaption>
      <svg className="adv-chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{chart.title}</title>
        <desc id={descId}>{chart.description}</desc>
        {yT.map((v) => (
          <g key={`y${v}`}>
            <line className="gridline" x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} />
            <text x={M.l - 6} y={sy(v) + 4} textAnchor="end">{fmtAxis(v)}</text>
          </g>
        ))}
        {!bars && xT.map((v) => (
          <g key={`x${v}`}>
            <line className="tick" x1={sx(v)} x2={sx(v)} y1={M.t + ph} y2={M.t + ph + 5} />
            <text x={sx(v)} y={M.t + ph + 18} textAnchor="middle">{fmtAxis(v)}</text>
          </g>
        ))}
        {bars && cats.map((c, i) => <text key={`c${i}`} x={M.l + band * (i + 0.5)} y={M.t + ph + 18} textAnchor="middle">{c}</text>)}
        <line className="axis" x1={M.l} x2={W - M.r} y1={M.t + ph} y2={M.t + ph} />
        <line className="axis" x1={M.l} x2={M.l} y1={M.t} y2={M.t + ph} />
        <text className="axis-title" x={M.l + pw / 2} y={H - 8} textAnchor="middle">{chart.xLabel}</text>
        <text className="axis-title" transform={`translate(${yLines.length > 1 ? 12 : 18} ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle">
          {yLines.map((t, i) => <tspan key={i} x={0} dy={i === 0 ? 0 : '1.15em'}>{t}</tspan>)}
        </text>
        {chart.series.map((s, si) => {
          const color = COLORS[si % COLORS.length];
          if (bars) {
            return (
              <g key={s.name}>
                {s.points.map(([, y], i) => {
                  const x = M.l + band * i + band * 0.15 + barW * si;
                  const top = sy(Math.max(0, y));
                  return <rect key={i} x={x} y={top} width={barW} height={Math.abs(sy(y) - sy(0))} fill={color} opacity={0.88} />;
                })}
              </g>
            );
          }
          const pts = [...s.points].sort((a, b) => a[0] - b[0]);
          return (
            <g key={s.name}>
              {chart.kind === 'linea' && <polyline fill="none" stroke={color} strokeWidth={2.4} points={pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} strokeDasharray={si % 2 ? '6 4' : undefined} />}
              {pts.map(([x, y], i) => <Marker key={i} shape={si} x={sx(x)} y={sy(y)} color={color} />)}
            </g>
          );
        })}
      </svg>
      {(chart.series.length > 1 || chart.kind !== 'barras') && (
        <ul className="adv-legend" aria-label="Leyenda">
          {chart.series.map((s, si) => (
            <li key={s.name}>
              <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
                {chart.kind === 'linea' && <line x1="0" x2="22" y1="7" y2="7" stroke={COLORS[si % COLORS.length]} strokeWidth="2.4" strokeDasharray={si % 2 ? '6 4' : undefined} />}
                {bars ? <rect x="5" y="2" width="12" height="10" fill={COLORS[si % COLORS.length]} /> : <Marker shape={si} x={11} y={7} color={COLORS[si % COLORS.length]} />}
              </svg>
              {s.name}<span className="sr-only"> ({bars ? 'barras' : SHAPES[si % 4]})</span>
            </li>
          ))}
        </ul>
      )}
      <details className="adv-chart-text">
        <summary>Descripción textual y datos de la gráfica</summary>
        <p>{chart.description}</p>
        {chart.series.map((s) => (
          <div key={s.name} className="table-wrap" tabIndex={0} role="region" aria-label={`Datos: ${s.name}`}>
            <table>
              <caption>{s.name}</caption>
              <thead><tr><th scope="col">{bars ? 'Categoría' : chart.xLabel}</th><th scope="col">{chart.yLabel}</th></tr></thead>
              <tbody>{s.points.map(([x, y], i) => <tr key={i}><td>{bars ? cats[i] ?? fmtAxis(x) : fmtAxis(x)}</td><td className="n">{fmtAxis(y)}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
      </details>
    </figure>
  );
}

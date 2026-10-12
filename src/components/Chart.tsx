import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { fmt, fmtSig } from '../lib/format';
import { FIT_LABEL, FIT_MODELS, equationWithValues, fitModel, formatWithUncertainty, type FitModel, type FitOutcome } from '../lib/fit';
import { copyText, downloadBlob, slug } from '../lib/report';
import { Icon } from './icons';

export interface ChartPoint {
  x: number; y: number; label?: string;
  /** Semiancho de la barra de incertidumbre horizontal (misma unidad que x). */
  ex?: number;
  /** Semiancho de la barra de incertidumbre vertical (misma unidad que y). */
  ey?: number;
}

export interface Series {
  label: string;
  color?: string; // variable CSS, p. ej. 'var(--series-1)'
  points: ChartPoint[];
  kind?: 'line' | 'scatter' | 'both';
  dashed?: boolean;
}

interface ChartProps {
  series: Series[];
  xLabel: string;
  yLabel: string;
  title: string;
  /** Unidades para la lectura del cursor y de los parámetros del ajuste. */
  xUnit?: string;
  yUnit?: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  /** Ajuste por mínimos cuadrados de la primera serie: `true` equivale a 'linear'. */
  fit?: boolean | FitModel;
  height?: number;
  /** Líneas de referencia horizontales. */
  hLines?: { y: number; label: string }[];
  emptyText?: string;
  /** Nombre base de los archivos exportados (PNG/SVG). */
  exportName?: string;
  /** Respaldo cuando el entorno bloquea descargas: el contenedor ya ofrece «Copiar datos». */
  copyFallbackLabel?: string;
  /** Texto que explica las barras de error (por defecto, ± media resolución del instrumento). */
  errorNote?: string;
  /** Muestra el título y la leyenda sobre la gráfica (cuaderno de laboratorio). */
  showTitle?: boolean;
}

type Domain = [number, number];
interface View { x: Domain; y: Domain; }

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

function domainOf(values: number[], pad = 0.05, includeZero = true): Domain {
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

const withUnit = (v: string, unit?: string) => (unit ? `${v} ${unit}` : v);
const finite = (p: ChartPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
const zoomDomain = ([a, b]: Domain, c: number, f: number): Domain => [c - (c - a) * f, c + (b - c) * f];

/** Copia el SVG con los estilos calculados en línea para que se vea igual fuera de la página. */
function standaloneSvg(svg: SVGSVGElement, W: number, H: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const dst = [clone, ...Array.from(clone.querySelectorAll('*'))];
  const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin', 'opacity', 'fill-opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline'];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    (dst[i] as SVGElement).setAttribute('style', props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  });
  clone.querySelectorAll('[data-export="skip"]').forEach((n) => n.remove());
  clone.removeAttribute('tabindex');
  clone.removeAttribute('class');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(W));
  clone.setAttribute('height', String(H));
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%');
  bg.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff');
  clone.insertBefore(bg, clone.querySelector('defs') ?? clone.firstChild);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

async function svgToPng(svgText: string, W: number, H: number, scale = 2): Promise<Blob | null> {
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, W, H);
    return await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Gráfica pequeña de residuos (y − y_ajuste) alineada con el eje x de la gráfica principal. */
function ResidualPlot({ outcome, xDomain, W, m, xLabel, yUnit, narrow }: {
  outcome: Extract<FitOutcome, { ok: true }>; xDomain: Domain; W: number; m: { l: number; r: number }; xLabel: string; yUnit?: string; narrow: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const res = outcome.fit.residuals;
  const H = narrow ? 144 : 164;
  const t = 24, b = 38;
  // Eje simétrico con marcas −u, 0, +u, donde u es el valor "redondo" que cubre el residuo máximo.
  const M = Math.max(...res.map((r) => Math.abs(r.r)), 1e-12);
  const pow = 10 ** Math.floor(Math.log10(M));
  const u = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((v) => v >= M * (1 - 1e-9)) ?? 10 * pow;
  const yt = [-u, 0, u];
  const y0 = -u * 1.12, y1 = u * 1.12;
  const [x0, x1] = xDomain;
  const xt = niceTicks(x0, x1, narrow ? 4 : 6);
  const sx = (x: number) => m.l + ((x - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const sy = (y: number) => H - b - ((y - y0) / (y1 - y0 || 1)) * (H - t - b);
  const maxAbs = Math.max(...res.map((r) => Math.abs(r.r)));
  return (
    <svg className="chart residuals-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
      <title id={`${id}-t`}>Residuos del ajuste {FIT_LABEL[outcome.fit.model]}</title>
      <desc id={`${id}-d`}>{`${res.length} residuos (y medido − y del ajuste). Residuo máximo en valor absoluto: ${withUnit(fmtSig(maxAbs, 3), yUnit)}. Si los residuos se reparten al azar alrededor de cero, el modelo describe bien los datos; si forman una curva, conviene otro modelo.`}</desc>
      <defs><clipPath id={`${id}-c`}><rect x={m.l} y={t} width={W - m.l - m.r} height={H - t - b} /></clipPath></defs>
      {yt.map((v) => (
        <g key={`y${v}`}>
          <line className="gridline" x1={m.l} x2={W - m.r} y1={sy(v)} y2={sy(v)} />
          <text x={m.l - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle">{tickText(v, yt)}</text>
        </g>
      ))}
      {xt.map((v) => <text key={`x${v}`} x={sx(v)} y={H - b + 15} textAnchor="middle">{tickText(v, xt)}</text>)}
      <line className="axis" x1={m.l} x2={m.l} y1={t} y2={H - b} />
      <line x1={m.l} x2={W - m.r} y1={sy(0)} y2={sy(0)} stroke="var(--ink-2)" strokeWidth={1.4} />
      <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle">{xLabel}</text>
      <text className="axis-title" x={4} y={13}>{yUnit ? `Residuo (${yUnit})` : 'Residuo'}</text>
      <g clipPath={`url(#${id}-c)`}>
        {res.map((r, i) => (
          <g key={i}>
            <line x1={sx(r.x)} x2={sx(r.x)} y1={sy(0)} y2={sy(r.r)} stroke="var(--series-2)" strokeWidth={1.5} />
            <circle cx={sx(r.x)} cy={sy(r.r)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={1.2} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * Gráfica SVG accesible con herramientas de análisis: cursor de lectura (puntero o flechas),
 * zoom por rectángulo o con botones, barras de incertidumbre, ajuste por mínimos cuadrados con
 * residuos y exportación a PNG/SVG. Incluye título y descripción para lectores de pantalla
 * y una tabla alternativa con los mismos datos.
 */
export function Chart({ series, xLabel, yLabel, title, xUnit, yUnit, xDomain, yDomain, fit, height = 300, hLines, emptyText = 'Aún no hay datos para graficar.', exportName, copyFallbackLabel, errorNote = 'Las barras indican ± media resolución del instrumento.', showTitle = false }: ChartProps) {
  const id = useId();
  const [showTable, setShowTable] = useState(false);
  const figRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(640);
  const [view, setView] = useState<View | null>(null);
  const [cursor, setCursor] = useState<{ si: number; pi: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [exportMsg, setExportMsg] = useState('');
  const [needCopy, setNeedCopy] = useState(false);
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
  const all = series.flatMap((s) => s.points).filter(finite);
  const hasData = all.length > 0;
  const H = hasData ? (narrow ? Math.min(height, 260) : height) : Math.min(height, 170);
  const m = { l: narrow ? 52 : 64, r: 12, t: 14, b: 50 };
  const baseX = xDomain ?? domainOf(all.flatMap((p) => (p.ex ? [p.x - p.ex, p.x + p.ex] : [p.x])));
  const baseY = yDomain ?? domainOf([...all.flatMap((p) => (p.ey ? [p.y - p.ey, p.y + p.ey] : [p.y])), ...(hLines ?? []).map((h) => h.y)]);
  const [x0, x1] = view?.x ?? baseX;
  const [y0, y1] = view?.y ?? baseY;
  const xt = niceTicks(x0, x1, narrow ? 4 : 6);
  const yt = niceTicks(y0, y1);
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const sx = (x: number) => m.l + ((x - x0) / (x1 - x0 || 1)) * pw;
  const sy = (y: number) => H - m.b - ((y - y0) / (y1 - y0 || 1)) * ph;
  const ix = (px: number) => x0 + ((px - m.l) / pw) * (x1 - x0);
  const iy = (py: number) => y0 + ((H - m.b - py) / ph) * (y1 - y0);
  const clipId = `${id}-clip`.replace(/:/g, '');
  const colorOf = (s: Series, si: number) => s.color ?? `var(--series-${(si % 8) + 1})`;

  const model: FitModel = fit === true ? 'linear' : fit ? fit : 'none';
  const outcome = useMemo<FitOutcome | null>(() => {
    if (model === 'none' || !series[0]) return null;
    const pts = series[0].points.filter(finite);
    return fitModel(model, pts.map((p) => p.x), pts.map((p) => p.y), { x: xUnit, y: yUnit });
  }, [model, series, xUnit, yUnit]);
  const fitted = outcome?.ok ? outcome.fit : null;

  // Curva del ajuste muestreada en la vista actual (se corta donde el modelo no está definido).
  const fitPath = useMemo(() => {
    if (!fitted) return '';
    const N = fitted.model === 'linear' || fitted.model === 'proportional' ? 1 : 160;
    let d = '', pen = false;
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const y = fitted.predict(x);
      if (!Number.isFinite(y)) { pen = false; continue; }
      const py = Math.max(-1e4, Math.min(1e4, sy(y)));
      d += `${pen ? 'L' : 'M'}${sx(x).toFixed(2)},${py.toFixed(2)}`;
      pen = true;
    }
    return d;
  }, [fitted, x0, x1, y0, y1, W, H]); // sx y sy dependen solo de estos valores

  // Puntos navegables con el cursor, ordenados por x.
  const flat = useMemo(() => series.flatMap((s, si) => s.points.map((p, pi) => ({ si, pi, p }))).filter((e) => finite(e.p)).sort((a, b) => a.p.x - b.p.x || a.p.y - b.p.y), [series]);
  const cur = cursor ? flat.find((e) => e.si === cursor.si && e.pi === cursor.pi) ?? null : null;
  useEffect(() => { if (cursor && !cur) setCursor(null); }, [cursor, cur]);

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / (r.width || 1), y: ((e.clientY - r.top) * H) / (r.height || 1) };
  };
  const nearest = (px: number, py: number) => {
    let best: (typeof flat)[number] | null = null, bd = Infinity;
    for (const e of flat) {
      if (e.p.x < x0 || e.p.x > x1 || e.p.y < y0 || e.p.y > y1) continue;
      const d = (sx(e.p.x) - px) ** 2 + (sy(e.p.y) - py) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  const inPlot = (p: { x: number; y: number }) => p.x >= m.l && p.x <= W - m.r && p.y >= m.t && p.y <= H - m.b;

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (!hasData || e.button !== 0 || e.pointerType === 'touch') return;
    const p = toSvg(e);
    if (!inPlot(p)) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!hasData) return;
    const p = toSvg(e);
    if (drag) { setDrag({ ...drag, x1: Math.max(m.l, Math.min(W - m.r, p.x)), y1: Math.max(m.t, Math.min(H - m.b, p.y)) }); return; }
    const n = inPlot(p) ? nearest(p.x, p.y) : null;
    if (n && (n.si !== cursor?.si || n.pi !== cursor?.pi)) setCursor({ si: n.si, pi: n.pi });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
    if (w > 8 && h > 8) {
      const xa = ix(Math.min(drag.x0, drag.x1)), xb = ix(Math.max(drag.x0, drag.x1));
      const ya = iy(Math.max(drag.y0, drag.y1)), yb = iy(Math.min(drag.y0, drag.y1));
      setView({ x: [xa, xb], y: [ya, yb] });
    }
    setDrag(null);
  };
  const zoom = (f: number) => {
    const cx = cur ? cur.p.x : (x0 + x1) / 2, cy = cur ? cur.p.y : (y0 + y1) / 2;
    setView({ x: zoomDomain([x0, x1], cx, f), y: zoomDomain([y0, y1], cy, f) });
  };
  const resetView = () => setView(null);

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!hasData) return;
    const idx = cur ? flat.indexOf(cur) : -1;
    let next: (typeof flat)[number] | undefined;
    switch (e.key) {
      case 'ArrowRight': next = flat[idx < 0 ? 0 : Math.min(flat.length - 1, idx + 1)]; break;
      case 'ArrowLeft': next = flat[idx < 0 ? 0 : Math.max(0, idx - 1)]; break;
      case 'Home': next = flat[0]; break;
      case 'End': next = flat[flat.length - 1]; break;
      case 'ArrowUp': case 'ArrowDown': {
        if (!cur) { next = flat[0]; break; }
        const dir = e.key === 'ArrowUp' ? 1 : -1;
        const target = (((cur.si + dir) % series.length) + series.length) % series.length;
        const cands = flat.filter((f) => f.si === target);
        next = cands.length ? cands.reduce((a, b) => (Math.abs(b.p.x - cur.p.x) < Math.abs(a.p.x - cur.p.x) ? b : a)) : cur;
        break;
      }
      case '+': case '=': zoom(0.5); break;
      case '-': case '_': zoom(2); break;
      case '0': resetView(); break;
      case 'Escape': setCursor(null); break;
      default: return;
    }
    e.preventDefault();
    if (next) {
      setCursor({ si: next.si, pi: next.pi });
      // Si el punto quedó fuera de la vista ampliada, centra la vista en él.
      if (view && (next.p.x < x0 || next.p.x > x1 || next.p.y < y0 || next.p.y > y1)) {
        const hx = (x1 - x0) / 2, hy = (y1 - y0) / 2;
        setView({ x: [next.p.x - hx, next.p.x + hx], y: [next.p.y - hy, next.p.y + hy] });
      }
    }
  };

  const reading = cur
    ? `${series.length > 1 ? `${series[cur.si].label}, ` : ''}${cur.p.label ? `${cur.p.label}: ` : ''}x = ${withUnit(fmtSig(cur.p.x, 4), xUnit)}; y = ${withUnit(fmtSig(cur.p.y, 4), yUnit)}` +
      (fitted && cur.si === 0 ? `; ajuste = ${withUnit(fmtSig(fitted.predict(cur.p.x), 4), yUnit)}` : '')
    : '';

  const fileBase = slug(exportName ?? title);
  const exportImage = async (kind: 'png' | 'svg') => {
    const svg = svgRef.current;
    if (!svg) return;
    let ok = false;
    try {
      const text = standaloneSvg(svg, W, H);
      if (kind === 'svg') ok = downloadBlob(`${fileBase}.svg`, new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
      else { const png = await svgToPng(text, W, H); ok = !!png && downloadBlob(`${fileBase}.png`, png); }
    } catch { ok = false; }
    if (ok) { setExportMsg(`Imagen ${kind.toUpperCase()} descargada.`); return; }
    const label = copyFallbackLabel ?? 'Copiar los puntos de la gráfica';
    setNeedCopy(!copyFallbackLabel);
    setExportMsg(`Este entorno no permite descargar imágenes: usa «${label}» y grafica en una hoja de cálculo.`);
  };
  const copyPoints = async () => {
    const rows = [['Serie', xLabel, yLabel], ...series.flatMap((s) => s.points.filter(finite).map((p) => [s.label, fmtSig(p.x, 6), fmtSig(p.y, 6)]))];
    setExportMsg((await copyText(rows.map((r) => r.join('\t')).join('\n'))) ? 'Puntos copiados: pégalos en una hoja de cálculo.' : 'No se pudo copiar automáticamente: abre la tabla de datos y cópiala.');
  };

  const fitDesc = fitted ? ` Ajuste ${FIT_LABEL[fitted.model]}: ${equationWithValues(fitted)}, R² = ${fmt(fitted.r2, 4)}, ${fitted.n} puntos.` : '';
  const desc = all.length === 0
    ? emptyText
    : `Gráfica de ${yLabel} en función de ${xLabel}. ${series.map((s) => `${s.label}: ${s.points.length} puntos`).join('; ')}.${fitDesc} Con la gráfica enfocada, las flechas recorren los puntos; + y − acercan o alejan; 0 restablece la vista.`;
  const hasErr = all.some((p) => (p.ex ?? 0) > 0 || (p.ey ?? 0) > 0);

  // Caja de lectura del cursor dentro del SVG.
  const tip = (() => {
    if (!cur) return null;
    const lines = [
      `${series.length > 1 ? series[cur.si].label + ' · ' : ''}${cur.p.label ?? ''}`.trim(),
      `x = ${withUnit(fmtSig(cur.p.x, 4), xUnit)}`,
      `y = ${withUnit(fmtSig(cur.p.y, 4), yUnit)}`,
    ].filter(Boolean);
    const tw = Math.max(...lines.map((l) => l.length)) * 6.8 + 16, th = lines.length * 15 + 10;
    const px = sx(cur.p.x), py = sy(cur.p.y);
    let tx = px + 12, ty = py - th - 10;
    if (tx + tw > W - m.r) tx = px - tw - 12;
    if (tx < m.l) tx = m.l + 4;
    if (ty < m.t) ty = py + 12;
    if (ty + th > H - m.b) ty = Math.max(m.t, H - m.b - th - 2);
    return { lines, tw, th, tx, ty, px, py };
  })();

  const fitLabel = fitted ? FIT_LABEL[fitted.model] : '';
  const legendItems = hasData && (showTitle || series.length > 1 || fitted)
    ? [
        ...series.map((s, si) => ({ key: `s${si}`, label: s.label, color: colorOf(s, si), kind: s.kind ?? 'scatter', dashed: s.dashed })),
        ...(fitted ? [{ key: 'fit', label: `Ajuste ${fitLabel}`, color: 'var(--ink-2)', kind: 'line' as const, dashed: true }] : []),
      ]
    : [];
  const tableId = `${id}-tabla`;
  const toolbar = (
    <div className="chart-tools no-print" role="group" aria-label="Herramientas de la gráfica">
      <button type="button" className="tool-btn tip" data-tip="Acercar (+)" aria-label="Acercar" onClick={() => zoom(0.5)}><Icon name="acercar" size={18} /></button>
      <button type="button" className="tool-btn tip" data-tip="Alejar (−)" aria-label="Alejar" onClick={() => zoom(2)}><Icon name="alejar" size={18} /></button>
      <button type="button" className="tool-btn tip" data-tip="Restablecer vista (0)" aria-label="Restablecer vista" onClick={resetView} disabled={!view}><Icon name="encuadrar" size={18} /></button>
      <span className="tool-sep" aria-hidden="true" />
      <button type="button" className="tool-btn tip labeled" data-tip="Exportar imagen PNG" aria-label="Imagen PNG" onClick={() => exportImage('png')}><Icon name="imagen" size={18} /><span aria-hidden="true">PNG</span></button>
      <button type="button" className="tool-btn tip labeled" data-tip="Exportar imagen vectorial SVG" aria-label="Imagen SVG" onClick={() => exportImage('svg')}><Icon name="vector" size={18} /><span aria-hidden="true">SVG</span></button>
      <span className="tool-sep" aria-hidden="true" />
      <button type="button" className="tool-btn tip labeled tbl" data-tip={showTable ? 'Ocultar la tabla de puntos' : 'Ver los puntos como tabla'} aria-label={`${showTable ? 'Ocultar' : 'Ver'} los datos de la gráfica como tabla`}
        aria-expanded={showTable} aria-controls={showTable ? tableId : undefined} onClick={() => setShowTable((v) => !v)}><Icon name="tabla" size={18} /><span aria-hidden="true">Tabla</span></button>
      {needCopy && <button type="button" className="tool-btn labeled" onClick={copyPoints}><Icon name="copiar" size={18} />Copiar los puntos de la gráfica</button>}
    </div>
  );

  return (
    <figure className={`chart${showTitle ? ' chart-pro' : ''}`} style={{ margin: 0 }}>
      {(showTitle || hasData) && (
        <div className="chart-head">
          <div className="chart-heading">
            {showTitle && <p className="chart-title" aria-hidden="true">{title}</p>}
            {legendItems.length > 0 && (
              <ul className="legend" aria-label="Leyenda">
                {legendItems.map((it) => (
                  <li key={it.key}>
                    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" focusable="false">
                      {it.kind !== 'scatter' && <line x1="1" x2="21" y1="6" y2="6" stroke={it.color} strokeWidth={2.2} strokeDasharray={it.dashed ? '5 3' : undefined} />}
                      {it.kind !== 'line' && <circle cx="11" cy="6" r="4.2" fill={it.color} />}
                    </svg>
                    {it.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {hasData && toolbar}
        </div>
      )}
      <div className={`chart-body${fitted ? ' has-fit' : ''}`}>
        <div className="chart-plot" ref={figRef}>
      <svg
        ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} preserveAspectRatio="xMidYMid meet"
        tabIndex={hasData ? 0 : undefined} className={hasData ? 'chart-interactive' : undefined}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !drag) setCursor(null); }}
        onDoubleClick={resetView} onKeyDown={onKeyDown}
      >
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        <defs><clipPath id={clipId}><rect x={m.l} y={m.t} width={pw} height={ph} /></clipPath></defs>
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
        {hasData && <path className="frame" fill="none" d={`M${m.l},${m.t}H${W - m.r}V${H - m.b}`} />}
        <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle">{xLabel}</text>
        <text className="axis-title" transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
        <g clipPath={`url(#${clipId})`}>
          {(hLines ?? []).map((h) => (
            <g key={h.label}>
              <line x1={m.l} x2={W - m.r} y1={sy(h.y)} y2={sy(h.y)} stroke="var(--ink-2)" strokeDasharray="5 4" />
              <text x={W - m.r - 4} y={sy(h.y) - 5} textAnchor="end">{h.label}</text>
            </g>
          ))}
          {fitPath && <path d={fitPath} fill="none" stroke="var(--ink-2)" strokeWidth={1.8} strokeDasharray="6 4" />}
          {series.map((s, si) => {
            const color = colorOf(s, si);
            const pts = s.points.map((p, pi) => ({ p, pi })).filter((e) => finite(e.p));
            const kind = s.kind ?? 'scatter';
            return (
              <g key={s.label}>
                {(kind === 'line' || kind === 'both') && pts.length > 1 && (
                  <polyline fill="none" stroke={color} strokeWidth={2.4} strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" points={pts.map(({ p }) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
                )}
                {hasErr && pts.map(({ p, pi }) => (
                  <g key={`e${pi}`} stroke={color} strokeWidth={1.4}>
                    {(p.ey ?? 0) > 0 && <>
                      <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y - p.ey!)} y2={sy(p.y + p.ey!)} />
                      <line x1={sx(p.x) - 4} x2={sx(p.x) + 4} y1={sy(p.y - p.ey!)} y2={sy(p.y - p.ey!)} />
                      <line x1={sx(p.x) - 4} x2={sx(p.x) + 4} y1={sy(p.y + p.ey!)} y2={sy(p.y + p.ey!)} />
                    </>}
                    {(p.ex ?? 0) > 0 && <>
                      <line x1={sx(p.x - p.ex!)} x2={sx(p.x + p.ex!)} y1={sy(p.y)} y2={sy(p.y)} />
                      <line x1={sx(p.x - p.ex!)} x2={sx(p.x - p.ex!)} y1={sy(p.y) - 4} y2={sy(p.y) + 4} />
                      <line x1={sx(p.x + p.ex!)} x2={sx(p.x + p.ex!)} y1={sy(p.y) - 4} y2={sy(p.y) + 4} />
                    </>}
                  </g>
                ))}
                {(kind === 'scatter' || kind === 'both') && pts.map(({ p, pi }) => (
                  <circle key={pi} cx={sx(p.x)} cy={sy(p.y)} r={cur && cur.si === si && cur.pi === pi ? 7 : 5} fill={color} stroke="var(--surface)" strokeWidth={1.5}>
                    <title>{`${p.label ? p.label + ': ' : ''}(${fmtSig(p.x, 4)}; ${fmtSig(p.y, 4)})`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </g>
        {tip && (
          <g data-export="skip" className="chart-cursor" pointerEvents="none">
            <line x1={tip.px} x2={tip.px} y1={m.t} y2={H - m.b} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={m.l} x2={W - m.r} y1={tip.py} y2={tip.py} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={tip.px} cy={tip.py} r={10} fill="none" stroke="var(--ink)" strokeWidth={2} />
            <rect x={tip.tx} y={tip.ty} width={tip.tw} height={tip.th} rx={6} fill="var(--surface)" stroke="var(--ink-2)" />
            {tip.lines.map((l, i) => <text key={i} className="cursor-text" x={tip.tx + 8} y={tip.ty + 18 + i * 15}>{l}</text>)}
          </g>
        )}
        {drag && (
          <rect data-export="skip" x={Math.min(drag.x0, drag.x1)} y={Math.min(drag.y0, drag.y1)} width={Math.abs(drag.x1 - drag.x0)} height={Math.abs(drag.y1 - drag.y0)} fill="var(--accent-soft)" fillOpacity={0.5} stroke="var(--accent)" strokeDasharray="4 3" />
        )}
        {all.length === 0 && (() => {
          // Ajusta el mensaje al ancho disponible (en celulares no cabe en una línea).
          const maxChars = Math.max(14, Math.floor((W - m.l - m.r) / 7.6));
          const lines = emptyText.split(' ').reduce<string[]>((acc, word) => {
            const last = acc[acc.length - 1];
            if (last !== undefined && (last + ' ' + word).length <= maxChars) acc[acc.length - 1] = last + ' ' + word; else acc.push(word);
            return acc;
          }, []);
          const cy = (m.t + H - m.b) / 2 - ((lines.length - 1) * 18) / 2;
          return <text x={(m.l + W - m.r) / 2} y={cy} textAnchor="middle" style={{ fontSize: 14 }}>{lines.map((l, i) => <tspan key={i} x={(m.l + W - m.r) / 2} dy={i === 0 ? 0 : 18}>{l}</tspan>)}</text>;
        })()}
      </svg>
          {hasData && (
            <p className="small chart-readout" aria-live="polite">
              {reading ? <span className="num">{reading}</span> : <span className="muted">Pasa el puntero sobre la gráfica o enfócala y usa las flechas para leer los puntos. Arrastra para ampliar una zona.</span>}
            </p>
          )}
          {fitted && (
            <div className="residuals-panel">
              <p className="residuals-title" aria-hidden="true">Residuos <span className="muted">(y medido − y del ajuste)</span></p>
              <ResidualPlot outcome={outcome as Extract<FitOutcome, { ok: true }>} xDomain={[x0, x1]} W={W} m={m} xLabel={xLabel} yUnit={yUnit} narrow={narrow} />
            </div>
          )}
        </div>
        {fitted && (
          <div className="fit-card" role="group" aria-labelledby={`${id}-fit`}>
            <div className="fit-card-head">
              <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" focusable="false"><line x1="1" x2="21" y1="6" y2="6" stroke="var(--ink-2)" strokeWidth={2.2} strokeDasharray="5 3" /></svg>
              <strong id={`${id}-fit`}>Ajuste {fitLabel}</strong>
            </div>
            <p className="fit-model num">{FIT_MODELS.find((f) => f.value === fitted.model)!.equation}</p>
            <p className="fit-eq num">{equationWithValues(fitted)}</p>
            {fitted.linearized && <p className="small muted fit-note">Calculado por linealización ({fitted.model === 'power' ? 'ln y contra ln x' : 'ln y contra x'}).</p>}
            <table className="fit-table">
              <caption className="sr-only">Parámetros del ajuste {fitLabel} con su incertidumbre</caption>
              <tbody>
                {fitted.params.map((p) => (
                  <tr key={p.name}>
                    <th scope="row">{p.name}</th>
                    <td className="n">{formatWithUncertainty(p.value, p.se)}</td>
                    <td className="u">{p.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="fit-stats">
              <div><dt>R²</dt><dd className="num">{fmt(fitted.r2, 4)}</dd></div>
              <div><dt>n</dt><dd className="num">{fitted.n} {fitted.n === 1 ? 'punto' : 'puntos'}</dd></div>
            </dl>
            {fitted.dof === 0 && <p className="small muted fit-note">Con {fitted.n} puntos no se puede estimar la incertidumbre: guarda más ensayos.</p>}
          </div>
        )}
      </div>
      <figcaption className="chart-foot">
        {hasErr && <p className="small muted">{errorNote}</p>}
        {outcome && !outcome.ok && <p className="small fit-error" role="status">{outcome.reason}</p>}
        <p className="small muted chart-status" aria-live="polite">{exportMsg}</p>
        {all.length > 0 && showTable && (
          <div className="table-wrap no-print" id={tableId} tabIndex={0} role="region" aria-label={`Datos de la gráfica: ${title}`} style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th scope="col">Serie</th><th scope="col" className="n">{xLabel}</th>
                  {all.some((p) => p.ex) && <th scope="col" className="n">± x</th>}
                  <th scope="col" className="n">{yLabel}</th>
                  {all.some((p) => p.ey) && <th scope="col" className="n">± y</th>}
                  {fitted && <><th scope="col" className="n">y del ajuste</th><th scope="col" className="n">Residuo</th></>}
                </tr>
              </thead>
              <tbody>
                {series.flatMap((s, si) => s.points.map((p, i) => {
                  const yf = fitted && si === 0 && finite(p) ? fitted.predict(p.x) : null;
                  return (
                    <tr key={`${s.label}-${i}`}>
                      <td>{s.label}{p.label ? ` · ${p.label}` : ''}</td><td className="n">{fmtSig(p.x, 4)}</td>
                      {all.some((q) => q.ex) && <td className="n">{p.ex ? fmtSig(p.ex, 2) : '—'}</td>}
                      <td className="n">{fmtSig(p.y, 4)}</td>
                      {all.some((q) => q.ey) && <td className="n">{p.ey ? fmtSig(p.ey, 2) : '—'}</td>}
                      {fitted && <><td className="n">{yf === null ? '—' : fmtSig(yf, 4)}</td><td className="n">{yf === null ? '—' : fmtSig(p.y - yf, 3)}</td></>}
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        )}
      </figcaption>
    </figure>
  );
}

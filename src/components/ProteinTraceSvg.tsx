import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CPK } from '../models/balancing';

/**
 * Vista de respaldo de proteínas en SVG (sin WebGL ni bibliotecas): dibuja la traza de los Cα de cada cadena y los
 * heterogrupos con las coordenadas reales del archivo (rotación + proyección ortográfica, como MoleculeSvg). Se usa
 * cuando el equipo no ofrece WebGL o el visor 3D no se pudo cargar. Las posiciones salen del archivo; el grosor de
 * las líneas y el tamaño de los puntos son solo de dibujo.
 */
export interface TracePoint { atom: number; x: number; y: number; z: number; color: string; label: string }
export interface TraceExtra { atom: number; x: number; y: number; z: number; element: string; label: string }

type Mat = [number, number, number, number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mul(a: Mat, b: Mat): Mat {
  const r = new Array(9).fill(0) as Mat;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
function rotX(t: number): Mat { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function rotY(t: number): Mat { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; }

export function ProteinTraceSvg({ segments, extras, highlight, measure, onPick, title, describedBy, width = 640, height = 360 }: {
  segments: { chain: string; points: TracePoint[] }[];
  extras: TraceExtra[];
  /** Átomos resaltados (A, B y el Cα del residuo analizado). */
  highlight: { atom: number; x: number; y: number; z: number; tag: string }[];
  /** Línea discontinua entre los átomos medidos (posiciones reales). */
  measure: { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number }; text: string } | null;
  onPick: (atom: number) => void;
  title: string;
  describedBy?: string;
  width?: number; height?: number;
}) {
  const [rot, setRot] = useState<Mat>(() => mul(rotX(-0.3), rotY(0.4)));
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const all = useMemo(() => [...segments.flatMap((s) => s.points), ...extras], [segments, extras]);
  const center = useMemo(() => {
    const n = all.length || 1;
    return { x: all.reduce((s, a) => s + a.x, 0) / n, y: all.reduce((s, a) => s + a.y, 0) / n, z: all.reduce((s, a) => s + a.z, 0) / n };
  }, [all]);
  const extent = useMemo(() => Math.max(5, ...all.map((a) => Math.hypot(a.x - center.x, a.y - center.y, a.z - center.z))) + 2, [all, center]);
  const scale = (Math.min(width, height) / 2 - 14) / extent;

  const project = useMemo(() => (p: { x: number; y: number; z: number }) => {
    const x = p.x - center.x, y = p.y - center.y, z = p.z - center.z;
    return {
      sx: width / 2 + (rot[0] * x + rot[1] * y + rot[2] * z) * scale,
      sy: height / 2 - (rot[3] * x + rot[4] * y + rot[5] * z) * scale,
      d: rot[6] * x + rot[7] * y + rot[8] * z,
    };
  }, [center, rot, scale, width, height]);

  // Piezas de la traza (Cα consecutivos) ordenadas por profundidad: lo más lejano se dibuja primero.
  const pieces = useMemo(() => {
    const out: { key: string; x1: number; y1: number; x2: number; y2: number; d: number; color: string }[] = [];
    for (const s of segments) {
      const pr = s.points.map((p) => ({ ...project(p), color: p.color }));
      for (let i = 1; i < pr.length; i++) {
        out.push({ key: `${s.chain}-${s.points[i].atom}`, x1: pr[i - 1].sx, y1: pr[i - 1].sy, x2: pr[i].sx, y2: pr[i].sy, d: (pr[i - 1].d + pr[i].d) / 2, color: pr[i].color });
      }
    }
    return out.sort((a, b) => a.d - b.d);
  }, [segments, project]);
  const dots = useMemo(() => segments.flatMap((s) => s.points).map((p) => ({ ...p, ...project(p) })), [segments, project]);
  const ext = useMemo(() => extras.map((p) => ({ ...p, ...project(p) })).sort((a, b) => a.d - b.d), [extras, project]);
  const dMax = Math.max(1e-6, ...pieces.map((p) => Math.abs(p.d)));
  const fade = (d: number) => 0.55 + 0.45 * ((d / dMax + 1) / 2);
  const lineW = Math.max(1.6, Math.min(5, scale * 0.9));
  const dotR = Math.max(2.2, Math.min(5, scale * 0.6));

  const rotateBy = (dx: number, dy: number) => setRot((r) => mul(mul(rotY(dx), rotX(dy)), r));
  const onDown = (e: PointerEvent<SVGSVGElement>) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    d.moved = true; d.x = e.clientX; d.y = e.clientY;
    rotateBy(dx * 0.01, dy * 0.01);
  };
  const onUp = () => { setTimeout(() => { drag.current = null; }, 0); };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = (10 * Math.PI) / 180;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = map[e.key];
    if (m) { e.preventDefault(); rotateBy(m[0], m[1]); }
    if (e.key === 'Home') { e.preventDefault(); setRot(IDENTITY); }
  };
  const pick = (atom: number) => { if (!drag.current?.moved) onPick(atom); };
  const mp = measure ? { a: project(measure.a), b: project(measure.b) } : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" tabIndex={0}
      aria-label={`${title}: traza de los carbonos alfa dibujada con las coordenadas del archivo (vista de respaldo); arrastra o usa las flechas para girarla y toca un punto para elegir ese residuo`}
      aria-describedby={describedBy}
      style={{ touchAction: 'none', cursor: 'grab', display: 'block' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      {pieces.map((p) => <line key={p.key} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={lineW} strokeLinecap="round" opacity={fade(p.d)} />)}
      {dots.map((p) => (
        <circle key={`c${p.atom}`} cx={p.sx} cy={p.sy} r={dotR} fill={p.color} fillOpacity={0.01} stroke="none" onClick={() => pick(p.atom)} style={{ cursor: 'pointer' }}>
          <title>{p.label}</title>
        </circle>
      ))}
      {ext.map((p) => (
        <circle key={`e${p.atom}`} cx={p.sx} cy={p.sy} r={Math.max(2, dotR * 0.8)} fill={CPK[p.element] ?? '#b0b8bf'} stroke="var(--ink-2)" strokeWidth={0.6} onClick={() => pick(p.atom)} style={{ cursor: 'pointer' }}>
          <title>{p.label}</title>
        </circle>
      ))}
      {mp && measure && (
        <g pointerEvents="none">
          <line x1={mp.a.sx} y1={mp.a.sy} x2={mp.b.sx} y2={mp.b.sy} stroke="var(--data)" strokeWidth={2} strokeDasharray="6 4" />
          <text x={(mp.a.sx + mp.b.sx) / 2} y={(mp.a.sy + mp.b.sy) / 2 - 8} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: 'var(--data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, fontFamily: 'var(--font-data)' }}>{measure.text}</text>
        </g>
      )}
      {highlight.map((h) => {
        const p = project(h);
        return (
          <g key={`${h.tag}-${h.atom}`} pointerEvents="none">
            <circle cx={p.sx} cy={p.sy} r={dotR + 5} fill="none" stroke="var(--data)" strokeWidth={2} />
            <text x={p.sx + dotR + 7} y={p.sy - dotR - 3} style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{h.tag}</text>
          </g>
        );
      })}
    </svg>
  );
}

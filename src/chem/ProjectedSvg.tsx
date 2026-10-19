import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { elementColor } from './elements';
import type { V3 } from './species';

/**
 * Vista de respaldo del kit en SVG: proyecta coordenadas 3D reales (rotación + proyección ortográfica) sin WebGL.
 * Se gira arrastrando o con las flechas del teclado (Inicio restablece). Las posiciones salen del cálculo; los
 * tamaños de las esferas son de dibujo salvo que se indique otra cosa.
 */
export interface SvgAtom3D { x: number; y: number; z: number; el: string; /** radio de dibujo en Å */ r: number; label?: string; opacity?: number; charge?: number }
export interface SvgBond3D { a: number; b: number; order: number; opacity?: number }
export interface SvgLine3D { p: V3; q: V3 }

type Mat = [number, number, number, number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mul(a: Mat, b: Mat): Mat {
  const r = new Array(9).fill(0) as Mat;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
const rotX = (t: number): Mat => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = (t: number): Mat => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };

const chargeText = (q: number) => (q === 0 ? '' : `${Math.abs(q) > 1 ? Math.abs(q) : ''}${q > 0 ? '+' : '−'}`);

export function ProjectedSvg({ atoms, bonds = [], lines = [], ariaLabel, width = 640, height = 340, extentHint, selection = [], onPick, showLabels = false, showCharges = false, initialTilt = true }: {
  atoms: SvgAtom3D[]; bonds?: SvgBond3D[]; lines?: SvgLine3D[]; ariaLabel: string; width?: number; height?: number;
  /** Radio fijo de encuadre (Å) para que la escala no salte entre cuadros de una animación. */
  extentHint?: number; selection?: number[]; onPick?: (i: number) => void; showLabels?: boolean; showCharges?: boolean; initialTilt?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const [rot, setRot] = useState<Mat>(() => (initialTilt ? mul(rotX(-0.35), rotY(0.55)) : IDENTITY));
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const center = useMemo<V3>(() => {
    if (extentHint !== undefined) return [0, 0, 0];
    const n = atoms.length || 1;
    return [atoms.reduce((s, a) => s + a.x, 0) / n, atoms.reduce((s, a) => s + a.y, 0) / n, atoms.reduce((s, a) => s + a.z, 0) / n];
  }, [atoms, extentHint]);
  const ext = extentHint ?? Math.max(1, ...atoms.map((a) => Math.hypot(a.x - center[0], a.y - center[1], a.z - center[2]) + a.r));
  const scale = (Math.min(width, height) / 2 - 10) / (ext + 0.3);
  const proj = (x: number, y: number, z: number) => {
    const X = x - center[0], Y = y - center[1], Z = z - center[2];
    return { sx: width / 2 + (rot[0] * X + rot[1] * Y + rot[2] * Z) * scale, sy: height / 2 - (rot[3] * X + rot[4] * Y + rot[5] * Z) * scale, depth: rot[6] * X + rot[7] * Y + rot[8] * Z };
  };
  const pts = atoms.map((a, i) => ({ ...a, i, ...proj(a.x, a.y, a.z) }));
  const depthMax = Math.max(1e-6, ...pts.map((p) => Math.abs(p.depth)));
  const shadeOf = (d: number) => 0.72 + 0.28 * (d / depthMax);
  const order = [...pts].sort((p, q) => p.depth - q.depth);
  const elements = [...new Set(atoms.map((a) => a.el))];
  const sel = new Set(selection);
  const stickW = Math.max(2, 0.16 * scale);

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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" tabIndex={0} aria-label={ariaLabel}
      style={{ touchAction: 'none', cursor: 'grab', display: 'block' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      <defs>
        {elements.map((el) => (
          <radialGradient key={el} id={`${uid}-g-${el}`} cx="35%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="22%" stopColor={elementColor(el)} />
            <stop offset="100%" stopColor={elementColor(el)} stopOpacity="1" />
          </radialGradient>
        ))}
        <radialGradient id={`${uid}-dark`} cx="50%" cy="50%" r="50%"><stop offset="70%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.32" /></radialGradient>
      </defs>
      {lines.map((l, i) => { const p = proj(...l.p), q = proj(...l.q); return <line key={`l${i}`} x1={p.sx} y1={p.sy} x2={q.sx} y2={q.sy} stroke="var(--ink-2)" strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="5 4" />; })}
      {bonds.map((b, i) => {
        const p = pts[b.a], q = pts[b.b];
        if (!p || !q) return null;
        const dx = q.sx - p.sx, dy = q.sy - p.sy, len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * stickW * 0.85, ny = (dx / len) * stickW * 0.85;
        const offs = b.order === 2 ? [-0.6, 0.6] : b.order === 3 ? [-1.1, 0, 1.1] : [0];
        const w = b.order > 1 ? stickW * 0.62 : stickW;
        return (
          <g key={`b${i}`} opacity={(b.opacity ?? 1) * shadeOf((p.depth + q.depth) / 2)}>
            {offs.map((k) => (
              <g key={k}>
                <line x1={p.sx + nx * k} y1={p.sy + ny * k} x2={q.sx + nx * k} y2={q.sy + ny * k} stroke="#5d6a6e" strokeWidth={w} strokeLinecap="round" />
                <line x1={p.sx + nx * k} y1={p.sy + ny * k} x2={q.sx + nx * k} y2={q.sy + ny * k} stroke="#c9d1d4" strokeWidth={w * 0.35} strokeLinecap="round" opacity={0.7} />
              </g>
            ))}
          </g>
        );
      })}
      {order.map((p) => {
        const r = Math.max(3, p.r * scale);
        return (
          <g key={p.i} onClick={() => { if (!drag.current?.moved) onPick?.(p.i); }} style={{ cursor: onPick ? 'pointer' : undefined }} opacity={p.opacity ?? 1}>
            {sel.has(p.i) && <circle cx={p.sx} cy={p.sy} r={r + 6} fill="none" stroke="var(--data)" strokeWidth={3} />}
            <circle cx={p.sx} cy={p.sy} r={r} fill={`url(#${uid}-g-${p.el})`} stroke="rgba(20,30,34,0.55)" strokeWidth={0.8} opacity={shadeOf(p.depth)} />
            <circle cx={p.sx} cy={p.sy} r={r} fill={`url(#${uid}-dark)`} pointerEvents="none" />
            {showCharges && p.charge ? <text x={p.sx} y={p.sy + 4} textAnchor="middle" pointerEvents="none" style={{ fontSize: Math.max(9, Math.min(14, r * 0.8)), fontWeight: 700, fill: '#fff', paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.55)', strokeWidth: 2.5 }}>{chargeText(p.charge)}</text> : null}
            {showLabels && p.label && <text x={p.sx + r + 3} y={p.sy - r * 0.4} pointerEvents="none" style={{ fontSize: 12, fill: 'var(--ink)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{p.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

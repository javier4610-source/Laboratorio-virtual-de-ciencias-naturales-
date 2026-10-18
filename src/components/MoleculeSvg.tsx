import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CPK } from '../models/balancing';

/**
 * Visor molecular de respaldo en SVG: proyecta las coordenadas reales del archivo (rotación + proyección ortográfica)
 * sin WebGL ni bibliotecas externas. Se usa cuando el equipo no ofrece WebGL o el visor 3D no se pudo descargar
 * (por ejemplo, sin conexión). Se gira arrastrando, con el teclado (flechas) o con los botones; las posiciones salen
 * del cálculo, los tamaños de las esferas son solo de dibujo.
 */
export interface SvgAtom { index: number; element: string; x: number; y: number; z: number; label: string }
export interface SvgBond { a: number; b: number; order: number }
export type SvgStyle = 'bs' | 'esf' | 'pal';

type Mat = [number, number, number, number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mul(a: Mat, b: Mat): Mat {
  const r = new Array(9).fill(0) as Mat;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
function rotX(t: number): Mat { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function rotY(t: number): Mat { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; }

/** Radios de dibujo (Å) por elemento, aproximados a los radios covalentes; solo afectan el tamaño en pantalla. */
const DRAW_RADIUS: Record<string, number> = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, P: 1.07, S: 1.05, Cl: 1.02, Br: 1.2, I: 1.39 };

export function MoleculeSvg({ atoms, bonds, style, selection, onPick, title, width = 640, height = 340 }: {
  atoms: SvgAtom[]; bonds: SvgBond[]; style: SvgStyle; selection: number[]; onPick: (i: number) => void; title: string; width?: number; height?: number;
}) {
  const [rot, setRot] = useState<Mat>(() => mul(rotX(-0.35), rotY(0.5)));
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const center = useMemo(() => {
    const n = atoms.length || 1;
    return { x: atoms.reduce((s, a) => s + a.x, 0) / n, y: atoms.reduce((s, a) => s + a.y, 0) / n, z: atoms.reduce((s, a) => s + a.z, 0) / n };
  }, [atoms]);
  const extent = useMemo(() => Math.max(1, ...atoms.map((a) => Math.hypot(a.x - center.x, a.y - center.y, a.z - center.z))) + 0.8, [atoms, center]);
  const scale = (Math.min(width, height) / 2 - 12) / extent;

  const pts = useMemo(() => atoms.map((a) => {
    const x = a.x - center.x, y = a.y - center.y, z = a.z - center.z;
    const X = rot[0] * x + rot[1] * y + rot[2] * z, Y = rot[3] * x + rot[4] * y + rot[5] * z, Z = rot[6] * x + rot[7] * y + rot[8] * z;
    return { ...a, sx: width / 2 + X * scale, sy: height / 2 - Y * scale, depth: Z };
  }), [atoms, center, rot, scale, width, height]);

  const radiusOf = (el: string) => {
    const r = DRAW_RADIUS[el] ?? 0.8;
    return (style === 'esf' ? r * 1.9 : style === 'pal' ? 0.12 : r * 0.42) * scale;
  };
  const stickW = (style === 'pal' ? 0.2 : 0.12) * scale;
  const sel = new Set(selection);
  const order = [...pts].sort((p, q) => p.depth - q.depth);
  const depthMax = Math.max(1e-6, ...pts.map((p) => Math.abs(p.depth)));
  const shade = (d: number) => 0.75 + 0.25 * (d / depthMax); // más claro lo que está más cerca

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
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" tabIndex={0} aria-label={`${title}: modelo de esferas y palitos dibujado con las coordenadas del archivo; arrastra o usa las flechas para girarlo y toca un átomo para elegirlo`}
      style={{ touchAction: 'none', cursor: 'grab', display: 'block' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      {bonds.map((b, i) => {
        const p = pts[b.a], q = pts[b.b];
        if (!p || !q) return null;
        const dx = q.sx - p.sx, dy = q.sy - p.sy, len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * stickW * 0.9, ny = (dx / len) * stickW * 0.9;
        const lines = b.order === 2 ? [-0.5, 0.5] : b.order === 3 ? [-1, 0, 1] : [0];
        return (
          <g key={`b${i}`} opacity={shade((p.depth + q.depth) / 2)}>
            {lines.map((k) => (
              <line key={k} x1={p.sx + nx * k} y1={p.sy + ny * k} x2={q.sx + nx * k} y2={q.sy + ny * k}
                stroke="var(--ink-2)" strokeWidth={b.order > 1 ? stickW * 0.7 : stickW} strokeLinecap="round" />
            ))}
          </g>
        );
      })}
      {order.map((p) => {
        const r = Math.max(3, radiusOf(p.element));
        return (
          <g key={p.index} onClick={() => { if (!drag.current?.moved) onPick(p.index); }} style={{ cursor: 'pointer' }}>
            {sel.has(p.index) && <circle cx={p.sx} cy={p.sy} r={r + 7} fill="var(--data, #1971c2)" opacity={0.3} />}
            <circle cx={p.sx} cy={p.sy} r={r} fill={CPK[p.element] ?? '#b0b8bf'} stroke="var(--ink-2)" strokeWidth={1} opacity={shade(p.depth)} />
            <circle cx={p.sx - r * 0.3} cy={p.sy - r * 0.3} r={r * 0.3} fill="#fff" opacity={0.35} pointerEvents="none" />
            <text x={p.sx + r + 3} y={p.sy - r * 0.4} style={{ fontSize: 12, fill: 'var(--ink)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }} pointerEvents="none">{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

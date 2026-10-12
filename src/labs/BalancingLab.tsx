import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  allSpecies, atomRadius, checkEquation, COEF_LIMITS, CPK, ELEMENT_NAME, equationText, hintFor, LAYOUTS, layoutBox,
  LEVEL_NAME, prettyFormula, reactionById, REACTIONS, solveBalance, tiltAngle,
  type BalanceStatus, type ElementRow, type Hint, type SpeciesDef,
} from '../models/balancing';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Select } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, Lcd, shade } from './kit';
import { keyboardValue, ManipHint, ManipScene, useSvgDrag, type Pt, type RangeSpec } from './manipulate';

/* ------------------------------------------------------------------ textos */

const STATUS_TEXT: Record<BalanceStatus, string> = {
  'balanceada': 'Balanceada con los menores enteros',
  'no minima': 'Balanceada, pero no con los menores enteros',
  'no balanceada': 'No balanceada',
};
const KIND_WORD: Record<SpeciesDef['kind'], [string, string]> = {
  molecula: ['molécula', 'moléculas'],
  unidad: ['unidad fórmula', 'unidades fórmula'],
  atomo: ['átomo', 'átomos'],
};
const unitsOf = (s: SpeciesDef, n: number) => `${n} ${KIND_WORD[s.kind][n === 1 ? 0 : 1]} de ${prettyFormula(s.formula)}`;
const signed = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;
const LETTERS = 'abcdefghij';
const RANGE: RangeSpec = { min: COEF_LIMITS.min, max: COEF_LIMITS.max, step: 1, pageStep: 2 };

/* ------------------------------------------------------------------ geometría de la escena (viewBox 760 × 536) */

const VB_W = 760, VB_H = 536;
const PIVOT = { x: 380, y: 404 };
const ARM = 190;
const PAN_Y = 356; // cara superior del plato sin inclinación
const AREA = { top: 176, bottom: PAN_Y - 3 }; // zona donde se apilan las moléculas sobre cada plato
const SIDE_X: Record<Side, number> = { R: 30, P: 410 };
const SIDE_W = 320;
const PAN_CX: Record<Side, number> = { R: 190, P: 570 };
const PAN_HALF = 166;
const SHELF = { labelY: 50, top: 56, bottom: 108, board: 110 };

type Side = 'R' | 'P';
interface Rect { x: number; y: number; w: number; h: number }
const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** Franja horizontal de la sustancia i (de n) en un lado: la misma en el estante y sobre el plato. */
const slot = (side: Side, i: number, n: number) => ({ x: SIDE_X[side] + (i * SIDE_W) / n, w: SIDE_W / n });

/** Tamaño de un modelo en unidades de enlace (incluye el radio de los átomos y un pequeño margen). */
function modelSize(formula: string) {
  const l = LAYOUTS[formula];
  const b = layoutBox(l);
  const rMax = Math.max(...l.atoms.map((a) => atomRadius(a[0])));
  return { w: b.maxX - b.minX + 2 * rMax + 0.3, h: b.maxY - b.minY + 2 * rMax + 0.3 };
}

/** Rejilla que reparte n copias de un modelo en una caja w × h con la mayor escala posible (px por unidad de enlace). */
function fitGrid(n: number, w: number, h: number, mw: number, mh: number, maxScale: number) {
  let best = { cols: 1, rows: n, scale: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const scale = Math.min(w / (cols * mw), h / (rows * mh), maxScale);
    if (scale > best.scale + 1e-9) best = { cols, rows, scale };
  }
  return best;
}

/** Color del texto sobre un átomo (oscuro sobre colores claros, blanco sobre oscuros). */
function letterColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.3 ? '#1b2226' : '#ffffff';
}

/* ------------------------------------------------------------------ dibujo de moléculas */

function BalancingDefs() {
  return (
    <defs>
      {Object.entries(CPK).map(([el, c]) => (
        <radialGradient key={el} id={`bal-a-${el}`} cx="0.36" cy="0.3" r="0.78">
          <stop offset="0" stopColor={shade(c, 0.65)} />
          <stop offset="0.45" stopColor={c} />
          <stop offset="1" stopColor={shade(c, -0.38)} />
        </radialGradient>
      ))}
      <linearGradient id="bal-tray" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#eef2f3" />
        <stop offset="0.5" stopColor="#c9d2d6" />
        <stop offset="1" stopColor="#9fabb0" />
      </linearGradient>
      <linearGradient id="bal-shelf" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#d9b98c" />
        <stop offset="1" stopColor="#a87c48" />
      </linearGradient>
    </defs>
  );
}

/** Modelo de esferas y varillas centrado en (cx, cy); `mark` resalta los átomos de un elemento (pista). */
function Molecule({ formula, cx, cy, scale, mark }: { formula: string; cx: number; cy: number; scale: number; mark?: string | null }) {
  const l = LAYOUTS[formula];
  const b = layoutBox(l);
  const ox = cx - ((b.minX + b.maxX) / 2) * scale, oy = cy - ((b.minY + b.maxY) / 2) * scale;
  const P = (i: number) => ({ x: ox + l.atoms[i][1] * scale, y: oy + l.atoms[i][2] * scale });
  const bw = Math.max(0.8, 0.13 * scale);
  return (
    <g>
      {l.bonds.map(([i, j, order], k) => {
        const a = P(i), c = P(j);
        if (order === 2) {
          const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
          const nx = (-(c.y - a.y) / len) * bw * 1.1, ny = ((c.x - a.x) / len) * bw * 1.1;
          return (
            <g key={k}>
              <line x1={a.x + nx} y1={a.y + ny} x2={c.x + nx} y2={c.y + ny} stroke="#5f6b72" strokeWidth={bw} strokeLinecap="round" />
              <line x1={a.x - nx} y1={a.y - ny} x2={c.x - nx} y2={c.y - ny} stroke="#5f6b72" strokeWidth={bw} strokeLinecap="round" />
            </g>
          );
        }
        return <line key={k} x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke="#5f6b72" strokeWidth={order === 0 ? bw * 0.8 : bw * 1.2} strokeDasharray={order === 0 ? `${bw * 1.6} ${bw * 1.4}` : undefined} strokeLinecap="round" />;
      })}
      {l.atoms.map(([el], i) => {
        const p = P(i);
        const r = atomRadius(el) * scale;
        const color = CPK[el];
        return (
          <g key={i}>
            {mark === el && <circle cx={p.x} cy={p.y} r={r + Math.max(1.6, r * 0.32)} fill="none" stroke="var(--warn)" strokeWidth={Math.max(1.2, r * 0.22)} />}
            <circle cx={p.x} cy={p.y} r={r} fill={`url(#bal-a-${el})`} stroke={shade(color, -0.5)} strokeWidth={Math.max(0.4, r * 0.08)} />
            {r >= 5 && (
              <text x={p.x} y={p.y + r * 0.36} textAnchor="middle" style={{ fontSize: Math.min(r * (el.length > 1 ? 0.9 : 1.08), 14), fontWeight: 700, fill: letterColor(color), pointerEvents: 'none' }}>{el}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Copias de un modelo apiladas desde el plato hacia arriba dentro de una columna. */
function MoleculeStack({ formula, n, x, w, mark }: { formula: string; n: number; x: number; w: number; mark: string | null }) {
  const size = modelSize(formula);
  const g = fitGrid(n, w - 8, AREA.bottom - AREA.top, size.w, size.h, 24);
  const cw = size.w * g.scale, ch = size.h * g.scale;
  const left = x + (w - g.cols * cw) / 2;
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const row = Math.floor(k / g.cols), col = k % g.cols;
        // la última fila (incompleta) queda centrada
        const inRow = row === g.rows - 1 ? n - row * g.cols : g.cols;
        const rowLeft = left + ((g.cols - inRow) * cw) / 2;
        return <Molecule key={k} formula={formula} scale={g.scale} cx={rowLeft + (col + 0.5) * cw} cy={AREA.bottom - (row + 0.5) * ch} mark={mark} />;
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ control de arrastre por sustancia */

interface ControlProps {
  index: number;
  species: SpeciesDef;
  side: Side;
  value: number;
  palette: Rect;
  column: Rect;
  ghost: ReactNode;
  zoneOf: (p: Pt) => Side | null;
  onSet: (index: number, value: number, via: 'drop' | 'key') => void;
  onWrongSide: (index: number) => void;
}

/**
 * Una sustancia de la ecuación como control deslizante (role="slider"): arrastrar su modelo del estante a la bandeja
 * de su lado suma una unidad; arrastrar una molécula fuera de la bandeja la quita; con el teclado, flechas, Inicio y Fin.
 */
function SpeciesControl({ index, species, side, value, palette, column, ghost, zoneOf, onSet, onWrongSide }: ControlProps) {
  const origin = useRef<'estante' | 'plato'>('estante');
  const { dragging, point, handlers } = useSvgDrag<SVGGElement>({
    onStart: (p) => { origin.current = inRect(p, column) ? 'plato' : 'estante'; },
    onMove: () => {},
    onEnd: ({ point: p, start }) => {
      if (Math.hypot(p.x - start.x, p.y - start.y) < 6) return; // un clic sin arrastre no cambia nada
      const zone = zoneOf(p);
      if (origin.current === 'estante') {
        if (zone === side) onSet(index, value + 1, 'drop');
        else if (zone) onWrongSide(index);
      } else if (zone !== side) {
        onSet(index, value - 1, 'drop');
      }
    },
  });
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    const next = keyboardValue(e.key, value, RANGE);
    if (next === null) return;
    e.preventDefault();
    if (next !== value) onSet(index, next, 'key');
  };
  const pf = prettyFormula(species.formula);
  const sideWord = side === 'R' ? 'reactivos' : 'productos';
  return (
    <g
      role="slider"
      tabIndex={0}
      aria-label={`${pf} en la bandeja de ${sideWord}`}
      aria-valuemin={RANGE.min}
      aria-valuemax={RANGE.max}
      aria-valuenow={value}
      aria-valuetext={unitsOf(species, value)}
      className={`manip${dragging ? ' dragging' : ''}`}
      onKeyDown={onKeyDown}
      {...handlers}
    >
      <rect className="manip-affordance" x={palette.x} y={palette.y} width={palette.w} height={palette.h} rx={8} vectorEffect="non-scaling-stroke" />
      <rect className="manip-hit" x={palette.x} y={palette.y} width={palette.w} height={palette.h} rx={8} />
      <rect className="manip-hit" x={column.x} y={column.y} width={column.w} height={column.h} rx={8} />
      <rect className="manip-ring" x={palette.x - 3} y={palette.y - 3} width={palette.w + 6} height={palette.h + 6} rx={10} vectorEffect="non-scaling-stroke" />
      {dragging && point && (
        <g transform={`translate(${point.x} ${point.y})`} opacity="0.85" style={{ pointerEvents: 'none' }} aria-hidden="true">{ghost}</g>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ gráfico de barras del conteo de átomos */

function AtomChart({ rows, mark }: { rows: ElementRow[]; mark: string | null }) {
  const W = 760, H = 236, L = 52, R = 16, T = 34, B = 62;
  const max = Math.max(4, ...rows.map((r) => Math.max(r.left, r.right)));
  const step = [1, 2, 5, 10, 20, 25, 50].find((s) => max / s <= 6) ?? 50;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const gw = (W - L - R) / rows.length;
  const bw = Math.min(54, gw * 0.28);
  const desc = rows.map((r) => `${ELEMENT_NAME[r.element] ?? r.element}: ${r.left} en los reactivos y ${r.right} en los productos`).join('; ') + '.';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="bal-ct bal-cd" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <title id="bal-ct">Átomos de cada elemento en los reactivos y en los productos</title>
      <desc id="bal-cd">{desc}</desc>
      <g aria-hidden="true">
        <rect x={L} y={8} width={12} height={12} rx={2} fill="var(--series-1)" />
        <text x={L + 18} y={18} style={{ fontSize: 12, fill: 'var(--ink)' }}>Reactivos</text>
        <rect x={L + 100} y={8} width={12} height={12} rx={2} fill="var(--series-2)" />
        <text x={L + 118} y={18} style={{ fontSize: 12, fill: 'var(--ink)' }}>Productos</text>
        <text x={W - R} y={18} textAnchor="end" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>número de átomos</text>
        {Array.from({ length: top / step + 1 }, (_, k) => k * step).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.4 : 0.8} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{fmt(v, 0)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = L + gw * (i + 0.5);
          const ok = r.diff === 0;
          const color = CPK[r.element] ?? '#888888';
          return (
            <g key={r.element}>
              {mark === r.element && <rect x={cx - gw / 2 + 6} y={T - 6} width={gw - 12} height={H - T - 2} rx={8} fill="none" stroke="var(--warn)" strokeWidth="2" strokeDasharray="6 4" />}
              <rect x={cx - bw - 3} y={y(r.left)} width={bw} height={y(0) - y(r.left)} rx={3} fill="var(--series-1)" />
              <rect x={cx + 3} y={y(r.right)} width={bw} height={y(0) - y(r.right)} rx={3} fill="var(--series-2)" />
              <text x={cx - bw / 2 - 3} y={y(r.left) - 5} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--ink)' }}>{r.left}</text>
              <text x={cx + bw / 2 + 3} y={y(r.right) - 5} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--ink)' }}>{r.right}</text>
              <circle cx={cx - 34} cy={H - B + 20} r={10} fill={`url(#bal-a-${r.element})`} stroke={shade(color, -0.5)} strokeWidth="0.8" />
              <text x={cx - 34} y={H - B + 24} textAnchor="middle" style={{ fontSize: r.element.length > 1 ? 9 : 11, fontWeight: 700, fill: letterColor(color) }}>{r.element}</text>
              <text x={cx - 18} y={H - B + 24} style={{ fontSize: 12, fill: 'var(--ink)' }}>{ELEMENT_NAME[r.element] ?? r.element}</text>
              <text x={cx} y={H - B + 46} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: ok ? 'var(--ok)' : 'var(--bad)' }}>
                {ok ? `${r.left} = ${r.right}` : `${r.left} ≠ ${r.right}`}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function BalancingLab({ api }: LabProps) {
  const [reactionId, setReactionId] = useState('agua');
  const rx = reactionById(reactionId);
  const species = useMemo(() => allSpecies(rx), [rx]);
  const nR = rx.reactants.length, nP = rx.products.length;
  const [coefs, setCoefs] = useState<number[]>(() => species.map(() => 1));
  const key = `${reactionId}:${coefs.join(',')}`;
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const [hint, setHint] = useState<{ key: string; hint: Hint } | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [solverShown, setSolverShown] = useState(false);
  const [message, setMessage] = useState('');

  const check = useMemo(() => checkEquation(rx, coefs), [rx, coefs]);
  const solver = useMemo(() => solveBalance(rx), [rx]);
  const verified = verifiedKey === key;
  const activeHint = hint && hint.key === key ? hint.hint : null;
  const mark = activeHint?.element ?? null;

  /* ---------- balanza: inclinación objetivo y animación amortiguada */
  const target = tiltAngle(check.mass.reactants, check.mass.products, check.balanced);
  const [angle, setAngle] = useState(target);
  const anim = useRef({ angle: target, vel: 0, raf: 0 });
  useEffect(() => {
    const a = anim.current;
    cancelAnimationFrame(a.raf);
    if (Math.abs(a.angle - target) < 0.01 && Math.abs(a.vel) < 0.01) return;
    const settle = () => {
      a.angle = target; a.vel = 0;
      setAngle(target);
      if (target === 0) playSound('thud', { intensity: 0.28 }); // el fiel se detiene en el cero
    };
    if (prefersReducedMotion()) { settle(); return; }
    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
      last = now;
      // oscilador amortiguado (ligeramente subamortiguado, como el fiel de una balanza real)
      a.vel += (-55 * (a.angle - target) - 8 * a.vel) * dt;
      a.angle += a.vel * dt;
      const elapsed = Math.max(0, now - start) / 1000;
      if (elapsed > 4 || (Math.abs(a.angle - target) < 0.03 && Math.abs(a.vel) < 0.08)) { settle(); return; }
      setAngle(a.angle);
      a.raf = requestAnimationFrame(tick);
    };
    a.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(a.raf);
  }, [target]);
  const lift = ARM * Math.sin((angle * Math.PI) / 180);
  const dy: Record<Side, number> = { R: -lift, P: lift };

  /* ---------- cambios de coeficientes */
  const setCoef = (i: number, v: number, via: 'drop' | 'key' | 'boton') => {
    const s = species[i];
    const pf = prettyFormula(s.formula);
    if (v < RANGE.min) { setMessage(`El coeficiente mínimo es 1: ${pf} debe aparecer en la ecuación.`); playSound('error'); return; }
    if (v > RANGE.max) { setMessage(`El coeficiente máximo en este simulador es ${RANGE.max}.`); playSound('error'); return; }
    setCoefs((c) => c.map((x, k) => (k === i ? v : x)));
    setMessage(`${i < nR ? 'Reactivos' : 'Productos'}: ${unitsOf(s, v)}.`);
    if (via !== 'key') playSound(v > coefs[i] ? 'click' : 'tick', { intensity: 0.55 });
  };
  const wrongSide = (i: number) => {
    const pf = prettyFormula(species[i].formula);
    setMessage(`${pf} es ${i < nR ? 'un reactivo: va en la bandeja de la izquierda' : 'un producto: va en la bandeja de la derecha'}.`);
    playSound('error');
  };
  const changeReaction = (id: string) => {
    const r = reactionById(id);
    setReactionId(r.id);
    setCoefs(allSpecies(r).map(() => 1));
    setVerifiedKey(null);
    setHint(null);
    setHintsUsed(0);
    setSolverShown(false);
    setMessage('');
  };
  const resetCoefs = () => { setCoefs(species.map(() => 1)); setMessage('Todos los coeficientes volvieron a 1.'); };
  const verify = () => { setVerifiedKey(key); playSound(check.status === 'balanceada' ? 'confirm' : 'beep'); };
  const askHint = () => { setHint({ key, hint: hintFor(rx, coefs) }); setHintsUsed((n) => n + 1); };

  const zoneOf = (p: Pt): Side | null => {
    for (const s of ['R', 'P'] as Side[]) {
      const r = { x: PAN_CX[s] - PAN_HALF, y: AREA.top - 8 + dy[s], w: PAN_HALF * 2, h: PAN_Y + 30 - AREA.top + 8 };
      if (inRect(p, r)) return s;
    }
    return null;
  };

  const record = () => api.addTrial('intentos', {
    reaccion: rx.name,
    sumaCoef: coefs.reduce((a, b) => a + b, 0),
    ecuacion: equationText(rx, coefs),
    desbalance: check.imbalance,
    masaReactivos: check.massReactants,
    masaProductos: check.massProducts,
    difMasa: check.massDifference,
    difMasaAbs: Math.abs(check.massDifference),
    mcd: check.divisor,
    estado: STATUS_TEXT[check.status],
    pistas: hintsUsed,
    solucionVista: solverShown ? 'Sí' : 'No',
  });

  /* ---------- dibujos memorizados (solo cambian con la reacción, los coeficientes o la pista) */
  const sideOf = (i: number): Side => (i < nR ? 'R' : 'P');
  const slotOf = (i: number) => (i < nR ? slot('R', i, nR) : slot('P', i - nR, nP));

  const shelfModels = useMemo(() => species.map((s, i) => {
    const sl = i < nR ? slot('R', i, nR) : slot('P', i - nR, nP);
    const size = modelSize(s.formula);
    const scale = Math.min(22, (sl.w - 18) / size.w, (SHELF.bottom - SHELF.top - 4) / size.h);
    return { cx: sl.x + sl.w / 2, cy: (SHELF.top + SHELF.bottom) / 2, scale, x: sl.x, w: sl.w };
  }), [species, nR, nP]);

  const panStacks = useMemo(() => {
    const out: Record<Side, ReactNode[]> = { R: [], P: [] };
    species.forEach((s, i) => {
      const sl = i < nR ? slot('R', i, nR) : slot('P', i - nR, nP);
      out[i < nR ? 'R' : 'P'].push(<MoleculeStack key={`${reactionId}-${i}`} formula={s.formula} n={coefs[i]} x={sl.x} w={sl.w} mark={mark} />);
    });
    return out;
  }, [species, coefs, nR, nP, reactionId, mark]);

  const shelf = useMemo(() => (
    <g>
      <rect x={18} y={SHELF.top - 18} width={724} height={SHELF.board - SHELF.top + 18} rx={10} fill="var(--surface)" opacity="0.55" stroke="var(--line)" />
      <line x1={380} x2={380} y1={SHELF.top - 12} y2={SHELF.board - 4} stroke="var(--line)" strokeDasharray="4 4" />
      {species.map((s, i) => {
        const m = shelfModels[i];
        return (
          <g key={`${reactionId}-${i}`}>
            <text x={m.cx} y={SHELF.labelY} textAnchor="middle" className="scene-label" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--ink)' }}>{prettyFormula(s.formula)}</text>
            <Molecule formula={s.formula} cx={m.cx} cy={m.cy + 2} scale={m.scale} mark={mark} />
          </g>
        );
      })}
      <rect x={18} y={SHELF.board} width={724} height={13} rx={2} fill="url(#bal-shelf)" />
      <rect x={18} y={SHELF.board + 13} width={724} height={3} fill="#000" opacity="0.12" />
      <text x={190} y={SHELF.board + 10} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 800, fill: '#3b2a14', letterSpacing: '0.08em' }}>REACTIVOS · BANDEJA IZQUIERDA</text>
      <text x={570} y={SHELF.board + 10} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 800, fill: '#3b2a14', letterSpacing: '0.08em' }}>PRODUCTOS · BANDEJA DERECHA</text>
    </g>
  ), [species, shelfModels, reactionId, mark]);

  /* ---------- descripción accesible */
  const sideText = (side: Side) => species.map((s, i) => ({ s, i })).filter(({ i }) => sideOf(i) === side).map(({ s, i }) => unitsOf(s, coefs[i])).join(', ');
  const tiltText = target === 0 ? 'La balanza de dos platos está nivelada.' : target > 0 ? 'La balanza se inclina hacia los productos (pesan más).' : 'La balanza se inclina hacia los reactivos (pesan más).';
  const desc = `${equationText(rx, coefs)}. Bandeja de reactivos: ${sideText('R')}. Bandeja de productos: ${sideText('P')}. ${tiltText}` +
    (verified ? ` Masa de reactivos ${fmt(check.massReactants, 2)} g; masa de productos ${fmt(check.massProducts, 2)} g.` : '');

  const pan = (side: Side) => {
    const cx = PAN_CX[side], d = dy[side];
    return (
      <g key={side}>
        {/* columna que sostiene el plato (Roberval: el plato se mantiene horizontal) */}
        <rect x={cx - 5} y={PAN_Y + 12 + d} width={10} height={PIVOT.y - PAN_Y - 12} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.6" />
        <g transform={`translate(0 ${d})`}>
          <ellipse cx={cx} cy={PAN_Y + 16} rx={PAN_HALF - 10} ry={4} fill="#000" opacity="0.1" />
          {panStacks[side]}
          <path d={`M${cx - PAN_HALF} ${PAN_Y} L${cx + PAN_HALF} ${PAN_Y} L${cx + PAN_HALF - 8} ${PAN_Y + 13} L${cx - PAN_HALF + 8} ${PAN_Y + 13} Z`} fill="url(#bal-tray)" stroke="#7f8b90" strokeWidth="0.8" />
          <line x1={cx - PAN_HALF + 2} x2={cx + PAN_HALF - 2} y1={PAN_Y + 0.8} y2={PAN_Y + 0.8} stroke="#fff" strokeOpacity="0.7" />
          {species.map((s, i) => ({ s, i })).filter(({ i }) => sideOf(i) === side).map(({ s, i }) => {
            const sl = slotOf(i);
            return <text key={i} x={sl.x + sl.w / 2} y={PAN_Y + 10.5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: '#1f2a2e' }}>{`${coefs[i]} ${prettyFormula(s.formula)}`}</text>;
          })}
        </g>
      </g>
    );
  };

  const scene = (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-labelledby="bal-t bal-d">
      <title id="bal-t">Bandejas de reactivos y productos sobre una balanza de dos platos</title>
      <desc id="bal-d">{desc}</desc>
      <BalancingDefs />
      <text x={380} y={26} textAnchor="middle" className="scene-label" style={{ fontSize: 18, fontWeight: 700, fill: 'var(--ink)' }}>{equationText(rx, coefs)}</text>
      {shelf}
      <text x={380} y={276} textAnchor="middle" style={{ fontSize: 34, fontWeight: 700, fill: 'var(--ink-2)' }}>→</text>
      <BenchTop y={510} width={VB_W} />
      {/* gabinete de la balanza */}
      <g filter="url(#kit-shadow)">
        <path d={`M156 452 L604 452 Q620 452 622 466 L628 510 L132 510 L138 466 Q140 452 156 452 Z`} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <rect x={150} y={452} width={460} height={6} fill="#000" opacity="0.06" />
      <Lcd x={176} y={462} w={124} h={26} text={verified ? fmt(check.massReactants, 2) : '- - -'} unit="g" />
      <Lcd x={460} y={462} w={124} h={26} text={verified ? fmt(check.massProducts, 2) : '- - -'} unit="g" />
      <text x={238} y={502} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: '#46524f' }}>Σ ν·M reactivos</text>
      <text x={522} y={502} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: '#46524f' }}>Σ ν·M productos</text>
      <text x={380} y={482} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: '#46524f', letterSpacing: '0.08em' }}>LAVOISIER</text>
      {/* pilar, fiel y escala */}
      <rect x={372} y={PIVOT.y} width={16} height={452 - PIVOT.y} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.6" />
      {[-20, -15, -10, -5, 0, 5, 10, 15, 20].map((a) => {
        const r0 = 50, r1 = a === 0 ? 60 : 56, rad = (a * Math.PI) / 180;
        return <line key={a} x1={PIVOT.x + r0 * Math.sin(rad)} y1={PIVOT.y - r0 * Math.cos(rad)} x2={PIVOT.x + r1 * Math.sin(rad)} y2={PIVOT.y - r1 * Math.cos(rad)} stroke={a === 0 ? 'var(--ok)' : 'var(--ink-2)'} strokeWidth={a === 0 ? 2.4 : 1.2} />;
      })}
      {pan('R')}
      {pan('P')}
      <g transform={`rotate(${angle} ${PIVOT.x} ${PIVOT.y})`}>
        <rect x={PIVOT.x - ARM - 6} y={PIVOT.y - 5} width={2 * ARM + 12} height={10} rx={5} fill="url(#kit-metal)" stroke="#7f8b90" strokeWidth="0.8" />
        <line x1={PIVOT.x} x2={PIVOT.x} y1={PIVOT.y} y2={PIVOT.y - 54} stroke={target === 0 && Math.abs(angle) < 0.05 ? 'var(--ok)' : '#c62828'} strokeWidth="3" strokeLinecap="round" />
        <circle cx={PIVOT.x - ARM} cy={PIVOT.y} r={5} fill="url(#kit-metal)" stroke="#7f8b90" />
        <circle cx={PIVOT.x + ARM} cy={PIVOT.y} r={5} fill="url(#kit-metal)" stroke="#7f8b90" />
      </g>
      <circle cx={PIVOT.x} cy={PIVOT.y} r={8} fill="url(#kit-metal)" stroke="#6d7b80" />
      <circle cx={PIVOT.x} cy={PIVOT.y} r={2.5} fill="#55605f" />
    </svg>
  );

  const ctrls = species.map((s, i) => {
    const side = sideOf(i);
    const sl = slotOf(i);
    const m = shelfModels[i];
    return (
      <SpeciesControl
        key={`${reactionId}-${i}`}
        index={i}
        species={s}
        side={side}
        value={coefs[i]}
        palette={{ x: sl.x + 4, y: SHELF.top - 18, w: sl.w - 8, h: SHELF.board - SHELF.top + 16 }}
        column={{ x: sl.x + 2, y: AREA.top + dy[side], w: sl.w - 4, h: PAN_Y + 14 - AREA.top }}
        ghost={<Molecule formula={s.formula} cx={0} cy={0} scale={m.scale} />}
        zoneOf={zoneOf}
        onSet={setCoef}
        onWrongSide={wrongSide}
      />
    );
  });

  const statusKind = check.status === 'balanceada' ? 'ok' : check.status === 'no minima' ? 'warn' : 'bad';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Mesa de trabajo: estante de modelos y balanza de dos platos">
          <ManipScene viewBox={`0 0 ${VB_W} ${VB_H}`} label="Modelos moleculares que se pueden arrastrar" scene={scene}>
            {ctrls}
          </ManipScene>
        </div>
        <ManipHint>Arrastra un modelo del estante a su bandeja para sumar una unidad, o una molécula fuera de la bandeja para quitarla. Con el teclado: Tab hasta el modelo y flechas arriba/abajo.</ManipHint>
        <p className="small muted" aria-live="polite" style={{ margin: 0, minHeight: '1.4em' }}>{message}</p>
        <div className="card">
          <AtomChart rows={check.rows} mark={mark} />
        </div>
        <Readout live={false} items={[
          { k: 'Ecuación actual', v: equationText(rx, coefs) },
          { k: 'Átomos en reactivos / productos', v: `${check.atomsLeft} / ${check.atomsRight}` },
        ]} />
        <Readout items={[
          { k: 'Estado de la ecuación', v: verified ? STATUS_TEXT[check.status] : 'sin verificar', data: true },
          { k: 'Átomos desbalanceados (Σ|ΔN|)', v: verified ? fmt(check.imbalance, 0) : '—', data: true },
          { k: 'Masa de reactivos (Σ ν·M)', v: verified ? `${fmt(check.massReactants, 2)} g` : '—', data: true },
          { k: 'Masa de productos (Σ ν·M)', v: verified ? `${fmt(check.massProducts, 2)} g` : '—', data: true },
          { k: 'Diferencia de masa (productos − reactivos)', v: verified ? `${signed(check.massDifference)} g` : '—', data: true },
          { k: 'Máximo común divisor de los coeficientes', v: verified ? fmt(check.divisor, 0) : '—' },
        ]} />
        {verified && (
          <Notice kind={statusKind}>
            {check.status === 'balanceada' && `Cada elemento tiene los mismos átomos a los dos lados (${check.atomsLeft} átomos en total) y la masa se conserva: ${fmt(check.massReactants, 2)} g = ${fmt(check.massProducts, 2)} g (ley de Lavoisier). Los coeficientes no tienen divisor común, y el método algebraico confirma que esta es la única respuesta con los menores enteros.`}
            {check.status === 'no minima' && `Los átomos y las masas coinciden, pero todos los coeficientes se pueden dividir entre ${check.divisor}: la ecuación es ${check.divisor} veces la forma convencional. Simplifícala.`}
            {check.status === 'no balanceada' && `Hay ${check.imbalance} átomo${check.imbalance === 1 ? '' : 's'} desbalanceado${check.imbalance === 1 ? '' : 's'} y las masas difieren en ${fmt(Math.abs(check.massDifference), 2)} g: así escrita, la ecuación «crearía» o «destruiría» materia. Ajusta los coeficientes.`}
          </Notice>
        )}
        {activeHint && <Notice kind="info"><strong>Pista:</strong> {activeHint.text}</Notice>}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Reacción</h3>
          <Select label="Ecuación química" value={reactionId} onChange={changeReaction}
            options={REACTIONS.map((r) => ({ value: r.id, label: `${LEVEL_NAME[r.level]} · ${r.name}` }))} />
          <p className="small muted" style={{ margin: 0 }}>{rx.context}</p>
        </div>
        <div className="card stack">
          <h3>Coeficientes</h3>
          {species.map((s, i) => {
            const pf = prettyFormula(s.formula);
            return (
              <div key={`${reactionId}-${i}`} role="group" aria-label={`Coeficiente de ${pf}`} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <span className="small">
                  <span className="chip" style={{ marginRight: 6 }}>{i < nR ? 'Reactivo' : 'Producto'}</span>
                  <strong>{pf}</strong> <span className="muted">({s.name})</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" className="btn small" aria-label={`Disminuir el coeficiente de ${pf}`} disabled={coefs[i] <= RANGE.min} onClick={() => setCoef(i, coefs[i] - 1, 'boton')}>−</button>
                  <output aria-live="off" style={{ minWidth: '2ch', textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{coefs[i]}</output>
                  <button type="button" className="btn small" aria-label={`Aumentar el coeficiente de ${pf}`} disabled={coefs[i] >= RANGE.max} onClick={() => setCoef(i, coefs[i] + 1, 'boton')}>+</button>
                </span>
              </div>
            );
          })}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={verify} disabled={verified}>Verificar la ecuación</button>
            <button type="button" className="btn" onClick={askHint}>Pedir una pista</button>
            <button type="button" className="btn" onClick={resetCoefs}>Coeficientes en 1</button>
          </div>
          <RecordButton onRecord={record} disabled={!verified} />
          {!verified && <p className="small muted" style={{ margin: 0 }}>Ajusta los coeficientes y pulsa «Verificar la ecuación» para medir las masas y guardar el intento.</p>}
        </div>
        <details className="card">
          <summary>Método algebraico (espacio nulo)</summary>
          <div className="stack-sm">
            <p className="small">Una letra por coeficiente: {species.map((s, i) => `${LETTERS[i]} = ${prettyFormula(s.formula)}`).join(', ')}. Una ecuación por elemento:</p>
            <ul className="list small" style={{ fontFamily: 'var(--font-data)' }}>
              {solver.equations.map((e) => <li key={e}>{e}</li>)}
            </ul>
            {!solverShown ? (
              <button type="button" className="btn small" onClick={() => setSolverShown(true)}>Resolver el sistema</button>
            ) : (
              <p className="small">
                Gauss-Jordan con fracciones exactas: el espacio nulo tiene dimensión {solver.nullity}
                {solver.unique ? ', así que la solución es única salvo un factor común. ' : '; no hay una única forma mínima. '}
                {solver.coefficients && <>Menores enteros (mcd = 1): <strong>{equationText(rx, solver.coefficients)}</strong>.</>}
              </p>
            )}
          </div>
        </details>
        <Notice>Modelo idealizado: las fórmulas están dadas y solo cambian los coeficientes (enteros de 1 a 12). Las masas leen los coeficientes como moles (Σ ν·M, masas atómicas CIAAW, resolución 0,01 g). La inclinación de la balanza exagera las diferencias pequeñas para que se vean. Los modelos son esquemas planos con colores CPK; no se balancean cargas eléctricas.</Notice>
      </div>
    </div>
  );
}

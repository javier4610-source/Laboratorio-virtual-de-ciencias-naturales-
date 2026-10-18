import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  PART_INFO, SC, SIMPLE_CIRCUIT_INSTRUMENTS, lampArrangement, solveSimpleCircuit,
  type MeterMode, type NetPart, type PartKind, type PartResult,
} from '../models/simpleCircuits';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { usePublishModel } from '../components/Advanced';
import { useMeasure } from '../components/Measurement';
import { BenchTop, Lcd } from './kit';
import { ManipHint, ManipScene, toSvgPoint, type Pt } from './manipulate';
import { playSound, useLabSound, volumeToGain } from '../lib/sound';

/* ------------------------------------------------------------------ mesa de bornes */

const W = 760, H = 500;
const COLS = 8, ROWS = 5;
const X0 = 238, Y0 = 84, STEP = 70, HALF = STEP / 2;
const TRAY_W = 204;
const COL_NAMES = 'ABCDEFGH';
const px = (c: number) => X0 + STEP * c;
const py = (r: number) => Y0 + STEP * r;
const nodeId = (r: number, c: number) => `r${r}c${c}`;
const pointName = (r: number, c: number) => `${COL_NAMES[c]}${r + 1}`;
const nodeName = (n: string) => { const m = /^r(\d+)c(\d+)$/.exec(n); return m ? pointName(Number(m[1]), Number(m[2])) : n; };

type Dir = 'h' | 'v';
type PieceKind = Exclude<PartKind, 'cable'>;
interface GridPt { r: number; c: number }
interface Placed { id: string; kind: PieceKind; r: number; c: number; dir: Dir; flip: boolean; closed?: boolean; mode?: MeterMode }
interface Wire { id: string; from: GridPt; to: GridPt; color: number }
interface Board { parts: Placed[]; wires: Wire[]; preset: string }

const PREFIX: Record<PieceKind, string> = {
  pila: 'P', interruptor: 'S', bombillo: 'B', led: 'LED', resistor: 'R', motor: 'M', zumbador: 'Z',
  clip: 'X', moneda: 'X', grafito: 'X', borrador: 'X', plastico: 'X', multimetro: 'MM',
};
const TEST_KINDS: PieceKind[] = ['clip', 'moneda', 'grafito', 'borrador', 'plastico'];
const SHORT_NAME: Record<PieceKind | 'cable', string> = {
  pila: 'Pila AA', interruptor: 'Interruptor', bombillo: 'Bombillo', led: 'LED', resistor: 'Resistor', motor: 'Motor', zumbador: 'Zumbador',
  clip: 'Clip', moneda: 'Moneda', grafito: 'Grafito', borrador: 'Borrador', plastico: 'Plástico', multimetro: 'Multímetro', cable: 'Cable',
};
const TRAY: (PieceKind | 'cable')[] = ['pila', 'interruptor', 'bombillo', 'led', 'resistor', 'motor', 'zumbador', 'clip', 'moneda', 'grafito', 'borrador', 'plastico', 'multimetro', 'cable'];
const tileXY = (i: number) => ({ x: 14 + (i % 2) * 94, y: 42 + Math.floor(i / 2) * 64 });
const TILE_W = 88, TILE_H = 58;
const WIRE_COLORS = ['#c62828', '#1f2a30', '#d9a400', '#2e7d32', '#1565c0'];

const slotEnds = (p: { r: number; c: number; dir: Dir }): [GridPt, GridPt] => [{ r: p.r, c: p.c }, p.dir === 'h' ? { r: p.r, c: p.c + 1 } : { r: p.r + 1, c: p.c }];
const slotValid = (r: number, c: number, dir: Dir) => r >= 0 && c >= 0 && (dir === 'h' ? r < ROWS && c + 1 < COLS : r + 1 < ROWS && c < COLS);
const sameSlot = (a: { r: number; c: number; dir: Dir }, b: { r: number; c: number; dir: Dir }) => a.r === b.r && a.c === b.c && a.dir === b.dir;
const eqPt = (a: GridPt, b: GridPt) => a.r === b.r && a.c === b.c;

/** Terminales a y b de una pieza (con su polaridad). */
function terminals(p: Placed): [GridPt, GridPt] {
  const [p1, p2] = slotEnds(p);
  return p.flip ? [p2, p1] : [p1, p2];
}

/** Matriz de dibujo: eje x local de a hacia b; el lado «−y» local apunta hacia arriba (horizontal) o a la derecha (vertical). */
function frame(p: Placed) {
  const [a, b] = terminals(p);
  const ax = px(a.c), ay = py(a.r), bx = px(b.c), by = py(b.r);
  const ux = Math.sign(bx - ax), uy = Math.sign(by - ay);
  const [qx, qy] = p.dir === 'h' ? [0, 1] : [-1, 0];
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  return { cx, cy, det: ux * qy - uy * qx, m: `matrix(${ux} ${uy} ${qx} ${qy} ${cx} ${cy})` };
}

function nextId(board: Board, kind: PieceKind): string {
  if (kind === 'multimetro') return 'MM';
  const pre = PREFIX[kind];
  const used = new Set(board.parts.filter((p) => PREFIX[p.kind] === pre).map((p) => p.id));
  for (let n = 1; ; n++) if (!used.has(`${pre}${n}`)) return `${pre}${n}`;
}
function nextWireId(board: Board): string {
  const used = new Set(board.wires.map((w) => w.id));
  for (let n = 1; ; n++) if (!used.has(`C${n}`)) return `C${n}`;
}

/* ------------------------------------------------------------------ circuitos de ejemplo */

const pc = (id: string, kind: PieceKind, r: number, c: number, dir: Dir, flip = false, extra: Partial<Placed> = {}): Placed => ({ id, kind, r, c, dir, flip, ...extra });
const wc = (id: string, a: [number, number], b: [number, number], color: number): Wire => ({ id, from: { r: a[0], c: a[1] }, to: { r: b[0], c: b[1] }, color });
const PACK = [pc('P1', 'pila', 1, 0, 'v', true), pc('P2', 'pila', 2, 0, 'v', true)];

const PRESETS: { key: string; label: string; build: () => Board }[] = [
  {
    key: 'un-bombillo', label: 'un bombillo', build: () => ({
      preset: 'Un bombillo', parts: [pc('P1', 'pila', 1, 0, 'v', true), pc('S1', 'interruptor', 1, 0, 'h', false, { closed: false }), pc('MM', 'multimetro', 1, 1, 'h', false, { mode: 'A' }), pc('B1', 'bombillo', 1, 2, 'h')],
      wires: [wc('C1', [2, 0], [3, 0], 1), wc('C2', [1, 3], [3, 3], 0), wc('C3', [3, 3], [3, 0], 1)],
    }),
  },
  {
    key: 'serie', label: 'dos bombillos en serie', build: () => ({
      preset: 'Dos bombillos en serie', parts: [...PACK, pc('S1', 'interruptor', 1, 0, 'h', false, { closed: true }), pc('MM', 'multimetro', 1, 1, 'h', false, { mode: 'A' }), pc('B1', 'bombillo', 1, 2, 'h'), pc('B2', 'bombillo', 1, 3, 'h')],
      wires: [wc('C1', [1, 4], [3, 4], 0), wc('C2', [3, 4], [3, 0], 1)],
    }),
  },
  {
    key: 'paralelo', label: 'dos bombillos en paralelo', build: () => ({
      preset: 'Dos bombillos en paralelo', parts: [...PACK, pc('S1', 'interruptor', 1, 0, 'h', false, { closed: true }), pc('MM', 'multimetro', 1, 1, 'h', false, { mode: 'A' }), pc('B1', 'bombillo', 1, 2, 'v'), pc('B2', 'bombillo', 1, 4, 'v')],
      wires: [wc('C1', [1, 2], [1, 4], 0), wc('C2', [2, 2], [2, 4], 1), wc('C3', [2, 4], [3, 4], 1), wc('C4', [3, 4], [3, 0], 1)],
    }),
  },
  {
    key: 'led', label: 'LED con resistor', build: () => ({
      preset: 'LED con resistor', parts: [...PACK, pc('S1', 'interruptor', 1, 0, 'h', false, { closed: true }), pc('R1', 'resistor', 1, 1, 'h'), pc('LED1', 'led', 1, 2, 'h'), pc('MM', 'multimetro', 1, 3, 'h', false, { mode: 'A' })],
      wires: [wc('C1', [1, 4], [3, 4], 0), wc('C2', [3, 4], [3, 0], 1)],
    }),
  },
  {
    key: 'motor', label: 'motor', build: () => ({
      preset: 'Motor', parts: [...PACK, pc('S1', 'interruptor', 1, 0, 'h', false, { closed: true }), pc('MM', 'multimetro', 1, 1, 'h', false, { mode: 'A' }), pc('M1', 'motor', 1, 2, 'h')],
      wires: [wc('C1', [1, 3], [3, 3], 0), wc('C2', [3, 3], [3, 0], 1)],
    }),
  },
  {
    key: 'materiales', label: 'prueba de materiales', build: () => ({
      preset: 'Prueba de materiales', parts: [...PACK, pc('S1', 'interruptor', 1, 0, 'h', false, { closed: true }), pc('B1', 'bombillo', 1, 1, 'h'), pc('X1', 'clip', 1, 2, 'h'), pc('MM', 'multimetro', 1, 3, 'h', false, { mode: 'A' })],
      wires: [wc('C1', [1, 4], [3, 4], 0), wc('C2', [3, 4], [3, 0], 1)],
    }),
  },
];

/** Netlist del modelo a partir de la mesa. */
function toNetlist(board: Board): NetPart[] {
  const list: NetPart[] = board.parts.map((p) => {
    const [a, b] = terminals(p);
    return { id: p.id, kind: p.kind, a: nodeId(a.r, a.c), b: nodeId(b.r, b.c), closed: p.closed, mode: p.mode };
  });
  for (const w of board.wires) list.push({ id: w.id, kind: 'cable', a: nodeId(w.from.r, w.from.c), b: nodeId(w.to.r, w.to.c) });
  return list;
}

/* ------------------------------------------------------------------ sonidos continuos (motor y zumbador) */

/** Zumbido del motor (diente de sierra a la frecuencia de conmutación) y tono del zumbador, a volumen bajo. */
function useCircuitTones(motorLevel: number, motorFreq: number, buzz: number) {
  const { enabled, visible, ready, volume } = useLabSound();
  const g = useRef<{ ctx: AudioContext; master: GainNode; mo: OscillatorNode; mg: GainNode; bz: OscillatorNode; bg: GainNode } | null>(null);
  const active = enabled && visible && ready && (motorLevel > 0 || buzz > 0);
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    let ctx: AudioContext;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
      const master = ctx.createGain(); master.gain.value = 0;
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -16; lim.ratio.value = 12;
      master.connect(lim).connect(ctx.destination);
      const mo = ctx.createOscillator(); mo.type = 'sawtooth'; mo.frequency.value = 120;
      const mf = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 650;
      const mg = ctx.createGain(); mg.gain.value = 0;
      mo.connect(mf).connect(mg).connect(master); mo.start();
      const bz = ctx.createOscillator(); bz.type = 'square'; bz.frequency.value = 2300;
      const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 3200;
      const bg = ctx.createGain(); bg.gain.value = 0;
      bz.connect(bf).connect(bg).connect(master); bz.start();
      g.current = { ctx, master, mo, mg, bz, bg };
    } catch { return; }
    return () => {
      const cur = g.current; g.current = null;
      if (!cur) return;
      try {
        cur.master.gain.setTargetAtTime(0, cur.ctx.currentTime, 0.03);
        setTimeout(() => { try { cur.mo.stop(); cur.bz.stop(); void cur.ctx.close(); } catch { /* sin acción */ } }, 200);
      } catch { /* sin acción */ }
    };
  }, [active]);
  useEffect(() => {
    const cur = g.current;
    if (!cur) return;
    try {
      const t = cur.ctx.currentTime;
      cur.master.gain.setTargetAtTime(0.12 * volumeToGain(volume), t, 0.05);
      cur.mg.gain.setTargetAtTime(0.35 * motorLevel, t, 0.08);
      cur.mo.frequency.setTargetAtTime(Math.max(30, motorFreq), t, 0.15);
      cur.bg.gain.setTargetAtTime(0.05 * buzz, t, 0.03);
    } catch { /* sin acción */ }
  }, [active, motorLevel, motorFreq, buzz, volume]);
}

/* ------------------------------------------------------------------ dibujo de las piezas */

function Defs() {
  return (
    <defs>
      <radialGradient id="csi-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff6c8" stopOpacity="0.95" />
        <stop offset="0.4" stopColor="#ffd54a" stopOpacity="0.45" />
        <stop offset="1" stopColor="#ffb300" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="csi-halo-red" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd0d0" stopOpacity="0.95" />
        <stop offset="0.35" stopColor="#ff3b30" stopOpacity="0.5" />
        <stop offset="1" stopColor="#ff1a1a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="csi-heat" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff7043" stopOpacity="0.85" />
        <stop offset="1" stopColor="#ff3d00" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="csi-cell" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#3c4448" /><stop offset="0.3" stopColor="#6d777b" /><stop offset="0.55" stopColor="#262d30" /><stop offset="1" stopColor="#101416" />
      </linearGradient>
      <linearGradient id="csi-copper" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#8a4b12" /><stop offset="0.3" stopColor="#f2b066" /><stop offset="0.6" stopColor="#c46f22" /><stop offset="1" stopColor="#6f3a0c" />
      </linearGradient>
      <linearGradient id="csi-board" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f3efe6" /><stop offset="1" stopColor="#e2dccd" />
      </linearGradient>
      <linearGradient id="csi-can" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#8d989d" /><stop offset="0.3" stopColor="#eef2f3" /><stop offset="0.55" stopColor="#c3ccd0" /><stop offset="1" stopColor="#7d888d" />
      </linearGradient>
      <linearGradient id="csi-case" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffd34d" /><stop offset="1" stopColor="#e0a800" />
      </linearGradient>
      <radialGradient id="csi-coin" cx="0.38" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#f5c98a" /><stop offset="0.6" stopColor="#c58a3a" /><stop offset="1" stopColor="#8d5a1e" />
      </radialGradient>
    </defs>
  );
}

/** Color del filamento según su temperatura (aproximación de cuerpo negro). */
function filamentColor(T: number): string {
  if (T < 750) return '#6d5a4a';
  const t = Math.min(1, (T - 750) / 1950);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(190, 255)}, ${mix(40, 244)}, ${mix(10, 200)})`;
}

const Lead = ({ x1, x2 }: { x1: number; x2: number }) => (
  <g>
    <line x1={x1} x2={x2} y1={0} y2={0} stroke="#7d8a8f" strokeWidth="3.2" strokeLinecap="round" />
    <line x1={x1} x2={x2} y1={-0.8} y2={-0.8} stroke="#eef2f3" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
  </g>
);

/** Pinza de caimán (sujeta los materiales de prueba). */
const Croc = ({ x, color }: { x: number; color: string }) => (
  <g>
    <path d={`M${x - 7} -3 L${x + 7} -2 L${x + 7} 2 L${x - 7} 3 Z`} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.6" />
    <path d={`M${x - 3} -3 l1.5 2 l1.5 -2 l1.5 2 l1.5 -2`} fill="none" stroke="#6d7b80" strokeWidth="0.6" />
    <rect x={x - (x < 0 ? 12 : -4)} y={-4} width={8} height={8} rx={2} fill={color} />
  </g>
);

interface ArtProps { p: Placed; res?: PartResult; rotorRef?: (el: SVGGElement | null) => void; ghost?: boolean }

/** Dibujo de una pieza en coordenadas locales: terminales en x = ±35, cuerpo hacia y negativa. */
function PartArt({ p, res, rotorRef }: ArtProps) {
  const on = res?.on ?? false;
  switch (p.kind) {
    case 'pila': {
      const heat = Math.min(1, (res?.heating ?? 0) / 4);
      return (
        <g>
          {heat > 0.05 && <ellipse cx={0} cy={0} rx={34 + 10 * heat} ry={16 + 8 * heat} fill="url(#csi-heat)" opacity={0.3 + 0.7 * heat} />}
          <Lead x1={-35} x2={-28} /><Lead x1={26} x2={35} />
          <rect x={-31} y={-12} width={62} height={24} rx={3} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
          <rect x={-27} y={-9} width={50} height={18} rx={3} fill="url(#csi-cell)" />
          <rect x={8} y={-9} width={15} height={18} rx={2} fill="url(#csi-copper)" />
          <rect x={23} y={-4} width={4} height={8} rx={1} fill="url(#kit-metal)" />
          <path d="M-18 -4 h6 M-15 -7 v6" stroke="#e6eaeb" strokeWidth="1.2" opacity="0.8" />
          <path d="M12 0 h6" stroke="#3b2208" strokeWidth="1.4" />
          {heat > 0.05 && [-16, 0, 16].map((dx) => (
            <path key={dx} d={`M${dx} -16 q4 -5 0 -10 q-4 -5 0 -10`} fill="none" stroke="#ff5722" strokeWidth="1.6" strokeLinecap="round" opacity={0.4 + 0.6 * heat} />
          ))}
        </g>
      );
    }
    case 'interruptor': {
      const closed = !!p.closed;
      return (
        <g>
          <Lead x1={-35} x2={-20} /><Lead x1={20} x2={35} />
          <rect x={-25} y={-6} width={50} height={13} rx={3} fill="url(#kit-body)" stroke="#a9b4b6" filter="url(#kit-shadow-soft)" />
          <rect x={12} y={-7} width={7} height={10} rx={1} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.6" />
          <circle cx={-15} cy={0} r={3.8} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.8" />
          <g transform={`rotate(${closed ? 0 : -40} -15 0)`}>
            <rect x={-15} y={-1.9} width={33} height={3.8} rx={1.2} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.6" />
            <rect x={16} y={-4.2} width={8} height={8.4} rx={2} fill={closed ? '#2e7d32' : '#c62828'} />
          </g>
          <circle cx={-15} cy={0} r={1.4} fill="#3a4448" />
        </g>
      );
    }
    case 'bombillo': {
      const b = res ? Math.min(1.4, res.brightness) : 0;
      const T = res?.temperature ?? 300;
      const lit = b > 0.02;
      const glass = 'M-6 -15 C-6 -19 -13 -22 -13 -30 A13 13 0 1 1 13 -30 C13 -22 6 -19 6 -15 Z';
      return (
        <g>
          {lit && <circle cx={0} cy={-31} r={16 + 30 * Math.min(1.2, b)} fill="url(#csi-halo)" opacity={Math.min(1, 0.2 + 0.8 * b)} />}
          <Lead x1={-35} x2={-14} /><Lead x1={14} x2={35} />
          <rect x={-19} y={-6} width={38} height={13} rx={3} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
          {[-13, 13].map((dx) => <circle key={dx} cx={dx} cy={0.5} r={2.8} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />)}
          <rect x={-6.5} y={-16} width={13} height={10} rx={1.5} fill="url(#kit-metal-h)" stroke="#7d8a8f" strokeWidth="0.5" />
          {[-13, -10, -7.5].map((dy) => <line key={dy} x1={-6.5} x2={6.5} y1={dy} y2={dy + 1} stroke="#7d8a8f" strokeWidth="0.7" />)}
          <path d={glass} fill={lit ? `rgba(255, 236, 170, ${Math.min(0.92, 0.25 + 0.6 * b)})` : 'url(#kit-glass-fill)'} />
          <path d="M-2 -16 L-4 -29 M2 -16 L4 -29" stroke="#8d9a9f" strokeWidth="0.8" />
          <path d="M-4 -29 l1.6 -2.4 l1.6 2.4 l1.6 -2.4 l1.6 2.4 l1.6 -2.4" fill="none" stroke={filamentColor(T)} strokeWidth={lit ? 1.6 : 1} strokeLinejoin="round" />
          <path d={glass} fill="url(#kit-glass)" stroke="var(--glass-edge, #9fb3b8)" strokeWidth="1.2" />
          <path d="M-8 -34 A9 9 0 0 1 -2 -40" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    }
    case 'led': {
      const b = res ? Math.min(1.5, res.brightness) : 0;
      const lit = on;
      return (
        <g>
          {lit && <circle cx={0} cy={-22} r={10 + 18 * Math.min(1.2, b)} fill="url(#csi-halo-red)" opacity={Math.min(1, 0.3 + 0.7 * b)} />}
          {/* patica larga (ánodo, a) y corta (cátodo, b) */}
          <path d="M-35 0 H-3 V-8" fill="none" stroke="#9aa5ab" strokeWidth="1.8" />
          <path d="M35 0 H3 V-8" fill="none" stroke="#9aa5ab" strokeWidth="1.8" />
          <path d="M-9 -8 V-12 H9 V-8 Z" fill={lit ? '#ff6b5e' : '#c0392b'} opacity="0.9" />
          <path d="M-7 -12 V-24 A7 7 0 0 1 7 -24 V-12 Z" fill={lit ? '#ff8a80' : '#d32f2f'} opacity={lit ? 0.95 : 0.75} stroke="#8e1b12" strokeWidth="0.7" />
          <line x1={9} x2={9} y1={-12} y2={-8} stroke="#8e1b12" strokeWidth="1.4" />
          <path d="M-4 -22 A4 4 0 0 1 -1 -27" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.7" strokeLinecap="round" />
          <text x={-22} y={-5} style={{ fontSize: 8, fill: '#5d6b70', fontWeight: 700 }}>+</text>
        </g>
      );
    }
    case 'resistor':
      return (
        <g>
          <Lead x1={-35} x2={-17} /><Lead x1={17} x2={35} />
          <path d="M-18 -5 Q-18 -7 -15 -7 H-10 Q-8 -5 -6 -5 H6 Q8 -5 10 -7 H15 Q18 -7 18 -5 V5 Q18 7 15 7 H10 Q8 5 6 5 H-6 Q-8 5 -10 7 H-15 Q-18 7 -18 5 Z" fill="#dcc497" stroke="#a88b55" strokeWidth="0.7" filter="url(#kit-shadow-soft)" />
          {[[-12, '#7b4a26'], [-5, '#1d1d1d'], [1, '#7b4a26'], [11, '#c9a227']].map(([x, col]) => <rect key={x as number} x={x as number} y={-6} width={3} height={12} fill={col as string} />)}
          <path d="M-16 -4 H16" stroke="#fff" strokeWidth="1" opacity="0.4" />
        </g>
      );
    case 'motor':
      return (
        <g>
          <path d="M-35 0 H-8 V-8" fill="none" stroke="#c62828" strokeWidth="2.2" />
          <path d="M35 0 H8 V-8" fill="none" stroke="#1f2a30" strokeWidth="2.2" />
          <rect x={-15} y={-34} width={30} height={27} rx={5} fill="url(#csi-can)" stroke="#6d7b80" strokeWidth="0.7" filter="url(#kit-shadow-soft)" />
          <rect x={-15} y={-12} width={30} height={5} rx={1.5} fill="#e9e2cf" stroke="#9b927b" strokeWidth="0.5" />
          <rect x={-1.5} y={-42} width={3} height={8} fill="url(#kit-metal-h)" />
          <g transform="translate(0 -48)">
            <g ref={rotorRef}>
              <circle r={12} fill="#f5f5f5" stroke="#5d6b70" strokeWidth="0.8" />
              <path d="M0 0 L0 -12 A12 12 0 0 1 10.4 -6 Z M0 0 L0 12 A12 12 0 0 1 -10.4 6 Z" fill="#e53935" />
              <circle r={2} fill="#5d6b70" />
            </g>
          </g>
          <text x={-28} y={-5} style={{ fontSize: 8, fill: '#c62828', fontWeight: 700 }}>+</text>
        </g>
      );
    case 'zumbador': {
      const lvl = res && on ? Math.min(1, res.brightness) : 0;
      return (
        <g>
          <path d="M-35 0 H-6 V-6" fill="none" stroke="#c62828" strokeWidth="2" />
          <path d="M35 0 H6 V-6" fill="none" stroke="#1f2a30" strokeWidth="2" />
          <circle cx={0} cy={-18} r={13} fill="#1d2326" stroke="#000" strokeWidth="0.6" filter="url(#kit-shadow-soft)" />
          <circle cx={0} cy={-18} r={9} fill="none" stroke="#3a4448" strokeWidth="1" />
          <circle cx={0} cy={-18} r={2.2} fill="#0a0d0e" />
          <text x={-11} y={-25} style={{ fontSize: 7, fill: '#e6eaeb', fontWeight: 700 }}>+</text>
          {lvl > 0 && [0, 1, 2].map((k) => (
            <path key={k} d={`M${16 + 5 * k} ${-28 - 2 * k} A${8 + 5 * k} ${8 + 5 * k} 0 0 1 ${16 + 5 * k} ${-8 + 2 * k}`} fill="none" stroke="var(--fis, #1565c0)" strokeWidth="1.6" strokeLinecap="round" opacity={(0.3 + 0.7 * lvl) * (1 - k * 0.25)} />
          ))}
        </g>
      );
    }
    case 'clip':
      return (
        <g>
          <Lead x1={-35} x2={-26} /><Lead x1={26} x2={35} />
          <path d="M-22 4 H16 A5 5 0 0 0 16 -6 H-18 A4 4 0 0 0 -18 2 H12 A3 3 0 0 0 12 -3 H-12" fill="none" stroke="#a7b1b5" strokeWidth="2" strokeLinecap="round" filter="url(#kit-shadow-soft)" />
          <Croc x={-24} color="#c62828" /><Croc x={22} color="#1f2a30" />
        </g>
      );
    case 'moneda':
      return (
        <g>
          <Lead x1={-35} x2={-22} /><Lead x1={22} x2={35} />
          <circle cx={0} cy={0} r={15} fill="url(#csi-coin)" stroke="#7a4b15" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
          <circle cx={0} cy={0} r={11} fill="none" stroke="#8d5a1e" strokeWidth="0.7" opacity="0.7" />
          <Croc x={-18} color="#c62828" /><Croc x={16} color="#1f2a30" />
        </g>
      );
    case 'grafito':
      return (
        <g>
          <Lead x1={-35} x2={-28} /><Lead x1={28} x2={35} />
          <rect x={-26} y={-2} width={52} height={4} rx={1.5} fill="#43494f" stroke="#2a2e32" strokeWidth="0.5" filter="url(#kit-shadow-soft)" />
          <line x1={-24} x2={24} y1={-1} y2={-1} stroke="#9aa3aa" strokeWidth="0.6" />
          <Croc x={-26} color="#c62828" /><Croc x={24} color="#1f2a30" />
        </g>
      );
    case 'borrador':
      return (
        <g>
          <Lead x1={-35} x2={-26} /><Lead x1={26} x2={35} />
          <rect x={-20} y={-9} width={40} height={18} rx={3} fill="#f4b6c2" stroke="#c98595" strokeWidth="0.7" filter="url(#kit-shadow-soft)" />
          <rect x={2} y={-9} width={18} height={18} rx={3} fill="#5c8fd6" opacity="0.85" />
          <Croc x={-24} color="#c62828" /><Croc x={22} color="#1f2a30" />
        </g>
      );
    case 'plastico':
      return (
        <g>
          <Lead x1={-35} x2={-28} /><Lead x1={28} x2={35} />
          <rect x={-26} y={-7} width={52} height={14} rx={1.5} fill="rgba(90, 160, 225, 0.45)" stroke="#3f7fb8" strokeWidth="0.7" />
          {Array.from({ length: 11 }, (_, k) => <line key={k} x1={-24 + 4.8 * k} x2={-24 + 4.8 * k} y1={-7} y2={k % 5 === 0 ? -1 : -4} stroke="#1f4e79" strokeWidth="0.6" />)}
          <Croc x={-26} color="#c62828" /><Croc x={24} color="#1f2a30" />
        </g>
      );
    default:
      return null;
  }
}

/** Puntas del multímetro sobre los bornes de su ranura (a = roja, b = negra). */
function MeterProbes({ p }: { p: Placed }) {
  const [a, b] = terminals(p);
  const tip = (g: GridPt, color: string, k: number) => {
    const x = px(g.c), y = py(g.r);
    const off = p.dir === 'h' ? { dx: k ? 9 : -9, dy: 18 } : { dx: -18, dy: k ? 9 : -9 };
    return (
      <g key={k}>
        <line x1={x} y1={y} x2={x + off.dx} y2={y + off.dy} stroke="#aab4b8" strokeWidth="2" />
        <line x1={x + off.dx * 0.35} y1={y + off.dy * 0.35} x2={x + off.dx * 1.4} y2={y + off.dy * 1.4} stroke={color} strokeWidth="5.5" strokeLinecap="round" />
        <circle cx={x} cy={y} r={2.4} fill={color} stroke="#fff" strokeWidth="0.8" />
      </g>
    );
  };
  return <g>{tip(a, '#c62828', 0)}{tip(b, '#1f2a30', 1)}</g>;
}

const METER = { x: 616, y: 398, w: 128, h: 94 };
const JACKS = { red: { x: METER.x + 92, y: METER.y + 82 }, black: { x: METER.x + 112, y: METER.y + 82 } };

function MeterLeads({ p }: { p: Placed }) {
  const [a, b] = terminals(p);
  const tail = (g: GridPt, k: number) => {
    const off = p.dir === 'h' ? { dx: k ? 9 : -9, dy: 18 } : { dx: -18, dy: k ? 9 : -9 };
    return { x: px(g.c) + off.dx * 1.4, y: py(g.r) + off.dy * 1.4 };
  };
  const lead = (from: { x: number; y: number }, to: { x: number; y: number }, color: string) => (
    <path d={`M${from.x} ${from.y} C${from.x} ${from.y + 60}, ${to.x} ${to.y + 50}, ${to.x} ${to.y}`} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
  );
  return <g>{lead(tail(a, 0), JACKS.red, '#c62828')}{lead(tail(b, 1), JACKS.black, '#1f2a30')}</g>;
}

function MeterBody({ text, unit, mode }: { text: string; unit: string; mode: MeterMode | null }) {
  const { x, y, w, h } = METER;
  const angle = mode === 'A' ? 40 : mode === 'V' ? -40 : 0;
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={w} height={h} rx={12} fill="url(#csi-case)" stroke="#b58800" />
        <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx={8} fill="#2b3336" />
      </g>
      <Lcd x={x + 10} y={y + 10} w={w - 20} h={30} text={text} unit={unit} />
      <circle cx={x + 34} cy={y + 66} r={15} fill="url(#kit-body-dark)" stroke="#11171a" />
      <g transform={`rotate(${angle} ${x + 34} ${y + 66})`}><rect x={x + 32} y={y + 52} width={4} height={14} rx={2} fill="#e6eaeb" /></g>
      <text x={x + 12} y={y + 54} style={{ fontSize: 8, fill: mode === 'V' ? '#ffe082' : '#c9d2d5', fontWeight: 700 }}>V</text>
      <text x={x + 50} y={y + 54} style={{ fontSize: 8, fill: mode === 'A' ? '#ffe082' : '#c9d2d5', fontWeight: 700 }}>A</text>
      <circle cx={JACKS.red.x} cy={JACKS.red.y} r={4.2} fill="#c62828" stroke="#11171a" />
      <circle cx={JACKS.black.x} cy={JACKS.black.y} r={4.2} fill="#11171a" stroke="#5d6b70" />
      <text x={JACKS.red.x} y={JACKS.red.y - 7} textAnchor="middle" style={{ fontSize: 6.5, fill: '#e6eaeb' }}>VΩA</text>
      <text x={JACKS.black.x} y={JACKS.black.y - 7} textAnchor="middle" style={{ fontSize: 6.5, fill: '#e6eaeb' }}>COM</text>
    </g>
  );
}

function wirePath(w: Wire) {
  const x1 = px(w.from.c), y1 = py(w.from.r), x2 = px(w.to.c), y2 = py(w.to.r);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const sag = Math.min(16, 6 + len * 0.05);
  const mx = (x1 + x2) / 2 + (-(y2 - y1) / len) * sag * 0.4, my = (y1 + y2) / 2 + sag;
  return { d: `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`, mx, my, x1, y1, x2, y2 };
}

function WireArt({ w, hot }: { w: Wire; hot: boolean }) {
  const { d } = wirePath(w);
  const col = WIRE_COLORS[w.color % WIRE_COLORS.length];
  return (
    <g>
      {hot && <path d={d} fill="none" stroke="#ff7043" strokeWidth="11" strokeLinecap="round" opacity="0.45" />}
      <path d={d} fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="6.5" strokeLinecap="round" transform="translate(1.5 2.5)" />
      <path d={d} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.3" strokeLinecap="round" transform="translate(0 -1.2)" />
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

type Drag =
  | { type: 'new'; kind: PieceKind; point: Pt; moved: boolean }
  | { type: 'move'; id: string; point: Pt; start: Pt; moved: boolean }
  | { type: 'wire'; from: GridPt; point: Pt; start: Pt; moved: boolean }
  | { type: 'wireSel'; id: string; point: Pt; start: Pt; moved: boolean };

function nearestPoint(p: Pt, maxD = 16): GridPt | null {
  const c = Math.round((p.x - X0) / STEP), r = Math.round((p.y - Y0) / STEP);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  return Math.hypot(p.x - px(c), p.y - py(r)) <= maxD ? { r, c } : null;
}
function nearestSlot(p: Pt, maxD = 34): { r: number; c: number; dir: Dir } | null {
  let best: { r: number; c: number; dir: Dir } | null = null, bd = maxD;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const dir of ['h', 'v'] as Dir[]) {
    if (!slotValid(r, c, dir)) continue;
    const mx = dir === 'h' ? px(c) + HALF : px(c), my = dir === 'h' ? py(r) : py(r) + HALF;
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d < bd) { bd = d; best = { r, c, dir }; }
  }
  return best;
}
function partAt(parts: Placed[], p: Pt): Placed | null {
  let best: Placed | null = null, bd = Infinity;
  for (const q of parts) {
    const [a, b] = slotEnds(q);
    const mx = (px(a.c) + px(b.c)) / 2, my = (py(a.r) + py(b.r)) / 2;
    // eje de la pieza y lado del cuerpo
    const along = q.dir === 'h' ? p.x - mx : p.y - my;
    const across = q.dir === 'h' ? my - p.y : p.x - mx; // positivo hacia el cuerpo (arriba / derecha)
    if (Math.abs(along) <= 26 && across >= -12 && across <= (q.kind === 'multimetro' ? 22 : 50)) {
      const d = Math.abs(along) + Math.abs(across) * 0.5;
      if (d < bd) { bd = d; best = q; }
    }
  }
  return best;
}
function wireAt(wires: Wire[], p: Pt): Wire | null {
  for (const w of [...wires].reverse()) {
    const { x1, y1, x2, y2, mx, my } = wirePath(w);
    const cx = 2 * mx - (x1 + x2) / 2, cy = 2 * my - (y1 + y2) / 2; // punto de control de la curva
    for (let k = 1; k < 20; k++) {
      const t = k / 20, u = 1 - t;
      const x = u * u * x1 + 2 * u * t * cx + t * t * x2, y = u * u * y1 + 2 * u * t * cy + t * t * y2;
      if (Math.hypot(p.x - x, p.y - y) < 7) return w;
    }
  }
  return null;
}
const touches = (q: Placed, g: GridPt) => slotEnds(q).some((e) => eqPt(e, g));
const wireTouches = (w: Wire, g: GridPt) => eqPt(w.from, g) || eqPt(w.to, g);

function describePart(p: Placed, r: PartResult | undefined): string {
  if (!r) return 'sin datos';
  switch (p.kind) {
    case 'pila': return r.heating && r.heating > 2 ? `se calienta (${fmt(r.heating, 1)} W de calor)` : r.on ? 'entrega corriente' : 'sin corriente';
    case 'interruptor': return p.closed ? 'cerrado' : 'abierto';
    case 'bombillo': return r.on ? `encendido; brillo ${fmt(Math.min(999, r.brightness * 100), 0)} % del nominal` : 'apagado';
    case 'led': return r.on ? `encendido; brillo ${fmt(Math.min(150, r.brightness * 100), 0)} %` : 'apagado';
    case 'motor': return r.on ? `gira a unas ${fmt(Math.abs(r.rpm ?? 0), 0)} rpm ${(r.rpm ?? 0) > 0 ? '(sentido horario)' : '(sentido antihorario)'}` : 'detenido';
    case 'zumbador': return r.on ? 'suena' : 'en silencio';
    case 'multimetro': return p.mode === 'A' ? 'amperímetro' : 'voltímetro';
    case 'resistor': return r.on ? 'conduce' : 'sin corriente';
    default: return r.on ? 'conduce: es conductor' : 'no conduce (o sin circuito)';
  }
}

export default function SimpleCircuitsLab({ api }: LabProps) {
  const [board, setBoard] = useState<Board>(() => PRESETS[0].build());
  const [palette, setPalette] = useState<PieceKind | 'cable'>('bombillo');
  const [orient, setOrient] = useState<Dir>('h');
  const [focus, setFocus] = useState<GridPt>({ r: 1, c: 1 });
  const [focused, setFocused] = useState(false);
  const [wireStart, setWireStart] = useState<GridPt | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announce, setAnnounce] = useState('');
  const say = (t: string) => setAnnounce(t);

  const netlist = useMemo(() => toNetlist(board), [board]);
  const res = useMemo(() => solveSimpleCircuit(netlist), [netlist]);
  const arrangement = useMemo(() => lampArrangement(netlist), [netlist]);
  const meterPart = board.parts.find((p) => p.kind === 'multimetro') ?? null;

  /* --------------------------------------------- edición de la mesa */
  const edit = (fn: (b: Board) => Board) => setBoard((b) => { const n = fn(b); return n === b ? b : { ...n, preset: 'Montaje libre' }; });
  const slotOwner = (b: Board, s: { r: number; c: number; dir: Dir }, except?: string) => b.parts.find((q) => q.id !== except && sameSlot(q, s));

  const place = (kind: PieceKind, s: { r: number; c: number; dir: Dir }): boolean => {
    if (!slotValid(s.r, s.c, s.dir) || slotOwner(board, s)) return false;
    edit((b) => {
      // Hay un solo multímetro: si ya está en la mesa, se mueve.
      const rest = kind === 'multimetro' ? b.parts.filter((q) => q.kind !== 'multimetro') : b.parts;
      const old = b.parts.find((q) => q.kind === 'multimetro');
      const id = nextId({ ...b, parts: rest }, kind);
      const extra: Partial<Placed> = kind === 'interruptor' ? { closed: false } : kind === 'multimetro' ? { mode: old?.mode ?? 'V' } : {};
      return { ...b, parts: [...rest, { id, kind, ...s, flip: false, ...extra }] };
    });
    playSound('clack', { intensity: 0.45 });
    return true;
  };
  const movePart = (id: string, s: { r: number; c: number; dir: Dir }) => {
    if (!slotValid(s.r, s.c, s.dir) || slotOwner(board, s, id)) return false;
    edit((b) => ({ ...b, parts: b.parts.map((q) => (q.id === id ? { ...q, r: s.r, c: s.c, dir: s.dir } : q)) }));
    playSound('clack', { intensity: 0.4 });
    return true;
  };
  const removeItem = (id: string) => {
    edit((b) => ({ ...b, parts: b.parts.filter((q) => q.id !== id), wires: b.wires.filter((w) => w.id !== id) }));
    if (selected === id) setSelected('');
    playSound('thunk', { intensity: 0.3 });
  };
  const addWire = (from: GridPt, to: GridPt): boolean => {
    if (eqPt(from, to)) return false;
    if (board.wires.some((w) => (eqPt(w.from, from) && eqPt(w.to, to)) || (eqPt(w.from, to) && eqPt(w.to, from)))) return false;
    edit((b) => ({ ...b, wires: [...b.wires, { id: nextWireId(b), from, to, color: b.wires.length }] }));
    playSound('click', { intensity: 0.5 });
    return true;
  };
  const toggleSwitch = (id: string) => {
    edit((b) => ({ ...b, parts: b.parts.map((q) => (q.id === id ? { ...q, closed: !q.closed } : q)) }));
    playSound('switch');
  };
  const flipPart = (id: string) => {
    edit((b) => ({ ...b, parts: b.parts.map((q) => (q.id === id ? { ...q, flip: !q.flip } : q)) }));
    playSound('click', { intensity: 0.4 });
  };
  const setMeterMode = (mode: MeterMode) => {
    remeasure('V', 'A');
    setBoard((b) => ({ ...b, parts: b.parts.map((q) => (q.kind === 'multimetro' ? { ...q, mode } : q)) }));
    playSound('click', { intensity: 0.5 });
  };
  const setMaterial = (id: string, kind: PieceKind) => edit((b) => ({ ...b, parts: b.parts.map((q) => (q.id === id ? { ...q, kind } : q)) }));
  const loadPreset = (i: number) => {
    setBoard(PRESETS[i].build());
    setSelected(''); setWireStart(null);
    remeasure('V', 'A');
    playSound('clack', { intensity: 0.5 });
    say(`Circuito cargado: ${PRESETS[i].label}.`);
  };

  /* --------------------------------------------- sonidos de estado */
  const wasShort = useRef(false);
  useEffect(() => {
    if (res.short && !wasShort.current) playSound('fizz', { intensity: 0.5, duration: 1.4 });
    wasShort.current = res.short;
  }, [res.short]);
  const motors = Object.values(res.parts).filter((p) => p.kind === 'motor' && p.on);
  const maxRpm = motors.reduce((m, p) => Math.max(m, Math.abs(p.rpm ?? 0)), 0);
  const buzzLevel = Object.values(res.parts).filter((p) => p.kind === 'zumbador' && p.on).reduce((m, p) => Math.max(m, Math.min(1, p.brightness)), 0);
  useCircuitTones(Math.min(1, maxRpm / 9000), (maxRpm / 60) * 3, buzzLevel);

  /* --------------------------------------------- animación del rotor del motor */
  const rotors = useRef(new Map<string, SVGGElement>());
  const rotorAngles = useRef(new Map<string, number>());
  const motorKey = motors.map((m) => `${m.id}:${Math.round(m.rpm ?? 0)}`).join('|');
  useEffect(() => {
    if (motors.length === 0 || prefersReducedMotion()) return;
    const speeds = new Map(motors.map((m) => {
      const part = board.parts.find((q) => q.id === m.id);
      const det = part ? frame(part).det : 1;
      return [m.id, ((m.rpm ?? 0) / 9000) * 3 * 360 * det] as const; // estroboscópico: 9000 rpm → 3 vueltas/s
    }));
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
      last = now;
      speeds.forEach((w, id) => {
        const a = ((rotorAngles.current.get(id) ?? 0) + w * dt) % 360;
        rotorAngles.current.set(id, a);
        rotors.current.get(id)?.setAttribute('transform', `rotate(${a.toFixed(2)})`);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motorKey, board.parts]);

  /* --------------------------------------------- multímetro */
  const { measure, remeasure, real } = useMeasure();
  const meterOk = !!res.meter && res.meter.connected;
  const reading = res.meter ? (res.meter.mode === 'V'
    ? measure(res.meter.value, { ...SIMPLE_CIRCUIT_INSTRUMENTS.voltimetro, key: 'V' })
    : measure(res.meter.value, { ...SIMPLE_CIRCUIT_INSTRUMENTS.amperimetro, key: 'A' })) : null;
  const readingText = !res.meter ? 'sin multímetro' : !meterOk ? 'puntas sin conectar' : res.meter.mode === 'V' ? `${fmt(reading, 2)} V` : `${fmt(reading, 3)} A`;
  const lcdText = !res.meter || !meterOk || reading === null ? '- - -' : res.meter.mode === 'V' ? fmt(reading, 2) : fmt(reading, 3);
  const measuredWhat = (() => {
    if (!meterPart || !res.meter) return '—';
    const [a, b] = terminals(meterPart).map((g) => nodeId(g.r, g.c));
    if (res.meter.mode === 'A') return 'corriente en serie';
    const across = netlist.find((q) => q.kind !== 'multimetro' && q.kind !== 'cable' && ((q.a === a && q.b === b) || (q.a === b && q.b === a)));
    return across ? `voltaje en ${across.id}` : `voltaje entre ${nodeName(a)} y ${nodeName(b)}`;
  })();
  const lamps = Object.values(res.parts).filter((p) => p.kind === 'bombillo');
  const avgBright = lamps.length ? lamps.reduce((s, p) => s + p.brightness, 0) / lamps.length : null;
  const statusText = { vacio: 'mesa vacía', 'sin-pila': 'sin pila', abierto: 'circuito abierto', cerrado: 'circuito cerrado', corto: 'cortocircuito' }[res.status];

  const record = () => {
    if (!res.meter || reading === null) return;
    const tests = board.parts.filter((p) => TEST_KINDS.includes(p.kind)).map((p) => SHORT_NAME[p.kind]);
    api.addTrial('montajes', {
      conexion: arrangement,
      pilas: board.parts.filter((p) => p.kind === 'pila').length,
      bombillos: lamps.length,
      material: tests.length ? tests.join(', ') : '—',
      medido: measuredWhat,
      voltaje: res.meter.mode === 'V' ? reading : null,
      corriente: res.meter.mode === 'A' ? reading : null,
      brillo: avgBright === null ? null : Number((avgBright * 100).toFixed(1)),
      estado: statusText,
    });
    remeasure('V', 'A');
  };

  /* --------------------------------------------- modo avanzado: ecuaciones con valores */
  usePublishModel(() => {
    const firstCell = board.parts.find((p) => p.kind === 'pila');
    const firstLamp = board.parts.filter((p) => p.kind === 'bombillo').sort((a, b) => a.id.localeCompare(b.id))[0];
    const c = firstCell ? res.parts[firstCell.id] : undefined;
    const l = firstLamp ? res.parts[firstLamp.id] : undefined;
    const lampOn = !!l && Math.abs(l.current) > 1e-6;
    return {
      vars: {
        e: { sym: '\\varepsilon', name: 'fem de cada pila', value: SC.cell.emf, unit: 'V', decimals: 2 },
        r: { sym: 'r', name: 'Resistencia interna de cada pila', value: SC.cell.r, unit: 'Ω', decimals: 2 },
        Ip: { sym: 'I_{P}', name: `Corriente de la pila ${firstCell?.id ?? ''}`, value: c ? c.current : null, unit: 'A', decimals: 3 },
        Vb: { sym: 'V_{b}', name: 'Voltaje en los bornes de la pila', value: c?.terminalVoltage ?? null, unit: 'V', decimals: 3 },
        VL: { sym: 'V_{B}', name: `Voltaje en el bombillo ${firstLamp?.id ?? ''}`, value: l ? Math.abs(l.voltage) : null, unit: 'V', decimals: 3 },
        IL: { sym: 'I_{B}', name: 'Corriente en el bombillo', value: l ? Math.abs(l.current) : null, unit: 'A', decimals: 3 },
        PL: { sym: 'P_{B}', name: 'Potencia del bombillo', value: l ? l.power : null, unit: 'W', decimals: 3 },
        RL: { sym: 'R_{B}', name: 'Resistencia del filamento', value: l?.resistance ?? null, unit: 'Ω', decimals: 2 },
        TL: { sym: 'T', name: 'Temperatura del filamento', value: l?.temperature ?? null, unit: 'K', decimals: 0 },
        Pn: { sym: 'P_{n}', name: 'Potencia nominal', value: SC.lamp.vRated * SC.lamp.iRated, unit: 'W', decimals: 2 },
        Tn: { sym: 'T_{n}', name: 'Temperatura nominal', value: SC.lamp.tRated, unit: 'K', decimals: 0 },
      },
      equations: [
        ...(c ? [{ title: `Pila ${firstCell?.id}: voltaje en los bornes`, lhs: 'Vb', expr: '[e] − [Ip]·[r]' }] : []),
        ...(lampOn ? [
          { title: `Potencia del bombillo ${firstLamp?.id}`, lhs: 'PL', expr: '[VL]·[IL]' },
          { title: 'Resistencia del filamento (ley de Ohm)', lhs: 'RL', expr: '\\frac{[VL]}{[IL]}', note: 'No es constante: crece con la temperatura del filamento.' },
          { title: 'Temperatura del filamento (balance radiativo)', lhs: 'TL', expr: '[Tn]·\\sqrt{\\sqrt{\\frac{[PL]}{[Pn]}}}' },
        ] : []),
      ],
      note: res.status === 'abierto' ? 'El circuito está abierto: no circula corriente.' : res.status === 'corto' ? 'Cortocircuito: la corriente solo la limita la resistencia interna de la pila.' : !firstLamp ? 'Coloca un bombillo para ver sus ecuaciones.' : undefined,
    };
  }, [res, board.parts]);

  /* --------------------------------------------- puntero */
  const svgPt = (e: PointerEvent<SVGElement>) => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement ?? (e.currentTarget as unknown as SVGSVGElement);
    return toSvgPoint(svg, e.clientX, e.clientY);
  };
  const onPointerDown = (e: PointerEvent<SVGGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = svgPt(e);
    let d: Drag | null = null;
    if (p.x < TRAY_W) {
      const i = TRAY.findIndex((_, k) => { const t = tileXY(k); return p.x >= t.x && p.x <= t.x + TILE_W && p.y >= t.y && p.y <= t.y + TILE_H; });
      if (i >= 0) {
        const k = TRAY[i];
        setPalette(k);
        if (k === 'cable') { say('Cable: arrastra desde un borne hasta otro borne de la mesa.'); return; }
        d = { type: 'new', kind: k, point: p, moved: false };
      }
    } else {
      const g = nearestPoint(p, 12);
      const part = g ? null : partAt(board.parts, p);
      if (g) d = { type: 'wire', from: g, point: p, start: p, moved: false };
      else if (part) d = { type: 'move', id: part.id, point: p, start: p, moved: false };
      else {
        const w = wireAt(board.wires, p);
        if (w) d = { type: 'wireSel', id: w.id, point: p, start: p, moved: false };
        else if (p.x >= METER.x && p.y >= METER.y && meterPart) { setMeterMode(meterPart.mode === 'A' ? 'V' : 'A'); return; }
        else setSelected('');
      }
    }
    if (!d) return;
    e.preventDefault();
    (e.currentTarget as SVGGElement).focus({ preventScroll: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(d);
  };
  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    if (!drag) return;
    const p = svgPt(e);
    const start = drag.type === 'new' ? p : drag.start;
    setDrag({ ...drag, point: p, moved: drag.moved || Math.hypot(p.x - start.x, p.y - start.y) > 5 || drag.type === 'new' });
  };
  const onPointerUp = (e: PointerEvent<SVGGElement>) => {
    const d = drag;
    setDrag(null);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;
    const p = svgPt(e);
    if (d.type === 'new') {
      const s = nearestSlot(p);
      if (s && place(d.kind, s)) say(`${SHORT_NAME[d.kind]} colocado entre ${slotEnds(s).map((g) => pointName(g.r, g.c)).join(' y ')}.`);
    } else if (d.type === 'move') {
      const part = board.parts.find((q) => q.id === d.id);
      if (!part) return;
      if (!d.moved) {
        setSelected(part.id);
        if (part.kind === 'interruptor') toggleSwitch(part.id);
        return;
      }
      if (p.x < TRAY_W) { removeItem(part.id); say(`${part.id} devuelto a la caja.`); return; }
      const s = nearestSlot(p);
      if (s && movePart(part.id, s)) say(`${part.id} movido.`);
    } else if (d.type === 'wire') {
      const g = nearestPoint(p, 18);
      if (g && addWire(d.from, g)) say(`Cable de ${pointName(d.from.r, d.from.c)} a ${pointName(g.r, g.c)}.`);
      else if (!d.moved) { setFocus(d.from); }
    } else if (d.type === 'wireSel') {
      if (!d.moved) setSelected(d.id);
      else if (p.x < TRAY_W) removeItem(d.id);
    }
  };

  /* --------------------------------------------- teclado */
  const describePoint = (g: GridPt) => {
    const here = [...board.parts.filter((q) => touches(q, g)).map((q) => `${q.id} (${SHORT_NAME[q.kind]})`), ...board.wires.filter((w) => wireTouches(w, g)).map((w) => `cable ${w.id}`)];
    return `Borne ${pointName(g.r, g.c)}${here.length ? ': ' + here.join(', ') : ', libre'}.`;
  };
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    const mv: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (mv[e.key]) {
      e.preventDefault();
      const n = { r: Math.max(0, Math.min(ROWS - 1, focus.r + mv[e.key][0])), c: Math.max(0, Math.min(COLS - 1, focus.c + mv[e.key][1])) };
      setFocus(n); say(describePoint(n));
      return;
    }
    const here = [...board.parts].reverse().find((q) => touches(q, focus));
    if (e.key === 'Enter') {
      e.preventDefault();
      if (palette === 'cable') {
        if (!wireStart) { setWireStart(focus); say(`Inicio del cable en ${pointName(focus.r, focus.c)}. Ve a otro borne y pulsa Enter.`); }
        else { const ok = addWire(wireStart, focus); say(ok ? `Cable de ${pointName(wireStart.r, wireStart.c)} a ${pointName(focus.r, focus.c)}.` : 'No se puede poner ese cable.'); setWireStart(null); }
        return;
      }
      const s = { r: focus.r, c: focus.c, dir: orient };
      if (!slotValid(s.r, s.c, s.dir)) { say('No cabe: no hay un borne vecino en esa dirección.'); return; }
      const owner = slotOwner(board, s);
      if (owner) { say(`Esa ranura ya tiene ${owner.id}.`); return; }
      place(palette, s);
      say(`${SHORT_NAME[palette]} colocado entre ${slotEnds(s).map((g) => pointName(g.r, g.c)).join(' y ')}.`);
    } else if (e.key === ' ') {
      e.preventDefault();
      const sw = [...board.parts].reverse().find((q) => q.kind === 'interruptor' && touches(q, focus));
      if (sw) { toggleSwitch(sw.id); say(`${sw.id} ${sw.closed ? 'abierto' : 'cerrado'}.`); } else say('No hay un interruptor en este borne.');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const w = [...board.wires].reverse().find((x) => wireTouches(x, focus));
      const target = here ?? w;
      if (target) { removeItem(target.id); say(`${target.id} quitado.`); } else say('No hay nada que quitar en este borne.');
    } else if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      if (here) { flipPart(here.id); say(`${here.id} girado: sus terminales se intercambiaron.`); }
    } else if (e.key === 'Escape') {
      setWireStart(null); setSelected('');
    }
  };

  /* --------------------------------------------- vista */
  const ghost = drag && (drag.type === 'new' || (drag.type === 'move' && drag.moved)) ? (() => {
    const kind = drag.type === 'new' ? drag.kind : board.parts.find((q) => q.id === drag.id)?.kind;
    if (!kind) return null;
    const s = drag.point.x >= TRAY_W ? nearestSlot(drag.point) : null;
    const ok = s && !slotOwner(board, s, drag.type === 'move' ? drag.id : undefined);
    return { kind, s: ok ? s : null, point: drag.point };
  })() : null;
  const hotWires = new Set(res.short ? board.wires.filter((w) => Math.abs(res.parts[w.id]?.current ?? 0) > SC.shortCurrent).map((w) => w.id) : []);
  const switches = board.parts.filter((p) => p.kind === 'interruptor').sort((a, b) => a.id.localeCompare(b.id));
  const allItems = [...board.parts.map((p) => ({ id: p.id, label: `${p.id}: ${SHORT_NAME[p.kind]}` })), ...board.wires.map((w) => ({ id: w.id, label: `${w.id}: cable ${pointName(w.from.r, w.from.c)}–${pointName(w.to.r, w.to.c)}` }))];
  const sel = board.parts.find((p) => p.id === selected) ?? null;
  const selItem = allItems.find((i) => i.id === selected) ?? null;
  const testPiece = board.parts.find((p) => TEST_KINDS.includes(p.kind)) ?? null;
  const descText = `${board.preset}. ${statusText}. Piezas: ${board.parts.map((p) => `${p.id} ${SHORT_NAME[p.kind]} (${describePart(p, res.parts[p.id])})`).join('; ') || 'ninguna'}. Cables: ${board.wires.length}. Multímetro: ${readingText}.`;

  const scene = (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="csi-t csi-d">
      <title id="csi-t">Mesa de montaje de circuitos simples</title>
      <desc id="csi-d">{descText}</desc>
      <Defs />
      {/* caja de piezas */}
      <rect x={6} y={10} width={TRAY_W - 12} height={H - 20} rx={12} fill="var(--surface-2)" stroke="var(--line)" />
      <text x={TRAY_W / 2} y={30} textAnchor="middle" className="scene-label" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>Caja de piezas</text>
      {TRAY.map((k, i) => {
        const t = tileXY(i);
        const active = palette === k;
        return (
          <g key={k}>
            <rect x={t.x} y={t.y} width={TILE_W} height={TILE_H} rx={8} fill="var(--surface)" stroke={active ? 'var(--fis)' : 'var(--line)'} strokeWidth={active ? 2 : 1} />
            {k === 'cable'
              ? <path d={`M${t.x + 14} ${t.y + 26} Q${t.x + 44} ${t.y + 44} ${t.x + 74} ${t.y + 22}`} fill="none" stroke="#c62828" strokeWidth="4" strokeLinecap="round" />
              : k === 'multimetro'
                ? <g transform={`translate(${t.x + 44} ${t.y + 24})`}><rect x={-16} y={-16} width={32} height={30} rx={5} fill="url(#csi-case)" /><rect x={-12} y={-12} width={24} height={9} rx={2} fill="url(#kit-lcd)" /><circle cx={0} cy={6} r={5} fill="url(#kit-body-dark)" /></g>
                : <g transform={`translate(${t.x + 44} ${t.y + (k === 'motor' ? 36 : k === 'bombillo' || k === 'led' || k === 'zumbador' ? 32 : 24)}) scale(0.62)`}><PartArt p={{ id: k, kind: k, r: 0, c: 0, dir: 'h', flip: false, closed: false }} /></g>}
            <text x={t.x + TILE_W / 2} y={t.y + TILE_H - 5} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 600 }}>{SHORT_NAME[k]}</text>
          </g>
        );
      })}
      {/* mesa de bornes */}
      <BenchTop x={TRAY_W + 2} y={H - 22} width={W - TRAY_W - 4} />
      <rect x={X0 - 34} y={Y0 - 50} width={STEP * (COLS - 1) + 68} height={STEP * (ROWS - 1) + 86} rx={14} fill="url(#csi-board)" stroke="#bdb4a0" filter="url(#kit-shadow-soft)" />
      {COL_NAMES.split('').map((n, c) => <text key={n} x={px(c)} y={Y0 - 34} textAnchor="middle" style={{ fontSize: 10, fill: '#6b6250', fontWeight: 700 }}>{n}</text>)}
      {Array.from({ length: ROWS }, (_, r) => <text key={r} x={X0 - 22} y={py(r) + 4} textAnchor="middle" style={{ fontSize: 10, fill: '#6b6250', fontWeight: 700 }}>{r + 1}</text>)}
      {Array.from({ length: ROWS * COLS }, (_, k) => {
        const r = Math.floor(k / COLS), c = k % COLS;
        return (
          <g key={k}>
            <circle cx={px(c)} cy={py(r) + 1.5} r={6.5} fill="#000" opacity="0.12" />
            <circle cx={px(c)} cy={py(r)} r={6} fill="#d4a548" stroke="#8a6a24" strokeWidth="0.8" />
            <circle cx={px(c)} cy={py(r)} r={2.2} fill="#6b5016" />
          </g>
        );
      })}
      {board.wires.map((w) => <WireArt key={w.id} w={w} hot={hotWires.has(w.id)} />)}
      {meterPart && <MeterLeads p={meterPart} />}
      {board.parts.filter((p) => p.kind !== 'multimetro').map((p) => {
        const f = frame(p);
        return (
          <g key={p.id}>
            <g transform={f.m}>
              <PartArt p={p} res={res.parts[p.id]} rotorRef={p.kind === 'motor' ? (el) => { if (el) rotors.current.set(p.id, el); else rotors.current.delete(p.id); } : undefined} />
            </g>
            <text x={p.dir === 'h' ? f.cx : f.cx - 12} y={p.dir === 'h' ? f.cy + 22 : f.cy + 4} textAnchor={p.dir === 'h' ? 'middle' : 'end'} className="scene-label" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)' }}>{p.id}</text>
          </g>
        );
      })}
      {meterPart && <MeterProbes p={meterPart} />}
      <MeterBody text={lcdText} unit={meterPart ? (meterPart.mode === 'A' ? 'A' : 'V') : ''} mode={meterPart?.mode ?? null} />
      {!meterPart && <text x={METER.x + METER.w / 2} y={METER.y - 6} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>Coloca el multímetro en la mesa</text>}
      {/* estado */}
      <g transform={`translate(${TRAY_W + 14} ${H - 76})`}>
        <rect width={180} height={40} rx={8} fill="var(--surface)" stroke={res.short ? 'var(--bad)' : res.status === 'cerrado' ? 'var(--ok)' : 'var(--line)'} strokeWidth="1.5" />
        <circle cx={18} cy={20} r={7} fill={res.short ? 'var(--bad)' : res.status === 'cerrado' ? 'var(--ok)' : 'var(--ink-2)'} />
        <text x={32} y={25} style={{ fontSize: 13, fontWeight: 700, fill: 'var(--ink)' }}>{statusText[0].toUpperCase() + statusText.slice(1)}</text>
      </g>
    </svg>
  );

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Mesa de montaje (desplazable)">
          <ManipScene viewBox={`0 0 ${W} ${H}`} label="Mesa de montaje interactiva" scene={scene}>
            <g className="manip" tabIndex={0} role="application" aria-roledescription="mesa de montaje"
              aria-label={`Mesa de montaje. ${describePoint(focus)} Flechas: moverse entre bornes. Enter: colocar «${SHORT_NAME[palette]}»${palette === 'cable' ? ' (dos bornes seguidos)' : ''}. Espacio: accionar interruptor. Suprimir: quitar. G: girar.`}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}
              onKeyDown={onKeyDown} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
              <rect x={0} y={0} width={W} height={H} className="manip-hit" />
              {/* selección */}
              {sel && (() => { const f = frame(sel); return <rect x={sel.dir === 'h' ? f.cx - 34 : f.cx - 14} y={sel.dir === 'h' ? f.cy - 52 : f.cy - 34} width={sel.dir === 'h' ? 68 : 66} height={sel.dir === 'h' ? 66 : 68} rx={8} fill="none" stroke="var(--fis)" strokeWidth="2" strokeDasharray="5 4" pointerEvents="none" />; })()}
              {selItem && !sel && (() => { const w = board.wires.find((x) => x.id === selected); if (!w) return null; const { d } = wirePath(w); return <path d={d} fill="none" stroke="var(--fis)" strokeWidth="9" opacity="0.35" pointerEvents="none" />; })()}
              {/* foco del teclado */}
              {focused && <circle cx={px(focus.c)} cy={py(focus.r)} r={12} fill="none" stroke="var(--fis)" strokeWidth="3" pointerEvents="none" />}
              {focused && palette !== 'cable' && slotValid(focus.r, focus.c, orient) && (
                <line x1={px(focus.c)} y1={py(focus.r)} x2={orient === 'h' ? px(focus.c + 1) : px(focus.c)} y2={orient === 'h' ? py(focus.r) : py(focus.r + 1)} stroke="var(--fis)" strokeWidth="4" strokeDasharray="4 4" opacity="0.6" pointerEvents="none" />
              )}
              {wireStart && <circle cx={px(wireStart.c)} cy={py(wireStart.r)} r={10} fill="var(--fis)" opacity="0.4" pointerEvents="none" />}
              {/* arrastre */}
              {drag?.type === 'wire' && drag.moved && (
                <line x1={px(drag.from.c)} y1={py(drag.from.r)} x2={drag.point.x} y2={drag.point.y} stroke="#c62828" strokeWidth="5" strokeLinecap="round" opacity="0.75" pointerEvents="none" />
              )}
              {ghost && (ghost.s ? (
                <g opacity="0.75" pointerEvents="none">
                  <rect x={ghost.s.dir === 'h' ? px(ghost.s.c) : px(ghost.s.c) - 8} y={ghost.s.dir === 'h' ? py(ghost.s.r) - 8 : py(ghost.s.r)} width={ghost.s.dir === 'h' ? STEP : 16} height={ghost.s.dir === 'h' ? 16 : STEP} rx={8} fill="var(--fis)" opacity="0.25" />
                  {ghost.kind !== 'multimetro' && <g transform={frame({ id: 'g', kind: ghost.kind, ...ghost.s, flip: false }).m}><PartArt p={{ id: 'g', kind: ghost.kind, ...ghost.s, flip: false, closed: false }} /></g>}
                </g>
              ) : (
                <g opacity="0.6" pointerEvents="none" transform={`translate(${ghost.point.x} ${ghost.point.y})`}>
                  {ghost.kind !== 'multimetro' ? <PartArt p={{ id: 'g', kind: ghost.kind, r: 0, c: 0, dir: 'h', flip: false, closed: false }} /> : <rect x={-14} y={-12} width={28} height={24} rx={5} fill="url(#csi-case)" />}
                </g>
              ))}
            </g>
          </ManipScene>
        </div>
        <ManipHint>Arrastra piezas de la caja a la mesa (se acomodan entre dos bornes); arrastra de un borne a otro para tender un cable; toca un interruptor para accionarlo; arrastra una pieza a la caja para quitarla. Con teclado: enfoca la mesa, muévete con las flechas, Enter coloca la pieza elegida, Espacio acciona un interruptor, Suprimir quita y G gira.</ManipHint>
        <p className="sr-only" aria-live="polite">{announce}</p>
        <Readout items={[
          { k: 'Estado del circuito', v: statusText },
          { k: 'Lectura del multímetro', v: readingText, data: true },
          { k: 'Bombillos encendidos', v: `${res.lampsOn} de ${lamps.length}` },
          { k: 'Conexión de los bombillos', v: arrangement },
        ]} />
        <Warnings list={res.warnings} />
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de piezas en la mesa">
          <table>
            <caption>Piezas en la mesa ({board.preset})</caption>
            <thead><tr><th>Pieza</th><th>Tipo</th><th>Bornes</th><th>Qué se observa</th></tr></thead>
            <tbody>
              {board.parts.length === 0 ? <tr><td colSpan={4}>La mesa está vacía.</td></tr> : [...board.parts].sort((a, b) => a.id.localeCompare(b.id)).map((p) => {
                const [a, b] = terminals(p);
                return <tr key={p.id}><td>{p.id}</td><td>{PART_INFO[p.kind].name}</td><td>{pointName(a.r, a.c)}–{pointName(b.r, b.c)}</td><td>{describePart(p, res.parts[p.id])}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="controls">
        <div className="card stack-sm">
          <h3>Circuitos de ejemplo</h3>
          <div className="btn-row">
            {PRESETS.map((pr, i) => <button key={pr.key} type="button" className="btn small" onClick={() => loadPreset(i)}>Cargar circuito: {pr.label}</button>)}
            <button type="button" className="btn small ghost" onClick={() => { setBoard({ parts: [], wires: [], preset: 'Montaje libre' }); setSelected(''); say('Mesa vacía.'); }}>Vaciar la mesa</button>
          </div>
        </div>
        <div className="card stack-sm">
          <h3>Construir</h3>
          <Select label="Pieza para colocar" value={palette} onChange={(v) => { setPalette(v as PieceKind | 'cable'); setWireStart(null); }}
            options={TRAY.map((k) => ({ value: k, label: k === 'cable' ? 'Cable (de un borne a otro)' : PART_INFO[k].name }))} />
          <Segmented label="Orientación de la pieza" value={orient} onChange={setOrient} options={[{ value: 'h', label: 'Horizontal' }, { value: 'v', label: 'Vertical' }]} />
          <p className="small muted">Con el teclado, la pieza se coloca desde el borne enfocado hacia la derecha (horizontal) o hacia abajo (vertical).</p>
        </div>
        {switches.length > 0 && (
          <div className="card stack-sm">
            <h3>Interruptores</h3>
            <div className="btn-row">
              {switches.map((s) => <button key={s.id} type="button" className="btn small" aria-pressed={!!s.closed} onClick={() => toggleSwitch(s.id)}>Interruptor {s.id}: {s.closed ? 'cerrado' : 'abierto'}</button>)}
            </div>
          </div>
        )}
        <div className="card stack-sm">
          <h3>Pieza seleccionada</h3>
          <Select label="Elegir pieza o cable" value={selected} onChange={setSelected} options={[{ value: '', label: '— ninguna —' }, ...allItems.map((i) => ({ value: i.id, label: i.label }))]} />
          {selItem && (
            <div className="btn-row">
              {sel && sel.kind !== 'interruptor' && <button type="button" className="btn small" onClick={() => flipPart(sel.id)}>Girar {sel.id} (invertir polaridad)</button>}
              {sel?.kind === 'interruptor' && <button type="button" className="btn small" onClick={() => toggleSwitch(sel.id)}>{sel.closed ? 'Abrir' : 'Cerrar'} {sel.id}</button>}
              <button type="button" className="btn small ghost danger" onClick={() => removeItem(selItem.id)}>Quitar {selItem.id}</button>
            </div>
          )}
          {testPiece && (
            <Select label={`Material de prueba (${testPiece.id})`} value={testPiece.kind} onChange={(v) => setMaterial(testPiece.id, v as PieceKind)}
              options={TEST_KINDS.map((k) => ({ value: k, label: PART_INFO[k].name }))} />
          )}
        </div>
        <div className="card stack-sm">
          <h3>Multímetro</h3>
          <Segmented label="Función del multímetro" value={meterPart?.mode ?? 'V'} onChange={(m) => (meterPart ? setMeterMode(m) : say('Primero coloca el multímetro en la mesa.'))}
            options={[{ value: 'V', label: 'Voltímetro (en paralelo)' }, { value: 'A', label: 'Amperímetro (en serie)' }]} />
          <Readout items={[{ k: meterPart?.mode === 'A' ? 'Amperímetro' : 'Voltímetro', v: readingText, data: true }, { k: 'Qué mide', v: measuredWhat }]} />
          <RecordButton onRecord={record} disabled={!meterOk} />
          {!meterOk && <p className="small muted">Coloca el multímetro con sus dos puntas tocando el circuito para poder guardar una medición.</p>}
        </div>
        <Notice>Pilas AA de 1,5 V con resistencia interna de 0,2 Ω; bombillo de linterna de 2,5 V y 0,3 A cuyo filamento cambia de resistencia con la temperatura; multímetro {real ? 'real (ficha de incertidumbre)' : 'ideal'} con 10 MΩ como voltímetro y 0,1 Ω como amperímetro.</Notice>
      </div>
    </div>
  );
}


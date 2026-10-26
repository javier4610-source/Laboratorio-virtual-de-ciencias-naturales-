import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react';
import {
  MARK_SPACING, MIN_GAP, MOTION_INSTRUMENTS, MOTION_LIMITS, MOVERS, REACTION, TIMER_RES, TRACK_LENGTH,
  findMover, handTiming, isUniform, pathLengthAt, positionAt, race, simulateMotion, toKmh, tripPosition,
  type Mover, type MoverId, type Trip,
} from '../models/motion';
import { roundToResolution } from '../models/math';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { Chart, type Series } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import { SimControls, simStatusOf } from '../components/Experiment';
import { useMeasure } from '../components/Measurement';
import { useModelParams, usePublishModel } from '../components/Advanced';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { Stopwatch } from './kit';
import { ManipHint, ManipScene, Plunger } from './manipulate';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 960, H = 400;
const VIEW = `0 0 ${W} ${H}`;
const X0 = 60; // x de la marca de 0 m
const PXM = 21; // px por metro
const toPx = (m: number) => X0 + m * PXM;
const COURT_TOP = 118, COURT_BOTTOM = 292;
const LANE_TOP = 136, LANE_MID = 212, LANE_BOTTOM = 274;
const GROUND = [198, 262]; // línea de apoyo de los móviles en cada carril
const TAPE_Y = 330;
const FLAG_Y = 116;
const CONE_Y = 286;
const WATCH = { x: 846, y: 12 };

/** Segundos de aproximación antes de cruzar la salida (salida lanzada) y de recorrido después de la meta. */
const LEAD = 1;
const TAIL = 0.6;
const LEAD_MAX_M = 2.5;
const HAND_CAP = 99.99;

type Activity = 'ida' | 'idavuelta' | 'carrera';
type Timing = 'fotopuerta' | 'manual' | 'companero';
type Phase = 'listo' | 'corriendo' | 'pausa' | 'medido';
type AnimSpeed = 'real' | 'x4';
type Prediction = '' | '1' | '2' | 'empate';

const TIMING_LABEL: Record<Timing, string> = { fotopuerta: 'Fotopuertas', manual: 'Tu cronómetro', companero: 'Compañero' };
const MOVER_COLORS: Record<MoverId, { shirt: string; pants: string }> = {
  caminante: { shirt: '#f3f5f6', pants: '#2b3f66' },
  corredor: { shirt: '#f2b134', pants: '#22324f' },
  bicicleta: { shirt: '#3d8bd4', pants: '#263238' },
  balon: { shirt: '#ffffff', pants: '#1d2426' },
  carrito: { shirt: '#d84315', pants: '#263238' },
};

/** Posición dibujada (m desde la salida) en el instante t, incluida la aproximación antes de la salida. */
function drawPos(m: Mover, d: number, trip: Trip, t: number): number {
  if (t < 0) return Math.max(-LEAD_MAX_M, m.v0 * t);
  return tripPosition(m, d, trip, t);
}
function drawPath(m: Mover, d: number, trip: Trip, t: number): number {
  if (t < 0) return Math.max(-LEAD_MAX_M, m.v0 * t) + LEAD_MAX_M;
  return LEAD_MAX_M + pathLengthAt(m, d, trip, t);
}

/* ------------------------------------------------------------------ móviles (dibujos propios) */

/** Estudiante con uniforme: piernas y brazos oscilan según la distancia recorrida. */
function Person({ x, y, path, stride, run, dir, shirt, pants }: { x: number; y: number; path: number; stride: number; run: boolean; dir: 1 | -1; shirt: string; pants: string }) {
  const ph = (path / (2 * stride)) * 2 * Math.PI;
  const amp = run ? 0.72 : 0.38;
  const lean = run ? 0.22 : 0.04;
  const hip = { x: 0, y: -31 };
  const leg = (k: 0 | 1) => {
    const s = Math.sin(ph + k * Math.PI);
    const a = amp * s;
    const bend = run ? 0.25 + 1.1 * Math.max(0, Math.sin(ph + k * Math.PI - Math.PI / 2)) : 0.08 + 0.4 * Math.max(0, Math.sin(ph + k * Math.PI - Math.PI / 2));
    const knee = { x: hip.x + 14 * Math.sin(a), y: hip.y + 14 * Math.cos(a) };
    const b = a - bend;
    const ankle = { x: knee.x + 15 * Math.sin(b), y: knee.y + 15 * Math.cos(b) };
    return `M${hip.x} ${hip.y} L${knee.x.toFixed(2)} ${knee.y.toFixed(2)} L${ankle.x.toFixed(2)} ${ankle.y.toFixed(2)} l4.5 0.6`;
  };
  const sh = { x: hip.x + 22 * Math.sin(lean), y: hip.y - 22 * Math.cos(lean) };
  const arm = (k: 0 | 1) => {
    const a = -amp * 0.85 * Math.sin(ph + k * Math.PI) + lean;
    const el = { x: sh.x + 10 * Math.sin(a), y: sh.y + 10 * Math.cos(a) };
    const fb = a + (run ? 1.4 : 0.35);
    const hand = { x: el.x + 9 * Math.sin(fb), y: el.y + 9 * Math.cos(fb) };
    return `M${sh.x.toFixed(2)} ${sh.y.toFixed(2)} L${el.x.toFixed(2)} ${el.y.toFixed(2)} L${hand.x.toFixed(2)} ${hand.y.toFixed(2)}`;
  };
  const head = { x: sh.x + 4 * Math.sin(lean) + 1, y: sh.y - 9 };
  return (
    <g transform={`translate(${x.toFixed(2)} ${y}) scale(${dir} 1)`}>
      <ellipse cx="0" cy="1" rx="13" ry="2.6" fill="#000" opacity="0.22" />
      <path d={leg(1)} fill="none" stroke={pants} strokeOpacity="0.7" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={arm(1)} fill="none" stroke="#a96f3d" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      <path d={leg(0)} fill="none" stroke={pants} strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${hip.x - 4} ${hip.y + 2} L${sh.x - 4} ${sh.y + 1} Q${sh.x} ${sh.y - 3} ${sh.x + 4} ${sh.y + 1} L${hip.x + 5} ${hip.y + 2} Z`} fill={shirt} stroke="#33464d" strokeWidth="0.8" />
      <path d={arm(0)} fill="none" stroke="#b97a45" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={head.x} cy={head.y} r="6.2" fill="#b97a45" />
      <path d={`M${head.x - 6.4} ${head.y - 0.5} A6.4 6.4 0 0 1 ${head.x + 6.2} ${head.y - 2.2} L${head.x + 2} ${head.y - 3.4} Z`} fill="#1d1612" />
    </g>
  );
}

/** Bicicleta con ciclista; las ruedas giran según la distancia recorrida. */
function Bike({ x, y, path, dir, shirt }: { x: number; y: number; path: number; dir: 1 | -1; shirt: string }) {
  const R = 12;
  const turn = (path / 2.07) * 360;
  const crank = (path / 2.07) * 0.5 * 2 * Math.PI;
  const bb = { x: -1, y: -12 };
  const pedal = (k: 0 | 1) => ({ x: bb.x + 6 * Math.cos(crank + k * Math.PI), y: bb.y + 6 * Math.sin(crank + k * Math.PI) });
  const hip = { x: -6, y: -38 };
  const legPath = (k: 0 | 1) => {
    const p = pedal(k);
    const dx = p.x - hip.x, dy = p.y - hip.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.sqrt(Math.max(0, 15 * 15 - (len / 2) ** 2));
    const kx = (hip.x + p.x) / 2 + (dy / len) * bend, ky = (hip.y + p.y) / 2 - (dx / len) * bend;
    return `M${hip.x} ${hip.y} L${kx.toFixed(2)} ${ky.toFixed(2)} L${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  };
  const wheel = (cx: number) => (
    <g transform={`translate(${cx} ${-R})`}>
      <circle r={R} fill="none" stroke="#1d2426" strokeWidth="3" />
      <circle r={R - 2.6} fill="none" stroke="url(#kit-metal)" strokeWidth="1.2" />
      <g transform={`rotate(${turn.toFixed(1)})`} stroke="#9aa5a9" strokeWidth="0.6">
        {[0, 45, 90, 135].map((a) => <line key={a} x1={-9 * Math.cos((a * Math.PI) / 180)} y1={-9 * Math.sin((a * Math.PI) / 180)} x2={9 * Math.cos((a * Math.PI) / 180)} y2={9 * Math.sin((a * Math.PI) / 180)} />)}
      </g>
      <circle r="1.8" fill="#5d6b70" />
    </g>
  );
  return (
    <g transform={`translate(${x.toFixed(2)} ${y}) scale(${dir} 1)`}>
      <ellipse cx="0" cy="1" rx="30" ry="2.6" fill="#000" opacity="0.22" />
      <path d={legPath(1)} fill="none" stroke="#263238" strokeOpacity="0.7" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
      {wheel(-18)}
      {wheel(18)}
      <path d={`M-18 -12 L${bb.x} ${bb.y} L-7 -32 Z M${bb.x} ${bb.y} L13 -30 L-7 -32 M13 -30 L18 -12`} fill="none" stroke="#1565c0" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M13 -30 L14 -36 L9 -38" fill="none" stroke="#263033" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="-12" y="-36" width="9" height="3" rx="1.5" fill="#263033" />
      <path d={`M${hip.x - 3} ${hip.y + 1} L2 -58 L8 -56 L${hip.x + 4} ${hip.y + 2} Z`} fill={shirt} stroke="#1f3a52" strokeWidth="0.8" />
      <path d="M5 -55 L11 -45 L10 -38" fill="none" stroke="#b97a45" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={legPath(0)} fill="none" stroke="#263238" strokeWidth="4.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="-64" r="5.6" fill="#b97a45" />
      <path d="M1 -65 A6.6 6.6 0 0 1 13.6 -66.5 L13.8 -64 Z" fill="#d84315" />
      <circle cx={bb.x} cy={bb.y} r="2.6" fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.5" />
    </g>
  );
}

/** Balón de fútbol (dibujado más grande que a escala) que gira al rodar. */
function Ball({ x, y, path }: { x: number; y: number; path: number }) {
  const r = 9;
  const rot = ((path / 0.11) * 180) / Math.PI;
  const patch = (a: number) => {
    const cx = 5.2 * Math.cos(a), cy = 5.2 * Math.sin(a);
    return <circle key={a} cx={cx} cy={cy} r="2.2" fill="#1d2426" />;
  };
  return (
    <g transform={`translate(${x.toFixed(2)} ${y})`}>
      <ellipse cx="0" cy="1" rx="10" ry="2.2" fill="#000" opacity="0.25" />
      <g transform={`translate(0 ${-r}) rotate(${rot.toFixed(1)})`}>
        <circle r={r} fill="#fbfbf8" stroke="#3b4447" strokeWidth="0.9" />
        <path d="M0 -3 L2.9 -0.9 L1.8 2.4 L-1.8 2.4 L-2.9 -0.9 Z" fill="#1d2426" />
        {[0, 1, 2, 3, 4].map((k) => patch(-Math.PI / 2 + (k * 2 * Math.PI) / 5 + Math.PI / 5))}
      </g>
      <circle cx="-3" cy={-r - 3.5} r="2.6" fill="#fff" opacity="0.35" />
    </g>
  );
}

/** Carrito de juguete de pilas (dibujado más grande que a escala). */
function ToyCar({ x, y, path, dir }: { x: number; y: number; path: number; dir: 1 | -1 }) {
  const rot = ((path / 0.02) * 180) / Math.PI;
  const wheel = (cx: number) => (
    <g transform={`translate(${cx} -5) rotate(${rot.toFixed(1)})`}>
      <circle r="5" fill="#1d2426" />
      <circle r="2.2" fill="url(#kit-metal)" />
      <line x1="-2.2" x2="2.2" y1="0" y2="0" stroke="#5d6b70" strokeWidth="0.8" />
    </g>
  );
  return (
    <g transform={`translate(${x.toFixed(2)} ${y}) scale(${dir} 1)`}>
      <ellipse cx="0" cy="1" rx="17" ry="2.4" fill="#000" opacity="0.25" />
      <path d="M-17 -6 L-17 -13 Q-16 -15 -12 -15 L-7 -15 L-3 -21 L7 -21 L11 -15 L15 -14 Q17 -13 17 -10 L17 -6 Z" fill="#d32f2f" stroke="#7f1d1d" strokeWidth="0.8" />
      <path d="M-2 -19.5 L6.5 -19.5 L9 -15.5 L-4.5 -15.5 Z" fill="#bfe3f2" opacity="0.9" />
      <rect x="13.5" y="-12" width="3" height="2.2" rx="0.8" fill="#ffe082" />
      <path d="M-16 -12 L16 -12" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
      {wheel(-10)}
      {wheel(10)}
    </g>
  );
}

function MoverFigure({ mover, x, y, path, dir }: { mover: Mover; x: number; y: number; path: number; dir: 1 | -1 }) {
  const c = MOVER_COLORS[mover.id];
  if (mover.kind === 'persona') return <Person x={x} y={y} path={path} stride={mover.stride} run={mover.id === 'corredor'} dir={dir} shirt={c.shirt} pants={c.pants} />;
  if (mover.kind === 'bicicleta') return <Bike x={x} y={y} path={path} dir={dir} shirt={c.shirt} />;
  if (mover.kind === 'balon') return <Ball x={x} y={y} path={path} />;
  return <ToyCar x={x} y={y} path={path} dir={dir} />;
}

/* ------------------------------------------------------------------ escenario estático */

/** Plátano (Musa) del fondo: pseudotallo y hojas largas. */
function Banana({ x, s }: { x: number; s: number }) {
  return (
    <g transform={`translate(${x} 104) scale(${s})`} opacity="0.85">
      <path d="M-3 0 L-2 -38 L2 -38 L3 0 Z" fill="#6e8f3a" />
      <path d="M0 -36 Q-26 -52 -44 -40 Q-24 -42 0 -32 Z" fill="#4e8a3e" />
      <path d="M0 -38 Q22 -60 46 -50 Q24 -48 0 -34 Z" fill="#5c9a45" />
      <path d="M0 -38 Q-8 -66 -24 -76 Q-10 -60 -2 -36 Z" fill="#3f7a37" />
      <path d="M0 -38 Q10 -70 26 -78 Q12 -60 2 -36 Z" fill="#6aa84f" />
      <path d="M2 -30 Q8 -22 6 -14" stroke="#7a5230" strokeWidth="3" fill="none" />
      <ellipse cx="7" cy="-12" rx="4" ry="6" fill="#7a3b4f" />
    </g>
  );
}

const Court = memo(function Court() {
  const marks = Array.from({ length: TRACK_LENGTH / MARK_SPACING + 1 }, (_, i) => i * MARK_SPACING);
  return (
    <g aria-hidden="true">
      {/* Fondo: plataneras y muro del colegio */}
      {[110, 240, 400, 560, 700, 880].map((bx, i) => <Banana key={bx} x={bx} s={0.85 + (i % 3) * 0.12} />)}
      <rect x="0" y="76" width={W} height="42" fill="#d9cdb4" />
      <rect x="0" y="76" width={W} height="42" fill="url(#kit-bench-sheen)" opacity="0.4" />
      <rect x="0" y="74" width={W} height="5" fill="#b8a98a" />
      {Array.from({ length: 16 }, (_, k) => <line key={k} x1={k * 64} x2={k * 64} y1="79" y2="118" stroke="#b8a98a" strokeWidth="1.2" />)}
      <rect x="392" y="80" width="212" height="18" rx="3" fill="#1f5f8b" stroke="#164766" />
      <text x="498" y="92.5" textAnchor="middle" style={{ fontSize: 10, fill: '#ffffff', fontWeight: 700, letterSpacing: 1 }}>I.E. CAMPO ALEGRE · APARTADÓ</text>
      {/* Superficie de la cancha */}
      <rect x="0" y={COURT_TOP} width={W} height={COURT_BOTTOM - COURT_TOP} fill="#3f8a66" />
      <rect x="0" y={COURT_TOP} width={W} height={COURT_BOTTOM - COURT_TOP} fill="url(#kit-liquid-shade)" opacity="0.18" />
      <rect x="0" y={COURT_TOP} width={W} height="6" fill="#000" opacity="0.12" />
      <rect x="0" y={LANE_TOP} width={W} height={LANE_BOTTOM - LANE_TOP} fill="#b5523b" opacity="0.92" />
      {[LANE_TOP, LANE_MID, LANE_BOTTOM].map((y) => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="#fff" strokeWidth="2" opacity="0.9" />)}
      <rect x="0" y={COURT_BOTTOM} width={W} height="4" fill="#2f6b4e" />
      {/* Marcas pintadas cada 5 m */}
      {marks.map((m) => (
        <g key={m}>
          <line x1={toPx(m)} x2={toPx(m)} y1={LANE_TOP} y2={LANE_BOTTOM} stroke="#fff" strokeWidth={m % 10 === 0 ? 1.6 : 1.1} opacity="0.55" />
          <text x={toPx(m)} y={COURT_BOTTOM + 17} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{m} m</text>
        </g>
      ))}
      <text x="24" y={(LANE_TOP + LANE_MID) / 2} textAnchor="middle" style={{ fontSize: 10, fill: '#ffffff', fontWeight: 700 }} transform={`rotate(-90 24 ${(LANE_TOP + LANE_MID) / 2})`}>CARRIL 1</text>
      <text x="24" y={(LANE_MID + LANE_BOTTOM) / 2} textAnchor="middle" style={{ fontSize: 10, fill: '#ffffff', fontWeight: 700 }} transform={`rotate(-90 24 ${(LANE_MID + LANE_BOTTOM) / 2})`}>CARRIL 2</text>
    </g>
  );
});

/** Cono naranja de señalización. */
function Cone({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0.5" rx="12" ry="3" fill="#000" opacity="0.25" />
      <rect x="-11" y="-3" width="22" height="3.5" rx="1" fill="#e65100" />
      <path d="M-8 -3 L-2.2 -26 L2.2 -26 L8 -3 Z" fill="#fb8c00" />
      <path d="M-6.4 -9 L6.4 -9 L5.4 -13 L-5.4 -13 Z" fill="#fff" opacity="0.92" />
      <path d="M-4.4 -17 L4.4 -17 L3.6 -20 L-3.6 -20 Z" fill="#fff" opacity="0.92" />
      <path d="M-2.2 -26 L-6 -4 L-8 -3 Z" fill="#fff" opacity="0.2" />
    </g>
  );
}

/** Bandera de meta a cuadros sobre un asta metálica. */
function FinishFlag({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 1.6} y={FLAG_Y - 16} width="3.2" height={LANE_TOP - FLAG_Y + 18} fill="url(#kit-metal-h)" />
      <ellipse cx={x} cy={LANE_TOP + 2} rx="7" ry="2" fill="#000" opacity="0.25" />
      {Array.from({ length: 12 }, (_, k) => {
        const c = k % 4, r = Math.floor(k / 4);
        return <rect key={k} x={x + 1.6 + c * 6} y={FLAG_Y - 16 + r * 6 + c * 0.6} width="6" height="6" fill={(c + r) % 2 ? '#fff' : '#1d2426'} />;
      })}
    </g>
  );
}

/** Fotopuerta: dos postes con un haz infrarrojo que cruza los carriles. */
function Gate({ x, main, lit }: { x: number; main: boolean; lit: boolean }) {
  const w = main ? 6 : 4;
  return (
    <g opacity={main ? 1 : 0.8}>
      <line x1={x} x2={x} y1={LANE_TOP} y2={LANE_BOTTOM} stroke={lit ? '#ff5252' : '#ff8a80'} strokeWidth={lit ? 2.2 : 1} strokeDasharray={lit ? undefined : '3 4'} opacity={lit ? 0.95 : 0.7} />
      {[LANE_TOP - 18, LANE_BOTTOM - 4].map((y, i) => (
        <g key={i}>
          <rect x={x - w / 2} y={y} width={w} height="22" rx="1.5" fill="url(#kit-body-dark)" />
          <circle cx={x} cy={y + 6} r={main ? 2 : 1.4} fill={lit ? '#ff1744' : '#7f1d1d'} />
        </g>
      ))}
    </g>
  );
}

/** Cinta métrica con su carcasa en el cono de salida; la cinta se extiende `len` metros. */
function Tape({ start, len }: { start: number; len: number }) {
  const x0 = toPx(start), x1 = toPx(start + len);
  const meters = Math.floor(len + 1e-9);
  return (
    <g>
      <rect x={x0} y={TAPE_Y - 6} width={Math.max(0, x1 - x0)} height="13" fill="#f6c945" stroke="#b8901f" strokeWidth="0.8" />
      {Array.from({ length: meters + 1 }, (_, m) => (
        <line key={m} x1={toPx(start + m)} x2={toPx(start + m)} y1={TAPE_Y - 6} y2={TAPE_Y - 6 + (m % 5 === 0 ? 7 : 3.5)} stroke="#2b2304" strokeWidth={m % 5 === 0 ? 1.1 : 0.7} />
      ))}
      {Array.from({ length: Math.floor(meters / 5) + 1 }, (_, k) => k * 5).filter((m) => m > 0).map((m) => (
        <text key={m} x={toPx(start + m) + 2} y={TAPE_Y + 5.5} style={{ fontSize: 7.5, fill: '#2b2304', fontWeight: 700 }}>{m}</text>
      ))}
      {/* carcasa */}
      <g filter="url(#kit-shadow-soft)">
        <circle cx={x0 - 14} cy={TAPE_Y} r="15" fill="#f6c945" stroke="#9c7a12" strokeWidth="1.2" />
        <circle cx={x0 - 14} cy={TAPE_Y} r="10" fill="url(#kit-body-dark)" />
        <circle cx={x0 - 14} cy={TAPE_Y} r="3" fill="url(#kit-metal)" />
      </g>
      {/* gancho del extremo */}
      <rect x={x1 - 1} y={TAPE_Y - 9} width="4" height="19" rx="1" fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function MotionLab({ api }: LabProps) {
  const [activity, setActivity] = useState<Activity>('ida');
  const [timing, setTiming] = useState<Timing>('fotopuerta');
  const [moverId, setMoverId] = useState<MoverId>('corredor');
  const [raceA, setRaceA] = useState<MoverId>('balon');
  const [raceB, setRaceB] = useState<MoverId>('corredor');
  const [prediction, setPrediction] = useState<Prediction>('');
  const [start, setStartRaw] = useState(5);
  const [finish, setFinishRaw] = useState(25);
  const [tape, setTape] = useState(20);
  const [anim, setAnim] = useState<AnimSpeed>('real');
  const [phase, setPhase] = useState<Phase>('listo');
  const [now, setNow] = useState(0);
  const [runStart, setRunStart] = useState(0);
  const [swStart, setSwStart] = useState<number | null>(null);
  const [swStop, setSwStop] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [handLog, setHandLog] = useState<number[]>([]);
  const raf = useRef(0);
  const sw = useRef<{ start: number | null; stop: number | null }>({ start: null, stop: null });
  const fx = useRef({ whistle: false, gates: new Set<string>(), steps: [0, 0] });
  const timers = useRef<number[]>([]);

  const P = useModelParams();
  const reaction = P.reaccion ?? REACTION.startMean;
  const isRace = activity === 'carrera';
  const trip: Trip = activity === 'idavuelta' ? 'idavuelta' : 'ida';
  const effTiming: Timing = isRace ? 'fotopuerta' : timing;
  const manual = effTiming === 'manual';
  const factor = manual || anim === 'real' ? 1 : 4;
  const d = finish - start;

  const setStart = (v: number) => {
    const s = Math.min(v, finish - MIN_GAP);
    setStartRaw(s);
    setTape((t) => Math.min(t, TRACK_LENGTH - s));
  };
  const setFinish = (v: number) => setFinishRaw(Math.max(v, start + MIN_GAP));

  // En ida y vuelta solo se usan móviles de rapidez constante (el balón no regresa solo).
  const moverOptions = MOVERS.filter((m) => trip === 'ida' || isUniform(m));
  useEffect(() => { if (trip === 'idavuelta' && !isUniform(findMover(moverId))) setMoverId('corredor'); }, [trip, moverId]);
  const mover = findMover(trip === 'idavuelta' && !isUniform(findMover(moverId)) ? 'corredor' : moverId);
  const lanes = useMemo(() => (isRace ? [findMover(raceA), findMover(raceB)] : [mover]), [isRace, raceA, raceB, mover]);

  const res = useMemo(() => simulateMotion({ moverId: mover.id, start, finish, trip }), [mover, start, finish, trip]);
  const raceRes = useMemo(() => (isRace ? race(raceA, raceB, d) : null), [isRace, raceA, raceB, d]);

  const laneSplits = useMemo(() => (isRace ? lanes.map((m) => simulateMotion({ moverId: m.id, start, finish, trip: 'ida' }).splits) : [res.splits]), [isRace, lanes, start, finish, res]);

  /* --------------------------- lecturas de los instrumentos */
  const tapeSpec = INSTRUMENTS.movimiento?.find((i) => i.id === 'cinta') ?? MOTION_INSTRUMENTS[0];
  const gateSpec = INSTRUMENTS.movimiento?.find((i) => i.id === 'fotopuerta') ?? MOTION_INSTRUMENTS[1];
  const { measure, remeasure } = useMeasure();
  const aligned = Math.abs(start + tape - finish) < 1e-9;
  const tapeReading = useMemo(() => (aligned ? measure(tape, { ...tapeSpec, key: 'cinta' }) : null), [aligned, measure, tape, tapeSpec]);
  const gateReading = useMemo(() => Math.max(0, measure(res.time, { ...gateSpec, key: 'fotopuerta' })), [measure, res, gateSpec]);
  const raceReadings = useMemo(() => (raceRes ? [Math.max(0, measure(raceRes.t1, { ...gateSpec, key: 'fotopuerta' })), Math.max(0, measure(raceRes.t2, { ...gateSpec, key: 'fotopuerta2' }))] : null), [raceRes, measure, gateSpec]);
  const companion = useMemo(() => handTiming(res.time, 1 + attempt * 7919 + Math.round(d * 100) * 31 + MOVERS.indexOf(mover) * 104729, reaction), [res, attempt, d, mover, reaction]);

  const done = phase === 'medido';
  const running = phase === 'corriendo';
  const handReading = swStart !== null && swStop !== null ? Math.min(HAND_CAP, roundToResolution((swStop - swStart) / 1000, TIMER_RES)) : null;
  const timeReading: number | null = !done ? null : effTiming === 'fotopuerta' ? gateReading : effTiming === 'companero' ? companion.reading : handReading;
  const pathReading = tapeReading === null ? null : trip === 'idavuelta' ? 2 * tapeReading : tapeReading;
  const speed = pathReading !== null && timeReading ? pathReading / timeReading : null;
  const dispReading = tapeReading === null ? null : trip === 'idavuelta' ? 0 : tapeReading;
  const velocity = dispReading !== null && timeReading ? dispReading / timeReading : null;

  /* --------------------------- tiempo de la animación */
  const tEnd = isRace && raceRes ? Math.max(raceRes.t1, raceRes.t2) + TAIL : res.time + (trip === 'ida' ? TAIL : 0.3);
  const simT = phase === 'listo' ? -LEAD : done ? tEnd : Math.min(tEnd, ((now - runStart) / 1000) * factor - LEAD);

  const clearTimers = () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; };
  const reset = useCallback(() => {
    cancelAnimationFrame(raf.current);
    clearTimers();
    setPhase('listo');
    setSwStart(null); setSwStop(null);
    sw.current = { start: null, stop: null };
  }, []);
  useEffect(reset, [reset, activity, timing, moverId, raceA, raceB, start, finish, anim]);
  useEffect(() => { setHandLog([]); }, [activity, timing, moverId, start, finish, reaction]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimers(); }, []);

  const whistle = () => {
    clearTimers();
    [3150, 2850, 3150, 2850, 3150].forEach((f, i) => {
      timers.current.push(window.setTimeout(() => playSound('beep', { freq: f, intensity: 0.9 }), i * 70));
    });
  };

  /** Efectos sonoros de un cuadro: pitazo al cruzar la salida, fotopuertas y pasos. */
  const frameSounds = (t: number) => {
    const f = fx.current;
    if (!f.whistle && t >= 0) { f.whistle = true; whistle(); }
    lanes.forEach((m, li) => {
      const dd = d;
      const tr = isRace ? 'ida' : trip;
      if (effTiming === 'fotopuerta') {
        const splits = laneSplits[li] ?? res.splits;
        splits.forEach((s, i) => {
          const key = `${li}-${i}`;
          if (i > 0 && t >= s.t && !f.gates.has(key)) { f.gates.add(key); playSound('photogate', { pan: ((toPx(start + s.x) - W / 2) / W) * 1.4 }); }
        });
      }
      if (m.kind === 'persona') {
        const steps = Math.floor(drawPath(m, dd, tr, t) / m.stride);
        if (steps > f.steps[li]) {
          f.steps[li] = steps;
          if (t < (isRace && raceRes ? (li === 0 ? raceRes.t1 : raceRes.t2) : res.time) + TAIL) {
            playSound('thud', { intensity: m.id === 'corredor' ? 0.32 : 0.18, pan: ((toPx(start + drawPos(m, dd, tr, t)) - W / 2) / W) * 1.4 });
          }
        }
      }
    });
  };
  const frameRef = useRef(frameSounds);
  frameRef.current = frameSounds;

  useEffect(() => {
    if (phase !== 'corriendo') return;
    if (!manual && prefersReducedMotion()) { whistle(); setPhase('medido'); return; }
    const tick = (t: number) => {
      const el = Math.max(0, t - runStart);
      const st = (el / 1000) * factor - LEAD;
      setNow(t);
      frameRef.current(st);
      const animDone = st >= tEnd;
      const s = sw.current;
      if (manual && s.start !== null && s.stop === null && (t - s.start) / 1000 >= HAND_CAP) {
        s.stop = t; setSwStop(t);
      }
      if (animDone && (!manual || s.start === null || s.stop !== null)) {
        setPhase('medido');
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, runStart, factor, tEnd, manual]); // eslint-disable-line react-hooks/exhaustive-deps

  // Registro de las repeticiones hechas a mano (para ver cómo cambian).
  const lastLogged = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'medido' || isRace) { if (phase !== 'medido') lastLogged.current = null; return; }
    if (lastLogged.current !== null) return;
    const r = effTiming === 'manual' ? handReading : effTiming === 'companero' ? companion.reading : null;
    lastLogged.current = runStart;
    if (r !== null) setHandLog((l) => [...l, r].slice(-8));
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = () => {
    if (isRace && !prediction) return;
    cancelAnimationFrame(raf.current);
    remeasure('cinta', 'fotopuerta', 'fotopuerta2');
    fx.current = { whistle: false, gates: new Set(), steps: [0, 0] };
    sw.current = { start: null, stop: null };
    setSwStart(null); setSwStop(null);
    setAttempt((a) => a + 1);
    const t = performance.now();
    setRunStart(t); setNow(t);
    setPhase('corriendo');
  };

  // Pausa: el reloj de la animación se congela. Al reanudar se corre el origen del tiempo (y el arranque del
  // cronómetro de mano, si está en marcha) lo que duró la pausa, de modo que ninguna lectura cambia por pausar.
  const pausedAt = useRef(0);
  const pause = () => { cancelAnimationFrame(raf.current); clearTimers(); pausedAt.current = performance.now(); setPhase('pausa'); };
  const resume = () => {
    const t = performance.now();
    const delta = t - pausedAt.current;
    setRunStart((r0) => r0 + delta);
    const s = sw.current;
    if (s.start !== null && s.stop === null) { s.start += delta; setSwStart(s.start); }
    setNow(t);
    setPhase('corriendo');
  };

  const pressWatch = () => {
    if (!manual || phase !== 'corriendo') return;
    const t = performance.now();
    const s = sw.current;
    if (s.start === null) { s.start = t; setSwStart(t); playSound('click', { intensity: 0.9 }); }
    else if (s.stop === null) { s.stop = t; setSwStop(t); playSound('click', { intensity: 0.9 }); }
  };
  const pressRef = useRef(pressWatch);
  pressRef.current = pressWatch;
  useEffect(() => {
    if (!manual) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('button, input, select, textarea, a, summary, [role="slider"], [role="button"], [contenteditable="true"]')) return;
      e.preventDefault();
      if (!e.repeat) pressRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manual]);

  /* --------------------------- sonido continuo de rodadura */
  const rolling = running && simT > -LEAD && lanes.some((m) => m.kind !== 'persona' && simT < (isRace && raceRes ? Math.max(raceRes.t1, raceRes.t2) : res.time) + TAIL);
  const rollSpeed = Math.max(...lanes.filter((m) => m.kind !== 'persona').map((m) => m.v0 - m.decel * Math.max(0, simT)), 0);
  useSoundLoop('rolling', rolling, Math.min(1, 0.25 + rollSpeed / 8));

  /* --------------------------- cronómetro de la escena */
  const watchValue = (() => {
    if (phase === 'listo') return 0;
    if (effTiming === 'manual') {
      if (swStart === null) return 0;
      return handReading ?? Math.min(HAND_CAP, (now - swStart) / 1000);
    }
    if (effTiming === 'companero') {
      if (done) return companion.reading;
      const tStop = res.time + companion.stopDelay;
      return Math.max(0, Math.min(simT, tStop) - companion.startDelay);
    }
    if (isRace && raceRes && raceReadings) return done ? Math.max(...raceReadings) : Math.max(0, Math.min(simT, Math.max(raceRes.t1, raceRes.t2)));
    return done ? gateReading : Math.max(0, Math.min(simT, res.time));
  })();
  const watchLabel = effTiming === 'fotopuerta' ? 'fotopuertas' : effTiming === 'manual' ? 'tu cronómetro' : 'compañero';

  const reduce = useMemo(() => prefersReducedMotion(), [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const moverDraw = lanes.map((m, li) => {
    const tr: Trip = isRace ? 'ida' : trip;
    let pos = drawPos(m, d, tr, simT);
    if (running && reduce && pos > 0) pos = Math.floor(pos / MARK_SPACING) * MARK_SPACING;
    const abs = Math.max(-LEAD_MAX_M - 0.2, Math.min(TRACK_LENGTH + 1.2, start + pos));
    const returning = tr === 'idavuelta' && simT > res.time / 2;
    return { m, x: toPx(abs), y: GROUND[isRace ? li : 0], path: reduce ? 0 : drawPath(m, d, tr, simT), dir: (returning ? -1 : 1) as 1 | -1 };
  });

  const gateXs = useMemo(() => [0, ...res.splits.filter((s, i) => i > 0 && s.path <= d + 1e-9).map((s) => s.x)], [res, d]);

  /* --------------------------- modelo publicado (modo avanzado) */
  usePublishModel(() => {
    if (isRace && raceRes) {
      return {
        vars: {
          d: { sym: 'd', name: 'Distancia de la carrera', value: d, unit: 'm', decimals: 0 },
          t1: { sym: 't_{1}', name: `Tiempo del carril 1 (${lanes[0].short})`, value: raceRes.t1, unit: 's', decimals: 2 },
          t2: { sym: 't_{2}', name: `Tiempo del carril 2 (${lanes[1].short})`, value: raceRes.t2, unit: 's', decimals: 2 },
          v1: { sym: 'v_{1}', name: 'Rapidez media del carril 1', value: d / raceRes.t1, unit: 'm/s', decimals: 2 },
          v2: { sym: 'v_{2}', name: 'Rapidez media del carril 2', value: d / raceRes.t2, unit: 'm/s', decimals: 2 },
        },
        equations: [
          { title: 'Rapidez media del carril 1', lhs: 'v1', expr: '\\frac{[d]}{[t1]}' },
          { title: 'Rapidez media del carril 2', lhs: 'v2', expr: '\\frac{[d]}{[t2]}' },
        ],
        note: 'Gana quien tiene mayor rapidez media en el tramo, aunque al comienzo vaya más despacio.',
      };
    }
    const t = timeReading;
    const L = pathReading;
    const v = speed;
    const vars = {
      d: { sym: 'd', name: 'Distancia recorrida (cinta métrica)', value: L, unit: 'm', decimals: 2 },
      t: { sym: 't', name: 'Tiempo medido', value: t, unit: 's', decimals: 2 },
      v: { sym: 'v', name: 'Rapidez media', value: v, unit: 'm/s', decimals: 2 },
      vk: { sym: 'v_{km/h}', name: 'Rapidez media en km/h', value: v === null ? null : toKmh(v), unit: 'km/h', decimals: 1 },
      dx: { sym: '\\Delta x', name: 'Desplazamiento', value: dispReading, unit: 'm', decimals: 2 },
      vm: { sym: 'v_{media}', name: 'Velocidad media', value: velocity, unit: 'm/s', decimals: 2 },
      v0: { sym: 'v_{0}', name: 'Rapidez al cruzar la salida', value: mover.v0, unit: 'm/s', decimals: 1 },
      a: { sym: 'a', name: 'Desaceleración del balón', value: mover.decel, unit: 'm/s²', decimals: 1 },
      tm: { sym: 't_{real}', name: 'Tiempo real (modelo)', value: res.time, unit: 's', decimals: 2 },
    };
    const equations = [
      { title: 'Rapidez media', lhs: 'v', expr: '\\frac{[d]}{[t]}' },
      { title: 'Conversión a km/h', lhs: 'vk', expr: '[v]·3,6', note: '1 m/s = 3600 m/h = 3,6 km/h.' },
    ];
    if (trip === 'idavuelta') equations.push({ title: 'Velocidad media (ida y vuelta)', lhs: 'vm', expr: '\\frac{[dx]}{[t]}' });
    if (!isUniform(mover)) equations.push({ title: 'Posición del balón que frena', lhs: 'd', expr: '[v0]·[tm] − \\frac{1}{2}·[a]·[tm]^{2}' });
    return {
      vars, equations,
      note: effTiming === 'fotopuerta' ? undefined : 'El tiempo de mano incluye el tiempo de reacción: compáralo con el tiempo real del modelo.',
    };
  }, [isRace, raceRes, d, lanes, timeReading, pathReading, speed, dispReading, velocity, mover, res, trip, effTiming]);

  /* --------------------------- registro */
  const canRecord = done && aligned && (isRace ? raceReadings !== null : timeReading !== null && timeReading > 0);
  const record = () => {
    if (isRace && raceReadings && tapeReading !== null) {
      lanes.forEach((m, i) => {
        const t = raceReadings[i];
        const v = tapeReading / t;
        api.addTrial('tramos', {
          movil: m.short, recorrido: 'Carrera', cronometraje: TIMING_LABEL.fotopuerta, inicio: start, meta: finish,
          distancia: tapeReading, tiempo: t, rapidez: Number(v.toFixed(3)), rapidezKmh: Number(toKmh(v).toFixed(2)),
          desplazamiento: tapeReading, velocidadMedia: Number(v.toFixed(3)),
        });
      });
      return;
    }
    if (timeReading === null || pathReading === null || speed === null || dispReading === null || velocity === null) return;
    api.addTrial('tramos', {
      movil: mover.short, recorrido: trip === 'ida' ? 'Ida' : 'Ida y vuelta', cronometraje: TIMING_LABEL[effTiming], inicio: start, meta: finish,
      distancia: pathReading, tiempo: timeReading, rapidez: Number(speed.toFixed(3)), rapidezKmh: Number(toKmh(speed).toFixed(2)),
      desplazamiento: dispReading, velocidadMedia: Number(velocity.toFixed(3)),
    });
  };

  /* --------------------------- gráfica posición–tiempo */
  const chart = useMemo(() => {
    const series: Series[] = [];
    if (!done) return { series, xMax: 10 };
    if (isRace && raceRes) {
      const tMax = Math.max(raceRes.t1, raceRes.t2);
      lanes.forEach((m, i) => {
        const tm = i === 0 ? raceRes.t1 : raceRes.t2;
        series.push({ label: `Carril ${i + 1}: ${m.short}`, color: `var(--series-${i + 1})`, kind: 'line', points: Array.from({ length: 81 }, (_, k) => { const t = (k / 80) * tm; return { x: t, y: positionAt(m, t) }; }) });
      });
      return { series, xMax: Math.ceil(tMax + 0.5) };
    }
    const xMax = Math.ceil(Math.max(res.time, timeReading ?? 0) + 0.5);
    if (effTiming === 'fotopuerta') {
      series.push({ label: 'Tiempos de paso (fotopuertas cada 5 m)', color: 'var(--data)', kind: 'scatter', points: res.splits.map((s) => ({ x: roundToResolution(s.t, TIMER_RES), y: s.x, ex: TIMER_RES / 2, label: `${fmt(s.x, 0)} m` })) });
      series.push({ label: 'Posición del móvil', color: 'var(--series-1)', kind: 'line', points: Array.from({ length: 81 }, (_, k) => { const t = (k / 80) * res.time; return { x: t, y: tripPosition(mover, d, trip, t) }; }) });
    } else if (timeReading !== null && tapeReading !== null) {
      const end = trip === 'idavuelta' ? 0 : tapeReading;
      series.push({ label: 'Tu medición (salida y llegada)', color: 'var(--data)', kind: 'both', points: [{ x: 0, y: 0 }, { x: timeReading, y: end, label: `${fmt(timeReading, 2)} s` }] });
      series.push({ label: 'Fotopuerta (referencia)', color: 'var(--ink-2)', kind: 'scatter', points: [{ x: gateReading, y: end, label: `${fmt(gateReading, 2)} s` }] });
    }
    return { series, xMax };
  }, [done, isRace, raceRes, lanes, res, timeReading, effTiming, mover, d, trip, tapeReading, gateReading]);

  /* --------------------------- textos */
  const handStats = useMemo(() => {
    if (handLog.length < 2) return null;
    const mean = handLog.reduce((a, b) => a + b, 0) / handLog.length;
    const sd = Math.sqrt(handLog.reduce((a, b) => a + (b - mean) ** 2, 0) / (handLog.length - 1));
    return { mean, sd };
  }, [handLog]);

  const predictionOk = isRace && raceRes && done ? String(raceRes.winner) === prediction : null;
  const winnerText = raceRes ? (raceRes.winner === 'empate' ? 'Empate' : `Carril ${raceRes.winner} (${lanes[raceRes.winner - 1].short})`) : '—';

  const startHint = manual
    ? 'Pulsa «Dar la salida»; cuando suene el pito, pulsa el cronómetro (o la barra espaciadora) y vuelve a pulsarlo cuando el móvil cruce la meta.'
    : null;
  const missedWatch = done && manual && !isRace && swStart === null;

  const desc = (() => {
    const where = `Cono de salida en ${fmt(start, 0)} m y bandera de meta en ${fmt(finish, 0)} m de la cancha; la cinta métrica está tendida ${fmt(tape, 1)} m desde el cono${aligned ? ' y llega a la bandera' : ' y no llega exactamente a la bandera'}.`;
    if (isRace) return `${where} Carrera: carril 1 ${lanes[0].name.toLowerCase()}, carril 2 ${lanes[1].name.toLowerCase()}. ${done ? `Llegó primero: ${winnerText}.` : running ? 'Los móviles avanzan.' : phase === 'pausa' ? 'La carrera está en pausa.' : 'Los móviles esperan antes de la salida.'}`;
    const state = done
      ? (timeReading !== null ? `Recorrido terminado; el cronómetro marca ${fmt(timeReading, 2)} s.` : 'Recorrido terminado sin cronometrar.')
      : running ? `${mover.name} en movimiento; cronómetro en ${fmt(watchValue, 2)} s.`
        : phase === 'pausa' ? `Recorrido en pausa; cronómetro en ${fmt(watchValue, 2)} s.` : `${mover.name} espera detrás del cono de salida.`;
    return `${where} ${state}`;
  })();

  const onWatchKey = (e: RKeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) pressWatch(); }
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Pista de la cancha con conos, cinta métrica y cronómetro">
          <ManipScene viewBox={VIEW} label="Conos, bandera, cinta métrica y cronómetro de la pista" scene={
            <svg viewBox={VIEW} role="img" aria-labelledby="mov-t mov-d">
              <title id="mov-t">Pista recta de 40 m en la cancha del colegio con cono de salida, bandera de meta, cinta métrica, fotopuertas y cronómetro</title>
              <desc id="mov-d">{desc}</desc>
              <Court />
              {/* línea de salida y de meta */}
              <rect x={toPx(start) - 1.5} y={LANE_TOP} width="3" height={LANE_BOTTOM - LANE_TOP} fill="#fff" />
              {Array.from({ length: 23 }, (_, k) => (
                <g key={k}>
                  <rect x={toPx(finish) - 3} y={LANE_TOP + k * 6} width="3" height="6" fill={k % 2 ? '#fff' : '#1d2426'} />
                  <rect x={toPx(finish)} y={LANE_TOP + k * 6} width="3" height="6" fill={k % 2 ? '#1d2426' : '#fff'} />
                </g>
              ))}
              {effTiming === 'fotopuerta' && gateXs.map((gx, i) => (
                <Gate key={i} x={toPx(start + gx)} main={i === 0 || Math.abs(gx - d) < 1e-9}
                  lit={running && lanes.some((m) => { const p = drawPos(m, d, isRace ? 'ida' : trip, simT); return Math.abs(p - gx) < 0.6; })} />
              ))}
              <FinishFlag x={toPx(finish)} />
              <Cone x={toPx(start)} y={LANE_TOP + 1} s={0.75} />
              {moverDraw.map((md, i) => <MoverFigure key={`${md.m.id}-${i}`} mover={md.m} x={md.x} y={md.y} path={md.path} dir={md.dir} />)}
              <Cone x={toPx(start)} y={CONE_Y} />
              <Tape start={start} len={tape} />
              <text x={toPx(start) - 14} y={TAPE_Y + 30} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>cinta</text>
              {!aligned && <text x={toPx(start + tape)} y={TAPE_Y + 30} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--bad)', fontWeight: 700 }}>no llega a la meta</text>}
              <Stopwatch x={WATCH.x} y={WATCH.y} text={`${fmt(watchValue, 2)} s`} label={watchLabel} />
              {manual && <circle cx={WATCH.x + 52} cy={WATCH.y - 6} r="4" fill={swStart !== null && swStop === null ? '#ff5252' : '#9aa5a9'} />}
              <text x={W - 12} y={H - 10} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>Marcas cada 5 m · móviles no a escala</text>
            </svg>
          }>
            <Plunger label="Cono de salida (arrastrar sobre la pista)" value={start} min={MOTION_LIMITS.start[0]} max={MOTION_LIMITS.start[1]} step={1} pageStep={5}
              unit="m" decimals={0} disabled={running} from={{ x: toPx(MOTION_LIMITS.start[0]), y: CONE_Y - 12 }} to={{ x: toPx(MOTION_LIMITS.start[1]), y: CONE_Y - 12 }} size={30}
              valueText={(v) => `Cono de salida en ${fmt(v, 0)} m`} onChange={setStart} />
            <Plunger label="Bandera de meta (arrastrar sobre la pista)" value={finish} min={MOTION_LIMITS.finish[0]} max={MOTION_LIMITS.finish[1]} step={1} pageStep={5}
              unit="m" decimals={0} disabled={running} from={{ x: toPx(MOTION_LIMITS.finish[0]) + 8, y: FLAG_Y }} to={{ x: toPx(MOTION_LIMITS.finish[1]) + 8, y: FLAG_Y }} size={30}
              valueText={(v) => `Bandera de meta en ${fmt(v, 0)} m`} onChange={setFinish} />
            <Plunger label="Extremo de la cinta métrica (arrastrar hasta la meta)" value={tape} min={0} max={TRACK_LENGTH - start} step={0.5} pageStep={5}
              unit="m" decimals={1} from={{ x: toPx(start), y: TAPE_Y }} to={{ x: toPx(TRACK_LENGTH), y: TAPE_Y }} size={26}
              valueText={(v) => `Cinta extendida ${fmt(v, 1)} m${Math.abs(start + v - finish) < 1e-9 ? ', llega a la bandera' : ''}`} onChange={setTape} />
            {manual && (
              <g role="button" tabIndex={0} aria-label="Botón del cronómetro de mano" aria-disabled={!running || undefined}
                className={`manip${running ? '' : ' disabled'}`} onClick={pressWatch} onKeyDown={onWatchKey}>
                <rect className="manip-hit" x={WATCH.x - 4} y={WATCH.y - 12} width="112" height="72" rx="14" />
                <rect className="manip-ring" x={WATCH.x - 8} y={WATCH.y - 16} width="120" height="80" rx="16" vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </ManipScene>
        </div>
        <ManipHint>Arrastra el cono de salida, la bandera de meta y el extremo de la cinta métrica (o enfócalos con Tab y usa las flechas). Con «Tu cronómetro», pulsa el cronómetro de la escena o la barra espaciadora para arrancarlo y detenerlo.</ManipHint>

        {isRace ? (
          <Readout items={[
            { k: 'Distancia de la carrera (cinta)', v: tapeReading !== null ? `${fmt(tapeReading, 2)} m` : '—', data: true },
            { k: `Tiempo carril 1 (${lanes[0].short})`, v: done && raceReadings ? `${fmt(raceReadings[0], 2)} s` : '—', data: true },
            { k: `Tiempo carril 2 (${lanes[1].short})`, v: done && raceReadings ? `${fmt(raceReadings[1], 2)} s` : '—', data: true },
            { k: 'Llegó primero', v: done ? winnerText : '—', data: true },
          ]} />
        ) : (
          <Readout items={[
            { k: trip === 'ida' ? 'Distancia (cinta métrica)' : 'Distancia recorrida (ida y vuelta)', v: pathReading !== null ? `${fmt(pathReading, 2)} m` : '—', data: true },
            { k: 'Tiempo medido', v: timeReading !== null ? `${fmt(timeReading, 2)} s` : '—', data: true },
            { k: trip === 'ida' ? 'Rapidez media = d/t' : 'Rapidez media = distancia/t', v: speed !== null ? `${fmt(speed, 2)} m/s` : '—', data: true },
            { k: 'Rapidez media en km/h', v: speed !== null ? `${fmt(toKmh(speed), 1)} km/h` : '—', data: true },
            ...(trip === 'idavuelta' ? [
              { k: 'Desplazamiento', v: done && dispReading !== null ? `${fmt(dispReading, 2)} m` : '—', data: true },
              { k: 'Velocidad media = desplazamiento/t', v: velocity !== null ? `${fmt(velocity, 2)} m/s` : '—', data: true },
            ] : []),
            ...(effTiming !== 'fotopuerta' ? [{ k: 'Fotopuerta (referencia)', v: done && timeReading !== null ? `${fmt(gateReading, 2)} s` : '—', data: true }] : []),
          ]} />
        )}
        {!aligned && <Notice kind="warn">La cinta métrica no llega a la bandera de meta: arrastra su extremo hasta la meta (o usa el control «Cinta métrica extendida») para medir la distancia.</Notice>}
        {missedWatch && <Notice kind="warn">No arrancaste el cronómetro. Da la salida otra vez y pulsa el cronómetro (o la barra espaciadora) cuando suene el pito.</Notice>}
        {done && !isRace && <Warnings list={res.warnings} />}
        {done && !isRace && effTiming !== 'fotopuerta' && timeReading !== null && (
          <Notice kind={Math.abs(timeReading - gateReading) <= 0.1 ? 'ok' : 'info'}>
            Tu tiempo difiere {fmt(Math.abs(timeReading - gateReading), 2)} s del de la fotopuerta ({timeReading < gateReading ? 'más corto' : timeReading > gateReading ? 'más largo' : 'igual'}).
            {effTiming === 'companero' && ` El compañero arrancó ${fmt(companion.startDelay, 2)} s tarde y detuvo el cronómetro ${companion.stopDelay >= 0 ? `${fmt(companion.stopDelay, 2)} s tarde` : `${fmt(-companion.stopDelay, 2)} s antes`}.`}
          </Notice>
        )}
        {handLog.length > 0 && !isRace && (
          <div className="card stack-sm">
            <h3>Repeticiones cronometradas a mano</h3>
            <p className="small" style={{ margin: 0 }}>{handLog.map((t) => `${fmt(t, 2)} s`).join(' · ')}</p>
            {handStats && <p className="small muted" style={{ margin: 0 }}>Promedio {fmt(handStats.mean, 2)} s · desviación estándar {fmt(handStats.sd, 2)} s · {handLog.length} repeticiones. Las lecturas cambian por el tiempo de reacción.</p>}
          </div>
        )}
        {isRace && done && predictionOk !== null && raceRes && (
          <Notice kind={predictionOk ? 'ok' : 'warn'}>
            <strong>{predictionOk ? '¡Acertaste!' : 'Tu predicción no se cumplió.'}</strong>{' '}
            {raceRes.overtake
              ? `Hubo un adelantamiento a los ${fmt(raceRes.overtake.x, 1)} m (t = ${fmt(raceRes.overtake.t, 2)} s): el que salió más rápido perdió la ventaja porque frena.`
              : 'Ninguno adelantó al otro antes de la meta: el que va adelante desde la salida llega primero.'}
            {' '}Compara las pendientes en la gráfica posición–tiempo.
          </Notice>
        )}
        <div className="card">
          <h3>Posición en función del tiempo</h3>
          <Chart title="Gráfica posición–tiempo en la pista" xLabel="Tiempo (s)" yLabel="Posición desde la salida (m)" xUnit="s" yUnit="m" height={260}
            xDomain={[0, chart.xMax]} yDomain={[0, Math.max(5, Math.ceil(d / 5) * 5)]} series={chart.series}
            fit={done && !isRace && effTiming === 'fotopuerta' && trip === 'ida' && isUniform(mover)}
            hLines={done ? [{ y: d, label: `Meta (${fmt(d, 0)} m)` }] : undefined}
            emptyText="Da la salida para ver la gráfica." />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Montaje en la cancha</h3>
          <Segmented<Activity> label="Actividad" value={activity} onChange={setActivity}
            options={[{ value: 'ida', label: 'Medir un tramo' }, { value: 'idavuelta', label: 'Ida y vuelta' }, { value: 'carrera', label: 'Carrera' }]} />
          {isRace ? (
            <>
              <Select label="Móvil del carril 1" value={raceA} onChange={(v) => { setRaceA(v as MoverId); setPrediction(''); }} options={MOVERS.map((m) => ({ value: m.id, label: m.name }))} />
              <Select label="Móvil del carril 2" value={raceB} onChange={(v) => { setRaceB(v as MoverId); setPrediction(''); }} options={MOVERS.map((m) => ({ value: m.id, label: m.name }))} />
            </>
          ) : (
            <Select label="Móvil" value={mover.id} onChange={(v) => setMoverId(v as MoverId)} options={moverOptions.map((m) => ({ value: m.id, label: m.name }))}
              hint={trip === 'idavuelta' ? 'En ida y vuelta no está el balón: no regresa solo.' : undefined} />
          )}
          <Slider label="Posición del cono de salida" value={start} min={MOTION_LIMITS.start[0]} max={MOTION_LIMITS.start[1]} step={1} unit="m" decimals={0} onChange={(v) => !running && setStart(v)} />
          <Slider label="Posición de la bandera de meta" value={finish} min={MOTION_LIMITS.finish[0]} max={MOTION_LIMITS.finish[1]} step={1} unit="m" decimals={0} onChange={(v) => !running && setFinish(v)}
            hint={`La meta queda al menos ${MIN_GAP} m después de la salida.`} />
          <Slider label="Cinta métrica extendida" value={tape} min={0} max={TRACK_LENGTH - start} step={0.5} unit="m" decimals={1} onChange={setTape} />
          {!isRace && (
            <Segmented<Timing> label="Cronometraje" value={timing} onChange={setTiming}
              options={[{ value: 'fotopuerta', label: 'Fotopuertas automáticas' }, { value: 'manual', label: 'Tu cronómetro' }, { value: 'companero', label: 'Compañero con cronómetro' }]} />
          )}
          {isRace && (
            <Segmented<Prediction> label="Tu predicción: ¿quién llega primero?" value={prediction} onChange={(v) => { if (!running) setPrediction(v); }}
              options={[{ value: '1', label: `Carril 1 (${lanes[0].short})` }, { value: '2', label: `Carril 2 (${lanes[1].short})` }, { value: 'empate', label: 'Empate' }]} />
          )}
          {!manual && (
            <Segmented<AnimSpeed> label="Velocidad de la animación" value={anim} onChange={setAnim}
              options={[{ value: 'real', label: 'Tiempo real' }, { value: 'x4', label: 'Acelerada ×4' }]} />
          )}
          {/* Sin barra de avance: el tiempo del recorrido es lo que se mide. */}
          <SimControls title="Salida y recorrido" status={simStatusOf(running, phase === 'pausa', done)} startLabel="Dar la salida" repeatLabel="Dar la salida otra vez"
            disabled={phase === 'listo' && isRace && !prediction} onStart={go} onPause={pause} onResume={resume} onReset={reset}>
            {manual && (
              <button type="button" className="btn" onClick={pressWatch} disabled={!running || swStop !== null}>
                {swStart === null ? 'Arrancar cronómetro' : 'Detener cronómetro'}
              </button>
            )}
          </SimControls>
          {startHint && <p className="small muted" style={{ margin: 0 }}>{startHint}</p>}
          {isRace && !prediction && <p className="small muted" style={{ margin: 0 }}>Elige tu predicción antes de dar la salida.</p>}
          <RecordButton onRecord={record} disabled={!canRecord} label={isRace ? 'Guardar los dos carriles en la tabla' : undefined} />
        </div>
        <Notice>Pista recta de 40 m con marcas cada 5 m. Salida lanzada: cada móvil cruza el cono ya en marcha. Cinta métrica de 1 cm; cronómetro y fotopuertas de 0,01 s. Al cronometrar a mano se arranca unas décimas de segundo tarde (tiempo de reacción).</Notice>
      </div>
    </div>
  );
}

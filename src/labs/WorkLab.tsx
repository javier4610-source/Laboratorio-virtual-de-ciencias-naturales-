import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BLOCK, DYNAMOMETER_MAX, MOTOR_MAX_SPEED, RAMP, STEP_HEIGHT, SURFACES, WORK_INSTRUMENTS, WORK_LIMITS, blockMass, rampFromReadings,
  simulateRamp, simulateStairs, type Drive, type InstrumentId, type SurfaceId, type WorkInstrumentSpec,
} from '../models/workPower';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { useMeasure } from '../components/Measurement';
import { Notice, Readout, RecordButton, Segmented, Slider } from '../components/ui';
import { SimControls, simStatusOf } from '../components/Experiment';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, ContactShadow, Lcd, Stopwatch } from './kit';
import { DragHandle, ManipHint, ManipScene, zoneAt, type Pt } from './manipulate';

/* ------------------------------------------------------------------ instrumentos */

/** Ficha del instrumento: la de src/labs/instruments.ts si ya está integrada; si no, la del modelo (respaldo local). */
function instrumentSpec(id: InstrumentId): WorkInstrumentSpec {
  return INSTRUMENTS.trabajo?.find((i) => i.id === id) ?? WORK_INSTRUMENTS[id];
}

/* ------------------------------------------------------------------ geometría */

const W = 760, H = 440;
const BENCH_Y = 410;
/** Bisagra de la rampa: origen de la cara superior de la tabla. */
const P0: Pt = { x: 64, y: 396 };
/** Píxeles por metro (la misma escala en horizontal y en vertical). */
const S = 470;
const BOARD_LEN = RAMP.length * S;
const BOARD_T = 10;
const STRIP_T = 3;
const BLOCK_L = 47, BLOCK_H = 24;
const DYN_L = 80;
const DYN_Y = -STRIP_T - 12; // altura del eje del dinamómetro (marco de la rampa)
const POST_X = P0.x + RAMP.postDistance * S;
const RULER_X = 588;
const PX_CM = S / 100;
const ROPE = '#b98a4a';
const SKIN = '#b9805a';
const TENS_MS = 450; // el resorte se estira antes de que el bloque arranque

/** Bandeja de tiras (arriba a la izquierda). */
const TRAY = { x: 12, y: 12, w: 222, h: 112 };
const STRIP_ROW = (i: number) => TRAY.y + 30 + i * 20;
const STRIP_EDGES = [1, 2, 3].map((i) => STRIP_ROW(i) - 4);
/** Pesera (abajo a la derecha). */
const RACK = { x: 618, y: 352, w: 134, h: 58 };

const SURFACE_STYLE: Record<SurfaceId, { fill: string; edge: string }> = {
  madera: { fill: '#d8b277', edge: '#9c7a45' },
  lija: { fill: '#7a5b45', edge: '#4c3626' },
  teflon: { fill: '#eef3f5', edge: '#93a6ad' },
  ruedas: { fill: '#3f4b50', edge: '#252e32' },
};

type Experiment = 'rampa' | 'escalera';
type Phase = 'listo' | 'midiendo' | 'pausa' | 'medido';

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Del marco de la rampa (x a lo largo de la tabla, y hacia dentro de la tabla) a la pantalla. */
function toScreen(x: number, y: number, angleDeg: number): Pt {
  const c = Math.cos(rad(angleDeg)), s = Math.sin(rad(angleDeg));
  return { x: P0.x + x * c + y * s, y: P0.y - x * s + y * c };
}
/** Distancia de un punto de la pantalla a la cara superior de la tabla (y posición a lo largo, en px). */
function nearBoard(p: Pt, angleDeg: number) {
  const c = Math.cos(rad(angleDeg)), s = Math.sin(rad(angleDeg));
  const dx = p.x - P0.x, dy = p.y - P0.y;
  const along = dx * c - dy * s, across = dx * s + dy * c;
  return { along, across };
}

/* ------------------------------------------------------------------ piezas locales */

function WorkDefs() {
  return (
    <defs>
      <linearGradient id="tpp-brass" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#efce74" />
        <stop offset="0.5" stopColor="#c69a2f" />
        <stop offset="1" stopColor="#7f5d10" />
      </linearGradient>
      <linearGradient id="tpp-scale" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fffdf3" />
        <stop offset="1" stopColor="#e6dfc5" />
      </linearGradient>
      <linearGradient id="tpp-wood-v" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#f3dda2" />
        <stop offset="1" stopColor="#ddb96c" />
      </linearGradient>
      <linearGradient id="tpp-wall" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f4efe2" />
        <stop offset="1" stopColor="#e3dccb" />
      </linearGradient>
      <linearGradient id="tpp-step" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#c9c3b6" />
        <stop offset="1" stopColor="#a39d90" />
      </linearGradient>
      <pattern id="tpp-grit" width="4" height="3" patternUnits="userSpaceOnUse">
        <rect width="4" height="3" fill="#7a5b45" />
        <circle cx="1" cy="1" r="0.6" fill="#b49376" />
        <circle cx="3" cy="2.2" r="0.5" fill="#3b2a1e" />
      </pattern>
    </defs>
  );
}

/** Tira de superficie dibujada entre x0 y x1 con la cara superior en y (marco local, horizontal). */
function StripBody({ id, x0, x1, y, h = STRIP_T }: { id: SurfaceId; x0: number; x1: number; y: number; h?: number }) {
  const st = SURFACE_STYLE[id];
  const w = x1 - x0;
  if (id === 'ruedas') {
    const n = Math.max(2, Math.floor(w / 6));
    const r = Math.min(1.8, h * 0.55);
    return (
      <g>
        <rect x={x0} y={y + h * 0.45} width={w} height={h * 0.55} fill={st.fill} stroke={st.edge} strokeWidth="0.4" />
        {Array.from({ length: n }, (_, i) => <circle key={i} cx={x0 + 3 + i * (w - 6) / (n - 1)} cy={y + r} r={r} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.3" />)}
      </g>
    );
  }
  return (
    <g>
      <rect x={x0} y={y} width={w} height={h} fill={id === 'lija' ? 'url(#tpp-grit)' : st.fill} stroke={st.edge} strokeWidth="0.4" />
      {id === 'teflon' && <rect x={x0 + 2} y={y + 0.4} width={w - 4} height={Math.max(0.6, h * 0.3)} fill="#fff" opacity="0.8" />}
      {id === 'madera' && <path d={`M${x0 + 4} ${y + h * 0.55} q${w * 0.25} -${h * 0.3} ${w * 0.5} 0 t${w * 0.5 - 8} 0`} fill="none" stroke={st.edge} strokeWidth="0.35" opacity="0.7" />}
    </g>
  );
}

/** Pesa ranurada de 100 g vista de lado; (x, y) = esquina superior izquierda. */
function SlotMass({ x, y, w = 34, h = 5 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h - 0.4} rx={1.2} fill="url(#tpp-brass)" stroke="#6f520f" strokeWidth="0.4" />
      <rect x={x + w / 2 - 1.5} y={y} width={3} height={h * 0.55} fill="#6f520f" opacity="0.55" />
    </g>
  );
}

/** Bloque de madera con gancho y pesas encima (marco de la rampa, cara inferior en y = −STRIP_T). */
function Block({ x, slots }: { x: number; slots: number }) {
  const top = -STRIP_T - BLOCK_H;
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x} y={top} width={BLOCK_L} height={BLOCK_H} rx={2} fill="url(#kit-wood)" stroke="#9c7a45" strokeWidth="0.8" />
      </g>
      <path d={`M${x + 4} ${top + 8} q${BLOCK_L * 0.4} -3 ${BLOCK_L - 8} 1 M${x + 4} ${top + 16} q${BLOCK_L * 0.5} 3 ${BLOCK_L - 8} -1`} fill="none" stroke="#b8975a" strokeWidth="0.6" />
      <rect x={x + BLOCK_L - 5} y={top + 2} width={3} height={BLOCK_H - 4} fill="#000" opacity="0.08" />
      <text x={x + BLOCK_L / 2} y={top + 15} textAnchor="middle" style={{ fontSize: 6.5, fill: '#4d3b1c', fontWeight: 700 }}>300 g</text>
      {Array.from({ length: slots }, (_, i) => <SlotMass key={i} x={x + (BLOCK_L - 34) / 2} y={top - 5 * (i + 1)} />)}
      {/* armella del gancho */}
      <circle cx={x + BLOCK_L + 2.6} cy={DYN_Y} r={2.4} fill="none" stroke="#5d6b70" strokeWidth="1.2" />
    </g>
  );
}

/**
 * Dinamómetro horizontal (marco de la rampa): gancho en x0 y anillo en x0 + DYN_L. El indicador rojo se acerca al gancho
 * a medida que el resorte se estira.
 */
function HDynamometer({ x0, force, overload }: { x0: number; force: number; overload: boolean }) {
  const y = DYN_Y;
  const zx = x0 + DYN_L - 18, perN = 4.8;
  const shown = overload ? DYNAMOMETER_MAX + 0.3 : Math.max(0, Math.min(DYNAMOMETER_MAX, force));
  const ix = zx - perN * shown;
  const spring = (() => {
    const a = ix + 2, b = x0 + DYN_L - 10, turns = 12;
    let d = `M${a} ${y}`;
    for (let i = 1; i <= turns; i++) d += ` L${a + ((b - a) * i) / turns} ${y + (i % 2 ? -3.2 : 3.2)}`;
    return d;
  })();
  return (
    <g>
      <path d={`M${x0 + 8} ${y} L${x0 + 3} ${y} Q${x0} ${y} ${x0 + 0.5} ${y + 2.5}`} fill="none" stroke="#5d6b70" strokeWidth="1.6" strokeLinecap="round" />
      <line x1={x0 + 6} x2={ix} y1={y} y2={y} stroke="url(#kit-metal)" strokeWidth="2.4" />
      <rect x={x0 + 9} y={y - 7} width={DYN_L - 17} height={14} rx={3.5} fill="url(#tpp-scale)" stroke="#9aa5a9" strokeWidth="0.6" />
      {Array.from({ length: 21 }, (_, i) => i * 0.5).map((n) => {
        const tx = zx - perN * n, major = n % 1 === 0;
        return <line key={n} x1={tx} x2={tx} y1={y - 7} y2={y - 7 + (n % 5 === 0 ? 5 : major ? 3.5 : 2)} stroke="#2b3436" strokeWidth={n % 5 === 0 ? 0.7 : 0.4} />;
      })}
      {[0, 5, 10].map((n) => <text key={n} x={zx - perN * n} y={y + 5.5} textAnchor="middle" style={{ fontSize: 4.6, fill: '#2b3436', fontFamily: 'var(--font-data)' }}>{n}</text>)}
      <path d={spring} fill="none" stroke="#7d8a8f" strokeWidth="0.8" strokeLinejoin="round" />
      <rect x={ix - 1.3} y={y - 6} width={2.6} height={12} rx={0.8} fill={overload ? 'var(--bad)' : '#d32f2f'} />
      <rect x={x0 + 9} y={y - 7} width={DYN_L - 17} height={14} rx={3.5} fill="url(#kit-glass)" opacity="0.6" />
      <rect x={x0 + 7} y={y - 8} width={5} height={16} rx={1.5} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.4" />
      <rect x={x0 + DYN_L - 11} y={y - 8} width={5} height={16} rx={1.5} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.4" />
      <circle cx={x0 + DYN_L - 2} cy={y} r={4} fill="none" stroke="url(#kit-metal)" strokeWidth="2" />
      <circle cx={x0 + DYN_L - 2} cy={y} r={4} fill="none" stroke="#6d7b80" strokeWidth="0.5" />
    </g>
  );
}

/** Mano que sujeta el anillo del dinamómetro (marco de la rampa). */
function Hand({ x }: { x: number }) {
  const y = DYN_Y;
  return (
    <g>
      <path d={`M${x + 8} ${y - 2} L${x + 52} ${y - 44}`} stroke="#2f5d8a" strokeWidth="13" strokeLinecap="round" />
      <path d={`M${x + 8} ${y - 2} L${x + 30} ${y - 23}`} stroke={SKIN} strokeWidth="8" strokeLinecap="round" />
      <ellipse cx={x + 6} cy={y} rx={8} ry={6.5} fill={SKIN} stroke="#8a5a3b" strokeWidth="0.6" />
      <path d={`M${x} ${y - 4} q-4 3 0 7`} fill="none" stroke="#8a5a3b" strokeWidth="0.8" />
      {[-2.5, 0, 2.5].map((d) => <line key={d} x1={x + 2} x2={x + 9} y1={y + d} y2={y + d} stroke="#8a5a3b" strokeWidth="0.5" opacity="0.8" />)}
    </g>
  );
}

/** Torno eléctrico atornillado al extremo superior de la tabla (marco de la rampa). */
function Winch({ on, turns }: { on: boolean; turns: number }) {
  const x = BOARD_LEN + 1, cy = DYN_Y;
  return (
    <g>
      <rect x={x - 2} y={-4} width={8} height={BOARD_T + 6} fill="url(#kit-metal-h)" />
      <g filter="url(#kit-shadow-soft)">
        <rect x={x + 5} y={-34} width={38} height={34 + BOARD_T} rx={4} fill="url(#kit-body-dark)" />
      </g>
      <circle cx={x + 6} cy={cy} r={8} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />
      <circle cx={x + 6} cy={cy} r={6} fill="none" stroke={ROPE} strokeWidth="2.4" strokeDasharray="2 1.4" strokeDashoffset={-turns} />
      <circle cx={x + 6} cy={cy} r={1.8} fill="#37474f" />
      <text x={x + 26} y={-22} textAnchor="middle" style={{ fontSize: 6, fill: '#c9d2d5', fontWeight: 700, letterSpacing: 0.6 }}>TORNO</text>
      <circle cx={x + 34} cy={-12} r={2.4} fill={on ? '#7CFFB2' : '#33413c'} stroke="#11181a" strokeWidth="0.5" />
      <rect x={x + 16} y={-16} width={12} height={7} rx={1.5} fill="#11181a" />
    </g>
  );
}

/** Regla vertical: el cero está en y0 y la escala crece hacia arriba. */
function VRuler({ x, y0, cm, caption }: { x: number; y0: number; cm: number; caption: string }) {
  const top = y0 - cm * PX_CM - 5;
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x} y={top} width={16} height={y0 - top + 5} rx={2} fill="url(#tpp-wood-v)" stroke="#b8975a" strokeWidth="0.8" />
      </g>
      {Array.from({ length: cm + 1 }, (_, i) => {
        const ty = y0 - i * PX_CM, major = i % 5 === 0;
        return (
          <g key={i}>
            <line x1={x} x2={x + (i % 10 === 0 ? 8 : major ? 6 : 3)} y1={ty} y2={ty} stroke="#4d3b1c" strokeWidth={major ? 0.8 : 0.45} />
            {major && i > 0 && <text x={x + 15} y={ty + 2.6} textAnchor="end" style={{ fontSize: 6.5, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{i}</text>}
          </g>
        );
      })}
      <line x1={x - 4} x2={x + 16} y1={y0} y2={y0} stroke="var(--data)" strokeWidth="1.2" strokeDasharray="2 2" />
      <text x={x + 8} y={top - 6} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontWeight: 600 }}>{caption}</text>
    </g>
  );
}

/** Estudiante con uniforme, de pie o caminando; (x, y) = punto entre los pies. */
function Student({ x, y, stride, h = 92 }: { x: number; y: number; stride: number; h?: number }) {
  const k = h / 92;
  const hip = { x, y: y - 44 * k };
  const sw = Math.sin(stride) * 9 * k;
  const knee = (side: 1 | -1) => ({ x: hip.x + side * sw * 0.6 + 3 * k, y: hip.y + 22 * k - Math.max(0, side * Math.sin(stride)) * 6 * k });
  const foot = (side: 1 | -1) => ({ x: hip.x + side * sw, y: y - Math.max(0, side * Math.sin(stride)) * 8 * k });
  const leg = (side: 1 | -1) => { const kn = knee(side), f = foot(side); return `M${hip.x} ${hip.y} L${kn.x} ${kn.y} L${f.x} ${f.y} l${6 * k} 0`; };
  return (
    <g>
      <path d={leg(-1)} fill="none" stroke="#1d3357" strokeWidth={7 * k} strokeLinecap="round" strokeLinejoin="round" />
      <path d={leg(-1)} fill="none" stroke="#111" strokeWidth={2 * k} strokeDasharray={`0 ${100 * k} 8 0`} />
      <path d={`M${hip.x - 2 * k} ${y - 82 * k} L${hip.x - sw * 0.8} ${y - 58 * k}`} stroke={SKIN} strokeWidth={5 * k} strokeLinecap="round" />
      <path d={`M${hip.x - 8 * k} ${y - 44 * k} L${hip.x - 9 * k} ${y - 78 * k} Q${hip.x} ${y - 84 * k} ${hip.x + 9 * k} ${y - 78 * k} L${hip.x + 8 * k} ${y - 44 * k} Z`} fill="#f7f7f2" stroke="#9aa3a6" strokeWidth="0.8" />
      <path d={`M${hip.x - 8 * k} ${y - 50 * k} h${16 * k}`} stroke="#1d3357" strokeWidth={3 * k} />
      <path d={leg(1)} fill="none" stroke="#24406b" strokeWidth={7 * k} strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${hip.x + 2 * k} ${y - 80 * k} L${hip.x + sw * 0.8 + 2 * k} ${y - 56 * k}`} stroke={SKIN} strokeWidth={5 * k} strokeLinecap="round" />
      <rect x={hip.x - 3 * k} y={y - 88 * k} width={6 * k} height={6 * k} fill={SKIN} />
      <circle cx={hip.x + 1 * k} cy={y - 94 * k} r={8 * k} fill={SKIN} stroke="#8a5a3b" strokeWidth="0.5" />
      <path d={`M${hip.x - 7.5 * k} ${y - 95 * k} Q${hip.x} ${y - 107 * k} ${hip.x + 8.5 * k} ${y - 96 * k} Q${hip.x + 2 * k} ${y - 100 * k} ${hip.x - 7.5 * k} ${y - 95 * k} Z`} fill="#2b1d14" />
      <circle cx={hip.x + 5 * k} cy={y - 95 * k} r={0.9 * k} fill="#2b1d14" />
    </g>
  );
}

/** Diagrama de energía: el trabajo de entrada se reparte en energía potencial y calor por rozamiento. */
function EnergyDiagram({ workIn, lift, heat }: { workIn: number; lift: number; heat: number }) {
  const total = Math.max(workIn, lift, 1e-9);
  const X0 = 112, WMAX = 180;
  const wIn = (workIn / total) * WMAX, wLift = (Math.max(0, lift) / total) * WMAX, wHeat = (Math.max(0, heat) / total) * WMAX;
  const J = (v: number) => `${fmt(v, 3)} J`;
  return (
    <svg viewBox="0 0 360 118" role="img" aria-labelledby="tpp-e-t tpp-e-d" style={{ width: '100%', maxWidth: 520 }}>
      <title id="tpp-e-t">Diagrama de energía de la subida</title>
      <desc id="tpp-e-d">{`Trabajo de entrada ${J(workIn)}: ${J(lift)} quedan como energía potencial y ${J(heat)} se transforman en calor por rozamiento.`}</desc>
      <text x={8} y={26} style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700 }}>Entra</text>
      <text x={8} y={39} style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>trabajo F·d</text>
      <rect x={X0} y={14} width={wIn} height={22} rx={3} fill="var(--fis)" />
      <text x={X0 + wIn + 6} y={29} style={{ fontSize: 10.5, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{J(workIn)}</text>
      <path d={`M${X0 + 4} 40 v10 M${X0 + wIn - 4} 40 v10`} stroke="var(--ink-2)" strokeWidth="1" />
      <path d={`M${X0 + 4} 50 H${X0 + wIn - 4}`} stroke="var(--ink-2)" strokeWidth="1" />
      <path d={`M${X0 + wIn / 2} 50 v6 l-4 -4 m4 4 l4 -4`} fill="none" stroke="var(--ink-2)" strokeWidth="1.2" />
      <text x={8} y={76} style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700 }}>Sale</text>
      <text x={8} y={89} style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>energía y calor</text>
      <rect x={X0} y={64} width={wLift} height={22} rx={3} fill="var(--series-3)" />
      <rect x={X0 + wLift} y={64} width={wHeat} height={22} rx={3} fill="var(--series-1)" />
      <g style={{ fontSize: 9.5, fontFamily: 'var(--font-data)' }}>
        <rect x={X0} y={95} width={9} height={9} rx={2} fill="var(--series-3)" />
        <text x={X0 + 13} y={103} style={{ fill: 'var(--ink)' }}>potencial m·g·h: {J(lift)}</text>
        <rect x={X0} y={107} width={9} height={9} rx={2} fill="var(--series-1)" />
        <text x={X0 + 13} y={115} style={{ fill: 'var(--ink)' }}>calor por rozamiento: {J(heat)}</text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function WorkLab({ api }: LabProps) {
  const [exp, setExp] = useState<Experiment>('rampa');
  const [angle, setAngle] = useState(30);
  const [slots, setSlots] = useState(2);
  const [surface, setSurface] = useState<SurfaceId>('madera');
  const [drive, setDrive] = useState<Drive>('mano');
  const [handSpeed, setHandSpeed] = useState(0.2);
  const [motorPower, setMotorPower] = useState(1.5);
  const [personMass, setPersonMass] = useState(50);
  const [steps, setSteps] = useState(18);
  const [pace, setPace] = useState(2);
  const [phase, setPhase] = useState<Phase>('listo');
  const [elapsed, setElapsed] = useState(0); // ms desde que empezó la medición
  const raf = useRef(0);
  const stripPick = useRef<number | null>(null);

  const mass = blockMass(slots);
  const surf = SURFACES.find((s) => s.id === surface)!;
  const surfIndex = SURFACES.findIndex((s) => s.id === surface);
  const ramp = useMemo(() => simulateRamp({ angleDeg: angle, mass, surface, drive, handSpeed, motorPower }), [angle, mass, surface, drive, handSpeed, motorPower]);
  const stairs = useMemo(() => simulateStairs({ personMass, steps, pace }), [personMass, steps, pace]);

  // Lecturas: en modo ideal coinciden con el modelo redondeado; en modo real llevan el error aleatorio de la ficha.
  const { measure, remeasure, real } = useMeasure();
  const readings = useMemo(() => {
    const dyn = instrumentSpec('dinamometro'), rul = instrumentSpec('regla'), cro = instrumentSpec('cronometro');
    return {
      weight: measure(ramp.weight, { ...dyn, key: 'peso' }),
      effort: ramp.overload ? null : measure(ramp.F, { ...dyn, key: 'fuerza' }),
      dCm: measure(ramp.d * 100, { ...rul, key: 'recorrido' }),
      hCm: measure(ramp.h * 100, { ...rul, key: 'altura' }),
      t: measure(ramp.time, { ...cro, key: 'tiempo' }),
    };
  }, [ramp, measure]);
  const derived = useMemo(() => {
    if (readings.effort === null || !(readings.effort > 0) || !(readings.hCm > 0) || !(readings.t > 0)) return null;
    return rampFromReadings({ weight: readings.weight, effort: readings.effort, dCm: readings.dCm, hCm: readings.hCm, t: readings.t });
  }, [readings]);
  const stairReadings = useMemo(() => {
    const bas = instrumentSpec('bascula'), rul = instrumentSpec('regla'), cro = instrumentSpec('cronometro');
    const m = measure(personMass, { ...bas, key: 'masa-persona' });
    const step = measure(STEP_HEIGHT * 100, { ...rul, key: 'escalon' });
    const t = measure(stairs.time, { ...cro, key: 'tiempo-escalera' });
    const hM = (steps * step) / 100;
    const work = m * 9.8 * hM;
    return { m, step, t, hCm: steps * step, work, power: t > 0 ? work / t : null };
  }, [personMass, steps, stairs, measure]);

  /* -------------------------------------------------- animación */
  const overload = exp === 'rampa' && ramp.overload;
  const moveMs = exp === 'rampa'
    ? Math.min(4000, Math.max(1200, readings.t * 1000))
    : Math.min(4500, Math.max(1500, stairReadings.t * 1000));
  const totalMs = exp === 'rampa' ? TENS_MS + (overload ? 0 : moveMs) : moveMs;

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setElapsed(0); };
  useEffect(reset, [exp, angle, slots, surface, drive, handSpeed, motorPower, personMass, steps, pace]);

  useEffect(() => {
    if (phase !== 'midiendo') return;
    if (prefersReducedMotion()) { setElapsed(totalMs); setPhase('medido'); return; }
    // Al reanudar tras una pausa, la subida sigue desde donde iba.
    const start = performance.now() - elapsed;
    const tick = (now: number) => {
      const el = Math.min(totalMs, Math.max(0, now - start));
      setElapsed(el);
      if (el >= totalMs) { setPhase('medido'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, totalMs]);

  const measured = phase === 'medido';
  const tension = exp !== 'rampa' || phase === 'listo' ? 0 : Math.min(1, elapsed / TENS_MS);
  const motion = phase === 'listo' || overload ? 0
    : exp === 'rampa' ? Math.min(1, Math.max(0, (elapsed - TENS_MS) / moveMs)) : Math.min(1, elapsed / moveMs);
  const moving = phase === 'midiendo' && motion > 0 && motion < 1;
  useSoundLoop('rolling', moving && exp === 'rampa', Math.min(1, 0.35 + ramp.speed * 1.3) * (surface === 'ruedas' ? 1 : 0.7));
  useSoundLoop('hum', moving && exp === 'rampa' && drive === 'torno', 0.6);

  const startMeasure = () => {
    if (exp === 'rampa') {
      remeasure('peso', 'fuerza', 'recorrido', 'altura', 'tiempo');
      playSound('creak', { intensity: 0.4 + Math.min(0.6, ramp.F / 15) });
    } else {
      remeasure('masa-persona', 'escalon', 'tiempo-escalera');
      playSound('beep');
    }
    cancelAnimationFrame(raf.current);
    setElapsed(0);
    setPhase('midiendo');
  };
  useEffect(() => { if (measured && exp === 'escalera') playSound('beep', { freq: 2400 }); }, [measured, exp]);

  /* -------------------------------------------------- cambios con sonido (panel y escena comparten el estado) */
  const changeAngle = (v: number) => { if (v !== angle) { setAngle(v); playSound('squeak', { intensity: 0.25 }); } };
  const changeSlots = (v: number) => { if (v !== slots) { setSlots(v); playSound('clank', { intensity: 0.35 + v * 0.06 }); } };
  const changeSurface = (id: SurfaceId) => { if (id !== surface) { setSurface(id); playSound('thunk', { intensity: 0.5 }); } };

  /* -------------------------------------------------- textos */
  const show = (s: string) => (measured ? s : '—');
  const N = (v: number) => `${fmt(v, 1)} N`;
  const J = (v: number) => `${fmt(v, 3)} J`;

  const record = () => {
    if (exp === 'rampa') {
      if (!measured || readings.effort === null || !derived) return;
      const r4 = (v: number) => Number(v.toFixed(4));
      api.addTrial('rampa', {
        superficie: surf.short, mu: surf.mu, angulo: angle, masa: mass, traccion: drive === 'mano' ? 'Mano' : 'Torno',
        rapidez: drive === 'mano' ? handSpeed : null, potenciaTorno: drive === 'torno' ? motorPower : null,
        peso: readings.weight, fuerza: readings.effort, recorrido: readings.dCm, altura: readings.hCm, tiempo: readings.t,
        trabajo: r4(derived.workIn), trabajoDirecto: r4(derived.workLift), calor: r4(derived.heat),
        ventajaIdeal: r4(derived.vmIdeal), ventaja: r4(derived.vm), eficiencia: Number((derived.efficiency * 100).toFixed(1)),
        potencia: r4(derived.power),
      });
    } else {
      if (!measured || stairReadings.power === null) return;
      api.addTrial('escaleras', {
        masa: personMass, escalones: steps, ritmo: pace, masaMedida: stairReadings.m, escalon: stairReadings.step,
        altura: Number(stairReadings.hCm.toFixed(1)), tiempo: stairReadings.t,
        trabajo: Number(stairReadings.work.toFixed(1)), potencia: Number(stairReadings.power.toFixed(1)),
      });
    }
  };

  /* -------------------------------------------------- escena de la rampa */
  const sNow = RAMP.startMark + RAMP.travel * motion; // m: borde trasero del bloque
  const blockX = sNow * S;
  const dynX = blockX + BLOCK_L + 5;
  const ringX = dynX + DYN_L - 2;
  const dynForce = readings.effort !== null ? readings.effort * tension : overload ? (tension >= 1 ? DYNAMOMETER_MAX + 1 : DYNAMOMETER_MAX * tension) : 0;
  const startRef = toScreen(RAMP.startMark * S, -STRIP_T, angle);
  const nowRef = toScreen(blockX, -STRIP_T, angle);
  const clampSurfaceY = P0.y - RAMP.postDistance * S * Math.tan(rad(angle));
  const crossY = clampSurfaceY + BOARD_T / Math.cos(rad(angle)) + 5;
  const blockCenter = toScreen(blockX + BLOCK_L / 2, -STRIP_T - BLOCK_H / 2 - slots * 2.5, angle);
  const handAt = toScreen(ringX + 7, DYN_Y, angle);
  const winchAt = toScreen(BOARD_LEN + 26, -14, angle);
  const stopwatchText = fmt(phase === 'listo' || overload ? 0 : measured ? readings.t : readings.t * motion, 2);

  const rampScene = (
    <g>
      {/* soporte universal: varilla detrás de la tabla */}
      <g filter="url(#kit-shadow)">
        <rect x={POST_X - 3} y={44} width={6} height={BENCH_Y - 50} fill="url(#kit-metal-h)" />
        <path d={`M${POST_X - 38} ${BENCH_Y} L${POST_X + 30} ${BENCH_Y} L${POST_X + 24} ${BENCH_Y - 9} L${POST_X - 32} ${BENCH_Y - 9} Z`} fill="url(#kit-body-dark)" />
      </g>
      <rect x={POST_X - 9} y={crossY - 9} width={18} height={18} rx={3} fill="url(#kit-body-dark)" />
      <path d={`M${POST_X + 9} ${crossY - 3} h7 v6 h-7`} fill="#37474f" />
      <circle cx={POST_X + 18} cy={crossY} r={3.4} fill="url(#kit-metal)" stroke="#37474f" strokeWidth="0.6" />
      <circle cx={POST_X} cy={crossY} r={5.2} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.8" />

      {/* regla vertical para la altura ganada */}
      <VRuler x={RULER_X} y0={startRef.y} cm={45} caption="regla (altura)" />
      <line x1={startRef.x} x2={RULER_X} y1={startRef.y} y2={startRef.y} stroke="var(--data)" strokeWidth="0.9" strokeDasharray="3 3" />
      {motion > 0 && (
        <g>
          <line x1={nowRef.x} x2={RULER_X} y1={nowRef.y} y2={nowRef.y} stroke="var(--bad)" strokeWidth="0.9" strokeDasharray="3 3" />
          <path d={`M${RULER_X - 1} ${nowRef.y} l-7 -4 v8 Z`} fill="var(--bad)" />
        </g>
      )}

      {/* bisagra y ángulo */}
      <ContactShadow x={P0.x - 14} y={BENCH_Y} w={30} h={6} />
      <rect x={P0.x - 12} y={P0.y + 2} width={16} height={BENCH_Y - P0.y - 2} rx={2} fill="url(#kit-body-dark)" />
      {(() => {
        // Arco del ángulo entre la mesa y la cara inferior de la tabla.
        const c = { x: P0.x + BOARD_T * Math.sin(rad(angle)), y: P0.y + BOARD_T * Math.cos(rad(angle)) }, r = 74;
        return <path d={`M${c.x + r} ${c.y} A${r} ${r} 0 0 0 ${c.x + r * Math.cos(rad(angle))} ${c.y - r * Math.sin(rad(angle))}`} fill="none" stroke="var(--fis)" strokeWidth="1.4" />;
      })()}
      <text x={38} y={P0.y - 22} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fis)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>θ = {fmt(angle, 0)}°</text>

      {/* tabla, tira, bloque y dinamómetro en el marco de la rampa */}
      <g transform={`translate(${P0.x} ${P0.y}) rotate(${-angle})`}>
        <g filter="url(#kit-shadow-soft)">
          <rect x={0} y={0} width={BOARD_LEN} height={BOARD_T} rx={1.5} fill="url(#kit-wood)" stroke="#9c7a45" strokeWidth="0.8" />
        </g>
        {Array.from({ length: 101 }, (_, i) => (
          <line key={i} x1={i * PX_CM} x2={i * PX_CM} y1={BOARD_T} y2={BOARD_T - (i % 10 === 0 ? 4.5 : i % 5 === 0 ? 3 : 1.6)} stroke="#4d3b1c" strokeWidth={i % 10 === 0 ? 0.6 : 0.35} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((c) => <text key={c} x={c * PX_CM + 1} y={5} style={{ fontSize: 4.6, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{c}</text>)}
        {[RAMP.startMark, RAMP.endMark].map((m) => (
          <g key={m}>
            <rect x={m * S - 0.8} y={-STRIP_T - 8} width={1.6} height={BOARD_T + STRIP_T + 8} fill="var(--data)" />
            <text x={m * S - 3} y={-STRIP_T - 2.5} textAnchor="end" style={{ fontSize: 7.5, fill: 'var(--data)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 2.4 }}>{m === RAMP.startMark ? 'inicio' : 'fin'}</text>
          </g>
        ))}
        <StripBody id={surface} x0={0.05 * S} x1={0.95 * S} y={-STRIP_T} />
        <Block x={blockX} slots={slots} />
        <HDynamometer x0={dynX} force={dynForce} overload={overload && tension >= 1} />
        {drive === 'mano' ? <Hand x={ringX + 3} /> : (
          <g>
            <line x1={ringX + 4} x2={BOARD_LEN + 1} y1={DYN_Y} y2={DYN_Y} stroke={ROPE} strokeWidth="1.4" />
            <Winch on={phase === 'midiendo' && motion > 0} turns={motion * 140} />
          </g>
        )}
      </g>
      {/* rótulos fuera del marco rotado (siempre horizontales) */}
      {overload && tension >= 1 && (() => { const o = toScreen(dynX + DYN_L / 2, BOARD_T + 30, angle); return <text x={o.x} y={o.y} textAnchor="start" style={{ fontSize: 11, fill: 'var(--bad)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>¡Fuera de escala!</text>; })()}
      {drive === 'torno' && <text x={winchAt.x} y={winchAt.y - 30} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{fmt(motorPower, 1)} W</text>}

      {/* bandeja de tiras */}
      <g>
        <rect x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx={8} fill="var(--surface)" stroke="var(--line)" filter="url(#kit-shadow-soft)" />
        <text x={TRAY.x + 10} y={TRAY.y + 17} style={{ fontSize: 9.5, fill: 'var(--ink-2)', fontWeight: 700, letterSpacing: 0.4 }}>TIRAS PARA LA RAMPA</text>
        {SURFACES.map((s, i) => {
          const y = STRIP_ROW(i), active = s.id === surface;
          return (
            <g key={s.id} opacity={active ? 0.45 : 1}>
              <StripBody id={s.id} x0={TRAY.x + 10} x1={TRAY.x + 96} y={y - 4} h={8} />
              <text x={TRAY.x + 104} y={y + 3.5} style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: active ? 700 : 500 }}>{s.short} · μ = {fmt(s.mu, 2)}{active ? ' (puesta)' : ''}</text>
            </g>
          );
        })}
      </g>

      {/* cronómetro */}
      <Stopwatch x={636} y={34} text={stopwatchText} />
      <text x={688} y={112} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>de la marca 10 a la 70</text>

      {/* pesera con las pesas de 100 g que no están sobre el bloque */}
      <g>
        <ContactShadow x={RACK.x} y={BENCH_Y} w={RACK.w} h={6} />
        <rect x={RACK.x} y={BENCH_Y - 8} width={RACK.w} height={8} rx={2} fill="url(#kit-body-dark)" />
        {Array.from({ length: BLOCK.maxSlots }, (_, i) => {
          const px = RACK.x + 12 + i * 18.5;
          return (
            <g key={i}>
              <rect x={px - 1} y={BENCH_Y - 30} width={2} height={22} fill="url(#kit-metal-h)" />
              {i < BLOCK.maxSlots - slots && <SlotMass x={px - 8} y={BENCH_Y - 16} w={16} h={8} />}
            </g>
          );
        })}
        <text x={RACK.x + RACK.w / 2} y={BENCH_Y - 36} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontWeight: 600 }}>pesas de 100 g</text>
      </g>
    </g>
  );

  /* -------------------------------------------------- escena de la escalera */
  const run = steps * 0.28;
  const k = Math.min(240 / stairs.height, 470 / run);
  const personH = Math.min(130, 1.6 * k);
  const rise = STEP_HEIGHT * k, tread = 0.28 * k;
  const FLOOR = 404, SX = 190;
  const landingY = FLOOR - steps * rise;
  const qf = motion * steps;
  const personX = SX + Math.max(-0.4, qf - 0.5) * tread;
  const personY = FLOOR - qf * rise;
  const stairPath = (() => {
    let d = `M${SX} ${FLOOR}`;
    for (let i = 1; i <= steps; i++) d += ` V${FLOOR - i * rise} H${SX + i * tread}`;
    return `${d} H${W - 10} V${FLOOR} Z`;
  })();
  const stairScene = (
    <g>
      <rect x={0} y={0} width={W} height={FLOOR} fill="url(#tpp-wall)" />
      <rect x={0} y={FLOOR - 40} width={W} height={4} fill="#c9bfa8" />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="#b7aa8f" />
      <path d={stairPath} fill="url(#tpp-step)" stroke="#7f786c" strokeWidth="0.8" />
      {Array.from({ length: steps }, (_, i) => <line key={i} x1={SX + i * tread} x2={SX + (i + 1) * tread} y1={FLOOR - (i + 1) * rise + 0.8} y2={FLOOR - (i + 1) * rise + 0.8} stroke="#f2ede2" strokeWidth="1.2" />)}
      {/* baranda */}
      <path d={`M${SX + 4} ${FLOOR - 62} L${SX + steps * tread} ${landingY - 62} H${W - 20}`} fill="none" stroke="#546e7a" strokeWidth="3" />
      {Array.from({ length: Math.floor(steps / 3) + 1 }, (_, j) => j * 3).map((i) => (
        <line key={i} x1={SX + (i + 0.5) * tread} x2={SX + (i + 0.5) * tread} y1={FLOOR - (i + 1) * rise} y2={FLOOR - (i + 1) * rise - 60} stroke="#78909c" strokeWidth="1.6" />
      ))}
      {/* letrero del segundo piso */}
      <g>
        <rect x={150} y={14} width={176} height={42} rx={6} fill="#1d3357" />
        <text x={238} y={32} textAnchor="middle" style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }}>2.º PISO · AULAS</text>
        <text x={238} y={47} textAnchor="middle" style={{ fontSize: 9.5, fill: '#dfe8f1' }}>Colegio en Apartadó, Antioquia</text>
      </g>
      {/* cota de altura */}
      <g style={{ fontSize: 10.5, fontWeight: 700 }}>
        <line x1={SX - 26} x2={SX - 26} y1={FLOOR} y2={landingY} stroke="var(--data)" strokeWidth="1.3" />
        <path d={`M${SX - 26} ${landingY} l-3.5 6 h7 Z M${SX - 26} ${FLOOR} l-3.5 -6 h7 Z`} fill="var(--data)" />
        <line x1={SX - 34} x2={SX + steps * tread} y1={landingY} y2={landingY} stroke="var(--data)" strokeWidth="0.8" strokeDasharray="3 3" />
        <text x={SX - 32} y={(FLOOR + landingY) / 2} textAnchor="end" style={{ fill: 'var(--data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>h = {steps} × escalón</text>
      </g>
      {/* regla sobre el primer escalón */}
      <g>
        <rect x={SX + tread * 0.4} y={FLOOR - rise - 4} width={8} height={rise + 4} fill="url(#tpp-wood-v)" stroke="#b8975a" strokeWidth="0.6" />
        <text x={SX + tread * 0.4 + 12} y={FLOOR - rise / 2 + 3} style={{ fontSize: 9, fill: 'var(--ink)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{fmt(stairReadings.step, 1)} cm</text>
      </g>
      {/* báscula */}
      <g>
        <ContactShadow x={SX - 120} y={FLOOR} w={70} h={6} />
        <rect x={SX - 120} y={FLOOR - 9} width={70} height={9} rx={3} fill="url(#kit-body)" stroke="#9aa5a9" />
        <Lcd x={SX - 112} y={FLOOR - 36} w={54} h={20} text={phase === 'listo' ? fmt(stairReadings.m, 1) : '0,0'} />
        <text x={SX - 85} y={FLOOR - 40} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)', fontWeight: 700 }}>báscula (kg)</text>
      </g>
      <Student x={phase === 'listo' ? SX - 85 : personX} y={phase === 'listo' ? FLOOR - 9 : personY} stride={phase === 'listo' ? 0 : qf * Math.PI} h={personH} />
      <Stopwatch x={20} y={24} text={fmt(phase === 'listo' ? 0 : measured ? stairReadings.t : stairReadings.t * motion, 2)} />
    </g>
  );

  /* -------------------------------------------------- descripción accesible */
  const desc = exp === 'rampa'
    ? `Rampa de 1 m a ${fmt(angle, 0)}° sobre una tira de ${surf.short.toLowerCase()}, bloque de ${fmt(mass * 1000, 0)} g ` +
      `${drive === 'mano' ? `jalado con la mano a ${fmt(handSpeed, 2)} m/s` : `jalado por un torno de ${fmt(motorPower, 1)} W`} con un dinamómetro paralelo a la rampa. ` +
      (measured ? (readings.effort === null ? 'El dinamómetro se sale de la escala.' : `El dinamómetro marca ${N(readings.effort)}; el bloque subió ${fmt(readings.hCm, 1)} cm en ${fmt(readings.t, 2)} s.`) : 'Aún no se ha medido.')
    : `Escalera de ${steps} escalones hasta el segundo piso de un colegio en Apartadó; una persona de ${fmt(personMass, 0)} kg sube a ${fmt(pace, 1)} escalones por segundo. ` +
      (measured ? `El cronómetro marca ${fmt(stairReadings.t, 2)} s.` : 'Aún no se ha cronometrado.');

  const busy = phase === 'midiendo' || phase === 'pausa';
  const simStatus = simStatusOf(phase === 'midiendo', phase === 'pausa', measured);
  const pauseRun = () => { cancelAnimationFrame(raf.current); setPhase('pausa'); };
  const resumeRun = () => setPhase('midiendo');
  const canRecord = measured && (exp === 'rampa' ? derived !== null : stairReadings.power !== null);

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo del plano inclinado">
          <ManipScene viewBox={`0 0 ${W} ${H}`} label={exp === 'rampa' ? 'Controles de la rampa' : 'Escena de la escalera'} scene={
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="tpp-t tpp-d">
              <title id="tpp-t">{exp === 'rampa' ? 'Rampa con bloque, pesas, dinamómetro, regla y cronómetro' : 'Escalera del colegio con báscula, regla y cronómetro'}</title>
              <desc id="tpp-d">{desc}</desc>
              <WorkDefs />
              {exp === 'rampa' && <BenchTop y={BENCH_Y} width={W} />}
              {exp === 'rampa' ? rampScene : stairScene}
            </svg>}>
            {exp === 'rampa' && (
              <>
                <DragHandle label="Pinza del soporte: ángulo de la rampa" value={angle} min={WORK_LIMITS.angle[0]} max={WORK_LIMITS.angle[1]} step={1} pageStep={5}
                  unit="°" decimals={0} disabled={busy} orientation="vertical"
                  hit={{ cx: POST_X, cy: crossY, r: 14 }}
                  valueFromPoint={({ point, start, startValue }) => {
                    // Arrastre relativo: la cara de la tabla sobre el soporte sigue al puntero sin saltar.
                    const y = P0.y - RAMP.postDistance * S * Math.tan(rad(startValue)) + (point.y - start.y);
                    return Math.round((Math.atan2(P0.y - y, RAMP.postDistance * S) * 180) / Math.PI);
                  }}
                  onChange={changeAngle} />
                <DragHandle label="Bandeja de tiras: superficie puesta en la rampa" value={surfIndex} min={0} max={SURFACES.length - 1} step={1} pageStep={1} commit="end" disabled={busy}
                  hit={{ x: TRAY.x, y: TRAY.y + 20, w: TRAY.w, h: TRAY.h - 20 }}
                  valueText={(v) => `${SURFACES[v].name} (μ = ${fmt(SURFACES[v].mu, 2)})`}
                  valueFromPoint={({ point, start }) => {
                    const b = nearBoard(point, angle);
                    return b.along > 0 && b.along < BOARD_LEN && Math.abs(b.across) < 50 ? zoneAt(start.y, STRIP_EDGES) : surfIndex;
                  }}
                  onChange={(v) => changeSurface(SURFACES[v].id)}>
                  {({ dragging, point }) => {
                    if (!dragging || !point) { stripPick.current = null; return null; }
                    if (stripPick.current === null) stripPick.current = zoneAt(point.y, STRIP_EDGES);
                    const pick = SURFACES[stripPick.current];
                    const b = nearBoard(point, angle);
                    const over = b.along > 0 && b.along < BOARD_LEN && Math.abs(b.across) < 50;
                    return (
                      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                        <g transform={`translate(${P0.x} ${P0.y}) rotate(${-angle})`}>
                          <rect x={0.05 * S - 6} y={-STRIP_T - 10} width={0.9 * S + 12} height={20} rx={6} fill="var(--accent)" opacity={over ? 0.18 : 0.05} />
                        </g>
                        <StripBody id={pick.id} x0={point.x - 50} x1={point.x + 50} y={point.y - 4} h={8} />
                      </g>
                    );
                  }}
                </DragHandle>
                <DragHandle label="Pesera: poner una pesa de 100 g sobre el bloque" value={slots} min={0} max={BLOCK.maxSlots} step={1} pageStep={1} commit="end" disabled={busy}
                  hit={{ x: RACK.x, y: RACK.y, w: RACK.w, h: RACK.h }}
                  valueText={(v) => `${v} ${v === 1 ? 'pesa' : 'pesas'} sobre el bloque: ${fmt(blockMass(v) * 1000, 0)} g`}
                  valueFromPoint={({ point }) => (Math.hypot(point.x - blockCenter.x, point.y - blockCenter.y) < 55 ? Math.min(BLOCK.maxSlots, slots + 1) : slots)}
                  onChange={changeSlots}>
                  {({ dragging, point }) => dragging && point && slots < BLOCK.maxSlots && (
                    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                      <circle cx={blockCenter.x} cy={blockCenter.y} r={42} fill="var(--accent)" opacity={Math.hypot(point.x - blockCenter.x, point.y - blockCenter.y) < 55 ? 0.18 : 0.06} />
                      <SlotMass x={point.x - 17} y={point.y - 3} />
                    </g>
                  )}
                </DragHandle>
                <DragHandle label="Bloque: quitar una pesa y devolverla a la pesera" value={slots} min={0} max={BLOCK.maxSlots} step={1} pageStep={1} commit="end" disabled={busy}
                  hit={{ x: blockCenter.x - 30, y: blockCenter.y - 26, w: 60, h: 46 }}
                  valueText={(v) => `${v} ${v === 1 ? 'pesa' : 'pesas'} sobre el bloque: ${fmt(blockMass(v) * 1000, 0)} g`}
                  valueFromPoint={({ point }) => (Math.hypot(point.x - blockCenter.x, point.y - blockCenter.y) > 70 ? Math.max(0, slots - 1) : slots)}
                  onChange={changeSlots}>
                  {({ dragging, point }) => dragging && point && slots > 0 && (
                    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                      <rect x={RACK.x - 4} y={RACK.y - 4} width={RACK.w + 8} height={RACK.h + 8} rx={8} fill="var(--accent)" opacity="0.1" />
                      <SlotMass x={point.x - 17} y={point.y - 3} />
                    </g>
                  )}
                </DragHandle>
                <DragHandle label={drive === 'mano' ? 'Mano: jalar el dinamómetro rampa arriba' : 'Interruptor del torno: encender'} value={phase === 'listo' ? 0 : 1} min={0} max={1} step={1} pageStep={1}
                  commit="end" disabled={busy}
                  hit={drive === 'mano' ? { cx: handAt.x, cy: handAt.y, r: 16 } : { cx: winchAt.x, cy: winchAt.y, r: 18 }}
                  valueText={(v) => (v ? 'Subida medida' : 'Listo para medir')}
                  valueFromPoint={({ point, start }) => {
                    if (drive === 'torno') return 1;
                    const a = nearBoard(start, angle).along, b = nearBoard(point, angle).along;
                    return b - a > 25 ? 1 : phase === 'listo' ? 0 : 1;
                  }}
                  onChange={(v) => (v === 1 ? startMeasure() : reset())} />
              </>
            )}
          </ManipScene>
        </div>
        {exp === 'rampa' && <ManipHint>Arrastra la pinza del soporte para cambiar el ángulo, una tira de la bandeja a la rampa, pesas de la pesera al bloque (o del bloque a la pesera) y la mano rampa arriba para medir; también puedes enfocarlos con Tab y usar las flechas.</ManipHint>}

        {exp === 'rampa' ? (
          <>
            <div className="grid-2">
              <div className="stack">
                <h3>Dinamómetro (0,1 N)</h3>
                <Readout items={[
                  { k: 'Peso del bloque m·g', v: show(N(readings.weight)), data: true },
                  { k: 'Fuerza paralela F', v: show(readings.effort === null ? 'fuera de escala (más de 10 N)' : N(readings.effort)), data: true },
                  { k: 'Ventaja mecánica real m·g/F', v: show(derived ? fmt(derived.vm, 2) : '—') },
                ]} />
                <h3>Regla y cronómetro</h3>
                <Readout items={[
                  { k: 'Recorrido sobre la rampa d', v: show(`${fmt(readings.dCm, 1)} cm`), data: true },
                  { k: 'Altura ganada h', v: show(overload ? '—' : `${fmt(readings.hCm, 1)} cm`), data: true },
                  { k: 'Ventaja mecánica ideal d/h', v: show(derived ? fmt(derived.vmIdeal, 2) : '—') },
                  { k: 'Tiempo de subida t', v: show(overload ? '—' : `${fmt(readings.t, 2)} s`), data: true },
                ]} />
              </div>
              <div className="stack">
                <h3>Trabajo, energía y potencia</h3>
                <Readout items={[
                  { k: 'Trabajo de entrada F·d', v: show(derived ? J(derived.workIn) : '—'), data: true },
                  { k: 'Trabajo para subirlo derecho m·g·h', v: show(derived ? J(derived.workLift) : '—'), data: true },
                  { k: 'Calor por rozamiento', v: show(derived ? J(derived.heat) : '—') },
                  { k: 'Eficiencia', v: show(derived ? `${fmt(derived.efficiency * 100, 1)} %` : '—') },
                  { k: 'Potencia W/t', v: show(derived ? `${fmt(derived.power, 2)} W` : '—'), data: true },
                ]} />
                {measured && derived
                  ? <EnergyDiagram workIn={derived.workIn} lift={derived.workLift} heat={derived.heat} />
                  : <p className="small muted">Mide la subida para ver el diagrama de energía: cómo se reparte el trabajo de entrada.</p>}
              </div>
            </div>
            {measured && overload && <Notice kind="warn">La fuerza necesaria supera los 10 N del dinamómetro. Quita pesas, baja el ángulo o cambia a una superficie más lisa.</Notice>}
            {measured && drive === 'torno' && ramp.motorLimited && <Notice>El torno llegó a su rapidez máxima ({fmt(MOTOR_MAX_SPEED, 2)} m/s): con tan poca fuerza no alcanza a usar toda su potencia nominal.</Notice>}
          </>
        ) : (
          <div className="grid-2">
            <div className="stack">
              <h3>Báscula, regla y cronómetro</h3>
              <Readout items={[
                { k: 'Masa de la persona (báscula)', v: `${fmt(stairReadings.m, 1)} kg`, data: true },
                { k: 'Altura de un escalón (regla)', v: `${fmt(stairReadings.step, 1)} cm`, data: true },
                { k: 'Altura total h', v: `${fmt(stairReadings.hCm, 1)} cm` },
                { k: 'Tiempo de subida (cronómetro)', v: show(`${fmt(stairReadings.t, 2)} s`), data: true },
              ]} />
            </div>
            <div className="stack">
              <h3>Trabajo y potencia</h3>
              <Readout items={[
                { k: 'Trabajo para subir el cuerpo m·g·h', v: `${fmt(stairReadings.work, 0)} J`, data: true },
                { k: 'Potencia útil P = W/t', v: show(stairReadings.power === null ? '—' : `${fmt(stairReadings.power, 0)} W`), data: true },
                { k: 'Potencia que gastan los músculos (η ≈ 25 %)', v: show(stairReadings.power === null ? '—' : `${fmt(stairReadings.power / 0.25, 0)} W`) },
              ]} />
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Segmented<Experiment> label="Actividad" value={exp} onChange={setExp}
            options={[{ value: 'rampa', label: 'Rampa con bloque' }, { value: 'escalera', label: 'Escalera del colegio' }]} />
          {exp === 'rampa' ? (
            <>
              <Slider label="Ángulo de la rampa" value={angle} min={WORK_LIMITS.angle[0]} max={WORK_LIMITS.angle[1]} step={1} unit="°" decimals={0} onChange={changeAngle} />
              <Slider label="Pesas de 100 g sobre el bloque" value={slots} min={0} max={BLOCK.maxSlots} step={1} decimals={0} onChange={changeSlots}
                hint={`Masa total: bloque de 300 g + pesas = ${fmt(mass * 1000, 0)} g.`} />
              <Segmented<SurfaceId> label="Superficie de la rampa" value={surface} onChange={changeSurface}
                options={SURFACES.map((s) => ({ value: s.id, label: s.short }))} />
              <p className="small muted">{surf.name}: μ ≈ {fmt(surf.mu, 2)}. {surf.note}</p>
              <Segmented<Drive> label="Forma de jalar" value={drive} onChange={setDrive}
                options={[{ value: 'mano', label: 'Con la mano' }, { value: 'torno', label: 'Con un torno' }]} />
              {drive === 'mano' ? (
                <Slider label="Rapidez de la mano" value={handSpeed} min={WORK_LIMITS.handSpeed[0]} max={WORK_LIMITS.handSpeed[1]} step={0.05} unit="m/s" decimals={2} onChange={setHandSpeed}
                  hint="Se jala siempre con velocidad constante." />
              ) : (
                <Slider label="Potencia del torno" value={motorPower} min={WORK_LIMITS.motorPower[0]} max={WORK_LIMITS.motorPower[1]} step={0.1} unit="W" decimals={1} onChange={setMotorPower}
                  hint={`La cuerda avanza a P/F, hasta ${fmt(MOTOR_MAX_SPEED, 2)} m/s.`} />
              )}
              <SimControls title="Subida por la rampa" status={simStatus} startLabel="Medir subida por la rampa" repeatLabel="Medir de nuevo" resetLabel="Reiniciar medición"
                onStart={startMeasure} onPause={pauseRun} onResume={resumeRun} onReset={reset} />
            </>
          ) : (
            <>
              <Slider label="Masa de la persona" value={personMass} min={WORK_LIMITS.personMass[0]} max={WORK_LIMITS.personMass[1]} step={1} unit="kg" decimals={0} onChange={setPersonMass} />
              <Slider label="Escalones hasta el segundo piso" value={steps} min={WORK_LIMITS.steps[0]} max={WORK_LIMITS.steps[1]} step={1} decimals={0} onChange={setSteps}
                hint={`Cada escalón mide unos ${fmt(STEP_HEIGHT * 100, 0)} cm.`} />
              <Slider label="Ritmo de subida" value={pace} min={WORK_LIMITS.pace[0]} max={WORK_LIMITS.pace[1]} step={0.1} unit="escalones/s" decimals={1} onChange={setPace}
                hint="Caminando: 1 a 2 escalones/s; corriendo: 3 a 4." />
              <SimControls title="Subida por la escalera" status={simStatus} startLabel="Subir la escalera y cronometrar" repeatLabel="Subir de nuevo" resetLabel="Reiniciar medición"
                onStart={startMeasure} onPause={pauseRun} onResume={resumeRun} onReset={reset} />
            </>
          )}
          <RecordButton onRecord={record} disabled={!canRecord} />
          {!measured && <p className="small muted">{exp === 'rampa' ? 'Mide con el dinamómetro, la regla y el cronómetro para poder guardar el ensayo.' : 'Cronometra la subida para poder guardar el ensayo.'}</p>}
        </div>
        <Notice>{real
          ? 'Instrumento real: cada lectura del dinamómetro, la regla, la báscula y el cronómetro incluye un error aleatorio típico. Pulsa «Reiniciar medición» y vuelve a medir para estimar la dispersión.'
          : 'Supuestos: velocidad constante, dinamómetro paralelo a la rampa, rozamiento cinético con μ constante y g = 9,8 m/s². No se incluyen el arranque ni la resistencia del aire.'}</Notice>
      </div>
    </div>
  );
}

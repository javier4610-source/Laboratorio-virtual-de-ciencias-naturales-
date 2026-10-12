import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BAR, DYNAMOMETER_MAX, LEVER_CLASSES, LEVER_TILT_DEG, MACHINE_INSTRUMENTS, MACHINE_LIMITS, PULLEY_SETUPS, armRange,
  leverOrderError, sheaveCounts, simulateLever, simulatePulley, type LeverClass, type MachineInstrumentSpec, type PulleySetup,
} from '../models/simpleMachines';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { useMeasure } from '../components/Measurement';
import { Notice, Readout, RecordButton, Segmented, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop } from './kit';
import { ManipHint, ManipScene, Plunger } from './manipulate';

/* ------------------------------------------------------------------ instrumentos */

/** Ficha del instrumento: la de src/labs/instruments.ts si ya está integrada; si no, la del modelo (respaldo local). */
function instrumentSpec(id: 'dinamometro' | 'regla'): MachineInstrumentSpec {
  return INSTRUMENTS.maquinas?.find((i) => i.id === id) ?? MACHINE_INSTRUMENTS[id];
}

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 760, H = 440;
const BENCH_Y = 410;
const ROPE = '#b98a4a';
const ROPE_DARK = '#7d5a2b';
const DUR = 1700; // ms de la animación de medición

/* Palanca: 5,6 px por cm; la marca 0 cm de la barra está en x = 100. */
const PXC = 5.6;
const BAR_X0 = 100;
const barX = (cm: number) => BAR_X0 + cm * PXC;
const barRestY = (cls: LeverClass) => (cls === 1 ? 196 : 250);

/* Poleas: 2,4 px por cm de cuerda. */
const PXP = 2.4;
const CROSS_Y = 44;
const UPPER_Y = 98;
const DYN_LEN = 120;

type Machine = 'palanca' | 'poleas';
type Phase = 'listo' | 'midiendo' | 'medido';

function MachineDefs() {
  return (
    <defs>
      <linearGradient id="maq-brass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#8f6a14" />
        <stop offset="0.3" stopColor="#efce74" />
        <stop offset="0.62" stopColor="#c69a2f" />
        <stop offset="1" stopColor="#7f5d10" />
      </linearGradient>
      <linearGradient id="maq-scale" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fffdf3" />
        <stop offset="1" stopColor="#ece6cf" />
      </linearGradient>
      <linearGradient id="maq-wood-v" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#f3dda2" />
        <stop offset="1" stopColor="#ddb96c" />
      </linearGradient>
      <radialGradient id="maq-sheave" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#f4f7f8" />
        <stop offset="0.6" stopColor="#b9c4c8" />
        <stop offset="1" stopColor="#8a979c" />
      </radialGradient>
    </defs>
  );
}

/* ------------------------------------------------------------------ piezas locales */

/**
 * Dinamómetro de resorte (0 a 10 N). El gancho está en (x, hookY); `dir` = 1 si el anillo queda arriba del gancho
 * y −1 si queda abajo. El indicador rojo baja hacia el gancho a medida que el resorte se estira.
 */
function SpringScale({ x, hookY, dir, force, overload }: { x: number; hookY: number; dir: 1 | -1; force: number; overload: boolean }) {
  const y = (t: number) => hookY - dir * t;
  const zeroT = DYN_LEN - 22, perN = 7;
  const shown = overload ? DYNAMOMETER_MAX + 0.3 : Math.max(0, Math.min(DYNAMOMETER_MAX, force));
  const tp = zeroT - perN * shown;
  const bodyA = Math.min(y(16), y(DYN_LEN - 12)), bodyB = Math.max(y(16), y(DYN_LEN - 12));
  const spring = (() => {
    const a = tp + 2, b = DYN_LEN - 14, turns = 12;
    let d = `M${x + 2} ${y(a)}`;
    for (let i = 1; i <= turns; i++) d += ` L${x + 2 + (i % 2 ? -3.5 : 3.5)} ${y(a + ((b - a) * i) / turns)}`;
    return d;
  })();
  const ticks = Array.from({ length: 21 }, (_, i) => i * 0.5);
  return (
    <g>
      {/* gancho y varilla */}
      <path d={`M${x} ${y(16)} L${x} ${y(7)} Q${x + 6} ${y(4)} ${x + 3} ${y(0)} Q${x} ${y(-2)} ${x - 3} ${y(1.5)}`} fill="none" stroke="#5d6b70" strokeWidth="2" strokeLinecap="round" />
      <line x1={x} x2={x} y1={y(10)} y2={y(tp)} stroke="url(#kit-metal-h)" strokeWidth="3" />
      {/* tubo transparente con la escala */}
      <g filter="url(#kit-shadow-soft)">
        <rect x={x - 11} y={bodyA} width={22} height={bodyB - bodyA} rx={4} fill="url(#maq-scale)" stroke="#9aa5a9" />
      </g>
      {ticks.map((n) => {
        const ty = y(zeroT - perN * n), major = n % 2 === 0;
        return (
          <g key={n}>
            <line x1={x + 11} x2={x + 11 - (major ? 7 : n % 1 === 0 ? 5 : 3)} y1={ty} y2={ty} stroke="#2b3436" strokeWidth={major ? 0.9 : 0.6} />
            {major && <text x={x - 9.5} y={ty + 2.6} style={{ fontSize: 6.5, fill: '#2b3436', fontFamily: 'var(--font-data)' }}>{n}</text>}
          </g>
        );
      })}
      <path d={spring} fill="none" stroke="#7d8a8f" strokeWidth="1" strokeLinejoin="round" opacity="0.9" />
      <rect x={x - 9} y={y(tp) - 1.4} width={18} height={2.8} rx={1} fill={overload ? 'var(--bad)' : '#d32f2f'} />
      <rect x={x - 11} y={bodyA} width={22} height={bodyB - bodyA} rx={4} fill="url(#kit-glass)" opacity="0.7" />
      {/* tapas metálicas y anillo */}
      <rect x={x - 12} y={y(16) - 3} width={24} height={6} rx={2} fill="url(#kit-metal)" stroke="#8c979b" strokeWidth="0.6" />
      <rect x={x - 12} y={y(DYN_LEN - 12) - 3} width={24} height={6} rx={2} fill="url(#kit-metal)" stroke="#8c979b" strokeWidth="0.6" />
      <circle cx={x} cy={y(DYN_LEN - 5)} r={5.5} fill="none" stroke="url(#kit-metal-h)" strokeWidth="2.6" />
      <circle cx={x} cy={y(DYN_LEN - 5)} r={5.5} fill="none" stroke="#7d8a8f" strokeWidth="0.6" />
      <text x={x} y={y((DYN_LEN - 12 + 16) / 2) + (dir === 1 ? -36 : 36)} textAnchor="middle" style={{ fontSize: 6, fill: '#55605f', fontWeight: 700 }} transform={`rotate(-90 ${x} ${y((DYN_LEN - 12 + 16) / 2) + (dir === 1 ? -36 : 36)})`}>N</text>
    </g>
  );
}

/** Flecha de la fuerza que hace la mano sobre el anillo del dinamómetro. */
function PullArrow({ x, y, dir, label, left = false }: { x: number; y: number; dir: 1 | -1; label: string; left?: boolean }) {
  const len = 22, end = y - dir * len;
  return (
    <g>
      <line x1={x} x2={x} y1={y} y2={end + dir * 7} stroke="var(--fis)" strokeWidth="3" />
      <path d={`M${x} ${end} l-5 ${dir * 8} h10 Z`} fill="var(--fis)" />
      <text x={left ? x - 9 : x + 9} y={(y + end) / 2 + 4} textAnchor={left ? 'end' : 'start'} style={{ fontSize: 12, fill: 'var(--fis)', fontWeight: 700 }}>{label}</text>
    </g>
  );
}

/** Distancia (px) del gancho del portapesas a la cara inferior de su base. */
function hangerDepth(grams: number) {
  const full = Math.floor(grams / 100 + 1e-9), half = grams - full * 100 >= 50 - 1e-6 ? 1 : 0;
  return 14 + Math.max(full * 5.4 + half * 5.4 * 0.55, 10) + 4;
}

/** Taco de madera sobre la mesa en el que descansa la carga antes de medir. */
function WoodBlock({ x, top }: { x: number; top: number }) {
  if (BENCH_Y - top < 3) return null;
  return (
    <g filter="url(#kit-shadow-soft)">
      <rect x={x - 24} y={top} width={48} height={BENCH_Y - top} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
      <path d={`M${x - 20} ${top + (BENCH_Y - top) * 0.4} q20 -3 40 1`} fill="none" stroke="#c9a463" strokeWidth="0.8" />
    </g>
  );
}

/** Tope de seguridad: sostiene el extremo de la barra mientras el dinamómetro no hace fuerza. */
function BarStop({ x, top }: { x: number; top: number }) {
  return (
    <g filter="url(#kit-shadow-soft)">
      <rect x={x - 3} y={top + 6} width={6} height={BENCH_Y - top - 12} fill="url(#kit-metal-h)" />
      <rect x={x - 6} y={top} width={12} height={7} rx={2} fill="#37474f" />
      <path d={`M${x - 18} ${BENCH_Y} L${x + 18} ${BENCH_Y} L${x + 13} ${BENCH_Y - 7} L${x - 13} ${BENCH_Y - 7} Z`} fill="url(#kit-body-dark)" />
    </g>
  );
}

/** Portapesas con pesas ranuradas de latón; el gancho superior queda en (x, y). */
function MassHanger({ x, y, grams, extra }: { x: number; y: number; grams: number; extra?: string }) {
  const full = Math.floor(grams / 100 + 1e-9), half = grams - full * 100 >= 50 - 1e-6 ? 1 : 0;
  const th = 5.4;
  const stackH = full * th + half * th * 0.55;
  const plateY = y + 14 + Math.max(stackH, 10);
  const discs: { y: number; h: number }[] = [];
  let cy = plateY;
  for (let i = 0; i < full; i++) { cy -= th; discs.push({ y: cy, h: th - 0.6 }); }
  if (half) { cy -= th * 0.55; discs.push({ y: cy, h: th * 0.55 - 0.5 }); }
  return (
    <g>
      <path d={`M${x} ${y} q5 2 3 6 q-2 3 -3 3`} fill="none" stroke="#5d6b70" strokeWidth="1.8" strokeLinecap="round" />
      <line x1={x} x2={x} y1={y + 8} y2={plateY} stroke="url(#kit-metal-h)" strokeWidth="2.6" />
      {discs.map((d, i) => (
        <g key={i}>
          <rect x={x - 15} y={d.y} width={30} height={d.h} rx={1.4} fill="url(#maq-brass)" stroke="#6f520f" strokeWidth="0.4" />
        </g>
      ))}
      <rect x={x - 16} y={plateY} width={32} height={4} rx={1.5} fill="url(#kit-body-dark)" />
      {/* etiqueta de papel (legible en tema claro y oscuro) */}
      <rect x={x - (extra ? 44 : 22)} y={plateY + 5} width={extra ? 88 : 44} height={extra ? 27 : 15} rx={3} fill="#fffdf3" stroke="#b8975a" strokeWidth="0.7" />
      <text x={x} y={plateY + 16} textAnchor="middle" style={{ fontSize: 10.5, fill: '#2b2412', fontWeight: 700 }}>{fmt(grams, 0)} g</text>
      {extra && <text x={x} y={plateY + 28} textAnchor="middle" style={{ fontSize: 8.5, fill: '#4d3b1c' }}>{extra}</text>}
    </g>
  );
}

/** Regla vertical de madera: el cero está en y0 y la escala crece en el sentido `dir` (−1 hacia arriba, 1 hacia abajo). */
function VRuler({ x, y0, cm, pxPerCm, dir, labelEvery, caption, align = 'middle' }: {
  x: number; y0: number; cm: number; pxPerCm: number; dir: 1 | -1; labelEvery: number; caption: string; align?: 'start' | 'middle' | 'end';
}) {
  const yEnd = y0 + dir * cm * pxPerCm;
  const top = Math.min(y0, yEnd) - 5, h = Math.abs(yEnd - y0) + 10;
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x} y={top} width={16} height={h} rx={2} fill="url(#maq-wood-v)" stroke="#b8975a" strokeWidth="0.8" />
      </g>
      {Array.from({ length: cm + 1 }, (_, i) => {
        const ty = y0 + dir * i * pxPerCm;
        const major = i % labelEvery === 0, mid = !major && i % 5 === 0;
        return (
          <g key={i}>
            <line x1={x} x2={x + (major ? 7 : mid ? 5 : 3)} y1={ty} y2={ty} stroke="#4d3b1c" strokeWidth={major ? 0.9 : 0.5} />
            {major && i > 0 && <text x={x + 15} y={ty + 2.8} textAnchor="end" style={{ fontSize: 7, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{i}</text>}
          </g>
        );
      })}
      <line x1={x - 4} x2={x + 16} y1={y0} y2={y0} stroke="var(--data)" strokeWidth="1.2" strokeDasharray="2 2" />
      <text x={align === 'start' ? x : align === 'end' ? x + 16 : x + 8} y={top - 5} textAnchor={align} style={{ fontSize: 9, fill: 'var(--ink-2)', fontWeight: 600 }}>{caption}</text>
    </g>
  );
}

/** Marca roja que señala en la regla la posición actual del punto que se mueve (se dibuja encima de todo). */
function RulerMark({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 1} ${y} l-7 -4 v8 Z`} fill="var(--bad)" />
      <line x1={x - 1} x2={x + 16} y1={y} y2={y} stroke="var(--bad)" strokeWidth="1.3" />
    </g>
  );
}

/** Polea: rueda metálica con canal y eje. */
function Sheave({ cx, cy, r, angle = 0 }: { cx: number; cy: number; r: number; angle?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 1.5} fill="#5d6b70" />
      <circle cx={cx} cy={cy} r={r - 1} fill="url(#maq-sheave)" stroke="#6b787c" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r={Math.max(2, r * 0.62)} fill="none" stroke="#8a979c" strokeWidth="0.8" />
      {r > 14 && [0, 120, 240].map((a) => {
        const t = ((a + angle) * Math.PI) / 180;
        return <circle key={a} cx={cx + Math.cos(t) * r * 0.38} cy={cy + Math.sin(t) * r * 0.38} r={r * 0.11} fill="#7d8a8f" />;
      })}
      <circle cx={cx} cy={cy} r={Math.max(1.6, r * 0.16)} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />
    </g>
  );
}

/** Tarjeta con un ejemplo de la vida diaria en Urabá. */
function ExampleCard({ x, y, title, lines, children }: { x: number; y: number; title: string; lines: string[]; children: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={150} height={104} rx={8} fill="var(--surface)" stroke="var(--line)" filter="url(#kit-shadow-soft)" />
      <text x={x + 10} y={y + 16} style={{ fontSize: 9.5, fill: 'var(--ink-2)', fontWeight: 700, letterSpacing: 0.4 }}>EN URABÁ</text>
      <g transform={`translate(${x + 10} ${y + 22})`}>{children}</g>
      <text x={x + 10} y={y + 82} style={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 700 }}>{title}</text>
      {lines.map((l, i) => <text key={i} x={x + 10} y={y + 95 + i * 11} style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>{l}</text>)}
    </g>
  );
}

/** Ilustraciones de los ejemplos (130 × 50, origen en la esquina superior izquierda). */
function ExampleIcon({ kind }: { kind: 'c1' | 'c2' | 'c3' | 'fija' | 'garrucha' }) {
  if (kind === 'c1') return (
    <g>
      <ellipse cx={62} cy={40} rx={12} ry={9} fill="#8d6e4a" stroke="#5e4630" />
      <ellipse cx={62} cy={40} rx={5} ry={4} fill="#b48a5c" />
      <path d="M14 44 q6 -12 20 -8 q8 4 4 12 Z" fill="#8a9499" stroke="#5d6b70" />
      <path d="M26 36 L100 22" stroke="#9aa6ab" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 36 L100 22" stroke="#dfe6e8" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M100 22 L122 18" stroke="#4e342e" strokeWidth="5" strokeLinecap="round" />
      <path d="M118 2 v10 m-4 -4 l4 5 l4 -5" fill="none" stroke="var(--fis)" strokeWidth="2" />
    </g>
  );
  if (kind === 'c2') return (
    <g>
      <circle cx={22} cy={38} r={10} fill="#37474f" />
      <circle cx={22} cy={38} r={3.5} fill="url(#kit-metal)" />
      <path d="M14 18 L70 18 L62 34 L24 34 Z" fill="#43a047" stroke="#2e5d34" />
      <path d="M30 14 q8 -8 18 -2 q8 -6 14 2 Z" fill="#7b5e3b" />
      <path d="M62 30 L120 18" stroke="#6d4c41" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 34 L56 46" stroke="#37474f" strokeWidth="2.5" />
      <path d="M118 6 v10 m-4 -5 l4 -6 l4 6" fill="none" stroke="var(--fis)" strokeWidth="2" />
    </g>
  );
  if (kind === 'c3') return (
    <g>
      <circle cx={14} cy={26} r={5} fill="url(#kit-metal)" stroke="#5d6b70" />
      <path d="M14 22 L112 14 L114 20 L16 26" fill="url(#kit-metal)" stroke="#6b787c" />
      <path d="M14 30 L112 38 L114 32 L16 26" fill="url(#kit-metal)" stroke="#6b787c" />
      <rect x={110} y={19} width={14} height={14} rx={3} fill="#cfe9f5" stroke="#7fb3c9" />
      <path d="M52 6 v10 M52 46 v-10" stroke="var(--fis)" strokeWidth="2" />
      <path d="M48 12 l4 5 l4 -5 M48 40 l4 -5 l4 5" fill="none" stroke="var(--fis)" strokeWidth="2" />
    </g>
  );
  if (kind === 'fija') return (
    <g>
      <rect x={28} y={34} width={56} height={16} rx={2} fill="#a1887f" stroke="#6d4c41" />
      <path d="M28 40 h56 M42 34 v6 M62 34 v6 M52 40 v10 M72 40 v10" stroke="#6d4c41" strokeWidth="0.8" />
      <path d="M34 34 V4 M78 34 V4 M30 4 H82" stroke="#6d4c41" strokeWidth="3" />
      <circle cx={56} cy={10} r={6} fill="url(#maq-sheave)" stroke="#5d6b70" />
      <path d="M50 10 V30 M62 10 V26" stroke={ROPE} strokeWidth="1.4" />
      <path d="M45 30 h10 l-1 8 h-8 Z" fill="#78909c" />
      <path d="M100 12 v14 m-4 -5 l4 6 l4 -6" fill="none" stroke="var(--fis)" strokeWidth="2" />
    </g>
  );
  return (
    <g>
      <path d="M20 4 H110" stroke="#6b787c" strokeWidth="3" />
      <circle cx={64} cy={10} r={5} fill="url(#maq-sheave)" stroke="#5d6b70" />
      <path d="M59 10 V22 M69 10 V22" stroke={ROPE} strokeWidth="1.2" />
      <circle cx={64} cy={24} r={5} fill="url(#maq-sheave)" stroke="#5d6b70" />
      <path d="M64 29 V33" stroke="#6d4c41" strokeWidth="2" />
      <path d="M53 34 Q64 30 75 34 L71 47 Q64 52 57 47 Z" fill="#8bc34a" stroke="#33691e" strokeWidth="0.8" />
      {[37, 41, 45].map((yy) => <path key={yy} d={`M${54 + (yy - 34) * 0.3} ${yy} Q64 ${yy + 3} ${74 - (yy - 34) * 0.3} ${yy}`} fill="none" stroke="#558b2f" strokeWidth="0.9" />)}
      <path d="M64 49 V53" stroke="#6d4c41" strokeWidth="1.6" />
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

const CLASS_DEFAULTS: Record<LeverClass, { dR: number; dF: number }> = { 1: { dR: 20, dF: 40 }, 2: { dR: 20, dF: 60 }, 3: { dR: 60, dF: 20 } };
const CLASS_KEYS = ['1', '2', '3'] as const;

export default function MachinesLab({ api }: LabProps) {
  const [machine, setMachine] = useState<Machine>('palanca');
  const [massG, setMassG] = useState(400);
  const [cls, setCls] = useState<LeverClass>(1);
  const [dR, setDR] = useState(20); // cm
  const [dF, setDF] = useState(40); // cm
  const [barMass, setBarMass] = useState<'no' | 'si'>('no');
  const [setup, setSetup] = useState<PulleySetup>('movil');
  const [strands, setStrands] = useState(4);
  const [blockG, setBlockG] = useState(0);
  const [eta, setEta] = useState(1);
  const [ropeCm, setRopeCm] = useState(40);
  const [phase, setPhase] = useState<Phase>('listo');
  const [p, setP] = useState(0);
  const raf = useRef(0);

  const orderError = machine === 'palanca' ? leverOrderError(cls, dR / 100, dF / 100) : null;
  const lever = useMemo(
    () => (orderError ? null : simulateLever({ cls, loadMass: massG / 1000, dR: dR / 100, dF: dF / 100, barMass: barMass === 'si' })),
    [cls, massG, dR, dF, barMass, orderError],
  );
  const pulley = useMemo(
    () => simulatePulley({ setup, strands, loadMass: massG / 1000, blockMass: blockG / 1000, efficiency: eta, rope: ropeCm / 100 }),
    [setup, strands, massG, blockG, eta, ropeCm],
  );

  // Lecturas: en modo ideal coinciden con el modelo redondeado; en modo real llevan el error aleatorio de la ficha.
  const { measure, remeasure, real } = useMeasure();
  const readings = useMemo(() => {
    const dyn = instrumentSpec('dinamometro'), rul = instrumentSpec('regla');
    if (machine === 'palanca') {
      if (!lever) return null;
      return {
        load: measure(lever.R, { ...dyn, key: 'carga' }),
        effort: lever.overload ? null : measure(lever.F, { ...dyn, key: 'fuerza' }),
        sEffort: measure(lever.sEffort * 100, { ...rul, key: 'regla-fuerza' }),
        sLoad: measure(lever.sLoad * 100, { ...rul, key: 'regla-carga' }),
        overload: lever.overload, direction: lever.direction,
      };
    }
    return {
      load: measure(pulley.R, { ...dyn, key: 'carga' }),
      effort: pulley.overload ? null : measure(pulley.F, { ...dyn, key: 'fuerza' }),
      sEffort: measure(pulley.rope * 100, { ...rul, key: 'regla-fuerza' }),
      sLoad: measure(pulley.rise * 100, { ...rul, key: 'regla-carga' }),
      overload: pulley.overload, direction: pulley.direction,
    };
  }, [machine, lever, pulley, measure]);

  const derived = useMemo(() => {
    if (!readings || readings.effort === null || readings.effort <= 0) return null;
    const workIn = readings.effort * (readings.sEffort / 100), workOut = readings.load * (readings.sLoad / 100);
    return { vm: readings.load / readings.effort, workIn, workOut, efficiency: workIn > 0 ? workOut / workIn : null, ratio: readings.sLoad > 0 ? readings.sEffort / readings.sLoad : null };
  }, [readings]);

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setP(0); };
  useEffect(reset, [machine, massG, cls, dR, dF, barMass, setup, strands, blockG, eta, ropeCm]);

  useEffect(() => {
    if (phase !== 'midiendo') return;
    if (prefersReducedMotion()) { setP(1); setPhase('medido'); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const q = Math.min(1, Math.max(0, now - start) / DUR);
      setP(q);
      if (q >= 1) { setPhase('medido'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  const startMeasure = () => {
    remeasure('carga', 'fuerza', 'regla-fuerza', 'regla-carga');
    cancelAnimationFrame(raf.current);
    setP(0);
    setPhase('midiendo');
    // El dinamómetro se tensa (crujido del resorte) y luego la carga se mueve (la cuerda roza la polea).
    playSound('creak', { intensity: 0.6 });
    if (machine === 'poleas') playSound('ropeCreak', { intensity: 0.7, delay: (DUR / 1000) * 0.45 });
  };

  const changeClass = (v: string) => {
    const c = Number(v) as LeverClass;
    setCls(c);
    setDR(CLASS_DEFAULTS[c].dR);
    setDF(CLASS_DEFAULTS[c].dF);
  };

  /* -------------------------------------------------- animación: tensión (0–40 %) y movimiento (40–100 %) */
  const measured = phase === 'medido';
  const tension = phase === 'listo' ? 0 : Math.min(1, p / 0.4);
  const overload = readings?.overload ?? false;
  const motion = phase === 'listo' || overload ? 0 : Math.max(0, (p - 0.4) / 0.6);
  const ease = motion < 0.5 ? 2 * motion * motion : 1 - (-2 * motion + 2) ** 2 / 2;
  const dynForce = readings && readings.effort !== null ? readings.effort * tension : overload ? (tension >= 1 ? DYNAMOMETER_MAX + 1 : DYNAMOMETER_MAX * tension) : 0;

  /* -------------------------------------------------- textos */
  const show = (s: string) => (measured ? s : '—');
  const N = (v: number) => `${fmt(v, 1)} N`;
  const effortText = readings === null ? '—' : readings.effort === null ? 'fuera de escala (más de 10 N)' : N(readings.effort);
  const dirText = readings?.direction === 'abajo' ? 'hacia abajo' : 'hacia arriba';
  const classInfo = LEVER_CLASSES.find((c) => c.id === cls)!;
  const setupInfo = PULLEY_SETUPS.find((s) => s.id === setup)!;

  const record = () => {
    if (!readings || readings.effort === null || !derived) return;
    const r4 = (v: number | null) => (v === null ? null : Number(v.toFixed(4)));
    if (machine === 'palanca') {
      api.addTrial('palancas', {
        genero: classInfo.name, masa: massG, dR, dF, barra: barMass === 'si' ? BAR.mass * 1000 : 0,
        carga: readings.load, fuerza: readings.effort, sentido: dirText,
        momentoCarga: r4(readings.load * dR / 100), momentoFuerza: r4(readings.effort * dF / 100),
        ventaja: r4(derived.vm), recorridoF: readings.sEffort, recorridoR: readings.sLoad,
        trabajoEntrada: r4(derived.workIn), trabajoSalida: r4(derived.workOut),
        eficiencia: derived.efficiency === null ? null : Number((derived.efficiency * 100).toFixed(1)),
      });
    } else {
      api.addTrial('poleas', {
        montaje: setupInfo.short, cuerdas: pulley.n, masa: massG, masaPolea: setup === 'fija' ? 0 : blockG, eficienciaPolea: eta, cuerda: ropeCm,
        carga: readings.load, fuerza: readings.effort, recorrido: readings.sEffort, subida: readings.sLoad,
        ventaja: r4(derived.vm), relacionDistancias: r4(derived.ratio),
        trabajoEntrada: r4(derived.workIn), trabajoSalida: r4(derived.workOut),
        eficiencia: derived.efficiency === null ? null : Number((derived.efficiency * 100).toFixed(1)),
      });
    }
  };

  /* -------------------------------------------------- escena de la palanca */
  const leverScene = () => {
    if (!lever) {
      return <text x={W / 2} y={200} textAnchor="middle" style={{ fontSize: 14, fill: 'var(--warn)', fontWeight: 700 }}>Ubica la carga y la fuerza según el género elegido.</text>;
    }
    const yb = barRestY(cls);
    const xf = barX(lever.xFulcrum * 100);
    const alphaMax = ((cls === 1 ? -1 : 1) * LEVER_TILT_DEG * Math.PI) / 180;
    const alpha = alphaMax * ease;
    const at = (cm: number) => {
      const u = (cm - lever.xFulcrum * 100) * PXC;
      return { x: xf + u * Math.cos(alpha), y: yb - u * Math.sin(alpha) };
    };
    const loadCm = lever.xLoad * 100, effCm = lever.xEffort * 100;
    const L = at(loadCm), E = at(effCm);
    const dynDir: 1 | -1 = cls === 1 ? -1 : 1;
    const ringY = E.y - dynDir * (DYN_LEN - 5);
    const restL = { x: barX(loadCm), y: yb }, restE = { x: barX(effCm), y: yb };
    // Reglas en el lado opuesto al otro elemento.
    const loadRulerX = cls === 3 ? restL.x + 20 : restL.x - 36;
    const effRulerX = cls === 3 ? restE.x - 36 : restE.x + 18;
    const effRulerDir: 1 | -1 = cls === 1 ? 1 : -1;
    const holes = Array.from({ length: 21 }, (_, i) => i * 5);
    return (
      <g>
        {/* reglas verticales (detrás) */}
        <VRuler x={loadRulerX} y0={yb} cm={18} pxPerCm={PXC} dir={-1} labelEvery={5} caption="regla" />
        <VRuler x={effRulerX} y0={yb} cm={18} pxPerCm={PXC} dir={effRulerDir} labelEvery={5} caption={effRulerDir === 1 ? '' : 'regla'} />
        {/* fulcro */}
        {cls === 1 ? (
          <g>
            <g filter="url(#kit-shadow)">
              <rect x={xf - 6} y={yb + 34} width={12} height={BENCH_Y - yb - 40} fill="url(#kit-metal-h)" />
              <path d={`M${xf - 34} ${BENCH_Y} L${xf + 34} ${BENCH_Y} L${xf + 26} ${BENCH_Y - 10} L${xf - 26} ${BENCH_Y - 10} Z`} fill="url(#kit-body-dark)" />
              <rect x={xf - 18} y={yb + 30} width={36} height={8} rx={2} fill="url(#kit-body-dark)" />
            </g>
            <path d={`M${xf} ${yb + 5} L${xf - 13} ${yb + 31} L${xf + 13} ${yb + 31} Z`} fill="url(#kit-metal)" stroke="#6b787c" />
          </g>
        ) : (
          <g>
            <g filter="url(#kit-shadow)">
              <rect x={xf - 26} y={yb - 22} width={9} height={BENCH_Y - yb + 14} fill="url(#kit-metal-h)" />
              <path d={`M${xf - 54} ${BENCH_Y} L${xf + 10} ${BENCH_Y} L${xf + 4} ${BENCH_Y - 10} L${xf - 48} ${BENCH_Y - 10} Z`} fill="url(#kit-body-dark)" />
              <rect x={xf - 30} y={yb - 10} width={30} height={20} rx={3} fill="url(#kit-body-dark)" />
            </g>
          </g>
        )}
        <BarStop x={barX(cls === 1 ? -1 : 101)} top={yb + 6} />
        {/* barra graduada (gira con el ángulo alfa) */}
        <g transform={`rotate(${(-alpha * 180) / Math.PI} ${xf} ${yb})`}>
          <g filter="url(#kit-shadow-soft)">
            <rect x={barX(-2)} y={yb - 6} width={104 * PXC} height={12} rx={2.5} fill="url(#kit-wood)" stroke="#b8975a" />
          </g>
          {Array.from({ length: 101 }, (_, i) => i).map((i) => (
            <line key={i} x1={barX(i)} x2={barX(i)} y1={yb - 6} y2={yb - 6 + (i % 10 === 0 ? 5 : i % 5 === 0 ? 3.5 : 2)} stroke="#4d3b1c" strokeWidth={i % 10 === 0 ? 0.8 : 0.45} />
          ))}
          {holes.map((c) => <circle key={c} cx={barX(c)} cy={yb + 2} r={1.6} fill="#5e4630" />)}
          {Array.from({ length: 11 }, (_, i) => i * 10).map((c) => (
            <text key={c} x={barX(c) + 1.5} y={yb + 0.5} style={{ fontSize: 5.5, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{c}</text>
          ))}
          {barMass === 'si' && <text x={barX(50)} y={yb - 9} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontWeight: 600 }}>barra de {fmt(BAR.mass * 1000, 0)} g</text>}
        </g>
        {cls !== 1 && <circle cx={xf} cy={yb} r={4} fill="url(#kit-metal)" stroke="#37474f" />}
        {/* carga */}
        <MassHanger x={L.x} y={L.y + 3} grams={massG} />
        {/* dinamómetro y fuerza de la mano */}
        <SpringScale x={E.x} hookY={E.y + (dynDir === 1 ? -4 : 4)} dir={dynDir} force={dynForce} overload={overload && tension >= 1} />
        <PullArrow x={E.x} y={ringY - dynDir * 6} dir={dynDir} label="F" />
        {/* cotas (solo en reposo) */}
        {motion === 0 && (
          <g style={{ fontSize: 10.5, fontWeight: 700 }}>
            {[{ a: lever.xFulcrum * 100, b: loadCm, lab: `dR = ${fmt(dR, 0)} cm`, c: 'var(--series-2)', off: cls === 1 ? -26 : 24 },
              { a: lever.xFulcrum * 100, b: effCm, lab: `dF = ${fmt(dF, 0)} cm`, c: 'var(--fis)', off: cls === 1 ? -26 : 40 }].map((d) => {
              const y = yb + d.off, x1 = barX(Math.min(d.a, d.b)), x2 = barX(Math.max(d.a, d.b));
              return (
                <g key={d.lab}>
                  <line x1={x1} x2={x2} y1={y} y2={y} stroke={d.c} strokeWidth="1.3" />
                  <path d={`M${x1} ${y} l6 -3.5 v7 Z M${x2} ${y} l-6 -3.5 v7 Z`} fill={d.c} />
                  <text x={(x1 + x2) / 2} y={y - 4} textAnchor="middle" style={{ fill: d.c, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{d.lab}</text>
                </g>
              );
            })}
          </g>
        )}
        <text x={cls === 1 ? xf + 14 : xf - 4} y={BENCH_Y - 16} textAnchor="start" style={{ fontSize: 10.5, fill: 'var(--ink-2)', fontWeight: 700 }}>fulcro</text>
        {motion > 0 && <><RulerMark x={loadRulerX} y={L.y} /><RulerMark x={effRulerX} y={E.y} /></>}
        {overload && tension >= 1 && (
          <text x={E.x} y={cls === 1 ? ringY + 26 : ringY - 30} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--bad)', fontWeight: 700 }}>¡Fuera de escala!</text>
        )}
        <ExampleCard x={restE.x > W / 2 ? 14 : W - 164} y={12} title={classInfo.name} lines={[cls === 1 ? 'Machete apoyado en un tronco' : cls === 2 ? 'Carretilla de la finca' : 'Pinzas para servir']}>
          <ExampleIcon kind={cls === 1 ? 'c1' : cls === 2 ? 'c2' : 'c3'} />
        </ExampleCard>
      </g>
    );
  };

  /* -------------------------------------------------- escena de las poleas */
  const pulleyScene = () => {
    const n = pulley.n;
    const sPx = pulley.rope * 100 * PXP * ease;
    const hPx = pulley.rise * 100 * PXP * ease;
    // Marco: dos varillas con travesaño; la polea móvil usa un solo soporte con brazo para que la cuerda suba libre.
    const armEnd = setup === 'movil' ? 352 : 578;
    const frame = (
      <g>
        {(setup === 'movil' ? [204] : [204, 566]).map((rx) => (
          <g key={rx} filter="url(#kit-shadow)">
            <rect x={rx - 4} y={CROSS_Y} width={8} height={BENCH_Y - CROSS_Y - 8} fill="url(#kit-metal-h)" />
            <path d={`M${rx - 30} ${BENCH_Y} L${rx + 30} ${BENCH_Y} L${rx + 24} ${BENCH_Y - 10} L${rx - 24} ${BENCH_Y - 10} Z`} fill="url(#kit-body-dark)" />
          </g>
        ))}
        <g filter="url(#kit-shadow-soft)">
          <rect x={192} y={CROSS_Y - 6} width={armEnd - 192} height={11} rx={3} fill="url(#kit-metal)" stroke="#8c979b" />
        </g>
      </g>
    );
    const card = (
      <ExampleCard x={W - 164} y={60} title={setupInfo.name} lines={[setup === 'fija' ? 'Polea del pozo de la finca' : 'Garrucha para subir racimos']}>
        <ExampleIcon kind={setup === 'fija' ? 'fija' : 'garrucha'} />
      </ExampleCard>
    );

    if (setup === 'movil') {
      const r = 22, cx = 357, py = 286 - hPx, anchorX = cx - r, freeX = cx + r;
      const hookY = 250 - sPx;
      const loadHook = py + r + 8;
      return (
        <g>
          {frame}
          <VRuler x={cx - 74} y0={286 + r + 8} cm={50} pxPerCm={PXP} dir={-1} labelEvery={10} caption="subida de la carga" align="end" />
          <VRuler x={freeX + 18} y0={250} cm={50} pxPerCm={PXP} dir={-1} labelEvery={10} caption="cuerda jalada" align="start" />
          {/* anclaje y cuerda */}
          <rect x={anchorX - 5} y={CROSS_Y + 4} width={10} height={8} rx={2} fill="url(#kit-body-dark)" />
          <line x1={anchorX} x2={anchorX} y1={CROSS_Y + 10} y2={py} stroke={ROPE} strokeWidth="2.2" />
          <line x1={freeX} x2={freeX} y1={py} y2={hookY} stroke={ROPE} strokeWidth="2.2" />
          <path d={`M${anchorX} ${py} A${r} ${r} 0 0 0 ${freeX} ${py}`} fill="none" stroke={ROPE} strokeWidth="2.2" />
          {/* polea móvil con su horquilla */}
          <path d={`M${cx - 7} ${py} L${cx - 7} ${py + r + 6} L${cx + 7} ${py + r + 6} L${cx + 7} ${py}`} fill="none" stroke="#37474f" strokeWidth="3" />
          <Sheave cx={cx} cy={py} r={r} angle={-sPx * 2} />
          <path d={`M${anchorX} ${py} A${r} ${r} 0 0 0 ${freeX} ${py}`} fill="none" stroke={ROPE_DARK} strokeWidth="1.2" opacity="0.7" />
          <WoodBlock x={cx} top={286 + r + 8 + hangerDepth(massG)} />
          <MassHanger x={cx} y={loadHook} grams={massG} extra={blockG > 0 ? `+ polea de ${fmt(blockG, 0)} g` : undefined} />
          <SpringScale x={freeX} hookY={hookY} dir={1} force={dynForce} overload={overload && tension >= 1} />
          <PullArrow x={freeX} y={hookY - DYN_LEN - 1} dir={1} label="F" left />
          {motion > 0 && <><RulerMark x={cx - 74} y={loadHook} /><RulerMark x={freeX + 18} y={hookY} /></>}
          {card}
        </g>
      );
    }

    // Polea fija (n = 1) y polipasto: n tramos sostienen el bloque móvil y el extremo libre baja desde el bloque fijo.
    const d = setup === 'fija' ? 50 : 22, r = d / 2;
    const x0 = 360 - (n * d) / 2;
    const xs = (i: number) => x0 + i * d;
    const lowY = 268 - hPx; // centro de las poleas del bloque móvil
    const loadHookRest = setup === 'fija' ? 280 : 268 + r + 10;
    const loadHook = loadHookRest - hPx;
    const loadX = setup === 'fija' ? xs(0) : (xs(0) + xs(n - 1)) / 2;
    const freeX = xs(n);
    const loadRulerX = Math.min(loadX - 66, x0 - 32);
    const hookY = 150 + sPx;
    const counts = sheaveCounts(setup, n);
    const sheaves = Array.from({ length: n }, (_, i) => ({ i, upper: (i + n) % 2 === 1, cx: xs(i) + r }));
    const uppers = sheaves.filter((s) => s.upper), lowers = sheaves.filter((s) => !s.upper);
    const anchorUpper = setup === 'polipasto' && n % 2 === 0;
    const upMinX = Math.min(anchorUpper ? xs(0) : Infinity, ...uppers.map((s) => s.cx - r)) - 4, upMaxX = Math.max(...uppers.map((s) => s.cx)) + r + 4;
    return (
      <g>
        {frame}
        <VRuler x={loadRulerX} y0={loadHookRest} cm={50} pxPerCm={PXP} dir={-1} labelEvery={10} caption="subida de la carga" align="end" />
        <VRuler x={freeX + 18} y0={150} cm={50} pxPerCm={PXP} dir={1} labelEvery={10} caption="cuerda jalada" align="start" />
        {/* bloque fijo colgado del travesaño */}
        <rect x={(upMinX + upMaxX) / 2 - 4} y={CROSS_Y + 4} width={8} height={UPPER_Y - CROSS_Y - 6} fill="url(#kit-metal-h)" />
        <rect x={upMinX} y={UPPER_Y - r - 6} width={upMaxX - upMinX} height={2 * r + 12} rx={5} fill="url(#kit-body-dark)" opacity="0.92" />
        {/* tramos que sostienen la carga */}
        {Array.from({ length: n }, (_, i) => {
          const topY = UPPER_Y;
          const botY = setup === 'fija' ? loadHook : lowY;
          return <line key={i} x1={xs(i)} x2={xs(i)} y1={topY} y2={botY} stroke={ROPE} strokeWidth="2" />;
        })}
        {/* extremo libre hacia el dinamómetro */}
        <line x1={freeX} x2={freeX} y1={UPPER_Y} y2={hookY} stroke={ROPE} strokeWidth="2" />
        {uppers.map((s) => (
          <g key={`u${s.i}`}>
            <Sheave cx={s.cx} cy={UPPER_Y} r={r} angle={sPx * 2} />
            <path d={`M${s.cx - r} ${UPPER_Y} A${r} ${r} 0 0 1 ${s.cx + r} ${UPPER_Y}`} fill="none" stroke={ROPE} strokeWidth="2" />
          </g>
        ))}
        {anchorUpper && <circle cx={xs(0)} cy={UPPER_Y + r + 2} r={3} fill="none" stroke="#cfd7da" strokeWidth="1.6" />}
        {/* bloque móvil */}
        {setup === 'polipasto' && (
          <g>
            <rect x={xs(0) - 6} y={lowY - r - 5} width={xs(n - 1) - xs(0) + 12} height={2 * r + 10} rx={5} fill="url(#kit-body-dark)" opacity="0.92" />
            {lowers.map((s) => (
              <g key={`l${s.i}`}>
                <Sheave cx={s.cx} cy={lowY} r={r} angle={-sPx} />
                <path d={`M${s.cx - r} ${lowY} A${r} ${r} 0 0 0 ${s.cx + r} ${lowY}`} fill="none" stroke={ROPE} strokeWidth="2" />
              </g>
            ))}
            {!anchorUpper && <circle cx={xs(0)} cy={lowY - r - 2} r={3} fill="none" stroke="#cfd7da" strokeWidth="1.6" />}
            <path d={`M${loadX} ${lowY + r + 5} V${loadHook}`} stroke="#37474f" strokeWidth="2.4" />
          </g>
        )}
        <WoodBlock x={loadX} top={loadHookRest + hangerDepth(massG)} />
        <MassHanger x={loadX} y={loadHook} grams={massG} extra={setup === 'polipasto' && blockG > 0 ? `+ bloque de ${fmt(blockG, 0)} g` : undefined} />
        <SpringScale x={freeX} hookY={hookY} dir={-1} force={dynForce} overload={overload && tension >= 1} />
        <PullArrow x={freeX} y={hookY + DYN_LEN + 1} dir={-1} label="F" />
        {motion > 0 && <><RulerMark x={loadRulerX} y={loadHook} /><RulerMark x={freeX + 18} y={hookY} /></>}
        <text x={360} y={CROSS_Y - 12} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)', fontWeight: 700 }}>
          {setup === 'fija' ? '1 tramo sostiene la carga' : `${n} tramos sostienen el bloque móvil · ${counts.fixed} + ${counts.movable} poleas`}
        </text>
        {card}
      </g>
    );
  };

  const desc = machine === 'palanca'
    ? (lever
      ? `Palanca de ${classInfo.name}: carga de ${fmt(massG, 0)} g a ${fmt(dR, 0)} cm del fulcro y dinamómetro a ${fmt(dF, 0)} cm. ` +
        (measured ? (readings?.effort === null ? 'El dinamómetro se sale de la escala.' : `El dinamómetro marca ${effortText} ${dirText}; la carga subió ${fmt(readings!.sLoad, 1)} cm y el punto de la fuerza se movió ${fmt(readings!.sEffort, 1)} cm.`) : 'Aún no se ha medido.')
      : 'Las distancias no corresponden al género de palanca elegido.')
    : `${setupInfo.name} con ${pulley.n} ${pulley.n === 1 ? 'tramo' : 'tramos'} de cuerda que sostienen una carga de ${fmt(massG, 0)} g. ` +
      (measured ? (readings?.effort === null ? 'El dinamómetro se sale de la escala.' : `El dinamómetro marca ${effortText}; se jalaron ${fmt(readings!.sEffort, 1)} cm de cuerda y la carga subió ${fmt(readings!.sLoad, 1)} cm.`) : 'Aún no se ha medido.');

  const canMeasure = machine === 'poleas' || lever !== null;
  // Manipulación directa de la palanca: el colgador y el dinamómetro se deslizan por la barra (posiciones de reposo).
  // Los recorridos respetan el orden del género elegido (en 2.º la carga va entre el fulcro y la fuerza; en 3.º, al revés).
  const leverHandles = (() => {
    if (machine !== 'palanca' || !lever) return null;
    const [lo, hi] = armRange(cls).map((m) => Math.round(m * 100));
    const load: [number, number] = cls === 2 ? [lo, Math.max(lo, dF - 5)] : cls === 3 ? [Math.min(hi, dF + 5), hi] : [lo, hi];
    const effort: [number, number] = cls === 2 ? [Math.min(hi, dR + 5), hi] : cls === 3 ? [lo, Math.max(lo, dR - 5)] : [lo, hi];
    const yb = barRestY(cls), xf = barX(lever.xFulcrum * 100);
    const sLoad = cls === 1 ? -1 : 1;
    const yLoad = yb + 26, yEff = cls === 1 ? yb + 58 : yb - 58;
    return {
      load, effort,
      loadFrom: { x: xf + sLoad * load[0] * PXC, y: yLoad }, loadTo: { x: xf + sLoad * load[1] * PXC, y: yLoad },
      effortFrom: { x: xf + effort[0] * PXC, y: yEff }, effortTo: { x: xf + effort[1] * PXC, y: yEff },
    };
  })();
  const lr = readings;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo de máquinas simples">
          <ManipScene viewBox={`0 0 ${W} ${H}`} label="Controles de la palanca" scene={
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="maq-t maq-d">
            <title id="maq-t">{machine === 'palanca' ? 'Palanca con barra graduada, pesas, dinamómetro y reglas' : 'Sistema de poleas con pesas, dinamómetro y reglas'}</title>
            <desc id="maq-d">{desc}</desc>
            <MachineDefs />
            <BenchTop y={BENCH_Y} width={W} />
            {machine === 'palanca' ? leverScene() : pulleyScene()}
          </svg>}>
            {leverHandles && (
              <>
                <Plunger label="Colgador de la carga: distancia al fulcro" value={dR} min={leverHandles.load[0]} max={leverHandles.load[1]} step={5} pageStep={10} unit="cm" decimals={0}
                  from={leverHandles.loadFrom} to={leverHandles.loadTo} size={40} onChange={setDR} />
                <Plunger label="Dinamómetro: distancia al fulcro" value={dF} min={leverHandles.effort[0]} max={leverHandles.effort[1]} step={5} pageStep={10} unit="cm" decimals={0}
                  from={leverHandles.effortFrom} to={leverHandles.effortTo} size={40} onChange={setDF} />
              </>
            )}
          </ManipScene>
        </div>
        {machine === 'palanca' && <ManipHint>Arrastra el colgador de las pesas y el dinamómetro a lo largo de la barra para cambiar sus distancias al fulcro, o enfócalos con Tab y usa las flechas.</ManipHint>}

        <div className="grid-2">
          <div className="stack">
            <h3>Dinamómetro (0,1 N)</h3>
            <Readout items={[
              { k: 'Peso de la carga R', v: show(lr ? N(lr.load) : '—'), data: true },
              { k: 'Fuerza F', v: show(effortText), data: true },
              { k: 'Sentido de la fuerza', v: show(lr ? dirText : '—') },
              { k: 'Ventaja mecánica R/F', v: show(derived ? fmt(derived.vm, 2) : '—'), data: true },
            ]} />
            {machine === 'palanca' && (
              <>
                <h3>Momentos respecto al fulcro</h3>
                <Readout items={[
                  { k: 'R·dR', v: show(lr ? `${fmt(lr.load * dR / 100, 3)} N·m` : '—') },
                  { k: 'F·dF', v: show(lr && lr.effort !== null ? `${fmt(lr.effort * dF / 100, 3)} N·m` : '—') },
                ]} />
              </>
            )}
          </div>
          <div className="stack">
            <h3>Reglas (1 mm)</h3>
            <Readout items={[
              { k: machine === 'palanca' ? 'Recorrido de la fuerza' : 'Cuerda jalada s', v: show(lr && !lr.overload ? `${fmt(lr.sEffort, 1)} cm` : '—'), data: true },
              { k: 'Subida de la carga', v: show(lr && !lr.overload ? `${fmt(lr.sLoad, 1)} cm` : '—'), data: true },
              { k: 'Relación de recorridos', v: show(derived && derived.ratio !== null ? fmt(derived.ratio, 2) : '—') },
            ]} />
            <h3>Trabajo</h3>
            <Readout items={[
              { k: 'Trabajo de entrada F·s', v: show(derived ? `${fmt(derived.workIn, 3)} J` : '—'), data: true },
              { k: 'Trabajo de salida R·h', v: show(derived ? `${fmt(derived.workOut, 3)} J` : '—'), data: true },
              { k: 'Eficiencia', v: show(derived && derived.efficiency !== null ? `${fmt(derived.efficiency * 100, 0)} %` : '—') },
            ]} />
          </div>
        </div>
        {measured && overload && <Notice kind="warn">La fuerza necesaria supera los 10 N del dinamómetro. Reduce la carga, aleja el dinamómetro del fulcro o usa más tramos de cuerda.</Notice>}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Segmented<Machine> label="Máquina simple" value={machine} onChange={setMachine}
            options={[{ value: 'palanca', label: 'Palanca' }, { value: 'poleas', label: 'Poleas' }]} />
          <Slider label="Masa de la carga" value={massG} min={MACHINE_LIMITS.loadMass[0] * 1000} max={MACHINE_LIMITS.loadMass[1] * 1000} step={50} unit="g" decimals={0} onChange={(v) => { setMassG(v); playSound('clank', { intensity: 0.3 + v / 4000 }); }} />
          {machine === 'palanca' ? (
            <>
              <Segmented<(typeof CLASS_KEYS)[number]> label="Género de la palanca" value={String(cls) as (typeof CLASS_KEYS)[number]} onChange={changeClass}
                options={LEVER_CLASSES.map((c) => ({ value: String(c.id) as (typeof CLASS_KEYS)[number], label: c.name }))} />
              <p className="small muted">{classInfo.order} Ejemplos: {classInfo.examples}</p>
              <Slider label="Distancia de la carga al fulcro" value={dR} min={armRange(cls)[0] * 100} max={armRange(cls)[1] * 100} step={5} unit="cm" decimals={0} onChange={setDR} />
              <Slider label="Distancia de la fuerza al fulcro" value={dF} min={armRange(cls)[0] * 100} max={armRange(cls)[1] * 100} step={5} unit="cm" decimals={0} onChange={setDF} />
              <Segmented<'no' | 'si'> label="Masa de la barra" value={barMass} onChange={setBarMass}
                options={[{ value: 'no', label: 'Despreciable' }, { value: 'si', label: '200 g' }]} />
              {orderError && <Notice kind="warn">{orderError}</Notice>}
            </>
          ) : (
            <>
              <Segmented<PulleySetup> label="Montaje de poleas" value={setup} onChange={setSetup}
                options={PULLEY_SETUPS.map((s) => ({ value: s.id, label: s.short }))} />
              <p className="small muted">{setupInfo.examples}</p>
              {setup === 'polipasto' && (
                <Slider label="Tramos que sostienen el bloque móvil" value={strands} min={MACHINE_LIMITS.strands[0]} max={MACHINE_LIMITS.strands[1]} step={1} decimals={0} onChange={setStrands} />
              )}
              {setup !== 'fija' && (
                <Slider label="Masa de la polea móvil" value={blockG} min={0} max={MACHINE_LIMITS.blockMass[1] * 1000} step={10} unit="g" decimals={0} onChange={setBlockG}
                  hint="También hay que levantarla junto con la carga." />
              )}
              <Slider label="Eficiencia de cada polea" value={eta} min={MACHINE_LIMITS.efficiency[0]} max={MACHINE_LIMITS.efficiency[1]} step={0.01} decimals={2} onChange={setEta}
                hint="1,00: sin rozamiento en los ejes." />
              <Slider label="Cuerda que se jala" value={ropeCm} min={MACHINE_LIMITS.rope[0] * 100} max={MACHINE_LIMITS.rope[1] * 100} step={5} unit="cm" decimals={0} onChange={setRopeCm} />
            </>
          )}
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={!canMeasure || phase === 'midiendo'} onClick={startMeasure}>Medir fuerza y recorridos</button>
            <button type="button" className="btn" onClick={reset}>Reiniciar medición</button>
          </div>
          <RecordButton onRecord={record} disabled={!measured || !derived} />
          {!measured && <p className="small muted">Mide con el dinamómetro y las reglas para poder guardar el ensayo.</p>}
        </div>
        <Notice>{real
          ? 'Instrumento real: cada lectura del dinamómetro y de las reglas incluye un error aleatorio típico. Pulsa «Reiniciar medición» y vuelve a medir para estimar la dispersión.'
          : `Supuestos: g = 9,8 m/s², cuerda ideal, ${barMass === 'si' && machine === 'palanca' ? 'barra de 200 g' : 'barra rígida sin masa'} y movimiento lento. En la palanca la barra gira ${fmt(LEVER_TILT_DEG, 0)}° para medir los recorridos.`}</Notice>
      </div>
    </div>
  );
}

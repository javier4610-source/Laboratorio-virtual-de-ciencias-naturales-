import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ECO_DEFAULT, ECO_INSTRUMENTS, ECO_LIMITS, FOODS, MAX_DAY, O2_CRIT_FISH, PH_CHART_RANGE, READ_TIME_LABEL, SPRIG_G, bromothymolColor, bromothymolName,
  countOf, findFood, o2Saturation, phChartReading, simulateEcosystem, stateAt, waterLook, type EcoState, type FoodLevel, type ReadTime,
} from '../models/ecosystem';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import { SimControls, simStatusOf } from '../components/Experiment';
import { useMeasure } from '../components/Measurement';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, Beaker, ContactShadow, Lcd, TestTube, shade } from './kit';
import { DragHandle, Knob, ManipHint, ManipScene, Plunger, type Pt } from './manipulate';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 980, H = 476;
const VIEW = `0 0 ${W} ${H}`;
const BENCH_Y = 440;
/** Frasco: paredes interiores, superficie del agua y sedimento. */
const JAR = { l: 360, r: 570, neckL: 382, neckR: 548, shoulder: 124, lidTop: 86, lidBottom: 108, water: 132, sed: 404, bottom: 434 };
const JAR_HIT = { x0: JAR.l - 6, x1: JAR.r + 6, y0: JAR.lidTop, y1: BENCH_Y };
/** Lámpara: px por cm de distancia; la cara de la pantalla queda a d·LAMP_PX del vidrio. */
const LAMP_PX = 3;
const HEAD_Y = 236;
const lampX = (d: number) => JAR.l - 56 - d * LAMP_PX;
/** Reserva (bandeja con tres vasos). */
const CUP = {
  snail: { x: 836, y: 368, w: 40, h: 62 },
  fish: { x: 882, y: 356, w: 44, h: 74 },
  plant: { x: 932, y: 368, w: 40, h: 62 },
};
/** Zonas del frasco donde se agarran los organismos. */
const ZONE = {
  fish: { x: 380, y: 136, w: 172, h: 116 },
  snail: { x: 366, y: 256, w: 78, h: 176 },
  plant: { x: 446, y: 256, w: 98, h: 176 },
};
const PROBE_X = 556;

const SPRIG_X = [466, 506, 486, 526, 448, 542];
const SNAIL_POS: { x: number; y: number; rot: number; flip?: boolean }[] = [
  { x: 376, y: 330, rot: -80 }, { x: 398, y: 402, rot: 0 }, { x: 428, y: 400, rot: 0, flip: true }, { x: 376, y: 272, rot: -84 },
  { x: 414, y: 404, rot: 3 }, { x: 376, y: 372, rot: -78 }, { x: 386, y: 403, rot: -4, flip: true }, { x: 376, y: 232, rot: -86 },
  { x: 438, y: 403, rot: 2 }, { x: 405, y: 395, rot: 8, flip: true }, { x: 376, y: 300, rot: -82 }, { x: 420, y: 396, rot: -6 },
  { x: 376, y: 196, rot: -86 }, { x: 392, y: 396, rot: 6 },
];
const FISH_POS: { x: number; y: number; flip?: boolean; dur: number }[] = [
  { x: 430, y: 182, dur: 6.5 }, { x: 512, y: 160, flip: true, dur: 7.4 }, { x: 476, y: 222, dur: 5.8 }, { x: 410, y: 236, flip: true, dur: 8.1 },
];
const DEAD_FISH = [{ x: 470, y: 409 }, { x: 512, y: 411 }, { x: 436, y: 412 }, { x: 540, y: 410 }];
const DEAD_SHELL = [{ x: 452, y: 410 }, { x: 488, y: 412 }, { x: 396, y: 413 }, { x: 526, y: 413 }, { x: 420, y: 414 }, { x: 506, y: 409 }];

type Phase = 'listo' | 'simulando' | 'pausa' | 'medido';
type Kind = 'snail' | 'fish' | 'plant';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pad2 = (n: number) => String(n).padStart(2, '0');
const inJar = (p: Pt) => p.x >= JAR_HIT.x0 && p.x <= JAR_HIT.x1 && p.y >= JAR_HIT.y0 && p.y <= JAR_HIT.y1;

/** Generador pseudoaleatorio con semilla (posiciones de detritos y granos: siempre las mismas). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mix = (a: string, b: string, f: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * clamp01(f)).toString(16).padStart(2, '0')).join('')}`;
};

/* ------------------------------------------------------------------ definiciones locales */

function EcoDefs({ beam }: { beam: number }) {
  return (
    <defs>
      <linearGradient id="eco-water" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#bfe3ee" stopOpacity="0.42" />
        <stop offset="1" stopColor="#5f9fb4" stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id="eco-mud" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#6b4a2c" />
        <stop offset="0.5" stopColor="#4f3520" />
        <stop offset="1" stopColor="#3a2716" />
      </linearGradient>
      <linearGradient id="eco-sand" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#e8d8b0" />
        <stop offset="1" stopColor="#c9b483" />
      </linearGradient>
      <linearGradient id="eco-beam" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff3b0" stopOpacity={0.9 * beam} />
        <stop offset="0.6" stopColor="#ffe98a" stopOpacity={0.45 * beam} />
        <stop offset="1" stopColor="#ffe27a" stopOpacity={0.3 * beam} />
      </linearGradient>
      <linearGradient id="eco-shaft" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff6c4" stopOpacity={0.45 * beam} />
        <stop offset="1" stopColor="#fff6c4" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="eco-shell" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#e9cf9f" />
        <stop offset="0.55" stopColor="#b98a4f" />
        <stop offset="1" stopColor="#7a5329" />
      </radialGradient>
      <radialGradient id="eco-shell-dead" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#f1ece2" />
        <stop offset="1" stopColor="#a9a297" />
      </radialGradient>
      <linearGradient id="eco-guppy" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#c9d2c4" />
        <stop offset="0.45" stopColor="#f2b061" />
        <stop offset="1" stopColor="#f6eee0" />
      </linearGradient>
      <linearGradient id="eco-tail" x1="1" x2="0" y1="0" y2="0">
        <stop offset="0" stopColor="#f08a24" />
        <stop offset="0.55" stopColor="#d9482f" />
        <stop offset="1" stopColor="#3f6fc6" />
      </linearGradient>
      <linearGradient id="eco-plastic" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f4f7f8" />
        <stop offset="1" stopColor="#c9d3d6" />
      </linearGradient>
      <radialGradient id="eco-led" cx="0.5" cy="0.5" r="0.6">
        <stop offset="0" stopColor="#fffdf0" />
        <stop offset="1" stopColor="#ffe8a0" />
      </radialGradient>
    </defs>
  );
}

/* ------------------------------------------------------------------ organismos */

/** Ramita de elodea: tallo curvo con verticilos de tres hojas. `h` en px; `bubbles` = burbujas de O₂ en las hojas. */
function Elodea({ x, base, h, color, sway, bubbles = 0 }: { x: number; base: number; h: number; color: string; sway: number; bubbles?: number }) {
  const p0 = { x, y: base }, p1 = { x: x + sway * 0.6, y: base - h * 0.5 }, p2 = { x: x + sway, y: base - h };
  const at = (t: number) => ({
    x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
  });
  const n = Math.max(3, Math.floor(h / 7.5));
  const dark = shade(color, -0.35), light = shade(color, 0.22);
  return (
    <g>
      <path d={`M${p0.x} ${p0.y} Q${p1.x} ${p1.y} ${p2.x} ${p2.y}`} fill="none" stroke={dark} strokeWidth="1.6" strokeLinecap="round" />
      {Array.from({ length: n }, (_, k) => {
        const t = (k + 1) / (n + 0.4);
        const p = at(t);
        const len = 6.5 - 2.2 * t;
        const fill = k > n - 3 ? light : color;
        return (
          <g key={k}>
            <ellipse cx={p.x - len * 0.62} cy={p.y + 0.6} rx={len * 0.7} ry={1.7} fill={fill} stroke={dark} strokeWidth="0.4" transform={`rotate(${-28 + (k % 2) * 8} ${p.x} ${p.y})`} />
            <ellipse cx={p.x + len * 0.62} cy={p.y + 0.6} rx={len * 0.7} ry={1.7} fill={fill} stroke={dark} strokeWidth="0.4" transform={`rotate(${28 - (k % 2) * 8} ${p.x} ${p.y})`} />
            <ellipse cx={p.x + (k % 2 ? 1 : -1)} cy={p.y - 2.2} rx={1.3} ry={2.6} fill={light} opacity="0.9" />
          </g>
        );
      })}
      {Array.from({ length: bubbles }, (_, b) => {
        const p = at(0.35 + ((b * 37) % 60) / 100);
        return <circle key={`b${b}`} cx={p.x + ((b % 3) - 1) * 5} cy={p.y - 3 - (b % 4) * 2} r={1.1 + (b % 3) * 0.5} fill="#ffffff" fillOpacity="0.75" stroke="#7fb2c4" strokeWidth="0.5" />;
      })}
    </g>
  );
}

/** Caracol de agua dulce (Physa: concha levógira); `dead` = concha vacía. */
function Snail({ x, y, rot = 0, s = 1, flip = false, dead = false }: { x: number; y: number; rot?: number; s?: number; flip?: boolean; dead?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -s : s} ${s})`}>
      {!dead && (
        <>
          <path d="M-8 0 Q-6 -2.6 0 -2.4 Q6 -2.6 9 -0.6 Q9.6 0.6 8 0.9 L-7 0.9 Q-8.6 0.6 -8 0 Z" fill="#7d7566" stroke="#4c463c" strokeWidth="0.4" />
          <path d="M7.6 -1.6 Q10.6 -4.4 12.2 -6.4 M6.6 -1.8 Q8.4 -5.2 9 -7.4" fill="none" stroke="#5a5347" strokeWidth="0.8" strokeLinecap="round" />
          <circle cx="7.3" cy="-1.6" r="0.6" fill="#111" />
        </>
      )}
      <g transform={dead ? 'translate(0 -2) rotate(160)' : undefined}>
        <path d="M-6.5 -2 Q-8 -8.6 -2.6 -11.4 Q2.4 -12.6 5 -8.4 Q6.4 -4.6 3.6 -1.6 Q-1 0.2 -6.5 -2 Z" fill={dead ? 'url(#eco-shell-dead)' : 'url(#eco-shell)'} stroke={dead ? '#8d877c' : '#5e3f1d'} strokeWidth="0.6" />
        <path d="M-3.4 -9.6 Q0.8 -10.8 2.6 -7.6 Q3.4 -4.8 0.6 -3.8 Q-2.4 -3.4 -2.2 -6 Q-1.6 -7.8 0.2 -7.2" fill="none" stroke={dead ? '#8d877c' : '#6d4a24'} strokeWidth="0.6" />
        <ellipse cx="-3.4" cy="-8.4" rx="1.2" ry="0.7" fill="#fff" opacity="0.5" />
      </g>
    </g>
  );
}

/** Guppy macho; `dead` = vientre arriba, gris, sobre el sedimento. `swim` agrega un vaivén (SMIL) si no se pidió movimiento reducido. */
function Guppy({ x, y, s = 1, flip = false, dead = false, swim = 0 }: { x: number; y: number; s?: number; flip?: boolean; dead?: boolean; swim?: number }) {
  const body = (
    <g transform={`scale(${flip ? -s : s} ${dead ? -s : s})`}>
      <path d="M-2 0 L-13 -8.5 Q-17 0 -13 8.5 Z" fill={dead ? '#b8b4ab' : 'url(#eco-tail)'} stroke={dead ? '#8b867c' : '#9c3a1f'} strokeWidth="0.5" opacity={dead ? 0.8 : 0.95} />
      <path d="M-11 -6 L-4 -1 M-12.5 0 L-3 0 M-11 6 L-4 1" stroke={dead ? '#9c978d' : '#ffd38a'} strokeWidth="0.5" opacity="0.7" />
      <path d="M-3 0 Q2 -5 10 -3.6 Q15 -2.4 16.4 0 Q15 2.4 10 3.4 Q2 4.6 -3 0 Z" fill={dead ? '#c9c6bf' : 'url(#eco-guppy)'} stroke={dead ? '#8b867c' : '#7c6a50'} strokeWidth="0.6" />
      <path d="M3 -3.8 Q6 -7.2 9.4 -3.6" fill={dead ? '#b8b4ab' : '#5d86c9'} opacity="0.85" />
      <circle cx="12.6" cy="-0.8" r="1.4" fill={dead ? '#777' : '#111'} />
      {!dead && <circle cx="13" cy="-1.2" r="0.45" fill="#fff" />}
      <path d="M8.6 -2.2 Q9.6 0 8.6 2.2" fill="none" stroke="#8a7458" strokeWidth="0.5" />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      {swim > 0 && !dead ? (
        <g>
          <animateTransform attributeName="transform" type="translate" values={`0 0; ${flip ? -14 : 14} -4; ${flip ? -6 : 6} 3; 0 0`} dur={`${swim}s`} repeatCount="indefinite" />
          {body}
        </g>
      ) : body}
    </g>
  );
}

/** Hojuela de alimento. */
function Flake({ x, y, r, c }: { x: number; y: number; r: number; c: string }) {
  return <path d={`M${x - r} ${y} L${x - r * 0.2} ${y - r * 0.7} L${x + r} ${y - r * 0.2} L${x + r * 0.4} ${y + r * 0.6} Z`} fill={c} stroke={shade(c, -0.35)} strokeWidth="0.4" />;
}

/* ------------------------------------------------------------------ instrumentos */

/** Lámpara LED de escritorio con pantalla orientable hacia el frasco. */
function Lamp({ x, on, glow }: { x: number; on: boolean; glow: number }) {
  return (
    <g>
      <ContactShadow x={x - 32} y={BENCH_Y} w={64} />
      <path d={`M${x - 32} ${BENCH_Y} Q${x - 30} ${BENCH_Y - 11} ${x - 16} ${BENCH_Y - 12} L${x + 16} ${BENCH_Y - 12} Q${x + 30} ${BENCH_Y - 11} ${x + 32} ${BENCH_Y} Z`} fill="url(#kit-body-dark)" stroke="#11181a" strokeWidth="0.8" />
      <rect x={x - 3} y={HEAD_Y - 44} width={6} height={BENCH_Y - 12 - (HEAD_Y - 44)} rx={2} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.5" />
      <path d={`M${x} ${HEAD_Y - 44} Q${x + 10} ${HEAD_Y - 46} ${x + 22} ${HEAD_Y - 2}`} fill="none" stroke="url(#kit-metal-h)" strokeWidth="5" strokeLinecap="round" />
      <path d={`M${x} ${HEAD_Y - 44} Q${x + 10} ${HEAD_Y - 46} ${x + 22} ${HEAD_Y - 2}`} fill="none" stroke="#6d7b80" strokeWidth="0.6" />
      <circle cx={x} cy={HEAD_Y - 44} r={4.2} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />
      <path d={`M${x + 18} ${HEAD_Y - 10} L${x + 54} ${HEAD_Y - 27} L${x + 54} ${HEAD_Y + 27} L${x + 18} ${HEAD_Y + 10} Z`} fill="url(#kit-body)" stroke="#5d6b70" strokeWidth="0.8" />
      <path d={`M${x + 20} ${HEAD_Y - 8} L${x + 52} ${HEAD_Y - 23}`} stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" />
      <ellipse cx={x + 54} cy={HEAD_Y} rx={4.5} ry={27} fill={on ? 'url(#eco-led)' : '#cfd6d8'} stroke="#5d6b70" strokeWidth="0.8" />
      {on && <ellipse cx={x + 56} cy={HEAD_Y} rx={9} ry={31} fill="#fff6c8" opacity={0.25 + 0.45 * glow} />}
      <circle cx={x + 20} cy={HEAD_Y} r={3.4} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />
    </g>
  );
}

/** Oxímetro de mano con cable a la sonda. */
function Oximeter({ text }: { text: string }) {
  const x = 596, y = 330;
  return (
    <g>
      <ContactShadow x={x} y={BENCH_Y} w={90} />
      <rect x={x} y={y} width={90} height={BENCH_Y - y} rx={10} fill="url(#kit-body-dark)" stroke="#0f1517" strokeWidth="1" />
      <rect x={x + 3} y={y + 3} width={84} height={6} rx={3} fill="#fff" opacity="0.08" />
      <Lcd x={x + 7} y={y + 14} w={76} h={30} text={text} />
      <text x={x + 79} y={y + 54} textAnchor="end" style={{ fontSize: 8, fill: '#9fe8bf', fontFamily: 'var(--font-data)' }}>mg/L O₂</text>
      <text x={x + 45} y={y + 66} textAnchor="middle" style={{ fontSize: 9.5, fill: '#e6eef0', fontWeight: 700, letterSpacing: 0.5 }}>OXÍMETRO</text>
      <text x={x + 45} y={y + 77} textAnchor="middle" style={{ fontSize: 8, fill: '#b7c4c8' }}>sonda · 26 °C</text>
      {[0, 1, 2].map((i) => <rect key={i} x={x + 12 + i * 24} y={y + 86} width={18} height={10} rx={3} fill="url(#kit-metal)" stroke="#2a3336" strokeWidth="0.6" />)}
      <rect x={x + 40} y={y - 6} width={10} height={8} rx={2} fill="#2a3336" />
    </g>
  );
}

/** Carta de colores del azul de bromotimol (pH 5,8 a 8,0 cada 0,2). */
function ColorChart({ reading }: { reading: number | null }) {
  const x = 750, y = 300, sw = 9;
  const steps = Array.from({ length: Math.round((PH_CHART_RANGE[1] - PH_CHART_RANGE[0]) / 0.2) + 1 }, (_, i) => Number((PH_CHART_RANGE[1] - i * 0.2).toFixed(1)));
  return (
    <g>
      <ContactShadow x={x} y={BENCH_Y} w={66} h={6} />
      <g filter="url(#kit-shadow-soft)"><rect x={x} y={y} width={66} height={BENCH_Y - y} rx={4} fill="#fbfaf5" stroke="#c8c2ae" strokeWidth="0.8" /></g>
      <text x={x + 33} y={y + 11} textAnchor="middle" style={{ fontSize: 8, fill: '#2e3a3b', fontWeight: 700 }}>Carta de pH</text>
      {steps.map((p, i) => {
        const yy = y + 16 + i * sw;
        const sel = reading !== null && Math.abs(reading - p) < 0.01;
        return (
          <g key={p}>
            <rect x={x + 8} y={yy} width={22} height={sw - 1} fill={bromothymolColor(p)} stroke={sel ? '#111' : '#00000022'} strokeWidth={sel ? 1.4 : 0.5} />
            {(i % 2 === 0 || sel) && <text x={x + 36} y={yy + 7} style={{ fontSize: 7.5, fill: '#2e3a3b', fontFamily: 'var(--font-data)', fontWeight: sel ? 700 : 400 }}>{fmt(p, 1)}</text>}
            {sel && <path d={`M${x + 4} ${yy + sw / 2 - 0.5} l-4 -3.5 v7 Z`} fill="#111" />}
          </g>
        );
      })}
    </g>
  );
}

/** Caja del atenuador con perilla (la perilla es un control de la capa de manipulación). */
function DimmerBox({ lampAt, on }: { lampAt: number; on: boolean }) {
  return (
    <g>
      <path d={`M60 ${BENCH_Y - 4} C${(60 + lampAt) / 2} ${BENCH_Y + 2} ${(60 + lampAt) / 2} ${BENCH_Y - 2} ${lampAt - 24} ${BENCH_Y - 3}`} fill="none" stroke="#22292b" strokeWidth="2.4" strokeLinecap="round" />
      <ContactShadow x={10} y={BENCH_Y} w={76} />
      <rect x={10} y={386} width={76} height={BENCH_Y - 386} rx={7} fill="url(#kit-body-dark)" stroke="#0f1517" strokeWidth="1" />
      <rect x={13} y={388} width={70} height={5} rx={2.5} fill="#fff" opacity="0.08" />
      <circle cx={76} cy={396} r={2.6} fill={on ? '#7CFFB2' : '#33403f'} />
      <text x={22} y={399} style={{ fontSize: 7.5, fill: '#cfd8db', fontWeight: 700, letterSpacing: 0.4 }}>ATENUADOR</text>
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function EcosystemLab({ api }: LabProps) {
  const [lightHours, setLightHours] = useState(ECO_DEFAULT.lightHours);
  const [dimmer, setDimmer] = useState(ECO_DEFAULT.dimmer);
  const [distance, setDistance] = useState(ECO_DEFAULT.distance);
  const [plants, setPlants] = useState(ECO_DEFAULT.plants);
  const [snails, setSnails] = useState(ECO_DEFAULT.snails);
  const [fish, setFish] = useState(ECO_DEFAULT.fish);
  const [food, setFood] = useState<FoodLevel>(ECO_DEFAULT.food);
  const [decomposers, setDecomposers] = useState(ECO_DEFAULT.decomposers);
  const [day, setDay] = useState(7);
  const [time, setTime] = useState<ReadTime>('amanecer');
  const [phase, setPhase] = useState<Phase>('listo');
  const [simH, setSimH] = useState(0);
  const [drag, setDrag] = useState<{ kind: Kind; from: 'jar' | 'cup' } | null>(null);
  const raf = useRef(0);

  /* --------------------------- modelo */
  const sim = useMemo(() => simulateEcosystem({ lightHours, dimmer, distance, plants, snails, fish, food, decomposers }),
    [lightHours, dimmer, distance, plants, snails, fish, food, decomposers]);
  const foodInfo = findFood(food);
  const targetH = day * 24 + (time === 'tarde' ? 12 : 0);
  const measured = useMemo(() => stateAt(sim, day, time), [sim, day, time]);
  const dayInfo = sim.days[day];

  /* --------------------------- instrumentos (ficha de la práctica o, si no está integrada, la del modelo) */
  const spec = (id: string) => INSTRUMENTS.ecosistema?.find((i) => i.id === id) ?? ECO_INSTRUMENTS.find((i) => i.id === id)!;
  const odSpec = spec('oximetro'), phSpec = spec('carta'), countSpec = spec('conteo'), bioSpec = spec('biomasa');
  const { measure, remeasure } = useMeasure();
  const readings = useMemo(() => ({
    od: measure(measured.o2, { ...odSpec, key: 'od' }),
    ph: phChartReading(measure(measured.pH, { ...phSpec, key: 'ph' })),
    snails: measure(countOf(measured.snails), { ...countSpec, key: 'caracoles' }),
    fish: countOf(measured.fish),
    elodea: measure(measured.elodea, { ...bioSpec, key: 'biomasa' }),
  }), [measure, measured, odSpec, phSpec, countSpec, bioSpec]);

  /* --------------------------- fases: armar → simular días (cámara rápida) → medir */
  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setSimH(0); };
  useEffect(reset, [lightHours, dimmer, distance, plants, snails, fish, food, decomposers, day, time]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const simulate = () => {
    cancelAnimationFrame(raf.current);
    remeasure('od', 'ph', 'caracoles', 'biomasa');
    playSound('click', { intensity: 0.6 });
    if (prefersReducedMotion() || targetH === 0) { setSimH(targetH); setPhase('medido'); playSound('beep'); return; }
    runFrom(0);
  };
  /** Avanza la animación desde la hora simulada h0 (0 al iniciar; la hora en pausa al reanudar). */
  const runFrom = (h0: number) => {
    cancelAnimationFrame(raf.current);
    setSimH(h0);
    setPhase('simulando');
    const total = Math.min(3200, 500 + targetH * 4);
    const start = performance.now() - (targetH > 0 ? (h0 / targetH) * total : 0);
    const tick = (now: number) => {
      const q = clamp01(Math.max(0, now - start) / total);
      setSimH(q * targetH);
      if (q >= 1) { setPhase('medido'); playSound('beep'); playSound('glassClink', { intensity: 0.4, delay: 0.15 }); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const done = phase === 'medido';
  useSoundLoop('bubbling', phase === 'simulando', 0.25);

  /* --------------------------- estado que se dibuja */
  const shownH = phase === 'listo' ? 0 : phase === 'medido' ? targetH : simH;
  const dIdx = Math.min(MAX_DAY, Math.floor(shownH / 24));
  const hourOfDay = shownH - dIdx * 24;
  const vis: EcoState = phase === 'listo' ? sim.days[0].dawn : hourOfDay < 12 ? sim.days[dIdx].dawn : sim.days[dIdx].dusk;
  const lampWorks = lightHours > 0 && dimmer > 0;
  const lit = phase === 'listo' ? lampWorks : phase === 'medido' ? (time === 'tarde' ? lightHours > 12 && dimmer > 0 : false) : hourOfDay < lightHours && dimmer > 0;
  const clockH = (6 + Math.floor(hourOfDay)) % 24;
  const clockText = `Día ${dIdx} · ${pad2(clockH)}:00`;
  const glow = clamp01(sim.par / 600);
  const lx = lampX(distance);

  // organismos visibles
  const sprigs = plants > 0 && vis.elodea > 0.3 ? plants : 0;
  const perSprig = sprigs > 0 ? vis.elodea / sprigs : 0;
  const sprigH = Math.max(30, Math.min(255, 125 * Math.sqrt(perSprig / SPRIG_G) * (perSprig / SPRIG_G > 1 ? 1.15 : 1)));
  const health = clamp01((vis.elodea / Math.max(0.1, plants * SPRIG_G) - 0.55) / 0.45);
  const leaf = mix('#a39445', '#3f8f3a', health);
  const nSnails = Math.min(SNAIL_POS.length, countOf(vis.snails));
  const nFish = countOf(vis.fish);
  const deadFish = Math.max(0, fish - nFish);
  const deadShells = Math.min(DEAD_SHELL.length, Math.max(0, snails - nSnails));
  const bubbles = lit && vis.o2 > 8.5 ? Math.min(6, Math.round((vis.o2 - 8.5) * 2)) : 0;
  const algaeTint = Math.min(0.62, vis.algae / 18);
  const specks = Math.min(80, Math.round(vis.detritus / 4));
  const swim = prefersReducedMotion() ? 0 : 1;

  const rnd = useMemo(() => {
    const r = seeded(20251);
    return {
      specks: Array.from({ length: 80 }, () => ({ x: JAR.l + 8 + r() * (JAR.r - JAR.l - 16), y: JAR.sed + 1 + r() * 6, rx: 1 + r() * 1.6, c: r() })),
      grains: Array.from({ length: 70 }, () => ({ x: JAR.l + 6 + r() * (JAR.r - JAR.l - 12), y: JAR.sed + 5 + r() * 24, r: 0.6 + r() * 1.3, c: r() })),
      flakes: Array.from({ length: 14 }, () => ({ x: JAR.l + 20 + r() * (JAR.r - JAR.l - 60), dy: r() * 5, r: 1.6 + r() * 1.4, c: r() })),
    };
  }, []);
  const flakeN = phase === 'listo' ? 0 : food === 'ninguno' ? 0 : food === 'poco' ? 2 : food === 'normal' ? 4 : 14;

  /* --------------------------- cambios con sonido (panel y escena comparten el mismo estado) */
  const changeCount = (kind: Kind, v: number) => {
    const [cur, set] = kind === 'snail' ? [snails, setSnails] : kind === 'fish' ? [fish, setFish] : [plants, setPlants];
    if (v === cur) return;
    set(v);
    if (v > cur) playSound(kind === 'snail' ? 'drop' : 'splash', { intensity: kind === 'fish' ? 0.35 : 0.25 });
    else playSound('drips', { duration: 0.25, intensity: 0.35 });
  };
  const changeDimmer = (v: number) => { if (v !== dimmer) { setDimmer(v); playSound('knob'); if ((v === 0) !== (dimmer === 0)) playSound('switch'); } };
  const changeDistance = (v: number) => { if (v !== distance) { setDistance(v); playSound('tick', { intensity: 0.35 }); } };
  const changeHours = (v: number) => { if (v !== lightHours) { setLightHours(v); playSound((v === 0) !== (lightHours === 0) ? 'switch' : 'tick', { intensity: 0.4 }); } };

  /* --------------------------- registro */
  const record = () => api.addTrial('frasco', {
    dia: day, hora: READ_TIME_LABEL[time], horasLuz: lightHours, intensidad: dimmer, distancia: distance, luz: Math.round(sim.par),
    ramitas: plants, caracoles0: snails, peces0: fish, alimento: foodInfo.name, alimentoMg: foodInfo.mgPerDay, descomponedores: decomposers ? 'Sí' : 'No',
    od: readings.od, saturacion: Math.round(o2Saturation(readings.od)), indicador: bromothymolName(measured.pH), ph: readings.ph,
    caracoles: readings.snails, peces: readings.fish, elodea: readings.elodea, agua: waterLook(measured.algae),
  });

  /* --------------------------- series para las gráficas (registro del día 0 al día medido) */
  const upTo = done ? day : -1;
  const o2Series = useMemo(() => upTo < 0 ? [] : [
    { label: 'O₂ al amanecer (6:00)', color: 'var(--series-1)', kind: 'both' as const, points: sim.days.slice(0, upTo + 1).map((d) => ({ x: d.day, y: Number(d.dawn.o2.toFixed(2)) })) },
    { label: 'O₂ en la tarde (18:00)', color: 'var(--series-2)', kind: 'both' as const, dashed: true, points: sim.days.slice(0, upTo + 1).map((d) => ({ x: d.day, y: Number(d.dusk.o2.toFixed(2)) })) },
  ], [sim, upTo]);
  const popSeries = useMemo(() => upTo < 0 ? [] : [
    { label: 'Caracoles', color: 'var(--series-3)', kind: 'both' as const, points: sim.days.slice(0, upTo + 1).map((d) => ({ x: d.day, y: countOf(d.dawn.snails) })) },
    { label: 'Peces', color: 'var(--series-4)', kind: 'both' as const, points: sim.days.slice(0, upTo + 1).map((d) => ({ x: d.day, y: countOf(d.dawn.fish) })) },
    { label: 'Elodea (g)', color: 'var(--series-5)', kind: 'line' as const, points: sim.days.slice(0, upTo + 1).map((d) => ({ x: d.day, y: Number(d.dawn.elodea.toFixed(2)) })) },
    { label: 'Capacidad de carga de caracoles K', color: 'var(--series-6)', kind: 'line' as const, dashed: true, points: sim.days.slice(0, upTo + 1).map((d) => ({ x: d.day, y: Number(d.snailK.toFixed(2)) })) },
  ], [sim, upTo]);

  const events = useMemo(() => {
    if (!done) return [];
    const list = [...sim.warnings];
    if (sim.hypoxiaDay !== null && sim.hypoxiaDay <= day) list.push(`Desde el amanecer del día ${sim.hypoxiaDay} el oxígeno quedó por debajo de ${fmt(O2_CRIT_FISH, 1)} mg/L, el mínimo que tolera un pez.`);
    if (fish > 0 && sim.fishGoneDay !== null && sim.fishGoneDay <= day) list.push(`El último pez murió durante el día ${sim.fishGoneDay - 1}.`);
    if (snails > 0 && sim.snailsGoneDay !== null && sim.snailsGoneDay <= day) list.push(`Los caracoles desaparecieron durante el día ${sim.snailsGoneDay - 1}.`);
    return list;
  }, [done, sim, day, fish, snails]);

  /* --------------------------- textos */
  const show = (t: string) => (done ? t : '—');
  const desc = `Frasco sellado con ${plants} ${plants === 1 ? 'ramita' : 'ramitas'} de elodea, ${snails} ${snails === 1 ? 'caracol' : 'caracoles'} y ${fish} ${fish === 1 ? 'guppy' : 'guppys'}, sedimento ${decomposers ? 'de ciénaga con descomponedores' : 'de arena hervida sin descomponedores'} y alimento: ${foodInfo.name.toLowerCase()}. `
    + `Lámpara a ${fmt(distance, 0)} cm al ${fmt(dimmer, 0)} % durante ${fmt(lightHours, 0)} h al día (${fmt(sim.par, 0)} µmol/(m²·s) en el vidrio). `
    + (done ? `Lectura del día ${day} (${READ_TIME_LABEL[time].toLowerCase()}): oxígeno ${fmt(readings.od, 1)} mg/L, indicador ${bromothymolName(measured.pH)} (pH ${fmt(readings.ph, 1)}), ${readings.snails} caracoles y ${readings.fish} peces vivos.` : 'Aún no se ha medido.');

  const beamTop = { x: lx + 56, y1: HEAD_Y - 24, y2: HEAD_Y + 24 };
  const spread = (JAR.l - beamTop.x) * 0.9;

  /* --------------------------- controles de la escena para cada tipo de organismo */
  const organismHandles = (kind: Kind) => {
    const cfg = {
      snail: { value: snails, max: ECO_LIMITS.snails[1], name: 'caracol', names: 'caracoles', jarLabel: 'Caracoles dentro del frasco (arrastra uno afuera para sacarlo)', cupLabel: 'Reserva de caracoles (arrastra uno al frasco)' },
      fish: { value: fish, max: ECO_LIMITS.fish[1], name: 'guppy', names: 'guppys', jarLabel: 'Guppys dentro del frasco (arrastra uno afuera para sacarlo)', cupLabel: 'Reserva de guppys (arrastra uno al frasco)' },
      plant: { value: plants, max: ECO_LIMITS.plants[1], name: 'ramita', names: 'ramitas de elodea', jarLabel: 'Elodea dentro del frasco (arrastra una ramita afuera para sacarla)', cupLabel: 'Reserva de elodea (arrastra una ramita al frasco)' },
    }[kind];
    const ghost = (p: Pt): ReactNode => kind === 'snail' ? <Snail x={p.x} y={p.y + 4} s={1.6} />
      : kind === 'fish' ? <Guppy x={p.x} y={p.y} s={1.4} />
        : <Elodea x={p.x} base={p.y + 30} h={60} color="#3f8f3a" sway={6} />;
    const zone = ZONE[kind], cup = CUP[kind];
    const text = (v: number) => `${v} ${v === 1 ? cfg.name : cfg.names} en el frasco`;
    return (
      <g key={kind}>
        <DragHandle label={cfg.jarLabel} value={cfg.value} min={0} max={cfg.max} step={1} pageStep={1} commit="end"
          affordance={false}
          hit={{ x: zone.x, y: zone.y, w: zone.w, h: zone.h }} valueText={text}
          valueFromPoint={({ point, startValue }) => (inJar(point) ? startValue : startValue - 1)}
          onDragChange={(d) => setDrag(d ? { kind, from: 'jar' } : null)}
          onChange={(v) => changeCount(kind, v)}>
          {({ dragging, point }) => dragging && point && cfg.value > 0 && (
            <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
              <rect x={cup.x - 6} y={cup.y - 30} width={cup.w + 12} height={cup.h + 36} rx={8} fill="var(--accent)" opacity={inJar(point) ? 0.05 : 0.16} />
              <g opacity="0.85">{ghost(point)}</g>
            </g>
          )}
        </DragHandle>
        <DragHandle label={cfg.cupLabel} value={cfg.value} min={0} max={cfg.max} step={1} pageStep={1} commit="end"
          affordance={drag === null && cfg.value < cfg.max}
          hit={{ x: cup.x - 2, y: cup.y - 16, w: cup.w + 4, h: cup.h + 16 }} valueText={text}
          valueFromPoint={({ point, startValue }) => (inJar(point) ? startValue + 1 : startValue)}
          onDragChange={(d) => setDrag(d ? { kind, from: 'cup' } : null)}
          onChange={(v) => changeCount(kind, v)}>
          {({ dragging, point }) => dragging && point && cfg.value < cfg.max && (
            <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
              <rect x={JAR.l - 4} y={JAR.lidTop} width={JAR.r - JAR.l + 8} height={BENCH_Y - JAR.lidTop} rx={12} fill="var(--accent)" opacity={inJar(point) ? 0.16 : 0.05} />
              <g opacity="0.85">{ghost(point)}</g>
            </g>
          )}
        </DragHandle>
      </g>
    );
  };

  const hint = 'Arrastra caracoles, guppys o ramitas de elodea desde la reserva hasta el frasco (o del frasco a la reserva). Arrastra la lámpara para acercarla o alejarla y gira la perilla del atenuador. Con Tab puedes enfocar cada pieza y cambiarla con las flechas.';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo: ecosistema en un frasco">
          <ManipScene viewBox={VIEW} label="Controles del frasco, la lámpara y la reserva de organismos" scene={
            <svg viewBox={VIEW} role="img" aria-labelledby="eco-t eco-d">
              <title id="eco-t">Ecosistema cerrado en un frasco iluminado por una lámpara</title>
              <desc id="eco-d">{desc}</desc>
              <EcoDefs beam={lit ? 0.35 + 0.65 * glow : 0} />
              <BenchTop y={BENCH_Y} width={W} />

              {/* reloj del experimento */}
              <g>
                <g filter="url(#kit-shadow-soft)"><rect x={14} y={14} width={172} height={58} rx={9} fill="url(#kit-body-dark)" stroke="#0f1517" /></g>
                <text x={24} y={30} style={{ fontSize: 8.5, fill: '#cfd8db', fontWeight: 700, letterSpacing: 0.5 }}>TIEMPO SIMULADO</text>
                <Lcd x={22} y={36} w={156} h={28} text={clockText} />
                <circle cx={172} cy={26} r={4} fill={lit ? '#ffd54a' : '#33403f'} stroke="#0f1517" strokeWidth="0.6" />
              </g>

              {/* lámpara, haz de luz y atenuador */}
              {lit && (
                <path d={`M${beamTop.x} ${beamTop.y1} L${JAR.l} ${HEAD_Y - 24 - spread} L${JAR.l} ${HEAD_Y + 24 + spread} L${beamTop.x} ${beamTop.y2} Z`} fill="url(#eco-beam)" />
              )}
              <DimmerBox lampAt={lx} on={lampWorks} />
              <Lamp x={lx} on={lit} glow={glow} />
              <text x={lx + 30} y={HEAD_Y - 60} textAnchor="middle" className="scene-label" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{fmt(distance, 0)} cm</text>
              <line x1={lx + 58} x2={JAR.l - 2} y1={HEAD_Y + 44} y2={HEAD_Y + 44} stroke="var(--ink-2)" strokeWidth="0.8" strokeDasharray="3 3" />
              <text x={(lx + 58 + JAR.l) / 2} y={HEAD_Y + 57} textAnchor="middle" className="scene-label" style={{ fontSize: 9.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(sim.par, 0)} µmol/(m²·s)</text>

              {/* frasco: vidrio posterior, agua, sedimento y organismos */}
              <ContactShadow x={JAR.l - 8} y={BENCH_Y} w={JAR.r - JAR.l + 16} h={10} />
              <path d={`M${JAR.l} ${JAR.shoulder} Q${JAR.l} ${JAR.lidBottom + 4} ${JAR.neckL} ${JAR.lidBottom + 2} L${JAR.neckR} ${JAR.lidBottom + 2} Q${JAR.r} ${JAR.lidBottom + 4} ${JAR.r} ${JAR.shoulder} L${JAR.r} ${BENCH_Y - 14} Q${JAR.r} ${BENCH_Y} ${JAR.r - 14} ${BENCH_Y} L${JAR.l + 14} ${BENCH_Y} Q${JAR.l} ${BENCH_Y} ${JAR.l} ${BENCH_Y - 14} Z`} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
              <path d={`M${JAR.l + 4} ${JAR.water} L${JAR.r - 4} ${JAR.water} L${JAR.r - 4} ${JAR.bottom - 10} Q${JAR.r - 4} ${JAR.bottom} ${JAR.r - 14} ${JAR.bottom} L${JAR.l + 14} ${JAR.bottom} Q${JAR.l + 4} ${JAR.bottom} ${JAR.l + 4} ${JAR.bottom - 10} Z`} fill="url(#eco-water)" />
              {lit && <path d={`M${JAR.l + 4} ${HEAD_Y - 24 - spread} L${JAR.r - 30} ${HEAD_Y - 70 - spread} L${JAR.r - 30} ${Math.min(JAR.sed, HEAD_Y + 90 + spread)} L${JAR.l + 4} ${HEAD_Y + 24 + spread} Z`} fill="url(#eco-shaft)" />}
              {algaeTint > 0.01 && <rect x={JAR.l + 4} y={JAR.water} width={JAR.r - JAR.l - 8} height={JAR.sed - JAR.water + 4} fill="#4f9a2e" opacity={algaeTint} />}
              <rect x={JAR.l + 4} y={JAR.water} width={JAR.r - JAR.l - 8} height={JAR.bottom - JAR.water} fill="url(#kit-liquid-shade)" opacity="0.6" />
              {/* sedimento */}
              <path d={`M${JAR.l + 4} ${JAR.sed + 4} Q${JAR.l + 60} ${JAR.sed - 3} ${(JAR.l + JAR.r) / 2} ${JAR.sed + 1} T${JAR.r - 4} ${JAR.sed + 2} L${JAR.r - 4} ${JAR.bottom - 10} Q${JAR.r - 4} ${JAR.bottom} ${JAR.r - 14} ${JAR.bottom} L${JAR.l + 14} ${JAR.bottom} Q${JAR.l + 4} ${JAR.bottom} ${JAR.l + 4} ${JAR.bottom - 10} Z`} fill={decomposers ? 'url(#eco-mud)' : 'url(#eco-sand)'} />
              {rnd.grains.map((g, i) => <circle key={i} cx={g.x} cy={g.y} r={g.r} fill={decomposers ? (g.c > 0.6 ? '#2a1c10' : '#8a6a46') : (g.c > 0.5 ? '#b49c6a' : '#f3e7c8')} opacity="0.8" />)}
              {rnd.specks.slice(0, specks).map((s, i) => <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={0.9} fill={s.c > 0.7 ? '#5d6b2e' : s.c > 0.35 ? '#6e4b26' : '#3d2a17'} opacity="0.9" />)}
              {/* elodea */}
              {Array.from({ length: sprigs }, (_, i) => (
                <Elodea key={i} x={SPRIG_X[i % SPRIG_X.length]} base={JAR.sed + 4} h={sprigH * (0.86 + ((i * 7) % 5) * 0.06)} color={leaf} sway={(i % 2 ? 1 : -1) * (6 + (i % 3) * 3)} bubbles={bubbles} />
              ))}
              {/* restos de organismos muertos */}
              {DEAD_SHELL.slice(0, deadShells).map((p, i) => <Snail key={`ds${i}`} x={p.x} y={p.y} s={1.3} dead />)}
              {DEAD_FISH.slice(0, deadFish).map((p, i) => <Guppy key={`df${i}`} x={p.x} y={p.y} dead s={1.4} flip={i % 2 === 1} />)}
              {/* caracoles y guppys vivos */}
              {SNAIL_POS.slice(0, nSnails).map((p, i) => <Snail key={`s${i}`} x={p.x} y={p.y} rot={p.rot} flip={p.flip} s={i < snails ? 1.45 : 1} />)}
              {FISH_POS.slice(0, nFish).map((p, i) => <Guppy key={`f${i}`} x={p.x} y={p.y} flip={p.flip} s={1.6} swim={swim * p.dur} />)}
              {/* alimento que flota */}
              {rnd.flakes.slice(0, flakeN).map((f, i) => <Flake key={i} x={f.x} y={JAR.water + 3 + f.dy} r={f.r} c={f.c > 0.5 ? '#d9822b' : '#c2452d'} />)}
              {/* sonda del oxímetro */}
              <rect x={PROBE_X - 3} y={JAR.lidTop - 22} width={6} height={JAR.lidTop + 22 - (JAR.lidTop - 22)} rx={2} fill="#2a3336" />
              <rect x={PROBE_X - 2.4} y={JAR.lidTop} width={4.8} height={300 - JAR.lidTop} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.4" />
              <rect x={PROBE_X - 3.2} y={292} width={6.4} height={12} rx={2} fill="#1f2628" />
              {/* vidrio frontal y tapa */}
              <path d={`M${JAR.l} ${JAR.shoulder} Q${JAR.l} ${JAR.lidBottom + 4} ${JAR.neckL} ${JAR.lidBottom + 2} L${JAR.neckR} ${JAR.lidBottom + 2} Q${JAR.r} ${JAR.lidBottom + 4} ${JAR.r} ${JAR.shoulder} L${JAR.r} ${BENCH_Y - 14} Q${JAR.r} ${BENCH_Y} ${JAR.r - 14} ${BENCH_Y} L${JAR.l + 14} ${BENCH_Y} Q${JAR.l} ${BENCH_Y} ${JAR.l} ${BENCH_Y - 14} Z`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.8" />
              <path d={`M${JAR.l + 4} ${JAR.water - 2} Q${JAR.l + 6} ${JAR.water + 1} ${JAR.l + 12} ${JAR.water + 1} L${JAR.r - 12} ${JAR.water + 1} Q${JAR.r - 6} ${JAR.water + 1} ${JAR.r - 4} ${JAR.water - 2}`} fill="none" stroke="#4d8ea3" strokeWidth="1.2" opacity="0.8" />
              <rect x={JAR.l + 10} y={JAR.shoulder + 6} width={4} height={BENCH_Y - JAR.shoulder - 40} rx={2} fill="#fff" opacity="0.4" />
              <rect x={JAR.r - 22} y={JAR.shoulder + 12} width={2.4} height={BENCH_Y - JAR.shoulder - 90} rx={1.2} fill="#fff" opacity="0.22" />
              <rect x={JAR.neckL - 6} y={JAR.lidTop} width={JAR.neckR - JAR.neckL + 12} height={JAR.lidBottom - JAR.lidTop} rx={4} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.8" />
              {Array.from({ length: 16 }, (_, i) => <line key={i} x1={JAR.neckL + i * 10.5} x2={JAR.neckL + i * 10.5} y1={JAR.lidTop + 3} y2={JAR.lidBottom - 3} stroke="#7d8a8e" strokeWidth="0.6" opacity="0.6" />)}
              <circle cx={JAR.neckL + 40} cy={JAR.lidTop + 1} r={5} fill="#3a2f2a" stroke="#1f1714" strokeWidth="0.6" />
              <text x={JAR.neckL} y={JAR.lidTop - 8} className="scene-label" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>Frasco sellado · 3 L · 26 °C</text>
              <text x={JAR.r - 10} y={JAR.bottom - 7} textAnchor="end" style={{ fontSize: 8.5, fontWeight: 700, fill: decomposers ? '#f4e9d8' : '#5b4a2a' }}>{decomposers ? 'lodo de ciénaga' : 'arena hervida'}</text>

              {/* cable de la sonda y oxímetro */}
              <path d={`M${PROBE_X} ${JAR.lidTop - 22} C${PROBE_X + 6} ${JAR.lidTop - 70} ${640} ${120} ${641} ${324}`} fill="none" stroke="#22292b" strokeWidth="2.4" strokeLinecap="round" />
              <Oximeter text={done ? fmt(readings.od, 1) : '- - -'} />

              {/* muestra con azul de bromotimol y carta de colores */}
              <g>
                <ContactShadow x={700} y={BENCH_Y} w={40} h={6} />
                <rect x={700} y={360} width={40} height={4} rx={1.5} fill="url(#kit-metal)" />
                <rect x={702} y={364} width={3} height={BENCH_Y - 364} fill="url(#kit-metal-h)" />
                <rect x={735} y={364} width={3} height={BENCH_Y - 364} fill="url(#kit-metal-h)" />
                <TestTube x={710} y={318} w={20} h={112} fill={done ? 0.55 : 0} liquid={bromothymolColor(measured.pH)} liquidOpacity={0.85} />
                <text x={720} y={300} textAnchor="middle" className="scene-label" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>muestra +</text>
                <text x={720} y={310} textAnchor="middle" className="scene-label" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>bromotimol</text>
              </g>
              <ColorChart reading={done ? readings.ph : null} />

              {/* reserva de organismos */}
              <g>
                <text x={904} y={326} textAnchor="middle" className="scene-label" style={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 700 }}>Reserva</text>
                <ContactShadow x={828} y={BENCH_Y} w={150} h={8} />
                <rect x={828} y={428} width={150} height={12} rx={4} fill="url(#eco-plastic)" stroke="#9aa8ac" strokeWidth="0.8" />
                <Beaker x={CUP.snail.x} y={CUP.snail.y} w={CUP.snail.w} h={CUP.snail.h} fill={0.55} liquid="#7fb8dc" liquidOpacity={0.35}>
                  {Array.from({ length: Math.min(6, ECO_LIMITS.snails[1] - snails) }, (_, i) => <Snail key={i} x={CUP.snail.x + 9 + (i % 3) * 11} y={CUP.snail.y + CUP.snail.h - 4 - Math.floor(i / 3) * 9} s={0.75} flip={i % 2 === 1} />)}
                </Beaker>
                <Beaker x={CUP.fish.x} y={CUP.fish.y} w={CUP.fish.w} h={CUP.fish.h} fill={0.72} liquid="#7fb8dc" liquidOpacity={0.4}>
                  {Array.from({ length: ECO_LIMITS.fish[1] - fish }, (_, i) => <Guppy key={i} x={CUP.fish.x + 16 + (i % 2) * 12} y={CUP.fish.y + 34 + i * 9} s={0.6} flip={i % 2 === 1} />)}
                </Beaker>
                <Beaker x={CUP.plant.x} y={CUP.plant.y} w={CUP.plant.w} h={CUP.plant.h} fill={0.6} liquid="#7fb8dc" liquidOpacity={0.35}>
                  {Array.from({ length: ECO_LIMITS.plants[1] - plants }, (_, i) => <Elodea key={i} x={CUP.plant.x + 8 + i * 5} base={CUP.plant.y + CUP.plant.h - 4} h={58 + (i % 3) * 6} color="#3f8f3a" sway={(i % 2 ? 1 : -1) * 4} />)}
                </Beaker>
                <text x={CUP.snail.x + CUP.snail.w / 2} y={CUP.snail.y - 22} textAnchor="middle" className="scene-label" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>caracoles</text>
                <text x={CUP.fish.x + CUP.fish.w / 2} y={CUP.fish.y - 10} textAnchor="middle" className="scene-label" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>guppys</text>
                <text x={CUP.plant.x + CUP.plant.w / 2} y={CUP.plant.y - 22} textAnchor="middle" className="scene-label" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>elodea</text>
              </g>

              {/* noche: la escena se oscurece mientras la lámpara está apagada en la cámara rápida */}
              {phase !== 'listo' && !lit && <rect x={0} y={0} width={W} height={H} fill="#061424" opacity="0.2" style={{ pointerEvents: 'none' }} />}
            </svg>
          }>
            <Knob label="Perilla del atenuador de la lámpara" cx={48} cy={418} r={12} value={dimmer} min={ECO_LIMITS.dimmer[0]} max={ECO_LIMITS.dimmer[1]} step={5} pageStep={20} unit="%" decimals={0} onChange={changeDimmer} />
            <Plunger label="Lámpara: distancia al frasco" value={distance} min={ECO_LIMITS.distance[0]} max={ECO_LIMITS.distance[1]} step={1} pageStep={5} unit="cm" decimals={0}
              from={{ x: lampX(ECO_LIMITS.distance[0]) + 36, y: HEAD_Y }} to={{ x: lampX(ECO_LIMITS.distance[1]) + 36, y: HEAD_Y }} size={48}
              valueText={(v) => `lámpara a ${fmt(v, 0)} cm del frasco`} onChange={changeDistance} />
            {(['plant', 'snail', 'fish'] as Kind[]).map(organismHandles)}
          </ManipScene>
        </div>
        <ManipHint>{hint}</ManipHint>

        <div className="grid-2">
          <div className="stack">
            <h3>Mediciones del agua</h3>
            <Readout items={[
              { k: 'Día y hora de la lectura', v: `Día ${day} · ${READ_TIME_LABEL[time]}` },
              { k: 'Oxígeno disuelto (oxímetro)', v: show(`${fmt(readings.od, 1)} mg/L`), data: true },
              { k: 'Saturación de oxígeno', v: show(`${fmt(o2Saturation(readings.od), 0)} %`) },
              { k: 'Color del azul de bromotimol', v: show(bromothymolName(measured.pH)), data: true },
              { k: 'pH (carta de colores)', v: show(fmt(readings.ph, 1)), data: true },
            ]} />
          </div>
          <div className="stack">
            <h3>Organismos contados</h3>
            <Readout items={[
              { k: 'Caracoles vivos', v: show(String(readings.snails)), data: true },
              { k: 'Guppys vivos', v: show(String(readings.fish)), data: true },
              { k: 'Biomasa de elodea (estimada)', v: show(`${fmt(readings.elodea, 1)} g`), data: true },
              { k: 'Aspecto del agua', v: show(waterLook(measured.algae)) },
            ]} />
          </div>
        </div>
        {done && <Warnings list={events} />}

        <div className="grid-2">
          <div className="card">
            <Chart title="Oxígeno disuelto según el día" xLabel="Día" yLabel="Oxígeno disuelto (mg/L)" xUnit="día" yUnit="mg/L" height={240} exportName="ecosistema-oxigeno"
              xDomain={[0, Math.max(7, upTo)]} yDomain={[0, 13]} series={o2Series} hLines={[{ y: O2_CRIT_FISH, label: 'Mínimo para los peces' }]}
              emptyText="Pulsa «Simular y medir» para ver el registro del oxímetro." errorNote="Registro continuo de la sonda (valores del modelo)." />
          </div>
          <div className="card">
            <Chart title="Poblaciones según el día" xLabel="Día" yLabel="Individuos (elodea en g)" xUnit="día" height={240} exportName="ecosistema-poblaciones"
              xDomain={[0, Math.max(7, upTo)]} series={popSeries}
              emptyText="Pulsa «Simular y medir» para ver los conteos de cada día." errorNote="Conteos diarios al amanecer y capacidad de carga calculada por el modelo." />
          </div>
        </div>

        {done && (
          <details className="card">
            <summary>Dentro del frasco el día {day}: energía y materia (modelo)</summary>
            <Readout live={false} items={[
              { k: 'Fotosíntesis bruta del día (O₂ producido)', v: `${fmt(dayInfo.gpp, 1)} mg/L` },
              { k: 'Respiración de toda la comunidad (O₂ gastado)', v: `${fmt(dayInfo.respiration, 1)} mg/L` },
              { k: 'Parte gastada por los descomponedores', v: `${fmt(dayInfo.decomposition, 1)} mg/L` },
              { k: 'CO₂ disuelto', v: `${fmt(measured.co2, 1)} mg/L` },
              { k: 'Nutrientes disueltos (nitrógeno)', v: `${fmt(measured.nutrients, 2)} mg/L` },
              { k: 'Restos en el sedimento (detritos)', v: `${fmt(measured.detritus, 0)} mg` },
              { k: 'Capacidad de carga de caracoles K', v: `${fmt(dayInfo.snailK, 1)} caracoles` },
              { k: 'Microalgas', v: `${fmt(measured.algae, 2)} mg/L` },
            ]} />
            <p className="small muted">Si la fotosíntesis del día supera la respiración, el frasco gana oxígeno; si no, lo pierde. La energía de la lámpara se convierte en calor al pasar por la cadena alimentaria; el carbono y el nitrógeno, en cambio, vuelven al agua gracias a la respiración y a los descomponedores.</p>
          </details>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Luz</h3>
          <Slider label="Horas de luz por día" value={lightHours} min={ECO_LIMITS.lightHours[0]} max={ECO_LIMITS.lightHours[1]} step={1} unit="h" decimals={0} onChange={changeHours}
            hint="El temporizador enciende la lámpara a las 6:00." />
          <Slider label="Intensidad de la lámpara" value={dimmer} min={ECO_LIMITS.dimmer[0]} max={ECO_LIMITS.dimmer[1]} step={5} unit="%" decimals={0} onChange={changeDimmer} />
          <Slider label="Distancia de la lámpara al frasco" value={distance} min={ECO_LIMITS.distance[0]} max={ECO_LIMITS.distance[1]} step={1} unit="cm" decimals={0} onChange={changeDistance} />
          <p className="small muted" style={{ margin: 0 }}>Luz en la pared del frasco con la lámpara encendida: {fmt(sim.par, 0)} µmol/(m²·s).</p>
        </div>
        <div className="card stack">
          <h3>Organismos y sedimento</h3>
          <Slider label="Ramitas de elodea" value={plants} min={ECO_LIMITS.plants[0]} max={ECO_LIMITS.plants[1]} step={1} decimals={0} onChange={(v) => changeCount('plant', v)} />
          <Slider label="Número de caracoles" value={snails} min={ECO_LIMITS.snails[0]} max={ECO_LIMITS.snails[1]} step={1} decimals={0} onChange={(v) => changeCount('snail', v)} />
          <Slider label="Número de guppys" value={fish} min={ECO_LIMITS.fish[0]} max={ECO_LIMITS.fish[1]} step={1} decimals={0} onChange={(v) => changeCount('fish', v)} />
          <Select label="Alimento cada día" value={food} onChange={(v) => { setFood(v as FoodLevel); playSound('drop', { intensity: 0.4 }); }}
            options={FOODS.map((f) => ({ value: f.id, label: `${f.name}: ${fmt(f.mgPerDay, 0)} mg` }))} />
          <Segmented<'si' | 'no'> label="Descomponedores en el sedimento" value={decomposers ? 'si' : 'no'} onChange={(v) => { setDecomposers(v === 'si'); playSound('pour', { duration: 0.4, intensity: 0.3 }); }}
            options={[{ value: 'si', label: 'Sí (lodo de ciénaga)' }, { value: 'no', label: 'No (arena hervida)' }]} />
        </div>
        <div className="card stack">
          <h3>Medición</h3>
          <Slider label="Día de la medición" value={day} min={ECO_LIMITS.day[0]} max={ECO_LIMITS.day[1]} step={1} decimals={0} onChange={setDay} />
          <Segmented<ReadTime> label="Hora de la lectura" value={time} onChange={setTime}
            options={[{ value: 'amanecer', label: READ_TIME_LABEL.amanecer }, { value: 'tarde', label: READ_TIME_LABEL.tarde }]} />
          <SimControls title="Acuario" status={simStatusOf(phase === 'simulando', phase === 'pausa', done)} startLabel="Simular y medir" repeatLabel="Simular de nuevo"
            onStart={simulate} onPause={() => { cancelAnimationFrame(raf.current); setPhase('pausa'); }} onResume={() => runFrom(simH)} onReset={reset}
            progress={{ value: shownH, max: targetH, unit: 'h', label: 'Tiempo simulado' }} />
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>
          El frasco está sellado: no entra aire. Todo el oxígeno lo producen la elodea y las algas con la luz, y todos los organismos lo gastan al respirar,
          de día y de noche. La simulación empieza siempre con el frasco recién armado (día 0, 6:00).
        </Notice>
      </div>
    </div>
  );
}

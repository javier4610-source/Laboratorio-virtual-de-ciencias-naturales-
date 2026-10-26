import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ATOMIC_MASS_DECIMALS, AVOGADRO, BALANCE, BOAT_MASS, MOLE_INSTRUMENTS, MOLE_LIMITS, SUBSTANCES, countEntities, findMolReaction, findSubstance,
  molarMassInfo, molarVolumeL, readingDuring, readingSigFigs, ROOM, runMolReaction, STP, weigh,
  type MolReactionId, type Substance, type SubstanceId, type TareStatus,
} from '../models/mole';
import { CPK, prettyFormula } from '../models/balancing';
import { roundToResolution } from '../models/math';
import { fmt, fmtSig } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { resolutionText } from '../components/Experiment';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import type { ModelQuantity } from '../lib/advanced';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { Beaker, BenchTop, ContactShadow, Lcd, shade } from './kit';
import { DragHandle, ManipHint, ManipScene } from './manipulate';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 860, H = 470;
const VIEW = `0 0 ${W} ${H}`;
const BENCH_Y = 422;
/** Centro del plato de la balanza y altura de su cara superior. */
const PAN_X = 380;
const BODY_TOP = BENCH_Y - 60;
const PAN_Y = BODY_TOP - 18;
const SHIELD = { x0: PAN_X - 138, x1: PAN_X + 138, top: 150 };
/** Frasco de la muestra y espátula. */
const JAR = { x: 34, w: 104, top: 262 };
const SPOON_REST = { x: JAR.x + JAR.w / 2 + 8, y: JAR.top - 18 };
/** Navecilla: posición de reposo sobre la mesa y tamaño. */
const BOAT_REST = { x: 612, y: BENCH_Y };
const BOAT_W = 66, BOAT_H = 14;
/** Lupa del modelo de partículas. */
const LENS = { cx: 762, cy: 178, r: 76 };
/** Mechero y trípode (calentamiento). */
const BURNER_X = 680;
const TRIPOD_TOP = BENCH_Y - 120;

const REACT_MS = 3200;
const LIQUID_VINEGAR = '#f1e3b0';

type Activity = 'contar' | 'reaccion';
type Phase = 'montaje' | 'antes' | 'reaccion' | 'fin' | 'despues';

const reducedMotion = () => { try { return prefersReducedMotion(); } catch { return false; } };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Ficha del instrumento: la de src/labs/instruments.ts si ya está integrada; si no, la del modelo. */
const balanceSpec = () => INSTRUMENTS.mol?.find((i) => i.id === 'balanza') ?? MOLE_INSTRUMENTS[0];

/** Lectura de la pantalla con coma decimal y signo menos tipográfico. */
const lcdText = (v: number) => {
  const t = fmt(Math.abs(v), 3);
  return v < 0 && /[1-9]/.test(t) ? `−${t}` : t;
};

const ENTITY_ONE: Record<Substance['entity'], string> = { 'unidades fórmula': 'unidad fórmula', moléculas: 'molécula', átomos: 'átomo' };

const TARE_TEXT: Record<TareStatus, string> = {
  correcta: 'correcta (navecilla vacía)',
  'sin tarar': 'sin tarar: incluye la navecilla',
  'tarada con muestra': 'tarada con muestra: falta parte de la muestra',
  'sin navecilla': 'sin navecilla en el plato',
};

/* ------------------------------------------------------------------ piezas locales */

/** Balanza de precisión con cámara antiviento: `inside` se dibuja sobre el plato, detrás del vidrio frontal. */
function AnalyticalBalance({ reading, tareFlash, inside }: { reading: string; tareFlash: boolean; inside?: ReactNode }) {
  const x0 = PAN_X - 150, x1 = PAN_X + 150;
  return (
    <g>
      <ContactShadow x={x0 - 4} y={BENCH_Y} w={x1 - x0 + 8} h={10} />
      {/* panel trasero de la cámara */}
      <rect x={SHIELD.x0} y={SHIELD.top} width={SHIELD.x1 - SHIELD.x0} height={BODY_TOP - SHIELD.top} rx={3} fill="var(--surface-2)" opacity="0.55" />
      <rect x={SHIELD.x0} y={SHIELD.top} width={SHIELD.x1 - SHIELD.x0} height={BODY_TOP - SHIELD.top} rx={3} fill="url(#kit-glass-fill)" />
      {/* cuerpo */}
      <g filter="url(#kit-shadow)">
        <path d={`M${x0 + 10} ${BODY_TOP} L${x1 - 10} ${BODY_TOP} Q${x1} ${BODY_TOP} ${x1} ${BODY_TOP + 10} L${x1 + 6} ${BENCH_Y} L${x0 - 6} ${BENCH_Y} L${x0} ${BODY_TOP + 10} Q${x0} ${BODY_TOP} ${x0 + 10} ${BODY_TOP} Z`} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <rect x={x0 + 6} y={BENCH_Y - 7} width={x1 - x0 - 12} height={6} fill="#000" opacity="0.06" />
      {/* plato */}
      <rect x={PAN_X - 7} y={PAN_Y + 2} width={14} height={BODY_TOP - PAN_Y - 2} fill="url(#kit-metal-h)" />
      <ellipse cx={PAN_X} cy={PAN_Y + 3} rx={66} ry={5} fill="#000" opacity="0.12" />
      <rect x={PAN_X - 66} y={PAN_Y - 3} width={132} height={6} rx={3} fill="url(#kit-metal)" stroke="#8c979b" strokeWidth="0.7" />
      {inside}
      {/* vidrio frontal y marco */}
      <rect x={SHIELD.x0} y={SHIELD.top} width={SHIELD.x1 - SHIELD.x0} height={BODY_TOP - SHIELD.top} rx={3} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
      <rect x={SHIELD.x0 - 3} y={SHIELD.top - 8} width={SHIELD.x1 - SHIELD.x0 + 6} height={9} rx={2} fill="url(#kit-metal)" stroke="#8c979b" strokeWidth="0.7" />
      {/* puerta lateral corrida (abierta) */}
      <rect x={SHIELD.x1 - 6} y={SHIELD.top + 6} width={10} height={BODY_TOP - SHIELD.top - 10} rx={2} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="0.9" />
      <rect x={SHIELD.x1 + 1} y={SHIELD.top + 70} width={4} height={34} rx={2} fill="url(#kit-metal-h)" />
      <rect x={SHIELD.x0 + 12} y={SHIELD.top + 10} width={4} height={BODY_TOP - SHIELD.top - 30} rx={2} fill="#fff" opacity="0.35" />
      {/* panel frontal: pantalla y teclas */}
      <Lcd x={PAN_X - 64} y={BODY_TOP + 16} w={128} h={30} text={reading} unit="g" />
      <rect x={x0 + 20} y={BODY_TOP + 22} width={30} height={16} rx={3} fill={tareFlash ? 'var(--qui)' : 'url(#kit-body-dark)'} />
      <text x={x0 + 35} y={BODY_TOP + 52} textAnchor="middle" style={{ fontSize: 8, fill: '#55605f', fontWeight: 700 }}>TARA</text>
      <rect x={x1 - 50} y={BODY_TOP + 22} width={30} height={16} rx={3} fill="url(#kit-body-dark)" />
      <text x={x1 - 35} y={BODY_TOP + 52} textAnchor="middle" style={{ fontSize: 8, fill: '#55605f', fontWeight: 700 }}>I/O</text>
      <text x={PAN_X} y={BODY_TOP + 56} textAnchor="middle" style={{ fontSize: 7.5, fill: '#55605f' }}>máx. 220 g · d = 0,001 g</text>
    </g>
  );
}

/** Navecilla de pesaje de plástico con su contenido; la base queda en `y`. */
function Boat({ x, y, s, portions }: { x: number; y: number; s: Substance; portions: number }) {
  const top = y - BOAT_H;
  const hw = BOAT_W / 2, bw = BOAT_W / 2 - 8;
  return (
    <g>
      <ContactShadow x={x - hw} y={y} w={BOAT_W} h={5} opacity={0.7} />
      <path d={`M${x - hw} ${top} L${x + hw} ${top} L${x + bw} ${y} L${x - bw} ${y} Z`} fill="#eef3f5" stroke="#9fb0b6" strokeWidth="0.9" opacity="0.95" />
      <SampleInBoat x={x} y={y - 2} s={s} portions={portions} />
      <path d={`M${x - hw} ${top} L${x + hw} ${top}`} stroke="#8fa3aa" strokeWidth="1.4" />
      <path d={`M${x - hw + 3} ${top + 2} L${x - bw + 1} ${y - 1}`} stroke="#fff" strokeWidth="1" opacity="0.7" />
    </g>
  );
}

/** Contenido de la navecilla: montículo de polvo, líquido, trozos de tiza, puntillas, alambres o láminas. */
function SampleInBoat({ x, y, s, portions }: { x: number; y: number; s: Substance; portions: number }) {
  if (portions <= 0) return null;
  const edge = shade(s.color === '#f4f6f7' || s.color === '#fdfdfb' || s.color === '#f7f7f2' ? '#c9d1d6' : s.color, -0.3);
  switch (s.form) {
    case 'polvo': {
      const h = Math.min(18, 3 + portions * 1.6), w = Math.min(54, 26 + portions * 3);
      return (
        <g>
          <path d={`M${x - w / 2} ${y} Q${x - w / 4} ${y - h} ${x} ${y - h} Q${x + w / 4} ${y - h} ${x + w / 2} ${y} Z`} fill={s.color} stroke={edge} strokeWidth="0.7" />
          {Array.from({ length: 6 + portions * 2 }, (_, i) => <rect key={i} x={x - w / 2.6 + ((i * 37) % 100) / 100 * (w / 1.3)} y={y - 1.5 - ((i * 53) % 100) / 100 * h * 0.8} width={1.2} height={1.2} fill={edge} opacity="0.5" />)}
        </g>
      );
    }
    case 'liquido': {
      const h = Math.min(BOAT_H - 3, 1.5 + portions * 1.1);
      const hw = BOAT_W / 2 - 8 + (h / BOAT_H) * 8;
      return <path d={`M${x - hw + 1} ${y - h} L${x + hw - 1} ${y - h} L${x + BOAT_W / 2 - 9} ${y} L${x - BOAT_W / 2 + 9} ${y} Z`} fill={s.color} opacity="0.85" stroke={shade('#4f9fe0', -0.2)} strokeWidth="0.6" />;
    }
    case 'trozo':
      return <g>{Array.from({ length: portions }, (_, i) => {
        const px = x - 20 + (i % 4) * 13, py = y - 7 - Math.floor(i / 4) * 6;
        return <rect key={i} x={px} y={py} width={12} height={7} rx={2.5} fill={s.color} stroke="#b9bfb6" strokeWidth="0.7" transform={`rotate(${(i % 3 - 1) * 8} ${px + 6} ${py + 3.5})`} />;
      })}</g>;
    case 'puntilla':
      return <g>{Array.from({ length: portions }, (_, i) => {
        const py = y - 2 - i * 2.4, sk = (i % 2 ? 1 : -1) * 2;
        return (
          <g key={i}>
            <line x1={x - 24} y1={py + sk} x2={x + 22} y2={py - sk} stroke="url(#kit-metal-h)" strokeWidth="2" strokeLinecap="round" />
            <line x1={x - 24} y1={py + sk} x2={x + 22} y2={py - sk} stroke="#6d777c" strokeWidth="0.5" opacity="0.6" />
            <rect x={x - 26} y={py + sk - 2.5} width={2.4} height={5} rx={0.6} fill="#7d878c" />
          </g>
        );
      })}</g>;
    case 'alambre':
      return <g>{Array.from({ length: portions }, (_, i) => {
        const py = y - 2 - i * 2.3, sk = (i % 2 ? 1 : -1) * 1.5;
        return <line key={i} x1={x - 17} y1={py + sk} x2={x + 17} y2={py - sk} stroke={s.color} strokeWidth="2.2" strokeLinecap="round" />;
      })}</g>;
    case 'lamina':
      return <g>{Array.from({ length: portions }, (_, i) => {
        const py = y - 3 - i * 1.6, px = x - 16 + (i % 3) * 3;
        return <path key={i} d={`M${px} ${py} l10 -3 l12 2 l8 -2 l-2 4 l-10 1 l-12 -1 z`} fill={s.color} stroke="#9aa5ab" strokeWidth="0.6" />;
      })}</g>;
  }
}

/** Frasco de la muestra con etiqueta. */
function ReagentJar({ s }: { s: Substance }) {
  const { x, w, top } = JAR;
  const liquid = s.form === 'liquido';
  return (
    <g>
      <ContactShadow x={x} y={BENCH_Y} w={w} h={7} />
      <rect x={x + 10} y={top - 12} width={w - 20} height={14} rx={3} fill="url(#kit-body-dark)" />
      <path d={`M${x} ${top + 10} Q${x} ${top} ${x + 10} ${top} L${x + w - 10} ${top} Q${x + w} ${top} ${x + w} ${top + 10} L${x + w} ${BENCH_Y - 5} Q${x + w} ${BENCH_Y} ${x + w - 5} ${BENCH_Y} L${x + 5} ${BENCH_Y} Q${x} ${BENCH_Y} ${x} ${BENCH_Y - 5} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      <rect x={x + 3} y={top + 40} width={w - 6} height={BENCH_Y - top - 43} rx={4} fill={s.color} opacity={liquid ? 0.6 : 0.95} />
      {s.form === 'puntilla' && Array.from({ length: 9 }, (_, i) => <line key={i} x1={x + 10 + (i % 3) * 4} y1={top + 50 + i * 11} x2={x + w - 12 - (i % 2) * 6} y2={top + 46 + i * 11 + (i % 2 ? 4 : -3)} stroke="#6d777c" strokeWidth="2" />)}
      {s.form === 'alambre' && Array.from({ length: 9 }, (_, i) => <line key={i} x1={x + 12} y1={top + 52 + i * 11} x2={x + w - 14} y2={top + 48 + i * 11} stroke={shade(s.color, -0.25)} strokeWidth="2" />)}
      {(s.form === 'polvo' || s.form === 'trozo') && Array.from({ length: 22 }, (_, i) => <rect key={i} x={x + 8 + ((i * 29) % 88)} y={top + 46 + ((i * 41) % 100)} width={1.8} height={1.8} fill="#c3ccd0" />)}
      <rect x={x + 10} y={top + 66} width={w - 20} height={38} rx={3} fill="var(--surface)" stroke="var(--line)" />
      <text x={x + w / 2} y={top + 84} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{prettyFormula(s.formula)}</text>
      <text x={x + w / 2} y={top + 98} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>{s.name.split(' (')[0]}</text>
      <rect x={x + 8} y={top + 14} width={4} height={BENCH_Y - top - 30} rx={2} fill="#fff" opacity="0.4" />
    </g>
  );
}

/** Espátula (o pinzas para los trozos) con una porción. */
function Spatula({ x, y, s }: { x: number; y: number; s: Substance }) {
  const solidPiece = s.form === 'puntilla' || s.form === 'alambre' || s.form === 'lamina' || s.form === 'trozo';
  if (s.form === 'liquido') {
    return (
      <g>
        <rect x={x - 3} y={y - 54} width={6} height={50} rx={2} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" />
        <rect x={x - 2} y={y - 22} width={4} height={18} fill={s.color} opacity="0.8" />
        <ellipse cx={x} cy={y - 60} rx={6} ry={8} fill="#d84a4a" />
        <path d={`M${x - 2} ${y - 4} L${x} ${y + 3} L${x + 2} ${y - 4} Z`} fill="var(--glass-edge, #8fa9b3)" />
      </g>
    );
  }
  if (solidPiece) {
    return (
      <g>
        <path d={`M${x + 2} ${y - 2} L${x + 46} ${y - 22} M${x + 2} ${y + 2} L${x + 46} ${y - 16}`} stroke="url(#kit-metal-h)" strokeWidth="2.6" strokeLinecap="round" />
        <path d={`M${x + 2} ${y - 2} L${x + 46} ${y - 22} M${x + 2} ${y + 2} L${x + 46} ${y - 16}`} stroke="#7d8a8f" strokeWidth="0.5" />
        <SampleInBoat x={x - 4} y={y + 6} s={s} portions={1} />
      </g>
    );
  }
  return (
    <g>
      <line x1={x + 8} y1={y} x2={x + 52} y2={y - 16} stroke="url(#kit-metal-h)" strokeWidth="3.4" strokeLinecap="round" />
      <ellipse cx={x} cy={y + 1} rx={11} ry={4.5} fill="url(#kit-metal)" stroke="#7d8a8f" strokeWidth="0.8" />
      <ellipse cx={x} cy={y - 0.8} rx={7.5} ry={2.8} fill={s.color} stroke="#c9d1d6" strokeWidth="0.5" />
    </g>
  );
}

/** Modelo de partículas dentro de la lupa (ilustrativo, no a escala). */
function ParticleLens({ s }: { s: Substance }) {
  const { cx, cy, r } = LENS;
  const atom = (key: string | number, el: string, x: number, y: number, rr: number) => (
    <g key={key}>
      <circle cx={x} cy={y} r={rr} fill={CPK[el] ?? '#999'} stroke={shade(CPK[el] ?? '#999999', -0.4)} strokeWidth="0.6" />
      <circle cx={x - rr * 0.35} cy={y - rr * 0.35} r={rr * 0.35} fill="#fff" opacity="0.45" />
    </g>
  );
  const parts: ReactNode[] = [];
  const f = s.formula;
  if (f === 'NaCl') {
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      const na = (i + j) % 2 === 0;
      parts.push(atom(`${i}-${j}`, na ? 'Na' : 'Cl', cx + i * 17, cy + j * 17, na ? 5.5 : 8.5));
    }
  } else if (f === 'CaCO3' || f === 'NaHCO3') {
    const cat = f === 'CaCO3' ? 'Ca' : 'Na';
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const x = cx + i * 24 + (j % 2 ? 12 : 0), y = cy + j * 22;
      if ((i + j) % 2 === 0) parts.push(atom(`c${i}${j}`, cat, x, y, 7));
      else {
        const g: ReactNode[] = [];
        [0, 120, 240].forEach((a, k) => { const t = ((a + 90) * Math.PI) / 180; g.push(atom(k, 'O', x + 7 * Math.cos(t), y + 7 * Math.sin(t), 4.6)); });
        g.push(atom('C', 'C', x, y, 3.6));
        if (f === 'NaHCO3') g.push(atom('H', 'H', x + 11, y - 6, 2.4));
        parts.push(<g key={`a${i}${j}`}>{g}</g>);
      }
    }
  } else if (f === 'H2O') {
    for (let k = 0; k < 16; k++) {
      const a = k * 2.4, d = 14 + ((k * 37) % 50);
      const x = cx + d * Math.cos(a), y = cy + d * Math.sin(a), rot = (k * 47) % 360;
      const t1 = ((rot - 52) * Math.PI) / 180, t2 = ((rot + 52) * Math.PI) / 180;
      parts.push(<g key={k}>{atom('o', 'O', x, y, 6)}{atom('h1', 'H', x + 7 * Math.cos(t1), y + 7 * Math.sin(t1), 3.6)}{atom('h2', 'H', x + 7 * Math.cos(t2), y + 7 * Math.sin(t2), 3.6)}</g>);
    }
  } else if (f === 'C12H22O11') {
    [[-26, -22], [24, -30], [-6, 22], [36, 26], [-44, 30]].forEach(([dx, dy], m) => {
      const g: ReactNode[] = [];
      for (let k = 0; k < 11; k++) {
        const a = k * 0.57 + m, d = 4 + (k % 4) * 4.5;
        const x = cx + dx + d * Math.cos(a), y = cy + dy + d * Math.sin(a);
        g.push(atom(`h${k}`, 'H', x + 5, y - 4, 2.2));
        g.push(atom(`c${k}`, k % 3 === 0 ? 'O' : 'C', x, y, 4));
      }
      parts.push(<g key={m}>{g}</g>);
    });
  } else {
    const el = f;
    const rr = el === 'Al' ? 8 : 7.4;
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) parts.push(atom(`${i}-${j}`, el, cx + i * rr * 2 + (j % 2 ? rr : 0), cy + j * rr * 1.73, rr));
  }
  const kinds = Object.keys(molarMassInfo(s.formula).composition);
  return (
    <g>
      <clipPath id="mlr-lens"><circle cx={cx} cy={cy} r={r - 3} /></clipPath>
      <line x1={cx - r * 0.7} y1={cy + r * 0.7} x2={cx - r * 1.05} y2={cy + r * 1.05} stroke="url(#kit-body-dark)" strokeWidth="10" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="var(--surface)" />
      <g clipPath="url(#mlr-lens)">{parts}</g>
      <circle cx={cx} cy={cy} r={r} fill="url(#kit-glass)" stroke="url(#kit-metal-h)" strokeWidth="6" />
      <text x={cx} y={cy - r - 14} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)', fontWeight: 700 }}>Modelo de partículas</text>
      <text x={cx} y={cy + r + 20} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>Ilustrativo, no a escala</text>
      {kinds.map((el, i) => (
        <g key={el}>
          <circle cx={cx - (kinds.length - 1) * 21 + i * 42 - 9} cy={cy + r + 36} r={4.5} fill={CPK[el]} stroke={shade(CPK[el] ?? '#999999', -0.4)} strokeWidth="0.6" />
          <text x={cx - (kinds.length - 1) * 21 + i * 42 - 2} y={cy + r + 39.5} style={{ fontSize: 9.5, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{el}</text>
        </g>
      ))}
    </g>
  );
}

/** Crisol de porcelana con tapa; la base queda en `y`. */
function Crucible({ x, y, glow = 0 }: { x: number; y: number; glow?: number }) {
  return (
    <g>
      <path d={`M${x - 20} ${y - 30} L${x + 20} ${y - 30} L${x + 13} ${y} L${x - 13} ${y} Z`} fill="#f7f6f1" stroke="#b9b7ab" strokeWidth="1" />
      {glow > 0 && <path d={`M${x - 20} ${y - 30} L${x + 20} ${y - 30} L${x + 13} ${y} L${x - 13} ${y} Z`} fill="#ff7a2f" opacity={0.25 * glow} />}
      <path d={`M${x - 14} ${y - 28} L${x - 10} ${y - 3}`} stroke="#fff" strokeWidth="1.6" opacity="0.8" />
      <ellipse cx={x} cy={y - 31} rx={22} ry={3.2} fill="#ecebe4" stroke="#b9b7ab" strokeWidth="0.9" />
      <rect x={x - 3} y={y - 37} width={6} height={4} rx={1.5} fill="#ecebe4" stroke="#b9b7ab" strokeWidth="0.7" />
    </g>
  );
}

/** Mechero con trípode y triángulo de arcilla; la llama es ilustrativa. */
function BurnerStand({ lit, flicker, children }: { lit: boolean; flicker: number; children?: ReactNode }) {
  const x = BURNER_X;
  const fh = 34 + 4 * Math.sin(flicker * 19);
  return (
    <g>
      <ContactShadow x={x - 52} y={BENCH_Y} w={104} h={8} />
      {/* trípode */}
      <path d={`M${x - 46} ${BENCH_Y} L${x - 34} ${TRIPOD_TOP} M${x + 46} ${BENCH_Y} L${x + 34} ${TRIPOD_TOP} M${x} ${BENCH_Y - 2} L${x} ${BENCH_Y - 2}`} stroke="#5d6b70" strokeWidth="3" />
      <rect x={x - 40} y={TRIPOD_TOP - 3} width={80} height={5} rx={2} fill="#5d6b70" />
      {/* mechero */}
      <rect x={x - 16} y={BENCH_Y - 8} width={32} height={8} rx={2} fill="url(#kit-body-dark)" />
      <rect x={x - 5} y={BENCH_Y - 62} width={10} height={56} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.5" />
      {lit && (
        <g>
          <path d={`M${x - 7} ${BENCH_Y - 62} Q${x - 9} ${BENCH_Y - 62 - fh * 0.6} ${x} ${BENCH_Y - 62 - fh} Q${x + 9} ${BENCH_Y - 62 - fh * 0.6} ${x + 7} ${BENCH_Y - 62} Z`} fill="#4f7fe0" opacity="0.55" />
          <path d={`M${x - 3.5} ${BENCH_Y - 62} Q${x - 4.5} ${BENCH_Y - 62 - fh * 0.35} ${x} ${BENCH_Y - 62 - fh * 0.55} Q${x + 4.5} ${BENCH_Y - 62 - fh * 0.35} ${x + 3.5} ${BENCH_Y - 62} Z`} fill="#9fd0ff" opacity="0.8" />
        </g>
      )}
      {/* triángulo de arcilla */}
      <path d={`M${x - 30} ${TRIPOD_TOP - 3} L${x + 30} ${TRIPOD_TOP - 3}`} stroke="#d9c7a7" strokeWidth="3" />
      {children}
      <text x={x} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Mechero y trípode</text>
    </g>
  );
}

/** Botella de vinagre (decorado del montaje, sin función). */
function VinegarBottle() {
  const x = 650, top = BENCH_Y - 150;
  return (
    <g aria-hidden="true">
      <ContactShadow x={x - 26} y={BENCH_Y} w={52} h={7} />
      <rect x={x - 8} y={top - 22} width={16} height={12} rx={2} fill="#2f6e3a" />
      <path d={`M${x - 8} ${top - 10} L${x - 8} ${top + 10} Q${x - 26} ${top + 22} ${x - 26} ${top + 40} L${x - 26} ${BENCH_Y - 4} Q${x - 26} ${BENCH_Y} ${x - 22} ${BENCH_Y} L${x + 22} ${BENCH_Y} Q${x + 26} ${BENCH_Y} ${x + 26} ${BENCH_Y - 4} L${x + 26} ${top + 40} Q${x + 26} ${top + 22} ${x + 8} ${top + 10} L${x + 8} ${top - 10} Z`} fill={LIQUID_VINEGAR} opacity="0.7" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      <rect x={x - 22} y={top + 60} width={44} height={40} rx={3} fill="var(--surface)" stroke="var(--line)" />
      <text x={x} y={top + 77} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 700 }}>Vinagre</text>
      <text x={x} y={top + 91} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>acidez 5 %</text>
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function MoleLab({ api }: LabProps) {
  const [activity, setActivity] = useState<Activity>('contar');

  /* --------------------------- contar pesando */
  const [substanceId, setSubstanceId] = useState<SubstanceId>('sal');
  const [portions, setPortions] = useState(0);
  const [boatOnPan, setBoatOnPan] = useState(false);
  const [tare, setTare] = useState(0);
  const [read, setRead] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [tareFlash, setTareFlash] = useState(false);

  const s = findSubstance(substanceId);
  const w = useMemo(() => weigh({ substanceId, portions, boatOnPan, tare }), [substanceId, portions, boatOnPan, tare]);
  const spec = balanceSpec();
  const { measure, remeasure, real } = useMeasure();
  const lcdValue = useMemo(() => measure(w.net, { ...spec, key: 'balanza' }), [measure, spec, w.net]);
  const massInfo = useMemo(() => molarMassInfo(s.formula), [s.formula]);
  const counted = useMemo(() => (read && lcdValue > 0 && lcdValue <= MOLE_LIMITS.mass[1] ? countEntities(lcdValue, s.formula) : null), [read, lcdValue, s.formula]);
  const sig = clampN(readingSigFigs(lcdValue), 2, 4);

  useEffect(() => { setRead(false); }, [substanceId, portions, boatOnPan, tare]);

  /* --------------------------- reacción en la balanza */
  const [reactionId, setReactionId] = useState<MolReactionId>('vinagre');
  const [solidMass, setSolidMass] = useState(2);
  const [vinegarMl, setVinegarMl] = useState(50);
  const [phase, setPhase] = useState<Phase>('montaje');
  const [rxT, setRxT] = useState(0);
  const rx = useMemo(() => runMolReaction({ reaction: reactionId, solidMass, vinegarMl }), [reactionId, solidMass, vinegarMl]);
  const readAntes = useMemo(() => measure(rx.massInitial, { ...spec, key: 'antes' }), [measure, spec, rx.massInitial]);
  const readDespues = useMemo(() => measure(rx.massFinal, { ...spec, key: 'despues' }), [measure, spec, rx.massFinal]);
  const lostMeasured = roundToResolution(readAntes - readDespues, BALANCE.resolution);
  const isVinegar = reactionId === 'vinagre';

  const rxRaf = useRef(0);
  useEffect(() => { cancelAnimationFrame(rxRaf.current); setPhase('montaje'); setRxT(0); }, [reactionId, solidMass, vinegarMl]);
  useEffect(() => () => cancelAnimationFrame(rxRaf.current), []);

  const startReaction = () => {
    if (phase !== 'antes') return;
    cancelAnimationFrame(rxRaf.current);
    playSound(isVinegar ? 'fizz' : 'whoosh', { intensity: 0.5 });
    if (reducedMotion()) { setRxT(1); setPhase('fin'); return; }
    setPhase('reaccion');
    setRxT(0);
    const start = performance.now();
    const step = (now: number) => {
      const q = clamp01(Math.max(0, now - start) / REACT_MS);
      setRxT(q);
      if (q < 1) rxRaf.current = requestAnimationFrame(step);
      else { setPhase('fin'); playSound('confirm', { intensity: 0.3 }); }
    };
    rxRaf.current = requestAnimationFrame(step);
  };

  /* --------------------------- acciones (panel y manipulación directa) */
  const placeBoat = (on: boolean) => {
    if (on === boatOnPan) return;
    setBoatOnPan(on);
    playSound(on ? 'clack' : 'thud', { intensity: 0.35 });
  };
  const pressTare = () => {
    setTare(w.gross);
    remeasure('balanza');
    setTareFlash(true);
    window.setTimeout(() => setTareFlash(false), 350);
    playSound('tare');
  };
  const addPortions = (n: number) => {
    const v = clampN(Math.round(n), MOLE_LIMITS.portions[0], MOLE_LIMITS.portions[1]);
    if (v > portions) playSound(s.form === 'liquido' ? 'drips' : s.form === 'polvo' ? 'pour' : 'clank', { intensity: 0.25 });
    setPortions(v);
  };
  const chooseSubstance = (id: string) => {
    if (id === substanceId) return;
    setSubstanceId(id as SubstanceId);
    setPortions(0); // navecilla limpia para cada sustancia
    playSound('glassClink', { intensity: 0.3 });
  };
  const readBalance = () => {
    remeasure('balanza');
    setRead(true);
    playSound('beep');
  };

  const recordSample = () => {
    if (!counted) return;
    api.addTrial('muestras', {
      sustancia: s.name, formula: s.formula, porciones: portions, tara: w.tareStatus,
      masa: lcdValue, masaMolar: Number(massInfo.value.toFixed(massInfo.decimals)),
      moles: Number(counted.moles.toPrecision(6)), particulas: Number((counted.entities / 1e21).toPrecision(6)),
      atomos: Number((counted.totalAtoms / 1e21).toPrecision(6)), entidad: s.entity,
    });
  };
  const recordReaction = () => {
    api.addTrial('reaccion', {
      reaccion: rx.def.name, masaBicarbonato: solidMass, vinagre: isVinegar ? vinegarMl : null,
      masaAntes: readAntes, masaDespues: readDespues, perdida: lostMeasured,
      gasCalculado: Number(rx.gasLost.toFixed(4)), co2Calculado: Number(rx.co2Mass.toFixed(4)),
      limitante: rx.limiting ?? (isVinegar ? 'proporción exacta' : 'un solo reactivo'),
      diferencia: Number((lostMeasured - rx.gasLost).toFixed(4)), volumenCO2: Number((rx.co2VolumeRoomL * 1000).toFixed(1)),
      porcentajePerdida: Number(((lostMeasured / solidMass) * 100).toFixed(2)),
    });
  };

  /* --------------------------- modo avanzado: ecuaciones con valores actuales */
  usePublishModel(() => {
    if (activity === 'contar') {
      const m = counted ? lcdValue : null;
      return {
        vars: {
          m: { sym: 'm', name: 'Masa de la muestra (balanza)', value: m, unit: 'g', decimals: 3 },
          M: { sym: 'M', name: `Masa molar de ${s.formula}`, value: massInfo.value, unit: 'g/mol', decimals: massInfo.decimals },
          n: { sym: 'n', name: 'Cantidad de sustancia', value: counted ? counted.moles : null, unit: 'mol', sig: 4 },
          NA: { sym: 'N_{A}', name: 'Constante de Avogadro (exacta)', value: AVOGADRO, unit: 'mol⁻¹', sig: 9 },
          N: { sym: 'N', name: `Número de ${s.entity}`, value: counted ? counted.entities : null, sig: 4 },
        } as Record<string, ModelQuantity>,
        equations: [
          { title: 'Cantidad de sustancia', lhs: 'n', expr: '\\frac{[m]}{[M]}' },
          { title: 'Número de entidades', lhs: 'N', expr: '[n]·[NA]' },
        ],
      };
    }
    const done = phase === 'despues';
    const nCO2 = rx.co2Mass / 44.009;
    return {
      vars: {
        ms: { sym: 'm_{NaHCO₃}', name: 'Masa de bicarbonato', value: solidMass, unit: 'g', decimals: 2 },
        Ms: { sym: 'M_{NaHCO₃}', name: 'Masa molar del bicarbonato', value: 84.006, unit: 'g/mol', decimals: 3 },
        ns: { sym: 'n_{NaHCO₃}', name: 'Moles de bicarbonato', value: rx.molesSolid, unit: 'mol', sig: 4 },
        xi: { sym: '\\xi', name: 'Avance de la reacción', value: rx.extent, unit: 'mol', sig: 4 },
        Mc: { sym: 'M_{CO₂}', name: 'Masa molar del CO₂', value: 44.009, unit: 'g/mol', decimals: 3 },
        mc: { sym: 'm_{CO₂}', name: 'CO₂ calculado', value: rx.co2Mass, unit: 'g', decimals: 3 },
        nc: { sym: 'n_{CO₂}', name: 'Moles de CO₂', value: nCO2, unit: 'mol', sig: 4 },
        Vm: { sym: 'V_{m}', name: 'Volumen molar a 25 °C y 101,325 kPa', value: molarVolumeL(ROOM.T, ROOM.P), unit: 'L/mol', decimals: 3 },
        V: { sym: 'V_{CO₂}', name: 'Volumen del CO₂ a 25 °C', value: rx.co2VolumeRoomL, unit: 'L', decimals: 3 },
        dm: { sym: 'Δm', name: 'Masa perdida medida', value: done ? lostMeasured : null, unit: 'g', decimals: 3 },
        ma: { sym: 'm_{antes}', name: 'Lectura antes', value: phase === 'montaje' ? null : readAntes, unit: 'g', decimals: 3 },
        md: { sym: 'm_{después}', name: 'Lectura después', value: done ? readDespues : null, unit: 'g', decimals: 3 },
      } as Record<string, ModelQuantity>,
      equations: [
        { title: 'Moles de bicarbonato', lhs: 'ns', expr: '\\frac{[ms]}{[Ms]}' },
        { title: 'CO₂ formado', lhs: 'mc', expr: '[xi]·[Mc]', note: isVinegar ? 'Relación 1 : 1 entre NaHCO₃ y CO₂; ξ lo fija el reactivo limitante.' : 'Relación 2 : 1 entre NaHCO₃ y CO₂: ξ = n/2.' },
        { title: 'Volumen del gas (ideal)', lhs: 'V', expr: '[nc]·[Vm]' },
        { title: 'Masa perdida', lhs: 'dm', expr: '[ma] − [md]', note: 'Por la conservación de la masa, debe ser igual a la masa de los gases que salen.' },
      ],
    };
  }, [activity, counted, lcdValue, s, massInfo, rx, solidMass, phase, readAntes, readDespues, lostMeasured, isVinegar]);

  /* --------------------------- geometría dependiente del estado */
  const boatPos = boatOnPan ? { x: PAN_X, y: PAN_Y - 3 } : BOAT_REST;
  const nearPan = (p: { x: number; y: number }) => Math.abs(p.x - PAN_X) < 110 && p.y > SHIELD.top - 30 && p.y < BENCH_Y;
  const overBoat = (p: { x: number; y: number }) => Math.abs(p.x - boatPos.x) < 56 && p.y > boatPos.y - 90 && p.y < boatPos.y + 16;

  /* --------------------------- textos */
  const showC = (t: string) => (counted ? t : '—');
  const entityText = s.entity;
  const descContar = `Balanza de precisión con cámara antiviento. La navecilla está ${boatOnPan ? 'en el plato' : 'sobre la mesa'} con ${portions} ${portions === 1 ? 'porción' : 'porciones'} de ${s.name.toLowerCase()}. ` +
    `La pantalla marca ${lcdText(lcdValue)} g. Tara: ${TARE_TEXT[w.tareStatus]}. A la derecha, una lupa muestra un modelo ilustrativo de las partículas de ${s.formula}.`;
  const descReaccion = isVinegar
    ? `Vaso con ${vinegarMl} mL de vinagre y papel de pesar con ${fmt(solidMass, 2)} g de bicarbonato sobre la balanza. ${phase === 'montaje' || phase === 'antes' ? 'El bicarbonato aún no se ha agregado.' : phase === 'reaccion' ? 'El bicarbonato reacciona y burbujea.' : 'La reacción terminó.'} La pantalla marca ${lcdText(phase === 'reaccion' ? readingDuring(rx, rxT) : phase === 'fin' || phase === 'despues' ? readDespues : readAntes)} g.`
    : `Crisol con ${fmt(solidMass, 2)} g de bicarbonato. ${phase === 'reaccion' ? 'El crisol se calienta sobre el mechero.' : phase === 'fin' || phase === 'despues' ? 'El crisol ya se calentó y se enfrió sobre la balanza.' : 'El crisol está sobre la balanza, sin calentar.'}`;

  // Lectura de la pantalla en la reacción.
  const rxLcd = phase === 'reaccion'
    ? (isVinegar ? readingDuring(rx, rxT) : 0)
    : phase === 'fin' || phase === 'despues' ? readDespues : readAntes;

  const contarScene = (
    <svg viewBox={VIEW} role="img" aria-labelledby="mlr-t mlr-d">
      <title id="mlr-t">Balanza de precisión con navecilla, frasco de muestra y modelo de partículas</title>
      <desc id="mlr-d">{descContar}</desc>
      <BenchTop y={BENCH_Y} width={W} />
      <ReagentJar s={s} />
      {dragging !== 'muestra' && <g aria-hidden="true"><Spatula x={SPOON_REST.x} y={SPOON_REST.y} s={s} /></g>}
      <text x={JAR.x + JAR.w / 2} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>{s.portion}</text>
      <AnalyticalBalance reading={lcdText(lcdValue)} tareFlash={tareFlash}
        inside={boatOnPan && dragging !== 'navecilla' ? <Boat x={PAN_X} y={PAN_Y - 3} s={s} portions={portions} /> : null} />
      {!boatOnPan && dragging !== 'navecilla' && <Boat x={BOAT_REST.x} y={BOAT_REST.y} s={s} portions={portions} />}
      {!boatOnPan && dragging !== 'navecilla' && <text x={BOAT_REST.x} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Navecilla ({fmt(BOAT_MASS, 3)} g)</text>}
      <ParticleLens s={s} />
      <text x={W / 2} y={H - 6} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>La pantalla muestra una lectura calculada con el modelo (masa sobre el plato − tara); el modelo de partículas es ilustrativo.</text>
    </svg>
  );

  const showPile = isVinegar && (phase === 'montaje' || phase === 'antes');
  const bubbling = isVinegar && phase === 'reaccion';
  const heating = !isVinegar && phase === 'reaccion';
  const beakerX = PAN_X - 66, beakerW = 76, beakerH = 98;
  const vFill = (vinegarMl / 150) * 0.95;
  const beakerLy = PAN_Y - 3 - 6 - (beakerH - 16) * vFill;
  const reaccionScene = (
    <svg viewBox={VIEW} role="img" aria-labelledby="mlr-t2 mlr-d2">
      <title id="mlr-t2">{isVinegar ? 'Reacción del bicarbonato con vinagre sobre la balanza' : 'Descomposición térmica del bicarbonato en un crisol'}</title>
      <desc id="mlr-d2">{descReaccion}</desc>
      <BenchTop y={BENCH_Y} width={W} />
      <AnalyticalBalance reading={lcdText(rxLcd)} tareFlash={false} inside={isVinegar ? (
        <g>
          <Beaker x={beakerX} y={PAN_Y - 3 - beakerH} w={beakerW} h={beakerH} fill={vFill} liquid={LIQUID_VINEGAR} liquidOpacity={0.55}>
            {bubbling && Array.from({ length: 22 }, (_, i) => {
              const ph = ((rxT * (5 + (i % 4)) + i * 0.137) % 1);
              const intensity = 1 - rxT * 0.85;
              const bx = beakerX + 8 + ((i * 29) % 60);
              const by = PAN_Y - 12 - ph * (PAN_Y - 12 - beakerLy);
              return <circle key={i} cx={bx} cy={by} r={1.2 + (i % 3) * 0.7} fill="#fff" stroke="#c9b98a" strokeWidth="0.4" opacity={intensity} />;
            })}
            {bubbling && <ellipse cx={beakerX + beakerW / 2} cy={beakerLy - 1} rx={beakerW / 2 - 4} ry={3 + 3 * (1 - rxT)} fill="#fffaf0" opacity={0.85 * (1 - rxT)} />}
          </Beaker>
          <rect x={PAN_X + 18} y={PAN_Y - 4.5} width={42} height={2} fill="#fbfbf7" stroke="#cfd4d0" strokeWidth="0.5" />
          {showPile && <path d={`M${PAN_X + 24} ${PAN_Y - 4.5} Q${PAN_X + 32} ${PAN_Y - 14} ${PAN_X + 39} ${PAN_Y - 14} Q${PAN_X + 46} ${PAN_Y - 14} ${PAN_X + 54} ${PAN_Y - 4.5} Z`} fill="#fdfdfb" stroke="#c9d1d6" strokeWidth="0.7" />}
        </g>
      ) : (heating ? null : <Crucible x={PAN_X} y={PAN_Y - 3} />)} />
      {isVinegar ? <VinegarBottle /> : (
        <BurnerStand lit={heating} flicker={rxT}>
          {heating && (
            <g>
              <Crucible x={BURNER_X} y={TRIPOD_TOP - 4} glow={Math.min(1, rxT * 3)} />
              {Array.from({ length: 4 }, (_, i) => {
                const ph = (rxT * 3 + i * 0.25) % 1;
                return <path key={i} d={`M${BURNER_X - 12 + i * 8} ${TRIPOD_TOP - 44 - ph * 40} q4 -6 0 -12 q-4 -6 0 -12`} fill="none" stroke="var(--ink-2)" strokeWidth="1.2" opacity={0.5 * (1 - ph)} />;
              })}
            </g>
          )}
        </BurnerStand>
      )}
      <text x={PAN_X} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>{isVinegar ? 'Vaso abierto y papel de pesar sobre el plato' : 'Crisol con tapa entreabierta'}</text>
      <text x={W / 2} y={H - 6} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>{isVinegar ? 'Burbujeo: animación ilustrativa. Lecturas de la balanza: calculadas con la estequiometría.' : 'Llama y vapor: animación ilustrativa. Lecturas de la balanza: calculadas con la estequiometría (crisol frío).'}</text>
    </svg>
  );

  const atomRows = counted ? Object.entries(counted.atoms) : [];

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          {activity === 'contar' ? (
            <ManipScene viewBox={VIEW} label="Piezas que se pueden mover" scene={contarScene}>
              <DragHandle label="Navecilla de pesaje: llevar al plato de la balanza o a la mesa" value={boatOnPan ? 1 : 0} min={0} max={1} step={1} commit="end"
                affordance={dragging === null}
                hit={{ x: boatPos.x - BOAT_W / 2 - 4, y: boatPos.y - BOAT_H - 22, w: BOAT_W + 8, h: BOAT_H + 26 }}
                valueText={(v) => (v ? 'en el plato de la balanza' : 'sobre la mesa')}
                valueFromPoint={({ point }) => (nearPan(point) ? 1 : 0)}
                onDragChange={(d) => setDragging(d ? 'navecilla' : null)} onChange={(v) => placeBoat(v === 1)}>
                {({ dragging: d, point }) => d && point && (
                  <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                    <rect x={PAN_X - 80} y={PAN_Y - 40} width={160} height={44} rx={8} fill="var(--accent)" opacity={nearPan(point) ? 0.16 : 0.05} />
                    <Boat x={point.x} y={point.y + 6} s={s} portions={portions} />
                  </g>
                )}
              </DragHandle>
              <DragHandle label={`Muestra de ${s.name.toLowerCase()}: llevar ${s.portion} a la navecilla`} value={portions} min={MOLE_LIMITS.portions[0]} max={MOLE_LIMITS.portions[1]} step={1} commit="end"
                affordance={dragging === null}
                hit={{ x: SPOON_REST.x - 24, y: SPOON_REST.y - 40, w: 76, h: 50 }}
                valueText={(v) => `${v} ${v === 1 ? 'porción' : 'porciones'} en la navecilla`}
                valueFromPoint={({ point, startValue }) => (overBoat(point) ? startValue + 1 : startValue)}
                onDragChange={(d) => setDragging(d ? 'muestra' : null)} onChange={addPortions}>
                {({ dragging: d, point }) => d && point && (
                  <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                    <rect x={boatPos.x - 52} y={boatPos.y - 60} width={104} height={70} rx={8} fill="var(--accent)" opacity={overBoat(point) ? 0.16 : 0.05} />
                    <Spatula x={point.x} y={point.y} s={s} />
                  </g>
                )}
              </DragHandle>
            </ManipScene>
          ) : reaccionScene}
        </div>
        {activity === 'contar' && (
          <ManipHint>Arrastra la navecilla de la mesa al plato de la balanza y lleva porciones de la muestra desde el frasco hasta la navecilla. Con el teclado: Tab para elegir la pieza y flechas (→ o ↑ agrega una porción o lleva la navecilla al plato).</ManipHint>
        )}

        {activity === 'contar' ? (
          <>
            <Readout items={[
              { k: 'Lectura de la balanza', v: read ? `${fmt(lcdValue, 3)} g` : '—', data: true, resolution: resolutionText(spec.resolution, 'g') },
              { k: `Masa molar M de ${prettyFormula(s.formula)}`, v: showC(`${fmt(massInfo.value, massInfo.decimals)} g/mol`) },
              { k: 'Cantidad de sustancia n = m/M', v: showC(`${fmtSig(counted?.moles ?? 0, sig)} mol`) },
              { k: `Número de ${entityText} N = n·N_A`, v: showC(`${fmtSig(counted?.entities ?? 0, sig)} ${entityText}`) },
              { k: 'Átomos en total', v: showC(`${fmtSig(counted?.totalAtoms ?? 0, sig)} átomos`) },
              { k: `Masa de una ${ENTITY_ONE[s.entity]} M/N_A`, v: showC(`${fmtSig(massInfo.value / AVOGADRO, 4)} g`) },
            ]} />
            {read && !counted && <Notice kind="warn">La balanza no marca una masa positiva: coloca la navecilla en el plato, tárala vacía y agrega al menos una porción.</Notice>}
            {read && w.tareStatus === 'sin tarar' && <Notice kind="warn">Olvidaste tarar: la lectura incluye la navecilla ({fmt(BOAT_MASS, 3)} g), así que los moles calculados salen de más. Retira la muestra o vacía la navecilla, pulsa «Tarar la balanza» con la navecilla vacía y vuelve a pesar.</Notice>}
            {read && w.tareStatus === 'tarada con muestra' && <Notice kind="warn">Tararon con muestra en la navecilla: la lectura solo incluye lo que agregaste después. Vacía la navecilla y tara de nuevo.</Notice>}
            {counted && (
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Átomos de cada elemento en la muestra">
                <table>
                  <caption className="small muted">Cálculo de la masa molar y átomos de cada elemento (masas atómicas estándar abreviadas)</caption>
                  <thead><tr><th scope="col">Elemento</th><th scope="col" className="n">Átomos por fórmula</th><th scope="col" className="n">Masa atómica</th><th scope="col" className="n">Aporte a M (g/mol)</th><th scope="col" className="n">Átomos en la muestra</th></tr></thead>
                  <tbody>
                    {massInfo.contributions.map((c) => (
                      <tr key={c.element}>
                        <td>{c.element} ({c.name})</td>
                        <td className="n">{c.count}</td>
                        <td className="n">{fmt(c.atomicMass, ATOMIC_MASS_DECIMALS[c.element] ?? 2)}</td>
                        <td className="n">{fmt(c.subtotal, ATOMIC_MASS_DECIMALS[c.element] ?? 2)}</td>
                        <td className="n">{fmtSig(atomRows.find(([el]) => el === c.element)?.[1] ?? 0, sig)}</td>
                      </tr>
                    ))}
                    <tr><th scope="row">Total</th><td className="n">{massInfo.contributions.reduce((a, c) => a + c.count, 0)}</td><td /><td className="n"><strong>{fmt(massInfo.value, massInfo.decimals)}</strong></td><td className="n">{fmtSig(counted.totalAtoms, sig)}</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <Readout items={[
              { k: 'Masa antes (balanza)', v: phase === 'montaje' ? '—' : `${fmt(readAntes, 3)} g`, data: true, resolution: resolutionText(spec.resolution, 'g') },
              { k: 'Masa después (balanza)', v: phase === 'despues' ? `${fmt(readDespues, 3)} g` : '—', data: true, resolution: resolutionText(spec.resolution, 'g') },
              { k: 'Masa perdida medida', v: phase === 'despues' ? `${fmt(lostMeasured, 3)} g` : '—' },
              { k: 'Gases que salen (calculado)', v: phase === 'despues' ? (isVinegar ? `CO₂: ${fmt(rx.co2Mass, 3)} g` : `H₂O: ${fmt(rx.vaporMass, 3)} g + CO₂: ${fmt(rx.co2Mass, 3)} g`) : '—' },
              isVinegar
                ? { k: 'Reactivo limitante (calculado)', v: phase === 'despues' ? (rx.limiting ?? 'proporción exacta') : '—' }
                : { k: 'Masa perdida (% del bicarbonato)', v: phase === 'despues' ? `${fmt((lostMeasured / solidMass) * 100, 2)} %` : '—' },
              { k: 'Volumen del CO₂ (gas ideal)', v: phase === 'despues' ? `${fmt(rx.co2VolumeRoomL * 1000, 0)} mL a 25 °C · ${fmt(rx.co2VolumeStpL * 1000, 0)} mL a 0 °C` : '—' },
              { k: 'Conservación (calculada)', v: phase === 'despues' ? `reactivos ${fmt(rx.reactantsMass, 3)} g = productos ${fmt(rx.productsMass, 3)} g` : '—' },
            ]} />
            {phase === 'despues' && isVinegar && <Notice>En un experimento real es probable que la pérdida medida quede algo por debajo de {fmt(rx.co2Mass, 3)} g, porque una parte del CO₂ queda disuelta en el vinagre. El modelo supone que todo el gas escapa.</Notice>}
          </>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <Segmented<Activity> label="Actividad" value={activity} onChange={(a) => { setActivity(a); playSound('click'); }}
            options={[{ value: 'contar', label: 'Contar pesando' }, { value: 'reaccion', label: 'Reacción en la balanza' }]} />
        </div>
        {activity === 'contar' ? (
          <div className="card stack">
            <h3>Pesada</h3>
            <Select label="Sustancia de la muestra" value={substanceId} onChange={chooseSubstance}
              options={SUBSTANCES.map((x) => ({ value: x.id, label: `${x.name} · ${prettyFormula(x.formula)}` }))}
              hint={`Cada porción: ${s.portion}.`} />
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => placeBoat(!boatOnPan)}>{boatOnPan ? 'Retirar la navecilla del plato' : 'Colocar la navecilla en el plato'}</button>
              <button type="button" className="btn" onClick={pressTare}>Tarar la balanza</button>
            </div>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => addPortions(portions + 1)} disabled={portions >= MOLE_LIMITS.portions[1]}>Agregar una porción</button>
              <button type="button" className="btn ghost" onClick={() => setPortions(0)} disabled={portions === 0}>Vaciar la navecilla</button>
            </div>
            <p className="small muted">En la navecilla: {portions} {portions === 1 ? 'porción' : 'porciones'}. Tara: {TARE_TEXT[w.tareStatus]}.</p>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={readBalance}>Leer la balanza</button>
            </div>
            <RecordButton onRecord={recordSample} disabled={!counted} />
            {!counted && <p className="small muted">Lee la balanza con muestra en la navecilla para poder guardar el ensayo.</p>}
            <p className="small muted">{s.note}</p>
          </div>
        ) : (
          <div className="card stack">
            <h3>Reacción</h3>
            <Segmented<MolReactionId> label="Reacción sobre la balanza" value={reactionId} onChange={setReactionId}
              options={[{ value: 'vinagre', label: 'Bicarbonato + vinagre' }, { value: 'calor', label: 'Bicarbonato calentado' }]} />
            <p className="small num">{findMolReaction(reactionId).equation}</p>
            <Slider label="Masa de bicarbonato" value={solidMass} min={MOLE_LIMITS.solid[0]} max={MOLE_LIMITS.solid[1]} step={0.05} unit="g" decimals={2} onChange={setSolidMass} />
            {isVinegar && (
              <Slider label="Volumen de vinagre (5 % de ácido acético)" value={vinegarMl} min={MOLE_LIMITS.vinegar[0]} max={MOLE_LIMITS.vinegar[1]} step={5} unit="mL" decimals={0} onChange={setVinegarMl}
                hint={`${fmt(vinegarMl * 0.05, 2)} g de ácido acético.`} />
            )}
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => { remeasure('antes'); setPhase('antes'); playSound('beep'); }} disabled={phase !== 'montaje' && phase !== 'antes'}>Pesar antes</button>
              <button type="button" className="btn primary" onClick={startReaction} disabled={phase !== 'antes'}>{isVinegar ? 'Agregar el bicarbonato al vinagre' : 'Calentar hasta masa constante'}</button>
            </div>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => { remeasure('despues'); setPhase('despues'); playSound('beep'); }} disabled={phase !== 'fin' && phase !== 'despues'}>Pesar después</button>
              <button type="button" className="btn ghost" onClick={() => { cancelAnimationFrame(rxRaf.current); setPhase('montaje'); setRxT(0); }} disabled={phase === 'montaje'}>Reiniciar el montaje</button>
            </div>
            {phase === 'reaccion' && <p className="small muted" aria-live="polite">{isVinegar ? 'Reaccionando: espera a que termine el burbujeo.' : 'Calentando: luego el crisol se enfría antes de pesarlo.'}</p>}
            <RecordButton onRecord={recordReaction} disabled={phase !== 'despues'} />
            {phase !== 'despues' && <p className="small muted">Pesa antes, haz reaccionar y pesa después para poder guardar el ensayo.</p>}
          </div>
        )}
        <Notice kind="warn">
          <strong>Seguridad.</strong>{' '}
          {activity === 'contar'
            ? 'Nunca pruebes ni huelas directamente las muestras del laboratorio, aunque sean de uso casero; usa la espátula y lávate las manos al terminar.'
            : isVinegar
              ? 'Usa gafas: el vinagre irrita los ojos. Mezcla en un vaso abierto y nunca en un frasco tapado, porque el CO₂ aumenta la presión y puede romperlo o hacer saltar la tapa. Trabaja en un lugar ventilado.'
              : 'Calentar es una demostración del docente: gafas, cabello recogido, mechero lejos de materiales que ardan y crisol manejado siempre con pinzas. La porcelana caliente se ve igual que la fría: déjala enfriar sobre una rejilla antes de tocarla o pesarla.'}
        </Notice>
        <Notice>{real
          ? 'Instrumento real: cada lectura incluye un error aleatorio típico de una balanza de 0,001 g (corrientes de aire, vibraciones, estática). Pulsa «Leer la balanza» o vuelve a pesar varias veces sin cambiar nada para estimar la dispersión.'
          : `Simulación educativa: la balanza redondea a 0,001 g (capacidad ${fmt(BALANCE.capacity, 0)} g). Masas atómicas estándar abreviadas de la IUPAC; N_A = 6,022 140 76 × 10²³ mol⁻¹ (exacta). Volumen molar del gas ideal: ${fmt(molarVolumeL(STP.T, STP.P), 3)} L/mol a 0 °C y 101,325 kPa.`}</Notice>
      </div>
    </div>
  );
}

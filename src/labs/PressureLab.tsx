import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  HOLE_HEIGHTS, LIQUIDS, PLACES, PRESSURE_INSTRUMENTS, PRESSURE_LIMITS, TANK_DEPTH_CM, VESSELS, analyzeManometer, atmosphere, baseAreaCm2,
  findLiquid, findPlace, findVessel, jet, mercuryColumnMm, pascalVessel, simulateProbe, speedFromRange, uTubeResponse, vesselRadius,
  type AtmosphereModel, type LiquidId, type LiquidInfo, type PlaceId, type VesselId, type VesselInfo,
} from '../models/pressure';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { useMeasure } from '../components/Measurement';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, Lcd, shade } from './kit';
import { clockAngle, DragHandle, ManipHint, ManipScene, Plunger, toSvgPoint, zoneAt } from './manipulate';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 860, H = 460;
const BENCH_Y = 434;
const VIEW = `0 0 ${W} ${H}`;

/** Tanque de vidrio (sonda): px por cm, fondo interior, superficie del líquido. */
const S = 6.2;
const TANK = { l: 116, r: 252, bottom: BENCH_Y - 10, wall: 5 };
const TANK_TOP = TANK.bottom - 35 * S;
const SURF_Y = TANK.bottom - TANK_DEPTH_CM * S;
const PX = (TANK.l + TANK.r) / 2 + 8; // eje de la sonda
/** Distancia (px) entre el centro de la membrana y la nuez que sostiene la varilla. */
const ROD = 214;
const DEPTH_MAX = PRESSURE_LIMITS.depth[1];
const membraneY = (depth: number) => SURF_Y + depth * S;
const gripY = (depth: number) => membraneY(depth) - ROD;
const CAP_R = 11;
const STAND_X = 46;

/** Manómetro en U. */
const MANO = { x: 318, w: 124, top: 34, legL: 352, legR: 408, tubeTop: 60, bend: 404, zero: 250, pxPerMm: 0.42 };

/** Vasos de Pascal: px por cm del aparato, nivel de la membrana del fondo, estante. */
const SP = 7;
const PAS_BASE_Y = BENCH_Y - 52;
const SHELF = { x0: 458, x1: 658, scale: 0.34 };
const SLOT_W = (SHELF.x1 - SHELF.x0) / VESSELS.length;
const slotCenter = (i: number) => SHELF.x0 + SLOT_W * (i + 0.5);
const SLOT_EDGES = VESSELS.slice(1).map((_, i) => SHELF.x0 + SLOT_W * (i + 1));
const DROP = { x0: 50, x1: 306, y0: 120, y1: BENCH_Y };

/** Botella con agujeros: px por cm, piso de la bandeja (donde caen los chorros), paredes de la botella. */
const SB = 10;
const FLOOR = BENCH_Y - 10;
const BOT = { l: 70, r: 180 };
const holeY = (y: number) => FLOOR - y * SB;
const JET_MS = 1500;
/** Lupa del detalle de la presión en un punto (sonda). */
const LENS = { cx: 576, cy: 140, r: 68 };

/** Barómetro aneroide y perfil de altitud. */
const BARO = { cx: 760, cy: 104, r: 62, min: 650, max: 1050 };
const PROF = { x: 664, y: 236, w: 188, h: 186 };

type ExpId = 'sonda' | 'pascal' | 'chorros';
type Phase = 'listo' | 'midiendo' | 'medido';

const EXP_LABEL: Record<ExpId, string> = { sonda: 'Sonda en el tanque', pascal: 'Vasos de Pascal', chorros: 'Botella con agujeros' };
const ATM_LABEL: Record<AtmosphereModel, string> = { estandar: 'Estándar (ISA)', isoterma: 'Isotérmica (15 °C)' };
const MANO_COLOR = '#d2453b';
const WATER = '#5aa9de';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (q: number) => 1 - (1 - q) * (1 - q);

function orientationText(v: number): string {
  if (v === 0) return 'mira hacia arriba';
  if (v === 90) return 'mira hacia un lado';
  if (v === 180) return 'mira hacia abajo';
  return v < 90 ? 'inclinada hacia arriba' : 'inclinada hacia abajo';
}

/* ------------------------------------------------------------------ definiciones locales */

function PressureDefs({ liquid }: { liquid: LiquidInfo }) {
  return (
    <defs>
      <linearGradient id="pre-liq" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={shade(liquid.color, 0.25)} stopOpacity={liquid.opacity * 0.85} />
        <stop offset="1" stopColor={shade(liquid.color, -0.28)} stopOpacity={Math.min(0.9, liquid.opacity * 1.35)} />
      </linearGradient>
      <linearGradient id="pre-water" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={shade(WATER, 0.25)} stopOpacity="0.38" />
        <stop offset="1" stopColor={shade(WATER, -0.25)} stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="pre-board" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#e9d3a0" />
        <stop offset="0.5" stopColor="#f6e6bd" />
        <stop offset="1" stopColor="#dcc188" />
      </linearGradient>
      <radialGradient id="pre-dial" cx="0.45" cy="0.4" r="0.7">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#ebe8de" />
      </radialGradient>
      <linearGradient id="pre-brass" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#f3dc9a" />
        <stop offset="0.45" stopColor="#c99a3b" />
        <stop offset="0.6" stopColor="#a87a26" />
        <stop offset="1" stopColor="#e7c777" />
      </linearGradient>
      <linearGradient id="pre-rubber" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#4a4f52" />
        <stop offset="1" stopColor="#2a2e30" />
      </linearGradient>
      <linearGradient id="pre-sky" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#d7ecf7" />
        <stop offset="1" stopColor="#f4f9fb" />
      </linearGradient>
      <linearGradient id="pre-land" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#7f9a5a" />
        <stop offset="0.55" stopColor="#5f7d43" />
        <stop offset="1" stopColor="#8b6b43" />
      </linearGradient>
      <linearGradient id="pre-pet" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#d9eef5" stopOpacity="0.55" />
        <stop offset="0.18" stopColor="#ffffff" stopOpacity="0.25" />
        <stop offset="0.6" stopColor="#e3f2f7" stopOpacity="0.08" />
        <stop offset="1" stopColor="#c7e2ec" stopOpacity="0.45" />
      </linearGradient>
      <marker id="pre-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 Z" fill="var(--fis)" />
      </marker>
      <marker id="pre-arrow-data" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 Z" fill="var(--data)" />
      </marker>
    </defs>
  );
}

/* ------------------------------------------------------------------ instrumentos locales */

/** Superficie libre con menisco cóncavo (el líquido moja el vidrio). */
function Surface({ l, r, y, color }: { l: number; r: number; y: number; color: string }) {
  return (
    <g>
      <path d={`M${l} ${y - 3.2} Q${l + 2} ${y} ${l + 9} ${y + 0.6} L${r - 9} ${y + 0.6} Q${r - 2} ${y} ${r} ${y - 3.2}`} fill="none" stroke={shade(color, -0.4)} strokeWidth="1.5" />
      <path d={`M${l + 12} ${y + 2.4} L${r - 12} ${y + 2.4}`} stroke="#fff" strokeWidth="1" opacity="0.35" />
    </g>
  );
}

/** Tanque de vidrio alto con escala de profundidad impresa (0 en la superficie). */
function GlassTank({ liquid }: { liquid: LiquidInfo }) {
  const { l, r, bottom, wall } = TANK;
  const ticks = useMemo(() => Array.from({ length: DEPTH_MAX + 1 }, (_, i) => i), []);
  return (
    <g>
      {/* sombra de contacto y vidrio de fondo */}
      <ellipse cx={(l + r) / 2} cy={BENCH_Y + 1} rx={(r - l) / 2 + 12} ry={3.2} fill="#000" opacity="0.12" />
      <rect x={l - wall} y={TANK_TOP} width={r - l + 2 * wall} height={BENCH_Y - TANK_TOP} rx={3} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
      {/* líquido: más oscuro en lo profundo */}
      <rect x={l} y={SURF_Y} width={r - l} height={bottom - SURF_Y} fill="url(#pre-liq)" />
      <rect x={l} y={SURF_Y} width={r - l} height={bottom - SURF_Y} fill="url(#kit-liquid-shade)" />
      <Surface l={l} r={r} y={SURF_Y} color={liquid.color} />
      {/* escala de profundidad sobre el vidrio, a la derecha */}
      {ticks.map((d) => {
        const y = SURF_Y + d * S, major = d % 5 === 0;
        return (
          <g key={d}>
            <line x1={r - 2} x2={r - (major ? 14 : 8)} y1={y} y2={y} stroke="var(--glass-print, #24454a)" strokeWidth={major ? 1.2 : 0.7} opacity="0.85" />
            {major && <text x={r - 17} y={y + 3.4} textAnchor="end" style={{ fontSize: 8.5, fill: 'var(--glass-print, #24454a)', fontFamily: 'var(--font-data)' }}>{d}</text>}
          </g>
        );
      })}
      <text x={r - 4} y={SURF_Y - 7} textAnchor="end" style={{ fontSize: 8.5, fill: 'var(--glass-print, #24454a)', fontFamily: 'var(--font-data)' }}>cm</text>
    </g>
  );
}

/** Vidrio del tanque (se dibuja encima de la sonda). */
function TankGlassFront() {
  const { l, r, bottom, wall } = TANK;
  return (
    <g>
      <path d={`M${l - wall} ${TANK_TOP} L${l - wall} ${BENCH_Y} L${r + wall} ${BENCH_Y} L${r + wall} ${TANK_TOP}`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <path d={`M${l} ${TANK_TOP} L${l} ${bottom} L${r} ${bottom} L${r} ${TANK_TOP}`} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="0.8" opacity="0.7" />
      <rect x={l - wall - 1.5} y={TANK_TOP - 2} width={r - l + 2 * wall + 3} height={4} rx={2} fill="url(#kit-metal)" stroke="#8a969a" strokeWidth="0.5" />
      <rect x={l + 5} y={TANK_TOP + 10} width={3} height={bottom - TANK_TOP - 24} rx={1.5} fill="#fff" opacity="0.38" />
      <rect x={r - 30} y={TANK_TOP + 14} width={2} height={bottom - TANK_TOP - 60} rx={1} fill="#fff" opacity="0.22" />
    </g>
  );
}

/** Soporte universal con nuez y brazo que sostiene la varilla de la sonda. */
function Stand({ armY }: { armY: number }) {
  return (
    <g>
      <rect x={STAND_X - 30} y={BENCH_Y - 8} width={66} height={8} rx={2} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
      <rect x={STAND_X - 2.5} y={6} width={5} height={BENCH_Y - 12} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.5" />
      <rect x={STAND_X} y={armY - 2.2} width={PX - STAND_X} height={4.4} rx={2} fill="url(#kit-metal)" stroke="#8a969a" strokeWidth="0.5" />
      <rect x={STAND_X - 7} y={armY - 7} width={14} height={14} rx={2.5} fill="#3b4648" />
      <circle cx={STAND_X - 10} cy={armY} r={3.4} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />
    </g>
  );
}

/**
 * Sonda manométrica: varilla hueca, horquilla y cápsula con membrana elástica.
 * La cápsula gira sobre el centro de la membrana; `orientation` = hacia dónde mira (0° arriba).
 */
function Probe({ depth, orientation, pushes }: { depth: number; orientation: number; pushes: number | null }) {
  const cx = PX, cy = membraneY(depth);
  const gy = gripY(depth);
  const th = (orientation * Math.PI) / 180;
  const rot = (x: number, y: number) => ({ x: cx + x * Math.cos(th) - y * Math.sin(th), y: cy + x * Math.sin(th) + y * Math.cos(th) });
  const neck = rot(0, 17);
  const forkY = cy - 26;
  return (
    <g>
      {/* varilla hueca y nuez */}
      <rect x={cx - 2.2} y={gy - 6} width={4.4} height={forkY - gy + 6} fill="url(#kit-metal-h)" stroke="#7d898d" strokeWidth="0.5" />
      <rect x={cx - 7} y={gy - 9} width={14} height={18} rx={3} fill="#2f3a3d" />
      {[-5, -1.5, 2, 5.5].map((d) => <line key={d} x1={cx - 6} x2={cx + 6} y1={gy + d} y2={gy + d} stroke="#5a676b" strokeWidth="0.8" />)}
      {/* manguera corta de la cápsula a la varilla */}
      <path d={`M${neck.x} ${neck.y} Q${cx - 22} ${cy - 18} ${cx} ${forkY}`} fill="none" stroke="#35404a" strokeWidth="3.6" strokeLinecap="round" />
      <path d={`M${neck.x} ${neck.y} Q${cx - 22} ${cy - 18} ${cx} ${forkY}`} fill="none" stroke="#7d8a92" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      {/* cápsula (embudo metálico) con la membrana */}
      <g transform={`rotate(${orientation} ${cx} ${cy})`}>
        <path d={`M${cx - CAP_R} ${cy} L${cx - CAP_R + 1.5} ${cy + 6} L${cx - 3.5} ${cy + 14} L${cx - 3} ${cy + 19} L${cx + 3} ${cy + 19} L${cx + 3.5} ${cy + 14} L${cx + CAP_R - 1.5} ${cy + 6} L${cx + CAP_R} ${cy} Z`} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.7" />
        <rect x={cx - CAP_R - 1} y={cy - 1.6} width={2 * CAP_R + 2} height={3.4} rx={1.4} fill="#b4bec2" stroke="#6d7b80" strokeWidth="0.5" />
        <path d={`M${cx - CAP_R + 0.5} ${cy - 1.2} Q${cx} ${cy + (pushes ? 2.2 : 0.4)} ${cx + CAP_R - 0.5} ${cy - 1.2}`} fill="none" stroke="#c0392b" strokeWidth="2.2" strokeLinecap="round" />
        {/* lengüeta para girar la cápsula */}
        <rect x={cx - 3.2} y={cy + 19} width={6.4} height={7} rx={1.8} fill="var(--fis)" stroke="#123a6b" strokeWidth="0.6" />
        {pushes !== null && [-6, 0, 6].map((x) => (
          <line key={x} x1={cx + x} x2={cx + x} y1={cy - 6 - pushes} y2={cy - 4} stroke="var(--fis)" strokeWidth="1.6" markerEnd="url(#pre-arrow)" />
        ))}
      </g>
      {/* horquilla y eje de giro */}
      <path d={`M${cx} ${forkY} L${cx} ${cy - CAP_R - 4} M${cx - 4} ${cy - CAP_R - 4} L${cx + 4} ${cy - CAP_R - 4}`} stroke="#6d7b80" strokeWidth="1.6" fill="none" />
      <circle cx={cx} cy={cy} r={2.2} fill="url(#kit-metal)" stroke="#45525a" strokeWidth="0.6" />
    </g>
  );
}

/** Manómetro en U de vidrio con agua coloreada sobre un tablero con escala en cm (cero en el centro). */
function UTube({ rise, reading }: { rise: number; reading: number | null }) {
  const { x, w, top, legL, legR, tubeTop, bend, zero, pxPerMm } = MANO;
  const half = (rise / 2) * pxPerMm;
  const yL = zero + half, yR = zero - half;
  const r = (legR - legL) / 2;
  const tube = `M${legL} ${tubeTop} L${legL} ${bend - r} A${r} ${r} 0 0 0 ${legR} ${bend - r} L${legR} ${tubeTop - 10}`;
  const liquid = `M${legL} ${yL} L${legL} ${bend - r} A${r} ${r} 0 0 0 ${legR} ${bend - r} L${legR} ${yR}`;
  const ticks = useMemo(() => Array.from({ length: 41 }, (_, i) => i - 20), []);
  const mid = (legL + legR) / 2;
  return (
    <g>
      {/* tablero de madera con patas */}
      <g filter="url(#kit-shadow)">
        <rect x={x} y={top} width={w} height={BENCH_Y - top - 8} rx={4} fill="url(#pre-board)" stroke="#b8975a" />
        <rect x={x - 10} y={BENCH_Y - 9} width={w + 20} height={9} rx={2} fill="url(#kit-body-dark)" />
      </g>
      {ticks.map((c) => {
        const y = zero - c * 10 * pxPerMm, major = c % 5 === 0;
        return (
          <g key={c}>
            <line x1={mid + 1} x2={mid + (major ? 13 : 7)} y1={y} y2={y} stroke="#4d3b1c" strokeWidth={major ? 1.1 : 0.6} />
            {major && <text x={mid - 1} y={y + 2.8} textAnchor="end" style={{ fontSize: 7.5, fill: '#4d3b1c', fontFamily: 'var(--font-data)', fontWeight: c === 0 ? 700 : 400 }}>{Math.abs(c)}</text>}
          </g>
        );
      })}
      <text x={x + 13} y={zero} textAnchor="middle" transform={`rotate(-90 ${x + 13} ${zero})`} style={{ fontSize: 9, fill: '#4d3b1c', fontWeight: 700, letterSpacing: 1.5 }}>MANÓMETRO EN U</text>
      <text x={x + w / 2} y={BENCH_Y - 16} textAnchor="middle" style={{ fontSize: 8, fill: '#4d3b1c' }}>escala en cm · agua coloreada</text>
      {/* tubo de vidrio */}
      <path d={tube} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="12" strokeLinecap="round" />
      <path d={tube} fill="none" stroke="#f3f8fa" strokeWidth="9" strokeLinecap="round" opacity="0.92" />
      <path d={liquid} fill="none" stroke={MANO_COLOR} strokeWidth="8" />
      <path d={liquid} fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.35" transform="translate(-2 0)" />
      {[[legL, yL], [legR, yR]].map(([lx, ly]) => (
        <path key={lx} d={`M${lx - 4} ${ly - 2.6} Q${lx} ${ly + 1.8} ${lx + 4} ${ly - 2.6} L${lx + 4} ${ly + 2} L${lx - 4} ${ly + 2} Z`} fill={MANO_COLOR} />
      ))}
      <line x1={legL - 3} x2={legL - 3} y1={tubeTop + 4} y2={bend - 14} stroke="#fff" strokeWidth="1.2" opacity="0.6" />
      <line x1={legR - 3} x2={legR - 3} y1={tubeTop - 4} y2={bend - 14} stroke="#fff" strokeWidth="1.2" opacity="0.6" />
      <text x={legR + 9} y={tubeTop - 6} style={{ fontSize: 8, fill: '#4d3b1c' }}>abierto</text>
      {/* lectura: dos líneas de nivel y el desnivel */}
      {reading !== null && (
        <g>
          <line x1={legL - 10} x2={legR + 12} y1={yL} y2={yL} stroke="var(--data)" strokeWidth="1.1" strokeDasharray="3 2" />
          <line x1={legL - 10} x2={legR + 12} y1={yR} y2={yR} stroke="var(--data)" strokeWidth="1.1" strokeDasharray="3 2" />
          {half > 4 && <line x1={legR + 10} x2={legR + 10} y1={yR + 1} y2={yL - 1} stroke="var(--data)" strokeWidth="1.3" markerStart="url(#pre-arrow-data)" markerEnd="url(#pre-arrow-data)" />}
          <rect x={x + w - 4} y={zero - 10} width={60} height={20} rx={5} fill="var(--surface)" stroke="var(--data)" />
          <text x={x + w + 26} y={zero + 4} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--data)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>Δh {fmt(reading, 0)} mm</text>
        </g>
      )}
    </g>
  );
}

/** Barómetro aneroide de carátula con pantalla digital. */
function Barometer({ p, reading }: { p: number; reading: number }) {
  const { cx, cy, r, min, max } = BARO;
  const ang = (v: number) => (-135 + ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 270) * (Math.PI / 180);
  const ticks = useMemo(() => Array.from({ length: (max - min) / 10 + 1 }, (_, i) => min + i * 10), [min, max]);
  const a = ang(p);
  const tip = { x: cx + (r - 14) * Math.sin(a), y: cy - (r - 14) * Math.cos(a) };
  const tail = { x: cx - 10 * Math.sin(a), y: cy + 10 * Math.cos(a) };
  const n = { x: Math.cos(a) * 2, y: Math.sin(a) * 2 };
  return (
    <g>
      <text x={cx} y={20} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink)', fontWeight: 700 }}>Barómetro</text>
      <g filter="url(#kit-shadow)">
        <circle cx={cx} cy={cy} r={r + 7} fill="url(#pre-brass)" stroke="#8a6a20" strokeWidth="0.8" />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="url(#pre-dial)" stroke="#9c8a5a" strokeWidth="0.8" />
      {ticks.map((v) => {
        const t = ang(v), major = v % 50 === 0;
        const r1 = major ? r - 11 : r - 7, r2 = r - 3;
        return (
          <g key={v}>
            <line x1={cx + r1 * Math.sin(t)} y1={cy - r1 * Math.cos(t)} x2={cx + r2 * Math.sin(t)} y2={cy - r2 * Math.cos(t)} stroke="#1f2a2c" strokeWidth={major ? 1.2 : 0.6} />
            {major && v % 100 === 0 && <text x={cx + (r - 20) * Math.sin(t)} y={cy - (r - 20) * Math.cos(t) + 3} textAnchor="middle" style={{ fontSize: 7.5, fill: '#1f2a2c', fontFamily: 'var(--font-data)' }}>{v}</text>}
          </g>
        );
      })}
      <text x={cx} y={cy + 22} textAnchor="middle" style={{ fontSize: 7.5, fill: '#1f2a2c', fontWeight: 700 }}>hPa</text>
      <path d={`M${tail.x + n.x} ${tail.y + n.y} L${tip.x} ${tip.y} L${tail.x - n.x} ${tail.y - n.y} Z`} fill="#1f2a2c" />
      <circle cx={cx} cy={cy} r={4} fill="url(#pre-brass)" stroke="#6d5418" strokeWidth="0.6" />
      <path d={`M${cx - r * 0.72} ${cy - r * 0.35} A${r * 0.8} ${r * 0.8} 0 0 1 ${cx + r * 0.2} ${cy - r * 0.78}`} fill="none" stroke="#fff" strokeWidth="5" opacity="0.4" strokeLinecap="round" />
      <g filter="url(#kit-shadow-soft)">
        <rect x={cx - 58} y={cy + r + 12} width={116} height={44} rx={8} fill="url(#kit-body-dark)" />
      </g>
      <Lcd x={cx - 52} y={cy + r + 17} w={104} h={24} text={fmt(reading, 1)} />
      <text x={cx} y={cy + r + 51} textAnchor="middle" style={{ fontSize: 7.5, fill: '#c9d2d5', letterSpacing: 1 }}>hPa · DIGITAL 0,1 hPa</text>
    </g>
  );
}

/** Perfil esquemático de los Andes desde el golfo de Urabá hasta la sabana de Bogotá (no a escala horizontal). */
const PROFILE_PTS: [number, number][] = [
  [0, -50], [10, 0], [22, 30], [36, 900], [46, 2800], [58, 900], [66, 550], [76, 1700], [86, 2900], [98, 1495], [110, 2500], [118, 3300],
  [130, 2150], [140, 900], [150, 300], [160, 1800], [170, 2640], [178, 2700], [183, 3600], [188, 3200],
];
const PLACE_X: Record<PlaceId, number> = { apartado: 22, santafe: 66, medellin: 98, manizales: 130, bogota: 172 };
const altY = (alt: number) => PROF.y + PROF.h - 30 - (alt / 3800) * (PROF.h - 50);

function AltitudeProfile({ place }: { place: PlaceId }) {
  const d = useMemo(() => {
    // Curva suave que pasa por todos los puntos (Catmull-Rom): los pueblos quedan sobre el terreno.
    const pts = PROFILE_PTS.map(([x, a]) => ({ x: PROF.x + x, y: altY(Math.max(0, a)) }));
    let path = `M${PROF.x} ${PROF.y + PROF.h} L${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      path += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
    }
    return `${path} L${PROF.x + PROF.w} ${PROF.y + PROF.h} Z`;
  }, []);
  const sel = findPlace(place);
  const px = PROF.x + PLACE_X[place], py = altY(sel.altitude);
  const left = PLACE_X[place] > 110;
  return (
    <g>
      <rect x={PROF.x} y={PROF.y} width={PROF.w} height={PROF.h} rx={8} fill="url(#pre-sky)" stroke="var(--line)" />
      <clipPath id="pre-prof-clip"><rect x={PROF.x} y={PROF.y} width={PROF.w} height={PROF.h} rx={8} /></clipPath>
      <g clipPath="url(#pre-prof-clip)">
        <rect x={PROF.x} y={altY(0)} width={30} height={PROF.h} fill="#4f9fd0" opacity="0.75" />
        <path d={d} fill="url(#pre-land)" stroke="#4d6436" strokeWidth="0.8" />
        {[1000, 2000, 3000].map((a) => (
          <g key={a}>
            <line x1={PROF.x + 2} x2={PROF.x + PROF.w} y1={altY(a)} y2={altY(a)} stroke="#2c4a5a" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.55" />
            <text x={PROF.x + PROF.w - 3} y={altY(a) - 2} textAnchor="end" style={{ fontSize: 7, fill: '#2c4a5a', fontFamily: 'var(--font-data)' }}>{a} m</text>
          </g>
        ))}
        {PLACES.map((p) => (
          <circle key={p.id} cx={PROF.x + PLACE_X[p.id]} cy={altY(p.altitude)} r={p.id === place ? 0 : 2.6} fill="#fff" stroke="#1f2a2c" strokeWidth="0.8" />
        ))}
      </g>
      <text x={PROF.x + 6} y={PROF.y + 13} style={{ fontSize: 9, fill: '#1f3340', fontWeight: 700 }}>¿Dónde está el laboratorio?</text>
      <text x={PROF.x + 6} y={PROF.y + PROF.h - 6} style={{ fontSize: 7, fill: '#f4f9fb' }}>Urabá</text>
      {/* marcador del lugar elegido */}
      <line x1={px} x2={px} y1={py} y2={py - 22} stroke="#1f2a2c" strokeWidth="1" />
      <circle cx={px} cy={py} r={4.2} fill="#c62828" stroke="#fff" strokeWidth="1.2" />
      <rect x={left ? px - 96 : px + 4} y={py - 34} width={92} height={24} rx={4} fill="#ffffff" stroke="#1f2a2c" strokeWidth="0.7" opacity="0.95" />
      <text x={left ? px - 50 : px + 50} y={py - 24} textAnchor="middle" style={{ fontSize: 8.5, fill: '#1f2a2c', fontWeight: 700 }}>{sel.name}</text>
      <text x={left ? px - 50 : px + 50} y={py - 14} textAnchor="middle" style={{ fontSize: 8, fill: '#1f2a2c', fontFamily: 'var(--font-data)' }}>≈ {fmt(sel.altitude, 0)} m</text>
    </g>
  );
}

/** Puntos de las paredes izquierda y derecha de un vaso de Pascal hasta la altura h (cm). */
function vesselWalls(v: VesselInfo, cx: number, yb: number, s: number, h: number) {
  const zs = [...v.profile.map(([z]) => z).filter((z) => z < h), h];
  const left = zs.map((z) => ({ x: cx + v.shear * z * s - vesselRadius(v, z) * s, y: yb - z * s }));
  const right = zs.map((z) => ({ x: cx + v.shear * z * s + vesselRadius(v, z) * s, y: yb - z * s }));
  return { left, right };
}

const polyline = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x} ${p.y}`).join(' L');

/** Vaso de Pascal de vidrio (perfil hasta 26 cm) con líquido hasta h. */
function PascalVessel({ v, cx, yb, s, h, liquid, ghost }: { v: VesselInfo; cx: number; yb: number; s: number; h: number; liquid?: LiquidInfo; ghost?: boolean }) {
  const glass = vesselWalls(v, cx, yb, s, 26);
  const outline = `M${polyline([...glass.left].reverse())} L${polyline(glass.right)}`;
  const liq = liquid && h > 0 ? vesselWalls(v, cx, yb, s, h) : null;
  const lt = liq ? liq.left[liq.left.length - 1] : null, rt = liq ? liq.right[liq.right.length - 1] : null;
  const topL = glass.left[glass.left.length - 1], topR = glass.right[glass.right.length - 1];
  return (
    <g opacity={ghost ? 0.85 : 1}>
      <path d={`${outline} Z`} fill="url(#kit-glass-fill)" />
      {liq && lt && rt && (
        <g>
          <path d={`M${polyline(liq.left)} L${polyline([...liq.right].reverse())} Z`} fill="url(#pre-liq)" />
          {rt.x - lt.x > 18
            ? <Surface l={lt.x} r={rt.x} y={lt.y} color={liquid!.color} />
            : <path d={`M${lt.x} ${lt.y - 2} Q${(lt.x + rt.x) / 2} ${lt.y + 2.5} ${rt.x} ${rt.y - 2}`} fill="none" stroke={shade(liquid!.color, -0.4)} strokeWidth="1.3" />}
        </g>
      )}
      <path d={outline} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth={s > 4 ? 1.8 : 1.2} strokeLinejoin="round" />
      <path d={`M${topL.x - 3} ${topL.y - 1} L${topL.x} ${topL.y} M${topR.x} ${topR.y} L${topR.x + 3} ${topR.y - 1}`} stroke="var(--glass-edge, #8fa9b3)" strokeWidth={s > 4 ? 2.4 : 1.6} strokeLinecap="round" />
      <path d={`M${glass.left[0].x + 3} ${yb - 4} L${polyline(glass.left.slice(1).map((p) => ({ x: p.x + 3, y: p.y + 6 })))}`} fill="none" stroke="#fff" strokeWidth={s > 4 ? 2.4 : 1.2} opacity="0.45" />
    </g>
  );
}

/** Aparato de Pascal: base metálica con membrana en el fondo del vaso y salida lateral hacia el manómetro. */
function PascalBase({ cx }: { cx: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={BENCH_Y + 1} rx={70} ry={3} fill="#000" opacity="0.12" />
      <g filter="url(#kit-shadow)">
        <path d={`M${cx - 62} ${BENCH_Y} L${cx - 54} ${PAS_BASE_Y + 14} L${cx + 54} ${PAS_BASE_Y + 14} L${cx + 62} ${BENCH_Y} Z`} fill="url(#kit-body-dark)" />
        <rect x={cx - 30} y={PAS_BASE_Y} width={60} height={16} rx={2} fill="url(#kit-metal-h)" stroke="#7d898d" strokeWidth="0.6" />
      </g>
      {[-24, -18, -12, -6, 0, 6, 12, 18, 24].map((d) => <line key={d} x1={cx + d} x2={cx + d + 3} y1={PAS_BASE_Y + 2} y2={PAS_BASE_Y + 13} stroke="#8a969a" strokeWidth="0.6" />)}
      <rect x={cx + 54} y={PAS_BASE_Y + 24} width={18} height={7} rx={2} fill="url(#kit-metal)" stroke="#7d898d" strokeWidth="0.5" />
      <text x={cx} y={BENCH_Y - 8} textAnchor="middle" style={{ fontSize: 8, fill: '#c9d2d5', letterSpacing: 1 }}>APARATO DE PASCAL</text>
    </g>
  );
}

/** Botella plástica (PET) de pared delgada; el cuello y los hombros quedan por encima del agua. */
function Bottle({ level, holes, taped }: { level: number; holes: boolean[]; taped: boolean }) {
  const top = FLOOR - 30 * SB, neckTop = top - 40;
  const { l, r } = BOT;
  const body = `M${l + 30} ${neckTop} L${l + 30} ${neckTop + 12} Q${l} ${top - 4} ${l} ${top + 22} L${l} ${FLOOR - 8} Q${l} ${FLOOR} ${l + 8} ${FLOOR} L${r - 8} ${FLOOR} Q${r} ${FLOOR} ${r} ${FLOOR - 8} L${r} ${top + 22} Q${r} ${top - 4} ${r - 30} ${neckTop + 12} L${r - 30} ${neckTop}`;
  const ly = FLOOR - level * SB;
  return (
    <g>
      <path d={`${body} Z`} fill="url(#kit-glass-fill)" />
      <rect x={l + 1.5} y={ly} width={r - l - 3} height={FLOOR - ly - 1.5} rx={6} fill="url(#pre-water)" />
      <rect x={l + 1.5} y={ly} width={r - l - 3} height={FLOOR - ly - 1.5} rx={6} fill="url(#kit-liquid-shade)" />
      <Surface l={l + 1.5} r={r - 1.5} y={ly} color={WATER} />
      {/* costillas del plástico */}
      {[0.22, 0.5, 0.78].map((f) => <path key={f} d={`M${l} ${top + 30 + f * 220} Q${(l + r) / 2} ${top + 36 + f * 220} ${r} ${top + 30 + f * 220}`} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="0.8" opacity="0.5" />)}
      <path d={body} fill="url(#pre-pet)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.5" />
      <rect x={l + 26} y={neckTop - 4} width={r - l - 52} height={6} rx={2} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" />
      <rect x={l + 7} y={top + 30} width={3} height={FLOOR - top - 50} rx={1.5} fill="#fff" opacity="0.45" />
      {/* agujeros (y cinta que los tapa) */}
      {HOLE_HEIGHTS.map((y, i) => holes[i] && (
        <g key={y}>
          <ellipse cx={r} cy={holeY(y)} rx={1.8} ry={2.6} fill="#1f2a2c" />
          {taped && <rect x={r - 4} y={holeY(y) - 7} width={10} height={14} rx={1.5} fill="#f2c94c" stroke="#b8902a" strokeWidth="0.6" opacity="0.95" />}
        </g>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ interruptor de agujero en la escena */

/** Interruptor (role="switch") dibujado sobre un agujero: clic, Espacio o Intro abren o tapan el agujero. */
function HoleSwitch({ cx, cy, label, checked, onToggle }: { cx: number; cy: number; label: string; checked: boolean; onToggle: () => void }) {
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(); }
  };
  const onPointerDown = (e: PointerEvent<SVGGElement>) => { e.currentTarget.focus({ preventScroll: true }); };
  return (
    <g role="switch" tabIndex={0} aria-label={label} aria-checked={checked} className="manip" style={{ cursor: 'pointer' }}
      onClick={onToggle} onKeyDown={onKeyDown} onPointerDown={onPointerDown}>
      {!checked && <circle className="manip-affordance" cx={cx} cy={cy} r={7} vectorEffect="non-scaling-stroke" />}
      <circle className="manip-hit" cx={cx} cy={cy} r={22} />
      <circle className="manip-ring" cx={cx} cy={cy} r={11} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function PressureLab({ api }: LabProps) {
  const [exp, setExp] = useState<ExpId>('sonda');
  const [liquidId, setLiquidId] = useState<LiquidId>('dulce');
  const [depth, setDepth] = useState(10);
  const [orientation, setOrientation] = useState(90);
  const [vesselId, setVesselId] = useState<VesselId>('cilindro');
  const [height, setHeight] = useState(20);
  const [level, setLevel] = useState(25);
  const [holes, setHoles] = useState<boolean[]>([true, true, true, true]);
  const [placeId, setPlaceId] = useState<PlaceId>('apartado');
  const [atm, setAtm] = useState<AtmosphereModel>('estandar');
  const [phase, setPhase] = useState<Phase>('listo');
  const [jetT, setJetT] = useState(0);
  const [grab, setGrab] = useState<number | null>(null);
  const raf = useRef(0);

  const liquid = findLiquid(liquidId);
  const place = findPlace(placeId);
  const vessel = findVessel(vesselId);
  const vesselIndex = VESSELS.findIndex((v) => v.id === vesselId);
  const isJets = exp === 'chorros';

  /* --------------------------- modelo e instrumentos */
  const probe = useMemo(() => simulateProbe({
    liquid: liquidId, depthCm: exp === 'pascal' ? height : depth, orientationDeg: exp === 'pascal' ? 0 : orientation, altitudeM: place.altitude, atmosphere: atm,
  }), [liquidId, exp, height, depth, orientation, place.altitude, atm]);
  const pascal = useMemo(() => pascalVessel(vesselId, liquid.rho, height), [vesselId, liquid.rho, height]);
  const jets = useMemo(() => HOLE_HEIGHTS.map((y) => jet(y, level)), [level]);
  const otherAtm = useMemo(() => atmosphere(atm === 'estandar' ? 'isoterma' : 'estandar', place.altitude), [atm, place.altitude]);

  // Instrumentos: ficha de la práctica si está integrada; si no, la del modelo (modo real con la misma incertidumbre).
  const manoSpec = INSTRUMENTS.presion?.find((i) => i.id === 'manometro') ?? PRESSURE_INSTRUMENTS[0];
  const baroSpec = INSTRUMENTS.presion?.find((i) => i.id === 'barometro') ?? PRESSURE_INSTRUMENTS[1];
  const tapeSpec = INSTRUMENTS.presion?.find((i) => i.id === 'cinta') ?? PRESSURE_INSTRUMENTS[2];
  const { measure, remeasure } = useMeasure();
  const readings = useMemo(() => ({
    rise: measure(probe.riseMm, { ...manoSpec, key: 'desnivel' }),
    pAtm: measure(probe.pAtm, { ...baroSpec, key: 'barometro' }),
    ranges: jets.map((j, i) => (holes[i] && j.flows ? measure(j.range, { ...tapeSpec, key: `alcance${HOLE_HEIGHTS[i]}` }) : null)),
  }), [measure, manoSpec, baroSpec, tapeSpec, probe, jets, holes]);
  const analysis = useMemo(() => analyzeManometer(readings.rise, readings.pAtm), [readings]);

  /* --------------------------- fases de la medición */
  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setJetT(0); };
  useEffect(reset, [exp, liquidId, depth, orientation, vesselId, height, level, holes, placeId, atm]);

  useEffect(() => {
    if (phase !== 'midiendo') return;
    if (prefersReducedMotion()) { setJetT(1); setPhase('medido'); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const q = clamp01(Math.max(0, now - start) / JET_MS);
      setJetT(q);
      if (q >= 1) { setPhase('medido'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  const measureNow = () => {
    cancelAnimationFrame(raf.current);
    if (isJets) {
      remeasure(...HOLE_HEIGHTS.map((y) => `alcance${y}`));
      setJetT(0);
      setPhase('midiendo');
    } else {
      remeasure('desnivel', 'barometro');
      setPhase('medido');
    }
  };
  const done = phase === 'medido';

  /* --------------------------- oscilación del manómetro en U al cambiar la presión */
  const [shownRise, setShownRise] = useState(probe.riseMm);
  const shownRef = useRef(probe.riseMm);
  const oscRaf = useRef(0);
  useEffect(() => {
    const target = probe.riseMm;
    cancelAnimationFrame(oscRaf.current);
    const x0 = shownRef.current;
    if (prefersReducedMotion() || Math.abs(x0 - target) < 0.3) { shownRef.current = target; setShownRise(target); return; }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(8, Math.max(0, now - start) / 1000);
      const x = uTubeResponse(x0, target, t, 0.6);
      shownRef.current = x;
      setShownRise(x);
      if (t >= 8 || (t > 1 && Math.abs(x - target) < 0.2)) { shownRef.current = target; setShownRise(target); return; }
      oscRaf.current = requestAnimationFrame(step);
    };
    oscRaf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(oscRaf.current);
  }, [probe.riseMm]);

  /* --------------------------- registro */
  const record = () => {
    if (isJets) {
      jets.forEach((j, i) => {
        const R = readings.ranges[i];
        if (R === null) return;
        const v = speedFromRange(R, j.holeCm);
        api.addTrial('chorros', {
          agujero: j.holeCm, nivel: level, carga: j.headCm, alcance: R, tCaida: Number(j.tFall.toFixed(3)),
          vMedida: Number(v.toFixed(2)), vTorricelli: Number(j.vIdeal.toFixed(2)), alcanceIdeal: Number(j.rangeIdeal.toFixed(1)),
        });
      });
      return;
    }
    const isPascal = exp === 'pascal';
    api.addTrial('presion', {
      montaje: isPascal ? `Vaso de Pascal ${vessel.short.toLowerCase()}` : 'Tanque con sonda',
      liquido: liquid.name, densidad: liquid.rho, profundidad: isPascal ? height : depth, orientacion: isPascal ? 0 : orientation,
      lugar: place.name, altitud: place.altitude, atmosfera: ATM_LABEL[atm],
      desnivel: readings.rise, pMan: Math.round(analysis.gauge), pAtm: readings.pAtm, pAbs: Number(analysis.pAbs.toFixed(1)),
      volumen: isPascal ? Math.round(pascal.volume) : null, peso: isPascal ? Number(pascal.weight.toFixed(2)) : null,
      fuerzaFondo: isPascal ? Number(((analysis.gauge * baseAreaCm2(vessel)) / 1e4).toFixed(2)) : null,
    });
  };

  /* --------------------------- textos */
  const show = (t: string) => (done ? t : '—');
  const atmText = `${fmt(readings.pAtm, 1)} hPa`;
  const desc = isJets
    ? (done
      ? `Botella con agua a ${fmt(level, 0)} cm. Chorros: ${jets.map((j, i) => (readings.ranges[i] === null ? null : `agujero a ${fmt(j.holeCm, 0)} cm, alcance ${fmt(readings.ranges[i], 1)} cm`)).filter(Boolean).join('; ') || 'ningún agujero abierto bajo el agua'}.`
      : `Botella plástica con agua a ${fmt(level, 0)} cm sobre la bandeja; agujeros ${HOLE_HEIGHTS.filter((_, i) => holes[i]).map((y) => `a ${y} cm`).join(', ') || 'ninguno'}, tapados con cinta.`)
    : exp === 'pascal'
      ? `Aparato de Pascal con el ${vessel.name.toLowerCase()} lleno de ${liquid.short} hasta ${fmt(height, 1)} cm, conectado a un manómetro en U.${done ? ` Desnivel: ${fmt(readings.rise, 0)} mm.` : ''} Barómetro: ${atmText} en ${place.name}.`
      : `Tanque con ${liquid.short}; la membrana de la sonda está a ${fmt(depth, 1)} cm de profundidad y ${orientationText(orientation)}.${done ? ` Desnivel del manómetro: ${fmt(readings.rise, 0)} mm.` : ''} Barómetro: ${atmText} en ${place.name}.`;

  const sondaPush = done && exp === 'sonda' ? 3 + Math.min(14, probe.gauge / 250) : null;
  const armY = gripY(depth);
  // Pascal: centro del aparato.
  const pasCx = PX - 8;
  // Manguera al manómetro: en el aparato de Pascal corre por detrás del tablero.
  const hose = exp === 'pascal'
    ? `M${pasCx + 72} ${PAS_BASE_Y + 27.5} C${pasCx + 100} ${PAS_BASE_Y + 27.5} ${MANO.x + 10} ${PAS_BASE_Y + 24} ${MANO.x + 10} ${PAS_BASE_Y} L${MANO.x + 10} 40 Q${MANO.x + 10} 24 ${MANO.legL - 8} 24 Q${MANO.legL} 24 ${MANO.legL} ${MANO.tubeTop}`
    : `M${PX} ${armY - 9} C${PX} ${Math.max(6, armY - 40)} ${MANO.legL - 60} 22 ${MANO.legL - 24} 24 Q${MANO.legL} 26 ${MANO.legL} ${MANO.tubeTop}`;

  // Pascal: vasos del estante.
  const pasYb = PAS_BASE_Y;
  const smallS = SP * SHELF.scale;
  const shelfCx = (i: number) => slotCenter(i) - (VESSELS[i].shear * 26 * smallS) / 2;

  // Chorros: geometría de cada chorro en la animación.
  const jetFront = phase === 'listo' ? 0 : clamp01((jetT - 0.25) / 0.5);
  const tapeOff = phase === 'listo' ? 0 : clamp01(jetT / 0.25);
  const jetPaths = jets.map((j, i) => {
    if (!holes[i] || !j.flows) return null;
    const x0 = BOT.r + 1, y0 = holeY(j.holeCm), X = j.range * SB, Y = FLOOR - y0;
    const u = easeOut(jetFront);
    const pts = Array.from({ length: 17 }, (_, k) => { const f = (k / 16) * u; return `${x0 + X * f} ${y0 + Y * f * f}`; });
    return { i, x0, y0, X, Y, d: `M${pts.join(' L')}`, landed: u >= 1 };
  });

  const altSeries = useMemo(() => {
    const xs = Array.from({ length: 41 }, (_, i) => i * 100);
    return [
      { label: 'Atmósfera estándar (ISA)', color: 'var(--series-1)', kind: 'line' as const, points: xs.map((x) => ({ x, y: atmosphere('estandar', x) })) },
      { label: 'Atmósfera isotérmica (15 °C)', color: 'var(--series-2)', kind: 'line' as const, dashed: true, points: xs.map((x) => ({ x, y: atmosphere('isoterma', x) })) },
    ];
  }, []);
  const placeSeries = useMemo(() => [{ label: 'Lugares (modelo elegido)', color: 'var(--series-3)', kind: 'scatter' as const, points: PLACES.map((p) => ({ x: p.altitude, y: atmosphere(atm, p.altitude), label: p.name })) }], [atm]);

  const toggleHole = (i: number) => setHoles((hs) => hs.map((h, k) => (k === i ? !h : h)));

  const hint = exp === 'sonda'
    ? 'Arrastra la nuez del soporte para subir o bajar la sonda y gira la cápsula por su lengüeta azul; también puedes enfocarlas con Tab y usar las flechas. El marcador del mapa cambia el lugar.'
    : exp === 'pascal'
      ? 'Arrastra un vaso del estante y suéltalo sobre el aparato de Pascal para cambiarlo, o enfoca el estante con Tab y usa las flechas.'
      : 'Haz clic en la pared de la botella (o enfoca cada punto con Tab y pulsa Espacio) para abrir o tapar agujeros; arrastra la superficie del agua para cambiar el nivel.';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo: presión en líquidos y en el aire">
          <ManipScene viewBox={VIEW} label="Controles del montaje de presión" scene={
            <svg viewBox={VIEW} role="img" aria-labelledby="pre-t pre-d">
              <title id="pre-t">{isJets ? 'Botella con agujeros sobre una bandeja, con cinta métrica y barómetro' : exp === 'pascal' ? 'Aparato de Pascal con vasos de distinta forma, manómetro en U y barómetro' : 'Tanque de vidrio con sonda manométrica, manómetro en U y barómetro'}</title>
              <desc id="pre-d">{desc}</desc>
              <PressureDefs liquid={liquid} />
              <BenchTop y={BENCH_Y} width={W} />

              {exp === 'sonda' && (
                <g>
                  <Stand armY={armY} />
                  <path d={hose} fill="none" stroke="#35404a" strokeWidth="4" strokeLinecap="round" />
                  <path d={hose} fill="none" stroke="#7d8a92" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
                  <GlassTank liquid={liquid} />
                  <Probe depth={depth} orientation={orientation} pushes={sondaPush} />
                  <TankGlassFront />
                  {/* cota de profundidad */}
                  {depth > 1.5 && (
                    <g>
                      <line x1={TANK.l + 14} x2={TANK.l + 14} y1={SURF_Y + 2} y2={membraneY(depth) - 1} stroke="var(--data)" strokeWidth="1.1" markerStart="url(#pre-arrow-data)" markerEnd="url(#pre-arrow-data)" />
                      <line x1={TANK.l + 8} x2={PX - CAP_R - 4} y1={membraneY(depth)} y2={membraneY(depth)} stroke="var(--data)" strokeWidth="0.8" strokeDasharray="2 2" />
                      <rect x={TANK.l + 18} y={(SURF_Y + membraneY(depth)) / 2 - 8} width={44} height={16} rx={4} fill="var(--surface)" stroke="var(--line)" />
                      <text x={TANK.l + 40} y={(SURF_Y + membraneY(depth)) / 2 + 3.5} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>h {fmt(depth, 1)}</text>
                    </g>
                  )}
                  <text x={(TANK.l + TANK.r) / 2} y={BENCH_Y + 22} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>{liquid.name} · {fmt(liquid.rho, 0)} kg/m³</text>
                  {/* lupa: en un punto, la presión empuja igual en todas las direcciones */}
                  <g>
                    <text x={LENS.cx} y={LENS.cy - LENS.r - 12} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700 }}>Lupa: un punto a {fmt(depth, 1)} cm</text>
                    <circle cx={LENS.cx} cy={LENS.cy} r={LENS.r + 3} fill="url(#kit-body-dark)" filter="url(#kit-shadow)" />
                    <circle cx={LENS.cx} cy={LENS.cy} r={LENS.r} fill="var(--surface)" />
                    <clipPath id="pre-lens"><circle cx={LENS.cx} cy={LENS.cy} r={LENS.r} /></clipPath>
                    <g clipPath="url(#pre-lens)">
                      <rect x={LENS.cx - LENS.r} y={LENS.cy - LENS.r} width={2 * LENS.r} height={2 * LENS.r} fill="url(#pre-liq)" />
                      <rect x={LENS.cx - 10} y={LENS.cy - 10} width={20} height={20} fill={shade(liquid.color, -0.2)} opacity="0.7" stroke={shade(liquid.color, -0.5)} strokeWidth="0.8" />
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
                        const t = (a * Math.PI) / 180, L = 14 + Math.min(30, probe.gauge / 120);
                        const ex = LENS.cx + Math.sin(t) * 14, ey = LENS.cy - Math.cos(t) * 14;
                        return <line key={a} x1={ex + Math.sin(t) * L} y1={ey - Math.cos(t) * L} x2={ex} y2={ey} stroke="var(--fis)" strokeWidth="2.2" markerEnd="url(#pre-arrow)" />;
                      })}
                    </g>
                    <path d={`M${LENS.cx - LENS.r + 10} ${LENS.cy - 30} A${LENS.r - 6} ${LENS.r - 6} 0 0 1 ${LENS.cx - 12} ${LENS.cy - LENS.r + 8}`} fill="none" stroke="#fff" strokeWidth="4" opacity="0.5" strokeLinecap="round" />
                    <text x={LENS.cx} y={LENS.cy + LENS.r + 18} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>el líquido empuja igual</text>
                    <text x={LENS.cx} y={LENS.cy + LENS.r + 30} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>en todas las direcciones</text>
                  </g>
                </g>
              )}

              {exp === 'pascal' && (
                <g>
                  <path d={hose} fill="none" stroke="#35404a" strokeWidth="4" strokeLinecap="round" />
                  <path d={hose} fill="none" stroke="#7d8a92" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
                  <PascalBase cx={pasCx} />
                  <PascalVessel v={vessel} cx={pasCx} yb={pasYb} s={SP} h={height} liquid={liquid} />
                  <rect x={pasCx - 22} y={pasYb - 1.5} width={44} height={3} rx={1.5} fill="#c0392b" />
                  {done && (
                    <g>
                      <line x1={pasCx} x2={pasCx} y1={pasYb - 30} y2={pasYb - 4} stroke="var(--fis)" strokeWidth="2.4" markerEnd="url(#pre-arrow)" />
                      <text x={pasCx + 8} y={pasYb - 18} style={{ fontSize: 9.5, fill: 'var(--fis)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>F = p·A</text>
                    </g>
                  )}
                  {/* cota de la altura del líquido */}
                  <line x1={DROP.x0 + 18} x2={DROP.x0 + 18} y1={pasYb - height * SP + 1} y2={pasYb - 1} stroke="var(--data)" strokeWidth="1.1" markerStart="url(#pre-arrow-data)" markerEnd="url(#pre-arrow-data)" />
                  <line x1={DROP.x0 + 12} x2={pasCx - 30} y1={pasYb - height * SP} y2={pasYb - height * SP} stroke="var(--data)" strokeWidth="0.8" strokeDasharray="2 2" />
                  <text x={DROP.x0 + 22} y={pasYb - (height * SP) / 2 + 3} style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>h {fmt(height, 1)}</text>
                  <text x={pasCx} y={BENCH_Y + 22} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>{vessel.name} · {liquid.short}</text>
                  {/* estante con los demás vasos */}
                  <text x={(SHELF.x0 + SHELF.x1) / 2} y={BENCH_Y - 100} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 700 }}>Vasos de repuesto</text>
                  <text x={(SHELF.x0 + SHELF.x1) / 2} y={BENCH_Y - 88} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>todos con la misma base</text>
                  <rect x={SHELF.x0} y={BENCH_Y - 6} width={SHELF.x1 - SHELF.x0} height={6} rx={2} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.6" />
                  {VESSELS.map((v, i) => (i === vesselIndex || i === grab
                    ? <rect key={v.id} x={slotCenter(i) - 14} y={BENCH_Y - 6 - 26 * smallS} width={28} height={26 * smallS} rx={4} fill="none" stroke="var(--ink-2)" strokeDasharray="3 3" opacity="0.6" />
                    : <PascalVessel key={v.id} v={v} cx={shelfCx(i)} yb={BENCH_Y - 6} s={smallS} h={0} />))}
                  {VESSELS.map((v, i) => <text key={v.id} x={slotCenter(i)} y={BENCH_Y + 22} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>{v.short}</text>)}
                </g>
              )}

              {isJets && (
                <g>
                  {/* regla vertical */}
                  <g filter="url(#kit-shadow-soft)">
                    <rect x={24} y={FLOOR - 32 * SB} width={22} height={32 * SB + 2} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
                  </g>
                  {Array.from({ length: 33 }, (_, c) => (
                    <g key={c}>
                      <line x1={46} x2={46 - (c % 5 === 0 ? 10 : 5)} y1={FLOOR - c * SB} y2={FLOOR - c * SB} stroke="#4d3b1c" strokeWidth={c % 5 === 0 ? 1 : 0.6} />
                      {c % 5 === 0 && <text x={29} y={FLOOR - c * SB + 3} style={{ fontSize: 8, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{c}</text>}
                    </g>
                  ))}
                  {/* bandeja */}
                  <path d={`M${BOT.l - 18} ${FLOOR - 12} L${BOT.l - 14} ${BENCH_Y} L${540} ${BENCH_Y} L${544} ${FLOOR - 12}`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" filter="url(#kit-shadow-soft)" />
                  <rect x={BOT.l - 14} y={FLOOR} width={540 - BOT.l + 14} height={BENCH_Y - FLOOR} fill={WATER} opacity="0.22" />
                  {/* llave que mantiene el nivel constante */}
                  <rect x={0} y={21.5} width={118} height={9} fill="url(#kit-metal)" stroke="#8a969a" strokeWidth="0.6" />
                  <path d="M112 22 Q128 22 128 36 L128 46" fill="none" stroke="#9aa5a9" strokeWidth="8" strokeLinecap="round" />
                  <rect x={102} y={8} width={14} height={7} rx={2} fill="#c62828" />
                  {phase !== 'listo' && <line x1={128} x2={128} y1={50} y2={FLOOR - level * SB} stroke={WATER} strokeWidth="2.2" opacity="0.75" />}
                  <Bottle level={level} holes={holes} taped={phase === 'listo' || tapeOff < 1} />
                  {phase !== 'listo' && tapeOff < 1 && HOLE_HEIGHTS.map((y, i) => holes[i] && (
                    <rect key={y} x={BOT.r - 4 + tapeOff * 30} y={holeY(y) - 7 - tapeOff * 20} width={10} height={14} rx={1.5} fill="#f2c94c" stroke="#b8902a" strokeWidth="0.6" opacity={1 - tapeOff}
                      transform={`rotate(${tapeOff * 70} ${BOT.r + 1 + tapeOff * 30} ${holeY(y) - tapeOff * 20})`} />
                  ))}
                  {/* chorros */}
                  {jetPaths.map((p) => p && (
                    <g key={p.i}>
                      <path d={p.d} fill="none" stroke={WATER} strokeWidth="3.4" strokeLinecap="round" opacity="0.75" />
                      <path d={p.d} fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                      {p.landed && <ellipse cx={p.x0 + p.X} cy={FLOOR - 1} rx={7} ry={2.2} fill={WATER} opacity="0.6" />}
                    </g>
                  ))}
                  {/* cinta métrica sobre el piso de la bandeja */}
                  <rect x={BOT.r} y={FLOOR + 1} width={30 * SB + 6} height={8} fill="#f2c94c" stroke="#b8902a" strokeWidth="0.5" />
                  {Array.from({ length: 31 }, (_, c) => (
                    <g key={c}>
                      <line x1={BOT.r + c * SB} x2={BOT.r + c * SB} y1={FLOOR + 1} y2={FLOOR + (c % 5 === 0 ? 7 : 4)} stroke="#4d3b1c" strokeWidth={c % 5 === 0 ? 0.9 : 0.5} />
                      {c % 5 === 0 && c > 0 && <text x={BOT.r + c * SB} y={BENCH_Y + 22} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{c}</text>}
                    </g>
                  ))}
                  <text x={BOT.r + 30 * SB + 18} y={BENCH_Y + 22} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>cm</text>
                  {done && jetPaths.map((p) => p && readings.ranges[p.i] !== null && (
                    <g key={p.i}>
                      <line x1={p.x0 + p.X} x2={p.x0 + p.X} y1={FLOOR - 4} y2={FLOOR - 18 - p.i * 13} stroke="var(--data)" strokeWidth="0.8" />
                      <text x={p.x0 + p.X + 3} y={FLOOR - 20 - p.i * 13} style={{ fontSize: 9, fill: 'var(--data)', fontWeight: 700, fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{fmt(readings.ranges[p.i], 1)}</text>
                    </g>
                  ))}
                  {/* pizarra con las ecuaciones */}
                  <g filter="url(#kit-shadow-soft)">
                    <rect x={470} y={58} width={170} height={92} rx={6} fill="#24413a" stroke="#8b6b43" strokeWidth="4" />
                  </g>
                  <text x={482} y={80} style={{ fontSize: 10, fill: '#e6efe9', fontWeight: 700 }}>Nivel constante (la llave repone)</text>
                  <text x={482} y={101} style={{ fontSize: 11, fill: '#f7f3d6', fontFamily: 'var(--font-data)' }}>v = √(2·g·h)</text>
                  <text x={482} y={119} style={{ fontSize: 11, fill: '#f7f3d6', fontFamily: 'var(--font-data)' }}>t = √(2·y/g)</text>
                  <text x={482} y={137} style={{ fontSize: 11, fill: '#f7f3d6', fontFamily: 'var(--font-data)' }}>alcance = v·t</text>
                  <text x={(BOT.l + BOT.r) / 2 + 28} y={FLOOR - level * SB - 10} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>agua · {fmt(level, 0)} cm</text>
                </g>
              )}

              {!isJets && <UTube rise={shownRise} reading={done ? readings.rise : null} />}
              <Barometer p={probe.pAtm} reading={readings.pAtm} />
              <AltitudeProfile place={placeId} />
            </svg>
          }>
            {exp === 'sonda' && (
              <>
                <Plunger label="Sonda del manómetro: subir o bajar" value={DEPTH_MAX - depth} min={0} max={DEPTH_MAX} step={0.5} pageStep={5}
                  from={{ x: PX, y: gripY(DEPTH_MAX) }} to={{ x: PX, y: gripY(0) }} size={22}
                  valueText={(v) => `membrana a ${fmt(DEPTH_MAX - v, 1)} cm de profundidad`}
                  onChange={(v) => setDepth(Math.round((DEPTH_MAX - v) * 2) / 2)} />
                <DragHandle label="Cápsula de la sonda: orientación de la membrana" value={orientation} min={0} max={180} step={15} pageStep={45} unit="°" decimals={0}
                  hit={{ cx: PX - 22.5 * Math.sin((orientation * Math.PI) / 180), cy: membraneY(depth) + 22.5 * Math.cos((orientation * Math.PI) / 180), r: 8 }}
                  valueText={(v) => `${fmt(v, 0)}°: la membrana ${orientationText(v)}`}
                  // la lengüeta está en el lado opuesto a la membrana: orientación = 180° − ángulo de la lengüeta desde arriba
                  valueFromPoint={({ point }) => 180 - Math.abs(clockAngle({ x: PX, y: membraneY(depth) }, point))}
                  onChange={setOrientation} />
              </>
            )}
            {exp === 'pascal' && (
              <g onPointerDownCapture={(e) => {
                const svg = (e.target as SVGElement).ownerSVGElement;
                if (svg) setGrab(zoneAt(toSvgPoint(svg, e.clientX, e.clientY).x, SLOT_EDGES));
              }}>
                <DragHandle label="Estante de vasos de Pascal: vaso montado en el aparato" value={vesselIndex} min={0} max={VESSELS.length - 1} step={1} pageStep={1}
                  commit="end" hit={{ x: SHELF.x0, y: BENCH_Y - 82, w: SHELF.x1 - SHELF.x0, h: 82 }}
                  valueText={(v) => `montado: ${VESSELS[v]?.name.toLowerCase() ?? ''}`}
                  valueFromPoint={({ point, startValue }) => {
                    const inDrop = point.x >= DROP.x0 && point.x <= DROP.x1 && point.y >= DROP.y0 && point.y <= DROP.y1;
                    return inDrop && grab !== null ? grab : startValue;
                  }}
                  onDragChange={(d) => { if (!d) setGrab(null); }}
                  onChange={(v) => setVesselId(VESSELS[v].id)}>
                  {({ dragging, point }) => dragging && point && grab !== null && grab !== vesselIndex && (
                    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                      <rect x={DROP.x0} y={DROP.y0} width={DROP.x1 - DROP.x0} height={DROP.y1 - DROP.y0} rx={12} fill="var(--accent)"
                        opacity={point.x >= DROP.x0 && point.x <= DROP.x1 && point.y >= DROP.y0 ? 0.14 : 0.05} />
                      <PascalVessel v={VESSELS[grab]} cx={point.x} yb={point.y + 13 * SP * 0.6} s={SP * 0.6} h={0} ghost />
                    </g>
                  )}
                </DragHandle>
              </g>
            )}
            {isJets && (
              <>
                {HOLE_HEIGHTS.map((y, i) => (
                  <HoleSwitch key={y} cx={BOT.r} cy={holeY(y)} label={`Botella: agujero a ${y} cm del fondo`} checked={holes[i]} onToggle={() => toggleHole(i)} />
                ))}
                <Plunger label="Superficie del agua de la botella: nivel" value={level} min={PRESSURE_LIMITS.waterLevel[0]} max={PRESSURE_LIMITS.waterLevel[1]} step={1} unit="cm" decimals={0}
                  from={{ x: (BOT.l + BOT.r) / 2 - 20, y: FLOOR - PRESSURE_LIMITS.waterLevel[0] * SB }} to={{ x: (BOT.l + BOT.r) / 2 - 20, y: FLOOR - PRESSURE_LIMITS.waterLevel[1] * SB }} size={26}
                  onChange={setLevel} />
              </>
            )}
            <DragHandle label="Mapa de altitud: lugar del laboratorio" value={PLACES.findIndex((p) => p.id === placeId)} min={0} max={PLACES.length - 1} step={1} pageStep={1}
              hit={{ cx: PROF.x + PLACE_X[placeId], cy: altY(place.altitude), r: 7 }}
              valueText={(v) => `${PLACES[v]?.name ?? ''}, ${fmt(PLACES[v]?.altitude ?? 0, 0)} m de altitud`}
              valueFromPoint={({ point }) => {
                let best = 0;
                PLACES.forEach((p, i) => { if (Math.abs(PROF.x + PLACE_X[p.id] - point.x) < Math.abs(PROF.x + PLACE_X[PLACES[best].id] - point.x)) best = i; });
                return best;
              }}
              onChange={(v) => setPlaceId(PLACES[v].id)} />
          </ManipScene>
        </div>
        <ManipHint>{hint}</ManipHint>

        {!isJets ? (
          <div className="grid-2">
            <div className="stack">
              <h3>{exp === 'pascal' ? 'Presión en el fondo del vaso' : 'Presión en la membrana'}</h3>
              <Readout items={[
                { k: exp === 'pascal' ? 'Altura del líquido sobre la membrana' : 'Profundidad de la membrana', v: `${fmt(exp === 'pascal' ? height : depth, 1)} cm` },
                { k: 'Desnivel del manómetro (Δh)', v: show(`${fmt(readings.rise, 0)} mm`), data: true },
                { k: 'Presión manométrica (ρ_m·g·Δh)', v: show(`${fmt(analysis.gauge, 0)} Pa`), data: true },
                { k: 'Presión absoluta (p_atm + p_man)', v: show(`${fmt(analysis.pAbs, 1)} hPa`), data: true },
              ]} />
              {exp === 'pascal' && (
                <>
                  <h3>Líquido en el vaso</h3>
                  <Readout items={[
                    { k: 'Volumen de líquido (calculado)', v: `${fmt(pascal.volume, 0)} mL` },
                    { k: 'Peso del líquido (ρ·V·g)', v: `${fmt(pascal.weight, 2)} N` },
                    { k: 'Fuerza sobre la base (p_man·A)', v: show(`${fmt((analysis.gauge * baseAreaCm2(vessel)) / 1e4, 2)} N`), data: true },
                  ]} />
                </>
              )}
            </div>
            <div className="stack">
              <h3>Presión atmosférica</h3>
              <Readout items={[
                { k: 'Lugar', v: `${place.name} (≈ ${fmt(place.altitude, 0)} m)` },
                { k: 'Presión atmosférica (barómetro)', v: atmText, data: true },
                { k: 'Columna de mercurio equivalente', v: `${fmt(mercuryColumnMm(readings.pAtm), 0)} mmHg` },
                { k: atm === 'estandar' ? 'Con la fórmula isotérmica (15 °C)' : 'Con la atmósfera estándar (ISA)', v: `${fmt(otherAtm, 1)} hPa` },
              ]} />
              {done && Math.abs(readings.rise) > 0 && (
                <Notice kind="info">El manómetro mide la diferencia con el aire: {fmt(readings.rise, 0)} mm de agua equivalen a {fmt(analysis.gauge, 0)} Pa = {fmt(analysis.gauge / 100, 2)} hPa. Súmalos a la presión atmosférica para obtener la presión absoluta.</Notice>
              )}
            </div>
          </div>
        ) : (
          <div className="grid-2">
            <div className="stack">
              <h3>Alcance de los chorros (cinta métrica)</h3>
              <Readout items={HOLE_HEIGHTS.map((y, i) => ({
                k: `Alcance del chorro del agujero a ${y} cm`,
                v: !holes[i] ? 'sin agujero' : !jets[i].flows ? 'no sale agua' : show(`${fmt(readings.ranges[i], 1)} cm`),
                data: true,
              }))} />
            </div>
            <div className="stack">
              <h3>Rapidez de salida</h3>
              <Readout items={HOLE_HEIGHTS.map((y, i) => {
                const R = readings.ranges[i];
                return {
                  k: `Agujero a ${y} cm (h = ${fmt(jets[i].headCm, 0)} cm): medida · √(2gh)`,
                  v: R === null ? '—' : show(`${fmt(speedFromRange(R, y), 2)} · ${fmt(jets[i].vIdeal, 2)} m/s`),
                };
              })} />
              <p className="small muted" style={{ margin: 0 }}>Rapidez medida = alcance ÷ tiempo de caída, con t = √(2y/g). La de Torricelli supone un agujero ideal sin rozamiento.</p>
            </div>
          </div>
        )}

        <Chart title="Presión atmosférica según la altitud" xLabel="Altitud (m)" yLabel="Presión atmosférica (hPa)" xUnit="m" yUnit="hPa" height={240}
          exportName="presion-altitud" xDomain={[0, 4000]} series={[...altSeries, ...placeSeries]}
          hLines={[{ y: readings.pAtm, label: `Barómetro: ${atmText}` }]} />

        <details className="card">
          <summary>Densidades de los líquidos y equivalencias de presión</summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Densidades de los líquidos">
            <table>
              <caption className="sr-only">Densidad de los líquidos a 25 °C y presión manométrica a 10 cm de profundidad</caption>
              <thead><tr><th scope="col">Líquido</th><th scope="col" className="n">Densidad (kg/m³)</th><th scope="col" className="n">ρ·g·h a 10 cm (Pa)</th></tr></thead>
              <tbody>
                {LIQUIDS.map((l) => <tr key={l.id}><td>{l.name}</td><td className="n">{fmt(l.rho, 0)}</td><td className="n">{fmt(l.rho * 9.78 * 0.1, 0)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="small muted">1 hPa = 100 Pa · 1 kPa = 10 hPa · 1013,25 hPa = 760 mmHg ≈ 10,4 m de agua. g = 9,78 m/s² (Urabá).</p>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Segmented<ExpId> label="Experimento" value={exp} onChange={setExp}
            options={(['sonda', 'pascal', 'chorros'] as ExpId[]).map((e) => ({ value: e, label: EXP_LABEL[e] }))} />
          {!isJets && (
            <Select label="Líquido" value={liquidId} onChange={(v) => setLiquidId(v as LiquidId)}
              options={LIQUIDS.map((l) => ({ value: l.id, label: `${l.name} (${fmt(l.rho, 0)} kg/m³)` }))} />
          )}
          {exp === 'sonda' && (
            <>
              <Slider label="Profundidad de la sonda" value={depth} min={PRESSURE_LIMITS.depth[0]} max={PRESSURE_LIMITS.depth[1]} step={0.5} unit="cm" decimals={1} onChange={setDepth} />
              <Slider label="Orientación de la membrana" value={orientation} min={0} max={180} step={15} unit="°" decimals={0} onChange={setOrientation}
                hint="0° mira hacia arriba · 90° de lado · 180° hacia abajo." />
            </>
          )}
          {exp === 'pascal' && (
            <>
              <Segmented<VesselId> label="Vaso montado" value={vesselId} onChange={setVesselId}
                options={VESSELS.map((v) => ({ value: v.id, label: v.short }))} />
              <Slider label="Altura del líquido en el vaso" value={height} min={PRESSURE_LIMITS.liquidHeight[0]} max={PRESSURE_LIMITS.liquidHeight[1]} step={0.5} unit="cm" decimals={1} onChange={setHeight} />
            </>
          )}
          {isJets && (
            <>
              <Slider label="Nivel del agua en la botella" value={level} min={PRESSURE_LIMITS.waterLevel[0]} max={PRESSURE_LIMITS.waterLevel[1]} step={1} unit="cm" decimals={0} onChange={setLevel}
                hint="La llave repone el agua que sale: el nivel se mantiene constante." />
              <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="small" style={{ fontWeight: 600 }}>Agujeros de la botella</legend>
                {HOLE_HEIGHTS.map((y, i) => (
                  <label key={y} className="check"><input type="checkbox" checked={holes[i]} onChange={() => toggleHole(i)} /> Agujero a {y} cm del fondo</label>
                ))}
              </fieldset>
            </>
          )}
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={phase === 'midiendo'} onClick={measureNow}>{isJets ? 'Destapar los agujeros y medir' : 'Leer el manómetro'}</button>
          </div>
          <RecordButton onRecord={record} disabled={!done || (isJets && readings.ranges.every((r) => r === null))} />
        </div>
        <div className="card stack">
          <h3>Lugar y atmósfera</h3>
          <Select label="Lugar del laboratorio" value={placeId} onChange={(v) => setPlaceId(v as PlaceId)}
            options={PLACES.map((p) => ({ value: p.id, label: `${p.name} (${fmt(p.altitude, 0)} m)` }))} />
          <Segmented<AtmosphereModel> label="Modelo de la atmósfera" value={atm} onChange={setAtm}
            options={[{ value: 'estandar', label: ATM_LABEL.estandar }, { value: 'isoterma', label: ATM_LABEL.isoterma }]} />
        </div>
        <Notice>
          Presión manométrica: lo que el líquido agrega a la del aire (la mide el manómetro en U, ρ·g·h). Presión absoluta: la manométrica más la
          atmosférica (la del barómetro). En {place.name} el aire empuja con {atmText}; el manómetro marca lo mismo en cualquier ciudad.
        </Notice>
      </div>
    </div>
  );
}

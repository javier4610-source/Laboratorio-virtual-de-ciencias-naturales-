import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  COIL, EARTH_BH, FARADAY_PATH, GENERATOR, IND_LIMITS, INDUCTION_INSTRUMENTS, LAMP, MAGNETS, MU0, SOLENOID, coilLinkage, dipoleField,
  generatorEmfAt, idealSolenoidField, sampleSeries, signedMoment, simulateFaraday, simulateGenerator, simulateTransformer, solenoidField,
  synchronousRpm, type IndInstrumentId, type IndInstrumentSpec, type MagnetId, type Motion, type Pole, type Source,
} from '../models/induction';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { useMeasure, type MeasureFn } from '../components/Measurement';
import { useModelParams, usePublishModel } from '../components/Advanced';
import { DataLogger, LoggerRunCharts, SensorCard } from '../components/DataLogger';
import type { LoggerChannel, LoggerRun } from '../lib/logger';
import type { ModelQuantity } from '../lib/advanced';
import { Notice, Readout, RecordButton, Segmented, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, ContactShadow, Lcd } from './kit';
import { DragHandle, Knob, ManipHint, ManipScene } from './manipulate';

/* ------------------------------------------------------------------ utilidades */

/** Ficha del instrumento: la de src/labs/instruments.ts si ya está integrada; si no, la del modelo (respaldo local). */
function instrumentSpec(id: IndInstrumentId): IndInstrumentSpec {
  return INSTRUMENTS.induccion?.find((i) => i.id === id) ?? INDUCTION_INSTRUMENTS[id];
}

/** Número con signo menos tipográfico (−) y coma decimal; el cero no lleva signo. */
function sfmt(v: number, d: number): string {
  const t = fmt(Math.abs(v), d);
  return v < 0 && /[1-9]/.test(t) ? `−${t}` : t;
}

/** Movimiento reducido, seguro también fuera del navegador. */
const reducedMotion = () => { try { return prefersReducedMotion(); } catch { return false; } };

const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const RED = '#c62828', BLUE = '#1f5fae';
const INK_PAPER = '#2c4a73';

type Activity = 'campo' | 'faraday' | 'generador' | 'transformador';
type Api = LabProps['api'];

function IndDefs() {
  return (
    <defs>
      <linearGradient id="ind-copper" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f0b37a" />
        <stop offset="0.45" stopColor="#c97a3a" />
        <stop offset="1" stopColor="#7a3f14" />
      </linearGradient>
      <linearGradient id="ind-copper-h" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#7a3f14" />
        <stop offset="0.5" stopColor="#e9a76c" />
        <stop offset="1" stopColor="#7a3f14" />
      </linearGradient>
      <linearGradient id="ind-red" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ef6b63" />
        <stop offset="0.5" stopColor="#c62828" />
        <stop offset="1" stopColor="#7f1414" />
      </linearGradient>
      <linearGradient id="ind-blue" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#6aa2e6" />
        <stop offset="0.5" stopColor="#1f5fae" />
        <stop offset="1" stopColor="#0f3466" />
      </linearGradient>
      <linearGradient id="ind-iron" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#8d989c" />
        <stop offset="0.5" stopColor="#5f6b70" />
        <stop offset="1" stopColor="#3c4549" />
      </linearGradient>
      <linearGradient id="ind-paper" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fdfcf7" />
        <stop offset="1" stopColor="#f1eee3" />
      </linearGradient>
      <radialGradient id="ind-glow">
        <stop offset="0" stopColor="#fff6c4" stopOpacity="1" />
        <stop offset="0.4" stopColor="#ffd54f" stopOpacity="0.75" />
        <stop offset="1" stopColor="#ffb300" stopOpacity="0" />
      </radialGradient>
      <pattern id="ind-grid" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M16 0 H0 V16" fill="none" stroke="#c9d3de" strokeWidth="0.5" />
      </pattern>
    </defs>
  );
}

/** Imán de barra dibujado en horizontal; (cx, cy) = centro; `north` = lado donde está el polo N. */
function BarMagnet({ cx, cy, len, wid, north, label = true }: { cx: number; cy: number; len: number; wid: number; north: 'derecha' | 'izquierda'; label?: boolean }) {
  const x0 = cx - len / 2;
  const nLeft = north === 'izquierda';
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x0} y={cy - wid / 2} width={len / 2} height={wid} rx={2} fill={nLeft ? 'url(#ind-red)' : 'url(#ind-blue)'} />
        <rect x={cx} y={cy - wid / 2} width={len / 2} height={wid} rx={2} fill={nLeft ? 'url(#ind-blue)' : 'url(#ind-red)'} />
      </g>
      <rect x={x0} y={cy - wid / 2} width={len} height={wid * 0.28} rx={2} fill="#fff" opacity="0.22" />
      {label && (
        <g style={{ fontSize: Math.min(13, wid * 0.8), fontWeight: 800, fill: '#fff' }}>
          <text x={x0 + len * 0.16} y={cy + wid * 0.3} textAnchor="middle">{nLeft ? 'N' : 'S'}</text>
          <text x={x0 + len * 0.84} y={cy + wid * 0.3} textAnchor="middle">{nLeft ? 'S' : 'N'}</text>
        </g>
      )}
    </g>
  );
}

/** Flecha pequeña en (x, y) apuntando en el ángulo `deg` (grados de pantalla). */
function ArrowHead({ x, y, deg, color, s = 6 }: { x: number; y: number; deg: number; color: string; s?: number }) {
  return <path d={`M${s} 0 L${-s * 0.7} ${-s * 0.6} L${-s * 0.35} 0 L${-s * 0.7} ${s * 0.6} Z`} transform={`translate(${x} ${y}) rotate(${deg})`} fill={color} />;
}

/** Bombillo de vidrio con filamento; `glow` de 0 a 1; `broken` dibuja el filamento roto. */
function Bulb({ x, y, glow, broken = false, caption }: { x: number; y: number; glow: number; broken?: boolean; caption?: string }) {
  const g = broken ? 0 : clampN(glow, 0, 1);
  return (
    <g>
      {g > 0.02 && <circle cx={x} cy={y} r={22 + 40 * g} fill="url(#ind-glow)" opacity={0.25 + 0.75 * g} />}
      <path d={`M${x - 9} ${y + 16} Q${x - 22} ${y + 2} ${x - 16} ${y - 12} A18 18 0 1 1 ${x + 16} ${y - 12} Q${x + 22} ${y + 2} ${x + 9} ${y + 16} Z`}
        fill={g > 0.02 ? `rgba(255, 236, 160, ${0.35 + 0.6 * g})` : 'url(#kit-glass)'} stroke="#8fa3ab" strokeWidth="1" />
      <path d={`M${x - 4} ${y + 14} L${x - 5} ${y - 4} M${x + 4} ${y + 14} L${x + 5} ${y - 4}`} stroke="#6d7b80" strokeWidth="0.9" fill="none" />
      {broken
        ? <path d={`M${x - 5} ${y - 4} l3 -3 M${x + 5} ${y - 4} l-3 -2`} stroke="#5d4037" strokeWidth="1.2" fill="none" />
        : <path d={`M${x - 5} ${y - 4} q2.5 -4 5 0 q2.5 4 5 0`} stroke={g > 0.02 ? '#fff3c0' : '#5d4037'} strokeWidth={1.2 + g} fill="none" />}
      <rect x={x - 10} y={y + 16} width={20} height={12} rx={2} fill="url(#kit-metal-h)" stroke="#7d8a8f" strokeWidth="0.6" />
      {[19, 22, 25].map((d) => <line key={d} x1={x - 10} x2={x + 10} y1={y + d} y2={y + d} stroke="#7d8a8f" strokeWidth="0.6" />)}
      <rect x={x - 14} y={y + 28} width={28} height={8} rx={2} fill="url(#kit-body-dark)" />
      {caption && <text x={x} y={y + 50} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 600 }}>{caption}</text>}
    </g>
  );
}

/* ================================================================== 1. CAMPO MAGNÉTICO */

const FW = 860, FH = 440;
const FCX = 380, FCY = 228, FPX = 1600; // px por metro (16 px/cm)
const PAPER = { x: 40, y: 18, w: 680, h: 410 };
const toF = (x: number, y: number) => ({ x: FCX + x * FPX, y: FCY - y * FPX });
const SOL_TURN_OPTIONS = [100, 200, 400, 800];

type FieldSource = 'iman' | 'solenoide';

/** ¿La punta de la sonda puede estar en (x, y) (cm)? No puede entrar al imán ni al devanado del solenoide. */
function probeAllowed(src: FieldSource, x: number, y: number): boolean {
  if (src === 'iman') return !(Math.abs(x) < 3.6 && Math.abs(y) < 1.2);
  return !(Math.abs(x) < 10.6 && Math.abs(y) > 1.5 && Math.abs(y) < 2.7);
}

/** Corrige un movimiento de la sonda que caería dentro de un cuerpo: salta al otro lado (como levantar la sonda). */
function resolveProbe(src: FieldSource, x: number, y: number, prev: { x: number; y: number }): { x: number; y: number } {
  const lim = (v: number, a: [number, number]) => clampN(Math.round(v * 2) / 2, a[0] * 100, a[1] * 100);
  const nx = lim(x, IND_LIMITS.probe), ny = clampN(Math.round(y * 2) / 2, -12, 12);
  if (probeAllowed(src, nx, ny)) return { x: nx, y: ny };
  if (nx !== prev.x && ny === prev.y) {
    const edge = src === 'iman' ? 3.5 : 11;
    const jx = nx > prev.x ? edge : -edge;
    if (probeAllowed(src, jx, ny) && Math.sign(jx - prev.x) === Math.sign(nx - prev.x)) return { x: jx, y: ny };
  }
  if (ny !== prev.y && nx === prev.x) {
    const jy = src === 'iman' ? (ny > prev.y ? 1.5 : -1.5) : (ny > prev.y ? (ny > 0 ? 3 : -1) : (ny < 0 ? -3 : 1));
    if (probeAllowed(src, nx, jy)) return { x: nx, y: jy };
  }
  return prev;
}

/** Líneas de campo del dipolo (r = C·sen²θ), en coordenadas de pantalla. */
function dipoleLinePaths(): string[] {
  const Cs = [0.026, 0.034, 0.046, 0.064, 0.09, 0.13, 0.2, 0.32];
  const paths: string[] = [];
  for (const C of Cs) {
    for (const side of [1, -1]) {
      let d = '';
      for (let i = 1; i < 160; i++) {
        const th = (Math.PI * i) / 160;
        const r = C * Math.sin(th) ** 2;
        const p = toF(r * Math.cos(th), side * r * Math.sin(th));
        d += `${i === 1 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }
      paths.push(d);
    }
  }
  return paths;
}

let solenoidLinesCache: { d: string; arrow: { x: number; y: number; deg: number } | null }[] | null = null;
/** Líneas del solenoide trazadas numéricamente (Runge–Kutta de 2.º orden sobre el campo de 60 espiras). Se calculan una vez. */
function solenoidLines() {
  if (solenoidLinesCache) return solenoidLinesCache;
  const out: { d: string; arrow: { x: number; y: number; deg: number } | null }[] = [];
  const ds = 0.0025;
  const dir = (x: number, y: number) => { const f = solenoidField(1, 400, x, y); return { ux: f.bx / f.b, uy: f.by / f.b }; };
  for (const y0 of [0, 0.005, 0.0095, 0.0135, 0.0163, 0.0184]) {
    for (const side of y0 === 0 ? [1] : [1, -1]) {
      const pts: { x: number; y: number }[] = [];
      for (const sgn of [1, -1]) {
        let x = 0, y = side * y0;
        const seq: { x: number; y: number }[] = [];
        for (let i = 0; i < 700; i++) {
          const a = dir(x, y);
          const mx = x + (sgn * ds * a.ux) / 2, my = y + (sgn * ds * a.uy) / 2;
          const b = dir(mx, my);
          x += sgn * ds * b.ux; y += sgn * ds * b.uy;
          if (Math.abs(x) > 0.24 || Math.abs(y) > 0.16) break;
          seq.push({ x, y });
          if (i > 30 && Math.hypot(x, y - side * y0) < ds * 0.8) break;
        }
        if (sgn === 1) pts.push({ x: 0, y: side * y0 }, ...seq); else pts.unshift(...seq.reverse());
      }
      const d = pts.map((p, i) => { const s = toF(p.x, p.y); return `${i ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`; }).join('');
      // Flecha fuera del solenoide, donde la línea regresa (campo hacia −x).
      const outside = pts.filter((p) => Math.abs(p.y) > 0.026 && Math.abs(p.y) < 0.12);
      const far = outside.reduce<{ x: number; y: number } | null>((best, p) => (!best || Math.abs(p.x) < Math.abs(best.x) ? p : best), null);
      const arrow = far && Math.abs(far.x) < 0.02 ? { ...toF(far.x, far.y), deg: 180 } : null;
      out.push({ d, arrow });
    }
  }
  solenoidLinesCache = out;
  return out;
}

const COMPASS_SITES: { x: number; y: number }[] = (() => {
  const s: { x: number; y: number }[] = [];
  for (const x of [-0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18]) for (const y of [0.1, 0.05, -0.05, -0.1]) s.push({ x, y });
  for (const x of [-0.18, -0.14, 0.14, 0.18]) s.push({ x, y: 0 });
  return s;
})();

function Compass({ x, y, deg, smooth }: { x: number; y: number; deg: number; smooth: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={10} fill="#fbfbf8" stroke="#7d8a8f" strokeWidth="1.1" filter="url(#kit-shadow-soft)" />
      <circle r={8.6} fill="none" stroke="#c8ced0" strokeWidth="0.5" />
      <g style={{ transform: `rotate(${deg}deg)`, transition: smooth ? 'transform 0.45s cubic-bezier(.3,1.6,.5,1)' : undefined }}>
        <path d="M8 0 L0 -2.2 L0 2.2 Z" fill={RED} />
        <path d="M-8 0 L0 -2.2 L0 2.2 Z" fill="#9aa5a9" />
      </g>
      <circle r={1.3} fill="#37474f" />
    </g>
  );
}

function FieldActivity({ api, measure, top }: { api: Api; measure: MeasureFn; top: ReactNode }) {
  const P = useModelParams();
  const [source, setSource] = useState<FieldSource>('iman');
  const [magnet, setMagnet] = useState<MagnetId>('ferrita');
  const [current, setCurrent] = useState(2);
  const [solTurns, setSolTurns] = useState(400);
  const [probe, setProbe] = useState({ x: 10, y: 0 });
  const smooth = useMemo(() => !reducedMotion(), []);

  const moment = magnet === 'ferrita' ? (P.momento ?? MAGNETS.ferrita.moment) : MAGNETS.neodimio.moment;
  const fieldAt = useMemo(() => (x: number, y: number) => (source === 'iman' ? dipoleField(moment, x, y) : solenoidField(current, solTurns, x, y)),
    [source, moment, current, solTurns]);
  const B = useMemo(() => {
    const f = fieldAt(probe.x / 100, probe.y / 100);
    return { bx: f.bx * 1000, by: f.by * 1000, b: f.b * 1000 };
  }, [fieldAt, probe]);
  const tes = instrumentSpec('teslametro');
  const reading = useMemo(() => ({
    b: Math.max(0, measure(B.b, { ...tes, key: 'B' })),
    bx: measure(B.bx, { ...tes, key: 'Bx' }),
    by: measure(B.by, { ...tes, key: 'By' }),
  }), [B, measure, tes]);
  const compasses = useMemo(() => COMPASS_SITES.map((s) => {
    const f = fieldAt(s.x, s.y);
    const bx = f.bx, by = f.by + EARTH_BH;
    return { ...toF(s.x, s.y), deg: (Math.atan2(-by, bx) * 180) / Math.PI };
  }), [fieldAt]);
  const dipolePaths = useMemo(dipoleLinePaths, []);
  const solLines = useMemo(() => (source === 'solenoide' ? solenoidLines() : []), [source]);
  const nIdeal = solTurns / SOLENOID.length;
  const bIdeal = idealSolenoidField(nIdeal, current) * 1000;

  usePublishModel(() => ({
    vars: (source === 'iman'
      ? {
        m: { sym: 'm', name: 'Momento magnético del imán', value: moment, unit: 'A·m²', decimals: 2 },
        r: { sym: 'r', name: 'Distancia de la sonda al centro', value: Math.hypot(probe.x, probe.y) / 100, unit: 'm', decimals: 3 },
        B: { sym: 'B', name: 'Campo en la sonda', value: B.b, unit: 'mT', decimals: 3 },
        Ba: { sym: 'B_{eje}', name: 'Campo en el eje a la misma distancia', value: (MU0 * moment) / (2 * Math.PI * (Math.hypot(probe.x, probe.y) / 100) ** 3) * 1000, unit: 'mT', decimals: 3 },
      }
      : {
        n: { sym: 'n', name: 'Vueltas por metro', value: nIdeal, unit: '1/m', decimals: 0 },
        I: { sym: 'I', name: 'Corriente', value: current, unit: 'A', decimals: 2 },
        mu0: { sym: '\\mu_{0}', name: 'Permeabilidad del vacío', value: MU0, unit: 'T·m/A', sig: 4 },
        Bi: { sym: 'B_{ideal}', name: 'Campo del solenoide ideal', value: bIdeal / 1000, unit: 'T', sig: 4 },
        B: { sym: 'B', name: 'Campo en la sonda (suma de 60 espiras)', value: B.b / 1000, unit: 'T', sig: 4 },
      }) as Record<string, ModelQuantity>,
    equations: source === 'iman'
      ? [{ title: 'Dipolo en su eje', lhs: 'Ba', expr: '\\frac{μ₀·[m]}{2π·[r]^{3}}', note: 'Fuera del eje el campo es menor (la mitad en el plano perpendicular).' }]
      : [{ title: 'Solenoide ideal', lhs: 'Bi', expr: '[mu0]·[n]·[I]', note: 'El solenoide real (20 cm) tiene en el centro ≈ 98 % de este valor.' }],
  }), [source, moment, probe, B, nIdeal, current, bIdeal]);

  const changeSource = (s: FieldSource) => {
    setSource(s);
    setProbe((p) => (probeAllowed(s, p.x, p.y) ? p : { x: 0, y: s === 'iman' ? 5 : 0 }));
    playSound('clack', { intensity: 0.5 });
  };
  const moveProbe = (x: number, y: number) => setProbe((p) => resolveProbe(source, x, y, p));

  const record = () => {
    api.addTrial('campo', {
      fuente: source === 'iman' ? `Imán de ${MAGNETS[magnet].short.toLowerCase()}` : 'Solenoide',
      corriente: source === 'solenoide' ? current : null,
      vueltasSolenoide: source === 'solenoide' ? solTurns : null,
      n: source === 'solenoide' ? nIdeal : null,
      x: probe.x, y: probe.y, r: Number(Math.hypot(probe.x, probe.y).toFixed(2)),
      B: reading.b, Bideal: source === 'solenoide' ? Number(bIdeal.toFixed(4)) : null,
    });
  };

  const tip = toF(probe.x / 100, probe.y / 100);
  const wandEnd = { x: tip.x + 70, y: tip.y - 70 };
  const solX0 = toF(-SOLENOID.length / 2, 0).x, solX1 = toF(SOLENOID.length / 2, 0).x;
  const solR = SOLENOID.radius * FPX;
  const turnsDrawn = Math.round(14 + solTurns / 25);
  const ml = MAGNETS[magnet].length * FPX, mw = MAGNETS[magnet].width * FPX;
  const desc = `${source === 'iman' ? `Imán de barra de ${MAGNETS[magnet].short.toLowerCase()} con el polo N a la derecha` : `Solenoide de ${solTurns} vueltas con ${fmt(current, 1)} A`} sobre una hoja, rodeado de brújulas. ` +
    `La sonda Hall está en x = ${fmt(probe.x, 1)} cm, y = ${fmt(probe.y, 1)} cm y el teslámetro marca ${fmt(reading.b, 2)} mT.`;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Mesa del mapa de campo magnético">
          <ManipScene viewBox={`0 0 ${FW} ${FH}`} label="Controles del mapa de campo" scene={
            <svg viewBox={`0 0 ${FW} ${FH}`} role="img" aria-labelledby="ind-f-t ind-f-d">
              <title id="ind-f-t">{source === 'iman' ? 'Campo magnético de un imán de barra' : 'Campo magnético de un solenoide'}</title>
              <desc id="ind-f-d">{desc}</desc>
              <IndDefs />
              <clipPath id="ind-paper-clip"><rect x={PAPER.x} y={PAPER.y} width={PAPER.w} height={PAPER.h} /></clipPath>
              <rect x={0} y={0} width={FW} height={FH} fill="url(#kit-wood)" />
              <rect x={PAPER.x} y={PAPER.y} width={PAPER.w} height={PAPER.h} rx={3} fill="url(#ind-paper)" filter="url(#kit-shadow-soft)" />
              <rect x={PAPER.x} y={PAPER.y} width={PAPER.w} height={PAPER.h} fill="url(#ind-grid)" opacity="0.7" />
              <g clipPath="url(#ind-paper-clip)">
                {source === 'iman' && (
                  <g fill="none" stroke={INK_PAPER} strokeWidth="1" opacity="0.6">
                    {dipolePaths.map((d, i) => <path key={i} d={d} />)}
                  </g>
                )}
                {source === 'iman' && [0.046, 0.09, 0.2].flatMap((C) => [1, -1].map((s) => {
                  const p = toF(0, s * C);
                  return <ArrowHead key={`${C}${s}`} x={p.x} y={p.y} deg={180} color={INK_PAPER} />;
                }))}
                {source === 'solenoide' && current > 0 && (
                  <g>
                    <g fill="none" stroke={INK_PAPER} strokeWidth="1" opacity="0.6">{solLines.map((l, i) => <path key={i} d={l.d} />)}</g>
                    {solLines.map((l, i) => l.arrow && <ArrowHead key={i} x={l.arrow.x} y={l.arrow.y} deg={l.arrow.deg} color={INK_PAPER} />)}
                    <ArrowHead x={FCX + 60} y={FCY} deg={0} color={INK_PAPER} />
                  </g>
                )}
              </g>
              {/* brújulas */}
              {compasses.map((c, i) => <Compass key={i} x={c.x} y={c.y} deg={c.deg} smooth={smooth} />)}

              {/* fuente del campo */}
              {source === 'iman' ? (
                <BarMagnet cx={FCX} cy={FCY} len={ml} wid={mw} north="derecha" />
              ) : (
                <g>
                  <rect x={solX0 - 4} y={FCY - solR - 6} width={solX1 - solX0 + 8} height={2 * solR + 12} rx={5} fill="url(#kit-glass)" stroke="#9fb3bb" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
                  {Array.from({ length: turnsDrawn }, (_, i) => {
                    const x = solX0 + ((i + 0.5) * (solX1 - solX0)) / turnsDrawn;
                    return <line key={i} x1={x - 2} x2={x + 2} y1={FCY - solR - 3} y2={FCY + solR + 3} stroke="url(#ind-copper-h)" strokeWidth={Math.max(1.4, Math.min(5, 220 / turnsDrawn))} strokeLinecap="round" />;
                  })}
                  {current > 0 && [-1, 1].map((s) => (
                    <g key={s}>
                      <ArrowHead x={FCX + s * 90} y={FCY - solR - 12} deg={-90} color="var(--fis)" s={5} />
                      <ArrowHead x={FCX + s * 90} y={FCY + solR + 12} deg={90} color="var(--fis)" s={5} />
                    </g>
                  ))}
                  <text x={solX1 + 8} y={FCY - solR - 8} style={{ fontSize: 11, fontWeight: 800, fill: RED }}>{current > 0 ? 'N' : ''}</text>
                  <text x={solX0 - 16} y={FCY - solR - 8} style={{ fontSize: 11, fontWeight: 800, fill: BLUE }}>{current > 0 ? 'S' : ''}</text>
                  <path d={`M${solX0} ${FCY + solR + 4} C${solX0 - 20} ${FCY + 120} ${760} ${FCY + 160} ${790} ${300}`} fill="none" stroke="#b71c1c" strokeWidth="1.6" />
                  <path d={`M${solX1} ${FCY + solR + 4} C${solX1 + 30} ${FCY + 110} ${780} ${FCY + 150} ${812} ${300}`} fill="none" stroke="#263238" strokeWidth="1.6" />
                </g>
              )}

              {/* sonda Hall y teslámetro */}
              <path d={`M${wandEnd.x + 28} ${wandEnd.y - 28} C${wandEnd.x + 90} ${wandEnd.y - 90} 760 40 790 70`} fill="none" stroke="#263238" strokeWidth="2" opacity="0.85" />
              <line x1={tip.x} y1={tip.y} x2={wandEnd.x} y2={wandEnd.y} stroke="url(#kit-metal)" strokeWidth="4" strokeLinecap="round" />
              <line x1={wandEnd.x} y1={wandEnd.y} x2={wandEnd.x + 28} y2={wandEnd.y - 28} stroke="#263238" strokeWidth="9" strokeLinecap="round" />
              <circle cx={tip.x} cy={tip.y} r={3.2} fill="#111" stroke="#fff" strokeWidth="1" />
              <circle cx={tip.x} cy={tip.y} r={9} fill="none" stroke="var(--data)" strokeWidth="1.2" strokeDasharray="2 2" />

              <g>
                <rect x={734} y={14} width={118} height={150} rx={10} fill="url(#kit-body-dark)" filter="url(#kit-shadow)" />
                <text x={793} y={34} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: '#d6dee0', letterSpacing: 0.6 }}>TESLÁMETRO</text>
                <Lcd x={742} y={42} w={102} h={30} text={fmt(reading.b, 2)} unit="mT" />
                <text x={793} y={90} textAnchor="middle" style={{ fontSize: 8.5, fill: '#b9c4c7' }}>sonda Hall de 3 ejes</text>
                <text x={793} y={104} textAnchor="middle" style={{ fontSize: 8.5, fill: '#b9c4c7' }}>cero hecho lejos</text>
                <text x={793} y={116} textAnchor="middle" style={{ fontSize: 8.5, fill: '#b9c4c7' }}>de los imanes</text>
                <circle cx={772} cy={140} r={7} fill="url(#kit-metal)" />
                <circle cx={814} cy={140} r={7} fill="url(#kit-metal)" />
              </g>
              {source === 'solenoide' && (
                <g>
                  <rect x={734} y={180} width={118} height={124} rx={10} fill="url(#kit-body)" stroke="#9aa5a9" filter="url(#kit-shadow)" />
                  <text x={793} y={198} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: '#37474f', letterSpacing: 0.4 }}>FUENTE CC</text>
                  <Lcd x={742} y={204} w={102} h={28} text={fmt(current, 2)} unit="A" />
                  <circle cx={790} cy={300} r={5} fill="#b71c1c" /><circle cx={812} cy={300} r={5} fill="#263238" />
                </g>
              )}
              {/* rosa de los vientos y campo terrestre */}
              <g transform="translate(793 372)">
                <circle r={36} fill="var(--surface)" stroke="var(--line)" />
                <line x1={0} y1={12} x2={0} y2={-12} stroke="var(--ink-2)" strokeWidth="1.6" />
                <ArrowHead x={0} y={-12} deg={-90} color="var(--ink-2)" />
                <text x={0} y={-21} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: 'var(--ink)' }}>N</text>
                <text x={0} y={25} textAnchor="middle" style={{ fontSize: 7.5, fill: 'var(--ink-2)' }}>Tierra ≈ 29 µT</text>
              </g>
            </svg>}>
            <DragHandle label="Sonda Hall: arrástrala por la hoja (las flechas la mueven en horizontal)" value={probe.x} min={-20} max={20} step={0.5} pageStep={5}
              unit="cm" decimals={1} hit={{ cx: tip.x, cy: tip.y, r: 14 }}
              valueText={(v) => `x = ${fmt(v, 1)} cm, y = ${fmt(probe.y, 1)} cm; ${fmt(reading.b, 2)} mT`}
              valueFromPoint={({ point }) => {
                const nx = (point.x - FCX) / (FPX / 100), ny = (FCY - point.y) / (FPX / 100);
                const r = resolveProbe(source, nx, ny, probe);
                if (r.y !== probe.y) setProbe(r);
                return r.x;
              }}
              onChange={(v) => setProbe((p) => resolveProbe(source, v, p.y, p))} />
            {source === 'solenoide' && (
              <Knob cx={793} cy={262} r={15} label="Perilla de la fuente: corriente del solenoide" value={current} min={IND_LIMITS.current[0]} max={IND_LIMITS.current[1]} step={0.1} pageStep={0.5}
                unit="A" decimals={1} onChange={(v) => setCurrent(Number(v.toFixed(1)))} />
            )}
          </ManipScene>
        </div>
        <ManipHint>Arrastra la sonda Hall por la hoja: el teslámetro mide el campo en su punta y las brújulas se alinean con las líneas de campo. Con el teclado, enfoca la sonda y usa las flechas, o usa los controles de posición del panel.</ManipHint>
        <div className="grid-2">
          <div className="stack">
            <h3>Teslámetro (0,01 mT)</h3>
            <Readout items={[
              { k: 'Posición de la sonda (x; y)', v: `${fmt(probe.x, 1)} cm; ${fmt(probe.y, 1)} cm` },
              { k: 'Distancia al centro r', v: `${fmt(Math.hypot(probe.x, probe.y), 1)} cm` },
              { k: 'Campo en la sonda |B|', v: `${fmt(reading.b, 2)} mT`, data: true },
              { k: 'Componentes Bx; By', v: `${sfmt(reading.bx, 2)} mT; ${sfmt(reading.by, 2)} mT` },
            ]} />
          </div>
          <div className="stack">
            <h3>{source === 'iman' ? 'Imán de barra (dipolo)' : 'Solenoide'}</h3>
            {source === 'iman' ? (
              <Readout items={[
                { k: 'Momento magnético m', v: `${fmt(moment, 1)} A·m²` },
                { k: 'Dirección del campo', v: `${fmt(((Math.atan2(B.by, B.bx) * 180) / Math.PI + 360) % 360, 0)}° desde +x` },
              ]} />
            ) : (
              <Readout items={[
                { k: 'Vueltas por metro n = N/L', v: `${fmt(nIdeal, 0)} vueltas/m` },
                { k: 'Solenoide ideal μ₀·n·I', v: `${fmt(bIdeal, 2)} mT`, data: true },
              ]} />
            )}
            <p className="small muted">Las brújulas sienten también el campo terrestre (≈ 29 µT hacia el norte geográfico, arriba en la hoja): lejos de la fuente apuntan al norte.</p>
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          {top}
          <Segmented<FieldSource> label="Fuente del campo" value={source} onChange={changeSource}
            options={[{ value: 'iman', label: 'Imán de barra' }, { value: 'solenoide', label: 'Solenoide' }]} />
          {source === 'iman' ? (
            <Segmented<MagnetId> label="Material del imán del mapa" value={magnet} onChange={(m) => { setMagnet(m); playSound('clack', { intensity: 0.4 }); }}
              options={[{ value: 'ferrita', label: 'Ferrita' }, { value: 'neodimio', label: 'Neodimio' }]} />
          ) : (
            <>
              <Slider label="Corriente del solenoide" value={current} min={IND_LIMITS.current[0]} max={IND_LIMITS.current[1]} step={0.1} unit="A" decimals={1} onChange={setCurrent} />
              <Segmented<string> label="Vueltas del solenoide (20 cm)" value={String(solTurns)} onChange={(v) => setSolTurns(Number(v))}
                options={SOL_TURN_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))} />
            </>
          )}
          <Slider label="Posición x de la sonda" value={probe.x} min={-20} max={20} step={0.5} unit="cm" decimals={1} onChange={(v) => moveProbe(v, probe.y)} />
          <Slider label="Posición y de la sonda" value={probe.y} min={-12} max={12} step={0.5} unit="cm" decimals={1} onChange={(v) => moveProbe(probe.x, v)}
            hint="La sonda no puede entrar al imán ni al devanado: salta al otro lado." />
          <RecordButton onRecord={record} />
        </div>
        <Notice>Supuestos: el imán es un dipolo puntual (válido lejos de él); el solenoide se calcula como 60 espiras con el campo exacto de cada una. El teslámetro descuenta el campo terrestre.</Notice>
      </div>
    </div>
  );
}

/* ================================================================== 2. LEY DE FARADAY */

const AW = 760, AH = 300;
const A_BENCH = 268, A_AXIS = 140, A_S = 1300, A_CX = 420;
const toA = (x: number) => A_CX + x * A_S;
const TURN_OPTIONS = [50, 100, 200, 400, 800];
const GALV_MAX = 1000; // mV a fondo de escala

type FPhase = 'listo' | 'midiendo' | 'medido' | 'mano';
interface LiveTrace { pts: { t: number; e: number }[]; t0: number; lastT: number; lastX: number; firstX: number; firstT: number; area: number; peak: number; emf: number }

function Galvanometer({ x, y, emf }: { x: number; y: number; emf: number }) {
  const over = Math.abs(emf) > GALV_MAX;
  const ang = clampN(emf / GALV_MAX, -1.08, 1.08) * 50;
  const cx = x + 90, cy = y + 128;
  const tick = (v: number, len: number) => {
    const a = ((v / GALV_MAX) * 50 * Math.PI) / 180;
    return { x1: cx + 96 * Math.sin(a), y1: cy - 96 * Math.cos(a), x2: cx + (96 - len) * Math.sin(a), y2: cy - (96 - len) * Math.cos(a) };
  };
  return (
    <g>
      <ContactShadow x={x} y={y + 170} w={180} h={8} />
      <rect x={x} y={y} width={180} height={170} rx={12} fill="url(#kit-body-dark)" filter="url(#kit-shadow)" />
      <path d={`M${x + 14} ${y + 140} L${x + 14} ${y + 40} Q${x + 14} ${y + 14} ${x + 40} ${y + 14} L${x + 140} ${y + 14} Q${x + 166} ${y + 14} ${x + 166} ${y + 40} L${x + 166} ${y + 140} Z`} fill="#fbf8ec" stroke="#11181a" />
      {Array.from({ length: 21 }, (_, i) => -GALV_MAX + i * 100).map((v) => {
        const t = tick(v, v % 500 === 0 ? 12 : 7);
        return <line key={v} {...t} stroke="#263238" strokeWidth={v % 500 === 0 ? 1.4 : 0.8} />;
      })}
      {[-1000, -500, 0, 500, 1000].map((v) => {
        const a = ((v / GALV_MAX) * 50 * Math.PI) / 180;
        return <text key={v} x={cx + 74 * Math.sin(a)} y={cy - 74 * Math.cos(a) + 3} textAnchor="middle" style={{ fontSize: 8.5, fill: '#263238', fontFamily: 'var(--font-data)' }}>{v === 0 ? '0' : sfmt(v, 0)}</text>;
      })}
      <path d={`M${cx - 70} ${cy - 50} A86 86 0 0 1 ${cx - 44} ${cy - 74}`} fill="none" stroke={BLUE} strokeWidth="3" opacity="0.6" />
      <path d={`M${cx + 44} ${cy - 74} A86 86 0 0 1 ${cx + 70} ${cy - 50}`} fill="none" stroke={RED} strokeWidth="3" opacity="0.6" />
      <text x={cx} y={cy - 30} textAnchor="middle" style={{ fontSize: 10, fill: '#263238', fontWeight: 700 }}>mV</text>
      <line x1={cx} y1={cy} x2={cx + 92 * Math.sin((ang * Math.PI) / 180)} y2={cy - 92 * Math.cos((ang * Math.PI) / 180)} stroke={over ? 'var(--bad)' : '#b71c1c'} strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="url(#kit-metal)" stroke="#37474f" />
      <text x={cx} y={y + 160} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: '#d6dee0', letterSpacing: 0.6 }}>GALVANÓMETRO</text>
      <circle cx={x + 22} cy={y + 156} r={5} fill="#b71c1c" /><circle cx={x + 158} cy={y + 156} r={5} fill="#263238" />
    </g>
  );
}

/** Gráfica de ε(t) con el área sombreada (∫ε dt). */
function EmfTrace({ t, e, tMax, cursor, title, live }: { t: number[]; e: number[]; tMax: number; cursor: number | null; title: string; live: boolean }) {
  const W = 760, H = 220, L = 62, R = 14, T = 16, B = 34;
  const peak = e.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const steps = [20, 50, 100, 200, 500, 1000, 2000, 5000];
  const yMax = steps.find((s) => s >= peak * 1.1) ?? 5000;
  const t0 = live ? Math.max(0, tMax - 4) : 0, span = Math.max(1e-6, live ? 4 : tMax);
  const X = (v: number) => L + ((v - t0) / span) * (W - L - R);
  const Y = (v: number) => T + (H - T - B) / 2 - (v / yMax) * ((H - T - B) / 2);
  const geom = useMemo(() => {
    const n = Math.min(t.length, e.length);
    const stride = Math.max(1, Math.floor(n / 700));
    let line = '', area = '';
    for (let i = 0; i < n; i += stride) {
      if (t[i] < t0) continue;
      const px = X(t[i]).toFixed(1), py = Y(e[i]).toFixed(1);
      line += `${line ? 'L' : 'M'}${px} ${py}`;
      area += `${area ? 'L' : `M${px} ${Y(0).toFixed(1)}L`}${px} ${py}`;
    }
    if (n > 0 && area) area += `L${X(t[n - 1]).toFixed(1)} ${Y(0).toFixed(1)}Z`;
    return { line, area };
  }, [t, e, t0, span, yMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const xt = Array.from({ length: 6 }, (_, i) => t0 + (i * span) / 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="ind-tr-t ind-tr-d" style={{ width: '100%' }}>
      <title id="ind-tr-t">{title}</title>
      <desc id="ind-tr-d">{e.length ? `Pico de ${sfmt(e.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0), 0)} mV; escala vertical ±${fmt(yMax, 0)} mV.` : 'Aún no hay datos.'}</desc>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="var(--surface-2)" stroke="var(--line)" />
      {[-1, -0.5, 0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={Y(f * yMax)} y2={Y(f * yMax)} stroke="var(--line)" strokeWidth={f === 0 ? 1.2 : 0.6} />
          <text x={L - 6} y={Y(f * yMax) + 3.5} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{sfmt(f * yMax, 0)}</text>
        </g>
      ))}
      {xt.map((v) => <text key={v} x={X(v)} y={H - B + 14} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(v, live ? 1 : 2)}</text>)}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>tiempo (s)</text>
      <text x={14} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`} style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>fem ε (mV)</text>
      <path d={geom.area} fill="var(--fis)" opacity="0.18" />
      <path d={geom.line} fill="none" stroke="var(--fis)" strokeWidth="2" strokeLinejoin="round" />
      {cursor !== null && cursor >= t0 && <line x1={X(cursor)} x2={X(cursor)} y1={T} y2={H - B} stroke="var(--data)" strokeWidth="1.2" strokeDasharray="3 3" />}
    </svg>
  );
}

function FaradayActivity({ api, measure, remeasure, top }: { api: Api; measure: MeasureFn; remeasure: (...k: string[]) => void; top: ReactNode }) {
  const P = useModelParams();
  const [magnet, setMagnet] = useState<MagnetId>('ferrita');
  const [pole, setPole] = useState<Pole>('N');
  const [turns, setTurns] = useState(200);
  const [speed, setSpeed] = useState(0.5);
  const [motion, setMotion] = useState<Motion>('introducir');
  const [phase, setPhase] = useState<FPhase>('listo');
  const [elapsed, setElapsed] = useState(0);
  const [xm, setXm] = useState(FARADAY_PATH.outside); // m, centro del imán
  const [liveVer, setLiveVer] = useState(0);
  const [needle, setNeedle] = useState(0);
  const [sensorRun, setSensorRun] = useState<LoggerRun | null>(null);
  const raf = useRef(0);
  const live = useRef<LiveTrace | null>(null);
  const tickBucket = useRef(0);

  const momentFerrite = P.momento;
  const run = useMemo(() => simulateFaraday({ magnet, pole, turns, speed, motion, moment: magnet === 'ferrita' ? momentFerrite : undefined }),
    [magnet, pole, turns, speed, motion, momentFerrite]);
  const m = signedMoment(magnet, pole, magnet === 'ferrita' ? momentFerrite : undefined);
  const emfMv = useMemo(() => run.emf.map((v) => v * 1000), [run]);
  const dispMs = clampN(run.duration * 4000, 1200, 5000);
  const slow = dispMs / (run.duration * 1000);

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setElapsed(0); live.current = null; setNeedle(0); };
  useEffect(reset, [magnet, pole, turns, speed]);

  // Repetición de la corrida a velocidad constante (cámara lenta).
  useEffect(() => {
    if (phase !== 'midiendo') return;
    const finish = () => { setElapsed(dispMs); setPhase('medido'); setXm(run.x[run.x.length - 1]); setNeedle(0); playSound('clack', { intensity: 0.55 }); };
    if (prefersReducedMotion()) { finish(); return; }
    const start = performance.now();
    const step = (now: number) => {
      const el = Math.min(dispMs, Math.max(0, now - start));
      const ts = el / 1000 / slow;
      setElapsed(el);
      setXm(sampleSeries(run.t, run.x, ts));
      const e = sampleSeries(run.t, emfMv, ts);
      setNeedle(e);
      const b = Math.round(e / 100);
      if (b !== tickBucket.current) { tickBucket.current = b; playSound('tick', { intensity: 0.35 }); }
      if (el >= dispMs) { finish(); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, run, emfMv, dispMs, slow]);

  // Movimiento a mano: la aguja vuelve a cero cuando el imán se detiene.
  useEffect(() => {
    if (phase !== 'mano') return;
    const step = (now: number) => {
      const L = live.current;
      if (!L) return;
      const idle = (now - L.lastT) / 1000;
      if (idle > 0.06 && L.emf !== 0) {
        L.emf = 0;
        L.pts.push({ t: (now - L.t0) / 1000, e: 0 });
        setLiveVer((v) => v + 1);
      }
      setNeedle((n) => { const target = L.emf; const k = prefersReducedMotion() ? 1 : 0.35; const nn = n + (target - n) * k; return Math.abs(nn - target) < 0.5 ? target : nn; });
      if (idle > 1.2 && L.emf === 0) return; // quieto: se reanuda con el próximo movimiento
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, liveVer]);

  const startRun = (mo: Motion) => {
    cancelAnimationFrame(raf.current);
    setMotion(mo);
    setXm(mo === 'introducir' ? FARADAY_PATH.outside : FARADAY_PATH.inside);
    live.current = null;
    remeasure('pico', 'area', 'tpico');
    playSound('whoosh', { intensity: 0.3 + speed * 0.4 });
    setElapsed(0);
    setPhase('midiendo');
  };

  const dragMagnet = (vCm: number) => {
    const x = clampN(vCm / 100, FARADAY_PATH.outside, FARADAY_PATH.inside);
    const now = performance.now();
    if (phase === 'midiendo') return;
    let L = live.current;
    if (phase !== 'mano' || !L) {
      L = { pts: [{ t: 0, e: 0 }], t0: now - 50, lastT: now - 50, lastX: xm, firstX: xm, firstT: now, area: 0, peak: 0, emf: 0 };
      live.current = L;
      setPhase('mano');
    }
    const gap = (now - L.lastT) / 1000;
    const dt = gap > 0.3 ? 0.1 : Math.max(0.016, gap);
    const l0 = coilLinkage(m, turns, L.lastX), l1 = coilLinkage(m, turns, x);
    const e = (0 - (l1 - l0) / dt) * 1000;
    const tNow = (now - L.t0) / 1000;
    if (gap > 0.08) L.pts.push({ t: tNow - dt, e: 0 });
    L.pts.push({ t: tNow, e });
    if (L.pts.length > 4000) L.pts.splice(0, L.pts.length - 4000);
    L.area += 0 - (l1 - l0) * 1000;
    if (Math.abs(e) > Math.abs(L.peak)) L.peak = e;
    L.emf = e; L.lastT = now; L.lastX = x;
    const b = Math.round(e / 100);
    if (b !== tickBucket.current) { tickBucket.current = b; playSound('tick', { intensity: 0.35 }); }
    if (x === FARADAY_PATH.inside && xm !== FARADAY_PATH.inside) playSound('clack', { intensity: 0.5 });
    setXm(x);
    setLiveVer((v) => v + 1);
  };

  const measured = phase === 'medido';
  const sensor = instrumentSpec('sensorFem');
  const readings = useMemo(() => ({
    peak: measure(run.peak * 1000, { ...sensor, key: 'pico' }),
    area: measure(run.area * 1000, { ...sensor, resolution: 0.01, sigma: 0.04, relSigma: 0.01, key: 'area' }),
    tPeak: measure(run.peakTime, { resolution: 0.0005, sigma: 0.002, key: 'tpico' }),
  }), [run, measure, sensor]);
  const lInit = run.linkage[0] * 1000, lEnd = run.linkage[run.linkage.length - 1] * 1000;
  const L = live.current;
  void liveVer;
  const liveSpeed = L && L.lastT > L.firstT ? Math.abs(L.lastX - L.firstX) / ((L.lastT - L.firstT) / 1000) : null;

  usePublishModel(() => ({
    vars: {
      N: { sym: 'N', name: 'Vueltas de la bobina', value: turns, decimals: 0 },
      m: { sym: 'm', name: 'Momento del imán (con signo)', value: m, unit: 'A·m²', decimals: 2 },
      a: { sym: 'a', name: 'Radio de la bobina', value: COIL.radius, unit: 'm', decimals: 3 },
      v: { sym: 'v', name: 'Rapidez del imán', value: speed, unit: 'm/s', decimals: 2 },
      L0: { sym: 'Λ_{0}', name: 'Flujo enlazado inicial', value: run.linkage[0], unit: 'Wb', sig: 4 },
      L1: { sym: 'Λ_{1}', name: 'Flujo enlazado final', value: run.linkage[run.linkage.length - 1], unit: 'Wb', sig: 4 },
      S: { sym: '∫ε dt', name: 'Área bajo la curva', value: run.minusDeltaLinkage, unit: 'Wb', sig: 4 },
      ep: { sym: 'ε_{pico}', name: 'Pico de la fem', value: run.peak, unit: 'V', sig: 4 },
    },
    equations: [
      { title: 'Flujo de un dipolo por una vuelta', lhs: 'L1', expr: '\\frac{[N]}{41}·Σ \\frac{μ₀·[m]·[a]^{2}}{2·([a]^{2} + z^{2})^{3/2}}', note: 'Suma sobre 41 planos de vueltas a lo largo de la bobina.' },
      { title: 'Ley de Faraday integrada', lhs: 'S', expr: '−([L1] − [L0])', note: 'No depende de la rapidez v.' },
    ],
  }), [turns, m, speed, run]);

  const record = () => {
    if (phase === 'medido') {
      api.addTrial('faraday', {
        iman: MAGNETS[magnet].short, polo: pole === 'N' ? 'Norte' : 'Sur', movimiento: motion === 'introducir' ? 'Introducir' : 'Sacar',
        vueltas: turns, rapidez: speed, pico: readings.peak, picoAbs: Math.abs(readings.peak), tPico: readings.tPeak, area: readings.area,
        deltaFlujo: Number((run.minusDeltaLinkage * 1000).toFixed(4)),
      });
    } else if (phase === 'mano' && L) {
      api.addTrial('faraday', {
        iman: MAGNETS[magnet].short, polo: pole === 'N' ? 'Norte' : 'Sur', movimiento: 'Con la mano',
        vueltas: turns, rapidez: liveSpeed === null ? null : Number(liveSpeed.toFixed(2)), pico: Math.round(L.peak), picoAbs: Math.round(Math.abs(L.peak)), tPico: null,
        area: Number(L.area.toFixed(2)), deltaFlujo: Number(L.area.toFixed(4)),
      });
    }
  };

  /* ---------- escena */
  const mx = toA(xm);
  const ml = MAGNETS[magnet].length * A_S, mw = MAGNETS[magnet].width * A_S;
  const coilL = COIL.length * A_S, coilR = COIL.radius * A_S;
  const cx0 = A_CX - coilL / 2, cx1 = A_CX + coilL / 2;
  const nDrawn = Math.round(6 + Math.sqrt(turns) * 1.1);
  const windings = Array.from({ length: nDrawn }, (_, i) => cx0 + 3 + ((i + 0.5) * (coilL - 6)) / nDrawn);
  const simT = phase === 'midiendo' || phase === 'medido' ? elapsed / 1000 / slow : null;
  const desc = `Imán de ${MAGNETS[magnet].short.toLowerCase()} con el polo ${pole === 'N' ? 'norte' : 'sur'} hacia una bobina de ${turns} vueltas, ` +
    `a ${fmt(Math.abs(xm) * 100, 1)} cm de su centro. La aguja del galvanómetro marca ${sfmt(needle, 0)} mV.`;

  const showPeak = measured ? `${sfmt(readings.peak, 0)} mV` : phase === 'mano' && L ? `${sfmt(L.peak, 0)} mV` : '—';
  const showArea = measured ? `${sfmt(readings.area, 2)} mV·s` : phase === 'mano' && L ? `${sfmt(L.area, 2)} mV·s` : '—';
  const canRecord = measured || (phase === 'mano' && !!L && Math.abs(L.peak) > 0);
  const logged = phase === 'mano' && L ? { t: L.pts.map((p) => p.t), e: L.pts.map((p) => p.e) } : null;

  const conditions = `${MAGNETS[magnet].short}, polo ${pole}, ${turns} vueltas, ${fmt(speed, 2)} m/s, introducir`;
  const inRun = useMemo(() => simulateFaraday({ magnet, pole, turns, speed, motion: 'introducir', moment: magnet === 'ferrita' ? momentFerrite : undefined }),
    [magnet, pole, turns, speed, momentFerrite]);
  const channels = useMemo<LoggerChannel[]>(() => [
    { id: 'fem', name: 'fem inducida', unit: 'mV', resolution: sensor.resolution, noise: sensor.sigma ?? 2, color: 'var(--series-1)', sample: (t) => sampleSeries(inRun.t, inRun.emf, t) * 1000 },
    { id: 'x', name: 'Posición del imán', unit: 'cm', resolution: 0.1, color: 'var(--series-2)', sample: (t) => sampleSeries(inRun.t, inRun.x, t) * 100 },
  ], [inRun, sensor]);

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de la ley de Faraday">
          <ManipScene viewBox={`0 0 ${AW} ${AH}`} label="Controles de la bobina y el imán" scene={
            <svg viewBox={`0 0 ${AW} ${AH}`} role="img" aria-labelledby="ind-a-t ind-a-d">
              <title id="ind-a-t">Imán, bobina y galvanómetro (ley de Faraday)</title>
              <desc id="ind-a-d">{desc}</desc>
              <IndDefs />
              <BenchTop y={A_BENCH} width={AW} />
              {/* soportes */}
              {[130, 470].map((x) => (
                <g key={x}>
                  <ContactShadow x={x - 12} y={A_BENCH} w={24} h={5} />
                  <rect x={x - 3} y={A_AXIS + 12} width={6} height={A_BENCH - A_AXIS - 12} fill="url(#kit-metal-h)" />
                  <rect x={x - 14} y={A_BENCH - 6} width={28} height={6} rx={2} fill="url(#kit-body-dark)" />
                </g>
              ))}
              <rect x={cx0 - 4} y={A_AXIS + coilR + 8} width={coilL + 8} height={A_BENCH - A_AXIS - coilR - 8} fill="url(#kit-body)" stroke="#9aa5a9" />
              {/* tubo guía de acrílico */}
              <rect x={104} y={A_AXIS - 12} width={380} height={24} rx={4} fill="url(#kit-glass)" stroke="#9fb3bb" strokeWidth="0.8" />
              {/* regla */}
              <g>
                {Array.from({ length: 21 }, (_, i) => i).map((c) => {
                  const x = toA(-c / 100);
                  return (
                    <g key={c}>
                      <line x1={x} x2={x} y1={A_AXIS + 14} y2={A_AXIS + (c % 5 === 0 ? 24 : 19)} stroke="var(--ink-2)" strokeWidth={c % 5 === 0 ? 1 : 0.6} />
                      {c % 5 === 0 && <text x={x} y={A_AXIS + 34} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{c}</text>}
                    </g>
                  );
                })}
                <text x={toA(-0.1)} y={A_AXIS + 46} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>distancia al centro de la bobina (cm)</text>
              </g>
              {/* bobina: mitad trasera */}
              <ellipse cx={cx0} cy={A_AXIS} rx={9} ry={coilR + 10} fill="url(#kit-body-dark)" />
              <rect x={cx0} y={A_AXIS - coilR - 2} width={coilL} height={2 * coilR + 4} fill="#3b2a1e" opacity="0.35" />
              {/* imán */}
              <BarMagnet cx={mx} cy={A_AXIS} len={ml} wid={mw} north={pole === 'N' ? 'derecha' : 'izquierda'} />
              {/* bobina: vueltas delanteras (dejan ver el imán entre ellas) */}
              {windings.map((x, i) => <line key={i} x1={x} x2={x + 1.5} y1={A_AXIS - coilR - 2} y2={A_AXIS + coilR + 2} stroke="url(#ind-copper-h)" strokeWidth={Math.max(1.6, (coilL - 6) / nDrawn - 0.9)} strokeLinecap="round" />)}
              <ellipse cx={cx1} cy={A_AXIS} rx={9} ry={coilR + 10} fill="url(#kit-body-dark)" opacity="0.92" />
              <ellipse cx={cx1} cy={A_AXIS} rx={5} ry={coilR - 2} fill="#1b2326" opacity="0.65" />
              <text x={A_CX} y={A_AXIS - coilR - 18} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)' }}>N = {turns} vueltas</text>
              {/* cables al galvanómetro */}
              <path d={`M${cx0 + 2} ${A_AXIS + coilR} C${cx0} ${A_AXIS + 110} 560 ${A_BENCH - 10} 582 ${A_BENCH - 32}`} fill="none" stroke="#b71c1c" strokeWidth="2" />
              <path d={`M${cx1 - 2} ${A_AXIS + coilR} C${cx1 + 20} ${A_AXIS + 70} 700 ${A_BENCH - 4} 718 ${A_BENCH - 32}`} fill="none" stroke="#263238" strokeWidth="2" />
              <Galvanometer x={560} y={A_BENCH - 192} emf={needle} />
              {phase === 'midiendo' && <text x={110} y={40} style={{ fontSize: 11, fill: 'var(--ink-2)', fontWeight: 600 }}>Cámara lenta ×{fmt(slow, 1)} · {fmt(speed, 2)} m/s</text>}
              {Math.abs(needle) > GALV_MAX && <text x={650} y={A_BENCH - 202} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--bad)', fontWeight: 700 }}>¡Fuera de escala!</text>}
            </svg>}>
            <DragHandle label="Imán: arrastrarlo dentro o fuera de la bobina" value={Number((xm * 100).toFixed(1))} min={-20} max={0} step={0.5} pageStep={5} unit="cm" decimals={1}
              disabled={phase === 'midiendo'} hit={{ x: mx - ml / 2, y: A_AXIS - 20, w: ml, h: 40 }}
              valueText={(v) => `${fmt(Math.abs(v), 1)} cm del centro de la bobina`}
              valueFromPoint={({ point, start, startValue }) => startValue + ((point.x - start.x) / A_S) * 100}
              onChange={dragMagnet} />
          </ManipScene>
        </div>
        <ManipHint>Pulsa los botones para mover el imán a velocidad constante, o arrástralo con la mano (también con las flechas del teclado cuando está enfocado) y mira la aguja del galvanómetro.</ManipHint>
        <EmfTrace t={logged ? logged.t : run.t} e={logged ? logged.e : phase === 'listo' ? [] : emfMv}
          tMax={logged ? (logged.t[logged.t.length - 1] ?? 0) : run.duration} cursor={simT} live={!!logged}
          title={logged ? 'Registro de la fem mientras mueves el imán con la mano' : 'Registro de la fem inducida en la corrida a velocidad constante'} />
        <div className="grid-2">
          <div className="stack">
            <h3>Sensor de voltaje y registrador</h3>
            <Readout items={[
              { k: 'Pico de la fem', v: showPeak, data: true },
              { k: 'Instante del pico', v: measured ? `${fmt(readings.tPeak, 4)} s` : '—' },
              { k: 'Área bajo la curva ∫ε dt', v: showArea, data: true },
              { k: 'Aguja del galvanómetro', v: measured || phase === 'mano' ? ((measured ? readings.peak : L?.peak ?? 0) < 0 ? 'se desvió a la izquierda (−)' : 'se desvió a la derecha (+)') : '—' },
            ]} />
          </div>
          <div className="stack">
            <h3>Flujo enlazado N·Φ (modelo)</h3>
            <Readout items={[
              { k: 'Al comenzar', v: measured ? `${sfmt(lInit, 3)} mWb` : '—' },
              { k: 'Al terminar', v: measured ? `${sfmt(lEnd, 3)} mWb` : '—' },
              { k: '−N·ΔΦ', v: measured ? `${sfmt(run.minusDeltaLinkage * 1000, 2)} mWb` : '—' },
              { k: 'Rapidez media (a mano)', v: phase === 'mano' && liveSpeed !== null ? `${fmt(liveSpeed, 2)} m/s` : '—' },
            ]} />
            <p className="small muted">1 mV·s = 1 mWb: el área bajo la curva es el cambio de flujo enlazado con signo contrario.</p>
          </div>
        </div>
        <SensorCard intro={`Registrador de datos con el sensor de voltaje en la bobina: corrida de ${conditions}. Toma hasta 2 000 muestras por segundo; compara la forma de la curva con la posición del imán.`}>
          <DataLogger title="Interfaz de sensores · inducción" channels={channels} duration={Number(inRun.duration.toFixed(3))} speed={0.25} rates={[500, 1000, 2000]} defaultRate={1000}
            resetKey={conditions} runLabel={conditions} onUseRun={setSensorRun} />
          {sensorRun && (
            <div className="stack-sm">
              <h3>Corrida en uso</h3>
              <p className="small muted" style={{ margin: 0 }}>{sensorRun.label} · {sensorRun.samples.length} muestras a {fmt(sensorRun.rate, 0)} muestras/s.</p>
              <LoggerRunCharts run={sensorRun} />
            </div>
          )}
        </SensorCard>
      </div>
      <div className="controls">
        <div className="card stack">
          {top}
          <Segmented<MagnetId> label="Material del imán" value={magnet} onChange={(v) => { setMagnet(v); playSound('clack', { intensity: 0.4 }); }}
            options={[{ value: 'ferrita', label: 'Ferrita' }, { value: 'neodimio', label: 'Neodimio' }]} />
          <Segmented<Pole> label="Polo que mira a la bobina" value={pole} onChange={(v) => { setPole(v); playSound('clack', { intensity: 0.4 }); }}
            options={[{ value: 'N', label: 'Norte (N)' }, { value: 'S', label: 'Sur (S)' }]} />
          <Segmented<string> label="Vueltas de la bobina" value={String(turns)} onChange={(v) => setTurns(Number(v))}
            options={TURN_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))} />
          <Slider label="Rapidez del imán" value={speed} min={IND_LIMITS.speed[0]} max={IND_LIMITS.speed[1]} step={0.05} unit="m/s" decimals={2} onChange={setSpeed}
            hint="El imán recorre 20 cm a velocidad constante." />
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={phase === 'midiendo'} onClick={() => startRun('introducir')}>Introducir el imán a velocidad constante</button>
            <button type="button" className="btn" disabled={phase === 'midiendo'} onClick={() => startRun('sacar')}>Sacar el imán a velocidad constante</button>
            <button type="button" className="btn" onClick={() => { reset(); setXm(FARADAY_PATH.outside); }}>Reiniciar medición</button>
          </div>
          <RecordButton onRecord={record} disabled={!canRecord} />
          {!canRecord && <p className="small muted">Mueve el imán (con los botones o con la mano) para poder guardar el ensayo.</p>}
        </div>
        <Notice>Supuestos: imán como dipolo puntual que se mueve por el eje de la bobina; la bobina está conectada a un medidor de alta resistencia, así que casi no circula corriente y la fuerza de Lenz sobre el imán es despreciable.</Notice>
      </div>
    </div>
  );
}

/* ================================================================== 3. GENERADOR DE CA */

const GW = 760, GH = 400, G_BENCH = 372;
const GEN_TURN_OPTIONS = [50, 100, 200];
const GEN_SLOW = 20; // cámara lenta del dibujo

function GeneratorActivity({ api, measure, remeasure, top }: { api: Api; measure: MeasureFn; remeasure: (...k: string[]) => void; top: ReactNode }) {
  const [turns, setTurns] = useState(100);
  const [field, setField] = useState(0.2);
  const [rpm, setRpm] = useState(600);
  const [theta, setTheta] = useState(Math.PI / 3);
  const [snap, setSnap] = useState<{ turns: number; field: number; rpm: number } | null>(null);
  const raf = useRef(0);
  const revs = useRef(0);
  const thetaRef = useRef(Math.PI / 3);
  const g = useMemo(() => simulateGenerator({ turns, field, rpm }), [turns, field, rpm]);
  const reduced = useMemo(reducedMotion, []);

  useEffect(() => { setSnap(null); }, [turns, field, rpm]);
  useEffect(() => {
    if (rpm <= 0 || reduced) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const nt = thetaRef.current + (g.omega / GEN_SLOW) * dt;
      thetaRef.current = nt;
      const r = Math.floor(nt / (2 * Math.PI));
      if (r !== revs.current) { revs.current = r; playSound('tick', { intensity: 0.3, freq: 900 }); }
      setTheta(nt);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [rpm, g.omega, reduced]);
  useSoundLoop('hum', rpm > 0, Math.min(0.6, 0.12 + 0.4 * (rpm / IND_LIMITS.rpm[1])));

  const mult = instrumentSpec('multimetro');
  const shown = snap ? simulateGenerator(snap) : null;
  const readings = useMemo(() => shown && ({
    peak: measure(shown.peak, { ...mult, key: 'gPico' }),
    rms: measure(shown.rms, { ...mult, key: 'gEf' }),
    f: measure(shown.frequency, { resolution: 0.01, sigma: 0.02, key: 'gF' }),
  }), [shown?.peak, shown?.rms, shown?.frequency, measure, mult]); // eslint-disable-line react-hooks/exhaustive-deps

  usePublishModel(() => ({
    vars: {
      N: { sym: 'N', name: 'Vueltas', value: turns, decimals: 0 },
      B: { sym: 'B', name: 'Campo', value: field, unit: 'T', decimals: 2 },
      A: { sym: 'A', name: 'Área de la bobina', value: GENERATOR.area, unit: 'm²', sig: 3 },
      n: { sym: 'n', name: 'Rapidez de giro', value: rpm, unit: 'rpm', decimals: 0 },
      w: { sym: 'ω', name: 'Rapidez angular', value: g.omega, unit: 'rad/s', decimals: 2 },
      e0: { sym: 'ε_{0}', name: 'fem pico', value: g.peak, unit: 'V', decimals: 3 },
      f: { sym: 'f', name: 'Frecuencia', value: g.frequency, unit: 'Hz', decimals: 2 },
    },
    equations: [
      { title: 'Rapidez angular', lhs: 'w', expr: '\\frac{2π·[n]}{60}' },
      { title: 'fem pico', lhs: 'e0', expr: '[N]·[B]·[A]·[w]' },
      { title: 'Frecuencia', lhs: 'f', expr: '\\frac{[n]}{60}', note: 'Generador de dos polos: 60 Hz a 3 600 rpm.' },
    ],
  }), [turns, field, rpm, g]);

  const measureNow = () => { remeasure('gPico', 'gEf', 'gF'); setSnap({ turns, field, rpm }); playSound('beep'); };
  const record = () => {
    if (!snap || !readings || !shown) return;
    api.addTrial('generador', {
      vueltas: snap.turns, campo: snap.field, rpm: snap.rpm, frecuencia: readings.f, omega: Number(shown.omega.toFixed(3)),
      femPico: readings.peak, femEficaz: readings.rms, potenciaLampara: Number(shown.lampPower.toFixed(4)),
    });
  };

  /* ---------- escena */
  const AXX = 230, top0 = 108, bot0 = 236, halfW = 66;
  const c = Math.cos(theta), s = Math.sin(theta);
  // θ = 0: plano de la bobina perpendicular a B (de canto para quien mira): flujo máximo y fem nula.
  const hw = halfW * s;
  const front = c >= 0;
  const emfNow = g.peak * Math.sin(theta);
  const scope = { x: 500, y: 30, w: 240, h: 180 };
  const vdivs = [0.1, 0.2, 0.5, 1, 2, 5, 10];
  const vdiv = vdivs.find((d) => d * 4 >= g.peak * 1.05) ?? 10;
  const tdiv = 0.02; // 20 ms por división, 10 divisiones
  const scopePath = useMemo(() => {
    let d = '';
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * tdiv * 10;
      const y = scope.y + scope.h / 2 - (generatorEmfAt(g, t) / (vdiv * 4)) * (scope.h / 2);
      d += `${i ? 'L' : 'M'}${(scope.x + (i / 300) * scope.w).toFixed(1)} ${clampN(y, scope.y, scope.y + scope.h).toFixed(1)}`;
    }
    return d;
  }, [g, vdiv]); // eslint-disable-line react-hooks/exhaustive-deps
  const phaseT = g.omega > 0 ? ((theta % (2 * Math.PI)) / g.omega) % (tdiv * 10) : 0;
  const dotX = scope.x + (phaseT / (tdiv * 10)) * scope.w;
  const dotY = scope.y + scope.h / 2 - clampN(emfNow / (vdiv * 4), -1, 1) * (scope.h / 2);
  const lampGlow = g.brightness;
  const desc = `Bobina de ${turns} vueltas que gira a ${fmt(rpm, 0)} rpm entre los polos de un imán de ${fmt(field, 2)} T. El osciloscopio muestra una onda sinusoidal con ${fmt(vdiv, 1)} V por división y 20 ms por división; el bombillo ${lampGlow > 0.05 ? 'está encendido' : 'está apagado'}.`;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco del generador de corriente alterna">
          <ManipScene viewBox={`0 0 ${GW} ${GH}`} label="Controles del generador" scene={
            <svg viewBox={`0 0 ${GW} ${GH}`} role="img" aria-labelledby="ind-g-t ind-g-d">
              <title id="ind-g-t">Generador de corriente alterna con bombillo y osciloscopio</title>
              <desc id="ind-g-d">{desc}</desc>
              <IndDefs />
              <BenchTop y={G_BENCH} width={GW} />
              {/* yugo e imanes */}
              <g filter="url(#kit-shadow)">
                <path d={`M70 ${G_BENCH} V60 H390 V${G_BENCH} H362 V88 H98 V${G_BENCH} Z`} fill="url(#ind-iron)" />
              </g>
              <path d={`M98 112 H150 Q132 172 150 232 H98 Z`} fill="url(#ind-red)" />
              <path d={`M362 112 H310 Q328 172 310 232 H362 Z`} fill="url(#ind-blue)" />
              <text x={116} y={178} style={{ fontSize: 18, fontWeight: 800, fill: '#fff' }}>N</text>
              <text x={330} y={178} style={{ fontSize: 18, fontWeight: 800, fill: '#fff' }}>S</text>
              {[132, 152, 172, 192, 212].map((y) => <g key={y}><line x1={152} x2={306} y1={y} y2={y} stroke="var(--fis)" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.6" /><ArrowHead x={300} y={y} deg={0} color="var(--fis)" s={4} /></g>)}
              <text x={AXX} y={100} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 600 }}>B = {fmt(field, 2)} T</text>
              {/* eje y bobina giratoria */}
              <line x1={AXX} x2={AXX} y1={top0 - 14} y2={300} stroke="url(#kit-metal-h)" strokeWidth="5" />
              <path d={`M${AXX - hw} ${top0} L${AXX + hw} ${top0} L${AXX + hw} ${bot0} L${AXX - hw} ${bot0} Z`} fill={front ? 'rgba(201,122,58,0.18)' : 'rgba(122,63,20,0.12)'}
                stroke="url(#ind-copper)" strokeWidth={Math.max(3, 2 + turns / 30)} strokeLinejoin="round" />
              <text x={AXX} y={bot0 + 18} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>{turns} vueltas · 5 cm × 4 cm</text>
              {/* anillos rozantes y escobillas */}
              <rect x={AXX - 13} y={286} width={26} height={8} rx={3} fill="url(#ind-copper)" />
              <rect x={AXX - 13} y={300} width={26} height={8} rx={3} fill="url(#ind-copper)" />
              <rect x={AXX + 13} y={286} width={14} height={7} fill="#37474f" /><rect x={AXX + 13} y={301} width={14} height={7} fill="#37474f" />
              <path d={`M${AXX + 27} 289 C380 289 400 320 428 318`} fill="none" stroke="#b71c1c" strokeWidth="1.8" />
              <path d={`M${AXX + 27} 304 C380 304 420 340 452 318`} fill="none" stroke="#263238" strokeWidth="1.8" />
              <path d={`M432 322 C470 330 520 320 540 ${scope.y + scope.h + 48}`} fill="none" stroke="#b71c1c" strokeWidth="1.2" opacity="0.8" />
              <path d={`M448 322 C490 336 560 330 580 ${scope.y + scope.h + 48}`} fill="none" stroke="#263238" strokeWidth="1.2" opacity="0.8" />
              {/* manivela con multiplicador */}
              <circle cx={AXX} cy={334} r={22} fill="url(#kit-metal)" stroke="#5d6b70" />
              {/* bombillo */}
              <Bulb x={440} y={290} glow={lampGlow} caption="bombillo de 2,5 V" />
              {/* osciloscopio */}
              <g>
                <rect x={scope.x - 12} y={scope.y - 12} width={scope.w + 24} height={scope.h + 60} rx={10} fill="url(#kit-body-dark)" filter="url(#kit-shadow)" />
                <rect x={scope.x} y={scope.y} width={scope.w} height={scope.h} rx={3} fill="#0b1f1a" />
                {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={scope.x + (i * scope.w) / 10} x2={scope.x + (i * scope.w) / 10} y1={scope.y} y2={scope.y + scope.h} stroke="#2e5b4d" strokeWidth={i === 5 ? 0.9 : 0.5} />)}
                {Array.from({ length: 9 }, (_, i) => <line key={`h${i}`} x1={scope.x} x2={scope.x + scope.w} y1={scope.y + (i * scope.h) / 8} y2={scope.y + (i * scope.h) / 8} stroke="#2e5b4d" strokeWidth={i === 4 ? 0.9 : 0.5} />)}
                {rpm > 0 && <path d={scopePath} fill="none" stroke="#7CFFB2" strokeWidth="1.8" />}
                {rpm === 0 && <line x1={scope.x} x2={scope.x + scope.w} y1={scope.y + scope.h / 2} y2={scope.y + scope.h / 2} stroke="#7CFFB2" strokeWidth="1.8" />}
                {rpm > 0 && !reduced && <circle cx={dotX} cy={dotY} r={3.5} fill="#e8fff2" />}
                <text x={scope.x} y={scope.y + scope.h + 20} style={{ fontSize: 10, fill: '#c9d2d5', fontFamily: 'var(--font-data)' }}>{fmt(vdiv, 1)} V/div</text>
                <text x={scope.x + scope.w} y={scope.y + scope.h + 20} textAnchor="end" style={{ fontSize: 10, fill: '#c9d2d5', fontFamily: 'var(--font-data)' }}>20 ms/div</text>
                <text x={scope.x + scope.w / 2} y={scope.y + scope.h + 38} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: '#d6dee0', letterSpacing: 0.6 }}>OSCILOSCOPIO</text>
              </g>
              <text x={20} y={30} style={{ fontSize: 11, fill: 'var(--ink-2)', fontWeight: 600 }}>{rpm > 0 ? `Giro en cámara lenta ×1/${GEN_SLOW}` : 'La bobina está quieta'}</text>
            </svg>}>
            <Knob cx={AXX} cy={334} r={18} label="Manivela: rapidez de giro del generador" value={rpm} min={IND_LIMITS.rpm[0]} max={IND_LIMITS.rpm[1]} step={30} pageStep={300}
              unit="rpm" decimals={0} onChange={(v) => { setRpm(v); playSound('knob'); }} />
          </ManipScene>
        </div>
        <ManipHint>Gira la perilla de la manivela (arrastra alrededor de ella, usa la rueda del ratón o las flechas del teclado) para cambiar la rapidez de giro.</ManipHint>
        <div className="grid-2">
          <div className="stack">
            <h3>Osciloscopio y multímetro</h3>
            <Readout items={[
              { k: 'fem pico ε₀', v: readings ? `${fmt(readings.peak, 2)} V` : '—', data: true },
              { k: 'fem eficaz ε_ef', v: readings ? `${fmt(readings.rms, 2)} V` : '—', data: true },
              { k: 'Frecuencia f', v: readings ? `${fmt(readings.f, 2)} Hz` : '—', data: true },
              { k: 'Período T', v: readings && shown && shown.frequency > 0 ? `${fmt(1000 / shown.frequency, 1)} ms` : '—' },
            ]} />
          </div>
          <div className="stack">
            <h3>Bombillo (2,5 V; 0,3 A)</h3>
            <Readout items={[
              { k: 'Potencia en el bombillo', v: shown ? `${fmt(shown.lampPower, 2)} W` : '—' },
              { k: 'Brillo respecto al nominal', v: shown ? `${fmt(shown.brightness * 100, 0)} %` : '—' },
              { k: 'rpm para 60 Hz (2 polos)', v: `${fmt(synchronousRpm(60, 2), 0)} rpm` },
            ]} />
            {shown && shown.rms > LAMP.ratedV * 1.4 && <Notice kind="warn">Con más de {fmt(LAMP.ratedV * 1.4, 1)} V eficaces el bombillo de 2,5 V se fundiría pronto.</Notice>}
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          {top}
          <Slider label="Rapidez de giro" value={rpm} min={IND_LIMITS.rpm[0]} max={IND_LIMITS.rpm[1]} step={30} unit="rpm" decimals={0} onChange={setRpm} />
          <Segmented<string> label="Vueltas de la bobina del generador" value={String(turns)} onChange={(v) => setTurns(Number(v))}
            options={GEN_TURN_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))} />
          <Slider label="Campo de los imanes" value={field} min={IND_LIMITS.genField[0]} max={IND_LIMITS.genField[1]} step={0.05} unit="T" decimals={2} onChange={setField} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={measureNow}>Medir con el osciloscopio y el multímetro</button>
          </div>
          <RecordButton onRecord={record} disabled={!snap} />
          {!snap && <p className="small muted">Mide para poder guardar el ensayo.</p>}
        </div>
        <Notice>Supuestos: campo uniforme, sin resistencia de la bobina ni reacción del inducido; generador de dos polos (f = rpm/60). El dibujo gira en cámara lenta.</Notice>
      </div>
    </div>
  );
}

/* ================================================================== 4. TRANSFORMADOR */

const TW = 760, TH = 360, T_BENCH = 334;
const LOAD = { R: 12, ratedV: 6, ratedI: 0.5 };

function TransformerActivity({ api, measure, remeasure, top }: { api: Api; measure: MeasureFn; remeasure: (...k: string[]) => void; top: ReactNode }) {
  const [source, setSource] = useState<Source>('ca');
  const [n1, setN1] = useState(400);
  const [n2, setN2] = useState(20);
  const [snap, setSnap] = useState<{ source: Source; n1: number; n2: number } | null>(null);
  const v1 = source === 'ca' ? 120 : 12;
  const tr = useMemo(() => simulateTransformer({ n1, n2, v1, source, load: LOAD.R }), [n1, n2, v1, source]);
  useEffect(() => { setSnap(null); }, [n1, n2, source]);
  useSoundLoop('hum', source === 'ca', 0.12);

  const mult = instrumentSpec('multimetro');
  const shown = snap ? simulateTransformer({ ...snap, v1: snap.source === 'ca' ? 120 : 12, load: LOAD.R }) : null;
  const sv1 = snap ? (snap.source === 'ca' ? 120 : 12) : 0;
  const readings = useMemo(() => shown && ({
    v1: measure(sv1, { ...mult, key: 'v1' }),
    v2: Math.max(0, measure(shown.v2, { ...mult, key: 'v2' })),
    i2: Math.max(0, measure(shown.i2, { resolution: 0.001, sigma: 0.001, relSigma: 0.01, key: 'i2' })),
    i1: Math.max(0, measure(shown.i1, { resolution: 0.001, sigma: 0.001, relSigma: 0.01, key: 'i1' })),
  }), [shown?.v2, shown?.i2, shown?.i1, sv1, measure, mult]); // eslint-disable-line react-hooks/exhaustive-deps

  usePublishModel(() => ({
    vars: {
      N1: { sym: 'N_{1}', name: 'Vueltas del primario', value: n1, decimals: 0 },
      N2: { sym: 'N_{2}', name: 'Vueltas del secundario', value: n2, decimals: 0 },
      V1: { sym: 'V_{1}', name: 'Voltaje del primario', value: v1, unit: 'V', decimals: 1 },
      V2: { sym: 'V_{2}', name: 'Voltaje del secundario', value: tr.v2, unit: 'V', decimals: 2 },
      I2: { sym: 'I_{2}', name: 'Corriente del secundario', value: tr.i2, unit: 'A', decimals: 3 },
      I1: { sym: 'I_{1}', name: 'Corriente del primario', value: tr.i1, unit: 'A', decimals: 4 },
    },
    equations: [
      { title: 'Transformador ideal', lhs: 'V2', expr: '[V1]·\\frac{[N2]}{[N1]}', note: source === 'cc' ? 'Con corriente continua el flujo no cambia: V₂ = 0.' : undefined },
      { title: 'Conservación de la potencia', lhs: 'I1', expr: '[I2]·\\frac{[N2]}{[N1]}' },
    ],
  }), [n1, n2, v1, tr, source]);

  const measureNow = () => { remeasure('v1', 'v2', 'i1', 'i2'); setSnap({ source, n1, n2 }); playSound('beep'); };
  const record = () => {
    if (!snap || !shown || !readings) return;
    api.addTrial('transformador', {
      fuente: snap.source === 'ca' ? 'CA 120 V, 60 Hz' : 'CC 12 V', N1: snap.n1, N2: snap.n2, relacion: Number((snap.n2 / snap.n1).toFixed(4)),
      V1: readings.v1, V2: readings.v2, I2: readings.i2, I1: readings.i1, P2: Number(shown.p2.toFixed(4)),
    });
  };

  const glow = tr.p2 / (LOAD.ratedV * LOAD.ratedI);
  const broken = tr.v2 > LOAD.ratedV * 1.6;
  const coilBand = (x: number, n: number, label: string) => {
    const k = Math.round(5 + Math.log2(n) * 2.2);
    return (
      <g>
        {Array.from({ length: k }, (_, i) => {
          const y = 104 + ((i + 0.5) * 152) / k;
          return <line key={i} x1={x - 8} x2={x + 48} y1={y} y2={y + 3} stroke="url(#ind-copper)" strokeWidth={Math.max(1.5, 150 / k - 1)} strokeLinecap="round" />;
        })}
        <text x={x + 20} y={322} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#3b2a12' }}>{label}</text>
      </g>
    );
  };
  const desc = `Transformador con ${n1} vueltas en el primario y ${n2} en el secundario, conectado a ${source === 'ca' ? 'la red de 120 V y 60 Hz' : 'una batería de 12 V de corriente continua'}. ${snap ? `Los multímetros marcan ${fmt(readings?.v1 ?? 0, 2)} V y ${fmt(readings?.v2 ?? 0, 2)} V.` : 'Aún no se ha medido.'}`;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco del transformador">
          <svg viewBox={`0 0 ${TW} ${TH}`} role="img" aria-labelledby="ind-x-t ind-x-d">
            <title id="ind-x-t">Transformador con fuente, multímetros y bombillo</title>
            <desc id="ind-x-d">{desc}</desc>
            <IndDefs />
            <BenchTop y={T_BENCH} width={TW} />
            {/* núcleo laminado */}
            <g filter="url(#kit-shadow)">
              <path d="M260 80 H500 V300 H260 Z M300 120 V260 H460 V120 Z" fillRule="evenodd" fill="url(#ind-iron)" />
            </g>
            {Array.from({ length: 9 }, (_, i) => <line key={i} x1={260} x2={500} y1={84 + i * 4} y2={84 + i * 4} stroke="#2b3336" strokeWidth="0.4" opacity="0.5" />)}
            {source === 'ca' && (
              <g fill="none" stroke="var(--fis)" strokeWidth="1.4" strokeDasharray="5 4" opacity="0.85">
                <path d="M280 110 V100 H480 V280 H280 Z" />
                <text x={380} y={74} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--fis)', fontWeight: 700 }} stroke="none">flujo Φ alterno en el núcleo</text>
              </g>
            )}
            <rect x={236} y={300} width={288} height={T_BENCH - 300} rx={3} fill="url(#kit-wood)" stroke="#9c7a45" />
            {coilBand(252, n1, `N₁ = ${n1}`)}
            {coilBand(452, n2, `N₂ = ${n2}`)}
            {/* fuente */}
            {source === 'ca' ? (
              <g>
                <rect x={40} y={120} width={86} height={120} rx={10} fill="url(#kit-body)" stroke="#9aa5a9" filter="url(#kit-shadow)" />
                <rect x={60} y={150} width={46} height={60} rx={8} fill="#eef1f1" stroke="#9aa5a9" />
                <rect x={72} y={164} width={5} height={14} rx={1} fill="#37474f" /><rect x={89} y={164} width={5} height={14} rx={1} fill="#37474f" />
                <path d="M78 194 a5 5 0 0 1 10 0 v4 h-10 Z" fill="#37474f" />
                <text x={83} y={262} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>120 V ~ 60 Hz</text>
              </g>
            ) : (
              <g>
                <rect x={46} y={150} width={74} height={84} rx={6} fill="#263238" filter="url(#kit-shadow)" />
                <rect x={56} y={140} width={14} height={10} fill="#b71c1c" /><rect x={96} y={140} width={14} height={10} fill="#90a4ae" />
                <text x={83} y={198} textAnchor="middle" style={{ fontSize: 14, fill: '#fff', fontWeight: 800 }}>12 V</text>
                <text x={83} y={262} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>batería (CC)</text>
              </g>
            )}
            <path d="M126 160 C180 160 200 110 250 110" fill="none" stroke="#b71c1c" strokeWidth="2" />
            <path d="M126 210 C180 210 200 250 250 250" fill="none" stroke="#263238" strokeWidth="2" />
            <path d="M502 110 C580 110 610 190 640 192" fill="none" stroke="#b71c1c" strokeWidth="2" />
            <path d="M502 250 C590 250 650 230 660 196" fill="none" stroke="#263238" strokeWidth="2" />
            <Bulb x={650} y={160} glow={glow} broken={broken} caption="bombillo de 6 V (12 Ω)" />
            {/* multímetros */}
            <g>
              <rect x={150} y={18} width={100} height={52} rx={8} fill="#f2b705" stroke="#8a6a00" filter="url(#kit-shadow-soft)" />
              <Lcd x={158} y={26} w={84} h={26} text={readings ? fmt(readings.v1, 2) : '- - -'} unit="V" />
              <text x={200} y={64} textAnchor="middle" style={{ fontSize: 8, fontWeight: 700, fill: '#3a2c00' }}>V₁</text>
              <rect x={540} y={18} width={100} height={52} rx={8} fill="#f2b705" stroke="#8a6a00" filter="url(#kit-shadow-soft)" />
              <Lcd x={548} y={26} w={84} h={26} text={readings ? fmt(readings.v2, 2) : '- - -'} unit="V" />
              <text x={590} y={64} textAnchor="middle" style={{ fontSize: 8, fontWeight: 700, fill: '#3a2c00' }}>V₂</text>
            </g>
          </svg>
        </div>
        <div className="grid-2">
          <div className="stack">
            <h3>Multímetros (0,01 V; 0,001 A)</h3>
            <Readout items={[
              { k: 'Voltaje del primario V₁', v: readings ? `${fmt(readings.v1, 2)} V` : '—', data: true },
              { k: 'Voltaje del secundario V₂', v: readings ? `${fmt(readings.v2, 2)} V` : '—', data: true },
              { k: 'Corriente del secundario I₂', v: readings ? `${fmt(readings.i2, 3)} A` : '—', data: true },
              { k: 'Corriente del primario I₁', v: readings ? `${fmt(readings.i1, 3)} A` : '—', data: true },
            ]} />
          </div>
          <div className="stack">
            <h3>Relación de vueltas</h3>
            <Readout items={[
              { k: 'N₂/N₁', v: fmt(n2 / n1, 3) },
              { k: 'Tipo de transformador', v: tr.kind === 'elevador' ? 'elevador' : tr.kind === 'reductor' ? 'reductor' : 'aislador (1:1)' },
              { k: 'Potencia entregada al bombillo', v: shown ? `${fmt(shown.p2, 2)} W` : '—' },
            ]} />
          </div>
        </div>
        {shown && snap?.source === 'cc' && <Notice kind="warn">Con la batería de corriente continua el flujo en el núcleo no cambia (salvo un pulso al conectar): el secundario marca 0 V y el bombillo no enciende.</Notice>}
        {shown && broken && <Notice kind="bad">El secundario entrega {fmt(tr.v2, 1)} V: el bombillo de 6 V se fundió. Usa menos vueltas en el secundario o más en el primario.</Notice>}
        <Notice>Transformador ideal: V₁·I₁ = V₂·I₂. Los transformadores reales tienen eficiencias del 95 % al 99 %: una parte se pierde como calor en los alambres (efecto Joule) y en el núcleo (histéresis y corrientes de Foucault). Las centrales como Urrá (Córdoba) o Hidroituango (Antioquia) elevan el voltaje a cientos de kilovoltios para transmitir con poca corriente y pocas pérdidas.</Notice>
      </div>
      <div className="controls">
        <div className="card stack">
          {top}
          <Segmented<Source> label="Fuente del primario" value={source} onChange={(v) => { setSource(v); playSound('switch'); }}
            options={[{ value: 'ca', label: 'Red 120 V CA' }, { value: 'cc', label: 'Batería 12 V CC' }]} />
          <Slider label="Vueltas del primario N₁" value={n1} min={IND_LIMITS.n1[0]} max={IND_LIMITS.n1[1]} step={10} decimals={0} onChange={setN1} />
          <Slider label="Vueltas del secundario N₂" value={n2} min={IND_LIMITS.n2[0]} max={IND_LIMITS.n2[1]} step={10} decimals={0} onChange={setN2}
            hint="La carga es un bombillo de 6 V y 0,5 A (12 Ω)." />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={measureNow}>Medir con los multímetros</button>
          </div>
          <RecordButton onRecord={record} disabled={!snap} />
          {!snap && <p className="small muted">Mide para poder guardar el ensayo.</p>}
        </div>
        <Notice kind="warn">En un laboratorio real, el primario conectado a 120 V solo se manipula con el montaje cerrado y bajo la supervisión del docente.</Notice>
      </div>
    </div>
  );
}

/* ================================================================== laboratorio */

export default function InductionLab({ api }: LabProps) {
  const [activity, setActivity] = useState<Activity>('campo');
  const { measure, remeasure } = useMeasure();
  const top = (
    <>
      <h3>Montaje</h3>
      <Segmented<Activity> label="Actividad del laboratorio" value={activity} onChange={setActivity}
        options={[
          { value: 'campo', label: 'Campo magnético' },
          { value: 'faraday', label: 'Ley de Faraday' },
          { value: 'generador', label: 'Generador' },
          { value: 'transformador', label: 'Transformador' },
        ]} />
    </>
  );
  if (activity === 'campo') return <FieldActivity api={api} measure={measure} top={top} />;
  if (activity === 'faraday') return <FaradayActivity api={api} measure={measure} remeasure={remeasure} top={top} />;
  if (activity === 'generador') return <GeneratorActivity api={api} measure={measure} remeasure={remeasure} top={top} />;
  return <TransformerActivity api={api} measure={measure} remeasure={remeasure} top={top} />;
}

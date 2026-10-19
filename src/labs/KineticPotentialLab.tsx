import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CART, FLAG_WIDTH, GATE_DISTANCE, GRAVITY_PRESETS, KP_INSTRUMENTS, KP_LIMITS, PLACE_LABEL, SPRINGS, cartMass, cartStateAt, dropStateAt,
  simulateCart, simulateDrop, simulateSpring, significantDigits, springStateAt,
  type GravityPreset, type KpInstrumentId, type KpInstrumentSpec,
} from '../models/kineticPotential';
import { fmt, fmtSig } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { useMeasure } from '../components/Measurement';
import { useAdvanced, usePublishModel } from '../components/Advanced';
import type { ModelState } from '../lib/advanced';
import { Chart, type Series } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { Trial } from '../core/types';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, ContactShadow, DigitalBalance, Lcd } from './kit';
import { DragHandle, Knob, ManipHint, ManipScene, Plunger, verticalDragValue } from './manipulate';

const PID = 'cinetica-potencial';

/** Ficha del instrumento: la de src/labs/instruments.ts si ya está integrada; si no, la del modelo (respaldo local). */
function instrumentSpec(id: KpInstrumentId): KpInstrumentSpec {
  return INSTRUMENTS[PID]?.find((i) => i.id === id) ?? KP_INSTRUMENTS[id];
}

type Station = 'cinetica' | 'gravitatoria' | 'elastica';
type Phase = 'listo' | 'subiendo' | 'arriba' | 'corriendo' | 'medido';

/* ------------------------------------------------------------------ geometría del riel (estaciones 1 y 3) */

const W = 760, H = 440;
const BENCH_Y = 410;
const RY = 334; // cara superior del riel
const RAIL_X0 = 40; // x = 0 m del riel
const PXM = 425; // píxeles por metro en el riel
const RAIL_LEN = 1.6;
const Q0 = 0.3; // posición en el riel (m) del punto de salida (q = 0)
const qx = (q: number) => RAIL_X0 + (Q0 + q) * PXM; // q: metros desde la salida
const GATE_X = qx(GATE_DISTANCE);
const CART_L = 0.16 * PXM, CART_HALF = CART_L / 2, CART_BODY = CART_L - 10;
const FLAG_PX = FLAG_WIDTH * PXM;
const GY = RY - 104; // borde superior del cabezal de la fotopuerta
const SPRING_NAT = 0.15 * PXM; // largo natural del resorte (px)

/* ------------------------------------------------------------------ geometría de la torre (estación 2) */

const YG = 362; // haz de la fotopuerta: nivel de referencia (Ep = 0)
const YT = 128; // parte alta de la vista (deja lugar arriba para el sensor, el electroimán y la polea)
const MAST_X = 236;
const DROP_X = 296; // eje de caída
const PULLEY_Y = 34;
const TIERS = [1, 2.5, 5, 10.5];
const viewFor = (h: number) => TIERS.find((t) => t >= h + 0.2) ?? 10.5;
const pxmFor = (h: number) => (YG - YT) / viewFor(h);

const COLORS = { ec: 'var(--series-1)', epg: 'var(--series-2)', epe: 'var(--series-4)', heat: 'var(--series-7)', total: 'var(--series-8)' };

const r = (v: number, d: number) => Number(v.toFixed(d));
const J = (v: number, sig = 3) => `${fmtSig(v, sig)} J`;

/* ------------------------------------------------------------------ piezas del dibujo */

function Defs() {
  return (
    <defs>
      <pattern id="ecp-holes" width="12" height="6" patternUnits="userSpaceOnUse">
        <rect width="12" height="6" fill="#dfe6e8" />
        <circle cx="6" cy="3" r="1.1" fill="#56656b" />
      </pattern>
      <linearGradient id="ecp-beam" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#eef2f3" /><stop offset="0.35" stopColor="#c3cdd1" /><stop offset="0.7" stopColor="#aab5ba" /><stop offset="1" stopColor="#d9e0e2" />
      </linearGradient>
      <linearGradient id="ecp-brass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#9c7417" /><stop offset="0.3" stopColor="#f1d27a" /><stop offset="0.6" stopColor="#c99a2e" /><stop offset="1" stopColor="#8a6512" />
      </linearGradient>
      <linearGradient id="ecp-steel" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#6d7b80" /><stop offset="0.3" stopColor="#e3e9eb" /><stop offset="0.55" stopColor="#aab5ba" /><stop offset="1" stopColor="#5d6b70" />
      </linearGradient>
      <radialGradient id="ecp-led" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff8a80" stopOpacity="0.9" /><stop offset="1" stopColor="#ff5252" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ecp-sand" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#e8cf98" /><stop offset="1" stopColor="#c9a868" />
      </linearGradient>
      <pattern id="ecp-sand-grain" width="7" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="0.6" fill="#a88a4e" /><circle cx="5" cy="3.5" r="0.5" fill="#f5e3b8" />
      </pattern>
    </defs>
  );
}

/** Riel de aire con orificios, escala, soplador y tope final. */
function AirTrack({ blowing }: { blowing: boolean }) {
  const x1 = RAIL_X0 + RAIL_LEN * PXM;
  return (
    <g>
      {[RAIL_X0 + 0.12 * PXM, x1 - 0.12 * PXM].map((lx) => (
        <g key={lx} filter="url(#kit-shadow-soft)">
          <path d={`M${lx - 8} ${RY + 26} L${lx + 8} ${RY + 26} L${lx + 16} ${BENCH_Y - 4} L${lx - 16} ${BENCH_Y - 4} Z`} fill="url(#kit-body-dark)" />
          <rect x={lx - 11} y={BENCH_Y - 3} width={22} height={3} rx={1.5} fill="#263033" />
        </g>
      ))}
      <g filter="url(#kit-shadow)">
        <rect x={RAIL_X0} y={RY} width={x1 - RAIL_X0} height={26} rx={2} fill="url(#ecp-beam)" stroke="#8c979b" />
      </g>
      <rect x={RAIL_X0} y={RY} width={x1 - RAIL_X0} height={6} fill="url(#ecp-holes)" stroke="#8c979b" strokeWidth="0.5" />
      {Array.from({ length: 33 }, (_, i) => {
        const tx = RAIL_X0 + i * 0.05 * PXM;
        return <line key={i} x1={tx} x2={tx} y1={RY + 19} y2={RY + (i % 2 === 0 ? 26 : 23)} stroke="#37474f" strokeWidth={i % 2 === 0 ? 1 : 0.6} />;
      })}
      <rect x={x1} y={RY - 8} width={10} height={38} rx={2} fill="url(#kit-body-dark)" />
      <path d={`M${x1 - 1} ${RY - 6} q-6 10 0 20`} fill="none" stroke="#c62828" strokeWidth="2" />
      {/* soplador bajo el riel */}
      <g filter="url(#kit-shadow)">
        <rect x={470} y={RY + 32} width={96} height={36} rx={6} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <circle cx={490} cy={RY + 50} r={11} fill="#263033" />
      {[0, 60, 120].map((a) => <path key={a} d={`M490 ${RY + 50} l0 -9 a9 9 0 0 1 7 4 Z`} fill="#7d8a8f" transform={`rotate(${a + (blowing ? 25 : 0)} 490 ${RY + 50})`} />)}
      <text x={534} y={RY + 48} textAnchor="middle" style={{ fontSize: 9, fill: '#3a4644', fontWeight: 700 }}>SOPLADOR</text>
      <circle cx={522} cy={RY + 58} r={2.4} fill={blowing ? '#66bb6a' : '#9aa5a9'} />
      <path d={`M470 ${RY + 44} C 440 ${RY + 44}, 430 ${RY + 30}, 420 ${RY + 27}`} fill="none" stroke="#3b4648" strokeWidth="8" strokeLinecap="round" />
      {blowing && [0.5, 0.95, 1.4].map((xm) => <path key={xm} d={`M${RAIL_X0 + xm * PXM} ${RY - 1} q 3 -5 0 -10`} fill="none" stroke="var(--ink-2)" strokeWidth="0.8" opacity="0.35" />)}
    </g>
  );
}

/** Carrito del riel con bandera de 5,00 cm y pesas ranuradas; cx = centro de la bandera. */
function Cart({ cx, slots }: { cx: number; slots: number }) {
  const half = CART_BODY / 2, base = RY, top = base - 22;
  return (
    <g>
      <ellipse cx={cx} cy={RY - 1} rx={half + 2} ry={2.2} fill="#000" opacity="0.16" />
      <rect x={cx - 7} y={top - 18} width={2} height={18} fill="#4a5558" />
      <rect x={cx + 5} y={top - 18} width={2} height={18} fill="#4a5558" />
      <rect x={cx - FLAG_PX / 2} y={top - 44} width={FLAG_PX} height={26} rx={1.5} fill="#1f2a2d" stroke="#0e1517" strokeWidth="0.6" />
      <text x={cx} y={top - 27} textAnchor="middle" style={{ fontSize: 6.5, fill: '#cfd8dc', fontFamily: 'var(--font-data)' }}>5,00 cm</text>
      {[-1, 1].map((side) => {
        const n = Math.ceil((slots - (side === 1 ? 1 : 0)) / 2);
        const pxs = cx + side * (half - 9);
        return (
          <g key={side}>
            <rect x={pxs - 1.2} y={top - Math.max(1, n) * 4 - 4} width={2.4} height={Math.max(1, n) * 4 + 4} fill="url(#kit-metal-h)" />
            {Array.from({ length: n }, (_, i) => <rect key={i} x={pxs - 7} y={top - (i + 1) * 4} width={14} height={3.6} rx={1} fill="url(#ecp-brass)" stroke="#7a5a12" strokeWidth="0.4" />)}
          </g>
        );
      })}
      <path d={`M${cx - half} ${top} H${cx + half} L${cx + half + 3} ${base + 10} H${cx + half - 5} L${cx + half - 7} ${base} H${cx - half + 7} L${cx - half + 5} ${base + 10} H${cx - half - 3} Z`}
        fill="url(#kit-metal)" stroke="#7d8a8f" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
      <rect x={cx - half + 2} y={top + 4} width={CART_BODY - 4} height={9} rx={2} fill="var(--series-2)" />
      <text x={cx} y={top + 11.5} textAnchor="middle" style={{ fontSize: 8, fill: '#fff', fontWeight: 700 }}>{fmt(cartMass(slots) * 1000, 0)} g</text>
    </g>
  );
}

/** Fotopuerta de horquilla con LED emisor, haz y receptor. */
function PhotoGate({ x, top, bottom, blocked, label, horizontal = false }: { x: number; top: number; bottom: number; blocked: boolean; label: string; horizontal?: boolean }) {
  if (horizontal) {
    // Fotopuerta de la torre: emisor a la izquierda y receptor a la derecha del eje de caída (haz horizontal en y = top).
    const y = top, x0 = x - 30, x1 = x + 30;
    return (
      <g>
        <rect x={x0 - 18} y={y - 9} width={18} height={18} rx={3} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
        <rect x={x1} y={y - 9} width={18} height={18} rx={3} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
        <rect x={x0 - 12} y={y + 9} width={6} height={bottom - y - 9} fill="url(#kit-metal-h)" />
        <rect x={x1 + 6} y={y + 9} width={6} height={bottom - y - 9} fill="url(#kit-metal-h)" />
        <line x1={x0} x2={x1} y1={y} y2={y} stroke="#ff5252" strokeWidth="1.4" strokeDasharray="3 2" opacity={blocked ? 0.25 : 0.85} />
        {blocked ? <circle cx={x0 - 3} cy={y} r={2.4} fill="#ffd54a" /> : <><circle cx={x0 - 3} cy={y} r={6} fill="url(#ecp-led)" /><circle cx={x0 - 3} cy={y} r={2} fill="#ff5252" /></>}
        <circle cx={x1 + 9} cy={y - 5} r={1.8} fill={blocked ? '#ffd54a' : '#66bb6a'} />
        <text x={x1 + 24} y={y + 4} style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{label}</text>
      </g>
    );
  }
  return (
    <g>
      <rect x={x + 12} y={top + 12} width={5} height={bottom - top - 12} fill="url(#kit-metal-h)" />
      <rect x={x - 6} y={bottom - 6} width={26} height={7} rx={1.5} fill="url(#kit-body-dark)" />
      <line x1={x} x2={x} y1={top + 25} y2={RY - 6} stroke="#ff5252" strokeWidth="1.4" strokeDasharray="3 2" opacity={blocked ? 0.25 : 0.85} />
      <g filter="url(#kit-shadow-soft)"><rect x={x - 14} y={top} width={34} height={25} rx={3} fill="url(#kit-body-dark)" /></g>
      <rect x={x - 4} y={top + 20} width={8} height={5} rx={1} fill="#0d1416" />
      {blocked ? <circle cx={x} cy={top + 23} r={2.4} fill="#ffd54a" /> : <><circle cx={x} cy={top + 24} r={6} fill="url(#ecp-led)" /><circle cx={x} cy={top + 23} r={2} fill="#ff5252" /></>}
      <circle cx={x + 13} cy={top + 6} r={1.8} fill={blocked ? '#ffd54a' : '#66bb6a'} />
      <text x={x + 3} y={top - 6} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{label}</text>
    </g>
  );
}

/** Temporizador de la fotopuerta con pantalla. */
function GateTimer({ x, y, text, caption }: { x: number; y: number; text: string; caption: string }) {
  return (
    <g>
      <g filter="url(#kit-shadow)"><rect x={x} y={y} width={196} height={70} rx={9} fill="url(#kit-body)" stroke="#a9b4b6" /></g>
      <text x={x + 12} y={y + 16} style={{ fontSize: 9.5, fill: '#3a4644', fontWeight: 700, letterSpacing: 0.5 }}>TEMPORIZADOR · 0,01 ms</text>
      <Lcd x={x + 12} y={y + 23} w={172} h={30} text={text} unit="ms" />
      <text x={x + 98} y={y + 64} textAnchor="middle" style={{ fontSize: 8.5, fill: '#3a4644' }}>{caption}</text>
    </g>
  );
}

/** Sensor de fuerza digital (caja con pantalla y gancho). */
function ForceSensor({ x, y, text, w = 64 }: { x: number; y: number; text: string; w?: number }) {
  return (
    <g>
      <g filter="url(#kit-shadow-soft)"><rect x={x} y={y} width={w} height={34} rx={5} fill="#f1f4f5" stroke="#8c979b" /></g>
      <rect x={x} y={y} width={w} height={8} rx={4} fill="var(--series-2)" />
      <text x={x + w / 2} y={y + 6.4} textAnchor="middle" style={{ fontSize: 5.6, fill: '#fff', fontWeight: 700, letterSpacing: 0.4 }}>FUERZA</text>
      <Lcd x={x + 4} y={y + 11} w={w - 8} h={19} text={text} />
    </g>
  );
}

/** Barras de energía en tiempo real (dibujadas en la escena). */
function EnergyBars({ x, y, w, items, scale, caption }: { x: number; y: number; w: number; items: { k: string; label: string; v: number; color: string; outline?: boolean }[]; scale: number; caption: string }) {
  const X0 = x + 112, WMAX = w - 112 - 62;
  const rowH = 24;
  return (
    <g>
      <rect x={x} y={y} width={w} height={34 + items.length * rowH} rx={10} fill="var(--surface)" stroke="var(--line)" filter="url(#kit-shadow-soft)" />
      <text x={x + 12} y={y + 18} style={{ fontSize: 10.5, fill: 'var(--ink)', fontWeight: 700 }}>Energía del sistema</text>
      <text x={x + w - 12} y={y + 18} textAnchor="end" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{caption}</text>
      {items.map((it, i) => {
        const yy = y + 30 + i * rowH;
        const bw = scale > 0 ? Math.max(0, Math.min(1.02, it.v / scale)) * WMAX : 0;
        return (
          <g key={it.k}>
            <text x={x + 12} y={yy + 12} style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 600 }}>{it.label}</text>
            <rect x={X0} y={yy + 2} width={WMAX} height={13} rx={3} fill="var(--surface-2)" />
            {it.outline
              ? <rect x={X0} y={yy + 2} width={bw} height={13} rx={3} fill="none" stroke={it.color} strokeWidth="2" strokeDasharray="4 2" />
              : <rect x={X0} y={yy + 2} width={bw} height={13} rx={3} fill={it.color} />}
            <text x={X0 + WMAX + 6} y={yy + 12.5} style={{ fontSize: 9.5, fill: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{fmtSig(Math.max(0, it.v) < 1e-9 ? 0 : it.v, 3)} J</text>
          </g>
        );
      })}
    </g>
  );
}

function VelocityArrow({ x, y, v, label }: { x: number; y: number; v: number; label: string }) {
  const len = Math.min(110, v * 60);
  if (len < 4) return null;
  return (
    <g>
      <line x1={x} x2={x + len - 7} y1={y} y2={y} stroke="var(--series-1)" strokeWidth="3" />
      <path d={`M${x + len} ${y} l-8 -5 v10 Z`} fill="var(--series-1)" />
      <text x={x + len / 2} y={y - 7} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--series-1)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{label}</text>
    </g>
  );
}

/** Resorte en zigzag entre x0 y x1 (horizontal, a la altura y). */
function springPath(x0: number, x1: number, y: number, turns = 11, amp = 7) {
  let d = `M${x0} ${y}`;
  const n = turns * 2;
  for (let i = 1; i < n; i++) d += ` L${x0 + ((x1 - x0) * i) / n} ${y + (i % 2 ? -amp : amp)}`;
  return `${d} L${x1} ${y}`;
}

/* ------------------------------------------------------------------ ideas erróneas */

interface Idea { id: string; text: string; answer: 'falso'; feedback: (ctx: IdeaCtx) => string; tryLabel: string; tryIt: () => void }
interface IdeaCtx { m1: number; m2: number; h: number; g: number }

function IdeasPanel({ ideas, ctx }: { ideas: Idea[]; ctx: IdeaCtx }) {
  const [picked, setPicked] = useState<Record<string, 'cierto' | 'falso'>>({});
  return (
    <section className="card stack" aria-labelledby="ecp-ideas-h">
      <h3 id="ecp-ideas-h">Pon a prueba estas ideas</h3>
      <p className="small muted">Son ideas muy comunes sobre la energía. Decide si son ciertas o falsas, lee la retroalimentación y compruébalo en el laboratorio.</p>
      <ol className="list stack-sm" style={{ paddingLeft: '1.2em' }}>
        {ideas.map((it) => {
          const p = picked[it.id];
          const ok = p === it.answer;
          return (
            <li key={it.id} className="stack-sm">
              <span><strong>«{it.text}»</strong></span>
              <div className="btn-row" role="group" aria-label={`Tu respuesta: ${it.text}`}>
                <button type="button" className="btn small" aria-pressed={p === 'cierto'} onClick={() => { setPicked((s) => ({ ...s, [it.id]: 'cierto' })); playSound('click'); }}>Es cierto</button>
                <button type="button" className="btn small" aria-pressed={p === 'falso'} onClick={() => { setPicked((s) => ({ ...s, [it.id]: 'falso' })); playSound('click'); }}>Es falso</button>
                <button type="button" className="btn small ghost" onClick={it.tryIt}>{it.tryLabel}</button>
              </div>
              <div aria-live="polite">
                {p && (
                  <div className={`notice ${ok ? 'ok' : 'warn'}`}>
                    <strong>{ok ? 'Bien: es falsa. ' : 'Revisa: la idea es falsa. '}</strong>{it.feedback(ctx)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ utilidades de gráficas */

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const same = (a: unknown, b: number) => typeof a === 'number' && Math.abs(a - b) < 1e-9;

/** Pendiente de la recta por el origen (mínimos cuadrados). */
function slopeThroughOrigin(pts: { x: number; y: number }[]) {
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
  if (pts.length < 2 || sxx === 0) return null;
  return pts.reduce((s, p) => s + p.x * p.y, 0) / sxx;
}

function trialPoints(trials: Trial[], xKey: string, yKey: string, keep: (t: Trial) => boolean) {
  return trials.filter(keep).map((t) => ({ x: num(t.values[xKey]), y: num(t.values[yKey]) }))
    .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);
}

/* ------------------------------------------------------------------ laboratorio */

export default function KineticPotentialLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('cinetica');
  // estación 1
  const [slots1, setSlots1] = useState(3);
  const [launch, setLaunch] = useState(0.5);
  // estación 2
  const [dropMass, setDropMass] = useState(1);
  const [height, setHeight] = useState(2);
  const [place, setPlace] = useState<GravityPreset>('tierra');
  // estación 3
  const [springId, setSpringId] = useState('medio');
  const [comp, setComp] = useState(0.05); // m
  const [slots3, setSlots3] = useState(3);
  // modo avanzado
  const adv = useAdvanced();
  const [muSet, setMuSet] = useState(0.02);
  const [dragSet, setDragSet] = useState(0.005);
  const [frictionOn, setFrictionOn] = useState(false);
  const [airOn, setAirOn] = useState(false);
  const mu = adv.enabled && frictionOn ? muSet : 0;
  const drag = adv.enabled && airOn ? dragSet : 0;
  // animación
  const [phase, setPhase] = useState<Phase>('listo');
  const [t, setT] = useState(0); // s simulados (fase corriendo) o fracción de subida (fase subiendo)
  const raf = useRef(0);

  const m1 = cartMass(slots1), m3 = cartMass(slots3);
  const spring = SPRINGS.find((s) => s.id === springId)!;
  const g = GRAVITY_PRESETS[place];

  const { measure, deviation, remeasure, real } = useMeasure();
  const ins = useMemo(() => ({
    bal: instrumentSpec('balanza'), gate: instrumentSpec('fotopuerta'), tape: instrumentSpec('cinta'),
    force: instrumentSpec('fuerza'), ruler: instrumentSpec('regla'), launcher: instrumentSpec('lanzador'),
  }), []);

  // Rapidez real de salida del lanzador: en modo real varía ~1 % entre lanzamientos (no se lee: la mide la fotopuerta).
  const launchActual = Math.min(KP_LIMITS.launchSpeed[1], Math.max(KP_LIMITS.launchSpeed[0], launch * (1 + deviation('lanzamiento', ins.launcher.relSigma ?? 0))));
  const cart = useMemo(() => simulateCart({ mass: m1, launchSpeed: launchActual, mu }), [m1, launchActual, mu]);
  const drop = useMemo(() => simulateDrop({ mass: dropMass, height, place, drag }), [dropMass, height, place, drag]);
  const sp = useMemo(() => simulateSpring({ mass: m3, k: spring.k, compression: comp, mu }), [m3, spring.k, comp, mu]);

  /* -------------------------------------------------- lecturas de los instrumentos */
  const read1 = useMemo(() => {
    const massG = measure(m1 * 1000, { ...ins.bal, key: 'masa-carrito' });
    const dt = cart.run.dtGate === null ? null : measure(cart.run.dtGate * 1000, { ...ins.gate, key: 'dt-cinetica' });
    const v = dt && dt > 0 ? FLAG_WIDTH / (dt / 1000) : null;
    return { massG, dt, v, ek: v === null ? null : 0.5 * (massG / 1000) * v * v, sig: dt ? Math.min(3, significantDigits(dt, ins.gate.resolution)) : 3 };
  }, [m1, cart, measure, ins]);
  const read2 = useMemo(() => {
    const massG = measure(dropMass * 1000, { ...ins.bal, key: 'masa-objeto' });
    const h = measure(height, { ...ins.tape, key: 'altura' });
    const F = measure(drop.liftForce, { ...ins.force, key: 'fuerza-torno' });
    const dt = measure(drop.dtGate * 1000, { ...ins.gate, key: 'dt-gravitatoria' });
    const v = dt > 0 ? FLAG_WIDTH / (dt / 1000) : null;
    const m = massG / 1000;
    return {
      massG, h, F, dt, v, work: F * h, ep: m * g * h, vPred: Math.sqrt(2 * g * h),
      ek: v === null ? null : 0.5 * m * v * v, sig: Math.min(3, significantDigits(dt, ins.gate.resolution)),
    };
  }, [dropMass, height, drop, g, measure, ins]);
  const read3 = useMemo(() => {
    const massG = measure(m3 * 1000, { ...ins.bal, key: 'masa-carrito-3' });
    const xCm = measure(comp * 100, { ...ins.ruler, key: 'compresion' });
    const F = measure(sp.holdForce, { ...ins.force, key: 'fuerza-resorte' });
    const dtModel = sp.run?.dtGate ?? null;
    const dt = dtModel === null ? null : measure(dtModel * 1000, { ...ins.gate, key: 'dt-elastica' });
    const v = dt && dt > 0 ? FLAG_WIDTH / (dt / 1000) : null;
    const x = xCm / 100;
    return {
      massG, xCm, F, dt, v, epEl: 0.5 * spring.k * x * x, epF: 0.5 * F * x,
      ek: v === null ? null : 0.5 * (massG / 1000) * v * v,
      sig: Math.max(2, Math.min(3, significantDigits(xCm, ins.ruler.resolution))),
      sigV: dt ? Math.min(3, significantDigits(dt, ins.gate.resolution)) : 3,
    };
  }, [m3, comp, sp, spring.k, measure, ins]);

  /* -------------------------------------------------- animación */
  const tEnd = station === 'cinetica'
    ? (cart.run.tGate ?? (cart.run.decel > 0 ? launchActual / cart.run.decel : 1))
    : station === 'gravitatoria' ? drop.tGate
      : sp.run?.tGate != null ? sp.tSep! + sp.run.tGate : (sp.tSep ?? Math.PI * Math.sqrt(m3 / spring.k)) + (sp.run ? (sp.vSep! / Math.max(1e-9, sp.run.decel)) : 0);
  const rate = station === 'gravitatoria' ? 1 : Math.max(1, tEnd / 3.5);
  const LIFT_MS = 1600 + 140 * height;

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setT(0); };
  useEffect(reset, [station, slots1, launch, dropMass, height, place, springId, comp, slots3, mu, drag]);

  useEffect(() => {
    if (phase !== 'corriendo' && phase !== 'subiendo') return;
    const lifting = phase === 'subiendo';
    if (prefersReducedMotion()) { if (lifting) { setT(1); setPhase('arriba'); } else { setT(tEnd); setPhase('medido'); } return; }
    const start = performance.now();
    const tick = (now: number) => {
      const el = Math.max(0, now - start);
      if (lifting) {
        const f = Math.min(1, el / LIFT_MS);
        setT(f);
        if (f >= 1) { setPhase('arriba'); return; }
      } else {
        const sim = (el / 1000) * rate;
        if (sim >= tEnd) { setT(tEnd); setPhase('medido'); return; }
        setT(sim);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, tEnd, rate, LIFT_MS]);

  const running = phase === 'corriendo';
  const measured = phase === 'medido';
  const busy = running || phase === 'subiendo';

  // Estados instantáneos para la escena y las barras.
  const s1 = cartStateAt(cart, phase === 'listo' ? 0 : t);
  const s2 = dropStateAt(drop, running || measured ? t : 0);
  const s3 = springStateAt(sp, running || measured ? t : 0);
  const liftFrac = phase === 'subiendo' ? t : phase === 'listo' ? 0 : 1;
  const objY = phase === 'listo' || phase === 'subiendo' ? height * liftFrac : s2.y; // altura del centro de la bandera (m)

  // Sonidos: soplador, torno, electroimán, fotopuerta y fin de la medición.
  useSoundLoop('blower', station !== 'gravitatoria' && (running || measured), 0.7);
  useSoundLoop('hum', phase === 'subiendo', 0.6);
  const cartX = station === 'cinetica' ? qx(phase === 'listo' ? 0 : s1.x) : qx(s3.q);
  const gateBlocked = station === 'gravitatoria'
    ? Math.abs(objY) <= FLAG_WIDTH / 2 && phase !== 'listo' && phase !== 'subiendo' && (running || measured)
    : Math.abs(cartX - GATE_X) < FLAG_PX / 2;
  const prevGate = useRef(gateBlocked);
  useEffect(() => {
    if (running && gateBlocked && !prevGate.current) playSound('photogate');
    prevGate.current = gateBlocked;
  });
  useEffect(() => { if (measured) playSound('beep', { freq: 2400 }); }, [measured]);

  const startRun = () => {
    if (station === 'cinetica') { remeasure('lanzamiento', 'dt-cinetica', 'masa-carrito'); playSound('thunk', { intensity: 0.4 + launch * 0.25 }); }
    else if (station === 'gravitatoria') { remeasure('dt-gravitatoria'); playSound('switch'); }
    else { remeasure('dt-elastica', 'masa-carrito-3'); playSound('clack', { intensity: 0.3 + comp * 5 }); }
    cancelAnimationFrame(raf.current);
    setT(0);
    setPhase('corriendo');
  };
  const startLift = () => { remeasure('altura', 'fuerza-torno', 'masa-objeto'); playSound('click'); cancelAnimationFrame(raf.current); setT(0); setPhase('subiendo'); };
  const startCompress = () => remeasure('compresion', 'fuerza-resorte');
  useEffect(() => { if (station === 'elastica') startCompress(); }, [comp, springId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeSlots = (set: (n: number) => void, cur: number) => (v: number) => { if (v !== cur) { set(v); playSound('clank', { intensity: 0.35 + v * 0.05 }); } };

  /* -------------------------------------------------- modelo publicado (modo avanzado) */
  usePublishModel((): ModelState => {
    if (station === 'cinetica') return {
      vars: {
        m: { sym: 'm', name: 'Masa del carrito', value: m1, unit: 'kg', decimals: 3 },
        v0: { sym: 'v_{0}', name: 'Rapidez de salida', value: launchActual, unit: 'm/s', decimals: 3 },
        L: { sym: 'L', name: 'Ancho de la bandera', value: FLAG_WIDTH, unit: 'm', decimals: 4 },
        dt: { sym: 'Δt', name: 'Tiempo de bloqueo', value: read1.dt === null ? null : read1.dt / 1000, unit: 's', decimals: 5 },
        v: { sym: 'v', name: 'Rapidez medida', value: read1.v, unit: 'm/s', decimals: 4 },
        Ec: { sym: 'E_{c}', name: 'Energía cinética en la fotopuerta', value: read1.ek, unit: 'J', decimals: 5 },
        mu: { sym: '\\mu', name: 'Rozamiento del riel', value: mu, decimals: 3 },
        g: { sym: 'g', value: 9.81, unit: 'm/s²', decimals: 2 },
        d: { sym: 'd', name: 'Distancia a la fotopuerta', value: GATE_DISTANCE, unit: 'm', decimals: 2 },
        Q: { sym: 'E_{dis}', name: 'Energía disipada', value: cart.heatGate, unit: 'J', decimals: 5 },
      },
      equations: [
        { title: 'Rapidez con la fotopuerta', lhs: 'v', expr: '\\frac{[L]}{[dt]}' },
        { title: 'Energía cinética', lhs: 'Ec', expr: '\\frac{1}{2}·[m]·[v]^{2}' },
        { title: 'Energía disipada por rozamiento', lhs: 'Q', expr: '[mu]·[m]·[g]·[d]' },
      ],
    };
    if (station === 'gravitatoria') return {
      vars: {
        m: { sym: 'm', name: 'Masa del objeto', value: read2.massG / 1000, unit: 'kg', decimals: 4 },
        g: { sym: 'g', name: `Gravedad (${PLACE_LABEL[place]})`, value: g, unit: 'm/s²', decimals: 2 },
        h: { sym: 'h', name: 'Altura medida', value: read2.h, unit: 'm', decimals: 3 },
        F: { sym: 'F', name: 'Fuerza del torno', value: read2.F, unit: 'N', decimals: 2 },
        W: { sym: 'W', name: 'Trabajo del torno', value: read2.work, unit: 'J', decimals: 3 },
        Ep: { sym: 'E_{p}', name: 'Energía potencial gravitatoria', value: read2.ep, unit: 'J', decimals: 3 },
        vp: { sym: 'v_{pred}', name: 'Rapidez predicha sin aire', value: read2.vPred, unit: 'm/s', decimals: 3 },
        L: { sym: 'L', value: FLAG_WIDTH, unit: 'm', decimals: 4 },
        dt: { sym: 'Δt', value: measured ? read2.dt / 1000 : null, unit: 's', decimals: 6 },
        v: { sym: 'v', name: 'Rapidez medida', value: measured ? read2.v : null, unit: 'm/s', decimals: 3 },
        Ec: { sym: 'E_{c}', name: 'Energía cinética en la fotopuerta', value: measured ? read2.ek : null, unit: 'J', decimals: 3 },
      },
      equations: [
        { title: 'Trabajo del torno al subir despacio', lhs: 'W', expr: '[F]·[h]' },
        { title: 'Energía potencial gravitatoria', lhs: 'Ep', expr: '[m]·[g]·[h]' },
        { title: 'Conservación sin aire (la masa se cancela)', lhs: 'vp', expr: '\\sqrt{2·[g]·[h]}' },
        { title: 'Rapidez con la fotopuerta', lhs: 'v', expr: '\\frac{[L]}{[dt]}' },
        { title: 'Energía cinética en la fotopuerta', lhs: 'Ec', expr: '\\frac{1}{2}·[m]·[v]^{2}' },
      ],
    };
    return {
      vars: {
        k: { sym: 'k', name: 'Constante del resorte', value: spring.k, unit: 'N/m', decimals: 0 },
        x: { sym: 'x', name: 'Compresión medida', value: read3.xCm / 100, unit: 'm', decimals: 3 },
        F: { sym: 'F', name: 'Fuerza del resorte comprimido', value: read3.F, unit: 'N', decimals: 2 },
        Ee: { sym: 'E_{pe}', name: 'Energía potencial elástica', value: read3.epEl, unit: 'J', decimals: 5 },
        EF: { sym: 'E_{pe}\\prime', name: 'Energía elástica con la fuerza medida', value: read3.epF, unit: 'J', decimals: 5 },
        m: { sym: 'm', name: 'Masa del carrito', value: read3.massG / 1000, unit: 'kg', decimals: 4 },
        L: { sym: 'L', value: FLAG_WIDTH, unit: 'm', decimals: 4 },
        dt: { sym: 'Δt', value: measured && read3.dt ? read3.dt / 1000 : null, unit: 's', decimals: 5 },
        v: { sym: 'v', value: measured ? read3.v : null, unit: 'm/s', decimals: 4 },
        Ec: { sym: 'E_{c}', name: 'Energía cinética en la fotopuerta', value: measured ? read3.ek : null, unit: 'J', decimals: 5 },
      },
      equations: [
        { title: 'Energía potencial elástica', lhs: 'Ee', expr: '\\frac{1}{2}·[k]·[x]^{2}' },
        { title: 'Con la fuerza medida (F = k·x)', lhs: 'EF', expr: '\\frac{1}{2}·[F]·[x]' },
        { title: 'Rapidez con la fotopuerta', lhs: 'v', expr: '\\frac{[L]}{[dt]}' },
        { title: 'Energía cinética en la fotopuerta', lhs: 'Ec', expr: '\\frac{1}{2}·[m]·[v]^{2}' },
      ],
    };
  }, [station, m1, launchActual, read1, read2, read3, mu, cart, place, g, spring.k, measured]);

  /* -------------------------------------------------- guardar */
  const record = () => {
    if (!measured) return;
    if (station === 'cinetica') {
      if (read1.v === null || read1.ek === null || read1.dt === null) return;
      api.addTrial('cinetica', {
        masa: m1, pesas: slots1, rapidezLanzador: launch, mu, masaMedida: read1.massG, tiempo: read1.dt,
        rapidez: r(read1.v, 4), rapidez2: r(read1.v * read1.v, 4), ec: r(read1.ek, 5), disipada: r(cart.heatGate, 5),
      });
    } else if (station === 'gravitatoria') {
      if (read2.v === null || read2.ek === null) return;
      api.addTrial('gravitatoria', {
        lugar: PLACE_LABEL[place], g, masa: dropMass, altura: height, aire: drag, masaMedida: read2.massG, alturaMedida: read2.h,
        fuerza: read2.F, trabajo: r(read2.work, 4), ep: r(read2.ep, 4), tiempo: read2.dt, rapidez: r(read2.v, 4),
        rapidezTeorica: r(read2.vPred, 4), ec: r(read2.ek, 4), diferencia: r(read2.ep - read2.ek, 4),
      });
    } else {
      if (read3.v === null || read3.ek === null || read3.dt === null) return;
      const x = read3.xCm / 100;
      api.addTrial('elastica', {
        k: spring.k, compresion: r(comp * 100, 2), masa: m3, mu, compresionMedida: read3.xCm, compresion2: r(x * x, 8), fuerza: read3.F,
        epElastica: r(read3.epEl, 6), epFuerza: r(read3.epF, 6), masaMedida: read3.massG, tiempo: read3.dt, rapidez: r(read3.v, 4),
        ec: r(read3.ek, 6), disipada: sp.heatGate === null ? null : r(sp.heatGate, 6),
      });
    }
  };
  const canRecord = measured && (station === 'cinetica' ? read1.v !== null : station === 'gravitatoria' ? read2.v !== null : read3.v !== null);

  /* -------------------------------------------------- barras de energía */
  const bars = (() => {
    if (station === 'cinetica') {
      const e = phase === 'listo' ? { ek: 0, heat: 0 } : s1;
      return {
        scale: cart.ek0, caption: phase === 'listo' ? 'en reposo, antes de lanzar' : running ? `en movimiento${rate > 1 ? ` · animación ×${fmt(rate, 1)}` : ''}` : 'en la fotopuerta',
        items: [
          { k: 'ec', label: 'Cinética Ec', v: e.ek, color: COLORS.ec },
          { k: 'ep', label: 'Potencial Ep', v: 0, color: COLORS.epg },
          { k: 'q', label: 'Térmica (rozam.)', v: e.heat, color: COLORS.heat },
          { k: 't', label: 'Total', v: e.ek + e.heat, color: COLORS.total, outline: true },
        ],
      };
    }
    if (station === 'gravitatoria') {
      const lifting = phase === 'listo' || phase === 'subiendo' || phase === 'arriba';
      const ep = lifting ? drop.mass * g * objY : s2.ep, ek = lifting ? 0 : s2.ek, heat = lifting ? 0 : s2.heat;
      return {
        scale: drop.ep0,
        caption: phase === 'listo' ? 'objeto en el nivel de referencia' : phase === 'subiendo' ? 'el torno hace trabajo' : phase === 'arriba' ? 'arriba, en reposo' : running ? 'cayendo' : 'en la fotopuerta',
        items: [
          { k: 'ep', label: 'Potencial m·g·h', v: ep, color: COLORS.epg },
          { k: 'ec', label: 'Cinética Ec', v: ek, color: COLORS.ec },
          { k: 'q', label: 'Térmica (aire)', v: heat, color: COLORS.heat },
          { k: 't', label: 'Total', v: ep + ek + heat, color: COLORS.total, outline: true },
        ],
      };
    }
    return {
      scale: sp.epElastic, caption: phase === 'listo' ? 'resorte comprimido' : running ? `en movimiento${rate > 1 ? ` · animación ×${fmt(rate, 1)}` : ''}` : sp.run?.reachesGate ? 'en la fotopuerta' : 'detenido',
      items: [
        { k: 'ep', label: 'Elástica ½·k·x²', v: s3.ep, color: COLORS.epe },
        { k: 'ec', label: 'Cinética Ec', v: s3.ek, color: COLORS.ec },
        { k: 'q', label: 'Térmica (rozam.)', v: s3.heat, color: COLORS.heat },
        { k: 't', label: 'Total', v: s3.ep + s3.ek + s3.heat, color: COLORS.total, outline: true },
      ],
    };
  })();

  /* -------------------------------------------------- escenas */
  const gateText = (dt: number | null) => (measured && dt !== null ? fmt(dt, 2) : running ? '- - - -' : '0,00');

  const trackScene = (st: 'cinetica' | 'elastica') => {
    const slots = st === 'cinetica' ? slots1 : slots3;
    const v = st === 'cinetica' ? s1.v : s3.v;
    const dt = st === 'cinetica' ? read1.dt : read3.dt;
    const massG = st === 'cinetica' ? read1.massG : read3.massG;
    const cx = cartX;
    const mountX = qx(0) - CART_HALF - SPRING_NAT - 16;
    const springEnd = Math.min(cx - CART_HALF, qx(0) - CART_HALF);
    return (
      <g>
        <BenchTop y={BENCH_Y} width={W} />
        <AirTrack blowing={running || measured} />
        {/* cable de la fotopuerta al temporizador */}
        <path d={`M${GATE_X + 14} ${GY} C ${GATE_X + 14} 150, 240 120, 210 60`} fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <GateTimer x={14} y={12} text={gateText(dt)} caption={dt === null && measured ? 'el carrito no llegó a la fotopuerta' : 'tiempo de bloqueo de la bandera'} />
        <DigitalBalance x={566} y={70} w={180} reading={fmt(massG, 1)}>
          <rect x={606} y={60} width={100} height={10} rx={3} fill="url(#kit-metal)" stroke="#7d8a8f" />
          <text x={656} y={54} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)', fontWeight: 600 }}>carrito con pesas (medido antes)</text>
        </DigitalBalance>
        <EnergyBars x={226} y={12} w={330} items={bars.items} scale={bars.scale} caption={bars.caption} />
        <PhotoGate x={GATE_X} top={GY} bottom={RY + 2} blocked={gateBlocked} label="Fotopuerta" />
        {st === 'cinetica' ? (
          <g>
            {/* lanzador de rapidez regulable: caja con perilla y empujador */}
            <g filter="url(#kit-shadow)"><rect x={RAIL_X0 + 4} y={RY - 46} width={58} height={44} rx={6} fill="url(#kit-body-dark)" /></g>
            <text x={RAIL_X0 + 33} y={RY - 50} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>LANZADOR</text>
            <Lcd x={RAIL_X0 + 9} y={RY - 40} w={48} h={16} text={fmt(launch, 2)} />
            <text x={RAIL_X0 + 33} y={RY - 12} textAnchor="middle" style={{ fontSize: 7, fill: '#c9d2d5' }}>m/s</text>
            {(() => {
              const tip = phase === 'listo' ? qx(0) - CART_HALF : qx(0) - CART_HALF + 4;
              return <rect x={RAIL_X0 + 62} y={RY - 14} width={Math.max(4, tip - RAIL_X0 - 62)} height={5} rx={2} fill="url(#kit-metal)" stroke="#7d8a8f" strokeWidth="0.5" />;
            })()}
          </g>
        ) : (
          <g>
            {/* lanzador de resorte: base con sensor de fuerza, resorte, regla y pestillo */}
            <g filter="url(#kit-shadow)"><rect x={mountX - 22} y={RY - 40} width={24} height={38} rx={4} fill="url(#kit-body-dark)" /></g>
            <ForceSensor x={mountX - 34} y={RY - 92} w={58} text={fmt(read3.F, 2)} />
            <text x={mountX - 5} y={RY - 98} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>F (N)</text>
            <path d={springPath(mountX + 2, springEnd, RY - 12, 10, 6)} fill="none" stroke="#5d6b70" strokeWidth="1.6" strokeLinejoin="round" />
            <rect x={springEnd - 2} y={RY - 22} width={3} height={20} rx={1} fill="#37474f" />
            {/* regla de compresión: el cero está en el largo natural */}
            <g>
              <rect x={qx(-0.1) - CART_HALF - 4} y={RY + 27} width={0.1 * PXM + 8} height={12} rx={1.5} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.6" />
              {Array.from({ length: 11 }, (_, i) => {
                const tx = qx(-i / 100) - CART_HALF;
                return (
                  <g key={i}>
                    <line x1={tx} x2={tx} y1={RY + 27} y2={RY + (i % 5 === 0 ? 34 : 31)} stroke="#4d3b1c" strokeWidth="0.6" />
                    {i % 5 === 0 && <text x={tx} y={RY + 38.5} textAnchor="middle" style={{ fontSize: 5.5, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{i}</text>}
                  </g>
                );
              })}
              <text x={qx(-0.1) - CART_HALF - 8} y={RY + 37} textAnchor="end" style={{ fontSize: 9, fill: 'var(--ink-2)', fontWeight: 600 }}>cm</text>
            </g>
            {phase === 'listo' && (
              <g>
                <path d={`M${cx - CART_HALF - 6} ${RY - 30} v14 h6`} fill="none" stroke="var(--warn)" strokeWidth="2.4" />
                <text x={cx - CART_HALF - 8} y={RY - 34} textAnchor="end" style={{ fontSize: 9, fill: 'var(--warn)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>pestillo</text>
                <text x={(mountX + springEnd) / 2} y={RY - 30} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--series-4)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>x = {fmt(read3.xCm, 1)} cm</text>
              </g>
            )}
            <text x={mountX + 30} y={RY - 112} style={{ fontSize: 9, fill: 'var(--ink-2)', fontWeight: 600, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{spring.name}</text>
          </g>
        )}
        <Cart cx={cx} slots={slots} />
        {(running || measured) && <VelocityArrow x={cx + CART_HALF + 6} y={RY - 64} v={v} label={`${fmt(v, 2)} m/s`} />}
        <text x={qx(0)} y={RY + 64} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>salida</text>
        <path d={`M${qx(0)} ${RY + 54} V${RY + 28}`} stroke="var(--ink-2)" strokeWidth="0.8" strokeDasharray="2 2" />
        <g>
          <line x1={qx(0)} x2={GATE_X} y1={RY + 70} y2={RY + 70} stroke="var(--data)" strokeWidth="1.1" />
          <path d={`M${qx(0)} ${RY + 70} l6 -3.5 v7 Z M${GATE_X} ${RY + 70} l-6 -3.5 v7 Z`} fill="var(--data)" />
          <text x={(qx(0) + GATE_X) / 2} y={RY + 66} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--data)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>0,60 m</text>
        </g>
      </g>
    );
  };

  const pxm = pxmFor(height);
  const yOf = (y: number) => YG - y * pxm;
  const view = viewFor(height);
  const sky = place === 'luna' ? '#1d2230' : place === 'marte' ? '#e8c9a8' : 'var(--surface-2)';
  const ground = place === 'luna' ? '#9ea3ab' : place === 'marte' ? '#b5643a' : '#b7aa8f';
  const towerScene = () => {
    const holdY = yOf(phase === 'listo' || phase === 'subiendo' ? height * liftFrac : height); // electroimán y sensor
    const oy = yOf(objY);
    const major = view <= 1 ? 0.1 : view <= 2.5 ? 0.5 : 1;
    const minor = view <= 1 ? 0.05 : view <= 2.5 ? 0.1 : 0.5;
    const ticks = Array.from({ length: Math.round(view / minor) + 1 }, (_, i) => r(i * minor, 4));
    const winchOn = phase === 'subiendo';
    return (
      <g>
        <rect x={0} y={0} width={W} height={BENCH_Y} fill={sky} />
        {place === 'luna' && [[40, 30], [120, 70], [180, 20], [420, 50], [700, 300], [640, 230], [30, 250], [160, 330]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="#fff" opacity="0.8" />)}
        <rect x={0} y={BENCH_Y - 2} width={W} height={H - BENCH_Y + 2} fill={ground} />
        {/* mástil con polea */}
        <g filter="url(#kit-shadow)">
          <rect x={MAST_X - 6} y={14} width={12} height={BENCH_Y - 14} fill="url(#kit-metal-h)" />
          <rect x={MAST_X - 30} y={BENCH_Y - 10} width={60} height={10} rx={2} fill="url(#kit-body-dark)" />
        </g>
        <rect x={MAST_X - 4} y={14} width={DROP_X - MAST_X + 10} height={6} rx={2} fill="url(#kit-body-dark)" />
        <circle cx={DROP_X - 6} cy={PULLEY_Y} r={8} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.8" />
        <circle cx={DROP_X - 6} cy={PULLEY_Y} r={2} fill="#37474f" />
        {/* torno al pie del mástil */}
        <g filter="url(#kit-shadow-soft)">
          <rect x={MAST_X - 70} y={BENCH_Y - 52} width={52} height={42} rx={5} fill="url(#kit-body-dark)" />
        </g>
        <circle cx={MAST_X - 44} cy={BENCH_Y - 34} r={11} fill="url(#kit-metal)" stroke="#5d6b70" />
        <circle cx={MAST_X - 44} cy={BENCH_Y - 34} r={8} fill="none" stroke="#b98a4a" strokeWidth="2.4" strokeDasharray="2 1.4" strokeDashoffset={-liftFrac * 120} />
        <text x={MAST_X - 44} y={BENCH_Y - 58} textAnchor="middle" style={{ fontSize: 9, fill: place === 'luna' ? '#e6e9ef' : 'var(--ink-2)', fontWeight: 700 }}>TORNO</text>
        <circle cx={MAST_X - 26} cy={BENCH_Y - 46} r={2.2} fill={winchOn ? '#7CFFB2' : '#33413c'} />
        {/* cuerda: torno → polea → sensor */}
        <path d={`M${MAST_X - 44} ${BENCH_Y - 45} H${MAST_X - 9} V${PULLEY_Y - 8} H${DROP_X - 6} A8 8 0 0 1 ${DROP_X + 2} ${PULLEY_Y} V${holdY - 82}`} fill="none" stroke="#b98a4a" strokeWidth="1.4" />
        <ForceSensor x={DROP_X - 30} y={holdY - 82} w={64} text={phase === 'subiendo' || phase === 'arriba' ? fmt(read2.F, 2) : '0,00'} />
        <line x1={DROP_X + 2} x2={DROP_X + 2} y1={holdY - 48} y2={holdY - 44} stroke="#5d6b70" strokeWidth="1.4" />
        <rect x={DROP_X - 11} y={holdY - 46} width={26} height={7} rx={2} fill="#c62828" />
        <text x={DROP_X + 38} y={holdY - 40} style={{ fontSize: 7.5, fill: place === 'luna' ? '#e6e9ef' : 'var(--ink-2)', fontWeight: 700 }}>electroimán</text>
        {/* tope de altura en el mástil */}
        <g>
          <rect x={MAST_X - 10} y={yOf(height) - 4} width={20} height={8} rx={2} fill="var(--warn)" />
          <line x1={MAST_X - 14} x2={DROP_X + 70} y1={yOf(height)} y2={yOf(height)} stroke="var(--data)" strokeWidth="1" strokeDasharray="3 3" />
        </g>
        {/* cinta métrica: el cero está en el haz de la fotopuerta */}
        <g>
          <rect x={DROP_X + 70} y={YT - 6} width={20} height={YG - YT + 12} fill="#ffe082" stroke="#b8975a" strokeWidth="0.7" />
          {ticks.map((v) => {
            const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
            return (
              <g key={v}>
                <line x1={DROP_X + 70} x2={DROP_X + 70 + (isMajor ? 10 : 5)} y1={yOf(v)} y2={yOf(v)} stroke="#4d3b1c" strokeWidth={isMajor ? 0.9 : 0.5} />
                {isMajor && <text x={DROP_X + 89} y={yOf(v) + 3} textAnchor="end" style={{ fontSize: 7, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{fmt(v, major < 1 ? 1 : 0)}</text>}
              </g>
            );
          })}
          <text x={DROP_X + 80} y={YT - 12} textAnchor="middle" style={{ fontSize: 9, fill: place === 'luna' ? '#e6e9ef' : 'var(--ink-2)', fontWeight: 700 }}>cinta (m)</text>
        </g>
        <text x={MAST_X - 16} y={yOf(height) + 4} textAnchor="end" style={{ fontSize: 11, fill: 'var(--data)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>h = {fmt(read2.h, 3)} m</text>
        {/* caja de arena y fotopuerta */}
        <rect x={DROP_X - 44} y={YG + 16} width={88} height={BENCH_Y - YG - 16} rx={2} fill="url(#ecp-sand)" stroke="#8d6e3a" />
        <rect x={DROP_X - 44} y={YG + 16} width={88} height={BENCH_Y - YG - 16} rx={2} fill="url(#ecp-sand-grain)" />
        <text x={DROP_X} y={BENCH_Y - 8} textAnchor="middle" style={{ fontSize: 8, fill: '#4d3b1c', fontWeight: 700 }}>arena</text>
        {/* objeto: cilindro de acero con bandera vertical; oy = centro de la bandera */}
        <g>
          <rect x={DROP_X - 3} y={oy - 9} width={6} height={18} fill="#1f2a2d" />
          <rect x={DROP_X - 13} y={oy - 40} width={26} height={30} rx={3} fill="url(#ecp-steel)" stroke="#4a5558" strokeWidth="0.8" />
          <text x={DROP_X} y={oy - 22} textAnchor="middle" style={{ fontSize: 7, fill: '#1f2a2d', fontWeight: 700 }}>{fmt(dropMass, 2)}</text>
          <text x={DROP_X} y={oy - 14} textAnchor="middle" style={{ fontSize: 6, fill: '#1f2a2d' }}>kg</text>
        </g>
        <PhotoGate x={DROP_X} top={YG} bottom={YG + 16} blocked={gateBlocked} label="Fotopuerta · Ep = 0" horizontal />
        {(running || measured) && s2.v > 0.05 && (
          <g>
            <line x1={DROP_X + 40} x2={DROP_X + 40} y1={oy - 44} y2={oy - 44 + Math.min(60, s2.v * 4.5)} stroke="var(--series-1)" strokeWidth="3" />
            <path d={`M${DROP_X + 40} ${oy - 36 + Math.min(60, s2.v * 4.5)} l-5 -8 h10 Z`} fill="var(--series-1)" />
            <text x={DROP_X} y={oy - 48} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--series-1)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>v = {fmtSig(s2.v, 3)} m/s</text>
          </g>
        )}
        {/* rótulos e instrumentos a la derecha */}
        <g>
          <rect x={14} y={12} width={196} height={38} rx={8} fill="var(--surface)" stroke="var(--line)" />
          <text x={26} y={28} style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700 }}>{PLACE_LABEL[place]} · g = {fmt(g, 2)} m/s²</text>
          <text x={26} y={42} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>Vista de 0 a {fmt(view, view < 10 ? 1 : 1)} m sobre el haz</text>
        </g>
        <EnergyBars x={430} y={12} w={318} items={bars.items} scale={bars.scale} caption={bars.caption} />
        <GateTimer x={552} y={170} text={gateText(read2.dt)} caption="bloqueo de la bandera de 5,00 cm" />
        <DigitalBalance x={566} y={290} w={180} reading={fmt(read2.massG, 1)}>
          <rect x={644} y={268} width={24} height={22} rx={3} fill="url(#ecp-steel)" stroke="#4a5558" strokeWidth="0.6" />
          <text x={656} y={262} textAnchor="middle" style={{ fontSize: 8.5, fill: place === 'luna' ? '#e6e9ef' : 'var(--ink-2)', fontWeight: 600 }}>objeto (medido antes)</text>
        </DigitalBalance>
        <text x={14} y={BENCH_Y + 22} style={{ fontSize: 9, fill: '#1f2a2d', fontWeight: 600 }}>El objeto, el sensor y la fotopuerta no están a escala; las alturas sí.</text>
        <ContactShadow x={DROP_X - 44} y={BENCH_Y} w={88} h={6} />
      </g>
    );
  };

  /* -------------------------------------------------- descripción accesible */
  const desc = station === 'cinetica'
    ? `Riel de aire horizontal con un carrito de ${fmt(m1 * 1000, 0)} g lanzado a ${fmt(launch, 2)} m/s hacia una fotopuerta a 0,60 m. ` +
      (measured ? (read1.dt === null ? 'El carrito se detuvo antes de la fotopuerta.' : `La fotopuerta marcó ${fmt(read1.dt, 2)} ms.`) : 'Aún no se ha lanzado.')
    : station === 'gravitatoria'
      ? `Torre de caída en ${PLACE_LABEL[place]} (g = ${fmt(g, 2)} m/s²): un objeto de ${fmt(dropMass, 2)} kg colgado de un sensor de fuerza y un electroimán, a ${fmt(height, 2)} m sobre el haz de una fotopuerta. ` +
        (phase === 'listo' ? 'El objeto está abajo.' : phase === 'subiendo' ? 'El torno lo está subiendo.' : phase === 'arriba' ? `Está arriba; el sensor marca ${fmt(read2.F, 2)} N.` : measured ? `Cayó y la fotopuerta marcó ${fmt(read2.dt, 2)} ms.` : 'Está cayendo.')
      : `Lanzador con un ${spring.name.toLowerCase()} comprimido ${fmt(comp * 100, 1)} cm contra un carrito de ${fmt(m3 * 1000, 0)} g en un riel de aire. ` +
        (measured ? (read3.dt === null ? 'El carrito no llegó a la fotopuerta.' : `La fotopuerta marcó ${fmt(read3.dt, 2)} ms.`) : 'El pestillo sostiene el carrito.');

  /* -------------------------------------------------- gráficas con los ensayos guardados */
  const trials = api.session.trials;
  const charts = (() => {
    if (station === 'cinetica') {
      const mine = (t: Trial) => t.datasetId === 'cinetica' && same(t.values.masa, m1);
      const other = (t: Trial) => t.datasetId === 'cinetica' && !same(t.values.masa, m1);
      const pv = trialPoints(trials, 'rapidez', 'ec', mine), pv2 = trialPoints(trials, 'rapidez2', 'ec', mine);
      const ov = trialPoints(trials, 'rapidez', 'ec', other);
      const k = slopeThroughOrigin(pv2);
      const curve = Array.from({ length: 41 }, (_, i) => { const v = (2.05 * i) / 40; return { x: v, y: 0.5 * m1 * v * v }; });
      const label = `Ensayos con m = ${fmt(m1, 2)} kg`;
      return {
        a: { title: 'Energía cinética frente a la rapidez', xLabel: 'Rapidez v (m/s)', yLabel: 'Ec (J)', xUnit: 'm/s', yUnit: 'J', fit: undefined,
          series: [{ label, kind: 'scatter', color: COLORS.ec, points: pv }, ...(ov.length ? [{ label: 'Otras masas', kind: 'scatter', color: 'var(--series-8)', points: ov }] : []), { label: `Modelo ½·m·v² (m = ${fmt(m1, 2)} kg)`, kind: 'line', dashed: true, color: 'var(--series-2)', points: curve }] as Series[] },
        b: { title: 'Linealización: Ec frente a v²', xLabel: 'v² (m²/s²)', yLabel: 'Ec (J)', xUnit: 'm²/s²', yUnit: 'J', fit: 'proportional' as const, series: [{ label, kind: 'scatter', color: COLORS.ec, points: pv2 }] as Series[] },
        note: k === null ? `Guarda al menos dos lanzamientos con ${fmt(m1, 2)} kg para ver la pendiente.` : `Pendiente de la recta Ec = k·v²: k = ${fmtSig(k, 3)} kg. El modelo predice k = m/2 = ${fmt(m1 / 2, 3)} kg (${pv2.length} ensayos).`,
      };
    }
    if (station === 'gravitatoria') {
      const mine = (t: Trial) => t.datasetId === 'gravitatoria' && same(t.values.masa, dropMass) && same(t.values.g, g);
      const ph = trialPoints(trials, 'alturaMedida', 'ep', mine);
      const pe = trialPoints(trials, 'ep', 'ec', (t) => t.datasetId === 'gravitatoria');
      const k = slopeThroughOrigin(ph);
      const maxE = Math.max(1, ...pe.map((p) => p.x));
      return {
        a: { title: 'Energía potencial frente a la altura', xLabel: 'Altura h (m)', yLabel: 'Ep = m·g·h (J)', xUnit: 'm', yUnit: 'J', fit: 'proportional' as const,
          series: [{ label: `${fmt(dropMass, 2)} kg en ${PLACE_LABEL[place]}`, kind: 'scatter', color: COLORS.epg, points: ph }] as Series[] },
        b: { title: 'Energía cinética en la fotopuerta frente a Ep', xLabel: 'Ep = m·g·h (J)', yLabel: 'Ec = ½·m·v² (J)', xUnit: 'J', yUnit: 'J', fit: undefined,
          series: [{ label: 'Todas las caídas guardadas', kind: 'scatter', color: COLORS.ec, points: pe }, { label: 'Ec = Ep (conservación)', kind: 'line', dashed: true, color: 'var(--series-8)', points: [{ x: 0, y: 0 }, { x: maxE * 1.05, y: maxE * 1.05 }] }] as Series[] },
        note: k === null ? `Guarda al menos dos caídas con ${fmt(dropMass, 2)} kg en ${PLACE_LABEL[place]} a distintas alturas para ver la pendiente.` : `Pendiente de Ep = k·h: k = ${fmtSig(k, 3)} N. El modelo predice k = m·g = ${fmtSig(dropMass * g, 3)} N, que es el peso que marca el sensor de fuerza.`,
      };
    }
    const mine = (t: Trial) => t.datasetId === 'elastica' && same(t.values.k, spring.k);
    const px = trialPoints(trials, 'compresionMedida', 'ec', mine), px2 = trialPoints(trials, 'compresion2', 'ec', mine);
    const k = slopeThroughOrigin(px2);
    return {
      a: { title: 'Energía cinética frente a la compresión', xLabel: 'Compresión x (cm)', yLabel: 'Ec (J)', xUnit: 'cm', yUnit: 'J', fit: undefined,
        series: [{ label: `Resorte de ${spring.k} N/m`, kind: 'scatter', color: COLORS.epe, points: px }, { label: `Modelo ½·k·x² (k = ${spring.k} N/m)`, kind: 'line', dashed: true, color: 'var(--series-2)', points: Array.from({ length: 41 }, (_, i) => { const x = (10.2 * i) / 40; return { x, y: 0.5 * spring.k * (x / 100) ** 2 }; }) }] as Series[] },
      b: { title: 'Linealización: Ec frente a x²', xLabel: 'x² (m²)', yLabel: 'Ec (J)', xUnit: 'm²', yUnit: 'J', fit: 'proportional' as const, series: [{ label: `Resorte de ${spring.k} N/m`, kind: 'scatter', color: COLORS.epe, points: px2 }] as Series[] },
      note: k === null ? `Guarda al menos dos disparos con el resorte de ${spring.k} N/m para ver la pendiente.` : `Pendiente de Ec = k′·x²: k′ = ${fmtSig(k, 3)} J/m². Sin rozamiento el modelo predice k′ = k/2 = ${fmt(spring.k / 2, 1)} J/m².`,
    };
  })();

  /* -------------------------------------------------- ideas erróneas (con números del modelo) */
  const ideas: Idea[] = [
    {
      id: 'doble', text: 'Si la rapidez se duplica, la energía cinética se duplica', answer: 'falso', tryLabel: 'Probarlo en la estación 1',
      feedback: ({ m1: m }) => `Ec = ½·m·v² depende del cuadrado de la rapidez. Con ${fmt(m, 2)} kg: a 0,50 m/s, Ec = ${J(0.5 * m * 0.25)}; a 1,00 m/s, Ec = ${J(0.5 * m)}: cuatro veces más. Lanza a 0,50 y a 1,00 m/s y compara en la tabla.`,
      tryIt: () => { setStation('cinetica'); setLaunch(1); },
    },
    {
      id: 'pesados', text: 'Los objetos pesados caen más rápido que los livianos', answer: 'falso', tryLabel: 'Probarlo en la estación 2',
      feedback: ({ h, g: gg }) => {
        const a = simulateDrop({ mass: 0.25, height: h, place, drag: 0.01 }), b = simulateDrop({ mass: 2, height: h, place, drag: 0.01 });
        return `Sin aire, m·g·h = ½·m·v² y la masa se cancela: desde ${fmt(h, 2)} m, 0,25 kg y 2,00 kg llegan a √(2·g·h) = ${fmt(Math.sqrt(2 * gg * h), 2)} m/s. Con aire (c = 0,010 kg/m) el aire frena relativamente más al liviano: ${fmt(a.vGate, 2)} m/s frente a ${fmt(b.vGate, 2)} m/s${place === 'luna' ? ' (en la Luna no hay aire: llegan iguales)' : ''}. Suelta 0,25 kg y 2,00 kg desde la misma altura y compara los tiempos.`;
      },
      tryIt: () => { setStation('gravitatoria'); setDropMass(2); },
    },
    {
      id: 'camino', text: 'La energía potencial depende del camino por el que se sube el objeto', answer: 'falso', tryLabel: 'Ver el trabajo del torno',
      feedback: ({ m2: m, h, g: gg }) => {
        const th = Math.PI / 6, F = m * gg * Math.sin(th), d = h / Math.sin(th);
        return `Subiendo ${fmt(m, 2)} kg en línea recta hasta ${fmt(h, 2)} m: W = m·g·h = ${J(m * gg * h)}. Por una rampa sin rozamiento de 30°: F = m·g·sen 30° = ${fmtSig(F, 3)} N durante d = h/sen 30° = ${fmt(d, 2)} m, W = ${J(F * d)}: lo mismo. Menos fuerza, más distancia. Ep solo depende de m, g y la altura final.`;
      },
      tryIt: () => { setStation('gravitatoria'); },
    },
    {
      id: 'gasta', text: 'La energía se gasta y desaparece cuando el carrito se frena', answer: 'falso', tryLabel: adv.enabled ? 'Probarlo con rozamiento' : 'Probarlo (activa el modo avanzado)',
      feedback: () => {
        const c = simulateCart({ mass: 0.5, launchSpeed: 1, mu: 0.02 });
        return `Con rozamiento (μ = 0,02), un carrito de 0,50 kg lanzado con ${J(c.ek0)} llega a la fotopuerta con ${J(c.ekGate!)}; los ${J(c.heatGate)} restantes no desaparecen: se transforman en energía térmica del riel, del carrito y del aire. La barra «Total» no cambia.`;
      },
      tryIt: () => { if (!adv.enabled) adv.setEnabled(true); setStation('cinetica'); setFrictionOn(true); setMuSet(0.02); setSlots1(3); setLaunch(1); },
    },
  ];

  /* -------------------------------------------------- textos de lecturas */
  const show = (s: ReactNode) => (measured ? s : '—');
  const notReached = <span>no llegó a la fotopuerta</span>;

  const stationNames: Record<Station, string> = { cinetica: '1 · Energía cinética', gravitatoria: '2 · Potencial gravitatoria', elastica: '3 · Potencial elástica' };

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label={`Banco de trabajo: estación ${stationNames[station]}`}>
          <ManipScene viewBox={`0 0 ${W} ${H}`} label={`Controles de la estación ${stationNames[station]}`} scene={
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="ecp-t ecp-d">
              <title id="ecp-t">{station === 'gravitatoria' ? 'Torre de caída con torno, sensor de fuerza, electroimán, cinta métrica, fotopuerta y barras de energía' : station === 'cinetica' ? 'Riel de aire con lanzador, carrito, fotopuerta, temporizador, balanza y barras de energía' : 'Riel de aire con lanzador de resorte, sensor de fuerza, regla, fotopuerta, temporizador, balanza y barras de energía'}</title>
              <desc id="ecp-d">{`${desc} Barras de energía (${bars.caption}): ${bars.items.map((b) => `${b.label} ${fmtSig(Math.max(0, b.v), 3)} J`).join('; ')}.`}</desc>
              <Defs />
              {station === 'gravitatoria' ? towerScene() : trackScene(station)}
            </svg>}>
            {station === 'cinetica' && (
              <>
                <Knob cx={RAIL_X0 + 33} cy={RY - 72} r={12} label="Perilla del lanzador: rapidez de salida" value={launch} min={KP_LIMITS.launchSpeed[0]} max={KP_LIMITS.launchSpeed[1]} step={0.05} pageStep={0.25}
                  unit="m/s" decimals={2} disabled={busy} onChange={setLaunch} />
                <DragHandle label="Pesas de 100 g sobre el carrito (arrastra hacia arriba para poner, hacia abajo para quitar)" value={slots1} min={0} max={CART.maxSlots} step={1} pageStep={2} disabled={phase !== 'listo'}
                  orientation="vertical" hit={{ x: cartX - CART_HALF, y: RY - 70, w: CART_L, h: 56 }}
                  valueText={(v) => `${v} ${v === 1 ? 'pesa' : 'pesas'}: ${fmt(cartMass(v) * 1000, 0)} g`}
                  valueFromPoint={({ point, start, startValue }) => verticalDragValue(startValue, point.y - start.y, { min: 0, max: CART.maxSlots, step: 1 }, 120)}
                  onChange={changeSlots(setSlots1, slots1)} />
              </>
            )}
            {station === 'elastica' && (
              <>
                <Plunger label="Carrito: comprimir el resorte (arrastra hacia la izquierda)" value={comp} min={KP_LIMITS.compression[0]} max={KP_LIMITS.compression[1]} step={0.005} pageStep={0.01}
                  from={{ x: qx(-KP_LIMITS.compression[0]), y: RY - 30 }} to={{ x: qx(-KP_LIMITS.compression[1]), y: RY - 30 }} size={50}
                  valueText={(v) => `compresión ${fmt(v * 100, 1)} cm`} disabled={phase !== 'listo'} onChange={(v) => { setComp(v); playSound('squeak', { intensity: 0.2 }); }} />
                <DragHandle label="Pesas de 100 g sobre el carrito (arrastra hacia arriba para poner, hacia abajo para quitar)" value={slots3} min={0} max={CART.maxSlots} step={1} pageStep={2} disabled={phase !== 'listo'}
                  orientation="vertical" hit={{ x: cartX - CART_HALF, y: RY - 92, w: CART_L, h: 30 }}
                  valueText={(v) => `${v} ${v === 1 ? 'pesa' : 'pesas'}: ${fmt(cartMass(v) * 1000, 0)} g`}
                  valueFromPoint={({ point, start, startValue }) => verticalDragValue(startValue, point.y - start.y, { min: 0, max: CART.maxSlots, step: 1 }, 120)}
                  onChange={changeSlots(setSlots3, slots3)} />
              </>
            )}
            {station === 'gravitatoria' && (
              <DragHandle label="Tope del mástil: altura h sobre la fotopuerta" value={height} min={KP_LIMITS.height[0]} max={KP_LIMITS.height[1]} step={0.05} pageStep={0.5}
                unit="m" decimals={2} orientation="vertical" disabled={busy || phase === 'arriba'} hit={{ cx: MAST_X, cy: yOf(height), r: 14 }}
                valueFromPoint={({ point, start, startValue }) => startValue + (start.y - point.y) / pxmFor(startValue)}
                onChange={setHeight} />
            )}
          </ManipScene>
        </div>
        <ManipHint>
          {station === 'cinetica' ? 'Gira la perilla del lanzador para elegir la rapidez y arrastra hacia arriba o hacia abajo sobre el carrito para poner o quitar pesas (antes de lanzar o después de «Reiniciar»); también puedes enfocarlos con Tab y usar las flechas.'
            : station === 'gravitatoria' ? 'Arrastra el tope naranja del mástil para elegir la altura (o enfócalo con Tab y usa las flechas; RePág/AvPág cambian 0,5 m).'
              : 'Arrastra el carrito hacia la izquierda para comprimir el resorte y hacia arriba o abajo sobre sus pesas para cambiar la masa (antes de soltar o después de «Reiniciar»); también con Tab y las flechas.'}
        </ManipHint>

        {station === 'cinetica' && (
          <div className="grid-2">
            <div className="stack">
              <h3>Balanza y fotopuerta</h3>
              <Readout items={[
                { k: 'Masa del carrito (balanza)', v: `${fmt(read1.massG, 1)} g`, data: true },
                { k: 'Tiempo de bloqueo Δt', v: show(read1.dt === null ? notReached : `${fmt(read1.dt, 2)} ms`), data: true },
                { k: 'Rapidez v = L/Δt (L = 5,00 cm)', v: show(read1.v === null ? '—' : `${fmtSig(read1.v, read1.sig)} m/s`) },
              ]} />
            </div>
            <div className="stack">
              <h3>Energía cinética</h3>
              <Readout items={[
                { k: 'v²', v: show(read1.v === null ? '—' : `${fmtSig(read1.v * read1.v, read1.sig)} m²/s²`) },
                { k: 'Ec = ½·m·v²', v: show(read1.ek === null ? '—' : J(read1.ek, read1.sig)), data: true },
                ...(mu > 0 ? [{ k: 'Energía disipada μ·m·g·d (modelo)', v: show(J(cart.heatGate)) }] : []),
              ]} />
            </div>
          </div>
        )}
        {station === 'gravitatoria' && (
          <div className="grid-2">
            <div className="stack">
              <h3>Al subir: balanza, cinta y sensor de fuerza</h3>
              <Readout items={[
                { k: 'Masa del objeto (balanza)', v: `${fmt(read2.massG, 1)} g`, data: true },
                { k: 'Altura h (cinta métrica)', v: `${fmt(read2.h, 3)} m`, data: true },
                { k: 'Fuerza del torno F (sensor)', v: phase === 'listo' ? '—' : `${fmt(read2.F, 2)} N`, data: true },
                { k: 'Trabajo del torno F·h', v: phase === 'listo' ? '—' : J(read2.work) },
                { k: 'Ep a la altura h: m·g·h', v: J(read2.ep), data: true },
              ]} />
            </div>
            <div className="stack">
              <h3>Al caer: fotopuerta</h3>
              <Readout items={[
                { k: 'Tiempo de bloqueo Δt', v: show(`${fmt(read2.dt, 2)} ms`), data: true },
                { k: 'Rapidez medida v = L/Δt', v: show(read2.v === null ? '—' : `${fmtSig(read2.v, read2.sig)} m/s`), data: true },
                { k: 'Rapidez predicha √(2·g·h)', v: `${fmt(read2.vPred, 3)} m/s` },
                { k: 'Energía cinética Ec = ½·m·v²', v: show(read2.ek === null ? '—' : J(read2.ek, read2.sig)), data: true },
                ...(drag > 0 ? [{ k: 'Disipada por el aire (modelo)', v: show(J(drop.heatGate)) }] : []),
              ]} />
            </div>
          </div>
        )}
        {station === 'elastica' && (
          <div className="grid-2">
            <div className="stack">
              <h3>Resorte comprimido: regla y sensor de fuerza</h3>
              <Readout items={[
                { k: 'Compresión x (regla)', v: `${fmt(read3.xCm, 1)} cm`, data: true },
                { k: 'Fuerza del resorte F = k·x (sensor)', v: `${fmt(read3.F, 2)} N`, data: true },
                { k: `Ep elástica ½·k·x² (k = ${spring.k} N/m)`, v: J(read3.epEl, read3.sig), data: true },
                { k: 'Con la fuerza medida ½·F·x', v: J(read3.epF, read3.sig) },
              ]} />
            </div>
            <div className="stack">
              <h3>Carrito: balanza y fotopuerta</h3>
              <Readout items={[
                { k: 'Masa del carrito (balanza)', v: `${fmt(read3.massG, 1)} g`, data: true },
                { k: 'Tiempo de bloqueo Δt', v: show(read3.dt === null ? notReached : `${fmt(read3.dt, 2)} ms`), data: true },
                { k: 'Rapidez v = L/Δt', v: show(read3.v === null ? '—' : `${fmtSig(read3.v, read3.sigV)} m/s`) },
                { k: 'Ec = ½·m·v²', v: show(read3.ek === null ? '—' : J(read3.ek, read3.sigV)), data: true },
                ...(mu > 0 ? [{ k: 'Disipada μ·m·g·(x + d) (modelo)', v: show(sp.heatGate === null ? '—' : J(sp.heatGate)) }] : []),
              ]} />
            </div>
          </div>
        )}
        {measured && station === 'elastica' && !sp.separates && <Notice kind="warn">El resorte no alcanzó a lanzar el carrito: con rozamiento, ½·k·x debe superar μ·m·g. Comprime más el resorte, usa uno más duro o quita pesas.</Notice>}
        {measured && ((station === 'cinetica' && read1.dt === null) || (station === 'elastica' && sp.separates && read3.dt === null)) && <Notice kind="warn">El rozamiento frenó el carrito antes de la fotopuerta: toda su energía cinética se transformó en energía térmica.</Notice>}

        {/* overflow-x: clip evita que la burbuja de ayuda (oculta) del botón «tabla» de la gráfica ensanche la página en pantallas angostas. */}
        <div className="grid-2" style={{ overflowX: 'clip' }}>
          <Chart title={charts.a.title} xLabel={charts.a.xLabel} yLabel={charts.a.yLabel} xUnit={charts.a.xUnit} yUnit={charts.a.yUnit} height={240}
            series={charts.a.series} fit={charts.a.series[0].points.length >= 2 ? charts.a.fit : undefined} exportName={`${PID}-${station}-a`} emptyText="Guarda ensayos para ver la gráfica." />
          <Chart title={charts.b.title} xLabel={charts.b.xLabel} yLabel={charts.b.yLabel} xUnit={charts.b.xUnit} yUnit={charts.b.yUnit} height={240}
            series={charts.b.series} fit={charts.b.series[0].points.length >= 2 ? charts.b.fit : undefined} exportName={`${PID}-${station}-b`} emptyText="Guarda ensayos para ver la gráfica." />
        </div>
        <p className="small muted" aria-live="polite">{charts.note}</p>

        <IdeasPanel ideas={ideas} ctx={{ m1, m2: dropMass, h: height, g }} />
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Estación</h3>
          <Segmented<Station> label="Estación de trabajo" value={station} onChange={setStation}
            options={[{ value: 'cinetica', label: '1 · Cinética' }, { value: 'gravitatoria', label: '2 · Gravitatoria' }, { value: 'elastica', label: '3 · Elástica' }]} />
          {station === 'cinetica' && (
            <>
              <Slider label="Pesas de 100 g sobre el carrito" value={slots1} min={0} max={CART.maxSlots} step={1} decimals={0} onChange={changeSlots(setSlots1, slots1)}
                hint={`Masa: carrito de 200 g + pesas = ${fmt(m1 * 1000, 0)} g.`} />
              <Slider label="Rapidez del lanzador" value={launch} min={KP_LIMITS.launchSpeed[0]} max={KP_LIMITS.launchSpeed[1]} step={0.05} unit="m/s" decimals={2} onChange={setLaunch}
                hint="La rapidez la mide la fotopuerta; en el modo de instrumento real el lanzador varía cerca de 1 %." />
              <div className="btn-row">
                <button type="button" className="btn primary" disabled={busy} onClick={startRun}>Lanzar el carrito</button>
                <button type="button" className="btn" onClick={reset}>Reiniciar</button>
              </div>
              <RecordButton onRecord={record} disabled={!canRecord} label="Guardar lanzamiento en la tabla" />
            </>
          )}
          {station === 'gravitatoria' && (
            <>
              <Segmented<GravityPreset> label="Lugar" value={place} onChange={setPlace}
                options={(Object.keys(GRAVITY_PRESETS) as GravityPreset[]).map((k) => ({ value: k, label: `${PLACE_LABEL[k]} (${fmt(GRAVITY_PRESETS[k], 2)})` }))} />
              <Slider label="Masa del objeto" value={dropMass} min={KP_LIMITS.dropMass[0]} max={KP_LIMITS.dropMass[1]} step={0.05} unit="kg" decimals={2} onChange={setDropMass} />
              <Slider label="Altura sobre la fotopuerta" value={height} min={KP_LIMITS.height[0]} max={KP_LIMITS.height[1]} step={0.05} unit="m" decimals={2} onChange={setHeight}
                hint="Se mide desde el haz de la fotopuerta (nivel de referencia, Ep = 0) hasta el centro de la bandera." />
              <div className="btn-row">
                <button type="button" className="btn primary" disabled={busy || phase === 'arriba' || measured} onClick={startLift}>Subir con el torno</button>
                <button type="button" className="btn primary" disabled={phase !== 'arriba'} onClick={startRun}>Soltar</button>
                <button type="button" className="btn" onClick={reset}>Reiniciar</button>
              </div>
              <RecordButton onRecord={record} disabled={!canRecord} label="Guardar caída en la tabla" />
            </>
          )}
          {station === 'elastica' && (
            <>
              <Select label="Resorte del lanzador" value={springId} onChange={setSpringId} options={SPRINGS.map((s) => ({ value: s.id, label: s.name }))} />
              <Slider label="Compresión del resorte" value={comp * 100} min={KP_LIMITS.compression[0] * 100} max={KP_LIMITS.compression[1] * 100} step={0.5} unit="cm" decimals={1}
                onChange={(v) => setComp(r(v / 100, 4))} />
              <Slider label="Pesas de 100 g sobre el carrito" value={slots3} min={0} max={CART.maxSlots} step={1} decimals={0} onChange={changeSlots(setSlots3, slots3)}
                hint={`Masa: ${fmt(m3 * 1000, 0)} g.`} />
              <div className="btn-row">
                <button type="button" className="btn primary" disabled={busy} onClick={startRun}>Soltar el pestillo</button>
                <button type="button" className="btn" onClick={reset}>Reiniciar</button>
              </div>
              <RecordButton onRecord={record} disabled={!canRecord} label="Guardar disparo en la tabla" />
            </>
          )}
          {!measured && <p className="small muted">{station === 'gravitatoria' ? 'Sube el objeto con el torno y suéltalo para poder guardar la caída.' : 'Mide con la fotopuerta para poder guardar el ensayo.'}</p>}
        </div>

        {adv.enabled && (
          <div className="card stack">
            <h3>Modo avanzado: energía disipada</h3>
            {station === 'gravitatoria' ? (
              <>
                <Segmented<'no' | 'si'> label="Resistencia del aire (F = c·v²)" value={airOn ? 'si' : 'no'} onChange={(v) => setAirOn(v === 'si')}
                  options={[{ value: 'no', label: 'Sin aire' }, { value: 'si', label: 'Con aire' }]} />
                {airOn && <Slider label="Coeficiente de arrastre c (aire de la Tierra)" value={dragSet} min={0.001} max={KP_LIMITS.drag[1]} step={0.001} unit="kg/m" decimals={3} onChange={setDragSet}
                  hint={`Se escala con la densidad del aire: en Marte es unas 60 veces menor y en la Luna no hay aire. c efectivo aquí: ${fmtSig(drop.c, 2)} kg/m${drop.vTerminal ? `; rapidez terminal ${fmt(drop.vTerminal, 1)} m/s` : ''}.`} />}
              </>
            ) : (
              <>
                <Segmented<'no' | 'si'> label="Rozamiento del riel" value={frictionOn ? 'si' : 'no'} onChange={(v) => setFrictionOn(v === 'si')}
                  options={[{ value: 'no', label: 'Soplador a tope (sin rozamiento)' }, { value: 'si', label: 'Soplador débil' }]} />
                {frictionOn && <Slider label="Coeficiente de rozamiento μ" value={muSet} min={0.005} max={KP_LIMITS.mu[1]} step={0.005} decimals={3} onChange={setMuSet}
                  hint="Rozamiento cinético constante: la energía disipada es μ·m·g·d." />}
              </>
            )}
            <p className="small muted">La energía disipada es un valor del modelo (no la mide ningún instrumento): la barra «Térmica» la muestra y la columna «disipada» la guarda.</p>
          </div>
        )}

        <Notice>{real
          ? 'Instrumento real: cada lectura de la balanza, la cinta, el sensor de fuerza, la regla y la fotopuerta incluye un error aleatorio típico, y el lanzador varía cerca de 1 %. Repite el ensayo para estimar la dispersión.'
          : 'Supuestos: riel horizontal sin rozamiento, objeto soltado desde el reposo sin aire, resorte ideal (F = k·x) y g uniforme. Las lecturas salen del modelo redondeadas a la resolución de cada instrumento; no son mediciones reales.'}</Notice>
      </div>
    </div>
  );
}

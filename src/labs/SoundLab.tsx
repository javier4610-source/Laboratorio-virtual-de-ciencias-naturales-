import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  FORKS, FORK_TAU, SCOPE, SOUND_INSTRUMENTS, SOUND_LIMITS, SPEAKER_POWERS, TUBE_DIAMETERS, analyzeResonances, forkEnvelope,
  freeFieldMicMv, levelToIntensity, nearestNote, octavesAbove, playbackLevel, scopeView, soundLevel, speedOfSound, tubeResponse,
  type SourceId, type SpeakerPowerId, type TubeType,
} from '../models/soundResonance';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { useLabSound } from '../lib/sound';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { useMeasure } from '../components/Measurement';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, ContactShadow, Lcd, Thermometer } from './kit';
import { Knob, ManipHint, ManipScene, Plunger } from './manipulate';
import { FORK_RING_S, ToneSynth, toneSupported } from './soundTones';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 900, H = 500;
const VIEW = `0 0 ${W} ${H}`;
const BENCH_Y = 470;

/** Tubo de resonancia: px por cm, boca del tubo cerrado y fondo de ambos tubos. */
const S = 3.5;
const TOP = 100;
const TUBE_BOTTOM = TOP + 100 * S; // 450
const TX = 215;
const ROD_X = 142;
const RES_X = 84;
const tubeW = (D: number) => 12 + D * 5.6;

/** Osciloscopio: pantalla de 10 × 8 divisiones de 22 px. */
const DIV = 22;
const SC = { x: 572, y: 150, w: 320, h: 312 };
const SX0 = SC.x + 18, SY0 = SC.y + 22;
const SW = SCOPE.divX * DIV, SH = SCOPE.divY * DIV;
const SYM = SY0 + SH / 2;
const KNOB_X = SC.x + SC.w - 40;
const JACK = { x: SC.x + 40, y: SC.y + SC.h - 34 };

/** Generador de señales (estante sobre el osciloscopio). */
const GEN = { x: 604, y: 42, w: 270, h: 80 };

/** Experimento de distancia: parlante, cinta y sonómetro. */
const SPK = { x: 34, y: 262, w: 58, h: 86 };
const CONE = { x: SPK.x + SPK.w, y: 300 };
const PXM = 108;
const xAtD = (d: number) => CONE.x + d * PXM;

type ExpId = 'tubo' | 'distancia';
type Phase = 'listo' | 'medido';

const EXP_LABEL: Record<ExpId, string> = { tubo: 'Tubo de resonancia', distancia: 'Nivel sonoro y distancia' };
const TUBE_LABEL: Record<TubeType, string> = { cerrado: 'Cerrado por el agua', abierto: 'Abierto en los dos extremos' };
const SOURCE_LABEL: Record<SourceId, string> = { diapason: 'Diapasón', generador: 'Generador y parlante' };
const WATER = '#5aa9de';
const TRACE = '#7CFFB2';
const CURSOR = '#ffd54f';

const decimalsFor = (res: number) => Math.max(0, Math.min(4, Math.ceil(-Math.log10(res) - 1e-9)));
const fmtF = (f: number) => fmt(f, Number.isInteger(f) ? 0 : 1);
const sci = (v: number) => {
  if (!(v > 0)) return '0';
  const e = Math.floor(Math.log10(v));
  const exp = String(e).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]);
  return `${fmt(v / 10 ** e, 2)} × 10${exp}`;
};

/* ------------------------------------------------------------------ envolvente en vivo (lo que suena = lo que se ve) */

/**
 * Amplitud relativa de la fuente en este instante: 1 con el generador encendido; e^(−t/τ) después del golpe del
 * diapasón; 0 en silencio. Con movimiento reducido se actualiza cuatro veces por segundo, sin animación continua.
 */
function useEnvelope(strikeAt: number | null, genOn: boolean): number {
  const [env, setEnv] = useState(0);
  useEffect(() => {
    if (genOn) { setEnv(1); return; }
    if (strikeAt === null) { setEnv(0); return; }
    const reduced = prefersReducedMotion();
    const value = (now: number) => forkEnvelope(Math.min(FORK_RING_S, Math.max(0, now - strikeAt) / 1000), FORK_TAU);
    setEnv(value(performance.now()));
    if (reduced) {
      const id = window.setInterval(() => setEnv(value(performance.now())), 250);
      return () => window.clearInterval(id);
    }
    let raf = 0, last = 0;
    const tick = (now: number) => {
      if (now - last > 33) { last = now; setEnv(value(now)); }
      if (Math.max(0, now - strikeAt) / 1000 < FORK_RING_S) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [strikeAt, genOn]);
  return env;
}

/* ------------------------------------------------------------------ definiciones locales */

function SoundDefs() {
  return (
    <defs>
      <linearGradient id="son-water" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={WATER} stopOpacity="0.45" />
        <stop offset="1" stopColor="#2f7fb8" stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id="son-screen" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#0f2620" />
        <stop offset="1" stopColor="#081612" />
      </linearGradient>
      <radialGradient id="son-cone" cx="0.5" cy="0.5" r="0.6">
        <stop offset="0" stopColor="#5b6266" />
        <stop offset="0.35" stopColor="#2a2f32" />
        <stop offset="1" stopColor="#15191b" />
      </radialGradient>
      <linearGradient id="son-rubber" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#4a4f52" />
        <stop offset="1" stopColor="#25292b" />
      </linearGradient>
      <linearGradient id="son-steel" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#8d989c" />
        <stop offset="0.35" stopColor="#f1f4f5" />
        <stop offset="0.6" stopColor="#b9c3c6" />
        <stop offset="1" stopColor="#7b878b" />
      </linearGradient>
      <clipPath id="son-screen-clip"><rect x={SX0} y={SY0} width={SW} height={SH} /></clipPath>
      <marker id="son-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 Z" fill="var(--data)" />
      </marker>
    </defs>
  );
}

/* ------------------------------------------------------------------ instrumentos locales */

/** Regla de madera vertical junto al tubo (0 en la boca del tubo cerrado, o en el fondo del tubo abierto). */
const TubeScale = memo(function TubeScale({ x, fromBottom }: { x: number; fromBottom: boolean }) {
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x} y={TOP - 6} width={26} height={100 * S + 12} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
      </g>
      {Array.from({ length: 101 }, (_, c) => {
        const y = fromBottom ? TUBE_BOTTOM - c * S : TOP + c * S;
        const major = c % 10 === 0, mid = c % 5 === 0;
        return (
          <g key={c}>
            <line x1={x} x2={x + (major ? 10 : mid ? 7 : 4)} y1={y} y2={y} stroke="#4d3b1c" strokeWidth={major ? 1.1 : 0.55} />
            {major && <text x={x + 24} y={y + 3} textAnchor="end" style={{ fontSize: 7.5, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{c}</text>}
          </g>
        );
      })}
      <text x={x + 13} y={fromBottom ? TOP - 10 : TUBE_BOTTOM + 15} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>cm</text>
    </g>
  );
});

/** Soporte universal con base y varilla. */
const Stand = memo(function Stand() {
  return (
    <g>
      <ContactShadow x={ROD_X - 48} y={BENCH_Y} w={96} h={8} />
      <rect x={ROD_X - 48} y={BENCH_Y - 9} width={96} height={9} rx={2} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
      <rect x={ROD_X - 2.6} y={12} width={5.2} height={BENCH_Y - 20} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.5" />
    </g>
  );
});

/** Nuez y brazo horizontal desde la varilla hasta x1. */
function Clamp({ y, x1 }: { y: number; x1: number }) {
  const left = x1 < ROD_X;
  return (
    <g>
      <rect x={Math.min(ROD_X, x1)} y={y - 2} width={Math.abs(x1 - ROD_X)} height={4} rx={2} fill="url(#kit-metal)" stroke="#8a969a" strokeWidth="0.5" />
      <rect x={ROD_X - 7} y={y - 7} width={14} height={14} rx={2.5} fill="#3b4648" />
      <circle cx={ROD_X + (left ? 10 : -10)} cy={y} r={3.2} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />
    </g>
  );
}

/** Abrazadera de caucho alrededor del tubo. */
function TubeGrip({ y, w }: { y: number; w: number }) {
  return <rect x={TX - w / 2 - 4} y={y - 5} width={w + 8} height={10} rx={3} fill="url(#son-rubber)" />;
}

/** Vidrio de un tubo (cuerpo y brillos) entre y0 y y1. */
function Glass({ y0, y1, w, x = TX, front = false }: { y0: number; y1: number; w: number; x?: number; front?: boolean }) {
  const l = x - w / 2, r = x + w / 2;
  if (!front) return <rect x={l} y={y0} width={w} height={y1 - y0} fill="url(#kit-glass-fill)" />;
  return (
    <g>
      <path d={`M${l} ${y0} L${l} ${y1} M${r} ${y0} L${r} ${y1}`} stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <rect x={l} y={y0} width={w} height={y1 - y0} fill="url(#kit-glass)" />
      <ellipse cx={x} cy={y0} rx={w / 2} ry={2.4} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      <rect x={l + 3} y={y0 + 8} width={2.4} height={Math.max(0, y1 - y0 - 20)} rx={1.2} fill="#fff" opacity="0.45" />
      <rect x={r - 6} y={y0 + 14} width={1.4} height={Math.max(0, y1 - y0 - 40)} rx={0.7} fill="#fff" opacity="0.22" />
    </g>
  );
}

/**
 * Onda estacionaria del desplazamiento del aire dentro del tubo (envolvente). Cerrado: nodo en el agua y vientre cerca
 * de la boca; abierto: vientres en las dos bocas. La anchura crece con el refuerzo del tubo y con la fuente en vivo.
 */
function StandingWave({ y0, y1, w, k, endCm, type, strength, strikeAt, genOn }: {
  y0: number; y1: number; w: number; k: number; endCm: number; type: TubeType; strength: number; strikeAt: number | null; genOn: boolean;
}) {
  const env = useEnvelope(strikeAt, genOn);
  const amp = (w / 2 - 3) * strength * env;
  if (amp < 0.4) return null;
  const n = 48;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const y = y0 + ((y1 - y0) * i) / n;
    // cerrado: distancia al agua (nodo); abierto: distancia a la boca efectiva (vientre)
    const s = type === 'cerrado' ? Math.abs(Math.sin((k * (y1 - y)) / S / 100)) : Math.abs(Math.cos((k * (y - y0 + endCm * S)) / S / 100));
    return { y, a: amp * s };
  });
  const right = pts.map((p) => `${TX + p.a} ${p.y}`).join(' L');
  const left = [...pts].reverse().map((p) => `${TX - p.a} ${p.y}`).join(' L');
  return <path d={`M${right} L${left} Z`} fill="var(--fis)" opacity="0.22" stroke="var(--fis)" strokeWidth="0.8" />;
}

/** Diapasón vertical con las puntas hacia la boca del tubo; las puntas «se abren» mientras vibra. */
function Fork({ x, yTip, f, strikeAt }: { x: number; yTip: number; f: number; strikeAt: number | null }) {
  const env = useEnvelope(strikeAt, false);
  const sway = 2.2 * env;
  const top = yTip - 44;
  const tine = (dx: number, o: number) => (
    <rect x={x + dx - 2.6 + o} y={top + 4} width={5.2} height={40} rx={2.4} fill="url(#son-steel)" stroke="#6d7b80" strokeWidth="0.5" opacity={o === 0 ? 1 : 0.35} />
  );
  return (
    <g>
      {sway > 0.2 && <>{tine(-6, -sway)}{tine(6, sway)}</>}
      {tine(-6, 0)}{tine(6, 0)}
      <path d={`M${x - 8.6} ${top + 6} Q${x - 8.6} ${top - 6} ${x} ${top - 7} Q${x + 8.6} ${top - 6} ${x + 8.6} ${top + 6} L${x + 3.4} ${top + 6} Q${x + 3.4} ${top - 1.5} ${x} ${top - 1.6} Q${x - 3.4} ${top - 1.5} ${x - 3.4} ${top + 6} Z`} fill="url(#son-steel)" stroke="#6d7b80" strokeWidth="0.5" />
      <rect x={x - 2.4} y={top - 30} width={4.8} height={24} rx={1.6} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.5" />
      <text x={x + 13} y={top + 24} style={{ fontSize: 8.5, fill: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{fmtF(f)} Hz</text>
      {sway > 0.2 && [0, 1].map((i) => (
        <path key={i} d={`M${x - 16 - i * 6} ${yTip - 6 - i * 4} Q${x - 20 - i * 6} ${yTip - 16} ${x - 16 - i * 6} ${yTip - 26 + i * 4}`} fill="none" stroke="var(--fis)" strokeWidth="1.2" opacity={0.25 + 0.5 * env} />
      ))}
    </g>
  );
}

/** Parlante pequeño que apunta hacia abajo (a la boca del tubo). */
function SpeakerDown({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g>
      <rect x={x - 16} y={y - 22} width={32} height={18} rx={3} fill="url(#kit-body-dark)" />
      <path d={`M${x - 15} ${y - 4} L${x - 9} ${y + 6} L${x + 9} ${y + 6} L${x + 15} ${y - 4} Z`} fill="url(#son-cone)" stroke="#111" strokeWidth="0.6" />
      <ellipse cx={x} cy={y + 6} rx={9} ry={2} fill="#3a4044" />
      <circle cx={x + 11} cy={y - 13} r={2} fill={on ? '#43d17a' : '#3d4a44'} />
    </g>
  );
}

/** Micrófono electret con brazo flexible. */
function Mic({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x + 4} ${y} Q${x + 18} ${y - 2} ${x + 22} ${y + 12}`} fill="none" stroke="#2f3a3d" strokeWidth="2.4" />
      <rect x={x - 7} y={y - 4} width={12} height={8} rx={3} fill="url(#kit-body-dark)" />
      <circle cx={x - 7} cy={y} r={4.4} fill="#59636a" stroke="#1f2628" strokeWidth="0.8" />
      {[-2, 0, 2].map((d) => <line key={d} x1={x - 9.5} x2={x - 4.5} y1={y + d} y2={y + d} stroke="#1f2628" strokeWidth="0.5" />)}
    </g>
  );
}

/** Generador de señales (sobre el estante): pantalla con la frecuencia y botón de encendido. */
function Generator({ f, on, active }: { f: number; on: boolean; active: boolean }) {
  const { x, y, w, h } = GEN;
  return (
    <g>
      <rect x={x - 14} y={y + h} width={w + 28} height={6} rx={2} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.6" />
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={w} height={h} rx={7} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <text x={x + 12} y={y + 16} style={{ fontSize: 8.5, fill: '#3c4648', fontWeight: 700, letterSpacing: 1 }}>GENERADOR DE SEÑALES</text>
      <Lcd x={x + 12} y={y + 24} w={136} h={32} text={active ? fmt(f, 0) : '- - -'} unit="Hz" />
      <text x={x + 12} y={y + 70} style={{ fontSize: 7.5, fill: '#55605f' }}>onda senoidal · salida al parlante</text>
      <circle cx={x + 170} cy={y + 40} r={5} fill={on ? '#43d17a' : '#3d4a44'} stroke="#1f2628" strokeWidth="0.6" />
      <text x={x + 170} y={y + 58} textAnchor="middle" style={{ fontSize: 7, fill: '#55605f', fontWeight: 700 }}>{on ? 'ON' : 'OFF'}</text>
      <text x={x + 236} y={y + 74} textAnchor="middle" style={{ fontSize: 7, fill: '#55605f', fontWeight: 700 }}>FRECUENCIA</text>
    </g>
  );
}

/** Trazo normalizado (amplitud 1, en divisiones) de una señal senoidal disparada en el flanco de subida. */
function unitTrace(f: number, tdivMs: number): string {
  const periods = (SCOPE.divX * tdivMs * f) / 1000;
  const n = Math.max(200, Math.min(1600, Math.ceil(periods * 32)));
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const xd = (SCOPE.divX * i) / n;
    pts.push(`${xd.toFixed(4)} ${Math.sin((2 * Math.PI * f * xd * tdivMs) / 1000).toFixed(4)}`);
  }
  return `M${pts.join(' L')}`;
}

interface ScopeMeasure { n: number; periodMs: number | null; ampMv: number | null }

/** Osciloscopio con retícula, trazo en vivo, cursores de medición y perillas (las perillas van en la capa de controles). */
function Scope({ f, micMv, tdiv, vdiv, strikeAt, genOn, reading }: {
  f: number; micMv: number; tdiv: number; vdiv: number; strikeAt: number | null; genOn: boolean; reading: ScopeMeasure | null;
}) {
  const env = useEnvelope(strikeAt, genOn);
  const path = useMemo(() => unitTrace(f, tdiv), [f, tdiv]);
  const live = micMv * env;
  const ampPx = (live / vdiv) * DIV;
  const clipped = live > (SCOPE.divY / 2) * vdiv;
  const grid = useMemo(() => (
    <g>
      {Array.from({ length: SCOPE.divX + 1 }, (_, i) => <line key={`v${i}`} x1={SX0 + i * DIV} x2={SX0 + i * DIV} y1={SY0} y2={SY0 + SH} stroke="#2e5a4c" strokeWidth={i === 5 ? 0.9 : 0.5} />)}
      {Array.from({ length: SCOPE.divY + 1 }, (_, i) => <line key={`h${i}`} x1={SX0} x2={SX0 + SW} y1={SY0 + i * DIV} y2={SY0 + i * DIV} stroke="#2e5a4c" strokeWidth={i === 4 ? 0.9 : 0.5} />)}
      {Array.from({ length: SCOPE.divX * 5 + 1 }, (_, i) => <line key={`t${i}`} x1={SX0 + (i * DIV) / 5} x2={SX0 + (i * DIV) / 5} y1={SYM - 2} y2={SYM + 2} stroke="#3f7a66" strokeWidth="0.5" />)}
      {Array.from({ length: SCOPE.divY * 5 + 1 }, (_, i) => <line key={`u${i}`} x1={SX0 + SW / 2 - 2} x2={SX0 + SW / 2 + 2} y1={SY0 + (i * DIV) / 5} y2={SY0 + (i * DIV) / 5} stroke="#3f7a66" strokeWidth="0.5" />)}
    </g>
  ), []);
  const cursorX = reading && reading.n >= 1 && reading.periodMs ? SX0 + ((reading.n * reading.periodMs) / tdiv) * DIV : null;
  return (
    <g>
      <ContactShadow x={SC.x} y={SC.y + SC.h} w={SC.w} h={9} />
      <g filter="url(#kit-shadow)">
        <rect x={SC.x} y={SC.y} width={SC.w} height={SC.h} rx={10} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <rect x={SX0 - 8} y={SY0 - 8} width={SW + 16} height={SH + 16} rx={6} fill="url(#kit-body-dark)" />
      <rect x={SX0} y={SY0} width={SW} height={SH} fill="url(#son-screen)" />
      {grid}
      <g clipPath="url(#son-screen-clip)">
        {ampPx < 0.4
          ? <line x1={SX0} x2={SX0 + SW} y1={SYM} y2={SYM} stroke={TRACE} strokeWidth="1.6" />
          : <path d={path} transform={`translate(${SX0} ${SYM}) scale(${DIV} ${-ampPx})`} fill="none" stroke={TRACE} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />}
        {reading && cursorX !== null && (
          <g>
            <line x1={SX0} x2={SX0} y1={SY0} y2={SY0 + SH} stroke={CURSOR} strokeWidth="1.2" strokeDasharray="4 3" />
            <line x1={cursorX} x2={cursorX} y1={SY0} y2={SY0 + SH} stroke={CURSOR} strokeWidth="1.2" strokeDasharray="4 3" />
          </g>
        )}
        {reading && reading.ampMv !== null && (
          <line x1={SX0} x2={SX0 + SW} y1={SYM - (reading.ampMv / vdiv) * DIV} y2={SYM - (reading.ampMv / vdiv) * DIV} stroke={CURSOR} strokeWidth="1.1" strokeDasharray="4 3" />
        )}
      </g>
      <rect x={SX0} y={SY0} width={SW} height={SH} fill="none" stroke="#0a1310" strokeWidth="1.2" />
      <text x={SX0 + 4} y={SY0 + 11} style={{ fontSize: 8.5, fill: TRACE, fontFamily: 'var(--font-data)' }}>CH1 {fmt(vdiv, 0)} mV/div</text>
      <text x={SX0 + SW - 4} y={SY0 + 11} textAnchor="end" style={{ fontSize: 8.5, fill: TRACE, fontFamily: 'var(--font-data)' }}>{fmt(tdiv, 1)} ms/div</text>
      {clipped && <text x={SX0 + SW - 4} y={SY0 + SH - 6} textAnchor="end" style={{ fontSize: 8.5, fill: '#ff8a80', fontFamily: 'var(--font-data)', fontWeight: 700 }}>SEÑAL RECORTADA</text>}
      {env === 0 && <text x={SX0 + SW / 2} y={SYM - 8} textAnchor="middle" style={{ fontSize: 8.5, fill: TRACE, fontFamily: 'var(--font-data)', opacity: 0.8 }}>sin señal (fuente en silencio)</text>}
      {reading && (
        <text x={SX0 + 4} y={SY0 + SH - 6} style={{ fontSize: 8.5, fill: CURSOR, fontFamily: 'var(--font-data)' }}>
          {reading.periodMs !== null ? `Δt ${fmt(reading.n * reading.periodMs, 2)} ms (${reading.n} T)` : 'Δt —'} · {reading.ampMv !== null ? `Vp ${fmt(reading.ampMv, decimalsFor(SCOPE.cursorDiv * vdiv))} mV` : 'Vp —'}
        </text>
      )}
      {/* rótulos del panel */}
      <text x={SX0} y={SC.y + SC.h - 60} style={{ fontSize: 9, fill: '#3c4648', fontWeight: 700, letterSpacing: 1.2 }}>OSCILOSCOPIO</text>
      <text x={SX0} y={SC.y + SC.h - 48} style={{ fontSize: 7.5, fill: '#55605f' }}>disparo: flanco de subida · retícula 10 × 8 div</text>
      <circle cx={JACK.x} cy={JACK.y} r={7} fill="url(#kit-metal)" stroke="#5d6b70" />
      <circle cx={JACK.x} cy={JACK.y} r={2.6} fill="#1f2628" />
      <text x={JACK.x + 12} y={JACK.y + 3} style={{ fontSize: 7.5, fill: '#55605f', fontWeight: 700 }}>CH1 · micrófono</text>
      <text x={KNOB_X} y={SC.y + 30} textAnchor="middle" style={{ fontSize: 7.5, fill: '#3c4648', fontWeight: 700 }}>TIEMPO/DIV</text>
      <text x={KNOB_X} y={SC.y + 118} textAnchor="middle" style={{ fontSize: 7.5, fill: '#3c4648', fontWeight: 700 }}>VOLTS/DIV</text>
    </g>
  );
}

/** Frentes de onda que salen del parlante (más tenues lejos: la energía se reparte en una esfera cada vez mayor). */
function Wavefronts({ on, maxX }: { on: boolean; maxX: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!on || prefersReducedMotion()) return;
    const start = performance.now();
    let raf = 0, last = 0;
    const tick = (now: number) => {
      if (now - last > 40) { last = now; setPhase((Math.max(0, now - start) / 1000) % 1); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  if (!on) return null;
  const spacing = 38;
  const count = Math.min(14, Math.ceil((maxX - CONE.x) / spacing));
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const r = (i + phase) * spacing + 6;
        const a = (48 * Math.PI) / 180;
        return (
          <path key={i} d={`M${CONE.x + r * Math.cos(a)} ${CONE.y - r * Math.sin(a)} A${r} ${r} 0 0 1 ${CONE.x + r * Math.cos(a)} ${CONE.y + r * Math.sin(a)}`}
            fill="none" stroke="var(--fis)" strokeWidth="1.6" opacity={Math.min(0.7, 26 / (r + 10))} />
        );
      })}
    </g>
  );
}

/** Sonómetro de mano sobre un trípode, con la rejilla del micrófono hacia el parlante. */
function SoundMeter({ x, text }: { x: number; text: string }) {
  return (
    <g>
      <path d={`M${x} 404 L${x - 18} ${BENCH_Y - 1} M${x} 404 L${x + 18} ${BENCH_Y - 1} M${x} 404 L${x} ${BENCH_Y - 1}`} stroke="#3b4648" strokeWidth="2" />
      <ContactShadow x={x - 22} y={BENCH_Y} w={44} h={6} />
      <g filter="url(#kit-shadow-soft)">
        <rect x={x - 22} y={316} width={44} height={88} rx={8} fill="url(#kit-body-dark)" />
      </g>
      <rect x={x - 4} y={300} width={8} height={18} fill="#3b4648" />
      <circle cx={x} cy={CONE.y} r={7} fill="#59636a" stroke="#1f2628" strokeWidth="0.8" />
      <circle cx={x - 2} cy={CONE.y - 2} r={2} fill="#fff" opacity="0.25" />
      <Lcd x={x - 19} y={326} w={38} h={22} text={text} />
      <text x={x} y={362} textAnchor="middle" style={{ fontSize: 7.5, fill: '#c9d2d5', fontWeight: 700 }}>dB · Z</text>
      <text x={x} y={392} textAnchor="middle" style={{ fontSize: 6.5, fill: '#9aa6aa', letterSpacing: 0.6 }}>SONÓMETRO</text>
    </g>
  );
}

/** Parlante de caja sobre un soporte. */
const SpeakerBox = memo(function SpeakerBox() {
  const { x, y, w, h } = SPK;
  return (
    <g>
      <rect x={x + w / 2 - 3} y={y + h} width={6} height={BENCH_Y - y - h} fill="url(#kit-metal-h)" />
      <ContactShadow x={x} y={BENCH_Y} w={w} h={7} />
      <rect x={x + 4} y={BENCH_Y - 6} width={w - 8} height={6} rx={2} fill="url(#kit-body-dark)" />
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={w} height={h} rx={4} fill="url(#kit-wood)" stroke="#8f6f3a" />
      </g>
      <rect x={x + w - 6} y={y + 6} width={6} height={h - 12} fill="#2a2f32" />
      <ellipse cx={CONE.x - 2} cy={CONE.y} rx={4} ry={22} fill="url(#son-cone)" stroke="#111" strokeWidth="0.6" />
      <text x={x + w / 2} y={y - 6} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink)', fontWeight: 700 }}>Parlante</text>
    </g>
  );
});

/** Cinta métrica sobre la mesa, con el cero en el cono del parlante. */
const Tape = memo(function Tape() {
  const x0 = CONE.x, y = BENCH_Y - 14;
  return (
    <g>
      <rect x={x0 - 4} y={y} width={4.1 * PXM + 8} height={13} rx={2} fill="#f2d24c" stroke="#b39422" strokeWidth="0.6" filter="url(#kit-shadow-soft)" />
      {Array.from({ length: 41 }, (_, i) => {
        const x = x0 + (i / 10) * PXM, major = i % 5 === 0;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y} y2={y + (major ? 7 : 4)} stroke="#3a2f0b" strokeWidth={major ? 1 : 0.6} />
            {major && <text x={x} y={y + 12} textAnchor="middle" style={{ fontSize: 6.5, fill: '#3a2f0b', fontFamily: 'var(--font-data)' }}>{fmt(i / 10, 1)}</text>}
          </g>
        );
      })}
      <text x={x0 + 4.1 * PXM + 2} y={y - 3} textAnchor="end" style={{ fontSize: 7.5, fill: 'var(--ink-2)' }}>m</text>
    </g>
  );
});

/** Mazo de caucho apoyado en la mesa. */
const Mallet = memo(function Mallet({ x }: { x: number }) {
  return (
    <g>
      <ContactShadow x={x - 4} y={BENCH_Y} w={70} h={5} />
      <rect x={x} y={BENCH_Y - 6} width={52} height={4} rx={2} fill="url(#kit-wood)" stroke="#8f6f3a" strokeWidth="0.5" />
      <rect x={x + 48} y={BENCH_Y - 13} width={16} height={13} rx={5} fill="url(#son-rubber)" />
      <text x={x + 30} y={BENCH_Y - 18} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>mazo de caucho</text>
    </g>
  );
});

/* ------------------------------------------------------------------ laboratorio */

export default function SoundLab({ api }: LabProps) {
  const [exp, setExp] = useState<ExpId>('tubo');
  const [tubeType, setTubeType] = useState<TubeType>('cerrado');
  const [source, setSource] = useState<SourceId>('diapason');
  const [forkF, setForkF] = useState(512);
  const [genF, setGenF] = useState(512);
  const [temp, setTemp] = useState(28);
  const [diam, setDiam] = useState<number>(3.5);
  const [closedL, setClosedL] = useState(10);
  const [openL, setOpenL] = useState(40);
  const [tdivI, setTdivI] = useState(2); // 0,5 ms/div
  const [vdivI, setVdivI] = useState(2); // 10 mV/div
  const [dist, setDist] = useState(1);
  const [powerId, setPowerId] = useState<SpeakerPowerId>('media');
  const [phase, setPhase] = useState<Phase>('listo');
  const [shot, setShot] = useState(0);
  const [strikeAt, setStrikeAt] = useState<number | null>(null);
  const [genOn, setGenOn] = useState(false);
  const [marks, setMarks] = useState<{ L1: number | null; L2: number | null }>({ L1: null, L2: null });
  const [scan, setScan] = useState<{ x: number; y: number }[]>([]);
  const [distScan, setDistScan] = useState<{ x: number; y: number }[]>([]);

  const snd = useLabSound();
  const synth = useRef<ToneSynth | null>(null);
  if (!synth.current) synth.current = new ToneSynth();

  const isTube = exp === 'tubo';
  const src: SourceId = isTube ? source : 'generador';
  const f = src === 'diapason' ? forkF : genF;
  const L = tubeType === 'cerrado' ? closedL : openL;
  const tdiv = SCOPE.timePerDiv[tdivI];
  const vdiv = SCOPE.voltsPerDiv[vdivI];
  const power = SPEAKER_POWERS.find((p) => p.id === powerId) ?? SPEAKER_POWERS[1];
  const tw = tubeW(diam);

  /* --------------------------- modelo */
  const tube = useMemo(() => tubeResponse({ f, tempC: temp, lengthCm: L, diameterCm: diam, type: tubeType, source: src }), [f, temp, L, diam, tubeType, src]);
  const freeMic = useMemo(() => freeFieldMicMv(power.watts, dist, temp), [power.watts, dist, temp]);
  const levelDb = useMemo(() => soundLevel(power.watts, dist), [power.watts, dist]);
  const micTrue = isTube ? tube.micMv : freeMic;
  const note = useMemo(() => nearestNote(f), [f]);

  // Instrumentos: ficha de la práctica si está integrada; si no, la del modelo.
  const spec = (id: string) => INSTRUMENTS.sonido?.find((i) => i.id === id) ?? SOUND_INSTRUMENTS.find((i) => i.id === id)!;
  const reglaSpec = spec('regla'), oscSpec = spec('osciloscopio'), meterSpec = spec('sonometro'), tapeSpec = spec('cinta');
  const { measure, deviation, remeasure } = useMeasure();
  const readings = useMemo(() => {
    // En modo real, la fuerza del golpe del diapasón varía un 5 % de un golpe a otro.
    const mic = micTrue * (1 + (isTube && src === 'diapason' ? deviation('golpe', 0.05) : 0));
    const view = scopeView(f, mic, tdiv, vdiv);
    const span = view.n >= 1 ? measure(view.spanMs, { resolution: view.timeRes, sigma: (oscSpec.sigma ?? 0.1) * tdiv, key: 'periodo' }) : null;
    const periodMs = span !== null && view.n >= 1 ? span / view.n : null;
    return {
      length: measure(L, { ...reglaSpec, key: 'regla' }),
      amp: view.clipped ? null : measure(mic, { resolution: view.voltRes, sigma: (oscSpec.sigma ?? 0.1) * vdiv, key: 'microfono', nonNegative: true }),
      periodMs,
      freq: periodMs ? 1000 / periodMs : null,
      n: view.n,
      ampDec: decimalsFor(view.voltRes),
      periodDec: view.n >= 1 ? decimalsFor(view.timeRes / view.n) : 2,
      dist: measure(dist, { ...tapeSpec, key: 'cinta' }),
      level: measure(levelDb, { ...meterSpec, key: 'sonometro' }),
    };
  }, [micTrue, isTube, src, deviation, f, tdiv, vdiv, measure, oscSpec, reglaSpec, tapeSpec, meterSpec, L, dist, levelDb]);

  /* --------------------------- fases */
  useEffect(() => { setPhase('listo'); }, [exp, tubeType, source, forkF, genF, temp, diam, L, tdivI, vdivI, dist, powerId]);
  const condKey = `${exp}|${tubeType}|${src}|${f}|${temp}|${diam}`;
  useEffect(() => { setScan([]); setMarks({ L1: null, L2: null }); }, [condKey]);
  useEffect(() => { setDistScan([]); }, [genF, powerId, temp]);
  const done = phase === 'medido';

  /* --------------------------- sonido (Web Audio) sincronizado con el osciloscopio */
  const canPlay = snd.supported && snd.enabled && snd.visible;
  const level = playbackLevel(micTrue);
  useEffect(() => { synth.current?.setVolume(snd.volume); }, [snd.volume]);
  useEffect(() => { synth.current?.setLevel(level); }, [level]);
  useEffect(() => { synth.current?.setFrequency(f); }, [f]);
  useEffect(() => { if (!snd.enabled || !snd.visible) synth.current?.stopAll(); }, [snd.enabled, snd.visible]);
  useEffect(() => { if (!snd.visible) { setGenOn(false); setStrikeAt(null); } }, [snd.visible]);
  useEffect(() => () => synth.current?.dispose(), []);
  // Al cambiar de experimento o de fuente, silencio.
  useEffect(() => { synth.current?.stopAll(); setGenOn(false); setStrikeAt(null); }, [exp, source]);
  // El diapasón deja de sonar (y de verse en el osciloscopio) al cabo de FORK_RING_S.
  useEffect(() => {
    if (strikeAt === null) return;
    const id = window.setTimeout(() => setStrikeAt(null), FORK_RING_S * 1000);
    return () => window.clearTimeout(id);
  }, [strikeAt]);
  // Si cambia la frecuencia del diapasón mientras suena, se silencia (es otro diapasón).
  useEffect(() => { synth.current?.stopFork(); setStrikeAt(null); }, [forkF]);

  const strike = () => {
    if (canPlay) synth.current?.strike(forkF, level);
    setStrikeAt(performance.now());
  };
  const setGenerator = (on: boolean) => {
    if (on) { if (canPlay) synth.current?.startGenerator(f, level); } else synth.current?.stopGenerator();
    setGenOn(on);
  };
  const stopSound = () => { synth.current?.stopAll(); setGenOn(false); setStrikeAt(null); };
  const sounding = genOn || strikeAt !== null;

  const measureNow = () => {
    if (src === 'diapason') strike();
    else if (!genOn) setGenerator(true);
    remeasure(...(isTube ? ['regla', 'microfono', 'periodo', 'golpe'] : ['cinta', 'sonometro', 'microfono', 'periodo']));
    setPhase('medido');
    setShot((s) => s + 1);
  };
  // Cada medición agrega un punto a la curva del estudiante (con las lecturas ya actualizadas).
  useEffect(() => {
    if (shot === 0) return;
    if (isTube) { if (readings.amp !== null) setScan((s) => [...s.slice(-199), { x: readings.length, y: readings.amp as number }]); }
    else setDistScan((s) => [...s.slice(-199), { x: readings.dist, y: readings.level }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  /* --------------------------- resonancias marcadas por el estudiante */
  const analysis = useMemo(() => {
    if (marks.L1 === null || marks.L2 === null || !(marks.L2 > marks.L1)) return null;
    return analyzeResonances(marks.L1, marks.L2, f, tubeType);
  }, [marks, f, tubeType]);
  const vModel = speedOfSound(temp);

  /* --------------------------- registro */
  const tubeName = tubeType === 'cerrado' ? 'Cerrado (agua)' : 'Abierto';
  const record = () => {
    if (isTube) {
      api.addTrial('barrido', {
        tubo: tubeName, fuente: SOURCE_LABEL[src], frecuencia: f, temperatura: temp, diametro: diam, longitud: readings.length,
        tiempoDiv: tdiv, voltsDiv: vdiv, periodo: readings.periodMs === null ? null : Number(readings.periodMs.toFixed(4)),
        frecuenciaMedida: readings.freq === null ? null : Number(readings.freq.toFixed(1)), amplitud: readings.amp,
      });
    } else {
      api.addTrial('distancia', {
        frecuencia: f, potencia: power.watts * 1000, distancia: readings.dist, nivel: readings.level,
        intensidad: Number((levelToIntensity(readings.level) * 1e6).toFixed(4)), amplitud: readings.amp,
        inversoCuadrado: Number((1 / readings.dist ** 2).toFixed(4)),
      });
    }
  };
  const recordResonances = () => {
    if (!analysis || marks.L1 === null || marks.L2 === null) return;
    api.addTrial('resonancias', {
      tubo: tubeName, fuente: SOURCE_LABEL[src], frecuencia: f, temperatura: temp, diametro: diam, L1: marks.L1, L2: marks.L2,
      deltaL: Number(analysis.deltaLcm.toFixed(2)), lambda: Number(analysis.lambdaM.toFixed(4)), rapidez: Number(analysis.speed.toFixed(1)),
      correccion: Number(analysis.endCorrectionCm.toFixed(2)), rapidezModelo: Number(vModel.toFixed(1)),
    });
  };

  /* --------------------------- textos */
  const show = (t: string) => (done ? t : '—');
  const ampText = readings.amp === null ? 'fuera de la pantalla: aumenta los mV/div' : `${fmt(readings.amp, readings.ampDec)} mV`;
  const periodText = readings.periodMs === null ? 'no cabe un periodo: aumenta los ms/div' : `${fmt(readings.periodMs, readings.periodDec)} ms`;
  const freqText = readings.freq === null ? '—' : `${fmt(readings.freq, 1)} Hz`;
  const centsText = `${note.cents >= 0 ? '+' : '−'}${fmt(Math.abs(note.cents), 0)} cents`;

  // Geometría dependiente del montaje.
  const mouthY = isTube ? (tubeType === 'cerrado' ? TOP : TUBE_BOTTOM - L * S) : TOP;
  const waterY = TOP + closedL * S;
  const corr = 0.6 * (diam / 2);
  const armY = mouthY - (src === 'diapason' ? 86 : 60);
  const micPos = { x: TX + tw / 2 + 10, y: mouthY - 8 };
  const scaleX = TX + tw / 2 + 6;
  const meterX = xAtD(dist);
  const strength = Math.min(1, tube.response / 25);

  const desc = isTube
    ? `${tubeType === 'cerrado' ? `Tubo de vidrio de 100 cm cerrado por agua; columna de aire de ${fmt(L, 1)} cm` : `Tubo telescópico abierto en los dos extremos de ${fmt(L, 1)} cm`}, diámetro interno ${fmt(diam, 1)} cm, aire a ${fmt(temp, 1)} °C. Fuente: ${src === 'diapason' ? `diapasón de ${fmtF(f)} Hz` : `parlante con el generador a ${fmt(f, 0)} Hz`}${sounding ? ', sonando' : ', en silencio'}. Micrófono en la boca conectado al osciloscopio (${fmt(tdiv, 1)} ms/div, ${fmt(vdiv, 0)} mV/div).${done ? ` Lecturas: ${ampText} de amplitud, periodo ${periodText}.` : ''}`
    : `Parlante con el generador a ${fmt(f, 0)} Hz (${power.name.toLowerCase()})${genOn ? ', sonando' : ', apagado'}; sonómetro a ${fmt(dist, 2)} m sobre una cinta métrica, conectado al osciloscopio.${done ? ` Nivel sonoro: ${fmt(readings.level, 1)} dB; amplitud ${ampText}.` : ''}`;

  const hint = isTube
    ? (tubeType === 'cerrado'
      ? 'Arrastra el depósito de agua (a la izquierda) para subir o bajar el agua del tubo; gira las perillas del osciloscopio. También puedes enfocarlos con Tab y usar las flechas.'
      : 'Arrastra el borde superior del tubo deslizante para alargarlo o acortarlo; gira las perillas del osciloscopio. También puedes enfocarlos con Tab y usar las flechas.')
    : 'Arrastra el sonómetro sobre la cinta para alejarlo o acercarlo al parlante; gira las perillas del osciloscopio y del generador. También puedes usar Tab y las flechas.';

  const resPoints = scan;
  const distPoints = distScan;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo: sonido y resonancia">
          <ManipScene viewBox={VIEW} label="Controles del montaje de sonido" scene={
            <svg viewBox={VIEW} role="img" aria-labelledby="son-t son-d">
              <title id="son-t">{isTube ? 'Tubo de resonancia con fuente de sonido, micrófono, osciloscopio y generador de señales' : 'Parlante, sonómetro sobre una cinta métrica, osciloscopio y generador de señales'}</title>
              <desc id="son-d">{desc}</desc>
              <SoundDefs />
              <BenchTop y={BENCH_Y} width={W} />

              {isTube && (
                <g>
                  <Stand />
                  {/* depósito de agua (vasos comunicantes) */}
                  {tubeType === 'cerrado' && (
                    <g>
                      <path d={`M${RES_X} ${waterY + 36} C${RES_X} ${BENCH_Y + 2} ${TX} ${BENCH_Y + 4} ${TX} ${TUBE_BOTTOM + 8}`} fill="none" stroke="#35404a" strokeWidth="6" strokeLinecap="round" />
                      <path d={`M${RES_X} ${waterY + 36} C${RES_X} ${BENCH_Y + 2} ${TX} ${BENCH_Y + 4} ${TX} ${TUBE_BOTTOM + 8}`} fill="none" stroke="#7d8a92" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
                      <Clamp y={waterY + 8} x1={RES_X + 22} />
                      <rect x={RES_X - 22} y={waterY - 16} width={44} height={46} rx={5} fill="url(#kit-glass-fill)" />
                      <rect x={RES_X - 20} y={waterY} width={40} height={28} rx={3} fill="url(#son-water)" />
                      <path d={`M${RES_X - 20} ${waterY - 2} Q${RES_X - 18} ${waterY + 1} ${RES_X - 12} ${waterY + 1} L${RES_X + 12} ${waterY + 1} Q${RES_X + 18} ${waterY + 1} ${RES_X + 20} ${waterY - 2}`} fill="none" stroke="#2f6f9e" strokeWidth="1.3" />
                      <rect x={RES_X - 22} y={waterY - 16} width={44} height={46} rx={5} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
                      <rect x={RES_X - 5} y={waterY + 30} width={10} height={7} rx={2} fill="#35404a" />
                      <text x={RES_X} y={waterY - 22} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>depósito</text>
                    </g>
                  )}
                  {/* tubo */}
                  <Clamp y={TOP + 60} x1={TX - tw / 2 - 4} />
                  <Clamp y={TUBE_BOTTOM - 40} x1={TX - tw / 2 - 4} />
                  <TubeScale x={scaleX} fromBottom={tubeType === 'abierto'} />
                  {tubeType === 'cerrado' ? (
                    <g>
                      <Glass y0={TOP} y1={TUBE_BOTTOM} w={tw} />
                      <rect x={TX - tw / 2 + 2} y={waterY} width={tw - 4} height={TUBE_BOTTOM - waterY} fill="url(#son-water)" />
                      <path d={`M${TX - tw / 2 + 2} ${waterY - 2.4} Q${TX - tw / 2 + 4} ${waterY + 1} ${TX - tw / 2 + 8} ${waterY + 1} L${TX + tw / 2 - 8} ${waterY + 1} Q${TX + tw / 2 - 4} ${waterY + 1} ${TX + tw / 2 - 2} ${waterY - 2.4}`} fill="none" stroke="#2f6f9e" strokeWidth="1.4" />
                      {sounding && <StandingWave y0={TOP} y1={waterY} w={tw} k={tube.k} endCm={corr} type="cerrado" strength={strength} strikeAt={strikeAt} genOn={genOn} />}
                      <Glass y0={TOP} y1={TUBE_BOTTOM} w={tw} front />
                      <rect x={TX - 8} y={TUBE_BOTTOM} width={16} height={8} rx={2} fill="#35404a" />
                    </g>
                  ) : (
                    <g>
                      <Glass y0={mouthY} y1={TUBE_BOTTOM - 6} w={tw - 6} />
                      {sounding && <StandingWave y0={mouthY} y1={TUBE_BOTTOM} w={tw} k={tube.k} endCm={corr} type="abierto" strength={strength} strikeAt={strikeAt} genOn={genOn} />}
                      <Glass y0={mouthY} y1={TUBE_BOTTOM - 6} w={tw - 6} front />
                      <Glass y0={TUBE_BOTTOM - 20 * S} y1={TUBE_BOTTOM} w={tw} />
                      <Glass y0={TUBE_BOTTOM - 20 * S} y1={TUBE_BOTTOM} w={tw} front />
                      <rect x={TX - tw / 2 + 1} y={mouthY - 2} width={tw - 2} height={5} rx={2} fill="var(--fis)" opacity="0.85" />
                    </g>
                  )}
                  <TubeGrip y={TOP + 60} w={tw} />
                  <TubeGrip y={TUBE_BOTTOM - 40} w={tw} />
                  {/* cota de la columna de aire */}
                  {(() => {
                    const y0 = tubeType === 'cerrado' ? TOP : mouthY, y1 = tubeType === 'cerrado' ? waterY : TUBE_BOTTOM;
                    const x = TX - tw / 2 - 22;
                    return (
                      <g>
                        <line x1={x} x2={x} y1={y0 + 1} y2={y1 - 1} stroke="var(--data)" strokeWidth="1.1" markerStart="url(#son-arrow)" markerEnd="url(#son-arrow)" />
                        <text x={x - 4} y={(y0 + y1) / 2 + 3} textAnchor="end" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>L {fmt(L, 1)}</text>
                      </g>
                    );
                  })()}
                  {/* fuente sobre la boca */}
                  <Clamp y={armY} x1={TX + 3} />
                  {src === 'diapason'
                    ? <Fork x={TX} yTip={mouthY - 10} f={f} strikeAt={strikeAt} />
                    : (
                      <g>
                        <rect x={TX - 2} y={armY} width={4} height={mouthY - 34 - armY} fill="url(#kit-metal-h)" />
                        <SpeakerDown x={TX} y={mouthY - 14} on={genOn} />
                        <path d={`M${TX + 16} ${mouthY - 26} C${TX + 120} ${mouthY - 40} ${GEN.x - 60} ${GEN.y + 60} ${GEN.x} ${GEN.y + 60}`} fill="none" stroke="#2f3a3d" strokeWidth="2" />
                      </g>
                    )}
                  <Mic x={micPos.x} y={micPos.y} />
                  <path d={`M${micPos.x + 22} ${micPos.y + 12} C${micPos.x + 70} ${micPos.y + 60} ${JACK.x - 120} ${BENCH_Y - 4} ${JACK.x - 40} ${BENCH_Y - 3} Q${JACK.x - 8} ${BENCH_Y - 3} ${JACK.x} ${JACK.y + 7}`} fill="none" stroke="#2f3a3d" strokeWidth="2" />
                  <g>
                    <text x={350} y={140} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>aire</text>
                    <Thermometer x={350} y={150} h={170} min={0} max={40} value={temp} />
                    <text x={350} y={338} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{fmt(temp, 1)} °C</text>
                  </g>
                  {src === 'diapason' && <Mallet x={392} />}
                  <text x={TX} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>{TUBE_LABEL[tubeType]} · Ø {fmt(diam, 1)} cm</text>
                </g>
              )}

              {!isTube && (
                <g>
                  <path d={`M${GEN.x} ${GEN.y + 60} C${GEN.x - 200} ${GEN.y + 60} ${SPK.x + 140} ${SPK.y - 60} ${SPK.x + SPK.w / 2} ${SPK.y}`} fill="none" stroke="#2f3a3d" strokeWidth="2" />
                  <Tape />
                  <Wavefronts on={genOn} maxX={meterX + 40} />
                  <SpeakerBox />
                  <path d={`M${meterX} 404 C${meterX} 446 ${JACK.x - 60} ${BENCH_Y - 3} ${JACK.x - 20} ${BENCH_Y - 3} Q${JACK.x} ${BENCH_Y - 3} ${JACK.x} ${JACK.y + 7}`} fill="none" stroke="#2f3a3d" strokeWidth="2" />
                  <SoundMeter x={meterX} text={done ? fmt(readings.level, 1) : '- - -'} />
                  <line x1={CONE.x + 1} x2={meterX - 8} y1={CONE.y + 40} y2={CONE.y + 40} stroke="var(--data)" strokeWidth="1.1" markerStart="url(#son-arrow)" markerEnd="url(#son-arrow)" />
                  <text x={(CONE.x + meterX) / 2} y={CONE.y + 34} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>d {fmt(dist, 2)} m</text>
                </g>
              )}

              <Generator f={f} on={genOn} active={src === 'generador'} />
              <Scope f={f} micMv={micTrue} tdiv={tdiv} vdiv={vdiv} strikeAt={strikeAt} genOn={genOn}
                reading={done ? { n: readings.n, periodMs: readings.periodMs, ampMv: readings.amp } : null} />
            </svg>
          }>
            {isTube && tubeType === 'cerrado' && (
              <Plunger label="Depósito de agua: columna de aire del tubo" value={closedL} min={SOUND_LIMITS.closedLength[0]} max={SOUND_LIMITS.closedLength[1]} step={0.1} pageStep={1}
                unit="cm" decimals={1} valueText={(v) => `columna de aire de ${fmt(v, 1)} cm`}
                from={{ x: RES_X, y: TOP + SOUND_LIMITS.closedLength[0] * S + 6 }} to={{ x: RES_X, y: TOP + SOUND_LIMITS.closedLength[1] * S + 6 }} size={46}
                onChange={setClosedL} />
            )}
            {isTube && tubeType === 'abierto' && (
              <Plunger label="Tubo deslizante: longitud del tubo abierto" value={openL} min={SOUND_LIMITS.openLength[0]} max={SOUND_LIMITS.openLength[1]} step={0.1} pageStep={1}
                unit="cm" decimals={1} valueText={(v) => `tubo de ${fmt(v, 1)} cm`}
                from={{ x: TX, y: TUBE_BOTTOM - SOUND_LIMITS.openLength[0] * S }} to={{ x: TX, y: TUBE_BOTTOM - SOUND_LIMITS.openLength[1] * S }} size={30}
                onChange={setOpenL} />
            )}
            {!isTube && (
              <Plunger label="Sonómetro sobre la cinta: distancia al parlante" value={dist} min={SOUND_LIMITS.distance[0]} max={SOUND_LIMITS.distance[1]} step={0.05} pageStep={0.25}
                unit="m" decimals={2} valueText={(v) => `${fmt(v, 2)} m del parlante`}
                from={{ x: xAtD(SOUND_LIMITS.distance[0]), y: 360 }} to={{ x: xAtD(SOUND_LIMITS.distance[1]), y: 360 }} size={46}
                onChange={setDist} />
            )}
            <Knob label="Perilla TIEMPO/DIV del osciloscopio" cx={KNOB_X} cy={SC.y + 64} r={15} value={tdivI} min={0} max={SCOPE.timePerDiv.length - 1} step={1} pageStep={1}
              valueText={(v) => `${fmt(SCOPE.timePerDiv[v], 1)} ms por división`} onChange={setTdivI} />
            <Knob label="Perilla VOLTS/DIV del osciloscopio" cx={KNOB_X} cy={SC.y + 152} r={15} value={vdivI} min={0} max={SCOPE.voltsPerDiv.length - 1} step={1} pageStep={1}
              valueText={(v) => `${fmt(SCOPE.voltsPerDiv[v], 0)} mV por división`} onChange={setVdivI} />
            {src === 'generador' && (
              <Knob label="Perilla de frecuencia del generador" cx={GEN.x + 236} cy={GEN.y + 40} r={14} value={genF} min={SOUND_LIMITS.generatorFrequency[0]} max={SOUND_LIMITS.generatorFrequency[1]} step={1} pageStep={10}
                valueText={(v) => `${fmt(v, 0)} Hz`} onChange={setGenF} />
            )}
          </ManipScene>
        </div>
        <ManipHint>{hint}</ManipHint>

        <div className="grid-2">
          <div className="stack">
            <h3>{isTube ? 'Lecturas: regla y osciloscopio' : 'Lecturas: sonómetro y osciloscopio'}</h3>
            {isTube ? (
              <Readout items={[
                { k: 'Longitud de la columna de aire (regla)', v: show(`${fmt(readings.length, 1)} cm`), data: true },
                { k: 'Amplitud del micrófono (osciloscopio)', v: show(ampText), data: true },
                { k: 'Periodo (osciloscopio)', v: show(periodText), data: true },
                { k: 'Frecuencia medida (1/T)', v: show(freqText), data: true },
              ]} />
            ) : (
              <Readout items={[
                { k: 'Distancia al parlante (cinta)', v: show(`${fmt(readings.dist, 2)} m`), data: true },
                { k: 'Nivel sonoro (sonómetro)', v: show(`${fmt(readings.level, 1)} dB`), data: true },
                { k: 'Intensidad calculada (I₀·10^(L/10))', v: show(`${sci(levelToIntensity(readings.level))} W/m²`) },
                { k: 'Amplitud del micrófono (osciloscopio)', v: show(ampText), data: true },
                { k: 'Periodo (osciloscopio)', v: show(periodText), data: true },
              ]} />
            )}
          </div>
          <div className="stack">
            <h3>Fuente y altura del sonido</h3>
            <Readout live={false} items={[
              { k: 'Fuente', v: src === 'diapason' ? `Diapasón de ${fmtF(f)} Hz` : `Generador a ${fmt(f, 0)} Hz` },
              { k: 'Nota más cercana (La₄ = 440 Hz)', v: `${note.name} ${centsText}` },
              { k: 'Octavas por encima de 256 Hz', v: fmt(octavesAbove(f), 2) },
              { k: 'Temperatura del aire (termómetro)', v: `${fmt(temp, 1)} °C` },
            ]} />
            <p className="small muted" style={{ margin: 0 }}>A mayor frecuencia, sonido más agudo: duplicar la frecuencia sube una octava. La amplitud cambia el volumen, no la altura.</p>
          </div>
        </div>

        {isTube ? (
          <>
            <Chart title="Curva de resonancia: tus lecturas" xLabel="Longitud de la columna de aire (cm)" yLabel="Amplitud del micrófono (mV)" xUnit="cm" yUnit="mV" height={230}
              exportName="curva-resonancia" xDomain={tubeType === 'cerrado' ? [0, 100] : [20, 100]}
              emptyText="Mide con distintas longitudes de la columna de aire: cada medición agrega un punto. Busca dónde la amplitud es máxima."
              series={[{ label: `${fmtF(f)} Hz · ${fmt(temp, 1)} °C · Ø ${fmt(diam, 1)} cm`, color: 'var(--series-1)', kind: 'scatter', points: resPoints }]} />
            <div className="card stack">
              <h3>Resonancias y rapidez del sonido</h3>
              <p className="small muted" style={{ margin: 0 }}>
                Cuando encuentres el máximo de amplitud más corto, mide y márcalo como L₁; luego busca el siguiente máximo y márcalo como L₂.
                Con dos resonancias sucesivas, λ = 2·(L₂ − L₁) sin necesidad de conocer la corrección del extremo.
              </p>
              <div className="btn-row">
                <button type="button" className="btn small" disabled={!done} onClick={() => setMarks((m) => ({ ...m, L1: readings.length }))}>Marcar como L₁</button>
                <button type="button" className="btn small" disabled={!done} onClick={() => setMarks((m) => ({ ...m, L2: readings.length }))}>Marcar como L₂</button>
                <button type="button" className="btn small ghost" disabled={marks.L1 === null && marks.L2 === null} onClick={() => setMarks({ L1: null, L2: null })}>Borrar marcas</button>
              </div>
              <Readout items={[
                { k: 'Primera resonancia L₁', v: marks.L1 === null ? 'sin marcar' : `${fmt(marks.L1, 1)} cm`, data: true },
                { k: 'Segunda resonancia L₂', v: marks.L2 === null ? 'sin marcar' : `${fmt(marks.L2, 1)} cm`, data: true },
                { k: 'Longitud de onda λ = 2·(L₂ − L₁)', v: analysis ? `${fmt(analysis.lambdaM, 3)} m` : '—' },
                { k: 'Rapidez del sonido v = λ·f', v: analysis ? `${fmt(analysis.speed, 1)} m/s` : '—' },
                { k: 'Corrección de extremo deducida', v: analysis ? `${fmt(analysis.endCorrectionCm, 2)} cm` : '—' },
                { k: tubeType === 'cerrado' ? 'Sin corregir el extremo (4·L₁·f)' : 'Sin corregir los extremos (2·L₁·f)', v: analysis ? `${fmt(analysis.speedNaive, 1)} m/s` : '—' },
              ]} />
              {marks.L1 !== null && marks.L2 !== null && !analysis && <Notice kind="warn">L₂ debe ser mayor que L₁: marca primero la resonancia más corta.</Notice>}
              {analysis && (
                <Notice kind="info">
                  Modelo a {fmt(temp, 1)} °C: v = 331,3·√(1 + T/273,15) = {fmt(vModel, 1)} m/s. Tu resultado difiere en {fmt((Math.abs(analysis.speed - vModel) / vModel) * 100, 1)} %.
                  La corrección esperada es 0,6·r = {fmt(corr, 2)} cm {tubeType === 'abierto' ? 'en cada extremo' : ''}.
                </Notice>
              )}
              <RecordButton onRecord={recordResonances} disabled={!analysis} label="Guardar L₁ y L₂ en la tabla" />
            </div>
          </>
        ) : (
          <Chart title="Nivel sonoro contra distancia: tus lecturas" xLabel="Distancia al parlante (m)" yLabel="Nivel sonoro (dB)" xUnit="m" yUnit="dB" height={230}
            exportName="nivel-distancia" xDomain={[0, 4]}
            emptyText="Mide a varias distancias (por ejemplo 0,5 m, 1 m, 2 m y 4 m) y compara cuánto baja el nivel cada vez que la distancia se duplica."
            series={[{ label: `${fmt(f, 0)} Hz · ${power.name.toLowerCase()}`, color: 'var(--series-2)', kind: 'scatter', points: distPoints }]} />
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Segmented<ExpId> label="Experimento" value={exp} onChange={setExp}
            options={(['tubo', 'distancia'] as ExpId[]).map((e) => ({ value: e, label: EXP_LABEL[e] }))} />
          {isTube && (
            <>
              <Segmented<TubeType> label="Tipo de tubo" value={tubeType} onChange={setTubeType}
                options={[{ value: 'cerrado', label: TUBE_LABEL.cerrado }, { value: 'abierto', label: TUBE_LABEL.abierto }]} />
              <Segmented<SourceId> label="Fuente de sonido" value={source} onChange={setSource}
                options={[{ value: 'diapason', label: SOURCE_LABEL.diapason }, { value: 'generador', label: SOURCE_LABEL.generador }]} />
              {source === 'diapason' && (
                <Select label="Frecuencia del diapasón" value={String(forkF)} onChange={(v) => setForkF(Number(v))}
                  options={FORKS.map((k) => ({ value: String(k.f), label: `${fmtF(k.f)} Hz · ${k.name}` }))} />
              )}
              {tubeType === 'cerrado'
                ? <Slider label="Longitud de la columna de aire" value={closedL} min={SOUND_LIMITS.closedLength[0]} max={SOUND_LIMITS.closedLength[1]} step={0.1} unit="cm" decimals={1} onChange={setClosedL}
                    hint="Desde la boca del tubo hasta la superficie del agua." />
                : <Slider label="Longitud del tubo abierto" value={openL} min={SOUND_LIMITS.openLength[0]} max={SOUND_LIMITS.openLength[1]} step={0.1} unit="cm" decimals={1} onChange={setOpenL} />}
              <Select label="Diámetro interno del tubo" value={String(diam)} onChange={(v) => setDiam(Number(v))}
                options={TUBE_DIAMETERS.map((d) => ({ value: String(d), label: `${fmt(d, 1)} cm` }))} />
            </>
          )}
          {(!isTube || source === 'generador') && (
            <Slider label="Frecuencia del generador" value={genF} min={SOUND_LIMITS.generatorFrequency[0]} max={SOUND_LIMITS.generatorFrequency[1]} step={1} unit="Hz" decimals={0} onChange={setGenF} />
          )}
          {!isTube && (
            <>
              <Slider label="Distancia del sonómetro al parlante" value={dist} min={SOUND_LIMITS.distance[0]} max={SOUND_LIMITS.distance[1]} step={0.05} unit="m" decimals={2} onChange={setDist} />
              <Select label="Potencia acústica del parlante" value={powerId} onChange={(v) => setPowerId(v as SpeakerPowerId)}
                options={SPEAKER_POWERS.map((p) => ({ value: p.id, label: p.name }))} />
            </>
          )}
          <Slider label="Temperatura del aire" value={temp} min={SOUND_LIMITS.temperature[0]} max={SOUND_LIMITS.temperature[1]} step={0.5} unit="°C" decimals={1} onChange={setTemp}
            hint="Apartadó: unos 28 °C; Medellín: unos 22 °C; Bogotá: unos 14 °C." />
        </div>

        <div className="card stack">
          <h3>Sonido y medición</h3>
          <div className="btn-row">
            {src === 'diapason'
              ? <button type="button" className="btn" onClick={strike}>Golpear el diapasón</button>
              : <button type="button" className="btn" aria-pressed={genOn} onClick={() => setGenerator(!genOn)}>{genOn ? 'Apagar el generador' : 'Encender el generador'}</button>}
            <button type="button" className="btn ghost" disabled={!sounding} onClick={stopSound}>Detener el sonido</button>
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={measureNow}>{isTube ? 'Medir con la regla y el osciloscopio' : 'Medir con el sonómetro y el osciloscopio'}</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
          {!snd.supported
            ? <Notice kind="warn">Este navegador no puede reproducir los tonos: guíate por el osciloscopio, que muestra la misma información.</Notice>
            : !snd.enabled
              ? <Notice kind="warn">El sonido del laboratorio está desactivado (botón «Sonido» del encabezado). El osciloscopio muestra lo mismo que se oiría.</Notice>
              : <p className="small muted" style={{ margin: 0 }}>Los tonos suenan a bajo volumen y solo después de pulsar un botón. Lo que oyes es lo que muestra el osciloscopio: su amplitud crece en la resonancia.</p>}
          {!toneSupported() && snd.supported && <p className="small muted" style={{ margin: 0 }}>Los tonos no están disponibles en este navegador.</p>}
        </div>

        <div className="card stack">
          <h3>Osciloscopio</h3>
          <Select label="Base de tiempo del osciloscopio" value={String(tdivI)} onChange={(v) => setTdivI(Number(v))}
            options={SCOPE.timePerDiv.map((t, i) => ({ value: String(i), label: `${fmt(t, 1)} ms/div` }))} />
          <Select label="Sensibilidad vertical del osciloscopio" value={String(vdivI)} onChange={(v) => setVdivI(Number(v))}
            options={SCOPE.voltsPerDiv.map((t, i) => ({ value: String(i), label: `${fmt(t, 0)} mV/div` }))} />
          <p className="small muted" style={{ margin: 0 }}>
            Periodo: cuenta las divisiones de un ciclo (o de varios) y multiplícalas por los ms/div. Amplitud: divisiones desde el centro hasta la cresta por los mV/div.
            Si la señal se sale de la pantalla, aumenta los mV/div.
          </p>
        </div>
      </div>
    </div>
  );
}

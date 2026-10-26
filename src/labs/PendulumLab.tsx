import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzePeriod, angleAt, BOBS, bobRadius, DAMPINGS, findBob, findPlace, OSCILLATIONS_TIMED, PEN_LIMITS,
  photogatePeriod, PLACES, REACTION_ERROR, simulatePendulum, stopwatchTenOscillations,
} from '../models/pendulum';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, resolutionText } from '../components/ui';
import { SimControls, simStatusOf } from '../components/Experiment';
import type { LabProps } from './registry';
import { usePublishModel } from '../components/Advanced';
import { BenchTop, Lcd, shade, Stopwatch } from './kit';
import { clockAngle, DragHandle, ManipHint, ManipScene } from './manipulate';

type AnimSpeed = 'real' | 'x4';
type RunMode = 'libre' | 'cronometro' | 'fotopuerta';
interface Measurement { kind: 'cronometro' | 'fotopuerta'; t10: number | null; period: number; startAt: number; stopAt: number; }

/* ------------------------------------------------------------------ geometría del banco */

const PX = 330; // punto de suspensión
const PY = 46;
const PX_PER_M = 124;
const BENCH_Y = 352;
const STAND_X = 60;
const RULER_X = PX - 84;
const GRAPH = { x: 594, y: 206, w: 152, h: 112 };

const toRad = (d: number) => (d * Math.PI) / 180;

/** Degradados propios: brillo de cada material de lenteja, aceite y plástico del transportador. */
const PendulumDefs = memo(function PendulumDefs() {
  return (
    <defs>
      {BOBS.map((b) => (
        <radialGradient key={b.id} id={`pen-bob-${b.id}`} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity={b.id === 'madera' || b.id === 'plastico' ? 0.55 : 0.95} />
          <stop offset="0.18" stopColor={shade(b.color, 0.35)} />
          <stop offset="0.65" stopColor={b.color} />
          <stop offset="1" stopColor={shade(b.color, -0.45)} />
        </radialGradient>
      ))}
      <linearGradient id="pen-oil" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#e2b23a" />
        <stop offset="1" stopColor="#a8741a" />
      </linearGradient>
      <radialGradient id="pen-led" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff8a80" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ff5252" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
});

/** Soporte universal: base, varilla, nuez y brazo horizontal con la pinza de suspensión. */
const Stand = memo(function Stand() {
  return (
    <g aria-hidden="true">
      <g filter="url(#kit-shadow)">
        <path d={`M${STAND_X - 40} ${BENCH_Y} L${STAND_X + 92} ${BENCH_Y} L${STAND_X + 86} ${BENCH_Y - 12} L${STAND_X - 34} ${BENCH_Y - 12} Z`} fill="url(#kit-body-dark)" />
      </g>
      <rect x={STAND_X - 4} y={18} width={8} height={BENCH_Y - 26} rx={3} fill="url(#kit-metal-h)" stroke="#8d989c" strokeWidth="0.6" />
      <circle cx={STAND_X} cy={18} r={4.5} fill="url(#kit-metal)" stroke="#8d989c" strokeWidth="0.6" />
      {/* brazo horizontal */}
      <rect x={STAND_X} y={PY - 17} width={PX - STAND_X + 26} height={7} rx={3} fill="url(#kit-metal)" stroke="#8d989c" strokeWidth="0.6" />
      {/* nuez */}
      <g filter="url(#kit-shadow-soft)">
        <rect x={STAND_X - 11} y={PY - 25} width={22} height={22} rx={3} fill="url(#kit-body-dark)" />
        <rect x={STAND_X - 22} y={PY - 17} width={12} height={6} rx={2} fill="url(#kit-metal-h)" />
        <circle cx={STAND_X - 24} cy={PY - 14} r={4} fill="#2a3335" />
      </g>
      {/* pinza de suspensión */}
      <g filter="url(#kit-shadow-soft)">
        <rect x={PX - 14} y={PY - 22} width={28} height={16} rx={3} fill="url(#kit-body-dark)" />
        <rect x={PX - 3} y={PY - 7} width={6} height={8} rx={1.5} fill="url(#kit-metal-h)" />
      </g>
    </g>
  );
});

/** Transportador de plástico transparente con el punto de suspensión en su centro. */
function Protractor({ releaseDeg }: { releaseDeg: number }) {
  const R = 56;
  const ticks = useMemo(() => Array.from({ length: 19 }, (_, i) => -90 + i * 10), []);
  const rel = toRad(releaseDeg);
  return (
    <g aria-hidden="true">
      <path d={`M${PX - R} ${PY} A${R} ${R} 0 0 0 ${PX + R} ${PY} Z`} fill="#ffffff" opacity="0.28" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1" />
      {ticks.map((a) => {
        const r = toRad(a);
        const long = a % 30 === 0;
        return (
          <line key={a} x1={PX + (R - (long ? 9 : 5)) * Math.sin(r)} y1={PY + (R - (long ? 9 : 5)) * Math.cos(r)} x2={PX + R * Math.sin(r)} y2={PY + R * Math.cos(r)}
            stroke="var(--glass-print, #24454a)" strokeWidth={long ? 1 : 0.7} />
        );
      })}
      {[-60, -30, 30, 60].map((a) => (
        <text key={a} x={PX + (R - 16) * Math.sin(toRad(a))} y={PY + (R - 16) * Math.cos(toRad(a)) + 3} textAnchor="middle" style={{ fontSize: 7, fill: 'var(--glass-print, #24454a)', fontFamily: 'var(--font-data)' }}>{Math.abs(a)}</text>
      ))}
      {/* vertical y ángulo de liberación */}
      <line x1={PX} y1={PY} x2={PX} y2={PY + R + 8} stroke="var(--ink-2)" strokeWidth="0.8" strokeDasharray="2 2" />
      <line x1={PX} y1={PY} x2={PX + (R + 10) * Math.sin(rel)} y2={PY + (R + 10) * Math.cos(rel)} stroke="var(--fis)" strokeWidth="1.2" strokeDasharray="4 3" />
      <path d={`M${PX} ${PY + 24} A24 24 0 0 0 ${PX + 24 * Math.sin(rel)} ${PY + 24 * Math.cos(rel)}`} fill="none" stroke="var(--fis)" strokeWidth="1.4" />
      <text x={PX + 30 * Math.sin(rel / 2) + 4} y={PY + 30 * Math.cos(rel / 2) + 12} style={{ fontSize: 10, fill: 'var(--fis)', fontWeight: 700 }}>θ₀ = {fmt(releaseDeg, 0)}°</text>
    </g>
  );
}

/** Regla vertical de madera con el cero a la altura del punto de suspensión (divisiones de 1 cm). */
const VerticalRuler = memo(function VerticalRuler() {
  const len = 200; // cm
  const pxCm = PX_PER_M / 100;
  return (
    <g aria-hidden="true" filter="url(#kit-shadow-soft)">
      <rect x={RULER_X} y={PY - 6} width={24} height={len * pxCm + 12} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
      {Array.from({ length: len + 1 }, (_, c) => (
        c % 5 === 0 && (
          <line key={c} x1={RULER_X + 24} x2={RULER_X + 24 - (c % 10 === 0 ? 9 : 5)} y1={PY + c * pxCm} y2={PY + c * pxCm} stroke="#4d3b1c" strokeWidth={c % 10 === 0 ? 1 : 0.6} />
        )
      ))}
      {Array.from({ length: len / 20 + 1 }, (_, i) => i * 20).map((c) => (
        <text key={c} x={RULER_X + 3} y={PY + c * pxCm + 3} style={{ fontSize: 7.5, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{c}</text>
      ))}
      <text x={RULER_X + 12} y={PY + len * pxCm + 4} textAnchor="middle" style={{ fontSize: 6.5, fill: '#7a6334' }}>cm</text>
    </g>
  );
});

/** Recipiente con aceite junto al eje: una aleta solidaria al péndulo gira dentro del aceite. */
function OilDamper({ theta }: { theta: number }) {
  const w = 40, h = 26, x = PX - w / 2, y = PY - 4;
  return (
    <g aria-hidden="true">
      <path d={`M${x} ${y} L${x} ${y + h - 5} Q${x} ${y + h} ${x + 5} ${y + h} L${x + w - 5} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 5} L${x + w} ${y}`} fill="url(#kit-glass-fill)" />
      <rect x={x + 1.5} y={y + 7} width={w - 3} height={h - 8.5} rx={3} fill="url(#pen-oil)" opacity="0.8" />
      <g transform={`rotate(${(-theta * 180) / Math.PI} ${PX} ${PY})`}>
        <rect x={PX - 1} y={PY} width={2} height={10} fill="#5d6b70" />
        <rect x={PX - 7} y={PY + 9} width={14} height={11} rx={1.5} fill="#e8eef0" stroke="#5d6b70" strokeWidth="0.8" opacity="0.92" />
      </g>
      <path d={`M${x - 2} ${y - 1} L${x} ${y + 2} L${x} ${y + h - 5} Q${x} ${y + h} ${x + 5} ${y + h} L${x + w - 5} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 5} L${x + w} ${y + 2} L${x + w + 2} ${y - 1}`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      <text x={PX + w / 2 + 4} y={PY + 22} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>aceite</text>
    </g>
  );
}

/** Fotopuerta en el punto más bajo: brazo trasero con el emisor, brazo delantero de plástico ahumado. */
function PhotogateBack({ yb, r, blocked }: { yb: number; r: number; blocked: boolean }) {
  const h = 2 * r + 22, top = yb - h / 2;
  const rodX = PX + 96;
  return (
    <g aria-hidden="true">
      {/* varilla y brazo de soporte (detrás del plano de oscilación) */}
      <rect x={rodX - 3} y={yb - 4} width={6} height={BENCH_Y - yb - 4} fill="url(#kit-metal-h)" />
      <rect x={rodX - 16} y={BENCH_Y - 9} width={32} height={9} rx={2} fill="url(#kit-body-dark)" />
      <rect x={PX + 14} y={yb + h / 2 - 7} width={rodX - PX - 12} height={5} rx={2} fill="url(#kit-metal)" stroke="#8d989c" strokeWidth="0.5" />
      <g filter="url(#kit-shadow-soft)">
        <rect x={PX - 16} y={top} width={32} height={h} rx={5} fill="url(#kit-body-dark)" />
      </g>
      {blocked ? <circle cx={PX} cy={yb} r={2.6} fill="#ffd54a" /> : <><circle cx={PX} cy={yb} r={7} fill="url(#pen-led)" /><circle cx={PX} cy={yb} r={2.3} fill="#ff5252" /></>}
      <circle cx={PX + 10} cy={top + 6} r={1.8} fill={blocked ? '#ffd54a' : '#66bb6a'} />
    </g>
  );
}
function PhotogateFront({ yb, r }: { yb: number; r: number }) {
  const h = 2 * r + 22, top = yb - h / 2;
  return (
    <g aria-hidden="true">
      <rect x={PX - 16} y={top} width={32} height={h} rx={5} fill="#1d2729" opacity="0.18" stroke="#1d2729" strokeOpacity="0.55" strokeWidth="1" />
      <rect x={PX - 16} y={top + h - 6} width={32} height={6} rx={2} fill="#263033" opacity="0.85" />
      <text x={PX - 22} y={top + h + 2} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>fotopuerta</text>
    </g>
  );
}

/** Contador de la fotopuerta (modo período). */
function GateCounter({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={136} height={64} rx={8} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <Lcd x={x + 8} y={y + 8} w={120} h={28} text={text} unit="s" />
      <text x={x + 68} y={y + 52} textAnchor="middle" style={{ fontSize: 9.5, fill: '#3a4644', fontWeight: 700 }}>FOTOPUERTA · PERÍODO</text>
    </g>
  );
}

export default function PendulumLab({ api }: LabProps) {
  const [length, setLength] = useState(1);
  const [massG, setMassG] = useState(100);
  const [amplitude, setAmplitude] = useState(10);
  const [bobId, setBobId] = useState('acero');
  const [placeId, setPlaceId] = useState('apartado');
  const [dampingId, setDampingId] = useState('aire');
  const [speed, setSpeed] = useState<AnimSpeed>('real');
  const [mode, setMode] = useState<RunMode>('libre');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [released, setReleased] = useState(false);
  const [meas, setMeas] = useState<Measurement | null>(null);
  const [done, setDone] = useState(false);
  const seedRef = useRef(0);
  const raf = useRef(0);

  const input = useMemo(() => ({ length, massG, amplitudeDeg: amplitude, placeId, dampingId }), [length, massG, amplitude, placeId, dampingId]);
  const run = useMemo(() => simulatePendulum(input), [input]);
  const bob = findBob(bobId);
  const place = findPlace(placeId);
  const rPx = Math.max(6, Math.min(18, 4 + bobRadius(massG, bob.density) * 400));
  usePublishModel(() => ({
    vars: {
      T0: { sym: 'T_{0}', name: 'Período de pequeñas oscilaciones', value: run.T0, unit: 's', decimals: 4 },
      Ts: { sym: 'T', name: 'Período con corrección de amplitud', value: run.Tseries, unit: 's', decimals: 4 },
      L: { sym: 'L', name: 'Longitud del péndulo', value: length, unit: 'm', decimals: 3 },
      g: { sym: 'g', name: `Gravedad (${place.name})`, value: place.g, unit: 'm/s²', decimals: 2 },
      th: { sym: '\\theta_{0}', name: 'Amplitud en radianes', value: (amplitude * Math.PI) / 180, unit: 'rad', decimals: 3 },
      Tm: { sym: 'T_{med}', name: 'Período medido', value: meas ? meas.period : null, unit: 's', decimals: 3 },
      gc: { sym: 'g_{calc}', name: 'Gravedad calculada', value: meas ? (4 * Math.PI ** 2 * length) / meas.period ** 2 : null, unit: 'm/s²', decimals: 2 },
    },
    equations: [
      { title: 'Péndulo simple (ángulos pequeños)', lhs: 'T0', expr: '2\\pi\\sqrt{\\frac{[L]}{[g]}}', note: 'No depende de la masa de la lenteja.' },
      { title: 'Corrección por amplitud', lhs: 'Ts', expr: '[T0]·(1 + \\frac{[th]^{2}}{16})', note: 'A mayor amplitud, el período crece un poco (sen θ ≠ θ).' },
      { title: 'Gravedad a partir de tu medición', lhs: 'gc', expr: '\\frac{4\\pi^{2}·[L]}{[Tm]^{2}}' },
    ],
  }), [run, length, place, amplitude, meas]);
  const tStop = mode === 'fotopuerta' ? run.tGateEnd : run.tEnd;

  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setReleased(false); setDone(false); setMeas(null); setT(0); };
  useEffect(reset, [input, bobId]);

  useEffect(() => {
    if (!running) return;
    const finish = () => { setT(tStop); setRunning(false); if (mode !== 'libre') setDone(true); };
    if (prefersReducedMotion()) { finish(); return; }
    const factor = speed === 'x4' ? 4 : 1;
    // Al reanudar (o al cambiar la velocidad) el reloj sigue desde el tiempo ya simulado.
    const start = performance.now() - (t / factor) * 1000;
    const tick = (now: number) => {
      const el = Math.max(0, ((now - start) / 1000) * factor);
      if (el >= tStop) { finish(); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, tStop, speed, mode]);

  const launch = (m: RunMode) => {
    cancelAnimationFrame(raf.current);
    setMode(m);
    setT(0);
    setDone(false);
    setReleased(true);
    setMeas(null);
    if (m === 'cronometro') {
      seedRef.current += 1;
      const sw = stopwatchTenOscillations(run, seedRef.current);
      setMeas({ kind: 'cronometro', t10: sw.reading, period: sw.reading / OSCILLATIONS_TIMED, startAt: sw.startAt, stopAt: sw.stopAt });
    } else if (m === 'fotopuerta') {
      setMeas({ kind: 'fotopuerta', t10: null, period: photogatePeriod(run), startAt: run.passages[0], stopAt: run.passages[2] });
    }
    setRunning(true);
  };

  /* ---------------- estado de la animación */
  const tNow = Math.min(Math.max(0, t), run.tEnd);
  const theta = released ? angleAt(run, tNow) : run.theta[0];
  const Lpx = length * PX_PER_M;
  const bx = PX + Lpx * Math.sin(theta);
  const by = PY + Lpx * Math.cos(theta);
  const yb = PY + Lpx; // punto más bajo
  // Posición de reposo antes de soltar (θ₀): allí se agarra la lenteja para cambiar el ángulo.
  const restX = PX + Lpx * Math.sin(toRad(amplitude)), restY = PY + Lpx * Math.cos(toRad(amplitude));
  const blocked = Math.abs(bx - PX) < rPx && Math.abs(by - yb) < rPx;
  const trail = useMemo(() => {
    if (!running) return [];
    return Array.from({ length: 14 }, (_, k) => {
      const th = angleAt(run, Math.max(0, tNow - (k + 1) * 0.035 * (speed === 'x4' ? 2 : 1)));
      return { x: PX + Lpx * Math.sin(th), y: PY + Lpx * Math.cos(th), o: 0.3 * (1 - k / 14) };
    });
  }, [running, run, tNow, Lpx, speed]);

  // Trazo completo de θ(t) (se revela con un recorte a medida que avanza el tiempo).
  const graphPath = useMemo(() => {
    const n = 480;
    const amp = Math.abs(run.theta[0]);
    const mid = GRAPH.y + GRAPH.h / 2;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const tt = (run.tEnd * i) / n;
      pts.push(`${(GRAPH.x + (tt / run.tEnd) * GRAPH.w).toFixed(1)} ${(mid - (angleAt(run, tt) / amp) * (GRAPH.h / 2 - 8)).toFixed(1)}`);
    }
    return `M${pts.join(' L')}`;
  }, [run]);
  const clipW = released ? (tNow / run.tEnd) * GRAPH.w : 0;

  /* ---------------- instrumentos */
  const swText = (() => {
    if (!meas || meas.kind !== 'cronometro') return '0,00';
    if (done) return fmt(meas.t10, 2);
    return fmt(Math.max(0, Math.min(tNow, meas.stopAt) - meas.startAt), 2);
  })();
  const gateText = (() => {
    if (!meas || meas.kind !== 'fotopuerta') return '0,000';
    if (done) return fmt(meas.period, 3);
    return fmt(Math.max(0, Math.min(tNow, meas.stopAt) - meas.startAt), 3);
  })();
  const passagesSoFar = released ? run.passages.filter((p) => p <= tNow).length : 0;
  // Sonido: tic de la fotopuerta en cada paso y clic del cronómetro al iniciar y detener.
  const swPhase = meas?.kind === 'cronometro' && released ? (tNow >= meas.stopAt ? 2 : tNow >= meas.startAt ? 1 : 0) : 0;
  const prevSound = useRef({ passages: 0, sw: 0 });
  useEffect(() => {
    const prev = prevSound.current;
    if (running && mode === 'fotopuerta' && passagesSoFar > prev.passages) playSound(passagesSoFar >= 3 ? 'photogate' : 'tick');
    if (running && swPhase > prev.sw) playSound('click', { intensity: 0.8 });
    prevSound.current = { passages: passagesSoFar, sw: swPhase };
  });
  const oscCount = mode === 'cronometro' && released ? Math.min(OSCILLATIONS_TIMED, Math.floor(Math.max(0, passagesSoFar - 1) / 2)) : null;

  const result = done && meas ? analyzePeriod(length, meas.period) : null;
  const record = () => {
    if (!meas || !result) return;
    api.addTrial('oscilaciones', {
      lenteja: bob.name, lugar: place.name, longitud: length, masa: massG, amplitud: amplitude,
      t10: meas.t10, periodo: Number(meas.period.toFixed(4)), periodo2: Number(result.period2.toFixed(4)),
      gCalculada: Number(result.gCalculated.toFixed(3)),
    });
  };

  const finished = released && !running && (done || t >= tStop);
  const paused = released && !running && !finished;
  const simStatus = simStatusOf(running, paused, finished);

  const descText = done && meas
    ? (meas.kind === 'cronometro'
      ? `Medición terminada: el cronómetro marcó ${fmt(meas.t10, 2)} s para 10 oscilaciones.`
      : `Medición terminada: la fotopuerta registró un período de ${fmt(meas.period, 3)} s.`)
    : running ? `El péndulo oscila; ángulo actual ${fmt((theta * 180) / Math.PI, 0)}°.`
      : paused ? `Oscilación en pausa en t = ${fmt(t, 2)} s; ángulo ${fmt((theta * 180) / Math.PI, 0)}°.`
      : `Lenteja de ${bob.name.toLowerCase()} de ${fmt(massG, 0)} g colgada de un hilo de ${fmt(length, 2)} m, sostenida a ${fmt(amplitude, 0)}° de la vertical.`;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox="0 0 760 370" label="Controles del péndulo" scene={
          <svg viewBox="0 0 760 370" role="img" aria-labelledby="pen-t pen-d">
            <title id="pen-t">Péndulo simple en un soporte universal con transportador, regla vertical, fotopuerta y cronómetro</title>
            <desc id="pen-d">{descText}</desc>
            <PendulumDefs />
            <BenchTop y={BENCH_Y} width={760} />
            <VerticalRuler />
            <Stand />
            <PhotogateBack yb={yb} r={rPx} blocked={released && blocked} />
            {dampingId === 'aceite' && <OilDamper theta={theta} />}
            <Protractor releaseDeg={amplitude} />
            {/* cota de la longitud medida con la regla */}
            <line x1={RULER_X + 24} x2={PX - rPx - 3} y1={yb} y2={yb} stroke="var(--data)" strokeWidth="1" strokeDasharray="3 3" />
            <rect x={RULER_X - 58} y={yb - 10} width={54} height={18} rx={4} fill="var(--surface)" stroke="var(--line)" />
            <text x={RULER_X - 31} y={yb + 3} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700 }}>L = {fmt(length, 2)} m</text>
            {/* estela */}
            {trail.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={rPx * (1 - i / 30)} fill={bob.color} opacity={p.o} />)}
            {/* hilo y lenteja */}
            <line x1={PX} y1={PY} x2={bx} y2={by} stroke="var(--ink)" strokeWidth="1.2" />
            <ellipse cx={bx} cy={BENCH_Y - 1} rx={rPx * 1.1} ry={2.2} fill="#000" opacity={0.08 + 0.1 * (by / BENCH_Y)} />
            <g filter="url(#kit-shadow-soft)">
              <circle cx={bx} cy={by} r={rPx} fill={`url(#pen-bob-${bob.id})`} stroke={shade(bob.color, -0.5)} strokeWidth="0.8" />
            </g>
            {bob.id === 'madera' && <path d={`M${bx - rPx * 0.7} ${by + rPx * 0.1} Q${bx} ${by - rPx * 0.25} ${bx + rPx * 0.7} ${by + rPx * 0.2}`} fill="none" stroke={shade(bob.color, -0.35)} strokeWidth="0.7" opacity="0.7" />}
            <circle cx={bx} cy={by - rPx - 1.5} r={1.6} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.5" />
            <PhotogateFront yb={yb} r={rPx} />
            <circle cx={PX} cy={PY} r={2.6} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.8" />

            {/* panel de instrumentos */}
            <Stopwatch x={608} y={22} text={swText} label="cronómetro manual" />
            {oscCount !== null && (
              <text x={660} y={96} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>oscilaciones: {oscCount} de {OSCILLATIONS_TIMED}</text>
            )}
            <GateCounter x={592} y={108} text={gateText} />
            {/* gráfica θ(t) en vivo */}
            <g>
              <rect x={GRAPH.x - 6} y={GRAPH.y - 20} width={GRAPH.w + 12} height={GRAPH.h + 40} rx={8} fill="var(--surface)" stroke="var(--line)" />
              <text x={GRAPH.x} y={GRAPH.y - 7} style={{ fontSize: 10.5, fill: 'var(--ink)', fontWeight: 700 }}>θ(t) en vivo</text>
              <text x={GRAPH.x + GRAPH.w} y={GRAPH.y - 7} textAnchor="end" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>±{fmt(amplitude, 0)}°</text>
              <line x1={GRAPH.x} x2={GRAPH.x + GRAPH.w} y1={GRAPH.y + GRAPH.h / 2} y2={GRAPH.y + GRAPH.h / 2} stroke="var(--line)" />
              <line x1={GRAPH.x} x2={GRAPH.x} y1={GRAPH.y} y2={GRAPH.y + GRAPH.h} stroke="var(--ink-2)" strokeWidth="0.8" />
              {[0.5, 1].map((f) => (
                <g key={f}>
                  <line x1={GRAPH.x} x2={GRAPH.x + GRAPH.w} y1={GRAPH.y + GRAPH.h / 2 - f * (GRAPH.h / 2 - 8)} y2={GRAPH.y + GRAPH.h / 2 - f * (GRAPH.h / 2 - 8)} stroke="var(--line)" strokeDasharray="2 3" />
                  <line x1={GRAPH.x} x2={GRAPH.x + GRAPH.w} y1={GRAPH.y + GRAPH.h / 2 + f * (GRAPH.h / 2 - 8)} y2={GRAPH.y + GRAPH.h / 2 + f * (GRAPH.h / 2 - 8)} stroke="var(--line)" strokeDasharray="2 3" />
                </g>
              ))}
              <clipPath id="pen-graph-clip"><rect x={GRAPH.x - 2} y={GRAPH.y - 2} width={clipW + 2} height={GRAPH.h + 4} /></clipPath>
              <path d={graphPath} fill="none" stroke="var(--series-1)" strokeWidth="1.6" strokeLinejoin="round" clipPath="url(#pen-graph-clip)" />
              {released && <circle cx={GRAPH.x + clipW} cy={GRAPH.y + GRAPH.h / 2 - (theta / Math.abs(run.theta[0])) * (GRAPH.h / 2 - 8)} r={2.8} fill="var(--series-1)" />}
              <text x={GRAPH.x} y={GRAPH.y + GRAPH.h + 13} style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>0</text>
              <text x={GRAPH.x + GRAPH.w} y={GRAPH.y + GRAPH.h + 13} textAnchor="end" style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(run.tEnd, 1)} s</text>
              {!released && <text x={GRAPH.x + GRAPH.w / 2} y={GRAPH.y + GRAPH.h / 2 - 6} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>suelta el péndulo</text>}
            </g>
            <text x={PX + 6} y={PY - 28} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>g = {fmt(place.g, 2)} m/s² · {place.name.split(' (')[0]}</text>
          </svg>}>
            <DragHandle label="Lenteja del péndulo: ángulo de liberación" value={amplitude} min={PEN_LIMITS.amplitude[0]} max={PEN_LIMITS.amplitude[1]} step={1} unit="°" decimals={0}
              disabled={running} hit={{ cx: restX, cy: restY, r: rPx + 6 }}
              valueText={(v) => `${fmt(v, 0)}° desde la vertical`}
              valueFromPoint={({ point }) => 180 - Math.abs(clockAngle({ x: PX, y: PY }, point))}
              onChange={setAmplitude} />
          </ManipScene>
        </div>
        <ManipHint>Arrastra la lenteja hacia la derecha para elegir el ángulo de liberación, o enfócala con Tab y usa las flechas.</ManipHint>
        <Readout items={[
          { k: 'Tiempo de 10 oscilaciones (cronómetro)', v: result && meas?.t10 != null ? `${fmt(meas.t10, 2)} s` : '—', data: true, resolution: meas?.kind === 'cronometro' ? resolutionText(0.01, 's') : undefined },
          { k: 'Período T', v: result ? `${fmt(result.period, 3)} s` : '—', data: true, resolution: meas ? resolutionText(0.001, 's') : undefined },
          { k: 'Frecuencia f = 1/T', v: result ? `${fmt(result.frequency, 3)} Hz` : '—', data: true },
          { k: 'T²', v: result ? `${fmt(result.period2, 3)} s²` : '—', data: true },
          { k: 'g = 4π²L/T² (este ensayo)', v: result ? `${fmt(result.gCalculated, 2)} m/s²` : '—', data: true },
          { k: 'Instrumento', v: meas ? (meas.kind === 'cronometro' ? 'cronómetro manual (0,01 s)' : 'fotopuerta (0,001 s)') : '—' },
        ]} />
        <Notice>
          Para calcular g con varios ensayos: guarda el período para al menos cinco longitudes, grafica T² contra L en el cuaderno y ajusta una recta.
          Como T² = (4π²/g)·L, la pendiente vale 4π²/g, de modo que <strong>g = 4π²/pendiente</strong>. Compara con {fmt(place.g, 2)} m/s².
        </Notice>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Montaje del péndulo</h3>
          <Slider label="Longitud del péndulo" value={length} min={PEN_LIMITS.length[0]} max={PEN_LIMITS.length[1]} step={0.01} unit="m" decimals={2} onChange={setLength}
            hint="Desde el punto de suspensión hasta el centro de la lenteja (regla de 1 mm)." />
          <Select label="Material de la lenteja" value={bobId} onChange={setBobId} options={BOBS.map((b) => ({ value: b.id, label: b.name }))} />
          <Slider label="Masa de la lenteja" value={massG} min={PEN_LIMITS.mass[0]} max={PEN_LIMITS.mass[1]} step={5} unit="g" decimals={0} onChange={setMassG} />
          <Slider label="Amplitud inicial" value={amplitude} min={PEN_LIMITS.amplitude[0]} max={PEN_LIMITS.amplitude[1]} step={1} unit="°" decimals={0} onChange={setAmplitude} />
          <Select label="Lugar del experimento" value={placeId} onChange={setPlaceId} options={PLACES.map((p) => ({ value: p.id, label: `${p.name} · g = ${fmt(p.g, 2)} m/s²` }))} />
          <Select label="Medio y amortiguamiento" value={dampingId} onChange={setDampingId} options={DAMPINGS.map((d) => ({ value: d.id, label: d.name }))} />
          <Segmented<AnimSpeed> label="Velocidad de la animación" value={speed} onChange={setSpeed}
            options={[{ value: 'real', label: 'Tiempo real' }, { value: 'x4', label: 'Acelerada ×4' }]} />
        </div>
        <div className="card stack">
          <h3>Medición</h3>
          {/* Sin barra de avance: la duración de la corrida depende del período, que es lo que se mide. */}
          <SimControls title="Péndulo" status={simStatus} startLabel="Soltar el péndulo"
            onStart={() => launch(simStatus === 'terminado' ? mode : 'libre')}
            onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => launch('cronometro')} disabled={running}>Medir 10 oscilaciones</button>
            <button type="button" className="btn primary" onClick={() => launch('fotopuerta')} disabled={running}>Medir con la fotopuerta</button>
          </div>
          <RecordButton onRecord={record} disabled={!result || running} />
        </div>
        <Notice>
          Cronómetro manual de 0,01 s: cada pulsación se retrasa por el tiempo de reacción, así que el intervalo tiene un error de hasta ±{fmt(REACTION_ERROR, 2)} s;
          al dividir entre 10 oscilaciones, el error del período baja a ±{fmt(REACTION_ERROR / 10, 3)} s. La fotopuerta mide el período (del 1.er al 3.er paso por el punto más bajo) con 1 ms.
          El modelo integra la ecuación no lineal θ&apos;&apos; = −(g/L)·sen θ − b·θ&apos; con RK4; la lenteja se trata como masa puntual.
        </Notice>
      </div>
    </div>
  );
}

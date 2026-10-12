import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONTAINERS, HEAT_INSTRUMENTS, HEAT_LIMITS, METALS, RECORD_S, ROOM_T, SERIES_STEP, SPECIFIC_HEAT_TABLE,
  analyzeReadings, closestMaterial, containerHeatCapacity, findContainer, findMetal, heatFlows, simulate, temperatureSeries, temperaturesAt,
  thermometerSeries, type ContainerId, type ExperimentId, type MetalId,
} from '../models/heat';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart } from '../components/Chart';
import { DataLogger, LoggerRunCharts, SensorCard } from '../components/DataLogger';
import type { LoggerChannel, LoggerRun } from '../lib/logger';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { useMeasure } from '../components/Measurement';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, Beaker, DigitalBalance, Lcd, Stopwatch, Thermometer, shade } from './kit';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 800, H = 440;
const VIEW_Y = 28; // el dibujo empieza más abajo: se recorta el aire vacío de arriba
const BENCH_Y = 404;
const TRANSFER_MS = 1600; // traslado de la muestra al calorímetro (no cuenta en el tiempo simulado)
const RUN_MS = 6000; // 10 min simulados
/** Balanza con el calorímetro encima (pesada por diferencia). */
const BAL = { x: 272, y: BENCH_Y - 76, w: 206 };
const CX = BAL.x + BAL.w / 2; // centro del vaso
const CUP_BOTTOM = BAL.y - 2;
const CUP_H = 150;
const CUP_TOP = CUP_BOTTOM - CUP_H;
const LID_H = 11;
/** Píxeles por mL dentro del vaso (capacidad útil ≈ 450 mL). */
const PX_PER_ML = (CUP_H - 12) / 450;
/** Baño de la parrilla. */
const BATH = { x: 52, y: 252, w: 112, h: 108 };
const PLATE_Y = BATH.y + BATH.h + 2;
/** Escala del dibujo del metal (px por cm). */
const PX_PER_CM = 9;

interface CupStyle { top: number; bottom: number; wall: number; }
const CUP_STYLE: Record<ContainerId, CupStyle> = {
  icopor: { top: 118, bottom: 90, wall: 6 },
  vidrio: { top: 112, bottom: 112, wall: 2.2 },
  lata: { top: 102, bottom: 102, wall: 1.6 },
};

/** Semiancho interior del vaso a la altura y. */
function innerHalf(s: CupStyle, y: number) {
  const f = (CUP_BOTTOM - y) / CUP_H;
  return (s.bottom + (s.top - s.bottom) * f) / 2 - s.wall;
}

const EXP_LABEL: Record<ExperimentId, string> = { agua: 'Agua caliente', metal: 'Metal caliente' };
const clock = (s: number) => {
  const r = Math.round(s);
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
};
const easeInOut = (q: number) => (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* ------------------------------------------------------------------ piezas locales */

/** Patrón de perlas del poliestireno expandido. */
function FoamDefs() {
  return (
    <defs>
      <pattern id="cal-foam" width="7" height="7" patternUnits="userSpaceOnUse">
        <rect width="7" height="7" fill="#f6f5ef" />
        <circle cx="2" cy="2" r="1.7" fill="#ffffff" stroke="#dcd9cc" strokeWidth="0.4" />
        <circle cx="5.5" cy="5.2" r="1.5" fill="#fbfaf6" stroke="#dcd9cc" strokeWidth="0.4" />
      </pattern>
      <linearGradient id="cal-cup-shade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.12" />
        <stop offset="0.25" stopColor="#000" stopOpacity="0" />
        <stop offset="0.8" stopColor="#000" stopOpacity="0.04" />
        <stop offset="1" stopColor="#000" stopOpacity="0.16" />
      </linearGradient>
      <linearGradient id="cal-hot" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ff8a50" />
        <stop offset="1" stopColor="#c62828" />
      </linearGradient>
    </defs>
  );
}

/** Pieza cilíndrica de metal (altura = diámetro) con brillo metálico. (x, y) es el centro. */
function MetalPiece({ x, y, d, color }: { x: number; y: number; d: number; color: string }) {
  const e = d * 0.18;
  return (
    <g>
      <rect x={x - d / 2} y={y - d / 2} width={d} height={d} fill={color} stroke={shade(color, -0.45)} strokeWidth="0.8" />
      <rect x={x - d / 2} y={y - d / 2} width={d} height={d} fill="url(#kit-metal-h)" opacity="0.4" />
      <ellipse cx={x} cy={y + d / 2} rx={d / 2} ry={e} fill={shade(color, -0.25)} stroke={shade(color, -0.45)} strokeWidth="0.8" />
      <ellipse cx={x} cy={y - d / 2} rx={d / 2} ry={e} fill={shade(color, 0.3)} stroke={shade(color, -0.45)} strokeWidth="0.8" />
      <rect x={x - d * 0.32} y={y - d / 2 + e} width={d * 0.1} height={d - 2 * e} fill="#fff" opacity="0.35" />
      <circle cx={x} cy={y - d / 2} r={1.6} fill={shade(color, -0.5)} />
    </g>
  );
}

/** Ondas de calor (flecha ondulada) de longitud proporcional al flujo. */
function HeatArrow({ x, y, dir, size, label }: { x: number; y: number; dir: 1 | -1; size: number; /** Texto a la izquierda de la flecha. */ label?: string }) {
  const len = 18 + 26 * size;
  const pts: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(`${x + dir * t * (len - 6)} ${y + Math.sin(t * Math.PI * 3) * 3.4}`);
  }
  const ex = x + dir * len;
  return (
    <g opacity={0.6 + 0.4 * size} aria-hidden="true">
      <path d={`M${pts.join(' L')}`} fill="none" stroke="var(--bad)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${ex} ${y} l${-dir * 8} -5 l0 10 Z`} fill="var(--bad)" />
      {label && <text x={Math.min(x, ex) - 4} y={y + 3.5} textAnchor="end" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 600 }}>{label}</text>}
    </g>
  );
}

/** Parrilla eléctrica con perilla y pantalla de temperatura del baño. */
function HotPlate({ on, reading }: { on: boolean; reading: string }) {
  const x = BATH.x - 18, w = BATH.w + 36, y = PLATE_Y;
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y + 8} width={w} height={BENCH_Y - y - 9} rx={6} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <rect x={x + 8} y={y} width={w - 16} height={10} rx={3} fill="url(#kit-body-dark)" />
      {on && <rect x={x + 14} y={y + 1} width={w - 28} height={3} rx={1.5} fill="url(#cal-hot)" opacity="0.85" />}
      <Lcd x={x + 10} y={y + 15} w={86} h={22} text={reading} unit="°C" />
      <circle cx={x + w - 22} cy={y + 26} r={8} fill="url(#kit-body-dark)" />
      <line x1={x + w - 22} y1={y + 26} x2={x + w - 17} y2={y + 21} stroke="#e4e9ea" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx={x + w - 40} cy={y + 26} r={2.6} fill={on ? '#ef5350' : '#9aa5a9'} />
    </g>
  );
}

/** Soporte universal con nuez y brazo, del que cuelga el metal con un hilo. */
function Stand({ armToX, armY }: { armToX: number; armY: number }) {
  const rx = BATH.x + BATH.w + 46;
  return (
    <g>
      <rect x={rx - 26} y={BENCH_Y - 7} width={52} height={7} rx={2} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
      <rect x={rx - 2.5} y={armY - 24} width={5} height={BENCH_Y - armY + 18} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.5" />
      <rect x={armToX} y={armY - 2} width={rx - armToX} height={4} rx={2} fill="url(#kit-metal)" stroke="#8a969a" strokeWidth="0.5" />
      <rect x={rx - 6} y={armY - 6} width={12} height={12} rx={2} fill="#3b4648" />
    </g>
  );
}

/** Termómetro digital de sonda (cuerpo con pantalla); el cable llega a la sonda dentro del calorímetro. */
function DigitalThermometer({ x, y, text, probeX, probeY }: { x: number; y: number; text: string; probeX: number; probeY: number }) {
  return (
    <g>
      <path d={`M${x + 10} ${y + 30} C ${x - 40} ${y + 30}, ${probeX + 40} ${probeY - 50}, ${probeX} ${probeY}`} fill="none" stroke="#2f3a3d" strokeWidth="2.6" strokeLinecap="round" />
      <g filter="url(#kit-shadow-soft)">
        <rect x={x} y={y} width={112} height={66} rx={12} fill="url(#kit-body-dark)" />
      </g>
      <Lcd x={x + 8} y={y + 8} w={96} h={32} text={text} unit="°C" />
      <text x={x + 56} y={y + 56} textAnchor="middle" style={{ fontSize: 8, fill: '#c9d2d5', letterSpacing: 1 }}>TERMÓMETRO · 0,1 °C</text>
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

type Phase = 'listo' | 'midiendo' | 'medido';

export default function HeatLab({ api }: LabProps) {
  const [experiment, setExperiment] = useState<ExperimentId>('agua');
  const [metal, setMetal] = useState<MetalId>('aluminio');
  const [container, setContainer] = useState<ContainerId>('icopor');
  const [sampleMass, setSampleMass] = useState(100);
  const [sampleTemp, setSampleTemp] = useState(60);
  const [waterMass, setWaterMass] = useState(100);
  const [waterTemp, setWaterTemp] = useState(20);
  const [phase, setPhase] = useState<Phase>('listo');
  const [elapsed, setElapsed] = useState(0);
  const [sensorRun, setSensorRun] = useState<LoggerRun | null>(null);
  const raf = useRef(0);

  const isMetal = experiment === 'metal';
  const metalInfo = findMetal(metal);
  const vessel = findContainer(container);
  const vesselC = containerHeatCapacity(container);
  const ctx = useMemo(() => ({ experiment, metal, container }), [experiment, metal, container]);
  const sim = useMemo(() => simulate({ experiment, metal, container, sampleMass, sampleTemp, waterMass, waterTemp }),
    [experiment, metal, container, sampleMass, sampleTemp, waterMass, waterTemp]);
  const series = useMemo(() => temperatureSeries(sim), [sim]);

  // Instrumentos: ficha de la práctica si está integrada; si no, la del modelo (modo real con la misma incertidumbre).
  const thermoSpec = INSTRUMENTS.calor?.find((i) => i.id === 'termometro') ?? HEAT_INSTRUMENTS[0];
  const balanceSpec = INSTRUMENTS.calor?.find((i) => i.id === 'balanza') ?? HEAT_INSTRUMENTS[1];
  const { measure, deviation, remeasure, real } = useMeasure();
  const readings = useMemo(() => ({
    sampleMass: measure(sampleMass, { ...balanceSpec, key: 'masaMuestra' }),
    waterMass: measure(waterMass, { ...balanceSpec, key: 'masaAgua' }),
    sampleTemp: measure(sampleTemp, { ...thermoSpec, key: 'tMuestra' }),
    waterTemp: measure(waterTemp, { ...thermoSpec, key: 'tAgua' }),
    te: measure(sim.teTrue, { ...thermoSpec, key: 'te' }),
    t10: measure(temperaturesAt(sim, RECORD_S).water, { ...thermoSpec, key: 't10' }),
  }), [measure, balanceSpec, thermoSpec, sampleMass, waterMass, sampleTemp, waterTemp, sim]);
  // Serie del termómetro cada 5 s: en modo real, ruido reproducible que cambia al volver a medir.
  const seriesSeed = useMemo(() => Math.round((deviation('serie', 1) + 10) * 1e6), [deviation]);
  const thermoSeries = useMemo(() => thermometerSeries(series, real ? (thermoSpec.sigma ?? 0) : 0, seriesSeed), [series, real, thermoSpec, seriesSeed]);
  const analysis = useMemo(() => analyzeReadings(readings, ctx), [readings, ctx]);

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setElapsed(0); };
  useEffect(reset, [experiment, metal, container, sampleMass, sampleTemp, waterMass, waterTemp]);

  useEffect(() => {
    if (phase !== 'midiendo') return;
    if (prefersReducedMotion()) { setElapsed(TRANSFER_MS + RUN_MS); setPhase('medido'); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const e = Math.min(TRANSFER_MS + RUN_MS, Math.max(0, now - start));
      setElapsed(e);
      if (e >= TRANSFER_MS + RUN_MS) { setPhase('medido'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  const start = () => {
    cancelAnimationFrame(raf.current);
    remeasure('masaMuestra', 'masaAgua', 'tMuestra', 'tAgua', 'te', 't10', 'serie');
    setElapsed(0);
    setPhase('midiendo');
  };

  const chooseExperiment = (v: ExperimentId) => {
    setExperiment(v);
    // El metal se calienta en agua hirviendo (≈ 99 °C en Urabá); el agua caliente, en la parrilla a 60 °C.
    setSampleTemp(v === 'metal' ? 99 : 60);
  };

  const done = phase === 'medido';
  const transfer = phase === 'listo' ? 0 : clamp01(elapsed / TRANSFER_MS);
  const simT = phase === 'listo' ? 0 : done ? RECORD_S : clamp01((elapsed - TRANSFER_MS) / RUN_MS) * RECORD_S;
  const idx = Math.min(thermoSeries.length - 1, Math.max(0, Math.floor(simT / SERIES_STEP)));
  const lcdTemp = phase === 'listo' || transfer < 1 ? readings.waterTemp : done ? readings.t10 : thermoSeries[idx].T;
  const flows = transfer >= 1 ? heatFlows(sim, simT) : { toWater: 0, toAir: 0 };

  /* --------------------------- geometría dependiente del estado */
  const style = CUP_STYLE[container];
  const metalVolume = sampleMass / metalInfo.density; // cm³
  const metalD = Math.cbrt((4 * metalVolume) / Math.PI) * PX_PER_CM;
  const poured = isMetal ? 0 : sampleMass * easeInOut(clamp01((transfer - 0.3) / 0.45));
  const cupVolume = waterMass + poured + (isMetal && transfer >= 0.85 ? metalVolume : 0);
  const levelY = CUP_BOTTOM - 4 - cupVolume * PX_PER_ML;
  // Para meter el metal se levanta la tapa; el agua caliente se vierte por el orificio de la tapa.
  const lidLift = isMetal && transfer > 0 && transfer < 1 ? 26 * Math.sin(Math.PI * transfer) : 0;
  const lidY = CUP_TOP - LID_H - lidLift;
  // Metal: del baño al fondo del calorímetro.
  const metalHome = { x: BATH.x + BATH.w / 2, y: BATH.y + BATH.h - 22 - metalD / 2 };
  const metalCup = { x: CX + 2, y: CUP_BOTTOM - 7 - metalD / 2 };
  const mq = easeInOut(clamp01((transfer - 0.1) / 0.75));
  const metalPos = {
    x: metalHome.x + (metalCup.x - metalHome.x) * mq,
    y: metalHome.y + (metalCup.y - metalHome.y) * mq - Math.sin(Math.PI * mq) * 150,
  };
  const armY = 150;
  // Agua caliente: el vaso sube, se inclina sobre el calorímetro y vuelve vacío.
  const pq = transfer;
  const beakerMove = isMetal ? 0 : pq < 0.3 ? easeInOut(pq / 0.3) : pq < 0.75 ? 1 : 1 - easeInOut((pq - 0.75) / 0.25);
  const tilt = isMetal ? 0 : pq < 0.3 ? 0 : pq < 0.75 ? 58 * Math.sin((Math.PI * (pq - 0.3)) / 0.45 / 2) : 58 * (1 - easeInOut((pq - 0.75) / 0.25));
  const pourTarget = { dx: CX - 44 - (BATH.x + BATH.w), dy: CUP_TOP - 44 - BATH.y };
  const holeX = CX - 8;
  const bathFill = isMetal ? 0.72 : Math.max(0, (sampleMass - poured) / 150) * 0.78;
  const pouring = !isMetal && pq > 0.42 && pq < 0.75;

  const flowScale = (w: number) => Math.min(1, Math.abs(w) / 2);
  const steam = !isMetal ? sampleTemp >= 50 && transfer === 0 : sampleTemp >= 90;

  /* --------------------------- textos */
  const sampleNoun = isMetal ? 'el metal' : 'el agua caliente';
  const show = (text: string) => (done ? text : '—');
  const a = analysis;
  const cText = a.cSample === null ? 'no calculable (ΔT muy pequeño)' : `${fmt(a.cSample, 3)} J/(g·°C)`;
  const nearest = a.cSample === null ? null : closestMaterial(a.cSample);
  const lossText = a.qDiff === null ? 'no calculable (c desconocido)' : `${fmt(a.qDiff, 0)} J (${fmt(a.lossPct ?? 0, 1)} %)`;

  const record = () => api.addTrial('calor', {
    experimento: EXP_LABEL[experiment], recipiente: vessel.short, muestra: isMetal ? metalInfo.name : 'Agua',
    mMuestra: sampleMass, tMuestra: sampleTemp, mAgua: waterMass, tAgua: waterTemp,
    te: readings.te, tEq: Math.round(sim.tEq), t10: readings.t10,
    dtAgua: Number(a.dtWater.toFixed(1)), dtMuestra: Number(a.dtSample.toFixed(1)),
    qCedido: a.qGiven === null ? null : Math.round(a.qGiven),
    qGanado: Math.round(a.qGained),
    perdidas: a.qDiff === null ? null : Math.round(a.qDiff),
    cMuestra: a.cSample === null ? null : Number(a.cSample.toFixed(3)),
    cVaso: a.cVessel === null ? null : Number(a.cVessel.toFixed(1)),
  });

  const conditions = `${EXP_LABEL[experiment]}${isMetal ? ` (${metalInfo.name.toLowerCase()})` : ''}: ${fmt(sampleMass, 0)} g a ${fmt(sampleTemp, 0)} °C en ${fmt(waterMass, 0)} g de agua a ${fmt(waterTemp, 0)} °C · ${vessel.short.toLowerCase()}`;
  const sensorChannels = useMemo<LoggerChannel[]>(() => [
    { id: 'agua', name: 'Temperatura del agua del calorímetro', unit: '°C', resolution: 0.1, noise: 0.05, min: -20, max: 150, color: 'var(--series-1)', sample: (t) => temperaturesAt(sim, t).water },
    { id: 'muestra', name: isMetal ? 'Temperatura del metal (termopar)' : 'Temperatura del agua caliente', unit: '°C', resolution: 0.1, noise: 0.05, min: -20, max: 150, color: 'var(--series-2)', sample: (t) => temperaturesAt(sim, t).sample },
  ], [sim, isMetal]);

  const desc = done
    ? `Después de 10 min, el termómetro del calorímetro marca ${fmt(readings.t10, 1)} °C. La mezcla llegó al equilibrio térmico a ${fmt(readings.te, 1)} °C y luego se acercó lentamente a la temperatura del salón (${fmt(ROOM_T, 0)} °C).`
    : phase === 'midiendo'
      ? `Se agregó ${sampleNoun} al calorímetro; el termómetro marca ${fmt(lcdTemp, 1)} °C a los ${fmt(simT, 0)} s.`
      : `Calorímetro (${vessel.name.toLowerCase()} con tapa) sobre una balanza, con ${fmt(waterMass, 0)} g de agua a ${fmt(waterTemp, 0)} °C. En la parrilla, ${isMetal ? `una pieza de ${metalInfo.name.toLowerCase()} de ${fmt(sampleMass, 0)} g en agua a ${fmt(sampleTemp, 0)} °C` : `${fmt(sampleMass, 0)} g de agua a ${fmt(sampleTemp, 0)} °C`}.`;

  const probeX = CX + 34, stirX = CX - 34;
  const stirBob = phase === 'midiendo' && transfer >= 1 ? 6 * Math.sin(elapsed / 160) : 0;
  const inBottom = CUP_BOTTOM - (container === 'icopor' ? 6 : 3);
  const outer = `M${CX - style.top / 2} ${CUP_TOP} L${CX - style.bottom / 2} ${CUP_BOTTOM - 4} Q${CX - style.bottom / 2} ${CUP_BOTTOM} ${CX - style.bottom / 2 + 4} ${CUP_BOTTOM} L${CX + style.bottom / 2 - 4} ${CUP_BOTTOM} Q${CX + style.bottom / 2} ${CUP_BOTTOM} ${CX + style.bottom / 2} ${CUP_BOTTOM - 4} L${CX + style.top / 2} ${CUP_TOP} Z`;
  const inner = `M${CX - innerHalf(style, CUP_TOP)} ${CUP_TOP} L${CX - innerHalf(style, inBottom)} ${inBottom} L${CX + innerHalf(style, inBottom)} ${inBottom} L${CX + innerHalf(style, CUP_TOP)} ${CUP_TOP} Z`;
  const waterColor = '#7fbfe0';

  const chartPoints = done ? thermoSeries : phase === 'midiendo' && transfer >= 1 ? thermoSeries.slice(0, idx + 1) : [];

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo del calorímetro">
          <svg viewBox={`0 ${VIEW_Y} ${W} ${H - VIEW_Y}`} role="img" aria-labelledby="cal-t cal-d">
            <title id="cal-t">Calorímetro de mezclas sobre una balanza, con termómetro digital, parrilla y cronómetro</title>
            <desc id="cal-d">{desc}</desc>
            <FoamDefs />
            <defs>
              <clipPath id="cal-cup-in"><path d={inner} /></clipPath>
            </defs>
            <BenchTop y={BENCH_Y} width={W} />

            {/* aire del salón */}
            <Thermometer x={752} y={70} h={150} min={0} max={50} value={ROOM_T} />
            <text x={736} y={68} textAnchor="end" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Aire del salón</text>
            <text x={736} y={83} textAnchor="end" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{fmt(ROOM_T, 0)} °C</text>

            {/* parrilla con el baño */}
            {isMetal && transfer < 0.12 && <line x1={metalHome.x} x2={metalPos.x} y1={armY} y2={metalPos.y - metalD / 2} stroke="#4d4d4d" strokeWidth="0.9" />}
            {isMetal && <Stand armToX={metalHome.x - 6} armY={armY} />}
            <HotPlate on={transfer === 0} reading={fmt(readings.sampleTemp, 1)} />
            <g transform={`translate(${pourTarget.dx * beakerMove} ${pourTarget.dy * beakerMove}) rotate(${tilt} ${BATH.x + BATH.w} ${BATH.y})`}>
              <Beaker x={BATH.x} y={BATH.y} w={BATH.w} h={BATH.h} fill={bathFill} liquid={waterColor} liquidOpacity={0.42}>
                {isMetal && sampleTemp >= 95 && [0, 1, 2, 3, 4].map((i) => (
                  <circle key={i} cx={BATH.x + 16 + i * 20} cy={BATH.y + BATH.h - 14 - (i % 3) * 9} r={1.8 + (i % 2)} fill="#fff" opacity="0.7" />
                ))}
              </Beaker>
            </g>
            {steam && [0, 1, 2].map((i) => (
              <path key={i} d={`M${BATH.x + 30 + i * 26} ${BATH.y - 6} q-7 -12 0 -22 q7 -10 0 -22`} fill="none" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" opacity="0.32" />
            ))}
            <text x={BATH.x + BATH.w / 2} y={BENCH_Y + 30} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>
              {isMetal ? `${metalInfo.name} en agua a ${fmt(sampleTemp, 0)} °C` : `Agua caliente: ${fmt(sampleMass, 0)} g`}
            </text>

            {/* balanza con el calorímetro encima */}
            <DigitalBalance x={BAL.x} y={BAL.y} w={BAL.w} reading={fmt(readings.waterMass + (transfer >= 1 ? readings.sampleMass : 0), 1)} />

            {/* calorímetro en corte */}
            <g filter="url(#kit-shadow-soft)">
              <path d={outer} fill={container === 'icopor' ? 'url(#cal-foam)' : container === 'lata' ? 'url(#kit-metal-h)' : 'url(#kit-glass-fill)'} stroke={container === 'icopor' ? '#bdbbb0' : container === 'lata' ? '#8a969a' : 'var(--glass-edge, #8fa9b3)'} strokeWidth="1.2" />
            </g>
            <path d={inner} fill={container === 'vidrio' ? 'url(#kit-glass-fill)' : '#e8eef1'} />
            <g clipPath="url(#cal-cup-in)">
              {/* agitador y sonda bajo el agua */}
              <rect x={stirX - 1.5} y={CUP_TOP - 4 + stirBob} width={3} height={inBottom - 10 - CUP_TOP} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.4" />
              <ellipse cx={stirX} cy={inBottom - 14 + stirBob} rx={12} ry={3} fill="none" stroke="#9aa5a9" strokeWidth="2" />
              <rect x={probeX - 1.8} y={CUP_TOP - 4} width={3.6} height={inBottom - 4 - CUP_TOP} rx={1.8} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.4" />
              {isMetal && transfer >= 0.85 && <MetalPiece x={metalCup.x} y={metalCup.y} d={metalD} color={metalInfo.color} />}
              <rect x={CX - style.top / 2} y={levelY} width={style.top} height={CUP_BOTTOM - levelY} fill={waterColor} opacity="0.45" />
              <rect x={CX - style.top / 2} y={levelY} width={style.top} height={CUP_BOTTOM - levelY} fill="url(#kit-liquid-shade)" />
              <line x1={CX - style.top / 2} x2={CX + style.top / 2} y1={levelY} y2={levelY} stroke={shade(waterColor, -0.35)} strokeWidth="1.4" />
            </g>
            <path d={outer} fill={container === 'vidrio' ? 'url(#kit-glass)' : 'url(#cal-cup-shade)'} stroke={container === 'vidrio' ? 'var(--glass-edge, #8fa9b3)' : 'none'} strokeWidth="1.6" />
            {container === 'lata' && <rect x={CX - style.top / 2 - 2} y={CUP_TOP - 2} width={style.top + 4} height={4} rx={2} fill="url(#kit-metal)" stroke="#8a969a" strokeWidth="0.5" />}
            {container === 'icopor' && <rect x={CX - style.top / 2 - 2} y={CUP_TOP - 1} width={style.top + 4} height={5} rx={2.5} fill="#fbfaf5" stroke="#cfccbf" strokeWidth="0.6" />}
            {container === 'vidrio' && <rect x={CX - style.top / 2 + 6} y={CUP_TOP + 10} width={3} height={CUP_H - 26} rx={1.5} fill="#fff" opacity="0.4" />}
            {/* tapa de icopor con orificios */}
            <rect x={CX - style.top / 2 - 8} y={lidY} width={style.top + 16} height={LID_H} rx={3} fill="url(#cal-foam)" stroke="#bdbbb0" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
            <ellipse cx={holeX} cy={lidY + 3} rx={6} ry={2} fill="#6f6b5e" opacity="0.7" />
            {pouring && (
              <path d={`M${BATH.x + BATH.w + pourTarget.dx - 1} ${BATH.y + pourTarget.dy + 5} Q ${holeX - 14} ${lidY - 18} ${holeX} ${lidY + 3}`} fill="none" stroke={waterColor} strokeWidth="4.5" strokeLinecap="round" opacity="0.8" />
            )}
            {/* sonda y agitador por encima de la tapa */}
            <rect x={stirX - 1.5} y={CUP_TOP - 44 + stirBob} width={3} height={40} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.4" />
            <rect x={stirX - 5} y={CUP_TOP - 50 + stirBob} width={10} height={7} rx={2} fill="#3b4648" />
            <rect x={probeX - 1.8} y={CUP_TOP - 46} width={3.6} height={42} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.4" />
            <rect x={probeX - 4.5} y={CUP_TOP - 62} width={9} height={18} rx={3} fill="#2f3a3d" />
            <text x={CX - 20} y={CUP_TOP - 92} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink)', fontWeight: 600 }}>
              Calorímetro: {vessel.short.toLowerCase()} con tapa (corte)
            </text>

            {/* metal en el aire o colgando del hilo */}
            {isMetal && transfer < 0.85 && <MetalPiece x={metalPos.x} y={metalPos.y} d={metalD} color={metalInfo.color} />}

            {/* flujos de calor */}
            {transfer >= 1 && Math.abs(flows.toAir) > 0.05 && (
              <g>
                <HeatArrow x={flows.toAir > 0 ? CX - style.top / 2 - 6 : CX - style.top / 2 - 50} y={CUP_TOP + 52} dir={flows.toAir > 0 ? -1 : 1} size={flowScale(flows.toAir)} label={flows.toAir > 0 ? 'calor al aire' : 'calor del aire'} />
                <HeatArrow x={flows.toAir > 0 ? CX + style.top / 2 + 6 : CX + style.top / 2 + 50} y={CUP_TOP + 92} dir={flows.toAir > 0 ? 1 : -1} size={flowScale(flows.toAir)} />
              </g>
            )}
            {isMetal && transfer >= 1 && Math.abs(flows.toWater) > 0.3 && (
              // halo de calor alrededor del metal: más intenso cuanto mayor es el flujo hacia el agua
              <g aria-hidden="true" opacity={0.25 + 0.75 * flowScale(flows.toWater / 10)}>
                {[4, 9].map((g) => (
                  <rect key={g} x={metalCup.x - metalD / 2 - g} y={metalCup.y - metalD / 2 - g} width={metalD + 2 * g} height={metalD + g + 2} rx={g + 2}
                    fill="none" stroke={flows.toWater > 0 ? 'var(--bad)' : 'var(--data)'} strokeWidth={g === 4 ? 2 : 1.4} strokeDasharray={g === 4 ? '5 3' : '3 4'} opacity={g === 4 ? 0.9 : 0.55} />
                ))}
              </g>
            )}
            {transfer >= 1 && (
              <text x={20} y={VIEW_Y + 20} style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>
                <tspan fill="var(--bad)" style={{ fontWeight: 700 }}>Rojo</tspan>: calor que pasa {isMetal ? 'del metal al agua y ' : ''}del vaso al aire (o al revés).
              </text>
            )}

            <DigitalThermometer x={540} y={136} text={fmt(lcdTemp, 1)} probeX={probeX} probeY={CUP_TOP - 60} />
            <Stopwatch x={556} y={288} text={clock(simT)} label="tiempo" />
            <text x={CX + 40} y={BENCH_Y + 30} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>
              Balanza tarada con el vaso vacío: marca el agua{transfer >= 1 ? ' más la muestra' : ''}.
            </text>
          </svg>
        </div>

        <div className="grid-2">
          <div className="stack">
            <h3>Lecturas antes de mezclar</h3>
            <Readout items={[
              { k: isMetal ? 'Masa del metal' : 'Masa del agua caliente', v: `${fmt(readings.sampleMass, 1)} g`, data: true },
              { k: isMetal ? 'Temperatura inicial del metal' : 'Temperatura inicial del agua caliente', v: `${fmt(readings.sampleTemp, 1)} °C`, data: true },
              { k: 'Masa de agua en el calorímetro', v: `${fmt(readings.waterMass, 1)} g`, data: true },
              { k: 'Temperatura inicial del calorímetro', v: `${fmt(readings.waterTemp, 1)} °C`, data: true },
            ]} />
            <h3>Equilibrio térmico</h3>
            <Readout items={[
              { k: 'Temperatura de equilibrio (lectura)', v: show(`${fmt(readings.te, 1)} °C`), data: true },
              { k: 'Tiempo hasta el equilibrio', v: show(`${fmt(sim.tEq, 0)} s`) },
              { k: 'Temperatura a los 10 min', v: show(`${fmt(readings.t10, 1)} °C`), data: true },
              { k: 'Temperatura de equilibrio esperada sin pérdidas', v: show(a.tePredicted === null ? 'no calculable (c desconocido)' : `${fmt(a.tePredicted, 1)} °C`) },
            ]} />
          </div>
          <div className="stack">
            <h3>Balance de calor (Q = m·c·ΔT)</h3>
            <Readout items={[
              { k: isMetal ? 'Calor cedido por el metal' : 'Calor cedido por el agua caliente', v: show(a.qGiven === null ? 'no calculable (c desconocido)' : `${fmt(a.qGiven, 0)} J`), data: true },
              { k: 'Calor ganado por el agua del calorímetro', v: show(`${fmt(a.qWater, 0)} J`), data: true },
              { k: 'Calor ganado por el vaso', v: show(`${fmt(a.qVessel, 0)} J`) },
              { k: 'Diferencia (calor intercambiado con el aire)', v: show(lossText) },
              isMetal
                ? { k: 'Calor específico calculado del metal', v: show(cText), data: true }
                : { k: 'Capacidad calorífica del vaso (calculada)', v: show(a.cVessel === null ? 'no calculable (ΔT muy pequeño)' : `${fmt(a.cVessel, 0)} J/°C`), data: true },
            ]} />
            {done && isMetal && nearest && (
              <Notice kind="info">El valor más cercano de la tabla es el del {nearest.name.toLowerCase()} ({fmt(nearest.c, 3)} J/(g·°C)).{metal === 'desconocido' ? ' Compáralo también con la densidad: la muestra X es mucho más liviana que el hierro o el zinc del mismo tamaño.' : ''}</Notice>
            )}
            {done && a.qDiff !== null && a.qDiff < 0 && (
              <Notice kind="warn">El calorímetro ganó más calor del que cedió la muestra: la mezcla quedó por debajo de {fmt(ROOM_T, 0)} °C y el aire del salón le entregó calor.</Notice>
            )}
          </div>
        </div>

        <Chart title="Temperatura del agua del calorímetro en función del tiempo" xLabel="Tiempo (s)" yLabel="Temperatura (°C)" xUnit="s" yUnit="°C" height={250}
          exportName="calor-temperatura-tiempo" xDomain={[0, RECORD_S]}
          hLines={done ? [{ y: ROOM_T, label: `Salón ${fmt(ROOM_T, 0)} °C` }, ...(a.tePredicted === null ? [] : [{ y: a.tePredicted, label: 'Tₑ sin pérdidas' }])] : undefined}
          series={chartPoints.length ? [
            { label: 'Termómetro del calorímetro (cada 5 s)', color: 'var(--series-1)', kind: 'line', points: chartPoints.map((p) => ({ x: p.t, y: p.T })) },
            { label: isMetal ? 'Metal (modelo, no se mide)' : 'Agua caliente (modelo, no se mide)', color: 'var(--series-2)', kind: 'line', dashed: true, points: series.slice(0, chartPoints.length).map((p) => ({ x: p.t, y: p.sample })) },
          ] : []}
          emptyText="Pulsa «Mezclar y medir» para registrar la curva temperatura–tiempo." />

        <SensorCard intro={`Interfaz con dos sondas de temperatura sobre el mismo montaje: una en el agua del calorímetro y otra en ${isMetal ? 'el metal (termopar en un orificio)' : 'el agua caliente'}. El registrador simula la mezcla desde t = 0 con las condiciones actuales; observa cómo las dos curvas se juntan (equilibrio térmico) y luego derivan juntas hacia ${fmt(ROOM_T, 0)} °C.`}>
          <DataLogger title="Interfaz de sensores · calorimetría" channels={sensorChannels} duration={RECORD_S} speed={30} rates={[1, 2, 5]} defaultRate={1}
            resetKey={conditions} runLabel={conditions} onUseRun={setSensorRun} />
          {sensorRun && (
            <div className="stack-sm">
              <h3>Corrida en uso</h3>
              <p className="small muted" style={{ margin: 0 }}>{sensorRun.label} · {sensorRun.samples.length} muestras a {fmt(sensorRun.rate, 0)} muestras/s.</p>
              <LoggerRunCharts run={sensorRun} />
            </div>
          )}
        </SensorCard>

        <details className="card">
          <summary>Recipientes y tabla de calores específicos</summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Características de los recipientes">
            <table>
              <caption className="sr-only">Capacidad calorífica y pérdidas de cada recipiente con tapa</caption>
              <thead><tr><th scope="col">Recipiente</th><th scope="col" className="n">Masa (g)</th><th scope="col" className="n">Capacidad calorífica (J/°C)</th><th scope="col" className="n">Pérdidas (W/°C)</th></tr></thead>
              <tbody>
                {CONTAINERS.map((c) => (
                  <tr key={c.id}><td>{c.name}</td><td className="n">{fmt(c.mass, 1)}</td><td className="n">{fmt(c.mass * c.c, 1)}</td><td className="n">{fmt(c.loss, 2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Calores específicos de referencia">
            <table>
              <caption className="sr-only">Calor específico de algunas sustancias a 25 °C</caption>
              <thead><tr><th scope="col">Sustancia</th><th scope="col" className="n">Calor específico (J/(g·°C))</th></tr></thead>
              <tbody>
                {SPECIFIC_HEAT_TABLE.map((m) => <tr key={m.name}><td>{m.name}</td><td className="n">{fmt(m.c, 3)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="small muted">Pérdidas: calor que sale por segundo por cada grado de diferencia con el aire. Un vaso con pérdidas de 0,40 W/°C y el agua 10 °C por encima del salón pierde 4 J cada segundo.</p>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Segmented<ExperimentId> label="Qué se agrega al calorímetro" value={experiment} onChange={chooseExperiment}
            options={[{ value: 'agua', label: EXP_LABEL.agua }, { value: 'metal', label: EXP_LABEL.metal }]} />
          {isMetal && (
            <Select label="Muestra de metal" value={metal} onChange={(v) => setMetal(v as MetalId)}
              options={METALS.map((m) => ({ value: m.id, label: m.name }))} />
          )}
          <Segmented<ContainerId> label="Recipiente del calorímetro" value={container} onChange={setContainer}
            options={CONTAINERS.map((c) => ({ value: c.id, label: c.short }))} />
          <Slider label={isMetal ? 'Masa del metal' : 'Masa del agua caliente'} value={sampleMass} min={HEAT_LIMITS.sampleMass[0]} max={HEAT_LIMITS.sampleMass[1]} step={1} unit="g" decimals={0} onChange={setSampleMass} />
          <Slider label={isMetal ? 'Temperatura del metal' : 'Temperatura del agua caliente'} value={sampleTemp} min={HEAT_LIMITS.sampleTemp[0]} max={HEAT_LIMITS.sampleTemp[1]} step={1} unit="°C" decimals={0} onChange={setSampleTemp}
            hint={isMetal ? 'El metal se calienta varios minutos en agua; hirviendo, a ≈ 99 °C en Urabá.' : undefined} />
          <Slider label="Masa de agua en el calorímetro" value={waterMass} min={HEAT_LIMITS.waterMass[0]} max={HEAT_LIMITS.waterMass[1]} step={1} unit="g" decimals={0} onChange={setWaterMass} />
          <Slider label="Temperatura inicial del agua del calorímetro" value={waterTemp} min={HEAT_LIMITS.waterTemp[0]} max={HEAT_LIMITS.waterTemp[1]} step={1} unit="°C" decimals={0} onChange={setWaterTemp} />
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={phase === 'midiendo'} onClick={start}>Mezclar y medir</button>
            <button type="button" className="btn" onClick={reset}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>
          Temperatura (°C): qué tan caliente está algo; no depende de la cantidad. Calor (J): energía que pasa de un cuerpo caliente a uno frío
          hasta que tienen la misma temperatura. El vaso de {vessel.short.toLowerCase()} absorbe {fmt(vesselC, 1)} J por cada °C que se calienta.
          El salón está a {fmt(ROOM_T, 0)} °C.
        </Notice>
      </div>
    </div>
  );
}

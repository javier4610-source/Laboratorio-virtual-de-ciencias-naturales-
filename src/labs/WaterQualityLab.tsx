import { useEffect, useMemo, useRef, useState } from 'react';
import {
  complies, NORMS, oxygenProfile, PROBE, RANGES, RIVERS, roundSig, saturationReading, simulateRiver, SOURCES,
  wqiFromReadings, type Family, type NormRef, type Readings, type RiverId, type SourceId, type TaxonGroup,
} from '../models/waterQuality';
import { fmt, fmtSig } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Select, Slider, Warnings } from '../components/ui';
import { Chart } from '../components/Chart';
import { useMeasure } from '../components/Measurement';
import type { LabProps } from './registry';
import { Beaker, BenchTop, ContactShadow, Lcd, TestTube, Thermometer } from './kit';
import { DragHandle, ManipHint, ManipScene } from './manipulate';

/* ------------------------------------------------------------------ utilidades */

type Phase = 'listo' | 'midiendo' | 'medido';
const DURATION = 2.4; // s

function hexToRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mezcla lineal de dos colores hexadecimales (t de 0 a 1). */
function mixHex(a: string, b: string, t: number): string {
  const u = Math.max(0, Math.min(1, t));
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * u)).join(', ')})`;
}
/** Color aparente del agua según su turbidez (clara → parda). */
const waterColor = (turbidity: number) => mixHex('#8cc4de', '#9b7a4c', Math.min(1, Math.sqrt(turbidity / 200)));

const fmtCf = (v: number) => (v >= 1e5 ? fmtSig(v, 2) : fmt(v, 0));

const NORM_VALUE: Record<NormRef['param'], (r: Readings) => number> = {
  od: (r) => r.od, pH: (r) => r.pH, coliforms: (r) => r.coliforms, turbidity: (r) => r.turbidity,
  nitrate: (r) => r.nitrate, phosphate: (r) => r.phosphate, ec: (r) => r.ec, bod5: (r) => r.bod5,
};
const NORM_FMT: Record<NormRef['param'], (v: number) => string> = {
  od: (v) => `${fmt(v, 2)} mg/L`, pH: (v) => fmt(v, 2), coliforms: (v) => `${fmtCf(v)} NMP/100 mL`, turbidity: (v) => `${fmt(v, 1)} UNT`,
  nitrate: (v) => `${fmt(v, 1)} mg/L`, phosphate: (v) => `${fmt(v, 2)} mg/L`, ec: (v) => `${fmt(v, 0)} µS/cm`, bod5: (v) => `${fmt(v, 1)} mg/L`,
};

/* ------------------------------------------------------------------ geometría del mapa */

const MAP = { x: 10, y: 8, w: 700, h: 186 };
const KM0 = RANGES.distance[0], KM1 = RANGES.distance[1];
const kmToX = (km: number) => 46 + ((km - KM0) / (KM1 - KM0)) * 628;
const xToKm = (x: number) => KM0 + ((x - 46) / 628) * (KM1 - KM0);
const riverY = (x: number) => 92 + 9 * Math.sin(x / 62) + 4 * Math.sin(x / 23 + 1);
const RIVER_HALF = 13;

function riverPath(): string {
  const top: string[] = [], bottom: string[] = [];
  for (let x = MAP.x + 2; x <= MAP.x + MAP.w - 2; x += 6) {
    top.push(`${x.toFixed(1)} ${(riverY(x) - RIVER_HALF).toFixed(1)}`);
    bottom.push(`${x.toFixed(1)} ${(riverY(x) + RIVER_HALF).toFixed(1)}`);
  }
  return `M${top.join(' L')} L${bottom.reverse().join(' L')} Z`;
}

/* ------------------------------------------------------------------ piezas del mapa */

function Houses({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden="true">
      {[0, 22, 44].map((dx, i) => (
        <g key={dx} transform={`translate(${x + dx} ${y + (i % 2) * 6})`}>
          <rect x={0} y={6} width={16} height={12} fill="#efe6d6" stroke="#8a7a62" strokeWidth="0.7" />
          <path d="M-2 7 L8 -1 L18 7 Z" fill="#b5523b" stroke="#7d3424" strokeWidth="0.7" />
          <rect x={6} y={11} width={4} height={7} fill="#6b4f2a" />
        </g>
      ))}
    </g>
  );
}

function BananaPlants({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden="true">
      {[0, 20, 40, 60].map((dx, i) => (
        <g key={dx} transform={`translate(${x + dx} ${y + (i % 2) * 5})`}>
          <rect x={-1.5} y={4} width={3} height={16} fill="#7b6a3a" />
          <path d="M0 5 Q-12 -2 -15 6 Q-8 4 0 7 Z" fill="#3f8a3a" />
          <path d="M0 5 Q12 -4 15 4 Q8 3 0 7 Z" fill="#4c9a44" />
          <path d="M0 4 Q-3 -8 3 -10 Q2 -2 1 5 Z" fill="#5aa84f" />
        </g>
      ))}
    </g>
  );
}

function TreatmentPlant({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden="true">
      {[0, 30].map((dx) => (
        <g key={dx}>
          <ellipse cx={x + dx + 12} cy={y + 14} rx={13} ry={6} fill="#c8d3d6" stroke="#7b8a8f" strokeWidth="0.8" />
          <ellipse cx={x + dx + 12} cy={y + 12} rx={10} ry={4} fill="#6f9fb3" />
        </g>
      ))}
      <rect x={x + 60} y={y + 2} width={16} height={16} fill="#dfe5e7" stroke="#7b8a8f" strokeWidth="0.8" />
    </g>
  );
}

/* ------------------------------------------------------------------ instrumentos del banco */

/** Medidor portátil de la sonda multiparamétrica con dos pantallas. */
function ProbeMeter({ x, y, main, second, mainUnit, secondUnit }: { x: number; y: number; main: string; second: string; mainUnit: string; secondUnit: string }) {
  const w = 124, h = 140;
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={w} height={h} rx={14} fill="url(#kit-body-dark)" stroke="#1a2022" />
      </g>
      <rect x={x + 6} y={y + 4} width={w - 12} height={86} rx={8} fill="#2b3436" />
      <Lcd x={x + 10} y={y + 16} w={w - 20} h={32} text={main} />
      <Lcd x={x + 10} y={y + 60} w={w - 20} h={24} text={second} />
      <text x={x + 12} y={y + 13} style={{ fontSize: 7.5, fill: '#c9d2d5', fontWeight: 700, letterSpacing: 0.5 }}>OD</text>
      <text x={x + w - 12} y={y + 13} textAnchor="end" style={{ fontSize: 7.5, fill: '#c9d2d5' }}>{mainUnit}</text>
      <text x={x + 12} y={y + 57} style={{ fontSize: 7.5, fill: '#c9d2d5', fontWeight: 700, letterSpacing: 0.5 }}>TEMP.</text>
      <text x={x + w - 12} y={y + 57} textAnchor="end" style={{ fontSize: 7.5, fill: '#c9d2d5' }}>{secondUnit}</text>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x + 14 + i * 34} y={y + 98} width={26} height={12} rx={4} fill="url(#kit-body)" opacity="0.9" />
      ))}
      <text x={x + w / 2} y={y + 128} textAnchor="middle" style={{ fontSize: 8, fill: '#c9d2d5', letterSpacing: 1 }}>MULTIPARÁMETRO</text>
      <rect x={x + w / 2 - 8} y={y - 6} width={16} height={8} rx={2} fill="#1a2022" />
    </g>
  );
}

/** Sonda sumergible: cuerpo metálico con protector perforado. */
function Sonde({ cx, top }: { cx: number; top: number }) {
  return (
    <g>
      <rect x={cx - 7} y={top} width={14} height={62} rx={4} fill="url(#kit-metal-h)" stroke="#7d898d" strokeWidth="0.8" />
      <rect x={cx - 8} y={top + 62} width={16} height={22} rx={3} fill="#263033" />
      {[0, 1, 2].map((i) => <circle key={i} cx={cx} cy={top + 67 + i * 6} r={1.8} fill="#9aa5a9" />)}
      <rect x={cx - 5} y={top + 6} width={2.5} height={48} rx={1} fill="#fff" opacity="0.4" />
    </g>
  );
}

/** Botella Winkler para la DBO₅ con tapón esmerilado y etiqueta. */
function WinklerBottle({ x, y, liquid, filled, label }: { x: number; y: number; liquid: string; filled: boolean; label: string }) {
  const w = 42, h = 84;
  const body = `M${x + 14} ${y + 14} L${x + 14} ${y + 26} Q${x} ${y + 34} ${x} ${y + 50} L${x} ${y + h - 6} Q${x} ${y + h} ${x + 6} ${y + h} L${x + w - 6} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 6} L${x + w} ${y + 50} Q${x + w} ${y + 34} ${x + w - 14} ${y + 26} L${x + w - 14} ${y + 14} Z`;
  return (
    <g>
      <path d={body} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
      {filled && <path d={body} fill={liquid} opacity="0.55" />}
      <path d={body} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
      <path d={`M${x + 12} ${y + 14} L${x + w - 12} ${y + 14} L${x + w - 15} ${y + 2} Q${x + w / 2} ${y - 4} ${x + 15} ${y + 2} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      <rect x={x + 6} y={y + 52} width={w - 12} height={18} rx={2} fill="#fbfaf5" stroke="#d6cfbf" strokeWidth="0.6" />
      <text x={x + w / 2} y={y + 64} textAnchor="middle" style={{ fontSize: 8, fill: '#2b2b2b', fontWeight: 700 }}>{label}</text>
      <rect x={x + 4} y={y + 36} width={2.5} height={h - 44} rx={1} fill="#fff" opacity="0.4" />
    </g>
  );
}

/** Larva o adulto de macroinvertebrado dibujado según su grupo. */
function Bug({ group, x, y, s = 1 }: { group: TaxonGroup; x: number; y: number; s?: number }) {
  const t = `translate(${x} ${y}) scale(${s})`;
  const ink = '#3d2c17';
  switch (group) {
    case 'efemeroptero':
      return (
        <g transform={t}>
          <ellipse cx={0} cy={0} rx={8} ry={2.6} fill="#8a6a3e" stroke={ink} strokeWidth="0.5" />
          <circle cx={-8.5} cy={0} r={2.4} fill="#6d522c" />
          {[-3, 0, 3].map((d) => <path key={d} d={`M${d} -2 l1.5 -3 M${d} 2 l1.5 3`} stroke="#b28a54" strokeWidth="0.8" />)}
          {[-1.5, 0, 1.5].map((d) => <path key={d} d={`M8 0 L16 ${d * 2}`} stroke={ink} strokeWidth="0.6" />)}
        </g>
      );
    case 'plecoptero':
      return (
        <g transform={t}>
          <ellipse cx={0} cy={0} rx={9} ry={3} fill="#a57b3b" stroke={ink} strokeWidth="0.5" />
          <ellipse cx={-9} cy={0} rx={3} ry={2.6} fill="#7d5a27" />
          <path d="M-11 -1 L-17 -5 M-11 1 L-17 5 M9 -1 L16 -4 M9 1 L16 4" stroke={ink} strokeWidth="0.6" fill="none" />
          {[-4, 0, 4].map((d) => <path key={d} d={`M${d} -3 l-1 -4 M${d} 3 l-1 4`} stroke={ink} strokeWidth="0.7" />)}
        </g>
      );
    case 'tricoptero':
      return (
        <g transform={t}>
          <rect x={-8} y={-3.5} width={15} height={7} rx={3.5} fill="#9a8f7c" stroke={ink} strokeWidth="0.5" />
          {[-5, -1, 3].map((d) => <circle key={d} cx={d} cy={(d % 2) * 0.8} r={1.6} fill="#c3b9a3" />)}
          <circle cx={-10} cy={0} r={2.2} fill="#5b4422" />
        </g>
      );
    case 'coleoptero':
      return (
        <g transform={t}>
          <ellipse cx={0} cy={0} rx={6} ry={4.5} fill="#4a3a22" stroke={ink} strokeWidth="0.5" />
          <line x1={0} x2={0} y1={-4} y2={4.5} stroke="#2a2014" strokeWidth="0.6" />
          <ellipse cx={-1.5} cy={-1.5} rx={1.6} ry={1} fill="#fff" opacity="0.3" />
          {[-2, 0, 2].map((d) => <path key={d} d={`M-5 ${d} l-3 ${d} M5 ${d} l3 ${d}`} stroke={ink} strokeWidth="0.6" />)}
        </g>
      );
    case 'odonato':
      return (
        <g transform={t}>
          <path d="M-6 0 Q0 -5 9 0 Q0 5 -6 0 Z" fill="#6f7d3a" stroke={ink} strokeWidth="0.5" />
          <circle cx={-7} cy={-2.2} r={2} fill="#4c5626" />
          <circle cx={-7} cy={2.2} r={2} fill="#4c5626" />
          {[-3, 0, 3].map((d) => <path key={d} d={`M${d} -3 l-2 -4 M${d} 3 l-2 4`} stroke={ink} strokeWidth="0.6" />)}
        </g>
      );
    case 'diptero':
      return (
        <g transform={t}>
          <path d="M-9 1 Q-4 -3 0 0 Q4 3 9 -1" fill="none" stroke="#b03a2e" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx={-9.5} cy={1} r={1.4} fill="#5b2016" />
        </g>
      );
    case 'hemiptero':
      return (
        <g transform={t}>
          <ellipse cx={0} cy={0} rx={6.5} ry={4} fill="#5d4a2f" stroke={ink} strokeWidth="0.5" />
          <path d="M-6 0 L-9 0" stroke={ink} strokeWidth="1.2" />
          <path d="M2 -3 l5 -5 M2 3 l5 5 M-2 -3 l-3 -4 M-2 3 l-3 4" stroke={ink} strokeWidth="0.7" />
        </g>
      );
    case 'megaloptero':
      return (
        <g transform={t}>
          <ellipse cx={0} cy={0} rx={10} ry={2.6} fill="#5a4630" stroke={ink} strokeWidth="0.5" />
          <circle cx={-10} cy={0} r={2.6} fill="#3e2f1e" />
          {[-6, -3, 0, 3, 6].map((d) => <path key={d} d={`M${d} -2 l0 -4 M${d} 2 l0 4`} stroke="#8a7350" strokeWidth="0.7" />)}
        </g>
      );
    case 'molusco':
      return (
        <g transform={t}>
          <path d="M-5 3 Q-6 -6 2 -6 Q8 -5 6 1 Q4 5 -1 4 Q-4 3 -2 0 Q0 -2 2 0" fill="#c9b48a" stroke="#6d5a35" strokeWidth="0.8" />
        </g>
      );
    case 'anelido':
      return (
        <g transform={t}>
          <path d="M-10 0 Q-6 -4 -2 0 T6 0 T12 -1" fill="none" stroke="#c0574b" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'crustaceo':
      return (
        <g transform={t}>
          <path d="M-9 -1 Q-2 -6 6 -2 Q9 1 6 4 Q2 2 -2 2 Q-6 2 -9 -1 Z" fill="#b8a27c" stroke="#6d5a35" strokeWidth="0.6" />
          <path d="M-9 -1 L-15 -6 M-9 0 L-15 -2" stroke="#6d5a35" strokeWidth="0.6" />
        </g>
      );
    default:
      return <ellipse cx={x} cy={y} rx={5} ry={2} fill="#7a6a5a" />;
  }
}

/** Bandeja blanca de clasificación con los organismos encontrados. */
function SortingTray({ x, y, families }: { x: number; y: number; families: Family[] | null }) {
  const w = 168, h = 62;
  const shown = (families ?? []).slice(0, 12);
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x} y={y} width={w} height={h} rx={6} fill="#f4f6f5" stroke="#b9c2c0" />
      </g>
      <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx={4} fill="#dfe9ea" opacity="0.9" />
      {shown.map((f, i) => (
        <Bug key={f.name} group={f.group} x={x + 20 + (i % 6) * 26} y={y + 20 + Math.floor(i / 6) * 22} s={1.1} />
      ))}
      {families && families.length > 12 && <text x={x + w - 8} y={y + h - 6} textAnchor="end" style={{ fontSize: 8, fill: '#3d4a48' }}>+{families.length - 12}</text>}
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function WaterQualityLab({ api }: LabProps) {
  const [river, setRiver] = useState<RiverId>('apartado');
  const [source, setSource] = useState<SourceId>('domestico');
  const [riverFlow, setRiverFlow] = useState(3);
  const [dischargeFlow, setDischargeFlow] = useState(300);
  const [riverTemp, setRiverTemp] = useState(27);
  const [distance, setDistance] = useState(5);
  const [phase, setPhase] = useState<Phase>('listo');
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const { measure, remeasure } = useMeasure();

  const res = useMemo(() => simulateRiver({ river, source, riverFlow, dischargeFlow, riverTemp, distance }), [river, source, riverFlow, dischargeFlow, riverTemp, distance]);
  const profile = useMemo(() => oxygenProfile({ river, source, riverFlow, dischargeFlow, riverTemp }, 129), [river, source, riverFlow, dischargeFlow, riverTemp]);

  const readings = useMemo<Readings>(() => {
    const s = res.site;
    const temp = measure(s.temp, { ...PROBE.temp, key: 'temp' });
    const od = measure(s.od, { ...PROBE.od, key: 'od' });
    return {
      temp, od, doSat: saturationReading(od, temp),
      pH: measure(s.pH, { ...PROBE.pH, key: 'pH' }),
      ec: measure(s.ec, { ...PROBE.ec, key: 'ec' }),
      turbidity: measure(s.turbidity, { ...PROBE.turb, key: 'turb' }),
      nitrate: measure(s.nitrate, { ...PROBE.no3, key: 'no3' }),
      phosphate: measure(s.phosphate, { ...PROBE.po4, key: 'po4' }),
      bod5: measure(s.bod5, { ...PROBE.dbo, key: 'dbo' }),
      coliforms: roundSig(measure(s.coliforms, { ...PROBE.cf, key: 'cf' }), 2),
    };
  }, [res, measure]);
  const wqi = useMemo(() => wqiFromReadings(readings, riverTemp), [readings, riverTemp]);

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setP(0); };
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); reset(); };

  useEffect(() => {
    if (phase !== 'midiendo') return;
    if (prefersReducedMotion()) { setP(1); setPhase('medido'); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const el = Math.max(0, (now - start) / 1000);
      if (el >= DURATION) { setP(1); setPhase('medido'); return; }
      setP(el / DURATION);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  const start = () => { remeasure('temp', 'od', 'pH', 'ec', 'turb', 'no3', 'po4', 'dbo', 'cf'); setP(0); setPhase('midiendo'); };

  const measured = phase === 'medido';
  const sampling = phase === 'midiendo';
  const fillP = measured ? 1 : sampling ? Math.min(1, p / 0.4) : 0;
  const lowerP = measured ? 1 : sampling ? Math.max(0, Math.min(1, (p - 0.4) / 0.35)) : 0;
  const sampleColor = waterColor(res.site.turbidity);
  const bmwp = res.bmwp;
  const positives = measured ? Math.max(0, Math.min(5, Math.round(Math.log10(Math.max(1, readings.coliforms)) - 1.5))) : 0;

  const record = () => api.addTrial('muestras', {
    rio: res.river.short,
    vertimiento: res.source.name,
    caudalRio: riverFlow,
    caudalVertimiento: dischargeFlow,
    temperaturaRio: riverTemp,
    distancia: distance,
    temperatura: readings.temp,
    pH: readings.pH,
    od: readings.od,
    saturacion: readings.doSat,
    conductividad: readings.ec,
    turbidez: readings.turbidity,
    nitratos: readings.nitrate,
    fosfatos: readings.phosphate,
    dbo5: readings.bod5,
    coliformes: readings.coliforms,
    logColiformes: Number(Math.log10(Math.max(1, readings.coliforms)).toFixed(2)),
    bmwp: bmwp.score,
    claseBmwp: `${bmwp.cls.roman} (${bmwp.cls.quality})`,
    ica: Number(wqi.value.toFixed(1)),
    claseIca: wqi.cls.quality,
  });

  /* ---------- mapa */
  const riverD = useMemo(() => riverPath(), []);
  const x0 = kmToX(0);
  const xs = kmToX(distance);
  const plume = dischargeFlow > 0 ? Math.min(0.75, 0.15 + res.wasteFraction * 3) : 0;
  const plumeColor = source === 'domestico' ? '#6b5a3a' : source === 'bananera' ? '#9b7a4c' : '#7d8a74';
  const plumeSegs = useMemo(() => {
    const segs: { x: number; o: number }[] = [];
    for (let km = 0; km < KM1; km += 0.5) segs.push({ x: kmToX(km), o: Math.exp(-km / 9) });
    return segs;
  }, []);
  const segW = kmToX(0.5) - kmToX(0) + 0.6;
  const ticks = [-2, 0, 5, 10, 15, 20, 25, 30];
  const xcVisible = measured && dischargeFlow > 0 && res.tc > 0 && res.xc <= KM1;

  const desc = `${res.river.short} con un vertimiento de ${fmt(dischargeFlow, 0)} L/s (${res.source.name.toLowerCase()}) en el kilómetro 0. ` +
    `Punto de muestreo a ${fmt(Math.abs(distance), 1)} km ${distance < 0 ? 'aguas arriba' : 'aguas abajo'}. ` +
    (measured ? `La sonda marca ${fmt(readings.od, 2)} mg/L de oxígeno disuelto a ${fmt(readings.temp, 1)} °C; en la bandeja hay ${bmwp.n} familias de macroinvertebrados.` : sampling ? 'Se está tomando la muestra.' : 'La sonda está en espera.');

  const odSeries = useMemo(() => profile.map((pt) => ({ x: pt.x, y: pt.od })), [profile]);
  const rowsRio = NORMS.filter((n) => n.scope !== 'vertimiento');
  const effluentNorms = NORMS.filter((n) => n.scope === 'vertimiento');

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox="0 0 720 430" label="Controles del muestreo" scene={
          <svg viewBox="0 0 720 430" role="img" aria-labelledby="agu-t agu-d">
            <title id="agu-t">Tramo de río con un vertimiento y equipo de análisis de agua</title>
            <desc id="agu-d">{desc}</desc>
            <defs>
              <linearGradient id="agu-water" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#5fa3cf" />
                <stop offset="0.5" stopColor="#3f86b8" />
                <stop offset="1" stopColor="#5fa3cf" />
              </linearGradient>
              <linearGradient id="agu-land" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#cfe3b4" />
                <stop offset="1" stopColor="#b5d39a" />
              </linearGradient>
              <clipPath id="agu-river-clip"><path d={riverD} /></clipPath>
            </defs>

            {/* ---------- vista aérea del tramo */}
            <g filter="url(#kit-shadow-soft)">
              <rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx={10} fill="url(#agu-land)" stroke="var(--line)" />
            </g>
            {Array.from({ length: 26 }, (_, i) => {
              const tx = MAP.x + 20 + i * 27;
              const ty = (i % 2 ? 44 : 140) + ((i * 7) % 11);
              return Math.abs(ty - riverY(tx)) > 24 && !(tx < x0 + 70 && tx > x0 - 30 && ty > 100) ? (
                <g key={i} aria-hidden="true">
                  <circle cx={tx} cy={ty} r={7} fill="#5f9a48" />
                  <circle cx={tx + 4} cy={ty - 3} r={5} fill="#76b25a" />
                </g>
              ) : null;
            })}
            <path d={riverD} fill="url(#agu-water)" stroke="#2f6f99" strokeWidth="1.2" />
            {plume > 0 && (
              <g clipPath="url(#agu-river-clip)">
                {plumeSegs.map((s) => <rect key={s.x} x={s.x} y={MAP.y} width={segW} height={MAP.h} fill={plumeColor} opacity={plume * s.o} />)}
              </g>
            )}
            {/* corriente */}
            <g aria-hidden="true">
              <path d={`M${MAP.x + 14} ${riverY(MAP.x + 14) - 22} l26 0`} stroke="#2f6f99" strokeWidth="1.6" />
              <path d={`M${MAP.x + 44} ${riverY(MAP.x + 14) - 22} l-7 -4 v8 Z`} fill="#2f6f99" />
            </g>
            <text x={MAP.x + 12} y={MAP.y + 18} style={{ fontSize: 12, fill: '#1f3b2a', fontWeight: 700 }}>{res.river.short} · vista aérea (simulada)</text>
            <text x={MAP.x + MAP.w - 12} y={MAP.y + 18} textAnchor="end" style={{ fontSize: 11, fill: '#1f3b2a' }}>Corriente →</text>

            {/* vertimiento */}
            {dischargeFlow > 0 && (
              <g>
                <path d={`M${x0} ${riverY(x0) + RIVER_HALF - 2} L${x0} ${riverY(x0) + 34}`} stroke="#5b6466" strokeWidth="5" strokeLinecap="round" />
                <path d={`M${x0} ${riverY(x0) + RIVER_HALF - 2} L${x0} ${riverY(x0) + 34}`} stroke="#9aa5a9" strokeWidth="2" />
                {source === 'domestico' && <Houses x={x0 - 20} y={riverY(x0) + 34} />}
                {source === 'bananera' && <BananaPlants x={x0 - 20} y={riverY(x0) + 36} />}
                {source === 'tratada' && <TreatmentPlant x={x0 - 14} y={riverY(x0) + 36} />}
              </g>
            )}
            <text x={x0 + 8} y={riverY(x0) + 30} style={{ fontSize: 10, fill: '#1f3b2a', fontWeight: 600 }}>{dischargeFlow > 0 ? 'Vertimiento' : 'Sin vertimiento'}</text>

            {/* punto crítico (después de medir, según el modelo) */}
            {xcVisible && (
              <g>
                <path d={`M${kmToX(res.xc)} ${riverY(kmToX(res.xc)) - RIVER_HALF - 2} l-5 -8 h10 Z`} fill="var(--bad)" />
                <text x={kmToX(res.xc)} y={riverY(kmToX(res.xc)) - RIVER_HALF - 13} textAnchor="middle" style={{ fontSize: 9, fill: '#7a1d14', fontWeight: 700 }}>punto crítico</text>
              </g>
            )}

            {/* punto de muestreo */}
            <g>
              <line x1={xs} x2={xs} y1={riverY(xs)} y2={riverY(xs) - 34} stroke="#1d2b33" strokeWidth="1.4" />
              <circle cx={xs} cy={riverY(xs)} r={4.5} fill="#ffd54f" stroke="#1d2b33" strokeWidth="1.2" />
              <rect x={Math.min(MAP.x + MAP.w - 92, Math.max(MAP.x + 4, xs - 44))} y={riverY(xs) - 52} width={88} height={18} rx={4} fill="#ffffff" stroke="#1d2b33" strokeWidth="0.8" />
              <text x={Math.min(MAP.x + MAP.w - 48, Math.max(MAP.x + 48, xs))} y={riverY(xs) - 39} textAnchor="middle" style={{ fontSize: 10, fill: '#1d2b33', fontWeight: 700 }}>Muestra: {fmt(distance, 1)} km</text>
            </g>

            {/* escala de distancias */}
            <line x1={kmToX(KM0)} x2={kmToX(KM1)} y1={172} y2={172} stroke="#1f3b2a" strokeWidth="1" />
            {ticks.map((k) => (
              <g key={k}>
                <line x1={kmToX(k)} x2={kmToX(k)} y1={168} y2={176} stroke="#1f3b2a" strokeWidth={k === 0 ? 1.6 : 1} />
                <text x={kmToX(k)} y={187} textAnchor="middle" style={{ fontSize: 9, fill: '#1f3b2a', fontFamily: 'var(--font-data)' }}>{k}</text>
              </g>
            ))}
            <text x={kmToX(KM1) + 4} y={176} style={{ fontSize: 9, fill: '#1f3b2a' }}>km</text>

            {/* ---------- mesa de análisis */}
            <BenchTop y={392} width={720} />
            {/* cable de la sonda */}
            <path d={`M${86} ${246} C${86} ${214}, ${204} ${206}, ${204} ${212 + lowerP * 82}`} fill="none" stroke="#56636a" strokeWidth="2.4" />
            <ProbeMeter x={24} y={250}
              main={measured ? fmt(readings.od, 2) : sampling && lowerP > 0.5 ? '· · ·' : '- - -'} mainUnit="mg/L"
              second={measured ? fmt(readings.temp, 1) : '- - -'} secondUnit="°C" />
            <Beaker x={170} y={278} w={100} h={112} fill={0.72 * fillP} liquid={sampleColor} liquidOpacity={0.7} />
            <Sonde cx={204} top={210 + lowerP * 82} />
            <Thermometer x={250} y={226} h={150} min={0} max={40} value={measured ? readings.temp : 25} />
            <WinklerBottle x={300} y={306} liquid={sampleColor} filled={measured} label="DBO₅" />
            <WinklerBottle x={350} y={306} liquid={sampleColor} filled={measured} label="OD₀" />
            <ContactShadow x={410} y={391} w={112} h={7} />
            {/* gradilla con tubos de coliformes */}
            <g>
              <rect x={410} y={344} width={112} height={8} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
              <rect x={410} y={382} width={112} height={8} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
              {[0, 1, 2, 3, 4].map((i) => (
                <TestTube key={i} x={418 + i * 21} y={318} w={14} h={70} fill={measured ? 0.62 : 0.62 * fillP}
                  liquid={i < positives ? '#e6c229' : '#b9a3c9'} liquidOpacity={0.75}>
                  {i < positives && <ellipse cx={425 + i * 21} cy={340} rx={3} ry={2} fill="#fff" opacity="0.9" />}
                </TestTube>
              ))}
              <rect x={412} y={352} width={4} height={30} fill="#b8975a" />
              <rect x={516} y={352} width={4} height={30} fill="#b8975a" />
            </g>
            <SortingTray x={540} y={326} families={measured ? bmwp.families : null} />
            {/* red de pantalla apoyada */}
            <g aria-hidden="true">
              <line x1={560} x2={700} y1={318} y2={244} stroke="#7b6a3a" strokeWidth="3" strokeLinecap="round" />
              <path d={`M660 230 L708 258 L694 300 L650 270 Z`} fill="#e8eef0" opacity="0.6" stroke="#8c979b" strokeWidth="0.8" />
              {[0, 1, 2, 3].map((i) => <line key={i} x1={655 + i * 12} x2={651 + i * 12} y1={232 + i * 7} y2={272 + i * 7} stroke="#8c979b" strokeWidth="0.4" />)}
            </g>
            {/* rótulos */}
            {[[86, 'Sonda multiparamétrica'], [220, 'Muestra'], [346, 'DBO₅ (Winkler)'], [466, 'Coliformes (NMP)'], [624, 'Macroinvertebrados']].map(([lx, t]) => (
              <text key={t as string} x={lx as number} y={424} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{t as string}</text>
            ))}
          </svg>}>
            <DragHandle label="Punto de muestreo en el río: distancia al vertimiento" value={distance} min={RANGES.distance[0]} max={RANGES.distance[1]} step={0.5} pageStep={2} unit="km" decimals={1}
              orientation="horizontal" hit={{ x: xs - 14, y: riverY(xs) - 40, w: 28, h: 50 }}
              valueText={(v) => `${fmt(v, 1)} km ${v < 0 ? "aguas arriba del" : "aguas abajo del"} vertimiento`}
              valueFromPoint={({ point, start, startValue }) => startValue + xToKm(point.x) - xToKm(start.x)} onChange={change(setDistance)} />
          </ManipScene>
        </div>
        <ManipHint>Arrastra el punto de muestreo (amarillo) a lo largo del río, o enfócalo con Tab y usa las flechas.</ManipHint>

        <Readout items={[
          { k: 'Temperatura', v: measured ? `${fmt(readings.temp, 1)} °C` : '—', data: true },
          { k: 'pH', v: measured ? fmt(readings.pH, 2) : '—', data: true },
          { k: 'Oxígeno disuelto', v: measured ? `${fmt(readings.od, 2)} mg/L` : '—', data: true },
          { k: 'Saturación de oxígeno', v: measured ? `${fmt(readings.doSat, 1)} %` : '—', data: true },
          { k: 'Conductividad', v: measured ? `${fmt(readings.ec, 0)} µS/cm` : '—', data: true },
          { k: 'Turbidez', v: measured ? `${fmt(readings.turbidity, 1)} UNT` : '—', data: true },
          { k: 'Nitratos (NO₃⁻)', v: measured ? `${fmt(readings.nitrate, 1)} mg/L` : '—', data: true },
          { k: 'Fosfatos (PO₄³⁻)', v: measured ? `${fmt(readings.phosphate, 2)} mg/L` : '—', data: true },
          { k: 'DBO₅', v: measured ? `${fmt(readings.bod5, 1)} mg/L` : '—', data: true },
          { k: 'Coliformes fecales', v: measured ? `${fmtCf(readings.coliforms)} NMP/100 mL` : '—', data: true },
          { k: 'BMWP/Col', v: measured ? `${bmwp.score} · clase ${bmwp.cls.roman} (${bmwp.cls.quality})` : '—', data: true },
          { k: 'Índice de calidad (ICA tipo NSF)', v: measured ? `${fmt(wqi.value, 0)} · ${wqi.cls.quality}` : '—', data: true },
        ]} />
        {measured && <Warnings list={res.warnings} />}

        {measured && (
          <div className="card stack-sm">
            <h3>Curva de oxígeno del tramo (modelo de Streeter–Phelps)</h3>
            <Chart title="Oxígeno disuelto a lo largo del río" xLabel="Distancia al vertimiento (km)" yLabel="Oxígeno disuelto (mg/L)" xUnit="km" yUnit="mg/L"
              height={230} xDomain={[KM0, KM1]} exportName="curva-oxigeno"
              hLines={[{ y: 4, label: 'Referencia para la fauna: 4 mg/L' }]}
              series={[
                { label: 'Modelo de Streeter–Phelps', color: 'var(--series-1)', kind: 'line', points: odSeries },
                { label: 'Tu muestra', color: 'var(--series-2)', kind: 'scatter', points: [{ x: distance, y: readings.od }] },
              ]} />
            <Readout live={false} items={[
              { k: 'Punto crítico (distancia)', v: dischargeFlow > 0 ? (res.tc > 0 ? `${fmt(res.xc, 1)} km` : 'en el vertimiento') : 'no aplica' },
              { k: 'Tiempo de viaje al punto crítico', v: dischargeFlow > 0 && res.tc > 0 ? `${fmt(res.tc * 24, 1)} h` : '—' },
              { k: 'Oxígeno mínimo (modelo)', v: `${fmt(res.odMin, 2)} mg/L` },
              { k: 'k_d (desoxigenación)', v: `${fmt(res.kd, 2)} d⁻¹` },
              { k: 'k_a (reaireación)', v: `${fmt(res.ka, 2)} d⁻¹` },
              { k: 'Velocidad y profundidad del río', v: `${fmt(res.hyd.u, 2)} m/s · ${fmt(res.hyd.H, 2)} m` },
            ]} />
          </div>
        )}

        {measured && (
          <div className="card stack-sm">
            <h3>Macroinvertebrados de la muestra</h3>
            <p className="small">Familias encontradas: {bmwp.n}. BMWP/Col = {bmwp.score} (clase {bmwp.cls.roman}: {bmwp.cls.meaning}); ASPT = {fmt(bmwp.aspt, 2)}.</p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Familias de macroinvertebrados encontradas y sus puntajes BMWP/Col">
              <table>
                <caption className="sr-only">Familias encontradas, orden y puntaje BMWP/Col</caption>
                <thead><tr><th scope="col">Familia</th><th scope="col">Orden</th><th scope="col">Puntaje</th></tr></thead>
                <tbody>
                  {bmwp.families.map((f) => <tr key={f.name}><td>{f.name}</td><td>{f.order}</td><td>{f.score}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {measured && (
          <div className="card stack-sm">
            <h3>Comparación con valores de referencia</h3>
            <Notice kind="warn">Valores normativos citados como referencia para la discusión: el docente debe validarlos con el texto vigente de cada norma. La Resolución 2115 de 2007 aplica al agua ya potabilizada, no al río.</Notice>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Comparación de la muestra con valores de referencia de normas colombianas">
              <table>
                <caption className="sr-only">Parámetro, valor medido, referencia, norma y resultado</caption>
                <thead><tr><th scope="col">Criterio</th><th scope="col">Muestra</th><th scope="col">Referencia</th><th scope="col">Norma</th><th scope="col">¿Cumple?</th></tr></thead>
                <tbody>
                  {rowsRio.map((n) => {
                    const v = NORM_VALUE[n.param](readings);
                    const ok = complies(n, v);
                    return (
                      <tr key={n.id}>
                        <td>{n.label}</td><td>{NORM_FMT[n.param](v)}</td><td>{n.rule}</td><td className="small">{n.source}</td>
                        <td style={{ color: ok ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{ok ? 'Sí' : 'No'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Río, vertimiento y punto de muestreo</h3>
          <Select label="Tramo de río" value={river} onChange={(v) => { setRiver(v as RiverId); reset(); }}
            options={RIVERS.map((r) => ({ value: r.id, label: r.name }))} />
          <Select label="Tipo de vertimiento" value={source} onChange={(v) => { setSource(v as SourceId); reset(); }}
            options={SOURCES.map((s) => ({ value: s.id, label: s.name }))} hint={res.source.description} />
          <Slider label="Caudal del río" value={riverFlow} min={RANGES.riverFlow[0]} max={RANGES.riverFlow[1]} step={0.5} unit="m³/s" decimals={1} onChange={change(setRiverFlow)} />
          <Slider label="Caudal del vertimiento" value={dischargeFlow} min={RANGES.dischargeFlow[0]} max={RANGES.dischargeFlow[1]} step={10} unit="L/s" decimals={0} onChange={change(setDischargeFlow)} />
          <Slider label="Temperatura del río" value={riverTemp} min={RANGES.riverTemp[0]} max={RANGES.riverTemp[1]} step={0.5} unit="°C" decimals={1} onChange={change(setRiverTemp)} />
          <Slider label="Distancia al vertimiento" value={distance} min={RANGES.distance[0]} max={RANGES.distance[1]} step={0.5} unit="km" decimals={1} onChange={change(setDistance)}
            hint="Valores negativos: aguas arriba del vertimiento (estación de referencia)." />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={start} disabled={phase !== 'listo'}>Tomar muestra y medir</button>
            <button type="button" className="btn" onClick={reset} disabled={phase === 'listo'}>Nueva muestra</button>
          </div>
          <RecordButton onRecord={record} disabled={!measured} />
          {!measured && <p className="small muted">Toma la muestra y espera los resultados de la sonda, del laboratorio y del conteo de macroinvertebrados para guardar el ensayo.</p>}
        </div>
        <details className="card">
          <summary>Ficha del vertimiento (antes de mezclarse)</summary>
          <ul className="list small">
            <li>{res.source.name}: DBO₅ {fmt(res.source.bod5, 0)} mg/L; OD {fmt(res.source.dissolvedO2, 1)} mg/L; pH {fmt(res.source.pH, 1)}; coliformes fecales {fmtCf(res.source.coliforms)} NMP/100 mL.</li>
            <li>Carga orgánica: {fmt(res.bodLoadKgPerDay, 0)} kg de DBO₅ por día; dilución en el río: {Number.isFinite(res.dilution) ? `1 : ${fmt(res.dilution, 1)}` : 'sin vertimiento'}.</li>
            {effluentNorms.map((n) => {
              const v = n.param === 'bod5' ? res.source.bod5 : res.source.pH;
              return <li key={n.id}>{n.label}: {n.rule} ({n.source}). Este vertimiento: {complies(n, v) ? 'cumple' : 'no cumple'} (valor de referencia por validar).</li>;
            })}
          </ul>
        </details>
        <Notice>Datos simulados, no mediciones reales de los ríos Apartadó o León. El simulador entrega de inmediato la DBO₅ (5 días de incubación) y los coliformes (24 a 48 h). Seguridad en campo: botas, guantes, chaleco salvavidas y nunca muestrear solo ni con creciente.</Notice>
      </div>
    </div>
  );
}

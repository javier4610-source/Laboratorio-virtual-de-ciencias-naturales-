import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALYSTS, DURATION, EA_MARBLE, K_MARBLE_25, T_REF_C, findCatalyst, findParticle, KINETICS_LIMITS, PARTICLES, SETUP, simulateKinetics, SYRINGE_RES, TARGET_VOLUME, volumeAt,
  type Catalyst, type Particle, type Reaction,
} from '../models/kinetics';
import { R_GAS, roundToResolution } from '../models/math';
import { useModelParams, usePublishModel } from '../components/Advanced';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { Chart } from '../components/Chart';
import { DataLogger, LoggerRunCharts, SensorCard } from '../components/DataLogger';
import type { LoggerChannel, LoggerRun } from '../lib/logger';
import { Notice, Readout, RecordButton, Segmented, Slider, Warnings } from '../components/ui';
import { SimControls, simStatusOf, resolutionText } from '../components/Experiment';
import type { LabProps } from './registry';
import { BenchTop, ContactShadow, GasSyringe, Stopwatch, Thermometer } from './kit';
import { Knob, ManipHint, ManipScene } from './manipulate';

/** Frasco reactivo de vidrio ámbar con rótulo. */
function ReagentBottle({ x, label, conc }: { x: number; label: string; conc: string }) {
  const base = 292, w = 46, top = 196;
  const body = `M${x + 14} ${top + 12} L${x + 14} ${top + 22} Q${x} ${top + 26} ${x} ${top + 40} L${x} ${base - 4} Q${x} ${base} ${x + 4} ${base} L${x + w - 4} ${base} Q${x + w} ${base} ${x + w} ${base - 4} L${x + w} ${top + 40} Q${x + w} ${top + 26} ${x + w - 14} ${top + 22} L${x + w - 14} ${top + 12} Z`;
  return (
    <g>
      <path d={body} fill="#9a5a1c" opacity="0.88" filter="url(#kit-shadow-soft)" />
      <rect x={x + 2} y={top + 52} width={w - 4} height={base - top - 54} fill="#5b2f0b" opacity="0.45" />
      <path d={body} fill="url(#kit-glass)" stroke="#6b3a10" strokeWidth="1" />
      <rect x={x + 11} y={top} width={w - 22} height={14} rx={2} fill="#2b3335" />
      <rect x={x + 5} y={top + 50} width={w - 10} height={30} rx={2} fill="#fbfaf5" stroke="#d9d3c4" strokeWidth="0.6" />
      <text x={x + w / 2} y={top + 63} textAnchor="middle" style={{ fontSize: 9, fill: '#24312f', fontWeight: 700 }}>{label}</text>
      <text x={x + w / 2} y={top + 74} textAnchor="middle" style={{ fontSize: 7.5, fill: '#24312f', fontFamily: 'var(--font-data)' }}>{conc}</text>
      <rect x={x + 4} y={top + 34} width={3} height={base - top - 44} rx={1.5} fill="#fff" opacity="0.3" />
    </g>
  );
}

const W = 640, H = 316, BENCH_Y = 292;
/** Segundos simulados por segundo real (180 s en 6 s). */
const SPEED = 30;
/** Una burbuja dibujada por cada mL de gas; sube durante 18 s simulados. */
const RISE = 18;
const MAX_BUBBLES = 45;
/** Capacidad del erlenmeyer (mL), para el sensor de presión en matraz cerrado. */
const FLASK_VOLUME = 250;
const SY_X0 = 320, SY_PX = 240; // jeringa: 0 mL en x = 320, 100 mL en x = 560
const SURFACE_Y = 205, BASE_Y = 270;
const wallLeft = (y: number) => 120 - ((y - 150) * 50) / 120;
const wallRight = (y: number) => 150 + ((y - 150) * 50) / 120;
/** Contorno del erlenmeyer de 250 mL (cuello de 120 a 150, base redondeada). */
const flaskOutline = `M120 95 L120 150 L${wallLeft(BASE_Y - 6)} ${BASE_Y - 6} Q${wallLeft(BASE_Y) - 1} ${BASE_Y} ${wallLeft(BASE_Y) + 8} ${BASE_Y} L${wallRight(BASE_Y) - 8} ${BASE_Y} Q${wallRight(BASE_Y) + 1} ${BASE_Y} ${wallRight(BASE_Y - 6)} ${BASE_Y - 6} L150 150 L150 95`;
/** Número pseudoaleatorio estable en [0, 1) para la posición de cada burbuja. */
const hash = (j: number) => { const s = Math.sin(j * 12.9898) * 43758.5453; return s - Math.floor(s); };

const REACTIONS: { value: Reaction; label: string }[] = [
  { value: 'marmol', label: 'Mármol + HCl' },
  { value: 'peroxido', label: 'Agua oxigenada' },
];

export default function KineticsLab({ api }: LabProps) {
  const [reaction, setReaction] = useState<Reaction>('marmol');
  const [concHCl, setConcHCl] = useState(1);
  const [concH2O2, setConcH2O2] = useState(3);
  const [temp, setTemp] = useState(25);
  const [particle, setParticle] = useState<Particle>('granulado');
  const [catalyst, setCatalyst] = useState<Catalyst>('mno2');
  const [simT, setSimT] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const raf = useRef(0);
  const marble = reaction === 'marmol';
  const concentration = marble ? concHCl : concH2O2;
  const tLimits = marble ? KINETICS_LIMITS.tempMarmol : KINETICS_LIMITS.tempPeroxido;

  const P = useModelParams();
  const res = useMemo(
    () => simulateKinetics({ reaction, concentration, temperature: Math.min(temp, tLimits[1]), particle, catalyst, eaMarble: P.ea !== undefined ? P.ea * 1000 : undefined }),
    [reaction, concentration, temp, tLimits, particle, catalyst, P.ea],
  );
  usePublishModel(() => {
    const T = Math.min(temp, tLimits[1]) + 273.15;
    const cat = findCatalyst(catalyst);
    const ea = marble ? (P.ea !== undefined ? P.ea * 1000 : EA_MARBLE) : cat.ea;
    const k25 = marble ? K_MARBLE_25 : cat.k25;
    const x = (-ea / R_GAS) * (1 / T - 1 / (T_REF_C + 273.15));
    const kUnit = marble ? 's⁻¹·(mol/L)⁻¹' : 's⁻¹';
    return {
      vars: {
        x: { sym: 'x', name: 'Exponente de Arrhenius', value: x, decimals: 3 },
        Ea: { sym: 'E_{a}', name: 'Energía de activación', value: ea, unit: 'J/mol', decimals: 0 },
        R: { sym: 'R', name: 'Constante de los gases', value: R_GAS, unit: 'J/(mol·K)', decimals: 3 },
        T: { sym: 'T', name: 'Temperatura', value: T, unit: 'K', decimals: 2 },
        Tr: { sym: 'T_{ref}', name: 'Temperatura de referencia', value: T_REF_C + 273.15, unit: 'K', decimals: 2 },
        fA: { sym: 'f_{A}', name: 'Factor de Arrhenius (relativo a 25 °C)', value: Math.exp(x), decimals: 3 },
        k25: { sym: 'k_{25}', name: 'Constante de velocidad a 25 °C', value: k25, unit: kUnit, sig: 3 },
        k: { sym: 'k', name: 'Constante de velocidad', value: res.rateConstant, unit: kUnit, sig: 3 },
        v30: { sym: 'V_{30}', name: 'Volumen a 30 s (jeringa)', value: res.v30Reading, unit: 'mL', decimals: 0 },
        t30: { sym: 'Δt', value: 30, unit: 's', decimals: 0 },
        vel: { sym: 'v_{media}', name: 'Velocidad media 0–30 s', value: res.v30Reading / 30, unit: 'mL/s', decimals: 2 },
      },
      equations: [
        { title: 'Exponente de Arrhenius', lhs: 'x', expr: '−\\frac{[Ea]}{[R]}·(\\frac{1}{[T]} − \\frac{1}{[Tr]})' },
        { title: 'Efecto de la temperatura', lhs: 'fA', expr: 'e^{[x]}' },
        { title: 'Constante de velocidad', lhs: 'k', expr: '[k25]·[fA]', note: !marble && cat.enzyme ? 'La catalasa además pierde actividad al desnaturalizarse a temperaturas altas (no incluido en esta fórmula).' : undefined },
        { title: 'Velocidad media (lectura de la jeringa)', lhs: 'vel', expr: '\\frac{[v30]}{[t30]}' },
      ],
    };
  }, [res, temp, tLimits, catalyst, marble, P.ea]);
  /** Instante (s simulados) en que se libera cada mL de gas: da burbujas con frecuencia proporcional a la velocidad. */
  const emissions = useMemo(() => {
    const out: number[] = [];
    const s = res.series;
    let j = 1;
    for (let i = 1; i < s.length && j <= res.vFinal; i++) {
      while (j <= s[i].v && j <= res.vFinal) {
        const a = s[i - 1], b = s[i];
        out.push(a.t + ((j - a.v) / (b.v - a.v || 1)) * (b.t - a.t));
        j++;
      }
    }
    return out;
  }, [res]);

  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setDone(false); setSimT(0); };
  useEffect(reset, [reaction, concHCl, concH2O2, temp, particle, catalyst]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setSimT(DURATION); setRunning(false); setDone(true); return; }
    // Al reanudar tras una pausa, el cronómetro sigue desde el tiempo ya simulado.
    const start = performance.now() - (simT / SPEED) * 1000;
    const tick = (now: number) => {
      const el = Math.max(0, (now - start) / 1000) * SPEED;
      if (el >= DURATION) { setSimT(DURATION); setRunning(false); setDone(true); return; }
      setSimT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);

  const vNow = volumeAt(res.series, Math.min(DURATION, Math.max(0, simT)));
  const reading = roundToResolution(vNow, SYRINGE_RES);
  // Efervescencia mientras se desprende gas, más intensa cuanto mayor es la velocidad de reacción.
  const rateNow = volumeAt(res.series, Math.min(DURATION, simT + 2)) - vNow;
  const rate0 = Math.max(1e-6, volumeAt(res.series, 2));
  useSoundLoop('fizzing', running, 0.2 + 0.8 * Math.min(1, rateNow / rate0));
  const plungerX = SY_X0 + (Math.min(SETUP.syringeMax, vNow) / SETUP.syringeMax) * SY_PX;
  const remaining = marble ? Math.max(0, 1 - vNow / res.totalVolume) : 1;
  const tb = Math.max(0, Math.min(1, temp / 60));
  const bathColor = `rgba(${Math.round(90 + 150 * tb)},${Math.round(165 - 45 * tb)},${Math.round(230 - 150 * tb)},${(0.2 + 0.12 * tb).toFixed(2)})`;

  const paused = !running && !done && simT > 0;
  const bubbles = useMemo(() => {
    if (!running && !paused) return [];
    const visible: { j: number; age: number }[] = [];
    for (let j = emissions.length - 1; j >= 0 && visible.length < MAX_BUBBLES; j--) {
      const age = simT - emissions[j];
      if (age < 0) continue;
      if (age >= RISE) break;
      visible.push({ j, age });
    }
    return visible;
  }, [running, paused, simT, emissions]);

  const catalystName = findCatalyst(catalyst).name;

  /* Sensores en tiempo real: muestrean el mismo modelo con las condiciones actuales. */
  const [sensorRun, setSensorRun] = useState<LoggerRun | null>(null);
  const headspace = FLASK_VOLUME - (marble ? SETUP.acidVolume * 1000 : SETUP.peroxideVolume);
  const sensorChannels = useMemo<LoggerChannel[]>(() => [
    { id: 'volumen', name: 'Volumen de gas', unit: 'mL', resolution: 0.1, noise: 0.12, min: 0, max: SETUP.syringeMax, color: 'var(--series-1)', sample: (t) => volumeAt(res.series, t) },
    { id: 'presion', name: 'Presión (matraz cerrado)', unit: 'kPa', resolution: 0.1, noise: 0.08, min: 0, color: 'var(--series-2)', sample: (t) => SETUP.pressure * (1 + volumeAt(res.series, t) / headspace) },
  ], [res, headspace]);
  const conditions = marble
    ? `Mármol (${findParticle(particle).name.toLowerCase()}) + HCl ${fmt(concHCl, 1)} mol/L a ${fmt(temp, 0)} °C`
    : `Agua oxigenada al ${fmt(concH2O2, 1)} % con ${catalystName.toLowerCase()} a ${fmt(temp, 0)} °C`;
  const record = () => api.addTrial('ensayos', {
    reaccion: marble ? 'Mármol + HCl' : 'Agua oxigenada',
    concentracion: concentration,
    temperatura: temp,
    area: marble ? findParticle(particle).areaFactor : null,
    catalizador: marble ? '—' : catalystName,
    v30: res.v30Reading,
    velocidad: res.initialRate,
    t20: res.t20,
    vFinal: res.vFinalReading,
  });

  const solid = () => {
    if (marble) {
      const grow = Math.cbrt(remaining);
      if (remaining <= 0.002) return null;
      if (particle === 'trozos') return [95, 135, 172].map((x, i) => <rect key={i} x={x - 10 * grow} y={BASE_Y - 16 * grow - 1} width={20 * grow} height={16 * grow} rx={4 * grow} fill="#ece8df" stroke="#9d978a" />);
      if (particle === 'granulado') return Array.from({ length: 10 }, (_, i) => <circle key={i} cx={88 + i * 10 + (i % 2) * 3} cy={BASE_Y - 4 - (i % 3) * 3} r={4.5 * grow} fill="#ece8df" stroke="#9d978a" strokeWidth="0.8" />);
      return <rect x="80" y={BASE_Y - 4 * remaining - 1} width="110" height={4 * remaining + 1} fill="#ece8df" stroke="#9d978a" strokeWidth="0.6" />;
    }
    if (catalyst === 'mno2') return Array.from({ length: 24 }, (_, i) => <circle key={i} cx={84 + i * 4.3} cy={BASE_Y - 2 - (i % 2) * 2} r="2" fill="#3b3430" />);
    if (catalyst === 'catalasa') return [92, 116, 140, 166].map((x, i) => <rect key={i} x={x} y={BASE_Y - 9 - (i % 2) * 3} width="16" height="8" rx="3" fill="#e2cd8c" stroke="#8a7440" />);
    return null;
  };

  const status = done
    ? `Reacción terminada a los ${fmt(DURATION, 0)} s: ${fmt(res.vFinalReading, 0)} mL de gas en la jeringa.`
    : running ? 'La reacción está en curso.' : paused ? `Reacción en pausa a los ${fmt(Math.floor(simT), 0)} s.` : 'Montaje listo: la reacción no ha comenzado.';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox={`0 0 ${W} ${H}`} label="Controles del baño" scene={
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="vel-t vel-d">
            <title id="vel-t">{marble ? 'Mármol con ácido clorhídrico en un erlenmeyer conectado a una jeringa de 100 mL' : 'Agua oxigenada con catalizador en un erlenmeyer conectado a una jeringa de 100 mL'}</title>
            <desc id="vel-d">{`Baño a ${fmt(temp, 0)} °C. ${marble ? `HCl ${fmt(concHCl, 1)} mol/L y mármol en ${findParticle(particle).name.toLowerCase()}.` : `Agua oxigenada al ${fmt(concH2O2, 1)} % con catalizador: ${catalystName.toLowerCase()}.`} ${status}`}</desc>
            <BenchTop y={BENCH_Y} width={W} />
            {/* soporte universal que sujeta la jeringa */}
            <g filter="url(#kit-shadow-soft)">
              <rect x={492} y={BENCH_Y - 9} width={70} height={9} rx={2} fill="url(#kit-body-dark)" />
              <rect x={519} y={18} width={7} height={BENCH_Y - 26} rx={3} fill="url(#kit-metal-h)" stroke="#8f9a9e" strokeWidth="0.6" />
            </g>
            {/* termostato del baño (la perilla está en la capa de controles) */}
            <g filter="url(#kit-shadow-soft)"><rect x={36} y={108} width={52} height={58} rx={6} fill="url(#kit-body-dark)" /></g>
            <rect x={39} y={111} width={46} height={8} rx={3} fill="#fff" opacity="0.06" />
            <text x={62} y={163} textAnchor="middle" style={{ fontSize: 6, fill: "#c9d2d5", letterSpacing: 0.8 }}>TERMOSTATO</text>
            <circle cx={80} cy={116} r={2.4} fill={temp > 30 ? "#ff7043" : temp < 15 ? "#4fc3f7" : "#66bb6a"} />
            {/* baño de agua */}
            <ContactShadow x={30} y={BENCH_Y} w={222} h={8} />
            <rect x={30} y={166} width={222} height={BENCH_Y - 166} rx={4} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
            <rect x={33} y={182} width={216} height={BENCH_Y - 185} fill={bathColor} />
            <rect x={33} y={182} width={216} height={2.5} fill="#fff" opacity="0.4" />
            {/* erlenmeyer: líquido, sólido, burbujas y vidrio */}
            <path d={flaskOutline + ' Z'} fill="url(#kit-glass-fill)" />
            <path d={`M${wallLeft(SURFACE_Y) + 1.5} ${SURFACE_Y} L${wallLeft(BASE_Y - 6) + 1.5} ${BASE_Y - 6} Q${wallLeft(BASE_Y) + 1} ${BASE_Y - 1.5} ${wallLeft(BASE_Y) + 9} ${BASE_Y - 1.5} L${wallRight(BASE_Y) - 9} ${BASE_Y - 1.5} Q${wallRight(BASE_Y) - 1} ${BASE_Y - 1.5} ${wallRight(BASE_Y - 6) - 1.5} ${BASE_Y - 6} L${wallRight(SURFACE_Y) - 1.5} ${SURFACE_Y} Z`} fill={marble ? 'rgba(150,190,230,0.45)' : 'rgba(170,210,235,0.45)'} />
            <line x1={wallLeft(SURFACE_Y) + 1.5} x2={wallRight(SURFACE_Y) - 1.5} y1={SURFACE_Y} y2={SURFACE_Y} stroke="#6d93aa" strokeWidth="1.2" opacity="0.8" />
            {solid()}
            {bubbles.map(({ j, age }) => {
              const p = age / RISE;
              const y = BASE_Y - 8 - p * (BASE_Y - 8 - SURFACE_Y - 3);
              const l = wallLeft(y) + 6, r = wallRight(y) - 6;
              return <circle key={j} cx={l + hash(j) * (r - l)} cy={y} r={1.6 + 1.6 * hash(j + 7)} fill="rgba(255,255,255,0.35)" stroke="#5f8aa3" strokeWidth="0.9" opacity={0.95 - 0.5 * p} />;
            })}
            {/* tubo de desprendimiento de vidrio */}
            <rect x={132.5} y={52} width={5} height={78} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="0.8" />
            <path d={flaskOutline} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
            <path d="M117 95 L153 95" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="3" strokeLinecap="round" />
            <path d={`M${wallLeft(165) + 7} 165 L${wallLeft(255) + 8} 255`} stroke="#fff" strokeWidth="3" opacity="0.4" strokeLinecap="round" />
            {/* tapón de goma */}
            <path d="M113 80 L157 80 L153 102 L117 102 Z" fill="#6d3b30" />
            <path d="M113 80 L157 80 L156 85 L114 85 Z" fill="#8d5446" />
            <rect x={117} y={86} width={3} height={14} fill="#fff" opacity="0.18" />
            {/* tapa del baño (vidrio frontal) */}
            <rect x={30} y={166} width={222} height={BENCH_Y - 166} rx={4} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
            <Thermometer x={232} y={100} h={180} min={0} max={60} value={temp} />
            <text x="232" y="92" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{fmt(temp, 0)} °C</text>
            <text x="40" y="200" style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 600 }}>baño</text>
            {/* manguera de goma hasta la jeringa */}
            <path d={`M135 54 L135 44 Q135 34 145 34 L${SY_X0 - 44} 34 Q${SY_X0 - 32} 34 ${SY_X0 - 32} 46 Q${SY_X0 - 32} 58 ${SY_X0 - 20} 58 L${SY_X0 - 12} 58`} fill="none" stroke="#c98a4b" strokeWidth="6" strokeLinejoin="round" opacity="0.85" />
            <path d={`M135 54 L135 44 Q135 34 145 34 L${SY_X0 - 44} 34`} fill="none" stroke="#fff" strokeWidth="1.3" opacity="0.35" />
            {/* jeringa de gas sobre el soporte */}
            <GasSyringe x={SY_X0} y={40} length={SY_PX} height={36} fraction={(plungerX - SY_X0) / SY_PX} capacity={SETUP.syringeMax} major={20} gas="rgba(140,120,200,0.18)">
              {Array.from({ length: 11 }, (_, i) => i * 10).filter((v) => v % 20 !== 0).map((v) => (
                <line key={v} x1={SY_X0 + (v / 100) * SY_PX} x2={SY_X0 + (v / 100) * SY_PX} y1={76} y2={71} stroke="var(--glass-print, #24454a)" strokeWidth="0.8" />
              ))}
            </GasSyringe>
            <rect x={514} y={34} width={17} height={8} rx={2} fill="#2b3335" />
            <rect x={514} y={74} width={17} height={8} rx={2} fill="#2b3335" />
            {/* cronómetro */}
            <Stopwatch x={352} y={176} text={`${fmt(Math.floor(simT), 0)} s`} />
            <text x="330" y="116" style={{ fontSize: 12, fill: 'var(--ink)' }}>Gas en la jeringa: {fmt(reading, 0)} mL</text>
            <text x="330" y="134" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{marble ? 'CO₂' : 'O₂'} a 25 °C y 101,3 kPa</text>
            <ReagentBottle x={578} label={marble ? 'HCl' : 'H₂O₂'} conc={marble ? `${fmt(concHCl, 1)} M` : `${fmt(concH2O2, 1)} %`} />
          </svg>}>
            <Knob label="Perilla del termostato del baño" cx={62} cy={138} r={11} value={Math.min(temp, tLimits[1])} min={tLimits[0]} max={tLimits[1]} step={1} pageStep={5} unit="°C" decimals={0} onChange={setTemp} />
          </ManipScene>
        </div>
        <ManipHint>Gira la perilla del termostato (junto al baño) para fijar la temperatura, o enfócala con Tab y usa las flechas.</ManipHint>
        <Readout items={[
          { k: 'Cronómetro', v: `${fmt(Math.floor(simT), 0)} s`, resolution: resolutionText(1, 's') },
          { k: 'Volumen en la jeringa', v: `${fmt(reading, 0)} mL`, resolution: resolutionText(1, 'mL') },
          { k: 'Volumen a 30 s', v: done ? `${fmt(res.v30Reading, 0)} mL` : 'mide', data: true },
          { k: 'Volumen a 180 s', v: done ? `${fmt(res.vFinalReading, 0)} mL` : 'mide', data: true },
          { k: 'Velocidad inicial (0–30 s)', v: done ? `${fmt(res.initialRate, 2)} mL/s` : 'mide', data: true },
          { k: `Tiempo para recoger ${TARGET_VOLUME} mL`, v: done ? (res.t20 === null ? 'no se alcanzó' : `${fmt(res.t20, 0)} s`) : 'mide', data: true },
        ]} />
        {done && <Warnings list={res.warnings} />}
        <Chart title="Volumen de gas recogido en función del tiempo" xLabel="Tiempo (s)" yLabel="Volumen de gas (mL)" height={240}
          xDomain={[0, DURATION]} yDomain={[0, SETUP.syringeMax]} hLines={done ? [{ y: TARGET_VOLUME, label: '20 mL' }] : undefined}
          series={done ? [{ label: 'Lecturas de la jeringa (cada 10 s)', kind: 'both', points: res.readings.map((p) => ({ x: p.t, y: p.v })) }] : []}
          emptyText="Inicia la reacción para ver la curva volumen–tiempo." />
        <SensorCard intro={`Interfaz con dos sensores sobre el mismo montaje: volumen de gas (jeringa con sensor de desplazamiento) y presión del gas en el matraz si se tapara sin jeringa (${fmt(headspace, 0)} mL de espacio libre, temperatura constante). El registrador simula la reacción desde t = 0 con las condiciones actuales.`}>
          <DataLogger title="Interfaz de sensores · cinética" channels={sensorChannels} duration={DURATION} speed={SPEED} rates={[1, 2, 5, 10, 20]} defaultRate={2}
            ranges={[[0, SETUP.syringeMax], undefined]} resetKey={conditions} runLabel={conditions} onUseRun={setSensorRun} />
          {sensorRun && (
            <div className="stack-sm">
              <h3>Corrida en uso</h3>
              <p className="small muted" style={{ margin: 0 }}>{sensorRun.label} · {sensorRun.samples.length} muestras a {fmt(sensorRun.rate, 0)} muestras/s. La pendiente de la curva volumen–tiempo es la velocidad de la reacción (mL/s).</p>
              <LoggerRunCharts run={sensorRun} />
            </div>
          )}
        </SensorCard>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Segmented label="Reacción" value={reaction} options={REACTIONS} onChange={(v) => {
            setReaction(v);
            const max = v === 'marmol' ? KINETICS_LIMITS.tempMarmol[1] : KINETICS_LIMITS.tempPeroxido[1];
            setTemp((t) => Math.min(t, max));
          }} />
          {marble ? (
            <>
              <Slider label="Concentración de HCl" value={concHCl} min={KINETICS_LIMITS.hcl[0]} max={KINETICS_LIMITS.hcl[1]} step={0.1} unit="mol/L" decimals={1} onChange={setConcHCl} />
              <Segmented label="Partícula" value={particle} options={PARTICLES.map((p) => ({ value: p.id, label: p.name }))} onChange={setParticle} />
            </>
          ) : (
            <>
              <Slider label="Concentración de H₂O₂" value={concH2O2} min={KINETICS_LIMITS.h2o2[0]} max={KINETICS_LIMITS.h2o2[1]} step={0.5} unit="%" decimals={1} onChange={setConcH2O2} />
              <Segmented label="Catalizador" value={catalyst} options={CATALYSTS.map((c) => ({ value: c.id, label: c.id === 'mno2' ? 'Dióxido de manganeso' : c.name }))} onChange={setCatalyst} />
            </>
          )}
          <Slider label="Temperatura del baño" value={Math.min(temp, tLimits[1])} min={tLimits[0]} max={tLimits[1]} step={1} unit="°C" decimals={0} onChange={setTemp} />
          <SimControls title="Reacción y cronómetro" status={simStatusOf(running, simT > 0, done)} startLabel="Iniciar reacción y cronómetro" repeatLabel="Repetir la reacción"
            onStart={() => { setSimT(0); setDone(false); setRunning(true); playSound('pour', { duration: 0.5, intensity: 0.5 }); playSound('click', { intensity: 0.8 }); }}
            onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset}
            progress={{ value: Math.floor(simT), max: DURATION, unit: 's', label: 't' }} />
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>
          {marble
            ? '0,40 g de CaCO₃ y 50 mL de HCl (en exceso). Los 180 s de reacción se muestran en unos 6 s. Las constantes de velocidad y la energía de activación (45 kJ/mol) son ilustrativas.'
            : '5 mL de agua oxigenada. La catalasa de la papa es una enzima: se desnaturaliza por encima de unos 50 °C. Las constantes de velocidad son ilustrativas.'}
        </Notice>
      </div>
    </div>
  );
}

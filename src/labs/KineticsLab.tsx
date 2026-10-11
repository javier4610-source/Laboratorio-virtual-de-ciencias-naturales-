import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALYSTS, DURATION, findCatalyst, findParticle, KINETICS_LIMITS, PARTICLES, SETUP, simulateKinetics, SYRINGE_RES, TARGET_VOLUME, volumeAt,
  type Catalyst, type Particle, type Reaction,
} from '../models/kinetics';
import { roundToResolution } from '../models/math';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';

const W = 640, H = 300;
/** Segundos simulados por segundo real (180 s en 6 s). */
const SPEED = 30;
/** Una burbuja dibujada por cada mL de gas; sube durante 18 s simulados. */
const RISE = 18;
const MAX_BUBBLES = 45;
const SY_X0 = 340, SY_PX = 240; // jeringa: 0 mL en x = 340, 100 mL en x = 580
const SURFACE_Y = 205, BASE_Y = 270;
const wallLeft = (y: number) => 120 - ((y - 150) * 50) / 120;
const wallRight = (y: number) => 150 + ((y - 150) * 50) / 120;
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

  const res = useMemo(
    () => simulateKinetics({ reaction, concentration, temperature: Math.min(temp, tLimits[1]), particle, catalyst }),
    [reaction, concentration, temp, tLimits, particle, catalyst],
  );
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
    const start = performance.now();
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
  const plungerX = SY_X0 + (Math.min(SETUP.syringeMax, vNow) / SETUP.syringeMax) * SY_PX;
  const remaining = marble ? Math.max(0, 1 - vNow / res.totalVolume) : 1;

  const bubbles = useMemo(() => {
    if (!running) return [];
    const visible: { j: number; age: number }[] = [];
    for (let j = emissions.length - 1; j >= 0 && visible.length < MAX_BUBBLES; j--) {
      const age = simT - emissions[j];
      if (age < 0) continue;
      if (age >= RISE) break;
      visible.push({ j, age });
    }
    return visible;
  }, [running, simT, emissions]);

  const catalystName = findCatalyst(catalyst).name;
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
      if (particle === 'trozos') return [95, 135, 172].map((x, i) => <rect key={i} x={x - 10 * grow} y={BASE_Y - 16 * grow - 1} width={20 * grow} height={16 * grow} rx={4 * grow} fill="#ece8df" stroke="var(--ink-2)" />);
      if (particle === 'granulado') return Array.from({ length: 10 }, (_, i) => <circle key={i} cx={88 + i * 10 + (i % 2) * 3} cy={BASE_Y - 4 - (i % 3) * 3} r={4.5 * grow} fill="#ece8df" stroke="var(--ink-2)" strokeWidth="0.8" />);
      return <rect x="80" y={BASE_Y - 4 * remaining - 1} width="110" height={4 * remaining + 1} fill="#ece8df" stroke="var(--ink-2)" strokeWidth="0.6" />;
    }
    if (catalyst === 'mno2') return Array.from({ length: 24 }, (_, i) => <circle key={i} cx={84 + i * 4.3} cy={BASE_Y - 2 - (i % 2) * 2} r="2" fill="#3b3430" />);
    if (catalyst === 'catalasa') return [92, 116, 140, 166].map((x, i) => <rect key={i} x={x} y={BASE_Y - 9 - (i % 2) * 3} width="16" height="8" rx="3" fill="#e2cd8c" stroke="#8a7440" />);
    return null;
  };

  const status = done
    ? `Reacción terminada a los ${fmt(DURATION, 0)} s: ${fmt(res.vFinalReading, 0)} mL de gas en la jeringa.`
    : running ? 'La reacción está en curso.' : 'Montaje listo: la reacción no ha comenzado.';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="vel-t vel-d">
            <title id="vel-t">{marble ? 'Mármol con ácido clorhídrico en un erlenmeyer conectado a una jeringa de 100 mL' : 'Agua oxigenada con catalizador en un erlenmeyer conectado a una jeringa de 100 mL'}</title>
            <desc id="vel-d">{`Baño a ${fmt(temp, 0)} °C. ${marble ? `HCl ${fmt(concHCl, 1)} mol/L y mármol en ${findParticle(particle).name.toLowerCase()}.` : `Agua oxigenada al ${fmt(concH2O2, 1)} % con catalizador: ${catalystName.toLowerCase()}.`} ${status}`}</desc>
            {/* baño de agua */}
            <rect x="30" y="170" width="220" height="120" rx="6" fill="rgba(70,150,220,0.16)" stroke="var(--line)" />
            <text x="40" y="188" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>baño</text>
            <rect x="222" y="120" width="8" height="150" rx="4" fill="var(--surface)" stroke="var(--ink-2)" />
            <rect x="224" y={270 - 120 * ((temp - 0) / 60)} width="4" height={120 * (temp / 60)} fill="var(--bad)" />
            <text x="226" y="112" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{fmt(temp, 0)} °C</text>
            {/* erlenmeyer */}
            <path d={`M${wallLeft(SURFACE_Y)} ${SURFACE_Y} L${wallLeft(BASE_Y)} ${BASE_Y} L${wallRight(BASE_Y)} ${BASE_Y} L${wallRight(SURFACE_Y)} ${SURFACE_Y} Z`} fill={marble ? 'rgba(150,190,230,0.35)' : 'rgba(170,210,235,0.35)'} />
            {solid()}
            {bubbles.map(({ j, age }) => {
              const p = age / RISE;
              const y = BASE_Y - 8 - p * (BASE_Y - 8 - SURFACE_Y - 3);
              const l = wallLeft(y) + 6, r = wallRight(y) - 6;
              return <circle key={j} cx={l + hash(j) * (r - l)} cy={y} r={1.6 + 1.6 * hash(j + 7)} fill="none" stroke="var(--ink-2)" strokeWidth="1" opacity={0.9 - 0.5 * p} />;
            })}
            <path d={`M120 95 L120 150 L${wallLeft(BASE_Y)} ${BASE_Y} L${wallRight(BASE_Y)} ${BASE_Y} L150 150 L150 95`} fill="none" stroke="var(--ink)" strokeWidth="2" />
            <rect x="115" y="82" width="40" height="16" rx="3" fill="#8d6e63" />
            {/* manguera */}
            <path d={`M135 82 L135 50 L${SY_X0 - 10} 50`} fill="none" stroke="var(--ink-2)" strokeWidth="4" strokeLinejoin="round" />
            {/* jeringa */}
            <rect x={SY_X0 - 12} y="44" width="12" height="12" fill="var(--surface-2)" stroke="var(--ink-2)" />
            <rect x={SY_X0} y="35" width={SY_PX + 10} height="30" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />
            <rect x={SY_X0} y="36" width={Math.max(0, plungerX - SY_X0)} height="28" fill="var(--qui)" opacity="0.25" />
            {Array.from({ length: 11 }, (_, i) => i * 10).map((v) => (
              <g key={v}>
                <line x1={SY_X0 + (v / 100) * SY_PX} x2={SY_X0 + (v / 100) * SY_PX} y1="65" y2={v % 20 === 0 ? 72 : 69} stroke="var(--ink-2)" />
                {v % 20 === 0 && <text x={SY_X0 + (v / 100) * SY_PX} y="84" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{v}</text>}
              </g>
            ))}
            <text x={SY_X0 + SY_PX + 14} y="84" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>mL</text>
            <rect x={plungerX} y="37" width="6" height="26" fill="var(--ink-2)" />
            <line x1={plungerX + 6} x2={plungerX + 60} y1="50" y2="50" stroke="var(--ink-2)" strokeWidth="4" />
            <rect x={plungerX + 60} y="36" width="5" height="28" fill="var(--ink-2)" />
            {/* cronómetro */}
            <rect x="470" y="140" width="130" height="58" rx="10" fill="var(--surface-2)" stroke="var(--line)" />
            <text x="535" y="174" textAnchor="middle" style={{ fontSize: 20, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>{fmt(Math.floor(simT), 0)} s</text>
            <text x="535" y="191" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>cronómetro</text>
            <text x="330" y="120" style={{ fontSize: 12, fill: 'var(--ink)' }}>Gas en la jeringa: {fmt(reading, 0)} mL</text>
            <text x="330" y="138" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{marble ? 'CO₂' : 'O₂'} a 25 °C y 101,3 kPa</text>
          </svg>
        </div>
        <Readout items={[
          { k: 'Cronómetro', v: `${fmt(Math.floor(simT), 0)} s` },
          { k: 'Volumen en la jeringa', v: `${fmt(reading, 0)} mL` },
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
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setSimT(0); setDone(false); setRunning(true); }} disabled={running}>Iniciar reacción y cronómetro</button>
            <button type="button" className="btn" onClick={reset}>Reiniciar</button>
          </div>
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

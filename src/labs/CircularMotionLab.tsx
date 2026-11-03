import { useEffect, useMemo, useRef, useState } from 'react';
import {
  carOnCurve, CM_LIMITS, curveConditions, diskAt, G, SURFACES, ucm, ucmConditions, type UcmInput,
} from '../models/circularMotion';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText, SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { curveScene, diskScene } from './circular3d';

type Station = 'mesa' | 'curva';
const TURNS = 10;
/** Después de cortar la cuerda, el disco se observa hasta que se aleja a 2r del eje (√3·r/v), como máximo 0,8 s. */
const afterCut = (radius: number, v: number) => Math.min(0.8, (Math.sqrt(3) * radius) / v);

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Si la cuerda se rompe, el disco sale disparado hacia afuera, en la dirección del radio.', answer: 'falso', feedback: 'Sale por la TANGENTE: sin la cuerda no hay fuerza neta y el disco sigue en línea recta con la velocidad que tenía en ese instante (primera ley de Newton). Mira la recta en la vista 3D.' },
  { id: 'i2', text: 'Un objeto que gira con rapidez constante no tiene aceleración.', answer: 'falso', feedback: 'La rapidez no cambia, pero la DIRECCIÓN de la velocidad sí: hay una aceleración centrípeta a_c = v²/r hacia el centro (19,7 m/s² con r = 0,5 m y T = 1 s).' },
  { id: 'i3', text: 'Existe una «fuerza centrífuga» que empuja el disco hacia afuera y por eso la cuerda se tensa.', answer: 'falso', feedback: 'Desde la mesa (sistema inercial) la única fuerza horizontal sobre el disco es la tensión, que apunta HACIA el eje. La cuerda se tensa porque debe desviar al disco de la línea recta.' },
  { id: 'i4', text: 'Si se duplica la rapidez del disco, la fuerza de la cuerda se cuadruplica.', answer: 'cierto', feedback: 'F = m·v²/r: al duplicar v, v² se multiplica por 4. Compruébalo bajando el período a la mitad y leyendo el sensor.' },
  { id: 'i5', text: 'Un carro pesado puede tomar una curva más rápido que uno liviano sin derrapar.', answer: 'falso', feedback: 'v_máx = √(μ·g·r) no depende de la masa: la fricción máxima (μ·m·g) y la fuerza necesaria (m·v²/r) crecen las dos con la masa.' },
];

export default function CircularMotionLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('mesa');
  const [radius, setRadius] = useState(0.5);
  const [massG, setMassG] = useState(200);
  const [period, setPeriod] = useState(1);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [cutAt, setCutAt] = useState<number | null>(null);
  const [cRadius, setCRadius] = useState(50);
  const [surface, setSurface] = useState('seco');
  const [speed, setSpeed] = useState(60);
  const raf = useRef(0);
  const { measure, remeasure, real } = useMeasure();

  const input: UcmInput = useMemo(() => ({ radius, massG, period }), [radius, massG, period]);
  const r = useMemo(() => ucm(input), [input]);
  const conds = useMemo(() => ucmConditions(input), [input]);
  const end = cutAt !== null ? cutAt + afterCut(radius, r.v) : TURNS * period;
  const st = useMemo(() => diskAt(input, Math.min(t, end), cutAt), [input, t, end, cutAt]);
  const sensor = instrument('movimiento-circular', 'sensor'), watch = instrument('movimiento-circular', 'cronometro');
  const Fread = measure(st.cut ? 0 : r.force, { ...sensor, key: 'fuerza' });
  const t10 = measure(TURNS * period, { ...watch, key: 'diezVueltas' });
  const Tmeas = t10 / TURNS;
  const counted = cutAt === null && t >= TURNS * period - 1e-9;

  const curve = useMemo(() => ({ radius: cRadius, surface, speedKmh: speed, massKg: 1000 }), [cRadius, surface, speed]);
  const car = useMemo(() => carOnCurve(curve), [curve]);
  const carConds = useMemo(() => curveConditions(curve), [curve]);

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); setCutAt(null); };
  useEffect(resetRun, [input]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(end); setRunning(false); return; }
    const k = Math.max(1, (TURNS * period) / 10); // las 10 vueltas duran a lo sumo 10 s de pantalla
    const start = performance.now() - (t / k) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * k;
      if (el >= end) { setT(end); setRunning(false); playSound('click', { intensity: 0.5 }); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, end]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= end - 1e-9 && !running && t > 0;
  const status = simStatusOf(running, t > 0, finished);

  usePublishModel(() => ({
    vars: {
      m: { sym: 'm', name: 'Masa del disco', value: r.m, unit: 'kg', decimals: 3 },
      r: { sym: 'r', name: 'Radio', value: radius, unit: 'm', decimals: 3 },
      T: { sym: 'T', name: 'Período', value: period, unit: 's', decimals: 2 },
      v: { sym: 'v', name: 'Rapidez tangencial', value: r.v, unit: 'm/s', decimals: 3 },
    },
    equations: [{ title: 'Rapidez tangencial', lhs: 'v', expr: '\\frac{2π·[r]}{[T]}' }, { title: 'Fuerza centrípeta', lhs: 'F', expr: '\\frac{[m]·[v]^2}{[r]}' }],
  }), [r, radius, period]);

  const scene = useMemo(() => (station === 'mesa' ? diskScene({ input, t: Math.min(t, end), cutAt }) : curveScene(curve, 0.5)), [station, input, t, end, cutAt, curve]);

  const recordSpin = () => {
    const v = (2 * Math.PI * radius) / Tmeas;
    api.addTrial('giros', { radio: radius, masa: massG, periodo: Number(Tmeas.toFixed(3)), v: Number(v.toFixed(3)), v2: Number((v * v).toFixed(3)), fuerza: Fread, Fteorica: Number(r.force.toFixed(3)) });
  };
  const recordCurve = () => api.addTrial('curvas', { superficie: SURFACES.find((s) => s.id === surface)?.name ?? surface, mu: car.mu, radioCurva: cRadius, vmax: Number(car.vmaxKmh.toFixed(1)), rapidez: speed, derrapa: car.skids ? 'sí' : 'no' });

  // dibujo 2D: vista desde arriba
  const px = (m: number) => 150 + m * 120;
  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'mesa', label: 'Mesa de aire' }, { value: 'curva', label: 'Carro en una curva' }]} />
        {station === 'mesa' ? (
          <>
            <div className="bench">
              <svg viewBox="0 0 420 300" role="img" aria-labelledby="mcu-b-t mcu-b-d">
                <title id="mcu-b-t">Mesa de aire vista desde arriba: disco atado a una cuerda que gira alrededor del eje</title>
                <desc id="mcu-b-d">{st.cut ? `La cuerda se cortó: el disco sigue en línea recta por la tangente, a ${fmt(st.dist * 100, 0)} cm del eje.` : `El disco gira en un círculo de ${fmt(radius * 100, 0)} cm; el sensor lee ${fmt(Fread, 2)} N.`}</desc>
                <rect width="420" height="300" rx="14" fill="var(--surface-2)" />
                <circle cx="150" cy="150" r={radius * 120} fill="none" stroke="var(--line-strong)" strokeDasharray="5 5" />
                {!st.cut && <line x1="150" y1="150" x2={px(st.pos[0])} y2={150 - st.pos[1] * 120} stroke="var(--ink)" strokeWidth="2" />}
                <circle cx="150" cy="150" r="7" fill="var(--ink-2)" />
                <circle cx={px(st.pos[0])} cy={150 - st.pos[1] * 120} r="11" fill="var(--series-4)" stroke="var(--ink)" />
                <line x1={px(st.pos[0])} y1={150 - st.pos[1] * 120} x2={px(st.pos[0]) + st.vel[0] * 12} y2={150 - st.pos[1] * 120 - st.vel[1] * 12} stroke="var(--data)" strokeWidth="3" markerEnd="url(#mcu-arr)" />
                <defs><marker id="mcu-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--data)" /></marker></defs>
                <rect x="300" y="20" width="104" height="44" rx="6" fill="var(--surface)" stroke="var(--ink)" />
                <text x="352" y="38" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>sensor de fuerza</text>
                <text x="352" y="56" textAnchor="middle" style={{ fontSize: 15, fontFamily: 'var(--font-data)', fill: 'var(--ink)', fontWeight: 700 }}>{fmt(Fread, 2)} N</text>
              </svg>
            </div>
            <Readout items={[
              { k: 'Sensor de fuerza (tensión)', v: `${fmt(Fread, 2)} N`, data: true, resolution: resolutionText(sensor.resolution, 'N') },
              { k: 'Cronómetro: 10 vueltas', v: counted ? `${fmt(t10, 2)} s → T = ${fmt(Tmeas, 3)} s` : 'haz girar el disco 10 vueltas', data: counted, resolution: counted ? resolutionText(watch.resolution, 's') : undefined },
              { k: 'Frecuencia y rapidez angular', v: `f = ${fmt(r.f, 3)} Hz (${fmt(r.rpm, 1)} rpm); ω = ${fmt(r.omega, 3)} rad/s` },
              { k: 'Rapidez tangencial v = 2πr/T', v: `${fmt(r.v, 3)} m/s` },
              { k: 'Aceleración centrípeta a_c = v²/r', v: `${fmt(r.ac, 3)} m/s²` },
              { k: 'Fuerza centrípeta F = m·v²/r', v: `${fmt(r.force, 3)} N` },
              { k: 'Vueltas y estado', v: st.cut ? `cuerda cortada; el disco está a ${fmt(st.dist * 100, 1)} cm del eje` : `${fmt(Math.min(t, end) / period, 1)} vueltas` },
            ]} />
            {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
          </>
        ) : (
          <>
            <Readout items={[
              { k: 'Coeficiente de fricción μ_s', v: `${fmt(car.mu, 2)} (${SURFACES.find((s) => s.id === surface)?.source})` },
              { k: 'Rapidez máxima v = √(μ·g·r)', v: `${fmt(car.vmax, 2)} m/s = ${fmt(car.vmaxKmh, 1)} km/h` },
              { k: 'Fuerza hacia el centro que se necesita', v: `${fmt(car.needed, 0)} N` },
              { k: 'Fricción máxima disponible', v: `${fmt(car.available, 0)} N` },
              { k: 'Resultado', v: car.skids ? 'derrapa: sale por la tangente' : 'toma la curva', state: car.skids ? 'bad' : 'ok' },
            ]} />
            {carConds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
          </>
        )}
        <section className="card" aria-labelledby="mcu-3d-h">
          <h3 id="mcu-3d-h">Vista 3D: {station === 'mesa' ? 'velocidad tangente y aceleración hacia el centro' : 'la fricción da la fuerza centrípeta'}</h3>
          <Scene3D idPrefix="mcu" title={station === 'mesa' ? 'Disco en movimiento circular en 3D' : 'Carro en una curva en 3D'} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.75 }} status="modelo"
            statusNote="Posición, velocidad, aceleración y tensión salen del modelo (v = 2πr/T, a = v²/r, F = m·v²/r) con escalas fijas por corrida; la tensión se dibuja encima del disco para que no tape la aceleración. En la curva, el radio se dibuja reducido." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="mcu" intro="Ideas frecuentes sobre el movimiento circular. Decide si son ciertas o falsas y compruébalo con el sensor, el cronómetro y la vista 3D." />
      </div>
      <div className="controls">
        {station === 'mesa' ? (
          <div className="card stack">
            <h3>Mesa de aire</h3>
            <Slider label="Radio del círculo" value={radius} min={CM_LIMITS.radius[0]} max={CM_LIMITS.radius[1]} step={0.05} unit="m" decimals={2} onChange={setRadius} />
            <Slider label="Masa del disco" value={massG} min={CM_LIMITS.mass[0]} max={CM_LIMITS.mass[1]} step={10} unit="g" decimals={0} onChange={setMassG} />
            <Slider label="Período (tiempo de una vuelta)" value={period} min={CM_LIMITS.period[0]} max={CM_LIMITS.period[1]} step={0.05} unit="s" decimals={2} onChange={setPeriod} />
            <SimControls title="Disco girando" status={status} startLabel="Hacer girar 10 vueltas" repeatLabel="Girar otra vez"
              onStart={() => { setT(0); setCutAt(null); remeasure('diezVueltas', 'fuerza'); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
              progress={{ value: Math.min(t, end), max: end, unit: 's', label: 't', decimals: 2 }} />
            <button type="button" className="btn" disabled={!running || cutAt !== null} onClick={() => { setCutAt(t); playSound('click', { intensity: 0.7 }); }}>Cortar la cuerda</button>
            <RecordButton onRecord={recordSpin} disabled={!counted} label="Guardar el giro en la tabla" />
            <Notice>{real ? 'Instrumento real: el cronómetro de mano tiene ≈ 0,1 s de error de reacción; por eso se cronometran 10 vueltas.' : 'Cronómetro de 0,01 s y sensor de fuerza de 0,01 N.'} Mesa de aire: sin rozamiento.</Notice>
          </div>
        ) : (
          <div className="card stack">
            <h3>Carro de 1000 kg en una curva plana</h3>
            <Select label="Estado de la vía" value={surface} onChange={setSurface} options={SURFACES.map((s) => ({ value: s.id, label: `${s.name} (μ = ${fmt(s.mu, 2)})` }))} />
            <Slider label="Radio de la curva" value={cRadius} min={CM_LIMITS.curveRadius[0]} max={CM_LIMITS.curveRadius[1]} step={5} unit="m" decimals={0} onChange={setCRadius} />
            <Slider label="Rapidez del carro" value={speed} min={CM_LIMITS.speed[0]} max={CM_LIMITS.speed[1]} step={1} unit="km/h" decimals={0} onChange={setSpeed} />
            <RecordButton onRecord={recordCurve} label="Guardar la curva en la tabla" />
            <Notice>g = {fmt(G, 2)} m/s² (Apartadó). μ del concreto seco y del hielo: tabla 5.1 de Serway; los demás son valores típicos ilustrativos.</Notice>
          </div>
        )}
      </div>
    </div>
  );
}

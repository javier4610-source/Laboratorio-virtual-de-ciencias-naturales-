import { useEffect, useMemo, useRef, useState } from 'react';
import {
  C_ICE, C_STEAM, C_WATER, curveConditions, heatingCurve, L_FUS, L_VAP, PHASE_NAME, PLACES, plateau, SM_LIMITS, stateAtTime, vRms, type CurveInput,
} from '../models/statesOfMatter';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText, SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { statesScene } from './states3d';

/** Toda la curva se recorre en unos 24 s de pantalla, sea cual sea la masa o la potencia. */
const SCREEN_S = 24;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Mientras el hielo se derrite, la temperatura sube porque la parrilla sigue calentando.', answer: 'falso', feedback: 'Durante la fusión el termómetro se queda en 0 °C aunque la parrilla siga entregando energía: esa energía separa las partículas de la red (calor latente, 334 J por gramo), no aumenta su agitación.' },
  { id: 'i2', text: 'Las burbujas que salen del agua hirviendo son de aire o de hidrógeno y oxígeno.', answer: 'falso', feedback: 'Son burbujas de vapor de agua: partículas de agua que pasan al estado gaseoso dentro del líquido. Las moléculas de agua no se rompen al hervir.' },
  { id: 'i3', text: 'En Bogotá el agua hierve a menos de 100 °C.', answer: 'cierto', feedback: 'A 2640 m la presión del aire es de unos 734 hPa y el agua hierve a ≈ 91 °C (IAPWS-IF97). Por eso los alimentos tardan más en cocinarse allí y se usa la olla a presión.' },
  { id: 'i4', text: 'En un sólido las partículas están completamente quietas.', answer: 'falso', feedback: 'Las partículas de un sólido vibran alrededor de sus posiciones en la red; la vibración aumenta con la temperatura. Solo cerca del cero absoluto la agitación sería mínima.' },
  { id: 'i5', text: 'Para hervir toda el agua se necesita mucha más energía que para derretir el mismo hielo.', answer: 'cierto', feedback: 'L_v = 2256 J/g frente a L_f = 334 J/g: casi siete veces más. En la curva, la meseta de la ebullición dura unas 6,8 veces lo que dura la de la fusión.' },
];

function Beaker({ T, solid, liquid, gas, boiling, heating }: { T: number; solid: number; liquid: number; gas: number; boiling: boolean; heating: boolean }) {
  const water = 0.15 + 0.6 * (solid + liquid);
  const top = 250 - water * 150;
  const cubes = Math.round(solid * 6);
  return (
    <svg viewBox="0 0 420 300" role="img" aria-labelledby="est-b-t est-b-d">
      <title id="est-b-t">Vaso con agua sobre una parrilla y termómetro</title>
      <desc id="est-b-d">{`Temperatura ${fmt(T, 1)} °C. Hielo ${fmt(solid * 100, 0)} %, agua líquida ${fmt(liquid * 100, 0)} %, vapor ${fmt(gas * 100, 0)} % de la masa.${boiling ? ' El agua hierve: salen burbujas de vapor.' : ''}`}</desc>
      <rect width="420" height="300" rx="14" fill="var(--surface-2)" />
      <rect x="90" y="262" width="200" height="22" rx="5" fill="var(--ink-2)" />
      <rect x="110" y="256" width="160" height="7" rx="3" fill={heating ? 'var(--bad)' : 'var(--line-strong)'} />
      <text x="190" y="279" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--surface)' }}>parrilla</text>
      {(solid + liquid) > 0.001 && <rect x="112" y={top} width="156" height={250 - top} fill="#7fb6e6" opacity="0.55" />}
      {Array.from({ length: cubes }, (_, k) => <rect key={k} x={122 + (k % 3) * 48} y={top - 6 + Math.floor(k / 3) * 30} width="34" height="28" rx="5" fill="#e6f2fb" stroke="#8fb8d8" />)}
      {boiling && [0, 1, 2, 3, 4].map((k) => <circle key={k} cx={130 + k * 30} cy={top + 20 + ((k * 37) % 50)} r={4 + (k % 3)} fill="none" stroke="var(--ink-2)" />)}
      {gas > 0.001 && [0, 1, 2].map((k) => <path key={k} d={`M${150 + k * 40} ${top - 14} q 10 -14 0 -28 q -10 -14 0 -28`} fill="none" stroke="var(--ink-3)" strokeWidth="2" opacity="0.7" />)}
      <path d="M110 70 V250 Q110 256 116 256 H264 Q270 256 270 250 V70" fill="none" stroke="var(--ink-2)" strokeWidth="2.5" />
      <rect x="320" y="40" width="16" height="200" rx="8" fill="var(--surface)" stroke="var(--ink-2)" />
      <rect x="324" y={236 - Math.max(4, (Math.min(150, Math.max(-30, T)) + 30) * 1.05)} width="8" height={Math.max(4, (Math.min(150, Math.max(-30, T)) + 30) * 1.05)} fill="var(--bad)" />
      <circle cx="328" cy="246" r="11" fill="var(--bad)" />
      <text x="346" y="140" style={{ fontSize: 15, fontFamily: 'var(--font-data)', fill: 'var(--ink)', fontWeight: 700 }}>{fmt(T, 1)} °C</text>
    </svg>
  );
}

export default function StatesLab({ api }: LabProps) {
  const [mass, setMass] = useState(200);
  const [power, setPower] = useState(500);
  const [t0, setT0] = useState(-20);
  const [tEnd, setTEnd] = useState(110);
  const [place, setPlace] = useState('apartado');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [timed, setTimed] = useState(false);
  const raf = useRef(0);
  const { measure, remeasure, real } = useMeasure();

  const input: CurveInput = useMemo(() => ({ mass, power, t0, tEnd, place }), [mass, power, t0, tEnd, place]);
  const curve = useMemo(() => heatingCurve(input), [input]);
  const conds = useMemo(() => curveConditions(input), [input]);
  const st = useMemo(() => stateAtTime(curve, t), [curve, t]);
  const speed = curve.timeTotal / SCREEN_S;
  const thermo = instrument('estados-de-la-materia', 'termometro'), watch = instrument('estados-de-la-materia', 'cronometro');
  const Tread = measure(st.T, { ...thermo, key: 'temperatura' });
  const fus = plateau(curve, 'fusion'), boil = plateau(curve, 'ebullicion');
  const fusRead = fus ? measure(fus.duration, { ...watch, key: 'mesetaFusion' }) : null;
  const boilRead = boil ? measure(boil.duration, { ...watch, key: 'mesetaEbullicion' }) : null;

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); setTimed(false); };
  useEffect(resetRun, [input]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(curve.timeTotal); setRunning(false); return; }
    const start = performance.now() - (t / speed) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * speed;
      if (el >= curve.timeTotal) { setT(curve.timeTotal); setRunning(false); playSound('click', { intensity: 0.6 }); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, curve]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= curve.timeTotal - 1e-9 && !running && t > 0;
  const status = simStatusOf(running, t > 0, finished);

  usePublishModel(() => ({
    vars: {
      m: { sym: 'm', name: 'Masa de agua', value: mass, unit: 'g', decimals: 0 },
      P: { sym: 'P', name: 'Potencia', value: power, unit: 'W', decimals: 0 },
      Lf: { sym: 'L_f', name: 'Calor latente de fusión', value: L_FUS, unit: 'J/g', decimals: 0 },
      Lv: { sym: 'L_v', name: 'Calor latente de vaporización', value: L_VAP, unit: 'J/g', decimals: 0 },
    },
    equations: [{ title: 'Duración de la meseta de fusión', lhs: 'Δt', expr: '\\frac{[m]·[Lf]}{[P]}' }, { title: 'Duración de la meseta de ebullición', lhs: 'Δt', expr: '\\frac{[m]·[Lv]}{[P]}' }],
  }), [mass, power]);

  // curva del termómetro: un punto cada 1/120 de la corrida, hasta el instante actual
  const points = useMemo(() => {
    const n = 120, out: { x: number; y: number }[] = [];
    for (let k = 0; k <= n; k++) { const tk = (k / n) * curve.timeTotal; if (tk > t + 1e-9) break; out.push({ x: tk / 60, y: stateAtTime(curve, tk).T }); }
    if (t > 0) out.push({ x: t / 60, y: st.T });
    return out;
  }, [curve, t, st.T]);

  const phase = t / 30;
  const scene = useMemo(() => statesScene({ state: st, tBoil: curve.tBoil, phase }), [st, curve.tBoil, phase]);
  const placeName = PLACES.find((p) => p.id === place)?.name ?? place;

  const recordPoint = () => api.addTrial('curva', { lugar: placeName.replace(/ \(.*/, ''), masa: mass, potencia: power, tiempo: Number((t / 60).toFixed(2)), energia: Number((st.q / 1000).toFixed(2)), temperatura: Tread, estado: PHASE_NAME[st.phase] });
  const recordPlateaus = () => {
    if (fus && fusRead !== null) api.addTrial('mesetas', { cambio: 'fusión', masa: mass, potencia: power, duracion: fusRead, calorLatente: Number(((power * fusRead) / mass).toFixed(0)) });
    if (boil && boilRead !== null) api.addTrial('mesetas', { cambio: 'ebullición', masa: mass, potencia: power, duracion: boilRead, calorLatente: Number(((power * boilRead) / mass).toFixed(0)) });
  };
  const recordBoil = () => api.addTrial('ebullicion', { lugar: placeName.replace(/ \(.*/, ''), presion: Number((curve.pressure / 100).toFixed(1)), tEbullicion: Number(curve.tBoil.toFixed(1)) });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench"><Beaker T={Tread} solid={st.solid} liquid={st.liquid} gas={st.gas} boiling={st.phase === 'ebullicion'} heating={running} /></div>
        <Readout items={[
          { k: 'Termómetro', v: `${fmt(Tread, 1)} °C`, data: true, resolution: resolutionText(thermo.resolution, '°C') },
          { k: 'Tiempo de calentamiento', v: `${fmt(t / 60, 2)} min (${fmt(t, 0)} s)` },
          { k: 'Energía entregada Q = P·t', v: `${fmt(st.q / 1000, 2)} kJ` },
          { k: 'Qué está pasando', v: PHASE_NAME[st.phase] },
          { k: 'Hielo / líquido / vapor', v: `${fmt(st.solid * 100, 0)} % / ${fmt(st.liquid * 100, 0)} % / ${fmt(st.gas * 100, 0)} %` },
          { k: 'Ebullición en este lugar', v: `${fmt(curve.tBoil, 1)} °C a ${fmt(curve.pressure / 100, 1)} hPa` },
          { k: 'Rapidez media de las moléculas', v: `${fmt(vRms(st.T), 0)} m/s` },
        ]} />
        <Chart title="Curva de calentamiento: temperatura en función del tiempo" xLabel="Tiempo (min)" yLabel="Temperatura (°C)" xUnit="min" yUnit="°C" height={250}
          exportName="curva-de-calentamiento" xDomain={[0, Math.max(1, curve.timeTotal / 60)]} yDomain={[Math.min(-30, t0), Math.max(110, tEnd)]}
          hLines={[{ y: 0, label: 'fusión 0 °C' }, { y: curve.tBoil, label: `ebullición ${fmt(curve.tBoil, 1)} °C` }]}
          series={points.length > 1 ? [{ label: 'Termómetro (modelo)', color: 'var(--series-1)', kind: 'line', points }] : []}
          emptyText="Pulsa «Calentar» para trazar la curva de calentamiento." />
        {finished && (
          <Readout items={[
            { k: 'Meseta de fusión (cronómetro)', v: fusRead !== null ? `${fmt(fusRead, 0)} s → L_f = P·Δt/m = ${fmt((power * fusRead) / mass, 0)} J/g` : 'no hubo (empezaste sin hielo)', data: fusRead !== null, resolution: fusRead !== null ? resolutionText(watch.resolution, 's') : undefined },
            { k: 'Meseta de ebullición (cronómetro)', v: boilRead !== null ? `${fmt(boilRead, 0)} s → L_v = P·Δt/m = ${fmt((power * boilRead) / mass, 0)} J/g` : 'no hubo (no llegaste a hervir)', data: boilRead !== null, resolution: boilRead !== null ? resolutionText(watch.resolution, 's') : undefined },
          ]} />
        )}
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="est-3d-h">
          <h3 id="est-3d-h">Vista 3D: las partículas del agua mientras se calienta</h3>
          <Scene3D idPrefix="est" title="Partículas de agua en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.5, pitch: 0.35 }} status="modelo"
            statusNote="Cuántas partículas hay en la red, en el líquido y en el vapor sale de las fracciones del modelo, y su agitación de √T; son 27 partículas, sin escala de tamaño ni de rapidez (la real es de cientos de metros por segundo)." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="est" intro="Ideas frecuentes sobre los cambios de estado. Decide si son ciertas o falsas y compruébalo con la curva y las partículas." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Muestra y parrilla</h3>
          <Slider label="Masa de agua (hielo)" value={mass} min={SM_LIMITS.mass[0]} max={SM_LIMITS.mass[1]} step={10} unit="g" decimals={0} onChange={setMass} />
          <Slider label="Temperatura inicial" value={t0} min={SM_LIMITS.t0[0]} max={SM_LIMITS.t0[1]} step={1} unit="°C" decimals={0} onChange={setT0} />
          <Slider label="Temperatura final" value={tEnd} min={SM_LIMITS.tEnd[0]} max={SM_LIMITS.tEnd[1]} step={1} unit="°C" decimals={0} onChange={setTEnd} />
          <Slider label="Potencia de la parrilla" value={power} min={SM_LIMITS.power[0]} max={SM_LIMITS.power[1]} step={50} unit="W" decimals={0} onChange={setPower} />
          <Select label="Lugar" value={place} onChange={setPlace} options={PLACES.map((p) => ({ value: p.id, label: p.name }))} />
          <SimControls title="Calentamiento del agua" status={status} startLabel="Calentar" repeatLabel="Calentar otra vez"
            onStart={() => { setT(0); setTimed(false); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            progress={{ value: t / 60, max: curve.timeTotal / 60, unit: 'min', label: 't', decimals: 1 }} />
          <RecordButton onRecord={recordPoint} disabled={t === 0 || running} label="Guardar el punto de la curva" />
          <button type="button" className="btn" disabled={!finished} onClick={() => { remeasure('mesetaFusion', 'mesetaEbullicion'); setTimed(true); recordPlateaus(); playSound('click', { intensity: 0.4 }); }}>Medir y guardar las mesetas</button>
          {timed && <p className="small" role="status">Mesetas guardadas en la tabla «Mesetas de la curva».</p>}
          <RecordButton onRecord={recordBoil} label="Guardar la temperatura de ebullición del lugar" />
          <Notice>{real ? 'Instrumento real: el termómetro y el cronómetro traen su error típico; repite la medición de las mesetas.' : 'Termómetro de 0,1 °C y cronómetro de 1 s.'} c_hielo = {fmt(C_ICE, 2)}, c_agua = {fmt(C_WATER, 2)}, c_vapor = {fmt(C_STEAM, 2)} J/(g·°C); L_f = {L_FUS} J/g; L_v = {L_VAP} J/g.</Notice>
        </div>
      </div>
    </div>
  );
}

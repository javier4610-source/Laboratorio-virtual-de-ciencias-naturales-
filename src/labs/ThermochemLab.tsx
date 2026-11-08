import { useEffect, useMemo, useRef, useState } from 'react';
import {
  C_WATER, calConditions, CUPS, DH_NEUT, dissolution, DURATION, findCup, findSolute, hessSolidInAcid, neutralization, runCalorimeter, SOLUTES, T_ROOM, TQ_LIMITS,
  type Experiment,
} from '../models/thermochem';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { calorimeterScene } from './calorimeter3d';

type Station = 'disolucion' | 'neutralizacion' | 'hess';
type HessStep = 'disol' | 'neut' | 'solido';
/** Los 300 s de medición se recorren en 15 s de pantalla. */
const SCREEN_S = 15;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Si el vaso se enfría al disolver una sal, es porque la sal estaba fría.', answer: 'falso', feedback: 'La sal y el agua empiezan a la misma temperatura. El nitrato de amonio ABSORBE energía del agua al disolverse (proceso endotérmico, ΔH > 0): por eso funciona la compresa fría.' },
  { id: 'i2', text: 'En una reacción exotérmica el sistema pierde energía y el entorno (el agua) la gana.', answer: 'cierto', feedback: 'El calor que mide el termómetro es el que gana la solución: q = m·c·ΔT. La entalpía del sistema baja, por eso ΔH es negativo.' },
  { id: 'i3', text: 'El calor y la temperatura son lo mismo.', answer: 'falso', feedback: 'La temperatura mide la agitación de las partículas; el calor es energía que pasa de un cuerpo a otro. Con el doble de agua, el mismo calor sube la temperatura la mitad.' },
  { id: 'i4', text: 'Si se usa el doble de ácido y el doble de base, la temperatura sube el doble.', answer: 'falso', feedback: 'Se libera el doble de calor, pero también hay el doble de solución que calentar: ΔT es casi el mismo. Lo que se duplica es q, no ΔT. ΔH por mol no cambia.' },
  { id: 'i5', text: 'El calor de disolver NaOH sólido en HCl es la suma del de disolverlo en agua y el de neutralizarlo.', answer: 'cierto', feedback: 'Es la ley de Hess: la entalpía es una función de estado y no depende del camino. −44,5 + (−55,8) ≈ −100,3 kJ/mol.' },
];

export default function ThermochemLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('disolucion');
  const [soluteId, setSoluteId] = useState('naoh');
  const [grams, setGrams] = useState(2);
  const [water, setWater] = useState(100);
  const [conc, setConc] = useState(1);
  const [vol, setVol] = useState(50);
  const [hessStep, setHessStep] = useState<HessStep>('disol');
  const [cupId, setCupId] = useState('icopor');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  const exp: Experiment = useMemo(() => {
    if (station === 'disolucion') return dissolution(soluteId, grams, water);
    if (station === 'neutralizacion') return neutralization(conc, vol);
    return hessStep === 'disol' ? dissolution('naoh', 2, 100) : hessStep === 'neut' ? neutralization(1, 50) : hessSolidInAcid(2);
  }, [station, soluteId, grams, water, conc, vol, hessStep]);
  const cup = findCup(cupId);
  const run = useMemo(() => runCalorimeter(exp, cupId), [exp, cupId]);
  const conds = useMemo(() => calConditions(run, cupId), [run, cupId]);
  const scene = useMemo(() => calorimeterScene(run, t, cup.name), [run, t, cup.name]);

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); };
  useEffect(resetRun, [run]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(DURATION); setRunning(false); return; }
    const speed = DURATION / SCREEN_S;
    const start = performance.now() - (t / speed) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * speed;
      if (el >= DURATION) { setT(DURATION); setRunning(false); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= DURATION && !running;
  const status = simStatusOf(running, t > 0, finished);
  const shown = run.readings.filter((r) => r.t <= t + 1e-9);

  usePublishModel(() => ({
    vars: {
      m: { sym: 'm', name: 'Masa de la solución', value: exp.mass, unit: 'g', decimals: 1 },
      c: { sym: 'c', name: 'Calor específico (agua)', value: C_WATER, unit: 'J/(g·°C)', decimals: 2 },
      Cc: { sym: 'C_cal', name: 'Capacidad calorífica del vaso', value: cup.Ccal, unit: 'J/°C', decimals: 0 },
      dT: { sym: 'ΔT', name: 'Cambio de temperatura (extrapolado)', value: run.extrap.dT, unit: '°C', decimals: 2 },
      n: { sym: 'n', name: 'Moles que reaccionan', value: exp.n, unit: 'mol', decimals: 4 },
    },
    equations: [
      { title: 'Calor que gana la solución', lhs: 'q', expr: '([m]·[c] + [Cc])·[dT]' },
      { title: 'Entalpía molar', lhs: 'ΔH', expr: '−\\frac{([m]·[c] + [Cc])·[dT]}{[n]}' },
    ],
  }), [exp, cup, run]);

  const common = { vaso: cup.name, moles: Number(exp.n.toFixed(5)), dT: Number((run.maxObs.T - T_ROOM).toFixed(1)), dTextrap: Number(run.extrap.dT.toFixed(2)), dH: Number(run.dHextrap.toFixed(2)), dHref: Number(exp.dHref.toFixed(2)) };
  const record = () => {
    if (station === 'disolucion') api.addTrial('disolucion', { sustancia: findSolute(soluteId).formula, masaSoluto: grams, masaAgua: water, ...common });
    else if (station === 'neutralizacion') api.addTrial('neutralizacion', { concentracion: conc, volumen: vol, ...common });
    else api.addTrial('hess', { experimento: exp.label, ...common });
  };
  const hessSum = findSolute('naoh').dH + DH_NEUT;

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'disolucion', label: 'Calor de disolución' }, { value: 'neutralizacion', label: 'Calor de neutralización' }, { value: 'hess', label: 'Ley de Hess' }]} />
        <Readout items={[
          { k: 'Termómetro', v: `${fmt(scene.T, 1)} °C (a los ${fmt(t, 0)} s)`, data: true },
          { k: 'Moles que reaccionan n', v: `${fmt(exp.n, 4)} mol` },
          { k: 'Capacidad calorífica m·c + C_cal', v: `${fmt(exp.mass, 1)} g × ${fmt(C_WATER, 2)} + ${fmt(cup.Ccal, 0)} = ${fmt(run.Ctot, 1)} J/°C` },
          { k: 'ΔT sin pérdidas (ideal)', v: `${fmt(run.dTad, 2)} °C` },
        ]} />
        <Chart title="Temperatura de la solución durante la medición" xLabel="Tiempo (s)" yLabel="Temperatura (°C)" xUnit="s" yUnit="°C" height={240} exportName="calorimetria"
          xDomain={[0, DURATION]} yDomain={[Math.floor(Math.min(T_ROOM, T_ROOM + run.dTad) - 1), Math.ceil(Math.max(T_ROOM, T_ROOM + run.dTad) + 1)]}
          hLines={[{ y: T_ROOM + run.dTad, label: `sin pérdidas: ${fmt(T_ROOM + run.dTad, 2)} °C` }]}
          series={shown.length > 1 ? [
            { label: 'Lecturas cada 10 s (modelo)', color: 'var(--series-1)', kind: 'both', points: shown.map((r) => ({ x: r.t, y: r.T })) },
            ...(finished ? [{ label: 'Recta del enfriamiento extrapolada a t = 0', color: 'var(--series-2)', kind: 'line' as const, dashed: true, points: [{ x: 0, y: run.extrap.intercept }, { x: DURATION, y: run.extrap.intercept + run.extrap.slope * DURATION }] }] : []),
          ] : []}
          emptyText="Pulsa «Iniciar la medición» para leer el termómetro cada 10 s." />
        {finished && (
          <Readout items={[
            { k: 'ΔT máximo medido', v: `${fmt(run.maxObs.T - T_ROOM, 1)} °C a los ${fmt(run.maxObs.t, 0)} s` },
            { k: 'ΔT extrapolado a t = 0', v: `${fmt(run.extrap.dT, 2)} °C` },
            { k: 'Calor q = (m·c + C_cal)·ΔT (extrapolado)', v: `${fmt(run.Ctot * run.extrap.dT, 0)} J` },
            { k: 'ΔH con el máximo medido', v: `${fmt(run.dHmax, 1)} kJ/mol (${fmt(run.errMaxPct, 1)} %)` },
            { k: 'ΔH con la extrapolación', v: `${fmt(run.dHextrap, 1)} kJ/mol (${fmt(run.errExtrapPct, 1)} %)`, data: true },
            { k: 'Valor de referencia', v: `${fmt(exp.dHref, 2)} kJ/mol: ${exp.dHref < 0 ? 'exotérmico' : 'endotérmico'}` },
          ]} />
        )}
        {station === 'hess' && <Notice kind="info">Ley de Hess: ΔH(NaOH(s) + HCl) = ΔH(disolución de NaOH) + ΔH(neutralización) = {fmt(findSolute('naoh').dH, 2)} + ({fmt(DH_NEUT, 2)}) = {fmt(hessSum, 2)} kJ/mol. Mide los tres procesos y compara la suma con tus datos.</Notice>}
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="tq-3d-h">
          <h3 id="tq-3d-h">Vista 3D: el calorímetro en corte, el sistema y el entorno</h3>
          <Scene3D idPrefix="tq" title="Calorímetro de vaso en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.5, pitch: 0.35 }} status="modelo"
            statusNote="El número de iones es proporcional a la fracción que ya reaccionó, el termómetro marca la temperatura del modelo y la flecha de energía crece con el calor liberado (3000 J = 1,2 unidades). La agitación del agua y el tamaño de las partículas son ilustrativos." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="tq" intro="Ideas frecuentes sobre el calor en las reacciones. Decide si son ciertas o falsas y compruébalo con el calorímetro." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Calorímetro</h3>
          {station === 'disolucion' && <>
            <Select label="Sustancia" value={soluteId} onChange={setSoluteId} options={SOLUTES.map((s) => ({ value: s.id, label: `${s.name} (${s.formula})` }))} />
            <Slider label="Masa del soluto" value={grams} min={TQ_LIMITS.solute[0]} max={TQ_LIMITS.solute[1]} step={0.05} unit="g" decimals={2} onChange={setGrams} />
            <Slider label="Masa del agua" value={water} min={TQ_LIMITS.water[0]} max={TQ_LIMITS.water[1]} step={1} unit="g" decimals={0} onChange={setWater} />
            <Notice>{findSolute(soluteId).use}</Notice>
          </>}
          {station === 'neutralizacion' && <>
            <Slider label="Concentración del HCl y del NaOH" value={conc} min={TQ_LIMITS.conc[0]} max={TQ_LIMITS.conc[1]} step={0.05} unit="mol/L" decimals={2} onChange={setConc} />
            <Slider label="Volumen de cada solución" value={vol} min={TQ_LIMITS.volume[0]} max={TQ_LIMITS.volume[1]} step={1} unit="mL" decimals={0} onChange={setVol} />
          </>}
          {station === 'hess' && (
            <Select label="Proceso" value={hessStep} onChange={(v) => setHessStep(v as HessStep)} options={[
              { value: 'disol', label: '1. NaOH(s) en agua (2,00 g en 100 g)' },
              { value: 'neut', label: '2. NaOH(aq) + HCl(aq) (50 + 50 mL de 1,0 M)' },
              { value: 'solido', label: '3. NaOH(s) en HCl(aq) (2,00 g en 100 mL de 1,0 M)' },
            ]} />
          )}
          <Select label="Vaso" value={cupId} onChange={setCupId} options={CUPS.map((c) => ({ value: c.id, label: c.name }))} />
          <SimControls title="Medición" status={status} startLabel="Iniciar la medición" repeatLabel="Repetir la medición"
            onStart={() => { setT(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            progress={{ value: t, max: DURATION, unit: 's', label: 't', decimals: 0 }} />
          <RecordButton onRecord={record} disabled={!finished} label="Guardar la medición en la tabla" />
          <Notice>Referencias a 25 °C: neutralización −55,8 kJ/mol (valores clave de CODATA); disoluciones a dilución infinita del CRC Handbook. Termómetro de 0,1 °C. La capacidad calorífica de los vasos, la rapidez de disolución y las pérdidas de calor son ilustrativas. Con NaOH y HCl usa guantes y gafas.</Notice>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ADA, BERGMAN, CATEGORY_TEXT, DURATION, fastingCategory, findProfile, GL_LIMITS, glucoseConditions, MEALS, ogttCategory, PROFILES, simulateGlucose, stateAt,
  type GlucoseInput, type MealId, type ProfileId,
} from '../models/glucose';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText, SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { glucoseScene } from './glucose3d';

/** Las 4 h de la prueba se recorren en unos 20 s de pantalla. */
const SCREEN_S = 20;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'La insulina es una hormona que sube la glucosa de la sangre.', answer: 'falso', feedback: 'La insulina la BAJA: hace que el músculo y el tejido adiposo capten glucosa y que el hígado la guarde. La hormona que la sube es el glucagón.' },
  { id: 'i2', text: 'Después de comer, que la glucosa suba es normal; lo que importa es que vuelva a su nivel.', answer: 'cierto', feedback: 'En la persona sana del modelo la glucosa sube a ≈ 166 mg/dL y a las 2 h está en 91 mg/dL. Por eso la prueba de tolerancia mide el valor a las 2 h.' },
  { id: 'i3', text: 'La diabetes tipo 2 se debe a que el páncreas ya no tiene células que produzcan insulina.', answer: 'falso', feedback: 'Eso describe la diabetes tipo 1. En la tipo 2 hay insulina, pero las células responden poco a ella (resistencia a la insulina) y el páncreas no alcanza a compensar.' },
  { id: 'i4', text: 'Una persona con diabetes tipo 1 debe inyectarse siempre la mayor dosis de insulina posible.', answer: 'falso', feedback: 'Demasiada insulina para la comida produce hipoglucemia (< 70 mg/dL), que es peligrosa. En el modelo, con 8 U la glucosa baja a 63 mg/dL. La dosis la decide el personal de salud.' },
  { id: 'i5', text: 'Durante el ejercicio, el glucagón ayuda a que la glucosa no baje demasiado.', answer: 'cierto', feedback: 'El ejercicio aumenta la captación de glucosa por los músculos; al bajar la glucosa, el glucagón hace que el hígado libere glucosa. Bloquéalo en el laboratorio: la glucosa baja unos 16 mg/dL más.' },
];

export default function GlucoseLab({ api }: LabProps) {
  const [profile, setProfile] = useState<ProfileId>('normal');
  const [meal, setMeal] = useState<MealId>('ptog');
  const [exercise, setExercise] = useState(false);
  const [exStart, setExStart] = useState(30);
  const [bolus, setBolus] = useState(0);
  const [insulinOn, setInsulinOn] = useState(true);
  const [glucagonOn, setGlucagonOn] = useState(true);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);
  const { measure, real } = useMeasure();

  const input: GlucoseInput = useMemo(() => ({ profile, meal, exerciseStart: exercise ? exStart : null, bolus, insulinOn, glucagonOn }), [profile, meal, exercise, exStart, bolus, insulinOn, glucagonOn]);
  const run = useMemo(() => simulateGlucose(input), [input]);
  const conds = useMemo(() => glucoseConditions(run), [run]);
  const st = useMemo(() => stateAt(run, t), [run, t]);
  const meter = instrument('homeostasis-glucosa', 'glucometro');
  const Gread = measure(st.G, { ...meter, key: 'glucosa' });
  const speed = DURATION / SCREEN_S;

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); };
  useEffect(resetRun, [input]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(DURATION); setRunning(false); return; }
    const start = performance.now() - (t / speed) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * speed;
      if (el >= DURATION) { setT(DURATION); setRunning(false); playSound('click', { intensity: 0.6 }); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= DURATION - 1e-9 && !running;
  const status = simStatusOf(running, t > 0, finished);
  const p = findProfile(profile);

  usePublishModel(() => ({
    vars: {
      p1: { sym: 'p_1', name: 'Eficacia de la glucosa', value: p.p1, unit: '1/min', sig: 3 },
      X: { sym: 'X', name: 'Acción de la insulina', value: insulinOn ? st.X : 0, unit: '1/min', sig: 3 },
      G: { sym: 'G', name: 'Glucosa', value: st.G, unit: 'mg/dL', decimals: 1 },
      Gb: { sym: 'G_b', name: 'Glucosa basal', value: p.Gb, unit: 'mg/dL', decimals: 0 },
      p2: { sym: 'p_2', name: 'Desaparición de la acción de la insulina', value: BERGMAN.p2, unit: '1/min', sig: 3 },
      p3: { sym: 'p_3', name: 'Ganancia de la insulina', value: p.p3, unit: 'min⁻²·(µU/mL)⁻¹', sig: 3 },
      I: { sym: 'I', name: 'Insulina', value: st.I, unit: 'µU/mL', decimals: 1 },
      Ib: { sym: 'I_b', name: 'Insulina basal', value: p.Ib, unit: 'µU/mL', decimals: 0 },
    },
    equations: [
      { title: 'Captación neta de glucosa (sin comida ni glucagón)', lhs: 'dG/dt', expr: '−([p1] + [X])·[G] + [p1]·[Gb]' },
      { title: 'Acción de la insulina', lhs: 'dX/dt', expr: '−[p2]·[X] + [p3]·([I] − [Ib])' },
    ],
  }), [p, st.X, st.G, st.I, insulinOn]);

  const points = useMemo(() => run.points.filter((q) => q.t <= t + 1e-9).map((q) => ({ x: q.t, y: q.G })), [run, t]);
  const hormones = useMemo(() => run.points.filter((q) => q.t <= t + 1e-9 && q.t % 2 === 0), [run, t]);
  const scene = useMemo(() => glucoseScene(run, st), [run, st]);
  const mealName = MEALS.find((m) => m.id === meal)!.name.replace(/ \(.*/, '').replace(/:.*/, '');

  const recordPoint = () => api.addTrial('curva', { perfil: p.name.replace(/ \(.*/, ''), comida: mealName, tiempo: Number(t.toFixed(0)), glucosa: Gread, insulina: Number(st.I.toFixed(1)), glucagon: Number(st.N.toFixed(0)) });
  const recordTest = () => api.addTrial('pruebas', {
    perfil: p.name.replace(/ \(.*/, ''), comida: mealName, ejercicio: exercise ? `desde el min ${exStart}` : 'no', dosis: bolus, insulinaActiva: insulinOn ? 'sí' : 'no', glucagonActivo: glucagonOn ? 'sí' : 'no',
    ayunas: Number(run.fasting.toFixed(0)), pico: Number(run.peak.G.toFixed(0)), minima: Number(run.min.G.toFixed(0)), dosH: Number(run.at2h.toFixed(0)),
    categoria: meal === 'ptog' ? `ayunas ${fastingCategory(run.fasting)}; 2 h ${ogttCategory(run.at2h)}` : `ayunas ${fastingCategory(run.fasting)}`,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <Readout items={[
          { k: 'Tiempo desde la comida', v: `${fmt(t, 0)} min` },
          { k: 'Glucómetro', v: `${fmt(Gread, 0)} mg/dL`, data: true, resolution: resolutionText(meter.resolution, 'mg/dL') },
          { k: 'Insulina en el plasma (modelo)', v: `${fmt(st.I, 1)} µU/mL` },
          { k: 'Glucagón en el plasma (modelo ilustrativo)', v: `${fmt(st.N, 0)} pg/mL` },
          { k: 'Acción de la insulina en los tejidos X', v: `${fmt(insulinOn ? st.X : 0, 4)} por minuto` },
        ]} />
        <Chart title="Glucosa en la sangre durante la prueba" xLabel="Tiempo desde la comida (min)" yLabel="Glucosa (mg/dL)" xUnit="min" yUnit="mg/dL" height={250}
          exportName="curva-de-glucosa" xDomain={[0, DURATION]} yDomain={[40, Math.max(220, Math.ceil(run.peak.G / 20) * 20 + 20)]}
          hLines={[{ y: ADA.hypo1, label: 'hipoglucemia: 70' }, { y: ADA.ogtt2h[0], label: '2 h normal: < 140' }, { y: ADA.ogtt2h[1], label: '2 h diabetes: ≥ 200' }]}
          series={points.length > 1 ? [{ label: 'Glucosa (modelo)', color: 'var(--series-1)', kind: 'line', points }] : []}
          emptyText="Pulsa «Iniciar la prueba» para trazar la curva de glucosa." />
        <Chart title="Insulina y glucagón en el plasma" xLabel="Tiempo desde la comida (min)" yLabel="Insulina (µU/mL) y glucagón ÷ 2 (pg/mL)" xUnit="min" height={200}
          exportName="insulina-y-glucagon" xDomain={[0, DURATION]} yDomain={[0, 120]}
          series={hormones.length > 1 ? [
            { label: 'Insulina (µU/mL)', color: 'var(--series-2)', kind: 'line', points: hormones.map((q) => ({ x: q.t, y: q.I })) },
            { label: 'Glucagón ÷ 2 (pg/mL, ilustrativo)', color: 'var(--series-4)', kind: 'line', dashed: true, points: hormones.map((q) => ({ x: q.t, y: q.N / 2 })) },
          ] : []}
          emptyText="Las hormonas aparecen al iniciar la prueba." />
        {finished && (
          <Readout items={[
            { k: 'Glucosa en ayunas (criterio de la ADA)', v: `${fmt(run.fasting, 0)} mg/dL: ${CATEGORY_TEXT[fastingCategory(run.fasting)]}` },
            { k: 'Glucosa a las 2 h', v: meal === 'ptog' ? `${fmt(run.at2h, 0)} mg/dL: ${CATEGORY_TEXT[ogttCategory(run.at2h)]}` : `${fmt(run.at2h, 0)} mg/dL (el criterio de 2 h es para la prueba de 75 g)` },
            { k: 'Pico y mínima', v: `pico ${fmt(run.peak.G, 0)} mg/dL a los ${fmt(run.peak.t, 0)} min; mínima ${fmt(run.min.G, 0)} mg/dL a los ${fmt(run.min.t, 0)} min` },
          ]} />
        )}
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="glu-3d-h">
          <h3 id="glu-3d-h">Vista 3D: glucosa, insulina y glucagón en la sangre</h3>
          <Scene3D idPrefix="glu" title="Glucosa en el vaso sanguíneo y órganos en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.25, pitch: 0.3 }} status="modelo"
            statusNote="El número de partículas es proporcional a cada concentración del modelo (glucosa: 1 por cada 8 mg/dL) y la longitud de las flechas, a los flujos del modelo en ese minuto. Los órganos son un esquema sin escala y las partículas no son moléculas reales." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="glu" intro="Ideas frecuentes sobre la glucosa y la diabetes. Decide si son ciertas o falsas y compruébalo con la prueba de tolerancia, el ejercicio y los perfiles." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Persona y situación</h3>
          <Select label="Perfil" value={profile} onChange={(v) => setProfile(v as ProfileId)} options={PROFILES.map((x) => ({ value: x.id, label: x.name }))} />
          <Select label="Comida en t = 0" value={meal} onChange={(v) => setMeal(v as MealId)} options={MEALS.map((m) => ({ value: m.id, label: m.name }))} />
          <Segmented<'no' | 'si'> label="Ejercicio moderado de 45 min" value={exercise ? 'si' : 'no'} onChange={(v) => setExercise(v === 'si')} options={[{ value: 'no', label: 'No' }, { value: 'si', label: 'Sí' }]} />
          {exercise && <Slider label="Inicio del ejercicio" value={exStart} min={GL_LIMITS.exerciseStart[0]} max={GL_LIMITS.exerciseStart[1]} step={15} unit="min" decimals={0} onChange={setExStart} />}
          <Slider label="Insulina rápida inyectada con la comida" value={bolus} min={GL_LIMITS.bolus[0]} max={GL_LIMITS.bolus[1]} step={1} unit="U" decimals={0} onChange={setBolus} />
          <Segmented<'si' | 'no'> label="Acción de la insulina" value={insulinOn ? 'si' : 'no'} onChange={(v) => setInsulinOn(v === 'si')} options={[{ value: 'si', label: 'Activa' }, { value: 'no', label: 'Bloqueada' }]} />
          <Segmented<'si' | 'no'> label="Glucagón" value={glucagonOn ? 'si' : 'no'} onChange={(v) => setGlucagonOn(v === 'si')} options={[{ value: 'si', label: 'Activo' }, { value: 'no', label: 'Bloqueado' }]} />
          <SimControls title="Prueba de glucosa" status={status} startLabel="Iniciar la prueba" repeatLabel="Repetir la prueba"
            onStart={() => { setT(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            progress={{ value: t, max: DURATION, unit: 'min', label: 't', decimals: 0 }} />
          <RecordButton onRecord={recordPoint} disabled={running} label="Guardar el punto de la curva" />
          <RecordButton onRecord={recordTest} disabled={!finished} label="Guardar la prueba completa" />
          <Notice>{real ? 'Instrumento real: el glucómetro trae su error típico (la norma ISO 15197 acepta ±15 mg/dL o ±15 %).' : 'Glucómetro de 1 mg/dL.'} {p.note} Modelo educativo: no diagnostica ni sirve para calcular dosis de insulina.</Notice>
        </div>
      </div>
    </div>
  );
}

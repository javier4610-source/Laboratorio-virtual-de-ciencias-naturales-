import { useEffect, useMemo, useRef, useState } from 'react';
import {
  activity, DEFAULT_MEAL, DIGESTIVE_ENZYMES, digestMeal, findDigestiveEnzyme, MEAL_LIMITS, mealAt, mealConditions, NUTRIENTS, SITUATIONS, testTube, tubeConditions,
  type Nutrient, type Situation,
} from '../models/digestion';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { Chart, type Series } from '../components/Chart';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { digestionScene } from './digestion3d';

type Station = 'tubos' | 'recorrido';
/** Las 7,5 h del recorrido se ven en 15 s. */
const SCREEN_S = 15;
const SERIES = ['var(--series-2)', 'var(--series-1)', 'var(--series-3)', 'var(--series-4)', 'var(--series-6)'];
const LUGOL_HEX: Record<string, string> = { 'azul oscuro': '#1f2a6b', violeta: '#6a3d8f', 'café rojizo': '#9a4a1f', amarillo: '#d8b23a' };

const IDEAS: Idea[] = [
  { id: 'i1', text: 'La digestión de los alimentos ocurre casi toda en el estómago.', answer: 'falso', feedback: 'El estómago empieza la digestión de las proteínas (la pepsina hace ≈ 10–20 %), pero la mayor parte de la digestión química y la absorción ocurren en el intestino delgado, con las enzimas del páncreas y la bilis.' },
  { id: 'i2', text: 'Cada enzima digestiva trabaja mejor a un pH determinado.', answer: 'cierto', feedback: 'La pepsina trabaja mejor en el ácido del estómago (pH ≈ 2) y la tripsina en el intestino (pH ≈ 8). Lejos de su pH óptimo cambia la carga de la enzima y pierde actividad.' },
  { id: 'i3', text: 'La bilis es una enzima que digiere las grasas.', answer: 'falso', feedback: 'La bilis no es una enzima: sus sales EMULSIONAN la grasa en gotitas, y así la lipasa del páncreas tiene mucha más superficie donde actuar.' },
  { id: 'i4', text: 'La amilasa de la saliva sigue digiriendo almidón en el estómago para siempre.', answer: 'falso', feedback: 'Sigue un rato mientras el bolo no se mezcla con el jugo gástrico; cuando el pH baja a ≈ 2, la amilasa salival deja de trabajar.' },
  { id: 'i5', text: 'Masticar bien ayuda a la digestión química.', answer: 'cierto', feedback: 'Masticar parte el alimento en trozos pequeños con más superficie para las enzimas y lo mezcla con la saliva.' },
];

export default function DigestionLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('tubos');
  const [enzymeId, setEnzymeId] = useState('amilasa-salival');
  const [pH, setPH] = useState(6.8);
  const [minutes, setMinutes] = useState(10);
  const [meal, setMeal] = useState(DEFAULT_MEAL);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  const tube = useMemo(() => testTube(enzymeId, pH, minutes), [enzymeId, pH, minutes]);
  const tubeConds = tubeConditions(tube);
  const run = useMemo(() => digestMeal(meal), [meal]);
  const mealConds = mealConditions(run);
  const now = mealAt(run, t);
  const scene = useMemo(() => digestionScene(run, t), [run, t]);

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); };
  useEffect(resetRun, [run]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(run.totalMinutes); setRunning(false); return; }
    const speed = run.totalMinutes / SCREEN_S;
    const start = performance.now() - (t / speed) * 1000;
    const tick = (n: number) => {
      const el = ((n - start) / 1000) * speed;
      if (el >= run.totalMinutes) { setT(run.totalMinutes); setRunning(false); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= run.totalMinutes && !running;
  const status = simStatusOf(running, t > 0, finished);

  usePublishModel(() => ({
    vars: {
      pH: { sym: 'pH', name: 'pH del tubo', value: pH, unit: '', decimals: 1 },
      po: { sym: 'pH_ópt', name: 'pH óptimo de la enzima', value: tube.enzyme.pHopt, unit: '', decimals: 1 },
      a: { sym: 'a', name: 'Actividad relativa', value: tube.a, unit: '', decimals: 3 },
    },
    equations: [{ title: 'Actividad relativa (curva de dos grupos ionizables)', lhs: 'a', expr: '\\frac{g([pH])}{g([po])}' }],
  }), [pH, tube]);

  const curves: Series[] = DIGESTIVE_ENZYMES.map((e, i) => ({ label: e.name, color: SERIES[i], kind: 'line', points: Array.from({ length: 141 }, (_, k) => ({ x: k / 10, y: activity(e.id, k / 10) * 100 })) }));
  curves.push({ label: 'Tu tubo', color: 'var(--data)', kind: 'scatter', points: [{ x: pH, y: tube.a * 100 }] });
  const cumul: Series[] = NUTRIENTS.map((n, i) => ({ label: n.name, color: ['var(--series-2)', 'var(--series-1)', 'var(--series-6)'][i], kind: 'line', points: [{ x: 0, y: 0 }, ...run.segments.filter((s) => s.segment.minutes > 0).map((s) => ({ x: s.end, y: (1 - s.remaining[n.id]) * 100 }))] }));

  const record = () => {
    if (station === 'tubos') api.addTrial('tubos', { enzima: tube.enzyme.name, pH, minutos: minutes, actividad: Number((tube.a * 100).toFixed(1)), queda: Number((tube.remaining * 100).toFixed(1)), lugol: tube.lugol ?? '—' });
    else api.addTrial('almuerzo', { situacion: SITUATIONS.find((s) => s.id === meal.situation)!.name, almidon: Number(run.digestedPct.almidon.toFixed(1)), proteina: Number(run.digestedPct.proteina.toFixed(1)), grasa: Number(run.digestedPct.grasa.toFixed(1)), saliva: Number(run.shareSaliva.toFixed(1)), pepsina: Number(run.shareStomach.proteina.toFixed(1)) });
  };
  const setNutrient = (n: Nutrient) => (v: number) => setMeal((m) => ({ ...m, [n]: v }));

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'tubos', label: 'Enzimas y pH' }, { value: 'recorrido', label: 'Recorrido del almuerzo' }]} />
        {station === 'tubos' && <>
          <Chart title="Actividad de las enzimas digestivas contra el pH" xLabel="pH" yLabel="Actividad relativa (%)" yUnit="%" height={240} exportName="enzimas-ph"
            xDomain={[0, 14]} yDomain={[0, 105]} series={curves} />
          <Readout items={[
            { k: 'Actividad relativa de la enzima', v: `${fmt(tube.a * 100, 1)} % (óptimo a pH ${fmt(tube.enzyme.pHopt, 1)})`, data: true },
            { k: 'Sustrato que queda en el tubo', v: `${fmt(tube.remaining * 100, 1)} % de ${tube.enzyme.nutrient === 'almidon' ? 'almidón' : tube.enzyme.nutrient === 'proteina' ? 'proteína' : 'grasa'} después de ${fmt(minutes, 0)} min a 37 °C` },
            ...(tube.lugol ? [{ k: 'Prueba con lugol', v: `color ${tube.lugol}${tube.lugol === 'amarillo' ? ': ya no queda almidón' : tube.lugol === 'azul oscuro' ? ': casi todo el almidón sigue ahí' : ''}` }] : []),
          ]} />
          {tube.lugol && (
            <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="40" height="90" viewBox="0 0 40 90"><path d="M8 4 V70 a12 12 0 0 0 24 0 V4" fill="none" stroke="var(--ink-2)" strokeWidth="2" /><path d={`M10 30 V70 a10 10 0 0 0 20 0 V30 Z`} fill={LUGOL_HEX[tube.lugol]} /></svg>
              <span className="small muted">Color del tubo con lugol (ilustrativo)</span>
            </div>
          )}
          {tubeConds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        </>}
        {station === 'recorrido' && <>
          <Readout items={[
            { k: 'Lugar del alimento', v: `${run.segments[now.index].segment.name} (pH ${fmt(run.segments[now.index].pH, 1)}) a los ${fmt(Math.min(t, run.totalMinutes), 0)} min` },
            { k: 'Almidón digerido por la amilasa de la saliva', v: `${fmt(run.shareSaliva, 1)} %` },
            { k: 'Proteínas digeridas en el estómago (pepsina)', v: `${fmt(run.shareStomach.proteina, 1)} %`, data: true },
            { k: 'Digerido al final del íleon', v: `almidón ${fmt(run.digestedPct.almidon, 1)} %; proteínas ${fmt(run.digestedPct.proteina, 1)} %; grasas ${fmt(run.digestedPct.grasa, 1)} %` },
          ]} />
          <Chart title="Nutrientes digeridos a lo largo del recorrido" xLabel="Tiempo desde que se come (min)" yLabel="Digerido (%)" xUnit="min" yUnit="%" height={240} exportName="digestion-recorrido"
            xDomain={[0, run.totalMinutes]} yDomain={[0, 100]} series={cumul} />
          <div className="table-wrap">
            <table className="small">
              <caption>pH y nutrientes que quedan sin digerir al salir de cada tramo (modelo)</caption>
              <thead><tr><th scope="col">Tramo</th><th scope="col">pH</th><th scope="col">Minutos</th><th scope="col">Almidón</th><th scope="col">Proteínas</th><th scope="col">Grasas</th></tr></thead>
              <tbody>{run.segments.map((s) => <tr key={s.segment.id}><th scope="row">{s.segment.name}</th><td>{fmt(s.pH, 1)}</td><td>{s.segment.minutes || '—'}</td><td>{fmt(s.remaining.almidon * 100, 0)} %</td><td>{fmt(s.remaining.proteina * 100, 0)} %</td><td>{fmt(s.remaining.grasa * 100, 0)} %</td></tr>)}</tbody>
            </table>
          </div>
          {mealConds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        </>}
        <section className="card" aria-labelledby="dg-3d-h">
          <h3 id="dg-3d-h">Vista 3D: el tubo digestivo con su pH y el bolo de alimento</h3>
          <Scene3D idPrefix="dg" title="Tubo digestivo en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={360} initialOrbit={{ yaw: 0.25, pitch: 0.15 }} status="modelo"
            statusNote="El color de cada órgano indica su pH (rojo: ácido; amarillo: ligeramente ácido; verde: neutro; azul: ligeramente básico) y el número de partículas del bolo es proporcional a lo que aún no se digiere. La forma de los órganos es un esquema, no anatomía a escala." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="dg" intro="Ideas frecuentes sobre la digestión. Decide si son ciertas o falsas y compruébalo con los tubos y el recorrido." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>{station === 'tubos' ? 'Tubo de ensayo a 37 °C' : 'Almuerzo'}</h3>
          {station === 'tubos' && <>
            <Select label="Enzima" value={enzymeId} onChange={setEnzymeId} options={DIGESTIVE_ENZYMES.map((e) => ({ value: e.id, label: `${e.name} (${e.where})` }))} />
            <Slider label="pH del tubo" value={pH} min={1} max={11} step={0.1} unit="" decimals={1} onChange={setPH} />
            <Slider label="Tiempo a 37 °C" value={minutes} min={0} max={30} step={1} unit="min" decimals={0} onChange={setMinutes} />
            <Notice>{findDigestiveEnzyme(enzymeId).name}: actúa en {findDigestiveEnzyme(enzymeId).where} sobre {findDigestiveEnzyme(enzymeId).nutrient === 'almidon' ? 'el almidón' : findDigestiveEnzyme(enzymeId).nutrient === 'proteina' ? 'las proteínas' : 'las grasas'}.</Notice>
          </>}
          {station === 'recorrido' && <>
            <Select label="Situación" value={meal.situation} onChange={(v) => setMeal((m) => ({ ...m, situation: v as Situation }))} options={SITUATIONS.map((s) => ({ value: s.id, label: s.name }))} />
            <Slider label="Almidón (arroz, plátano, yuca)" value={meal.almidon} min={MEAL_LIMITS.g[0]} max={MEAL_LIMITS.g[1]} step={5} unit="g" decimals={0} onChange={setNutrient('almidon')} />
            <Slider label="Proteínas (fríjol, carne, huevo)" value={meal.proteina} min={MEAL_LIMITS.g[0]} max={MEAL_LIMITS.g[1]} step={5} unit="g" decimals={0} onChange={setNutrient('proteina')} />
            <Slider label="Grasas (aceite, aguacate)" value={meal.grasa} min={MEAL_LIMITS.g[0]} max={MEAL_LIMITS.g[1]} step={5} unit="g" decimals={0} onChange={setNutrient('grasa')} />
            <Notice>{SITUATIONS.find((s) => s.id === meal.situation)!.note} En el modelo, la fracción digerida no depende de los gramos (las enzimas no se agotan).</Notice>
          </>}
          {station === 'recorrido' && <SimControls title="Recorrido" status={status} startLabel="Comer el almuerzo" repeatLabel="Repetir el recorrido"
            onStart={() => { setT(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            progress={{ value: t, max: run.totalMinutes, unit: 'min', label: 't', decimals: 0 }} />}
          <RecordButton key={station} onRecord={record} label={station === 'tubos' ? 'Guardar el tubo en la tabla' : 'Guardar el recorrido en la tabla'} />
          <Notice>pH óptimos redondeados de los manuales; pH de los tramos de Guyton y Hall y Fallingborg (1999). Las anchuras de las curvas, las rapideces y los tiempos son ilustrativos. Es un modelo para aprender, no un consejo médico: ante un problema digestivo consulta al médico y no te automediques.</Notice>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BLOOD_VOLUME_L, CIRC_LIMITS, circulationConditions, cycleAt, exercise, pulseFrom15s, recoveryHr, type ExerciseInput,
} from '../models/circulation';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText, SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { heartScene } from './heart3d';

/** Duración de una medición del pulso (s) y aceleración visual del recorrido de la sangre. */
const PULSE_S = 15;
const FLOW_VIS = 6;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Las venas siempre llevan sangre desoxigenada y las arterias sangre oxigenada.', answer: 'falso', feedback: 'Las arterias salen del corazón y las venas llegan a él. La arteria pulmonar lleva sangre desoxigenada a los pulmones y las venas pulmonares traen sangre oxigenada a la aurícula izquierda. Síguelas en la vista 3D.' },
  { id: 'i2', text: 'En la circulación doble la sangre pasa dos veces por el corazón en cada vuelta completa.', answer: 'cierto', feedback: 'Una vez por el lado derecho (que la envía a los pulmones: circulación pulmonar) y otra por el izquierdo (que la envía al cuerpo: circulación sistémica).' },
  { id: 'i3', text: 'Las válvulas del corazón sirven para que la sangre no se devuelva.', answer: 'cierto', feedback: 'Durante la sístole ventricular las válvulas tricúspide y mitral se cierran (evitan el regreso a las aurículas) y las semilunares se abren; en la diástole ocurre lo contrario. El cierre produce los ruidos del latido.' },
  { id: 'i4', text: 'Durante el ejercicio el corazón solo late más rápido; la cantidad de sangre por latido no cambia.', answer: 'falso', feedback: 'También aumenta el volumen sistólico (en el modelo, hasta un 50 %). El gasto cardíaco = FC × VS crece por las dos razones: de unos 5 L/min en reposo a más del triple en un esfuerzo fuerte.' },
  { id: 'i5', text: 'La sangre desoxigenada es azul.', answer: 'falso', feedback: 'Es rojo oscuro. El azul es una convención de los esquemas para distinguirla de la oxigenada (rojo vivo); las venas se ven azuladas a través de la piel por cómo la piel absorbe y refleja la luz.' },
];

function ExerciseChart({ input, rec }: { input: ExerciseInput; rec: { i: number; hr: number }[] }) {
  const W = 620, H = 250, L = 52, R = 52, T = 14, B = 38;
  const pts = Array.from({ length: 21 }, (_, k) => exercise({ ...input, intensity: k * 5 }));
  const x = (i: number) => L + (i / 100) * (W - L - R);
  const yH = (hr: number) => T + ((220 - hr) / 170) * (H - T - B);
  const yC = (co: number) => T + ((25 - co) / 25) * (H - T - B);
  const cur = exercise(input);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="cir-g-t cir-g-d" style={{ width: '100%', height: 'auto' }}>
      <title id="cir-g-t">Frecuencia cardíaca y gasto cardíaco según la intensidad del ejercicio (modelo)</title>
      <desc id="cir-g-d">{`Línea continua: frecuencia cardíaca del modelo, de ${fmt(pts[0].hr, 0)} a ${fmt(pts[20].hr, 0)} lpm. Línea punteada: gasto cardíaco, de ${fmt(pts[0].co, 1)} a ${fmt(pts[20].co, 1)} L/min. Punto: intensidad actual ${input.intensity} %. ${rec.length} mediciones guardadas.`}</desc>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="var(--surface)" stroke="var(--line)" />
      {[50, 100, 150, 200].map((h) => <g key={h}><line x1={L} x2={W - R} y1={yH(h)} y2={yH(h)} stroke="var(--line)" strokeDasharray="2 3" /><text x={L - 6} y={yH(h) + 4} textAnchor="end" style={{ fontSize: 10, fill: 'var(--series-1)', fontFamily: 'var(--font-data)' }}>{h}</text></g>)}
      {[0, 10, 20].map((c) => <text key={c} x={W - R + 6} y={yC(c) + 4} style={{ fontSize: 10, fill: 'var(--series-2)', fontFamily: 'var(--font-data)' }}>{c}</text>)}
      {[0, 25, 50, 75, 100].map((i) => <text key={i} x={x(i)} y={H - B + 16} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{i}</text>)}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)' }}>intensidad del ejercicio (% de la reserva)</text>
      <text x="6" y={T + 6} style={{ fontSize: 10, fill: 'var(--series-1)' }}>lpm</text>
      <text x={W - 44} y={T + 6} style={{ fontSize: 10, fill: 'var(--series-2)' }}>L/min</text>
      <polyline points={pts.map((p, k) => `${x(k * 5)},${yH(p.hr).toFixed(1)}`).join(' ')} fill="none" stroke="var(--series-1)" strokeWidth="2.2" />
      <polyline points={pts.map((p, k) => `${x(k * 5)},${yC(p.co).toFixed(1)}`).join(' ')} fill="none" stroke="var(--series-2)" strokeWidth="2.2" strokeDasharray="6 4" />
      {rec.map((r, k) => <circle key={k} cx={x(r.i)} cy={yH(r.hr)} r="4" fill="var(--data)" stroke="var(--surface)" />)}
      <circle cx={x(input.intensity)} cy={yH(cur.hr)} r="6" fill="none" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

export default function CirculatoryLab({ api }: LabProps) {
  const [age, setAge] = useState(15);
  const [hrRest, setHrRest] = useState(72);
  const [svRest, setSvRest] = useState(70);
  const [intensity, setIntensity] = useState(0);
  const [measured, setMeasured] = useState(false);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [own, setOwn] = useState(18);
  const [moment, setMoment] = useState('reposo');
  const raf = useRef(0);
  const { measure, remeasure, real } = useMeasure();

  const input = useMemo(() => ({ age, hrRest, svRest, intensity }), [age, hrRest, svRest, intensity]);
  const e = useMemo(() => exercise(input), [input]);
  const conds = useMemo(() => circulationConditions(input, own), [input, own]);
  const pulso = instrument('sistema-circulatorio', 'pulsometro'), tens = instrument('sistema-circulatorio', 'tensiometro');
  const hrRead = measure(e.hr, { ...pulso, key: 'fc' }), sbpRead = measure(e.sbp, { ...tens, key: 'pas' }), dbpRead = measure(e.dbp, { ...tens, key: 'pad' });

  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); };
  useEffect(() => { setMeasured(false); }, [input]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(PULSE_S); setRunning(false); return; }
    const start = performance.now() - t * 1000;
    const tick = (now: number) => {
      const el = (now - start) / 1000;
      if (el >= PULSE_S) { setT(PULSE_S); setRunning(false); playSound('click', { intensity: 0.5 }); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = !running && t >= PULSE_S;
  const status = simStatusOf(running, t > 0, finished);
  const beats = Math.floor((t * e.hr) / 60 + 1e-9);
  const beatPhase = (t * e.hr) / 60;
  const cyc = cycleAt(beatPhase, e.hr);

  usePublishModel(() => ({
    vars: {
      FC: { sym: 'FC', name: 'Frecuencia cardíaca', value: e.hr, unit: 'lpm', decimals: 0 },
      VS: { sym: 'VS', name: 'Volumen sistólico', value: e.sv / 1000, unit: 'L', decimals: 3 },
      GC: { sym: 'GC', name: 'Gasto cardíaco', value: e.co, unit: 'L/min', decimals: 2 },
    },
    equations: [{ title: 'Gasto cardíaco', lhs: 'GC', expr: '[FC]·[VS]' }],
  }), [e]);

  const scene = useMemo(() => heartScene({ hr: e.hr, beatPhase, flowPhase: ((t / 60) * e.co / BLOOD_VOLUME_L) * FLOW_VIS, co: e.co }), [e, beatPhase, t]);
  const rec = api.session.trials.filter((x) => x.datasetId === 'ejercicio' && x.values.edad === age && x.values.fcReposo === hrRest).map((x) => ({ i: Number(x.values.intensidad), hr: Number(x.values.fc) }));

  const recordE = () => api.addTrial('ejercicio', {
    intensidad: intensity, edad: age, fcReposo: hrRest, vsReposo: svRest, fc: hrRead, vs: Number(e.sv.toFixed(1)), gasto: Number(e.co.toFixed(2)),
    pas: sbpRead, pad: dbpRead, fcMax: Number(e.hrMax.toFixed(1)),
  });
  const recordP = () => api.addTrial('pulso', { momento: moment, minuto: moment.startsWith('recuperación') ? Number(moment.slice(-1)) : moment === 'reposo' ? -1 : 0, latidos15: own, fc: pulseFrom15s(own), origen: 'propio' });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench"><ExerciseChart input={input} rec={rec} /></div>
        <Readout items={[
          { k: 'Frecuencia cardíaca (pulsioxímetro)', v: measured ? `${fmt(hrRead, 0)} lpm` : 'mide', data: true, resolution: measured ? resolutionText(pulso.resolution, 'lpm') : undefined },
          { k: 'Presión arterial (tensiómetro, modelo)', v: measured ? `${fmt(sbpRead, 0)}/${fmt(dbpRead, 0)} mmHg` : 'mide', data: true, resolution: measured ? resolutionText(tens.resolution, 'mmHg') : undefined },
          { k: 'Volumen sistólico (modelo)', v: `${fmt(e.sv, 0)} mL` },
          { k: 'Gasto cardíaco = FC × VS', v: `${fmt(e.co, 2)} L/min`, data: true },
          { k: 'FC máxima estimada (208 − 0,7 × edad)', v: `${fmt(e.hrMax, 1)} lpm` },
          { k: `Tiempo para que circulen ${BLOOD_VOLUME_L} L de sangre`, v: `${fmt(e.circulationS, 0)} s` },
          { k: 'Recuperación esperada 1 min después (modelo)', v: intensity > 0 ? `${fmt(recoveryHr(hrRest, e.hr, 1), 0)} lpm` : '—' },
        ]} />
        {conds.map((c) => <ConditionAlert key={c.text} level={c.level} cause={c.text} fix={c.fix} />)}
        <Notice kind="warn">Contenido educativo: los valores son de un modelo promedio y no sirven para diagnosticar ni para decidir cuánto ejercicio puede hacer una persona. Si sientes mareo, dolor en el pecho o falta de aire, detente y avisa al docente.</Notice>
        <section className="card stack" aria-labelledby="cir-3d-h">
          <h3 id="cir-3d-h">Vista 3D: cavidades, válvulas y circulación doble</h3>
          <Scene3D idPrefix="cir" title="Corazón y circulación doble en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={380} initialOrbit={{ yaw: 0.2, pitch: 0.2 }} status="ilustracion"
            statusNote={`Esquema sin escala. La contracción y las válvulas siguen la fase del ciclo del modelo a la frecuencia elegida; la sangre avanza ${FLOW_VIS} veces más rápido que en la realidad. Rojo: oxigenada; azul: desoxigenada (convención).`} />
          <SimControls title="Latido y medición del pulso" status={status} startLabel="Hacer latir y contar 15 s" repeatLabel="Contar otra vez"
            onStart={() => { setT(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset}
            progress={{ value: t, max: PULSE_S, unit: 's', label: 't', decimals: 1 }} />
          <Readout live={false} items={[
            { k: 'Fase del ciclo', v: cyc.name },
            { k: 'Válvulas AV (tricúspide y mitral)', v: cyc.avOpen ? 'abiertas' : 'cerradas' },
            { k: 'Válvulas semilunares (pulmonar y aórtica)', v: cyc.semilunarOpen ? 'abiertas' : 'cerradas' },
            { k: 'Latidos contados', v: `${beats} en ${fmt(t, 1)} s${finished ? ` → ${beats * 4} lpm` : ''}`, data: true },
            { k: 'Duración del latido y de la sístole', v: `${fmt(cyc.periodS, 3)} s; ${fmt(cyc.systoleS, 3)} s` },
          ]} />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="cir" intro="Ideas frecuentes sobre el corazón y la circulación. Decide si son ciertas o falsas y compruébalo con el modelo y la vista 3D." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Persona de referencia y ejercicio</h3>
          <Slider label="Edad" value={age} min={CIRC_LIMITS.age[0]} max={CIRC_LIMITS.age[1]} step={1} unit="años" decimals={0} onChange={setAge} />
          <Slider label="Frecuencia cardíaca en reposo" value={hrRest} min={CIRC_LIMITS.hrRest[0]} max={CIRC_LIMITS.hrRest[1]} step={1} unit="lpm" decimals={0} onChange={setHrRest} />
          <Slider label="Volumen sistólico en reposo" value={svRest} min={CIRC_LIMITS.svRest[0]} max={CIRC_LIMITS.svRest[1]} step={1} unit="mL" decimals={0} onChange={setSvRest} />
          <Slider label="Intensidad del ejercicio" value={intensity} min={0} max={100} step={5} unit="%" decimals={0} onChange={setIntensity} hint="Fracción de la reserva cardíaca (Karvonen): 0 % = reposo." />
          <button type="button" className="btn primary" onClick={() => { remeasure('fc', 'pas', 'pad'); setMeasured(true); playSound('click', { intensity: 0.5 }); }}>Medir pulso y presión</button>
          <RecordButton onRecord={recordE} disabled={!measured} />
          <Notice>{real ? 'Instrumento real: cada lectura trae la variación típica del pulsioxímetro y del tensiómetro.' : 'Pulsioxímetro (1 lpm) y tensiómetro (1 mmHg) sobre el modelo.'}</Notice>
        </div>
        <div className="card stack">
          <h3>Tu propio pulso (opcional)</h3>
          <p className="small muted" style={{ margin: 0 }}>Con dos dedos en la muñeca, cuenta los latidos durante 15 s en reposo y después de 1 minuto de marcha suave en el puesto (con permiso del docente). Tus datos se quedan en este equipo.</p>
          <Select label="Momento de la medición" value={moment} onChange={setMoment} options={[{ value: 'reposo', label: 'En reposo' }, { value: 'después de la marcha', label: 'Justo después de 1 min de marcha' }, { value: 'recuperación 1', label: 'Recuperación: 1 min después' }, { value: 'recuperación 2', label: 'Recuperación: 2 min después' }]} />
          <Slider label="Latidos contados en 15 s" value={own} min={0} max={60} step={1} unit="" decimals={0} onChange={setOwn} />
          <p className="small" style={{ margin: 0 }}>Frecuencia: <strong>{pulseFrom15s(own)} lpm</strong> (latidos × 4).</p>
          <RecordButton onRecord={recordP} disabled={own === 0} label="Guardar mi pulso en la tabla" />
        </div>
      </div>
    </div>
  );
}

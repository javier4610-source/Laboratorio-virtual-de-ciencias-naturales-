import { useEffect, useMemo, useRef, useState } from 'react';
import {
  antibodyResponse, coverageNeeded, DISEASES, findDisease, herdThreshold, MEASLES_VACCINE, simulateSIR, sirConditions, type Exposure,
} from '../models/immunity';
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
import { antibodyScene, populationScene } from './immunity3d';

type Station = 'anticuerpos' | 'epidemia' | 'colectiva';
type Scenario = 'infeccion' | 'vacuna' | 'refuerzo';
const SCENARIOS: { id: Scenario; name: string; exposures: Exposure[] }[] = [
  { id: 'infeccion', name: 'Primera infección (día 0), sin vacuna', exposures: [{ day: 0, kind: 'infeccion' }] },
  { id: 'vacuna', name: 'Vacuna (día 0) y contacto con el microbio (día 30)', exposures: [{ day: 0, kind: 'vacuna' }, { day: 30, kind: 'infeccion' }] },
  { id: 'refuerzo', name: 'Vacuna (día 0) y dosis de refuerzo (día 21)', exposures: [{ day: 0, kind: 'vacuna' }, { day: 21, kind: 'vacuna' }] },
];
const HORIZON = 60;
const N_POP = 10_000;
const DAYS = 300;
const SCREEN_S = 12;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Una vacuna funciona porque trae anticuerpos listos que se quedan para siempre en la sangre.', answer: 'falso', feedback: 'La vacuna presenta el antígeno sin causar la enfermedad: el cuerpo fabrica sus propios anticuerpos y, sobre todo, células de memoria que responden más rápido y más fuerte en el siguiente contacto.' },
  { id: 'i2', text: 'La segunda vez que el cuerpo encuentra el mismo antígeno, la respuesta es más rápida y más fuerte.', answer: 'cierto', feedback: 'Es la memoria inmunológica: en la respuesta secundaria la latencia es de pocos días y el pico de anticuerpos (IgG) es mucho mayor.' },
  { id: 'i3', text: 'Si yo estoy vacunado, no importa si los demás se vacunan.', answer: 'falso', feedback: 'Ninguna vacuna protege al 100 %, y hay personas que no pueden vacunarse (bebés muy pequeños, algunas personas enfermas). Con suficiente cobertura el microbio no encuentra a quién contagiar: es la inmunidad colectiva.' },
  { id: 'i4', text: 'Para el sarampión hace falta vacunar a más gente que para la influenza estacional para frenar los contagios.', answer: 'cierto', feedback: 'El umbral es 1 − 1/R₀: con R₀ de 12 a 18 (sarampión) es 92–94 %; con R₀ ≈ 1,3 (influenza) es ≈ 22 %.' },
  { id: 'i5', text: 'Los anticuerpos reconocen a cualquier microbio.', answer: 'falso', feedback: 'Cada anticuerpo se une solo a un antígeno con la forma complementaria de sus sitios de unión: la respuesta es específica.' },
];

export default function ImmunityLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('anticuerpos');
  const [scenario, setScenario] = useState<Scenario>('vacuna');
  const [diseaseId, setDiseaseId] = useState('sarampion');
  const [R0, setR0] = useState(15);
  const [coverage, setCoverage] = useState(0);
  const [efficacy, setEfficacy] = useState(97);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  const disease = findDisease(diseaseId);
  const ab = useMemo(() => antibodyResponse(SCENARIOS.find((s) => s.id === scenario)!.exposures, HORIZON), [scenario]);
  const run = useMemo(() => simulateSIR({ R0, infectiousDays: disease.infectiousDays, coverage: coverage / 100, efficacy: efficacy / 100, N: N_POP, I0: 5, days: DAYS }), [R0, disease, coverage, efficacy]);
  const conds = station === 'anticuerpos' ? [] : sirConditions(run, diseaseId);
  const changeDisease = (id: string) => { setDiseaseId(id); const d = findDisease(id); setR0(Number(((d.R0[0] + d.R0[1]) / 2).toFixed(2))); };

  const duration = station === 'anticuerpos' ? HORIZON : station === 'epidemia' ? DAYS : 0;
  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); };
  useEffect(resetRun, [station, scenario, R0, diseaseId, coverage, efficacy]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(duration); setRunning(false); return; }
    const speed = duration / SCREEN_S;
    const start = performance.now() - (t / speed) * 1000;
    const tick = (n: number) => {
      // La marca de tiempo del cuadro puede ser un poco anterior a «start»: nunca un tiempo negativo.
      const el = Math.max(0, ((n - start) / 1000) * speed);
      if (el >= duration) { setT(duration); setRunning(false); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = duration > 0 && t >= duration && !running;
  const status = simStatusOf(running, t > 0, finished);

  const titerAt = (d: number) => ab.points[Math.min(ab.points.length - 1, Math.round(d * 4))].titer;
  const popAt = (d: number) => run.points[Math.min(run.points.length - 1, Math.round(d))];
  const scene = useMemo(() => {
    if (station === 'anticuerpos') return antibodyScene(titerAt(t), t);
    const p = popAt(station === 'colectiva' ? DAYS : t);
    return populationScene({ S: p.S, I: p.I, R: p.R, V: p.V, day: p.day });
  }, [station, t, ab, run]); // eslint-disable-line react-hooks/exhaustive-deps

  usePublishModel(() => ({
    vars: {
      R0: { sym: 'R₀', name: 'Número reproductivo básico', value: R0, unit: '', decimals: 2 },
      e: { sym: 'e', name: 'Eficacia de la vacuna', value: efficacy / 100, unit: '', decimals: 2 },
    },
    equations: [
      { title: 'Umbral de inmunidad colectiva', lhs: 'H', expr: '1 − \\frac{1}{[R0]}' },
      { title: 'Cobertura necesaria', lhs: 'V', expr: '\\frac{1 − 1/[R0]}{[e]}' },
    ],
  }), [R0, efficacy]);

  const record = () => {
    if (station === 'anticuerpos') api.addTrial('anticuerpos', { escenario: SCENARIOS.find((s) => s.id === scenario)!.name, dia1: ab.peaks[0].day, pico1: Number(ab.peaks[0].titer.toFixed(2)), dia2: ab.peaks[1]?.day ?? null, pico2: ab.peaks[1] ? Number(ab.peaks[1].titer.toFixed(2)) : null });
    else api.addTrial('epidemia', { enfermedad: disease.name, R0, cobertura: coverage, eficacia: efficacy, protegidos: Number((run.protectedFraction * 100).toFixed(1)), umbral: Number((run.threshold * 100).toFixed(1)), infectados: Number((run.attackRate * 100).toFixed(2)), pico: Math.round(run.peak.I) });
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'anticuerpos', label: 'Respuesta de anticuerpos' }, { value: 'epidemia', label: 'Epidemia y vacunación' }, { value: 'colectiva', label: 'Inmunidad colectiva' }]} />
        <Notice kind="warn">Modelo para aprender, no consejo médico: para decisiones de salud y sobre el esquema de vacunación consulta al personal de salud y sigue las indicaciones oficiales.</Notice>
        {station === 'anticuerpos' && <>
          <Readout items={[
            { k: 'Título de anticuerpos ahora', v: `${fmt(titerAt(t), 2)} veces el pico primario (día ${fmt(t, 0)})`, data: true },
            { k: 'Primer pico', v: `día ${fmt(ab.peaks[0].day, 0)}: ${fmt(ab.peaks[0].titer, 2)}` },
            ...(ab.peaks[1] ? [{ k: 'Segundo pico (respuesta secundaria)', v: `día ${fmt(ab.peaks[1].day, 0)}: ${fmt(ab.peaks[1].titer, 1)} (${fmt(ab.peaks[1].titer / ab.peaks[0].titer, 0)} veces el primero)` }] : []),
          ]} />
          <Chart title="Anticuerpos en la sangre después de cada contacto con el antígeno (forma ilustrativa)" xLabel="Día" yLabel="Título relativo al pico primario" height={240} exportName="anticuerpos"
            xDomain={[0, HORIZON]} series={[{ label: 'Título de anticuerpos', color: 'var(--series-2)', kind: 'line', points: ab.points.filter((_, i) => i % 2 === 0).map((p) => ({ x: p.day, y: p.titer })) }]} />
        </>}
        {station === 'epidemia' && <>
          <Readout items={[
            { k: 'Protegidos por la vacuna', v: `${fmt(run.protectedFraction * 100, 1)} % (cobertura × eficacia)` },
            { k: 'Umbral de inmunidad colectiva H = 1 − 1/R₀', v: `${fmt(run.threshold * 100, 1)} %` },
            { k: 'Número reproductivo al empezar', v: `${fmt(run.Reff0, 2)} ${run.Reff0 < 1 ? '(menor que 1: el brote se apaga)' : '(mayor que 1: el brote crece)'}` },
            { k: 'Personas infectadas en total', v: `${fmt(run.attackRate * 100, 1)} % de ${fmt(N_POP, 0)}`, data: true },
            { k: 'Pico de infectados a la vez', v: `${fmt(run.peak.I, 0)} personas el día ${fmt(run.peak.day, 0)}` },
          ]} />
          <Chart title="Epidemia en una población de 10 000 personas (modelo SIR)" xLabel="Día" yLabel="Personas" height={260} exportName="epidemia-sir"
            xDomain={[0, DAYS]} series={[
              { label: 'Susceptibles', color: 'var(--series-8)', kind: 'line', points: run.points.filter((_, i) => i % 3 === 0).map((p) => ({ x: p.day, y: p.S })) },
              { label: 'Infectados', color: 'var(--series-1)', kind: 'line', points: run.points.filter((_, i) => i % 3 === 0).map((p) => ({ x: p.day, y: p.I })) },
              { label: 'Recuperados', color: 'var(--series-3)', kind: 'line', points: run.points.filter((_, i) => i % 3 === 0).map((p) => ({ x: p.day, y: p.R })) },
              { label: 'Protegidos por la vacuna', color: 'var(--series-2)', kind: 'line', dashed: true, points: [{ x: 0, y: run.points[0].V }, { x: DAYS, y: run.points[0].V }] },
            ]} />
        </>}
        {station === 'colectiva' && <>
          <div className="table-wrap">
            <table className="small">
              <caption>Umbral de inmunidad colectiva H = 1 − 1/R₀ y cobertura necesaria con la vacuna contra el sarampión</caption>
              <thead><tr><th scope="col">Enfermedad</th><th scope="col">R₀ (fuente)</th><th scope="col">Umbral H</th><th scope="col">Cobertura con 1 dosis (93 %)</th><th scope="col">Con 2 dosis (97 %)</th></tr></thead>
              <tbody>
                {DISEASES.filter((d) => d.id !== 'imaginaria').map((d) => (
                  <tr key={d.id}><th scope="row">{d.name}</th><td>{fmt(d.R0[0], d.R0[0] < 2 ? 2 : 0)} a {fmt(d.R0[1], d.R0[1] < 2 ? 2 : 0)}</td><td>{fmt(herdThreshold(d.R0[0]) * 100, 1)} a {fmt(herdThreshold(d.R0[1]) * 100, 1)} %</td>
                    <td>{d.id === 'sarampion' ? `${fmt(coverageNeeded(d.R0[0], MEASLES_VACCINE.oneDose) * 100, 1)} a ${fmt(coverageNeeded(d.R0[1], MEASLES_VACCINE.oneDose) * 100, 1)} %` : '—'}</td>
                    <td>{d.id === 'sarampion' ? `${fmt(coverageNeeded(d.R0[0], MEASLES_VACCINE.twoDoses) * 100, 1)} a ${fmt(coverageNeeded(d.R0[1], MEASLES_VACCINE.twoDoses) * 100, 1)} %` : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">{DISEASES.map((d) => d.source).join(' ')} Eficacia de la vacuna contra el sarampión: CDC (Pink Book). Más del 100 % significa que esa vacuna sola no alcanza.</p>
          <Readout items={[
            { k: 'Con tu R₀: umbral H = 1 − 1/R₀', v: `${fmt(herdThreshold(R0) * 100, 1)} %`, data: true },
            { k: 'Cobertura necesaria con tu eficacia', v: `${fmt(coverageNeeded(R0, efficacy / 100) * 100, 1)} %` },
            { k: 'Con tu cobertura, al final de la epidemia', v: `se infectó el ${fmt(run.attackRate * 100, 1)} % de la población` },
          ]} />
          <Chart title="Umbral de inmunidad colectiva contra R₀" xLabel="R₀" yLabel="Umbral (%)" yUnit="%" height={220} exportName="umbral-r0" xDomain={[1, 20]} yDomain={[0, 100]}
            series={[
              { label: 'H = 1 − 1/R₀', color: 'var(--series-2)', kind: 'line', points: Array.from({ length: 77 }, (_, i) => 1 + i * 0.25).map((r) => ({ x: r, y: herdThreshold(r) * 100 })) },
              { label: 'Tu R₀', color: 'var(--data)', kind: 'scatter', points: [{ x: R0, y: herdThreshold(R0) * 100 }] },
            ]} />
        </>}
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="inm-3d-h">
          <h3 id="inm-3d-h">{station === 'anticuerpos' ? 'Vista 3D: anticuerpos unidos a un microbio' : 'Vista 3D: la población durante la epidemia'}</h3>
          <Scene3D idPrefix="inm" title={station === 'anticuerpos' ? 'Anticuerpos y antígenos en 3D' : 'Población en 3D'} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={330} initialOrbit={station === 'anticuerpos' ? { yaw: 0.4, pitch: 0.3 } : { yaw: 0.3, pitch: 0.8 }} status="modelo"
            statusNote={station === 'anticuerpos' ? 'El número de anticuerpos es proporcional al título del modelo; la forma en Y, el microbio y la curva de la respuesta son ilustrativos (no es la estructura de una IgG).' : 'Cada esfera es 1/400 de la población y los colores siguen las proporciones del modelo SIR; la posición de las personas es un esquema.'} />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="inm" intro="Ideas frecuentes sobre el sistema inmune y las vacunas. Decide si son ciertas o falsas y compruébalo con el laboratorio." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>{station === 'anticuerpos' ? 'Contactos con el antígeno' : 'Población y vacuna'}</h3>
          {station === 'anticuerpos' && <Select label="Escenario" value={scenario} onChange={(v) => setScenario(v as Scenario)} options={SCENARIOS.map((s) => ({ value: s.id, label: s.name }))} />}
          {station !== 'anticuerpos' && <>
            <Select label="Enfermedad" value={diseaseId} onChange={changeDisease} options={DISEASES.map((d) => ({ value: d.id, label: d.name }))} />
            <Slider label="Número reproductivo básico R₀" value={R0} min={diseaseId === 'imaginaria' ? 1 : disease.R0[0]} max={diseaseId === 'imaginaria' ? 20 : disease.R0[1]} step={0.01} unit="" decimals={2} onChange={setR0} />
            <Slider label="Cobertura de vacunación" value={coverage} min={0} max={100} step={1} unit="%" decimals={0} onChange={setCoverage} />
            <Slider label="Eficacia de la vacuna" value={efficacy} min={50} max={100} step={1} unit="%" decimals={0} onChange={setEfficacy} />
            <Notice>{disease.source} Población ilustrativa de 10 000 personas con 5 casos al empezar; {disease.infectiousDays} días de contagio (valor redondeado).</Notice>
          </>}
          {station !== 'colectiva' && <SimControls title="Días" status={status} startLabel="Avanzar los días" repeatLabel="Repetir"
            onStart={() => { setT(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            progress={{ value: t, max: duration, unit: 'días', label: 'día', decimals: 0 }} />}
          <RecordButton key={station} onRecord={record} label={station === 'anticuerpos' ? 'Guardar la respuesta en la tabla' : 'Guardar la epidemia en la tabla'} />
        </div>
      </div>
    </div>
  );
}

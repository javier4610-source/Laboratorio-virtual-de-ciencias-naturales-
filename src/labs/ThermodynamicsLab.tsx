import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CARNOT_LIMITS, carnotCycle, cycleConditions, findGas, GASES, gasProcess, initialState, N0, OTTO_LIMITS, ottoCycle, PROCESSES, processConditions, stateAlong,
  type Cycle, type Process, type ProcessKind,
} from '../models/thermodynamics';
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
import { pistonScene } from './thermodynamics3d';

type Station = 'procesos' | 'otto' | 'carnot';
/** Duración en pantalla de un recorrido (s): un proceso en 4 s, un ciclo en 8 s. */
const SCREEN = { procesos: 4, otto: 8, carnot: 8 };
const LEG_NAMES: Record<'otto' | 'carnot', string[]> = {
  otto: ['1 → 2: compresión adiabática', '2 → 3: calentamiento a volumen constante (chispa)', '3 → 4: expansión adiabática', '4 → 1: enfriamiento a volumen constante (escape)'],
  carnot: ['1 → 2: expansión isotérmica a T_c', '2 → 3: expansión adiabática', '3 → 4: compresión isotérmica a T_f', '4 → 1: compresión adiabática'],
};
const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Si un gas recibe calor, su temperatura siempre sube.', answer: 'falso', feedback: 'En una expansión isotérmica el gas recibe calor y su temperatura no cambia: todo el calor se convierte en trabajo sobre el émbolo (ΔU = 0, Q = W).' },
  { id: 'i2', text: 'En una compresión adiabática el gas se calienta aunque no reciba calor.', answer: 'cierto', feedback: 'Q = 0, pero el émbolo hace trabajo sobre el gas (W < 0): ΔU = Q − W > 0 y la temperatura sube. Así se enciende el combustible en un motor diésel.' },
  { id: 'i3', text: 'Una máquina térmica bien hecha puede convertir todo el calor en trabajo.', answer: 'falso', feedback: 'En un ciclo siempre hay que ceder calor a una fuente fría para volver al estado inicial. El rendimiento máximo es el de Carnot, 1 − T_f/T_c, menor que 1.' },
  { id: 'i4', text: 'El trabajo de un ciclo es el área encerrada por la curva en el diagrama P–V.', answer: 'cierto', feedback: 'En cada etapa W es el área bajo la curva (positiva al expandirse, negativa al comprimirse); al sumar las cuatro queda el área encerrada.' },
  { id: 'i5', text: 'El calor y la energía interna son lo mismo: el gas «tiene» calor.', answer: 'falso', feedback: 'El gas tiene energía interna U; el calor Q es energía que pasa por una diferencia de temperatura. U es función del estado; Q y W dependen del camino.' },
];

export default function ThermodynamicsLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('procesos');
  const [kind, setKind] = useState<ProcessKind>('isotermico');
  const [ratio, setRatio] = useState(2);
  const [gasId, setGasId] = useState('diatomico');
  const [r, setR] = useState(8);
  const [Tmax, setTmax] = useState(1800);
  const [Th, setTh] = useState(600);
  const [Tc, setTc] = useState(300);
  const [frac, setFrac] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  const proc: Process = useMemo(() => gasProcess(kind, N0, gasId, initialState(), ratio), [kind, gasId, ratio]);
  const cycle: Cycle | null = useMemo(() => {
    if (station === 'otto') return ottoCycle(r, Tmax, gasId);
    if (station === 'carnot') return Tc < Th ? carnotCycle(Th, Tc, 2, gasId) : null;
    return null;
  }, [station, r, Tmax, Th, Tc, gasId]);
  const legs = station === 'procesos' ? [proc] : cycle?.legs ?? [];
  const conds = station === 'procesos' ? processConditions(proc) : cycle ? cycleConditions(cycle, station === 'otto' ? r : undefined) : [];
  const along = legs.length ? stateAlong(legs, frac) : null;
  const Vmax = Math.max(...legs.flatMap((l) => l.path.map((p) => p.V)), 1e-3);
  const stageLabel = station === 'procesos' ? PROCESSES.find((p) => p.id === kind)!.name : along ? LEG_NAMES[station][along.leg] : '';
  const scene = useMemo(() => along ? pistonScene({ s: along.s, Vmax, dQsign: running || (frac > 0 && frac < 1) ? along.dQsign : 0, dWsign: running || (frac > 0 && frac < 1) ? along.dWsign : 0, t: frac * 8, stageLabel }) : null,
    [along, Vmax, running, frac, stageLabel]);

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setFrac(0); };
  useEffect(resetRun, [station, kind, ratio, gasId, r, Tmax, Th, Tc]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setFrac(1); setRunning(false); return; }
    const dur = SCREEN[station] * 1000;
    const start = performance.now() - frac * dur;
    const tick = (now: number) => {
      const f = Math.max(0, (now - start) / dur);
      if (f >= 1) { setFrac(1); setRunning(false); return; }
      setFrac(f);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, station]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = frac >= 1 && !running;
  const status = simStatusOf(running, frac > 0, finished);

  usePublishModel(() => ({
    vars: {
      n: { sym: 'n', name: 'Cantidad de gas', value: N0, unit: 'mol', decimals: 4 },
      T: { sym: 'T', name: 'Temperatura inicial', value: proc.s1.T, unit: 'K', decimals: 0 },
      r: { sym: 'V₂/V₁', name: 'Relación de volúmenes', value: ratio, unit: '', decimals: 2 },
      Q: { sym: 'Q', name: 'Calor recibido', value: proc.Q, unit: 'J', decimals: 2 },
      W: { sym: 'W', name: 'Trabajo hecho por el gas', value: proc.W, unit: 'J', decimals: 2 },
    },
    equations: [
      { title: 'Primera ley', lhs: 'ΔU', expr: '[Q] − [W]' },
      { title: 'Trabajo isotérmico', lhs: 'W', expr: '[n]·R·[T]·\\ln([r])' },
    ],
  }), [proc, ratio]);

  const chartSeries: Series[] = legs.map((l, i) => ({ label: station === 'procesos' ? stageLabel : LEG_NAMES[station as 'otto' | 'carnot'][i], color: COLORS[i], kind: 'line' as const, points: l.path.map((p) => ({ x: p.V * 1000, y: p.P / 1000 })) }));
  if (along && frac > 0) chartSeries.push({ label: 'Estado del gas ahora', color: 'var(--data)', kind: 'scatter', points: [{ x: along.s.V * 1000, y: along.s.P / 1000 }] });

  const record = () => {
    if (station === 'procesos') api.addTrial('procesos', { proceso: PROCESSES.find((p) => p.id === kind)!.name, gas: findGas(gasId).name, relacion: ratio, T2: Number(proc.s2.T.toFixed(1)), P2: Number((proc.s2.P / 1000).toFixed(2)), W: Number(proc.W.toFixed(2)), Q: Number(proc.Q.toFixed(2)), dU: Number(proc.dU.toFixed(2)) });
    else if (cycle) api.addTrial('ciclos', { ciclo: station === 'otto' ? 'Otto' : 'Carnot', r: station === 'otto' ? r : null, Tc: station === 'carnot' ? Th : Number(cycle.Tmax.toFixed(0)), Tf: station === 'carnot' ? Tc : Number(cycle.Tmin.toFixed(0)), Wnet: Number(cycle.Wnet.toFixed(2)), Qin: Number(cycle.Qin.toFixed(2)), eta: Number((cycle.eta * 100).toFixed(2)), etaCarnot: Number((cycle.etaCarnotLimit * 100).toFixed(2)) });
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'procesos', label: 'Procesos y primera ley' }, { value: 'otto', label: 'Ciclo de Otto' }, { value: 'carnot', label: 'Ciclo de Carnot' }]} />
        {along && <Readout items={[
          { k: 'Estado del gas', v: `${fmt(along.s.P / 1000, 1)} kPa; ${fmt(along.s.V * 1000, 3)} L; ${fmt(along.s.T, 0)} K`, data: true },
          { k: 'Etapa', v: stageLabel },
        ]} />}
        <Chart title="Diagrama presión–volumen" xLabel="Volumen (L)" yLabel="Presión (kPa)" xUnit="L" yUnit="kPa" height={260} exportName="diagrama-pv" series={chartSeries} />
        {station === 'procesos' && (
          <Readout items={[
            { k: 'Estado final', v: `${fmt(proc.s2.P / 1000, 1)} kPa; ${fmt(proc.s2.V * 1000, 3)} L; ${fmt(proc.s2.T, 1)} K` },
            { k: 'Trabajo hecho por el gas W', v: `${fmt(proc.W, 2)} J` },
            { k: 'Calor recibido Q', v: `${fmt(proc.Q, 2)} J` },
            { k: 'Cambio de energía interna ΔU = Q − W', v: `${fmt(proc.dU, 2)} J`, data: true },
          ]} />
        )}
        {cycle && (
          <>
            <div className="table-wrap">
              <table className="small">
                <caption>Calor, trabajo y energía interna en cada etapa (J)</caption>
                <thead><tr><th scope="col">Etapa</th><th scope="col">Q</th><th scope="col">W</th><th scope="col">ΔU</th></tr></thead>
                <tbody>
                  {cycle.legs.map((l, i) => <tr key={i}><th scope="row">{LEG_NAMES[cycle.kind][i]}</th><td>{fmt(l.Q, 1)}</td><td>{fmt(l.W, 1)}</td><td>{fmt(l.dU, 1)}</td></tr>)}
                  <tr><th scope="row">Ciclo completo</th><td>{fmt(cycle.Qin + cycle.Qout, 1)}</td><td>{fmt(cycle.Wnet, 1)}</td><td>{fmt(cycle.legs.reduce((s, l) => s + l.dU, 0), 1)}</td></tr>
                </tbody>
              </table>
            </div>
            <Readout items={[
              { k: 'Trabajo neto W = área encerrada', v: `${fmt(cycle.Wnet, 1)} J (área: ${fmt(cycle.area, 1)} J)` },
              { k: 'Calor que entra y que sale', v: `${fmt(cycle.Qin, 1)} J y ${fmt(cycle.Qout, 1)} J` },
              { k: 'Rendimiento η = W/Q_entra', v: `${fmt(cycle.eta * 100, 1)} %`, data: true },
              { k: cycle.kind === 'otto' ? 'Fórmula del ciclo: η = 1 − 1/r^(γ−1)' : 'Fórmula de Carnot: η = 1 − T_f/T_c', v: `${fmt(cycle.etaFormula * 100, 1)} %` },
              { k: 'Carnot entre la T máxima y la mínima', v: `${fmt(cycle.etaCarnotLimit * 100, 1)} % (${fmt(cycle.Tmax, 0)} K y ${fmt(cycle.Tmin, 0)} K)` },
            ]} />
          </>
        )}
        {station === 'carnot' && !cycle && <ConditionAlert level="invalido" cause="La fuente fría está a la misma temperatura o más caliente que la caliente: no hay máquina térmica posible." fix="Sube la temperatura de la fuente caliente o baja la de la fría." />}
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        {scene && (
          <section className="card" aria-labelledby="td-3d-h">
            <h3 id="td-3d-h">Vista 3D: el cilindro, el émbolo y las fuentes de calor</h3>
            <Scene3D idPrefix="td" title="Cilindro con émbolo en 3D" items={scene.items} extent={scene.extent} target={scene.target}
              description={scene.description} height={340} initialOrbit={{ yaw: 0.5, pitch: 0.25 }} status="modelo"
              statusNote="La altura del gas es proporcional al volumen del modelo y las flechas muestran el sentido del calor y del trabajo en la etapa en curso. El número de partículas y su agitación son ilustrativos." />
          </section>
        )}
        <IdeasPanel ideas={IDEAS} idPrefix="td" intro="Ideas frecuentes sobre el calor, el trabajo y las máquinas térmicas. Decide si son ciertas o falsas y compruébalo con el cilindro." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Cilindro con émbolo</h3>
          <Select label="Gas" value={gasId} onChange={setGasId} options={GASES.map((g) => ({ value: g.id, label: g.name }))} />
          {station === 'procesos' && <>
            <Select label="Proceso" value={kind} onChange={(v) => setKind(v as ProcessKind)} options={PROCESSES.map((p) => ({ value: p.id, label: p.name }))} />
            <Slider label={kind === 'isocorico' ? 'Relación de temperaturas T₂/T₁' : 'Relación de volúmenes V₂/V₁'} value={ratio} min={0.25} max={4} step={0.05} unit="" decimals={2} onChange={setRatio} />
            <Notice>Estado inicial: 1,00 L a 100 kPa y 300 K. {kind === 'isocorico' ? 'T₂/T₁ > 1 calienta el gas; < 1 lo enfría.' : 'V₂/V₁ > 1 es una expansión; < 1, una compresión.'}</Notice>
          </>}
          {station === 'otto' && <>
            <Slider label="Relación de compresión r" value={r} min={OTTO_LIMITS.r[0]} max={OTTO_LIMITS.r[1]} step={0.5} unit="" decimals={1} onChange={setR} />
            <Slider label="Temperatura máxima (después de la chispa)" value={Tmax} min={OTTO_LIMITS.Tmax[0]} max={OTTO_LIMITS.Tmax[1]} step={10} unit="K" decimals={0} onChange={setTmax} />
          </>}
          {station === 'carnot' && <>
            <Slider label="Temperatura de la fuente caliente T_c" value={Th} min={CARNOT_LIMITS.Th[0]} max={CARNOT_LIMITS.Th[1]} step={10} unit="K" decimals={0} onChange={setTh} />
            <Slider label="Temperatura de la fuente fría T_f" value={Tc} min={CARNOT_LIMITS.Tc[0]} max={CARNOT_LIMITS.Tc[1]} step={5} unit="K" decimals={0} onChange={setTc} />
          </>}
          <SimControls title="Recorrido" status={status} startLabel={station === 'procesos' ? 'Recorrer el proceso' : 'Recorrer el ciclo'} repeatLabel="Repetir el recorrido"
            onStart={() => { setFrac(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            disabled={!legs.length} progress={{ value: frac * 100, max: 100, unit: '%', label: 'avance', decimals: 0 }} />
          <RecordButton key={station} onRecord={record} disabled={!legs.length} label={station === 'procesos' ? 'Guardar el proceso en la tabla' : 'Guardar el ciclo en la tabla'} />
          <Notice>Convención: ΔU = Q − W, con Q positivo si el gas recibe calor y W positivo si el gas hace trabajo al expandirse (en química se suele escribir ΔU = Q + W con el trabajo hecho sobre el gas: es la misma ley). Gas ideal con R de CODATA 2018 y calores específicos constantes.</Notice>
        </div>
      </div>
    </div>
  );
}

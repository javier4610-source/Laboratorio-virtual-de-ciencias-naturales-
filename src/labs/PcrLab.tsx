import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  amplify, bindingFraction, calibrate, checkPrimers, CYCLE_STEPS, gcPercent, LADDER_100BP, migration, PCR_LIMITS, pcrConditions, PRIMER_PAIRS, TEMPLATE,
} from '../models/pcr';
import { fmt, fmtSig } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { gelScene, helixScene, type PcrPhase } from './pcr3d';

type Station = 'cebadores' | 'ciclos' | 'gel';
/** Medio segundo de pantalla por ciclo; la corrida del gel en 6 s. */
const S_PER_CYCLE = 0.5;
const GEL_S = 6;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Con 30 ciclos de PCR se obtienen 30 copias del fragmento.', answer: 'falso', feedback: 'Cada ciclo duplica (en el mejor caso) las copias que hay: con 30 ciclos ideales una molécula da 2³⁰ ≈ 1 070 millones de copias. Por eso la PCR detecta cantidades diminutas de ADN.' },
  { id: 'i2', text: 'En el gel, los fragmentos más pequeños avanzan más lejos que los grandes.', answer: 'cierto', feedback: 'Todos tienen carga negativa por los fosfatos, pero la red de agarosa frena más a los largos: la distancia baja con el logaritmo del tamaño.' },
  { id: 'i3', text: 'Los dos cebadores tienen la misma secuencia que la hebra de arriba.', answer: 'falso', feedback: 'El directo se parece a la hebra de arriba, pero el reverso debe ser el complemento inverso del final del fragmento para unirse a la hebra de abajo. Compruébalo con el par 4.' },
  { id: 'i4', text: 'Si subo mucho la temperatura de alineamiento, la PCR se vuelve más eficiente.', answer: 'falso', feedback: 'Por encima de la Tm los cebadores no se quedan unidos y no hay producto. Muy por debajo se unen también donde no coinciden del todo (bandas inespecíficas). Se usa Ta ≈ Tm − 5 °C.' },
  { id: 'i5', text: 'La PCR solo copia el tramo que queda entre los dos cebadores.', answer: 'cierto', feedback: 'Desde el tercer ciclo predominan las copias que empiezan en un cebador y terminan en el otro: el producto tiene un tamaño fijo, el que ves en el gel.' },
];

/** El molde con los sitios de los cebadores resaltados. */
function templateParts(fPos: number, rPos: number) {
  const marks = [fPos, rPos].filter((p) => p >= 0).sort((a, b) => a - b);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m < cursor) continue;
    parts.push(TEMPLATE.slice(cursor, m));
    parts.push(<mark key={m}>{TEMPLATE.slice(m, m + 20)}</mark>);
    cursor = m + 20;
  }
  parts.push(TEMPLATE.slice(cursor));
  return parts;
}

export default function PcrLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('cebadores');
  const [pairId, setPairId] = useState('p2');
  const chk = useMemo(() => checkPrimers(pairId), [pairId]);
  const [Ta, setTa] = useState(chk.ta);
  useEffect(() => { setTa(chk.ta); }, [chk]);
  const [N0, setN0] = useState(1000);
  const [E, setE] = useState(0.9);
  const [cycles, setCycles] = useState(30);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  const tmMin = Math.min(chk.tmF, chk.tmR);
  const bind = chk.product === null ? 0 : bindingFraction(Ta, tmMin);
  const Eeff = E * bind;
  const run = useMemo(() => amplify(N0, Eeff, cycles), [N0, Eeff, cycles]);
  const conds = pcrConditions(chk, Ta, cycles);
  const extraBand = chk.product !== null && Ta < tmMin - 12 && bind > 0 ? 480 : null;
  const fit = useMemo(() => calibrate(), []);
  const dProduct = chk.product !== null ? migration(chk.product) : null;
  const estimate = dProduct !== null ? fit.estimate(dProduct) : null;

  const duration = station === 'gel' ? 1 : cycles;
  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); };
  useEffect(resetRun, [station, pairId, Ta, N0, E, cycles]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(duration); setRunning(false); return; }
    const speed = station === 'gel' ? 1 / GEL_S : 1 / S_PER_CYCLE;
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
  const finished = t >= duration && !running && t > 0;
  const status = simStatusOf(running, t > 0, finished);

  // Estado del ciclo en curso para la hélice 3D.
  const cycleNow = Math.min(cycles, Math.floor(t) + (t > 0 && t < cycles ? 1 : 0));
  const u = t - Math.floor(t);
  const phase: PcrPhase = t <= 0 ? 'nativo' : t >= cycles ? 'extension' : u < 1 / 3 ? 'desnaturalizacion' : u < 2 / 3 ? 'alineamiento' : 'extension';
  const extension = t >= cycles ? 1 : phase === 'extension' ? (u - 2 / 3) * 3 : 0;
  const copiesNow = run.points[Math.min(run.points.length - 1, Math.floor(t))].real;
  const scene = useMemo(() => station === 'gel'
    ? gelScene({ product: run.final > 1e8 ? chk.product : null, extraBand, progress: t, productBrightness: Math.log10(Math.max(1, run.final)) / 11 })
    : helixScene({ phase: station === 'cebadores' ? (bind > 0 ? 'alineamiento' : 'desnaturalizacion') : phase, extension, primersBind: bind > 0, cycle: station === 'cebadores' ? 1 : cycleNow, copies: station === 'cebadores' ? N0 : copiesNow }),
  [station, run, chk, extraBand, t, bind, phase, extension, cycleNow, copiesNow, N0]);

  usePublishModel(() => ({
    vars: {
      N0: { sym: 'N₀', name: 'Copias iniciales', value: N0, unit: 'copias', decimals: 0 },
      E: { sym: 'E', name: 'Eficiencia de cada ciclo', value: Eeff, unit: '', decimals: 3 },
      n: { sym: 'n', name: 'Ciclos', value: cycles, unit: '', decimals: 0 },
    },
    equations: [{ title: 'Copias después de n ciclos (sin meseta)', lhs: 'N', expr: '[N0]·(1 + [E])^{[n]}' }],
  }), [N0, Eeff, cycles]);

  const record = () => {
    if (station === 'cebadores') api.addTrial('cebadores', { par: chk.pair.name, TmDirecto: chk.tmF, TmReverso: chk.tmR, Ta, producto: chk.product, unidos: Number((bind * 100).toFixed(0)) });
    else if (station === 'ciclos') api.addTrial('ciclos', { ciclos: cycles, eficiencia: Number(Eeff.toFixed(3)), iniciales: N0, copias: Number(run.final.toPrecision(4)), log10: Number(Math.log10(Math.max(1, run.final)).toFixed(3)), log10Ideal: Number(Math.log10(Math.max(1, run.finalIdeal)).toFixed(3)) });
    else api.addTrial('gel', { par: chk.pair.name, producto: chk.product, distancia: dProduct === null ? null : Number(dProduct.toFixed(1)), estimado: estimate === null ? null : Number(estimate.toFixed(0)), error: estimate === null || chk.product === null ? null : Number((((estimate - chk.product) / chk.product) * 100).toFixed(2)) });
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'cebadores', label: 'Diseño de cebadores' }, { value: 'ciclos', label: 'Ciclos de la PCR' }, { value: 'gel', label: 'Electroforesis en gel' }]} />
        {station === 'cebadores' && <>
          <Readout items={[
            { k: 'Cebador directo (5′ → 3′)', v: `${chk.pair.forward} · Tm = ${chk.tmF} °C (${fmt(gcPercent(chk.pair.forward), 0)} % GC)` },
            { k: 'Cebador reverso (5′ → 3′)', v: `${chk.pair.reverse} · Tm = ${chk.tmR} °C (${fmt(gcPercent(chk.pair.reverse), 0)} % GC)` },
            { k: 'Tamaño del producto', v: chk.product === null ? 'sin producto' : `${chk.product} pb (del nucleótido ${chk.fPos + 1} al ${chk.rPos + 20} del molde)`, data: true },
            { k: 'Temperatura de alineamiento sugerida Ta = Tm − 5 °C', v: `${chk.ta} °C` },
            { k: 'Moldes con cebadores unidos a la Ta elegida', v: `${fmt(bind * 100, 0)} %` },
          ]} />
          <div className="card stack-sm">
            <h4>Molde ilustrativo (600 pb, secuencia aleatoria escrita para la práctica)</h4>
            <p className="small" style={{ wordBreak: 'break-all', fontFamily: 'var(--font-data)' }}>{templateParts(chk.fPos, chk.rPos)}</p>
            <p className="small muted">Resaltados: el sitio del cebador directo y el sitio donde se une el reverso (su complemento inverso).</p>
          </div>
        </>}
        {station === 'ciclos' && <>
          <Readout items={[
            { k: 'Ciclo en curso', v: t > 0 ? `${cycleNow} de ${cycles}: ${phase === 'desnaturalizacion' ? 'desnaturalización (95 °C)' : phase === 'alineamiento' ? `alineamiento (${Ta} °C)` : 'extensión (72 °C)'}` : 'sin empezar' },
            { k: 'Eficiencia efectiva por ciclo', v: `${fmt(Eeff, 3)} (${fmt(E, 2)} × ${fmt(bind, 2)} de moldes con cebadores)` },
            { k: 'Copias si cada ciclo duplicara con esa eficiencia (sin meseta)', v: fmtSig(run.finalIdeal, 3) },
            { k: 'Copias con la meseta (modelo)', v: fmtSig(run.final, 3), data: true },
            { k: 'Ciclo en que se superan 10¹⁰ copias', v: run.cyclesToThreshold === null ? 'no se alcanzan' : String(run.cyclesToThreshold) },
          ]} />
          <Chart title="Copias del producto en cada ciclo" xLabel="Ciclo" yLabel="log₁₀ de las copias" height={240} exportName="pcr-ciclos"
            xDomain={[0, cycles]} series={[
              { label: 'Sin meseta: N₀·(1 + E)ⁿ', color: 'var(--series-2)', kind: 'line', dashed: true, points: run.points.map((p) => ({ x: p.n, y: Math.log10(Math.max(1, p.ideal)) })) },
              { label: 'Con meseta (modelo)', color: 'var(--series-1)', kind: 'line', points: run.points.map((p) => ({ x: p.n, y: Math.log10(Math.max(1, p.real)) })) },
            ]} />
        </>}
        {station === 'gel' && <>
          <Readout items={[
            { k: 'Distancia del producto en el gel', v: dProduct === null || run.final <= 1e8 ? 'sin banda' : `${fmt(dProduct, 1)} mm`, data: true },
            { k: 'Tamaño estimado con la recta del marcador', v: estimate === null || run.final <= 1e8 ? '—' : `${fmt(estimate, 0)} pb (real: ${chk.product} pb)` },
            { k: 'Recta de calibración', v: `log₁₀(pb) = ${fmt(fit.intercept, 4)} ${fit.slope < 0 ? '−' : '+'} ${fmt(Math.abs(fit.slope), 5)}·d (R² = ${fmt(fit.r2, 4)})` },
          ]} />
          <Chart title="Recta de calibración del gel con el marcador de 100 pb" xLabel="Distancia desde el pozo (mm)" yLabel="log₁₀ del tamaño (pb)" xUnit="mm" height={240} exportName="gel-calibracion"
            series={[
              { label: 'Bandas del marcador', color: 'var(--series-2)', kind: 'scatter', points: LADDER_100BP.map((bp) => ({ x: migration(bp), y: Math.log10(bp) })) },
              { label: 'Recta ajustada', color: 'var(--series-2)', kind: 'line', dashed: true, points: [0, 70].map((d) => ({ x: d, y: fit.intercept + fit.slope * d })) },
              ...(dProduct !== null && run.final > 1e8 ? [{ label: 'Producto', color: 'var(--data)', kind: 'scatter' as const, points: [{ x: dProduct, y: Math.log10(estimate!) }] }] : []),
            ]} />
        </>}
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="pcr-3d-h">
          <h3 id="pcr-3d-h">{station === 'gel' ? 'Vista 3D: el gel de agarosa con sus carriles' : 'Vista 3D: un tramo de ADN en el ciclo de la PCR'}</h3>
          <Scene3D idPrefix="pcr" title={station === 'gel' ? 'Gel de electroforesis en 3D' : 'Ciclo de la PCR en 3D'} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={station === 'gel' ? { yaw: 0.1, pitch: 0.9 } : { yaw: 0.35, pitch: 0.25 }} status="modelo"
            statusNote={station === 'gel' ? 'Cada banda baja la distancia del modelo (lineal con el logaritmo del tamaño) por el avance de la corrida; el brillo de las bandas y el gel son ilustrativos.' : 'La etapa y el número de copias son los del modelo; el tramo de 16 pares de bases y su forma son ilustrativos.'} />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="pcr" intro="Ideas frecuentes sobre la PCR y la electroforesis. Decide si son ciertas o falsas y compruébalo con el laboratorio." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Termociclador</h3>
          <Select label="Par de cebadores" value={pairId} onChange={setPairId} options={PRIMER_PAIRS.map((p) => ({ value: p.id, label: p.name }))} />
          <Slider label="Temperatura de alineamiento" value={Ta} min={40} max={72} step={1} unit="°C" decimals={0} onChange={setTa} />
          {station === 'ciclos' && <>
            <Slider label="Copias iniciales del molde" value={N0} min={1} max={10000} step={1} unit="copias" decimals={0} onChange={setN0} />
            <Slider label="Eficiencia de la polimerasa" value={E} min={PCR_LIMITS.E[0]} max={PCR_LIMITS.E[1]} step={0.01} unit="" decimals={2} onChange={setE} />
            <Slider label="Número de ciclos" value={cycles} min={1} max={PCR_LIMITS.cycles[1]} step={1} unit="" decimals={0} onChange={setCycles} />
          </>}
          {station !== 'cebadores' && <SimControls title={station === 'gel' ? 'Electroforesis' : 'Termociclador'} status={status}
            startLabel={station === 'gel' ? 'Correr el gel' : 'Correr la PCR'} repeatLabel={station === 'gel' ? 'Correr otra vez' : 'Repetir la PCR'}
            onStart={() => { setT(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            progress={station === 'gel' ? { value: t * 100, max: 100, unit: '%', label: 'corrida', decimals: 0 } : { value: t, max: cycles, unit: 'ciclos', label: 'ciclos', decimals: 1 }} />}
          <RecordButton key={station} onRecord={record} label={station === 'cebadores' ? 'Guardar los cebadores en la tabla' : station === 'ciclos' ? 'Guardar la PCR en la tabla' : 'Guardar el gel en la tabla'} />
          <Notice>Etapas de cada ciclo: {CYCLE_STEPS.map((s) => `${s.name.toLowerCase()} (${s.T ?? Ta} °C)`).join(', ')}. Tm con la regla de Wallace (cebadores de 14–20 nt). Marcador: escalera de 100 pb de New England Biolabs. El molde, la meseta, la unión de los cebadores y los coeficientes del gel son ilustrativos.</Notice>
        </div>
      </div>
    </div>
  );
}

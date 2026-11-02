import { useEffect, useMemo, useRef, useState } from 'react';
import {
  gameteCombinations, meiosisConditions, meiosisGametes, mitosisResult, sampleGametes, STAGES, stageCounts, zygoteCombinations,
  type MeiosisConfig, type Nondisjunction,
} from '../models/meiosis';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { meiosisScene } from './meiosis3d';

type Station = 'etapas' | 'muestreo';
/** Segundos reales por etapa en la reproducción. */
const STAGE_S = 1.8;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'La meiosis produce dos células iguales a la célula madre, como la mitosis.', answer: 'falso', feedback: 'La meiosis produce CUATRO células haploides (n) y genéticamente distintas; la mitosis produce dos células diploides (2n) idénticas. Compáralo en la tabla de las etapas.' },
  { id: 'i2', text: 'En la anafase I se separan los cromosomas homólogos y en la anafase II las cromátidas hermanas.', answer: 'cierto', feedback: 'Por eso después de la meiosis I cada célula ya es haploide (un cromosoma de cada par), aunque cada cromosoma conserva sus dos cromátidas hasta la meiosis II.' },
  { id: 'i3', text: 'Los hijos de los mismos padres son distintos solo por mutaciones.', answer: 'falso', feedback: 'La mayor parte de la variación viene de la meiosis: la orientación al azar de los 23 pares da 2²³ = 8 388 608 combinaciones por gameto, el entrecruzamiento mezcla alelos dentro de cada cromosoma y la fecundación une dos gametos al azar.' },
  { id: 'i4', text: 'Dos genes muy cercanos en el mismo cromosoma casi siempre se heredan juntos.', answer: 'cierto', feedback: 'Cuanto más cerca están, menos probable es que un entrecruzamiento caiga entre ellos. Con 1 cM de distancia, solo el 1 % de los gametos es recombinante; con 20 cM, el 20 %.' },
  { id: 'i5', text: 'El ADN se replica antes de la meiosis I y otra vez antes de la meiosis II.', answer: 'falso', feedback: 'Se replica una sola vez (fase S): por eso de una célula 2c con 4c tras la replicación salen cuatro gametos con 1c. Entre la meiosis I y la II no hay fase S.' },
];

const SHORT = ['G1', 'S y G2', 'Profase I', 'Metafase I', 'Anafase I', 'Telofase I', 'Profase II', 'Metafase II', 'Anafase II', 'Telofase II'];

function StageStrip({ stage, gametes }: { stage: number; gametes: { genotype: string; chromosomeCount: number }[] | null }) {
  const W = 660, step = (W - 60) / (STAGES.length - 1);
  return (
    <svg viewBox={`0 0 ${W} 170`} role="img" aria-labelledby="mei-s-t mei-s-d">
      <title id="mei-s-t">Línea de las etapas de la meiosis</title>
      <desc id="mei-s-d">{`Etapa actual: ${STAGES[stage].name} (${stage + 1} de ${STAGES.length}).${gametes ? ` Gametos: ${gametes.map((g) => g.genotype).join('; ')}.` : ''}`}</desc>
      <rect width={W} height="170" rx="14" fill="var(--surface-2)" />
      <line x1="30" x2={W - 30} y1="40" y2="40" stroke="var(--line-strong)" strokeWidth="3" />
      <text x={30 + step * 2.5} y="18" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)', fontWeight: 700 }}>Meiosis I</text>
      <text x={30 + step * 7.5} y="18" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)', fontWeight: 700 }}>Meiosis II</text>
      {STAGES.map((s, i) => (
        <g key={s.id}>
          <circle cx={30 + i * step} cy="40" r={i === stage ? 11 : 7} fill={i <= stage ? 'var(--bio)' : 'var(--surface)'} stroke="var(--ink-2)" />
          <text x={30 + i * step} y="70" textAnchor="middle" style={{ fontSize: 9.5, fill: i === stage ? 'var(--ink)' : 'var(--ink-2)', fontWeight: i === stage ? 700 : 400 }}>{SHORT[i]}</text>
        </g>
      ))}
      {gametes && gametes.map((g, i) => (
        <g key={i} transform={`translate(${70 + i * 150} 112)`}>
          <ellipse cx="0" cy="0" rx="62" ry="26" fill="var(--surface)" stroke="var(--bio)" strokeWidth="1.5" />
          <text x="0" y="5" textAnchor="middle" style={{ fontSize: 14, fontFamily: 'var(--font-data)', fill: 'var(--ink)', fontWeight: 700 }}>{g.genotype}</text>
        </g>
      ))}
    </svg>
  );
}

export default function MeiosisLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('etapas');
  const [pairs, setPairs] = useState<1 | 2 | 3>(2);
  const [cross, setCross] = useState(true);
  const [crossPos, setCrossPos] = useState(0.5);
  const [orientation, setOrientation] = useState<boolean[]>([true, true, true]);
  const [nd, setNd] = useState<Nondisjunction>('ninguna');
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(1);
  const [running, setRunning] = useState(false);
  const [distance, setDistance] = useState(20);
  const [meioses, setMeioses] = useState(100);
  const [seed, setSeed] = useState(0);
  const [nHuman, setNHuman] = useState(23);
  const raf = useRef(0);
  const clock = useRef(0);

  const cfg: MeiosisConfig = useMemo(() => ({ pairs, crossover: cross ? crossPos : null, orientation: orientation.slice(0, pairs), nondisjunction: nd }), [pairs, cross, crossPos, orientation, nd]);
  const gam = useMemo(() => meiosisGametes(cfg), [cfg]);
  const counts = stageCounts(stage, pairs * 2);
  const conds = useMemo(() => meiosisConditions(cfg, distance), [cfg, distance]);
  const sample = useMemo(() => (seed > 0 ? sampleGametes(pairs, distance, meioses, seed * 7919 + 13) : null), [pairs, distance, meioses, seed]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setStage(STAGES.length - 1); setProgress(1); setRunning(false); return; }
    const start = performance.now() - clock.current * 1000;
    const tick = (now: number) => {
      const el = (now - start) / 1000;
      clock.current = el;
      const s = Math.min(STAGES.length - 1, Math.floor(el / STAGE_S));
      setStage(s); setProgress(Math.min(1, (el - s * STAGE_S) / (STAGE_S * 0.8)));
      if (el >= STAGES.length * STAGE_S) { setProgress(1); setRunning(false); playSound('click', { intensity: 0.6 }); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);
  const resetSim = () => { cancelAnimationFrame(raf.current); setRunning(false); clock.current = 0; setStage(0); setProgress(1); };
  const goStage = (s: number) => { cancelAnimationFrame(raf.current); setRunning(false); setStage(s); setProgress(1); clock.current = s * STAGE_S + STAGE_S * 0.8; };
  const finished = !running && stage === STAGES.length - 1 && clock.current > 0;
  const status = simStatusOf(running, clock.current > 0, finished);

  usePublishModel(() => ({
    vars: {
      n: { sym: 'n', name: 'Pares de cromosomas (número haploide)', value: nHuman, unit: '', decimals: 0 },
      C: { sym: 'C', name: 'Combinaciones de gametos', value: gameteCombinations(nHuman), unit: '', decimals: 0 },
      d: { sym: 'd', name: 'Distancia entre A y B', value: distance, unit: 'cM', decimals: 0 },
      r: { sym: 'r', name: 'Fracción de gametos recombinantes esperada', value: Math.min(0.5, distance / 100), unit: '', decimals: 2 },
    },
    equations: [{ title: 'Segregación independiente', lhs: 'C', expr: '2^{[n]}' }, { title: 'Recombinación (Morgan)', lhs: 'r', expr: '\\frac{[d]}{100}' }],
  }), [nHuman, distance]);

  const scene = useMemo(() => meiosisScene({ cfg, stage, progress }), [cfg, stage, progress]);
  const mit = mitosisResult(pairs * 2);

  const recordStage = () => api.addTrial('etapas', {
    etapa: stage + 1, nombre: STAGES[stage].name, dosN: pairs * 2, celulas: counts.cells, cromosomas: counts.chromosomes, cromatidas: counts.chromatids, adn: counts.dnaC,
    entrecruzamiento: cross ? 'sí' : 'no', gametos: stage === STAGES.length - 1 ? gam.map((g) => g.genotype).join('; ') : null,
  });
  const recordSample = () => sample && api.addTrial('gametos', {
    distancia: distance, meiosis: meioses, pares: pairs, gametos: sample.gametes, recombinantes: Number((sample.recombinantFraction * 100).toFixed(1)),
    esperado: Math.min(50, distance), tipos: Object.keys(sample.counts).length, semilla: seed,
  });
  const recordComb = () => api.addTrial('combinaciones', { n: nHuman, combinaciones: gameteCombinations(nHuman), cigotos: zygoteCombinations(nHuman), log10: Number(Math.log10(gameteCombinations(nHuman)).toFixed(3)) });

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation}
          options={[{ value: 'etapas', label: '1. Etapas de la meiosis' }, { value: 'muestreo', label: '2. Variabilidad de los gametos' }]} />
        {station === 'etapas' ? (
          <>
            <div className="bench"><StageStrip stage={stage} gametes={stage === STAGES.length - 1 ? gam : null} /></div>
            <Readout items={[
              { k: 'Etapa', v: `${STAGES[stage].name} (${stage + 1} de ${STAGES.length})` },
              { k: 'Células', v: String(counts.cells), data: true },
              { k: 'Cromosomas por célula', v: `${counts.chromosomes} (${counts.ploidy})`, data: true },
              { k: 'Cromátidas por célula', v: String(counts.chromatids), data: true },
              { k: 'ADN por célula', v: `${counts.dnaC}c`, data: true },
              { k: 'Mitosis de la misma célula (comparación)', v: `${mit.cells} células 2n = ${mit.chromosomes}, ${mit.dnaC}c, idénticas` },
            ]} />
            <p className="small" style={{ margin: 0 }}>{STAGES[stage].text}</p>
            {stage === STAGES.length - 1 && (
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Gametos de esta meiosis">
                <table>
                  <caption className="sr-only">Genotipo y número de cromosomas de los cuatro gametos</caption>
                  <thead><tr><th scope="col">Gameto</th><th scope="col">Alelos</th><th scope="col">Cromosomas</th><th scope="col">Tipo</th></tr></thead>
                  <tbody>{gam.map((g) => <tr key={g.index}><th scope="row">{g.index + 1}</th><td>{g.genotype}</td><td>{g.chromosomeCount} {g.chromosomeCount !== pairs ? `(n ${g.chromosomeCount > pairs ? '+' : '−'} 1)` : '(n)'}</td><td>{g.recombinant ? 'recombinante' : g.chromosomeCount === pairs ? 'parental' : '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <Readout items={[
              { k: 'Meiosis simuladas', v: sample ? `${sample.meioses} (${sample.gametes} gametos)` : 'simula' },
              { k: 'Gametos recombinantes (Ab + aB)', v: sample ? `${fmt(sample.recombinantFraction * 100, 1)} %` : '—', data: true },
              { k: 'Esperado (d/100)', v: `${fmt(Math.min(50, distance), 0)} %` },
              { k: 'Tipos de gametos distintos', v: sample ? String(Object.keys(sample.counts).length) : '—', data: true },
              { k: `Combinaciones con n = ${nHuman} pares (2ⁿ)`, v: fmt(gameteCombinations(nHuman), 0), data: true },
              { k: 'Cigotos posibles de una pareja (2ⁿ)²', v: zygoteCombinations(nHuman) >= 1e6 ? `${fmt(zygoteCombinations(nHuman) / 10 ** Math.floor(Math.log10(zygoteCombinations(nHuman))), 2)} × 10^${Math.floor(Math.log10(zygoteCombinations(nHuman)))}` : fmt(zygoteCombinations(nHuman), 0) },
            ]} />
            {sample && (
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Frecuencias de los gametos">
                <table>
                  <caption className="sr-only">Gametos observados y esperados</caption>
                  <thead><tr><th scope="col">Gameto</th><th scope="col">Observados</th><th scope="col">Esperados</th></tr></thead>
                  <tbody>{Object.keys(sample.expected).map((k) => <tr key={k}><th scope="row">{k}</th><td>{sample.counts[k] ?? 0}</td><td>{fmt(sample.expected[k], 1)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </>
        )}
        {conds.map((c) => <ConditionAlert key={c.text} level={c.level} cause={c.text} fix={c.fix} />)}
        <section className="card" aria-labelledby="mei-3d-h">
          <h3 id="mei-3d-h">Vista 3D: homólogos, quiasma y los cuatro gametos</h3>
          <Scene3D idPrefix="mei" title={`Meiosis en 3D: ${STAGES[stage].name}`} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={360} initialOrbit={{ yaw: 0.35, pitch: 0.3 }} status="ilustracion"
            statusNote="Ilustración sin escala; las posiciones siguen las etapas y el reparto de cromátidas del modelo (orientación, entrecruzamiento y no disyunción elegidos). Rojo: materno; azul: paterno; esferas oscuras: alelos." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="mei" intro="Ideas frecuentes sobre la meiosis. Decide si son ciertas o falsas y compruébalo con las etapas y los gametos." />
      </div>
      <div className="controls">
        {station === 'etapas' ? (
          <>
            <div className="card stack">
              <h3>Célula</h3>
              <Segmented<'1' | '2' | '3'> label="Pares de cromosomas" value={String(pairs) as '1' | '2' | '3'} onChange={(v) => setPairs(Number(v) as 1 | 2 | 3)} options={[{ value: '1', label: '2n = 2' }, { value: '2', label: '2n = 4' }, { value: '3', label: '2n = 6' }]} />
              <div className="btn-row" role="group" aria-label="Entrecruzamiento">
                <button type="button" className="btn small" aria-pressed={cross} onClick={() => setCross((v) => !v)}>Entrecruzamiento en el par 1</button>
              </div>
              {cross && <Slider label="Punto de cruce (fracción del cromosoma)" value={crossPos} min={0.05} max={0.95} step={0.05} unit="" decimals={2} onChange={setCrossPos} hint="Los genes A y B están en 0,25 y 0,75." />}
              <div className="stack-sm" role="group" aria-label="Orientación de los pares en la metafase I">
                {Array.from({ length: pairs }, (_, k) => (
                  <button key={k} type="button" className="btn small" onClick={() => setOrientation((o) => o.map((x, i) => (i === k ? !x : x)))}>
                    Par {k + 1}: {orientation[k] ? 'materno a la izquierda' : 'paterno a la izquierda'} (girar)
                  </button>
                ))}
              </div>
              <Select label="No disyunción en el par 1" value={nd} onChange={(v) => setNd(v as Nondisjunction)} options={[{ value: 'ninguna', label: 'Sin no disyunción' }, { value: 'meiosis1', label: 'En la meiosis I' }, { value: 'meiosis2', label: 'En la meiosis II' }]} />
            </div>
            <div className="card stack">
              <h3>Etapas</h3>
              <SimControls title="Reproducción de la meiosis" status={status} startLabel="Reproducir la meiosis" repeatLabel="Reproducir otra vez"
                onStart={() => { clock.current = 0; setStage(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetSim}
                progress={{ value: stage + 1, max: STAGES.length, unit: 'etapas', label: 'etapa' }} />
              <div className="btn-row">
                <button type="button" className="btn small" disabled={stage === 0} onClick={() => goStage(stage - 1)}>Etapa anterior</button>
                <button type="button" className="btn small" disabled={stage === STAGES.length - 1} onClick={() => goStage(stage + 1)}>Etapa siguiente</button>
              </div>
              <RecordButton onRecord={recordStage} label="Guardar la etapa en la tabla" />
            </div>
          </>
        ) : (
          <div className="card stack">
            <h3>Muchas meiosis</h3>
            <Segmented<'1' | '2' | '3'> label="Pares de cromosomas" value={String(pairs) as '1' | '2' | '3'} onChange={(v) => setPairs(Number(v) as 1 | 2 | 3)} options={[{ value: '1', label: '2n = 2' }, { value: '2', label: '2n = 4' }, { value: '3', label: '2n = 6' }]} />
            <Slider label="Distancia entre los genes A y B" value={distance} min={0} max={60} step={1} unit="cM" decimals={0} onChange={setDistance} />
            <Slider label="Células que hacen meiosis" value={meioses} min={10} max={1000} step={10} unit="" decimals={0} onChange={setMeioses} />
            <button type="button" className="btn primary" onClick={() => { setSeed((s) => s + 1); playSound('click', { intensity: 0.5 }); }}>Simular las meiosis</button>
            <RecordButton onRecord={recordSample} disabled={!sample || distance > 50} label="Guardar la muestra en la tabla" />
            <Slider label="Pares de cromosomas de la especie (n)" value={nHuman} min={1} max={23} step={1} unit="" decimals={0} onChange={setNHuman} hint="El ser humano tiene n = 23." />
            <RecordButton onRecord={recordComb} label="Guardar las combinaciones en la tabla" />
            <Notice>Cada simulación usa una semilla nueva (reproducible): repite y compara. Frecuencia de recombinación = distancia/100 (Morgan).</Notice>
          </div>
        )}
      </div>
    </div>
  );
}

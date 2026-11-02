import { useEffect, useMemo, useRef, useState } from 'react';
import {
  actionPotential, conductionTimeMs, exampleCatch, fiber, FIBERS, reactionTime, reflexArc, RULER_CM, rulerConditions, stats, V_THRESHOLD,
  type Stimulus,
} from '../models/nervousSystem';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText, SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { arcScene, neuronScene, type NervousView } from './nervous3d';

type Station = 'regla' | 'impulso';
/** Duración real (s) de la animación del impulso: cámara lenta. */
const ANIM_S = 3;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Un estímulo más fuerte produce un potencial de acción más alto.', answer: 'falso', feedback: 'El potencial de acción es «todo o nada»: si se alcanza el umbral (−55 mV) el pico es siempre de unos +30 mV. Un estímulo más intenso produce más impulsos por segundo, no impulsos más altos. Pruébalo con 15 y 40 mV.' },
  { id: 'i2', text: 'El impulso nervioso viaja más rápido por los axones con vaina de mielina.', answer: 'cierto', feedback: 'La mielina aísla el axón y el impulso salta de un nodo de Ranvier al siguiente: las fibras Aα conducen a 72–120 m/s y las amielínicas C a 0,4–2 m/s.' },
  { id: 'i3', text: 'En un reflejo, el cerebro decide retirar la mano antes de que sientas el dolor.', answer: 'falso', feedback: 'El reflejo de retirada se coordina en la médula espinal: receptor → neurona sensitiva → interneurona → neurona motora → músculo. La señal que sube al encéfalo (la que te hace sentir el dolor) llega después.' },
  { id: 'i4', text: 'Atrapar la regla tarda más que un reflejo porque la respuesta pasa por el encéfalo.', answer: 'cierto', feedback: 'Ver la regla, decidir y ordenar el movimiento ocurre en el encéfalo: el tiempo de reacción es de unos 0,2 s, mientras que un arco reflejo de retirada tarda unas decenas de milisegundos.' },
  { id: 'i5', text: 'El impulso nervioso es una corriente de electrones que corre por el axón como por un cable de cobre.', answer: 'falso', feedback: 'Es una onda de cambio del potencial de la membrana: entran iones Na⁺ y luego salen iones K⁺ por canales de la membrana, punto por punto a lo largo del axón. Por eso es mucho más lento que la corriente en un cable.' },
];

function RulerBench({ dCm }: { dCm: number }) {
  const top = 30, k = 9; // px por cm
  const y = top + Math.min(RULER_CM, dCm) * k;
  return (
    <svg viewBox="0 0 660 330" role="img" aria-labelledby="ner-r-t ner-r-d">
      <title id="ner-r-t">Prueba de la regla que cae</title>
      <desc id="ner-r-d">{`Regla vertical de 30 cm; los dedos la atraparon a ${fmt(dCm, 1)} cm de la marca de 0 cm. Tiempo de reacción: ${dCm > 0 && dCm <= RULER_CM ? `${fmt(reactionTime(dCm), 3)} s` : 'no se puede calcular'}.`}</desc>
      <rect width="660" height="330" rx="14" fill="var(--surface-2)" />
      <rect x="300" y={top - 4} width="44" height={RULER_CM * k + 8} rx="3" fill="#f6e7b0" stroke="var(--ink-2)" />
      {Array.from({ length: RULER_CM * 2 + 1 }, (_, i) => (
        <g key={i}>
          <line x1="300" x2={i % 2 ? 308 : 316} y1={top + i * k / 2} y2={top + i * k / 2} stroke="var(--ink-2)" strokeWidth="0.8" />
          {i % 10 === 0 && <text x="320" y={top + i * k / 2 + 4} style={{ fontSize: 10, fill: '#3a2f10', fontFamily: 'var(--font-data)' }}>{i / 2}</text>}
        </g>
      ))}
      <path d={`M240 ${y - 14} q50 -6 58 6 v10 q-8 10 -58 4 z`} fill="#c58b62" stroke="var(--ink-2)" />
      <path d={`M404 ${y - 14} q-50 -6 -58 6 v10 q8 10 58 4 z`} fill="#c58b62" stroke="var(--ink-2)" />
      <line x1="200" x2="300" y1={top} y2={top} stroke="var(--ink-3)" strokeDasharray="4 3" />
      <text x="196" y={top + 4} textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>0 cm: aquí estaban los dedos</text>
      <line x1="200" x2="300" y1={y} y2={y} stroke="var(--data)" strokeDasharray="4 3" />
      <text x="196" y={y + 4} textAnchor="end" style={{ fontSize: 12, fill: 'var(--data)', fontWeight: 700 }}>d = {fmt(dCm, 1)} cm</text>
      <text x="450" y="80" style={{ fontSize: 13, fill: 'var(--ink)' }}>t = √(2d/g)</text>
      <text x="450" y="104" style={{ fontSize: 13, fill: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{dCm > 0 && dCm <= RULER_CM ? `${fmt(reactionTime(dCm), 3)} s` : '—'}</text>
    </svg>
  );
}

function ApChart({ stimulus }: { stimulus: number }) {
  const ap = useMemo(() => actionPotential(stimulus), [stimulus]);
  const W = 620, H = 240, L = 50, R = 12, T = 12, B = 34;
  const x = (t: number) => L + (t / 8) * (W - L - R), y = (v: number) => T + ((40 - v) / 130) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="ner-ap-t ner-ap-d" style={{ width: '100%', height: 'auto' }}>
      <title id="ner-ap-t">Potencial de membrana durante 8 ms</title>
      <desc id="ner-ap-d">{ap.fired ? `Con un estímulo de ${stimulus} mV la membrana llega al umbral (−55 mV) y se dispara el potencial de acción: sube a +30 mV, baja a −80 mV y vuelve a −70 mV.` : `Con un estímulo de ${stimulus} mV la membrana llega a ${fmt(-70 + stimulus, 0)} mV, por debajo del umbral: solo hay un potencial local que se apaga.`}</desc>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="var(--surface)" stroke="var(--line)" />
      {[30, 0, -55, -70].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === -55 ? 'var(--warn)' : 'var(--line)'} strokeDasharray={v === -55 ? '6 4' : '2 3'} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{v}</text>
        </g>
      ))}
      <text x={W - R - 4} y={y(-55) - 4} textAnchor="end" style={{ fontSize: 10.5, fill: 'var(--warn)' }}>umbral −55 mV</text>
      {[0, 2, 4, 6, 8].map((t) => <text key={t} x={x(t)} y={H - B + 16} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{t}</text>)}
      <text x={(L + W) / 2} y={H - 4} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)' }}>tiempo (ms)</text>
      <text x="8" y={T + 8} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>mV</text>
      <polyline points={ap.t.map((t, i) => `${x(t).toFixed(1)},${y(ap.v[i]).toFixed(1)}`).join(' ')} fill="none" stroke="var(--data)" strokeWidth="2.4" />
    </svg>
  );
}

export default function NervousSystemLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('regla');
  const [d, setD] = useState(0);
  const [origin, setOrigin] = useState<'propio' | 'ejemplo'>('propio');
  const [hand, setHand] = useState('dominante');
  const [stim, setStim] = useState<Stimulus>('visual');
  const [exSeed, setExSeed] = useState(0);
  const [stimulus, setStimulus] = useState(20);
  const [fiberId, setFiberId] = useState('aa');
  const [pathM, setPathM] = useState(0.8);
  const [view, setView] = useState<NervousView>('neurona');
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const raf = useRef(0);
  const ruler = instrument('sistema-nervioso', 'regla');

  const conds = useMemo(() => rulerConditions(d), [d]);
  const valid = d > 0 && d <= RULER_CM;
  const t = valid ? reactionTime(d) : NaN;
  const same = api.session.trials.filter((x) => x.datasetId === 'reaccion' && x.values.mano === hand && x.values.estimulo === stim && typeof x.values.tiempo === 'number').map((x) => Number(x.values.tiempo));
  const st = stats(same);
  const ap = useMemo(() => actionPotential(stimulus), [stimulus]);
  const f = fiber(fiberId);
  const condMs = conductionTimeMs(pathM, f.v);
  const reflex = reflexArc(pathM, fiberId);

  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setStarted(false); setProgress(0); };
  useEffect(reset, [stimulus, fiberId, pathM, view]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setProgress(1); setRunning(false); return; }
    const start = performance.now() - progress * ANIM_S * 1000;
    const tick = (now: number) => {
      const p = (now - start) / 1000 / ANIM_S;
      if (p >= 1) { setProgress(1); setRunning(false); playSound('click', { intensity: 0.5 }); return; }
      setProgress(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = started && !running && progress >= 1;
  const status = simStatusOf(running, started && progress > 0, finished);

  usePublishModel(() => ({
    vars: {
      d: { sym: 'd', name: 'Distancia de caída de la regla', value: d / 100, unit: 'm', decimals: 3 },
      g: { sym: 'g', name: 'Aceleración de la gravedad', value: 9.8, unit: 'm/s²', decimals: 1 },
      t: { sym: 't', name: 'Tiempo de reacción', value: valid ? t : null, unit: 's', decimals: 3 },
    },
    equations: [{ title: 'Caída libre de la regla', lhs: 't', expr: '\\sqrt{\\frac{2·[d]}{[g]}}' }],
  }), [d, valid, t]);

  const scene = useMemo(() => (view === 'neurona'
    ? neuronScene({ fiberId, progress, active: started, fired: ap.fired })
    : arcScene({ pathM, sensory: fiberId, progress, active: started && ap.fired })), [view, fiberId, progress, started, ap.fired, pathM]);

  const recordR = () => api.addTrial('reaccion', { mano: hand, estimulo: stim, origen: origin, distancia: d, tiempo: Number(t.toFixed(4)) });
  const recordP = () => api.addTrial('potencial', {
    estimulo: stimulus, fibra: f.name, longitud: pathM, pico: Number(ap.peak.toFixed(1)), disparo: ap.fired ? 1 : 0,
    velocidad: f.v, tiempoConduccion: Number(condMs.toFixed(2)), reflejo: Number(reflex.totalMs.toFixed(1)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation}
          options={[{ value: 'regla', label: '1. Tiempo de reacción (regla)' }, { value: 'impulso', label: '2. Impulso nervioso y reflejo' }]} />
        {station === 'regla' ? (
          <>
            <div className="bench"><RulerBench dCm={d} /></div>
            <Readout items={[
              { k: 'Distancia de caída d', v: d > 0 ? `${fmt(d, 1)} cm (${origin === 'propio' ? 'dato tuyo' : 'dato de ejemplo'})` : 'escribe tu dato', data: true, resolution: resolutionText(ruler.resolution, 'cm') },
              { k: 'Tiempo de reacción t = √(2d/g)', v: valid ? `${fmt(t, 3)} s` : '—', data: true, state: valid ? (t < 0.1 ? 'warn' : 'ok') : undefined },
              { k: `Ensayos guardados (${hand}, ${stim})`, v: String(st.n) },
              { k: 'Media de esos ensayos', v: st.n ? `${fmt(st.mean, 3)} s` : '—' },
              { k: 'Desviación estándar', v: st.n > 1 ? `${fmt(st.sd, 3)} s` : '—' },
              { k: 'Arco reflejo del modelo (0,8 m, Aδ)', v: `${fmt(reflexArc(0.8, 'ad').totalMs / 1000, 3)} s` },
            ]} />
            {conds.map((c) => <ConditionAlert key={c.text} level={c.level} cause={c.text} fix={c.fix} />)}
            <Notice>Actividad educativa: el tiempo de reacción cambia con el sueño, la atención, la práctica y la luz. Este laboratorio no evalúa la salud ni compara a las personas; tus datos se quedan en este equipo.</Notice>
          </>
        ) : (
          <>
            <div className="bench"><ApChart stimulus={stimulus} /></div>
            <Readout items={[
              { k: 'Potencial que alcanza el estímulo', v: `${fmt(-70 + stimulus, 0)} mV (umbral ${V_THRESHOLD} mV)` },
              { k: '¿Se dispara el potencial de acción?', v: ap.fired ? 'sí' : 'no', data: true },
              { k: 'Pico', v: `${fmt(ap.peak, 1)} mV`, data: true },
              { k: 'Velocidad de la fibra', v: `${fmt(f.v, f.v < 2 ? 1 : 0)} m/s (rango ${fmt(f.range[0], f.range[0] < 1 ? 1 : 0)}–${fmt(f.range[1], 0)} m/s)` },
              { k: `Tiempo de conducción en ${fmt(pathM, 2)} m`, v: `${fmt(condMs, 1)} ms`, data: true },
              { k: 'Arco reflejo (ida + 3 sinapsis + vuelta)', v: `${fmt(reflex.totalMs, 1)} ms` },
            ]} />
            {!ap.fired && <ConditionAlert level="advertencia" title="no hay potencial de acción" cause={`El estímulo lleva la membrana solo a ${fmt(-70 + stimulus, 0)} mV, por debajo del umbral de −55 mV: el potencial local se apaga y no viaja por el axón.`} fix="Aumenta el estímulo a 15 mV o más para alcanzar el umbral." />}
          </>
        )}
        <section className="card stack" aria-labelledby="ner-3d-h">
          <h3 id="ner-3d-h">Vista 3D: la neurona y el arco reflejo</h3>
          <Segmented<NervousView> label="Qué ver en 3D" value={view} onChange={setView} options={[{ value: 'neurona', label: 'Neurona y axón' }, { value: 'arco', label: 'Arco reflejo' }]} />
          <Scene3D key={view} idPrefix="ner" title={view === 'neurona' ? 'Neurona con el impulso en el axón' : 'Arco reflejo de retirada en 3D'} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.15, pitch: 0.3 }} status="ilustracion"
            statusNote={`Ilustración sin escala. El impulso avanza en cámara lenta (${fmt(ANIM_S, 0)} s en pantalla); en la fibra mielínica salta de nodo en nodo y en el arco reflejo cada tramo dura lo que calcula el modelo.`} />
          <SimControls title="Impulso nervioso" status={status} startLabel="Estimular" repeatLabel="Estimular otra vez"
            onStart={() => { setProgress(0); setStarted(true); setRunning(true); playSound('click', { intensity: 0.4 }); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset}
            progress={{ value: progress * 100, max: 100, unit: '%', label: 'recorrido' }} />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="ner" intro="Ideas frecuentes sobre el sistema nervioso. Decide si son ciertas o falsas y compruébalo con la regla, el potencial de acción y la vista 3D." />
      </div>
      <div className="controls">
        {station === 'regla' ? (
          <div className="card stack">
            <h3>Tu ensayo con la regla</h3>
            <Slider label="Distancia a la que atrapaste la regla" value={d} min={0} max={35} step={0.1} unit="cm" decimals={1} onChange={(v) => { setD(v); setOrigin('propio'); }} hint="Escribe tu propia medición (borde superior de los dedos)." />
            <Select label="Mano" value={hand} onChange={setHand} options={[{ value: 'dominante', label: 'Mano dominante' }, { value: 'no dominante', label: 'Mano no dominante' }]} />
            <Segmented<Stimulus> label="Señal para atrapar" value={stim} onChange={setStim} options={[{ value: 'visual', label: 'Ver la regla' }, { value: 'auditivo', label: 'Oír «ya»' }, { value: 'distraido', label: 'Contando hacia atrás' }]} />
            <button type="button" className="btn" onClick={() => { const s = exSeed + 1; setExSeed(s); setD(exampleCatch(stim, 97 * s + stim.length)); setOrigin('ejemplo'); playSound('click', { intensity: 0.3 }); }}>Ensayo de ejemplo (modelo)</button>
            <RecordButton onRecord={recordR} disabled={!valid} />
            <Notice>Haz al menos 5 ensayos por condición. Los «ensayos de ejemplo» son datos generados por un modelo (medias supuestas de 0,19 a 0,28 s), no mediciones.</Notice>
          </div>
        ) : (
          <div className="card stack">
            <h3>Estímulo y fibra</h3>
            <Slider label="Despolarización del estímulo" value={stimulus} min={0} max={40} step={1} unit="mV" decimals={0} onChange={setStimulus} />
            <Select label="Tipo de fibra (sensitiva)" value={fiberId} onChange={setFiberId} options={FIBERS.map((x) => ({ value: x.id, label: `${x.name}: ${x.role}` }))} />
            <Slider label="Longitud del recorrido" value={pathM} min={0.1} max={1.5} step={0.05} unit="m" decimals={2} onChange={setPathM} hint="De la mano a la médula espinal: unos 0,8 m en un adolescente (estimación)." />
            <RecordButton onRecord={recordP} />
            <Notice>Reposo −70 mV, umbral −55 mV y pico +30 mV (valores de los textos de fisiología). Velocidades representativas de los rangos de Kandel y otros (2013).</Notice>
          </div>
        )}
      </div>
    </div>
  );
}

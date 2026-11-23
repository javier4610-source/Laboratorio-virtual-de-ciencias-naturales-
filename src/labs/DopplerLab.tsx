import { useEffect, useMemo, useRef, useState } from 'react';
import { DOPPLER_LIMITS, dopplerLine, lineConditions, machCone, passBy, soundSpeed } from '../models/doppler';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { dopplerScene, T_SCENE } from './doppler3d';

type Station = 'linea' | 'paso' | 'mach';
/** El recorrido de la escena (9 unidades de tiempo adimensional) dura 9 s en pantalla. */
const SCREEN_S = 9;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Cuando una ambulancia se acerca, la sirena suena más aguda porque la sirena cambia su tono.', answer: 'falso', feedback: 'La sirena emite siempre la misma frecuencia. Lo que cambia es la separación de los frentes de onda que llegan: delante de la fuente se apiñan (λ menor) y se oye más agudo.' },
  { id: 'i2', text: 'El efecto Doppler hace que el sonido se oiga más fuerte cuando la fuente se acerca.', answer: 'falso', feedback: 'El Doppler cambia la frecuencia (el tono), no la intensidad. El sonido se oye más fuerte al acercarse porque la fuente está más cerca, que es otro efecto.' },
  { id: 'i3', text: 'Moverse hacia una fuente quieta a 25 m/s da el mismo tono que si la fuente se acerca a 25 m/s.', answer: 'falso', feedback: 'Son casi iguales pero no idénticos: con 700 Hz y aire a 20 °C, la fuente que se acerca da 755,0 Hz y el observador que se acerca 751,0 Hz. En el sonido importa quién se mueve respecto al aire.' },
  { id: 'i4', text: 'El estampido sónico se oye solo en el instante en que el avión rompe la barrera del sonido.', answer: 'falso', feedback: 'Mientras el avión vuela más rápido que el sonido arrastra el cono de Mach; cada persona oye el estampido cuando el cono le pasa por encima, no solo al «romper la barrera».' },
  { id: 'i5', text: 'El sonido viaja más rápido en el aire caliente de Apartadó que en el aire frío de un páramo.', answer: 'cierto', feedback: 'c = 331,3·√(1 + T/273,15): a 30 °C es ≈ 349 m/s y a 5 °C ≈ 334 m/s.' },
];

export default function DopplerLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('linea');
  const [f, setF] = useState(700);
  const [vs, setVs] = useState(25);
  const [vo, setVo] = useState(0);
  const [T, setT] = useState(20);
  const [vPass, setVPass] = useState(25);
  const [d, setD] = useState(10);
  const [M, setM] = useState(2);
  const [t, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  const c = soundSpeed(T);
  const line = useMemo(() => dopplerLine(f, vs, vo, T), [f, vs, vo, T]);
  const pass = useMemo(() => passBy(f, vPass, d, T), [f, vPass, d, T]);
  const mach = useMemo(() => machCone(M * c, T), [M, c, T]);
  const conds = station === 'linea' ? lineConditions(line, vs, vo) : [];
  const Mscene = station === 'linea' ? vs / c : station === 'paso' ? vPass / c : M;
  const scene = useMemo(() => dopplerScene({ M: Mscene, t, observerX: station === 'mach' ? 0 : 2.2, showCone: station === 'mach', label: station === 'mach' ? 'Avión supersónico' : station === 'paso' ? 'Ambulancia por la calle' : 'Fuente en movimiento' }), [Mscene, t, station]);

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setTime(0); };
  useEffect(resetRun, [station, Mscene]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setTime(T_SCENE); setRunning(false); return; }
    const speed = T_SCENE / SCREEN_S;
    const start = performance.now() - (t / speed) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * speed;
      if (el >= T_SCENE) { setTime(T_SCENE); setRunning(false); return; }
      setTime(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= T_SCENE && !running;
  const status = simStatusOf(running, t > 0, finished);

  usePublishModel(() => ({
    vars: {
      f: { sym: 'f', name: 'Frecuencia de la fuente', value: f, unit: 'Hz', decimals: 0 },
      c: { sym: 'c', name: 'Rapidez del sonido', value: c, unit: 'm/s', decimals: 2 },
      vo: { sym: 'v_o', name: 'Velocidad del observador (+ si se acerca)', value: vo, unit: 'm/s', decimals: 1 },
      vs: { sym: 'v_s', name: 'Velocidad de la fuente (+ si se acerca)', value: vs, unit: 'm/s', decimals: 1 },
    },
    equations: [{ title: 'Frecuencia que se oye', lhs: "f'", expr: '[f]·\\frac{[c] + [vo]}{[c] − [vs]}' }],
  }), [f, c, vo, vs]);

  const record = () => {
    if (station === 'linea') api.addTrial('doppler', { frecuencia: f, vFuente: vs, vObservador: vo, temperatura: T, c: Number(c.toFixed(2)), fOida: line.shock ? null : Number(line.fObs.toFixed(1)), lambdaDelante: Number(line.lambdaFront.toFixed(4)), lambdaDetras: Number(line.lambdaBack.toFixed(4)) });
    else if (station === 'paso') api.addTrial('paso', { rapidez: vPass, distancia: d, frecuencia: f, fAcerca: Number(pass.fApproach.toFixed(1)), fAleja: Number(pass.fRecede.toFixed(1)), salto: Number((pass.fApproach - pass.fRecede).toFixed(1)) });
    else api.addTrial('mach', { mach: M, temperatura: T, rapidez: Number((M * c).toFixed(1)), angulo: mach.angleDeg === null ? null : Number(mach.angleDeg.toFixed(2)) });
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'linea', label: 'Fuente y observador' }, { value: 'paso', label: 'Paso de la ambulancia' }, { value: 'mach', label: 'Barrera del sonido' }]} />
        <Readout items={[{ k: 'Rapidez del sonido c = 331,3·√(1 + T/273,15)', v: `${fmt(c, 1)} m/s a ${fmt(T, 0)} °C` }]} />
        {station === 'linea' && (
          <Readout items={[
            { k: "Frecuencia que se oye f' = f·(c + v_o)/(c − v_s)", v: line.shock ? 'no definida: la fuente alcanza al sonido' : `${fmt(line.fObs, 1)} Hz`, data: true },
            { k: 'Cambio de tono', v: line.shock ? '—' : `${line.fObs >= f ? 'más agudo' : 'más grave'}: ${fmt((line.ratio - 1) * 100, 1)} %` },
            { k: 'Longitud de onda delante y detrás de la fuente', v: `${fmt(line.lambdaFront, 3)} m y ${fmt(line.lambdaBack, 3)} m (quieta: ${fmt(c / f, 3)} m)` },
          ]} />
        )}
        {station === 'paso' && (
          <>
            <Readout items={[
              { k: 'Se oye al acercarse y al alejarse', v: `${fmt(pass.fApproach, 1)} Hz y ${fmt(pass.fRecede, 1)} Hz`, data: true },
              { k: 'Salto de frecuencia al pasar', v: `${fmt(pass.fApproach - pass.fRecede, 1)} Hz (${fmt(12 * Math.log2(pass.fApproach / pass.fRecede), 1)} semitonos)` },
            ]} />
            <Chart title="Frecuencia que oye el peatón mientras pasa la ambulancia" xLabel="Tiempo de llegada del sonido (s)" yLabel="Frecuencia (Hz)" xUnit="s" yUnit="Hz" height={240} exportName="paso-ambulancia"
              hLines={[{ y: f, label: `emitida: ${fmt(f, 0)} Hz` }]}
              series={[{ label: 'Frecuencia oída (modelo)', color: 'var(--series-1)', kind: 'line', points: pass.points.map((p) => ({ x: p.t, y: p.f })) }]} />
          </>
        )}
        {station === 'mach' && (
          <Readout items={[
            { k: 'Rapidez del avión v = M·c', v: `${fmt(M * c, 1)} m/s (${fmt(M * c * 3.6, 0)} km/h)` },
            { k: 'Semiángulo del cono de Mach (sen θ = 1/M)', v: mach.angleDeg === null ? 'no hay cono: el avión va más despacio que el sonido' : `${fmt(mach.angleDeg, 1)}°`, data: true },
          ]} />
        )}
        {station === 'mach' && M <= 1 && <ConditionAlert level="nota" cause="Con M ≤ 1 el avión no alcanza a sus propios frentes de onda: no se forma cono ni onda de choque." fix="Sube el número de Mach por encima de 1." />}
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="dp-3d-h">
          <h3 id="dp-3d-h">Vista 3D: los frentes de onda alrededor de la fuente</h3>
          <Scene3D idPrefix="dp" title="Frentes de onda de una fuente en movimiento en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.15, pitch: 0.35 }} status="modelo"
            statusNote="Cada esfera es un frente de onda con centro donde estaba la fuente al emitirlo; la razón entre la rapidez de la fuente y la del sonido es la del modelo. El tiempo de la escena es adimensional: un frente por unidad de tiempo, no uno por período real." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="dp" intro="Ideas frecuentes sobre el efecto Doppler y el estampido sónico. Decide si son ciertas o falsas y compruébalo con el laboratorio." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Fuente de sonido</h3>
          <Slider label="Temperatura del aire" value={T} min={DOPPLER_LIMITS.T[0]} max={DOPPLER_LIMITS.T[1]} step={1} unit="°C" decimals={0} onChange={setT} />
          {station !== 'mach' && <Slider label="Frecuencia de la sirena" value={f} min={DOPPLER_LIMITS.f[0]} max={DOPPLER_LIMITS.f[1]} step={10} unit="Hz" decimals={0} onChange={setF} />}
          {station === 'linea' && <>
            <Slider label="Velocidad de la fuente (positiva si se acerca)" value={vs} min={-100} max={400} step={1} unit="m/s" decimals={0} onChange={setVs} />
            <Slider label="Velocidad del observador (positiva si se acerca)" value={vo} min={DOPPLER_LIMITS.vo[0]} max={DOPPLER_LIMITS.vo[1]} step={1} unit="m/s" decimals={0} onChange={setVo} />
          </>}
          {station === 'paso' && <>
            <Slider label="Rapidez de la ambulancia" value={vPass} min={0} max={60} step={1} unit="m/s" decimals={0} onChange={setVPass} />
            <Slider label="Distancia del peatón a la calle" value={d} min={2} max={50} step={1} unit="m" decimals={0} onChange={setD} />
          </>}
          {station === 'mach' && <Slider label="Número de Mach del avión" value={M} min={0.5} max={3} step={0.05} unit="" decimals={2} onChange={setM} />}
          <SimControls title="Frentes de onda" status={status} startLabel="Emitir sonido" repeatLabel="Emitir otra vez"
            onStart={() => { setTime(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            progress={{ value: t, max: T_SCENE, unit: '', label: 'frentes', decimals: 1 }} />
          <RecordButton key={station} onRecord={record} label={station === 'linea' ? 'Guardar la frecuencia en la tabla' : station === 'paso' ? 'Guardar el paso en la tabla' : 'Guardar el cono en la tabla'} />
          <Notice>Aire seco y quieto, como gas ideal (c a 0 °C = 331,3 m/s). La sirena es un tono puro ilustrativo; las sirenas reales alternan tonos. Con viento, las velocidades se miden respecto al aire.</Notice>
        </div>
      </div>
    </div>
  );
}

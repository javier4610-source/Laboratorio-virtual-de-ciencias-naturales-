import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHALLENGES, KIN_LIMITS, MATCH_TOLERANCE, STROBE_INTERVAL, TRACK_LENGTH,
  challengeError, observationTime, sampleCurve, simulateRun, stateAt,
} from '../models/kinematics';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart, type Series } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';

type AnimSpeed = 'real' | 'x4';

const TRACK_X0 = 40;
const TRACK_PX = 600;
const toPx = (x: number) => TRACK_X0 + (x / TRACK_LENGTH) * TRACK_PX;

function Bicycle({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <circle cx="-15" cy="108" r="12" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <circle cx="15" cy="108" r="12" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M-15 108 L-4 92 L12 92 L15 108 M-4 92 L0 108 L-15 108 M12 92 L10 84" fill="none" stroke="var(--fis)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M-4 92 L-2 72 L8 84" fill="none" stroke="var(--ink-2)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="-1" cy="64" r="6" fill="var(--ink-2)" />
      <circle cx="0" cy="120" r="2" fill="var(--bad)" />
    </g>
  );
}

export default function KinematicsLab({ api }: LabProps) {
  const [v0, setV0] = useState(2);
  const [acc, setAcc] = useState(1);
  const [duration, setDuration] = useState(5);
  const [challengeId, setChallengeId] = useState('ninguno');
  const [speed, setSpeed] = useState<AnimSpeed>('real');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const raf = useRef(0);

  const input = useMemo(() => ({ v0, acceleration: acc, duration }), [v0, acc, duration]);
  const res = useMemo(() => simulateRun(input), [input]);
  const tObs = useMemo(() => observationTime(input).tObs, [input]);
  const curve = useMemo(() => sampleCurve(input), [input]);
  const challenge = CHALLENGES.find((c) => c.id === challengeId) ?? null;
  const target = useMemo(() => (challenge ? sampleCurve({ v0: challenge.v0, acceleration: challenge.acceleration, duration: challenge.duration }) : []), [challenge]);
  const error = useMemo(() => (challenge ? challengeError(input, challenge) : null), [input, challenge]);

  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setDone(false); setT(0); };
  useEffect(reset, [v0, acc, duration]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(tObs); setRunning(false); setDone(true); return; }
    const factor = speed === 'x4' ? 4 : 1;
    const start = performance.now();
    const tick = (now: number) => {
      const el = Math.max(0, ((now - start) / 1000) * factor);
      if (el >= tObs) { setT(tObs); setRunning(false); setDone(true); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, tObs, speed]);

  const start = () => { setT(0); setDone(false); setRunning(true); };
  const tShown = Math.min(Math.max(0, t), tObs);
  const pos = done && res.endReason === 'pista' ? TRACK_LENGTH : stateAt(v0, acc, tShown).x;
  const nStrobe = Math.min(res.strobe.length, Math.floor(tShown / STROBE_INTERVAL + 1e-9) + 1);
  const visibleStrobe = running || done ? res.strobe.slice(0, done ? res.strobe.length : nStrobe) : [];

  const tMax = Math.max(duration, challenge?.duration ?? 0);
  const xtSeries: Series[] = [];
  if (challenge) xtSeries.push({ label: 'Reto (objetivo)', color: 'var(--ink-2)', kind: 'line', dashed: true, points: target.map((p) => ({ x: p.t, y: p.x })) });
  if (done) {
    xtSeries.push({ label: 'Tu recorrido', color: 'var(--series-1)', kind: 'line', points: curve.map((p) => ({ x: p.t, y: p.x })) });
    xtSeries.push({ label: 'Fotos estroboscópicas', color: 'var(--data)', kind: 'scatter', points: res.strobe.map((p) => ({ x: p.t, y: p.x, label: `t = ${fmt(p.t, 1)} s` })) });
  }
  const vtSeries: Series[] = done ? [
    { label: 'Velocidad', color: 'var(--series-2)', kind: 'line', points: curve.map((p) => ({ x: p.t, y: p.v })) },
    { label: 'Instantes de las fotos', color: 'var(--data)', kind: 'scatter', points: res.strobe.map((p) => ({ x: p.t, y: p.v, label: `t = ${fmt(p.t, 1)} s` })) },
  ] : [];

  const record = () => api.addTrial('recorridos', {
    v0, aceleracion: acc, tiempo: res.time, distancia: res.distance,
    vFinal: Number(res.finalSpeed.toFixed(2)), vMedia: Number(res.meanSpeed.toFixed(3)),
  });

  const hint = (() => {
    if (!challenge || error === null) return '';
    if (error < MATCH_TOLERANCE) return '';
    if (duration < challenge.duration) return `Tu recorrido dura menos que el reto (${fmt(challenge.duration, 0)} s): alarga la duración.`;
    const end = stateAt(challenge.v0, challenge.acceleration, Math.min(duration, challenge.duration)).x;
    const mine = stateAt(v0, acc, Math.min(duration, challenge.duration)).x;
    const startSlopeDiff = v0 - challenge.v0;
    if (Math.abs(startSlopeDiff) >= 0.5) return startSlopeDiff > 0 ? 'Al comienzo tu curva es más empinada que la punteada: tu velocidad inicial es demasiado alta.' : 'Al comienzo tu curva es menos empinada que la punteada: aumenta la velocidad inicial.';
    return mine > end ? 'Al final tu curva queda por encima de la punteada: disminuye la aceleración (más negativa si debe frenar).' : 'Al final tu curva queda por debajo de la punteada: aumenta la aceleración (o frena menos).';
  })();

  const descText = done
    ? `Recorrido terminado: ${fmt(res.distance, 2)} m en ${fmt(res.time, 2)} s; ${res.strobe.length} fotos estroboscópicas sobre la pista.`
    : running ? `El ciclista avanza; cronómetro en ${fmt(tShown, 2)} s.` : 'El ciclista está en la salida (0 m) de la ciclorruta.';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 680 200" role="img" aria-labelledby="cin-t cin-d">
            <title id="cin-t">Ciclista en una ciclorruta recta de 50 m con cinta métrica y fotos estroboscópicas</title>
            <desc id="cin-d">{descText}</desc>
            <rect x={TRACK_X0 - 10} y="122" width={TRACK_PX + 20} height="14" rx="3" fill="#2e7d5b" opacity="0.85" />
            <line x1={TRACK_X0 - 10} x2={TRACK_X0 + TRACK_PX + 10} y1="129" y2="129" stroke="#fff" strokeWidth="1.5" strokeDasharray="10 8" />
            {/* Cinta métrica */}
            <line x1={TRACK_X0} x2={TRACK_X0 + TRACK_PX} y1="150" y2="150" stroke="var(--ink-2)" />
            {Array.from({ length: 11 }, (_, i) => i * 5).map((m) => (
              <g key={m}>
                <line x1={toPx(m)} x2={toPx(m)} y1="146" y2={m % 10 === 0 ? 158 : 154} stroke="var(--ink-2)" />
                {m % 10 === 0 && <text x={toPx(m)} y="172" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{m} m</text>}
              </g>
            ))}
            <line x1={toPx(TRACK_LENGTH)} x2={toPx(TRACK_LENGTH)} y1="60" y2="136" stroke="var(--bad)" strokeWidth="2" strokeDasharray="4 3" />
            <text x={toPx(TRACK_LENGTH)} y="54" textAnchor="end" style={{ fontSize: 11, fill: 'var(--bad)' }}>fin de la pista</text>
            {/* Fotos estroboscópicas */}
            {visibleStrobe.map((p) => (
              <g key={p.t}>
                <circle cx={toPx(p.x)} cy="120" r="3.5" fill="var(--data)" stroke="var(--surface)" strokeWidth="1" />
                <line x1={toPx(p.x)} x2={toPx(p.x)} y1="124" y2="146" stroke="var(--data)" strokeWidth="1" opacity="0.6" />
              </g>
            ))}
            <Bicycle x={toPx(pos)} />
            <text x="40" y="26" style={{ fontSize: 13, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>{fmt(tShown, 2)} s</text>
            <text x="40" y="42" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>cronómetro</text>
            <text x="640" y="26" textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>fotos cada {fmt(STROBE_INTERVAL, 1)} s</text>
          </svg>
        </div>
        <Readout items={[
          { k: 'Tiempo (cronómetro)', v: done ? `${fmt(res.time, 2)} s` : running ? `${fmt(tShown, 2)} s` : '—', data: true },
          { k: 'Distancia recorrida', v: done ? `${fmt(res.distance, 2)} m` : '—', data: true },
          { k: 'Velocidad final', v: done ? `${fmt(res.finalSpeed, 2)} m/s` : '—', data: true },
          { k: 'Velocidad media = d/t', v: done ? `${fmt(res.meanSpeed, 2)} m/s` : '—', data: true },
          ...(challenge ? [{ k: 'Error frente al reto', v: done && error !== null ? `${fmt(error, 2)} m` : '—', data: true }] : []),
        ]} />
        {done && <Warnings list={res.warnings} />}
        {done && challenge && error !== null && (
          error < MATCH_TOLERANCE
            ? <Notice kind="ok"><strong>¡Coincide!</strong> Tu curva x–t se separa en promedio {fmt(error, 2)} m de la del reto (tolerancia: {fmt(MATCH_TOLERANCE, 1)} m).</Notice>
            : <Notice kind="warn">Aún no coincide: error cuadrático medio de {fmt(error, 2)} m (debe ser menor que {fmt(MATCH_TOLERANCE, 1)} m). {hint}</Notice>
        )}
        <div className="card">
          <h3>Posición en función del tiempo</h3>
          <Chart title="Gráfica posición–tiempo" xLabel="Tiempo (s)" yLabel="Posición (m)" height={260}
            xDomain={[0, tMax]} yDomain={[0, TRACK_LENGTH]} series={xtSeries}
            emptyText="Inicia el recorrido para ver la gráfica." />
        </div>
        <div className="card">
          <h3>Velocidad en función del tiempo</h3>
          <Chart title="Gráfica velocidad–tiempo" xLabel="Tiempo (s)" yLabel="Velocidad (m/s)" height={240}
            xDomain={[0, tMax]} series={vtSeries}
            emptyText="Inicia el recorrido para ver la gráfica." />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones del recorrido</h3>
          <Select label="Reto" value={challengeId} onChange={setChallengeId}
            options={[{ value: 'ninguno', label: 'Sin reto (exploración libre)' }, ...CHALLENGES.map((c) => ({ value: c.id, label: c.name }))]}
            hint={challenge ? 'Ajusta los controles para que tu curva x–t coincida con la punteada.' : undefined} />
          <Slider label="Velocidad inicial" value={v0} min={KIN_LIMITS.v0[0]} max={KIN_LIMITS.v0[1]} step={0.5} unit="m/s" decimals={1} onChange={setV0} />
          <Slider label="Aceleración" value={acc} min={KIN_LIMITS.acceleration[0]} max={KIN_LIMITS.acceleration[1]} step={0.1} unit="m/s²" decimals={1} onChange={setAcc}
            hint="Negativa: el ciclista frena hasta detenerse." />
          <Slider label="Duración del recorrido" value={duration} min={KIN_LIMITS.duration[0]} max={KIN_LIMITS.duration[1]} step={0.5} unit="s" decimals={1} onChange={setDuration} />
          <Segmented<AnimSpeed> label="Velocidad de la animación" value={speed} onChange={setSpeed}
            options={[{ value: 'real', label: 'Tiempo real' }, { value: 'x4', label: 'Acelerada ×4' }]} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={start} disabled={running}>Iniciar recorrido</button>
            <button type="button" className="btn" onClick={reset}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>Pista recta de 50 m; aceleración constante. Cinta métrica de 1 cm, cronómetro de 0,01 s y fotografías cada 0,5 s. Al frenar, el ciclista se detiene y no retrocede.</Notice>
      </div>
    </div>
  );
}

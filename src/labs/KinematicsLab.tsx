import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHALLENGES, KIN_LIMITS, MATCH_TOLERANCE, STROBE_INTERVAL, TRACK_LENGTH,
  challengeError, observationTime, sampleCurve, simulateRun, stateAt,
} from '../models/kinematics';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Chart, type Series } from '../components/Chart';
import { DataLogger, LoggerRunCharts, SensorCard } from '../components/DataLogger';
import type { LoggerChannel, LoggerRun } from '../lib/logger';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { Stopwatch } from './kit';

type AnimSpeed = 'real' | 'x4';

const TRACK_X0 = 40;
const TRACK_PX = 600;
const toPx = (x: number) => TRACK_X0 + (x / TRACK_LENGTH) * TRACK_PX;

const G = 142; // línea de contacto de las ruedas con la ciclorruta
const WHEEL_R = 13;

/** Ciclista con casco sobre una bicicleta; las ruedas y los pedales giran según la distancia recorrida. */
function Bicycle({ x }: { x: number }) {
  const turn = (x - TRACK_X0) / WHEEL_R; // radianes girados por las ruedas
  const crank = turn * 0.45;
  const bb: [number, number] = [-1, -13];
  const pedal = (k: number): [number, number] => [bb[0] + 7 * Math.cos(crank + k * Math.PI), bb[1] + 7 * Math.sin(crank + k * Math.PI)];
  const hip: [number, number] = [-6, -40];
  const knee = (p: [number, number]): [number, number] => {
    const mx = (hip[0] + p[0]) / 2, my = (hip[1] + p[1]) / 2;
    const dx = p[0] - hip[0], dy = p[1] - hip[1];
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.sqrt(Math.max(0, 22 * 22 - (len / 2) ** 2)) * 0.9;
    return [mx + (-dy / len) * -bend, my + (dx / len) * -bend];
  };
  const leg = (k: number) => { const p = pedal(k); const kn = knee(p); return `M${hip[0]} ${hip[1]} L${kn[0]} ${kn[1]} L${p[0]} ${p[1]}`; };
  const wheel = (cx: number) => (
    <g transform={`translate(${cx} ${-WHEEL_R})`}>
      <circle r={WHEEL_R} fill="none" stroke="#1d2426" strokeWidth="3" />
      <circle r={WHEEL_R - 2.6} fill="none" stroke="#b0bcc0" strokeWidth="1" />
      <g transform={`rotate(${(turn * 180) / Math.PI})`} stroke="#9aa5a9" strokeWidth="0.6">
        {[0, 30, 60, 90, 120, 150].map((a) => <line key={a} x1={-10 * Math.cos((a * Math.PI) / 180)} y1={-10 * Math.sin((a * Math.PI) / 180)} x2={10 * Math.cos((a * Math.PI) / 180)} y2={10 * Math.sin((a * Math.PI) / 180)} />)}
      </g>
      <circle r={1.9} fill="#5d6b70" />
    </g>
  );
  return (
    <g transform={`translate(${x} ${G})`}>
      <ellipse cx={0} cy={1} rx={30} ry={2.6} fill="#000" opacity="0.22" />
      {/* pierna del fondo */}
      <path d={leg(1)} fill="none" stroke="#1b2326" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      {wheel(-17)}
      {wheel(17)}
      {/* cuadro */}
      <path d={`M-17 -13 L${bb[0]} ${bb[1]} L-7 -33 Z M${bb[0]} ${bb[1]} L13 -31 L-7 -33 M13 -31 L17 -13`} fill="none" stroke="#d84315" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M13 -31 L14 -36 L9 -38" fill="none" stroke="#263033" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={-12} y={-37} width={9} height={3} rx={1.5} fill="#263033" />
      <circle cx={bb[0]} cy={bb[1]} r={3} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />
      {/* ciclista */}
      <path d="M-6 -40 L6 -58" stroke="#f9a825" strokeWidth="7" strokeLinecap="round" />
      <path d="M6 -57 L11 -46 L10 -38" fill="none" stroke="#c68642" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={leg(0)} fill="none" stroke="#263238" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={10} cy={-64} r={5.2} fill="#c68642" />
      <path d="M4.5 -64.5 A6 6 0 0 1 16 -66 L16.5 -64 Z" fill="#1565c0" />
      {[pedal(0)].map(([px, py], k) => <rect key={k} x={px - 2.5} y={py - 1} width={5} height={2} rx={0.8} fill="#1d2426" />)}
      <circle cx="0" cy="0" r="2" fill="var(--bad)" />
    </g>
  );
}

/** Fondo de la ciclorruta: andén, árboles, carril pintado, pasto y cinta métrica. Estático. */
const Roadside = memo(function Roadside() {
  const trees = [175, 255, 345, 430, 520, 600];
  return (
    <g aria-hidden="true">
      {trees.map((tx, i) => (
        <g key={tx} opacity="0.8">
          <rect x={tx - 2} y={98} width={4} height={18} fill="#6d4c33" />
          <circle cx={tx} cy={88 - (i % 2) * 4} r={15 + (i % 3) * 2} fill="#4f8f5f" />
          <circle cx={tx + 8} cy={95 - (i % 2) * 4} r={10} fill="#3f7a50" />
          <circle cx={tx - 6} cy={82 - (i % 2) * 4} r={6} fill="#6fae7c" opacity="0.7" />
        </g>
      ))}
      <rect x={0} y={114} width={680} height={7} fill="var(--bench-top)" />
      <rect x={0} y={120} width={680} height={2} fill="var(--bench-edge)" />
      {/* carril de la ciclorruta */}
      <rect x={TRACK_X0 - 22} y={122} width={TRACK_PX + 44} height={28} fill="#2f8a62" />
      <rect x={TRACK_X0 - 22} y={122} width={TRACK_PX + 44} height={28} fill="url(#kit-liquid-shade)" opacity="0.25" />
      <line x1={TRACK_X0 - 22} x2={TRACK_X0 + TRACK_PX + 22} y1={124} y2={124} stroke="#fff" strokeWidth="1.4" opacity="0.9" />
      <line x1={TRACK_X0 - 22} x2={TRACK_X0 + TRACK_PX + 22} y1={148} y2={148} stroke="#fff" strokeWidth="1.4" opacity="0.9" />
      <line x1={TRACK_X0 - 22} x2={TRACK_X0 + TRACK_PX + 22} y1={133} y2={133} stroke="#fff" strokeWidth="1.2" strokeDasharray="10 8" opacity="0.75" />
      {/* línea de llegada a cuadros */}
      {Array.from({ length: 6 }, (_, k) => (
        <g key={k}>
          <rect x={toPx(TRACK_LENGTH) - 4} y={122 + k * 4.66} width={4} height={4.66} fill={k % 2 ? '#fff' : '#1d2426'} />
          <rect x={toPx(TRACK_LENGTH)} y={122 + k * 4.66} width={4} height={4.66} fill={k % 2 ? '#1d2426' : '#fff'} />
        </g>
      ))}
      <rect x={0} y={150} width={680} height={26} fill="#7cb342" opacity="0.32" />
      {/* cinta métrica */}
      <circle cx={TRACK_X0 - 12} cy={162} r={10} fill="#f6c945" stroke="#9c7a12" />
      <circle cx={TRACK_X0 - 12} cy={162} r={4} fill="#3a2f05" opacity="0.8" />
      <rect x={TRACK_X0} y={157} width={TRACK_PX} height={10} fill="#f6c945" stroke="#b8901f" strokeWidth="0.8" />
      {Array.from({ length: TRACK_LENGTH + 1 }, (_, m) => (
        <line key={m} x1={toPx(m)} x2={toPx(m)} y1={157} y2={157 + (m % 5 === 0 ? 7 : 3.5)} stroke="#2b2304" strokeWidth={m % 5 === 0 ? 1.1 : 0.7} />
      ))}
      {Array.from({ length: 11 }, (_, i) => i * 5).map((m) => (
        m % 10 === 0 && <text key={m} x={toPx(m)} y={190} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{m} m</text>
      ))}
      {/* meta */}
      <rect x={toPx(TRACK_LENGTH) + 8} y={70} width={4} height={80} fill="url(#kit-metal-h)" />
      {Array.from({ length: 12 }, (_, k) => (
        <rect key={k} x={toPx(TRACK_LENGTH) + 12 + (k % 4) * 5} y={70 + Math.floor(k / 4) * 5} width={5} height={5} fill={(k + Math.floor(k / 4)) % 2 ? '#fff' : '#1d2426'} />
      ))}
    </g>
  );
});

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

  const start = () => { setT(0); setDone(false); setRunning(true); playSound('click', { intensity: 0.8 }); };
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

  /* Sensor de movimiento (ultrasonido) que sigue al ciclista: muestrea el mismo modelo. */
  const [sensorRun, setSensorRun] = useState<LoggerRun | null>(null);
  const sensorChannels = useMemo<LoggerChannel[]>(() => [
    { id: 'posicion', name: 'Posición', unit: 'm', resolution: 0.01, noise: 0.015, min: 0, max: TRACK_LENGTH, color: 'var(--series-1)', sample: (tt) => stateAt(v0, acc, tt).x },
    { id: 'velocidad', name: 'Velocidad', unit: 'm/s', resolution: 0.01, noise: 0.03, min: 0, color: 'var(--series-2)', sample: (tt) => stateAt(v0, acc, tt).v },
  ], [v0, acc]);
  const conditions = `v₀ = ${fmt(v0, 1)} m/s, a = ${fmt(acc, 1)} m/s², ${fmt(tObs, 2)} s de recorrido`;

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
            <Roadside />
            <text x={toPx(TRACK_LENGTH) + 6} y="62" textAnchor="end" style={{ fontSize: 11, fill: 'var(--bad)' }}>fin de la pista</text>
            {/* Fotos estroboscópicas */}
            {visibleStrobe.map((p) => (
              <g key={p.t}>
                <line x1={toPx(p.x)} x2={toPx(p.x)} y1={G} y2="157" stroke="var(--data)" strokeWidth="1.2" opacity="0.8" />
                <circle cx={toPx(p.x)} cy={G} r="3.5" fill="var(--data)" stroke="#fff" strokeWidth="1" />
              </g>
            ))}
            <Bicycle x={toPx(pos)} />
            <Stopwatch x={40} y={10} text={`${fmt(tShown, 2)} s`} />
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
        <SensorCard intro="Un sensor de movimiento por ultrasonido, fijo en la salida, mide la posición del ciclista y calcula su velocidad. El registrador simula el recorrido con las condiciones actuales, en tiempo real.">
          <DataLogger title="Interfaz de sensores · cinemática" channels={sensorChannels} duration={tObs} speed={1} rates={[5, 10, 20, 50]} defaultRate={20}
            ranges={[[0, Math.max(5, Math.ceil(stateAt(v0, acc, tObs).x / 5) * 5)], undefined]} resetKey={conditions} runLabel={conditions} onUseRun={setSensorRun} />
          {sensorRun && (
            <div className="stack-sm">
              <h3>Corrida en uso</h3>
              <p className="small muted" style={{ margin: 0 }}>{sensorRun.label} · {sensorRun.samples.length} muestras a {fmt(sensorRun.rate, 0)} muestras/s. Ajuste cuadrático de x(t) y lineal de v(t): compara los coeficientes con v₀ y a.</p>
              <LoggerRunCharts run={sensorRun} fits={{ posicion: 'quadratic', velocidad: 'linear' }} />
            </div>
          )}
        </SensorCard>
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

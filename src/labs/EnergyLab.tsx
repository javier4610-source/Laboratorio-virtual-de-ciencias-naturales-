import { useEffect, useMemo, useRef, useState } from 'react';
import { ENERGY_LIMITS, simulateTrack, trackHeight, TRACK_X } from '../models/energy';
import { fmt, fmtSig } from '../lib/format';
import { flag } from '../lib/flags';
import {
  DRIFT_TOLERANCE, FALL_LIMITS, GRAVITY_PRESETS, idealFall, simulateFall,
  type DragModel, type FallMethod, type FallPoint, type FallResult, type GravityPreset,
} from '../models/energyTime';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { Chart, niceTicks } from '../components/Chart';
import type { LabProps } from './registry';
import { useModelParams, usePublishModel } from '../components/Advanced';
import { G as G_ENERGY } from '../models/energy';
import { BenchTop } from './kit';
import { SimControls, simStatusOf } from '../components/Experiment';

const W = 640, H = 260, X0 = 72;
const rulerTicks = Array.from({ length: 21 }, (_, i) => i / 10);

/** Actividad original: esfera en una pista con colinas (sin cambios de comportamiento). */
function TrackActivity({ api }: LabProps) {
  const [mass, setMass] = useState(0.5);
  const [h0, setH0] = useState(1);
  const [hc, setHc] = useState(0.6);
  const [mu, setMu] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const P = useModelParams();
  const res = useMemo(() => simulateTrack({ mass, startHeight: h0, hillHeight: hc, mu, rolling, g: P.g }), [mass, h0, hc, mu, rolling, P.g]);
  usePublishModel(() => {
    const g = P.g ?? G_ENERGY;
    return {
      vars: {
        E0: { sym: 'E_{p0}', name: 'Energía potencial inicial', value: mass * g * h0, unit: 'J', decimals: 3 },
        m: { sym: 'm', name: 'Masa de la esfera', value: mass, unit: 'kg', decimals: 2 },
        g: { sym: 'g', name: 'Gravedad', value: g, unit: 'm/s²', decimals: 2 },
        h: { sym: 'h_{0}', name: 'Altura de salida', value: h0, unit: 'm', decimals: 2 },
        mu: { sym: '\\mu', name: 'Coeficiente de fricción', value: mu, decimals: 3 },
        x: { sym: 'x_{valle}', name: 'Recorrido horizontal hasta el valle', value: 1.5, unit: 'm', decimals: 2 },
        Ef: { sym: 'E_{f}', name: 'Energía disipada hasta el valle', value: mu * mass * g * 1.5, unit: 'J', decimals: 3 },
        k: { sym: 'k', name: rolling ? 'Factor de rodadura (esfera maciza)' : 'Factor de rodadura (desliza)', value: res.k, decimals: 2 },
        v: { sym: 'v_{valle}', name: 'Rapidez en el valle', value: res.speedBottom, unit: 'm/s', decimals: 2 },
      },
      equations: [
        { title: 'Energía potencial gravitatoria', lhs: 'E0', expr: '[m]·[g]·[h]' },
        { title: 'Trabajo de la fricción', lhs: 'Ef', expr: '[mu]·[m]·[g]·[x]' },
        { title: 'Conservación de la energía', lhs: 'v', expr: '\\sqrt{\\frac{2·([E0] − [Ef])}{[k]·[m]}}', note: rolling ? 'Al rodar, parte de la energía se va en la rotación (k = 7/5).' : 'Sin fricción, la rapidez no depende de la masa.' },
      ],
    };
  }, [mass, h0, mu, rolling, res, P.g]);
  const raf = useRef(0);
  useEffect(() => { setIdx(0); setRunning(false); setDone(false); }, [mass, h0, hc, mu, rolling]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setIdx(res.points.length - 1); setRunning(false); setDone(true); return; }
    // Al reanudar, la animación sigue desde el punto ya recorrido.
    const start = performance.now() - (idx / res.points.length) * 3500;
    const loop = (now: number) => {
      const i = Math.max(idx, Math.min(res.points.length - 1, Math.floor(((now - start) / 3500) * res.points.length)));
      setIdx(i);
      if (i >= res.points.length - 1) { setRunning(false); setDone(true); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [running, res]);

  const p = res.points[Math.min(idx, res.points.length - 1)];
  // La esfera rueda por el riel: el sonido crece con su rapidez.
  const vMax = Math.max(1e-6, ...res.points.map((q) => q.v));
  useSoundLoop('rolling', running, 0.1 + 0.9 * Math.min(1, p.v / vMax));
  const sx = (x: number) => X0 + (x / TRACK_X) * (W - X0 - 30), sy = (h: number) => 230 - h * 95;
  // dibuja la pista completa aunque la esfera no la recorra
  const path = useMemo(() => Array.from({ length: 201 }, (_, i) => {
    const x = (TRACK_X * i) / 200;
    return `${X0 + (x / TRACK_X) * (W - X0 - 30)},${230 - trackHeight(x, h0, hc) * 95}`;
  }).join(' '), [h0, hc]);
  // soportes verticales cada 0,25 m
  const posts = useMemo(() => Array.from({ length: 17 }, (_, i) => {
    const x = (TRACK_X * i) / 16;
    return { x: X0 + (x / TRACK_X) * (W - X0 - 30), y: 230 - trackHeight(x, h0, hc) * 95 };
  }), [h0, hc]);
  const E = res.totalEnergy;
  const bar = (v: number) => (Math.max(0, v) / E) * 150;
  const last = res.points[res.points.length - 1];

  const record = () => api.addTrial('recorridos', {
    masa: mass, altura: h0, colina: hc, mu, rueda: rolling ? 'sí' : 'no',
    vValle: Number(res.speedBottom.toFixed(3)), supera: res.passesHill ? 'sí' : 'no', disipada: Number(last.ef.toFixed(4)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="en-t en-d">
            <title id="en-t">Esfera en una pista con una colina</title>
            <desc id="en-d">{`Altura de salida ${fmt(h0, 2)} m; colina de ${fmt(hc, 2)} m. ${done ? (res.passesHill ? `Supera la colina; rapidez en el valle ${fmt(res.speedBottom, 2)} m/s.` : 'No supera la colina.') : ''}`}</desc>
            <defs>
              <radialGradient id="en-ball" cx="0.36" cy="0.3" r="0.75">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="0.25" stopColor="#d9e0e3" />
                <stop offset="0.7" stopColor="#7d898e" />
                <stop offset="1" stopColor="#3a4448" />
              </radialGradient>
            </defs>
            <BenchTop y={238} width={W} />
            {/* regla vertical para la altura de salida */}
            <g filter="url(#kit-shadow-soft)">
              <rect x={28} y={sy(2) - 8} width={22} height={sy(0) - sy(2) + 16} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
            </g>
            {rulerTicks.map((h) => {
              const major = Math.abs(h * 2 - Math.round(h * 2)) < 1e-6;
              return (
                <g key={h}>
                  <line x1={28} x2={28 + (major ? 6 : 3.5)} y1={sy(h)} y2={sy(h)} stroke="#4d3b1c" strokeWidth={major ? 1.1 : 0.7} />
                  {major && <text x={48} y={sy(h) + 3} textAnchor="end" style={{ fontSize: 8, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{fmt(h, h % 1 === 0 ? 0 : 1)}</text>}
                </g>
              );
            })}
            <line x1={22} x2={22} y1={sy(0)} y2={sy(h0)} stroke="var(--ink-2)" />
            <line x1={18} x2={26} y1={sy(h0)} y2={sy(h0)} stroke="var(--ink-2)" />
            <line x1={18} x2={26} y1={sy(0)} y2={sy(0)} stroke="var(--ink-2)" />
            <text transform={`translate(15 ${(sy(0) + sy(h0)) / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>h₀ = {fmt(h0, 2)} m</text>
            <line x1={50} x2={sx(0) - 10} y1={sy(h0)} y2={sy(h0)} stroke="var(--bad)" strokeDasharray="3 3" />
            <path d={`M50 ${sy(h0)} l6 -4 v8 Z`} fill="var(--bad)" />
            {/* nivel de referencia */}
            <line x1={sx(0)} x2={sx(TRACK_X)} y1={sy(0) + 4} y2={sy(0) + 4} stroke="var(--line)" strokeDasharray="4 4" />
            {/* soportes de la pista */}
            {posts.map((q) => (
              <g key={q.x}>
                <rect x={q.x - 1.8} y={q.y + 3} width={3.6} height={Math.max(0, 236 - q.y - 3)} fill="url(#kit-metal-h)" />
                <rect x={q.x - 4} y={q.y + 1} width={8} height={5} rx={1.5} fill="#2f393c" />
                <rect x={q.x - 9} y={233} width={18} height={5} rx={2} fill="url(#kit-body-dark)" />
              </g>
            ))}
            {/* riel metálico */}
            <polyline points={path} fill="none" stroke="#000" strokeOpacity="0.14" strokeWidth="8" strokeLinejoin="round" transform="translate(0 4)" />
            <polyline points={path} fill="none" stroke="#66737a" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={path} fill="none" stroke="#dbe3e6" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={path} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1" strokeLinejoin="round" transform="translate(0 -1.2)" />
            {/* topes de salida y de llegada */}
            <rect x={sx(0) - 16} y={sy(h0) - 22} width={7} height={24} rx={2} fill="url(#kit-body-dark)" />
            <rect x={sx(TRACK_X) + 4} y={sy(0) - 20} width={9} height={24} rx={2} fill="url(#kit-body-dark)" />
            <rect x={sx(TRACK_X) + 1} y={sy(0) - 16} width={3} height={14} rx={1} fill="#c62828" />
            {/* esfera metálica */}
            <ellipse cx={sx(p.x)} cy={sy(p.h) + 1} rx={8} ry={2} fill="#000" opacity="0.18" />
            <g transform={`translate(${sx(p.x)} ${sy(p.h) - 10})`}>
              <circle r="9.5" fill="url(#en-ball)" stroke="#2f383b" strokeWidth="0.8" />
              {rolling && <path d="M-9 0 A9 3.2 0 0 0 9 0" fill="none" stroke="#2f383b" strokeWidth="0.9" opacity="0.55" transform={`rotate(${((sx(p.x) / 9.5) * 180) / Math.PI})`} />}
              <ellipse cx={-3} cy={-3.6} rx={2.6} ry={1.7} fill="#fff" opacity="0.85" />
            </g>
            <rect x={sx(p.x) - 32} y={sy(p.h) - 44} width={64} height={18} rx={9} fill="var(--surface)" stroke="var(--line)" />
            <text x={sx(p.x)} y={sy(p.h) - 31} textAnchor="middle" style={{ fontSize: 11, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>{fmt(p.v, 2)} m/s</text>
            {!res.passesHill && done && <text x={sx(res.stopX!)} y={Math.max(14, Math.min(sy(hc), sy(p.h) - 44) - 8)} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--bad)', fontWeight: 700 }}>no alcanza la cima</text>}
          </svg>
        </div>
        <div className="grid-2">
          <div className="card stack-sm" aria-live="polite">
            <h3>Energía ({fmt(E, 2)} J en total)</h3>
            {[{ k: 'Potencial (Ep)', v: p.ep, c: 'var(--fis)' }, { k: 'Cinética (Ec)', v: p.ek, c: 'var(--data)' }, { k: 'Disipada por fricción', v: p.ef, c: 'var(--bad)' }].map((b) => (
              <div key={b.k} className="small" style={{ display: 'grid', gridTemplateColumns: '150px 1fr 70px', gap: 8, alignItems: 'center' }}>
                <span>{b.k}</span>
                <span style={{ height: 14, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: bar(b.v), maxWidth: '100%', background: b.c }} /></span>
                <span className="num">{fmt(b.v, 2)} J</span>
              </div>
            ))}
          </div>
          <Readout items={[
            { k: 'Rapidez en el valle', v: done ? `${fmt(res.speedBottom, 2)} m/s` : 'suelta la esfera', data: true },
            { k: '¿Supera la colina?', v: done ? (res.passesHill ? 'sí' : 'no') : '—' },
            { k: 'Rapidez al final', v: done && res.speedEnd !== null ? `${fmt(res.speedEnd, 2)} m/s` : '—' },
            { k: 'Energía disipada', v: done ? `${fmt(last.ef, 3)} J` : '—' },
          ]} />
        </div>
        <details className="card">
          <summary>Gráfica de energías a lo largo de la pista (después de soltar)</summary>
          <Chart title="Energía en función de la posición" xLabel="Posición horizontal (m)" yLabel="Energía (J)" height={240}
            series={done ? [
              { label: 'Ep', kind: 'line', points: res.points.map((q) => ({ x: q.x, y: q.ep })) },
              { label: 'Ec', kind: 'line', points: res.points.map((q) => ({ x: q.x, y: q.ek })) },
              { label: 'Ep + Ec', kind: 'line', dashed: true, points: res.points.map((q) => ({ x: q.x, y: q.ep + q.ek })) },
            ] : []} emptyText="Suelta la esfera para ver la gráfica." />
        </details>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Slider label="Altura de salida" value={h0} min={ENERGY_LIMITS.startHeight[0]} max={ENERGY_LIMITS.startHeight[1]} step={0.1} unit="m" decimals={2} onChange={setH0} />
          <Slider label="Altura de la colina" value={hc} min={ENERGY_LIMITS.hillHeight[0]} max={ENERGY_LIMITS.hillHeight[1]} step={0.1} unit="m" decimals={2} onChange={setHc} />
          <Slider label="Masa de la esfera" value={mass} min={ENERGY_LIMITS.mass[0]} max={ENERGY_LIMITS.mass[1]} step={0.05} unit="kg" decimals={2} onChange={setMass} />
          <Slider label="Fricción efectiva μ" value={mu} min={ENERGY_LIMITS.mu[0]} max={ENERGY_LIMITS.mu[1]} step={0.005} decimals={3} onChange={setMu} />
          <label className="check"><input type="checkbox" checked={rolling} onChange={(e) => setRolling(e.target.checked)} /> La esfera rueda (parte de la energía va a la rotación)</label>
          <SimControls title="Pista" status={simStatusOf(running, idx > 0, done)} startLabel="Soltar la esfera" repeatLabel="Soltar de nuevo"
            onStart={() => { setIdx(0); setDone(false); setRunning(true); playSound('click', { intensity: 0.7 }); }}
            onPause={() => setRunning(false)} onResume={() => setRunning(true)}
            onReset={() => { setIdx(0); setDone(false); setRunning(false); }} />
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>g = 9,8 m/s²; sin resistencia del aire. La fricción se modela como μ·m·g por metro horizontal (aproximación para pendientes suaves).</Notice>
      </div>
    </div>
  );
}

/* ======================================================= caída y lanzamiento vertical (Fase 3, energiaTemporal) */

type Activity = 'pista' | 'caida';
type Pace = 'real' | 'lenta';

const DT_OPTIONS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05];
const PRESET_LABEL: Record<GravityPreset, string> = { tierra: 'Tierra', luna: 'Luna', marte: 'Marte' };
const FW = 640, FH = 300, GROUND_Y = 272, TOP_Y = 26, RULER_X = 96, BALL_X = 230;

/** Estado interpolado en el instante t (solo para dibujar entre los puntos calculados que se guardaron). */
function stateAt(points: FallPoint[], t: number): FallPoint {
  if (t <= points[0].t) return points[0];
  const last = points[points.length - 1];
  if (t >= last.t) return last;
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid].t <= t) lo = mid; else hi = mid; }
  const a = points[lo], b = points[hi], u = (t - a.t) / (b.t - a.t);
  const mix = (k: keyof FallPoint) => a[k] + u * (b[k] - a[k]);
  return { t, y: mix('y'), v: mix('v'), ek: mix('ek'), ep: mix('ep'), em: mix('em'), edis: mix('edis') };
}

function FallActivity({ api }: LabProps) {
  const [mass, setMass] = useState(1);
  const [h0, setH0] = useState(10);
  const [v0, setV0] = useState(0);
  const [preset, setPreset] = useState<GravityPreset>('tierra');
  const [drag, setDrag] = useState<DragModel>('ninguno');
  const [bLin, setBLin] = useState(0.1);
  const [cQuad, setCQuad] = useState(0.01);
  const [dt, setDt] = useState(0.01);
  const [method, setMethod] = useState<FallMethod>('rk4');
  const [pace, setPace] = useState<Pace>('real');
  const [tNow, setTNow] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const g = GRAVITY_PRESETS[preset];
  const dragCoef = drag === 'lineal' ? bLin : drag === 'cuadratico' ? cQuad : 0;
  const sim = useMemo((): { res: FallResult | null; error: string | null } => {
    try { return { res: simulateFall({ mass, height: h0, v0, g, dt, method, drag, dragCoef }), error: null }; }
    catch (e) { return { res: null, error: e instanceof Error ? e.message : String(e) }; }
  }, [mass, h0, v0, g, dt, method, drag, dragCoef]);
  const res = sim.res;
  const ideal = useMemo(() => idealFall({ mass, height: h0, v0, g }), [mass, h0, v0, g]);
  const tEnd = res ? res.points[res.points.length - 1].t : 0;

  usePublishModel(() => ({
    vars: {
      m: { sym: 'm', name: 'Masa de la pelota', value: mass, unit: 'kg', decimals: 2 },
      g: { sym: 'g', name: `Gravedad (${PRESET_LABEL[preset]})`, value: g, unit: 'm/s²', decimals: 2 },
      h: { sym: 'h_{0}', name: 'Altura inicial', value: h0, unit: 'm', decimals: 2 },
      v0: { sym: 'v_{0}', name: 'Velocidad vertical inicial', value: v0, unit: 'm/s', decimals: 2 },
      Ep0: { sym: 'E_{p0}', name: 'Energía potencial inicial', value: ideal.ep0, unit: 'J', decimals: 3 },
      Em0: { sym: 'E_{m0}', name: 'Energía mecánica inicial', value: ideal.em0, unit: 'J', decimals: 3 },
      vs: { sym: 'v_{suelo}', name: 'Rapidez al llegar al suelo sin aire (fórmula)', value: ideal.vGround, unit: 'm/s', decimals: 3 },
      ts: { sym: 't_{suelo}', name: 'Tiempo de caída sin aire (fórmula)', value: ideal.tGround, unit: 's', decimals: 4 },
    },
    equations: [
      { title: 'Energía potencial gravitatoria', lhs: 'Ep0', expr: '[m]·[g]·[h]' },
      { title: 'Energía mecánica inicial', lhs: 'Em0', expr: '[Ep0] + ½·[m]·[v0]^{2}' },
      { title: 'Conservación sin aire', lhs: 'vs', expr: '\\sqrt{[v0]^{2} + 2·[g]·[h]}', note: drag === 'ninguno' ? 'La integración numérica debe reproducir este valor.' : 'Con aire, la rapidez calculada por integración es menor que la de esta fórmula.' },
      { title: 'Tiempo hasta el suelo sin aire', lhs: 'ts', expr: '\\frac{[v0] + [vs]}{[g]}' },
    ],
    note: `Integración en el tiempo: ${method === 'rk4' ? 'Runge-Kutta de 4.º orden' : 'Euler explícito'} con Δt = ${fmt(dt, 3)} s. El parámetro g del modo avanzado solo afecta a la pista; aquí la gravedad se elige con Tierra, Luna o Marte.`,
  }), [mass, h0, v0, g, preset, ideal, drag, method, dt]);

  useEffect(() => { setTNow(0); setRunning(false); setDone(false); }, [res]);

  const raf = useRef(0);
  useEffect(() => {
    if (!running || !res) return;
    const finish = () => {
      setTNow(tEnd); setRunning(false); setDone(true);
      if (res.landed) playSound('thud', { intensity: Math.min(1, 0.3 + (res.vGround ?? 0) / 25) });
    };
    if (prefersReducedMotion()) { finish(); return; }
    const rate = pace === 'lenta' ? 0.25 : 1;
    // Al reanudar (o al cambiar el ritmo) el reloj sigue desde el tiempo ya simulado.
    const start = performance.now() - (tNow / rate) * 1000;
    const loop = (now: number) => {
      const t = ((now - start) / 1000) * rate;
      if (t >= tEnd) { finish(); return; }
      setTNow(t);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [running, res, tEnd, pace]);

  const release = () => { setTNow(0); setDone(false); setRunning(true); playSound('click', { intensity: 0.7 }); };
  const reset = () => { setTNow(0); setDone(false); setRunning(false); };

  const started = running || done || tNow > 0;
  const cur = res ? stateAt(res.points, tNow) : null;
  const yTop = useMemo(() => {
    const top = Math.max(h0, res?.apex?.y ?? h0);
    const ticks = niceTicks(0, top, 5);
    return Math.max(top, ticks[ticks.length - 1]);
  }, [h0, res]);
  const ticks = useMemo(() => niceTicks(0, yTop, 5), [yTop]);
  const sy = (y: number) => GROUND_Y - (y / yTop) * (GROUND_Y - TOP_Y);
  // marcas estroboscópicas cada 0,1 s (tiempo simulado) hasta el instante actual
  const strobe = useMemo(() => {
    if (!res) return [];
    const out: FallPoint[] = [];
    for (let t = 0; t < tEnd; t += 0.1) out.push(stateAt(res.points, t));
    return out.length > 300 ? out.filter((_, i) => i % Math.ceil(out.length / 300) === 0) : out;
  }, [res, tEnd]);
  // gráficas «en vivo»: crecen con la animación (actualizadas cada 0,05 s de tiempo simulado)
  const tChart = done ? tEnd : Math.floor(tNow / 0.05) * 0.05;
  const shown = useMemo(() => {
    if (!res || !started) return [];
    const pts = res.points.filter((q) => q.t <= tChart);
    if (pts.length && pts[pts.length - 1].t < tChart) pts.push(stateAt(res.points, tChart));
    return pts;
  }, [res, started, tChart]);
  const withAir = drag !== 'ninguno';
  const seriesFor = (x: (q: FallPoint) => number) => [
    { label: 'Ep', kind: 'line' as const, points: shown.map((q) => ({ x: x(q), y: q.ep })) },
    { label: 'Ec', kind: 'line' as const, points: shown.map((q) => ({ x: x(q), y: q.ek })) },
    { label: 'Em = Ec + Ep', kind: 'line' as const, dashed: true, points: shown.map((q) => ({ x: x(q), y: q.em })) },
    ...(withAir ? [{ label: 'E disipada', kind: 'line' as const, points: shown.map((q) => ({ x: x(q), y: q.edis })) }] : []),
  ];
  const eMax = res ? res.em0 * 1.08 : 1;

  const tolText = fmtSig(DRIFT_TOLERANCE, 1);
  const driftLabel = withAir ? 'Deriva máxima de Em + E disipada' : 'Deriva máxima de Em';
  const landedText = (f: (r: FallResult) => string) => (!res ? '—' : !done ? 'suelta la pelota' : res.landed ? f(res) : `no llega al suelo en ${fmt(tEnd, 0)} s`);

  const record = () => {
    if (!res) return;
    api.addTrial('caida', {
      lugar: PRESET_LABEL[preset], masa: mass, altura: h0, v0, g,
      aire: drag === 'ninguno' ? 'sin aire' : drag === 'lineal' ? 'lineal' : 'cuadrático', coefAire: dragCoef,
      metodo: method === 'rk4' ? 'RK4' : 'Euler', dt,
      ep0: Number(res.ep0.toFixed(4)),
      tSuelo: res.tGround === null ? '—' : Number(res.tGround.toFixed(5)),
      vSuelo: res.vGround === null ? '—' : Number(res.vGround.toFixed(4)),
      hMax: Number((res.apex?.y ?? h0).toFixed(4)),
      disipada: Number(res.edisFinal.toFixed(4)),
      deriva: Number(res.maxDrift.toPrecision(3)),
      tolerancia: res.withinTolerance ? 'sí' : 'no',
    });
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${FW} ${FH}`} role="img" aria-labelledby="enc-t enc-d">
            <title id="enc-t">Pelota que cae junto a una regla vertical</title>
            <desc id="enc-d">{`Altura inicial ${fmt(h0, 2)} m; velocidad inicial ${fmt(v0, 2)} m/s; gravedad ${fmt(g, 2)} m/s². ${cur ? `Instante ${fmt(cur.t, 2)} s: altura ${fmt(cur.y, 2)} m, rapidez ${fmt(Math.abs(cur.v), 2)} m/s.` : ''}`}</desc>
            {/* suelo */}
            <rect x={0} y={GROUND_Y} width={FW} height={FH - GROUND_Y} fill="var(--surface-2)" />
            <line x1={0} x2={FW} y1={GROUND_Y} y2={GROUND_Y} stroke="var(--ink-2)" />
            {/* regla vertical */}
            <rect x={RULER_X} y={TOP_Y - 6} width={22} height={GROUND_Y - TOP_Y + 6} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
            {ticks.map((y) => (
              <g key={y}>
                <line x1={RULER_X} x2={RULER_X + 8} y1={sy(y)} y2={sy(y)} stroke="#4d3b1c" strokeWidth={1.1} />
                <text x={RULER_X - 6} y={sy(y) + 4} textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(y, y % 1 === 0 ? 0 : 1)} m</text>
              </g>
            ))}
            {/* altura inicial y altura máxima */}
            <line x1={RULER_X + 22} x2={BALL_X + 60} y1={sy(h0)} y2={sy(h0)} stroke="var(--ink-2)" strokeDasharray="3 3" />
            <text x={BALL_X + 64} y={sy(h0) + 4} style={{ fontSize: 11, fill: 'var(--ink-2)' }}>h₀ = {fmt(h0, 2)} m</text>
            {res?.apex && done && (
              <g>
                <line x1={RULER_X + 22} x2={BALL_X + 60} y1={sy(res.apex.y)} y2={sy(res.apex.y)} stroke="var(--fis)" strokeDasharray="5 3" />
                <text x={BALL_X + 64} y={sy(res.apex.y) + 4} style={{ fontSize: 11, fill: 'var(--fis)' }}>h máx = {fmt(res.apex.y, 2)} m</text>
              </g>
            )}
            {/* posiciones cada 0,1 s ya recorridas */}
            {started && strobe.filter((q) => q.t <= tNow + 1e-9).map((q) => (
              <circle key={q.t} cx={BALL_X} cy={sy(q.y) - 8} r={3} fill="none" stroke="var(--data)" strokeOpacity={0.7} />
            ))}
            {cur && (
              <g>
                <ellipse cx={BALL_X} cy={GROUND_Y + 2} rx={9 * (0.4 + 0.6 * (1 - cur.y / yTop))} ry={2} fill="#000" opacity="0.18" />
                <circle cx={BALL_X} cy={sy(cur.y) - 8} r={8} fill="url(#enc-ball)" stroke="#2f383b" strokeWidth="0.8" />
                <rect x={BALL_X + 16} y={sy(cur.y) - 24} width={190} height={20} rx={10} fill="var(--surface)" stroke="var(--line)" />
                <text x={BALL_X + 111} y={sy(cur.y) - 10} textAnchor="middle" style={{ fontSize: 11, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>{`t = ${fmt(cur.t, 2)} s · v = ${fmt(Math.abs(cur.v), 2)} m/s`}</text>
              </g>
            )}
            <defs>
              <radialGradient id="enc-ball" cx="0.36" cy="0.3" r="0.75">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="0.25" stopColor="#d9e0e3" />
                <stop offset="0.7" stopColor="#7d898e" />
                <stop offset="1" stopColor="#3a4448" />
              </radialGradient>
            </defs>
          </svg>
          <p className="small muted" style={{ margin: '6px 8px' }}>
            La posición de la pelota proviene del cálculo (integración numérica en el tiempo); entre dos puntos calculados se interpola solo para dibujar. Ritmo: {pace === 'real' ? 'tiempo real' : 'cámara lenta (×0,25)'}. Los círculos marcan la posición cada 0,1 s.
          </p>
        </div>
        {sim.error && <Notice kind="bad">{sim.error}</Notice>}
        <Readout items={[
          { k: 'Ep inicial', v: res ? `${fmt(res.ep0, 2)} J` : '—', data: true },
          { k: 'Rapidez al llegar al suelo', v: landedText((r) => `${fmt(r.vGround, 3)} m/s`), data: true },
          { k: 'Tiempo de caída', v: landedText((r) => `${fmt(r.tGround, 4)} s`), data: true },
          { k: driftLabel, v: res && done ? fmtSig(res.maxDrift, 2) : '—' },
          { k: 'Rapidez según √(v₀² + 2gh₀)', v: `${fmt(ideal.vGround, 3)} m/s` },
          ...(v0 > 0 ? [{ k: 'Altura máxima', v: res && done && res.apex ? `${fmt(res.apex.y, 3)} m` : '—' }] : []),
          ...(withAir ? [{ k: 'Energía disipada por el aire', v: res && done ? `${fmt(res.edisFinal, 3)} J` : '—' }] : []),
        ]} />
        {res && done && (
          <Notice kind={res.withinTolerance ? 'ok' : 'warn'}>
            {res.withinTolerance
              ? `La deriva máxima (${fmtSig(res.maxDrift, 2)}) es menor que la tolerancia declarada (${tolText}): con este método y este Δt, ${withAir ? 'Em + E disipada' : 'la energía mecánica'} se mantiene constante dentro de la precisión que se le pide al modelo.`
              : `La deriva máxima (${fmtSig(res.maxDrift, 2)}) supera la tolerancia declarada (${tolText}): con este método y este Δt el cálculo no conserva bien ${withAir ? 'Em + E disipada' : 'la energía mecánica'}. Es un error del método numérico, no de la física: prueba con un Δt menor o con RK4.`}
          </Notice>
        )}
        <div className="grid-2">
          <div className="card">
            <Chart title="Energía en función del tiempo" xLabel="Tiempo (s)" yLabel="Energía (J)" height={240}
              xDomain={[0, Math.max(tEnd, 1e-3)]} yDomain={[0, eMax]} series={started ? seriesFor((q) => q.t) : []}
              emptyText="Suelta la pelota para ver la gráfica." exportName="energia-tiempo" />
          </div>
          <div className="card">
            <Chart title="Energía en función de la altura" xLabel="Altura (m)" yLabel="Energía (J)" height={240}
              xDomain={[0, yTop]} yDomain={[0, eMax]} series={started ? seriesFor((q) => q.y) : []}
              emptyText="Suelta la pelota para ver la gráfica." exportName="energia-altura" />
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Slider label="Masa de la pelota" value={mass} min={FALL_LIMITS.mass[0]} max={FALL_LIMITS.mass[1]} step={0.1} unit="kg" decimals={2} onChange={setMass} />
          <Slider label="Altura inicial" value={h0} min={FALL_LIMITS.height[0]} max={FALL_LIMITS.height[1]} step={0.5} unit="m" decimals={2} onChange={setH0} />
          <Slider label="Velocidad inicial (positiva hacia arriba)" value={v0} min={FALL_LIMITS.v0[0]} max={FALL_LIMITS.v0[1]} step={0.5} unit="m/s" decimals={2} onChange={setV0} />
          <Segmented<GravityPreset> label="Gravedad" value={preset} onChange={setPreset}
            options={(Object.keys(GRAVITY_PRESETS) as GravityPreset[]).map((k) => ({ value: k, label: `${PRESET_LABEL[k]} (${fmt(GRAVITY_PRESETS[k], 2)} m/s²)` }))} />
          <Segmented<DragModel> label="Resistencia del aire" value={drag} onChange={setDrag}
            options={[{ value: 'ninguno', label: 'Sin aire (ideal)' }, { value: 'lineal', label: 'Lineal (F = b·v)' }, { value: 'cuadratico', label: 'Cuadrática (F = c·v²)' }]} />
          {drag === 'lineal' && <Slider label="Coeficiente de arrastre lineal b" value={bLin} min={FALL_LIMITS.linearDrag[0]} max={FALL_LIMITS.linearDrag[1]} step={0.01} unit="kg/s" decimals={2} onChange={setBLin} />}
          {drag === 'cuadratico' && <Slider label="Coeficiente de arrastre cuadrático c" value={cQuad} min={FALL_LIMITS.quadraticDrag[0]} max={FALL_LIMITS.quadraticDrag[1]} step={0.001} unit="kg/m" decimals={3} onChange={setCQuad} />}
          <h3>Cálculo numérico</h3>
          <Segmented<FallMethod> label="Método de integración" value={method} onChange={setMethod}
            options={[{ value: 'rk4', label: 'RK4 (4.º orden)' }, { value: 'euler', label: 'Euler explícito (para comparar)' }]} />
          <Select label="Paso de tiempo Δt" value={String(dt)} onChange={(v) => setDt(Number(v))}
            options={DT_OPTIONS.map((d) => ({ value: String(d), label: `${fmt(d, 3)} s` }))} />
          <Segmented<Pace> label="Ritmo de la animación" value={pace} onChange={setPace}
            options={[{ value: 'real', label: 'Tiempo real' }, { value: 'lenta', label: 'Cámara lenta (×0,25)' }]} />
          {/* Sin barra de avance: el tiempo de caída es uno de los resultados que se miden. */}
          <SimControls title="Caída de la pelota" status={simStatusOf(running, tNow > 0, done)} startLabel="Soltar la pelota" repeatLabel="Soltar de nuevo"
            disabled={!res} onStart={release} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset} />
          <RecordButton onRecord={record} disabled={!done || !res} />
        </div>
        <Notice>
          Modelo calculado: integración en el tiempo con paso fijo Δt ({method === 'rk4' ? 'Runge-Kutta de 4.º orden' : 'Euler explícito'}); el instante de llegada al suelo se interpola entre dos pasos. Tolerancia declarada para la deriva de Em sin aire con RK4: {tolText}. El arrastre del aire es un modelo simplificado con coeficiente constante; no se simula el rebote. El parámetro g del modo avanzado solo afecta a la pista.
        </Notice>
      </div>
    </div>
  );
}

export default function EnergyLab(props: LabProps) {
  // Indicador de característica: apagado, el laboratorio es exactamente la pista original.
  const [temporal] = useState(() => flag('energiaTemporal'));
  const [activity, setActivity] = useState<Activity>('pista');
  if (!temporal) return <TrackActivity {...props} />;
  return (
    <div className="stack">
      <Segmented<Activity> label="Actividad del laboratorio" value={activity} onChange={(v) => { setActivity(v); playSound('switch'); }}
        options={[
          { value: 'pista', label: 'Esfera en la pista con colinas' },
          { value: 'caida', label: 'Caída y lanzamiento vertical (integración en el tiempo)' },
        ]} />
      {activity === 'pista' ? <TrackActivity {...props} /> : <FallActivity {...props} />}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AMBIENT_T, CONDUCTION_INSTRUMENTS, CONDUCTION_LIMITS, RODS, RUN_S, SKIN, TACK_SLOTS_CM, TOUCH_MATERIALS, WAX_MELT_T,
  effusivity, finParams, findRod, findTouch, fourierFromProbes, simulateConduction, skinContact, slabHeatFlux, steadyTemperature,
  tackSummary, temperatureAt, thermocoupleReading, type CoverId, type RodId, type TouchId,
} from '../models/conduction';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { Chart } from '../components/Chart';
import { DataLogger, LoggerRunCharts, SensorCard } from '../components/DataLogger';
import type { LoggerChannel, LoggerRun } from '../lib/logger';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { SimControls, simStatusOf } from '../components/Experiment';
import { useMeasure } from '../components/Measurement';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, ContactShadow, Cube, Lcd, Ruler, Stopwatch, shade } from './kit';
import { DragHandle, Knob, ManipHint, ManipScene, Plunger, zoneAt } from './manipulate';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 900, H = 470;
const BENCH_Y = 440;
/** Varilla: x = 0 en la pared del baño; 19 px por cm (el grosor se dibuja ≈ 1,5 veces mayor que a escala). */
const PX_CM = 19;
const ROD_X0 = 200;
const ROD_X1 = ROD_X0 + 30 * PX_CM;
const ROD_Y = 236;
const ROD_R = 6;
const SLEEVE_R = 15;
const xOf = (cm: number) => ROD_X0 + cm * PX_CM;
/** Baño de agua (caja metálica con ventana en corte). */
const TANK = { x: 40, y: 168, w: 160, h: 124 };
const WIN = { x: TANK.x + 10, y: TANK.y + 10, w: TANK.w - 20, h: 74 };
const WATER_Y = WIN.y + 14;
/** Mechero y trípode. */
const BURNER_X = TANK.x + TANK.w / 2;
const GAUZE_Y = TANK.y + TANK.h + 4;
const BURNER_TOP = 352;
/** Gradilla de varillas. */
const RACK = { x: 236, y: 22, w: 330, slot: 46, top: 30, base: 112 };
const rackX = (i: number) => RACK.x + 24 + i * RACK.slot;
const RACK_EDGES = RODS.slice(1).map((_, i) => rackX(i) + RACK.slot / 2);
/** Registrador multicanal y termopares. */
const LOGGER = { x: 604, y: 18, w: 276, h: 100 };
const PROBE_HEAD_Y = [ROD_Y - 46, ROD_Y - 72, ROD_Y - 98];
const PORT_X = [LOGGER.x + 60, LOGGER.x + 138, LOGGER.x + 216];
const TC_COLOR = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
/** Bandeja donde caen las tachuelas y regla. */
const TRAY_Y = BENCH_Y - 10;
const RULER_Y = 318;
/** Animación: 30 min simulados en 10 s, con cámara lenta al principio (t_sim ∝ t_real²). */
const RUN_MS = 10000;
const FALL_MS = 420;
const simTimeAt = (ms: number) => RUN_S * Math.min(1, ms / RUN_MS) ** 2;
const realMsAt = (simT: number) => RUN_MS * Math.sqrt(Math.max(0, simT) / RUN_S);
const KNOB = { cx: 166, cy: 418 };

const clock = (s: number) => {
  const r = Math.round(s);
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const COVER_LABEL: Record<CoverId, string> = { aire: 'Aire (desnuda)', icopor: 'Funda de icopor' };
const RACK_LABEL: Record<RodId, string> = { cobre: 'Cobre', aluminio: 'Aluminio', laton: 'Latón', hierro: 'Hierro', inox: 'Inox.', vidrio: 'Vidrio', madera: 'Madera' };
type Indicator = 'tachuelas' | 'cinta';

/** Color de una cinta termocrómica de cristal líquido (30–60 °C): negra fuera del rango, de rojo a azul dentro. */
function lcColor(T: number): string {
  if (T < 30) return '#2b2521';
  if (T > 60) return '#2a2466';
  const f = (T - 30) / 30;
  return `hsl(${Math.round(240 * f)}, 82%, ${Math.round(44 + 6 * Math.sin(Math.PI * f))}%)`;
}

/** Sensación aproximada según la temperatura de contacto con la piel. */
function sensation(Tc: number): string {
  if (Tc >= 45) return 'quema (dolor)';
  if (Tc >= 36) return 'caliente';
  if (Tc >= 30) return 'neutra o tibia';
  if (Tc >= 20) return 'fría';
  return 'muy fría';
}

/* ------------------------------------------------------------------ piezas locales */

function ConDefs() {
  return (
    <defs>
      <pattern id="con-foam" width="7" height="7" patternUnits="userSpaceOnUse">
        <rect width="7" height="7" fill="#f6f5ef" />
        <circle cx="2" cy="2" r="1.7" fill="#ffffff" stroke="#d6d2c2" strokeWidth="0.4" />
        <circle cx="5.5" cy="5.2" r="1.5" fill="#fbfaf6" stroke="#d6d2c2" strokeWidth="0.4" />
      </pattern>
      <linearGradient id="con-cyl" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="0.3" stopColor="#fff" stopOpacity="0.12" />
        <stop offset="0.6" stopColor="#000" stopOpacity="0.05" />
        <stop offset="1" stopColor="#000" stopOpacity="0.32" />
      </linearGradient>
      <linearGradient id="con-flame" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stopColor="#2f6fe0" stopOpacity="0.95" />
        <stop offset="0.55" stopColor="#6fa3ff" stopOpacity="0.7" />
        <stop offset="1" stopColor="#c9dcff" stopOpacity="0.15" />
      </linearGradient>
      <linearGradient id="con-flame-in" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stopColor="#bfe3ff" />
        <stop offset="1" stopColor="#7fb4ff" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="con-rubber" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#7a3b2e" />
        <stop offset="0.5" stopColor="#a4553f" />
        <stop offset="1" stopColor="#6a3226" />
      </linearGradient>
    </defs>
  );
}

/** Varilla horizontal con el acabado de su material, entre x0 y x1, centrada en y. */
function RodBody({ id, x0, x1, y, r }: { id: RodId; x0: number; x1: number; y: number; r: number }) {
  const m = findRod(id);
  const len = x1 - x0;
  if (id === 'vidrio') {
    return (
      <g>
        <rect x={x0} y={y - r} width={len} height={2 * r} rx={r} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
        <rect x={x0} y={y - r} width={len} height={2 * r} rx={r} fill="#bfe3ea" opacity="0.35" />
        <line x1={x0 + 4} x2={x1 - 4} y1={y - r * 0.45} y2={y - r * 0.45} stroke="#fff" strokeWidth="1.6" opacity="0.75" />
      </g>
    );
  }
  if (id === 'madera') {
    return (
      <g>
        <rect x={x0} y={y - r} width={len} height={2 * r} rx={r * 0.6} fill="url(#kit-wood)" stroke="#9a7440" strokeWidth="0.9" />
        {[0.35, 0.62].map((f, i) => (
          <path key={f} d={`M${x0 + 3} ${y - r + 2 * r * f} Q${x0 + len * 0.3} ${y - r + 2 * r * f - 1.2} ${x0 + len * 0.55} ${y - r + 2 * r * f + (i ? 0.8 : -0.6)} T${x1 - 3} ${y - r + 2 * r * f}`} fill="none" stroke="#a37a43" strokeWidth="0.7" opacity="0.7" />
        ))}
        <rect x={x0} y={y - r} width={len} height={2 * r} rx={r * 0.6} fill="url(#con-cyl)" opacity="0.6" />
      </g>
    );
  }
  return (
    <g>
      <rect x={x0} y={y - r} width={len} height={2 * r} rx={r * 0.5} fill={m.color} stroke={shade(m.color, -0.45)} strokeWidth="0.9" />
      <rect x={x0} y={y - r} width={len} height={2 * r} rx={r * 0.5} fill="url(#con-cyl)" />
      <line x1={x0 + 3} x2={x1 - 3} y1={y - r * 0.5} y2={y - r * 0.5} stroke="#fff" strokeWidth="1.1" opacity="0.55" />
    </g>
  );
}

/** Chinche (tachuela) pegada con cera colgando de la varilla, o cayendo/caída en la bandeja. */
function Tack({ x, hangY, fall, melted, landDx }: { x: number; hangY: number; fall: number; melted: boolean; landDx: number }) {
  const q = clamp01(fall);
  const landY = TRAY_Y - 4;
  const y = hangY + (landY - hangY) * q * q;
  const tx = x + landDx * q;
  const rot = 90 * clamp01((q - 0.75) / 0.25);
  return (
    <g>
      {/* gota de cera: se ablanda y escurre al pasar de 55 °C */}
      <ellipse cx={x} cy={hangY - 10} rx={melted ? 4.5 : 6} ry={melted ? 3 : 4.2} fill={melted ? '#efe3b8' : '#f5eed6'} stroke="#c9b98a" strokeWidth="0.7" opacity={melted ? 0.85 : 1} />
      {melted && <path d={`M${x + 1.5} ${hangY - 7} q1 4 0 7`} fill="none" stroke="#e6d7a4" strokeWidth="2" strokeLinecap="round" />}
      <g transform={`rotate(${rot} ${tx} ${y})`}>
        <line x1={tx} x2={tx} y1={y - 12} y2={y} stroke="#7d878c" strokeWidth="1.3" />
        <ellipse cx={tx} cy={y + 1.5} rx={7} ry={2.8} fill="url(#kit-metal)" stroke="#6f7a7f" strokeWidth="0.7" />
      </g>
    </g>
  );
}

/** Mano estilizada que toca hacia abajo; (cx, tip) = centro de las yemas. */
function Hand({ cx, tip }: { cx: number; tip: number }) {
  const skin = '#e3a983', edge = '#b97c58';
  const palmY = tip - 46;
  return (
    <g>
      <rect x={cx - 24} y={palmY - 70} width={48} height={50} rx={8} fill="#5d7fa6" stroke="#3f5d80" strokeWidth="1" />
      <rect x={cx - 26} y={palmY - 26} width={52} height={10} rx={4} fill="#4b6b90" />
      <rect x={cx - 25} y={palmY - 18} width={50} height={36} rx={13} fill={skin} stroke={edge} strokeWidth="1" />
      {[-18, -6, 6, 18].map((dx, i) => {
        const len = [22, 27, 26, 20][i];
        return <rect key={dx} x={cx + dx - 5} y={tip - len} width={10} height={len} rx={5} fill={skin} stroke={edge} strokeWidth="0.9" />;
      })}
      <rect x={cx - 38} y={palmY - 6} width={11} height={26} rx={5.5} fill={skin} stroke={edge} strokeWidth="0.9" transform={`rotate(-28 ${cx - 32} ${palmY + 6})`} />
      <path d={`M${cx - 14} ${palmY + 4} q14 6 28 0`} fill="none" stroke={edge} strokeWidth="0.8" opacity="0.6" />
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

type Phase = 'listo' | 'midiendo' | 'pausa' | 'medido';

export default function ConductionLab({ api }: LabProps) {
  const [rodId, setRodId] = useState<RodId>('cobre');
  const [cover, setCover] = useState<CoverId>('aire');
  const [indicator, setIndicator] = useState<Indicator>('tachuelas');
  const [bathT, setBathT] = useState(90);
  const [nTacks, setNTacks] = useState(TACK_SLOTS_CM.length);
  const [probes, setProbes] = useState<[number, number, number]>([5, 15, 25]);
  const [phase, setPhase] = useState<Phase>('listo');
  const [elapsed, setElapsed] = useState(0);
  const [sensorRun, setSensorRun] = useState<LoggerRun | null>(null);
  const [touchId, setTouchId] = useState<TouchId>('cobre');
  const [objectT, setObjectT] = useState(AMBIENT_T);
  const [touching, setTouching] = useState(false);
  const [touched, setTouched] = useState<TouchId[]>([]);
  const raf = useRef(0);
  const clinked = useRef<Set<number>>(new Set());
  const rackPick = useRef<number | null>(null);

  const rod = findRod(rodId);
  const rodIndex = RODS.findIndex((r) => r.id === rodId);
  const running = phase === 'midiendo';
  const done = phase === 'medido';
  useSoundLoop('burner', running, 0.35 + 0.65 * ((bathT - 40) / 58));

  const sim = useMemo(() => simulateConduction({ rod: rodId, cover, bathT }), [rodId, cover, bathT]);
  const steady = useMemo(() => finParams(sim.problem), [sim]);

  // Instrumentos: ficha de la práctica si está integrada; si no, la del modelo (modo real con la misma incertidumbre).
  const tcSpec = INSTRUMENTS.conduccion?.find((i) => i.id === 'termopar') ?? CONDUCTION_INSTRUMENTS[0];
  const clockSpec = INSTRUMENTS.conduccion?.find((i) => i.id === 'cronometro') ?? CONDUCTION_INSTRUMENTS[1];
  const rulerSpec = INSTRUMENTS.conduccion?.find((i) => i.id === 'regla') ?? CONDUCTION_INSTRUMENTS[2];
  const { measure, remeasure } = useMeasure();
  const readings = useMemo(() => {
    const pos = probes.map((x, i) => measure(x, { ...rulerSpec, key: `x${i + 1}` }));
    const temps = probes.map((x, i) => measure(temperatureAt(sim.solution, x / 100, RUN_S), { ...tcSpec, key: `tc${i + 1}` }));
    const falls = sim.solution.tackFall.map((t, i) => (t === null ? null : Math.max(0, measure(t, { ...clockSpec, key: `caida${i + 1}` }))));
    return { pos, temps, falls, bath: measure(bathT, { ...tcSpec, key: 'tBano' }) };
  }, [measure, rulerSpec, tcSpec, clockSpec, probes, sim, bathT]);
  const tacks = useMemo(() => tackSummary(sim.solution.tackFall, nTacks), [sim, nTacks]);
  const fourier = useMemo(() => fourierFromProbes(rod.k, readings.pos[0], readings.temps[0], readings.pos[1], readings.temps[1]), [rod, readings]);

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setElapsed(0); };
  useEffect(reset, [rodId, cover, bathT, nTacks, probes]);

  useEffect(() => {
    if (phase !== 'midiendo') return;
    if (prefersReducedMotion()) { setElapsed(RUN_MS); setPhase('medido'); return; }
    // Al reanudar tras una pausa, el reloj sigue desde el tiempo ya transcurrido.
    const start = performance.now() - elapsed;
    const tick = (now: number) => {
      const e = Math.min(RUN_MS, Math.max(0, now - start));
      setElapsed(e);
      // «Clin» de cada tachuela al llegar a la bandeja.
      const tNow = simTimeAt(e);
      sim.solution.tackFall.forEach((tf, i) => {
        if (i >= nTacks || tf === null || clinked.current.has(i) || tf > tNow) return;
        clinked.current.add(i);
        playSound('clank', { intensity: 0.22, delay: FALL_MS / 1000, pan: ((xOf(TACK_SLOTS_CM[i]) - W / 2) / W) * 1.4 });
      });
      if (e >= RUN_MS) { setPhase('medido'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    cancelAnimationFrame(raf.current);
    remeasure('x1', 'x2', 'x3', 'tc1', 'tc2', 'tc3', 'tBano', ...TACK_SLOTS_CM.map((_, i) => `caida${i + 1}`));
    clinked.current = new Set();
    setElapsed(0);
    setPhase('midiendo');
    playSound('click');
  };

  const setProbe = (i: number, v: number) => setProbes((p) => { const n = [...p] as [number, number, number]; n[i] = v; return n; });

  /* --------------------------- estado del dibujo */
  const simT = phase === 'listo' ? 0 : done ? RUN_S : simTimeAt(elapsed);
  const realNow = phase === 'listo' ? -1 : done ? Infinity : elapsed;
  const liveT = probes.map((x) => thermocoupleReading(temperatureAt(sim.solution, x / 100, simT)));
  const lcdT = done ? readings.temps : liveT;
  const flame = (bathT - 40) / 58;
  const flick = running ? 1 + 0.05 * Math.sin(elapsed / 55) + 0.03 * Math.sin(elapsed / 23) : 1;
  const flameH = (16 + 30 * flame) * flick;
  const covered = cover === 'icopor';
  const hangY = ROD_Y + (covered ? SLEEVE_R : ROD_R) + 18;
  const lcStops = useMemo(() => Array.from({ length: 31 }, (_, cm) => ({ off: cm / 30, color: lcColor(temperatureAt(sim.solution, cm / 100, simT)) })), [sim, simT]);

  /* --------------------------- textos */
  const show = (text: string) => (done ? text : '—');
  const firstFall = nTacks >= 1 ? readings.falls[0] : null;
  const fallText = nTacks < 1 ? 'no hay tachuela a 3 cm' : firstFall === null ? 'no cayó en 30 min' : `${fmt(firstFall, 0)} s`;
  const alphaMm = sim.alpha * 1e6;
  const alphaText = `${fmt(alphaMm, alphaMm < 10 ? 2 : 1)} mm²/s`;
  const conditions = `${rod.short} · ${COVER_LABEL[cover].toLowerCase()} · baño a ${fmt(bathT, 0)} °C · termopares en ${probes.map((p) => fmt(p, 1)).join('; ')} cm`;

  const record = () => api.addTrial('conduccion', {
    material: rod.short, funda: covered ? 'Icopor' : 'Aire', tBano: bathT, k: rod.k, alfa: Number(alphaMm.toFixed(3)), nTachuelas: nTacks,
    x1: probes[0], x2: probes[1], x3: probes[2],
    T1: readings.temps[0], T2: readings.temps[1], T3: readings.temps[2],
    tCaida: firstFall, nCaidas: tacks.fallen, xFrente: tacks.farthest,
    grad: fourier ? Number(fourier.gradient.toFixed(3)) : null,
    qFourier: fourier ? Number(fourier.q.toFixed(3)) : null,
  });

  const sensorChannels = useMemo<LoggerChannel[]>(() => probes.map((x, i) => ({
    id: `tc${i + 1}`, name: `Termopar ${i + 1} (${fmt(x, 1)} cm)`, unit: '°C', resolution: 0.1, noise: tcSpec.sigma ?? 0.3, min: -50, max: 400,
    color: TC_COLOR[i], sample: (t: number) => temperatureAt(sim.solution, x / 100, t),
  })), [probes, sim, tcSpec]);

  const desc = done
    ? `Después de 30 min, los termopares marcan ${readings.temps.map((T, i) => `${fmt(T, 1)} °C a ${fmt(probes[i], 1)} cm`).join(', ')}. Cayeron ${tacks.fallen} de ${nTacks} tachuelas; la más lejana estaba a ${fmt(tacks.farthest, 0)} cm.`
    : running || phase === 'pausa'
      ? `La varilla de ${rod.short.toLowerCase()} se calienta${phase === 'pausa' ? ' (en pausa)' : ''}: tiempo ${clock(simT)}; termopar 1 en ${fmt(liveT[0], 1)} °C.`
      : `Varilla de ${rod.name.toLowerCase()} de 30 cm (${covered ? 'con funda de icopor' : 'desnuda'}) con un extremo en un baño de agua a ${fmt(bathT, 0)} °C calentado por un mechero, ${indicator === 'cinta' ? 'con una cinta termocrómica' : `con ${nTacks} tachuelas pegadas con cera`} y tres termopares en ${probes.map((p) => fmt(p, 1)).join(', ')} cm conectados a un registrador.`;

  /* --------------------------- gráficas */
  const timeSeries = useMemo(() => {
    const times = sim.solution.times;
    return probes.map((x) => times.map((t) => ({ x: t, y: thermocoupleReading(temperatureAt(sim.solution, x / 100, t)) })));
  }, [sim, probes]);
  const nextIdx = sim.solution.times.findIndex((t) => t > simT);
  const shownTimes = phase === 'listo' ? 0 : done || nextIdx < 0 ? timeSeries[0].length : nextIdx;
  const profileModel = useMemo(() => Array.from({ length: 61 }, (_, i) => ({ x: i / 2, y: temperatureAt(sim.solution, i / 200, RUN_S) })), [sim]);
  const profileSteady = useMemo(() => Array.from({ length: 61 }, (_, i) => ({ x: i / 2, y: steadyTemperature(steady, i / 200) })), [steady]);
  const probePoints = phase === 'listo' ? [] : (done ? readings.temps : liveT).map((T, i) => ({ x: done ? readings.pos[i] : probes[i], y: T, label: `Termopar ${i + 1}` }));

  /* --------------------------- tacto */
  const eSkin = effusivity(SKIN);
  const touchMat = findTouch(touchId);
  const Tc = skinContact(touchId, objectT);
  const touchNow = () => { setTouching(true); setTouched((s) => (s.includes(touchId) ? s : [...s, touchId])); playSound('tick', { intensity: 0.4 }); };
  const release = () => setTouching(false);
  const lo = Math.min(objectT, SKIN.T) - 1.5, hi = Math.max(objectT, SKIN.T) + 1.5;
  const barX = (T: number) => 300 + ((T - lo) / (hi - lo)) * 196;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo de la conducción del calor">
          <ManipScene viewBox={`0 0 ${W} ${H}`} label="Controles de la varilla, el mechero, las tachuelas y los termopares" scene={
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="con-t con-d">
            <title id="con-t">Varilla con un extremo en un baño caliente, tachuelas pegadas con cera, termopares y registrador de datos</title>
            <desc id="con-d">{desc}</desc>
            <ConDefs />
            <defs>
              <linearGradient id="con-lc" x1="0" x2="1" y1="0" y2="0">
                {lcStops.map((s) => <stop key={s.off} offset={s.off} stopColor={s.color} />)}
              </linearGradient>
              <clipPath id="con-win"><rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={4} /></clipPath>
            </defs>
            <BenchTop y={BENCH_Y} width={W} />

            {/* gradilla de varillas */}
            <g>
              <ContactShadow x={RACK.x} y={RACK.base + 12} w={RACK.w} h={6} opacity={0.6} />
              {RODS.map((r, i) => i === rodIndex
                ? <ellipse key={r.id} cx={rackX(i)} cy={RACK.base} rx={7} ry={2.5} fill="#5b4422" opacity="0.7" />
                : (
                  <g key={r.id} transform={`rotate(-90 ${rackX(i)} ${RACK.base})`}>
                    <RodBody id={r.id} x0={rackX(i)} x1={rackX(i) + RACK.base - RACK.top} y={RACK.base} r={5} />
                  </g>
                ))}
              <rect x={RACK.x} y={RACK.base} width={RACK.w} height={12} rx={3} fill="url(#kit-wood)" stroke="#b8975a" filter="url(#kit-shadow-soft)" />
              {RODS.map((r, i) => (
                <text key={r.id} x={rackX(i)} y={RACK.base + 26} textAnchor="middle" style={{ fontSize: 9.5, fill: i === rodIndex ? 'var(--ink)' : 'var(--ink-2)', fontWeight: i === rodIndex ? 700 : 500 }}>{RACK_LABEL[r.id]}</text>
              ))}
              <text x={RACK.x} y={RACK.y - 6} style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 600 }}>Gradilla de varillas (30 cm · Ø 8 mm)</text>
            </g>

            {/* cronómetro */}
            <Stopwatch x={46} y={34} text={clock(simT)} label="tiempo" />

            {/* trípode, rejilla y mechero */}
            <g>
              <line x1={TANK.x + 8} y1={GAUZE_Y + 2} x2={TANK.x - 6} y2={BENCH_Y} stroke="#59656a" strokeWidth="4" strokeLinecap="round" />
              <line x1={TANK.x + TANK.w - 8} y1={GAUZE_Y + 2} x2={TANK.x + TANK.w + 6} y2={BENCH_Y} stroke="#59656a" strokeWidth="4" strokeLinecap="round" />
              <rect x={TANK.x - 10} y={GAUZE_Y} width={TANK.w + 20} height={5} rx={1.5} fill="url(#kit-metal)" stroke="#7d898d" strokeWidth="0.6" />
              <rect x={TANK.x + 30} y={GAUZE_Y + 0.5} width={TANK.w - 60} height={4} fill="#c9c3b8" opacity="0.9" />
              <ContactShadow x={BURNER_X - 34} y={BENCH_Y} w={68} h={8} />
              <path d={`M${BURNER_X - 32} ${BENCH_Y} L${BURNER_X - 26} ${BENCH_Y - 14} L${BURNER_X + 26} ${BENCH_Y - 14} L${BURNER_X + 32} ${BENCH_Y} Z`} fill="url(#kit-body-dark)" />
              <rect x={BURNER_X - 8} y={BURNER_TOP} width={16} height={BENCH_Y - 14 - BURNER_TOP} fill="url(#kit-metal-h)" stroke="#7d898d" strokeWidth="0.6" />
              <rect x={BURNER_X - 10} y={BENCH_Y - 40} width={20} height={9} rx={2} fill="url(#kit-metal-h)" stroke="#7d898d" strokeWidth="0.6" />
              <path d={`M${BURNER_X - 32} ${BENCH_Y - 6} C ${BURNER_X - 60} ${BENCH_Y - 6}, ${8} ${BENCH_Y - 2}, ${0} ${BENCH_Y - 4}`} fill="none" stroke="#c0542f" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
              {/* llama: azul (combustión completa), más alta con más gas */}
              <path d={`M${BURNER_X - 9} ${BURNER_TOP} Q${BURNER_X - 12} ${BURNER_TOP - flameH * 0.55} ${BURNER_X} ${BURNER_TOP - flameH} Q${BURNER_X + 12} ${BURNER_TOP - flameH * 0.55} ${BURNER_X + 9} ${BURNER_TOP} Z`} fill="url(#con-flame)" />
              <path d={`M${BURNER_X - 5} ${BURNER_TOP} Q${BURNER_X - 6} ${BURNER_TOP - flameH * 0.3} ${BURNER_X} ${BURNER_TOP - flameH * 0.48} Q${BURNER_X + 6} ${BURNER_TOP - flameH * 0.3} ${BURNER_X + 5} ${BURNER_TOP} Z`} fill="url(#con-flame-in)" />
              <text x={BURNER_X - 46} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>Mechero</text>
            </g>

            {/* baño de agua caliente (caja metálica con ventana en corte) */}
            <g>
              <g filter="url(#kit-shadow)">
                <rect x={TANK.x} y={TANK.y} width={TANK.w} height={TANK.h} rx={6} fill="url(#kit-metal-h)" stroke="#7d898d" />
              </g>
              <rect x={TANK.x - 4} y={TANK.y - 8} width={TANK.w + 8} height={10} rx={3} fill="url(#kit-metal)" stroke="#7d898d" strokeWidth="0.8" />
              <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={4} fill="#e6eef1" stroke="#7d898d" strokeWidth="0.8" />
              <g clipPath="url(#con-win)">
                <rect x={WIN.x} y={WATER_Y} width={WIN.w} height={WIN.h} fill="#7fbfe0" opacity="0.55" />
                <rect x={WIN.x} y={WATER_Y} width={WIN.w} height={WIN.h} fill="url(#kit-liquid-shade)" />
                <line x1={WIN.x} x2={WIN.x + WIN.w} y1={WATER_Y} y2={WATER_Y} stroke={shade('#7fbfe0', -0.35)} strokeWidth="1.3" />
                <RodBody id={rodId} x0={TANK.x + TANK.w - 58} x1={TANK.x + TANK.w + 2} y={ROD_Y} r={ROD_R} />
                {bathT >= 94 && [0, 1, 2, 3, 4, 5].map((i) => {
                  const rise = running ? ((elapsed / 9 + i * 13) % 50) : (i * 9) % 50;
                  return <circle key={i} cx={WIN.x + 14 + i * 22} cy={WIN.y + WIN.h - 4 - rise} r={1.6 + (i % 3) * 0.6} fill="#fff" opacity="0.75" />;
                })}
              </g>
              <path d={`M${WIN.x} ${WIN.y} h${WIN.w}`} stroke="#fff" strokeWidth="1" opacity="0.5" />
              <Lcd x={TANK.x + 14} y={TANK.y + TANK.h - 32} w={96} h={24} text={fmt(readings.bath, 1)} unit="°C" />
              <text x={TANK.x + 140} y={TANK.y + TANK.h - 15} textAnchor="end" style={{ fontSize: 8, fill: '#33403f', fontWeight: 700 }}>BAÑO</text>
              {/* tapón de caucho en la pared */}
              <path d={`M${ROD_X0 - 8} ${ROD_Y - 12} L${ROD_X0 + 6} ${ROD_Y - 10} L${ROD_X0 + 6} ${ROD_Y + 10} L${ROD_X0 - 8} ${ROD_Y + 12} Z`} fill="url(#con-rubber)" stroke="#4c2219" strokeWidth="0.7" />
              {bathT >= 60 && [0, 1, 2].map((i) => {
                const drift = running ? Math.sin(elapsed / 400 + i) * 4 : 0;
                return <path key={i} d={`M${TANK.x + 36 + i * 42 + drift} ${TANK.y - 12} q-8 -12 0 -24 q8 -11 0 -24`} fill="none" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" opacity={0.15 + 0.25 * ((bathT - 60) / 38)} />;
              })}
            </g>

            {/* regla y bandeja */}
            <Ruler x={ROD_X0 - 10} y={RULER_Y} cm={30} pxPerCm={PX_CM} labelEvery={3} />
            <g>
              <ContactShadow x={ROD_X0 + 4} y={BENCH_Y} w={ROD_X1 - ROD_X0 - 8} h={7} opacity={0.7} />
              <path d={`M${ROD_X0 + 4} ${TRAY_Y} L${ROD_X0 + 10} ${BENCH_Y} L${ROD_X1 - 10} ${BENCH_Y} L${ROD_X1 - 4} ${TRAY_Y} Z`} fill="url(#kit-metal)" stroke="#7d898d" strokeWidth="0.8" />
              <text x={ROD_X1 - 8} y={BENCH_Y + 24} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>Bandeja para las tachuelas</text>
            </g>

            {/* soporte de la punta con mordazas de madera */}
            <g>
              <rect x={ROD_X1 + 22} y={BENCH_Y - 8} width={64} height={8} rx={2} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
              <rect x={ROD_X1 + 49} y={ROD_Y - 40} width={6} height={BENCH_Y - 8 - (ROD_Y - 40)} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.5" />
              <rect x={ROD_X1 - 4} y={ROD_Y - 2} width={58} height={4} rx={2} fill="url(#kit-metal)" stroke="#8a969a" strokeWidth="0.5" />
              <rect x={ROD_X1 + 46} y={ROD_Y - 7} width={12} height={14} rx={2} fill="#3b4648" />
            </g>

            {/* varilla montada (con funda de icopor en corte si corresponde) */}
            <RodBody id={rodId} x0={ROD_X0 + 6} x1={ROD_X1} y={ROD_Y} r={ROD_R} />
            {indicator === 'cinta' && (
              <g>
                <rect x={ROD_X0 + 6} y={ROD_Y - 3.5} width={ROD_X1 - ROD_X0 - 20} height={7} rx={1.5} fill="url(#con-lc)" stroke="#1c1c1c" strokeWidth="0.5" />
                <rect x={ROD_X0 + 6} y={ROD_Y - 3.5} width={ROD_X1 - ROD_X0 - 20} height={3} fill="#fff" opacity="0.18" />
              </g>
            )}
            {covered && (
              <g>
                <rect x={ROD_X0 + 8} y={ROD_Y - SLEEVE_R} width={ROD_X1 - ROD_X0 - 26} height={2 * SLEEVE_R} rx={SLEEVE_R} fill="url(#con-foam)" opacity="0.62" stroke="#bdbbb0" strokeWidth="0.8" />
                <rect x={ROD_X0 + 8} y={ROD_Y - SLEEVE_R} width={ROD_X1 - ROD_X0 - 26} height={2 * SLEEVE_R} rx={SLEEVE_R} fill="url(#con-cyl)" opacity="0.5" />
              </g>
            )}
            <rect x={ROD_X1 - 16} y={ROD_Y - 10} width={14} height={20} rx={2} fill="url(#kit-wood)" stroke="#9a7440" strokeWidth="0.7" />

            {/* tachuelas */}
            {indicator === 'tachuelas' && TACK_SLOTS_CM.slice(0, nTacks).map((cm, i) => {
              const tf = sim.solution.tackFall[i];
              const fallStart = tf === null ? Infinity : realMsAt(tf);
              const fall = phase === 'listo' || tf === null ? 0 : done ? 1 : clamp01((realNow - fallStart) / FALL_MS);
              const melted = phase !== 'listo' && tf !== null && (done || realNow >= fallStart);
              const ft = readings.falls[i];
              return (
                <g key={cm}>
                  <Tack x={xOf(cm)} hangY={hangY} fall={fall} melted={melted} landDx={((i * 37) % 11) - 5} />
                  {fall >= 1 && ft !== null && (
                    <text x={xOf(cm)} y={TRAY_Y - 12} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 600 }}>{clock(ft)}</text>
                  )}
                </g>
              );
            })}
            {indicator === 'cinta' && (
              <g aria-hidden="true">
                <text x={ROD_X0 + 6} y={ROD_Y + 34} style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>Cinta termocrómica:</text>
                {[25, 30, 35, 40, 45, 50, 55, 60, 65].map((T, i) => (
                  <g key={T}>
                    <rect x={ROD_X0 + 100 + i * 36} y={ROD_Y + 25} width={34} height={10} fill={lcColor(T)} stroke="#1c1c1c" strokeWidth="0.4" />
                    <text x={ROD_X0 + 117 + i * 36} y={ROD_Y + 46} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{T === 25 ? '< 30' : T === 65 ? '> 60' : T}</text>
                  </g>
                ))}
                <text x={ROD_X0 + 100 + 9 * 36 + 4} y={ROD_Y + 34} style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>°C</text>
              </g>
            )}

            {/* registrador multicanal y termopares */}
            <g>
              {probes.map((x, i) => {
                const hx = xOf(x), hy = PROBE_HEAD_Y[i];
                return (
                  <path key={i} d={`M${PORT_X[i]} ${LOGGER.y + LOGGER.h} C ${PORT_X[i]} ${LOGGER.y + LOGGER.h + 40}, ${hx} ${hy - 50}, ${hx} ${hy - 11}`} fill="none" stroke={TC_COLOR[i]} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
                );
              })}
              <g filter="url(#kit-shadow-soft)">
                <rect x={LOGGER.x} y={LOGGER.y} width={LOGGER.w} height={LOGGER.h} rx={10} fill="url(#kit-body-dark)" />
              </g>
              <text x={LOGGER.x + 12} y={LOGGER.y + 16} style={{ fontSize: 8.5, fill: '#c9d2d5', letterSpacing: 1 }}>REGISTRADOR · 3 TERMOPARES TIPO K</text>
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <Lcd x={LOGGER.x + 10 + i * 88} y={LOGGER.y + 26} w={80} h={30} text={phase === 'listo' ? fmt(AMBIENT_T, 1) : fmt(lcdT[i], 1)} unit="°C" />
                  <rect x={LOGGER.x + 10 + i * 88} y={LOGGER.y + 62} width={80} height={5} rx={2} fill={TC_COLOR[i]} />
                  <text x={LOGGER.x + 50 + i * 88} y={LOGGER.y + 80} textAnchor="middle" style={{ fontSize: 9, fill: '#e4ebed', fontWeight: 700 }}>T{i + 1}</text>
                  <circle cx={PORT_X[i]} cy={LOGGER.y + LOGGER.h - 4} r={3.4} fill="#11181a" stroke="#6d7b80" />
                </g>
              ))}
              {probes.map((x, i) => {
                const hx = xOf(x), hy = PROBE_HEAD_Y[i];
                const bottom = ROD_Y - (covered ? 2 : ROD_R);
                return (
                  <g key={i}>
                    <line x1={hx} x2={hx} y1={hy + 11} y2={bottom} stroke="#8e999e" strokeWidth="1.6" />
                    <circle cx={hx} cy={bottom} r={2.6} fill="#3b4648" stroke={TC_COLOR[i]} strokeWidth="1.2" />
                    <rect x={hx - 6} y={hy - 11} width={12} height={22} rx={3} fill="url(#kit-body-dark)" />
                    <rect x={hx - 6} y={hy - 3} width={12} height={5} fill={TC_COLOR[i]} />
                    <text x={hx + 10} y={hy + 4} style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700 }}>T{i + 1}</text>
                  </g>
                );
              })}
            </g>

            <text x={ROD_X0 + 285} y={RULER_Y + 50} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink)', fontWeight: 600 }}>
              Varilla de {rod.short.toLowerCase()} {covered ? 'con funda de icopor' : 'desnuda'} · k = {fmt(rod.k, rod.k < 10 ? 2 : 0)} W/(m·K) · α = {alphaText}
            </text>
            <text x={ROD_X0 + 285} y={RULER_Y + 64} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>
              La cera de las tachuelas se ablanda a {fmt(WAX_MELT_T, 0)} °C · aire del salón a {fmt(AMBIENT_T, 0)} °C
            </text>
          </svg>}>
            <Knob label="Perilla del mechero: temperatura del baño" cx={KNOB.cx} cy={KNOB.cy} r={10} value={bathT} min={CONDUCTION_LIMITS.bathT[0]} max={CONDUCTION_LIMITS.bathT[1]} step={1} pageStep={5} unit="°C" decimals={0} disabled={running} onChange={setBathT} />
            <DragHandle label="Gradilla: varilla montada en el baño" value={rodIndex} min={0} max={RODS.length - 1} step={1} pageStep={1} commit="end" disabled={running}
              hit={{ x: RACK.x, y: RACK.top - 6, w: RACK.w, h: RACK.base - RACK.top + 20 }}
              valueText={(v) => `${RODS[v].name} montada en el baño`}
              valueFromPoint={({ point, start }) => (point.y > ROD_Y - 70 && point.y < ROD_Y + 60 && point.x > TANK.x && point.x < ROD_X1 + 40 ? zoneAt(start.x, RACK_EDGES) : rodIndex)}
              onChange={(v) => setRodId(RODS[v].id)}>
              {({ dragging, point }) => {
                if (!dragging || !point) { rackPick.current = null; return null; }
                if (rackPick.current === null) rackPick.current = zoneAt(point.x, RACK_EDGES);
                const pick = RODS[rackPick.current];
                const over = point.y > ROD_Y - 70 && point.y < ROD_Y + 60;
                return (
                  <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                    <rect x={ROD_X0 - 14} y={ROD_Y - 26} width={ROD_X1 - ROD_X0 + 28} height={52} rx={10} fill="var(--accent)" opacity={over ? 0.16 : 0.05} />
                    <RodBody id={pick.id} x0={point.x - 70} x1={point.x + 70} y={point.y} r={ROD_R} />
                  </g>
                );
              }}
            </DragHandle>
            <DragHandle label="Tachuelas con cera: cuántas hay pegadas a lo largo de la varilla" value={nTacks} min={0} max={TACK_SLOTS_CM.length} step={1} pageStep={3}
              disabled={running || indicator !== 'tachuelas'} affordance={phase === 'listo' && indicator === 'tachuelas'}
              hit={{ x: ROD_X0 + 20, y: ROD_Y + 10, w: ROD_X1 - ROD_X0 - 30, h: 34 }}
              valueText={(v) => (v === 0 ? 'Sin tachuelas' : `${v} tachuelas, de 3 a ${TACK_SLOTS_CM[v - 1]} cm`)}
              valueFromPoint={({ point }) => Math.max(0, Math.min(TACK_SLOTS_CM.length, Math.round((point.x - ROD_X0) / (3 * PX_CM))))} onChange={setNTacks} />
            {probes.map((x, i) => (
              <Plunger key={i} label={`Termopar ${i + 1}: posición sobre la varilla`} value={x} min={CONDUCTION_LIMITS.position[0]} max={CONDUCTION_LIMITS.position[1]} step={0.5} pageStep={5}
                unit="cm" decimals={1} disabled={running} from={{ x: ROD_X0, y: PROBE_HEAD_Y[i] }} to={{ x: ROD_X1, y: PROBE_HEAD_Y[i] }} size={26}
                onChange={(v) => setProbe(i, v)} />
            ))}
          </ManipScene>
        </div>
        <ManipHint>Arrastra una varilla de la gradilla al tapón del baño, gira la perilla del mechero, desliza los termopares (T1, T2, T3) a lo largo de la varilla y arrastra bajo la varilla para poner o quitar tachuelas; también puedes enfocarlos con Tab y usar las flechas.</ManipHint>

        <div className="grid-2">
          <div className="stack">
            <h3>Termopares a los 30 min</h3>
            <Readout items={[
              ...probes.map((x, i) => ({ k: `Termopar ${i + 1} (x = ${fmt(done ? readings.pos[i] : x, 1)} cm)`, v: show(`${fmt(readings.temps[i], 1)} °C`), data: true })),
              { k: 'Temperatura del baño', v: `${fmt(readings.bath, 1)} °C`, data: true },
            ]} />
            <h3>Ley de Fourier (termopares 1 y 2)</h3>
            <Readout items={[
              { k: 'Gradiente de temperatura ΔT/Δx', v: show(fourier ? `${fmt(fourier.gradient, 2)} °C/cm` : 'termopares demasiado cerca'), data: true },
              { k: 'Flujo de calor q = −k·A·ΔT/Δx', v: show(fourier ? `${fmt(fourier.q, 3)} W` : '—'), data: true },
              { k: 'Calor que entra por la base en estado estacionario (modelo)', v: show(`${fmt(sim.qSteady, 2)} W`) },
            ]} />
          </div>
          <div className="stack">
            <h3>Tachuelas con cera</h3>
            <Readout items={[
              { k: 'Tachuelas caídas', v: show(indicator === 'tachuelas' ? `${fmt(tacks.fallen, 0)} de ${fmt(nTacks, 0)}` : 'se usó la cinta termocrómica'), data: true },
              { k: 'Tiempo de caída de la tachuela a 3 cm', v: show(fallText), data: true },
              { k: 'Tachuela más lejana que cayó', v: show(tacks.fallen ? `${fmt(tacks.farthest, 0)} cm` : 'ninguna'), data: true },
            ]} />
            <h3>Propiedades del material</h3>
            <Readout live={false} items={[
              { k: 'Conductividad térmica k', v: `${fmt(rod.k, rod.k < 10 ? 2 : 1)} W/(m·K)` },
              { k: 'Difusividad térmica α = k/(ρ·c)', v: alphaText },
              { k: 'Tiempo de difusión hasta 3 cm (x²/α)', v: `${fmt(0.03 ** 2 / sim.alpha, 0)} s` },
            ]} />
            {done && indicator === 'tachuelas' && tacks.fallen < nTacks && (
              <Notice kind="info">Las tachuelas lejanas no caen aunque se espere: la varilla llegó casi al estado estacionario, en el que el calor que entra por el baño se pierde por la superficie antes de llevar la cera a {fmt(WAX_MELT_T, 0)} °C.</Notice>
            )}
          </div>
        </div>

        <Chart title="Perfil de temperatura a lo largo de la varilla" xLabel="Posición sobre la varilla (cm)" yLabel="Temperatura (°C)" xUnit="cm" yUnit="°C" height={260}
          exportName="conduccion-perfil" xDomain={[0, 30]} yDomain={[AMBIENT_T - 2, Math.max(60, bathT + 2)]}
          hLines={[{ y: WAX_MELT_T, label: `Cera ${fmt(WAX_MELT_T, 0)} °C` }, { y: AMBIENT_T, label: `Salón ${fmt(AMBIENT_T, 0)} °C` }]}
          series={probePoints.length ? [
            { label: done ? 'Termopares (lecturas a los 30 min)' : 'Termopares (lectura actual)', color: 'var(--series-1)', kind: 'scatter', points: probePoints },
            ...(done ? [
              { label: 'Modelo a los 30 min (Crank–Nicolson)', color: 'var(--series-4)', kind: 'line' as const, points: profileModel },
              { label: 'Estado estacionario (solución exacta de la aleta)', color: 'var(--series-5)', kind: 'line' as const, dashed: true, points: profileSteady },
            ] : []),
          ] : []}
          emptyText="Pulsa «Encender y medir» para leer los termopares." />

        <Chart title="Temperatura de los termopares en función del tiempo" xLabel="Tiempo (s)" yLabel="Temperatura (°C)" xUnit="s" yUnit="°C" height={250}
          exportName="conduccion-temperatura-tiempo" xDomain={[0, RUN_S]}
          series={shownTimes > 0 ? timeSeries.map((pts, i) => ({ label: `Termopar ${i + 1} (${fmt(probes[i], 1)} cm)`, color: TC_COLOR[i], kind: 'line' as const, points: pts.slice(0, shownTimes) })) : []}
          emptyText="Las curvas aparecen mientras se registra." />

        {done && indicator === 'tachuelas' && nTacks > 0 && (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tiempos de caída de las tachuelas">
            <table>
              <caption>Caída de las tachuelas ({rod.short.toLowerCase()}, baño a {fmt(bathT, 0)} °C)</caption>
              <thead><tr><th scope="col" className="n">Posición (cm)</th><th scope="col" className="n">Tiempo de caída (s)</th><th scope="col" className="n">Escala de difusión x²/α (s)</th></tr></thead>
              <tbody>
                {TACK_SLOTS_CM.slice(0, nTacks).map((cm, i) => (
                  <tr key={cm}><td className="n">{fmt(cm, 0)}</td><td className="n">{readings.falls[i] === null ? 'no cayó' : fmt(readings.falls[i], 0)}</td><td className="n">{fmt((cm / 100) ** 2 / sim.alpha, 0)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <SensorCard intro={`Interfaz con tres termopares tipo K sobre la varilla de ${rod.short.toLowerCase()} (${probes.map((p) => fmt(p, 1)).join('; ')} cm). El registrador simula 30 min desde que la varilla entra al baño a ${fmt(bathT, 0)} °C: compara qué tan rápido sube cada curva y a qué valor tiende.`}>
          <DataLogger title="Registrador multicanal · conducción" channels={sensorChannels} duration={RUN_S} speed={60} rates={[0.5, 1, 2]} defaultRate={1}
            resetKey={conditions} runLabel={conditions} onUseRun={setSensorRun} />
          {sensorRun && (
            <div className="stack-sm">
              <h3>Corrida en uso</h3>
              <p className="small muted" style={{ margin: 0 }}>{sensorRun.label} · {sensorRun.samples.length} muestras a {fmt(sensorRun.rate, 1)} muestras/s.</p>
              <LoggerRunCharts run={sensorRun} />
            </div>
          )}
        </SensorCard>

        <section className="card stack" aria-labelledby="con-tacto-h">
          <h3 id="con-tacto-h">Tacto: ¿por qué el metal se siente más frío?</h3>
          <div className="bench" tabIndex={0} role="region" aria-label="Mesa de la actividad de tacto">
            <ManipScene viewBox="0 0 560 210" label="Mano para tocar el objeto" scene={
            <svg viewBox="0 0 560 210" role="img" aria-labelledby="con-tt con-td">
              <title id="con-tt">Mano que toca un bloque y temperaturas de contacto con la piel</title>
              <desc id="con-td">{touching ? `La mano toca ${touchMat.name.toLowerCase()} a ${fmt(objectT, 0)} °C; la piel queda en contacto a ${fmt(Tc, 1)} °C.` : `Bloque de ${touchMat.name.toLowerCase()} a ${fmt(objectT, 0)} °C y una mano a ${fmt(SKIN.T, 0)} °C sin tocarlo.`}</desc>
              <BenchTop y={186} width={560} />
              {touchId === 'aire'
                ? <rect x={58} y={92} width={96} height={94} rx={6} fill="none" stroke="var(--ink-2)" strokeDasharray="4 4" />
                : <Cube x={58} y={186} size={88} color={touchMat.color} finish={touchId === 'madera' ? 'madera' : touchId === 'vidrio' ? 'vidrio' : touchId === 'icopor' ? 'mate' : 'metal'} />}
              {touchId === 'icopor' && <rect x={58} y={98} width={88} height={88} fill="url(#con-foam)" opacity="0.7" />}
              <text x={104} y={204} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{touchMat.short} a {fmt(objectT, 0)} °C</text>
              {touching && <rect x={74} y={95} width={58} height={4} rx={2} fill={Tc < SKIN.T - 1 ? 'var(--series-1)' : Tc > SKIN.T + 1 ? 'var(--bad)' : 'var(--ok)'} />}
              <Hand cx={102} tip={touching ? 96 : 62} />
              {touching && <text x={150} y={58} style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700 }}>contacto: {fmt(Tc, 1)} °C</text>}
              {/* temperaturas de contacto de los materiales ya tocados */}
              <text x={300} y={14} style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 600 }}>Temperatura de contacto con la piel (°C)</text>
              <line x1={barX(SKIN.T)} x2={barX(SKIN.T)} y1={20} y2={182} stroke="var(--bad)" strokeDasharray="3 3" strokeWidth="1" />
              <line x1={barX(objectT)} x2={barX(objectT)} y1={20} y2={182} stroke="var(--ink-2)" strokeDasharray="3 3" strokeWidth="1" />
              <text x={barX(SKIN.T)} y={194} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>piel {fmt(SKIN.T, 0)}</text>
              <text x={barX(objectT)} y={204} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>objeto {fmt(objectT, 0)}</text>
              {TOUCH_MATERIALS.map((m, i) => {
                const y = 24 + i * 17.5;
                const known = touched.includes(m.id);
                const t = skinContact(m.id, objectT);
                const x0 = barX(Math.min(t, lo + 0.0001)), x1 = barX(t);
                return (
                  <g key={m.id}>
                    <text x={292} y={y + 10} textAnchor="end" style={{ fontSize: 9.5, fill: m.id === touchId ? 'var(--ink)' : 'var(--ink-2)', fontWeight: m.id === touchId ? 700 : 500 }}>{m.short}</text>
                    {known
                      ? <>
                        <rect x={300} y={y + 2} width={Math.max(1, x1 - Math.min(x0, 300))} height={10} rx={2} fill={t < SKIN.T - 1 ? 'var(--series-1)' : t > SKIN.T + 1 ? 'var(--bad)' : 'var(--ok)'} opacity={m.id === touchId ? 0.95 : 0.6} />
                        <text x={Math.min(x1 + 4, 520)} y={y + 10.5} style={{ fontSize: 9, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{fmt(t, 1)}</text>
                      </>
                      : <text x={304} y={y + 10.5} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>sin tocar</text>}
                  </g>
                );
              })}
            </svg>}>
              <DragHandle label="Mano: tocar el objeto" value={touching ? 1 : 0} min={0} max={1} step={1} pageStep={1}
                hit={{ x: 60, y: touching ? 20 : 0, w: 86, h: 80 }}
                valueText={(v) => (v ? `Tocando ${touchMat.name.toLowerCase()}` : 'Mano separada del objeto')}
                valueFromPoint={({ point }) => (point.y > 70 ? 1 : 0)}
                onChange={(v) => (v ? touchNow() : release())} />
            </ManipScene>
          </div>
          <div className="grid-2">
            <div className="stack">
              <Select label="Material que se toca" value={touchId} onChange={(v) => { setTouchId(v as TouchId); setTouching(false); }}
                options={TOUCH_MATERIALS.map((m) => ({ value: m.id, label: m.name }))} />
              <Slider label="Temperatura del objeto que se toca" value={objectT} min={CONDUCTION_LIMITS.objectT[0]} max={CONDUCTION_LIMITS.objectT[1]} step={1} unit="°C" decimals={0} onChange={setObjectT}
                hint="28 °C: aire del salón; 8 °C: nevera; 50 °C: baranda al sol del mediodía." />
              <div className="btn-row">
                <button type="button" className="btn" onClick={touching ? release : touchNow}>{touching ? 'Retirar la mano' : 'Tocar el objeto'}</button>
              </div>
            </div>
            <div className="stack">
              <Readout items={[
                { k: 'Temperatura de contacto con la piel', v: touching ? `${fmt(Tc, 1)} °C` : '—', data: true },
                { k: 'Sensación', v: touching ? sensation(Tc) : '—' },
                { k: 'Efusividad del material e = √(k·ρ·c)', v: `${fmt(effusivity(touchMat), 0)} W·s½/(m²·K)` },
                { k: 'Efusividad de la piel', v: `${fmt(eSkin, 0)} W·s½/(m²·K)` },
              ]} />
            </div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            T_contacto = (e_piel·T_piel + e_objeto·T_objeto)/(e_piel + e_objeto). Cuanto mayor es la efusividad del objeto, más se acerca la temperatura
            de contacto a la del objeto: el metal «roba» calor de la mano muy rápido. El icopor y el aire casi no lo hacen.
          </p>
          <details>
            <summary>Aislantes: pared de 2 cm con 60 °C de un lado y 28 °C del otro (ley de Fourier, q″ = k·ΔT/d)</summary>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Flujo de calor a través de una pared de cada material">
              <table>
                <caption className="sr-only">Flujo de calor por metro cuadrado a través de una pared de 2 cm</caption>
                <thead><tr><th scope="col">Material</th><th scope="col" className="n">k (W/(m·K))</th><th scope="col" className="n">Flujo (W/m²)</th></tr></thead>
                <tbody>
                  {TOUCH_MATERIALS.map((m) => (
                    <tr key={m.id}><td>{m.name}</td><td className="n">{fmt(m.k, m.k < 1 ? 3 : 1)}</td><td className="n">{fmt(slabHeatFlux(m.k, 0.02, 32), 0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">El aire quieto conduce aún peor que el icopor, pero el aire libre se mueve (convección) y transporta calor. El icopor es más del 95 % aire atrapado en burbujas que no lo dejan moverse.</p>
          </details>
        </section>

        <details className="card">
          <summary>Tabla de materiales de las varillas</summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Propiedades térmicas de las varillas">
            <table>
              <caption className="sr-only">Propiedades térmicas a 25 °C</caption>
              <thead><tr><th scope="col">Material</th><th scope="col" className="n">k (W/(m·K))</th><th scope="col" className="n">ρ (kg/m³)</th><th scope="col" className="n">c (J/(kg·K))</th><th scope="col" className="n">α (mm²/s)</th><th scope="col" className="n">e (W·s½/(m²·K))</th></tr></thead>
              <tbody>
                {RODS.map((r) => {
                  const a = (r.k / (r.rho * r.c)) * 1e6;
                  return <tr key={r.id}><td>{r.name}</td><td className="n">{fmt(r.k, r.k < 10 ? 2 : 1)}</td><td className="n">{fmt(r.rho, 0)}</td><td className="n">{fmt(r.c, 0)}</td><td className="n">{fmt(a, a < 10 ? 2 : 1)}</td><td className="n">{fmt(effusivity(r), 0)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted">Fuentes: Incropera et al. (2011), tablas A.1 y A.3; madera a lo largo de la fibra según el Wood Handbook (USDA, 2010).</p>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Select label="Material de la varilla" value={rodId} onChange={(v) => setRodId(v as RodId)} options={RODS.map((r) => ({ value: r.id, label: r.name }))} />
          <Segmented<CoverId> label="Recubrimiento de la varilla" value={cover} onChange={setCover}
            options={[{ value: 'aire', label: COVER_LABEL.aire }, { value: 'icopor', label: COVER_LABEL.icopor }]} />
          <Segmented<Indicator> label="Indicador sobre la varilla" value={indicator} onChange={setIndicator}
            options={[{ value: 'tachuelas', label: 'Tachuelas con cera' }, { value: 'cinta', label: 'Cinta termocrómica' }]} />
          <Slider label="Temperatura del baño" value={bathT} min={CONDUCTION_LIMITS.bathT[0]} max={CONDUCTION_LIMITS.bathT[1]} step={1} unit="°C" decimals={0} onChange={setBathT}
            hint="La perilla del mechero regula el gas; el agua no pasa de ≈ 99 °C en Urabá." />
          <Slider label="Número de tachuelas con cera" value={nTacks} min={CONDUCTION_LIMITS.tacks[0]} max={CONDUCTION_LIMITS.tacks[1]} step={1} decimals={0} onChange={setNTacks}
            hint="Una cada 3 cm, desde 3 cm." />
          {probes.map((x, i) => (
            <Slider key={i} label={`Posición del termopar ${i + 1}`} value={x} min={CONDUCTION_LIMITS.position[0]} max={CONDUCTION_LIMITS.position[1]} step={0.5} unit="cm" decimals={1} onChange={(v) => setProbe(i, v)} />
          ))}
          <SimControls title="Calentamiento de la varilla" status={simStatusOf(running, phase === 'pausa', done)} startLabel="Encender y medir" repeatLabel="Medir de nuevo"
            onStart={start} onPause={() => { cancelAnimationFrame(raf.current); setPhase('pausa'); }} onResume={() => setPhase('midiendo')} onReset={reset}
            progress={{ value: simT / 60, max: RUN_S / 60, unit: 'min', decimals: 1, label: 'Tiempo simulado' }} />
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>
          Modelo: conducción en una dimensión con pérdidas por convección y radiación (ecuación de la aleta), resuelta con Crank–Nicolson
          (malla de 5 mm, Δt = 1 s). Supone el extremo exactamente a la temperatura del baño, aire quieto a {fmt(AMBIENT_T, 0)} °C y propiedades
          constantes; no incluye el vapor que sube del baño ni la masa de la cera.
        </Notice>
      </div>
    </div>
  );
}

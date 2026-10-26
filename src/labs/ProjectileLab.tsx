import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  GATE_RES, TIMER_RES, STROBE_SCALE_RES, TAPE_RES,
  G, PROJECTILE_LIMITS, SPHERES, SPRING_LEVELS, STROBE_DT, TARGET_RADIUS, checkTarget, findSphere,
  idealMaxRange, optimalAngle, simulateShot, targetDistance, type SpringLevel, type TrajPoint,
} from '../models/projectile';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { impactIntensity, playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, resolutionText } from '../components/ui';
import { Chart } from '../components/Chart';
import type { LabProps } from './registry';
import { useModelParams, usePublishModel } from '../components/Advanced';
import { SimControls, simStatusOf } from '../components/Experiment';
import { BenchTop, Lcd, shade } from './kit';
import { DragHandle, ManipHint, ManipScene } from './manipulate';

/* ------------------------------------------------------------------ geometría del banco */

const VB_W = 740, VB_H = 400;
const Y_FLOOR = 330; // cara superior del piso
const X0 = 176; // boca del lanzador (punto de lanzamiento) en px
const X_MAX = 684; // límite derecho del área de vuelo
const Y_TOP = 34; // límite superior del área de vuelo
const BRACKET = 58; // px entre la boca del lanzador y la mesa
const BALL_R = 6;

type Air = 'ideal' | 'aire';
type Activity = 'libre' | 'blanco' | 'optimo';
type Phase = 'listo' | 'vuelo' | 'pausa' | 'cayo' | 'medido';

const AIR_LABEL: Record<Air, string> = { ideal: 'Sin aire (ideal)', aire: 'Con resistencia del aire' };

function niceStep(pxPerM: number, minPx: number): number {
  return [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5].find((s) => s * pxPerM >= minPx) ?? 5;
}

function ProjectileDefs() {
  return (
    <defs>
      {SPHERES.map((s) => (
        <radialGradient key={s.id} id={`pry-ball-${s.id}`} cx="0.35" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.25" stopColor={shade(s.color, 0.25)} />
          <stop offset="0.8" stopColor={s.color} />
          <stop offset="1" stopColor={shade(s.color, -0.45)} />
        </radialGradient>
      ))}
      <linearGradient id="pry-tape" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f7d64a" />
        <stop offset="1" stopColor="#e2b923" />
      </linearGradient>
      <linearGradient id="pry-floor" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="var(--surface-2)" />
        <stop offset="1" stopColor="var(--surface)" />
      </linearGradient>
      <linearGradient id="pry-tray" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#1f5f99" />
        <stop offset="0.35" stopColor="#3f93d6" />
        <stop offset="1" stopColor="#1b4f80" />
      </linearGradient>
      <radialGradient id="pry-flash" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fffbe0" stopOpacity="0.95" />
        <stop offset="1" stopColor="#fff3a0" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/** Esfera con brillo especular. */
function Ball({ x, y, sphereId, opacity = 1, r = BALL_R }: { x: number; y: number; sphereId: string; opacity?: number; r?: number }) {
  return (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={r} fill={`url(#pry-ball-${sphereId})`} stroke={shade(findSphere(sphereId).color, -0.55)} strokeWidth="0.7" />
      <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.28} fill="#fff" opacity="0.8" />
    </g>
  );
}

/** Lanzador de resorte: tubo metálico con fotopuerta en la boca; (x, y) es la boca y angle el ángulo sobre la horizontal. */
function Launcher({ x, y, angle, level, gateLit }: { x: number; y: number; angle: number; level: SpringLevel['id'] | null; gateLit: boolean }) {
  const notches = { corto: -50, medio: -42, largo: -34 } as const;
  return (
    <g transform={`translate(${x} ${y}) rotate(${-angle})`}>
      <g filter="url(#kit-shadow-soft)">
        <rect x={-62} y={-8} width={62} height={16} rx={3} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.8" />
        <rect x={-66} y={-9} width={8} height={18} rx={2} fill="url(#kit-body-dark)" />
      </g>
      <line x1={-58} x2={-4} y1={-4.5} y2={-4.5} stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" />
      {/* ranura con las muescas de los tres niveles del resorte */}
      <rect x={-54} y={2} width={24} height={3} rx={1.5} fill="#37474f" />
      {(['corto', 'medio', 'largo'] as const).map((k) => (
        <line key={k} x1={notches[k] + 4} x2={notches[k] + 4} y1={1} y2={6} stroke={level === k ? 'var(--fis)' : '#90a4ae'} strokeWidth={level === k ? 2 : 1} />
      ))}
      {/* fotopuerta: emisor arriba, detector abajo */}
      <rect x={3} y={-20} width={10} height={12} rx={2} fill="url(#kit-body-dark)" />
      <rect x={3} y={8} width={10} height={12} rx={2} fill="url(#kit-body-dark)" />
      <rect x={13} y={-20} width={3} height={40} rx={1} fill="#263033" opacity="0.55" />
      <circle cx={8} cy={-10} r={1.7} fill={gateLit ? '#ffd54a' : '#ff5252'} />
      <circle cx={8} cy={10} r={1.7} fill={gateLit ? '#ffd54a' : '#66bb6a'} />
    </g>
  );
}

/** Transportador de cuadrante en el soporte del lanzador: el tubo apunta hacia atrás sobre la escala. */
const Protractor = memo(function Protractor({ cx, cy }: { cx: number; cy: number }) {
  const R = 46;
  const p = (deg: number, r: number) => [cx - r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  return (
    <g aria-hidden="true">
      <path d={`M${cx} ${cy} L${cx - R} ${cy} A${R} ${R} 0 0 0 ${cx} ${cy + R} Z`} fill="var(--surface)" fillOpacity="0.75" stroke="var(--ink-2)" strokeOpacity="0.7" />
      {Array.from({ length: 19 }, (_, i) => i * 5).map((d) => {
        const [x1, y1] = p(d, R), [x2, y2] = p(d, R - (d % 30 === 0 ? 9 : d % 10 === 0 ? 6 : 3.5));
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={d % 10 === 0 ? 1 : 0.6} />;
      })}
      {[0, 30, 60, 90].map((d) => {
        const [tx, ty] = p(d, R - 16);
        return <text key={d} x={tx} y={ty + 3} textAnchor="middle" style={{ fontSize: 7.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{d}</text>;
      })}
    </g>
  );
});

/** Cinta métrica amarilla sobre el piso, con cero en la plomada. */
const Tape = memo(function Tape({ s, maxM }: { s: number; maxM: number }) {
  const major = niceStep(s, 44);
  const lead = Number((major / 10 ** Math.floor(Math.log10(major))).toFixed(3));
  const minor = major / (lead === 2 ? 4 : lead === 2.5 ? 5 : 10);
  const nMinor = Math.floor(maxM / minor + 1e-9);
  const right = X0 + maxM * s;
  return (
    <g aria-hidden="true">
      <rect x={X0 - 4} y={Y_FLOOR + 5} width={right - X0 + 8} height={15} rx={1.5} fill="url(#pry-tape)" stroke="#b08c12" strokeWidth="0.6" filter="url(#kit-shadow-soft)" />
      {Array.from({ length: nMinor + 1 }, (_, i) => i * minor).map((m, i) => {
        const isMajor = Math.abs(m / major - Math.round(m / major)) < 1e-6;
        return <line key={i} x1={X0 + m * s} x2={X0 + m * s} y1={Y_FLOOR + 5} y2={Y_FLOOR + (isMajor ? 12 : 8.5)} stroke="#2b2408" strokeWidth={isMajor ? 1 : 0.5} />;
      })}
      {Array.from({ length: Math.floor(maxM / major + 1e-9) + 1 }, (_, i) => i * major).map((m) => (
        <text key={m} x={X0 + m * s} y={Y_FLOOR + 18.5} textAnchor="middle" style={{ fontSize: 7.5, fill: '#2b2408', fontFamily: 'var(--font-data)' }}>{fmt(m, major < 1 ? (major < 0.1 || major === 0.25 ? 2 : 1) : 0)}</text>
      ))}
      {/* carrete de la cinta */}
      <g filter="url(#kit-shadow-soft)">
        <rect x={right + 2} y={Y_FLOOR + 1} width={22} height={22} rx={5} fill="url(#kit-body-dark)" />
        <circle cx={right + 13} cy={Y_FLOOR + 12} r={5} fill="#f7d64a" stroke="#263033" />
      </g>
      <text x={right + 13} y={Y_FLOOR + 34} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>m</text>
    </g>
  );
});

/** Escala vertical de fondo para la fotografía estroboscópica. */
const BackScale = memo(function BackScale({ s, maxM }: { s: number; maxM: number }) {
  const major = niceStep(s, 30);
  const x = X_MAX + 14;
  return (
    <g aria-hidden="true">
      <rect x={x - 3} y={Y_FLOOR - maxM * s} width={6} height={maxM * s} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.5" />
      {Array.from({ length: Math.floor(maxM / major + 1e-9) + 1 }, (_, i) => i * major).map((m) => (
        <g key={m}>
          <line x1={x - 3} x2={x + 3} y1={Y_FLOOR - m * s} y2={Y_FLOOR - m * s} stroke="#4d3b1c" />
          <text x={x + 6} y={Y_FLOOR - m * s + 3} style={{ fontSize: 7.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(m, major < 1 ? (major === 0.25 || major < 0.1 ? 2 : 1) : 0)}</text>
        </g>
      ))}
    </g>
  );
});

/** Caja del cronómetro de la fotopuerta (v0 y tiempo de vuelo) y cámara estroboscópica. */
function Instruments({ v0Text, tText, flash }: { v0Text: string; tText: string; flash: boolean }) {
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={10} y={14} width={104} height={98} rx={8} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <text x={62} y={27} textAnchor="middle" style={{ fontSize: 8, fill: '#3a4644', fontWeight: 700 }}>FOTOPUERTA</text>
      <Lcd x={18} y={32} w={88} h={26} text={v0Text} unit="m/s" />
      <text x={62} y={70} textAnchor="middle" style={{ fontSize: 8, fill: '#3a4644', fontWeight: 700 }}>TIEMPO DE VUELO</text>
      <Lcd x={18} y={75} w={88} h={26} text={tText} unit="s" />
      {/* cámara con lámpara estroboscópica */}
      <g filter="url(#kit-shadow-soft)">
        <rect x={16} y={128} width={62} height={30} rx={5} fill="url(#kit-body-dark)" />
        <rect x={26} y={122} width={18} height={8} rx={2} fill="url(#kit-body-dark)" />
        <circle cx={60} cy={143} r={10} fill="#263033" stroke="url(#kit-metal)" strokeWidth="2.5" />
        <circle cx={60} cy={143} r={4.5} fill="#3d5a80" />
        <circle cx={58} cy={141} r={1.5} fill="#fff" opacity="0.7" />
        <rect x={82} y={130} width={20} height={26} rx={3} fill="url(#kit-metal)" stroke="#6d7b80" />
      </g>
      {flash && <circle cx={92} cy={143} r={20} fill="url(#pry-flash)" />}
      <rect x={85} y={133} width={14} height={20} rx={2} fill={flash ? '#fffbe0' : '#e8eef0'} stroke="#9aa5a9" strokeWidth="0.6" />
      <text x={59} y={172} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>estroboscopio 20 Hz</text>
    </g>
  );
}

/* ------------------------------------------------------------------ componente */

export default function ProjectileLab({ api }: LabProps) {
  const [launcher, setLauncher] = useState<'resorte' | 'continuo'>('resorte');
  const [level, setLevel] = useState<SpringLevel['id']>('medio');
  const [v0c, setV0c] = useState(4.5);
  const [angle, setAngle] = useState(30);
  const [height, setHeight] = useState(1);
  const [sphereId, setSphereId] = useState('acero');
  const [air, setAir] = useState<Air>('ideal');
  const [activity, setActivity] = useState<Activity>('libre');
  const [phase, setPhase] = useState<Phase>('listo');
  const [t, setT] = useState(0);
  const [seed, setSeed] = useState(1);
  const [target, setTarget] = useState<number | null>(null);
  const [scan, setScan] = useState<{ angle: number; range: number }[]>([]);
  const [reveal, setReveal] = useState(false);
  const raf = useRef(0);

  const v0 = launcher === 'resorte' ? SPRING_LEVELS.find((l) => l.id === level)!.v0 : v0c;
  const withAir = air === 'aire';
  const sphere = findSphere(sphereId);
  const P = useModelParams();
  const g = P.g ?? G;
  const shot = useMemo(() => simulateShot({ v0, angle, height, sphereId, air: withAir, g: P.g }), [v0, angle, height, sphereId, withAir, P.g]);
  const idealPath = useMemo(() => (withAir ? simulateShot({ v0, angle, height, sphereId, air: false, g: P.g }).path : null), [v0, angle, height, sphereId, withAir, P.g]);
  const best = useMemo(() => (activity === 'libre' ? null : optimalAngle({ v0, height, sphereId, air: withAir, g: P.g })), [activity, v0, height, sphereId, withAir, P.g]);
  usePublishModel(() => {
    const th = (angle * Math.PI) / 180;
    const vy = v0 * Math.sin(th);
    return {
      vars: {
        v0: { sym: 'v_{0}', name: 'Rapidez de salida', value: v0, unit: 'm/s', decimals: 2 },
        th: { sym: '\\theta', name: 'Ángulo de lanzamiento', value: angle, unit: '°', decimals: 1 },
        h: { sym: 'h', name: 'Altura de lanzamiento', value: height, unit: 'm', decimals: 2 },
        g: { sym: 'g', name: 'Gravedad', value: g, unit: 'm/s²', decimals: 2 },
        vx: { sym: 'v_{x}', name: 'Componente horizontal', value: v0 * Math.cos(th), unit: 'm/s', decimals: 3 },
        vy: { sym: 'v_{y0}', name: 'Componente vertical inicial', value: vy, unit: 'm/s', decimals: 3 },
        H: { sym: 'y_{máx}', name: 'Altura máxima (sin aire)', value: height + (vy * vy) / (2 * g), unit: 'm', decimals: 3 },
        t: { sym: 't_{v}', name: 'Tiempo de vuelo (sin aire)', value: (vy + Math.sqrt(vy * vy + 2 * g * height)) / g, unit: 's', decimals: 3 },
        R: { sym: 'R', name: 'Alcance (sin aire)', value: shot.idealRange, unit: 'm', decimals: 3 },
      },
      equations: [
        { title: 'Componentes de la velocidad', lhs: 'vx', expr: '[v0]·\\cos [th]' },
        { lhs: 'vy', expr: '[v0]·\\sin [th]' },
        { title: 'Altura máxima', lhs: 'H', expr: '[h] + \\frac{[vy]^{2}}{2·[g]}' },
        { title: 'Tiempo de vuelo (y = 0)', lhs: 't', expr: '\\frac{[vy] + \\sqrt{[vy]^{2} + 2·[g]·[h]}}{[g]}' },
        { title: 'Alcance', lhs: 'R', expr: '[vx]·[t]', note: withAir ? 'Con aire, el alcance real es menor: el arrastre se integra numéricamente (no tiene fórmula cerrada).' : undefined },
      ],
    };
  }, [v0, angle, height, g, shot, withAir]);

  // Cualquier cambio de condiciones deja el lanzador listo para un disparo nuevo.
  useEffect(() => { setPhase('listo'); setT(0); }, [v0, angle, height, sphereId, withAir]);
  // La serie de la actividad «ángulo óptimo» solo vale para unas mismas condiciones (salvo el ángulo).
  useEffect(() => { setScan([]); setReveal(false); }, [v0, height, sphereId, withAir]);

  // Escala del dibujo: depende de v0 y h, no del ángulo (no revela el alcance).
  const span = useMemo(() => {
    const xs = Math.max(0.6, idealMaxRange(v0, height, g) * 1.06, (target ?? 0) + 0.2);
    const ys = Math.max(0.5, height + (v0 * v0) / (2 * g) * 1.02);
    const s = Math.min((X_MAX - X0) / xs, (Y_FLOOR - Y_TOP) / ys);
    return { s, xs, ys };
  }, [v0, height, target, g]);
  const s = span.s;
  const px = (x: number) => X0 + x * s;
  const py = (y: number) => Y_FLOOR - y * s;

  useEffect(() => {
    if (phase !== 'vuelo') return;
    if (prefersReducedMotion() || shot.flightTime <= 0) { setT(shot.flightTime); setPhase('cayo'); return; }
    // Al reanudar tras una pausa, el reloj sigue desde el tiempo ya recorrido.
    const start = performance.now() - t * 1000;
    const tick = (now: number) => {
      const el = Math.max(0, (now - start) / 1000);
      if (el >= shot.flightTime) { setT(shot.flightTime); setPhase('cayo'); playSound('thud', { intensity: 0.3 + 0.7 * impactIntensity(v0, 8) }); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, shot]);

  const flying = phase === 'vuelo';
  const landed = phase === 'cayo' || phase === 'medido';
  const measured = phase === 'medido';
  const fired = phase !== 'listo';

  // Posición actual de la esfera (interpolación en la trayectoria muestreada cada 0,01 s).
  const ballPos = useMemo((): TrajPoint => {
    const p = shot.path;
    if (!fired) return p[0];
    if (landed || p.length < 2) return p[p.length - 1];
    let i = Math.min(p.length - 2, Math.max(0, Math.floor(t / 0.01)));
    while (i < p.length - 2 && p[i + 1].t < t) i++;
    const a = p[i], b = p[i + 1];
    const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
    return { t, x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) };
  }, [shot, t, fired, landed]);

  const visibleStrobe = fired ? shot.strobe.filter((p) => p.t <= (landed ? shot.flightTime : t) + 1e-9) : [];
  const traced = fired ? shot.path.filter((p) => p.t <= (landed ? shot.flightTime : t) + 1e-9) : [];
  const flash = flying && t % STROBE_DT < 0.012;
  const toPoints = (pts: TrajPoint[]) => pts.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');

  const mx = px(0), my = py(height);
  const tableTop = my + BRACKET;
  const hasTable = tableTop <= Y_FLOOR - 14;
  const hit = measured && target !== null ? checkTarget(shot.rangeReading, target) : null;

  const fire = () => { setT(0); setPhase('vuelo'); playSound('thunk', { intensity: 0.4 + 0.6 * impactIntensity(v0, 8) }); };
  const measure = () => {
    setPhase('medido');
    playSound('click', { intensity: 0.5 });
    if (activity === 'optimo') setScan((list) => [...list.filter((p) => p.angle !== angle), { angle, range: shot.rangeReading }].sort((p, q) => p.angle - q.angle));
  };
  const newTarget = (nextSeed: number) => {
    const reach = optimalAngle({ v0, height, sphereId, air: withAir }).range;
    setSeed(nextSeed);
    setTarget(targetDistance(nextSeed, reach));
    setPhase('listo');
  };
  const changeActivity = (a: Activity) => {
    setActivity(a);
    setPhase('listo');
    if (a === 'blanco') { if (target === null) newTarget(seed); } else setTarget(null);
  };

  const record = () => api.addTrial('disparos', {
    esfera: sphere.name, aire: AIR_LABEL[air], v0: shot.v0Reading, angulo: angle, altura: height,
    alcance: shot.rangeReading, alturaMax: shot.maxHeightReading, tiempo: shot.timeReading,
  });

  const descText = !fired
    ? `La esfera de ${sphere.name.toLowerCase()} está cargada en el lanzador a ${fmt(angle, 1)}° y ${fmt(height, 2)} m de altura.`
    : flying ? 'La esfera está en vuelo.'
      : phase === 'pausa' ? `Vuelo en pausa en t = ${fmt(t, 2)} s.`
      : measured ? `La esfera cayó a ${fmt(shot.rangeReading, 3)} m de la plomada, según la cinta métrica.` : 'La esfera cayó y dejó una marca en el papel carbón; falta medir el alcance con la cinta.';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox={`0 0 ${VB_W} ${VB_H}`} label="Controles del lanzador" scene={
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-labelledby="pry-t pry-d">
            <title id="pry-t">Lanzador de proyectiles sobre una mesa, con fotopuerta, fotografía estroboscópica y cinta métrica en el piso</title>
            <desc id="pry-d">{descText}{target !== null ? ` El recipiente del reto está a ${fmt(target, 2)} m.` : ''}</desc>
            <ProjectileDefs />

            {/* piso */}
            <rect x={0} y={Y_FLOOR} width={VB_W} height={VB_H - Y_FLOOR} fill="url(#pry-floor)" />
            <line x1={0} x2={VB_W} y1={Y_FLOOR} y2={Y_FLOOR} stroke="var(--ink-2)" strokeOpacity="0.6" strokeWidth="1.2" />
            {Array.from({ length: 12 }, (_, i) => <line key={i} x1={i * 64 + 20} x2={i * 64 - 10} y1={Y_FLOOR + 30} y2={VB_H} stroke="var(--line)" strokeWidth="1" />)}

            <BackScale s={s} maxM={Math.min(span.ys, (Y_FLOOR - 12) / s)} />
            <Instruments v0Text={fired && (flying ? t > 0 : true) ? fmt(shot.v0Reading, 2) : '0,00'} tText={fired ? fmt(landed ? shot.timeReading : t, 3) : '0,000'} flash={flash} />

            {/* mesa de altura ajustable o foso bajo el lanzador cuando h es casi 0 */}
            {hasTable ? (
              <g>
                {[X0 - 92, X0 + 16].map((lx) => (
                  <g key={lx} filter="url(#kit-shadow-soft)">
                    <rect x={lx} y={tableTop + 14} width={8} height={Math.max(0, Y_FLOOR - tableTop - 14)} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.5" />
                    <rect x={lx - 2} y={tableTop + 14 + (Y_FLOOR - tableTop - 14) * 0.45} width={12} height={8} rx={2} fill="url(#kit-body-dark)" />
                    <rect x={lx - 5} y={Y_FLOOR - 4} width={18} height={4} rx={2} fill="#263033" />
                  </g>
                ))}
                <BenchTop y={tableTop} x={X0 - 104} width={136} />
                {/* prensa en C */}
                <path d={`M${X0 - 26} ${tableTop - 2} h-10 v20 h10`} fill="none" stroke="#c62828" strokeWidth="3" strokeLinejoin="round" />
              </g>
            ) : (
              <g>
                <rect x={X0 - 70} y={Y_FLOOR} width={92} height={Math.min(VB_H - Y_FLOOR, tableTop + 14 - Y_FLOOR)} fill="var(--surface)" stroke="var(--ink-2)" strokeOpacity="0.5" />
                <BenchTop y={tableTop} x={X0 - 66} width={84} />
              </g>
            )}
            {/* soporte del lanzador */}
            <g filter="url(#kit-shadow-soft)">
              <rect x={X0 - 32} y={tableTop - 6} width={54} height={8} rx={2} fill="url(#kit-body-dark)" />
              <rect x={X0 - 7} y={my} width={12} height={BRACKET - 4} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.5" />
            </g>
            <Protractor cx={mx} cy={my} />
            {/* plomada: marca el cero de la cinta */}
            <line x1={mx} x2={mx} y1={my + 4} y2={Y_FLOOR - 6} stroke="var(--ink-2)" strokeWidth="0.8" strokeDasharray="3 3" />
            <path d={`M${mx - 3} ${Y_FLOOR - 8} L${mx + 3} ${Y_FLOOR - 8} L${mx} ${Y_FLOOR - 1} Z`} fill="#b08c12" />

            <Tape s={s} maxM={Math.max(0.5, (X_MAX - X0 - 20) / s)} />

            {/* recipiente del reto */}
            {target !== null && (
              <g>
                <ellipse cx={px(target)} cy={Y_FLOOR - 1} rx={17} ry={4} fill="#000" opacity="0.15" />
                <path d={`M${px(target) - 15} ${Y_FLOOR - 10} L${px(target) - 12} ${Y_FLOOR} L${px(target) + 12} ${Y_FLOOR} L${px(target) + 15} ${Y_FLOOR - 10} Z`} fill="url(#pry-tray)" stroke="#123b61" strokeWidth="0.7" />
                <ellipse cx={px(target)} cy={Y_FLOOR - 10} rx={15} ry={3.2} fill="#164a78" stroke="#123b61" strokeWidth="0.7" />
                <text x={px(target)} y={Y_FLOOR - 18} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 700 }}>blanco {fmt(target, 2)} m</text>
              </g>
            )}

            {/* trayectoria ideal de referencia (solo tras medir con aire) */}
            {measured && idealPath && <polyline points={toPoints(idealPath)} fill="none" stroke="var(--ink-2)" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.8" />}
            {traced.length > 1 && <polyline points={toPoints(traced)} fill="none" stroke="var(--fis)" strokeWidth="1.4" opacity="0.55" />}
            {visibleStrobe.slice(1).map((p) => <Ball key={p.t} x={px(p.x)} y={py(p.y)} sphereId={sphereId} opacity={0.45} r={BALL_R - 0.5} />)}

            {/* papel carbón con la marca del impacto */}
            {landed && (
              <g>
                <rect x={px(shot.range) - 20} y={Y_FLOOR - 2} width={40} height={4} fill="#fafafa" stroke="#9e9e9e" strokeWidth="0.5" />
                <rect x={px(shot.range) - 17} y={Y_FLOOR - 3.2} width={34} height={2} fill="#263238" opacity="0.85" />
                <circle cx={px(shot.range)} cy={Y_FLOOR} r={2.4} fill="#111" />
              </g>
            )}
            {measured && (
              <g>
                <line x1={px(shot.range)} x2={px(shot.range)} y1={Y_FLOOR + 2} y2={Y_FLOOR + 24} stroke="var(--bad)" strokeWidth="1.6" />
                <rect x={px(shot.range) - 30} y={Y_FLOOR + 40} width={60} height={16} rx={4} fill="var(--surface)" stroke="var(--bad)" />
                <text x={px(shot.range)} y={Y_FLOOR + 52} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{fmt(shot.rangeReading, 3)} m</text>
              </g>
            )}

            <Launcher x={mx} y={my} angle={angle} level={launcher === 'resorte' ? level : null} gateLit={flying && t < 0.02} />
            {fired && <Ball x={px(ballPos.x)} y={py(ballPos.y)} sphereId={sphereId} />}
            {!fired && <Ball x={mx - 8 * Math.cos((angle * Math.PI) / 180)} y={my + 8 * Math.sin((angle * Math.PI) / 180)} sphereId={sphereId} />}
            <circle cx={mx} cy={my} r={2.2} fill="#263033" />
            <text x={mx + 22} y={my - 22} style={{ fontSize: 11, fill: 'var(--fis)', fontWeight: 700 }}>{fmt(angle, 1)}°</text>
          </svg>}>
            {/* el tubo gira alrededor de la boca: se agarra por la culata y se inclina */}
            <DragHandle label="Tubo del lanzador: ángulo de lanzamiento" value={angle} min={PROJECTILE_LIMITS.angle[0]} max={PROJECTILE_LIMITS.angle[1]} step={0.5} unit="°" decimals={1}
              disabled={flying} hit={{ cx: mx - 40 * Math.cos((angle * Math.PI) / 180), cy: my + 40 * Math.sin((angle * Math.PI) / 180), r: 14 }}
              valueText={(v) => `${fmt(v, 1)}° sobre la horizontal`}
              valueFromPoint={({ point }) => (Math.atan2(point.y - my, mx - point.x) * 180) / Math.PI}
              onChange={setAngle} />
          </ManipScene>
        </div>
        <ManipHint>Inclina el tubo del lanzador arrastrando su culata, o enfócalo con Tab y usa las flechas para cambiar el ángulo.</ManipHint>

        <Readout items={[
          { k: 'v₀ (fotopuerta)', v: fired ? `${fmt(shot.v0Reading, 2)} m/s` : '—', data: true, resolution: resolutionText(GATE_RES, 'm/s') },
          { k: 'Tiempo de vuelo', v: landed ? `${fmt(shot.timeReading, 3)} s` : '—', data: true, resolution: resolutionText(TIMER_RES, 's') },
          { k: 'Altura máxima (estroboscopía)', v: landed ? `${fmt(shot.maxHeightReading, 2)} m` : '—', data: true, resolution: resolutionText(STROBE_SCALE_RES, 'm') },
          { k: 'Alcance (cinta métrica)', v: measured ? `${fmt(shot.rangeReading, 3)} m` : landed ? 'mide' : '—', data: true, resolution: resolutionText(TAPE_RES, 'm') },
          ...(withAir ? [{ k: 'Alcance ideal (sin aire)', v: measured ? `${fmt(shot.idealRange, 3)} m${shot.idealRange > 1e-9 ? ` (con aire: ${fmt(((shot.range - shot.idealRange) / shot.idealRange) * 100, 1)} %)` : ''}` : '—' }] : []),
        ]} />

        {activity === 'blanco' && target !== null && (
          measured && hit ? (
            hit.hit
              ? <Notice kind="ok"><strong>¡En el blanco!</strong> La esfera cayó a {fmt(Math.abs(hit.miss) * 100, 1)} cm del centro del recipiente.</Notice>
              : <Notice kind="warn">Fallaste: la esfera quedó {hit.miss < 0 ? 'corta' : 'larga'} por {fmt(Math.abs(hit.miss) * 100, 1)} cm. Revisa tu cálculo del ángulo.</Notice>
          ) : (
            <Notice>
              El recipiente está a <strong>{fmt(target, 2)} m</strong> de la plomada (acierto si caes a menos de {fmt(TARGET_RADIUS * 100, 0)} cm del centro).
              Calcula el ángulo con y = h + x·tanθ − g·x²/(2·v₀²·cos²θ) = 0, ajústalo y dispara una sola vez.
              {best && target > best.range ? ' Con estas condiciones no es alcanzable: aumenta v₀ o la altura.' : ''}
            </Notice>
          )
        )}

        {activity === 'optimo' && (
          <div className="card stack">
            <h3>¿Qué ángulo da el máximo alcance?</h3>
            <p className="small muted">Sin cambiar v₀, la altura, la esfera ni el aire, dispara y mide con varios ángulos. Cada medición se agrega a la gráfica.</p>
            <Chart title="Alcance medido contra ángulo" xLabel="Ángulo (°)" yLabel="Alcance (m)" xUnit="°" yUnit="m" height={220} xDomain={[0, 90]}
              series={[{ label: 'Alcance medido', color: 'var(--series-1)', kind: 'both', points: scan.map((p) => ({ x: p.angle, y: p.range })) }]}
              emptyText="Mide el alcance con al menos un ángulo." exportName="alcance-angulo" />
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setReveal(true)} disabled={scan.length < 4 || reveal}>Revelar el ángulo óptimo del modelo</button>
            </div>
            {reveal && best && (
              <Notice kind="ok">
                El modelo predice el máximo alcance a <strong>{fmt(best.angle, 1)}°</strong> ({fmt(best.range, 3)} m).
                {height === 0 && !withAir ? ' Con h = 0 y sin aire es exactamente 45°.' : ' Es menor que 45° porque ' + (height > 0 && withAir ? 'se lanza desde una altura y el aire frena la esfera.' : height > 0 ? 'se lanza desde una altura (tanθ* = v₀/√(v₀² + 2gh)).' : 'el aire frena más las trayectorias largas y altas.')}
              </Notice>
            )}
            {scan.length < 4 && <p className="small muted">Mide al menos 4 ángulos para revelar el valor del modelo ({scan.length} de 4).</p>}
          </div>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Lanzador</h3>
          <Segmented label="Tipo de lanzador" value={launcher} onChange={setLauncher}
            options={[{ value: 'resorte', label: 'Resorte (3 niveles)' }, { value: 'continuo', label: 'Rapidez continua' }]} />
          {launcher === 'resorte' ? (
            <Segmented label="Nivel del resorte" value={level} onChange={setLevel}
              options={SPRING_LEVELS.map((l) => ({ value: l.id, label: `${l.name} (${fmt(l.v0, 1)} m/s)` }))} />
          ) : (
            <Slider label="Rapidez de salida v₀" value={v0c} min={PROJECTILE_LIMITS.v0[0]} max={PROJECTILE_LIMITS.v0[1]} step={0.1} unit="m/s" decimals={1} onChange={setV0c} />
          )}
          <Slider label="Ángulo de lanzamiento" value={angle} min={PROJECTILE_LIMITS.angle[0]} max={PROJECTILE_LIMITS.angle[1]} step={0.5} unit="°" decimals={1} onChange={setAngle} />
          <Slider label="Altura de la boca del lanzador" value={height} min={PROJECTILE_LIMITS.height[0]} max={PROJECTILE_LIMITS.height[1]} step={0.05} unit="m" decimals={2} onChange={setHeight} />
          <Select label="Esfera" value={sphereId} onChange={setSphereId}
            options={SPHERES.map((sp) => ({ value: sp.id, label: `${sp.name} (${fmt(sp.mass * 1000, sp.mass < 0.001 ? 2 : 1)} g, ${fmt(sp.diameter * 1000, 1)} mm)` }))} />
          <Segmented label="Resistencia del aire" value={air} onChange={setAir}
            options={[{ value: 'ideal', label: 'Sin aire (ideal)' }, { value: 'aire', label: 'Con aire' }]} />
          {/* Sin barra de avance: el tiempo de vuelo total es una de las lecturas que se miden. */}
          <SimControls title="Lanzador" status={simStatusOf(flying, phase === 'pausa', landed)}
            startLabel="Disparar" repeatLabel="Disparar de nuevo"
            onStart={fire} onPause={() => setPhase('pausa')} onResume={() => setPhase('vuelo')}
            onReset={() => { setPhase('listo'); setT(0); }}>
            <button type="button" className="btn" onClick={measure} disabled={!landed || measured}>Medir el alcance con la cinta</button>
          </SimControls>
          <RecordButton onRecord={record} disabled={!measured} />
        </div>
        <div className="card stack">
          <h3>Actividad</h3>
          <Segmented label="Reto" value={activity} onChange={changeActivity}
            options={[{ value: 'libre', label: 'Exploración libre' }, { value: 'blanco', label: 'Acierta al blanco' }, { value: 'optimo', label: 'Ángulo de máximo alcance' }]} />
          {activity === 'blanco' && <button type="button" className="btn" onClick={() => newTarget(seed + 1)}>Nuevo blanco</button>}
        </div>
        <Notice>g = 9,8 m/s². Con aire: arrastre cuadrático ½·ρ·C_d·A·v² (ρ = 1,2 kg/m³; C_d = 0,47). Las esferas y el recipiente no están dibujados a escala; la trayectoria sí.</Notice>
      </div>
    </div>
  );
}

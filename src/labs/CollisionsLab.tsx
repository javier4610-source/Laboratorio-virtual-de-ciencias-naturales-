import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COLLISION_LIMITS, COLLISION_TYPES, FLAG_LENGTH, RAIL, contactSamples, simulateCollision, stateAt, timeline,
  type CollisionType,
} from '../models/collisions';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, DigitalBalance, Lcd } from './kit';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 760, H = 392;
const X0 = 40; // píxel del extremo izquierdo del riel (x = 0 m)
const PXM = 340; // píxeles por metro
const RY = 296; // cara superior del riel
const BENCH_Y = 364;
const GY = RY - 98; // borde superior del cabezal de las fotopuertas
const GL = RAIL.glider * PXM; // largo del deslizador en px (68)
const BODY = GL - 10; // cuerpo metálico; 5 px por lado para parachoques
const FLAG = FLAG_LENGTH * PXM; // bandera de 10,0 cm (34 px)
const V_PX = 70; // px por m/s en las flechas de velocidad
const px = (x: number) => X0 + x * PXM;

type Bumper = 'resorte' | 'velcro' | 'lanzador' | 'placa';

function CollisionDefs() {
  return (
    <defs>
      <pattern id="cho-holes" width="12" height="6" patternUnits="userSpaceOnUse">
        <rect width="12" height="6" fill="#dfe6e8" />
        <circle cx="6" cy="3" r="1.1" fill="#56656b" />
      </pattern>
      <linearGradient id="cho-brass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#9c7417" />
        <stop offset="0.3" stopColor="#f1d27a" />
        <stop offset="0.6" stopColor="#c99a2e" />
        <stop offset="1" stopColor="#8a6512" />
      </linearGradient>
      <linearGradient id="cho-beam" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#eef2f3" />
        <stop offset="0.35" stopColor="#c3cdd1" />
        <stop offset="0.7" stopColor="#aab5ba" />
        <stop offset="1" stopColor="#d9e0e2" />
      </linearGradient>
      <radialGradient id="cho-led" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff8a80" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ff5252" stopOpacity="0" />
      </radialGradient>
      <pattern id="cho-velcro" width="3" height="3" patternUnits="userSpaceOnUse">
        <rect width="3" height="3" fill="#2f3a3d" />
        <path d="M0 3 L1.5 0 L3 3" fill="none" stroke="#7d8a8f" strokeWidth="0.6" />
      </pattern>
    </defs>
  );
}

/** Riel de aire: perfil de aluminio con orificios, tapas, patas niveladoras y soplador con manguera. */
function AirTrack({ blowing }: { blowing: boolean }) {
  const x1 = px(RAIL.length);
  const ticks = useMemo(() => Array.from({ length: 21 }, (_, i) => px(i * 0.1)), []);
  return (
    <g>
      {/* patas niveladoras */}
      {[px(0.12), px(1.88)].map((lx) => (
        <g key={lx} filter="url(#kit-shadow-soft)">
          <path d={`M${lx - 8} ${RY + 26} L${lx + 8} ${RY + 26} L${lx + 16} ${BENCH_Y - 4} L${lx - 16} ${BENCH_Y - 4} Z`} fill="url(#kit-body-dark)" />
          <rect x={lx - 3} y={BENCH_Y - 6} width={6} height={4} fill="url(#kit-metal-h)" />
          <rect x={lx - 11} y={BENCH_Y - 3} width={22} height={3} rx={1.5} fill="#263033" />
        </g>
      ))}
      {/* soplador */}
      <g filter="url(#kit-shadow)">
        <rect x={110} y={RY + 30} width={92} height={36} rx={6} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <circle cx={130} cy={RY + 48} r={11} fill="#263033" />
      {[0, 60, 120].map((a) => (
        <path key={a} d={`M130 ${RY + 48} l0 -9 a9 9 0 0 1 7 4 Z`} fill="#7d8a8f" transform={`rotate(${a + (blowing ? 25 : 0)} 130 ${RY + 48})`} />
      ))}
      <circle cx={130} cy={RY + 48} r={2.5} fill="url(#kit-metal)" />
      <text x={170} y={RY + 45} textAnchor="middle" style={{ fontSize: 9, fill: '#3a4644', fontWeight: 700 }}>SOPLADOR</text>
      <circle cx={162} cy={RY + 56} r={2.4} fill={blowing ? '#66bb6a' : '#9aa5a9'} />
      <rect x={172} y={RY + 53} width={18} height={6} rx={3} fill="url(#kit-body-dark)" />
      {/* manguera corrugada hasta la tapa izquierda */}
      <path d={`M112 ${RY + 36} C 86 ${RY + 30}, 70 ${RY + 50}, 52 ${RY + 34} S ${X0 - 4} ${RY + 16}, ${X0 - 4} ${RY + 14}`} fill="none" stroke="#3b4648" strokeWidth="9" strokeLinecap="round" />
      <path d={`M112 ${RY + 36} C 86 ${RY + 30}, 70 ${RY + 50}, 52 ${RY + 34} S ${X0 - 4} ${RY + 16}, ${X0 - 4} ${RY + 14}`} fill="none" stroke="#6b787c" strokeWidth="9" strokeDasharray="1.5 2.5" strokeLinecap="butt" opacity="0.8" />
      {/* perfil de aluminio */}
      <g filter="url(#kit-shadow)">
        <rect x={X0} y={RY} width={x1 - X0} height={26} rx={2} fill="url(#cho-beam)" stroke="#8c979b" />
      </g>
      <rect x={X0} y={RY} width={x1 - X0} height={6} fill="url(#cho-holes)" stroke="#8c979b" strokeWidth="0.5" />
      <line x1={X0 + 2} x2={x1 - 2} y1={RY + 18} y2={RY + 18} stroke="#95a1a6" strokeWidth="1" />
      {ticks.map((tx, i) => (
        <line key={i} x1={tx} x2={tx} y1={RY + 20} y2={RY + (i % 5 === 0 ? 26 : 23)} stroke="#37474f" strokeWidth={i % 5 === 0 ? 1.1 : 0.7} />
      ))}
      {/* tapas de los extremos (la derecha con banda elástica de tope) */}
      <rect x={X0 - 10} y={RY - 6} width={10} height={36} rx={2} fill="url(#kit-body-dark)" />
      <rect x={x1} y={RY - 6} width={10} height={36} rx={2} fill="url(#kit-body-dark)" />
      <path d={`M${x1 - 1} ${RY - 4} q-6 9 0 18`} fill="none" stroke="#c62828" strokeWidth="2" />
      {blowing && [0.3, 0.8, 1.3, 1.75].map((xm) => (
        <path key={xm} d={`M${px(xm)} ${RY - 1} q 3 -5 0 -10`} fill="none" stroke="var(--ink-2)" strokeWidth="0.8" opacity="0.35" />
      ))}
    </g>
  );
}

/** Soporte y receptor de una fotopuerta (detrás de los deslizadores) y su haz vertical. */
function GateBack({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x + 10} y={GY + 12} width={5} height={RY + 22 - GY - 12} fill="url(#kit-metal-h)" />
      <rect x={x - 6} y={RY - 30} width={22} height={7} rx={1.5} fill="url(#kit-body-dark)" />
      <line x1={x} x2={x} y1={GY + 25} y2={RY - 29} stroke="#ff5252" strokeWidth="1.4" strokeDasharray="3 2" opacity="0.8" />
      <text x={x + 2} y={BENCH_Y - 8} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)', fontWeight: 600 }}>{label}</text>
    </g>
  );
}

/** Cabezal emisor de la fotopuerta, por encima de las banderas. */
function GateHead({ x, blocked }: { x: number; blocked: boolean }) {
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x - 14} y={GY} width={32} height={25} rx={3} fill="url(#kit-body-dark)" />
      </g>
      <rect x={x - 4} y={GY + 20} width={8} height={5} rx={1} fill="#0d1416" />
      {blocked ? <circle cx={x} cy={GY + 23} r={2.4} fill="#ffd54a" /> : <><circle cx={x} cy={GY + 24} r={6} fill="url(#cho-led)" /><circle cx={x} cy={GY + 23} r={2} fill="#ff5252" /></>}
      <circle cx={x + 11} cy={GY + 6} r={1.8} fill={blocked ? '#ffd54a' : '#66bb6a'} />
    </g>
  );
}

/** Deslizador del riel de aire: silla metálica, franja de color, bandera de 10,0 cm, pesas y parachoques. */
function Glider({ cx, base, mass, color, name, bumperSide, bumper, bumperLen, onRail = true }: {
  cx: number; base: number; mass: number; color: string; name: string;
  bumperSide: 'left' | 'right'; bumper: Bumper; bumperLen: number; onRail?: boolean;
}) {
  const half = BODY / 2;
  const top = base - 22;
  const discs = Math.max(0, Math.min(18, Math.round((mass - 0.1) / 0.05)));
  const dir = bumperSide === 'right' ? 1 : -1;
  const face = cx + dir * half; // cara donde va el parachoques
  const len = Math.max(3, Math.min(10, bumperLen));
  const spring = (() => {
    const n = 6, step = len / n;
    let d = `M${face} ${base - 11}`;
    for (let i = 1; i <= n; i++) d += ` L${face + dir * step * i} ${base - 11 + (i % 2 ? -4 : 4)}`;
    return d;
  })();
  return (
    <g>
      <ellipse cx={cx} cy={onRail ? RY - 1 : base + 1} rx={half + 2} ry={2.2} fill="#000" opacity="0.16" />
      {/* bandera (10,0 cm) con sus soportes */}
      <rect x={cx - 7} y={top - 18} width={2} height={18} fill="#4a5558" />
      <rect x={cx + 5} y={top - 18} width={2} height={18} fill="#4a5558" />
      <rect x={cx - FLAG / 2} y={top - 44} width={FLAG} height={26} rx={1.5} fill="#1f2a2d" stroke="#0e1517" strokeWidth="0.6" />
      <line x1={cx - FLAG / 2 + 2} x2={cx + FLAG / 2 - 2} y1={top - 42} y2={top - 42} stroke="#fff" strokeOpacity="0.18" />
      {/* pesas ranuradas en dos espigas */}
      {[-1, 1].map((side) => {
        const n = Math.ceil((discs - (side === 1 ? 1 : 0)) / 2);
        const pxs = cx + side * (half - 7);
        return (
          <g key={side}>
            <rect x={pxs - 1.2} y={top - n * 3.4 - 4} width={2.4} height={n * 3.4 + 4} fill="url(#kit-metal-h)" />
            {Array.from({ length: n }, (_, i) => (
              <rect key={i} x={pxs - 6} y={top - (i + 1) * 3.4} width={12} height={3.1} rx={1} fill="url(#cho-brass)" stroke="#7a5a12" strokeWidth="0.4" />
            ))}
          </g>
        );
      })}
      {/* silla metálica que abraza el riel */}
      <path d={`M${cx - half} ${top} H${cx + half} L${cx + half + 3} ${base + 10} H${cx + half - 5} L${cx + half - 7} ${base} H${cx - half + 7} L${cx - half + 5} ${base + 10} H${cx - half - 3} Z`}
        fill="url(#kit-metal)" stroke="#7d8a8f" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
      <rect x={cx - half + 2} y={top + 4} width={BODY - 4} height={9} rx={2} fill={color} />
      <text x={cx} y={top + 11.5} textAnchor="middle" style={{ fontSize: 8.5, fill: '#fff', fontWeight: 700 }}>{name} · {fmt(mass, 2)} kg</text>
      {/* parachoques */}
      {bumper === 'velcro' ? (
        <rect x={dir > 0 ? face : face - 5} y={base - 19} width={5} height={16} rx={1} fill="url(#cho-velcro)" />
      ) : bumper === 'placa' ? (
        <rect x={dir > 0 ? face : face - 2.5} y={base - 19} width={2.5} height={16} rx={1} fill="#37474f" />
      ) : (
        <g>
          <path d={spring} fill="none" stroke={bumper === 'lanzador' ? '#8a6512' : '#5d6b70'} strokeWidth="1.4" strokeLinejoin="round" />
          <rect x={face + dir * len - 1} y={base - 17} width={2} height={12} rx={0.8} fill="#37474f" />
        </g>
      )}
    </g>
  );
}

function VelocityArrow({ x, y, v, color, label }: { x: number; y: number; v: number; color: string; label: string }) {
  const len = v * V_PX;
  if (Math.abs(len) < 3) return <text x={x} y={y + 4} textAnchor="middle" style={{ fontSize: 10.5, fill: color, fontWeight: 700 }}>{label}</text>;
  const s = Math.sign(len), end = x + len;
  return (
    <g>
      <line x1={x} x2={end - s * 7} y1={y} y2={y} stroke={color} strokeWidth="3" />
      <path d={`M${end} ${y} l${-s * 8} -5 v10 Z`} fill={color} />
      <text x={x + len / 2} y={y - 7} textAnchor="middle" style={{ fontSize: 10.5, fill: color, fontWeight: 700 }}>{label}</text>
    </g>
  );
}

/** Temporizador de las dos fotopuertas: cuatro pantallas (antes y después de cada puerta). */
function GateTimer({ cells }: { cells: [string, string, string, string] }) {
  const x = 14, y = 8;
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={300} height={84} rx={9} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <text x={x + 12} y={y + 17} style={{ fontSize: 10, fill: '#3a4644', fontWeight: 700, letterSpacing: 0.6 }}>TEMPORIZADOR · 0,1 ms</text>
      <text x={x + 150} y={y + 17} textAnchor="middle" style={{ fontSize: 9.5, fill: '#3a4644', fontWeight: 600 }}>antes</text>
      <text x={x + 248} y={y + 17} textAnchor="middle" style={{ fontSize: 9.5, fill: '#3a4644', fontWeight: 600 }}>después</text>
      {[0, 1].map((row) => (
        <g key={row}>
          <text x={x + 12} y={y + 39 + row * 30} style={{ fontSize: 10, fill: '#3a4644', fontWeight: 700 }}>Puerta {row + 1}</text>
          <Lcd x={x + 102} y={y + 22 + row * 30} w={96} h={26} text={cells[row * 2]} unit="ms" />
          <Lcd x={x + 200} y={y + 22 + row * 30} w={96} h={26} text={cells[row * 2 + 1]} unit="ms" />
        </g>
      ))}
    </g>
  );
}

const DASH = '-----';
/** Formato que evita mostrar «−0,0000» por redondeo. */
const f0 = (v: number, d: number) => fmt(Math.abs(v) < 0.5 * 10 ** -d ? 0 : v, d);
const msText = (dt: number | null) => (dt === null ? DASH : fmt(dt * 1000, 1));

export default function CollisionsLab({ api }: LabProps) {
  const [type, setType] = useState<CollisionType>('elastico');
  const [m1, setM1] = useState(0.3);
  const [m2, setM2] = useState(0.2);
  const [v1, setV1] = useState(0.5);
  const [v2, setV2] = useState(-0.3);
  const [e, setE] = useState(0.5);
  const [energy, setEnergy] = useState(0.05);
  const [weighed, setWeighed] = useState<'1' | '2'>('1');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const raf = useRef(0);

  const res = useMemo(() => simulateCollision({ type, m1, m2, v1, v2, e, energy }), [type, m1, m2, v1, v2, e, energy]);
  const tl = useMemo(() => timeline(res), [res]);
  const samples = useMemo(() => (done ? contactSamples(res) : []), [done, res]);

  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setDone(false); setT(0); };
  useEffect(reset, [type, m1, m2, v1, v2, e, energy]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(tl.tEnd); setRunning(false); setDone(true); return; }
    // Reproducción acelerada si el registro dura más de 6 s (deslizadores lentos).
    const rate = Math.max(1, tl.tEnd / 6);
    const start = performance.now();
    const tick = (now: number) => {
      const sim = Math.max(0, (now - start) / 1000) * rate;
      if (sim >= tl.tEnd) { setT(tl.tEnd); setRunning(false); setDone(true); return; }
      setT(sim);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, tl]);

  const st = useMemo(() => stateAt(res, tl, Math.min(Math.max(0, t), tl.tEnd)), [res, tl, t]);
  const x1px = px(st.x1), x2px = px(st.x2);
  const pastContact = res.collides && t >= tl.tContact;
  const g = res.gates;
  const m = res.measured;
  const isExplosion = type === 'explosion';
  const bumper: Bumper = type === 'inelastico' ? 'velcro' : isExplosion ? 'lanzador' : 'resorte';
  // Longitud visible del resorte: se comprime cuando los deslizadores se tocan (deformación ×2 para que se note).
  const gapPx = (x2px - GL / 2) - (x1px + GL / 2);
  const springLen = 10 + Math.min(0, gapPx * 2);
  const xcmPx = px((res.m1 * st.x1 + res.m2 * st.x2) / (res.m1 + res.m2));
  const flagBlocks = (gx: number) => Math.abs(x1px - gx) < FLAG / 2 || Math.abs(x2px - gx) < FLAG / 2;
  const G1 = px(RAIL.gate1), G2 = px(RAIL.gate2);
  const cells: [string, string, string, string] = [
    pastContact || done ? msText(g.before1) : DASH, done ? msText(g.after1) : DASH,
    pastContact || done ? msText(g.before2) : DASH, done ? msText(g.after2) : DASH,
  ];
  const label1 = !pastContact ? `v₁ = ${fmt(res.model.v1, 2)} m/s` : done ? `v₁′ = ${f0(m.v1f, 3)} m/s` : 'v₁′';
  const label2 = !pastContact ? `v₂ = ${fmt(res.model.v2, 2)} m/s` : done ? `v₂′ = ${f0(m.v2f, 3)} m/s` : 'v₂′';
  const typeName = COLLISION_TYPES.find((c) => c.id === type)!;

  const dtText = (dt: number | null) => (dt === null ? 'no pasa (en reposo)' : `${fmt(dt * 1000, 1)} ms`);
  const show = (s: string) => (done ? s : '—');

  const record = () => api.addTrial('choques', {
    tipo: typeName.short, m1, m2,
    v1: isExplosion ? 0 : v1, v2: isExplosion ? 0 : v2,
    e: isExplosion ? null : res.e,
    v1f: Number(m.v1f.toFixed(4)), v2f: Number(m.v2f.toFixed(4)),
    pAntes: Number(m.pBefore.toFixed(5)), pDespues: Number(m.pAfter.toFixed(5)),
    ecAntes: Number(m.ecBefore.toFixed(5)), ecDespues: Number(m.ecAfter.toFixed(5)),
    ecPerdida: Number(m.ecLost.toFixed(5)),
  });

  const desc = !res.collides
    ? 'Los deslizadores no se alcanzan: el deslizador 1 no es más rápido hacia la derecha que el 2.'
    : done
      ? `Después de la interacción el deslizador 1 se mueve a ${f0(m.v1f, 3)} m/s y el 2 a ${f0(m.v2f, 3)} m/s. Cantidad de movimiento total: ${f0(m.pBefore, 4)} kg·m/s antes y ${f0(m.pAfter, 4)} kg·m/s después.`
      : running ? 'Los deslizadores se mueven por el riel de aire.' : 'Los deslizadores esperan en el riel de aire, listos para lanzarse.';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="cho-t cho-d">
            <title id="cho-t">Riel de aire con dos deslizadores, dos fotopuertas, temporizador y balanza</title>
            <desc id="cho-d">{desc}</desc>
            <CollisionDefs />
            <BenchTop y={BENCH_Y} width={W} />
            {/* cables de las fotopuertas al temporizador */}
            <path d={`M${G1 + 2} ${GY} C ${G1 + 2} 120, 340 60, 314 44`} fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <path d={`M${G2 + 2} ${GY} C ${G2 + 2} 110, 380 80, 314 74`} fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <GateTimer cells={cells} />
            <DigitalBalance x={548} y={80} w={196} reading={fmt((weighed === '1' ? res.balance1 : res.balance2), 1)}>
              <Glider cx={646} base={68} mass={weighed === '1' ? m1 : m2} color={weighed === '1' ? 'var(--series-1)' : 'var(--series-2)'} name={weighed === '1' ? 'D1' : 'D2'}
                bumperSide={weighed === '1' ? 'right' : 'left'} bumper={weighed === '1' ? bumper : type === 'inelastico' ? 'velcro' : 'placa'} bumperLen={10} onRail={false} />
            </DigitalBalance>
            <AirTrack blowing={running || done || t > 0} />
            <GateBack x={G1} label="Fotopuerta 1" />
            <GateBack x={G2} label="Fotopuerta 2" />
            {/* marcador del centro de masa */}
            <g>
              <path d={`M${xcmPx} ${RY + 27} l-5 8 h10 Z`} fill="var(--warn)" />
              <text x={xcmPx} y={RY + 46} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--warn)', fontWeight: 700 }}>CM</text>
            </g>
            <Glider cx={x1px} base={RY} mass={m1} color="var(--series-1)" name="D1" bumperSide="right" bumper={bumper} bumperLen={springLen} />
            <Glider cx={x2px} base={RY} mass={m2} color="var(--series-2)" name="D2" bumperSide="left" bumper={type === 'inelastico' ? 'velcro' : 'placa'} bumperLen={10} />
            {isExplosion && t < tl.tContact && (
              <path d={`M${x1px + BODY / 2 - 2} ${RY - 18} Q ${(x1px + x2px) / 2} ${RY - 24} ${x2px - BODY / 2 + 2} ${RY - 18}`} fill="none" stroke="#c9a227" strokeWidth="1.2" />
            )}
            <GateHead x={G1} blocked={flagBlocks(G1)} />
            <GateHead x={G2} blocked={flagBlocks(G2)} />
            {res.collides && (
              <>
                <VelocityArrow x={x1px} y={RY - 104} v={st.v1} color="var(--series-1)" label={label1} />
                <VelocityArrow x={x2px} y={RY - 120} v={st.v2} color="var(--series-2)" label={label2} />
              </>
            )}
            {/* escala del riel */}
            <text x={px(0)} y={RY + 36} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>0</text>
            <text x={px(1)} y={RY + 36} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>1,0 m</text>
            <text x={px(2)} y={RY + 36} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>2,0 m</text>
          </svg>
        </div>

        <div className="grid-2">
          <div className="stack">
            <h3>Fotopuertas (bandera de 10,0 cm)</h3>
            <Readout items={[
              { k: 'Δt₁ antes', v: show(dtText(g.before1)), data: true },
              { k: 'Δt₂ antes', v: show(dtText(g.before2)), data: true },
              { k: 'Δt₁ después', v: show(dtText(g.after1)), data: true },
              { k: 'Δt₂ después', v: show(dtText(g.after2)), data: true },
            ]} />
            <h3>Velocidades (v = L/Δt)</h3>
            <Readout items={[
              { k: 'v₁ antes', v: show(`${f0(m.v1, 3)} m/s`) },
              { k: 'v₂ antes', v: show(`${f0(m.v2, 3)} m/s`) },
              { k: 'v₁ después', v: show(`${f0(m.v1f, 3)} m/s`), data: true },
              { k: 'v₂ después', v: show(`${f0(m.v2f, 3)} m/s`), data: true },
            ]} />
          </div>
          <div className="stack">
            <h3>Balanza (0,1 g)</h3>
            <Readout live={false} items={[
              { k: 'm₁', v: `${fmt(res.balance1, 1)} g` },
              { k: 'm₂', v: `${fmt(res.balance2, 1)} g` },
            ]} />
            <h3>Totales del sistema</h3>
            <Readout items={[
              { k: 'p total antes', v: show(`${f0(m.pBefore, 4)} kg·m/s`) },
              { k: 'p total después', v: show(`${f0(m.pAfter, 4)} kg·m/s`), data: true },
              { k: 'Ec total antes', v: show(`${f0(m.ecBefore, 4)} J`) },
              { k: 'Ec total después', v: show(`${f0(m.ecAfter, 4)} J`), data: true },
              { k: 'Ec transformada', v: show(`${f0(m.ecLost, 4)} J`), data: true },
            ]} />
          </div>
        </div>

        <details className="card">
          <summary>Gráficas de p(t) y Ec(t) durante el contacto (después de lanzar)</summary>
          <div className="stack">
            <Chart title="Cantidad de movimiento durante el contacto" xLabel="Tiempo desde el inicio del contacto (ms)" yLabel="p (kg·m/s)" xUnit="ms" yUnit="kg·m/s" height={230}
              exportName="choques-cantidad-de-movimiento"
              series={samples.length ? [
                { label: 'p₁ (deslizador 1)', color: 'var(--series-1)', kind: 'line', points: samples.map((q) => ({ x: q.t, y: q.p1 })) },
                { label: 'p₂ (deslizador 2)', color: 'var(--series-2)', kind: 'line', points: samples.map((q) => ({ x: q.t, y: q.p2 })) },
                { label: 'p total', color: 'var(--series-8)', kind: 'line', dashed: true, points: samples.map((q) => ({ x: q.t, y: q.p })) },
              ] : []} emptyText="Lanza los deslizadores para ver la gráfica." />
            <Chart title="Energía cinética durante el contacto" xLabel="Tiempo desde el inicio del contacto (ms)" yLabel="Ec (J)" xUnit="ms" yUnit="J" height={230}
              exportName="choques-energia-cinetica"
              series={samples.length ? [
                { label: 'Ec₁ (deslizador 1)', color: 'var(--series-1)', kind: 'line', points: samples.map((q) => ({ x: q.t, y: q.ec1 })) },
                { label: 'Ec₂ (deslizador 2)', color: 'var(--series-2)', kind: 'line', points: samples.map((q) => ({ x: q.t, y: q.ec2 })) },
                { label: 'Ec total', color: 'var(--series-8)', kind: 'line', dashed: true, points: samples.map((q) => ({ x: q.t, y: q.ec })) },
              ] : []} emptyText="Lanza los deslizadores para ver la gráfica." />
            <p className="small muted">Las curvas muestran el modelo con un contacto de {fmt(res.contactTime * 1000, 0)} ms y fuerza de perfil de medio seno.</p>
          </div>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Select label="Tipo de interacción" value={type} onChange={(v) => setType(v as CollisionType)}
            options={COLLISION_TYPES.map((c) => ({ value: c.id, label: c.name }))} />
          <Slider label="Masa del deslizador 1" value={m1} min={COLLISION_LIMITS.mass[0]} max={COLLISION_LIMITS.mass[1]} step={0.05} unit="kg" decimals={2} onChange={setM1} />
          <Slider label="Masa del deslizador 2" value={m2} min={COLLISION_LIMITS.mass[0]} max={COLLISION_LIMITS.mass[1]} step={0.05} unit="kg" decimals={2} onChange={setM2} />
          {!isExplosion && (
            <>
              <Slider label="Velocidad inicial del deslizador 1" value={v1} min={COLLISION_LIMITS.velocity[0]} max={COLLISION_LIMITS.velocity[1]} step={0.05} unit="m/s" decimals={2} onChange={setV1}
                hint="Positiva hacia la derecha." />
              <Slider label="Velocidad inicial del deslizador 2" value={v2} min={COLLISION_LIMITS.velocity[0]} max={COLLISION_LIMITS.velocity[1]} step={0.05} unit="m/s" decimals={2} onChange={setV2} />
            </>
          )}
          {type === 'parcial' && (
            <Slider label="Coeficiente de restitución" value={e} min={0} max={1} step={0.05} decimals={2} onChange={setE}
              hint="1: elástico; 0: quedan unidos." />
          )}
          {isExplosion && (
            <Slider label="Energía del resorte comprimido" value={energy} min={COLLISION_LIMITS.energy[0]} max={COLLISION_LIMITS.energy[1]} step={0.01} unit="J" decimals={2} onChange={setEnergy}
              hint="Ambos deslizadores parten del reposo, unidos por un hilo." />
          )}
          <Segmented label="Deslizador en la balanza" value={weighed} onChange={setWeighed}
            options={[{ value: '1', label: 'Deslizador 1' }, { value: '2', label: 'Deslizador 2' }]} />
          {!res.collides && <Notice kind="warn">Los deslizadores no se alcanzan: para que choquen, el deslizador 1 debe ir hacia la derecha más rápido que el 2 (v₁ &gt; v₂).</Notice>}
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={running || !res.collides}
              onClick={() => { cancelAnimationFrame(raf.current); setT(0); setDone(false); setRunning(true); }}>Lanzar</button>
            <button type="button" className="btn" onClick={reset}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>Riel horizontal sin fricción; el contacto dura unas decenas de milisegundos. Cada fotopuerta de doble haz registra el tiempo de paso de la bandera y el sentido del movimiento.</Notice>
      </div>
    </div>
  );
}

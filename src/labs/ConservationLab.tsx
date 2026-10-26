import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  airDensity, extentAt, reactionById, readingAt, REACTIONS, simulateConservation,
  type ReactionId, type SystemId,
} from '../models/massConservation';
import { seededRandom } from '../models/math';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings, resolutionText } from '../components/ui';
import { SimControls, simStatusOf } from '../components/Experiment';
import type { LabProps } from './registry';
import { BenchTop, Beaker, DigitalBalance, Erlenmeyer, shade, TestTube } from './kit';

/* ------------------------------------------------------------------ textos de la interfaz */

const MASS_LABEL: Record<ReactionId, string> = {
  bicarbonato: 'Masa de bicarbonato de sodio',
  efervescente: 'Masa de pastilla efervescente',
  precipitacion: 'Masa de carbonato de sodio',
  oxidacion: 'Masa de lana de acero',
};
const VOLUME_LABEL: Record<ReactionId, string> = {
  bicarbonato: 'Volumen de vinagre',
  efervescente: 'Volumen de agua',
  precipitacion: 'Volumen de solución de CaCl₂',
  oxidacion: '',
};
const SYSTEM_LABEL: Record<SystemId, string> = { abierto: 'Abierto', globo: 'Cerrado con globo', sellado: 'Frasco sellado' };
/** Duración de la animación de cada reacción (s). */
const DURATION: Record<ReactionId, number> = { bicarbonato: 4, efervescente: 5, precipitacion: 3, oxidacion: 4 };

type Phase = 'listo' | 'pesado' | 'reaccionando' | 'pausa' | 'terminado';

const signed = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;

/* ------------------------------------------------------------------ geometría */

const PLATE = 274; // cara superior del plato de la balanza
const FL = { x: 270, y: 118, w: 100, h: PLATE - 118 }; // Erlenmeyer
const JAR = { x: 262, y: 142, w: 116, h: PLATE - 142 }; // frasco sellado
const CX = 320;

/** Nivel del líquido y semiancho del Erlenmeyer del kit (misma geometría que kit.tsx). */
function erlGeometry(fill: number) {
  const { y, w, h } = FL;
  const neckW = w * 0.28, neckH = h * 0.3;
  const f = Math.max(0, Math.min(1, fill));
  const ly = y + h - 3 - (h - neckH - 6) * f;
  const halfAt = (yy: number) => neckW / 2 + ((w / 2 - 4 - neckW / 2) * (yy - (y + neckH))) / (h - 10 - neckH);
  return { ly, halfAt, neckW, bottom: y + h - 6 };
}

/* ------------------------------------------------------------------ piezas del banco */

function ConservationDefs() {
  return (
    <defs>
      <radialGradient id="cms-balloon" cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#ff8a80" />
        <stop offset="0.45" stopColor="#e53935" />
        <stop offset="1" stopColor="#9a1b17" />
      </radialGradient>
      <linearGradient id="cms-porcelain" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#d9d3c7" />
      </linearGradient>
      <radialGradient id="cms-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd54f" stopOpacity="0.95" />
        <stop offset="0.5" stopColor="#ff8f00" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ff6f00" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="cms-amber" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#7a4a12" />
        <stop offset="0.35" stopColor="#b8742a" />
        <stop offset="1" stopColor="#6a3e0e" />
      </linearGradient>
    </defs>
  );
}

/** Frasco de reactivo de vidrio ámbar con etiqueta. */
function ReagentBottle({ x, label }: { x: number; label: string }) {
  const base = 352, w = 54, top = 236;
  return (
    <g aria-hidden="true">
      <g filter="url(#kit-shadow-soft)">
        <path d={`M${x + 4} ${top + 30} Q${x + 4} ${top + 18} ${x + 16} ${top + 16} L${x + w - 16} ${top + 16} Q${x + w - 4} ${top + 18} ${x + w - 4} ${top + 30} L${x + w - 4} ${base - 4} Q${x + w - 4} ${base} ${x + w - 8} ${base} L${x + 8} ${base} Q${x + 4} ${base} ${x + 4} ${base - 4} Z`} fill="url(#cms-amber)" stroke="#4e2f08" strokeWidth="0.8" />
      </g>
      <rect x={x + 15} y={top} width={w - 30} height={18} rx={2} fill="url(#kit-body-dark)" />
      <rect x={x + 9} y={top + 44} width={w - 18} height={34} rx={2} fill="#fbfaf5" stroke="#d6cfbf" strokeWidth="0.6" />
      <text x={x + w / 2} y={top + 60} textAnchor="middle" style={{ fontSize: 10, fill: '#2b2b2b', fontWeight: 700 }}>{label}</text>
      <line x1={x + 13} x2={x + w - 13} y1={top + 68} y2={top + 68} stroke="#c62828" strokeWidth="1.2" />
      <rect x={x + 8} y={top + 30} width={3} height={base - top - 40} rx={1.5} fill="#fff" opacity="0.3" />
    </g>
  );
}

/** Cuchara-espátula metálica apoyada en la mesa. */
function Spoon({ x, y, powder }: { x: number; y: number; powder: boolean }) {
  return (
    <g aria-hidden="true">
      <ellipse cx={x + 40} cy={y + 4} rx={44} ry={2.4} fill="#000" opacity="0.12" />
      <path d={`M${x} ${y} L${x + 62} ${y - 3} L${x + 62} ${y + 1} L${x} ${y + 3} Z`} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.6" />
      <ellipse cx={x + 72} cy={y - 1} rx={12} ry={5} fill="url(#kit-metal)" stroke="#8c979b" strokeWidth="0.8" />
      {powder && <ellipse cx={x + 72} cy={y - 3} rx={8} ry={3} fill="#f7f7f2" stroke="#d0d0c8" strokeWidth="0.5" />}
    </g>
  );
}

/** Frasco de vidrio con tapa metálica de rosca. */
function SealedJar({ fill, liquid, liquidOpacity = 0.5, electrodes, children }: { fill: number; liquid: string; liquidOpacity?: number; electrodes?: boolean; children?: ReactNode }) {
  const { x, y, w, h } = JAR;
  const body = `M${x + 10} ${y + 8} L${x + w - 10} ${y + 8} Q${x + w} ${y + 10} ${x + w} ${y + 24} L${x + w} ${y + h - 10} Q${x + w} ${y + h} ${x + w - 10} ${y + h} L${x + 10} ${y + h} Q${x} ${y + h} ${x} ${y + h - 10} L${x} ${y + 24} Q${x} ${y + 10} ${x + 10} ${y + 8} Z`;
  const ly = y + h - 4 - (h - 30) * Math.max(0, Math.min(1, fill));
  return (
    <g>
      <path d={body} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
      {fill > 0 && (
        <g>
          <path d={`M${x + 3} ${ly} L${x + w - 3} ${ly} L${x + w - 3} ${y + h - 10} Q${x + w - 3} ${y + h - 3} ${x + w - 10} ${y + h - 3} L${x + 10} ${y + h - 3} Q${x + 3} ${y + h - 3} ${x + 3} ${y + h - 10} Z`} fill={liquid} opacity={liquidOpacity} />
          <path d={`M${x + 3} ${ly} L${x + w - 3} ${ly} L${x + w - 3} ${y + h - 10} L${x + 3} ${y + h - 10} Z`} fill="url(#kit-liquid-shade)" />
          <line x1={x + 3} x2={x + w - 3} y1={ly} y2={ly} stroke={shade(liquid, -0.3)} strokeWidth="1.3" opacity="0.8" />
        </g>
      )}
      {children}
      <path d={body} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <rect x={x + 7} y={y + 22} width={3} height={h - 36} rx={1.5} fill="#fff" opacity="0.45" />
      {/* tapa de rosca */}
      <g filter="url(#kit-shadow-soft)">
        <rect x={x + 6} y={y - 8} width={w - 12} height={18} rx={3} fill="url(#kit-metal)" stroke="#8c979b" />
      </g>
      {[0, 1, 2, 3].map((i) => <line key={i} x1={x + 10} x2={x + w - 10} y1={y - 4 + i * 4} y2={y - 4 + i * 4} stroke="#9aa5a9" strokeWidth="0.6" />)}
      {electrodes && [CX - 14, CX + 14].map((ex) => (
        <g key={ex}>
          <rect x={ex - 2} y={y - 16} width={4} height={10} fill="#263033" />
          <line x1={ex} x2={ex} y1={y + 10} y2={y + 96} stroke="#6d7b80" strokeWidth="1.6" />
        </g>
      ))}
    </g>
  );
}

/** Cápsula de porcelana (sistema abierto para la combustión). */
function Capsule() {
  return (
    <g filter="url(#kit-shadow-soft)">
      <path d={`M${CX - 56} ${PLATE - 26} Q${CX} ${PLATE - 32} ${CX + 56} ${PLATE - 26} Q${CX + 50} ${PLATE} ${CX} ${PLATE} Q${CX - 50} ${PLATE} ${CX - 56} ${PLATE - 26} Z`} fill="url(#cms-porcelain)" stroke="#b9b2a3" />
      <ellipse cx={CX} cy={PLATE - 26} rx={56} ry={5} fill="#efeae0" stroke="#b9b2a3" />
      <path d={`M${CX + 56} ${PLATE - 27} l10 -3`} stroke="#b9b2a3" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

/** Ovillo de lana de acero: fibras plateadas que se ennegrecen al oxidarse. */
function SteelWool({ cx, cy, rx, ry, burnt, fibers }: { cx: number; cy: number; rx: number; ry: number; burnt: number; fibers: { a: number; b: number; r: number; s: number }[] }) {
  const mix = (a: number[], b: number[]) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * burnt)).join(', ')})`;
  const c1 = mix([141, 150, 156], [46, 44, 48]);
  const c2 = mix([200, 207, 211], [80, 76, 82]);
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={c1} opacity="0.35" />
      {fibers.map((f, i) => {
        const x1 = cx + Math.cos(f.a) * rx * f.r, y1 = cy + Math.sin(f.a) * ry * f.r;
        const x2 = cx + Math.cos(f.b) * rx * f.r, y2 = cy + Math.sin(f.b) * ry * f.r;
        return <path key={i} d={`M${x1} ${y1} Q${cx + (f.s - 0.5) * rx} ${cy - ry * (0.6 + f.s)} ${x2} ${y2}`} fill="none" stroke={i % 3 === 0 ? c2 : c1} strokeWidth={0.8 + (i % 2) * 0.5} />;
      })}
    </g>
  );
}

/** Globo de látex: flácido (con el sólido dentro) o inflado con radio r. */
function Balloon({ inflated, r, powder }: { inflated: boolean; r: number; powder: boolean }) {
  const neckTop = FL.y;
  if (!inflated) {
    return (
      <g>
        <rect x={CX - 11} y={neckTop - 4} width={22} height={10} rx={3} fill="#c62828" />
        <path d={`M${CX - 8} ${neckTop - 2} C${CX - 6} ${neckTop - 24} ${CX + 26} ${neckTop - 28} ${CX + 34} ${neckTop - 10} C${CX + 42} ${neckTop + 6} ${CX + 34} ${neckTop + 30} ${CX + 22} ${neckTop + 30} C${CX + 12} ${neckTop + 30} ${CX + 12} ${neckTop + 12} ${CX + 8} ${neckTop - 2} Z`} fill="url(#cms-balloon)" stroke="#8e1b17" strokeWidth="0.8" />
        {powder && <ellipse cx={CX + 24} cy={neckTop + 20} rx={7} ry={4} fill="#f7f7f2" opacity="0.85" />}
      </g>
    );
  }
  const cy = neckTop - 12 - r * 1.05;
  return (
    <g>
      <path d={`M${CX - 9} ${neckTop + 4} L${CX - 7} ${neckTop - 12} L${CX + 7} ${neckTop - 12} L${CX + 9} ${neckTop + 4} Z`} fill="#c62828" />
      <ellipse cx={CX} cy={cy} rx={r} ry={r * 1.08} fill="url(#cms-balloon)" stroke="#8e1b17" strokeWidth="0.8" />
      <ellipse cx={CX - r * 0.38} cy={cy - r * 0.45} rx={r * 0.18} ry={r * 0.28} fill="#fff" opacity="0.45" transform={`rotate(-25 ${CX - r * 0.38} ${cy - r * 0.45})`} />
    </g>
  );
}

/** Montoncito de polvo o pastilla sobre el papel de pesar. */
function WeighingPaper({ item }: { item: 'polvo' | 'pastilla' | null }) {
  const x = 382, y = PLATE - 1;
  return (
    <g>
      <path d={`M${x} ${y} L${x + 52} ${y} L${x + 56} ${y - 5} L${x + 4} ${y - 5} Z`} fill="#fbfbf7" stroke="#cfcfc6" strokeWidth="0.7" />
      {item === 'polvo' && <path d={`M${x + 12} ${y - 4} Q${x + 28} ${y - 18} ${x + 44} ${y - 4} Z`} fill="#f4f4ee" stroke="#cfcfc6" strokeWidth="0.7" />}
      {item === 'pastilla' && (
        <g>
          <rect x={x + 10} y={y - 12} width={36} height={8} rx={4} fill="#f2f0e6" stroke="#c9c5b5" strokeWidth="0.8" />
          <ellipse cx={x + 28} cy={y - 12} rx={18} ry={3} fill="#fbfaf3" stroke="#c9c5b5" strokeWidth="0.6" />
        </g>
      )}
    </g>
  );
}

/** Pila de 9 V con terminales. */
function Battery({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden="true">
      <g filter="url(#kit-shadow-soft)">
        <rect x={x} y={y} width={36} height={58} rx={3} fill="#263238" />
        <rect x={x} y={y + 20} width={36} height={38} rx={3} fill="#f9a825" />
      </g>
      <rect x={x + 6} y={y - 6} width={8} height={7} rx={1.5} fill="url(#kit-metal)" />
      <path d={`M${x + 22} ${y - 6} h8 v7 h-8 Z`} fill="url(#kit-metal)" />
      <text x={x + 18} y={y + 44} textAnchor="middle" style={{ fontSize: 11, fill: '#263238', fontWeight: 800 }}>9 V</text>
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function ConservationLab({ api }: LabProps) {
  const [reaction, setReaction] = useState<ReactionId>('bicarbonato');
  const [system, setSystem] = useState<SystemId>('abierto');
  const [mass, setMass] = useState(2);
  const [volume, setVolume] = useState(50);
  const [phase, setPhase] = useState<Phase>('listo');
  const [t, setT] = useState(0);
  const raf = useRef(0);

  const rx = reactionById(reaction);
  const duration = DURATION[reaction];
  const res = useMemo(() => {
    const m = Math.max(rx.massRange[0], Math.min(rx.massRange[1], mass));
    const v = rx.liquid ? Math.max(rx.volumeRange[0], Math.min(rx.volumeRange[1], volume)) : 0;
    return simulateConservation({ reaction, system: rx.systems.includes(system) ? system : 'abierto', reactantMass: m, liquidVolume: v });
  }, [reaction, system, mass, volume, rx]);

  // Fibras de la lana de acero, burbujas y chispas: posiciones fijas (semilla) para un dibujo estable.
  const fibers = useMemo(() => {
    const rnd = seededRandom(17);
    return Array.from({ length: 34 }, () => ({ a: rnd() * Math.PI * 2, b: rnd() * Math.PI * 2, r: 0.35 + rnd() * 0.65, s: rnd() }));
  }, []);
  const bubbles = useMemo(() => {
    const rnd = seededRandom(5);
    return Array.from({ length: 22 }, () => ({ u: rnd() * 2 - 1, phase: rnd(), speed: 0.6 + rnd() * 0.9, r: 1.4 + rnd() * 2.4 }));
  }, []);
  const sparks = useMemo(() => {
    const rnd = seededRandom(11);
    return Array.from({ length: 16 }, () => ({ ang: -Math.PI * (0.1 + rnd() * 0.8), len: 10 + rnd() * 22, phase: rnd() }));
  }, []);

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setT(0); };

  useEffect(() => {
    if (phase !== 'reaccionando') return;
    if (prefersReducedMotion()) { setT(duration); setPhase('terminado'); return; }
    // Al reanudar tras una pausa, la reacción sigue desde el avance ya alcanzado.
    const start = performance.now() - t * 1000;
    const tick = (now: number) => {
      const el = Math.max(0, (now - start) / 1000);
      if (el >= duration) { setT(duration); setPhase('terminado'); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, duration]);

  const changeReaction = (id: string) => {
    const r = reactionById(id as ReactionId);
    setReaction(r.id);
    setMass(r.initialMass);
    setVolume(r.initialVolume);
    if (!r.systems.includes(system)) setSystem('abierto');
    reset();
  };

  const weighed = phase !== 'listo';
  const started = phase === 'reaccionando' || phase === 'pausa' || phase === 'terminado';
  const done = phase === 'terminado';
  const extent = started ? extentAt(t, duration) : 0;
  const rate = started && !done ? Math.max(0, 1 - extent) : 0;
  const current = readingAt(res, extent);
  const lcdText = weighed ? fmt(current, 2) : '- - - -';
  const isOx = reaction === 'oxidacion';
  const sys = res.container.id;
  // Mientras la reacción avanza en pantalla: efervescencia (gas) o chisporroteo de la lana de acero.
  useSoundLoop(isOx ? 'hotplate' : 'fizzing', phase === 'reaccionando' && reaction !== 'precipitacion', 0.4 + 0.6 * rate);

  const record = () => api.addTrial('pesadas', {
    reaccion: rx.name,
    sistema: SYSTEM_LABEL[sys],
    masaReactivo: mass,
    volumenAcido: rx.liquid ? volume : null,
    masaInicial: res.readingInitial,
    masaFinal: res.readingFinal,
    diferencia: res.difference,
    gasProducido: Number(res.gasProduced.toFixed(4)),
  });

  /* ---------- dibujo del recipiente */
  const fillErl = Math.max(0.05, Math.min(0.85, volume / 320));
  const geo = erlGeometry(fillErl);
  const fillJar = Math.max(0.05, Math.min(0.9, volume / 240));
  const jarLy = JAR.y + JAR.h - 4 - (JAR.h - 30) * fillJar;
  const liquidColor = rx.liquidColor;
  const precipitate = reaction === 'precipitacion' ? extent : 0;
  const balloonR = sys === 'globo' && started ? 9 + 15 * Math.cbrt((res.balloonVolume * extent) / 250) : 0;
  const reduced = typeof window !== 'undefined' && prefersReducedMotion();

  /** Burbujas que suben por el líquido entre yTop y yBottom, con semiancho halfAt(y). */
  const renderBubbles = (yTop: number, yBottom: number, halfAt: (yy: number) => number) => {
    if (rate <= 0 || reduced || reaction === 'precipitacion' || isOx) return null;
    const visible = Math.round(bubbles.length * Math.min(1, rate * 1.4));
    return bubbles.slice(0, visible).map((b, i) => {
      const prog = (t * b.speed + b.phase) % 1;
      const by = yBottom - prog * (yBottom - yTop - 4);
      const bx = CX + b.u * Math.max(4, halfAt(by) - 6);
      return <circle key={i} cx={bx} cy={by} r={b.r} fill="#ffffff" fillOpacity="0.55" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="0.7" />;
    });
  };

  /** Turbidez y sedimento del precipitado de CaCO₃. */
  const renderPrecipitate = (yTop: number, yBottom: number, halfAt: (yy: number) => number) => {
    if (precipitate <= 0) return null;
    return (
      <g>
        {bubbles.map((b, i) => {
          const by = yTop + 6 + ((b.phase + i * 0.13) % 1) * (yBottom - yTop - 10);
          return <circle key={i} cx={CX + b.u * Math.max(3, halfAt(by) - 6)} cy={by} r={1.2} fill="#ffffff" opacity={0.85 * precipitate} />;
        })}
        <path d={`M${CX - halfAt(yBottom) + 4} ${yBottom} Q${CX} ${yBottom - 7 * precipitate} ${CX + halfAt(yBottom) - 4} ${yBottom} Z`} fill="#fbfbf8" opacity={0.95 * precipitate} />
      </g>
    );
  };

  let vessel: ReactNode;
  if (isOx) {
    const burnt = extent;
    const wool = <SteelWool cx={CX} cy={sys === 'abierto' ? PLATE - 36 : PLATE - 26} rx={34} ry={14} burnt={burnt} fibers={fibers} />;
    const glow = rate > 0 && (
      <g>
        <ellipse cx={CX} cy={sys === 'abierto' ? PLATE - 36 : PLATE - 26} rx={48 * (0.6 + rate * 0.4)} ry={24 * (0.6 + rate * 0.4)} fill="url(#cms-glow)" />
        {!reduced && sparks.map((s, i) => {
          const p = (t * 1.6 + s.phase) % 1;
          const ox = CX + Math.cos(s.ang) * (8 + p * s.len * 1.6), oy = (sys === 'abierto' ? PLATE - 40 : PLATE - 30) + Math.sin(s.ang) * (6 + p * s.len * 1.6);
          return <line key={i} x1={ox} y1={oy} x2={ox + Math.cos(s.ang) * 5} y2={oy + Math.sin(s.ang) * 5} stroke="#ffb300" strokeWidth="1.6" strokeLinecap="round" opacity={rate * (1 - p)} />;
        })}
      </g>
    );
    vessel = sys === 'abierto'
      ? (
        <g>
          <Capsule />
          {wool}
          {glow}
          {rate > 0 && [CX - 40, CX, CX + 40].map((ax) => (
            <g key={ax} opacity={0.4 + rate * 0.6}>
              <line x1={ax} x2={ax} y1={150} y2={190} stroke="var(--qui)" strokeWidth="2" />
              <path d={`M${ax} 196 l-5 -8 h10 Z`} fill="var(--qui)" />
              <text x={ax + 6} y={160} style={{ fontSize: 11, fill: 'var(--qui)', fontWeight: 700 }}>O₂</text>
            </g>
          ))}
        </g>
      )
      : (
        <SealedJar fill={0} liquid="#000" electrodes>
          {wool}
          {glow}
        </SealedJar>
      );
  } else if (sys === 'sellado') {
    const halfJar = () => JAR.w / 2 - 6;
    vessel = (
      <SealedJar fill={fillJar} liquid={liquidColor} liquidOpacity={0.55}>
        {renderPrecipitate(jarLy, JAR.y + JAR.h - 6, halfJar)}
        {renderBubbles(jarLy, JAR.y + JAR.h - 6, halfJar)}
        {/* tubito con el sólido: de pie antes de mezclar, volcado después */}
        <g transform={started ? `rotate(62 ${JAR.x + 36} ${JAR.y + JAR.h - 10})` : undefined}>
          <TestTube x={JAR.x + 26} y={JAR.y + 30} w={18} h={JAR.h - 40} fill={started ? 0 : 0.28} liquid="#f4f4ee" liquidOpacity={0.95} />
        </g>
        {reaction === 'efervescente' && started && <ellipse cx={CX + 22} cy={JAR.y + JAR.h - 9} rx={16 * (1 - extent) + 0.1} ry={4 * (1 - extent) + 0.1} fill="#f2f0e6" stroke="#c9c5b5" strokeWidth="0.6" />}
      </SealedJar>
    );
  } else {
    const foam = reaction === 'bicarbonato' && rate > 0 ? 18 * rate : 0;
    vessel = (
      <g>
        <Erlenmeyer x={FL.x} y={FL.y} w={FL.w} h={FL.h} fill={fillErl} liquid={liquidColor} liquidOpacity={0.6}>
          {renderPrecipitate(geo.ly, geo.bottom, geo.halfAt)}
          {renderBubbles(geo.ly, geo.bottom, geo.halfAt)}
          {foam > 0 && (
            <path d={`M${CX - geo.halfAt(geo.ly - foam)} ${geo.ly - foam} Q${CX} ${geo.ly - foam - 6} ${CX + geo.halfAt(geo.ly - foam)} ${geo.ly - foam} L${CX + geo.halfAt(geo.ly)} ${geo.ly} L${CX - geo.halfAt(geo.ly)} ${geo.ly} Z`} fill="#fffdf4" opacity="0.85" />
          )}
          {reaction === 'efervescente' && started && <ellipse cx={CX} cy={geo.bottom - 2} rx={16 * (1 - extent) + 0.1} ry={4 * (1 - extent) + 0.1} fill="#f2f0e6" stroke="#c9c5b5" strokeWidth="0.6" />}
          {started && reaction !== 'efervescente' && extent < 0.3 && <ellipse cx={CX} cy={geo.ly + 3} rx={10} ry={2.5} fill="#f7f7f2" opacity={1 - extent / 0.3} />}
        </Erlenmeyer>
        {sys === 'abierto' && <WeighingPaper item={started ? null : reaction === 'efervescente' ? 'pastilla' : 'polvo'} />}
        {sys === 'globo' && <Balloon inflated={started && reaction !== 'precipitacion'} r={balloonR} powder={!started} />}
        {sys === 'abierto' && rate > 0 && reaction !== 'precipitacion' && !reduced && [0, 1, 2].map((k) => {
          const p = (t * 0.7 + k / 3) % 1;
          return (
            <text key={k} x={CX - 18 + k * 18 + Math.sin((p + k) * 6) * 6} y={FL.y - 6 - p * 70} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--qui)', fontWeight: 700 }} opacity={(1 - p) * rate}>CO₂</text>
          );
        })}
      </g>
    );
  }

  const balloonDone = sys === 'globo' && done && res.balloonVolume > 0;
  const sideItem = isOx
    ? <Battery x={520} y={292} />
    : <Beaker x={500} y={262} w={84} h={90} fill={0.55} liquid={liquidColor} liquidOpacity={0.6} label={reaction === 'efervescente' ? 'agua' : reaction === 'bicarbonato' ? 'vinagre' : 'CaCl₂ (ac)'} />;

  const desc = `${rx.name}; ${res.container.name}. ` +
    (!weighed ? 'La balanza está en espera.' : phase === 'pausa' ? `Reacción en pausa; la balanza marca ${fmt(current, 2)} g.` : started && !done ? `La reacción está ocurriendo; la balanza marca ${fmt(current, 2)} g.` : done ? `La reacción terminó; la balanza marca ${fmt(res.readingFinal, 2)} g.` : `La balanza marca ${fmt(res.readingInitial, 2)} g antes de mezclar.`) +
    (balloonDone ? ` El globo se infló hasta unos ${fmt(res.balloonVolume, 0)} mL.` : '');

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 380" role="img" aria-labelledby="cms-t cms-d">
            <title id="cms-t">Balanza digital con el sistema de reacción</title>
            <desc id="cms-d">{desc}</desc>
            <ConservationDefs />
            <text x="320" y="24" textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 600 }}>{rx.equation}</text>
            <BenchTop y={352} width={640} />
            <ReagentBottle x={36} label={rx.solidShort} />
            <Spoon x={100} y={346} powder={!isOx} />
            {sideItem}
            {isOx && sys === 'sellado' && rate > 0 && (
              <path d={`M${CX - 14} ${JAR.y - 16} C${CX - 30} 60, 470 60, 526 286 M${CX + 14} ${JAR.y - 16} C${CX + 20} 80, 480 80, 548 286`} fill="none" stroke="var(--ink-2)" strokeWidth="1.6" opacity="0.8" />
            )}
            <DigitalBalance x={180} y={276} w={280} reading={lcdText}>
              {vessel}
            </DigitalBalance>
            {balloonDone && (
              <g>
                <line x1={CX + 52} x2={CX + 52} y1={FL.y - 30} y2={FL.y - 70} stroke="var(--data)" strokeWidth="2.5" />
                <path d={`M${CX + 52} ${FL.y - 78} l-6 9 h12 Z`} fill="var(--data)" />
                <text x={CX + 60} y={FL.y - 56} style={{ fontSize: 12, fill: 'var(--data)', fontWeight: 700 }}>empuje E</text>
              </g>
            )}
            <text x="320" y="374" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Balanza digital · resolución 0,01 g</text>
          </svg>
        </div>
        <Readout live={false} items={[
          { k: 'Lectura durante la reacción', v: started ? `${fmt(current, 2)} g` : '—', data: true, resolution: resolutionText(0.01, 'g') },
          { k: 'Avance de la reacción', v: started ? `${fmt(extent * 100, 0)} %` : '—' },
        ]} />
        <Readout items={[
          { k: 'Masa inicial (balanza)', v: weighed ? `${fmt(res.readingInitial, 2)} g` : 'sin pesar', data: true, resolution: resolutionText(0.01, 'g') },
          { k: 'Masa final (balanza)', v: done ? `${fmt(res.readingFinal, 2)} g` : '—', data: true, resolution: resolutionText(0.01, 'g') },
          { k: 'Diferencia (final − inicial)', v: done ? `${signed(res.difference)} g` : '—', data: true },
          { k: 'Gas calculado (estequiometría)', v: done ? (isOx ? `O₂ fijado: ${fmt(res.oxygenFixed, 3)} g` : res.gasProduced > 0 ? `CO₂: ${fmt(res.gasProduced, 3)} g` : 'no se produce gas') : '—' },
          { k: 'Reactivo limitante', v: done ? res.limiting.limiting : '—' },
          ...(sys === 'globo' ? [{ k: 'Volumen del globo', v: done ? `${fmt(res.balloonVolume, 0)} mL` : '—' }] : []),
          ...(res.jarPressure !== null ? [{ k: 'Presión en el frasco', v: done ? `${fmt(res.jarPressure, 0)} kPa` : '—' }] : []),
        ]} />
        {done && <Warnings list={res.warnings} />}
        {balloonDone && (
          <div className="card stack-sm">
            <h3>Pensamiento crítico: ¿se perdió masa en el sistema cerrado?</h3>
            <p className="small">El globo está bien ajustado y no escapa gas, pero la balanza marca {fmt(Math.abs(res.difference), 2)} g menos. ¿Cómo lo explicas? Pista: el globo inflado ocupa {fmt(res.balloonVolume, 0)} mL de aire que antes no ocupaba.</p>
            <details>
              <summary>Ver la explicación</summary>
              <p className="small">El aire empuja hacia arriba todo lo que desplaza (principio de Arquímedes): E = ρ_aire·V·g = {fmt(airDensity() * 1000, 3)} kg/m³ × {fmt(res.balloonVolume / 1e6, 6)} m³ × 9,8 m/s² ≈ {fmt(res.buoyancyForce * 1000, 2)} mN, equivalente a {fmt(res.buoyancyLoss, 2)} g. La masa total sigue siendo {fmt(res.massFinal, 2)} g: la ley de Lavoisier se cumple. En el frasco rígido sellado el volumen exterior no cambia y la lectura no baja.</p>
            </details>
          </div>
        )}
        {done && sys === 'abierto' && res.exchanged !== 0 && (
          <Notice kind="ok">{isOx
            ? `El sistema ganó ${fmt(res.oxygenFixed, 2)} g: es el oxígeno del aire que se combinó con el hierro (3 Fe + 2 O₂ → Fe₃O₄).`
            : `El sistema perdió la masa del CO₂ que escapó al aire (${fmt(res.gasProduced, 2)} g calculados). Ciérralo para comprobar que la masa se conserva.`}</Notice>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Reacción y sistema</h3>
          <Select label="Reacción química" value={reaction} onChange={changeReaction}
            options={REACTIONS.map((r) => ({ value: r.id, label: r.name }))} />
          <Segmented<SystemId> label="Tipo de sistema" value={sys} onChange={(v) => { setSystem(v); reset(); }}
            options={rx.systems.map((s) => ({ value: s, label: s === 'abierto' ? (isOx ? 'Abierto (cápsula)' : 'Abierto (Erlenmeyer)') : SYSTEM_LABEL[s] }))} />
          <Slider label={MASS_LABEL[reaction]} value={mass} min={rx.massRange[0]} max={rx.massRange[1]} step={0.1} unit="g" decimals={2}
            onChange={(v) => { setMass(v); reset(); }} />
          {rx.liquid && (
            <Slider label={VOLUME_LABEL[reaction]} value={volume} min={rx.volumeRange[0]} max={rx.volumeRange[1]} step={5} unit="mL" decimals={0}
              onChange={(v) => { setVolume(v); reset(); }} hint={rx.liquid} />
          )}
          {/* Primero se pesa el sistema; el segundo paso inicia la reacción, que se puede pausar. */}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setPhase('pesado'); playSound('tare'); }} disabled={weighed}>1. Pesar el sistema inicial</button>
          </div>
          <SimControls title="Reacción en la balanza" status={simStatusOf(phase === 'reaccionando', phase === 'pausa', done)}
            startLabel={isOx ? '2. Encender la lana de acero' : '2. Mezclar los reactivos'} repeatLabel="Repetir la reacción" resetLabel="Reiniciar medición"
            disabled={phase === 'listo'} resetDisabled={phase === 'listo'}
            onStart={() => { setT(0); setPhase('reaccionando'); playSound(isOx ? 'switch' : 'pour', { duration: 0.8 }); }}
            onPause={() => { cancelAnimationFrame(raf.current); setPhase('pausa'); }} onResume={() => setPhase('reaccionando')} onReset={reset} />
          <RecordButton onRecord={record} disabled={!done} />
          {!done && <p className="small muted">Pesa el sistema, provoca la reacción y espera a que termine para guardar el ensayo.</p>}
        </div>
        <details className="card">
          <summary>Qué hay sobre el plato de la balanza</summary>
          <ul className="list small">
            {res.container.parts.map((p) => <li key={p.name}>{p.name}: {fmt(p.mass, 2)} g</li>)}
            {rx.liquid && <li>{rx.liquid}: {fmt(volume, 0)} mL × {fmt(rx.liquidDensity, 3)} g/mL = {fmt(volume * rx.liquidDensity, 2)} g</li>}
            <li>{rx.solid}: {fmt(mass, 2)} g</li>
          </ul>
        </details>
        <Notice>Simulación educativa a 25 °C y 1 atm: las reacciones son completas y en el sistema abierto todo el CO₂ escapa. Las lecturas se redondean a 0,01 g. Seguridad: usa gafas; la lana de acero se enciende con una pila de 9 V lejos de materiales inflamables.</Notice>
      </div>
    </div>
  );
}

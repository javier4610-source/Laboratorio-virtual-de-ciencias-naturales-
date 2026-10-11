import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DECOMP_DEFAULTS, DECOMP_LIMITS, DECOMP_MATERIALS, INITIAL_MASS, simulateDecomposition, type DecompMaterial,
} from '../models/decomposition';
import { seededRandom } from '../models/math';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, DigitalBalance, Lcd, Thermometer } from './kit';

const ANIM_MS = 1600;
const MOVE_END = 0.72; // fracción de la animación en que la bolsa llega al plato
const HUMUS = '#3a2616';
const SHORT: Record<string, string> = { banano: 'Banano', hojas: 'Hojas', papel: 'Papel', aserrin: 'Aserrín', plastico: 'Plástico' };

/* Geometría de la escena */
const GROUND = 372;
const SOIL_TOP = 172;
const SLOT_X = [60, 112, 164, 216, 268];
const BAG_W = 46, BAG_H = 58, BAG_TOP = 206;
const BENCH_Y = 300;
const BAL_X = 404, BAL_W = 236;
const PLATE_CX = BAL_X + BAL_W / 2, PLATE_TOP = BENCH_Y - 76 - 2;
const SCALE_W = 64, SCALE_H = 52;

/** Mezcla lineal entre dos colores hexadecimales (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ca, cb] = [p(a), p(b)];
  const k = Math.max(0, Math.min(1, t));
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

interface Piece { x: number; y: number; rot: number; s: number; }

/** Distribución reproducible de los trozos dentro de la bolsa (coordenadas locales). */
function layoutPieces(materialId: string, chopped: boolean): Piece[] {
  const idx = DECOMP_MATERIALS.findIndex((m) => m.id === materialId);
  const rnd = seededRandom(101 + idx * 17 + (chopped ? 7 : 0));
  const base = materialId === 'aserrin' ? 46 : materialId === 'plastico' ? 4 : 6;
  const n = materialId === 'aserrin' ? base : chopped ? base * 2 : base;
  const size = materialId === 'aserrin' ? 1 : chopped ? 0.62 : 1;
  return Array.from({ length: n }, () => ({
    x: 10 + rnd() * (SCALE_W - 20), y: 12 + rnd() * (SCALE_H - 20), rot: rnd() * 360, s: size * (0.85 + rnd() * 0.3),
  }));
}

function PieceShape({ materialId, color }: { materialId: string; color: string }) {
  const edge = 'rgba(40, 25, 10, 0.55)';
  switch (materialId) {
    case 'banano':
      return (
        <g>
          <path d="M-13 0 Q-6 -7 6 -6 Q12 -5 13 -1 Q4 -2 -4 1 Q-10 3 -13 0 Z" fill={color} stroke={edge} strokeWidth="0.7" />
          <circle cx="-3" cy="-3" r="0.9" fill="#4a3216" opacity="0.7" />
          <circle cx="5" cy="-4" r="0.7" fill="#4a3216" opacity="0.7" />
        </g>
      );
    case 'hojas':
      return (
        <g>
          <path d="M-11 0 Q0 -8 11 0 Q0 8 -11 0 Z" fill={color} stroke={edge} strokeWidth="0.7" />
          <path d="M-10 0 L10 0 M-3 0 L1 -3.5 M3 0 L6 -2.5 M-3 0 L1 3.5" stroke={edge} strokeWidth="0.5" fill="none" />
        </g>
      );
    case 'papel':
      return (
        <g>
          <path d="M-8 -6 L8 -5 L7 6 L-8 5 Z" fill={color} stroke={edge} strokeWidth="0.7" />
          <path d="M-5 -2 L5 -1.5 M-5 1 L4 1.5" stroke="rgba(60, 60, 80, 0.35)" strokeWidth="0.5" />
        </g>
      );
    case 'aserrin':
      return <ellipse cx="0" cy="0" rx="1.8" ry="1.1" fill={color} stroke={edge} strokeWidth="0.3" />;
    default:
      return (
        <g>
          <path d="M-10 -5 L8 -8 L11 4 L-7 7 Z" fill={color} opacity="0.88" stroke="#1f5f94" strokeWidth="0.8" />
          <path d="M-6 -4 L5 -6" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
        </g>
      );
  }
}

/** Bolsa de malla con su contenido; `loss` (0–100) oscurece y reduce los trozos. */
function MeshBag({ x, y, material, loss, pieces, fungi, anaerobic }: {
  x: number; y: number; material: DecompMaterial; loss: number; pieces: Piece[]; fungi: 'no visibles' | 'pocos' | 'abundantes'; anaerobic: boolean;
}) {
  const f = material.kRef > 0 ? Math.max(0, Math.min(1, loss / 100)) : 0;
  const visible = material.kRef > 0 ? Math.max(1, Math.round(pieces.length * (1 - 0.8 * f))) : pieces.length;
  const color = mix(material.color, HUMUS, f * 0.9);
  const shrink = Math.sqrt(1 - 0.55 * f);
  const crumbs = Math.round(f * 22);
  const crumbRnd = seededRandom(7);
  const crumbPts = Array.from({ length: crumbs }, () => [8 + crumbRnd() * (SCALE_W - 16), SCALE_H - 6 - crumbRnd() * 12, 0.8 + crumbRnd() * 1.4]);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g filter="url(#kit-shadow-soft)">
        <rect x={0} y={4} width={SCALE_W} height={SCALE_H - 4} rx={8} fill="#2b2016" opacity="0.18" />
      </g>
      {crumbPts.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={HUMUS} />)}
      {pieces.slice(0, visible).map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.rot}) scale(${p.s * shrink})`}>
          <PieceShape materialId={material.id} color={color} />
        </g>
      ))}
      {fungi !== 'no visibles' && (
        <g aria-hidden="true">
          <path d="M8 40 Q16 30 26 36 T44 30 T58 38 M14 22 Q22 16 30 22 T48 18" fill="none" stroke="#f4f1e6" strokeWidth="0.9" opacity="0.85" />
          {fungi === 'abundantes' && (
            <g>
              <path d="M6 30 Q20 44 34 28 T60 26 M10 14 Q24 26 40 12" fill="none" stroke="#f4f1e6" strokeWidth="0.8" opacity="0.8" />
              {[[18, 8], [46, 9], [56, 16]].map(([mx, my]) => (
                <g key={mx} transform={`translate(${mx} ${my})`}>
                  <rect x={-0.9} y={0} width={1.8} height={6} fill="#efe6cf" />
                  <path d="M-4.5 0.5 Q0 -4.5 4.5 0.5 Z" fill="#c9a77a" stroke="#8a6a44" strokeWidth="0.5" />
                </g>
              ))}
            </g>
          )}
        </g>
      )}
      {/* malla */}
      <rect x={0} y={4} width={SCALE_W} height={SCALE_H - 4} rx={8} fill="url(#des-mesh)" stroke="#2f5a3c" strokeWidth="1.4" />
      <path d={`M${SCALE_W / 2 - 9} 5 Q${SCALE_W / 2} -2 ${SCALE_W / 2 + 9} 5`} fill="none" stroke="#2f5a3c" strokeWidth="2" />
      <circle cx={SCALE_W / 2} cy={2} r={2.4} fill="#2f5a3c" />
      {anaerobic && f > 0.03 && (
        <g aria-hidden="true" stroke="var(--warn)" strokeWidth="1.4" fill="none" strokeLinecap="round">
          <path d={`M${SCALE_W * 0.3} -6 q-3 -5 0 -10 q3 -5 0 -10`} />
          <path d={`M${SCALE_W * 0.7} -6 q-3 -5 0 -10 q3 -5 0 -10`} />
        </g>
      )}
    </g>
  );
}

/** Lombriz de tierra (vector propio). */
function Worm({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} aria-hidden="true">
      <path d="M0 0 C6 -6 12 6 18 0 S30 -6 34 0" fill="none" stroke="#b5655d" strokeWidth="4" strokeLinecap="round" />
      <path d="M0 0 C6 -6 12 6 18 0 S30 -6 34 0" fill="none" stroke="#e3a29a" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M11 -1.5 L13 1.8" stroke="#8f4a43" strokeWidth="2.6" />
    </g>
  );
}

/** Mata de banano al fondo (paisaje de Urabá). */
function BananaPlant({ x }: { x: number }) {
  return (
    <g aria-hidden="true" opacity="0.9">
      <path d={`M${x - 7} ${GROUND} L${x - 5} 150 L${x + 5} 150 L${x + 7} ${GROUND} Z`} fill="#7c8f45" />
      <path d={`M${x - 4} ${GROUND} L${x - 3} 160`} stroke="#5f7233" strokeWidth="1.5" />
      {[[-1, -70, 40], [1, -60, 30], [-1, -30, 74], [1, -20, 70], [1, 10, 18]].map(([dir, dy, len], i) => (
        <g key={i}>
          <path d={`M${x} ${150 + dy * 0.2} Q${x + dir * len * 0.6} ${110 + dy * 0.5} ${x + dir * (len + 34)} ${120 + dy * 0.6} Q${x + dir * len * 0.5} ${128 + dy * 0.4} ${x} ${152 + dy * 0.2} Z`} fill={i % 2 ? '#3f8a3a' : '#4d9b44'} stroke="#2f6a2c" strokeWidth="0.8" />
          <path d={`M${x} ${151 + dy * 0.2} Q${x + dir * len * 0.6} ${117 + dy * 0.45} ${x + dir * (len + 34)} ${120 + dy * 0.6}`} fill="none" stroke="#a9cf7a" strokeWidth="1" opacity="0.8" />
        </g>
      ))}
    </g>
  );
}

type Phase = 'idle' | 'moving' | 'done';

export default function DecompositionLab({ api }: LabProps) {
  const [materialId, setMaterialId] = useState(DECOMP_DEFAULTS.materialId);
  const [weeks, setWeeks] = useState(DECOMP_DEFAULTS.weeks);
  const [temperature, setTemperature] = useState(DECOMP_DEFAULTS.temperature);
  const [moisture, setMoisture] = useState(DECOMP_DEFAULTS.moisture);
  const [aerated, setAerated] = useState<'si' | 'no'>('si');
  const [size, setSize] = useState<'entero' | 'picado'>('entero');
  const [phase, setPhase] = useState<Phase>('idle');
  const [p, setP] = useState(0);
  const raf = useRef(0);

  const res = useMemo(
    () => simulateDecomposition({ materialId, weeks, temperature, moisture, aerated: aerated === 'si', chopped: size === 'picado' }),
    [materialId, weeks, temperature, moisture, aerated, size],
  );
  const pieces = useMemo(() => layoutPieces(materialId, size === 'picado'), [materialId, size]);
  const measured = phase === 'done';
  const obs = res.observations;
  const slot = DECOMP_MATERIALS.findIndex((m) => m.id === materialId);

  const resetMeasure = () => { cancelAnimationFrame(raf.current); setPhase('idle'); setP(0); };
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); resetMeasure(); };

  useEffect(() => {
    if (phase !== 'moving') return;
    if (prefersReducedMotion()) { setP(1); setPhase('done'); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, now - start) / ANIM_MS);
      setP(k);
      if (k >= 1) { setPhase('done'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  const record = () => api.addTrial('bolsas', {
    material: res.material.name, semana: weeks, temperatura: temperature, humedad: moisture,
    aireacion: aerated === 'si' ? 'con volteo' : 'sin volteo', picado: size === 'picado' ? 'picados' : 'enteros',
    masa: res.massReading, perdida: res.lossPercent,
  });

  // Trayectoria de la bolsa: del hueco en la compostera al plato de la balanza
  const outOfPile = phase !== 'idle';
  const q = Math.min(1, p / MOVE_END);
  const ease = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
  const fromX = SLOT_X[slot] - SCALE_W / 2, fromY = BAG_TOP - 4;
  const toX = PLATE_CX - SCALE_W / 2, toY = PLATE_TOP - SCALE_H;
  const bagX = fromX + (toX - fromX) * ease;
  const bagY = fromY + (toY - fromY) * ease - 90 * Math.sin(Math.PI * ease);
  const onPlate = outOfPile && p >= MOVE_END;
  const reading = measured ? fmt(res.massReading, 1) : onPlate ? '- - -' : '0,0';
  const steam = obs.pileTemperature >= 38;

  const descText = `Compostera escolar con cinco bolsas de malla enterradas (banano, hojas, papel, aserrín y plástico), semana ${weeks}. ` +
    `El termómetro de compost marca ${fmt(obs.pileTemperature, 0)} °C. ` +
    (obs.worms ? 'Se ven lombrices en el suelo. ' : '') +
    (measured
      ? `La bolsa de ${res.material.name.toLowerCase()} está en la balanza, que marca ${fmt(res.massReading, 1)} g; el material se ve ${res.lossPercent > 60 ? 'muy oscuro y deshecho' : res.lossPercent > 25 ? 'oscurecido y en parte deshecho' : res.lossPercent > 3 ? 'algo oscurecido' : 'casi igual que al inicio'}${obs.fungi !== 'no visibles' ? `, con hongos ${obs.fungi}` : ''}.`
      : 'La balanza está vacía y marca 0,0 g; las bolsas siguen enterradas.');

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 680 400" role="img" aria-labelledby="des-t des-d">
            <title id="des-t">Compostera escolar con bolsas de descomposición y balanza digital</title>
            <desc id="des-d">{descText}</desc>
            <defs>
              <linearGradient id="des-soil" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#6e4c2c" />
                <stop offset="1" stopColor="#3f2a17" />
              </linearGradient>
              <linearGradient id="des-plank" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#c09159" />
                <stop offset="1" stopColor="#8f6536" />
              </linearGradient>
              <linearGradient id="des-plank-back" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#8a6338" />
                <stop offset="1" stopColor="#6a4a28" />
              </linearGradient>
              <pattern id="des-mesh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <path d="M0 0 H6 M0 0 V6" stroke="#2f5a3c" strokeWidth="0.8" opacity="0.75" />
              </pattern>
            </defs>

            {/* fondo del jardín escolar */}
            <rect x="0" y="0" width="680" height={GROUND} fill="var(--surface-2)" />
            <BananaPlant x={660} />
            <rect x="0" y={GROUND} width="680" height={400 - GROUND} fill="url(#des-soil)" />
            <path d={`M0 ${GROUND} H680`} stroke="#5d8f3e" strokeWidth="4" />

            {/* compostera: tablas del fondo, suelo y tablas frontales bajas */}
            <g>
              {[0, 1, 2, 3, 4].map((i) => (
                <rect key={i} x={30} y={122 + i * 50} width={300} height={44} fill="url(#des-plank-back)" />
              ))}
              <path d={`M30 ${SOIL_TOP} Q90 ${SOIL_TOP - 9} 150 ${SOIL_TOP - 2} T270 ${SOIL_TOP - 4} T330 ${SOIL_TOP} V${GROUND} H30 Z`} fill="url(#des-soil)" />
              {/* restos en la superficie */}
              {[[60, -4, '#7f9a3a'], [104, -7, '#b07a35'], [168, -5, '#d2b04a'], [214, -6, '#7f9a3a'], [262, -5, '#b07a35'], [300, -3, '#d2b04a']].map(([lx, dy, c], i) => (
                <path key={i} d={`M${Number(lx) - 9} ${SOIL_TOP + Number(dy)} Q${lx} ${SOIL_TOP + Number(dy) - 6} ${Number(lx) + 9} ${SOIL_TOP + Number(dy)} Q${lx} ${SOIL_TOP + Number(dy) + 3} ${Number(lx) - 9} ${SOIL_TOP + Number(dy)} Z`} fill={String(c)} opacity="0.9" />
              ))}
              {/* bolsas enterradas */}
              {DECOMP_MATERIALS.map((m, i) => {
                const cx = SLOT_X[i];
                const lifted = i === slot && outOfPile;
                return (
                  <g key={m.id}>
                    {lifted ? (
                      <ellipse cx={cx} cy={BAG_TOP + BAG_H / 2} rx={BAG_W / 2 + 2} ry={BAG_H / 2} fill="#24170c" opacity="0.65" />
                    ) : (
                      <g>
                        <rect x={cx - BAG_W / 2} y={BAG_TOP} width={BAG_W} height={BAG_H} rx={7} fill="#4b331d" />
                        <rect x={cx - BAG_W / 2} y={BAG_TOP} width={BAG_W} height={BAG_H} rx={7} fill="url(#des-mesh)" stroke="#2f5a3c" strokeWidth="1.2" opacity="0.8" />
                        <rect x={cx - BAG_W / 2} y={BAG_TOP} width={BAG_W} height={BAG_H} rx={7} fill="#4a321c" opacity="0.45" />
                      </g>
                    )}
                    <line x1={cx} x2={cx} y1={BAG_TOP + 2} y2={SOIL_TOP - 16} stroke="#e8dcc0" strokeWidth="1.2" />
                    <rect x={cx - 24} y={SOIL_TOP - 32} width={48} height={17} rx={3} fill="var(--surface)" stroke={i === slot ? 'var(--amb)' : 'var(--line)'} strokeWidth={i === slot ? 2.2 : 1} filter="url(#kit-shadow-soft)" />
                    <text x={cx} y={SOIL_TOP - 20} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: i === slot ? 700 : 500 }}>{SHORT[m.id]}</text>
                  </g>
                );
              })}
              {obs.worms && (
                <g>
                  <Worm x={70} y={306} />
                  <Worm x={196} y={334} flip />
                  <Worm x={246} y={292} />
                </g>
              )}
              {[[50, 318], [140, 300], [230, 350], [300, 322], [110, 352]].map(([sx, sy], i) => (
                <ellipse key={i} cx={sx} cy={sy} rx={5} ry={3} fill="#2a1b0e" opacity="0.5" />
              ))}
              {/* postes y tablas frontales */}
              <rect x={22} y={110} width={12} height={GROUND - 110} rx={2} fill="url(#des-plank)" stroke="#6d4b26" />
              <rect x={326} y={110} width={12} height={GROUND - 110} rx={2} fill="url(#des-plank)" stroke="#6d4b26" />
              <rect x={22} y={GROUND - 30} width={316} height={26} rx={2} fill="url(#des-plank)" stroke="#6d4b26" />
              <text x={180} y={GROUND - 12} textAnchor="middle" style={{ fontSize: 11, fill: '#3b2712', fontWeight: 700 }}>Compostera escolar</text>
              {steam && (
                <g aria-hidden="true" stroke="var(--ink-2)" strokeWidth="1.5" fill="none" opacity="0.45" strokeLinecap="round">
                  {[90, 170, 250].map((sx) => <path key={sx} d={`M${sx} ${SOIL_TOP - 40} q-5 -8 0 -16 q5 -8 0 -16`} />)}
                </g>
              )}
            </g>

            {/* termómetro de compost clavado en la pila */}
            <Thermometer x={312} y={66} h={250} min={0} max={70} value={obs.pileTemperature} />
            <Lcd x={262} y={34} w={76} h={24} text={fmt(obs.pileTemperature, 0)} unit="°C" />
            <text x={300} y={28} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>temperatura de la pila</text>

            {/* mesa y balanza */}
            <rect x={BAL_X - 10} y={BENCH_Y + 12} width={8} height={GROUND - BENCH_Y - 12} fill="#8b989a" />
            <rect x={BAL_X + BAL_W + 4} y={BENCH_Y + 12} width={8} height={GROUND - BENCH_Y - 12} fill="#8b989a" />
            <BenchTop x={BAL_X - 22} y={BENCH_Y} width={BAL_W + 44} />
            <DigitalBalance x={BAL_X} y={BENCH_Y - 76} w={BAL_W} reading={reading} />
            <text x={PLATE_CX} y={BENCH_Y + 30} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Balanza · resolución 0,1 g</text>

            {outOfPile && (
              <MeshBag x={bagX} y={bagY} material={res.material} loss={res.lossPercent} pieces={pieces}
                fungi={obs.fungi} anaerobic={obs.anaerobic} />
            )}
            {!outOfPile && (
              <text x={PLATE_CX} y={PLATE_TOP - 30} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Plato vacío</text>
            )}
            <text x={PLATE_CX} y={40} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>Semana {weeks}</text>
            <text x={PLATE_CX} y={58} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>
              {`${fmt(temperature, 0)} °C · ${fmt(moisture, 0)} % humedad · ${aerated === 'si' ? 'con volteo' : 'sin volteo'} · ${size === 'picado' ? 'picado' : 'entero'}`}
            </text>
          </svg>
        </div>

        <Readout items={[
          { k: 'Material', v: res.material.name },
          { k: 'Masa seca inicial', v: `${fmt(INITIAL_MASS, 1)} g` },
          { k: 'Masa en la balanza', v: measured ? `${fmt(res.massReading, 1)} g` : 'sin pesar', data: true },
          { k: 'Masa perdida', v: measured ? `${fmt(res.lossPercent, 1)} %` : '—', data: true },
          { k: 'Constante k (modelo)', v: measured ? `${fmt(res.k, 3)} por semana` : '—' },
          { k: 'Vida media ln 2/k (modelo)', v: measured ? (res.halfLife === null ? 'no se descompone' : `${fmt(res.halfLife, 1)} semanas`) : '—' },
        ]} />

        <div className="card stack-sm">
          <h3>Registro cualitativo</h3>
          {measured ? (
            <Readout items={[
              { k: 'Hongos visibles', v: obs.fungi === 'abundantes' ? 'Abundantes (micelio blanco)' : obs.fungi === 'pocos' ? 'Pocos' : 'No visibles' },
              { k: 'Olor de la bolsa', v: obs.smell },
              { k: 'Lombrices cerca', v: obs.worms ? 'Sí' : 'No' },
              { k: 'Temperatura de la pila', v: `${fmt(obs.pileTemperature, 0)} °C` },
            ]} />
          ) : (
            <p className="small muted">Saca y pesa la bolsa para observar los hongos y el olor. El termómetro de la pila marca {fmt(obs.pileTemperature, 0)} °C.</p>
          )}
        </div>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Condiciones de la compostera</h3>
          <Select label="Material de la bolsa" value={materialId} onChange={change(setMaterialId)}
            options={DECOMP_MATERIALS.map((m) => ({ value: m.id, label: m.name }))} />
          <Slider label="Semana de muestreo" value={weeks} min={DECOMP_LIMITS.weeks[0]} max={DECOMP_LIMITS.weeks[1]} step={1} unit="semanas" decimals={0} onChange={change(setWeeks)} />
          <Slider label="Temperatura de la compostera" value={temperature} min={DECOMP_LIMITS.temperature[0]} max={DECOMP_LIMITS.temperature[1]} step={1} unit="°C" decimals={0} onChange={change(setTemperature)} />
          <Slider label="Humedad del material" value={moisture} min={DECOMP_LIMITS.moisture[0]} max={DECOMP_LIMITS.moisture[1]} step={5} unit="%" decimals={0} onChange={change(setMoisture)}
            hint="Óptimo cerca de 50–60 %: como una esponja escurrida." />
          <Segmented label="Volteo semanal (aireación)" value={aerated} onChange={change(setAerated)}
            options={[{ value: 'si', label: 'Con volteo' }, { value: 'no', label: 'Sin volteo' }]} />
          <Segmented label="Tamaño de los trozos" value={size} onChange={change(setSize)}
            options={[{ value: 'entero', label: 'Enteros' }, { value: 'picado', label: 'Picados' }]} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setP(0); setPhase('moving'); }} disabled={phase !== 'idle'}>Pesar las bolsas</button>
            <button type="button" className="btn" onClick={resetMeasure} disabled={phase === 'idle'}>Volver a enterrar</button>
          </div>
          <RecordButton onRecord={record} disabled={!measured} />
          {!measured && <p className="small muted">Pesa la bolsa para poder guardar el ensayo.</p>}
        </div>
        <details className="card">
          <summary>Materiales de las bolsas</summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de materiales de las bolsas">
            <table>
              <thead><tr><th>Material</th><th>Características</th></tr></thead>
              <tbody>
                {DECOMP_MATERIALS.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.note}</td></tr>)}
              </tbody>
            </table>
          </div>
        </details>
        <Notice>Simulación educativa con el modelo de Olson (M = M₀·e^(−k·t)). Las constantes de cada material son ilustrativas; la balanza tiene resolución de 0,1 g y el termómetro de 1 °C.</Notice>
      </div>
    </div>
  );
}

import { useId, type ReactNode } from 'react';
import type { Area } from '../core/types';
import { BenchTop, Beaker, Burette, Cube, DigitalBalance, Erlenmeyer, GasSyringe, GraduatedCylinder, TestTube, Thermometer } from '../labs/kit';

/**
 * Miniaturas ilustradas de cada práctica (módulo cargado bajo demanda).
 * Lienzo de 320 × 160; el fondo (papel milimetrado teñido por área) lo pone el CSS de la tarjeta.
 * Usan el kit de instrumentos del laboratorio para mantener una sola estética.
 * Son decorativas: la tarjeta ya nombra la práctica.
 */

const INK = 'var(--ink-2)';
const W = 320;

function Bench() { return <BenchTop y={140} width={W} />; }

/** Pequeña gráfica de datos sobre una tarjeta flotante. */
function MiniPlot({ x, y, w = 96, h = 64, d, points = [], color = 'var(--data)' }: { x: number; y: number; w?: number; h?: number; d: string; points?: [number, number][]; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={8} fill="var(--surface)" stroke="var(--line)" filter="url(#kit-shadow-soft)" />
      <g transform={`translate(12 8)`}>
        {[0.33, 0.66].map((f) => <line key={f} x1={0} x2={w - 22} y1={(h - 20) * f} y2={(h - 20) * f} stroke="var(--line)" strokeWidth="1" />)}
        <path d={`M0 0V${h - 20}H${w - 22}`} fill="none" stroke={INK} strokeWidth="1.2" />
        <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([px, py]) => <circle key={`${px}-${py}`} cx={px} cy={py} r="2.4" fill={color} />)}
      </g>
    </g>
  );
}

function Bubbles({ pts, fill = '#ffffff', stroke = 'var(--glass-edge)' }: { pts: [number, number, number][]; fill?: string; stroke?: string }) {
  return <g>{pts.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={fill} fillOpacity="0.55" stroke={stroke} strokeWidth="0.8" />)}</g>;
}

/** Campo circular de microscopio. */
function Field({ cx, cy, r, children, bg = '#f4efe2' }: { cx: number; cy: number; r: number; children: ReactNode; bg?: string }) {
  const id = `fld${useId().replace(/:/g, '')}`;
  return (
    <g>
      <defs><clipPath id={id}><circle cx={cx} cy={cy} r={r} /></clipPath></defs>
      <circle cx={cx} cy={cy} r={r + 6} fill="#1d2526" />
      <circle cx={cx} cy={cy} r={r} fill={bg} />
      <g clipPath={`url(#${id})`}>{children}</g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="6" />
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color = INK, w = 1.6 }: { x1: number; y1: number; x2: number; y2: number; color?: string; w?: number }) {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 6;
  const p = (t: number) => `${x2 - L * Math.cos(a + t)} ${y2 - L * Math.sin(a + t)}`;
  return <g stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round"><path d={`M${x1} ${y1}L${x2} ${y2}`} /><path d={`M${p(0.5)}L${x2} ${y2}L${p(-0.5)}`} /></g>;
}

const SCENES: Record<string, () => ReactNode> = {
  densidad: () => (
    <>
      <Bench />
      <GraduatedCylinder x={66} y={18} w={34} h={122} capacity={100} level={64} major={20} minor={10}>
        <Cube x={74} y={126} size={18} color="#9aa7b0" finish="metal" />
      </GraduatedCylinder>
      <DigitalBalance x={150} y={64} w={140} reading="21.6" />
      <Cube x={206} y={64} size={24} color="#b9c3c9" finish="metal" />
    </>
  ),
  mezclas: () => (
    <>
      <Bench />
      <g>
        <path d="M40 78 a22 22 0 0 1 44 0 v52 h-12 v-52 a10 10 0 0 0 -20 0 v52 h-12 z" fill="#c62828" />
        <rect x={40} y={118} width={12} height={12} fill="#cfd8dc" /><rect x={72} y={118} width={12} height={12} fill="#cfd8dc" />
        {[[44, 136], [52, 134], [62, 137], [70, 135], [78, 136], [57, 132]].map(([x, y]) => <path key={x} d={`M${x} ${y} l3 -2`} stroke="#37474f" strokeWidth="1.6" strokeLinecap="round" />)}
      </g>
      <path d="M140 30 L200 30 L176 66 L176 84 L164 84 L164 66 Z" fill="url(#kit-glass-fill)" stroke="var(--glass-edge)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M146 34 L194 34 L170 64 Z" fill="#f5f1e6" stroke="#cbbf9f" />
      <path d="M152 40 L188 40 L182 48 L158 48 Z" fill="#a1887f" opacity="0.85" />
      <Beaker x={134} y={86} w={72} h={52} fill={0.45} liquid="#cfe8f7" liquidOpacity={0.6} />
      <circle cx={170} cy={92} r={2} fill="#9cc9e6" />
      <path d="M232 128 Q262 146 292 128 Z" fill="url(#kit-body)" stroke="#a9b4b6" />
      <path d="M240 129 Q262 138 284 129" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="2 3" />
      <path d="M248 120 q4 -8 0 -16 M262 120 q4 -8 0 -16 M276 120 q4 -8 0 -16" fill="none" stroke={INK} strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  celulas: () => (
    <>
      <Field cx={110} cy={80} r={62}>
        {Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, c) => {
          const x = 40 + c * 32 + (r % 2) * 14, y = 18 + r * 22;
          return <g key={`${r}-${c}`}><rect x={x} y={y} width={30} height={20} rx={2} fill="#e9d9f2" stroke="#8e5aa8" strokeWidth="1.4" /><circle cx={x + 10 + (c % 3) * 4} cy={y + 10} r={3.6} fill="#7b3f9a" /></g>;
        }))}
      </Field>
      <g transform="translate(212 20)">
        <path d="M30 120 h62" stroke="#37474f" strokeWidth="8" strokeLinecap="round" />
        <path d="M70 116 V60 Q70 40 52 34" fill="none" stroke="#455a64" strokeWidth="9" strokeLinecap="round" />
        <rect x={34} y={8} width={14} height={40} rx={3} transform="rotate(-25 41 28)" fill="#546e7a" />
        <rect x={30} y={4} width={16} height={8} rx={2} transform="rotate(-25 38 8)" fill="#263238" />
        <rect x={34} y={78} width={44} height={6} rx={2} fill="#90a4ae" />
        <rect x={44} y={56} width={8} height={18} rx={2} fill="#78909c" />
        <circle cx={72} cy={96} r={7} fill="#90a4ae" stroke="#455a64" strokeWidth="2" />
      </g>
    </>
  ),
  redes: () => {
    const N: Record<string, [number, number, string, number]> = {
      p: [60, 128, '#4caf50', 14], s: [140, 128, '#8bc34a', 12], r: [100, 86, '#a1887f', 11], i: [180, 92, '#ffb300', 10], c: [140, 50, '#6d4c41', 11], h: [210, 28, '#455a64', 12],
    };
    const E: [string, string][] = [['p', 'r'], ['s', 'r'], ['s', 'i'], ['p', 'i'], ['r', 'c'], ['i', 'c'], ['r', 'h'], ['c', 'h']];
    return (
      <>
        {E.map(([a, b]) => { const [x1, y1, , r1] = N[a], [x2, y2, , r2] = N[b]; const d = Math.hypot(x2 - x1, y2 - y1); return <Arrow key={a + b} x1={x1 + ((x2 - x1) * r1) / d} y1={y1 + ((y2 - y1) * r1) / d} x2={x2 - ((x2 - x1) * (r2 + 3)) / d} y2={y2 - ((y2 - y1) * (r2 + 3)) / d} />; })}
        {Object.entries(N).map(([k, [x, y, c, r]]) => <circle key={k} cx={x} cy={y} r={r} fill={c} stroke="var(--surface)" strokeWidth="2.5" />)}
        <g transform="translate(234 40)">
          {[[0, 64, 76, '#66bb6a'], [12, 42, 52, '#ffca28'], [22, 22, 32, '#ff8a65'], [30, 4, 16, '#8d6e63']].map(([x, y, w, c]) => <rect key={y as number} x={x as number} y={y as number} width={w as number} height={18} rx={3} fill={c as string} />)}
        </g>
      </>
    );
  },
  osmosis: () => (
    <>
      <Bench />
      <Beaker x={36} y={40} w={120} h={98} fill={0.8} liquid="#bfe3f5" liquidOpacity={0.6}>
        <path d="M78 46 Q70 72 74 104 Q78 128 96 128 Q114 128 118 104 Q122 72 114 46" fill="#f3d36b" fillOpacity="0.55" stroke="#c9a227" strokeWidth="1.4" />
        <path d="M76 44 h40" stroke="#5d4037" strokeWidth="4" strokeLinecap="round" />
        {[[58, 90], [134, 100], [60, 120], [136, 72]].map(([x, y], i) => <Arrow key={i} x1={x} y1={y} x2={x < 96 ? x + 14 : x - 14} y2={y} color="#1e88e5" />)}
      </Beaker>
      {[[208, 54, 1], [262, 54, 0.75], [236, 108, 1.25]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse rx={20} ry={18} fill="#e53935" />
          <ellipse rx={9} ry={8} fill="#b71c1c" opacity="0.55" />
          <ellipse rx={20} ry={18} fill="none" stroke="#8e1b1b" strokeWidth={1.2 / s} />
        </g>
      ))}
    </>
  ),
  mitosis: () => {
    const cell = (x: number, y: number, phase: number) => (
      <g transform={`translate(${x} ${y})`}>
        <rect x={-22} y={-16} width={44} height={32} rx={6} fill="#f8e1ea" stroke="#ad5b7c" strokeWidth="1.4" />
        {phase === 0 && <circle r={8} fill="#c2185b" opacity="0.7" />}
        {phase === 1 && [-6, -2, 2, 6].map((d) => <path key={d} d={`M${d} -8 l0 16`} stroke="#880e4f" strokeWidth="2.2" strokeLinecap="round" />)}
        {phase === 2 && [-4, 0, 4].map((d) => <g key={d}><path d={`M-14 ${d} l6 0`} stroke="#880e4f" strokeWidth="2.2" strokeLinecap="round" /><path d={`M8 ${d} l6 0`} stroke="#880e4f" strokeWidth="2.2" strokeLinecap="round" /></g>)}
        {phase === 3 && <><path d="M0 -16 V16" stroke="#ad5b7c" strokeWidth="1.4" /><circle cx={-11} r={6} fill="#c2185b" opacity="0.7" /><circle cx={11} r={6} fill="#c2185b" opacity="0.7" /></>}
        {phase === 4 && <path d="M-6 -6 l12 12 M6 -6 l-12 12 M0 -9 v18" stroke="#880e4f" strokeWidth="2" strokeLinecap="round" />}
      </g>
    );
    return (
      <Field cx={160} cy={80} r={70} bg="#fbf2f5">
        {[[110, 40, 0], [158, 40, 1], [206, 40, 0], [96, 76, 2], [144, 76, 0], [192, 76, 4], [240, 76, 0], [110, 112, 3], [158, 112, 0], [206, 112, 0]].map(([x, y, p]) => <g key={`${x}-${y}`}>{cell(x, y, p)}</g>)}
      </Field>
    );
  },
  conductores: () => (
    <>
      <Bench />
      <rect x={30} y={96} width={64} height={36} rx={5} fill="#37474f" />
      <rect x={30} y={96} width={22} height={36} rx={5} fill="#f9a825" />
      <rect x={94} y={108} width={6} height={12} rx={1} fill="#90a4ae" />
      <path d="M62 96 V60 H140 M100 114 H120 V128 H196 M246 128 H290 V60 H220" fill="none" stroke="#c62828" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx={180} cy={60} r={18} fill="#fff59d" stroke="#f9a825" strokeWidth="1.6" />
      <circle cx={180} cy={60} r={30} fill="#fff59d" opacity="0.35" />
      <path d="M140 60 H162 M198 60 H220" stroke="#c62828" strokeWidth="2.4" />
      <path d="M172 64 q4 -10 8 0 q4 -10 8 0" fill="none" stroke="#f57f17" strokeWidth="1.4" />
      <rect x={196} y={118} width={50} height={14} rx={2} fill="#b0bec5" stroke="#78909c" />
      <path d="M190 122 l8 3 -8 3z M252 122 l-8 3 8 3z" fill="#455a64" />
      <g transform="translate(260 82)"><circle r={16} fill="url(#kit-body)" stroke="#78909c" /><path d="M-10 4 A11 11 0 0 1 10 4" fill="none" stroke={INK} strokeWidth="1" /><path d="M0 4 L6 -6" stroke="#c62828" strokeWidth="1.6" strokeLinecap="round" /><text y={12} textAnchor="middle" style={{ fontSize: 8, fill: '#37474f', fontWeight: 700 }}>A</text></g>
    </>
  ),
  descomposicion: () => (
    <>
      <Bench />
      {[[40, '#6d4c41', 0.75], [120, '#795548', 0.55], [200, '#8d6e63', 0.35]].map(([x, c, f]) => (
        <g key={x as number}>
          <rect x={x as number} y={52} width={62} height={86} rx={8} fill="url(#kit-glass-fill)" stroke="var(--glass-edge)" strokeWidth="1.6" />
          <rect x={(x as number) + 3} y={138 - 80 * (f as number)} width={56} height={80 * (f as number) - 3} rx={5} fill={c as string} />
          {[0, 1, 2].map((i) => <circle key={i} cx={(x as number) + 14 + i * 16} cy={138 - 80 * (f as number) + 12 + (i % 2) * 8} r={2.4} fill="#d7ccc8" />)}
          <path d={`M${(x as number) + 18} ${132 - 80 * (f as number)} q8 -12 22 -4`} fill="none" stroke="#fbc02d" strokeWidth="4" strokeLinecap="round" />
          <rect x={(x as number) - 2} y={46} width={66} height={8} rx={3} fill="#546e7a" />
        </g>
      ))}
      <Thermometer x={290} y={30} h={108} min={0} max={60} value={38} />
    </>
  ),
  mendel: () => (
    <>
      <g transform="translate(40 18)">
        <rect x={0} y={0} width={124} height={124} rx={10} fill="var(--surface)" stroke="var(--line)" filter="url(#kit-shadow-soft)" />
        <path d="M62 10 V114 M10 62 H114" stroke="var(--line)" strokeWidth="1.5" />
        {[[36, 36, '#fbc02d'], [88, 36, '#fbc02d'], [36, 88, '#fbc02d'], [88, 88, '#7cb342']].map(([x, y, c]) => <g key={`${x}${y}`}><circle cx={x as number} cy={y as number} r={15} fill={c as string} /><circle cx={(x as number) - 5} cy={(y as number) - 5} r={4} fill="#fff" opacity="0.45" /></g>)}
      </g>
      <g transform="translate(196 54)">
        <path d="M0 30 Q50 -12 110 18 Q60 56 0 30 Z" fill="#7cb342" stroke="#33691e" strokeWidth="1.4" />
        <path d="M8 28 Q55 4 102 20" fill="none" stroke="#33691e" strokeWidth="1" />
        {[24, 44, 64, 84].map((x, i) => <circle key={x} cx={x} cy={22 + (i % 2) * 2} r={8} fill={i === 2 ? '#9ccc65' : '#fdd835'} stroke="#827717" strokeWidth="0.8" />)}
      </g>
    </>
  ),
  ondas: () => (
    <>
      <Bench />
      <rect x={22} y={40} width={12} height={100} rx={2} fill="url(#kit-metal-h)" />
      <rect x={286} y={40} width={12} height={100} rx={2} fill="url(#kit-metal-h)" />
      <path d={Array.from({ length: 101 }, (_, i) => { const x = 34 + i * 2.52; return `${i ? 'L' : 'M'}${x.toFixed(1)} ${(76 + 26 * Math.sin((i / 100) * Math.PI * 4)).toFixed(1)}`; }).join('')} fill="none" stroke="var(--fis)" strokeWidth="3" strokeLinecap="round" />
      <path d="M97 40 V112 M223 40 V112" stroke="var(--data)" strokeWidth="1.4" strokeDasharray="4 3" />
      <Arrow x1={110} y1={44} x2={210} y2={44} color="var(--data)" />
      <Arrow x1={210} y1={44} x2={110} y2={44} color="var(--data)" />
      <rect x={40} y={118} width={240} height={16} rx={2} fill="url(#kit-wood)" stroke="#b8975a" />
      {Array.from({ length: 25 }, (_, i) => <line key={i} x1={44 + i * 9.7} x2={44 + i * 9.7} y1={118} y2={i % 5 ? 123 : 127} stroke="#4d3b1c" strokeWidth="0.8" />)}
    </>
  ),
  optica: () => (
    <>
      <path d="M90 70 A70 70 0 0 1 230 70" fill="none" stroke={INK} strokeOpacity="0.5" strokeDasharray="2 4" />
      {Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (i / 12); return <line key={i} x1={160 + 70 * Math.cos(a)} y1={70 - 70 * Math.sin(a)} x2={160 + 64 * Math.cos(a)} y2={70 - 64 * Math.sin(a)} stroke={INK} strokeOpacity="0.6" />; })}
      <path d="M90 70 H230 A70 70 0 0 1 90 70 Z" fill="#9fd3ef" fillOpacity="0.4" stroke="var(--glass-edge)" strokeWidth="1.6" />
      <path d="M100 76 H220" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
      <path d="M160 6 V150" stroke={INK} strokeDasharray="5 4" strokeWidth="1.2" />
      <path d="M112 22 L160 70" stroke="#e53935" strokeWidth="3" strokeLinecap="round" />
      <path d="M160 70 L189 138" stroke="#e53935" strokeWidth="3" strokeLinecap="round" />
      <path d="M160 70 L208 22" stroke="#e53935" strokeWidth="1.4" strokeOpacity="0.45" strokeLinecap="round" />
      <path d="M160 44 A26 26 0 0 0 141.6 51.6" fill="none" stroke="var(--data)" strokeWidth="1.8" />
      <path d="M160 100 A30 30 0 0 0 171.8 97.6" fill="none" stroke="var(--data)" strokeWidth="1.8" />
      <rect x={86} y={6} width={34} height={14} rx={3} transform="rotate(45 103 13)" fill="#37474f" />
      <circle cx={160} cy={70} r={2.6} fill="var(--ink)" />
    </>
  ),
  adn: () => (
    <>
      {Array.from({ length: 15 }, (_, i) => {
        const x = 30 + i * 18.5, a = (i / 14) * Math.PI * 3, y1 = 80 + 38 * Math.sin(a), y2 = 80 - 38 * Math.sin(a);
        const pair = [['#e53935', '#fbc02d'], ['#43a047', '#1e88e5'], ['#fbc02d', '#e53935'], ['#1e88e5', '#43a047']][i % 4];
        return <g key={i}><line x1={x} x2={x} y1={y1} y2={(y1 + y2) / 2} stroke={pair[0]} strokeWidth="4" /><line x1={x} x2={x} y1={(y1 + y2) / 2} y2={y2} stroke={pair[1]} strokeWidth="4" /></g>;
      })}
      {[1, -1].map((s) => <path key={s} d={Array.from({ length: 81 }, (_, i) => { const x = 30 + i * 3.46; return `${i ? 'L' : 'M'}${x.toFixed(1)} ${(80 + s * 38 * Math.sin((i / 80) * Math.PI * 3)).toFixed(1)}`; }).join('')} fill="none" stroke={s > 0 ? 'var(--bio)' : 'var(--fis)'} strokeWidth="4.5" strokeLinecap="round" />)}
    </>
  ),
  newton: () => (
    <>
      <rect x={20} y={112} width={250} height={8} rx={2} fill="url(#kit-metal)" stroke="#9aa5a9" />
      <rect x={20} y={120} width={250} height={20} fill="var(--bench-top)" />
      <circle cx={276} cy={112} r={9} fill="url(#kit-metal-h)" stroke="#78909c" />
      <path d="M140 92 H276 M285 112 V128" stroke={INK} strokeWidth="1.4" />
      <rect x={279} y={128} width={14} height={18} rx={2} fill="#546e7a" />
      <g filter="url(#kit-shadow-soft)">
        <rect x={70} y={78} width={70} height={30} rx={5} fill="#1e5fae" />
        <rect x={74} y={82} width={30} height={10} rx={2} fill="#fff" opacity="0.25" />
        <circle cx={86} cy={110} r={6} fill="#263238" /><circle cx={124} cy={110} r={6} fill="#263238" />
      </g>
      {[170, 230].map((x) => <g key={x}><path d={`M${x} 112 V60 H${x + 12} V112`} fill="none" stroke="#455a64" strokeWidth="4" /><circle cx={x + 6} cy={66} r={2.4} fill="#e53935" /></g>)}
      <Arrow x1={150} y1={68} x2={206} y2={68} color="var(--data)" w={2.6} />
    </>
  ),
  cinematica: () => (
    <>
      <path d="M0 132 H320" stroke="var(--bench-edge)" strokeWidth="3" />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 30 + 7 * i * i + 18 * i;
        return <g key={i} opacity={0.35 + i * 0.13}><circle cx={x} cy={120} r={10} fill="none" stroke="var(--fis)" strokeWidth="2.4" /><circle cx={x} cy={120} r={2.5} fill="var(--fis)" /></g>;
      })}
      {Array.from({ length: 11 }, (_, i) => <g key={i}><line x1={30 + i * 26} x2={30 + i * 26} y1={134} y2={142} stroke={INK} /></g>)}
      <MiniPlot x={196} y={14} w={108} h={72} d="M0 50 Q40 48 86 2" points={[[0, 50], [22, 46], [44, 36], [66, 22], [86, 2]]} />
    </>
  ),
  seleccion: () => {
    const beetle = (x: number, y: number, c: string, r = 0) => (
      <g transform={`translate(${x} ${y}) rotate(${r})`}>
        <path d="M-9 -3 l-5 -3 M-9 3 l-5 3 M9 -3 l5 -3 M9 3 l5 3 M0 -9 l-3 -5 M0 -9 l3 -5" stroke="#263238" strokeWidth="1.2" />
        <ellipse rx={8} ry={10} fill={c} stroke="#263238" strokeWidth="1" /><path d="M0 -6 V10" stroke="#263238" strokeWidth="0.8" />
      </g>
    );
    return (
      <>
        <path d="M0 160 V90 Q80 70 160 92 V160 Z" fill="#c8b48a" />
        <path d="M160 160 V92 Q240 112 320 86 V160 Z" fill="#4a4540" />
        {[[40, 118, '#3e3a36', 10], [90, 134, '#d8c49c', -20], [120, 110, '#3e3a36', 30], [210, 124, '#3e3a36', -15], [262, 138, '#d8c49c', 20], [290, 110, '#3e3a36', 5], [60, 146, '#d8c49c', 40]].map(([x, y, c, r]) => <g key={`${x}`}>{beetle(x as number, y as number, c as string, r as number)}</g>)}
        <path d="M150 34 q14 -12 30 -2 q8 -10 26 -6 q-14 4 -18 14 q-10 10 -24 6 z" fill="#37474f" />
        <circle cx={196} cy={28} r={1.6} fill="#fff" />
      </>
    );
  },
  soluciones: () => (
    <>
      <Bench />
      <g>
        <circle cx={70} cy={110} r={28} fill="#3f6fd8" fillOpacity="0.45" stroke="var(--glass-edge)" strokeWidth="1.6" />
        <rect x={64} y={24} width={12} height={62} fill="url(#kit-glass-fill)" stroke="var(--glass-edge)" strokeWidth="1.6" />
        <path d="M62 52 h16" stroke="var(--glass-print)" strokeWidth="1.2" />
        <rect x={62} y={18} width={16} height={8} rx={2} fill="#455a64" />
        <path d="M50 96 Q70 88 90 96" fill="none" stroke="#fff" strokeWidth="3" opacity="0.4" strokeLinecap="round" />
      </g>
      {[0.12, 0.25, 0.42, 0.6, 0.8].map((o, i) => <g key={i}><rect x={128 + i * 22} y={92} width={14} height={46} rx={2} fill={`rgba(46, 94, 200, ${o})`} stroke="var(--glass-edge)" /></g>)}
      <MiniPlot x={240} y={34} w={70} h={58} d="M0 38 L48 4" points={[[0, 38], [12, 30], [24, 21], [36, 13], [48, 4]]} color="var(--fis)" />
    </>
  ),
  enzimas: () => (
    <>
      <Bench />
      <rect x={30} y={70} width={190} height={68} rx={6} fill="#bfe3f5" fillOpacity="0.5" stroke="#78909c" strokeWidth="1.6" />
      <path d="M30 82 H220" stroke="#4fc3f7" strokeWidth="1.4" />
      {[60, 110, 160].map((x, i) => (
        <TestTube key={x} x={x} y={30} w={24} h={100} fill={0.55} liquid={['#fff59d', '#ffe082', '#ffcc80'][i]}>
          <Bubbles pts={[[x + 8, 66 - i * 6, 3], [x + 15, 72 - i * 4, 2.4], [x + 11, 60 - i * 8, 2]]} />
          <rect x={x + 2} y={58 - i * 10} width={20} height={8 + i * 6} fill="#fff" opacity="0.55" />
        </TestTube>
      ))}
      <Thermometer x={250} y={22} h={116} min={0} max={80} value={37} />
    </>
  ),
  fotosintesis: () => (
    <>
      <Bench />
      <g>
        <path d="M18 24 L64 24 L56 42 L26 42 Z" fill="#455a64" />
        <path d="M26 42 L130 100 M56 42 L140 70" stroke="#fdd835" strokeWidth="18" strokeOpacity="0.18" />
        <circle cx={41} cy={44} r={9} fill="#fff59d" />
        <path d="M40 24 V8 H72" stroke="#455a64" strokeWidth="3" fill="none" />
      </g>
      <Beaker x={110} y={48} w={110} h={90} fill={0.85} liquid="#a5d6a7" liquidOpacity={0.45}>
        <path d="M160 132 Q150 110 162 92 Q172 76 162 62 M164 132 Q178 116 170 100 M162 110 q-12 -4 -16 -12 M166 88 q12 -2 16 -10 M160 120 q14 0 18 -6" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" />
        <Bubbles pts={[[168, 56, 3], [158, 44, 2.5], [170, 34, 2]]} />
      </Beaker>
      <TestTube x={150} y={18} w={26} h={76} fill={0.9} liquid="#c8e6c9" liquidOpacity={0.35} />
      <MiniPlot x={238} y={30} w={72} h={58} d="M0 38 Q14 6 48 4" color="var(--bio)" />
    </>
  ),
  gases: () => (
    <>
      <Bench />
      <GasSyringe x={40} y={70} length={160} fraction={0.55} capacity={100} major={25} />
      <g transform="translate(270 54)" filter="url(#kit-shadow-soft)">
        <circle r={28} fill="url(#kit-body)" stroke="#78909c" strokeWidth="2" />
        <circle r={22} fill="#fff" />
        {Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.75 + (i / 8) * 1.5); return <line key={i} x1={17 * Math.cos(a)} y1={17 * Math.sin(a)} x2={21 * Math.cos(a)} y2={21 * Math.sin(a)} stroke="#37474f" strokeWidth="1.2" />; })}
        <path d="M0 0 L12 -12" stroke="#c62828" strokeWidth="2.2" strokeLinecap="round" /><circle r={3} fill="#37474f" />
        <rect x={-4} y={28} width={8} height={20} fill="url(#kit-metal-h)" />
      </g>
      <path d="M270 102 V112 H240" fill="none" stroke="#78909c" strokeWidth="4" />
    </>
  ),
  cinetica: () => (
    <>
      <Bench />
      <Erlenmeyer x={36} y={40} w={92} h={98} fill={0.45} liquid="#cfe8f7" liquidOpacity={0.6}>
        {[[64, 128], [78, 131], [92, 127], [72, 122], [100, 131]].map(([x, y]) => <path key={x} d={`M${x - 6} ${y + 3} l3 -7 l8 -1 l3 7 z`} fill="#eceff1" stroke="#90a4ae" />)}
        <Bubbles pts={[[70, 112, 3], [86, 104, 2.6], [96, 116, 2.2], [80, 96, 2], [74, 118, 1.8]]} />
      </Erlenmeyer>
      <rect x={72} y={30} width={20} height={14} rx={3} fill="#5d4037" />
      <path d="M82 30 V18 H150 V62" fill="none" stroke="#90a4ae" strokeWidth="4" strokeLinejoin="round" />
      <GasSyringe x={150} y={56} length={100} height={34} fraction={0.4} capacity={100} major={50} />
    </>
  ),
  'cinetica-potencial': () => (
    <>
      <Bench />
      <rect x={20} y={112} width={280} height={12} rx={2} fill="#c3cdd1" stroke="#8c979b" />
      <rect x={150} y={52} width={18} height={14} rx={2} fill="#37474f" /><rect x={163} y={66} width={3} height={46} fill="#9aa5a9" />
      <line x1={159} x2={159} y1={66} y2={100} stroke="#ff5252" strokeDasharray="3 2" />
      <rect x={96} y={88} width={44} height={22} rx={3} fill="url(#kit-metal)" stroke="#7d8a8f" /><rect x={113} y={70} width={10} height={18} fill="#1f2a2d" />
      <g transform="translate(214 22)">
        <rect width={88} height={70} rx={6} fill="var(--surface)" stroke="var(--line)" />
        <rect x={10} y={14} width={50} height={10} rx={2} fill="var(--series-1)" /><rect x={10} y={30} width={22} height={10} rx={2} fill="var(--series-2)" />
        <rect x={10} y={46} width={72} height={10} rx={2} fill="none" stroke="var(--series-8)" strokeDasharray="4 2" />
      </g>
    </>
  ),
  'oxidos-hidroxidos': () => (
    <>
      <Bench />
      <rect x={40} y={70} width={12} height={70} rx={2} fill="url(#kit-metal-h)" /><circle cx={46} cy={58} r={14} fill="#ffffff" opacity="0.9" /><circle cx={46} cy={58} r={22} fill="#ffd36b" opacity="0.35" />
      <Beaker x={110} y={66} w={70} h={74} fill={0.6} liquid="#2f5fc4" liquidOpacity={0.45} />
      <TestTube x={210} y={64} w={16} h={72} fill={0.55} liquid="#d63384" liquidOpacity={0.8} /><TestTube x={238} y={64} w={16} h={72} fill={0.55} liquid="#e8c419" liquidOpacity={0.8} />
      <TestTube x={266} y={64} w={16} h={72} fill={0.55} liquid="#3fa34d" liquidOpacity={0.8} />
    </>
  ),
  'acidos-sales': () => (
    <>
      <Bench />
      <rect x={96} y={10} width={4} height={130} fill="url(#kit-metal-h)" />
      <Burette x={110} y={10} h={100} capacity={50} level={20} liquid="#a9cdea" liquidOpacity={0.85} major={10} />
      <Erlenmeyer x={88} y={92} w={60} h={48} fill={0.45} liquid="#d63384" liquidOpacity={0.5} />
      <MiniPlot x={200} y={24} d="M0 40 C30 38 45 34 50 22 C55 8 70 6 75 5" />
    </>
  ),
  'nomenclatura-inorganica': () => (
    <>
      {[['Fe', 'var(--fis)'], ['O', 'var(--qui)'], ['S', 'var(--qui)'], ['Cu', 'var(--fis)']].map(([s, c], i) => (
        <g key={s} transform={`translate(${28 + i * 58} 34)`}><rect width={50} height={56} rx={8} fill="var(--surface)" stroke={c} strokeWidth="2" />
        <text x={25} y={36} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: 'var(--ink)' }}>{s}</text></g>
      ))}
      <text x={160} y={128} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: 'var(--ink)' }}>Fe₂O₃ · óxido de hierro(III)</text>
    </>
  ),
  hidrocarburos: () => (
    <>
      <Bench />
      <g stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" fill="none">
        <polyline points="40,96 72,78 104,96 136,78 168,96" />
        <line x1={198} y1={86} x2={232} y2={86} /><line x1={198} y1={94} x2={232} y2={94} />
        <line x1={258} y1={82} x2={296} y2={82} /><line x1={258} y1={90} x2={296} y2={90} /><line x1={258} y1={98} x2={296} y2={98} />
      </g>
      {[[40, 96], [72, 78], [104, 96], [136, 78], [168, 96]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={7} fill="#5b6770" />)}
      <circle cx={198} cy={90} r={7} fill="#5b6770" /><circle cx={232} cy={90} r={7} fill="#5b6770" />
      <circle cx={258} cy={90} r={7} fill="#5b6770" /><circle cx={296} cy={90} r={7} fill="#5b6770" />
      <text x={104} y={128} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)', fontWeight: 700 }}>C–C</text>
      <text x={215} y={128} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)', fontWeight: 700 }}>C=C</text>
      <text x={277} y={128} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)', fontWeight: 700 }}>C≡C</text>
    </>
  ),
  aromaticos: () => (
    <>
      <Bench />
      <g transform="translate(160 80)">
        <polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" fill="none" stroke="var(--ink)" strokeWidth={3.5} strokeLinejoin="round" />
        <circle r={26} fill="none" stroke="var(--qui)" strokeWidth={3} />
        {[[0, -46], [40, -23], [40, 23], [0, 46], [-40, 23], [-40, -23]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={6} fill="#5b6770" />)}
      </g>
      <text x={262} y={60} style={{ fontSize: 15, fill: 'var(--ink-2)', fontWeight: 700 }}>4n+2</text>
    </>
  ),
  'nomenclatura-organica': () => (
    <>
      <Bench />
      <g stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" fill="none"><polyline points="34,100 70,80 106,100 142,80 178,100" /><line x1={106} y1={100} x2={106} y2={128} /></g>
      {[['1', 34, 118], ['2', 70, 72], ['3', 106, 92], ['4', 142, 72], ['5', 178, 118]].map(([t, x, y]) => <text key={t} x={x} y={y} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--qui)', fontWeight: 800 }}>{t}</text>)}
      <rect x={200} y={40} width={106} height={44} rx={8} fill="var(--surface)" stroke="var(--line)" />
      <text x={253} y={67} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>3-metil…ano</text>
    </>
  ),
  'grupos-oxigenados': () => (
    <>
      <Bench />
      <TestTube x={70} y={40} w={20} h={96} fill={0.4} liquid="#6b3f9e" />
      <TestTube x={104} y={40} w={20} h={96} fill={0.4} liquid="#d9dee0" />
      <TestTube x={138} y={40} w={20} h={96} fill={0.4} liquid="#5b8fd1" />
      <g transform="translate(200 26)" fontFamily="var(--font-data)" fontSize="15" fontWeight="700" fill="var(--ink)">
        <text x="0" y="20">R–OH</text><text x="0" y="46">R–CHO</text><text x="0" y="72">R–COOH</text><text x="0" y="98">R–COO–R′</text>
      </g>
    </>
  ),
  'grupos-nitrogenados': () => (
    <>
      <Bench />
      <g transform="translate(40 30)" fontFamily="var(--font-data)" fontWeight="700" fontSize="18" fill="var(--ink)">
        <text x="0" y="30">R–NH₂</text><text x="0" y="62">R–CO–NH–R′</text>
      </g>
      <MiniPlot x={200} y={30} d="M0 40 C 20 40, 30 2, 74 2" />
    </>
  ),
  'reacciones-organicas': () => (
    <>
      <Bench />
      <Erlenmeyer x={52} y={46} w={70} h={92} fill={0.45} liquid="#e9c46a" />
      <g transform="translate(150 50)" fontFamily="var(--font-data)" fontSize="15" fontWeight="700" fill="var(--ink)">
        <text x="0" y="20">RCOOH + R′OH</text><text x="34" y="44" fill="var(--accent)">⇌</text><text x="0" y="68">RCOOR′ + H₂O</text>
      </g>
    </>
  ),
  energia: () => (
    <>
      <path d="M20 30 Q60 30 90 100 Q120 150 160 140 Q200 130 228 90 Q250 62 300 62" fill="none" stroke="#78909c" strokeWidth="5" strokeLinecap="round" />
      <path d="M20 30 Q60 30 90 100 Q120 150 160 140 Q200 130 228 90 Q250 62 300 62" fill="none" stroke="#cfd8dc" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={62} cy={46} r={10} fill="url(#kit-bulb)" />
      <g opacity="0.35"><circle cx={42} cy={34} r={10} fill="#c62828" /></g>
      <g transform="translate(182 18)">
        <rect x={0} y={0} width={34} height={58} rx={4} fill="var(--surface)" stroke="var(--line)" />
        <rect x={6} y={28} width={9} height={26} rx={1.5} fill="var(--fis)" /><rect x={19} y={16} width={9} height={38} rx={1.5} fill="var(--data)" />
      </g>
    </>
  ),
  circuitos: () => (
    <g stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M40 120 V40 H100 M140 40 H180 M220 40 H280 V120 H200 M160 120 H40" />
      <path d="M100 40 l4 -8 l8 16 l8 -16 l8 16 l8 -16 l4 8" stroke="var(--fis)" strokeWidth="2.4" />
      <path d="M180 40 l4 -8 l8 16 l8 -16 l8 16 l8 -16 l4 8" stroke="var(--fis)" strokeWidth="2.4" />
      <path d="M160 108 V132 M170 114 V126" strokeWidth="3" />
      <path d="M160 120 H200" />
      <path d="M170 120 H174" />
      <g transform="translate(280 80)"><circle r={14} fill="var(--surface)" /><text y={5} textAnchor="middle" stroke="none" style={{ fontSize: 14, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>A</text></g>
      <g transform="translate(160 80)"><path d="M-40 -40 V0 H-14 M14 0 H40 V-40" /><circle r={14} fill="var(--surface)" /><text y={5} textAnchor="middle" stroke="none" style={{ fontSize: 14, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>V</text></g>
      {[[40, 40], [280, 40], [40, 120], [280, 120]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={3} fill="var(--ink)" stroke="none" />)}
    </g>
  ),
  estequiometria: () => {
    const H = (x: number, y: number) => <circle cx={x} cy={y} r={7} fill="#eceff1" stroke="#90a4ae" />;
    const O = (x: number, y: number) => <circle cx={x} cy={y} r={11} fill="#e53935" stroke="#b71c1c" />;
    return (
      <>
        <g>{H(34, 62)}{H(46, 62)}{H(34, 98)}{H(46, 98)}{H(34, 134)}{H(46, 134)}</g>
        <text x={74} y={102} style={{ fontSize: 20, fill: INK, fontWeight: 700 }}>+</text>
        <g>{O(108, 90)}{O(126, 90)}</g>
        <Arrow x1={150} y1={95} x2={190} y2={95} color={INK} w={2.4} />
        {[[220, 72], [264, 72]].map(([x, y]) => <g key={x}>{O(x, y)}{H(x - 12, y + 12)}{H(x + 12, y + 12)}</g>)}
        <g opacity="0.55">{H(232, 128)}{H(244, 128)}</g>
        <rect x={214} y={114} width={48} height={28} rx={6} fill="none" stroke="var(--data)" strokeDasharray="4 3" strokeWidth="1.6" />
      </>
    );
  },
  equilibrio: () => (
    <>
      <Bench />
      {['#ffe0b2', '#ffab91', '#e64a19', '#bf360c', '#ff8a65'].map((c, i) => <TestTube key={i} x={42 + i * 34} y={34} w={22} h={104} fill={0.7} liquid={c} liquidOpacity={0.75} />)}
      <g transform="translate(232 72)" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M0 0 H56 l-8 -6" /><path d="M56 12 H0 l8 6" />
      </g>
    </>
  ),
  ph: () => (
    <>
      <Bench />
      <rect x={20} y={8} width={6} height={132} fill="url(#kit-metal-h)" />
      <rect x={20} y={20} width={60} height={6} rx={2} fill="#78909c" />
      <Burette x={66} y={4} h={92} capacity={50} level={18} major={10} />
      <Erlenmeyer x={36} y={76} w={78} h={62} fill={0.45} liquid="#ec407a" liquidOpacity={0.55} />
      <circle cx={75} cy={98} r={2} fill="#e7f0f7" stroke="var(--glass-edge)" strokeWidth="0.6" />
      <MiniPlot x={150} y={20} w={150} h={100} d="M0 70 Q60 66 70 56 L74 14 Q84 4 128 2" points={[[72, 36]]} color="var(--qui)" />
    </>
  ),
  poblacion: () => (
    <>
      <MiniPlot x={20} y={14} w={180} h={130} d="M0 106 C40 104 60 60 80 30 S130 6 156 6" color="var(--amb)" />
      <path d="M32 26 H196" stroke="var(--data)" strokeDasharray="5 4" strokeWidth="1.4" />
      <text x={186} y={22} style={{ fontSize: 11, fill: 'var(--data)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>K</text>
      {[[236, 50, 1], [270, 80, 0.8], [240, 110, 0.9], [286, 120, 0.7], [280, 40, 0.6]].map(([x, y, s]) => (
        <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-18 0 Q-4 -12 12 0 Q-4 12 -18 0 Z M12 0 l10 -8 v16 z" fill="#4f9fe0" stroke="#1e5fae" strokeWidth="1.2" />
          <circle cx={-10} cy={-2} r={1.6} fill="#0d2b52" />
        </g>
      ))}
    </>
  ),
  popgen: () => (
    <>
      <MiniPlot x={20} y={14} w={200} h={130} d="M0 54 L20 50 L40 56 L60 44 L80 40 L100 46 L120 30 L140 26 L160 20 L176 16" color="var(--bio)" />
      <path d="M32 76 L52 82 L72 74 L92 90 L112 86 L132 98 L152 94 L172 108 L188 112" transform="translate(0 -10)" fill="none" stroke="var(--qui)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <path d="M32 68 L52 64 L72 72 L92 66 L112 70 L132 62 L152 68 L172 66 L188 64" fill="none" stroke="var(--fis)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      {[[244, 46, '#fbc02d'], [270, 46, '#fbc02d'], [296, 46, '#7cb342'], [244, 76, '#fbc02d'], [270, 76, '#7cb342'], [296, 76, '#fbc02d'], [244, 106, '#fbc02d'], [270, 106, '#fbc02d'], [296, 106, '#7cb342']].map(([x, y, c]) => <circle key={`${x}${y}`} cx={x as number} cy={y as number} r={10} fill={c as string} stroke="#5d4037" strokeOpacity="0.4" />)}
    </>
  ),
  /* ---- Miniaturas propias de las prácticas que antes usaban la ilustración genérica del área (rediseño 2026-10) ---- */
  maquinas: () => (
    <>
      <Bench />
      <path d="M160 140 L146 112 H174 Z" fill="url(#kit-metal)" stroke="#78909c" />
      <rect x={40} y={104} width={240} height={8} rx={2} fill="url(#kit-wood)" stroke="#b8975a" transform="rotate(-6 160 108)" />
      <g transform="rotate(-6 160 108)">
        <rect x={56} y={80} width={30} height={24} rx={3} fill="#546e7a" /><text x={71} y={96} textAnchor="middle" style={{ fontSize: 10, fill: '#fff', fontWeight: 700 }}>400 g</text>
        <path d="M250 104 V64" stroke={INK} strokeWidth="1.6" /><rect x={244} y={44} width={12} height={22} rx={2} fill="var(--surface)" stroke={INK} />
      </g>
      <Arrow x1={250} y1={40} x2={250} y2={14} color="var(--data)" w={2.4} />
      {Array.from({ length: 9 }, (_, i) => <line key={i} x1={52 + i * 27} x2={52 + i * 27} y1={113 - (52 + i * 27 - 160) * Math.tan(-6 * Math.PI / 180) - 4} y2={113 - (52 + i * 27 - 160) * Math.tan(-6 * Math.PI / 180)} stroke="#4d3b1c" strokeWidth="0.8" />)}
    </>
  ),
  calor: () => (
    <>
      <Bench />
      <Beaker x={30} y={64} w={70} h={74} fill={0.6} liquid="#ef6c4a" liquidOpacity={0.45} />
      <Beaker x={112} y={64} w={70} h={74} fill={0.6} liquid="#4f9fe0" liquidOpacity={0.45} />
      <g transform="rotate(6 70 80)"><Thermometer x={66} y={20} h={96} min={0} max={100} value={60} /></g>
      <g transform="rotate(-6 150 80)"><Thermometer x={146} y={20} h={96} min={0} max={100} value={20} /></g>
      <MiniPlot x={200} y={20} w={108} h={84} d="M0 6 Q30 30 86 34" points={[[0, 6], [86, 34]]} color="#e53935" />
      <path d="M212 90 Q242 66 298 62" transform="translate(0 -32)" fill="none" stroke="#1e88e5" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  movimiento: () => (
    <>
      <path d="M10 124 H310" stroke="var(--bench-edge)" strokeWidth="3" />
      {[30, 90, 150, 210, 270].map((x, i) => <g key={x}><path d={`M${x} 124 V100`} stroke={INK} strokeWidth="1.4" /><path d={`M${x} 100 l14 5 l-14 5 z`} fill={i === 0 ? 'var(--ok)' : i === 4 ? 'var(--bad)' : 'var(--fis)'} /><text x={x} y={140} textAnchor="middle" style={{ fontSize: 9, fill: INK, fontFamily: 'var(--font-data)' }}>{i * 5} m</text></g>)}
      <g transform="translate(118 74)"><circle r={7} fill="var(--fis)" /><path d="M0 7 V28 M0 14 L-12 22 M0 14 L12 8 M0 28 L-10 44 M0 28 L12 42" stroke="var(--fis)" strokeWidth="4" strokeLinecap="round" fill="none" /></g>
      <MiniPlot x={196} y={8} w={108} h={70} d="M0 50 L86 2" points={[[0, 50], [43, 26], [86, 2]]} />
    </>
  ),
  ecosistema: () => (
    <>
      <Bench />
      <path d="M96 38 h88 v-10 h-88 z" fill="#8d6e63" />
      <path d="M100 38 Q90 40 90 54 V128 Q90 140 104 140 H176 Q190 140 190 128 V54 Q190 40 180 38 Z" fill="#9fd3ef" fillOpacity="0.35" stroke="var(--glass-edge)" strokeWidth="2" />
      <path d="M92 110 H188 V128 Q188 138 176 138 H104 Q92 138 92 128 Z" fill="#8d6e63" opacity="0.7" />
      {[112, 130, 150].map((x, i) => <path key={x} d={`M${x} 110 Q${x - 6} ${80 - i * 6} ${x + 4} ${60 + i * 4}`} stroke="var(--bio)" strokeWidth="3" fill="none" strokeLinecap="round" />)}
      <g transform="translate(166 104)"><path d="M-8 4 Q0 -10 10 2 Z" fill="#a1887f" /><circle cx={2} cy={-2} r={6} fill="none" stroke="#6d4c41" strokeWidth="2" /></g>
      <g transform="translate(250 30)"><path d="M-22 0 H22 L12 22 H-12 Z" fill="#ffca28" stroke="#f57f17" /><path d="M-10 32 L-24 56 M0 34 V60 M10 32 L24 56" stroke="#ffca28" strokeWidth="2" strokeDasharray="4 4" /></g>
      <Bubbles pts={[[120, 92, 2.4], [140, 80, 2], [158, 70, 2.6]]} />
    </>
  ),
  'circuitos-simples': () => (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M60 120 V40 H260 V120 H200 M150 120 H60" stroke="var(--ink)" strokeWidth="2.4" />
      <rect x={150} y={110} width={50} height={20} rx={4} fill="#37474f" stroke="none" /><rect x={196} y={115} width={6} height={10} fill="#b0bec5" stroke="none" />
      <text x={175} y={124} textAnchor="middle" style={{ fontSize: 9, fill: '#fff', fontWeight: 700, fontFamily: 'var(--font-data)' }}>1,5 V</text>
      <g transform="translate(160 40)"><circle r={18} fill="#fff59d" stroke="#f9a825" strokeWidth="2" /><path d="M-6 6 L-3 -6 L0 4 L3 -6 L6 6" stroke="#6d4c41" strokeWidth="1.4" />{[0, 1, 2, 3, 4].map((i) => { const a = -Math.PI * (0.1 + i * 0.2); return <line key={i} x1={26 * Math.cos(a)} y1={26 * Math.sin(a)} x2={34 * Math.cos(a)} y2={34 * Math.sin(a)} stroke="#f9a825" strokeWidth="2" />; })}</g>
      <path d="M60 80 l18 -12" stroke="var(--ink)" strokeWidth="2.4" /><circle cx={60} cy={80} r={3} fill="var(--ink)" stroke="none" /><circle cx={60} cy={68} r={3} fill="var(--ink)" stroke="none" />
    </g>
  ),
  presion: () => (
    <>
      <Bench />
      <rect x={30} y={30} width={120} height={108} rx={4} fill="#9fd3ef" fillOpacity="0.45" stroke="var(--glass-edge)" strokeWidth="2" />
      <path d="M100 30 V96" stroke="#455a64" strokeWidth="3" /><circle cx={100} cy={98} r={6} fill="#455a64" />
      <path d="M100 30 V18 H200 V120 a16 16 0 0 0 32 0 V40" fill="none" stroke="var(--glass-edge)" strokeWidth="8" strokeLinecap="round" />
      <path d="M200 70 V120 a16 16 0 0 0 32 0 V54" fill="none" stroke="#ef5350" strokeWidth="4" />
      {[40, 60, 80, 100].map((y) => <line key={y} x1={240} x2={250} y1={y} y2={y} stroke={INK} />)}
      <path d="M244 54 H252 M244 70 H252" stroke="var(--data)" strokeWidth="1.6" /><Arrow x1={262} y1={70} x2={262} y2={54} color="var(--data)" />
    </>
  ),
  flotacion: () => (
    <>
      <Bench />
      <rect x={60} y={6} width={130} height={6} rx={2} fill="#78909c" />
      <rect x={116} y={12} width={18} height={44} rx={3} fill="var(--surface)" stroke={INK} />
      {[20, 28, 36, 44].map((y) => <line key={y} x1={120} x2={130} y1={y} y2={y} stroke={INK} strokeWidth="0.8" />)}
      <path d="M125 56 V74" stroke={INK} strokeWidth="1.4" />
      <Beaker x={70} y={58} w={110} h={80} fill={0.6} liquid="#4f9fe0" liquidOpacity={0.45} />
      <rect x={112} y={74} width={26} height={40} rx={3} fill="url(#kit-metal-h)" stroke="#78909c" />
      <Arrow x1={125} y1={134} x2={125} y2={118} color="var(--fis)" w={2.4} />
      <MiniPlot x={210} y={24} w={98} h={78} d="M0 6 L40 40 L76 40" points={[[0, 6], [20, 23], [40, 40], [76, 40]]} />
    </>
  ),
  conduccion: () => (
    <>
      <Bench />
      <rect x={34} y={70} width={250} height={10} rx={3} fill="url(#kit-metal)" stroke="#a1662f" />
      <path d="M44 120 Q38 98 50 84 Q52 100 60 96 Q58 110 64 120 Z" fill="#ff7043" /><path d="M48 120 Q46 106 54 98 Q56 110 60 120 Z" fill="#ffca28" />
      <rect x={40} y={120} width={30} height={20} rx={3} fill="#455a64" />
      {[100, 140, 180, 220, 260].map((x, i) => <g key={x} opacity={i < 2 ? 0.35 : 1}><path d={`M${x} 80 v${i < 2 ? 50 : 10}`} stroke="#90a4ae" strokeWidth="2" /><circle cx={x} cy={i < 2 ? 132 : 92} r={3.5} fill="#cfd8dc" stroke="#78909c" /></g>)}
      <Arrow x1={80} y1={56} x2={200} y2={56} color="var(--data)" w={2.2} />
    </>
  ),
  sonido: () => (
    <>
      <Bench />
      <path d="M50 140 V96 M42 96 V40 Q42 30 50 30 Q58 30 58 40 V96 Z" fill="none" stroke="url(#kit-metal-h)" strokeWidth="6" strokeLinejoin="round" />
      <rect x={36} y={130} width={28} height={10} rx={2} fill="#6d4c41" />
      {[1, 2, 3].map((i) => <path key={i} d={`M${66 + i * 10} ${60 - i * 6} q${10 + i * 2} ${16 + i * 6} 0 ${32 + i * 12}`} fill="none" stroke="var(--fis)" strokeWidth="2" opacity={1 - i * 0.22} />)}
      <rect x={140} y={22} width={160} height={104} rx={8} fill="#1d2526" stroke="#455a64" />
      {[0, 1, 2, 3].map((i) => <line key={i} x1={150} x2={290} y1={40 + i * 24} y2={40 + i * 24} stroke="#2e7d32" strokeOpacity="0.5" />)}
      <path d={Array.from({ length: 71 }, (_, i) => `${i ? 'L' : 'M'}${(150 + i * 2).toFixed(1)} ${(74 + 26 * Math.sin(i / 70 * Math.PI * 6)).toFixed(1)}`).join('')} fill="none" stroke="#69f0ae" strokeWidth="2" />
    </>
  ),
  trabajo: () => (
    <>
      <path d="M20 140 H300 V60 Z" fill="url(#kit-wood)" stroke="#b8975a" />
      <path d="M268 140 A32 32 0 0 0 266 128" fill="none" stroke="var(--data)" strokeWidth="1.8" /><text x={248} y={134} style={{ fontSize: 10, fill: 'var(--data)', fontWeight: 700 }}>30°</text>
      <g transform="translate(150 104) rotate(-16)"><rect x={-22} y={-20} width={44} height={20} rx={3} fill="#546e7a" /><text y={-6} textAnchor="middle" style={{ fontSize: 9, fill: '#fff', fontWeight: 700 }}>500 g</text></g>
      <Arrow x1={176} y1={94} x2={232} y2={78} color="var(--data)" w={2.6} />
      <path d="M150 104 V136" stroke={INK} strokeDasharray="3 3" /><Arrow x1={150} y1={110} x2={150} y2={134} color="var(--fis)" />
    </>
  ),
  proyectiles: () => (
    <>
      <path d="M0 140 H320" stroke="var(--bench-edge)" strokeWidth="3" />
      <rect x={20} y={100} width={30} height={40} fill="#78909c" />
      <path d={Array.from({ length: 13 }, (_, i) => { const t = i / 12; return `${i ? 'L' : 'M'}${(50 + t * 240).toFixed(1)} ${(100 - 150 * t + 190 * t * t).toFixed(1)}`; }).join('')} fill="none" stroke="var(--fis)" strokeWidth="2" strokeDasharray="5 5" />
      {[0.25, 0.5, 0.75].map((t) => <circle key={t} cx={50 + t * 240} cy={100 - 150 * t + 190 * t * t} r={6} fill="var(--fis)" opacity={0.35 + t * 0.5} />)}
      <Arrow x1={50} y1={100} x2={86} y2={76} color="var(--data)" w={2.4} />
      <path d="M286 140 v-8 M294 140 v-8" stroke="var(--data)" strokeWidth="2" />
    </>
  ),
  pendulo: () => (
    <>
      <rect x={60} y={10} width={200} height={8} rx={2} fill="url(#kit-metal)" />
      <path d="M160 18 L206 112" stroke={INK} strokeWidth="1.6" />
      <path d="M160 18 L160 120" stroke={INK} strokeWidth="1" strokeDasharray="3 4" />
      <path d="M118 108 A100 100 0 0 0 202 108" fill="none" stroke="var(--data)" strokeWidth="1.6" strokeDasharray="4 3" />
      <circle cx={206} cy={112} r={11} fill="url(#kit-metal-h)" stroke="#546e7a" />
      <path d="M160 52 A36 36 0 0 0 175 51" fill="none" stroke="var(--data)" strokeWidth="2" />
      <MiniPlot x={234} y={38} w={78} h={60} d={Array.from({ length: 25 }, (_, i) => `${i ? 'L' : 'M'}${(i * 2.3).toFixed(1)} ${(20 + 16 * Math.cos(i / 24 * Math.PI * 4)).toFixed(1)}`).join('')} />
    </>
  ),
  choques: () => (
    <>
      <rect x={10} y={112} width={300} height={8} rx={2} fill="url(#kit-metal)" stroke="#9aa5a9" />
      <g filter="url(#kit-shadow-soft)"><rect x={60} y={86} width={64} height={26} rx={5} fill="#1e5fae" /><rect x={196} y={86} width={64} height={26} rx={5} fill="#c2410c" /></g>
      {[74, 110, 210, 246].map((x) => <circle key={x} cx={x} cy={114} r={5} fill="#263238" />)}
      <Arrow x1={70} y1={74} x2={130} y2={74} color="#1e5fae" w={2.6} />
      <Arrow x1={250} y1={74} x2={210} y2={74} color="#c2410c" w={2.6} />
      <text x={160} y={52} textAnchor="middle" style={{ fontSize: 13, fill: INK, fontWeight: 700, fontFamily: 'var(--font-data)' }}>p = m·v</text>
    </>
  ),
  interferencia: () => (
    <>
      <rect x={14} y={70} width={30} height={20} rx={3} fill="#37474f" /><path d="M44 80 H96" stroke="#e53935" strokeWidth="3" />
      <rect x={96} y={20} width={6} height={120} fill="#455a64" /><rect x={96} y={68} width={6} height={6} fill="var(--surface)" /><rect x={96} y={86} width={6} height={6} fill="var(--surface)" />
      {[1, 2, 3].map((i) => <g key={i} opacity={1 - i * 0.25}><circle cx={102} cy={71} r={i * 18} fill="none" stroke="#e53935" strokeWidth="1" /><circle cx={102} cy={89} r={i * 18} fill="none" stroke="#e53935" strokeWidth="1" /></g>)}
      <rect x={250} y={20} width={14} height={120} fill="#1d2526" />
      {Array.from({ length: 11 }, (_, i) => <rect key={i} x={251} y={22 + i * 10.6} width={12} height={5} fill="#ff5252" opacity={1 - Math.abs(i - 5) * 0.16} />)}
    </>
  ),
  induccion: () => (
    <>
      <Bench />
      {Array.from({ length: 8 }, (_, i) => <ellipse key={i} cx={150 + i * 10} cy={96} rx={6} ry={28} fill="none" stroke="#b87333" strokeWidth="3.4" />)}
      <g transform="translate(66 86)"><rect width={34} height={20} fill="#e53935" /><rect x={34} width={34} height={20} fill="#1e88e5" /><text x={17} y={14} textAnchor="middle" style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }}>N</text><text x={51} y={14} textAnchor="middle" style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }}>S</text></g>
      <Arrow x1={60} y1={76} x2={118} y2={76} color="var(--data)" w={2.4} />
      <path d="M150 124 V140 H260 M220 124 V134" stroke={INK} strokeWidth="1.4" fill="none" />
      <g transform="translate(270 70)"><circle r={26} fill="var(--surface)" stroke={INK} strokeWidth="1.6" /><path d="M-18 6 A20 20 0 0 1 18 6" fill="none" stroke={INK} /><path d="M0 8 L10 -14" stroke="#e53935" strokeWidth="2" /></g>
    </>
  ),
  'extraccion-adn': () => (
    <>
      <Bench />
      <TestTube x={70} y={14} w={34} h={124} fill={0.75} liquid="#f8bbd0" liquidOpacity={0.6} />
      <path d="M76 52 Q86 46 92 58 Q82 62 88 74 Q96 66 98 80" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      <rect x={70} y={40} width={34} height={24} fill="#e3f2fd" opacity="0.5" />
      <path d="M130 140 L140 50" stroke="#8d6e63" strokeWidth="3" />
      {Array.from({ length: 9 }, (_, i) => { const x = 180 + i * 14, a = (i / 8) * Math.PI * 2, y1 = 76 + 30 * Math.sin(a), y2 = 76 - 30 * Math.sin(a); return <line key={i} x1={x} x2={x} y1={y1} y2={y2} stroke={['#e53935', '#43a047', '#fbc02d', '#1e88e5'][i % 4]} strokeWidth="3" />; })}
      {[1, -1].map((s) => <path key={s} d={Array.from({ length: 41 }, (_, i) => `${i ? 'L' : 'M'}${(180 + i * 2.8).toFixed(1)} ${(76 + s * 30 * Math.sin(i / 40 * Math.PI * 2)).toFixed(1)}`).join('')} fill="none" stroke="var(--bio)" strokeWidth="3.4" />)}
    </>
  ),
  conservacion: () => (
    <>
      <Bench />
      <DigitalBalance x={70} y={104} w={180} reading="152.34" />
      <Erlenmeyer x={120} y={36} w={80} h={70} fill={0.4} liquid="#e0e0e0" liquidOpacity={0.6} />
      <path d="M150 36 Q138 8 160 4 Q182 8 170 36 Z" fill="#ef5350" opacity="0.85" />
      <Bubbles pts={[[150, 90, 2.2], [162, 84, 1.8], [170, 92, 2.4]]} />
    </>
  ),
  balanceo: () => (
    <>
      {[['2', 'H₂', 40], ['', 'O₂', 120], ['2', 'H₂O', 220]].map(([c, f, x]) => <g key={f as string} transform={`translate(${x} 40)`}><rect width={62} height={34} rx={8} fill="var(--surface)" stroke="var(--qui)" strokeWidth="1.6" /><text x={31} y={23} textAnchor="middle" style={{ fontSize: 15, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{c}{f}</text></g>)}
      <text x={110} y={63} textAnchor="middle" style={{ fontSize: 16, fill: INK, fontWeight: 700 }}>+</text>
      <Arrow x1={188} y1={57} x2={214} y2={57} color={INK} w={2} />
      {[['H', 4, 4, 70], ['O', 2, 2, 110]].map(([el, l, r, y]) => <g key={el as string}><text x={34} y={(y as number) + 18} style={{ fontSize: 11, fill: INK, fontWeight: 700 }}>{el}</text><rect x={50} y={(y as number) + 8} width={(l as number) * 22} height={12} rx={3} fill="var(--fis)" /><rect x={200} y={(y as number) + 8} width={(r as number) * 22} height={12} rx={3} fill="var(--ok)" /></g>)}
    </>
  ),
  mol: () => (
    <>
      <Bench />
      <DigitalBalance x={30} y={104} w={160} reading="1.250" />
      <path d="M80 104 Q110 76 140 104 Z" fill="#fafafa" stroke="#bdbdbd" />
      <text x={248} y={66} textAnchor="middle" style={{ fontSize: 15, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>6,022×10²³</text>
      <text x={248} y={88} textAnchor="middle" style={{ fontSize: 11, fill: INK, fontFamily: 'var(--font-data)' }}>partículas/mol</text>
      <text x={248} y={116} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--qui)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>n = m / M</text>
    </>
  ),
  geometria: () => {
    const c: [number, number] = [160, 82];
    const ends: [number, number][] = [[160, 22], [100, 116], [216, 122], [186, 64]];
    return (
      <>
        {ends.map(([x, y], i) => <line key={i} x1={c[0]} y1={c[1]} x2={x} y2={y} stroke="#90a4ae" strokeWidth={i === 3 ? 4 : 7} strokeDasharray={i === 3 ? '4 4' : undefined} />)}
        <circle cx={c[0]} cy={c[1]} r={20} fill="#455a64" />
        {ends.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 3 ? 10 : 13} fill="#eceff1" stroke="#90a4ae" />)}
        <path d="M144 58 A26 26 0 0 0 138 96" fill="none" stroke="var(--data)" strokeWidth="1.8" />
        <text x={96} y={70} style={{ fontSize: 12, fill: 'var(--data)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>109,5°</text>
      </>
    );
  },
  respiracion: () => (
    <>
      <Bench />
      <TestTube x={60} y={30} w={40} h={108} fill={0.3} liquid="#c5e1a5" liquidOpacity={0.7} />
      {[[72, 118], [84, 124], [78, 110], [90, 114]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx={5} ry={4} fill="#f9a825" stroke="#8d6e63" />)}
      <path d="M80 30 V20 H270 V60" fill="none" stroke="var(--glass-edge)" strokeWidth="5" />
      {Array.from({ length: 10 }, (_, i) => <line key={i} x1={110 + i * 16} x2={110 + i * 16} y1={14} y2={i % 5 ? 18 : 22} stroke={INK} />)}
      <circle cx={196} cy={20} r={4} fill="#1e88e5" /><Arrow x1={196} y1={34} x2={150} y2={34} color="var(--data)" />
    </>
  ),
  agua: () => (
    <>
      <path d="M0 96 Q80 70 160 96 T320 92 V160 H0 Z" fill="#4f9fe0" fillOpacity="0.35" />
      <path d="M0 96 Q80 70 160 96 T320 92" fill="none" stroke="#1e88e5" strokeWidth="2" />
      <rect x={90} y={50} width={16} height={36} fill="#8d6e63" /><path d="M106 60 H126 V82" stroke="#6d4c41" strokeWidth="4" fill="none" />
      {[50, 180, 260].map((x, i) => <TestTube key={x} x={x} y={20} w={16} h={58} fill={0.7} liquid={['#81d4fa', '#a1887f', '#90caf9'][i]} liquidOpacity={0.7} />)}
      <text x={140} y={140} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>O₂ disuelto</text>
    </>
  ),
  expresion: () => (
    <>
      <path d="M10 104 H310" stroke="var(--fis)" strokeWidth="4" strokeLinecap="round" />
      {Array.from({ length: 20 }, (_, i) => <line key={i} x1={20 + i * 15} x2={20 + i * 15} y1={104} y2={92} stroke={['#e53935', '#43a047', '#fbc02d', '#1e88e5'][i % 4]} strokeWidth="3" />)}
      <ellipse cx={170} cy={92} rx={40} ry={18} fill="#9575cd" opacity="0.8" /><ellipse cx={170} cy={116} rx={46} ry={14} fill="#7e57c2" opacity="0.8" />
      {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={164 - i * 14} cy={56 - i * 8} r={8} fill={['#ffb74d', '#81c784', '#64b5f6', '#e57373', '#ba68c8'][i]} stroke="#fff" />)}
      <text x={250} y={60} style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>AUG</text>
    </>
  ),
  secuencias: () => (
    <g style={{ fontFamily: 'var(--font-data)', fontWeight: 700 }}>
      {['ATGGTGCACCTGACT', 'ATGGTGCATCTGACT'].map((seq, r) => seq.split('').map((b, i) => <g key={`${r}${i}`}><rect x={24 + i * 18} y={42 + r * 40} width={16} height={24} rx={3} fill={{ A: '#e5737333', T: '#fbc02d33', G: '#43a04733', C: '#1e88e533' }[b]} /><text x={32 + i * 18} y={59 + r * 40} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)' }}>{b}</text></g>))}
      {Array.from({ length: 15 }, (_, i) => <text key={i} x={32 + i * 18} y={78} textAnchor="middle" style={{ fontSize: 11, fill: i === 8 ? 'var(--bad)' : INK }}>{i === 8 ? '×' : '|'}</text>)}
      <text x={24} y={134} style={{ fontSize: 11, fill: INK }}>identidad 93 % · GC 53 %</text>
    </g>
  ),
  rastreo: () => (
    <>
      <path d="M20 60 H300" stroke={INK} strokeWidth="2" />
      {[[40, 50, 'var(--fis)'], [110, 40, 'var(--bio)'], [170, 70, 'var(--data)'], [262, 30, 'var(--qui)']].map(([x, w, c]) => <rect key={x as number} x={x as number} y={50} width={w as number} height={20} rx={4} fill={c as string} />)}
      <Arrow x1={205} y1={86} x2={205} y2={120} color={INK} w={2} />
      <rect x={150} y={122} width={110} height={24} rx={6} fill="var(--surface)" stroke="var(--line)" />
      <text x={205} y={139} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>proteína</text>
      <text x={40} y={40} style={{ fontSize: 10, fill: INK, fontFamily: 'var(--font-data)' }}>cromosoma 11</text>
    </>
  ),
  proteinas: () => (
    <>
      <path d={Array.from({ length: 121 }, (_, i) => `${i ? 'L' : 'M'}${(30 + i * 1.4 + 14 * Math.cos(i / 6)).toFixed(1)} ${(80 + 30 * Math.sin(i / 6)).toFixed(1)}`).join('')} fill="none" stroke="var(--bio)" strokeWidth="5" strokeLinecap="round" />
      <path d="M210 120 L240 40 L270 120 L300 40" fill="none" stroke="var(--fis)" strokeWidth="9" strokeLinejoin="round" opacity="0.8" />
      <path d="M296 32 l10 14 l-16 2 z" fill="var(--fis)" />
    </>
  ),
  metabolismo: () => {
    const nodes: [number, number][] = [[40, 40], [110, 40], [180, 40], [250, 40], [110, 110], [180, 110], [280, 110]];
    const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 2], [3, 6], [5, 6]];
    return (
      <>
        {edges.map(([a, b], i) => <Arrow key={i} x1={nodes[a][0] + (nodes[b][0] - nodes[a][0]) * 0.18} y1={nodes[a][1] + (nodes[b][1] - nodes[a][1]) * 0.18} x2={nodes[a][0] + (nodes[b][0] - nodes[a][0]) * 0.82} y2={nodes[a][1] + (nodes[b][1] - nodes[a][1]) * 0.82} color={i % 3 ? INK : 'var(--data)'} w={i % 3 ? 1.4 : 3} />)}
        {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={10} fill="var(--surface)" stroke="var(--bio)" strokeWidth="2.4" />)}
      </>
    );
  },
  reto: () => (
    <>
      <path d="M10 30 Q120 60 160 90 T310 130" fill="none" stroke="#4f9fe0" strokeWidth="14" strokeOpacity="0.45" strokeLinecap="round" />
      {[[60, 44], [130, 72], [200, 104], [270, 124]].map(([x, y], i) => <g key={x}><circle cx={x} cy={y} r={7} fill="var(--data)" stroke="#fff" strokeWidth="2" /><text x={x} y={y - 12} textAnchor="middle" style={{ fontSize: 10, fill: INK, fontWeight: 700, fontFamily: 'var(--font-data)' }}>P{i + 1}</text></g>)}
      <MiniPlot x={196} y={8} w={110} h={66} d="M0 4 L86 40" points={[[0, 4], [28, 16], [58, 26], [86, 40]]} color="var(--amb)" />
    </>
  ),
};

/** Respaldo por área para prácticas futuras sin miniatura propia. */
function AreaFallback({ area }: { area: Area }) {
  switch (area) {
    case 'biologia': return SCENES.celulas();
    case 'quimica': return (<><Bench /><Erlenmeyer x={60} y={40} w={88} h={98} fill={0.5} liquid="#9c6ade" /><Beaker x={176} y={70} w={70} h={68} fill={0.4} liquid="#4f9fe0" /></>);
    case 'fisica': return SCENES.ondas();
    default: return SCENES.redes();
  }
}

export default function Thumbnail({ id, area }: { id: string; area: Area }) {
  const scene = SCENES[id];
  return (
    <svg viewBox="0 0 320 160" className="thumb-svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      {scene ? scene() : <AreaFallback area={area} />}
    </svg>
  );
}

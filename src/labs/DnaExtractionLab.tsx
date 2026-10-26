import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BASES, BASE_NAME, DNA_EXTRACTION_INSTRUMENTS, EXTRACTION_LIMITS, FACTOR_LABEL, FRUITS, MAX_STRAND, MIN_STRAND, WALLACE_MAX_VALID,
  appearanceOf, baseCounts, checkDuplex, findFruit, gcPercent, normalizeSequence, simulateExtraction, wallaceTm, extractionConditions,
  type Base, type DuplexCheck, type FactorKey, type Fruit, type FruitId, type Orientation,
} from '../models/dnaExtraction';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { resolutionText } from '../components/Experiment';
import { BenchTop, Beaker, ContactShadow, Stopwatch, TestTube, Thermometer, shade } from './kit';
import { DragHandle, ManipHint, ManipScene, useSvgDrag, type Pt } from './manipulate';

/* ================================================================== utilidades comunes */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Animación de una etapa: progreso 0 → 1 con requestAnimationFrame (tiempo acotado); salta al final con movimiento reducido. */
function useTween() {
  const [anim, setAnim] = useState<{ kind: string; t: number } | null>(null);
  const raf = useRef(0);
  const run = useCallback((kind: string, ms: number) => {
    cancelAnimationFrame(raf.current);
    if (prefersReducedMotion()) { setAnim(null); return; }
    const start = performance.now();
    const step = (now: number) => {
      const t = clamp01(Math.max(0, now - start) / ms);
      if (t >= 1) { setAnim(null); return; }
      setAnim({ kind, t });
      raf.current = requestAnimationFrame(step);
    };
    setAnim({ kind, t: 0 });
    raf.current = requestAnimationFrame(step);
  }, []);
  const stop = useCallback(() => { cancelAnimationFrame(raf.current); setAnim(null); }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  /** Progreso de una etapa: 1 si no se está animando. */
  const p = (kind: string) => (anim && anim.kind === kind ? anim.t : 1);
  return { anim, run, stop, p };
}

/** Leyenda breve que dice si el dibujo es ilustrativo o sale de un cálculo. */
function Caption({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return <text x={x} y={y} style={{ fontSize: 11, fill: 'var(--ink-2)', fontStyle: 'italic' }}>{children}</text>;
}

/* ================================================================== ACTIVIDAD 1: extracción */

const W1 = 860, H1 = 460;
const VIEW1 = `0 0 ${W1} ${H1}`;
const BENCH_Y = 420;
const BAG = { x: 40, y: 250, w: 150, h: 162 };
const PIN_Y = 232;
const BUF = { x: 232, y: 300, w: 78, h: 120 };
const TUBE = { x: 452, y: 182, w: 40, h: 218 };
const TCX = TUBE.x + TUBE.w / 2;
const FUN = { top: 112, rim: 58, neck: 168 };
const ICE = { x: 566, y: 318, w: 116, h: 102 };
const BOT = { x: 598, y: 238, w: 52, h: 176 };
const THERMO = { x: 712, y: 226, h: 186 };
const ROD = { x0: 742, x1: 850, y: 408 };
const FILTRATE = 0.42, ETHANOL = 0.36;

const BUFFER_COLOR = '#bfe3ea';
const ETHANOL_COLOR = '#d6e9f3';

type Stage = 0 | 1 | 2 | 3 | 4;
const STAGE_TEXT: Record<Stage, string> = {
  0: 'Fruta en la bolsa: falta el tampón de lisis',
  1: 'Tampón en la bolsa: machaca y luego filtra',
  2: 'Extracto filtrado en el tubo: falta el alcohol frío',
  3: 'Alcohol sobre el filtrado: el ADN precipita en la interfase',
  4: 'ADN enrollado en la varilla',
};

const STEPS: { title: string; why: string }[] = [
  { title: 'Machacar la fruta con el tampón', why: 'Rompe los tejidos y muchas paredes celulares de celulosa, y pone las células en contacto con el tampón. Machacar demasiado puede fragmentar el ADN.' },
  { title: 'Detergente (lisis)', why: 'Desarma las bicapas de fosfolípidos de la membrana celular y de la nuclear: el contenido del núcleo sale al líquido.' },
  { title: 'Sal (NaCl)', why: 'Los iones Na⁺ neutralizan las cargas negativas de los fosfatos del ADN; las moléculas se repelen menos y pueden agregarse.' },
  { title: 'Filtrar', why: 'El filtro retiene restos de tejido y paredes; pasa el líquido con el ADN disuelto.' },
  { title: 'Alcohol frío por la pared', why: 'El ADN es poco soluble en alcohol, y menos aún en frío: en la interfase se agrega en hebras blancas visibles.' },
  { title: 'Enrollar con la varilla', why: 'Las hebras, formadas por millones de moléculas enredadas (con algo de ARN y proteínas), se enrollan y se pueden sacar.' },
];
/** Paso de la lista que sigue en cada etapa (−1: procedimiento terminado). */
const STEP_OF_STAGE: Record<Stage, number> = { 0: 0, 1: 3, 2: 4, 3: 5, 4: -1 };

const mmss = (min: number) => `${String(Math.floor(min)).padStart(2, '0')}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`;

/** Trozos de fruta dentro de la bolsa: se achican y forman puré a medida que se machaca (ilustración). */
function FruitPieces({ fruit, mashed, x, y, w, bottom, amount }: { fruit: Fruit; mashed: number; x: number; y: number; w: number; bottom: number; amount: number }) {
  const m = clamp01(mashed);
  const size = (1 - 0.65 * m) * 20 * Math.sqrt(Math.max(0.15, amount));
  const pureeH = (14 + 34 * m) * amount;
  const spots = [[0.2, 0.62], [0.42, 0.7], [0.66, 0.6], [0.8, 0.74], [0.3, 0.82], [0.55, 0.86], [0.75, 0.88]];
  const edge = shade(fruit.color, -0.35);
  return (
    <g>
      {amount > 0 && <path d={`M${x + 6} ${bottom - pureeH} Q${x + w / 2} ${bottom - pureeH - 6} ${x + w - 6} ${bottom - pureeH} L${x + w - 6} ${bottom - 6} Q${x + w / 2} ${bottom} ${x + 6} ${bottom - 6} Z`} fill={fruit.color} opacity={0.55 + 0.3 * m} />}
      {amount > 0 && spots.slice(0, Math.max(2, Math.round(7 * (1 - 0.5 * m)))).map(([fx, fy], i) => {
        const cx = x + fx * w, cy = y + fy * (bottom - y) - (1 - m) * 8;
        if (fruit.id === 'fresa') {
          return (
            <g key={i}>
              <path d={`M${cx} ${cy + size * 0.9} C${cx - size} ${cy + size * 0.2} ${cx - size * 0.8} ${cy - size * 0.7} ${cx} ${cy - size * 0.45} C${cx + size * 0.8} ${cy - size * 0.7} ${cx + size} ${cy + size * 0.2} ${cx} ${cy + size * 0.9} Z`} fill={fruit.color} stroke={edge} strokeWidth="0.7" />
              {[[-0.3, 0], [0.25, 0.1], [0, 0.4], [0.05, -0.2]].map(([dx, dy], k) => <ellipse key={k} cx={cx + dx * size} cy={cy + dy * size} rx={0.9} ry={1.4} fill="#f6d36b" />)}
            </g>
          );
        }
        if (fruit.id === 'banano') {
          return (
            <g key={i}>
              <ellipse cx={cx} cy={cy} rx={size * 0.85} ry={size * 0.6} fill={fruit.color} stroke={shade(fruit.color, -0.3)} strokeWidth="0.7" />
              <circle cx={cx} cy={cy} r={Math.max(0.8, size * 0.12)} fill="#8a6a3a" />
            </g>
          );
        }
        return (
          <g key={i}>
            <path d={`M${cx - size} ${cy + size * 0.4} Q${cx} ${cy - size * 0.9} ${cx + size} ${cy + size * 0.4}`} fill="none" stroke={shade(fruit.color, -0.25)} strokeWidth={Math.max(1.2, size * 0.28)} strokeLinecap="round" />
            <path d={`M${cx - size * 0.6} ${cy + size * 0.5} Q${cx} ${cy - size * 0.35} ${cx + size * 0.6} ${cy + size * 0.5}`} fill="none" stroke="#f7f3e6" strokeWidth={Math.max(1, size * 0.2)} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

/** Bolsa plástica resellable (dibujo local). */
function ZipBag({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children?: ReactNode }) {
  return (
    <g>
      <ContactShadow x={x} y={y + h} w={w} h={8} />
      <path d={`M${x} ${y + 8} L${x} ${y + h - 10} Q${x} ${y + h} ${x + 10} ${y + h} L${x + w - 10} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 10} L${x + w} ${y + 8} Z`} fill="#ffffff" opacity="0.28" />
      {children}
      <path d={`M${x} ${y + 8} L${x} ${y + h - 10} Q${x} ${y + h} ${x + 10} ${y + h} L${x + w - 10} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 10} L${x + w} ${y + 8} Z`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
      <rect x={x - 2} y={y} width={w + 4} height={9} rx={2.5} fill="#5aa0d6" opacity="0.85" />
      <rect x={x - 2} y={y + 3.5} width={w + 4} height={2} fill="#2f6f9f" opacity="0.6" />
      <rect x={x + 10} y={y + 16} width={4} height={h - 36} rx={2} fill="#fff" opacity="0.4" />
    </g>
  );
}

/** Rodillo de cocina para machacar la fruta dentro de la bolsa. */
function RollingPin({ cx, y }: { cx: number; y: number }) {
  return (
    <g>
      <rect x={cx - 52} y={y - 9} width={104} height={18} rx={9} fill="url(#kit-wood)" stroke="#a5824a" strokeWidth="0.8" />
      <rect x={cx - 48} y={y - 6} width={96} height={4} rx={2} fill="#fff" opacity="0.25" />
      <rect x={cx - 78} y={y - 4} width={26} height={8} rx={4} fill="#b88b4a" stroke="#8e6a35" strokeWidth="0.6" />
      <rect x={cx + 52} y={y - 4} width={26} height={8} rx={4} fill="#b88b4a" stroke="#8e6a35" strokeWidth="0.6" />
    </g>
  );
}

/** Embudo con filtro de café; `pulp` (0–1) es el residuo retenido. */
function Funnel({ cx, fruit, pulp }: { cx: number; fruit: Fruit; pulp: number }) {
  const { top, rim, neck } = FUN;
  return (
    <g>
      <path d={`M${cx - rim} ${top} L${cx + rim} ${top} L${cx + 7} ${neck} L${cx + 4} ${TUBE.y + 18} L${cx - 4} ${TUBE.y + 18} L${cx - 7} ${neck} Z`} fill="url(#kit-glass-fill)" />
      <path d={`M${cx - rim + 6} ${top - 4} L${cx + rim - 6} ${top - 4} L${cx} ${neck - 4} Z`} fill="#f4ecd9" stroke="#d8c9a6" strokeWidth="0.8" />
      {[0.3, 0.55, 0.8].map((f) => <line key={f} x1={cx - (rim - 6) * (1 - f)} y1={top - 4 + (neck - top) * f} x2={cx + (rim - 6) * (1 - f)} y2={top - 4 + (neck - top) * f} stroke="#e3d6b8" strokeWidth="0.6" />)}
      {pulp > 0 && <path d={`M${cx - 20 * pulp - 6} ${neck - 22} Q${cx} ${neck - 28 - 6 * pulp} ${cx + 20 * pulp + 6} ${neck - 22} L${cx} ${neck - 5} Z`} fill={fruit.color} opacity={0.8} />}
      <path d={`M${cx - rim} ${top} L${cx + rim} ${top} L${cx + 7} ${neck} L${cx + 4} ${TUBE.y + 18} L${cx - 4} ${TUBE.y + 18} L${cx - 7} ${neck} Z`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
      <path d={`M${cx - rim - 3} ${top} L${cx + rim + 3} ${top}`} stroke="var(--glass-edge, #8fa9b3)" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

/** Botella plástica de alcohol antiséptico con su nivel (0–1). */
function AlcoholBottle({ x, y, w, h, level }: { x: number; y: number; w: number; h: number; level: number }) {
  const neckW = w * 0.4, shoulder = y + 40;
  const body = `M${x + w / 2 - neckW / 2} ${y + 16} L${x + w / 2 - neckW / 2} ${y + 26} Q${x} ${y + 30} ${x} ${shoulder + 10} L${x} ${y + h - 6} Q${x} ${y + h} ${x + 6} ${y + h} L${x + w - 6} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 6} L${x + w} ${shoulder + 10} Q${x + w} ${y + 30} ${x + w / 2 + neckW / 2} ${y + 26} L${x + w / 2 + neckW / 2} ${y + 16} Z`;
  const ly = y + h - 4 - (h - 50) * clamp01(level);
  return (
    <g>
      <ContactShadow x={x} y={y + h} w={w} h={6} />
      <path d={body} fill="#f5fafc" opacity="0.6" />
      <rect x={x + 2} y={ly} width={w - 4} height={y + h - 3 - ly} rx={4} fill={ETHANOL_COLOR} opacity="0.9" />
      <line x1={x + 3} x2={x + w - 3} y1={ly} y2={ly} stroke="#9fb7c2" strokeWidth="1" />
      <path d={body} fill="url(#kit-glass)" stroke="#9fb3bb" strokeWidth="1.3" />
      <rect x={x + w / 2 - neckW / 2 - 2} y={y} width={neckW + 4} height={17} rx={3} fill="#2f6f9f" />
      <rect x={x + w / 2 - neckW / 2 - 2} y={y + 4} width={neckW + 4} height={2} fill="#fff" opacity="0.3" />
      <rect x={x + 5} y={y + 62} width={w - 10} height={62} rx={3} fill="var(--surface)" stroke="var(--line)" />
      <text x={x + w / 2} y={y + 78} textAnchor="middle" style={{ fontSize: 7.5, fill: 'var(--ink)', fontWeight: 700 }}>ALCOHOL</text>
      <text x={x + w / 2} y={y + 89} textAnchor="middle" style={{ fontSize: 7.5, fill: 'var(--ink-2)' }}>antiséptico</text>
      <text x={x + w / 2} y={y + 99} textAnchor="middle" style={{ fontSize: 7.5, fill: 'var(--ink-2)' }}>etílico 70 %</text>
      {/* pictograma de inflamable */}
      <path d={`M${x + w / 2} ${y + 104} L${x + w / 2 + 9} ${y + 120} L${x + w / 2 - 9} ${y + 120} Z`} fill="#f2c94c" stroke="#7a5b00" strokeWidth="0.8" />
      <path d={`M${x + w / 2} ${y + 108} Q${x + w / 2 + 4} ${y + 113} ${x + w / 2 + 1} ${y + 118} Q${x + w / 2 - 4} ${y + 115} ${x + w / 2} ${y + 108} Z`} fill="#c0392b" />
    </g>
  );
}

/** Hebras blancas de ADN precipitado: tamaño según el índice del modelo calculado (`size` 0–1) y el progreso. */
function Precipitate({ cx, y, size, grow, halfW }: { cx: number; y: number; size: number; grow: number; halfW: number }) {
  const g = clamp01(grow);
  if (size <= 0 || g <= 0) return null;
  const n = Math.max(2, Math.round(3 + 9 * size));
  const hgt = (6 + 44 * size) * g;
  return (
    <g>
      <ellipse cx={cx} cy={y - hgt * 0.25} rx={halfW * (0.4 + 0.5 * size)} ry={Math.max(2, hgt * 0.35)} fill="#ffffff" opacity={0.35 * g} />
      {Array.from({ length: n }, (_, i) => {
        const fx = ((i * 37) % 17) / 17 - 0.5;
        const x0 = cx + fx * halfW * 1.4;
        const top = y - hgt * (0.55 + 0.45 * (((i * 53) % 11) / 11));
        const d = `M${x0} ${y} C${x0 + 6} ${y - hgt * 0.3} ${x0 - 5} ${top + hgt * 0.25} ${x0 + 2} ${top}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#8fa3ad" strokeWidth={2.2 + 1.4 * size} strokeLinecap="round" opacity={0.55} />
            <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.2 + 1.4 * size} strokeLinecap="round" />
          </g>
        );
      })}
      {Array.from({ length: n }, (_, i) => <circle key={`b${i}`} cx={cx + ((((i * 29) % 13) / 13) - 0.5) * halfW * 1.3} cy={y - hgt * (((i * 41) % 7) / 7)} r={1} fill="#ffffff" stroke="#c5ced3" strokeWidth="0.3" />)}
    </g>
  );
}

/** Varilla (palito de pincho) con el ovillo de ADN en la punta. */
function SpoolRod({ x, tipY, angle = 0, ball }: { x: number; tipY: number; angle?: number; ball: number }) {
  return (
    <g transform={`rotate(${angle} ${x} ${tipY})`}>
      <line x1={x} y1={tipY} x2={x} y2={tipY - 112} stroke="#c49a5a" strokeWidth="4" strokeLinecap="round" />
      <line x1={x - 1} y1={tipY} x2={x - 1} y2={tipY - 112} stroke="#fff" strokeWidth="1" opacity="0.35" />
      {ball > 0 && (
        <g>
          <ellipse cx={x} cy={tipY - 4} rx={4 + 11 * ball} ry={4 + 15 * ball} fill="#f3f6f8" stroke="#94a6ae" strokeWidth="1" />
          {[0.3, 0.6, 0.85].map((f) => <path key={f} d={`M${x - (3 + 9 * ball) * 0.9} ${tipY - 4 - (13 * ball) * (f - 0.5)} Q${x} ${tipY - 8 - (13 * ball) * (f - 0.5)} ${x + (3 + 9 * ball) * 0.9} ${tipY - 2 - (13 * ball) * (f - 0.5)}`} fill="none" stroke="#b5c3c9" strokeWidth="0.8" />)}
          <path d={`M${x + 2} ${tipY + 8 * ball} q3 ${6 * ball} -1 ${12 * ball}`} fill="none" stroke="#ffffff" strokeWidth="1.2" />
        </g>
      )}
    </g>
  );
}

function ExtractionActivity({ api, top }: { api: LabProps['api']; top: ReactNode }) {
  const [fruitId, setFruitId] = useState<FruitId>('fresa');
  const [salt, setSaltV] = useState(1.5);
  const [detergent, setDetV] = useState(10);
  const [ethanolT, setTempV] = useState(4);
  const [mash, setMashV] = useState(2);
  const [stage, setStage] = useState<Stage>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const fruit = findFruit(fruitId);
  const { run, stop, p } = useTween();

  const model = useMemo(() => simulateExtraction({ fruit: fruitId, salt, detergent, ethanolT, mash }), [fruitId, salt, detergent, ethanolT, mash]);
  const spec = INSTRUMENTS['extraccion-adn']?.find((i) => i.id === 'escala') ?? DNA_EXTRACTION_INSTRUMENTS[0];
  const { measure, remeasure, real } = useMeasure();
  const reading = useMemo(() => measure(model.yieldIndex, { ...spec, nonNegative: true, key: 'rendimiento' }), [measure, spec, model.yieldIndex]);
  const done = stage === 4;

  usePublishModel(() => ({
    vars: {
      k: { sym: 'k_{fruta}', name: `Factor supuesto de la fruta (${fruit.name.toLowerCase()})`, value: model.factors.fruta, decimals: 2 },
      fd: { sym: 'f_{det}', name: 'Factor de lisis por el detergente', value: model.factors.detergente, decimals: 3 },
      fm: { sym: 'f_{mach}', name: 'Factor de machacado', value: model.factors.machacado, decimals: 3 },
      fs: { sym: 'f_{sal}', name: 'Factor de la sal (Na⁺ neutraliza los fosfatos)', value: model.factors.sal, decimals: 3 },
      fa: { sym: 'f_{alc}', name: 'Factor de la temperatura del alcohol', value: model.factors.alcohol, decimals: 3 },
      D: { sym: 'D', name: 'Detergente en 100 mL', value: detergent, unit: 'mL', decimals: 0 },
      S: { sym: 'S', name: 'Sal en 100 mL', value: salt, unit: 'g', decimals: 1 },
      Y: { sym: 'Y', name: 'Índice de rendimiento relativo (modelo calculado)', value: model.yieldIndex, unit: 'u.a.', decimals: 1 },
    },
    equations: [
      { title: 'Lisis por el detergente', lhs: 'fd', expr: '0,05 + 0,95·\\frac{[D]}{[D] + 2}', note: 'Constante de saturación supuesta (2 mL).' },
      { title: 'Efecto de la sal', lhs: 'fs', expr: '0,10 + 0,90·\\frac{[S]}{[S] + 0,5}', note: 'Constante de saturación supuesta (0,5 g).' },
      { title: 'Índice de rendimiento (modelo calculado)', lhs: 'Y', expr: '100·[k]·[fd]·[fm]·[fs]·[fa]', note: 'Índice relativo con constantes didácticas: no es una masa de ADN medida.' },
    ],
    note: 'Modelo semicuantitativo: compara condiciones; sus constantes son supuestos didácticos.',
  }), [model, fruit.name, detergent, salt]);

  /* --------------------------- cambios de condiciones: el montaje retrocede a la etapa que corresponde */
  const recipe = (apply: () => void, what: string) => {
    apply();
    if (stage >= 1) { stop(); setStage(0); setMsg(`Cambiaste ${what}: el montaje empieza de nuevo con una bolsa nueva.`); }
  };
  const chooseFruit = (v: string) => { recipe(() => setFruitId(v as FruitId), 'la fruta'); playSound('thud', { intensity: 0.25 }); };
  const setSalt = (v: number) => recipe(() => setSaltV(v), 'la sal del tampón');
  const setDetergent = (v: number) => recipe(() => setDetV(v), 'el detergente del tampón');
  const lastSwirl = useRef(0);
  const setMash = (v: number) => {
    setMashV(v);
    const now = performance.now();
    if (v > mash && now - lastSwirl.current > 350) { lastSwirl.current = now; playSound('swirl', { intensity: 0.3 }); }
    if (stage >= 2) { stop(); setStage(1); setMsg('Cambiaste el tiempo de machacado: vuelve a filtrar el extracto.'); }
  };
  const setTemp = (v: number) => {
    setTempV(v);
    if (stage >= 3) { stop(); setStage(2); setMsg('Cambiaste la temperatura del alcohol: vierte de nuevo el alcohol sobre un filtrado nuevo.'); }
  };

  /* --------------------------- etapas (los botones del panel y las piezas arrastrables comparten estas funciones) */
  const pourBuffer = () => { if (stage !== 0) return; setMsg(null); setStage(1); run('buffer', 1200); playSound('pour', { intensity: 0.45 }); };
  const filter = () => { if (stage !== 1) return; setMsg(null); setStage(2); run('filter', 1800); playSound('drips', { intensity: 0.5 }); };
  const pourEthanol = () => { if (stage !== 2) return; setMsg(null); setStage(3); run('ethanol', 2600); playSound('pour', { intensity: 0.25 }); };
  const spool = () => { if (stage !== 3) return; setMsg(null); remeasure('rendimiento'); setStage(4); run('spool', 2200); playSound('glassClink', { intensity: 0.3 }); };
  const reset = () => { stop(); setStage(0); setMsg(null); playSound('click'); };

  const record = () => {
    api.addTrial('extraccion', {
      fruta: fruit.name, sal: salt, detergente: detergent, tEtanol: ethanolT, machacado: mash,
      rendimiento: reading, aspecto: appearanceOf(reading),
    });
  };

  /* --------------------------- geometría dependiente del estado */
  const pBuf = stage >= 1 ? ease(p('buffer')) : 0;
  const pFil = stage >= 2 ? ease(p('filter')) : 0;
  const pEth = stage >= 3 ? p('ethanol') : 0;
  const pSpool = stage >= 4 ? p('spool') : 0;
  const bagAmount = 1 - pFil * 0.85;
  const bagLiquid = pBuf * (1 - pFil);
  const filtrate = FILTRATE * pFil;
  const ethanolFill = ETHANOL * clamp01(pEth / 0.45);
  const lyF = TUBE.y + TUBE.h - (TUBE.h - 6) * filtrate;
  const lyE = TUBE.y + TUBE.h - (TUBE.h - 6) * (filtrate + ethanolFill);
  // Tamaño del precipitado según el índice del modelo calculado (√ para que el área crezca con el índice).
  const size = Math.sqrt(clamp01(model.yieldIndex / 100));
  const precipGrow = stage >= 3 ? clamp01((pEth - 0.35) / 0.65) : 0;
  const wound = stage >= 4 ? clamp01((pSpool - 0.35) / 0.4) : 0;
  const rodRest = { x: (ROD.x0 + ROD.x1) / 2, y: ROD.y };
  const rodTip = (() => {
    if (stage < 4) return null;
    const above = { x: TCX, y: TUBE.y - 26 };
    if (pSpool < 0.3) { const t = ease(pSpool / 0.3); return { x: lerp(rodRest.x, above.x, t), y: lerp(rodRest.y - 30, above.y, t), angle: lerp(-80, 0, t) }; }
    if (pSpool < 0.75) { const t = ease((pSpool - 0.3) / 0.45); return { x: TCX + Math.sin(t * 18) * 2.5, y: lerp(above.y, lyF - 2, Math.min(1, t * 2.2)), angle: 0 }; }
    const t = ease((pSpool - 0.75) / 0.25);
    return { x: TCX, y: lerp(lyF - 2, above.y, t), angle: 0 };
  })();

  const liquidMix = shade(fruit.color, 0.45);
  const iceOn = ethanolT <= 8;
  const nearBag = (pt: Pt) => pt.x > BAG.x - 30 && pt.x < BAG.x + BAG.w + 30 && pt.y > BAG.y - 70 && pt.y < BAG.y + BAG.h;
  const overFunnel = (pt: Pt) => Math.abs(pt.x - TCX) < 80 && pt.y > FUN.top - 90 && pt.y < TUBE.y + 40;
  const overTube = (pt: Pt) => Math.abs(pt.x - TCX) < 70 && pt.y > FUN.top - 90 && pt.y < TUBE.y + TUBE.h;

  const desc = `Extracción de ADN de ${fruit.name.toLowerCase()} con un tampón de 100 mL (${fmt(salt, 1)} g de sal y ${fmt(detergent, 0)} mL de detergente), ` +
    `${fmt(mash, 1)} min de machacado y alcohol a ${fmt(ethanolT, 0)} °C. Etapa: ${STAGE_TEXT[stage].toLowerCase()}.` +
    (done ? ` Índice de rendimiento del modelo calculado: ${fmt(reading, 0)} u.a. (${appearanceOf(reading).toLowerCase()}).` : '');
  const show = (t: string) => (done ? t : '—');
  const currentStep = STEP_OF_STAGE[stage];

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox={VIEW1} label="Materiales que se pueden mover" scene={
            <svg viewBox={VIEW1} role="img" aria-labelledby="xad-ext-t xad-ext-d">
              <title id="xad-ext-t">Mesa de extracción casera de ADN: bolsa con fruta, tampón de lisis, embudo con filtro, tubo, alcohol frío y varilla</title>
              <desc id="xad-ext-d">{desc}</desc>
              <BenchTop y={BENCH_Y} width={W1} />
              <Caption x={14} y={20}>Ilustración educativa. El tamaño del precipitado sigue el Modelo calculado (índice relativo, no una medición real).</Caption>

              {/* cronómetro del machacado */}
              <Stopwatch x={64} y={150} text={mmss(mash)} label="machacado" />

              {/* bolsa con la fruta */}
              {!(dragging === 'bolsa') && (
                <ZipBag x={BAG.x} y={BAG.y} w={BAG.w} h={BAG.h}>
                  {bagLiquid > 0 && <rect x={BAG.x + 3} y={BAG.y + BAG.h - 8 - 70 * bagLiquid} width={BAG.w - 6} height={70 * bagLiquid + 5} rx={6} fill={BUFFER_COLOR} opacity={0.55} />}
                  <FruitPieces fruit={fruit} mashed={mash / 2.5} x={BAG.x} y={BAG.y + 20} w={BAG.w} bottom={BAG.y + BAG.h - 2} amount={bagAmount} />
                  {bagLiquid > 0 && detergent > 12 && Array.from({ length: 9 }, (_, i) => <circle key={i} cx={BAG.x + 18 + i * 14} cy={BAG.y + BAG.h - 10 - 70 * bagLiquid - 3} r={3 + (i % 3)} fill="#fff" stroke="#cfe0e6" strokeWidth="0.6" opacity="0.9" />)}
                </ZipBag>
              )}
              <text x={BAG.x + BAG.w / 2} y={BENCH_Y + 26} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>{`${fruit.name} en bolsa resellable`}</text>
              {dragging !== 'rodillo' && stage <= 1 && <RollingPin cx={BAG.x + BAG.w / 2} y={PIN_Y} />}

              {/* tampón de lisis */}
              {dragging !== 'tampon' && (
                <Beaker x={BUF.x} y={BUF.y} w={BUF.w} h={BUF.h} fill={0.7 * (1 - pBuf)} liquid={BUFFER_COLOR} liquidOpacity={0.6} />
              )}
              <text x={BUF.x + BUF.w / 2} y={BENCH_Y + 26} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Tampón de lisis</text>
              <text x={BUF.x + BUF.w / 2} y={BENCH_Y + 38} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>{`${fmt(salt, 1)} g sal · ${fmt(detergent, 0)} mL det.`}</text>

              {/* gradilla, tubo y embudo */}
              <g aria-hidden="true">
                <rect x={TCX - 46} y={TUBE.y + 118} width={92} height={8} rx={2} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.6" />
                <rect x={TCX - 44} y={TUBE.y + 126} width={6} height={BENCH_Y - TUBE.y - 126} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.6" />
                <rect x={TCX + 38} y={TUBE.y + 126} width={6} height={BENCH_Y - TUBE.y - 126} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.6" />
                <rect x={TCX - 50} y={BENCH_Y - 8} width={100} height={8} rx={2} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.6" />
              </g>
              <TestTube x={TUBE.x} y={TUBE.y} w={TUBE.w} h={TUBE.h} fill={filtrate} liquid={liquidMix} liquidOpacity={0.75}>
                {ethanolFill > 0 && <rect x={TUBE.x + 1.5} y={lyE} width={TUBE.w - 3} height={Math.max(0, lyF - lyE)} fill={ETHANOL_COLOR} opacity={0.85} />}
                {ethanolFill > 0 && <line x1={TUBE.x + 2} x2={TUBE.x + TUBE.w - 2} y1={lyE} y2={lyE} stroke="#7f9cab" strokeWidth="1.2" />}
                <Precipitate cx={TCX} y={lyF} size={size * (1 - wound)} grow={precipGrow} halfW={TUBE.w / 2 - 3} />
                {stage === 2 && pFil < 1 && Array.from({ length: 3 }, (_, i) => {
                  const q = (pFil * 3 + i / 3) % 1;
                  return <ellipse key={i} cx={TCX} cy={lerp(TUBE.y + 20, lyF, q)} rx={1.6} ry={2.6} fill={liquidMix} opacity={0.85} />;
                })}
              </TestTube>
              {stage >= 3 && pEth < 0.5 && <path d={`M${TCX + 24} ${TUBE.y - 30} Q${TCX + 22} ${TUBE.y} ${TUBE.x + TUBE.w - 3} ${TUBE.y + 30}`} fill="none" stroke={ETHANOL_COLOR} strokeWidth="2.4" opacity="0.9" />}
              {stage <= 2 && <Funnel cx={TCX} fruit={fruit} pulp={stage >= 2 ? pFil : 0} />}
              <text x={TCX} y={BENCH_Y + 26} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Tubo de ensayo</text>

              {/* alcohol frío en un recipiente con hielo y termómetro */}
              <Beaker x={ICE.x} y={ICE.y} w={ICE.w} h={ICE.h} fill={iceOn ? 0.55 : 0} liquid="#cfe7f3" liquidOpacity={0.45}>
                {iceOn && [0, 1, 2, 3, 4].map((i) => <rect key={i} x={ICE.x + 8 + i * 21} y={ICE.y + 52 + (i % 2) * 8} width={16} height={14} rx={3} fill="#eef8fd" stroke="#b9d6e4" strokeWidth="0.8" opacity="0.95" />)}
              </Beaker>
              {dragging !== 'alcohol' && <AlcoholBottle x={BOT.x} y={BOT.y} w={BOT.w} h={BOT.h} level={stage >= 3 ? 0.75 - 0.3 * clamp01(pEth / 0.45) : 0.75} />}
              <Thermometer x={THERMO.x} y={THERMO.y} h={THERMO.h} min={-20} max={40} value={ethanolT} />
              <text x={ICE.x + ICE.w / 2} y={BENCH_Y + 26} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>{`Alcohol a ${fmt(ethanolT, 0)} °C`}</text>
              <text x={ICE.x + ICE.w / 2} y={BENCH_Y + 38} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>{ethanolT <= -5 ? 'del congelador' : iceOn ? 'en hielo o nevera' : 'sin enfriar'}</text>

              {/* varilla */}
              {stage < 4 && dragging !== 'varilla' && (
                <g>
                  <line x1={ROD.x0} y1={ROD.y + 2} x2={ROD.x1} y2={ROD.y - 6} stroke="#c49a5a" strokeWidth="4" strokeLinecap="round" />
                  <line x1={ROD.x0} y1={ROD.y + 1} x2={ROD.x1} y2={ROD.y - 7} stroke="#fff" strokeWidth="1" opacity="0.35" />
                </g>
              )}
              {rodTip && <SpoolRod x={rodTip.x} tipY={rodTip.y} angle={rodTip.angle} ball={size * wound} />}
              <text x={(ROD.x0 + ROD.x1) / 2} y={BENCH_Y + 26} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Varilla</text>
            </svg>
          }>
            <DragHandle label="Vaso con el tampón de lisis: verter en la bolsa con la fruta" value={stage >= 1 ? 1 : 0} min={0} max={1} step={1} commit="end"
              disabled={stage !== 0} affordance={dragging === null}
              hit={{ x: BUF.x, y: BUF.y, w: BUF.w, h: BUF.h }}
              valueText={(v) => (v ? 'vertido en la bolsa' : 'en la mesa')}
              valueFromPoint={({ point }) => (nearBag(point) ? 1 : 0)}
              onDragChange={(d) => setDragging(d ? 'tampon' : null)} onChange={(v) => { if (v === 1) pourBuffer(); }}>
              {({ dragging: d, point }) => d && point && (
                <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                  <rect x={BAG.x - 8} y={BAG.y - 8} width={BAG.w + 16} height={BAG.h + 16} rx={12} fill="var(--accent)" opacity={nearBag(point) ? 0.16 : 0.05} />
                  <g transform={`rotate(${nearBag(point) ? -40 : 0} ${point.x} ${point.y})`}>
                    <Beaker x={point.x - BUF.w / 2} y={point.y - BUF.h / 2} w={BUF.w} h={BUF.h} fill={0.7} liquid={BUFFER_COLOR} liquidOpacity={0.6} />
                  </g>
                </g>
              )}
            </DragHandle>
            <DragHandle label="Rodillo: machacar la fruta dentro de la bolsa" value={mash} min={EXTRACTION_LIMITS.mash[0]} max={EXTRACTION_LIMITS.mash[1]} step={0.5} pageStep={1} unit="min" decimals={1}
              orientation="horizontal" disabled={stage > 1} affordance={dragging === null}
              hit={{ x: BAG.x - 20, y: PIN_Y - 12, w: BAG.w + 40, h: 24 }}
              valueText={(v) => `${fmt(v, 1)} min de machacado`}
              valueFromPoint={({ point, start, startValue }) => startValue + Math.abs(point.x - start.x) / 60}
              onDragChange={(d) => setDragging(d ? 'rodillo' : null)} onChange={setMash}>
              {({ dragging: d, point }) => d && point && (
                <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                  <RollingPin cx={Math.max(BAG.x + 30, Math.min(BAG.x + BAG.w - 30, point.x))} y={BAG.y + BAG.h * 0.55} />
                </g>
              )}
            </DragHandle>
            <DragHandle label="Bolsa con la fruta machacada: vaciar en el embudo con filtro" value={stage >= 2 ? 1 : 0} min={0} max={1} step={1} commit="end"
              disabled={stage !== 1} affordance={dragging === null}
              hit={{ x: BAG.x, y: BAG.y + 14, w: BAG.w, h: BAG.h - 14 }}
              valueText={(v) => (v ? 'filtrada' : 'sin filtrar')}
              valueFromPoint={({ point }) => (overFunnel(point) ? 1 : 0)}
              onDragChange={(d) => setDragging(d ? 'bolsa' : null)} onChange={(v) => { if (v === 1) filter(); }}>
              {({ dragging: d, point }) => d && point && (
                <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                  <circle cx={TCX} cy={FUN.top + 20} r={70} fill="var(--accent)" opacity={overFunnel(point) ? 0.16 : 0.05} />
                  <g transform={`rotate(${overFunnel(point) ? 35 : 0} ${point.x} ${point.y})`}>
                    <ZipBag x={point.x - BAG.w * 0.35} y={point.y - BAG.h * 0.35} w={BAG.w * 0.7} h={BAG.h * 0.7}>
                      <rect x={point.x - BAG.w * 0.35 + 3} y={point.y + BAG.h * 0.35 - 40} width={BAG.w * 0.7 - 6} height={36} rx={5} fill={fruit.color} opacity={0.65} />
                    </ZipBag>
                  </g>
                </g>
              )}
            </DragHandle>
            <DragHandle label="Botella de alcohol frío: verter despacio por la pared del tubo" value={stage >= 3 ? 1 : 0} min={0} max={1} step={1} commit="end"
              disabled={stage !== 2} affordance={dragging === null}
              hit={{ x: BOT.x, y: BOT.y, w: BOT.w, h: BOT.h }}
              valueText={(v) => (v ? 'alcohol agregado' : 'en el recipiente con hielo')}
              valueFromPoint={({ point }) => (overTube(point) ? 1 : 0)}
              onDragChange={(d) => setDragging(d ? 'alcohol' : null)} onChange={(v) => { if (v === 1) pourEthanol(); }}>
              {({ dragging: d, point }) => d && point && (
                <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                  <rect x={TCX - 70} y={FUN.top - 60} width={140} height={TUBE.h + 130} rx={12} fill="var(--accent)" opacity={overTube(point) ? 0.14 : 0.04} />
                  <g transform={`rotate(${overTube(point) ? -60 : 0} ${point.x} ${point.y})`}>
                    <AlcoholBottle x={point.x - BOT.w / 2} y={point.y - BOT.h / 2} w={BOT.w} h={BOT.h} level={0.75} />
                  </g>
                </g>
              )}
            </DragHandle>
            <DragHandle label="Varilla: enrollar el ADN de la interfase" value={stage >= 4 ? 1 : 0} min={0} max={1} step={1} commit="end"
              disabled={stage !== 3} affordance={dragging === null}
              hit={{ x: ROD.x0, y: ROD.y - 16, w: ROD.x1 - ROD.x0, h: 24 }}
              valueText={(v) => (v ? 'ADN enrollado' : 'en la mesa')}
              valueFromPoint={({ point }) => (overTube(point) ? 1 : 0)}
              onDragChange={(d) => setDragging(d ? 'varilla' : null)} onChange={(v) => { if (v === 1) spool(); }}>
              {({ dragging: d, point }) => d && point && (
                <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                  <rect x={TCX - 70} y={FUN.top - 60} width={140} height={TUBE.h + 130} rx={12} fill="var(--accent)" opacity={overTube(point) ? 0.14 : 0.04} />
                  <SpoolRod x={point.x} tipY={point.y + 40} ball={0} />
                </g>
              )}
            </DragHandle>
          </ManipScene>
        </div>
        <ManipHint>Arrastra el vaso del tampón hasta la bolsa, pasa el rodillo sobre la bolsa para machacar, lleva la bolsa al embudo, vierte el alcohol frío en el tubo y lleva la varilla al tubo para enrollar el ADN. Con el teclado: Tab para elegir la pieza y flechas (o los botones del panel).</ManipHint>
        <Readout items={[
          { k: 'Etapa', v: STAGE_TEXT[stage] },
          { k: 'Índice de rendimiento (modelo calculado)', v: show(`${fmt(reading, 0)} u.a.`), data: true, resolution: done ? resolutionText(spec.resolution, 'u.a.') : undefined },
          { k: 'Aspecto del precipitado', v: show(appearanceOf(reading)) },
          { k: 'Paso más limitante (modelo)', v: show(FACTOR_LABEL[model.limiting]) },
        ]} />
        {msg && <Notice kind="warn">{msg}</Notice>}
        {done && <Warnings list={extractionConditions(model.warnings)} />}
        <Notice>
          <strong>Modelo calculado (semicuantitativo):</strong> Y = 100 · k_fruta · f_det · f_mach · f_sal · f_alc. Cada factor está entre 0 y 1 y sus constantes
          (2 mL de detergente y 0,5 g de sal para la mitad del efecto, transición del alcohol alrededor de 10 °C, fragmentación por machacado excesivo)
          son supuestos didácticos que reproducen tendencias cualitativas. El índice compara condiciones en unidades arbitrarias: no es una masa de ADN medida
          y un ensayo real puede dar resultados distintos.
        </Notice>
        {done && (
          <details className="card">
            <summary>Factores del modelo calculado en este ensayo</summary>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de factores del modelo de extracción">
              <table>
                <thead><tr><th>Factor</th><th className="n">Valor (0 a 1)</th></tr></thead>
                <tbody>
                  {(['fruta', 'detergente', 'machacado', 'sal', 'alcohol'] as FactorKey[]).map((k) => (
                    <tr key={k}><td>{FACTOR_LABEL[k]}</td><td className="n">{fmt(model.factors[k], 2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          {top}
          <Select label="Fruta u hortaliza" value={fruitId} onChange={chooseFruit} options={FRUITS.map((f) => ({ value: f.id, label: f.name }))} />
          <Slider label="Sal en el tampón (100 mL)" value={salt} min={EXTRACTION_LIMITS.salt[0]} max={EXTRACTION_LIMITS.salt[1]} step={0.5} unit="g" decimals={1} onChange={setSalt}
            hint="Una cucharadita rasa de sal de cocina pesa unos 5 g." />
          <Slider label="Detergente lavaloza en el tampón" value={detergent} min={EXTRACTION_LIMITS.detergent[0]} max={EXTRACTION_LIMITS.detergent[1]} step={1} unit="mL" decimals={0} onChange={setDetergent} />
          <Slider label="Tiempo de machacado" value={mash} min={EXTRACTION_LIMITS.mash[0]} max={EXTRACTION_LIMITS.mash[1]} step={0.5} unit="min" decimals={1} onChange={setMash} />
          <Slider label="Temperatura del alcohol" value={ethanolT} min={EXTRACTION_LIMITS.ethanolT[0]} max={EXTRACTION_LIMITS.ethanolT[1]} step={1} unit="°C" decimals={0} onChange={setTemp}
            hint="Nevera ≈ 4 °C; congelador ≈ −18 °C; ambiente en Urabá ≈ 27 a 30 °C." />
          <div className="btn-row">
            <button type="button" className="btn" onClick={pourBuffer} disabled={stage !== 0}>Verter el tampón de lisis</button>
            <button type="button" className="btn" onClick={filter} disabled={stage !== 1}>Filtrar el extracto</button>
          </div>
          <div className="btn-row">
            <button type="button" className="btn" onClick={pourEthanol} disabled={stage !== 2}>Verter el alcohol frío</button>
            <button type="button" className="btn primary" onClick={spool} disabled={stage !== 3}>Enrollar el ADN con la varilla</button>
          </div>
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={reset} disabled={stage === 0}>Nuevo montaje</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
          {!done && <p className="small muted">Completa los pasos y enrolla el ADN para poder guardar el ensayo.</p>}
        </div>
        <div className="card">
          <h3>Pasos y por qué funcionan</h3>
          <ol className="list small">
            {STEPS.map((s, i) => (
              <li key={s.title} aria-current={i === currentStep ? 'step' : undefined} style={i === currentStep ? { fontWeight: 600 } : undefined}>
                <strong>{s.title}.</strong> <span style={{ fontWeight: 400 }}>{s.why}</span>
              </li>
            ))}
          </ol>
        </div>
        <Notice kind="warn">
          <strong>Bioseguridad:</strong> usa solo reactivos caseros (agua, sal de cocina, detergente lavaloza y alcohol antiséptico) y gafas si las hay.
          El alcohol es inflamable: mantenlo lejos de llamas, estufas y fósforos. No ingieras ninguna mezcla ni la fruta usada; no pruebes ni huelas de cerca los reactivos.
          Desecha los residuos como indique el docente y lávate las manos al terminar.
        </Notice>
        <Notice>{real
          ? 'Instrumento real: la lectura incluye una variabilidad ilustrativa (fruta, filtrado y apreciación visual). Repite la extracción con las mismas condiciones para estimar la dispersión.'
          : 'Lectura ideal: el índice del modelo calculado se redondea a 1 u.a. Las animaciones son ilustrativas; solo el tamaño del precipitado depende del cálculo.'}</Notice>
      </div>
    </div>
  );
}

/* ================================================================== ACTIVIDAD 2: complementariedad */

const W2 = 860, H2 = 370;
const VIEW2 = `0 0 ${W2} ${H2}`;
const TOP_Y = 104, BOT_Y = 204;
const BB_TOP = TOP_Y - 18, BB_BOT = BOT_Y + 18;
const PAL_Y = 296;
const PURINE_H = 34, PYRIMIDINE_H = 24;
const isPurine = (b: Base) => b === 'A' || b === 'G';
const BASE_VAR: Record<Base, string> = { A: 'var(--series-1)', T: 'var(--series-2)', G: 'var(--series-3)', C: 'var(--series-4)' };

const PRESETS: { id: string; label: string; seq: string }[] = [
  { id: 'corta', label: 'Corta (10 nt): GATTACAGGA', seq: 'GATTACAGGA' },
  { id: 'at', label: 'Rica en A–T (12 nt): TTAGATATCAAT', seq: 'TTAGATATCAAT' },
  { id: 'gc', label: 'Rica en G–C (12 nt): GCCGTAGCGGCA', seq: 'GCCGTAGCGGCA' },
  { id: 'larga', label: 'Larga (16 nt): ATGGCTAGCTTACGGA', seq: 'ATGGCTAGCTTACGGA' },
  { id: 'propia', label: 'Escribir mi propia hebra', seq: '' },
];

function slotGeom(n: number) {
  const sw = Math.min(40, 760 / n);
  const x0 = (W2 - n * sw) / 2;
  return { sw, x0 };
}

/** Ficha de una base: las purinas (A, G) son más largas que las pirimidinas (T, C). `down`: la ficha cuelga desde y. */
function BaseTile({ b, cx, y, w, down, faded = false }: { b: Base; cx: number; y: number; w: number; down: boolean; faded?: boolean }) {
  const h = isPurine(b) ? PURINE_H : PYRIMIDINE_H;
  const y0 = down ? y : y - h;
  return (
    <g opacity={faded ? 0.55 : 1}>
      <rect x={cx - w / 2} y={y0} width={w} height={h} rx={4} fill="var(--surface)" />
      <rect x={cx - w / 2} y={y0} width={w} height={h} rx={4} fill={BASE_VAR[b]} opacity="0.28" stroke={BASE_VAR[b]} strokeWidth="1.6" />
      <text x={cx} y={y0 + h / 2 + 5} textAnchor="middle" style={{ fontSize: Math.min(15, w * 0.5), fontWeight: 700, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{b}</text>
    </g>
  );
}

/** Esqueleto azúcar-fosfato de una hebra (pentágonos = desoxirribosa, círculos = fosfato). */
function Backbone({ x0, sw, n, y }: { x0: number; sw: number; n: number; y: number }) {
  const r = Math.min(7, sw * 0.2);
  return (
    <g aria-hidden="true">
      <line x1={x0 + sw / 2} x2={x0 + sw * (n - 0.5)} y1={y} y2={y} stroke="var(--ink-2)" strokeWidth="2" />
      {Array.from({ length: n }, (_, i) => {
        const cx = x0 + sw * (i + 0.5);
        const pts = Array.from({ length: 5 }, (_, k) => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5; return `${cx + r * Math.cos(a)},${y + r * Math.sin(a)}`; }).join(' ');
        return (
          <g key={i}>
            <polygon points={pts} fill="var(--surface-2)" stroke="var(--ink-2)" strokeWidth="1" />
            {i < n - 1 && <circle cx={cx + sw / 2} cy={y} r={Math.max(2.4, r * 0.55)} fill="var(--warn)" stroke="var(--ink-2)" strokeWidth="0.6" />}
          </g>
        );
      })}
    </g>
  );
}

/** Ficha de la bandeja que se arrastra con el puntero hasta un espacio de la hebra nueva. */
function PaletteTile({ b, cx, onDrop }: { b: Base; cx: number; onDrop: (b: Base, p: Pt) => void }) {
  const { dragging, point, handlers } = useSvgDrag<SVGGElement>({ onMove: () => {}, onEnd: (d) => onDrop(b, d.point) });
  return (
    <g {...handlers} style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }} aria-hidden="true">
      <rect x={cx - 26} y={PAL_Y - 6} width={52} height={50} rx={8} fill="transparent" />
      <BaseTile b={b} cx={cx} y={PAL_Y} w={34} down faded={dragging} />
      {dragging && point && (
        <g style={{ pointerEvents: 'none' }}>
          <BaseTile b={b} cx={point.x} y={point.y - 14} w={30} down={false} />
        </g>
      )}
    </g>
  );
}

function ComplementActivity({ api, top }: { api: LabProps['api']; top: ReactNode }) {
  const [presetId, setPresetId] = useState('corta');
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [template, setTemplate] = useState<Base[]>(() => normalizeSequence(PRESETS[0].seq));
  const [built, setBuilt] = useState<(Base | null)[]>(() => Array(PRESETS[0].seq.length).fill(null));
  const [orientation, setOrientation] = useState<Orientation>('antiparalela');
  const [cursor, setCursor] = useState(0);
  const [check, setCheck] = useState<DuplexCheck | null>(null);
  const n = template.length;
  const { sw, x0 } = slotGeom(n);

  const counts = useMemo(() => baseCounts(template), [template]);
  const gc = useMemo(() => gcPercent(template), [template]);
  const w = useMemo(() => wallaceTm(template), [template]);

  usePublishModel(() => ({
    vars: {
      N: { sym: 'N', name: 'Nucleótidos de la hebra molde', value: n, decimals: 0 },
      nAT: { sym: 'n_{AT}', name: 'Bases A + T de la molde', value: counts.A + counts.T, decimals: 0 },
      nGC: { sym: 'n_{GC}', name: 'Bases G + C de la molde', value: counts.G + counts.C, decimals: 0 },
      GC: { sym: '\\%GC', name: 'Porcentaje de G + C', value: gc, unit: '%', decimals: 1 },
      Tm: { sym: 'T_{m}', name: 'Temperatura de fusión (regla de Wallace)', value: w.tm, unit: '°C', decimals: 0 },
    },
    equations: [
      { title: 'Porcentaje de G + C', lhs: 'GC', expr: '100·\\frac{[nGC]}{[N]}' },
      { title: 'Regla de Wallace', lhs: 'Tm', expr: '2·[nAT] + 4·[nGC]', note: w.valid ? 'Estimación empírica para oligonucleótidos de menos de 14 nt.' : 'Fuera del rango de validez: la hebra tiene 14 nt o más.' },
    ],
    note: 'Solo se aceptan los pares A–T (2 puentes de hidrógeno) y G–C (3).',
  }), [n, counts, gc, w]);

  const invalidate = () => setCheck(null);
  const loadTemplate = (seq: Base[]) => { setTemplate(seq); setBuilt(Array(seq.length).fill(null)); setCursor(0); invalidate(); };
  const choosePreset = (id: string) => {
    setPresetId(id);
    setCustomError(null);
    const p = PRESETS.find((x) => x.id === id);
    if (p && p.seq) loadTemplate(normalizeSequence(p.seq));
    else if (custom) { try { loadTemplate(normalizeSequence(custom)); } catch (e) { setCustomError((e as Error).message); } }
    playSound('click');
  };
  const applyCustom = (text: string) => {
    setCustom(text);
    try { loadTemplate(normalizeSequence(text)); setCustomError(null); } catch (e) { setCustomError((e as Error).message); }
  };
  const nextEmpty = (from: number, arr: (Base | null)[]) => {
    for (let k = 1; k <= arr.length; k++) { const j = (from + k) % arr.length; if (arr[j] === null) return j; }
    return Math.min(arr.length - 1, from + 1);
  };
  const place = (b: Base, at = cursor) => {
    if (at < 0 || at >= n) return;
    const next = [...built];
    next[at] = b;
    setBuilt(next);
    setCursor(nextEmpty(at, next));
    invalidate();
    playSound('click', { intensity: 0.5 });
  };
  const removeAt = () => { const next = [...built]; next[cursor] = null; setBuilt(next); invalidate(); playSound('click', { intensity: 0.3 }); };
  const clearAll = () => { setBuilt(Array(n).fill(null)); setCursor(0); invalidate(); playSound('thud', { intensity: 0.2 }); };
  const chooseOrientation = (o: Orientation) => { setOrientation(o); invalidate(); playSound('clack', { intensity: 0.3 }); };
  const verify = () => {
    const c = checkDuplex(template, built, orientation);
    setCheck(c);
    playSound(c.valid ? 'beep' : 'error');
  };
  const onDrop = (b: Base, pt: Pt) => {
    if (pt.x < x0 || pt.x > x0 + n * sw || pt.y < TOP_Y + 10 || pt.y > BB_BOT + 30) return;
    const i = Math.floor((pt.x - x0) / sw);
    setCursor(i);
    place(b, i);
  };

  const record = () => {
    if (!check) return;
    const fin = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? Number(v.toFixed(2)) : null);
    api.addTrial('complementariedad', {
      secuencia: template.join(''), orientacion: orientation === 'antiparalela' ? 'antiparalela' : 'paralela', n,
      correctos: check.correct, puentes: check.hBonds, gc: Number(check.gc.toFixed(1)), tm: check.tm,
      rangoWallace: check.tmInRange ? 'sí (< 14 nt)' : 'no (≥ 14 nt)',
      razonAT: fin(check.chargaff?.ratioAT), razonGC: fin(check.chargaff?.ratioGC), razonATmolde: fin(check.chargaff?.singleAT ?? (counts.T ? counts.A / counts.T : undefined)),
    });
  };

  const bottomLabels = orientation === 'antiparalela' ? ["3'", "5'"] : ["5'", "3'"];
  const desc = `Hebra molde 5'-${template.join('')}-3' de ${n} nucleótidos. Hebra nueva (${orientation}): ${built.map((b) => b ?? '·').join('')}, ` +
    `${built.filter((b) => b !== null).length} de ${n} bases colocadas; espacio seleccionado ${cursor + 1}.` +
    (check ? ` Verificación: ${check.correct} pares correctos, ${check.mismatches} errores, ${check.empty} vacíos${check.valid ? `, Tm de Wallace ${fmt(check.tm, 0)} °C` : ', doble hebra no válida'}.` : ' Aún no se ha verificado.');
  const show = (t: string) => (check ? t : '—');
  const singleText = (v: number) => (Number.isFinite(v) ? fmt(v, 2) : 'sin la base del denominador');

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox={VIEW2} label="Bases que se pueden arrastrar a la hebra nueva" scene={
            <svg viewBox={VIEW2} role="img" aria-labelledby="xad-dh-t xad-dh-d">
              <title id="xad-dh-t">Modelo en escalera de una doble hebra de ADN con la hebra molde arriba y la hebra nueva abajo</title>
              <desc id="xad-dh-d">{desc}</desc>
              <Caption x={14} y={20}>Ilustración educativa: escalera plana (la doble hélice real está enrollada). Purinas A y G más largas que pirimidinas T y C.</Caption>
              <text x={14} y={40} style={{ fontSize: 11, fill: 'var(--ink-2)', fontStyle: 'italic' }}>Tm y %GC: Modelo calculado (regla de Wallace) al verificar.</text>

              {/* hebra molde */}
              <Backbone x0={x0} sw={sw} n={n} y={BB_TOP} />
              <text x={x0 - 10} y={BB_TOP + 4} textAnchor="end" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>5'</text>
              <text x={x0 + n * sw + 10} y={BB_TOP + 4} style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>3'</text>
              {template.map((b, i) => <BaseTile key={`t${i}`} b={b} cx={x0 + sw * (i + 0.5)} y={TOP_Y} w={sw - 8} down />)}

              {/* puentes de hidrógeno (solo después de verificar) */}
              {template.map((b, i) => {
                const cx = x0 + sw * (i + 0.5);
                const nb = built[i];
                if (!nb) return <line key={`g${i}`} x1={cx} x2={cx} y1={TOP_Y + PURINE_H + 4} y2={BOT_Y - PURINE_H - 4} stroke="var(--line)" strokeDasharray="2 4" />;
                const y1 = TOP_Y + (isPurine(b) ? PURINE_H : PYRIMIDINE_H) + 3;
                const y2 = BOT_Y - (isPurine(nb) ? PURINE_H : PYRIMIDINE_H) - 3;
                const st = check?.status[i];
                if (st === 'correcto') {
                  const k = b === 'A' || b === 'T' ? 2 : 3;
                  return (
                    <g key={`g${i}`}>
                      {Array.from({ length: k }, (_, j) => { const dx = (j - (k - 1) / 2) * Math.min(7, sw * 0.18); return <line key={j} x1={cx + dx} x2={cx + dx} y1={y1} y2={y2} stroke="var(--ok)" strokeWidth="1.6" strokeDasharray="3 2.5" />; })}
                    </g>
                  );
                }
                if (st === 'error') {
                  const my = (y1 + y2) / 2;
                  return (
                    <g key={`g${i}`}>
                      <line x1={cx - 5} x2={cx + 5} y1={my - 5} y2={my + 5} stroke="var(--bad)" strokeWidth="2" />
                      <line x1={cx - 5} x2={cx + 5} y1={my + 5} y2={my - 5} stroke="var(--bad)" strokeWidth="2" />
                    </g>
                  );
                }
                return <line key={`g${i}`} x1={cx} x2={cx} y1={y1} y2={y2} stroke="var(--line)" strokeDasharray="2 4" />;
              })}

              {/* hebra nueva */}
              <Backbone x0={x0} sw={sw} n={n} y={BB_BOT} />
              <text x={x0 - 10} y={BB_BOT + 4} textAnchor="end" style={{ fontSize: 12, fontWeight: 700, fill: check && !check.antiparallel ? 'var(--bad)' : 'var(--ink)' }}>{bottomLabels[0]}</text>
              <text x={x0 + n * sw + 10} y={BB_BOT + 4} style={{ fontSize: 12, fontWeight: 700, fill: check && !check.antiparallel ? 'var(--bad)' : 'var(--ink)' }}>{bottomLabels[1]}</text>
              {built.map((b, i) => {
                const cx = x0 + sw * (i + 0.5);
                return b
                  ? <BaseTile key={`b${i}`} b={b} cx={cx} y={BOT_Y} w={sw - 8} down={false} />
                  : <rect key={`b${i}`} x={cx - (sw - 8) / 2} y={BOT_Y - PYRIMIDINE_H} width={sw - 8} height={PYRIMIDINE_H} rx={4} fill="none" stroke="var(--line)" strokeDasharray="3 3" />;
              })}
              <rect x={x0 + sw * cursor + 1} y={BOT_Y - PURINE_H - 4} width={sw - 2} height={PURINE_H + 30} rx={6} fill="none" stroke="var(--data)" strokeWidth="1.8" strokeDasharray="5 3" />
              {Array.from({ length: n }, (_, i) => <text key={`n${i}`} x={x0 + sw * (i + 0.5)} y={BB_BOT + 22} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{i + 1}</text>)}

              {/* bandeja */}
              <rect x={W2 / 2 - 150} y={PAL_Y - 14} width={300} height={66} rx={10} fill="var(--surface-2)" stroke="var(--line)" />
              <text x={W2 / 2} y={PAL_Y + 64} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>Bandeja de bases: arrastra una ficha a un espacio de la hebra nueva</text>
            </svg>
          }>
            {Array.from({ length: n }, (_, i) => (
              <rect key={i} x={x0 + sw * i} y={BOT_Y - PURINE_H - 4} width={sw} height={PURINE_H + 30} fill="transparent" style={{ cursor: 'pointer' }} aria-hidden="true"
                onClick={() => { setCursor(i); playSound('tick', { intensity: 0.3 }); }} />
            ))}
            {BASES.map((b, k) => <PaletteTile key={b} b={b} cx={W2 / 2 - 105 + k * 70} onDrop={onDrop} />)}
          </ManipScene>
        </div>
        <ManipHint>Arrastra una base de la bandeja hasta un espacio de la hebra nueva, o toca un espacio para seleccionarlo y usa los botones «Colocar A», «Colocar T», «Colocar G» y «Colocar C» del panel. Luego pulsa «Verificar la doble hebra».</ManipHint>
        <Readout items={[
          { k: 'Pares correctos', v: show(check ? `${check.correct} de ${check.n}` : '') , data: true },
          { k: 'Errores y espacios vacíos', v: show(check ? `${check.mismatches} ${check.mismatches === 1 ? 'error' : 'errores'}, ${check.empty} ${check.empty === 1 ? 'vacío' : 'vacíos'}` : '') },
          { k: 'Orientación', v: show(check ? (check.antiparallel ? 'Antiparalela (correcta)' : 'Paralela: no forma la doble hélice') : '') },
          { k: 'Puentes de hidrógeno', v: show(check ? `${check.hBonds}` : ''), data: true },
          { k: "Hebra nueva leída 5'→3'", v: show(check ? check.newStrand53 : '') },
          { k: '%GC', v: show(`${fmt(gc, 1)} %`), data: true },
          { k: 'Tm (regla de Wallace)', v: show(check && check.tm !== null ? `${fmt(check.tm, 0)} °C` : 'No calculada: doble hebra no válida'), data: true, state: check && check.tm !== null ? (check.tmInRange ? 'ok' : 'bad') : undefined },
          { k: 'A/T y G/C en la doble hebra', v: show(check?.chargaff ? `${fmt(check.chargaff.ratioAT, 2)} y ${fmt(check.chargaff.ratioGC, 2)}` : 'Completa la doble hebra sin errores') },
          { k: 'A/T y G/C en la molde sola', v: show(`${singleText(counts.T ? counts.A / counts.T : counts.A ? Infinity : 1)} y ${singleText(counts.C ? counts.G / counts.C : counts.G ? Infinity : 1)}`) },
        ]} />
        {check && check.valid && !check.tmInRange && <Notice kind="warn">{`La hebra tiene ${n} nucleótidos: la regla de Wallace solo es una estimación razonable para menos de ${WALLACE_MAX_VALID + 1} nucleótidos. Para hebras más largas la Tm se calcula con modelos más completos; toma este valor solo como orientación.`}</Notice>}
        {check && !check.antiparallel && <Notice kind="warn">Las dos hebras del ADN son antiparalelas: frente al extremo 5' de la molde debe quedar el extremo 3' de la hebra nueva. Cambia la orientación y verifica de nuevo.</Notice>}
        {check && check.valid && <Notice kind="ok">Doble hebra válida: cada A frente a una T (2 puentes de hidrógeno) y cada G frente a una C (3). En la doble hebra A = T y G = C, como encontró Chargaff.</Notice>}
        {check && check.mismatches > 0 && <Notice kind="bad">{`Hay ${check.mismatches} ${check.mismatches === 1 ? 'par que no es complementario' : 'pares que no son complementarios'} (marcados con ×). Recuerda: A con T y G con C.`}</Notice>}
      </div>

      <div className="controls">
        <div className="card stack">
          {top}
          <Select label="Hebra molde (5'→3')" value={presetId} onChange={choosePreset} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
          {presetId === 'propia' && (
            <div className="field">
              <label htmlFor="xad-custom">{`Tu hebra molde (A, T, G y C; de ${MIN_STRAND} a ${MAX_STRAND} letras)`}</label>
              <input id="xad-custom" type="text" value={custom} spellCheck={false} autoComplete="off" style={{ fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }}
                aria-invalid={customError ? true : undefined} aria-describedby={customError ? 'xad-custom-e' : undefined}
                onChange={(e) => applyCustom(e.target.value)} />
              {customError && <span id="xad-custom-e" className="small" role="alert" style={{ color: 'var(--bad)' }}>{customError}</span>}
            </div>
          )}
          <Segmented<Orientation> label="Orientación de la hebra nueva" value={orientation} onChange={chooseOrientation}
            options={[{ value: 'antiparalela', label: "3'→5' (antiparalela)" }, { value: 'paralela', label: "5'→3' (paralela)" }]} />
          <Select label="Espacio seleccionado de la hebra nueva" value={String(cursor)} onChange={(v) => setCursor(Number(v))}
            options={template.map((b, i) => ({ value: String(i), label: `Espacio ${i + 1} (frente a ${b}, ${BASE_NAME[b]})${built[i] ? `: tiene ${built[i]}` : ''}` }))} />
          <div className="btn-row" role="group" aria-label="Bases para colocar en el espacio seleccionado">
            {BASES.map((b) => <button key={b} type="button" className="btn" onClick={() => place(b)}>{`Colocar ${b}`}</button>)}
          </div>
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={removeAt} disabled={built[cursor] === null}>Quitar la base del espacio</button>
            <button type="button" className="btn ghost" onClick={clearAll} disabled={built.every((b) => b === null)}>Vaciar la hebra nueva</button>
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={verify}>Verificar la doble hebra</button>
          </div>
          <RecordButton onRecord={record} disabled={!check} />
          {!check && <p className="small muted">Verifica la doble hebra para poder guardar el ensayo.</p>}
        </div>
        <Notice>Reglas del modelo: A–T con 2 puentes de hidrógeno y G–C con 3; hebras antiparalelas. %GC = 100·(G + C)/N. Regla de Wallace: Tm ≈ 2·(A + T) + 4·(G + C) °C con las bases de una hebra, válida solo para oligonucleótidos de menos de 14 nucleótidos; no considera la sal, la concentración de ADN ni el orden de las bases.</Notice>
      </div>
    </div>
  );
}

/* ================================================================== laboratorio */

type Activity = 'extraccion' | 'complementariedad';

export default function DnaExtractionLab({ api }: LabProps) {
  const [activity, setActivity] = useState<Activity>('extraccion');
  const top = (
    <>
      <h3>Montaje</h3>
      <Segmented<Activity> label="Actividad del laboratorio" value={activity} onChange={(v) => { setActivity(v); playSound('switch'); }}
        options={[{ value: 'extraccion', label: 'Extracción de ADN' }, { value: 'complementariedad', label: 'Doble hebra y complementariedad' }]} />
    </>
  );
  return activity === 'extraccion' ? <ExtractionActivity api={api} top={top} /> : <ComplementActivity api={api} top={top} />;
}

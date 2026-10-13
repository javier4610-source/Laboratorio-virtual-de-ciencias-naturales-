import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUOYANCY_INSTRUMENTS, BUOYANCY_LIMITS, DYNAMOMETER_MAX, HYDROMETER, OBJECTS, SPOON_G, VESSEL_AREA_CM2, analyzeReadings, findObject,
  hydrometerStemDepth, liquidVolume, objectHeight, simulateBuoyancy, type BuoyLiquidId, type BuoyObject, type SetupId,
} from '../models/buoyancy';
import { findLiquid } from '../models/pressure';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { useMeasure } from '../components/Measurement';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, Beaker, ContactShadow, DigitalBalance, shade } from './kit';
import { DragHandle, ManipHint, ManipScene } from './manipulate';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 860, H = 460;
const VIEW = `0 0 ${W} ${H}`;
const BENCH_Y = 430;
/** px por cm del montaje principal. */
const SC = 9;
/** Centro del recipiente y del dinamómetro. */
const CX = 300;
/** Cara superior del plato de la balanza / plataforma del gato: fondo de los recipientes. */
const VB = BENCH_Y - 76;
/** Superficie del agua con 1 L en el recipiente (y en el pico del vaso de rebose). */
const SURF0 = VB - 2 - (1000 / VESSEL_AREA_CM2) * SC;
const VESSEL_W = 96;
/** Dinamómetro: largo del cuerpo, px por newton y longitud del hilo. */
const DYN_L = 128, PER_N = 21, STRING = 14;
/** Estante de objetos (3 × 3). */
const SHELF = { x0: 8, cell: 46, rows: [338, 384, 430] };
const TRAY_SC = 5;
/** Soporte universal. */
const ROD_X = 186;
/** Colector del vaso de rebose y su balanza. */
const CUP = { x: 452, w: 62, h: 58 };
const CUP_AREA = Math.PI * ((CUP.w - 4) / 2 / SC) ** 2; // cm²
/** Frasco de sal y cuchara. */
const JAR = { x: 596, w: 62, top: 360 };
const SPOON_REST = { x: JAR.x + JAR.w / 2 + 6, y: JAR.top - 10 };
/** Probeta con el densímetro. */
const HYD = { x: 736, w: 64, top: 136, surf: 168, sc: 8 };

const LIQUID_LABEL: Record<BuoyLiquidId, string> = { dulce: 'Agua dulce', salada: 'Agua salada', aceite: 'Aceite de cocina', alcohol: 'Alcohol etílico' };
const SETUP_LABEL: Record<SetupId, string> = { rebose: 'Vaso de rebose', balanza: 'Vaso sobre la balanza' };
const SETTLE_MS = 1400;
const SALT_MS = 900;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function liquidLook(liquid: BuoyLiquidId, spoons: number) {
  const base = findLiquid(liquid === 'salada' ? 'salada' : liquid);
  const water = liquid === 'dulce' || liquid === 'salada';
  // El agua con mucha sal se ve un poco más turbia.
  return { color: base.color, opacity: water ? base.opacity + Math.min(0.12, spoons * 0.004) : base.opacity };
}

/* ------------------------------------------------------------------ piezas locales */

/** Dibujo de cada objeto con la base en `bottom` (y) y centrado en cx; `sc` px por cm. */
function ObjectArt({ o, cx, bottom, sc, marks = false }: { o: BuoyObject; cx: number; bottom: number; sc: number; marks?: boolean }) {
  const hp = objectHeight(o) * sc;
  const top = bottom - hp;
  const edge = shade(o.color, -0.45);
  switch (o.shape) {
    case 'cilindro': {
      const w = 2 * o.dims.r * sc, ry = Math.max(1.5, w * 0.16);
      const body = `M${cx - w / 2} ${top} L${cx - w / 2} ${bottom} A${w / 2} ${ry} 0 0 0 ${cx + w / 2} ${bottom} L${cx + w / 2} ${top} Z`;
      const metal = o.id === 'aluminio' || o.id === 'hierro';
      return (
        <g>
          <path d={body} fill={o.color} stroke={edge} strokeWidth="0.8" opacity={o.id === 'plastico' ? 0.88 : 1} />
          {metal && <path d={body} fill="url(#kit-metal-h)" opacity="0.4" />}
          {!metal && <rect x={cx - w / 2 + w * 0.14} y={top + 2} width={w * 0.12} height={hp - 4} rx={w * 0.06} fill="#fff" opacity={o.id === 'cera' ? 0.35 : 0.45} />}
          <ellipse cx={cx} cy={top} rx={w / 2} ry={ry} fill={shade(o.color, 0.25)} stroke={edge} strokeWidth="0.8" />
          <circle cx={cx} cy={top - 1.5} r={Math.max(1.2, sc * 0.18)} fill="none" stroke="#5d6b70" strokeWidth="1" />
        </g>
      );
    }
    case 'prisma': {
      const w = o.dims.a * sc, d = Math.max(2, o.dims.b * sc * 0.22);
      const x0 = cx - w / 2 - d / 2;
      const wood = o.id === 'madera';
      return (
        <g>
          <path d={`M${x0} ${top} L${x0 + d} ${top - d} L${x0 + w + d} ${top - d} L${x0 + w} ${top} Z`} fill={shade(o.color, 0.2)} stroke={edge} strokeWidth="0.8" />
          <path d={`M${x0 + w} ${top} L${x0 + w + d} ${top - d} L${x0 + w + d} ${bottom - d} L${x0 + w} ${bottom} Z`} fill={shade(o.color, -0.18)} stroke={edge} strokeWidth="0.8" />
          <rect x={x0} y={top} width={w} height={hp} fill={o.color} stroke={edge} strokeWidth="0.8" />
          {wood && [0.22, 0.48, 0.74].map((f) => <path key={f} d={`M${x0} ${top + hp * f} Q${x0 + w / 2} ${top + hp * f - 3} ${x0 + w} ${top + hp * f + 2}`} fill="none" stroke={shade(o.color, -0.28)} strokeWidth="0.7" opacity="0.7" />)}
          {!wood && Array.from({ length: 14 }, (_, i) => <circle key={i} cx={x0 + ((i * 37) % 97) / 97 * w} cy={top + ((i * 53) % 89) / 89 * hp} r={0.7} fill="#c9d1d6" />)}
          {wood && marks && Array.from({ length: Math.round(o.dims.h) - 1 }, (_, i) => i + 1).map((cm) => (
            <g key={cm}>
              <line x1={x0} x2={x0 + w * (cm % 2 ? 0.2 : 0.32)} y1={bottom - cm * sc} y2={bottom - cm * sc} stroke="#3a2a10" strokeWidth="0.9" />
              {cm % 2 === 0 && <text x={x0 + w * 0.36} y={bottom - cm * sc + 3} style={{ fontSize: 7, fill: '#3a2a10', fontFamily: 'var(--font-data)' }}>{cm}</text>}
            </g>
          ))}
          <circle cx={cx - d / 2 + d / 2} cy={top - d / 2 - 1} r={Math.max(1.2, sc * 0.18)} fill="none" stroke="#5d6b70" strokeWidth="1" />
        </g>
      );
    }
    case 'esfera': {
      const r = o.dims.r * sc;
      return (
        <g>
          <circle cx={cx} cy={bottom - r} r={r} fill={o.color} stroke={edge} strokeWidth="0.8" />
          <circle cx={cx} cy={bottom - r} r={r} fill="url(#flo-sphere)" />
          <path d={`M${cx - r * 0.5} ${bottom - r * 1.2} q${r * 0.3} ${r * 0.25} ${r * 0.7} ${r * 0.1}`} fill="none" stroke={shade(o.color, -0.3)} strokeWidth="0.7" opacity="0.6" />
        </g>
      );
    }
    case 'elipsoide': {
      const rx = o.dims.a * sc, ry = hp / 2, cy = bottom - ry;
      return (
        <g>
          <path d={`M${cx} ${top} C${cx + rx * 1.05} ${top} ${cx + rx * 1.12} ${bottom - ry * 0.2} ${cx} ${bottom} C${cx - rx * 1.12} ${bottom - ry * 0.2} ${cx - rx * 1.05} ${top} ${cx} ${top} Z`} fill={o.color} stroke={edge} strokeWidth="0.8" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#flo-sphere)" />
          {/* malla de hilo */}
          {[-0.55, 0, 0.55].map((f) => <path key={f} d={`M${cx} ${top - 2} Q${cx + f * rx * 2.1} ${cy} ${cx} ${bottom}`} fill="none" stroke="#7b6a52" strokeWidth="0.6" opacity="0.8" />)}
          {[0.3, 0.62].map((f) => <ellipse key={f} cx={cx} cy={top + hp * f} rx={rx * Math.sqrt(1 - (2 * f - 1) ** 2) * 1.02} ry={1.6} fill="none" stroke="#7b6a52" strokeWidth="0.6" opacity="0.8" />)}
        </g>
      );
    }
    case 'barco': {
      const w = o.dims.a * sc, bw = w * 0.82;
      return (
        <g>
          <path d={`M${cx - w / 2} ${top} L${cx + w / 2} ${top} L${cx + bw / 2} ${bottom - 2} Q${cx + bw / 2 - 2} ${bottom} ${cx + bw / 2 - 5} ${bottom} L${cx - bw / 2 + 5} ${bottom} Q${cx - bw / 2 + 2} ${bottom} ${cx - bw / 2} ${bottom - 2} Z`} fill={o.color} stroke={edge} strokeWidth="0.8" />
          <ellipse cx={cx} cy={top} rx={w / 2} ry={Math.max(1.4, sc * 0.3)} fill={shade(o.color, -0.35)} stroke={edge} strokeWidth="0.8" />
          <path d={`M${cx - w / 2 + 3} ${top + hp * 0.45} L${cx + w / 2 - 3} ${top + hp * 0.45}`} stroke={shade(o.color, 0.3)} strokeWidth="0.8" opacity="0.6" />
        </g>
      );
    }
  }
}

/** Dinamómetro de resorte (0 a 5 N) colgado por el anillo; el indicador rojo baja con la fuerza. */
function SpringScale({ x, top, force }: { x: number; top: number; force: number }) {
  const y0 = top + 14;
  const shown = Math.max(0, Math.min(DYNAMOMETER_MAX + 0.2, force));
  const ind = y0 + shown * PER_N;
  const bottom = top + DYN_L;
  const spring = (() => {
    const a = top + 6, b = ind - 2, turns = 14;
    let d = `M${x} ${a}`;
    for (let i = 1; i <= turns; i++) d += ` L${x + (i % 2 ? -4 : 4)} ${a + ((b - a) * i) / turns}`;
    return d;
  })();
  return (
    <g>
      <circle cx={x} cy={top - 7} r={6} fill="none" stroke="url(#kit-metal-h)" strokeWidth="2.6" />
      <circle cx={x} cy={top - 7} r={6} fill="none" stroke="#7d8a8f" strokeWidth="0.6" />
      <g filter="url(#kit-shadow-soft)">
        <rect x={x - 13} y={top} width={26} height={DYN_L} rx={5} fill="url(#flo-tube)" stroke="#9aa5a9" />
      </g>
      {Array.from({ length: 51 }, (_, i) => i / 10).map((n) => {
        const ty = y0 + n * PER_N, major = Math.abs(n - Math.round(n)) < 1e-9, half = !major && Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;
        return (
          <g key={n}>
            <line x1={x + 13} x2={x + 13 - (major ? 8 : half ? 6 : 3.5)} y1={ty} y2={ty} stroke="#2b3436" strokeWidth={major ? 0.9 : 0.5} />
            {major && <text x={x - 11} y={ty + 2.8} style={{ fontSize: 7.5, fill: '#2b3436', fontFamily: 'var(--font-data)' }}>{Math.round(n)}</text>}
          </g>
        );
      })}
      <path d={spring} fill="none" stroke="#7d8a8f" strokeWidth="1.1" strokeLinejoin="round" />
      <line x1={x} x2={x} y1={ind} y2={bottom + 8} stroke="url(#kit-metal-h)" strokeWidth="3" />
      <rect x={x - 11} y={ind - 1.5} width={22} height={3} rx={1} fill="#d32f2f" />
      <rect x={x - 13} y={top} width={26} height={DYN_L} rx={5} fill="url(#kit-glass)" opacity="0.7" />
      <rect x={x - 14} y={top - 3} width={28} height={6} rx={2} fill="url(#kit-metal)" stroke="#8c979b" strokeWidth="0.6" />
      <rect x={x - 14} y={bottom - 3} width={28} height={6} rx={2} fill="url(#kit-metal)" stroke="#8c979b" strokeWidth="0.6" />
      <text x={x + 19} y={top + 12} style={{ fontSize: 8, fill: 'var(--ink-2)', fontWeight: 700 }}>N</text>
      {/* gancho */}
      <path d={`M${x} ${bottom + 6} L${x} ${bottom + 12} Q${x + 6} ${bottom + 15} ${x + 3} ${bottom + 19} Q${x} ${bottom + 21} ${x - 3} ${bottom + 17.5}`} fill="none" stroke="#5d6b70" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/** Gato de laboratorio (plataforma de tijera) bajo el vaso de rebose. */
function LabJack({ x, w, top, bottom }: { x: number; w: number; top: number; bottom: number }) {
  const h = bottom - top;
  return (
    <g>
      <ContactShadow x={x} y={bottom} w={w} h={7} />
      <rect x={x} y={bottom - 6} width={w} height={6} rx={1.5} fill="url(#kit-metal)" stroke="#8c979b" />
      <path d={`M${x + 10} ${bottom - 6} L${x + w - 10} ${top + 6} M${x + w - 10} ${bottom - 6} L${x + 10} ${top + 6}`} stroke="#7d8a8f" strokeWidth="3" />
      <circle cx={x + w / 2} cy={top + h / 2} r={3} fill="url(#kit-metal)" stroke="#6d7b80" />
      <line x1={x + w / 2} x2={x + w + 12} y1={top + h / 2} y2={top + h / 2} stroke="#5d6b70" strokeWidth="2" />
      <circle cx={x + w + 14} cy={top + h / 2} r={4} fill="url(#kit-body-dark)" />
      <rect x={x} y={top} width={w} height={6} rx={1.5} fill="url(#kit-metal)" stroke="#8c979b" />
    </g>
  );
}

/** Densímetro de vidrio flotando: el tope del bulbo queda `stemDepth` cm bajo la superficie. */
function Hydrometer({ cx, surf, stemDepth, sc }: { cx: number; surf: number; stemDepth: number; sc: number }) {
  const bulbTop = surf + stemDepth * sc;
  const stemTop = bulbTop - HYDROMETER.stemLength * sc - 4;
  const marks = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2];
  return (
    <g>
      <rect x={cx - 3.5} y={stemTop} width={7} height={bulbTop - stemTop + 2} rx={3} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="0.9" />
      <rect x={cx - 2.5} y={stemTop + 3} width={5} height={bulbTop - stemTop - 4} fill="#fbf6e4" opacity="0.9" />
      {marks.map((r) => {
        const y = bulbTop - hydrometerStemDepth(r) * sc;
        const major = Math.abs(r * 10 - Math.round(r * 10)) < 1e-9;
        return (
          <g key={r}>
            <line x1={cx - 2.5} x2={cx + (major ? 2.5 : 0.5)} y1={y} y2={y} stroke="#3a2a10" strokeWidth={major ? 0.8 : 0.5} />
            {major && <text x={cx + 6} y={y + 2.5} style={{ fontSize: 6.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(r, 1)}</text>}
          </g>
        );
      })}
      <path d={`M${cx - 3.5} ${bulbTop} C${cx - 14} ${bulbTop + 6} ${cx - 14} ${bulbTop + 50} ${cx - 6} ${bulbTop + 58} L${cx - 6} ${bulbTop + 70} Q${cx} ${bulbTop + 78} ${cx + 6} ${bulbTop + 70} L${cx + 6} ${bulbTop + 58} C${cx + 14} ${bulbTop + 50} ${cx + 14} ${bulbTop + 6} ${cx + 3.5} ${bulbTop} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1" />
      {/* lastre de perdigones */}
      {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={cx - 3.5 + (i % 3) * 3.5} cy={bulbTop + 62 + Math.floor(i / 3) * 3} r={1.6} fill="#59606b" />)}
      <rect x={cx - 9} y={bulbTop + 10} width={2} height={34} rx={1} fill="#fff" opacity="0.5" />
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function BuoyancyLab({ api }: LabProps) {
  const [objectId, setObjectId] = useState('aluminio');
  const [liquid, setLiquid] = useState<BuoyLiquidId>('dulce');
  const [spoons, setSpoons] = useState(0);
  const [descent, setDescent] = useState(0);
  const [setup, setSetup] = useState<SetupId>('rebose');
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const isWater = liquid === 'dulce' || liquid === 'salada';
  const obj = findObject(objectId);
  const look = liquidLook(liquid, spoons);

  /* --------------------------- modelo e instrumentos */
  const model = useMemo(() => simulateBuoyancy({ objectId, liquid, spoons: isWater ? spoons : 0, descent, setup }), [objectId, liquid, spoons, isWater, descent, setup]);
  const volume = useMemo(() => liquidVolume(liquid, isWater ? spoons : 0), [liquid, spoons, isWater]);
  const stemDepth = useMemo(() => hydrometerStemDepth(model.rhoLiq / 1000), [model.rhoLiq]);

  // Instrumentos: ficha de la práctica si está integrada; si no, la del modelo (modo real con la misma incertidumbre).
  const dynSpec = INSTRUMENTS.flotacion?.find((i) => i.id === 'dinamometro') ?? BUOYANCY_INSTRUMENTS[0];
  const balSpec = INSTRUMENTS.flotacion?.find((i) => i.id === 'balanza') ?? BUOYANCY_INSTRUMENTS[1];
  const hydSpec = INSTRUMENTS.flotacion?.find((i) => i.id === 'densimetro') ?? BUOYANCY_INSTRUMENTS[2];
  const { measure, remeasure, real } = useMeasure();
  const readings = useMemo(() => {
    const weight = measure(model.weight, { ...dynSpec, nonNegative: true, key: 'pesoAire' });
    const apparent = measure(model.apparent, { ...dynSpec, nonNegative: true, key: 'aparente' });
    const balance = measure(model.balanceMass, { ...balSpec, key: 'balanza' });
    const rho = measure(model.rhoLiq / 1000, { ...hydSpec, key: 'densimetro' });
    const a = analyzeReadings(weight, apparent, balance);
    return { weight, apparent, balance, rho, buoyancy: a.buoyancy, displacedWeight: a.displacedWeight, vDisplaced: rho > 0 ? balance / rho : 0 };
  }, [measure, dynSpec, balSpec, hydSpec, model]);

  useEffect(() => { setDone(false); }, [objectId, liquid, spoons, descent, setup]);

  /* --------------------------- animaciones: indicador del dinamómetro y sal que cae */
  const [shownF, setShownF] = useState(model.apparent);
  const shownRef = useRef(model.apparent);
  const settleRaf = useRef(0);
  useEffect(() => {
    const target = model.apparent;
    cancelAnimationFrame(settleRaf.current);
    const x0 = shownRef.current;
    if (prefersReducedMotion() || Math.abs(x0 - target) < 0.005) { shownRef.current = target; setShownF(target); return; }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(SETTLE_MS, Math.max(0, now - start)) / 1000;
      const x = target + (x0 - target) * Math.exp(-t / 0.22) * Math.cos((2 * Math.PI * t) / 0.42);
      shownRef.current = x;
      setShownF(x);
      if (t * 1000 >= SETTLE_MS) { shownRef.current = target; setShownF(target); return; }
      settleRaf.current = requestAnimationFrame(step);
    };
    settleRaf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(settleRaf.current);
  }, [model.apparent]);

  const [saltT, setSaltT] = useState(1);
  const saltRaf = useRef(0);
  const startSalt = () => {
    cancelAnimationFrame(saltRaf.current);
    if (prefersReducedMotion()) { setSaltT(1); return; }
    const start = performance.now();
    const step = (now: number) => {
      const q = clamp01(Math.max(0, now - start) / SALT_MS);
      setSaltT(q);
      if (q < 1) saltRaf.current = requestAnimationFrame(step);
    };
    setSaltT(0);
    saltRaf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => { cancelAnimationFrame(saltRaf.current); cancelAnimationFrame(settleRaf.current); }, []);

  // Sonido al entrar en el líquido (la base cruza la superficie).
  const prevDepth = useRef(model.depth);
  useEffect(() => {
    if (prevDepth.current <= 0 && model.depth > 0) playSound('splash', { intensity: 0.25 + Math.min(0.5, model.vSub / 120) });
    prevDepth.current = model.depth;
  }, [model.depth, model.vSub]);

  /* --------------------------- acciones (panel y manipulación directa comparten estas funciones) */
  const hang = (id: string) => {
    if (id === objectId) return;
    setObjectId(id);
    setDescent(0);
    playSound('glassClink', { intensity: 0.35 });
  };
  const setSalt = (n: number) => {
    const v = Math.max(BUOYANCY_LIMITS.spoons[0], Math.min(BUOYANCY_LIMITS.spoons[1], Math.round(n)));
    if (v > spoons) { playSound('drop', { intensity: 0.35 }); startSalt(); }
    setSpoons(v);
    setLiquid(v > 0 ? 'salada' : 'dulce');
  };
  const chooseLiquid = (v: string) => {
    const l = v as BuoyLiquidId;
    setLiquid(l);
    if (l === 'salada') { if (spoons === 0) setSpoons(3); } else setSpoons(0);
    playSound('pour', { intensity: 0.3 });
  };
  const reshape = (toBoat: boolean) => {
    setObjectId(toBoat ? 'barco' : 'bola');
    setDescent(0);
    playSound('thud', { intensity: 0.2 });
  };
  const readNow = () => {
    remeasure('pesoAire', 'aparente', 'balanza', 'densimetro');
    setDone(true);
    playSound('beep');
  };

  const record = () => {
    api.addTrial('empuje', {
      montaje: SETUP_LABEL[setup], objeto: obj.name, liquido: LIQUID_LABEL[liquid], sal: isWater ? spoons * SPOON_G : 0, descenso: descent,
      densimetro: readings.rho, peso: readings.weight, aparente: readings.apparent, empuje: Number(readings.buoyancy.toFixed(2)),
      masaBalanza: readings.balance, pesoDesalojado: Number(readings.displacedWeight.toFixed(3)), vDesalojado: Number(readings.vDisplaced.toFixed(1)),
      fraccion: Math.round(model.fraction * 100), flota: model.floating ? 'sí (flota)' : model.floats ? 'flotaría' : 'no (se hunde)',
    });
  };

  /* --------------------------- geometría dependiente del estado */
  const hpx = objectHeight(obj) * SC;
  const surfInit = setup === 'rebose' ? SURF0 : VB - 2 - (volume / VESSEL_AREA_CM2) * SC;
  const surfNow = surfInit - model.levelRise * SC;
  const tautBottom = surfInit + descent * SC;
  const objBottom = surfNow + model.depth * SC;
  const objTop = objBottom - hpx;
  const artTop = obj.shape === 'prisma' ? objTop - Math.max(2, obj.dims.b * SC * 0.22) : obj.shape === 'cilindro' ? objTop - 4 : objTop - 2;
  // Si el objeto flota y se sigue bajando el dinamómetro, el hilo se afloja y el gancho baja hasta tocar el objeto (no lo atraviesa).
  const hookY = Math.min(tautBottom - hpx - STRING, artTop - 4);
  const sag = Math.max(0, STRING - (objTop - hookY));
  const dynTop = hookY - DYN_L - 19;
  const armY = dynTop - 16;

  const vessel = setup === 'rebose'
    ? { x: CX - VESSEL_W / 2, y: SURF0 - 20, h: VB - (SURF0 - 20) }
    : { x: CX - VESSEL_W / 2, y: VB - 152, h: 152 };
  const fillOf = (top: number, h: number, ly: number) => (top + h - 6 - ly) / (h - 16);
  const cupLevel = setup === 'rebose' ? (model.vSub / CUP_AREA) * SC : 0;
  const hydStemDepth = stemDepth;

  // Cuerda: tensa (recta) o floja (con comba) si el objeto flota.
  const attach = obj.shape === 'prisma' ? objTop - Math.max(2, obj.dims.b * SC * 0.22) / 2 - 2 : objTop - 2;
  const stringPath = obj.shape === 'barco'
    ? `M${CX} ${hookY} L${CX - (obj.dims.a * SC) / 2 + 2} ${objTop} M${CX} ${hookY} L${CX + (obj.dims.a * SC) / 2 - 2} ${objTop}`
    : sag > 0.5
      ? `M${CX} ${hookY} C${CX + 6 + sag * 0.8} ${hookY + 2} ${CX + 6 + sag * 0.8} ${attach - 2} ${CX} ${attach}`
      : `M${CX} ${hookY} L${CX} ${attach}`;

  const shelfPos = (i: number) => ({ x: SHELF.x0 + SHELF.cell * (i % 3) + SHELF.cell / 2, y: SHELF.rows[Math.floor(i / 3)] });
  const nearHook = (p: { x: number; y: number }) => Math.abs(p.x - CX) < 70 && p.y < VB && p.y > 10;
  const overVessel = (p: { x: number; y: number }) => Math.abs(p.x - CX) < 64 && p.y > vessel.y - 60 && p.y < VB;

  /* --------------------------- textos */
  const objState = model.floating
    ? `flota con el ${fmt(model.fraction * 100, 1)} % de su volumen sumergido y el hilo está flojo`
    : model.depth <= 0 ? 'está colgado en el aire, sobre el líquido'
      : model.submerged ? 'está colgado y totalmente sumergido' : `está colgado con ${fmt(model.depth, 1)} cm sumergidos`;
  const desc = `${SETUP_LABEL[setup]} con 1 L de ${LIQUID_LABEL[liquid].toLowerCase()}${isWater && spoons > 0 ? ` y ${spoons * SPOON_G} g de sal` : ''}. ` +
    `${obj.name} colgado de un dinamómetro de 5 N, bajado ${fmt(descent, 1)} cm: ${objState}.` +
    (done ? ` El dinamómetro marca ${fmt(readings.apparent, 2)} N; la balanza, ${fmt(readings.balance, 1)} g; el densímetro, ${fmt(readings.rho, 3)} g/cm³.` : ' Aún no se han leído los instrumentos.');
  const show = (t: string) => (done ? t : '—');
  const floatText = model.floating ? `Sí: ${fmt(model.fraction * 100, 1)} % sumergido` : model.floats ? 'Flotaría si se soltara' : 'Se hundiría si se soltara';

  const clay = objectId === 'bola' || objectId === 'barco';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox={VIEW} label="Piezas que se pueden mover" scene={
            <svg viewBox={VIEW} role="img" aria-labelledby="flo-t flo-d">
              <title id="flo-t">Dinamómetro con un objeto sumergido en un líquido, balanza, sal y densímetro</title>
              <desc id="flo-d">{desc}</desc>
              <defs>
                <radialGradient id="flo-sphere" cx="0.35" cy="0.3" r="0.75">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
                  <stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
                  <stop offset="1" stopColor="#000" stopOpacity="0.25" />
                </radialGradient>
                <linearGradient id="flo-tube" x1="0" x2="1">
                  <stop offset="0" stopColor="#f3f6f7" />
                  <stop offset="0.5" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#dfe5e7" />
                </linearGradient>
              </defs>
              <BenchTop y={BENCH_Y} width={W} />

              {/* estante con los objetos */}
              <g aria-hidden="true">
                <rect x={SHELF.x0 - 4} y={SHELF.rows[0] - 48} width={SHELF.cell * 3 + 8} height={BENCH_Y - SHELF.rows[0] + 48} rx={3} fill="var(--surface-2)" stroke="var(--line)" opacity="0.7" />
                {SHELF.rows.map((y) => <rect key={y} x={SHELF.x0 - 4} y={y} width={SHELF.cell * 3 + 8} height={4} fill="url(#kit-wood)" stroke="#b8975a" strokeWidth="0.6" />)}
                <text x={SHELF.x0 + SHELF.cell * 1.5} y={SHELF.rows[0] - 56} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>Objetos</text>
                {OBJECTS.map((o, i) => {
                  const p = shelfPos(i);
                  if (o.id === objectId || (clay && (o.id === 'bola' || o.id === 'barco'))) {
                    return <rect key={o.id} x={p.x - 18} y={p.y - 30} width={36} height={28} rx={4} fill="none" stroke="var(--line)" strokeDasharray="3 3" />;
                  }
                  return dragging === o.id ? null : <ObjectArt key={o.id} o={o} cx={p.x} bottom={p.y} sc={TRAY_SC} />;
                })}
              </g>

              {/* soporte universal */}
              <g aria-hidden="true">
                <ContactShadow x={ROD_X - 30} y={BENCH_Y} w={42} h={7} />
                <rect x={ROD_X - 30} y={BENCH_Y - 8} width={42} height={8} rx={2} fill="url(#kit-body-dark)" />
                <rect x={ROD_X - 3} y={2} width={6} height={BENCH_Y - 8} rx={2} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.5" />
                <rect x={ROD_X - 9} y={armY - 7} width={18} height={14} rx={3} fill="url(#kit-body-dark)" />
                <circle cx={ROD_X - 13} cy={armY} r={3.5} fill="url(#kit-metal)" stroke="#6d7b80" />
                <rect x={ROD_X + 8} y={armY - 2.5} width={CX - ROD_X - 4} height={5} rx={2} fill="url(#kit-metal-h)" stroke="#8c979b" strokeWidth="0.5" />
                <path d={`M${CX + 4} ${armY} Q${CX + 6} ${armY + 6} ${CX} ${armY + 8} L${CX} ${dynTop - 13}`} fill="none" stroke="#5d6b70" strokeWidth="2" />
              </g>

              {/* recipientes */}
              {setup === 'rebose' ? (
                <g>
                  <LabJack x={CX - 58} w={116} top={VB} bottom={BENCH_Y} />
                  {/* balanza con el vaso colector */}
                  <DigitalBalance x={CUP.x - 60} y={VB} w={190} reading={done ? fmt(readings.balance, 1) : '--,-'}>
                    <Beaker x={CUP.x} y={VB - CUP.h} w={CUP.w} h={CUP.h} fill={cupLevel / (CUP.h - 16)} liquid={look.color} liquidOpacity={look.opacity + 0.1} />
                  </DigitalBalance>
                  <text x={CUP.x + CUP.w / 2 + 4} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Balanza tarada con el colector</text>
                </g>
              ) : (
                <g>
                  <DigitalBalance x={CX - 95} y={VB} w={190} reading={done ? fmt(readings.balance, 1) : '--,-'} />
                  <text x={CX} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Balanza tarada con el vaso</text>
                </g>
              )}
              <Beaker x={vessel.x} y={vessel.y} w={VESSEL_W} h={vessel.h} fill={fillOf(vessel.y, vessel.h, surfNow)} liquid={look.color} liquidOpacity={look.opacity}>
                <ObjectArt o={obj} cx={CX} bottom={objBottom} sc={SC} marks />
                {/* parte del objeto vista a través del líquido */}
                <rect x={vessel.x + 2} y={surfNow} width={VESSEL_W - 4} height={Math.max(0, VB - 4 - surfNow)} fill={look.color} opacity={0.22} />
                {saltT < 1 && Array.from({ length: 14 }, (_, i) => {
                  const fx = ((i * 37) % 13) / 13, delay = (i % 5) * 0.08;
                  const q = clamp01((saltT - delay) / (1 - delay));
                  return <rect key={i} x={vessel.x + 14 + fx * (VESSEL_W - 28)} y={surfNow + q * (VB - 10 - surfNow)} width={2.4} height={2.4} fill="#fff" stroke="#b9c3c6" strokeWidth="0.4" opacity={q > 0 ? 1 - q * 0.9 : 0} />;
                })}
              </Beaker>
              {setup === 'rebose' && (
                <g aria-hidden="true">
                  <path d={`M${CX + VESSEL_W / 2 - 1} ${SURF0 - 3} L${CX + VESSEL_W / 2 + 70} ${SURF0 + 8} L${CUP.x + 16} ${VB - CUP.h - 6}`} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
                  <path d={`M${CX + VESSEL_W / 2 - 1} ${SURF0 - 3} L${CX + VESSEL_W / 2 + 70} ${SURF0 + 8} L${CUP.x + 16} ${VB - CUP.h - 6}`} fill="none" stroke="url(#kit-glass-fill)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
                  {model.vSub > 0 && <ellipse cx={CUP.x + 16} cy={VB - CUP.h + 2} rx={2} ry={3} fill={look.color} opacity="0.8" />}
                  <text x={CX - 8} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Vaso de rebose</text>
                </g>
              )}

              {/* dinamómetro, hilo y objeto */}
              <SpringScale x={CX} top={dynTop} force={shownF} />
              <path d={stringPath} fill="none" stroke="#6b5a40" strokeWidth="1" />
              {/* el objeto se vuelve a dibujar por encima del borde del recipiente si sobresale */}
              {objTop < vessel.y && (
                <svg x={0} y={0} width={W} height={vessel.y} viewBox={`0 0 ${W} ${vessel.y}`} overflow="hidden">
                  <ObjectArt o={obj} cx={CX} bottom={objBottom} sc={SC} marks />
                </svg>
              )}
              {model.floating && obj.id === 'madera' && (
                <g aria-hidden="true">
                  <line x1={CX + 26} x2={CX + 50} y1={surfNow} y2={surfNow} stroke="var(--data)" strokeWidth="1.2" strokeDasharray="3 2" />
                  <text x={CX + 52} y={surfNow + 18} style={{ fontSize: 9, fill: 'var(--data)', fontWeight: 700 }}>línea de</text>
                  <text x={CX + 52} y={surfNow + 28} style={{ fontSize: 9, fill: 'var(--data)', fontWeight: 700 }}>flotación</text>
                </g>
              )}

              {/* frasco de sal */}
              <g>
                <ContactShadow x={JAR.x} y={BENCH_Y} w={JAR.w} h={7} />
                <path d={`M${JAR.x} ${JAR.top + 8} Q${JAR.x} ${JAR.top} ${JAR.x + 8} ${JAR.top} L${JAR.x + JAR.w - 8} ${JAR.top} Q${JAR.x + JAR.w} ${JAR.top} ${JAR.x + JAR.w} ${JAR.top + 8} L${JAR.x + JAR.w} ${BENCH_Y - 4} Q${JAR.x + JAR.w} ${BENCH_Y} ${JAR.x + JAR.w - 4} ${BENCH_Y} L${JAR.x + 4} ${BENCH_Y} Q${JAR.x} ${BENCH_Y} ${JAR.x} ${BENCH_Y - 4} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
                <rect x={JAR.x + 3} y={JAR.top + 22} width={JAR.w - 6} height={BENCH_Y - JAR.top - 25} rx={3} fill="#f5f6f4" />
                {Array.from({ length: 18 }, (_, i) => <rect key={i} x={JAR.x + 6 + ((i * 29) % 50)} y={JAR.top + 24 + ((i * 17) % 40)} width={1.6} height={1.6} fill="#c3ccd0" />)}
                <rect x={JAR.x + 8} y={JAR.top + 34} width={JAR.w - 16} height={18} rx={2} fill="var(--surface)" stroke="var(--line)" />
                <text x={JAR.x + JAR.w / 2} y={JAR.top + 46} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink)', fontWeight: 700 }}>SAL</text>
                <text x={JAR.x + JAR.w / 2} y={JAR.top - 40} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{isWater ? `${spoons} cda. de 10 g` : 'solo para agua'}</text>
              </g>

              {/* probeta con el densímetro */}
              <g>
                <Beaker x={HYD.x} y={HYD.top} w={HYD.w} h={BENCH_Y - HYD.top} fill={fillOf(HYD.top, BENCH_Y - HYD.top, HYD.surf)} liquid={look.color} liquidOpacity={look.opacity}>
                  <Hydrometer cx={HYD.x + HYD.w / 2} surf={HYD.surf} stemDepth={hydStemDepth} sc={HYD.sc} />
                  <rect x={HYD.x + 2} y={HYD.surf} width={HYD.w - 4} height={BENCH_Y - 4 - HYD.surf} fill={look.color} opacity={0.18} />
                </Beaker>
                <text x={HYD.x + HYD.w / 2} y={BENCH_Y + 24} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Densímetro</text>
              </g>
            </svg>
          }>
            <DragHandle label="Dinamómetro: bajar el objeto dentro del líquido" value={descent} min={BUOYANCY_LIMITS.descent[0]} max={BUOYANCY_LIMITS.descent[1]} step={0.5} pageStep={2} unit="cm" decimals={1}
              orientation="vertical" affordance={dragging === null}
              hit={{ x: CX - 18, y: dynTop, w: 36, h: DYN_L }}
              valueFromPoint={({ point, start, startValue }) => startValue + (point.y - start.y) / SC}
              valueText={(v) => `${fmt(v, 1)} cm bajo la superficie`} onChange={setDescent} />
            {OBJECTS.map((o, i) => {
              if (o.id === objectId || (clay && (o.id === 'bola' || o.id === 'barco'))) return null;
              const p = shelfPos(i), h = objectHeight(o) * TRAY_SC;
              return (
                <DragHandle key={o.id} label={`${o.name}: colgar del gancho del dinamómetro`} value={0} min={0} max={1} step={1} commit="end"
                  affordance={dragging === null}
                  hit={{ x: p.x - 20, y: p.y - Math.max(h, 18) - 4, w: 40, h: Math.max(h, 18) + 6 }}
                  valueText={(v) => (v ? 'colgado del gancho' : 'en el estante')}
                  valueFromPoint={({ point }) => (nearHook(point) ? 1 : 0)}
                  onDragChange={(d) => setDragging(d ? o.id : null)} onChange={(v) => { if (v === 1) hang(o.id); }}>
                  {({ dragging: d, point }) => d && point && (
                    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                      <circle cx={CX} cy={hookY} r={22} fill="var(--accent)" opacity={nearHook(point) ? 0.2 : 0.06} />
                      <ObjectArt o={o} cx={point.x} bottom={point.y + (objectHeight(o) * SC) / 2} sc={SC * 0.8} />
                    </g>
                  )}
                </DragHandle>
              );
            })}
            {clay && (
              <DragHandle label="Plastilina: moldear como bola o como barco" value={objectId === 'barco' ? 1 : 0} min={0} max={1} step={1} commit="end"
                hit={{ x: CX - 38, y: objTop - 4, w: 76, h: hpx + 8 }}
                valueText={(v) => (v ? 'en forma de barco' : 'en bola')}
                valueFromPoint={({ point, start, startValue }) => (Math.abs(point.x - start.x) > 14 ? 1 - startValue : startValue)}
                onChange={(v) => reshape(v === 1)} />
            )}
            <DragHandle label="Cucharada de sal de 10 g: echar al agua" value={spoons} min={BUOYANCY_LIMITS.spoons[0]} max={BUOYANCY_LIMITS.spoons[1]} step={1} pageStep={5} commit="end"
              disabled={!isWater} affordance={dragging === null}
              hit={{ x: SPOON_REST.x - 30, y: SPOON_REST.y - 14, w: 60, h: 26 }}
              valueText={(v) => `${v} cucharadas (${v * SPOON_G} g de sal)`}
              valueFromPoint={({ point, startValue }) => (overVessel(point) ? startValue + 1 : startValue)}
              onDragChange={(d) => setDragging(d ? 'sal' : null)} onChange={setSalt}>
              {({ dragging: d, point }) => {
                const p = d && point ? point : SPOON_REST;
                return (
                  <g aria-hidden="true" style={{ pointerEvents: 'none' }} opacity={isWater ? 1 : 0.45}>
                    {d && point && <rect x={CX - 64} y={vessel.y - 40} width={128} height={VB - vessel.y + 36} rx={10} fill="var(--accent)" opacity={overVessel(point) ? 0.12 : 0.04} />}
                    <line x1={p.x + 8} y1={p.y} x2={p.x + 40} y2={p.y - 14} stroke="url(#kit-metal-h)" strokeWidth="4" strokeLinecap="round" />
                    <ellipse cx={p.x} cy={p.y + 1} rx={11} ry={5.5} fill="url(#kit-metal)" stroke="#7d8a8f" strokeWidth="0.8" />
                    <ellipse cx={p.x} cy={p.y - 0.5} rx={8} ry={3} fill="#fafafa" />
                  </g>
                );
              }}
            </DragHandle>
          </ManipScene>
        </div>
        <ManipHint>Arrastra el dinamómetro hacia abajo para meter el objeto en el líquido, lleva otro objeto del estante al gancho, echa cucharadas de sal al vaso y arrastra la plastilina hacia un lado para moldearla. Con el teclado: Tab para elegir la pieza y flechas (↑ o → baja el dinamómetro y echa sal).</ManipHint>
        <Readout items={[
          { k: 'Peso en el aire P', v: show(`${fmt(readings.weight, 2)} N`), data: true },
          { k: 'Peso aparente (dinamómetro)', v: show(`${fmt(readings.apparent, 2)} N`), data: true },
          { k: 'Empuje E = P − P_ap', v: show(`${fmt(readings.buoyancy, 2)} N`) },
          { k: setup === 'rebose' ? 'Líquido en el colector (balanza)' : 'Aumento en la balanza', v: show(`${fmt(readings.balance, 1)} g`), data: true },
          { k: 'Peso del líquido desalojado m·g', v: show(`${fmt(readings.displacedWeight, 3)} N`) },
          { k: 'Densímetro', v: show(`${fmt(readings.rho, 3)} g/cm³`), data: true },
          { k: '¿Flota?', v: show(floatText) },
        ]} />
        {objectId === 'icopor' && <Notice kind="warn">El icopor pesa unos 3 g (≈ 0,03 N): menos que la mitad de una división del dinamómetro. Para él, la medida útil es la de la balanza.</Notice>}
        {done && model.floating && <Notice>El hilo quedó flojo: el objeto flota, el empuje es igual a su peso y el dinamómetro marca 0. La balanza mide la masa de líquido que desaloja (igual a la masa del objeto).</Notice>}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Segmented<SetupId> label="Recipiente" value={setup} onChange={setSetup}
            options={[{ value: 'rebose', label: 'Vaso de rebose' }, { value: 'balanza', label: 'Vaso sobre la balanza' }]} />
          <Select label="Objeto colgado del gancho" value={objectId} onChange={hang} options={OBJECTS.map((o) => ({ value: o.id, label: o.name }))} />
          {clay && (
            <Segmented<'bola' | 'barco'> label="Forma de la plastilina" value={objectId === 'barco' ? 'barco' : 'bola'} onChange={(v) => reshape(v === 'barco')}
              options={[{ value: 'bola', label: 'Bola' }, { value: 'barco', label: 'Barco' }]} />
          )}
          <Slider label="Descenso del objeto" value={descent} min={BUOYANCY_LIMITS.descent[0]} max={BUOYANCY_LIMITS.descent[1]} step={0.5} unit="cm" decimals={1} onChange={setDescent}
            hint="Distancia de la base del objeto bajo la superficie inicial del líquido." />
          <Select label="Líquido del recipiente" value={liquid} onChange={chooseLiquid}
            options={(['dulce', 'salada', 'aceite', 'alcohol'] as BuoyLiquidId[]).map((l) => ({ value: l, label: LIQUID_LABEL[l] }))} />
          {isWater && (
            <Slider label="Cucharadas de sal (10 g)" value={spoons} min={BUOYANCY_LIMITS.spoons[0]} max={BUOYANCY_LIMITS.spoons[1]} step={1} decimals={0} onChange={setSalt}
              hint={`${spoons * SPOON_G} g de sal disueltos en 1 L de agua.`} />
          )}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={readNow}>Leer los instrumentos</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
          {!done && <p className="small muted">Lee los instrumentos para poder guardar el ensayo.</p>}
        </div>
        <details className="card">
          <summary>Objetos: masa y volumen</summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de masas y volúmenes de los objetos">
            <table>
              <thead><tr><th>Objeto</th><th className="n">Masa (g)</th><th className="n">Volumen (cm³)</th></tr></thead>
              <tbody>
                {OBJECTS.map((o) => <tr key={o.id}><td>{o.name}</td><td className="n">{fmt(o.mass, 1)}</td><td className="n">{o.shape === 'barco' ? `${fmt(o.mass / o.rho, 1)} de plastilina` : fmt(o.mass / o.rho, 1)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </details>
        <Notice>{real
          ? 'Instrumento real: cada lectura incluye un error aleatorio típico (paralaje del dinamómetro, gotas en el colector, menisco del densímetro). Pulsa «Leer los instrumentos» varias veces sin mover nada para estimar la dispersión.'
          : 'Simulación educativa: las lecturas se redondean a la resolución de cada instrumento (dinamómetro 0,05 N, balanza 0,1 g, densímetro 0,002 g/cm³). Antes de cada inmersión el vaso de rebose se llena hasta el pico y la balanza se tara.'}</Notice>
      </div>
    </div>
  );
}

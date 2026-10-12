import { useEffect, useMemo, useRef, useState } from 'react';
import { AMMETER_RES_MA, CLASS_LABELS, SAMPLES, testSample, type ConductorClass, type Sample } from '../models/conductors';
import { fmt, fmtSig } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import type { LabProps } from './registry';
import { useMeasure } from '../components/Measurement';
import { instrument } from './instruments';
import { BenchTop, Beaker, Lcd, shade } from './kit';

/* ------------------------------------------------------------------ geometría del banco */

const BOARD_TOP = 226; // cara superior del tablero de pruebas
const BULB_X = 215, BULB_Y = 218;
const METER = { x: 268, y: 52, w: 96, h: 172 };
const JACK_COM: [number, number] = [METER.x + 26, METER.y + METER.h - 16];
const JACK_MA: [number, number] = [METER.x + METER.w - 26, METER.y + METER.h - 16];
const MEASURE_MS = 900;

type Phase = 'abierto' | 'midiendo' | 'medido';

function ConductorDefs() {
  return (
    <defs>
      <radialGradient id="con-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff3b0" stopOpacity="0.95" />
        <stop offset="0.45" stopColor="#ffd54a" stopOpacity="0.45" />
        <stop offset="1" stopColor="#ffd54a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="con-cell" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#151b1d" />
        <stop offset="0.35" stopColor="#4a5458" />
        <stop offset="0.6" stopColor="#262e31" />
        <stop offset="1" stopColor="#0e1314" />
      </linearGradient>
      <linearGradient id="con-copper" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#8a4b12" />
        <stop offset="0.35" stopColor="#f0a85a" />
        <stop offset="0.65" stopColor="#c46f22" />
        <stop offset="1" stopColor="#6f3a0c" />
      </linearGradient>
      <linearGradient id="con-bar-sheen" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.25" />
      </linearGradient>
      <linearGradient id="con-holster" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#d99a00" />
        <stop offset="0.25" stopColor="#ffc928" />
        <stop offset="0.8" stopColor="#f2b300" />
        <stop offset="1" stopColor="#c78a00" />
      </linearGradient>
    </defs>
  );
}

/** Cable aislado: trazo grueso con un brillo fino encima. */
function Wire({ d, color }: { d: string; color: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke={shade(color, -0.35)} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round" transform="translate(0 -1)" />
    </g>
  );
}

/** Caimán: la punta de las mandíbulas queda en (x, y); dir = 1 apunta a la derecha. El cable sale en x − 40·dir. */
function Clip({ x, y, dir, color }: { x: number; y: number; dir: 1 | -1; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${dir} 1)`} filter="url(#kit-shadow-soft)">
      {/* funda aislante */}
      <path d="M-40 -5 Q-42 0 -40 5 L-20 7 Q-17 0 -20 -7 Z" fill={color} stroke={shade(color, -0.4)} strokeWidth="0.8" />
      <path d="M-38 -3.2 L-22 -4.8" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
      {/* mandíbulas metálicas con dientes */}
      <path d="M-20 -6 L-2 -2.2 L0 -0.6 L-20 -1.2 Z" fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.6" />
      <path d="M-20 6 L-2 2.2 L0 0.6 L-20 1.2 Z" fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.6" />
      {[-16, -12, -8, -4].map((tx) => (
        <g key={tx}>
          <path d={`M${tx} -1.6 l1.6 1.2 l1.6 -1.2`} fill="none" stroke="#5d6b70" strokeWidth="0.6" />
          <path d={`M${tx} 1.6 l1.6 -1.2 l1.6 1.2`} fill="none" stroke="#5d6b70" strokeWidth="0.6" />
        </g>
      ))}
      <circle cx={-19} cy={0} r={1.6} fill="#3a4448" />
    </g>
  );
}

/** Portapilas con una o dos pilas AA acostadas (polo positivo a la derecha). */
function BatteryPack({ x, cells }: { x: number; cells: number }) {
  const cellLen = 58, h = 22, top = BOARD_TOP - h - 4;
  const w = 12 + cells * cellLen;
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={top - 2} width={w} height={h + 6} rx={4} fill="url(#kit-body-dark)" />
      </g>
      {Array.from({ length: cells }, (_, i) => {
        const cx = x + 6 + i * cellLen;
        return (
          <g key={i}>
            <rect x={cx} y={top + 1} width={cellLen - 6} height={h - 2} rx={3} fill="url(#con-cell)" />
            <rect x={cx + cellLen - 22} y={top + 1} width={16} height={h - 2} rx={3} fill="url(#con-copper)" />
            <rect x={cx + cellLen - 6} y={top + h / 2 - 4} width={4} height={8} rx={1} fill="url(#kit-metal-h)" />
            <text x={cx + 18} y={top + h / 2 + 4} textAnchor="middle" style={{ fontSize: 10, fill: '#e8eeee', fontWeight: 700 }}>1,5 V</text>
          </g>
        );
      })}
      {/* bornes de tornillo */}
      {[[x + 6, '−'], [x + w - 6, '+']].map(([px, sign]) => (
        <g key={sign as string}>
          <rect x={(px as number) - 4} y={top - 9} width={8} height={8} rx={1.5} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.6" />
          <text x={px as number} y={top - 13} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>{sign as string}</text>
        </g>
      ))}
    </g>
  );
}

/** Color del filamento: de apagado a blanco amarillento según el brillo (0 a 1). */
function filamentColor(b: number) {
  if (b <= 0.01) return '#6d5a4a';
  const mix = (a: number, c: number) => Math.round(a + (c - a) * b);
  return `rgb(255, ${mix(120, 248)}, ${mix(40, 200)})`;
}

/** Bombillo de linterna en su portabombillo; el portabombillo se apoya en el tablero. */
function Bulb({ x, y, glow }: { x: number; y: number; glow: number }) {
  const b = Math.max(0, Math.min(1, glow));
  const glass = `M${x - 6} ${y - 15} C${x - 6} ${y - 19} ${x - 13} ${y - 22} ${x - 13} ${y - 30} A13 13 0 1 1 ${x + 13} ${y - 30} C${x + 13} ${y - 22} ${x + 6} ${y - 19} ${x + 6} ${y - 15} Z`;
  return (
    <g>
      {b > 0 && <circle cx={x} cy={y - 31} r={18 + 44 * Math.sqrt(b)} fill="url(#con-halo)" opacity={0.3 + 0.7 * Math.sqrt(b)} />}
      <rect x={x - 18} y={y - 6} width={36} height={13} rx={3} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
      {[-12, 12].map((dx) => <circle key={dx} cx={x + dx} cy={y + 0.5} r={2.8} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />)}
      <rect x={x - 6.5} y={y - 16} width={13} height={10} rx={1.5} fill="url(#kit-metal-h)" stroke="#7d8a8f" strokeWidth="0.5" />
      {[-13, -10, -7.5].map((dy) => <line key={dy} x1={x - 6.5} x2={x + 6.5} y1={y + dy} y2={y + dy + 1} stroke="#7d8a8f" strokeWidth="0.7" />)}
      <path d={glass} fill={b > 0 ? `rgba(255, 236, 160, ${0.3 + 0.6 * b})` : 'url(#kit-glass-fill)'} />
      <path d={`M${x - 2} ${y - 16} L${x - 4} ${y - 29} M${x + 2} ${y - 16} L${x + 4} ${y - 29}`} stroke="#8d9a9f" strokeWidth="0.8" />
      <path d={`M${x - 4} ${y - 29} l1.6 -2.4 l1.6 2.4 l1.6 -2.4 l1.6 2.4 l1.6 -2.4`} fill="none" stroke={filamentColor(b)} strokeWidth={b > 0 ? 1.6 : 1} strokeLinejoin="round" />
      <path d={glass} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      <path d={`M${x - 8} ${y - 34} A9 9 0 0 1 ${x - 2} ${y - 40}`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </g>
  );
}

/** Amperímetro digital con funda de caucho, pantalla, selector y bornes COM y mA. */
function Ammeter({ text }: { text: string }) {
  const { x, y, w, h } = METER;
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={w} height={h} rx={12} fill="url(#con-holster)" stroke="#a87400" />
      </g>
      <rect x={x + 7} y={y + 7} width={w - 14} height={h - 14} rx={7} fill="url(#kit-body-dark)" />
      <Lcd x={x + 12} y={y + 14} w={w - 24} h={30} text={text} unit="mA" />
      <text x={x + w / 2} y={y + 58} textAnchor="middle" style={{ fontSize: 9, fill: '#e8eeee', fontWeight: 700, letterSpacing: 1 }}>AMPERÍMETRO</text>
      {/* selector giratorio en la posición de 2 A ⎓ */}
      <circle cx={x + w / 2} cy={y + 98} r={22} fill="#1d2427" stroke="#55605f" />
      <circle cx={x + w / 2} cy={y + 98} r={15} fill="url(#kit-metal)" stroke="#6d7b80" />
      <rect x={x + w / 2 - 2} y={y + 80} width={4} height={14} rx={2} fill="#263033" />
      {[['OFF', -150], ['V', -90], ['2 A', -30], ['200 mA', 30]].map(([lab, ang]) => {
        const a = ((ang as number) - 90) * (Math.PI / 180) + Math.PI / 2;
        const tx = x + w / 2 + 31 * Math.sin(a), ty = y + 98 - 31 * Math.cos(a) + 3;
        return <text key={lab as string} x={tx} y={ty} textAnchor="middle" style={{ fontSize: 7, fill: lab === '2 A' ? '#ffd54a' : '#b8c2c6', fontWeight: 700 }}>{lab as string}</text>;
      })}
      {/* bornes */}
      {[[JACK_COM, '#20292c', 'COM'], [JACK_MA, '#c62828', 'mA']].map(([[jx, jy], c, lab]) => (
        <g key={lab as string}>
          <circle cx={jx as number} cy={jy as number} r={6.5} fill={c as string} stroke="#0d1416" />
          <circle cx={jx as number} cy={jy as number} r={2.6} fill="#0d1416" />
          <text x={jx as number} y={(jy as number) - 10} textAnchor="middle" style={{ fontSize: 8, fill: '#e8eeee', fontWeight: 700 }}>{lab as string}</text>
        </g>
      ))}
    </g>
  );
}

/** Barra de muestra (10 cm × 2 mm × 2 mm) con el acabado de su material. */
function Bar({ sample, x, y, w }: { sample: Sample; x: number; y: number; w: number }) {
  const h = 9;
  const metal = ['cobre', 'aluminio', 'hierro'].includes(sample.id);
  return (
    <g filter="url(#kit-shadow-soft)">
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={sample.color} stroke={shade(sample.color, -0.35)} strokeWidth="0.8" opacity={sample.id === 'vidrio' ? 0.7 : 1} />
      {metal && <rect x={x} y={y} width={w} height={h} rx={1.5} fill="url(#kit-metal)" opacity="0.35" />}
      {sample.id === 'madera' && [2.5, 5, 7].map((gy, i) => (
        <path key={gy} d={`M${x + 2} ${y + gy} C${x + w * 0.3} ${y + gy - 1.2 + i * 0.4}, ${x + w * 0.6} ${y + gy + 1}, ${x + w - 2} ${y + gy - 0.4}`} fill="none" stroke="#8a5f2e" strokeWidth="0.6" opacity="0.8" />
      ))}
      {sample.id === 'vidrio' && <rect x={x} y={y} width={w} height={h} rx={1.5} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="0.8" />}
      {sample.id !== 'caucho' && <rect x={x + 1} y={y + 0.5} width={w - 2} height={h - 1} rx={1} fill="url(#con-bar-sheen)" opacity={metal || sample.id === 'grafito' ? 0.9 : 0.5} />}
    </g>
  );
}

/** Puntos que representan los iones disueltos (solo como idea; no indican la cantidad real). */
const IONS: Record<string, number> = { destilada: 0, llave: 6, salada: 28 };

function LiquidCell({ sample, cx }: { sample: Sample; cx: number }) {
  const w = 128, h = 100, x = cx - w / 2, y = BOARD_TOP - h;
  const n = IONS[sample.id] ?? 0;
  const ions = useMemo(() => Array.from({ length: n }, (_, i) => ({
    x: x + 26 + ((i * 37) % (w - 52)),
    y: y + 44 + ((i * 23) % (h - 58)),
    pos: i % 2 === 0,
  })), [n, x, y]);
  return (
    <Beaker x={x} y={y} w={w} h={h} fill={0.72} liquid={sample.id === 'destilada' ? '#cfe8f5' : shade(sample.color, -0.15)} liquidOpacity={sample.id === 'destilada' ? 0.3 : 0.5}>
      {/* electrodos de 4 cm² */}
      {[x + 12, x + w - 18].map((ex) => (
        <rect key={ex} x={ex} y={y - 16} width={6} height={h - 22} rx={1} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.6" />
      ))}
      {ions.map((p, i) => (
        <g key={i} opacity="0.85">
          <circle cx={p.x} cy={p.y} r={3} fill={p.pos ? '#7b5ab8' : '#2e8f5a'} />
          <text x={p.x} y={p.y + 2.2} textAnchor="middle" style={{ fontSize: 6, fill: '#fff', fontWeight: 700 }}>{p.pos ? '+' : '−'}</text>
        </g>
      ))}
    </Beaker>
  );
}

/* ------------------------------------------------------------------ laboratorio */

const PREDICTIONS: { value: '' | ConductorClass; label: string }[] = [
  { value: '', label: 'Elige una opción…' },
  { value: 'conductor', label: CLASS_LABELS.conductor },
  { value: 'debil', label: CLASS_LABELS.debil },
  { value: 'aislante', label: CLASS_LABELS.aislante },
];

export default function ConductorsLab({ api }: LabProps) {
  const [sampleId, setSampleId] = useState('cobre');
  const [cells, setCells] = useState<'1' | '2'>('1');
  const [prediction, setPrediction] = useState<'' | ConductorClass>('');
  const [phase, setPhase] = useState<Phase>('abierto');
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);

  const model = useMemo(() => testSample({ sampleId, cells: Number(cells) }), [sampleId, cells]);
  // Lectura del amperímetro (en modo real, con la dispersión típica de la ficha). La clasificación usa el modelo.
  const { measure, remeasure } = useMeasure();
  const res = useMemo(() => ({
    ...model,
    currentReading: model.currentReading === null ? null : measure(model.current * 1000, { ...instrument('conductores', 'amperimetro'), key: 'amperimetro' }),
  }), [model, measure]);
  const sample = res.sample;
  const measured = phase === 'medido';

  // Cualquier cambio de condiciones o de predicción abre el circuito: la medición debe repetirse.
  useEffect(() => { cancelAnimationFrame(raf.current); setPhase('abierto'); setProgress(0); }, [sampleId, cells, prediction]);

  useEffect(() => {
    if (phase !== 'midiendo') return;
    if (prefersReducedMotion()) { setProgress(1); setPhase('medido'); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, now - start) / MEASURE_MS);
      setProgress(p);
      if (p >= 1) { setPhase('medido'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  const closed = phase !== 'abierto';
  const glow = closed && res.visible ? (res.brightness / 100) * progress : 0;
  const lcdText = phase === 'abierto' ? '0,0' : phase === 'midiendo' ? '- - -' : res.currentReading === null ? 'OL' : fmt(res.currentReading, 1);

  // Posiciones de los caimanes según el tipo de muestra.
  const zoneX = 510;
  const geom = useMemo(() => {
    if (sample.kind === 'liquido') {
      return { ly: BOARD_TOP - 108, lx: zoneX - 64 + 15, ry: BOARD_TOP - 108, rx: zoneX + 64 - 15 };
    }
    const barY = BOARD_TOP - 18;
    return { ly: barY + 4.5, lx: zoneX - 60, ry: barY + 4.5, rx: zoneX + 60 };
  }, [sample.kind]);
  // Con el circuito abierto, el caimán derecho queda suelto, separado de la muestra.
  const rx = closed ? geom.rx : geom.rx + 20;
  const ry = closed ? geom.ry : geom.ry - 14;

  const batteryX = 26;
  const packW = 12 + Number(cells) * 58;
  const negPost: [number, number] = [batteryX + 6, BOARD_TOP - 35];
  const posPost: [number, number] = [batteryX + packW - 6, BOARD_TOP - 35];
  const RED = '#d32f2f', BLACK = '#263238';

  const wires = {
    posToBulb: `M${posPost[0]} ${posPost[1]} C${posPost[0] + 10} ${posPost[1] - 30}, ${BULB_X - 30} ${BULB_Y + 30}, ${BULB_X - 12} ${BULB_Y + 1}`,
    bulbToMeter: `M${BULB_X + 12} ${BULB_Y + 1} C${BULB_X + 26} ${BOARD_TOP + 30}, ${JACK_MA[0] - 10} ${BOARD_TOP + 34}, ${JACK_MA[0]} ${JACK_MA[1]}`,
    comToClip: `M${JACK_COM[0]} ${JACK_COM[1]} C${JACK_COM[0] - 4} ${BOARD_TOP + 34}, ${rx + 70} ${BOARD_TOP + 34}, ${rx + 60} ${ry + 40} S${rx + 50} ${ry}, ${rx + 40} ${ry}`,
    clipToNeg: `M${geom.lx - 40} ${geom.ly} C${geom.lx - 70} ${geom.ly}, ${geom.lx - 60} ${BOARD_TOP + 26}, ${geom.lx - 120} ${BOARD_TOP + 26} L${negPost[0] + 30} ${BOARD_TOP + 26} C${negPost[0] - 10} ${BOARD_TOP + 26}, ${negPost[0] - 14} ${negPost[1] + 20}, ${negPost[0]} ${negPost[1]}`,
  };

  const record = () => {
    if (!measured) return;
    api.addTrial('pruebas', {
      muestra: sample.name,
      voltaje: res.voltage,
      log10Resistividad: Number(res.log10Rho.toFixed(2)),
      prediccion: prediction ? CLASS_LABELS[prediction] : '—',
      corriente: res.currentReading,
      brillo: res.brightness,
      clasificacion: CLASS_LABELS[res.classification],
    });
  };

  const describe = phase === 'abierto'
    ? `Circuito abierto. ${sample.name} entre los caimanes; fuente de ${fmt(res.voltage, 1)} V. El amperímetro marca 0,0 mA y el bombillo está apagado.`
    : phase === 'midiendo'
      ? `Circuito cerrado con ${sample.name}; el amperímetro se está estabilizando.`
      : `Circuito cerrado con ${sample.name} y ${fmt(res.voltage, 1)} V. El amperímetro marca ${res.currentReading === null ? 'fuera de rango' : fmt(res.currentReading, 1) + ' mA'} y el bombillo ${res.visible ? `brilla al ${fmt(res.brightness, 1)} % de su potencia nominal` : 'no se ve encendido'}.`;

  const match = measured && prediction ? prediction === res.classification : null;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 300" role="img" aria-labelledby="con-t con-d">
            <title id="con-t">Tablero de pruebas de conductividad con pila, bombillo, amperímetro y una muestra entre dos caimanes</title>
            <desc id="con-d">{describe}</desc>
            <ConductorDefs />
            <BenchTop y={272} width={640} />
            {/* tablero de madera */}
            <g filter="url(#kit-shadow)">
              <rect x={14} y={BOARD_TOP} width={612} height={40} rx={3} fill="url(#kit-wood)" stroke="#b8975a" />
            </g>
            <rect x={14} y={BOARD_TOP + 34} width={612} height={6} rx={2} fill="#a57f3f" opacity="0.55" />
            {/* soportes aislantes de la barra */}
            {sample.kind === 'barra' && [zoneX - 40, zoneX + 32].map((sx) => (
              <rect key={sx} x={sx} y={BOARD_TOP - 9} width={8} height={9} rx={1.5} fill="url(#kit-body)" stroke="#a9b4b6" />
            ))}

            <BatteryPack x={batteryX} cells={Number(cells)} />
            <Bulb x={BULB_X} y={BULB_Y} glow={glow} />
            <Ammeter text={lcdText} />

            {/* muestra */}
            {sample.kind === 'barra' && <Bar sample={sample} x={zoneX - 65} y={BOARD_TOP - 18} w={130} />}
            {sample.kind === 'liquido' && <LiquidCell sample={sample} cx={zoneX} />}
            {sample.kind === 'aire' && (
              <g>
                <line x1={geom.lx + 4} x2={geom.rx - 4} y1={geom.ly} y2={geom.ly} stroke="var(--ink-2)" strokeDasharray="3 4" opacity="0.7" />
                <text x={zoneX} y={geom.ly - 8} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>10 cm de aire</text>
              </g>
            )}

            {/* cables */}
            <Wire d={wires.posToBulb} color={RED} />
            <Wire d={wires.bulbToMeter} color={RED} />
            <Wire d={wires.comToClip} color={BLACK} />
            <Wire d={wires.clipToNeg} color={BLACK} />
            <Clip x={geom.lx} y={geom.ly} dir={1} color={BLACK} />
            <Clip x={rx} y={ry} dir={-1} color={BLACK} />

            {/* rótulos */}
            <text x={batteryX + packW / 2} y={BOARD_TOP + 16} textAnchor="middle" style={{ fontSize: 11, fill: '#5a4320', fontWeight: 700 }}>{cells === '1' ? '1 pila · 1,5 V' : '2 pilas · 3,0 V'}</text>
            <text x={BULB_X} y={BOARD_TOP - 66} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>bombillo</text>
            <text x={zoneX} y={sample.kind === 'liquido' ? BOARD_TOP - 128 : BOARD_TOP - 52} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' }}>{sample.name}</text>
            <text x={zoneX} y={24} textAnchor="middle" style={{ fontSize: 11, fill: closed ? 'var(--ok)' : 'var(--ink-2)', fontWeight: 700 }}>{closed ? 'circuito cerrado' : 'circuito abierto'}</text>
          </svg>
        </div>
        <Readout items={[
          { k: 'Voltaje de la fuente', v: `${fmt(res.voltage, 1)} V` },
          { k: 'Corriente (amperímetro)', v: measured ? (res.currentReading === null ? 'fuera de rango' : `${fmt(res.currentReading, 1)} mA`) : '—', data: true },
          { k: 'Brillo del bombillo', v: measured ? `${fmt(res.brightness, 1)} %${res.visible ? '' : ' (no se ve)'}` : '—', data: true },
          { k: 'Resistencia de la muestra', v: measured ? `${fmtSig(res.sampleR, 2)} Ω` : '—' },
          { k: 'Clasificación según la medición', v: measured ? CLASS_LABELS[res.classification] : '—' },
        ]} />
        {measured && match !== null && (
          <Notice kind={match ? 'ok' : 'warn'}>
            {match
              ? `Tu predicción (${CLASS_LABELS[prediction as ConductorClass]}) coincide con la medición.`
              : `Predijiste «${CLASS_LABELS[prediction as ConductorClass]}», pero la medición indica «${CLASS_LABELS[res.classification]}». Piensa si el material tiene cargas que se puedan mover (electrones libres o iones).`}
            {' '}Resistividad típica: {sample.rhoNote}.
          </Notice>
        )}
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Select label="Muestra entre los caimanes" value={sampleId} onChange={setSampleId} options={SAMPLES.map((s) => ({ value: s.id, label: s.name }))} />
          <Segmented label="Fuente de voltaje" value={cells} onChange={setCells} options={[{ value: '1', label: '1 pila (1,5 V)' }, { value: '2', label: '2 pilas (3,0 V)' }]} />
          <Select
            label="Tu predicción antes de medir" value={prediction}
            onChange={(v) => setPrediction(v as '' | ConductorClass)}
            options={PREDICTIONS}
            hint="Elige si el material será conductor, conductor débil o aislante antes de cerrar el circuito."
          />
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={prediction === '' || phase !== 'abierto'} onClick={() => { remeasure('amperimetro'); setProgress(0); setPhase('midiendo'); playSound('switch'); }}>Cerrar el circuito y medir</button>
            <button type="button" className="btn" disabled={phase === 'abierto'} onClick={() => { cancelAnimationFrame(raf.current); setPhase('abierto'); setProgress(0); playSound('switch', { intensity: 0.6 }); }}>Abrir el circuito</button>
          </div>
          <RecordButton onRecord={record} disabled={!measured} />
        </div>
        <Notice>
          Clasificación por la corriente comparada con la de los caimanes unidos: conductor ≥ 50 %; conductor débil ≥ 0,01 %; aislante, menos.
          Amperímetro: resolución {fmt(AMMETER_RES_MA, 1)} mA, rango 0 a 2 A. El bombillo se ve encendido desde ≈ 1 % de su potencia nominal.
        </Notice>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AIR_CO2, ATMOSPHERES, CAPILLARY_INSTRUMENT, CAPILLARY_SCALE, GLUCOSE_COUNTS, HEADSPACE, RESP_LIMITS, SAMPLES, SUBSTRATES,
  analyzeReadings, atpBreakdown, atpPerGlucoseAerobic, capillaryReading, findSample, gasTimeSeries, indicatorColor, indicatorPH, respirometerModel,
  type Accounting, type Atmosphere, type SampleId, type Shuttle,
} from '../models/respiration';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { SimControls, simStatusOf } from '../components/Experiment';
import { useMeasure } from '../components/Measurement';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { BenchTop, Beaker, ContactShadow, DigitalBalance, Lcd, Stopwatch, TestTube, Thermometer, shade } from './kit';
import { Knob, ManipHint, ManipScene } from './manipulate';

/* ------------------------------------------------------------------ geometría del dibujo */

const W = 780, H = 430;
const BENCH_Y = 396;
const ANIM_MS = 3200;
const ZERO_X = 200; // marca 0 de las escalas
const PXMM = 1; // píxeles por milímetro de capilar
const sx = (mm: number) => ZERO_X + mm * PXMM;
const TUBE_W = 30, TUBE_Y = 186, TUBE_H = 168;
type TubeId = 'a' | 'b' | 'c';
/** Tubo A a la derecha (fila superior), C a la izquierda (fila inferior): los capilares no se cruzan. */
const TUBES: Record<TubeId, { x: number; row: number; label: string }> = {
  a: { x: 662, row: 66, label: 'A · semillas + KOH (absorbe el CO₂)' },
  b: { x: 604, row: 108, label: 'B · semillas + agua con azul de bromotimol' },
  c: { x: 546, row: 150, label: 'C · termobarómetro: semillas hervidas + KOH' },
};
const GAUZE_Y = 322;

/** Color del azul de bromotimol según el pH (amarillo < 6,0 < verde < 7,6 < azul). */
function btbHex(pH: number): string {
  const lerp = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(', ')})`;
  const yellow = [224, 193, 47], green = [63, 154, 75], blue = [47, 98, 196];
  const t = Math.max(0, Math.min(1, (pH - 6.0) / 1.6));
  return t < 0.5 ? lerp(yellow, green, t * 2) : lerp(green, blue, (t - 0.5) * 2);
}

/** Posiciones fijas de las semillas dentro de un tubo (relativas al borde izquierdo y a la malla). */
const SEED_POS: [number, number, number][] = [[7, -4, -20], [15, -5, 15], [23, -4, -10], [10, -11, 30], [19, -12, -25], [6, -18, 5], [15, -19, 40], [23, -18, -15], [11, -26, -30], [20, -26, 10]];

function Seeds({ x, color, alive, peanut, count }: { x: number; color: string; alive: boolean; peanut: boolean; count: number }) {
  const n = Math.max(3, Math.min(SEED_POS.length, count));
  const fill = alive ? color : shade(color, 0.35);
  return (
    <g>
      {SEED_POS.slice(0, n).map(([dx, dy, rot], i) => (
        <g key={i} transform={`translate(${x + dx} ${GAUZE_Y - 2 + dy}) rotate(${rot})`}>
          <ellipse rx={peanut ? 5.4 : 4.4} ry={peanut ? 3 : 3.4} fill={fill} stroke={shade(color, -0.4)} strokeWidth="0.6" />
          {peanut
            ? <ellipse cx={-1.2} cy={-0.8} rx={2.2} ry={1} fill="#fff" opacity="0.25" />
            : <path d="M2.4 -1.6 Q3.8 0 2.4 1.6" fill="none" stroke="#fff6d8" strokeWidth="1.1" opacity="0.85" />}
          {alive && i % 2 === 0 && <path d="M3.6 0.6 q3 1 3.2 4" fill="none" stroke="#f4f1e2" strokeWidth="1.1" strokeLinecap="round" />}
        </g>
      ))}
    </g>
  );
}

/** Tubo del respirómetro: absorbente (KOH) o indicador en el fondo, malla, semillas y tapón de caucho. */
function RespTube({ id, sampleColor, alive, peanut, seeds, indicator }: { id: TubeId; sampleColor: string; alive: boolean; peanut: boolean; seeds: number; indicator?: string }) {
  const t = TUBES[id];
  const cx = t.x + TUBE_W / 2;
  return (
    <g>
      <TestTube x={t.x} y={TUBE_Y} w={TUBE_W} h={TUBE_H} fill={0.16} liquid={indicator ?? '#e9eef0'} liquidOpacity={indicator ? 0.85 : 0.6}>
        {!indicator && (
          // algodón empapado en KOH sobre la solución
          <path d={`M${t.x + 3} ${GAUZE_Y + 9} q4 -6 8 -2 q4 -5 8 0 q4 -4 8 1 l0 6 l-24 0 Z`} fill="#fbfbf8" stroke="#c9cfd2" strokeWidth="0.6" />
        )}
        <line x1={t.x + 2} x2={t.x + TUBE_W - 2} y1={GAUZE_Y + 1} y2={GAUZE_Y + 1} stroke="#7d8a8f" strokeWidth="1.6" strokeDasharray="1.5 1.2" />
        <Seeds x={t.x} color={sampleColor} alive={alive} peanut={peanut} count={seeds} />
      </TestTube>
      {/* tapón de caucho */}
      <path d={`M${t.x - 3} ${TUBE_Y - 14} L${t.x + TUBE_W + 3} ${TUBE_Y - 14} L${t.x + TUBE_W - 1} ${TUBE_Y + 6} L${t.x + 1} ${TUBE_Y + 6} Z`} fill="#3b3330" stroke="#1f1a18" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
      <rect x={t.x - 1} y={TUBE_Y - 13} width={TUBE_W + 2} height={3} fill="#fff" opacity="0.12" />
      <text x={cx} y={TUBE_Y + TUBE_H + 30} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>{id.toUpperCase()}</text>
    </g>
  );
}

/** Capilar con escala milimétrica y gota de eosina. `pos` es el desplazamiento de la gota (mm, positivo hacia el tubo). */
function Capillary({ id, pos }: { id: TubeId; pos: number }) {
  const t = TUBES[id];
  const y = t.row, cx = t.x + TUBE_W / 2;
  const x0 = sx(CAPILLARY_SCALE[0]) - 8;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let mm = CAPILLARY_SCALE[0]; mm <= CAPILLARY_SCALE[1]; mm += 10) out.push(mm);
    return out;
  }, []);
  const dropX = sx(Math.max(CAPILLARY_SCALE[0], Math.min(CAPILLARY_SCALE[1], pos)));
  return (
    <g>
      {/* regla de plástico detrás del capilar */}
      <rect x={sx(CAPILLARY_SCALE[0]) - 6} y={y + 4} width={(CAPILLARY_SCALE[1] - CAPILLARY_SCALE[0]) * PXMM + 12} height={14} rx={2} fill="#f6f2e4" stroke="#b9ad86" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
      {ticks.map((mm) => {
        const major = mm % 50 === 0;
        return (
          <g key={mm}>
            <line x1={sx(mm)} x2={sx(mm)} y1={y + 4} y2={y + (major ? 10 : 7)} stroke="#4d3b1c" strokeWidth={major ? 1 : 0.6} />
            {major && <text x={sx(mm)} y={y + 16.5} textAnchor="middle" style={{ fontSize: 7.5, fill: '#4d3b1c', fontFamily: 'var(--font-data)', fontWeight: mm === 0 ? 700 : 400 }}>{fmt(mm, 0)}</text>}
          </g>
        );
      })}
      {/* capilar de vidrio: tramo horizontal y tramo vertical hasta el tapón */}
      <path d={`M${x0} ${y} H${cx} V${TUBE_Y - 14}`} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="6" strokeLinejoin="round" />
      <path d={`M${x0} ${y} H${cx} V${TUBE_Y - 14}`} fill="none" stroke="#eef6f9" strokeWidth="3.4" strokeLinejoin="round" />
      <path d={`M${x0} ${y - 1.2} H${cx - 1}`} fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.8" />
      {/* gota de eosina */}
      <rect x={dropX - 5} y={y - 1.8} width={10} height={3.6} rx={1.8} fill="#c62828" />
      <rect x={dropX - 4} y={y - 1.6} width={6} height={1} rx={0.5} fill="#fff" opacity="0.35" />
      <text x={sx(CAPILLARY_SCALE[0]) - 6} y={y - 7} style={{ fontSize: 10.5, fill: 'var(--ink)', fontWeight: 600 }}>{t.label}</text>
    </g>
  );
}

function ReagentBottle({ x, y, label, sub, liquid }: { x: number; y: number; label: string; sub: string; liquid: string }) {
  return (
    <g filter="url(#kit-shadow-soft)">
      <rect x={x + 9} y={y - 12} width={14} height={12} rx={2} fill="#2f3a3d" />
      <path d={`M${x + 4} ${y} h24 q4 0 4 6 v46 q0 4 -4 4 h-24 q-4 0 -4 -4 v-46 q0 -6 4 -6 Z`} fill={liquid} opacity="0.55" />
      <path d={`M${x + 4} ${y} h24 q4 0 4 6 v46 q0 4 -4 4 h-24 q-4 0 -4 -4 v-46 q0 -6 4 -6 Z`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      <rect x={x + 3} y={y + 18} width={26} height={22} rx={1.5} fill="#fbfaf5" stroke="#c8c2b0" strokeWidth="0.6" />
      <text x={x + 16} y={y + 28} textAnchor="middle" style={{ fontSize: 7.5, fill: '#2b2b2b', fontWeight: 700 }}>{label}</text>
      <text x={x + 16} y={y + 36} textAnchor="middle" style={{ fontSize: 6, fill: '#444' }}>{sub}</text>
    </g>
  );
}

/** Cilindro de nitrógeno (cuerpo negro, como lo identifica la norma colombiana) con regulador; la manguera va a los tubos en anoxia. */
function GasCylinder({ x, active }: { x: number; active: boolean }) {
  const w = 30, top = 236, cx = x + w / 2;
  return (
    <g>
      {active && <path d={`M${cx + 9} ${top - 18} C ${x + 70} ${top - 80}, 520 150, 545 176`} fill="none" stroke="#5d6b70" strokeWidth="3" strokeLinecap="round" />}
      <g filter="url(#kit-shadow)">
        <path d={`M${x} ${top + 14} Q${x} ${top} ${cx} ${top} Q${x + w} ${top} ${x + w} ${top + 14} V${BENCH_Y - 2} Q${x + w} ${BENCH_Y} ${x + w - 2} ${BENCH_Y} H${x + 2} Q${x} ${BENCH_Y} ${x} ${BENCH_Y - 2} Z`} fill="#25292c" />
      </g>
      <rect x={x + 3} y={top + 10} width={6} height={BENCH_Y - top - 14} rx={3} fill="#fff" opacity="0.12" />
      <rect x={x + 2} y={top + 44} width={w - 4} height={22} rx={2} fill="#f4f4f0" />
      <text x={cx} y={top + 59} textAnchor="middle" style={{ fontSize: 10, fill: '#1b1b1b', fontWeight: 700 }}>N₂</text>
      <rect x={cx - 4} y={top - 12} width={8} height={13} fill="url(#kit-metal-h)" stroke="#8a969a" strokeWidth="0.6" />
      <rect x={cx - 2} y={top - 20} width={14} height={6} rx={2} fill="url(#kit-metal)" stroke="#8a969a" strokeWidth="0.6" />
      <circle cx={cx - 6} cy={top - 16} r={6.5} fill="#fbfbf8" stroke="#8a969a" />
      <line x1={cx - 6} y1={top - 16} x2={cx - 6 + (active ? 4 : -3)} y2={top - 16 - (active ? 3 : 4)} stroke="#c62828" strokeWidth="1" />
    </g>
  );
}

const ATM_LABEL: Record<Atmosphere, string> = { aire: 'Aire', n2: 'N₂' };
const PO_LABEL: Record<Accounting, string> = { moderna: 'Moderna (2,5 y 1,5)', clasica: 'Clásica (3 y 2)' };
const SHUTTLE_LABEL: Record<Shuttle, string> = { malato: 'Malato-aspartato', glicerol: 'Glicerol-3-fosfato' };
const mmText = (v: number | null) => (v === null ? 'fuera de escala' : `${fmt(Object.is(v, -0) ? 0 : v, 1)} mm`);
const clock = (min: number) => {
  const s = Math.round(min * 60);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function RespirationLab({ api }: LabProps) {
  const [sample, setSample] = useState<SampleId>('maiz');
  const [atmosphere, setAtmosphere] = useState<Atmosphere>('aire');
  const [temperature, setTemperature] = useState(25);
  const [mass, setMass] = useState(3);
  const [minutes, setMinutes] = useState(20);
  const [accounting, setAccounting] = useState<Accounting>('moderna');
  const [shuttle, setShuttle] = useState<Shuttle>('malato');
  const [phase, setPhase] = useState<'listo' | 'midiendo' | 'pausa' | 'medido'>('listo');
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);

  const model = useMemo(() => respirometerModel({ sample, atmosphere, temperature, mass, minutes }), [sample, atmosphere, temperature, mass, minutes]);
  const capSpec = INSTRUMENTS.respiracion?.find((i) => i.id === 'capilar') ?? CAPILLARY_INSTRUMENT;
  const { measure, remeasure } = useMeasure();
  // Lecturas de las tres gotas: en modo ideal se redondean a 0,5 mm; en modo real llevan el error de lectura.
  const readings = useMemo(() => {
    const read = (d: number, key: string) => {
      if (capillaryReading(d) === null) return null;
      const v = measure(d, { ...capSpec, key });
      return v < CAPILLARY_SCALE[0] || v > CAPILLARY_SCALE[1] ? null : v;
    };
    return { a: read(model.displacement.a, 'gotaA'), b: read(model.displacement.b, 'gotaB'), c: read(model.displacement.c, 'gotaC') };
  }, [model, measure, capSpec]);
  const analysis = useMemo(() => analyzeReadings(readings, { sample, atmosphere, temperature, mass, minutes, shuttle, accounting }),
    [readings, sample, atmosphere, temperature, mass, minutes, shuttle, accounting]);
  const series = useMemo(() => (phase === 'medido' ? gasTimeSeries(model) : []), [phase, model]);
  const breakdown = useMemo(() => atpBreakdown(GLUCOSE_COUNTS, shuttle, accounting), [shuttle, accounting]);

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setProgress(0); };
  useEffect(reset, [sample, atmosphere, temperature, mass, minutes]);

  useEffect(() => {
    if (phase !== 'midiendo') return;
    if (prefersReducedMotion()) { setProgress(1); setPhase('medido'); return; }
    // Al reanudar tras una pausa, el cronómetro sigue desde el avance ya mostrado.
    const start = performance.now() - progress * ANIM_MS;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, now - start) / ANIM_MS);
      setProgress(p);
      if (p >= 1) { setPhase('medido'); playSound('beep'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  // Sonido: gota indicadora en el capilar y clic del cronómetro; pitido del temporizador al terminar.
  const start = () => { cancelAnimationFrame(raf.current); remeasure('gotaA', 'gotaB', 'gotaC'); setProgress(0); setPhase('midiendo'); playSound('drop', { intensity: 0.5 }); playSound('click', { delay: 0.25 }); };

  const done = phase === 'medido';
  const s = findSample(sample);
  const peanut = sample === 'mani';
  const seeds = Math.round(2 + mass * 1.6);
  // Durante la medición la gota avanza de forma proporcional al tiempo; al final se muestra la lectura.
  const pos = (id: TubeId) => {
    const d = model.displacement[id];
    if (done) return readings[id] ?? (d > 0 ? CAPILLARY_SCALE[1] : CAPILLARY_SCALE[0]);
    return d * progress;
  };
  const co2Now = (atmosphere === 'aire' ? AIR_CO2 : 0) + (model.vCO2 * (done ? 1 : progress)) / HEADSPACE;
  const pHNow = indicatorPH(co2Now);
  const btb = btbHex(pHNow);
  const sampleName = s.short;
  const controlName = peanut ? 'Maní hervido' : 'Maíz hervido';

  const show = (text: string) => (done ? text : '—');
  const a = analysis;
  const record = () => api.addTrial('respiracion', {
    material: sampleName, atmosfera: ATM_LABEL[atmosphere], temp: temperature, masa: mass, tiempo: minutes,
    dA: readings.a, dB: readings.b, dC: readings.c,
    o2: a.vO2 === null ? null : Number(a.vO2.toFixed(1)),
    co2: a.vCO2 === null ? null : Number(a.vCO2.toFixed(1)),
    tasaO2: a.rateO2 === null ? null : Number(a.rateO2.toFixed(1)),
    cr: a.rq === null ? null : Number(a.rq.toFixed(3)),
    atp: a.atpUmol === null ? null : Number(a.atpUmol.toFixed(3)),
    atpGlc: a.atpPerGlucose === null ? null : Number(a.atpPerGlucose.toFixed(0)),
    contabilidad: `${PO_LABEL[accounting]} · ${SHUTTLE_LABEL[shuttle]}`,
  });

  const desc = done
    ? `Después de ${fmt(minutes, 0)} min a ${fmt(temperature, 0)} °C, la gota A marca ${mmText(readings.a)}, la B ${mmText(readings.b)} y la del termobarómetro ${mmText(readings.c)}. El azul de bromotimol del tubo B está ${indicatorColor(pHNow)}.`
    : phase === 'midiendo'
      ? 'Las gotas de los capilares se desplazan mientras corre el cronómetro.'
      : phase === 'pausa' ? 'Medición en pausa: las gotas y el cronómetro se detienen donde iban.'
      : `Tres tubos con ${s.name.toLowerCase()} (A y B) y semillas hervidas (C) en un baño a ${fmt(temperature, 0)} °C; las tres gotas están en la marca 0.`;

  const rqText = a.rq === null ? 'no calculable (O₂ ≈ 0)' : fmt(a.rq, 2);
  const btbText = `${indicatorColor(pHNow)} (pH ≈ ${fmt(pHNow, 1)})`;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo del respirómetro">
          <ManipScene viewBox={`0 0 ${W} ${H}`} label="Controles del termostato" scene={
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="res-t res-d">
            <title id="res-t">Respirómetro de tres tubos en un baño termostatado, con capilares, balanza y cronómetro</title>
            <desc id="res-d">{desc}</desc>
            <BenchTop y={BENCH_Y} width={W} />

            {/* capilares con escala (detrás de los tapones) */}
            {(['a', 'b', 'c'] as TubeId[]).map((id) => <Capillary key={id} id={id} pos={pos(id)} />)}
            <text x={sx(CAPILLARY_SCALE[0]) - 6} y={192} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>
              <tspan x={sx(CAPILLARY_SCALE[0]) - 6}>Escalas en mm. La gota avanza hacia el tubo (+) cuando</tspan>
              <tspan x={sx(CAPILLARY_SCALE[0]) - 6} dy={13}>desaparece gas y se aleja (−) cuando aparece gas.</tspan>
              <tspan x={sx(CAPILLARY_SCALE[0]) - 6} dy={13}>Capilar de 2,0 mm: 1 mm de desplazamiento = 3,14 µL.</tspan>
            </text>

            {/* baño termostatado con los tres tubos */}
            <Beaker x={524} y={214} w={206} h={180} fill={0.78} liquid="#7fbfe0" liquidOpacity={0.32}>
              <path d="M536 380 q8 -8 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="url(#kit-metal-h)" strokeWidth="3" />
              <RespTube id="c" sampleColor={s.color} alive={false} peanut={peanut} seeds={seeds} />
              <RespTube id="b" sampleColor={s.color} alive={s.alive} peanut={peanut} seeds={seeds} indicator={btb} />
              <RespTube id="a" sampleColor={s.color} alive={s.alive} peanut={peanut} seeds={seeds} />
              <Thermometer x={714} y={168} h={196} min={0} max={50} value={temperature} />
            </Beaker>
            {atmosphere === 'n2' && (
              <g>
                <rect x={548} y={14} width={146} height={16} rx={8} fill="var(--surface)" stroke="var(--fis)" strokeWidth="1" />
                <text x={621} y={25.5} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)', fontWeight: 700 }}>Tubos purgados con N₂ (sin O₂)</text>
              </g>
            )}

            {/* termostato del baño (la perilla está en la capa de controles) */}
            <ContactShadow x={428} y={394} w={86} h={7} />
            <g filter="url(#kit-shadow)">
              <rect x={428} y={316} width={86} height={78} rx={8} fill="url(#kit-body)" stroke="#a9b4b6" />
            </g>
            <text x={471} y={331} textAnchor="middle" style={{ fontSize: 8.5, fill: '#3a4644', fontWeight: 700, letterSpacing: 0.5 }}>TERMOSTATO</text>
            <Lcd x={434} y={337} w={74} h={26} text={fmt(temperature, 1)} unit="°C" />
            <circle cx={500} cy={379} r={3} fill={phase === 'midiendo' ? '#66bb6a' : '#9aa5a9'} />
            <path d="M514 360 C 522 360, 526 372, 538 378" fill="none" stroke="#3b4648" strokeWidth="3" strokeLinecap="round" />

            {/* balanza con las semillas pesadas */}
            <DigitalBalance x={30} y={318} w={196} reading={fmt(mass, 2)}>
              <ellipse cx={128} cy={314} rx={32} ry={5} fill="#d9dfe1" stroke="#9aa5a9" />
              {Array.from({ length: Math.min(9, seeds) }, (_, i) => (
                <ellipse key={i} cx={105 + (i % 5) * 11 + (i >= 5 ? 5 : 0)} cy={i >= 5 ? 305 : 310} rx={peanut ? 5.2 : 4.4} ry={peanut ? 3 : 3.4} fill={s.alive ? s.color : shade(s.color, 0.35)} stroke={shade(s.color, -0.4)} strokeWidth="0.6" />
              ))}
            </DigitalBalance>
            <text x={128} y={290} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{sampleName}: {fmt(mass, 1)} g por tubo</text>

            <Stopwatch x={238} y={330} text={clock(minutes * (done ? 1 : progress))} label="tiempo" />
            <ReagentBottle x={348} y={338} label="KOH" sub="15 %" liquid="#e9eef0" />
            <GasCylinder x={389} active={atmosphere === 'n2'} />
            <text x={621} y={423} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>C: {controlName.toLowerCase()} (termobarómetro)</text>
          </svg>}>
            <Knob label="Perilla del termostato del baño" cx={452} cy={381} r={8} value={temperature} min={RESP_LIMITS.temperature[0]} max={RESP_LIMITS.temperature[1]} step={1} pageStep={5} unit="°C" decimals={0} onChange={setTemperature} />
          </ManipScene>
        </div>
        <ManipHint>Gira la perilla del termostato para fijar la temperatura del baño, o enfócala con Tab y usa las flechas.</ManipHint>

        <div className="grid-2">
          <div className="stack">
            <h3>Lecturas de las gotas (escala de 0,5 mm)</h3>
            <Readout items={[
              { k: 'Gota A (KOH)', v: show(mmText(readings.a)), data: true },
              { k: 'Gota B (agua)', v: show(mmText(readings.b)), data: true },
              { k: 'Gota C (termobarómetro)', v: show(mmText(readings.c)), data: true },
            ]} />
            <h3>Intercambio de gases</h3>
            <Readout items={[
              { k: 'Desplazamiento corregido A', v: show(mmText(a.corrA)), data: true },
              { k: 'Desplazamiento corregido B', v: show(mmText(a.corrB)), data: true },
              { k: 'O₂ consumido', v: show(a.vO2 === null ? '—' : `${fmt(a.vO2, 1)} µL`) },
              { k: 'CO₂ producido', v: show(a.vCO2 === null ? '—' : `${fmt(a.vCO2, 1)} µL`) },
              { k: 'Tasa de consumo de O₂', v: show(a.rateO2 === null ? '—' : `${fmt(a.rateO2, 1)} µL/(g·h)`), data: true },
              { k: 'Cociente respiratorio (CR)', v: show(rqText), data: true },
              { k: 'Azul de bromotimol (tubo B)', v: show(btbText) },
            ]} />
          </div>
          <div className="stack">
            <h3>Balance energético</h3>
            <Readout items={[
              { k: 'O₂ consumido (cantidad)', v: show(a.o2Umol === null ? '—' : `${fmt(a.o2Umol, 2)} µmol`) },
              { k: 'Glucosa usada', v: show(a.glucoseUmol === null ? (a.pathway === 'aerobia' ? 'no aplica (oxida lípidos)' : '—') : `${fmt(a.glucoseUmol, 2)} µmol`) },
              { k: 'Vía dominante', v: show(a.pathway === 'aerobia' ? 'respiración aerobia' : a.pathway === 'fermentacion' ? 'fermentación alcohólica' : 'sin intercambio medible') },
              { k: 'ATP producido', v: show(a.atpUmol === null ? '—' : `${fmt(a.atpUmol, 1)} µmol`), data: true },
              { k: 'ATP por glucosa', v: show(a.atpPerGlucose === null ? '—' : fmt(a.atpPerGlucose, 0)), data: true },
              { k: 'Eficiencia (condiciones estándar)', v: show(a.efficiency === null ? '—' : `${fmt(a.efficiency * 100, 0)} %`) },
            ]} />
            {done && a.pathway === 'ninguna' && (
              <Notice kind="warn">Las gotas A y B se movieron igual que el termobarómetro: no hubo intercambio de gases medible con estas condiciones.</Notice>
            )}
            {done && temperature > 40 && a.pathway !== 'ninguna' && (
              <Notice kind="warn">A {fmt(temperature, 0)} °C buena parte de las enzimas respiratorias está desnaturalizada.</Notice>
            )}
          </div>
        </div>

        <details className="card">
          <summary>Gráfica del O₂ consumido y el CO₂ producido (después de medir)</summary>
          <Chart title="Gases durante la medición" xLabel="Tiempo (min)" yLabel="Volumen de gas (µL)" xUnit="min" yUnit="µL" height={230}
            exportName="respiracion-gases"
            series={series.length ? [
              { label: 'O₂ consumido', color: 'var(--series-1)', kind: 'line', points: series.map((q) => ({ x: q.t, y: q.o2 })) },
              { label: 'CO₂ producido', color: 'var(--series-2)', kind: 'line', dashed: true, points: series.map((q) => ({ x: q.t, y: q.co2 })) },
            ] : []} emptyText="Inicia una medición para ver la gráfica." />
        </details>

        <details className="card">
          <summary>¿De dónde salen los ATP de una glucosa? (contabilidad seleccionada)</summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Balance de ATP por glucosa">
            <table>
              <caption className="sr-only">ATP por glucosa en cada etapa con las relaciones P/O elegidas</caption>
              <thead><tr><th scope="col">Etapa</th><th scope="col">Portadores</th><th scope="col" className="n">ATP</th></tr></thead>
              <tbody>
                <tr><td>Glucólisis y ciclo de Krebs (nivel de sustrato)</td><td>2 ATP + 2 GTP</td><td className="n">{fmt(breakdown.substrateLevel, 1)}</td></tr>
                <tr><td>NADH de la glucólisis (lanzadera {SHUTTLE_LABEL[shuttle].toLowerCase()})</td><td>2 NADH citosólicos</td><td className="n">{fmt(breakdown.fromNadhCyto, 1)}</td></tr>
                <tr><td>Piruvato deshidrogenasa y ciclo de Krebs</td><td>8 NADH</td><td className="n">{fmt(breakdown.fromNadhMito, 1)}</td></tr>
                <tr><td>Succinato deshidrogenasa</td><td>2 FADH₂</td><td className="n">{fmt(breakdown.fromFadh2, 1)}</td></tr>
                <tr><th scope="row">Total respiración aerobia</th><td>6 O₂ consumidos</td><td className="n"><strong>{fmt(atpPerGlucoseAerobic(shuttle, accounting), 1)}</strong></td></tr>
                <tr><th scope="row">Fermentación alcohólica</th><td>sin O₂; el NADH se reoxida al formar etanol</td><td className="n"><strong>2,0</strong></td></tr>
              </tbody>
            </table>
          </div>
          <p className="small muted">Con P/O modernas (≈ 10 H⁺ bombeados por NADH, 6 por FADH₂ y ≈ 4 H⁺ por ATP sintetizado y exportado) se obtienen 30–32 ATP. Los textos que dicen 36–38 usan los valores enteros antiguos (3 y 2).</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Cociente respiratorio teórico por sustrato">
            <table>
              <caption className="sr-only">Cociente respiratorio teórico de cada tipo de sustrato</caption>
              <thead><tr><th scope="col">Sustrato</th><th scope="col">Ejemplo</th><th scope="col" className="n">CR = CO₂/O₂</th></tr></thead>
              <tbody>
                {Object.values(SUBSTRATES).map((sub) => (
                  <tr key={sub.id}><td>{sub.name}</td><td>{sub.example}</td><td className="n">{fmt(sub.rq, 2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Select label="Semillas de los tubos A y B" value={sample} onChange={(v) => setSample(v as SampleId)}
            options={SAMPLES.map((x) => ({ value: x.id, label: x.name }))} />
          <Segmented<Atmosphere> label="Atmósfera de los tubos" value={atmosphere} onChange={setAtmosphere}
            options={ATMOSPHERES.map((x) => ({ value: x.id, label: x.name }))} />
          <Slider label="Temperatura del baño" value={temperature} min={RESP_LIMITS.temperature[0]} max={RESP_LIMITS.temperature[1]} step={1} unit="°C" decimals={0} onChange={setTemperature} />
          <Slider label="Masa de semillas por tubo" value={mass} min={RESP_LIMITS.mass[0]} max={RESP_LIMITS.mass[1]} step={0.5} unit="g" decimals={1} onChange={setMass} />
          <Slider label="Duración de la medición" value={minutes} min={RESP_LIMITS.minutes[0]} max={RESP_LIMITS.minutes[1]} step={5} unit="min" decimals={0} onChange={setMinutes} />
          <SimControls title="Respirómetro" status={simStatusOf(phase === 'midiendo', phase === 'pausa', done)} startLabel="Iniciar medición" repeatLabel="Medir de nuevo"
            onStart={start} onPause={() => { cancelAnimationFrame(raf.current); setPhase('pausa'); }} onResume={() => setPhase('midiendo')} onReset={reset}
            progress={{ value: minutes * (done ? 1 : progress), max: minutes, unit: 'min', decimals: 1, label: 'Tiempo de medición' }} />
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <div className="card stack">
          <h3>Contabilidad del ATP</h3>
          <Segmented<Accounting> label="Relaciones P/O (NADH y FADH₂)" value={accounting} onChange={setAccounting}
            options={[{ value: 'moderna', label: PO_LABEL.moderna }, { value: 'clasica', label: PO_LABEL.clasica }]} />
          <Segmented<Shuttle> label="Lanzadera del NADH citosólico" value={shuttle} onChange={setShuttle}
            options={[{ value: 'malato', label: SHUTTLE_LABEL.malato }, { value: 'glicerol', label: SHUTTLE_LABEL.glicerol }]} />
          <p className="small muted">No cambian la medición: solo cómo se convierten el O₂ y el CO₂ medidos en ATP.</p>
        </div>
        <Notice>Los tres tubos tienen 15,0 mL de gas y están en el mismo baño. El termobarómetro (C) corrige los cambios de temperatura y presión: resta su lectura a las de A y B. Capilar de 2,0 mm de diámetro: 1 mm de desplazamiento = 3,14 µL.</Notice>
      </div>
    </div>
  );
}

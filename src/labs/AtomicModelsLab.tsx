import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ATOM_MODELS, bohrEnergy, maxEnergyForCoulomb, countScintillations, countsUntil, FOILS, GEIGER_MARSDEN_GOLD, NIST_BALMER_AIR, RF_LIMITS, rutherfordRate, rutherfordSetup,
  thomsonRate, transition, wavelengthColor, type CountRun,
} from '../models/atomicModels';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText, SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import type { LabProps } from './registry';
import { DragHandle, ManipHint, ManipScene } from './manipulate';
import { Scene3D } from '../three';
import { experimentScene, FOIL_COLOR, modelsScene, nucleusScene, type AtomView } from './atomic3d';

type Station = 'rutherford' | 'bohr';
/** Aceleración de la animación del conteo (el reloj del detector avanza 10 s por segundo real). */
const SPEEDUP = 10;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Si el átomo fuera como lo imaginó Thomson, algunas alfas rebotarían hacia atrás.', answer: 'falso', feedback: 'En el átomo de Thomson la carga positiva está repartida en todo el átomo: cada átomo desvía la alfa menos de una centésima de grado y, aun sumando cerca de 2000 átomos, la desviación típica es de una fracción de grado. Rebotar a más de 90° sería prácticamente imposible.' },
  { id: 'i2', text: 'La mayoría de las alfas atraviesa la lámina de oro casi sin desviarse.', answer: 'cierto', feedback: 'Así es: el átomo es casi todo espacio vacío. Solo las alfas que pasan muy cerca de un núcleo (a decenas de femtómetros) se desvían mucho; en una lámina de 0,4 µm rebota más de 90° menos de 1 de cada 10 000.' },
  { id: 'i3', text: 'Al alejar el detector del haz (de 30° a 150°) el número de centelleos baja a la mitad.', answer: 'falso', feedback: 'Baja mucho más: según 1/sen⁴(θ/2), de 30° a 150° el conteo se divide entre unas 190. Por eso Geiger y Marsden tuvieron que contar durante mucho tiempo a ángulos grandes.' },
  { id: 'i4', text: 'Una lámina de un metal con núcleos de más carga (oro, Z = 79) desvía más alfas que una de aluminio (Z = 13) con el mismo número de átomos.', answer: 'cierto', feedback: 'El número de alfas desviadas a un ángulo dado es proporcional a Z²: (79/13)² ≈ 37 veces más con el mismo número de átomos por área.' },
  { id: 'i5', text: 'En el modelo de Bohr el electrón puede estar a cualquier distancia del núcleo y emitir luz de cualquier color.', answer: 'falso', feedback: 'Solo hay órbitas con energías permitidas (Eₙ = −13,6 eV/n²); al bajar de una a otra emite un fotón con una energía fija. Por eso el hidrógeno emite solo ciertas líneas: 656, 486, 434 y 410 nm en el visible.' },
];

/* ------------------------------------------------------------------ banco 2D (vista superior) */

const CX = 330, CY = 196, RT = 132;
const toRad = (d: number) => (d * Math.PI) / 180;

function GoldFoilBench({ foilId, thetaDeg, shownCounts, tNow, run, running }: { foilId: string; thetaDeg: number; shownCounts: number; tNow: number; run: CountRun | null; running: boolean }) {
  const th = toRad(thetaDeg);
  const dx = CX + RT * Math.cos(th), dy = CY - RT * Math.sin(th);
  const flashes = run && running ? run.arrivals.filter((a) => a <= tNow && a > tNow - 0.6 * SPEEDUP / 10).slice(-6) : [];
  const ticks = Array.from({ length: 19 }, (_, i) => i * 10);
  return (
    <svg viewBox="0 0 660 360" role="img" aria-labelledby="ato-t ato-d">
      <title id="ato-t">Experimento de la lámina: fuente de partículas alfa, lámina metálica y detector de centelleo sobre un riel circular</title>
      <desc id="ato-d">{`Vista desde arriba: el haz de alfas va de izquierda a derecha y atraviesa la lámina. El detector está a ${fmt(thetaDeg, 1)}° de la dirección del haz y lleva ${shownCounts} centelleos contados en ${fmt(tNow, 1)} s.`}</desc>
      <rect x="0" y="0" width="660" height="360" rx="14" fill="var(--surface-2)" />
      {/* riel circular graduado */}
      <circle cx={CX} cy={CY} r={RT} fill="none" stroke="var(--line-strong)" strokeWidth="6" opacity="0.5" />
      {ticks.map((d) => {
        const a = toRad(d);
        return (
          <g key={d}>
            <line x1={CX + (RT - 9) * Math.cos(a)} y1={CY - (RT - 9) * Math.sin(a)} x2={CX + (RT + 9) * Math.cos(a)} y2={CY - (RT + 9) * Math.sin(a)} stroke="var(--ink-2)" strokeWidth={d % 30 === 0 ? 1.4 : 0.7} />
            {d % 30 === 0 && <text x={CX + (RT + 22) * Math.cos(a)} y={CY - (RT + 22) * Math.sin(a) + 4} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{d}°</text>}
          </g>
        );
      })}
      {/* fuente y colimador */}
      <rect x="40" y={CY - 26} width="70" height="52" rx="6" fill="var(--ink-3)" />
      <text x="75" y={CY + 44} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)' }}>fuente α</text>
      <rect x="112" y={CY - 8} width="40" height="16" rx="3" fill="var(--ink-2)" />
      <line x1="152" y1={CY} x2={CX - 4} y2={CY} stroke="var(--series-2)" strokeWidth="5" opacity="0.55" />
      <line x1={CX + 4} y1={CY} x2={CX + RT - 14} y2={CY} stroke="var(--series-2)" strokeWidth="2" strokeDasharray="5 4" opacity="0.6" />
      {/* lámina */}
      <rect x={CX - 3} y={CY - 46} width="6" height="92" fill={FOIL_COLOR[foilId]} stroke="var(--ink-2)" strokeWidth="0.8" />
      <text x={CX + 8} y={CY + 62} style={{ fontSize: 11, fill: 'var(--ink)' }}>lámina</text>
      {/* línea de visión y detector */}
      <line x1={CX} y1={CY} x2={dx} y2={dy} stroke="var(--data)" strokeWidth="1.2" strokeDasharray="3 3" />
      <path d={`M${CX + 40} ${CY} A40 40 0 0 0 ${CX + 40 * Math.cos(th)} ${CY - 40 * Math.sin(th)}`} fill="none" stroke="var(--data)" strokeWidth="1.6" />
      <text x={CX + 50 * Math.cos(th / 2) + 4} y={CY - 50 * Math.sin(th / 2)} style={{ fontSize: 12, fill: 'var(--data)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface-2)', strokeWidth: 3 }}>θ = {fmt(thetaDeg, 1)}°</text>
      <g transform={`translate(${dx} ${dy}) rotate(${-thetaDeg})`}>
        <rect x="-6" y="-14" width="30" height="28" rx="4" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.2" />
        <rect x="-8" y="-11" width="4" height="22" fill="var(--series-3)" opacity="0.8" />
      </g>
      {flashes.map((a) => <circle key={a} cx={dx + (Math.sin(a * 37) * 6)} cy={dy + (Math.cos(a * 53) * 6)} r="3.2" fill="var(--series-3)" />)}
      {/* contador */}
      <g transform="translate(470 22)">
        <rect width="168" height="74" rx="8" fill="var(--surface)" stroke="var(--line)" />
        <text x="12" y="20" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Centelleos contados</text>
        <text x="12" y="50" style={{ fontSize: 26, fill: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{shownCounts}</text>
        <text x="156" y="64" textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>t = {fmt(tNow, 1)} s</text>
      </g>
    </svg>
  );
}

/** Gráfica logarítmica: conteos por minuto guardados frente a θ, con las predicciones de Rutherford y de Thomson. */
function ScatterChart({ points, rutherford, thomson, gm }: { points: { th: number; perMin: number }[]; rutherford: (th: number) => number; thomson: (th: number) => number; gm: boolean }) {
  const W = 620, H = 250, L = 56, R = 14, T = 14, B = 40;
  const ymin = -1, ymax = 6;
  const x = (th: number) => L + (th / 180) * (W - L - R);
  const y = (lg: number) => T + ((ymax - Math.max(ymin, Math.min(ymax, lg))) / (ymax - ymin)) * (H - T - B);
  const curve = (f: (th: number) => number, from: number) => {
    const pts: string[] = [];
    for (let th = from; th <= 178; th += 0.5) { const lg = Math.log10(Math.max(1e-300, f(th))); if (lg < ymin - 0.5) break; pts.push(`${x(th).toFixed(1)} ${y(lg).toFixed(1)}`); }
    return pts.length > 1 ? `M${pts.join(' L')}` : '';
  };
  // Geiger y Marsden: se escalan para que coincidan con la curva a 60° (sus conteos están en unidades relativas).
  const g60 = GEIGER_MARSDEN_GOLD.find((g) => g.theta === 60)!.counts;
  const k = rutherford(60) / g60;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="ato-g-t ato-g-d" style={{ width: '100%', height: 'auto' }}>
      <title id="ato-g-t">Centelleos por minuto frente al ángulo del detector, en escala logarítmica</title>
      <desc id="ato-g-d">{`Línea continua: predicción del átomo nuclear de Rutherford; línea punteada: predicción del átomo de Thomson, que cae a cero antes de 5°. Puntos: ${points.length} conteos guardados.${gm ? ' Cuadrados: datos de Geiger y Marsden (1913) escalados.' : ''}`}</desc>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="var(--surface)" stroke="var(--line)" />
      {[-1, 0, 1, 2, 3, 4, 5, 6].map((lg) => (
        <g key={lg}>
          <line x1={L} x2={W - R} y1={y(lg)} y2={y(lg)} stroke="var(--line)" strokeDasharray="2 3" />
          <text x={L - 6} y={y(lg) + 4} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{lg >= 0 ? fmt(10 ** lg, 0) : '0,1'}</text>
        </g>
      ))}
      {[0, 30, 60, 90, 120, 150, 180].map((th) => <text key={th} x={x(th)} y={H - B + 16} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{th}°</text>)}
      <text x={(L + W) / 2} y={H - 6} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)' }}>ángulo del detector θ</text>
      <text x="12" y={T + 6} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>por min</text>
      <path d={curve(rutherford, 5)} fill="none" stroke="var(--series-1)" strokeWidth="2" />
      <path d={curve(thomson, 0.2)} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeDasharray="6 4" />
      {gm && GEIGER_MARSDEN_GOLD.map((g) => <rect key={g.theta} x={x(g.theta) - 4} y={y(Math.log10(g.counts * k)) - 4} width="8" height="8" fill="none" stroke="var(--ink)" strokeWidth="1.4" />)}
      {points.map((p, i) => p.perMin > 0 ? <circle key={i} cx={x(p.th)} cy={y(Math.log10(p.perMin))} r="4.5" fill="var(--data)" stroke="var(--surface)" /> : <circle key={i} cx={x(p.th)} cy={y(ymin)} r="4.5" fill="none" stroke="var(--data)" />)}
      <g transform={`translate(${W - R - 210} ${T + 8})`} style={{ fontSize: 10.5 }}>
        <rect width="204" height={gm ? 62 : 46} rx="6" fill="var(--surface)" stroke="var(--line)" opacity="0.95" />
        <line x1="8" x2="30" y1="14" y2="14" stroke="var(--series-1)" strokeWidth="2" /><text x="36" y="18" style={{ fill: 'var(--ink)' }}>Rutherford (núcleo)</text>
        <line x1="8" x2="30" y1="30" y2="30" stroke="var(--series-2)" strokeWidth="2" strokeDasharray="6 4" /><text x="36" y="34" style={{ fill: 'var(--ink)' }}>Thomson (budín)</text>
        {gm && <><rect x="14" y="41" width="8" height="8" fill="none" stroke="var(--ink)" /><text x="36" y="49" style={{ fill: 'var(--ink)' }}>Geiger y Marsden (1913)</text></>}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ Bohr */

function BohrDiagram({ nUpper, nLower, emitted }: { nUpper: number; nLower: number; emitted: boolean }) {
  const W = 620, H = 250;
  const yE = (e: number) => 22 + ((0 - e) / 13.598) * 196; // 0 eV arriba, −13,6 eV abajo
  const t = transition(nUpper, nLower);
  const spec = (nm: number) => 330 + ((nm - 380) / (750 - 380)) * 270;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="bohr-t bohr-d" style={{ width: '100%', height: 'auto' }}>
      <title id="bohr-t">Niveles de energía del átomo de hidrógeno y espectro de emisión</title>
      <desc id="bohr-d">{`Transición del nivel ${nUpper} al ${nLower}: fotón de ${fmt(t.energyEV, 3)} eV y ${fmt(t.lambdaAirNm, 1)} nm (${t.colorName}).`}</desc>
      <rect width={W} height={H} rx="12" fill="var(--surface-2)" />
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <g key={n}>
          <line x1="40" x2="260" y1={yE(bohrEnergy(n))} y2={yE(bohrEnergy(n))} stroke={n === nUpper || n === nLower ? 'var(--ink)' : 'var(--ink-3)'} strokeWidth={n === nUpper || n === nLower ? 2 : 1} />
          {n <= 5 && <text x="34" y={yE(bohrEnergy(n)) + 4} textAnchor="end" style={{ fontSize: 10.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>n={n}</text>}
          {n <= 4 && <text x="266" y={yE(bohrEnergy(n)) + 4} style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(bohrEnergy(n), 2)} eV</text>}
        </g>
      ))}
      <line x1="150" x2="150" y1={yE(bohrEnergy(nUpper)) + 2} y2={yE(bohrEnergy(nLower)) - 8} stroke="var(--data)" strokeWidth="2.4" />
      <path d={`M144 ${yE(bohrEnergy(nLower)) - 10} L150 ${yE(bohrEnergy(nLower)) - 1} L156 ${yE(bohrEnergy(nLower)) - 10} Z`} fill="var(--data)" />
      {emitted && <path d={`M158 ${(yE(bohrEnergy(nUpper)) + yE(bohrEnergy(nLower))) / 2} q8 -8 16 0 t16 0 t16 0 t16 0`} fill="none" stroke={t.region === 'visible' ? wavelengthColor(t.lambdaAirNm) : 'var(--ink-2)'} strokeWidth="2.5" />}
      {/* espectro visible */}
      <text x="330" y="150" style={{ fontSize: 11, fill: 'var(--ink)' }}>Espectro visible (380–750 nm)</text>
      {Array.from({ length: 74 }, (_, i) => 380 + i * 5).map((nm) => <rect key={nm} x={spec(nm)} y="158" width={270 / 74 + 0.5} height="34" fill={wavelengthColor(nm)} opacity="0.25" />)}
      {Object.entries(NIST_BALMER_AIR).map(([n, nm]) => <line key={n} x1={spec(nm)} x2={spec(nm)} y1="158" y2="192" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 2" />)}
      {emitted && t.region === 'visible' && <rect x={spec(t.lambdaAirNm) - 2} y="154" width="4" height="42" fill={wavelengthColor(t.lambdaAirNm)} stroke="var(--ink)" strokeWidth="0.6" />}
      {[400, 500, 600, 700].map((nm) => <text key={nm} x={spec(nm)} y="208" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{nm}</text>)}
      <text x="330" y="232" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Líneas punteadas: Balmer del NIST (656, 486, 434, 410 nm)</text>
      {emitted && t.region !== 'visible' && <text x="330" y="120" style={{ fontSize: 11.5, fill: 'var(--ink)', fontWeight: 700 }}>Fotón {t.region === 'ultravioleta' ? 'ultravioleta' : 'infrarrojo'}: no se ve</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function AtomicModelsLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('rutherford');
  const [foilId, setFoilId] = useState('oro');
  const [energy, setEnergy] = useState(5);
  const [thickness, setThickness] = useState(0.4);
  const [theta, setTheta] = useState(60);
  const [timeS, setTimeS] = useState(60);
  const [run, setRun] = useState<CountRun | null>(null);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<AtomView>('experimento');
  const [nUpper, setNUpper] = useState(3);
  const [nLower, setNLower] = useState(2);
  const [emitted, setEmitted] = useState(false);
  const seed = useRef(0);
  const raf = useRef(0);

  const setup = useMemo(() => rutherfordSetup({ foilId, energyMeV: energy, thicknessUm: thickness }), [foilId, energy, thickness]);
  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setRun(null); setT(0); };
  useEffect(reset, [setup, theta, timeS]);
  useEffect(() => setEmitted(false), [nUpper, nLower]);

  useEffect(() => {
    if (!running || !run) return;
    if (prefersReducedMotion()) { setT(run.timeS); setRunning(false); return; }
    const start = performance.now() - (t / SPEEDUP) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * SPEEDUP;
      if (el >= run.timeS) { setT(run.timeS); setRunning(false); playSound('click', { intensity: 0.6 }); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, run]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    seed.current += 1;
    const r = countScintillations(setup, theta, timeS, 1000 * seed.current + Math.round(theta * 10));
    setRun(r); setT(0); setRunning(true);
  };
  const finished = !!run && !running && t >= run.timeS;
  const status = simStatusOf(running, !!run && t > 0, finished);
  const shown = run ? countsUntil(run, t) : 0;
  const thNow = thomsonRate(setup, theta);
  const rateR = rutherfordRate(setup, theta) * 60;

  usePublishModel(() => ({
    vars: {
      Z: { sym: 'Z', name: `Número atómico (${setup.foil.name})`, value: setup.foil.Z, unit: '', decimals: 0 },
      E: { sym: 'E', name: 'Energía de las alfas', value: energy, unit: 'MeV', decimals: 1 },
      d: { sym: 'd', name: 'Distancia de máximo acercamiento', value: setup.d_fm, unit: 'fm', decimals: 1 },
      th: { sym: '\\theta', name: 'Ángulo del detector', value: theta, unit: '°', decimals: 1 },
      N: { sym: 'N', name: 'Centelleos por minuto (Rutherford, esperado)', value: rateR, unit: 'min⁻¹', decimals: 1 },
    },
    equations: [
      { title: 'Distancia de máximo acercamiento', lhs: 'd', expr: '\\frac{1{,}44\\ \\text{MeV·fm}·2·[Z]}{[E]}' },
      { title: 'Ley de Rutherford', lhs: 'N', expr: 'C·\\frac{[Z]^{2}}{[E]^{2}·\\text{sen}^{4}([th]/2)}', note: 'C reúne el haz, la lámina y el detector.' },
    ],
  }), [setup, energy, theta, rateR]);

  const scene = useMemo(() => {
    if (view === 'nucleo') return nucleusScene(setup);
    if (view === 'modelos') return modelsScene({ nUpper, nLower, emitted });
    return experimentScene({ setup, thetaDeg: theta, progress: run ? t / run.timeS : 0, counts: shown, seed: 17 + seed.current });
  }, [view, setup, theta, run, t, shown, nUpper, nLower, emitted]);

  const tr = transition(nUpper, nLower);
  const savedPoints = api.session.trials.filter((x) => x.datasetId === 'dispersion' && x.values.lamina === setup.foil.name && x.values.energia === energy && x.values.espesor === thickness)
    .map((x) => ({ th: Number(x.values.angulo), perMin: Number(x.values.porMinuto) }));

  const recordCounts = () => {
    if (!run || !finished) return;
    api.addTrial('dispersion', {
      lamina: setup.foil.name, Z: setup.foil.Z, energia: energy, espesor: thickness, angulo: theta, tiempo: timeS,
      cuentas: run.counts, porMinuto: Number(run.rate.toFixed(2)), invSen4: Number(run.invSin4.toFixed(3)), producto: Number(run.product.toFixed(3)),
      rutherford: Number(rateR.toFixed(3)), thomsonLog: Number((thNow.log10 + Math.log10(60)).toFixed(1)),
    });
  };
  const recordLine = () => api.addTrial('espectro', {
    nSuperior: nUpper, nInferior: nLower, serie: tr.series, energia: Number(tr.energyEV.toFixed(4)), lambda: Number(tr.lambdaAirNm.toFixed(2)),
    lambdaNist: nLower === 2 && NIST_BALMER_AIR[nUpper] ? NIST_BALMER_AIR[nUpper] : null, region: tr.region,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation}
          options={[{ value: 'rutherford', label: '1. Lámina de oro (Rutherford)' }, { value: 'bohr', label: '2. Átomo de Bohr y espectro' }]} />
        {station === 'rutherford' ? (
          <>
            <div className="bench">
              <ManipScene viewBox="0 0 660 360" label="Control del detector de centelleo" scene={
                <GoldFoilBench foilId={foilId} thetaDeg={theta} shownCounts={shown} tNow={t} run={run} running={running} />}>
                <DragHandle label="Detector de centelleo: ángulo respecto al haz" value={theta} min={RF_LIMITS.angle[0]} max={RF_LIMITS.angle[1]} step={2.5} unit="°" decimals={1}
                  disabled={running} hit={{ cx: CX + (RT) * Math.cos(toRad(theta)), cy: CY - RT * Math.sin(toRad(theta)), r: 22 }}
                  valueText={(v) => `${fmt(v, 1)}° respecto al haz`}
                  valueFromPoint={({ point }) => (Math.atan2(CY - point.y, point.x - CX) * 180) / Math.PI}
                  onChange={(v) => setTheta(Math.round(v / 2.5) * 2.5)} />
              </ManipScene>
            </div>
            <ManipHint>Arrastra el detector por el riel para cambiar el ángulo, o enfócalo con Tab y usa las flechas.</ManipHint>
            <Readout items={[
              { k: 'Centelleos contados N', v: run ? `${shown}` : '—', data: true, resolution: run ? resolutionText(1, 'cuenta') : undefined },
              { k: 'Tiempo de conteo', v: run ? `${fmt(t, 1)} s de ${fmt(timeS, 0)} s` : '—' },
              { k: 'Centelleos por minuto', v: finished && run ? fmt(run.rate, 1) : '—', data: true },
              { k: 'N·sen⁴(θ/2) por minuto', v: finished && run ? fmt(run.product, 2) : '—', data: true },
              { k: 'Thomson predice (por minuto)', v: thNow.log10 + Math.log10(60) < -3 ? `≈ 0 (1 cada 10^${String(-Math.floor(thNow.log10 + Math.log10(60))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} min)` : fmt(thNow.rate * 60, 2) },
              { k: 'Distancia de máximo acercamiento d', v: `${fmt(setup.d_fm, 1)} fm` },
              { k: 'Rebotan más de 90° (modelo nuclear)', v: `1 de cada ${fmt(1 / setup.fractionBack, 0)}` },
              { k: 'Desviación típica según Thomson', v: `${fmt((setup.thomsonRms * 180) / Math.PI, 2)}°` },
            ]} />
            {setup.warnings.map((w) => (
              <ConditionAlert key={w} level="invalido" title="el núcleo deja de ser un punto con carga" cause={w}
                fix={`Baja la energía de las alfas a ${fmt(maxEnergyForCoulomb(setup.foil), 1)} MeV o menos, o usa una lámina de un metal más pesado (oro o plata).`} />
            ))}
            {run && finished && run.counts < 10 && (
              <ConditionAlert level="advertencia" title="muy pocos centelleos" cause={`Con ${run.counts} centelleos la incertidumbre estadística (≈ √N = ${fmt(Math.sqrt(Math.max(1, run.counts)), 1)}) es muy grande frente al conteo.`}
                fix="Cuenta durante más tiempo (hasta 120 s) o usa una lámina más gruesa; Geiger y Marsden contaban cientos de centelleos en cada ángulo." />
            )}
            <section className="card stack" aria-labelledby="ato-graf-h">
              <h3 id="ato-graf-h">¿Qué modelo describe tus datos?</h3>
              <ScatterChart points={savedPoints} rutherford={(th) => rutherfordRate(setup, th) * 60} thomson={(th) => thomsonRate(setup, th).rate * 60} gm={foilId === 'oro'} />
              <p className="small muted" style={{ margin: 0 }}>Se grafican tus conteos guardados con esta misma lámina, energía y espesor. Escala logarítmica: cada línea horizontal es 10 veces la anterior.</p>
            </section>
          </>
        ) : (
          <>
            <div className="bench"><BohrDiagram nUpper={nUpper} nLower={nLower} emitted={emitted} /></div>
            <Readout items={[
              { k: 'Transición', v: `n = ${nUpper} → n = ${nLower} (serie de ${tr.series})` },
              { k: 'Energía del fotón', v: emitted ? `${fmt(tr.energyEV, 3)} eV` : '—', data: true },
              { k: 'Longitud de onda (aire)', v: emitted ? `${fmt(tr.lambdaAirNm, 1)} nm` : '—', data: true },
              { k: 'Región y color', v: emitted ? tr.colorName : '—' },
              { k: 'Línea medida (NIST)', v: emitted && nLower === 2 && NIST_BALMER_AIR[nUpper] ? `${fmt(NIST_BALMER_AIR[nUpper], 1)} nm` : '—' },
            ]} />
          </>
        )}
        <section className="card" aria-labelledby="ato-3d-h">
          <h3 id="ato-3d-h">Vista 3D: la lámina, el núcleo y los modelos</h3>
          <Segmented<AtomView> label="Qué ver en 3D" value={view} onChange={setView}
            options={[{ value: 'experimento', label: 'Montaje y alfas' }, { value: 'nucleo', label: 'Cerca del núcleo' }, { value: 'modelos', label: 'Los cuatro modelos' }]} />
          <Scene3D idPrefix="ato" title={view === 'experimento' ? 'Experimento de la lámina en 3D' : view === 'nucleo' ? 'Trayectorias de las alfas cerca de un núcleo' : 'Modelos atómicos de Dalton, Thomson, Rutherford y Bohr'}
            items={scene.items} extent={scene.extent} target={scene.target} description={scene.description} height={340}
            initialOrbit={view === 'nucleo' ? { yaw: 0.2, pitch: 0.35 } : view === 'modelos' ? { yaw: 0, pitch: 0.25 } : { yaw: 0.5, pitch: 0.5 }}
            status={scene.status} statusNote={scene.note} />
        </section>
        <section className="card stack" aria-labelledby="ato-mod-h">
          <h3 id="ato-mod-h">Cuatro modelos, cuatro predicciones</h3>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Comparación de los modelos atómicos">
            <table>
              <caption className="sr-only">Idea, predicción y límite de cada modelo atómico</caption>
              <thead><tr><th scope="col">Modelo</th><th scope="col">Idea</th><th scope="col">Predice</th><th scope="col">No explica</th></tr></thead>
              <tbody>{ATOM_MODELS.map((m) => <tr key={m.id}><th scope="row">{m.name} ({m.year})</th><td>{m.idea}</td><td>{m.predicts}</td><td>{m.fails}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="ato" intro="Ideas frecuentes sobre el átomo. Decide si son ciertas o falsas y compruébalo con el detector o con el átomo de Bohr." />
      </div>
      <div className="controls">
        {station === 'rutherford' ? (
          <>
            <div className="card stack">
              <h3>Montaje</h3>
              <Select label="Lámina metálica" value={foilId} onChange={setFoilId} options={FOILS.map((f) => ({ value: f.id, label: `${f.name} (${f.sym}, Z = ${f.Z})` }))} />
              <Slider label="Energía de las alfas" value={energy} min={RF_LIMITS.energy[0]} max={RF_LIMITS.energy[1]} step={0.5} unit="MeV" decimals={1} onChange={setEnergy} />
              <Slider label="Espesor de la lámina" value={thickness} min={RF_LIMITS.thickness[0]} max={RF_LIMITS.thickness[1]} step={0.1} unit="µm" decimals={1} onChange={setThickness} />
              <Slider label="Ángulo del detector" value={theta} min={RF_LIMITS.angle[0]} max={RF_LIMITS.angle[1]} step={2.5} unit="°" decimals={1} onChange={setTheta} />
              <Slider label="Tiempo de conteo" value={timeS} min={RF_LIMITS.time[0]} max={RF_LIMITS.time[1]} step={10} unit="s" decimals={0} onChange={setTimeS} />
            </div>
            <div className="card stack">
              <h3>Conteo</h3>
              <SimControls title="Detector de centelleo" status={status} startLabel="Contar centelleos" repeatLabel="Contar otra vez"
                onStart={start} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset}
                progress={run ? { value: t, max: run.timeS, unit: 's', label: 't' } : undefined} />
              <RecordButton onRecord={recordCounts} disabled={!finished} />
            </div>
            <Notice>Cada conteo es aleatorio (estadística de Poisson): repite el mismo ángulo y compara. El reloj del detector va 10 veces más rápido que el real.</Notice>
          </>
        ) : (
          <div className="card stack">
            <h3>Transición del electrón</h3>
            <Select label="Nivel de partida" value={String(nUpper)} onChange={(v) => { const n = Number(v); setNUpper(n); if (nLower >= n) setNLower(n - 1); }} options={[2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `n = ${n} (${fmt(bohrEnergy(n), 3)} eV)` }))} />
            <Select label="Nivel de llegada" value={String(nLower)} onChange={(v) => setNLower(Number(v))} options={[1, 2, 3].filter((n) => n < nUpper).map((n) => ({ value: String(n), label: `n = ${n} (serie de ${transition(nUpper, n).series})` }))} />
            <button type="button" className="btn primary" onClick={() => { setEmitted(true); playSound('click', { intensity: 0.5 }); }}>Emitir el fotón</button>
            <RecordButton onRecord={recordLine} disabled={!emitted} />
            <Notice>Eₙ = −13,598 eV/n² (la energía de ionización del hidrógeno medida por el NIST). λ = h·c/E, dada en aire para compararla con las líneas del NIST.</Notice>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BACKGROUNDS, beetlePositions, beetleSample, findBackground, histogram, INITIAL_MEAN, SEL_LIMITS, simulateSelection,
} from '../models/selection';
import { Chart } from '../components/Chart';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

const MAX_GEN = SEL_LIMITS.generations[1];
const N_BEETLES = 40;
const BINS = 20;

/** Color real (pigmento) para un valor 0 (claro) a 1 (oscuro): mezcla entre crema y pardo casi negro. */
function pigment(z: number): string {
  const t = Math.min(1, Math.max(0, z));
  const light = [233, 220, 190], dark = [38, 30, 26];
  const c = light.map((l, i) => Math.round(l + (dark[i] - l) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function Beetle({ x, y, angle, z }: { x: number; y: number; angle: number; z: number }) {
  const fill = pigment(z);
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      {[-6, 0, 6].map((dy) => (
        <g key={dy}>
          <line x1={-5} y1={dy} x2={-12} y2={dy + (dy === 0 ? 0 : dy > 0 ? 3 : -3)} stroke={fill} strokeWidth="1.6" />
          <line x1={5} y1={dy} x2={12} y2={dy + (dy === 0 ? 0 : dy > 0 ? 3 : -3)} stroke={fill} strokeWidth="1.6" />
        </g>
      ))}
      <ellipse cx="0" cy="2" rx="7" ry="10" fill={fill} stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
      <circle cx="0" cy="-10" r="4" fill={fill} stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
      <line x1="0" y1="-7" x2="0" y2="12" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
    </g>
  );
}

export default function SelectionLab({ api }: LabProps) {
  const [bg, setBg] = useState('volcanico');
  const [predation, setPredation] = useState(60);
  const [h2, setH2] = useState(0.5);
  const [sigma, setSigma] = useState(0.15);
  const [gens, setGens] = useState(0);
  const [anim, setAnim] = useState<{ from: number; to: number } | null>(null);
  const [progress, setProgress] = useState(1);
  const raf = useRef(0);

  const sim = useMemo(
    () => simulateSelection({ backgroundId: bg, predation, heritability: h2, variation: sigma, generations: gens }),
    [bg, predation, h2, sigma, gens],
  );
  const positions = useMemo(() => beetlePositions(N_BEETLES, 2024), []);
  const background = findBackground(bg);

  const resetPopulation = () => { cancelAnimationFrame(raf.current); setAnim(null); setProgress(1); setGens(0); };
  const change = (fn: () => void) => { fn(); resetPopulation(); };
  const advance = (k: number) => {
    const to = Math.min(MAX_GEN, gens + k);
    if (to === gens) return;
    setAnim({ from: gens, to });
    setGens(to);
  };

  useEffect(() => {
    if (!anim) return;
    if (prefersReducedMotion()) { setProgress(1); return; }
    setProgress(0);
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, now - start) / duration);
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [anim]);

  const last = sim.history.length - 1;
  const at = (g: number) => sim.history[Math.min(last, Math.max(0, g))];
  const from = anim ? at(anim.from) : at(last);
  const to = at(last);
  const t = anim ? progress : 1;
  const shownMean = lerp(from.mean, to.mean, t);
  const shownB = lerp(from.background, to.background, t);

  const sample = useMemo(() => beetleSample(shownMean, sigma, N_BEETLES), [shownMean, sigma]);
  const hist = useMemo(() => histogram(shownMean, sigma, BINS), [shownMean, sigma]);
  const meanSeries = useMemo(() => [
    { label: 'Color medio de la población (z̄)', color: 'var(--bio)', kind: 'both' as const, points: sim.history.map((h) => ({ x: h.generation, y: h.mean })) },
    { label: 'Color del fondo (B)', color: 'var(--ink-2)', kind: 'line' as const, dashed: true, points: sim.history.map((h) => ({ x: h.generation, y: h.background })) },
  ], [sim]);

  const measured = gens > 0;
  const record = () => api.addTrial('generaciones', {
    fondo: background.short, depredacion: predation, heredabilidad: h2, variacion: sigma, generaciones: gens,
    colorMedio: sim.finalMeanReading, cambio: sim.changeReading, supervivencia: sim.lastSurvivalPercent,
  });

  const W = 520, H = 300, padX = 20, padY = 34;
  const hW = 520, hH = 170, hm = { l: 40, r: 12, t: 14, b: 40 };
  const hMax = Math.max(0.25, ...hist);
  const hx = (z: number) => hm.l + z * (hW - hm.l - hm.r);
  const hy = (f: number) => hH - hm.b - (f / hMax) * (hH - hm.t - hm.b);
  const bgFill = pigment(shownB);
  const darkBg = shownB > 0.55;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="sel-t sel-d">
            <title id="sel-t">Muestra de 40 escarabajos sobre el fondo donde viven</title>
            <desc id="sel-d">{`Fondo: ${background.short.toLowerCase()}, de color ${fmt(shownB, 2)} en una escala de 0 (claro) a 1 (oscuro). Generación ${gens}. ${measured ? `Los escarabajos tienen color medio ${fmt(sim.finalMeanReading, 3)}.` : `Los escarabajos empiezan con color medio ${fmt(INITIAL_MEAN, 2)}: más claros que el fondo cuando este es oscuro.`}`}</desc>
            <rect x="0" y="0" width={W} height={H} fill={bgFill} />
            {/* Textura de corteza o suelo, del mismo tono */}
            {Array.from({ length: 14 }, (_, i) => (
              <path key={i} d={`M${20 + i * 36} 0 q ${i % 2 ? 8 : -8} ${H / 2} 0 ${H}`} fill="none" stroke={darkBg ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'} strokeWidth="3" />
            ))}
            {positions.map((p, i) => (
              <Beetle key={i} x={padX + p.x * (W - 2 * padX)} y={padY + p.y * (H - padY - 14)} angle={p.angle} z={sample[i]} />
            ))}
            <rect x="8" y="6" width="300" height="22" rx="6" fill="var(--surface)" opacity="0.92" />
            <text x="16" y="21" style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>{`${background.short} · B = ${fmt(shownB, 2)} · gen. ${anim && t < 1 ? Math.round(lerp(anim.from, anim.to, t)) : gens}`}</text>
          </svg>
        </div>
        <Readout items={[
          { k: 'Generación', v: String(gens) },
          { k: 'Color del fondo B', v: fmt(at(last).background, 2) },
          { k: 'Color medio z̄', v: measured ? fmt(sim.finalMeanReading, 3) : `${fmt(INITIAL_MEAN, 3)} (inicial)`, data: true },
          { k: 'Cambio desde el inicio', v: measured ? fmt(sim.changeReading, 3) : 'avanza', data: true },
          { k: 'Diferencial S (última gen.)', v: measured ? fmt(sim.lastS, 4) : 'avanza', data: true },
          { k: 'Respuesta R = h²·S', v: measured ? fmt(sim.lastR, 4) : 'avanza', data: true },
          { k: 'Supervivencia (última gen.)', v: measured ? `${fmt(sim.lastSurvivalPercent, 1)} %` : 'avanza', data: true },
        ]} />
        <div className="card">
          <svg viewBox={`0 0 ${hW} ${hH}`} role="img" aria-labelledby="selh-t selh-d" style={{ width: '100%', height: 'auto' }}>
            <title id="selh-t">Histograma del color en la población</title>
            <desc id="selh-d">{`Fracción de escarabajos en cada intervalo de color de 0 a 1. Línea discontinua: color del fondo (${fmt(shownB, 2)}). Línea continua: color medio de la población.`}</desc>
            {hist.map((f, i) => {
              const x0 = hx(i / BINS), x1 = hx((i + 1) / BINS);
              return <rect key={i} x={x0 + 1} y={hy(f)} width={Math.max(0, x1 - x0 - 2)} height={Math.max(0, hH - hm.b - hy(f))} fill={pigment((i + 0.5) / BINS)} stroke="var(--line)" strokeWidth="1" />;
            })}
            <line x1={hm.l} x2={hW - hm.r} y1={hH - hm.b} y2={hH - hm.b} stroke="var(--ink-2)" />
            <line x1={hm.l} x2={hm.l} y1={hm.t} y2={hH - hm.b} stroke="var(--ink-2)" />
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
              <text key={v} x={hx(v)} y={hH - hm.b + 15} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{fmt(v, 1)}</text>
            ))}
            <text x={hm.l} y={hH - 6} style={{ fontSize: 11, fill: 'var(--ink-2)' }}>claro</text>
            <text x={hW - hm.r} y={hH - 6} textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>oscuro</text>
            <text x={(hm.l + hW - hm.r) / 2} y={hH - 6} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)' }}>Color del escarabajo (z)</text>
            <text transform={`translate(14 ${(hm.t + hH - hm.b) / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Fracción</text>
            <line x1={hx(shownB)} x2={hx(shownB)} y1={hm.t} y2={hH - hm.b} stroke="var(--warn)" strokeWidth="2.5" strokeDasharray="6 4" />
            <text x={hx(shownB)} y={hm.t - 2} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700 }}>fondo</text>
            <line x1={hx(Math.min(1, Math.max(0, shownMean)))} x2={hx(Math.min(1, Math.max(0, shownMean)))} y1={hm.t + 12} y2={hH - hm.b} stroke="var(--bio)" strokeWidth="2.5" />
          </svg>
        </div>
        <Chart
          title="Color medio de la población en cada generación"
          xLabel="Generación" yLabel="Color (0 claro – 1 oscuro)"
          series={meanSeries}
          xDomain={[0, Math.max(10, gens)]} yDomain={[0, 1]}
          height={260}
        />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Ambiente y población</h3>
          <Select label="Ambiente (fondo)" value={bg} onChange={(v) => change(() => setBg(v))} options={BACKGROUNDS.map((b) => ({ value: b.id, label: b.name }))} />
          <Slider label="Intensidad de depredación" value={predation} min={SEL_LIMITS.predation[0]} max={SEL_LIMITS.predation[1]} step={5} unit="%" decimals={0} onChange={(v) => change(() => setPredation(v))} hint="Porcentaje de escarabajos muy visibles que cazan las aves en cada generación." />
          <Slider label="Heredabilidad h²" value={h2} min={0} max={1} step={0.05} decimals={2} onChange={(v) => change(() => setH2(v))} hint="Fracción de la variación del color que se debe a los genes y pasa a la descendencia." />
          <Slider label="Variación del color" value={sigma} min={SEL_LIMITS.variation[0]} max={SEL_LIMITS.variation[1]} step={0.01} decimals={2} onChange={(v) => change(() => setSigma(v))} hint="Desviación estándar σ del color en la población." />
          <Notice>Cambiar un control reinicia la población (color medio 0,30).</Notice>
        </div>
        <div className="card stack">
          <h3>Generaciones</h3>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => advance(1)} disabled={gens >= MAX_GEN}>Avanzar 1 generación</button>
            <button type="button" className="btn" onClick={() => advance(10)} disabled={gens >= MAX_GEN}>Avanzar 10 generaciones</button>
            <button type="button" className="btn" onClick={resetPopulation} disabled={gens === 0}>Reiniciar población</button>
          </div>
          {gens >= MAX_GEN && <Notice kind="warn">Llegaste al máximo de {MAX_GEN} generaciones. Reinicia la población para otro ensayo.</Notice>}
          <RecordButton onRecord={record} disabled={!measured} />
        </div>
        <Notice>Modelo determinista: población muy grande (sin deriva) y color de herencia poligénica. Las aves cazan por contraste con el fondo; la descendencia cambia R = h²·S respecto a sus padres.</Notice>
      </div>
    </div>
  );
}

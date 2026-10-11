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

/** Escarabajo visto desde arriba: patas articuladas, pronoto, élitros con sutura y brillo. */
function Beetle({ x, y, angle, z }: { x: number; y: number; angle: number; z: number }) {
  const fill = pigment(z);
  const edge = z > 0.6 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.35)';
  const leg = pigment(Math.min(1, z + 0.18));
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      {[-5, 1, 7].map((dy, k) => (
        <g key={dy} stroke={leg} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M-5 ${dy} L-10 ${dy + (k - 1) * 3 - 1} L-13 ${dy + (k - 1) * 5 + 1}`} />
          <path d={`M5 ${dy} L10 ${dy + (k - 1) * 3 - 1} L13 ${dy + (k - 1) * 5 + 1}`} />
        </g>
      ))}
      <path d="M-1.5 -12.5 Q -4 -17 -6.5 -18.5 M1.5 -12.5 Q 4 -17 6.5 -18.5" stroke={leg} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <ellipse cx="0.6" cy="3.6" rx="7.6" ry="10.4" fill="rgba(0,0,0,0.22)" />
      <path d="M-7 -1 Q -7.6 11 0 13 Q 7.6 11 7 -1 Q 6.6 -4 0 -4 Q -6.6 -4 -7 -1 Z" fill={fill} stroke={edge} strokeWidth="0.8" />
      <path d="M-5.6 -6.5 Q -6 -3 -5 -3.6 L5 -3.6 Q 6 -3 5.6 -6.5 Q 4.6 -9.2 0 -9.2 Q -4.6 -9.2 -5.6 -6.5 Z" fill={fill} stroke={edge} strokeWidth="0.8" />
      <ellipse cx="0" cy="-11" rx="3" ry="2.3" fill={fill} stroke={edge} strokeWidth="0.7" />
      <path d="M0 -3.6 V 12.8" stroke={edge} strokeWidth="0.8" />
      <path d="M-5.4 0 Q -5.8 6 -3 10" stroke="url(#sel-gloss)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="-2.2" cy="-7" rx="1.8" ry="0.9" fill="#fff" opacity="0.28" />
    </g>
  );
}

/** Textura del fondo según el ambiente, con trazos claros/oscuros relativos al color base. */
function Ground({ kind, W, H, dark }: { kind: string; W: number; H: number; dark: boolean }) {
  const hi = dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.35)';
  const lo = dark ? 'rgba(0,0,0,0.35)' : 'rgba(60,40,20,0.12)';
  const marks = useMemo(() => {
    const frac = (v: number) => v - Math.floor(v);
    return Array.from({ length: 70 }, (_, i) => ({
      x: frac(Math.sin(i * 12.99 + 4.1) * 43758.5) * W,
      y: frac(Math.sin(i * 78.23 + 1.3) * 24634.6) * H,
      r: 1 + frac(Math.sin(i * 3.7) * 9631.3) * 5,
      a: frac(Math.sin(i * 5.1) * 7351.7) * 180,
    }));
  }, [W, H]);
  if (kind === 'hojarasca') {
    return (
      <g aria-hidden="true">
        {marks.slice(0, 38).map((m, i) => (
          <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.a}) scale(${0.8 + m.r / 5})`}>
            <path d="M-12 0 Q -4 -7 12 0 Q -4 7 -12 0 Z" fill={i % 2 ? hi : lo} />
            <path d="M-11 0 H 11" stroke={i % 2 ? lo : hi} strokeWidth="0.7" />
          </g>
        ))}
      </g>
    );
  }
  if (kind === 'volcanico') {
    return (
      <g aria-hidden="true">
        {marks.map((m, i) => (
          <ellipse key={i} cx={m.x} cy={m.y} rx={m.r} ry={m.r * 0.7} transform={`rotate(${m.a} ${m.x} ${m.y})`} fill={i % 3 ? lo : hi} />
        ))}
      </g>
    );
  }
  // corteza (clara o con hollín): grietas verticales onduladas y placas
  return (
    <g aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => {
        const x0 = 14 + i * 33;
        return (
          <path key={i} d={`M${x0} 0 C ${x0 + (i % 2 ? 10 : -10)} ${H * 0.3} ${x0 + (i % 2 ? -8 : 8)} ${H * 0.6} ${x0 + (i % 3) * 3} ${H}`} fill="none" stroke={lo} strokeWidth={2 + (i % 3)} strokeLinecap="round" />
        );
      })}
      {Array.from({ length: 16 }, (_, i) => (
        <path key={`h${i}`} d={`M${18 + i * 33} 0 C ${26 + i * 33} ${H * 0.35} ${12 + i * 33} ${H * 0.65} ${22 + i * 33} ${H}`} fill="none" stroke={hi} strokeWidth="1.2" />
      ))}
    </g>
  );
}

/** Ave insectívora posada en el borde (representa a los depredadores). */
function Bird({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <path d="M-26 22 H 26" stroke="#5b4636" strokeWidth="4" strokeLinecap="round" />
      <path d="M8 6 L 24 18 L 18 20 Z" fill="#3b3f46" />
      <ellipse cx="0" cy="6" rx="12" ry="9" fill="#5d6670" />
      <ellipse cx="-2" cy="9" rx="7" ry="5.5" fill="#e9d9b8" />
      <path d="M2 2 Q 14 0 16 10 Q 8 9 2 2 Z" fill="#454c55" />
      <circle cx="-9" cy="-4" r="6.5" fill="#5d6670" />
      <circle cx="-11" cy="-5.5" r="1.6" fill="#fff" />
      <circle cx="-11.3" cy="-5.5" r="0.9" fill="#111" />
      <path d="M-15 -4 L -22 -2.5 L -15 -1 Z" fill="#e0a42b" />
      <path d="M-3 14 V 21 M2 14 V 21" stroke="#c38b2c" strokeWidth="1.4" />
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
            <defs>
              <linearGradient id="sel-gloss" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="sel-vignette" cx="0.5" cy="0.5" r="0.75">
                <stop offset="0.6" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity="0.22" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width={W} height={H} fill={bgFill} />
            <Ground kind={bg === 'hollin' ? 'corteza' : bg} W={W} H={H} dark={darkBg} />
            <rect x="0" y="0" width={W} height={H} fill="url(#sel-vignette)" />
            {positions.map((p, i) => (
              <Beetle key={i} x={padX + p.x * (W - 2 * padX)} y={padY + p.y * (H - padY - 14)} angle={p.angle} z={sample[i]} />
            ))}
            <Bird x={W - 34} y={10} />
            <rect x="8" y="6" width="300" height="24" rx="12" fill="var(--surface)" opacity="0.94" />
            <text x="18" y="22" style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>{`${background.short} · B = ${fmt(shownB, 2)} · gen. ${anim && t < 1 ? Math.round(lerp(anim.from, anim.to, t)) : gens}`}</text>
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

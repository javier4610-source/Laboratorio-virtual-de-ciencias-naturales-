import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyze, BUDGET, causalReflection, collect, CONFOUND_LABEL, critiqueDesign, DESIGN_LIMITS, designLevels, SYSTEM_IDS, SYSTEMS,
  type ConfoundMode, type CritiqueItem, type Design, type Sample, type SystemDef, type SystemId,
} from '../models/inquiry';
import { fmt } from '../lib/format';
import { formatWithUncertainty } from '../lib/fit';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import { Chart, type ChartPoint } from '../components/Chart';
import type { LabProps } from './registry';
import { BenchTop, ContactShadow, Lcd } from './kit';

/* ------------------------------------------------------------------ utilidades */

type Phase = 'diseno' | 'recolectando' | 'recolectado';
type Axis = 'x' | 'orden';

/** Primer diseño (mejorable a propósito) de cada sistema. */
const DEFAULTS: Record<SystemId, { min: number; max: number }> = { rio: { min: 0, max: 10 }, suelo: { min: 0, max: 30 }, lluvia: { min: 0, max: 20 } };
const STEP_S = 0.22; // s por muestra en la animación
const MAX_ANIM_S = 3;

const signed = (s: string) => s.replace('-', '−');
const nextSeed = (s: number) => ((s * 37 + 11) % DESIGN_LIMITS.seed[1]) + 1;
const SEVERITY_LABEL: Record<CritiqueItem['severity'], string> = { ok: 'Bien', info: 'Nota', warn: 'Mejorable', bad: 'Problema' };

/* ------------------------------------------------------------------ escena */

const W = 720, H = 360, SX0 = 70, SX1 = 650;

function sceneX(sys: SystemDef, x: number) {
  const [a, b] = sys.x.range;
  return SX0 + ((x - a) / (b - a)) * (SX1 - SX0);
}

function BananaPlant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <path d="M-3 0 L-2 -46 L2 -46 L3 0 Z" fill="#7a8f3c" stroke="#56692a" strokeWidth="0.8" />
      <path d="M0 -44 Q -22 -62 -38 -50 Q -20 -50 0 -40 Z" fill="#4e9a3a" stroke="#2f6b22" strokeWidth="0.8" />
      <path d="M0 -44 Q 22 -64 40 -52 Q 20 -50 0 -40 Z" fill="#5aa845" stroke="#2f6b22" strokeWidth="0.8" />
      <path d="M0 -46 Q -6 -72 4 -80 Q 4 -62 2 -46 Z" fill="#6bb553" stroke="#2f6b22" strokeWidth="0.8" />
      <path d="M0 -42 Q -16 -36 -26 -24 Q -12 -30 0 -38 Z" fill="#3f8a2f" stroke="#2f6b22" strokeWidth="0.6" />
    </g>
  );
}

/** Medidor de campo con pantalla LCD (oxímetro, termómetro de suelo o turbidímetro). */
function FieldMeter({ x, y, title, reading }: { x: number; y: number; title: string; reading: string }) {
  return (
    <g>
      <ContactShadow x={x} y={y + 92} w={170} h={8} />
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={170} height={92} rx={12} fill="url(#kit-body-dark)" stroke="#2b3438" />
        <rect x={x + 6} y={y + 6} width={158} height={80} rx={9} fill="none" stroke="#fff" strokeOpacity="0.12" />
      </g>
      <Lcd x={x + 14} y={y + 16} w={142} h={38} text={reading} />
      <text x={x + 85} y={y + 76} textAnchor="middle" style={{ fontSize: 10, fill: '#e3e9ea', fontWeight: 600 }}>{title}</text>
    </g>
  );
}

function Scene({ sys, levels, replicates, samples, shown, phase, seed }: {
  sys: SystemDef; levels: number[]; replicates: number; samples: Sample[]; shown: number; phase: Phase; seed: number;
}) {
  const visible = samples.slice(0, shown);
  const last = visible[visible.length - 1];
  const done = (lv: number) => visible.filter((s) => s.x === lv).length;
  const reading = last ? fmt(last.y, sys.y.decimals) : '- - -';
  const meterTitle = sys.id === 'rio' ? 'Oxímetro de campo' : sys.id === 'suelo' ? 'Termómetro de suelo' : 'Turbidímetro';
  const sceneTop = 34, sceneBottom = 214;

  const desc = `${sys.name}. Diseño: ${levels.length} niveles de ${sys.x.label.toLowerCase()} (${levels.map((v) => fmt(v, sys.x.decimals)).join(', ')} ${sys.x.unit}) con ${replicates} réplicas. ` +
    (phase === 'diseno' ? 'Aún no se han recolectado datos.' : `Muestras recolectadas: ${shown} de ${samples.length}.${last ? ` Última lectura: ${fmt(last.y, sys.y.decimals)} ${sys.y.unit}.` : ''} Datos sintéticos generados por un modelo calculado (semilla ${seed}).`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="rti-t rti-d">
      <title id="rti-t">{`Escena del reto de indagación: ${sys.name.toLowerCase()}`}</title>
      <desc id="rti-d">{desc}</desc>
      <defs>
        <linearGradient id="rti-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#cfe6f5" />
          <stop offset="1" stopColor="#eef6e4" />
        </linearGradient>
        <linearGradient id="rti-water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5fa3cf" />
          <stop offset="1" stopColor="#3f86b8" />
        </linearGradient>
        <linearGradient id="rti-soil" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#9a6f46" />
          <stop offset="1" stopColor="#6e4b2c" />
        </linearGradient>
        <linearGradient id="rti-muddy" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#a88a5c" />
          <stop offset="1" stopColor="#7d6440" />
        </linearGradient>
      </defs>

      <g filter="url(#kit-shadow-soft)">
        <rect x={10} y={sceneTop - 24} width={700} height={sceneBottom - sceneTop + 24} rx={10} fill="url(#rti-sky)" stroke="var(--line)" />
      </g>
      <text x={22} y={sceneTop - 6} style={{ fontSize: 12, fill: '#1f3b2a', fontWeight: 700 }}>{sys.name} · escena esquemática</text>

      {/* ---------- río con vertimiento */}
      {sys.id === 'rio' && (
        <g>
          <rect x={10} y={110} width={700} height={60} fill="url(#rti-water)" />
          <path d="M10 110 Q 180 102 360 110 T 710 110" fill="none" stroke="#2f6f99" strokeWidth="1.2" />
          <path d="M10 170 Q 180 178 360 170 T 710 170" fill="none" stroke="#2f6f99" strokeWidth="1.2" />
          <rect x={10} y={170} width={700} height={44} fill="#b5d39a" />
          <rect x={10} y={66} width={700} height={44} fill="#cfe3b4" />
          {(() => {
            const x0 = sceneX(sys, 0);
            return (
              <g>
                <rect x={x0} y={110} width={SX1 - x0 + 60} height={60} fill="#6b5a3a" opacity="0.18" />
                <path d={`M${x0} 72 L${x0} 112`} stroke="#5b6466" strokeWidth="6" strokeLinecap="round" />
                <path d={`M${x0} 72 L${x0} 112`} stroke="#9aa5a9" strokeWidth="2" />
                <text x={x0 + 8} y={82} style={{ fontSize: 10, fill: '#1f3b2a', fontWeight: 600 }}>Vertimiento (km 0)</text>
              </g>
            );
          })()}
          <text x={24} y={126} style={{ fontSize: 10, fill: '#0f2f45', fontWeight: 600 }}>Corriente →</text>
        </g>
      )}

      {/* ---------- plantación de banano con parcelas de sombra */}
      {sys.id === 'suelo' && (
        <g>
          <circle cx={48} cy={58} r={16} fill="#ffd54f" stroke="#e0a800" />
          <rect x={10} y={150} width={700} height={64} fill="url(#rti-soil)" />
          <g opacity="0.75">{[100, 230, 360, 490, 620].map((bx, i) => <BananaPlant key={bx} x={bx + 50} y={150} s={i % 2 ? 0.8 : 0.9} />)}</g>
        </g>
      )}

      {/* ---------- quebrada después de la lluvia */}
      {sys.id === 'lluvia' && (
        <g>
          <path d="M10 120 L250 120 Q 300 190 360 192 Q 420 190 470 120 L710 120 L710 214 L10 214 Z" fill="#7aa35a" />
          <path d="M250 120 Q 300 190 360 192 Q 420 190 470 120 Z" fill={last ? 'url(#rti-muddy)' : 'url(#rti-water)'} opacity="0.9" />
          {Array.from({ length: 22 }, (_, i) => (
            <line key={i} x1={30 + i * 31} x2={24 + i * 31} y1={44 + (i % 3) * 8} y2={60 + (i % 3) * 8} stroke="#5d86a6" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
          ))}
          <text x={360} y={208} textAnchor="middle" style={{ fontSize: 10, fill: '#1f3b2a' }}>Punto de muestreo fijo en la quebrada</text>
        </g>
      )}

      {/* ---------- niveles del diseño (estaciones, parcelas o eventos de lluvia) */}
      {levels.map((lv) => {
        const cx = sceneX(sys, lv);
        const n = done(lv);
        const baseY = sys.id === 'rio' ? 140 : sys.id === 'suelo' ? 150 : 100;
        return (
          <g key={lv}>
            {sys.id === 'suelo' && (
              <g>
                <rect x={cx - 26} y={100} width={52} height={8} rx={2} fill="#1f2a24" opacity={0.15 + 0.75 * (lv / 100)} stroke="#1f2a24" strokeWidth="0.6" />
                <line x1={cx - 24} x2={cx - 24} y1={108} y2={150} stroke="#6d5a3a" strokeWidth="1.6" />
                <line x1={cx + 24} x2={cx + 24} y1={108} y2={150} stroke="#6d5a3a" strokeWidth="1.6" />
                <rect x={cx - 24} y={150} width={48} height={6} fill="#5b3f24" opacity={0.25 + 0.5 * (lv / 100)} />
              </g>
            )}
            {sys.id === 'lluvia' && (
              <g>
                <rect x={cx - 7} y={76} width={14} height={34} rx={2} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" />
                <rect x={cx - 5} y={108 - 30 * (lv / sys.x.range[1])} width={10} height={30 * (lv / sys.x.range[1])} fill="#4f9fe0" opacity="0.6" />
                <path d={`M${cx - 10} 76 L${cx + 10} 76 L${cx + 6} 70 L${cx - 6} 70 Z`} fill="url(#kit-metal)" stroke="#8c979b" strokeWidth="0.6" />
              </g>
            )}
            {sys.id === 'rio' && <line x1={cx} x2={cx} y1={baseY} y2={baseY - 46} stroke="#1d2b33" strokeWidth="1.2" />}
            {sys.id === 'rio' && <path d={`M${cx} ${baseY - 46} l14 5 l-14 5 Z`} fill="#ffd54f" stroke="#1d2b33" strokeWidth="0.8" />}
            {Array.from({ length: replicates }, (_, r) => (
              <circle key={r} cx={cx - (replicates - 1) * 4 + r * 8} cy={sys.id === 'lluvia' ? 124 : sys.id === 'suelo' ? 168 : baseY} r={3.2}
                fill={r < n ? 'var(--series-1)' : '#ffffff'} stroke="#1d2b33" strokeWidth="0.9" />
            ))}
            <text x={cx} y={sys.id === 'lluvia' ? 140 : sys.id === 'suelo' ? 186 : 184} textAnchor="middle"
              style={{ fontSize: 10, fill: '#1d2b33', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{signed(fmt(lv, sys.x.decimals))} {sys.x.unit}</text>
          </g>
        );
      })}

      {/* ---------- mesa con el medidor */}
      <BenchTop y={326} width={W} />
      <FieldMeter x={40} y={232} title={`${meterTitle} (${sys.y.unit})`} reading={reading} />
      <g>
        <rect x={236} y={238} width={444} height={82} rx={8} fill="var(--surface)" stroke="var(--line)" />
        <text x={250} y={258} style={{ fontSize: 11, fill: 'var(--ink-2)', fontWeight: 700 }}>Cuaderno de campo</text>
        <text x={250} y={278} style={{ fontSize: 11, fill: 'var(--ink)' }}>
          {phase === 'diseno' ? `Plan: ${levels.length} niveles × ${replicates} réplicas = ${levels.length * replicates} muestras` : `Muestras: ${shown} de ${samples.length}`}
        </text>
        <text x={250} y={296} style={{ fontSize: 11, fill: 'var(--ink)' }}>
          {last ? `Muestra ${last.order}: x = ${fmt(last.x, sys.x.decimals)} ${sys.x.unit}; ${sys.confound.label.toLowerCase()} = ${fmt(last.confound, sys.confound.decimals)} ${sys.confound.unit}` : 'Sin lecturas todavía'}
        </text>
        <text x={250} y={313} style={{ fontSize: 10, fill: 'var(--warn)', fontWeight: 700 }}>
          {phase === 'diseno' ? 'Los datos serán sintéticos (modelo calculado con ruido).' : `Datos sintéticos generados por un modelo calculado (semilla ${seed})`}
        </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function InquiryLab({ api }: LabProps) {
  const [system, setSystem] = useState<SystemId>('rio');
  const [levels, setLevels] = useState(3);
  const [min, setMin] = useState(DEFAULTS.rio.min);
  const [max, setMax] = useState(DEFAULTS.rio.max);
  const [replicates, setReplicates] = useState(2);
  const [confound, setConfound] = useState<ConfoundMode>('sin-control');
  const [seed, setSeed] = useState(123);
  const [phase, setPhase] = useState<Phase>('diseno');
  const [run, setRun] = useState<{ design: Design; samples: Sample[] } | null>(null);
  const [shown, setShown] = useState(0);
  const [axis, setAxis] = useState<Axis>('x');
  const [savedRun, setSavedRun] = useState<Design | null>(null);
  const raf = useRef(0);

  const sys = SYSTEMS[system];
  const design: Design = useMemo(() => ({ system, levels, min, max, replicates, confound, seed }), [system, levels, min, max, replicates, confound, seed]);
  const plan = useMemo(() => {
    try { return { levels: designLevels(design), error: '' }; }
    catch (e) { return { levels: [] as number[], error: (e as Error).message }; }
  }, [design]);
  const planned = plan.levels.length * replicates;
  const overBudget = planned > BUDGET;

  const reset = () => { cancelAnimationFrame(raf.current); setPhase('diseno'); setRun(null); setShown(0); };
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); reset(); };

  const chooseSystem = (id: SystemId) => {
    setSystem(id); setMin(DEFAULTS[id].min); setMax(DEFAULTS[id].max); setAxis('x'); reset();
  };

  useEffect(() => {
    if (phase !== 'recolectando' || !run) return;
    const n = run.samples.length;
    if (prefersReducedMotion()) { setShown(n); setPhase('recolectado'); return; }
    const per = Math.min(STEP_S, MAX_ANIM_S / n);
    const start = performance.now();
    const tick = (now: number) => {
      const el = Math.max(0, (now - start) / 1000);
      const k = Math.min(n, Math.floor(el / per) + 1);
      setShown(k);
      if (k >= n) { setPhase('recolectado'); playSound('beep'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, run]);

  const start = () => {
    if (plan.error || overBudget) return;
    const samples = collect(design);
    setRun({ design, samples }); setShown(0); setPhase('recolectando');
  };

  const collected = phase === 'recolectado' && run !== null;
  const samples = run?.samples ?? [];
  const visible = samples.slice(0, shown);
  const analysis = useMemo(() => (collected && run ? analyze(run.samples) : null), [collected, run]);
  const critique = useMemo(() => (collected && run && analysis ? critiqueDesign(run.design, run.samples, analysis) : []), [collected, run, analysis]);
  const reflection = useMemo(() => (collected && run && analysis ? causalReflection(run.design, analysis) : []), [collected, run, analysis]);

  const record = () => {
    if (!run) return;
    const s = SYSTEMS[run.design.system];
    for (const smp of run.samples) {
      api.addTrial(run.design.system, {
        [s.x.key]: smp.x,
        confusion: CONFOUND_LABEL[run.design.confound],
        semilla: String(run.design.seed),
        replica: String(smp.replicate),
        orden: smp.order,
        [s.confound.key]: smp.confound,
        [s.y.key]: smp.y,
      });
    }
    setSavedRun(run.design);
  };
  const alreadySaved = savedRun !== null && run !== null && savedRun === run.design;

  const yu = sys.y.unit, xu = sys.x.unit;
  const slopeUnit = `${yu} por ${xu === '%' ? 'punto de %' : xu}`;
  const scatter: ChartPoint[] = useMemo(() => visible.map((s) => ({ x: axis === 'x' ? s.x : s.order, y: s.y, label: `muestra ${s.order}` })), [visible, axis]);
  const means: ChartPoint[] = useMemo(() => (analysis && axis === 'x'
    ? analysis.levels.map((l) => ({ x: l.x, y: l.mean, ey: Number.isFinite(l.sem) ? l.sem : undefined, label: `media de ${fmt(l.x, sys.x.decimals)} ${xu}` }))
    : []), [analysis, axis, sys.x.decimals, xu]);

  const levelText = plan.levels.map((v) => fmt(v, sys.x.decimals)).join(' · ');

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Escena del muestreo y medidor de campo">
          <Scene sys={sys} levels={plan.levels} replicates={replicates} samples={samples} shown={shown} phase={phase} seed={run?.design.seed ?? seed} />
        </div>
        <p className="small muted">
          Escena esquemática (ilustrativa). Durante la recolección, los puntos se llenan en el orden de muestreo calculado; la animación es ilustrativa,
          pero cada lectura de la pantalla es el valor calculado por el modelo con su ruido.
        </p>

        {phase !== 'diseno' && (
          <Notice kind="warn"><strong>Datos sintéticos generados por un modelo calculado (semilla {run?.design.seed ?? seed}).</strong> No son mediciones reales de ningún río, finca o quebrada de Urabá: sirven para practicar el diseño y el análisis. Con la misma semilla y el mismo diseño obtendrás exactamente los mismos datos.</Notice>
        )}

        <Readout items={[
          { k: 'Semilla', v: String(run?.design.seed ?? seed), data: true },
          { k: 'Muestras recolectadas', v: run ? `${shown} de ${samples.length}` : '—', data: true },
          { k: 'Pendiente (ajuste lineal)', v: analysis && Number.isFinite(analysis.slopeSe) ? `${formatWithUncertainty(analysis.slope, analysis.slopeSe)} ${slopeUnit}` : '—', data: true },
          { k: 'Intervalo de 95 % de la pendiente', v: analysis && Number.isFinite(analysis.slopeCi95) ? `${formatWithUncertainty(analysis.slope, analysis.slopeCi95)} ${slopeUnit}` : '—', data: true },
          { k: 'Intercepto', v: analysis && Number.isFinite(analysis.interceptSe) ? `${formatWithUncertainty(analysis.intercept, analysis.interceptSe)} ${yu}` : '—', data: true },
          { k: 'Coeficiente de correlación r', v: analysis && Number.isFinite(analysis.r) ? signed(fmt(analysis.r, 2)) : '—', data: true },
          { k: 'R²', v: analysis && Number.isFinite(analysis.r2) ? fmt(analysis.r2, 2) : '—', data: true },
        ]} />

        {run && shown > 0 && (
          <div className="card stack-sm">
            <h3>Gráfica de los datos sintéticos</h3>
            <Segmented label="Eje horizontal de la gráfica" value={axis} onChange={setAxis}
              options={[{ value: 'x', label: sys.x.label }, { value: 'orden', label: 'Orden de muestreo' }]} />
            <Chart title={`${sys.y.label} (datos sintéticos, semilla ${run.design.seed})`}
              xLabel={axis === 'x' ? `${sys.x.label} (${xu})` : 'Orden de muestreo'} yLabel={`${sys.y.label} (${yu})`}
              xUnit={axis === 'x' ? xu : ''} yUnit={yu} height={260} exportName={`reto-${system}`}
              fit={collected && axis === 'x' ? 'linear' : undefined}
              errorNote="Las barras de las medias indican ± 1 error estándar (DE/√n)."
              series={[
                { label: 'Muestras (datos sintéticos)', color: 'var(--series-1)', kind: 'scatter', points: scatter },
                ...(means.length ? [{ label: 'Media ± EE por nivel', color: 'var(--series-3)', kind: 'scatter' as const, points: means }] : []),
              ]} />
            {axis === 'orden' && <p className="small muted">Si y cambia con el orden de muestreo, alguna condición (hora, temperatura, retraso) pudo variar mientras medías.</p>}
          </div>
        )}

        {collected && analysis && (
          <div className="card stack-sm">
            <h3>Estadística por nivel</h3>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Media, desviación estándar y error estándar de cada nivel">
              <table>
                <caption className="sr-only">Estadística por nivel de la variable independiente</caption>
                <thead><tr><th scope="col">{sys.x.label} ({xu})</th><th scope="col">n</th><th scope="col">Media ({yu})</th><th scope="col">DE ({yu})</th><th scope="col">EE ({yu})</th></tr></thead>
                <tbody>
                  {analysis.levels.map((l) => (
                    <tr key={l.x}>
                      <td>{signed(fmt(l.x, sys.x.decimals))}</td><td>{l.n}</td>
                      <td>{fmt(l.mean, sys.y.decimals + 1)}</td><td>{fmt(l.sd, sys.y.decimals + 1)}</td><td>{fmt(l.sem, sys.y.decimals + 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small">DE: desviación estándar muestral, √(Σ(y − ȳ)²/(n − 1)). EE: error estándar de la media, DE/√n. Con n = 1 no se pueden calcular (—).</p>
          </div>
        )}

        {collected && (
          <div className="card stack-sm">
            <h3>Crítica de tu diseño</h3>
            <p className="small muted">Calculada con tus decisiones y tus datos.</p>
            <ul className="list">
              {critique.map((c) => (
                <li key={c.kind}><span className={`chip ${c.severity === 'info' ? '' : c.severity}`}>{SEVERITY_LABEL[c.severity]}</span> {c.text}</li>
              ))}
            </ul>
          </div>
        )}

        {collected && (
          <div className="card stack-sm">
            <h3>Correlación y causalidad</h3>
            {reflection.map((t) => <p key={t} className="small">{t}</p>)}
          </div>
        )}

        {run && shown > 0 && (
          <details className="card">
            <summary>Tabla de datos sintéticos ({samples.length} muestras)</summary>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Datos sintéticos de cada muestra en el orden de muestreo">
              <table>
                <caption className="sr-only">Muestras en el orden de muestreo: nivel, réplica, variable de confusión y lectura</caption>
                <thead><tr><th scope="col">Orden</th><th scope="col">{sys.x.label} ({xu})</th><th scope="col">Réplica</th><th scope="col">{sys.confound.label} ({sys.confound.unit})</th><th scope="col">{sys.y.label} ({yu})</th></tr></thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.order}>
                      <td>{s.order}</td><td>{signed(fmt(s.x, sys.x.decimals))}</td><td>{s.replicate}</td>
                      <td>{fmt(s.confound, sys.confound.decimals)}</td><td>{fmt(s.y, sys.y.decimals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>1. Pregunta de investigación</h3>
          <Select label="Sistema de estudio" value={system} onChange={(v) => chooseSystem(v as SystemId)}
            options={SYSTEM_IDS.map((id) => ({ value: id, label: SYSTEMS[id].name }))} />
          <p className="small"><strong>Pregunta:</strong> {sys.question}</p>
          <p className="small muted">Estudio {sys.study === 'experimental' ? 'experimental: tú asignas la sombra a cada parcela' : 'observacional: eliges dónde o cuándo medir, no asignas la variable'}.</p>
        </div>

        <div className="card stack">
          <h3>2. Diseño del muestreo</h3>
          <Slider label="Número de niveles" value={levels} min={DESIGN_LIMITS.levels[0]} max={DESIGN_LIMITS.levels[1]} step={1} decimals={0} onChange={change(setLevels)} />
          <Slider label="Nivel mínimo" value={min} min={sys.x.range[0]} max={sys.x.range[1] - sys.x.step} step={sys.x.step} unit={xu} decimals={sys.x.decimals} onChange={change(setMin)}
            hint={sys.id === 'rio' ? 'Valores negativos: aguas arriba del vertimiento (estación de referencia).' : undefined} />
          <Slider label="Nivel máximo" value={max} min={sys.x.range[0] + sys.x.step} max={sys.x.range[1]} step={sys.x.step} unit={xu} decimals={sys.x.decimals} onChange={change(setMax)} />
          <Slider label="Réplicas por nivel" value={replicates} min={DESIGN_LIMITS.replicates[0]} max={DESIGN_LIMITS.replicates[1]} step={1} decimals={0} onChange={change(setReplicates)} />
          <Segmented label={`Manejo de la variable de confusión: ${sys.confound.label.toLowerCase()}`} value={confound} onChange={change(setConfound)}
            options={(['constante', 'aleatorizado', 'sin-control'] as ConfoundMode[]).map((m) => ({ value: m, label: CONFOUND_LABEL[m] }))} />
          <p className="small muted">{sys.confound.description[confound]}</p>
          <div className="stack-sm">
            <Slider label="Semilla" value={seed} min={DESIGN_LIMITS.seed[0]} max={DESIGN_LIMITS.seed[1]} step={1} decimals={0} onChange={change(setSeed)}
              hint="La semilla fija el ruido: con la misma semilla y el mismo diseño se repiten exactamente los datos." />
            <div className="btn-row">
              <button type="button" className="btn small" onClick={() => change(setSeed)(nextSeed(seed))}>Otra semilla</button>
            </div>
          </div>
          <Readout live={false} items={[
            { k: 'Niveles planeados', v: plan.error ? '—' : `${levelText} ${xu}` },
            { k: 'Muestras planeadas', v: `${planned} de ${BUDGET}` },
          ]} />
          <Warnings list={[
            ...(plan.error ? [plan.error] : []),
            ...(overBudget ? [`El diseño pide ${planned} muestras y el presupuesto es de ${BUDGET}: reduce niveles o réplicas.`] : []),
            ...(!plan.error && plan.levels.length < levels ? [`Con ese rango y el paso de ${fmt(sys.x.step, sys.x.decimals)} ${xu}, algunos niveles coinciden: quedan ${plan.levels.length}.`] : []),
          ]} />
        </div>

        <div className="card stack">
          <h3>3. Recolección y registro</h3>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={start} disabled={phase !== 'diseno' || !!plan.error || overBudget}>Recolectar datos</button>
            <button type="button" className="btn" onClick={reset} disabled={phase === 'diseno'}>Rediseñar</button>
          </div>
          <RecordButton onRecord={record} disabled={!collected || alreadySaved} label={`Guardar las ${collected ? samples.length : planned} muestras en la tabla`} />
          {!collected && <p className="small muted">Recolecta los datos para ver el análisis y guardarlos en el cuaderno.</p>}
          {alreadySaved && <p className="small muted">Esta campaña ya está en la tabla. Cambia el diseño o la semilla para recolectar otra.</p>}
        </div>

        <details className="card">
          <summary>Qué se mantiene fijo y cómo se generan los datos</summary>
          <ul className="list small">
            {sys.fixed.map((t) => <li key={t}>{t} (fijo en el modelo).</li>)}
            <li>Ruido de medición: {sys.noise.note}</li>
            <li>Generador pseudoaleatorio mulberry32 con la semilla elegida; ruido normal por el método de Box–Muller.</li>
            <li>Los parámetros del modelo son ilustrativos y no provienen de mediciones de ninguna entidad o estación.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}

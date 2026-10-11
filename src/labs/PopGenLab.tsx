import { useMemo, useState } from 'react';
import { hardyWeinberg, POPGEN_LIMITS, simulatePopGen, type PopGenInput } from '../models/popgen';
import { fmt } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

const SCENARIOS: { id: string; name: string; note: string; patch: Partial<PopGenInput> }[] = [
  { id: 'neutral', name: 'Neutral (Hardy-Weinberg)', note: 'Todos los genotipos tienen la misma eficacia.', patch: { fitness: { AA: 1, Aa: 1, aa: 1 }, mutationAtoa: 0, migration: 0 } },
  { id: 'recesivo', name: 'Selección contra el recesivo (w_aa = 0,5)', note: 'El genotipo aa deja la mitad de descendencia.', patch: { fitness: { AA: 1, Aa: 1, aa: 0.5 }, mutationAtoa: 0, migration: 0 } },
  { id: 'letal', name: 'Recesivo letal (w_aa = 0)', note: 'Los individuos aa no se reproducen.', patch: { fitness: { AA: 1, Aa: 1, aa: 0 }, mutationAtoa: 0, migration: 0 } },
  { id: 'malaria', name: 'Anemia falciforme con malaria', note: 'A = hemoglobina normal (HbA), a = HbS. AA es más susceptible a la malaria; aa tiene anemia falciforme; Aa tiene ventaja. Valores de eficacia ilustrativos.', patch: { p0: 0.99, fitness: { AA: 0.85, Aa: 1, aa: 0.2 }, mutationAtoa: 0, migration: 0, generations: 200 } },
  { id: 'sin-malaria', name: 'Anemia falciforme sin malaria', note: 'Sin malaria, el heterocigoto ya no tiene ventaja frente a AA.', patch: { p0: 0.85, fitness: { AA: 1, Aa: 1, aa: 0.2 }, mutationAtoa: 0, migration: 0, generations: 200 } },
];

const N_OPTIONS = [10, 30, 100, 300, 1000, 5000];

/* ------------------------------------------------------------------ poza génica ilustrada */

const COL_A = 'var(--series-2)';
const COL_a = 'var(--series-1)';

/** Cuenta de individuos AA, Aa y aa entre 100 según Hardy-Weinberg (mayores restos). */
function hwCounts(p: number): [number, number, number] {
  const hw = hardyWeinberg(Math.min(1, Math.max(0, p)));
  const raw = [hw.AA * 100, hw.Aa * 100, hw.aa * 100];
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k++, left--) out[order[k % 3][1]]++;
  return [out[0], out[1], out[2]];
}

/** Individuo estilizado: la mitad izquierda lleva el primer alelo y la derecha el segundo. */
function Person({ x, y, left, right }: { x: number; y: number; left: string; right: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.22)`}>
      <path d="M-6.5 9 Q -6.5 0.5 0 0.5 V 9 Z" fill={left} />
      <path d="M6.5 9 Q 6.5 0.5 0 0.5 V 9 Z" fill={right} />
      <path d="M-4 -4.5 A 4 4 0 0 1 0 -8.5 V -0.5 A 4 4 0 0 1 -4 -4.5 Z" fill={left} />
      <path d="M4 -4.5 A 4 4 0 0 0 0 -8.5 V -0.5 A 4 4 0 0 0 4 -4.5 Z" fill={right} />
      <circle cx="0" cy="-4.5" r="4" fill="none" stroke="var(--surface)" strokeWidth="0.6" opacity="0.6" />
      <circle cx="-1.3" cy="-5.6" r="1.2" fill="#fff" opacity="0.35" />
    </g>
  );
}

function GenePool({ x, title, p }: { x: number; title: string; p: number }) {
  const counts = hwCounts(p);
  const people: [string, string][] = [];
  counts.forEach((c, g) => { for (let i = 0; i < c; i++) people.push(g === 0 ? [COL_A, COL_A] : g === 1 ? [COL_A, COL_a] : [COL_a, COL_a]); });
  const cell = 22, gx = x + 14, gy = 46;
  const pw = 250;
  return (
    <g>
      <rect x={x} y="8" width={pw + 28} height="306" rx="14" fill="var(--surface)" stroke="var(--line)" filter="url(#kit-shadow-soft)" />
      <text x={x + 14} y="31" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--ink)' }}>{title}</text>
      {people.map(([l, r], i) => (
        <Person key={i} x={x + 40 + (i % 10) * cell} y={gy + 12 + Math.floor(i / 10) * cell} left={l} right={r} />
      ))}
      {/* barra de frecuencias alélicas */}
      <rect x={gx} y="278" width={pw} height="12" rx="6" fill={COL_a} />
      <rect x={gx} y="278" width={Math.max(0, Math.min(1, p)) * pw} height="12" rx="6" fill={COL_A} />
      <text x={gx} y="306" style={{ fontSize: 11.5, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{`A: ${fmt(p, 2)}`}</text>
      <text x={gx + pw} y="306" textAnchor="end" style={{ fontSize: 11.5, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{`a: ${fmt(1 - p, 2)}`}</text>
      <text x={gx + pw / 2} y="306" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{`${counts[0]} AA · ${counts[1]} Aa · ${counts[2]} aa`}</text>
    </g>
  );
}

function GenePools({ p0, pEnd, generations }: { p0: number; pEnd: number; generations: number }) {
  return (
    <svg viewBox="0 0 640 336" role="img" aria-labelledby="pg-pool-t pg-pool-d">
      <title id="pg-pool-t">Poza génica: 100 individuos al inicio y al final</title>
      <desc id="pg-pool-d">{`Cada figura es un individuo; su mitad izquierda y derecha muestran sus dos alelos (azul: A, naranja: a). Proporciones de Hardy-Weinberg con p = ${fmt(p0, 2)} al inicio y p = ${fmt(pEnd, 2)} (promedio) tras ${generations} generaciones.`}</desc>
      <GenePool x={8} title="Generación 0" p={p0} />
      <g aria-hidden="true">
        <path d="M300 160 H 334" stroke="var(--ink-2)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M328 152 L 338 160 L 328 168" fill="none" stroke="var(--ink-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <GenePool x={354} title={`Generación ${generations} (promedio)`} p={pEnd} />
      <text x="320" y="331" textAnchor="middle" style={{ fontSize: 11.5, fill: 'var(--ink-2)' }}>Cada figura es un individuo; cada mitad, uno de sus dos alelos (azul: A · naranja: a).</text>
    </svg>
  );
}

export default function PopGenLab({ api }: LabProps) {
  const [scenario, setScenario] = useState('neutral');
  const [input, setInput] = useState<PopGenInput>({
    p0: 0.5, n: 100, generations: 100, fitness: { AA: 1, Aa: 1, aa: 1 }, mutationAtoa: 0, migration: 0, migrantP: 0.5, drift: true, replicates: 5, seed: 1,
  });
  const set = (patch: Partial<PopGenInput>) => setInput((i) => ({ ...i, ...patch }));
  const setW = (k: 'AA' | 'Aa' | 'aa', v: number) => setInput((i) => ({ ...i, fitness: { ...i.fitness, [k]: v } }));
  const res = useMemo(() => {
    try { return { ok: simulatePopGen(input) }; } catch (e) { return { error: (e as Error).message }; }
  }, [input]);
  const r = 'ok' in res ? res.ok : null;
  const sc = SCENARIOS.find((s) => s.id === scenario);
  const hw = r ? hardyWeinberg(r.meanFinalP) : null;

  // Trayectoria sin deriva (determinista) como referencia.
  const det = useMemo(() => {
    try { return simulatePopGen({ ...input, drift: false }).series.map((s) => ({ x: s.generation, y: s.p[0] })); } catch { return []; }
  }, [input]);
  const series = r ? [
    ...r.finalP.map((_, k) => ({ label: `Población ${k + 1}`, kind: 'line' as const, points: r.series.map((s) => ({ x: s.generation, y: s.p[k] })) })),
    ...(input.drift ? [{ label: 'Sin deriva (referencia)', kind: 'line' as const, dashed: true, color: 'var(--ink-2)', points: det }] : []),
  ] : [];

  const record = () => r && api.addTrial('simulaciones', {
    escenario: sc?.name ?? 'Personalizado', p0: input.p0, n: input.n, generaciones: input.generations,
    wAA: input.fitness.AA, wAa: input.fitness.Aa, waa: input.fitness.aa, deriva: input.drift ? 'sí' : 'no',
    pFinal: Number(r.meanFinalP.toFixed(4)), heterocigosidad: Number(r.heterozygosityFinal.toFixed(4)), fijadas: r.fixedA + r.lostA,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card">
          <Chart title="Frecuencia del alelo A por generación" xLabel="Generación" yLabel="Frecuencia de A (p)" height={300}
            xDomain={[0, input.generations]} yDomain={[0, 1]} series={series}
            hLines={r?.equilibriumP != null ? [{ y: r.equilibriumP, label: `equilibrio p* = ${fmt(r.equilibriumP, 2)}` }] : []} />
        </div>
        {r && <div className="bench"><GenePools p0={input.p0} pEnd={r.meanFinalP} generations={input.generations} /></div>}
        {'error' in res && <Notice kind="bad">{res.error}</Notice>}
        {r && hw && (
          <>
            <Readout items={[
              { k: 'p final (promedio)', v: fmt(r.meanFinalP, 3), data: true },
              { k: 'q final', v: fmt(1 - r.meanFinalP, 3) },
              { k: 'Heterocigosidad final (2pq)', v: fmt(r.heterozygosityFinal, 3), data: true },
              { k: 'A fijado / A perdido', v: `${r.fixedA} / ${r.lostA} de ${r.finalP.length}` },
              { k: 'Sin deriva, p sería', v: fmt(r.deterministicFinalP, 3) },
            ]} />
            <div className="table-wrap">
              <table>
                <caption>Frecuencias genotípicas esperadas (Hardy-Weinberg) con el p final promedio</caption>
                <thead><tr><th>AA (p²)</th><th>Aa (2pq)</th><th>aa (q²)</th></tr></thead>
                <tbody><tr><td className="n">{fmt(hw.AA, 3)}</td><td className="n">{fmt(hw.Aa, 3)}</td><td className="n">{fmt(hw.aa, 3)}</td></tr></tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Población</h3>
          <Select label="Escenario" value={scenario} onChange={(v) => { setScenario(v); const s = SCENARIOS.find((x) => x.id === v); if (s) set(s.patch); }} options={SCENARIOS.map((s) => ({ value: s.id, label: s.name }))} hint={sc?.note} />
          <Slider label="Frecuencia inicial de A (p₀)" value={input.p0} min={POPGEN_LIMITS.p0[0]} max={POPGEN_LIMITS.p0[1]} step={0.01} decimals={2} onChange={(v) => set({ p0: v })} />
          <Select label="Tamaño de la población (N)" value={String(input.n)} onChange={(v) => set({ n: Number(v) })} options={N_OPTIONS.map((x) => ({ value: String(x), label: x.toLocaleString('es-CO') }))} />
          <Slider label="Generaciones" value={input.generations} min={POPGEN_LIMITS.generations[0]} max={POPGEN_LIMITS.generations[1]} step={10} decimals={0} onChange={(v) => set({ generations: v })} />
          <fieldset className="stack-sm" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
            <legend className="small" style={{ fontWeight: 700 }}>Eficacia biológica (supervivencia × reproducción)</legend>
            <Slider label="w AA" value={input.fitness.AA} min={0} max={1} step={0.05} decimals={2} onChange={(v) => { setW('AA', v); setScenario('personalizado'); }} />
            <Slider label="w Aa" value={input.fitness.Aa} min={0} max={1} step={0.05} decimals={2} onChange={(v) => { setW('Aa', v); setScenario('personalizado'); }} />
            <Slider label="w aa" value={input.fitness.aa} min={0} max={1} step={0.05} decimals={2} onChange={(v) => { setW('aa', v); setScenario('personalizado'); }} />
          </fieldset>
          <label className="check"><input type="checkbox" checked={input.drift} onChange={(e) => set({ drift: e.target.checked })} /> Incluir deriva génica (azar del muestreo de gametos)</label>
          {input.drift && <Slider label="Réplicas (poblaciones independientes)" value={input.replicates} min={POPGEN_LIMITS.replicates[0]} max={POPGEN_LIMITS.replicates[1]} step={1} decimals={0} onChange={(v) => set({ replicates: v })} />}
          <details>
            <summary>Mutación y migración</summary>
            <div className="stack-sm">
              <Slider label="Mutación A → a (por generación)" value={input.mutationAtoa} min={0} max={POPGEN_LIMITS.mutation[1]} step={0.0005} decimals={4} onChange={(v) => set({ mutationAtoa: v })} />
              <Slider label="Migrantes por generación" value={input.migration} min={0} max={POPGEN_LIMITS.migration[1]} step={0.01} decimals={2} onChange={(v) => set({ migration: v })} />
              <Slider label="p en los migrantes" value={input.migrantP} min={0} max={1} step={0.05} decimals={2} onChange={(v) => set({ migrantP: v })} />
            </div>
          </details>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => set({ seed: input.seed + 1 })}>Nueva simulación (otra semilla)</button>
            <span className="small muted">Semilla {input.seed}</span>
          </div>
          <RecordButton onRecord={record} disabled={!r} />
        </div>
        <Notice>El azar solo interviene en la deriva génica, con semilla reproducible. Los valores de eficacia son ilustrativos.</Notice>
      </div>
    </div>
  );
}

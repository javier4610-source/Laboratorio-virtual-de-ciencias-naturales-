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

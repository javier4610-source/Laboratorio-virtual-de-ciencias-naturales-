import { useMemo, useState } from 'react';
import { POPULATION_LIMITS, simulatePopulation } from '../models/population';
import { fmt } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Slider } from '../components/ui';
import type { LabProps } from './registry';

export default function PopulationLab({ api }: LabProps) {
  const [model, setModel] = useState<'exponencial' | 'logistico'>('logistico');
  const [n0, setN0] = useState(20);
  const [r, setR] = useState(0.5);
  const [k, setK] = useState(1000);
  const [h, setH] = useState(0);
  const [years, setYears] = useState(50);
  const [compare, setCompare] = useState(true);
  const res = useMemo(() => simulatePopulation({ model, n0, r, k, h, years }), [model, n0, r, k, h, years]);
  const other = useMemo(() => simulatePopulation({ model: model === 'logistico' ? 'exponencial' : 'logistico', n0, r, k, h, years }), [model, n0, r, k, h, years]);
  const yMax = Math.max(k * 1.3, ...res.series.map((p) => Math.min(p.n, k * 3)));
  const clip = (pts: { t: number; n: number }[]) => pts.filter((p) => p.n <= yMax * 1.05).map((p) => ({ x: p.t, y: p.n }));

  const record = () => api.addTrial('escenarios', {
    modelo: model, n0, r, k, h, anios: years, nfinal: Number(res.finalN.toFixed(1)),
    equilibrio: Number.isFinite(res.equilibrium) ? Number(res.equilibrium.toFixed(1)) : null,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card">
          <Chart title="Tamaño de la población de peces en el tiempo" xLabel="Tiempo (años)" yLabel="Individuos" height={300}
            xDomain={[0, years]} yDomain={[0, yMax]}
            hLines={model === 'logistico' || compare ? [{ y: k, label: `K = ${k}` }] : []}
            series={[
              { label: model === 'logistico' ? 'Logístico' : 'Exponencial', kind: 'line', points: clip(res.series) },
              ...(compare ? [{ label: model === 'logistico' ? 'Exponencial (comparación)' : 'Logístico (comparación)', kind: 'line' as const, dashed: true, points: clip(other.series) }] : []),
            ]} />
        </div>
        <Readout items={[
          { k: 'Población final', v: fmt(res.finalN, 0), data: true },
          { k: 'Equilibrio N*', v: Number.isFinite(res.equilibrium) ? fmt(res.equilibrium, 0) : 'sin límite (crece siempre)' },
          { k: 'Captura anual en equilibrio (h·N*)', v: Number.isFinite(res.equilibrium) ? fmt(h * res.equilibrium, 0) : '—' },
          { k: 'Tiempo de duplicación inicial', v: res.doublingTime ? `${fmt(res.doublingTime, 1)} años` : 'la población no crece' },
          { k: 'Tiempo hasta K/2', v: res.timeToHalfK !== null ? `${fmt(res.timeToHalfK, 1)} años` : 'no se alcanza' },
          { k: 'Estado', v: res.extinct ? 'Colapso (menos de 2 individuos)' : 'Población viable' },
        ]} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Parámetros</h3>
          <Segmented label="Modelo" value={model} onChange={setModel} options={[{ value: 'logistico', label: 'Logístico' }, { value: 'exponencial', label: 'Exponencial' }]} />
          <label className="check"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Mostrar el otro modelo para comparar</label>
          <Slider label="Población inicial N₀" value={n0} min={POPULATION_LIMITS.n0[0]} max={POPULATION_LIMITS.n0[1]} step={1} decimals={0} onChange={setN0} />
          <Slider label="Tasa de crecimiento r" value={r} min={POPULATION_LIMITS.r[0]} max={POPULATION_LIMITS.r[1]} step={0.05} unit="/año" decimals={2} onChange={setR} />
          <Slider label="Capacidad de carga K" value={k} min={POPULATION_LIMITS.k[0]} max={POPULATION_LIMITS.k[1]} step={50} decimals={0} onChange={setK} />
          <Slider label="Tasa de pesca h" value={h} min={POPULATION_LIMITS.h[0]} max={POPULATION_LIMITS.h[1]} step={0.05} unit="/año" decimals={2} onChange={setH} />
          <Slider label="Tiempo simulado" value={years} min={POPULATION_LIMITS.years[0]} max={POPULATION_LIMITS.years[1]} step={5} unit="años" decimals={0} onChange={setYears} />
          <RecordButton onRecord={record} />
        </div>
        <Notice>Modelo determinista con parámetros ilustrativos: no incluye azar demográfico, migración ni variaciones del ambiente.</Notice>
      </div>
    </div>
  );
}

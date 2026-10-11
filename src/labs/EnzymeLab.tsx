import { useMemo, useState } from 'react';
import { ENZYME_LIMITS, ENZYMES, initialRate, simulateEnzyme, findEnzyme } from '../models/enzyme';
import { fmt } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';

export default function EnzymeLab({ api }: LabProps) {
  const [enzymeId, setEnzymeId] = useState('amilasa');
  const [temperature, setTemperature] = useState(37);
  const [pH, setPH] = useState(7);
  const [substrate, setSubstrate] = useState(10);
  const [enzyme, setEnzyme] = useState(1);
  const [duration, setDuration] = useState(5);
  const [ran, setRan] = useState(false);
  const res = useMemo(() => simulateEnzyme({ enzymeId, temperature, pH, substrate, enzyme, duration }), [enzymeId, temperature, pH, substrate, enzyme, duration]);
  const e = findEnzyme(enzymeId);
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setRan(false); };

  const record = () => api.addTrial('ensayos', {
    enzima: e.name, temp: temperature, ph: pH, sustrato: substrate, enzimaRel: enzyme,
    v0: Number(res.v0.toFixed(4)), producto: Number(res.productFinal.toFixed(4)), tiempo: duration,
  });

  // Tubo de ensayo: color según el producto formado (indicador ilustrativo)
  const frac = ran && substrate > 0 ? res.productFinal / substrate : 0;
  const hue = enzymeId === 'amilasa' ? `rgb(${Math.round(40 + frac * 180)}, ${Math.round(40 + frac * 150)}, ${Math.round(110 + frac * 30)})` : `rgba(240, 240, 250, ${0.5 + frac * 0.4})`;
  const bubbles = enzymeId === 'catalasa' && ran ? Math.round(Math.min(40, res.v0 * 2)) : 0;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 260" role="img" aria-labelledby="enz-t enz-d">
            <title id="enz-t">Tubo de ensayo en baño térmico</title>
            <desc id="enz-d">{ran ? `${e.name} a ${temperature} °C y pH ${pH}: velocidad inicial ${fmt(res.v0, 2)} mmol/(L·min); se formó ${fmt(res.productFinal, 2)} mmol/L de ${e.product} en ${duration} min.` : 'Reacción aún no iniciada.'}</desc>
            <rect x="40" y="120" width="220" height="120" rx="10" fill={`rgba(${temperature > 45 ? 220 : 90},${temperature > 45 ? 90 : 150},${temperature > 45 ? 60 : 220},0.15)`} stroke="var(--ink-2)" />
            <text x="150" y="256" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Baño térmico · {temperature} °C</text>
            <path d="M130 30 L130 200 Q150 230 170 200 L170 30" fill={hue} stroke="var(--ink-2)" strokeWidth="2" />
            {Array.from({ length: bubbles }, (_, i) => <circle key={i} cx={138 + ((i * 37) % 26)} cy={190 - ((i * 53) % 150)} r={2 + (i % 3)} fill="none" stroke="var(--ink-2)" />)}
            <text x="150" y="22" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>pH {fmt(pH, 1)}</text>
            <g transform="translate(300 30)">
              <text style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>{e.name}</text>
              <text y="20" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{e.substrate} → {e.product}</text>
              <text y="40" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Fuente: {e.source}</text>
              <text y="70" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Actividad relativa por temperatura: {fmt(res.fT, 2)}</text>
              <text y="90" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Actividad relativa por pH: {fmt(res.fpH, 2)}</text>
              {enzymeId === 'amilasa' && <text y="120" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Color del lugol: azul (almidón) → claro (almidón degradado)</text>}
              {enzymeId === 'catalasa' && <text y="120" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Burbujas: oxígeno liberado</text>}
            </g>
          </svg>
        </div>
        <Readout items={[
          { k: 'Velocidad inicial v₀', v: ran ? `${fmt(res.v0, 2)} mmol/(L·min)` : '—', data: true },
          { k: `Producto en ${duration} min`, v: ran ? `${fmt(res.productFinal, 2)} mmol/L` : '—', data: true },
          { k: 'Sustrato transformado', v: ran ? `${fmt(res.percentConverted, 1)} %` : '—' },
          { k: 'Km de la enzima', v: `${fmt(e.km, 1)} mmol/L` },
        ]} />
        {ran && <Warnings list={res.warnings} />}
        <div className="grid-2">
          <div className="card">
            <Chart title="Producto formado en el tiempo" xLabel="Tiempo (min)" yLabel="Producto (mmol/L)" height={240}
              series={[{ label: 'Producto', kind: 'line', points: ran ? res.series.map((p) => ({ x: p.t, y: p.product })) : [] }]}
              xDomain={[0, duration]} yDomain={[0, Math.max(1, substrate)]} emptyText="Pulsa «Iniciar reacción»." />
          </div>
          <details className="card">
            <summary>Curva de referencia del modelo (ábrela después de recolectar tus datos)</summary>
            <Chart title="Curva de referencia del modelo: v₀ contra temperatura" xLabel="Temperatura (°C)" yLabel="v₀ (mmol/(L·min))" height={240}
              series={[{ label: 'Modelo', kind: 'line', points: Array.from({ length: 41 }, (_, i) => ({ x: i * 2, y: initialRate(e, i * 2, pH, substrate, enzyme) })) }]}
              emptyText="" />
            <p className="small muted">Compárala con tus datos. Temperatura óptima del modelo: {fmt(res.optimalT, 1)} °C.</p>
          </details>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones del ensayo</h3>
          <Select label="Enzima" value={enzymeId} onChange={touch(setEnzymeId)} options={ENZYMES.map((x) => ({ value: x.id, label: `${x.name} (${x.substrate})` }))} />
          <Slider label="Temperatura" value={temperature} min={ENZYME_LIMITS.temperature[0]} max={ENZYME_LIMITS.temperature[1]} step={1} unit="°C" decimals={0} onChange={touch(setTemperature)} />
          <Slider label="pH" value={pH} min={ENZYME_LIMITS.pH[0]} max={ENZYME_LIMITS.pH[1]} step={0.5} decimals={1} onChange={touch(setPH)} />
          <Slider label="Concentración de sustrato" value={substrate} min={ENZYME_LIMITS.substrate[0]} max={ENZYME_LIMITS.substrate[1]} step={1} unit="mmol/L" decimals={0} onChange={touch(setSubstrate)} />
          <Slider label="Concentración de enzima (relativa)" value={enzyme} min={ENZYME_LIMITS.enzyme[0]} max={ENZYME_LIMITS.enzyme[1]} step={0.25} unit="×" decimals={2} onChange={touch(setEnzyme)} />
          <Slider label="Tiempo de reacción" value={duration} min={ENZYME_LIMITS.duration[0]} max={ENZYME_LIMITS.duration[1]} step={1} unit="min" decimals={0} onChange={touch(setDuration)} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => setRan(true)}>Iniciar reacción</button>
            <button type="button" className="btn" onClick={() => setRan(false)} disabled={!ran}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!ran} />
        </div>
        <Notice>Modelo de Michaelis-Menten con parámetros ilustrativos. La desnaturalización se trata como dependiente solo de la temperatura durante el ensayo.</Notice>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ENZYME_LIMITS, ENZYMES, initialRate, simulateEnzyme, findEnzyme, temperatureFactor } from '../models/enzyme';
import { fmt } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, Lcd, TestTube, Thermometer, shade } from './kit';

const TANK = 'M36 128 L36 266 Q36 276 46 276 L286 276 Q296 276 296 266 L296 128';

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
  // Máximo de la actividad por temperatura en el intervalo del baño: escala de la barra.
  const fTPeak = useMemo(() => Math.max(1e-6, ...Array.from({ length: 81 }, (_, t) => temperatureFactor(findEnzyme(enzymeId), t))), [enzymeId]);
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setRan(false); };

  const record = () => api.addTrial('ensayos', {
    enzima: e.name, temp: temperature, ph: pH, sustrato: substrate, enzimaRel: enzyme,
    v0: Number(res.v0.toFixed(4)), producto: Number(res.productFinal.toFixed(4)), tiempo: duration,
  });

  // Tubo de ensayo: color según el producto formado (indicador ilustrativo)
  const frac = ran && substrate > 0 ? res.productFinal / substrate : 0;
  const tubeLiquid = enzymeId === 'amilasa' ? `rgb(${Math.round(40 + frac * 180)}, ${Math.round(40 + frac * 150)}, ${Math.round(110 + frac * 30)})` : '#e3e7f2';
  const tubeOpacity = enzymeId === 'amilasa' ? 0.9 : 0.5 + frac * 0.4;
  // Agua del baño: más azul cuando está fría, con un matiz cálido cuando está caliente (solo ilustrativo).
  const water = temperature < 20 ? '#8fcbe8' : temperature > 45 ? '#d9a27a' : '#7fb8dc';
  const bubbles = enzymeId === 'catalasa' && ran ? Math.round(Math.min(40, res.v0 * 2)) : 0;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 304" role="img" aria-labelledby="enz-t enz-d">
            <title id="enz-t">Tubo de ensayo en baño térmico</title>
            <desc id="enz-d">{ran ? `${e.name} a ${temperature} °C y pH ${pH}: velocidad inicial ${fmt(res.v0, 2)} mmol/(L·min); se formó ${fmt(res.productFinal, 2)} mmol/L de ${e.product} en ${duration} min.` : 'Reacción aún no iniciada.'}</desc>
            <defs>
              <linearGradient id="enz-water" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={water} stopOpacity="0.38" /><stop offset="1" stopColor={shade(water, -0.25)} stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id="enz-lugol" x1="0" x2="1">
                <stop offset="0" stopColor="rgb(40, 40, 110)" /><stop offset="1" stopColor="rgb(220, 190, 140)" />
              </linearGradient>
            </defs>
            <BenchTop y={276} width={640} />
            {/* baño de agua: cubeta de vidrio con termostato de inmersión */}
            <path d={TANK} fill="url(#kit-glass-fill)" filter="url(#kit-shadow)" />
            <rect x="38" y="150" width="256" height="122" rx="6" fill="url(#enz-water)" />
            {/* gradilla de alambre */}
            <g stroke="#8d989c" strokeWidth="2" fill="none">
              <path d="M60 272 L60 172 M220 272 L220 172" />
            </g>
            {/* tubo de ensayo con la mezcla de reacción */}
            <TestTube x={118} y={50} w={28} h={196} fill={0.56} liquid={tubeLiquid} liquidOpacity={tubeOpacity}>
              {bubbles > 0 && (
                <g>
                  {Array.from({ length: bubbles }, (_, i) => (
                    <circle key={i} cx={122 + ((i * 37) % 20)} cy={238 - ((i * 53) % 96)} r={1.4 + (i % 3) * 0.8} fill="#fff" fillOpacity="0.55" stroke="#6f8f9c" strokeWidth="0.7" />
                  ))}
                  {Array.from({ length: Math.min(9, Math.ceil(bubbles / 4)) }, (_, i) => (
                    <circle key={`f${i}`} cx={122 + i * 2.6} cy={140 - (i % 3) * 3 - Math.min(14, bubbles / 3) * ((i % 2) ? 0.6 : 1)} r={3 + (i % 2)} fill="#fbfdff" stroke="#9fb3bb" strokeWidth="0.7" />
                  ))}
                </g>
              )}
            </TestTube>
            <rect x="116" y="70" width="32" height="18" rx="2" fill="#fbfbf4" stroke="#b9b39a" strokeWidth="0.8" opacity="0.95" />
            <text x="132" y="82.5" textAnchor="middle" style={{ fontSize: 8.5, fill: '#2e3a3b', fontWeight: 700 }}>{e.id === 'amilasa' ? 'AMI' : e.id === 'pepsina' ? 'PEP' : 'CAT'}</text>
            <text x="132" y="40" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>pH {fmt(pH, 1)}</text>
            <Thermometer x={196} y={66} h={186} min={0} max={80} value={temperature} />
            {/* termostato: sonda calefactora */}
            <rect x="265" y="140" width="8" height="98" rx="3" fill="url(#kit-metal-h)" />
            <path d={`M262 200 ${Array.from({ length: 6 }, (_, i) => `L276 ${204 + i * 6} L262 ${207 + i * 6}`).join(' ')}`} fill="none" stroke={temperature > 30 ? '#d0603a' : '#8d989c'} strokeWidth="2" />
            <rect x="38" y="190" width="160" height="5" rx="2" fill="url(#kit-metal)" stroke="#8d989c" strokeWidth="0.8" />
            {[86, 132, 172].map((hx) => <ellipse key={hx} cx={hx} cy={192.5} rx={hx === 132 ? 16 : 13} ry="2" fill="#5e696d" opacity={hx === 132 ? 0 : 0.6} />)}
            {/* cara frontal del agua (sumerge tubo y termómetro) */}
            <rect x="38" y="150" width="256" height="122" rx="6" fill={water} opacity="0.14" />
            <path d="M38 150 L294 150" stroke={shade(water, -0.3)} strokeWidth="1.4" opacity="0.8" />
            <path d="M44 154 L288 154" stroke="#fff" strokeWidth="1.5" opacity="0.4" />
            {temperature < 10 && [[70, 146], [168, 147], [230, 145]].map(([ix, iy], i) => (
              <g key={i} transform={`rotate(${i * 11 - 8} ${ix} ${iy})`}>
                <rect x={ix - 8} y={iy - 7} width="16" height="13" rx="2.5" fill="#eaf8ff" fillOpacity="0.75" stroke="#9cc7da" />
                <rect x={ix - 5} y={iy - 5} width="4" height="7" rx="1" fill="#fff" opacity="0.8" />
              </g>
            ))}
            {temperature >= 50 && [80, 176, 238].map((sx, i) => (
              <path key={sx} d={`M${sx} 142 q-6 -8 0 -16 q6 -8 0 -16`} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" opacity={0.25 + Math.min(0.3, (temperature - 50) / 80) + i * 0.03} />
            ))}
            <path d={TANK} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.8" />
            <rect x="292" y="112" width="16" height="42" rx="2" fill="url(#kit-metal-h)" stroke="#6f7a7c" strokeWidth="0.8" />
            <rect x="230" y="52" width="84" height="94" rx="8" fill="url(#kit-body-dark)" filter="url(#kit-shadow)" />
            <Lcd x={237} y={60} w={70} h={28} text={String(temperature)} unit="°C" />
            <circle cx="250" cy="110" r="9" fill="url(#kit-metal)" stroke="#2a3234" />
            <line x1="250" y1="110" x2="250" y2="103" stroke="#2a3234" strokeWidth="2" strokeLinecap="round" />
            <circle cx="290" cy="104" r="3.5" fill={temperature > 30 ? '#ff7043' : temperature < 15 ? '#4fc3f7' : '#66bb6a'} />
            <text x="290" y="120" textAnchor="middle" style={{ fontSize: 7, fill: '#c9d2d5', letterSpacing: 0.5 }}>{temperature > 30 ? 'CALOR' : temperature < 15 ? 'FRÍO' : 'ESTABLE'}</text>
            <text x="272" y="138" textAnchor="middle" style={{ fontSize: 7, fill: '#c9d2d5', letterSpacing: 1 }}>TERMOSTATO</text>
            <text x="166" y="298" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Baño térmico · {temperature} °C</text>
            {/* ficha del ensayo */}
            <g transform="translate(330 22)">
              <rect width="292" height="246" rx="12" fill="var(--surface-2)" stroke="var(--line)" />
              <g transform="translate(18 30)">
                <text style={{ fontSize: 14, fill: 'var(--ink)', fontWeight: 700 }}>{e.name}</text>
                <text y="22" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{e.substrate} → {e.product}</text>
                <text y="40" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Fuente: {e.source}</text>
                <line x1="0" x2="256" y1="54" y2="54" stroke="var(--line)" />
                <text y="76" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Actividad relativa por temperatura: {fmt(res.fT, 2)}</text>
                <rect y="84" width="256" height="8" rx="4" fill="var(--line)" />
                <rect y="84" width={256 * Math.max(0, Math.min(1, res.fT / fTPeak))} height="8" rx="4" fill="var(--data)" />
                <text y="116" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Actividad relativa por pH: {fmt(res.fpH, 2)}</text>
                <rect y="124" width="256" height="8" rx="4" fill="var(--line)" />
                <rect y="124" width={256 * Math.max(0, Math.min(1, res.fpH))} height="8" rx="4" fill="var(--fis)" />
                {enzymeId === 'amilasa' && (
                  <g>
                    <text y="158" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>
                      <tspan x="0">Color del lugol: azul (almidón) →</tspan>
                      <tspan x="0" dy="15">claro (almidón degradado)</tspan>
                    </text>
                    <rect y="182" width="256" height="12" rx="3" fill="url(#enz-lugol)" stroke="var(--line)" />
                    {ran && <path d={`M${256 * Math.max(0, Math.min(1, frac))} 180 l-5 -7 h10 z`} fill="var(--ink)" />}
                  </g>
                )}
                {enzymeId === 'catalasa' && <text y="158" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Burbujas: oxígeno liberado</text>}
              </g>
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

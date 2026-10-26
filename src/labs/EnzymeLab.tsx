import { useMemo, useState } from 'react';
import { ENZYME_LIMITS, ENZYMES, initialRate, simulateEnzyme, findEnzyme, temperatureFactor, enzymeConditions } from '../models/enzyme';
import { fmt } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, ContactShadow, Lcd, TestTube, Thermometer, shade } from './kit';
import { DragHandle, Knob, ManipHint, ManipScene } from './manipulate';

const TANK = 'M36 128 L36 266 Q36 276 46 276 L286 276 Q296 276 296 266 L296 128';

/** Tubos del ensayo: cada uno lleva su propio tampón (pH) y puede estar en el baño o en la gradilla de la mesa. */
interface Tube { id: number; pH: number; inBath: boolean }
const MAX_TUBES = 3;
const TUBE_W = 26, TUBE_H = 196;
/** Posiciones (x del borde izquierdo) en la gradilla del baño y en la gradilla de la mesa. */
const BATH_SLOTS = [62, 106, 150];
const RACK_SLOTS = [318, 350, 382];
const BATH_Y = 50, RACK_Y = 66;
/** Al soltar un tubo: a la izquierda de este borde queda en el baño; a la derecha, en la gradilla. */
const DROP_EDGE = 304;

export default function EnzymeLab({ api }: LabProps) {
  const [enzymeId, setEnzymeId] = useState('amilasa');
  const [temperature, setTemperature] = useState(37);
  const [tubes, setTubes] = useState<Tube[]>([{ id: 1, pH: 7, inBath: true }]);
  const [selId, setSelId] = useState(1);
  const [substrate, setSubstrate] = useState(10);
  const [enzyme, setEnzyme] = useState(1);
  const [duration, setDuration] = useState(5);
  const [started, setRan] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const sel = tubes.find((t) => t.id === selId) ?? tubes[0];
  // La reacción corre en los tubos sumergidos: las lecturas son las del tubo seleccionado si está en el baño.
  const ran = started && sel.inBath;
  const pH = sel.pH;
  const res = useMemo(() => simulateEnzyme({ enzymeId, temperature, pH, substrate, enzyme, duration }), [enzymeId, temperature, pH, substrate, enzyme, duration]);
  // Resultado de cada tubo (mismo modelo, cada uno con su pH): solo da el color del contenido en la escena.
  const tubeRes = useMemo(() => new Map(tubes.map((t) => [t.id, simulateEnzyme({ enzymeId, temperature, pH: t.pH, substrate, enzyme, duration })])), [tubes, enzymeId, temperature, substrate, enzyme, duration]);
  const e = findEnzyme(enzymeId);
  // Máximo de la actividad por temperatura en el intervalo del baño: escala de la barra.
  const fTPeak = useMemo(() => Math.max(1e-6, ...Array.from({ length: 81 }, (_, t) => temperatureFactor(findEnzyme(enzymeId), t))), [enzymeId]);
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setRan(false); };
  const setPH = (v: number) => { setTubes((ts) => ts.map((t) => (t.id === sel.id ? { ...t, pH: v } : t))); setRan(false); };
  const placeTube = (id: number, inBath: boolean) => { setTubes((ts) => ts.map((t) => (t.id === id ? { ...t, inBath } : t))); setSelId(id); setRan(false); };
  const addTube = () => {
    if (tubes.length >= MAX_TUBES) return;
    const id = Math.max(...tubes.map((t) => t.id)) + 1;
    // El tubo nuevo se prepara en la gradilla con otro tampón (pH + 2 respecto al último, sin salir del intervalo).
    const nextPH = Math.min(ENZYME_LIMITS.pH[1], Math.max(ENZYME_LIMITS.pH[0], tubes[tubes.length - 1].pH + 2));
    setTubes((ts) => [...ts, { id, pH: nextPH, inBath: false }]);
    setSelId(id);
    setRan(false);
  };
  const removeTube = () => {
    if (tubes.length <= 1) return;
    const rest = tubes.filter((t) => t.id !== sel.id);
    setTubes(rest);
    setSelId(rest[rest.length - 1].id);
    setRan(false);
  };
  const tubeNo = (id: number) => tubes.findIndex((t) => t.id === id) + 1;

  const record = () => api.addTrial('ensayos', {
    enzima: e.name, temp: temperature, ph: pH, sustrato: substrate, enzimaRel: enzyme,
    v0: Number(res.v0.toFixed(4)), producto: Number(res.productFinal.toFixed(4)), tiempo: duration,
  });

  // Tubo de ensayo: color según el producto formado (indicador ilustrativo). Solo reaccionan los tubos sumergidos.
  const look = (t: Tube) => {
    const r = tubeRes.get(t.id)!;
    const f = started && t.inBath && substrate > 0 ? r.productFinal / substrate : 0;
    return {
      frac: f,
      liquid: enzymeId === 'amilasa' ? `rgb(${Math.round(40 + f * 180)}, ${Math.round(40 + f * 150)}, ${Math.round(110 + f * 30)})` : '#e3e7f2',
      opacity: enzymeId === 'amilasa' ? 0.9 : 0.5 + f * 0.4,
      bubbles: enzymeId === 'catalasa' && started && t.inBath ? Math.round(Math.min(40, r.v0 * 2)) : 0,
    };
  };
  const frac = look(sel).frac;
  // Agua del baño: más azul cuando está fría, con un matiz cálido cuando está caliente (solo ilustrativo).
  const water = temperature < 20 ? '#8fcbe8' : temperature > 45 ? '#d9a27a' : '#7fb8dc';
  const inBath = tubes.filter((t) => t.inBath), onRack = tubes.filter((t) => !t.inBath);
  const placed = (t: Tube) => {
    const list = t.inBath ? inBath : onRack;
    const i = list.findIndex((x) => x.id === t.id);
    return { x: (t.inBath ? BATH_SLOTS : RACK_SLOTS)[i], y: t.inBath ? BATH_Y : RACK_Y };
  };
  const code = e.id === 'amilasa' ? 'AMI' : e.id === 'pepsina' ? 'PEP' : 'CAT';

  const drawTube = (t: Tube, x: number, y: number, ghost = false) => {
    const l = look(t);
    const cx = x + TUBE_W / 2;
    const selected = t.id === sel.id;
    return (
      <g opacity={ghost ? 0.85 : 1}>
        <TestTube x={x} y={y} w={TUBE_W} h={TUBE_H} fill={0.56} liquid={l.liquid} liquidOpacity={l.opacity}>
          {l.bubbles > 0 && !ghost && (
            <g>
              {Array.from({ length: l.bubbles }, (_, i) => (
                <circle key={i} cx={x + 4 + ((i * 37) % (TUBE_W - 8))} cy={y + 188 - ((i * 53) % 96)} r={1.4 + (i % 3) * 0.8} fill="#fff" fillOpacity="0.55" stroke="#6f8f9c" strokeWidth="0.7" />
              ))}
              {Array.from({ length: Math.min(8, Math.ceil(l.bubbles / 4)) }, (_, i) => (
                <circle key={`f${i}`} cx={x + 4 + i * 2.6} cy={y + 90 - (i % 3) * 3 - Math.min(14, l.bubbles / 3) * ((i % 2) ? 0.6 : 1)} r={3 + (i % 2)} fill="#fbfdff" stroke="#9fb3bb" strokeWidth="0.7" />
              ))}
            </g>
          )}
        </TestTube>
        <rect x={x - 2} y={y + 20} width={TUBE_W + 4} height={18} rx={2} fill="#fbfbf4" stroke="#b9b39a" strokeWidth="0.8" opacity="0.95" />
        <text x={cx} y={y + 32.5} textAnchor="middle" style={{ fontSize: 7.5, fill: '#2e3a3b', fontWeight: 700 }}>{code}·{tubeNo(t.id)}</text>
        <text x={cx} y={y - 8} textAnchor="middle" className="scene-label" style={{ fontSize: 10, fill: selected ? 'var(--accent)' : 'var(--ink-2)', fontWeight: selected ? 700 : 400 }}>pH {fmt(t.pH, 1)}</text>
        {selected && !ghost && <path d={`M${cx - 5} ${y - 30} l5 6 l5 -6 Z`} fill="var(--accent)" />}
      </g>
    );
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox="0 0 720 304" label="Controles del baño térmico y de los tubos" scene={
          <svg viewBox="0 0 720 304" role="img" aria-labelledby="enz-t enz-d">
            <title id="enz-t">Tubos de ensayo en baño térmico</title>
            <desc id="enz-d">{`${inBath.length} ${inBath.length === 1 ? 'tubo' : 'tubos'} en el baño a ${temperature} °C y ${onRack.length} en la gradilla de la mesa. `
              + (ran ? `${e.name} en el tubo ${tubeNo(sel.id)} (pH ${pH}): velocidad inicial ${fmt(res.v0, 2)} mmol/(L·min); se formó ${fmt(res.productFinal, 2)} mmol/L de ${e.product} en ${duration} min.` : 'Reacción aún no iniciada.')}</desc>
            <defs>
              <linearGradient id="enz-water" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={water} stopOpacity="0.38" /><stop offset="1" stopColor={shade(water, -0.25)} stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id="enz-lugol" x1="0" x2="1">
                <stop offset="0" stopColor="rgb(40, 40, 110)" /><stop offset="1" stopColor="rgb(220, 190, 140)" />
              </linearGradient>
            </defs>
            <BenchTop y={276} width={720} />
            {/* baño de agua: cubeta de vidrio con termostato de inmersión */}
            <ContactShadow x={36} y={276} w={262} />
            <path d={TANK} fill="url(#kit-glass-fill)" filter="url(#kit-shadow)" />
            <rect x="38" y="150" width="256" height="122" rx="6" fill="url(#enz-water)" />
            {/* gradilla de alambre */}
            <g stroke="#8d989c" strokeWidth="2" fill="none">
              <path d="M52 272 L52 172 M190 272 L190 172" />
            </g>
            {/* tubos sumergidos */}
            {inBath.map((t) => { const p = placed(t); return <g key={t.id} opacity={dragId === t.id ? 0.3 : 1}>{drawTube(t, p.x, p.y)}</g>; })}
            <Thermometer x={204} y={66} h={186} min={0} max={80} value={temperature} />
            {/* termostato: sonda calefactora */}
            <rect x="265" y="140" width="8" height="98" rx="3" fill="url(#kit-metal-h)" />
            <path d={`M262 200 ${Array.from({ length: 6 }, (_, i) => `L276 ${204 + i * 6} L262 ${207 + i * 6}`).join(' ')}`} fill="none" stroke={temperature > 30 ? '#d0603a' : '#8d989c'} strokeWidth="2" />
            <rect x="38" y="190" width="160" height="5" rx="2" fill="url(#kit-metal)" stroke="#8d989c" strokeWidth="0.8" />
            {BATH_SLOTS.map((hx, i) => <ellipse key={hx} cx={hx + TUBE_W / 2} cy={192.5} rx={13} ry="2" fill="#5e696d" opacity={i < inBath.length ? 0 : 0.6} />)}
            {/* cara frontal del agua (sumerge tubos y termómetro) */}
            <rect x="38" y="150" width="256" height="122" rx="6" fill={water} opacity="0.14" />
            <path d="M38 150 Q166 154 294 150" fill="none" stroke={shade(water, -0.3)} strokeWidth="1.4" opacity="0.8" />
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
            <rect x="233" y="55" width="78" height="20" rx="6" fill="#fff" opacity="0.06" />
            <Lcd x={237} y={60} w={70} h={28} text={String(temperature)} unit="°C" />
            <circle cx="290" cy="104" r="3.5" fill={temperature > 30 ? '#ff7043' : temperature < 15 ? '#4fc3f7' : '#66bb6a'} />
            <text x="290" y="120" textAnchor="middle" style={{ fontSize: 7, fill: '#c9d2d5', letterSpacing: 0.5 }}>{temperature > 30 ? 'CALOR' : temperature < 15 ? 'FRÍO' : 'ESTABLE'}</text>
            <text x="272" y="138" textAnchor="middle" style={{ fontSize: 7, fill: '#c9d2d5', letterSpacing: 1 }}>TERMOSTATO</text>
            <text x="166" y="298" textAnchor="middle" className="scene-label" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Baño térmico · {temperature} °C</text>
            {/* gradilla de madera sobre la mesa */}
            <ContactShadow x={312} y={276} w={100} />
            <rect x="312" y="196" width="100" height="9" rx="2" fill="url(#kit-wood)" stroke="#b8975a" />
            <rect x="314" y="205" width="5" height="62" fill="#d8b56f" /><rect x="405" y="205" width="5" height="62" fill="#d8b56f" />
            {RACK_SLOTS.map((rx, i) => <ellipse key={rx} cx={rx + TUBE_W / 2} cy={200.5} rx={12} ry="2" fill="#7a5c2c" opacity={i < onRack.length ? 0 : 0.55} />)}
            {onRack.map((t) => { const p = placed(t); return <g key={t.id} opacity={dragId === t.id ? 0.3 : 1}>{drawTube(t, p.x, p.y)}</g>; })}
            <rect x="312" y="266" width="100" height="10" rx="2" fill="url(#kit-wood)" stroke="#b8975a" />
            <text x="362" y="298" textAnchor="middle" className="scene-label" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Gradilla (sin reacción)</text>
            {/* ficha del ensayo */}
            <g transform="translate(424 22)">
              <rect width="284" height="246" rx="12" fill="var(--surface-2)" stroke="var(--line)" />
              <g transform="translate(16 30)">
                <text style={{ fontSize: 14, fill: 'var(--ink)', fontWeight: 700 }}>{e.name} · tubo {tubeNo(sel.id)}</text>
                <text y="22" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{e.substrate} → {e.product}</text>
                <text y="40" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Fuente: {e.source}</text>
                <line x1="0" x2="252" y1="54" y2="54" stroke="var(--line)" />
                <text y="76" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Actividad relativa por temperatura: {fmt(res.fT, 2)}</text>
                <rect y="84" width="252" height="8" rx="4" fill="var(--line)" />
                <rect y="84" width={252 * Math.max(0, Math.min(1, res.fT / fTPeak))} height="8" rx="4" fill="var(--data)" />
                <text y="116" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Actividad relativa por pH: {fmt(res.fpH, 2)}</text>
                <rect y="124" width="252" height="8" rx="4" fill="var(--line)" />
                <rect y="124" width={252 * Math.max(0, Math.min(1, res.fpH))} height="8" rx="4" fill="var(--fis)" />
                {enzymeId === 'amilasa' && (
                  <g>
                    <text y="158" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>
                      <tspan x="0">Color del lugol: azul (almidón) →</tspan>
                      <tspan x="0" dy="15">claro (almidón degradado)</tspan>
                    </text>
                    <rect y="182" width="252" height="12" rx="3" fill="url(#enz-lugol)" stroke="var(--line)" />
                    {ran && sel.inBath && <path d={`M${252 * Math.max(0, Math.min(1, frac))} 180 l-5 -7 h10 z`} fill="var(--ink)" />}
                  </g>
                )}
                {enzymeId === 'catalasa' && <text y="158" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Burbujas: oxígeno liberado</text>}
              </g>
            </g>
          </svg>}>
            <Knob label="Perilla del termostato del baño" cx={252} cy={114} r={10} value={temperature} min={ENZYME_LIMITS.temperature[0]} max={ENZYME_LIMITS.temperature[1]} step={1} pageStep={5} unit="°C" decimals={0} onChange={touch(setTemperature)} />
            {tubes.map((t) => {
              const p = placed(t);
              return (
                <DragHandle key={t.id} label={`Tubo ${tubeNo(t.id)} (pH ${fmt(t.pH, 1)}): mover entre la gradilla y el baño`} value={t.inBath ? 1 : 0} min={0} max={1} step={1} pageStep={1}
                  commit="end" affordance={dragId === null}
                  hit={{ x: p.x - 3, y: p.y + 4, w: TUBE_W + 6, h: TUBE_H - 40 }}
                  valueText={(v) => (v ? 'En el baño térmico' : 'En la gradilla de la mesa')}
                  valueFromPoint={({ point }) => (point.x < DROP_EDGE ? 1 : 0)}
                  onDragChange={(d) => { setDragId(d ? t.id : null); if (d) setSelId(t.id); }}
                  onChange={(v) => placeTube(t.id, v === 1)}>
                  {({ dragging, point }) => dragging && point && (
                    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                      <rect x={38} y={40} width={258} height={232} rx={8} fill="var(--accent)" opacity={point.x < DROP_EDGE ? 0.14 : 0.04} />
                      <rect x={310} y={40} width={104} height={232} rx={8} fill="var(--accent)" opacity={point.x >= DROP_EDGE ? 0.14 : 0.04} />
                      {drawTube(t, point.x - TUBE_W / 2, point.y - TUBE_H / 2, true)}
                    </g>
                  )}
                </DragHandle>
              );
            })}
          </ManipScene>
        </div>
        <ManipHint>Gira la perilla del termostato para fijar la temperatura del baño. Arrastra cada tubo entre la gradilla y el baño (solo reaccionan los tubos sumergidos), o enfócalo con Tab y usa las flechas.</ManipHint>
        <Readout items={[
          { k: 'Velocidad inicial v₀', v: ran ? `${fmt(res.v0, 2)} mmol/(L·min)` : '—', data: true },
          { k: `Producto en ${duration} min`, v: ran ? `${fmt(res.productFinal, 2)} mmol/L` : '—', data: true },
          { k: 'Sustrato transformado', v: ran ? `${fmt(res.percentConverted, 1)} %` : '—' },
          { k: 'Km de la enzima', v: `${fmt(e.km, 1)} mmol/L` },
        ]} />
        {ran && <Warnings list={enzymeConditions(res.warnings, { enzymeId, temperature, pH, substrate, enzyme, duration })} />}
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
          <fieldset className="tube-set">
            <legend>Tubos del ensayo ({tubes.length} de {MAX_TUBES})</legend>
            {tubes.length > 1 && (
              <Segmented label="Tubo seleccionado" value={String(sel.id)} onChange={(v) => setSelId(Number(v))}
                options={tubes.map((t) => ({ value: String(t.id), label: `Tubo ${tubeNo(t.id)}` }))} />
            )}
            <Slider label="pH" value={pH} min={ENZYME_LIMITS.pH[0]} max={ENZYME_LIMITS.pH[1]} step={0.5} decimals={1} onChange={setPH}
              hint={tubes.length > 1 ? `Tampón del tubo ${tubeNo(sel.id)}. Cada tubo tiene su propio pH.` : undefined} />
            <div className="btn-row">
              <button type="button" className="btn small" onClick={() => placeTube(sel.id, !sel.inBath)}>{sel.inBath ? 'Sacar el tubo del baño' : 'Meter el tubo al baño'}</button>
              <button type="button" className="btn small" onClick={addTube} disabled={tubes.length >= MAX_TUBES}>Agregar tubo</button>
              <button type="button" className="btn small" onClick={removeTube} disabled={tubes.length <= 1}>Quitar tubo {tubeNo(sel.id)}</button>
            </div>
          </fieldset>
          <Slider label="Concentración de sustrato" value={substrate} min={ENZYME_LIMITS.substrate[0]} max={ENZYME_LIMITS.substrate[1]} step={1} unit="mmol/L" decimals={0} onChange={touch(setSubstrate)} />
          <Slider label="Concentración de enzima (relativa)" value={enzyme} min={ENZYME_LIMITS.enzyme[0]} max={ENZYME_LIMITS.enzyme[1]} step={0.25} unit="×" decimals={2} onChange={touch(setEnzyme)} />
          <Slider label="Tiempo de reacción" value={duration} min={ENZYME_LIMITS.duration[0]} max={ENZYME_LIMITS.duration[1]} step={1} unit="min" decimals={0} onChange={touch(setDuration)} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => setRan(true)} disabled={inBath.length === 0}>Iniciar reacción</button>
            <button type="button" className="btn" onClick={() => setRan(false)} disabled={!started}>Reiniciar</button>
          </div>
          {!sel.inBath && <p className="small muted">El tubo {tubeNo(sel.id)} está en la gradilla: mételo al baño para que reaccione.</p>}
          <RecordButton onRecord={record} disabled={!ran} />
        </div>
        <Notice>Modelo de Michaelis-Menten con parámetros ilustrativos. La desnaturalización se trata como dependiente solo de la temperatura durante el ensayo.</Notice>
      </div>
    </div>
  );
}

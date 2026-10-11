import { useMemo, useState, type KeyboardEvent } from 'react';
import { brightness, CIRCUIT_LIMITS, solveCircuit, type Topology } from '../models/circuits';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';

function Bulb({ x, y, power, label, on }: { x: number; y: number; power: number; label: string; on: boolean }) {
  const b = on ? brightness(power) : 0;
  return (
    <g>
      <circle cx={x} cy={y} r={34} fill="#ffd54a" opacity={b * 0.45} />
      <circle cx={x} cy={y} r={18} fill={b > 0.02 ? `rgba(255, 213, 74, ${0.35 + b * 0.65})` : 'var(--surface)'} stroke="var(--ink)" strokeWidth="2" />
      <path d={`M${x - 8} ${y + 4} q4 -12 8 0 q4 12 8 0`} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      <text x={x} y={y + 36} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>{label}</text>
    </g>
  );
}

function Switch({ x, y, closed, onToggle, label, vertical }: { x: number; y: number; closed: boolean; onToggle: () => void; label: string; vertical?: boolean }) {
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } };
  const rot = vertical ? `rotate(90 ${x} ${y})` : undefined;
  return (
    <g role="button" tabIndex={0} aria-pressed={closed} aria-label={`${label}: ${closed ? 'cerrado' : 'abierto'}. Pulsa para ${closed ? 'abrir' : 'cerrar'}.`} onClick={onToggle} onKeyDown={onKey} style={{ cursor: 'pointer' }}>
      <rect x={x - 22} y={y - 22} width={44} height={44} fill="transparent" />
      <g transform={rot}>
        <rect x={x - 16} y={y - 6} width={32} height={12} fill="var(--bg)" />
        <circle cx={x - 14} cy={y} r={3.5} fill="var(--ink)" />
        <circle cx={x + 14} cy={y} r={3.5} fill="var(--ink)" />
        <line x1={x - 14} y1={y} x2={closed ? x + 14 : x + 10} y2={closed ? y : y - 14} stroke={closed ? 'var(--ok)' : 'var(--bad)'} strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Battery({ x, y, emf }: { x: number; y: number; emf: number }) {
  return (
    <g>
      <rect x={x - 22} y={y - 16} width={44} height={32} fill="var(--bg)" />
      <line x1={x - 18} y1={y - 6} x2={x + 18} y2={y - 6} stroke="var(--ink)" strokeWidth="3" />
      <line x1={x - 10} y1={y + 6} x2={x + 10} y2={y + 6} stroke="var(--ink)" strokeWidth="5" />
      <text x={x - 30} y={y + 4} textAnchor="end" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>{fmt(emf, 1)} V</text>
      <text x={x + 24} y={y - 10} style={{ fontSize: 12, fill: 'var(--ink-2)' }}>+</text>
    </g>
  );
}

export default function CircuitLab({ api }: LabProps) {
  const [topology, setTopology] = useState<Topology>('serie');
  const [emf, setEmf] = useState(6);
  const [r, setR] = useState(0.5);
  const [R, setRs] = useState<[number, number, number]>([10, 10, 10]);
  const [closed, setClosed] = useState<[boolean, boolean, boolean]>([true, true, true]);
  const [main, setMain] = useState(true);
  const [meter, setMeter] = useState<'1' | '2' | '3' | 'fuente'>('1');
  const res = useMemo(() => solveCircuit({ topology, emf, internalResistance: r, resistances: R, closed, mainSwitch: main }), [topology, emf, r, R, closed, main]);
  const toggle = (i: number) => setClosed((c) => c.map((v, j) => (j === i ? !v : v)) as [boolean, boolean, boolean]);
  const setRi = (i: number, v: number) => setRs((rs) => rs.map((x, j) => (j === i ? v : x)) as [number, number, number]);
  const els = res.elements;
  const flowing = !res.open && res.totalCurrent > 0;
  const wire = flowing ? 'var(--accent)' : 'var(--ink-2)';

  const record = () => api.addTrial('medidas', {
    config: topology, emf, r1: R[0], r2: R[1], r3: R[2],
    req: res.equivalentResistance === null ? null : Number(res.equivalentResistance.toFixed(4)),
    itotal: Number(res.totalCurrent.toFixed(5)), vbornes: Number(res.terminalVoltage.toFixed(4)),
    v1: Number(els[0].voltage.toFixed(4)), i1: Number(els[0].current.toFixed(5)), ptotal: Number(res.totalPower.toFixed(4)),
  });

  const meterReading = meter === 'fuente'
    ? { v: res.terminalVoltage, i: res.totalCurrent, label: 'Bornes de la batería' }
    : { v: els[Number(meter) - 1].voltage, i: els[Number(meter) - 1].current, label: `R${meter}` };

  let schematic;
  if (topology === 'serie') {
    schematic = (
      <g>
        <path d="M80 60 H560 V260 H80 Z" fill="none" stroke={wire} strokeWidth="3" />
        <Battery x={80} y={160} emf={emf} />
        {[150, 300, 450].map((x, i) => (
          <g key={i}><Bulb x={x} y={60} power={els[i].power} label={`R${i + 1} = ${R[i]} Ω`} on={els[i].active} /><Switch x={x + 70} y={60} closed={closed[i]} onToggle={() => toggle(i)} label={`Interruptor de R${i + 1}`} /></g>
        ))}
        <text x={330} y={170} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>En serie hay un solo camino: todos los elementos e interruptores están en él.</text>
        <Switch x={330} y={260} closed={main} onToggle={() => setMain((m) => !m)} label="Interruptor general" />
        <text x={330} y={300} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Interruptor general</text>
      </g>
    );
  } else if (topology === 'paralelo') {
    schematic = (
      <g>
        <path d="M80 60 H520 M80 260 H520 M80 60 V260" fill="none" stroke={wire} strokeWidth="3" />
        {[240, 380, 520].map((x, i) => <line key={i} x1={x} y1={60} x2={x} y2={260} stroke={els[i].active ? 'var(--accent)' : 'var(--ink-2)'} strokeWidth="3" />)}
        <Battery x={80} y={160} emf={emf} />
        <Switch x={150} y={60} closed={main} onToggle={() => setMain((m) => !m)} label="Interruptor general" />
        {[240, 380, 520].map((x, i) => (
          <g key={i}><Switch x={x} y={110} closed={closed[i]} onToggle={() => toggle(i)} label={`Interruptor de R${i + 1}`} vertical /><Bulb x={x} y={190} power={els[i].power} label={`R${i + 1} = ${R[i]} Ω`} on={els[i].active} /></g>
        ))}
      </g>
    );
  } else {
    schematic = (
      <g>
        <path d="M80 60 H520 M300 260 H520 M80 260 H300 M80 60 V260" fill="none" stroke={wire} strokeWidth="3" />
        {[380, 520].map((x, k) => <line key={k} x1={x} y1={60} x2={x} y2={260} stroke={els[k + 1].active ? 'var(--accent)' : 'var(--ink-2)'} strokeWidth="3" />)}
        <Battery x={80} y={160} emf={emf} />
        <Bulb x={230} y={60} power={els[0].power} label={`R1 = ${R[0]} Ω`} on={els[0].active} />
        <Switch x={160} y={260} closed={closed[0]} onToggle={() => toggle(0)} label="Interruptor de R1" />
        <Switch x={240} y={260} closed={main} onToggle={() => setMain((m) => !m)} label="Interruptor general" />
        {[380, 520].map((x, k) => (
          <g key={k}><Switch x={x} y={110} closed={closed[k + 1]} onToggle={() => toggle(k + 1)} label={`Interruptor de R${k + 2}`} vertical /><Bulb x={x} y={190} power={els[k + 1].power} label={`R${k + 2} = ${R[k + 1]} Ω`} on={els[k + 1].active} /></g>
        ))}
        <circle cx={380} cy={60} r={5} fill="var(--ink)" /><circle cx={380} cy={260} r={5} fill="var(--ink)" />
        <text x={450} y={300} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>R2 y R3 en paralelo; ese grupo, en serie con R1</text>
      </g>
    );
  }

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 310" role="group" aria-labelledby="cir-t">
            <title id="cir-t">Esquema del circuito {topology}. Los interruptores se pueden accionar con clic o con la tecla Enter.</title>
            <desc>{`Corriente total ${fmt(res.totalCurrent, 3)} A. ${els.map((e) => `R${e.id}: ${fmt(e.voltage, 2)} V, ${fmt(e.current, 3)} A`).join('; ')}.`}</desc>
            {schematic}
          </svg>
        </div>
        <Readout items={[
          { k: 'Resistencia equivalente', v: res.equivalentResistance === null ? 'circuito abierto' : `${fmt(res.equivalentResistance, 2)} Ω` },
          { k: 'Corriente total', v: `${fmt(res.totalCurrent, 3)} A`, data: true },
          { k: 'Voltaje en bornes', v: `${fmt(res.terminalVoltage, 2)} V` },
          { k: 'Potencia en resistores', v: `${fmt(res.totalPower, 2)} W` },
          { k: 'Pérdida en la batería', v: `${fmt(res.internalLoss, 3)} W` },
        ]} />
        <Warnings list={res.warnings} />
        <div className="table-wrap">
          <table>
            <caption>Mediciones por elemento (instrumentos ideales)</caption>
            <thead><tr><th>Elemento</th><th className="n">R (Ω)</th><th className="n">V (V)</th><th className="n">I (A)</th><th className="n">P (W)</th><th>Estado</th></tr></thead>
            <tbody>
              {els.map((e) => (
                <tr key={e.id}><td>R{e.id}</td><td className="n">{fmt(e.resistance, 0)}</td><td className="n">{fmt(e.voltage, 3)}</td><td className="n">{fmt(e.current, 4)}</td><td className="n">{fmt(e.power, 3)}</td><td>{e.active ? 'encendida' : 'apagada'}</td></tr>
              ))}
              <tr><td>Suma</td><td className="n">—</td><td className="n">{fmt(els.reduce((s, e) => s + e.voltage, 0), 3)}</td><td className="n">{topology === 'serie' ? '—' : fmt(els.reduce((s, e) => s + e.current, 0), 4)}</td><td className="n">{fmt(res.totalPower, 3)}</td><td className="small muted">{topology === 'serie' ? 'Σ V: compara con ε − I·r' : topology === 'paralelo' ? 'Σ I: compara con I total' : 'V₁ + V₂ = ε − I·r; I₂ + I₃ = I₁'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Segmented label="Configuración" value={topology} onChange={setTopology} options={[{ value: 'serie', label: 'Serie' }, { value: 'paralelo', label: 'Paralelo' }, { value: 'mixto', label: 'Mixto' }]} />
          <Slider label="fem de la batería (ε)" value={emf} min={CIRCUIT_LIMITS.emf[0]} max={CIRCUIT_LIMITS.emf[1]} step={0.5} unit="V" decimals={1} onChange={setEmf} />
          <Slider label="Resistencia interna (r)" value={r} min={CIRCUIT_LIMITS.internalResistance[0]} max={CIRCUIT_LIMITS.internalResistance[1]} step={0.1} unit="Ω" decimals={1} onChange={setR} />
          {[0, 1, 2].map((i) => (
            <Slider key={i} label={`R${i + 1}`} value={R[i]} min={CIRCUIT_LIMITS.resistance[0]} max={CIRCUIT_LIMITS.resistance[1]} step={1} unit="Ω" decimals={0} onChange={(v) => setRi(i, v)} />
          ))}
          <div className="btn-row">
            {[0, 1, 2].map((i) => <button key={i} type="button" className="btn small" aria-pressed={closed[i]} onClick={() => toggle(i)}>R{i + 1}: {closed[i] ? 'cerrado' : 'abierto'}</button>)}
            <button type="button" className="btn small" aria-pressed={main} onClick={() => setMain((m) => !m)}>General: {main ? 'cerrado' : 'abierto'}</button>
          </div>
        </div>
        <div className="card stack-sm">
          <h3>Multímetro</h3>
          <Segmented label="Conectar a" value={meter} onChange={setMeter} options={[{ value: '1', label: 'R1' }, { value: '2', label: 'R2' }, { value: '3', label: 'R3' }, { value: 'fuente', label: 'Batería' }]} />
          <Readout items={[{ k: `Voltímetro (${meterReading.label})`, v: `${fmt(meterReading.v, 2)} V`, data: true }, { k: `Amperímetro (${meterReading.label})`, v: `${fmt(meterReading.i, 3)} A`, data: true }]} />
          <RecordButton onRecord={record} />
        </div>
        <Notice>Resistores óhmicos e instrumentos ideales. El brillo se estima a partir de la potencia; un filamento real cambia su resistencia al calentarse.</Notice>
      </div>
    </div>
  );
}

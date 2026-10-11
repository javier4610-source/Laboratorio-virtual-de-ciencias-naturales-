import { useMemo, useState, type KeyboardEvent } from 'react';
import { brightness, CIRCUIT_LIMITS, solveCircuit, type Topology } from '../models/circuits';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';

function CircuitDefs() {
  return (
    <defs>
      <radialGradient id="cir-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff3b0" stopOpacity="0.95" />
        <stop offset="0.45" stopColor="#ffd54a" stopOpacity="0.45" />
        <stop offset="1" stopColor="#ffd54a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="cir-cell" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#151b1d" />
        <stop offset="0.35" stopColor="#4a5458" />
        <stop offset="0.6" stopColor="#262e31" />
        <stop offset="1" stopColor="#0e1314" />
      </linearGradient>
      <linearGradient id="cir-copper" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#8a4b12" />
        <stop offset="0.35" stopColor="#f0a85a" />
        <stop offset="0.65" stopColor="#c46f22" />
        <stop offset="1" stopColor="#6f3a0c" />
      </linearGradient>
      <linearGradient id="cir-case" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffd34d" />
        <stop offset="1" stopColor="#e0a800" />
      </linearGradient>
    </defs>
  );
}

/** Cable aislado: trazo grueso con un brillo fino encima. */
function Wire({ d, active }: { d: string; active: boolean }) {
  return (
    <g>
      <path d={d} fill="none" stroke={active ? 'var(--accent)' : 'var(--ink-2)'} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.4" strokeLinejoin="round" transform="translate(0 -1)" />
    </g>
  );
}

/** Color del filamento: de rojo apagado a blanco amarillento según el brillo. */
function filamentColor(b: number) {
  if (b <= 0.02) return '#6d5a4a';
  const mix = (a: number, c: number) => Math.round(a + (c - a) * b);
  return `rgb(${mix(255, 255)}, ${mix(120, 248)}, ${mix(40, 200)})`;
}

/** Bombillo incandescente en su portabombillo. El portabombillo queda sobre el cable en (x, y). */
function Bulb({ x, y, power, label, on, vertical }: { x: number; y: number; power: number; label: string; on: boolean; vertical?: boolean }) {
  const b = on ? brightness(power) : 0;
  const glass = `M${x - 6} ${y - 15} C${x - 6} ${y - 19} ${x - 13} ${y - 22} ${x - 13} ${y - 30} A13 13 0 1 1 ${x + 13} ${y - 30} C${x + 13} ${y - 22} ${x + 6} ${y - 19} ${x + 6} ${y - 15} Z`;
  return (
    <g>
      <g transform={vertical ? `rotate(90 ${x} ${y})` : undefined}>
        {b > 0.02 && <circle cx={x} cy={y - 31} r={20 + 30 * b} fill="url(#cir-halo)" opacity={0.25 + 0.75 * b} />}
        {/* portabombillo con bornes de tornillo */}
        <rect x={x - 18} y={y - 6} width={36} height={13} rx={3} fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
        {[-12, 12].map((dx) => <circle key={dx} cx={x + dx} cy={y + 0.5} r={2.8} fill="url(#kit-metal)" stroke="#5d6b70" strokeWidth="0.6" />)}
        {/* casquillo roscado */}
        <rect x={x - 6.5} y={y - 16} width={13} height={10} rx={1.5} fill="url(#kit-metal-h)" stroke="#7d8a8f" strokeWidth="0.5" />
        {[-13, -10, -7.5].map((dy) => <line key={dy} x1={x - 6.5} x2={x + 6.5} y1={y + dy} y2={y + dy + 1} stroke="#7d8a8f" strokeWidth="0.7" />)}
        {/* ampolla de vidrio */}
        <path d={glass} fill={b > 0.02 ? `rgba(255, 236, 160, ${0.3 + 0.6 * b})` : 'url(#kit-glass-fill)'} />
        <path d={`M${x - 2} ${y - 16} L${x - 4} ${y - 29} M${x + 2} ${y - 16} L${x + 4} ${y - 29}`} stroke="#8d9a9f" strokeWidth="0.8" />
        <path d={`M${x - 4} ${y - 29} l1.6 -2.4 l1.6 2.4 l1.6 -2.4 l1.6 2.4 l1.6 -2.4`} fill="none" stroke={filamentColor(b)} strokeWidth={b > 0.02 ? 1.5 : 1} strokeLinejoin="round" />
        <path d={glass} fill="url(#kit-glass)" stroke="var(--glass-edge)" strokeWidth="1.2" />
        <path d={`M${x - 8} ${y - 34} A9 9 0 0 1 ${x - 2} ${y - 40}`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      </g>
      <text x={vertical ? x + 8 : x} y={y + (vertical ? 34 : 28)} textAnchor={vertical ? 'start' : 'middle'} style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' }}>{label}</text>
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
        {/* base de porcelana */}
        <rect x={x - 21} y={y - 5} width={42} height={12} rx={3} fill="url(#kit-body)" stroke="#a9b4b6" filter="url(#kit-shadow-soft)" />
        {/* pinza fija y pivote */}
        <rect x={x + 11} y={y - 6} width={6} height={9} rx={1} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.6" />
        <circle cx={x - 14} cy={y} r={3.6} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.8" />
        {/* cuchilla */}
        <g transform={`rotate(${closed ? 0 : -38} ${x - 14} ${y})`}>
          <rect x={x - 14} y={y - 1.8} width={31} height={3.6} rx={1.2} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.6" />
          <rect x={x + 15} y={y - 4} width={7} height={8} rx={2} fill={closed ? 'var(--ok)' : 'var(--bad)'} />
        </g>
        <circle cx={x - 14} cy={y} r={1.4} fill="#3a4448" />
      </g>
    </g>
  );
}

/** Pila cilíndrica vertical: polo positivo arriba. */
function Battery({ x, y, emf }: { x: number; y: number; emf: number }) {
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x - 5} y={y - 36} width={10} height={5} rx={1.5} fill="url(#kit-metal-h)" />
        <rect x={x - 15} y={y - 32} width={30} height={64} rx={4} fill="url(#cir-cell)" />
        <rect x={x - 15} y={y - 32} width={30} height={18} rx={4} fill="url(#cir-copper)" />
        <rect x={x - 15} y={y + 28} width={30} height={5} rx={2} fill="url(#kit-metal-h)" />
      </g>
      <text x={x - 24} y={y + 4} textAnchor="end" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>{fmt(emf, 1)} V</text>
      <text x={x + 20} y={y - 20} style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>+</text>
      <text x={x + 20} y={y + 30} style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>−</text>
    </g>
  );
}

type Pt = [number, number];

const meterJacks = (x: number, y: number): [Pt, Pt] => [[x + 30, y + 104], [x + 66, y + 104]];

/** Puntas del multímetro (se dibujan debajo del circuito para no tapar las etiquetas). */
function MeterLeads({ x, y, probes }: { x: number; y: number; probes: [Pt, Pt] }) {
  const jacks = meterJacks(x, y);
  const lead = (from: Pt, to: Pt) => `M${from[0]} ${from[1]} C${from[0] + Math.sign(to[0] - from[0]) * 50} ${from[1] + 34}, ${to[0]} ${to[1] + (to[1] < from[1] ? 80 : -40)}, ${to[0]} ${to[1]}`;
  return (
    <g>
      <path d={lead(jacks[0], probes[0])} fill="none" stroke="#c62828" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
      <path d={lead(jacks[1], probes[1])} fill="none" stroke="#8c979b" strokeWidth="3.8" strokeLinecap="round" opacity="0.7" />
      <path d={lead(jacks[1], probes[1])} fill="none" stroke="#1f2628" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

/** Multímetro digital: pantalla con voltaje y corriente del elemento elegido. */
function Multimeter({ x, y, v, i, probes }: { x: number; y: number; v: number; i: number; probes: [Pt, Pt] }) {
  const w = 96, h = 116;
  const jacks = meterJacks(x, y);
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={w} height={h} rx={12} fill="url(#cir-case)" stroke="#b58800" />
        <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={8} fill="#2b3336" />
      </g>
      <rect x={x + 11} y={y + 11} width={w - 22} height={36} rx={3} fill="#c9d6b8" stroke="#1a2022" />
      <text x={x + w - 15} y={y + 26} textAnchor="end" style={{ fontSize: 12, fill: '#1c2618', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{fmt(v, 2)} V</text>
      <text x={x + w - 15} y={y + 42} textAnchor="end" style={{ fontSize: 12, fill: '#1c2618', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{fmt(i, 3)} A</text>
      <circle cx={x + w / 2} cy={y + 70} r={14} fill="url(#kit-body-dark)" stroke="#11171a" />
      <rect x={x + w / 2 - 2} y={y + 57} width={4} height={13} rx={2} fill="#e6eaeb" />
      {Array.from({ length: 9 }, (_, k) => {
        const a = (-150 + k * 37.5) * (Math.PI / 180);
        return <line key={k} x1={x + w / 2 + 17 * Math.sin(a)} y1={y + 70 - 17 * Math.cos(a)} x2={x + w / 2 + 20 * Math.sin(a)} y2={y + 70 - 20 * Math.cos(a)} stroke="#c9d2d5" strokeWidth="1" />;
      })}
      <circle cx={jacks[0][0]} cy={jacks[0][1]} r={4.2} fill="#c62828" stroke="#11171a" />
      <circle cx={jacks[1][0]} cy={jacks[1][1]} r={4.2} fill="#11171a" stroke="#5d6b70" />
      {probes.map(([px, py], k) => <circle key={k} cx={px} cy={py} r={3.4} fill={k === 0 ? '#c62828' : '#1f2628'} stroke="#fff" strokeWidth="1" />)}
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

  const record = () => api.addTrial('medidas', {
    config: topology, emf, r1: R[0], r2: R[1], r3: R[2],
    req: res.equivalentResistance === null ? null : Number(res.equivalentResistance.toFixed(4)),
    itotal: Number(res.totalCurrent.toFixed(5)), vbornes: Number(res.terminalVoltage.toFixed(4)),
    v1: Number(els[0].voltage.toFixed(4)), i1: Number(els[0].current.toFixed(5)), ptotal: Number(res.totalPower.toFixed(4)),
  });

  const meterReading = meter === 'fuente'
    ? { v: res.terminalVoltage, i: res.totalCurrent, label: 'Bornes de la batería' }
    : { v: els[Number(meter) - 1].voltage, i: els[Number(meter) - 1].current, label: `R${meter}` };

  const pos: [number, number, boolean][] = topology === 'serie'
    ? [[150, 60, false], [300, 60, false], [450, 60, false]]
    : topology === 'paralelo' ? [[240, 190, true], [380, 190, true], [520, 190, true]] : [[230, 60, false], [380, 190, true], [520, 190, true]];
  const probes: [Pt, Pt] = meter === 'fuente'
    ? [[80, 124], [80, 194]]
    : (() => { const [px, py, vert] = pos[Number(meter) - 1]; return vert ? [[px - 0.5, py - 12], [px - 0.5, py + 12]] : [[px - 12, py + 0.5], [px + 12, py + 0.5]]; })();
  const meterAt: Pt = topology === 'serie' ? [282, 116] : [110, 92];

  let schematic;
  if (topology === 'serie') {
    schematic = (
      <g>
        <Wire d="M80 60 H560 V260 H80 Z" active={flowing} />
        <Battery x={80} y={160} emf={emf} />
        {[150, 300, 450].map((x, i) => (
          <g key={i}><Bulb x={x} y={60} power={els[i].power} label={`R${i + 1} = ${R[i]} Ω`} on={els[i].active} /><Switch x={x + 70} y={60} closed={closed[i]} onToggle={() => toggle(i)} label={`Interruptor de R${i + 1}`} /></g>
        ))}
        <text x={330} y={110} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' }}>En serie hay un solo camino: todos los elementos e interruptores están en él.</text>
        <Switch x={330} y={260} closed={main} onToggle={() => setMain((m) => !m)} label="Interruptor general" />
        <text x={330} y={300} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Interruptor general</text>
      </g>
    );
  } else if (topology === 'paralelo') {
    schematic = (
      <g>
        <Wire d="M80 60 H520 M80 260 H520 M80 60 V260" active={flowing} />
        {[240, 380, 520].map((x, i) => <Wire key={i} d={`M${x} 60 V260`} active={els[i].active} />)}
        <Battery x={80} y={160} emf={emf} />
        <Switch x={150} y={60} closed={main} onToggle={() => setMain((m) => !m)} label="Interruptor general" />
        {[240, 380, 520].map((x, i) => (
          <g key={i}><Switch x={x} y={110} closed={closed[i]} onToggle={() => toggle(i)} label={`Interruptor de R${i + 1}`} vertical /><Bulb x={x} y={190} power={els[i].power} label={`R${i + 1} = ${R[i]} Ω`} on={els[i].active} vertical /></g>
        ))}
      </g>
    );
  } else {
    schematic = (
      <g>
        <Wire d="M80 60 H520 M300 260 H520 M80 260 H300 M80 60 V260" active={flowing} />
        {[380, 520].map((x, k) => <Wire key={k} d={`M${x} 60 V260`} active={els[k + 1].active} />)}
        <Battery x={80} y={160} emf={emf} />
        <Bulb x={230} y={60} power={els[0].power} label={`R1 = ${R[0]} Ω`} on={els[0].active} />
        <Switch x={160} y={260} closed={closed[0]} onToggle={() => toggle(0)} label="Interruptor de R1" />
        <Switch x={240} y={260} closed={main} onToggle={() => setMain((m) => !m)} label="Interruptor general" />
        {[380, 520].map((x, k) => (
          <g key={k}><Switch x={x} y={110} closed={closed[k + 1]} onToggle={() => toggle(k + 1)} label={`Interruptor de R${k + 2}`} vertical /><Bulb x={x} y={190} power={els[k + 1].power} label={`R${k + 2} = ${R[k + 1]} Ω`} on={els[k + 1].active} vertical /></g>
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
            <CircuitDefs />
            <rect x={22} y={14} width={596} height={272} rx={12} fill="var(--surface-2)" opacity="0.7" stroke="var(--line)" />
            <MeterLeads x={meterAt[0]} y={meterAt[1]} probes={probes} />
            {schematic}
            <Multimeter x={meterAt[0]} y={meterAt[1]} v={meterReading.v} i={meterReading.i} probes={probes} />
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

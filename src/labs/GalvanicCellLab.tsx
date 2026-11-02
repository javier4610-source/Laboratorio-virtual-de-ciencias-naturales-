import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cell, cellConditions, discharge, FARADAY, halfCell, HALF_CELLS, initialMass, NERNST_SLOPE, PC_LIMITS, type CellInput,
} from '../models/electrochemicalCell';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText, SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { cellScene, METAL_COLOR } from './galvanic3d';

/** Minutos simulados por segundo real durante la descarga. */
const SPEED = 10;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'En una pila, los electrones viajan por el puente salino de un vaso al otro.', answer: 'falso', feedback: 'Los electrones solo viajan por el cable metálico (del ánodo al cátodo). Por el puente salino se mueven IONES: los cationes hacia el cátodo y los aniones hacia el ánodo, y así cada solución sigue siendo neutra.' },
  { id: 'i2', text: 'El electrodo de cinc pierde masa mientras la pila de Daniell funciona.', answer: 'cierto', feedback: 'El cinc se oxida (Zn → Zn²⁺ + 2 e⁻) y sus átomos pasan a la solución como iones. Con 50 mA durante 2 h pierde 0,122 g, lo que se mide con una balanza de 0,001 g.' },
  { id: 'i3', text: 'Una pila más grande (con electrodos y vasos más grandes) da más voltaje.', answer: 'falso', feedback: 'El voltaje depende de los metales y de las concentraciones (E° y Nernst), no del tamaño. Una pila más grande puede entregar corriente durante más tiempo porque tiene más reactivos.' },
  { id: 'i4', text: 'Si se diluye la solución de Cu²⁺, el voltaje de la pila de Daniell baja un poco.', answer: 'cierto', feedback: 'Según Nernst, bajar [Cu²⁺] de 1,0 a 0,010 mol/L resta (0,05916/2)·log(100) = 0,059 V: de 1,104 V a 1,045 V. El cambio es pequeño porque la concentración entra en un logaritmo.' },
  { id: 'i5', text: 'La pila se «gasta» porque se le acaban los electrones.', answer: 'falso', feedback: 'Los electrones no se crean ni se gastan: pasan del metal que se oxida al ion que se reduce. La pila deja de funcionar cuando se agota un reactivo (el ion del cátodo o el metal del ánodo) o cuando el voltaje cae por Nernst.' },
];

/* ------------------------------------------------------------------ banco 2D */

function CellBench({ left, right, cLeft, cRight, bridge, voltmeter, current, running, anode }: { left: string; right: string; cLeft: number; cRight: number; bridge: string; voltmeter: number; current: number; running: boolean; anode: 'left' | 'right' | null }) {
  const L = halfCell(left), R = halfCell(right);
  const beaker = (x: number, h: typeof L, c: number, side: 'left' | 'right') => (
    <g>
      <rect x={x} y={150} width={150} height={130} rx="8" fill={h.metal === 'Cu' ? '#4fa3e0' : h.ionColor} opacity={h.metal === 'Cu' ? Math.min(0.75, 0.15 + 0.55 * Math.min(1, c)) : 0.45} />
      <path d={`M${x} 110 V272 Q${x} 288 ${x + 16} 288 H${x + 134} Q${x + 150} 288 ${x + 150} 272 V110`} fill="none" stroke="var(--ink-2)" strokeWidth="2.5" />
      <rect x={x + 55} y={80} width={22} height={170} fill={METAL_COLOR[h.metal]} stroke="var(--ink)" />
      <text x={x + 75} y={305} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)' }}>{h.metal} | {h.ion} {fmt(c, 3)} M</text>
      {anode && <text x={x + 66} y={72} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>{anode === side ? 'ánodo (−)' : 'cátodo (+)'}</text>}
    </g>
  );
  return (
    <svg viewBox="0 0 660 320" role="img" aria-labelledby="pil-b-t pil-b-d">
      <title id="pil-b-t">Pila galvánica: dos vasos con electrodos, puente salino, cable y voltímetro</title>
      <desc id="pil-b-d">{`Izquierda: ${L.name} en ${L.ion} ${fmt(cLeft, 3)} mol/L. Derecha: ${R.name} en ${R.ion} ${fmt(cRight, 3)} mol/L. Puente salino: ${bridge === 'ninguno' ? 'ninguno' : bridge}. ${current > 0 ? `Carga de ${current} mA conectada${running ? ', circula corriente' : ''}.` : `Voltímetro: ${fmt(voltmeter, 3)} V.`}`}</desc>
      <rect width="660" height="320" rx="14" fill="var(--surface-2)" />
      {beaker(70, L, cLeft, 'left')}
      {beaker(440, R, cRight, 'right')}
      {bridge !== 'ninguno' && <path d="M185 200 V120 H475 V200" fill="none" stroke="var(--line-strong)" strokeWidth="18" strokeLinejoin="round" opacity="0.8" />}
      {bridge !== 'ninguno' && <text x="330" y="112" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)' }}>puente salino ({bridge === 'KNO3' ? 'KNO₃' : 'KCl'})</text>}
      <path d="M136 80 V30 H290 M370 30 H506 V80" fill="none" stroke="var(--ink-2)" strokeWidth="2.5" />
      <rect x="290" y="12" width="80" height="38" rx="6" fill="var(--surface)" stroke="var(--ink)" />
      <text x="330" y="37" textAnchor="middle" style={{ fontSize: 15, fontFamily: 'var(--font-data)', fill: 'var(--ink)', fontWeight: 700 }}>{current > 0 ? `${current} mA` : `${fmt(voltmeter, 3)} V`}</text>
      <circle cx="294" cy="50" r="4" fill="var(--ink)" /><circle cx="366" cy="50" r="4" fill="var(--bad)" />
      <text x="282" y="64" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>COM</text><text x="362" y="64" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>+</text>
      {running && anode && <text x="330" y="80" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--data)' }}>{anode === 'left' ? 'e⁻ →' : '← e⁻'}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function GalvanicCellLab({ api }: LabProps) {
  const [left, setLeft] = useState('zn');
  const [right, setRight] = useState('cu');
  const [cLeft, setCLeft] = useState(1);
  const [cRight, setCRight] = useState(1);
  const [bridge, setBridge] = useState<CellInput['bridge']>('KNO3');
  const [volume, setVolume] = useState(100);
  const [current, setCurrent] = useState(50);
  const [timeMin, setTimeMin] = useState(120);
  const [vMeasured, setVMeasured] = useState(false);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [weighed, setWeighed] = useState(false);
  const raf = useRef(0);
  const { measure, remeasure, real } = useMeasure();

  const input = useMemo(() => ({ left, right, cLeft, cRight, bridge, volumeML: volume, currentMA: current, timeMin }), [left, right, cLeft, cRight, bridge, volume, current, timeMin]);
  const c = useMemo(() => cell(input), [input]);
  const conds = useMemo(() => cellConditions(input), [input]);
  const state = useMemo(() => discharge(input, t), [input, t]);
  const L = halfCell(left), R = halfCell(right);
  const volt = instrument('pila-electroquimica', 'voltimetro'), bal = instrument('pila-electroquimica', 'balanza');
  const vRead = measure(c.voltmeter, { ...volt, key: 'voltaje' });
  const mL = measure(state.massLeft, { ...bal, key: 'masaIzq' }), mR = measure(state.massRight, { ...bal, key: 'masaDer' });
  const m0L = measure(initialMass(L), { ...bal, key: 'masaIzq0' }), m0R = measure(initialMass(R), { ...bal, key: 'masaDer0' });

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); setWeighed(false); };
  useEffect(resetRun, [input]);
  useEffect(() => setVMeasured(false), [left, right, cLeft, cRight, bridge]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(timeMin); setRunning(false); return; }
    const start = performance.now() - (t / SPEED) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * SPEED;
      if (el >= timeMin) { setT(timeMin); setRunning(false); playSound('click', { intensity: 0.6 }); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, timeMin]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= timeMin && !running && timeMin > 0;
  const status = simStatusOf(running, t > 0, finished);

  usePublishModel(() => ({
    vars: {
      E0: { sym: 'E°', name: 'fem estándar de la pila', value: c.E0, unit: 'V', decimals: 4 },
      N: { sym: 'n', name: 'Electrones transferidos', value: c.N, unit: '', decimals: 0 },
      Q: { sym: 'Q', name: 'Cociente de reacción', value: c.Q, unit: '', sig: 3 },
      E: { sym: 'E', name: 'fem (Nernst, 25 °C)', value: c.E, unit: 'V', decimals: 4 },
    },
    equations: [{ title: 'Ecuación de Nernst (25 °C)', lhs: 'E', expr: '[E0] − \\frac{0{,}05916}{[N]}·\\log [Q]' }],
  }), [c]);

  const phase = (t * 0.35) % 1;
  const scene = useMemo(() => cellScene({ input, cell: c, state, phase, running }), [input, c, state, phase, running]);
  const logQ = c.anode ? Math.log10(c.Q) : 0;

  const recordV = () => api.addTrial('voltajes', {
    izquierda: L.metal, derecha: R.metal, cIzq: cLeft, cDer: cRight, puente: bridge === 'KNO3' ? 'KNO₃' : bridge,
    E0: Number(c.E0.toFixed(4)), voltaje: vRead, Enernst: Number(c.E.toFixed(4)), logQ: Number(logQ.toFixed(3)),
  });
  const recordD = () => api.addTrial('descarga', {
    pila: `${L.metal} | ${R.metal}`, corriente: current, tiempo: Number(t.toFixed(1)), carga: Number(state.charge.toFixed(1)),
    dmIzq: Number((mL - m0L).toFixed(3)), dmDer: Number((mR - m0R).toFixed(3)),
    dmTeoricaCatodo: Number((c.cathode === 'left' ? state.dLeft : state.dRight).toFixed(4)), fem: Number(state.E.toFixed(4)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench"><CellBench left={left} right={right} cLeft={state.cLeft} cRight={state.cRight} bridge={bridge} voltmeter={vMeasured ? vRead : 0} current={t > 0 ? current : 0} running={running} anode={c.anode} /></div>
        <Readout items={[
          { k: 'Voltímetro (circuito abierto)', v: vMeasured ? `${fmt(vRead, 3)} V` : 'mide', data: true, resolution: vMeasured ? resolutionText(volt.resolution, 'V') : undefined, state: vMeasured ? (vRead < 0 ? 'warn' : 'ok') : undefined },
          { k: 'E° de la pila (tabla)', v: c.anode ? `${fmt(c.E0, 4)} V` : '0 V' },
          { k: 'fem con Nernst (25 °C)', v: `${fmt(c.E, 4)} V` },
          { k: 'Ánodo y cátodo', v: c.anode ? `ánodo: ${c.anode === 'left' ? L.name : R.name}; cátodo: ${c.cathode === 'left' ? L.name : R.name}` : '—' },
          { k: 'Reacción global', v: c.reaction },
          { k: 'Semirreacciones', v: c.anode ? `${c.anodeHalf}; ${c.cathodeHalf}` : '—' },
        ]} />
        <Readout items={[
          { k: 'Tiempo con la carga', v: `${fmt(t, 1)} min de ${fmt(timeMin, 0)} min` },
          { k: 'Carga Q = I·t', v: `${fmt(state.charge, 1)} C (${fmt(state.electronsMol * 1000, 3)} mmol de e⁻)` },
          { k: `Masa del electrodo de ${L.name}`, v: weighed ? `${fmt(mL, 3)} g (antes ${fmt(m0L, 3)} g)` : 'pesa', data: true, resolution: weighed ? resolutionText(bal.resolution, 'g') : undefined },
          { k: `Masa del electrodo de ${R.name}`, v: weighed ? `${fmt(mR, 3)} g (antes ${fmt(m0R, 3)} g)` : 'pesa', data: true, resolution: weighed ? resolutionText(bal.resolution, 'g') : undefined },
          { k: 'Δm calculada con Faraday (cátodo)', v: c.cathode ? `${fmt(c.cathode === 'left' ? state.dLeft : state.dRight, 4)} g` : '—' },
          { k: 'Concentraciones ahora', v: `${L.ion} ${fmt(state.cLeft, 4)} M; ${R.ion} ${fmt(state.cRight, 4)} M` },
          { k: 'fem ahora (Nernst)', v: `${fmt(state.E, 4)} V` },
        ]} />
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="pil-3d-h">
          <h3 id="pil-3d-h">Vista 3D: electrones por el cable, iones por el puente</h3>
          <Scene3D idPrefix="pil" title="Pila galvánica en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={360} initialOrbit={{ yaw: 0.25, pitch: 0.35 }} status="modelo"
            statusNote="Concentraciones, masas y sentido de electrones e iones salen del modelo (Nernst y Faraday); el grosor de los electrodos exagera ×20 el cambio de masa y las partículas son pocas y no están a escala." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="pil" intro="Ideas frecuentes sobre las pilas. Decide si son ciertas o falsas y compruébalo con el voltímetro, la balanza y la vista 3D." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Semiceldas</h3>
          <Select label="Electrodo izquierdo (COM)" value={left} onChange={setLeft} options={HALF_CELLS.map((h) => ({ value: h.id, label: `${h.metal} en ${h.ion} (E° = ${fmt(h.E0, 4)} V)` }))} />
          <Slider label={`Concentración de ${L.ion} (izquierda)`} value={cLeft} min={PC_LIMITS.conc[0]} max={PC_LIMITS.conc[1]} step={0.001} unit="mol/L" decimals={3} onChange={setCLeft} />
          <Select label="Electrodo derecho (+)" value={right} onChange={setRight} options={HALF_CELLS.map((h) => ({ value: h.id, label: `${h.metal} en ${h.ion} (E° = ${fmt(h.E0, 4)} V)` }))} />
          <Slider label={`Concentración de ${R.ion} (derecha)`} value={cRight} min={PC_LIMITS.conc[0]} max={PC_LIMITS.conc[1]} step={0.001} unit="mol/L" decimals={3} onChange={setCRight} />
          <Segmented<CellInput['bridge']> label="Puente salino" value={bridge} onChange={setBridge} options={[{ value: 'KNO3', label: 'KNO₃' }, { value: 'KCl', label: 'KCl' }, { value: 'ninguno', label: 'Ninguno' }]} />
          <button type="button" className="btn primary" onClick={() => { remeasure('voltaje'); setVMeasured(true); playSound('click', { intensity: 0.5 }); }}>Medir el voltaje</button>
          <RecordButton onRecord={recordV} disabled={!vMeasured} label="Guardar el voltaje en la tabla" />
          <Notice>{real ? 'Instrumento real: repite la medición; cada lectura trae el error típico del voltímetro.' : 'Voltímetro de 0,001 V: COM a la izquierda, borne rojo (+) a la derecha.'} E° del CRC Handbook a 25 °C.</Notice>
        </div>
        <div className="card stack">
          <h3>Descarga con corriente constante</h3>
          <Slider label="Volumen de cada solución" value={volume} min={PC_LIMITS.volume[0]} max={PC_LIMITS.volume[1]} step={10} unit="mL" decimals={0} onChange={setVolume} />
          <Slider label="Corriente de la carga" value={current} min={PC_LIMITS.current[0]} max={PC_LIMITS.current[1]} step={1} unit="mA" decimals={0} onChange={setCurrent} />
          <Slider label="Tiempo de funcionamiento" value={timeMin} min={PC_LIMITS.time[0]} max={PC_LIMITS.time[1]} step={5} unit="min" decimals={0} onChange={setTimeMin} />
          <SimControls title="Pila conectada a la carga" status={status} startLabel="Conectar la carga" repeatLabel="Conectar otra vez"
            onStart={() => { setT(0); setWeighed(false); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            disabled={timeMin === 0} progress={{ value: t, max: timeMin, unit: 'min', label: 't', decimals: 1 }} />
          <button type="button" className="btn" onClick={() => { remeasure('masaIzq', 'masaDer', 'masaIzq0', 'masaDer0'); setWeighed(true); playSound('click', { intensity: 0.4 }); }} disabled={running}>Lavar, secar y pesar los electrodos</button>
          <RecordButton onRecord={recordD} disabled={!weighed || t === 0} label="Guardar la descarga en la tabla" />
          <Notice>El reloj va {SPEED} min por segundo. m = I·t·M/(n·F), F = {fmt(FARADAY, 0)} C/mol; pendiente de Nernst {fmt(NERNST_SLOPE, 5)} V.</Notice>
        </div>
      </div>
    </div>
  );
}

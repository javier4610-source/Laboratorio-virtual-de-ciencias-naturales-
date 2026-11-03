import { useEffect, useMemo, useRef, useState } from 'react';
import {
  changeConditions, checkClassification, evaluateChange, findProcess, PROCESSES, ROOM_T, type ChangeId, type IronPrep,
} from '../models/chemicalChanges';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText, SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { Reaction3D } from '../chem';
import { SpeciesScene3D } from '../chem/SpeciesScene3D';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { changeReaction, physicalScene, REACTION_NOTE } from './cambios3d';

/** Cada proceso se recorre en unos 8 s de pantalla. */
const SCREEN_S = 8;
const UNIT: Record<string, string> = { s: 's', min: 'min', h: 'h' };

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Si salen burbujas, siempre hubo una reacción química.', answer: 'falso', feedback: 'Al hervir el agua salen burbujas de vapor de agua, la misma sustancia: es un cambio físico. Hay que reunir varias evidencias y comprobar si se formó una sustancia nueva.' },
  { id: 'i2', text: 'Cuando el azúcar se disuelve en agua, desaparece.', answer: 'falso', feedback: 'Las moléculas de sacarosa se separan y quedan entre las de agua, pero siguen ahí: el agua sabe dulce y al evaporarla se recupera la misma masa de azúcar.' },
  { id: 'i3', text: 'Cuando el hierro se oxida, la lana de acero pesa más que antes.', answer: 'cierto', feedback: 'El hierro se une al oxígeno del aire: la herrumbre pesa lo que pesaba el hierro más el oxígeno ganado (0,013 g en 50 mL de aire). Por eso el agua sube en la probeta: se consume el 21 % del aire.' },
  { id: 'i4', text: 'En una reacción química los átomos se destruyen y aparecen átomos nuevos.', answer: 'falso', feedback: 'Los átomos se conservan; se rompen y se forman ENLACES y los mismos átomos quedan organizados en sustancias nuevas. Cuenta los átomos en la tabla de la reacción 3D: son iguales a los dos lados.' },
  { id: 'i5', text: 'Cuando la vela arde, la cera simplemente se derrite y se evapora.', answer: 'falso', feedback: 'Parte de la cera se derrite (cambio físico), pero la que llega a la llama reacciona con el oxígeno y forma CO₂ y agua: el vaso frío se empaña y el agua de cal se enturbia.' },
];

const pick = (r: ReturnType<typeof evaluateChange>, k: string) => r.quantities.find((x) => x.key === k)?.value ?? 0;

function ChangeBench({ id, res, t }: { id: ChangeId; res: ReturnType<typeof evaluateChange>; t: number }) {
  const f = res.progress;
  const content = (() => {
    switch (id) {
      case 'vinagre-bicarbonato': {
        const v = pick(res, 'vGas');
        const r = 14 + Math.sqrt(Math.max(0, v)) * 2.2;
        return <>
          <path d="M150 270 V170 Q150 150 175 135 V110 H205 V135 Q230 150 230 170 V270 Z" fill="#eef6fb" stroke="var(--ink-2)" strokeWidth="2" />
          <rect x="152" y="215" width="76" height="55" fill="#f4e7c3" opacity="0.8" />
          {f > 0.02 && f < 0.98 && [0, 1, 2, 3].map((k) => <circle key={k} cx={165 + k * 16} cy={225 + ((k * 13) % 30)} r={3} fill="none" stroke="var(--ink-2)" />)}
          <ellipse cx="190" cy={110 - r * 0.9} rx={r * 0.8} ry={r} fill="var(--series-4)" opacity="0.75" />
          <text x="300" y="80" style={{ fontSize: 13, fill: 'var(--ink)' }}>globo: {fmt(v, 0)} mL</text>
        </>;
      }
      case 'precipitado': return <>
        <path d="M150 120 V262 Q150 272 160 272 H240 Q250 272 250 262 V120" fill="#eef6fb" stroke="var(--ink-2)" strokeWidth="2" />
        <rect x="152" y="160" width="96" height="110" fill="#ffffff" opacity={0.15 + 0.6 * f} />
        <rect x="152" y={262 - 10 * f} width="96" height={10 * f + 8} fill="#f7f7f2" stroke="var(--line-strong)" opacity={f} />
        <text x="270" y="200" style={{ fontSize: 13, fill: 'var(--ink)' }}>{f > 0.05 ? 'precipitado blanco (CaCO₃)' : 'dos líquidos transparentes'}</text>
      </>;
      case 'oxidacion-hierro': {
        const rise = pick(res, 'subida');
        return <>
          <rect x="100" y="210" width="220" height="60" fill="#cfe5f5" stroke="var(--ink-2)" />
          <rect x="190" y="60" width="40" height="190" fill="none" stroke="var(--ink-2)" strokeWidth="2" />
          <rect x="192" y={248 - rise * 2.2} width="36" height={rise * 2.2 + 2} fill="#cfe5f5" />
          <rect x="195" y="62" width="30" height="34" rx="6" fill={f > 0.5 ? '#9a4a1f' : f > 0.05 ? '#7d6a5c' : '#9aa0a6'} />
          <text x="245" y="80" style={{ fontSize: 13, fill: 'var(--ink)' }}>lana de acero</text>
          <text x="245" y={248 - rise * 2.2} style={{ fontSize: 13, fill: 'var(--ink)' }}>el agua subió {fmt(rise, 1)} mL</text>
        </>;
      }
      case 'vela': return <>
        <rect x="180" y={150 + 40 * f} width="40" height={120 - 40 * f} fill="#f6f1e1" stroke="var(--ink-2)" />
        <path d={`M200 ${150 + 40 * f} q -10 -20 0 -40 q 10 20 0 40`} fill="#f2a32b" />
        <path d="M140 60 H260 V120 Q260 130 250 130 H150 Q140 130 140 120 Z" fill="none" stroke="var(--ink-2)" strokeWidth="2" />
        {f > 0.05 && [0, 1, 2, 3, 4].map((k) => <circle key={k} cx={155 + k * 22} cy={118 - (k % 2) * 6} r={2.5} fill="#7fb6e6" />)}
        <text x="270" y="100" style={{ fontSize: 13, fill: 'var(--ink)' }}>vaso frío empañado</text>
        <rect x="290" y="190" width="50" height="80" fill={f > 0.05 ? '#f1f1ec' : '#eef6fb'} stroke="var(--ink-2)" />
        <text x="290" y="182" style={{ fontSize: 12, fill: 'var(--ink)' }}>agua de cal</text>
      </>;
      case 'disolver-azucar': {
        const left = pick(res, 'sinDisolver');
        return <>
          <path d="M140 110 V262 Q140 272 150 272 H250 Q260 272 260 262 V110" fill="#eef6fb" stroke="var(--ink-2)" strokeWidth="2" />
          <rect x="142" y="140" width="116" height="130" fill="#d6ecfa" opacity="0.6" />
          {Array.from({ length: Math.min(30, Math.ceil(left)) }, (_, k) => <rect key={k} x={150 + (k * 37) % 100} y={262 - Math.floor(k / 10) * 5} width="5" height="5" fill="#ffffff" stroke="var(--line-strong)" />)}
          <text x="275" y="200" style={{ fontSize: 13, fill: 'var(--ink)' }}>sin disolver: {fmt(left, 1)} g</text>
        </>;
      }
      case 'quemar-azucar': {
        const col = f < 0.15 ? '#fbfaf3' : f < 0.4 ? '#d9a441' : f < 0.6 ? '#7b4a1e' : '#1d1a17';
        return <>
          <ellipse cx="200" cy="170" rx="60" ry="18" fill="#c7cbd0" stroke="var(--ink-2)" />
          <rect x="255" y="164" width="110" height="10" rx="4" fill="#c7cbd0" stroke="var(--ink-2)" />
          <ellipse cx="200" cy="168" rx="40" ry="10" fill={col} />
          <path d="M200 260 q -16 -30 0 -60 q 16 30 0 60" fill="#4f86f7" opacity="0.7" />
          {f > 0.1 && [0, 1, 2].map((k) => <path key={k} d={`M${185 + k * 15} 150 q 8 -12 0 -24 q -8 -12 0 -24`} fill="none" stroke="var(--ink-3)" strokeWidth="2" />)}
        </>;
      }
      default: {
        const left = pick(res, 'queda');
        const top = 262 - Math.max(4, left * 0.6);
        return <>
          <rect x="120" y="270" width="160" height="16" rx="4" fill="var(--ink-2)" />
          <path d="M140 110 V262 Q140 268 146 268 H254 Q260 268 260 262 V110" fill="none" stroke="var(--ink-2)" strokeWidth="2" />
          <rect x="142" y={top} width="116" height={266 - top} fill="#7fb6e6" opacity="0.6" />
          {t > 0 && [0, 1, 2, 3].map((k) => <circle key={k} cx={155 + k * 28} cy={top + 15 + (k % 2) * 12} r={4} fill="none" stroke="var(--ink-2)" />)}
          <rect x="130" y="90" width="140" height="8" fill="#e6f2fb" stroke="var(--line-strong)" />
          {t > 0 && [0, 1, 2, 3, 4].map((k) => <circle key={k} cx={145 + k * 28} cy={102} r={2.5} fill="#7fb6e6" />)}
          <text x="275" y="96" style={{ fontSize: 12, fill: 'var(--ink)' }}>vidrio frío: gotas de agua</text>
        </>;
      }
    }
  })();
  return (
    <svg viewBox="0 0 420 300" role="img" aria-labelledby="cqm-b-t cqm-b-d">
      <title id="cqm-b-t">{findProcess(id).name}</title>
      <desc id="cqm-b-d">{`Avance ${fmt(f * 100, 0)} %. Gas: ${res.evidence.gas ?? 'no'}. Color: ${res.evidence.color ?? 'sin cambio'}. Sólido nuevo: ${res.evidence.precipitate ?? 'no'}.`}</desc>
      <rect width="420" height="300" rx="14" fill="var(--surface-2)" />
      {content}
    </svg>
  );
}

export default function ChemicalChangesLab({ api }: LabProps) {
  const [id, setId] = useState<ChangeId>('vinagre-bicarbonato');
  const p = findProcess(id);
  const [amounts, setAmounts] = useState<Record<string, { a: number; b?: number }>>(() => Object.fromEntries(PROCESSES.map((x) => [x.id, { a: x.amounts[0].initial, b: x.amounts[1]?.initial }])));
  const [prep, setPrep] = useState<IronPrep>('humeda');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState<'fisico' | 'quimico' | ''>('');
  const [tested, setTested] = useState(false);
  const raf = useRef(0);
  const { measure } = useMeasure();
  const { a, b } = amounts[id];
  const duration = id === 'vela' ? a : p.duration;
  const res = useMemo(() => evaluateChange({ id, a, b, t: Math.min(t, duration), prep }), [id, a, b, t, duration, prep]);
  const conds = useMemo(() => changeConditions({ id, a, b, prep }), [id, a, b, prep]);
  const thermo = instrument('cambios-quimicos', 'termometro'), bal = instrument('cambios-quimicos', 'balanza'), syr = instrument('cambios-quimicos', 'jeringa'), tube = instrument('cambios-quimicos', 'probeta');
  const Tread = measure(ROOM_T + res.evidence.dT, { ...thermo, key: 'temperatura' });
  const speed = duration / SCREEN_S;

  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); setTested(false); };
  useEffect(resetRun, [id, a, b, prep]);
  useEffect(() => { setAnswer(''); }, [id]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(duration); setRunning(false); return; }
    const start = performance.now() - (t / speed) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * speed;
      if (el >= duration) { setT(duration); setRunning(false); playSound('click', { intensity: 0.6 }); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, duration]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= duration && !running && t > 0;
  const status = simStatusOf(running, t > 0, finished);
  const verdict = answer ? checkClassification(id, answer) : null;

  usePublishModel(() => (id === 'vinagre-bicarbonato' ? {
    vars: {
      m: { sym: 'm', name: 'Masa de bicarbonato', value: a, unit: 'g', decimals: 1 },
      M: { sym: 'M', name: 'Masa molar del NaHCO₃', value: 84.006, unit: 'g/mol', decimals: 3 },
      R: { sym: 'R', name: 'Constante de los gases', value: 8.314, unit: 'J/(mol·K)', decimals: 3 },
      T: { sym: 'T', name: 'Temperatura del salón', value: 301.15, unit: 'K', decimals: 2 },
    },
    equations: [{ title: 'CO₂ máximo (bicarbonato límite)', lhs: 'n', expr: '\\frac{[m]}{[M]}' }],
  } : null), [id, a]);

  const quantityItems = res.quantities.filter((x) => x.key !== 'dT').map((x) => {
    const isMass = x.unit === 'g', isVol = x.key === 'vGas' || x.key === 'subida';
    const vol = x.key === 'subida' ? tube : syr;
    const v = isMass ? measure(x.value, { ...bal, key: x.key }) : isVol ? measure(x.value, { ...vol, key: x.key }) : x.value;
    return { k: x.label, v: `${fmt(v, isMass ? 3 : isVol ? (x.key === 'subida' ? 1 : 0) : x.decimals)} ${x.unit}`, data: isMass || isVol, resolution: isMass ? resolutionText(bal.resolution, 'g') : isVol ? resolutionText(vol.resolution, 'mL') : undefined };
  });

  const ev = res.evidence;
  const yes = (s: string | null) => (s ? `sí: ${s}` : 'no');
  const recordEvidence = () => api.addTrial('evidencias', {
    proceso: p.name, gas: ev.gas ? 'sí' : 'no', color: ev.color ? 'sí' : 'no', precipitado: ev.precipitate ? 'sí' : 'no', luz: ev.light ? 'sí' : 'no',
    dT: Number((Tread - ROOM_T).toFixed(1)), clasificacion: answer === 'quimico' ? 'química' : 'física', correcta: verdict?.correct ? 1 : 0,
  });
  const recordGas = () => api.addTrial('gas', { bicarbonato: a, vinagre: b ?? 0, tiempo: Number(t.toFixed(1)), vGas: measure(pick(res, 'vGas'), { ...syr, key: 'vGas' }), mCO2: Number(pick(res, 'mCO2').toFixed(3)), dT: Number((Tread - ROOM_T).toFixed(1)) });
  const recordRust = () => api.addTrial('herrumbre', { preparacion: prep, aire: b ?? 0, tiempo: Number(t.toFixed(1)), subida: Number(measure(pick(res, 'subida'), { ...tube, key: 'subida' }).toFixed(1)), dm: measure(pick(res, 'dm'), { ...bal, key: 'dm' }) });

  const rx = useMemo(() => changeReaction(id), [id]);
  const phys = useMemo(() => (p.kind === 'fisico' ? physicalScene(id as 'disolver-azucar' | 'hervir-agua', id === 'disolver-azucar' ? pick(res, 'disuelta') / a : res.progress) : null), [p.kind, id, res, a]);

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench"><ChangeBench id={id} res={res} t={t} /></div>
        <Readout items={[
          { k: 'Ecuación', v: p.equation },
          { k: 'Avance', v: `${fmt(res.progress * 100, 0)} % (t = ${fmt(t, 1)} ${UNIT[p.timeUnit]})` },
          { k: 'Termómetro de la mezcla', v: `${fmt(Tread, 1)} °C (salón ${fmt(ROOM_T, 0)} °C)`, data: true, resolution: resolutionText(thermo.resolution, '°C') },
          ...quantityItems,
        ]} />
        <section className="card" aria-labelledby="cqm-ev-h">
          <h3 id="cqm-ev-h">Evidencias observadas</h3>
          <Readout items={[
            { k: 'Gas', v: yes(ev.gas) },
            { k: 'Cambio de color', v: yes(ev.color) },
            { k: 'Sólido nuevo (precipitado)', v: yes(ev.precipitate) },
            { k: 'Luz', v: ev.light ? 'sí: la llama' : 'no' },
            { k: 'Cambio de temperatura', v: Math.abs(Tread - ROOM_T) >= 0.1 ? `${Tread < ROOM_T ? 'se enfría' : 'se calienta'} ${fmt(Math.abs(Tread - ROOM_T), 1)} °C` : 'no se nota (menos de 0,1 °C)' },
            { k: 'Prueba de recuperación', v: tested ? ev.recover : 'pulsa «Intentar recuperar la sustancia»' },
          ]} />
          <div className="btn-row">
            <button type="button" className="btn" disabled={!finished} onClick={() => { setTested(true); playSound('click', { intensity: 0.4 }); }}>Intentar recuperar la sustancia</button>
          </div>
        </section>
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="cqm-3d-h">
          <h3 id="cqm-3d-h">Vista 3D: {p.kind === 'quimico' ? 'los átomos se reorganizan en sustancias nuevas' : 'las moléculas solo se separan'}</h3>
          {rx && <>
            <p className="small">{REACTION_NOTE[id]}</p>
            <Reaction3D def={rx} idPrefix="cqm-rx" height={300} />
          </>}
          {phys && (
            <SpeciesScene3D idPrefix="cqm-fis" title={id === 'disolver-azucar' ? 'Azúcar que se disuelve en 3D' : 'Agua que hierve en 3D'} atoms={phys.atoms} bonds={phys.bonds} labels={phys.labels}
              description={phys.description} frameKey={phys.frameKey} framePoints={phys.framePoints} height={300} status="modelo"
              caption={<>Moléculas: confórmeros de PubChem (Modelo calculado). Cuánto se separan sigue el avance del modelo ({fmt(res.progress * 100, 0)} %); su disposición es un dibujo. Enlaces rotos dentro de las moléculas: 0.</>} />
          )}
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="cqm" intro="Ideas frecuentes sobre los cambios de la materia. Decide si son ciertas o falsas y compruébalo con las evidencias y la vista 3D." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Proceso</h3>
          <Select label="Proceso" value={id} onChange={(v) => setId(v as ChangeId)} options={PROCESSES.map((x) => ({ value: x.id, label: x.name }))} />
          {p.amounts.map((s) => (
            <Slider key={`${id}-${s.key}`} label={s.label} value={s.key === 'a' ? a : (b ?? s.initial)} min={s.min} max={s.max} step={s.step} unit={s.unit} decimals={s.decimals}
              onChange={(v) => setAmounts((m) => ({ ...m, [id]: { ...m[id], [s.key]: v } }))} />
          ))}
          {id === 'oxidacion-hierro' && <Select label="Preparación de la lana de acero" value={prep} onChange={(v) => setPrep(v as IronPrep)} options={[{ value: 'humeda', label: 'Humedecida con agua' }, { value: 'vinagre', label: 'Lavada con vinagre y húmeda' }, { value: 'seca', label: 'Seca' }]} />}
          <SimControls title="Observación del proceso" status={status} startLabel="Iniciar el proceso" repeatLabel="Repetir el proceso"
            onStart={() => { setT(0); setTested(false); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
            progress={{ value: t, max: duration, unit: UNIT[p.timeUnit], label: 't', decimals: 1 }} />
          <Notice>{p.action}. El reloj de la simulación va más rápido que el real ({fmt(duration, 0)} {UNIT[p.timeUnit]} en unos {SCREEN_S} s); la rapidez de cada proceso es ilustrativa.</Notice>
        </div>
        <div className="card stack">
          <h3>Tu conclusión</h3>
          <Segmented<'fisico' | 'quimico' | ''> label="¿Qué tipo de cambio es?" value={answer} onChange={setAnswer} options={[{ value: 'fisico', label: 'Cambio físico' }, { value: 'quimico', label: 'Cambio químico' }]} />
          {verdict && <Notice kind={verdict.correct ? 'ok' : 'warn'}>{verdict.correct ? 'Bien: ' : 'Revisa las evidencias: '}{verdict.text}</Notice>}
          <RecordButton onRecord={recordEvidence} disabled={!answer || t === 0} label="Guardar las evidencias en la tabla" />
          {id === 'vinagre-bicarbonato' && <RecordButton onRecord={recordGas} disabled={!finished} label="Guardar el volumen de gas" />}
          {id === 'oxidacion-hierro' && <RecordButton onRecord={recordRust} disabled={t === 0 || running} label="Guardar la subida del agua" />}
        </div>
      </div>
    </div>
  );
}

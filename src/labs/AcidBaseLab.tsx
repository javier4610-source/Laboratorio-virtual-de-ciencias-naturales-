import { useMemo, useState } from 'react';
import { ACIDS, dilutedPH, findAcid, INDICATORS, indicatorColor, titrate, titrationCurve } from '../models/acidbase';
import { prettyFormula } from '../models/chemistry';
import { fmt, fmtSig, parseLocaleNumber } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

const CONCS = [0.01, 0.05, 0.1, 0.2];
/** Reto: vinagre diluido 10 veces con concentración oculta para el estudiante. */
const UNKNOWN = { acidId: 'acetico', conc: 0.0842 };

function TitrationPart({ api }: LabProps) {
  const [challenge, setChallenge] = useState(false);
  const [acidId, setAcidId] = useState('hcl');
  const [ca, setCa] = useState(0.1);
  const [va, setVa] = useState(25);
  const [cb, setCb] = useState(0.1);
  const [vb, setVb] = useState(0);
  const [indId, setIndId] = useState('fenolftaleina');
  const [history, setHistory] = useState<{ x: number; y: number }[]>([]);
  const [showCurve, setShowCurve] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessMsg, setGuessMsg] = useState<string | null>(null);
  const realAcid = challenge ? UNKNOWN.acidId : acidId;
  const realCa = challenge ? UNKNOWN.conc : ca;
  const res = useMemo(() => titrate({ acidId: realAcid, acidConc: realCa, acidVolume: va, baseConc: cb, baseVolume: vb }), [realAcid, realCa, va, cb, vb]);
  const ind = INDICATORS.find((i) => i.id === indId)!;
  const col = indicatorColor(ind, res.pH);
  const maxV = Math.min(100, Math.max(50, Math.ceil(res.equivalenceVolume * 2 / 10) * 10));
  const curve = useMemo(() => titrationCurve({ acidId: realAcid, acidConc: realCa, acidVolume: va, baseConc: cb }, maxV), [realAcid, realCa, va, cb, maxV]);

  const restart = () => { setVb(0); setHistory([]); setGuessMsg(null); };
  const add = (dv: number) => {
    const nv = Math.max(0, Math.min(100, Number((vb + dv).toFixed(2))));
    setVb(nv);
    const p = titrate({ acidId: realAcid, acidConc: realCa, acidVolume: va, baseConc: cb, baseVolume: nv }).pH;
    setHistory((h) => [...h.filter((pt) => pt.x !== nv), { x: nv, y: p }].sort((a, b) => a.x - b.x));
  };
  const ph0 = useMemo(() => titrate({ acidId: realAcid, acidConc: realCa, acidVolume: va, baseConc: cb, baseVolume: 0 }).pH, [realAcid, realCa, va, cb]);
  const historyPts = [{ x: 0, y: ph0 }, ...history.filter((pt) => pt.x > 0)];

  const record = () => api.addTrial('titulacion', {
    acido: challenge ? 'Vinagre diluido (reto)' : prettyFormula(findAcid(acidId).formula), cacido: challenge ? null : ca, vacido: va, cbase: cb, vbase: vb,
    ph: Number(res.pH.toFixed(3)), indicador: ind.name, colorObs: col.label,
  });

  const checkGuess = () => {
    const v = parseLocaleNumber(guess);
    if (Number.isNaN(v)) { setGuessMsg('Escribe un número, por ejemplo 0,08.'); return; }
    const err = Math.abs(v - UNKNOWN.conc) / UNKNOWN.conc;
    setGuessMsg(err < 0.03
      ? `¡Correcto! La muestra diluida tiene ${fmt(UNKNOWN.conc, 4)} M; el vinagre original (×10) tiene ${fmt(UNKNOWN.conc * 10, 3)} M ≈ ${fmt(UNKNOWN.conc * 10 * 60.05 / 10, 1)} % m/v de ácido acético.`
      : err < 0.15 ? 'Estás cerca. Afina el volumen de equivalencia agregando la base de 0,1 en 0,1 mL cerca del cambio de color.' : 'Revisa el cálculo: C_A = C_B · V_eq / V_A.');
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 280" role="img" aria-labelledby="tit-t tit-d">
            <title id="tit-t">Montaje de titulación con bureta, erlenmeyer y pH-metro</title>
            <desc id="tit-d">{`Se han añadido ${fmt(vb, 2)} mL de NaOH. pH ${fmt(res.pH, 2)}. Indicador ${ind.name}: ${col.label}.`}</desc>
            <rect x="200" y="10" width="24" height="170" fill="var(--surface)" stroke="var(--ink-2)" />
            <rect x="201" y={10 + (vb / 100) * 168} width="22" height={168 - (vb / 100) * 168} fill="rgba(70,150,220,0.3)" />
            {Array.from({ length: 11 }, (_, i) => <g key={i}><line x1="224" x2="232" y1={10 + i * 16.8} y2={10 + i * 16.8} stroke="var(--ink-2)" /><text x="236" y={14 + i * 16.8} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{i * 10}</text></g>)}
            <path d="M206 180 L218 180 L214 196 L210 196 Z" fill="var(--ink-2)" />
            <path d="M180 270 L244 270 L232 222 L222 205 L222 200 L202 200 L202 205 L192 222 Z" fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="2" />
            <path d="M186 262 L238 262 L231 232 L193 232 Z" fill={col.color} />
            <text x="212" y="279" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>erlenmeyer</text>
            <g transform="translate(330 70)">
              <rect width="150" height="80" rx="10" fill="var(--surface-2)" stroke="var(--ink-2)" />
              <rect x="14" y="14" width="122" height="36" rx="4" fill="#0d1f1d" />
              <text x="75" y="40" textAnchor="middle" fill="#7CFFB2" style={{ fontFamily: 'var(--font-data)', fontSize: 20 }}>pH {fmt(res.pH, 2)}</text>
              <text x="75" y="68" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>pH-metro</text>
              <line x1="0" y1="60" x2="-100" y2="175" stroke="var(--ink-2)" strokeWidth="2" />
            </g>
            <text x="410" y="190" style={{ fontSize: 12, fill: 'var(--ink)' }}>NaOH añadido: {fmt(vb, 2)} mL</text>
            <text x="410" y="210" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{ind.name}: {col.label}</text>
          </svg>
        </div>
        <div className="card">
          <Chart title="Curva de titulación" xLabel="NaOH añadido (mL)" yLabel="pH" height={260} xDomain={[0, maxV]} yDomain={[0, 14]}
            series={[
              { label: 'Mis mediciones', kind: 'both', points: historyPts },
              ...(showCurve ? [{ label: 'Curva del modelo', kind: 'line' as const, dashed: true, points: curve.map((p) => ({ x: p.v, y: p.pH })) }] : []),
            ]}
            hLines={[{ y: ind.low, label: `${ind.name}: ${ind.low}` }, { y: ind.high, label: `${ind.high}` }]} />
          <label className="check"><input type="checkbox" checked={showCurve} onChange={(e) => setShowCurve(e.target.checked)} /> Mostrar la curva del modelo (después de medir)</label>
        </div>
        <Readout items={[
          { k: 'pH', v: fmt(res.pH, 2), data: true },
          { k: '[H⁺]', v: `${fmtSig(res.hydrogen, 3)} mol/L` },
          { k: 'Estado', v: res.state },
          { k: 'Volumen total', v: `${fmt(res.totalVolume, 1)} mL` },
          ...(challenge || !showCurve ? [] : [
            { k: 'V de equivalencia (modelo)', v: `${fmt(res.equivalenceVolume, 2)} mL` },
            { k: 'pH en la equivalencia', v: fmt(res.equivalencePH, 2) },
            ...(res.halfEquivalencePH !== null ? [{ k: 'pH en la semiequivalencia (= pKa)', v: fmt(res.halfEquivalencePH, 2) }] : []),
          ]),
        ]} />
        {challenge && (
          <div className="card stack-sm">
            <h3>Reto: ¿cuánto ácido acético tiene el vinagre?</h3>
            <p className="small">Tienes 25 mL de vinagre diluido 10 veces. Encuentra el volumen de equivalencia con el indicador adecuado y calcula la concentración de la muestra diluida.</p>
            <div className="btn-row">
              <label htmlFor="vin-guess" className="small">Concentración de la muestra (mol/L):</label>
              <input id="vin-guess" type="text" inputMode="decimal" value={guess} onChange={(e) => setGuess(e.target.value)} style={{ maxWidth: 140 }} />
              <button type="button" className="btn" onClick={checkGuess}>Comprobar</button>
            </div>
            {guessMsg && <p className="small" role="status">{guessMsg}</p>}
          </div>
        )}
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <label className="check"><input type="checkbox" checked={challenge} onChange={(e) => { setChallenge(e.target.checked); restart(); }} /> Reto del vinagre (concentración desconocida)</label>
          {!challenge && (
            <>
              <Select label="Ácido en el erlenmeyer" value={acidId} onChange={(v) => { setAcidId(v); restart(); }} options={ACIDS.map((a) => ({ value: a.id, label: `${a.name} (${prettyFormula(a.formula)})` }))} />
              <Select label="Concentración del ácido" value={String(ca)} onChange={(v) => { setCa(Number(v)); restart(); }} options={CONCS.map((c) => ({ value: String(c), label: `${fmt(c, 2)} mol/L` }))} />
            </>
          )}
          <Slider label="Volumen de ácido" value={va} min={5} max={50} step={5} unit="mL" decimals={0} onChange={(v) => { setVa(v); restart(); }} />
          <Select label="Concentración de NaOH" value={String(cb)} onChange={(v) => { setCb(Number(v)); restart(); }} options={CONCS.map((c) => ({ value: String(c), label: `${fmt(c, 2)} mol/L` }))} />
          <Select label="Indicador" value={indId} onChange={setIndId} options={INDICATORS.map((i) => ({ value: i.id, label: `${i.name} (vira ${fmt(i.low, 1)}–${fmt(i.high, 1)})` }))} />
          <div className="field">
            <span className="small" style={{ fontWeight: 600 }}>Bureta</span>
            <div className="btn-row">
              {[5, 1, 0.1].map((d) => <button key={d} type="button" className="btn small primary" onClick={() => add(d)}>+{fmt(d, d < 1 ? 1 : 0)} mL</button>)}
              <button type="button" className="btn small" onClick={() => add(-1)}>−1 mL</button>
              <button type="button" className="btn small" onClick={restart}>Vaciar y reiniciar</button>
            </div>
          </div>
          <RecordButton onRecord={record} />
        </div>
        <Notice>Soluciones ideales a 25 °C. El pH se calcula resolviendo el balance de cargas; el color del indicador es aproximado.</Notice>
      </div>
    </div>
  );
}

function DilutionPart({ api }: LabProps) {
  const [acidId, setAcidId] = useState('hcl');
  const [c0, setC0] = useState(0.1);
  const [logF, setLogF] = useState(0);
  const factor = 10 ** logF;
  const pH = dilutedPH(acidId, c0, factor);
  const series = Array.from({ length: 81 }, (_, i) => ({ x: i / 10, y: dilutedPH(acidId, c0, 10 ** (i / 10)) }));
  const record = () => api.addTrial('dilucion', { acido: prettyFormula(findAcid(acidId).formula), cinicial: c0, factor: Math.round(factor), logFactor: logF, cfinal: c0 / factor, ph: Number(pH.toFixed(3)) });
  return (
    <div className="lab-layout">
      <div className="stack">
        <Readout items={[
          { k: 'Factor de dilución', v: `×${factor >= 1e4 ? fmtSig(factor, 2) : fmt(factor, 0)}` },
          { k: 'Concentración final', v: `${fmtSig(c0 / factor, 3)} mol/L` },
          { k: 'pH', v: fmt(pH, 2), data: true },
        ]} />
        <details className="card">
          <summary>Curva del modelo: pH contra log₁₀(factor) (ábrela después de medir)</summary>
          <Chart title="pH al diluir el ácido" xLabel="log₁₀ (factor de dilución)" yLabel="pH" height={240} xDomain={[0, 8]} yDomain={[0, 8]}
            series={[{ label: 'pH', kind: 'line', points: series }]} hLines={[{ y: 7, label: 'pH 7 (agua pura)' }]} />
        </details>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Dilución</h3>
          <Select label="Ácido" value={acidId} onChange={setAcidId} options={ACIDS.map((a) => ({ value: a.id, label: a.name }))} />
          <Select label="Concentración inicial" value={String(c0)} onChange={(v) => setC0(Number(v))} options={CONCS.map((c) => ({ value: String(c), label: `${fmt(c, 2)} mol/L` }))} />
          <Slider label="Diluir 10ⁿ veces: n =" value={logF} min={0} max={8} step={1} decimals={0} onChange={setLogF} />
          <RecordButton onRecord={record} />
        </div>
        <Notice>Cada dilución por 10 sube el pH cerca de una unidad hasta acercarse a 7. Diluir un ácido nunca lo vuelve básico.</Notice>
      </div>
    </div>
  );
}

export default function AcidBaseLab(props: LabProps) {
  const [tab, setTab] = useState<'tit' | 'dil'>('tit');
  return (
    <div className="stack">
      <Segmented label="Experimento" value={tab} onChange={setTab} options={[{ value: 'tit', label: 'Titulación' }, { value: 'dil', label: 'Dilución y pH' }]} />
      {tab === 'tit' ? <TitrationPart {...props} /> : <DilutionPart {...props} />}
    </div>
  );
}

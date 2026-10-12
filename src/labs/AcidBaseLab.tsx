import { useMemo, useState } from 'react';
import { ACIDS, dilutedPH, findAcid, INDICATORS, indicatorColor, titrate, titrationCurve } from '../models/acidbase';
import { prettyFormula } from '../models/chemistry';
import { fmt, fmtSig, parseLocaleNumber } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, Burette, Erlenmeyer, Lcd } from './kit';
import { playSound } from '../lib/sound';

/** Contorno del líquido dentro del Erlenmeyer del kit (misma geometría), para teñirlo con el indicador. */
function erlLiquid(x: number, y: number, w: number, h: number, fill: number) {
  const neckW = w * 0.28, neckH = h * 0.3, cx = x + w / 2;
  const f = Math.max(0, Math.min(1, fill));
  const ly = y + h - 3 - (h - neckH - 6) * f;
  const half = neckW / 2 + ((w / 2 - 4 - neckW / 2) * (ly - (y + neckH))) / (h - 10 - neckH);
  return `M${cx - half} ${ly} L${cx + half} ${ly} L${x + w - 5} ${y + h - 9} Q${x + w - 2} ${y + h - 2} ${x + w - 10} ${y + h - 2} L${x + 10} ${y + h - 2} Q${x + 2} ${y + h - 2} ${x + 5} ${y + h - 9} Z`;
}

/** Frasco lavador de polietileno con agua destilada. */
function WashBottle({ x, y }: { x: number; y: number }) {
  const w = 46, base = 326;
  return (
    <g aria-hidden="true">
      <path d={`M${x + w / 2 + 2} ${y + 6} L${x + w / 2 + 2} ${y - 12} Q${x + w / 2 + 2} ${y - 20} ${x + w / 2 + 12} ${y - 22} L${x + w + 18} ${y - 26}`} fill="none" stroke="#c8d2d4" strokeWidth="3.2" strokeLinecap="round" />
      <path d={`M${x + w / 2 + 2} ${y + 6} L${x + w / 2 + 2} ${y - 12} Q${x + w / 2 + 2} ${y - 20} ${x + w / 2 + 12} ${y - 22} L${x + w + 18} ${y - 26}`} fill="none" stroke="#8f9a9e" strokeWidth="0.8" strokeLinecap="round" />
      <g filter="url(#kit-shadow-soft)">
        <path d={`M${x + 10} ${y + 18} Q${x + 10} ${y + 10} ${x + 16} ${y + 10} L${x + w - 16} ${y + 10} Q${x + w - 10} ${y + 10} ${x + w - 10} ${y + 18} L${x + w} ${y + 34} L${x + w} ${base - 4} Q${x + w} ${base} ${x + w - 4} ${base} L${x + 4} ${base} Q${x} ${base} ${x} ${base - 4} L${x} ${y + 34} Z`} fill="#eef4f6" opacity="0.92" stroke="#a9b4b6" />
      </g>
      <rect x={x + 2} y={y + 46} width={w - 4} height={base - y - 48} rx={3} fill="#bcdcf0" opacity="0.55" />
      <rect x={x + 13} y={y + 2} width={w - 26} height={10} rx={2} fill="#e04a3a" />
      <rect x={x + 7} y={y + 58} width={w - 14} height={18} rx={2} fill="#ffffff" stroke="#c8d2d4" strokeWidth="0.6" />
      <text x={x + w / 2} y={y + 71} textAnchor="middle" style={{ fontSize: 9, fill: '#24454a', fontWeight: 700 }}>H₂O</text>
      <rect x={x + 4} y={y + 36} width={3} height={base - y - 44} rx={1.5} fill="#fff" opacity="0.6" />
    </g>
  );
}

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

  const restart = () => { setVb(0); setHistory([]); setGuessMsg(null); playSound('glassClink', { intensity: 0.5 }); };
  const add = (dv: number) => {
    const nv = Math.max(0, Math.min(100, Number((vb + dv).toFixed(2))));
    setVb(nv);
    // Gota a gota (0,1 mL), chorrito (1 mL) o chorro (5 mL) desde la bureta, y se agita el erlenmeyer.
    if (dv > 0) { playSound(dv >= 5 ? 'pour' : 'drips', { duration: dv >= 5 ? 0.8 : dv >= 1 ? 0.6 : 0.05, intensity: 0.5 }); playSound('swirl', { intensity: 0.35, delay: 0.5 }); }
    const p = titrate({ acidId: realAcid, acidConc: realCa, acidVolume: va, baseConc: cb, baseVolume: nv }).pH;
    setHistory((h) => [...h.filter((pt) => pt.x !== nv), { x: nv, y: p }].sort((a, b) => a.x - b.x));
  };
  const ph0 = useMemo(() => titrate({ acidId: realAcid, acidConc: realCa, acidVolume: va, baseConc: cb, baseVolume: 0 }).pH, [realAcid, realCa, va, cb]);
  const historyPts = [{ x: 0, y: ph0 }, ...history.filter((pt) => pt.x > 0)];
  /** Nivel del líquido en el erlenmeyer (dibujo): ácido + base añadida, de 5 a 150 mL. */
  const flaskFill = 0.16 + 0.7 * Math.min(1, (va + vb) / 150);

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
          <svg viewBox="0 0 640 352" role="img" aria-labelledby="tit-t tit-d">
            <title id="tit-t">Montaje de titulación con bureta, erlenmeyer y pH-metro</title>
            <desc id="tit-d">{`Se han añadido ${fmt(vb, 2)} mL de NaOH. pH ${fmt(res.pH, 2)}. Indicador ${ind.name}: ${col.label}.`}</desc>
            <BenchTop y={326} width={640} />
            {/* soporte universal */}
            <g filter="url(#kit-shadow-soft)">
              <rect x={96} y={316} width={84} height={10} rx={2} fill="url(#kit-body-dark)" />
              <rect x={136} y={14} width={8} height={304} rx={3} fill="url(#kit-metal-h)" stroke="#8f9a9e" strokeWidth="0.6" />
            </g>
            {[58, 150].map((cy) => (
              <g key={cy}>
                <rect x={142} y={cy - 3} width={64} height={6} fill="url(#kit-metal)" stroke="#8f9a9e" strokeWidth="0.6" />
                <rect x={131} y={cy - 8} width={18} height={16} rx={2} fill="url(#kit-body-dark)" />
                <circle cx={140} cy={cy + 12} r={3.5} fill="url(#kit-metal)" stroke="#8f9a9e" strokeWidth="0.6" />
              </g>
            ))}
            {/* bureta con NaOH */}
            <Burette x={203} y={10} h={192} capacity={100} level={vb} liquid="#a9cdea" liquidOpacity={0.85} major={5} />
            {[58, 150].map((cy) => <rect key={cy} x={199} y={cy - 6} width={26} height={12} rx={3} fill="#2b3335" opacity="0.92" />)}
            <text x="252" y="22" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Bureta · NaOH {fmt(cb, 2)} M</text>
            {/* agitador magnético */}
            <g filter="url(#kit-shadow)">
              <path d="M170 292 L262 292 Q270 292 270 300 L272 326 L160 326 L162 300 Q162 292 170 292 Z" fill="url(#kit-body)" stroke="#a9b4b6" />
              <rect x={164} y={287} width={104} height={7} rx={2} fill="#eef2f2" stroke="#b9c3c5" />
            </g>
            <circle cx={184} cy={310} r={7} fill="url(#kit-metal)" stroke="#8f9a9e" />
            <line x1={184} x2={184} y1={304} y2={309} stroke="#55605f" strokeWidth="1.5" />
            <circle cx={250} cy={310} r={2.6} fill="#3ddc84" stroke="#2b3335" strokeWidth="0.5" />
            {/* erlenmeyer con el ácido y el indicador; electrodo sumergido */}
            <Erlenmeyer x={160} y={192} w={112} h={95} fill={flaskFill} liquid="#cfe3ee" liquidOpacity={0.4}>
              <path d={erlLiquid(160, 192, 112, 95, flaskFill)} fill={col.color} opacity="0.88" />
              <rect x={202} y={281} width={16} height={4} rx={2} fill="#f5f5f5" stroke="#9aa5a9" strokeWidth="0.6" />
              <rect x={223} y={194} width={6} height={86} rx={3} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1" />
              <line x1={226} x2={226} y1={198} y2={278} stroke="#9aa5a9" strokeWidth="0.8" />
              <circle cx={226} cy={281} r={4} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1" />
              <rect x={221} y={182} width={10} height={14} rx={2} fill="#2b3335" />
            </Erlenmeyer>
            <path d="M226 182 C236 176 262 180 282 204 S304 234 314 237" fill="none" stroke="#56636a" strokeWidth="2.6" strokeLinecap="round" />
            <text x="216" y="344" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>erlenmeyer · agitador magnético</text>
            {/* pH-metro de mesa */}
            <g filter="url(#kit-shadow)">
              <path d="M318 232 L436 232 Q446 232 446 242 L450 326 L304 326 L308 242 Q308 232 318 232 Z" fill="url(#kit-body)" stroke="#a9b4b6" />
            </g>
            <rect x={316} y={242} width={122} height={46} rx={6} fill="url(#kit-body-dark)" />
            <Lcd x={322} y={248} w={110} h={34} text={`pH ${fmt(res.pH, 2)}`} />
            {['CAL', 'MED'].map((label, i) => (
              <g key={label}>
                <rect x={330 + i * 36} y={296} width={24} height={11} rx={3} fill="url(#kit-body-dark)" />
                <text x={342 + i * 36} y={317} textAnchor="middle" style={{ fontSize: 7, fill: '#55605f', fontWeight: 700 }}>{label}</text>
              </g>
            ))}
            <circle cx={314} cy={238} r={4} fill="#2b3335" />
            <text x="377" y="344" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>pH-metro</text>
            <WashBottle x={548} y={244} />
            <text x="464" y="150" style={{ fontSize: 12, fill: 'var(--ink)' }}>NaOH añadido: {fmt(vb, 2)} mL</text>
            <text x="464" y="170" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{ind.name}: {col.label}</text>
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

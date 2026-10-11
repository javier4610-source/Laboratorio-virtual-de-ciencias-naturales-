import { useMemo, useState } from 'react';
import { FLASK_VOLUMES, PIPETTE_VOLUMES, prepareSolution, SOLUTES, solutionColor, unknownAbsorbance, SOLUTION_LIMITS, ABSORBANCE_MAX } from '../models/solutions';
import { prettyFormula } from '../models/chemistry';
import { fmt, fmtSig, parseLocaleNumber } from '../lib/format';
import { Notice, Readout, RecordButton, Select, Warnings } from '../components/ui';
import type { LabProps } from './registry';

export default function SolutionsLab({ api }: LabProps) {
  const [soluteId, setSoluteId] = useState('cuso4');
  const [massText, setMassText] = useState('2,500');
  const [flask, setFlask] = useState(100);
  const [dilute, setDilute] = useState(false);
  const [aliquot, setAliquot] = useState(10);
  const [dilFlask, setDilFlask] = useState(100);
  const [measured, setMeasured] = useState(false);
  const [unknownShown, setUnknownShown] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessMsg, setGuessMsg] = useState<string | null>(null);

  const mass = parseLocaleNumber(massText);
  const massError = Number.isNaN(mass) ? 'Escribe una masa válida, por ejemplo 2,500.' : mass < SOLUTION_LIMITS.mass[0] || mass > SOLUTION_LIMITS.mass[1] ? `La masa debe estar entre ${fmt(SOLUTION_LIMITS.mass[0], 3)} y ${fmt(SOLUTION_LIMITS.mass[1], 0)} g.` : null;
  const res = useMemo(() => {
    if (massError) return null;
    try {
      return prepareSolution({ soluteId, mass, flaskVolume: flask, dilution: dilute ? { aliquot, dilutionFlask: dilFlask } : null });
    } catch (e) { return { error: (e as Error).message } as const; }
  }, [soluteId, mass, flask, dilute, aliquot, dilFlask, massError]);
  const ok = res && !('error' in res) ? res : null;
  const solute = SOLUTES.find((s) => s.id === soluteId)!;
  const change = (fn: () => void) => { fn(); setMeasured(false); setGuessMsg(null); };

  const record = () => {
    if (!ok) return;
    api.addTrial('soluciones', {
      soluto: prettyFormula(solute.formula), masa: ok.massReading, volumen: flask, molaridad: Number(ok.molarity.toPrecision(6)),
      pmv: Number(ok.percentMV.toFixed(4)), factor: ok.dilutionFactor, cfinal: Number(ok.finalMolarity.toPrecision(6)),
      absorbancia: ok.absorbance !== null && ok.absorbance <= ABSORBANCE_MAX ? Number(ok.absorbance.toFixed(3)) : null,
    });
  };

  const checkGuess = () => {
    if (!ok) return;
    const v = parseLocaleNumber(guess);
    if (Number.isNaN(v)) { setGuessMsg('Escribe un número.'); return; }
    const err = Math.abs(v - ok.molarity) / ok.molarity;
    if (err < 0.01) setGuessMsg(`¡Correcto! n = ${fmtSig(ok.moles, 4)} mol; M = n / V = ${fmtSig(ok.molarity, 4)} mol/L.`);
    else if (Math.abs(v - ok.molarity * 1000) / (ok.molarity * 1000) < 0.01) setGuessMsg('Dividiste entre el volumen en mL. Convierte a litros (÷ 1000).');
    else if (Math.abs(v - ok.dissolvedMass / (flask / 1000)) / (ok.dissolvedMass / (flask / 1000)) < 0.01) setGuessMsg('Ese resultado está en g/L. Para obtener mol/L, primero convierte la masa a moles con la masa molar.');
    else setGuessMsg(`Revisa: n = m / M = ${fmt(ok.massReading, 3)} g ÷ ${fmt(ok.molarMass, 2)} g/mol; luego divide entre ${fmt(flask / 1000, 3)} L.`);
  };

  const color = ok ? solutionColor(solute, ok.molarity) : 'transparent';
  const colorDiluted = ok ? solutionColor(solute, ok.finalMolarity) : 'transparent';
  const flaskPath = (x: number) => `M${x - 10} 70 L${x - 10} 130 L${x - 55} 250 Q${x - 60} 268 ${x - 40} 268 L${x + 40} 268 Q${x + 60} 268 ${x + 55} 250 L${x + 10} 130 L${x + 10} 70`;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 300" role="img" aria-labelledby="sol-t sol-d">
            <title id="sol-t">Balanza, balones aforados y colorímetro</title>
            <desc id="sol-d">{ok ? `Solución de ${solute.name}: ${fmtSig(ok.molarity, 3)} mol/L en balón de ${flask} mL.${dilute ? ` Diluida ${fmt(ok.dilutionFactor, 1)} veces: ${fmtSig(ok.finalMolarity, 3)} mol/L.` : ''}${measured ? ` Absorbancia: ${ok.absorbanceReading}.` : ''}` : 'Configura la solución.'}</desc>
            <rect x="20" y="214" width="150" height="54" rx="8" fill="var(--surface-2)" stroke="var(--ink-2)" />
            <rect x="45" y="205" width="100" height="9" rx="3" fill="var(--line)" stroke="var(--ink-2)" />
            <rect x="50" y="228" width="90" height="26" rx="4" fill="#0d1f1d" />
            <text x="95" y="246" textAnchor="middle" fill="#7CFFB2" style={{ fontFamily: 'var(--font-data)', fontSize: 14 }}>{ok ? `${fmt(ok.massReading, 3)} g` : '—'}</text>
            <text x="95" y="285" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Balanza analítica</text>
            <path d={flaskPath(270) + ' Z'} fill={color} opacity="0.95" />
            <path d={flaskPath(270)} fill="none" stroke="var(--ink-2)" strokeWidth="2" />
            <line x1="258" x2="282" y1="100" y2="100" stroke="var(--ink)" strokeWidth="1.5" />
            {ok?.saturated && <ellipse cx="270" cy="262" rx="34" ry="5" fill={solute.color ? `rgb(${solute.color.join(',')})` : '#ddd'} stroke="var(--ink-2)" />}
            <text x="270" y="290" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Solución madre · {flask} mL</text>
            {dilute && (
              <g>
                <path d={flaskPath(410) + ' Z'} fill={colorDiluted} opacity="0.95" />
                <path d={flaskPath(410)} fill="none" stroke="var(--ink-2)" strokeWidth="2" />
                <line x1="398" x2="422" y1="100" y2="100" stroke="var(--ink)" strokeWidth="1.5" />
                <text x="410" y="290" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Dilución · {aliquot} → {dilFlask} mL</text>
                <path d="M300 60 Q340 20 380 60" fill="none" stroke="var(--ink-2)" strokeDasharray="4 4" markerEnd="url(#sol-arrow)" />
                <defs><marker id="sol-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--ink-2)" /></marker></defs>
              </g>
            )}
            <g transform="translate(500 150)">
              <rect width="120" height="90" rx="10" fill="var(--surface-2)" stroke="var(--ink-2)" />
              <rect x="12" y="14" width="96" height="30" rx="4" fill="#0d1f1d" />
              <text x="60" y="35" textAnchor="middle" fill="#7CFFB2" style={{ fontFamily: 'var(--font-data)', fontSize: 13 }}>
                {measured && ok ? (ok.absorbance === null ? 'A = 0,000' : ok.absorbance > ABSORBANCE_MAX ? 'A > 2,00' : `A = ${fmt(ok.absorbance, 3)}`) : unknownShown ? `A = ${fmt(unknownAbsorbance(), 3)}` : 'A = ---'}
              </text>
              <rect x="50" y="52" width="20" height="30" fill={measured ? colorDiluted : unknownShown ? solutionColor(SOLUTES[3], 3.6e-4) : 'var(--surface)'} stroke="var(--ink-2)" />
              <text x="60" y="108" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Colorímetro {solute.wavelength ? `${solute.wavelength} nm` : ''}</text>
            </g>
          </svg>
        </div>
        {ok && (
          <Readout items={[
            { k: 'Masa molar', v: `${fmt(ok.molarMass, 2)} g/mol` },
            { k: 'Masa disuelta', v: `${fmt(ok.dissolvedMass, 3)} g` },
            { k: 'Cantidad de sustancia', v: `${fmtSig(ok.moles, 4)} mol` },
            { k: 'Molaridad (madre)', v: `${fmtSig(ok.molarity, 4)} mol/L`, data: true },
            { k: '% m/v', v: `${fmtSig(ok.percentMV, 4)} %` },
            { k: 'ppm (mg/L)', v: fmtSig(ok.ppm, 4) },
            { k: 'Factor de dilución', v: fmt(ok.dilutionFactor, 1) },
            { k: 'Concentración final', v: `${fmtSig(ok.finalMolarity, 4)} mol/L`, data: true },
            { k: 'Absorbancia', v: measured ? ok.absorbanceReading : 'sin medir' },
            { k: 'Transmitancia', v: measured && ok.transmittance !== null ? `${fmt(ok.transmittance, 1)} %` : '—' },
          ]} />
        )}
        {ok && <Warnings list={ok.warnings.filter((w) => measured || !w.includes('absorbancia'))} />}
        {ok && (
          <div className="card stack-sm">
            <label htmlFor="sol-guess">Antes de mirar el resultado, calcula la molaridad de la solución madre (mol/L)</label>
            <div className="btn-row">
              <input id="sol-guess" type="text" inputMode="decimal" value={guess} onChange={(e) => setGuess(e.target.value)} style={{ maxWidth: 180 }} placeholder="p. ej. 0,1001" />
              <button type="button" className="btn" onClick={checkGuess}>Comprobar cálculo</button>
            </div>
            {guessMsg && <p className="small" role="status">{guessMsg}</p>}
          </div>
        )}
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Preparación</h3>
          <Select label="Soluto" value={soluteId} onChange={(v) => change(() => setSoluteId(v))} options={SOLUTES.map((s) => ({ value: s.id, label: `${s.name} (${prettyFormula(s.formula)})` }))} hint={solute.safety} />
          <div className="field">
            <label htmlFor="sol-mass">Masa de soluto (g)</label>
            <input id="sol-mass" type="text" inputMode="decimal" value={massText} onChange={(e) => change(() => setMassText(e.target.value))} aria-invalid={massError ? true : undefined} aria-describedby="sol-mass-h" />
            <span id="sol-mass-h" className="hint" style={massError ? { color: 'var(--bad)' } : undefined}>{massError ?? 'Balanza con resolución de 0,001 g.'}</span>
          </div>
          <Select label="Balón aforado" value={String(flask)} onChange={(v) => change(() => setFlask(Number(v)))} options={FLASK_VOLUMES.map((v) => ({ value: String(v), label: `${v} mL` }))} />
          <label className="check"><input type="checkbox" checked={dilute} onChange={(e) => change(() => setDilute(e.target.checked))} /> Hacer una dilución</label>
          {dilute && (
            <div className="grid-2" style={{ gap: 8 }}>
              <Select label="Pipeta (alícuota)" value={String(aliquot)} onChange={(v) => change(() => setAliquot(Number(v)))} options={PIPETTE_VOLUMES.map((v) => ({ value: String(v), label: `${v} mL` }))} />
              <Select label="Balón de dilución" value={String(dilFlask)} onChange={(v) => change(() => setDilFlask(Number(v)))} options={FLASK_VOLUMES.map((v) => ({ value: String(v), label: `${v} mL` }))} />
            </div>
          )}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => setMeasured(true)} disabled={!ok}>Medir absorbancia</button>
          </div>
          <RecordButton onRecord={record} disabled={!ok || !measured} />
          {!measured && <p className="small muted">Mide la absorbancia antes de guardar el ensayo.</p>}
        </div>
        <div className="card stack-sm">
          <h3>Muestra problema</h3>
          <p className="small">Solución de KMnO₄ de concentración desconocida. Mide su absorbancia y usa tu curva de calibración (absorbancia contra concentración final) para calcular su concentración.</p>
          <button type="button" className="btn" onClick={() => { setUnknownShown(true); setMeasured(false); }}>Medir muestra problema</button>
          {unknownShown && <p className="small" role="status">Absorbancia de la muestra problema: <strong className="num">{fmt(unknownAbsorbance(), 3)}</strong></p>}
        </div>
        <Notice>Valores de solubilidad y absortividad molar aproximados. Paso óptico de 1 cm. La ley de Beer solo es lineal en soluciones diluidas.</Notice>
      </div>
    </div>
  );
}

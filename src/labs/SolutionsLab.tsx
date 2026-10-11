import { useMemo, useState } from 'react';
import { FLASK_VOLUMES, PIPETTE_VOLUMES, prepareSolution, SOLUTES, solutionColor, unknownAbsorbance, SOLUTION_LIMITS, ABSORBANCE_MAX } from '../models/solutions';
import { prettyFormula } from '../models/chemistry';
import { fmt, fmtSig, parseLocaleNumber } from '../lib/format';
import { Notice, Readout, RecordButton, Select, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, DigitalBalance, Lcd, shade } from './kit';

/* ---------------------------------------------------------------- instrumentos locales */

const toHex = (rgb: [number, number, number]) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
const FLASK_RADIUS: Record<number, number> = { 50: 30, 100: 38, 250: 48, 500: 56 };

/** Balón aforado: bulbo con fondo plano, cuello largo con línea de aforo y tapón. */
function VolumetricFlask({ id, cx, base, volume, liquid, crystals = null }: { id: string; cx: number; base: number; volume: number; liquid: string | null; crystals?: string | null }) {
  const g = useMemo(() => {
    const r = FLASK_RADIUS[volume] ?? 40;
    const n = (10 + r * 0.12) / 2;
    const nb = base - 1.85 * r;
    const top = nb - 100;
    const mark = top + 34;
    const body = `M${cx - n} ${top} L${cx - n} ${nb} C${cx - n} ${nb + 0.3 * r} ${cx - r} ${base - 1.35 * r} ${cx - r} ${base - 0.8 * r} C${cx - r} ${base - 0.3 * r} ${cx - 0.8 * r} ${base} ${cx - 0.5 * r} ${base} L${cx + 0.5 * r} ${base} C${cx + 0.8 * r} ${base} ${cx + r} ${base - 0.3 * r} ${cx + r} ${base - 0.8 * r} C${cx + r} ${base - 1.35 * r} ${cx + n} ${nb + 0.3 * r} ${cx + n} ${nb} L${cx + n} ${top}`;
    return { r, n, nb, top, mark, body };
  }, [cx, base, volume]);
  const { r, n, top, mark, body } = g;
  return (
    <g>
      <path d={body + ' Z'} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
      {liquid && (
        <g>
          <clipPath id={`${id}-clip`}><rect x={cx - r - 2} y={mark - 1.5} width={2 * r + 4} height={base - mark + 2} /></clipPath>
          <g clipPath={`url(#${id}-clip)`}>
            <path d={body + ' Z'} fill={liquid} opacity="0.92" />
            <path d={body + ' Z'} fill="url(#kit-liquid-shade)" />
          </g>
          <path d={`M${cx - n + 1} ${mark - 2} Q${cx} ${mark + 1.5} ${cx + n - 1} ${mark - 2}`} fill="none" stroke="rgba(20,40,60,0.55)" strokeWidth="1" />
        </g>
      )}
      {crystals && [-0.55, -0.33, -0.12, 0.08, 0.3, 0.5].map((f, i) => (
        <rect key={f} x={cx + f * r - 3} y={base - 7 - (i % 2) * 2} width={6} height={4.5} rx={1} fill={crystals} stroke={shade(crystals, -0.35)} strokeWidth="0.6" transform={`rotate(${(i * 37) % 50 - 25} ${cx + f * r} ${base - 5})`} />
      ))}
      {/* vidrio, aforo, rótulo esmerilado y brillos */}
      <path d={body} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <ellipse cx={cx} cy={mark} rx={n + 0.5} ry={1.6} fill="none" stroke="var(--glass-print, #24454a)" strokeWidth="1.1" />
      <rect x={cx - 15} y={base - 0.98 * r} width={30} height={18} rx={2} fill="#f4f7f8" opacity="0.88" />
      <text x={cx} y={base - 0.98 * r + 8} textAnchor="middle" style={{ fontSize: 7.5, fill: '#24454a', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{volume} mL</text>
      <text x={cx} y={base - 0.98 * r + 15} textAnchor="middle" style={{ fontSize: 5.5, fill: '#24454a' }}>20 °C · TC</text>
      <path d={`M${cx - 0.74 * r} ${base - 1.25 * r} Q${cx - 0.95 * r} ${base - 0.8 * r} ${cx - 0.72 * r} ${base - 0.32 * r}`} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      <line x1={cx - n + 2.2} x2={cx - n + 2.2} y1={top + 8} y2={g.nb - 4} stroke="#fff" strokeWidth="1.6" opacity="0.45" />
      {/* tapón de polietileno */}
      <path d={`M${cx - n - 3} ${top - 11} L${cx + n + 3} ${top - 11} L${cx + n - 0.5} ${top + 6} L${cx - n + 0.5} ${top + 6} Z`} fill="#2f74ad" />
      <path d={`M${cx - n - 3} ${top - 11} L${cx + n + 3} ${top - 11} L${cx + n + 2} ${top - 7} L${cx - n - 2} ${top - 7} Z`} fill="#5d9fd6" />
      <rect x={cx - n - 1} y={top - 6} width={2.5} height={10} fill="#fff" opacity="0.3" />
    </g>
  );
}

/** Vidrio de reloj con el soluto en polvo o cristales. */
function WeighingBoat({ cx, y, powder, amount }: { cx: number; y: number; powder: string; amount: number }) {
  const s = Math.sqrt(Math.max(0, amount));
  const h = 3 + 12 * s, w = 9 + 13 * s;
  return (
    <g>
      {amount > 0 && <path d={`M${cx - w} ${y - 5} Q${cx - w * 0.4} ${y - 5 - h * 1.3} ${cx} ${y - 5 - h * 1.25} Q${cx + w * 0.4} ${y - 5 - h * 1.3} ${cx + w} ${y - 5} Z`} fill={powder} stroke={shade(powder, -0.3)} strokeWidth="0.7" />}
      {amount > 0 && [[-0.4, 0.35], [0.1, 0.7], [0.35, 0.3], [-0.1, 0.25]].map(([fx, fy], i) => <circle key={i} cx={cx + fx * w} cy={y - 5 - fy * h} r="0.9" fill="#fff" opacity="0.6" />)}
      <path d={`M${cx - 30} ${y - 8} Q${cx} ${y + 3} ${cx + 30} ${y - 8} Q${cx} ${y - 1} ${cx - 30} ${y - 8} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
    </g>
  );
}

/** Cámara antiviento de vidrio de la balanza analítica. */
function DraftShield({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      <rect x={x} y={y} width={w} height={h} fill="#cfe6ef" opacity="0.08" />
      <rect x={x - 3} y={y - 7} width={w + 6} height={9} rx={2} fill="url(#kit-body-dark)" />
      <rect x={x - 2} y={y} width={4} height={h} fill="url(#kit-metal-h)" />
      <rect x={x + w - 2} y={y} width={4} height={h} fill="url(#kit-metal-h)" />
      <rect x={x + w - 14} y={y + h / 2 - 12} width={4} height={24} rx={2} fill="url(#kit-metal-h)" stroke="#8f9a9e" strokeWidth="0.6" />
      <path d={`M${x + 18} ${y + 10} L${x + 46} ${y + 10} L${x + 18} ${y + 52} Z`} fill="#fff" opacity="0.18" />
      <path d={`M${x + w - 50} ${y + h - 14} L${x + w - 26} ${y + h - 46} L${x + w - 26} ${y + h - 14} Z`} fill="#fff" opacity="0.1" />
    </g>
  );
}

/** Pipeta aforada con propipeta de goma. */
function Pipette({ x, top, volume, liquid }: { x: number; top: number; volume: number; liquid: string | null }) {
  const bulbTop = top + 62, bulbBot = top + 112, tip = top + 200, mark = top + 34;
  const outline = `M${x - 2.5} ${top} L${x - 2.5} ${bulbTop} C${x - 2.5} ${bulbTop + 6} ${x - 8} ${bulbTop + 8} ${x - 8} ${(bulbTop + bulbBot) / 2} C${x - 8} ${bulbBot - 8} ${x - 2.5} ${bulbBot - 6} ${x - 2.5} ${bulbBot} L${x - 2.5} ${tip - 14} L${x - 0.8} ${tip} L${x + 0.8} ${tip} L${x + 2.5} ${tip - 14} L${x + 2.5} ${bulbBot} C${x + 2.5} ${bulbBot - 6} ${x + 8} ${bulbBot - 8} ${x + 8} ${(bulbTop + bulbBot) / 2} C${x + 8} ${bulbTop + 8} ${x + 2.5} ${bulbTop + 6} ${x + 2.5} ${bulbTop} L${x + 2.5} ${top}`;
  return (
    <g>
      <clipPath id="sol-pip-clip"><rect x={x - 10} y={mark} width={20} height={tip - mark} /></clipPath>
      <path d={outline + ' Z'} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
      {liquid && <path d={outline + ' Z'} fill={liquid} opacity="0.9" clipPath="url(#sol-pip-clip)" />}
      <path d={outline} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.1" />
      <line x1={x - 3.5} x2={x + 3.5} y1={mark} y2={mark} stroke="var(--glass-print, #24454a)" strokeWidth="1" />
      <ellipse cx={x} cy={top - 12} rx={9} ry={13} fill="url(#kit-bulb)" />
      <rect x={x - 4} y={top - 2} width={8} height={9} rx={1.5} fill="#8e1d1d" />
      <ellipse cx={x - 3} cy={top - 17} rx={2.5} ry={4} fill="#fff" opacity="0.35" />
      <text x={x + 14} y={top - 14} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>Pipeta {volume} mL</text>
    </g>
  );
}

/** Colorímetro de mesa con pantalla, teclas y cubeta de 1 cm. */
function Colorimeter({ x, y, reading, sample }: { x: number; y: number; reading: string; sample: string | null }) {
  const w = 132, bt = y + 34, bottom = 296;
  const cuvX = x + w - 34;
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <path d={`M${x + 10} ${bt} L${x + w - 10} ${bt} Q${x + w} ${bt} ${x + w} ${bt + 10} L${x + w + 3} ${bottom} L${x - 3} ${bottom} L${x} ${bt + 10} Q${x} ${bt} ${x + 10} ${bt} Z`} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      {/* pozo y cubeta */}
      <rect x={cuvX - 5} y={bt - 4} width={26} height={7} rx={2} fill="url(#kit-body-dark)" />
      <rect x={cuvX} y={bt - 32} width={16} height={34} rx={1} fill="url(#kit-glass-fill)" />
      {sample && <rect x={cuvX + 1.5} y={bt - 22} width={13} height={24} fill={sample} opacity="0.92" />}
      <rect x={cuvX} y={bt - 32} width={16} height={34} rx={1} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.1" />
      <rect x={cuvX - 1} y={bt - 37} width={18} height={6} rx={1.5} fill="#2b3335" />
      <rect x={cuvX + 2.5} y={bt - 28} width={2} height={26} fill="#fff" opacity="0.4" />
      {/* panel frontal */}
      <rect x={x + 8} y={bt + 8} width={w - 16} height={40} rx={6} fill="url(#kit-body-dark)" />
      <Lcd x={x + 13} y={bt + 14} w={w - 26} h={26} text={reading} />
      {[['CERO', x + 22], ['LEER', x + 56]].map(([label, bx]) => (
        <g key={label as string}>
          <rect x={bx as number} y={bt + 56} width={24} height={11} rx={3} fill="url(#kit-body-dark)" />
          <text x={(bx as number) + 12} y={bt + 77} textAnchor="middle" style={{ fontSize: 7, fill: '#55605f', fontWeight: 700 }}>{label}</text>
        </g>
      ))}
      <circle cx={x + w - 22} cy={bt + 61} r={3.2} fill={sample ? '#3ddc84' : '#7d8a8c'} stroke="#2b3335" strokeWidth="0.6" />
      <text x={x + w - 22} y={bt + 77} textAnchor="middle" style={{ fontSize: 7, fill: '#55605f', fontWeight: 700 }}>λ</text>
    </g>
  );
}

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
  const powderColor = solute.color ? toHex(solute.color) : '#f2f3ef';

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 330" role="img" aria-labelledby="sol-t sol-d">
            <title id="sol-t">Balanza, balones aforados y colorímetro</title>
            <desc id="sol-d">{ok ? `Solución de ${solute.name}: ${fmtSig(ok.molarity, 3)} mol/L en balón de ${flask} mL.${dilute ? ` Diluida ${fmt(ok.dilutionFactor, 1)} veces: ${fmtSig(ok.finalMolarity, 3)} mol/L.` : ''}${measured ? ` Absorbancia: ${ok.absorbanceReading}.` : ''}` : 'Configura la solución.'}</desc>
            <defs>
              <marker id="sol-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--ink-2)" /></marker>
            </defs>
            <BenchTop y={296} width={640} />
            {/* Balanza analítica con cámara de vidrio antiviento */}
            <DigitalBalance x={14} y={222} w={212} reading={ok ? fmt(ok.massReading, 3) : '—'}>
              <WeighingBoat cx={120} y={220} powder={powderColor} amount={ok ? Math.min(1, ok.massReading / 20) : 0} />
            </DigitalBalance>
            <DraftShield x={30} y={118} w={180} h={118} />
            <text x="120" y="322" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Balanza analítica</text>
            {/* Balón aforado con la solución madre */}
            <VolumetricFlask id="sol-madre" cx={dilute ? 288 : 350} base={296} volume={flask} liquid={ok ? color : null} crystals={ok?.saturated ? powderColor : null} />
            <text x={dilute ? 288 : 350} y="322" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Solución madre · {flask} mL</text>
            {dilute && (
              <g>
                <path d="M300 92 Q330 40 358 58" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" strokeDasharray="4 4" markerEnd="url(#sol-arrow)" />
                <Pipette x={372} top={40} volume={aliquot} liquid={ok ? color : null} />
                <VolumetricFlask id="sol-dil" cx={442} base={296} volume={dilFlask} liquid={ok ? colorDiluted : null} />
                <text x="442" y="322" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Dilución · {aliquot} → {dilFlask} mL</text>
              </g>
            )}
            {/* Colorímetro */}
            <Colorimeter x={502} y={176}
              reading={measured && ok ? (ok.absorbance === null ? 'A = 0,000' : ok.absorbance > ABSORBANCE_MAX ? 'A > 2,00' : `A = ${fmt(ok.absorbance, 3)}`) : unknownShown ? `A = ${fmt(unknownAbsorbance(), 3)}` : 'A = ---'}
              sample={measured ? colorDiluted : unknownShown ? solutionColor(SOLUTES[3], 3.6e-4) : null} />
            <text x="568" y="322" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Colorímetro {solute.wavelength ? `${solute.wavelength} nm` : ''}</text>
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

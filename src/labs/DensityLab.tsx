import { useMemo, useState } from 'react';
import { ALL_SAMPLES, closestMaterial, LIMITS, MATERIALS, simulateDensity, WATER_DENSITY } from '../models/density';
import { fmt, parseLocaleNumber } from '../lib/format';
import { Readout, RecordButton, Select, Slider, Warnings, Notice } from '../components/ui';
import type { LabProps } from './registry';

export default function DensityLab({ api }: LabProps) {
  const [materialId, setMaterialId] = useState('aluminio');
  const [side, setSide] = useState(2);
  const [initialWater, setInitialWater] = useState(50);
  const [pushUnder, setPushUnder] = useState(false);
  const [weighed, setWeighed] = useState(false);
  const [submerged, setSubmerged] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null);

  const result = useMemo(() => simulateDensity({ materialId, side, initialWater, pushUnder }), [materialId, side, initialWater, pushUnder]);
  const resetActions = () => { setWeighed(false); setSubmerged(false); setGuessFeedback(null); setGuess(''); };
  const m = result.material;
  const sizePx = side * 20;

  // Geometría de la probeta (100 mL en 260 px)
  const cylX = 410, cylW = 92, cylBottom = 316, mlPx = 2.6;
  const level = submerged && result.finalWaterReading !== null ? result.finalWaterReading : submerged ? 100 : initialWater;
  const waterY = cylBottom - level * mlPx;
  const cubeTopInCyl = submerged
    ? (result.floats && !pushUnder ? waterY - sizePx * (1 - result.submergedFraction) : cylBottom - sizePx - 2)
    : 0;

  const checkGuess = () => {
    const v = parseLocaleNumber(guess);
    if (Number.isNaN(v)) { setGuessFeedback('Escribe un número, por ejemplo 2,7.'); return; }
    if (result.massReading === null || result.displacedVolume === null || result.displacedVolume === 0) { setGuessFeedback('Primero obtén la masa y el volumen desplazado.'); return; }
    const correct = result.massReading / result.displacedVolume;
    const err = Math.abs(v - correct) / correct;
    if (err < 0.02) setGuessFeedback(`¡Bien! ρ = m/V = ${fmt(result.massReading, 1)} g ÷ ${fmt(result.displacedVolume, 1)} cm³ ≈ ${fmt(correct, 2)} g/cm³.`);
    else if (Math.abs(v - result.massReading * result.displacedVolume) / (result.massReading * result.displacedVolume) < 0.02) setGuessFeedback('Multiplicaste masa por volumen. La densidad es la masa dividida entre el volumen.');
    else if (Math.abs(v - result.displacedVolume / result.massReading) < 0.02 * (result.displacedVolume / result.massReading)) setGuessFeedback('Dividiste volumen entre masa. La densidad es masa ÷ volumen.');
    else setGuessFeedback(`Revisa el cálculo: usa la masa (${fmt(result.massReading, 1)} g) y el volumen desplazado (V_final − V_inicial).`);
  };

  const record = () => {
    api.addTrial('medidas', {
      material: m.name, lado: result.sideReading, vgeo: Number(result.geometricVolume.toFixed(3)),
      masa: result.massReading, vi: initialWater, vf: result.finalWaterReading, vdesp: result.displacedVolume,
      densidad: result.densityDisplacement !== null ? Number(result.densityDisplacement.toFixed(4)) : null,
      flota: result.floats ? (pushUnder ? 'sí (hundido con alfiler)' : 'sí') : 'no',
    });
  };

  const cubeColor = m.color;
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 340" role="img" aria-labelledby="dens-t dens-d">
            <title id="dens-t">Mesa de laboratorio con balanza y probeta</title>
            <desc id="dens-d">{`Muestra: ${m.name}, cubo de ${fmt(side, 1)} cm de arista. ` +
              (weighed ? `La balanza marca ${result.massReading === null ? 'error de sobrecarga' : fmt(result.massReading, 1) + ' g'}. ` : 'La muestra aún no se ha pesado. ') +
              (submerged ? `La probeta marca ${result.finalWaterReading === null ? 'desbordamiento' : fmt(result.finalWaterReading, 1) + ' mL'}, partiendo de ${fmt(initialWater, 1)} mL.` : `La probeta contiene ${fmt(initialWater, 1)} mL de agua.`)}</desc>
            {/* Balanza */}
            <rect x="40" y="250" width="230" height="60" rx="10" fill="var(--surface-2)" stroke="var(--ink-2)" />
            <rect x="70" y="240" width="170" height="10" rx="3" fill="var(--line)" stroke="var(--ink-2)" />
            <rect x="110" y="268" width="90" height="28" rx="4" fill="#0d1f1d" />
            <text x="155" y="288" textAnchor="middle" fill="#7CFFB2" style={{ fontFamily: 'var(--font-data)', fontSize: 16 }}>
              {weighed ? (result.massReading === null ? 'Err' : `${fmt(result.massReading, 1)} g`) : '0,0 g'}
            </text>
            <text x="155" y="328" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Balanza · resolución 0,1 g</text>
            {weighed && !submerged && (
              <rect x={155 - sizePx / 2} y={240 - sizePx} width={sizePx} height={sizePx} fill={cubeColor} stroke="var(--ink)" strokeWidth="1.2" />
            )}
            {!weighed && !submerged && (
              <g>
                <rect x={300 - sizePx / 2} y={318 - sizePx} width={sizePx} height={sizePx} fill={cubeColor} stroke="var(--ink)" strokeWidth="1.2" />
                <text x="300" y="334" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>muestra</text>
              </g>
            )}
            {/* Regla */}
            <g transform="translate(40 30)">
              <rect width="250" height="34" fill="var(--warn-soft)" stroke="var(--ink-2)" />
              {Array.from({ length: 51 }, (_, i) => (
                <line key={i} x1={10 + i * 4.6} x2={10 + i * 4.6} y1="0" y2={i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6} stroke="var(--ink-2)" />
              ))}
              {[0, 1, 2, 3, 4, 5].map((c) => <text key={c} x={10 + c * 46} y="28" textAnchor="middle" style={{ fontSize: 10 }}>{c}</text>)}
              <rect x="10" y="38" width={side * 46} height="8" fill={cubeColor} stroke="var(--ink)" />
              <text x="0" y="62" style={{ fontSize: 12, fill: 'var(--ink)' }}>Arista medida con la regla: {fmt(result.sideReading, 1)} cm</text>
            </g>
            {/* Probeta */}
            <path d={`M${cylX} 40 L${cylX} ${cylBottom} Q${cylX} ${cylBottom + 8} ${cylX + 8} ${cylBottom + 8} L${cylX + cylW - 8} ${cylBottom + 8} Q${cylX + cylW} ${cylBottom + 8} ${cylX + cylW} ${cylBottom} L${cylX + cylW} 40`} fill="none" stroke="var(--ink-2)" strokeWidth="2" />
            <rect x={cylX + 1} y={Math.max(40, waterY)} width={cylW - 2} height={cylBottom + 7 - Math.max(40, waterY)} fill="rgba(70,150,220,0.28)" />
            <line x1={cylX + 1} x2={cylX + cylW - 1} y1={Math.max(40, waterY)} y2={Math.max(40, waterY)} stroke="rgba(30,95,174,0.9)" strokeWidth="2" />
            {Array.from({ length: 21 }, (_, i) => i * 5).map((v) => (
              <g key={v}>
                <line x1={cylX + cylW} x2={cylX + cylW + (v % 10 === 0 ? 14 : 8)} y1={cylBottom - v * mlPx} y2={cylBottom - v * mlPx} stroke="var(--ink-2)" />
                {v % 10 === 0 && <text x={cylX + cylW + 18} y={cylBottom - v * mlPx + 4} style={{ fontSize: 10 }}>{v}</text>}
              </g>
            ))}
            <text x={cylX + cylW / 2} y="30" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Probeta 100 mL</text>
            {submerged && (
              <g>
                <rect x={cylX + cylW / 2 - sizePx / 2} y={cubeTopInCyl} width={sizePx} height={sizePx} fill={cubeColor} stroke="var(--ink)" strokeWidth="1.2" opacity="0.92" />
                {pushUnder && result.floats && <line x1={cylX + cylW / 2} x2={cylX + cylW / 2} y1={20} y2={cubeTopInCyl} stroke="var(--ink)" strokeWidth="1.5" />}
              </g>
            )}
            {submerged && result.finalWaterReading === null && <text x={cylX + cylW / 2} y="56" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--bad)', fontWeight: 700 }}>¡Se desborda!</text>}
          </svg>
        </div>
        <Readout items={[
          { k: 'Arista (regla)', v: `${fmt(result.sideReading, 1)} cm` },
          { k: 'Volumen geométrico a³', v: `${fmt(result.geometricVolume, 2)} cm³` },
          { k: 'Masa', v: weighed ? (result.massReading === null ? 'sobrecarga' : `${fmt(result.massReading, 1)} g`) : 'sin pesar', data: true },
          { k: 'V inicial → V final', v: submerged ? `${fmt(initialWater, 1)} → ${result.finalWaterReading === null ? '—' : fmt(result.finalWaterReading, 1)} mL` : `${fmt(initialWater, 1)} mL`, data: true },
          { k: 'V desplazado', v: submerged && result.displacedVolume !== null ? `${fmt(result.displacedVolume, 1)} mL` : '—' },
          { k: '¿Flota?', v: submerged ? (result.floats ? (pushUnder ? 'Sí (hundido con alfiler)' : `Sí: sumerge ${fmt(result.submergedFraction * 100, 0)} %`) : 'No, se hunde') : '—' },
        ]} />
        <Warnings list={submerged ? result.warnings : result.warnings.filter((w) => w.includes('balanza'))} />
        {weighed && submerged && result.massReading !== null && result.displacedVolume !== null && (
          <div className="card stack-sm">
            <label htmlFor="dens-guess">Calcula la densidad con tus mediciones (g/cm³)</label>
            <div className="btn-row">
              <input id="dens-guess" type="text" inputMode="decimal" value={guess} onChange={(e) => setGuess(e.target.value)} style={{ maxWidth: 160 }} placeholder="p. ej. 2,70" />
              <button type="button" className="btn" onClick={checkGuess}>Comprobar cálculo</button>
            </div>
            {guessFeedback && <p className="small" role="status">{guessFeedback}</p>}
            {m.hidden && result.densityDisplacement !== null && (
              <p className="small muted">Pista: compara tu resultado con la tabla de densidades de referencia. El material de la tabla más cercano a {fmt(result.densityDisplacement, 2)} g/cm³ es <strong>{closestMaterial(result.densityDisplacement).name.toLowerCase()}</strong>.</p>
            )}
          </div>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Muestra e instrumentos</h3>
          <Select label="Material" value={materialId} onChange={(v) => { setMaterialId(v); resetActions(); }}
            options={ALL_SAMPLES.map((s) => ({ value: s.id, label: s.name }))} />
          <Slider label="Arista del cubo" value={side} min={LIMITS.side[0]} max={LIMITS.side[1]} step={0.1} unit="cm" onChange={(v) => { setSide(v); resetActions(); }} />
          <Slider label="Agua inicial en la probeta" value={initialWater} min={LIMITS.initialWater[0]} max={LIMITS.initialWater[1]} step={1} unit="mL" decimals={0} onChange={(v) => { setInitialWater(v); setSubmerged(false); }} />
          <label className="check"><input type="checkbox" checked={pushUnder} onChange={(e) => setPushUnder(e.target.checked)} /> Hundir la muestra con un alfiler si flota</label>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => setWeighed(true)} disabled={weighed}>1. Pesar en la balanza</button>
            <button type="button" className="btn primary" onClick={() => setSubmerged(true)} disabled={!weighed || submerged}>2. Sumergir en la probeta</button>
            <button type="button" className="btn" onClick={resetActions}>Reiniciar medición</button>
          </div>
          <RecordButton onRecord={record} disabled={!weighed || !submerged} />
          {(!weighed || !submerged) && <p className="small muted">Pesa y sumerge la muestra para poder guardar el ensayo.</p>}
        </div>
        <details className="card">
          <summary>Tabla de densidades de referencia (20 °C)</summary>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Material</th><th className="n">ρ (g/cm³)</th></tr></thead>
              <tbody>
                {MATERIALS.map((x) => <tr key={x.id}><td>{x.name}</td><td className="n">{fmt(x.density, 2)}</td></tr>)}
                <tr><td>Agua (20 °C)</td><td className="n">{fmt(WATER_DENSITY, 3)}</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        <Notice>Simulación educativa: las lecturas se redondean a la resolución de cada instrumento. No incluye errores aleatorios del observador.</Notice>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ALL_SAMPLES, closestMaterial, LIMITS, MATERIALS, simulateDensity, WATER_DENSITY } from '../models/density';
import { fmt, parseLocaleNumber } from '../lib/format';
import { Readout, RecordButton, Select, Slider, Warnings, Notice } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, Cube, DigitalBalance, GraduatedCylinder, Ruler } from './kit';

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
  const cylX = 400, cylW = 104, cylBottom = 316, mlPx = 2.6;
  const level = submerged && result.finalWaterReading !== null ? result.finalWaterReading : submerged ? 100 : initialWater;
  const waterY = cylBottom - level * mlPx;
  const cubeTopInCyl = submerged
    ? (result.floats && !pushUnder ? waterY - sizePx * (1 - result.submergedFraction) : cylBottom + 6 - sizePx)
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
  const finish = (['aluminio', 'hierro', 'cobre', 'plomo'].includes(m.id) ? 'metal' : ['vidrio', 'hielo'].includes(m.id) ? 'vidrio' : ['pino', 'corcho'].includes(m.id) ? 'madera' : 'mate') as 'metal' | 'vidrio' | 'madera' | 'mate';
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 364" role="img" aria-labelledby="dens-t dens-d">
            <title id="dens-t">Mesa de laboratorio con balanza y probeta</title>
            <desc id="dens-d">{`Muestra: ${m.name}, cubo de ${fmt(side, 1)} cm de arista. ` +
              (weighed ? `La balanza marca ${result.massReading === null ? 'error de sobrecarga' : fmt(result.massReading, 1) + ' g'}. ` : 'La muestra aún no se ha pesado. ') +
              (submerged ? `La probeta marca ${result.finalWaterReading === null ? 'desbordamiento' : fmt(result.finalWaterReading, 1) + ' mL'}, partiendo de ${fmt(initialWater, 1)} mL.` : `La probeta contiene ${fmt(initialWater, 1)} mL de agua.`)}</desc>
            <BenchTop y={334} width={640} />
            {/* Balanza */}
            <DigitalBalance x={40} y={258} w={230} reading={weighed ? (result.massReading === null ? 'Err' : fmt(result.massReading, 1)) : '0,0'}>
              {weighed && !submerged && <Cube x={155 - sizePx / 2 - sizePx * 0.14} y={256} size={sizePx} color={cubeColor} finish={finish} />}
            </DigitalBalance>
            <text x="155" y="360" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Balanza · resolución 0,1 g</text>
            {!weighed && !submerged && (
              <g>
                <Cube x={322 - sizePx / 2} y={334} size={sizePx} color={cubeColor} finish={finish} />
                <text x="326" y="360" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>muestra</text>
              </g>
            )}
            {/* Regla */}
            <Ruler x={40} y={30} cm={5} pxPerCm={46} />
            <g>
              <rect x={50} y={68} width={side * 46} height={9} rx={1.5} fill={cubeColor} stroke="rgba(0,0,0,0.35)" />
              {finish === 'metal' && <rect x={50} y={68} width={side * 46} height={9} rx={1.5} fill="url(#kit-metal-h)" opacity="0.35" />}
              <line x1={50} x2={50} y1={62} y2={80} stroke="var(--data)" strokeWidth="1.5" />
              <line x1={50 + side * 46} x2={50 + side * 46} y1={62} y2={80} stroke="var(--data)" strokeWidth="1.5" />
              <text x="40" y="96" style={{ fontSize: 12, fill: 'var(--ink)' }}>Arista medida con la regla: {fmt(result.sideReading, 1)} cm</text>
            </g>
            {/* Probeta */}
            <GraduatedCylinder x={cylX} y={42} w={cylW} h={292} capacity={100} level={level} major={10} minor={2} label="Probeta" unit="100 mL">
              {submerged && (
                <g>
                  <Cube x={cylX + cylW / 2 - sizePx / 2 - sizePx * 0.14} y={cubeTopInCyl + sizePx} size={sizePx} color={cubeColor} finish={finish} opacity={0.94} />
                  {pushUnder && result.floats && <line x1={cylX + cylW / 2} x2={cylX + cylW / 2} y1={8} y2={cubeTopInCyl - sizePx * 0.28} stroke="var(--ink)" strokeWidth="1.5" />}
                </g>
              )}
            </GraduatedCylinder>
            {submerged && result.finalWaterReading === null && <text x={cylX + cylW / 2} y="70" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--bad)', fontWeight: 700 }}>¡Se desborda!</text>}
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

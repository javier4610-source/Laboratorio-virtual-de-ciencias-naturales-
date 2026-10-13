import { useMemo, useState } from 'react';
import { ALL_SAMPLES, CYLINDER_RESOLUTION, closestMaterial, LIMITS, MATERIALS, simulateDensity, WATER_DENSITY } from '../models/density';
import { roundToResolution } from '../models/math';
import { useMeasure } from '../components/Measurement';
import { instrument } from './instruments';
import { fmt, parseLocaleNumber } from '../lib/format';
import { Readout, RecordButton, Select, Slider, Warnings, Notice } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, Cube, DigitalBalance, GraduatedCylinder, Ruler } from './kit';
import { DragHandle, ManipHint, ManipScene, zoneAt } from './manipulate';
import { playSound } from '../lib/sound';
import { usePublishModel } from '../components/Advanced';

/** Lugares donde puede estar la muestra: 0 mesa, 1 plato de la balanza, 2 dentro de la probeta. */
const STATION_TEXT = ['La muestra está sobre la mesa', 'La muestra está en el plato de la balanza', 'La muestra está dentro de la probeta'];
/** Bordes (x en el viewBox) entre zonas al soltar la muestra: balanza | mesa | probeta. */
const DROP_EDGES = [285, 385];
const DROP_STATION = [1, 0, 2];

export default function DensityLab({ api }: LabProps) {
  const [materialId, setMaterialId] = useState('aluminio');
  const [side, setSide] = useState(2);
  const [initialWater, setInitialWater] = useState(50);
  const [pushUnder, setPushUnder] = useState(false);
  const [weighed, setWeighed] = useState(false);
  const [submerged, setSubmerged] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const model = useMemo(() => simulateDensity({ materialId, side, initialWater, pushUnder }), [materialId, side, initialWater, pushUnder]);
  // Lecturas de los instrumentos: en modo ideal coinciden con el modelo; en modo real llevan el error aleatorio de la ficha.
  const { measure, remeasure, real } = useMeasure();
  const result = useMemo(() => {
    const sideReading = measure(side, { ...instrument('densidad', 'regla'), key: 'regla' });
    const massReading = model.massReading === null ? null : measure(model.trueMass, { ...instrument('densidad', 'balanza'), key: 'masa' });
    let finalWaterReading: number | null = null, displacedVolume: number | null = null;
    if (model.finalWaterReading !== null) {
      finalWaterReading = measure(initialWater + model.trueVolume * model.submergedFraction, { ...instrument('densidad', 'probeta'), key: 'probeta' });
      displacedVolume = roundToResolution(finalWaterReading - roundToResolution(initialWater, CYLINDER_RESOLUTION), CYLINDER_RESOLUTION);
    }
    const densityDisplacement = massReading !== null && displacedVolume !== null && displacedVolume > 0 ? massReading / displacedVolume : null;
    return { ...model, sideReading, geometricVolume: sideReading ** 3, massReading, finalWaterReading, displacedVolume, densityDisplacement };
  }, [model, side, initialWater, measure]);
  // Modo avanzado: ecuaciones del modelo con las lecturas actuales.
  usePublishModel(() => {
    const m = weighed ? result.massReading : null;
    const vd = submerged ? result.displacedVolume : null;
    const floatsFree = result.floats && !pushUnder;
    return {
      vars: {
        rho: { sym: '\\rho', name: 'Densidad calculada', value: m !== null && vd ? m / vd : null, unit: 'g/cm³', decimals: 2 },
        m: { sym: 'm', name: 'Masa (balanza)', value: m, unit: 'g', decimals: 1 },
        V: { sym: 'V_{desp}', name: 'Volumen desplazado', value: vd, unit: 'cm³', decimals: 1 },
        Vg: { sym: 'V_{cubo}', name: 'Volumen geométrico', value: result.geometricVolume, unit: 'cm³', decimals: 2 },
        a: { sym: 'a', name: 'Arista (regla)', value: result.sideReading, unit: 'cm', decimals: 1 },
        Vf: { sym: 'V_{f}', name: 'Lectura final de la probeta', value: submerged ? result.finalWaterReading : null, unit: 'mL', decimals: 1 },
        Vi: { sym: 'V_{i}', name: 'Lectura inicial de la probeta', value: initialWater, unit: 'mL', decimals: 1 },
        rhoS: { sym: '\\rho_{obj}', name: 'Densidad de tabla del material', value: result.material.density, unit: 'g/cm³', decimals: 2 },
        rhoW: { sym: '\\rho_{agua}', name: 'Densidad del agua (20 °C)', value: WATER_DENSITY, unit: 'g/cm³', decimals: 3 },
        f: { sym: 'f_{sum}', name: 'Fracción sumergida', value: result.submergedFraction, decimals: 3 },
      },
      equations: [
        { title: 'Densidad', lhs: 'rho', expr: '\\frac{[m]}{[V]}', note: '1 mL = 1 cm³: el volumen desplazado se lee en la probeta.' },
        { title: 'Volumen desplazado', lhs: 'V', expr: '[Vf] − [Vi]' },
        { title: 'Volumen del cubo', lhs: 'Vg', expr: '[a]^{3}' },
        ...(floatsFree ? [{ title: 'Flotación (Arquímedes)', lhs: 'f', expr: '\\frac{[rhoS]}{[rhoW]}', note: 'Si flota, solo se sumerge esta fracción: el volumen desplazado es menor que el del cubo.' }] : []),
      ],
    };
  }, [result, weighed, submerged, initialWater, pushUnder]);
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

  // Mover la muestra con la mano hace lo mismo que los botones «Pesar» y «Sumergir» (misma fuente de verdad).
  const weigh = () => { remeasure('masa', 'regla'); setWeighed(true); playSound('clank', { intensity: 0.25 + 0.1 * side }); };
  const submerge = () => { remeasure('probeta'); setSubmerged(true); playSound(result.floats && !pushUnder ? 'drop' : 'splash', { intensity: 0.3 + 0.15 * side }); };
  const station = submerged ? 2 : weighed ? 1 : 0;
  const moveTo = (target: number) => {
    if (target === station) return;
    if (target === 0) { resetActions(); return; }
    if (target === 1) { if (!weighed) weigh(); setSubmerged(false); return; }
    if (!weighed) weigh();
    submerge();
  };
  const cubeCenter = station === 2 ? { x: cylX + cylW / 2, y: cubeTopInCyl + sizePx / 2 } : station === 1 ? { x: 155, y: 256 - sizePx / 2 } : { x: 322, y: 334 - sizePx / 2 };

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
      // La arista es la variable de entrada (nominal); la lectura de la regla entra en el volumen geométrico.
      material: m.name, lado: model.sideReading, vgeo: Number(result.geometricVolume.toFixed(3)),
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
          <ManipScene viewBox="0 0 640 364" label="Muestra que se puede mover" scene={
          <svg viewBox="0 0 640 364" role="img" aria-labelledby="dens-t dens-d">
            <title id="dens-t">Mesa de laboratorio con balanza y probeta</title>
            <desc id="dens-d">{`Muestra: ${m.name}, cubo de ${fmt(side, 1)} cm de arista. ` +
              (weighed ? `La balanza marca ${result.massReading === null ? 'error de sobrecarga' : fmt(result.massReading, 1) + ' g'}. ` : 'La muestra aún no se ha pesado. ') +
              (submerged ? `La probeta marca ${result.finalWaterReading === null ? 'desbordamiento' : fmt(result.finalWaterReading, 1) + ' mL'}, partiendo de ${fmt(initialWater, 1)} mL.` : `La probeta contiene ${fmt(initialWater, 1)} mL de agua.`)}</desc>
            <BenchTop y={334} width={640} />
            {/* Balanza */}
            <DigitalBalance x={40} y={258} w={230} reading={weighed ? (result.massReading === null ? 'Err' : fmt(result.massReading, 1)) : '0,0'}>
              {weighed && !submerged && !dragging && <Cube x={155 - sizePx / 2 - sizePx * 0.14} y={256} size={sizePx} color={cubeColor} finish={finish} />}
            </DigitalBalance>
            <text x="155" y="360" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Balanza · resolución 0,1 g</text>
            {!weighed && !submerged && (
              <g>
                {!dragging && <Cube x={322 - sizePx / 2} y={334} size={sizePx} color={cubeColor} finish={finish} />}
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
              {submerged && !dragging && (
                <g>
                  <Cube x={cylX + cylW / 2 - sizePx / 2 - sizePx * 0.14} y={cubeTopInCyl + sizePx} size={sizePx} color={cubeColor} finish={finish} opacity={0.94} />
                  {pushUnder && result.floats && <line x1={cylX + cylW / 2} x2={cylX + cylW / 2} y1={8} y2={cubeTopInCyl - sizePx * 0.28} stroke="var(--ink)" strokeWidth="1.5" />}
                </g>
              )}
            </GraduatedCylinder>
            {submerged && result.finalWaterReading === null && <text x={cylX + cylW / 2} y="70" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--bad)', fontWeight: 700 }}>¡Se desborda!</text>}
          </svg>}>
            <DragHandle label="Muestra (cubo): mover entre la mesa, la balanza y la probeta" value={station} min={0} max={2} step={1} pageStep={1}
              commit="end" affordance={!dragging}
              hit={{ x: cubeCenter.x - sizePx * 0.64, y: cubeCenter.y - sizePx * 0.78, w: sizePx * 1.42, h: sizePx * 1.28 }}
              valueText={(v) => STATION_TEXT[v] ?? ''}
              valueFromPoint={({ point }) => DROP_STATION[zoneAt(point.x, DROP_EDGES)]}
              onDragChange={setDragging} onChange={moveTo}>
              {({ dragging: d, point }) => d && point && (
                <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
                  {[[40, DROP_EDGES[0]], [DROP_EDGES[0], DROP_EDGES[1]], [DROP_EDGES[1], 600]].map(([x0, x1], i) => (
                    <rect key={i} x={x0 + 4} y={36} width={x1 - x0 - 8} height={300} rx={10} fill="var(--accent)"
                      opacity={zoneAt(point.x, DROP_EDGES) === i ? 0.12 : 0.04} />
                  ))}
                  <Cube x={point.x - sizePx / 2} y={point.y + sizePx / 2} size={sizePx} color={cubeColor} finish={finish} opacity={0.92} />
                </g>
              )}
            </DragHandle>
          </ManipScene>
        </div>
        <ManipHint>Arrastra el cubo a la balanza y luego a la probeta, o enfócalo con Tab y usa las flechas (→ avanza al siguiente instrumento).</ManipHint>
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
            <button type="button" className="btn primary" onClick={weigh} disabled={weighed}>1. Pesar en la balanza</button>
            <button type="button" className="btn primary" onClick={submerge} disabled={!weighed || submerged}>2. Sumergir en la probeta</button>
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
        <Notice>{real
          ? 'Instrumento real: cada lectura incluye un error aleatorio típico (ficha de incertidumbre). Usa «Reiniciar medición» y repite la misma muestra para estimar la dispersión.'
          : 'Simulación educativa: las lecturas se redondean a la resolución de cada instrumento. No incluye errores aleatorios del observador.'}</Notice>
      </div>
    </div>
  );
}

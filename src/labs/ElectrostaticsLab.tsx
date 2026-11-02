import { useMemo, useState, type PointerEvent } from 'react';
import {
  chargesFrom, coulombConditions, coulombStation, equipotentialSegments, ES_LIMITS, fieldLines, K_COULOMB, potentialAt, PRESETS, probe,
  type PresetId,
} from '../models/electrostatics';
import { fmt } from '../lib/format';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { fieldScene } from './electrostatics3d';

type Station = 'coulomb' | 'campo';

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Si duplico la distancia entre dos cargas, la fuerza entre ellas se reduce a la mitad.', answer: 'falso', feedback: 'Se reduce a la CUARTA parte: F ∝ 1/r². Con 2 µC y −3 µC, a 30 cm la fuerza es 0,599 N y a 60 cm, 0,150 N.' },
  { id: 'i2', text: 'La carga mayor ejerce más fuerza sobre la menor que la menor sobre la mayor.', answer: 'falso', feedback: 'Las dos fuerzas tienen el mismo módulo y sentidos opuestos (tercera ley de Newton): en F = k·q₁·q₂/r² las dos cargas entran igual.' },
  { id: 'i3', text: 'Las líneas de campo son el camino que siguen las cargas.', answer: 'falso', feedback: 'Indican la dirección de la fuerza sobre una carga positiva en cada punto. Una carga que se mueve tiene inercia y en general no sigue la línea (salvo si parte del reposo y la línea es recta).' },
  { id: 'i4', text: 'En el punto medio entre dos cargas iguales el campo eléctrico es cero, pero el potencial no.', answer: 'cierto', feedback: 'Los dos campos tienen el mismo módulo y sentidos opuestos y se cancelan; los potenciales son escalares positivos y se suman (V = 2·k·q/a).' },
  { id: 'i5', text: 'El campo eléctrico existe en un punto aunque no haya allí ninguna carga de prueba.', answer: 'cierto', feedback: 'El campo es una propiedad del espacio creada por las cargas fuentes; la carga de prueba solo sirve para medirlo (E = F/q₀). Con q₀ = 0 el dinamómetro marca 0, pero el campo sigue ahí.' },
];

/* ------------------------------------------------------------------ estación 1: riel con dos esferas */

function CoulombBench({ q1, q2, rCm, F }: { q1: number; q2: number; rCm: number; F: number }) {
  const x0 = 150, pxCm = 9.2, y = 150;
  const x2 = x0 + rCm * pxCm;
  const sphere = (x: number, q: number, name: string) => (
    <g>
      <line x1={x} x2={x} y1={y + 20} y2={y + 70} stroke="var(--ink-3)" strokeWidth="4" />
      <circle cx={x} cy={y} r="18" fill={q > 0 ? 'var(--series-1)' : q < 0 ? 'var(--series-2)' : 'var(--series-8)'} opacity="0.85" stroke="var(--ink)" />
      <text x={x} y={y + 6} textAnchor="middle" style={{ fontSize: 16, fontWeight: 700, fill: '#fff' }}>{q > 0 ? '+' : q < 0 ? '−' : '0'}</text>
      <text x={x} y={y - 28} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)' }}>{name} = {fmt(q, 1)} µC</text>
    </g>
  );
  const dir = F > 0 ? 1 : -1;
  return (
    <svg viewBox="0 0 660 260" role="img" aria-labelledby="ele-c-t ele-c-d">
      <title id="ele-c-t">Riel con dos esferas cargadas, regla y dinamómetro digital</title>
      <desc id="ele-c-d">{`Esferas de ${fmt(q1, 1)} µC y ${fmt(q2, 1)} µC separadas ${fmt(rCm, 1)} cm entre sus centros: ${F === 0 ? 'no hay fuerza' : F > 0 ? 'se repelen' : 'se atraen'}.`}</desc>
      <rect width="660" height="260" rx="14" fill="var(--surface-2)" />
      <rect x="40" y={y + 70} width="590" height="10" rx="3" fill="var(--line-strong)" />
      {Array.from({ length: 51 }, (_, i) => <line key={i} x1={x0 + i * pxCm} x2={x0 + i * pxCm} y1={y + 82} y2={y + (i % 5 ? 88 : 94)} stroke="var(--ink-2)" strokeWidth="0.8" />)}
      {[0, 10, 20, 30, 40, 50].map((c) => <text key={c} x={x0 + c * pxCm} y={y + 106} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{c}</text>)}
      {/* dinamómetro unido a la esfera 1 */}
      <rect x="50" y={y - 16} width="70" height="32" rx="5" fill="var(--surface)" stroke="var(--ink)" />
      <text x="85" y={y + 5} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink)' }}>sensor F</text>
      <line x1="120" x2={x0 - 18} y1={y} y2={y} stroke="var(--ink)" strokeWidth="2" />
      {sphere(x0, q1, 'q₁')}
      {sphere(x2, q2, 'q₂')}
      <line x1={x0} x2={x2} y1={y + 40} y2={y + 40} stroke="var(--data)" strokeDasharray="4 3" />
      <text x={(x0 + x2) / 2} y={y + 56} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--data)', fontWeight: 700 }}>r = {fmt(rCm, 1)} cm</text>
      {F !== 0 && (
        <g>
          <line x1={x2} x2={x2 + dir * 46} y1={y - 44} y2={y - 44} stroke="var(--data)" strokeWidth="3" />
          <path d={`M${x2 + dir * 54} ${y - 44} l${-dir * 10} -6 v12 Z`} fill="var(--data)" />
          <line x1={x0} x2={x0 - dir * 46} y1={y - 44} y2={y - 44} stroke="var(--data)" strokeWidth="3" />
          <path d={`M${x0 - dir * 54} ${y - 44} l${dir * 10} -6 v12 Z`} fill="var(--data)" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ estación 2: plano con líneas y equipotenciales */

const BOX = 0.4; // m
function FieldMap({ presetId, probeCm, onPick }: { presetId: PresetId; probeCm: [number, number]; onPick: (x: number, y: number) => void }) {
  const W = 420, k = W / (2 * BOX * 100); // px por cm
  const charges = useMemo(() => chargesFrom(PRESETS.find((p) => p.id === presetId)!.charges), [presetId]);
  const lines = useMemo(() => fieldLines(charges, { perCharge: 16, step: 0.004, box: BOX, maxSteps: 400, dims: 2 }), [charges]);
  const levels = useMemo(() => {
    const qmax = Math.max(...charges.map((c) => Math.abs(c.q)));
    const base = (K_COULOMB * qmax) / 0.05; // V a 5 cm de la carga mayor
    return [0.25, 0.5, 1].flatMap((f) => [base * f, -base * f]).concat(presetId === 'dipolo' ? [0] : []);
  }, [charges, presetId]);
  const eq = useMemo(() => equipotentialSegments(charges, levels, BOX, 70), [charges, levels]);
  const X = (m: number) => W / 2 + m * 100 * k, Y = (m: number) => W / 2 - m * 100 * k;
  const click = (ev: PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W, py = ((ev.clientY - r.top) / r.height) * W;
    onPick(Math.round((px - W / 2) / k), Math.round(-(py - W / 2) / k));
  };
  return (
    <svg viewBox={`0 0 ${W} ${W}`} role="img" aria-labelledby="ele-m-t ele-m-d" onPointerUp={click} style={{ width: '100%', maxWidth: 520, height: 'auto', cursor: 'crosshair', touchAction: 'pan-y' }}>
      <title id="ele-m-t">Mapa del campo eléctrico sobre la mesa: líneas de campo y equipotenciales</title>
      <desc id="ele-m-d">{`${PRESETS.find((p) => p.id === presetId)!.name}. Líneas continuas: líneas de campo (de + a −). Líneas verdes punteadas: equipotenciales. Carga de prueba en (${probeCm[0]}; ${probeCm[1]}) cm. Toca el mapa para mover la carga de prueba.`}</desc>
      <rect width={W} height={W} rx="12" fill="var(--surface-2)" />
      {[-40, -20, 0, 20, 40].map((c) => <g key={c}><line x1={X(c / 100)} x2={X(c / 100)} y1="0" y2={W} stroke="var(--line)" /><line y1={Y(c / 100)} y2={Y(c / 100)} x1="0" x2={W} stroke="var(--line)" /></g>)}
      {eq.map(({ level, segs }) => segs.map(([a, b], i) => <line key={`${level}-${i}`} x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} stroke="var(--series-3)" strokeWidth="1.3" strokeDasharray="3 3" />))}
      {lines.map((l, i) => <polyline key={i} points={l.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')} fill="none" stroke="var(--ink-2)" strokeWidth="1.1" />)}
      {lines.map((l, i) => { const m = Math.floor(l.length / 3); if (l.length < 6) return null; const a = l[m], b = l[m + 1]; const ang = (Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180) / Math.PI; return <path key={`a${i}`} d="M0 0 l-7 -4 v8 Z" transform={`translate(${X(a[0])} ${Y(a[1])}) rotate(${ang})`} fill="var(--ink-2)" />; })}
      {charges.map((c) => <g key={c.id}><circle cx={X(c.pos[0])} cy={Y(c.pos[1])} r="11" fill={c.q > 0 ? 'var(--series-1)' : 'var(--series-2)'} stroke="var(--ink)" /><text x={X(c.pos[0])} y={Y(c.pos[1]) + 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: '#fff' }}>{c.q > 0 ? '+' : '−'}</text></g>)}
      <circle cx={X(probeCm[0] / 100)} cy={Y(probeCm[1] / 100)} r="7" fill="var(--series-4)" stroke="var(--surface)" strokeWidth="2" />
      <text x="8" y={W - 8} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>cuadrícula de 20 cm</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function ElectrostaticsLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('coulomb');
  const [q1, setQ1] = useState(2);
  const [q2, setQ2] = useState(-3);
  const [rCm, setR] = useState(30);
  const [measured, setMeasured] = useState(false);
  const [presetId, setPreset] = useState<PresetId>('dipolo');
  const [q0, setQ0] = useState(10);
  const [px, setPx] = useState(0);
  const [py, setPy] = useState(15);
  const [showLines, setShowLines] = useState(true);
  const [showSurface, setShowSurface] = useState(true);
  const { measure, remeasure, real } = useMeasure();

  const cs = useMemo(() => coulombStation({ q1uC: q1, q2uC: q2, rCm }), [q1, q2, rCm]);
  const conds = useMemo(() => coulombConditions({ q1uC: q1, q2uC: q2, rCm }), [q1, q2, rCm]);
  const dyn = instrument('electrostatica', 'dinamometro'), ruler = instrument('electrostatica', 'regla'), tors = instrument('electrostatica', 'torsion');
  const read = useMemo(() => ({
    F: cs.overRange ? null : measure(cs.magnitude, { ...dyn, key: 'fuerza' }),
    r: measure(rCm, { ...ruler, key: 'distancia' }),
  }), [cs, rCm, measure, dyn, ruler]);
  const charges = useMemo(() => chargesFrom(PRESETS.find((p) => p.id === presetId)!.charges), [presetId]);
  const pr = useMemo(() => probe(charges, q0, [px, py, 0]), [charges, q0, px, py]);
  const Fread = Number.isFinite(pr.Fmag) ? measure(pr.Fmag * 1000, { ...tors, key: 'fuerzaPrueba' }) : null;
  const change = (fn: () => void) => { fn(); setMeasured(false); };

  usePublishModel(() => ({
    vars: {
      k: { sym: 'k', name: 'Constante de Coulomb', value: K_COULOMB, unit: 'N·m²/C²', sig: 3 },
      q1: { sym: 'q_{1}', name: 'Carga de la esfera 1', value: q1 * 1e-6, unit: 'C', sig: 3 },
      q2: { sym: 'q_{2}', name: 'Carga de la esfera 2', value: q2 * 1e-6, unit: 'C', sig: 3 },
      r: { sym: 'r', name: 'Distancia entre centros', value: rCm / 100, unit: 'm', decimals: 3 },
      F: { sym: 'F', name: 'Fuerza eléctrica (con signo: + repulsión)', value: cs.F, unit: 'N', decimals: 4 },
    },
    equations: [{ title: 'Ley de Coulomb', lhs: 'F', expr: '\\frac{[k]·[q1]·[q2]}{[r]^{2}}' }],
  }), [q1, q2, rCm, cs]);

  // 3D: estación 1 = campo de q₁ con q₂ como carga que siente la fuerza; estación 2 = la configuración elegida.
  const scene = useMemo(() => station === 'coulomb'
    ? fieldScene({ charges: [{ id: 'q1', q: q1 * 1e-6, pos: [-rCm / 200, 0, 0] }], probe: [rCm / 200, 0, 0], q0: q2 * 1e-6, showLines, showSurface: false,
      probeLabel: `q₂ = ${q2 >= 0 ? '+' : '−'}${fmt(Math.abs(q2), 1)} µC`, forceRef: Math.max(0.5, Math.abs(q2)) * 1e-6, forceRefDistance: 0.2 })
    : fieldScene({ charges, probe: [px / 100, py / 100, 0], q0: q0 * 1e-9, showLines, showSurface }),
  [station, q1, q2, rCm, charges, px, py, q0, showLines, showSurface]);

  const recordC = () => api.addTrial('coulomb', {
    q1, q2, distancia: rCm, distanciaMedida: read.r, fuerza: read.F, fuerzaTeorica: Number(cs.magnitude.toFixed(5)),
    invR2: Number((1 / ((read.r / 100) ** 2)).toFixed(3)), producto: Number((q1 * q2).toFixed(2)), tipo: cs.kind,
  });
  const recordF = () => api.addTrial('campo', {
    configuracion: PRESETS.find((p) => p.id === presetId)!.name, q0, x: px, y: py, r: Number(Math.hypot(px - PRESETS.find((p) => p.id === presetId)!.charges[0].x, py - PRESETS.find((p) => p.id === presetId)!.charges[0].y).toFixed(1)),
    campo: Number.isFinite(pr.Emag) ? Number(pr.Emag.toFixed(1)) : null, angulo: Number.isFinite(pr.angleDeg) ? Number(pr.angleDeg.toFixed(1)) : null,
    potencial: Number.isFinite(pr.V) ? Number(pr.V.toFixed(1)) : null, fuerza: Fread,
  });
  const V0 = potentialAt(charges, [0, 0, 0]);

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation}
          options={[{ value: 'coulomb', label: '1. Ley de Coulomb' }, { value: 'campo', label: '2. Campo y potencial' }]} />
        {station === 'coulomb' ? (
          <>
            <div className="bench"><CoulombBench q1={q1} q2={q2} rCm={rCm} F={cs.F} /></div>
            <Readout items={[
              { k: 'Fuerza en el dinamómetro', v: measured ? (read.F === null ? 'fuera de escala' : `${fmt(read.F, 3)} N`) : 'mide', data: true, resolution: measured ? resolutionText(dyn.resolution, 'N') : undefined, state: measured ? (cs.overRange ? 'bad' : 'ok') : undefined },
              { k: 'Distancia medida con la regla', v: measured ? `${fmt(read.r, 1)} cm` : 'mide', data: true, resolution: measured ? resolutionText(ruler.resolution, 'cm') : undefined },
              { k: 'Tipo de interacción', v: measured ? cs.kind : '—' },
              { k: 'k·q₁·q₂/r² (ley de Coulomb)', v: measured ? `${fmt(cs.magnitude, 4)} N` : '—' },
              { k: '1/r²', v: measured ? `${fmt(1 / (read.r / 100) ** 2, 2)} m⁻²` : '—' },
            ]} />
            <Warnings list={conds} />
          </>
        ) : (
          <>
            <div className="bench" style={{ display: 'grid', placeItems: 'center' }}><FieldMap presetId={presetId} probeCm={[px, py]} onPick={(x, y) => { setPx(Math.max(-40, Math.min(40, x))); setPy(Math.max(-40, Math.min(40, y))); playSound('click', { intensity: 0.3 }); }} /></div>
            <Readout items={[
              { k: 'Campo eléctrico E', v: Number.isFinite(pr.Emag) ? `${fmt(pr.Emag / 1000, 2)} kN/C` : '—', data: true },
              { k: 'Dirección de E (respecto al eje x)', v: Number.isFinite(pr.angleDeg) ? `${fmt(pr.angleDeg, 1)}°` : '—' },
              { k: 'Potencial V', v: Number.isFinite(pr.V) ? `${fmt(pr.V / 1000, 2)} kV` : '—', data: true },
              { k: 'Fuerza sobre q₀ (balanza de torsión)', v: Fread === null ? '—' : `${fmt(Fread, 2)} mN`, data: true, resolution: resolutionText(tors.resolution, 'mN') },
              { k: 'E = F/q₀ (con tu lectura)', v: Fread !== null && q0 !== 0 ? `${fmt(Fread / 1000 / (q0 * 1e-9) / 1000, 2)} kN/C` : '—' },
              { k: 'Distancia a la carga más cercana', v: `${fmt(pr.nearest, 1)} cm` },
            ]} />
            {pr.warnings.map((w) => <ConditionAlert key={w} level={w.includes('encima') ? 'invalido' : 'advertencia'} cause={w}
              fix={w.includes('encima') ? 'Mueve la carga de prueba a 2 cm o más de las cargas (con los deslizadores x e y, o tocando el mapa).' : 'Dale a la carga de prueba un valor distinto de 0 nC (por ejemplo, +10 nC).'} />)}
            {presetId === 'iguales' && <p className="small" style={{ margin: 0 }}>Pista: en el punto medio (0; 0) el potencial vale {fmt(V0 / 1000, 1)} kV. ¿Cuánto vale allí el campo?</p>}
          </>
        )}
        <section className="card" aria-labelledby="ele-3d-h">
          <h3 id="ele-3d-h">Vista 3D: líneas de campo, superficie equipotencial y fuerza</h3>
          <div className="btn-row" role="group" aria-label="Qué mostrar en 3D">
            <button type="button" className="btn small" aria-pressed={showLines} onClick={() => setShowLines((v) => !v)}>Líneas de campo</button>
            {station === 'campo' && <button type="button" className="btn small" aria-pressed={showSurface} onClick={() => setShowSurface((v) => !v)}>Superficie equipotencial</button>}
          </div>
          <Scene3D idPrefix="ele" title={station === 'coulomb' ? 'Fuerza entre dos cargas en 3D' : 'Campo eléctrico de las cargas en 3D'} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={360} initialOrbit={{ yaw: 0.35, pitch: 0.55 }} status="modelo"
            statusNote="Líneas integradas con el campo calculado (RK4); superficie = puntos donde V vale lo mismo que en la carga de prueba; flechas con escala fija por configuración (acortadas cerca de las cargas, se indica en el rótulo). Las esferas no están a escala." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="ele" intro="Ideas frecuentes sobre la fuerza y el campo eléctrico. Decide si son ciertas o falsas y compruébalo en las dos estaciones." />
      </div>
      <div className="controls">
        {station === 'coulomb' ? (
          <div className="card stack">
            <h3>Esferas cargadas</h3>
            <Slider label="Carga q₁" value={q1} min={ES_LIMITS.charge[0]} max={ES_LIMITS.charge[1]} step={0.5} unit="µC" decimals={1} onChange={(v) => change(() => setQ1(v))} />
            <Slider label="Carga q₂" value={q2} min={ES_LIMITS.charge[0]} max={ES_LIMITS.charge[1]} step={0.5} unit="µC" decimals={1} onChange={(v) => change(() => setQ2(v))} />
            <Slider label="Distancia entre centros" value={rCm} min={ES_LIMITS.distance[0]} max={ES_LIMITS.distance[1]} step={0.5} unit="cm" decimals={1} onChange={(v) => change(() => setR(v))} />
            <button type="button" className="btn primary" onClick={() => { remeasure('fuerza', 'distancia'); setMeasured(true); playSound('click', { intensity: 0.5 }); }}>Medir la fuerza</button>
            <RecordButton onRecord={recordC} disabled={!measured || read.F === null} />
            <Notice>{real ? 'Instrumento real: repite la medición varias veces; cada lectura trae el error típico del dinamómetro.' : 'Dinamómetro de ±20 N (0,001 N) unido a la esfera 1; la regla del riel mide la distancia entre centros (0,1 cm).'} k = 8,99 × 10⁹ N·m²/C².</Notice>
          </div>
        ) : (
          <div className="card stack">
            <h3>Cargas y carga de prueba</h3>
            <Select label="Configuración de cargas" value={presetId} onChange={(v) => setPreset(v as PresetId)} options={PRESETS.map((p) => ({ value: p.id, label: p.name }))} />
            <Slider label="Carga de prueba q₀" value={q0} min={ES_LIMITS.testCharge[0]} max={ES_LIMITS.testCharge[1]} step={1} unit="nC" decimals={0} onChange={setQ0} />
            <Slider label="Posición x de la carga de prueba" value={px} min={ES_LIMITS.coord[0]} max={ES_LIMITS.coord[1]} step={1} unit="cm" decimals={0} onChange={setPx} />
            <Slider label="Posición y de la carga de prueba" value={py} min={ES_LIMITS.coord[0]} max={ES_LIMITS.coord[1]} step={1} unit="cm" decimals={0} onChange={setPy} />
            <RecordButton onRecord={recordF} disabled={!Number.isFinite(pr.Emag)} />
            <Notice>Cargas de ±2 µC y ±3 µC sobre la mesa. La balanza de torsión mide la fuerza sobre q₀ con 0,01 mN; el campo y el potencial salen de la superposición.</Notice>
          </div>
        )}
      </div>
    </div>
  );
}


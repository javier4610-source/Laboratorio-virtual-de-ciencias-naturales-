import { useEffect, useMemo, useRef, useState } from 'react';
import { Crystal3D, getCrystal, Molecule3D, moleculeSpecies, Reaction3D } from '../chem';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { buildCompound } from '../models/inorganicNomenclature';
import { burn, dissolve, LIMITS, molar, substanceById, SUBSTANCES, type BurnResult, type DissolveResult } from '../models/oxidesHydroxides';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { StatusChip } from '../components/Provenance';
import type { LabProps } from './registry';
import { ForgeStation } from './forgeStation';
import { BenchTop, Beaker, DigitalBalance } from './kit';
import { Burner, IdeasPanel, IndicatorRack, NamesCard, PhMeter, type Idea } from './inorganicShared';
import { inorganicReaction } from './inorganicReactions3d';

const REACTION_FOR: Record<string, { burn?: string; water?: string }> = {
  mg: { burn: 'mgo' }, ca: { water: 'caoh2' }, c: { burn: 'co2', water: 'h2co3' }, s: { burn: 'so2', water: 'h2so3' }, p: { water: 'h3po4' }, na2o: { water: 'naoh' },
};
const REACTION_OPTIONS = [
  { value: 'mgo', label: '2 Mg + O₂ → 2 MgO (óxido básico)' },
  { value: 'co2', label: 'C + O₂ → CO₂ (óxido ácido)' },
  { value: 'so2', label: 'S + O₂ → SO₂ (óxido ácido)' },
  { value: 'caoh2', label: 'CaO + H₂O → Ca(OH)₂ (hidróxido)' },
  { value: 'naoh', label: 'Na₂O + H₂O → 2 NaOH (hidróxido)' },
  { value: 'h2co3', label: 'CO₂ + H₂O → H₂CO₃ (oxácido)' },
  { value: 'h2so3', label: 'SO₂ + H₂O → H₂SO₃ (oxácido)' },
  { value: 'h2so4', label: 'SO₃ + H₂O → H₂SO₄ (oxácido)' },
  { value: 'h3po4', label: 'P₄O₁₀ + 6 H₂O → 4 H₃PO₄ (oxácido)' },
];
const ACID_MOLECULE: Record<string, string> = { c: 'h2co3', s: 'h2so3', p: 'h3po4' };
const OXIDE_MOLECULE: Record<string, string> = { c: 'co2', s: 'so2', p: 'p4o10' };

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Todos los óxidos forman bases al disolverse en agua.', answer: 'falso', feedback: 'Solo los óxidos de metales solubles (Na₂O, CaO, MgO) forman hidróxidos. Los óxidos de no metales (CO₂, SO₂, P₄O₁₀) forman oxácidos, y algunos óxidos (CuO, Fe₂O₃, Al₂O₃) ni siquiera reaccionan con el agua.' },
  { id: 'i2', text: 'Al quemarse, el magnesio pierde masa porque «se consume».', answer: 'falso', feedback: 'La masa aumenta: el magnesio se combina con el oxígeno del aire. 0,50 g de Mg dan 0,83 g de MgO; los 0,33 g extra son el oxígeno que se unió (ley de conservación de la masa).' },
  { id: 'i3', text: 'Si el agua con fenolftaleína queda incolora, la disolución es ácida.', answer: 'falso', feedback: 'La fenolftaleína es incolora por debajo de pH 8,2: una disolución neutra (pH 7) también la deja incolora. Para distinguir ácido de neutro usa el papel tornasol o el indicador universal.' },
  { id: 'i4', text: 'Cuanto más óxido de magnesio se agrega al agua, más básica se vuelve sin límite.', answer: 'falso', feedback: 'El Mg(OH)₂ es poco soluble: cuando la disolución se satura (Kps = 5,61 × 10⁻¹²) el pH se queda en ≈ 10,35 y el resto del sólido se va al fondo.' },
  { id: 'i5', text: 'La lluvia ácida se forma porque los óxidos de azufre y de nitrógeno reaccionan con el agua del aire.', answer: 'cierto', feedback: 'El SO₂ y los óxidos de nitrógeno de los motores y de la quema de combustibles forman H₂SO₃, H₂SO₄ y HNO₃ con el agua de las nubes.' },
];

type Phase = 'listo' | 'ardiendo' | 'quemado' | 'medido';

function OxidesHydroxidesBench({ api }: LabProps) {
  const [subId, setSubId] = useState('mg');
  const [mass, setMass] = useState(0.5);
  const [water, setWater] = useState(100);
  const [phase, setPhase] = useState<Phase>('listo');
  const [burned, setBurned] = useState<BurnResult | null>(null);
  const [moles, setMoles] = useState<number | null>(null);
  const [sol, setSol] = useState<DissolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view3d, setView3d] = useState<'reaccion' | 'cristal' | 'molecula'>('reaccion');
  const [reactionId, setReactionId] = useState('mgo');
  const [crystalId, setCrystalId] = useState('mgo');
  const s = substanceById(subId);
  const fromBottle = !s.burn;
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const reset = (next?: Partial<{ sub: string }>) => {
    if (timer.current) window.clearTimeout(timer.current);
    setPhase('listo'); setBurned(null); setMoles(null); setSol(null); setError(null);
    if (next?.sub) {
      setSubId(next.sub);
      const r = REACTION_FOR[next.sub];
      if (r?.burn ?? r?.water) setReactionId((r.burn ?? r.water)!);
      if (next.sub === 'ca') setCrystalId('cao');
      if (next.sub === 'mg') setCrystalId('mgo');
    }
  };

  const doBurn = () => {
    try {
      setError(null);
      if (fromBottle) {
        const n = mass / molar(s.formula);
        setMoles(n); setBurned(null); setSol(null); setPhase('quemado');
        playSound('click');
        return;
      }
      const r = burn(subId, mass);
      setSol(null);
      const done = () => { setBurned(r); setMoles(r.molesOxide); setPhase('quemado'); playSound('confirm'); };
      if (prefersReducedMotion()) { done(); return; }
      setPhase('ardiendo');
      playSound('click');
      timer.current = window.setTimeout(done, 1600);
    } catch (e) { setError((e as Error).message); playSound('error'); }
  };

  const doWater = () => {
    if (moles === null) return;
    try {
      const r = dissolve(subId, moles, water);
      setSol(r); setPhase('medido'); setError(null);
      playSound('confirm');
    } catch (e) { setError((e as Error).message); playSound('error'); }
  };

  const record = () => {
    if (!sol) return;
    api.addTrial('oxidos', {
      reactivo: s.name, tipo: s.kind === 'metal' ? 'metal' : s.kind === 'nometal' ? 'no metal' : 'óxido (frasco)', masa: mass,
      masaOxido: burned?.massReading ?? (fromBottle ? mass : null), razon: burned && burned.massReading !== null ? burned.massReading / mass : null,
      oxido: sol.oxide.formulaPretty, funcionOxido: sol.oxide.fn === 'oxido-acido' ? 'óxido ácido' : sol.oxide.fn === 'oxido-anfotero' ? 'óxido anfótero' : 'óxido básico',
      agua: water, concentracion: sol.dissolved, pH: sol.pHReading, caracter: sol.character,
      fenolftaleina: sol.indicators[0].text, tornasol: sol.indicators[1].text, universal: sol.indicators[2].text, producto: sol.product?.formulaPretty ?? 'no reacciona',
    });
  };

  const shownOxide = useMemo(() => burned?.oxide ?? sol?.oxide ?? (fromBottle && moles !== null ? buildCompound(s.oxide) : null), [burned, sol, fromBottle, moles, s]);
  const reaction = useMemo(() => inorganicReaction(reactionId), [reactionId]);
  const crystal = useMemo(() => getCrystal(crystalId), [crystalId]);
  const moleculeId = ACID_MOLECULE[subId] ?? OXIDE_MOLECULE[subId] ?? 'agua';
  const molSpecies = useMemo(() => moleculeSpecies(sol?.product && ACID_MOLECULE[subId] ? ACID_MOLECULE[subId] : moleculeId), [sol, subId, moleculeId]);

  /* ---------- escena */
  const W = 760, H = 360, benchY = 318;
  const burning = phase === 'ardiendo';
  const ph = sol ? fmt(sol.pHReading, 2) : '—';
  const powder = s.kind === 'metal' ? (subId === 'cu' ? '#2b2b2b' : '#f4f4ef') : subId === 'fe2o3' ? '#8a3b1d' : '#f4f4ef';
  const beakerTint = sol ? (sol.indicators[2].color) : '#cfe3ee';
  const sceneDesc = `${s.name}, ${fmt(mass, 2)} g. ${phase === 'listo' ? 'Listo para comenzar.' : burning ? `Ardiendo: ${s.flame ?? ''}.` : burned ? `Se formó ${burned.oxide.formulaPretty}${burned.massReading !== null ? `; la balanza marca ${fmt(burned.massReading, 2)} g` : ' (gas recogido en el matraz)'}.` : fromBottle && moles ? `Se pesaron ${fmt(mass, 2)} g de ${s.formula} del frasco.` : ''} ${sol ? `Con ${water} mL de agua el pH-metro marca ${ph}; fenolftaleína ${sol.indicators[0].text}, tornasol ${sol.indicators[1].text}, indicador universal ${sol.indicators[2].text}.` : ''}`;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="oxh-t oxh-d">
            <title id="oxh-t">Banco de trabajo: combustión del reactivo, balanza, vaso con agua, pH-metro e indicadores</title>
            <desc id="oxh-d">{sceneDesc}</desc>
            <BenchTop y={benchY} width={W} />
            {/* estación de combustión */}
            <Burner x={110} y={benchY} flame={burning ? (subId === 's' ? '#6f8dff' : subId === 'ca' ? '#ff7a3d' : subId === 'p' ? '#ffd34d' : '#ffffff') : '#ffffff'} on={burning} />
            {!fromBottle && (
              <g aria-hidden="true">
                <rect x={22} y={benchY - 8} width={70} height={8} rx={2} fill="url(#kit-metal)" stroke="#7d8a8f" />
                <rect x={36} y={benchY - 196} width={6} height={190} rx={2} fill="url(#kit-metal-h)" stroke="#7d8a8f" strokeWidth="0.6" />
                <rect x={30} y={benchY - 158} width={20} height={12} rx={3} fill="#59656a" />
                <line x1={48} y1={benchY - 152} x2={104} y2={benchY - 152} stroke="#8d989c" strokeWidth="3.4" strokeLinecap="round" />
                <path d={`M98 ${benchY - 158} q12 10 24 0 v-4 h-24 Z`} fill="url(#kit-metal)" stroke="#7d8a8f" />
                <rect x={101} y={benchY - 166} width={18} height={6} rx={2} fill={phase === 'listo' ? (s.kind === 'metal' ? '#b8bec2' : subId === 's' ? '#f2d32b' : subId === 'p' ? '#b23a2a' : '#2a2a2a') : powder} />
                {burning && <circle cx={110} cy={benchY - 170} r={16} fill={subId === 'mg' ? '#ffffff' : '#ffd36b'} opacity="0.9" />}
              </g>
            )}
            <text x={86} y={benchY - 206} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)', fontWeight: 700 }}>{fromBottle ? 'Frasco' : 'Combustión'}</text>
            {fromBottle && (
              <g aria-hidden="true" filter="url(#kit-shadow-soft)">
                <rect x={70} y={benchY - 110} width={80} height={110} rx={10} fill={subId === 'fe2o3' ? '#7a3a1e' : '#e7e2d6'} opacity="0.9" stroke="#8d989c" />
                <rect x={80} y={benchY - 124} width={60} height={16} rx={3} fill="#36424a" />
                <rect x={78} y={benchY - 80} width={64} height={30} rx={3} fill="#fff" stroke="#c8d2d4" />
                <text x={110} y={benchY - 60} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: '#24454a' }}>{s.formula.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])}</text>
              </g>
            )}
            {/* balanza con el crisol */}
            <DigitalBalance x={178} y={benchY - 80} w={180} reading={burned && burned.massReading !== null ? fmt(burned.massReading, 2) : fromBottle && moles ? fmt(mass, 2) : '0,00'} unit="g">
              <g aria-hidden="true">
                <path d={`M${238} ${benchY - 82} L${298} ${benchY - 82} L${291} ${benchY - 108} L${245} ${benchY - 108} Z`} fill="#f1efe8" stroke="#a9a496" />
                {(burned || (fromBottle && moles)) && !burned?.gas && <ellipse cx={268} cy={benchY - 106} rx={20} ry={4} fill={powder} stroke="#9a9a90" />}
              </g>
            </DigitalBalance>
            {burned?.gas && <text x={268} y={benchY - 118} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>gas → matraz con agua</text>}
            {/* vaso con agua */}
            <Beaker x={384} y={benchY - 150} w={110} h={150} fill={0.25 + (water / 250) * 0.6} liquid={beakerTint.startsWith('#') ? beakerTint : '#cfe3ee'} liquidOpacity={sol ? 0.45 : 0.35} label={`${water} mL de agua`} />
            {sol && sol.limitedBy === 'Kps' && <ellipse cx={439} cy={benchY - 10} rx={34} ry={5} fill="#f4f4ef" stroke="#c4c2b6" />}
            <PhMeter x={664} y={benchY - 112} reading={ph} probeTo={[462, benchY - 40]} />
            <IndicatorRack x={524} y={benchY - 150} readings={sol?.indicators ?? null} idle={!sol} />
          </svg>
        </div>
        <Readout items={[
          { k: 'Reactivo', v: `${s.name} · ${fmt(mass, 2)} g` },
          { k: 'Masa del óxido (balanza)', v: burned ? (burned.massReading !== null ? `${fmt(burned.massReading, 2)} g` : 'gas: no se pesa') : fromBottle && moles ? `${fmt(mass, 2)} g` : 'quema', data: true },
          { k: 'Óxido formado', v: burned ? burned.oxide.formulaPretty : fromBottle ? s.formula.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]) : '—' },
          { k: 'pH medido', v: sol ? ph : 'mide', data: true },
          { k: 'Carácter de la disolución', v: sol ? sol.character : '—' },
          { k: 'Producto con el agua', v: sol ? (sol.product?.formulaPretty ?? 'no reacciona') : '—' },
        ]} />
        <div className="readout" aria-live="polite" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {(sol?.indicators ?? [{ name: 'Fenolftaleína', text: '—', color: 'transparent' }, { name: 'Papel tornasol', text: '—', color: 'transparent' }, { name: 'Indicador universal', text: '—', color: 'transparent' }]).map((r) => (
            <div className="item" key={r.name}><div className="k">{r.name}</div><div className="v"><span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, marginRight: 6, background: r.color, border: '1px solid var(--line)', verticalAlign: 'middle' }} />{r.text}</div></div>
          ))}
        </div>
        {burned && <Notice>Ecuación balanceada: <strong>{burned.equation}</strong>. {burned.massReading !== null ? `Razón de masas m(óxido)/m(${s.formula}) = ${fmt(burned.massReading / mass, 3)}.` : 'El óxido es un gas (o humo) que se recoge en el matraz con agua.'} {s.flame ? `Observación: ${s.flame}.` : ''}</Notice>}
        {sol && <Notice kind={sol.character === 'neutro' ? 'info' : 'ok'}>{sol.equation ? <>Con el agua: <strong>{sol.equation}</strong>. </> : null}{sol.note}</Notice>}
        {s.note && !sol && <Notice>{s.note}</Notice>}
        {error && <Notice kind="bad">{error}</Notice>}

        {shownOxide && (
          <section className="card stack" aria-labelledby="oxh-names-h">
            <h3 id="oxh-names-h">Nomenclatura en los tres sistemas</h3>
            <NamesCard compound={shownOxide} title="Óxido" idPrefix="oxh-ox" />
            {sol?.product && <NamesCard compound={sol.product} title={sol.product.fn === 'hidroxido' ? 'Hidróxido' : 'Oxácido'} idPrefix="oxh-pr" />}
          </section>
        )}

        <section className="card stack" aria-labelledby="oxh-3d-h">
          <h3 id="oxh-3d-h">Visor 3D</h3>
          <Segmented label="Qué ver en 3D" value={view3d} options={[{ value: 'reaccion', label: 'Reacción en 3D' }, { value: 'cristal', label: 'Red de un óxido iónico' }, { value: 'molecula', label: 'Molécula' }]} onChange={setView3d} />
          {view3d === 'reaccion' && (
            <>
              <Select label="Reacción" value={reactionId} options={REACTION_OPTIONS} onChange={setReactionId} />
              <Reaction3D def={reaction} idPrefix="oxh" height={300} />
            </>
          )}
          {view3d === 'cristal' && (
            <>
              <Select label="Óxido iónico" value={crystalId} options={[
                { value: 'mgo', label: 'MgO · óxido de magnesio (periclasa)' }, { value: 'cao', label: 'CaO · óxido de calcio (cal viva)' },
                { value: 'bao', label: 'BaO · óxido de bario' }, { value: 'li2o', label: 'Li₂O · óxido de litio (antifluorita)' },
                { value: 'na2o', label: 'Na₂O · óxido de sodio (antifluorita)' }, { value: 'k2o', label: 'K₂O · óxido de potasio (antifluorita)' },
                { value: 'al2o3', label: 'Al₂O₃ · corindón' }, { value: 'tio2', label: 'TiO₂ · rutilo' }, { value: 'sio2', label: 'SiO₂ · cuarzo α (red covalente)' },
              ]} onChange={setCrystalId} />
              <Crystal3D crystal={crystal} idPrefix="oxh" height={300} />
              <p className="small muted" style={{ margin: 0 }}>{crystal.bonding === 'covalente'
                ? 'El SiO₂ es un óxido de un no metal, pero no forma moléculas: es una red covalente en la que cada Si se une a 4 O y cada O a 2 Si. Por eso «SiO₂» es una fórmula de proporción.'
                : `Los óxidos de metales son sólidos iónicos: no forman moléculas sino redes de cationes y aniones O²⁻. Por eso «${crystal.formula}» es una fórmula de proporción, no una molécula.`}</p>
            </>
          )}
          {view3d === 'molecula' && (
            <>
              <p className="small" style={{ margin: 0 }}>Los óxidos de no metales y los oxácidos sí son moléculas: {sol?.product && ACID_MOLECULE[subId] ? 'aquí ves el oxácido que se formó.' : OXIDE_MOLECULE[subId] ? 'aquí ves el óxido que se formó.' : 'elige carbono, azufre o fósforo para ver su óxido y su oxácido; por defecto se muestra el agua.'}</p>
              <Molecule3D species={molSpecies} idPrefix="oxh-mol" height={280} measure />
            </>
          )}
        </section>

        <IdeasPanel ideas={IDEAS} idPrefix="oxh" intro="Son ideas muy comunes sobre los óxidos y los indicadores. Decide si son ciertas o falsas y compruébalo en el banco." />
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>1 · Reactivo</h3>
          <Select label="Reactivo" value={subId} onChange={(v) => { reset({ sub: v }); playSound('click', { intensity: 0.3 }); }}
            options={SUBSTANCES.map((x) => ({ value: x.id, label: `${x.name}${x.kind === 'metal' ? ' · metal' : x.kind === 'nometal' ? ' · no metal' : ''}` }))} />
          <Slider label="Masa del reactivo" value={mass} min={LIMITS.mass[0]} max={LIMITS.mass[1]} step={0.05} unit="g" decimals={2} onChange={(v) => { setMass(v); reset(); }} />
          <button type="button" className="btn primary" onClick={doBurn} disabled={burning}>{fromBottle ? 'Pesar el óxido del frasco' : 'Quemar en el aire'}</button>
          <p className="small muted" style={{ margin: 0 }}>{fromBottle ? 'Este óxido no se obtiene quemando el metal en el aire (ver la nota).' : 'Combustión completa con exceso de oxígeno del aire.'}</p>
        </div>
        <div className="card stack">
          <h3>2 · Agua e indicadores</h3>
          <Slider label="Volumen de agua destilada" value={water} min={LIMITS.water[0]} max={LIMITS.water[1]} step={10} unit="mL" decimals={0} onChange={(v) => { setWater(v); setSol(null); if (phase === 'medido') setPhase('quemado'); }} />
          <button type="button" className="btn primary" onClick={doWater} disabled={moles === null || burning}>Añadir agua y medir el pH</button>
          {moles === null && <p className="small muted" style={{ margin: 0 }}>Primero {fromBottle ? 'pesa el óxido' : 'quema el reactivo'}.</p>}
          <RecordButton onRecord={record} disabled={!sol} />
          {!sol && <p className="small muted" style={{ margin: 0 }}>Mide el pH para poder guardar el ensayo.</p>}
        </div>
        <div className="card stack">
          <h3>Procedencia</h3>
          <div className="btn-row" role="note" aria-label="Procedencia de los resultados">
            <StatusChip status="modelo" prefix="Masas y pH" />
            <StatusChip status="ilustracion" prefix="Colores de los indicadores" />
          </div>
          <p className="small" style={{ margin: 0 }}>Masas: estequiometría de la ecuación balanceada. pH: balance de cargas a 25 °C con pKa de Harris (2010) y Kps del CRC Handbook (2016). Colores: aproximados (la fenolftaleína vira entre 8,2 y 10,0).</p>
        </div>
      </div>
    </div>
  );
}

/** Práctica con dos estaciones: el banco original y el Taller de formación de compuestos (ruta inicial: metal-o2). */
export default function OxidesHydroxidesLab(props: LabProps) {
  return (
    <ForgeStation {...props} initialRoute="metal-o2" idPrefix="oxh-tf" benchLabel="Banco de trabajo">
      <OxidesHydroxidesBench {...props} />
    </ForgeStation>
  );
}

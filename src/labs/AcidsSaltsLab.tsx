import { useMemo, useState, type ReactNode } from 'react';
import { Crystal3D, getCrystal, Molecule3D, moleculeSpecies, Reaction3D } from '../chem';
import { Chart } from '../components/Chart';
import { StatusChip } from '../components/Provenance';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { fmt } from '../lib/format';
import { playSound } from '../lib/sound';
import { mixturePHGeneral, SOLUTES } from '../models/aqueousEquilibria';
import { acidDef, equivalenceVolumes, neutralization, SALT_LIMITS, saltDef, saltSolution, SALTS, TITRATION_ACIDS, TITRATION_LIMITS, titrationCurve, titrationPH, type SaltSolution } from '../models/acidsSalts';
import { buildCompound, type Spec } from '../models/inorganicNomenclature';
import { litmus, phenolphthalein, universal } from '../models/oxidesHydroxides';
import { roundToResolution } from '../models/math';
import type { LabProps } from './registry';
import { BenchTop, Beaker, Burette, Erlenmeyer } from './kit';
import { IdeasPanel, IndicatorRack, NamesCard, PhMeter, type Idea } from './inorganicShared';
import { inorganicReaction } from './inorganicReactions3d';

type Station = 'acidos' | 'neutralizacion' | 'sales';

/** Formación de ácidos: reacción 3D, especificación del motor de nomenclatura, molécula 3D y soluto para el pH. */
const FORMATIONS: { id: string; label: string; reaction: string; spec: Spec; molecule: string; solute: (c: number) => ReturnType<typeof SOLUTES.HCl>; kind: 'hidrácido' | 'oxácido' }[] = [
  { id: 'hcl', label: 'H₂ + Cl₂ → 2 HCl (hidrácido)', reaction: 'hcl', spec: { kind: 'hidracido', el: 'Cl' }, molecule: 'hcl', solute: SOLUTES.HCl, kind: 'hidrácido' },
  { id: 'h2so4', label: 'SO₃ + H₂O → H₂SO₄ (oxácido)', reaction: 'h2so4', spec: { kind: 'oxacido', el: 'S', ox: 6 }, molecule: 'h2so4', solute: SOLUTES.H2SO4, kind: 'oxácido' },
  { id: 'hno3', label: 'N₂O₅ + H₂O → 2 HNO₃ (oxácido)', reaction: 'hno3', spec: { kind: 'oxacido', el: 'N', ox: 5 }, molecule: 'hno3', solute: SOLUTES.HNO3, kind: 'oxácido' },
  { id: 'h2co3', label: 'CO₂ + H₂O → H₂CO₃ (oxácido débil)', reaction: 'h2co3', spec: { kind: 'oxacido', el: 'C', ox: 4 }, molecule: 'h2co3', solute: SOLUTES.H2CO3, kind: 'oxácido' },
  { id: 'h3po4', label: 'P₄O₁₀ + 6 H₂O → 4 H₃PO₄ (oxácido)', reaction: 'h3po4', spec: { kind: 'oxacido', el: 'P', ox: 5 }, molecule: 'h3po4', solute: SOLUTES.H3PO4, kind: 'oxácido' },
];

const IDEAS: Idea[] = [
  { id: 'a1', text: 'Una sal siempre forma una disolución neutra (pH 7).', answer: 'falso', feedback: 'Solo las sales de ácido fuerte y base fuerte (NaCl, KNO₃) dan pH ≈ 7. El acetato de sodio y el carbonato de sodio dan disoluciones básicas, y el cloruro de amonio, ácidas (hidrólisis).' },
  { id: 'a2', text: 'El bicarbonato de sodio es una «sal ácida», así que su disolución es ácida.', answer: 'falso', feedback: '«Sal ácida» es un nombre de nomenclatura: el anión HCO₃⁻ conserva un H del ácido. Pero en agua capta H⁺ más de lo que cede y la disolución 0,1 M tiene pH ≈ 8,3 (básica). Compruébalo en la estación 3.' },
  { id: 'a3', text: 'En el punto de equivalencia de cualquier titulación el pH es 7.', answer: 'falso', feedback: 'Solo con ácido fuerte y base fuerte. Con ácido acético y NaOH, en la equivalencia hay acetato (básico) y el pH es ≈ 8,7.' },
  { id: 'a4', text: 'El H₂SO₄ necesita el doble de NaOH que la misma cantidad de HCl para neutralizarse.', answer: 'cierto', feedback: 'El ácido sulfúrico es diprótico: cada molécula cede dos H⁺ (H₂SO₄ + 2 NaOH → Na₂SO₄ + 2 H₂O).' },
  { id: 'a5', text: 'Un ácido «fuerte» es lo mismo que un ácido «concentrado».', answer: 'falso', feedback: 'Fuerte se refiere a que se disocia por completo (HCl, HNO₃); concentrado, a cuánto soluto hay por litro. Un ácido fuerte muy diluido puede tener pH 5, y uno débil concentrado, pH 2.' },
];

const flaskTint = (pH: number) => (pH < 8.2 ? '#e9f2f6' : pH >= 10 ? '#d63384' : '#efb2cf');

export default function AcidsSaltsLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('acidos');

  /* ---------- estación 1: formación de ácidos */
  const [formId, setFormId] = useState('hcl');
  const [formConc, setFormConc] = useState(0.01);
  const [formPH, setFormPH] = useState<number | null>(null);
  const form = FORMATIONS.find((f) => f.id === formId)!;
  const formCompound = useMemo(() => buildCompound(form.spec), [form]);
  const measureForm = () => {
    const pH = mixturePHGeneral({ solutes: [form.solute(formConc)] });
    setFormPH(roundToResolution(pH, 0.01)); playSound('confirm');
  };
  const recordForm = () => { if (formPH === null) return; api.addTrial('acidos', { acido: formCompound.formulaPretty, tipo: form.kind, concentracion: formConc, pH: formPH, nombre: formCompound.names.tradicional ?? formCompound.names.sistematica }); };

  /* ---------- estación 2: neutralización */
  const [acidId, setAcidId] = useState('hcl');
  const [ca, setCa] = useState(0.1);
  const [va, setVa] = useState(25);
  const [cb, setCb] = useState(0.1);
  const [vb, setVb] = useState(0);
  const [titPH, setTitPH] = useState<{ v: number; pH: number } | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [showModel, setShowModel] = useState(false);
  const acid = acidDef(acidId);
  const veqs = useMemo(() => equivalenceVolumes(acidId, ca, va, cb), [acidId, ca, va, cb]);
  const vmax = Math.min(100, Math.max(10, Math.ceil((veqs[Math.min(veqs.length, 2) - 1] * 1.6) / 5) * 5));
  const curve = useMemo(() => (showModel ? titrationCurve(acidId, ca, va, cb, vmax, 160).map((p) => ({ x: p.v, y: p.pH })) : []), [showModel, acidId, ca, va, cb, vmax]);
  const neut = useMemo(() => neutralization(acidId), [acidId]);
  const resetTit = () => { setTitPH(null); setPoints([]); };
  const measureTit = () => {
    const pH = roundToResolution(titrationPH(acidId, ca, va, cb, vb), 0.01);
    setTitPH({ v: vb, pH });
    setPoints((p) => [...p.filter((q) => Math.abs(q.x - vb) > 1e-9), { x: vb, y: pH }].sort((a, b) => a.x - b.x));
    playSound('click');
  };
  const titCurrent = titPH && Math.abs(titPH.v - vb) < 1e-9 ? titPH : null;
  const titState = (v: number) => {
    const last = veqs[veqs.length - 1];
    const near = veqs.findIndex((e) => Math.abs(v - e) < 0.005 * e + 1e-9);
    if (near >= 0) return veqs.length > 1 ? `punto de equivalencia ${near + 1}` : 'punto de equivalencia';
    return v < veqs[0] ? 'antes de la equivalencia' : v > last ? 'después de la equivalencia' : 'entre equivalencias';
  };
  const recordTit = () => { if (!titCurrent) return; api.addTrial('titulacion', { acido: acid.formula, concAcido: ca, volAcido: va, concBase: cb, volBase: vb, pH: titCurrent.pH, estado: titState(vb) }); };

  /* ---------- estación 3: sales */
  const [saltId, setSaltId] = useState('nacl');
  const [saltConc, setSaltConc] = useState(0.1);
  const [saltRes, setSaltRes] = useState<SaltSolution | null>(null);
  const [crystalId, setCrystalId] = useState('nacl');
  const salt = saltDef(saltId);
  const saltCompound = useMemo(() => (salt.spec ? buildCompound(salt.spec) : null), [salt]);
  const measureSalt = () => { setSaltRes(saltSolution(saltId, saltConc)); playSound('confirm'); };
  const recordSalt = () => { if (!saltRes) return; api.addTrial('sales', { sal: salt.formula.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]), tipoSal: saltRes.saltClass, concentracion: saltConc, pH: saltRes.pHReading, caracter: saltRes.character, origen: salt.origin }); };

  const reactionId = station === 'acidos' ? form.reaction : station === 'neutralizacion' ? (acidId === 'h2so4' ? 'sulfato' : 'neutralizacion') : 'neutralizacion';
  const reaction = useMemo(() => inorganicReaction(reactionId), [reactionId]);

  /* ---------- escena */
  const W = 760, H = 360, benchY = 318;
  let scene: ReactNode;
  let desc = '';
  if (station === 'neutralizacion') {
    const pHnow = titCurrent?.pH ?? null;
    desc = `Bureta con NaOH ${fmt(cb, 3)} M; se han añadido ${fmt(vb, 2)} mL sobre ${fmt(va, 2)} mL de ${acid.formula} ${fmt(ca, 3)} M con fenolftaleína.${pHnow !== null ? ` El pH-metro marca ${fmt(pHnow, 2)}.` : ''}`;
    scene = (
      <>
        <rect x={238} y={20} width={6} height={benchY - 20} fill="url(#kit-metal-h)" />
        <rect x={190} y={benchY - 8} width={110} height={8} rx={2} fill="url(#kit-metal)" />
        <rect x={238} y={40} width={44} height={8} rx={2} fill="url(#kit-metal)" />
        <Burette x={270} y={30} h={196} capacity={100} level={vb} liquid="#a9cdea" liquidOpacity={0.85} major={5} />
        <Erlenmeyer x={226} y={benchY - 92} w={112} h={92} fill={(va + vb) / 160} liquid={pHnow !== null ? flaskTint(pHnow) : '#e9f2f6'} liquidOpacity={0.55} />
        <text x={282} y={benchY + 34} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{acid.formula} + fenolftaleína</text>
        <PhMeter x={384} y={benchY - 112} reading={pHnow !== null ? fmt(pHnow, 2) : '—'} probeTo={[300, benchY - 30]} />
        <g aria-hidden="true">
          <rect x={540} y={benchY - 128} width={180} height={128} rx={10} fill="var(--surface)" stroke="var(--line)" />
          <text x={630} y={benchY - 106} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>Neutralización</text>
          <text x={630} y={benchY - 82} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{neut.equation.split('→')[0]}→</text>
          <text x={630} y={benchY - 62} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{neut.equation.split('→')[1]}</text>
          <text x={630} y={benchY - 36} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>ácido + hidróxido → sal + agua</text>
          <text x={630} y={benchY - 16} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>H⁺ + OH⁻ → H₂O</text>
        </g>
      </>
    );
  } else {
    const res = station === 'acidos' ? (formPH !== null ? formPH : null) : saltRes?.pHReading ?? null;
    const readings = res !== null ? [phenolphthalein(res), litmus(res), universal(res)] : null;
    const label = station === 'acidos' ? `${formCompound.formulaPretty} ${fmt(formConc, 3)} M` : `${salt.formula.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])} ${fmt(saltConc, 3)} M`;
    desc = `Vaso con ${label}.${res !== null ? ` El pH-metro marca ${fmt(res, 2)}; fenolftaleína ${readings![0].text}, tornasol ${readings![1].text}, indicador universal ${readings![2].text}.` : ' Aún sin medir.'}`;
    scene = (
      <>
        {station === 'acidos' && (
          <g aria-hidden="true">
            <rect x={60} y={benchY - 160} width={70} height={160} rx={14} fill="#e6edf0" stroke="#8d989c" />
            <rect x={78} y={benchY - 176} width={34} height={18} rx={4} fill="#36424a" />
            <text x={95} y={benchY - 80} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: '#24454a' }}>{form.kind === 'hidrácido' ? 'H₂/Cl₂' : 'óxido'}</text>
            <text x={95} y={benchY - 62} textAnchor="middle" style={{ fontSize: 10, fill: '#24454a' }}>{form.kind}</text>
          </g>
        )}
        {station === 'sales' && (
          <g aria-hidden="true">
            <rect x={60} y={benchY - 120} width={74} height={120} rx={8} fill="#f3f1ea" stroke="#a9a496" />
            <rect x={70} y={benchY - 132} width={54} height={14} rx={3} fill="#36424a" />
            <rect x={66} y={benchY - 90} width={62} height={34} rx={3} fill="#fff" stroke="#c8d2d4" />
            <text x={97} y={benchY - 68} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: '#24454a' }}>{salt.formula.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])}</text>
          </g>
        )}
        <Beaker x={200} y={benchY - 160} w={130} h={160} fill={0.62} liquid={readings ? readings[2].color : '#cfe3ee'} liquidOpacity={readings ? 0.5 : 0.35} label={label} />
        <PhMeter x={388} y={benchY - 112} reading={res !== null ? fmt(res, 2) : '—'} probeTo={[280, benchY - 30]} />
        <IndicatorRack x={560} y={benchY - 150} readings={readings} idle={!readings} />
      </>
    );
  }

  const indicatorReadout = (pH: number | null) => (
    <div className="readout" aria-live="polite" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      {(pH !== null ? [phenolphthalein(pH), litmus(pH), universal(pH)] : [{ name: 'Fenolftaleína', text: '—', color: 'transparent' }, { name: 'Papel tornasol', text: '—', color: 'transparent' }, { name: 'Indicador universal', text: '—', color: 'transparent' }]).map((r) => (
        <div className="item" key={r.name}><div className="k">{r.name}</div><div className="v"><span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, marginRight: 6, background: r.color, border: '1px solid var(--line)', verticalAlign: 'middle' }} />{r.text}</div></div>
      ))}
    </div>
  );

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented label="Estación de trabajo" value={station} options={[{ value: 'acidos', label: '1 · Ácidos' }, { value: 'neutralizacion', label: '2 · Neutralización' }, { value: 'sales', label: '3 · Sales' }]} onChange={(v) => { setStation(v); playSound('click', { intensity: 0.3 }); }} />
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="acs-t acs-d">
            <title id="acs-t">{station === 'neutralizacion' ? 'Montaje de titulación: bureta con NaOH, erlenmeyer con ácido y pH-metro' : 'Vaso con la disolución, pH-metro y gradilla con indicadores'}</title>
            <desc id="acs-d">{desc}</desc>
            <BenchTop y={benchY} width={W} />
            {scene}
          </svg>
        </div>

        {station === 'acidos' && (
          <>
            <Readout items={[
              { k: 'Ácido formado', v: formCompound.formulaPretty },
              { k: 'Concentración', v: `${fmt(formConc, 3)} mol/L` },
              { k: 'pH medido', v: formPH !== null ? fmt(formPH, 2) : 'mide', data: true },
              { k: 'Tipo', v: form.kind === 'hidrácido' ? 'hidrácido (sin oxígeno)' : 'oxácido (con oxígeno)' },
            ]} />
            {indicatorReadout(formPH)}
            <section className="card stack" aria-labelledby="acs-n1-h">
              <h3 id="acs-n1-h">Nomenclatura del ácido</h3>
              <NamesCard compound={formCompound} title={form.kind === 'hidrácido' ? 'Hidrácido' : 'Oxácido'} idPrefix="acs-f" />
              <Molecule3D species={moleculeSpecies(form.molecule)} idPrefix="acs-mol" height={240} />
            </section>
          </>
        )}

        {station === 'neutralizacion' && (
          <>
            <Readout items={[
              { k: 'NaOH añadido', v: `${fmt(vb, 2)} mL` },
              { k: 'pH medido', v: titCurrent ? fmt(titCurrent.pH, 2) : 'mide', data: true },
              { k: 'Estado', v: titCurrent ? titState(vb) : '—' },
              { k: 'Sal que se forma', v: `${neut.salt.formula} · ${neut.salt.names.stock ?? neut.salt.names.sistematica}` },
            ]} />
            <Chart title="Curva de titulación medida" xLabel="NaOH añadido (mL)" yLabel="pH" xUnit="mL" height={250} xDomain={[0, vmax]} yDomain={[0, 14]} exportName="titulacion"
              series={[{ label: 'pH medido', points, kind: 'both', color: 'var(--series-1)' }, ...(showModel ? [{ label: 'Curva del modelo (balance de cargas)', points: curve, kind: 'line' as const, color: 'var(--series-4)', dashed: true }] : [])]}
              emptyText="Añade NaOH y mide el pH para dibujar la curva." />
            <label className="check small"><input type="checkbox" checked={showModel} onChange={(e) => setShowModel(e.target.checked)} /> Mostrar la curva del modelo y los puntos de equivalencia</label>
            {showModel && <Notice>Equivalencia{veqs.length > 1 ? 's' : ''}: {veqs.map((v, i) => `${i + 1}.ª a ${fmt(v, 2)} mL`).join('; ')} (V = k·C_A·V_A/C_B). {acid.note}</Notice>}
            <section className="card stack" aria-labelledby="acs-n2-h">
              <h3 id="acs-n2-h">Sal formada: {neut.salt.formula}</h3>
              {neut.salt.compound ? <NamesCard compound={neut.salt.compound} idPrefix="acs-s" /> : <p className="small">Acetato de sodio (sal orgánica): nombre IUPAC etanoato de sodio; tradicional acetato sódico. Se estudia en química orgánica.</p>}
            </section>
          </>
        )}

        {station === 'sales' && (
          <>
            <Readout items={[
              { k: 'Sal', v: `${salt.label}` },
              { k: 'pH medido', v: saltRes ? fmt(saltRes.pHReading, 2) : 'mide', data: true },
              { k: 'Disolución', v: saltRes ? saltRes.character : '—' },
              { k: 'Tipo de sal (nomenclatura)', v: saltRes ? saltRes.saltClass : '—' },
            ]} />
            {indicatorReadout(saltRes?.pHReading ?? null)}
            {saltRes && <Notice kind={saltRes.character === 'neutra' ? 'info' : 'ok'}>{saltRes.explanation}</Notice>}
            <section className="card stack" aria-labelledby="acs-n3-h">
              <h3 id="acs-n3-h">Nomenclatura de la sal</h3>
              {saltCompound ? <NamesCard compound={saltCompound} title="Sal" idPrefix="acs-n" /> : <p className="small">Acetato de sodio: sal orgánica (etanoato de sodio).</p>}
              <Select label="Red cristalina" value={crystalId} options={[{ value: 'nacl', label: 'NaCl · halita (sal de cocina)' }, { value: 'kcl', label: 'KCl · silvita' }, { value: 'caf2', label: 'CaF₂ · fluorita' }, { value: 'cscl', label: 'CsCl · cloruro de cesio' }]} onChange={setCrystalId} />
              <Crystal3D crystal={getCrystal(crystalId)} idPrefix="acs" height={290} />
            </section>
          </>
        )}

        <section className="card stack" aria-labelledby="acs-3d-h">
          <h3 id="acs-3d-h">Reacción en 3D</h3>
          <Reaction3D def={reaction} idPrefix="acs" height={290} />
        </section>

        <IdeasPanel ideas={IDEAS} idPrefix="acs" intro="Ideas frecuentes sobre ácidos, bases y sales. Decide y compruébalo en las tres estaciones." />
      </div>

      <div className="controls">
        {station === 'acidos' && (
          <div className="card stack">
            <h3>Formar un ácido</h3>
            <Select label="Reacción de formación" value={formId} options={FORMATIONS.map((f) => ({ value: f.id, label: f.label }))} onChange={(v) => { setFormId(v); setFormPH(null); }} />
            <Slider label="Concentración del ácido" value={formConc} min={0.001} max={0.5} step={0.001} unit="mol/L" decimals={3} onChange={(v) => { setFormConc(v); setFormPH(null); }} />
            <button type="button" className="btn primary" onClick={measureForm}>Disolver y medir el pH</button>
            <RecordButton onRecord={recordForm} disabled={formPH === null} />
          </div>
        )}
        {station === 'neutralizacion' && (
          <div className="card stack">
            <h3>Titulación con NaOH</h3>
            <Select label="Ácido del erlenmeyer" value={acidId} options={TITRATION_ACIDS.map((a) => ({ value: a.id, label: `${a.name} · ${a.formula.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])}` }))} onChange={(v) => { setAcidId(v); setVb(0); resetTit(); }} />
            <Slider label="Concentración del ácido" value={ca} min={TITRATION_LIMITS.acidConc[0]} max={TITRATION_LIMITS.acidConc[1]} step={0.005} unit="mol/L" decimals={3} onChange={(v) => { setCa(v); resetTit(); }} />
            <Slider label="Volumen del ácido" value={va} min={TITRATION_LIMITS.acidVolume[0]} max={TITRATION_LIMITS.acidVolume[1]} step={1} unit="mL" decimals={2} onChange={(v) => { setVa(v); resetTit(); }} />
            <Slider label="Concentración del NaOH" value={cb} min={TITRATION_LIMITS.baseConc[0]} max={TITRATION_LIMITS.baseConc[1]} step={0.005} unit="mol/L" decimals={3} onChange={(v) => { setCb(v); resetTit(); }} />
            <Slider label="Volumen de NaOH añadido" value={vb} min={0} max={TITRATION_LIMITS.baseVolume[1]} step={0.1} unit="mL" decimals={2} onChange={(v) => setVb(Math.round(v * 100) / 100)} />
            <div className="btn-row">
              <button type="button" className="btn small" onClick={() => setVb((v) => Math.min(100, Math.round((v + 1) * 100) / 100))}>Añadir 1,00 mL</button>
              <button type="button" className="btn small" onClick={() => setVb((v) => Math.min(100, Math.round((v + 0.1) * 100) / 100))}>Añadir 0,10 mL</button>
            </div>
            <button type="button" className="btn primary" onClick={measureTit}>Medir el pH</button>
            <RecordButton onRecord={recordTit} disabled={!titCurrent} />
          </div>
        )}
        {station === 'sales' && (
          <div className="card stack">
            <h3>Disolver una sal</h3>
            <Select label="Sal" value={saltId} options={SALTS.map((s) => ({ value: s.id, label: `${s.label} · ${s.formula.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])}` }))} onChange={(v) => { setSaltId(v); setSaltRes(null); }} />
            <Slider label="Concentración de la sal" value={saltConc} min={SALT_LIMITS.conc[0]} max={SALT_LIMITS.conc[1]} step={0.001} unit="mol/L" decimals={3} onChange={(v) => { setSaltConc(v); setSaltRes(null); }} />
            <button type="button" className="btn primary" onClick={measureSalt}>Disolver y medir el pH</button>
            <RecordButton onRecord={recordSalt} disabled={!saltRes} />
          </div>
        )}
        <div className="card stack">
          <h3>Procedencia</h3>
          <div className="btn-row" role="note" aria-label="Procedencia de los resultados">
            <StatusChip status="modelo" prefix="pH y volúmenes" />
            <StatusChip status="ilustracion" prefix="Colores" />
          </div>
          <p className="small" style={{ margin: 0 }}>pH por balance de cargas a 25 °C (HCl y acético con el modelo de la práctica de pH; los demás con pKa de Harris, 2010). Lecturas redondeadas a 0,01. Sin CO₂ del aire.</p>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { FunctionalViewer3D } from '../components/funcional/FunctionalViewer3D';
import { groupHighlights, hBondHighlights, groupsOf } from '../components/funcional/highlights';
import { BarCompare, Exp, IdeasPanel, NomenclaturePanel, solText, Sources, Status, TubeBench, type NamePreset } from '../components/funcional/FunctionalParts';
import { funcSpecies, getFunc, prettyFormula, type FRecord } from '../data/quimica/funcionales';
import { DEGREE_LABEL, GROUP_FORMULA, GROUP_LABEL, type GroupKind } from '../models/functionalGroups';
import {
  ACIDS_O, carbonsOf, FAMILY_O_LABEL, hBondsOf, ionizedFraction, ISOMERS_C4H10O, labTest, LAB_TEST_FOR, LAB_TEST_LABEL, LAB_TEST_STATUS, pKaAsAcid,
  SERIES_O, SIMILAR_MASS_O, solubilityClass, TEST_BANK, weakAcidPH, type FamilyO, type LabTest,
} from '../models/functionalProperties';
import { nameFunctionalSmiles } from '../models/functionalNomenclature';
import { fmt } from '../lib/format';
import { playSound } from '../lib/sound';
import type { LabProps } from './registry';
import { parseSmiles as parseSmi } from '../models/organicGraph';

const carbonCount = (smi: string) => { try { return parseSmi(smi).atoms.filter((a) => a.el === 'C').length; } catch { return null; } };

type Station = 'identificar' | 'nombrar' | 'propiedades' | 'acidez' | 'pruebas';
const STATIONS: { value: Station; label: string }[] = [
  { value: 'identificar', label: '1 · Identificar' },
  { value: 'nombrar', label: '2 · Nombrar' },
  { value: 'propiedades', label: '3 · Propiedades' },
  { value: 'acidez', label: '4 · Acidez' },
  { value: 'pruebas', label: '5 · Pruebas de laboratorio' },
];

const nameEs = (r: FRecord) => { const n = nameFunctionalSmiles(r.smiles); return n.ok ? n.es : r.nombre; };
const FAM_ES: Partial<Record<GroupKind, string>> = { alcohol: 'Alcohol', fenol: 'Fenol', eter: 'Éter', aldehido: 'Aldehído', cetona: 'Cetona', acido: 'Ácido carboxílico', ester: 'Éster' };

/** Compuestos de la estación 1 (uno o más por función). */
const IDENT_IDS = ['metanol', 'etanol', 'propan-2-ol', '2-metilpropan-2-ol', 'ciclohexanol', 'etano-1,2-diol', 'glicerol', 'fenol', '4-metilfenol', 'metoximetano', 'etoxietano', 'metoxibenceno',
  'metanal', 'etanal', 'benzaldehido', 'propanona', 'butanona', 'acetofenona', 'acido-etanoico', 'acido-benzoico', 'acido-lactico', 'acetato-de-etilo', 'acetato-de-isoamilo', 'salicilato-de-metilo', 'aspirina'];

/* ------------------------------------------------------------------ 1 · identificar */

const QUIZ = ['propan-2-ol', 'etoxietano', 'butanona', 'acido-etanoico', 'fenol', 'pentanal', 'acetato-de-metilo', '2-metilpropan-2-ol', 'benzoato-de-metilo', 'acido-salicilico'];
const QUIZ_OPTIONS: GroupKind[] = ['alcohol', 'fenol', 'eter', 'aldehido', 'cetona', 'acido', 'ester'];

function IdentifyStation() {
  const [id, setId] = useState('etanol');
  const [mode, setMode] = useState<'grupo' | 'puentes'>('grupo');
  const rec = getFunc(id);
  const species = useMemo(() => funcSpecies(id, nameEs(rec)), [id, rec]);
  const hl = useMemo(() => (mode === 'grupo' ? groupHighlights(species) : hBondHighlights(species)), [species, mode]);
  const groups = useMemo(() => groupsOf(species).map((x) => x.g).filter((g) => g.kind !== 'halogeno'), [species]);
  const hb = hBondsOf(rec);
  const alc = groups.find((g) => g.kind === 'alcohol');
  // reto
  const [q, setQ] = useState(0);
  const [ans, setAns] = useState<GroupKind | null>(null);
  const qRec = getFunc(QUIZ[q % QUIZ.length]);
  const qMain = useMemo(() => groupsOf(funcSpecies(qRec.id)).map((x) => x.g.kind).find((k) => QUIZ_OPTIONS.includes(k)), [qRec.id]);
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3 style={{ marginBottom: 0 }}>{nameEs(rec)} <span className="muted small">({prettyFormula(rec.formula)})</span></h3>
          <FunctionalViewer3D species={species} idPrefix="gox-id" highlights={hl} height={330} styleLabel="Estilo del modelo 3D" />
        </div>
        <div className="card stack">
          <h3>¿Qué grupo es? (reto)</h3>
          <p className="small muted" style={{ margin: 0 }}>Mira la fórmula y elige la función. El compuesto cambia al pasar al siguiente.</p>
          <p style={{ margin: 0, fontFamily: 'var(--font-data)', fontSize: '1.1rem' }} aria-live="polite">{qRec.nombre.replace(/\s*\(.*\)$/, '')}: <strong>{prettyFormula(qRec.formula)}</strong> · SMILES <code>{qRec.smiles}</code></p>
          <div className="btn-row" role="group" aria-label="Función orgánica del compuesto del reto">
            {QUIZ_OPTIONS.map((k) => <button key={k} type="button" className="btn small" aria-pressed={ans === k} onClick={() => { setAns(k); playSound(k === qMain ? 'confirm' : 'error'); }}>{FAM_ES[k]}</button>)}
          </div>
          <div aria-live="polite">
            {ans && <div className={`notice ${ans === qMain ? 'ok' : 'warn'}`}><strong>{ans === qMain ? 'Correcto.' : 'Revisa.'}</strong> {qRec.nombre}: {GROUP_LABEL[qMain!]} — {GROUP_FORMULA[qMain!]}.</div>}
          </div>
          <div className="btn-row"><button type="button" className="btn small ghost" onClick={() => { setQ((n) => n + 1); setAns(null); }}>Siguiente compuesto</button></div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Compuesto" value={id} onChange={setId} options={IDENT_IDS.map((x) => ({ value: x, label: getFunc(x).nombre }))} />
          <Segmented label="Resaltar" value={mode} onChange={setMode} options={[{ value: 'grupo', label: 'Grupo funcional' }, { value: 'puentes', label: 'Puentes de hidrógeno' }]} />
          <Readout items={[
            { k: 'Función (grupo funcional)', v: groups.map((g) => FAM_ES[g.kind] ?? GROUP_LABEL[g.kind]).join(', ') || '—' },
            { k: 'Clasificación del alcohol', v: alc ? DEGREE_LABEL[alc.degree!] : 'no es un alcohol' },
            { k: 'Donadores de puentes de H', v: String(hb.donors), data: true },
            { k: 'Aceptores de puentes de H', v: String(hb.acceptors), data: true },
            { k: 'Masa molar (PubChem)', v: `${fmt(rec.masaMolar, 2)} g/mol`, data: true },
          ]} />
          {alc && (
            <p className="small" style={{ margin: 0 }}>
              <strong>¿Por qué es {alc.degree}?</strong> {alc.degree === 'metanol' ? 'El carbono que lleva el –OH no está unido a otros carbonos (caso especial: metanol).' : `El carbono que lleva el –OH está unido a ${alc.degree === 'primario' ? 'un' : alc.degree === 'secundario' ? 'dos' : 'tres'} átomo(s) de carbono.`}
            </p>
          )}
          <p className="small muted" style={{ margin: 0 }}>{mode === 'puentes' ? 'Un donador es un H unido a O o N (muy polarizado, δ+); un aceptor es un O o N con pares libres (δ−). Los éteres, aldehídos, cetonas y ésteres solo aceptan: entre sus moléculas no hay puentes de hidrógeno.' : 'El color marca los átomos del grupo funcional, que define la familia y las reacciones del compuesto.'}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2 · nombrar */

const NAME_PRESETS: NamePreset[] = [
  ...['etanol', 'propan-2-ol', '2-metilpropan-2-ol', 'etano-1,2-diol', 'glicerol', 'ciclohexanol', 'fenol', '4-metilfenol', 'etoxietano', 'metoxibenceno', 'metanal', 'butanal', 'benzaldehido',
    'propanona', 'pentan-3-ona', 'acetofenona', 'acido-etanoico', 'acido-butanoico', 'acido-cloroacetico', 'acido-lactico', 'acido-salicilico', 'acetato-de-etilo', 'acetato-de-isoamilo', 'salicilato-de-metilo', 'aspirina']
    .map((id) => ({ value: id, label: getFunc(id).nombre, smiles: getFunc(id).smiles, recId: id })),
  { value: 'x-4-metilpentan-2-ol', label: 'Reto: CC(C)CC(C)O', smiles: 'CC(C)CC(C)O' },
  { value: 'x-cetoacido', label: 'Reto: CC(=O)CC(O)=O (dos grupos)', smiles: 'CC(=O)CC(O)=O' },
  { value: 'x-hidroxicetona', label: 'Reto: CC(=O)CO', smiles: 'CC(=O)CO' },
  { value: 'x-butenal', label: 'Reto: CC=CC=O (con doble enlace)', smiles: 'CC=CC=O' },
];

/* ------------------------------------------------------------------ 3 · propiedades */

const FAM_COLORS: Record<FamilyO, string> = { alcano: 'var(--series-8)', alcohol: 'var(--series-1)', eter: 'var(--series-6)', aldehido: 'var(--series-5)', cetona: 'var(--series-4)', acido: 'var(--series-2)', ester: 'var(--series-3)' };
const familyOf = (r: FRecord): FamilyO | null => (Object.keys(SERIES_O) as FamilyO[]).find((f) => SERIES_O[f].includes(r.id)) ?? null;

function PropertiesStation({ api }: LabProps) {
  const [fams, setFams] = useState<FamilyO[]>(['alcano', 'alcohol', 'aldehido', 'acido']);
  const [view, setView] = useState<'masa' | 'isomeros' | 'solubilidad'>('masa');
  const [pick, setPick] = useState('propan-1-ol');
  const series = (Object.keys(SERIES_O) as FamilyO[]).filter((f) => fams.includes(f)).map((f) => ({
    label: FAMILY_O_LABEL[f], color: FAM_COLORS[f], kind: 'both' as const,
    points: SERIES_O[f].map(getFunc).filter((r) => r.propiedades.tEb).map((r) => ({ x: carbonsOf(r.formula), y: r.propiedades.tEb!.valor, label: r.nombre })),
  }));
  const barIds = view === 'isomeros' ? ISOMERS_C4H10O : SIMILAR_MASS_O;
  const bars = barIds.map(getFunc).map((r) => {
    const hb = hBondsOf(r);
    const fam = familyOf(r);
    return { label: nameEs(r), value: r.propiedades.tEb?.valor ?? null, note: `${fmt(r.masaMolar, 1)} g/mol · ${hb.donors} donador${hb.donors === 1 ? '' : 'es'}`, color: hb.donors ? 'var(--series-1)' : fam === 'alcano' ? 'var(--series-8)' : 'var(--series-5)' };
  }).sort((a, b) => (a.value ?? -999) - (b.value ?? -999));
  const solRows = ['alcano', 'alcohol', 'aldehido', 'acido'].flatMap((f) => SERIES_O[f as FamilyO].map(getFunc).map((r) => ({ r, f: f as FamilyO })));
  const solSeries = (['alcano', 'alcohol', 'acido'] as FamilyO[]).map((f) => ({
    label: FAMILY_O_LABEL[f], color: FAM_COLORS[f], kind: 'both' as const,
    points: SERIES_O[f].map(getFunc).filter((r) => r.propiedades.solubilidad?.tipo === 'valor').map((r) => ({ x: carbonsOf(r.formula), y: Math.log10(r.propiedades.solubilidad!.valor!), label: r.nombre })),
  }));
  const rec = getFunc(pick);
  const hb = hBondsOf(rec);
  const record = () => api.addTrial('propiedades', {
    compuesto: nameEs(rec), familia: familyOf(rec) ? FAMILY_O_LABEL[familyOf(rec)!] : rec.grupo, carbonos: carbonsOf(rec.formula), masaMolar: Number(rec.masaMolar.toFixed(2)),
    donadores: hb.donors, aceptores: hb.acceptors, tEb: rec.propiedades.tEb?.valor ?? null,
    solubilidad: rec.propiedades.solubilidad?.tipo === 'valor' ? rec.propiedades.solubilidad.valor! : null, fuente: `PubChem CID ${rec.cid} (PUG View, ${rec.fuente.fecha})`,
  });
  const pickIds = [...new Set([...Object.values(SERIES_O).flat(), ...SIMILAR_MASS_O, ...ISOMERS_C4H10O])];
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Temperatura de ebullición de las series homólogas</h3>
          <Status status="experimental" prefix="Datos">temperaturas de ebullición publicadas (PubChem PUG View; sobre todo HSDB, que cita el CRC Handbook); cada punto tiene su fuente en «Fuentes del compuesto».</Status>
          <Chart series={series} xLabel="Número de carbonos" yLabel="Temperatura de ebullición" yUnit="°C" title="Tₑb frente al número de carbonos" exportName="oxigenados-teb" height={300} />
          <p className="small muted" style={{ margin: 0 }}>A igual número de carbonos: ácidos &gt; alcoholes &gt; aldehídos &gt; alcanos. Cada CH₂ añade fuerzas de dispersión; el –OH añade puentes de hidrógeno y el C=O dipolos.</p>
        </div>
        <div className="card stack">
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{view === 'masa' ? 'Compuestos de masa molar parecida (≈ 58–60 g/mol)' : view === 'isomeros' ? 'Isómeros C₄H₁₀O: misma masa, distinta función' : 'Solubilidad en agua'}</h3>
          </div>
          <Segmented label="Comparación" value={view} onChange={setView} options={[{ value: 'masa', label: 'Masa parecida' }, { value: 'isomeros', label: 'Isómeros C₄H₁₀O' }, { value: 'solubilidad', label: 'Solubilidad' }]} />
          {view !== 'solubilidad' ? (
            <>
              <BarCompare idPrefix="gox-bar" legend={[{ color: 'var(--series-8)', label: 'Alcano: solo dispersión' }, { color: 'var(--series-5)', label: 'Sin H unido a O: dipolo-dipolo' }, { color: 'var(--series-1)', label: 'Con –OH: puentes de hidrógeno' }]} items={bars} unit="°C" title={view === 'masa' ? 'Tₑb de compuestos de masa parecida' : 'Tₑb de los isómeros C4H10O'} />
              <p className="small muted" style={{ margin: 0 }}>La masa es casi igual, así que la diferencia la explican las fuerzas intermoleculares: dispersión (alcano) &lt; dipolo-dipolo (éter, aldehído, cetona, éster) &lt; puentes de hidrógeno (alcohol) &lt; dos puentes por molécula, que forman dímeros (ácido).</p>
            </>
          ) : (
            <>
              <Chart series={solSeries} xLabel="Número de carbonos" yLabel="log₁₀ de la solubilidad (g/L)" title="Solubilidad en agua frente al número de carbonos" exportName="oxigenados-solubilidad" height={260} />
              <p className="small muted" style={{ margin: 0 }}>Se grafica log₁₀(g/L) porque los valores van de 0,0007 a más de 100 g/L. Los compuestos miscibles (metanol, etanol, ácido acético…) no tienen un número que graficar: aparecen en la tabla.</p>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Solubilidad en agua (datos de PubChem)">
                <table className="small">
                  <caption className="sr-only">Solubilidad en agua de alcanos, alcoholes, aldehídos y ácidos</caption>
                  <thead><tr><th>Compuesto</th><th className="n">C</th><th>Solubilidad</th><th>Clase</th></tr></thead>
                  <tbody>{solRows.map(({ r }) => <tr key={r.id}><td>{nameEs(r)}</td><td className="n">{carbonsOf(r.formula)}</td><td>{solText(r.propiedades.solubilidad)}</td><td>{solubilityClass(r) ?? '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small" style={{ fontWeight: 600 }}>Series en la gráfica</legend>
            <div className="btn-row">
              {(Object.keys(SERIES_O) as FamilyO[]).map((f) => (
                <label key={f} className="check small"><input type="checkbox" checked={fams.includes(f)} onChange={(e) => setFams((s) => (e.target.checked ? [...s, f] : s.filter((x) => x !== f)))} /> {FAMILY_O_LABEL[f]}</label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="card stack">
          <h3>Registrar un compuesto</h3>
          <Select label="Compuesto para la tabla" value={pick} onChange={setPick} options={pickIds.map((x) => ({ value: x, label: getFunc(x).nombre }))} />
          <Readout items={[
            { k: 'Tₑb (experimental)', v: <Exp p={rec.propiedades.tEb} decimals={1} />, data: true },
            { k: 'Solubilidad en agua', v: solText(rec.propiedades.solubilidad), data: true },
            { k: 'Masa molar', v: `${fmt(rec.masaMolar, 2)} g/mol`, data: true },
            { k: 'Donadores / aceptores de puentes de H', v: `${hb.donors} / ${hb.acceptors}`, data: true },
          ]} />
          <RecordButton onRecord={record} label="Guardar el compuesto en la tabla" />
        </div>
        <details className="card">
          <summary>Fuentes del compuesto ({rec.nombre})</summary>
          <Sources rec={rec} keys={[{ k: 'tEb', label: 'Tₑb' }, { k: 'solubilidad', label: 'Solubilidad' }, { k: 'tFus', label: 'T de fusión' }]} />
        </details>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 4 · acidez */

function AcidityStation({ api }: LabProps) {
  const [pH, setPH] = useState(7);
  const [id, setId] = useState('acido-etanoico');
  const [conc, setConc] = useState(0.1);
  const acids = ACIDS_O.map(getFunc).map((r) => ({ r, pKa: pKaAsAcid(r)! })).filter((x) => x.pKa).sort((a, b) => a.pKa.value - b.pKa.value);
  const sel = acids.find((x) => x.r.id === id) ?? acids[0];
  const alpha = ionizedFraction(sel.pKa.value, pH);
  const sol = weakAcidPH(sel.pKa.value, conc);
  const curveIds = [...new Set(['acido-etanoico', 'fenol', 'etanol', id])];
  const curves = curveIds.map((cid, k) => {
    const x = acids.find((a) => a.r.id === cid)!;
    return { label: `${nameEs(x.r)} (pKa ${fmt(x.pKa.value, 2)})`, color: `var(--series-${k + 1})`, kind: 'line' as const, points: Array.from({ length: 141 }, (_, i) => ({ x: i / 10, y: 100 * ionizedFraction(x.pKa.value, i / 10) })) };
  });
  const record = () => api.addTrial('acidez', { compuesto: nameEs(sel.r), pKa: sel.pKa.value, pH, ionizada: Number((alpha * 100).toFixed(4)), concentracion: conc, pHDisolucion: Number(sol.pH.toFixed(3)) });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Escala de acidez (pKa a 25 °C, en agua)</h3>
          <Status status="experimental" prefix="pKa">valores publicados (PubChem; HSDB cita Serjeant y Dempsey, IUPAC 1979; Riddick et al.; CRC Handbook). Menor pKa = ácido más fuerte.</Status>
          <BarCompare idPrefix="gox-pka" legend={[{ color: 'var(--series-1)', label: 'Alcoholes' }, { color: 'var(--series-4)', label: 'Fenoles' }, { color: 'var(--series-2)', label: 'Ácidos carboxílicos' }]} items={acids.map(({ r, pKa }) => ({ label: nameEs(r), value: pKa.value, color: r.grupo === 'acido' ? 'var(--series-2)' : r.grupo === 'fenol' ? 'var(--series-4)' : 'var(--series-1)', title: `«${pKa.text}»` }))} unit="pKa" title="pKa de alcoholes, fenoles y ácidos carboxílicos" decimals={2} />
          <p className="small muted" style={{ margin: 0 }}>Cada unidad de pKa es un factor 10 en Ka. El ácido acético (4,76) es unos 10¹¹ veces más ácido que el etanol (15,9): el ion carboxilato reparte la carga entre dos O (resonancia). Los Cl del ácido cloroacético atraen electrones (efecto inductivo) y estabilizan aún más el anión.</p>
        </div>
        <div className="card stack">
          <h3>Fracción ionizada frente al pH</h3>
          <Status status="modelo" prefix="Curvas">Henderson-Hasselbalch con los pKa experimentales: α = 1/(1 + 10^(pKa − pH)); disolución diluida a 25 °C.</Status>
          <Chart series={curves} xLabel="pH" yLabel="Fracción ionizada (A⁻)" yUnit="%" title="Fracción ionizada de ácidos orgánicos" exportName="oxigenados-ionizacion" height={280} xDomain={[0, 14]} yDomain={[0, 100]} />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Ácido" value={sel.r.id} onChange={setId} options={acids.map(({ r }) => ({ value: r.id, label: nameEs(r) }))} />
          <Slider label="pH del medio" value={pH} min={0} max={14} step={0.1} decimals={1} onChange={setPH} />
          <Slider label="Concentración del ácido" value={conc} min={0.001} max={1} step={0.001} decimals={3} unit="mol/L" onChange={setConc} />
          <Readout items={[
            { k: 'pKa (experimental)', v: fmt(sel.pKa.value, 2), data: true },
            { k: `Ionizado a pH ${fmt(pH, 1)}`, v: `${fmtPct(alpha)} %`, data: true },
            { k: `pH de la disolución ${fmt(conc, 3)} M`, v: fmt(sol.pH, 2), data: true },
            { k: 'Ionizado en esa disolución', v: `${fmtPct(sol.ionized)} %`, data: true },
          ]} />
          <RecordButton onRecord={record} label="Guardar el cálculo en la tabla" />
          <p className="small muted" style={{ margin: 0 }}>Caso de referencia: ácido acético 0,100 M (pKa 4,76) → pH ≈ 2,88. Con Ka = 1,8 × 10⁻⁵ daría 2,87.</p>
        </div>
      </div>
    </div>
  );
}
const fmtPct = (f: number) => (f >= 0.001 ? fmt(f * 100, f > 0.9999 ? 4 : 2) : `${fmt(f * 100, 6)}`);

/* ------------------------------------------------------------------ 5 · pruebas */

const TESTS: LabTest[] = ['tollens', 'fehling', 'fecl3', 'lucas', 'bicarbonato'];
const SHORT: Record<LabTest, string> = { tollens: 'Tollens', fehling: 'Fehling', fecl3: 'FeCl₃ 1 %', lucas: 'Lucas', bicarbonato: 'NaHCO₃ 5 %' };

function TestsStation({ api }: LabProps) {
  const [id, setId] = useState('propanal');
  const [test, setTest] = useState<LabTest>('tollens');
  const [added, setAdded] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const rec = getFunc(id);
  const out = labTest(rec, test);
  const add = () => { setAdded(true); setDone((d) => ({ ...d, [`${id}|${test}`]: true })); playSound(out.positive ? 'confirm' : 'click'); };
  const record = () => api.addTrial('pruebas', { compuesto: nameEs(rec), prueba: LAB_TEST_LABEL[test], positiva: out.positive ? 1 : 0, observacion: out.observation, grupo: groupsOf(funcSpecies(id)).map((x) => FAM_ES[x.g.kind] ?? x.g.kind).join(', ') });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Banco de pruebas: {LAB_TEST_LABEL[test]}</h3>
          <Status status="ilustracion" prefix="Resultado">{LAB_TEST_STATUS}.</Status>
          <div className="bench"><TubeBench idPrefix="gox-tubo" tube={{ label: nameEs(rec), reagent: LAB_TEST_LABEL[test], short: SHORT[test], outcome: added ? out : null }} adding={added} /></div>
          <div aria-live="polite" className="stack-sm">
            <p style={{ margin: 0 }}><strong>{added ? (out.positive ? 'Prueba positiva.' : 'Prueba negativa.') : 'Agrega el reactivo para ver el resultado esperado.'}</strong>{added && ` ${out.observation}`}{added && out.time ? ` (${out.time}).` : ''}</p>
            {added && <p className="small muted" style={{ margin: 0 }}>{out.explanation}</p>}
          </div>
        </div>
        <div className="card stack">
          <h3>Tabla de resultados</h3>
          <p className="small muted" style={{ margin: 0 }}>Se llena a medida que haces cada prueba (+ positiva, − negativa). Busca el patrón: cada prueba reconoce un grupo funcional.</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Resultados de las pruebas">
            <table className="small">
              <caption className="sr-only">Resultados esperados de las pruebas que ya hiciste</caption>
              <thead><tr><th>Compuesto</th>{TESTS.map((t) => <th key={t} className="n">{t === 'fecl3' ? 'FeCl₃' : t === 'bicarbonato' ? 'NaHCO₃' : t[0].toUpperCase() + t.slice(1)}</th>)}</tr></thead>
              <tbody>{TEST_BANK.map((cid) => (
                <tr key={cid}><td>{nameEs(getFunc(cid))}</td>{TESTS.map((t) => { const d = done[`${cid}|${t}`]; const p = d ? labTest(getFunc(cid), t).positive : null; return <td key={t} className="n" aria-label={d ? (p ? 'positiva' : 'negativa') : 'sin hacer'} style={{ fontWeight: 700, color: p ? 'var(--ok)' : 'var(--ink-2)' }}>{d ? (p ? '+' : '−') : '·'}</td>; })}</tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Sustancia del tubo" value={id} onChange={(v) => { setId(v); setAdded(false); }} options={TEST_BANK.map((x) => ({ value: x, label: nameEs(getFunc(x)) }))} />
          <Select label="Prueba" value={test} onChange={(v) => { setTest(v as LabTest); setAdded(false); }} options={TESTS.map((t) => ({ value: t, label: `${LAB_TEST_LABEL[t]} — para ${LAB_TEST_FOR[t]}` }))} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={add} disabled={added}>Agregar el reactivo</button>
            <button type="button" className="btn ghost small" onClick={() => setAdded(false)} disabled={!added}>Tubo nuevo</button>
          </div>
          <RecordButton onRecord={record} disabled={!added} label="Guardar la prueba en la tabla" />
          <p className="small muted" style={{ margin: 0 }}>Seguridad: en el laboratorio real estos reactivos se manejan con gafas, guantes y supervisión; el reactivo de Tollens se prepara en el momento y no se guarda.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ laboratorio */

const IDEAS = [
  { id: 'i1', text: 'El etanol hierve a mayor temperatura que el butano porque pesa más.', answer: 'falso' as const, feedback: 'El butano (58,1 g/mol) pesa más que el etanol (46,1 g/mol) y aun así hierve a −0,5 °C frente a 78,2 °C: la diferencia la hacen los puentes de hidrógeno del –OH, no la masa.' },
  { id: 'i2', text: 'Todos los compuestos con –OH son igual de ácidos.', answer: 'falso' as const, feedback: 'El fenol (pKa 9,99) es unos 10⁶ veces más ácido que el etanol (pKa 15,9) y el ácido acético (4,76) mucho más: el anión se estabiliza por resonancia en el anillo o entre los dos O del carboxilato.' },
  { id: 'i3', text: 'Un éter forma puentes de hidrógeno entre sus moléculas.', answer: 'falso' as const, feedback: 'El éter no tiene H unido a O: solo puede aceptar puentes (por ejemplo del agua). Por eso el etoxietano hierve a 34,6 °C y su isómero butan-1-ol a 117,6 °C.' },
  { id: 'i4', text: 'Los alcoholes de cadena larga se disuelven en agua tanto como el metanol.', answer: 'falso' as const, feedback: 'El metanol es miscible, pero el octan-1-ol solo se disuelve 0,54 g/L: la cadena de carbonos no polar crece y el –OH ya no compensa.' },
  { id: 'i5', text: 'La prueba de Tollens distingue un aldehído de una cetona.', answer: 'cierto' as const, feedback: 'El aldehído tiene un H en el carbonilo y se oxida con el Ag⁺ (espejo de plata); la cetona no se oxida con este reactivo suave.' },
];

export default function OxygenatedGroupsLab(props: LabProps) {
  const [station, setStation] = useState<Station>('identificar');
  return (
    <div className="stack">
      <Notice>
        <strong>Propósito:</strong> aprendes a reconocer alcoholes, fenoles, éteres, aldehídos, cetonas, ácidos y ésteres por su grupo funcional, a nombrarlos con las reglas IUPAC 2013 y a explicar sus propiedades al girar sus modelos 3D, comparar datos reales de ebullición, solubilidad y pKa, y hacer las pruebas químicas que los distinguen.
      </Notice>
      <Segmented label="Estación" value={station} onChange={setStation} options={STATIONS} />
      {station === 'identificar' && <IdentifyStation />}
      {station === 'nombrar' && <NomenclaturePanel presets={NAME_PRESETS} idPrefix="gox-nom" onName={(r) => props.api.addTrial('nombres', { smiles: r.smiles, nombre: r.es, ingles: r.en, grupo: r.clase, carbonos: carbonCount(r.smiles) })} />}
      {station === 'propiedades' && <PropertiesStation {...props} />}
      {station === 'acidez' && <AcidityStation {...props} />}
      {station === 'pruebas' && <TestsStation {...props} />}
      <IdeasPanel idPrefix="gox" ideas={IDEAS} intro="Ideas frecuentes sobre las funciones oxigenadas. Decide y lee la retroalimentación; compruébalo con los datos de las estaciones 3 y 4." />
    </div>
  );
}

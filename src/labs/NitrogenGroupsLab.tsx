import { useMemo, useState } from 'react';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { Reaction3D } from '../chem';
import { FunctionalViewer3D, type Highlight } from '../components/funcional/FunctionalViewer3D';
import { groupHighlights, groupsOf, speciesGraph } from '../components/funcional/highlights';
import { BarCompare, Exp, IdeasPanel, NomenclaturePanel, solText, Sources, Status, type NamePreset } from '../components/funcional/FunctionalParts';
import { reaction3dDef } from '../components/funcional/reaction3dDefs';
import { funcSpecies, getFunc, prettyFormula, type FRecord } from '../data/quimica/funcionales';
import { degreeText } from '../models/functionalGroups';
import {
  amideGeometry, amineGeometry, aminoAcidSpecies, BASES_N, hBondsOf, ISOMERS_C3H9N, PEPTIDE_REF, pKaH, protonatedFraction, SIMILAR_MASS_N, weakBasePH,
} from '../models/functionalProperties';
import { nameFunctionalSmiles } from '../models/functionalNomenclature';
import { neighbors } from '../models/organicGraph';
import { reactionById } from '../models/organicReactions';
import { fmt } from '../lib/format';
import type { LabProps } from './registry';
import { parseSmiles as parseSmi } from '../models/organicGraph';

const carbonCount = (smi: string) => { try { return parseSmi(smi).atoms.filter((a) => a.el === 'C').length; } catch { return null; } };

type Station = 'clasificar' | 'nombrar' | 'basicidad' | 'amida' | 'propiedades' | 'biomoleculas';
const STATIONS: { value: Station; label: string }[] = [
  { value: 'clasificar', label: '1 · Clasificar' },
  { value: 'nombrar', label: '2 · Nombrar' },
  { value: 'basicidad', label: '3 · Basicidad' },
  { value: 'amida', label: '4 · Amida plana' },
  { value: 'propiedades', label: '5 · Propiedades' },
  { value: 'biomoleculas', label: '6 · Biomoléculas' },
];

const nameEs = (r: FRecord) => { const n = nameFunctionalSmiles(r.smiles); return n.ok ? n.es : r.nombre; };
const CLASS_IDS = ['amoniaco', 'metanamina', 'etanamina', 'propan-1-amina', 'dimetilamina', 'n-metiletanamina', 'trimetilamina', 'dietilamina', 'trietilamina', 'anilina', 'ciclohexanamina', 'fenilmetanamina',
  'formamida', 'acetamida', 'n-metilacetamida', 'dmf', 'benzamida', 'urea', 'paracetamol', 'glicina', 'alanina', 'glicilglicina'];

/** Átomos de N y C unidos al N (para ver la clasificación 1.º/2.º/3.º sobre el modelo 3D). */
function nitrogenHighlights(id: string): Highlight[] {
  const sp = funcSpecies(id);
  const m = speciesGraph(sp);
  const ns = m.atoms.map((a, i) => (a.el === 'N' ? i : -1)).filter((i) => i >= 0);
  if (!ns.length) return [];
  const nAndH = ns.flatMap((n) => [n, ...neighbors(m, n).filter((v) => m.atoms[v].el === 'H')]);
  const cOnN = ns.flatMap((n) => neighbors(m, n).filter((v) => m.atoms[v].el === 'C'));
  const out: Highlight[] = [{ atoms: nAndH, color: 'var(--fis)', label: 'N y sus H' }];
  if (cOnN.length) out.push({ atoms: cOnN, color: 'var(--series-5)', label: `Carbonos unidos al N (${cOnN.length})` });
  return out;
}

/* ------------------------------------------------------------------ 1 · clasificar */

function ClassifyStation() {
  const [id, setId] = useState('dimetilamina');
  const [mode, setMode] = useState<'n' | 'grupo'>('n');
  const rec = getFunc(id);
  const sp = useMemo(() => funcSpecies(id, nameEs(rec)), [id, rec]);
  const hl = useMemo(() => (mode === 'n' ? nitrogenHighlights(id) : groupHighlights(sp)), [id, mode, sp]);
  const groups = useMemo(() => groupsOf(sp).map((x) => x.g), [sp]);
  const amine = groups.find((g) => g.kind === 'amina');
  const amide = groups.find((g) => g.kind === 'amida');
  const m = useMemo(() => speciesGraph(sp), [sp]);
  const nAtom = m.atoms.findIndex((a) => a.el === 'N');
  const hOnN = nAtom >= 0 ? neighbors(m, nAtom).filter((v) => m.atoms[v].el === 'H').length : 0;
  const hb = hBondsOf(rec);
  const iso = ISOMERS_C3H9N.map(getFunc).map((r) => ({ label: `${nameEs(r)} (${degreeText('amina', groupsOf(funcSpecies(r.id)).find((x) => x.g.kind === 'amina')!.g.degree!).split(' ')[0]})`, value: r.propiedades.tEb?.valor ?? null, color: 'var(--series-1)', note: `${hBondsOf(r).donors} H en N` }));
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3 style={{ marginBottom: 0 }}>{nameEs(rec)} <span className="muted small">({prettyFormula(rec.formula)})</span></h3>
          <FunctionalViewer3D species={sp} idPrefix="gnt-cl" highlights={hl} height={330} />
        </div>
        <div className="card stack">
          <h3>Isómeros C₃H₉N: amina primaria, secundaria y terciaria</h3>
          <Status status="experimental" prefix="Tₑb">PubChem (HSDB y otras bases citadas).</Status>
          <BarCompare idPrefix="gnt-iso" items={iso} unit="°C" title="Temperatura de ebullición de los isómeros C3H9N" />
          <p className="small muted" style={{ margin: 0 }}>Misma fórmula y masa (59,1 g/mol). Cuantos más H unidos al N, más puentes de hidrógeno: la amina primaria hierve más alto y la terciaria, sin H en el N, casi como un alcano.</p>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Compuesto nitrogenado" value={id} onChange={setId} options={CLASS_IDS.map((x) => ({ value: x, label: getFunc(x).nombre }))} />
          <Segmented label="Resaltar" value={mode} onChange={setMode} options={[{ value: 'n', label: 'N y sus carbonos' }, { value: 'grupo', label: 'Grupos funcionales' }]} />
          <Readout items={[
            { k: 'Función', v: groups.filter((g) => g.kind !== 'halogeno').map((g) => g.kind === 'amina' ? 'amina' : g.kind === 'amida' ? 'amida' : g.kind === 'acido' ? 'ácido carboxílico' : g.kind === 'fenol' ? 'fenol' : g.kind).join(', ') || (id === 'amoniaco' ? 'amoníaco (referencia)' : '—') },
            { k: 'Clasificación', v: amine ? `amina ${degreeText('amina', amine.degree!)}` : amide ? `amida ${amide.degree === 'primario' ? 'primaria (–CONH₂)' : amide.degree === 'secundario' ? 'secundaria (–CONHR)' : 'terciaria (–CONR₂)'}` : groups.some((g) => g.kind === 'urea') ? 'urea (diamida)' : '—' },
            { k: 'Carbonos unidos al N', v: nAtom >= 0 ? String(neighbors(m, nAtom).filter((v) => m.atoms[v].el === 'C').length) : '—', data: true },
            { k: 'H unidos al N', v: String(hOnN), data: true },
            { k: 'Donadores / aceptores de puentes de H', v: `${hb.donors} / ${hb.acceptors}`, data: true },
          ]} />
          <p className="small" style={{ margin: 0 }}>Una amina se clasifica por el número de <strong>carbonos unidos al nitrógeno</strong> (no al carbono, como en los alcoholes): 1 → primaria, 2 → secundaria, 3 → terciaria. En una amida el N está unido al C del carbonilo.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2 · nombrar */

const NAME_PRESETS: NamePreset[] = [
  ...['metanamina', 'etanamina', 'propan-1-amina', 'dimetilamina', 'trimetilamina', 'n-metiletanamina', 'trietilamina', 'anilina', '4-metilanilina', '4-nitroanilina', 'ciclohexanamina', 'fenilmetanamina',
    'formamida', 'acetamida', 'propanamida', 'n-metilacetamida', 'dmf', 'benzamida', 'urea', 'paracetamol', 'glicina', 'alanina', 'glicilglicina']
    .map((id) => ({ value: id, label: getFunc(id).nombre, smiles: getFunc(id).smiles, recId: id })),
  { value: 'x-npropil', label: 'Reto: CCCN(C)CC', smiles: 'CCCN(C)CC' },
  { value: 'x-aminoalcohol', label: 'Reto: NCCO (amina y alcohol)', smiles: 'NCCO' },
  { value: 'x-diamina', label: 'Reto: NCCCCCN', smiles: 'NCCCCCN' },
  { value: 'x-valina', label: 'Reto: CC(C)C(N)C(O)=O', smiles: 'CC(C)C(N)C(O)=O' },
];

/* ------------------------------------------------------------------ 3 · basicidad */

function BasicityStation({ api }: LabProps) {
  const [id, setId] = useState('metanamina');
  const [conc, setConc] = useState(0.1);
  const [pH, setPH] = useState(7.4);
  const bases = BASES_N.map(getFunc).map((r) => ({ r, k: pKaH(r)! })).filter((x) => x.k).sort((a, b) => b.k.value - a.k.value);
  const sel = bases.find((x) => x.r.id === id) ?? bases[0];
  const sol = weakBasePH(sel.k.value, conc);
  const prot = protonatedFraction(sel.k.value, pH);
  const nC = (r: FRecord) => { const m = speciesGraph(funcSpecies(r.id)); const n = m.atoms.findIndex((a) => a.el === 'N'); return n >= 0 ? neighbors(m, n).filter((v) => m.atoms[v].el === 'C').length : 0; };
  const curves = [...new Set(['metanamina', 'anilina', 'amoniaco', sel.r.id])].map((cid, k) => {
    const x = bases.find((b) => b.r.id === cid)!;
    return { label: `${nameEs(x.r)} (pKaH ${fmt(x.k.value, 2)})`, color: `var(--series-${k + 1})`, kind: 'line' as const, points: Array.from({ length: 141 }, (_, i) => ({ x: i / 10, y: 100 * protonatedFraction(x.k.value, i / 10) })) };
  });
  const record = () => api.addTrial('basicidad', { compuesto: nameEs(sel.r), alquilos: nC(sel.r), pKaH: sel.k.value, concentracion: conc, pHDisolucion: Number(sol.pH.toFixed(3)), pHMedio: pH, protonada: Number((prot * 100).toFixed(4)) });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Basicidad: pKa del ácido conjugado (BH⁺)</h3>
          <Status status="experimental" prefix="pKaH">valores publicados en PubChem (HSDB: Perrin, IUPAC; Merck Index; CRC Handbook). Si la fuente da pKb, se calcula pKaH = 14,00 − pKb (Modelo calculado, 25 °C). Mayor pKaH = base más fuerte.</Status>
          <BarCompare idPrefix="gnt-pkah" decimals={2} legend={[{ color: 'var(--series-8)', label: 'Amoníaco' }, { color: 'var(--series-1)', label: 'Alquilaminas' }, { color: 'var(--series-2)', label: 'Anilinas' }, { color: 'var(--series-4)', label: 'Amidas y urea' }]} unit="pKaH" title="pKa del ácido conjugado de aminas y amidas" items={bases.map(({ r, k }) => ({ label: nameEs(r), value: k.value, note: k.calculated ? 'de pKb' : undefined, color: r.grupo === 'amida' ? 'var(--series-4)' : r.id === 'amoniaco' ? 'var(--series-8)' : /anilina/.test(r.id) ? 'var(--series-2)' : 'var(--series-1)', title: `«${k.text}»` }))} />
          <p className="small muted" style={{ margin: 0 }}>Los grupos alquilo empujan electrones hacia el N: las alquilaminas (≈ 10,6–11) son más básicas que el amoníaco (9,25). En la anilina el par libre se reparte en el anillo (resonancia) y la basicidad cae a 4,6; en las amidas el par está comprometido con el C=O y casi no aceptan H⁺. La trimetilamina es menos básica que la dimetilamina en agua porque su ion se solvata peor.</p>
        </div>
        <div className="card stack">
          <h3>Fracción protonada frente al pH</h3>
          <Status status="modelo" prefix="Curvas">f(BH⁺) = 1/(1 + 10^(pH − pKaH)) con los pKaH de la tabla; 25 °C, disolución diluida.</Status>
          <Chart series={curves} xLabel="pH" yLabel="Fracción protonada (BH⁺)" yUnit="%" title="Fracción protonada de bases nitrogenadas" exportName="nitrogenados-protonacion" height={270} xDomain={[0, 14]} yDomain={[0, 100]} />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Base" value={sel.r.id} onChange={setId} options={bases.map(({ r }) => ({ value: r.id, label: nameEs(r) }))} />
          <Slider label="Concentración de la base" value={conc} min={0.001} max={1} step={0.001} decimals={3} unit="mol/L" onChange={setConc} />
          <Slider label="pH del medio (sangre ≈ 7,4)" value={pH} min={0} max={14} step={0.1} decimals={1} onChange={setPH} />
          <Readout items={[
            { k: 'pKaH', v: `${fmt(sel.k.value, 3)}${sel.k.calculated ? ' (14,00 − pKb)' : ''}`, data: true },
            { k: `pH de la disolución ${fmt(conc, 3)} M`, v: fmt(sol.pH, 2), data: true },
            { k: 'Base que reacciona con el agua', v: `${fmt(sol.ionized * 100, 2)} %`, data: true },
            { k: `Protonada a pH ${fmt(pH, 1)}`, v: `${fmt(prot * 100, 2)} %`, data: true },
          ]} />
          <RecordButton onRecord={record} label="Guardar el cálculo en la tabla" />
          <p className="small muted" style={{ margin: 0 }}>Caso de referencia: metanamina 0,10 M (pKaH 10,66) → pH ≈ 11,82; anilina 0,10 M (pKaH 4,6) → pH ≈ 8,80.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 4 · amida plana */

const AMIDE_IDS = ['formamida', 'acetamida', 'n-metilacetamida', 'dmf', 'benzamida', 'paracetamol', 'glicilglicina', 'urea'];
const AMINE_IDS = ['metanamina', 'dimetilamina', 'trimetilamina', 'etanamina', 'ciclohexanamina', 'anilina'];

function AmideStation({ api }: LabProps) {
  const [amide, setAmide] = useState('acetamida');
  const [amine, setAmine] = useState('metanamina');
  const spA = useMemo(() => funcSpecies(amide), [amide]);
  const spB = useMemo(() => funcSpecies(amine), [amine]);
  const gA = useMemo(() => amideGeometry(spA)!, [spA]);
  const gB = useMemo(() => amineGeometry(spB)!, [spB]);
  const hlA: Highlight[] = useMemo(() => [{ atoms: [gA.o, gA.c, gA.n], color: 'var(--series-4)', label: 'O=C–N (grupo amida)' }], [gA]);
  const hlB: Highlight[] = useMemo(() => [{ atoms: [gB.n], color: 'var(--fis)', label: 'N de la amina' }], [gB]);
  const rows = [...AMIDE_IDS.map((id) => ({ id, kind: 'amida' as const, g: amideGeometry(funcSpecies(id))! })), ...AMINE_IDS.map((id) => ({ id, kind: 'amina' as const, g: amineGeometry(funcSpecies(id))! }))];
  const record = () => {
    api.addTrial('geometria', { compuesto: nameEs(getFunc(amide)), tipo: 'amida', dCN: Number(gA.dCN.toFixed(3)), sumaN: Number(gA.sumN.toFixed(1)), dCO: Number(gA.dCO.toFixed(3)), fuente: `PubChem3D CID ${getFunc(amide).cid}` });
    api.addTrial('geometria', { compuesto: nameEs(getFunc(amine)), tipo: 'amina', dCN: Number(gB.dCN.toFixed(3)), sumaN: Number(gB.sumN.toFixed(1)), dCO: null, fuente: `PubChem3D CID ${getFunc(amine).cid}` });
  };
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="card stack">
            <h3 style={{ marginBottom: 0 }}>{nameEs(getFunc(amide))}</h3>
            <FunctionalViewer3D species={spA} idPrefix="gnt-ama" highlights={hlA} height={260} styleLabel="Estilo del modelo de la amida" showTags={false} />
          </div>
          <div className="card stack">
            <h3 style={{ marginBottom: 0 }}>{nameEs(getFunc(amine))}</h3>
            <FunctionalViewer3D species={spB} idPrefix="gnt-amb" highlights={hlB} height={260} styleLabel="Estilo del modelo de la amina" showTags={false} />
          </div>
        </div>
        <div className="card stack">
          <h3>¿Por qué la amida es plana? Resonancia</h3>
          <ResonanceSvg />
          <p className="small" style={{ margin: 0 }}>El par libre del N se deslocaliza hacia el C=O: el enlace C–N adquiere carácter parcial de doble enlace (Pauling estimó cerca de 40 %). Por eso el C–N de la amida es más corto que el de una amina, el N es trigonal plano (los tres ángulos suman ≈ 360°) y no gira libremente: en las proteínas, cada enlace peptídico es una «placa» plana. En la tabla, la anilina sale plana en el confórmero porque su par libre se conjuga con el anillo; las alquilaminas son pirámides (≈ 325–331°).</p>
        </div>
        <div className="card stack">
          <h3>Mediciones en los confórmeros</h3>
          <Status status="modelo" prefix="Medidas">longitudes y ángulos calculados con las coordenadas de PubChem3D (MMFF94s), no medidos. Referencia experimental del enlace peptídico: C–N {fmt(PEPTIDE_REF.dCN, 2)} Å, C=O {fmt(PEPTIDE_REF.dCO, 2)} Å, N–Cα {fmt(PEPTIDE_REF.dNCa, 2)} Å (Corey y Pauling, 1953: Evidencia experimental).</Status>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Geometría medida de amidas y aminas">
            <table className="small">
              <caption className="sr-only">Longitud C–N y suma de los ángulos alrededor del N</caption>
              <thead><tr><th>Compuesto</th><th>Tipo</th><th className="n">C–N (Å)</th><th className="n">Σ ángulos en N (°)</th><th>Forma del N</th></tr></thead>
              <tbody>{rows.map(({ id, kind, g }) => (
                <tr key={id}><td>{nameEs(getFunc(id))}</td><td>{kind}</td><td className="n">{fmt(g.dCN, 3)}</td><td className="n">{Number.isFinite(g.sumN) ? fmt(g.sumN, 1) : '—'}</td><td>{g.sumN > 355 ? 'plano (sp²)' : g.sumN > 345 ? 'casi plano' : 'pirámide'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Amida" value={amide} onChange={setAmide} options={AMIDE_IDS.map((x) => ({ value: x, label: getFunc(x).nombre }))} />
          <Select label="Amina para comparar" value={amine} onChange={setAmine} options={AMINE_IDS.map((x) => ({ value: x, label: getFunc(x).nombre }))} />
          <Readout items={[
            { k: 'Amida: C–N', v: `${fmt(gA.dCN, 3)} Å`, data: true },
            { k: 'Amida: C=O', v: `${fmt(gA.dCO, 3)} Å`, data: true },
            { k: 'Amida: Σ ángulos en N', v: `${fmt(gA.sumN, 1)}°`, data: true },
            { k: 'Amida: desviación del plano O=C–N', v: `${fmt(gA.planarity, 3)} Å`, data: true },
            { k: 'Amina: C–N', v: `${fmt(gB.dCN, 3)} Å`, data: true },
            { k: 'Amina: Σ ángulos en N', v: `${fmt(gB.sumN, 1)}°`, data: true },
          ]} />
          <RecordButton onRecord={record} label="Guardar las dos mediciones en la tabla" />
        </div>
      </div>
    </div>
  );
}

/** Estructuras de resonancia de la amida (Ilustración educativa). */
function ResonanceSvg() {
  const t = (x: number, y: number, s: string, extra: Record<string, string | number> = {}) => <text x={x} y={y} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: 'var(--ink)', fontFamily: 'var(--font-data)', ...extra }}>{s}</text>;
  return (
    <svg viewBox="0 0 640 150" role="img" aria-label="Dos estructuras de resonancia de una amida: a la izquierda O=C–N con un par libre en el N; a la derecha O con carga negativa, C=N con carga positiva en el N. Ilustración educativa." style={{ width: '100%', height: 'auto', display: 'block' }}>
      <g>
        {t(70, 50, 'O')} <line x1={70} y1={60} x2={70} y2={86} stroke="var(--ink)" strokeWidth={2.5} /><line x1={77} y1={60} x2={77} y2={86} stroke="var(--ink)" strokeWidth={2.5} />
        {t(73, 108, 'C')} {t(28, 112, 'R')} <line x1={38} y1={105} x2={60} y2={105} stroke="var(--ink)" strokeWidth={2.5} />
        <line x1={86} y1={105} x2={130} y2={105} stroke="var(--ink)" strokeWidth={2.5} />{t(146, 112, 'N')}
        <circle cx={140} cy={88} r={2.6} fill="var(--fis)" /><circle cx={152} cy={88} r={2.6} fill="var(--fis)" />
        <path d="M146 84 C 140 60, 110 66, 104 96" fill="none" stroke="var(--fis)" strokeWidth={2} markerEnd="url(#gnt-arr)" />
        <path d="M84 92 C 95 72, 92 58, 84 52" fill="none" stroke="var(--bad)" strokeWidth={2} markerEnd="url(#gnt-arr2)" />
        {t(186, 112, 'H')}<line x1={158} y1={105} x2={176} y2={105} stroke="var(--ink)" strokeWidth={2.5} />
      </g>
      <text x={300} y={108} textAnchor="middle" style={{ fontSize: 28, fill: 'var(--accent)' }}>↔</text>
      <g transform="translate(360 0)">
        {t(70, 50, 'O')}<text x={88} y={38} style={{ fontSize: 16, fill: 'var(--bad)', fontWeight: 800 }}>−</text>
        <line x1={73} y1={60} x2={73} y2={86} stroke="var(--ink)" strokeWidth={2.5} />
        {t(73, 108, 'C')} {t(28, 112, 'R')} <line x1={38} y1={105} x2={60} y2={105} stroke="var(--ink)" strokeWidth={2.5} />
        <line x1={86} y1={101} x2={130} y2={101} stroke="var(--ink)" strokeWidth={2.5} /><line x1={86} y1={109} x2={130} y2={109} stroke="var(--ink)" strokeWidth={2.5} />
        {t(146, 112, 'N')}<text x={160} y={92} style={{ fontSize: 16, fill: 'var(--fis)', fontWeight: 800 }}>+</text>
        {t(186, 112, 'H')}<line x1={158} y1={105} x2={176} y2={105} stroke="var(--ink)" strokeWidth={2.5} />
      </g>
      <defs>
        <marker id="gnt-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--fis)" /></marker>
        <marker id="gnt-arr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--bad)" /></marker>
      </defs>
      <text x={320} y={142} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Ilustración educativa: la estructura real es un híbrido de las dos (flechas curvas = movimiento de pares de electrones).</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ 5 · propiedades */

function PropertiesStation({ api }: LabProps) {
  const [pick, setPick] = useState('propan-1-amina');
  const items = SIMILAR_MASS_N.map(getFunc).map((r) => { const hb = hBondsOf(r); return { label: nameEs(r), value: r.propiedades.tEb?.valor ?? null, note: `${fmt(r.masaMolar, 1)} g/mol · ${hb.donors} donador${hb.donors === 1 ? '' : 'es'}`, color: r.grupo === 'amida' ? 'var(--series-4)' : hb.donors ? 'var(--series-1)' : 'var(--series-8)' }; }).sort((a, b) => (a.value ?? -999) - (b.value ?? -999));
  const solIds = ['amoniaco', 'metanamina', 'etanamina', 'propan-1-amina', 'butan-1-amina', 'dietilamina', 'trietilamina', 'anilina', 'ciclohexanamina', 'formamida', 'acetamida', 'benzamida', 'urea', 'paracetamol', 'glicina'];
  const rec = getFunc(pick);
  const hb = hBondsOf(rec);
  const record = () => api.addTrial('propiedades', { compuesto: nameEs(rec), familia: rec.grupo, masaMolar: Number(rec.masaMolar.toFixed(2)), donadores: hb.donors, aceptores: hb.acceptors, tEb: rec.propiedades.tEb?.valor ?? null, solubilidad: rec.propiedades.solubilidad?.tipo === 'valor' ? rec.propiedades.solubilidad.valor! : null, fuente: `PubChem CID ${rec.cid} (PUG View, ${rec.fuente.fecha})` });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Masa parecida (≈ 58–60 g/mol), distinta función</h3>
          <Status status="experimental" prefix="Tₑb">PubChem (HSDB y otras bases citadas).</Status>
          <BarCompare idPrefix="gnt-masa" legend={[{ color: 'var(--series-8)', label: 'Sin H unido a N u O' }, { color: 'var(--series-1)', label: 'Con N–H u O–H' }, { color: 'var(--series-4)', label: 'Amida' }]} items={items} unit="°C" title="Temperatura de ebullición a masa molar parecida" />
          <p className="small muted" style={{ margin: 0 }}>El N es menos electronegativo que el O: el puente N–H···N es más débil que O–H···O, y por eso la propan-1-amina hierve más bajo que el propan-1-ol. La acetamida hierve a 222 °C: cada molécula da dos N–H y recibe en el O muy polarizado por la resonancia.</p>
        </div>
        <div className="card stack">
          <h3>Solubilidad en agua</h3>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Solubilidad en agua de aminas y amidas (PubChem)">
            <table className="small">
              <caption className="sr-only">Solubilidad en agua de aminas, amidas y moléculas biológicas</caption>
              <thead><tr><th>Compuesto</th><th>Solubilidad</th><th>Fuente</th></tr></thead>
              <tbody>{solIds.map((cid) => { const r = getFunc(cid); return <tr key={cid}><td>{nameEs(r)}</td><td>{solText(r.propiedades.solubilidad)}</td><td className="muted">{r.propiedades.solubilidad ? `«${r.propiedades.solubilidad.texto.slice(0, 60)}${r.propiedades.solubilidad.texto.length > 60 ? '…' : ''}»` : '—'}</td></tr>; })}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Compuesto para la tabla" value={pick} onChange={setPick} options={[...new Set([...SIMILAR_MASS_N, ...solIds])].map((x) => ({ value: x, label: getFunc(x).nombre }))} />
          <Readout items={[
            { k: 'Tₑb (experimental)', v: <Exp p={rec.propiedades.tEb} decimals={1} />, data: true },
            { k: 'Solubilidad en agua', v: solText(rec.propiedades.solubilidad), data: true },
            { k: 'Donadores / aceptores', v: `${hb.donors} / ${hb.acceptors}`, data: true },
          ]} />
          <RecordButton onRecord={record} label="Guardar el compuesto en la tabla" />
        </div>
        <details className="card">
          <summary>Fuentes del compuesto ({rec.nombre})</summary>
          <Sources rec={rec} keys={[{ k: 'tEb', label: 'Tₑb' }, { k: 'solubilidad', label: 'Solubilidad' }, { k: 'pKa', label: 'pKa / pKb' }]} />
        </details>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 6 · biomoléculas */

function BiomoleculesStation() {
  const [pH, setPH] = useState(7.4);
  const ala = getFunc('alanina').propiedades.pKa!;
  const [k1, k2] = ala.valores ?? [ala.valor, NaN];
  const sp = aminoAcidSpecies(k1, k2, pH);
  const curve = (key: 'cation' | 'zwitterion' | 'anion', label: string, color: string) => ({ label, color, kind: 'line' as const, points: Array.from({ length: 141 }, (_, i) => ({ x: i / 10, y: 100 * aminoAcidSpecies(k1, k2, i / 10)[key] })) });
  const pep = useMemo(() => reaction3dDef(reactionById('enlace-peptidico')), []);
  const para = useMemo(() => funcSpecies('paracetamol', 'Paracetamol'), []);
  const paraHl = useMemo(() => groupHighlights(para), [para]);
  return (
    <div className="stack">
      <div className="lab-layout">
        <div className="stack">
          <div className="card stack">
            <h3>Enlace peptídico en 3D: glicina + glicina → glicilglicina + agua</h3>
            <Reaction3D def={pep} idPrefix="gnt-pep" height={300} />
            <p className="small muted" style={{ margin: 0 }}>El grupo –COOH de una glicina y el –NH₂ de la otra forman una amida (enlace peptídico) y se libera agua. En la célula ocurre en el ribosoma con energía química; la ecuación solo resume el cambio de enlaces.</p>
          </div>
        </div>
        <div className="controls">
          <div className="card stack">
            <h3>Alanina: ¿qué forma predomina a cada pH?</h3>
            <Status status="experimental" prefix="pKa">«{ala.texto}» (PubChem, HSDB).</Status>
            <Slider label="pH" value={pH} min={0} max={14} step={0.1} decimals={1} onChange={setPH} />
            <Readout items={[
              { k: 'Catión (+H₃N–CH(CH₃)–COOH)', v: `${fmt(sp.cation * 100, 2)} %`, data: true },
              { k: 'Ion dipolar (+H₃N–…–COO⁻)', v: `${fmt(sp.zwitterion * 100, 2)} %`, data: true },
              { k: 'Anión (H₂N–…–COO⁻)', v: `${fmt(sp.anion * 100, 2)} %`, data: true },
              { k: 'Punto isoeléctrico pI = (pKa₁ + pKa₂)/2', v: fmt(sp.pI, 2), data: true },
            ]} />
          </div>
        </div>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="card stack">
          <h3>Especies de la alanina frente al pH</h3>
          <Status status="modelo" prefix="Curvas">equilibrio diprótico con los pKa experimentales (25 °C, disolución diluida).</Status>
          <Chart series={[curve('cation', 'Catión', 'var(--series-2)'), curve('zwitterion', 'Ion dipolar (zwitterión)', 'var(--series-1)'), curve('anion', 'Anión', 'var(--series-4)')]} xLabel="pH" yLabel="Fracción" yUnit="%" title="Especies de la alanina" exportName="alanina-especies" height={250} xDomain={[0, 14]} yDomain={[0, 100]} />
          <p className="small muted" style={{ margin: 0 }}>Un aminoácido tiene un grupo ácido y uno básico en la misma molécula: en la sangre (pH 7,4) casi todo está como ion dipolar. El confórmero 3D de PubChem es la forma neutra (no la del agua).</p>
        </div>
        <div className="card stack">
          <h3>Paracetamol: una amida y un fenol</h3>
          <FunctionalViewer3D species={para} idPrefix="gnt-par" highlights={paraHl} height={240} styleLabel="Estilo del modelo del paracetamol" />
          <p className="small muted" style={{ margin: 0 }}>N-(4-hidroxifenil)acetamida: el –OH fenólico explica que dé color violeta con FeCl₃ y el grupo amida, su nombre. La urea (H₂N–CO–NH₂), la primera sustancia orgánica sintetizada a partir de una inorgánica (Wöhler, 1828), también es una amida.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ laboratorio */

const IDEAS = [
  { id: 'n1', text: 'Una amina terciaria es la que tiene el N unido a un carbono terciario.', answer: 'falso' as const, feedback: 'En las aminas se cuentan los carbonos unidos al N: la trimetilamina es terciaria aunque sus carbonos sean CH₃. En los alcoholes, en cambio, se mira el carbono que lleva el –OH.' },
  { id: 'n2', text: 'Las amidas son bases tan fuertes como las aminas porque también tienen N con un par libre.', answer: 'falso' as const, feedback: 'El par del N de la amida está deslocalizado hacia el C=O: la acetamida tiene pKaH ≈ −0,5 frente a 10,66 de la metanamina, unos 11 órdenes de magnitud menos básica.' },
  { id: 'n3', text: 'Cuantos más grupos alquilo tenga el N, más básica es la amina en agua.', answer: 'falso' as const, feedback: 'Pasa de amoníaco (9,25) a metilamina (10,66) y dimetilamina (10,73), pero la trimetilamina baja a 9,80: en agua también importa cómo se solvata el ion amonio.' },
  { id: 'n4', text: 'El enlace C–N de una amida gira libremente como un enlace sencillo.', answer: 'falso' as const, feedback: 'Por la resonancia tiene carácter parcial de doble enlace: es más corto (≈ 1,38 Å en el confórmero de la acetamida frente a ≈ 1,43 Å en la metanamina) y el grupo es plano.' },
];

export default function NitrogenGroupsLab(props: LabProps) {
  const [station, setStation] = useState<Station>('clasificar');
  return (
    <div className="stack">
      <Notice>
        <strong>Propósito:</strong> aprendes a clasificar y nombrar aminas y amidas, a explicar su basicidad y sus puntos de ebullición con datos publicados y a reconocer el enlace peptídico de las proteínas al girar sus modelos 3D, medir la amida plana y variar el pH.
      </Notice>
      <Segmented label="Estación" value={station} onChange={setStation} options={STATIONS} />
      {station === 'clasificar' && <ClassifyStation />}
      {station === 'nombrar' && <NomenclaturePanel presets={NAME_PRESETS} idPrefix="gnt-nom" onName={(r) => props.api.addTrial('nombres', { smiles: r.smiles, nombre: r.es, ingles: r.en, grupo: r.clase, carbonos: carbonCount(r.smiles) })} />}
      {station === 'basicidad' && <BasicityStation {...props} />}
      {station === 'amida' && <AmideStation {...props} />}
      {station === 'propiedades' && <PropertiesStation {...props} />}
      {station === 'biomoleculas' && <BiomoleculesStation />}
      <IdeasPanel idPrefix="gnt" ideas={IDEAS} intro="Ideas frecuentes sobre aminas y amidas. Decide y compruébalo con los datos de las estaciones 3 y 4." />
    </div>
  );
}

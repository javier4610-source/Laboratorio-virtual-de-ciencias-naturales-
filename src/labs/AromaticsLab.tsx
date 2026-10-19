import { useMemo, useState } from 'react';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import { StructureSvg } from '../components/organica/StructureSvg';
import { ExpValue, PubChemLink, StatusLine } from '../components/organica/OrganicParts';
import { Molecule3D, Reaction3D, moleculeSpecies, type Reaction3DDef } from '../chem';
import { getOrganic, prettyHill } from '../data/quimica/organica';
import { orgSpecies } from '../data/quimica/organicaSpecies';
import { boilingPoint, bondSummary, liquidDensity, measureConformer, meltingPoint, unsaturationTest } from '../models/hydrocarbons';
import { delocalizationEnergy, huckelAnalysis, orthoMetaPara, piEnergy } from '../models/aromaticity';
import { canonicalKey, molFromMolfile, parseSmiles, stripHydrogens } from '../models/organicGraph';
import { nameMolecule } from '../models/organicNomenclature';
import { buildMolecule, emptyState, SUBSTITUENTS } from '../models/organicBuilder';
import { fmt } from '../lib/format';
import type { LabProps } from './registry';

type Station = 'benceno' | 'huckel' | 'derivados' | 'sustitucion';
const STATIONS: { value: Station; label: string }[] = [
  { value: 'benceno', label: '1 · Benceno y resonancia' },
  { value: 'huckel', label: '2 · Regla de Hückel' },
  { value: 'derivados', label: '3 · Derivados y nombres' },
  { value: 'sustitucion', label: '4 · Sustitución electrofílica' },
];
const ang = (v: number) => `${fmt(v, 3)} Å`;
const esName = (id: string) => { const r = getOrganic(id); const n = nameMolecule(parseSmiles(r.smiles)); return n.ok ? n.es : r.nombre; };

/* ------------------------------------------------------------------ 1 · benceno */

const COMPARE = ['benceno', 'ciclohexano', 'ciclohexeno', 'ciclohexa-1,3-dieno'];

function BenzeneStation({ api }: LabProps) {
  const [id, setId] = useState('benceno');
  const [kekule, setKekule] = useState<'a' | 'b'>('a');
  const species = useMemo(() => orgSpecies(id), [id]);
  const rows = COMPARE.map((x) => {
    const s = orgSpecies(x);
    const raw = measureConformer(s.atoms, s.bonds).bonds.map((k) => (x === 'benceno' && /^C[–=]C$/.test(k.kind) ? { ...k, kind: 'C⋯C' } : k));
    const b = bondSummary(raw).filter((k) => /^C[–=⋯]C$/.test(k.kind));
    return { id: x, name: esName(x), b };
  });
  const benz = rows[0].b[0];
  const hexS = rows[1].b.find((k) => k.kind === 'C–C')!, eneD = rows[2].b.find((k) => k.kind === 'C=C')!;
  const kek = useMemo(() => parseSmiles(kekule === 'a' ? 'C1=CC=CC=C1' : 'C1C=CC=CC=1'), [kekule]);
  const chart = [{
    label: 'Longitudes C–C medidas', color: 'var(--series-1)', kind: 'scatter' as const,
    points: rows.flatMap((r, k) => r.b.map((x) => ({ x: k + 1, y: x.mean, label: `${r.name}: ${x.kind}` }))),
  }];
  const record = () => {
    for (const r of rows) for (const x of r.b) api.addTrial('enlaces', { compuesto: r.name, enlace: r.id === 'benceno' ? 'C⋯C aromático' : x.kind, ordenFormal: r.id === 'benceno' ? 1.5 : x.kind === 'C=C' ? 2 : 1, longitud: Number(x.mean.toFixed(3)), dispersion: Number((x.max - x.min).toFixed(3)), fuente: `PubChem3D CID ${getOrganic(r.id).cid}` });
  };
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>{esName(id)} en 3D</h3>
          <Molecule3D species={species} idPrefix="aro-ben" height={280} measure />
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Longitudes carbono-carbono">
            <table>
              <caption className="small muted">Longitudes C–C medidas en los confórmeros de PubChem (Modelo calculado, MMFF94s); el benceno se dibuja con enlaces alternos en el archivo, pero sus seis distancias resultan iguales</caption>
              <thead><tr><th>Molécula</th><th>Enlace</th><th>Promedio</th><th>Mínimo–máximo</th></tr></thead>
              <tbody>{rows.flatMap((r) => r.b.map((x) => <tr key={r.id + x.kind}><td>{r.name}</td><td>{r.id === 'benceno' ? 'C⋯C (anillo aromático)' : x.kind}</td><td>{ang(x.mean)}</td><td>{fmt(x.min, 3)}–{fmt(x.max, 3)} Å</td></tr>))}</tbody>
            </table>
          </div>
          <Chart series={chart} xLabel="Molécula (1 benceno, 2 ciclohexano, 3 ciclohexeno, 4 ciclohexa-1,3-dieno)" yLabel="Longitud C–C" yUnit="Å" title="Longitudes C–C medidas" exportName="aromaticos-enlaces" height={240} />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Molécula en 3D" value={id} onChange={setId} options={COMPARE.map((x) => ({ value: x, label: esName(x) }))} />
          <Readout items={[
            { k: 'C–C del benceno (6 enlaces)', v: ang(benz.mean), data: true },
            { k: 'Diferencia entre el más largo y el más corto', v: ang(benz.max - benz.min), data: true },
            { k: 'C–C sencillo del ciclohexano', v: ang(hexS.mean), data: true },
            { k: 'C=C del ciclohexeno', v: ang(eneD.mean), data: true },
          ]} />
          <RecordButton onRecord={record} label="Guardar las longitudes en la tabla" />
        </div>
        <div className="card stack">
          <h3>Resonancia</h3>
          <StatusLine status="ilustracion" prefix="Estructuras">dos fórmulas de Kekulé dibujadas en 2D.</StatusLine>
          <StructureSvg mol={kek} title={`Estructura de Kekulé ${kekule === 'a' ? '1' : '2'} del benceno`} width={240} height={150} />
          <Segmented label="Estructura de Kekulé" value={kekule} onChange={setKekule} options={[{ value: 'a', label: 'Kekulé 1' }, { value: 'b', label: 'Kekulé 2' }]} />
          <p className="small">Ninguna de las dos existe por separado: el benceno real es un híbrido con los 6 electrones π repartidos en todo el anillo. Por eso las seis distancias medidas son iguales y quedan entre la de un enlace sencillo y la de uno doble.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2 · Hückel */

const HUCKEL_IDS = ['benceno', 'ciclobutadieno', 'ciclooctatetraeno', 'ciclopentadieno', 'ciclopentadienuro', 'tropilio', 'piridina', 'pirrol', 'furano', 'naftaleno'];

function LevelDiagram({ levels, title }: { levels: { x: number; electrons: number }[]; title: string }) {
  const W = 260, H = 220;
  const xs = levels.map((l) => l.x);
  const max = Math.max(2.2, ...xs.map(Math.abs));
  const y = (x: number) => H / 2 - (x / max) * (H / 2 - 16); // x > 0 (enlazante) abajo… se dibuja: enlazante abajo
  const groups: { x: number; items: { electrons: number }[] }[] = [];
  for (const l of levels) { const g = groups.find((q) => Math.abs(q.x - l.x) < 1e-4); if (g) g.items.push(l); else groups.push({ x: l.x, items: [l] }); }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} style={{ width: '100%', maxWidth: 320 }}>
      <line x1={40} y1={H / 2} x2={W - 8} y2={H / 2} stroke="var(--line-strong)" strokeDasharray="4 3" />
      <text x={4} y={H / 2 + 4} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>α</text>
      <text x={4} y={14} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>energía</text>
      {groups.map((g) => {
        const yy = H - y(g.x); // enlazantes (x > 0) más abajo
        const n = g.items.length;
        return (
          <g key={g.x}>
            {g.items.map((it, k) => {
              const cx = 150 + (k - (n - 1) / 2) * 52;
              return (
                <g key={k}>
                  <line x1={cx - 20} x2={cx + 20} y1={yy} y2={yy} stroke="var(--ink)" strokeWidth={2.5} />
                  {it.electrons >= 1 && <text x={cx - 7} y={yy - 3} textAnchor="middle" style={{ fontSize: 14, fill: 'var(--data)', fontWeight: 700 }}>↑</text>}
                  {it.electrons >= 2 && <text x={cx + 7} y={yy - 3} textAnchor="middle" style={{ fontSize: 14, fill: 'var(--data)', fontWeight: 700 }}>↓</text>}
                </g>
              );
            })}
            <text x={40} y={yy + 4} style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{g.x === 0 ? 'α' : `α${g.x > 0 ? '+' : '−'}${fmt(Math.abs(g.x), 2)}β`}</text>
          </g>
        );
      })}
    </svg>
  );
}

function HuckelStation({ api }: LabProps) {
  const [id, setId] = useState('benceno');
  const rec = getOrganic(id);
  const species = useMemo(() => orgSpecies(id), [id]);
  const an = useMemo(() => {
    const { mol, xyz } = molFromMolfile(rec.sdf!);
    const { mol: heavy, index } = stripHydrogens(mol);
    return huckelAnalysis(heavy, index.map((k) => ({ x: xyz[k][0], y: xyz[k][1], z: xyz[k][2] })));
  }, [rec.sdf]);
  const record = () => api.addTrial('huckel', {
    compuesto: rec.nombre, formula: rec.formula, electronesPi: an.piElectrons, n: an.n, regla: an.rule ?? 'ninguna', conjugado: an.conjugated ? 'sí' : 'no',
    desviacionPlano: an.planarity ? Number(an.planarity.max.toFixed(3)) : null, veredicto: an.verdict, fuente: `PubChem3D CID ${rec.cid}`,
  });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>{rec.nombre} <span className="small muted">({prettyHill(rec.formula)})</span></h3>
          <Molecule3D species={species} idPrefix="aro-huc" height={280} measure />
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Electrones pi de cada átomo del anillo">
            <table>
              <caption className="small muted">Aporte de electrones π de cada átomo del anillo (reglas de conteo)</caption>
              <thead><tr><th>Átomo</th><th>Electrones π</th><th>Motivo</th></tr></thead>
              <tbody>{an.contributions.map((c, k) => <tr key={k}><td>{c.el}{k + 1}</td><td>{c.electrons ?? '—'}</td><td className="small">{c.reason}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        {an.levels && (
          <div className="card stack">
            <h3>Orbitales π (método de Hückel)</h3>
            <StatusLine status="modelo" prefix="Energías">calculadas con el método de Hückel (valores propios de la matriz de conexiones π; β &lt; 0).</StatusLine>
            <LevelDiagram levels={an.levels} title={`Diagrama de orbitales π de Hückel de ${rec.nombre} con ${an.piElectrons} electrones`} />
            <Readout items={[
              { k: 'Energía π total', v: `${fmt(piEnergy(an.levels), 2)} β`, data: true },
              { k: 'Deslocalización frente a enlaces π aislados', v: `${fmt(delocalizationEnergy(an.levels, an.piElectrons ?? 0), 2)} β`, data: true },
            ]} />
            <p className="small muted">Capa cerrada (todos los orbitales enlazantes llenos) = estabilidad aromática; dos electrones desapareados en orbitales de igual energía = antiaromático.</p>
          </div>
        )}
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Anillo" value={id} onChange={setId} options={HUCKEL_IDS.map((x) => ({ value: x, label: `${getOrganic(x).nombre} (${prettyHill(getOrganic(x).formula)})` }))} />
          <Readout items={[
            { k: 'Electrones π', v: an.piElectrons === null ? 'No conjugado' : String(an.piElectrons), data: true },
            { k: '¿4n + 2?', v: an.rule === '4n+2' ? `Sí (n = ${an.n})` : an.rule === '4n' ? `No: 4n (n = ${an.n})` : 'No' },
            { k: 'Desviación máxima del plano', v: an.planarity ? ang(an.planarity.max) : '—', data: true },
            { k: 'Veredicto', v: an.verdict },
          ]} />
          <p className="small" aria-live="polite">{an.reason}</p>
          {an.electronic !== an.verdict && <Notice kind="warn">El conteo de electrones (4n + 2) predice «{an.electronic}», pero el confórmero de PubChem no es plano. El confórmero se calculó con un campo de fuerza (MMFF94s) y la carga dibujada en un solo carbono: un modelo calculado puede no reproducir la deslocalización. Doering y Knox (1954) prepararon sales estables del ion tropilio, que se describe como aromático.</Notice>}
          <RecordButton onRecord={record} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 · derivados */

const SUBS = ['metil', 'etil', 'Cl', 'Br', 'etenil', 'isopropil'];
const DER_IDS = ['tolueno', 'o-xileno', 'm-xileno', 'p-xileno', 'etilbenceno', 'estireno', '1,3,5-trimetilbenceno', 'clorobenceno', 'bromobenceno', 'nitrobenceno', 'fenol', 'naftaleno', 'antraceno'];

function DerivativesStation({ api }: LabProps) {
  const [a, setA] = useState('metil');
  const [b, setB] = useState('metil');
  const [pos, setPos] = useState('4');
  const state = useMemo(() => { const s = emptyState({ kind: 'benceno' }); s.subs[0] = [a]; if (b !== 'ninguno') s.subs[Number(pos) - 1] = [b]; return s; }, [a, b, pos]);
  const built = buildMolecule(state);
  const nm = built.mol ? nameMolecule(built.mol) : null;
  const omp = b !== 'ninguno' ? orthoMetaPara(1, Number(pos)) : null;
  const key = built.mol ? canonicalKey(built.mol) : '';
  const libMatch = DER_IDS.map((x) => getOrganic(x)).find((r) => { try { return canonicalKey(parseSmiles(r.smiles)) === key; } catch { return false; } });
  const [libId, setLibId] = useState('p-xileno');
  const lib = getOrganic(libId);
  const xyl = ['o-xileno', 'm-xileno', 'p-xileno'].map((x) => getOrganic(x));
  const chart = [
    { label: 'T de fusión', color: 'var(--series-1)', kind: 'scatter' as const, points: xyl.map((r, k) => ({ x: k + 1, y: r.propiedades.tFus!.valor, label: r.nombre })) },
    { label: 'Tₑb', color: 'var(--series-2)', kind: 'scatter' as const, points: xyl.map((r, k) => ({ x: k + 1, y: r.propiedades.tEb!.valor, label: r.nombre })) },
  ];
  const record = () => api.addTrial('derivados', { compuesto: lib.nombre, formula: lib.formula, tEb: lib.propiedades.tEb?.valor ?? null, tFus: lib.propiedades.tFus?.valor ?? null, densidad: liquidDensity(lib).ok?.value ?? null, fuente: `PubChem CID ${lib.cid}` });
  const subOpts = SUBS.map((s) => ({ value: s, label: SUBSTITUENTS.find((x) => x.id === s)!.label }));
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Nombra un benceno disustituido</h3>
          {built.mol && nm?.ok && (
            <>
              <StructureSvg mol={built.mol} locants={nm.locants} highlight={nm.parent.atoms} title={`Estructura de ${nm.es}`} height={190} />
              <p style={{ fontSize: '1.2rem', margin: 0 }} aria-live="polite"><strong>{nm.es}</strong>{omp && b !== 'ninguno' && a === b ? ` · ${omp}-di${SUBSTITUENTS.find((x) => x.id === a)!.label.split(' ')[0]}benceno` : ''}{nm.retenido ? ` · nombre común: ${nm.retenido.es}` : ''}</p>
              <p className="small muted">{nm.pasos.find((p) => p.titulo.startsWith('2'))?.texto}</p>
              {libMatch ? <p className="small">Esta estructura está en la biblioteca: {libMatch.nombre} (<PubChemLink rec={libMatch} />). Elígela abajo para ver sus datos.</p> : <p className="small muted">No hay datos experimentales de esta estructura en la biblioteca del laboratorio.</p>}
            </>
          )}
        </div>
        <div className="card stack">
          <h3>Isómeros del xileno: misma fórmula, propiedades distintas</h3>
          <StatusLine status="experimental" prefix="Datos">temperaturas publicadas (PubChem/HSDB). 1 = o-xileno, 2 = m-xileno, 3 = p-xileno.</StatusLine>
          <Chart series={chart} xLabel="Isómero (1 orto, 2 meta, 3 para)" yLabel="Temperatura" yUnit="°C" title="Tₑb y T de fusión de los xilenos" exportName="xilenos" height={240} />
          <p className="small">El p-xileno funde muy por encima de los otros dos: su forma simétrica empaca mejor en el cristal. Las Tₑb casi no cambian.</p>
        </div>
        <div className="card stack">
          <h3>Derivados reales</h3>
          <Select label="Compuesto aromático" value={libId} onChange={setLibId} options={DER_IDS.map((x) => ({ value: x, label: getOrganic(x).nombre }))} />
          <Molecule3D species={orgSpecies(libId)} idPrefix="aro-der" height={260} />
          <Readout items={[
            { k: 'Tₑb', v: <ExpValue p={boilingPoint(lib)} />, data: true },
            { k: 'T de fusión', v: <ExpValue p={meltingPoint(lib)} />, data: true },
            { k: 'Densidad (20–25 °C)', v: liquidDensity(lib).ok ? `${fmt(liquidDensity(lib).ok!.value, 3)} g/cm³` : 'No comparable', data: true },
          ]} />
          <RecordButton onRecord={record} />
          <p className="small muted">Fuente: <PubChemLink rec={lib} />{libId === 'fenol' ? ' · El fenol (C₆H₅OH) es un puente con los grupos funcionales: el OH unido al anillo lo hace ácido débil.' : ''}{libId === 'nitrobenceno' ? ' · Producto de la nitración del benceno.' : ''}</p>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Sustituyente en la posición 1" value={a} onChange={setA} options={subOpts} />
          <Select label="Segundo sustituyente" value={b} onChange={setB} options={[{ value: 'ninguno', label: 'ninguno' }, ...subOpts]} />
          {b !== 'ninguno' && <Segmented label="Posición del segundo" value={pos} onChange={setPos} options={[{ value: '2', label: '2 (orto)' }, { value: '3', label: '3 (meta)' }, { value: '4', label: '4 (para)' }]} />}
          <Readout items={[{ k: 'Relación', v: omp ?? '—' }, { k: 'Fórmula', v: built.mol ? prettyHill(canonicalKey(built.mol).split('|')[0]) : '—', data: true }]} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 4 · sustitución electrofílica */

function SubstitutionStation() {
  const [rx, setRx] = useState('br');
  const defs = useMemo<Record<string, { label: string; cat: string; def: Reaction3DDef }>>(() => ({
    br: { label: 'Bromación del benceno', cat: 'catalizador FeBr₃', def: { id: 'aro-br', title: 'Benceno + bromo → bromobenceno + HBr', reactants: [{ species: orgSpecies('benceno'), coef: 1, formula: 'C6H6', name: 'benceno' }, { species: orgSpecies('bromo'), coef: 1, formula: 'Br2', name: 'bromo' }], products: [{ species: orgSpecies('bromobenceno'), coef: 1, formula: 'C6H5Br', name: 'bromobenceno' }, { species: moleculeSpecies('hbr'), coef: 1, formula: 'HBr', name: 'bromuro de hidrógeno' }] } },
    cl: { label: 'Cloración del benceno', cat: 'catalizador FeCl₃ o AlCl₃', def: { id: 'aro-cl', title: 'Benceno + cloro → clorobenceno + HCl', reactants: [{ species: orgSpecies('benceno'), coef: 1, formula: 'C6H6', name: 'benceno' }, { species: moleculeSpecies('cloro'), coef: 1, formula: 'Cl2', name: 'cloro' }], products: [{ species: orgSpecies('clorobenceno'), coef: 1, formula: 'C6H5Cl', name: 'clorobenceno' }, { species: moleculeSpecies('hcl'), coef: 1, formula: 'HCl', name: 'cloruro de hidrógeno' }] } },
    no2: { label: 'Nitración del benceno', cat: 'mezcla de HNO₃ y H₂SO₄ concentrados (forma NO₂⁺)', def: { id: 'aro-no2', title: 'Benceno + ácido nítrico → nitrobenceno + agua', reactants: [{ species: orgSpecies('benceno'), coef: 1, formula: 'C6H6', name: 'benceno' }, { species: moleculeSpecies('hno3'), coef: 1, formula: 'HNO3', name: 'ácido nítrico' }], products: [{ species: orgSpecies('nitrobenceno'), coef: 1, formula: 'C6H5NO2', name: 'nitrobenceno' }, { species: moleculeSpecies('agua'), coef: 1, formula: 'H2O', name: 'agua' }] } },
  }), []);
  const [step, setStep] = useState(0);
  const steps = [
    { t: '1. Formación del electrófilo', d: rx === 'no2' ? 'El H₂SO₄ protona al HNO₃ y se forma el ion nitronio, NO₂⁺.' : `El catalizador polariza la molécula de halógeno y forma un electrófilo (${rx === 'br' ? 'Br⁺' : 'Cl⁺'} asociado al FeX₄⁻).` },
    { t: '2. Ataque del anillo', d: 'Dos electrones π del anillo atacan al electrófilo: se forma un catión (complejo σ, ion arenio) que ya no es aromático; la carga positiva se reparte en tres carbonos (resonancia).' },
    { t: '3. Pérdida de H⁺', d: 'Una base retira el H⁺ del carbono que recibió al electrófilo: el anillo recupera los 6 electrones π y la aromaticidad. Por eso el benceno SUSTITUYE en lugar de adicionar.' },
  ];
  const ion = useMemo(() => parseSmiles(rx === 'no2' ? 'C1=CC([N+](=O)[O-])C=C[CH+]1' : rx === 'br' ? 'C1=CC(Br)C=C[CH+]1' : 'C1=CC(Cl)C=C[CH+]1'), [rx]);
  const benz = unsaturationTest(parseSmiles('c1ccccc1'), 'bromo');
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>{defs[rx].label} en 3D</h3>
          <Reaction3D def={defs[rx].def} idPrefix="aro-rx" height={300} labelSuffix=" (sustitución aromática)" />
          <p className="small muted">Condiciones reales: {defs[rx].cat}; el catalizador no se dibuja. La animación no muestra el complejo σ: para eso están los pasos de la derecha.</p>
        </div>
        <div className="card stack">
          <h3>Sustitución frente a adición</h3>
          <p className="small">Con agua de bromo y sin catalizador, el benceno <strong>no</strong> se decolora: {benz.observation.toLowerCase()} Un alqueno (ciclohexeno) sí: adiciona Br₂ al doble enlace. Adicionar al benceno destruiría su sistema aromático, que es muy estable.</p>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Reacción" value={rx} onChange={(v) => { setRx(v); setStep(0); }} options={Object.entries(defs).map(([k, v]) => ({ value: k, label: v.label }))} />
          <h3>Mecanismo en tres pasos</h3>
          <StatusLine status="ilustracion" prefix="Mecanismo">descripción y dibujo 2D del intermediario; no es un cálculo.</StatusLine>
          <div className="btn-row">{steps.map((s, k) => <button key={k} type="button" className="btn small" aria-pressed={step === k} onClick={() => setStep(k)}>{s.t.split('.')[0]}</button>)}</div>
          <p aria-live="polite"><strong>{steps[step].t}.</strong> {steps[step].d}</p>
          {step === 1 && <StructureSvg mol={ion} title="Complejo σ (ion arenio), una de sus estructuras de resonancia" width={240} height={150} mode="esqueleto" desc="Anillo con un carbono sp³ que lleva el H y el electrófilo, y una carga positiva deslocalizada (se dibuja en un carbono)." />}
          {step === 1 && <p className="small muted">La carga + se muestra en un carbono, pero se reparte entre tres.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function AromaticsLab(props: LabProps) {
  const [station, setStation] = useState<Station>('benceno');
  return (
    <div className="stack">
      <Notice>
        <strong>Propósito:</strong> aprendes qué hace especial al anillo aromático (enlaces iguales, 4n + 2 electrones π, estabilidad que lo lleva a sustituir en vez de adicionar) al medir longitudes en confórmeros reales, contar electrones π en distintos anillos y comparar reacciones, y observar las longitudes, los orbitales de Hückel calculados, los nombres orto/meta/para y las propiedades publicadas.
      </Notice>
      <Segmented label="Estación" value={station} onChange={setStation} options={STATIONS} />
      {station === 'benceno' && <BenzeneStation {...props} />}
      {station === 'huckel' && <HuckelStation {...props} />}
      {station === 'derivados' && <DerivativesStation {...props} />}
      {station === 'sustitucion' && <SubstitutionStation />}
    </div>
  );
}


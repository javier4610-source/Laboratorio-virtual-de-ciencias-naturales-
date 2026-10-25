import { useMemo, useState } from 'react';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { Reaction3D } from '../chem';
import { FormulaSvg } from '../components/funcional/FormulaSvg';
import { BarCompare, IdeasPanel, Status, TubeBench } from '../components/funcional/FunctionalParts';
import { reaction3dDef } from '../components/funcional/reaction3dDefs';
import { baseShort, getFunc, shortCite } from '../data/quimica/funcionales';
import { ALCOHOL_COMBUSTION_SERIES, homologousCheck } from '../models/functionalProperties';
import { nameFunctionalSmiles } from '../models/functionalNomenclature';
import { parseSmiles } from '../models/organicGraph';
import {
  equationOf, esterEquilibrium, hessEnthalpy, K_ESTER, K_ESTER_SOURCE, markovnikovAddition, ORG_REACTIONS, oxidizeAlcohol, pretty, reactionById, RX_TYPE_LABEL, stoichiometry, type OrgReaction,
} from '../models/organicReactions';
import { fmt } from '../lib/format';
import { playSound } from '../lib/sound';
import type { LabProps } from './registry';

type Station = 'biblioteca' | 'esterificacion' | 'markovnikov' | 'oxidacion';
const STATIONS: { value: Station; label: string }[] = [
  { value: 'biblioteca', label: '1 · Reacciones en 3D' },
  { value: 'esterificacion', label: '2 · Esterificación' },
  { value: 'markovnikov', label: '3 · Markovnikov' },
  { value: 'oxidacion', label: '4 · Oxidación de alcoholes' },
];

const usesEthanol = (r: OrgReaction) => [...r.reactants, ...r.products].some((s) => s.dataId === 'etanol');
const HC = homologousCheck(ALCOHOL_COMBUSTION_SERIES);
const ETHANOL_CHECK = HC.find((x) => x.id === 'etanol')!;

/* ------------------------------------------------------------------ piezas */

function HessCard({ r }: { r: OrgReaction }) {
  const h = hessEnthalpy(r);
  const all = [...h.terms.reactants.map((t) => ({ ...t, side: 'Reactivo' })), ...h.terms.products.map((t) => ({ ...t, side: 'Producto' }))];
  return (
    <div className="card stack">
      <h3>Energía: ley de Hess con entalpías de combustión</h3>
      {h.available ? <Status status="modelo" prefix="ΔrH°">calculada con ΔcH° experimentales citados (PubChem/HSDB): ΔrH° = Σ ν·ΔcH°(reactivos) − Σ ν·ΔcH°(productos).</Status>
        : <Status status="sin-informacion" prefix="ΔrH°">{h.text}</Status>}
      {h.available && <p style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-data)' }}><strong>ΔrH° = {fmt(h.dH, 1)} kJ</strong> <span className="small muted">por la ecuación tal como está escrita ({h.dH! < 0 ? 'exotérmica: libera energía' : 'endotérmica: absorbe energía'})</span></p>}
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Términos de la ley de Hess">
        <table className="small">
          <caption className="sr-only">Entalpías de combustión usadas</caption>
          <thead><tr><th>Especie</th><th></th><th className="n">ν</th><th className="n">ΔcH° (kJ/mol)</th><th>Fuente</th></tr></thead>
          <tbody>{all.map((t, k) => (
            <tr key={k}><td>{t.name} ({pretty(t.formula)}){t.state ? `, ${t.state}` : ''}</td><td className="muted">{t.side}</td><td className="n">{t.coef}</td>
              <td className="n">{t.dHc === null ? '—' : fmt(t.dHc, 1)}</td>
              <td className="muted">{t.zeroByDefinition ? 'producto de la combustión: 0 por definición' : t.source ? <span title={`«${t.source.texto}»`}>{shortCite(t.source.cita)}, vía {baseShort(t.source.base)} · <a href={t.source.url} target="_blank" rel="noopener noreferrer">PUG View</a></span> : 'Sin información disponible'}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {h.available && usesEthanol(r) && (
        <div className="notice warn" role="status">
          <strong>Control de calidad del dato del etanol.</strong> PubChem (HSDB, citando el CRC Handbook, 95.ª ed.) da ΔcH°(etanol) = −1336,8 kJ/mol. En la serie de los 1-alcanoles cada CH₂ añade ≈ {fmt(HC.slope ?? 0, 0)} kJ/mol (recta robusta de la serie: mediana de las pendientes entre pares de alcoholes); esa recta predice ≈ {fmt(-ETHANOL_CHECK.predicted, 0)} kJ/mol para el etanol: el dato queda {fmt(Math.abs(ETHANOL_CHECK.residual), 0)} kJ/mol fuera, más de lo que se espera de un error de medición. Podría ser un error de transcripción; el laboratorio no lo corrige, pero este ΔrH° tiene esa incertidumbre{r.id === 'esterificacion' ? ' (mayor que el propio ΔrH°: con estos datos solo se puede decir que la esterificación es casi termoneutra)' : ''}.
        </div>
      )}
    </div>
  );
}

function StoichCard({ r, api }: { r: OrgReaction; api: LabProps['api'] }) {
  const key = r.reactants[r.keyReactant];
  const M = useMemo(() => stoichiometry(r, 1).rows[r.keyReactant].M, [r]);
  const [mass, setMass] = useState(M);
  const [eta, setEta] = useState(100);
  const m = Math.max(0.01, Math.min(1000, mass));
  const s = stoichiometry(r, m, eta);
  const prod = s.rows.filter((x) => x.side === 'p')[r.keyProduct];
  const h = hessEnthalpy(r);
  const ext = s.rows[r.keyReactant].mol / r.coefs[r.keyReactant];
  const record = () => api.addTrial('estequiometria', {
    reaccion: r.title, reactivo: key.name, masaReactivo: Number(m.toFixed(2)), rendimiento: eta, producto: prod.name,
    masaTeorica: Number(prod.mass.toFixed(3)), masaReal: Number(s.actualProduct.toFixed(3)), masaReactivos: Number(s.massIn.toFixed(3)), masaProductos: Number(s.massOut.toFixed(3)),
    energia: h.available ? Number((h.dH! * ext).toFixed(2)) : null,
  });
  return (
    <div className="card stack">
      <h3>Estequiometría</h3>
      <Status status="modelo" prefix="Masas">n = m/M con masas atómicas estándar (CIAAW); los demás reactivos en la cantidad justa.</Status>
      <Slider label={`Masa de ${key.name}`} value={m} min={0.1} max={1000} step={0.01} decimals={2} unit="g" onChange={setMass} />
      <Slider label="Rendimiento real" value={eta} min={0} max={100} step={1} decimals={0} unit="%" onChange={setEta} />
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Moles y masas de la reacción">
        <table className="small">
          <caption className="sr-only">Moles y masas de reactivos y productos</caption>
          <thead><tr><th>Especie</th><th className="n">ν</th><th className="n">M (g/mol)</th><th className="n">n (mol)</th><th className="n">m (g)</th></tr></thead>
          <tbody>{s.rows.map((x, k) => <tr key={k}><td>{x.side === 'r' ? '◂ ' : '▸ '}{x.name} ({pretty(x.formula)})</td><td className="n">{x.coef}</td><td className="n">{fmt(x.M, 3)}</td><td className="n">{fmt(x.mol, 4)}</td><td className="n">{fmt(x.mass, 2)}</td></tr>)}</tbody>
        </table>
      </div>
      <Readout items={[
        { k: 'Masa de reactivos', v: `${fmt(s.massIn, 2)} g`, data: true },
        { k: 'Masa de productos (100 %)', v: `${fmt(s.massOut, 2)} g`, data: true },
        { k: `${prod.name}: masa teórica`, v: `${fmt(prod.mass, 2)} g`, data: true },
        { k: `${prod.name}: masa real (${fmt(eta, 0)} %)`, v: `${fmt(s.actualProduct, 2)} g`, data: true },
        { k: 'Energía para esta cantidad', v: h.available ? `${fmt(h.dH! * ext, 1)} kJ` : 'Sin información disponible', data: true },
      ]} />
      <RecordButton onRecord={record} label="Guardar la estequiometría en la tabla" />
    </div>
  );
}

/* ------------------------------------------------------------------ 1 · biblioteca */

function LibraryStation({ api }: LabProps) {
  const [id, setId] = useState('combustion-metano');
  const r = reactionById(id);
  const def = useMemo(() => reaction3dDef(r), [r]);
  const types = [...new Set(ORG_REACTIONS.map((x) => x.type))];
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3 style={{ marginBottom: 0 }}>{r.title}</h3>
          <p className="small muted" style={{ margin: 0 }}><strong>{RX_TYPE_LABEL[r.type]}</strong> · {r.conditions}</p>
          <Reaction3D def={def} idPrefix="rxo-lib" height={320} />
        </div>
        <HessCard r={r} />
      </div>
      <div className="controls">
        <div className="card stack">
          <div className="field">
            <label htmlFor="rxo-sel">Reacción</label>
            <select id="rxo-sel" value={id} onChange={(e) => setId(e.target.value)}>
              {types.map((t) => <optgroup key={t} label={RX_TYPE_LABEL[t]}>{ORG_REACTIONS.filter((x) => x.type === t).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>)}
            </select>
          </div>
          <div className="readout" aria-live="polite">
            <div className="item" style={{ gridColumn: '1 / -1' }}><div className="k">Ecuación balanceada</div><div className="v data" style={{ whiteSpace: 'normal' }}>{equationOf(r)}</div></div>
            <div className="item" style={{ gridColumn: '1 / -1' }}><div className="k">Tipo de reacción</div><div className="v" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem' }}>{RX_TYPE_LABEL[r.type]}</div></div>
          </div>
          <p className="small" style={{ margin: 0 }}><strong>Enlaces:</strong> {r.bonds}</p>
          <p className="small" style={{ margin: 0 }}><strong>Idea clave:</strong> {r.idea}</p>
          {r.note && <div className="notice warn small" role="status"><strong>Seguridad:</strong> {r.note}</div>}
          <p className="small muted" style={{ margin: 0 }}>Coeficientes calculados con el método algebraico (balanceo por el espacio nulo de la matriz de composición), no escritos a mano.</p>
        </div>
        <StoichCard key={r.id} r={r} api={api} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2 · esterificación */

function EsterStation({ api }: LabProps) {
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [w0, setW0] = useState(0);
  const [e0, setE0] = useState(0);
  const eq = esterEquilibrium(a, b, e0, w0);
  const def = useMemo(() => reaction3dDef(reactionById('esterificacion')), []);
  const Mester = 88.106;
  const curve = { label: `Conversión del ácido (K = ${K_ESTER}; ácido 1 mol, sin agua)`, color: 'var(--series-1)', kind: 'line' as const, points: Array.from({ length: 50 }, (_, i) => { const r = 0.2 + i * 0.2; return { x: r, y: 100 * esterEquilibrium(1, r).x / 1 }; }) };
  const here = { label: 'Tu mezcla', color: 'var(--series-3)', kind: 'scatter' as const, points: a > 0 ? [{ x: b / a, y: 100 * eq.x / a }] : [] };
  const record = () => api.addTrial('esterificacion', { acido: a, alcohol: b, agua0: w0, ester0: e0, K: K_ESTER, conversion: Number((eq.conversion * 100).toFixed(3)), ester: Number(eq.ester.toFixed(4)), masaEster: Number((eq.ester * Mester).toFixed(2)) });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3 style={{ marginBottom: 0 }}>Esterificación de Fischer en 3D</h3>
          <p className="small muted" style={{ margin: 0 }}>Ácido acético + etanol ⇌ acetato de etilo + agua (catalizador: H⁺ del H₂SO₄).</p>
          <Reaction3D def={def} idPrefix="rxo-est" height={280} />
        </div>
        <div className="card stack">
          <h3>Conversión en el equilibrio según la proporción alcohol : ácido</h3>
          <Status status="modelo" prefix="Curva">K = (n éster · n agua)/(n ácido · n alcohol) = {K_ESTER}; se resuelve para cada mezcla inicial.</Status>
          <Chart series={[curve, here]} xLabel="Moles de etanol por mol de ácido" yLabel="Ácido convertido en éster" yUnit="%" title="Rendimiento de equilibrio de la esterificación" exportName="esterificacion-rendimiento" height={260} yDomain={[0, 100]} />
          <p className="small muted" style={{ margin: 0 }}>Principio de Le Châtelier: un exceso de etanol (o retirar el agua a medida que se forma) desplaza el equilibrio hacia el éster; agregar agua lo desplaza hacia los reactivos (hidrólisis).</p>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Status status="experimental" prefix="K">{K_ESTER_SOURCE}</Status>
          <Slider label="Ácido acético inicial" value={a} min={0} max={5} step={0.1} decimals={1} unit="mol" onChange={setA} />
          <Slider label="Etanol inicial" value={b} min={0} max={5} step={0.1} decimals={1} unit="mol" onChange={setB} />
          <Slider label="Agua inicial" value={w0} min={0} max={5} step={0.1} decimals={1} unit="mol" onChange={setW0} />
          <Slider label="Acetato de etilo inicial" value={e0} min={0} max={5} step={0.1} decimals={1} unit="mol" onChange={setE0} />
          <Readout items={[
            { k: 'Sentido inicial (Q₀ frente a K)', v: eq.direction },
            { k: 'Ácido que reacciona (conversión)', v: `${fmt(eq.conversion * 100, 1)} %`, data: true },
            { k: 'Éster en el equilibrio', v: `${fmt(eq.ester, 3)} mol = ${fmt(eq.ester * Mester, 1)} g`, data: true },
            { k: 'Agua en el equilibrio', v: `${fmt(eq.water, 3)} mol`, data: true },
            { k: 'Ácido / alcohol que quedan', v: `${fmt(eq.acid, 3)} / ${fmt(eq.alcohol, 3)} mol`, data: true },
          ]} />
          <RecordButton onRecord={record} label="Guardar el equilibrio en la tabla" disabled={a + e0 === 0 || b + w0 === 0} />
          <BarCompare idPrefix="rxo-comp" unit="mol" decimals={2} title="Composición en el equilibrio" items={[
            { label: 'Ácido acético', value: eq.acid, color: 'var(--series-2)' }, { label: 'Etanol', value: eq.alcohol, color: 'var(--series-1)' },
            { label: 'Acetato de etilo', value: eq.ester, color: 'var(--series-3)' }, { label: 'Agua', value: eq.water, color: 'var(--series-6)' },
          ]} />
          <p className="small muted" style={{ margin: 0 }}>Caso de referencia: 1 mol + 1 mol → 0,667 mol de éster (2/3); con 3 mol de etanol → 0,903 mol.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 · Markovnikov */

const ALKENES = [
  { value: 'C=CC', label: 'Propeno (CH₂=CH–CH₃)' }, { value: 'C=CCC', label: 'But-1-eno' }, { value: 'C=C(C)C', label: '2-Metilpropeno' },
  { value: 'CC=CC', label: 'But-2-eno (simétrico)' }, { value: 'C=Cc1ccccc1', label: 'Estireno (etenilbenceno)' }, { value: 'CC=C(C)C', label: '2-Metilbut-2-eno' },
];

function MarkovnikovStation() {
  const [alk, setAlk] = useState('C=CC');
  const [reag, setReag] = useState<'HBr' | 'HCl' | 'H2O'>('HBr');
  const [peroxide, setPeroxide] = useState(false);
  const res = useMemo(() => markovnikovAddition(alk, reag), [alk, reag]);
  const alkMol = useMemo(() => parseSmiles(alk), [alk]);
  const alkName = useMemo(() => { const n = nameFunctionalSmiles(alk); return n.ok ? n.es : alk; }, [alk]);
  const show3d = alk === 'C=CC' && reag !== 'HCl';
  const rx3d = reag === 'H2O' ? 'hidratacion' : peroxide ? 'hbr-antimarkovnikov' : 'hbr-markovnikov';
  const def = useMemo(() => reaction3dDef(reactionById(rx3d)), [rx3d]);
  const major = peroxide && reag === 'HBr' && res.minor ? res.minor : res.major;
  const minor = peroxide && reag === 'HBr' && res.minor ? res.major : res.minor;
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>{alkName} + {pretty(reag)}{peroxide && reag === 'HBr' ? ' (con peróxidos)' : ''}</h3>
          <Status status="modelo" prefix="Producto">regla aplicada al grafo de la molécula y nombrada por el motor del laboratorio; predice el producto principal, no las proporciones.</Status>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="stack-sm">
              <FormulaSvg mol={alkMol} mode="condensada" title={`Alqueno: ${alkName}`} height={150} />
              <p className="small" style={{ margin: 0, textAlign: 'center' }}>Alqueno: <strong>{alkName}</strong></p>
            </div>
            <div className="stack-sm">
              <FormulaSvg mol={major.mol} mode="condensada" title={`Producto principal: ${major.name}`} height={150} />
              <p className="small" style={{ margin: 0, textAlign: 'center' }}>Producto principal: <strong>{major.name}</strong> ({pretty(major.formula)})</p>
            </div>
          </div>
          {minor && <p className="small muted" style={{ margin: 0 }}>Producto minoritario (orientación contraria): {minor.name}.</p>}
          <p className="small" style={{ margin: 0 }}>{peroxide && reag === 'HBr' ? 'Con peróxidos, el HBr se adiciona por radicales: el Br• se une primero al carbono con más H, para dejar el radical más estable; el resultado es la orientación anti-Markovnikov.' : res.rule}</p>
        </div>
        {show3d && (
          <div className="card stack">
            <h3>En 3D: {reactionById(rx3d).title}</h3>
            <Reaction3D def={def} idPrefix="rxo-mk" height={280} />
          </div>
        )}
        {!show3d && <p className="small muted">La animación 3D está disponible para el propeno con HBr o con agua (son las especies con confórmero en la biblioteca).</p>}
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Alqueno" value={alk} onChange={setAlk} options={ALKENES} />
          <Segmented label="Reactivo" value={reag} onChange={(v) => { setReag(v); if (v !== 'HBr') setPeroxide(false); }} options={[{ value: 'HBr', label: 'HBr' }, { value: 'HCl', label: 'HCl' }, { value: 'H2O', label: 'H₂O (con ácido)' }]} />
          <label className="check small"><input type="checkbox" checked={peroxide} disabled={reag !== 'HBr'} onChange={(e) => setPeroxide(e.target.checked)} /> Con peróxidos (solo HBr)</label>
          <p className="small" style={{ margin: 0 }}><strong>Regla de Markovnikov (1870):</strong> en la adición de HX a un alqueno asimétrico, el H se une al carbono del doble enlace que ya tiene más hidrógenos. Hoy se explica por la estabilidad del carbocatión intermedio: terciario &gt; secundario &gt; primario.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 4 · oxidación */

const ALCOHOLS = [
  { id: 'metanol', rx: 'oxidacion-metanol' }, { id: 'etanol', rx: 'oxidacion-etanol' }, { id: 'propan-1-ol', rx: 'oxidacion-propan1ol' }, { id: 'butan-1-ol' },
  { id: 'propan-2-ol', rx: 'oxidacion-propan2ol' }, { id: 'butan-2-ol' }, { id: 'ciclohexanol' }, { id: '2-metilpropan-2-ol' },
];

function OxidationStation() {
  const [id, setId] = useState('etanol');
  const [added, setAdded] = useState(false);
  const rec = getFunc(id);
  const path = useMemo(() => oxidizeAlcohol(rec.smiles), [rec.smiles]);
  const mol = useMemo(() => parseSmiles(rec.smiles), [rec.smiles]);
  const nm = nameFunctionalSmiles(rec.smiles);
  const rxId = ALCOHOLS.find((x) => x.id === id)?.rx;
  const def = useMemo(() => (rxId ? reaction3dDef(reactionById(rxId)) : null), [rxId]);
  const oxidizable = path.steps.length > 0;
  const outcome = { positive: oxidizable, observation: oxidizable ? 'El naranja del dicromato pasa a verde (Cr³⁺).' : 'La disolución sigue naranja.', explanation: '', look: { liquid: added && oxidizable ? '#3f8f5a' : '#e07b1f' } };
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>{nm.ok ? nm.es : rec.nombre}: alcohol {path.degree}</h3>
          <Status status="modelo" prefix="Productos">regla de oxidación según la clase del alcohol, aplicada al grafo y nombrada por el motor del laboratorio.</Status>
          <div className="rxo-path" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <figure style={{ margin: 0, flex: '1 1 180px' }}>
              <FormulaSvg mol={mol} mode="condensada" title={`Alcohol: ${nm.ok ? nm.es : rec.nombre}`} height={130} />
              <figcaption className="small" style={{ textAlign: 'center' }}><strong>{nm.ok ? nm.es : rec.nombre}</strong></figcaption>
            </figure>
            {path.steps.map((s, k) => (
              <div key={k} style={{ display: 'contents' }}>
                <span aria-hidden="true" style={{ fontSize: 28, color: 'var(--accent)' }}>→</span>
                <figure style={{ margin: 0, flex: '1 1 180px' }}>
                  <FormulaSvg mol={s.mol} mode="condensada" title={`${s.kind === 'acido' ? 'Ácido carboxílico' : s.kind === 'aldehido' ? 'Aldehído' : 'Cetona'}: ${s.name}`} height={130} />
                  <figcaption className="small" style={{ textAlign: 'center' }}>{s.kind === 'acido' ? 'ácido' : s.kind === 'aldehido' ? 'aldehído' : 'cetona'}: <strong>{s.name}</strong></figcaption>
                </figure>
              </div>
            ))}
            {!oxidizable && <p className="small" style={{ flex: '1 1 200px', margin: 0 }}><strong>No se oxida</strong> en condiciones suaves.</p>}
          </div>
          <p className="small" style={{ margin: 0 }}>{path.text}</p>
        </div>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Prueba con dicromato de potasio (K₂Cr₂O₇ en ácido)</h3>
          <Status status="ilustracion" prefix="Color">resultado esperado según la bibliografía (Shriner et al., 2004): el Cr(VI) naranja se reduce a Cr(III) verde si el alcohol se oxida.</Status>
          <div className="bench"><TubeBench idPrefix="rxo-dicr" adding={added} tube={{ label: nm.ok ? nm.es : rec.nombre, reagent: 'K₂Cr₂O₇ / H₂SO₄', short: 'K₂Cr₂O₇', outcome: added ? outcome : null }} /></div>
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={added} onClick={() => { setAdded(true); playSound(oxidizable ? 'confirm' : 'click'); }}>Agregar el dicromato y calentar</button>
            <button type="button" className="btn ghost small" disabled={!added} onClick={() => setAdded(false)}>Tubo nuevo</button>
          </div>
          <p aria-live="polite" className="small" style={{ margin: 0 }}>{added ? <><strong>{oxidizable ? 'Se oxida.' : 'No se oxida.'}</strong> {outcome.observation}</> : 'Agrega el reactivo para ver el resultado esperado.'}</p>
        </div>
        {def && (
          <div className="card stack">
            <h3>En 3D: {reactionById(rxId!).title}</h3>
            <Reaction3D def={def} idPrefix="rxo-ox" height={280} />
          </div>
        )}
        {rxId && <HessCard r={reactionById(rxId)} />}
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Alcohol" value={id} onChange={(v) => { setId(v); setAdded(false); }} options={ALCOHOLS.map((x) => ({ value: x.id, label: getFunc(x.id).nombre }))} />
          <p className="small muted" style={{ margin: 0 }}>Las ecuaciones con O₂ resumen el cambio del compuesto orgánico; el dicromato es tóxico y cancerígeno: en el colegio se reemplaza por demostraciones o por este simulador.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ laboratorio */

const IDEAS = [
  { id: 'r1', text: 'En una reacción química desaparecen algunos átomos y aparecen otros nuevos.', answer: 'falso' as const, feedback: 'En cada animación 3D la tabla de conteo muestra los mismos átomos de cada elemento antes, durante y después: solo se rompen y forman enlaces. Por eso la masa se conserva.' },
  { id: 'r2', text: 'La esterificación llega siempre al 100 % si se espera suficiente tiempo.', answer: 'falso' as const, feedback: 'Es un equilibrio: con 1 mol de ácido y 1 de alcohol se forman 0,67 mol de éster como máximo (K ≈ 4). El tiempo y el catalizador solo hacen que se llegue antes al equilibrio.' },
  { id: 'r3', text: 'Al adicionar HBr al propeno, el Br puede ir a cualquier carbono con la misma probabilidad.', answer: 'falso' as const, feedback: 'Sin peróxidos el producto principal es el 2-bromopropano (regla de Markovnikov), porque el carbocatión secundario es más estable que el primario.' },
  { id: 'r4', text: 'Todos los alcoholes se oxidan con dicromato.', answer: 'falso' as const, feedback: 'Los terciarios, como el 2-metilpropan-2-ol, no tienen H en el carbono del –OH y no se oxidan en condiciones suaves: el dicromato sigue naranja.' },
  { id: 'r5', text: 'La animación 3D muestra cómo se mueven realmente los átomos durante la reacción.', answer: 'falso' as const, feedback: 'Es una ilustración: interpola entre las geometrías de reactivos y productos. El mecanismo real pasa por intermedios y estados de transición que no se dibujan.' },
];

export default function OrganicReactionsLab(props: LabProps) {
  const [station, setStation] = useState<Station>('biblioteca');
  return (
    <div className="stack">
      <Notice>
        <strong>Propósito:</strong> aprendes a clasificar las reacciones orgánicas (combustión, sustitución, adición, oxidación, condensación, hidrólisis, sustitución aromática y fermentación), a balancearlas y calcular masas y energías con datos citados, y a predecir productos con las reglas de Markovnikov y de oxidación, al animarlas en 3D, cambiar cantidades y comparar resultados.
      </Notice>
      <Segmented label="Estación" value={station} onChange={setStation} options={STATIONS} />
      {station === 'biblioteca' && <LibraryStation {...props} />}
      {station === 'esterificacion' && <EsterStation {...props} />}
      {station === 'markovnikov' && <MarkovnikovStation />}
      {station === 'oxidacion' && <OxidationStation />}
      <IdeasPanel idPrefix="rxo" ideas={IDEAS} intro="Ideas frecuentes sobre las reacciones orgánicas. Decide y compruébalo en las estaciones." />
    </div>
  );
}

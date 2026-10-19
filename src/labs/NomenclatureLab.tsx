import { useEffect, useMemo, useRef, useState } from 'react';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { StructureSvg } from '../components/organica/StructureSvg';
import { OrganicViewer3D } from '../components/organica/OrganicViewer3D';
import { StatusLine } from '../components/organica/OrganicParts';
import {
  buildMolecule, canAddSub, canSetBond, emptyState, freeValence, resizeState, stereoPossible, SUBSTITUENTS, substituentById, type BuilderState, type Skeleton,
} from '../models/organicBuilder';
import { canonicalKey, hillFormula, mapHeavyAtoms, molFromMolfile, parseSmiles, stripHydrogens, toSmiles, type OMolecule } from '../models/organicGraph';
import { nameMolecule, normalizeName, type NameOk } from '../models/organicNomenclature';
import { speciesFromSdf, type Atom3D, type Bond3D } from '../chem';
import { fmt } from '../lib/format';
import { playSound } from '../lib/sound';
import type { LabProps } from './registry';

type Tab = 'constructor' | 'ejercicio' | 'reglas' | 'validacion';
const TABS: { value: Tab; label: string }[] = [
  { value: 'constructor', label: '1 · Constructor' },
  { value: 'ejercicio', label: '2 · Del nombre a la estructura' },
  { value: 'reglas', label: '3 · Errores frecuentes' },
  { value: 'validacion', label: '4 · Comparación con PubChem' },
];

/* ------------------------------------------------------------------ confórmeros (carga diferida) */

interface ConfRec { cid: number; sdf: string; smiles: string; nombreIupac: string; url: string; fecha: string; sha256: string; title: string }
let confPromise: Promise<{ list: ConfRec[]; byKey: Map<string, ConfRec> }> | null = null;
function loadConformers() {
  if (!confPromise) {
    confPromise = import('../data/quimica/organica-nomenclatura.json').then((m) => {
      const list = (m.default as unknown as { conformeros: ConfRec[] }).conformeros;
      const byKey = new Map<string, ConfRec>();
      for (const c of list) { try { byKey.set(canonicalKey(parseSmiles(c.smiles), true), c); } catch { /* SMILES fuera del lector */ } }
      return { list, byKey };
    });
    confPromise.catch(() => { confPromise = null; });
  }
  return confPromise;
}

type Geo = { kind: 'none' } | { kind: 'loading' } | { kind: 'ok'; atoms: Atom3D[]; bonds: Bond3D[]; labels: (string | undefined)[]; highlight: number[]; cid: number; url: string; fecha: string; origin: 'incluido' | 'en vivo' }
  | { kind: 'missing'; reason: string };

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
async function fetchLive(smiles: string, signal: AbortSignal): Promise<{ cid: number; sdf: string; url: string } | string> {
  const r = await fetch(`${PUG}/compound/smiles/cids/TXT`, { method: 'POST', body: new URLSearchParams({ smiles }), signal });
  if (!r.ok) return `PubChem respondió ${r.status} al buscar la estructura.`;
  const cid = Number((await r.text()).trim().split(/\s+/)[0]);
  if (!cid) return 'PubChem no tiene registrada esta estructura (CID 0): no hay confórmero que mostrar.';
  const url = `${PUG}/compound/cid/${cid}/SDF?record_type=3d`;
  const s = await fetch(url, { signal });
  if (s.status === 404) return `PubChem tiene la estructura (CID ${cid}) pero no un confórmero 3D.`;
  if (!s.ok) return `PubChem respondió ${s.status} al pedir el confórmero.`;
  const sdf = await s.text();
  if (sdf.length > 200_000) return 'La respuesta de PubChem es demasiado grande.';
  return { cid, sdf, url };
}

function geometryFor(mol: OMolecule, nm: NameOk, rec: { sdf: string; cid: number; url: string; fecha: string }, origin: 'incluido' | 'en vivo'): Geo {
  const sp = speciesFromSdf(rec.sdf, { id: `nom-${rec.cid}`, name: nm.es, label: '', geometry: 'pubchem', geometryLabel: '', method: '' });
  const { mol: full } = molFromMolfile(rec.sdf);
  const { mol: heavy, index } = stripHydrogens(full);
  const map = mapHeavyAtoms(mol, heavy);
  if (!map) return { kind: 'missing', reason: 'El confórmero no coincide átomo a átomo con la estructura; no se muestra.' };
  const labels: (string | undefined)[] = sp.atoms.map(() => undefined);
  const highlight: number[] = [];
  for (const [atom, loc] of nm.locants) { const sdfIdx = index[map[atom]]; labels[sdfIdx] = String(loc); highlight.push(sdfIdx); }
  if (nm.parent.kind === 'benceno' && nm.substituents.length === 0) labels.fill(undefined);
  return { kind: 'ok', atoms: sp.atoms, bonds: sp.bonds, labels, highlight, cid: rec.cid, url: rec.url, fecha: rec.fecha, origin };
}

/* ------------------------------------------------------------------ editor del constructor */

function Editor({ state, setState, pos, setPos, idp }: { state: BuilderState; setState: (s: BuilderState) => void; pos: number; setPos: (p: number) => void; idp: string }) {
  const sk = state.skeleton;
  const n = sk.kind === 'benceno' ? 6 : sk.n;
  const [subId, setSubId] = useState('metil');
  const setSkeleton = (k: Skeleton) => { setState(resizeState(state, k)); setPos(0); };
  const p = Math.min(pos, n - 1);
  const bondIdx = sk.kind === 'cadena' ? (p < n - 1 ? p : -1) : sk.kind === 'anillo' ? p : -1;
  const next = sk.kind === 'anillo' ? ((p + 1) % n) + 1 : p + 2;
  const setBond = (o: 1 | 2 | 3) => {
    if (bondIdx < 0) return;
    const s = structuredClone(state); s.bondOrders[bondIdx] = o; if (o !== 2) delete s.stereo[bondIdx];
    setState(s); playSound('click', { intensity: 0.4 });
  };
  const add = () => { if (!canAddSub(state, p, subId)) return; const s = structuredClone(state); s.subs[p] = [...s.subs[p], subId]; setState(s); playSound('click', { intensity: 0.5 }); };
  const remove = (k: number) => { const s = structuredClone(state); s.subs[p] = s.subs[p].filter((_, i) => i !== k); setState(s); };
  const built = buildMolecule(state);
  const stereoOk = bondIdx >= 0 && stereoPossible(state, bondIdx, built.mol, built.skeletonAtoms);
  const groups = [...new Set(SUBSTITUENTS.map((x) => x.group))];
  return (
    <div className="stack">
      <Segmented label="Esqueleto" value={sk.kind} onChange={(k) => setSkeleton(k === 'benceno' ? { kind: 'benceno' } : { kind: k, n: k === 'anillo' ? 6 : 5 })}
        options={[{ value: 'cadena', label: 'Cadena' }, { value: 'anillo', label: 'Anillo' }, { value: 'benceno', label: 'Benceno' }]} />
      {sk.kind !== 'benceno' && (
        <Slider label={sk.kind === 'cadena' ? 'Carbonos de la cadena dibujada' : 'Carbonos del anillo'} value={sk.n} min={sk.kind === 'cadena' ? 1 : 3} max={sk.kind === 'cadena' ? 12 : 8} step={1} decimals={0}
          onChange={(v) => setSkeleton({ kind: sk.kind, n: v })} />
      )}
      <Select label="Posición del constructor" value={String(p)} onChange={(v) => setPos(Number(v))} options={Array.from({ length: n }, (_, i) => ({ value: String(i), label: `Carbono ${i + 1} (${freeValence(state, i) === 1 ? 'queda 1 enlace libre' : `quedan ${freeValence(state, i)} enlaces libres`})` }))} />
      {bondIdx >= 0 && (
        <div className="field">
          <span className="small" style={{ fontWeight: 600 }} id={`${idp}-bl`}>Enlace entre el carbono {p + 1} y el {next}</span>
          <div className="seg" role="group" aria-labelledby={`${idp}-bl`}>
            {([1, 2, 3] as const).map((o) => (
              <button key={o} type="button" aria-pressed={state.bondOrders[bondIdx] === o} disabled={state.bondOrders[bondIdx] !== o && !canSetBond(state, bondIdx, o)} onClick={() => setBond(o)}>
                {o === 1 ? 'Sencillo' : o === 2 ? 'Doble' : 'Triple'}
              </button>
            ))}
          </div>
        </div>
      )}
      {stereoOk && (
        <Segmented label={`Doble enlace ${p + 1}–${next}: posición de los grupos de la cadena`} value={state.stereo[bondIdx] ?? 'sin'}
          onChange={(v) => { const s = structuredClone(state); if (v === 'sin') delete s.stereo[bondIdx]; else s.stereo[bondIdx] = v as 'cis' | 'trans'; setState(s); }}
          options={[{ value: 'sin', label: 'Sin indicar' }, { value: 'cis', label: 'Mismo lado (cis)' }, { value: 'trans', label: 'Lados opuestos (trans)' }]} />
      )}
      <div className="field">
        <label htmlFor={`${idp}-sub`}>Sustituyente para el carbono {p + 1}</label>
        <select id={`${idp}-sub`} value={subId} onChange={(e) => setSubId(e.target.value)}>
          {groups.map((g) => <optgroup key={g} label={g}>{SUBSTITUENTS.filter((x) => x.group === g).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>)}
        </select>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={add} disabled={!canAddSub(state, p, subId)}>Agregar al carbono {p + 1}</button>
      </div>
      {!canAddSub(state, p, subId) && <p className="small muted">El carbono {p + 1} ya tiene sus cuatro enlaces ocupados para ese grupo.</p>}
      {state.subs[p].length > 0 && (
        <ul className="list" style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }} aria-label={`Sustituyentes del carbono ${p + 1}`}>
          {state.subs[p].map((id, k) => (
            <li key={k} className="btn-row small">{substituentById(id)?.label}<button type="button" className="btn small ghost" onClick={() => remove(k)} aria-label={`Quitar ${substituentById(id)?.label} del carbono ${p + 1}`}>Quitar</button></li>
          ))}
        </ul>
      )}
      <button type="button" className="btn small ghost" onClick={() => { setState(emptyState(sk)); setPos(0); }}>Vaciar la estructura</button>
    </div>
  );
}

/* ------------------------------------------------------------------ vista del nombre */

function NameView({ state, idp, show3d = true, reveal = true }: { state: BuilderState; idp: string; show3d?: boolean; reveal?: boolean }) {
  const built = useMemo(() => buildMolecule(state), [state]);
  const mol = built.mol;
  const nm = useMemo(() => (mol ? nameMolecule(mol) : null), [mol]);
  const [mode, setMode] = useState<'esqueleto' | 'condensada'>('esqueleto');
  const [numbersSel, setNumbers] = useState<'iupac' | 'constructor'>('iupac');
  const numbers = reveal ? numbersSel : 'constructor';
  const [geo, setGeo] = useState<Geo>({ kind: 'none' });
  const keyNow = mol ? canonicalKey(mol, true) : '';
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { setGeo({ kind: 'none' }); abort.current?.abort(); }, [keyNow]);
  const tags = useMemo(() => new Map(built.skeletonAtoms.map((a, i) => [a, String(i + 1)])), [built.skeletonAtoms]);
  const okFull = nm && nm.ok ? nm : null;
  const ok = reveal ? okFull : null;
  const show3D = async () => {
    if (!mol || !ok) return;
    setGeo({ kind: 'loading' });
    try {
      const { byKey } = await loadConformers();
      const hit = byKey.get(keyNow);
      if (hit) { setGeo(geometryFor(mol, ok, hit, 'incluido')); return; }
      setGeo({ kind: 'missing', reason: 'No está entre los confórmeros incluidos en el laboratorio (funcionan sin conexión).' });
    } catch { setGeo({ kind: 'missing', reason: 'No se pudieron cargar los confórmeros incluidos.' }); }
  };
  const searchLive = async () => {
    if (!mol || !ok) return;
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    const timer = setTimeout(() => ac.abort(), 15_000);
    setGeo({ kind: 'loading' });
    try {
      const res = await fetchLive(toSmiles(mol), ac.signal);
      if (typeof res === 'string') setGeo({ kind: 'missing', reason: res });
      else setGeo(geometryFor(mol, ok, { ...res, fecha: new Date().toISOString().slice(0, 10) }, 'en vivo'));
    } catch { setGeo({ kind: 'missing', reason: 'Servicio no disponible: no hay conexión con PubChem o tardó más de 15 s. No se muestra ninguna geometría inventada.' }); }
    finally { clearTimeout(timer); }
  };
  if (!mol) return <Notice kind="bad">{built.errors.join(' ')}</Notice>;
  return (
    <div className="stack">
      <div className="card stack">
        {!reveal ? <p className="small muted" style={{ margin: 0 }}>Tu estructura (el nombre se muestra al pulsar «Comprobar mi estructura»). Los números grises son las posiciones del constructor.</p> : ok ? (
          <>
            <p className="eyebrow" style={{ margin: 0 }}>Nombre IUPAC (Recomendaciones 2013)</p>
            <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, overflowWrap: 'anywhere' }} aria-live="polite" id={`${idp}-nombre`}>{ok.es}</p>
            <p className="small muted" style={{ margin: 0 }}>En inglés: {ok.en}{ok.sistematico ? ` · sistemático: ${ok.sistematico.es}` : ''}{ok.retenido && !ok.sistematico ? ` · nombre común aceptado: ${ok.retenido.es}` : ''}</p>
          </>
        ) : <Notice kind="warn">Sin información disponible: {nm && !nm.ok ? nm.motivo : ''}</Notice>}
        <StructureSvg mol={mol} mode={mode} mainChain={ok && ok.parent.kind === 'cadena' ? ok.parent.atoms : undefined} title={`Fórmula estructural de ${ok?.es ?? 'la estructura'}`} highlight={ok?.parent.atoms} locants={numbers === 'iupac' ? ok?.locants : undefined} tags={numbers === 'constructor' ? tags : undefined} height={230} />
        <StatusLine status="ilustracion" prefix="Dibujo 2D">{numbers === 'iupac' ? 'resaltados en color, la cadena o el anillo principal y su numeración IUPAC calculada por el motor (modelo calculado).' : 'los números grises son las posiciones del constructor, no los localizadores IUPAC.'}</StatusLine>
 <div className="btn-row" style={{ gap: 16 }}>
          <Segmented label="Dibujo" value={mode} onChange={setMode} options={[{ value: 'esqueleto', label: 'Esqueleto' }, { value: 'condensada', label: 'Con H' }]} />
          {reveal && <Segmented label="Números" value={numbers} onChange={setNumbers} options={[{ value: 'iupac', label: 'Localizadores IUPAC' }, { value: 'constructor', label: 'Posiciones del constructor' }]} />}
        </div>
        {ok?.avisos.map((a) => <Notice key={a} kind="info">{a}</Notice>)}
      </div>
      {ok && (
        <div className="card stack">
          <h3>Paso a paso</h3>
          <ol className="list">{ok.pasos.map((s) => <li key={s.titulo}><strong>{s.titulo.replace(/^\d\.\s*/, '')}.</strong> {s.texto}</li>)}</ol>
          <Readout items={[
            { k: 'Fórmula molecular', v: hillFormula(mol, true), data: true },
            { k: 'Clase', v: ok.clase },
            { k: 'Carbonos de la cadena o anillo principal', v: String(ok.parent.size), data: true },
            { k: 'SMILES', v: <code style={{ overflowWrap: 'anywhere' }}>{toSmiles(mol)}</code> },
          ]} />
        </div>
      )}
      {show3d && ok && (
        <div className="card stack">
          <h3>Estructura en 3D</h3>
          {geo.kind === 'none' && <div className="btn-row"><button type="button" className="btn" onClick={show3D}>Ver en 3D</button><span className="small muted">Busca un confórmero calculado por PubChem; el laboratorio no inventa geometrías.</span></div>}
          {geo.kind === 'loading' && <p className="small muted" aria-live="polite">Buscando el confórmero…</p>}
          {geo.kind === 'missing' && (
            <>
              <Notice kind="info">Sin geometría 3D: {geo.reason} El laboratorio no calcula geometrías propias (RDKit.js MinimalLib 2026.9.1 no incluye incrustación 3D ni campos de fuerza), así que esta estructura se muestra solo en 2D.</Notice>
              <div className="btn-row"><button type="button" className="btn small" onClick={searchLive}>Buscar en PubChem (requiere conexión)</button></div>
            </>
          )}
          {geo.kind === 'ok' && (
            <OrganicViewer3D atoms={geo.atoms} bonds={geo.bonds} idPrefix={`${idp}-3d`} viewKey={keyNow} status="modelo" statusPrefix="Geometría" labels={geo.labels} highlight={geo.highlight}
              provenance={<>confórmero 3D calculado por PubChem (OMEGA + MMFF94s; predicción computacional), <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${geo.cid}`} target="_blank" rel="noopener noreferrer">CID {geo.cid}</a>, {geo.origin === 'incluido' ? `incluido en el laboratorio (descargado el ${geo.fecha})` : `descargado ahora (${geo.fecha})`}. Los números son los localizadores IUPAC.</>}
              ariaLabel={`Modelo 3D de ${ok.es} con los localizadores de la cadena principal`} styleLabel="Estilo del modelo 3D del constructor" />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ ejercicios */

const mk = (sk: Skeleton, f: (s: BuilderState) => void): BuilderState => { const s = emptyState(sk); f(s); return s; };
const EXERCISES: BuilderState[] = [
  mk({ kind: 'cadena', n: 5 }, (s) => { s.subs[2] = ['metil']; }),
  mk({ kind: 'cadena', n: 6 }, (s) => { s.subs[1] = ['metil']; s.subs[3] = ['metil']; }),
  mk({ kind: 'cadena', n: 5 }, (s) => { s.subs[2] = ['etil']; s.subs[1] = ['metil']; }),
  mk({ kind: 'cadena', n: 4 }, (s) => { s.subs[1] = ['metil', 'metil']; s.subs[2] = ['metil']; }),
  mk({ kind: 'cadena', n: 5 }, (s) => { s.bondOrders[1] = 2; s.stereo[1] = 'trans'; }),
  mk({ kind: 'cadena', n: 4 }, (s) => { s.bondOrders[0] = 2; s.bondOrders[2] = 2; }),
  mk({ kind: 'cadena', n: 6 }, (s) => { s.bondOrders[0] = 3; s.subs[3] = ['metil']; }),
  mk({ kind: 'cadena', n: 5 }, (s) => { s.bondOrders[0] = 2; s.bondOrders[3] = 3; }),
  mk({ kind: 'cadena', n: 7 }, (s) => { s.subs[3] = ['isopropil']; }),
  mk({ kind: 'anillo', n: 6 }, (s) => { s.subs[0] = ['metil']; s.subs[2] = ['etil']; }),
  mk({ kind: 'anillo', n: 6 }, (s) => { s.bondOrders[0] = 2; s.subs[2] = ['metil']; }),
  mk({ kind: 'benceno' }, (s) => { s.subs[0] = ['Br']; s.subs[2] = ['Cl']; }),
  mk({ kind: 'cadena', n: 4 }, (s) => { s.subs[0] = ['Br']; s.subs[2] = ['metil']; }),
  mk({ kind: 'cadena', n: 3 }, (s) => { s.subs[1] = ['Cl', 'Cl']; }),
];

function diagnose(target: OMolecule, mine: OMolecule): string[] {
  const t = nameMolecule(target), m = nameMolecule(mine);
  const out: string[] = [];
  if (hillFormula(target) !== hillFormula(mine)) out.push(`Tu estructura es ${hillFormula(mine, true)} y la pedida es ${hillFormula(target, true)}: revisa cuántos carbonos, halógenos y enlaces múltiples tiene.`);
  else out.push('Tienes la fórmula molecular correcta, pero los átomos están conectados de otra forma: es un isómero.');
  if (t.ok && m.ok) {
    if (t.parent.size !== m.parent.size) out.push(`La cadena (o anillo) principal de tu estructura tiene ${m.parent.size} carbonos; la del nombre pedido, ${t.parent.size}. Recuerda que la cadena principal es la más larga, aunque en tu dibujo esté «doblada».`);
    if (t.multiples.length !== m.multiples.length) out.push(`El nombre pedido tiene ${t.multiples.length} enlace(s) múltiple(s) en la cadena principal; tu estructura, ${m.multiples.length}.`);
    out.push(`Tu estructura se llama «${m.es}».`);
  }
  return out;
}

function ExerciseTab({ api }: LabProps) {
  const [k, setK] = useState(0);
  const [state, setState] = useState<BuilderState>(emptyState({ kind: 'cadena', n: 5 }));
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [tries, setTries] = useState(0);
  const target = useMemo(() => buildMolecule(EXERCISES[k]).mol!, [k]);
  const tName = nameMolecule(target);
  const check = () => {
    const mine = buildMolecule(state).mol;
    if (!mine) { setResult({ ok: false, lines: ['La estructura tiene errores de valencia.'] }); return; }
    const ok = canonicalKey(mine, true) === canonicalKey(target, true);
    const n = tries + 1; setTries(n);
    setResult(ok ? { ok, lines: [`Correcto: tu estructura es ${tName.ok ? tName.es : ''}.${n > 1 ? ` Lo lograste en ${n} intentos.` : ''}`] } : { ok, lines: diagnose(target, mine) });
    playSound(ok ? 'confirm' : 'error');
    api.addTrial('ejercicios', { objetivo: tName.ok ? tName.es : '', intento: nameMolecule(mine).ok ? (nameMolecule(mine) as NameOk).es : '—', correcto: ok ? 1 : 0, intentos: n });
  };
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <p className="eyebrow" style={{ margin: 0 }}>Ejercicio {k + 1} de {EXERCISES.length}: construye</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }} id="nom-objetivo">{tName.ok ? tName.es : ''}</p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={check}>Comprobar mi estructura</button>
            <button type="button" className="btn ghost" onClick={() => { setK((k + 1) % EXERCISES.length); setResult(null); setTries(0); setState(emptyState({ kind: 'cadena', n: 5 })); setPos(0); }}>Siguiente ejercicio</button>
          </div>
          {result && <Notice kind={result.ok ? 'ok' : 'warn'}><span aria-live="polite">{result.lines.map((l) => <span key={l} style={{ display: 'block' }}>{l}</span>)}</span></Notice>}
        </div>
        <NameView state={state} idp="nom-ej" show3d={false} reveal={!!result} />
      </div>
      <div className="controls"><div className="card"><Editor state={state} setState={(s) => { setState(s); setResult(null); }} pos={pos} setPos={setPos} idp="nom-ej-ed" /></div></div>
    </div>
  );
}

/* ------------------------------------------------------------------ errores frecuentes */

const MISTAKES: { wrong: string; smiles: string; why: string }[] = [
  { wrong: '2-etilbutano', smiles: 'CCC(CC)C', why: 'La cadena más larga no es la que «se ve» horizontal: incluye el etilo. Tiene 5 carbonos.' },
  { wrong: '4-metilpentano', smiles: 'CC(C)CCC', why: 'Se numeró desde el extremo equivocado: los localizadores deben ser lo más bajos posible.' },
  { wrong: '2-metil-3-etilpentano', smiles: 'CCC(CC)C(C)C', why: 'Los prefijos se escriben en orden alfabético (etil antes que metil), no por su localizador.' },
  { wrong: '2,2,3-metilbutano', smiles: 'CC(C)(C)C(C)C', why: 'Tres grupos iguales llevan el prefijo multiplicador «tri».' },
  { wrong: '1-metilpropano', smiles: 'CCCC', why: 'Un metilo en un extremo alarga la cadena: no es un sustituyente.' },
  { wrong: 'pent-3-eno', smiles: 'CCC=CC', why: 'El doble enlace debe llevar el localizador más bajo: se numera desde el otro extremo.' },
  { wrong: '2-propilpent-1-eno', smiles: 'C=C(CCC)CCC', why: 'Desde 2013 la cadena principal es la más larga (7 C), aunque el doble enlace quede fuera como metiliden. (Con la regla antigua sí se llamaba 2-propilpent-1-eno.)' },
  { wrong: '1,6-dimetilciclohexano', smiles: 'CC1CCCCC1C', why: 'En el anillo se numera de modo que los sustituyentes tengan los localizadores más bajos: 1,2.' },
  { wrong: '1-metil-2-clorobenceno', smiles: 'Cc1ccccc1Cl', why: 'Orden alfabético: cloro antes que metil, y el primero en el alfabeto recibe el 1 cuando hay empate.' },
];

function MistakesTab() {
  const [k, setK] = useState(0);
  const mk2 = MISTAKES[k];
  const mol = useMemo(() => parseSmiles(mk2.smiles), [mk2.smiles]);
  const nm = nameMolecule(mol);
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <p className="eyebrow" style={{ margin: 0 }}>Nombre mal escrito</p>
          <p style={{ fontSize: '1.3rem', margin: 0, textDecoration: 'line-through', color: 'var(--bad)' }}>{mk2.wrong}</p>
          <p className="eyebrow" style={{ margin: 0 }}>Nombre correcto (motor del laboratorio)</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }} aria-live="polite">{nm.ok ? nm.es : ''}</p>
          {nm.ok && <StructureSvg mol={mol} mainChain={nm.parent.kind === 'cadena' ? nm.parent.atoms : undefined} highlight={nm.parent.atoms} locants={nm.locants} title={`Estructura de ${nm.es}`} height={210} />}
          <p><strong>Por qué:</strong> {mk2.why}</p>
          {nm.ok && <ol className="list small">{nm.pasos.map((s) => <li key={s.titulo}>{s.texto}</li>)}</ol>}
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Error frecuente" value={String(k)} onChange={(v) => setK(Number(v))} options={MISTAKES.map((m, i) => ({ value: String(i), label: `«${m.wrong}»` }))} />
          <h3>Reglas en orden</h3>
          <ol className="list small">
            <li>Cadena principal: la más larga (con anillos, el anillo).</li>
            <li>Si empatan: la que tiene más enlaces múltiples, luego más dobles, luego más sustituyentes.</li>
            <li>Numeración: localizadores más bajos primero para los enlaces múltiples, luego para los dobles, luego para todos los sustituyentes.</li>
            <li>Si aún hay empate: el sustituyente que va primero en orden alfabético recibe el número menor.</li>
            <li>Prefijos en orden alfabético con di-, tri-, tetra- para los repetidos (que no cuentan en el orden).</li>
            <li>Números separados por comas; números y letras, por guiones.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ validación en vivo frente a PubChem */

function ValidationTab() {
  const [rows, setRows] = useState<{ cid: number; pub: string; es: string; en: string; cls: string }[] | null>(null);
  const [filter, setFilter] = useState('todas');
  useEffect(() => {
    let alive = true;
    loadConformers().then(({ list }) => {
      if (!alive) return;
      const seen = new Set<number>();
      const out = list.filter((c) => !seen.has(c.cid) && seen.add(c.cid)).map((c) => {
        const r = nameMolecule(parseSmiles(c.smiles));
        const en = r.ok ? r.en : `(${r.ok ? '' : r.motivo})`;
        const cls = !r.ok ? 'fuera de alcance' : en === c.nombreIupac ? 'idéntico'
          : normalizeName(en, { dropParens: true }) === normalizeName(c.nombreIupac, { dropParens: true }) ? 'solo paréntesis'
            : r.retenido && normalizeName(r.retenido.en.replace(/^([omp])-/, (_, x) => ({ o: '1,2-', m: '1,3-', p: '1,4-' } as Record<string, string>)[x])) === c.nombreIupac ? 'nombre retenido'
              : /cyclo\w+-1-ene$/.test(en) ? 'localizador del cicloalqueno' : 'otra convención';
        return { cid: c.cid, pub: c.nombreIupac, es: r.ok ? r.es : '—', en, cls };
      });
      setRows(out);
    }).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, []);
  if (!rows) return <p className="small muted" aria-live="polite">Cargando las estructuras de validación…</p>;
  const counts = rows.reduce<Record<string, number>>((s, r) => ({ ...s, [r.cls]: (s[r.cls] ?? 0) + 1 }), {});
  const shown = filter === 'todas' ? rows : rows.filter((r) => r.cls === filter);
  return (
    <div className="stack">
      <div className="card stack">
        <h3>Dos programas, mismas reglas: ¿dan el mismo nombre?</h3>
        <StatusLine status="modelo" prefix="Comparación">el motor de este laboratorio (Recomendaciones IUPAC 2013) frente al «IUPACName» de PubChem, que calcula el programa LexiChem TK de OpenEye. Se recalcula ahora en tu navegador con {rows.length} estructuras.</StatusLine>
        <Readout items={Object.entries(counts).map(([k, v]) => ({ k, v: `${v} (${fmt((100 * v) / rows.length, 1)} %)`, data: true }))} />
        <p className="small">Diferencias legítimas: LexiChem escribe «4-propan-2-ylheptane» sin paréntesis (2013 pide «4-(propan-2-yl)heptane»), usa nombres retenidos de uso general (acetylene, styrene, 1,2-xylene, cumene, chloroform, cyclooctatetraene) y omite el «-1-» de los cicloalquenos sustituidos («3-methylcyclohexene»), donde este laboratorio lo cita. Ninguna es un error de reglas.</p>
        <Select label="Mostrar" value={filter} onChange={setFilter} options={[{ value: 'todas', label: 'Todas' }, ...Object.keys(counts).map((k) => ({ value: k, label: k }))]} />
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de comparación con PubChem" style={{ maxHeight: 420, overflow: 'auto' }}>
          <table>
            <caption className="small muted">Estructuras de validación (confórmeros de PubChem descargados el 2026-10-19)</caption>
            <thead><tr><th>CID</th><th>PubChem (LexiChem)</th><th>Motor (inglés)</th><th>Motor (español)</th><th>Resultado</th></tr></thead>
            <tbody>{shown.map((r) => <tr key={r.cid}><td><a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}`} target="_blank" rel="noopener noreferrer">{r.cid}</a></td><td>{r.pub}</td><td>{r.en}</td><td>{r.es}</td><td>{r.cls}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ laboratorio */

function BuilderTab({ api }: LabProps) {
  const [state, setState] = useState<BuilderState>(() => mk({ kind: 'cadena', n: 5 }, (s) => { s.subs[1] = ['metil']; }));
  const [pos, setPos] = useState(1);
  const built = useMemo(() => buildMolecule(state), [state]);
  const nm = built.mol ? nameMolecule(built.mol) : null;
  const record = () => {
    if (!built.mol || !nm || !nm.ok) return;
    api.addTrial('nombres', {
      nombre: nm.es, ingles: nm.en, formula: hillFormula(built.mol), clase: nm.clase, carbonos: built.mol.atoms.filter((a) => a.el === 'C').length,
      carbonosPrincipal: nm.parent.size, sustituyentes: nm.substituents.length, insaturaciones: nm.multiples.length,
    });
  };
  return (
    <div className="lab-layout">
      <NameView state={state} idp="nom-c" />
      <div className="controls">
        <div className="card"><Editor state={state} setState={setState} pos={pos} setPos={setPos} idp="nom-ed" /></div>
        <div className="card stack"><RecordButton onRecord={record} disabled={!nm || !nm.ok} label="Guardar el nombre en la tabla" /></div>
      </div>
    </div>
  );
}

export default function NomenclatureLab(props: LabProps) {
  const [tab, setTab] = useState<Tab>('constructor');
  return (
    <div className="stack">
      <Notice>
        <strong>Propósito:</strong> aprendes las reglas IUPAC para nombrar hidrocarburos (cadena principal, numeración, orden alfabético, multiplicadores, enlaces múltiples y anillos) al construir moléculas y escribirlas a partir de un nombre, y observar cómo el motor elige la cadena, numera y arma el nombre paso a paso, en 2D y sobre el confórmero 3D de PubChem.
      </Notice>
      <Segmented label="Actividad" value={tab} onChange={setTab} options={TABS} />
      {tab === 'constructor' && <BuilderTab {...props} />}
      {tab === 'ejercicio' && <ExerciseTab {...props} />}
      {tab === 'reglas' && <MistakesTab />}
      {tab === 'validacion' && <ValidationTab />}
    </div>
  );
}

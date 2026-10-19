import { useMemo, useState } from 'react';
import { Crystal3D, CRYSTALS, Molecule3D, MOLECULES, moleculeSpecies, hillFormulaOf } from '../chem';
import { parseSdf } from '../models/geometry';
import { StatusChip } from '../components/Provenance';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import { playSound } from '../lib/sound';
import {
  buildCompound, checkFormula, checkName, el, ELEMENTS, FUNCTION_LABEL, hillFormula, makeChallenges, oxoacid, roman, SYSTEM_LABEL, type AcidForm, type Compound, type Spec,
} from '../models/inorganicNomenclature';
import type { LabProps } from './registry';
import { IdeasPanel, NamesCard, type Idea } from './inorganicShared';

type Fn = 'oxido' | 'peroxido' | 'hidroxido' | 'hidruro' | 'hidracido' | 'oxacido' | 'sal-binaria' | 'oxisal' | 'sal-acida' | 'sal-basica';
const FN_OPTIONS: { value: Fn; label: string }[] = [
  { value: 'oxido', label: 'Óxido' }, { value: 'peroxido', label: 'Peróxido' }, { value: 'hidroxido', label: 'Hidróxido' }, { value: 'hidruro', label: 'Hidruro' },
  { value: 'hidracido', label: 'Hidrácido' }, { value: 'oxacido', label: 'Oxácido' }, { value: 'sal-binaria', label: 'Sal binaria' }, { value: 'oxisal', label: 'Oxisal' },
  { value: 'sal-acida', label: 'Sal ácida' }, { value: 'sal-basica', label: 'Sal básica' },
];
const FN_HELP: Record<Fn, string> = {
  oxido: 'Elige un metal o un no metal y su número de oxidación; el oxígeno actúa con −2.',
  peroxido: 'Elige H o un metal de los grupos 1 o 2; el ion peróxido O₂²⁻ tiene cada O con −1.',
  hidroxido: 'Elige un metal y su número de oxidación; el ion hidróxido OH⁻ tiene carga −1.',
  hidruro: 'Metales de los grupos 1, 2 y Al (H⁻), o B, C, Si, N, P, O (hidruros con nombre propio).',
  hidracido: 'Elige F, Cl, Br, I o S: el hidrógeno actúa con +1.',
  oxacido: 'Elige el no metal (o Cr, Mn) y su número de oxidación: óxido ácido + agua.',
  'sal-binaria': 'Elige el catión (metal, NH₄⁺ o no metal menos electronegativo) y el anión F⁻, Cl⁻, Br⁻, I⁻ o S²⁻.',
  oxisal: 'Elige el catión y el oxoanión que proviene de un oxácido (-ito o -ato).',
  'sal-acida': 'Catión + anión que conserva H del ácido (hidrogenocarbonato, dihidrogenofosfato…).',
  'sal-basica': 'Catión de carga +2 con un OH⁻ y un anión de carga −1.',
};

const ANION_BIN = [{ value: 'F', label: 'F⁻ fluoruro' }, { value: 'Cl', label: 'Cl⁻ cloruro' }, { value: 'Br', label: 'Br⁻ bromuro' }, { value: 'I', label: 'I⁻ yoduro' }, { value: 'S', label: 'S²⁻ sulfuro' }];
const OXOANIONS: { value: string; label: string; acid: { el: string; ox: number; form?: AcidForm } }[] = [
  { value: 'Cl1', label: 'ClO⁻ hipoclorito', acid: { el: 'Cl', ox: 1 } }, { value: 'Cl3', label: 'ClO₂⁻ clorito', acid: { el: 'Cl', ox: 3 } },
  { value: 'Cl5', label: 'ClO₃⁻ clorato', acid: { el: 'Cl', ox: 5 } }, { value: 'Cl7', label: 'ClO₄⁻ perclorato', acid: { el: 'Cl', ox: 7 } },
  { value: 'Br5', label: 'BrO₃⁻ bromato', acid: { el: 'Br', ox: 5 } }, { value: 'I5', label: 'IO₃⁻ yodato', acid: { el: 'I', ox: 5 } },
  { value: 'S4', label: 'SO₃²⁻ sulfito', acid: { el: 'S', ox: 4 } }, { value: 'S6', label: 'SO₄²⁻ sulfato', acid: { el: 'S', ox: 6 } },
  { value: 'N3', label: 'NO₂⁻ nitrito', acid: { el: 'N', ox: 3 } }, { value: 'N5', label: 'NO₃⁻ nitrato', acid: { el: 'N', ox: 5 } },
  { value: 'C4', label: 'CO₃²⁻ carbonato', acid: { el: 'C', ox: 4 } }, { value: 'P5', label: 'PO₄³⁻ fosfato', acid: { el: 'P', ox: 5 } },
  { value: 'P5di', label: 'P₂O₇⁴⁻ difosfato', acid: { el: 'P', ox: 5, form: 'di' } }, { value: 'Si4meta', label: 'SiO₃²⁻ metasilicato', acid: { el: 'Si', ox: 4, form: 'meta' } },
  { value: 'Mn7', label: 'MnO₄⁻ permanganato', acid: { el: 'Mn', ox: 7 } }, { value: 'Mn6', label: 'MnO₄²⁻ manganato', acid: { el: 'Mn', ox: 6 } },
  { value: 'Cr6', label: 'CrO₄²⁻ cromato', acid: { el: 'Cr', ox: 6 } }, { value: 'Cr6di', label: 'Cr₂O₇²⁻ dicromato', acid: { el: 'Cr', ox: 6, form: 'di' } },
];
const ACID_ANIONS = [
  { value: 'C4-1', label: 'HCO₃⁻ hidrogenocarbonato', acid: { el: 'C', ox: 4 }, h: 1 }, { value: 'S6-1', label: 'HSO₄⁻ hidrogenosulfato', acid: { el: 'S', ox: 6 }, h: 1 },
  { value: 'S4-1', label: 'HSO₃⁻ hidrogenosulfito', acid: { el: 'S', ox: 4 }, h: 1 }, { value: 'P5-2', label: 'H₂PO₄⁻ dihidrogenofosfato', acid: { el: 'P', ox: 5 }, h: 2 },
  { value: 'P5-1', label: 'HPO₄²⁻ hidrogenofosfato', acid: { el: 'P', ox: 5 }, h: 1 },
];

/** Estados de oxidación que tiene sentido ofrecer para un elemento en una función. */
function statesFor(sym: string, fn: Fn): number[] {
  if (sym === 'NH4') return [1];
  const e = el(sym);
  switch (fn) {
    case 'oxido': return [...e.ox, ...(e.kind === 'metal' ? (e.acid ?? []).filter((x) => !(sym === 'Mn' && x === 6)) : [])];
    case 'oxacido': return e.acid ?? [];
    case 'peroxido': case 'hidruro': case 'hidracido': return [e.ox[0] ?? 0];
    case 'sal-binaria': return e.kind === 'metal' ? e.ox : ({ B: [3], C: [4], Si: [4], N: [3], P: [3, 5], S: [4, 6] } as Record<string, number[]>)[sym] ?? [];
    default: return e.kind === 'metal' ? e.ox : [];
  }
}

const IDEAS: Idea[] = [
  { id: 'n1', text: 'La fórmula del óxido de hierro(III) se obtiene «cruzando las valencias»: Fe₂O₃.', answer: 'cierto', feedback: 'Cruzar las cargas (+3 y −2) es un atajo de la neutralidad: 2·(+3) + 3·(−2) = 0. Ojo: luego hay que simplificar si se puede (Sn⁴⁺ y O²⁻ dan SnO₂, no Sn₂O₄) y no simplificar el peróxido O₂²⁻ ni el Hg₂²⁺.' },
  { id: 'n2', text: 'En «óxido de hierro(III)», el (III) indica que hay tres átomos de hierro.', answer: 'falso', feedback: 'El número romano de Stock es el número de oxidación del hierro (+3), no el número de átomos. En Fe₂O₃ hay dos átomos de hierro y tres de oxígeno.' },
  { id: 'n3', text: 'La IUPAC recomienda el sistema tradicional (-oso/-ico) para nombrar óxidos y sales.', answer: 'falso', feedback: 'Las Recomendaciones de 2005 («Libro Rojo») usan la nomenclatura estequiométrica (prefijos) o la de Stock. Los nombres tradicionales se aceptan para los oxoácidos y sus aniones (ácido sulfúrico, sulfato) y nombres como agua y amoníaco.' },
  { id: 'n4', text: '«Sulfito» y «sulfato» son el mismo anión con distinto nombre.', answer: 'falso', feedback: 'El sulfito (SO₃²⁻) viene del ácido sulfuroso (S con +4) y el sulfato (SO₄²⁻) del sulfúrico (S con +6): -oso → -ito y -ico → -ato.' },
];

const SEED0 = 7;
type ChallengeLog = { n: number; correct: boolean; attempts: number };

export default function InorganicNomenclatureLab({ api }: LabProps) {
  const [fn, setFn] = useState<Fn>('oxido');
  const [sym, setSym] = useState('Fe');
  const [ox, setOx] = useState(3);
  const [anion, setAnion] = useState('Cl');
  const [oxoanion, setOxoanion] = useState('S6');
  const [acidAnion, setAcidAnion] = useState('C4-1');
  const [form, setForm] = useState<AcidForm>('normal');
  const [result, setResult] = useState<Compound | null>(null);
  const [error, setError] = useState<string | null>(null);

  const states = statesFor(sym, fn);
  const stateOk = states.includes(ox) ? ox : states[0];
  const choose = (s: string) => { setSym(s); setResult(null); setError(null); const st = statesFor(s, fn); if (st.length && !st.includes(ox)) setOx(st[0]); playSound('click', { intensity: 0.3 }); };
  const changeFn = (f: Fn) => { setFn(f); setResult(null); setError(null); const st = statesFor(sym, f); if (st.length && !st.includes(ox)) setOx(st[0]); };

  const spec = (): Spec => {
    const cat = sym === 'NH4' ? { el: 'NH4' as const } : { el: sym, ox: stateOk };
    switch (fn) {
      case 'oxido': return { kind: 'oxido', el: sym, ox: stateOk };
      case 'peroxido': return { kind: 'peroxido', el: sym };
      case 'hidroxido': return { kind: 'hidroxido', el: sym, ox: stateOk };
      case 'hidruro': return { kind: 'hidruro', el: sym };
      case 'hidracido': return { kind: 'hidracido', el: sym };
      case 'oxacido': return { kind: 'oxacido', el: sym, ox: stateOk, form };
      case 'sal-binaria': return { kind: 'sal-binaria', cation: cat, anion };
      case 'oxisal': return { kind: 'oxisal', cation: cat, acid: OXOANIONS.find((o) => o.value === oxoanion)!.acid };
      case 'sal-acida': { const a = ACID_ANIONS.find((o) => o.value === acidAnion)!; return { kind: 'oxisal', cation: cat, acid: a.acid, hLeft: a.h }; }
      case 'sal-basica': return { kind: 'sal-basica', cation: { el: sym, ox: stateOk }, anion };
    }
  };
  const build = () => {
    try {
      if (!states.length && sym !== 'NH4') throw new RangeError(`El ${el(sym).es} no forma ${FN_OPTIONS.find((f) => f.value === fn)!.label.toLowerCase()} en este constructor. ${FN_HELP[fn]}`);
      const c = buildCompound(spec());
      setResult(c); setError(null); playSound('confirm');
    } catch (e) { setResult(null); setError((e as Error).message); playSound('error'); }
  };
  const recordCompound = () => {
    if (!result) return;
    api.addTrial('compuestos', { funcion: FUNCTION_LABEL[result.fn], formula: result.formulaPretty, sistematica: result.names.sistematica, stock: result.names.stock ?? '—', tradicional: result.names.tradicional ?? '—', elementos: Object.keys(result.composition).length, atomos: Object.values(result.composition).reduce((s, n) => s + n, 0) });
  };

  /* ---------- 3D del compuesto (si es una molécula de la biblioteca o un cristal del kit) */
  const molIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of MOLECULES) if (x.categoria !== 'ion') { try { m.set(hillFormulaOf(parseSdf(x.sdf).atoms.map((a) => ({ el: a.element }))), x.id); } catch { /* sin SDF */ } }
    return m;
  }, []);
  const view3d = useMemo(() => {
    if (!result) return null;
    const hill = hillFormula(result.composition);
    const molId = molIndex.get(hill);
    if (molId) return { kind: 'mol' as const, id: molId };
    const cr = CRYSTALS.find((c) => hillFormula(Object.fromEntries(Object.entries({ [c.cation[0]]: 1, [c.anion[0]]: c.type === 'fluorita' ? 2 : 1 }))) === hill);
    return cr ? { kind: 'cristal' as const, id: cr.id } : null;
  }, [result, molIndex]);

  /* ---------- retos */
  const [seed, setSeed] = useState(SEED0);
  const challenges = useMemo(() => makeChallenges(seed, 10), [seed]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [log, setLog] = useState<ChallengeLog[]>([]);
  const ch = challenges[idx];
  const hits = log.filter((l) => l.correct).length;
  const check = () => {
    if (!answer.trim()) { setFeedback({ ok: false, text: 'Escribe tu respuesta.' }); return; }
    const r = ch.mode === 'nombrar' ? checkName(ch.compound, answer, ch.system) : checkFormula(ch.compound, answer);
    const n = attempts + 1;
    setAttempts(n);
    setFeedback({ ok: r.ok, text: r.message });
    playSound(r.ok ? 'confirm' : 'error');
    if (r.ok || n >= 3) {
      const entry = { n: idx + 1, correct: r.ok, attempts: n };
      setLog((l) => [...l.filter((x) => x.n !== entry.n), entry]);
      api.addTrial('retos', { reto: idx + 1, tipo: ch.mode === 'nombrar' ? 'nombrar' : 'formular', sistema: SYSTEM_LABEL[ch.system], compuesto: ch.compound.formulaPretty, respuesta: answer.trim(), correcto: r.ok ? 1 : 0, intentos: n, aciertos: log.filter((l) => l.correct && l.n !== entry.n).length + (r.ok ? 1 : 0) });
    }
  };
  const next = () => { setIdx((i) => Math.min(challenges.length - 1, i + 1)); setAnswer(''); setFeedback(null); setAttempts(0); };
  const done = log.some((l) => l.n === idx + 1);
  const expected = ch.mode === 'nombrar' ? (ch.compound.names[ch.system] ?? '') : ch.compound.formulaPretty;

  /* ---------- tabla periódica */
  const grid = useMemo(() => {
    const cells: (typeof ELEMENTS[number] | null)[][] = Array.from({ length: 6 }, () => Array(18).fill(null));
    for (const e of ELEMENTS) cells[e.period - 1][e.group - 1] = e;
    return cells;
  }, []);
  const enabledFor = (s: string) => fn === 'oxacido' ? !!el(s).acid?.length : fn === 'hidracido' ? ['F', 'Cl', 'Br', 'I', 'S'].includes(s) : s !== 'O' && (statesFor(s, fn).length > 0 || (fn === 'hidruro' && ['B', 'C', 'Si', 'N', 'P', 'O'].includes(s)));

  return (
    <div className="lab-layout">
      <div className="stack">
        <section className="card stack" aria-labelledby="nmi-pt-h">
          <h3 id="nmi-pt-h">Tabla periódica (elementos del constructor)</h3>
          <p className="small muted" style={{ margin: 0 }}>{FN_HELP[fn]} Los elementos que no forman esta función aparecen atenuados.</p>
          <div className="table-wrap nmi-pt" tabIndex={0} role="region" aria-label="Tabla periódica interactiva">
            <div role="group" aria-label="Elementos" style={{ display: 'grid', gridTemplateColumns: 'repeat(18, minmax(34px, 1fr))', gap: 3, minWidth: 640 }}>
              {grid.flatMap((row, r) => row.map((e, c) => e ? (
                <button key={e.sym} type="button" className="nmi-el" aria-pressed={sym === e.sym} aria-label={`${e.es} (${e.sym}), ${e.kind === 'metal' ? 'metal' : 'no metal'}`}
                  onClick={() => choose(e.sym)} style={{
                    gridRow: r + 1, gridColumn: c + 1, padding: '4px 0', minHeight: 40, borderRadius: 8, cursor: 'pointer',
                    border: sym === e.sym ? '2px solid var(--data)' : '1px solid var(--line)',
                    background: e.kind === 'metal' ? 'color-mix(in srgb, var(--fis) 24%, var(--surface))' : 'color-mix(in srgb, var(--qui) 24%, var(--surface))',
                    color: 'var(--ink)', opacity: enabledFor(e.sym) ? 1 : 0.45, fontFamily: 'var(--font-data)',
                  }}>
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--ink-2)' }}>{e.z}</span>
                  <strong style={{ fontSize: 14 }}>{e.sym}</strong>
                </button>
              ) : <span key={`${r}-${c}`} aria-hidden="true" style={{ gridRow: r + 1, gridColumn: c + 1 }} />))}
            </div>
          </div>
          <p className="small" style={{ margin: 0 }}><span className="chip" style={{ background: 'color-mix(in srgb, var(--fis) 24%, var(--surface))' }}>metal</span> <span className="chip" style={{ background: 'color-mix(in srgb, var(--qui) 24%, var(--surface))' }}>no metal</span> · Elegido: <strong>{sym === 'NH4' ? 'ion amonio NH₄⁺' : `${el(sym).es} (${sym})`}</strong>{sym !== 'NH4' && states.length > 0 && <> · números de oxidación: {states.map((s) => `+${s}`).join(', ')}</>}</p>
        </section>

        <Readout items={[
          { k: 'Fórmula', v: result ? result.formulaPretty : 'forma el compuesto', data: true },
          { k: 'Función', v: result ? FUNCTION_LABEL[result.fn] : '—' },
          { k: 'Sistemática', v: result?.names.sistematica ?? '—' },
          { k: 'Stock', v: result ? (result.names.stock ?? 'no aplica') : '—' },
          { k: 'Tradicional', v: result ? (result.names.tradicional ?? 'no se usa') : '—' },
        ]} />
        {error && <Notice kind="warn">{error}</Notice>}
        {result && (
          <section className="card stack" aria-labelledby="nmi-res-h">
            <h3 id="nmi-res-h">Cómo se obtiene la fórmula y cómo se nombra</h3>
            <ol className="small list">{result.neutrality.map((t) => <li key={t}>{t}</li>)}</ol>
            <NamesCard compound={result} idPrefix="nmi-r" />
            {view3d?.kind === 'mol' && <Molecule3D species={moleculeSpecies(view3d.id)} idPrefix="nmi-mol" height={240} />}
            {view3d?.kind === 'cristal' && <Crystal3D crystal={CRYSTALS.find((c) => c.id === view3d.id)!} idPrefix="nmi" height={260} />}
            {!view3d && <p className="small muted" style={{ margin: 0 }}>Este compuesto no tiene un modelo 3D en el kit (sin confórmero de PubChem ni red cristalina incluida): no se dibuja a mano.</p>}
          </section>
        )}

        <section className="card stack" aria-labelledby="nmi-ret-h">
          <h3 id="nmi-ret-h">Retos de nombrar y formular</h3>
          <p className="small" style={{ margin: 0 }} aria-live="polite">Reto {idx + 1} de {challenges.length} · Aciertos: <strong>{hits}</strong> de {log.length} respondidos</p>
          <p style={{ margin: 0, fontSize: '1.08rem' }}><strong>{ch.prompt}</strong></p>
          <div className="field">
            <label htmlFor="nmi-ans">Tu respuesta</label>
            <input id="nmi-ans" type="text" value={answer} autoComplete="off" spellCheck={false} maxLength={80} disabled={done}
              placeholder={ch.mode === 'nombrar' ? 'p. ej. óxido de cobre(II)' : 'p. ej. CuO (los subíndices pueden ir como números)'}
              onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !done) check(); }} />
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={check} disabled={done}>Comprobar</button>
            <button type="button" className="btn" onClick={next} disabled={idx >= challenges.length - 1}>Siguiente reto</button>
            <button type="button" className="btn ghost small" onClick={() => { setSeed((s) => s + 1); setIdx(0); setLog([]); setAnswer(''); setFeedback(null); setAttempts(0); }}>Nueva serie de retos</button>
          </div>
          <div aria-live="polite">
            {feedback && <div className={`notice ${feedback.ok ? 'ok' : 'warn'}`}>{feedback.text}{!feedback.ok && attempts >= 3 && <> Respuesta esperada: <strong>{expected}</strong>.</>}{!feedback.ok && attempts < 3 && <> Intentos: {attempts} de 3.</>}</div>}
          </div>
          <p className="small muted" style={{ margin: 0 }}>Cada reto respondido (o tras 3 intentos) se guarda en la tabla «Retos» del cuaderno con el conteo de aciertos. Serie n.º {seed} (reproducible).</p>
        </section>

        <IdeasPanel ideas={IDEAS} idPrefix="nmi" intro="Ideas frecuentes al nombrar compuestos inorgánicos." />
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Constructor de compuestos</h3>
          <Select label="Función química" value={fn} options={FN_OPTIONS} onChange={(v) => changeFn(v as Fn)} />
          {(fn === 'sal-binaria' || fn === 'oxisal' || fn === 'sal-acida') && (
            <label className="check small"><input type="checkbox" checked={sym === 'NH4'} onChange={(e) => choose(e.target.checked ? 'NH4' : 'Na')} /> Usar el ion amonio NH₄⁺ como catión</label>
          )}
          {states.length > 1 && sym !== 'NH4' && (
            <Segmented label={`Número de oxidación del ${el(sym).es}`} value={String(stateOk)} options={states.map((s) => ({ value: String(s), label: `+${s} (${roman(s)})` }))} onChange={(v) => { setOx(Number(v)); setResult(null); }} />
          )}
          {fn === 'oxacido' && ['P', 'B', 'Si', 'S', 'Cr'].includes(sym) && (
            <Segmented label="Grado de hidratación" value={form} options={[{ value: 'normal', label: 'Normal (orto)' }, ...(['P', 'B', 'Si'].includes(sym) ? [{ value: 'meta' as AcidForm, label: 'meta' }] : []), ...(['P', 'S', 'Cr'].includes(sym) ? [{ value: 'di' as AcidForm, label: 'di- (piro-)' }] : [])]} onChange={(v) => { setForm(v); setResult(null); }} />
          )}
          {(fn === 'sal-binaria' || fn === 'sal-basica') && <Select label="Anión" value={anion} options={fn === 'sal-basica' ? ANION_BIN.filter((a) => a.value !== 'S' && a.value !== 'F') : ANION_BIN} onChange={(v) => { setAnion(v); setResult(null); }} />}
          {fn === 'oxisal' && <Select label="Oxoanión" value={oxoanion} options={OXOANIONS} onChange={(v) => { setOxoanion(v); setResult(null); }} />}
          {fn === 'sal-acida' && <Select label="Anión ácido" value={acidAnion} options={ACID_ANIONS} onChange={(v) => { setAcidAnion(v); setResult(null); }} />}
          <button type="button" className="btn primary" onClick={build}>Formar el compuesto</button>
          <RecordButton onRecord={recordCompound} disabled={!result} label="Guardar el compuesto en la tabla" />
          {fn === 'oxacido' && sym !== 'NH4' && states.length > 0 && (() => { try { const a = oxoacid(sym, stateOk, form); return <p className="small muted" style={{ margin: 0 }}>Vista previa: óxido ácido + agua → H{a.h > 1 ? a.h : ''}{sym}{a.x > 1 ? a.x : ''}O{a.o}</p>; } catch { return null; } })()}
        </div>
        <div className="card stack">
          <h3>¿Qué sistema usar?</h3>
          <p className="small" style={{ margin: 0 }}>La IUPAC (Recomendaciones 2005, el «Libro Rojo») recomienda la nomenclatura <strong>estequiométrica</strong> (prefijos) y la de <strong>Stock</strong> (números romanos). La <strong>tradicional</strong> (-oso/-ico) solo se acepta para algunos compuestos: los oxoácidos y sus aniones (ácido sulfúrico, sulfato) y nombres como agua y amoníaco.</p>
          <StatusChip status="modelo" prefix="Fórmulas y nombres" />
          <p className="small muted" style={{ margin: 0 }}>Motor validado con 149 compuestos contra los sinónimos de PubChem (fórmula y nombres en inglés).</p>
        </div>
      </div>
    </div>
  );
}

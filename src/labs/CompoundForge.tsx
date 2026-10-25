import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Crystal3D, Molecule3D, Reaction3D } from '../chem';
import { StatusChip } from '../components/Provenance';
import { Notice, Readout, RecordButton, Segmented } from '../components/ui';
import { playSound } from '../lib/sound';
import {
  chargeParts, challengeMet, ENGINE_SYMBOLS, KNOWN_STATES, FAMILY_LABEL, FORGE_CHALLENGES, forge, isMolecular, PATHWAY_LABEL, ROUTES, routeById, STATE_CHOICES, stateLabel, suggestedStates,
  type ForgeFamily, type ForgeOk, type ForgeOutcome, type RouteId,
} from '../models/compoundForge';
import { pubchemUrl, REGISTRY_META, registryStatus, registryText } from '../models/compoundForgeRegistry';
import { FUNCTION_LABEL, oxoacid, type AcidForm, type Compound } from '../models/inorganicNomenclature';
import { CATEGORY_LABEL, isMetalCategory, PT_ELEMENTS, ptElement, type PtElement } from '../models/periodicTable';
import { forgeReaction3D, staticView } from './compoundForge3d';
import { NamesCard } from './inorganicShared';
import type { LabProps } from './registry';

const ENGINE = new Set(ENGINE_SYMBOLS);
const visualRow = (e: PtElement) => (e.row >= 8 ? e.row + 1 : e.row);

/* ------------------------------------------------------------------ tabla periódica accesible */

function PeriodicPicker({ idPrefix, selected, onPick, suggested }: { idPrefix: string; selected: (string | null)[]; onPick: (sym: string) => void; suggested: Set<string> }) {
  const [focusSym, setFocusSym] = useState<string>(selected[0] ?? 'H');
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const helpId = `${idPrefix}-pt-help`;
  const move = (from: PtElement, key: string): PtElement | null => {
    const r = visualRow(from);
    const same = (row: number) => PT_ELEMENTS.filter((e) => visualRow(e) === row).sort((p, q) => p.col - q.col);
    if (key === 'ArrowRight') return same(r).find((e) => e.col > from.col) ?? null;
    if (key === 'ArrowLeft') return [...same(r)].reverse().find((e) => e.col < from.col) ?? null;
    if (key === 'Home') return same(r)[0];
    if (key === 'End') return same(r)[same(r).length - 1];
    const dir = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
    if (!dir) return null;
    for (let row = r + dir; row >= 1 && row <= 10; row += dir) {
      const list = same(row);
      if (!list.length) continue;
      return list.reduce((best, e) => (Math.abs(e.col - from.col) < Math.abs(best.col - from.col) ? e : best), list[0]);
    }
    return null;
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, el: PtElement) => {
    const next = move(el, e.key);
    if (!next) return;
    e.preventDefault();
    setFocusSym(next.sym);
    refs.current.get(next.sym)?.focus();
  };
  return (
    <>
      <p id={helpId} className="small muted" style={{ margin: 0 }}>Con el teclado: Tab entra a la tabla, las flechas recorren los elementos, Inicio y Fin van al extremo de la fila, y Enter o Espacio eligen el elemento.</p>
      <div className="table-wrap forge-pt-wrap" tabIndex={-1}>
        <div className="forge-pt" role="group" aria-label="Tabla periódica: elige un elemento" aria-describedby={helpId}>
          {PT_ELEMENTS.map((e) => {
            const inEngine = ENGINE.has(e.sym);
            const slot = selected.indexOf(e.sym);
            const kind = e.category === 'gas-noble' ? 'noble' : e.category === 'metaloide' ? 'metaloide' : isMetalCategory(e.category) ? 'metal' : 'nometal';
            return (
              <button key={e.sym} type="button" ref={(n) => { if (n) refs.current.set(e.sym, n); else refs.current.delete(e.sym); }}
                className={`forge-el k-${kind}${inEngine ? '' : ' out'}${suggested.has(e.sym) ? ' sug' : ''}`} data-sym={e.sym}
                style={{ gridRow: visualRow(e), gridColumn: e.col }} tabIndex={focusSym === e.sym ? 0 : -1} aria-pressed={slot >= 0}
                aria-label={`${e.es} (${e.sym}), ${CATEGORY_LABEL[e.category]}${inEngine ? '' : ', fuera del taller'}${slot >= 0 ? `, en la casilla ${slot + 1}` : ''}`}
                onFocus={() => setFocusSym(e.sym)} onKeyDown={(ev) => onKey(ev, e)} onClick={() => { setFocusSym(e.sym); onPick(e.sym); }}>
                <span className="z" aria-hidden="true">{e.z}</span>
                <span className="s" aria-hidden="true">{e.sym}</span>
                {slot >= 0 && <span className="slot" aria-hidden="true">{slot + 1}</span>}
              </button>
            );
          })}
          <span className="forge-el-ph" aria-hidden="true" style={{ gridRow: 6, gridColumn: 3 }}>57–71</span>
          <span className="forge-el-ph" aria-hidden="true" style={{ gridRow: 7, gridColumn: 3 }}>89–103</span>
          <span aria-hidden="true" style={{ gridRow: 8, gridColumn: '1 / -1', height: 6 }} />
        </div>
      </div>
      <div className="forge-legend small" aria-hidden="true">
        <span><i className="sw k-metal" />metal</span>
        <span><i className="sw k-nometal" />no metal</span>
        <span><i className="sw k-metaloide" />metaloide</span>
        <span><i className="sw k-noble" />gas noble</span>
        <span><i className="sw out" />fuera del taller</span>
        <span><i className="sw sug" />habitual en esta ruta</span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ modelo 2D de cargas */

function ChargeModel({ compound, idPrefix }: { compound: Compound; idPrefix: string }) {
  const parts = chargeParts(compound);
  const molecular = isMolecular(compound);
  const total = parts.reduce((s, p) => s + p.charge * p.count, 0);
  const sumText = `${parts.map((p) => `${p.count} × (${p.charge > 0 ? '+' : '−'}${Math.abs(p.charge)})`).join(' + ')} = ${total}`;
  return (
    <section className="card stack" aria-labelledby={`${idPrefix}-2d-h`}>
      <h3 id={`${idPrefix}-2d-h`}>Modelo 2D de neutralidad de cargas</h3>
      <div className="forge-tiles" role="img" aria-label={`${compound.formulaPretty}: ${parts.map((p) => `${p.count} ${p.label}`).join(' y ')}; suma de cargas ${sumText}`}>
        {parts.map((p) => (
          <div key={p.label} className="forge-tilegroup">
            <div className="tiles">
              {Array.from({ length: Math.min(p.count, 6) }, (_, i) => <span key={i} className={`forge-tile ${p.charge > 0 ? 'pos' : 'neg'}`}>{p.label}</span>)}
              {p.count > 6 && <span className="forge-tile more">… ×{p.count}</span>}
            </div>
            <span className="small muted">{p.count} × ({p.charge > 0 ? '+' : '−'}{Math.abs(p.charge)})</span>
          </div>
        ))}
      </div>
      <p className="small" style={{ margin: 0 }}>Suma de cargas: <strong className="data-value">{sumText}</strong> → el compuesto es neutro.</p>
      <p className="small muted" style={{ margin: 0 }}>{molecular ? 'En las especies moleculares (enlaces covalentes) las «cargas» son números de oxidación: cargas formales para escribir la fórmula, no iones reales.' : 'En el modelo iónico cada catión y cada anión lleva su carga; la fórmula usa los menores enteros que suman cero.'}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ visor 3D */

function Viewer3D({ result, idPrefix }: { result: ForgeOk; idPrefix: string }) {
  const [view, setView] = useState<'compuesto' | 'reaccion'>('compuesto');
  const sv = useMemo(() => staticView(result.product), [result]);
  const rx = useMemo(() => forgeReaction3D(result), [result]);
  return (
    <section className="card stack" aria-labelledby={`${idPrefix}-3d-h`}>
      <h3 id={`${idPrefix}-3d-h`}>Visor 3D</h3>
      <Segmented label="Qué ver en 3D" value={view} options={[{ value: 'compuesto', label: 'Compuesto en 3D' }, { value: 'reaccion', label: 'Reacción en 3D' }]} onChange={setView} />
      {view === 'compuesto' && (
        <>
          {sv.kind === 'molecula' && <>{sv.note && <p className="small" style={{ margin: 0 }}>{sv.note}</p>}<Molecule3D species={sv.species} idPrefix={`${idPrefix}-mol`} height={280} measure /></>}
          {sv.kind === 'cristal' && <><p className="small" style={{ margin: 0 }}>{result.product.formulaPretty} es un sólido iónico con parámetro de red publicado: se dibuja su red cristalina.</p><Crystal3D crystal={sv.crystal} idPrefix={`${idPrefix}-cr`} height={300} /></>}
          {sv.kind === 'ionico' && <><Notice>{sv.note}</Notice><Molecule3D species={sv.ions[0]} idPrefix={`${idPrefix}-ion`} height={240} /></>}
          {sv.kind === 'sin-geometria' && <Notice>{sv.note}</Notice>}
        </>
      )}
      {view === 'reaccion' && ('def' in rx
        ? <>{rx.note && <p className="small" style={{ margin: 0 }}>{rx.note}</p>}<Reaction3D def={rx.def} idPrefix={`${idPrefix}-rx`} height={300} /></>
        : <Notice>{rx.reason}</Notice>)}
    </section>
  );
}

/* ------------------------------------------------------------------ taller */

type FormedEntry = { key: string; compound: Compound; a: string; oxA: number; route: RouteId };

const pathwayClass = { directa: 'ok', condiciones: 'warn', formal: 'bad' } as const;

export default function CompoundForge({ api, initialRoute, idPrefix }: LabProps & { initialRoute: RouteId; idPrefix: string }) {
  const uid = useId();
  const [route, setRoute] = useState<RouteId>(initialRoute);
  const [slots, setSlots] = useState<(string | null)[]>([null, null]);
  const [ox, setOx] = useState<(number | null)[]>([null, null]);
  const [active, setActive] = useState<0 | 1>(0);
  const [form, setForm] = useState<AcidForm>('normal');
  const [hLeft, setHLeft] = useState(0);
  const [result, setResult] = useState<ForgeOutcome | null>(null);
  const [formed, setFormed] = useState<FormedEntry[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});
  const [tries, setTries] = useState(0);
  const def = routeById(route);
  const two = def.slots === 2;

  const sugg = (r: RouteId, slot: 0 | 1, sym: string | null) => suggestedStates(r, slot, sym);
  const suggestedSet = useMemo(() => new Set(ENGINE_SYMBOLS.filter((s) => sugg(route, active, s).length > 0)), [route, active]);

  const clear = () => setResult(null);
  const pick = (sym: string) => {
    const slot: 0 | 1 = two ? active : 0;
    setSlots((s) => { const n = [...s]; n[slot] = sym; return n; });
    const st = sugg(route, slot, sym);
    setOx((o) => {
      const n = [...o];
      const cur = o[slot];
      const fallback = ENGINE.has(sym) ? (KNOWN_STATES[sym].find((x) => x > 0) ?? KNOWN_STATES[sym][0]) : 1;
      n[slot] = st.length ? (cur !== null && st.includes(cur) ? cur : st[0]) : (cur ?? fallback);
      return n;
    });
    if (two && slot === 0) setActive(1);
    clear();
    playSound('click', { intensity: 0.3 });
  };
  const changeRoute = (r: RouteId) => {
    setRoute(r);
    setOx((o) => o.map((v, i) => { const st = sugg(r, i as 0 | 1, slots[i]); return st.length && !st.includes(v ?? 0) ? st[0] : v; }));
    if (routeById(r).slots === 1) setActive(0);
    setForm('normal'); setHLeft(0);
    clear();
  };

  const input = { route, a: slots[0], oxA: ox[0], b: two ? slots[1] : null, oxB: two ? ox[1] : null, form, hLeft: route === 'neutralizacion' ? hLeft : 0 };

  const build = () => {
    const r = forge(input);
    setResult(r);
    setTries((t) => t + 1);
    playSound(r.ok ? 'confirm' : 'error');
    if (r.ok) {
      setFormed((f) => (f.some((x) => x.key === r.product.key) ? f : [...f, { key: r.product.key, compound: r.product, a: r.input.a!, oxA: r.input.oxA!, route: r.route.id }]));
      const newly = FORGE_CHALLENGES.map((c, i) => ({ c, i })).filter(({ c }) => challengeMet(c, r) && !done[c.id]);
      if (newly.length) {
        setDone((d) => ({ ...d, ...Object.fromEntries(newly.map(({ c }) => [c.id, tries + 1])) }));
        for (const { c, i } of newly) api.addTrial('retos-taller', { reto: i + 1, descripcion: c.text, compuesto: r.product.formulaPretty, ruta: r.route.label, intentos: tries + 1, logrado: 1 });
      }
    }
  };

  const ok = result?.ok ? result : null;
  const fail = result && !result.ok ? result : null;
  const reg = ok ? registryStatus(ok.product.key) : null;
  const regText = ok ? registryText(ok.product.key) : null;

  const record = () => {
    if (!ok) return;
    const c = ok.product;
    const r = registryStatus(c.key);
    api.addTrial('taller', {
      ruta: ok.route.label, elementos: ok.chosen, ecuacion: ok.equation, formula: c.formulaPretty, funcion: FUNCTION_LABEL[c.fn],
      sistematica: c.names.sistematica, stock: c.names.stock ?? '—', tradicional: c.names.tradicional ?? c.names.comun ?? '—',
      registrado: r.status === 'registrado' ? 'sí (por nombre)' : r.status === 'misma-formula' ? 'solo la fórmula' : r.status === 'formal' ? 'no (fórmula formal)' : 'sin información', cid: r.status === 'registrado' || r.status === 'misma-formula' ? r.entry.cid : null,
      via: PATHWAY_LABEL[ok.pathway], elementosN: Object.keys(c.composition).length, atomos: Object.values(c.composition).reduce((s, n) => s + n, 0),
    });
  };

  // Estado del grado de hidratación y de la neutralización parcial.
  const acidEl = route === 'anhidrido-agua' ? slots[0] : route === 'neutralizacion' ? slots[1] : null;
  const acidOx = route === 'anhidrido-agua' ? ox[0] : route === 'neutralizacion' ? ox[1] : null;
  const formOptions = useMemo(() => {
    if (!acidEl || !acidOx || acidOx < 0 || !ENGINE.has(acidEl)) return [];
    return (['normal', 'meta', 'di'] as AcidForm[]).filter((f) => { try { oxoacid(acidEl, acidOx, f); return true; } catch { return false; } });
  }, [acidEl, acidOx]);
  useEffect(() => { if (!formOptions.includes(form)) setForm('normal'); }, [formOptions, form]);
  const acidH = useMemo(() => { try { return acidEl && acidOx && acidOx > 0 ? oxoacid(acidEl, acidOx, form).acidicH : 0; } catch { return 0; } }, [acidEl, acidOx, form]);
  useEffect(() => { if (hLeft >= acidH && hLeft !== 0) setHLeft(0); }, [acidH, hLeft]);

  const quick = formed.filter((f) => (route === 'oxido-agua' ? f.compound.fn === 'oxido-basico' || f.compound.fn === 'oxido-anfotero'
    : route === 'anhidrido-agua' ? f.compound.fn === 'oxido-acido'
      : route === 'neutralizacion' ? f.compound.fn === 'hidroxido' || f.compound.fn === 'hidracido' || f.compound.fn === 'oxacido' : false));
  const useFormed = (f: FormedEntry) => {
    const s = f.compound.spec;
    if (route === 'neutralizacion' && (s.kind === 'hidracido' || s.kind === 'oxacido')) {
      const st = s.kind === 'hidracido' ? (s.el === 'S' ? -2 : -1) : s.ox;
      setSlots((x) => [x[0], s.el]); setOx((o) => [o[0], st]); if (s.kind === 'oxacido') setForm(s.form ?? 'normal');
    } else if ('el' in s && 'ox' in s) {
      setSlots((x) => [s.el, x[1]]); setOx((o) => [s.ox, o[1]]);
      if (route === 'anhidrido-agua') setForm('normal');
    }
    clear();
    playSound('click', { intensity: 0.3 });
  };

  const families = (['oxidos', 'hidroxidos-acidos', 'sales'] as ForgeFamily[]);
  const slotName = (i: number) => (slots[i] ? `${ptElement(slots[i]!).es} (${slots[i]})` : 'sin elegir');

  return (
    <div className="lab-layout">
      <div className="stack">
        <section className="card stack" aria-labelledby={`${idPrefix}-h`}>
          <h3 id={`${idPrefix}-h`}>Taller de formación de compuestos</h3>
          <p className="small" style={{ margin: 0 }}>Elige los elementos en la tabla periódica, su número de oxidación y una ruta de formación. El taller calcula la fórmula por neutralidad de cargas, balancea la ecuación, clasifica la función, da los nombres y te explica cuándo una combinación no es posible.</p>
          {two && (
            <Segmented label="Casilla que llenas al tocar la tabla" value={String(active)} options={[0, 1].map((i) => ({ value: String(i), label: `${i + 1} · ${def.slotLabels[i]}` }))} onChange={(v) => setActive(Number(v) as 0 | 1)} />
          )}
          <PeriodicPicker idPrefix={idPrefix} selected={two ? slots : [slots[0]]} onPick={pick} suggested={suggestedSet} />
          <p className="small" style={{ margin: 0 }} aria-live="polite">
            {two ? <>Casilla 1 ({def.slotLabels[0]}): <strong>{slotName(0)}</strong> · Casilla 2 ({def.slotLabels[1]}): <strong>{slotName(1)}</strong></> : <>Elegido ({def.slotLabels[0]}): <strong>{slotName(0)}</strong></>}
          </p>
        </section>

        <Readout items={[
          { k: 'Fórmula', v: ok ? ok.product.formulaPretty : fail ? '—' : 'forma un compuesto', data: true },
          { k: 'Función', v: ok ? FUNCTION_LABEL[ok.product.fn].split(' (')[0] : fail ? 'combinación no válida' : '—' },
          { k: 'Ecuación balanceada', v: ok ? ok.equation : '—', data: true },
          { k: 'Registro en PubChem', v: reg ? (reg.status === 'registrado' ? `registrado (CID ${reg.entry.cid})` : reg.status === 'misma-formula' ? `solo la fórmula (CID ${reg.entry.cid})` : reg.status === 'formal' ? 'no encontrado: fórmula formal' : 'sin información') : '—' },
        ]} />

        {fail && (
          <div className="notice warn" role="status">
            <strong>{fail.title}.</strong> {fail.message}{fail.hint && <> <em>{fail.hint}</em></>}
          </div>
        )}

        {ok && (
          <section className="card stack" aria-labelledby={`${idPrefix}-res-h`}>
            <h3 id={`${idPrefix}-res-h`}>Resultado: <span className="data-value" style={{ fontFamily: 'var(--font-data)' }}>{ok.product.formulaPretty}</span></h3>
            <p className="forge-eq">{ok.equation.split(' → ').map((side, si) => (
              <span key={si}>{si > 0 && ' → '}{side.split(' + ').map((t, ti) => <span key={ti}>{ti > 0 && ' + '}<span className="t">{t}</span></span>)}</span>
            ))}</p>
            <p className="small" style={{ margin: 0 }}>{ok.reactants.map((t) => `${t.coef > 1 ? `${t.coef} ` : ''}${t.name}`).join(' + ')} → {ok.products.map((t) => `${t.coef > 1 ? `${t.coef} ` : ''}${t.name}`).join(' + ')}</p>
            <div className={`forge-badge ${pathwayClass[ok.pathway]}`}><strong>{PATHWAY_LABEL[ok.pathway]}.</strong> {ok.pathwayNote}</div>
            {regText && reg && (
              <div className={`notice ${reg.status === 'registrado' ? 'ok' : reg.status === 'misma-formula' ? 'info' : 'warn'}`}>
                <strong>{regText.title}.</strong> {regText.detail}{(reg.status === 'registrado' || reg.status === 'misma-formula') && <> <a href={pubchemUrl(reg.entry.cid)} target="_blank" rel="noopener noreferrer">Ver el registro en PubChem<span className="sr-only"> (se abre en otra pestaña)</span></a></>}
              </div>
            )}
            <NamesCard compound={ok.product} idPrefix={`${idPrefix}-nm`} />
            {ok.notes.length > 0 && <ul className="small list">{ok.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            <details>
              <summary className="small">Balanceo por el método algebraico (balancing.ts)</summary>
              <p className="small" style={{ margin: '6px 0' }}>Un coeficiente por sustancia (a, b, c…) y una ecuación por elemento; se resuelve con fracciones exactas y se toman los menores enteros:</p>
              <ul className="small list">{ok.balanceSteps.map((s) => <li key={s} className="data-value">{s}</li>)}</ul>
            </details>
          </section>
        )}

        {ok && <ChargeModel compound={ok.product} idPrefix={idPrefix} />}
        {ok && <Viewer3D key={`${ok.product.key}-${ok.route.id}`} result={ok} idPrefix={idPrefix} />}

        <section className="card stack" aria-labelledby={`${idPrefix}-ret-h`}>
          <h3 id={`${idPrefix}-ret-h`}>Retos opcionales</h3>
          <p className="small" style={{ margin: 0 }} aria-live="polite">Logrados: <strong>{Object.keys(done).length}</strong> de {FORGE_CHALLENGES.length}. Cada reto logrado se guarda en la tabla «Retos del taller» del cuaderno.</p>
          <ol className="list stack-sm forge-challenges">
            {FORGE_CHALLENGES.map((c) => (
              <li key={c.id}>
                <span className={`forge-status ${done[c.id] ? 'ok' : ''}`}>{done[c.id] ? 'Logrado' : 'Pendiente'}</span> {c.text}
                <details><summary className="small">Pista</summary><p className="small muted" style={{ margin: '4px 0 0' }}>{c.hint}</p></details>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>1 · Ruta de formación</h3>
          <div className="field">
            <label htmlFor={`${uid}-ruta`}>Ruta de formación</label>
            <select id={`${uid}-ruta`} value={route} onChange={(e) => changeRoute(e.target.value as RouteId)}>
              {families.map((f) => (
                <optgroup key={f} label={FAMILY_LABEL[f]}>
                  {ROUTES.filter((r) => r.family === f).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{def.help}</p>
        </div>

        <div className="card stack">
          <h3>2 · Elementos y números de oxidación</h3>
          {[0, 1].slice(0, def.slots).map((i) => {
            const sym = slots[i];
            const st = sugg(route, i as 0 | 1, sym);
            const label = `Número de oxidación ${sym ? `del ${ptElement(sym).es}` : ''} (casilla ${i + 1})`.replace('del plata', 'de la plata').replace('  ', ' ');
            return (
              <div key={i} className="stack-sm forge-slot">
                <p className="small" style={{ margin: 0 }}><strong>Casilla {i + 1} · {def.slotLabels[i]}:</strong> {sym ? <span className="data-value">{sym} · {ptElement(sym).es}</span> : <span className="muted">elige en la tabla</span>}</p>
                <div className="field">
                  <label htmlFor={`${uid}-ox${i}`}>{label}</label>
                  <select id={`${uid}-ox${i}`} value={ox[i] ?? ''} disabled={!sym} onChange={(e) => { const v = Number(e.target.value); setOx((o) => { const n = [...o]; n[i] = v; return n; }); clear(); }}>
                    {ox[i] === null && <option value="">—</option>}
                    {STATE_CHOICES.map((s) => <option key={s} value={s}>{stateLabel(s)}{st.includes(s) ? ' · habitual en esta ruta' : ''}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
          {formOptions.length > 1 && (
            <Segmented label="Grado de hidratación del ácido" value={form} options={formOptions.map((f) => ({ value: f, label: f === 'normal' ? 'normal (orto)' : f === 'meta' ? 'meta' : 'di- (piro-)' }))} onChange={(v) => { setForm(v); clear(); }} />
          )}
          {route === 'neutralizacion' && acidH > 1 && (
            <Segmented label="Neutralización" value={String(hLeft)} options={Array.from({ length: acidH }, (_, h) => ({ value: String(h), label: h === 0 ? 'total' : `parcial (conserva ${h} H)` }))} onChange={(v) => { setHLeft(Number(v)); clear(); }} />
          )}
          {quick.length > 0 && (
            <div className="stack-sm">
              <span className="small" style={{ fontWeight: 600 }}>Usa un compuesto que ya formaste</span>
              <div className="btn-row">{quick.map((f) => <button key={f.key} type="button" className="btn small" onClick={() => useFormed(f)} aria-label={`Usar ${f.compound.formulaPretty} (${f.compound.names.stock ?? f.compound.names.tradicional ?? f.compound.names.sistematica})`}>{f.compound.formulaPretty}</button>)}</div>
            </div>
          )}
          <button type="button" className="btn primary" onClick={build}>Formar el compuesto</button>
          <RecordButton onRecord={record} disabled={!ok} label="Guardar en el cuaderno" />
          {!ok && <p className="small muted" style={{ margin: 0 }}>Forma un compuesto para poder guardarlo en la tabla «Taller de compuestos».</p>}
        </div>

        <div className="card stack">
          <h3>Procedencia</h3>
          <div className="btn-row" role="note" aria-label="Procedencia de los resultados del taller">
            <StatusChip status="modelo" prefix="Fórmula y nombres" />
            <StatusChip status="modelo" prefix="Ecuación" />
          </div>
          <p className="small" style={{ margin: 0 }}>Fórmula por neutralidad de cargas y nombres: motor de nomenclatura validado con 149 compuestos de PubChem. Ecuación: método algebraico (balancing.ts). La vía de obtención es una nota de la bibliografía, no un cálculo.</p>
          <p className="small muted" style={{ margin: 0 }}>Registro en PubChem de los {REGISTRY_META.total} compuestos que puede formar el taller (consulta del {REGISTRY_META.fecha}, {REGISTRY_META.script}): {REGISTRY_META.porNombre} hallados por su nombre, {REGISTRY_META.registrados - REGISTRY_META.porNombre} solo por la fórmula y {REGISTRY_META.formales} fórmulas formales.</p>
          <p className="small muted" style={{ margin: 0 }}>Elementos del taller: 31 (resaltados). Los demás se pueden elegir y el taller explica por qué no los incluye.</p>
        </div>
      </div>
    </div>
  );
}

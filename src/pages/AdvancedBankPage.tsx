import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Competency } from '../core/types';
import { ADVANCED_BANK, blockName, blocksIn, pct, scoreAnswers, suggestReinforcement, weakest, type Answers } from '../assessment/avanzado';
import { crossTable, resultsCsv } from '../assessment/avanzado/instruments';
import { COMPETENCIES, COMPETENCY_NAME, DISCLAIMER, LEVELS, LEVEL_NAME, TIMER_NOTE } from '../assessment/avanzado/labels';
import { BLOCKS, type AdvancedItem, type BlockId, type Key, type Level } from '../assessment/avanzado/types';
import { GuidedItem, ItemBody, OptionsRadio, SolutionPanel, type GuidedRecord } from '../components/avanzado/AdvancedItemView';
import { ConfirmButton, Notice, Segmented, Select } from '../components/ui';
import { Icon } from '../components/icons';
import { onTabListKeyDown } from '../lib/a11y';
import { downloadText } from '../lib/report';
import { href, parseHash } from '../lib/router';
import { loadJSON, removeKey, saveJSON } from '../lib/storage';

/**
 * Banco avanzado tipo Saber 11 (180 ítems originales en seis bloques, que se incorporan por entregas) con las tres
 * modalidades del encargo: A. Práctica guiada, B. Simulacro y C. Refuerzo personalizado.
 * Las respuestas se guardan solo en este navegador (src/lib/storage.ts, tolerante a almacenamiento bloqueado).
 */
type Mode = 'guiada' | 'simulacro' | 'refuerzo';
const MODES: { id: Mode; label: string }[] = [
  { id: 'guiada', label: 'A. Práctica guiada' },
  { id: 'simulacro', label: 'B. Simulacro' },
  { id: 'refuerzo', label: 'C. Refuerzo personalizado' },
];
const GUIDED_KEY = 'lvcn:banco-avanzado:guiada';
const SIM_KEY = 'lvcn:banco-avanzado:simulacro';

interface SimState {
  ids: string[];
  answers: Answers;
  startedAt: number;
  /** Minutos del temporizador fijado por el docente (null: sin temporizador). */
  minutes: number | null;
  finishedAt: number | null;
  timeUp?: boolean;
}

type Records = Record<string, GuidedRecord>;

function initialMode(): Mode {
  const m = parseHash(window.location.hash).query.get('modo');
  return m === 'simulacro' || m === 'refuerzo' ? m : 'guiada';
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const blockOptions = (bank: readonly AdvancedItem[], all = 'Todos los bloques') => [{ value: '', label: all }, ...blocksIn(bank).map((b) => ({ value: b, label: blockName(b) }))];

/**
 * Ítem con retroalimentación inmediata (modalidades A y C). Guarda la última respuesta comprobada; al reintentar se
 * conserva si acertó al primer intento.
 */
function GuidedSlot({ item, records, setRecords }: { item: AdvancedItem; records: Records; setRecords: (fn: (r: Records) => Records) => void }) {
  const [draft, setDraft] = useState<Key | undefined>();
  const [retrying, setRetrying] = useState(false);
  const rec = retrying ? undefined : records[item.id];
  return (
    <GuidedItem
      item={item} record={rec} draft={draft} onDraft={setDraft}
      onCheck={(k) => { setRetrying(false); setRecords((r) => ({ ...r, [item.id]: { chosen: k, correct: k === item.key, firstTryCorrect: r[item.id]?.firstTryCorrect ?? k === item.key } })); }}
      onRetry={() => { setDraft(undefined); setRetrying(true); }}
    />
  );
}

/* --------------------------- Modalidad A: guiada --------------------------- */
function GuidedMode({ bank, records, setRecords }: { bank: readonly AdvancedItem[]; records: Records; setRecords: (fn: (r: Records) => Records) => void }) {
  const [block, setBlock] = useState('');
  const [idx, setIdx] = useState(0);
  const list = bank.filter((it) => !block || it.block === block);
  const it = list[Math.min(idx, list.length - 1)];
  const answered = list.filter((x) => records[x.id]);
  const firstOk = answered.filter((x) => records[x.id].firstTryCorrect).length;
  const topRef = useRef<HTMLDivElement>(null);
  const go = (i: number) => { setIdx(i); requestAnimationFrame(() => topRef.current?.focus()); };
  return (
    <div className="stack">
      <p className="muted">Responde una pregunta a la vez. Al comprobar verás por qué la clave es correcta, por qué cada distractor es incorrecto, el error que conviene evitar y una estrategia.</p>
      <div className="filters">
        <Select label="Bloque" id="adv-g-block" value={block} onChange={(v) => { setBlock(v); setIdx(0); }} options={blockOptions(bank)} />
        <Select label="Ir a la pregunta" id="adv-g-jump" value={it ? it.id : ''} onChange={(v) => go(list.findIndex((x) => x.id === v))} options={list.map((x) => ({ value: x.id, label: `${x.n}. ${x.topic}${records[x.id] ? (records[x.id].correct ? ' ✓' : ' ✗') : ''}` }))} />
      </div>
      <div className="kpis">
        <div className="kpi"><div className="v">{answered.length}/{list.length}</div><div className="k">respondidas</div></div>
        <div className="kpi"><div className="v">{answered.length ? `${Math.round((firstOk / answered.length) * 100)} %` : '—'}</div><div className="k">aciertos al primer intento</div></div>
      </div>
      {it && (
        <div ref={topRef} tabIndex={-1} className="stack-sm adv-focus" aria-label={`Pregunta ${idx + 1} de ${list.length}`}>
          <p className="small muted" aria-live="polite">Pregunta {Math.min(idx, list.length - 1) + 1} de {list.length}</p>
          <GuidedSlot key={it.id} item={it} records={records} setRecords={setRecords} />
          <div className="btn-row adv-nav">
            <button type="button" className="btn" disabled={idx <= 0} onClick={() => go(idx - 1)}>← Anterior</button>
            <button type="button" className="btn primary" disabled={idx >= list.length - 1} onClick={() => go(idx + 1)}>Siguiente →</button>
          </div>
        </div>
      )}
      <div className="btn-row"><ConfirmButton label="Borrar mis respuestas de práctica" confirmLabel="¿Borrar tus respuestas de la práctica guiada y del refuerzo?" onConfirm={() => setRecords(() => ({}))} /></div>
    </div>
  );
}

/* ---------------------------- Modalidad B: simulacro ---------------------------- */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function SimSetup({ bank, onStart }: { bank: readonly AdvancedItem[]; onStart: (s: SimState) => void }) {
  const available = blocksIn(bank);
  const [chosen, setChosen] = useState<BlockId[]>(available);
  const [count, setCount] = useState('10');
  const [order, setOrder] = useState<'orden' | 'mezclado'>('orden');
  const [useTimer, setUseTimer] = useState(false);
  const [minutes, setMinutes] = useState('30');
  const pool = bank.filter((it) => chosen.includes(it.block));
  const counts = [5, 10, 20, 30, 60, 90].filter((n) => n < pool.length);
  const n = count === 'todas' ? pool.length : Math.min(Number(count), pool.length);
  const mins = Number(minutes);
  const timerOk = !useTimer || (Number.isFinite(mins) && mins >= 1 && mins <= 600);
  const toggle = (b: BlockId) => setChosen((c) => (c.includes(b) ? c.filter((x) => x !== b) : [...c, b]));
  const start = () => {
    let picked = shuffle(pool).slice(0, n);
    if (order === 'orden') picked = picked.sort((a, b) => a.n - b.n);
    onStart({ ids: picked.map((it) => it.id), answers: {}, startedAt: Date.now(), minutes: useTimer ? Math.round(mins) : null, finishedAt: null });
  };
  return (
    <section className="card stack" aria-labelledby="adv-sim-setup-h">
      <h3 id="adv-sim-setup-h">Prepara tu simulacro</h3>
      <p className="small muted">Respondes sin ver las claves. Al terminar ves tu puntaje por competencia y por bloque, y el solucionario completo. Las preguntas se eligen al azar entre los bloques que marques.</p>
      <fieldset className="adv-blocks">
        <legend>Bloques</legend>
        {available.map((b) => (
          <label key={b} className="check"><input type="checkbox" checked={chosen.includes(b)} onChange={() => toggle(b)} /> {blockName(b)} <span className="muted">({bank.filter((it) => it.block === b).length})</span></label>
        ))}
      </fieldset>
      <div className="filters">
        <Select label="Número de preguntas" id="adv-sim-count" value={count} onChange={setCount} options={[...counts.map((c) => ({ value: String(c), label: `${c} preguntas` })), { value: 'todas', label: `Todas las de los bloques marcados (${pool.length})` }]} />
        <Segmented label="Orden" value={order} onChange={setOrder} options={[{ value: 'orden', label: 'Por número' }, { value: 'mezclado', label: 'Mezclado' }]} />
      </div>
      <div className="stack-sm adv-timer-setup">
        <label className="check"><input type="checkbox" checked={useTimer} onChange={(e) => setUseTimer(e.target.checked)} /> Usar un temporizador fijado por el docente</label>
        {useTimer && (
          <div className="field">
            <label htmlFor="adv-sim-min">Minutos (no oficial)</label>
            <input id="adv-sim-min" type="number" min={1} max={600} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-describedby="adv-sim-min-hint" />
            <span className="hint" id="adv-sim-min-hint">{TIMER_NOTE}</span>
          </div>
        )}
        {!useTimer && <p className="small muted">{TIMER_NOTE}</p>}
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={!n || !timerOk} onClick={start}><Icon name="experimento" size={18} />Empezar simulacro de {n} {n === 1 ? 'pregunta' : 'preguntas'}</button>
        {!n && <span className="small muted">Marca al menos un bloque.</span>}
        {!timerOk && <span className="small" role="status">Escribe entre 1 y 600 minutos.</span>}
      </div>
    </section>
  );
}

function SimRunning({ items, sim, setSim }: { items: AdvancedItem[]; sim: SimState; setSim: (s: SimState) => void }) {
  const now = useNow(sim.minutes !== null);
  const remaining = sim.minutes !== null ? sim.startedAt + sim.minutes * 60_000 - now : null;
  const answered = items.filter((it) => sim.answers[it.id]).length;
  const finish = (timeUp = false) => setSim({ ...sim, finishedAt: Date.now(), timeUp });
  useEffect(() => { if (remaining !== null && remaining <= 0) finish(true); });
  return (
    <div className="stack">
      <div className="adv-sim-bar" role="region" aria-label="Estado del simulacro">
        <span><strong>{answered}</strong> de {items.length} respondidas</span>
        {remaining !== null && <span role="timer" aria-live="off" aria-label={`Tiempo restante: ${mmss(remaining)} (temporizador no oficial)`}>⏱ {mmss(remaining)} <span className="small muted">no oficial</span></span>}
        {answered === items.length
          ? <button type="button" className="btn primary small" onClick={() => finish()}>Terminar simulacro</button>
          : <ConfirmButton className="btn small" label="Terminar simulacro" confirmLabel={`Te faltan ${items.length - answered}. ¿Terminar?`} onConfirm={() => finish()} />}
      </div>
      <Notice>Las claves y las explicaciones aparecen solo al terminar.</Notice>
      {items.map((it, i) => (
        <SimQuestion key={it.id} item={it} index={i + 1} value={sim.answers[it.id]} onChange={(k) => setSim({ ...sim, answers: { ...sim.answers, [it.id]: k } })} />
      ))}
      <div className="btn-row">
        {answered === items.length
          ? <button type="button" className="btn primary" onClick={() => finish()}>Terminar simulacro y ver resultados</button>
          : <ConfirmButton className="btn primary" label="Terminar simulacro y ver resultados" confirmLabel={`Hay ${items.length - answered} sin responder. ¿Terminar de todos modos?`} onConfirm={() => finish()} />}
      </div>
    </div>
  );
}

function SimQuestion({ item, index, value, onChange }: { item: AdvancedItem; index: number; value?: Key; onChange: (k: Key) => void }) {
  const headingId = useId();
  return (
    <article className="card question adv-item" aria-labelledby={headingId} data-simulacro-item={index}>
      <ItemBody item={item} headingId={headingId} showMeta={false} />
      <OptionsRadio item={item} value={value} onChange={onChange} />
    </article>
  );
}

function ResultsTable({ items, answers }: { items: AdvancedItem[]; answers: Answers }) {
  const x = crossTable(items, answers);
  const cell = (t?: { total: number; correct: number }) => (t && t.total ? `${t.correct}/${t.total} (${pct(t)} %)` : '—');
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Resultados por competencia y bloque">
      <table className="adv-results">
        <caption>Aciertos por competencia y bloque</caption>
        <thead><tr><th scope="col">Competencia</th>{x.blocks.map((b) => <th key={b} scope="col">Bloque {b}</th>)}<th scope="col">Total</th></tr></thead>
        <tbody>
          {COMPETENCIES.map((c) => <tr key={c}><th scope="row">{COMPETENCY_NAME[c]}</th>{x.blocks.map((b) => <td key={b} className="n">{cell(x.cells[c][b])}</td>)}<td className="n"><strong>{cell(x.rowTotals[c])}</strong></td></tr>)}
          <tr><th scope="row">Total</th>{x.blocks.map((b) => <td key={b} className="n"><strong>{cell(x.colTotals[b])}</strong></td>)}<td className="n"><strong>{cell(x.total)}</strong></td></tr>
        </tbody>
      </table>
    </div>
  );
}

function SimResults({ items, sim, onNew, onReinforce }: { items: AdvancedItem[]; sim: SimState; onNew: () => void; onReinforce: () => void }) {
  const score = scoreAnswers(items, sim.answers);
  const w = weakest(score);
  const [student, setStudent] = useState('');
  const [course, setCourse] = useState('');
  const [msg, setMsg] = useState('');
  const solRef = useRef<HTMLElement>(null);
  const date = new Date(sim.finishedAt ?? Date.now()).toISOString().slice(0, 10);
  const download = () => {
    const ok = downloadText(`simulacro-banco-avanzado-${date}.csv`, resultsCsv(items, sim.answers, { student, course, date }), 'text/csv');
    setMsg(ok ? 'Se descargaron los resultados en CSV.' : 'Este entorno no permite descargas.');
  };
  return (
    <div className="stack">
      <section className="card stack" aria-labelledby="adv-res-h">
        <h3 id="adv-res-h" tabIndex={-1}>Resultados del simulacro</h3>
        {sim.timeUp && <Notice kind="warn">Se acabó el tiempo fijado por el docente; las preguntas sin responder cuentan como no acertadas.</Notice>}
        <div className="kpis">
          <div className="kpi"><div className="v">{score.correct}/{score.total}</div><div className="k">aciertos</div></div>
          <div className="kpi"><div className="v">{score.total ? Math.round((score.correct / score.total) * 100) : 0} %</div><div className="k">porcentaje</div></div>
          <div className="kpi"><div className="v">{score.total - score.answered}</div><div className="k">sin responder</div></div>
        </div>
        <ResultsTable items={items} answers={sim.answers} />
        {(w.competency || w.block) && (
          <p>Para reforzar: <strong>{w.competency ? COMPETENCY_NAME[w.competency] : '—'}</strong>{w.block && <> y el <strong>{blockName(w.block)}</strong></>}. Es una orientación para practicar, no un diagnóstico: con pocas preguntas por competencia el resultado varía mucho.</p>
        )}
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => { solRef.current?.scrollIntoView({ block: 'start' }); solRef.current?.focus(); }}>Ver el solucionario</button>
          <button type="button" className="btn" onClick={onReinforce}>Practicar lo sugerido (refuerzo)</button>
          <button type="button" className="btn ghost" onClick={onNew}>Nuevo simulacro</button>
        </div>
        <details>
          <summary>Descargar los resultados (CSV para el docente)</summary>
          <div className="filters">
            <div className="field"><label htmlFor="adv-res-name">Nombre (opcional)</label><input id="adv-res-name" type="text" value={student} onChange={(e) => setStudent(e.target.value)} /></div>
            <div className="field"><label htmlFor="adv-res-course">Curso (opcional)</label><input id="adv-res-course" type="text" value={course} onChange={(e) => setCourse(e.target.value)} /></div>
          </div>
          <div className="btn-row"><button type="button" className="btn" onClick={download}><Icon name="descargar" size={18} />Descargar resultados (CSV)</button></div>
          {msg && <p className="small" role="status">{msg}</p>}
        </details>
      </section>
      <section ref={solRef} tabIndex={-1} className="stack adv-focus" id="adv-solucionario" aria-labelledby="adv-sol-h">
        <h3 id="adv-sol-h">Solucionario</h3>
        {items.map((it) => {
          const a = sim.answers[it.id];
          return (
            <details key={it.id} className="card adv-sol">
              <summary>
                <span>Pregunta {it.n} · {it.topic}</span>
                <span className={`chip ${a === it.key ? 'ok' : 'bad'}`}>{a ? `Elegiste ${a}` : 'Sin responder'} · clave {it.key} {a === it.key ? '✓' : '✗'}</span>
              </summary>
              <div className="stack-sm">
                <ItemBody item={it} headingId={`sol-${it.id}`} />
                <OptionsRadio item={it} value={a} disabled reveal />
                <SolutionPanel item={it} chosen={a} />
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}

function SimulacroMode({ bank, sim, setSim, onReinforce }: { bank: readonly AdvancedItem[]; sim: SimState | null; setSim: (s: SimState | null) => void; onReinforce: () => void }) {
  const items = useMemo(() => (sim ? sim.ids.map((id) => bank.find((it) => it.id === id)).filter((x): x is AdvancedItem => !!x) : []), [sim, bank]);
  if (!sim || !items.length) return <SimSetup bank={bank} onStart={(s) => { setSim(s); window.scrollTo({ top: 0 }); }} />;
  if (!sim.finishedAt) return <SimRunning items={items} sim={sim} setSim={setSim} />;
  return <SimResults items={items} sim={sim} onNew={() => setSim(null)} onReinforce={onReinforce} />;
}

/* ------------------------- Modalidad C: refuerzo ------------------------- */
const PAGE = 5;
function RefuerzoMode({ bank, records, setRecords, sim, suggested, setSuggested }: {
  bank: readonly AdvancedItem[]; records: Records; setRecords: (fn: (r: Records) => Records) => void; sim: SimState | null; suggested: boolean; setSuggested: (v: boolean) => void;
}) {
  const [comp, setComp] = useState('');
  const [block, setBlock] = useState('');
  const [level, setLevel] = useState('');
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const finished = sim?.finishedAt ? sim : null;
  const simItems = useMemo(() => (finished ? finished.ids.map((id) => bank.find((it) => it.id === id)).filter((x): x is AdvancedItem => !!x) : []), [finished, bank]);
  const score = finished ? scoreAnswers(simItems, finished.answers) : null;
  const w = score ? weakest(score) : null;
  const failedIds = new Set(simItems.filter((it) => finished && finished.answers[it.id] !== it.key).map((it) => it.id));
  const list = suggested && score && finished
    ? suggestReinforcement(bank, score, finished.answers)
    : bank.filter((it) => (!comp || it.competency === comp) && (!block || it.block === block) && (!level || String(it.level) === level) && (!onlyFailed || failedIds.has(it.id)));
  const key = [suggested, comp, block, level, onlyFailed].join('|');
  useEffect(() => { setShown(PAGE); }, [key]);
  return (
    <div className="stack">
      <p className="muted">El docente o el estudiante eligen las competencias, bloques y niveles con dificultades y practican solo esas preguntas, con la retroalimentación comentada.</p>
      {finished && w && (
        <section className="card stack-sm adv-suggest" aria-labelledby="adv-sug-h">
          <h3 id="adv-sug-h">Sugerencia según tu último simulacro</h3>
          <p>Lo más débil fue <strong>{w.competency ? COMPETENCY_NAME[w.competency] : '—'}</strong>{w.block && <> y el <strong>{blockName(w.block)}</strong></>} ({score!.correct}/{score!.total} aciertos en total).</p>
          <div className="btn-row">
            <button type="button" className="btn primary" aria-pressed={suggested} onClick={() => setSuggested(!suggested)}>{suggested ? 'Volver a los filtros' : 'Ver las preguntas sugeridas'}</button>
          </div>
        </section>
      )}
      {!suggested && (
        <div className="filters">
          <Select label="Competencia" id="adv-r-comp" value={comp} onChange={setComp} options={[{ value: '', label: 'Todas' }, ...COMPETENCIES.map((c: Competency) => ({ value: c, label: COMPETENCY_NAME[c] }))]} />
          <Select label="Bloque o componente" id="adv-r-block" value={block} onChange={setBlock} options={blockOptions(bank, 'Todos')} />
          <Select label="Nivel de complejidad" id="adv-r-level" value={level} onChange={setLevel} options={[{ value: '', label: 'Todos' }, ...LEVELS.map((l: Level) => ({ value: String(l), label: LEVEL_NAME[l] }))]} />
          {finished && <label className="check adv-check-field"><input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> Solo las que fallé en el último simulacro</label>}
        </div>
      )}
      <p className="small muted" aria-live="polite">{list.length} {list.length === 1 ? 'pregunta' : 'preguntas'}{suggested ? (list.length === 1 ? ' sugerida' : ' sugeridas') : ' con estos filtros'}.</p>
      {list.slice(0, shown).map((it) => (
        <GuidedSlot key={it.id} item={it} records={records} setRecords={setRecords} />
      ))}
      {list.length > shown && (
        <div className="load-more">
          <p className="small muted">Mostrando {shown} de {list.length}.</p>
          <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>Mostrar {Math.min(PAGE, list.length - shown)} más</button>
        </div>
      )}
      {list.length === 0 && <div className="empty-state" role="status"><p className="empty-title">No hay preguntas con esos filtros</p><p>Quita algún filtro.</p></div>}
    </div>
  );
}

/* --------------------------------- Página --------------------------------- */
const MODE_TEXT: Record<Mode, string> = {
  guiada: 'Respondes y recibes de inmediato la explicación comentada, con el análisis de tu error.',
  simulacro: 'Respondes un conjunto sin ver las claves; al terminar ves tu puntaje y el solucionario.',
  refuerzo: 'Eliges competencias, bloques y niveles con dificultades, o sigues la sugerencia del último simulacro.',
};

export function AdvancedBankPage() {
  const [bank, setBank] = useState<readonly AdvancedItem[]>(ADVANCED_BANK);
  const [sample, setSample] = useState(false);
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [records, setRecordsState] = useState<Records>(() => loadJSON<Records>(GUIDED_KEY, {}));
  const [sim, setSimState] = useState<SimState | null>(() => loadJSON<SimState | null>(SIM_KEY, null));
  const [suggested, setSuggested] = useState(false);
  useEffect(() => { document.title = 'Banco avanzado Saber 11 · Laboratorio Virtual'; }, []);
  // Solo en desarrollo: «?muestra=1» carga la muestra de pruebas para revisar la interfaz sin bloques publicados.
  useEffect(() => {
    if (import.meta.env.DEV && parseHash(window.location.hash).query.get('muestra') === '1') {
      void import('../../tests/fixtures/avanzado-muestra').then((m) => { setBank(m.MUESTRA_AVANZADO); setSample(true); });
    }
  }, []);
  const setRecords = (fn: (r: Records) => Records) => setRecordsState((r) => { const n = fn(r); saveJSON(GUIDED_KEY, n); return n; });
  const setSim = (s: SimState | null) => { setSimState(s); if (s) saveJSON(SIM_KEY, s); else removeKey(SIM_KEY); };
  const setMode = (m: Mode) => {
    setModeState(m);
    const q = new URLSearchParams(parseHash(window.location.hash).query);
    if (m === 'guiada') q.delete('modo'); else q.set('modo', m);
    try { window.history.replaceState(null, '', `#/banco/avanzado${q.toString() ? `?${q}` : ''}`); } catch { /* sin historial */ }
  };
  const blocks = blocksIn(bank);
  return (
    <div className="stack bank adv-bank">
      <header className="page-head">
        <nav aria-label="Ruta de navegación" className="crumbs small">
          <a href={href()}>Inicio</a><span aria-hidden="true">/</span><a href={href('banco')}>Banco Saber 11</a><span aria-hidden="true">/</span><span aria-current="page">Banco avanzado</span>
        </nav>
        <h1>Banco avanzado tipo Saber 11 · Ciencias Naturales</h1>
        <p className="lead muted">Preguntas de selección múltiple con única respuesta, con contextos, tablas y gráficas, organizadas en seis bloques y tres competencias: uso comprensivo del conocimiento científico, explicación de fenómenos e indagación.</p>
      </header>
      <Notice kind="warn"><strong>Material original de práctica, no oficial.</strong> {DISCLAIMER.replace(/^Material original de práctica elaborado para este laboratorio\. /, '')}</Notice>
      {sample && <Notice>Vista de desarrollo con la muestra de pruebas ({bank.length} preguntas). No es el banco publicado.</Notice>}
      <p className="small muted">
        Bloques disponibles: {blocks.length ? blocks.map((b) => `${b} (${bank.filter((it) => it.block === b).length})`).join(', ') : 'ninguno todavía'} · {bank.length} de 180 preguntas.
        {' '}Matriz del banco (decisión propia, no ponderación oficial): en cada bloque, 10 preguntas por competencia y niveles 1, 2 y 3 en proporción 10/12/8.
      </p>
      {bank.length === 0 ? (
        <div className="empty-state" role="status" data-testid="banco-avanzado-vacio">
          <Icon name="banco" size={32} />
          <p className="empty-title">Los bloques del banco avanzado se están incorporando</p>
          <p>Todavía no hay bloques publicados. Mientras tanto, practica con el <a href={href('banco')}>banco Saber 11</a> de la plataforma.</p>
          <ul className="list small adv-planned">
            {(Object.keys(BLOCKS) as BlockId[]).map((b) => <li key={b}>Bloque {b}: {BLOCKS[b].name} (preguntas {BLOCKS[b].range[0]}–{BLOCKS[b].range[1]})</li>)}
          </ul>
        </div>
      ) : (
        <>
          <div className="stage-nav adv-tabs" role="tablist" aria-label="Modalidades de uso del banco" onKeyDown={onTabListKeyDown}>
            {MODES.map((m) => <button key={m.id} id={`tab-adv-${m.id}`} type="button" role="tab" aria-selected={mode === m.id} aria-controls="adv-panel" tabIndex={mode === m.id ? 0 : -1} onClick={() => setMode(m.id)}>{m.label}</button>)}
          </div>
          <div id="adv-panel" role="tabpanel" aria-labelledby={`tab-adv-${mode}`} className="stack">
            <p className="adv-mode-text">{MODE_TEXT[mode]}</p>
            {mode === 'guiada' && <GuidedMode bank={bank} records={records} setRecords={setRecords} />}
            {mode === 'simulacro' && <SimulacroMode bank={bank} sim={sim} setSim={setSim} onReinforce={() => { setSuggested(true); setMode('refuerzo'); window.scrollTo({ top: 0 }); }} />}
            {mode === 'refuerzo' && <RefuerzoMode bank={bank} records={records} setRecords={setRecords} sim={sim} suggested={suggested} setSuggested={setSuggested} />}
          </div>
          <p className="small muted">Tus respuestas se guardan solo en este navegador. Para el docente: la plantilla de registro y la exportación a Moodle están en <a href={href('docente') + '?seccion=exportar'}>Panel docente → Moodle y Classroom</a>.</p>
        </>
      )}
    </div>
  );
}

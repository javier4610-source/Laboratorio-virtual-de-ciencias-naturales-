import { useMemo, useState } from 'react';
import type { PracticeDef, RelationPair, Trend } from '../core/types';
import type { SessionApi } from '../lib/session';
import { AREA_LABEL, COMPETENCY_LABEL } from '../curriculum/grades';
import { DATASETS } from '../labs/datasets';
import { detectTrend, TREND_LABEL } from '../lib/trend';
import { fmt } from '../lib/format';
import { transferQuestions } from '../assessment/lookup';
import { QuestionCard } from './QuestionCard';
import { cellText } from './DataPanel';
import { Notice } from './ui';
import { ConditionAlert, RelationExplainer } from './Experiment';
import { Chart } from './Chart';
import { scoreSession } from '../lib/report';
import type { ModelSpec } from '../models/types';
import { loadValidations } from '../lib/validation';

/* ------------------------------ Preparación ------------------------------ */
export function PreparationSection({ practice: p, api, onNext }: { practice: PracticeDef; api: SessionApi; onNext: () => void }) {
  const s = api.session;
  return (
    <div className="stack">
      <div className="grid-2">
        <section className="card stack-sm">
          <h3>Objetivos de aprendizaje</h3>
          <ul className="list">{p.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          <h4>Competencias científicas</h4>
          <div className="chips">{p.competencies.map((c) => <span key={c} className="chip">{COMPETENCY_LABEL[c]}</span>)}</div>
        </section>
        <section className="card stack-sm">
          <h3>Materiales e instrumentos virtuales</h3>
          <ul className="list">{p.materials.map((m) => <li key={m}>{m}</li>)}</ul>
        </section>
      </div>
      <section className="card stack-sm">
        <h3>Fundamento científico</h3>
        {p.background.map((b) => <p key={b} style={{ maxWidth: '78ch' }}>{b}</p>)}
      </section>
      <section className="card stack-sm">
        <h3>Variables del experimento</h3>
        <VariablesActivity practice={p} api={api} />
      </section>
      <section className="card stack-sm">
        <h3>Procedimiento</h3>
        <ol className="list">{p.procedure.map((st) => <li key={st}>{st}</li>)}</ol>
      </section>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => { if (!s.visited.includes('preparacion')) api.update((x) => ({ ...x, visited: [...x.visited, 'preparacion'] })); onNext(); }}>
          Entendido: ir al experimento
        </button>
      </div>
    </div>
  );
}

type VarKind = 'independiente' | 'dependiente' | 'controlada';

/** Actividad de indagación: clasificar las variables antes de experimentar. */
function VariablesActivity({ practice: p, api }: { practice: PracticeDef; api: SessionApi }) {
  const items = useMemo(() => {
    const all: { text: string; kind: VarKind }[] = [
      ...p.variables.independent.map((t) => ({ text: t, kind: 'independiente' as const })),
      ...p.variables.dependent.map((t) => ({ text: t, kind: 'dependiente' as const })),
      ...p.variables.controlled.map((t) => ({ text: t, kind: 'controlada' as const })),
    ];
    // Orden fijo pero mezclado (por longitud del texto) para no revelar la clasificación.
    return all.sort((a, b) => (a.text.length % 7) - (b.text.length % 7) || a.text.localeCompare(b.text));
  }, [p]);
  const [choice, setChoice] = useState<Record<string, VarKind | ''>>({});
  const [checked, setChecked] = useState(false);
  const correct = items.filter((it) => choice[it.text] === it.kind).length;
  const allChosen = items.every((it) => choice[it.text]);
  return (
    <div className="stack-sm">
      <p className="small">Clasifica cada variable: <strong>independiente</strong> (la que tú cambias), <strong>dependiente</strong> (la que mides) o <strong>controlada</strong> (la que mantienes constante).</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
        <table>
          <thead><tr><th>Variable</th><th>Tipo</th>{checked && <th>Revisión</th>}</tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.text}>
                <td>{it.text}</td>
                <td style={{ minWidth: 170 }}>
                  <select aria-label={`Tipo de variable: ${it.text}`} value={choice[it.text] ?? ''} id={`var-${p.id}-${i}`}
                    onChange={(e) => { setChoice((c) => ({ ...c, [it.text]: e.target.value as VarKind })); setChecked(false); }}>
                    <option value="">Elegir…</option><option value="independiente">Independiente</option><option value="dependiente">Dependiente</option><option value="controlada">Controlada</option>
                  </select>
                </td>
                {checked && <td>{choice[it.text] === it.kind ? <span className="chip ok">Correcto</span> : <span className="chip bad">Es {it.kind}</span>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="btn-row">
        <button type="button" className="btn" disabled={!allChosen} onClick={() => { setChecked(true); api.update((s) => ({ ...s, variablesCheck: { correct, total: items.length } })); }}>Comprobar clasificación</button>
        {checked && <span role="status" className="small">{correct} de {items.length} correctas. {correct < items.length ? 'Recuerda: la independiente se manipula, la dependiente se mide y las controladas no cambian.' : '¡Muy bien!'}</span>}
      </div>
    </div>
  );
}

/* -------------------------------- Análisis ------------------------------- */
/** «en función de el volumen» → «en función del volumen» (contracción obligatoria en español). */
const enFuncionDe = (x: string) => (/^el /i.test(x) ? `en función del ${x.slice(3)}` : `en función de ${x}`);

/** Lo que muestran los datos: relación elegida, ensayos incluidos, control de variables y tendencia detectada. */
function TrendAnalysis({ practice: p, relations, api }: { practice: PracticeDef; relations: RelationPair[]; api: SessionApi }) {
  const s = api.session;
  const [pairIndex, setPairIndex] = useState(0);
  const pair = relations[pairIndex] ?? relations[0];
  const ds = (DATASETS[p.id] ?? []).find((d) => d.id === pair.datasetId);
  const trials = ds ? s.trials.filter((t) => t.datasetId === ds.id) : [];
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const used = trials.filter((t) => !excluded.has(t.id));
  const points = used.map((t) => ({ x: t.values[pair.x], y: t.values[pair.y] })).filter((pt): pt is { x: number; y: number } => typeof pt.x === 'number' && typeof pt.y === 'number');
  const analysis = detectTrend(points);
  // Control de variables: ¿cambiaron otras variables de entrada en los ensayos usados?
  const varied = (ds?.columns ?? []).filter((c) => c.input && c.key !== pair.x && !(pair.allowVary ?? []).includes(c.key))
    .filter((c) => new Set(used.map((t) => String(t.values[c.key]))).size > 1);
  if (!ds) return null;

  return (
    <section className="card stack">
      <h3>¿Qué muestran tus datos?</h3>
      <div className="field">
        <label htmlFor="an-pair">Relación que analizas</label>
        <select id="an-pair" value={pairIndex} onChange={(e) => { setPairIndex(Number(e.target.value)); setExcluded(new Set()); }}>
          {relations.map((pp, i) => <option key={i} value={i}>{pp.yLabel} {enFuncionDe(pp.xLabel)}</option>)}
        </select>
      </div>
      {trials.length === 0 ? <Notice kind="warn">Aún no hay ensayos en «{ds.label}». Vuelve al experimento y guarda al menos tres.</Notice> : (
        <>
          <details>
            <summary>Elegir qué ensayos incluir en el análisis ({used.length} de {trials.length})</summary>
            <div className="stack-sm">
              {trials.map((t, i) => (
                <label key={t.id} className="check">
                  <input type="checkbox" checked={!excluded.has(t.id)} onChange={(e) => setExcluded((ex) => { const n = new Set(ex); if (e.target.checked) n.delete(t.id); else n.add(t.id); return n; })} />
                  Ensayo {i + 1}: {ds.columns.filter((c) => c.input).map((c) => `${c.label} ${cellText(t.values[c.key], c.decimals)}${c.unit ? ' ' + c.unit : ''}`).join(' · ')}
                </label>
              ))}
            </div>
          </details>
          {varied.length > 0 && (
            <ConditionAlert level="advertencia" title="control de variables"
              cause={<>En los ensayos elegidos también cambió {varied.map((c) => c.label.toLowerCase()).join(', ')}.</>}
              fix={<>Para atribuir el efecto a {pair.xLabel}, deja fijas las demás variables o excluye los ensayos que no correspondan.</>} />
          )}
          <div className="trend-grid">
          <div className="trend-main stack-sm">
          <div className="readout" aria-live="polite">
            <div className="item"><div className="k">Tendencia en tus datos</div><div className="v data">{analysis.trend ? TREND_LABEL[analysis.trend as Exclude<Trend, ''>] : 'no determinada'}</div></div>
            <div className="item"><div className="k">Valores distintos de x</div><div className="v">{analysis.n}</div></div>
            <div className="item"><div className="k">Correlación r</div><div className="v">{analysis.r === null ? '—' : fmt(analysis.r, 2)}</div></div>
          </div>
          <p className="small">{analysis.detail}</p>
          <RelationExplainer xLabel={pair.xLabel} yLabel={pair.yLabel} trendText={analysis.trend ? TREND_LABEL[analysis.trend as Exclude<Trend, ''>] : null} r={analysis.r} n={analysis.n} />
          </div>
          {points.length > 0 && (() => {
            const xc = ds.columns.find((c) => c.key === pair.x);
            const yc = ds.columns.find((c) => c.key === pair.y);
            const ax = (label: string, unit?: string) => (unit ? `${label} (${unit})` : label);
            return (
              <div className="trend-chart">
                <Chart title={`${pair.yLabel} ${enFuncionDe(pair.xLabel)}`} showTitle height={260}
                  series={[{ label: 'Ensayos incluidos', kind: 'scatter', points }]}
                  xLabel={ax(xc?.label ?? pair.xLabel, xc?.unit)} yLabel={ax(yc?.label ?? pair.yLabel, yc?.unit)} xUnit={xc?.unit} yUnit={yc?.unit}
                  exportName={`${p.id}-${ds.id}-relacion`} errorNote="" />
              </div>
            );
          })()}
          </div>
          <p className="small muted">La tendencia se detecta con reglas explícitas (correlación y forma de la curva) y depende de los ensayos que incluyas. Úsala como apoyo, no como verdad absoluta: tu conclusión debe citar los datos que la respaldan.</p>
        </>
      )}
    </section>
  );
}

export function AnalysisSection({ practice: p, api }: { practice: PracticeDef; api: SessionApi }) {
  const s = api.session;
  const setI = (k: string, v: string) => api.update((x) => ({ ...x, interpretations: { ...x.interpretations, [k]: v } }));
  const setC = (patch: Partial<typeof s.conclusion>) => api.update((x) => ({ ...x, conclusion: { ...x.conclusion, ...patch } }));

  const evidenceHasNumbers = /\d/.test(s.conclusion.evidence);
  const reasoningKeyword = p.keywords.some((k) => s.conclusion.reasoning.toLowerCase().includes(k.toLowerCase()));
  const conclusionChecks = [
    { ok: s.conclusion.claim.trim().length >= 20, msg: 'La afirmación responde la pregunta problema en una o dos oraciones.' },
    { ok: evidenceHasNumbers, msg: 'La evidencia cita datos concretos de tu tabla (números con unidades).' },
    { ok: s.conclusion.reasoning.trim().length >= 30 && reasoningKeyword, msg: 'El razonamiento usa conceptos científicos de la práctica para conectar evidencia y afirmación.' },
  ];

  return (
    <div className="stack">
      {p.relations && p.relations.length > 0 && <TrendAnalysis practice={p} relations={p.relations} api={api} />}

      <section className="card stack">
        <h3>Preguntas de interpretación</h3>
        {p.interpretation.map((q, i) => (
          <div className="field" key={q}>
            <label htmlFor={`int-${i}`}>{i + 1}. {q}</label>
            <textarea id={`int-${i}`} value={s.interpretations[String(i)] ?? ''} onChange={(e) => setI(String(i), e.target.value)} />
          </div>
        ))}
      </section>

      <section className="card stack">
        <h3>Conclusión científica</h3>
        <p className="small">{p.conclusionGuide}</p>
        <div className="field"><label htmlFor="con-claim">Afirmación: ¿cuál es la respuesta a la pregunta problema?</label><textarea id="con-claim" value={s.conclusion.claim} onChange={(e) => setC({ claim: e.target.value })} /></div>
        <div className="field"><label htmlFor="con-ev">Evidencia: ¿qué datos la respaldan?</label><textarea id="con-ev" value={s.conclusion.evidence} onChange={(e) => setC({ evidence: e.target.value })} /></div>
        <div className="field"><label htmlFor="con-re">Razonamiento: ¿qué concepto científico explica la relación?</label><textarea id="con-re" value={s.conclusion.reasoning} onChange={(e) => setC({ reasoning: e.target.value })} /></div>
        {(s.conclusion.claim || s.conclusion.evidence || s.conclusion.reasoning) && (
          <div className="stack-sm" aria-live="polite">
            <strong className="small">Revisión automática orientativa (no reemplaza la valoración del docente):</strong>
            <ul className="list small">{conclusionChecks.map((c) => <li key={c.msg} style={{ color: c.ok ? 'var(--ok)' : 'var(--ink-2)' }}>{c.ok ? '✓ ' : '○ '}{c.msg}</li>)}</ul>
          </div>
        )}
        <h4>Limitaciones</h4>
        <p className="small">Recuerda mencionar al menos una limitación del modelo o del procedimiento. Consulta la etapa «Modelo y referencias».</p>
      </section>
    </div>
  );
}

/* ------------------------------- Evaluación ------------------------------ */
export function EvaluationSection({ practice: p, api, mode }: { practice: PracticeDef; api: SessionApi; mode: string }) {
  const s = api.session;
  const score = scoreSession(p, s);
  const [showGuide, setShowGuide] = useState(false);
  const save = (id: string) => (rec: Parameters<NonNullable<Parameters<typeof QuestionCard>[0]['onAnswer']>>[0]) =>
    api.update((x) => ({ ...x, answers: { ...x.answers, [id]: x.answers[id]
      ? { ...rec, firstTryCorrect: x.answers[id].firstTryCorrect, ...(x.answers[id].firstChosen ? { firstChosen: x.answers[id].firstChosen } : {}), ...(x.answers[id].at ? { at: x.answers[id].at } : {}) }
      : { ...rec, firstChosen: rec.chosen, at: Date.now() } } }));
  const transfer = transferQuestions(p);
  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi"><div className="v">{score.answered}/{score.total}</div><div className="k">preguntas respondidas</div></div>
        <div className="kpi"><div className="v">{score.answered ? `${fmt(score.percent, 0)} %` : '—'}</div><div className="k">aciertos al primer intento</div></div>
        {(['uso', 'explicacion', 'indagacion'] as const).map((c) => (
          <div className="kpi" key={c}><div className="v">{score.byCompetency[c].answered ? `${score.byCompetency[c].correct}/${score.byCompetency[c].answered}` : '—'}</div><div className="k">{COMPETENCY_LABEL[c]}</div></div>
        ))}
      </div>
      {mode === 'evaluacion' && <Notice>Modo evaluación: el puntaje cuenta solo el primer intento de cada pregunta. Puedes reintentar para aprender, sin que cambie el puntaje.</Notice>}
      <h3>Preguntas de la práctica</h3>
      {p.assessment.map((q, i) => <QuestionCard key={q.id} question={q} number={i + 1} record={s.answers[q.id]} onAnswer={save(q.id)} />)}
      <section className="card stack">
        <h3>Aplicación a una situación cotidiana</h3>
        <p>{p.application.situation}</p>
        <div className="field">
          <label htmlFor="app-text">{p.application.question}</label>
          <textarea id="app-text" value={s.application} onChange={(e) => api.update((x) => ({ ...x, application: e.target.value }))} />
        </div>
        <button type="button" className="btn small" aria-expanded={showGuide} onClick={() => setShowGuide((v) => !v)}>{showGuide ? 'Ocultar' : 'Ver'} orientaciones para revisar mi respuesta</button>
        {showGuide && <Notice>{p.application.guidance}</Notice>}
      </section>
      <h3>Preguntas de transferencia tipo Saber 11</h3>
      {transfer.map((q, i) => <QuestionCard key={q.id} question={q} number={p.assessment.length + i + 1} record={s.answers[q.id]} onAnswer={save(q.id)} saberLabel />)}
      <FeedbackSurvey api={api} />
    </div>
  );
}

const FEEDBACK_ITEMS = [
  { key: 'easy', text: 'El laboratorio fue fácil de usar.' },
  { key: 'clear', text: 'Entendí qué tenía que hacer en cada paso.' },
  { key: 'learned', text: 'La práctica me ayudó a entender el tema.' },
] as const;

/** Encuesta breve de usabilidad: viaja en el informe y el docente ve los promedios. */
function FeedbackSurvey({ api }: { api: SessionApi }) {
  const fb = api.session.feedback ?? { easy: 0, clear: 0, learned: 0, comment: '' };
  const set = (patch: Partial<typeof fb>) => api.update((x) => ({ ...x, feedback: { ...fb, ...patch } }));
  return (
    <section className="card stack-sm" aria-labelledby="fb-h">
      <h3 id="fb-h">Tu opinión sobre esta práctica (opcional)</h3>
      <p className="small muted">1 = totalmente en desacuerdo · 5 = totalmente de acuerdo. Ayuda a mejorar el laboratorio; no afecta tu nota.</p>
      {FEEDBACK_ITEMS.map((it) => (
        <fieldset key={it.key} className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 600 }}>{it.text}</legend>
          <div className="seg" role="radiogroup" aria-label={it.text}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={fb[it.key] === n} onClick={() => set({ [it.key]: n })}>{n}</button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="field"><label htmlFor="fb-comment">¿Qué cambiarías o qué te confundió?</label><textarea id="fb-comment" value={fb.comment} onChange={(e) => set({ comment: e.target.value })} /></div>
    </section>
  );
}

/* --------------------------------- Modelo -------------------------------- */
export function ModelCard({ spec }: { spec: ModelSpec }) {
  return (
    <div className="stack">
      <section className="card stack-sm">
        <h3>{spec.name}</h3>
        <h4>Ecuaciones y reglas</h4>
        {spec.equations.map((e) => <code key={e} className="eq">{e}</code>)}
      </section>
      <div className="grid-2">
        <section className="card">
          <h4>Variables de entrada</h4>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
            <table>
              <thead><tr><th>Símbolo</th><th>Variable</th><th>Unidad</th><th>Rango</th><th>Inicial</th></tr></thead>
              <tbody>{spec.inputs.map((v) => <tr key={v.symbol + v.name}><td className="mono">{v.symbol}</td><td>{v.name}</td><td>{v.unit}</td><td className="n">{v.range ? `${fmt(v.range[0], v.range[0] < 1 ? 2 : 0)} – ${fmt(v.range[1], 0)}` : '—'}</td><td>{v.initial !== undefined ? String(v.initial).replace('.', ',') : '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h4>Variables de salida</h4>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
            <table>
              <thead><tr><th>Símbolo</th><th>Variable</th><th>Unidad</th></tr></thead>
              <tbody>{spec.outputs.map((v) => <tr key={v.symbol + v.name}><td className="mono">{v.symbol}</td><td>{v.name}</td><td>{v.unit}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
      <div className="grid-2">
        <section className="card"><h4>Condiciones iniciales</h4><ul className="list">{spec.initialConditions.map((x) => <li key={x}>{x}</li>)}</ul></section>
        <section className="card"><h4>Supuestos y simplificaciones</h4><ul className="list">{spec.assumptions.map((x) => <li key={x}>{x}</li>)}</ul></section>
        <section className="card"><h4>Límites del modelo</h4><ul className="list">{spec.limits.map((x) => <li key={x}>{x}</li>)}</ul></section>
        <section className="card"><h4>Casos de prueba automatizados</h4><ul className="list">{spec.testCases.map((x) => <li key={x}>{x}</li>)}</ul><p className="small muted">Se verifican con pruebas unitarias en <code>tests/unit/models.test.ts</code>.</p></section>
      </div>
    </div>
  );
}

export function ModelSection({ practice: p }: { practice: PracticeDef }) {
  return (
    <div className="stack">
      <Notice kind="warn">
        <strong>Simulación educativa, no experimento real.</strong> Los resultados se calculan con el modelo descrito abajo. Un laboratorio real incluye variabilidad, errores de medición y factores que este modelo deja por fuera. Las conclusiones deben interpretarse dentro de esos límites.
      </Notice>
      <ModelCard spec={p.model} />
      <section className="card stack-sm">
        <h3>Relación curricular</h3>
        <p><strong>Área:</strong> {AREA_LABEL[p.area]} · <strong>Grado:</strong> {p.grade}.º · <strong>Tema:</strong> {p.topic}</p>
        <p><strong>Estándares:</strong> {p.curricularLink.standards}</p>
        <p><strong>DBA:</strong> {p.curricularLink.dba}</p>
        <p className="small muted">{p.curricularLink.note}</p>
        {(() => {
          const v = loadValidations()[p.id];
          if (!v || v.status === 'pendiente') return <p className="small"><span className="chip warn">Validación institucional pendiente</span></p>;
          return (
            <div className="notice ok stack-sm">
              <strong>Validación institucional ({v.status}){v.validatedBy ? ` · ${v.validatedBy}` : ''}</strong>
              {v.dbaNumber && <span className="small"><strong>DBA:</strong> {v.dbaNumber}{v.dbaText ? ` — ${v.dbaText}` : ''}</span>}
              {v.standards && <span className="small"><strong>Estándar:</strong> {v.standards}</span>}
              {v.institutionalGrade && <span className="small"><strong>Grado en el plan de área:</strong> {v.institutionalGrade}</span>}
              <span className="small muted">Registrada en el panel docente de este navegador.</span>
            </div>
          );
        })()}
      </section>
      <section className="card stack-sm">
        <h3>Referencias</h3>
        <ul className="list">{p.references.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
    </div>
  );
}

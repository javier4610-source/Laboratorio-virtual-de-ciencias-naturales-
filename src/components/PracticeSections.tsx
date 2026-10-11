import { useMemo, useState } from 'react';
import type { PracticeDef, Trend } from '../core/types';
import type { SessionApi } from '../lib/session';
import { AREA_LABEL, COMPETENCY_LABEL } from '../curriculum/grades';
import { DATASETS } from '../labs/datasets';
import { detectTrend, TREND_LABEL } from '../lib/trend';
import { fmt } from '../lib/format';
import { questionById } from '../curriculum';
import { QuestionCard } from './QuestionCard';
import { cellText } from './DataPanel';
import { Notice } from './ui';
import { scoreSession } from '../lib/report';
import type { ModelSpec } from '../models/types';

const TRENDS: Exclude<Trend, ''>[] = ['aumenta', 'disminuye', 'no cambia', 'máximo', 'se estabiliza'];

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
          Entendido: formular mi hipótesis
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
      <div className="table-wrap">
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

/* ------------------------------- Hipótesis ------------------------------- */
export function HypothesisSection({ practice: p, api, onNext }: { practice: PracticeDef; api: SessionApi; onNext: () => void }) {
  const h = api.session.hypothesis;
  const pair = p.hypothesis.pairs[h.pairIndex] ?? p.hypothesis.pairs[0];
  const set = (patch: Partial<typeof h>) => api.update((s) => ({ ...s, hypothesis: { ...s.hypothesis, ...patch, savedAt: undefined } }));
  const text = h.text.toLowerCase();
  const checks = [
    { ok: /\bsi\b/.test(text), msg: 'Incluye la condición: «Si…» (qué cambias).' },
    { ok: text.includes('entonces'), msg: 'Incluye la predicción: «…entonces…» (qué esperas medir).' },
    { ok: text.includes('porque'), msg: 'Incluye la justificación: «…porque…» (por qué lo esperas).' },
  ];
  const canSave = h.text.trim().length >= 15 && !!h.trend;
  return (
    <div className="stack">
      <section className="card stack">
        <h3>Formula tu hipótesis</h3>
        <p>{p.hypothesis.prompt}</p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="hyp-pair">¿Qué relación vas a investigar?</label>
            <select id="hyp-pair" value={h.pairIndex} onChange={(e) => set({ pairIndex: Number(e.target.value) })}>
              {p.hypothesis.pairs.map((pp, i) => <option key={i} value={i}>Si cambio {pp.xLabel}, ¿qué pasa con {pp.yLabel}?</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="hyp-trend">Mi predicción: cuando aumenta {pair.xLabel}, {pair.yLabel}…</label>
            <select id="hyp-trend" value={h.trend} onChange={(e) => set({ trend: e.target.value as Trend })}>
              <option value="">Elegir…</option>
              {TRENDS.map((t) => <option key={t} value={t}>{TREND_LABEL[t]}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="hyp-text">Hipótesis completa</label>
          <textarea id="hyp-text" value={h.text} onChange={(e) => set({ text: e.target.value })} placeholder="Si aumento…, entonces…, porque…" />
        </div>
        {h.text.length > 0 && (
          <ul className="list small" aria-live="polite">
            {checks.map((c) => <li key={c.msg} style={{ color: c.ok ? 'var(--ok)' : 'var(--ink-2)' }}>{c.ok ? '✓ ' : '○ '}{c.msg}</li>)}
          </ul>
        )}
        <div className="btn-row">
          <button type="button" className="btn primary" disabled={!canSave} onClick={() => { api.update((s) => ({ ...s, hypothesis: { ...s.hypothesis, savedAt: Date.now() } })); onNext(); }}>Guardar hipótesis e ir al experimento</button>
          {h.savedAt && <span className="chip ok">Hipótesis guardada</span>}
          {!canSave && <span className="small muted">Escribe tu hipótesis (al menos 15 caracteres) y elige una predicción.</span>}
        </div>
        <p className="small muted">Una hipótesis no tiene que ser correcta: debe poder ponerse a prueba con un experimento.</p>
      </section>
    </div>
  );
}

/* -------------------------------- Análisis ------------------------------- */
export function AnalysisSection({ practice: p, api }: { practice: PracticeDef; api: SessionApi }) {
  const s = api.session;
  const h = s.hypothesis;
  const [pairIndex, setPairIndex] = useState(h.pairIndex);
  const pair = p.hypothesis.pairs[pairIndex];
  const ds = DATASETS[p.id].find((d) => d.id === pair.datasetId)!;
  const trials = s.trials.filter((t) => t.datasetId === ds.id);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const used = trials.filter((t) => !excluded.has(t.id));
  const points = used.map((t) => ({ x: t.values[pair.x], y: t.values[pair.y] })).filter((pt): pt is { x: number; y: number } => typeof pt.x === 'number' && typeof pt.y === 'number');
  const analysis = detectTrend(points);
  // Control de variables: ¿cambiaron otras variables de entrada en los ensayos usados?
  const varied = ds.columns.filter((c) => c.input && c.key !== pair.x && !(pair.allowVary ?? []).includes(c.key))
    .filter((c) => new Set(used.map((t) => String(t.values[c.key]))).size > 1);
  const predicted = pairIndex === h.pairIndex ? h.trend : '';
  const match = predicted && analysis.trend ? predicted === analysis.trend : null;

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
      <section className="card stack">
        <h3>Compara tus resultados con tu hipótesis</h3>
        {!h.savedAt && <Notice kind="warn">No guardaste una hipótesis. Puedes analizar los datos igualmente, pero en el modo guiado conviene formularla antes.</Notice>}
        {h.savedAt && <p><strong>Tu hipótesis:</strong> {h.text} <span className="chip">predicción: {h.trend ? TREND_LABEL[h.trend as Exclude<Trend, ''>] : '—'}</span></p>}
        <div className="field">
          <label htmlFor="an-pair">Relación que analizas</label>
          <select id="an-pair" value={pairIndex} onChange={(e) => { setPairIndex(Number(e.target.value)); setExcluded(new Set()); }}>
            {p.hypothesis.pairs.map((pp, i) => <option key={i} value={i}>{pp.yLabel} en función de {pp.xLabel}</option>)}
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
              <Notice kind="warn">
                <strong>Control de variables:</strong> en los ensayos elegidos también cambió {varied.map((c) => c.label.toLowerCase()).join(', ')}. Para atribuir el efecto a {pair.xLabel}, deja fijas las demás variables o excluye los ensayos que no correspondan.
              </Notice>
            )}
            <div className="readout" aria-live="polite">
              <div className="item"><div className="k">Tendencia en tus datos</div><div className="v data">{analysis.trend ? TREND_LABEL[analysis.trend as Exclude<Trend, ''>] : 'no determinada'}</div></div>
              <div className="item"><div className="k">Valores distintos de x</div><div className="v">{analysis.n}</div></div>
              <div className="item"><div className="k">Correlación r</div><div className="v">{analysis.r === null ? '—' : fmt(analysis.r, 2)}</div></div>
            </div>
            <p className="small">{analysis.detail}</p>
            {match !== null && (
              <Notice kind={match ? 'ok' : 'info'}>
                {match
                  ? 'Tus datos muestran la tendencia que predijiste. Revisa si tu justificación («porque…») explica por qué ocurre.'
                  : 'Tus datos no muestran la tendencia que predijiste. Esto no es un error: es información. Revisa el fundamento científico, piensa por qué el resultado fue distinto y si controlaste las demás variables.'}
              </Notice>
            )}
            <p className="small muted">La tendencia se detecta con reglas explícitas (correlación y forma de la curva) y depende de los ensayos que incluyas. Úsala como apoyo, no como verdad absoluta.</p>
          </>
        )}
        <div className="grid-2">
          <div className="field">
            <label htmlFor="cmp-verdict">Mis datos…</label>
            <select id="cmp-verdict" value={s.comparison.verdict} onChange={(e) => api.update((x) => ({ ...x, comparison: { ...x.comparison, verdict: e.target.value as typeof s.comparison.verdict } }))}>
              <option value="">Elegir…</option>
              <option value="apoya">apoyan mi hipótesis</option>
              <option value="refuta">no apoyan mi hipótesis</option>
              <option value="no concluyente">no son suficientes para decidir</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cmp-just">Justificación con evidencia</label>
            <textarea id="cmp-just" value={s.comparison.justification} onChange={(e) => api.update((x) => ({ ...x, comparison: { ...x.comparison, justification: e.target.value } }))} placeholder="Según los ensayos…" />
          </div>
        </div>
      </section>

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
    api.update((x) => ({ ...x, answers: { ...x.answers, [id]: x.answers[id] ? { ...rec, firstTryCorrect: x.answers[id].firstTryCorrect } : rec } }));
  const transfer = p.transferQuestionIds.map((id) => questionById(id)).filter((q): q is NonNullable<typeof q> => !!q);
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
    </div>
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
          <div className="table-wrap">
            <table>
              <thead><tr><th>Símbolo</th><th>Variable</th><th>Unidad</th><th>Rango</th><th>Inicial</th></tr></thead>
              <tbody>{spec.inputs.map((v) => <tr key={v.symbol + v.name}><td className="mono">{v.symbol}</td><td>{v.name}</td><td>{v.unit}</td><td className="n">{v.range ? `${fmt(v.range[0], v.range[0] < 1 ? 2 : 0)} – ${fmt(v.range[1], 0)}` : '—'}</td><td>{v.initial !== undefined ? String(v.initial).replace('.', ',') : '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h4>Variables de salida</h4>
          <div className="table-wrap">
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
      </section>
      <section className="card stack-sm">
        <h3>Referencias</h3>
        <ul className="list">{p.references.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
    </div>
  );
}

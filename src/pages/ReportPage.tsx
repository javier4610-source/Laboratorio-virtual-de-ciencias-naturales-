import { useEffect, useState } from 'react';
import { getEnrollment } from '../lib/classroom';
import type { PracticeDef, PracticeSession, Trend } from '../core/types';
import { loadSession } from '../lib/session';
import { loadJSON, saveJSON } from '../lib/storage';
import { buildReport, copyText, downloadText, practiceQuestions, slug, type StudentInfo, type StudentReport } from '../lib/report';
import { AREA_LABEL, COMPETENCY_LABEL } from '../curriculum/grades';
import { DATASETS } from '../labs/datasets';
import { DataPanel } from '../components/DataPanel';
import { fmt, fmtDate } from '../lib/format';
import { buildAnalysis } from '../lib/analysis';
import { FIT_LABEL, FIT_MODELS, equationWithValues, formatWithUncertainty } from '../lib/fit';
import { TREND_LABEL } from '../lib/trend';
import { href } from '../lib/router';
import { Notice } from '../components/ui';
import { progressPercent } from '../lib/progress';
import { api, defaultServerUrl, saveServerUrl } from '../lib/api';
import type { Decoded } from '../lib/codes';

const STUDENT_KEY = 'lvcn:estudiante';

/** Modelos de ajuste elegidos por el estudiante en el cuaderno, con sus parámetros e incertidumbres. */
function FitReport({ practice: p, session: s }: { practice: PracticeDef; session: PracticeSession }) {
  const rows = DATASETS[p.id]
    .filter((d) => s.analysis?.[d.id] && s.trials.some((t) => t.datasetId === d.id))
    .map((d) => ({ d, a: buildAnalysis(d, s.trials, s.analysis![d.id]) }))
    .filter(({ a }) => a.ax.model !== 'none');
  if (rows.length === 0) return null;
  return (
    <section className="card stack-sm">
      <h3>Modelo de ajuste</h3>
      {rows.map(({ d, a }) => (
        <div key={d.id} className="stack-sm">
          <p style={{ margin: 0 }}><strong>{d.label}:</strong> {a.yAxis.text} en función de {a.xAxis.text} · modelo {FIT_LABEL[a.ax.model]} ({FIT_MODELS.find((m) => m.value === a.ax.model)!.equation})</p>
          {!a.fit ? <p className="small muted">El ajuste no se calculó porque los datos estaban agrupados.</p>
            : !a.fit.ok ? <p className="small muted">{a.fit.reason}</p>
            : (
              <>
                <p className="num" style={{ margin: 0 }}>{equationWithValues(a.fit.fit)}</p>
                <ul className="list small num">
                  {a.fit.fit.params.map((q) => <li key={q.name}>{q.name} = {formatWithUncertainty(q.value, q.se)}{q.unit ? ` ${q.unit}` : ''}</li>)}
                  <li>R² = {fmt(a.fit.fit.r2, 4)} · n = {a.fit.fit.n} puntos{a.fit.fit.linearized ? ' · calculado por linealización' : ''}</li>
                </ul>
              </>
            )}
        </div>
      ))}
      <p className="small muted">Incertidumbres: error estándar de cada parámetro obtenido por mínimos cuadrados.</p>
    </section>
  );
}

/** Contenido del informe; también lo usa el panel docente para revisar informes importados. */
export function ReportBody({ practice: p, session: s, report }: { practice: PracticeDef; session: PracticeSession; report: StudentReport }) {
  const qs = practiceQuestions(p);
  return (
    <div className="stack">
      <section className="card stack-sm">
        <div className="panel-title"><h2>{p.title}</h2><span className="chip">{AREA_LABEL[p.area]} · {p.grade}.º</span></div>
        <p><strong>Estudiante:</strong> {report.student.name || '—'} · <strong>Curso:</strong> {report.student.course || '—'} · <strong>Fecha:</strong> {fmtDate(report.generatedAt)}</p>
        <p><strong>Pregunta problema:</strong> {p.problemQuestion}</p>
        <p><strong>Modo de trabajo:</strong> {s.mode} · <strong>Progreso:</strong> {progressPercent(p, s)} % · <strong>Ensayos:</strong> {s.trials.length}</p>
      </section>
      <section className="card stack-sm">
        <h3>Hipótesis</h3>
        <p>{s.hypothesis.text || <em className="muted">No registrada.</em>}</p>
        {s.hypothesis.trend && <p className="small">Predicción: {p.hypothesis.pairs[s.hypothesis.pairIndex]?.yLabel} {TREND_LABEL[s.hypothesis.trend as Exclude<Trend, ''>]} cuando aumenta {p.hypothesis.pairs[s.hypothesis.pairIndex]?.xLabel}.</p>}
        {s.variablesCheck && <p className="small">Clasificación de variables: {s.variablesCheck.correct} de {s.variablesCheck.total} correctas.</p>}
      </section>
      {DATASETS[p.id].filter((d) => s.trials.some((t) => t.datasetId === d.id)).length > 0
        ? <DataPanel practiceId={p.id} datasets={DATASETS[p.id].filter((d) => s.trials.some((t) => t.datasetId === d.id))} readOnly={s} />
        : <Notice kind="warn">No hay datos experimentales registrados.</Notice>}
      <FitReport practice={p} session={s} />
      <section className="card stack-sm">
        <h3>Análisis</h3>
        <p><strong>Comparación con la hipótesis:</strong> {s.comparison.verdict ? `mis datos ${s.comparison.verdict === 'apoya' ? 'apoyan' : s.comparison.verdict === 'refuta' ? 'no apoyan' : 'no son suficientes para decidir sobre'} la hipótesis.` : '—'}</p>
        {s.comparison.justification && <p>{s.comparison.justification}</p>}
        {p.interpretation.map((q, i) => (
          <div key={q}><p className="small" style={{ fontWeight: 700, margin: 0 }}>{i + 1}. {q}</p><p>{s.interpretations[String(i)] || <em className="muted">Sin respuesta.</em>}</p></div>
        ))}
      </section>
      <section className="card stack-sm">
        <h3>Conclusión</h3>
        <p><strong>Afirmación:</strong> {s.conclusion.claim || '—'}</p>
        <p><strong>Evidencia:</strong> {s.conclusion.evidence || '—'}</p>
        <p><strong>Razonamiento:</strong> {s.conclusion.reasoning || '—'}</p>
        <p><strong>Aplicación cotidiana:</strong> {s.application || '—'}</p>
        {s.feedback && (s.feedback.easy || s.feedback.clear || s.feedback.learned) ? (
          <p className="small"><strong>Opinión del estudiante (1–5):</strong> fácil de usar {s.feedback.easy || '—'} · entendió los pasos {s.feedback.clear || '—'} · aprendió {s.feedback.learned || '—'}{s.feedback.comment ? ` · «${s.feedback.comment}»` : ''}</p>
        ) : null}
      </section>
      <section className="card stack-sm">
        <h3>Evaluación por competencias</h3>
        <p>Respondidas: {report.score.answered} de {report.score.total} · Aciertos al primer intento: {report.score.firstTryCorrect} ({report.score.answered ? fmt(report.score.percent, 0) : 0} %)</p>
        <ul className="list small">
          {(['uso', 'explicacion', 'indagacion'] as const).map((c) => <li key={c}>{COMPETENCY_LABEL[c]}: {report.score.byCompetency[c].correct} de {report.score.byCompetency[c].answered}</li>)}
        </ul>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
          <table>
            <thead><tr><th>Pregunta</th><th>Competencia</th><th>Elegida</th><th>Correcta</th><th>1.er intento</th><th className="n">Intentos</th></tr></thead>
            <tbody>
              {qs.map((q) => {
                const a = s.answers[q.id];
                return <tr key={q.id}><td>{q.stem.slice(0, 70)}{q.stem.length > 70 ? '…' : ''}</td><td>{COMPETENCY_LABEL[q.competency]}</td><td>{a ? a.chosen.toUpperCase() : '—'}</td><td>{q.correct.toUpperCase()}</td><td>{a ? (a.firstTryCorrect ? '✓' : '✗') : '—'}</td><td className="n">{a?.attempts ?? 0}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="small muted">Informe generado por el Laboratorio Virtual de Ciencias Naturales. Los resultados provienen de una simulación educativa con supuestos declarados en la práctica.</p>
    </div>
  );
}


/** Envío directo al servidor institucional (si el docente lo configuró). */
function SubmitToServer({ report, practiceId }: { report: StudentReport; practiceId: string }) {
  const fromAssignment = loadJSON<Decoded[]>('lvcn:codigos-recibidos', []).find((d) => d.kind === 'asignacion' && d.value.practiceId === practiceId && d.value.server && d.value.joinCode);
  const enrolled = getEnrollment();
  const [server, setServer] = useState(() => (fromAssignment?.kind === 'asignacion' ? fromAssignment.value.server! : enrolled?.server ?? defaultServerUrl()));
  const [code, setCode] = useState(() => (fromAssignment?.kind === 'asignacion' ? fromAssignment.value.joinCode! : enrolled?.course.joinCode ?? ''));
  const [status, setStatus] = useState<{ kind: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!report.student.name.trim()) { setStatus({ kind: 'bad', text: 'Escribe tu nombre antes de enviar.' }); return; }
    setBusy(true); setStatus({ kind: 'info', text: 'Enviando…' });
    try {
      const r = await api.submitReport(server, code, report);
      saveServerUrl(server);
      setStatus({ kind: 'ok', text: r.duplicate ? `Este informe ya había sido recibido en «${r.course}».` : `Informe recibido en el curso «${r.course}».` });
    } catch (e) {
      setStatus({ kind: 'bad', text: (e as Error).message });
    } finally { setBusy(false); }
  };
  return (
    <details className="card no-print" open={!!fromAssignment}>
      <summary>Enviar a mi docente por internet (si tu colegio tiene servidor)</summary>
      <div className="stack-sm">
        <div className="grid-2">
          <div className="field"><label htmlFor="srv-url">Dirección del servidor</label><input id="srv-url" type="url" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://laboratorio.micolegio.edu.co" /></div>
          <div className="field"><label htmlFor="srv-code">Código del curso</label><input id="srv-code" type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="6 caracteres" style={{ fontFamily: 'var(--font-data)', letterSpacing: '0.15em' }} /></div>
        </div>
        <div className="btn-row"><button type="button" className="btn primary" disabled={busy || !server || code.length !== 6} onClick={send}>Enviar informe</button></div>
        {status && <p className={`notice ${status.kind}`} role="status">{status.text}</p>}
        <p className="small muted">Se envían tu nombre, curso y el contenido de este informe al servidor que administra tu colegio. Si te uniste a tu curso con «Unirme a mi curso», tu docente ya ve tu avance de forma automática; el informe completo sigue siendo la entrega formal.</p>
      </div>
    </details>
  );
}

export function ReportPage({ practice: p }: { practice: PracticeDef }) {
  const [student, setStudent] = useState<StudentInfo>(() => loadJSON<StudentInfo>(STUDENT_KEY, { name: '', course: '' }));
  const [msg, setMsg] = useState('');
  const [json, setJson] = useState<string | null>(null);
  useEffect(() => { saveJSON(STUDENT_KEY, student); }, [student]);
  useEffect(() => { document.title = `Informe: ${p.title}`; }, [p.title]);
  const session = loadSession(p.id);
  const report = buildReport(p, session, student);
  const filename = `informe-${slug(p.id)}-${slug(student.name || 'estudiante')}.json`;

  return (
    <div className="stack">
      <nav aria-label="Ruta de navegación" className="small muted no-print"><a href={href()}>Inicio</a> / <a href={href('practica', p.id)}>{p.title}</a> / Informe</nav>
      <h1>Informe de práctica</h1>
      <div className="card stack no-print">
        <div className="grid-2">
          <div className="field"><label htmlFor="st-name">Nombre o alias del estudiante</label><input id="st-name" type="text" value={student.name} onChange={(e) => setStudent({ ...student, name: e.target.value })} autoComplete="name" /></div>
          <div className="field"><label htmlFor="st-course">Curso o grupo</label><input id="st-course" type="text" value={student.course} onChange={(e) => setStudent({ ...student, course: e.target.value })} placeholder="p. ej. 10-2" /></div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => { window.print(); setMsg('Si no se abrió el diálogo de impresión, este entorno lo bloquea: usa «Copiar informe».'); }}>Imprimir o guardar en PDF</button>
          <button type="button" className="btn" onClick={() => { const ok = downloadText(filename, JSON.stringify(report, null, 2), 'application/json'); setMsg(ok ? `Se descargó ${filename}. Entrégalo a tu docente para que lo importe en el panel docente.` : 'Este entorno no permite descargas: usa «Copiar informe».'); }}>Descargar archivo para el docente (.json)</button>
          <button type="button" className="btn" onClick={async () => { const text = JSON.stringify(report); const ok = await copyText(text); setJson(ok ? null : text); setMsg(ok ? 'Informe copiado. Pégalo en un mensaje o documento para tu docente.' : 'No se pudo copiar automáticamente: selecciona el texto de abajo y cópialo.'); }}>Copiar informe</button>
        </div>
        <p className="small" aria-live="polite">{msg}</p>
        {json && <textarea readOnly value={json} aria-label="Informe en formato JSON" onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: 'var(--font-data)', fontSize: '0.8rem' }} />}
        <p className="small muted">El informe se genera en tu navegador. Solo se envía a un servidor si usas la opción «Enviar a mi docente por internet».</p>
      </div>
      <SubmitToServer report={report} practiceId={p.id} />
      <ReportBody practice={p} session={session} report={report} />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { Competency } from '../core/types';
import { PRACTICES, practiceById, questionById } from '../curriculum';
import { AREA_LABEL, COMPETENCY_LABEL, COMPETENCY_SHORT, GRADES, PLANNED } from '../curriculum/grades';
import { loadJSON, saveJSON, storageAvailable } from '../lib/storage';
import { copyText, downloadText, toCSV, validateReport, type StudentReport } from '../lib/report';
import { encodeAssignment, encodeList, uid, type Assignment, type PracticeList } from '../lib/codes';
import { fmt, fmtDate } from '../lib/format';
import { href } from '../lib/router';
import { ConfirmButton, Notice, Select } from '../components/ui';
import { ReportBody } from './ReportPage';
import { progressPercent } from '../lib/progress';

const KEY = 'lvcn:docente';
interface TeacherData { assignments: Assignment[]; lists: PracticeList[]; reports: StudentReport[]; }

type Tab = 'catalogo' | 'asignaciones' | 'listas' | 'informes' | 'rubrica';

function useTeacherData() {
  const [data, setData] = useState<TeacherData>(() => ({ assignments: [], lists: [], reports: [], ...loadJSON<Partial<TeacherData>>(KEY, {}) }));
  useEffect(() => { saveJSON(KEY, data); }, [data]);
  return [data, setData] as const;
}

function CodeBox({ code }: { code: string }) {
  const [msg, setMsg] = useState('');
  return (
    <div className="stack-sm">
      <textarea readOnly value={code} aria-label="Código para compartir" onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: 'var(--font-data)', fontSize: '0.78rem', minHeight: 70 }} />
      <div className="btn-row">
        <button type="button" className="btn small" onClick={async () => setMsg((await copyText(code)) ? 'Código copiado.' : 'Selecciona el texto y cópialo manualmente.')}>Copiar código</button>
        <span className="small muted" aria-live="polite">{msg}</span>
      </div>
    </div>
  );
}

/* ---------------------------- Catálogo docente ---------------------------- */
function CatalogTab() {
  const [grade, setGrade] = useState('');
  const [comp, setComp] = useState('');
  const [q, setQ] = useState('');
  const list = PRACTICES.filter((p) => (!grade || String(p.grade) === grade) && (!comp || p.competencies.includes(comp as Competency))
    && (!q || (p.title + p.topic + p.keywords.join(' ')).toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="stack">
      <div className="filters">
        <Select label="Grado" value={grade} onChange={setGrade} options={[{ value: '', label: 'Todos' }, ...GRADES.map((g) => ({ value: String(g.id), label: `${g.id}.º` }))]} />
        <Select label="Competencia" value={comp} onChange={setComp} options={[{ value: '', label: 'Todas' }, ...(['uso', 'explicacion', 'indagacion'] as const).map((c) => ({ value: c, label: COMPETENCY_LABEL[c] }))]} />
        <div className="field"><label htmlFor="t-q">Tema o palabra clave</label><input id="t-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="table-wrap">
        <table>
          <caption>Prácticas implementadas ({list.length})</caption>
          <thead><tr><th>Grado</th><th>Práctica</th><th>Área</th><th>Tema</th><th>Competencias</th><th className="n">Min</th><th>DBA (propuesta)</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td className="n">{p.grade}.º</td><td><a href={href('practica', p.id)}>{p.title}</a></td><td>{AREA_LABEL[p.area]}</td><td>{p.topic}</td>
                <td>{p.competencies.map((c) => COMPETENCY_SHORT[c]).join(', ')}</td><td className="n">{p.durationMin}</td><td className="small">{p.curricularLink.dba}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Prácticas planificadas, aún no implementadas ({PLANNED.length})</summary>
        <ul className="list small">{PLANNED.map((p) => <li key={p.title}>{p.grade}.º · {AREA_LABEL[p.area]} · {p.title}</li>)}</ul>
      </details>
    </div>
  );
}

/* ------------------------------ Asignaciones ------------------------------ */
function AssignmentsTab({ data, setData }: { data: TeacherData; setData: (fn: (d: TeacherData) => TeacherData) => void }) {
  const [form, setForm] = useState({ course: '', practiceId: PRACTICES[0].id, objectives: '', activities: '', due: '' });
  const [shown, setShown] = useState<string | null>(null);
  const valid = form.course.trim().length > 0;
  const add = () => {
    const a: Assignment = { id: uid(), ...form, createdAt: Date.now() };
    setData((d) => ({ ...d, assignments: [a, ...d.assignments] }));
    setShown(a.id);
    setForm({ ...form, objectives: '', activities: '' });
  };
  return (
    <div className="stack">
      <section className="card stack">
        <h3>Nueva asignación</h3>
        <div className="grid-2">
          <div className="field"><label htmlFor="as-course">Curso o grupo</label><input id="as-course" type="text" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="p. ej. 8-1" /></div>
          <Select label="Práctica" value={form.practiceId} onChange={(v) => setForm({ ...form, practiceId: v })} options={PRACTICES.map((p) => ({ value: p.id, label: `${p.grade}.º · ${p.title}` }))} />
          <div className="field"><label htmlFor="as-due">Fecha de entrega</label><input id="as-due" type="text" placeholder="AAAA-MM-DD" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="as-obj">Objetivos para el grupo</label><textarea id="as-obj" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} /></div>
        <div className="field"><label htmlFor="as-act">Actividades complementarias</label><textarea id="as-act" value={form.activities} onChange={(e) => setForm({ ...form, activities: e.target.value })} /></div>
        <div className="btn-row"><button type="button" className="btn primary" disabled={!valid} onClick={add}>Crear asignación y generar código</button>{!valid && <span className="small muted">Escribe el curso.</span>}</div>
        <Notice>Sin servidor, la asignación se comparte con un <strong>código</strong>: cópialo y envíalo al grupo (correo, WhatsApp, plataforma institucional). Cada estudiante lo pega en la página de inicio, en «Tengo un código».</Notice>
      </section>
      {data.assignments.length === 0 ? <p className="muted">Aún no has creado asignaciones.</p> : data.assignments.map((a) => {
        const p = practiceById(a.practiceId);
        return (
          <article key={a.id} className="card stack-sm">
            <div className="panel-title"><h4>{a.course} · {p?.title ?? a.practiceId}</h4><span className="small muted">{a.due ? `Entrega: ${a.due}` : 'Sin fecha'} · creada {fmtDate(a.createdAt)}</span></div>
            {a.objectives && <p className="small"><strong>Objetivos:</strong> {a.objectives}</p>}
            {a.activities && <p className="small"><strong>Actividades:</strong> {a.activities}</p>}
            <div className="btn-row">
              <button type="button" className="btn small" aria-expanded={shown === a.id} onClick={() => setShown(shown === a.id ? null : a.id)}>{shown === a.id ? 'Ocultar código' : 'Ver código'}</button>
              <ConfirmButton label="Eliminar" confirmLabel="¿Eliminar esta asignación?" onConfirm={() => setData((d) => ({ ...d, assignments: d.assignments.filter((x) => x.id !== a.id) }))} />
            </div>
            {shown === a.id && <CodeBox code={encodeAssignment(a)} />}
          </article>
        );
      })}
    </div>
  );
}

/* --------------------------- Listas por unidad ---------------------------- */
function ListsTab({ data, setData }: { data: TeacherData; setData: (fn: (d: TeacherData) => TeacherData) => void }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  return (
    <div className="stack">
      <section className="card stack">
        <h3>Nueva lista de prácticas recomendadas</h3>
        <div className="grid-2">
          <div className="field"><label htmlFor="l-name">Nombre de la lista</label><input id="l-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Transformaciones de la materia" /></div>
          <div className="field"><label htmlFor="l-unit">Unidad curricular</label><input id="l-unit" type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="p. ej. Unidad 2 · periodo II" /></div>
        </div>
        <fieldset className="stack-sm" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
          <legend className="small" style={{ fontWeight: 700 }}>Prácticas incluidas</legend>
          {PRACTICES.map((p) => (
            <label key={p.id} className="check"><input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} /> {p.grade}.º · {p.title}</label>
          ))}
        </fieldset>
        <div className="field"><label htmlFor="l-notes">Notas para el grupo</label><textarea id="l-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <button type="button" className="btn primary" disabled={!name.trim() || sel.length === 0} onClick={() => {
          const l: PracticeList = { id: uid(), name, unit, notes, practiceIds: sel, createdAt: Date.now() };
          setData((d) => ({ ...d, lists: [l, ...d.lists] })); setName(''); setUnit(''); setNotes(''); setSel([]); setShown(l.id);
        }}>Guardar lista</button>
      </section>
      {data.lists.map((l) => (
        <article key={l.id} className="card stack-sm">
          <div className="panel-title"><h4>{l.name}</h4><span className="small muted">{l.unit}</span></div>
          <ol className="list small">{l.practiceIds.map((id) => <li key={id}><a href={href('practica', id)}>{practiceById(id)?.title ?? id}</a></li>)}</ol>
          {l.notes && <p className="small">{l.notes}</p>}
          <div className="btn-row">
            <button type="button" className="btn small" onClick={() => setShown(shown === l.id ? null : l.id)}>{shown === l.id ? 'Ocultar código' : 'Compartir con código'}</button>
            <ConfirmButton label="Eliminar" confirmLabel="¿Eliminar esta lista?" onConfirm={() => setData((d) => ({ ...d, lists: d.lists.filter((x) => x.id !== l.id) }))} />
          </div>
          {shown === l.id && <CodeBox code={encodeList(l)} />}
        </article>
      ))}
    </div>
  );
}

/* ------------------------------- Informes -------------------------------- */
function ReportsTab({ data, setData }: { data: TeacherData; setData: (fn: (d: TeacherData) => TeacherData) => void }) {
  const [paste, setPaste] = useState('');
  const [msgs, setMsgs] = useState<string[]>([]);
  const [view, setView] = useState<number | null>(null);
  const [filterPractice, setFilterPractice] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  const ingest = (texts: { name: string; text: string }[]) => {
    const out: string[] = [];
    const add: StudentReport[] = [];
    for (const { name, text } of texts) {
      try {
        const obj = JSON.parse(text);
        const err = validateReport(obj);
        if (err) { out.push(`${name}: ${err}`); continue; }
        const r = obj as StudentReport;
        if (!practiceById(r.practice.id)) { out.push(`${name}: la práctica «${r.practice.id}» no existe en esta versión.`); continue; }
        const dup = [...data.reports, ...add].some((x) => x.student.name === r.student.name && x.practice.id === r.practice.id && x.generatedAt === r.generatedAt);
        if (dup) { out.push(`${name}: informe repetido (no se agregó).`); continue; }
        add.push(r);
        out.push(`${name}: informe de ${r.student.name || 'estudiante sin nombre'} importado.`);
      } catch {
        out.push(`${name}: no es un JSON válido.`);
      }
    }
    if (add.length) setData((d) => ({ ...d, reports: [...d.reports, ...add] }));
    setMsgs(out);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const texts = await Promise.all([...files].map(async (f) => ({ name: f.name, text: await f.text() })));
    ingest(texts);
  };

  const reports = data.reports.filter((r) => (!filterPractice || r.practice.id === filterPractice) && (!filterCourse || r.student.course === filterCourse));
  const courses = [...new Set(data.reports.map((r) => r.student.course).filter(Boolean))];

  const stats = useMemo(() => {
    const byQ = new Map<string, { answered: number; wrong: number }>();
    const byComp: Record<Competency, { answered: number; correct: number }> = { uso: { answered: 0, correct: 0 }, explicacion: { answered: 0, correct: 0 }, indagacion: { answered: 0, correct: 0 } };
    for (const r of reports) {
      for (const [qid, a] of Object.entries(r.session.answers)) {
        const q = questionById(qid);
        if (!q) continue;
        const e = byQ.get(qid) ?? { answered: 0, wrong: 0 };
        e.answered++; if (!a.firstTryCorrect) e.wrong++;
        byQ.set(qid, e);
        byComp[q.competency].answered++; if (a.firstTryCorrect) byComp[q.competency].correct++;
      }
    }
    const questions = [...byQ.entries()].map(([id, v]) => ({ id, ...v, rate: v.wrong / v.answered })).sort((a, b) => b.rate - a.rate || b.answered - a.answered);
    return { questions, byComp };
  }, [reports]);

  const exportSummary = () => {
    const rows: (string | number | null)[][] = [['Estudiante', 'Curso', 'Práctica', 'Grado', 'Progreso (%)', 'Ensayos', 'Respondidas', 'Aciertos 1.er intento', 'Porcentaje', 'Hipótesis', 'Conclusión', 'Fecha']];
    for (const r of reports) {
      const p = practiceById(r.practice.id)!;
      rows.push([r.student.name, r.student.course, p.title, p.grade, progressPercent(p, r.session), r.session.trials.length, r.score.answered, r.score.firstTryCorrect, Math.round(r.score.percent), r.session.hypothesis.text, r.session.conclusion.claim, fmtDate(r.generatedAt)]);
    }
    const ok = downloadText('resumen-informes.csv', toCSV(rows), 'text/csv');
    setMsgs([ok ? 'Resumen exportado (CSV).' : 'Este entorno no permite descargas.']);
  };
  const exportQuestions = () => {
    const rows: (string | number | null)[][] = [['Pregunta', 'Competencia', 'Tema', 'Respondida por', 'Errores al 1.er intento', 'Tasa de error (%)']];
    for (const s of stats.questions) { const q = questionById(s.id)!; rows.push([q.stem, COMPETENCY_LABEL[q.competency], q.topic, s.answered, s.wrong, Math.round(s.rate * 100)]); }
    const ok = downloadText('errores-por-pregunta.csv', toCSV(rows), 'text/csv');
    setMsgs([ok ? 'Estadísticas por pregunta exportadas (CSV).' : 'Este entorno no permite descargas.']);
  };

  if (view !== null && reports[view]) {
    const r = reports[view];
    return (
      <div className="stack">
        <button type="button" className="btn" onClick={() => setView(null)}>← Volver a la lista de informes</button>
        <ReportBody practice={practiceById(r.practice.id)!} session={r.session} report={r} />
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card stack">
        <h3>Importar informes de estudiantes</h3>
        <p className="small">Los estudiantes generan su informe en «Ver informe» de cada práctica y te entregan el archivo <code>.json</code> o el texto copiado. Los informes quedan guardados solo en este navegador.</p>
        <div className="field"><label htmlFor="rep-files">Archivos de informe (.json, puedes elegir varios)</label><input id="rep-files" type="file" accept=".json,application/json" multiple onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} /></div>
        <div className="field"><label htmlFor="rep-paste">…o pega aquí el texto de un informe</label><textarea id="rep-paste" value={paste} onChange={(e) => setPaste(e.target.value)} style={{ fontFamily: 'var(--font-data)', fontSize: '0.8rem' }} /></div>
        <div className="btn-row"><button type="button" className="btn primary" disabled={!paste.trim()} onClick={() => { ingest([{ name: 'Texto pegado', text: paste }]); setPaste(''); }}>Importar texto pegado</button></div>
        {msgs.length > 0 && <ul className="list small" role="status">{msgs.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      </section>

      {data.reports.length === 0 ? <p className="muted">Aún no hay informes importados. Cuando importes informes verás aquí los resultados agregados.</p> : (
        <>
          <div className="filters">
            <Select label="Práctica" value={filterPractice} onChange={setFilterPractice} options={[{ value: '', label: 'Todas' }, ...PRACTICES.map((p) => ({ value: p.id, label: p.title }))]} />
            <Select label="Curso" value={filterCourse} onChange={setFilterCourse} options={[{ value: '', label: 'Todos' }, ...courses.map((c) => ({ value: c, label: c }))]} />
          </div>
          <div className="kpis">
            <div className="kpi"><div className="v">{reports.length}</div><div className="k">informes</div></div>
            {(['uso', 'explicacion', 'indagacion'] as const).map((c) => {
              const v = stats.byComp[c];
              return <div className="kpi" key={c}><div className="v">{v.answered ? `${fmt((v.correct / v.answered) * 100, 0)} %` : '—'}</div><div className="k">aciertos en {COMPETENCY_LABEL[c].toLowerCase()}</div></div>;
            })}
          </div>
          <div className="table-wrap">
            <table>
              <caption>Informes</caption>
              <thead><tr><th>Estudiante</th><th>Curso</th><th>Práctica</th><th className="n">Progreso</th><th className="n">Ensayos</th><th className="n">Aciertos</th><th>Fecha</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {reports.map((r, i) => {
                  const p = practiceById(r.practice.id)!;
                  return (
                    <tr key={`${r.student.name}-${r.generatedAt}-${i}`}>
                      <td>{r.student.name || '—'}</td><td>{r.student.course || '—'}</td><td>{p.title}</td>
                      <td className="n">{progressPercent(p, r.session)} %</td><td className="n">{r.session.trials.length}</td>
                      <td className="n">{r.score.firstTryCorrect}/{r.score.answered}</td><td className="small">{fmtDate(r.generatedAt)}</td>
                      <td><div className="btn-row"><button type="button" className="btn small" onClick={() => setView(i)}>Revisar</button>
                        <button type="button" className="btn small ghost danger" onClick={() => setData((d) => ({ ...d, reports: d.reports.filter((x) => x !== r) }))} aria-label={`Quitar informe de ${r.student.name}`}>Quitar</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <section className="card stack-sm">
            <h3>Preguntas con mayor tasa de error (primer intento)</h3>
            {stats.questions.length === 0 ? <p className="muted small">Los informes no tienen preguntas respondidas.</p> : (
              <div className="stack-sm">
                {stats.questions.slice(0, 12).map((s) => {
                  const q = questionById(s.id)!;
                  return (
                    <div key={s.id} className="stack-sm" style={{ gap: 2 }}>
                      <div className="small"><strong>{fmt(s.rate * 100, 0)} %</strong> de error · {s.wrong}/{s.answered} · {COMPETENCY_SHORT[q.competency]} · {q.stem.slice(0, 110)}{q.stem.length > 110 ? '…' : ''}</div>
                      <div className="progress-mini" role="img" aria-label={`Tasa de error ${fmt(s.rate * 100, 0)} %`}><span style={{ width: `${s.rate * 100}%`, background: 'var(--data)' }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <div className="btn-row">
            <button type="button" className="btn" onClick={exportSummary}>Exportar resumen (CSV)</button>
            <button type="button" className="btn" onClick={exportQuestions}>Exportar errores por pregunta (CSV)</button>
            <ConfirmButton label="Borrar todos los informes" confirmLabel="¿Borrar todos los informes importados de este navegador?" onConfirm={() => setData((d) => ({ ...d, reports: [] }))} />
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------- Rúbrica -------------------------------- */
export const RUBRIC: { criterion: string; levels: [string, string, string, string] }[] = [
  { criterion: 'Formulación de hipótesis', levels: [
    'Formula una hipótesis contrastable que relaciona variables con una justificación científica pertinente.',
    'Formula una hipótesis contrastable con una justificación parcial.',
    'Formula una predicción sin justificación o poco contrastable.',
    'No formula hipótesis o esta no se relaciona con el experimento.'] },
  { criterion: 'Diseño y control de variables', levels: [
    'Identifica correctamente las variables y realiza ensayos cambiando una sola variable, con repeticiones o rangos adecuados.',
    'Identifica las variables y controla la mayoría de ellas en sus ensayos.',
    'Identifica algunas variables; varios ensayos cambian más de una variable a la vez.',
    'No distingue variables ni controla las condiciones de los ensayos.'] },
  { criterion: 'Registro e interpretación de datos', levels: [
    'Registra datos suficientes con unidades, construye gráficas apropiadas e identifica patrones y valores atípicos.',
    'Registra datos con unidades e identifica la tendencia principal.',
    'Registra pocos datos o sin unidades; la interpretación es incompleta.',
    'No registra datos o la interpretación contradice la evidencia.'] },
  { criterion: 'Argumentación científica (afirmación, evidencia, razonamiento)', levels: [
    'La conclusión responde la pregunta problema, usa evidencia cuantitativa y la explica con conceptos científicos, reconociendo limitaciones.',
    'La conclusión responde la pregunta con evidencia y un razonamiento básico.',
    'La conclusión es general, con poca evidencia o sin razonamiento científico.',
    'No presenta conclusión o no se relaciona con los datos.'] },
  { criterion: 'Uso comprensivo del conocimiento', levels: [
    'Aplica los conceptos a situaciones nuevas y cotidianas con precisión.',
    'Aplica los conceptos en situaciones similares a las trabajadas.',
    'Reconoce los conceptos pero tiene dificultades para aplicarlos.',
    'Presenta errores conceptuales importantes.'] },
];

function RubricTab() {
  return (
    <div className="stack">
      <p className="small">Niveles de desempeño según la escala nacional (Superior, Alto, Básico, Bajo; Decreto 1290 de 2009). Los descriptores son una propuesta que cada institución puede ajustar a su sistema de evaluación.</p>
      <div className="table-wrap">
        <table>
          <caption>Rúbrica para indagación, interpretación de datos y argumentación científica</caption>
          <thead><tr><th>Criterio</th><th>Superior</th><th>Alto</th><th>Básico</th><th>Bajo</th></tr></thead>
          <tbody>{RUBRIC.map((r) => <tr key={r.criterion}><th scope="row" style={{ whiteSpace: 'normal' }}>{r.criterion}</th>{r.levels.map((l, i) => <td key={i} className="small">{l}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function TeacherPage() {
  const [data, setData] = useTeacherData();
  const [tab, setTab] = useState<Tab>('catalogo');
  useEffect(() => { document.title = 'Panel docente · Laboratorio Virtual'; }, []);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'catalogo', label: 'Catálogo' }, { id: 'asignaciones', label: `Asignaciones (${data.assignments.length})` },
    { id: 'listas', label: `Listas por unidad (${data.lists.length})` }, { id: 'informes', label: `Informes (${data.reports.length})` }, { id: 'rubrica', label: 'Rúbrica' },
  ];
  return (
    <div className="stack">
      <h1>Panel docente</h1>
      <Notice kind="warn">
        <strong>Funcionamiento sin servidor.</strong> Esta versión no tiene cuentas ni base de datos. Las asignaciones, listas e informes se guardan solo en este navegador{storageAvailable() ? '' : ' (y el almacenamiento local no está disponible: se perderán al cerrar la pestaña)'}. Los estudiantes entregan sus informes como archivo o texto, y las asignaciones se comparten con códigos.
      </Notice>
      <div className="stage-nav" role="tablist" aria-label="Secciones del panel docente">
        {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab === 'catalogo' && <CatalogTab />}
      {tab === 'asignaciones' && <AssignmentsTab data={data} setData={setData} />}
      {tab === 'listas' && <ListsTab data={data} setData={setData} />}
      {tab === 'informes' && <ReportsTab data={data} setData={setData} />}
      {tab === 'rubrica' && <RubricTab />}
    </div>
  );
}


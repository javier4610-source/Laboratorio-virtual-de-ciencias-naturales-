import { useEffect, useMemo, useState } from 'react';
import type { Competency } from '../core/types';
import { PRACTICES, practiceById, questionById } from '../curriculum';
import { AREA_LABEL, COMPETENCY_LABEL, COMPETENCY_SHORT, GRADES, PLANNED } from '../curriculum/grades';
import { loadJSON, saveJSON, storageAvailable } from '../lib/storage';
import { copyText, downloadText, toCSV, validateReport, type StudentReport } from '../lib/report';
import { encodeAssignment, encodeList, uid, type Assignment, type PracticeList } from '../lib/codes';
import { fmt, fmtDate } from '../lib/format';
import { href } from '../lib/router';
import { onTabListKeyDown } from '../lib/a11y';
import { ConfirmButton, Notice, Segmented, Select } from '../components/ui';
import { ReportBody } from './ReportPage';
import { progressPercent } from '../lib/progress';
import { emptyValidation, exportValidations, loadValidations, mergeValidations, saveValidations, type CurricularValidation, type ValidationStatus } from '../lib/validation';
import { TrackingTab } from './TrackingTab';
import { api, defaultServerUrl, loadTeacherSession, saveServerUrl, saveTeacherSession, type ServerCourse, type TeacherSession } from '../lib/api';

const KEY = 'lvcn:docente';
interface TeacherData { assignments: Assignment[]; lists: PracticeList[]; reports: StudentReport[]; }

type Tab = 'catalogo' | 'validacion' | 'asignaciones' | 'listas' | 'informes' | 'seguimiento' | 'servidor' | 'rubrica';

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
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
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


/* -------------------------- Validación curricular ------------------------- */
const STATUS_CHIP: Record<ValidationStatus, string> = { pendiente: 'warn', validado: 'ok', ajustado: 'ok', 'no corresponde': 'bad' };

function ValidationTab() {
  const [vals, setVals] = useState<Record<string, CurricularValidation>>(() => loadValidations());
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  useEffect(() => { saveValidations(vals); }, [vals]);
  const get = (id: string) => vals[id] ?? emptyValidation(id);
  const set = (id: string, patch: Partial<CurricularValidation>) => setVals((v) => ({ ...v, [id]: { ...get(id), ...patch, updatedAt: Date.now() } }));
  const done = PRACTICES.filter((p) => ['validado', 'ajustado', 'no corresponde'].includes(get(p.id).status)).length;

  const importText = (text: string, name: string) => {
    try {
      const { merged, updated } = mergeValidations(vals, JSON.parse(text));
      setVals(merged);
      setMsg(`${name}: ${updated} validaciones actualizadas.`);
    } catch (e) { setMsg(`${name}: ${(e as Error).message}`); }
  };
  const csv = () => toCSV([
    ['Grado', 'Práctica', 'Propuesta de estándar', 'Propuesta de DBA', 'Estado', 'DBA verificado (número)', 'Enunciado oficial', 'Estándar verificado', 'Grado en el plan institucional', 'Observaciones', 'Validado por', 'Fecha'],
    ...PRACTICES.map((p) => { const v = get(p.id); return [p.grade, p.title, p.curricularLink.standards, p.curricularLink.dba, v.status, v.dbaNumber, v.dbaText, v.standards, v.institutionalGrade, v.notes, v.validatedBy, v.updatedAt ? fmtDate(v.updatedAt) : '']; }),
  ]);

  return (
    <div className="stack">
      <Notice>
        Las correspondencias con Estándares y DBA de cada práctica son <strong>propuestas</strong>. Compáralas con los documentos oficiales del MEN (Estándares Básicos de Competencias, 2006; DBA de Ciencias Naturales) y con el plan de área. Registra aquí el DBA verificado, copiando el enunciado del documento oficial. La validación se guarda en este navegador; expórtala para compartirla con el equipo de área o importar la de otros docentes.
      </Notice>
      <div className="kpis">
        <div className="kpi"><div className="v">{done}/{PRACTICES.length}</div><div className="k">prácticas revisadas</div></div>
        {(['validado', 'ajustado', 'no corresponde', 'pendiente'] as ValidationStatus[]).map((st) => (
          <div className="kpi" key={st}><div className="v">{PRACTICES.filter((p) => get(p.id).status === st).length}</div><div className="k">{st}</div></div>
        ))}
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
        <table>
          <caption>Estado de la validación curricular</caption>
          <thead><tr><th>Grado</th><th>Práctica</th><th>Estado</th><th>DBA verificado</th><th>Validado por</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {PRACTICES.map((p) => {
              const v = get(p.id);
              return (
                <tr key={p.id}>
                  <td className="n">{p.grade}.º</td><td>{p.title}</td>
                  <td><span className={`chip ${STATUS_CHIP[v.status]}`}>{v.status}</span></td>
                  <td className="small">{v.dbaNumber || '—'}</td><td className="small">{v.validatedBy || '—'}</td>
                  <td><button type="button" className="btn small" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Cerrar' : 'Revisar'}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && (() => {
        const p = PRACTICES.find((x) => x.id === open)!;
        const v = get(p.id);
        const fid = (k: string) => `val-${p.id}-${k}`;
        return (
          <section className="card stack" aria-label={`Validación de ${p.title}`}>
            <h3>{p.grade}.º · {p.title}</h3>
            <div className="grid-2">
              <div className="notice"><strong>Propuesta de estándar:</strong> {p.curricularLink.standards}</div>
              <div className="notice"><strong>Propuesta de DBA:</strong> {p.curricularLink.dba}</div>
            </div>
            <div className="grid-2">
              <Select label="Estado de la validación" id={fid('status')} value={v.status} onChange={(x) => set(p.id, { status: x as ValidationStatus })} options={(['pendiente', 'validado', 'ajustado', 'no corresponde'] as ValidationStatus[]).map((x) => ({ value: x, label: x }))} />
              <div className="field"><label htmlFor={fid('num')}>DBA verificado (número y grado)</label><input id={fid('num')} type="text" value={v.dbaNumber} placeholder="p. ej. DBA 3, grado 8.º" onChange={(e) => set(p.id, { dbaNumber: e.target.value })} /></div>
            </div>
            <div className="field"><label htmlFor={fid('text')}>Enunciado oficial del DBA (copiado del documento del MEN)</label><textarea id={fid('text')} value={v.dbaText} onChange={(e) => set(p.id, { dbaText: e.target.value })} /></div>
            <div className="field"><label htmlFor={fid('std')}>Estándar(es) verificado(s)</label><textarea id={fid('std')} value={v.standards} onChange={(e) => set(p.id, { standards: e.target.value })} /></div>
            <div className="grid-2">
              <div className="field"><label htmlFor={fid('grade')}>Grado en el plan de área institucional</label><input id={fid('grade')} type="text" value={v.institutionalGrade} onChange={(e) => set(p.id, { institutionalGrade: e.target.value })} /></div>
              <div className="field"><label htmlFor={fid('by')}>Validado por</label><input id={fid('by')} type="text" value={v.validatedBy} onChange={(e) => set(p.id, { validatedBy: e.target.value })} /></div>
            </div>
            <div className="field"><label htmlFor={fid('notes')}>Observaciones y ajustes sugeridos a la práctica</label><textarea id={fid('notes')} value={v.notes} onChange={(e) => set(p.id, { notes: e.target.value })} /></div>
            {v.updatedAt > 0 && <p className="small muted">Guardado en este navegador · {fmtDate(v.updatedAt)}</p>}
          </section>
        );
      })()}
      <section className="card stack-sm">
        <h3>Compartir con el equipo de área</h3>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setMsg(downloadText('validacion-curricular.csv', csv(), 'text/csv') ? 'Tabla exportada (CSV).' : 'Este entorno no permite descargas: usa «Copiar validación».')}>Exportar tabla (CSV)</button>
          <button type="button" className="btn" onClick={() => setMsg(downloadText('validacion-curricular.json', JSON.stringify(exportValidations(vals), null, 2), 'application/json') ? 'Validación exportada (JSON). Otro docente puede importarla.' : 'Este entorno no permite descargas: usa «Copiar validación».')}>Exportar validación (JSON)</button>
          <button type="button" className="btn" onClick={async () => setMsg((await copyText(JSON.stringify(exportValidations(vals)))) ? 'Validación copiada.' : 'No se pudo copiar automáticamente.')}>Copiar validación</button>
        </div>
        <div className="field"><label htmlFor="val-file">Importar validación de otro docente (.json)</label><input id="val-file" type="file" accept=".json,application/json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importText(await f.text(), f.name); e.target.value = ''; }} /></div>
        <div className="field"><label htmlFor="val-paste">…o pega el texto copiado</label><textarea id="val-paste" value={paste} onChange={(e) => setPaste(e.target.value)} /></div>
        <div className="btn-row"><button type="button" className="btn" disabled={!paste.trim()} onClick={() => { importText(paste, 'Texto pegado'); setPaste(''); }}>Importar texto</button></div>
        {msg && <p className="small" role="status">{msg}</p>}
        <p className="small muted">Al importar se conserva, para cada práctica, la validación más reciente.</p>
      </section>
    </div>
  );
}

/* ------------------------------ Asignaciones ------------------------------ */
function AssignmentsTab({ data, setData }: { data: TeacherData; setData: (fn: (d: TeacherData) => TeacherData) => void }) {
  const [form, setForm] = useState({ course: '', practiceId: PRACTICES[0].id, objectives: '', activities: '', due: '', server: loadTeacherSession()?.server ?? '', joinCode: '' });
  const [shown, setShown] = useState<string | null>(null);
  const valid = form.course.trim().length > 0;
  const add = () => {
    const { server, joinCode, ...rest } = form;
    const a: Assignment = { id: uid(), ...rest, createdAt: Date.now(), ...(server && joinCode.length === 6 ? { server, joinCode } : {}) };
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
        <details>
          <summary>Envío por servidor (opcional)</summary>
          <div className="grid-2">
            <div className="field"><label htmlFor="as-srv">Servidor del colegio</label><input id="as-srv" type="url" value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} placeholder="https://…" /></div>
            <div className="field"><label htmlFor="as-code">Código del curso en el servidor</label><input id="as-code" type="text" maxLength={6} value={form.joinCode} onChange={(e) => setForm({ ...form, joinCode: e.target.value.toUpperCase() })} /></div>
          </div>
          <p className="small muted">Si los completas, el estudiante podrá enviar su informe directamente desde «Ver informe».</p>
        </details>
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
    const rows: (string | number | null)[][] = [['Estudiante', 'Curso', 'Práctica', 'Grado', 'Progreso (%)', 'Ensayos', 'Respondidas', 'Aciertos 1.er intento', 'Porcentaje', 'Conclusión', 'Fecha']];
    for (const r of reports) {
      const p = practiceById(r.practice.id)!;
      rows.push([r.student.name, r.student.course, p.title, p.grade, progressPercent(p, r.session), r.session.trials.length, r.score.answered, r.score.firstTryCorrect, Math.round(r.score.percent), r.session.conclusion.claim, fmtDate(r.generatedAt)]);
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
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
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
          {(() => {
            const rows = PRACTICES.map((p) => {
              const fbs = reports.filter((r) => r.practice.id === p.id && r.session.feedback).map((r) => r.session.feedback!);
              const avg = (k: 'easy' | 'clear' | 'learned') => { const v = fbs.map((f) => f[k]).filter((x) => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
              return { p, n: fbs.length, easy: avg('easy'), clear: avg('clear'), learned: avg('learned'), comments: fbs.map((f) => f.comment).filter(Boolean) };
            }).filter((r) => r.n > 0);
            if (rows.length === 0) return null;
            return (
              <section className="card stack-sm">
                <h3>Opinión de los estudiantes (promedio de 1 a 5)</h3>
                <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
                  <table>
                    <thead><tr><th>Práctica</th><th className="n">Respuestas</th><th className="n">Fácil de usar</th><th className="n">Entendió los pasos</th><th className="n">Le ayudó a aprender</th></tr></thead>
                    <tbody>{rows.map((r) => <tr key={r.p.id}><td>{r.p.title}</td><td className="n">{r.n}</td><td className="n">{r.easy === null ? '—' : fmt(r.easy, 1)}</td><td className="n">{r.clear === null ? '—' : fmt(r.clear, 1)}</td><td className="n">{r.learned === null ? '—' : fmt(r.learned, 1)}</td></tr>)}</tbody>
                  </table>
                </div>
                {rows.some((r) => r.comments.length) && (
                  <details><summary>Comentarios ({rows.reduce((a, r) => a + r.comments.length, 0)})</summary>
                    <ul className="list small">{rows.flatMap((r) => r.comments.map((c, i) => <li key={r.p.id + i}><strong>{r.p.title}:</strong> {c}</li>))}</ul>
                  </details>
                )}
              </section>
            );
          })()}
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


/* ------------------------------- Servidor -------------------------------- */
function ServerTab({ data, setData, onTrack }: { data: TeacherData; setData: (fn: (d: TeacherData) => TeacherData) => void; onTrack: (courseId: number) => void }) {
  const [session, setSession] = useState<TeacherSession | null>(() => loadTeacherSession());
  const [server, setServer] = useState(() => session?.server ?? defaultServerUrl());
  const [mode, setMode] = useState<'login' | 'registro'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', registrationCode: '' });
  const [courses, setCourses] = useState<ServerCourse[] | null>(null);
  const [newCourse, setNewCourse] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401 && session) { saveTeacherSession(null); setSession(null); }
      setMsg({ kind: 'bad', text: err.message });
    } finally { setBusy(false); }
  };
  const refresh = (s: TeacherSession) => run(async () => setCourses((await api.courses(s)).courses));
  useEffect(() => { if (session) refresh(session); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = (r: { token: string; teacher: TeacherSession['teacher'] }) => {
    const s = { ...r, server: server.trim().replace(/\/+$/, '') };
    saveTeacherSession(s); saveServerUrl(s.server); setSession(s); setForm({ ...form, password: '' });
    refresh(s);
  };

  if (!session) {
    return (
      <div className="stack">
        <Notice>El servidor es opcional y lo instala la institución (instrucciones en <code>server/README.md</code>). Permite que los estudiantes envíen sus informes con un código de curso, sin crear cuentas.</Notice>
        <section className="card stack">
          <div className="field"><label htmlFor="sv-url">Dirección del servidor</label><input id="sv-url" type="url" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://laboratorio.micolegio.edu.co" /></div>
          <div className="btn-row"><button type="button" className="btn" disabled={busy || !server} onClick={() => run(async () => { await api.health(server); setMsg({ kind: 'ok', text: 'Conexión correcta con el servidor.' }); })}>Probar conexión</button></div>
          <Segmented label="Cuenta docente" value={mode} onChange={setMode} options={[{ value: 'login', label: 'Iniciar sesión' }, { value: 'registro', label: 'Crear cuenta' }]} />
          <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); run(async () => enter(mode === 'login' ? await api.login(server, form.email, form.password) : await api.register(server, form))); }}>
            {mode === 'registro' && (
              <>
                <div className="field"><label htmlFor="sv-name">Nombre</label><input id="sv-name" type="text" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field"><label htmlFor="sv-reg">Código de registro institucional</label><input id="sv-reg" type="text" value={form.registrationCode} onChange={(e) => setForm({ ...form, registrationCode: e.target.value })} /><span className="hint">Lo entrega el administrador del servidor del colegio.</span></div>
              </>
            )}
            <div className="field"><label htmlFor="sv-email">Correo</label><input id="sv-email" type="text" inputMode="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label htmlFor="sv-pass">Contraseña</label><input id="sv-pass" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ font: 'inherit', minHeight: 42, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)' }} />{mode === 'registro' && <span className="hint">Mínimo 10 caracteres.</span>}</div>
            <div className="btn-row"><button type="submit" className="btn primary" disabled={busy || !server}>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button></div>
          </form>
          {msg && <p className={`notice ${msg.kind}`} role="status">{msg.text}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="btn-row">
        <span>Sesión iniciada como <strong>{session.teacher.name}</strong> ({session.teacher.email}) en <code>{session.server}</code></span>
        <button type="button" className="btn small" onClick={() => run(async () => { try { await api.logout(session); } finally { saveTeacherSession(null); setSession(null); setCourses(null); } })}>Cerrar sesión</button>
      </div>
      <section className="card stack-sm">
        <h3>Nuevo curso</h3>
        <div className="btn-row">
          <label htmlFor="sv-course" className="sr-only">Nombre del curso</label>
          <input id="sv-course" type="text" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} placeholder="p. ej. 10-2 Química" style={{ flex: '1 1 220px' }} />
          <button type="button" className="btn primary" disabled={busy || !newCourse.trim()} onClick={() => run(async () => { await api.createCourse(session, newCourse.trim()); setNewCourse(''); setCourses((await api.courses(session)).courses); })}>Crear curso</button>
        </div>
        <p className="small muted">Comparte el código del curso con tus estudiantes. Con él se unen al curso («Unirme a mi curso», con su nombre y un PIN) para que veas su avance en «Seguimiento del curso», y también pueden enviar su informe desde «Ver informe».</p>
      </section>
      {msg && <p className={`notice ${msg.kind}`} role="status">{msg.text}</p>}
      {courses && courses.length === 0 && <p className="muted">Aún no tienes cursos en el servidor.</p>}
      {courses && courses.length > 0 && (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
          <table>
            <caption>Mis cursos en el servidor</caption>
            <thead><tr><th>Curso</th><th>Código</th><th className="n">Estudiantes</th><th className="n">Informes</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td><td className="mono" style={{ letterSpacing: '0.15em', fontWeight: 700 }}>{c.joinCode}</td><td className="n">{c.studentCount ?? 0}</td><td className="n">{c.reportCount}</td>
                  <td>{c.open ? <span className="chip ok">Recibe informes</span> : <span className="chip warn">Cerrado</span>}</td>
                  <td>
                    <div className="btn-row">
                      <button type="button" className="btn small" onClick={() => onTrack(c.id)}>Ver seguimiento</button>
                      <button type="button" className="btn small primary" disabled={busy} onClick={() => run(async () => {
                        const { reports } = await api.reports(session, c.id);
                        const fresh = reports.map((r) => r.report).filter((r) => practiceById(r.practice.id) && !data.reports.some((x) => x.student.name === r.student.name && x.practice.id === r.practice.id && x.generatedAt === r.generatedAt));
                        setData((d) => ({ ...d, reports: [...d.reports, ...fresh] }));
                        setMsg({ kind: 'ok', text: `Se descargaron ${reports.length} informes de «${c.name}» (${fresh.length} nuevos). Revísalos en la pestaña Informes.` });
                      })}>Traer informes</button>
                      <button type="button" className="btn small" disabled={busy} onClick={() => run(async () => { await api.setCourseOpen(session, c.id, !c.open); setCourses((await api.courses(session)).courses); })}>{c.open ? 'Cerrar' : 'Reabrir'}</button>
                      <ConfirmButton label="Eliminar" confirmLabel={`¿Eliminar «${c.name}» y sus informes del servidor?`} onConfirm={() => run(async () => { await api.deleteCourse(session, c.id); setCourses((await api.courses(session)).courses); })} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Rúbrica -------------------------------- */
export const RUBRIC: { criterion: string; levels: [string, string, string, string] }[] = [
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
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal">
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
  const [trackCourse, setTrackCourse] = useState<number | null>(null);
  useEffect(() => { document.title = 'Panel docente · Laboratorio Virtual'; }, []);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'catalogo', label: 'Catálogo' }, { id: 'validacion', label: 'Validación curricular' }, { id: 'asignaciones', label: `Asignaciones (${data.assignments.length})` },
    { id: 'listas', label: `Listas por unidad (${data.lists.length})` }, { id: 'informes', label: `Informes (${data.reports.length})` }, { id: 'seguimiento', label: 'Seguimiento del curso' }, { id: 'servidor', label: 'Servidor' }, { id: 'rubrica', label: 'Rúbrica' },
  ];
  return (
    <div className="stack">
      <h1>Panel docente</h1>
      <Notice kind="warn">
        <strong>Funcionamiento sin servidor.</strong> Sin el servidor del colegio no hay cuentas ni base de datos: las asignaciones, listas e informes se guardan solo en este navegador{storageAvailable() ? '' : ' (y el almacenamiento local no está disponible: se perderán al cerrar la pestaña)'}. Los estudiantes entregan sus informes como archivo o texto, y las asignaciones se comparten con códigos. Con el servidor, «Seguimiento del curso» muestra el avance de cada estudiante en tiempo real.
      </Notice>
      <div className="stage-nav" role="tablist" aria-label="Secciones del panel docente" onKeyDown={onTabListKeyDown}>
        {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab === 'catalogo' && <CatalogTab />}
      {tab === 'validacion' && <ValidationTab />}
      {tab === 'asignaciones' && <AssignmentsTab data={data} setData={setData} />}
      {tab === 'listas' && <ListsTab data={data} setData={setData} />}
      {tab === 'informes' && <ReportsTab data={data} setData={setData} />}
      {tab === 'seguimiento' && <TrackingTab key={trackCourse ?? 'ultimo'} initialCourseId={trackCourse} onGoServer={() => setTab('servidor')} />}
      {tab === 'servidor' && <ServerTab data={data} setData={setData} onTrack={(id) => { setTrackCourse(id); setTab('seguimiento'); }} />}
      {tab === 'rubrica' && <RubricTab />}
    </div>
  );
}


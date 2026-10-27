import { lazy, Suspense, useMemo, useState } from 'react';
import type { Area, GradeId } from '../core/types';
import { PRACTICES } from '../curriculum';
import { SABER_BANK } from '../assessment/bank';
import { AREA_LABEL, GRADES } from '../curriculum/grades';
import { copyText, downloadBlob, downloadText, slug } from '../lib/report';
import { assignmentText, catalogLinksCsv, classroomShareUrl, selectQuestions, toGift, toMoodleXml, type QuestionSource } from '../lib/lmsExport';
import { practicePermalink } from '../lib/permalink';
import { Notice, Select } from '../components/ui';
import { Icon } from '../components/icons';

// El banco avanzado (hasta 180 ítems con su solucionario) se carga solo al abrir esta pestaña.
const AdvancedTeacherSection = lazy(() => import('./AdvancedTeacherSection').then((m) => ({ default: m.AdvancedTeacherSection })));

const SOURCES: { value: QuestionSource; label: string }[] = [
  { value: 'todas', label: 'Banco Saber 11 y prácticas' },
  { value: 'banco', label: 'Solo el banco Saber 11' },
  { value: 'practicas', label: 'Solo las prácticas' },
];
const AREAS = Object.keys(AREA_LABEL) as Area[];
const gradeOptions = (all: string) => [{ value: '', label: all }, ...GRADES.map((g) => ({ value: String(g.id), label: `${g.id}.º` }))];

/** Sin BOM: Moodle lee UTF-8 directamente y un BOM puede estropear la primera pregunta en versiones antiguas. */
function downloadUtf8(filename: string, content: string, mime: string): boolean {
  try { return downloadBlob(filename, new Blob([content], { type: `${mime};charset=utf-8` })); } catch { return false; }
}

/* --------------------------------- Moodle -------------------------------- */
function MoodleSection() {
  const [source, setSource] = useState<QuestionSource>('todas');
  const [grade, setGrade] = useState('');
  const [area, setArea] = useState('');
  const [practiceId, setPracticeId] = useState('');
  const [msg, setMsg] = useState('');
  const practiceOptions = PRACTICES.filter((p) => (!grade || String(p.grade) === grade) && (!area || p.area === area));
  const items = useMemo(() => selectQuestions({
    source, grade: grade ? (Number(grade) as GradeId) : null, area: (area || null) as Area | null, practiceId: practiceId || null,
  }, PRACTICES, SABER_BANK), [source, grade, area, practiceId]);
  const base = practiceId ? `lvcn-${practiceId}` : `lvcn-preguntas${grade ? `-grado-${grade}` : ''}${area ? `-${area}` : ''}${source !== 'todas' ? `-${source}` : ''}`;
  const changeFilter = (fn: () => void) => { fn(); setMsg(''); };
  const download = (kind: 'xml' | 'gift') => {
    const ok = kind === 'xml'
      ? downloadUtf8(`${slug(base)}-moodle.xml`, toMoodleXml(items), 'application/xml')
      : downloadUtf8(`${slug(base)}-gift.txt`, toGift(items), 'text/plain');
    setMsg(ok ? `Se descargaron ${items.length} preguntas en formato ${kind === 'xml' ? 'Moodle XML' : 'GIFT'}.` : 'Este entorno no permite descargas.');
  };
  return (
    <section className="card stack" aria-labelledby="lms-moodle-h">
      <h3 id="lms-moodle-h">Preguntas para Moodle</h3>
      <p className="small muted">
        Preguntas de selección múltiple con única respuesta: la opción correcta queda marcada, cada opción lleva su retroalimentación y la explicación va como retroalimentación general, con el enlace a la práctica. Se importan en Moodle desde <em>Banco de preguntas → Importar</em>.
      </p>
      <div className="filters">
        <Select label="Preguntas de" id="lms-source" value={source} onChange={(v) => changeFilter(() => setSource(v as QuestionSource))} options={SOURCES} />
        <Select label="Grado" id="lms-grade" value={grade} onChange={(v) => changeFilter(() => { setGrade(v); setPracticeId(''); })} options={gradeOptions('Todos')} />
        <Select label="Área" id="lms-area" value={area} onChange={(v) => changeFilter(() => { setArea(v); setPracticeId(''); })} options={[{ value: '', label: 'Todas' }, ...AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))]} />
        <Select label="Práctica" id="lms-practice" value={practiceId} onChange={(v) => changeFilter(() => setPracticeId(v))} options={[{ value: '', label: 'Todas las prácticas' }, ...practiceOptions.map((p) => ({ value: p.id, label: `${p.grade}.º · ${p.title}` }))]} />
      </div>
      <p className="lms-count" aria-live="polite"><strong>{items.length}</strong> {items.length === 1 ? 'pregunta seleccionada' : 'preguntas seleccionadas'}</p>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={!items.length} onClick={() => download('xml')}><Icon name="descargar" size={18} />Descargar Moodle XML</button>
        <button type="button" className="btn" disabled={!items.length} onClick={() => download('gift')}><Icon name="descargar" size={18} />Descargar GIFT</button>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      {items.length > 0 && (
        <details>
          <summary>Ver las preguntas seleccionadas</summary>
          <ol className="list small lms-list">
            {items.map((it) => <li key={it.question.id}><span className="muted">{it.question.grade}.º · {it.question.topic} ·</span> {it.question.stem}</li>)}
          </ol>
        </details>
      )}
      <p className="small muted">Usa <strong>Moodle XML</strong> si puedes: conserva las tablas de datos, la categoría por grado y práctica, y etiquetas de competencia y dificultad. <strong>GIFT</strong> es texto simple, útil si tu Moodle solo acepta ese formato.</p>
    </section>
  );
}

/* ---------------------------- Google Classroom --------------------------- */
function ClassroomSection() {
  const [practiceId, setPracticeId] = useState(PRACTICES[0].id);
  const [course, setCourse] = useState('');
  const [due, setDue] = useState('');
  const [csvGrade, setCsvGrade] = useState('');
  const [msg, setMsg] = useState('');
  const [csvMsg, setCsvMsg] = useState('');
  const p = PRACTICES.find((x) => x.id === practiceId) ?? PRACTICES[0];
  const text = assignmentText(p, { course, due });
  const csvCount = PRACTICES.filter((x) => !csvGrade || String(x.grade) === csvGrade).length;
  return (
    <section className="card stack" aria-labelledby="lms-classroom-h">
      <h3 id="lms-classroom-h">Google Classroom</h3>
      <p className="small muted">
        Classroom no importa cuestionarios desde archivos. Lo que sí puedes hacer: compartir la práctica con el botón oficial de Classroom, pegar el texto de la tarea y, si quieres, publicar los enlaces de todo un grado.
      </p>
      <div className="grid-2">
        <Select label="Práctica" id="lms-cr-practice" value={practiceId} onChange={(v) => { setPracticeId(v); setMsg(''); }} options={PRACTICES.map((x) => ({ value: x.id, label: `${x.grade}.º · ${x.title}` }))} />
        <div className="field"><label htmlFor="lms-cr-course">Curso (opcional)</label><input id="lms-cr-course" type="text" value={course} placeholder="p. ej. 8-1" onChange={(e) => setCourse(e.target.value)} /></div>
        <div className="field"><label htmlFor="lms-cr-due">Fecha de entrega (opcional)</label><input id="lms-cr-due" type="text" value={due} placeholder="AAAA-MM-DD" onChange={(e) => setDue(e.target.value)} /></div>
        <div className="field">
          <span className="small" style={{ fontWeight: 600 }}>Enlace permanente</span>
          <a className="small lms-link" href={practicePermalink(p.id)} target="_blank" rel="noopener noreferrer">{practicePermalink(p.id)}</a>
        </div>
      </div>
      <div className="btn-row">
        <a className="btn primary" href={classroomShareUrl(p)} target="_blank" rel="noopener noreferrer">
          <Icon name="estudiante" size={18} />Compartir en Classroom<span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
        <button type="button" className="btn" onClick={() => setMsg(downloadText(`tarea-${p.id}.txt`, text) ? `Se descargó tarea-${p.id}.txt.` : 'Este entorno no permite descargas: usa «Copiar texto».')}><Icon name="descargar" size={18} />Descargar texto de la tarea</button>
        <button type="button" className="btn" onClick={async () => setMsg((await copyText(text)) ? 'Texto de la tarea copiado. Pégalo en las instrucciones de la tarea en Classroom.' : 'No se pudo copiar automáticamente: selecciona el texto y cópialo.')}><Icon name="copiar" size={18} />Copiar texto</button>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      <div className="field">
        <label htmlFor="lms-cr-text">Texto de la tarea (para pegar en las instrucciones)</label>
        <textarea id="lms-cr-text" readOnly value={text} rows={10} onFocus={(e) => e.currentTarget.select()} className="lms-text" />
      </div>
      <div className="stack-sm lms-sub">
        <h4>Enlaces de todo el catálogo</h4>
        <div className="lms-csv">
          <Select label="Grado de la tabla" id="lms-csv-grade" value={csvGrade} onChange={(v) => { setCsvGrade(v); setCsvMsg(''); }} options={gradeOptions('Todos los grados')} />
          <button type="button" className="btn" onClick={() => setCsvMsg(downloadText(`lvcn-enlaces${csvGrade ? `-grado-${csvGrade}` : ''}.csv`, catalogLinksCsv(PRACTICES, csvGrade ? (Number(csvGrade) as GradeId) : null), 'text/csv') ? `Tabla de enlaces descargada (${csvCount} prácticas).` : 'Este entorno no permite descargas.')}>
            <Icon name="tabla" size={18} />Descargar enlaces (CSV)
          </button>
        </div>
        {csvMsg && <p className="small" role="status">{csvMsg}</p>}
        <p className="small muted">{csvCount} prácticas. Cada fila trae la práctica, el grado, el área, el enlace permanente y el enlace para compartir en Classroom. Se abre en Excel o en Hojas de cálculo de Google.</p>
      </div>
    </section>
  );
}

export function LmsExportTab() {
  return (
    <div className="stack">
      <Notice>
        Todo se genera en este navegador, sin servidor ni cuentas. Las preguntas son originales de práctica, alineadas con Saber 11, y <strong>no</strong> son ítems oficiales del ICFES.
      </Notice>
      <MoodleSection />
      <Suspense fallback={<p className="small muted" role="status">Cargando el banco avanzado…</p>}><AdvancedTeacherSection /></Suspense>
      <ClassroomSection />
      <details>
        <summary>Cómo publicarlo paso a paso</summary>
        <div className="grid-2 small lms-steps">
          <div>
            <h4>En Moodle</h4>
            <ol className="list">
              <li>Descarga el archivo «Moodle XML» de aquí.</li>
              <li>En tu curso de Moodle abre <em>Más → Banco de preguntas → Importar</em>.</li>
              <li>Elige «Formato Moodle XML» (o «Formato GIFT»), sube el archivo y pulsa <em>Importar</em>.</li>
              <li>Las preguntas quedan en la categoría «Laboratorio Virtual de Ciencias Naturales», por grado y práctica.</li>
              <li>Crea un Cuestionario y agrega las preguntas desde el banco. Para el enlace a la práctica, agrega un recurso URL con el enlace permanente.</li>
            </ol>
          </div>
          <div>
            <h4>En Google Classroom</h4>
            <ol className="list">
              <li>Elige la práctica y pulsa «Compartir en Classroom»; inicia sesión con tu cuenta del colegio si te lo pide.</li>
              <li>Escoge la clase y la acción (por ejemplo, <em>Crear tarea</em>); el enlace a la práctica queda adjunto.</li>
              <li>Pega el texto de la tarea en las instrucciones, pon la fecha y los puntos, y asígnala.</li>
              <li>Los estudiantes adjuntan su informe (PDF o .json) en la entrega.</li>
            </ol>
          </div>
        </div>
      </details>
      <Notice kind="warn">
        <strong>Límites.</strong> Moodle recibe las preguntas, no el simulador: el estudiante hace la práctica en el Laboratorio Virtual con el enlace y responde el cuestionario en Moodle. Classroom no tiene importación de cuestionarios: «Compartir en Classroom» crea un anuncio, tarea o material con el enlace, y la calificación la pones tú. Las respuestas y el avance del laboratorio no se envían a Moodle ni a Classroom.
      </Notice>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { AnswerRecord, Competency, Question, SaberComponent } from '../core/types';
import { metaById } from '../curriculum/catalog';
import { BANK_GRADES, loadBankGrade, loadedBankGrade } from '../assessment/banco/cargar';
import { COMPETENCY_LABEL, COMPONENT_LABEL, GRADES } from '../curriculum/grades';
import { loadJSON, saveJSON } from '../lib/storage';
import { QuestionCard } from '../components/QuestionCard';
import { ConfirmButton, Notice, Select } from '../components/ui';
import { fmt } from '../lib/format';
import { href } from '../lib/router';
import { Icon } from '../components/icons';
import { RetryButtons } from '../components/Reintentar';
import { retryableImport } from '../lib/importar';

/** El currículo completo (opción «Todas»), reintentable sin recargar la página (src/lib/importar.ts). */
const loadCurriculum = retryableImport(() => import('../curriculum'));

const KEY = 'lvcn:banco-respuestas';
/** Preguntas por tanda: el banco completo pintado de una vez medía más de 50 000 px de alto. */
const PAGE = 10;

export function BankPage() {
  const [grade, setGrade] = useState('');
  const [comp, setComp] = useState('');
  const [component, setComponent] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [source, setSource] = useState<'saber' | 'todas'>('saber');
  const [shown, setShown] = useState(PAGE);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>(() => loadJSON(KEY, {}));
  // El banco tipo Saber se descarga por grado (src/assessment/banco/cargar.ts): con un grado elegido basta su archivo;
  // con «Todos», los seis en paralelo. La página pinta encabezado y filtros mientras tanto (ver docs/v2/RENDIMIENTO.md).
  const [byGrade, setByGrade] = useState<Record<number, readonly Question[]>>(() => {
    const init: Record<number, readonly Question[]> = {};
    for (const g of BANK_GRADES) { const qs = loadedBankGrade(g); if (qs) init[g] = qs; }
    return init;
  });
  const [bankError, setBankError] = useState(false);
  const [bankAttempt, setBankAttempt] = useState(0);
  const neededGrades = grade ? BANK_GRADES.filter((g) => String(g) === grade) : BANK_GRADES;
  const missingGrades = neededGrades.filter((g) => !byGrade[g]);
  const missingKey = missingGrades.join(',');
  useEffect(() => {
    if (source !== 'saber' || !missingKey) return;
    let alive = true;
    const gs = missingKey.split(',').map(Number);
    setBankError(false);
    // Cada grado se pinta apenas llega: si uno falla, los demás siguen disponibles.
    for (const g of gs) {
      loadBankGrade(g).then(
        (qs) => { if (alive) setByGrade((b) => ({ ...b, [g]: qs })); },
        () => { if (alive) setBankError(true); },
      );
    }
    return () => { alive = false; };
  }, [source, missingKey, bankAttempt]);
  const saberBank = BANK_GRADES.flatMap((g) => byGrade[g] ?? []);
  const saberTotal = BANK_GRADES.every((g) => byGrade[g]) ? saberBank.length : null;
  // Las preguntas de las 65 prácticas (opción «Todas») viven en el currículo completo, que pesa ~860 KB comprimidos en
  // más de cien archivos: se descarga solo si se elige esa opción (ver docs/v2/RENDIMIENTO.md).
  const [allQuestions, setAllQuestions] = useState<Question[] | null>(null);
  const [allError, setAllError] = useState(false);
  const [allAttempt, setAllAttempt] = useState(0);
  useEffect(() => {
    if (source !== 'todas' || allQuestions) return;
    let alive = true;
    setAllError(false);
    loadCurriculum().then((m) => { if (alive) setAllQuestions(m.ALL_QUESTIONS); }, () => { if (alive) setAllError(true); });
    return () => { alive = false; };
  }, [source, allQuestions, allAttempt]);
  useEffect(() => { saveJSON(KEY, answers); }, [answers]);
  useEffect(() => { document.title = 'Banco de preguntas tipo Saber 11 · Laboratorio Virtual'; }, []);
  const loadingAll = source === 'todas' && !allQuestions;
  const loadingBank = source === 'saber' && missingGrades.length > 0;
  const pool = source === 'saber' ? saberBank : allQuestions ?? [];
  const list = pool.filter((q) => (!grade || String(q.grade) === grade) && (!comp || q.competency === comp) && (!component || q.component === component) && (!difficulty || q.difficulty === difficulty));
  const filterKey = [source, grade, comp, component, difficulty].join('|');
  useEffect(() => { setShown(PAGE); }, [filterKey]);
  const visible = list.slice(0, shown);
  const answered = list.filter((q) => answers[q.id]);
  const correct = answered.filter((q) => answers[q.id].firstTryCorrect).length;
  return (
    <div className="stack bank">
      <header className="page-head">
        <nav aria-label="Ruta de navegación" className="crumbs small"><a href={href()}>Inicio</a><span aria-hidden="true">/</span><span aria-current="page">Banco Saber 11</span></nav>
        <h1>Banco de preguntas tipo Saber 11</h1>
        <p className="lead muted">Practica por competencia, componente y dificultad; cada opción explica por qué es correcta o no.</p>
      </header>
      <Notice kind="warn">
        <strong>Preguntas originales de práctica.</strong> Fueron elaboradas para esta plataforma y se alinean con las competencias de Ciencias Naturales evaluadas en Saber 11 (uso comprensivo del conocimiento científico, explicación de fenómenos e indagación). <strong>No son preguntas oficiales del ICFES</strong> ni reproducen ítems liberados.
      </Notice>
      <section className="card adv-entry" aria-labelledby="adv-entry-h">
        <div className="stack-sm">
          <h2 id="adv-entry-h">Banco avanzado tipo Saber 11</h2>
          <p>Preguntas originales de mayor exigencia, con tablas, gráficas y experimentos, en tres modalidades: <strong>práctica guiada</strong> con explicación de cada error, <strong>simulacro</strong> sin claves hasta terminar y <strong>refuerzo personalizado</strong> por competencia, bloque y nivel.</p>
          <p className="small muted">180 preguntas en seis bloques que se publican por entregas. Material original de práctica: no es oficial del ICFES ni está avalado por el ICFES.</p>
        </div>
        <a className="btn primary" href={href('banco', 'avanzado')}><Icon name="banco" size={18} />Abrir el banco avanzado</a>
      </section>
      <div className="filters">
        <Select label="Origen" value={source} onChange={(v) => setSource(v as 'saber' | 'todas')} options={[{ value: 'saber', label: `Banco tipo Saber${saberTotal !== null ? ` (${saberTotal})` : ''}` }, { value: 'todas', label: `Todas, incluidas las de las prácticas${allQuestions ? ` (${allQuestions.length})` : ''}` }]} />
        <Select label="Grado recomendado" value={grade} onChange={setGrade} options={[{ value: '', label: 'Todos' }, ...GRADES.map((g) => ({ value: String(g.id), label: `${g.id}.º` }))]} />
        <Select label="Competencia" value={comp} onChange={setComp} options={[{ value: '', label: 'Todas' }, ...(Object.keys(COMPETENCY_LABEL) as Competency[]).map((c) => ({ value: c, label: COMPETENCY_LABEL[c] }))]} />
        <Select label="Componente" value={component} onChange={setComponent} options={[{ value: '', label: 'Todos' }, ...(Object.keys(COMPONENT_LABEL) as SaberComponent[]).map((c) => ({ value: c, label: COMPONENT_LABEL[c] }))]} />
        <Select label="Dificultad" value={difficulty} onChange={setDifficulty} options={[{ value: '', label: 'Todas' }, { value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }]} />
      </div>
      <div className="kpis">
        <div className="kpi"><div className="v">{list.length}</div><div className="k">preguntas con estos filtros</div></div>
        <div className="kpi"><div className="v">{answered.length}</div><div className="k">respondidas</div></div>
        <div className="kpi"><div className="v">{answered.length ? `${fmt((correct / answered.length) * 100, 0)} %` : '—'}</div><div className="k">aciertos al primer intento</div></div>
      </div>
      <div className="btn-row"><ConfirmButton label="Reiniciar mis respuestas del banco" confirmLabel="¿Borrar tus respuestas del banco?" onConfirm={() => setAnswers({})} /></div>
      {visible.map((q, i) => (
        <div key={q.id} className="stack-sm">
          <QuestionCard question={q} number={i + 1} saberLabel record={answers[q.id]}
            onAnswer={(rec) => setAnswers((a) => ({ ...a, [q.id]: a[q.id] ? { ...rec, firstTryCorrect: a[q.id].firstTryCorrect } : rec }))} />
          {q.practiceId && metaById(q.practiceId) && <p className="small muted">Práctica relacionada: <a href={href('practica', q.practiceId)}>{metaById(q.practiceId)!.title}</a> · Tema: {q.topic} · Habilidad: {q.skill}</p>}
        </div>
      ))}
      {list.length > shown && (
        <div className="load-more">
          <p className="small muted" aria-live="polite">Mostrando {visible.length} de {list.length} preguntas.</p>
          <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>Mostrar {Math.min(PAGE, list.length - shown)} preguntas más</button>
          <button type="button" className="btn ghost" onClick={() => setShown(list.length)}>Mostrar todas</button>
        </div>
      )}
      {loadingAll && (allError ? (
        <div className="notice bad stack-sm" role="alert">
          <strong>No se pudieron cargar las preguntas de las prácticas.</strong>
          <span className="small">Revisa tu conexión a internet y vuelve a intentarlo.</span>
          <RetryButtons onRetry={() => setAllAttempt((n) => n + 1)} retries={allAttempt} />
        </div>
      ) : (
        <p role="status" className="loading-text"><span className="spinner" aria-hidden="true" />Cargando las preguntas de las prácticas…</p>
      ))}
      {loadingBank && (bankError ? (
        <div className="notice bad stack-sm" role="alert">
          <strong>No se pudieron cargar las preguntas del banco.</strong>
          <span className="small">Revisa tu conexión a internet y vuelve a intentarlo.</span>
          <RetryButtons onRetry={() => setBankAttempt((n) => n + 1)} retries={bankAttempt} />
        </div>
      ) : (
        <p role="status" className="loading-text"><span className="spinner" aria-hidden="true" />Cargando las preguntas del banco…</p>
      ))}
      {list.length === 0 && !loadingAll && !loadingBank && (
        <div className="empty-state" role="status">
          <Icon name="banco" size={32} />
          <p className="empty-title">No hay preguntas con esos filtros</p>
          <p>Quita algún filtro: por ejemplo, deja la dificultad en «Todas».</p>
        </div>
      )}
    </div>
  );
}

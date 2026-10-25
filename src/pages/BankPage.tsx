import { useEffect, useState } from 'react';
import type { AnswerRecord, Competency, SaberComponent } from '../core/types';
import { ALL_QUESTIONS, practiceById } from '../curriculum';
import { SABER_BANK } from '../assessment/bank';
import { COMPETENCY_LABEL, COMPONENT_LABEL, GRADES } from '../curriculum/grades';
import { loadJSON, saveJSON } from '../lib/storage';
import { QuestionCard } from '../components/QuestionCard';
import { ConfirmButton, Notice, Select } from '../components/ui';
import { fmt } from '../lib/format';
import { href } from '../lib/router';
import { Icon } from '../components/icons';

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
  useEffect(() => { saveJSON(KEY, answers); }, [answers]);
  useEffect(() => { document.title = 'Banco de preguntas tipo Saber 11 · Laboratorio Virtual'; }, []);
  const pool = source === 'saber' ? SABER_BANK : ALL_QUESTIONS;
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
      <div className="filters">
        <Select label="Origen" value={source} onChange={(v) => setSource(v as 'saber' | 'todas')} options={[{ value: 'saber', label: `Banco tipo Saber (${SABER_BANK.length})` }, { value: 'todas', label: `Todas, incluidas las de las prácticas (${ALL_QUESTIONS.length})` }]} />
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
          {q.practiceId && practiceById(q.practiceId) && <p className="small muted">Práctica relacionada: <a href={href('practica', q.practiceId)}>{practiceById(q.practiceId)!.title}</a> · Tema: {q.topic} · Habilidad: {q.skill}</p>}
        </div>
      ))}
      {list.length > shown && (
        <div className="load-more">
          <p className="small muted" aria-live="polite">Mostrando {visible.length} de {list.length} preguntas.</p>
          <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>Mostrar {Math.min(PAGE, list.length - shown)} preguntas más</button>
          <button type="button" className="btn ghost" onClick={() => setShown(list.length)}>Mostrar todas</button>
        </div>
      )}
      {list.length === 0 && (
        <div className="empty-state" role="status">
          <Icon name="banco" size={32} />
          <p className="empty-title">No hay preguntas con esos filtros</p>
          <p>Quita algún filtro: por ejemplo, deja la dificultad en «Todas».</p>
        </div>
      )}
    </div>
  );
}

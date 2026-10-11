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

const KEY = 'lvcn:banco-respuestas';

export function BankPage() {
  const [grade, setGrade] = useState('');
  const [comp, setComp] = useState('');
  const [component, setComponent] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [source, setSource] = useState<'saber' | 'todas'>('saber');
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>(() => loadJSON(KEY, {}));
  useEffect(() => { saveJSON(KEY, answers); }, [answers]);
  useEffect(() => { document.title = 'Banco de preguntas tipo Saber 11 · Laboratorio Virtual'; }, []);
  const pool = source === 'saber' ? SABER_BANK : ALL_QUESTIONS;
  const list = pool.filter((q) => (!grade || String(q.grade) === grade) && (!comp || q.competency === comp) && (!component || q.component === component) && (!difficulty || q.difficulty === difficulty));
  const answered = list.filter((q) => answers[q.id]);
  const correct = answered.filter((q) => answers[q.id].firstTryCorrect).length;
  return (
    <div className="stack">
      <h1>Banco de preguntas tipo Saber 11</h1>
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
      {list.map((q, i) => (
        <div key={q.id} className="stack-sm">
          <QuestionCard question={q} number={i + 1} saberLabel record={answers[q.id]}
            onAnswer={(rec) => setAnswers((a) => ({ ...a, [q.id]: a[q.id] ? { ...rec, firstTryCorrect: a[q.id].firstTryCorrect } : rec }))} />
          {q.practiceId && practiceById(q.practiceId) && <p className="small muted">Práctica relacionada: <a href={href('practica', q.practiceId)}>{practiceById(q.practiceId)!.title}</a> · Tema: {q.topic} · Habilidad: {q.skill}</p>}
        </div>
      ))}
      {list.length === 0 && <p>No hay preguntas con esos filtros.</p>}
    </div>
  );
}

import { useState } from 'react';
import type { AnswerRecord, Question } from '../core/types';
import { COMPETENCY_SHORT, COMPONENT_LABEL } from '../curriculum/grades';

interface Props {
  question: Question;
  record?: AnswerRecord;
  onAnswer?: (rec: AnswerRecord) => void;
  number?: number;
  /** Muestra la etiqueta "pregunta original de práctica". */
  saberLabel?: boolean;
}

/**
 * Pregunta de selección múltiple con retroalimentación formativa:
 * correcto/incorrecto, explicación, por qué la opción elegida es (in)adecuada,
 * recomendación de repaso y pregunta de transferencia. Permite reintentos.
 */
export function QuestionCard({ question: q, record, onAnswer, number, saberLabel }: Props) {
  const [selected, setSelected] = useState<string>(record?.chosen ?? '');
  const [submitted, setSubmitted] = useState<boolean>(!!record);
  const [attempts, setAttempts] = useState<number>(record?.attempts ?? 0);
  const chosen = q.options.find((o) => o.id === selected);
  const isCorrect = selected === q.correct;
  const correctOpt = q.options.find((o) => o.id === q.correct)!;
  const headingId = `q-${q.id}`;

  const submit = () => {
    if (!selected) return;
    const n = attempts + 1;
    setAttempts(n);
    setSubmitted(true);
    onAnswer?.({ chosen: selected, correct: isCorrect, attempts: n, firstTryCorrect: record ? record.firstTryCorrect : isCorrect && n === 1 });
  };

  return (
    <article className="card question" aria-labelledby={headingId}>
      <div className="chips">
        {saberLabel && <span className="label-practice">Pregunta original de práctica · no es una pregunta oficial del ICFES</span>}
        <span className="chip">{COMPETENCY_SHORT[q.competency]}</span>
        <span className="chip">{COMPONENT_LABEL[q.component]}</span>
        <span className="chip">Dificultad {q.difficulty}</span>
        <span className="chip">{q.grade}.º</span>
      </div>
      <h3 id={headingId} className="sr-only">Pregunta {number ?? ''}: {q.topic}</h3>
      {q.context && <p>{q.context}</p>}
      {q.table && (
        <div className="table-wrap">
          <table>
            <caption>{q.table.caption}</caption>
            <thead><tr>{q.table.headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{q.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'n' : undefined}>{typeof c === 'number' ? String(c).replace('.', ',') : c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <p className="stem">{number ? `${number}. ` : ''}{q.stem}</p>
      <div className="options" role="group" aria-label="Opciones de respuesta">
        {q.options.map((o) => {
          const state = submitted && o.id === selected ? (o.id === q.correct ? ' correct' : ' incorrect') : '';
          return (
            <button
              key={o.id} type="button" className={`option${state}`} aria-pressed={o.id === selected}
              disabled={submitted}
              onClick={() => setSelected(o.id)}
            >
              <span className="letter" aria-hidden="true">{o.id}</span>
              <span><span className="sr-only">Opción {o.id.toUpperCase()}: </span>{o.text}</span>
            </button>
          );
        })}
      </div>
      {!submitted ? (
        <div className="btn-row">
          <button type="button" className="btn primary" disabled={!selected} onClick={submit}>Comprobar respuesta</button>
          {!selected && <span className="small muted">Selecciona una opción.</span>}
        </div>
      ) : (
        <div className={`feedback ${isCorrect ? 'ok' : 'bad'}`} role="status" aria-live="polite">
          <h4>{isCorrect ? '✓ Respuesta correcta' : '✗ Respuesta incorrecta'}</h4>
          <p><strong>Tu elección ({selected.toUpperCase()}):</strong> {chosen?.feedback}</p>
          {!isCorrect && <p><strong>Respuesta correcta ({q.correct.toUpperCase()}):</strong> {correctOpt.text}</p>}
          <p><strong>Explicación científica:</strong> {q.explanation}</p>
          <p><strong>Recomendación de repaso:</strong> {q.review}</p>
          {q.transfer && <p><strong>Para pensar más (transferencia):</strong> {q.transfer}</p>}
          <p className="small muted">Habilidad evaluada: {q.skill}. Intentos: {attempts}.</p>
          <div className="btn-row">
            <button type="button" className="btn small" onClick={() => { setSubmitted(false); setSelected(''); }}>Intentar de nuevo</button>
          </div>
        </div>
      )}
    </article>
  );
}

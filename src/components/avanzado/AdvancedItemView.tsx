import { useId } from 'react';
import type { AdvancedItem, Key } from '../../assessment/avanzado/types';
import { COMPETENCY_SHORT_NAME, KEYS, LEVEL_NAME } from '../../assessment/avanzado/labels';
import { metaById } from '../../curriculum/catalog';
import { href } from '../../lib/router';
import { AdvancedChart } from './AdvancedChart';

const cellText = (c: string | number) => (typeof c === 'number' ? String(c).replace('.', ',').replace(/^-/, '−') : c);

/** Contexto, datos y enunciado del ítem (lo que ve el estudiante antes de responder; sin clave). */
export function ItemBody({ item: it, headingId, showMeta = true }: { item: AdvancedItem; headingId: string; showMeta?: boolean }) {
  return (
    <>
      <div className="chips">
        <span className="chip">Pregunta {it.n}</span>
        <span className="chip">Bloque {it.block}</span>
        {showMeta && <span className="chip comp">{COMPETENCY_SHORT_NAME[it.competency]}</span>}
        {showMeta && <span className="chip">Nivel {it.level}</span>}
        {it.simulatedData && <span className="chip warn">Datos ficticios con finalidad didáctica</span>}
      </div>
      <h3 id={headingId} className="adv-item-title">Pregunta {it.n}<span className="muted"> · {it.topic}</span></h3>
      <p className="adv-context">{it.context}</p>
      {it.table && (
        <div className="table-wrap" tabIndex={0} role="region" aria-label={`Tabla: ${it.table.caption}`}>
          <table>
            <caption>{it.table.caption}</caption>
            <thead><tr>{it.table.headers.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
            <tbody>{it.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{cellText(c)}</th> : <td key={j} className={typeof c === 'number' ? 'n' : undefined}>{cellText(c)}</td>))}</tr>)}</tbody>
          </table>
        </div>
      )}
      {it.chart && <AdvancedChart chart={it.chart} />}
      {it.schemeDescription && <div className="adv-scheme"><strong>Esquema:</strong> {it.schemeDescription}</div>}
      <p className="stem">{it.stem}</p>
    </>
  );
}

interface OptionsProps {
  item: AdvancedItem;
  value?: Key;
  onChange?: (k: Key) => void;
  disabled?: boolean;
  /** Muestra la clave y marca la elección (solo después de responder o al terminar el simulacro). */
  reveal?: boolean;
}

/** Opciones como grupo de botones de opción nativos (teclado y lectores de pantalla), con marca textual al revelar. */
export function OptionsRadio({ item: it, value, onChange, disabled, reveal }: OptionsProps) {
  const name = useId();
  return (
    <fieldset className="adv-options">
      <legend className="sr-only">Opciones de la pregunta {it.n}</legend>
      {KEYS.map((k) => {
        const isKey = reveal && k === it.key;
        const wrong = reveal && k === value && k !== it.key;
        return (
          <label key={k} className={`option adv-option${isKey ? ' correct' : ''}${wrong ? ' incorrect' : ''}${k === value ? ' chosen' : ''}`}>
            <input type="radio" name={name} value={k} checked={value === k} disabled={disabled} onChange={() => onChange?.(k)} />
            <span className="letter" aria-hidden="true">{k}</span>
            <span>
              <span className="sr-only">Opción {k}: </span>{it.options[k]}
              {isKey && <strong className="adv-mark ok"> · Respuesta correcta</strong>}
              {wrong && <strong className="adv-mark bad"> · Tu respuesta</strong>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Retroalimentación comentada: clave, justificación, por qué cada distractor es incorrecto, error a evitar y estrategia. */
export function SolutionPanel({ item: it, chosen, live }: { item: AdvancedItem; chosen?: Key; live?: boolean }) {
  const ok = chosen === it.key;
  const practice = it.practiceId ? metaById(it.practiceId) : undefined;
  return (
    <div className={`feedback adv-feedback ${chosen ? (ok ? 'ok' : 'bad') : 'neutral'}`} role={live ? 'status' : undefined}>
      <h4>{chosen ? (ok ? `✓ Respuesta correcta (${chosen})` : `✗ Respuesta incorrecta: elegiste ${chosen}; la correcta es ${it.key}`) : `Sin responder · la correcta es ${it.key}`}</h4>
      <p><strong>Por qué {it.key} es correcta:</strong> {it.justification}</p>
      <div>
        <strong>Por qué las otras opciones no lo son:</strong>
        <ul className="list adv-distractors">
          {KEYS.filter((k) => k !== it.key).map((k) => {
            const d = it.distractors[k];
            return (
              <li key={k} className={k === chosen ? 'chosen' : undefined}>
                <strong>{k}{k === chosen ? ' (tu elección)' : ''}.</strong> {d?.why} {d?.misconception && <><em>Razonamiento que lleva al error:</em> {d.misconception}</>}
              </li>
            );
          })}
        </ul>
      </div>
      <p><strong>Error que conviene evitar:</strong> {it.pitfall}</p>
      <p><strong>Estrategia:</strong> {it.strategy}</p>
      <p className="small muted">
        {COMPETENCY_SHORT_NAME[it.competency]} · {it.topic} · {LEVEL_NAME[it.level]}
        {it.source && <> · Fuente: {it.source}</>}
      </p>
      {practice && <p className="small">Practícalo en el laboratorio: <a href={href('practica', practice.id)}>{practice.title}</a></p>}
    </div>
  );
}

export interface GuidedRecord { chosen: Key; correct: boolean; firstTryCorrect: boolean }

/** Ítem de práctica guiada: responde, comprueba y lee la retroalimentación comentada; puede reintentar. */
export function GuidedItem({ item, record, draft, onDraft, onCheck, onRetry }: {
  item: AdvancedItem;
  record?: GuidedRecord;
  draft?: Key;
  onDraft: (k: Key) => void;
  onCheck: (k: Key) => void;
  onRetry: () => void;
}) {
  const headingId = useId();
  const value = record?.chosen ?? draft;
  return (
    <article className="card question adv-item" aria-labelledby={headingId}>
      <ItemBody item={item} headingId={headingId} />
      <OptionsRadio item={item} value={value} onChange={onDraft} disabled={!!record} reveal={!!record} />
      {!record ? (
        <div className="btn-row">
          <button type="button" className="btn primary" disabled={!draft} onClick={() => draft && onCheck(draft)}>Comprobar respuesta</button>
          {!draft && <span className="small muted">Selecciona una opción.</span>}
        </div>
      ) : (
        <>
          <SolutionPanel item={item} chosen={record.chosen} live />
          <div className="btn-row"><button type="button" className="btn small" onClick={onRetry}>Intentar de nuevo</button></div>
        </>
      )}
    </article>
  );
}

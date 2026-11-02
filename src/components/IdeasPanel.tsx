import { useState } from 'react';

/** Idea frecuente (concepción alternativa) que el estudiante decide si es cierta o falsa. */
export interface Idea { id: string; text: string; answer: 'cierto' | 'falso'; feedback: string }

/**
 * «Pon a prueba estas ideas»: el estudiante decide si cada idea es cierta y recibe retroalimentación explicada con datos.
 * Mismo comportamiento que el panel de las prácticas de química (src/labs/inorganicShared.tsx), sin arrastrar sus modelos.
 */
export function IdeasPanel({ ideas, idPrefix, intro }: { ideas: Idea[]; idPrefix: string; intro: string }) {
  const [picked, setPicked] = useState<Record<string, 'cierto' | 'falso'>>({});
  return (
    <section className="card stack" aria-labelledby={`${idPrefix}-ideas-h`}>
      <h3 id={`${idPrefix}-ideas-h`}>Pon a prueba estas ideas</h3>
      <p className="small muted" style={{ margin: 0 }}>{intro}</p>
      <ol className="list stack-sm" style={{ paddingLeft: '1.2em', margin: 0 }}>
        {ideas.map((it) => {
          const p = picked[it.id];
          const ok = p === it.answer;
          return (
            <li key={it.id} className="stack-sm">
              <span><strong>«{it.text}»</strong></span>
              <div className="btn-row" role="group" aria-label={`Tu respuesta: ${it.text}`}>
                <button type="button" className="btn small" aria-pressed={p === 'cierto'} onClick={() => setPicked((s) => ({ ...s, [it.id]: 'cierto' }))}>Es cierto</button>
                <button type="button" className="btn small" aria-pressed={p === 'falso'} onClick={() => setPicked((s) => ({ ...s, [it.id]: 'falso' }))}>Es falso</button>
              </div>
              <div aria-live="polite">
                {p && <div className={`notice ${ok ? 'ok' : 'warn'}`}><strong>{ok ? 'Bien. ' : 'Revisa. '}</strong>La idea es {it.answer === 'cierto' ? 'cierta' : 'falsa'}. {it.feedback}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

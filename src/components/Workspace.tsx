import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Barra de acompañamiento del procedimiento: muestra el paso actual y permite marcarlo. */
export function ProcedureCoach({ steps, done, onToggle, extra }: {
  steps: string[]; done: number[]; onToggle: (index: number, checked: boolean) => void; extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const current = steps.findIndex((_, i) => !done.includes(i));
  const allDone = current === -1;
  return (
    <section className="coach no-print" aria-labelledby="coach-title">
      <div className="coach-main">
        <h2 id="coach-title" className="coach-count">
          {allDone ? 'Procedimiento completo' : <>Paso {current + 1} <span className="muted">de {steps.length}</span></>}
        </h2>
        <p className="coach-text">
          {allDone ? 'Revisa tu cuaderno de datos y continúa con el análisis.' : steps[current]}
        </p>
        <div className="coach-actions">
          {!allDone && <button type="button" className="btn small primary" onClick={() => onToggle(current, true)}>Listo: siguiente paso</button>}
          <button type="button" className="btn small ghost" aria-expanded={open} aria-controls="coach-steps" onClick={() => setOpen((v) => !v)}>
            {open ? 'Ocultar pasos' : `Ver los ${steps.length} pasos`}
          </button>
          {extra}
        </div>
      </div>
      <div className="coach-track" aria-hidden="true">
        {steps.map((_, i) => <span key={i} className={done.includes(i) ? 'done' : i === current ? 'current' : undefined} />)}
      </div>
      {open && (
        <ol id="coach-steps" className="steps">
          {steps.map((step, i) => {
            const isDone = done.includes(i);
            return (
              <li key={i} className={isDone ? 'done' : i === current ? 'current' : undefined}>
                <input type="checkbox" id={`step-${i}`} checked={isDone} onChange={(e) => onToggle(i, e.target.checked)} />
                <label htmlFor={`step-${i}`} style={{ fontWeight: i === current ? 700 : 400 }}>{i + 1}. {step}</label>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Botón y estado de pantalla completa para el área de trabajo (útil con video beam). */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === ref.current && !!ref.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const supported = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.().catch(() => {});
  };
  return { ref, active, supported, toggle };
}

/** Aviso visual breve cuando se guarda un ensayo (el anuncio para lectores de pantalla lo hace el botón de registro). */
export function SavedToast({ count, onShow }: { count: number; onShow: () => void }) {
  const prev = useRef(count);
  const [visible, setVisible] = useState<number | null>(null);
  useEffect(() => {
    if (count > prev.current) {
      setVisible(count);
      const t = setTimeout(() => setVisible(null), 5000);
      prev.current = count;
      return () => clearTimeout(t);
    }
    prev.current = count;
  }, [count]);
  if (visible === null) return null;
  return (
    <div className="saved-toast no-print">
      <span aria-hidden="true" className="saved-check">✓</span>
      <span>Ensayo {visible} guardado en el cuaderno.</span>
      <button type="button" className="btn small" onClick={() => { setVisible(null); onShow(); }}>Ver cuaderno</button>
    </div>
  );
}

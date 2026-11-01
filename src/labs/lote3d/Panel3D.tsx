import { Suspense, useId, useState, type ReactNode } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';

/**
 * Tarjeta «Vista 3D» de las prácticas del lote 3D-1. La vista se descarga SOLO al abrirla (React.lazy en cada
 * laboratorio): ni su código ni 3Dmol.js entran en el JS de la práctica. Cerrada, ocupa una línea.
 */
export function Panel3D({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="card stack-sm lote3d" aria-labelledby={`${id}-h`} style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 id={`${id}-h`} style={{ margin: 0 }}>Vista 3D: {title}</h3>
        <button type="button" className={`btn small${open ? '' : ' primary'}`} aria-expanded={open} aria-controls={`${id}-c`} onClick={() => setOpen((o) => !o)}>
          {open ? 'Cerrar la vista 3D' : 'Abrir la vista 3D'}
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{summary}</p>
      <div id={`${id}-c`} hidden={!open} style={{ minWidth: 0 }}>
        {open && (
          <ErrorBoundary>
            <Suspense fallback={<p role="status" className="small">Cargando la vista 3D…</p>}>{children}</Suspense>
          </ErrorBoundary>
        )}
      </div>
    </section>
  );
}

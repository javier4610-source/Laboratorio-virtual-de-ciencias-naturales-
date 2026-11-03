import { useEffect, useState } from 'react';
import { SimControls } from '../../components/Experiment';
import { prefersReducedMotion } from '../../lib/prefs';

const reduced = () => { try { return prefersReducedMotion(); } catch { return false; } };

export interface FlowClock {
  /** Segundos de animación acumulados (solo avanzan mientras la persona la tiene en marcha). */
  t: number;
  on: boolean;
  reduce: boolean;
  start: () => void;
  pause: () => void;
}

/**
 * Reloj de la animación de cargas de una vista 3D cuyo laboratorio no tiene tiempo propio (circuitos, conductores):
 * arranca detenido, lo inicia la persona, se pausa (WCAG 2.2.2) y no corre con movimiento reducido. Mientras está
 * detenido no hay bucle (la escena se dibuja solo cuando cambia el laboratorio).
 */
export function useFlowClock(): FlowClock {
  const [t, setT] = useState(0);
  const [on, setOn] = useState(false);
  const reduce = reduced();
  useEffect(() => {
    if (!on) return;
    if (reduced()) { setOn(false); return; }
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
      last = now;
      if (reduced()) { setOn(false); return; }
      setT((x) => x + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return { t, on, reduce, start: () => setOn(true), pause: () => setOn(false) };
}

/** Botones «Mover los electrones / Pausar» de la vista 3D (desactivados con movimiento reducido). */
export function FlowControls({ clock, title, startLabel, still }: { clock: FlowClock; title: string; startLabel: string; still: string }) {
  return (
    <div className="stack-sm" style={{ marginBottom: 8 }}>
      <SimControls title={title} status={clock.on ? 'en-curso' : clock.t > 0 ? 'en-pausa' : 'listo'} startLabel={startLabel}
        onStart={clock.start} onPause={clock.pause} onResume={clock.start} disabled={clock.reduce} />
      {clock.reduce && <p className="small muted" style={{ margin: 0 }}>Movimiento reducido: {still}</p>}
    </div>
  );
}

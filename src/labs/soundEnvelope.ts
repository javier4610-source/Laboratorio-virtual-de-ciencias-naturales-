import { useEffect, useState } from 'react';
import { FORK_TAU, forkEnvelope } from '../models/soundResonance';
import { prefersReducedMotion } from '../lib/prefs';
import { FORK_RING_S } from './soundTones';

/* Envolvente en vivo de «sonido» (lo que suena = lo que se ve): la usan el banco y su vista 3D (lote 3D-5). */

/**
 * Amplitud relativa de la fuente en este instante: 1 con el generador encendido; e^(−t/τ) después del golpe del
 * diapasón; 0 en silencio. Con movimiento reducido se actualiza cuatro veces por segundo, sin animación continua.
 */
export function useEnvelope(strikeAt: number | null, genOn: boolean): number {
  const [env, setEnv] = useState(0);
  useEffect(() => {
    if (genOn) { setEnv(1); return; }
    if (strikeAt === null) { setEnv(0); return; }
    const reduced = prefersReducedMotion();
    const value = (now: number) => forkEnvelope(Math.min(FORK_RING_S, Math.max(0, now - strikeAt) / 1000), FORK_TAU);
    setEnv(value(performance.now()));
    if (reduced) {
      const id = window.setInterval(() => setEnv(value(performance.now())), 250);
      return () => window.clearInterval(id);
    }
    let raf = 0, last = 0;
    const tick = (now: number) => {
      if (now - last > 33) { last = now; setEnv(value(now)); }
      if (Math.max(0, now - strikeAt) / 1000 < FORK_RING_S) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [strikeAt, genOn]);
  return env;
}


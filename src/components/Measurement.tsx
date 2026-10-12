import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { SessionApi } from '../lib/session';
import { gaussian, measureValue, readingSeed, type MeasureOptions, type MeasurementMode } from '../lib/measurement';
import { INSTRUMENTS } from '../labs/instruments';
import { fmt } from '../lib/format';
import { Segmented } from './ui';

interface MeasurementCtx {
  practiceId: string;
  mode: MeasurementMode;
  counts: Record<string, number>;
  bump: (keys: string[]) => void;
}

const NO_COUNTS: Record<string, number> = {};

// Sin proveedor (p. ej. un laboratorio montado fuera de la práctica), las lecturas son ideales.
const Ctx = createContext<MeasurementCtx>({ practiceId: '', mode: 'ideal', counts: NO_COUNTS, bump: () => {} });

/** Proveedor del modo de medición: lee y guarda el modo y los contadores en la sesión de la práctica. */
export function MeasurementProvider({ api, practiceId, children }: { api: SessionApi; practiceId: string; children: ReactNode }) {
  const m = api.session.measurement;
  const mode: MeasurementMode = m?.mode === 'real' ? 'real' : 'ideal';
  const counts = m?.counts;
  const update = api.update;
  const bump = useCallback((keys: string[]) => update((s) => {
    const prev = s.measurement ?? { mode: 'ideal' as const, counts: {} };
    const next = { ...prev.counts };
    for (const k of keys) next[k] = (next[k] ?? 0) + 1;
    return { ...s, measurement: { ...prev, counts: next } };
  }), [update]);
  const value = useMemo(() => ({ practiceId, mode, counts: counts ?? NO_COUNTS, bump }), [practiceId, mode, counts, bump]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export type MeasureFn = (trueValue: number, o: MeasureOptions & { key: string }) => number;

/**
 * Lecturas de instrumentos según el modo de medición de la práctica.
 * - `measure(valor, { resolution, sigma?, relSigma?, key })`: en modo ideal solo cuantiza; en modo real
 *   suma ruido gaussiano reproducible (semilla: práctica + clave + contador de repetición) y cuantiza.
 * - `remeasure(...claves)`: el estudiante vuelve a medir; cambia el contador de esas lecturas (solo en modo real).
 */
export function useMeasure() {
  const c = useContext(Ctx);
  const measure = useCallback<MeasureFn>(
    (trueValue, o) => measureValue(trueValue, { ...o, mode: c.mode, seed: readingSeed(c.practiceId, o.key, c.counts[o.key] ?? 0) }),
    [c.mode, c.practiceId, c.counts],
  );
  /** Desviación aleatoria reproducible N(0, σ) de una magnitud no leída directamente (0 en modo ideal). */
  const deviation = useCallback(
    (key: string, sigma: number) => (c.mode === 'real' ? gaussian(readingSeed(c.practiceId, key, c.counts[key] ?? 0)) * sigma : 0),
    [c.mode, c.practiceId, c.counts],
  );
  const { mode, bump } = c;
  const remeasure = useCallback((...keys: string[]) => { if (mode === 'real') bump(keys); }, [mode, bump]);
  return { mode, real: mode === 'real', measure, deviation, remeasure };
}

const MODE_HELP: Record<MeasurementMode, string> = {
  ideal: 'Instrumento ideal: cada lectura es el valor del modelo redondeado a la resolución; repetir la medición da el mismo resultado.',
  real: 'Instrumento real: cada lectura incluye el error aleatorio típico del instrumento. Repite la misma medición varias veces: el cuaderno calcula la media y la desviación estándar.',
};

const num = (v: number) => fmt(v, Math.max(0, Math.min(5, Math.ceil(-Math.log10(v)))));

/** Selector del modo de medición y ficha de incertidumbre de los instrumentos del laboratorio. */
export function MeasurementPanel({ api, practiceId }: { api: SessionApi; practiceId: string }) {
  const list = INSTRUMENTS[practiceId];
  if (!list) return null;
  const mode: MeasurementMode = api.session.measurement?.mode === 'real' ? 'real' : 'ideal';
  const setMode = (m: MeasurementMode) => api.update((s) => ({ ...s, measurement: { mode: m, counts: s.measurement?.counts ?? {} } }));
  return (
    <section className="measure-panel no-print" aria-label="Modo de medición">
      <div className="measure-main">
        <Segmented<MeasurementMode> label="Modo de medición" value={mode} onChange={setMode}
          options={[{ value: 'ideal', label: 'Instrumento ideal' }, { value: 'real', label: 'Instrumento real' }]} />
        <p className="small muted measure-help">{MODE_HELP[mode]}</p>
      </div>
      <details className="measure-sheet">
        <summary>Ficha de incertidumbre de los instrumentos</summary>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Ficha de incertidumbre de los instrumentos">
          <table>
            <caption className="sr-only">Resolución y desviación típica de cada instrumento</caption>
            <thead>
              <tr><th scope="col">Instrumento</th><th scope="col">Magnitud</th><th scope="col" className="n">Resolución</th><th scope="col" className="n">Desviación típica (σ)</th><th scope="col">Origen principal</th></tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.quantity}</td>
                  <td className="n">{num(i.resolution)} {i.unit}</td>
                  <td className="n">{[i.sigma ? `${num(i.sigma)} ${i.unit}` : '', i.relSigma ? `${fmt(i.relSigma * 100, 1)} % de la lectura` : ''].filter(Boolean).join(' ⊕ ')}</td>
                  <td className="small">{i.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Valores ilustrativos, típicos de equipos escolares (no corresponden a una marca ni a un modelo concreto). «⊕» indica que los dos términos se combinan en cuadratura: σ = √(σ_abs² + (σ_rel·lectura)²). La incertidumbre por resolución equivale a resolución/√12.</p>
      </details>
    </section>
  );
}

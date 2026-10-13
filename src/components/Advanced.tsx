import { createContext, createElement, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { PracticeDef } from '../core/types';
import type { SessionApi } from '../lib/session';
import {
  clampParam, equationSteps, isModified, loadAdvancedPref, mathToText, modifiedSummary, parseMath, saveAdvancedPref,
  formatQuantity, type MathNode, type ModelParamSpec, type ModelState,
} from '../lib/advanced';
import { paramsFor } from '../labs/modelParams';
import { getEnrollment } from '../lib/classroom';
import { fmt } from '../lib/format';
import { Slider } from './ui';

/* ------------------------------------------------------------------ contexto */

interface AdvancedCtx {
  practiceId: string;
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  specs: ModelParamSpec[];
  /** Valores efectivos de todos los parámetros (referencia o modificados). */
  values: Record<string, number>;
  /** Solo los parámetros modificados (lo que los laboratorios pasan a sus modelos). */
  active: Record<string, number | undefined>;
  setParam: (key: string, v: number) => void;
  resetParams: (key?: string) => void;
  summary: string;
}

const NONE: AdvancedCtx = {
  practiceId: '', enabled: false, setEnabled: () => {}, specs: [], values: {}, active: {},
  setParam: () => {}, resetParams: () => {}, summary: '',
};
const Ctx = createContext<AdvancedCtx>(NONE);
const PublishCtx = createContext<(s: ModelState | null) => void>(() => {});
const StateCtx = createContext<ModelState | null>(null);

const studentKey = () => { try { const e = getEnrollment(); return e ? String(e.student.id) : ''; } catch { return ''; } };

/** Proveedor del modo avanzado de una práctica: preferencia del estudiante, parámetros editables y estado publicado por el laboratorio. */
export function AdvancedProvider({ practiceId, children }: { practiceId: string; children: ReactNode }) {
  const [enabled, setEnabledState] = useState(() => loadAdvancedPref(studentKey()));
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [model, setModel] = useState<ModelState | null>(null);
  const specs = useMemo(() => paramsFor(practiceId), [practiceId]);
  const setEnabled = useCallback((on: boolean) => { setEnabledState(on); saveAdvancedPref(on, studentKey()); }, []);
  const setParam = useCallback((key: string, v: number) => {
    const spec = specs.find((s) => s.key === key);
    if (!spec) return;
    setOverrides((o) => ({ ...o, [key]: clampParam(spec, v) }));
  }, [specs]);
  const resetParams = useCallback((key?: string) => setOverrides((o) => {
    if (!key) return {};
    const next = { ...o }; delete next[key]; return next;
  }), []);
  const value = useMemo<AdvancedCtx>(() => {
    const values: Record<string, number> = {};
    const active: Record<string, number | undefined> = {};
    for (const s of specs) {
      const o = overrides[s.key];
      const mod = enabled && o !== undefined && isModified(s, o);
      values[s.key] = mod ? o : s.value;
      active[s.key] = mod ? o : undefined;
    }
    return { practiceId, enabled, setEnabled, specs, values, active, setParam, resetParams, summary: enabled ? modifiedSummary(specs, values) : '' };
  }, [practiceId, enabled, setEnabled, specs, overrides, setParam, resetParams]);
  // Publicar solo cambia el estado si el contenido cambió (evita renders en cadena).
  const publish = useCallback((s: ModelState | null) => setModel((prev) => (JSON.stringify(prev) === JSON.stringify(s) ? prev : s)), []);
  return (
    <Ctx.Provider value={value}>
      <PublishCtx.Provider value={publish}>
        <StateCtx.Provider value={model}>{children}</StateCtx.Provider>
      </PublishCtx.Provider>
    </Ctx.Provider>
  );
}

export const useAdvanced = () => useContext(Ctx);

/**
 * Parámetros del modelo modificados por el estudiante en el modo avanzado (`undefined` = usar el valor del modelo).
 * Los laboratorios los pasan a sus funciones del modelo: `simulateCart({ ..., g: P.g })`.
 */
export function useModelParams(): Record<string, number | undefined> {
  return useContext(Ctx).active;
}

/**
 * Publica las ecuaciones del modelo y los valores actuales de sus magnitudes para el panel «Ecuaciones del modelo».
 * `build` solo se evalúa con el modo avanzado encendido; `deps` son los valores de los que depende.
 */
export function usePublishModel(build: () => ModelState | null, deps: unknown[]): void {
  const { enabled } = useContext(Ctx);
  const publish = useContext(PublishCtx);
  useEffect(() => {
    if (!enabled) return;
    let s: ModelState | null = null;
    try { s = build(); } catch { s = null; }
    publish(s);
  }, [enabled, publish, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => publish(null), [publish]);
}

/** Envuelve la sesión del laboratorio: cada ensayo guardado con parámetros modificados queda marcado en su observación. */
export function useAdvancedApi(api: SessionApi): SessionApi {
  const { summary } = useContext(Ctx);
  return useMemo(() => {
    if (!summary) return api;
    return {
      ...api,
      addTrial: (datasetId: string, values: Parameters<SessionApi['addTrial']>[1]) => {
        const t = api.addTrial(datasetId, values);
        api.update((s) => ({ ...s, trials: s.trials.map((x) => (x.id === t.id ? { ...x, note: summary } : x)) }));
        return { ...t, note: summary };
      },
    };
  }, [api, summary]);
}

/* ------------------------------------------------------------------ MathML */

const mathmlSupported = () => {
  try { return typeof window !== 'undefined' && 'MathMLElement' in window; } catch { return false; }
};

function renderNodes(nodes: MathNode[], keyBase = 'n'): ReactNode[] {
  return nodes.map((n, i) => renderNode(n, `${keyBase}-${i}`));
}

function row(nodes: MathNode[], key: string): ReactNode {
  return createElement('mrow', { key }, ...renderNodes(nodes, key));
}

function renderNode(n: MathNode, key: string): ReactNode {
  switch (n.k) {
    case 'id': return createElement('mi', { key, ...(n.v.length > 1 && !/^[A-Za-zΔ]$/.test(n.v) ? { mathvariant: 'normal' } : {}) }, n.v);
    case 'num': return createElement('mn', { key }, n.v);
    case 'op': return createElement('mo', { key, ...(n.v === '(' || n.v === ')' ? { stretchy: 'false' } : {}) }, n.v);
    case 'text': return createElement('mtext', { key }, n.v);
    case 'unit': return createElement('mtext', { key, className: 'm-unit' }, n.v);
    case 'space': return createElement('mspace', { key, width: '0.2em' });
    case 'row': return row(n.a, key);
    case 'frac': return createElement('mfrac', { key }, row(n.n, `${key}n`), row(n.d, `${key}d`));
    case 'sqrt': return createElement('msqrt', { key }, ...renderNodes(n.a, key));
    case 'sup': return createElement('msup', { key }, renderNode(n.b, `${key}b`), row(n.e, `${key}e`));
    case 'sub': return createElement('msub', { key }, renderNode(n.b, `${key}b`), row(n.s, `${key}s`));
    case 'subsup': return createElement('msubsup', { key }, renderNode(n.b, `${key}b`), row(n.s, `${key}s`), row(n.e, `${key}e`));
    case 'var': return createElement('mtext', { key }, `[${n.key}]`);
  }
}

/** Fórmula con tipografía matemática (MathML) y texto equivalente para lectores de pantalla y navegadores sin MathML. */
export function MathFormula({ nodes, text, className, lead }: { nodes: MathNode[]; text?: string; className?: string; /** Antepone un espacio al texto equivalente (pasos encadenados). */ lead?: boolean }) {
  const plain = `${lead ? ' ' : ''}${text ?? mathToText(nodes)}`;
  if (!mathmlSupported()) return <span className={`math-fallback ${className ?? ''}`}>{plain}</span>;
  return (
    <span className={className}>
      {createElement('math', { 'aria-hidden': 'true', className: 'mml' }, row(nodes, 'r'))}
      <span className="sr-only">{plain}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ interruptor */

/** Interruptor accesible «Modo avanzado» (se recuerda por estudiante en este navegador). */
export function AdvancedToggle() {
  const { enabled, setEnabled, practiceId } = useAdvanced();
  const id = useId();
  if (!practiceId) return null;
  return (
    <section className="adv-bar no-print" aria-label="Modo avanzado">
      <button type="button" role="switch" aria-checked={enabled} aria-labelledby={`${id}-l`} aria-describedby={`${id}-d`}
        className="switch" onClick={() => setEnabled(!enabled)}>
        <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
        <span id={`${id}-l`} className="switch-label">Modo avanzado</span>
      </button>
      <p id={`${id}-d`} className="small muted adv-help">
        {enabled
          ? 'Activado: verás las ecuaciones del modelo con los valores actuales, podrás cambiar constantes del modelo y superponer la curva del modelo en el cuaderno.'
          : 'Muestra las ecuaciones del modelo con los valores actuales, constantes editables y la curva del modelo sobre tus datos.'}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ panel de ecuaciones */

function EquationBlock({ state, index }: { state: ModelState; index: number }) {
  const eq = state.equations[index];
  const steps = useMemo(() => { try { return equationSteps(eq, state.vars); } catch { return null; } }, [eq, state.vars]);
  if (!steps) return <li className="adv-eq"><p className="small muted">{eq.title}: {eq.expr}</p></li>;
  return (
    <li className="adv-eq">
      {eq.title && <p className="adv-eq-title">{eq.title}</p>}
      <div className="adv-eq-steps" data-eq-text={steps.text}>
        <MathFormula className="adv-step" nodes={[...steps.lhs, { k: 'op', v: '=' }, ...steps.steps[0]]} text={`${mathToText(steps.lhs)} = ${mathToText(steps.steps[0])}`} />
        {steps.steps.slice(1).map((s, i) => (
          <MathFormula key={i} className="adv-step" lead nodes={[{ k: 'op', v: '=' }, ...s]} text={`= ${mathToText(s)}`} />
        ))}
      </div>
      {steps.missing.length > 0 && (
        <p className="small muted">Faltan valores para sustituir ({steps.missing.map((k) => (state.vars[k] ? mathToText(parseMath(state.vars[k].sym)) : k)).join(', ')}): realiza la medición en el laboratorio.</p>
      )}
      {eq.note && <p className="small muted adv-eq-note">{eq.note}</p>}
    </li>
  );
}

function ParamEditor() {
  const { specs, values, setParam, resetParams, enabled } = useAdvanced();
  if (!enabled || specs.length === 0) return null;
  const anyModified = specs.some((s) => isModified(s, values[s.key]));
  return (
    <div className="adv-params">
      <div className="adv-params-head">
        <h4>Parámetros del modelo</h4>
        {anyModified && <button type="button" className="btn small" onClick={() => resetParams()}>Restablecer los valores del modelo</button>}
      </div>
      <p className="small muted">Cambia una constante del modelo para explorar «¿qué pasaría si…?». Los ensayos que guardes quedan marcados en su observación.</p>
      {specs.map((s) => {
        const v = values[s.key];
        const mod = isModified(s, v);
        return (
          <div key={s.key} className={`adv-param${mod ? ' modified' : ''}`}>
            <Slider label={`${s.label} (${mathToText(parseMath(s.sym))})`} value={v} min={s.min} max={s.max} step={s.step} unit={s.unit} decimals={s.decimals}
              onChange={(x) => setParam(s.key, x)} hint={s.hint} />
            <div className="adv-param-foot">
              {mod
                ? <span className="adv-badge" role="status">Parámetro del modelo modificado · referencia {fmt(s.value, s.decimals)}{s.unit ? ` ${s.unit}` : ''}</span>
                : <span className="small muted">Valor de referencia del modelo</span>}
              {mod && <button type="button" className="btn small ghost" onClick={() => resetParams(s.key)}>Restablecer {mathToText(parseMath(s.sym))}</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Panel «Ecuaciones del modelo» del experimento (solo con el modo avanzado encendido). */
export function ModelEquationsPanel({ practice }: { practice: PracticeDef }) {
  const { enabled, summary } = useAdvanced();
  const state = useContext(StateCtx);
  if (!enabled) return null;
  const varList = state ? Object.entries(state.vars).filter(([, q]) => q.name) : [];
  return (
    <section className="card adv-panel" aria-labelledby="adv-title">
      <header className="adv-head">
        <h3 id="adv-title">Ecuaciones del modelo</h3>
        <p className="small muted">{practice.model.name}</p>
      </header>
      {summary && <p className="notice warn small adv-modified" role="status">{summary}. Las lecturas del laboratorio ya usan este valor.</p>}
      {state && state.equations.length > 0 ? (
        <>
          <p className="small muted">Cada ecuación se escribe primero con símbolos y luego con los valores actuales de los controles del laboratorio (se actualiza en vivo).</p>
          <ol className="adv-eqs">
            {state.equations.map((_, i) => <EquationBlock key={i} state={state} index={i} />)}
          </ol>
          {state.note && <p className="small muted">{state.note}</p>}
          {varList.length > 0 && (
            <details className="adv-vars">
              <summary>Magnitudes y valores actuales</summary>
              <dl>
                {varList.map(([k, q]) => (
                  <div key={k}>
                    <dt><MathFormula nodes={parseMath(q.sym)} /> <span className="muted">{q.name}</span></dt>
                    <dd className="num">{formatQuantity(q)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
      ) : (
        <>
          <p className="small muted">Este laboratorio muestra las ecuaciones del modelo en forma general; la sustitución con los valores en vivo aún no está disponible aquí.</p>
          <ul className="list adv-static">{practice.model.equations.map((e) => <li key={e} className="num">{e}</li>)}</ul>
        </>
      )}
      <ParamEditor />
    </section>
  );
}

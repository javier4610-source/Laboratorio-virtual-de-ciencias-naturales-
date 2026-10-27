import { useId, useRef, useState, type ReactNode } from 'react';
import { fmt, parseLocaleNumber } from '../lib/format';
import { playSound } from '../lib/sound';
import { ConditionAlert } from './ConditionAlert';
import { ControlHintNote, useControlHintBus } from './ControlHint';
import type { ControlHint } from '../lib/controlVariables';
import { sortConditions, type ModelCondition } from '../models/conditions';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (v: number) => void;
  hint?: string;
  id?: string;
}

/** Control deslizante con campo numérico sincronizado y validación de rango. */
export function Slider({ label, value, min, max, step, unit, decimals = 1, onChange, hint, id }: SliderProps) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commit = (text: string) => {
    const v = parseLocaleNumber(text);
    if (Number.isNaN(v)) { setError('Escribe un número.'); playSound('error'); return; }
    if (v < min || v > max) { setError(`Usa un valor entre ${fmt(min, decimals)} y ${fmt(max, decimals)}.`); playSound('error'); return; }
    setError(null);
    setDraft(null);
    onChange(v);
  };
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={`${baseId}-r`}>{label}</label>
        <output htmlFor={`${baseId}-r`} aria-live="off">{fmt(value, decimals)}{unit ? ` ${unit}` : ''}</output>
      </div>
      <div className="slider-row">
        <input
          id={`${baseId}-r`} type="range" min={min} max={max} step={step} value={value}
          aria-valuetext={`${fmt(value, decimals)} ${unit ?? ''}`}
          onChange={(e) => { setError(null); setDraft(null); onChange(Number(e.target.value)); }}
        />
        <input
          id={`${baseId}-n`} type="text" inputMode="decimal" aria-label={`${label} (valor exacto${unit ? ' en ' + unit : ''})`}
          value={draft ?? fmt(value, decimals)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${baseId}-e` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => { if (draft !== null) commit(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
        />
      </div>
      <div className="range-labels" aria-hidden="true"><span>{fmt(min, decimals)}</span><span>{fmt(max, decimals)}</span></div>
      {error && <div id={`${baseId}-e`} className="small" style={{ color: 'var(--bad)' }} role="alert">{error}</div>}
      {hint && <div className="hint small muted">{hint}</div>}
    </div>
  );
}

interface SegProps<T extends string> { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; }

export function Segmented<T extends string>({ label, value, options, onChange }: SegProps<T>) {
  // Id generado: una etiqueta con espacios no sirve como id para aria-labelledby.
  const labelId = useId();
  return (
    <div className="field">
      <span className="small" style={{ fontWeight: 600 }} id={labelId}>{label}</span>
      <div className="seg" role="group" aria-labelledby={labelId}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

interface SelectProps { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; id?: string; hint?: string; }

export function Select({ label, value, options, onChange, id, hint }: SelectProps) {
  const autoId = useId();
  const sid = id ?? autoId;
  return (
    <div className="field">
      <label htmlFor={sid}>{label}</label>
      <select id={sid} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export interface ReadoutItem {
  k: string;
  v: ReactNode;
  /** Lectura directa de un instrumento o resultado medido (se resalta con el color de dato). */
  data?: boolean;
  /** Resolución o incertidumbre del instrumento, p. ej. «± 0,1 g» (se muestra bajo el valor). */
  resolution?: string;
  /** Estado de la lectura: dentro del rango esperado, en el límite o fuera de rango (se dice en texto, no solo con color). */
  state?: 'ok' | 'warn' | 'bad';
}

const STATE_TEXT = { ok: 'en rango', warn: 'en el límite', bad: 'fuera de rango' } as const;

/** Lecturas de instrumentos: rótulo, valor con unidad en tipografía de datos y, si se indica, la resolución y el estado. */
export function Readout({ items, live = true }: { items: ReadoutItem[]; live?: boolean }) {
  return (
    <div className="readout" aria-live={live ? 'polite' : undefined}>
      {items.map((it) => (
        <div className={`item${it.state ? ` state-${it.state}` : ''}`} key={it.k}>
          <div className="k">{it.k}</div>
          <div className={`v${it.data ? ' data' : ''}`}>{it.v}</div>
          {(it.resolution || it.state) && (
            <div className="r">
              {it.state && <span className={`r-state ${it.state}`}>{STATE_TEXT[it.state]}</span>}
              {it.resolution && <span className="r-res">{it.resolution}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'warn' | 'bad'; children: ReactNode }) {
  return <div className={`notice ${kind}`} role={kind === 'bad' || kind === 'warn' ? 'status' : undefined}>{children}</div>;
}

/** Advertencia para `Warnings`: texto simple (como antes) o condición del modelo con nivel y corrección. */
export type WarningItem = string | ModelCondition;

/**
 * Advertencias del modelo sobre las condiciones elegidas (fuera de rango, supuestos que dejan de valer…).
 * Usa el aviso de condición común (ConditionAlert) para que todas las prácticas las muestren igual.
 * - Solo textos: un aviso «Atención» con la lista (comportamiento anterior; `fix` opcional común).
 * - Con condiciones (`{ text, level, fix }`): un aviso por condición, cada causa junto a su «Cómo corregirlo»,
 *   ordenados por gravedad (no válida, atención, nota) dentro de UNA sola región de estado, para que el lector de
 *   pantalla los anuncie juntos y no como varias regiones que compiten.
 */
export function Warnings({ list, fix }: { list: WarningItem[]; fix?: ReactNode }) {
  if (list.length === 0) return null;
  if (list.every((w) => typeof w === 'string')) {
    const texts = list as string[];
    return (
      <ConditionAlert level="advertencia" title={texts.length === 1 ? 'revisa esta condición del experimento' : `revisa estas ${texts.length} condiciones del experimento`} fix={fix}>
        <ul className="list">{texts.map((w) => <li key={w}>{w}</li>)}</ul>
      </ConditionAlert>
    );
  }
  const items = sortConditions(list.map((w): ModelCondition => (typeof w === 'string' ? { text: w, level: 'advertencia' } : w)));
  const label = items.length === 1 ? 'Condición del experimento' : `${items.length} condiciones del experimento`;
  return (
    <div className="conditions" role="status" aria-label={label}>
      {items.map((c, i) => <ConditionAlert key={`${i}-${c.text}`} live={false} level={c.level} cause={c.text} fix={c.fix} />)}
    </div>
  );
}

/**
 * Botón de registro de ensayo con confirmación accesible. Si el ensayo cambió dos o más variables de entrada a la vez
 * respecto al anterior, muestra debajo la pista de control de variables (una nota que se cierra con «Entendido»; el
 * ensayo se guarda igual). La confirmación y la pista se anuncian en la misma región `aria-live` del botón.
 */
export function RecordButton({ onRecord, disabled, label = 'Guardar ensayo en la tabla' }: { onRecord: () => void; disabled?: boolean; label?: string }) {
  const [saved, setSaved] = useState(0);
  const [hint, setHint] = useState<ControlHint | null>(null);
  const bus = useControlHintBus();
  const btn = useRef<HTMLButtonElement>(null);
  const record = () => {
    bus?.begin();
    onRecord();
    setHint(bus?.take() ?? null);
    setSaved((n) => n + 1);
    playSound('confirm');
  };
  return (
    <div className="record-block">
      <div className="btn-row">
        <button ref={btn} type="button" className="btn data" disabled={disabled} onClick={record}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h8l2 2v10H3z M5 2v4h6V2 M5 10h6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
          {label}
        </button>
        <span className="small muted" aria-live="polite">{saved > 0 ? `Ensayo guardado (${saved} en esta sesión).${hint ? ' Pista: cambiaste varias variables a la vez; lee la nota debajo del botón.' : ''}` : ''}</span>
      </div>
      {hint && <ControlHintNote hint={hint} onDismiss={() => { setHint(null); btn.current?.focus(); }} />}
    </div>
  );
}

/** Botón con confirmación en la misma página (no usa window.confirm, que algunos entornos bloquean). */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn small ghost danger', icon }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string; icon?: ReactNode }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className={className} onClick={() => setAsking(true)}>{icon}{label}</button>;
  return (
    <span className="btn-row" role="group" aria-label="Confirmación">
      <span className="small">{confirmLabel}</span>
      <button type="button" className="btn small danger" onClick={() => { setAsking(false); onConfirm(); }} autoFocus>Sí</button>
      <button type="button" className="btn small" onClick={() => setAsking(false)}>Cancelar</button>
    </span>
  );
}

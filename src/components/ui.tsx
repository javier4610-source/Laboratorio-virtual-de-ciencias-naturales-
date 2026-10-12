import { useId, useState, type ReactNode } from 'react';
import { fmt, parseLocaleNumber } from '../lib/format';
import { playSound } from '../lib/sound';

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

export function Readout({ items, live = true }: { items: { k: string; v: ReactNode; data?: boolean }[]; live?: boolean }) {
  return (
    <div className="readout" aria-live={live ? 'polite' : undefined}>
      {items.map((it) => (
        <div className="item" key={it.k}>
          <div className="k">{it.k}</div>
          <div className={`v${it.data ? ' data' : ''}`}>{it.v}</div>
        </div>
      ))}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'warn' | 'bad'; children: ReactNode }) {
  return <div className={`notice ${kind}`} role={kind === 'bad' || kind === 'warn' ? 'status' : undefined}>{children}</div>;
}

export function Warnings({ list }: { list: string[] }) {
  if (list.length === 0) return null;
  return (
    <div className="notice warn" role="status">
      <strong>Atención:</strong>
      <ul className="list">{list.map((w) => <li key={w}>{w}</li>)}</ul>
    </div>
  );
}

/** Botón de registro de ensayo con confirmación accesible. */
export function RecordButton({ onRecord, disabled, label = 'Guardar ensayo en la tabla' }: { onRecord: () => void; disabled?: boolean; label?: string }) {
  const [saved, setSaved] = useState(0);
  return (
    <div className="btn-row">
      <button type="button" className="btn data" disabled={disabled} onClick={() => { onRecord(); setSaved((n) => n + 1); playSound('confirm'); }}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h8l2 2v10H3z M5 2v4h6V2 M5 10h6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        {label}
      </button>
      <span className="small muted" aria-live="polite">{saved > 0 ? `Ensayo guardado (${saved} en esta sesión).` : ''}</span>
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

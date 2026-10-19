import { useId, type ReactNode } from 'react';
import { StatusChip } from '../Provenance';
import { fmt } from '../../lib/format';
import type { ExpProp } from '../../models/hydrocarbons';
import { pubchemPage, type OrganicRecord } from '../../data/quimica/organica';

/**
 * Piezas de interfaz compartidas por las prácticas de química orgánica (reutilizables).
 */

/** Valor experimental con su fuente en una línea (o «Sin información disponible»). */
export function ExpValue({ p, decimals = 1, unit, missing = 'Sin información disponible en PubChem' }: { p: ExpProp | null; decimals?: number; unit?: string; missing?: string }) {
  if (!p) return <span className="muted">{missing}</span>;
  return <span title={`${p.text} — ${p.source}`}>{fmt(p.value, decimals)} {unit ?? p.unit}</span>;
}

/** Enlace a la ficha del compuesto en PubChem. */
export function PubChemLink({ rec }: { rec: Pick<OrganicRecord, 'cid' | 'nombre'> }) {
  return <a href={pubchemPage(rec.cid)} target="_blank" rel="noopener noreferrer">CID {rec.cid}</a>;
}

/** Lista de fuentes de las propiedades experimentales de un compuesto. */
export function SourceList({ items }: { items: { label: string; p: ExpProp | null; motivo?: string }[] }) {
  return (
    <ul className="list small" style={{ margin: 0 }}>
      {items.map(({ label, p, motivo }) => (
        <li key={label}>
          <strong>{label}:</strong>{' '}
          {p ? <>«{p.text}» — {p.source}. <a href={p.url} target="_blank" rel="noopener noreferrer">PUG View</a> ({p.date}){p.note ? `; ${p.note}` : ''}.</> : <span className="muted">{motivo ?? 'Sin información disponible en PubChem.'}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Franja de estatus para una sección. */
export function StatusLine({ status, prefix, children }: { status: Parameters<typeof StatusChip>[0]['status']; prefix: string; children: ReactNode }) {
  return (
    <div className="btn-row small" role="note" aria-label={`Estatus: ${prefix}`}>
      <StatusChip status={status} prefix={prefix} /> <span className="muted">{children}</span>
    </div>
  );
}

/** Tubo de ensayo ilustrado para las pruebas de insaturación (Ilustración educativa). */
export function TestTubeSvg({ color, precipitate, label, idPrefix }: { color: string; precipitate?: boolean; label: string; idPrefix: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 120 240" role="img" aria-labelledby={`${idPrefix}-${uid}-t`} style={{ width: 96, height: 'auto' }}>
      <title id={`${idPrefix}-${uid}-t`}>{label}</title>
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path d="M38 16 v170 a22 22 0 0 0 44 0 v-170" fill="var(--surface-2)" stroke="var(--glass-edge)" strokeWidth="2" />
      <path d="M39 120 v66 a21 21 0 0 0 42 0 v-66 z" fill={color} style={{ transition: 'fill 1.2s ease' }} />
      {precipitate && <ellipse cx="60" cy="200" rx="16" ry="6" fill="#6b4a2b" opacity="0.85" />}
      <path d="M38 16 v170 a22 22 0 0 0 44 0 v-170" fill={`url(#${uid}-g)`} />
      <rect x="32" y="10" width="56" height="8" rx="3" fill="var(--surface-3)" stroke="var(--glass-edge)" />
    </svg>
  );
}

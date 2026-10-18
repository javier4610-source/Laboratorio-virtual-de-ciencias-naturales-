import { flag } from '../lib/flags';
import { STATUS_HELP, STATUS_LABEL, type EpistemicStatus, type Provenance } from '../lib/provenance';

/** Etiqueta de estatus epistémico (ADR 0002). Muestra el estatus y lo explica en texto, no solo con color. */
export function StatusChip({ status, prefix }: { status: EpistemicStatus; prefix?: string }) {
  return (
    <span className={`prov-chip prov-${status}`} title={STATUS_HELP[status]}>
      {prefix && <span className="prov-prefix">{prefix}:</span>} {STATUS_LABEL[status]}
    </span>
  );
}

/** Franja de procedencia sobre el laboratorio: qué es dibujo y qué es cálculo. */
export function ProvenanceStrip({ prov }: { prov: Provenance }) {
  if (!flag('procedencia')) return null;
  return (
    <div className="prov-strip small" role="note" aria-label="Procedencia de los resultados">
      <StatusChip status={prov.data} prefix="Lecturas y datos" />
      <StatusChip status={prov.scene} prefix="Escena" />
      <span className="muted">{prov.detail}</span>
    </div>
  );
}

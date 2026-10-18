import { useId, useRef, useState } from 'react';
import type { PracticeDef } from '../core/types';
import type { SessionApi } from '../lib/session';
import { flag } from '../lib/flags';
import { buildExperimentRecord, importExperimentRecord, validateExperimentRecord, type ExperimentRecord } from '../lib/experimentRecord';
import { downloadText } from '../lib/report';
import { Icon } from './icons';

/** Exportar e importar el registro reproducible del experimento (programa v2, sección 12; ADR 0003). */
export function ExperimentRecordCard({ practice, api }: { practice: PracticeDef; api: SessionApi }) {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  if (!flag('registroExperimento')) return null;
  const n = api.session.trials.length;

  const exportRecord = () => {
    const rec = buildExperimentRecord(practice, api.session);
    const ok = downloadText(`registro-${practice.id}-${rec.fecha.slice(0, 10)}.json`, JSON.stringify(rec, null, 2), 'application/json');
    setMsg(ok ? { kind: 'ok', text: `Registro descargado (${n} ensayo${n === 1 ? '' : 's'}, versión ${rec.software.version}).` } : { kind: 'bad', text: 'Este entorno no permite descargas.' });
  };

  const importFile = async (file: File) => {
    if (file.size > 2_000_000) { setMsg({ kind: 'bad', text: 'El archivo supera 2 MB: no parece un registro del laboratorio.' }); return; }
    let obj: unknown;
    try { obj = JSON.parse(await file.text()); } catch { setMsg({ kind: 'bad', text: 'El archivo no es un JSON válido.' }); return; }
    const err = validateExperimentRecord(obj, practice.id);
    if (err) { setMsg({ kind: 'bad', text: err }); return; }
    const rec = obj as ExperimentRecord;
    const { added } = importExperimentRecord(rec, api.session);
    api.update((s) => importExperimentRecord(rec, s).session);
    setMsg({ kind: 'ok', text: added === 1 ? 'Se agregó 1 ensayo del registro.' : added > 1 ? `Se agregaron ${added} ensayos del registro.` : 'El registro no tenía ensayos nuevos para esta sesión.' });
  };

  return (
    <section className="card stack-sm no-print" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`}>Registro reproducible del experimento</h3>
      <p className="small muted">
        Guarda en un archivo JSON la pregunta, la hipótesis, el modelo con su versión, el modo de medición con su semilla y cada
        ensayo con su estatus. No incluye datos personales. Puedes importarlo en otro equipo para continuar o comparar.
      </p>
      <div className="btn-row">
        <button type="button" className="btn small" onClick={exportRecord} disabled={n === 0}>
          <Icon name="descargar" size={17} />Exportar registro (JSON)
        </button>
        <button type="button" className="btn small" onClick={() => input.current?.click()}>
          <Icon name="datos" size={17} />Importar registro
        </button>
        <input ref={input} type="file" accept="application/json,.json" hidden aria-label="Archivo de registro del experimento"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
      </div>
      {msg && <p className={`notice ${msg.kind === 'ok' ? 'ok' : 'bad'} small`} role="status">{msg.text}</p>}
    </section>
  );
}

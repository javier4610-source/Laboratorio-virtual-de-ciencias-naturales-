import { useMemo, useState } from 'react';
import { ADVANCED_BANK, blockName, blocksIn } from '../assessment/avanzado';
import { advancedToExportItem, studentTemplateCsv } from '../assessment/avanzado/instruments';
import { DISCLAIMER } from '../assessment/avanzado/labels';
import { toGift, toMoodleXml } from '../lib/lmsExport';
import { downloadBlob, downloadText } from '../lib/report';
import { href } from '../lib/router';
import { Select } from '../components/ui';
import { Icon } from '../components/icons';

/** Sin BOM para Moodle (igual que en LmsExportTab). */
function downloadUtf8(filename: string, content: string, mime: string): boolean {
  try { return downloadBlob(filename, new Blob([content], { type: `${mime};charset=utf-8` })); } catch { return false; }
}

/**
 * Instrumentos del docente para el banco avanzado (Parte V): exportación a Moodle XML o GIFT con la justificación y el
 * análisis de distractores como retroalimentación, y la plantilla CSV para registrar aciertos, errores y dificultades.
 * La tabla de resultados por competencia y bloque se descarga al terminar cada simulacro.
 */
export function AdvancedTeacherSection() {
  const [block, setBlock] = useState('');
  const [msg, setMsg] = useState('');
  const items = useMemo(() => ADVANCED_BANK.filter((it) => !block || it.block === block), [block]);
  const base = `banco-avanzado-saber11${block ? `-bloque-${block.toLowerCase()}` : ''}`;
  const empty = ADVANCED_BANK.length === 0;
  const run = (ok: boolean, what: string) => setMsg(ok ? what : 'Este entorno no permite descargas.');
  return (
    <section className="card stack" aria-labelledby="lms-adv-h">
      <h3 id="lms-adv-h">Banco avanzado tipo Saber 11</h3>
      <p className="small muted">{DISCLAIMER}</p>
      {empty ? (
        <p className="small" role="status">Todavía no hay bloques publicados del banco avanzado. Cuando se incorporen, aquí podrás exportarlos a Moodle y descargar la plantilla de registro.</p>
      ) : (
        <>
          <div className="filters">
            <Select label="Bloque" id="lms-adv-block" value={block} onChange={(v) => { setBlock(v); setMsg(''); }} options={[{ value: '', label: `Todos (${ADVANCED_BANK.length})` }, ...blocksIn(ADVANCED_BANK).map((b) => ({ value: b, label: blockName(b) }))]} />
          </div>
          <p className="lms-count" aria-live="polite"><strong>{items.length}</strong> preguntas seleccionadas</p>
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={!items.length} onClick={() => run(downloadUtf8(`${base}-moodle.xml`, toMoodleXml(items.map(advancedToExportItem)), 'application/xml'), `Se descargaron ${items.length} preguntas en Moodle XML.`)}><Icon name="descargar" size={18} />Moodle XML</button>
            <button type="button" className="btn" disabled={!items.length} onClick={() => run(downloadUtf8(`${base}-gift.txt`, toGift(items.map(advancedToExportItem)), 'text/plain'), `Se descargaron ${items.length} preguntas en GIFT.`)}><Icon name="descargar" size={18} />GIFT</button>
            <button type="button" className="btn" disabled={!items.length} onClick={() => run(downloadText(`${base}-plantilla-registro.csv`, studentTemplateCsv(items), 'text/csv'), 'Se descargó la plantilla de registro (CSV).')}><Icon name="tabla" size={18} />Plantilla de registro (CSV)</button>
          </div>
          {msg && <p className="small" role="status">{msg}</p>}
          <p className="small muted">
            En Moodle, cada opción incorrecta explica por qué lo es y qué razonamiento lleva al error, y la retroalimentación general trae la justificación, el error que conviene evitar y la estrategia. Las gráficas van como descripción textual con sus datos.
            La plantilla trae una fila por pregunta (número, bloque, competencia, nivel, tema y clave) para anotar la respuesta de cada estudiante, el acierto y la dificultad observada.
            La tabla de resultados por competencia y bloque se descarga al terminar cada simulacro en el <a href={href('banco', 'avanzado') + '?modo=simulacro'}>banco avanzado</a>.
          </p>
        </>
      )}
    </section>
  );
}

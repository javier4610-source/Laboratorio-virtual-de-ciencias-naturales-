import { useMemo, useState } from 'react';
import type { Dataset, PracticeSession, Trial } from '../core/types';
import type { SessionApi } from '../lib/session';
import { fmt } from '../lib/format';
import { downloadText, trialsToCSV, copyText } from '../lib/report';
import { Chart } from './Chart';
import { ConfirmButton, Select } from './ui';
import { onTabListKeyDown } from '../lib/a11y';

export function cellText(v: Trial['values'][string], decimals = 2): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return fmt(v, decimals);
  return v;
}

export function TrialTable({ dataset, trials, onDelete, onNote, caption }: {
  dataset: Dataset; trials: Trial[]; onDelete?: (id: string) => void; onNote?: (id: string, note: string) => void; caption?: string;
}) {
  if (trials.length === 0) {
    return <p className="muted small">Aún no has guardado ensayos en «{dataset.label}». Usa el botón «Guardar ensayo» del laboratorio.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <caption>{caption ?? dataset.label} ({trials.length} {trials.length === 1 ? 'ensayo' : 'ensayos'})</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            {dataset.columns.map((c) => <th scope="col" key={c.key} className={c.numeric ? 'n' : undefined}>{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}
            {onNote && <th scope="col">Observación</th>}
            {onDelete && <th scope="col"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {trials.map((t, i) => (
            <tr key={t.id}>
              <td className="n">{i + 1}</td>
              {dataset.columns.map((c) => <td key={c.key} className={c.numeric ? 'n' : undefined}>{cellText(t.values[c.key], c.decimals)}</td>)}
              {onNote && (
                <td style={{ minWidth: 180 }}>
                  <input type="text" aria-label={`Observación del ensayo ${i + 1}`} value={t.note ?? ''} placeholder="Escribe una observación" onChange={(e) => onNote(t.id, e.target.value)} style={{ minHeight: 34, padding: '4px 8px' }} />
                </td>
              )}
              {onDelete && (
                <td><button type="button" className="btn small ghost danger" onClick={() => onDelete(t.id)} aria-label={`Eliminar ensayo ${i + 1}`}>Eliminar</button></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tabla de registro + gráfica configurable por el estudiante (elige las variables de cada eje). */
export function DataPanel({ practiceId, datasets, api, readOnly }: { practiceId: string; datasets: Dataset[]; api?: SessionApi; readOnly?: PracticeSession }) {
  const session = api?.session ?? readOnly!;
  const [dsId, setDsId] = useState(datasets[0].id);
  const ds = datasets.find((d) => d.id === dsId) ?? datasets[0];
  const numeric = ds.columns.filter((c) => c.numeric);
  const [axes, setAxes] = useState<Record<string, { x: string; y: string; group: string }>>({});
  const ax = axes[ds.id] ?? { x: ds.defaultX, y: ds.defaultY, group: '' };
  const setAx = (patch: Partial<typeof ax>) => setAxes((a) => ({ ...a, [ds.id]: { ...ax, ...patch } }));
  const trials = session.trials.filter((t) => t.datasetId === ds.id);
  const textCols = ds.columns.filter((c) => !c.numeric);
  const [msg, setMsg] = useState('');

  const series = useMemo(() => {
    const groups = new Map<string, { x: number; y: number; label: string }[]>();
    trials.forEach((t, i) => {
      const x = t.values[ax.x], y = t.values[ax.y];
      if (typeof x !== 'number' || typeof y !== 'number') return;
      const g = ax.group ? String(t.values[ax.group] ?? '—') : 'Ensayos';
      const arr = groups.get(g) ?? [];
      arr.push({ x, y, label: `Ensayo ${i + 1}` });
      groups.set(g, arr);
    });
    return [...groups.entries()].map(([label, points]) => ({ label, points, kind: 'scatter' as const }));
  }, [trials, ax.x, ax.y, ax.group]);

  const xc = numeric.find((c) => c.key === ax.x);
  const yc = numeric.find((c) => c.key === ax.y);
  const axisLabel = (c?: { label: string; unit?: string }) => (c ? `${c.label}${c.unit ? ` (${c.unit})` : ''}` : '');

  const csv = () => trialsToCSV(practiceId, ds.id, session);

  return (
    <section className="card stack" aria-labelledby={`datos-${ds.id}`}>
      <div className="panel-title">
        <h3 id={`datos-${ds.id}`}>Datos y gráficas</h3>
        {datasets.length > 1 && (
          <div className="seg" role="tablist" aria-label="Conjunto de datos" onKeyDown={onTabListKeyDown}>
            {datasets.map((d) => (
              <button key={d.id} type="button" role="tab" aria-selected={d.id === ds.id} tabIndex={d.id === ds.id ? 0 : -1} onClick={() => setDsId(d.id)}>
                {d.label} ({session.trials.filter((t) => t.datasetId === d.id).length})
              </button>
            ))}
          </div>
        )}
      </div>
      <TrialTable
        dataset={ds} trials={trials}
        onDelete={api ? (id) => api.update((s) => ({ ...s, trials: s.trials.filter((t) => t.id !== id) })) : undefined}
        onNote={api ? (id, note) => api.update((s) => ({ ...s, trials: s.trials.map((t) => (t.id === id ? { ...t, note } : t)) })) : undefined}
      />
      <div className="filters">
        <Select label="Eje horizontal (x)" value={ax.x} onChange={(v) => setAx({ x: v })} options={numeric.map((c) => ({ value: c.key, label: axisLabel(c) }))} />
        <Select label="Eje vertical (y)" value={ax.y} onChange={(v) => setAx({ y: v })} options={numeric.map((c) => ({ value: c.key, label: axisLabel(c) }))} />
        {textCols.length > 0 && (
          <Select label="Agrupar por" value={ax.group} onChange={(v) => setAx({ group: v })} options={[{ value: '', label: 'Sin agrupar' }, ...textCols.map((c) => ({ value: c.key, label: c.label }))]} />
        )}
      </div>
      <Chart
        title={`${yc?.label ?? ''} en función de ${xc?.label ?? ''}`}
        series={series} xLabel={axisLabel(xc)} yLabel={axisLabel(yc)} fit={series.length === 1 && series[0].points.length >= 2}
        emptyText="Guarda ensayos para ver la gráfica."
      />
      {series.length > 1 && <p className="small muted">La recta de ajuste solo se calcula cuando los datos no están agrupados.</p>}
      {trials.length > 0 && (
        <div className="btn-row no-print">
          <button type="button" className="btn small" onClick={() => { const ok = downloadText(`${practiceId}-${ds.id}.csv`, csv(), 'text/csv'); setMsg(ok ? 'Archivo CSV descargado.' : 'Este entorno no permite descargas: usa «Copiar datos».'); }}>Descargar CSV</button>
          <button type="button" className="btn small" onClick={async () => setMsg((await copyText(csv())) ? 'Datos copiados: pégalos en una hoja de cálculo.' : 'No se pudo copiar automáticamente.')}>Copiar datos</button>
          {api && <ConfirmButton label="Borrar tabla" confirmLabel="¿Borrar todos los ensayos de esta tabla?" onConfirm={() => api.update((s) => ({ ...s, trials: s.trials.filter((t) => t.datasetId !== ds.id) }))} />}
          <span className="small muted" aria-live="polite">{msg}</span>
        </div>
      )}
    </section>
  );
}

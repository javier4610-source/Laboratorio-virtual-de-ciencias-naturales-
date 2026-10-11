import { useMemo, useState } from 'react';
import type { Dataset, DatasetAnalysis, PracticeSession, Trial } from '../core/types';
import type { SessionApi } from '../lib/session';
import { fmt } from '../lib/format';
import { downloadText, trialsToCSV, copyText } from '../lib/report';
import { Chart } from './Chart';
import { ConfirmButton, Select } from './ui';
import { onTabListKeyDown } from '../lib/a11y';
import { buildAnalysis, columnAxisText } from '../lib/analysis';
import { AXIS_TRANSFORMS, FIT_MODELS } from '../lib/fit';

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
    <div className="table-wrap" tabIndex={0} role="region" aria-label={`Tabla de ensayos: ${dataset.label}`}>
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
            <tr key={t.id} className={Date.now() - t.createdAt < 4000 ? 'fresh' : undefined}>
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

/** Tabla de registro + gráfica configurable por el estudiante (ejes, linealización y modelo de ajuste). */
export function DataPanel({ practiceId, datasets, api, readOnly }: { practiceId: string; datasets: Dataset[]; api?: SessionApi; readOnly?: PracticeSession }) {
  const session = api?.session ?? readOnly!;
  const [dsId, setDsId] = useState(datasets[0].id);
  const ds = datasets.find((d) => d.id === dsId) ?? datasets[0];
  const numeric = ds.columns.filter((c) => c.numeric);
  // La elección se guarda en la sesión (así llega al informe); en modo de solo lectura queda local.
  const [local, setLocal] = useState<Record<string, DatasetAnalysis>>({});
  const stored = local[ds.id] ?? session.analysis?.[ds.id];
  const allTrials = session.trials;
  const trials = useMemo(() => allTrials.filter((t) => t.datasetId === ds.id), [allTrials, ds.id]);
  const data = useMemo(() => buildAnalysis(ds, trials, stored), [ds, trials, stored]);
  const ax = data.ax;
  const setAx = (patch: Partial<DatasetAnalysis>) => {
    const next: DatasetAnalysis = { ...ax, ...patch };
    setLocal((a) => ({ ...a, [ds.id]: next }));
    api?.update((s) => ({ ...s, analysis: { ...(s.analysis ?? {}), [ds.id]: next } }));
  };
  const textCols = ds.columns.filter((c) => !c.numeric);
  const [msg, setMsg] = useState('');
  const series = useMemo(() => data.series.map((s) => ({ ...s, kind: 'scatter' as const })), [data]);
  const transformOptions = (c?: { label: string }) =>
    AXIS_TRANSFORMS.map((t) => ({ value: t.value, label: t.value === 'x' ? `Sin transformar (${c?.label ?? ''})` : t.label(c?.label ?? '') }));

  const csv = () => trialsToCSV(practiceId, ds.id, session);

  return (
    <section className="card stack notebook" id="cuaderno" tabIndex={-1} aria-labelledby={`datos-${ds.id}`}>
      <div className="panel-title">
        <h3 id={`datos-${ds.id}`}>Cuaderno de laboratorio: datos y gráficas</h3>
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
      <div className="notebook-grid">
      <div className="notebook-table">
      <TrialTable
        dataset={ds} trials={trials}
        onDelete={api ? (id) => api.update((s) => ({ ...s, trials: s.trials.filter((t) => t.id !== id) })) : undefined}
        onNote={api ? (id, note) => api.update((s) => ({ ...s, trials: s.trials.map((t) => (t.id === id ? { ...t, note } : t)) })) : undefined}
      />
      </div>
      <div className="notebook-chart stack-sm">
      <div className="filters">
        <Select label="Eje horizontal (x)" value={ax.x} onChange={(v) => setAx({ x: v })} options={numeric.map((c) => ({ value: c.key, label: columnAxisText(c) }))} />
        <Select label="Eje vertical (y)" value={ax.y} onChange={(v) => setAx({ y: v })} options={numeric.map((c) => ({ value: c.key, label: columnAxisText(c) }))} />
        {textCols.length > 0 && (
          <Select label="Agrupar por" value={ax.group} onChange={(v) => setAx({ group: v })} options={[{ value: '', label: 'Sin agrupar' }, ...textCols.map((c) => ({ value: c.key, label: c.label }))]} />
        )}
        <Select label="Modelo de ajuste" value={ax.model} onChange={(v) => setAx({ model: v })} options={FIT_MODELS.map((m) => ({ value: m.value, label: m.label }))} />
      </div>
      <details className="analysis-options" open={ax.xT !== 'x' || ax.yT !== 'x' || undefined}>
        <summary>Linealizar: transformar los ejes</summary>
        <div className="filters">
          <Select label="Transformar eje x" value={ax.xT} onChange={(v) => setAx({ xT: v })} options={transformOptions(data.xc)} />
          <Select label="Transformar eje y" value={ax.yT} onChange={(v) => setAx({ yT: v })} options={transformOptions(data.yc)} />
        </div>
        <p className="small muted">Si una curva se vuelve recta al transformar un eje (por ejemplo, P contra 1/V), la relación entre las variables originales queda identificada.</p>
      </details>
      {data.dropped > 0 && <p className="small fit-error">{data.dropped} {data.dropped === 1 ? 'punto no se grafica' : 'puntos no se grafican'}: la transformación elegida no está definida para {data.dropped === 1 ? 'ese valor' : 'esos valores'} (por ejemplo, ln de 0 o 1/0).</p>}
      <Chart
        title={`${data.yAxis.label} en función de ${data.xAxis.label}`}
        series={series} xLabel={data.xAxis.text} yLabel={data.yAxis.text} xUnit={data.xAxis.unit} yUnit={data.yAxis.unit}
        fit={series.length === 1 && ax.model !== 'none' ? ax.model : undefined}
        emptyText="Guarda ensayos para ver la gráfica."
        exportName={`${practiceId}-${ds.id}-grafica`} copyFallbackLabel={trials.length > 0 ? 'Copiar datos' : undefined}
      />
      {series.length > 1 && ax.model !== 'none' && <p className="small muted">El ajuste solo se calcula cuando los datos no están agrupados.</p>}
      </div>
      </div>
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

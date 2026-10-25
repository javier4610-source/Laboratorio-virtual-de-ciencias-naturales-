import { useMemo, useState, type ReactNode } from 'react';
import type { Dataset, DatasetAnalysis, PracticeSession, Trial } from '../core/types';
import type { SessionApi } from '../lib/session';
import { fmt } from '../lib/format';
import { downloadText, trialsToCSV, copyText } from '../lib/report';
import { Chart } from './Chart';
import { ConfirmButton, Segmented, Select } from './ui';
import { RepeatStats, UncertaintyCalculator } from './RepeatStats';
import { Icon, type IconName } from './icons';
import { onTabListKeyDown } from '../lib/a11y';
import { buildAnalysis, columnAxisText } from '../lib/analysis';
import { AXIS_TRANSFORMS, FIT_MODELS, applyTransform, inverseTransform } from '../lib/fit';
import { useAdvanced } from './Advanced';
import { CURVE_MODELS, fixedInputsText, modelCurve } from '../labs/modelCurves';
import { modifiedSummary } from '../lib/advanced';
import type { ModelCurveProp } from './Chart';
import { StatusChip } from './Provenance';
import { flag } from '../lib/flags';
import { changedInputs, compareTrials, trialsToJSON } from '../lib/compare';
import { metaById } from '../curriculum/catalog';

export function cellText(v: Trial['values'][string], decimals = 2): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return fmt(v, decimals);
  return v;
}

const trialsText = (n: number) => `${n} ${n === 1 ? 'ensayo' : 'ensayos'}`;

/**
 * Tabla de ensayos con aspecto de hoja de cálculo científica: encabezado fijo en dos líneas
 * (magnitud / unidad), números tabulares a la derecha, textos largos en una línea (el texto
 * completo queda en el DOM para lectores de pantalla y en el `title`), columna # fija y
 * desplazamiento propio en ambos ejes.
 */
export function TrialTable({ dataset, trials, onDelete, onNote, caption }: {
  dataset: Dataset; trials: Trial[]; onDelete?: (id: string) => void; onNote?: (id: string, note: string) => void; caption?: string;
}) {
  if (trials.length === 0) {
    return <p className="muted small">Aún no has guardado ensayos en «{dataset.label}». Usa el botón «Guardar ensayo» del laboratorio.</p>;
  }
  const now = Date.now();
  return (
    <div className="sheet-wrap" tabIndex={0} role="region" aria-label={`Tabla de ensayos: ${dataset.label}`}>
      <table className="sheet">
        <caption className="sr-only">{caption ?? dataset.label} ({trialsText(trials.length)})</caption>
        <thead>
          <tr>
            <th scope="col" className="col-idx">#</th>
            {dataset.columns.map((c) => (
              <th scope="col" key={c.key} className={c.numeric ? 'n' : undefined} title={`${c.label}${c.unit ? ` (${c.unit})` : ''}`}>
                <span className="col-name">{c.label}</span>
                <span className="col-unit">{c.unit ? <><span className="sr-only"> (</span>{c.unit}<span className="sr-only">)</span></> : <span aria-hidden="true">&nbsp;</span>}</span>
              </th>
            ))}
            {onNote && <th scope="col" className="col-note"><span className="col-name">Observación</span><span className="col-unit" aria-hidden="true">&nbsp;</span></th>}
            {onDelete && <th scope="col" className="col-act"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {trials.map((t, i) => (
            <tr key={t.id} className={now - t.createdAt < 4000 ? 'fresh' : undefined}>
              <td className="n col-idx">{i + 1}</td>
              {dataset.columns.map((c) => {
                const text = cellText(t.values[c.key], c.decimals);
                return c.numeric
                  ? <td key={c.key} className="n">{text}</td>
                  : <td key={c.key} className="t"><span className="trunc" title={text}>{text}</span></td>;
              })}
              {onNote && (
                <td className="col-note">
                  <input type="text" className="cell-input" aria-label={`Observación del ensayo ${i + 1}`} value={t.note ?? ''} placeholder="Escribe una observación" onChange={(e) => onNote(t.id, e.target.value)} />
                </td>
              )}
              {onDelete && (
                <td className="col-act">
                  <button type="button" className="icon-btn danger tip tip-left" data-tip="Eliminar ensayo" onClick={() => onDelete(t.id)} aria-label={`Eliminar ensayo ${i + 1}`}>
                    <Icon name="papelera" size={17} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHead({ icon, title, children, id }: { icon: IconName; title: string; children?: ReactNode; id?: string }) {
  return (
    <div className="nb-section-head">
      <h4 id={id}><Icon name={icon} size={18} />{title}</h4>
      {children}
    </div>
  );
}

function ConfigGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="nb-group">
      <legend>{title}</legend>
      <div className="nb-group-body">{children}</div>
    </fieldset>
  );
}

/** Estado vacío del cuaderno: explica qué aparecerá y cómo empezar. */
function EmptyNotebook({ dataset }: { dataset: Dataset }) {
  return (
    <div className="nb-empty">
      <svg className="nb-empty-art" viewBox="0 0 200 120" aria-hidden="true" focusable="false">
        <rect x="8" y="10" width="86" height="100" rx="8" className="e-paper" />
        <path d="M8 30h86M8 50h86M8 70h86M8 90h86M30 10v100" className="e-line" />
        <rect x="14" y="16" width="10" height="8" rx="2" className="e-head" /><rect x="36" y="16" width="50" height="8" rx="2" className="e-head" />
        <rect x="106" y="10" width="86" height="100" rx="8" className="e-paper" />
        <path d="M118 22v76h66" className="e-axis" />
        <path d="M122 92 180 32" className="e-fit" />
        <circle cx="132" cy="82" r="3.6" className="e-dot" /><circle cx="146" cy="68" r="3.6" className="e-dot" /><circle cx="160" cy="55" r="3.6" className="e-dot" /><circle cx="173" cy="40" r="3.6" className="e-dot" />
      </svg>
      <div className="nb-empty-text">
        <p className="nb-empty-title">Tu cuaderno está listo para recibir datos</p>
        <p className="muted">Aún no has guardado ensayos en «{dataset.label}». Usa el botón «Guardar ensayo» del laboratorio.</p>
        <p className="muted">Guarda ensayos para ver la gráfica.</p>
        <ol className="nb-empty-steps small">
          <li><span>1</span>Elige las condiciones en los controles del laboratorio.</li>
          <li><span>2</span>Realiza la medición y lee el resultado.</li>
          <li><span>3</span>Pulsa «Guardar ensayo en la tabla»: la fila, la gráfica y el ajuste aparecen aquí.</li>
        </ol>
      </div>
    </div>
  );
}

/** Comparación de dos ensayos: valores lado a lado, diferencia B − A y variación relativa. */
function TrialCompare({ dataset: ds, trials }: { dataset: Dataset; trials: Trial[] }) {
  const [ia, setIa] = useState(0);
  const [ib, setIb] = useState(1);
  if (trials.length < 2) return null;
  const a = trials[Math.min(ia, trials.length - 1)];
  const b = trials[Math.min(ib, trials.length - 1)];
  const rows = compareTrials(ds, a, b);
  const changed = changedInputs(rows);
  const options = trials.map((t, i) => ({ value: String(i), label: `Ensayo ${i + 1}${t.note ? ` · ${t.note.slice(0, 30)}` : ''}` }));
  const unit = (u?: string) => (u ? ` ${u}` : '');
  return (
    <details className="nb-panel trial-compare">
      <summary>
        <span className="nb-panel-icon" aria-hidden="true"><Icon name="comparar" size={18} /></span>
        <span className="nb-panel-title">Comparar ensayos<span className="nb-panel-sub">Dos ensayos lado a lado: diferencia y variación relativa</span></span>
        <span className="nb-pill">{trials.length} ensayos</span>
      </summary>
      <div className="compare-pick">
        <Select label="Ensayo A (referencia)" value={String(Math.min(ia, trials.length - 1))} onChange={(v) => setIa(Number(v))} options={options} />
        <Select label="Ensayo B" value={String(Math.min(ib, trials.length - 1))} onChange={(v) => setIb(Number(v))} options={options} />
      </div>
      {a === b ? <p className="small muted" style={{ margin: 0 }}>Elige dos ensayos distintos.</p> : (
        <>
          <p className="small" style={{ margin: 0 }} aria-live="polite">
            {changed.length === 0
              ? 'Las variables de entrada son iguales en los dos ensayos: es una repetición; las diferencias en las medidas muestran la dispersión.'
              : changed.length === 1
                ? `Solo cambió ${changed[0].label.toLowerCase()}: las diferencias en las medidas se pueden atribuir a esa variable.`
                : `Cambiaron ${changed.length} variables de entrada (${changed.map((r) => r.label.toLowerCase()).join(', ')}): no se puede atribuir el efecto a una sola.`}
          </p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Comparación de ensayos">
            <table className="compare-table">
              <caption className="sr-only">Ensayo {trials.indexOf(a) + 1} frente al ensayo {trials.indexOf(b) + 1}</caption>
              <thead>
                <tr><th scope="col">Magnitud</th><th scope="col" className="n">A · ensayo {trials.indexOf(a) + 1}</th><th scope="col" className="n">B · ensayo {trials.indexOf(b) + 1}</th><th scope="col" className="n">B − A</th><th scope="col" className="n">Variación</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = ds.columns.find((x) => x.key === r.key)!;
                  return (
                    <tr key={r.key} className={r.same ? 'same' : 'changed'}>
                      <th scope="row">{r.label}{r.unit ? <span className="muted"> ({r.unit})</span> : null}{r.input && <span className="chip tiny">entrada</span>}</th>
                      <td className="n">{cellText(r.a, c.decimals)}</td>
                      <td className="n">{cellText(r.b, c.decimals)}</td>
                      <td className="n">{r.diff === null ? (r.same ? 'igual' : 'distinto') : `${r.diff > 0 ? '+' : r.diff < 0 ? '−' : ''}${fmt(Math.abs(r.diff), c.decimals ?? 2)}${unit(r.unit)}`}</td>
                      <td className="n">{r.relPercent === null ? '—' : `${r.relPercent > 0 ? '+' : r.relPercent < 0 ? '−' : ''}${fmt(Math.abs(r.relPercent), 1)} %`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
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

  // Curva del modelo (modo avanzado): condiciones fijas tomadas del último ensayo del conjunto.
  const adv = useAdvanced();
  const curveModel = adv.enabled && adv.practiceId === practiceId ? CURVE_MODELS[practiceId]?.[ds.id] : undefined;
  const [overlay, setOverlay] = useState(false);
  const last = trials[trials.length - 1];
  const curve = useMemo<ModelCurveProp | null | undefined>(() => {
    if (!curveModel || !overlay || !last) return undefined;
    const f = modelCurve(practiceId, ds.id, ax.x, ax.y, last.values, adv.active);
    if (!f) return null;
    const labels = Object.fromEntries(ds.columns.map((c) => [c.key, { label: c.label, unit: c.unit }]));
    const fixed = fixedInputsText(practiceId, ds.id, ax.x, last.values, labels);
    const mod = modifiedSummary(adv.specs, adv.values);
    return {
      label: curveModel.name,
      predict: (X: number) => applyTransform(ax.yT, f(inverseTransform(ax.xT, X))),
      note: `${curveModel.description}${fixed ? ` Condiciones fijas (último ensayo): ${fixed}.` : ''}${mod ? ` ${mod}.` : ''}`,
    };
  }, [curveModel, overlay, last, practiceId, ds, ax.x, ax.y, ax.xT, ax.yT, adv.active, adv.specs, adv.values]);

  const csv = () => trialsToCSV(practiceId, ds.id, session);
  const headId = `datos-${ds.id}`;
  const has = trials.length > 0;

  return (
    <section className="card notebook" id="cuaderno" tabIndex={-1} aria-labelledby={headId}>
      <header className="nb-head">
        <div className="nb-title">
          <span className="nb-badge" aria-hidden="true"><Icon name="analisis" size={22} /></span>
          <div className="nb-title-text">
            <h3 id={headId}>Cuaderno de laboratorio: datos y gráficas</h3>
            <p className="nb-meta">
              <span className={`nb-count${has ? ' has' : ''}`}>{trialsText(trials.length)}</span>
              <span className="nb-ds" title={ds.label}><Icon name="datos" size={15} />{ds.label}</span>
              {flag('procedencia') && <StatusChip status="modelo" prefix="Datos" />}
            </p>
          </div>
        </div>
        {has && (
          <div className="nb-actions no-print" role="group" aria-label="Acciones del cuaderno">
            <button type="button" className="btn small" onClick={() => { const ok = downloadText(`${practiceId}-${ds.id}.csv`, csv(), 'text/csv'); setMsg(ok ? 'Archivo CSV descargado.' : 'Este entorno no permite descargas: usa «Copiar datos».'); }}>
              <Icon name="descargar" size={17} />Descargar CSV
            </button>
            <button type="button" className="btn small" onClick={() => { const ok = downloadText(`${practiceId}-${ds.id}.json`, trialsToJSON(practiceId, metaById(practiceId)?.title ?? practiceId, ds, trials, __APP_VERSION__), 'application/json'); setMsg(ok ? 'Archivo JSON descargado (formato lvcn-datos-v1).' : 'Este entorno no permite descargas: usa «Copiar datos».'); }}>
              <Icon name="datos" size={17} />Descargar JSON
            </button>
            <button type="button" className="btn small" onClick={async () => setMsg((await copyText(csv())) ? 'Datos copiados: pégalos en una hoja de cálculo.' : 'No se pudo copiar automáticamente.')}>
              <Icon name="copiar" size={17} />Copiar datos
            </button>
            {api && <ConfirmButton label="Borrar tabla" icon={<Icon name="papelera" size={17} />} confirmLabel="¿Borrar todos los ensayos de esta tabla?" onConfirm={() => api.update((s) => ({ ...s, trials: s.trials.filter((t) => t.datasetId !== ds.id) }))} />}
          </div>
        )}
      </header>
      {datasets.length > 1 && (
        <div className="seg nb-datasets" role="tablist" aria-label="Conjunto de datos" onKeyDown={onTabListKeyDown}>
          {datasets.map((d) => (
            <button key={d.id} type="button" role="tab" aria-selected={d.id === ds.id} tabIndex={d.id === ds.id ? 0 : -1} onClick={() => setDsId(d.id)}>
              {d.label} ({session.trials.filter((t) => t.datasetId === d.id).length})
            </button>
          ))}
        </div>
      )}
      <p className="small nb-status" aria-live="polite">{msg}</p>

      {!has ? <EmptyNotebook dataset={ds} /> : (
        <>
          <div className="nb-section">
            <SectionHead icon="tabla" title="Datos">
              <span className="small muted">Cada fila es un ensayo guardado. Desliza la tabla para ver todas las columnas.</span>
            </SectionHead>
            <TrialTable
              dataset={ds} trials={trials}
              onDelete={api ? (id) => api.update((s) => ({ ...s, trials: s.trials.filter((t) => t.id !== id) })) : undefined}
              onNote={api ? (id, note) => api.update((s) => ({ ...s, trials: s.trials.map((t) => (t.id === id ? { ...t, note } : t)) })) : undefined}
            />
          </div>

          <div className="nb-section">
            <SectionHead icon="grafica" title="Gráfica y ajuste" />
            <div className="nb-workbench">
              <div className="nb-config no-print">
                <p className="nb-config-title"><Icon name="ajustes" size={16} />Configuración</p>
                <ConfigGroup title="Ejes">
                  <Select label="Eje horizontal (x)" value={ax.x} onChange={(v) => setAx({ x: v })} options={numeric.map((c) => ({ value: c.key, label: columnAxisText(c) }))} />
                  <Select label="Eje vertical (y)" value={ax.y} onChange={(v) => setAx({ y: v })} options={numeric.map((c) => ({ value: c.key, label: columnAxisText(c) }))} />
                </ConfigGroup>
                {textCols.length > 0 && (
                  <ConfigGroup title="Agrupar">
                    <Select label="Agrupar por" value={ax.group} onChange={(v) => setAx({ group: v })} options={[{ value: '', label: 'Sin agrupar' }, ...textCols.map((c) => ({ value: c.key, label: c.label }))]} />
                  </ConfigGroup>
                )}
                <ConfigGroup title="Ajuste">
                  <Select label="Modelo de ajuste" value={ax.model} onChange={(v) => setAx({ model: v })} options={FIT_MODELS.map((m) => ({ value: m.value, label: m.label }))} />
                  {series.length > 1 && ax.model !== 'none' && <p className="small muted nb-hint">El ajuste solo se calcula cuando los datos no están agrupados.</p>}
                </ConfigGroup>
                {curveModel && (
                  <ConfigGroup title="Modelo (modo avanzado)">
                    <label className="check"><input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> Superponer la curva del modelo</label>
                    {overlay && curve === null && <p className="small nb-hint fit-error" role="status">El modelo no calcula «{data.yc?.label}» en función de «{data.xc?.label}». Elige en los ejes una variable de entrada y una medida que el modelo relacione.</p>}
                    {overlay && curve && <p className="small muted nb-hint">La curva usa el modelo ideal ({curveModel.name}) con las demás variables del último ensayo; los residuos muestran cuánto se apartan tus datos del modelo.</p>}
                  </ConfigGroup>
                )}
                <ConfigGroup title="Linealizar: transformar los ejes">
                  <Select label="Transformar eje x" value={ax.xT} onChange={(v) => setAx({ xT: v })} options={transformOptions(data.xc)} />
                  <Select label="Transformar eje y" value={ax.yT} onChange={(v) => setAx({ yT: v })} options={transformOptions(data.yc)} />
                  <p className="small muted nb-hint">Si una curva se vuelve recta al transformar un eje (por ejemplo, P contra 1/V), la relación entre las variables originales queda identificada.</p>
                </ConfigGroup>
                <ConfigGroup title="Barras de error">
                  <label className="check"><input type="checkbox" checked={ax.avg !== ''} onChange={(e) => setAx({ avg: e.target.checked ? 'sd' : '' })} /> Graficar promedios con barras de error (±1 DE o ±EE)</label>
                  {ax.avg !== '' && (
                    <Segmented<'sd' | 'sem'> label="Barras de error" value={ax.avg} onChange={(v) => setAx({ avg: v })}
                      options={[{ value: 'sd', label: '±1 DE' }, { value: 'sem', label: '±EE' }]} />
                  )}
                  {ax.avg !== '' && <p className="small muted nb-hint">Cada punto es la media de los ensayos con las mismas variables de entrada; la barra muestra {ax.avg === 'sd' ? '±1 desviación estándar (dispersión de las lecturas)' : '±1 error estándar de la media (DE/√n)'}. Con un solo ensayo, la barra es ± media resolución.</p>}
                </ConfigGroup>
              </div>
              <div className="nb-chart-pane">
                {data.dropped > 0 && <p className="small fit-error">{data.dropped} {data.dropped === 1 ? 'punto no se grafica' : 'puntos no se grafican'}: la transformación elegida no está definida para {data.dropped === 1 ? 'ese valor' : 'esos valores'} (por ejemplo, ln de 0 o 1/0).</p>}
                <Chart
                  showTitle height={380}
                  title={`${data.yAxis.label} en función de ${data.xAxis.label}`}
                  series={series} xLabel={data.xAxis.text} yLabel={data.yAxis.text} xUnit={data.xAxis.unit} yUnit={data.yAxis.unit}
                  fit={series.length === 1 && ax.model !== 'none' ? ax.model : undefined}
                  emptyText="Guarda ensayos para ver la gráfica."
                  errorNote={ax.avg === 'sd' ? 'Las barras indican ±1 desviación estándar de los ensayos repetidos.' : ax.avg === 'sem' ? 'Las barras indican ±1 error estándar de la media.' : undefined}
                  exportName={`${practiceId}-${ds.id}-grafica`} copyFallbackLabel="Copiar datos"
                  modelCurve={curve ?? undefined}
                />
              </div>
            </div>
          </div>

          <div className="nb-analysis">
            <TrialCompare key={ds.id} dataset={ds} trials={trials} />
            <RepeatStats dataset={ds} trials={trials} />
            <UncertaintyCalculator key={ds.id} dataset={ds} trials={trials} />
          </div>
        </>
      )}
    </section>
  );
}

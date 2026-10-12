import { useMemo, useState } from 'react';
import type { Column, Dataset, Trial } from '../core/types';
import { groupTrials, measuredColumns, type RepeatGroup } from '../lib/analysis';
import { propagate, standardUncertainty, type Operation } from '../lib/measurement';
import { formatWithUncertainty } from '../lib/fit';
import { fmt } from '../lib/format';
import { Select } from './ui';

const unitText = (c: Column) => (c.unit ? ` (${c.unit})` : '');
const statText = (v: number, c: Column) => fmt(v, (c.decimals ?? 2) + 1);

/**
 * Estadística de ensayos repetidos: agrupa automáticamente los ensayos con las mismas variables de
 * entrada y muestra, para cada columna medida, n, media, desviación estándar (DE) y error estándar (EE).
 */
export function RepeatStats({ dataset: ds, trials }: { dataset: Dataset; trials: Trial[] }) {
  const groups = useMemo(() => groupTrials(ds, trials), [ds, trials]);
  const measured = measuredColumns(ds);
  const repeated = groups.filter((g) => g.trials.length >= 2);
  if (trials.length === 0 || measured.length === 0) return null;
  return (
    <details className="analysis-options repeat-stats" open={repeated.length > 0 || undefined}>
      <summary>Ensayos repetidos: media y desviación estándar ({repeated.length} {repeated.length === 1 ? 'condición repetida' : 'condiciones repetidas'})</summary>
      <p className="small muted" style={{ margin: 0 }}>
        Se agrupan los ensayos con las mismas variables de entrada. DE: desviación estándar muestral (n − 1), mide la dispersión de las lecturas. EE = DE/√n: error estándar de la media.
      </p>
      {repeated.length === 0 && <p className="small" style={{ margin: 0 }}>Aún no hay mediciones repetidas. Repite la misma medición (mismas condiciones) al menos dos veces para ver su dispersión.</p>}
      {repeated.map((g) => (
        <div key={g.key} className="repeat-group">
          <h4>{g.label} <span className="muted small">(n = {g.trials.length})</span></h4>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={`Estadística: ${g.label}`}>
            <table>
              <caption className="sr-only">Estadística de {g.trials.length} ensayos repetidos: {g.label}</caption>
              <thead>
                <tr><th scope="col">Magnitud medida</th><th scope="col" className="n">n</th><th scope="col" className="n">Media</th><th scope="col" className="n">DE</th><th scope="col" className="n">EE</th></tr>
              </thead>
              <tbody>
                {measured.map((c) => {
                  const s = g.stats[c.key];
                  return (
                    <tr key={c.key}>
                      <th scope="row">{c.label}{unitText(c)}</th>
                      <td className="n">{s.n}</td>
                      <td className="n">{statText(s.mean, c)}</td>
                      <td className="n">{statText(s.sd, c)}</td>
                      <td className="n">{statText(s.sem, c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {groups.length > repeated.length && <p className="small muted" style={{ margin: 0 }}>{groups.length - repeated.length} {groups.length - repeated.length === 1 ? 'condición tiene' : 'condiciones tienen'} un solo ensayo (sin dispersión que calcular).</p>}
    </details>
  );
}

const OPS: { value: Operation; label: string }[] = [{ value: 'divide', label: 'A ÷ B (cociente)' }, { value: 'multiply', label: 'A × B (producto)' }];

function quantity(g: RepeatGroup, c: Column) {
  const s = g.stats[c.key];
  return { value: s.mean, u: standardUncertainty(s, c.resolution), n: s.n };
}

/** Calculadora de propagación de incertidumbre para un cociente o un producto de dos columnas (p. ej. densidad = m/V). */
export function UncertaintyCalculator({ dataset: ds, trials }: { dataset: Dataset; trials: Trial[] }) {
  const numeric = ds.columns.filter((c) => c.numeric);
  const groups = useMemo(() => groupTrials(ds, trials), [ds, trials]);
  const [aKey, setA] = useState(ds.defaultY);
  const [bKey, setB] = useState(ds.defaultX);
  const [op, setOp] = useState<Operation>('divide');
  const largest = groups.reduce<RepeatGroup | undefined>((best, g) => (!best || g.trials.length > best.trials.length ? g : best), undefined);
  const [gKey, setG] = useState('');
  if (trials.length === 0 || numeric.length < 2 || !largest) return null;
  const a = numeric.find((c) => c.key === aKey) ?? numeric[0];
  const b = numeric.find((c) => c.key === bKey) ?? numeric[1];
  const g = groups.find((x) => x.key === gKey) ?? largest;
  const qa = quantity(g, a), qb = quantity(g, b);
  const r = propagate(op, qa, qb);
  const unit = a.unit || b.unit ? (op === 'divide' ? `${a.unit ?? '1'}/${b.unit ?? '1'}` : `${a.unit ?? ''}·${b.unit ?? ''}`) : '';
  const sym = op === 'divide' ? '÷' : '×';
  const line = (c: Column, q: { value: number; u: number; n: number }) =>
    `${c.label}: ${q.u > 0 ? formatWithUncertainty(q.value, q.u) : fmt(q.value, (c.decimals ?? 2) + 1)}${c.unit ? ` ${c.unit}` : ''} (n = ${q.n})`;
  return (
    <details className="analysis-options prop-calc">
      <summary>Propagación de incertidumbre: cociente o producto</summary>
      <div className="filters">
        <Select label="Magnitud A" value={a.key} onChange={setA} options={numeric.map((c) => ({ value: c.key, label: `${c.label}${unitText(c)}` }))} />
        <Select label="Operación" value={op} onChange={(v) => setOp(v as Operation)} options={OPS} />
        <Select label="Magnitud B" value={b.key} onChange={setB} options={numeric.map((c) => ({ value: c.key, label: `${c.label}${unitText(c)}` }))} />
      </div>
      <Select label="Ensayos (condición)" value={g.key} onChange={setG} options={groups.map((x) => ({ value: x.key, label: `${x.label} (n = ${x.trials.length})` }))} />
      <ul className="list small num" style={{ margin: 0 }}>
        <li>{line(a, qa)}</li>
        <li>{line(b, qb)}</li>
      </ul>
      <p className="prop-result num" aria-live="polite">
        A {sym} B = {Number.isFinite(r.u) && r.u > 0 ? formatWithUncertainty(r.value, r.u) : fmt(r.value, 3)}{unit ? ` ${unit}` : ''}
        {Number.isFinite(r.rel) && <> · incertidumbre relativa {fmt(r.rel * 100, 2)} %</>}
      </p>
      <p className="small muted" style={{ margin: 0 }}>
        Incertidumbre de cada magnitud: u = √(EE² + (resolución/√12)²), con el EE de los ensayos repetidos de la condición elegida.
        Para un cociente o un producto, las incertidumbres relativas se suman en cuadratura: u_q/|q| = √((u_A/A)² + (u_B/B)²).
      </p>
    </details>
  );
}

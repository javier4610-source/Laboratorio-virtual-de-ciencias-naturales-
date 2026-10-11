import { useMemo, useState } from 'react';
import { checkBalance, findReaction, REACTIONS, simulateStoichiometry, STOICH_LIMITS } from '../models/stoichiometry';
import { prettyFormula } from '../models/chemistry';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

function Balancer() {
  const [rid, setRid] = useState('metano');
  const reaction = findReaction(rid);
  const [coefs, setCoefs] = useState<Record<string, number[]>>({});
  const cur = coefs[rid] ?? [...reaction.reactants, ...reaction.products].map(() => 1);
  const nR = reaction.reactants.length;
  const check = checkBalance(reaction, cur.slice(0, nR), cur.slice(nR));
  const set = (i: number, v: number) => setCoefs((c) => ({ ...c, [rid]: cur.map((x, j) => (j === i ? v : x)) }));
  const species = [...reaction.reactants, ...reaction.products];
  return (
    <div className="card stack">
      <h3>Verificador de balanceo</h3>
      <Select label="Ecuación" value={rid} onChange={setRid} options={REACTIONS.map((r) => ({ value: r.id, label: r.name }))} />
      <div className="btn-row" style={{ alignItems: 'center' }}>
        {species.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {i === nR && <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>→</span>}
            {i > 0 && i !== nR && <span aria-hidden="true">+</span>}
            <input type="number" min={1} max={20} value={cur[i]} aria-label={`Coeficiente de ${s.name}`} onChange={(e) => set(i, Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))))} style={{ width: 64, minHeight: 36 }} />
            <span className="mono">{prettyFormula(s.formula)}</span>
          </span>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <caption>Conteo de átomos</caption>
          <thead><tr><th>Elemento</th><th className="n">Reactivos</th><th className="n">Productos</th><th>¿Igual?</th></tr></thead>
          <tbody>{check.rows.map((r) => <tr key={r.element}><td>{r.element}</td><td className="n">{r.left}</td><td className="n">{r.right}</td><td>{r.left === r.right ? '✓' : '✗'}</td></tr>)}</tbody>
        </table>
      </div>
      <p role="status" className={`notice ${check.balanced ? 'ok' : 'warn'}`}>{check.balanced ? '¡Ecuación balanceada! Se conservan todos los átomos.' : 'Aún no está balanceada: ajusta los coeficientes hasta que cada elemento tenga el mismo número de átomos a ambos lados.'}</p>
    </div>
  );
}

export default function StoichLab({ api }: LabProps) {
  const [rid, setRid] = useState('bicarbonato-vinagre');
  const [massA, setMassA] = useState(10);
  const [massB, setMassB] = useState(10);
  const [yieldP, setYieldP] = useState(100);
  const res = useMemo(() => simulateStoichiometry({ reactionId: rid, massA, massB, yieldPercent: yieldP }), [rid, massA, massB, yieldP]);
  const rx = res.reaction;
  const [A, B] = rx.reactants;
  const main = rx.products.reduce((best, p, i) => (rx.products[best].formula === 'H2O' && p.formula !== 'H2O' ? i : best), 0);
  const eq = `${rx.reactants.map((s) => `${s.coef > 1 ? s.coef + ' ' : ''}${prettyFormula(s.formula)}`).join(' + ')} → ${rx.products.map((s) => `${s.coef > 1 ? s.coef + ' ' : ''}${prettyFormula(s.formula)}`).join(' + ')}`;
  const limitingText = res.limiting === null ? 'Proporción exacta (ninguno sobra)' : `${prettyFormula(rx.reactants[res.limiting].formula)} (${rx.reactants[res.limiting].name})`;

  const record = () => api.addTrial('ensayos', {
    reaccion: rx.name, masaA: massA, masaB: massB, limitante: res.limiting === null ? 'ninguno' : prettyFormula(rx.reactants[res.limiting].formula),
    producto: Number(res.theoreticalProducts[main].toFixed(4)), real: Number(res.actualProducts[main].toFixed(4)),
    exceso: Number((res.excess[0] + res.excess[1]).toFixed(4)),
  });

  const maxBar = Math.max(res.massBefore, 1);
  const bar = (m: number) => `${(m / maxBar) * 100}%`;

  return (
    <div className="stack">
      <div className="lab-layout">
        <div className="stack">
          <div className="card stack">
            <div className="panel-title"><h3 className="mono" style={{ fontFamily: 'var(--font-data)' }}>{eq}</h3></div>
            <p className="small muted">{rx.context}</p>
            <div className="stack-sm" aria-label="Balance de masas antes y después de la reacción">
              <div className="small"><strong>Antes:</strong> {fmt(res.massBefore, 2)} g</div>
              <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <div style={{ width: bar(massA), background: 'var(--series-2)' }} title={`${A.name}: ${fmt(massA, 2)} g`} />
                <div style={{ width: bar(massB), background: 'var(--series-4)' }} title={`${B.name}: ${fmt(massB, 2)} g`} />
              </div>
              <div className="small"><strong>Después (rendimiento 100 %):</strong> {fmt(res.massAfterTheoretical, 2)} g</div>
              <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
                {res.theoreticalProducts.map((m, i) => <div key={i} style={{ width: bar(m), background: `var(--series-${(i % 2) + 1})`, opacity: 0.6 + 0.2 * i }} title={`${rx.products[i].name}: ${fmt(m, 2)} g`} />)}
                {res.excess.map((m, i) => (m > 1e-9 ? <div key={`e${i}`} style={{ width: bar(m), background: 'var(--line)' }} title={`Sobrante de ${rx.reactants[i].name}: ${fmt(m, 2)} g`} /> : null))}
              </div>
              <p className="small muted">La masa total antes y después es la misma: los átomos solo se reorganizan.</p>
            </div>
          </div>
          <Readout items={[
            { k: `n ${prettyFormula(A.formula)}`, v: `${fmt(res.molesA, 4)} mol` },
            { k: `n ${prettyFormula(B.formula)}`, v: `${fmt(res.molesB, 4)} mol` },
            { k: `n/ν ${prettyFormula(A.formula)}`, v: fmt(res.molesA / A.coef, 4) },
            { k: `n/ν ${prettyFormula(B.formula)}`, v: fmt(res.molesB / B.coef, 4) },
            { k: 'Reactivo limitante', v: limitingText, data: true },
            { k: 'Avance de reacción ξ', v: `${fmt(res.extent, 4)} mol` },
          ]} />
          <div className="table-wrap">
            <table>
              <caption>Cantidades de cada sustancia</caption>
              <thead><tr><th>Sustancia</th><th className="n">M (g/mol)</th><th className="n">Inicial (g)</th><th className="n">Consumido / formado (g)</th><th className="n">Final real (g)</th></tr></thead>
              <tbody>
                {rx.reactants.map((s, i) => (
                  <tr key={s.formula}><td>{prettyFormula(s.formula)} <span className="small muted">{s.name}</span></td><td className="n">{fmt(res.molarMasses[i], 3)}</td><td className="n">{fmt(i === 0 ? massA : massB, 2)}</td><td className="n">−{fmt(res.consumed[i] * yieldP / 100, 2)}</td><td className="n">{fmt((i === 0 ? massA : massB) - res.consumed[i] * yieldP / 100, 2)}</td></tr>
                ))}
                {rx.products.map((s, i) => (
                  <tr key={s.formula} className={i === main ? 'highlight' : undefined}><td>{prettyFormula(s.formula)} <span className="small muted">{s.name}</span></td><td className="n">{fmt(res.molarMasses[rx.reactants.length + i], 3)}</td><td className="n">0,00</td><td className="n">+{fmt(res.actualProducts[i], 2)}</td><td className="n">{fmt(res.actualProducts[i], 2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="controls">
          <div className="card stack">
            <h3>Reactivos</h3>
            <Select label="Reacción" value={rid} onChange={setRid} options={REACTIONS.map((r) => ({ value: r.id, label: r.name }))} />
            <Slider label={`Masa de ${A.name} (A)`} value={massA} min={STOICH_LIMITS.mass[0]} max={60} step={0.1} unit="g" decimals={1} onChange={setMassA} />
            <Slider label={`Masa de ${B.name} (B)`} value={massB} min={STOICH_LIMITS.mass[0]} max={60} step={0.1} unit="g" decimals={1} onChange={setMassB} />
            <Slider label="Rendimiento de la reacción" value={yieldP} min={STOICH_LIMITS.yieldPercent[0]} max={STOICH_LIMITS.yieldPercent[1]} step={1} unit="%" decimals={0} onChange={setYieldP} />
            <RecordButton onRecord={record} />
          </div>
          <Notice>La reacción se considera completa e irreversible y los reactivos, puros. El rendimiento menor al 100 % representa pérdidas experimentales.</Notice>
        </div>
      </div>
      <Balancer />
    </div>
  );
}

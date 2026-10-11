import { useMemo, useState } from 'react';
import { checkBalance, findReaction, REACTIONS, simulateStoichiometry, STOICH_LIMITS, type Reaction } from '../models/stoichiometry';
import { prettyFormula } from '../models/chemistry';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, DigitalBalance, Erlenmeyer, shade } from './kit';

/* ---------------------------------------------------------------- dibujo del banco */

type Phase = 's' | 'l' | 'g' | 'aq';
const PHASE: Record<string, Phase> = { NaHCO3: 's', Zn: 's', CH3COOH: 'l', HCl: 'aq', CH4: 'g', O2: 'g', N2: 'g', H2: 'g', CO2: 'g', NH3: 'g', H2O: 'l', CH3COONa: 'aq', ZnCl2: 'aq' };
const LOOK: Record<string, string> = { NaHCO3: '#f4f4ef', Zn: '#9aa3ab', CH3COOH: '#dfe9ef', HCl: '#d7ebf5', CH4: '#d8efc8', O2: '#bfe0ff', N2: '#d9dcf5', H2: '#e3ecff' };
const phaseOf = (f: string): Phase => PHASE[f] ?? 's';

/** Recipiente de un reactivo sobre el plato de la balanza (cx = centro, y = cara superior del plato). */
function ReagentOnPan({ cx, y, formula, mass }: { cx: number; y: number; formula: string; mass: number }) {
  const ph = phaseOf(formula);
  const color = LOOK[formula] ?? '#e6e6e6';
  const s = Math.sqrt(Math.min(60, mass) / 60);
  if (ph === 's') {
    const h = 4 + 16 * s, w = 12 + 16 * s;
    return (
      <g>
        <path d={`M${cx - w} ${y - 5} Q${cx - w * 0.4} ${y - 5 - h * 1.3} ${cx} ${y - 5 - h * 1.25} Q${cx + w * 0.4} ${y - 5 - h * 1.3} ${cx + w} ${y - 5} Z`} fill={color} stroke={shade(color, -0.3)} strokeWidth="0.7" />
        {formula === 'Zn' && Array.from({ length: 14 }, (_, i) => <circle key={i} cx={cx - w * 0.7 + ((i * 7) % (w * 1.4))} cy={y - 7 - ((i * 5) % Math.max(2, h * 0.8))} r="1.6" fill="#c3cad0" stroke="#6f7880" strokeWidth="0.4" />)}
        <path d={`M${cx - 36} ${y - 8} Q${cx} ${y + 3} ${cx + 36} ${y - 8} Q${cx} ${y - 1} ${cx - 36} ${y - 8} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
      </g>
    );
  }
  if (ph === 'g') {
    // bulbo de vidrio para gases con llave
    const r = 24;
    return (
      <g>
        <ellipse cx={cx} cy={y - 1} rx={14} ry={3} fill="url(#kit-body-dark)" />
        <circle cx={cx} cy={y - r - 2} r={r} fill={color} opacity="0.55" />
        <circle cx={cx} cy={y - r - 2} r={r} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.5" />
        <rect x={cx - 4} y={y - 2 * r - 18} width={8} height={16} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
        <rect x={cx - 11} y={y - 2 * r - 14} width={22} height={5} rx={2} fill="#2b3335" />
        <path d={`M${cx - 15} ${y - r - 12} Q${cx - 19} ${y - r} ${cx - 12} ${y - r + 12}`} fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.45" strokeLinecap="round" />
        <text x={cx} y={y - r + 2} textAnchor="middle" style={{ fontSize: 9, fill: '#24454a', fontWeight: 700 }}>gas</text>
      </g>
    );
  }
  // líquido o solución en un vaso pequeño
  const bw = 50, bh = 54, bx = cx - bw / 2, by = y - bh - 1;
  const ly = by + bh - 4 - (bh - 12) * (0.25 + 0.6 * s);
  return (
    <g>
      <path d={`M${bx} ${by} L${bx} ${by + bh - 6} Q${bx} ${by + bh} ${bx + 6} ${by + bh} L${bx + bw - 6} ${by + bh} Q${bx + bw} ${by + bh} ${bx + bw} ${by + bh - 6} L${bx + bw} ${by}`} fill="url(#kit-glass-fill)" />
      <rect x={bx + 2} y={ly} width={bw - 4} height={by + bh - 2 - ly} rx={3} fill={color} opacity="0.85" />
      <rect x={bx + 2} y={ly} width={bw - 4} height={by + bh - 2 - ly} rx={3} fill="url(#kit-liquid-shade)" />
      <line x1={bx + 2} x2={bx + bw - 2} y1={ly} y2={ly} stroke={shade(color, -0.35)} strokeWidth="1.2" />
      <path d={`M${bx - 3} ${by - 2} Q${bx} ${by} ${bx} ${by + 4} L${bx} ${by + bh - 6} Q${bx} ${by + bh} ${bx + 6} ${by + bh} L${bx + bw - 6} ${by + bh} Q${bx + bw} ${by + bh} ${bx + bw} ${by + bh - 6} L${bx + bw} ${by}`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
      <rect x={bx + 5} y={by + 6} width={2.5} height={bh - 16} rx={1.2} fill="#fff" opacity="0.4" />
    </g>
  );
}

function StoichBench({ rx, massA, massB, res }: { rx: Reaction; massA: number; massB: number; res: ReturnType<typeof simulateStoichiometry> }) {
  const [A, B] = rx.reactants;
  const gasMass = rx.products.reduce((a, p, i) => a + (phaseOf(p.formula) === 'g' ? res.actualProducts[i] : 0), 0);
  const condensed = rx.products.some((p) => phaseOf(p.formula) !== 'g');
  const balloonR = 8 + Math.min(30, Math.sqrt(gasMass) * 6);
  const leftover = res.excess.map((m, i) => ({ m, s: rx.reactants[i] })).filter((e) => e.m > 1e-6 && phaseOf(e.s.formula) === 's');
  const fx = 488, fy = 112, fw = 100, fh = 110;
  return (
    <svg viewBox="0 0 640 262" role="img" aria-labelledby="sto-t" aria-describedby="sto-d">
      <title id="sto-t">Balanzas con los reactivos y matraz cerrado con los productos</title>
      <desc id="sto-d">{`${A.name}: ${fmt(massA, 2)} g; ${B.name}: ${fmt(massB, 2)} g. En el sistema cerrado, después de la reacción, la masa total es ${fmt(res.massAfterTheoretical, 2)} g.`}</desc>
      <BenchTop y={222} width={640} />
      <DigitalBalance x={12} y={146} w={208} reading={fmt(massA, 2)}>
        <ReagentOnPan cx={116} y={144} formula={A.formula} mass={massA} />
      </DigitalBalance>
      <text x="116" y="244" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>A · {prettyFormula(A.formula)}</text>
      <DigitalBalance x={236} y={146} w={208} reading={fmt(massB, 2)}>
        <ReagentOnPan cx={340} y={144} formula={B.formula} mass={massB} />
      </DigitalBalance>
      <text x="340" y="244" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>B · {prettyFormula(B.formula)}</text>
      <path d="M454 168 L474 168" stroke="var(--ink-2)" strokeWidth="2" markerEnd="url(#sto-arrow)" />
      <defs><marker id="sto-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--ink-2)" /></marker></defs>
      {/* matraz cerrado con globo: los productos gaseosos lo inflan, la masa total no cambia */}
      <Erlenmeyer x={fx} y={fy} w={fw} h={fh} fill={condensed ? 0.28 : 0} liquid="#cfe3ee" liquidOpacity={0.6}>
        {leftover.map((e, k) => Array.from({ length: 8 }, (_, i) => <circle key={`${k}-${i}`} cx={fx + 26 + i * 6.5} cy={fy + fh - 6 - (i % 2) * 2.5} r={2.4} fill={LOOK[e.s.formula] ?? '#ddd'} stroke={shade(LOOK[e.s.formula] ?? '#dddddd', -0.35)} strokeWidth="0.5" />))}
        {!condensed && <path d={`M${fx + 30} ${fy + fh - 30} q4 -6 8 0 q4 6 8 0`} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1" opacity="0.6" />}
      </Erlenmeyer>
      <path d={`M${fx + fw / 2 - 14} ${fy - 2} Q${fx + fw / 2 - 16} ${fy - 8} ${fx + fw / 2 - 10} ${fy - 12} L${fx + fw / 2 + 10} ${fy - 12} Q${fx + fw / 2 + 16} ${fy - 8} ${fx + fw / 2 + 14} ${fy - 2} Z`} fill="#e0533f" />
      <ellipse cx={fx + fw / 2} cy={fy - 10 - balloonR} rx={balloonR * 0.9} ry={balloonR} fill="#e0533f" opacity="0.9" />
      <ellipse cx={fx + fw / 2 - balloonR * 0.35} cy={fy - 10 - balloonR * 1.35} rx={balloonR * 0.18} ry={balloonR * 0.3} fill="#fff" opacity="0.35" />
      <text x={fx + fw / 2} y="244" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Sistema cerrado · {fmt(res.massAfterTheoretical, 2)} g</text>
    </svg>
  );
}

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
          <div className="bench">
            <StoichBench rx={rx} massA={massA} massB={massB} res={res} />
          </div>
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

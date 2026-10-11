import { useMemo, useState } from 'react';
import {
  chiSquareTest, findOrganism, genotypeDistribution, normalizePair, ORGANISMS, phenotypeDistribution, punnettSquare, ratioString, sampleOffspring, type Genotype,
} from '../models/mendel';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import type { LabProps } from './registry';

const N_OPTIONS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

function Bars({ rows }: { rows: { key: string; expected: number; observed: number | null }[] }) {
  const W = 640, rowH = 46, H = rows.length * rowH + 30, left = 190, right = 20;
  const sx = (p: number) => left + (p / 100) * (W - left - right);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Porcentajes esperados y observados: ${rows.map((r) => `${r.key}: esperado ${fmt(r.expected, 1)} %, observado ${r.observed === null ? 'sin datos' : fmt(r.observed, 1) + ' %'}`).join('; ')}`}>
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={0} y2={H - 24} stroke="var(--line)" />
          <text x={sx(t)} y={H - 8} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{t} %</text>
        </g>
      ))}
      {rows.map((r, i) => (
        <g key={r.key} transform={`translate(0 ${i * rowH + 4})`}>
          <text x={left - 8} y={22} textAnchor="end" style={{ fontSize: 12, fill: 'var(--ink)' }}>{r.key}</text>
          <rect x={left} y={4} width={sx(r.expected) - left} height={16} fill="var(--series-2)" rx="2" />
          {r.observed !== null && <rect x={left} y={22} width={Math.max(0, sx(r.observed) - left)} height={16} fill="var(--series-1)" rx="2" />}
        </g>
      ))}
    </svg>
  );
}

export default function MendelLab({ api }: LabProps) {
  const [orgId, setOrgId] = useState('guisante');
  const [nGenes, setNGenes] = useState<'1' | '2'>('1');
  const organism = findOrganism(orgId);
  const genes = organism.genes.slice(0, Number(nGenes));
  const options = (gi: number) => {
    const g = organism.genes[gi];
    return [g.dominant + g.dominant, g.dominant + g.recessive, g.recessive + g.recessive];
  };
  const [p1, setP1] = useState<string[]>(['Yy', 'Rr', 'Pp']);
  const [p2, setP2] = useState<string[]>(['Yy', 'Rr', 'Pp']);
  const [n, setN] = useState(100);
  const [seed, setSeed] = useState(1);
  const [sown, setSown] = useState<Map<string, number> | null>(null);

  const changeOrganism = (id: string) => {
    const o = findOrganism(id);
    const het = o.genes.map((g) => g.dominant + g.recessive);
    setOrgId(id); setP1(het); setP2(het); setSown(null);
  };

  const g1: Genotype = genes.map((g, i) => normalizePair(p1[i] ?? g.dominant + g.recessive, g));
  const g2: Genotype = genes.map((g, i) => normalizePair(p2[i] ?? g.dominant + g.recessive, g));
  const square = useMemo(() => punnettSquare(g1, g2, genes), [g1.join(), g2.join(), orgId, nGenes]); // eslint-disable-line react-hooks/exhaustive-deps
  const phen = useMemo(() => phenotypeDistribution(g1, g2, genes), [g1.join(), g2.join(), orgId, nGenes]); // eslint-disable-line react-hooks/exhaustive-deps
  const geno = useMemo(() => genotypeDistribution(g1, g2, genes), [g1.join(), g2.join(), orgId, nGenes]); // eslint-disable-line react-hooks/exhaustive-deps
  const chi = sown ? chiSquareTest(sown, phen) : null;
  const total = sown ? [...sown.values()].reduce((a, b) => a + b, 0) : 0;
  const cross = `${g1.join('')} × ${g2.join('')}`;

  const sow = () => setSown(sampleOffspring(g1, g2, genes, n, seed));
  const resetSow = () => setSown(null);

  const record = () => {
    if (!sown || !chi) return;
    const first = phen[0];
    const obs = ((sown.get(first.key) ?? 0) / total) * 100;
    api.addTrial('cruces', {
      cruce: `${organism.name}: ${cross}`, n: total, esperado: Number((first.probability * 100).toFixed(2)), observado: Number(obs.toFixed(2)),
      desviacion: Number(Math.abs(obs - first.probability * 100).toFixed(2)), chi2: Number(chi.chi2.toFixed(3)),
      p: Number(chi.pValue.toFixed(4)), proporcion: phen.map((c) => sown.get(c.key) ?? 0).join(' : '),
    });
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <div className="panel-title"><h3>Cuadro de Punnett: {cross}</h3><span className="small muted">{organism.scientificName}</span></div>
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="punnett">
              <caption className="sr-only">Cuadro de Punnett. Filas: gametos del progenitor 1. Columnas: gametos del progenitor 2.</caption>
              <thead>
                <tr><th scope="col"><span className="sr-only">Gametos</span>♀ \ ♂</th>{square.cols.map((c, i) => <th scope="col" key={i}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {square.rows.map((r, i) => (
                  <tr key={i}><th scope="row">{r}</th>{square.cells[i].map((cell, j) => <td key={j}>{cell.join('')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-2">
            <div>
              <h4>Genotipos esperados</h4>
              <ul className="list small">{geno.map((c) => <li key={c.key}><span className="num">{c.key}</span>: {fmt(c.probability * 100, 2)} %</li>)}</ul>
              <p className="small">Proporción genotípica: <strong className="num">{ratioString(geno)}</strong></p>
            </div>
            <div>
              <h4>Fenotipos esperados</h4>
              <ul className="list small">{phen.map((c) => <li key={c.key}>{c.key}: {fmt(c.probability * 100, 2)} %</li>)}</ul>
              <p className="small">Proporción fenotípica: <strong className="num">{ratioString(phen)}</strong></p>
            </div>
          </div>
        </div>
        <div className="card stack">
          <div className="panel-title"><h3>Parcela de siembra</h3><span className="small muted">Azul: esperado · Naranja: observado</span></div>
          <Bars rows={phen.map((c) => ({ key: c.key, expected: c.probability * 100, observed: sown ? ((sown.get(c.key) ?? 0) / total) * 100 : null }))} />
          {sown && chi && (
            <>
              <div className="table-wrap">
                <table>
                  <caption>Resultados de {total} descendientes (semilla {seed})</caption>
                  <thead><tr><th>Fenotipo</th><th className="n">Observados (O)</th><th className="n">Esperados (E)</th><th className="n">(O − E)²/E</th></tr></thead>
                  <tbody>{chi.rows.map((r) => <tr key={r.key}><td>{r.key}</td><td className="n">{r.observed}</td><td className="n">{fmt(r.expected, 1)}</td><td className="n">{fmt(r.contribution, 3)}</td></tr>)}</tbody>
                </table>
              </div>
              <Readout items={[
                { k: 'χ²', v: fmt(chi.chi2, 3), data: true },
                { k: 'Grados de libertad', v: chi.df },
                { k: 'Valor p', v: fmt(chi.pValue, 3), data: true },
                { k: 'Interpretación (α = 0,05)', v: chi.consistent ? 'Compatible con lo esperado' : 'Se aleja de lo esperado' },
              ]} />
              <p className="small muted">Extensión opcional: si p ≥ 0,05, las diferencias pueden explicarse por azar. Un p alto no «demuestra» la hipótesis; indica que los datos son compatibles con ella.</p>
            </>
          )}
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Progenitores</h3>
          <Select label="Organismo" value={orgId} onChange={changeOrganism} options={ORGANISMS.map((o) => ({ value: o.id, label: `${o.name} (${o.scientificName})` }))} />
          <Segmented label="Características estudiadas" value={nGenes} onChange={(v) => { setNGenes(v); setSown(null); }} options={[{ value: '1', label: 'Una (monohíbrido)' }, { value: '2', label: 'Dos (dihíbrido)' }]} />
          {genes.map((g, gi) => (
            <fieldset key={g.id} className="stack-sm" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
              <legend className="small" style={{ fontWeight: 700 }}>{g.trait} ({g.dominant}: {g.dominance === 'incompleta' ? `${g.dominantPhenotype}; ${g.dominant}${g.recessive}: ${g.heterozygotePhenotype}` : g.dominantPhenotype}; {g.recessive}{g.recessive}: {g.recessivePhenotype})</legend>
              <div className="grid-2" style={{ gap: 8 }}>
                <Select label="Progenitor 1" value={g1[gi]} onChange={(v) => { const c = [...p1]; c[gi] = v; setP1(c); setSown(null); }} options={options(gi).map((o) => ({ value: o, label: o }))} />
                <Select label="Progenitor 2" value={g2[gi]} onChange={(v) => { const c = [...p2]; c[gi] = v; setP2(c); setSown(null); }} options={options(gi).map((o) => ({ value: o, label: o }))} />
              </div>
            </fieldset>
          ))}
        </div>
        <div className="card stack">
          <h3>Siembra</h3>
          <Select label="Número de descendientes (N)" value={String(n)} onChange={(v) => { setN(Number(v)); setSown(null); }} options={N_OPTIONS.map((x) => ({ value: String(x), label: x.toLocaleString('es-CO') }))} />
          <div className="field">
            <label htmlFor="mendel-seed">Semilla del azar</label>
            <div className="btn-row">
              <input id="mendel-seed" type="number" min={1} max={99999} value={seed} onChange={(e) => { setSeed(Math.max(1, Math.min(99999, Number(e.target.value) || 1))); setSown(null); }} style={{ maxWidth: 120 }} />
              <button type="button" className="btn small" onClick={() => { setSeed((s) => (s % 99999) + 1); setSown(null); }}>Otra semilla</button>
            </div>
            <span className="hint">La misma semilla reproduce exactamente el mismo resultado.</span>
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={sow}>Sembrar y contar</button>
            <button type="button" className="btn" onClick={resetSow} disabled={!sown}>Limpiar parcela</button>
          </div>
          <RecordButton onRecord={record} disabled={!sown} />
        </div>
        <Notice>Dato histórico: Mendel contó 5474 semillas lisas y 1850 rugosas (2,96 : 1) en la F2. El azar en la simulación representa la segregación de los alelos en la meiosis y la fecundación.</Notice>
      </div>
    </div>
  );
}

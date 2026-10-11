import { useMemo, useState } from 'react';
import {
  chiSquareTest, findOrganism, genotypeDistribution, normalizePair, ORGANISMS, phenotypeDistribution, phenotypeOfGene, punnettSquare, ratioString, sampleOffspring,
  type Gene, type Genotype, type Organism,
} from '../models/mendel';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import type { LabProps } from './registry';

const N_OPTIONS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

/* ------------------------------------------------------------------ ilustraciones
 * Arvejas (color y textura de la semilla) y bocas de dragón (color de la flor y forma de la hoja)
 * dibujadas en SVG. Cada ilustración ocupa una caja de 40 × 40 centrada en (0, 0). */

const PEA_COLORS: Record<string, { base: string; light: string; dark: string }> = {
  amarilla: { base: '#efc232', light: '#fff1a8', dark: '#b88a0c' },
  verde: { base: '#7cb342', light: '#d4ecae', dark: '#4a7a1c' },
};
const FLOWER_COLORS: Record<string, { base: string; light: string; dark: string }> = {
  roja: { base: '#d7263d', light: '#ff7a8a', dark: '#8f1324' },
  rosada: { base: '#f28cb1', light: '#ffd0e1', dark: '#c2507c' },
  blanca: { base: '#f8f5ee', light: '#ffffff', dark: '#b9b2a1' },
};

/** Contorno de semilla rugosa: radio con ondulaciones fijas. */
const WRINKLED_PATH = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = 14.2 + 1.1 * Math.sin(a * 5 + 0.6) + 0.7 * Math.sin(a * 9 + 1.3) + 0.5 * Math.sin(a * 14);
    pts.push(`${(r * Math.cos(a)).toFixed(2)} ${(r * 0.94 * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
})();

function MendelDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        {Object.entries(PEA_COLORS).map(([k, c]) => (
          <radialGradient key={k} id={`mdl-pea-${k}`} cx="0.36" cy="0.32" r="0.75">
            <stop offset="0" stopColor={c.light} />
            <stop offset="0.45" stopColor={c.base} />
            <stop offset="1" stopColor={c.dark} />
          </radialGradient>
        ))}
        {Object.entries(FLOWER_COLORS).map(([k, c]) => (
          <radialGradient key={k} id={`mdl-flower-${k}`} cx="0.4" cy="0.3" r="0.8">
            <stop offset="0" stopColor={c.light} />
            <stop offset="0.55" stopColor={c.base} />
            <stop offset="1" stopColor={c.dark} />
          </radialGradient>
        ))}
        <linearGradient id="mdl-leaf" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#8fcf5c" />
          <stop offset="1" stopColor="#3f7f2a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Semilla de arveja: color (amarilla/verde) y textura (lisa/rugosa). */
function PeaArt({ color, wrinkled }: { color: string; wrinkled: boolean }) {
  const key = PEA_COLORS[color] ? color : 'amarilla';
  const c = PEA_COLORS[key];
  const fill = `url(#mdl-pea-${key})`;
  return (
    <g>
      <ellipse cx="1.5" cy="15.5" rx="13" ry="3" fill="#000" opacity="0.14" />
      {wrinkled ? (
        <g>
          <path d={WRINKLED_PATH} fill={fill} stroke={c.dark} strokeWidth="0.9" strokeLinejoin="round" />
          <path d="M-9 -6 Q -3 -2 -6 5 M2 -11 Q 0 -3 6 -1 M-2 6 Q 4 4 8 9 M7 -7 Q 11 -2 12 3" stroke={c.dark} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.75" />
          <path d="M-8 -7 Q -2 -3 -5 4 M3 -10 Q 1 -3 7 -1.5" stroke={c.light} strokeWidth="0.8" fill="none" opacity="0.7" transform="translate(-0.8 -0.8)" />
        </g>
      ) : (
        <g>
          <circle cx="0" cy="0" r="14.5" fill={fill} stroke={c.dark} strokeWidth="0.9" />
          <ellipse cx="-5" cy="-6" rx="4.2" ry="2.6" fill="#fff" opacity="0.55" transform="rotate(-30 -5 -6)" />
        </g>
      )}
      <ellipse cx="8.5" cy="6" rx="2.6" ry="1.4" fill={c.dark} opacity="0.8" transform="rotate(-40 8.5 6)" />
    </g>
  );
}

/** Boca de dragón: espiga floral con hojas anchas o angostas. */
function SnapdragonArt({ color, narrow }: { color: string; narrow: boolean }) {
  const key = FLOWER_COLORS[color] ? color : 'roja';
  const c = FLOWER_COLORS[key];
  const leaf = narrow ? 'M0 0 Q 8 -2.4 17 -0.5 Q 8 1.6 0 0 Z' : 'M0 0 Q 6 -8 15 -2 Q 7 5 0 0 Z';
  const blossom = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-6 0 Q -8 -7 -2 -7 Q 0 -10 3 -7 Q 8 -7 6 0 Q 0 3 -6 0 Z" fill={`url(#mdl-flower-${key})`} stroke={c.dark} strokeWidth="0.8" />
      <path d="M-5 0.5 Q 0 7 5 0.5 Q 0 2.5 -5 0.5 Z" fill={c.base} stroke={c.dark} strokeWidth="0.7" />
      <ellipse cx="0" cy="1.6" rx="1.8" ry="1" fill="#f6c945" opacity="0.9" />
    </g>
  );
  return (
    <g>
      <ellipse cx="0" cy="18" rx="10" ry="2.2" fill="#000" opacity="0.14" />
      <path d="M0 18 L0 -12" stroke="#3f7f2a" strokeWidth="1.8" strokeLinecap="round" />
      <g transform="translate(0 13) rotate(-25)"><path d={leaf} fill="url(#mdl-leaf)" stroke="#2f5f1f" strokeWidth="0.6" /></g>
      <g transform="translate(0 9) scale(-1 1) rotate(-25)"><path d={leaf} fill="url(#mdl-leaf)" stroke="#2f5f1f" strokeWidth="0.6" /></g>
      {blossom(-4, 3, 0.9)}
      {blossom(4, -5, 0.9)}
      {blossom(-2, -13, 0.8)}
      <ellipse cx="1" cy="-19" rx="1.6" ry="2.6" fill="#6aa84f" />
    </g>
  );
}

/** Ilustración del fenotipo (lista de fenotipos por gen, en el orden de `genes`). */
function PhenoArt({ organism, parts }: { organism: Organism; parts: string[] }) {
  if (organism.id === 'boca-dragon') return <SnapdragonArt color={parts[0] ?? 'roja'} narrow={parts[1] === 'angosta'} />;
  return <PeaArt color={parts[0] ?? 'amarilla'} wrinkled={parts[1] === 'rugosa'} />;
}

function PhenoIcon({ organism, parts, size = 34 }: { organism: Organism; parts: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible', flex: 'none' }}>
      <PhenoArt organism={organism} parts={parts} />
    </svg>
  );
}

const GENE_HUES = ['var(--fis)', 'var(--qui)', 'var(--bio)'];

/** Ficha de un alelo: dominante relleno, recesivo con contorno. */
function Allele({ a, gene, gi }: { a: string; gene: Gene | undefined; gi: number }) {
  const dom = a === gene?.dominant;
  const hue = GENE_HUES[gi % GENE_HUES.length];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 21, height: 22, padding: '0 4px',
      borderRadius: 11, fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1,
      background: dom ? hue : 'var(--surface)', color: dom ? 'var(--surface)' : 'var(--ink)',
      border: `1.5px solid ${hue}`, boxShadow: dom ? 'inset 0 -2px 0 rgba(0,0,0,0.18)' : 'none',
    }}>{a}</span>
  );
}

/** Fichas de alelos: en un gameto hay un alelo por gen; en un genotipo, dos. */
function Alleles({ text, genes, perGene }: { text: string; genes: Gene[]; perGene: 1 | 2 }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'nowrap', gap: 2 }}>
      {[...text].map((a, i) => {
        const gi = Math.floor(i / perGene);
        return <Allele key={i} a={a} gene={genes[gi]} gi={gi} />;
      })}
    </span>
  );
}

/** Progenitores ilustrados con su genotipo en fichas de alelos. */
function ParentsStrip({ organism, genes, g1, g2 }: { organism: Organism; genes: Gene[]; g1: Genotype; g2: Genotype }) {
  const parent = (g: Genotype, sign: string) => {
    const parts = g.map((pair, k) => phenotypeOfGene(pair, genes[k]));
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface-2)' }}>
        <PhenoIcon organism={organism} parts={parts} size={46} />
        <div className="stack-sm" style={{ gap: 4 }}>
          <span className="small" style={{ color: 'var(--ink-2)' }}>{sign} {parts.join(', ')}</span>
          <Alleles text={g.join('')} genes={genes} perGene={2} />
        </div>
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }} aria-hidden="true">
      {parent(g1, '♀')}
      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink-2)' }}>×</span>
      {parent(g2, '♂')}
    </div>
  );
}

/** Reparte `slots` íconos entre categorías en proporción a sus conteos (mayores restos). */
function apportion(counts: number[], slots: number): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const n = Math.min(slots, total);
  const raw = counts.map((c) => (c / total) * n);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length][1]]++;
  return out;
}

/** Parcela de siembra ilustrada: surcos de tierra con la descendencia obtenida. */
function Plot({ organism, cats, sown, total }: { organism: Organism; cats: { key: string }[]; sown: Map<string, number>; total: number }) {
  const COLS = 20, SLOTS = 100;
  const layout = useMemo(() => {
    const per = apportion(cats.map((c) => sown.get(c.key) ?? 0), SLOTS);
    const items: number[] = [];
    per.forEach((k, ci) => { for (let j = 0; j < k; j++) items.push(ci); });
    // Mezcla determinista para que la parcela no quede ordenada por bloques.
    const frac = (v: number) => v - Math.floor(v);
    return items.map((ci, i) => ({ ci, r: frac(Math.sin(i * 12.9898 + 78.233) * 43758.5453) })).sort((a, b) => a.r - b.r).map((x) => x.ci);
  }, [cats, sown]);
  const rows = Math.max(1, Math.ceil(layout.length / COLS));
  const cw = 31, rh = 36, W = COLS * cw + 24, H = rows * rh + 40;
  const each = total > SLOTS ? total / SLOTS : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Parcela ilustrada con ${layout.length} plantas${each > 1 ? `; cada una representa unos ${fmt(each, 0)} de los ${total} descendientes` : ''}.`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x="0" y="0" width={W} height={H - 22} rx="10" fill="#8a6a45" opacity="0.2" />
      {Array.from({ length: rows }, (_, r) => (
        <ellipse key={r} cx={W / 2} cy={14 + r * rh + rh * 0.72} rx={W / 2 - 12} ry="5" fill="#6d4c2c" opacity="0.22" />
      ))}
      {layout.map((ci, i) => {
        const parts = cats[ci].key.split(', ');
        const x = 12 + (i % COLS) * cw + cw / 2, y = 12 + Math.floor(i / COLS) * rh + rh / 2;
        return <g key={i} transform={`translate(${x} ${y}) scale(0.66)`}><PhenoArt organism={organism} parts={parts} /></g>;
      })}
      <text x="4" y={H - 6} style={{ fontSize: 12, fill: 'var(--ink-2)' }}>
        {each > 1 ? `Cada ícono representa unos ${fmt(each, 0)} descendientes (muestra proporcional de 100).` : `Cada ícono es un descendiente (${total} en total).`}
      </text>
    </svg>
  );
}

function Bars({ rows, organism }: { rows: { key: string; expected: number; observed: number | null }[]; organism: Organism }) {
  const W = 640, rowH = 46, H = rows.length * rowH + 30, left = 210, right = 20;
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
          <g transform="translate(18 21) scale(0.5)" aria-hidden="true"><PhenoArt organism={organism} parts={r.key.split(', ')} /></g>
          <text x={left - 8} y={25} textAnchor="end" style={{ fontSize: 12, fill: 'var(--ink)' }}>{r.key}</text>
          <rect x={left} y={4} width={sx(r.expected) - left} height={16} fill="var(--series-2)" rx="3" />
          {r.observed !== null && <rect x={left} y={22} width={Math.max(0, sx(r.observed) - left)} height={16} fill="var(--series-1)" rx="3" />}
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
      <MendelDefs />
      <div className="stack">
        <div className="card stack">
          <div className="panel-title"><h3>Cuadro de Punnett: {cross}</h3><span className="small muted">{organism.scientificName}</span></div>
          <ParentsStrip organism={organism} genes={genes} g1={g1} g2={g2} />
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="punnett">
              <caption className="sr-only">Cuadro de Punnett. Filas: gametos del progenitor 1. Columnas: gametos del progenitor 2.</caption>
              <thead>
                <tr><th scope="col"><span className="sr-only">Gametos</span>♀ \ ♂</th>{square.cols.map((c, i) => <th scope="col" key={i}><Alleles text={c} genes={genes} perGene={1} /></th>)}</tr>
              </thead>
              <tbody>
                {square.rows.map((r, i) => (
                  <tr key={i}><th scope="row"><Alleles text={r} genes={genes} perGene={1} /></th>{square.cells[i].map((cell, j) => {
                    const parts = cell.map((pair, k) => phenotypeOfGene(pair, genes[k]));
                    return (
                      <td key={j} title={parts.join(', ')} style={{ padding: '6px 6px 8px', verticalAlign: 'top', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <PhenoIcon organism={organism} parts={parts} size={nGenes === '1' ? 42 : 38} />
                          <Alleles text={cell.join('')} genes={genes} perGene={2} />
                        </span>
                      </td>
                    );
                  })}</tr>
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
              <ul className="list small" style={{ listStyle: 'none', paddingLeft: 0 }}>{phen.map((c) => (
                <li key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PhenoIcon organism={organism} parts={c.key.split(', ')} size={24} /><span>{c.key}: {fmt(c.probability * 100, 2)} %</span></li>
              ))}</ul>
              <p className="small">Proporción fenotípica: <strong className="num">{ratioString(phen)}</strong></p>
            </div>
          </div>
        </div>
        <div className="card stack">
          <div className="panel-title"><h3>Parcela de siembra</h3><span className="small muted">Azul: esperado · Naranja: observado</span></div>
          <Bars organism={organism} rows={phen.map((c) => ({ key: c.key, expected: c.probability * 100, observed: sown ? ((sown.get(c.key) ?? 0) / total) * 100 : null }))} />
          {sown && chi && (
            <>
              <Plot organism={organism} cats={phen} sown={sown} total={total} />
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

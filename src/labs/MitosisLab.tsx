import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  countPhases, cycleState, estimatedDuration, expectedFractions, findTissue, generateField, mitoticIndex, MITOSIS_LIMITS, PHASE_INFO, PHASES, TISSUES, type Phase,
} from '../models/mitosis';
import { fmt } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

/** Dibujo esquemático de una célula vegetal en cada fase (vista de microscopio). */
export function CellGlyph({ phase, x, y, size = 44, angle = 0 }: { phase: Phase; x: number; y: number; size?: number; angle?: number }) {
  const s = size, cx = x + s / 2, cy = y + s / 2;
  const chrom = '#6b2a7a';
  let inner;
  switch (phase) {
    case 'interfase':
      inner = <><circle cx={cx} cy={cy} r={s * 0.2} fill="#d9b8e3" stroke={chrom} strokeWidth="1.2" /><circle cx={cx + 2} cy={cy - 1} r={s * 0.05} fill={chrom} /></>;
      break;
    case 'profase':
      inner = (
        <>
          <circle cx={cx} cy={cy} r={s * 0.22} fill="#ecdcf1" stroke={chrom} strokeWidth="1" strokeDasharray="2 2" />
          {[-6, -2, 2, 6].map((d, i) => <path key={i} d={`M${cx + d - 3} ${cy - 6 + (i % 2) * 3} q3 4 0 8 q-3 4 1 7`} fill="none" stroke={chrom} strokeWidth="2" strokeLinecap="round" />)}
        </>
      );
      break;
    case 'metafase':
      inner = <g transform={`rotate(${angle} ${cx} ${cy})`}>{[-9, -5, -1, 3, 7].map((d) => <rect key={d} x={cx - 1.8} y={cy + d} width={3.6} height={3} rx="1" fill={chrom} />)}<line x1={cx - s * 0.32} y1={cy} x2={cx + s * 0.32} y2={cy} stroke="#c7a5d3" strokeWidth="0.6" /></g>;
      break;
    case 'anafase':
      inner = (
        <g transform={`rotate(${angle} ${cx} ${cy})`}>
          {[-6, -2, 2, 6].map((d) => <path key={`l${d}`} d={`M${cx - 4} ${cy + d} l-6 -2 M${cx - 4} ${cy + d} l-6 2`} stroke={chrom} strokeWidth="1.8" strokeLinecap="round" />)}
          {[-6, -2, 2, 6].map((d) => <path key={`r${d}`} d={`M${cx + 4} ${cy + d} l6 -2 M${cx + 4} ${cy + d} l6 2`} stroke={chrom} strokeWidth="1.8" strokeLinecap="round" />)}
        </g>
      );
      break;
    case 'telofase':
      inner = (
        <g transform={`rotate(${angle} ${cx} ${cy})`}>
          <ellipse cx={cx - s * 0.24} cy={cy} rx={s * 0.1} ry={s * 0.14} fill="#cfa8dc" stroke={chrom} />
          <ellipse cx={cx + s * 0.24} cy={cy} rx={s * 0.1} ry={s * 0.14} fill="#cfa8dc" stroke={chrom} />
          <line x1={cx} y1={y + 4} x2={cx} y2={y + s - 4} stroke="#8a6d3b" strokeWidth="1.5" strokeDasharray="3 2" />
        </g>
      );
      break;
  }
  return (
    <g>
      <rect x={x + 2} y={y + 2} width={s - 4} height={s - 4} rx="6" fill="#f6efe2" stroke="#b49a6b" strokeWidth="1.5" />
      {inner}
    </g>
  );
}

function CyclePart() {
  const [t, setT] = useState(0);
  const tissue = TISSUES[0];
  const st = cycleState(t, tissue);
  const series = Array.from({ length: 181 }, (_, i) => ({ x: i / 10, y: cycleState(i / 10, tissue).dnaC }));
  const glyph: Phase = st.stage === 'G1' || st.stage === 'S' || st.stage === 'G2' ? 'interfase' : st.stage;
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card">
          <Chart title="Contenido de ADN por célula a lo largo del ciclo" xLabel="Tiempo (h)" yLabel="ADN (valor C)" height={220}
            series={[{ label: 'ADN', kind: 'line', points: series }, { label: 'Ahora', kind: 'scatter', points: [{ x: t, y: st.dnaC }] }]} xDomain={[0, 18]} yDomain={[0, 5]} />
        </div>
        <Readout items={[
          { k: 'Etapa', v: st.stage === 'G1' || st.stage === 'S' || st.stage === 'G2' ? `Interfase (${st.stage})` : PHASE_INFO[st.stage].name, data: true },
          { k: 'ADN', v: `${fmt(st.dnaC, 2)} C` },
          { k: 'Cromosomas', v: st.chromosomes },
          { k: 'Cromátidas por cromosoma', v: st.chromatidsPerChromosome },
          { k: 'Núcleos', v: st.nuclei },
        ]} />
        <p className="small muted">G1: la célula crece · S: se replica el ADN · G2: se prepara para dividirse · luego la mitosis. 2n = 16 en la cebolla. En anafase cada cromátida separada se cuenta como un cromosoma.</p>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Ciclo celular</h3>
          <svg viewBox="0 0 120 120" role="img" aria-label={`Célula en ${glyph}`} style={{ width: 160, alignSelf: 'center' }}>
            <CellGlyph phase={glyph} x={10} y={10} size={100} />
          </svg>
          <Slider label="Tiempo dentro del ciclo" value={t} min={0} max={18} step={0.05} unit="h" decimals={2} onChange={setT} />
          <div className="btn-row">
            {[{ l: 'G1', v: 3 }, { l: 'S', v: 10 }, { l: 'G2', v: 14.5 }, { l: 'Profase', v: 16.5 }, { l: 'Metafase', v: 17.15 }, { l: 'Anafase', v: 17.45 }, { l: 'Telofase', v: 17.8 }].map((b) => (
              <button key={b.l} type="button" className="btn small" onClick={() => setT(b.v)}>{b.l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MicroscopePart({ api }: LabProps) {
  const [tissueId, setTissueId] = useState('meristemo');
  const [n, setN] = useState(100);
  const [colch, setColch] = useState(0);
  const [seed, setSeed] = useState(1);
  const [labels, setLabels] = useState<Record<number, Phase>>({});
  const [selected, setSelected] = useState<number | null>(0);
  const [checked, setChecked] = useState(false);
  const tissue = findTissue(tissueId);
  const cells = useMemo(() => generateField(tissue, n, seed, colch), [tissue, n, seed, colch]);
  const reset = () => { setLabels({}); setChecked(false); setSelected(0); };
  const counts = countPhases(cells);
  const studentCounts = countPhases(Object.values(labels).map((phase) => ({ phase })));
  const labelled = Object.keys(labels).length;
  const correct = cells.filter((c) => labels[c.id] === c.phase).length;
  const expected = expectedFractions(tissue, colch);
  const cols = Math.ceil(Math.sqrt(n * 1.6));
  const rows = Math.ceil(n / cols);
  const S = 44;

  const classify = (p: Phase) => {
    if (selected === null) return;
    setLabels((l) => ({ ...l, [selected]: p }));
    setChecked(false);
    const next = cells.find((c) => c.id > selected && !labels[c.id]) ?? cells.find((c) => !labels[c.id] && c.id !== selected);
    setSelected(next ? next.id : null);
  };
  const onKey = (e: KeyboardEvent, id: number) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(id); } };

  const record = () => api.addTrial('conteos', {
    tejido: tissue.name, colchicina: colch, campo: seed, total: n,
    interfase: counts.interfase, profase: counts.profase, metafase: counts.metafase, anafase: counts.anafase, telofase: counts.telofase,
    indice: Number(mitoticIndex(counts).toFixed(2)), metafasePct: Number(((counts.metafase / n) * 100).toFixed(2)),
    precision: labelled > 0 && checked ? Number(((correct / labelled) * 100).toFixed(1)) : null,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" style={{ background: '#2b2620' }}>
          <svg viewBox={`0 0 ${cols * S} ${rows * S}`} role="group" aria-label={`Campo del microscopio con ${n} células. Selecciona una célula y clasifícala con los botones de fase.`} style={{ minWidth: Math.min(cols * S, 520) }}>
            {cells.map((c) => {
              const isSel = selected === c.id;
              const lab = labels[c.id];
              const wrong = checked && lab && lab !== c.phase;
              const right = checked && lab === c.phase;
              return (
                <g key={c.id} role="button" tabIndex={0} aria-pressed={isSel}
                  aria-label={`Célula ${c.id + 1}${lab ? `, clasificada como ${lab}` : ', sin clasificar'}${checked && lab ? (lab === c.phase ? ', correcta' : `, incorrecta: es ${c.phase}`) : ''}`}
                  onClick={() => setSelected(c.id)} onKeyDown={(e) => onKey(e, c.id)} style={{ cursor: 'pointer' }}>
                  <CellGlyph phase={c.phase} x={c.x * S} y={c.y * S} size={S} angle={c.angle} />
                  {(isSel || lab) && <rect x={c.x * S + 1} y={c.y * S + 1} width={S - 2} height={S - 2} rx="7" fill="none" stroke={isSel ? '#fb923c' : wrong ? '#ff6b6b' : right ? '#5bd389' : '#7fb2f0'} strokeWidth={isSel ? 3 : 2} />}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="card stack-sm">
          <div className="panel-title"><h3>Clasifica la célula {selected === null ? '—' : selected + 1}</h3><span className="small muted">{labelled} de {n} clasificadas</span></div>
          <div className="btn-row" role="group" aria-label="Fase de la célula seleccionada">
            {PHASES.map((p) => <button key={p} type="button" className="btn" disabled={selected === null} onClick={() => classify(p)}>{PHASE_INFO[p].name}</button>)}
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={labelled === 0} onClick={() => setChecked(true)}>Comprobar mis clasificaciones</button>
            <button type="button" className="btn" onClick={reset}>Borrar clasificaciones</button>
          </div>
          {checked && <p role="status" className="small">Acertaste {correct} de {labelled} ({fmt((correct / labelled) * 100, 0)} %). Borde verde: correcta; rojo: incorrecta (el lector de pantalla indica la fase real).</p>}
        </div>
        <div className="table-wrap">
          <table>
            <caption>Conteo del campo</caption>
            <thead><tr><th>Fase</th><th className="n">Tu conteo</th><th className="n">{checked || labelled === n ? 'Conteo real' : 'Conteo real (al comprobar)'}</th><th className="n">% del campo</th><th className="n">Duración estimada (h)</th></tr></thead>
            <tbody>
              {PHASES.map((p) => (
                <tr key={p}><td>{PHASE_INFO[p].name}</td><td className="n">{studentCounts[p]}</td><td className="n">{checked ? counts[p] : '—'}</td><td className="n">{checked ? fmt((counts[p] / n) * 100, 1) : '—'}</td><td className="n">{checked ? fmt(estimatedDuration(counts, p, tissue.cycleHours), 2) : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {checked && <Readout items={[
          { k: 'Índice mitótico del campo', v: `${fmt(mitoticIndex(counts), 1)} %`, data: true },
          { k: 'Índice esperado del tejido', v: `${fmt((1 - expected.interfase) * 100, 1)} %` },
        ]} />}
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Preparación</h3>
          <Select label="Tejido" value={tissueId} onChange={(v) => { setTissueId(v); reset(); }} options={TISSUES.map((t) => ({ value: t.id, label: t.name }))} />
          <Slider label="Células en el campo" value={n} min={MITOSIS_LIMITS.cells[0]} max={200} step={10} decimals={0} onChange={(v) => { setN(v); reset(); }} />
          <Slider label="Tiempo con colchicina" value={colch} min={MITOSIS_LIMITS.colchicine[0]} max={MITOSIS_LIMITS.colchicine[1]} step={0.5} unit="h" decimals={1} onChange={(v) => { setColch(v); reset(); }} />
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => { setSeed((s) => s + 1); reset(); }}>Mover a otro campo</button>
            <span className="small muted">Campo n.º {seed}</span>
          </div>
          <RecordButton onRecord={record} />
          <p className="small muted">El ensayo guarda el conteo real del campo; si comprobaste tus clasificaciones, también tu porcentaje de aciertos.</p>
        </div>
        <details className="card" open>
          <summary>Guía de identificación</summary>
          <div className="stack-sm">
            {PHASES.map((p) => (
              <div key={p} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, alignItems: 'center' }}>
                <svg viewBox="0 0 44 44" width="48" height="48" aria-hidden="true"><CellGlyph phase={p} x={0} y={0} size={44} /></svg>
                <span className="small"><strong>{PHASE_INFO[p].name}:</strong> {PHASE_INFO[p].description}</span>
              </div>
            ))}
          </div>
        </details>
        <Notice>Las proporciones dependen de la duración de cada fase (valores ilustrativos para la cebolla). El azar solo decide qué células caen en el campo observado.</Notice>
      </div>
    </div>
  );
}

export default function MitosisLab(props: LabProps) {
  const [tab, setTab] = useState<'micro' | 'ciclo'>('micro');
  return (
    <div className="stack">
      <Segmented label="Actividad" value={tab} onChange={setTab} options={[{ value: 'micro', label: 'Microscopio: contar fases' }, { value: 'ciclo', label: 'Ciclo celular y ADN' }]} />
      {tab === 'micro' ? <MicroscopePart {...props} /> : <CyclePart />}
    </div>
  );
}

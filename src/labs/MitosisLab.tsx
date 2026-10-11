import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  countPhases, cycleState, estimatedDuration, expectedFractions, findTissue, generateField, mitoticIndex, MITOSIS_LIMITS, PHASE_INFO, PHASES, TISSUES, type Phase,
} from '../models/mitosis';
import { fmt } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

/* Colores de una preparación de ápice de raíz teñida con orceína acética (cromatina magenta). */
const STAIN = { chrom: '#6d1650', nucleus: '#c77fa6', nucleusRim: '#8a2f66', nucleolus: '#4f0d39', cyto: '#f4e3e8', cytoEdge: '#ecd2db', wall: '#a7836a', spindle: '#b98aa6' };

/** Cromosoma metafásico en forma de X (dos cromátidas unidas por el centrómero), en unidades de 44 px. */
function Xchrom({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M-2.6 -2.2 L2.6 2.2 M-2.6 2.2 L2.6 -2.2" stroke={STAIN.chrom} strokeWidth="1.7" strokeLinecap="round" />
    </g>
  );
}

/** Célula vegetal (ápice de raíz) en cada fase, vista al microscopio. Se dibuja en un sistema de 44 × 44 y se escala a `size`. */
export function CellGlyph({ phase, x, y, size = 44, angle = 0, seed }: { phase: Phase; x: number; y: number; size?: number; angle?: number; seed?: number }) {
  // Variación natural pequeña entre células (posición del núcleo y tono del citoplasma).
  const jx = seed === undefined ? 0 : (((seed * 37) % 7) - 3) * 0.55;
  const jy = seed === undefined ? 0 : (((seed * 53) % 7) - 3) * 0.55;
  const tone = seed === undefined ? 0 : ((seed * 29) % 5) / 40;
  const c = 22;
  let inner;
  switch (phase) {
    case 'interfase':
      inner = (
        <>
          <circle cx={c} cy={c} r={9.2} fill={STAIN.nucleus} stroke={STAIN.nucleusRim} strokeWidth="1" />
          <circle cx={c - 2.5} cy={c - 2.5} r={5} fill="#fff" opacity="0.18" />
          {[[-4, 3], [4, -4], [3, 5], [-5, -3], [6, 1], [-1, 7]].map(([dx, dy], i) => <circle key={i} cx={c + dx} cy={c + dy} r={0.9} fill={STAIN.chrom} opacity="0.55" />)}
          <circle cx={c + 1.5} cy={c - 0.5} r={2.4} fill={STAIN.nucleolus} />
        </>
      );
      break;
    case 'profase':
      inner = (
        <>
          <circle cx={c} cy={c} r={10.5} fill="#ead0dd" stroke={STAIN.nucleusRim} strokeWidth="0.9" strokeDasharray="2.2 1.6" />
          {[-6, -2, 2, 6].map((d, i) => (
            <path key={i} d={`M${c + d - 2.5} ${c - 7 + (i % 2) * 3} q3.5 3.5 0 7.5 q-3 3.5 1.5 7`} fill="none" stroke={STAIN.chrom} strokeWidth="1.8" strokeLinecap="round" />
          ))}
        </>
      );
      break;
    case 'metafase':
      inner = (
        <g transform={`rotate(${angle} ${c} ${c})`}>
          {[-10, -5, 0, 5, 10].map((d) => <path key={d} d={`M${c - 14} ${c} L${c} ${c + d} L${c + 14} ${c}`} fill="none" stroke={STAIN.spindle} strokeWidth="0.5" opacity="0.8" />)}
          {[-10, -5, 0, 5, 10].map((d, i) => <Xchrom key={d} x={c + (i % 2 ? 0.8 : -0.8)} y={c + d} r={90 + (i % 2 ? 12 : -12)} />)}
        </g>
      );
      break;
    case 'anafase':
      inner = (
        <g transform={`rotate(${angle} ${c} ${c})`}>
          {[-7, -2.5, 2.5, 7].map((d) => <path key={`s${d}`} d={`M${c - 16} ${c} L${c - 6} ${c + d} M${c + 16} ${c} L${c + 6} ${c + d}`} stroke={STAIN.spindle} strokeWidth="0.5" opacity="0.8" />)}
          {[-7, -2.5, 2.5, 7].map((d) => <path key={`l${d}`} d={`M${c - 6} ${c + d} l-5 -2.2 M${c - 6} ${c + d} l-5 2.2`} stroke={STAIN.chrom} strokeWidth="1.7" strokeLinecap="round" />)}
          {[-7, -2.5, 2.5, 7].map((d) => <path key={`r${d}`} d={`M${c + 6} ${c + d} l5 -2.2 M${c + 6} ${c + d} l5 2.2`} stroke={STAIN.chrom} strokeWidth="1.7" strokeLinecap="round" />)}
        </g>
      );
      break;
    case 'telofase':
      inner = (
        <g transform={`rotate(${angle} ${c} ${c})`}>
          {[-1, 1].map((sgn) => (
            <g key={sgn}>
              <ellipse cx={c + sgn * 10.5} cy={c} rx={5} ry={7.5} fill={STAIN.nucleus} stroke={STAIN.nucleusRim} strokeWidth="0.9" />
              <path d={`M${c + sgn * 10.5 - 2} ${c - 4} q3 2 0 4 q-3 2 1 4`} fill="none" stroke={STAIN.chrom} strokeWidth="1.2" strokeLinecap="round" />
            </g>
          ))}
          <line x1={c} y1={4} x2={c} y2={40} stroke={STAIN.wall} strokeWidth="1.6" strokeDasharray="3 1.6" />
        </g>
      );
      break;
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 44})`}>
      <rect x="0.6" y="0.6" width="42.8" height="42.8" rx="3" fill={STAIN.cyto} stroke={STAIN.wall} strokeWidth="1.2" />
      {tone > 0 && <rect x="1.2" y="1.2" width="41.6" height="41.6" rx="2.6" fill="#d9a5bd" opacity={tone} />}
      <rect x="2.4" y="2.4" width="39.2" height="39.2" rx="2.4" fill="none" stroke={STAIN.cytoEdge} strokeWidth="2.2" />
      <g transform={`translate(${jx} ${jy})`}>{inner}</g>
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
        <div className="bench" style={{ background: '#151311', borderColor: '#2b2620' }}>
          <svg viewBox={`0 0 ${cols * S} ${rows * S}`} role="group" aria-label={`Campo del microscopio con ${n} células. Selecciona una célula y clasifícala con los botones de fase.`} style={{ minWidth: Math.min(cols * S, 520) }}>
            <defs>
              <radialGradient id="mit-vignette" cx="0.5" cy="0.5" r="0.72">
                <stop offset="0.62" stopColor="#1a0d14" stopOpacity="0" /><stop offset="0.9" stopColor="#1a0d14" stopOpacity="0.22" /><stop offset="1" stopColor="#1a0d14" stopOpacity="0.45" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width={cols * S} height={rows * S} rx="10" fill="#efe0e6" />
            {cells.map((c) => {
              const isSel = selected === c.id;
              const lab = labels[c.id];
              const wrong = checked && lab && lab !== c.phase;
              const right = checked && lab === c.phase;
              return (
                <g key={c.id} role="button" tabIndex={0} aria-pressed={isSel}
                  aria-label={`Célula ${c.id + 1}${lab ? `, clasificada como ${lab}` : ', sin clasificar'}${checked && lab ? (lab === c.phase ? ', correcta' : `, incorrecta: es ${c.phase}`) : ''}`}
                  onClick={() => setSelected(c.id)} onKeyDown={(e) => onKey(e, c.id)} style={{ cursor: 'pointer' }}>
                  <CellGlyph phase={c.phase} x={c.x * S} y={c.y * S} size={S} angle={c.angle} seed={c.id} />
                  {(isSel || lab) && <rect x={c.x * S + 1} y={c.y * S + 1} width={S - 2} height={S - 2} rx="7" fill="none" stroke={isSel ? '#e8590c' : wrong ? '#d62828' : right ? '#1f9d55' : '#2f6fc0'} strokeWidth={isSel ? 3 : 2.2} />}
                </g>
              );
            })}
            <rect x="0" y="0" width={cols * S} height={rows * S} rx="10" fill="url(#mit-vignette)" pointerEvents="none" />
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

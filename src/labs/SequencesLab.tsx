import { useMemo, useState, type ChangeEvent } from 'react';
import {
  FRAMES, GENETIC_CODES, KIND_LABEL, SEQ_LIMITS, SEQUENCE_EXAMPLES, TABLE_IDS, align, alignmentText, comparisonPresets, complementSeq,
  composition, exampleCds, findExample, findOrfs, frameCodons, frameLabel, gcWindows, isStartCodon, parseSequenceText, reverseComplementSeq,
  alignConditions, parseConditions, roundPercent, sourceStatus, toFasta, transcribeCoding, translateCodon, translateSeq,
  type Alignment, type Frame, type Orf, type Scoring, type SeqKind, type SeqRecord, type TableId,
} from '../models/sequences';
import { AMINO_ACIDS } from '../models/dna';
import { aaClass } from '../models/geneExpression';
import { STATUS_HELP, type EpistemicStatus } from '../lib/provenance';
import { fmt } from '../lib/format';
import { downloadText } from '../lib/report';
import { StatusChip } from '../components/Provenance';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { BlastPanel } from '../components/BlastPanel';

type Tab = 'composicion' | 'traduccion' | 'alineamiento';
type StrandView = 'original' | 'complemento' | 'reverso' | 'arn';

interface LoadedSet { records: SeqRecord[]; exampleId: string | null }

function exampleRecord(id: string): SeqRecord {
  const e = findExample(id)!;
  return {
    id: e.accession.split(' ')[0], description: e.label, sequence: e.sequence, kind: e.kind, format: 'fasta', accession: e.accession,
    organism: e.organism, cds: e.cds ? [{ start: e.cds.start, end: e.cds.end, strand: 1, partial: false, proteinId: e.cds.proteinId, table: e.table, translation: e.cds.translation }] : [], notes: [],
  };
}

const MAX_VIEW_CODONS = 120;
const MAX_VIEW_CHARS = 3000;

/** Cadena larga en bloques de 10 con numeración, en una región desplazable y enfocable. */
function SequenceBox({ seq, label }: { seq: string; label: string }) {
  const shown = seq.slice(0, MAX_VIEW_CHARS);
  const rows: string[] = [];
  for (let i = 0; i < shown.length; i += 60) {
    const chunk = shown.slice(i, i + 60).match(/.{1,10}/g)?.join(' ') ?? '';
    rows.push(`${String(i + 1).padStart(5)}  ${chunk}`);
  }
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={label} style={{ maxHeight: 220, overflow: 'auto', padding: 8 }}>
      <pre style={{ margin: 0, fontFamily: 'var(--font-data)', fontSize: '0.85rem', lineHeight: 1.5 }}>{rows.join('\n')}</pre>
      {seq.length > MAX_VIEW_CHARS && <p className="small muted">Se muestran los primeros {MAX_VIEW_CHARS} de {seq.length} caracteres; la exportación incluye la secuencia completa.</p>}
    </div>
  );
}

/** Visor de codones de un marco: separación por codón, aminoácido debajo y marcas de texto para inicio y terminación. */
function CodonViewer({ dna, frame, table, from }: { dna: string; frame: Frame; table: TableId; from: number }) {
  const { codons } = useMemo(() => frameCodons(dna, frame), [dna, frame]);
  const startIdx = Math.max(0, Math.min(codons.length - 1, from));
  const shown = codons.slice(startIdx, startIdx + MAX_VIEW_CODONS);
  return (
    <div className="stack-sm">
      <div className="table-wrap" tabIndex={0} role="region" aria-label={`Codones del marco ${frameLabel(frame)}`} style={{ maxHeight: 260, overflow: 'auto', padding: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {shown.map((c, k) => {
            const aa = translateCodon(c, table);
            const start = isStartCodon(c, table);
            const stop = aa === '*';
            const idx = startIdx + k;
            return (
              <span key={idx} className={`codon${stop ? ' stop' : ''}`} title={`Codón ${idx + 1}: ${c} → ${AMINO_ACIDS[aa]?.name ?? (aa === 'X' ? 'indeterminado' : aa)}`}
                style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', margin: 0, padding: '2px 5px', minWidth: '3.4em',
                  background: stop ? undefined : idx % 2 === 0 ? 'var(--surface-2)' : 'var(--surface)', border: start ? '2px solid var(--ok)' : '1px solid var(--line)' }}>
                <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {[...c].map((b, i) => <span key={i} className={`base ${b}`}>{b}</span>)}
                </span>
                <span className="small" style={{ fontWeight: 700 }}>{start ? '▸ ' : ''}{stop ? '■ Fin' : AMINO_ACIDS[aa]?.three ?? aa}</span>
              </span>
            );
          })}
        </div>
      </div>
      <p className="small muted">
        Codones {startIdx + 1} a {startIdx + shown.length} de {codons.length} del marco {frameLabel(frame)}. «▸» y borde verde: codón de inicio de la tabla; «■ Fin»: terminación; «X»: codón ambiguo.
      </p>
    </div>
  );
}

/** Alineamiento en bloques de 60 columnas con marcas de texto («|», «:», «.», espacio). */
function AlignmentView({ al, nameA, nameB }: { al: Alignment; nameA: string; nameB: string }) {
  const pad = Math.max(nameA.length, nameB.length, 6);
  const blocks: { a: string; m: string; b: string; pa: number; pb: number; ea: number; eb: number }[] = [];
  let pa = al.startA - 1, pb = al.startB - 1;
  for (let k = 0; k < al.length; k += 60) {
    const a = al.alignedA.slice(k, k + 60), b = al.alignedB.slice(k, k + 60);
    const na = [...a].filter((c) => c !== '-').length, nb = [...b].filter((c) => c !== '-').length;
    blocks.push({ a, m: al.marks.slice(k, k + 60), b, pa: pa + 1, pb: pb + 1, ea: pa + na, eb: pb + nb });
    pa += na; pb += nb;
  }
  const colorOf = (mk: string) => (mk === '|' ? 'var(--ok)' : mk === ':' ? 'var(--data)' : mk === '.' ? 'var(--bad)' : 'var(--ink-2)');
  const line = (s: string, marks: string) => [...s].map((ch, i) => <span key={i} style={{ color: colorOf(marks[i]), fontWeight: marks[i] === '|' ? 700 : 400 }}>{ch}</span>);
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={`Alineamiento de ${nameA} con ${nameB}`} style={{ maxHeight: 340, overflow: 'auto', padding: 8 }}>
      <pre style={{ margin: 0, fontFamily: 'var(--font-data)', fontSize: '0.85rem', lineHeight: 1.45 }}>
        {blocks.map((bl, i) => (
          <span key={i}>
            {`${nameA.padEnd(pad)} ${String(bl.pa).padStart(5)} `}{line(bl.a, bl.m)}{` ${bl.ea}\n`}
            {`${''.padEnd(pad)}       `}<span aria-hidden="true">{bl.m}</span>{'\n'}
            {`${nameB.padEnd(pad)} ${String(bl.pb).padStart(5)} `}{line(bl.b, bl.m)}{` ${bl.eb}\n\n`}
          </span>
        ))}
      </pre>
    </div>
  );
}

const CLASS_HEIGHT: Record<string, number> = { 'hidrofóbico': 1, 'polar sin carga': 0.66, 'cargado (+)': 0.42, 'cargado (−)': 0.42, 'terminación': 0.15 };
const CLASS_FILL: Record<string, string> = { 'hidrofóbico': 'var(--series-3)', 'polar sin carga': 'var(--series-1)', 'cargado (+)': 'var(--series-2)', 'cargado (−)': 'var(--series-5)', 'terminación': 'var(--bad)' };

/** Mapa de la secuencia (escena calculada): regla, perfil de %GC, CDS anotada y ORF en los seis marcos; o perfil de clases de aminoácidos. */
function SequenceMap({ rec, orfs }: { rec: SeqRecord; orfs: Orf[] | null }) {
  const W = 760, x0 = 54, x1 = W - 16, plotW = x1 - x0;
  const n = rec.sequence.length;
  const sx = (p: number) => x0 + ((p - 1) / Math.max(1, n)) * plotW;
  const isNuc = rec.kind !== 'proteina';
  const gc = useMemo(() => {
    if (!isNuc || n < 4) return [];
    const w = Math.max(10, Math.round(n / 40));
    return gcWindows(rec.sequence.replace(/U/g, 'T'), w, Math.max(1, Math.round(w / 2))).map((g) => ({ x: g.start + w / 2, gc: g.gc }));
  }, [rec.sequence, isNuc, n]);
  const tickStep = useMemo(() => {
    const raw = n / 8;
    const p = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
    return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? p * 10;
  }, [n]);
  const ticks = [] as number[];
  for (let t = tickStep; t <= n; t += tickStep) ticks.push(t);
  const H = isNuc ? 330 : 190;
  const gcTop = 46, gcH = 60, trackTop = 140, trackH = 26;
  const protBars = useMemo(() => (isNuc ? [] : [...rec.sequence].map((aa) => aaClass(aa))), [rec.sequence, isNuc]);
  const desc = isNuc
    ? `${KIND_LABEL[rec.kind]} de ${n} nucleótidos. ${orfs ? `${orfs.length} ORF dibujados en los seis marcos.` : 'Aún no se han buscado ORF.'}${rec.cds.length ? ` CDS anotada en el registro: ${rec.cds.map((c) => `${c.start}..${c.end}`).join(', ')}.` : ''}`
    : `Proteína de ${n} aminoácidos con la altura de cada barra según la clase del aminoácido.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="sqb-map-t sqb-map-d">
      <title id="sqb-map-t">{`Mapa de la secuencia ${rec.id}`}</title>
      <desc id="sqb-map-d">{desc}</desc>
      <rect x="0" y="0" width={W} height={H} rx="14" fill="var(--surface)" stroke="var(--line)" />
      <text x={x0} y="22" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--ink)' }}>{rec.id}</text>
      <text x={x1} y="22" textAnchor="end" style={{ fontSize: 11.5, fill: 'var(--ink-2)' }}>{`${n} ${isNuc ? 'nt' : 'aa'} · escena calculada a partir de la secuencia`}</text>
      {/* regla */}
      <line x1={x0} x2={x1} y1={34} y2={34} stroke="var(--ink-2)" strokeWidth="1.2" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={30} y2={38} stroke="var(--ink-2)" />
          <text x={sx(t)} y={isNuc ? 44 : 50} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{t}</text>
        </g>
      ))}
      {isNuc ? (
        <>
          <text x={x0 - 8} y={gcTop + 12} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>%GC</text>
          <rect x={x0} y={gcTop} width={plotW} height={gcH} fill="var(--surface-2)" />
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={x0} x2={x1} y1={gcTop + gcH - (v / 100) * gcH} y2={gcTop + gcH - (v / 100) * gcH} stroke="var(--line)" strokeDasharray={v === 50 ? '4 3' : undefined} />
              <text x={x0 - 8} y={gcTop + gcH - (v / 100) * gcH + 3} textAnchor="end" style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{v}</text>
            </g>
          ))}
          {gc.length > 1 && (
            <polyline fill="none" stroke="var(--bio)" strokeWidth="2" strokeLinejoin="round"
              points={gc.filter((g) => g.gc !== null).map((g) => `${sx(g.x).toFixed(1)},${(gcTop + gcH - ((g.gc as number) / 100) * gcH).toFixed(1)}`).join(' ')} />
          )}
          {/* CDS anotada */}
          <text x={x0 - 8} y={124} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>CDS</text>
          {rec.cds.length === 0 && <text x={x0} y={124} style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>sin CDS anotada en el registro</text>}
          {rec.cds.map((c, i) => (
            <g key={i}>
              <rect x={sx(c.start)} y={115} width={Math.max(2, sx(c.end + 1) - sx(c.start))} height={12} rx="3" fill="var(--bio)" opacity="0.85" />
              <text x={sx(c.start) + 4} y={124.5} style={{ fontSize: 9.5, fill: 'var(--surface)', fontWeight: 700 }}>{`${c.start}..${c.end}${c.strand < 0 ? ' (−)' : ''}`}</text>
            </g>
          ))}
          {/* seis marcos */}
          {FRAMES.map((f, k) => {
            const y = trackTop + k * trackH;
            return (
              <g key={f}>
                <text x={x0 - 8} y={y + 14} textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{frameLabel(f)}</text>
                <line x1={x0} x2={x1} y1={y + 10} y2={y + 10} stroke="var(--line)" />
                {(orfs ?? []).filter((o) => o.frame === f).map((o, i) => {
                  const a = sx(o.start), b = sx(o.end + 1);
                  const w = Math.max(4, b - a), head = Math.min(8, w / 2);
                  const d = f > 0
                    ? `M${a} ${y + 3} H${a + w - head} L${a + w} ${y + 10} L${a + w - head} ${y + 17} H${a} Z`
                    : `M${a + w} ${y + 3} H${a + head} L${a} ${y + 10} L${a + head} ${y + 17} H${a + w} Z`;
                  return <path key={i} d={d} fill={`var(--series-${(k % 6) + 1})`} stroke="var(--ink)" strokeWidth="0.6" opacity={o.hasStop ? 0.95 : 0.55} strokeDasharray={o.hasStop ? undefined : '3 2'} />;
                })}
              </g>
            );
          })}
          {!orfs && <text x={x0 + plotW / 2} y={trackTop + 3 * trackH + 4} textAnchor="middle" className="scene-label" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Pulsa «Buscar ORF» en «Traducción y ORF» para dibujarlos aquí</text>}
          <text x={x0} y={H - 8} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>Flechas: ORF en cada marco (punta = sentido 5′→3′ de esa hebra). Línea verde: %GC en ventanas deslizantes.</text>
        </>
      ) : (
        <>
          {protBars.map((c, i) => {
            const h = CLASS_HEIGHT[c] * 90;
            const bw = Math.max(0.6, plotW / n);
            return <rect key={i} x={x0 + i * (plotW / n)} y={150 - h} width={bw} height={h} fill={CLASS_FILL[c]} />;
          })}
          <line x1={x0} x2={x1} y1={150} y2={150} stroke="var(--ink-2)" />
          <g style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>
            {Object.keys(CLASS_HEIGHT).map((c, i) => (
              <g key={c} transform={`translate(${x0 + i * 140} 170)`}>
                <rect width="12" height={12 * CLASS_HEIGHT[c] + 2} y={12 - 12 * CLASS_HEIGHT[c]} fill={CLASS_FILL[c]} />
                <text x="17" y="11">{c}</text>
              </g>
            ))}
          </g>
        </>
      )}
    </svg>
  );
}

interface Candidate { key: string; name: string; seq: string; kind: SeqKind }

export default function SequencesLab({ api }: LabProps) {
  const [tab, setTab] = useState<Tab>('composicion');
  const [exampleId, setExampleId] = useState('hbb-arnm');
  const [text, setText] = useState('');
  const [forced, setForced] = useState<'auto' | SeqKind>('auto');
  const [loaded, setLoaded] = useState<LoadedSet>({ records: [exampleRecord('hbb-arnm')], exampleId: 'hbb-arnm' });
  const [active, setActive] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [view, setView] = useState<StrandView>('original');
  // traducción y ORF
  const [table, setTable] = useState<TableId>(1);
  const [frame, setFrame] = useState<Frame>(1);
  const [minAa, setMinAa] = useState(30);
  const [starts, setStarts] = useState<'atg' | 'tabla'>('atg');
  const [orfs, setOrfs] = useState<Orf[] | null>(null);
  const [viewFrom, setViewFrom] = useState(0);
  // alineamiento
  const presets = useMemo(() => comparisonPresets(), []);
  const [presetId, setPresetId] = useState(presets[0].id);
  const [keyA, setKeyA] = useState('ex:ins-humana');
  const [keyB, setKeyB] = useState('ex:ins-bovina');
  const [scoring, setScoring] = useState<Scoring>(presets[0].scoring);
  const [result, setResult] = useState<{ al: Alignment; nameA: string; nameB: string; scoring: Scoring } | null>(null);
  const [alignError, setAlignError] = useState<string | null>(null);

  const rec = loaded.records[Math.min(active, loaded.records.length - 1)];
  const example = loaded.exampleId ? findExample(loaded.exampleId) : undefined;
  const src = useMemo<{ status: EpistemicStatus; detail: string }>(() => (example
    ? { status: example.status, detail: example.evidence }
    : sourceStatus(rec.version ?? rec.accession ?? rec.id)), [example, rec]);
  const isNuc = rec.kind !== 'proteina';
  const dna = useMemo(() => rec.sequence.replace(/U/g, 'T'), [rec.sequence]);
  const comp = useMemo(() => composition(rec.sequence, rec.kind), [rec.sequence, rec.kind]);
  const strand = useMemo(() => {
    if (!isNuc) return rec.sequence;
    try {
      if (view === 'complemento') return complementSeq(rec.sequence, rec.kind);
      if (view === 'reverso') return reverseComplementSeq(rec.sequence, rec.kind);
      if (view === 'arn') return transcribeCoding(dna);
    } catch { return rec.sequence; }
    return rec.sequence;
  }, [rec, view, isNuc, dna]);
  const frameProtein = useMemo(() => (isNuc ? translateSeq(frameCodons(dna, frame).codons.join(''), table) : ''), [isNuc, dna, frame, table]);

  const resetResults = () => { setOrfs(null); setViewFrom(0); setResult(null); setAlignError(null); };
  const applyLoaded = (records: SeqRecord[], exId: string | null) => {
    setLoaded({ records, exampleId: exId }); setActive(0); setView('original'); resetResults();
    const e = exId ? findExample(exId) : undefined;
    if (e) setTable(e.table);
    else { const t = records[0]?.cds.find((c) => c.table)?.table; if (t === 1 || t === 2 || t === 11) setTable(t); }
  };
  const loadExample = (id: string) => {
    setExampleId(id); setErrors([]); setWarnings([]);
    applyLoaded([exampleRecord(id)], id);
  };
  const readText = (input: string) => {
    const r = parseSequenceText(input, forced === 'auto' ? undefined : forced);
    setErrors(r.errors); setWarnings(r.warnings);
    if (r.errors.length === 0 && r.records.length > 0) applyLoaded(r.records, null);
  };
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > SEQ_LIMITS.maxBytes) { setErrors([`El archivo «${f.name.slice(0, 60)}» pesa ${f.size} bytes; el máximo es ${SEQ_LIMITS.maxBytes} bytes (1 MiB).`]); setWarnings([]); return; }
    const content = await f.text();
    setText(content.length > 20000 ? content.slice(0, 20000) : content);
    readText(content);
  };

  // candidatos para el alineamiento: registros cargados, ejemplos y sus CDS
  const candidates = useMemo<Candidate[]>(() => {
    const list: Candidate[] = loaded.exampleId ? [] : loaded.records.map((r, i) => ({ key: `rec:${i}`, name: r.id, seq: r.sequence, kind: r.kind }));
    for (const e of SEQUENCE_EXAMPLES) {
      list.push({ key: `ex:${e.id}`, name: e.accession.split(' ')[0], seq: e.sequence, kind: e.kind });
      if (e.cds && e.kind !== 'proteina') list.push({ key: `cds:${e.id}`, name: `${e.accession.split(' ')[0]}-CDS`, seq: exampleCds(e.id), kind: e.kind });
    }
    return list;
  }, [loaded]);
  const candLabel = (c: Candidate) => {
    if (c.key.startsWith('rec:')) return `Cargada: ${c.name} (${c.seq.length})`;
    const e = findExample(c.key.split(':')[1])!;
    return c.key.startsWith('cds:') ? `${e.label}: solo la CDS (${c.seq.length} nt)` : `${e.label} (${c.seq.length})`;
  };
  const findCand = (k: string) => candidates.find((c) => c.key === k) ?? candidates[0];

  const changeAlign = (fn: () => void) => { fn(); setResult(null); setAlignError(null); };
  const choosePreset = (id: string) => changeAlign(() => {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    const map: Record<string, [string, string]> = { ins: ['ex:ins-humana', 'ex:ins-bovina'], globinas: ['ex:hbb-prot', 'ex:hba-prot'], 'hbb-hbd': ['cds:hbb-arnm', 'cds:hbd-arnm'] };
    setKeyA(map[id][0]); setKeyB(map[id][1]); setScoring(p.scoring);
  });
  const runAlign = () => {
    const A = findCand(keyA), B = findCand(keyB);
    setAlignError(null);
    if ((A.kind === 'proteina') !== (B.kind === 'proteina')) { setResult(null); setAlignError('No se puede alinear una proteína con un ácido nucleico: traduce primero el ADN o elige dos secuencias del mismo tipo.'); return; }
    try {
      const al = align(A.seq.replace(/U/g, 'T'), B.seq.replace(/U/g, 'T'), scoring);
      setResult({ al, nameA: A.name, nameB: B.name, scoring });
    } catch (e) { setResult(null); setAlignError((e as Error).message); }
  };
  const alignWarn = alignConditions(findCand(keyA).kind, scoring.matrix);

  const runOrfs = () => {
    try { setOrfs(findOrfs(dna, { table, minAa, starts, includePartial: false })); setViewFrom(0); }
    catch (e) { setErrors([(e as Error).message]); }
  };
  const longest = orfs && orfs.length > 0 ? orfs[0] : null;

  const exportStrand = () => {
    const suffix = { original: '', complemento: '_complemento', reverso: '_reverso_complementario', arn: '_ARN' }[view];
    const statusLine = view === 'original' ? '' : ' [Modelo calculado]';
    downloadText(`${rec.id}${suffix}.fasta`, toFasta([{ id: `${rec.id}${suffix}`, description: `${rec.description}${statusLine}`.trim(), sequence: strand }]));
  };
  const exportTranslation = () => {
    const recs = [{ id: `${rec.id}_marco${frameLabel(frame)}_tabla${table}`, description: `traducción completa [Modelo calculado]`, sequence: frameProtein }];
    if (orfs) orfs.forEach((o, i) => recs.push({ id: `${rec.id}_ORF${i + 1}`, description: `marco ${frameLabel(o.frame)} ${o.start}..${o.end} ${o.lengthAa} aa tabla ${table} [Modelo calculado]`, sequence: o.protein }));
    downloadText(`${rec.id}_traduccion.fasta`, toFasta(recs));
  };
  const exportAlignment = () => {
    if (!result) return;
    downloadText(`alineamiento_${result.nameA}_${result.nameB}.txt`, alignmentText(result.al, result.nameA, result.nameB, result.scoring));
  };

  const recordAlignment = () => {
    if (!result) return;
    const { al, scoring: s } = result;
    api.addTrial('comparaciones', {
      sec1: result.nameA, sec2: result.nameB, modo: s.mode === 'global' ? 'global (Needleman–Wunsch)' : 'local (Smith–Waterman)',
      matriz: s.matrix === 'blosum62' ? 'BLOSUM62' : `simple (+${s.match} / ${s.mismatch})`, apertura: s.gapOpen, extension: s.gapExtend,
      longitud: al.length, identidad: roundPercent(al.identityPercent), similitud: roundPercent(al.similarityPercent), huecos: al.gaps,
      aperturas: al.gapOpenings, puntaje: al.score,
    });
  };
  const recordTranslation = () => {
    if (!orfs) return;
    api.addTrial('traducciones', {
      secuencia: rec.id, tabla: table, inicios: starts === 'atg' ? 'solo ATG' : 'todos los de la tabla', minimo: minAa, longitud: rec.sequence.length,
      gc: comp.gcPercent === null ? null : roundPercent(comp.gcPercent), orfs: orfs.length, orfMax: longest ? longest.lengthAa : 0,
      codonInicio: longest ? longest.startCodon : '—',
    });
  };

  const countsList = Object.entries(comp.counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="lab-layout">
      <div className="stack">
        <Notice>
          <strong>Propósito:</strong> aprendes cómo se representa, se traduce y se compara la información genética al manipular el código genético, el marco de lectura y las penalizaciones del alineamiento, y observar cómo cambian la proteína, los marcos de lectura abiertos, la identidad y los huecos.
        </Notice>
        <div className="bench"><SequenceMap rec={rec} orfs={isNuc ? orfs : null} /></div>
        <div className="btn-row small" role="note" aria-label="Estatus de la escena">
          <StatusChip status="modelo" prefix="Mapa" /> <span className="muted">dibujado a partir de la secuencia y de los ORF calculados.</span>
        </div>
        <Segmented label="Herramienta" value={tab} onChange={setTab} options={[{ value: 'composicion', label: 'Composición' }, { value: 'traduccion', label: 'Traducción y ORF' }, { value: 'alineamiento', label: 'Alineamiento' }]} />

        {tab === 'composicion' && (
          <div className="card stack">
            <h3>Composición de {rec.id}</h3>
            <Readout items={[
              { k: 'Tipo', v: KIND_LABEL[rec.kind] },
              { k: 'Longitud', v: `${rec.sequence.length} ${isNuc ? 'nt' : 'aa'}` },
              { k: '%GC', v: comp.gcPercent === null ? 'no aplica' : `${fmt(roundPercent(comp.gcPercent), 1)} %`, data: true },
              { k: 'Códigos ambiguos', v: String(comp.ambiguous) },
            ]} />
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Conteo por residuo">
              <table>
                <caption className="small muted">Conteo por {isNuc ? 'nucleótido' : 'aminoácido'} (Modelo calculado)</caption>
                <thead><tr><th scope="col">Residuo</th><th scope="col">Nombre</th><th scope="col">Cantidad</th><th scope="col">%</th></tr></thead>
                <tbody>
                  {countsList.map(([c, k]) => (
                    <tr key={c}>
                      <th scope="row" style={{ fontFamily: 'var(--font-data)' }}>{c}</th>
                      <td>{isNuc ? ({ A: 'adenina', C: 'citosina', G: 'guanina', T: 'timina', U: 'uracilo' } as Record<string, string>)[c] ?? 'código ambiguo IUPAC' : AMINO_ACIDS[c]?.name ?? 'código ambiguo o especial'}</td>
                      <td>{k}</td>
                      <td>{fmt((k / rec.sequence.length) * 100, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isNuc && (
              <Segmented label="Vista de la hebra" value={view} onChange={setView} options={[
                { value: 'original', label: 'Original' }, { value: 'complemento', label: 'Complemento' }, { value: 'reverso', label: 'Reverso complementario' },
                ...(rec.kind === 'adn' ? [{ value: 'arn' as StrandView, label: 'Transcrita (ARN)' }] : []),
              ]} />
            )}
            <p className="small muted">
              {view === 'original' && 'Secuencia tal como se cargó (5′→3′).'}
              {view === 'complemento' && 'Complemento base a base, escrito de 3′ a 5′ bajo la original (A↔T, C↔G y códigos IUPAC).'}
              {view === 'reverso' && 'Reverso complementario: la otra hebra leída de 5′ a 3′; sobre ella se leen los marcos −1, −2 y −3.'}
              {view === 'arn' && 'ARNm transcrito desde esta hebra codificante: misma secuencia con U en lugar de T.'}
            </p>
            <SequenceBox seq={strand} label={`Secuencia: vista ${view}`} />
            <div className="btn-row"><button type="button" className="btn" onClick={exportStrand}>Exportar esta vista (FASTA)</button></div>
          </div>
        )}

        {tab === 'traduccion' && (
          <div className="card stack">
            <h3>Traducción y marcos de lectura abiertos</h3>
            {!isNuc ? <Notice kind="warn">Una proteína ya está traducida: carga ADN o ARN para traducir y buscar ORF.</Notice> : (
              <>
                <Readout items={[
                  { k: 'Tabla', v: GENETIC_CODES[table].name },
                  { k: 'ORF encontrados', v: orfs ? String(orfs.length) : 'pulsa «Buscar ORF»', data: true },
                  { k: 'ORF más largo', v: orfs ? (longest ? `${longest.lengthAa} aa, marco ${frameLabel(longest.frame)}, ${longest.start}..${longest.end}` : 'ninguno') : '—', data: true },
                  { k: 'Codón de inicio del más largo', v: longest ? longest.startCodon : '—' },
                ]} />
                {orfs && orfs.length > 0 && (
                  <div className="table-wrap" tabIndex={0} role="region" aria-label="Lista de ORF" style={{ maxHeight: 220, overflow: 'auto' }}>
                    <table>
                      <thead><tr><th scope="col">#</th><th scope="col">Marco</th><th scope="col">Inicio..fin</th><th scope="col">Aminoácidos</th><th scope="col">Inicio</th><th scope="col">Visor</th></tr></thead>
                      <tbody>
                        {orfs.slice(0, 50).map((o, i) => (
                          <tr key={`${o.frame}-${o.start}`}>
                            <td>{i + 1}</td><td>{frameLabel(o.frame)}</td><td>{o.start}..{o.end}</td><td>{o.lengthAa}</td><td style={{ fontFamily: 'var(--font-data)' }}>{o.startCodon}</td>
                            <td><button type="button" className="btn small" onClick={() => {
                              setFrame(o.frame);
                              const s = o.frame > 0 ? o.start : rec.sequence.length - o.end + 1;
                              setViewFrom(Math.floor((s - Math.abs(o.frame)) / 3));
                            }}>Ver ORF {i + 1}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <CodonViewer dna={dna} frame={frame} table={table} from={viewFrom} />
                <div className="field">
                  <span className="small" style={{ fontWeight: 600 }}>Traducción completa del marco {frameLabel(frame)} ({frameProtein.length} aa, «*» = terminación)</span>
                  <SequenceBox seq={frameProtein} label={`Traducción del marco ${frameLabel(frame)}`} />
                </div>
                <div className="btn-row"><button type="button" className="btn" onClick={exportTranslation}>Exportar traducción y ORF (FASTA)</button></div>
              </>
            )}
          </div>
        )}

        {tab === 'alineamiento' && (
          <div className="card stack">
            <h3>Alineamiento por parejas</h3>
            <Readout items={[
              { k: 'Puntaje', v: result ? fmt(result.al.score, 1) : 'pulsa «Alinear»', data: true },
              { k: 'Identidad', v: result ? `${fmt(roundPercent(result.al.identityPercent), 1)} % (${result.al.identities}/${result.al.length})` : '—', data: true },
              { k: 'Similitud', v: result ? `${fmt(roundPercent(result.al.similarityPercent), 1)} %` : '—' },
              { k: 'Huecos', v: result ? `${result.al.gapOpenings} (${result.al.gaps} columnas)` : '—', data: true },
              { k: 'Longitud del alineamiento', v: result ? `${result.al.length} columnas` : '—' },
              { k: 'Región alineada', v: result ? `${result.nameA} ${result.al.startA}..${result.al.endA} · ${result.nameB} ${result.al.startB}..${result.al.endB}` : '—' },
            ]} />
            {alignError && <Notice kind="bad">{alignError}</Notice>}
            {result && <AlignmentView al={result.al} nameA={result.nameA} nameB={result.nameB} />}
            {result && (
              <p className="small muted">
                Marcas: «|» idénticos (verde, negrita) · «:» parecidos, puntaje BLOSUM62 positivo · «.» distintos (rojo) · espacio: hueco «-».
                {' '}Si hay varios alineamientos con el mismo puntaje óptimo, se muestra uno (el método elige siempre el mismo).
              </p>
            )}
            {presets.find((p) => p.id === presetId) && <p className="small">{presets.find((p) => p.id === presetId)!.note}</p>}
            <Notice kind="warn">La identidad alta no implica función idéntica, y una identidad baja no implica funciones distintas. El puntaje y la identidad dependen de la matriz y de las penalizaciones: repórtalos siempre con el método.</Notice>
          </div>
        )}

        <section id="sqb-blast" className="card stack" aria-labelledby="sqb-blast-h">
          <h3 id="sqb-blast-h">Buscar secuencias parecidas (BLAST)</h3>
          <BlastPanel key={`${rec.id}-${rec.kind}`} sequence={rec.sequence.slice(0, 1000)} kind={isNuc ? 'nucleotide' : 'protein'} />
        </section>

        <details className="card">
          <summary><strong>Concepciones erróneas frecuentes</strong></summary>
          <ul className="list small">
            <li>«Identidad alta = misma función»: HBB y HBD comparten más del 90 % de su CDS y se producen en cantidades muy distintas.</li>
            <li>«El código genético es universal»: las mitocondrias de los vertebrados leen TGA como triptófano (tabla 2).</li>
            <li>«Todo gen empieza con ATG»: lacI de E. coli empieza con GTG y su proteína empieza por metionina.</li>
            <li>«Un ORF largo es un gen»: es solo un candidato; los genes se confirman con evidencia experimental.</li>
            <li>«Hay un único porcentaje de parecido entre dos secuencias»: depende del tipo de alineamiento, la matriz y los huecos.</li>
          </ul>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Secuencias de trabajo</h3>
          <Select label="Ejemplo del catálogo" value={loaded.exampleId ? exampleId : 'propia'} onChange={(v) => { if (v !== 'propia') loadExample(v); }}
            options={[...SEQUENCE_EXAMPLES.map((e) => ({ value: e.id, label: `${e.label} · ${e.accession.split(' ')[0]}` })), { value: 'propia', label: 'Secuencia propia (escrita o cargada)' }]} />
          {example && (
            <div className="small stack-sm">
              <div><StatusChip status={example.status} prefix="Secuencia" /></div>
              <span><strong>{example.accession}</strong> · {example.database} · {example.organism} · consultado el {example.retrieved}. <a href={example.recordUrl} target="_blank" rel="noopener noreferrer">Ver el registro original</a></span>
              <span className="muted">{example.evidence}</span>
              <span>{example.note}</span>
            </div>
          )}
          <div className="field">
            <label htmlFor="sqb-text">Secuencia, FASTA o GenBank</label>
            <textarea id="sqb-text" rows={5} spellCheck={false} value={text} placeholder={'>mi_secuencia\nATGGCC…'}
              style={{ fontFamily: 'var(--font-data)', minHeight: 100 }} onChange={(e) => setText(e.target.value)} aria-describedby="sqb-text-h" />
            <span id="sqb-text-h" className="hint">Pega texto, un FASTA (uno o varios registros {"«>»"}) o un registro GenBank. Máximo 1 MiB.</span>
          </div>
          <Select label="Tipo de secuencia" value={forced} onChange={(v) => setForced(v as 'auto' | SeqKind)} options={[{ value: 'auto', label: 'Detectar automáticamente' }, { value: 'adn', label: 'ADN' }, { value: 'arn', label: 'ARN' }, { value: 'proteina', label: 'Proteína' }]} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => readText(text)}>Leer secuencia</button>
          </div>
          <div className="field">
            <label htmlFor="sqb-file">Cargar archivo FASTA o GenBank</label>
            <input id="sqb-file" type="file" accept=".fa,.fasta,.fna,.faa,.ffn,.gb,.gbk,.genbank,.txt,text/plain" onChange={onFile} />
          </div>
          {errors.length > 0 && <Notice kind="bad"><strong>No se pudo leer:</strong><ul className="list">{errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul></Notice>}
          <Warnings list={parseConditions(warnings.slice(0, 6))} />
          {!example && (
            <div className="small stack-sm">
              <div><StatusChip status={src.status} prefix="Secuencia" /></div>
              <span className="muted">{src.detail}</span>
            </div>
          )}
          {loaded.records.length > 1 && (
            <Select label="Registro activo" value={String(active)} onChange={(v) => { setActive(Number(v)); setView('original'); resetResults(); }}
              options={loaded.records.map((r, i) => ({ value: String(i), label: `${r.id} (${KIND_LABEL[r.kind]}, ${r.sequence.length})` }))} />
          )}
        </div>

        {tab === 'traduccion' && isNuc && (
          <div className="card stack">
            <h3>Parámetros de traducción</h3>
            <Select label="Código genético" value={String(table)} onChange={(v) => { setTable(Number(v) as TableId); setOrfs(null); }} options={TABLE_IDS.map((t) => ({ value: String(t), label: GENETIC_CODES[t].name }))} />
            <Select label="Marco del visor" value={String(frame)} onChange={(v) => { setFrame(Number(v) as Frame); setViewFrom(0); }} options={FRAMES.map((f) => ({ value: String(f), label: `Marco ${frameLabel(f)}${f < 0 ? ' (reverso complementario)' : ''}` }))} />
            <Slider label="Longitud mínima del ORF" value={minAa} min={5} max={300} step={1} unit="aa" decimals={0} onChange={(v) => { setMinAa(v); setOrfs(null); }} />
            <Segmented label="Codones de inicio" value={starts} onChange={(v) => { setStarts(v); setOrfs(null); }} options={[{ value: 'atg', label: 'Solo ATG' }, { value: 'tabla', label: 'Todos los de la tabla' }]} />
            <div className="btn-row"><button type="button" className="btn primary" onClick={runOrfs}>Buscar ORF</button></div>
            <RecordButton onRecord={recordTranslation} disabled={!orfs} label="Guardar análisis en la tabla" />
          </div>
        )}

        {tab === 'alineamiento' && (
          <div className="card stack">
            <h3>Parámetros del alineamiento</h3>
            <Select label="Comparación preparada" value={presetId} onChange={choosePreset} options={[...presets.map((p) => ({ value: p.id, label: p.label })), { value: 'propia', label: 'Elegir las secuencias' }]} />
            <Select label="Secuencia A" value={keyA} onChange={(v) => changeAlign(() => { setKeyA(v); setPresetId('propia'); })} options={candidates.map((c) => ({ value: c.key, label: candLabel(c) }))} />
            <Select label="Secuencia B" value={keyB} onChange={(v) => changeAlign(() => { setKeyB(v); setPresetId('propia'); })} options={candidates.map((c) => ({ value: c.key, label: candLabel(c) }))} />
            <Segmented label="Tipo de alineamiento" value={scoring.mode} onChange={(v) => changeAlign(() => setScoring((s) => ({ ...s, mode: v })))} options={[{ value: 'global', label: 'Global (Needleman–Wunsch)' }, { value: 'local', label: 'Local (Smith–Waterman)' }]} />
            <Select label="Matriz de sustitución" value={scoring.matrix} onChange={(v) => changeAlign(() => setScoring((s) => ({ ...s, matrix: v as Scoring['matrix'] })))} options={[{ value: 'simple', label: 'Simple: coincidencia / no coincidencia (ADN)' }, { value: 'blosum62', label: 'BLOSUM62 (proteínas)' }]} />
            {scoring.matrix === 'simple' && (
              <>
                <Slider label="Puntaje por coincidencia" value={scoring.match} min={1} max={5} step={1} decimals={0} onChange={(v) => changeAlign(() => setScoring((s) => ({ ...s, match: v })))} />
                <Slider label="Puntaje por no coincidencia" value={scoring.mismatch} min={-5} max={0} step={1} decimals={0} onChange={(v) => changeAlign(() => setScoring((s) => ({ ...s, mismatch: v })))} />
              </>
            )}
            <Slider label="Penalización por abrir un hueco" value={scoring.gapOpen} min={0} max={20} step={0.5} decimals={1} onChange={(v) => changeAlign(() => setScoring((s) => ({ ...s, gapOpen: v, gapExtend: Math.min(s.gapExtend, v) })))} />
            <Slider label="Penalización por extender un hueco" value={scoring.gapExtend} min={0} max={Math.max(0.5, scoring.gapOpen)} step={0.5} decimals={1} onChange={(v) => changeAlign(() => setScoring((s) => ({ ...s, gapExtend: Math.min(v, s.gapOpen) })))}
              hint="Un hueco de longitud L cuesta apertura + (L − 1) × extensión." />
            <Warnings list={alignWarn} />
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={runAlign}>Alinear</button>
              <button type="button" className="btn" onClick={exportAlignment} disabled={!result}>Exportar alineamiento (TXT)</button>
            </div>
            <RecordButton onRecord={recordAlignment} disabled={!result} label="Guardar comparación en la tabla" />
          </div>
        )}

        <div className="card stack-sm small">
          <div><StatusChip status="modelo" prefix="Resultados" /></div>
          <span className="muted">{STATUS_HELP.modelo} Algoritmos deterministas validados contra Biopython 1.85; el %GC, las traducciones, los ORF y los alineamientos son cálculos, no mediciones.</span>
        </div>
        <Notice>
          <strong>Uso responsable.</strong> El catálogo solo incluye genes y proteínas humanas y bovinas y un gen regulador de E. coli K-12, una cepa de laboratorio no patógena. Este laboratorio no ofrece ni facilita secuencias de factores de virulencia, toxinas o agentes de amenaza, ni herramientas para modificarlas. Los datos genómicos de personas son sensibles: no pegues aquí secuencias de personas identificables.
        </Notice>
      </div>
    </div>
  );
}

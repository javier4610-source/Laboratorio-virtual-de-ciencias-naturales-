import { useId, useMemo, useState } from 'react';
import {
  CONSEQUENCE_LABEL, EVIDENCE_HELP, EVIDENCE_LABEL, GENES, GENES_RETRIEVED, GENE_INFO_ES, STEP_ORDER, STEP_TITLE,
  consequenceFromHgvs, ecoLabel, findGenes, geneStructure, singleBaseVariant, traceSteps, variantConsequence,
  type Claim, type EvidenceKind, type GeneRecord, type StepId, type VariantKind, type VariantResult,
} from '../models/geneTrace';
import { fmt } from '../lib/format';
import { StatusChip } from '../components/Provenance';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, ContactShadow } from './kit';

/* ------------------------------------------------------------------ paleta (solo variables de tema) */
const EV_COLOR: Record<EvidenceKind, string> = {
  demostrado: 'var(--ok)', inferido: 'var(--warn)', 'sin-codigo': 'var(--ink-2)', calculado: 'var(--data)', 'sin-informacion': 'var(--line)',
};
const EV_LETTER: Record<EvidenceKind, string> = { demostrado: 'D', inferido: 'I', 'sin-codigo': 'S', calculado: 'C', 'sin-informacion': '–' };
const STEP_SHORT: Record<StepId, string> = {
  genoma: 'Genoma', gen: 'Gen', regulacion: 'Regulación', transcripcion: 'Transcripción', arn: 'ARN', procesamiento: 'Empalme', traduccion: 'Traducción',
  proteina: 'Proteína', estructura: 'Estructura', funcion: 'Función', interacciones: 'Interacciones', rutas: 'Rutas', fenotipo: 'Fenotipo',
};
const KIND_OPTIONS: { value: VariantKind; label: string }[] = [
  { value: 'sustitucion', label: 'Sustitución' }, { value: 'delecion', label: 'Deleción' }, { value: 'insercion', label: 'Inserción' }, { value: 'duplicacion', label: 'Duplicación' },
];
const BASES = ['A', 'C', 'G', 'T'];
const LEGEND: Record<EvidenceKind, string> = { demostrado: 'Demostrado', inferido: 'Inferido', 'sin-codigo': 'Sin código de evidencia', calculado: 'Calculado', 'sin-informacion': 'Sin información' };

/* ------------------------------------------------------------------ geometría de la pantalla */
const W = 900, H = 452;
const BENCH_Y = 420;
const MON = { x: 26, y: 10, w: 848, h: 352 };
const SCR = { x: MON.x + 14, y: MON.y + 14, w: MON.w - 28, h: MON.h - 28 };
const GX0 = SCR.x + 40, GX1 = SCR.x + SCR.w - 40, GW = GX1 - GX0;
const NODE_Y = SCR.y + 66;
const GENE_Y = SCR.y + 186;
const MRNA_Y = SCR.y + 246;
const PROT_Y = SCR.y + 282;

interface Seg { start: number; end: number; x0: number; x1: number }

/** Segmentos del dibujo del gen: escala real (proporcional) o con intrones de ancho fijo (ilustrativo). */
function geneLayout(g: GeneRecord, compressed: boolean): Seg[] {
  const st = geneStructure(g);
  const parts: { start: number; end: number; intron: boolean }[] = [];
  st.exons.forEach((e, i) => { parts.push({ start: e.start, end: e.end, intron: false }); const intr = st.introns[i]; if (intr) parts.push({ start: intr.start, end: intr.end, intron: true }); });
  const nI = st.introns.length;
  const iw = compressed && nI ? Math.min(28, (GW * 0.45) / nI) : 0;
  const exScale = compressed ? (GW - iw * nI) / st.exonicLength : GW / st.geneLength;
  let x = GX0;
  return parts.map((p) => {
    const w = compressed && p.intron ? iw : (p.end - p.start + 1) * exScale;
    const s = { start: p.start, end: p.end, x0: x, x1: x + w };
    x += w;
    return s;
  });
}

function posToX(segs: Seg[], p: number): number {
  const s = segs.find((q) => p >= q.start && p <= q.end) ?? (p < segs[0].start ? segs[0] : segs[segs.length - 1]);
  const f = (Math.min(Math.max(p, s.start), s.end) - s.start + 0.5) / (s.end - s.start + 1);
  return s.x0 + f * (s.x1 - s.x0);
}

/** Posición en el gen (1 = inicio del primer exón) de la base c.N de la región codificante. */
function cdsToGene(g: GeneRecord, c: number): number {
  if (!g.mrna) return g.cdsBlocks[0].geneStart + c - 1;
  const m = g.mrna.cds.start + c - 1;
  const i = g.mrna.exons.findIndex((e) => m >= e.start && m <= e.end);
  const e = g.mrna.exons[Math.max(0, i)];
  return g.genomicExons[Math.max(0, i)].geneStart + (m - e.start);
}

/** Número de la posición c.N de una HGVS codificante simple (null si no es codificante, p. ej. c.-13907C>T). */
const cNum = (h: string | null) => { const m = /^c\.(\d+)/.exec(h ?? ''); return m ? Number(m[1]) : null; };
const pct = (v: number) => `${fmt(v, 1)} %`;
const nt = (v: number | null) => (v === null ? '—' : `${fmt(v, 0)} nt`);

/* ------------------------------------------------------------------ piezas pequeñas */
function EvidenceChip({ kind }: { kind: EvidenceKind }) {
  return (
    <span className="chip" title={EVIDENCE_HELP[kind]} style={{ borderColor: EV_COLOR[kind], color: 'var(--ink)' }}>
      <span aria-hidden="true" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: kind === 'inferido' ? 2 : 9, background: EV_COLOR[kind] }} />
      {EVIDENCE_LABEL[kind]}
    </span>
  );
}

function ClaimView({ c }: { c: Claim }) {
  return (
    <li className="stack-sm" style={{ borderLeft: `4px solid ${EV_COLOR[c.kind]}`, paddingLeft: 10, listStyle: 'none' }}>
      <div className="btn-row" role="note" aria-label="Tipo de evidencia y estatus">
        <EvidenceChip kind={c.kind} />
        {c.status && <StatusChip status={c.status} />}
      </div>
      <p style={{ margin: 0 }}>{c.text}</p>
      {c.quote && (
        <blockquote lang="en" className="small" style={{ margin: 0, paddingLeft: 10, borderLeft: '2px solid var(--line)' }}>
          <span className="sr-only">Cita textual del registro, en inglés: </span>«{c.quote}»
        </blockquote>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        <strong>Base de la clasificación:</strong> {c.basis}
        {c.codes.length > 0 && <> Códigos: {c.codes.map((x) => `${x} = ${ecoLabel(x)}`).join('; ')}.</>}
      </p>
      {(c.source || (c.links && c.links.length > 0)) && (
        <p className="small" style={{ margin: 0 }}>
          {c.source && <>Fuente: {c.source.db}, consultada el {c.source.retrieved}. <a href={c.source.url} target="_blank" rel="noopener noreferrer">Ver registro original</a></>}
          {c.links?.map((l) => <span key={l.href}> · <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></span>)}
        </p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ laboratorio */
export default function GeneTraceLab({ api }: LabProps) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [geneKey, setGeneKey] = useState('HBB');
  const [stepIdx, setStepIdx] = useState(0);
  const [scale, setScale] = useState<'real' | 'comprimida'>('real');
  const [structKey, setStructKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState<'clinvar' | 'hipotetica'>('clinvar');
  const [clinvarIdx, setClinvarIdx] = useState('0');
  const [kind, setKind] = useState<VariantKind>('sustitucion');
  const [position, setPosition] = useState(20);
  const [base, setBase] = useState('T');
  const [analysis, setAnalysis] = useState<{ sig: string; result: VariantResult; clinvar: GeneRecord['variants'][number] | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gene = useMemo(() => GENES.find((g) => g.key === geneKey)!, [geneKey]);
  const results = useMemo(() => findGenes(query), [query]);
  const steps = useMemo(() => traceSteps(gene), [gene]);
  const st = useMemo(() => geneStructure(gene), [gene]);
  const segs = useMemo(() => geneLayout(gene, scale === 'comprimida'), [gene, scale]);
  const es = GENE_INFO_ES[gene.key];
  const step = steps[stepIdx];
  const hasClinvar = gene.variants.length > 0;
  const effOrigin = hasClinvar ? origin : 'hipotetica';
  const cv = effOrigin === 'clinvar' ? gene.variants[Math.min(Number(clinvarIdx), gene.variants.length - 1)] : null;
  const pos = Math.min(position, gene.cds.length);
  const sig = `${gene.key}|${effOrigin}|${effOrigin === 'clinvar' ? cv?.clinvarId : `${kind}|${pos}|${base}`}`;
  const current = analysis && analysis.sig === sig ? analysis : null;
  const structDone = structKey === gene.key;

  const chooseGene = (k: string) => {
    setGeneKey(k); setStepIdx(0); setClinvarIdx('0'); setAnalysis(null); setError(null);
    const g = GENES.find((x) => x.key === k)!;
    if (position > g.cds.length) setPosition(Math.min(20, g.cds.length));
  };

  const analyze = () => {
    setError(null);
    try {
      if (effOrigin === 'clinvar' && cv) {
        setAnalysis({ sig, result: consequenceFromHgvs(gene, cv.hgvsC ?? ''), clinvar: cv });
      } else {
        const v = singleBaseVariant(gene, { geneKey: gene.key, kind, position: pos, base });
        setAnalysis({ sig, result: variantConsequence(gene, v), clinvar: null });
      }
    } catch (e) {
      setAnalysis(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const recordVariant = () => {
    if (!current) return;
    const r = current.result;
    const p = current.clinvar ? null : pos;
    api.addTrial('variantes', {
      gen: gene.gene.symbol, origen: current.clinvar ? 'ClinVar' : 'Hipotética', tipo: current.clinvar ? (current.clinvar.type ?? 'ClinVar') : KIND_OPTIONS.find((o) => o.value === kind)!.label,
      posicion: current.clinvar ? cNum(current.clinvar.hgvsC) : p,
      base: current.clinvar || kind === 'delecion' || kind === 'duplicacion' ? '—' : base,
      variante: r.hgvsC, proteina: r.hgvsP ?? '—', consecuencia: r.label, codon: r.codon, exon: r.exon,
      longitudRef: r.refLength, longitudProteina: r.altLength, identidad: r.identity,
      clinvar: current.clinvar ? `${current.clinvar.classification} (${current.clinvar.accession})` : '—',
      evidencia: current.clinvar ? 'Variante registrada (ClinVar); consecuencia: modelo calculado' : 'Variante hipotética; consecuencia: modelo calculado',
    });
  };

  const recordGene = () => {
    api.addTrial('genes', {
      gen: gene.gene.symbol, organismo: gene.gene.organism, exones: st.exons.length, intrones: st.introns.length,
      longitudGen: st.geneLength, sumaExones: st.exonicLength, sumaIntrones: st.intronicLength, fraccionExonica: st.exonicPercent,
      longitudArnm: st.mrnaLength, longitudProteina: st.proteinLength, pdb: gene.structure?.pdb ?? '—',
      evidenciaFuncion: EVIDENCE_LABEL[steps.find((s) => s.id === 'funcion')!.claims[0].kind],
    });
  };

  /* ---------- geometría derivada (memorizada) ---------- */
  const drawing = useMemo(() => {
    const st2 = geneStructure(gene);
    const exons = st2.exons.map((e) => {
      const sg = segs.find((q) => q.start === e.start)!;
      const px = (sg.x1 - sg.x0) / e.length;
      const coding = gene.cdsBlocks.map((b) => ({ s: Math.max(b.geneStart, e.start), e: Math.min(b.geneEnd, e.end) })).filter((b) => b.s <= b.e)
        .map((b) => ({ x0: sg.x0 + (b.s - e.start) * px, x1: sg.x0 + (b.e - e.start + 1) * px }));
      return { ...e, x0: sg.x0, x1: sg.x1, coding };
    });
    const introns = segs.filter((s) => !st2.exons.some((e) => e.start === s.start));
    const kb = st2.geneLength > 100000 ? 50000 : st2.geneLength > 20000 ? 5000 : st2.geneLength > 4000 ? 1000 : 200;
    const kbW = (kb / st2.geneLength) * GW;
    // ARNm: exones uno tras otro, proporcional a su longitud.
    const mLen = gene.mrna?.length ?? gene.cds.length;
    const mx = (m: number) => GX0 + ((m - 1) / mLen) * GW;
    const mExons = gene.mrna ? gene.mrna.exons.map((e) => ({ n: e.n, x0: mx(e.start), x1: mx(e.end + 1) })) : [{ n: 1, x0: mx(1), x1: mx(mLen + 1) }];
    const mCds = gene.mrna ? { x0: mx(gene.mrna.cds.start), x1: mx(gene.mrna.cds.end + 1) } : { x0: mx(1), x1: mx(mLen + 1) };
    return { exons, introns, kb, kbW, mx, mExons, mCds };
  }, [gene, segs]);

  const markerC = effOrigin === 'clinvar' ? cNum(cv?.hgvsC ?? null) : pos;
  const markerX = markerC ? posToX(segs, cdsToGene(gene, markerC)) : null;
  const markerMx = markerC ? drawing.mx((gene.mrna?.cds.start ?? 1) + markerC - 1) : null;
  const protMax = Math.max(gene.protein.length, current?.result.altLength ?? 0);
  const pw = (aa: number) => (aa / protMax) * GW * 0.62;

  const sceneDesc = `Pantalla con la ruta de ${gene.gene.symbol} en 13 pasos (paso actual: ${step.title}, ${EVIDENCE_LABEL[step.claims[0].kind].toLowerCase()}), el diagrama de ${st.exons.length} exones y ${st.introns.length} intrones en escala ${scale === 'real' ? 'real' : 'con intrones comprimidos'}, el ARNm y la proteína de ${fmt(gene.protein.length, 0)} aminoácidos${current?.result.altLength != null ? ` frente a ${fmt(current.result.altLength, 0)} con la variante` : ''}.`;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Pantalla de la estación de bioinformática (desplazable)">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="rgn-t rgn-d" style={{ width: '100%', minWidth: 640 }}>
            <title id="rgn-t">Estación de bioinformática: ruta de {gene.gene.symbol} del genoma al fenotipo</title>
            <desc id="rgn-d">{sceneDesc}</desc>
            {/* monitor */}
            <ContactShadow x={W / 2 - 110} y={BENCH_Y} w={220} h={10} />
            <path d={`M${W / 2 - 34} ${MON.y + MON.h} L${W / 2 + 34} ${MON.y + MON.h} L${W / 2 + 46} ${BENCH_Y - 8} L${W / 2 - 46} ${BENCH_Y - 8} Z`} fill="url(#kit-metal)" stroke="var(--line)" />
            <rect x={W / 2 - 110} y={BENCH_Y - 10} width={220} height={10} rx={4} fill="url(#kit-metal-h)" stroke="var(--line)" />
            <rect x={MON.x} y={MON.y} width={MON.w} height={MON.h} rx={16} fill="url(#kit-body-dark)" filter="url(#kit-shadow)" />
            <rect x={SCR.x} y={SCR.y} width={SCR.w} height={SCR.h} rx={6} fill="var(--surface)" stroke="#000" strokeOpacity="0.4" />
            <circle cx={W / 2} cy={MON.y + MON.h - 7} r={2.5} fill="var(--ok)" />
            <BenchTop y={BENCH_Y} width={W} />

            {/* encabezado */}
            <text x={SCR.x + 14} y={SCR.y + 20} fill="var(--ink)" style={{ fontSize: 14, fontWeight: 700 }}>{gene.gene.symbol} · {es.name}</text>
            <text x={SCR.x + SCR.w - 14} y={SCR.y + 20} textAnchor="end" fill="var(--ink-2)" style={{ fontSize: 11, fontFamily: 'var(--font-data)' }}>
              {gene.gene.genomic.accession}:{fmt(gene.gene.genomic.start, 0)}-{fmt(gene.gene.genomic.end, 0)} ({gene.gene.genomic.strand})
            </text>

            {/* ruta de 13 pasos */}
            <line x1={GX0} x2={GX1} y1={NODE_Y} y2={NODE_Y} stroke="var(--line)" strokeWidth={3} />
            {steps.map((s, i) => {
              const x = GX0 + (i / (steps.length - 1)) * GW;
              const k = s.claims[0].kind;
              const sel = i === stepIdx;
              return (
                <g key={s.id}>
                  {sel && <circle cx={x} cy={NODE_Y} r={17} fill="none" stroke="var(--bio)" strokeWidth={2.5} />}
                  <circle cx={x} cy={NODE_Y} r={12} fill="var(--surface)" stroke={EV_COLOR[k]} strokeWidth={3} />
                  <text x={x} y={NODE_Y + 4} textAnchor="middle" fill="var(--ink)" style={{ fontSize: 11, fontWeight: 700 }}>{EV_LETTER[k]}</text>
                  <text x={x} y={NODE_Y + (i % 2 ? 44 : 32)} textAnchor="middle" fill={sel ? 'var(--ink)' : 'var(--ink-2)'} style={{ fontSize: 10.5, fontWeight: sel ? 700 : 500 }}>{STEP_SHORT[s.id]}</text>
                </g>
              );
            })}
            {/* leyenda (texto, no solo color) */}
            {(Object.keys(EV_LETTER) as EvidenceKind[]).map((k, i) => (
              <g key={k} transform={`translate(${GX0 + i * 148}, ${NODE_Y + 66})`}>
                <circle cx={6} cy={-4} r={6} fill="var(--surface)" stroke={EV_COLOR[k]} strokeWidth={2.5} />
                <text x={6} y={-0.5} textAnchor="middle" fill="var(--ink)" style={{ fontSize: 8, fontWeight: 700 }}>{EV_LETTER[k]}</text>
                <text x={17} y={0} fill="var(--ink-2)" style={{ fontSize: 10.5 }}>{LEGEND[k]}</text>
              </g>
            ))}

            {/* gen: exones e intrones con coordenadas reales */}
            <text x={GX0} y={GENE_Y - 28} fill="var(--ink-2)" style={{ fontSize: 11 }}>
              Gen en el genoma: {fmt(st.geneLength, 0)} nt · {st.exons.length} {st.exons.length === 1 ? 'exón' : 'exones'} · {scale === 'real' ? 'escala real' : 'intrones comprimidos (ilustración, no a escala)'}
            </text>
            <text x={GX0 - 8} y={GENE_Y + 4} textAnchor="end" fill="var(--ink-2)" style={{ fontSize: 11 }}>5′</text>
            <text x={GX1 + 8} y={GENE_Y + 4} fill="var(--ink-2)" style={{ fontSize: 11 }}>3′</text>
            {drawing.introns.map((s) => (
              <g key={`i${s.start}`}>
                <line x1={s.x0} x2={s.x1} y1={GENE_Y} y2={GENE_Y} stroke="var(--ink-2)" strokeWidth={1.6} />
                {scale === 'comprimida' && <path d={`M${(s.x0 + s.x1) / 2 - 4} ${GENE_Y - 5} l4 5 l-4 5`} fill="none" stroke="var(--ink-2)" strokeWidth={1.2} />}
              </g>
            ))}
            {drawing.exons.map((e) => (
              <g key={`e${e.n}`}>
                <rect x={e.x0} y={GENE_Y - 7} width={Math.max(1.5, e.x1 - e.x0)} height={14} fill="color-mix(in srgb, var(--bio) 35%, var(--surface))" stroke="var(--bio)" strokeWidth={0.8} />
                {e.coding.map((c, j) => <rect key={j} x={c.x0} y={GENE_Y - 12} width={Math.max(1.5, c.x1 - c.x0)} height={24} rx={2} fill="var(--bio)" />)}
                {st.exons.length <= 17 && e.x1 - e.x0 > 0 && (st.exons.length <= 6 || scale === 'comprimida') && (
                  <text x={(e.x0 + e.x1) / 2} y={GENE_Y - 16} textAnchor="middle" fill="var(--ink-2)" style={{ fontSize: 9.5 }}>{e.n}</text>
                )}
              </g>
            ))}
            {scale === 'real' && (
              <g>
                <line x1={GX1 - drawing.kbW} x2={GX1} y1={GENE_Y + 26} y2={GENE_Y + 26} stroke="var(--ink)" strokeWidth={1.5} />
                <text x={GX1 - drawing.kbW / 2} y={GENE_Y + 39} textAnchor="middle" fill="var(--ink-2)" style={{ fontSize: 10 }}>{drawing.kb >= 1000 ? `${fmt(drawing.kb / 1000, 0)} kb` : `${fmt(drawing.kb, 0)} nt`}</text>
              </g>
            )}

            {/* ARNm maduro */}
            <text x={GX0} y={MRNA_Y - 14} fill="var(--ink-2)" style={{ fontSize: 11 }}>
              {gene.mrna ? `ARNm maduro ${gene.mrna.accession}: ${fmt(gene.mrna.length, 0)} nt (UTR 5′ · región codificante · UTR 3′)` : 'Sin registro de ARNm: se dibuja la región codificante (bacteria, sin empalme)'}
            </text>
            {drawing.mExons.map((e) => <rect key={e.n} x={e.x0} y={MRNA_Y - 5} width={Math.max(1, e.x1 - e.x0)} height={10} fill="color-mix(in srgb, var(--series-3) 30%, var(--surface))" stroke="var(--series-3)" strokeWidth={0.6} />)}
            <rect x={drawing.mCds.x0} y={MRNA_Y - 8} width={drawing.mCds.x1 - drawing.mCds.x0} height={16} rx={2} fill="var(--series-3)" opacity={0.85} />

            {/* proteína */}
            <text x={GX0} y={PROT_Y + 3} fill="var(--ink-2)" style={{ fontSize: 11 }}>Proteína {gene.protein.accession}</text>
            <rect x={GX0 + 150} y={PROT_Y - 6} width={pw(gene.protein.length)} height={12} rx={6} fill="var(--qui)" opacity={0.8} />
            <text x={GX0 + 156 + pw(gene.protein.length)} y={PROT_Y + 4} fill="var(--ink)" style={{ fontSize: 11 }}>{fmt(gene.protein.length, 0)} aa (referencia)</text>
            {current && current.result.altLength != null && current.result.consequence !== 'no-codificante' && (
              <g>
                <text x={GX0} y={PROT_Y + 25} fill="var(--ink-2)" style={{ fontSize: 11 }}>Con la variante</text>
                <rect x={GX0 + 150} y={PROT_Y + 14} width={Math.max(2, pw(current.result.altLength))} height={12} rx={6} fill="var(--bad)" opacity={0.85} />
                <text x={GX0 + 156 + Math.max(2, pw(current.result.altLength))} y={PROT_Y + 24} fill="var(--ink)" style={{ fontSize: 11 }}>{fmt(current.result.altLength, 0)} aa ({current.result.hgvsP})</text>
              </g>
            )}

            {/* marcador de la variante */}
            {markerX !== null && markerMx !== null && (
              <g aria-hidden="true">
                <line x1={markerX} x2={markerMx} y1={GENE_Y + 13} y2={MRNA_Y - 9} stroke="var(--bad)" strokeWidth={1.2} strokeDasharray="3 3" />
                <path d={`M${markerX} ${GENE_Y + 13} l-5 8 h10 Z`} fill="var(--bad)" />
                <text x={markerMx} y={MRNA_Y + 20} textAnchor="middle" fill="var(--bad)" style={{ fontSize: 10.5, fontWeight: 700 }}>c.{markerC}</text>
              </g>
            )}
            {effOrigin === 'clinvar' && cv && !markerC && (
              <text x={GX0} y={GENE_Y + 40} fill="var(--bad)" style={{ fontSize: 10.5, fontWeight: 700 }}>{cv.hgvsC}: fuera del dibujo, corriente arriba del gen</text>
            )}
            <text x={SCR.x + SCR.w - 14} y={SCR.y + SCR.h - 8} textAnchor="end" fill="var(--ink-2)" style={{ fontSize: 9.5 }}>Datos: NCBI, UniProt, RCSB PDB y ClinVar ({GENES_RETRIEVED}). Dibujo calculado con las coordenadas.</text>
          </svg>
        </div>

        <section className="card stack-sm" aria-labelledby="rgn-ficha">
          <h3 id="rgn-ficha">Ficha del gen {gene.gene.symbol}</h3>
          <p className="small" style={{ margin: 0 }}>Nombre: {es.name} · <em>{gene.gene.organism}</em> (taxón {gene.gene.taxId}) · «{gene.gene.description}»</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Identificadores del gen">
            <table>
              <caption className="sr-only">Identificadores y fuentes de {gene.gene.symbol}</caption>
              <thead><tr><th>Registro</th><th>Identificador</th><th>Dato</th><th>Enlace</th></tr></thead>
              <tbody>
                <tr><td>NCBI Gene</td><td>{gene.gene.geneId}</td><td>{gene.gene.mapLocation ?? '—'}; {gene.gene.genomic.exonCount ?? 1} exones en NCBI Gene</td><td><a href={gene.gene.source.url} target="_blank" rel="noopener noreferrer">Ver registro original</a></td></tr>
                <tr><td>Genoma (RefSeq)</td><td>{gene.gene.genomic.accession}</td><td>{fmt(gene.gene.genomic.start, 0)}–{fmt(gene.gene.genomic.end, 0)}, hebra {gene.gene.genomic.strand}</td><td><a href={gene.genomicSource.url} target="_blank" rel="noopener noreferrer">Ver registro original</a></td></tr>
                <tr><td>ARNm (RefSeq)</td><td>{gene.mrna?.accession ?? '—'}</td><td>{gene.mrna ? `${fmt(gene.mrna.length, 0)} nt; ${gene.mrna.refseqStatus}${gene.mrna.mane ? ', MANE Select' : ''}` : 'Sin registro de ARNm'}</td><td>{gene.mrna ? <a href={gene.mrna.source.url} target="_blank" rel="noopener noreferrer">Ver registro original</a> : '—'}</td></tr>
                <tr><td>Proteína (RefSeq)</td><td>{gene.protein.accession}</td><td>{fmt(gene.protein.length, 0)} aa</td><td><a href={gene.protein.source.url} target="_blank" rel="noopener noreferrer">Ver registro original</a></td></tr>
                <tr><td>UniProtKB</td><td>{gene.uniprot.accession}</td><td>{gene.uniprot.reviewed ? 'Revisada (Swiss-Prot)' : 'Sin revisar'}; versión {gene.uniprot.entryVersion}</td><td><a href={gene.uniprot.source.url} target="_blank" rel="noopener noreferrer">Ver registro original</a></td></tr>
                <tr><td>PDB</td><td>{gene.structure?.pdb ?? '—'}</td><td>{gene.structure ? `${gene.structure.method}, ${fmt(gene.structure.resolution, 2)} Å` : 'Sin estructura experimental referenciada'}</td><td>{gene.structure ? <a href={gene.structure.source.url} target="_blank" rel="noopener noreferrer">Ver registro original</a> : '—'}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Todos los datos se consultaron el {GENES_RETRIEVED} y se guardaron en el laboratorio: no hace falta internet. Los enlaces abren el registro vigente, que puede tener una versión más nueva.</p>
        </section>

        <section className="card stack-sm" aria-labelledby="rgn-paso">
          <h3 id="rgn-paso">Paso {stepIdx + 1} de {steps.length}: {step.title}</h3>
          <ul className="stack-sm" style={{ margin: 0, padding: 0 }} aria-live="polite">
            {step.claims.map((c, i) => <ClaimView key={i} c={c} />)}
          </ul>
          {gene.key === 'HBB' && step.id === 'fenotipo' && es.legacyNote && <Notice>{es.legacyNote}</Notice>}
        </section>

        <section className="card stack-sm" aria-labelledby="rgn-est">
          <h3 id="rgn-est">Estructura del gen (calculada con las coordenadas)</h3>
          {structDone ? (
            <>
              <Readout items={[
                { k: 'Exones', v: fmt(st.exons.length, 0), data: true },
                { k: 'Intrones', v: fmt(st.introns.length, 0), data: true },
                { k: 'Longitud del gen', v: nt(st.geneLength), data: true },
                { k: 'Suma de exones', v: nt(st.exonicLength), data: true },
                { k: 'Suma de intrones', v: nt(st.intronicLength), data: true },
                { k: 'Fracción exónica', v: pct(st.exonicPercent), data: true },
                { k: 'Región 5′ no traducida', v: nt(st.utr5), data: true },
                { k: 'Región 3′ no traducida', v: nt(st.utr3), data: true },
              ]} />
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de exones e intrones">
                <table>
                  <caption className="sr-only">Coordenadas de exones e intrones de {gene.gene.symbol}, relativas al inicio del gen</caption>
                  <thead><tr><th>Elemento</th><th className="n">Inicio</th><th className="n">Fin</th><th className="n">Longitud (nt)</th></tr></thead>
                  <tbody>
                    {st.exons.flatMap((e, i) => {
                      const rows = [<tr key={`e${e.n}`}><td>Exón {e.n}</td><td className="n">{fmt(e.start, 0)}</td><td className="n">{fmt(e.end, 0)}</td><td className="n">{fmt(e.length, 0)}</td></tr>];
                      const intr = st.introns[i];
                      if (intr) rows.push(<tr key={`i${intr.n}`}><td>Intrón {intr.n}</td><td className="n">{fmt(intr.start, 0)}</td><td className="n">{fmt(intr.end, 0)}</td><td className="n">{fmt(intr.length, 0)}</td></tr>);
                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
              <div className="btn-row" role="note" aria-label="Procedencia de la estructura"><StatusChip status="modelo" prefix="Longitudes" /><StatusChip status="experimental" prefix="Coordenadas (RefSeq)" /></div>
            </>
          ) : <p className="small muted" style={{ margin: 0 }}>Pulsa «Calcular la estructura del gen» para medir exones, intrones y la fracción exónica.</p>}
        </section>

        <section className="card stack-sm" aria-labelledby="rgn-var">
          <h3 id="rgn-var">Resultado de la variante</h3>
          {current ? (
            <>
              <Readout items={[
                { k: 'Variante', v: current.result.hgvsC },
                { k: 'Consecuencia', v: current.result.label },
                { k: 'Cambio en la proteína', v: current.result.hgvsP ?? 'Ninguno en la secuencia' },
                { k: 'Codón', v: current.result.codon ? `${fmt(current.result.codon, 0)}: ${current.result.refCodon} → ${current.result.altCodon}` : '—' },
                { k: 'Longitud de la proteína', v: current.result.altLength != null ? `${fmt(current.result.altLength, 0)} aa` : 'sin terminación en la región guardada', data: true },
                { k: 'Identidad con la proteína de referencia', v: pct(current.result.identity), data: true },
                { k: 'Exón', v: current.result.exon ? fmt(current.result.exon, 0) : '—' },
                ...(current.clinvar ? [{ k: 'ClinVar', v: `${current.clinvar.hgvsP ?? '(sin p.)'} · ${current.clinvar.classification}` }] : []),
              ]} />
              <p className="small" style={{ margin: 0 }}>{current.result.explanation}</p>
              {current.result.hgvsPLong && current.result.hgvsPLong !== current.result.hgvsP && <p className="small" style={{ margin: 0 }}>Notación completa calculada: {current.result.hgvsPLong}.</p>}
              {current.clinvar && (
                <Notice kind={current.clinvar.hgvsP === null || current.clinvar.hgvsP === current.result.hgvsP ? 'ok' : 'warn'}>
                  {current.clinvar.hgvsP
                    ? (current.clinvar.hgvsP === current.result.hgvsP ? `La traducción de referencia coincide con ClinVar: ${current.clinvar.hgvsP}.` : `La traducción (${current.result.hgvsP}) no coincide con ClinVar (${current.clinvar.hgvsP}).`)
                    : 'ClinVar no da un cambio de proteína para esta variante: está fuera de la región codificante.'}
                  {' '}Registro <a href={current.clinvar.source.url} target="_blank" rel="noopener noreferrer">{current.clinvar.accession}</a> ({current.clinvar.title}; revisión: {current.clinvar.reviewStatus}).
                </Notice>
              )}
              <div className="btn-row" role="note" aria-label="Procedencia de la consecuencia">
                <StatusChip status="modelo" prefix="Consecuencia" />
                {current.clinvar ? <StatusChip status="experimental" prefix="Variante observada (ClinVar)" /> : <span className="chip">Variante hipotética</span>}
              </div>
            </>
          ) : <p className="small muted" style={{ margin: 0 }}>Elige una variante y pulsa «Analizar la variante».</p>}
        </section>

        <section className="card stack-sm" aria-labelledby="rgn-hip">
          <h3 id="rgn-hip">¿Y si el gen no funcionara?</h3>
          <div className="btn-row"><span className="chip warn">Hipótesis conceptual</span><StatusChip status="sin-informacion" prefix="Resultado medido" /></div>
          <p style={{ margin: 0 }}>{es.perturbation}</p>
          <p className="small muted" style={{ margin: 0 }}>No es una eliminación experimental publicada ni una perturbación modelada: el laboratorio no calcula efectos sobre la célula o el organismo.</p>
        </section>
      </div>

      <div className="controls">
        <section className="card stack-sm">
          <h3>Buscar gen</h3>
          <div className="field">
            <label htmlFor={searchId}>Nombre, símbolo, organismo o identificador</label>
            <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="p. ej., globina, insulina, coli, P01308" autoComplete="off" />
            <span className="hint">Busca solo en el conjunto curado de {GENES.length} genes (sin conexión).</span>
          </div>
          <div className="stack-sm" role="group" aria-label="Genes encontrados">
            {results.length === 0 && <p className="small muted" aria-live="polite" style={{ margin: 0 }}>Ningún gen del conjunto coincide con «{query}».</p>}
            {results.map((g) => (
              <button key={g.key} type="button" className="btn small" aria-pressed={g.key === geneKey} onClick={() => chooseGene(g.key)} style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                <strong>{g.gene.symbol}</strong>&nbsp;· {GENE_INFO_ES[g.key].name} ({g.gene.organism.split(' ').slice(0, 2).join(' ')})
              </button>
            ))}
          </div>
        </section>

        <section className="card stack-sm">
          <h3>Ruta del gen a la función</h3>
          <Select label="Paso de la ruta" value={STEP_ORDER[stepIdx]} onChange={(v) => setStepIdx(STEP_ORDER.indexOf(v as StepId))}
            options={STEP_ORDER.map((id, i) => ({ value: id, label: `${i + 1}. ${STEP_TITLE[id]}` }))} />
          <div className="btn-row">
            <button type="button" className="btn small" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0}>Paso anterior</button>
            <button type="button" className="btn small primary" onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))} disabled={stepIdx === steps.length - 1}>Siguiente paso</button>
          </div>
        </section>

        <section className="card stack-sm">
          <h3>Estructura</h3>
          <Segmented label="Escala del diagrama" value={scale} onChange={setScale} options={[{ value: 'real', label: 'Real' }, { value: 'comprimida', label: 'Intrones comprimidos' }]} />
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setStructKey(gene.key)}>Calcular la estructura del gen</button>
          </div>
          <RecordButton onRecord={recordGene} disabled={!structDone} label="Guardar la ficha del gen en la tabla" />
        </section>

        <section className="card stack-sm">
          <h3>Explorador de variantes</h3>
          {hasClinvar ? (
            <Segmented label="Origen de la variante" value={effOrigin} onChange={(v) => { setOrigin(v); setError(null); }} options={[{ value: 'clinvar', label: 'Registrada en ClinVar' }, { value: 'hipotetica', label: 'Hipotética' }]} />
          ) : <p className="small muted" style={{ margin: 0 }}>{gene.gene.symbol} no tiene variantes de ejemplo de ClinVar en el conjunto: explora variantes hipotéticas.</p>}
          {effOrigin === 'clinvar' && cv ? (
            <Select label="Variante registrada" value={String(Math.min(Number(clinvarIdx), gene.variants.length - 1))} onChange={setClinvarIdx}
              options={gene.variants.map((v, i) => ({ value: String(i), label: `${v.hgvsC}${v.dbSNP ? ` (${v.dbSNP})` : ''}` }))} />
          ) : (
            <>
              <Segmented label="Tipo de cambio" value={kind} onChange={setKind} options={KIND_OPTIONS} />
              <Slider label="Posición en la región codificante (c.)" value={pos} min={1} max={gene.cds.length} step={1} decimals={0} onChange={(v) => setPosition(Math.round(v))}
                hint={`Base de referencia en c.${pos}: ${gene.cds[pos - 1]} (codón ${Math.floor((pos - 1) / 3) + 1}: ${gene.cds.slice(Math.floor((pos - 1) / 3) * 3, Math.floor((pos - 1) / 3) * 3 + 3)}).`} />
              {(kind === 'sustitucion' || kind === 'insercion') && (
                <Select label={kind === 'sustitucion' ? 'Base nueva' : 'Base insertada'} value={base} onChange={setBase} options={BASES.map((b) => ({ value: b, label: b }))} />
              )}
            </>
          )}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={analyze}>Analizar la variante</button>
          </div>
          {error && <p className="small" role="alert" style={{ color: 'var(--bad)', margin: 0 }}>{error}</p>}
          <RecordButton onRecord={recordVariant} disabled={!current} label="Guardar la variante en la tabla" />
          <p className="small muted" style={{ margin: 0 }}>Clases posibles: {Object.values(CONSEQUENCE_LABEL).join(', ').toLowerCase()}.</p>
        </section>
      </div>
    </div>
  );
}

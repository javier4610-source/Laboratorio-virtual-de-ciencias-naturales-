import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  CDS_START, GENE_LENGTH, GENE_SEQ, GEL_RANGE_KDA, HBB_SEGMENTS, IVS2_JOIN, LANDMARKS, POLYA_SIGNAL, PROMOTER_ELEMENTS, SEGMENT_RANGES, TSS,
  aaClass, analyzeGeneMutation, expressGene, gelMigration, locate, migrationForMass, proteinMassKDa, relativeToTss, validateMutation,
  type AaClass, type GeneMutation, type GeneSegment, type MutationKind, type SplicingMode,
} from '../models/geneExpression';
import { AMINO_ACIDS, type Base } from '../models/dna';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, ContactShadow, Lcd } from './kit';
import { ManipHint, useSvgDrag } from './manipulate';

/* ------------------------------------------------------------------ paleta
 * Bases con los mismos tonos que el laboratorio de ADN (A rojo, T/U ámbar, G verde, C azul) y texto casi negro. */
const BASE_FILL: Record<string, string> = { A: '#e2675c', T: '#e9b03c', U: '#e9b03c', G: '#4fb26c', C: '#5b9ae0' };
const BASE_INK = '#121212';
const AA_COLOR: Record<AaClass, string> = {
  hidrofóbico: 'var(--series-6)', 'polar sin carga': 'var(--series-3)', 'cargado (+)': 'var(--series-2)', 'cargado (−)': 'var(--series-7)', terminación: 'var(--ink-2)',
};
const BASES: Base[] = ['A', 'T', 'G', 'C'];
const RNA_PAIR: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' };

/* ------------------------------------------------------------------ geometría de la escena principal */
const W = 900, H = 474;
const VIEW = `0 0 ${W} ${H}`;
const NUC = { x: 20, y: 16, w: 612, h: 216 };
const G0 = 40, G1 = 616;
const gx = (p: number) => G0 + ((p - 1) / GENE_LENGTH) * (G1 - G0);
const DNA_Y = 94;
const PRE_Y = 188, PRE_X0 = 56, PRE_W = 520;
const ENV_Y = 242;
const TR_Y = 398;
const RIBO_X = 300;
const CW = 39; // ancho de un codón en la vista del ribosoma
const XA = RIBO_X + CW, XE = RIBO_X - CW;
const GEL = { x0: 696, x1: 868, y0: 290, y1: 424 };
const LANES = [GEL.x0 + 30, GEL.x0 + 86, GEL.x0 + 142];
const MARKERS = [35, 25, 15, 10, 5, 2.5];
const BENCH_Y = 448;

/* Fases de la animación (fracción del tiempo total). */
const DURATION = 7600;
const TX: [number, number] = [0, 0.3];
const CAP: [number, number] = [0.04, 0.1];
const TAIL: [number, number] = [0.3, 0.36];
const SPL: [number, number] = [0.38, 0.56];
const TL: [number, number] = [0.6, 1];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seg = (t: number, [a, b]: [number, number]) => clamp01((t - a) / (b - a));
const ease = (q: number) => q * q * (3 - 2 * q);

/* ------------------------------------------------------------------ geometría del editor de la hebra */
const WIN = 30, TW = 24, SX0 = 40;
const TILE_Y = 30, TILE_H = 30;
const STRIP_W = 900, STRIP_H = 150;
const CHIP = 34;
const CHIPS = BASES.map((b, i) => ({ b, x: 790 + (i % 2) * 44, y: 30 + Math.floor(i / 2) * 44 }));
const WIN_MAX = GENE_LENGTH - WIN + 1;

const PRE_SCALE = PRE_W / (GENE_LENGTH - SEGMENT_RANGES.ex1.start + 2);
const MODE_LABEL: Record<SplicingMode, string> = { constitutivo: 'Empalme normal', 'salto-exon2': 'Salto del exón 2' };
const KIND_LABEL: Record<MutationKind, string> = { sustitucion: 'Sustitución', insercion: 'Inserción', delecion: 'Deleción' };

type Phase = 'listo' | 'expresando' | 'medido';

function changeText(m: GeneMutation): string {
  const wt = GENE_SEQ[m.position - 1];
  if (m.kind === 'sustitucion') return `${wt}→${m.base}`;
  if (m.kind === 'insercion') return `+${m.base}`;
  return `−${wt}`;
}
const signed = (n: number) => (n > 0 ? `+${fmt(n, 0)}` : fmt(n, 0));
const three = (aa: string) => AMINO_ACIDS[aa]?.three ?? '?';

const WT_LOC = Array.from({ length: GENE_LENGTH }, (_, i) => locate(i + 1));

/** Región (para el color de la banda de anotación) de una base del gen silvestre. */
function regionColor(p: number): string {
  const r = WT_LOC[p - 1].region;
  if (r === 'promotor') return PROMOTER_ELEMENTS.some((e) => p >= e.start && p <= e.end) ? 'var(--warn)' : 'var(--amb)';
  if (r === 'cds') return 'var(--bio)';
  if (r === 'utr5' || r === 'utr3') return p >= POLYA_SIGNAL.start && p <= POLYA_SIGNAL.end ? 'var(--warn)' : 'var(--series-5)';
  if (r === 'sitio-donador' || r === 'sitio-aceptor') return 'var(--bad)';
  return 'var(--line)';
}
const REGION_COLORS = Array.from({ length: GENE_LENGTH }, (_, i) => regionColor(i + 1));

/* ------------------------------------------------------------------ piezas de la escena */

/** ARN polimerasa II: complejo globular con la hendidura donde entra el ADN. */
function Polymerase({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g aria-hidden="true">
      <ellipse cx={x + 2} cy={y + 20} rx={22} ry={4} fill="#000" opacity="0.12" />
      <path d={`M${x - 20} ${y - 2} C${x - 24} ${y - 22} ${x - 4} ${y - 30} ${x + 8} ${y - 24} C${x + 24} ${y - 20} ${x + 26} ${y - 6} ${x + 20} ${y + 2} C${x + 26} ${y + 12} ${x + 12} ${y + 20} ${x} ${y + 16} C${x - 14} ${y + 20} ${x - 24} ${y + 10} ${x - 20} ${y - 2} Z`}
        fill="var(--qui)" fillOpacity="0.82" stroke="var(--qui)" strokeWidth="1.2" />
      <path d={`M${x - 14} ${y - 14} C${x - 8} ${y - 22} ${x + 6} ${y - 22} ${x + 12} ${y - 14}`} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      {active && <circle cx={x + 6} cy={y - 4} r={3} fill="#fff" opacity="0.8" />}
    </g>
  );
}

/** ARN de transferencia simplificado (forma de L vista de frente) con su anticodón y su aminoácido. */
function Trna({ x, codon, aa, label }: { x: number; codon: string; aa: string; label: string }) {
  const top = TR_Y - 86;
  const anti = [...codon].map((b) => RNA_PAIR[b] ?? '?');
  const cls = aaClass(aa);
  return (
    <g aria-hidden="true">
      <path d={`M${x - 15} ${TR_Y - 12} L${x - 15} ${TR_Y - 34} Q${x - 15} ${TR_Y - 44} ${x - 6} ${TR_Y - 48} L${x - 6} ${top + 14} Q${x - 6} ${top + 4} ${x + 4} ${top + 4} L${x + 12} ${top + 4} Q${x + 18} ${top + 4} ${x + 18} ${top + 12} L${x + 18} ${top + 22} L${x + 6} ${top + 22} L${x + 6} ${TR_Y - 48} Q${x + 15} ${TR_Y - 44} ${x + 15} ${TR_Y - 34} L${x + 15} ${TR_Y - 12} Z`}
        fill="var(--series-5)" fillOpacity="0.28" stroke="var(--series-5)" strokeWidth="1.3" />
      {anti.map((b, i) => (
        <g key={i}>
          <rect x={x - 18 + i * 12.5} y={TR_Y - 25} width={11.5} height={12} rx={2} fill={BASE_FILL[b]} />
          <text x={x - 12.25 + i * 12.5} y={TR_Y - 15.5} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{b}</text>
        </g>
      ))}
      <circle cx={x + 6} cy={top - 4} r={10} fill={AA_COLOR[cls]} fillOpacity="0.3" stroke={AA_COLOR[cls]} strokeWidth="1.6" />
      <text x={x + 6} y={top - 0.5} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 700, fill: 'var(--ink)' }}>{three(aa)}</text>
      <text x={x === RIBO_X ? x + 8 : x - 8} y={TR_Y + 48} textAnchor={x === RIBO_X ? 'end' : 'start'} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{label}</text>
    </g>
  );
}

/** Pre-ARNm / ARNm: segmentos con caperuza y cola, y el empalme animado. */
function Transcript({ segs, q, cap, tail, u, done, startIdx, endIdx, mutX }: {
  segs: { id: string; kind: string; x: number; w: number; keep: boolean; tx: number }[];
  q: number; cap: number; tail: number; u: number; done: boolean; startIdx: number; endIdx: number; mutX: number | null;
}) {
  const preEnd = segs.length ? segs[segs.length - 1].x + segs[segs.length - 1].w : PRE_X0;
  const kept = segs.filter((s) => s.keep);
  const matEnd = kept.length ? kept[kept.length - 1].tx + kept[kept.length - 1].w : PRE_X0;
  const e = ease(u);
  const end = preEnd + (matEnd - preEnd) * e;
  const clipW = Math.max(0, (preEnd - PRE_X0) * q);
  return (
    <g aria-hidden="true">
      <clipPath id="exp-clip-pre"><rect x={PRE_X0 - 2} y={PRE_Y - 60} width={clipW + 4} height={100} /></clipPath>
      <g clipPath="url(#exp-clip-pre)">
        <line x1={PRE_X0} x2={end} y1={PRE_Y} y2={PRE_Y} stroke="var(--data)" strokeWidth="2" />
        {segs.map((s) => {
          const x = s.keep ? s.x + (s.tx - s.x) * e : s.x;
          const lift = s.keep ? 0 : -26 * e;
          const op = s.keep ? 1 : 1 - e;
          if (op <= 0.01) return null;
          if (s.kind === 'exon') {
            return (
              <g key={s.id} opacity={op} transform={`translate(0 ${lift})`}>
                <rect x={x} y={PRE_Y - 8} width={s.w} height={16} rx={3} fill="var(--bio)" fillOpacity="0.88" />
                <rect x={x} y={PRE_Y - 8} width={s.w} height={5} rx={2} fill="#fff" opacity="0.22" />
              </g>
            );
          }
          const mid = x + s.w / 2;
          return (
            <g key={s.id} opacity={op}>
              <path d={u > 0 && !s.keep
                ? `M${x} ${PRE_Y} C${x + s.w * 0.1} ${PRE_Y - 40 * e} ${mid - 20} ${PRE_Y - 46 * e} ${mid} ${PRE_Y - 44 * e} C${mid + 20} ${PRE_Y - 46 * e} ${x + s.w * 0.9} ${PRE_Y - 40 * e} ${x + s.w} ${PRE_Y}`
                : `M${x} ${PRE_Y} L${x + s.w} ${PRE_Y}`}
                fill="none" stroke="var(--ink-2)" strokeWidth="4" strokeOpacity="0.55" strokeLinecap="round" />
              {u > 0 && !s.keep && <circle cx={mid} cy={PRE_Y - 44 * e} r={4} fill="var(--ink-2)" opacity="0.6" />}
            </g>
          );
        })}
        {mutX !== null && q >= 1 && u === 0 && <path d={`M${mutX} ${PRE_Y - 14} l-4 -6 h8 z`} fill="var(--bad)" />}
      </g>
      {cap > 0 && (
        <g opacity={cap}>
          <circle cx={PRE_X0 - 9} cy={PRE_Y} r={7} fill="var(--series-1)" stroke="var(--surface)" strokeWidth="1.5" />
          <text x={PRE_X0 - 9} y={PRE_Y + 22} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>caperuza 5′</text>
        </g>
      )}
      {tail > 0 && (
        <g opacity={tail}>
          <path d={`M${end} ${PRE_Y} ${Array.from({ length: 6 }, (_, i) => `q 4 ${i % 2 ? 5 : -5} 8 0`).join(' ')}`} fill="none" stroke="var(--data)" strokeWidth="2.4" />
          <text x={end + 26} y={PRE_Y - 9} textAnchor="middle" style={{ fontSize: 9, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>AAAA…</text>
          <text x={end + 26} y={PRE_Y + 22} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>cola de poli-A</text>
        </g>
      )}
      {done && startIdx >= 0 && (
        <g>
          {[[startIdx, 'AUG'], [endIdx, 'fin']].map(([i, t]) => (i as number) >= 0 && (
            <g key={t as string}>
              <line x1={PRE_X0 + (i as number) * PRE_SCALE} x2={PRE_X0 + (i as number) * PRE_SCALE} y1={PRE_Y - 12} y2={PRE_Y + 12} stroke="var(--ink)" strokeWidth="1.4" />
              <text x={PRE_X0 + (i as number) * PRE_SCALE} y={PRE_Y - 15} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 700, fill: 'var(--ink)' }}>{t as string}</text>
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ editor de la hebra: base y ficha arrastrables */

type DragAction = { kind: 'sustitucion'; base: Base } | { kind: 'delecion' } | null;
function dragAction(base: string, dy: number): DragAction {
  if (dy > 30) return { kind: 'delecion' };
  if (dy < -12) {
    const others = BASES.filter((b) => b !== base);
    return { kind: 'sustitucion', base: others[Math.floor((-dy - 12) / 18) % 3] };
  }
  return null;
}

interface TileProps {
  pos: number; x: number; base: string; selected: boolean; label: string;
  overlay: { sub?: string; del?: boolean } | null;
  onSelect: (p: number) => void;
  onAction: (p: number, a: Exclude<DragAction, null>) => void;
  onKey: (e: KeyboardEvent<SVGGElement>, p: number) => void;
  register: (p: number, el: SVGGElement | null) => void;
}

function BaseTile({ pos, x, base, selected, label, overlay, onSelect, onAction, onKey, register }: TileProps) {
  const [startY, setStartY] = useState(0);
  const { dragging, point, handlers } = useSvgDrag<SVGGElement>({
    onStart: (p) => { setStartY(p.y); onSelect(pos); },
    onMove: () => undefined,
    onEnd: ({ start, point: p }) => { const a = dragAction(base, p.y - start.y); if (a) onAction(pos, a); },
  });
  const preview = dragging && point ? dragAction(base, point.y - startY) : null;
  const dy = dragging && point ? Math.max(-40, Math.min(44, point.y - startY)) : 0;
  const shown = preview?.kind === 'sustitucion' ? preview.base : overlay?.sub ?? base;
  const deleted = preview?.kind === 'delecion' || overlay?.del;
  return (
    <g ref={(el) => register(pos, el)} role="button" tabIndex={selected ? 0 : -1} aria-label={label} aria-pressed={selected}
      className={`manip${dragging ? ' dragging' : ''}`} style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', outline: 'none' }}
      onKeyDown={(e) => onKey(e, pos)} onFocus={() => onSelect(pos)} {...handlers}>
      <rect x={x} y={TILE_Y - 4} width={TW} height={TILE_H + 8} fill="transparent" />
      <g transform={`translate(0 ${dy})`} opacity={deleted ? 0.4 : 1}>
        <rect x={x + 1.5} y={TILE_Y} width={TW - 3} height={TILE_H} rx={4} fill={BASE_FILL[shown]} stroke={overlay || preview ? 'var(--bad)' : 'rgba(0,0,0,0.25)'} strokeWidth={overlay || preview ? 2 : 0.8}
          strokeDasharray={deleted ? '3 2' : undefined} />
        <rect x={x + 3} y={TILE_Y + 2} width={TW - 6} height={7} rx={3} fill="#fff" opacity="0.28" />
        <text x={x + TW / 2} y={TILE_Y + 20} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{shown}</text>
        {deleted && <line x1={x + 3} x2={x + TW - 3} y1={TILE_Y + TILE_H - 3} y2={TILE_Y + 3} stroke="var(--bad)" strokeWidth="2" />}
      </g>
      {overlay?.sub && !preview && <text x={x + TW / 2} y={TILE_Y - 6} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', textDecoration: 'line-through', fontFamily: 'var(--font-data)' }}>{base}</text>}
      {selected && <rect x={x - 0.5} y={TILE_Y - 2.5 + dy} width={TW + 1} height={TILE_H + 5} rx={6} fill="none" stroke="var(--accent)" strokeWidth="2.4" />}
    </g>
  );
}

function PaletteChip({ b, x, y, onDrop, onPress, preview }: {
  b: Base; x: number; y: number; onDrop: (b: Base, px: number, py: number) => void; onPress: (b: Base) => void;
  preview: (b: Base, p: { x: number; y: number } | null) => void;
}) {
  const { dragging, point, handlers } = useSvgDrag<SVGGElement>({
    onMove: ({ point: p }) => preview(b, p),
    onEnd: ({ point: p }) => { preview(b, null); onDrop(b, p.x, p.y); },
  });
  const gx0 = dragging && point ? point.x - CHIP / 2 : x;
  const gy0 = dragging && point ? point.y - CHIP / 2 : y;
  return (
    <g role="button" tabIndex={0} aria-label={`Insertar la base ${b} antes de la base seleccionada`} className={`manip${dragging ? ' dragging' : ''}`}
      style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress(b); } }} {...handlers}>
      <rect x={x} y={y} width={CHIP} height={CHIP} rx={7} fill="var(--surface)" stroke="var(--line)" strokeDasharray={dragging ? '3 2' : undefined} />
      <g transform={`translate(${gx0 - x} ${gy0 - y})`}>
        <rect x={x + 3} y={y + 3} width={CHIP - 6} height={CHIP - 6} rx={5} fill={BASE_FILL[b]} stroke="rgba(0,0,0,0.25)" />
        <text x={x + CHIP / 2} y={y + CHIP / 2 + 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{b}</text>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function ExpressionLab({ api }: LabProps) {
  const [mode, setMode] = useState<SplicingMode>('constitutivo');
  const [mutation, setMutation] = useState<GeneMutation | null>(null);
  const [sel, setSel] = useState(CDS_START + 19);
  const [win, setWin] = useState(CDS_START + 19 - 12);
  const [mType, setMType] = useState<MutationKind>('sustitucion');
  const [newBase, setNewBase] = useState<Base>('T');
  const [goto, setGoto] = useState('hbs');
  const [msg, setMsg] = useState('');
  const [phase, setPhase] = useState<Phase>('listo');
  const [t, setT] = useState(0);
  const [insPreview, setInsPreview] = useState<number | null>(null);
  const raf = useRef(0);
  const tiles = useRef(new Map<number, SVGGElement>());
  const focusPending = useRef(false);

  /* --------------------------- modelo */
  const wild = useMemo(() => expressGene(null, mode), [mode]);
  const analysis = useMemo(() => (mutation ? analyzeGeneMutation(mutation, mode) : null), [mutation, mode]);
  const cur = analysis ? analysis.mutant : wild;
  const selLoc = useMemo(() => locate(sel, mode), [sel, mode]);
  const done = phase === 'medido';

  /* --------------------------- fases */
  const reset = () => { cancelAnimationFrame(raf.current); setPhase('listo'); setT(0); };
  useEffect(reset, [mutation, mode]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const nCodons = cur.translation.codons.length;
  useEffect(() => {
    if (phase !== 'expresando') return;
    if (prefersReducedMotion()) { setT(1); setPhase('medido'); return; }
    const start = performance.now();
    let spliced = false, lastTick = -1;
    const tick = (now: number) => {
      const q = clamp01(Math.max(0, now - start) / DURATION);
      setT(q);
      if (!spliced && q >= SPL[0]) { spliced = true; playSound('whoosh', { volume: 0.25 }); }
      const k = Math.floor(seg(q, TL) * Math.max(0, nCodons - 1) / 12);
      if (q >= TL[0] && k !== lastTick) { lastTick = k; playSound('tick', { volume: 0.18, freq: 1500 }); }
      if (q >= 1) { setPhase('medido'); playSound('beep', { volume: 0.3, freq: 2200 }); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, nCodons]);

  const express = () => { cancelAnimationFrame(raf.current); playSound('click'); setT(0); setPhase('expresando'); };
  const skip = () => { cancelAnimationFrame(raf.current); setT(1); setPhase('medido'); playSound('beep', { volume: 0.3, freq: 2200 }); };

  /* --------------------------- selección y mutaciones */
  const moveSel = (p: number, focus = false) => {
    const q = Math.max(1, Math.min(GENE_LENGTH, Math.round(p)));
    setSel(q);
    setWin((w) => (q < w ? q : q >= w + WIN ? q - WIN + 1 : w));
    if (focus) focusPending.current = true;
  };
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    tiles.current.get(sel)?.focus({ preventScroll: true });
  }, [sel, win]);

  const apply = (m: GeneMutation) => {
    try {
      validateMutation(m);
      setMutation(m);
      const loc = locate(m.position, mode);
      setMsg(`${KIND_LABEL[m.kind]} ${changeText(m)} en la base ${m.position} (${loc.regionName}${loc.codon ? `, codón ${loc.codon}` : ''}). Pulsa «Expresar el gen» para ver su efecto.`);
      playSound(m.kind === 'delecion' ? 'thunk' : 'drop', { volume: 0.35 });
    } catch (e) {
      setMsg((e as Error).message);
      playSound('error');
    }
  };
  const applyPanel = () => apply(mType === 'delecion' ? { kind: 'delecion', position: sel } : { kind: mType, position: sel, base: newBase });
  const restore = () => { setMutation(null); setMsg('Gen silvestre restaurado.'); playSound('click'); };

  const onTileKey = (e: KeyboardEvent<SVGGElement>, p: number) => {
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); moveSel(p + (k === 'ArrowRight' ? 1 : -1), true); return; }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); moveSel(p + (k === 'PageDown' ? WIN : -WIN), true); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); apply({ kind: 'delecion', position: p }); return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); applyPanel(); return; }
    const up = k.length === 1 ? k.toUpperCase() : '';
    if (BASES.includes(up as Base)) {
      e.preventDefault();
      apply(e.shiftKey ? { kind: 'insercion', position: p, base: up as Base } : { kind: 'sustitucion', position: p, base: up as Base });
    }
  };
  const gapAt = (px: number, py: number) => {
    if (py < TILE_Y - 24 || py > TILE_Y + TILE_H + 30 || px < SX0 - TW / 2 || px > SX0 + WIN * TW) return null;
    const idx = Math.max(0, Math.min(WIN - 1, Math.round((px - SX0) / TW)));
    return win + idx;
  };

  /* --------------------------- geometría memorizada */
  const preSegs = useMemo(() => {
    const segs = cur.segments.filter((s) => s.kind !== 'promotor');
    const kept = new Set<string>(cur.splicing.parts);
    let x = PRE_X0, tx = PRE_X0;
    return segs.map((s: GeneSegment) => {
      const w = s.seq.length * PRE_SCALE;
      const o = { id: s.id, kind: s.kind, x, w, keep: kept.has(s.id), tx };
      x += w; if (o.keep) tx += w;
      return o;
    });
  }, [cur]);

  const geneMap = useMemo(() => {
    const ex = HBB_SEGMENTS.filter((s) => s.kind === 'exon').map((s) => {
      const r = SEGMENT_RANGES[s.id];
      const cdsFrom = s.id === 'ex1' ? CDS_START : r.start;
      const cdsTo = s.id === 'ex3' ? r.start + 128 : r.end;
      return { id: s.id, name: s.name, r, cdsFrom, cdsTo };
    });
    return { ex };
  }, []);

  /* --------------------------- animación: estado derivado */
  const tt = phase === 'listo' ? 0 : t;
  const qTx = seg(tt, TX);
  const polX = phase === 'listo' || done ? gx(TSS) - 6 : gx(TSS + qTx * (GENE_LENGTH - TSS));
  const capQ = seg(tt, CAP), tailQ = seg(tt, TAIL), splQ = seg(tt, SPL), tlQ = seg(tt, TL);
  const translating = tt >= TL[0] && nCodons > 0;
  const kf = done ? Math.max(0, nCodons - 1) : tlQ * Math.max(0, nCodons - 1);
  const aIdx = Math.round(kf);
  const codons = cur.translation.codons;
  const chain = codons.slice(0, aIdx).map((c) => c.aa).filter((a) => a !== '*');
  const aCodon = codons[aIdx];
  const pCodon = aIdx > 0 ? codons[aIdx - 1] : null;
  const mutCodon = analysis?.location.codon ?? null;
  const expressionPct = analysis ? analysis.expressionPercent : 100;
  const glyphs = Math.round(cur.expression * 10);
  const mutX = mutation ? gx(mutation.position) : null;
  const mutPreX = mutation && mutation.position >= TSS ? PRE_X0 + (mutation.position - TSS) * PRE_SCALE : null;
  const tataHit = analysis?.cls === 'promotor' && analysis.expressionPercent < 100;

  /* --------------------------- textos */
  const show = (s: string) => (done ? s : '—');
  const aaChange = analysis?.codonChange
    ? `${three(analysis.codonChange.aaFrom)} → ${three(analysis.codonChange.aaTo)} (${analysis.codonChange.classFrom} → ${analysis.codonChange.classTo})`
    : '—';
  const desc = `Núcleo con el gen HBB: promotor con cajas CACCC, CCAAT y TATA, tres exones y dos intrones${mutation ? `; mutación ${changeText(mutation)} en la base ${mutation.position}` : ''}. `
    + (done
      ? `La ARN polimerasa II transcribió un pre-ARNm de ${cur.preMrnaLength} nucleótidos; tras la caperuza, la cola de poli-A y el empalme (${cur.splicing.pattern}) quedó un ARNm de ${cur.mrnaLength} nucleótidos. En el citoplasma, el ribosoma tradujo una proteína de ${cur.proteinLength} aminoácidos. El gel compara la proteína silvestre y la mutante.`
      : 'Pulsa «Expresar el gen» para ver la transcripción, el procesamiento del ARN y la traducción.');

  const record = () => {
    api.addTrial('expresion', {
      empalme: MODE_LABEL[mode],
      tipo: mutation ? KIND_LABEL[mutation.kind] : 'Ninguna (silvestre)',
      posicion: mutation ? mutation.position : null,
      cambio: mutation ? changeText(mutation) : '—',
      region: analysis ? analysis.location.regionName : '—',
      codon: analysis?.location.codon ?? null,
      clase: analysis ? analysis.label : 'Gen silvestre',
      aminoacido: aaChange,
      preArnm: cur.preMrnaLength,
      arnm: cur.mrnaLength,
      proteina: cur.proteinLength,
      identidad: analysis ? analysis.identity : 100,
      aaCambiados: analysis ? analysis.changedAa : 0,
      expresion: expressionPct,
    });
  };

  const winBases = Array.from({ length: WIN }, (_, j) => win + j).filter((p) => p <= GENE_LENGTH);
  const codonGroups = useMemo(() => {
    const groups: { codon: number; x0: number; x1: number; aa: string }[] = [];
    for (let j = 0; j < WIN; j++) {
      const p = win + j;
      const l = WT_LOC[p - 1];
      if (!l || l.region !== 'cds' || l.codon === null) continue;
      const last = groups[groups.length - 1];
      if (last && last.codon === l.codon) last.x1 = SX0 + (j + 1) * TW;
      else groups.push({ codon: l.codon, x0: SX0 + j * TW, x1: SX0 + (j + 1) * TW, aa: wild.translation.codons[l.codon - 1]?.aa ?? '?' });
    }
    return groups;
  }, [win, wild]);

  const tileLabel = (p: number) => {
    const l = WT_LOC[p - 1];
    return `Base ${p}: ${GENE_SEQ[p - 1]}, ${l.regionName}${l.codon ? `, codón ${l.codon}` : ''}${mutation?.position === p ? ` (mutada: ${changeText(mutation)})` : ''}`;
  };

  const band = (lengthAa: number) => {
    const rf = gelMigration(lengthAa);
    return rf === null ? null : GEL.y0 + 10 + rf * (GEL.y1 - GEL.y0 - 16);
  };
  const wildBand = band(wild.proteinLength);
  const mutBand = analysis ? band(analysis.mutant.proteinLength) : null;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco de trabajo: expresión del gen de la β-globina">
          <svg viewBox={VIEW} role="img" aria-labelledby="exp-t exp-d">
            <title id="exp-t">Expresión del gen HBB: núcleo, citoplasma y electroforesis</title>
            <desc id="exp-d">{desc}</desc>
            <defs>
              <linearGradient id="exp-nuc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--qui)" stopOpacity="0.07" />
                <stop offset="1" stopColor="var(--qui)" stopOpacity="0.03" />
              </linearGradient>
              <linearGradient id="exp-gel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e9eff7" />
                <stop offset="1" stopColor="#d5e0ee" />
              </linearGradient>
            </defs>

            {/* célula: citoplasma y núcleo */}
            <rect x={8} y={6} width={632} height={462} rx={26} fill="var(--surface-2)" stroke="var(--line)" />
            <rect x={NUC.x} y={NUC.y} width={NUC.w} height={NUC.h} rx={20} fill="url(#exp-nuc)" stroke="var(--qui)" strokeOpacity="0.55" strokeWidth="1.5" />
            <rect x={NUC.x + 4} y={NUC.y + 4} width={NUC.w - 8} height={NUC.h - 8} rx={17} fill="none" stroke="var(--qui)" strokeOpacity="0.3" strokeDasharray="1 0" />
            {[150, 330, 500].map((px) => <rect key={px} x={px} y={NUC.y + NUC.h - 6} width={14} height={12} rx={4} fill="var(--surface-2)" stroke="var(--qui)" strokeOpacity="0.5" />)}
            <text x={NUC.x + 14} y={NUC.y + 20} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink-2)', letterSpacing: 0.5 }}>NÚCLEO · gen HBB (cromosoma 11), {GENE_LENGTH} pb</text>
            <text x={616} y={ENV_Y + 22} textAnchor="end" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink-2)', letterSpacing: 0.5 }}>CITOPLASMA · traducción en el ribosoma</text>

            {/* gen: doble hebra, promotor, exones, intrones */}
            <g aria-hidden="true">
              <line x1={G0} x2={G1} y1={DNA_Y - 2.5} y2={DNA_Y - 2.5} stroke="var(--ink-2)" strokeWidth="1.6" />
              <line x1={G0} x2={G1} y1={DNA_Y + 2.5} y2={DNA_Y + 2.5} stroke="var(--ink-2)" strokeWidth="1.6" />
              <text x={G0 - 4} y={DNA_Y - 6} textAnchor="end" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>5′</text>
              <text x={G1 + 4} y={DNA_Y - 6} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>3′</text>
              <text x={(gx(1) + gx(TSS)) / 2} y={DNA_Y - 30} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: 'var(--amb)' }}>Promotor</text>
              {PROMOTER_ELEMENTS.map((el) => (
                <g key={el.id}>
                  <rect x={gx(el.start)} y={DNA_Y - 6} width={Math.max(4, gx(el.end + 1) - gx(el.start))} height={12} rx={2} fill="var(--warn)" fillOpacity="0.85" />
                  <text x={(gx(el.start) + gx(el.end + 1)) / 2} y={DNA_Y + (el.id === 'ccaat' ? 30 : 20)} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>{el.id === 'tata' ? 'TATA' : el.id === 'ccaat' ? 'CCAAT' : 'CACCC'}</text>
                </g>
              ))}
              <path d={`M${gx(TSS)} ${DNA_Y - 6} v-34 h10`} fill="none" stroke="var(--ink)" strokeWidth="1.4" />
              <path d={`M${gx(TSS) + 10} ${DNA_Y - 43} l5 3 l-5 3 z`} fill="var(--ink)" />
              <text x={gx(TSS) - 3} y={DNA_Y - 43} textAnchor="end" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>+1</text>
              {geneMap.ex.map((e) => (
                <g key={e.id}>
                  <rect x={gx(e.r.start)} y={DNA_Y - 6} width={gx(e.r.end + 1) - gx(e.r.start)} height={12} rx={2} fill="var(--bio)" fillOpacity="0.45" />
                  <rect x={gx(e.cdsFrom)} y={DNA_Y - 10} width={gx(e.cdsTo + 1) - gx(e.cdsFrom)} height={20} rx={3} fill="var(--bio)" />
                  <rect x={gx(e.cdsFrom)} y={DNA_Y - 10} width={gx(e.cdsTo + 1) - gx(e.cdsFrom)} height={6} rx={3} fill="#fff" opacity="0.2" />
                  <text x={(gx(e.r.start) + gx(e.r.end + 1)) / 2} y={DNA_Y - 30} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: 'var(--bio)' }}>{e.name}</text>
                </g>
              ))}
              {(['in1', 'in2'] as const).map((id) => (
                <text key={id} x={(gx(SEGMENT_RANGES[id].start) + gx(SEGMENT_RANGES[id].end + 1)) / 2} y={DNA_Y - 14} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{id === 'in1' ? 'Intrón 1' : 'Intrón 2'}</text>
              ))}
              <path d={`M${gx(IVS2_JOIN) - 4} ${DNA_Y + 8} l5 -16 M${gx(IVS2_JOIN) + 1} ${DNA_Y + 8} l5 -16`} stroke="var(--ink)" strokeWidth="1.3" />
              <rect x={gx(POLYA_SIGNAL.start)} y={DNA_Y - 6} width={Math.max(4, gx(POLYA_SIGNAL.end + 1) - gx(POLYA_SIGNAL.start))} height={12} fill="var(--warn)" />
              <text x={gx(POLYA_SIGNAL.start)} y={DNA_Y + 20} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>AATAAA</text>
              {/* ventana del editor */}
              <rect x={gx(win)} y={DNA_Y + 26} width={gx(win + WIN) - gx(win)} height={5} rx={2} fill="var(--data)" opacity="0.75" />
              <text x={gx(win + WIN) + 4} y={DNA_Y + 32} style={{ fontSize: 8.5, fill: 'var(--ink-2)' }}>editor</text>
              {mutX !== null && (
                <g>
                  <line x1={mutX} x2={mutX} y1={DNA_Y - 12} y2={DNA_Y + 12} stroke="var(--bad)" strokeWidth="2" />
                  <path d={`M${mutX} ${DNA_Y - 12} l-5 -8 h10 z`} fill="var(--bad)" />
                </g>
              )}
              {/* TFIID sobre la caja TATA y la polimerasa */}
              <ellipse cx={(gx(PROMOTER_ELEMENTS[2].start) + gx(PROMOTER_ELEMENTS[2].end)) / 2} cy={tataHit && done ? DNA_Y - 22 : DNA_Y - 12} rx={9} ry={6}
                fill="var(--amb)" fillOpacity={tataHit && done ? 0.35 : 0.8} stroke="var(--amb)" />
              <Polymerase x={polX} y={DNA_Y - 4} active={phase === 'expresando' && qTx < 1} />
              {phase === 'expresando' && qTx > 0 && qTx < 1 && (
                <path d={`M${polX - 14} ${DNA_Y + 10} q -8 12 -18 10 q -10 -2 -16 8`} fill="none" stroke="var(--data)" strokeWidth="2" />
              )}
              <text x={phase !== 'expresando' ? polX : Math.min(polX, G1 - 30)} y={DNA_Y + 52} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--qui)', fontWeight: 700 }}>ARN polimerasa II</text>
            </g>

            {/* ARN: pre-ARNm → ARNm maduro */}
            <text x={PRE_X0 - 18} y={PRE_Y - 26} style={{ fontSize: 10, fontWeight: 700, fill: 'var(--ink-2)' }}>
              {tt === 0 ? 'ARN (aparece al expresar el gen)' : splQ >= 1 ? `ARNm maduro (${cur.splicing.pattern}): ${cur.mrnaLength} nt` : `pre-ARNm: ${cur.preMrnaLength} nt`}
            </text>
            {tt === 0 && <line x1={PRE_X0} x2={PRE_X0 + PRE_W} y1={PRE_Y} y2={PRE_Y} stroke="var(--line)" strokeDasharray="4 4" />}
            {tt > 0 && (
              <Transcript segs={preSegs} q={qTx} cap={capQ} tail={tailQ} u={splQ} done={splQ >= 1}
                startIdx={cur.translation.startIndex} endIdx={cur.translation.startIndex >= 0 ? cur.translation.startIndex + nCodons * 3 : -1} mutX={mutPreX} />
            )}
            {splQ > 0 && splQ < 1 && <text x={PRE_X0 + PRE_W / 2} y={PRE_Y - 52} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>el espliceosoma retira los intrones en forma de lazo</text>}

            {/* citoplasma: ribosoma */}
            <g aria-hidden="true">
              {translating || done ? (
                <>
                  <line x1={24} x2={616} y1={TR_Y} y2={TR_Y} stroke="var(--data)" strokeWidth="2" />
                  <text x={26} y={TR_Y + 30} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>5′ ARNm</text>
                  <text x={614} y={TR_Y + 30} textAnchor="end" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>3′</text>
                  {/* subunidad mayor (detrás de los ARNt) */}
                  <path d={`M${RIBO_X - 86} ${TR_Y - 18} C${RIBO_X - 104} ${TR_Y - 70} ${RIBO_X - 70} ${TR_Y - 132} ${RIBO_X} ${TR_Y - 128} C${RIBO_X + 74} ${TR_Y - 132} ${RIBO_X + 112} ${TR_Y - 76} ${RIBO_X + 96} ${TR_Y - 18} Z`}
                    fill="var(--series-6)" fillOpacity="0.16" stroke="var(--series-6)" strokeWidth="1.5" />
                  {[['E', XE], ['P', RIBO_X], ['A', XA]].map(([s, x]) => (
                    <g key={s as string}>
                      <rect x={(x as number) - CW / 2 + 1} y={TR_Y - 118} width={CW - 2} height={100} rx={6} fill="var(--surface)" fillOpacity="0.35" />
                      <text x={x as number} y={TR_Y - 104} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: 'var(--ink-2)' }}>{s as string}</text>
                    </g>
                  ))}
                  {/* codones del ARNm que se desplazan */}
                  {codons.map((c, i) => {
                    const cx = XA + (i - kf) * CW;
                    if (cx < 20 || cx > 620) return null;
                    const changed = mutCodon !== null && i === mutCodon - 1;
                    return (
                      <g key={i}>
                        {[...c.codon].map((b, k) => (
                          <g key={k}>
                            <rect x={cx - CW / 2 + 1 + k * 12.5} y={TR_Y - 7} width={11.5} height={14} rx={2} fill={BASE_FILL[b]} />
                            <text x={cx - CW / 2 + 6.75 + k * 12.5} y={TR_Y + 4} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{b}</text>
                          </g>
                        ))}
                        {changed && <rect x={cx - CW / 2} y={TR_Y - 9} width={CW - 1} height={18} rx={3} fill="none" stroke="var(--bad)" strokeWidth="2" />}
                        <text x={cx} y={TR_Y + 19} textAnchor="middle" style={{ fontSize: 8.5, fill: c.aa === '*' ? 'var(--bad)' : 'var(--ink-2)', fontWeight: c.aa === '*' ? 700 : 400 }}>{c.aa === '*' ? 'stop' : three(c.aa)}</text>
                      </g>
                    );
                  })}
                  {/* subunidad menor */}
                  <path d={`M${RIBO_X - 78} ${TR_Y + 8} C${RIBO_X - 80} ${TR_Y + 40} ${RIBO_X + 86} ${TR_Y + 40} ${RIBO_X + 86} ${TR_Y + 8} Z`} fill="var(--series-6)" fillOpacity="0.32" stroke="var(--series-6)" strokeWidth="1.5" />
                  {/* ARNt y cadena */}
                  {pCodon && pCodon.aa !== '*' && <Trna x={RIBO_X} codon={pCodon.codon} aa={pCodon.aa} label="ARNt (sitio P)" />}
                  {aCodon && aCodon.aa !== '*' && <Trna x={XA} codon={aCodon.codon} aa={aCodon.aa} label="ARNt entrante (A)" />}
                  {aCodon && aCodon.aa === '*' && (
                    <g>
                      <rect x={XA - 14} y={TR_Y - 76} width={28} height={64} rx={8} fill="var(--bad)" fillOpacity="0.2" stroke="var(--bad)" strokeWidth="1.4" />
                      <text x={XA} y={TR_Y - 40} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: 'var(--ink)' }}>FL</text>
                      <text x={XA - 8} y={TR_Y + 48} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>factor de liberación</text>
                    </g>
                  )}
                  {chain.slice(-16).reverse().map((aa, j) => {
                    const cx = RIBO_X + 6 - 15 - j * 13.5;
                    const cy = TR_Y - 126 - Math.sin(j * 0.75) * 6 - j * 1.2;
                    const cls = aaClass(aa);
                    return (
                      <g key={j}>
                        <circle cx={cx} cy={cy} r={6.6} fill={AA_COLOR[cls]} fillOpacity="0.3" stroke={AA_COLOR[cls]} strokeWidth="1.5" />
                        <text x={cx} y={cy + 3} textAnchor="middle" style={{ fontSize: 7.5, fontWeight: 700, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{aa}</text>
                      </g>
                    );
                  })}
                  <text x={RIBO_X + 118} y={TR_Y - 98} style={{ fontSize: 10, fontWeight: 700, fill: 'var(--ink)' }}>
                    {aCodon?.aa === '*' ? `Terminación: ${chain.length} aminoácidos` : `Codón ${aIdx + 1} · ${chain.length} aa unidos`}
                  </text>
                  <text x={RIBO_X + 118} y={TR_Y - 84} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{cur.translation.stopFound ? 'Anticodón ↔ codón: A–U, G–C' : 'Sin codón de terminación: el ribosoma llega al final'}</text>
                </>
              ) : (
                <>
                  <path d={`M${RIBO_X - 60} ${TR_Y - 30} C${RIBO_X - 74} ${TR_Y - 70} ${RIBO_X - 44} ${TR_Y - 110} ${RIBO_X + 6} ${TR_Y - 106} C${RIBO_X + 60} ${TR_Y - 110} ${RIBO_X + 84} ${TR_Y - 70} ${RIBO_X + 70} ${TR_Y - 30} Z`}
                    fill="var(--series-6)" fillOpacity="0.16" stroke="var(--series-6)" strokeWidth="1.5" />
                  <path d={`M${RIBO_X - 56} ${TR_Y + 2} C${RIBO_X - 58} ${TR_Y + 46} ${RIBO_X + 66} ${TR_Y + 46} ${RIBO_X + 66} ${TR_Y + 2} Z`} fill="var(--series-6)" fillOpacity="0.32" stroke="var(--series-6)" strokeWidth="1.5" />
                  <text x={RIBO_X + 5} y={TR_Y - 60} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>subunidad mayor</text>
                  <text x={RIBO_X + 5} y={TR_Y + 20} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>subunidad menor</text>
                  <text x={RIBO_X + 5} y={TR_Y - 124} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>
                    {phase === 'expresando' ? 'El ARNm maduro sale del núcleo por un poro…' : 'Ribosoma libre, esperando un ARNm'}
                  </text>
                </>
              )}
              {/* leyenda de propiedades */}
              {(['hidrofóbico', 'polar sin carga', 'cargado (+)', 'cargado (−)'] as AaClass[]).map((c, i) => (
                <g key={c}>
                  <circle cx={34 + i * 128} cy={458} r={5} fill={AA_COLOR[c]} fillOpacity="0.3" stroke={AA_COLOR[c]} strokeWidth="1.5" />
                  <text x={44 + i * 128} y={461.5} style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>{c}</text>
                </g>
              ))}
            </g>

            {/* lector de expresión */}
            <g aria-hidden="true">
              <rect x={652} y={16} width={236} height={210} rx={14} fill="url(#kit-body)" stroke="#a9b4b6" filter="url(#kit-shadow)" />
              <text x={770} y={38} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: '#2b3436' }}>ARNm maduro producido</text>
              <text x={770} y={52} textAnchor="middle" style={{ fontSize: 9, fill: '#3d4749' }}>por cada 10 del gen silvestre</text>
              <rect x={664} y={60} width={212} height={104} rx={8} fill="#f5f8f8" stroke="#c3cbcd" />
              {Array.from({ length: 10 }, (_, i) => {
                const x = 676 + (i % 5) * 40, y = 82 + Math.floor(i / 5) * 46;
                const on = done && i < glyphs;
                return (
                  <g key={i} opacity={on ? 1 : 0.4}>
                    <circle cx={x} cy={y} r={3.6} fill={on ? 'var(--series-1)' : 'none'} stroke={on ? 'none' : '#8a9496'} strokeDasharray={on ? undefined : '2 2'} />
                    <path d={`M${x + 3} ${y} q 6 -6 12 0 t 12 0`} fill="none" stroke={on ? '#256d2a' : '#8a9496'} strokeWidth={on ? 3 : 1.4} strokeDasharray={on ? undefined : '3 2'} />
                    <path d={`M${x + 27} ${y} q 2 3 4 0 q 2 -3 4 0`} fill="none" stroke={on ? '#c2410c' : '#8a9496'} strokeWidth="1.4" />
                  </g>
                );
              })}
              <Lcd x={684} y={176} w={172} h={34} text={done ? fmt(expressionPct, 0) : '---'} unit="%" />
            </g>

            {/* electroforesis de proteínas (SDS-PAGE) */}
            <g aria-hidden="true">
              <BenchTop y={BENCH_Y} x={648} width={244} />
              <ContactShadow x={664} y={BENCH_Y} w={212} />
              <rect x={664} y={428} width={212} height={20} rx={4} fill="url(#kit-body-dark)" filter="url(#kit-shadow)" />
              <circle cx={680} cy={438} r={4} fill="#1d1d1d" stroke="#555" /><circle cx={860} cy={438} r={4} fill="#c62828" stroke="#7a1010" />
              <rect x={GEL.x0 - 14} y={GEL.y0 - 26} width={GEL.x1 - GEL.x0 + 28} height={GEL.y1 - GEL.y0 + 36} rx={4} fill="url(#kit-glass)" stroke="var(--glass-edge, #9fb3bd)" />
              <rect x={GEL.x0} y={GEL.y0 - 6} width={GEL.x1 - GEL.x0} height={GEL.y1 - GEL.y0 + 6} fill="url(#exp-gel)" />
              <text x={(GEL.x0 + GEL.x1) / 2} y={GEL.y0 - 32} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: 'var(--ink)' }}>Gel de proteínas (SDS-PAGE)</text>
              {LANES.map((x, i) => (
                <g key={i}>
                  <rect x={x - 15} y={GEL.y0 - 6} width={30} height={7} fill="#b9c8da" />
                  <text x={x} y={GEL.y0 - 12} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: '#22324a' }}>{['M', 'Silv.', 'Mut.'][i]}</text>
                </g>
              ))}
              {MARKERS.map((m) => {
                const y = GEL.y0 + 10 + migrationForMass(m) * (GEL.y1 - GEL.y0 - 16);
                return (
                  <g key={m}>
                    <rect x={LANES[0] - 13} y={y - 1.6} width={26} height={3.2} rx={1.5} fill="#2b4c9b" opacity="0.7" />
                    <text x={GEL.x0 - 3} y={y + 3} textAnchor="end" style={{ fontSize: 8, fill: '#22324a' }}>{fmt(m, Number.isInteger(m) ? 0 : 1)}</text>
                  </g>
                );
              })}
              <text x={GEL.x0 - 3} y={GEL.y0 - 12} textAnchor="end" style={{ fontSize: 8, fill: '#22324a' }}>kDa</text>
              {done && wildBand !== null && <rect x={LANES[1] - 14} y={wildBand - 2.5} width={28} height={5} rx={2} fill="#1f3f8f" />}
              {done && analysis && mutBand !== null && (
                <rect x={LANES[2] - 14} y={mutBand - 2.5} width={28} height={5} rx={2} fill="#1f3f8f" opacity={Math.max(0.15, analysis.mutant.expression)} />
              )}
              {done && analysis && mutBand === null && <text x={LANES[2]} y={(GEL.y0 + GEL.y1) / 2} textAnchor="middle" style={{ fontSize: 8, fill: '#22324a' }}>sin banda</text>}
              {done && !analysis && <text x={LANES[2]} y={(GEL.y0 + GEL.y1) / 2} textAnchor="middle" style={{ fontSize: 8, fill: '#22324a' }}>—</text>}
              {done && analysis && proteinMassKDa(analysis.mutant.proteinLength) > 0 && proteinMassKDa(analysis.mutant.proteinLength) < GEL_RANGE_KDA[0] && (
                <text x={LANES[2]} y={GEL.y1 - 6} textAnchor="middle" style={{ fontSize: 7.5, fill: '#22324a' }}>salió</text>
              )}
            </g>
          </svg>
        </div>

        {/* editor de la hebra codificante */}
        <div className="card stack-sm" style={{ minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <h3>Hebra codificante: bases {win} a {Math.min(GENE_LENGTH, win + WIN - 1)}</h3>
          <div className="bench" style={{ padding: 4 }} tabIndex={0} role="region" aria-label="Hebra codificante del gen HBB">
            <svg viewBox={`0 0 ${STRIP_W} ${STRIP_H}`} role="group" aria-label="Editor de la hebra codificante (ventana de 30 bases)" style={{ touchAction: 'pan-y' }}>
              <text x={8} y={TILE_Y + 20} style={{ fontSize: 10, fill: 'var(--ink-2)' }} aria-hidden="true">5′</text>
              <text x={8} y={TILE_Y + 50} style={{ fontSize: 10, fill: 'var(--ink-2)' }} aria-hidden="true">3′</text>
              <text x={SX0 + WIN * TW + 6} y={TILE_Y + 20} style={{ fontSize: 10, fill: 'var(--ink-2)' }} aria-hidden="true">3′</text>
              <text x={SX0 + WIN * TW + 6} y={TILE_Y + 50} style={{ fontSize: 10, fill: 'var(--ink-2)' }} aria-hidden="true">5′</text>
              <g aria-hidden="true">
                {winBases.map((p, j) => (
                  <g key={p}>
                    {p % 10 === 0 && <text x={SX0 + j * TW + TW / 2} y={14} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{p}</text>}
                    <line x1={SX0 + j * TW + TW / 2} x2={SX0 + j * TW + TW / 2} y1={17} y2={p % 10 === 0 ? 24 : 21} stroke="var(--line)" />
                    <text x={SX0 + j * TW + TW / 2} y={TILE_Y + 50} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>
                      {({ A: 'T', T: 'A', G: 'C', C: 'G' } as Record<string, string>)[GENE_SEQ[p - 1]]}
                    </text>
                    <rect x={SX0 + j * TW} y={TILE_Y + 58} width={TW} height={6} fill={REGION_COLORS[p - 1]} opacity="0.85" />
                  </g>
                ))}
                {codonGroups.map((g) => (
                  <g key={g.codon}>
                    <path d={`M${g.x0 + 2} ${TILE_Y + 70} v4 H${g.x1 - 2} v-4`} fill="none" stroke="var(--ink-2)" />
                    <text x={(g.x0 + g.x1) / 2} y={TILE_Y + 88} textAnchor="middle" style={{ fontSize: 9.5, fill: g.aa === '*' ? 'var(--bad)' : 'var(--ink)', fontWeight: 700 }}>{g.aa === '*' ? 'stop' : three(g.aa)}</text>
                    {g.x1 - g.x0 >= TW * 3 && <text x={(g.x0 + g.x1) / 2} y={TILE_Y + 100} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>{g.codon}</text>}
                  </g>
                ))}
                <text x={SX0} y={STRIP_H - 6} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{`Región de la base ${sel}: ${selLoc.regionName}${selLoc.codon ? ` · codón ${selLoc.codon}, posición ${selLoc.codonPos}` : ''} · ${signed(relativeToTss(sel))} respecto al inicio de la transcripción`}</text>
              </g>
              {winBases.map((p, j) => (
                <BaseTile key={p} pos={p} x={SX0 + j * TW} base={GENE_SEQ[p - 1]} selected={p === sel} label={tileLabel(p)}
                  overlay={mutation && mutation.position === p && mutation.kind !== 'insercion' ? (mutation.kind === 'delecion' ? { del: true } : { sub: mutation.base }) : null}
                  onSelect={(q) => setSel(q)} onAction={(q, a) => apply(a.kind === 'delecion' ? { kind: 'delecion', position: q } : { kind: 'sustitucion', position: q, base: a.base })}
                  onKey={onTileKey} register={(q, el) => { if (el) tiles.current.set(q, el); else tiles.current.delete(q); }} />
              ))}
              {mutation?.kind === 'insercion' && mutation.position >= win && mutation.position < win + WIN && (
                <g aria-hidden="true">
                  <line x1={SX0 + (mutation.position - win) * TW} x2={SX0 + (mutation.position - win) * TW} y1={TILE_Y - 2} y2={TILE_Y + TILE_H + 2} stroke="var(--bad)" strokeWidth="2.4" />
                  <rect x={SX0 + (mutation.position - win) * TW - 8} y={TILE_Y - 22} width={16} height={17} rx={3} fill={BASE_FILL[mutation.base ?? 'A']} stroke="var(--bad)" strokeWidth="1.6" />
                  <text x={SX0 + (mutation.position - win) * TW} y={TILE_Y - 9} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{mutation.base}</text>
                </g>
              )}
              {insPreview !== null && (
                <line aria-hidden="true" x1={SX0 + (insPreview - win) * TW} x2={SX0 + (insPreview - win) * TW} y1={TILE_Y - 6} y2={TILE_Y + TILE_H + 6} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
              )}
              <text x={812} y={22} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: 'var(--ink-2)' }} aria-hidden="true">Insertar</text>
              {CHIPS.map((c) => (
                <PaletteChip key={c.b} b={c.b} x={c.x} y={c.y}
                  preview={(_, p) => setInsPreview(p ? gapAt(p.x, p.y) : null)}
                  onDrop={(b, px, py) => { const g = gapAt(px, py); if (g !== null) apply({ kind: 'insercion', position: g, base: b }); }}
                  onPress={(b) => apply({ kind: 'insercion', position: sel, base: b })} />
              ))}
            </svg>
          </div>
          <div className="btn-row">
            <button type="button" className="btn small" onClick={() => { const w = Math.max(1, win - WIN); setWin(w); setSel(w); }} disabled={win <= 1}>Ventana anterior</button>
            <button type="button" className="btn small" onClick={() => { const w = Math.min(WIN_MAX, win + WIN); setWin(w); setSel(w); }} disabled={win >= WIN_MAX}>Ventana siguiente</button>
          </div>
          <p className="small" role="status" aria-live="polite" style={{ margin: 0 }}>{msg}</p>
        </div>
        <ManipHint>
          Arrastra una base hacia arriba para cambiarla por otra (cada paso, una base distinta) o hacia abajo, fuera de la hebra, para eliminarla. Arrastra una ficha
          de «Insertar» entre dos bases para añadirla. Con el teclado: Tab hasta la hebra, flechas para moverte, A/T/G/C para sustituir, Mayús + letra para insertar
          antes de la base y Supr para eliminarla.
        </ManipHint>

        <div className="grid-2">
          <div className="stack">
            <h3>Efecto de la mutación</h3>
            <Readout items={[
              { k: 'Clase de mutación', v: show(analysis ? analysis.label : 'Sin mutación (gen silvestre)'), data: true },
              { k: 'Cambio de aminoácido', v: show(aaChange) },
              { k: 'Empalme', v: show(`${cur.splicing.pattern}${cur.splicing.pattern !== wild.splicing.pattern ? ' (alterado por la mutación)' : mode === 'salto-exon2' ? ' (empalme alternativo)' : ''}`) },
            ]} />
            {done && analysis && <Notice kind={analysis.cls === 'silenciosa' || analysis.cls === 'no-codificante' ? 'ok' : 'warn'}>{analysis.explanation}</Notice>}
          </div>
          <div className="stack">
            <h3>Mediciones</h3>
            <Readout items={[
              { k: 'Pre-ARNm', v: show(`${fmt(cur.preMrnaLength, 0)} nt`) },
              { k: 'ARNm maduro', v: show(`${fmt(cur.mrnaLength, 0)} nt`), data: true },
              { k: 'Proteína', v: show(`${fmt(cur.proteinLength, 0)} aa (≈ ${fmt(proteinMassKDa(cur.proteinLength), 1)} kDa)`), data: true },
              { k: 'Identidad con la proteína silvestre', v: show(`${fmt(analysis ? analysis.identity : 100, 1)} %`), data: true },
              { k: 'Expresión relativa', v: show(`${fmt(expressionPct, 0)} %`), data: true },
            ]} />
          </div>
        </div>

        {done && (
          <div className="card stack-sm" style={{ minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <h3>Proteína silvestre y mutante</h3>
            <ProteinBars wild={wild.protein} mutant={cur.protein} />
          </div>
        )}
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Mutación</h3>
          <Select label="Ir a" value={goto} onChange={(v) => {
            setGoto(v);
            const l = LANDMARKS.find((x) => x.id === v);
            if (l) { setSel(l.position); setWin(Math.max(1, Math.min(WIN_MAX, l.position - 12))); playSound('click', { volume: 0.4 }); }
          }} options={LANDMARKS.map((l) => ({ value: l.id, label: l.name }))} />
          <Slider label="Posición de la base" value={sel} min={1} max={GENE_LENGTH} step={1} decimals={0} onChange={(v) => moveSel(v)}
            hint={`Base actual: ${GENE_SEQ[sel - 1]} · ${selLoc.regionName}${selLoc.codon ? `, codón ${selLoc.codon}` : ''}`} />
          <Segmented<MutationKind> label="Tipo de mutación" value={mType} onChange={setMType}
            options={(['sustitucion', 'insercion', 'delecion'] as MutationKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          {mType !== 'delecion' && (
            <Segmented<Base> label="Base nueva" value={newBase} onChange={setNewBase} options={BASES.map((b) => ({ value: b, label: b }))} />
          )}
          <div className="btn-row">
            <button type="button" className="btn" onClick={applyPanel}>Aplicar mutación</button>
            <button type="button" className="btn ghost" onClick={restore} disabled={!mutation}>Restaurar el gen silvestre</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Gen actual: {mutation ? `${KIND_LABEL[mutation.kind].toLowerCase()} ${changeText(mutation)} en la base ${mutation.position}` : 'silvestre (sin mutación)'}.</p>
        </div>
        <div className="card stack">
          <h3>Célula y expresión</h3>
          <Segmented<SplicingMode> label="Modo de empalme" value={mode} onChange={setMode}
            options={[{ value: 'constitutivo', label: MODE_LABEL.constitutivo }, { value: 'salto-exon2', label: MODE_LABEL['salto-exon2'] }]} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={express} disabled={phase === 'expresando'}>Expresar el gen</button>
            {phase === 'expresando' && <button type="button" className="btn small" onClick={skip}>Omitir la animación</button>}
          </div>
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>
          Gen real: inicio del gen humano de la β-globina (HBB). El intrón 2 está acortado (81 de 850 nt). Se compara con el gen silvestre en la misma célula;
          una mutación a la vez. Contamos la metionina inicial: el codón 7 de este modelo es el «Glu6» de la proteína madura. Los efectos del promotor y de AATAAA son
          factores aproximados, y no se modelan los sitios crípticos de empalme ni la degradación del ARNm con codón de terminación prematuro.
        </Notice>
      </div>
    </div>
  );
}

/** Barras de longitud: proteína silvestre y mutante, con los tramos idénticos y distintos. */
function ProteinBars({ wild, mutant }: { wild: string; mutant: string }) {
  const geo = useMemo(() => {
    const max = Math.max(wild.length, mutant.length, 1);
    const s = 470 / max;
    const runs: { from: number; to: number; same: boolean }[] = [];
    for (let i = 0; i < mutant.length; i++) {
      const same = mutant[i] === wild[i];
      const last = runs[runs.length - 1];
      if (last && last.same === same) last.to = i + 1; else runs.push({ from: i, to: i + 1, same });
    }
    const same = [...mutant].filter((a, i) => a === wild[i]).length;
    return { s, runs, same };
  }, [wild, mutant]);
  return (
    <svg viewBox="0 0 640 96" role="img" aria-labelledby="exp-bar-t exp-bar-d" style={{ width: '100%', height: 'auto' }}>
      <title id="exp-bar-t">Comparación de longitudes de la proteína</title>
      <desc id="exp-bar-d">{`Proteína silvestre de ${wild.length} aminoácidos; proteína mutante de ${mutant.length} aminoácidos, ${geo.same} iguales en la misma posición.`}</desc>
      <text x={0} y={30} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)' }}>Silvestre</text>
      <rect x={80} y={18} width={wild.length * geo.s} height={16} rx={3} fill="var(--bio)" />
      <text x={86 + wild.length * geo.s} y={30} style={{ fontSize: 11, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{wild.length} aa</text>
      <text x={0} y={66} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)' }}>Mutante</text>
      {mutant.length === 0 && <text x={80} y={66} style={{ fontSize: 11, fill: 'var(--ink-2)' }}>sin proteína</text>}
      {geo.runs.map((r) => (
        <rect key={r.from} x={80 + r.from * geo.s} y={54} width={Math.max(0.8, (r.to - r.from) * geo.s)} height={16} fill={r.same ? 'var(--bio)' : 'var(--bad)'} />
      ))}
      {mutant.length > 0 && <text x={86 + mutant.length * geo.s} y={66} style={{ fontSize: 11, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{mutant.length} aa</text>}
      <rect x={80} y={82} width={10} height={8} fill="var(--bio)" /><text x={94} y={90} style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>igual a la silvestre</text>
      <rect x={220} y={82} width={10} height={8} fill="var(--bad)" /><text x={234} y={90} style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>distinto</text>
    </svg>
  );
}


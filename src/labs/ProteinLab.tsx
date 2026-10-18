import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GLModel, GLViewer } from '3dmol';
import {
  AA_CLASSES, AMINO_ACIDS, caCentroid, caTrace, describeStructure, distanceToCentroid, HETERO_NAMES, HIS_NOTE, ligands, measureDistance,
  paeBlocks, pairInfo, parseAlphaFoldPrediction, parsePae, parsePdbId, parseRcsbEntity, parseRcsbEntry, parseStructure, parseUniProt,
  PLDDT_BANDS, plddtBand, plddtSummary, rcsbEntityUrl, rcsbEntryUrl, rcsbFileUrl, rcsbPageUrl, alphafoldApiUrl, alphafoldPageUrl,
  RESOLUTION, secondaryFractions, STRUCTURE_LIMITS, StructureError, type AaClass, type PairKind, type ProteinStructure, type PResidue,
} from '../models/protein';
import { roundToResolution } from '../models/math';
import { BUNDLED_STRUCTURES, PROTEINS_RETRIEVED, STRUCTURE_LOADERS, type ExperimentalInfo, type PaeSummary, type PredictionInfo } from '../data/proteins';
import { GENES } from '../data/genes';
import { ProteinTraceSvg, type TraceExtra, type TracePoint } from '../components/ProteinTraceSvg';
import { Lcd } from './kit';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import { StatusChip } from '../components/Provenance';
import { STATUS_LABEL, type EpistemicStatus } from '../lib/provenance';
import type { LabProps } from './registry';

/* ------------------------------------------------------------------ motor 3D (3Dmol.js, carga diferida; mismo patrón que GeometryLab) */

type ThreeDmol = typeof import('3dmol');
let loader: Promise<ThreeDmol> | null = null;
function load3Dmol(): Promise<ThreeDmol> {
  if (!loader) {
    // @ts-ignore La compilación ES6 minificada no trae declaraciones propias; sus tipos son los del paquete '3dmol'.
    loader = import('3dmol/build/3Dmol.es6-min.js').then((m: unknown) => m as ThreeDmol);
    loader.catch(() => { loader = null; });
  }
  return loader;
}
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
const reducedMotion = () => { try { return prefersReducedMotion(); } catch { return false; } };
const cssVar = (name: string, fallback: string) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
};

type Engine = 'cargando' | 'disponible' | 'sin-webgl' | 'no-disponible';
type Style3D = 'cinta' | 'superficie' | 'esferas' | 'palitos';
type ColorMode = 'ss' | 'cadena' | 'tipo' | 'plddt' | 'factorB';
type LoadState = 'inactivo' | 'en cola' | 'cargando' | 'completado' | 'fallido' | 'cancelado';
type Kind = 'experimental' | 'prediccion' | 'local';

const STYLE_OPTIONS: { value: Style3D; label: string }[] = [
  { value: 'cinta', label: 'Cinta' }, { value: 'superficie', label: 'Superficie' }, { value: 'esferas', label: 'Esferas' }, { value: 'palitos', label: 'Palitos' },
];
const STYLE_NAME: Record<Style3D, string> = { cinta: 'cinta (cartoon)', superficie: 'superficie de van der Waals sobre la cinta', esferas: 'esferas', palitos: 'palitos' };
const COLOR_NAME: Record<ColorMode, string> = { ss: 'estructura secundaria', cadena: 'cadena', tipo: 'tipo de residuo', plddt: 'confianza pLDDT', factorB: 'factor B' };
/** Átomos a partir de los cuales no se calcula la superficie (3Dmol la calcula en el hilo principal: sin workers). */
const SURFACE_MAX_ATOMS = 12_000;

/* ------------------------------------------------------------------ colores (variables CSS; pLDDT con la leyenda de AlphaFold DB) */

const SS_VAR = { helice: '--series-4', hebra: '--series-6', otra: '--series-8' } as const;
const SS_LABEL = { helice: 'Hélice α', hebra: 'Hebra β', otra: 'Otra (giro, bucle o sin asignar)' } as const;
const TYPE_VAR: Record<AaClass, string> = { 'no polar': '--series-6', 'polar sin carga': '--series-3', 'ácido (carga negativa)': '--bad', 'básico (carga positiva)': '--series-2' };
const OTHER_VAR = '--series-8';
const CHAIN_VARS = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];
const FALLBACK_HEX: Record<string, string> = {
  '--series-1': '#c2410c', '--series-2': '#1e5fae', '--series-3': '#2e7d32', '--series-4': '#8b3aa3', '--series-5': '#0f766e',
  '--series-6': '#a16207', '--series-7': '#be185d', '--series-8': '#4b5563', '--bad': '#b42318', '--data': '#b23a0a', '--ink': '#1d2327', '--surface': '#ffffff',
};
const BAND_COLOR = Object.fromEntries(PLDDT_BANDS.map((b) => [b.band, b.color])) as Record<string, string>;

/** Degradado azul → blanco → rojo para el factor B (valores relativos de la propia estructura). */
function bGradient(t: number): string {
  const lo = [33, 102, 172], mid = [247, 247, 247], hi = [178, 24, 43];
  const u = Math.max(0, Math.min(1, t));
  const [a, b, k] = u < 0.5 ? [lo, mid, u * 2] : [mid, hi, (u - 0.5) * 2];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const tokenCss = (tok: string) => (tok.startsWith('--') ? `var(${tok})` : tok);
const tokenHex = (tok: string) => (tok.startsWith('--') ? cssVar(tok, FALLBACK_HEX[tok] ?? '#888888') : tok);

/* ------------------------------------------------------------------ entradas del selector */

interface Entry {
  key: string;
  id: string;
  name: string;
  kind: Kind;
  origin: 'incluida' | 'en vivo' | 'archivo local';
  sourceUrl: string | null;
  pageUrl: string | null;
  retrieved: string;
  sha256: string | null;
  bytes: number;
  rastreoGene: string | null;
  experimental?: ExperimentalInfo;
  prediction?: PredictionInfo;
  file?: string;
  text?: string;
  note?: string;
}

const BUNDLED: Entry[] = BUNDLED_STRUCTURES.map((b) => ({
  key: b.key, id: b.id, name: b.name, kind: b.kind, origin: 'incluida', sourceUrl: b.sourceUrl, pageUrl: b.pageUrl, retrieved: b.retrieved,
  sha256: b.sha256, bytes: b.bytes, rastreoGene: b.rastreoGene, experimental: b.experimental, prediction: b.prediction, file: b.file,
}));

/** Pares de átomos iniciales con significado biológico (los mismos que valida Biopython). */
const DEFAULT_PAIRS: Record<string, [[string, number, string], [string, number, string]]> = {
  '3I40': [['A', 6, 'SG'], ['A', 11, 'SG']],
  '2HHB': [['A', 87, 'NE2'], ['A', 142, 'FE']],
  '2LZM': [['A', 11, 'CA'], ['A', 20, 'CA']],
  '1EMA': [['A', 66, 'OH'], ['A', 148, 'ND1']],
  'AF-Q04671-F1': [['A', 1, 'CA'], ['A', 838, 'CA']],
};

const FETCH_TIMEOUT_MS = 45_000;
const MIN_GAP_MS = 400;
const PAE_MAX_CHARS = 30_000_000;

class ServiceError extends Error {}

/** Descarga texto con límite de tamaño (corta la lectura si se pasa del límite). */
async function fetchText(url: string, signal: AbortSignal, maxChars: number): Promise<{ status: number; text: string }> {
  const res = await fetch(url, { signal });
  if (!res.body) { const t = await res.text(); if (t.length > maxChars) throw new StructureError(`La respuesta supera el límite de ${fmt(maxChars / 1e6, 1)} millones de caracteres.`); return { status: res.status, text: t }; }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
    if (text.length > maxChars) { await reader.cancel(); throw new StructureError(`La respuesta supera el límite de ${fmt(maxChars / 1e6, 1)} millones de caracteres.`); }
  }
  return { status: res.status, text: text + dec.decode() };
}

/* ------------------------------------------------------------------ utilidades de presentación */

const resLabel = (r: PResidue) => `${r.resName}${r.resSeq}${r.iCode}`;
const atomLabel = (s: ProteinStructure, i: number) => { const a = s.atoms[i]; const r = s.residues[a.residue]; return `${r.chain}/${resLabel(r)}/${a.name}`; };
const statusOf = (k: Kind): EpistemicStatus => (k === 'experimental' ? 'experimental' : k === 'prediccion' ? 'prediccion' : 'sin-informacion');
const residueName = (r: PResidue) => AMINO_ACIDS[r.resName]?.name ?? HETERO_NAMES[r.resName] ?? `heterogrupo ${r.resName}`;
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${fmt(v * 100, 1)} %`);

interface DistM { key: string; a: number; b: number; value: number; kind: PairKind; separation: number | null; plddtPair: number | null }
interface ResM { key: string; residue: number; centroidDist: number | null; b: number | null; plddt: number | null }

/* ------------------------------------------------------------------ instrumento: cinta de secuencia y regla en Å */

function SequenceBench({ s, colors, markA, markB, markR, dist }: {
  s: ProteinStructure; colors: string[]; markA: number | null; markB: number | null; markR: number | null; dist: DistM | null;
}) {
  const W = 640, x0 = 92, x1 = 620;
  const rows = useMemo(() => s.chains.filter((c) => c.polymer > 0).slice(0, 6).map((c) => {
    const rs = c.residues.filter((ri) => s.residues[ri].polymer);
    const w = (x1 - x0) / Math.max(1, rs.length);
    const runs: { x: number; w: number; color: string }[] = [];
    rs.forEach((ri, k) => {
      const col = colors[ri];
      const last = runs[runs.length - 1];
      if (last && last.color === col) last.w += w; else runs.push({ x: x0 + k * w, w, color: col });
    });
    const pos = new Map(rs.map((ri, k) => [ri, x0 + (k + 0.5) * w]));
    return { id: c.id, n: rs.length, first: s.residues[rs[0]]?.resSeq, last: s.residues[rs[rs.length - 1]]?.resSeq, runs, pos };
  }), [s, colors]);
  const top = 48, rowH = 30; // deja sitio sobre la primera fila para las marcas A, B y R sin tapar el título
  const rulerY = top + rows.length * rowH + 34;
  const H = rulerY + 78;
  const mark = (ri: number | null, tag: string, color: string) => {
    if (ri === null) return null;
    const row = rows.findIndex((r) => r.pos.has(ri));
    if (row < 0) return null;
    const x = rows[row].pos.get(ri)!;
    const y = top + row * rowH;
    return (
      <g key={tag}>
        <path d={`M${x} ${y - 2} l-5 -8 h10 z`} fill={color} stroke="var(--surface)" strokeWidth="1" />
        <text x={x} y={y - 12} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{tag}</text>
      </g>
    );
  };
  const resA = markA !== null ? s.atoms[markA].residue : null, resB = markB !== null ? s.atoms[markB].residue : null;
  const scaleMax = dist ? Math.max(5, Math.ceil(dist.value / 5) * 5) : 20;
  const pxA = (x1 - x0) / scaleMax;
  const tickStep = scaleMax <= 20 ? 1 : scaleMax <= 60 ? 5 : 10;
  const labelEvery = tickStep === 1 ? 5 : tickStep * 2;
  const desc = `Cinta de la secuencia de ${rows.length} cadena${rows.length === 1 ? '' : 's'} coloreada igual que el modelo 3D; marcas A y B en los residuos de los átomos elegidos${markR !== null ? ' y R en el residuo analizado' : ''}. `
    + (dist ? `Regla: distancia ${atomLabel(s, dist.a)}–${atomLabel(s, dist.b)} de ${fmt(dist.value, 3)} Å${dist.separation !== null ? `, separados por ${dist.separation} residuos en la secuencia` : ''}.` : 'Regla en ángstroms vacía: mide una distancia para verla aquí.');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="p3d-t p3d-d">
      <title id="p3d-t">Cinta de secuencia y regla de la distancia medida (calculadas con las coordenadas del archivo)</title>
      <desc id="p3d-d">{desc}</desc>
      <text x={12} y={16} style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>Secuencia (de N a C)</text>
      {rows.map((r, i) => {
        const y = top + i * rowH;
        return (
          <g key={r.id}>
            <text x={12} y={y + 12} style={{ fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>Cadena {r.id}</text>
            <rect x={x0 - 1} y={y - 1} width={x1 - x0 + 2} height={16} rx={3} fill="var(--surface-2)" stroke="var(--line)" />
            {r.runs.map((u, k) => <rect key={k} x={u.x} y={y} width={Math.max(0.6, u.w)} height={14} fill={tokenCss(u.color)} />)}
            <text x={x0} y={y + 26} style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{r.first}</text>
            <text x={x1} y={y + 26} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{r.last} ({r.n} residuos)</text>
          </g>
        );
      })}
      {mark(resA, 'A', 'var(--data)')}
      {mark(resB, 'B', 'var(--data)')}
      {markR !== null && markR !== resA && markR !== resB && mark(markR, 'R', 'var(--ink)')}
      {s.chains.filter((c) => c.polymer > 0).length > 6 && <text x={x1} y={18} textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>se muestran 6 de {s.chains.filter((c) => c.polymer > 0).length} cadenas</text>}
      {/* regla de acrílico en Å */}
      <g filter="url(#kit-shadow-soft)">
        <rect x={x0 - 10} y={rulerY} width={x1 - x0 + 20} height={30} rx={4} fill="url(#kit-glass)" stroke="var(--glass-edge)" />
      </g>
      {Array.from({ length: Math.floor(scaleMax / tickStep) + 1 }, (_, i) => i * tickStep).map((v) => (
        <g key={v}>
          <line x1={x0 + v * pxA} x2={x0 + v * pxA} y1={rulerY} y2={rulerY + (v % labelEvery === 0 ? 12 : 7)} stroke="var(--glass-print)" strokeWidth={v % labelEvery === 0 ? 1.2 : 0.7} />
          {v % labelEvery === 0 && <text x={x0 + v * pxA} y={rulerY + 25} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{v}</text>}
        </g>
      ))}
      <text x={x1 + 8} y={rulerY + 46} textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Å (10⁻¹⁰ m)</text>
      {dist ? (
        <g>
          <line x1={x0} y1={rulerY - 10} x2={x0 + dist.value * pxA} y2={rulerY - 10} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
          <line x1={x0 + dist.value * pxA} y1={rulerY - 16} x2={x0 + dist.value * pxA} y2={rulerY} stroke="var(--data)" strokeWidth="1.5" strokeDasharray="3 3" />
          <Lcd x={12} y={rulerY + 34} w={170} h={34} text={`${fmt(dist.value, 3)}`} unit="Å" />
          <text x={196} y={rulerY + 56} style={{ fontSize: 12, fill: 'var(--ink)' }}>
            {atomLabel(s, dist.a)} – {atomLabel(s, dist.b)}{dist.separation !== null ? ` · ${dist.separation} residuos de separación en la secuencia` : ` · ${dist.kind}`}
          </text>
        </g>
      ) : <text x={(x0 + x1) / 2} y={rulerY - 8} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Mide una distancia para verla en la regla</text>}
    </svg>
  );
}

/** Mapa de calor del resumen por bloques de la PAE (no es la matriz completa). */
function PaeHeat({ pae }: { pae: PaeSummary }) {
  const k = pae.blocks.length, size = 240, cell = size / k, max = pae.max ?? Math.max(...pae.blocks.flat());
  const col = (v: number) => {
    const t = Math.max(0, Math.min(1, v / max));
    const a = [11, 93, 44], b = [240, 247, 240];
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})`;
  };
  const diag = pae.blocks.map((r, i) => r[i]);
  const meanDiag = diag.reduce((s, v) => s + v, 0) / diag.length;
  const meanAll = pae.blocks.flat().reduce((s, v) => s + v, 0) / (k * k);
  return (
    <svg viewBox={`0 0 ${size + 90} ${size + 40}`} role="img" aria-labelledby="p3d-pae-t p3d-pae-d" style={{ maxWidth: 360, minWidth: 0 }}>
      <title id="p3d-pae-t">Resumen de la PAE (error de alineamiento predicho) por bloques</title>
      <desc id="p3d-pae-d">{`Matriz de ${k} por ${k} bloques de ${pae.blockSize} residuos (promedio de la PAE oficial de ${pae.n} por ${pae.n} residuos). Verde oscuro: error bajo; claro: error alto, hasta ${fmt(max, 2)} Å. PAE media en la diagonal ${fmt(meanDiag, 1)} Å y en toda la matriz ${fmt(meanAll, 1)} Å.`}</desc>
      {pae.blocks.map((r, i) => r.map((v, j) => <rect key={`${i}-${j}`} x={20 + j * cell} y={10 + i * cell} width={cell + 0.3} height={cell + 0.3} fill={col(v)} />))}
      <rect x={20} y={10} width={size} height={size} fill="none" stroke="var(--line)" />
      <text x={20} y={size + 26} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>residuo alineado →</text>
      <text x={12} y={10 + size / 2} transform={`rotate(-90 12 ${10 + size / 2})`} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>residuo evaluado →</text>
      <defs><linearGradient id="p3d-pae-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={col(0)} /><stop offset="1" stopColor={col(max)} /></linearGradient></defs>
      <rect x={size + 34} y={10} width={14} height={size} fill="url(#p3d-pae-g)" stroke="var(--line)" />
      <text x={size + 52} y={size + 10} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>0 Å</text>
      <text x={size + 52} y={18} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{fmt(max, 1)} Å</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function ProteinLab({ api }: LabProps) {
  const [extra, setExtra] = useState<Entry[]>([]);
  const entries = useMemo(() => [...BUNDLED, ...extra], [extra]);
  const [entryKey, setEntryKey] = useState(BUNDLED[0].key);
  const entry = entries.find((e) => e.key === entryKey) ?? BUNDLED[0];

  /* ---------- texto del archivo (carga diferida de los incluidos) */
  const texts = useRef(new Map<string, string>());
  // El texto se guarda junto con la clave de su estructura: nunca se mezcla un archivo con la ficha de otra.
  const [loaded, setLoaded] = useState<{ key: string; text: string } | null>(null);
  const text = loaded && loaded.key === entry.key ? loaded.text : null;
  const [textError, setTextError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTextError(null);
    const cached = entry.text ?? texts.current.get(entry.key);
    if (cached) { setLoaded({ key: entry.key, text: cached }); return; }
    const load = entry.file ? STRUCTURE_LOADERS[entry.file] : undefined;
    if (!load) { setTextError('No hay archivo para esta estructura.'); return; }
    load().then((t) => { if (cancelled) return; texts.current.set(entry.key, t); setLoaded({ key: entry.key, text: t }); })
      .catch((e) => { console.warn('[proteínas] No se pudo cargar el archivo incluido.', e); if (!cancelled) setTextError('No se pudo cargar el archivo incluido (¿se interrumpió la descarga de la aplicación?). Recarga la página.'); });
    return () => { cancelled = true; };
  }, [entry]);

  const parsed = useMemo(() => {
    if (!text) return null;
    try { return { s: parseStructure(text), error: null as string | null }; } catch (e) { return { s: null, error: e instanceof Error ? e.message : 'No se pudo leer el archivo.' }; }
  }, [text]);
  const s = parsed?.s ?? null;

  /* ---------- derivados (memorizados) */
  const centroid = useMemo(() => { if (!s) return null; try { return caCentroid(s); } catch { return null; } }, [s]);
  const plddt = useMemo(() => { if (!s || entry.kind === 'experimental') return null; if (entry.kind === 'local' && !s.declaresPrediction) return null; try { return plddtSummary(s); } catch { return null; } }, [s, entry.kind]);
  const plddtByResidue = useMemo(() => new Map(plddt?.values.map((v) => [v.residue, v.plddt]) ?? []), [plddt]);
  const bRange = useMemo(() => {
    if (!s) return { min: 0, max: 1 };
    const bs = s.residues.filter((r) => r.kind === 'estandar' && r.ca !== null).map((r) => s.atoms[r.ca!].b);
    return bs.length ? { min: Math.min(...bs), max: Math.max(...bs) } : { min: 0, max: 1 };
  }, [s]);
  const ligandList = useMemo(() => (s ? ligands(s) : []), [s]);
  const ssFrac = useMemo(() => (s ? secondaryFractions(s) : null), [s]);

  const isPred = entry.kind === 'prediccion' || (entry.kind === 'local' && !!s?.declaresPrediction);
  const colorOptions = useMemo(() => {
    const o: { value: ColorMode; label: string }[] = [
      { value: 'ss', label: 'Estructura secundaria (del archivo)' }, { value: 'cadena', label: 'Cadena' }, { value: 'tipo', label: 'Tipo de residuo' },
    ];
    if (isPred) o.push({ value: 'plddt', label: 'Confianza de la predicción (pLDDT)' });
    else o.push({ value: 'factorB', label: 'Factor B (movilidad en el cristal)' });
    return o;
  }, [isPred]);
  const [colorMode, setColorMode] = useState<ColorMode>('ss');
  const mode: ColorMode = colorOptions.some((o) => o.value === colorMode) ? colorMode : 'ss';
  const [style, setStyle] = useState<Style3D>('cinta');
  const [showLigands, setShowLigands] = useState(true);
  const [showWater, setShowWater] = useState(false);
  const [hiddenChains, setHiddenChains] = useState<string[]>([]);

  /** Color de cada residuo (token: variable CSS o hex), el mismo en el 3D, la vista de respaldo y la cinta. */
  const colors = useMemo(() => {
    if (!s) return [] as string[];
    const chainIdx = new Map(s.chains.map((c, i) => [c.id, i]));
    return s.residues.map((r) => {
      if (mode === 'cadena') return CHAIN_VARS[(chainIdx.get(r.chain) ?? 0) % CHAIN_VARS.length];
      if (mode === 'tipo') return AMINO_ACIDS[r.resName] ? TYPE_VAR[AMINO_ACIDS[r.resName].cls] : OTHER_VAR;
      if (mode === 'plddt') { const p = r.ca !== null ? s.atoms[r.ca].b : s.atoms[r.atoms[0]]?.b; return p !== undefined && p >= 0 && p <= 100 ? BAND_COLOR[plddtBand(p)] : OTHER_VAR; }
      if (mode === 'factorB') { const a = r.ca !== null ? s.atoms[r.ca] : s.atoms[r.atoms[0]]; return a ? bGradient((a.b - bRange.min) / Math.max(1e-6, bRange.max - bRange.min)) : OTHER_VAR; }
      return SS_VAR[r.ss];
    });
  }, [s, mode, bRange]);

  /* ---------- selección de átomos y residuo */
  const [rawA, setAtomA] = useState<number | null>(null);
  const [rawB, setAtomB] = useState<number | null>(null);
  const [rawR, setResR] = useState<number | null>(null);
  // Índices validados contra la estructura actual (durante el cambio de estructura pueden venir de la anterior).
  const atomA = s && rawA !== null && rawA < s.atoms.length ? rawA : null;
  const atomB = s && rawB !== null && rawB < s.atoms.length ? rawB : null;
  const resR = s && rawR !== null && rawR < s.residues.length ? rawR : null;
  const [slot, setSlot] = useState<0 | 1>(0);
  const [dist, setDist] = useState<DistM | null>(null);
  const [resM, setResM] = useState<ResM | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Valores iniciales al cambiar de estructura.
  useEffect(() => {
    if (!s) { setAtomA(null); setAtomB(null); setResR(null); return; }
    const pair = DEFAULT_PAIRS[entry.id];
    const find = (c: string, n: number, a: string) => s.atoms.find((x) => x.name === a && s.residues[x.residue].chain === c && s.residues[x.residue].resSeq === n)?.index ?? null;
    const firstChain = s.chains.find((c) => c.polymer > 0);
    const poly = firstChain ? firstChain.residues.filter((ri) => s.residues[ri].polymer && s.residues[ri].ca !== null) : [];
    const fa = poly.length ? s.residues[poly[0]].ca : 0, fb = poly.length ? s.residues[poly[poly.length - 1]].ca : Math.min(1, s.atoms.length - 1);
    const a = pair ? find(...pair[0]) : null, b = pair ? find(...pair[1]) : null;
    setAtomA(a ?? fa); setAtomB(b ?? fb);
    setResR(poly.length ? poly[0] : 0);
    setSlot(0); setDist(null); setResM(null); setError(null); setHiddenChains([]);
  }, [s, entry.id]);

  const residueOptions = useCallback((chain: string) => (s ? s.chains.find((c) => c.id === chain)?.residues.filter((ri) => s.residues[ri].kind !== 'agua')
    .map((ri) => ({ value: String(ri), label: `${resLabel(s.residues[ri])}${s.residues[ri].kind === 'hetero' ? ' (heterogrupo)' : ''}` })) ?? [] : []), [s]);
  const atomOptions = (ri: number) => (s ? s.residues[ri].atoms.map((ai) => ({ value: String(ai), label: s.atoms[ai].name })) : []);
  const chainOptions = useMemo(() => (s ? s.chains.filter((c) => c.residues.some((ri) => s.residues[ri].kind !== 'agua')).map((c) => ({ value: c.id, label: `Cadena ${c.id}` })) : []), [s]);

  const pickAtom = useCallback((i: number) => {
    if (!s || !Number.isInteger(i) || i < 0 || i >= s.atoms.length) return;
    if (s.residues[s.atoms[i].residue].kind === 'agua') return; // las aguas no están en las listas de residuos
    if (slot === 0) setAtomA(i); else setAtomB(i);
    setSlot((x) => (x === 0 ? 1 : 0));
    setResR(s.atoms[i].residue);
    setError(null);
    playSound('click', { intensity: 0.3 });
  }, [s, slot]);
  const pickRef = useRef(pickAtom);
  pickRef.current = pickAtom;

  const distKey = s && atomA !== null && atomB !== null ? `${entry.key}|${atomA}|${atomB}` : '';
  const currentDist = dist && dist.key === distKey ? dist : null;
  const resKey = s && resR !== null ? `${entry.key}|${resR}` : '';
  const currentRes = resM && resM.key === resKey ? resM : null;

  const measure = () => {
    if (!s || atomA === null || atomB === null) return;
    try {
      const value = measureDistance(s, atomA, atomB);
      const info = pairInfo(s, atomA, atomB);
      const pa = plddtByResidue.get(s.atoms[atomA].residue), pb = plddtByResidue.get(s.atoms[atomB].residue);
      const plddtPair = isPred && pa !== undefined && pb !== undefined ? roundToResolution((pa + pb) / 2, RESOLUTION.plddt) : null;
      setDist({ key: distKey, a: atomA, b: atomB, value, kind: info.kind, separation: info.separation, plddtPair });
      setError(null);
      playSound('click', { intensity: 0.6 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo medir.');
      playSound('error');
    }
  };
  const analyze = () => {
    if (!s || resR === null) return;
    const r = s.residues[resR];
    const ca = r.ca !== null ? s.atoms[r.ca] : null;
    setResM({
      key: resKey, residue: resR, centroidDist: centroid ? distanceToCentroid(s, resR, centroid) : null,
      b: !isPred && ca ? ca.b : null, plddt: isPred ? (plddtByResidue.get(resR) ?? null) : null,
    });
    playSound('click', { intensity: 0.5 });
  };

  const originText = (e: Entry) => STATUS_LABEL[statusOf(e.kind)];
  const methodText = (e: Entry) => e.experimental?.method ?? (e.prediction ? `${e.prediction.toolUsed ?? 'AlphaFold'}${e.prediction.version ? `, versión ${e.prediction.version} de AlphaFold DB` : ''}` : s?.method ? `${s.method} (declarado en el archivo, no verificado)` : 'no declarado');
  const fuenteText = (e: Entry) => `${e.id} · ${e.origin}${e.sourceUrl ? ` · ${e.sourceUrl}` : ''} · ${e.retrieved}`;

  const recordDist = () => {
    if (!s || !currentDist) return;
    api.addTrial('distancias', {
      estructura: entry.id, nombre: entry.name, origen: originText(entry), metodo: methodText(entry),
      resolucion: entry.experimental?.resolution ?? null, atomoA: atomLabel(s, currentDist.a), atomoB: atomLabel(s, currentDist.b),
      tipoPar: currentDist.kind, separacion: currentDist.separation, distancia: currentDist.value, plddtPar: currentDist.plddtPair, fuente: fuenteText(entry),
    });
  };
  const recordRes = () => {
    if (!s || !currentRes) return;
    const r = s.residues[currentRes.residue];
    const aa = AMINO_ACIDS[r.resName];
    api.addTrial('residuos', {
      estructura: entry.id, origen: originText(entry), cadena: r.chain, posicion: r.resSeq, residuo: r.resName, clase: aa?.cls ?? 'heterogrupo',
      estructuraSecundaria: r.polymer && s.ss.fromFile ? SS_LABEL[r.ss] : 'no declarada', distanciaCentro: currentRes.centroidDist,
      factorB: currentRes.b, plddt: currentRes.plddt, bandaPlddt: currentRes.plddt !== null ? PLDDT_BANDS.find((b) => b.band === plddtBand(currentRes.plddt!))!.label : null,
      hidropatia: aa?.hydropathy ?? null, fuente: fuenteText(entry),
    });
  };

  /* ---------- visor 3D */
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<GLViewer | null>(null);
  const libRef = useRef<ThreeDmol | null>(null);
  const modelRef = useRef<GLModel | null>(null);
  const [engine, setEngine] = useState<Engine>('cargando');
  const [retry, setRetry] = useState(0);
  const [modelKey, setModelKey] = useState('');
  const [surf, setSurf] = useState<'ninguna' | 'calculando' | 'lista' | 'omitida' | 'fallida'>('ninguna');

  useEffect(() => {
    const host = hostRef.current;
    let cancelled = false;
    if (!host) return;
    if (!webglAvailable()) { setEngine('sin-webgl'); return; }
    setEngine('cargando');
    load3Dmol().then((lib) => {
      if (cancelled) return;
      try {
        libRef.current = lib;
        viewerRef.current = lib.createViewer(host, { backgroundColor: 'white', backgroundAlpha: 0, antialias: true });
        setEngine('disponible');
      } catch (e) {
        console.warn('[proteínas] No se pudo crear el visor 3D; se usa la vista de respaldo.', e);
        setEngine('no-disponible');
      }
    }).catch((e) => { console.warn('[proteínas] No se pudo descargar el visor 3D (¿sin conexión?); se usa la vista de respaldo.', e); if (!cancelled) setEngine('no-disponible'); });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { try { viewerRef.current?.resize(); viewerRef.current?.render(); } catch { /* sin visor */ } });
    ro?.observe(host);
    return () => {
      cancelled = true;
      ro?.disconnect();
      try { viewerRef.current?.clear(); } catch { /* ya liberado */ }
      viewerRef.current = null; modelRef.current = null;
      host.innerHTML = '';
    };
  }, [retry]);

  // Carga del modelo en el visor cuando cambia el archivo.
  const zoomedFor = useRef('');
  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v || !text || !s) return;
    try {
      v.removeAllModels(); v.removeAllSurfaces(); v.removeAllShapes(); v.removeAllLabels();
      modelRef.current = v.addModel(text, s.format === 'mmcif' ? 'cif' : 'pdb', { altLoc: 'A' });
      zoomedFor.current = '';
      setModelKey(entry.key);
    } catch (e) {
      console.warn('[proteínas] El visor 3D no pudo cargar la estructura; se usa la vista de respaldo.', e);
      setEngine('no-disponible');
    }
  }, [engine, text, s, entry.key]);

  // Átomo de nuestro lector a partir del átomo de 3Dmol (número de serie; si no, cadena + residuo + nombre).
  const serialIndex = useMemo(() => new Map(s?.atoms.map((a) => [a.serial, a.index]) ?? []), [s]);
  const residueIndex = useMemo(() => new Map(s?.residues.map((r) => [`${r.chain}|${r.resSeq}|${r.resName}`, r.index]) ?? []), [s]);
  const atomFrom3D = useCallback((a: { serial?: number; chain?: string; resi?: number; resn?: string; atom?: string }) => {
    if (!s) return null;
    if (typeof a.serial === 'number' && serialIndex.has(a.serial)) return serialIndex.get(a.serial)!;
    const ri = residueIndex.get(`${a.chain}|${a.resi}|${a.resn}`);
    if (ri === undefined) return null;
    return s.residues[ri].atoms.find((ai) => s.atoms[ai].name === a.atom) ?? null;
  }, [s, serialIndex, residueIndex]);

  // Estilo, color, selección y medición.
  useEffect(() => {
    const v = viewerRef.current, m = modelRef.current;
    if (engine !== 'disponible' || !v || !m || !s || modelKey !== entry.key) return;
    try {
      const hex = new Map<string, string>();
      const resolve = (tok: string) => { let h = hex.get(tok); if (!h) { h = tokenHex(tok); hex.set(tok, h); } return h; };
      m.setColorByFunction({}, (a: { serial?: number; chain?: string; resi?: number; resn?: string; atom?: string }) => {
        const i = atomFrom3D(a);
        return resolve(i !== null ? colors[s.atoms[i].residue] : OTHER_VAR);
      });
      const base: Record<Style3D, Record<string, unknown>> = {
        cinta: { cartoon: { arrows: true } }, superficie: { cartoon: { arrows: true } }, esferas: { sphere: {} }, palitos: { stick: { radius: 0.15 } },
      };
      v.setStyle({}, base[style]);
      // Heterogrupos: los de fuera del polímero (hemo, fosfato…) se ocultan si se pide; los residuos modificados (CRO, MSE) siguen en la cadena.
      const outside = [...new Set(ligandList.filter((l) => !l.inPolymer).map((l) => l.resName))];
      const allHet = [...new Set(ligandList.map((l) => l.resName))];
      if (!showLigands && outside.length) v.setStyle({ resn: outside, hetflag: true } as never, {});
      if (showLigands && allHet.length) v.addStyle({ resn: allHet, hetflag: true } as never, { stick: { radius: 0.22, colorscheme: 'Jmol' } });
      v.setStyle({ resn: ['HOH', 'WAT'] } as never, showWater ? { sphere: { radius: 0.3, color: '#d9480f' } } : {});
      for (const c of hiddenChains) v.setStyle({ chain: c }, {});
      v.removeAllShapes(); v.removeAllLabels();
      const ink = cssVar('--ink', '#1d2327'), surface = cssVar('--surface', '#ffffff'), data = cssVar('--data', '#b23a0a');
      const P = (i: number) => ({ x: s.atoms[i].x, y: s.atoms[i].y, z: s.atoms[i].z });
      if (resR !== null) {
        const r = s.residues[resR];
        v.addStyle({ chain: r.chain, resi: r.resSeq } as never, { stick: { radius: 0.2 } });
        const at = r.ca ?? r.atoms[0];
        if (at !== undefined) v.addLabel(`R: ${r.chain}/${resLabel(r)}`, { position: P(at), fontSize: 12, fontColor: ink, backgroundColor: surface, backgroundOpacity: 0.8, borderThickness: 0, inFront: true, alignment: 'bottomLeft' });
      }
      ([[atomA, 'A'], [atomB, 'B']] as [number | null, string][]).forEach(([i, tag]) => {
        if (i === null) return;
        v.addSphere({ center: P(i), radius: 0.75, color: data, opacity: 0.55 });
        v.addLabel(tag, { position: P(i), fontSize: 13, fontColor: surface, backgroundColor: data, backgroundOpacity: 0.95, inFront: true, alignment: 'topLeft' });
      });
      if (currentDist) {
        v.addCylinder({ start: P(currentDist.a), end: P(currentDist.b), radius: 0.06, color: data, dashed: true, dashLength: 0.3, gapLength: 0.2 } as never);
        const pa = P(currentDist.a), pb = P(currentDist.b);
        v.addLabel(`${fmt(currentDist.value, 3)} Å`, { position: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 }, fontSize: 14, fontColor: surface, backgroundColor: data, backgroundOpacity: 0.95, inFront: true, alignment: 'topCenter' });
      }
      v.setClickable({}, true, (a: { serial?: number; chain?: string; resi?: number; resn?: string; atom?: string }) => { const i = atomFrom3D(a); if (i !== null) pickRef.current(i); });
      if (zoomedFor.current !== entry.key) { zoomedFor.current = entry.key; v.resize(); v.zoomTo(); }
      v.render();
    } catch (e) {
      console.warn('[proteínas] Error al dibujar en el visor 3D; se usa la vista de respaldo.', e);
      setEngine('no-disponible');
    }
  }, [engine, modelKey, entry.key, s, style, colors, showLigands, showWater, hiddenChains, resR, atomA, atomB, currentDist, atomFrom3D, ligandList]);

  // Superficie (3Dmol la calcula de forma síncrona porque no se definen workers en la compilación ES6).
  useEffect(() => {
    const v = viewerRef.current, lib = libRef.current;
    if (engine !== 'disponible' || !v || !lib || !s || modelKey !== entry.key) return;
    try { v.removeAllSurfaces(); v.render(); } catch { /* sin visor */ }
    if (style !== 'superficie') { setSurf('ninguna'); return; }
    if (s.atoms.length > SURFACE_MAX_ATOMS) { setSurf('omitida'); return; }
    setSurf('calculando');
    let cancelled = false;
    const t = setTimeout(() => {
      try {
        const sel = hiddenChains.length ? { hetflag: false, not: { chain: hiddenChains } } : { hetflag: false };
        const ret = v.addSurface(lib.SurfaceType.VDW, { opacity: 0.85 }, sel as never);
        Promise.resolve(ret).then(() => { if (!cancelled) { setSurf('lista'); try { v.render(); } catch { /* sin visor */ } } })
          .catch((e) => { console.warn('[proteínas] No se pudo calcular la superficie.', e); if (!cancelled) setSurf('fallida'); });
      } catch (e) {
        console.warn('[proteínas] No se pudo calcular la superficie.', e);
        setSurf('fallida');
      }
    }, 40);
    return () => { cancelled = true; clearTimeout(t); };
  }, [engine, modelKey, entry.key, s, style, colors, hiddenChains]);

  const view = (fn: (v: GLViewer, ms: number) => void) => {
    const v = viewerRef.current;
    if (!v) return;
    try { fn(v, reducedMotion() ? 0 : 350); v.render(); } catch { /* sin visor */ }
  };
  const [exportMsg, setExportMsg] = useState('');
  const download = (href: string, name: string) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  const exportPng = () => {
    const v = viewerRef.current;
    if (!v) return;
    try { v.render(); download(v.pngURI(), `${entry.id}-${style}-${mode}.png`); setExportMsg(`Imagen PNG descargada (${entry.id}). Cita la fuente: ${entry.pageUrl ?? 'archivo local'}.`); } catch (e) { console.warn('[proteínas] No se pudo exportar la imagen.', e); setExportMsg('No se pudo exportar la imagen del visor 3D.'); }
  };
  const fallbackRef = useRef<HTMLDivElement>(null);
  const exportSvg = () => {
    const svg = fallbackRef.current?.querySelector('svg');
    if (!svg) return;
    try {
      let xml = new XMLSerializer().serializeToString(svg);
      xml = xml.replace(/var\((--[a-z0-9-]+)\)/gi, (_m, name: string) => tokenHex(name));
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
      download(url, `${entry.id}-traza-ca.svg`);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setExportMsg(`Imagen SVG de la vista de respaldo descargada (${entry.id}).`);
    } catch (e) { console.warn('[proteínas] No se pudo exportar el SVG.', e); setExportMsg('No se pudo exportar la imagen.'); }
  };

  /* ---------- búsquedas en vivo (RCSB PDB y AlphaFold DB) */
  const [pdbQuery, setPdbQuery] = useState('');
  const [afQuery, setAfQuery] = useState('');
  const [liveState, setLiveState] = useState<LoadState>('inactivo');
  const [liveMsg, setLiveMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const lastReq = useRef(0);
  useEffect(() => () => abortRef.current?.abort(), []);
  const busy = liveState === 'en cola' || liveState === 'cargando';

  const addEntry = (e: Entry, t: string) => {
    texts.current.set(e.key, t);
    setExtra((prev) => [...prev.filter((x) => x.key !== e.key), e]);
    setEntryKey(e.key);
  };

  const runLive = async (label: string, job: (step: (msg: string) => Promise<void>, signal: AbortSignal) => Promise<void>) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLiveState('fallido'); setLiveMsg(`Servicio no disponible: el equipo no tiene conexión a internet. Las ${BUNDLED.length} estructuras incluidas siguen funcionando sin conexión.`);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, FETCH_TIMEOUT_MS);
    const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const step = async (msg: string) => {
      const wait = Math.max(0, lastReq.current + MIN_GAP_MS - Date.now());
      if (wait > 0) { setLiveState('en cola'); setLiveMsg('Esperando turno: las solicitudes a los servicios se espacian.'); await pause(wait); }
      if (ctrl.signal.aborted) throw new DOMException('cancelado', 'AbortError');
      lastReq.current = Date.now();
      setLiveState('cargando'); setLiveMsg(msg);
    };
    try {
      setLiveState('en cola'); setLiveMsg(`${label}: en cola.`);
      await job(step, ctrl.signal);
      playSound('confirm');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        if (abortRef.current !== ctrl) return;
        setLiveState(timedOut ? 'fallido' : 'cancelado');
        setLiveMsg(timedOut ? `Servicio no disponible: no hubo respuesta completa en ${FETCH_TIMEOUT_MS / 1000} s.` : 'Búsqueda cancelada.');
      } else if (err instanceof TypeError) {
        setLiveState('fallido'); setLiveMsg('Servicio no disponible: no se pudo conectar (sin conexión, bloqueo de red o servicio caído).');
      } else {
        setLiveState('fallido'); setLiveMsg((err as Error).message);
      }
      playSound('error');
    } finally {
      clearTimeout(timer);
    }
  };

  const httpCheck = (status: number, service: string, notFound: string) => {
    if (status === 404) throw new ServiceError(notFound);
    if (status === 429 || status >= 500) throw new ServiceError(`Servicio no disponible: ${service} respondió ${status}. Intenta más tarde.`);
    if (status !== 200) throw new ServiceError(`Respuesta inesperada de ${service} (código ${status}).`);
  };

  const searchPdb = (raw?: string) => {
    let id: string;
    try { id = parsePdbId(raw ?? pdbQuery); } catch (e) { setLiveState('fallido'); setLiveMsg((e as Error).message); return; }
    const bundled = BUNDLED.find((b) => b.id === id);
    if (bundled) { setEntryKey(bundled.key); setLiveState('completado'); setLiveMsg(`${id} ya está incluida en el laboratorio; se muestra la copia incluida (descargada el ${bundled.retrieved}).`); return; }
    const already = extra.find((x) => x.id === id);
    if (already) { setEntryKey(already.key); setLiveState('completado'); setLiveMsg(`${id} ya se había descargado en esta sesión.`); return; }
    void runLive(`PDB ${id}`, async (step, signal) => {
      await step(`Consultando los metadatos de ${id} en RCSB PDB (data.rcsb.org)…`);
      const r = await fetchText(rcsbEntryUrl(id), signal, 2_000_000);
      httpCheck(r.status, 'RCSB PDB', `RCSB PDB no tiene ninguna entrada ${id} (puede no existir o estar retirada).`);
      const meta = parseRcsbEntry(JSON.parse(r.text), id);
      if (meta.atomCount !== null && meta.atomCount > STRUCTURE_LIMITS.maxAtoms) throw new ServiceError(`${id} tiene ${fmt(meta.atomCount, 0)} átomos: supera el límite de ${fmt(STRUCTURE_LIMITS.maxAtoms, 0)} del laboratorio.`);
      const entities = [];
      for (const eid of meta.entityIds.slice(0, 6)) {
        await step(`Consultando la entidad ${eid} de ${id} (organismo y UniProt)…`);
        const re = await fetchText(rcsbEntityUrl(id, eid), signal, 2_000_000);
        if (re.status === 200) entities.push(parseRcsbEntity(JSON.parse(re.text)));
      }
      await step(`Descargando las coordenadas de ${id} (mmCIF, files.rcsb.org)…`);
      const url = rcsbFileUrl(id);
      const f = await fetchText(url, signal, STRUCTURE_LIMITS.maxChars);
      httpCheck(f.status, 'RCSB PDB', `RCSB PDB no tiene archivo mmCIF para ${id}.`);
      const st = parseStructure(f.text);
      if (st.id && st.id.toUpperCase() !== id) throw new StructureError(`El archivo dice ser de ${st.id} y no de ${id}.`);
      const e: Entry = {
        key: `pdb-${id}`, id, name: entities[0]?.description ? `${entities[0].description} (PDB ${id})` : `PDB ${id}`, kind: 'experimental', origin: 'en vivo',
        sourceUrl: url, pageUrl: rcsbPageUrl(id), retrieved: new Date().toISOString().slice(0, 10), sha256: null, bytes: f.text.length, rastreoGene: null,
        experimental: {
          metadataUrl: rcsbEntryUrl(id), title: meta.title ?? '—', method: meta.method ?? 'no indicado', resolution: meta.resolution, depositDate: meta.depositDate,
          releaseDate: meta.releaseDate, revisionDate: meta.revisionDate, depositedAtoms: meta.atomCount, entities, ligands: meta.ligands, citation: '',
          license: 'CC0 1.0 (política de uso de RCSB PDB / wwPDB, verificada el 2026-10-18)',
        },
        note: st.models > 1 ? `El archivo tiene ${st.models} modelos (por ejemplo, RMN); las tablas y mediciones usan solo el primero.` : undefined,
      };
      addEntry(e, f.text);
      setLiveState('completado'); setLiveMsg(`${id} descargada: ${fmt(st.atoms.length, 0)} átomos en ${st.chains.length} cadenas (${meta.method ?? 'método no indicado'}${meta.resolution ? `, ${fmt(meta.resolution, 2)} Å` : ''}).`);
    });
  };

  const searchAf = (raw?: string) => {
    let acc: string;
    try { acc = parseUniProt(raw ?? afQuery); } catch (e) { setLiveState('fallido'); setLiveMsg((e as Error).message); return; }
    const bundled = BUNDLED.find((b) => b.prediction?.uniprot === acc);
    if (bundled) { setEntryKey(bundled.key); setLiveState('completado'); setLiveMsg(`El modelo de AlphaFold de ${acc} ya está incluido; se muestra la copia incluida (descargada el ${bundled.retrieved}).`); return; }
    const already = extra.find((x) => x.prediction?.uniprot === acc);
    if (already) { setEntryKey(already.key); setLiveState('completado'); setLiveMsg(`El modelo de ${acc} ya se había descargado en esta sesión.`); return; }
    void runLive(`AlphaFold ${acc}`, async (step, signal) => {
      await step(`Consultando AlphaFold DB para ${acc} (alphafold.ebi.ac.uk/api)…`);
      const r = await fetchText(alphafoldApiUrl(acc), signal, 3_000_000);
      httpCheck(r.status, 'AlphaFold DB', `AlphaFold DB no tiene un modelo para ${acc} (la accesión puede no existir o no estar cubierta).`);
      const rec = parseAlphaFoldPrediction(JSON.parse(r.text), acc);
      await step(`Descargando el modelo ${rec.entryId} (mmCIF)…`);
      const f = await fetchText(rec.cifUrl, signal, STRUCTURE_LIMITS.maxChars);
      httpCheck(f.status, 'AlphaFold DB', `No se encontró el archivo del modelo ${rec.entryId}.`);
      const st = parseStructure(f.text);
      if (st.id && st.id !== rec.entryId) throw new StructureError(`El archivo dice ser ${st.id} y no ${rec.entryId}.`);
      let pae: PaeSummary | null = null;
      let paeNote = '';
      if (rec.paeUrl) {
        try {
          await step('Descargando la PAE (error de alineamiento predicho)…');
          const p = await fetchText(rec.paeUrl, signal, PAE_MAX_CHARS);
          if (p.status === 200) {
            const { matrix, max } = parsePae(JSON.parse(p.text));
            const b = paeBlocks(matrix, 40);
            pae = { sourceSha256: '', sourceBytes: p.text.length, n: matrix.length, blockSize: b.blockSize, max, blocks: b.blocks };
          } else paeNote = `PAE no disponible (código ${p.status}).`;
        } catch (e) {
          if ((e as Error).name === 'AbortError') throw e;
          paeNote = `PAE no disponible: ${(e as Error).message}`;
        }
      }
      const e: Entry = {
        key: `af-${acc}`, id: rec.entryId, name: `${rec.description ?? acc}${rec.gene ? ` (${rec.gene})` : ''} · AlphaFold`, kind: 'prediccion', origin: 'en vivo',
        sourceUrl: rec.cifUrl, pageUrl: alphafoldPageUrl(acc), retrieved: new Date().toISOString().slice(0, 10), sha256: null, bytes: f.text.length, rastreoGene: rec.gene,
        prediction: {
          apiUrl: alphafoldApiUrl(acc), uniprot: acc, entryId: rec.entryId, toolUsed: rec.toolUsed, providerId: null, version: rec.version,
          modelCreatedDate: rec.modelCreatedDate, sequenceVersionDate: null, globalMetricValue: rec.globalMetricValue, fractions: rec.fractions,
          gene: rec.gene, description: rec.description, organism: rec.organism, sequenceLength: null, paeUrl: rec.paeUrl ?? '', paeImageUrl: null,
          license: st.license ? `${st.license} (declarado en el archivo)` : 'CC BY 4.0 (por verificar en el archivo)', pae,
        },
        note: paeNote || undefined,
      };
      addEntry(e, f.text);
      setLiveState('completado'); setLiveMsg(`Modelo ${rec.entryId} descargado: ${fmt(st.atoms.length, 0)} átomos${rec.globalMetricValue !== null ? `, pLDDT global ${fmt(rec.globalMetricValue, 2)}` : ''}.${paeNote ? ` ${paeNote}` : ''}`);
    });
  };
  const cancelSearch = () => abortRef.current?.abort();

  /* ---------- archivo local */
  const [fileMsg, setFileMsg] = useState('');
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(cif|mmcif|pdb|ent)$/i.test(file.name)) { setFileMsg('Usa un archivo .pdb, .ent, .cif o .mmcif (texto).'); return; }
    if (file.size > STRUCTURE_LIMITS.maxFileBytes) { setFileMsg(`El archivo pesa ${fmt(file.size / 1e6, 1)} MB: el límite es ${fmt(STRUCTURE_LIMITS.maxFileBytes / 1e6, 0)} MB.`); return; }
    try {
      const t = await file.text();
      const st = parseStructure(t);
      const safeName = file.name.replace(/[^\w.\- ]/g, '_').slice(0, 60);
      const e: Entry = {
        key: `local-${Date.now()}`, id: st.id ? `${st.id} (archivo local)` : safeName, name: `Archivo local: ${safeName}`, kind: 'local', origin: 'archivo local',
        sourceUrl: null, pageUrl: null, retrieved: new Date().toISOString().slice(0, 10), sha256: null, bytes: file.size, rastreoGene: null,
      };
      addEntry(e, t);
      setFileMsg(`Leído: ${fmt(st.atoms.length, 0)} átomos en ${st.chains.length} cadenas. Su procedencia no se puede verificar.`);
      playSound('confirm');
    } catch (err) {
      setFileMsg(err instanceof Error ? err.message : 'No se pudo leer el archivo.');
      playSound('error');
    }
  };

  /* ---------- textos */
  const fallbackOpen = engine === 'sin-webgl' || engine === 'no-disponible';
  const sceneText = useMemo(() => {
    if (!s) return 'Cargando la estructura.';
    const base = describeStructure(s, entry.name, STATUS_LABEL[statusOf(entry.kind)]);
    const lig = ligandList.filter((l) => !l.inPolymer);
    const ligT = lig.length ? ` Heterogrupos fuera del polímero: ${[...new Set(lig.map((l) => l.resName))].map((n) => `${n} (${HETERO_NAMES[n] ?? 'heterogrupo'})`).join(', ')}${showLigands ? ', dibujados como palitos' : ', ocultos'}.` : '';
    const pl = plddt ? ` Confianza pLDDT: ${pct(plddt.fractions.muyAlta)} muy alta, ${pct(plddt.fractions.alta)} alta, ${pct(plddt.fractions.baja)} baja y ${pct(plddt.fractions.muyBaja)} muy baja.` : '';
    const sel = ` Vista: ${fallbackOpen ? 'traza de carbonos alfa (respaldo)' : STYLE_NAME[style]}, color por ${COLOR_NAME[mode]}.${hiddenChains.length ? ` Cadenas ocultas: ${hiddenChains.join(', ')}.` : ''} Átomo A: ${atomA !== null ? atomLabel(s, atomA) : '—'}; átomo B: ${atomB !== null ? atomLabel(s, atomB) : '—'}.`;
    const res = currentDist ? ` Distancia medida: ${fmt(currentDist.value, 3)} Å.` : '';
    return `${base}${ligT}${pl}${sel}${res}`;
  }, [s, entry.name, entry.kind, ligandList, showLigands, plddt, fallbackOpen, style, mode, hiddenChains, atomA, atomB, currentDist]);

  /* ---------- vista de respaldo (SVG) */
  const trace = useMemo(() => {
    if (!s) return { segments: [] as { chain: string; points: TracePoint[] }[], extras: [] as TraceExtra[] };
    const segments = caTrace(s).filter((t) => !hiddenChains.includes(t.chain)).flatMap((t) => t.segments.map((seg) => ({
      chain: t.chain,
      points: seg.map((ai) => { const a = s.atoms[ai]; const r = s.residues[a.residue]; return { atom: ai, x: a.x, y: a.y, z: a.z, color: tokenCss(colors[a.residue]), label: `${r.chain}/${resLabel(r)}` }; }),
    })));
    const extras: TraceExtra[] = showLigands ? ligandList.filter((l) => !l.inPolymer && !hiddenChains.includes(l.chain)).flatMap((l) => s.residues[l.residue].atoms.map((ai) => {
      const a = s.atoms[ai]; return { atom: ai, x: a.x, y: a.y, z: a.z, element: a.element, label: `${l.chain}/${l.resName}${l.resSeq}/${a.name}` };
    })) : [];
    return { segments, extras };
  }, [s, colors, hiddenChains, showLigands, ligandList]);
  const highlight = useMemo(() => {
    if (!s) return [];
    const h: { atom: number; x: number; y: number; z: number; tag: string }[] = [];
    if (atomA !== null) h.push({ ...s.atoms[atomA], atom: atomA, tag: 'A' });
    if (atomB !== null) h.push({ ...s.atoms[atomB], atom: atomB, tag: 'B' });
    if (resR !== null && s.residues[resR].ca !== null) { const ca = s.residues[resR].ca!; h.push({ ...s.atoms[ca], atom: ca, tag: 'R' }); }
    return h;
  }, [s, atomA, atomB, resR]);

  /* ---------- lecturas */
  const distItems = [
    { k: 'Átomo A', v: s && atomA !== null ? atomLabel(s, atomA) : '—' },
    { k: 'Átomo B', v: s && atomB !== null ? atomLabel(s, atomB) : '—' },
    { k: 'Distancia medida', v: currentDist ? `${fmt(currentDist.value, 3)} Å` : 'mide', data: true },
    { k: 'Separación en la secuencia', v: currentDist ? (currentDist.separation !== null ? `${currentDist.separation} residuos` : currentDist.kind) : '—' },
    ...(isPred ? [{ k: 'pLDDT medio de los dos residuos', v: currentDist?.plddtPair != null ? fmt(currentDist.plddtPair, 2) : '—' }] : []),
  ];
  const rr = s && currentRes ? s.residues[currentRes.residue] : null;
  const aaInfo = rr ? AMINO_ACIDS[rr.resName] : undefined;
  const resItems = rr ? [
    { k: 'Residuo', v: `${rr.chain}/${resLabel(rr)} · ${residueName(rr)}${aaInfo ? ` (${aaInfo.one})` : ''}` },
    { k: 'Clase', v: aaInfo ? aaInfo.cls : rr.polymer ? 'residuo modificado' : 'heterogrupo' },
    { k: 'Hidropatía (Kyte-Doolittle)', v: aaInfo ? fmt(aaInfo.hydropathy, 1) : '—' },
    { k: 'Estructura secundaria (archivo)', v: rr.polymer && s!.ss.fromFile ? SS_LABEL[rr.ss] : 'no declarada' },
    { k: 'Distancia del Cα al centroide', v: currentRes!.centroidDist !== null ? `${fmt(currentRes!.centroidDist, 3)} Å` : 'sin Cα', data: true },
    isPred
      ? { k: 'pLDDT del residuo', v: currentRes!.plddt !== null ? `${fmt(currentRes!.plddt, 2)} (${PLDDT_BANDS.find((b) => b.band === plddtBand(currentRes!.plddt!))!.label.toLowerCase()})` : '—', data: true }
      : { k: 'Factor B del Cα', v: currentRes!.b !== null ? `${fmt(currentRes!.b, 2)} Å²` : '—', data: true },
  ] : [{ k: 'Residuo para analizar', v: s && resR !== null ? `${s.residues[resR].chain}/${resLabel(s.residues[resR])}` : '—' }, { k: 'Resultado', v: 'analiza' }];

  const chainA = s && atomA !== null ? s.residues[s.atoms[atomA].residue].chain : '';
  const chainB = s && atomB !== null ? s.residues[s.atoms[atomB].residue].chain : '';
  const chainR = s && resR !== null ? s.residues[resR].chain : '';
  const firstAtomOf = (ri: number) => (s ? (s.residues[ri].ca ?? s.residues[ri].atoms[0]) : 0);
  const firstResOf = (c: string) => Number(residueOptions(c)[0]?.value ?? 0);

  const legend = (() => {
    if (mode === 'ss') return (['helice', 'hebra', 'otra'] as const).map((k) => ({ color: tokenCss(SS_VAR[k]), text: SS_LABEL[k] }));
    if (mode === 'cadena') return (s?.chains ?? []).filter((c) => c.polymer > 0).map((c, i) => ({ color: tokenCss(CHAIN_VARS[i % CHAIN_VARS.length]), text: `Cadena ${c.id}` }));
    if (mode === 'tipo') return [...AA_CLASSES.map((c) => ({ color: tokenCss(TYPE_VAR[c]), text: c })), { color: tokenCss(OTHER_VAR), text: 'otro (heterogrupo o modificado)' }];
    if (mode === 'plddt') return PLDDT_BANDS.map((b) => ({ color: b.color, text: `${b.label} (${b.range})` }));
    return [{ color: bGradient(0), text: `B bajo: ${fmt(bRange.min, 1)} Å² (más ordenado)` }, { color: bGradient(0.5), text: 'intermedio' }, { color: bGradient(1), text: `B alto: ${fmt(bRange.max, 1)} Å² (más móvil)` }];
  })();

  const genesLinks = useMemo(() => GENES.map((g) => ({ symbol: g.gene.symbol, protein: g.uniprot.proteinName ?? g.gene.description, acc: g.uniprot.accession, af: g.uniprot.alphafold, pdb: g.structure?.pdb ?? null, length: g.protein.length })), []);

  /* ---------- render */
  const ex = entry.experimental, pr = entry.prediction;
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          {fallbackOpen && s ? (
            <div ref={fallbackRef} style={{ borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <ProteinTraceSvg segments={trace.segments} extras={trace.extras} highlight={highlight}
                measure={currentDist ? { a: s.atoms[currentDist.a], b: s.atoms[currentDist.b], text: `${fmt(currentDist.value, 3)} Å` } : null}
                onPick={(i) => pickRef.current(i)} title={entry.name} describedBy="p3d-3d-desc" />
            </div>
          ) : null}
          <div style={{ position: 'relative', width: '100%', height: fallbackOpen ? 0 : 380, borderRadius: 10, background: 'var(--surface-2)', border: fallbackOpen ? 'none' : '1px solid var(--line)', overflow: 'hidden' }}>
            <div ref={hostRef} role="img" aria-label={`Modelo 3D interactivo de ${entry.name}; arrastra para girar, rueda para acercar y toca un átomo para elegirlo`} aria-describedby="p3d-3d-desc"
              style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
            {(engine === 'cargando' || (!s && !fallbackOpen)) && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <p role="status" className="small">{engine === 'cargando' ? 'Cargando el visor 3D (3Dmol.js)…' : 'Cargando la estructura…'}</p>
              </div>
            )}
          </div>
          {fallbackOpen && (
            <div className="notice small" role="status" style={{ marginTop: 8 }}>
              <strong>Vista de respaldo (sin visor 3D):</strong> {engine === 'sin-webgl' ? 'este navegador o equipo no ofrece WebGL,' : 'no se pudo cargar el visor 3D (por ejemplo, sin conexión o un error de la tarjeta gráfica),'} así
              que se dibuja la <strong>traza de los carbonos alfa</strong> (un punto por residuo, unidos en orden) y los heterogrupos con las mismas coordenadas del archivo.
              No muestra cintas, superficies ni cadenas laterales; las mediciones, colores y tablas son idénticos. Arrástrala o usa las flechas del teclado para girarla.
              {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={() => setRetry((n) => n + 1)}>Reintentar el visor 3D</button></>}
            </div>
          )}
          <p id="p3d-3d-desc" className="sr-only">{sceneText}</p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            {!fallbackOpen && <>
              <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => view((v, ms) => v.rotate(90, 'y', ms))}>Girar 90° (eje vertical)</button>
              <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => view((v, ms) => v.zoomTo({}, ms))}>Centrar la estructura</button>
              <button type="button" className="btn small" disabled={engine !== 'disponible' || !s} onClick={exportPng}>Descargar imagen PNG</button>
            </>}
            {fallbackOpen && <button type="button" className="btn small" disabled={!s} onClick={exportSvg}>Descargar imagen SVG</button>}
          </div>
          {exportMsg && <p className="small muted" aria-live="polite">{exportMsg}</p>}
          {style === 'superficie' && !fallbackOpen && (
            <p className="small" aria-live="polite">
              {surf === 'calculando' && 'Calculando la superficie de van der Waals…'}
              {surf === 'lista' && 'Superficie de van der Waals (esferas con el radio de cada elemento) sobre la cinta.'}
              {surf === 'omitida' && `La superficie no se calcula para más de ${fmt(SURFACE_MAX_ATOMS, 0)} átomos (este equipo podría bloquearse); usa la cinta o las esferas.`}
              {surf === 'fallida' && 'No se pudo calcular la superficie en este equipo; usa la cinta o las esferas.'}
            </p>
          )}
          <ul className="small" aria-label={`Leyenda del color: ${COLOR_NAME[mode]}`} style={{ listStyle: 'none', padding: 0, margin: '6px 0', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
            {legend.map((l) => <li key={l.text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 3, background: l.color, border: '1px solid var(--line)', display: 'inline-block' }} />{l.text}</li>)}
          </ul>
          <p className="small muted" style={{ margin: '4px 0 10px' }}>
            Toca un átomo en el modelo para elegirlo (el próximo será el <strong>{slot === 0 ? 'A' : 'B'}</strong>) o usa las listas de la derecha con el teclado.
          </p>
          {s && <SequenceBench s={s} colors={colors} markA={atomA} markB={atomB} markR={resR} dist={currentDist} />}
        </div>

        {textError && <Notice kind="bad">{textError}</Notice>}
        {parsed?.error && <Notice kind="bad">No se pudo leer el archivo: {parsed.error}</Notice>}
        {entry.note && <Notice kind="warn">{entry.note}</Notice>}

        <Readout items={distItems} />
        {currentDist && <Notice>{currentDist.kind === 'misma cadena' ? `Los dos átomos están en la cadena ${chainA}, a ${currentDist.separation} residuos de distancia en la secuencia.` : currentDist.kind === 'cadenas distintas' ? 'Los átomos están en cadenas distintas: la separación en la secuencia no aplica.' : currentDist.kind === 'mismo residuo' ? 'Los dos átomos son del mismo residuo.' : 'Uno de los átomos es de un heterogrupo o del agua (fuera de la cadena polimérica).'} {isPred ? 'Es una distancia en un modelo predicho, no una medición.' : 'Es una distancia en la estructura promedio del experimento; su incertidumbre depende de la resolución y del factor B.'}</Notice>}
        {error && <Notice kind="bad">{error}</Notice>}
        <Readout items={resItems} />
        {rr?.resName === 'HIS' && <p className="small muted">{HIS_NOTE}</p>}

        <div className="card stack">
          <h3>¿De dónde sale esta estructura?</h3>
          <div className="btn-row" role="note" aria-label="Procedencia de la estructura">
            <StatusChip status={statusOf(entry.kind)} prefix="Coordenadas 3D" />
            <StatusChip status="modelo" prefix="Distancias, conteos y centroide" />
          </div>
          {ex && (
            <>
              <p className="small">
                <strong>Evidencia experimental</strong> de <strong>{entry.name}</strong>: entrada{' '}
                {entry.pageUrl ? <a href={entry.pageUrl} target="_blank" rel="noopener noreferrer">PDB {entry.id}</a> : `PDB ${entry.id}`} · método <strong>{ex.method}</strong>
                {ex.resolution !== null ? <> · resolución <strong>{fmt(ex.resolution, 2)} Å</strong></> : ' · resolución no informada'}
                {' '}· depositada el {ex.depositDate ?? '—'}, publicada el {ex.releaseDate ?? '—'}{ex.revisionDate ? ` (última revisión ${ex.revisionDate})` : ''}.
              </p>
              <p className="small">Título: «{ex.title}». {ex.entities.map((en) => `${en.description ?? 'entidad'} (cadenas ${en.chains.join(', ')}; ${en.organism.join(', ') || 'organismo no indicado'}${en.uniprot.length ? `; UniProt ${en.uniprot.join(', ')}` : ''})`).join(' · ')}</p>
              {ex.citation && <p className="small muted">Publicación: {ex.citation}</p>}
              <p className="small">Licencia de los datos: {ex.license}. {entry.origin === 'incluida' ? `Copia incluida sin modificar, descargada el ${entry.retrieved} de ` : `Descargada en vivo el ${entry.retrieved} de `}<a href={entry.sourceUrl ?? '#'} target="_blank" rel="noopener noreferrer">{entry.sourceUrl}</a>{entry.sha256 ? ` (SHA-256 ${entry.sha256.slice(0, 12)}…, ${fmt(entry.bytes / 1000, 0)} kB)` : ''}.</p>
              <p className="small">
                La resolución indica cuánto detalle tienen los datos (menos ångströms = más detalle). <strong>Alta resolución no significa que la proteína sea rígida</strong>: el
                factor B de cada átomo mide cuánto se mueve o varía su posición en el cristal. Colorea por «Factor B» y compara la superficie con el núcleo.
                La estructura es un promedio de muchas moléculas en el cristal y pueden faltar residuos que no se vieron en el mapa de densidad.
              </p>
            </>
          )}
          {pr && (
            <>
              <p className="small">
                <strong>Predicción computacional</strong> de <strong>{entry.name}</strong>: modelo{' '}
                {entry.pageUrl ? <a href={entry.pageUrl} target="_blank" rel="noopener noreferrer">{pr.entryId}</a> : pr.entryId} de AlphaFold DB · {pr.toolUsed ?? 'AlphaFold'} ·
                versión {pr.version ?? '—'} de la base de datos · modelo creado el {pr.modelCreatedDate ?? '—'} · UniProt {pr.uniprot}{pr.organism ? ` (${pr.organism})` : ''}.
              </p>
              <p className="small">
                pLDDT global según la API: {pr.globalMetricValue !== null ? fmt(pr.globalMetricValue, 2) : '—'}{s?.globalPlddt !== null && s?.globalPlddt !== undefined ? `; según el archivo: ${fmt(s.globalPlddt, 2)}` : ''}{plddt ? `; media de los Cα calculada aquí: ${fmt(plddt.mean, 2)}` : ''}.
                Fracción de residuos por banda (API): muy alta {pct(pr.fractions.veryHigh)}, alta {pct(pr.fractions.confident)}, baja {pct(pr.fractions.low)}, muy baja {pct(pr.fractions.veryLow)}.
              </p>
              <p className="small">Licencia: {pr.license}. {entry.origin === 'incluida' ? `Copia incluida sin modificar, descargada el ${entry.retrieved} de ` : `Descargado en vivo el ${entry.retrieved} de `}<a href={entry.sourceUrl ?? '#'} target="_blank" rel="noopener noreferrer">{entry.sourceUrl}</a>{entry.sha256 ? ` (SHA-256 ${entry.sha256.slice(0, 12)}…, ${fmt(entry.bytes / 1000, 0)} kB)` : ''}.</p>
              <p className="small"><strong>Una predicción no es una estructura medida ni «exacta».</strong> El modelo de AlphaFold es una hipótesis calculada a partir de la secuencia.</p>
            </>
          )}
          {entry.kind === 'local' && (
            <p className="small">
              <strong>Sin información disponible sobre su procedencia:</strong> es un archivo de tu equipo y el laboratorio no puede verificar de dónde salió.
              El archivo declara: {s?.id ? `identificador ${s.id}; ` : ''}{s?.method ? `método «${s.method}»; ` : ''}{s?.resolution ? `resolución ${fmt(s.resolution, 2)} Å; ` : ''}{s?.declaresPrediction ? 'se presenta como un modelo predicho (la columna B se interpreta como pLDDT); ' : ''}estos datos no están verificados.
            </p>
          )}
        </div>

        {isPred && (
          <div className="card stack">
            <h3>Confianza de la predicción</h3>
            <StatusChip status="prediccion" prefix="pLDDT y PAE" />
            <ul className="small" style={{ margin: 0 }}>
              {PLDDT_BANDS.map((b) => (
                <li key={b.band}><span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: b.color, marginRight: 6, verticalAlign: 'middle' }} />
                  <strong>{b.label}</strong> ({b.range}): {b.meaning}{plddt ? ` — ${plddt.counts[b.band]} residuos (${pct(plddt.fractions[b.band])})` : ''}.</li>
              ))}
            </ul>
            <p className="small">
              El <strong>pLDDT</strong> (0–100) es la confianza que el propio modelo asigna a la posición local de cada residuo; viene en la columna B del archivo.
              Sus límites: un pLDDT bajo suele marcar <strong>regiones desordenadas</strong> o que no se pudieron predecir (no les busques forma); AlphaFold predice
              <strong> una sola cadena</strong>, sin los <strong>complejos</strong> que forma en la célula, <strong>sin ligandos</strong>, iones ni modificaciones, y en <strong>una sola conformación</strong>;
              un pLDDT alto no garantiza que la orientación de dos dominios sea correcta: para eso se mira la PAE.
            </p>
            {pr?.pae ? (
              <>
                <PaeHeat pae={pr.pae} />
                <p className="small muted">
                  PAE (error de alineamiento predicho, en Å): error esperado en la posición de un residuo si se alinea el modelo en otro. Bloques oscuros fuera de la
                  diagonal indican dominios con posición relativa confiable. Es un <strong>resumen</strong>: promedio de bloques de {pr.pae.blockSize} × {pr.pae.blockSize} residuos
                  calculado {entry.origin === 'incluida' ? 'por el script de descarga' : 'en tu navegador'} a partir del archivo oficial{pr.paeUrl ? <> (<a href={pr.paeUrl} target="_blank" rel="noopener noreferrer">PAE completa</a>)</> : ''}.
                </p>
              </>
            ) : <p className="small muted">PAE: sin información disponible para este modelo.</p>}
          </div>
        )}

        <details className="card" open={fallbackOpen || undefined}>
          <summary>Tablas calculadas: cadenas, heterogrupos y residuos{fallbackOpen ? ' (vista 3D no disponible)' : ''}</summary>
          <p className="small muted">Conteos y valores calculados con el archivo (modelo calculado; primer modelo, posiciones alternativas contadas una vez). Coinciden con Biopython 1.85 en las estructuras incluidas.</p>
          {s && (
            <>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de cadenas">
                <table>
                  <caption className="sr-only">Cadenas de {entry.name}</caption>
                  <thead><tr><th>Cadena</th><th className="n">Residuos del polímero</th><th className="n">Aminoácidos estándar</th><th className="n">Heterogrupos</th><th className="n">Aguas</th><th className="n">Átomos</th><th className="n">Hélice α</th><th className="n">Hebra β</th></tr></thead>
                  <tbody>{s.chains.map((c) => { const f = secondaryFractions(s, c.id); return <tr key={c.id}><td>{c.id}</td><td className="n">{c.polymer}</td><td className="n">{c.standard}</td><td className="n">{c.hetero}{c.heteroNames.length ? ` (${c.heteroNames.join(', ')})` : ''}</td><td className="n">{c.water}</td><td className="n">{fmt(c.atoms, 0)}</td><td className="n">{s.ss.fromFile && f.n ? pct(f.helice) : '—'}</td><td className="n">{s.ss.fromFile && f.n ? pct(f.hebra) : '—'}</td></tr>; })}</tbody>
                  <tfoot><tr><td>Total</td><td className="n">{s.chains.reduce((t, c) => t + c.polymer, 0)}</td><td className="n">{s.chains.reduce((t, c) => t + c.standard, 0)}</td><td className="n">{s.chains.reduce((t, c) => t + c.hetero, 0)}</td><td className="n">{s.chains.reduce((t, c) => t + c.water, 0)}</td><td className="n">{fmt(s.atoms.length, 0)}</td><td className="n">{ssFrac && s.ss.fromFile ? pct(ssFrac.helice) : '—'}</td><td className="n">{ssFrac && s.ss.fromFile ? pct(ssFrac.hebra) : '—'}</td></tr></tfoot>
                </table>
              </div>
              <p className="small muted">Registros de átomos del primer modelo: {fmt(s.atomRecords, 0)}{s.atomRecords !== s.atoms.length ? ` (${fmt(s.atomRecords - s.atoms.length, 0)} son posiciones alternativas del mismo átomo)` : ''}. {s.ss.fromFile ? `Estructura secundaria del archivo: ${s.ss.helixRows} hélices, ${s.ss.strandRows + s.ss.sheetRows} hebras.` : 'El archivo no declara la estructura secundaria (el visor 3D puede estimarla por su cuenta).'}</p>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de heterogrupos" style={{ marginTop: 8 }}>
                <table>
                  <caption className="sr-only">Heterogrupos de {entry.name}</caption>
                  <thead><tr><th>Cadena</th><th>Código</th><th className="n">Número</th><th>Qué es</th><th className="n">Átomos</th><th>Ubicación</th></tr></thead>
                  <tbody>{ligandList.length ? ligandList.map((l) => <tr key={l.residue}><td>{l.chain}</td><td>{l.resName}</td><td className="n">{l.resSeq}</td><td>{HETERO_NAMES[l.resName] ?? 'heterogrupo (consulta el diccionario de componentes químicos del PDB)'}</td><td className="n">{l.atoms}</td><td>{l.inPolymer ? 'dentro de la cadena (residuo modificado)' : 'fuera de la cadena (ligando o ion)'}</td></tr>) : <tr><td colSpan={6}>Sin heterogrupos (aparte del agua). {isPred ? 'AlphaFold no modela ligandos.' : ''}</td></tr>}</tbody>
                </table>
              </div>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de residuos" style={{ marginTop: 8, maxHeight: 320, overflow: 'auto' }}>
                <table>
                  <caption className="sr-only">Residuos del polímero de {entry.name}</caption>
                  <thead><tr><th>Cadena</th><th>Residuo</th><th>Clase</th><th>Estructura secundaria</th><th className="n">{isPred ? 'pLDDT' : 'Factor B del Cα (Å²)'}</th></tr></thead>
                  <tbody>{s.residues.filter((r) => r.polymer).map((r) => <tr key={r.index}><td>{r.chain}</td><td>{resLabel(r)}</td><td>{AMINO_ACIDS[r.resName]?.cls ?? 'modificado'}</td><td>{s.ss.fromFile ? SS_LABEL[r.ss] : 'no declarada'}</td><td className="n">{r.ca !== null ? fmt(s.atoms[r.ca].b, 2) : '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Estructura</h3>
          <Select label="Estructura" value={entry.key} onChange={(v) => { setEntryKey(v); playSound('click', { intensity: 0.3 }); }}
            options={entries.map((e) => ({ value: e.key, label: `${e.name} · ${e.id} · ${e.kind === 'experimental' ? 'experimental' : e.kind === 'prediccion' ? 'predicha' : 'archivo local'}${e.origin === 'en vivo' ? ' (en vivo)' : ''}` }))} />
          <div className="btn-row" role="note" aria-label="Estatus de la estructura elegida"><StatusChip status={statusOf(entry.kind)} prefix="Origen" /></div>
          <Segmented label="Estilo de representación" value={style} options={STYLE_OPTIONS} onChange={(v) => setStyle(v)} />
          <Select label="Colorear por" value={mode} options={colorOptions} onChange={(v) => setColorMode(v as ColorMode)} />
          <label className="check"><input type="checkbox" checked={showLigands} onChange={(e) => setShowLigands(e.target.checked)} /> Mostrar ligandos y heterogrupos</label>
          <label className="check"><input type="checkbox" checked={showWater} onChange={(e) => setShowWater(e.target.checked)} disabled={fallbackOpen} /> Mostrar las moléculas de agua del cristal</label>
          {s && s.chains.length > 1 && (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="small" style={{ fontWeight: 600 }}>Cadenas visibles</legend>
              <div className="btn-row">
                {s.chains.filter((c) => c.polymer > 0).map((c) => (
                  <label key={c.id} className="check"><input type="checkbox" checked={!hiddenChains.includes(c.id)}
                    onChange={(e) => setHiddenChains((h) => (e.target.checked ? h.filter((x) => x !== c.id) : [...h, c.id]))} /> Cadena {c.id}</label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="card stack">
          <h3>Medir una distancia</h3>
          {s && atomA !== null && atomB !== null ? (
            <>
              <Select label="Cadena del átomo A" value={chainA} options={chainOptions} onChange={(c) => setAtomA(firstAtomOf(firstResOf(c)))} />
              <Select label="Residuo del átomo A" value={String(s.atoms[atomA].residue)} options={residueOptions(chainA)} onChange={(v) => setAtomA(firstAtomOf(Number(v)))} />
              <Select label="Átomo A" value={String(atomA)} options={atomOptions(s.atoms[atomA].residue)} onChange={(v) => setAtomA(Number(v))} />
              <Select label="Cadena del átomo B" value={chainB} options={chainOptions} onChange={(c) => setAtomB(firstAtomOf(firstResOf(c)))} />
              <Select label="Residuo del átomo B" value={String(s.atoms[atomB].residue)} options={residueOptions(chainB)} onChange={(v) => setAtomB(firstAtomOf(Number(v)))} />
              <Select label="Átomo B" value={String(atomB)} options={atomOptions(s.atoms[atomB].residue)} onChange={(v) => setAtomB(Number(v))} />
              <div className="btn-row"><button type="button" className="btn primary" onClick={measure}>Medir distancia</button></div>
              <RecordButton onRecord={recordDist} disabled={!currentDist} label="Guardar distancia en la tabla" />
              {!currentDist && <p className="small muted">Mide para poder guardar la distancia.</p>}
            </>
          ) : <p className="small">Cargando la estructura…</p>}
        </div>

        <div className="card stack">
          <h3>Analizar un residuo</h3>
          {s && resR !== null ? (
            <>
              <Select label="Cadena del residuo" value={chainR} options={chainOptions} onChange={(c) => setResR(firstResOf(c))} />
              <Select label="Residuo para analizar" value={String(resR)} options={residueOptions(chainR)} onChange={(v) => setResR(Number(v))} />
              <div className="btn-row"><button type="button" className="btn" onClick={analyze}>Analizar residuo</button></div>
              <RecordButton onRecord={recordRes} disabled={!currentRes} label="Guardar residuo en la tabla" />
            </>
          ) : <p className="small">Cargando la estructura…</p>}
        </div>

        <div className="card stack">
          <h3>Buscar otra estructura</h3>
          <div className="field">
            <label htmlFor="p3d-pdb">Código PDB (4 caracteres)</label>
            <input id="p3d-pdb" type="text" value={pdbQuery} maxLength={8} placeholder="p. ej. 1DP0" autoComplete="off" spellCheck={false}
              onChange={(e) => setPdbQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) searchPdb(); }} />
          </div>
          <button type="button" className="btn" onClick={() => searchPdb()} disabled={busy}>Buscar por ID de PDB</button>
          <div className="field">
            <label htmlFor="p3d-af">Accesión de UniProt (6 o 10 caracteres)</label>
            <input id="p3d-af" type="text" value={afQuery} maxLength={12} placeholder="p. ej. P09848" autoComplete="off" spellCheck={false}
              onChange={(e) => setAfQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) searchAf(); }} />
          </div>
          <button type="button" className="btn" onClick={() => searchAf()} disabled={busy}>Buscar por UniProt en AlphaFold</button>
          {busy && <button type="button" className="btn small ghost" onClick={cancelSearch}>Cancelar la búsqueda</button>}
          <p className="small" aria-live="polite">{liveState !== 'inactivo' && <><strong>Estado: {liveState}.</strong> {liveMsg}</>}</p>
          <p className="small muted">Requiere internet. Se consultan directamente RCSB PDB (data.rcsb.org y files.rcsb.org) y AlphaFold DB (alphafold.ebi.ac.uk), sin servidor propio, una solicitud a la vez y con {FETCH_TIMEOUT_MS / 1000} s de tiempo máximo. Archivos de hasta {fmt(STRUCTURE_LIMITS.maxChars / 1e6, 0)} millones de caracteres y {fmt(STRUCTURE_LIMITS.maxAtoms, 0)} átomos.</p>
          <details>
            <summary className="small">Proteínas de la práctica «Rastreo génico»</summary>
            <ul className="small" style={{ paddingLeft: 18 }}>
              {genesLinks.map((g) => (
                <li key={g.symbol} style={{ marginBottom: 4 }}>
                  <strong>{g.symbol}</strong> · {g.protein} ({g.length} aa, UniProt {g.acc}){' '}
                  {g.pdb ? <button type="button" className="btn small ghost" disabled={busy} onClick={() => searchPdb(g.pdb!)}>Experimental: PDB {g.pdb}</button> : <span className="muted">sin estructura experimental referenciada · </span>}
                  {g.af && <button type="button" className="btn small ghost" disabled={busy} onClick={() => searchAf(g.af!)}>Predicha: AlphaFold {g.af}</button>}
                </li>
              ))}
            </ul>
            <p className="small muted">Identificadores tomados de src/data/genes.ts (UniProt y RCSB, consultados el 2026-10-18). Compara la β-globina medida (2HHB, cadenas B y D) con su predicción (AlphaFold P68871).</p>
          </details>
        </div>

        <div className="card stack">
          <h3>Abrir un archivo local</h3>
          <div className="field">
            <label htmlFor="p3d-file">Archivo PDB o mmCIF de tu equipo</label>
            <input id="p3d-file" type="file" accept=".pdb,.ent,.cif,.mmcif,chemical/x-pdb,chemical/x-mmcif" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <p className="small" aria-live="polite">{fileMsg}</p>
          <p className="small muted">Se lee en tu navegador (no se envía a ningún servidor). Texto PDB o mmCIF de hasta {fmt(STRUCTURE_LIMITS.maxFileBytes / 1e6, 0)} MB; no se aceptan BinaryCIF ni archivos comprimidos.</p>
        </div>

        <Notice>
          Una predicción de AlphaFold no es una estructura medida: es un modelo con confianza variable por región. Una estructura experimental tampoco es una
          foto exacta: tiene método, resolución y regiones móviles. Incluidas: {BUNDLED.length} estructuras descargadas el {PROTEINS_RETRIEVED}. Visor: 3Dmol.js 2.5.5 (BSD-3-Clause).
        </Notice>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { GLViewer } from '3dmol';
import { mixHex, useBoxWidth } from '../../chem/SpeciesScene3D';
import { cssVar, reducedMotion, use3DViewer, useThemeVersion } from '../../chem/engine3d';
import { ProteinTraceSvg, type TraceExtra, type TracePoint } from '../../components/ProteinTraceSvg';
import { StatusChip } from '../../components/Provenance';
import { STRUCTURE_LOADERS } from '../../data/proteins';
import { fmt } from '../../lib/format';
import { caTrace, parseStructure, PLDDT_BANDS, plddtBand, type ProteinStructure } from '../../models/protein';

export type ProteinColor = 'gen' | 'plddt' | 'factorB';

export interface ResidueMark { chain: string; resSeq: number; label: string }

const FALLBACK_HEX: Record<string, string> = { '--series-2': '#1e5fae', '--series-4': '#8b3aa3', '--data': '#b23a0a', '--ink': '#1d2327', '--surface': '#ffffff' };
const tokenHex = (t: string) => cssVar(t, FALLBACK_HEX[t] ?? '#888888');
const GREY = '#b9c0c4';
const FADED = '#e2e6e8';
const BAND_COLOR = Object.fromEntries(PLDDT_BANDS.map((b) => [b.band, b.color])) as Record<string, string>;

/** Degradado azul → blanco → rojo del factor B (relativo a la propia estructura), como en la práctica de proteínas. */
function bGradient(t: number): string {
  const lo = [33, 102, 172], mid = [247, 247, 247], hi = [178, 24, 43];
  const u = Math.max(0, Math.min(1, t));
  const [a, b, k] = u < 0.5 ? [lo, mid, u * 2] : [mid, hi, (u - 0.5) * 2];
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** Texto de la estructura cargada desde el repositorio (importación diferida `?raw`, la misma de la práctica de proteínas). */
function useStructure(file: string): { text: string | null; s: ProteinStructure | null; error: string | null } {
  const [state, setState] = useState<{ file: string; text: string | null; error: string | null }>({ file, text: null, error: null });
  useEffect(() => {
    let alive = true;
    const load = STRUCTURE_LOADERS[file];
    if (!load) { setState({ file, text: null, error: `La estructura ${file} no está en el repositorio.` }); return; }
    setState({ file, text: null, error: null });
    load().then((t) => { if (alive) setState({ file, text: t, error: null }); }).catch((e) => { if (alive) setState({ file, text: null, error: e instanceof Error ? e.message : String(e) }); });
    return () => { alive = false; };
  }, [file]);
  const text = state.file === file ? state.text : null;
  const s = useMemo(() => (text ? parseStructure(text) : null), [text]);
  return { text, s, error: state.file === file ? state.error : null };
}

/**
 * Proteína incluida en el repositorio (2LZM, 2HHB, 3I40 o el modelo de AlphaFold de OCA2) en 3Dmol.js con carga
 * diferida, con residuos marcados (barras y etiqueta), un tramo atenuado opcional (lo que ya no se fabricaría) y
 * colores por cadena del gen, pLDDT o factor B. Sin WebGL: traza de los Cα en SVG con las mismas coordenadas.
 */
export function ProteinSpot3D({ file, title, status, idPrefix, height = 340, marks, fadedFrom = [], color, geneChains = [], unfolded = 0, description, caption, children }: {
  file: string; title: string; status: 'experimental' | 'prediccion'; idPrefix: string; height?: number;
  marks: ResidueMark[]; fadedFrom?: { chain: string; resSeq: number }[]; color: ProteinColor; geneChains?: string[]; /** 0–1: cuánto se aclara la cinta hacia el gris (fracción desnaturalizada del modelo; sin transparencia). */ unfolded?: number;
  description: string; caption: ReactNode; children?: ReactNode;
}) {
  const { text, s, error } = useStructure(file);
  const hostRef = useRef<HTMLDivElement>(null);
  const { viewerRef, engine, retry, fail } = use3DViewer(hostRef, `proteína 3D ${idPrefix}`);
  const theme = useThemeVersion();
  const loaded = useRef('');
  const boxRef = useRef<HTMLDivElement>(null);
  const boxW = useBoxWidth(boxRef, Math.round(height * 1.8));
  const [picked, setPicked] = useState<string | null>(null);

  const bRange = useMemo(() => {
    if (!s) return [0, 1] as const;
    const bs = s.residues.filter((r) => r.ca !== null && r.polymer).map((r) => s.atoms[r.ca!].b);
    return [Math.min(...bs), Math.max(...bs)] as const;
  }, [s]);
  const isFaded = useMemo(() => (chain: string, resSeq: number) => fadedFrom.some((f) => f.chain === chain && resSeq >= f.resSeq), [fadedFrom]);
  const colorOf = useMemo(() => (chain: string, resSeq: number, b: number) => mixHex(baseColor(chain, resSeq, b), FADED, Math.max(0, Math.min(1, unfolded)) * 0.85),
    [unfolded, isFaded, color, bRange, geneChains, theme]);
  function baseColor(chain: string, resSeq: number, b: number): string {
    if (isFaded(chain, resSeq)) return FADED;
    if (color === 'plddt') return BAND_COLOR[plddtBand(Math.max(0, Math.min(100, b)))];
    if (color === 'factorB') return bGradient((b - bRange[0]) / Math.max(1e-6, bRange[1] - bRange[0]));
    return geneChains.length === 0 || geneChains.includes(chain) ? tokenHex('--series-2') : GREY;
  }
  /** Etiqueta de cada marca; en un modelo predicho, con el pLDDT del Cα (columna B del archivo). */
  const markInfo = useMemo(() => marks.map((mk) => {
    const r = s?.residues.find((x) => x.chain === mk.chain && x.resSeq === mk.resSeq && x.ca !== null) ?? null;
    const ca = r && s ? s.atoms[r.ca!] : null;
    return { mk, r, ca, label: ca && status === 'prediccion' ? `${mk.label} · pLDDT ${fmt(ca.b, 1)}` : mk.label };
  }), [marks, s, status]);

  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v || !text || !s) return;
    try {
      if (loaded.current !== file) {
        loaded.current = file;
        v.removeAllModels(); v.removeAllShapes(); v.removeAllLabels();
        v.addModel(text, 'cif', { altLoc: 'A' } as never);
        v.resize(); v.zoomTo();
      }
      const m = v.getModel();
      m.setColorByFunction({}, (a: { chain?: string; resi?: number; b?: number }) => colorOf(a.chain ?? '', a.resi ?? 0, a.b ?? 0));
      v.setStyle({}, { cartoon: { arrows: true } });
      v.setStyle({ resn: ['HOH', 'WAT'] } as never, {});
      v.addStyle({ hetflag: true, not: { resn: ['HOH', 'WAT'] } } as never, { stick: { radius: 0.2, colorscheme: 'Jmol' } });
      v.removeAllShapes(); v.removeAllLabels();
      const data = tokenHex('--data'), surface = tokenHex('--surface');
      for (const { mk, ca, label } of markInfo) {
        v.addStyle({ chain: mk.chain, resi: mk.resSeq } as never, { stick: { radius: 0.28, colorscheme: 'Jmol' } });
        if (!ca) continue;
        v.addSphere({ center: { x: ca.x, y: ca.y, z: ca.z }, radius: 1.6, color: data, wireframe: true, quality: 1 } as never);
        v.addLabel(label, { position: { x: ca.x, y: ca.y, z: ca.z }, fontSize: 13, fontColor: surface, backgroundColor: data, backgroundOpacity: 0.95, inFront: true, alignment: 'bottomLeft' });
      }
      v.render();
    } catch (e) { fail(e); }
  }, [engine, text, s, file, markInfo, colorOf, viewerRef, fail]);

  const view = (fn: (v: GLViewer, ms: number) => void) => {
    const v = viewerRef.current;
    if (!v) return;
    try { fn(v, reducedMotion() ? 0 : 400); v.render(); } catch { /* sin visor */ }
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rot: Record<string, [number, 'x' | 'y']> = { ArrowLeft: [-10, 'y'], ArrowRight: [10, 'y'], ArrowUp: [-10, 'x'], ArrowDown: [10, 'x'] };
    if (rot[e.key]) { e.preventDefault(); view((v) => v.rotate(rot[e.key][0], rot[e.key][1], 0)); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); view((v) => v.zoom(1.15, 0)); }
    else if (e.key === '-') { e.preventDefault(); view((v) => v.zoom(1 / 1.15, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); view((v) => v.zoomTo()); }
  };

  const trace = useMemo(() => {
    if (!s) return null;
    const segments = caTrace(s).flatMap((t) => t.segments.map((seg) => ({
      chain: t.chain,
      points: seg.map((ai): TracePoint => { const a = s.atoms[ai]; const r = s.residues[a.residue]; return { atom: ai, x: a.x, y: a.y, z: a.z, color: colorOf(r.chain, r.resSeq, a.b), label: `${r.chain}/${r.resName}${r.resSeq}` }; }),
    })));
    const extras: TraceExtra[] = s.residues.filter((r) => r.kind === 'hetero' && !r.polymer).flatMap((r) => r.atoms.filter((ai) => s.atoms[ai].element === 'Fe').map((ai) => {
      const a = s.atoms[ai]; return { atom: ai, x: a.x, y: a.y, z: a.z, element: 'Fe', label: `${r.chain}/${r.resName}${r.resSeq}/${a.name}` };
    }));
    const highlight = markInfo.flatMap(({ r, ca, label }) => (r && ca ? [{ ...ca, atom: r.ca!, tag: label }] : []));
    return { segments, extras, highlight };
  }, [s, colorOf, markInfo]);

  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const descId = `${idPrefix}-p3d-desc`;
  const first = marks[0];

  return (
    <figure className="chem3d" style={{ margin: 0, minWidth: 0, maxWidth: '100%' }}>
      <div ref={boxRef} style={{ position: 'relative', width: '100%', height, borderRadius: 12, background: 'radial-gradient(120% 90% at 30% 20%, var(--surface), var(--surface-2))', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div ref={hostRef} role="img" tabIndex={engine === 'disponible' ? 0 : -1} aria-label={`${title}: modelo 3D en cinta; arrastra o usa las flechas para girarlo, + y − para acercar`} aria-describedby={descId} onKeyDown={onKey}
          style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' && s ? 'visible' : 'hidden' }} />
        {(engine === 'cargando' || (!s && !error)) && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><p role="status" className="small">Cargando la estructura y el visor 3D…</p></div>}
        {error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 16 }}><p className="small">No se pudo cargar la estructura: {error}</p></div>}
        {fallback && trace && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ProteinTraceSvg segments={trace.segments} extras={trace.extras} highlight={trace.highlight} measure={null} title={title} describedBy={descId}
              onPick={(ai) => { const r = s!.residues[s!.atoms[ai].residue]; setPicked(`${r.chain}/${r.resName}${r.resSeq}`); }} height={height} width={boxW} />
          </div>
        )}
      </div>
      <p id={descId} className="sr-only">{description}</p>
      <figcaption className="small" style={{ marginTop: 6 }}>
        <StatusChip status={status} prefix="Estructura" /> <span className="muted">{caption}</span>
      </figcaption>
      {markInfo.length > 0 && s && (
        <p className="small" style={{ margin: '4px 0 0' }}>
          <strong>Marcado:</strong> {[...new Set(markInfo.map(({ mk, r, label }) => `${label}${r ? ` (cadena ${mk.chain}, ${r.resName})` : ` (cadena ${mk.chain}: no resuelto en el archivo)`}`))].join('; ')}.
        </p>
      )}
      {fallback && (
        <div className="notice small" role="status" style={{ marginTop: 6 }}>
          <strong>Vista de respaldo:</strong> {engine === 'sin-webgl' ? 'este equipo no ofrece WebGL;' : 'no se pudo cargar el visor 3D;'} se dibuja la traza de los carbonos alfa con las coordenadas del archivo y los residuos marcados. Gírala con las flechas del teclado.{picked ? ` Residuo tocado: ${picked}.` : ''}
          {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={retry}>Reintentar el visor 3D</button></>}
        </div>
      )}
      {!fallback && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          {first && <button type="button" className="btn small" disabled={engine !== 'disponible' || !s} onClick={() => view((v) => v.zoomTo({ chain: first.chain, resi: first.resSeq } as never, reducedMotion() ? 0 : 500))}>Acercar a {first.label}</button>}
          <button type="button" className="btn small" disabled={engine !== 'disponible' || !s} onClick={() => view((v, ms) => v.rotate(90, 'y', ms))}>Girar 90°</button>
          <button type="button" className="btn small" disabled={engine !== 'disponible' || !s} onClick={() => view((v) => v.zoomTo())}>Ver toda la proteína</button>
        </div>
      )}
      {children}
    </figure>
  );
}

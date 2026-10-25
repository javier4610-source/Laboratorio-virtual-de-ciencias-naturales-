import { useEffect, useMemo, useRef, useState } from 'react';
import type { GLViewer } from '3dmol';
import { fmt } from '../lib/format';
import { StatusChip } from '../components/Provenance';
import { Segmented, Select } from '../components/ui';
import { ballRadius, drawRadius } from './elements';
import { applyMolStyle, type MolStyle } from './molStyle';
import { ProjectedSvg } from './ProjectedSvg';
import { atomAngle, atomDistance, describeSpecies, toSdf, type Species3D } from './species';
import { cssVar, reducedMotion, use3DViewer, useThemeVersion } from './engine3d';

export type { MolStyle };
const STYLE_OPTIONS: { value: MolStyle; label: string }[] = [
  { value: 'bs', label: 'Esferas y palitos' },
  { value: 'esf', label: 'Espacio lleno' },
  { value: 'pal', label: 'Palitos' },
];
/** Radios de la vista de respaldo en SVG: los mismos de «esferas y palitos» que en 3Dmol (src/chem/molStyle.ts). */
const SVG_R: Record<MolStyle, (el: string) => number> = {
  bs: (el) => ballRadius(el),
  esf: (el) => drawRadius(el) * 1.6,
  pal: () => 0.14,
};

export const statusOf = (s: Species3D) => (s.geometry === 'atomo' ? 'ilustracion' : 'modelo') as 'ilustracion' | 'modelo';

/** Mueve el encuadre de 3Dmol a una esfera de radio r (Å) centrada en el origen de la especie. */
export function frameRadius(v: GLViewer, atoms: { x: number; y: number; z: number }[], minRadius = 5) {
  v.resize();
  v.zoomTo();
  const n = atoms.length || 1;
  const c = [atoms.reduce((t, a) => t + a.x, 0) / n, atoms.reduce((t, a) => t + a.y, 0) / n, atoms.reduce((t, a) => t + a.z, 0) / n];
  const radius = Math.max(0.5, ...atoms.map((a) => Math.hypot(a.x - c[0], a.y - c[1], a.z - c[2]))) + 1.2;
  if (radius < minRadius) v.zoom(Math.min(3, minRadius / radius));
}

export interface Molecule3DProps {
  species: Species3D;
  /** Prefijo único de ids dentro del laboratorio. */
  idPrefix: string;
  height?: number;
  defaultStyle?: MolStyle;
  /** Muestra los controles de estilo, etiquetas y giro (por defecto sí). */
  controls?: boolean;
  /** Permite elegir átomos y medir distancias (2 átomos) o ángulos (3 átomos). */
  measure?: boolean;
  /** Texto adicional para la descripción accesible. */
  extraDescription?: string;
}

/**
 * Visor molecular reutilizable: 3Dmol.js con carga diferida y vista de respaldo en SVG (sin WebGL o sin conexión),
 * estilos esferas y palitos / espacio lleno / palitos, etiquetas, giro, selección y medición opcional, tema claro y
 * oscuro, controles accesibles con teclado y descripción textual. Muestra siempre el rótulo de procedencia.
 */
export function Molecule3D({ species, idPrefix, height = 300, defaultStyle = 'bs', controls = true, measure = false, extraDescription }: Molecule3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { viewerRef, engine, retry, fail } = use3DViewer(hostRef, `molécula 3D ${idPrefix}`);
  const theme = useThemeVersion();
  const [style, setStyle] = useState<MolStyle>(defaultStyle);
  const [labels, setLabels] = useState(false);
  const [spin, setSpin] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const sdf = useMemo(() => toSdf(species), [species]);
  const framed = useRef('');
  const pickRef = useRef<(i: number) => void>(() => {});
  pickRef.current = (i: number) => {
    if (!measure || i < 0 || i >= species.atoms.length) return;
    setSel((prev) => (prev.length >= 3 ? [i] : prev.includes(i) ? prev : [...prev, i]));
  };
  useEffect(() => { setSel([]); }, [species]);

  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      v.removeAllModels(); v.removeAllShapes(); v.removeAllLabels();
      v.addModel(sdf, 'sdf');
      applyMolStyle(v, style, species.atoms.map((a) => a.el));
      if (measure) v.setClickable({}, true, (atom: { index?: number }) => { if (typeof atom?.index === 'number') pickRef.current(atom.index); });
      const ink = cssVar('--ink', '#12201e'), surface = cssVar('--surface', '#ffffff'), data = cssVar('--data', '#b23a0a');
      const P = (i: number) => ({ x: species.atoms[i].x, y: species.atoms[i].y, z: species.atoms[i].z });
      if (labels) species.atoms.forEach((a, i) => v.addLabel(`${a.el}${i + 1}`, { position: P(i), fontSize: 12, fontColor: ink, backgroundColor: surface, backgroundOpacity: 0.75, borderThickness: 0, inFront: true, alignment: 'bottomLeft' }));
      for (const i of sel) v.addSphere({ center: P(i), radius: style === 'esf' ? 1.3 : 0.55, color: data, opacity: 0.35 });
      if (framed.current !== sdf) { framed.current = sdf; frameRadius(v, species.atoms); }
      if (spin && !reducedMotion()) v.spin('y', 0.6); else v.spin(false);
      v.render();
    } catch (e) { fail(e); }
  }, [engine, sdf, style, labels, sel, spin, theme, measure, species, viewerRef, fail]);

  const view = (fn: (v: GLViewer, ms: number) => void) => {
    const v = viewerRef.current;
    if (!v) return;
    try { fn(v, reducedMotion() ? 0 : 350); v.render(); } catch { /* sin visor */ }
  };

  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const lbl = (i: number) => `${species.atoms[i]?.el ?? '?'}${i + 1}`;
  const measured = sel.length === 2 ? { kind: 'Distancia', text: `${fmt(atomDistance(species, sel[0], sel[1]), 3)} Å` }
    : sel.length === 3 ? { kind: 'Ángulo', text: `${fmt(atomAngle(species, sel[0], sel[1], sel[2]), 1)}°` } : null;
  const desc = `${describeSpecies(species)}${extraDescription ? ` ${extraDescription}` : ''}${measured ? ` ${measured.kind} ${sel.map(lbl).join('–')}: ${measured.text}.` : ''}`;
  const descId = `${idPrefix}-m3d-desc`;

  return (
    <figure className="chem3d" style={{ margin: 0, minWidth: 0, maxWidth: "100%" }}>
      <div style={{ position: 'relative', width: '100%', height, borderRadius: 12, background: 'radial-gradient(120% 90% at 30% 20%, var(--surface), var(--surface-2))', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div ref={hostRef} role="img" aria-label={`Modelo 3D de ${species.name}; arrastra para girar y usa la rueda para acercar`} aria-describedby={descId}
          style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
        {engine === 'cargando' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><p role="status" className="small">Cargando el visor 3D (3Dmol.js)…</p></div>}
        {fallback && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ProjectedSvg ariaLabel={`${species.name}: vista de respaldo dibujada con las coordenadas del modelo; arrastra o usa las flechas para girarla`}
              atoms={species.atoms.map((a, i) => ({ ...a, r: SVG_R[style](a.el), label: lbl(i) }))} bonds={style === 'esf' ? [] : species.bonds} height={height} width={Math.round(height * 1.8)}
              selection={sel} onPick={measure ? (i) => pickRef.current(i) : undefined} showLabels={labels} showCharges />
          </div>
        )}
        <span className="chem3d-tag small" style={{ position: 'absolute', left: 10, top: 8, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--surface) 85%, transparent)', border: '1px solid var(--line)', fontWeight: 700, fontFamily: 'var(--font-data)' }} aria-hidden="true">{species.label}</span>
      </div>
      <p id={descId} className="sr-only">{desc}</p>
      <figcaption className="small" style={{ marginTop: 6 }}>
        <StatusChip status={statusOf(species)} prefix="Geometría" />{' '}
        <span className="muted">{species.geometryLabel.replace(/^[^:]+:\s*/, '')}{species.source?.cid ? <> · PubChem CID <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${species.source.cid}`} target="_blank" rel="noopener noreferrer">{species.source.cid}</a> ({species.source.fecha})</> : null}</span>
      </figcaption>
      {fallback && (
        <div className="notice small" role="status" style={{ marginTop: 6 }}>
          <strong>Vista de respaldo:</strong> {engine === 'sin-webgl' ? 'este equipo no ofrece WebGL;' : 'no se pudo cargar el visor 3D (por ejemplo, sin conexión);'} se dibuja con las mismas coordenadas. Gírala arrastrando o con las flechas del teclado.
          {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={retry}>Reintentar el visor 3D</button></>}
        </div>
      )}
      {controls && (
        <div className="stack" style={{ gap: 6, marginTop: 8 }}>
          <Segmented label={`Estilo del modelo de ${species.label}`} value={style} options={STYLE_OPTIONS} onChange={setStyle} />
          <div className="btn-row">
            <label className="check small"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Nombres de los átomos</label>
            {!fallback && <button type="button" className="btn small" aria-pressed={spin} disabled={engine !== 'disponible' || reducedMotion()} onClick={() => setSpin((s) => !s)}>{spin ? 'Detener el giro' : 'Girar continuamente'}</button>}
            {!fallback && <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => view((v, ms) => v.rotate(90, 'y', ms))}>Girar 90°</button>}
            {!fallback && <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => view((v) => frameRadius(v, species.atoms))}>Centrar</button>}
          </div>
        </div>
      )}
      {measure && (
        <div className="small" style={{ marginTop: 6 }} aria-live="polite">
          <div className="btn-row" style={{ alignItems: 'flex-end' }}>
            {[0, 1, 2].map((k) => (
              <Select key={k} label={`Átomo ${k + 1} de la medición en ${species.label}${k === 2 ? ' (opcional, para un ángulo)' : ''}`} value={sel[k] === undefined ? '' : String(sel[k])}
                options={[{ value: '', label: '—' }, ...species.atoms.map((_, i) => ({ value: String(i), label: lbl(i) }))]}
                onChange={(v) => setSel((prev) => { const next = [...prev]; if (v === '') return next.slice(0, k); next[k] = Number(v); return next.slice(0, k + 1).filter((x) => x !== undefined); })} />
            ))}
          </div>
          {sel.length === 0 && 'Toca 2 átomos para medir una distancia o 3 para un ángulo.'}
          {sel.length === 1 && `Elegido: ${lbl(sel[0])}. Toca otro átomo.`}
          {measured && <><strong>{measured.kind} {sel.map(lbl).join('–')}:</strong> <span className="data-value">{measured.text}</span> (calculado con las coordenadas del modelo). <button type="button" className="btn small ghost" onClick={() => setSel([])}>Borrar selección</button></>}
        </div>
      )}
    </figure>
  );
}

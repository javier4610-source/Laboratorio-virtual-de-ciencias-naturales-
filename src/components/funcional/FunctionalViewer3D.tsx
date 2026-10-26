import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusChip } from '../Provenance';
import { Segmented } from '../ui';
import { ProjectedSvg, toSdf, type Species3D } from '../../chem';
import { cssVar, use3DViewer, useThemeVersion, reducedMotion } from '../../chem/engine3d';
import { frameRadius, statusOf } from '../../chem/Molecule3D';
import { applyMolStyle } from '../../chem/molStyle';
import { ballRadius } from '../../chem/elements';

/**
 * Visor 3D de grupos funcionales, construido sobre el motor del kit (src/chem/engine3d.ts: 3Dmol.js diferido y respaldo SVG con las
 * mismas coordenadas). Añade lo que Molecule3D no trae (pedido anotado en scratchpad/chem-kit-pedidos.md): resaltado de VARIOS grupos
 * de átomos con colores y leyenda propios (grupo funcional, donadores y aceptores de puentes de hidrógeno, el N y sus carbonos…) y
 * una etiqueta de texto por grupo. Las coordenadas son las del confórmero (no se mueven); el resaltado es solo de dibujo.
 */
export interface Highlight {
  atoms: number[];
  /** Color CSS (variable de tema o hexadecimal). */
  color: string;
  /** Texto de la leyenda y de la etiqueta 3D (p. ej. «–OH (hidroxilo)»). */
  label: string;
}

export interface FunctionalViewer3DProps {
  species: Species3D;
  idPrefix: string;
  highlights: Highlight[];
  height?: number;
  /** Etiqueta visible del selector de estilo (debe ser única en la página). */
  styleLabel?: string;
  /** Descripción adicional para lectores de pantalla. */
  extraDescription?: string;
  /** Muestra las etiquetas de texto sobre el modelo 3D. */
  showTags?: boolean;
}

type St = 'bs' | 'pal' | 'esf';
const VDW: Record<string, number> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, F: 1.47, Cl: 1.75, Br: 1.85, I: 1.98 };
const COV: Record<string, number> = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Cl: 1.02, Br: 1.2, I: 1.39 };

/** Resuelve una variable CSS a un color concreto para 3Dmol. */
const resolve = (c: string) => (c.startsWith('var(') ? cssVar(c.slice(4, -1).split(',')[0].trim(), '#c2410c') : c);

export function FunctionalViewer3D({ species, idPrefix, highlights, height = 320, styleLabel = 'Estilo del modelo 3D', extraDescription, showTags = true }: FunctionalViewer3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { viewerRef, engine, retry, fail } = use3DViewer(hostRef, `visor de grupos ${idPrefix}`);
  const theme = useThemeVersion();
  const [style, setStyle] = useState<St>('bs');
  const [spin, setSpin] = useState(false);
  const sdf = useMemo(() => toSdf(species), [species]);
  const framed = useRef('');

  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      v.removeAllModels(); v.removeAllShapes(); v.removeAllLabels();
      v.addModel(sdf, 'sdf');
      applyMolStyle(v, style, species.atoms.map((a) => a.el));
      const ink = cssVar('--surface', '#ffffff');
      for (const h of highlights) {
        const col = resolve(h.color);
        for (const i of h.atoms) {
          const a = species.atoms[i]; if (!a) continue;
          const r = style === 'esf' ? (VDW[a.el] ?? 1.6) * 1.08 : (COV[a.el] ?? 0.7) * 1.05 + 0.3;
          v.addSphere({ center: { x: a.x, y: a.y, z: a.z }, radius: r, color: col, opacity: style === 'esf' ? 0.45 : 0.5 });
        }
        if (showTags && h.atoms.length) {
          const a = species.atoms[h.atoms[0]];
          v.addLabel(h.label.split(' (')[0], { position: { x: a.x, y: a.y, z: a.z }, fontSize: 13, fontColor: ink, backgroundColor: col, backgroundOpacity: 0.92, borderThickness: 0, inFront: true, alignment: 'bottomLeft' });
        }
      }
      if (framed.current !== sdf) { framed.current = sdf; frameRadius(v, species.atoms, 7); }
      if (spin && !reducedMotion()) v.spin('y', 0.5); else v.spin(false);
      v.render();
    } catch (e) { fail(e); }
  }, [engine, sdf, style, highlights, spin, theme, species, viewerRef, fail, showTags]);

  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const hlAll = highlights.flatMap((h) => h.atoms);
  const descId = `${idPrefix}-fv3d-desc`;
  const desc = `${species.name} (${species.label}): ${species.atoms.length} átomos. Resaltados: ${highlights.map((h) => `${h.label}, átomos ${h.atoms.map((i) => `${species.atoms[i]?.el}${i + 1}`).join(', ')}`).join('; ') || 'ninguno'}. ${species.geometryLabel}.${extraDescription ? ` ${extraDescription}` : ''}`;

  return (
    <figure className="chem3d fv3d" style={{ margin: 0, minWidth: 0, maxWidth: '100%' }}>
      <div className="fv3d-stage" style={{ position: 'relative', height, borderRadius: 14, border: '1px solid var(--line)', background: 'radial-gradient(120% 95% at 28% 18%, var(--surface), var(--surface-2))', overflow: 'hidden' }}>
        <div ref={hostRef} role="img" aria-label={`Modelo 3D de ${species.name} con los grupos resaltados; arrastra para girar`} aria-describedby={descId}
          style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
        {engine === 'cargando' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><p role="status" className="small">Cargando el visor 3D (3Dmol.js)…</p></div>}
        {fallback && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ProjectedSvg ariaLabel={`${species.name}: vista de respaldo con las coordenadas del confórmero; los átomos resaltados llevan un anillo. Arrastra o usa las flechas para girarla`}
              atoms={species.atoms.map((a) => ({ ...a, r: style === 'esf' ? (VDW[a.el] ?? 1.6) * 0.9 : style === 'bs' ? ballRadius(a.el) : 0.14 }))} bonds={style === 'esf' ? [] : species.bonds}
              height={height} width={Math.round(height * 1.8)} selection={hlAll} />
          </div>
        )}
        <span aria-hidden="true" className="small" style={{ position: 'absolute', left: 10, top: 8, padding: '2px 9px', borderRadius: 999, background: 'color-mix(in srgb, var(--surface) 86%, transparent)', border: '1px solid var(--line)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>{species.label}</span>
      </div>
      <p id={descId} className="sr-only">{desc}</p>
      {highlights.length > 0 && (
        <ul className="fv3d-legend small" aria-label="Leyenda de los grupos resaltados" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
          {highlights.map((h) => (
            <li key={h.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 999, background: h.color, boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface) 70%, transparent)' }} />
              {h.label}
            </li>
          ))}
        </ul>
      )}
      <figcaption className="small" style={{ marginTop: 6 }}>
        <StatusChip status={statusOf(species)} prefix="Geometría" />{' '}
        <span className="muted">{species.geometryLabel.replace(/^[^:]+:\s*/, '')}{species.source?.cid ? <> · PubChem CID <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${species.source.cid}`} target="_blank" rel="noopener noreferrer">{species.source.cid}</a> ({species.source.fecha})</> : null}. El color del resaltado es de dibujo.</span>
      </figcaption>
      {fallback && (
        <div className="notice small" role="status" style={{ marginTop: 6 }}>
          <strong>Vista de respaldo:</strong> {engine === 'sin-webgl' ? 'este equipo no ofrece WebGL;' : 'no se pudo cargar el visor 3D (por ejemplo, sin conexión);'} se dibuja con las mismas coordenadas y los átomos del grupo llevan un anillo.
          {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={retry}>Reintentar el visor 3D</button></>}
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <Segmented label={styleLabel} value={style} onChange={setStyle} options={[{ value: 'bs', label: 'Esferas y palitos' }, { value: 'pal', label: 'Palitos' }, { value: 'esf', label: 'Espacio lleno' }]} />
        {!fallback && <button type="button" className="btn small" aria-pressed={spin} disabled={engine !== 'disponible' || reducedMotion()} onClick={() => setSpin((s) => !s)}>{spin ? 'Detener el giro' : 'Girar continuamente'}</button>}
        {!fallback && <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => { const v = viewerRef.current; if (v) { try { frameRadius(v, species.atoms, 7); v.render(); } catch { /* sin visor */ } } }}>Centrar</button>}
      </div>
    </figure>
  );
}

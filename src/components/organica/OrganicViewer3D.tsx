import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusChip } from '../Provenance';
import { Segmented } from '../ui';
import type { EpistemicStatus } from '../../lib/provenance';
import { ProjectedSvg, toSdf, type Atom3D, type Bond3D, type Species3D } from '../../chem';
import { cssVar, use3DViewer, useThemeVersion } from '../../chem/engine3d';
import { frameRadius } from '../../chem/Molecule3D';
import { applyMolStyle } from '../../chem/molStyle';
import { ballRadius } from '../../chem/elements';

/**
 * Visor 3D para química orgánica construido sobre el motor del kit (src/chem/engine3d.ts: 3Dmol.js diferido y respaldo SVG).
 * Añade lo que el kit no trae (pedido anotado en scratchpad/chem-kit-pedidos.md): rótulos propios por átomo (p. ej. los
 * localizadores IUPAC), resaltado de átomos (la cadena principal) y un estatus epistémico elegido por quien lo usa (por ejemplo,
 * «Ilustración educativa» cuando las coordenadas son un confórmero girado a mano, no un cálculo).
 * Si cambia `viewKey` se reencuadra; si solo cambian las coordenadas (animación con un deslizador) se conserva la vista.
 */
export interface OrganicViewer3DProps {
  atoms: Atom3D[];
  bonds: Bond3D[];
  idPrefix: string;
  /** Texto accesible: qué se ve. */
  ariaLabel: string;
  status: EpistemicStatus;
  statusPrefix: string;
  /** Frase de procedencia visible debajo del visor. */
  provenance: React.ReactNode;
  labels?: (string | undefined)[];
  highlight?: number[];
  height?: number;
  viewKey: string;
  /** Muestra el selector de estilo (por defecto sí). */
  controls?: boolean;
  /** Etiqueta visible del selector de estilo (única en la página). */
  styleLabel?: string;
}

type St = 'bs' | 'pal' | 'esf';
const R: Record<string, number> = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Cl: 1.02, Br: 1.2, I: 1.39 };

export function OrganicViewer3D({ atoms, bonds, idPrefix, ariaLabel, status, statusPrefix, provenance, labels, highlight = [], height = 300, viewKey, controls = true, styleLabel = 'Estilo del modelo 3D' }: OrganicViewer3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { viewerRef, engine, retry, fail } = use3DViewer(hostRef, `visor orgánico ${idPrefix}`);
  const [style, setStyle] = useState<St>('bs');
  const theme = useThemeVersion();
  const framed = useRef('');
  const species: Species3D = useMemo(() => ({
    id: idPrefix, name: ariaLabel, label: '', atoms, bonds, charge: 0, geometry: 'pubchem', geometryLabel: '', method: '',
  }), [atoms, bonds, idPrefix, ariaLabel]);

  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      v.removeAllModels(); v.removeAllShapes(); v.removeAllLabels();
      v.addModel(toSdf(species), 'sdf');
      applyMolStyle(v, style, atoms.map((a) => a.el));
      const data = cssVar('--data', '#1971c2'), surface = cssVar('--surface', '#ffffff');
      for (const i of highlight) {
        const a = atoms[i]; if (!a) continue;
        v.addSphere({ center: { x: a.x, y: a.y, z: a.z }, radius: style === 'esf' ? (R[a.el] ?? 0.8) * 1.75 : 0.5, color: data, opacity: 0.28 });
      }
      labels?.forEach((t, i) => {
        if (!t) return;
        const a = atoms[i];
        v.addLabel(t, { position: { x: a.x, y: a.y, z: a.z }, fontSize: 14, fontColor: surface, backgroundColor: data, backgroundOpacity: 0.92, borderThickness: 0, inFront: true, alignment: 'center' });
      });
      if (framed.current !== viewKey) { frameRadius(v, atoms, 4.5); framed.current = viewKey; }
      v.render();
    } catch (e) { fail(e); }
  }, [engine, species, style, labels, highlight, theme, viewKey, atoms, viewerRef, fail]);

  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const hl = new Set(highlight);
  return (
    <div className="stack-sm">
      <div className="btn-row small" role="note" aria-label={`Procedencia de la vista 3D: ${statusPrefix}`}>
        <StatusChip status={status} prefix={statusPrefix} /> <span className="small muted">{provenance}</span>
      </div>
      <div style={{ position: 'relative', height, borderRadius: 'var(--radius)', border: '1px solid var(--line)', background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div ref={hostRef} id={`${idPrefix}-3d`} aria-hidden={fallback} style={{ position: 'absolute', inset: 0, display: fallback ? 'none' : 'block' }} />
        {engine === 'cargando' && <p className="small muted" style={{ position: 'absolute', top: 8, left: 12, margin: 0 }} aria-live="polite">Cargando el visor 3D…</p>}
        {!fallback && <span className="sr-only" role="img" aria-label={ariaLabel} />}
        {fallback && (
          <ProjectedSvg
            atoms={atoms.map((a, i) => ({ ...a, r: style === 'esf' ? (R[a.el] ?? 0.8) * 1.4 : style === 'bs' ? ballRadius(a.el) : 0.14, label: labels?.[i], opacity: highlight.length && !hl.has(i) && a.el !== 'H' ? 0.85 : 1 }))}
            bonds={bonds} ariaLabel={`${ariaLabel} (vista de respaldo en SVG con las mismas coordenadas; arrastra o usa las flechas para girar)`}
            height={height} width={640} showLabels={!!labels} selection={highlight} />
        )}
      </div>
      {fallback && (
        <p className="small muted">
          {engine === 'sin-webgl' ? 'Este equipo no tiene WebGL: se muestra la vista de respaldo en SVG con las mismas coordenadas.' : 'No se pudo cargar el visor 3D (¿sin conexión?): vista de respaldo en SVG con las mismas coordenadas. '}
          {engine === 'no-disponible' && <button type="button" className="btn small ghost" onClick={retry}>Reintentar el visor 3D</button>}
        </p>
      )}
      {controls && (
        <Segmented label={styleLabel} value={style} onChange={setStyle}
          options={[{ value: 'bs', label: 'Esferas y palitos' }, { value: 'pal', label: 'Palitos' }, { value: 'esf', label: 'Espacio lleno' }]} />
      )}
    </div>
  );
}

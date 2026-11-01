import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type { GLViewer } from '3dmol';
import { StatusChip } from '../components/Provenance';
import { Segmented } from '../components/ui';
import type { EpistemicStatus } from '../lib/provenance';
import { ballRadius, drawRadius, elementColor } from './elements';
import { ProjectedSvg } from './ProjectedSvg';
import { cssVar, reducedMotion, use3DViewer, useThemeVersion, type Viewer3DHost } from './engine3d';
import { type SceneAtom, type SceneBond, type SceneLabel, type SceneLine } from './sceneLayout';
import type { V3 } from './species';

type SStyle = 'bs' | 'esf';
const R_OF: Record<SStyle, (el: string) => number> = { bs: (el) => ballRadius(el), esf: (el) => drawRadius(el) * 1.25 };
const STICK_COLOR = '#8d989c';
/** Mezcla dos colores hexadecimales (t = 0 → a; t = 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => { const x = h.replace('#', ''); const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.slice(0, 6); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
  const A = p(a), B = p(b);
  if ([...A, ...B].some((v) => Number.isNaN(v))) return a;
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Ancho real (px) de un contenedor, para que la vista de respaldo en SVG use su proporción y no se encoja en el celular. */
export function useBoxWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const up = () => { const x = Math.round(el.clientWidth); if (x > 0) setW(x); };
    up();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(up);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return w;
}

const NO_LINES: SceneLine[] = [];
const NO_LABELS: SceneLabel[] = [];

/** Opacidad de lo atenuado (gas que salió, producto que no se formó): se ve, pero claramente aparte. */
export const DIM_OPACITY = 0.45;

function perpendicular(d: V3): V3 {
  const a: V3 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const c: V3 = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]];
  const n = Math.hypot(...c) || 1;
  return [c[0] / n, c[1] / n, c[2] / n];
}

export interface SpeciesScene3DProps {
  atoms: SceneAtom[];
  bonds: SceneBond[];
  lines?: SceneLine[];
  labels?: SceneLabel[];
  /** Prefijo único de ids dentro del laboratorio. */
  idPrefix: string;
  /** Nombre corto de la escena (etiqueta accesible del lienzo y de la vista de respaldo). */
  title: string;
  /** Descripción textual viva de la escena (se lee con aria-describedby). */
  description: string;
  height?: number;
  /** Estatus epistémico de la escena (por defecto, ilustración educativa) y texto del pie. */
  status?: EpistemicStatus;
  caption: ReactNode;
  /** Cambia cuando la escena cambia de tamaño o de contenido principal: se vuelve a encuadrar. */
  frameKey: string;
  /** Puntos que debe abarcar el encuadre (por defecto, los átomos y las aristas); úsalos si la escena crece después. */
  framePoints?: V3[];
  /** Contenido debajo del visor (leyenda, tablas…). */
  children?: ReactNode;
}

/**
 * Escena 3D de varias especies del kit (copias de moléculas, iones y átomos colocadas en bloques), con el mismo motor
 * que <Reaction3D>: 3Dmol.js con carga diferida (formas: esferas y cilindros, sin modelo) y vista de respaldo en SVG
 * con las mismas posiciones. Girar: arrastrar (ratón o dedo) o flechas del teclado con el lienzo enfocado; + y − acercan;
 * Inicio vuelve a encuadrar. Lo atenuado se dibuja translúcido y lo resaltado con un halo del color de datos.
 */
export function SpeciesScene3D({ atoms: rawAtoms, bonds, lines: rawLines = NO_LINES, labels: rawLabels = NO_LABELS, idPrefix, title, description, height = 320, status = 'ilustracion', caption, frameKey, framePoints, children }: SpeciesScene3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { viewerRef, engine, retry, fail } = use3DViewer(hostRef, `escena 3D ${idPrefix}`);
  const theme = useThemeVersion();
  const [style, setStyle] = useState<SStyle>('bs');
  const framed = useRef('');
  const boxRef = useRef<HTMLDivElement>(null);
  const boxW = useBoxWidth(boxRef, Math.round(height * 1.9));
  const [reframe, setReframe] = useState(0);
  const recenter = () => { framed.current = ''; setReframe((n) => n + 1); };
  // Encuadre: caja de los puntos de encuadre, fija mientras no cambie frameKey. La escena se traslada para que su centro
  // quede en el origen: así la vista de respaldo (extentHint) tampoco salta cuando aparecen o se van partículas.
  const frameRef = useRef<{ key: string; c: V3; lo: V3; hi: V3; r: number } | null>(null);
  if (!frameRef.current || frameRef.current.key !== frameKey) {
    const pts: V3[] = framePoints ?? [...rawAtoms.map((a) => [a.x, a.y, a.z] as V3), ...rawLines.flatMap((l) => [l.p, l.q]), ...rawLabels.map((l) => l.at)];
    const lo = [0, 1, 2].map((j) => (pts.length ? Math.min(...pts.map((p) => p[j])) : -2) - 1.2) as V3;
    const hi = [0, 1, 2].map((j) => (pts.length ? Math.max(...pts.map((p) => p[j])) : 2) + 1.2) as V3;
    const c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    frameRef.current = { key: frameKey, c, lo: [lo[0] - c[0], lo[1] - c[1], lo[2] - c[2]], hi: [hi[0] - c[0], hi[1] - c[1], hi[2] - c[2]], r: Math.hypot(hi[0] - c[0], hi[1] - c[1], hi[2] - c[2]) };
  }
  const fr = frameRef.current;
  const atoms = useMemo(() => rawAtoms.map((a) => ({ ...a, x: a.x - fr.c[0], y: a.y - fr.c[1], z: a.z - fr.c[2] })), [rawAtoms, fr]);
  const lines = useMemo(() => rawLines.map((l) => ({ p: [l.p[0] - fr.c[0], l.p[1] - fr.c[1], l.p[2] - fr.c[2]] as V3, q: [l.q[0] - fr.c[0], l.q[1] - fr.c[1], l.q[2] - fr.c[2]] as V3 })), [rawLines, fr]);
  const labels = useMemo(() => rawLabels.map((l) => ({ ...l, at: [l.at[0] - fr.c[0], l.at[1] - fr.c[1], l.at[2] - fr.c[2]] as V3 })), [rawLabels, fr]);

  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      if (framed.current !== frameKey) {
        framed.current = frameKey;
        v.removeAllModels();
        // Modelo auxiliar diminuto en las 8 esquinas de la caja que contiene la escena, solo para encuadrarla (como en
        // Reaction3D). zoomTo ajusta la dimensión mayor a la altura del lienzo; si la escena es más ancha que alta y el
        // lienzo también, se acerca un poco más para aprovechar el ancho.
        const { lo, hi } = fr;
        const ext: V3[] = [0, 1].flatMap((i) => [0, 1].flatMap((j) => [0, 1].map((k) => [i ? hi[0] : lo[0], j ? hi[1] : lo[1], k ? hi[2] : lo[2]] as V3)));
        v.addModel(`${ext.length}\nencuadre\n${ext.map((p) => `H ${p[0].toFixed(3)} ${p[1].toFixed(3)} ${p[2].toFixed(3)}`).join('\n')}`, 'xyz');
        v.setStyle({}, { sphere: { radius: 0.01, opacity: 0.01 } });
        v.resize(); v.zoomTo();
        const host = hostRef.current;
        if (host && host.clientHeight > 0) {
          const W = hi[0] - lo[0], H = hi[1] - lo[1], D = hi[2] - lo[2], maxD = Math.max(W, H, D);
          const aspect = host.clientWidth / host.clientHeight;
          const f = Math.min(aspect * maxD / W, maxD / H) * 0.82;
          if (f > 1.05) v.zoom(Math.min(f, 3));
        }
      }
      v.removeAllShapes(); v.removeAllLabels();
      // Una forma por color: 3Dmol pinta cada forma de un solo color. Lo atenuado NO usa transparencia (no se dibuja
      // en todos los motores de WebGL): su color se mezcla con el del fondo. Lo resaltado lleva una malla de alambre.
      const shapes = new Map<string, ReturnType<GLViewer['addShape']>>();
      const shapeOf = (color: string, wireframe = false) => {
        const key = `${color}|${wireframe}`;
        let sh = shapes.get(key);
        if (!sh) { sh = v.addShape({ color, wireframe }); shapes.set(key, sh); }
        return sh;
      };
      const data = cssVar('--data', '#b23a0a'), ink2 = cssVar('--ink-2', '#4a5a58'), ink = cssVar('--ink', '#12201e'), surface = cssVar('--surface', '#ffffff');
      const dimmed = (c: string) => mixHex(c, surface, 1 - DIM_OPACITY);
      atoms.forEach((a) => {
        const r = R_OF[style](a.el);
        shapeOf(a.dim ? dimmed(elementColor(a.el)) : elementColor(a.el)).addSphere({ center: { x: a.x, y: a.y, z: a.z }, radius: r });
        if (a.mark) shapeOf(data, true).addSphere({ center: { x: a.x, y: a.y, z: a.z }, radius: r + 0.32, quality: 1 } as never);
      });
      if (style === 'bs') for (const b of bonds) {
        const p = atoms[b.a], q = atoms[b.b];
        if (!p || !q) continue;
        const d: V3 = [q.x - p.x, q.y - p.y, q.z - p.z];
        const len = Math.hypot(...d) || 1;
        const n = perpendicular([d[0] / len, d[1] / len, d[2] / len]);
        const offs = b.order === 2 ? [-0.11, 0.11] : b.order === 3 ? [-0.16, 0, 0.16] : [0];
        for (const k of offs) shapeOf(b.dim ? dimmed(STICK_COLOR) : STICK_COLOR).addCylinder({ start: { x: p.x + n[0] * k, y: p.y + n[1] * k, z: p.z + n[2] * k }, end: { x: q.x + n[0] * k, y: q.y + n[1] * k, z: q.z + n[2] * k }, radius: b.order > 1 ? 0.07 : 0.11, fromCap: 1, toCap: 1 });
      }
      for (const l of lines) shapeOf(ink2).addCylinder({ start: { x: l.p[0], y: l.p[1], z: l.p[2] }, end: { x: l.q[0], y: l.q[1], z: l.q[2] }, radius: 0.08, fromCap: 1, toCap: 1 });
      for (const l of labels) v.addLabel(l.text, { position: { x: l.at[0], y: l.at[1], z: l.at[2] }, fontSize: l.size ?? 15, fontColor: ink, backgroundColor: surface, backgroundOpacity: l.size ? 0 : 0.85, borderThickness: 0, inFront: true, alignment: 'center' });
      const host = hostRef.current as Viewer3DHost | null;
      if (host) host.__lv3dScene = {
        atoms: atoms.map((a) => ({ x: a.x, y: a.y, z: a.z, r: R_OF[style](a.el) })),
        bonds: style === 'bs' ? bonds.map((b) => ({ a: b.a, b: b.b, order: b.order, opacity: b.dim ? DIM_OPACITY : 1 })) : [], stickRadius: 0.11, stickColor: STICK_COLOR,
      };
      v.render();
    } catch (e) { fail(e); }
  }, [engine, atoms, bonds, lines, labels, style, theme, frameKey, fr, reframe, viewerRef, fail]);

  const view = (fn: (v: GLViewer, ms: number) => void) => {
    const v = viewerRef.current;
    if (!v) return;
    try { fn(v, reducedMotion() ? 0 : 300); v.render(); } catch { /* sin visor */ }
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rot: Record<string, [number, 'x' | 'y']> = { ArrowLeft: [-10, 'y'], ArrowRight: [10, 'y'], ArrowUp: [-10, 'x'], ArrowDown: [10, 'x'] };
    if (rot[e.key]) { e.preventDefault(); view((v) => v.rotate(rot[e.key][0], rot[e.key][1], 0)); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); view((v) => v.zoom(1.15, 0)); }
    else if (e.key === '-') { e.preventDefault(); view((v) => v.zoom(1 / 1.15, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); recenter(); }
  };

  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const descId = `${idPrefix}-s3d-desc`;
  const svgAtoms = useMemo(() => atoms.map((a) => ({ el: a.el, x: a.x, y: a.y, z: a.z, r: R_OF[style](a.el), charge: a.charge, opacity: a.dim ? DIM_OPACITY + 0.12 : 1 })), [atoms, style]);
  const svgBonds = useMemo(() => (style === 'bs' ? bonds.map((b) => ({ a: b.a, b: b.b, order: b.order, opacity: b.dim ? DIM_OPACITY : 1 })) : []), [bonds, style]);
  const marked = useMemo(() => atoms.flatMap((a, i) => (a.mark ? [i] : [])), [atoms]);

  return (
    <figure className="chem3d" style={{ margin: 0, minWidth: 0, maxWidth: '100%' }}>
      <div ref={boxRef} style={{ position: 'relative', width: '100%', height, borderRadius: 12, background: 'radial-gradient(120% 90% at 30% 20%, var(--surface), var(--surface-2))', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div ref={hostRef} role="img" tabIndex={engine === 'disponible' ? 0 : -1} aria-label={`${title}: escena 3D; arrastra o usa las flechas para girarla, + y − para acercar`} aria-describedby={descId} onKeyDown={onKey}
          style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
        {engine === 'cargando' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><p role="status" className="small">Cargando el visor 3D (3Dmol.js)…</p></div>}
        {fallback && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ProjectedSvg ariaLabel={`${title}: vista de respaldo con las mismas posiciones; arrastra o usa las flechas para girarla`}
              atoms={svgAtoms} bonds={svgBonds} lines={lines} selection={marked} extentHint={fr.r} height={height} width={boxW} showCharges />
          </div>
        )}
      </div>
      <p id={descId} className="sr-only">{description}</p>
      <figcaption className="small" style={{ marginTop: 6 }}>
        <StatusChip status={status} prefix="Escena" /> <span className="muted">{caption}</span>
      </figcaption>
      {fallback && (
        <div className="notice small" role="status" style={{ marginTop: 6 }}>
          <strong>Vista de respaldo:</strong> {engine === 'sin-webgl' ? 'este equipo no ofrece WebGL;' : 'no se pudo cargar el visor 3D;'} la escena se dibuja con las mismas posiciones. Gírala arrastrando o con las flechas del teclado.
          {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={retry}>Reintentar el visor 3D</button></>}
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 8, alignItems: 'flex-end', gap: '8px 20px' }}>
        <Segmented label={`Estilo de la escena: ${title}`} value={style} options={[{ value: 'bs', label: 'Esferas y palitos' }, { value: 'esf', label: 'Espacio lleno' }]} onChange={setStyle} />
        {!fallback && (
          <span className="btn-row">
            <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => view((v, ms) => v.rotate(90, 'y', ms))}>Girar 90°</button>
            <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={recenter}>Centrar</button>
          </span>
        )}
      </div>
      {children}
    </figure>
  );
}

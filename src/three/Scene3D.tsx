import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { StatusChip } from '../components/Provenance';
import type { EpistemicStatus } from '../lib/provenance';
import { prefersReducedMotion } from '../lib/prefs';
import { documentReader, paletteColor, readPalette } from './colors';
import { FallbackSvg } from './FallbackSvg';
import type { SceneRenderer } from './renderer';
import {
  clampOrbit, DEFAULT_ORBIT, describeOrbit, labelAnchor, orbitFromKey, projectPerspective, rotateOrbit, spreadLabels, ROTATE_STEP, zoomOrbit, ZOOM_STEP,
  type Orbit, type SceneItem, type Vec3,
} from './scene';

/* ------------------------------------------------------------------ motor (carga diferida) */

type EngineModule = typeof import('./renderer');
let loader: Promise<EngineModule> | null = null;
/** Descarga (una sola vez) el fragmento con three.js. */
export function loadSceneEngine(): Promise<EngineModule> {
  if (!loader) {
    loader = import('./renderer');
    loader.catch(() => { loader = null; });
  }
  return loader;
}

/** Gancho de prueba: `window.__lvSinWebgl = true` (antes de cargar la página) fuerza la vista de respaldo. */
export const forcedFallback = () => { try { return (window as { __lvSinWebgl?: boolean }).__lvSinWebgl === true; } catch { return false; } };

/** ¿Hay WebGL? Crea un contexto de prueba y lo libera enseguida (los navegadores limitan cuántos hay abiertos). */
export function webglAvailable(): boolean {
  if (forcedFallback()) return false;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export type SceneEngine = 'cargando' | 'disponible' | 'sin-webgl' | 'no-disponible';

/** Lo que el contenedor deja para las pruebas de extremo a extremo (no cambia nada de lo que se ve). */
export interface Scene3DHost extends HTMLDivElement {
  __lvScene3D?: { engine: SceneEngine; snapshot: () => string | null; revision: string | null };
}

const reduced = () => { try { return prefersReducedMotion(); } catch { return false; } };

/** Vuelve a leer los colores al cambiar el tema (claro/oscuro), el alto contraste o la preferencia del sistema. */
function useThemeVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((n) => n + 1);
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    mq?.addEventListener?.('change', bump);
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(bump);
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'data-contrast'] });
    return () => { mq?.removeEventListener?.('change', bump); mo?.disconnect(); };
  }, []);
  return v;
}

/* ------------------------------------------------------------------ componente */

export interface Scene3DProps {
  /** Primitivas de la escena (ver src/three/scene.ts). Pásalas memorizadas o recalculadas desde el estado del laboratorio. */
  items: readonly SceneItem[];
  /** Prefijo único de ids dentro del laboratorio. */
  idPrefix: string;
  /** Nombre accesible de la escena: «Péndulo en 3D». */
  title: string;
  /** Descripción del estado actual (se lee con el lector de pantalla y se actualiza con la simulación). */
  description: string;
  /** Radio de la escena (en sus unidades) para encuadrarla; fijo durante una animación para que la cámara no salte. */
  extent: number;
  /** Centro de la órbita (por defecto el origen). */
  target?: Vec3;
  /** Alto máximo en px (por defecto 320; en pantallas angostas se reduce). */
  height?: number;
  initialOrbit?: Partial<Orbit>;
  selectedId?: string | null;
  /** Si se da, las primitivas `selectable` se eligen con clic/toque o desde la leyenda. */
  onSelect?: (id: string) => void;
  /** Estatus epistémico de la escena (ADR 0002). Por defecto «Ilustración educativa». */
  status?: EpistemicStatus;
  /** Qué es cálculo y qué es dibujo, en una frase. */
  statusNote?: ReactNode;
  /** Muestra la leyenda con las primitivas rotuladas (por defecto sí). */
  legend?: boolean;
  /** Contenido debajo de la escena (p. ej. la ficha del elemento elegido). */
  children?: ReactNode;
}

/**
 * Escena 3D accesible del kit: three.js con carga diferida y vista de respaldo en SVG con la misma geometría. Giro con
 * arrastre (ratón o un dedo en horizontal), acercamiento con la rueda (con la escena enfocada) o pellizco, teclado
 * (flechas, + y −, Inicio) y botones; dibujo solo cuando algo cambia; colores de los tokens del tema.
 */
export function Scene3D({
  items, idPrefix, title, description, extent, target = [0, 0, 0], height = 320, initialOrbit, selectedId = null, onSelect,
  status = 'ilustracion', statusNote, legend = true, children,
}: Scene3DProps) {
  const { yaw: iy, pitch: ip, zoom: iz } = { ...DEFAULT_ORBIT, ...initialOrbit };
  const initial = useMemo(() => clampOrbit({ yaw: iy, pitch: ip, zoom: iz }), [iy, ip, iz]);
  const [orbit, setOrbit] = useState<Orbit>(initial);
  const [engine, setEngine] = useState<SceneEngine>('cargando');
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(0);
  const [spin, setSpin] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const revisionRef = useRef<string | null>(null);
  const theme = useThemeVersion();
  // `theme` cambia cuando cambia el tema: se vuelven a leer los tokens.
  const palette = useMemo(() => readPalette(documentReader()), [theme]);
  const uid = useId().replace(/:/g, '');
  const descId = `${idPrefix}-s3d-desc-${uid}`;
  const h = Math.round(width ? Math.min(height, Math.max(220, width * 0.9)) : height);
  const [tx, ty, tz] = target;
  const tgt = useMemo<Vec3>(() => [tx, ty, tz], [tx, ty, tz]);

  // Ancho disponible (sin desbordar en 390 px: el lienzo mide el 100 % del contenedor).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(1, Math.round(el.clientWidth)));
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // Motor: WebGL + three.js diferido, o vista de respaldo.
  useEffect(() => {
    const host = glRef.current;
    if (!host) return;
    let cancelled = false;
    let disposing = false;
    if (!webglAvailable()) { setEngine('sin-webgl'); return; }
    setEngine('cargando');
    const onLost = (e: Event) => { e.preventDefault(); if (!disposing) { console.warn(`[escena 3D ${idPrefix}] Se perdió el contexto WebGL; se usa la vista de respaldo.`); setEngine('no-disponible'); } };
    loadSceneEngine().then((m) => {
      if (cancelled) return;
      try {
        const r = m.createSceneRenderer(host);
        r.canvas.addEventListener('webglcontextlost', onLost);
        rendererRef.current = r;
        revisionRef.current = m.THREE_REVISION;
        setEngine('disponible');
      } catch (e) {
        console.warn(`[escena 3D ${idPrefix}] No se pudo crear el lienzo WebGL; se usa la vista de respaldo.`, e);
        setEngine('no-disponible');
      }
    }).catch((e) => {
      console.warn(`[escena 3D ${idPrefix}] No se pudo descargar el motor 3D (¿sin conexión?); se usa la vista de respaldo.`, e);
      if (!cancelled) setEngine('no-disponible');
    });
    return () => {
      cancelled = true;
      disposing = true;
      const r = rendererRef.current;
      rendererRef.current = null;
      if (r) { r.canvas.removeEventListener('webglcontextlost', onLost); r.dispose(); }
    };
  }, [attempt, idPrefix]);

  // Dibujo bajo demanda: solo cuando cambian las primitivas, la cámara, el tamaño, el tema o la selección.
  useEffect(() => {
    const r = rendererRef.current;
    if (engine !== 'disponible' || !r || !width) return;
    try {
      r.setSize(width, h);
      r.setView(orbit, tgt, extent);
      r.update(items, palette, selectedId);
      r.render();
    } catch (e) {
      console.warn(`[escena 3D ${idPrefix}] Error al dibujar; se usa la vista de respaldo.`, e);
      setEngine('no-disponible');
    }
  }, [engine, items, orbit, tgt, extent, width, h, palette, selectedId, idPrefix]);

  // Ganchos de prueba en el contenedor accesible.
  useEffect(() => {
    const el = viewRef.current as Scene3DHost | null;
    if (!el) return;
    el.__lvScene3D = {
      engine,
      revision: revisionRef.current,
      snapshot: () => { try { return rendererRef.current?.snapshot() ?? null; } catch { return null; } },
    };
  }, [engine]);

  // Giro automático (opcional, lo inicia la persona): se detiene con «Pausar el giro» y nunca corre con movimiento reducido.
  useEffect(() => {
    if (!spin) return;
    if (reduced()) { setSpin(false); return; }
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (reduced()) { setSpin(false); return; }
      setOrbit((o) => rotateOrbit(o, 0.45 * dt, 0));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spin]);

  /* ---------------- interacción: arrastre, pellizco, rueda, teclado */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; pinch: number }>({ moved: false, pinch: 0 });
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { moved: false, pinch: 0 };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.pinch > 0 && d > 0) setOrbit((o) => zoomOrbit(o, d / gesture.current.pinch));
      gesture.current.pinch = d;
      gesture.current.moved = true;
      return;
    }
    if (!gesture.current.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    gesture.current.moved = true;
    setOrbit((o) => rotateOrbit(o, -dx * 0.008, dy * 0.008));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const was = pointers.current.has(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (!was || gesture.current.moved || !onSelect || e.type !== 'pointerup') return;
    let id: string | null = null;
    if (engine === 'disponible') id = rendererRef.current?.pick(e.clientX, e.clientY) ?? null;
    else {
      const hit = document.elementsFromPoint?.(e.clientX, e.clientY).find((n) => n.closest('[data-id]'));
      id = hit?.closest('[data-id]')?.getAttribute('data-id') ?? null;
    }
    const it = id ? items.find((x) => x.id === id) : null;
    if (it?.selectable) onSelect(it.id);
  };
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Solo con la escena enfocada (clic o Tab): así la rueda sigue desplazando la página al pasar por encima.
      if (document.activeElement !== el) return;
      e.preventDefault();
      setOrbit((o) => zoomOrbit(o, e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = orbitFromKey(orbit, e.key, initial);
    if (!next) return;
    e.preventDefault();
    setOrbit(next);
  };
  const reset = useCallback(() => { setSpin(false); setOrbit(initial); }, [initial]);

  /* ---------------- presentación */
  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const labelled = items.filter((it) => it.label);
  const overlay = engine === 'disponible' && width > 0
    ? spreadLabels(labelled.map((it) => ({ it, text: it.label ?? '', ...projectPerspective(labelAnchor(it), orbit, tgt, extent, width, h) })).filter((p) => p.visible), width, h)
    : [];
  // En pantallas angostas, muchos rótulos tapan la escena: se muestra solo el del elemento elegido y la leyenda nombra el resto.
  const compactLabels = width > 0 && width < 520 && overlay.length > 4;
  const shownLabels = compactLabels ? overlay.filter(({ item: { it } }) => it.id === selectedId) : overlay;
  const fullDescription = `${description} Cámara: ${describeOrbit(orbit)}.`;
  const name = `${title}${fallback ? ' (vista de respaldo en 2D con las mismas posiciones)' : ''}. Arrastra o usa las flechas para girar; + y − acercan o alejan; Inicio restablece la vista.`;
  const reduce = reduced();

  return (
    <figure className="scene3d" data-engine={engine} style={{ margin: 0, minWidth: 0, maxWidth: '100%' }}>
      <div ref={boxRef} style={{ position: 'relative', width: '100%', height: h, borderRadius: 12, background: 'radial-gradient(120% 90% at 30% 20%, var(--surface), var(--surface-2))', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div ref={glRef} style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
        {fallback && width > 0 && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <FallbackSvg items={items} orbit={orbit} target={tgt} extent={extent} width={width} height={h} palette={palette} selectedId={selectedId} />
          </div>
        )}
        {shownLabels.map(({ item: { it }, left, bottom }) => (
          <span key={it.id} className="scene3d-label" aria-hidden="true" style={{ left, top: bottom, borderColor: paletteColor(palette, it.color), fontWeight: it.id === selectedId ? 800 : 700 }}>{it.label}</span>
        ))}
        {compactLabels && <span className="scene3d-label" aria-hidden="true" data-compact-hint style={{ left: 8, top: 30, fontWeight: 600, opacity: 0.9 }}>Nombres en la leyenda</span>}
        {engine === 'cargando' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><p role="status" className="small">Cargando la vista 3D…</p></div>}
        <div ref={viewRef} className="scene3d-view" id={`${idPrefix}-s3d`} role="img" tabIndex={0} aria-label={name} aria-describedby={descId}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown} />
      </div>
      <p id={descId} className="sr-only">{fullDescription}</p>
      <div className="scene3d-tools" role="group" aria-label={`Controles de la vista: ${title}`}>
        <button type="button" className="btn small" aria-label="Girar a la izquierda" title="Girar a la izquierda (←)" onClick={() => setOrbit((o) => rotateOrbit(o, -ROTATE_STEP, 0))}><span aria-hidden="true">↺</span></button>
        <button type="button" className="btn small" aria-label="Girar a la derecha" title="Girar a la derecha (→)" onClick={() => setOrbit((o) => rotateOrbit(o, ROTATE_STEP, 0))}><span aria-hidden="true">↻</span></button>
        <button type="button" className="btn small" aria-label="Ver desde más arriba" title="Ver desde más arriba (↑)" onClick={() => setOrbit((o) => rotateOrbit(o, 0, ROTATE_STEP))}><span aria-hidden="true">↑</span></button>
        <button type="button" className="btn small" aria-label="Ver desde más abajo" title="Ver desde más abajo (↓)" onClick={() => setOrbit((o) => rotateOrbit(o, 0, -ROTATE_STEP))}><span aria-hidden="true">↓</span></button>
        <button type="button" className="btn small" aria-label="Acercar" title="Acercar (+)" onClick={() => setOrbit((o) => zoomOrbit(o, ZOOM_STEP))}><span aria-hidden="true">+</span></button>
        <button type="button" className="btn small" aria-label="Alejar" title="Alejar (−)" onClick={() => setOrbit((o) => zoomOrbit(o, 1 / ZOOM_STEP))}><span aria-hidden="true">−</span></button>
        <button type="button" className="btn small" onClick={reset}>Restablecer vista</button>
        <button type="button" className="btn small" disabled={reduce}
          title={reduce ? 'Desactivado: el equipo o la aplicación piden reducir el movimiento' : undefined}
          onClick={() => setSpin((s) => !s)}>{spin ? 'Pausar el giro' : 'Girar sola'}</button>
      </div>
      {legend && labelled.length > 0 && (
        <ul className="scene3d-legend small" aria-label={`Elementos de la escena: ${title}`}>
          {labelled.map((it) => {
            const sw = <span className="scene3d-swatch" aria-hidden="true" style={{ background: paletteColor(palette, it.color) }} />;
            return (
              <li key={it.id}>
                {it.selectable && onSelect
                  ? <button type="button" className="btn small ghost" aria-pressed={it.id === selectedId} onClick={() => onSelect(it.id)}>{sw}{it.label}</button>
                  : <span>{sw}{it.label}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <figcaption className="small" style={{ marginTop: 6 }}>
        <StatusChip status={status} prefix="Escena 3D" />{statusNote ? <> <span className="muted">{statusNote}</span></> : null}
      </figcaption>
      {fallback && (
        <div className="notice small" role="status" style={{ marginTop: 6 }}>
          <strong>Vista de respaldo en 2D:</strong> {engine === 'sin-webgl' ? 'este equipo no ofrece WebGL;' : 'no se pudo cargar el motor 3D (por ejemplo, sin conexión);'} se dibuja la misma escena, con las mismas posiciones y vectores, en proyección plana. Gírala arrastrando, con las flechas del teclado o con los botones.
          {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={() => setAttempt((n) => n + 1)}>Reintentar la vista 3D</button></>}
        </div>
      )}
      {children}
    </figure>
  );
}

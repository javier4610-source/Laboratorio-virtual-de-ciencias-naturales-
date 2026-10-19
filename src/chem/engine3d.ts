/**
 * Motor 3D compartido del kit (3Dmol.js 2.5.5, BSD-3-Clause), cargado de forma diferida igual que en
 * src/labs/GeometryLab.tsx: la compilación ES6 minificada queda en un fragmento propio fuera del JS inicial y el
 * navegador la reutiliza entre laboratorios. Si no hay WebGL o no se puede descargar, los componentes del kit usan
 * su vista de respaldo en SVG con las mismas coordenadas.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { GLViewer } from '3dmol';
import { prefersReducedMotion } from '../lib/prefs';

type ThreeDmol = typeof import('3dmol');
let loader: Promise<ThreeDmol> | null = null;

export function load3Dmol(): Promise<ThreeDmol> {
  if (!loader) {
    // @ts-ignore La compilación ES6 minificada no trae declaraciones propias; sus tipos son los del paquete '3dmol'.
    loader = import('3dmol/build/3Dmol.es6-min.js').then((m: unknown) => m as ThreeDmol);
    loader.catch(() => { loader = null; });
  }
  return loader;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export type EngineState = 'cargando' | 'disponible' | 'sin-webgl' | 'no-disponible';

export const reducedMotion = () => { try { return prefersReducedMotion(); } catch { return false; } };

export const cssVar = (name: string, fallback: string) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
};

/**
 * Crea un visor 3Dmol en `hostRef` y devuelve su estado. `tag` identifica el componente en los avisos de la consola.
 * `retry()` vuelve a intentar la descarga (p. ej., tras recuperar la conexión).
 */
export function use3DViewer(hostRef: RefObject<HTMLDivElement | null>, tag: string) {
  const viewerRef = useRef<GLViewer | null>(null);
  const [engine, setEngine] = useState<EngineState>('cargando');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const host = hostRef.current;
    let cancelled = false;
    if (!host) return;
    if (!webglAvailable()) { setEngine('sin-webgl'); return; }
    setEngine('cargando');
    load3Dmol().then((lib) => {
      if (cancelled) return;
      try {
        viewerRef.current = lib.createViewer(host, { backgroundColor: 'white', backgroundAlpha: 0, antialias: true });
        setEngine('disponible');
      } catch (e) {
        console.warn(`[${tag}] No se pudo crear el visor 3D; se usa la vista de respaldo.`, e);
        setEngine('no-disponible');
      }
    }).catch((e) => { console.warn(`[${tag}] No se pudo descargar el visor 3D (¿sin conexión?); se usa la vista de respaldo.`, e); if (!cancelled) setEngine('no-disponible'); });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { try { viewerRef.current?.resize(); viewerRef.current?.render(); } catch { /* sin visor */ } });
    ro?.observe(host);
    return () => {
      cancelled = true;
      ro?.disconnect();
      try { viewerRef.current?.clear(); } catch { /* ya liberado */ }
      viewerRef.current = null;
      host.innerHTML = '';
    };
  }, [attempt, hostRef, tag]);
  const fail = useCallback((e: unknown) => { console.warn(`[${tag}] Error al dibujar en el visor 3D; se usa la vista de respaldo.`, e); setEngine('no-disponible'); }, [tag]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { viewerRef, engine, retry, fail };
}

/** Observa el tema (claro/oscuro) para volver a pintar etiquetas con los colores de la interfaz. */
export function useThemeVersion(): number {
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

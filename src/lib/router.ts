import { useEffect, useState } from 'react';

/**
 * Enrutador mínimo basado en el hash (#/ruta). Funciona en servidores estáticos
 * (GitHub Pages) y al abrir el archivo localmente, sin configuración de servidor.
 */
export interface Route { path: string[]; query: URLSearchParams; }

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [p, q = ''] = clean.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
      // Mover el foco al contenido principal para lectores de pantalla.
      requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function href(...parts: (string | number)[]): string {
  return '#/' + parts.map((p) => encodeURIComponent(String(p))).join('/');
}

export function navigate(to: string): void {
  window.location.hash = to.replace(/^#/, '');
}

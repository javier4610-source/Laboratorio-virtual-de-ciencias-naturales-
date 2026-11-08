import { useEffect, useState } from 'react';

/**
 * ¿Pantalla angosta (celular)? Las escenas de este lote son alargadas (pistas, varillas, montajes en fila): en una pantalla
 * ancha el lienzo es apaisado y basta un encuadre cercano; en un celular el lienzo es casi cuadrado y hace falta un
 * encuadre más amplio para que quepan de lado a lado. Solo cambia la cámara, nunca el contenido de la escena.
 */
export function useNarrow(maxWidth = 600): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const get = () => { try { return typeof matchMedia === 'function' && matchMedia(query).matches; } catch { return false; } };
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return narrow;
}

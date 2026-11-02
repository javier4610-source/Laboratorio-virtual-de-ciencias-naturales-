import { useEffect, useState } from 'react';
import { loadExtraSpecies, NEEDS_ORGANIC, type ExtraSpecies } from './formulaSpecies';

let cache: ExtraSpecies | null = null;

/**
 * Especies que viven en la biblioteca de funciones orgánicas (ácido acético), cargadas solo si alguna fórmula las
 * necesita. Devuelve `null` mientras se cargan.
 */
export function useExtraSpecies(formulas: string[]): ExtraSpecies | null {
  const needs = formulas.some((f) => NEEDS_ORGANIC.has(f));
  const [extra, setExtra] = useState<ExtraSpecies | null>(needs ? cache : { aceticAcid: null });
  useEffect(() => {
    if (!needs) { setExtra((e) => e ?? { aceticAcid: null }); return; }
    if (cache) { setExtra(cache); return; }
    let alive = true;
    setExtra(null);
    loadExtraSpecies().then((x) => { cache = x; if (alive) setExtra(x); }).catch((e) => {
      console.warn('[vista 3D] No se pudo cargar la biblioteca de funciones orgánicas.', e);
      if (alive) setExtra({ aceticAcid: null });
    });
    return () => { alive = false; };
  }, [needs]);
  return needs ? extra : extra ?? { aceticAcid: null };
}

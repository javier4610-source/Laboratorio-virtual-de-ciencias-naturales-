import type { AdvancedItem } from './types';
import { assembleBank } from './scoring';
import { retryableThen } from '../../lib/importar';

/**
 * Carga bajo demanda del banco avanzado: cada bloque es un archivo aparte que el navegador descarga en paralelo,
 * mientras la página ya muestra su encabezado. Así la ruta #/banco/avanzado no espera ~600 KB de ítems para pintar
 * algo, y un cambio en un bloque solo invalida ese archivo en la caché.
 *
 * Debe listar los mismos bloques que ./bloques.ts (el registro). Una prueba unitaria (tests/unit/bancoAvanzado.test.ts)
 * verifica que el banco cargado aquí es idéntico a ADVANCED_BANK.
 */
const LOADERS: (() => Promise<readonly AdvancedItem[]>)[] = [
  retryableThen(() => import('./bloqueA'), (m) => m.BLOQUE_A),
  retryableThen(() => import('./bloqueB'), (m) => m.BLOQUE_B),
  retryableThen(() => import('./bloqueC'), (m) => m.BLOQUE_C),
  retryableThen(() => import('./bloqueD'), (m) => m.BLOQUE_D),
  retryableThen(() => import('./bloqueE'), (m) => m.BLOQUE_E),
  retryableThen(() => import('./bloqueF'), (m) => m.BLOQUE_F),
];

let cache: Promise<AdvancedItem[]> | null = null;

/** Banco completo ordenado por número global. Si falla la descarga (sin conexión la primera vez), se puede reintentar. */
export function loadAdvancedBank(): Promise<AdvancedItem[]> {
  cache ??= Promise.all(LOADERS.map((l) => l())).then(assembleBank);
  cache.catch(() => { cache = null; });
  return cache;
}

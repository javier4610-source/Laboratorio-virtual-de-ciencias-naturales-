import type { Question } from '../../core/types';
import { retryableThen } from '../../lib/importar';

/**
 * Carga bajo demanda del banco tipo Saber 11, un archivo por grado (como el banco avanzado por bloques,
 * ../avanzado/cargar.ts). La página #/banco pinta su encabezado y filtros mientras llegan los grados que necesita, y
 * una práctica descarga solo el grado de sus preguntas de transferencia, no el banco entero.
 *
 * Debe listar los mismos grados que ../bank.ts. Una prueba unitaria (tests/unit/bancoPorGrado.test.ts) verifica que
 * lo cargado aquí es idéntico (los mismos objetos) a SABER_BANK.
 */
const LOADERS: Record<number, () => Promise<readonly Question[]>> = {
  6: retryableThen(() => import('./grado6'), (m) => m.BANCO_GRADO_6),
  7: retryableThen(() => import('./grado7'), (m) => m.BANCO_GRADO_7),
  8: retryableThen(() => import('./grado8'), (m) => m.BANCO_GRADO_8),
  9: retryableThen(() => import('./grado9'), (m) => m.BANCO_GRADO_9),
  10: retryableThen(() => import('./grado10'), (m) => m.BANCO_GRADO_10),
  11: retryableThen(() => import('./grado11'), (m) => m.BANCO_GRADO_11),
};

export const BANK_GRADES: readonly number[] = Object.keys(LOADERS).map(Number);

const cache = new Map<number, Promise<readonly Question[]>>();
const ready = new Map<number, readonly Question[]>();

/** Preguntas de un grado. Si falla la descarga (sin conexión la primera vez), se puede reintentar
 * sin recargar la página. */
export function loadBankGrade(grade: number): Promise<readonly Question[]> {
  const loader = LOADERS[grade];
  if (!loader) return Promise.resolve([]);
  let p = cache.get(grade);
  if (!p) {
    p = loader().then((qs) => { ready.set(grade, qs); return qs; });
    p.catch(() => cache.delete(grade));
    cache.set(grade, p);
  }
  return p;
}

/** Preguntas de varios grados (todos si no se indican), en orden de grado. */
export function loadBank(grades: readonly number[] = BANK_GRADES): Promise<Question[]> {
  return Promise.all(grades.map(loadBankGrade)).then((parts) => parts.flat());
}

/** Lo ya descargado de un grado, sin esperar (undefined si aún no llegó). */
export function loadedBankGrade(grade: number): readonly Question[] | undefined {
  return ready.get(grade);
}

import { BLOQUES } from './bloques';
import { assembleBank } from './scoring';
import type { AdvancedItem } from './types';

export * from './scoring';

/**
 * Banco avanzado tipo Saber 11 armado con los bloques registrados en ./bloques.ts, ordenado por número global.
 * Puede estar vacío o incompleto mientras se incorporan los seis bloques.
 * Importarlo descarga los seis bloques de una vez: la página del banco usa en cambio ./cargar.ts (bajo demanda).
 */
export const ADVANCED_BANK: readonly AdvancedItem[] = assembleBank(BLOQUES);

import type { AdvancedItem } from './types';
import { BLOQUE_A } from './bloqueA';
import { BLOQUE_B } from './bloqueB';
import { BLOQUE_C } from './bloqueC';
import { BLOQUE_D } from './bloqueD';
import { BLOQUE_E } from './bloqueE';

/**
 * Registro de los bloques publicados del banco avanzado. Es el ÚNICO lugar que hay que tocar al incorporar un bloque:
 *
 *   import { BLOQUE_A } from './bloqueA';
 *   export const BLOQUES: readonly (readonly AdvancedItem[])[] = [BLOQUE_A, BLOQUE_B, BLOQUE_C, BLOQUE_D, BLOQUE_E];
 *
 * El banco se arma con los bloques presentes (puede faltar cualquiera); el validador aplica las metas por bloque a cada
 * bloque registrado y las metas globales (180 ítems) solo cuando están los seis.
 * La muestra de pruebas (tests/fixtures/avanzado-muestra.ts) NUNCA se registra aquí.
 */
export const BLOQUES: readonly (readonly AdvancedItem[])[] = [BLOQUE_A, BLOQUE_B, BLOQUE_C, BLOQUE_D, BLOQUE_E];

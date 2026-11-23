import type { Question } from '../core/types';
import { BANCO_GRADO_6 } from './banco/grado6';
import { BANCO_GRADO_7 } from './banco/grado7';
import { BANCO_GRADO_8 } from './banco/grado8';
import { BANCO_GRADO_9 } from './banco/grado9';
import { BANCO_GRADO_10 } from './banco/grado10';
import { BANCO_GRADO_11 } from './banco/grado11';

/**
 * Banco de preguntas ORIGINALES de práctica, elaboradas para este laboratorio.
 * Se alinean con las competencias y componentes de la prueba de Ciencias Naturales
 * de Saber 11, pero NO son preguntas oficiales del ICFES ni reproducen ítems liberados.
 *
 * Las preguntas viven en un archivo por grado (./banco/gradoN.ts). Este módulo las reúne para quien necesita el banco
 * completo de una vez (currículo completo, panel docente, exportación a Moodle, guías en PDF y pruebas). La página del
 * banco y las prácticas NO lo importan: descargan solo los grados que usan con ./banco/cargar.ts.
 */
export const BANK_BY_GRADE: Readonly<Record<number, readonly Question[]>> = {
  6: BANCO_GRADO_6, 7: BANCO_GRADO_7, 8: BANCO_GRADO_8, 9: BANCO_GRADO_9, 10: BANCO_GRADO_10, 11: BANCO_GRADO_11,
};

/** Banco completo, ordenado por grado (6.º a 11.º) y, dentro de cada grado, en el orden en que se escribió. */
export const SABER_BANK: Question[] = Object.values(BANK_BY_GRADE).flat();

export function questionById(id: string): Question | undefined {
  return SABER_BANK.find((q) => q.id === id);
}

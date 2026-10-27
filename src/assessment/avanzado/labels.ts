import type { Competency } from '../../core/types';
import type { BlockId, ContextType, Key, Level, Resource } from './types';

/** Rótulos en español para la interfaz, el cuadernillo y los instrumentos (sin dependencias del currículo). */
export const COMPETENCIES: Competency[] = ['uso', 'explicacion', 'indagacion'];
export const COMPETENCY_NAME: Record<Competency, string> = {
  uso: 'Uso comprensivo del conocimiento científico',
  explicacion: 'Explicación de fenómenos',
  indagacion: 'Indagación',
};
export const COMPETENCY_SHORT_NAME: Record<Competency, string> = { uso: 'Uso comprensivo', explicacion: 'Explicación', indagacion: 'Indagación' };
export const BLOCK_IDS: BlockId[] = ['A', 'B', 'C', 'D', 'E', 'F'];
export const KEYS: Key[] = ['A', 'B', 'C', 'D'];
export const LEVELS: Level[] = [1, 2, 3];
export const LEVEL_NAME: Record<Level, string> = {
  1: 'Nivel 1 · aplicación e interpretación fundamental',
  2: 'Nivel 2 · análisis e integración',
  3: 'Nivel 3 · evaluación de evidencias y diseños',
};
export const CONTEXT_NAME: Record<ContextType, string> = {
  'experimento-escolar': 'Experimento escolar',
  laboratorio: 'Laboratorio',
  'estudio-ecologico': 'Estudio ecológico',
  'agricola-ambiental': 'Agrícola o ambiental',
  cotidiano: 'Cotidiano',
  industrial: 'Industrial',
  'salud-publica': 'Salud pública',
  materiales: 'Materiales y sustancias',
  'datos-investigacion': 'Datos de investigación',
  'ecosistema-colombiano': 'Ecosistema colombiano',
  tecnologico: 'Tecnológico',
};
export const RESOURCE_NAME: Record<Resource, string> = {
  texto: 'Texto', tabla: 'Tabla', grafica: 'Gráfica', esquema: 'Esquema', experimento: 'Experimento', modelo: 'Modelo',
};
/** Aviso común: material original, no oficial, revisado técnicamente pero sin validación psicométrica. */
export const DISCLAIMER = 'Material original de práctica elaborado para este laboratorio. No es material oficial del ICFES ni está avalado por el ICFES ni por el Ministerio de Educación Nacional. Fue revisado con criterios técnicos, pero no está validado psicométricamente (no ha tenido aplicación piloto). Las afirmaciones y evidencias son formulaciones propias del banco.';
/** Aviso del temporizador: el tiempo lo fija el docente; el banco no establece tiempos oficiales. */
export const TIMER_NOTE = 'Tiempo opcional fijado por el docente. No es el tiempo oficial del examen: consulta la guía de orientación vigente del ICFES.';

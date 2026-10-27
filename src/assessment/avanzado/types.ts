/**
 * Banco avanzado de práctica tipo Saber 11.° de Ciencias Naturales (180 ítems originales en seis bloques).
 * Recurso ORIGINAL de preparación: no es material oficial del ICFES ni está avalado por el ICFES o el MEN.
 * Las afirmaciones y evidencias son formulaciones operativas propias del banco, no transcripciones oficiales.
 * Revisado con criterios técnicos; NO validado psicométricamente (sin aplicación piloto).
 */
import type { Competency } from '../../core/types';

export type BlockId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type Level = 1 | 2 | 3;
export type Key = 'A' | 'B' | 'C' | 'D';
export type ContextType =
  | 'experimento-escolar' | 'laboratorio' | 'estudio-ecologico' | 'agricola-ambiental' | 'cotidiano'
  | 'industrial' | 'salud-publica' | 'materiales' | 'datos-investigacion' | 'ecosistema-colombiano' | 'tecnologico';
/** Recurso que hay que interpretar para responder. «texto» = solo el contexto y el enunciado. */
export type Resource = 'texto' | 'tabla' | 'grafica' | 'esquema' | 'experimento' | 'modelo';
export type Check = 'Cumple' | 'Requiere ajuste' | 'No cumple';

/** Gráfica descrita como datos (se dibuja como SVG accesible y se acompaña de su descripción textual). */
export interface ItemChart {
  kind: 'linea' | 'barras' | 'dispersion';
  title: string;
  xLabel: string; // con unidad, p. ej. «Tiempo (min)»
  yLabel: string;
  series: { name: string; points: [number, number][] }[];
  /** Para barras: rótulos de categoría en el orden de los puntos (x = 0, 1, 2…). */
  categories?: string[];
  /** Descripción textual completa para lectores de pantalla y para el cuadernillo impreso. */
  description: string;
}

export interface ItemTable { caption: string; headers: string[]; rows: (string | number)[][] }

export interface AdvancedItem {
  /** Identificador único estable: «SN-A-001» … «SN-F-180» (bloque y número global). */
  id: string;
  /** Número global 1–180. */
  n: number;
  block: BlockId;
  topic: string;
  competency: Competency;
  /** Afirmación operativa propia del banco (qué se quiere poder afirmar del estudiante). */
  affirmation: string;
  /** Evidencia observable esperada (qué hace el estudiante en este ítem). */
  evidence: string;
  level: Level;
  contextType: ContextType;
  resource: Resource;
  /** Contexto o situación problema (funcional, sin pistas). */
  context: string;
  table?: ItemTable;
  chart?: ItemChart;
  /** Esquema descrito en texto cuando la representación es un diagrama. */
  schemeDescription?: string;
  /** true si los datos son ficticios con finalidad didáctica (se rotula en el ítem). */
  simulatedData: boolean;
  stem: string;
  options: Record<Key, string>;
  key: Key;
  /** Justificación científica de la clave (con procedimiento y unidades si hay cálculo). */
  justification: string;
  /** Por qué cada distractor es incorrecto y qué razonamiento originaría el error (sin la clave). */
  distractors: Partial<Record<Key, { why: string; misconception: string }>>;
  /** Error conceptual que conviene evitar. */
  pitfall: string;
  /** Recomendación concreta para mejorar el razonamiento. */
  strategy: string;
  /** Fuente científica o curricular verificable cuando se usan datos o afirmaciones externas. */
  source?: string;
  /** Práctica del laboratorio relacionada (id de PRACTICES), si la hay. */
  practiceId?: string;
  /** Revisión interna con los 15 criterios (en orden de QA_CRITERIA). */
  qa: Check[];
}

export const QA_CRITERIA = [
  'Correspondencia con el propósito evaluativo',
  'Precisión científica',
  'Pertinencia curricular',
  'Claridad del contexto y el enunciado',
  'Suficiencia de la información',
  'Existencia de una sola respuesta correcta',
  'Plausibilidad de los distractores',
  'Ausencia de pistas involuntarias',
  'Coherencia de datos, unidades y cálculos',
  'Calidad de la justificación',
  'Pertinencia del nivel de complejidad',
  'Originalidad del ítem',
  'Ausencia de redundancias con otras preguntas',
  'Correspondencia entre competencia, afirmación y evidencia',
  'Utilidad pedagógica de la retroalimentación',
] as const;

export const BLOCKS: Record<BlockId, { name: string; range: [number, number] }> = {
  A: { name: 'Biología y organización de los seres vivos', range: [1, 30] },
  B: { name: 'Ecología, ambiente y sostenibilidad', range: [31, 60] },
  C: { name: 'Química y transformaciones de la materia', range: [61, 90] },
  D: { name: 'Física y fenómenos mecánicos', range: [91, 120] },
  E: { name: 'Electricidad, magnetismo, ondas y energía', range: [121, 150] },
  F: { name: 'Indagación científica, integración y ciencia, tecnología y sociedad', range: [151, 180] },
};

/**
 * Matriz global (decisión metodológica del banco, NO la ponderación oficial del ICFES), por bloque:
 * 10 uso comprensivo + 10 explicación + 10 indagación; 10 de nivel 1, 12 de nivel 2 y 8 de nivel 3;
 * al menos 8 con interpretación sustantiva de tabla, gráfica, esquema, experimento o modelo;
 * claves entre 6 y 9 por letra, sin ciclos mecánicos ni más de 3 iguales seguidas.
 * Totales: 60/60/60 por competencia; 60/72/48 por nivel; ≥ 48 de datos.
 */
export const BLOCK_TARGET = { perCompetency: 10, levels: { 1: 10, 2: 12, 3: 8 } as Record<Level, number>, minData: 8, keyMin: 6, keyMax: 9, maxRun: 3 };

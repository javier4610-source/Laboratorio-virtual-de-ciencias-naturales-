/**
 * Ficha técnica de un modelo científico. Cada práctica la muestra al
 * estudiante y al docente para declarar qué representa el modelo y qué deja por fuera.
 */
export interface ModelVariable {
  symbol: string;
  name: string;
  unit: string;
  /** Rango permitido en la interfaz (solo variables de entrada). */
  range?: [number, number];
  initial?: number | string;
}

export interface ModelSpec {
  name: string;
  inputs: ModelVariable[];
  outputs: ModelVariable[];
  /** Ecuaciones o reglas en notación legible. */
  equations: string[];
  initialConditions: string[];
  assumptions: string[];
  limits: string[];
  /** Descripción de los casos de prueba automatizados (tests/unit). */
  testCases: string[];
}

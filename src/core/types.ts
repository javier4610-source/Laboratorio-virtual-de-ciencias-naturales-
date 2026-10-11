import type { ModelSpec } from '../models/types';

export type GradeId = 6 | 7 | 8 | 9 | 10 | 11;
export type Area = 'biologia' | 'quimica' | 'fisica' | 'ambiental';
/** Competencias de Ciencias Naturales evaluadas en Saber 11. */
export type Competency = 'uso' | 'explicacion' | 'indagacion';
/** Componentes de la prueba de Ciencias Naturales (según guías de orientación del ICFES). */
export type SaberComponent = 'biologico' | 'quimico' | 'fisico' | 'cts';
export type Difficulty = 'baja' | 'media' | 'alta';

export interface Option { id: string; text: string; /** Por qué esta opción es correcta o incorrecta (error conceptual asociado). */ feedback: string; }

/** Pregunta de selección múltiple con única respuesta. */
export interface Question {
  id: string;
  grade: GradeId;
  topic: string;
  competency: Competency;
  component: SaberComponent;
  skill: string; // habilidad evaluada
  difficulty: Difficulty;
  context?: string; // situación problema
  /** Tabla de datos opcional para preguntas de interpretación. */
  table?: { headers: string[]; rows: (string | number)[][]; caption: string };
  stem: string;
  options: Option[];
  correct: string;
  explanation: string; // justificación científica
  review: string; // recomendación de repaso
  transfer?: string; // pregunta adicional de transferencia (abierta)
  practiceId?: string;
}

export interface Variables { independent: string[]; dependent: string[]; controlled: string[]; }

/** Predicción estructurada que el estudiante hace antes de experimentar. */
export interface HypothesisFrame {
  /** Variables (claves de columnas numéricas) entre las que se predice una relación. */
  pairs: { x: string; y: string; xLabel: string; yLabel: string; datasetId: string; /** Columnas de entrada que pueden variar junto con x sin romper el control (p. ej., la arista cuando x es el volumen). */ allowVary?: string[] }[];
  prompt: string;
}

export interface PracticeDef {
  id: string;
  title: string;
  grade: GradeId;
  area: Area;
  topic: string;
  durationMin: number;
  status: 'disponible';
  summary: string;
  problemQuestion: string;
  objectives: string[];
  competencies: Competency[];
  curricularLink: { standards: string; dba: string; note: string };
  materials: string[];
  background: string[];
  hypothesis: HypothesisFrame;
  variables: Variables;
  procedure: string[];
  interpretation: string[];
  assessment: Question[];
  application: { situation: string; question: string; guidance: string };
  transferQuestionIds: string[];
  conclusionGuide: string;
  model: ModelSpec;
  references: string[];
  keywords: string[];
}

/** Práctica de la malla curricular aún no implementada (se muestra con transparencia). */
export interface PlannedPractice { title: string; grade: GradeId; area: Area; status: 'planificada'; }

export interface GradeInfo {
  id: GradeId;
  name: string;
  title: string;
  description: string;
  topics: string[];
  standardsGroup: string;
}

/* ---------- Registro de datos de un laboratorio ---------- */

export interface Column { key: string; label: string; unit?: string; numeric: boolean; decimals?: number; /** Variable que el estudiante controla (entrada del experimento). */ input?: boolean; }
export interface Dataset { id: string; label: string; columns: Column[]; defaultX: string; defaultY: string; }
export type TrialValue = number | string | null;
export interface Trial { id: string; datasetId: string; createdAt: number; values: Record<string, TrialValue>; note?: string; }

export type Mode = 'guiada' | 'libre' | 'evaluacion';

/** Tendencias que el estudiante puede predecir y que el sistema puede detectar en los datos. */
export type Trend = '' | 'aumenta' | 'disminuye' | 'no cambia' | 'máximo' | 'se estabiliza';

export interface AnswerRecord { chosen: string; correct: boolean; attempts: number; firstTryCorrect: boolean; }

export interface PracticeSession {
  practiceId: string;
  mode: Mode;
  hypothesis: { text: string; pairIndex: number; trend: Trend; savedAt?: number };
  trials: Trial[];
  stepsDone: number[];
  interpretations: Record<string, string>;
  comparison: { verdict: '' | 'apoya' | 'refuta' | 'no concluyente'; justification: string };
  conclusion: { claim: string; evidence: string; reasoning: string };
  application: string;
  answers: Record<string, AnswerRecord>;
  /** Etapas visitadas (p. ej. 'preparacion') y resultado de la actividad de clasificación de variables. */
  visited: string[];
  variablesCheck?: { correct: number; total: number };
  startedAt: number;
  updatedAt: number;
}

/** Datos mínimos de una práctica para catálogos y tarjetas (se cargan siempre; el resto bajo demanda). */
export type PracticeMeta = Pick<PracticeDef, 'id' | 'title' | 'grade' | 'area' | 'topic' | 'durationMin' | 'summary' | 'competencies' | 'keywords'>;

import type { Competency, PracticeDef, PracticeSession, Question } from '../core/types';
import { DATASETS } from '../labs/datasets';
import { trialStatusText } from './provenance';
import { questionById } from '../curriculum';

export const REPORT_FORMAT = 'lvcn-informe-v1';

export interface StudentInfo { name: string; course: string; }

export interface StudentReport {
  format: typeof REPORT_FORMAT;
  generatedAt: number;
  student: StudentInfo;
  practice: { id: string; title: string; grade: number; area: string };
  session: PracticeSession;
  score: ScoreSummary;
}

export interface ScoreSummary {
  answered: number;
  total: number;
  firstTryCorrect: number;
  percent: number; // sobre preguntas respondidas al primer intento
  byCompetency: Record<Competency, { answered: number; correct: number }>;
}

/** Preguntas que se evalúan en una práctica: las propias y las de transferencia. */
export function practiceQuestions(p: PracticeDef): Question[] {
  const transfer = p.transferQuestionIds.map((id) => questionById(id)).filter((q): q is Question => !!q);
  return [...p.assessment, ...transfer];
}

export function scoreSession(p: PracticeDef, s: PracticeSession): ScoreSummary {
  const qs = practiceQuestions(p);
  const byCompetency: ScoreSummary['byCompetency'] = {
    uso: { answered: 0, correct: 0 }, explicacion: { answered: 0, correct: 0 }, indagacion: { answered: 0, correct: 0 },
  };
  let answered = 0, firstTryCorrect = 0;
  for (const q of qs) {
    const a = s.answers[q.id];
    if (!a) continue;
    answered++;
    byCompetency[q.competency].answered++;
    if (a.firstTryCorrect) { firstTryCorrect++; byCompetency[q.competency].correct++; }
  }
  return { answered, total: qs.length, firstTryCorrect, percent: answered ? (firstTryCorrect / answered) * 100 : 0, byCompetency };
}

export function buildReport(p: PracticeDef, s: PracticeSession, student: StudentInfo): StudentReport {
  return {
    format: REPORT_FORMAT, generatedAt: Date.now(), student,
    practice: { id: p.id, title: p.title, grade: p.grade, area: p.area },
    session: s, score: scoreSession(p, s),
  };
}

/** Valida un informe importado (por ejemplo, en el panel docente). Devuelve un mensaje de error o null. */
export function validateReport(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return 'El contenido no es un objeto JSON.';
  const r = obj as Partial<StudentReport>;
  if (r.format !== REPORT_FORMAT) return 'El archivo no es un informe del Laboratorio Virtual (formato desconocido).';
  if (!r.student || typeof r.student.name !== 'string') return 'Falta el nombre del estudiante.';
  if (!r.practice || typeof r.practice.id !== 'string') return 'Falta la práctica.';
  if (!r.session || !Array.isArray(r.session.trials)) return 'Faltan los datos de la sesión.';
  return null;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta los ensayos de un conjunto de datos en CSV (separador punto y coma, habitual en Excel en español). */
export function trialsToCSV(practiceId: string, datasetId: string, s: PracticeSession): string {
  const ds = DATASETS[practiceId]?.find((d) => d.id === datasetId);
  if (!ds) return '';
  const header = ['#', ...ds.columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)), 'Observación', 'Estatus del dato'];
  const rows = s.trials.filter((t) => t.datasetId === datasetId).map((t, i) => [
    i + 1,
    ...ds.columns.map((c) => {
      const v = t.values[c.key];
      return typeof v === 'number' ? String(v).replace('.', ',') : v;
    }),
    t.note ?? '',
    trialStatusText(practiceId, t.meta?.medicion),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
}

export function toCSV(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(';')).join('\n');
}

/** Descarga un archivo generado en el navegador. Devuelve false si el entorno lo bloquea. */
export function downloadText(filename: string, text: string, mime = 'text/plain'): boolean {
  try {
    return downloadBlob(filename, new Blob(['﻿' + text], { type: `${mime};charset=utf-8` }));
  } catch {
    return false;
  }
}

/** Descarga un archivo binario (p. ej. una imagen PNG o SVG). Devuelve false si el entorno lo bloquea. */
export function downloadBlob(filename: string, blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'informe';
}

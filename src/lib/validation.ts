import { loadJSON, saveJSON } from './storage';

/** Registro de la validación curricular que hace el equipo docente para cada práctica. */
export type ValidationStatus = 'pendiente' | 'validado' | 'ajustado' | 'no corresponde';

export interface CurricularValidation {
  practiceId: string;
  status: ValidationStatus;
  dbaNumber: string; // p. ej. "DBA 3 – grado 8.º"
  dbaText: string; // enunciado copiado del documento oficial
  standards: string; // estándar(es) verificados
  institutionalGrade: string; // grado en el que se trabaja en el plan de área
  notes: string;
  validatedBy: string;
  updatedAt: number;
}

export const VALIDATION_KEY = 'lvcn:validacion-curricular';
export const VALIDATION_FORMAT = 'lvcn-validacion-v1';

export function loadValidations(): Record<string, CurricularValidation> {
  return loadJSON<Record<string, CurricularValidation>>(VALIDATION_KEY, {});
}
export function saveValidations(v: Record<string, CurricularValidation>) { saveJSON(VALIDATION_KEY, v); }

export function emptyValidation(practiceId: string): CurricularValidation {
  return { practiceId, status: 'pendiente', dbaNumber: '', dbaText: '', standards: '', institutionalGrade: '', notes: '', validatedBy: '', updatedAt: 0 };
}

const STATUSES: ValidationStatus[] = ['pendiente', 'validado', 'ajustado', 'no corresponde'];

/** Une validaciones importadas (de otro docente) conservando la más reciente por práctica. */
export function mergeValidations(current: Record<string, CurricularValidation>, incoming: unknown): { merged: Record<string, CurricularValidation>; updated: number } {
  if (!incoming || typeof incoming !== 'object') throw new Error('El archivo no contiene validaciones.');
  const obj = incoming as { format?: string; validations?: unknown };
  if (obj.format !== VALIDATION_FORMAT || !Array.isArray(obj.validations)) throw new Error('El archivo no es una exportación de validación curricular del laboratorio.');
  const merged = { ...current };
  let updated = 0;
  for (const raw of obj.validations as Partial<CurricularValidation>[]) {
    if (!raw || typeof raw.practiceId !== 'string' || !STATUSES.includes(raw.status as ValidationStatus)) continue;
    const v = { ...emptyValidation(raw.practiceId), ...raw, updatedAt: Number(raw.updatedAt) || 0 } as CurricularValidation;
    if (!merged[v.practiceId] || merged[v.practiceId].updatedAt < v.updatedAt) { merged[v.practiceId] = v; updated++; }
  }
  return { merged, updated };
}

export function exportValidations(v: Record<string, CurricularValidation>) {
  return { format: VALIDATION_FORMAT, exportedAt: Date.now(), validations: Object.values(v) };
}

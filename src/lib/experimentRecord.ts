import type { PracticeDef, PracticeSession, Trial } from '../core/types';
import { DATASETS } from '../labs/datasets';
import { practiceProvenance, STATUS_LABEL, trialStatusText } from './provenance';

/**
 * Registro reproducible de un experimento (programa v2, sección 12; ADR 0003). Formato abierto en JSON, sin datos
 * personales: identifica la práctica, la pregunta, la hipótesis, el modelo con su versión, el modo de medición y su
 * semilla, y cada ensayo con su estatus. Se puede importar en otro equipo para continuar, duplicar o comparar.
 * Esquema documentado en docs/v2/esquema-registro-experimento.json.
 */
export const RECORD_FORMAT = 'lvcn-registro-experimento/1';

export interface RecordColumn { clave: string; nombre: string; unidad?: string; entrada: boolean; resolucion?: number }
export interface RecordTrial { id: string; fecha: string; valores: Trial['values']; nota?: string; estatus: string; version?: string; medicion?: 'ideal' | 'real' }
export interface RecordDataset { id: string; nombre: string; columnas: RecordColumn[]; ensayos: RecordTrial[] }

export interface ExperimentRecord {
  formato: typeof RECORD_FORMAT;
  id: string;
  fecha: string;
  software: { nombre: string; version: string };
  practica: { id: string; titulo: string; grado: number; area: string };
  pregunta: string;
  hipotesis: { texto: string; tendencia: string };
  modelo: { nombre: string; ecuaciones: string[]; supuestos: string[]; limites: string[]; referencias: string[] };
  procedencia: { datos: string; escena: string; detalle: string };
  medicion: { modo: 'ideal' | 'real'; semilla: string; lecturas: Record<string, number> };
  conjuntos: RecordDataset[];
  advertencias: string[];
  estado: 'con-datos' | 'sin-datos';
}

const SEED_RULE = 'Determinista: cada lectura usa la semilla derivada de (práctica, clave de la lectura, número de lectura). En modo ideal no hay ruido.';

export function buildExperimentRecord(p: PracticeDef, s: PracticeSession, now = Date.now()): ExperimentRecord {
  const mode = s.measurement?.mode ?? 'ideal';
  const prov = practiceProvenance(p.id, mode);
  const conjuntos: RecordDataset[] = (DATASETS[p.id] ?? []).map((d) => ({
    id: d.id,
    nombre: d.label,
    columnas: d.columns.map((c) => ({ clave: c.key, nombre: c.label, ...(c.unit ? { unidad: c.unit } : {}), entrada: !!c.input, ...(c.resolution !== undefined ? { resolucion: c.resolution } : {}) })),
    ensayos: s.trials.filter((t) => t.datasetId === d.id).map((t) => ({
      id: t.id,
      fecha: new Date(t.createdAt).toISOString(),
      valores: t.values,
      ...(t.note ? { nota: t.note } : {}),
      estatus: trialStatusText(p.id, t.meta?.medicion),
      ...(t.meta ? { version: t.meta.v, medicion: t.meta.medicion } : {}),
    })),
  })).filter((d) => d.ensayos.length > 0);
  const n = conjuntos.reduce((a, d) => a + d.ensayos.length, 0);
  return {
    formato: RECORD_FORMAT,
    id: `${p.id}-${now.toString(36)}`,
    fecha: new Date(now).toISOString(),
    software: { nombre: 'Laboratorio Virtual de Ciencias Naturales', version: __APP_VERSION__ },
    practica: { id: p.id, titulo: p.title, grado: p.grade, area: p.area },
    pregunta: p.problemQuestion,
    hipotesis: { texto: s.hypothesis.text, tendencia: s.hypothesis.trend },
    modelo: { nombre: p.model.name, ecuaciones: p.model.equations, supuestos: p.model.assumptions, limites: p.model.limits, referencias: p.references },
    procedencia: { datos: STATUS_LABEL[prov.data], escena: STATUS_LABEL[prov.scene], detalle: prov.detail },
    medicion: { modo: mode, semilla: SEED_RULE, lecturas: { ...(s.measurement?.counts ?? {}) } },
    conjuntos,
    advertencias: [
      'Los valores provienen de un modelo calculado con supuestos y límites declarados; no son mediciones reales.',
      ...(n === 0 ? ['El registro no contiene ensayos.'] : []),
    ],
    estado: n > 0 ? 'con-datos' : 'sin-datos',
  };
}

/** Valida un registro importado. Devuelve el mensaje de error o null si es válido para esa práctica. */
export function validateExperimentRecord(obj: unknown, practiceId: string): string | null {
  if (!obj || typeof obj !== 'object') return 'El archivo no contiene un objeto JSON.';
  const r = obj as Partial<ExperimentRecord>;
  if (r.formato !== RECORD_FORMAT) return 'El archivo no es un registro de experimento del Laboratorio Virtual (formato desconocido).';
  if (!r.practica || r.practica.id !== practiceId) return `El registro es de otra práctica («${r.practica?.titulo ?? 'desconocida'}»).`;
  if (!Array.isArray(r.conjuntos)) return 'Faltan los conjuntos de datos.';
  const known = new Map((DATASETS[practiceId] ?? []).map((d) => [d.id, new Set(d.columns.map((c) => c.key))]));
  for (const d of r.conjuntos) {
    const cols = known.get(d?.id);
    if (!cols) return `El conjunto de datos «${d?.id}» no existe en esta práctica.`;
    if (!Array.isArray(d.ensayos)) return `El conjunto «${d.id}» no tiene ensayos.`;
    for (const t of d.ensayos) {
      if (!t || typeof t.id !== 'string' || !t.valores || typeof t.valores !== 'object') return `Hay un ensayo mal formado en «${d.id}».`;
      for (const [k, v] of Object.entries(t.valores)) {
        if (!cols.has(k)) return `La columna «${k}» no existe en «${d.id}».`;
        if (!(v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))) return `Valor no válido en la columna «${k}».`;
      }
    }
  }
  return null;
}

/** Agrega a la sesión los ensayos del registro que aún no están (por identificador). Devuelve la sesión y cuántos se agregaron. */
export function importExperimentRecord(r: ExperimentRecord, s: PracticeSession): { session: PracticeSession; added: number } {
  const have = new Set(s.trials.map((t) => t.id));
  const incoming: Trial[] = [];
  for (const d of r.conjuntos) {
    for (const t of d.ensayos) {
      if (have.has(t.id)) continue;
      have.add(t.id);
      const parsed = Date.parse(t.fecha);
      incoming.push({
        id: t.id, datasetId: d.id, createdAt: Number.isFinite(parsed) ? parsed : Date.now(), values: t.valores,
        ...(t.nota ? { note: t.nota } : {}),
        ...(t.version && t.medicion ? { meta: { v: t.version, medicion: t.medicion } } : {}),
      });
    }
  }
  incoming.sort((a, b) => a.createdAt - b.createdAt);
  return { session: { ...s, trials: [...s.trials, ...incoming] }, added: incoming.length };
}

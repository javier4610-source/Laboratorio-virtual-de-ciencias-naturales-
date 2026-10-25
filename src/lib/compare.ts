import type { Dataset, Trial, TrialValue } from '../core/types';

/**
 * Comparación de dos ensayos del cuaderno (rediseño 2026-10). Solo resta y divide valores ya guardados:
 * no recalcula nada del modelo. La diferencia se informa como B − A y la variación relativa respecto a A.
 */
export interface CompareRow {
  key: string;
  label: string;
  unit?: string;
  input: boolean;
  a: TrialValue;
  b: TrialValue;
  /** B − A (solo columnas numéricas con ambos valores). */
  diff: number | null;
  /** (B − A) / |A| × 100 (null si A es 0 o falta un valor). */
  relPercent: number | null;
  /** Las dos lecturas coinciden (texto igual o diferencia nula). */
  same: boolean;
}

export function compareTrials(ds: Dataset, a: Trial, b: Trial): CompareRow[] {
  return ds.columns.map((c) => {
    const va = a.values[c.key] ?? null;
    const vb = b.values[c.key] ?? null;
    const numeric = c.numeric && typeof va === 'number' && typeof vb === 'number' && Number.isFinite(va) && Number.isFinite(vb);
    const diff = numeric ? (vb as number) - (va as number) : null;
    const relPercent = numeric && va !== 0 ? (diff! / Math.abs(va as number)) * 100 : null;
    return {
      key: c.key, label: c.label, unit: c.unit, input: !!c.input, a: va, b: vb, diff, relPercent,
      same: numeric ? Math.abs(diff!) < 1e-12 : String(va ?? '') === String(vb ?? ''),
    };
  });
}

/** Variables de entrada que cambian entre los dos ensayos (para advertir sobre el control de variables). */
export function changedInputs(rows: CompareRow[]): CompareRow[] {
  return rows.filter((r) => r.input && !r.same);
}

export const DATA_FORMAT = 'lvcn-datos-v1';

/**
 * Datos de una tabla del cuaderno en JSON legible por otros programas (hojas de cálculo, Python, R).
 * Formato nuevo y separado: no reemplaza el informe (`lvcn-informe-v1`) ni el registro reproducible.
 */
export function trialsToJSON(practiceId: string, practiceTitle: string, ds: Dataset, trials: Trial[], version: string): string {
  return JSON.stringify({
    formato: DATA_FORMAT,
    software: { nombre: 'Laboratorio Virtual de Ciencias Naturales', version },
    practica: { id: practiceId, titulo: practiceTitle },
    conjunto: { id: ds.id, nombre: ds.label },
    columnas: ds.columns.map((c) => ({ clave: c.key, nombre: c.label, unidad: c.unit ?? null, numerica: c.numeric, entrada: !!c.input, resolucion: c.resolution ?? null })),
    ensayos: trials.map((t, i) => ({ n: i + 1, valores: t.values, observacion: t.note ?? '', creado: new Date(t.createdAt).toISOString(), medicion: t.meta?.medicion ?? 'ideal' })),
  }, null, 2);
}

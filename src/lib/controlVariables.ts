import type { Column, Dataset, RelationPair, Trial, TrialValue } from '../core/types';
import { fmt } from './format';

/**
 * Pista de control de variables («prueba justa»): al guardar un ensayo, detecta si cambiaron dos o más variables de
 * entrada a la vez respecto al ensayo anterior del mismo conjunto. Es lógica pura (sin React): la usa el botón de
 * registro de todas las prácticas. Es una pista, no un bloqueo: el ensayo se guarda igual.
 */

/** Una variable de entrada que cambió entre dos ensayos. */
export interface InputChange {
  key: string;
  label: string;
  unit?: string;
  decimals?: number;
  from: TrialValue;
  to: TrialValue;
}

export interface ControlHint {
  datasetId: string;
  /** Número (desde 1) del ensayo de referencia dentro del conjunto: el anterior al que se acaba de guardar. */
  reference: number;
  /** Variables de entrada que cambiaron (en el orden de las columnas). */
  changes: InputChange[];
  /** Identifica el conjunto y las variables que cambiaron: la misma combinación no se vuelve a señalar. */
  signature: string;
}

const isBlank = (v: TrialValue | undefined) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && !Number.isFinite(v));

/**
 * ¿Dos lecturas de una entrada son iguales? Los números se comparan con tolerancia (relativa 1e-6, absoluta 1e-9) para
 * no confundir un redondeo con un cambio; los textos, por igualdad (sin espacios en los extremos).
 */
export function sameInput(a: TrialValue | undefined, b: TrialValue | undefined): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= Math.max(1e-9, 1e-6 * Math.max(Math.abs(a), Math.abs(b)));
  }
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/** Columnas que cuentan como variables independientes para la pista. */
export function independentInputs(ds: Dataset): Column[] {
  return ds.columns.filter((c) => c.input && !c.notIndependent);
}

/**
 * Entradas independientes que cambiaron de `prev` a `next`. Una entrada vacía en alguno de los dos ensayos (no aplica,
 * p. ej. la corriente del solenoide cuando la fuente es un imán) no cuenta: la cambió otra elección.
 */
export function inputChanges(ds: Dataset, prev: Record<string, TrialValue>, next: Record<string, TrialValue>): InputChange[] {
  return independentInputs(ds)
    .filter((c) => !isBlank(prev[c.key]) && !isBlank(next[c.key]) && !sameInput(prev[c.key], next[c.key]))
    .map((c) => ({ key: c.key, label: c.label, unit: c.unit, decimals: c.decimals, from: prev[c.key], to: next[c.key] }));
}

/**
 * Grupos de entradas que la práctica declara que pueden variar juntas (relación `x` + `allowVary`, p. ej. las tres
 * resistencias cuando se estudia la resistencia equivalente).
 */
export function allowedGroups(relations: RelationPair[] | undefined, datasetId: string): string[][] {
  return (relations ?? []).filter((r) => r.datasetId === datasetId && r.allowVary).map((r) => [r.x, ...(r.allowVary ?? [])]);
}

/**
 * Pista al guardar `values` en el conjunto `ds`, dados los ensayos ya guardados de ese conjunto (en orden).
 * Devuelve `null` (sin pista) si:
 * - es el primer ensayo del conjunto, o el conjunto declara `multiInput` (cambia varias entradas a propósito);
 * - respecto al ensayo anterior cambió como mucho una entrada independiente;
 * - las entradas que cambiaron forman un grupo que la práctica permite variar junto (`allowVary`);
 * - algún ensayo anterior difiere en una sola entrada (o en ninguna): el estudiante volvió a una condición de referencia y
 *   cambió una sola variable respecto a ella, que es una comparación justa.
 */
export function detectControlHint(ds: Dataset, previous: Trial[], values: Record<string, TrialValue>, groups: string[][] = []): ControlHint | null {
  if (ds.multiInput) return null;
  const own = previous.filter((t) => t.datasetId === ds.id);
  if (own.length === 0) return null;
  const last = own[own.length - 1];
  const changes = inputChanges(ds, last.values, values);
  if (changes.length < 2) return null;
  const keys = changes.map((c) => c.key);
  if (groups.some((g) => keys.every((k) => g.includes(k)))) return null;
  if (own.some((t) => inputChanges(ds, t.values, values).length <= 1)) return null;
  return { datasetId: ds.id, reference: own.length, changes, signature: `${ds.id}:${[...keys].sort().join('+')}` };
}

/** Valor legible de una entrada: número con coma decimal y unidad, o el texto tal cual. */
export function valueText(c: Pick<InputChange, 'unit' | 'decimals'>, v: TrialValue): string {
  if (typeof v === 'number') return `${fmt(v, c.decimals ?? 2)}${c.unit ? ` ${c.unit}` : ''}`;
  return `«${String(v ?? '')}»`;
}

const lower = (s: string) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

function joinY(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

const COUNT = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];

/** Textos de la pista: título, qué cambió y por qué importa, y una sugerencia concreta. */
export function controlHintText(h: ControlHint): { title: string; cause: string; suggestion: string } {
  const n = h.changes.length;
  const title = `cambiaste ${COUNT[n] ?? n} variables a la vez`;
  const list = joinY(h.changes.map((c) => `${lower(c.label)} (de ${valueText(c, c.from)} a ${valueText(c, c.to)})`));
  const cause = `Respecto al ensayo ${h.reference} cambiaron ${list}. Si el resultado cambió, no se puede saber cuál de ${n === 2 ? 'las dos' : 'ellas'} lo causó: en una prueba justa se cambia una sola variable y las demás se dejan iguales.`;
  const [keep, ...back] = h.changes;
  const backText = joinY(back.map((c) => `${lower(c.label)} a ${valueText(c, c.from)}`));
  const suggestion = `El ensayo sí quedó guardado. Si quieres ver el efecto de ${lower(keep.label)}, vuelve ${backText}, deja ${lower(keep.label)} en ${valueText(keep, keep.to)} y guarda otro ensayo. Así cambias solo una variable por vez.`;
  return { title, cause, suggestion };
}

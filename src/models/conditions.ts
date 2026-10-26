/**
 * Condiciones del experimento con su corrección (lógica pura, sin React).
 *
 * Los modelos siguen devolviendo `warnings: string[]` (las pruebas y los registros dependen de esos textos); cada
 * modelo exporta además una función `…Conditions` que asocia a cada advertencia su nivel y una corrección concreta
 * («Cómo corregirlo»), calculada con el mismo umbral del modelo que la produjo. El componente `Warnings` las muestra.
 *
 * Niveles:
 *  - «invalido»: la medición no es válida con esas condiciones (fuera del intervalo del modelo o del instrumento,
 *    o el montaje real fallaría).
 *  - «advertencia»: la medición es válida, pero conviene revisar la condición.
 *  - «nota»: información para interpretar el resultado; puede no tener corrección.
 */
export type ConditionLevel = 'invalido' | 'advertencia' | 'nota';

export interface ModelCondition {
  /** Causa: el texto de la advertencia del modelo, sin cambios. */
  text: string;
  level: ConditionLevel;
  /** Cómo corregirlo: qué control cambiar y en qué sentido. */
  fix?: string;
}

export interface ConditionRule {
  /** Prefijo del texto de la advertencia o expresión regular que lo reconoce. */
  match: string | RegExp;
  level: ConditionLevel;
  fix?: string | ((text: string) => string | undefined);
}

const matches = (rule: ConditionRule, text: string) =>
  typeof rule.match === 'string' ? text.startsWith(rule.match) : rule.match.test(text);

/**
 * Asocia a cada advertencia la primera regla que la reconoce. Una advertencia sin regla queda como «advertencia»
 * sin corrección (las pruebas unitarias exigen que toda advertencia de los modelos tenga su regla).
 */
export function classifyWarnings(warnings: readonly string[], rules: readonly ConditionRule[]): ModelCondition[] {
  return warnings.map((text) => {
    const rule = rules.find((r) => matches(r, text));
    if (!rule) return { text, level: 'advertencia' };
    const fix = typeof rule.fix === 'function' ? rule.fix(text) : rule.fix;
    return fix ? { text, level: rule.level, fix } : { text, level: rule.level };
  });
}

const ORDER: Record<ConditionLevel, number> = { invalido: 0, advertencia: 1, nota: 2 };

/** Ordena por gravedad (no válida → atención → nota), conservando el orden del modelo dentro de cada nivel. */
export function sortConditions<T extends { level: ConditionLevel }>(list: readonly T[]): T[] {
  return list.map((c, i) => ({ c, i })).sort((a, b) => ORDER[a.c.level] - ORDER[b.c.level] || a.i - b.i).map((x) => x.c);
}

/** Número con coma decimal (es-CO) para los textos de corrección; sin separador de miles en cifras de 4 dígitos. */
export function num(value: number, decimals = 0): string {
  return value.toFixed(decimals).replace('.', ',');
}

/** Redondea hacia abajo / arriba al paso de un control deslizante (evita errores de coma flotante). */
export const floorTo = (v: number, step: number) => Math.floor(v / step + 1e-9) * step;
export const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

/** Enumeración con «o» antes del último elemento: «a, b o c». */
export function orList(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}`;
}

import { loadJSON } from './storage';

/**
 * Indicadores de característica (programa v2, sección 5): las ampliaciones que tocan prácticas existentes se pueden
 * apagar sin desplegar de nuevo. Valores por defecto en el código; un docente puede cambiarlos en este equipo
 * guardando en el almacenamiento local la clave `lvcn:flags`, por ejemplo {"procedencia": false}.
 */
export const FLAG_DEFAULTS = {
  /** Etiquetas de estatus epistémico en el laboratorio, el cuaderno y las exportaciones. */
  procedencia: true,
  /** Exportar e importar el registro reproducible del experimento (JSON). */
  registroExperimento: true,
  /** Energía: actividad de caída con integración numérica en el tiempo (Fase 3). */
  energiaTemporal: true,
  /** Código QR con el enlace permanente de cada práctica (Fase 3). */
  qrPracticas: true,
  /** Búsqueda BLAST real a través del servidor del colegio (proxy de Nivel 1); sin servidor muestra «Servicio no disponible». */
  blast: true,
} as const;

export type FlagName = keyof typeof FLAG_DEFAULTS;

export function flag(name: FlagName): boolean {
  const over = loadJSON<Partial<Record<FlagName, unknown>>>('lvcn:flags', {});
  return typeof over[name] === 'boolean' ? (over[name] as boolean) : FLAG_DEFAULTS[name];
}

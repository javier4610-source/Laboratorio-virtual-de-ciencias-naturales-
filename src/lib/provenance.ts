/**
 * Estatus epistémico de datos y resultados (programa v2, sección 4.2; ADR 0002). Toda cifra que muestra o exporta
 * el laboratorio declara de dónde sale. Hoy ninguna práctica usa evidencia experimental ni predicciones de un
 * servicio externo: los resultados numéricos salen de modelos calculados y las escenas son dibujos.
 */
export type EpistemicStatus = 'experimental' | 'prediccion' | 'modelo' | 'ilustracion' | 'sin-informacion';

export const STATUS_LABEL: Record<EpistemicStatus, string> = {
  experimental: 'Evidencia experimental',
  prediccion: 'Predicción computacional',
  modelo: 'Modelo calculado',
  ilustracion: 'Ilustración educativa',
  'sin-informacion': 'Sin información disponible',
};

export const STATUS_HELP: Record<EpistemicStatus, string> = {
  experimental: 'Medido en un experimento real y publicado; se cita la fuente.',
  prediccion: 'Calculado por un modelo predictivo (por ejemplo, de aprendizaje automático) con incertidumbre propia.',
  modelo: 'Calculado con las ecuaciones de la ficha del modelo y sus supuestos; no es una medición real.',
  ilustracion: 'Dibujo o animación con fines didácticos; no representa un cálculo ni una medición.',
  'sin-informacion': 'No hay datos verificables para este caso.',
};

export interface Provenance {
  /** Estatus de las lecturas y de los datos guardados. */
  data: EpistemicStatus;
  /** Estatus de la escena dibujada. */
  scene: EpistemicStatus;
  /** Frase corta para la interfaz y las exportaciones. */
  detail: string;
}

/** Prácticas cuyos datos son una muestra sintética con semilla visible (no lecturas de un instrumento). */
const SYNTHETIC_SAMPLES = new Set(['reto']);

/** Procedencia de una práctica según el modo de medición elegido. */
export function practiceProvenance(practiceId: string, measurement: 'ideal' | 'real' = 'ideal'): Provenance {
  if (practiceId === 'secuencias') {
    return {
      data: 'modelo', scene: 'modelo',
      detail: 'Secuencias del catálogo: registros de NCBI RefSeq y UniProtKB/Swiss-Prot (evidencia experimental, con número de acceso y fecha de consulta 2026-10-18); %GC, traducciones, ORF y alineamientos: modelo calculado, validado contra Biopython 1.85. Las secuencias que escribe el estudiante quedan «Sin información disponible».',
    };
  }
  if (practiceId === 'geometria') {
    return {
      data: 'modelo', scene: 'prediccion',
      detail: 'Coordenadas 3D: confórmeros calculados por PubChem (OMEGA + MMFF94s), no estructuras medidas; distancias, ángulos y VSEPR se calculan a partir de ellas.',
    };
  }
  const synthetic = SYNTHETIC_SAMPLES.has(practiceId);
  const detail = synthetic
    ? 'Datos sintéticos generados por un modelo calculado con semilla reproducible; no son mediciones reales.'
    : measurement === 'real'
      ? 'Valores del modelo calculado con ruido de medición sintético y reproducible (modo «Instrumento real»); no son mediciones reales.'
      : 'Valores del modelo calculado, redondeados a la resolución del instrumento; no son mediciones reales.';
  return { data: 'modelo', scene: 'ilustracion', detail };
}

/** Estatus de un ensayo guardado, en una frase corta para tablas y exportaciones. */
export function trialStatusText(practiceId: string, measurement: 'ideal' | 'real' = 'ideal'): string {
  if (SYNTHETIC_SAMPLES.has(practiceId)) return `${STATUS_LABEL.modelo} (datos sintéticos con semilla)`;
  return measurement === 'real' ? `${STATUS_LABEL.modelo} con ruido de medición sintético` : STATUS_LABEL.modelo;
}

/**
 * Estatus epistémico de datos y resultados (programa v2, sección 4.2; ADR 0002). Toda cifra que muestra o exporta
 * el laboratorio declara de dónde sale. Algunas prácticas usan datos experimentales publicados (PubChem, NIST, PDB),
 * con su fuente y fecha; el resto de los resultados numéricos salen de modelos calculados.
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
  if (practiceId === 'grupos-oxigenados' || practiceId === 'grupos-nitrogenados') {
    return { data: 'experimental', scene: 'modelo',
      detail: 'Propiedades (Tₑb, solubilidad, pKa, ΔcH°) tomadas de PubChem (PUG View, sobre todo HSDB con la obra que cita) el 2026-10-19; nombres, fracciones ionizadas y pH: modelo calculado; coordenadas 3D: confórmeros de PubChem3D (MMFF94s), no estructuras medidas; resultados de las pruebas de laboratorio: ilustración del resultado esperado según la bibliografía.' };
  }
  if (practiceId === 'reacciones-organicas') {
    return { data: 'modelo', scene: 'ilustracion',
      detail: 'Ecuaciones balanceadas por el método algebraico, masas con masas atómicas estándar y equilibrio con K ≈ 4 (Berthelot y Péan de Saint-Gilles, 1862): modelo calculado; entalpías de combustión: datos de PubChem/HSDB (2026-10-19); animaciones 3D: ilustración (interpolación entre confórmeros de PubChem, no el mecanismo).' };
  }
  if (practiceId === 'hidrocarburos' || practiceId === 'aromaticos') {
    return { data: 'experimental', scene: 'modelo',
      detail: 'Propiedades (temperaturas, densidades, entalpías de combustión): evidencia experimental publicada, tomada de PubChem (HSDB) con la obra que cita cada dato. Longitudes y ángulos: modelo calculado sobre confórmeros 3D de PubChem (MMFF94s). Conformaciones, tubos de ensayo y reacciones en 3D: ilustración educativa (rotulada en cada vista).' };
  }
  if (practiceId === 'metabolismo') {
    return {
      data: 'modelo', scene: 'modelo',
      detail: 'Predicción de un modelo basado en restricciones (FBA) con E. coli core (e_coli_core, archivo textbook.xml.gz de COBRApy 0.32.1; Orth, Fleming y Palsson, 2010), resuelta en el navegador y validada contra COBRApy con GLPK. No incluye regulación, cinética ni espacio: es un óptimo posible, no una medición.',
    };
  }
  if (practiceId === 'proteinas') {
    return {
      data: 'modelo', scene: 'modelo',
      detail: 'Coordenadas reales: estructuras experimentales del PDB (3I40, 2HHB, 2LZM, 1EMA) y el modelo predicho AF-Q04671-F1 de AlphaFold DB, descargados el 2026-10-18; cada estructura muestra su estatus (evidencia experimental o predicción computacional). Distancias y conteos: modelo calculado, validado contra Biopython 1.85.',
    };
  }
  if (practiceId === 'rastreo') {
    return {
      data: 'modelo', scene: 'modelo',
      detail: 'Ficha con registros reales de NCBI, UniProt, RCSB PDB y ClinVar (consultados el 2026-10-18); cada afirmación muestra su tipo de evidencia. Las longitudes y la consecuencia de las variantes se calculan con esos registros; el dibujo usa las coordenadas reales.',
    };
  }
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
  if (practiceId === 'tabla-periodica') {
    return { data: 'experimental', scene: 'modelo',
      detail: 'Electronegatividad de Pauling, primera energía de ionización (NIST), radio de van der Waals y masa atómica (IUPAC): tabla periódica de PubChem descargada el 2026-11-01; radios covalentes de Pyykkö y Atsumi (2009). Carga nuclear efectiva y tendencias: modelo calculado (reglas de Slater). Relieve 3D: alturas proporcionales a esos datos.' };
  }
  if (practiceId === 'enlace-quimico') {
    return { data: 'experimental', scene: 'modelo',
      detail: 'Electronegatividades (PubChem), puntos de fusión y solubilidades (PubChem/HSDB con la obra que cita cada dato, 2026-11-01): evidencia experimental publicada. Tipo de enlace, carácter iónico, cargas parciales y dipolo: modelo calculado con ΔEN (estimación cualitativa). Geometrías 3D: confórmeros de PubChem (MMFF94s); redes del NaCl y el cuarzo: estructuras publicadas. Resultados de las pruebas (LED, disolución): ilustración del resultado esperado.' };
  }
  if (practiceId === 'modelos-atomicos') {
    return { data: 'modelo', scene: 'modelo',
      detail: 'Conteos de centelleos: modelo calculado de la dispersión de Rutherford (Coulomb) con la variación al azar de un conteo real (Poisson, semilla reproducible); no son mediciones reales. Predicción de Thomson: modelo calculado. Líneas del hidrógeno: modelo de Bohr con la energía de ionización del NIST, comparado con las líneas medidas del NIST. Dibujos de los cuatro modelos: ilustración sin escala.' };
  }
  if (practiceId === 'electrostatica') {
    return { data: 'modelo', scene: 'modelo',
      detail: measurement === 'real'
        ? 'Fuerzas, campos y potenciales de la ley de Coulomb (k = 8,99 × 10⁹ N·m²/C²) con ruido de medición sintético y reproducible (modo «Instrumento real»); no son mediciones reales. Líneas de campo y equipotenciales 3D: calculadas con el mismo modelo.'
        : 'Fuerzas, campos y potenciales de la ley de Coulomb (k = 8,99 × 10⁹ N·m²/C²), redondeados a la resolución del instrumento; no son mediciones reales. Líneas de campo y equipotenciales 3D: calculadas con el mismo modelo.' };
  }
  if (practiceId === 'configuracion-electronica') {
    return { data: 'experimental', scene: 'modelo',
      detail: 'Estados fundamentales medidos: configuraciones de la tabla periódica de PubChem descargada el 2026-11-01 (las mismas que publica el NIST). Predicción del principio de construcción, Pauli y Hund, desapareados y ubicación en la tabla: modelo calculado. Nubes 3D: |ψ|² del átomo de hidrógeno (forma y orientación; tamaño comprimido), ilustración cualitativa calculada.' };
  }
  if (practiceId === 'pila-electroquimica') {
    return { data: 'modelo', scene: 'modelo',
      detail: (measurement === 'real' ? 'Voltajes y masas con ruido de medición sintético y reproducible (modo «Instrumento real»); no son mediciones reales. ' : 'Voltajes y masas redondeados a la resolución del instrumento; no son mediciones reales. ')
        + 'Potenciales estándar de reducción: valores publicados (CRC Handbook, serie electroquímica de Vanýsek); fem con la ecuación de Nernst a 25 °C y masas con la ley de Faraday: modelo calculado. Celda 3D: posiciones de un modelo; el cambio de grosor de los electrodos se exagera para que se vea.' };
  }
  if (practiceId === 'meiosis') {
    return { data: 'modelo', scene: 'ilustracion',
      detail: 'Gametos de un modelo de meiosis con segregación independiente y entrecruzamiento (frecuencia de recombinación = distancia/100 cM, Morgan) muestreados con semilla reproducible; no son datos de un organismo real. Cromosomas 3D: ilustración sin escala que sigue las etapas y los alelos del modelo.' };
  }
  if (practiceId === 'sistema-nervioso') {
    return { data: 'modelo', scene: 'ilustracion',
      detail: 'Tiempo de reacción calculado con t = √(2d/g) a partir de la distancia de caída que mide el estudiante (dato propio) o de datos de ejemplo generados por un modelo con semilla. Potencial de acción: modelo de umbral simplificado con los valores de los textos (reposo −70 mV, umbral −55 mV, pico +30 mV); velocidades de conducción: rangos de manual. Neurona y arco reflejo 3D: ilustración sin escala.' };
  }
  if (practiceId === 'sistema-circulatorio') {
    return { data: 'modelo', scene: 'ilustracion',
      detail: 'Frecuencia cardíaca, volumen sistólico, gasto cardíaco y presión con el ejercicio: modelo educativo simplificado con relaciones de los manuales (gasto = FC × VS; reserva de Karvonen; FC máxima de Tanaka); los pulsos propios del estudiante son datos suyos y no se envían. No es un diagnóstico ni un consejo médico. Corazón 3D: ilustración sincronizada con el ciclo del modelo.' };
  }
  const noise = (what: string) => (measurement === 'real' ? `${what} con ruido de medición sintético y reproducible (modo «Instrumento real»); no son mediciones reales. ` : `${what} redondeadas a la resolución del instrumento; no son mediciones reales. `);
  if (practiceId === 'estados-de-la-materia') {
    return { data: 'modelo', scene: 'modelo',
      detail: noise('Temperaturas y duraciones') + 'Calores específicos (Serway, tabla 20.1) y calores latentes de las entalpías del NIST WebBook (334 y 2256 J/g); ebullición con la ecuación de saturación IAPWS-IF97 y la atmósfera estándar ISA: modelo calculado. Partículas 3D: 27 partículas cuyo estado sale de las fracciones del modelo y cuya agitación sigue a √T (sin escala).' };
  }
  if (practiceId === 'cambios-quimicos') {
    return { data: 'modelo', scene: 'ilustracion',
      detail: noise('Volúmenes, masas y temperaturas') + 'Estequiometría con masas atómicas de la IUPAC, gases ideales, ley de Henry (Sander, 2015) y entalpías de formación del NBS: modelo calculado; la rapidez de cada proceso es ilustrativa. Reacciones 3D: interpolación entre confórmeros de PubChem (ilustración educativa; no es el mecanismo).' };
  }
  if (practiceId === 'movimiento-circular') {
    return { data: 'modelo', scene: 'modelo',
      detail: noise('Fuerzas y tiempos') + 'Movimiento circular uniforme (v = 2πr/T, a = v²/r, F = m·v²/r) y fricción en una curva plana (v = √(μgr); μ del concreto seco y del hielo de la tabla 5.1 de Serway, los demás ilustrativos): modelo calculado. Escena 3D: posiciones y vectores del mismo modelo.' };
  }
  if (practiceId === 'lentes') {
    return { data: 'modelo', scene: 'modelo',
      detail: noise('Distancias') + 'Ecuación de las lentes delgadas y aumento (Hecht), y ojo reducido de los textos (lente a 1,7 cm de la retina, 4 D de acomodación): modelo calculado; no sirve para formular gafas. Banco 3D: rayos e imagen del mismo modelo (alturas ×5).' };
  }
  if (practiceId === 'magnetismo-imanes') {
    return { data: 'modelo', scene: 'modelo',
      detail: noise('Ángulos y campos') + 'Campo del imán con el modelo de dos polos (momentos con remanencias típicas de fabricante), campo de la Tierra en Apartadó del Modelo Magnético Mundial WMM2025 (NOAA y BGS) y campo de una corriente con Biot-Savart: modelo calculado. Líneas de campo y brújulas 3D: calculadas con el mismo modelo.' };
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

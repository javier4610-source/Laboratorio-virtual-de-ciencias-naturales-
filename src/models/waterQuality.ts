import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';
import { ceilTo, classifyWarnings, floorTo, num, type ModelCondition } from './conditions';

/**
 * Contaminación del agua e indicadores fisicoquímicos y biológicos (grado 11.º).
 *
 * Un río de Urabá recibe un vertimiento puntual en el kilómetro 0. Se toman muestras aguas arriba
 * (x < 0) y aguas abajo (x ≥ 0) y se calculan, para cada punto:
 *   1. Mezcla completa en el punto de vertimiento: C₀ = (Q_r·C_r + Q_w·C_w)/(Q_r + Q_w).
 *   2. Hidráulica del tramo por geometría hidráulica (Leopold y Maddock): u = a·Q^b, H = c·Q^f.
 *   3. Oxígeno disuelto con el modelo de Streeter–Phelps (desoxigenación k_d y reaireación k_a de
 *      O'Connor–Dobbins) superpuesto al estado de fondo del río; punto crítico t_c, D_c.
 *   4. Saturación de oxígeno de Benson y Krause (APHA 4500-O) corregida por la presión.
 *   5. DBO₅ = L·(1 − e^(−5·k₁)); coliformes fecales con la ley de Chick (decaimiento de primer orden);
 *      turbidez que se sedimenta; conductividad, nitratos y fosfatos conservativos.
 *   6. Índice biológico BMWP/Col (Roldán, 2003) con familias presentes según la tolerancia a la falta
 *      de oxígeno, a la carga orgánica y a los sedimentos.
 *   7. Índice de calidad del agua tipo NSF (Brown et al., 1970) con 9 subíndices ponderados.
 *
 * TODOS LOS DATOS SON SIMULADOS: los ríos, caudales y concentraciones son ilustrativos, no mediciones reales.
 */

/* ------------------------------------------------------------------ constantes */

/** Altitud típica de los ríos de la llanura de Urabá (m s. n. m.). */
export const ELEVATION_M = 30;
/** Constante de DBO de botella (base e, 20 °C) para calcular la DBO₅ a partir de la DBO última. */
export const K1_BOTTLE = 0.23;
/** Coeficientes de corrección de temperatura (Arrhenius modificado): k_T = k_20·θ^(T − 20). */
export const THETA = { kd: 1.047, ka: 1.024, kb: 1.07 } as const;
/** Tasa de mortalidad de coliformes fecales a 20 °C (d⁻¹) y velocidad de sedimentación de las partículas (m/d). */
export const KB20 = 1.0;
export const SETTLING_M_PER_D = 0.25;
/** Factor para estimar los sólidos disueltos totales a partir de la conductividad (mg/L por µS/cm). */
export const TDS_FACTOR = 0.65;

/* ------------------------------------------------------------------ ríos y vertimientos */

export type RiverId = 'apartado' | 'leon';
export type SourceId = 'domestico' | 'tratada' | 'bananera';

/** Calidad del agua: los mismos parámetros para el río (fondo) y para el vertimiento. */
export interface WaterParams {
  pH: number;
  /** Conductividad eléctrica (µS/cm a 25 °C). */
  ec: number;
  /** Turbidez (UNT). */
  turbidity: number;
  /** Nitratos (mg/L como NO₃⁻). */
  nitrate: number;
  /** Fosfatos (mg/L como PO₄³⁻). */
  phosphate: number;
  /** DBO₅ (mg/L). */
  bod5: number;
  /** Coliformes fecales (NMP/100 mL). */
  coliforms: number;
}

export interface RiverDef extends WaterParams {
  id: RiverId;
  name: string;
  short: string;
  /** Fracción de saturación de oxígeno del agua de fondo (aguas arriba). */
  doSatFraction: number;
  /** Geometría hidráulica: u = a·Q^b (m/s), H = c·Q^f (m), con Q en m³/s. */
  hyd: { a: number; b: number; c: number; f: number };
}

export interface SourceDef extends WaterParams {
  id: SourceId;
  name: string;
  short: string;
  /** Oxígeno disuelto del vertimiento (mg/L). */
  dissolvedO2: number;
  /** Cuánto más caliente que el río llega el vertimiento (°C). */
  deltaT: number;
  /** Multiplicador de k_d: la materia orgánica ya tratada se degrada más despacio. */
  kdFactor: number;
  description: string;
}

export const RIVERS: RiverDef[] = [
  {
    id: 'apartado', name: 'Río Apartadó (tramo de piedemonte: rápido y poco profundo)', short: 'Río Apartadó',
    pH: 7.5, ec: 140, turbidity: 6, nitrate: 0.8, phosphate: 0.04, bod5: 1.2, coliforms: 150, doSatFraction: 0.95,
    hyd: { a: 0.28, b: 0.34, c: 0.42, f: 0.33 },
  },
  {
    id: 'leon', name: 'Río León (tramo de llanura: lento y profundo)', short: 'Río León',
    pH: 7.1, ec: 190, turbidity: 40, nitrate: 1.2, phosphate: 0.1, bod5: 2.0, coliforms: 900, doSatFraction: 0.85,
    hyd: { a: 0.12, b: 0.34, c: 1.2, f: 0.33 },
  },
];

export const SOURCES: SourceDef[] = [
  {
    id: 'domestico', name: 'Aguas residuales domésticas sin tratar', short: 'ARD cruda',
    pH: 7.2, ec: 900, turbidity: 150, nitrate: 2, phosphate: 10, bod5: 220, coliforms: 1e7, dissolvedO2: 0.5, deltaT: 3, kdFactor: 1,
    description: 'Alcantarillado de un barrio que descarga sin tratamiento: mucha materia orgánica, fósforo de detergentes y bacterias fecales.',
  },
  {
    id: 'tratada', name: 'Efluente de una planta de tratamiento (secundario)', short: 'ARD tratada',
    pH: 7.4, ec: 850, turbidity: 15, nitrate: 20, phosphate: 7, bod5: 30, coliforms: 1e5, dissolvedO2: 2, deltaT: 2, kdFactor: 0.6,
    description: 'Aguas residuales domésticas después de un tratamiento biológico sin desinfección: poca DBO, pero aún con nutrientes y coliformes.',
  },
  {
    id: 'bananera', name: 'Canal de drenaje de una plantación bananera', short: 'Drenaje bananero',
    pH: 6.5, ec: 450, turbidity: 300, nitrate: 30, phosphate: 1.5, bod5: 15, coliforms: 3000, dissolvedO2: 5.5, deltaT: 1, kdFactor: 0.8,
    description: 'Escorrentía y drenaje de un cultivo de banano: sedimentos del suelo, nitratos de los fertilizantes y algo de materia orgánica. Los plaguicidas no se simulan.',
  },
];

export function riverById(id: RiverId): RiverDef {
  const r = RIVERS.find((x) => x.id === id);
  if (!r) throw new RangeError(`Río desconocido: ${id}`);
  return r;
}

export function sourceById(id: SourceId): SourceDef {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new RangeError(`Vertimiento desconocido: ${id}`);
  return s;
}

/** Rangos de las entradas del simulador. */
export const RANGES = {
  riverFlow: [0.5, 30] as [number, number], // m³/s
  dischargeFlow: [0, 1000] as [number, number], // L/s
  riverTemp: [20, 32] as [number, number], // °C
  distance: [-2, 30] as [number, number], // km (negativo: aguas arriba)
};

/* ------------------------------------------------------------------ fisicoquímica básica */

/** Presión atmosférica (kPa) a una altitud z (m), atmósfera estándar. */
export function pressureAt(elevationM: number): number {
  assertInRange('La altitud', elevationM, -500, 5000);
  return 101.325 * (1 - 2.25577e-5 * elevationM) ** 5.25588;
}

/**
 * Concentración de saturación de oxígeno disuelto en agua dulce (mg/L) con la ecuación de
 * Benson y Krause (1984) que adopta APHA 4500-O, corregida por la presión de forma aproximada (Cs·P/P₀).
 */
export function doSaturation(tempC: number, elevationM = ELEVATION_M): number {
  assertInRange('La temperatura del agua', tempC, 0, 40);
  const T = tempC + 273.15;
  const ln = -139.34411 + 1.575701e5 / T - 6.642308e7 / T ** 2 + 1.2438e10 / T ** 3 - 8.621949e11 / T ** 4;
  return Math.exp(ln) * (pressureAt(elevationM) / 101.325);
}

/** Corrección de una constante cinética por temperatura: k_T = k_20·θ^(T − 20). */
export function arrhenius(k20: number, theta: number, tempC: number): number {
  return k20 * theta ** (tempC - 20);
}

/** Mezcla completa de dos corrientes (promedio ponderado por caudal). */
export function mix(cRiver: number, qRiver: number, cWaste: number, qWaste: number): number {
  const q = qRiver + qWaste;
  if (q <= 0) throw new RangeError('El caudal total debe ser positivo.');
  return (qRiver * cRiver + qWaste * cWaste) / q;
}

/** DBO₅ a partir de la DBO última L (mg/L): DBO₅ = L·(1 − e^(−5k₁)). */
export const bod5FromUltimate = (L: number) => L * (1 - Math.exp(-5 * K1_BOTTLE));
/** DBO última a partir de la DBO₅. */
export const ultimateFromBod5 = (bod5: number) => bod5 / (1 - Math.exp(-5 * K1_BOTTLE));

/* ------------------------------------------------------------------ hidráulica y constantes de velocidad */

export interface Hydraulics {
  /** Velocidad media (m/s). */
  u: number;
  /** Profundidad media (m). */
  H: number;
  /** Ancho medio (m), por continuidad Q = u·H·W. */
  W: number;
  /** Distancia recorrida por día (km/d). */
  kmPerDay: number;
}

export function hydraulics(river: RiverId, riverFlow: number): Hydraulics {
  assertInRange('El caudal del río', riverFlow, ...RANGES.riverFlow);
  const { a, b, c, f } = riverById(river).hyd;
  const u = a * riverFlow ** b;
  const H = c * riverFlow ** f;
  return { u, H, W: riverFlow / (u * H), kmPerDay: u * 86.4 };
}

/** Reaireación de O'Connor–Dobbins a 20 °C (d⁻¹): k_a = 3,93·u^0,5 / H^1,5 (u en m/s, H en m). */
export function reaerationOConnorDobbins(u: number, H: number): number {
  if (u <= 0 || H <= 0) throw new RangeError('La velocidad y la profundidad deben ser positivas.');
  return (3.93 * Math.sqrt(u)) / H ** 1.5;
}

/**
 * Desoxigenación en el río a 20 °C (d⁻¹) según la profundidad (Hydroscience, 1971; Chapra, 1997):
 * k_d = 0,3·(H/2,4)^(−0,434) si H ≤ 2,4 m; 0,3 d⁻¹ si es más profundo. En ríos poco profundos la
 * biopelícula del lecho acelera la degradación.
 */
export function deoxygenation20(H: number): number {
  if (H <= 0) throw new RangeError('La profundidad debe ser positiva.');
  return H <= 2.4 ? 0.3 * (H / 2.4) ** -0.434 : 0.3;
}

/* ------------------------------------------------------------------ Streeter–Phelps */

/**
 * Déficit de oxígeno D(t) (mg/L) de Streeter–Phelps:
 *   D(t) = k_d·L₀/(k_a − k_d)·(e^(−k_d t) − e^(−k_a t)) + D₀·e^(−k_a t)
 * Si k_a = k_d: D(t) = (k_d·L₀·t + D₀)·e^(−k_d t).
 */
export function streeterPhelps(L0: number, D0: number, kd: number, ka: number, t: number): number {
  if (t < 0) throw new RangeError('El tiempo de viaje no puede ser negativo.');
  if (Math.abs(ka - kd) < 1e-9) return (kd * L0 * t + D0) * Math.exp(-kd * t);
  return ((kd * L0) / (ka - kd)) * (Math.exp(-kd * t) - Math.exp(-ka * t)) + D0 * Math.exp(-ka * t);
}

/**
 * Punto crítico (máximo déficit) de Streeter–Phelps:
 *   t_c = 1/(k_a − k_d)·ln[(k_a/k_d)·(1 − D₀(k_a − k_d)/(k_d·L₀))]
 * Si el argumento no da un t_c positivo, el máximo déficit está en el punto de vertimiento (t_c = 0).
 */
export function criticalPoint(L0: number, D0: number, kd: number, ka: number): { tc: number; Dc: number } {
  if (L0 <= 0 || kd <= 0) return { tc: 0, Dc: D0 };
  let tc: number;
  if (Math.abs(ka - kd) < 1e-9) tc = (1 / kd) * (1 - D0 / L0);
  else {
    const arg = (ka / kd) * (1 - (D0 * (ka - kd)) / (kd * L0));
    tc = arg > 0 ? Math.log(arg) / (ka - kd) : 0;
  }
  if (!(tc > 0)) return { tc: 0, Dc: D0 };
  return { tc, Dc: streeterPhelps(L0, D0, kd, ka, tc) };
}

/* ------------------------------------------------------------------ índice biológico BMWP/Col */

export type TaxonGroup = 'efemeroptero' | 'plecoptero' | 'tricoptero' | 'coleoptero' | 'odonato' | 'diptero' | 'hemiptero' | 'megaloptero' | 'molusco' | 'anelido' | 'crustaceo' | 'platelminto';

export interface Family {
  name: string;
  order: string;
  group: TaxonGroup;
  /** Puntaje BMWP/Col (Roldán, 2003). */
  score: number;
  /** Tolerancia simulada: saturación mínima de O₂ (%), DBO₅ máxima (mg/L) y turbidez máxima (UNT). */
  minDOsat: number;
  maxBod5: number;
  maxTurbidity: number;
  /** Solo aparece (abunda) en aguas con poco oxígeno. */
  onlyBelowDOsat?: number;
}

/**
 * Familias de macroinvertebrados frecuentes en ríos de tierras bajas de Antioquia, con su puntaje
 * BMWP/Col (Roldán, 2003). Los umbrales de tolerancia son una SIMPLIFICACIÓN didáctica de su
 * sensibilidad relativa, no valores publicados.
 */
export const FAMILIES: Family[] = [
  { name: 'Perlidae', order: 'Plecoptera', group: 'plecoptero', score: 10, minDOsat: 85, maxBod5: 3, maxTurbidity: 50 },
  { name: 'Psephenidae', order: 'Coleoptera', group: 'coleoptero', score: 10, minDOsat: 80, maxBod5: 3, maxTurbidity: 30 },
  { name: 'Polythoridae', order: 'Odonata', group: 'odonato', score: 10, minDOsat: 85, maxBod5: 3, maxTurbidity: 40 },
  { name: 'Gomphidae', order: 'Odonata', group: 'odonato', score: 10, minDOsat: 70, maxBod5: 5, maxTurbidity: 100 },
  { name: 'Leptophlebiidae', order: 'Ephemeroptera', group: 'efemeroptero', score: 9, minDOsat: 75, maxBod5: 4, maxTurbidity: 60 },
  { name: 'Philopotamidae', order: 'Trichoptera', group: 'tricoptero', score: 9, minDOsat: 80, maxBod5: 3, maxTurbidity: 40 },
  { name: 'Simuliidae', order: 'Diptera', group: 'diptero', score: 8, minDOsat: 70, maxBod5: 6, maxTurbidity: 100 },
  { name: 'Leptoceridae', order: 'Trichoptera', group: 'tricoptero', score: 8, minDOsat: 70, maxBod5: 5, maxTurbidity: 80 },
  { name: 'Veliidae', order: 'Hemiptera', group: 'hemiptero', score: 8, minDOsat: 60, maxBod5: 8, maxTurbidity: 150 },
  { name: 'Palaemonidae', order: 'Decapoda', group: 'crustaceo', score: 8, minDOsat: 60, maxBod5: 6, maxTurbidity: 200 },
  { name: 'Baetidae', order: 'Ephemeroptera', group: 'efemeroptero', score: 7, minDOsat: 60, maxBod5: 8, maxTurbidity: 120 },
  { name: 'Hydropsychidae', order: 'Trichoptera', group: 'tricoptero', score: 7, minDOsat: 55, maxBod5: 10, maxTurbidity: 150 },
  { name: 'Leptohyphidae', order: 'Ephemeroptera', group: 'efemeroptero', score: 7, minDOsat: 60, maxBod5: 8, maxTurbidity: 100 },
  { name: 'Coenagrionidae', order: 'Odonata', group: 'odonato', score: 7, minDOsat: 45, maxBod5: 12, maxTurbidity: 200 },
  { name: 'Naucoridae', order: 'Hemiptera', group: 'hemiptero', score: 7, minDOsat: 55, maxBod5: 8, maxTurbidity: 150 },
  { name: 'Elmidae', order: 'Coleoptera', group: 'coleoptero', score: 6, minDOsat: 60, maxBod5: 6, maxTurbidity: 80 },
  { name: 'Corydalidae', order: 'Megaloptera', group: 'megaloptero', score: 6, minDOsat: 70, maxBod5: 5, maxTurbidity: 80 },
  { name: 'Libellulidae', order: 'Odonata', group: 'odonato', score: 6, minDOsat: 40, maxBod5: 15, maxTurbidity: 250 },
  { name: 'Belostomatidae', order: 'Hemiptera', group: 'hemiptero', score: 5, minDOsat: 30, maxBod5: 20, maxTurbidity: 300 },
  { name: 'Thiaridae', order: 'Mesogastropoda', group: 'molusco', score: 5, minDOsat: 30, maxBod5: 20, maxTurbidity: 300 },
  { name: 'Hydrophilidae', order: 'Coleoptera', group: 'coleoptero', score: 3, minDOsat: 20, maxBod5: 40, maxTurbidity: 400 },
  { name: 'Glossiphoniidae', order: 'Rhynchobdellida', group: 'anelido', score: 3, minDOsat: 15, maxBod5: 60, maxTurbidity: 500 },
  { name: 'Physidae', order: 'Basommatophora', group: 'molusco', score: 3, minDOsat: 10, maxBod5: 80, maxTurbidity: 500 },
  { name: 'Chironomidae', order: 'Diptera', group: 'diptero', score: 2, minDOsat: 0, maxBod5: Infinity, maxTurbidity: Infinity },
  { name: 'Syrphidae', order: 'Diptera', group: 'diptero', score: 2, minDOsat: 0, maxBod5: Infinity, maxTurbidity: Infinity, onlyBelowDOsat: 40 },
  { name: 'Tubificidae', order: 'Haplotaxida', group: 'anelido', score: 1, minDOsat: 0, maxBod5: Infinity, maxTurbidity: Infinity },
];

export interface BmwpClass { roman: 'I' | 'II' | 'III' | 'IV' | 'V'; quality: string; meaning: string; color: string; }

/** Clases de calidad del BMWP/Col (Roldán, 2003; adaptación usual con «> 100» para la clase I). */
export function bmwpClass(score: number): BmwpClass {
  if (score > 100) return { roman: 'I', quality: 'Buena', meaning: 'aguas muy limpias a limpias', color: 'var(--ok)' };
  if (score >= 61) return { roman: 'II', quality: 'Aceptable', meaning: 'aguas ligeramente contaminadas', color: 'var(--series-3)' };
  if (score >= 36) return { roman: 'III', quality: 'Dudosa', meaning: 'aguas moderadamente contaminadas', color: 'var(--warn)' };
  if (score >= 16) return { roman: 'IV', quality: 'Crítica', meaning: 'aguas muy contaminadas', color: 'var(--series-5)' };
  return { roman: 'V', quality: 'Muy crítica', meaning: 'aguas fuertemente contaminadas', color: 'var(--bad)' };
}

export interface BmwpResult { families: Family[]; score: number; n: number; aspt: number; cls: BmwpClass; }

/** Familias presentes y puntaje BMWP/Col (suma de puntajes; cada familia cuenta una vez). ASPT = BMWP/n. */
export function bmwpCol(conditions: { doSatPercent: number; bod5: number; turbidity: number }): BmwpResult {
  const { doSatPercent, bod5, turbidity } = conditions;
  assertInRange('La saturación de oxígeno', doSatPercent, 0, 200);
  const families = FAMILIES.filter((f) =>
    doSatPercent >= f.minDOsat && bod5 <= f.maxBod5 && turbidity <= f.maxTurbidity &&
    (f.onlyBelowDOsat === undefined || doSatPercent < f.onlyBelowDOsat));
  const score = families.reduce((s, f) => s + f.score, 0);
  const n = families.length;
  return { families, score, n, aspt: n > 0 ? score / n : 0, cls: bmwpClass(score) };
}

/* ------------------------------------------------------------------ índice de calidad tipo NSF */

type Curve = [number, number][];

/** Interpolación lineal por tramos; fuera del intervalo se usa el valor del extremo. */
export function interpolate(curve: Curve, x: number): number {
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (x <= x1) {
      const [x0, y0] = curve[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return curve[curve.length - 1][1];
}

/**
 * Curvas de subíndice (0–100) del índice NSF, APROXIMADAS por tramos a partir de las gráficas
 * publicadas (Brown et al., 1970; Mitchell y Stapp). Validar con la fuente antes de usarlas para informar.
 */
export const WQI_CURVES: Record<WqiParam, Curve> = {
  doSat: [[0, 0], [20, 12], [40, 30], [60, 56], [80, 85], [90, 94], [100, 99], [110, 98], [120, 95], [140, 83], [160, 70]],
  coliformsLog: [[0, 99], [1, 71], [2, 44], [3, 22], [4, 8], [5, 2]],
  pH: [[2, 0], [3, 4], [4, 8], [5, 25], [6, 55], [7, 88], [7.3, 93], [8, 82], [9, 52], [10, 20], [11, 8], [12, 3]],
  bod5: [[0, 100], [1, 90], [2, 80], [3, 70], [5, 56], [8, 40], [10, 32], [15, 17], [20, 10], [30, 2]],
  deltaT: [[-10, 56], [-5, 74], [0, 93], [5, 72], [10, 45], [15, 28], [20, 18], [30, 7]],
  phosphate: [[0, 100], [0.25, 90], [0.5, 80], [1, 62], [2, 45], [3, 34], [4, 26], [5, 20], [10, 6]],
  nitrate: [[0, 100], [1, 97], [2, 92], [5, 72], [10, 52], [20, 36], [30, 25], [50, 10], [100, 2]],
  turbidity: [[0, 98], [5, 85], [10, 76], [20, 62], [40, 44], [60, 32], [80, 22], [100, 17], [150, 8], [200, 5]],
  tds: [[0, 80], [50, 90], [100, 86], [200, 72], [300, 57], [400, 43], [500, 30], [600, 20]],
};

export type WqiParam = 'doSat' | 'coliformsLog' | 'pH' | 'bod5' | 'deltaT' | 'phosphate' | 'nitrate' | 'turbidity' | 'tds';

/** Pesos del índice NSF (suman 1). */
export const WQI_WEIGHTS: Record<WqiParam, number> = {
  doSat: 0.17, coliformsLog: 0.16, pH: 0.11, bod5: 0.11, deltaT: 0.10, phosphate: 0.10, nitrate: 0.10, turbidity: 0.08, tds: 0.07,
};

export const WQI_LABELS: Record<WqiParam, string> = {
  doSat: 'Oxígeno disuelto (% de saturación)', coliformsLog: 'Coliformes fecales', pH: 'pH', bod5: 'DBO₅',
  deltaT: 'Cambio de temperatura', phosphate: 'Fosfatos', nitrate: 'Nitratos', turbidity: 'Turbidez', tds: 'Sólidos disueltos totales',
};

export interface WqiClass { quality: string; color: string; }

/** Clases del índice (iguales cortes que el ICA del IDEAM: 0,91–1 buena; 0,71–0,90 aceptable…). */
export function wqiClass(value: number): WqiClass {
  if (value >= 91) return { quality: 'Excelente', color: 'var(--ok)' };
  if (value >= 71) return { quality: 'Buena', color: 'var(--series-3)' };
  if (value >= 51) return { quality: 'Regular', color: 'var(--warn)' };
  if (value >= 26) return { quality: 'Mala', color: 'var(--series-5)' };
  return { quality: 'Muy mala', color: 'var(--bad)' };
}

export interface WqiInput { doSatPercent: number; coliforms: number; pH: number; bod5: number; deltaT: number; phosphate: number; nitrate: number; turbidity: number; ec: number; }
export interface WqiResult { value: number; sub: Record<WqiParam, number>; cls: WqiClass; }

/** Índice de calidad del agua tipo NSF: suma ponderada de subíndices, ICA = Σ wᵢ·Qᵢ (0 a 100). */
export function waterQualityIndex(p: WqiInput): WqiResult {
  assertInRange('El pH', p.pH, 0, 14);
  if (p.coliforms < 0 || p.bod5 < 0 || p.turbidity < 0 || p.nitrate < 0 || p.phosphate < 0 || p.ec < 0) throw new RangeError('Las concentraciones no pueden ser negativas.');
  const sub: Record<WqiParam, number> = {
    doSat: interpolate(WQI_CURVES.doSat, p.doSatPercent),
    coliformsLog: interpolate(WQI_CURVES.coliformsLog, Math.log10(Math.max(1, p.coliforms))),
    pH: interpolate(WQI_CURVES.pH, p.pH),
    bod5: interpolate(WQI_CURVES.bod5, p.bod5),
    deltaT: interpolate(WQI_CURVES.deltaT, p.deltaT),
    phosphate: interpolate(WQI_CURVES.phosphate, p.phosphate),
    nitrate: interpolate(WQI_CURVES.nitrate, p.nitrate),
    turbidity: interpolate(WQI_CURVES.turbidity, p.turbidity),
    tds: interpolate(WQI_CURVES.tds, p.ec * TDS_FACTOR),
  };
  const value = (Object.keys(WQI_WEIGHTS) as WqiParam[]).reduce((s, k) => s + WQI_WEIGHTS[k] * sub[k], 0);
  return { value, sub, cls: wqiClass(value) };
}

/* ------------------------------------------------------------------ normas colombianas (referencia) */

export interface NormRef {
  id: string;
  param: 'od' | 'pH' | 'coliforms' | 'turbidity' | 'nitrate' | 'phosphate' | 'ec' | 'bod5';
  label: string;
  rule: string;
  min?: number;
  max?: number;
  source: string;
  scope: 'rio' | 'potable' | 'vertimiento';
}

/**
 * Valores de REFERENCIA de normas colombianas citados para discusión en clase. Deben ser validados por
 * el docente con el texto vigente (pueden haber sido modificados o depender del uso y de la carga).
 */
export const NORMS: NormRef[] = [
  { id: 'od-fauna', param: 'od', label: 'Oxígeno disuelto para preservar flora y fauna (agua cálida dulce)', rule: '≥ 4,0 mg/L', min: 4, source: 'Decreto 1076 de 2015 (criterios del Decreto 1594 de 1984)', scope: 'rio' },
  { id: 'ph-fauna', param: 'pH', label: 'pH para preservar flora y fauna (agua cálida dulce)', rule: '4,5 a 9,0', min: 4.5, max: 9, source: 'Decreto 1076 de 2015 (criterios del Decreto 1594 de 1984)', scope: 'rio' },
  { id: 'cf-contacto', param: 'coliforms', label: 'Coliformes fecales para recreación con contacto primario (bañarse)', rule: '≤ 200 NMP/100 mL', max: 200, source: 'Decreto 1076 de 2015 (criterios del Decreto 1594 de 1984)', scope: 'rio' },
  { id: 'cf-fuente', param: 'coliforms', label: 'Coliformes fecales en una fuente para consumo humano con tratamiento convencional', rule: '≤ 2000 NMP/100 mL', max: 2000, source: 'Decreto 1076 de 2015 (criterios del Decreto 1594 de 1984)', scope: 'rio' },
  { id: 'ph-2115', param: 'pH', label: 'pH del agua potable', rule: '6,5 a 9,0', min: 6.5, max: 9, source: 'Resolución 2115 de 2007', scope: 'potable' },
  { id: 'turb-2115', param: 'turbidity', label: 'Turbiedad del agua potable', rule: '≤ 2 UNT', max: 2, source: 'Resolución 2115 de 2007', scope: 'potable' },
  { id: 'ec-2115', param: 'ec', label: 'Conductividad del agua potable', rule: '≤ 1000 µS/cm', max: 1000, source: 'Resolución 2115 de 2007', scope: 'potable' },
  { id: 'no3-2115', param: 'nitrate', label: 'Nitratos en el agua potable', rule: '≤ 10 mg/L NO₃⁻', max: 10, source: 'Resolución 2115 de 2007', scope: 'potable' },
  { id: 'po4-2115', param: 'phosphate', label: 'Fosfatos en el agua potable', rule: '≤ 0,5 mg/L PO₄³⁻', max: 0.5, source: 'Resolución 2115 de 2007', scope: 'potable' },
  { id: 'cf-2115', param: 'coliforms', label: 'E. coli en el agua potable', rule: '0 por 100 mL', max: 0, source: 'Resolución 2115 de 2007', scope: 'potable' },
  { id: 'dbo-631', param: 'bod5', label: 'DBO₅ de un vertimiento de aguas residuales domésticas (alcantarillado municipal)', rule: '≤ 90 mg/L', max: 90, source: 'Resolución 631 de 2015 (verificar la categoría según la carga)', scope: 'vertimiento' },
  { id: 'ph-631', param: 'pH', label: 'pH de un vertimiento de aguas residuales domésticas', rule: '6,0 a 9,0', min: 6, max: 9, source: 'Resolución 631 de 2015', scope: 'vertimiento' },
];

/** ¿El valor cumple la referencia? */
export function complies(norm: NormRef, value: number): boolean {
  if (norm.min !== undefined && value < norm.min) return false;
  if (norm.max !== undefined && value > norm.max) return false;
  return true;
}

/* ------------------------------------------------------------------ simulación del tramo */

export interface WaterInput {
  river: RiverId;
  source: SourceId;
  /** Caudal del río aguas arriba (m³/s). */
  riverFlow: number;
  /** Caudal del vertimiento (L/s). */
  dischargeFlow: number;
  /** Temperatura del río aguas arriba (°C). */
  riverTemp: number;
  /** Distancia del punto de muestreo al vertimiento (km); negativa = aguas arriba. */
  distance: number;
}

export interface SiteState extends WaterParams {
  temp: number;
  /** Oxígeno disuelto (mg/L) y saturación (mg/L). */
  od: number;
  cs: number;
  doSatPercent: number;
  /** Déficit total (mg/L). */
  deficit: number;
  /** DBO última remanente (mg/L). */
  ultimate: number;
}

export interface WaterResult {
  river: RiverDef;
  source: SourceDef;
  hyd: Hydraulics;
  /** Constantes a la temperatura de la mezcla (d⁻¹). */
  kd: number;
  ka: number;
  kb: number;
  ks: number;
  /** Fracción del caudal que aporta el vertimiento y factor de dilución Q_total/Q_w. */
  wasteFraction: number;
  dilution: number;
  /** Condiciones iniciales en el punto de mezcla. */
  mixTemp: number;
  L0: number; // DBO última en exceso sobre el fondo (mg/L)
  D0: number; // déficit en exceso sobre el fondo (mg/L)
  /** Tiempo de viaje hasta el punto de muestreo (d); 0 aguas arriba. */
  travelTime: number;
  /** Punto crítico: tiempo (d), distancia (km) y oxígeno mínimo (mg/L). */
  tc: number;
  xc: number;
  odMin: number;
  /** Estado verdadero del agua en el punto de muestreo y aguas arriba (referencia). */
  site: SiteState;
  upstream: SiteState;
  bmwp: BmwpResult;
  /** El oxígeno se agota en algún punto del tramo (el modelo deja de ser válido allí). */
  anoxic: boolean;
  /** Carga de DBO₅ del vertimiento (kg/d). */
  bodLoadKgPerDay: number;
  warnings: string[];
}

function validate(input: WaterInput) {
  riverById(input.river);
  sourceById(input.source);
  assertInRange('El caudal del río', input.riverFlow, ...RANGES.riverFlow);
  assertInRange('El caudal del vertimiento', input.dischargeFlow, ...RANGES.dischargeFlow);
  assertInRange('La temperatura del río', input.riverTemp, ...RANGES.riverTemp);
  assertInRange('La distancia al vertimiento', input.distance, ...RANGES.distance);
}

function backgroundSite(river: RiverDef, temp: number): SiteState {
  const cs = doSaturation(temp);
  const od = river.doSatFraction * cs;
  return {
    pH: river.pH, ec: river.ec, turbidity: river.turbidity, nitrate: river.nitrate, phosphate: river.phosphate,
    bod5: river.bod5, coliforms: river.coliforms, temp, od, cs, doSatPercent: (od / cs) * 100, deficit: cs - od, ultimate: ultimateFromBod5(river.bod5),
  };
}

/**
 * Simula el tramo de río y el estado del agua en el punto de muestreo. Función pura y determinista.
 * Aguas abajo se superpone la perturbación del vertimiento al estado de fondo del río:
 *   L(t) = L_fondo + L₀·e^(−k_d t);  D(t) = D_fondo + D_SP(t; L₀, D₀);  N(t) = N_fondo + (N_mezcla − N_fondo)·e^(−k_b t).
 */
export function simulateRiver(input: WaterInput): WaterResult {
  validate(input);
  const river = riverById(input.river);
  const source = sourceById(input.source);
  const hyd = hydraulics(river.id, input.riverFlow);
  const qr = input.riverFlow;
  const qw = input.dischargeFlow / 1000;
  const q = qr + qw;
  const wasteFraction = qw / q;
  const dilution = qw > 0 ? q / qw : Infinity;

  const upstream = backgroundSite(river, input.riverTemp);
  const mixTemp = mix(input.riverTemp, qr, input.riverTemp + source.deltaT, qw);
  const bg = backgroundSite(river, mixTemp); // fondo a la temperatura de la mezcla
  const m = (a: number, b: number) => mix(a, qr, b, qw);

  const kd = arrhenius(deoxygenation20(hyd.H) * source.kdFactor, THETA.kd, mixTemp);
  const ka = arrhenius(reaerationOConnorDobbins(hyd.u, hyd.H), THETA.ka, mixTemp);
  const kb = arrhenius(KB20, THETA.kb, mixTemp);
  const ks = SETTLING_M_PER_D / hyd.H;

  const Lmix = m(ultimateFromBod5(river.bod5), ultimateFromBod5(source.bod5));
  const L0 = Math.max(0, Lmix - bg.ultimate);
  const odMix = m(river.doSatFraction * doSaturation(input.riverTemp), source.dissolvedO2);
  const D0 = Math.max(0, (bg.cs - odMix) - bg.deficit);
  const pHmix = m(river.pH, source.pH);
  const turbMix = m(river.turbidity, source.turbidity);
  const cfMix = m(river.coliforms, source.coliforms);

  const cp = criticalPoint(L0, D0, kd, ka);
  const odMin = Math.max(0, bg.cs - bg.deficit - cp.Dc);

  const downstream = input.distance >= 0;
  const t = downstream ? input.distance / hyd.kmPerDay : 0;
  let site: SiteState;
  if (!downstream) site = upstream;
  else {
    const deficit = bg.deficit + streeterPhelps(L0, D0, kd, ka, t);
    const od = Math.max(0, bg.cs - deficit);
    const ultimate = bg.ultimate + L0 * Math.exp(-kd * t);
    site = {
      temp: mixTemp, cs: bg.cs, od, doSatPercent: (od / bg.cs) * 100, deficit, ultimate,
      bod5: bod5FromUltimate(ultimate),
      pH: pHmix,
      ec: m(river.ec, source.ec),
      nitrate: m(river.nitrate, source.nitrate),
      phosphate: m(river.phosphate, source.phosphate),
      turbidity: river.turbidity + (turbMix - river.turbidity) * Math.exp(-ks * t),
      coliforms: river.coliforms + (cfMix - river.coliforms) * Math.exp(-kb * t),
    };
  }

  const bmwp = bmwpCol({ doSatPercent: site.doSatPercent, bod5: site.bod5, turbidity: site.turbidity });
  const anoxic = qw > 0 && bg.cs - bg.deficit - cp.Dc <= 0;
  const bodLoadKgPerDay = source.bod5 * qw * 86.4; // mg/L · m³/s · 86 400 s/d · 1000 L/m³ / 1e6 mg/kg

  const warnings: string[] = [];
  if (anoxic) warnings.push('El oxígeno disuelto se agota en parte del tramo: allí el río se vuelve anaerobio (malos olores, mortandad de peces) y el modelo de Streeter–Phelps deja de ser válido.');
  else if (qw > 0 && odMin < 4) warnings.push('En el punto crítico el oxígeno baja de 4 mg/L, valor de referencia para preservar la fauna acuática en aguas cálidas.');
  if (wasteFraction > 0.25) warnings.push('El vertimiento aporta más de la cuarta parte del caudal: la dilución es muy baja.');
  if (input.source === 'bananera' && qw > 0) warnings.push('El drenaje bananero real puede llevar plaguicidas (fungicidas e insecticidas) que este simulador no calcula y que afectan a los macroinvertebrados.');

  return {
    river, source, hyd, kd, ka, kb, ks, wasteFraction, dilution, mixTemp, L0, D0,
    travelTime: t, tc: cp.tc, xc: cp.tc * hyd.kmPerDay, odMin, site, upstream, bmwp, anoxic, bodLoadKgPerDay, warnings,
  };
}

/** Perfil de oxígeno disuelto a lo largo del tramo (para graficar): puntos (km, mg/L). */
export function oxygenProfile(input: Omit<WaterInput, 'distance'>, n = 121): { x: number; od: number }[] {
  const [a, b] = RANGES.distance;
  const pts: { x: number; od: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = a + ((b - a) * i) / (n - 1);
    pts.push({ x, od: simulateRiver({ ...input, distance: x }).site.od });
  }
  return pts;
}

/* ------------------------------------------------------------------ instrumentos y lecturas */

export interface ProbeSpec { id: string; name: string; quantity: string; unit: string; resolution: number; sigma?: number; relSigma?: number; nonNegative?: boolean; note: string; }

/**
 * Sonda multiparamétrica y análisis de laboratorio (valores ILUSTRATIVOS de equipos típicos).
 * Coinciden con la entrada sugerida para src/labs/instruments.ts.
 */
export const PROBE: Record<'temp' | 'pH' | 'od' | 'ec' | 'turb' | 'no3' | 'po4' | 'dbo' | 'cf', ProbeSpec> = {
  temp: { id: 'temp', name: 'Sonda multiparamétrica: termistor', quantity: 'Temperatura', unit: '°C', resolution: 0.1, sigma: 0.1, note: 'Tiempo de estabilización del sensor en la corriente.' },
  pH: { id: 'pH', name: 'Sonda multiparamétrica: electrodo de pH', quantity: 'pH', unit: '—', resolution: 0.01, sigma: 0.02, note: 'Calibración con soluciones tampón 4, 7 y 10 y deriva del electrodo.' },
  od: { id: 'od', name: 'Sonda multiparamétrica: sensor óptico de oxígeno', quantity: 'Oxígeno disuelto', unit: 'mg/L', resolution: 0.01, sigma: 0.05, relSigma: 0.01, nonNegative: true, note: 'Calibración en aire saturado y velocidad del agua sobre el sensor.' },
  ec: { id: 'ec', name: 'Sonda multiparamétrica: celda de conductividad', quantity: 'Conductividad (25 °C)', unit: 'µS/cm', resolution: 1, sigma: 2, relSigma: 0.01, nonNegative: true, note: 'Compensación de temperatura a 25 °C y burbujas en la celda.' },
  turb: { id: 'turb', name: 'Turbidímetro nefelométrico', quantity: 'Turbidez', unit: 'UNT', resolution: 0.1, sigma: 0.3, relSigma: 0.03, nonNegative: true, note: 'Sedimentación de partículas y rayas o huellas en la celda.' },
  no3: { id: 'no3', name: 'Fotómetro: nitratos (reducción con cadmio)', quantity: 'Nitratos', unit: 'mg/L NO₃⁻', resolution: 0.1, sigma: 0.2, relSigma: 0.05, nonNegative: true, note: 'Tiempo de reacción del reactivo y turbidez de la muestra.' },
  po4: { id: 'po4', name: 'Fotómetro: fosfatos (ácido ascórbico)', quantity: 'Fosfatos', unit: 'mg/L PO₄³⁻', resolution: 0.01, sigma: 0.02, relSigma: 0.05, nonNegative: true, note: 'Contaminación con detergentes del material y tiempo de desarrollo del color.' },
  dbo: { id: 'dbo', name: 'Botellas Winkler: DBO₅ (5 días a 20 °C)', quantity: 'DBO₅', unit: 'mg/L', resolution: 0.1, sigma: 0.3, relSigma: 0.1, nonNegative: true, note: 'Dilución de la muestra, semilla bacteriana e incubación de 5 días.' },
  cf: { id: 'cf', name: 'Tubos múltiples: coliformes fecales (NMP)', quantity: 'Coliformes fecales', unit: 'NMP/100 mL', resolution: 1, relSigma: 0.3, nonNegative: true, note: 'El NMP es una estimación estadística con un intervalo de confianza amplio.' },
};

/** Redondea a n cifras significativas (para el NMP de coliformes). */
export function roundSig(v: number, sig = 2): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  const p = Math.floor(Math.log10(Math.abs(v))) - (sig - 1);
  return p >= 0 ? Math.round(v / 10 ** p) * 10 ** p : Number((Math.round(v / 10 ** p) * 10 ** p).toFixed(-p));
}

export interface Readings {
  temp: number; pH: number; od: number; doSat: number; ec: number; turbidity: number; nitrate: number; phosphate: number; bod5: number; coliforms: number;
}

/** Lecturas ideales (redondeadas a la resolución de cada instrumento). */
export function idealReadings(site: SiteState): Readings {
  const temp = roundToResolution(site.temp, PROBE.temp.resolution);
  const od = roundToResolution(site.od, PROBE.od.resolution);
  return {
    temp, od,
    doSat: saturationReading(od, temp),
    pH: roundToResolution(site.pH, PROBE.pH.resolution),
    ec: roundToResolution(site.ec, PROBE.ec.resolution),
    turbidity: roundToResolution(site.turbidity, PROBE.turb.resolution),
    nitrate: roundToResolution(site.nitrate, PROBE.no3.resolution),
    phosphate: roundToResolution(site.phosphate, PROBE.po4.resolution),
    bod5: roundToResolution(site.bod5, PROBE.dbo.resolution),
    coliforms: roundSig(site.coliforms, 2),
  };
}

/** % de saturación que calcula la sonda con el OD y la temperatura leídos (resolución 0,1 %). */
export function saturationReading(od: number, temp: number): number {
  return roundToResolution((od / doSaturation(Math.max(0, Math.min(40, temp)))) * 100, 0.1);
}

/** Índice de calidad calculado con las lecturas (como se hace en campo) y el cambio de temperatura respecto al fondo. */
export function wqiFromReadings(r: Readings, upstreamTemp: number): WqiResult {
  return waterQualityIndex({
    doSatPercent: r.doSat, coliforms: r.coliforms, pH: r.pH, bod5: r.bod5, deltaT: r.temp - upstreamTemp,
    phosphate: r.phosphate, nitrate: r.nitrate, turbidity: r.turbidity, ec: r.ec,
  });
}

/* ------------------------------------------------------------------ ficha del modelo */

export const waterModelSpec: ModelSpec = {
  name: 'Calidad del agua de un río con un vertimiento: Streeter–Phelps, índice BMWP/Col e índice de calidad tipo NSF',
  inputs: [
    { symbol: 'río', name: 'Tramo de río (Apartadó: piedemonte; León: llanura)', unit: '—', initial: 'Río Apartadó' },
    { symbol: 'fuente', name: 'Tipo de vertimiento', unit: '—', initial: 'Aguas residuales domésticas sin tratar' },
    { symbol: 'Q_r', name: 'Caudal del río', unit: 'm³/s', range: RANGES.riverFlow, initial: 3 },
    { symbol: 'Q_w', name: 'Caudal del vertimiento', unit: 'L/s', range: RANGES.dischargeFlow, initial: 300 },
    { symbol: 'T_r', name: 'Temperatura del río aguas arriba', unit: '°C', range: RANGES.riverTemp, initial: 27 },
    { symbol: 'x', name: 'Distancia del punto de muestreo al vertimiento (negativa: aguas arriba)', unit: 'km', range: RANGES.distance, initial: 5 },
  ],
  outputs: [
    { symbol: 'T, pH, OD, %sat, CE', name: 'Lecturas de la sonda multiparamétrica', unit: '°C, —, mg/L, %, µS/cm' },
    { symbol: 'Turb, NO₃⁻, PO₄³⁻', name: 'Turbidez, nitratos y fosfatos', unit: 'UNT, mg/L' },
    { symbol: 'DBO₅', name: 'Demanda bioquímica de oxígeno a 5 días', unit: 'mg/L' },
    { symbol: 'CF', name: 'Coliformes fecales', unit: 'NMP/100 mL' },
    { symbol: 'BMWP/Col', name: 'Índice biológico con macroinvertebrados y su clase', unit: 'puntos' },
    { symbol: 'ICA', name: 'Índice de calidad del agua tipo NSF', unit: '0–100' },
    { symbol: 't_c, x_c, OD_min', name: 'Punto crítico de la curva de oxígeno', unit: 'd, km, mg/L' },
  ],
  equations: [
    'Mezcla completa: C₀ = (Q_r·C_r + Q_w·C_w)/(Q_r + Q_w).',
    'Hidráulica: u = a·Q^b, H = c·Q^f (Leopold y Maddock); t = x/u.',
    'Saturación (Benson y Krause, APHA 4500-O): ln C_s = −139,34411 + 1,575701×10⁵/T − 6,642308×10⁷/T² + 1,2438×10¹⁰/T³ − 8,621949×10¹¹/T⁴ (T en K), × P/P₀.',
    'Reaireación (O’Connor–Dobbins): k_a = 3,93·u^0,5/H^1,5 (20 °C); desoxigenación: k_d = 0,3·(H/2,4)^−0,434 (H ≤ 2,4 m).',
    'Temperatura: k_T = k_20·θ^(T−20), θ = 1,047 (k_d), 1,024 (k_a), 1,07 (k_b).',
    'Streeter–Phelps: D(t) = k_d·L₀/(k_a − k_d)·(e^(−k_d t) − e^(−k_a t)) + D₀·e^(−k_a t); OD = C_s − D_fondo − D(t).',
    'Punto crítico: t_c = 1/(k_a − k_d)·ln[(k_a/k_d)(1 − D₀(k_a − k_d)/(k_d L₀))].',
    'DBO₅ = L·(1 − e^(−5k₁)), k₁ = 0,23 d⁻¹;  L(t) = L_fondo + L₀·e^(−k_d t).',
    'Coliformes (ley de Chick): N(t) = N_fondo + (N₀ − N_fondo)·e^(−k_b t), k_b = 1,0 d⁻¹ a 20 °C.',
    'BMWP/Col = Σ puntajes de las familias presentes; ASPT = BMWP/número de familias.',
    'ICA tipo NSF = Σ wᵢ·Qᵢ (OD 0,17; coliformes 0,16; pH 0,11; DBO₅ 0,11; ΔT 0,10; fosfatos 0,10; nitratos 0,10; turbidez 0,08; sólidos disueltos 0,07).',
  ],
  initialConditions: [
    'Río Apartadó con 3 m³/s a 27 °C, 95 % de saturación de oxígeno y DBO₅ de fondo de 1,2 mg/L.',
    'Vertimiento de 300 L/s de aguas residuales domésticas sin tratar (DBO₅ 220 mg/L, OD 0,5 mg/L, 10⁷ NMP/100 mL).',
    'Altitud de 30 m s. n. m. (presión ≈ 101,0 kPa).',
  ],
  assumptions: [
    'TODOS LOS DATOS SON SIMULADOS: caudales, concentraciones y geometría de los ríos son ilustrativos, no mediciones reales del río Apartadó ni del río León.',
    'Mezcla completa e instantánea en el punto de vertimiento; flujo en pistón sin dispersión aguas abajo; caudal y temperatura constantes en el tramo (sin afluentes).',
    'El vertimiento perturba un estado de fondo estacionario del río: aguas arriba y muy lejos aguas abajo el agua vuelve a su calidad natural.',
    'Solo se modela la DBO carbonácea; no se incluyen la nitrificación, la fotosíntesis y respiración de algas ni la demanda de oxígeno del sedimento.',
    'Conductividad, nitratos y fosfatos se tratan como conservativos (sin consumo por algas ni adsorción); la turbidez se sedimenta a 0,25 m/d.',
    'El pH de la mezcla se aproxima con el promedio ponderado por caudal (en rigor depende de la alcalinidad de cada agua).',
    'Las familias de macroinvertebrados aparecen o desaparecen según umbrales didácticos de oxígeno, DBO₅ y turbidez; sus puntajes son los del BMWP/Col (Roldán, 2003).',
    'Las curvas de subíndice del índice NSF son aproximaciones por tramos; los sólidos disueltos se estiman como 0,65 × conductividad; el fósforo total se aproxima con los fosfatos.',
    'La DBO₅ (5 días) y los coliformes (24 a 48 h) se muestran de inmediato: el simulador comprime el tiempo de incubación.',
    'Los valores normativos se citan como referencia y deben ser validados por el docente con el texto vigente.',
  ],
  limits: [
    'Cuando el oxígeno llega a cero, Streeter–Phelps deja de ser válido (comienza la descomposición anaerobia); el simulador corta el OD en 0 mg/L.',
    'O’Connor–Dobbins se recomienda para profundidades de 0,3 a 9 m y velocidades bajas a moderadas; en rápidos muy turbulentos subestima la reaireación.',
    'No se simulan plaguicidas, metales, grasas ni la variación del día a la noche del oxígeno por la fotosíntesis.',
    'El BMWP/Col se diseñó para ríos andinos; en ríos de llanura algunas familias sensibles faltan por razones naturales (sustrato fangoso), no por contaminación.',
    'El índice tipo NSF no es el ICA oficial del IDEAM, que usa otras variables (por ejemplo, DQO, sólidos suspendidos y nitrógeno/fósforo totales) con los mismos cortes de clase.',
    'En modo de instrumento real se agrega un error aleatorio típico; el NMP de coliformes tiene una incertidumbre del orden de ±30 %.',
  ],
  testCases: [
    'Saturación de Benson y Krause: 9,09 mg/L a 20 °C y 8,26 mg/L a 25 °C a nivel del mar.',
    'Mezcla completa: promedio ponderado por caudal; sin vertimiento el río no cambia.',
    'Streeter–Phelps: D(0) = D₀, el déficit es máximo en t_c (derivada nula) y el caso k_a = k_d es continuo.',
    'El oxígeno aguas abajo tiene un mínimo (curva de comba) y se recupera hacia el valor de fondo.',
    'Más caudal de vertimiento o más temperatura: menor oxígeno mínimo; más caudal del río: más dilución.',
    'El BMWP/Col del agua de fondo del río Apartadó es clase I y baja de clase en el punto crítico.',
    'El ICA vale 100·Σw con subíndices perfectos y disminuye con la contaminación.',
    'Validación de rangos de entrada.',
  ],
};

/** Mayor caudal del vertimiento (múltiplo de 10 L/s, el paso del control) que cumple la condición, o null. */
function maxDischarge(input: WaterInput, ok: (r: WaterResult) => boolean): number | null {
  for (let q = floorTo(input.dischargeFlow, 10); q >= RANGES.dischargeFlow[0]; q -= 10) {
    if (ok(simulateRiver({ ...input, dischargeFlow: q }))) return q;
  }
  return null;
}

/** Nivel y corrección de cada advertencia de `simulateRiver`, con los mismos umbrales del modelo. */
export function waterConditions(warnings: readonly string[], input: WaterInput): ModelCondition[] {
  const dischargeFix = (ok: (r: WaterResult) => boolean, goal: string) => () => {
    const q = maxDischarge(input, ok);
    return q !== null && q > 0
      ? `Baja el «Caudal del vertimiento» a ${num(q)} L/s o menos, o sube el «Caudal del río»: así ${goal}.`
      : `Sube el «Caudal del río» o baja el «Caudal del vertimiento»: así ${goal}.`;
  };
  return classifyWarnings(warnings, [
    {
      match: 'El oxígeno disuelto se agota', level: 'invalido',
      fix: dischargeFix((r) => !r.anoxic, 'el oxígeno no se agota en ningún punto y el modelo de Streeter–Phelps vuelve a ser válido'),
    },
    {
      match: 'En el punto crítico el oxígeno baja de 4 mg/L', level: 'advertencia',
      fix: dischargeFix((r) => !r.anoxic && r.odMin >= 4, 'el oxígeno mínimo del tramo queda en 4 mg/L o más'),
    },
    {
      match: 'El vertimiento aporta más de la cuarta parte del caudal', level: 'advertencia',
      fix: () => {
        // q_v/(q_r + q_v) ≤ 1/4  →  q_v ≤ q_r/3
        const q = floorTo((input.riverFlow * 1000) / 3, 10);
        return `Baja el «Caudal del vertimiento» a ${num(q)} L/s o menos, o sube el «Caudal del río» a ${num(ceilTo((3 * input.dischargeFlow) / 1000, 0.5), 1)} m³/s o más: así el vertimiento aporta como máximo la cuarta parte del caudal.`;
      },
    },
    {
      match: 'El drenaje bananero real puede llevar plaguicidas', level: 'nota',
      fix: 'No depende de un control: tenlo en cuenta al interpretar el BMWP/Col, porque los macroinvertebrados reales podrían estar peor de lo que calcula el simulador.',
    },
  ]);
}

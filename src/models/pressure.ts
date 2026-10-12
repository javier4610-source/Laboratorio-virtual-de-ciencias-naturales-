import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Presión en líquidos y presión atmosférica (grado 7.º, con rigor de física introductoria).
 *
 * 1. Presión hidrostática: en un líquido en reposo, a la profundidad h bajo la superficie libre,
 *    p = p_atm + ρ·g·h  (presión absoluta)   y   p_man = p − p_atm = ρ·g·h  (presión manométrica).
 *    No depende de la forma del recipiente ni de la cantidad de líquido (paradoja hidrostática, vasos de Pascal)
 *    y, en un punto, actúa igual en todas las direcciones (principio de Pascal para fluidos en reposo).
 * 2. Manómetro en U con agua coloreada: el desnivel entre sus dos ramas mide la presión manométrica en la
 *    membrana de la sonda, Δh = p_man / (ρ_m·g).
 * 3. Chorros de una botella con agujeros (extensión): teorema de Torricelli, v = √(2·g·h) con h la altura de
 *    líquido sobre el agujero; alcance horizontal hasta la bandeja R = 2·C_v·√(h·y).
 * 4. Presión atmosférica contra altitud: atmósfera estándar internacional (ISA, con la temperatura que baja
 *    6,5 °C por kilómetro) o fórmula barométrica isotérmica p = p₀·e^(−z/H), H = R·T/(M·g).
 */

/* ------------------------------------------------------------------ constantes */

/** Gravedad local en Urabá (latitud ≈ 8° N, cerca del nivel del mar), m/s². En el texto se redondea a 9,8. */
export const G = 9.78;
/** Densidad del agua coloreada del manómetro en U a 25 °C, kg/m³. */
export const RHO_MANOMETER = 997;
/** Presión atmosférica estándar al nivel del mar, hPa (= 101 325 Pa). */
export const P0_HPA = 1013.25;
/** Atmósfera estándar internacional (ISA, OACI): temperatura al nivel del mar (K), gradiente térmico (K/m), g₀ (m/s²). */
export const ISA_T0 = 288.15;
export const ISA_LAPSE = 0.0065;
export const G0 = 9.80665;
/** Masa molar del aire seco (kg/mol) y constante de los gases (J/(mol·K)). */
export const M_AIR = 0.0289644;
export const R_UNIVERSAL = 8.3144598;
/** Exponente de la ISA: g₀·M/(R·L) ≈ 5,2559. */
export const ISA_EXPONENT = (G0 * M_AIR) / (R_UNIVERSAL * ISA_LAPSE);
/** Temperatura de la atmósfera isotérmica de comparación (la misma de la ISA al nivel del mar), K. */
export const ISO_T = 288.15;
/** 1 mmHg en pascales (columna de mercurio a 0 °C con g₀). */
export const MMHG_PA = 133.322;
/** Radio de la membrana de la cápsula manométrica, cm. */
export const MEMBRANE_R_CM = 1.5;
/** Coeficiente de velocidad de un orificio de pared delgada (la rapidez real es ≈ 97 % de la de Torricelli). */
export const CV_ORIFICE = 0.97;
/** Resoluciones: regla del manómetro (mm), barómetro digital (hPa), cinta de la bandeja (cm). */
export const MANOMETER_RES = 1;
export const BAROMETER_RES = 0.1;
export const TAPE_RES = 0.5;

export const PRESSURE_LIMITS = {
  depth: [0, 30] as [number, number], // cm bajo la superficie (tanque con 32 cm de líquido)
  orientation: [0, 180] as [number, number], // ° hacia donde mira la membrana: 0 arriba, 90 de lado, 180 abajo
  liquidHeight: [2, 25] as [number, number], // cm de líquido sobre la membrana del fondo (vasos de Pascal)
  waterLevel: [10, 28] as [number, number], // cm de agua en la botella sobre la bandeja
  altitude: [0, 5000] as [number, number], // m sobre el nivel del mar
};

/** Profundidad del líquido en el tanque (cm). */
export const TANK_DEPTH_CM = 32;

/* ------------------------------------------------------------------ catálogos */

export type LiquidId = 'dulce' | 'salada' | 'aceite' | 'alcohol' | 'glicerina';

export interface LiquidInfo {
  id: LiquidId;
  name: string;
  short: string;
  /** Densidad a 25 °C, kg/m³. */
  rho: number;
  /** Color y opacidad del líquido para el dibujo. */
  color: string;
  opacity: number;
}

/** Densidades a 25 °C (CRC Handbook; agua de mar con salinidad 35 g/kg; aceite de cocina típico). */
export const LIQUIDS: LiquidInfo[] = [
  { id: 'dulce', name: 'Agua dulce', short: 'agua dulce', rho: 997, color: '#5aa9de', opacity: 0.42 },
  { id: 'salada', name: 'Agua salada (de mar)', short: 'agua salada', rho: 1023, color: '#3f9fa8', opacity: 0.48 },
  { id: 'aceite', name: 'Aceite de cocina', short: 'aceite', rho: 918, color: '#e0b12e', opacity: 0.6 },
  { id: 'alcohol', name: 'Alcohol etílico', short: 'alcohol', rho: 785, color: '#a9c9dc', opacity: 0.32 },
  { id: 'glicerina', name: 'Glicerina', short: 'glicerina', rho: 1258, color: '#c9cfa6', opacity: 0.5 },
];

export type PlaceId = 'apartado' | 'santafe' | 'medellin' | 'manizales' | 'bogota';

export interface PlaceInfo { id: PlaceId; name: string; /** Altitud aproximada del casco urbano, m. */ altitude: number; }

/** Altitudes aproximadas de los cascos urbanos (redondeadas). */
export const PLACES: PlaceInfo[] = [
  { id: 'apartado', name: 'Apartadó', altitude: 30 },
  { id: 'santafe', name: 'Santa Fe de Antioquia', altitude: 550 },
  { id: 'medellin', name: 'Medellín', altitude: 1495 },
  { id: 'manizales', name: 'Manizales', altitude: 2150 },
  { id: 'bogota', name: 'Bogotá', altitude: 2640 },
];

export type AtmosphereModel = 'estandar' | 'isoterma';

export type VesselId = 'cilindro' | 'ancho' | 'estrecho' | 'inclinado';

export interface VesselInfo {
  id: VesselId;
  name: string;
  short: string;
  /** Perfil del vaso: radio interior r (cm) a la altura z (cm) sobre la membrana del fondo; tramos rectos. */
  profile: [number, number][];
  /** Inclinación del eje (desplazamiento horizontal por cm de altura); 0 si es vertical. */
  shear: number;
}

/** Vasos de Pascal: todos con la misma base circular de 3 cm de radio y 26 cm de alto. */
export const VESSELS: VesselInfo[] = [
  { id: 'cilindro', name: 'Vaso cilíndrico', short: 'Cilíndrico', profile: [[0, 3], [26, 3]], shear: 0 },
  { id: 'ancho', name: 'Vaso cónico que se ensancha', short: 'Ensanchado', profile: [[0, 3], [26, 11.3]], shear: 0 },
  { id: 'estrecho', name: 'Vaso que se estrecha en un tubo', short: 'Estrecho', profile: [[0, 3], [6, 3], [12, 0.8], [26, 0.8]], shear: 0 },
  { id: 'inclinado', name: 'Vaso inclinado', short: 'Inclinado', profile: [[0, 3], [26, 3]], shear: 0.45 },
];

/** Alturas de los agujeros de la botella sobre la bandeja, cm. */
export const HOLE_HEIGHTS = [5, 10, 15, 20] as const;

export function findLiquid(id: string): LiquidInfo {
  const l = LIQUIDS.find((x) => x.id === id);
  if (!l) throw new Error(`Líquido desconocido: ${id}`);
  return l;
}
export function findPlace(id: string): PlaceInfo {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`Lugar desconocido: ${id}`);
  return p;
}
export function findVessel(id: string): VesselInfo {
  const v = VESSELS.find((x) => x.id === id);
  if (!v) throw new Error(`Vaso desconocido: ${id}`);
  return v;
}

/* ------------------------------------------------------------------ presión hidrostática */

/** Presión manométrica (Pa) a la profundidad h (m) en un líquido de densidad ρ (kg/m³): ρ·g·h. */
export function hydrostaticGauge(rho: number, depthM: number, g = G): number {
  if (!(rho > 0)) throw new RangeError('La densidad debe ser positiva.');
  if (!Number.isFinite(depthM) || depthM < 0) throw new RangeError('La profundidad no puede ser negativa.');
  return rho * g * depthM;
}

/** Presión absoluta (Pa) = presión atmosférica (Pa) + ρ·g·h. */
export function absolutePressure(pAtmPa: number, rho: number, depthM: number, g = G): number {
  if (!(pAtmPa >= 0)) throw new RangeError('La presión atmosférica no puede ser negativa.');
  return pAtmPa + hydrostaticGauge(rho, depthM, g);
}

/**
 * Presión manométrica media (Pa) sobre la membrana circular de la cápsula, cuyo centro está a la profundidad
 * `depthCm` y cuya cara mira en la dirección `orientationDeg` (0° arriba, 90° de lado, 180° abajo).
 * Se integra numéricamente sobre el disco; los puntos que quedan fuera del líquido tienen presión manométrica 0.
 * Si toda la membrana está sumergida, el promedio de un campo lineal sobre un disco es el valor en el centro:
 * la lectura no depende de la orientación.
 */
export function membraneGauge(rho: number, depthCm: number, orientationDeg: number, radiusCm = MEMBRANE_R_CM, g = G): number {
  if (!(rho > 0)) throw new RangeError('La densidad debe ser positiva.');
  if (!Number.isFinite(depthCm) || !Number.isFinite(orientationDeg)) throw new RangeError('Profundidad u orientación no válidas.');
  // Desplazamiento vertical máximo de un punto del borde respecto al centro: r·|sen θ|.
  const tilt = Math.abs(Math.sin((orientationDeg * Math.PI) / 180));
  if (depthCm - radiusCm * tilt >= 0) return rho * g * (depthCm / 100);
  const rings = 40, sectors = 72;
  let sum = 0, area = 0;
  for (let i = 0; i < rings; i++) {
    const r = ((i + 0.5) / rings) * radiusCm;
    const dA = r; // peso del anillo ∝ r·dr·dφ
    for (let j = 0; j < sectors; j++) {
      const phi = ((j + 0.5) / sectors) * 2 * Math.PI;
      const d = depthCm + r * Math.cos(phi) * tilt;
      sum += Math.max(0, d) * dA;
      area += dA;
    }
  }
  return rho * g * (sum / area / 100);
}

/** Desnivel (m) del manómetro en U para una presión manométrica (Pa): Δh = p / (ρ_m·g). */
export function manometerRise(gaugePa: number, rhoM = RHO_MANOMETER, g = G): number {
  if (!(rhoM > 0)) throw new RangeError('La densidad del líquido del manómetro debe ser positiva.');
  return gaugePa / (rhoM * g);
}

/** Presión manométrica (Pa) a partir del desnivel (m) leído en el manómetro en U. */
export function gaugeFromManometer(riseM: number, rhoM = RHO_MANOMETER, g = G): number {
  return rhoM * g * riseM;
}

/** Lectura de la regla del manómetro (mm, resolución 1 mm). */
export const manometerReading = (riseMm: number) => {
  const r = roundToResolution(riseMm, MANOMETER_RES);
  return Object.is(r, -0) ? 0 : r;
};

/* ------------------------------------------------------------------ manómetro en U: respuesta dinámica */

/**
 * Frecuencia angular natural (rad/s) de la columna de un manómetro en U de longitud total L (m):
 * ω = √(2g/L). Una columna de 0,5 m oscila con período ≈ 1 s.
 */
export function uTubeOmega(columnM: number, g = G): number {
  if (!(columnM > 0)) throw new RangeError('La longitud de la columna debe ser positiva.');
  return Math.sqrt((2 * g) / columnM);
}

/**
 * Desnivel (misma unidad que x0 y target) t segundos después de un cambio brusco de presión: oscilación
 * amortiguada alrededor del nuevo valor (razón de amortiguamiento ζ < 1, por la viscosidad y el aire de la manguera).
 */
export function uTubeResponse(x0: number, target: number, t: number, columnM: number, zeta = 0.18, g = G): number {
  const w = uTubeOmega(columnM, g);
  const z = Math.max(0, Math.min(0.99, zeta));
  const wd = w * Math.sqrt(1 - z * z);
  const tt = Math.max(0, t);
  return target + (x0 - target) * Math.exp(-z * w * tt) * (Math.cos(wd * tt) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * tt));
}

/* ------------------------------------------------------------------ presión atmosférica */

/** Presión atmosférica (hPa) a la altitud z (m) según la atmósfera estándar internacional (troposfera, z < 11 km). */
export function atmosphereISA(altitudeM: number, p0 = P0_HPA): number {
  assertInRange('La altitud', altitudeM, -500, 11000);
  return p0 * Math.pow(1 - (ISA_LAPSE * altitudeM) / ISA_T0, ISA_EXPONENT);
}

/** Altura de escala (m) de una atmósfera isotérmica: H = R·T/(M·g). Con 15 °C, H ≈ 8,43 km. */
export function scaleHeight(T = ISO_T): number {
  if (!(T > 0)) throw new RangeError('La temperatura absoluta debe ser positiva.');
  return (R_UNIVERSAL * T) / (M_AIR * G0);
}

/** Presión atmosférica (hPa) con la fórmula barométrica isotérmica: p = p₀·e^(−z/H). */
export function atmosphereIsothermal(altitudeM: number, T = ISO_T, p0 = P0_HPA): number {
  assertInRange('La altitud', altitudeM, -500, 11000);
  return p0 * Math.exp(-altitudeM / scaleHeight(T));
}

export function atmosphere(model: AtmosphereModel, altitudeM: number): number {
  if (model === 'estandar') return atmosphereISA(altitudeM);
  if (model === 'isoterma') return atmosphereIsothermal(altitudeM);
  throw new Error(`Modelo de atmósfera desconocido: ${model}`);
}

/** Lectura del barómetro digital (hPa, resolución 0,1 hPa). */
export const barometerReading = (pHpa: number) => roundToResolution(pHpa, BAROMETER_RES);

/** Altura (mm) de una columna de mercurio que equilibra la presión dada (barómetro de Torricelli). */
export const mercuryColumnMm = (pHpa: number) => (pHpa * 100) / MMHG_PA;

/** Altura (m) de una columna de agua dulce que equilibra la presión dada: p / (ρ·g). */
export const waterColumnM = (pHpa: number, rho = 997, g = G) => (pHpa * 100) / (rho * g);

/* ------------------------------------------------------------------ vasos de Pascal */

/** Área de la base de los vasos (cm²): círculo de 3 cm de radio. */
export function baseAreaCm2(v: VesselInfo = VESSELS[0]): number {
  return Math.PI * v.profile[0][1] ** 2;
}

/** Radio interior (cm) del vaso a la altura z (cm) sobre la base. */
export function vesselRadius(v: VesselInfo, z: number): number {
  const p = v.profile;
  if (z <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    const [z0, r0] = p[i - 1], [z1, r1] = p[i];
    if (z <= z1) return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
  }
  return p[p.length - 1][1];
}

/**
 * Volumen (cm³ = mL) de líquido en el vaso hasta la altura h (cm): suma exacta de troncos de cono,
 * V = π·Δz·(r₀² + r₀·r₁ + r₁²)/3 en cada tramo. En el vaso inclinado cada sección horizontal es el mismo
 * círculo desplazado (principio de Cavalieri), así que su volumen es el del cilindro.
 */
export function vesselVolume(v: VesselInfo, h: number): number {
  if (!(h >= 0)) throw new RangeError('La altura del líquido no puede ser negativa.');
  const pts: [number, number][] = [];
  for (const [z, r] of v.profile) if (z < h) pts.push([z, r]);
  pts.push([h, vesselRadius(v, h)]);
  let vol = 0;
  for (let i = 1; i < pts.length; i++) {
    const [z0, r0] = pts[i - 1], [z1, r1] = pts[i];
    vol += (Math.PI * (z1 - z0) * (r0 * r0 + r0 * r1 + r1 * r1)) / 3;
  }
  return vol;
}

export interface PascalResult {
  /** Presión manométrica en la membrana del fondo, Pa. */
  gauge: number;
  /** Volumen (mL) y peso (N) del líquido. */
  volume: number;
  weight: number;
  /** Fuerza del líquido sobre la base, N: p_man·A. */
  baseForce: number;
  /** Peso / fuerza sobre la base: 1 en el cilindro, > 1 si el vaso se ensancha, < 1 si se estrecha. */
  ratio: number;
}

/** Vaso de Pascal lleno hasta la altura h (cm) con un líquido de densidad ρ. */
export function pascalVessel(vesselId: VesselId, rho: number, heightCm: number, g = G): PascalResult {
  assertInRange('La altura del líquido', heightCm, ...PRESSURE_LIMITS.liquidHeight);
  const v = findVessel(vesselId);
  const gauge = hydrostaticGauge(rho, heightCm / 100, g);
  const volume = vesselVolume(v, heightCm);
  const weight = rho * (volume * 1e-6) * g;
  const baseForce = gauge * baseAreaCm2(v) * 1e-4;
  return { gauge, volume, weight, baseForce, ratio: weight / baseForce };
}

/* ------------------------------------------------------------------ chorros (Torricelli) */

/** Rapidez ideal de salida (m/s) por un agujero a h metros bajo la superficie: v = √(2·g·h). */
export function torricelliSpeed(headM: number, g = G): number {
  if (!(headM >= 0)) throw new RangeError('La altura de líquido sobre el agujero no puede ser negativa.');
  return Math.sqrt(2 * g * headM);
}

export interface JetResult {
  /** Altura del agujero sobre la bandeja y altura de agua sobre el agujero (cm). */
  holeCm: number; headCm: number;
  /** ¿Sale agua? (el agujero está bajo la superficie). */
  flows: boolean;
  /** Rapidez ideal de Torricelli y rapidez real (C_v·v), m/s. */
  vIdeal: number; v: number;
  /** Tiempo de caída hasta la bandeja, s. */
  tFall: number;
  /** Alcance horizontal real e ideal sobre la bandeja, cm. */
  range: number; rangeIdeal: number;
}

/**
 * Chorro horizontal por un agujero de pared delgada a `holeCm` sobre la bandeja, con el agua a `levelCm`
 * (nivel constante: la botella se rellena desde la llave). Alcance R = v·t = 2·C_v·√(h·y): no depende de g
 * ni de la densidad del líquido.
 */
export function jet(holeCm: number, levelCm: number, cv = CV_ORIFICE, g = G): JetResult {
  assertInRange('La altura del agujero', holeCm, 0, 40);
  assertInRange('El nivel del agua', levelCm, ...PRESSURE_LIMITS.waterLevel);
  const headCm = Math.max(0, levelCm - holeCm);
  const flows = headCm > 0;
  const vIdeal = torricelliSpeed(headCm / 100, g);
  const v = cv * vIdeal;
  const tFall = Math.sqrt((2 * holeCm) / 100 / g);
  return { holeCm, headCm, flows, vIdeal, v, tFall, range: flows ? v * tFall * 100 : 0, rangeIdeal: flows ? vIdeal * tFall * 100 : 0 };
}

/** Rapidez de salida (m/s) calculada a partir del alcance medido (cm) y la altura del agujero (cm): v = R / √(2y/g). */
export function speedFromRange(rangeCm: number, holeCm: number, g = G): number {
  if (!(holeCm > 0)) throw new RangeError('El agujero debe estar por encima de la bandeja.');
  return rangeCm / 100 / Math.sqrt((2 * holeCm) / 100 / g);
}

/** Lectura de la cinta de la bandeja (cm, resolución 0,5 cm). */
export const tapeReading = (cm: number) => roundToResolution(cm, TAPE_RES);

/* ------------------------------------------------------------------ simulación de la sonda */

export interface ProbeInput {
  liquid: LiquidId;
  /** Profundidad del centro de la membrana bajo la superficie, cm. */
  depthCm: number;
  /** Hacia dónde mira la membrana: 0° arriba, 90° de lado, 180° abajo. */
  orientationDeg: number;
  /** Altitud del lugar, m. */
  altitudeM: number;
  atmosphere: AtmosphereModel;
}

export interface ProbeResult {
  rho: number;
  /** Presión manométrica en la membrana, Pa (valor verdadero del modelo). */
  gauge: number;
  /** Desnivel verdadero del manómetro, mm. */
  riseMm: number;
  /** Presión atmosférica del lugar y presión absoluta en la membrana, hPa. */
  pAtm: number;
  pAbs: number;
}

export function simulateProbe(input: ProbeInput): ProbeResult {
  assertInRange('La profundidad de la sonda', input.depthCm, ...PRESSURE_LIMITS.depth);
  assertInRange('La orientación de la membrana', input.orientationDeg, ...PRESSURE_LIMITS.orientation);
  assertInRange('La altitud', input.altitudeM, ...PRESSURE_LIMITS.altitude);
  const rho = findLiquid(input.liquid).rho;
  const gauge = membraneGauge(rho, input.depthCm, input.orientationDeg);
  const pAtm = atmosphere(input.atmosphere, input.altitudeM);
  return { rho, gauge, riseMm: manometerRise(gauge) * 1000, pAtm, pAbs: pAtm + gauge / 100 };
}

/** Cálculos del estudiante con sus lecturas: presión manométrica (Pa) desde el desnivel (mm) y absoluta (hPa). */
export function analyzeManometer(riseReadingMm: number, pAtmReadingHpa: number): { gauge: number; pAbs: number } {
  const gauge = gaugeFromManometer(riseReadingMm / 1000);
  return { gauge, pAbs: pAtmReadingHpa + gauge / 100 };
}

/** Fichas de los instrumentos (misma forma que src/labs/instruments.ts), usadas como respaldo. */
export const PRESSURE_INSTRUMENTS = [
  { id: 'manometro', name: 'Manómetro en U con agua coloreada y regla milimétrica', quantity: 'Desnivel entre las ramas', unit: 'mm', resolution: MANOMETER_RES, sigma: 1, note: 'Paralaje al leer los dos meniscos, capilaridad en el tubo y pequeñas burbujas en la manguera.' },
  { id: 'barometro', name: 'Barómetro digital (300 a 1100 hPa)', quantity: 'Presión atmosférica', unit: 'hPa', resolution: BAROMETER_RES, sigma: 0.3, note: 'Exactitud del sensor y variación de la presión durante el día (marea atmosférica de ± 1 a 2 hPa en el trópico).' },
  { id: 'cinta', name: 'Cinta métrica sobre la bandeja', quantity: 'Alcance del chorro', unit: 'cm', resolution: TAPE_RES, sigma: 0.4, note: 'El chorro se abre al caer y salpica: el punto de impacto tiene un ancho de casi 1 cm.' },
];

export const pressureModelSpec: ModelSpec = {
  name: 'Presión hidrostática (p = p_atm + ρ·g·h), manómetro en U, vasos de Pascal, chorros de Torricelli y presión atmosférica contra altitud',
  inputs: [
    { symbol: 'líquido', name: 'Líquido del tanque o del vaso (agua dulce, agua salada, aceite, alcohol, glicerina)', unit: '—', initial: 'agua dulce' },
    { symbol: 'h', name: 'Profundidad del centro de la membrana bajo la superficie', unit: 'cm', range: PRESSURE_LIMITS.depth, initial: 10 },
    { symbol: 'θ', name: 'Orientación de la membrana (0° arriba, 90° de lado, 180° abajo)', unit: '°', range: PRESSURE_LIMITS.orientation, initial: 90 },
    { symbol: 'vaso', name: 'Vaso de Pascal (cilíndrico, ensanchado, estrecho, inclinado), todos con la misma base', unit: '—', initial: 'cilíndrico' },
    { symbol: 'h_vaso', name: 'Altura del líquido sobre la membrana del fondo del vaso de Pascal', unit: 'cm', range: PRESSURE_LIMITS.liquidHeight, initial: 20 },
    { symbol: 'H', name: 'Nivel del agua en la botella con agujeros (sobre la bandeja)', unit: 'cm', range: PRESSURE_LIMITS.waterLevel, initial: 25 },
    { symbol: 'y', name: 'Agujeros abiertos en la botella: 5, 10, 15 y 20 cm sobre la bandeja', unit: 'cm', initial: 'los cuatro' },
    { symbol: 'z', name: 'Altitud del lugar (Apartadó 30 m, Santa Fe de Antioquia 550 m, Medellín 1495 m, Manizales 2150 m, Bogotá 2640 m)', unit: 'm', range: PRESSURE_LIMITS.altitude, initial: 30 },
    { symbol: 'modelo', name: 'Modelo de la atmósfera: estándar internacional (ISA) o isotérmica a 15 °C', unit: '—', initial: 'ISA' },
  ],
  outputs: [
    { symbol: 'Δh', name: 'Desnivel del manómetro en U (agua coloreada), leído con regla de 1 mm', unit: 'mm' },
    { symbol: 'p_man', name: 'Presión manométrica en la membrana, ρ_m·g·Δh', unit: 'Pa' },
    { symbol: 'p_atm', name: 'Presión atmosférica del lugar (barómetro digital, 0,1 hPa)', unit: 'hPa' },
    { symbol: 'p_abs', name: 'Presión absoluta en la membrana, p_atm + p_man', unit: 'hPa' },
    { symbol: 'V, P, F', name: 'Vasos de Pascal: volumen y peso del líquido, y fuerza del líquido sobre la base', unit: 'mL, N' },
    { symbol: 'R', name: 'Alcance de cada chorro sobre la bandeja (cinta, 0,5 cm) y rapidez de salida calculada', unit: 'cm, m/s' },
  ],
  equations: [
    'p = p_atm + ρ·g·h   (presión absoluta);   p_man = p − p_atm = ρ·g·h   (presión manométrica)',
    'Manómetro en U: p_man = ρ_m·g·Δh  →  Δh = (ρ/ρ_m)·h   (en agua dulce, el desnivel es igual a la profundidad)',
    'Membrana circular sumergida: presión media = presión en su centro, para cualquier orientación',
    'Vasos de Pascal: F_base = p_man·A = ρ·g·h·A (igual en todos);  peso del líquido P = ρ·V·g (distinto en cada vaso)',
    'Torricelli: v = √(2·g·h);  caída t = √(2y/g);  alcance R = C_v·v·t = 2·C_v·√(h·y),  C_v = 0,97',
    'Atmósfera estándar (ISA): p = 1013,25 hPa · (1 − 0,0065·z/288,15)^5,2559',
    'Atmósfera isotérmica: p = 1013,25 hPa · e^(−z/H),  H = R·T/(M·g) ≈ 8,43 km a 15 °C',
    '1 hPa = 100 Pa;  1 mmHg = 133,322 Pa;  1013,25 hPa = 760 mmHg ≈ 10,4 m de agua',
  ],
  initialConditions: [
    'Tanque de vidrio con 32 cm de agua dulce (997 kg/m³ a 25 °C); sonda a 10 cm de profundidad con la membrana mirando de lado.',
    'Manómetro en U con agua coloreada, con las dos ramas al mismo nivel cuando la membrana está en el aire.',
    'Apartadó (≈ 30 m de altitud), atmósfera estándar internacional; g = 9,78 m/s².',
    'Vasos de Pascal con 20 cm de agua dulce sobre la membrana; botella con agua a 25 cm sobre la bandeja y los cuatro agujeros abiertos.',
  ],
  assumptions: [
    'Líquidos en reposo, incompresibles y de densidad uniforme a 25 °C (agua dulce 997; agua de mar 1023; aceite 918; alcohol etílico 785; glicerina 1258 kg/m³).',
    'g = 9,78 m/s², la gravedad de Urabá (latitud ≈ 8° N); en los cálculos a mano se puede usar 9,8 m/s² (diferencia de 0,2 %). Se usa el mismo valor en Medellín y Bogotá (la diferencia por altitud es menor que 0,1 %).',
    'La membrana de la cápsula es flexible y no ofrece resistencia: el aire de la manguera transmite al manómetro la presión media sobre la membrana; la profundidad es la de su centro (la cápsula gira sobre ese punto).',
    'El aire de la manguera se comprime un poco, pero la membrana se abomba lo necesario sin cambiar la profundidad de su centro; la capilaridad del tubo de vidrio se desprecia.',
    'Chorros: botella de pared delgada con nivel constante (se rellena desde la llave), agujeros pequeños y redondos, coeficiente de velocidad C_v = 0,97 (rozamiento en el borde del orificio); se desprecia la resistencia del aire sobre el chorro.',
    'Atmósfera seca en reposo: estándar internacional (15 °C al nivel del mar y −6,5 °C por km) o isotérmica a 15 °C; presión al nivel del mar 1013,25 hPa. Son atmósferas de referencia, no el estado del tiempo de un día concreto.',
  ],
  limits: [
    'La atmósfera tropical es más cálida que la estándar: las presiones medias reales en los Andes colombianos son 1 a 3 % mayores que las de la ISA (en Bogotá se miden ≈ 750 hPa, ≈ 560 mmHg, frente a 734 hPa de la ISA). Además, la presión cambia durante el día (± 1 a 2 hPa) y con el tiempo atmosférico.',
    'Muy cerca de la superficie (profundidad menor que el radio de la membrana, 1,5 cm) parte de la membrana queda fuera del líquido y la lectura sí cambia con la orientación; el modelo lo calcula integrando sobre la membrana.',
    'Una membrana real tiene algo de rigidez: los manómetros escolares marcan unos milímetros menos que ρ·g·h, sobre todo a poca profundidad.',
    'Torricelli no vale para líquidos muy viscosos (glicerina, miel) ni para agujeros muy pequeños: por eso la botella solo tiene agua. Con la botella vaciándose (sin rellenar), el nivel baja y los chorros se acortan con el tiempo.',
    'Las densidades cambian con la temperatura (el agua a 4 °C tiene 1000 kg/m³; a 28 °C, 996 kg/m³) y con lo disuelto (el agua del golfo de Urabá cerca de la desembocadura del río Atrato es menos salada que la de mar abierto).',
    'La fórmula ISA usada vale en la troposfera (hasta ≈ 11 km); el laboratorio limita la altitud a 5000 m.',
  ],
  testCases: [
    'ρ·g·h a mano: agua dulce a 10 cm → 997 · 9,78 · 0,10 = 975,1 Pa; glicerina a 20 cm → 2460,6 Pa; la presión crece linealmente con la profundidad y con la densidad.',
    'En agua dulce el desnivel del manómetro de agua es igual a la profundidad (100 mm a 10 cm); en glicerina es 1258/997 veces mayor.',
    'La presión media sobre la membrana no depende de la orientación cuando está sumergida (0°, 45°, 90°, 180° dan lo mismo) y sí cambia si la membrana corta la superficie.',
    'Los cuatro vasos de Pascal con la misma altura tienen igual presión y fuerza en la base, aunque el volumen y el peso del líquido sean distintos (cilindro: peso = fuerza).',
    'Volumen del cono truncado comparado con la fórmula π·h·(r₀² + r₀r₁ + r₁²)/3 y con una integración numérica.',
    'Torricelli: v = √(2·9,78·0,20) = 1,978 m/s; alcances simétricos (agujeros a 5 y 20 cm con nivel de 25 cm alcanzan lo mismo) y máximo con el agujero a la mitad del nivel.',
    'ISA: 1013,25 hPa al nivel del mar; ≈ 1009,7 hPa en Apartadó, ≈ 846 hPa en Medellín y ≈ 734 hPa en Bogotá; la isotérmica da valores un poco mayores en altura; 1013,25 hPa = 760 mmHg.',
    'La oscilación del manómetro en U tiene período 2π·√(L/2g) y se amortigua hacia el desnivel final.',
    'Las entradas fuera de rango se rechazan.',
  ],
};

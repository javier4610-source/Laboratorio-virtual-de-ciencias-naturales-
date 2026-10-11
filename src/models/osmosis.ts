import { assertInRange, celsiusToKelvin, R_GAS, rk4Step } from './math';
import type { ModelSpec } from './types';

/**
 * Modelo de ósmosis en células (grado 7.º).
 *
 * Volumen celular relativo V (V₀ = 1) = b + W, donde b es la fracción no osmótica
 * (proteínas, organelos) y W el agua osmóticamente activa (relación de Boyle-van 't Hoff).
 * El soluto interno es impermeable: n = C_in,0 · W₀.
 *
 *   dW/dt = k(T) · ( n/W − C_ext − P/(R·T) )
 *
 * con C en osmol/L y P la presión de turgencia (solo en la célula vegetal, por la pared celular).
 */

export type CellType = 'animal' | 'vegetal';

export const MOLAR_MASS_NACL = 58.44; // g/mol
export const NACL_VANT_HOFF = 2; // ideal: NaCl → Na⁺ + Cl⁻
export const NONOSMOTIC_FRACTION = 0.4; // b
export const CIN0 = 0.3; // Osm/L, osmolaridad interna inicial típica de células animales
export const LYSIS_VOLUME = 1.55; // volumen relativo al que se rompe la membrana del glóbulo rojo (simplificado)
export const WALL_ELASTIC_MODULUS_KPA = 5000; // ε, módulo elástico volumétrico de la pared (5 MPa)
export const K_REF = 0.13; // tasa de flujo de agua a 25 °C, (unidad de volumen relativo)/(Osm/L · s) — escala ilustrativa
export const EA_WATER = 20000;
/** Cambio de volumen relativo por debajo del cual se considera que no hay flujo neto apreciable. */
export const VOLUME_TOLERANCE = 0.02; // J/mol, energía de activación típica del transporte por acuaporinas

export const OSMOSIS_LIMITS = {
  naclPercent: [0, 3] as [number, number],
  temperature: [5, 40] as [number, number],
  duration: [10, 180] as [number, number],
};

/** Osmolaridad ideal (Osm/L) de una solución de NaCl expresada en % m/v. */
export function naclOsmolarity(percentMV: number): number {
  const gramsPerLiter = percentMV * 10;
  return (gramsPerLiter / MOLAR_MASS_NACL) * NACL_VANT_HOFF;
}

/** Presión osmótica de van 't Hoff, π = C·R·T, en kPa (C en Osm/L). */
export function osmoticPressureKPa(osmPerL: number, tempC: number): number {
  return osmPerL * R_GAS * celsiusToKelvin(tempC); // (mol/L)(J/mol·K)(K) = kJ/m³ = kPa
}

export function waterRateConstant(tempC: number): number {
  const T = celsiusToKelvin(tempC);
  const Tref = celsiusToKelvin(25);
  return K_REF * Math.exp((-EA_WATER / R_GAS) * (1 / T - 1 / Tref));
}

function turgorKPa(type: CellType, V: number): number {
  if (type !== 'vegetal' || V <= 1) return 0;
  return WALL_ELASTIC_MODULUS_KPA * (V - 1);
}

export interface OsmosisInput {
  cellType: CellType;
  naclPercent: number;
  temperature: number; // °C
  duration: number; // s
}

export interface OsmosisPoint {
  t: number; // s
  volume: number; // relativo
  changePercent: number; // %
  turgor: number; // kPa
}

export type CellState = 'isotónica' | 'turgente' | 'hinchada' | 'lisis' | 'crenada' | 'plasmólisis' | 'normal';

export interface OsmosisResult {
  externalOsm: number;
  internalOsm0: number;
  tonicity: 'hipotónica' | 'isotónica' | 'hipertónica';
  series: OsmosisPoint[];
  finalVolume: number;
  finalChangePercent: number;
  lysedAt: number | null;
  state: CellState;
  waterDirection: 'entra' | 'sale' | 'sin flujo neto';
  equilibriumVolume: number;
  externalPressureKPa: number;
  internalPressureKPa: number;
}

/** Volumen de equilibrio analítico (sin límite de lisis), útil para pruebas y explicación. */
export function equilibriumVolume(cellType: CellType, externalOsm: number, tempC = 25): number {
  const b = NONOSMOTIC_FRACTION;
  const n = CIN0 * (1 - b);
  if (cellType === 'animal') {
    if (externalOsm <= 0) return Infinity;
    return b + n / externalOsm;
  }
  // Vegetal: resolver n/W − C_ext − ε(V−1)/(RT) = 0 por bisección.
  const RT = R_GAS * celsiusToKelvin(tempC);
  const g = (V: number) => n / (V - b) - externalOsm - turgorKPa('vegetal', V) / RT;
  let lo = b + 1e-6, hi = 3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function simulateOsmosis(input: OsmosisInput): OsmosisResult {
  assertInRange('La concentración de NaCl', input.naclPercent, ...OSMOSIS_LIMITS.naclPercent);
  assertInRange('La temperatura', input.temperature, ...OSMOSIS_LIMITS.temperature);
  assertInRange('El tiempo de observación', input.duration, ...OSMOSIS_LIMITS.duration);

  const b = NONOSMOTIC_FRACTION;
  const n = CIN0 * (1 - b);
  const cext = naclOsmolarity(input.naclPercent);
  const k = waterRateConstant(input.temperature);
  const RT = R_GAS * celsiusToKelvin(input.temperature);

  const dWdt = (_t: number, W: number) => k * (n / W - cext - turgorKPa(input.cellType, W + b) / RT);

  const dt = 0.05;
  const series: OsmosisPoint[] = [{ t: 0, volume: 1, changePercent: 0, turgor: 0 }];
  let W = 1 - b;
  let lysedAt: number | null = null;
  const steps = Math.round(input.duration / dt);
  for (let i = 1; i <= steps; i++) {
    W = rk4Step(dWdt, (i - 1) * dt, W, dt);
    const V = W + b;
    const t = i * dt;
    if (input.cellType === 'animal' && V >= LYSIS_VOLUME) {
      lysedAt = Math.round(t * 10) / 10;
      series.push({ t, volume: V, changePercent: (V - 1) * 100, turgor: 0 });
      break;
    }
    if (i % 20 === 0) series.push({ t, volume: V, changePercent: (V - 1) * 100, turgor: turgorKPa(input.cellType, V) });
  }

  const finalVolume = series[series.length - 1].volume;
  // Tolerancia común (2 % de volumen) para que tonicidad, dirección del agua y estado sean coherentes entre sí.
  const tol = VOLUME_TOLERANCE;
  const tonicity = Math.abs(equilibriumVolume(input.cellType, cext, input.temperature) - 1) < tol ? 'isotónica' : cext < CIN0 ? 'hipotónica' : 'hipertónica';
  // La dirección del flujo neto la determina el gradiente osmótico (no la duración de la observación).
  const waterDirection = tonicity === 'isotónica' ? 'sin flujo neto' : tonicity === 'hipotónica' ? 'entra' : 'sale';

  let state: CellState;
  if (lysedAt !== null) state = 'lisis';
  else if (Math.abs(finalVolume - 1) < tol) state = input.cellType === 'vegetal' ? 'normal' : 'isotónica';
  else if (finalVolume > 1) state = input.cellType === 'vegetal' ? 'turgente' : 'hinchada';
  else state = input.cellType === 'vegetal' ? 'plasmólisis' : 'crenada';

  return {
    externalOsm: cext,
    internalOsm0: CIN0,
    tonicity,
    series,
    finalVolume,
    finalChangePercent: (finalVolume - 1) * 100,
    lysedAt,
    state,
    waterDirection,
    equilibriumVolume: equilibriumVolume(input.cellType, cext, input.temperature),
    externalPressureKPa: osmoticPressureKPa(cext, input.temperature),
    internalPressureKPa: osmoticPressureKPa(CIN0, input.temperature),
  };
}

/* ------------------------------------------------------------------ */
/* Difusión a través de una membrana (bolsa de diálisis)              */
/* ------------------------------------------------------------------ */

export const BAG_VOLUME_ML = 20;
export const BEAKER_VOLUME_ML = 200;

export interface Solute {
  id: 'glucosa' | 'yodo' | 'almidon';
  name: string;
  /** Coeficiente de difusión en agua a 25 °C (m²/s); valores aproximados de la literatura. */
  d25: number;
  crossesMembrane: boolean;
  startsInside: boolean;
}

export const SOLUTES: Solute[] = [
  { id: 'glucosa', name: 'Glucosa', d25: 6.7e-10, crossesMembrane: true, startsInside: true },
  { id: 'yodo', name: 'Yodo (lugol)', d25: 1.1e-9, crossesMembrane: true, startsInside: false },
  { id: 'almidon', name: 'Almidón', d25: 1e-11, crossesMembrane: false, startsInside: true },
];

/** Viscosidad del agua (Pa·s), ecuación de Vogel: η = A·10^(B/(T−C)). */
export function waterViscosity(tempC: number): number {
  const T = celsiusToKelvin(tempC);
  return 2.414e-5 * 10 ** (247.8 / (T - 140));
}

/** Coeficiente de difusión corregido por temperatura (Stokes-Einstein): D ∝ T/η. */
export function diffusionCoefficient(d25: number, tempC: number): number {
  const T = celsiusToKelvin(tempC);
  const T25 = celsiusToKelvin(25);
  return d25 * (T / T25) * (waterViscosity(25) / waterViscosity(tempC));
}

/** Espesor efectivo de la membrana (m), elegido para que la glucosa alcance la mitad del equilibrio en ~10 min a 25 °C y 10 cm². */
export const MEMBRANE_EFFECTIVE_THICKNESS = 3.2e-5;

export const DIFFUSION_LIMITS = {
  temperature: [5, 60] as [number, number],
  area: [2, 20] as [number, number], // cm²
  glucose: [0, 50] as [number, number], // g/L dentro de la bolsa
  iodine: [0, 2] as [number, number], // g/L fuera
  duration: [1, 60] as [number, number], // min
};

export interface DiffusionInput {
  temperature: number;
  area: number; // cm²
  glucoseInside0: number; // g/L
  iodineOutside0: number; // g/L
  starchInside: boolean;
  duration: number; // min
}

export interface DiffusionPoint {
  t: number; // min
  glucoseIn: number; glucoseOut: number; iodineIn: number; iodineOut: number;
}

export interface DiffusionResult {
  series: DiffusionPoint[];
  final: DiffusionPoint;
  halfTimeGlucose: number; // min
  halfTimeIodine: number; // min
  bagTurnsBlue: boolean;
  glucoseDetectedOutside: boolean;
}

/** Constante de velocidad de equilibrio (1/min) para un soluto entre la bolsa y el vaso. */
export function exchangeRate(solute: Solute, tempC: number, areaCm2: number): number {
  if (!solute.crossesMembrane) return 0;
  const D = diffusionCoefficient(solute.d25, tempC); // m²/s
  const P = D / MEMBRANE_EFFECTIVE_THICKNESS; // m/s
  const A = areaCm2 * 1e-4; // m²
  const vIn = BAG_VOLUME_ML * 1e-6; // m³
  const vOut = BEAKER_VOLUME_ML * 1e-6;
  return P * A * (1 / vIn + 1 / vOut) * 60; // 1/min
}

/** Solución analítica de dos compartimentos: Δ(t) = Δ₀·e^(−k t), conservando la masa total. */
function twoCompartment(cIn0: number, cOut0: number, k: number, t: number): [number, number] {
  const total = cIn0 * BAG_VOLUME_ML + cOut0 * BEAKER_VOLUME_ML;
  const ceq = total / (BAG_VOLUME_ML + BEAKER_VOLUME_ML);
  const delta = (cIn0 - cOut0) * Math.exp(-k * t);
  // c_in − c_out = Δ y c_in·V_in + c_out·V_out = total
  const cOut = ceq - (delta * BAG_VOLUME_ML) / (BAG_VOLUME_ML + BEAKER_VOLUME_ML);
  const cIn = cOut + delta;
  return [cIn, cOut];
}

export const GLUCOSE_DETECTION_LIMIT = 0.1; // g/L (tira reactiva simplificada)
export const IODINE_STARCH_THRESHOLD = 0.01; // g/L de yodo dentro de la bolsa para color azul visible

export function simulateDiffusion(input: DiffusionInput): DiffusionResult {
  assertInRange('La temperatura', input.temperature, ...DIFFUSION_LIMITS.temperature);
  assertInRange('El área de la membrana', input.area, ...DIFFUSION_LIMITS.area);
  assertInRange('La glucosa inicial', input.glucoseInside0, ...DIFFUSION_LIMITS.glucose);
  assertInRange('El yodo inicial', input.iodineOutside0, ...DIFFUSION_LIMITS.iodine);
  assertInRange('El tiempo', input.duration, ...DIFFUSION_LIMITS.duration);
  const kg = exchangeRate(SOLUTES[0], input.temperature, input.area);
  const ki = exchangeRate(SOLUTES[1], input.temperature, input.area);
  const series: DiffusionPoint[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = (input.duration * i) / steps;
    const [gIn, gOut] = twoCompartment(input.glucoseInside0, 0, kg, t);
    const [iIn, iOut] = twoCompartment(0, input.iodineOutside0, ki, t);
    series.push({ t, glucoseIn: gIn, glucoseOut: gOut, iodineIn: iIn, iodineOut: iOut });
  }
  const final = series[series.length - 1];
  return {
    series,
    final,
    halfTimeGlucose: kg > 0 ? Math.LN2 / kg : Infinity,
    halfTimeIodine: ki > 0 ? Math.LN2 / ki : Infinity,
    bagTurnsBlue: input.starchInside && final.iodineIn >= IODINE_STARCH_THRESHOLD,
    glucoseDetectedOutside: final.glucoseOut >= GLUCOSE_DETECTION_LIMIT,
  };
}

export const osmosisModelSpec: ModelSpec = {
  name: 'Ósmosis celular (Boyle-van \'t Hoff) y difusión entre dos compartimentos (Fick)',
  inputs: [
    { symbol: 'tipo', name: 'Tipo de célula', unit: '—', initial: 'animal' },
    { symbol: 'NaCl', name: 'Concentración de NaCl en el medio', unit: '% m/v', range: OSMOSIS_LIMITS.naclPercent, initial: 0.9 },
    { symbol: 'T', name: 'Temperatura', unit: '°C', range: OSMOSIS_LIMITS.temperature, initial: 25 },
    { symbol: 't', name: 'Tiempo de observación (ósmosis)', unit: 's', range: OSMOSIS_LIMITS.duration, initial: 60 },
    { symbol: 'A', name: 'Área de la membrana (difusión)', unit: 'cm²', range: DIFFUSION_LIMITS.area, initial: 10 },
    { symbol: 'C_glucosa', name: 'Glucosa inicial en la bolsa', unit: 'g/L', range: DIFFUSION_LIMITS.glucose, initial: 20 },
  ],
  outputs: [
    { symbol: 'V/V₀', name: 'Volumen celular relativo', unit: '%' },
    { symbol: 'π', name: 'Presión osmótica', unit: 'kPa' },
    { symbol: 'P', name: 'Presión de turgencia (célula vegetal)', unit: 'kPa' },
    { symbol: 'C(t)', name: 'Concentración de glucosa y yodo dentro y fuera de la bolsa', unit: 'g/L' },
  ],
  equations: [
    'Osmolaridad del NaCl (ideal): C = (%·10 / 58,44)·2  [Osm/L]   → 0,9 % ≈ 0,308 Osm/L',
    'Presión osmótica de van \'t Hoff: π = C·R·T',
    'Flujo de agua: dW/dt = k(T)·(n/W − C_ext − P/RT);  V = b + W',
    'Turgencia (pared celular): P = ε·(V − 1) si V > 1;  ε = 5 MPa',
    'k(T) = k₂₅·exp[−Eₐ/R·(1/T − 1/298 K)],  Eₐ = 20 kJ/mol',
    'Difusión (Fick, dos compartimentos): Δc(t) = Δc₀·e^(−kt);  k = (D/L)·A·(1/V_bolsa + 1/V_vaso)',
    'Efecto de la temperatura en D (Stokes-Einstein): D ∝ T/η(T)',
  ],
  initialConditions: [
    'Célula con osmolaridad interna de 0,30 Osm/L y volumen relativo 1,00 (100 %).',
    'Fracción no osmótica b = 0,40 del volumen celular.',
    'Bolsa de diálisis de 20 mL dentro de un vaso con 200 mL.',
  ],
  assumptions: [
    'El soluto interno de la célula y el NaCl no atraviesan la membrana; solo se mueve agua.',
    'El NaCl se comporta idealmente (i = 2); en la realidad el coeficiente osmótico es ≈ 0,93.',
    'El medio externo es tan grande que su concentración no cambia.',
    'La pared vegetal es elástica con módulo constante; la membrana animal se rompe al 155 % de su volumen (lisis).',
    'La escala de tiempo es ilustrativa: un glóbulo rojo real se equilibra en fracciones de segundo a pocos segundos.',
    'En la bolsa de diálisis, el almidón no atraviesa los poros; la glucosa y el yodo sí.',
  ],
  limits: [
    'No representa transporte activo, canales regulados, ni cambios del metabolismo celular.',
    'No considera daño celular por temperatura fuera de 5–40 °C.',
    'Los coeficientes de difusión y el espesor efectivo de la membrana son aproximados.',
    'La "plasmólisis" se identifica cuando el protoplasto ocupa menos volumen que la pared (V < 1).',
  ],
  testCases: [
    'NaCl 0,9 % ≈ 0,308 Osm/L → el volumen cambia menos de 2 % (casi isotónica).',
    'Agua destilada: la célula animal se lisa; la vegetal queda turgente con P > 0 sin romperse.',
    'NaCl 3 %: la célula animal se crena y la vegetal se plasmoliza.',
    'Mayor temperatura → equilibrio más rápido, mismo volumen final.',
    'En la difusión se conserva la masa total de soluto y la concentración tiende al equilibrio.',
  ],
};

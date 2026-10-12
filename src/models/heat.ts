import { assertInRange, roundToResolution, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Calor, temperatura y equilibrio térmico (grado 6.º, con rigor de física introductoria).
 *
 * Método de las mezclas en un calorímetro escolar con tapa. Dos cuerpos intercambian calor:
 *   cuerpo 1 («muestra»): agua caliente que se vierte, o una pieza de metal calentada en agua hirviendo;
 *   cuerpo 2: el agua del calorímetro junto con el vaso (capacidad calorífica C_vaso), donde está el termómetro.
 * Modelo de dos nodos térmicos acoplados (ley de enfriamiento de Newton en cada interfaz):
 *   C₁ · dT₁/dt = −G · (T₁ − T₂)
 *   C₂ · dT₂/dt = +G · (T₁ − T₂) − L · (T₂ − T_amb)
 * con C₁ = m₁·c₁, C₂ = m₂·c_agua + C_vaso, G la conductancia muestra–agua (agitación) y L la conductancia de
 * pérdidas del vaso hacia el aire del salón (depende del recipiente). Es un sistema lineal: se resuelve de
 * forma exacta con sus dos modos propios (uno rápido, el de la mezcla, y uno lento, el del enfriamiento).
 * Sin pérdidas (L = 0) el estado final es T_e = Σ m·c·T / Σ m·c y el calor cedido es igual al ganado.
 */

export type ExperimentId = 'agua' | 'metal';
export type MetalId = 'aluminio' | 'cobre' | 'hierro' | 'plomo' | 'desconocido';
export type ContainerId = 'icopor' | 'vidrio' | 'lata';

/** Calor específico del agua líquida entre 20 y 40 °C, J/(g·°C). */
export const C_WATER = 4.18;
/** Temperatura del salón (°C): promedio típico en Apartadó (Urabá antioqueño). */
export const ROOM_T = 28;
/** Duración del registro después de mezclar (s). */
export const RECORD_S = 600;
/** Paso de la serie de temperatura (s). */
export const SERIES_STEP = 5;
/** Tiempo característico de la mezcla de dos porciones de agua con agitación (s). */
export const MIX_TAU = 4;
/** Coeficiente de convección metal–agua con agitación suave, W/(m²·K). */
export const H_METAL_WATER = 600;
/** Criterio de fin de la mezcla: el intercambio rápido aporta menos de media división del termómetro (°C). */
export const EQ_TOL = 0.05;
/** Resolución del termómetro digital (°C) y de la balanza (g). */
export const THERMO_RES = 0.1;
export const BALANCE_RES = 0.1;

export const HEAT_LIMITS = {
  waterMass: [50, 200] as [number, number], // g de agua en el calorímetro
  waterTemp: [5, 35] as [number, number], // °C iniciales del agua del calorímetro
  sampleMass: [20, 150] as [number, number], // g de agua caliente o de metal
  sampleTemp: [30, 99] as [number, number], // °C iniciales de la muestra
};

export interface MetalInfo {
  id: MetalId;
  name: string;
  /** Calor específico a 25 °C, J/(g·°C). */
  c: number;
  /** Densidad, g/cm³. */
  density: number;
  /** Color del metal para el dibujo. */
  color: string;
  /** Identidad real (solo para la muestra desconocida). */
  identity?: string;
}

/** Calores específicos a 25 °C (CRC Handbook / Engineering Toolbox, redondeados). */
export const METALS: MetalInfo[] = [
  { id: 'aluminio', name: 'Aluminio', c: 0.897, density: 2.70, color: '#c4cad0' },
  { id: 'cobre', name: 'Cobre', c: 0.385, density: 8.96, color: '#c27a4a' },
  { id: 'hierro', name: 'Hierro', c: 0.449, density: 7.87, color: '#7b8087' },
  { id: 'plomo', name: 'Plomo', c: 0.129, density: 11.34, color: '#5f666e' },
  { id: 'desconocido', name: 'Metal desconocido (muestra X)', c: 0.523, density: 4.51, color: '#a7a596', identity: 'titanio' },
];

/** Tabla de referencia para identificar la muestra desconocida, J/(g·°C) a 25 °C. */
export const SPECIFIC_HEAT_TABLE: { name: string; c: number }[] = [
  { name: 'Agua líquida', c: 4.18 },
  { name: 'Aluminio', c: 0.897 },
  { name: 'Titanio', c: 0.523 },
  { name: 'Hierro', c: 0.449 },
  { name: 'Zinc', c: 0.388 },
  { name: 'Cobre', c: 0.385 },
  { name: 'Plata', c: 0.235 },
  { name: 'Estaño', c: 0.227 },
  { name: 'Plomo', c: 0.129 },
];

export interface ContainerInfo {
  id: ContainerId;
  name: string;
  short: string;
  /** Masa del vaso (g) y calor específico de su material, J/(g·°C). */
  mass: number;
  c: number;
  /** Conductancia de pérdidas hacia el aire del salón con la tapa puesta, W/K (= J/(s·°C)). */
  loss: number;
}

/** Vasos de ≈ 400 mL, todos con la misma tapa de icopor perforada para el termómetro y el agitador. Pérdidas ilustrativas. */
export const CONTAINERS: ContainerInfo[] = [
  { id: 'icopor', name: 'Vaso de icopor (poliestireno expandido)', short: 'Icopor', mass: 3.0, c: 1.3, loss: 0.12 },
  { id: 'vidrio', name: 'Vaso de precipitados de vidrio', short: 'Vidrio', mass: 130, c: 0.84, loss: 0.4 },
  { id: 'lata', name: 'Lata de aluminio', short: 'Lata', mass: 16, c: 0.897, loss: 0.45 },
];

export function findMetal(id: string): MetalInfo {
  const m = METALS.find((x) => x.id === id);
  if (!m) throw new Error(`Metal desconocido en el modelo: ${id}`);
  return m;
}

export function findContainer(id: string): ContainerInfo {
  const c = CONTAINERS.find((x) => x.id === id);
  if (!c) throw new Error(`Recipiente desconocido: ${id}`);
  return c;
}

/** Capacidad calorífica del vaso (J/°C) = masa · calor específico de su material. */
export const containerHeatCapacity = (id: ContainerId) => {
  const c = findContainer(id);
  return c.mass * c.c;
};

/* ------------------------------------------------------------------ relaciones básicas */

/** Calor (J) que gana (Q > 0) o pierde (Q < 0) un cuerpo: Q = m · c · ΔT. */
export function heat(mass: number, c: number, deltaT: number): number {
  if (!(mass >= 0) || !(c >= 0)) throw new RangeError('La masa y el calor específico no pueden ser negativos.');
  return mass * c * deltaT;
}

export interface Body { /** Capacidad calorífica m·c (J/°C). */ C: number; /** Temperatura inicial (°C). */ T: number; }

/** Temperatura de equilibrio sin pérdidas: T_e = Σ C·T / Σ C (con C = m·c). */
export function equilibriumTemperature(bodies: Body[]): number {
  if (bodies.length === 0) throw new RangeError('Se necesita al menos un cuerpo.');
  let num = 0, den = 0;
  for (const b of bodies) {
    if (!(b.C >= 0) || !Number.isFinite(b.T)) throw new RangeError('Capacidad calorífica o temperatura no válida.');
    num += b.C * b.T;
    den += b.C;
  }
  if (!(den > 0)) throw new RangeError('La capacidad calorífica total debe ser positiva.');
  return num / den;
}

/** Calor específico de la muestra a partir de una mezcla: c = (m_agua·c_agua + C_vaso)·(T_e − T_agua) / (m_muestra·(T_muestra − T_e)). */
export function specificHeatFromMixture(p: { waterMass: number; waterTemp: number; vesselC: number; sampleMass: number; sampleTemp: number; te: number }): number {
  const ds = p.sampleTemp - p.te;
  if (!(p.sampleMass > 0) || ds === 0) throw new RangeError('La muestra debe tener masa y cambiar de temperatura.');
  return ((p.waterMass * C_WATER + p.vesselC) * (p.te - p.waterTemp)) / (p.sampleMass * ds);
}

/** Capacidad calorífica del vaso a partir de una mezcla de agua caliente y fría (método de las mezclas). */
export function vesselCapacityFromMixture(p: { coldMass: number; coldTemp: number; hotMass: number; hotTemp: number; te: number }): number {
  const dw = p.te - p.coldTemp;
  if (dw === 0) throw new RangeError('El agua fría debe cambiar de temperatura.');
  return (p.hotMass * C_WATER * (p.hotTemp - p.te) - p.coldMass * C_WATER * dw) / dw;
}

/** Ley de enfriamiento de Newton para un solo cuerpo: T(t) = T_amb + (T₀ − T_amb)·e^(−t/τ). */
export function newtonCooling(T0: number, ambient: number, tau: number, t: number): number {
  if (!(tau > 0)) throw new RangeError('La constante de tiempo debe ser positiva.');
  return ambient + (T0 - ambient) * Math.exp(-t / tau);
}

/** Lectura del termómetro digital (0,1 °C). */
export const thermometerReading = (T: number) => {
  const r = roundToResolution(T, THERMO_RES);
  return Object.is(r, -0) ? 0 : r;
};
/** Lectura de la balanza (0,1 g). */
export const balanceReading = (m: number) => roundToResolution(m, BALANCE_RES);

/** Fichas de los instrumentos (misma forma que src/labs/instruments.ts), usadas como respaldo. */
export const HEAT_INSTRUMENTS = [
  { id: 'termometro', name: 'Termómetro digital de sonda (−50 a 150 °C)', quantity: 'Temperatura', unit: '°C', resolution: THERMO_RES, sigma: 0.1, note: 'Tiempo de respuesta de la sonda, agitación incompleta y posición de la punta dentro del agua.' },
  { id: 'balanza', name: 'Balanza digital (600 g)', quantity: 'Masa', unit: 'g', resolution: BALANCE_RES, sigma: 0.08, note: 'Corrientes de aire, gotas en el plato y vasos aún tibios (convección sobre el plato).' },
];

/* ------------------------------------------------------------------ simulación del calorímetro */

export interface HeatInput {
  experiment: ExperimentId;
  metal: MetalId;
  container: ContainerId;
  /** Masa (g) y temperatura inicial (°C) de la muestra: agua caliente o metal. */
  sampleMass: number;
  sampleTemp: number;
  /** Masa (g) y temperatura inicial (°C) del agua del calorímetro. */
  waterMass: number;
  waterTemp: number;
  /** Temperatura del salón (°C). */
  ambient?: number;
  /** Idealización: calorímetro perfectamente aislado (L = 0). */
  lossless?: boolean;
}

export interface HeatSim {
  input: Required<HeatInput>;
  /** Calor específico de la muestra, J/(g·°C). */
  c1: number;
  /** Capacidades caloríficas (J/°C): muestra, agua del calorímetro, vaso; C₂ = agua + vaso. */
  C1: number; Cwater: number; Cvessel: number; C2: number;
  /** Conductancias (W/K): muestra–agua y vaso–aire. */
  G: number; L: number;
  /** Valores propios (1/s): rápido (mezcla) y lento (pérdidas; 0 si no hay pérdidas). */
  lambdaFast: number; lambdaSlow: number;
  /** Amplitudes de cada modo en T₁ (°C). */
  amp: [number, number];
  /** T_e sin pérdidas con el vaso, y sin contar el vaso. */
  teIdeal: number; teNoVessel: number;
  /** Instante (s) en que el modo rápido aporta menos de 0,05 °C al agua (fin de la mezcla); temperatura del agua en ese instante. */
  tEq: number; teTrue: number;
  /** Constante de tiempo del enfriamiento lento (s) = (C₁ + C₂)/L aproximadamente; Infinity si L = 0. */
  tauSlow: number;
}

/** Conductancia metal–agua (W/K): cilindro de altura igual al diámetro, h = 600 W/(m²·K). */
export function metalConductance(mass: number, density: number): number {
  const V = mass / density; // cm³
  const d = Math.cbrt((4 * V) / Math.PI); // cm
  const area = 1.5 * Math.PI * d * d * 1e-4; // m² (dos bases + cara lateral)
  return H_METAL_WATER * area;
}

export function simulate(input: HeatInput): HeatSim {
  if (input.experiment !== 'agua' && input.experiment !== 'metal') throw new Error(`Experimento desconocido: ${input.experiment}`);
  const vessel = findContainer(input.container);
  const metal = findMetal(input.metal);
  assertInRange('La masa de agua del calorímetro', input.waterMass, ...HEAT_LIMITS.waterMass);
  assertInRange('La temperatura inicial del agua', input.waterTemp, ...HEAT_LIMITS.waterTemp);
  assertInRange('La masa de la muestra', input.sampleMass, ...HEAT_LIMITS.sampleMass);
  assertInRange('La temperatura inicial de la muestra', input.sampleTemp, ...HEAT_LIMITS.sampleTemp);
  const ambient = input.ambient ?? ROOM_T;
  assertInRange('La temperatura del salón', ambient, 10, 40);

  const water = input.experiment === 'agua';
  const c1 = water ? C_WATER : metal.c;
  const C1 = input.sampleMass * c1;
  const Cwater = input.waterMass * C_WATER;
  const Cvessel = vessel.mass * vessel.c;
  const C2 = Cwater + Cvessel;
  // Agua con agua: mezcla con constante de tiempo MIX_TAU. Metal: convección forzada suave sobre su superficie.
  const G = water ? 1 / (MIX_TAU * (1 / C1 + 1 / C2)) : metalConductance(input.sampleMass, metal.density);
  const L = input.lossless ? 0 : vessel.loss;

  // Sistema lineal x' = A x con x = T − T_amb; A = [[−a, a], [b, −(b + l)]].
  const a = G / C1, b = G / C2, l = L / C2;
  const s = a + b + l;
  const disc = Math.sqrt(Math.max(0, s * s - 4 * a * l));
  const lambdaFast = (-s - disc) / 2, lambdaSlow = (-s + disc) / 2;
  const x10 = input.sampleTemp - ambient, x20 = input.waterTemp - ambient;
  // Autovectores [a, a + λ]: T₁ = Σ A_i e^{λ_i t};  T₂ = Σ A_i (1 + λ_i/a) e^{λ_i t}.
  const c1coef = (x20 - x10 - (lambdaSlow * x10) / a) / (lambdaFast - lambdaSlow);
  const c2coef = x10 / a - c1coef;
  const amp: [number, number] = [c1coef * a, c2coef * a];

  const teIdeal = equilibriumTemperature([{ C: C1, T: input.sampleTemp }, { C: C2, T: input.waterTemp }]);
  const teNoVessel = equilibriumTemperature([{ C: C1, T: input.sampleTemp }, { C: Cwater, T: input.waterTemp }]);
  const sim: HeatSim = {
    input: { ...input, ambient, lossless: !!input.lossless }, c1, C1, Cwater, Cvessel, C2, G, L, lambdaFast, lambdaSlow, amp,
    teIdeal, teNoVessel, tEq: 0, teTrue: input.waterTemp, tauSlow: lambdaSlow < 0 ? -1 / lambdaSlow : Infinity,
  };
  sim.tEq = equilibriumTime(sim);
  sim.teTrue = temperaturesAt(sim, sim.tEq).water;
  return sim;
}

/** Temperaturas exactas (°C) de la muestra y del agua del calorímetro en el instante t (s) después de mezclar. */
export function temperaturesAt(sim: HeatSim, t: number): { sample: number; water: number } {
  const Ta = sim.input.ambient, a = sim.G / sim.C1;
  const e1 = Math.exp(sim.lambdaFast * t), e2 = Math.exp(sim.lambdaSlow * t);
  const [A1, A2] = sim.amp;
  return {
    sample: Ta + A1 * e1 + A2 * e2,
    water: Ta + A1 * (1 + sim.lambdaFast / a) * e1 + A2 * (1 + sim.lambdaSlow / a) * e2,
  };
}

/**
 * Instante (s) en que termina la mezcla: el modo rápido (intercambio muestra–agua) aporta menos de
 * 0,05 °C a la lectura del agua. Desde ahí la muestra y el agua están en equilibrio térmico entre sí
 * y solo derivan juntas, lentamente, hacia la temperatura del salón.
 */
export function equilibriumTime(sim: HeatSim, tol = EQ_TOL): number {
  const a = sim.G / sim.C1;
  const fastWater = Math.abs(sim.amp[0] * (1 + sim.lambdaFast / a));
  if (fastWater <= tol || !(sim.lambdaFast < 0)) return 0;
  return Math.log(fastWater / tol) / -sim.lambdaFast;
}

/** Calor (J) que salió del agua y el vaso hacia el aire entre 0 y t (negativo si entró calor desde el salón). */
export function heatToSurroundings(sim: HeatSim, t: number): number {
  if (sim.L === 0) return 0;
  const a = sim.G / sim.C1;
  let q = 0;
  for (const [A, lam] of [[sim.amp[0], sim.lambdaFast], [sim.amp[1], sim.lambdaSlow]] as [number, number][]) {
    const B = A * (1 + lam / a);
    q += lam === 0 ? B * t : (B * (Math.exp(lam * t) - 1)) / lam;
  }
  return sim.L * q;
}

/** Calor (J) que ha cedido la muestra hasta el instante t: C₁·(T₁(0) − T₁(t)). */
export function heatFromSample(sim: HeatSim, t: number): number {
  return sim.C1 * (sim.input.sampleTemp - temperaturesAt(sim, t).sample);
}

/** Calor (J) que han ganado el agua y el vaso hasta el instante t: C₂·(T₂(t) − T₂(0)). */
export function heatToCalorimeter(sim: HeatSim, t: number): number {
  return sim.C2 * (temperaturesAt(sim, t).water - sim.input.waterTemp);
}

/** Flujos de calor instantáneos (W): de la muestra al agua y del agua al aire. */
export function heatFlows(sim: HeatSim, t: number): { toWater: number; toAir: number } {
  const T = temperaturesAt(sim, t);
  return { toWater: sim.G * (T.sample - T.water), toAir: sim.L * (T.water - sim.input.ambient) };
}

export interface SeriesPoint { t: number; water: number; sample: number; }

/** Serie de temperaturas exactas cada `step` s, desde 0 hasta `duration`. */
export function temperatureSeries(sim: HeatSim, duration = RECORD_S, step = SERIES_STEP): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const n = Math.round(duration / step);
  for (let i = 0; i <= n; i++) {
    const t = i * step;
    const T = temperaturesAt(sim, t);
    out.push({ t, water: T.water, sample: T.sample });
  }
  return out;
}

/** Lecturas del termómetro a lo largo de la serie: con ruido gaussiano reproducible (σ en °C) si sigma > 0. */
export function thermometerSeries(series: SeriesPoint[], sigma = 0, seed = 1): { t: number; T: number }[] {
  const rnd = seededRandom(seed);
  return series.map((p) => {
    let noise = 0;
    if (sigma > 0) {
      const u1 = Math.max(rnd(), 1e-12), u2 = rnd();
      noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
    }
    return { t: p.t, T: thermometerReading(p.water + noise) };
  });
}

/* ------------------------------------------------------------------ análisis del estudiante */

export interface HeatReadings { sampleMass: number; sampleTemp: number; waterMass: number; waterTemp: number; te: number; }

export interface HeatAnalysis {
  /** Cambios de temperatura (°C): agua del calorímetro (T_e − T_agua) y muestra (T_muestra − T_e). */
  dtWater: number; dtSample: number;
  /** Calor ganado por el agua, por el vaso y en total (J). */
  qWater: number; qVessel: number; qGained: number;
  /** Calor cedido por la muestra (J); null si su calor específico es desconocido. */
  qGiven: number | null;
  /** Diferencia cedido − ganado (J): estimación de las pérdidas hacia el aire. */
  qDiff: number | null;
  /** Diferencia como porcentaje del calor cedido. */
  lossPct: number | null;
  /** T_e esperada sin pérdidas con las lecturas iniciales; null si c de la muestra es desconocido. */
  tePredicted: number | null;
  /** Calor específico calculado de la muestra (metal), J/(g·°C). */
  cSample: number | null;
  /** Capacidad calorífica del vaso calculada (mezcla de aguas), J/°C. */
  cVessel: number | null;
}

/** Diferencias mínimas (°C) para que los cocientes tengan sentido con un termómetro de 0,1 °C. */
export const MIN_DT = 1;

/**
 * Cálculos que hace el estudiante con sus lecturas: calor cedido y ganado, pérdidas,
 * T_e esperada, calor específico de un metal o capacidad calorífica del vaso.
 */
export function analyzeReadings(r: HeatReadings, ctx: { experiment: ExperimentId; metal: MetalId; container: ContainerId }): HeatAnalysis {
  const metal = findMetal(ctx.metal);
  const vesselC = containerHeatCapacity(ctx.container);
  const water = ctx.experiment === 'agua';
  const known = water || metal.id !== 'desconocido';
  const c1 = water ? C_WATER : metal.c;
  const dtWater = r.te - r.waterTemp, dtSample = r.sampleTemp - r.te;
  const qWater = r.waterMass * C_WATER * dtWater, qVessel = vesselC * dtWater, qGained = qWater + qVessel;
  const qGiven = known ? r.sampleMass * c1 * dtSample : null;
  const qDiff = qGiven === null ? null : qGiven - qGained;
  const lossPct = qGiven === null || Math.abs(qGiven) < 1e-9 ? null : (100 * (qDiff as number)) / qGiven;
  const tePredicted = known ? equilibriumTemperature([{ C: r.sampleMass * c1, T: r.sampleTemp }, { C: r.waterMass * C_WATER + vesselC, T: r.waterTemp }]) : null;
  const cSample = !water && Math.abs(dtSample) >= MIN_DT && Math.abs(dtWater) >= MIN_DT * 0.5
    ? specificHeatFromMixture({ waterMass: r.waterMass, waterTemp: r.waterTemp, vesselC, sampleMass: r.sampleMass, sampleTemp: r.sampleTemp, te: r.te })
    : null;
  const cVessel = water && Math.abs(dtWater) >= MIN_DT
    ? vesselCapacityFromMixture({ coldMass: r.waterMass, coldTemp: r.waterTemp, hotMass: r.sampleMass, hotTemp: r.sampleTemp, te: r.te })
    : null;
  return { dtWater, dtSample, qWater, qVessel, qGained, qGiven, qDiff, lossPct, tePredicted, cSample, cVessel };
}

/** Metal de la tabla cuyo calor específico está más cerca del calculado. */
export function closestMaterial(c: number): { name: string; c: number } {
  const metals = SPECIFIC_HEAT_TABLE.filter((x) => x.name !== 'Agua líquida');
  return metals.reduce((best, x) => (Math.abs(x.c - c) < Math.abs(best.c - c) ? x : best), metals[0]);
}

export const heatModelSpec: ModelSpec = {
  name: 'Calorímetro de mezclas: equilibrio térmico, calor específico y pérdidas por la ley de enfriamiento de Newton',
  inputs: [
    { symbol: 'experimento', name: 'Muestra que se agrega: agua caliente o metal calentado en agua hirviendo', unit: '—', initial: 'agua caliente' },
    { symbol: 'metal', name: 'Metal (aluminio, cobre, hierro, plomo o muestra desconocida)', unit: '—', initial: 'aluminio' },
    { symbol: 'vaso', name: 'Recipiente del calorímetro (icopor, vidrio o lata), todos con tapa', unit: '—', initial: 'icopor' },
    { symbol: 'm₁', name: 'Masa de la muestra (agua caliente o metal)', unit: 'g', range: HEAT_LIMITS.sampleMass, initial: 100 },
    { symbol: 'T₁', name: 'Temperatura inicial de la muestra', unit: '°C', range: HEAT_LIMITS.sampleTemp, initial: 60 },
    { symbol: 'm₂', name: 'Masa de agua en el calorímetro', unit: 'g', range: HEAT_LIMITS.waterMass, initial: 100 },
    { symbol: 'T₂', name: 'Temperatura inicial del agua del calorímetro', unit: '°C', range: HEAT_LIMITS.waterTemp, initial: 20 },
  ],
  outputs: [
    { symbol: 'T(t)', name: 'Temperatura del agua del calorímetro en función del tiempo (cada 5 s, 10 min)', unit: '°C' },
    { symbol: 'T_e', name: 'Temperatura de equilibrio leída al terminar la mezcla (el intercambio rápido muestra–agua aporta < 0,05 °C)', unit: '°C' },
    { symbol: 'Q', name: 'Calor cedido por la muestra, ganado por el agua y el vaso, y diferencia (pérdidas)', unit: 'J' },
    { symbol: 'c', name: 'Calor específico calculado del metal', unit: 'J/(g·°C)' },
    { symbol: 'C_vaso', name: 'Capacidad calorífica del vaso calculada con agua caliente y fría', unit: 'J/°C' },
  ],
  equations: [
    'Q = m · c · ΔT  (Q > 0: el cuerpo gana calor; Q < 0: lo cede)',
    'Sin pérdidas: Q cedido = Q ganado  →  T_e = Σ m·c·T / Σ m·c',
    'T_e = (m₁·c₁·T₁ + (m₂·c_agua + C_vaso)·T₂) / (m₁·c₁ + m₂·c_agua + C_vaso)',
    'C₁·dT₁/dt = −G·(T₁ − T₂);   C₂·dT₂/dt = G·(T₁ − T₂) − L·(T₂ − T_amb)   (ley de Newton en cada interfaz)',
    'Agua con agua: G = 1/(τ_mezcla·(1/C₁ + 1/C₂)), τ_mezcla = 4 s;  metal: G = h·A, h = 600 W/(m²·K), cilindro con altura = diámetro',
    'Un solo cuerpo: T(t) = T_amb + (T₀ − T_amb)·e^(−t/τ),  τ = C/L',
    'Metal desconocido: c = (m₂·c_agua + C_vaso)·(T_e − T₂) / (m₁·(T₁ − T_e))',
    'Vaso: C_vaso = [m₁·c_agua·(T₁ − T_e) − m₂·c_agua·(T_e − T₂)] / (T_e − T₂)',
  ],
  initialConditions: [
    '100,0 g de agua a 20,0 °C en un vaso de icopor con tapa; se agregan 100,0 g de agua a 60,0 °C; salón a 28 °C (Apartadó).',
    'El vaso empieza a la temperatura del agua que contiene; el registro dura 10 min desde el momento de la mezcla.',
  ],
  assumptions: [
    'Calores específicos constantes en el intervalo de trabajo (agua 4,18 J/(g·°C); metales a 25 °C). No hay cambios de estado: el agua no hierve ni se congela.',
    'El agua del calorímetro, el vaso y el termómetro están siempre a una misma temperatura (agitación continua); la sonda responde al instante.',
    'La muestra conserva su temperatura inicial hasta entrar al vaso: se desprecian el enfriamiento al verterla o al sacar el metal del agua hirviendo y el agua que arrastra el metal.',
    'El metal es un cilindro compacto con temperatura uniforme (número de Biot < 0,2) y un coeficiente de convección de 600 W/(m²·K) con agitación suave.',
    'Las pérdidas siguen la ley de enfriamiento de Newton, proporcionales a T − T_amb, con una conductancia fija por recipiente (icopor 0,12 W/K; vidrio 0,40 W/K; lata 0,45 W/K, con tapa). Valores ilustrativos de vasos de ≈ 400 mL.',
    'El salón está a 28 °C (temperatura media de Apartadó) y el aire no cambia de temperatura.',
  ],
  limits: [
    'Sin tapa, la evaporación domina las pérdidas del agua caliente y no es proporcional a T − T_amb (depende de la humedad del aire); el modelo no la incluye.',
    'Las capacidades caloríficas de los vasos se calculan con su masa y su material; no se incluyen el agitador ni la sonda (unos pocos J/°C).',
    'Por encima de ≈ 90 °C el agua caliente pierde calor muy rápido al verterla; los resultados reales con agua casi hirviendo serán algo menores.',
    'La pérdida de calor de un vaso real no es constante: crece con la superficie mojada y con corrientes de aire (ventilador).',
    'Con 0,1 °C de resolución, los calores específicos calculados tienen incertidumbre de unos pocos por ciento; si T_e − T₂ es menor que 1 °C el cálculo no es confiable.',
    'No representa la radiación de forma separada: queda incluida, linealizada, en la conductancia de pérdidas.',
  ],
  testCases: [
    'T_e = Σ m·c·T / Σ m·c: 100 g a 60 °C con 100 g a 20 °C dan 40 °C (sin vaso); 200 g a 20 °C con 100 g a 50 °C dan 30 °C.',
    'Sin pérdidas, la solución exacta conserva la energía: C₁·T₁ + C₂·T₂ es constante y el estado final es T_e.',
    'La solución analítica coincide con una integración numérica paso a paso de las dos ecuaciones.',
    'Con pérdidas, el calor cedido por la muestra es igual al ganado por el calorímetro más el que sale al aire (balance de energía).',
    'A largo plazo todo tiende a la temperatura del salón (28 °C); el icopor tarda más que el vidrio y la lata.',
    'Calor específico recuperado desde la mezcla: aluminio ≈ 0,90 J/(g·°C) y el metal desconocido (titanio) ≈ 0,52 J/(g·°C).',
    'Con la misma masa y temperatura, el aluminio calienta más el agua que el cobre y que el plomo (mayor m·c).',
    'Las entradas fuera de rango se rechazan.',
  ],
};

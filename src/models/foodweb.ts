import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Red alimentaria de un potrero con borde de bosque en Urabá (grado 6.º, ciencias ambientales).
 *
 * Modelo de Lotka-Volterra generalizado en tiempo continuo (biomasas en kg/ha, tiempo en años):
 *   Productor (logístico):   dP/dt = r·P·(1 − P/K) − Σ F(P→j)          con K = K₀·(lluvia/100)
 *   Consumidor j:            dCj/dt = e·Σ F(i→j) − Σ F(j→k) − mj·Cj − qj·Cj² − (caza o pesticida)·Cj
 *   Respuesta funcional tipo II (Holling) con varias presas:
 *                            F(i→j) = a_ij·Xi·Cj / (1 + h_j·Σ_k a_kj·Xk)
 * La eficiencia de conversión e = 0,1 representa la regla del 10 %. El término −q·C² (competencia
 * dentro de la especie, territorialidad) estabiliza el equilibrio y permite la coexistencia.
 * Se integra con Runge-Kutta de orden 4 con paso de 0,01 años.
 */

export type SpeciesId = 'pastos' | 'saltamontes' | 'ratones' | 'ranas' | 'serpientes' | 'gavilanes';
export type TrophicLevel = 'productor' | 'herbivoro' | 'carnivoro' | 'tope';

export interface Species {
  id: SpeciesId;
  name: string;
  /** Ejemplo plausible en potreros y bordes de bosque de Urabá (ilustrativo). */
  example: string;
  level: TrophicLevel;
  /** Resolución de la «medición» de biomasa (kg/ha). */
  resolution: number;
  decimals: number;
}

export const SPECIES: Species[] = [
  { id: 'pastos', name: 'Pastos y semillas', example: 'pasto guinea, grama y semillas de hierbas', level: 'productor', resolution: 1, decimals: 0 },
  { id: 'saltamontes', name: 'Saltamontes', example: 'saltamontes y langostas del pasto', level: 'herbivoro', resolution: 0.1, decimals: 1 },
  { id: 'ratones', name: 'Ratones', example: 'ratón de monte y rata algodonera', level: 'herbivoro', resolution: 0.1, decimals: 1 },
  { id: 'ranas', name: 'Ranas', example: 'rana platanera y sapo común', level: 'carnivoro', resolution: 0.01, decimals: 2 },
  { id: 'serpientes', name: 'Serpientes', example: 'falsa coral y culebra cazadora', level: 'carnivoro', resolution: 0.01, decimals: 2 },
  { id: 'gavilanes', name: 'Gavilanes', example: 'gavilán caminero', level: 'tope', resolution: 0.001, decimals: 3 },
];

export const SPECIES_IDS: SpeciesId[] = SPECIES.map((s) => s.id);

export const LEVEL_NAMES: Record<TrophicLevel, string> = {
  productor: 'Productores',
  herbivoro: 'Consumidores primarios (herbívoros)',
  carnivoro: 'Consumidores secundarios (carnívoros)',
  tope: 'Depredador tope',
};

/** Enlaces «presa → depredador» (dirección del flujo de energía). */
export interface FoodLink { prey: SpeciesId; predator: SpeciesId; attack: number; }

/** Tasas de ataque a_ij en ha/(kg·año), afinadas con un script numérico (ver pruebas). */
export const LINKS: FoodLink[] = [
  { prey: 'pastos', predator: 'saltamontes', attack: 0.00938 },
  { prey: 'pastos', predator: 'ratones', attack: 0.00469 },
  { prey: 'saltamontes', predator: 'ranas', attack: 0.521 },
  { prey: 'ranas', predator: 'serpientes', attack: 1.04 },
  { prey: 'ratones', predator: 'serpientes', attack: 0.333 },
  { prey: 'ratones', predator: 'gavilanes', attack: 1.41 },
  { prey: 'serpientes', predator: 'gavilanes', attack: 0.625 },
];

/** Parámetros de cada consumidor: h tiempo de manipulación (años), m pérdidas lineales (1/año), q autolimitación (ha/(kg·año)). */
export const CONSUMER_PARAMS: Record<Exclude<SpeciesId, 'pastos'>, { h: number; m: number; q: number }> = {
  saltamontes: { h: 0.00667, m: 0.2, q: 0.005 },
  ratones: { h: 0.0133, m: 0.281, q: 0.0352 },
  ranas: { h: 0.008, m: 0.127, q: 0.0844 },
  serpientes: { h: 0.0125, m: 0.065, q: 0.293 },
  gavilanes: { h: 0.02, m: 0.1, q: 3.0 },
};

/** Eficiencia de conversión (regla del 10 %). */
export const EFFICIENCY = 0.1;
/** Tasa de crecimiento del productor, 1/año. */
export const PRODUCER_R = 2;
/** Capacidad de carga del productor con lluvia normal (100 %), kg/ha. */
export const K_NORMAL = 5260;
export const DT = 0.01; // años
export const SAMPLE_EVERY = 10; // pasos (0,1 años)

/** Biomasa inicial (kg/ha): el potrero se recupera de una perturbación (≈ 60 % del equilibrio). */
export const INITIAL_BIOMASS: Record<SpeciesId, number> = {
  pastos: 2400, saltamontes: 36, ratones: 4.8, ranas: 3.6, serpientes: 1.2, gavilanes: 0.18,
};

/** Biomasa aproximada de equilibrio del escenario base (kg/ha), usada como referencia. */
export const BASE_EQUILIBRIUM: Record<SpeciesId, number> = {
  pastos: 4000, saltamontes: 60, ratones: 8, ranas: 6, serpientes: 2, gavilanes: 0.3,
};

/** Por debajo de esta fracción del equilibrio base, la población se considera prácticamente desaparecida. */
export const EXTINCTION_FRACTION = 0.02;

export const FOODWEB_LIMITS = {
  rain: [40, 120] as [number, number], // % de lo normal
  hunting: [0, 100] as [number, number], // % por año
  pesticide: [0, 100] as [number, number], // % por año
  years: [5, 30] as [number, number],
};

export const FOODWEB_DEFAULTS = { rain: 100, hunting: 0, pesticide: 0, years: 30 };

export interface FoodWebInput {
  rain: number;
  hunting: number;
  pesticide: number;
  years: number;
  /** Biomasas iniciales distintas (p. ej. sin productor). Por defecto, INITIAL_BIOMASS. */
  initial?: Partial<Record<SpeciesId, number>>;
}

export type Biomass = Record<SpeciesId, number>;

export interface FoodWebResult {
  /** Tiempos de muestreo (años), cada 0,1 años desde 0 hasta «years». */
  times: number[];
  series: Record<SpeciesId, number[]>;
  /** Biomasa final sin redondear (kg/ha). */
  finalRaw: Biomass;
  /** Biomasa final leída con la resolución de cada «medición» (kg/ha). */
  final: Biomass;
  /** Biomasa final por nivel trófico (kg/ha). */
  levels: Record<TrophicLevel, number>;
  extinct: SpeciesId[];
  /** Capacidad de carga del productor con esa lluvia (kg/ha). */
  carryingCapacity: number;
  /** Variación relativa máxima (max − min)/final en los últimos 5 años, por especie. */
  lastYearsVariation: Biomass;
}

const IDX: Record<SpeciesId, number> = { pastos: 0, saltamontes: 1, ratones: 2, ranas: 3, serpientes: 4, gavilanes: 5 };
const N = 6;
// Pre-cálculo de la estructura de la red por índices.
const PREY_OF: { prey: number; a: number }[][] = Array.from({ length: N }, () => []);
for (const l of LINKS) PREY_OF[IDX[l.predator]].push({ prey: IDX[l.prey], a: l.attack });
const PARAMS = SPECIES_IDS.map((id) => (id === 'pastos' ? { h: 0, m: 0, q: 0 } : CONSUMER_PARAMS[id]));

/** Derivadas del sistema (kg/ha/año). Exportada para pruebas. */
export function derivatives(y: number[], k: number, hunting: number, pesticide: number, out: number[] = new Array(N).fill(0)): number[] {
  for (let i = 0; i < N; i++) out[i] = 0;
  out[0] = PRODUCER_R * y[0] * (1 - y[0] / k);
  for (let j = 1; j < N; j++) {
    const prey = PREY_OF[j];
    let enc = 0;
    for (const p of prey) enc += p.a * y[p.prey];
    const den = 1 + PARAMS[j].h * enc;
    let intake = 0;
    for (const p of prey) {
      const f = (p.a * y[p.prey] * y[j]) / den;
      out[p.prey] -= f;
      intake += f;
    }
    out[j] += EFFICIENCY * intake - PARAMS[j].m * y[j] - PARAMS[j].q * y[j] * y[j];
  }
  out[IDX.gavilanes] -= hunting * y[IDX.gavilanes];
  out[IDX.saltamontes] -= pesticide * y[IDX.saltamontes];
  return out;
}

export function carryingCapacity(rain: number): number {
  return K_NORMAL * (rain / 100);
}

export function simulateFoodWeb(input: FoodWebInput): FoodWebResult {
  assertInRange('La lluvia', input.rain, ...FOODWEB_LIMITS.rain);
  assertInRange('La caza de gavilanes', input.hunting, ...FOODWEB_LIMITS.hunting);
  assertInRange('El pesticida sobre insectos', input.pesticide, ...FOODWEB_LIMITS.pesticide);
  assertInRange('Los años simulados', input.years, ...FOODWEB_LIMITS.years);
  const init = { ...INITIAL_BIOMASS, ...(input.initial ?? {}) };
  for (const id of SPECIES_IDS) {
    if (!Number.isFinite(init[id]) || init[id] < 0) throw new RangeError(`La biomasa inicial de ${id} debe ser un número mayor o igual que 0.`);
  }
  const k = carryingCapacity(input.rain);
  const hunting = input.hunting / 100; // tasa de cosecha proporcional, 1/año
  const pesticide = input.pesticide / 100; // mortalidad adicional, 1/año
  const steps = Math.round(input.years / DT);
  let y = SPECIES_IDS.map((id) => init[id]);
  const k1 = new Array(N).fill(0), k2 = new Array(N).fill(0), k3 = new Array(N).fill(0), k4 = new Array(N).fill(0);
  const tmp = new Array(N).fill(0);
  const times: number[] = [0];
  const cols: number[][] = y.map((v) => [v]);
  for (let s = 1; s <= steps; s++) {
    derivatives(y, k, hunting, pesticide, k1);
    for (let i = 0; i < N; i++) tmp[i] = y[i] + (DT / 2) * k1[i];
    derivatives(tmp, k, hunting, pesticide, k2);
    for (let i = 0; i < N; i++) tmp[i] = y[i] + (DT / 2) * k2[i];
    derivatives(tmp, k, hunting, pesticide, k3);
    for (let i = 0; i < N; i++) tmp[i] = y[i] + DT * k3[i];
    derivatives(tmp, k, hunting, pesticide, k4);
    y = y.map((v, i) => Math.max(0, v + (DT / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])));
    if (s % SAMPLE_EVERY === 0 || s === steps) {
      times.push(Number((s * DT).toFixed(4)));
      y.forEach((v, i) => cols[i].push(v));
    }
  }
  const series = Object.fromEntries(SPECIES_IDS.map((id, i) => [id, cols[i]])) as Record<SpeciesId, number[]>;
  const finalRaw = Object.fromEntries(SPECIES_IDS.map((id, i) => [id, y[i]])) as Biomass;
  const final = Object.fromEntries(SPECIES.map((sp) => [sp.id, roundToResolution(finalRaw[sp.id], sp.resolution)])) as Biomass;
  const levels: Record<TrophicLevel, number> = { productor: 0, herbivoro: 0, carnivoro: 0, tope: 0 };
  for (const sp of SPECIES) levels[sp.level] += finalRaw[sp.id];
  const extinct = SPECIES_IDS.filter((id) => finalRaw[id] < EXTINCTION_FRACTION * BASE_EQUILIBRIUM[id]);
  const tStart = input.years - 5;
  const lastYearsVariation = Object.fromEntries(SPECIES_IDS.map((id) => {
    const vals = series[id].filter((_, i) => times[i] >= tStart - 1e-9);
    const fin = finalRaw[id];
    return [id, fin > 0 ? (Math.max(...vals) - Math.min(...vals)) / fin : 0];
  })) as Biomass;
  return { times, series, finalRaw, final, levels, extinct, carryingCapacity: k, lastYearsVariation };
}

/** Cambio porcentual de cada especie frente a otro escenario (normalmente el base). */
export function percentChange(result: Biomass, base: Biomass): Biomass {
  return Object.fromEntries(SPECIES_IDS.map((id) => [id, base[id] > 0 ? ((result[id] - base[id]) / base[id]) * 100 : 0])) as Biomass;
}

export const foodwebModelSpec: ModelSpec = {
  name: 'Red alimentaria de un potrero: Lotka-Volterra generalizado con respuesta funcional tipo II',
  inputs: [
    { symbol: 'lluvia', name: 'Lluvia (porcentaje de lo normal); fija la capacidad de carga del pasto', unit: '%', range: FOODWEB_LIMITS.rain, initial: 100 },
    { symbol: 'c', name: 'Caza de gavilanes (cosecha proporcional)', unit: '% por año', range: FOODWEB_LIMITS.hunting, initial: 0 },
    { symbol: 'p', name: 'Pesticida sobre insectos (mortalidad extra de saltamontes)', unit: '% por año', range: FOODWEB_LIMITS.pesticide, initial: 0 },
    { symbol: 't', name: 'Años simulados', unit: 'años', range: FOODWEB_LIMITS.years, initial: 30 },
  ],
  outputs: [
    { symbol: 'P, S, M, R, Sp, G', name: 'Biomasa de pastos, saltamontes, ratones, ranas, serpientes y gavilanes', unit: 'kg/ha' },
    { symbol: 'Δ%', name: 'Cambio porcentual de cada especie frente al escenario base', unit: '%' },
    { symbol: 'B_nivel', name: 'Biomasa por nivel trófico (pirámide)', unit: 'kg/ha' },
  ],
  equations: [
    'Productor: dP/dt = r·P·(1 − P/K) − consumo por saltamontes y ratones;  K = 5260 kg/ha × (lluvia/100);  r = 2 por año',
    'Respuesta tipo II con varias presas: F(i→j) = a_ij·Xi·Cj / (1 + h_j·Σ a_kj·Xk)',
    'Consumidor: dCj/dt = e·Σ F(presas→j) − Σ F(j→depredadores) − mj·Cj − qj·Cj²;  e = 0,1 (regla del 10 %)',
    'Caza: −(c/100)·G en los gavilanes;  pesticida: −(p/100)·S en los saltamontes',
    'Integración numérica: Runge-Kutta de orden 4 con Δt = 0,01 años',
  ],
  initialConditions: [
    'Biomasas iniciales (kg/ha): pastos 2400; saltamontes 36; ratones 4,8; ranas 3,6; serpientes 1,2; gavilanes 0,18 (potrero que se recupera, ≈ 60 % del equilibrio).',
    'Escenario base: lluvia 100 %, sin caza ni pesticida, 30 años. Equilibrio aproximado: 4000; 60; 8; 6; 2 y 0,3 kg/ha.',
  ],
  assumptions: [
    'Cada grupo (p. ej., «ratones») se trata como una sola población homogénea, sin edades ni estaciones.',
    'Los saltamontes y los ratones comen pastos y semillas; las ranas comen saltamontes; las serpientes comen ranas y ratones; el gavilán come ratones y serpientes.',
    'El 10 % de lo que come cada consumidor se convierte en biomasa nueva; el resto se pierde (respiración, heces).',
    'El término −q·C² representa la competencia entre individuos de la misma especie (territorio, refugios) y estabiliza el sistema.',
    'La lluvia solo cambia la capacidad de carga del pasto; la caza y el pesticida actúan como tasas proporcionales constantes.',
  ],
  limits: [
    'Los parámetros son ilustrativos, afinados para reproducir patrones ecológicos conocidos; no son medidos en un potrero real.',
    'No incluye migración, enfermedades, estaciones secas y lluviosas, otras especies ni el efecto del pesticida sobre ranas y otros animales (bioacumulación).',
    'Una caza o un pesticida del 100 % por año se interpretan como una tasa de 1 por año (no como la eliminación instantánea de todos los individuos).',
    'Con biomasas muy pequeñas, el azar (no modelado) podría causar extinciones que el modelo determinista no muestra.',
  ],
  testCases: [
    'Escenario base: coexisten las 6 especies y la variación en los últimos 5 de 30 años es menor que 1 %.',
    'Caza alta de gavilanes: aumentan ratones y serpientes y disminuyen los pastos (cascada trófica).',
    'Pesticida alto: disminuyen saltamontes y ranas; las serpientes bajan menos que las ranas porque comen más ratones.',
    'Sequía (40 %): disminuye la biomasa de todos los niveles.',
    'Pirámide de biomasa: productor > herbívoros > carnívoros > depredador tope.',
    'Sin productor, ningún consumidor sobrevive.',
    'Entradas fuera de rango producen un error explicativo.',
  ],
};

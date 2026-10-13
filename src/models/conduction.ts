import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Transferencia de calor por conducción en varillas (grado 7.º, con rigor de transferencia de calor).
 *
 * Montaje tipo aparato de Ingenhousz: una varilla horizontal de 30 cm y 8 mm de diámetro entra por un tapón
 * de caucho en la pared de un baño de agua que un mechero mantiene a temperatura constante. A lo largo de la
 * varilla hay tachuelas pegadas con gotas de parafina (o una cinta termocrómica) y tres termopares.
 *
 * Ecuación de la aleta (conducción 1D transitoria con pérdidas laterales por convección y radiación linealizada):
 *   ρ·c·∂T/∂t = k·∂²T/∂x² − (4·U/D)·(T − T_amb)
 * con T(0, t) = T_baño (extremo sumergido), −k·∂T/∂x = U_punta·(T − T_amb) en x = L (punta) y T(x, 0) = T_amb.
 * Se resuelve con diferencias finitas centradas en el espacio y Crank–Nicolson en el tiempo (incondicionalmente
 * estable), con cuatro medios pasos iniciales de Euler implícito (arranque de Rannacher) para amortiguar las
 * oscilaciones que produce el salto inicial de temperatura en x = 0. También se incluye el esquema explícito
 * (FTCS) con su criterio de estabilidad, para compararlos.
 * El estado estacionario tiene solución exacta (aleta con punta convectiva):
 *   θ(x)/θ₀ = [cosh m(L − x) + (U/(m·k))·senh m(L − x)] / [cosh mL + (U/(m·k))·senh mL],  m = √(4U/(k·D)).
 */

export type RodId = 'cobre' | 'aluminio' | 'laton' | 'hierro' | 'inox' | 'vidrio' | 'madera';
export type CoverId = 'aire' | 'icopor';
export type TouchId = RodId | 'icopor' | 'aire';

export interface Material {
  id: string;
  name: string;
  short: string;
  /** Conductividad térmica k (W/(m·K)), densidad ρ (kg/m³) y calor específico c (J/(kg·K)) a ≈ 25 °C. */
  k: number;
  rho: number;
  c: number;
  /** Emisividad de la superficie (radiación). */
  emissivity: number;
  /** Color para el dibujo. */
  color: string;
}

/**
 * Propiedades a ≈ 300 K (Incropera et al., 7.ª ed., tablas A.1 y A.3; madera: Wood Handbook, USDA, 2010).
 * Emisividades típicas de varillas escolares (superficie algo oxidada; vidrio y madera ≈ 0,9).
 */
export const RODS: (Material & { id: RodId })[] = [
  { id: 'cobre', name: 'Cobre', short: 'Cobre', k: 401, rho: 8933, c: 385, emissivity: 0.1, color: '#c27a4a' },
  { id: 'aluminio', name: 'Aluminio', short: 'Aluminio', k: 237, rho: 2702, c: 903, emissivity: 0.1, color: '#c4cad0' },
  { id: 'laton', name: 'Latón (70 % Cu, 30 % Zn)', short: 'Latón', k: 110, rho: 8530, c: 380, emissivity: 0.1, color: '#c9a646' },
  { id: 'hierro', name: 'Hierro', short: 'Hierro', k: 80.2, rho: 7870, c: 447, emissivity: 0.6, color: '#6f757c' },
  { id: 'inox', name: 'Acero inoxidable (AISI 304)', short: 'Acero inox.', k: 14.9, rho: 7900, c: 477, emissivity: 0.3, color: '#a9b1b8' },
  { id: 'vidrio', name: 'Vidrio (borosilicato)', short: 'Vidrio', k: 1.4, rho: 2225, c: 835, emissivity: 0.9, color: '#a8d4dc' },
  { id: 'madera', name: 'Madera (pino, a lo largo de la fibra)', short: 'Madera', k: 0.25, rho: 510, c: 1380, emissivity: 0.9, color: '#b9874f' },
];

/** Materiales para el tacto y el aislamiento: las varillas más icopor y aire quieto. */
export const TOUCH_MATERIALS: (Material & { id: TouchId })[] = [
  ...RODS,
  { id: 'icopor', name: 'Icopor (poliestireno expandido)', short: 'Icopor', k: 0.04, rho: 16, c: 1210, emissivity: 0.9, color: '#f3f2ea' },
  { id: 'aire', name: 'Aire quieto', short: 'Aire', k: 0.0263, rho: 1.161, c: 1007, emissivity: 0, color: '#dbeef7' },
];

/** Piel de la mano (tejido blando): k, ρ, c y temperatura de la superficie de la palma. */
export const SKIN = { k: 0.37, rho: 1100, c: 3400, T: 33 };

/** Geometría de la varilla (m). */
export const ROD_LENGTH = 0.3;
export const ROD_DIAMETER = 0.008;
export const ROD_AREA = (Math.PI * ROD_DIAMETER * ROD_DIAMETER) / 4;
/** Temperatura del aire del salón (°C): promedio típico en Apartadó (Urabá antioqueño). */
export const AMBIENT_T = 28;
/** Temperatura a la que la parafina de la gota se ablanda y suelta la tachuela (°C). */
export const WAX_MELT_T = 55;
/** Convección natural del aire alrededor de un cilindro horizontal de 8 mm con ΔT ≈ 40 K (Churchill–Chu), W/(m²·K). */
export const H_CONV = 9.5;
/** Constante de Stefan–Boltzmann (W/(m²·K⁴)). */
export const STEFAN_BOLTZMANN = 5.670374419e-8;
/** Radiación linealizada de un cuerpo negro alrededor de 315 K: 4·σ·T̄³ ≈ 7,1 W/(m²·K). */
export const H_RAD_BLACK = 4 * STEFAN_BOLTZMANN * 315.15 ** 3;
/** Funda de icopor: espesor (m), conductividad (W/(m·K)) y emisividad de su superficie. */
export const SLEEVE = { thickness: 0.01, k: 0.04, emissivity: 0.9 };
/** Posiciones de las tachuelas (cm desde la pared del baño). */
export const TACK_SLOTS_CM = [3, 6, 9, 12, 15, 18, 21, 24, 27];
/** Duración del registro (s) y paso de las instantáneas guardadas (s). */
export const RUN_S = 1800;
export const SNAP_S = 5;
/** Malla de la solución numérica: número de intervalos y paso de tiempo (s). */
export const NODES = 60;
export const DT = 1;
/** Resolución de los termopares y del termómetro del baño (°C), de la regla (cm) y del cronómetro (s). */
export const TC_RES = 0.1;
export const RULER_RES = 0.1;
export const CLOCK_RES = 1;

export const CONDUCTION_LIMITS = {
  bathT: [40, 98] as [number, number],
  position: [0, 30] as [number, number],
  tacks: [0, TACK_SLOTS_CM.length] as [number, number],
  objectT: [5, 60] as [number, number],
};

export function findRod(id: string): Material & { id: RodId } {
  const m = RODS.find((r) => r.id === id);
  if (!m) throw new Error(`Varilla desconocida: ${id}`);
  return m;
}

export function findTouch(id: string): Material & { id: TouchId } {
  const m = TOUCH_MATERIALS.find((r) => r.id === id);
  if (!m) throw new Error(`Material desconocido: ${id}`);
  return m;
}

/* ------------------------------------------------------------------ propiedades derivadas */

/** Difusividad térmica α = k/(ρ·c) en m²/s. */
export function diffusivity(m: Pick<Material, 'k' | 'rho' | 'c'>): number {
  if (!(m.k > 0) || !(m.rho > 0) || !(m.c > 0)) throw new RangeError('k, ρ y c deben ser positivos.');
  return m.k / (m.rho * m.c);
}

/** Efusividad térmica e = √(k·ρ·c) en W·s^½/(m²·K). */
export function effusivity(m: Pick<Material, 'k' | 'rho' | 'c'>): number {
  if (!(m.k > 0) || !(m.rho > 0) || !(m.c > 0)) throw new RangeError('k, ρ y c deben ser positivos.');
  return Math.sqrt(m.k * m.rho * m.c);
}

/** Coeficiente de pérdidas de la superficie desnuda: convección natural + radiación linealizada (W/(m²·K)). */
export function bareLossCoefficient(emissivity: number): number {
  assertInRange('La emisividad', emissivity, 0, 1);
  return H_CONV + emissivity * H_RAD_BLACK;
}

/**
 * Coeficiente global de pérdidas por unidad de área de la superficie de la varilla (W/(m²·K)).
 * Con funda de icopor: resistencias en serie de la capa cilíndrica y de la superficie exterior,
 * U = 1 / [ r₁·ln(r₂/r₁)/k_funda + r₁/(r₂·h_ext) ].
 */
export function lossCoefficient(rod: Pick<Material, 'emissivity'>, cover: CoverId): number {
  if (cover === 'aire') return bareLossCoefficient(rod.emissivity);
  if (cover !== 'icopor') throw new Error(`Recubrimiento desconocido: ${cover}`);
  const r1 = ROD_DIAMETER / 2, r2 = r1 + SLEEVE.thickness;
  const hOut = bareLossCoefficient(SLEEVE.emissivity);
  return 1 / ((r1 * Math.log(r2 / r1)) / SLEEVE.k + r1 / (r2 * hOut));
}

/** Parámetro de la aleta m = √(h·P/(k·A)) = √(4·U/(k·D)) en 1/m. */
export function finParameter(U: number, k: number, D = ROD_DIAMETER): number {
  if (!(U >= 0) || !(k > 0) || !(D > 0)) throw new RangeError('Parámetros de la aleta no válidos.');
  return Math.sqrt((4 * U) / (k * D));
}

/** Ley de Fourier: flujo de calor q = −k·A·dT/dx (W). Positivo si el calor avanza hacia x creciente. */
export function fourierHeatFlow(k: number, area: number, dTdx: number): number {
  if (!(k > 0) || !(area > 0)) throw new RangeError('k y A deben ser positivos.');
  const q = -k * area * dTdx;
  return Object.is(q, -0) ? 0 : q;
}

/** Flujo de calor por unidad de área a través de una pared plana de espesor d (W/m²): q″ = k·ΔT/d. */
export function slabHeatFlux(k: number, thickness: number, deltaT: number): number {
  if (!(k > 0) || !(thickness > 0)) throw new RangeError('k y el espesor deben ser positivos.');
  return (k * deltaT) / thickness;
}

/**
 * Temperatura de contacto entre dos cuerpos semiinfinitos que se tocan (piel y objeto):
 * T_c = (e₁·T₁ + e₂·T₂)/(e₁ + e₂). Es la temperatura que «siente» la piel en el primer instante.
 */
export function contactTemperature(e1: number, T1: number, e2: number, T2: number): number {
  if (!(e1 > 0) || !(e2 > 0)) throw new RangeError('Las efusividades deben ser positivas.');
  return (e1 * T1 + e2 * T2) / (e1 + e2);
}

/** Temperatura de contacto de la piel (33 °C) con un material a la temperatura dada. */
export function skinContact(id: TouchId, objectT: number): number {
  assertInRange('La temperatura del objeto', objectT, ...CONDUCTION_LIMITS.objectT);
  return contactTemperature(effusivity(SKIN), SKIN.T, effusivity(findTouch(id)), objectT);
}

/* ------------------------------------------------------------------ estado estacionario exacto */

export interface FinParams { k: number; U: number; Utip: number; L: number; D: number; Tb: number; Tamb: number; }

/** Perfil estacionario exacto de la aleta con punta convectiva (°C). */
export function steadyTemperature(p: FinParams, x: number): number {
  const m = finParameter(p.U, p.k, p.D);
  const th0 = p.Tb - p.Tamb;
  if (m === 0) {
    // Sin pérdidas laterales: perfil lineal (o uniforme si la punta tampoco pierde calor).
    const s = p.Utip / p.k;
    return p.Tamb + th0 * (1 - (s * x) / (1 + s * p.L));
  }
  const r = p.Utip / (m * p.k);
  const num = Math.cosh(m * (p.L - x)) + r * Math.sinh(m * (p.L - x));
  const den = Math.cosh(m * p.L) + r * Math.sinh(m * p.L);
  return p.Tamb + (th0 * num) / den;
}

/** Calor (W) que entra por la base en estado estacionario: q_f = √(U·P·k·A)·θ₀·(senh mL + r·cosh mL)/(cosh mL + r·senh mL). */
export function steadyBaseHeatFlow(p: FinParams): number {
  const A = (Math.PI * p.D * p.D) / 4, P = Math.PI * p.D;
  const m = finParameter(p.U, p.k, p.D);
  const th0 = p.Tb - p.Tamb;
  if (m === 0) return (p.k * A * th0 * (p.Utip / p.k)) / (1 + (p.Utip / p.k) * p.L);
  const r = p.Utip / (m * p.k);
  return Math.sqrt(p.U * P * p.k * A) * th0 * (Math.sinh(m * p.L) + r * Math.cosh(m * p.L)) / (Math.cosh(m * p.L) + r * Math.sinh(m * p.L));
}

/* ------------------------------------------------------------------ solución numérica */

export interface RodProblem {
  k: number; rho: number; c: number;
  /** Coeficientes de pérdidas lateral y de la punta (W/(m²·K)). */
  U: number; Utip: number;
  L: number; D: number;
  Tb: number; Tamb: number;
}

/** Paso de tiempo máximo (s) del esquema explícito: Δt ≤ 1 / (2α/Δx² + 4U/(ρcD) + 2U_punta/(ρcΔx)), el nodo más exigente (la punta). */
export function explicitStableDt(p: RodProblem, nodes: number): number {
  const dx = p.L / nodes;
  const alpha = p.k / (p.rho * p.c);
  const beta = (4 * p.U) / (p.rho * p.c * p.D);
  const gamma = (2 * p.Utip) / (p.rho * p.c * dx);
  return 1 / ((2 * alpha) / (dx * dx) + beta + gamma);
}

/** Operador tridiagonal M de dθ/dt = M·θ + b para las incógnitas θ₁…θ_N (θ₀ es la temperatura del baño). */
function operator(p: RodProblem, nodes: number) {
  const dx = p.L / nodes;
  const a = p.k / (p.rho * p.c) / (dx * dx);
  const beta = (4 * p.U) / (p.rho * p.c * p.D);
  const gamma = (2 * p.Utip) / (p.rho * p.c * dx);
  const n = nodes; // incógnitas 1..N → índices 0..N−1
  const lo = new Float64Array(n), di = new Float64Array(n), up = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const tip = j === n - 1;
    lo[j] = j === 0 ? 0 : tip ? 2 * a : a;
    di[j] = -2 * a - beta - (tip ? gamma : 0);
    up[j] = tip ? 0 : a;
  }
  // Término del baño: solo en la primera ecuación, a·θ₀.
  const b0 = a * (p.Tb - p.Tamb);
  return { lo, di, up, b0, dx };
}

/** Algoritmo de Thomas para un sistema tridiagonal; c y d son memorias de trabajo de tamaño n. */
function thomas(lo: Float64Array, di: Float64Array, up: Float64Array, rhs: Float64Array, out: Float64Array, c: Float64Array, d: Float64Array): void {
  const n = di.length;
  c[0] = up[0] / di[0];
  d[0] = rhs[0] / di[0];
  for (let i = 1; i < n; i++) {
    const m = di[i] - lo[i] * c[i - 1];
    c[i] = up[i] / m;
    d[i] = (rhs[i] - lo[i] * d[i - 1]) / m;
  }
  out[n - 1] = d[n - 1];
  for (let i = n - 2; i >= 0; i--) out[i] = d[i] - c[i] * out[i + 1];
}

export interface RodSolution {
  problem: RodProblem;
  nodes: number;
  dx: number;
  dt: number;
  /** Instantes de las instantáneas (s) y temperaturas (°C) en los nodos x_i = i·Δx, i = 0…N. */
  times: number[];
  profiles: Float64Array[];
  /** Instante (s) en que cada tachuela de TACK_SLOTS_CM alcanza la temperatura de fusión de la cera; null si no cae. */
  tackFall: (number | null)[];
  /** Esquema numérico usado. */
  scheme: 'crank-nicolson' | 'explicito';
  /** Para el explícito: si Δt cumple el criterio de estabilidad. */
  stable: boolean;
}

export interface SolveOptions { nodes?: number; dt?: number; duration?: number; snapEvery?: number; scheme?: 'crank-nicolson' | 'explicito'; }

/** Resuelve la ecuación de la aleta desde T(x, 0) = T_amb. */
export function solveRod(p: RodProblem, opts: SolveOptions = {}): RodSolution {
  const nodes = opts.nodes ?? NODES;
  const dt = opts.dt ?? DT;
  const duration = opts.duration ?? RUN_S;
  const snapEvery = opts.snapEvery ?? SNAP_S;
  const scheme = opts.scheme ?? 'crank-nicolson';
  assertInRange('El número de intervalos de la malla', nodes, 4, 2000);
  assertInRange('El paso de tiempo', dt, 1e-4, 60);
  assertInRange('La duración', duration, 0, 86400);
  if (!(p.k > 0) || !(p.rho > 0) || !(p.c > 0) || !(p.L > 0) || !(p.D > 0) || !(p.U >= 0) || !(p.Utip >= 0)) throw new RangeError('Parámetros físicos no válidos.');
  const { lo, di, up, b0, dx } = operator(p, nodes);
  const n = nodes;
  let theta = new Float64Array(n); // θ = T − T_amb en los nodos 1..N
  let next = new Float64Array(n);
  const rhs = new Float64Array(n), wc = new Float64Array(n), wd = new Float64Array(n);
  const th0 = p.Tb - p.Tamb;
  const stable = scheme === 'crank-nicolson' || dt <= explicitStableDt(p, nodes) * (1 + 1e-12);

  const snap = (): Float64Array => {
    const out = new Float64Array(n + 1);
    out[0] = p.Tb;
    for (let j = 0; j < n; j++) out[j + 1] = theta[j] + p.Tamb;
    return out;
  };
  // En t = 0 el extremo x = 0 pasa a la temperatura del baño; el resto de la varilla está a T_amb.
  const times: number[] = [0];
  const profiles: Float64Array[] = [snap()];
  const slotNodes = TACK_SLOTS_CM.map((cm) => (cm / 100) / dx);
  const valueAt = (th: Float64Array, s: number) => {
    const i = Math.floor(s), f = s - i;
    const v = (k: number) => (k === 0 ? th0 : th[k - 1]);
    return i >= n ? th[n - 1] : v(i) + f * (v(i + 1) - v(i));
  };
  const meltTheta = WAX_MELT_T - p.Tamb;
  const tackFall: (number | null)[] = TACK_SLOTS_CM.map(() => null);
  const slotPrev = slotNodes.map((sn) => valueAt(theta, sn));

  /** (M·θ)_j + b_j */
  const applyM = (th: Float64Array, j: number) =>
    di[j] * th[j] + (j > 0 ? lo[j] * th[j - 1] : 0) + (j < n - 1 ? up[j] * th[j + 1] : 0) + (j === 0 ? b0 : 0);
  // Sistema implícito (I − w·h·M)·θⁿ⁺¹ = (I + (1 − w)·h·M)·θⁿ + h·b, con w = 1 (Euler implícito) o ½ (Crank–Nicolson).
  // La matriz de la izquierda no cambia: se arma una sola vez para cada (h, w).
  const implicit = (h: number, w: number) => {
    const L2 = new Float64Array(n), D2 = new Float64Array(n), U2 = new Float64Array(n);
    for (let j = 0; j < n; j++) { L2[j] = -w * h * lo[j]; D2[j] = 1 - w * h * di[j]; U2[j] = -w * h * up[j]; }
    return () => {
      for (let j = 0; j < n; j++) {
        // θ + (1 − w)·h·(Mθ) + w·h·b  (b completo: h·b repartido entre los dos niveles de tiempo da h·b)
        const mth = applyM(theta, j) - (j === 0 ? b0 : 0);
        rhs[j] = theta[j] + (1 - w) * h * mth + (j === 0 ? h * b0 : 0);
      }
      thomas(L2, D2, U2, rhs, next, wc, wd);
      [theta, next] = [next, theta];
    };
  };
  const explicitStep = () => {
    for (let j = 0; j < n; j++) next[j] = theta[j] + dt * applyM(theta, j);
    [theta, next] = [next, theta];
  };
  const startStep = implicit(dt / 2, 1);
  const cnStep = implicit(dt, 0.5);

  const steps = Math.round(duration / dt);
  const snapStride = Math.max(1, Math.round(snapEvery / dt));
  let t = 0;
  for (let s = 1; s <= steps; s++) {
    if (scheme === 'explicito') explicitStep();
    else if (s <= 2) { startStep(); startStep(); } // arranque de Rannacher: cuatro medios pasos de Euler implícito
    else cnStep();
    for (let i = 0; i < slotNodes.length; i++) {
      if (slotNodes[i] > n + 1e-9) continue;
      const v0 = slotPrev[i], v1 = valueAt(theta, slotNodes[i]);
      if (tackFall[i] === null && v0 < meltTheta && v1 >= meltTheta) tackFall[i] = t + (dt * (meltTheta - v0)) / (v1 - v0);
      slotPrev[i] = v1;
    }
    t += dt;
    if (s % snapStride === 0 || s === steps) { times.push(Number(t.toFixed(9))); profiles.push(snap()); }
  }
  return { problem: p, nodes, dx, dt, times, profiles, tackFall, scheme, stable };
}

/** Temperatura (°C) interpolada en la posición x (m) y el instante t (s), a partir de las instantáneas. */
export function temperatureAt(sol: RodSolution, x: number, t: number): number {
  const xs = Math.min(Math.max(x, 0), sol.problem.L) / sol.dx;
  const i = Math.min(sol.nodes - 1, Math.floor(xs)), fx = xs - i;
  const times = sol.times;
  const tc = Math.min(Math.max(t, 0), times[times.length - 1]);
  // Búsqueda binaria del intervalo de tiempo.
  let lo = 0, hi = times.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= tc) lo = mid; else hi = mid; }
  const ft = hi === lo ? 0 : (tc - times[lo]) / (times[hi] - times[lo]);
  const at = (k: number) => sol.profiles[k][i] + fx * (sol.profiles[k][i + 1] - sol.profiles[k][i]);
  return at(lo) + ft * (at(hi) - at(lo));
}

/* ------------------------------------------------------------------ práctica: varilla en el baño */

export interface ConductionInput {
  rod: RodId;
  cover: CoverId;
  /** Temperatura del baño (°C), fijada con la perilla del mechero. */
  bathT: number;
  ambient?: number;
}

export interface ConductionSim {
  input: Required<ConductionInput>;
  rod: Material & { id: RodId };
  problem: RodProblem;
  /** Difusividad (m²/s), efusividad, parámetro de la aleta m (1/m) y coeficiente de pérdidas U (W/(m²·K)). */
  alpha: number; effusivity: number; m: number; U: number;
  /** Constante de tiempo de las pérdidas ρ·c·D/(4U) (s) y tiempo de difusión L²/α (s). */
  tauLoss: number; tauDiff: number;
  solution: RodSolution;
  /** Calor (W) que entra por la base en estado estacionario. */
  qSteady: number;
}

export function rodProblem(input: ConductionInput): RodProblem {
  const rod = findRod(input.rod);
  assertInRange('La temperatura del baño', input.bathT, ...CONDUCTION_LIMITS.bathT);
  const ambient = input.ambient ?? AMBIENT_T;
  assertInRange('La temperatura del salón', ambient, 10, 40);
  return {
    k: rod.k, rho: rod.rho, c: rod.c,
    U: lossCoefficient(rod, input.cover), Utip: bareLossCoefficient(rod.emissivity),
    L: ROD_LENGTH, D: ROD_DIAMETER, Tb: input.bathT, Tamb: ambient,
  };
}

export function simulateConduction(input: ConductionInput, opts: SolveOptions = {}): ConductionSim {
  const rod = findRod(input.rod);
  const problem = rodProblem(input);
  const alpha = diffusivity(rod);
  const solution = solveRod(problem, opts);
  return {
    input: { ...input, ambient: problem.Tamb }, rod, problem, alpha, effusivity: effusivity(rod),
    m: finParameter(problem.U, rod.k), U: problem.U,
    tauLoss: (rod.rho * rod.c * ROD_DIAMETER) / (4 * problem.U), tauDiff: (ROD_LENGTH * ROD_LENGTH) / alpha,
    solution, qSteady: steadyBaseHeatFlow(problem),
  };
}

export const finParams = (p: RodProblem): FinParams => ({ k: p.k, U: p.U, Utip: p.Utip, L: p.L, D: p.D, Tb: p.Tb, Tamb: p.Tamb });

/** Lectura de un termopar o del termómetro del baño (0,1 °C). */
export const thermocoupleReading = (T: number) => roundToResolution(T, TC_RES);

/** Análisis del estudiante con dos termopares: gradiente (°C/cm) y flujo de Fourier (W) entre ellos. */
export function fourierFromProbes(k: number, xA_cm: number, TA: number, xB_cm: number, TB: number): { gradient: number; q: number } | null {
  const dx = xB_cm - xA_cm;
  if (Math.abs(dx) < 0.5) return null; // termopares demasiado cerca para un gradiente confiable
  const gradient = (TB - TA) / dx; // °C/cm
  return { gradient, q: fourierHeatFlow(k, ROD_AREA, gradient * 100) };
}

/** Resumen de las tachuelas: cuántas cayeron entre las n primeras y la posición de la más lejana caída. */
export function tackSummary(fall: (number | null)[], count: number): { fallen: number; farthest: number } {
  let fallen = 0, farthest = 0;
  for (let i = 0; i < Math.min(count, fall.length); i++) if (fall[i] !== null) { fallen++; farthest = TACK_SLOTS_CM[i]; }
  return { fallen, farthest };
}

/** Fichas de los instrumentos (misma forma que src/labs/instruments.ts), usadas como respaldo. */
export const CONDUCTION_INSTRUMENTS = [
  { id: 'termopar', name: 'Termopar tipo K con registrador (−50 a 400 °C)', quantity: 'Temperatura', unit: '°C', resolution: TC_RES, sigma: 0.3, note: 'Contacto térmico de la unión con la varilla (pasta térmica), unión fría del registrador y ruido eléctrico.' },
  { id: 'cronometro', name: 'Cronómetro (caída de las tachuelas)', quantity: 'Tiempo', unit: 's', resolution: CLOCK_RES, sigma: 1, relSigma: 0.05, note: 'Tamaño desigual de las gotas de cera y tiempo de reacción al ver caer la tachuela.' },
  { id: 'regla', name: 'Regla graduada en milímetros', quantity: 'Posición sobre la varilla', unit: 'cm', resolution: RULER_RES, sigma: 0.05, note: 'Alineación del cero con la pared del baño y paralaje.' },
];

export const conductionModelSpec: ModelSpec = {
  name: 'Conducción transitoria en una varilla con pérdidas laterales (ecuación de la aleta) resuelta con Crank–Nicolson',
  inputs: [
    { symbol: 'material', name: 'Material de la varilla (cobre, aluminio, latón, hierro, acero inoxidable, vidrio o madera)', unit: '—', initial: 'cobre' },
    { symbol: 'funda', name: 'Recubrimiento de la varilla: aire (desnuda) o funda de icopor de 1 cm', unit: '—', initial: 'aire' },
    { symbol: 'T_b', name: 'Temperatura del baño (perilla del mechero)', unit: '°C', range: CONDUCTION_LIMITS.bathT, initial: 90 },
    { symbol: 'x₁, x₂, x₃', name: 'Posición de los tres termopares sobre la varilla', unit: 'cm', range: CONDUCTION_LIMITS.position, initial: '5; 15; 25' },
    { symbol: 'n', name: 'Número de tachuelas pegadas con cera (cada 3 cm desde 3 cm)', unit: '—', range: CONDUCTION_LIMITS.tacks, initial: 9 },
    { symbol: 'T_obj', name: 'Temperatura del objeto que se toca (actividad de tacto)', unit: '°C', range: CONDUCTION_LIMITS.objectT, initial: 28 },
  ],
  outputs: [
    { symbol: 'T(x, t)', name: 'Temperatura a lo largo de la varilla durante 30 min (malla de 5 mm, Δt = 1 s)', unit: '°C' },
    { symbol: 'T₁, T₂, T₃', name: 'Lecturas de los termopares a los 30 min', unit: '°C' },
    { symbol: 't_caída', name: 'Tiempo de caída de cada tachuela (la cera llega a 55 °C)', unit: 's' },
    { symbol: 'q', name: 'Flujo de calor por la varilla entre los termopares 1 y 2 (ley de Fourier)', unit: 'W' },
    { symbol: 'α, e', name: 'Difusividad térmica α = k/(ρc) y efusividad e = √(kρc)', unit: 'mm²/s; W·s^½/(m²·K)' },
    { symbol: 'T_c', name: 'Temperatura de contacto piel–objeto', unit: '°C' },
  ],
  equations: [
    'Ley de Fourier: q = −k·A·dT/dx',
    'ρ·c·∂T/∂t = k·∂²T/∂x² − (4·U/D)·(T − T_amb)   (ecuación de la aleta: conducción + pérdidas laterales)',
    'T(0, t) = T_b;   −k·∂T/∂x(L, t) = U_punta·(T − T_amb);   T(x, 0) = T_amb',
    'U = h_conv + ε·4σT̄³ (desnuda);   con funda: U = 1/[r₁·ln(r₂/r₁)/k_icopor + r₁/(r₂·h_ext)]',
    'Estacionario: θ(x)/θ_b = [cosh m(L−x) + (U/mk)·senh m(L−x)]/[cosh mL + (U/mk)·senh mL],   m = √(4U/(kD))',
    'Crank–Nicolson: (I − ½Δt·M)·θⁿ⁺¹ = (I + ½Δt·M)·θⁿ + Δt·b;   explícito estable si Δt ≤ 1/(2α/Δx² + 4U/(ρcD) + 2U/(ρcΔx))',
    'α = k/(ρ·c);   tiempo de difusión ≈ x²/α',
    'Tacto: T_c = (e_piel·T_piel + e_obj·T_obj)/(e_piel + e_obj),   e = √(k·ρ·c)',
    'Pared plana: q″ = k·ΔT/d',
  ],
  initialConditions: [
    'Varilla de cobre de 30 cm y 8 mm de diámetro, desnuda, a la temperatura del salón (28 °C, Apartadó); baño de agua a 90 °C.',
    'Termopares a 5, 15 y 25 cm de la pared del baño; nueve tachuelas pegadas con parafina cada 3 cm (de 3 a 27 cm).',
    'En t = 0 la varilla se introduce en el baño, que el mechero mantiene a temperatura constante; el registro dura 30 min.',
  ],
  assumptions: [
    'Conducción unidimensional: la temperatura es uniforme en cada sección de la varilla (número de Biot h·r/k < 0,1 en los metales; en vidrio y madera, ≈ 0,05 y 0,3, aceptable para comparar).',
    'k, ρ y c constantes (valores a 25 °C de tablas). El extremo sumergido está exactamente a la temperatura del baño (contacto perfecto) y el baño no se enfría.',
    'Pérdidas laterales con un coeficiente constante: convección natural h = 9,5 W/(m²·K) (cilindro horizontal de 8 mm, Churchill–Chu) más radiación linealizada ε·4σT̄³ ≈ ε·7,1 W/(m²·K). Aire del salón quieto a 28 °C.',
    'La tachuela cae en el instante en que la superficie de la varilla bajo la gota llega a 55 °C (parafina de vela); se desprecian la masa de la gota y de la tachuela.',
    'Los termopares no perturban la varilla (unión pequeña con pasta térmica) y su lectura es la temperatura local.',
    'La funda de icopor (1 cm) cubre la superficie lateral; los agujeros por donde pasan las gotas de cera y los termopares no cambian las pérdidas. La punta queda descubierta.',
    'Tacto: piel y objeto se tratan como cuerpos semiinfinitos en contacto perfecto durante el primer segundo; la piel de la palma está a 33 °C.',
  ],
  limits: [
    'El coeficiente de convección real depende de la diferencia de temperatura (es mayor cerca del baño) y de corrientes de aire: con un ventilador las pérdidas pueden duplicarse.',
    'El vapor y el aire caliente que suben del baño calientan los primeros centímetros de la varilla; el modelo no lo incluye.',
    'La madera conduce unas dos veces mejor a lo largo de la fibra que a través de ella, y su k cambia mucho con la humedad; el vidrio y la madera violan un poco la hipótesis 1D.',
    'Con una funda delgada sobre una varilla delgada el aislamiento es menos eficaz de lo que se espera (radio crítico de aislamiento r_c = k/h ≈ 4 mm): el modelo lo calcula, pero no considera la conducción a lo largo de la propia funda.',
    'La temperatura de contacto vale para los primeros instantes; después la piel se enfría o calienta y la sangre aporta calor. La sensación térmica también depende de la textura y la humedad de la piel.',
    'Cerca del agua hirviendo la parafina, el aluminio y el latón no cambian de fase; no se modela la fusión de la madera ni su carbonización (no se usan llamas directas sobre la varilla).',
  ],
  testCases: [
    'Propiedades: α del cobre ≈ 117 mm²/s, del acero inoxidable ≈ 3,95 mm²/s y de la madera ≈ 0,36 mm²/s; efusividad del cobre ≈ 37 000 W·s^½/(m²·K).',
    'Ley de Fourier y pared plana con valores calculados a mano (q = k·A·ΔT/Δx).',
    'Tras varias constantes de tiempo, la solución de Crank–Nicolson coincide con el perfil estacionario exacto de la aleta y su flujo en la base con q_f.',
    'Sin pérdidas y a tiempos cortos coincide con la solución de un medio semiinfinito: θ/θ_b = erfc(x/(2√(αt))).',
    'El esquema explícito coincide con Crank–Nicolson si Δt cumple el criterio de estabilidad y diverge si lo excede en 50 %.',
    'Balance de energía: el calor que entra por la base es igual al almacenado más el perdido por la superficie.',
    'Orden de caída de las tachuelas: cobre antes que aluminio, latón, hierro y acero; en vidrio y madera no cae ninguna en 30 min.',
    'Temperatura de contacto: el cobre a 28 °C se siente casi a 28 °C, la madera a ≈ 31 °C y el icopor casi a 33 °C (más frío el metal).',
    'La funda de icopor reduce el coeficiente de pérdidas y calienta más la varilla; las entradas fuera de rango se rechazan.',
  ],
};

import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Magnetismo e inducción electromagnética (grado 11.º).
 *
 * 1. Campo magnético
 *    - Imán de barra modelado como dipolo puntual de momento m (A·m²) dirigido del polo S al polo N:
 *        B(r) = (μ₀/4π)·[3(m·r̂)r̂ − m]/r³   (las líneas cumplen r = C·sen²θ)
 *    - Solenoide finito de longitud L, radio a y n = N/L vueltas por metro con corriente I, calculado como una pila
 *      de espiras circulares (campo exacto de cada espira con las integrales elípticas completas K y E).
 *      En el centro de un solenoide largo, B → μ₀·n·I; en su eje, B = (μ₀·n·I/2)·(cos α₁ + cos α₂).
 * 2. Ley de Faraday–Lenz: un imán se mueve por el eje de una bobina de N vueltas (radio a, largo ℓ).
 *    El flujo de un dipolo a través de una espira coaxial de radio a a distancia z es exacto:
 *        Φ(z) = μ₀·m·a² / [2·(a² + z²)^{3/2}]
 *    El flujo enlazado se suma numéricamente sobre las vueltas repartidas a lo largo de la bobina,
 *        Λ(x) = Σ (N/K)·Φ(x_k − x),
 *    y la fem se obtiene derivando numéricamente el flujo enlazado en el tiempo: ε = −dΛ/dt.
 *    ∫ε dt = −ΔΛ = −N·ΔΦ̄ no depende de la rapidez: solo de la posición inicial y final.
 * 3. Generador de corriente alterna: bobina rectangular de N vueltas y área A que gira con rapidez angular ω en un
 *    campo uniforme B: ε(t) = N·B·A·ω·sen(ωt), con f = ω/2π = rpm/60 (generador de dos polos).
 * 4. Transformador ideal: V₂/V₁ = N₂/N₁ e I₁·V₁ = I₂·V₂ (sin pérdidas). Con corriente continua el flujo no cambia y V₂ = 0.
 */

/** Permeabilidad magnética del vacío (T·m/A). */
export const MU0 = 4e-7 * Math.PI;

/** Componente horizontal aproximada del campo magnético terrestre en Urabá (T); valor ilustrativo. */
export const EARTH_BH = 29e-6;

export type MagnetId = 'ferrita' | 'neodimio';
export interface MagnetSpec { id: MagnetId; name: string; short: string; moment: number; length: number; width: number; note: string }

/** Imanes de barra (momentos dipolares típicos de imanes escolares; ilustrativos). */
export const MAGNETS: Record<MagnetId, MagnetSpec> = {
  ferrita: { id: 'ferrita', name: 'Imán de barra de ferrita (6 cm)', short: 'Ferrita', moment: 1.2, length: 0.06, width: 0.014, note: 'Imán cerámico escolar: B_r ≈ 0,4 T y volumen ≈ 3,7 cm³.' },
  neodimio: { id: 'neodimio', name: 'Imán de barra de neodimio (6 cm)', short: 'Neodimio', moment: 3.6, length: 0.06, width: 0.014, note: 'Imán de NdFeB: unas tres veces más fuerte que el de ferrita del mismo tamaño.' },
};

/** Bobina de inducción (Faraday): radio medio y largo del devanado (m). Su centro está en x = 0. */
export const COIL = { radius: 0.02, length: 0.04 };

/** Solenoide del experimento de campo: largo y radio (m). */
export const SOLENOID = { length: 0.2, radius: 0.02 };

/** Recorrido del imán en la ley de Faraday: de x = −20 cm (fuera) al centro de la bobina (x = 0). */
export const FARADAY_PATH = { outside: -0.2, inside: 0 };

/** Generador: bobina rectangular de 5 cm × 4 cm. */
export const GENERATOR = { width: 0.05, height: 0.04, area: 0.05 * 0.04 };

/** Bombillo de linterna de 2,5 V y 0,3 A (resistencia en caliente ≈ 8,3 Ω). */
export const LAMP = { ratedV: 2.5, ratedI: 0.3, R: 2.5 / 0.3 };

export const IND_LIMITS = {
  turns: [50, 800] as [number, number],
  speed: [0.1, 1.0] as [number, number], // m/s
  current: [0, 3] as [number, number], // A
  solenoidTurns: [100, 800] as [number, number],
  probe: [-0.2, 0.2] as [number, number], // m
  rpm: [0, 1800] as [number, number],
  genTurns: [10, 200] as [number, number],
  genField: [0.05, 0.5] as [number, number], // T
  n1: [50, 2000] as [number, number],
  n2: [10, 4000] as [number, number],
  v1: [1, 240] as [number, number], // V
  load: [1, 1000] as [number, number], // Ω
  moment: [0.2, 6] as [number, number], // A·m²
};

export type IndInstrumentId = 'teslametro' | 'sensorFem' | 'multimetro';
export interface IndInstrumentSpec {
  id: string; name: string; quantity: string; unit: string;
  resolution: number; sigma?: number; relSigma?: number; nonNegative?: boolean; note: string;
}

/** Ficha de los instrumentos (coincide con la entrada sugerida para src/labs/instruments.ts). */
export const INDUCTION_INSTRUMENTS: Record<IndInstrumentId, IndInstrumentSpec> = {
  teslametro: { id: 'teslametro', name: 'Teslámetro con sonda Hall (0,01 mT)', quantity: 'Campo magnético en la punta de la sonda', unit: 'mT', resolution: 0.01, sigma: 0.02, relSigma: 0.02, note: 'Orientación del sensor Hall, deriva del cero y posición exacta de la punta.' },
  sensorFem: { id: 'sensorFem', name: 'Sensor de voltaje con registrador (1 mV, 2 000 muestras/s)', quantity: 'Fuerza electromotriz inducida en la bobina', unit: 'mV', resolution: 1, sigma: 2, relSigma: 0.02, note: 'Ruido eléctrico, rapidez no del todo constante de la mano y muestreo finito.' },
  multimetro: { id: 'multimetro', name: 'Multímetro digital en voltios CA (0,01 V)', quantity: 'Voltaje eficaz y pico', unit: 'V', resolution: 0.01, sigma: 0.01, relSigma: 0.01, nonNegative: true, note: 'El multímetro escolar mide bien solo ondas sinusoidales de 45 a 400 Hz.' },
};

/* ------------------------------------------------------------------ 1. campo magnético */

/**
 * Campo de un dipolo puntual en el origen con momento `moment` (A·m²) a lo largo de +x, en el punto (x, y) del plano
 * que contiene al eje (T). Signo de `moment`: positivo si el polo N apunta hacia +x.
 */
export function dipoleField(moment: number, x: number, y: number): { bx: number; by: number; b: number } {
  const r2 = x * x + y * y;
  if (!(r2 > 1e-12)) throw new RangeError('El campo de un dipolo puntual no está definido en su centro.');
  const r = Math.sqrt(r2);
  const k = (MU0 / (4 * Math.PI)) * moment / (r2 * r);
  const c = x / r; // cos θ respecto del eje del imán
  const bx = k * (3 * c * (x / r) - 1);
  const by = k * (3 * c * (y / r));
  return { bx, by, b: Math.hypot(bx, by) };
}

/** Campo de un dipolo en su eje a distancia r: B = μ₀·m/(2π·r³). */
export const dipoleAxialField = (moment: number, r: number) => (MU0 * moment) / (2 * Math.PI * Math.abs(r) ** 3);

/** Integrales elípticas completas K(k²) y E(k²) por la media aritmético-geométrica. */
export function ellipticKE(m: number): { K: number; E: number } {
  assertInRange('El parámetro elíptico m', m, 0, 1 - 1e-15);
  let a = 1, b = Math.sqrt(1 - m), c = Math.sqrt(m);
  let sum = 0.5 * c * c, pow = 0.5;
  for (let i = 0; i < 40 && Math.abs(c) > 1e-16; i++) {
    const an = (a + b) / 2, bn = Math.sqrt(a * b);
    c = (a - b) / 2;
    pow *= 2;
    sum += pow * c * c;
    a = an; b = bn;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - sum) };
}

/**
 * Campo de una espira circular de radio a con corriente I, centrada en el origen con eje z, en el punto
 * (z, ρ): componentes axial y radial (T). Fórmula exacta con integrales elípticas.
 */
export function loopField(a: number, I: number, z: number, rho: number): { bz: number; brho: number } {
  const r = Math.abs(rho);
  const q = (a + r) ** 2 + z * z;
  const m = Math.min(1 - 1e-12, (4 * a * r) / q);
  const { K, E } = ellipticKE(m);
  const d = (a - r) ** 2 + z * z;
  if (!(d > 1e-14)) throw new RangeError('El campo no está definido sobre el propio alambre de la espira.');
  const pre = (MU0 * I) / (2 * Math.PI * Math.sqrt(q));
  const bz = pre * (K + ((a * a - r * r - z * z) / d) * E);
  const brho = r < 1e-12 ? 0 : pre * (z / r) * (-K + ((a * a + r * r + z * z) / d) * E) * Math.sign(rho);
  return { bz, brho };
}

/** Número de espiras con que se discretiza el solenoide para calcular su campo fuera del eje. */
export const SOLENOID_SLICES = 60;

/**
 * Campo de un solenoide finito centrado en el origen y con eje x (largo L, radio a, `turns` vueltas, corriente I),
 * en el punto (x, y) del plano que contiene al eje: suma de SOLENOID_SLICES espiras equivalentes.
 */
export function solenoidField(I: number, turns: number, x: number, y: number, L = SOLENOID.length, a = SOLENOID.radius): { bx: number; by: number; b: number } {
  const K = SOLENOID_SLICES;
  const Ik = (I * turns) / K;
  let bx = 0, by = 0;
  for (let k = 0; k < K; k++) {
    const xk = -L / 2 + ((k + 0.5) * L) / K;
    // Evita evaluar exactamente sobre el alambre (la sonda no puede atravesar el devanado).
    const rho = Math.abs(Math.abs(y) - a) < 1e-4 ? y + 1e-4 * Math.sign(y || 1) : y;
    const f = loopField(a, Ik, x - xk, rho);
    bx += f.bz;
    by += f.brho;
  }
  return { bx, by, b: Math.hypot(bx, by) };
}

/** Campo en el eje de un solenoide finito: B = (μ₀·n·I/2)·(cos α₁ + cos α₂). */
export function solenoidAxisField(I: number, turns: number, x: number, L = SOLENOID.length, a = SOLENOID.radius): number {
  const n = turns / L;
  const c1 = (x + L / 2) / Math.hypot(x + L / 2, a);
  const c2 = (L / 2 - x) / Math.hypot(L / 2 - x, a);
  return (MU0 * n * I / 2) * (c1 + c2);
}

/** Solenoide ideal (infinitamente largo): B = μ₀·n·I. */
export function idealSolenoidField(turnsPerMeter: number, I: number): number {
  assertInRange('Las vueltas por metro', turnsPerMeter, 0, 1e6);
  assertInRange('La corriente', I, -1000, 1000);
  return MU0 * turnsPerMeter * I;
}

/** Lectura ideal del teslámetro (mT, resolución 0,01 mT). */
export const teslameterReading = (bTesla: number) => roundToResolution(bTesla * 1000, INDUCTION_INSTRUMENTS.teslametro.resolution);

/* ------------------------------------------------------------------ 2. ley de Faraday */

/** Flujo de un dipolo puntual (momento m a lo largo del eje) a través de una espira coaxial de radio a a distancia z (Wb). */
export function dipoleLoopFlux(moment: number, a: number, z: number): number {
  return (MU0 * moment * a * a) / (2 * (a * a + z * z) ** 1.5);
}

/**
 * El mismo flujo calculado por integración numérica de B_x sobre el disco de la espira (regla de Simpson en ρ).
 * Solo para comprobar la fórmula cerrada (válido si |z| > 0).
 */
export function dipoleLoopFluxNumeric(moment: number, a: number, z: number, steps = 400): number {
  if (!(Math.abs(z) > 1e-6)) throw new RangeError('La integración numérica necesita que el dipolo no esté en el plano de la espira.');
  const n = steps % 2 === 0 ? steps : steps + 1;
  const h = a / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const rho = i * h;
    const f = rho === 0 ? 0 : dipoleField(moment, z, rho).bx * 2 * Math.PI * rho;
    s += f * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
  }
  return (s * h) / 3;
}

/** Planos de vueltas con que se reparte la bobina a lo largo de su largo para sumar el flujo. */
export const COIL_SLICES = 41;

/**
 * Flujo enlazado Λ = Σ (N/K)·Φ por la bobina (centro en x = 0) cuando el centro del imán está en `xMagnet` (Wb).
 * `moment` con signo: positivo si el polo N apunta hacia la bobina (+x).
 */
export function coilLinkage(moment: number, turns: number, xMagnet: number, coil = COIL): number {
  let s = 0;
  for (let k = 0; k < COIL_SLICES; k++) {
    const xk = -coil.length / 2 + ((k + 0.5) * coil.length) / COIL_SLICES;
    s += dipoleLoopFlux(moment, coil.radius, xk - xMagnet);
  }
  return (turns / COIL_SLICES) * s;
}

export type Pole = 'N' | 'S';
export type Motion = 'introducir' | 'sacar';

export interface FaradayInput { magnet: MagnetId; pole: Pole; turns: number; speed: number; motion: Motion; moment?: number }

export interface FaradayRun {
  t: number[];
  x: number[];
  /** Flujo enlazado N·Φ̄ (Wb). */
  linkage: number[];
  /** fem (V). */
  emf: number[];
  dt: number;
  duration: number;
  /** Pico de la fem (V, con signo) y su instante (s). */
  peak: number;
  peakTime: number;
  /** ∫ε dt por la regla del trapecio (V·s = Wb). */
  area: number;
  /** −ΔΛ = −(Λ_final − Λ_inicial) (Wb): lo que debe dar el área. */
  minusDeltaLinkage: number;
  /** Tiempo de movimiento (s). */
  moveTime: number;
}

/** Signo del momento según el polo que mira a la bobina. */
export const signedMoment = (magnet: MagnetId, pole: Pole, moment?: number) => (moment ?? MAGNETS[magnet].moment) * (pole === 'N' ? 1 : -1);

/** Reposo antes y después del movimiento en cada corrida (s). */
export const FARADAY_REST = 0.05;
/** Muestras por segundo con que se simula la corrida (como el sensor de voltaje). */
export const FARADAY_RATE = 2000;

/** fem a partir de una trayectoria muestreada (tiempos y posiciones del imán): diferencias centradas de Λ. */
export function emfFromTrajectory(times: number[], xs: number[], moment: number, turns: number): { linkage: number[]; emf: number[] } {
  const n = Math.min(times.length, xs.length);
  const linkage = xs.slice(0, n).map((x) => coilLinkage(moment, turns, x));
  const emf = linkage.map((_, i) => {
    if (n < 2) return 0;
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    const dt = times[i1] - times[i0];
    return dt > 0 ? 0 - (linkage[i1] - linkage[i0]) / dt : 0;
  });
  return { linkage, emf };
}

/** Integral por trapecios. */
export function trapezoid(t: number[], y: number[]): number {
  let s = 0;
  for (let i = 1; i < Math.min(t.length, y.length); i++) s += 0.5 * (y[i] + y[i - 1]) * (t[i] - t[i - 1]);
  return s;
}

/** Corrida del imán a velocidad constante entre x = −20 cm y el centro de la bobina (o al revés). */
export function simulateFaraday(input: FaradayInput): FaradayRun {
  const { magnet, pole, turns, speed, motion } = input;
  assertInRange('El número de vueltas', turns, IND_LIMITS.turns[0], IND_LIMITS.turns[1]);
  assertInRange('La rapidez del imán', speed, IND_LIMITS.speed[0], IND_LIMITS.speed[1]);
  if (input.moment !== undefined) assertInRange('El momento magnético', input.moment, IND_LIMITS.moment[0], IND_LIMITS.moment[1]);
  const m = signedMoment(magnet, pole, input.moment);
  const x0 = motion === 'introducir' ? FARADAY_PATH.outside : FARADAY_PATH.inside;
  const x1 = motion === 'introducir' ? FARADAY_PATH.inside : FARADAY_PATH.outside;
  const moveTime = Math.abs(x1 - x0) / speed;
  const duration = moveTime + 2 * FARADAY_REST;
  const N = Math.round(duration * FARADAY_RATE);
  const dt = duration / N;
  const t: number[] = [], x: number[] = [];
  for (let i = 0; i <= N; i++) {
    const ti = i * dt;
    const u = Math.min(1, Math.max(0, (ti - FARADAY_REST) / moveTime));
    t.push(ti);
    x.push(x0 + (x1 - x0) * u);
  }
  const { linkage, emf } = emfFromTrajectory(t, x, m, turns);
  let pi = 0;
  for (let i = 1; i < emf.length; i++) if (Math.abs(emf[i]) > Math.abs(emf[pi])) pi = i;
  return {
    t, x, linkage, emf, dt, duration, moveTime,
    peak: emf[pi], peakTime: t[pi],
    area: trapezoid(t, emf),
    minusDeltaLinkage: -(linkage[linkage.length - 1] - linkage[0]),
  };
}

/** Valor interpolado de una serie muestreada en el instante t (acotado a los extremos). */
export function sampleSeries(t: number[], y: number[], at: number): number {
  const n = Math.min(t.length, y.length);
  if (n === 0) return 0;
  if (at <= t[0]) return y[0];
  if (at >= t[n - 1]) return y[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= at) lo = mid; else hi = mid; }
  const u = (at - t[lo]) / (t[hi] - t[lo] || 1);
  return y[lo] + (y[hi] - y[lo]) * u;
}

/* ------------------------------------------------------------------ 3. generador de CA */

export interface GeneratorInput { turns: number; field: number; rpm: number; area?: number }
export interface GeneratorResult {
  omega: number; frequency: number; period: number;
  /** fem pico N·B·A·ω y eficaz (V). */
  peak: number; rms: number;
  /** Corriente eficaz y potencia en el bombillo (A, W) y brillo relativo (0 a 1, 1 = potencia nominal). */
  lampCurrent: number; lampPower: number; brightness: number;
  /** Flujo máximo por vuelta B·A (Wb). */
  fluxMax: number;
}

export function generatorEmfAt(g: Pick<GeneratorResult, 'peak' | 'omega'>, t: number): number {
  return g.peak * Math.sin(g.omega * t);
}

export function simulateGenerator({ turns, field, rpm, area = GENERATOR.area }: GeneratorInput): GeneratorResult {
  assertInRange('Las vueltas de la bobina del generador', turns, IND_LIMITS.genTurns[0], IND_LIMITS.genTurns[1]);
  assertInRange('El campo del generador', field, IND_LIMITS.genField[0], IND_LIMITS.genField[1]);
  assertInRange('La rapidez de giro', rpm, IND_LIMITS.rpm[0], IND_LIMITS.rpm[1]);
  const omega = (2 * Math.PI * rpm) / 60;
  const frequency = rpm / 60;
  const peak = turns * field * area * omega;
  const rms = peak / Math.SQRT2;
  const lampCurrent = rms / LAMP.R;
  const lampPower = rms * lampCurrent;
  const rated = LAMP.ratedV * LAMP.ratedI;
  return {
    omega, frequency, period: frequency > 0 ? 1 / frequency : Infinity,
    peak, rms, lampCurrent, lampPower, brightness: Math.min(1, lampPower / rated), fluxMax: field * area,
  };
}

/** Rapidez de giro (rpm) de un generador con p polos para producir la frecuencia f: n = 120·f/p. */
export const synchronousRpm = (frequency: number, poles: number) => (120 * frequency) / poles;

/* ------------------------------------------------------------------ 4. transformador */

export type Source = 'ca' | 'cc';
export interface TransformerInput { n1: number; n2: number; v1: number; source: Source; load: number }
export interface TransformerResult { ratio: number; v2: number; i2: number; i1: number; p1: number; p2: number; kind: 'elevador' | 'reductor' | 'aislador' }

export function simulateTransformer({ n1, n2, v1, source, load }: TransformerInput): TransformerResult {
  assertInRange('Las vueltas del primario', n1, IND_LIMITS.n1[0], IND_LIMITS.n1[1]);
  assertInRange('Las vueltas del secundario', n2, IND_LIMITS.n2[0], IND_LIMITS.n2[1]);
  assertInRange('El voltaje del primario', v1, IND_LIMITS.v1[0], IND_LIMITS.v1[1]);
  assertInRange('La resistencia de la carga', load, IND_LIMITS.load[0], IND_LIMITS.load[1]);
  const ratio = n2 / n1;
  // Con corriente continua el flujo en el núcleo no cambia (después del instante de conexión): no hay inducción.
  const v2 = source === 'ca' ? v1 * ratio : 0;
  const i2 = v2 / load;
  const i1 = i2 * ratio;
  return { ratio, v2, i2, i1, p1: v1 * i1, p2: v2 * i2, kind: Math.abs(ratio - 1) < 1e-9 ? 'aislador' : ratio > 1 ? 'elevador' : 'reductor' };
}

/* ------------------------------------------------------------------ ficha del modelo */

export const inductionModelSpec: ModelSpec = {
  name: 'Campo magnético de imanes y solenoides, ley de Faraday–Lenz, generador de CA y transformador ideal',
  inputs: [
    { symbol: 'm', name: 'Momento dipolar del imán (ferrita 1,2 A·m²; neodimio 3,6 A·m²) y polo que mira a la bobina', unit: 'A·m²', range: IND_LIMITS.moment, initial: 1.2 },
    { symbol: 'I', name: 'Corriente del solenoide (20 cm de largo, 2 cm de radio)', unit: 'A', range: IND_LIMITS.current, initial: 2 },
    { symbol: 'N_s', name: 'Vueltas del solenoide', unit: '—', range: IND_LIMITS.solenoidTurns, initial: 400 },
    { symbol: '(x, y)', name: 'Posición de la sonda Hall respecto del centro del imán o del solenoide', unit: 'cm', range: [-20, 20], initial: '(10; 0)' },
    { symbol: 'N', name: 'Vueltas de la bobina de inducción (2 cm de radio, 4 cm de largo)', unit: '—', range: IND_LIMITS.turns, initial: 200 },
    { symbol: 'v', name: 'Rapidez constante del imán (de −20 cm al centro de la bobina, o al revés)', unit: 'm/s', range: IND_LIMITS.speed, initial: 0.5 },
    { symbol: 'n', name: 'Rapidez de giro del generador', unit: 'rpm', range: IND_LIMITS.rpm, initial: 600 },
    { symbol: 'N_g, B', name: 'Vueltas y campo del generador (bobina de 5 cm × 4 cm)', unit: '—, T', range: IND_LIMITS.genField, initial: '100; 0,20 T' },
    { symbol: 'N₁, N₂, V₁', name: 'Vueltas del primario y del secundario y voltaje eficaz del primario (CA de 60 Hz o CC)', unit: '—, —, V', range: IND_LIMITS.v1, initial: '400; 20; 120 V' },
  ],
  outputs: [
    { symbol: 'B', name: 'Campo magnético en la sonda (teslámetro, 0,01 mT) y orientación de las brújulas', unit: 'mT' },
    { symbol: 'Λ = N·Φ̄', name: 'Flujo enlazado por la bobina', unit: 'mWb' },
    { symbol: 'ε(t)', name: 'Fuerza electromotriz inducida (sensor de voltaje, 1 mV) y desvío del galvanómetro', unit: 'mV' },
    { symbol: '∫ε dt', name: 'Área bajo la curva de la fem', unit: 'mV·s' },
    { symbol: 'ε₀, ε_ef, f', name: 'fem pico y eficaz del generador y su frecuencia', unit: 'V, V, Hz' },
    { symbol: 'V₂, I₁, I₂', name: 'Voltaje del secundario y corrientes del transformador ideal', unit: 'V, A' },
  ],
  equations: [
    'Dipolo: B = (μ₀/4π)·[3(m·r̂)r̂ − m]/r³; en el eje, B = μ₀·m/(2π·r³)',
    'Solenoide ideal: B = μ₀·n·I, con n = N/L; solenoide finito en el eje: B = (μ₀·n·I/2)·(cos α₁ + cos α₂)',
    'Espira circular: campo exacto con integrales elípticas completas K y E; el solenoide es la suma de 60 espiras',
    'Flujo de un dipolo por una espira coaxial: Φ(z) = μ₀·m·a²/[2·(a² + z²)^{3/2}]',
    'Flujo enlazado: Λ(x) = Σ (N/41)·Φ(x_k − x) sobre 41 planos de vueltas',
    'Ley de Faraday–Lenz: ε = −dΛ/dt = −N·dΦ̄/dt (diferencias centradas a 2 000 muestras/s)',
    '∫ε dt = −ΔΛ = −N·ΔΦ̄ (no depende de la rapidez)',
    'Generador: ε(t) = N·B·A·ω·sen(ωt); ω = 2π·n/60; f = n/60; ε_ef = ε₀/√2',
    'Transformador ideal: V₂ = V₁·N₂/N₁; I₁ = I₂·N₂/N₁; V₁·I₁ = V₂·I₂',
  ],
  initialConditions: [
    'Campo: imán de ferrita con su centro en el origen y la sonda a 10 cm sobre su eje; solenoide de 400 vueltas con 2,0 A.',
    'Faraday: imán de ferrita con el polo N hacia una bobina de 200 vueltas, a 20 cm de su centro; rapidez 0,50 m/s.',
    'Generador: 100 vueltas en 0,20 T girando a 600 rpm. Transformador: 400 y 20 vueltas, 120 V de CA a 60 Hz y un bombillo de 6 V (12 Ω).',
  ],
  assumptions: [
    'El imán de barra se representa como un dipolo puntual en su centro: es exacto lejos del imán y aproximado a distancias comparables con su largo.',
    'El teslámetro se puso en cero lejos de los imanes: descuenta el campo terrestre. Las brújulas sí lo sienten (≈ 29 µT horizontales en Urabá, valor ilustrativo).',
    'La bobina de inducción se conecta a un medidor de alta resistencia: casi no circula corriente, así que la fuerza de Lenz sobre el imán es despreciable y el imán se mueve a la velocidad impuesta.',
    'Las vueltas de la bobina se reparten uniformemente a lo largo de 4 cm con el mismo radio medio (2 cm).',
    'Generador ideal: campo uniforme, sin resistencia de la bobina ni reacción del inducido; el bombillo es una resistencia fija de 8,3 Ω.',
    'Transformador ideal: acoplamiento perfecto y sin pérdidas (los reales tienen eficiencias del 95 % al 99 %).',
  ],
  limits: [
    'Dentro del imán el modelo de dipolo puntual no es válido; la sonda no puede entrar al imán ni al devanado del solenoide.',
    'El solenoide se calcula con 60 espiras equivalentes: muy cerca del alambre el campo calculado tiene rizado.',
    'Con el imán dentro de la bobina el flujo real depende de la forma del imán; el dipolo puntual da solo una aproximación.',
    'El galvanómetro tiene escala de ±1 000 mV: con fem mayores la aguja se sale de la escala.',
    'No se modelan las corrientes de Foucault, la histéresis del núcleo, la saturación del hierro ni la caída de voltaje en los alambres.',
    'Con corriente continua el transformador solo induce un pulso al conectar o desconectar; en régimen permanente V₂ = 0.',
  ],
  testCases: [
    'Dipolo: el campo axial vale el doble del ecuatorial a la misma distancia y decae como 1/r³; la fórmula vectorial coincide con μ₀·m/(2π·r³).',
    'Solenoide: en el centro de uno largo (L/a = 50) el campo de la suma de espiras se aproxima a μ₀·n·I; el finito coincide con (μ₀·n·I/2)(cos α₁ + cos α₂).',
    'Caso a mano: 400 vueltas en 20 cm con 2,0 A → μ₀·n·I = 5,027 mT; en el centro del solenoide finito, 4,929 mT.',
    'Flujo de un dipolo por una espira: la fórmula cerrada coincide con la integración numérica de B sobre el disco.',
    'Faraday: ∫ε dt = −ΔΛ y es igual a 0,2; 0,5 y 1,0 m/s; el pico crece con la rapidez y es proporcional a N; invertir el polo o el sentido invierte el signo.',
    'Generador: 100 vueltas, 0,20 T, 20 cm², 600 rpm → ε₀ = 2,513 V, f = 10 Hz; ε₀ es proporcional a la rapidez de giro.',
    'Transformador: 400 → 20 vueltas con 120 V → 6 V; potencia de entrada igual a la de salida; con CC, V₂ = 0.',
  ],
};

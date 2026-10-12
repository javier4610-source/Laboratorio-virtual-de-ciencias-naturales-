import { assertInRange, roundToResolution, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Péndulo simple (grado 10.º) con la ecuación NO lineal y amortiguamiento lineal opcional:
 *   θ'' = −(g/L)·sen θ − b·θ'
 * Se integra con Runge-Kutta de orden 4 (paso ≈ T₀/400). No se usa la aproximación sen θ ≈ θ,
 * de modo que el período crece ligeramente con la amplitud:
 *   T ≈ 2π√(L/g)·(1 + θ₀²/16 + 11θ₀⁴/3072)   (serie)
 *   T = 2π / (ω₀·AGM(1, cos(θ₀/2)))         (valor exacto sin amortiguamiento, con ω₀ = √(g/L))
 * La lenteja se trata como una masa puntual: L se mide desde el punto de suspensión hasta su centro.
 */

export const PEN_LIMITS = {
  length: [0.1, 2] as [number, number], // m
  mass: [20, 500] as [number, number], // g
  amplitude: [2, 80] as [number, number], // grados
};

/** Resolución de los instrumentos. */
export const RULER_RES = 0.001; // m (regla y cinta métrica: 1 mm)
export const PHOTOGATE_RES = 0.001; // s
export const STOPWATCH_RES = 0.01; // s
/** Tiempo de reacción humano al iniciar o detener el cronómetro (cada pulsación se retrasa entre 0,10 y 0,25 s). */
export const REACTION_DELAY: [number, number] = [0.1, 0.25];
/** Error máximo del intervalo cronometrado: diferencia entre los dos retrasos (±0,15 s). */
export const REACTION_ERROR = REACTION_DELAY[1] - REACTION_DELAY[0];
/** Oscilaciones que se cronometran con el cronómetro manual. */
export const OSCILLATIONS_TIMED = 10;

export interface Place { id: string; name: string; g: number; }
export const PLACES: Place[] = [
  { id: 'apartado', name: 'Apartadó (Urabá, nivel del mar)', g: 9.78 },
  { id: 'bogota', name: 'Bogotá (2600 m de altitud)', g: 9.77 },
  { id: 'luna', name: 'Luna', g: 1.62 },
  { id: 'marte', name: 'Marte', g: 3.71 },
];

export interface Damping { id: string; name: string; b: number; }
/** Coeficiente de amortiguamiento lineal b (s⁻¹), igual para cualquier lenteja (simplificación declarada). */
export const DAMPINGS: Damping[] = [
  { id: 'ninguno', name: 'Ideal (sin amortiguamiento)', b: 0 },
  { id: 'aire', name: 'Aire (amortiguamiento leve)', b: 0.004 },
  { id: 'aceite', name: 'Aleta sumergida en aceite', b: 0.25 },
];

export interface BobMaterial { id: string; name: string; density: number; color: string; }
/** Materiales de las lentejas: densidad en kg/m³ (valores típicos) y color para la ilustración. */
export const BOBS: BobMaterial[] = [
  { id: 'acero', name: 'Acero', density: 7850, color: '#8e9aa3' },
  { id: 'laton', name: 'Latón', density: 8500, color: '#c9a03a' },
  { id: 'aluminio', name: 'Aluminio', density: 2700, color: '#c3ccd2' },
  { id: 'madera', name: 'Madera', density: 700, color: '#a8723f' },
  { id: 'plastico', name: 'Plástico (PVC)', density: 1400, color: '#d0453a' },
];

function findById<T extends { id: string }>(list: T[], id: string, what: string): T {
  const x = list.find((i) => i.id === id);
  if (!x) throw new Error(`${what} desconocido: ${id}`);
  return x;
}
export const findPlace = (id: string) => findById(PLACES, id, 'Lugar');
export const findDamping = (id: string) => findById(DAMPINGS, id, 'Amortiguamiento');
export const findBob = (id: string) => findById(BOBS, id, 'Material');

/** Radio (m) de una lenteja esférica maciza de masa m (g) y densidad ρ (kg/m³). */
export function bobRadius(massG: number, density: number): number {
  return Math.cbrt((3 * (massG / 1000)) / (4 * Math.PI * density));
}

const deg = (d: number) => (d * Math.PI) / 180;

/** Período de pequeñas oscilaciones T₀ = 2π√(L/g). */
export function smallAnglePeriod(length: number, g: number): number {
  return 2 * Math.PI * Math.sqrt(length / g);
}

/** Corrección en serie: T ≈ T₀(1 + θ₀²/16 + 11θ₀⁴/3072), θ₀ en radianes. */
export function seriesPeriod(length: number, g: number, amplitudeDeg: number): number {
  const a = deg(amplitudeDeg);
  return smallAnglePeriod(length, g) * (1 + (a * a) / 16 + (11 * a ** 4) / 3072);
}

/** Media aritmético-geométrica. */
function agm(a: number, b: number): number {
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return (a + b) / 2;
}

/** Período exacto del péndulo no lineal sin amortiguamiento: T = T₀ / AGM(1, cos(θ₀/2)). */
export function exactPeriod(length: number, g: number, amplitudeDeg: number): number {
  return smallAnglePeriod(length, g) / agm(1, Math.cos(deg(amplitudeDeg) / 2));
}

/** Energía mecánica por unidad de masa (J/kg), con referencia en el punto más bajo. */
export function energyPerMass(length: number, g: number, theta: number, omega: number): number {
  return 0.5 * length * length * omega * omega + g * length * (1 - Math.cos(theta));
}

export interface PendulumInput {
  length: number; // m
  massG: number; // g
  amplitudeDeg: number; // grados
  placeId: string;
  dampingId: string;
}

export interface PendulumRun {
  g: number;
  b: number;
  dt: number;
  /** Muestras de la integración (t en s, θ en rad, ω en rad/s), una por paso. */
  t: number[];
  theta: number[];
  omega: number[];
  /** Instantes en que la lenteja pasa por el punto más bajo (θ = 0). */
  passages: number[];
  /** Fin de la simulación (un punto de retorno poco después del último paso medido). */
  tEnd: number;
  /** Fin de la medición con la fotopuerta (punto de retorno después del tercer paso). */
  tGateEnd: number;
  T0: number;
  Tseries: number;
  Texact: number;
}

/** Interpolación de Hermite cúbica de θ entre dos muestras (usa θ y ω en ambos extremos). */
function hermite(t0: number, y0: number, v0: number, t1: number, y1: number, v1: number, t: number): number {
  const h = t1 - t0;
  const s = (t - t0) / h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * v0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * v1;
}

/** Cruce por cero de θ entre dos muestras (bisección sobre el polinomio de Hermite). */
function crossingTime(t0: number, y0: number, v0: number, t1: number, y1: number, v1: number): number {
  let a = t0, b = t1, ya = y0;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    const ym = hermite(t0, y0, v0, t1, y1, v1, m);
    if (Math.sign(ym) === Math.sign(ya)) { a = m; ya = ym; } else b = m;
  }
  return (a + b) / 2;
}

/**
 * Integra el movimiento desde el reposo en θ₀ hasta registrar `passagesNeeded` pasos por el punto
 * más bajo (21 pasos = 10 oscilaciones completas) y un punto de retorno posterior.
 */
export function simulatePendulum(input: PendulumInput, passagesNeeded = 2 * OSCILLATIONS_TIMED + 1): PendulumRun {
  assertInRange('La longitud del péndulo', input.length, ...PEN_LIMITS.length);
  assertInRange('La masa de la lenteja', input.massG, ...PEN_LIMITS.mass);
  assertInRange('La amplitud', input.amplitudeDeg, ...PEN_LIMITS.amplitude);
  const { g } = findPlace(input.placeId);
  const { b } = findDamping(input.dampingId);
  const L = input.length;
  const k = g / L;
  const T0 = smallAnglePeriod(L, g);
  const dt = T0 / 400;
  const f = (th: number, om: number): [number, number] => [om, -k * Math.sin(th) - b * om];

  const t: number[] = [0], theta: number[] = [deg(input.amplitudeDeg)], omega: number[] = [0];
  const passages: number[] = [];
  let tGateEnd = NaN;
  let tEnd = NaN;
  const maxSteps = 400 * (passagesNeeded + 6);
  for (let i = 0; i < maxSteps; i++) {
    const th = theta[i], om = omega[i];
    const [a1, b1] = f(th, om);
    const [a2, b2] = f(th + (dt / 2) * a1, om + (dt / 2) * b1);
    const [a3, b3] = f(th + (dt / 2) * a2, om + (dt / 2) * b2);
    const [a4, b4] = f(th + dt * a3, om + dt * b3);
    const nth = th + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    const nom = om + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    const nt = (i + 1) * dt;
    t.push(nt); theta.push(nth); omega.push(nom);
    if (th !== 0 && Math.sign(nth) !== Math.sign(th)) passages.push(crossingTime(t[i], th, om, nt, nth, nom));
    const turning = om !== 0 && Math.sign(nom) !== Math.sign(om);
    if (turning && Number.isNaN(tGateEnd) && passages.length >= 3) tGateEnd = nt;
    // Margen para el retraso de reacción al detener el cronómetro.
    if (turning && passages.length >= passagesNeeded && nt > passages[passagesNeeded - 1] + REACTION_DELAY[1] + 0.05) { tEnd = nt; break; }
  }
  if (Number.isNaN(tEnd)) tEnd = t[t.length - 1];
  if (Number.isNaN(tGateEnd)) tGateEnd = tEnd;
  return {
    g, b, dt, t, theta, omega, passages, tEnd, tGateEnd,
    T0, Tseries: seriesPeriod(L, g, input.amplitudeDeg), Texact: exactPeriod(L, g, input.amplitudeDeg),
  };
}

/** Ángulo (rad) en el instante t, interpolado entre muestras (índices acotados). */
export function angleAt(run: PendulumRun, time: number): number {
  const n = run.t.length;
  const x = Math.max(0, Math.min(time, run.t[n - 1])) / run.dt;
  const i = Math.max(0, Math.min(n - 2, Math.floor(x)));
  return hermite(run.t[i], run.theta[i], run.omega[i], run.t[i + 1], run.theta[i + 1], run.omega[i + 1], Math.min(run.t[i + 1], Math.max(run.t[i], time)));
}

/** Amplitudes de los puntos de retorno sucesivos (rad) y sus instantes. */
export function turningPoints(run: PendulumRun): { t: number; amplitude: number }[] {
  const out: { t: number; amplitude: number }[] = [{ t: 0, amplitude: Math.abs(run.theta[0]) }];
  for (let i = 1; i < run.t.length - 1; i++) {
    const a = Math.abs(run.theta[i - 1]), c = Math.abs(run.theta[i]), d = Math.abs(run.theta[i + 1]);
    if (c >= a && c > d && run.omega[i - 1] !== 0 && Math.sign(run.omega[i + 1]) !== Math.sign(run.omega[i - 1])) {
      // Interpolación parabólica del máximo de |θ|.
      const den = a - 2 * c + d;
      const off = den !== 0 ? (0.5 * (a - d)) / den : 0;
      out.push({ t: run.t[i] + off * run.dt, amplitude: c - 0.25 * (a - d) * off });
    }
  }
  return out;
}

/** Período medido con la fotopuerta en el punto más bajo: del 1.er al 3.er paso de la lenteja (1 ms). */
export function photogatePeriod(run: PendulumRun): number {
  if (run.passages.length < 3) throw new Error('La lenteja no completó una oscilación.');
  return roundToResolution(run.passages[2] - run.passages[0], PHOTOGATE_RES);
}

export interface StopwatchMeasurement {
  /** Instante (s de simulación) en que el estudiante inicia y detiene el cronómetro. */
  startAt: number;
  stopAt: number;
  trueT10: number;
  error: number;
  /** Lectura del cronómetro (0,01 s). */
  reading: number;
}

/**
 * Cronometraje manual de 10 oscilaciones: se inicia al ver pasar la lenteja por el punto más bajo
 * y se detiene 20 pasos después. Cada pulsación se retrasa un tiempo de reacción aleatorio
 * (reproducible con la semilla), de modo que el error total queda entre −0,15 y +0,15 s.
 */
export function stopwatchTenOscillations(run: PendulumRun, seed: number): StopwatchMeasurement {
  const n = 2 * OSCILLATIONS_TIMED;
  if (run.passages.length < n + 1) throw new Error('La lenteja no completó 10 oscilaciones.');
  const rnd = seededRandom(seed);
  const [lo, hi] = REACTION_DELAY;
  const dStart = lo + (hi - lo) * rnd();
  const dStop = lo + (hi - lo) * rnd();
  const startAt = run.passages[0] + dStart;
  const stopAt = run.passages[n] + dStop;
  const trueT10 = run.passages[n] - run.passages[0];
  return { startAt, stopAt, trueT10, error: dStop - dStart, reading: roundToResolution(stopAt - startAt, STOPWATCH_RES) };
}

export interface PeriodAnalysis { period: number; frequency: number; period2: number; gCalculated: number; }

/** Magnitudes derivadas de un período medido: f = 1/T, T² y g = 4π²L/T². */
export function analyzePeriod(length: number, period: number): PeriodAnalysis {
  assertInRange('La longitud del péndulo', length, ...PEN_LIMITS.length);
  if (!(period > 0)) throw new RangeError('El período debe ser positivo.');
  return { period, frequency: 1 / period, period2: period * period, gCalculated: (4 * Math.PI ** 2 * length) / (period * period) };
}

export const pendulumModelSpec: ModelSpec = {
  name: 'Péndulo simple no lineal con amortiguamiento lineal (integración RK4)',
  inputs: [
    { symbol: 'L', name: 'Longitud (suspensión → centro de la lenteja)', unit: 'm', range: PEN_LIMITS.length, initial: 1 },
    { symbol: 'm', name: 'Masa de la lenteja', unit: 'g', range: PEN_LIMITS.mass, initial: 100 },
    { symbol: 'θ₀', name: 'Amplitud angular inicial', unit: '°', range: PEN_LIMITS.amplitude, initial: 10 },
    { symbol: 'g', name: 'Aceleración de la gravedad del lugar', unit: 'm/s²', initial: 'Apartadó, 9,78 m/s²' },
    { symbol: 'b', name: 'Coeficiente de amortiguamiento lineal', unit: 's⁻¹', initial: 'aire, 0,004 s⁻¹' },
  ],
  outputs: [
    { symbol: 'T', name: 'Período (fotopuerta, o t₁₀/10 con el cronómetro)', unit: 's' },
    { symbol: 't₁₀', name: 'Tiempo de 10 oscilaciones (cronómetro manual)', unit: 's' },
    { symbol: 'f', name: 'Frecuencia', unit: 'Hz' },
    { symbol: 'g_calc', name: 'Gravedad calculada 4π²L/T²', unit: 'm/s²' },
  ],
  equations: [
    'θ\'\' = −(g/L)·sen θ − b·θ\'  (integrada con RK4, paso T₀/400)',
    'Pequeñas oscilaciones: T₀ = 2π·√(L/g)',
    'Corrección por amplitud: T ≈ T₀·(1 + θ₀²/16 + 11·θ₀⁴/3072)',
    'Sin amortiguamiento: E/m = ½·L²·ω² + g·L·(1 − cos θ) = constante',
    'Con amortiguamiento lineal y amplitud pequeña: θ_máx(t) ≈ θ₀·e^(−b·t/2)',
    'T² = (4π²/g)·L  →  g = 4π²/pendiente de la gráfica T² contra L',
  ],
  initialConditions: ['La lenteja se suelta desde el reposo con θ = θ₀; L = 1,00 m, m = 100 g de acero, θ₀ = 10°, en Apartadó y con el aire como medio.'],
  assumptions: [
    'Hilo inextensible y sin masa; la lenteja es una masa puntual en el extremo (L se mide hasta su centro).',
    'El amortiguamiento es lineal en la velocidad angular y su coeficiente b no depende de la masa ni del material de la lenteja.',
    'La fotopuerta registra el paso del centro de la lenteja por el punto más bajo con resolución de 1 ms.',
    'El cronómetro manual (0,01 s) se inicia y se detiene con un retraso de reacción de 0,10 a 0,25 s en cada pulsación: el error del intervalo queda entre −0,15 y +0,15 s.',
    'La gravedad de cada lugar es un valor aproximado constante.',
  ],
  limits: [
    'No incluye el momento de inercia de la lenteja (péndulo físico) ni el empuje del aire; para lentejas grandes y hilos cortos el período real es algo mayor.',
    'En un péndulo real el amortiguamiento del aire depende de la forma, el tamaño y la masa de la lenteja; aquí se usa un valor típico fijo.',
    'El amortiguamiento cuadrático (arrastre a alta rapidez) no se modela.',
  ],
  testCases: [
    'Con 2° de amplitud, T coincide con 2π√(L/g) dentro de 0,1 %.',
    'El período no depende de la masa de la lenteja.',
    'A 60° el período es cerca de 7 % mayor que T₀, como predice la serie.',
    'T² es proporcional a L.',
    'Sin amortiguamiento, la energía mecánica se conserva (error numérico < 0,1 %).',
    'Con la aleta en aceite, la amplitud decae exponencialmente con constante b/2.',
    'En la Luna, el período es √(9,78/1,62) veces el de Apartadó.',
    'El error del cronómetro manual es reproducible con la semilla y no supera ±0,15 s.',
  ],
};

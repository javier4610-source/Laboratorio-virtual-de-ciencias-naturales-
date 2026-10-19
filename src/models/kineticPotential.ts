import { assertInRange, roundToResolution } from './math';
import { GRAVITY_PRESETS, type GravityPreset } from './energyTime';
import type { ModelSpec } from './types';

/**
 * Energía cinética y energía potencial (grado 8.º): de qué dependen y cómo se miden.
 *
 * Estación 1 · Energía cinética. Un carrito sobre un riel de aire HORIZONTAL (sin rozamiento en el caso ideal) sale del
 * lanzador con rapidez v₀ y recorre s = 0,60 m hasta una fotopuerta. Una bandera de ancho L = 5,00 cm bloquea el haz durante
 * Δt; la rapidez medida es v = L/Δt y Ec = ½·m·v².
 *   Con rozamiento (modo avanzado) la desaceleración es a = μ·g:  v² = v₀² − 2·μ·g·d;  E_disipada = μ·m·g·d.
 *
 * Estación 2 · Energía potencial gravitatoria. Un torno sube despacio (con velocidad constante) un objeto colgado de un sensor
 * de fuerza hasta una altura h sobre el haz de una fotopuerta (nivel de referencia, Ep = 0). El sensor marca F = m·g y el
 * trabajo del torno es W = F·h = m·g·h = Ep. Un electroimán lo suelta desde el reposo y la fotopuerta mide su rapidez:
 *   sin aire:  v = √(2·g·h);  t(y) = √(2y/g)
 *   con resistencia cuadrática del aire F = c·v² (modo avanzado), con v_t² = m·g/c:
 *     v²(y) = v_t²·(1 − e^(−2·g·y/v_t²));   t(y) = (v_t/g)·arccosh(e^(g·y/v_t²));   y(t) = (v_t²/g)·ln cosh(g·t/v_t)
 *   El tiempo de bloqueo es exacto: Δt = t(h + L/2) − t(h − L/2) (la bandera se centra en el haz al caer h).
 *
 * Estación 3 · Energía potencial elástica. Un resorte de constante k, comprimido x, lanza el carrito por el mismo riel.
 *   Ep_elástica = ½·k·x² = ½·F·x (F = k·x, sensor de fuerza en la base del resorte).  Sin rozamiento: ½·m·v² = ½·k·x².
 *   Con rozamiento: q(t) = −a − (x − a)·cos ωt, a = μ·m·g/k, ω = √(k/m), hasta q = 0 (largo natural); luego como la estación 1.
 *
 * Este archivo no depende de React ni del navegador.
 */

export { GRAVITY_PRESETS };
export type { GravityPreset };

/** Densidad aproximada del aire en la superficie (kg/m³): escala la resistencia del aire en cada lugar. */
export const AIR_DENSITY: Record<GravityPreset, number> = { tierra: 1.2, luna: 0, marte: 0.02 };
export const PLACE_LABEL: Record<GravityPreset, string> = { tierra: 'Tierra', luna: 'Luna', marte: 'Marte' };

/** Ancho de la bandera que interrumpe el haz de la fotopuerta (m). */
export const FLAG_WIDTH = 0.05;
/** Distancia del punto de salida del carrito (lanzador o largo natural del resorte) al haz de la fotopuerta (m). */
export const GATE_DISTANCE = 0.6;

/** Carrito del riel de aire con pesas de 100 g. */
export const CART = { mass: 0.2, slotMass: 0.1, maxSlots: 8 };

/** Resortes del lanzador (constantes nominales en N/m). */
export const SPRINGS: { id: string; k: number; name: string }[] = [
  { id: 'suave', k: 25, name: 'Resorte suave (25 N/m)' },
  { id: 'medio', k: 50, name: 'Resorte medio (50 N/m)' },
  { id: 'duro', k: 100, name: 'Resorte duro (100 N/m)' },
];

export const KP_LIMITS = {
  cartMass: [0.2, 1.0] as [number, number], // kg
  launchSpeed: [0.1, 2.0] as [number, number], // m/s
  dropMass: [0.1, 2.0] as [number, number], // kg
  height: [0.2, 10.0] as [number, number], // m
  compression: [0.005, 0.1] as [number, number], // m
  k: [10, 200] as [number, number], // N/m
  mu: [0, 0.05] as [number, number], // rozamiento del riel (soplador débil o apagado)
  drag: [0, 0.02] as [number, number], // c en aire terrestre (kg/m)
};

/** Capacidad del sensor de fuerza (N). */
export const FORCE_SENSOR_MAX = 50;

export type KpInstrumentId = 'balanza' | 'fotopuerta' | 'cinta' | 'fuerza' | 'regla' | 'lanzador';

export interface KpInstrumentSpec {
  id: string; name: string; quantity: string; unit: string;
  resolution: number; sigma?: number; relSigma?: number; nonNegative?: boolean; note: string;
}

/** Ficha de los instrumentos (coincide con la entrada sugerida para src/labs/instruments.ts). */
export const KP_INSTRUMENTS: Record<KpInstrumentId, KpInstrumentSpec> = {
  balanza: { id: 'balanza', name: 'Balanza digital (0,1 g)', quantity: 'Masa del carrito o del objeto', unit: 'g', resolution: 0.1, sigma: 0.05, nonNegative: true, note: 'Corrientes de aire y posición del objeto en el plato.' },
  fotopuerta: { id: 'fotopuerta', name: 'Fotopuerta con temporizador (0,01 ms)', quantity: 'Tiempo de bloqueo de la bandera de 5,00 cm', unit: 'ms', resolution: 0.01, sigma: 0.01, relSigma: 0.002, nonNegative: true, note: 'La electrónica es precisa; dominan la alineación de la bandera con el haz y el ancho efectivo del haz.' },
  cinta: { id: 'cinta', name: 'Cinta métrica de 10 m (1 mm)', quantity: 'Altura h sobre el haz de la fotopuerta', unit: 'm', resolution: 0.001, sigma: 0.0015, nonNegative: true, note: 'Cinta que no queda del todo vertical o tensa y paralaje al leer la marca.' },
  fuerza: { id: 'fuerza', name: 'Sensor de fuerza digital (±50 N, 0,01 N)', quantity: 'Fuerza del torno al subir el objeto o fuerza del resorte comprimido', unit: 'N', resolution: 0.01, sigma: 0.01, relSigma: 0.003, nonNegative: true, note: 'Ruido del sensor y pequeñas oscilaciones del objeto al subirlo.' },
  regla: { id: 'regla', name: 'Regla del lanzador (1 mm)', quantity: 'Compresión x del resorte', unit: 'cm', resolution: 0.1, sigma: 0.05, nonNegative: true, note: 'Alinear el borde del carrito con la marca y paralaje.' },
  lanzador: { id: 'lanzador', name: 'Lanzador de rapidez regulable', quantity: 'Rapidez real de salida (no se lee: la mide la fotopuerta)', unit: 'm/s', resolution: 0.001, relSigma: 0.01, note: 'El empujador no entrega siempre la misma rapidez: varía cerca de 1 % entre lanzamientos.' },
};

/* ------------------------------------------------------------------ energías básicas */

function positive(name: string, v: number) {
  if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${name} debe ser un número positivo.`);
}

/** Energía cinética Ec = ½·m·v² (J). */
export function kineticEnergy(mass: number, speed: number): number {
  positive('La masa', mass);
  if (!Number.isFinite(speed)) throw new RangeError('La rapidez debe ser un número válido.');
  return 0.5 * mass * speed * speed;
}

/** Energía potencial gravitatoria Ep = m·g·h (J), medida desde el nivel de referencia (h puede ser negativa). */
export function gravitationalPE(mass: number, g: number, height: number): number {
  positive('La masa', mass);
  positive('La gravedad', g);
  if (!Number.isFinite(height)) throw new RangeError('La altura debe ser un número válido.');
  return mass * g * height;
}

/** Energía potencial elástica Ep = ½·k·x² (J). */
export function elasticPE(k: number, x: number): number {
  positive('La constante del resorte', k);
  if (!Number.isFinite(x)) throw new RangeError('La deformación debe ser un número válido.');
  return 0.5 * k * x * x;
}

/** Rapidez que corresponde a una energía cinética: v = √(2·Ec/m). */
export function speedFromKE(mass: number, energy: number): number {
  positive('La masa', mass);
  if (!(energy >= 0)) throw new RangeError('La energía cinética no puede ser negativa.');
  return Math.sqrt((2 * energy) / mass);
}

/** Rapidez al caer h desde el reposo sin aire: v = √(2·g·h). No depende de la masa. */
export function fallSpeed(g: number, height: number): number {
  positive('La gravedad', g);
  if (!(height >= 0)) throw new RangeError('La altura no puede ser negativa.');
  return Math.sqrt(2 * g * height);
}

/** Rapidez de salida de un lanzador de resorte sin rozamiento: v = x·√(k/m). */
export function springLaunchSpeed(k: number, x: number, mass: number): number {
  positive('La constante del resorte', k);
  positive('La masa', mass);
  if (!(x >= 0)) throw new RangeError('La compresión no puede ser negativa.');
  return x * Math.sqrt(k / mass);
}

/** Tiempo de bloqueo de una bandera de ancho L que pasa con rapidez constante v: Δt = L/v. */
export function gateTime(width: number, speed: number): number {
  positive('El ancho de la bandera', width);
  positive('La rapidez', speed);
  return width / speed;
}

/** Rapidez media durante el bloqueo: v = L/Δt. */
export function gateSpeed(width: number, dt: number): number {
  positive('El ancho de la bandera', width);
  positive('El tiempo de bloqueo', dt);
  return width / dt;
}

/** Masa del carrito con n pesas de 100 g. */
export function cartMass(slots: number): number {
  if (!Number.isInteger(slots) || slots < 0 || slots > CART.maxSlots) throw new RangeError(`El número de pesas debe ser un entero entre 0 y ${CART.maxSlots}.`);
  return Number((CART.mass + slots * CART.slotMass).toFixed(6));
}

/* ------------------------------------------------------------------ movimiento con desaceleración constante */

/** Instante en que se recorre d con rapidez inicial v0 y desaceleración a ≥ 0 (null si se detiene antes). */
function timeToDistance(v0: number, a: number, d: number): number | null {
  if (d <= 0) return 0;
  if (a === 0) return v0 > 0 ? d / v0 : null;
  const disc = v0 * v0 - 2 * a * d;
  if (disc < 0) return null;
  // t = (v0 − √disc)/a, escrita en forma estable para a pequeña.
  return (2 * d) / (v0 + Math.sqrt(disc));
}

export interface TrackRun {
  /** Rapidez al salir (m/s). */
  v0: number;
  /** Desaceleración por rozamiento μ·g (m/s²). */
  decel: number;
  /** ¿El centro de la bandera llega al haz y la bandera lo atraviesa por completo? */
  reachesGate: boolean;
  /** Rapidez cuando el centro de la bandera cruza el haz (m/s). */
  vGate: number | null;
  /** Instante en que el centro de la bandera cruza el haz, medido desde la salida (s). */
  tGate: number | null;
  /** Tiempo de bloqueo exacto (s). */
  dtGate: number | null;
  /** Distancia hasta detenerse si no llega (m, desde la salida). */
  stopDistance: number | null;
}

/** Recorrido desde la salida hasta la fotopuerta con desaceleración constante. */
export function trackRun(v0: number, mu: number, g: number, distance = GATE_DISTANCE, width = FLAG_WIDTH): TrackRun {
  const a = mu * g;
  const tIn = timeToDistance(v0, a, distance - width / 2);
  const tMid = timeToDistance(v0, a, distance);
  const tOut = timeToDistance(v0, a, distance + width / 2);
  const reaches = tIn !== null && tMid !== null && tOut !== null;
  const stop = a > 0 ? (v0 * v0) / (2 * a) : null;
  return {
    v0, decel: a, reachesGate: reaches,
    vGate: reaches ? Math.sqrt(Math.max(0, v0 * v0 - 2 * a * distance)) : null,
    tGate: reaches ? tMid : null,
    dtGate: reaches ? tOut! - tIn! : null,
    stopDistance: reaches ? null : stop,
  };
}

/* ------------------------------------------------------------------ estación 1: energía cinética */

export interface CartInput { mass: number; launchSpeed: number; mu?: number; g?: number }

export interface CartResult {
  mass: number;
  run: TrackRun;
  /** Ec al salir del lanzador (J). */
  ek0: number;
  /** Ec cuando la bandera cruza el haz (J). */
  ekGate: number | null;
  /** Energía disipada por rozamiento hasta la fotopuerta (J). */
  heatGate: number;
}

export function simulateCart(input: CartInput): CartResult {
  assertInRange('La masa del carrito', input.mass, ...KP_LIMITS.cartMass);
  assertInRange('La rapidez de lanzamiento', input.launchSpeed, ...KP_LIMITS.launchSpeed);
  const mu = input.mu ?? 0;
  assertInRange('El coeficiente de rozamiento', mu, ...KP_LIMITS.mu);
  const g = input.g ?? GRAVITY_PRESETS.tierra;
  const run = trackRun(input.launchSpeed, mu, g);
  const ek0 = 0.5 * input.mass * input.launchSpeed ** 2;
  return {
    mass: input.mass, run, ek0,
    ekGate: run.vGate === null ? null : 0.5 * input.mass * run.vGate ** 2,
    heatGate: run.reachesGate ? mu * input.mass * g * GATE_DISTANCE : ek0,
  };
}

/** Estado del carrito en el instante t después de salir (s): posición desde la salida, rapidez y energías. */
export function cartStateAt(r: CartResult, t: number) {
  const { v0, decel } = r.run;
  const tStop = decel > 0 ? v0 / decel : Infinity;
  const tt = Math.max(0, Math.min(t, tStop));
  const v = Math.max(0, v0 - decel * tt);
  const x = v0 * tt - 0.5 * decel * tt * tt;
  const ek = 0.5 * r.mass * v * v;
  return { x, v, ek, ep: 0, heat: r.ek0 - ek };
}

/* ------------------------------------------------------------------ estación 2: energía potencial gravitatoria */

export interface DropInput {
  mass: number;
  height: number;
  place: GravityPreset;
  /** Coeficiente de arrastre c en aire terrestre (kg/m); se escala con la densidad del aire del lugar. */
  drag?: number;
}

export interface DropResult {
  mass: number; height: number; g: number;
  /** c efectivo en el lugar (kg/m). */
  c: number;
  /** Rapidez terminal √(m·g/c) (m/s); null sin aire. */
  vTerminal: number | null;
  ep0: number;
  /** Fuerza del torno al subir despacio (N) y trabajo F·h (J). */
  liftForce: number; liftWork: number;
  vGate: number; tGate: number; dtGate: number;
  ekGate: number;
  /** Energía disipada por el aire hasta la fotopuerta (J). */
  heatGate: number;
}

/** Tiempo para caer y desde el reposo. */
export function fallTime(g: number, y: number, c = 0, mass = 1): number {
  if (y <= 0) return 0;
  if (c <= 0) return Math.sqrt((2 * y) / g);
  const vt2 = (mass * g) / c, vt = Math.sqrt(vt2);
  const z = (g * y) / vt2;
  // arccosh(e^z) = ln(e^z + √(e^{2z} − 1)), escrita con expm1/log1p para que no pierda precisión con c pequeño.
  return (vt / g) * Math.log1p(Math.expm1(z) + Math.sqrt(Math.expm1(2 * z)));
}

/** Rapidez después de caer y desde el reposo. */
export function fallSpeedAt(g: number, y: number, c = 0, mass = 1): number {
  if (y <= 0) return 0;
  if (c <= 0) return Math.sqrt(2 * g * y);
  const vt2 = (mass * g) / c;
  return Math.sqrt(vt2 * -Math.expm1((-2 * g * y) / vt2));
}

export function simulateDrop(input: DropInput): DropResult {
  assertInRange('La masa del objeto', input.mass, ...KP_LIMITS.dropMass);
  assertInRange('La altura', input.height, ...KP_LIMITS.height);
  if (!(input.place in GRAVITY_PRESETS)) throw new Error(`Lugar desconocido: ${input.place}`);
  const drag = input.drag ?? 0;
  assertInRange('El coeficiente de arrastre', drag, ...KP_LIMITS.drag);
  const g = GRAVITY_PRESETS[input.place];
  const c = drag * (AIR_DENSITY[input.place] / AIR_DENSITY.tierra);
  const { mass: m, height: h } = input;
  const L = FLAG_WIDTH;
  const vGate = fallSpeedAt(g, h, c, m);
  const ekGate = 0.5 * m * vGate * vGate;
  const ep0 = m * g * h;
  return {
    mass: m, height: h, g, c,
    vTerminal: c > 0 ? Math.sqrt((m * g) / c) : null,
    ep0, liftForce: m * g, liftWork: m * g * h,
    vGate, tGate: fallTime(g, h, c, m),
    dtGate: fallTime(g, h + L / 2, c, m) - fallTime(g, h - L / 2, c, m),
    ekGate, heatGate: ep0 - ekGate,
  };
}

/** Estado del objeto t segundos después de soltarlo: distancia caída, altura sobre el haz, rapidez y energías. */
export function dropStateAt(r: DropResult, t: number) {
  const tt = Math.max(0, t);
  let fallen: number, v: number;
  if (r.c > 0) {
    const vt = r.vTerminal!, u = (r.g * tt) / vt;
    fallen = ((vt * vt) / r.g) * Math.log1p(2 * Math.sinh(u / 2) ** 2);
    v = vt * Math.tanh(u);
  } else {
    fallen = 0.5 * r.g * tt * tt;
    v = r.g * tt;
  }
  const y = r.height - fallen;
  const ep = r.mass * r.g * y, ek = 0.5 * r.mass * v * v;
  return { fallen, y, v, ep, ek, heat: r.ep0 - ep - ek };
}

/* ------------------------------------------------------------------ estación 3: energía potencial elástica */

export interface SpringInput { mass: number; k: number; compression: number; mu?: number; g?: number }

export interface SpringResult {
  mass: number; k: number; x: number; mu: number; g: number;
  /** Energía elástica almacenada ½·k·x² (J) y fuerza del resorte comprimido k·x (N). */
  epElastic: number; holdForce: number;
  /** ¿El carrito llega a separarse del resorte (largo natural)? */
  separates: boolean;
  tSep: number | null; vSep: number | null;
  run: TrackRun | null;
  ekGate: number | null;
  heatGate: number | null;
}

export function simulateSpring(input: SpringInput): SpringResult {
  assertInRange('La masa del carrito', input.mass, ...KP_LIMITS.cartMass);
  assertInRange('La constante del resorte', input.k, ...KP_LIMITS.k);
  assertInRange('La compresión del resorte', input.compression, ...KP_LIMITS.compression);
  const mu = input.mu ?? 0;
  assertInRange('El coeficiente de rozamiento', mu, ...KP_LIMITS.mu);
  const g = input.g ?? GRAVITY_PRESETS.tierra;
  const { mass: m, k, compression: x } = input;
  const a = (mu * m * g) / k; // desplazamiento del punto de equilibrio por el rozamiento
  const w = Math.sqrt(k / m);
  // Se separa del resorte si ½·k·x > μ·m·g (x > 2a): la energía ½k(x² − ξ²) − μmg(x − ξ) es positiva hasta ξ = 0.
  const separates = x > 2 * a;
  const tSep = separates ? (mu === 0 ? Math.PI / (2 * w) : Math.acos(-a / (x - a)) / w) : null;
  const vSep = separates ? Math.sqrt(Math.max(0, (k * x * x - 2 * mu * m * g * x) / m)) : null;
  const run = vSep !== null ? trackRun(vSep, mu, g) : null;
  const vg = run?.vGate ?? null;
  const ep = 0.5 * k * x * x;
  return {
    mass: m, k, x, mu, g, epElastic: ep, holdForce: k * x, separates, tSep, vSep, run,
    ekGate: vg === null ? null : 0.5 * m * vg * vg,
    heatGate: run?.reachesGate ? mu * m * g * (x + GATE_DISTANCE) : null,
  };
}

/** Estado del carrito t segundos después de soltar el pestillo: posición (m, 0 = largo natural), rapidez y energías. */
export function springStateAt(r: SpringResult, t: number) {
  const { mass: m, k, x, mu, g } = r;
  const a = (mu * m * g) / k, w = Math.sqrt(k / m);
  const tt = Math.max(0, t);
  if (!r.separates) {
    // Se detiene con el resorte aún comprimido (en ωt = π): q = −a + (x − a)·… con la amplitud x − a.
    const tStop = Math.PI / w;
    const s = Math.min(tt, tStop);
    const q = -a - (x - a) * Math.cos(w * s);
    const v = (x - a) * w * Math.sin(w * s);
    const ep = 0.5 * k * q * q, ek = 0.5 * m * v * v;
    return { q, v, ep, ek, heat: r.epElastic - ep - ek };
  }
  if (tt <= r.tSep!) {
    const q = -a - (x - a) * Math.cos(w * tt);
    const v = (x - a) * w * Math.sin(w * tt);
    const ep = 0.5 * k * q * q, ek = 0.5 * m * v * v;
    return { q, v, ep, ek, heat: r.epElastic - ep - ek };
  }
  const v0 = r.vSep!, dec = mu * g, s = tt - r.tSep!;
  const tStop = dec > 0 ? v0 / dec : Infinity;
  const ss = Math.min(s, tStop);
  const v = Math.max(0, v0 - dec * ss);
  const q = v0 * ss - 0.5 * dec * ss * ss;
  const ek = 0.5 * m * v * v;
  return { q, v, ep: 0, ek, heat: r.epElastic - ek };
}

/* ------------------------------------------------------------------ lo que calcula el estudiante con sus lecturas */

/** Con la masa (g) y el tiempo de bloqueo (ms): rapidez, v² y Ec. */
export function fromGateReadings(massG: number, dtMs: number, width = FLAG_WIDTH) {
  positive('La masa', massG);
  positive('El tiempo de bloqueo', dtMs);
  const v = width / (dtMs / 1000);
  const m = massG / 1000;
  return { v, v2: v * v, ek: 0.5 * m * v * v };
}

/** Cifras significativas de una lectura escrita con su resolución (p. ej., 3,57 → 3; 25,00 → 4). */
export function significantDigits(reading: number, resolution: number): number {
  if (!(reading > 0)) return 1;
  const decimals = Math.max(0, Math.ceil(-Math.log10(resolution) - 1e-9));
  const intDigits = Math.floor(Math.log10(reading)) + 1;
  return Math.max(1, intDigits + decimals);
}

/** Lecturas ideales (modelo redondeado a la resolución). */
export function idealReading(value: number, id: KpInstrumentId): number {
  return roundToResolution(value, KP_INSTRUMENTS[id].resolution);
}

/* ------------------------------------------------------------------ ficha del modelo */

export const kineticPotentialModelSpec: ModelSpec = {
  name: 'Energía cinética, potencial gravitatoria y potencial elástica: dependencias y medición',
  inputs: [
    { symbol: 'm', name: 'Masa del carrito (200 g + pesas de 100 g) o del objeto que cae', unit: 'kg', range: [0.1, 2], initial: 0.5 },
    { symbol: 'v₀', name: 'Rapidez de salida del lanzador (estación 1)', unit: 'm/s', range: KP_LIMITS.launchSpeed, initial: 0.5 },
    { symbol: 'h', name: 'Altura sobre el haz de la fotopuerta (estación 2)', unit: 'm', range: KP_LIMITS.height, initial: 2 },
    { symbol: 'g', name: 'Gravedad del lugar: Tierra 9,81; Luna 1,62; Marte 3,71', unit: 'm/s²', initial: 9.81 },
    { symbol: 'k', name: 'Constante del resorte del lanzador: 25, 50 o 100', unit: 'N/m', initial: 50 },
    { symbol: 'x', name: 'Compresión del resorte (estación 3)', unit: 'm', range: KP_LIMITS.compression, initial: 0.05 },
    { symbol: 'μ', name: 'Rozamiento del riel (modo avanzado)', unit: '—', range: KP_LIMITS.mu, initial: 0 },
    { symbol: 'c', name: 'Coeficiente de arrastre del aire, F = c·v² (modo avanzado)', unit: 'kg/m', range: KP_LIMITS.drag, initial: 0 },
  ],
  outputs: [
    { symbol: 'Δt', name: 'Tiempo de bloqueo de la bandera de 5,00 cm (fotopuerta, 0,01 ms)', unit: 'ms' },
    { symbol: 'v = L/Δt', name: 'Rapidez medida', unit: 'm/s' },
    { symbol: 'Ec', name: 'Energía cinética ½·m·v²', unit: 'J' },
    { symbol: 'F, W = F·h', name: 'Fuerza del torno (sensor, 0,01 N) y trabajo hecho al subir el objeto', unit: 'N, J' },
    { symbol: 'Ep', name: 'Energía potencial gravitatoria m·g·h y elástica ½·k·x²', unit: 'J' },
    { symbol: 'E_dis', name: 'Energía disipada por rozamiento o por el aire (modo avanzado)', unit: 'J' },
  ],
  equations: [
    'Ec = ½·m·v²  (doble rapidez → cuatro veces la energía cinética; doble masa → doble)',
    'Ep = m·g·h, con h medida desde el nivel de referencia (el haz de la fotopuerta)',
    'Trabajo para subir despacio: W = F·h = m·g·h = Ep',
    'Caída sin aire: m·g·h = ½·m·v²  →  v = √(2·g·h), sin depender de m',
    'Ep elástica = ½·k·x² = ½·F·x, con F = k·x;  sin rozamiento ½·m·v² = ½·k·x²  →  v = x·√(k/m)',
    'Fotopuerta: v = L/Δt con L = 5,00 cm;  Δt = t(h + L/2) − t(h − L/2) en la caída',
    'Rozamiento del riel: v² = v₀² − 2·μ·g·d;  E_dis = μ·m·g·d  (estación 3: d = x + 0,60 m)',
    'Aire: v² = v_t²·(1 − e^(−2gh/v_t²)), v_t = √(m·g/c);  E_dis = m·g·h − ½·m·v²',
    'Conservación: Ec + Ep + E_disipada = constante',
  ],
  initialConditions: [
    'Estación 1: carrito de 500 g (200 g + 3 pesas) lanzado a 0,50 m/s; fotopuerta a 0,60 m de la salida.',
    'Estación 2: objeto de 1,00 kg a 2,00 m sobre el haz en la Tierra (g = 9,81 m/s²); se suelta desde el reposo.',
    'Estación 3: resorte de 50 N/m comprimido 5,0 cm; carrito de 500 g.',
    'Caso de referencia: m = 1 kg, h = 10 m, g = 9,81 m/s² → Ep = 98,1 J y v = √(2·9,81·10) = 14,007 m/s.',
  ],
  assumptions: [
    'El riel es horizontal y, con el soplador encendido, sin rozamiento (μ = 0 salvo en el modo avanzado).',
    'Los cuerpos se tratan como partículas: no se cuenta la energía de rotación de ruedas ni del objeto.',
    'El torno sube el objeto despacio y con velocidad constante: la fuerza de la cuerda es igual al peso m·g.',
    'El electroimán suelta el objeto desde el reposo; la bandera queda centrada en el haz al caer h.',
    'El resorte es ideal (ley de Hooke, F = k·x) y sin masa; el carrito se separa al alcanzar el largo natural.',
    'El rozamiento del riel es cinético y constante (μ·m·g); la resistencia del aire es cuadrática (c·v²) y se escala con la densidad del aire del lugar (Tierra 1,2; Marte 0,020; Luna 0 kg/m³).',
    'g es uniforme en toda la altura (10 m es muy poco frente al radio de la Tierra).',
  ],
  limits: [
    'No hay un riel ni una torre reales: las lecturas salen del modelo, redondeadas a la resolución o con ruido sintético (modo «Instrumento real»).',
    'La rapidez L/Δt es una media durante el bloqueo; en la caída es algo menor que √(2gh): la diferencia relativa es ≈ (L/4h)²/2, 0,2 % con h = 0,20 m y menos de 0,01 % con h ≥ 1 m.',
    'Si el resorte se comprime más allá de su rango elástico la ley de Hooke deja de valer; aquí x ≤ 10 cm.',
    'El modelo de arrastre cuadrático es una aproximación: el coeficiente real depende de la forma, de la rapidez y del giro del objeto.',
    'No incluye el choque contra la caja de arena ni el tope final: allí la energía cinética se transforma en energía térmica y sonido.',
  ],
  testCases: [
    'Caso de referencia calculado a mano: 1 kg, 10 m, g = 9,81 → Ep = 98,1 J, F = 9,81 N, W = 98,1 J, v = 14,007 m/s, Δt = 3,570 ms.',
    'Ec ∝ v²: doble rapidez → cuatro veces Ec; Ec ∝ m a rapidez fija.',
    'La rapidez de caída no depende de la masa sin aire; con aire, el objeto más pesado llega un poco más rápido.',
    'Ep elástica: ½·k·x² = ½·m·v² sin rozamiento; con rozamiento la diferencia es μ·m·g·(x + s).',
    'Conservación: Ec + Ep + E_dis es constante en todo instante de las tres estaciones.',
    'Tiempo de fotopuerta: Δt = L/v con rapidez constante y Δt exacto en caída libre.',
    'Las entradas fuera de rango se rechazan y los casos límite (no llega a la fotopuerta, no se separa del resorte) se detectan.',
  ],
};

import { assertInRange, roundToResolution, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Movimiento de proyectiles (grado 10.º, nivel universitario introductorio).
 * Lanzador de laboratorio sobre una mesa de altura ajustable; la esfera sale de la boca
 * del lanzador (punto de lanzamiento) a una altura h sobre el piso donde cae.
 *
 *   Modelo ideal (sin aire):  x = v0·cosθ·t,   y = h + v0·senθ·t − g·t²/2
 *   Tiempo de vuelo:          t_v = [v0·senθ + √((v0·senθ)² + 2gh)] / g
 *   Alcance:                  R = v0·cosθ·t_v      (si h = 0: R = v0²·sen2θ / g)
 *   Altura máxima (piso):     H = h + (v0·senθ)² / (2g)   (si θ > 0)
 *
 *   Con resistencia del aire (arrastre cuadrático):
 *     F_D = ½·ρ·C_d·A·v²  opuesta a la velocidad  →  a = −g·ĵ − (k/m)·|v|·v,   k = ½ρC_dA
 *   Se integra con Runge-Kutta de orden 4 (paso 1 ms) y se interpola linealmente el impacto (y = 0).
 */

export const G = 9.8; // m/s²
export const RHO_AIR = 1.2; // kg/m³
export const CD_SPHERE = 0.47; // coeficiente de arrastre de una esfera lisa (Re ~ 10⁴–10⁵)
export const DT = 0.001; // s, paso de integración RK4

/** Resoluciones de los instrumentos. */
export const TAPE_RES = 0.001; // m, cinta métrica (1 mm)
export const GATE_RES = 0.01; // m/s, fotopuerta en la boca del lanzador
export const TIMER_RES = 0.001; // s, cronómetro de la fotopuerta + placa de impacto
export const STROBE_DT = 0.05; // s entre destellos de la fotografía estroboscópica
export const STROBE_SCALE_RES = 0.01; // m, escala vertical de fondo en la fotografía (1 cm)
/** Radio útil del recipiente del reto «Acierta al blanco» (m). */
export const TARGET_RADIUS = 0.05;

export const PROJECTILE_LIMITS = {
  v0: [2, 12] as [number, number],
  angle: [0, 90] as [number, number],
  height: [0, 1.5] as [number, number],
};

/** Niveles del resorte del lanzador (rapidez de salida nominal, calibrada). */
export interface SpringLevel { id: 'corto' | 'medio' | 'largo'; name: string; v0: number; }
export const SPRING_LEVELS: SpringLevel[] = [
  { id: 'corto', name: 'Corto', v0: 3.0 },
  { id: 'medio', name: 'Medio', v0: 4.5 },
  { id: 'largo', name: 'Largo', v0: 6.0 },
];

/** Esferas de 25,4 mm de diámetro (caben en el tubo del lanzador). Masas calculadas con densidades reales. */
export interface Sphere { id: string; name: string; mass: number; diameter: number; density: number; color: string; }
export const SPHERES: Sphere[] = [
  // acero: 7850 kg/m³ × 8,58 cm³ ≈ 67,4 g
  { id: 'acero', name: 'Acero', mass: 0.0674, diameter: 0.0254, density: 7850, color: '#9aa7ad' },
  // plástico (ABS/nailon): ≈ 1050 kg/m³ → ≈ 9,0 g
  { id: 'plastico', name: 'Plástico', mass: 0.009, diameter: 0.0254, density: 1050, color: '#e0533d' },
  // icopor (poliestireno expandido): ≈ 23 kg/m³ → ≈ 0,20 g
  { id: 'icopor', name: 'Icopor', mass: 0.0002, diameter: 0.0254, density: 23, color: '#f4f1e8' },
];

export function findSphere(id: string): Sphere {
  const s = SPHERES.find((x) => x.id === id);
  if (!s) throw new Error(`Esfera desconocida: ${id}`);
  return s;
}

export interface ShotInput {
  v0: number; // m/s
  angle: number; // grados sobre la horizontal
  height: number; // m, boca del lanzador sobre el piso
  sphereId: string;
  air: boolean; // true = con resistencia del aire
}

export interface TrajPoint { t: number; x: number; y: number; }

export interface ShotResult {
  flightTime: number; // s (modelo)
  range: number; // m (modelo)
  maxHeight: number; // m sobre el piso (modelo)
  apexTime: number; // s
  impactSpeed: number; // m/s
  impactAngle: number; // grados bajo la horizontal
  /** Trayectoria muestreada cada 0,01 s (incluye el punto de impacto). */
  path: TrajPoint[];
  /** Posiciones de la fotografía estroboscópica (cada 0,05 s, desde t = 0). */
  strobe: TrajPoint[];
  /** Lecturas de los instrumentos. */
  v0Reading: number; // fotopuerta, 0,01 m/s
  rangeReading: number; // cinta métrica, 1 mm
  timeReading: number; // cronómetro, 1 ms
  maxHeightReading: number; // imagen más alta de la estroboscopía sobre escala de 1 cm
  /** Alcance del modelo ideal con las mismas condiciones (para comparar). */
  idealRange: number;
}

function validate(input: ShotInput): Sphere {
  assertInRange('La rapidez de salida', input.v0, ...PROJECTILE_LIMITS.v0);
  assertInRange('El ángulo de lanzamiento', input.angle, ...PROJECTILE_LIMITS.angle);
  assertInRange('La altura de lanzamiento', input.height, ...PROJECTILE_LIMITS.height);
  return findSphere(input.sphereId);
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Tiempo de vuelo ideal (s). */
export function idealFlightTime(v0: number, angleDeg: number, h: number): number {
  const vy = v0 * Math.sin(rad(angleDeg));
  return (vy + Math.sqrt(vy * vy + 2 * G * h)) / G;
}

/** Alcance ideal (m). */
export function idealRange(v0: number, angleDeg: number, h: number): number {
  return v0 * Math.cos(rad(angleDeg)) * idealFlightTime(v0, angleDeg, h);
}

/** Altura máxima ideal sobre el piso (m). */
export function idealMaxHeight(v0: number, angleDeg: number, h: number): number {
  const vy = v0 * Math.sin(rad(angleDeg));
  return h + (vy * vy) / (2 * G);
}

/** Ángulo de máximo alcance ideal: tanθ* = v0/√(v0² + 2gh) (45° si h = 0). */
export function idealOptimalAngle(v0: number, h: number): number {
  return deg(Math.atan(v0 / Math.sqrt(v0 * v0 + 2 * G * h)));
}

/** Máximo alcance ideal (m) para v0 y h: R* = (v0/g)·√(v0² + 2gh). */
export function idealMaxRange(v0: number, h: number): number {
  return (v0 / G) * Math.sqrt(v0 * v0 + 2 * G * h);
}

/** Estado ideal (posición y velocidad) en el instante t. */
export function idealState(v0: number, angleDeg: number, h: number, t: number) {
  const a = rad(angleDeg);
  const vx = v0 * Math.cos(a), vy0 = v0 * Math.sin(a);
  return { x: vx * t, y: h + vy0 * t - 0.5 * G * t * t, vx, vy: vy0 - G * t };
}

/** Energía mecánica (J) por encima del nivel del piso. */
export function mechanicalEnergy(mass: number, y: number, vx: number, vy: number): number {
  return 0.5 * mass * (vx * vx + vy * vy) + mass * G * y;
}

/**
 * Ángulos (grados, 0–90) con los que el modelo ideal cae a la distancia D.
 * De y(D) = 0 con u = tanθ:  k·u² − D·u + (k − h) = 0,  k = g·D²/(2v0²).
 */
export function idealAnglesToHit(v0: number, h: number, D: number): number[] {
  if (D <= 0) return [];
  const k = (G * D * D) / (2 * v0 * v0);
  const disc = D * D - 4 * k * (k - h);
  if (disc < 0) return [];
  const r = Math.sqrt(disc);
  const roots = [(D - r) / (2 * k), (D + r) / (2 * k)].map((u) => deg(Math.atan(u))).filter((a) => a >= 0 && a <= 90);
  return [...new Set(roots.map((a) => Number(a.toFixed(6))))].sort((p, q) => p - q);
}

type State = [number, number, number, number];

function dragDerivs(kOverM: number) {
  return (s: State): State => {
    const v = Math.hypot(s[2], s[3]);
    return [s[2], s[3], -kOverM * v * s[2], -G - kOverM * v * s[3]];
  };
}

function rk4(f: (s: State) => State, s: State, dt: number): State {
  const k1 = f(s);
  const k2 = f([s[0] + (dt * k1[0]) / 2, s[1] + (dt * k1[1]) / 2, s[2] + (dt * k1[2]) / 2, s[3] + (dt * k1[3]) / 2]);
  const k3 = f([s[0] + (dt * k2[0]) / 2, s[1] + (dt * k2[1]) / 2, s[2] + (dt * k2[2]) / 2, s[3] + (dt * k2[3]) / 2]);
  const k4 = f([s[0] + dt * k3[0], s[1] + dt * k3[1], s[2] + dt * k3[2], s[3] + dt * k3[3]]);
  return [0, 1, 2, 3].map((i) => s[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as State;
}

/** Constante k/m del arrastre (1/m) para una esfera. */
export function dragPerMass(sphere: Sphere): number {
  const area = Math.PI * (sphere.diameter / 2) ** 2;
  return (0.5 * RHO_AIR * CD_SPHERE * area) / sphere.mass;
}

/** Rapidez terminal (m/s) de la esfera en caída libre con arrastre cuadrático. */
export function terminalSpeed(sphere: Sphere): number {
  return Math.sqrt(G / dragPerMass(sphere));
}

interface Core { flightTime: number; range: number; maxHeight: number; apexTime: number; vxImpact: number; vyImpact: number; path: TrajPoint[]; strobe: TrajPoint[]; }

function sampleTimes(tf: number, step: number): number[] {
  const n = Math.floor(tf / step + 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => Number((i * step).toFixed(6)));
}

function coreIdeal(v0: number, angle: number, h: number): Core {
  const tf = idealFlightTime(v0, angle, h);
  const vy0 = v0 * Math.sin(rad(angle));
  const pos = (t: number): TrajPoint => { const s = idealState(v0, angle, h, t); return { t, x: s.x, y: Math.max(0, s.y) }; };
  const path = sampleTimes(tf, 0.01).map(pos);
  if (path[path.length - 1].t < tf) path.push(pos(tf));
  const end = idealState(v0, angle, h, tf);
  return {
    flightTime: tf, range: end.x, maxHeight: idealMaxHeight(v0, angle, h), apexTime: vy0 / G,
    vxImpact: end.vx, vyImpact: end.vy, path, strobe: sampleTimes(tf, STROBE_DT).map(pos),
  };
}

function coreDrag(v0: number, angle: number, h: number, sphere: Sphere): Core {
  const a = rad(angle);
  const f = dragDerivs(dragPerMass(sphere));
  let s: State = [0, h, v0 * Math.cos(a), v0 * Math.sin(a)];
  let t = 0;
  let maxY = h, apexT = 0;
  const path: TrajPoint[] = [{ t: 0, x: 0, y: h }];
  const strobe: TrajPoint[] = [{ t: 0, x: 0, y: h }];
  const pathEvery = Math.round(0.01 / DT), strobeEvery = Math.round(STROBE_DT / DT);
  if (h === 0 && s[3] <= 0) {
    return { flightTime: 0, range: 0, maxHeight: 0, apexTime: 0, vxImpact: s[2], vyImpact: s[3], path, strobe };
  }
  for (let i = 1; i < 200000; i++) {
    const next = rk4(f, s, DT);
    if (next[1] <= 0) {
      // Interpolación lineal del impacto dentro del último paso.
      const frac = s[1] / (s[1] - next[1]);
      const tf = t + frac * DT;
      const lerp = (k: number) => s[k] + frac * (next[k] - s[k]);
      const range = lerp(0);
      path.push({ t: tf, x: range, y: 0 });
      return { flightTime: tf, range, maxHeight: maxY, apexTime: apexT, vxImpact: lerp(2), vyImpact: lerp(3), path, strobe };
    }
    s = next; t = i * DT;
    if (s[1] > maxY) { maxY = s[1]; apexT = t; }
    if (i % pathEvery === 0) path.push({ t, x: s[0], y: s[1] });
    if (i % strobeEvery === 0) strobe.push({ t, x: s[0], y: s[1] });
  }
  throw new Error('La integración no terminó (vuelo demasiado largo).');
}

/** Simula un disparo y entrega los valores del modelo y las lecturas de los instrumentos. */
export function simulateShot(input: ShotInput): ShotResult {
  const sphere = validate(input);
  const { v0, angle, height: h } = input;
  const c = input.air ? coreDrag(v0, angle, h, sphere) : coreIdeal(v0, angle, h);
  const highest = c.strobe.reduce((m, p) => Math.max(m, p.y), 0);
  return {
    flightTime: c.flightTime, range: c.range, maxHeight: c.maxHeight, apexTime: c.apexTime,
    impactSpeed: Math.hypot(c.vxImpact, c.vyImpact),
    impactAngle: c.flightTime === 0 ? 0 : deg(Math.atan2(-c.vyImpact, c.vxImpact)),
    path: c.path, strobe: c.strobe,
    v0Reading: roundToResolution(v0, GATE_RES),
    rangeReading: roundToResolution(c.range, TAPE_RES),
    timeReading: roundToResolution(c.flightTime, TIMER_RES),
    maxHeightReading: roundToResolution(highest, STROBE_SCALE_RES),
    idealRange: idealRange(v0, angle, h),
  };
}

/** Alcance del modelo (m) sin construir la trayectoria completa para el ideal. */
export function rangeOf(input: ShotInput): number {
  const sphere = validate(input);
  return input.air ? coreDrag(input.v0, input.angle, input.height, sphere).range : idealRange(input.v0, input.angle, input.height);
}

/** Ángulo de máximo alcance (grados) con o sin aire (sección dorada; la función R(θ) es unimodal). */
export function optimalAngle(input: Omit<ShotInput, 'angle'>): { angle: number; range: number } {
  validate({ ...input, angle: 45 });
  if (!input.air) return { angle: idealOptimalAngle(input.v0, input.height), range: idealMaxRange(input.v0, input.height) };
  const R = (a: number) => rangeOf({ ...input, angle: a });
  const phi = (Math.sqrt(5) - 1) / 2;
  let lo = 0, hi = 90;
  let x1 = hi - phi * (hi - lo), x2 = lo + phi * (hi - lo);
  let f1 = R(x1), f2 = R(x2);
  while (hi - lo > 0.01) {
    if (f1 < f2) { lo = x1; x1 = x2; f1 = f2; x2 = lo + phi * (hi - lo); f2 = R(x2); }
    else { hi = x2; x2 = x1; f2 = f1; x1 = hi - phi * (hi - lo); f1 = R(x1); }
  }
  const angle = (lo + hi) / 2;
  return { angle, range: R(angle) };
}

/**
 * Distancia del blanco del reto (m, al centímetro), reproducible con la semilla:
 * entre 35 % y 90 % del máximo alcance alcanzable en las condiciones dadas.
 */
export function targetDistance(seed: number, maxRange: number): number {
  const r = seededRandom(seed)();
  return roundToResolution(maxRange * (0.35 + 0.55 * r), 0.01);
}

export interface TargetCheck { hit: boolean; miss: number; /** Positivo si se pasó, negativo si quedó corto (m). */ }
export function checkTarget(rangeReading: number, target: number): TargetCheck {
  const miss = rangeReading - target;
  return { hit: Math.abs(miss) <= TARGET_RADIUS, miss };
}

export const projectileModelSpec: ModelSpec = {
  name: 'Movimiento de proyectiles con y sin resistencia del aire',
  inputs: [
    { symbol: 'v₀', name: 'Rapidez de salida (medida con la fotopuerta)', unit: 'm/s', range: PROJECTILE_LIMITS.v0, initial: 4.5 },
    { symbol: 'θ', name: 'Ángulo de lanzamiento sobre la horizontal', unit: '°', range: PROJECTILE_LIMITS.angle, initial: 30 },
    { symbol: 'h', name: 'Altura de la boca del lanzador sobre el piso', unit: 'm', range: PROJECTILE_LIMITS.height, initial: 1 },
    { symbol: 'esfera', name: 'Esfera de 25,4 mm (acero 67,4 g; plástico 9,0 g; icopor 0,20 g)', unit: '—', initial: 'acero' },
    { symbol: 'aire', name: 'Resistencia del aire', unit: '—', initial: 'sin aire (ideal)' },
  ],
  outputs: [
    { symbol: 'R', name: 'Alcance horizontal (cinta métrica, 1 mm)', unit: 'm' },
    { symbol: 'H', name: 'Altura máxima sobre el piso (estroboscopía, 1 cm)', unit: 'm' },
    { symbol: 't_v', name: 'Tiempo de vuelo (cronómetro, 1 ms)', unit: 's' },
  ],
  equations: [
    'x = v₀·cosθ·t;  y = h + v₀·senθ·t − ½·g·t²  (g = 9,8 m/s²)',
    't_v = [v₀·senθ + √((v₀·senθ)² + 2gh)]/g;  R = v₀·cosθ·t_v',
    'Si h = 0: R = v₀²·sen(2θ)/g, máximo en θ = 45°',
    'H = h + (v₀·senθ)²/(2g)',
    'Ángulo de máximo alcance ideal: tanθ* = v₀/√(v₀² + 2gh) (< 45° si h > 0)',
    'Con aire: m·dv/dt = m·g − ½·ρ·C_d·A·|v|·v  (ρ = 1,2 kg/m³; C_d = 0,47), integrado con RK4 (Δt = 1 ms)',
  ],
  initialConditions: [
    'La esfera sale de la boca del lanzador (x = 0, y = h) con rapidez v₀ y ángulo θ.',
    'Valores iniciales: resorte en nivel medio (4,5 m/s), θ = 30°, h = 1,00 m, esfera de acero, sin aire.',
  ],
  assumptions: [
    'La gravedad es uniforme (g = 9,8 m/s²) y el piso es horizontal.',
    'La rapidez de salida no depende de la esfera (lanzador calibrado) y la fotopuerta la mide sin error sistemático.',
    'Se ignoran la rotación de la esfera (efecto Magnus), el viento y el empuje del aire.',
    'En el modo con aire, C_d es constante (régimen cuadrático); el modo ideal elimina todo arrastre.',
    'El alcance se mide desde la plomada bajo la boca del lanzador hasta la marca del papel carbón.',
  ],
  limits: [
    'C_d = 0,47 es un valor típico para una esfera lisa; a rapideces bajas o con la esfera rugosa cambia.',
    'La masa del icopor (0,20 g) es aproximada: su alcance con aire es muy sensible a ese valor.',
    'La altura máxima se lee en la imagen estroboscópica más alta, que puede quedar unos milímetros por debajo del ápice real.',
    'El recipiente del reto se considera de borde bajo (no interrumpe la trayectoria).',
  ],
  testCases: [
    'Con h = 0 y sin aire: R = v₀²·sen2θ/g (5 m/s, 30° → 2,209 m).',
    'Ángulos complementarios (30° y 60°) dan el mismo alcance con h = 0 y sin aire.',
    'Con h > 0 el ángulo de máximo alcance es menor que 45°.',
    'Altura máxima y tiempo de vuelo coinciden con las expresiones analíticas.',
    'Con arrastre el alcance es menor y el ángulo óptimo baja; el efecto es enorme para el icopor.',
    'La energía mecánica se conserva sin aire y disminuye con aire.',
    'Entradas fuera de rango producen un error explicativo.',
  ],
};

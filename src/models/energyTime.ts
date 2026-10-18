import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Caída y lanzamiento vertical con integración numérica en el tiempo (práctica `energia`, ampliación de la Fase 3).
 *
 * Estado: altura y (m, suelo en y = 0), velocidad vertical v (m/s, positiva hacia arriba) y energía disipada E_dis (J).
 *   dy/dt = v
 *   dv/dt = −g − F_aire/m        F_aire = b·v (lineal)  ó  c·v·|v| (cuadrático)  ó  0 (ideal)
 *   dE_dis/dt = F_aire·v ≥ 0     (potencia que el aire le quita a la pelota)
 *   Ec = ½·m·v²;  Ep = m·g·y;  Em = Ec + Ep;  Em + E_dis = Em₀ (balance que el integrador debe respetar)
 *
 * Método principal: Runge-Kutta clásico de 4.º orden (RK4) con paso fijo Δt. Se ofrece Euler explícito (1.er orden)
 * solo para comparar: su deriva de energía es visible y proporcional a Δt.
 * El instante de llegada al suelo se obtiene interpolando entre los dos pasos que encierran el cruce (interpolación
 * cúbica de Hermite con y y v en ambos extremos), no tomando el último paso.
 * Este archivo no depende de React ni del navegador.
 */

export type FallMethod = 'rk4' | 'euler';
export type DragModel = 'ninguno' | 'lineal' | 'cuadratico';

/** Gravedad superficial aproximada (m/s²), valores estándar de uso escolar. */
export const GRAVITY_PRESETS = { tierra: 9.81, luna: 1.62, marte: 3.71 } as const;
export type GravityPreset = keyof typeof GRAVITY_PRESETS;

export const FALL_LIMITS = {
  mass: [0.1, 10] as [number, number], // kg
  height: [0.5, 50] as [number, number], // m
  v0: [-20, 20] as [number, number], // m/s, positiva hacia arriba
  g: [1, 25] as [number, number], // m/s²
  dt: [0.001, 0.05] as [number, number], // s
  /** Coeficiente b del arrastre lineal (kg/s). */
  linearDrag: [0, 0.5] as [number, number],
  /** Coeficiente c del arrastre cuadrático (kg/m). */
  quadraticDrag: [0, 0.05] as [number, number],
};

/** Tiempo máximo simulado (s): si la pelota no llega al suelo antes, el resultado lo indica. */
export const FALL_T_MAX = 120;

/**
 * Tolerancia declarada para la deriva relativa máxima de la energía mecánica en el caso ideal (sin aire) con RK4,
 * para todo Δt del rango (0,001 a 0,05 s). Verificada en tests/unit/energyTime.test.ts.
 */
export const DRIFT_TOLERANCE = 1e-6;

export interface FallInput {
  mass: number;
  height: number;
  v0: number;
  g: number;
  dt: number;
  method?: FallMethod;
  drag?: DragModel;
  /** b (kg/s) si drag = 'lineal'; c (kg/m) si drag = 'cuadratico'. */
  dragCoef?: number;
}

export interface FallState { t: number; y: number; v: number; edis: number; }

export interface FallPoint { t: number; y: number; v: number; ek: number; ep: number; em: number; edis: number; }

export interface FallResult {
  /** Puntos para graficar y animar (submuestreados a lo sumo a ~800; siempre incluyen el inicio y la llegada). */
  points: FallPoint[];
  ek0: number; ep0: number; em0: number;
  landed: boolean;
  /** Instante de llegada al suelo (s), interpolado. */
  tGround: number | null;
  /** Rapidez al llegar al suelo (m/s), interpolada. */
  vGround: number | null;
  /** Punto más alto (solo si se lanza hacia arriba). */
  apex: { t: number; y: number } | null;
  /** Energía disipada por el aire hasta el final (J). */
  edisFinal: number;
  /** max |Em + E_dis − Em₀| / Em₀ sobre todos los pasos (en el caso ideal es la deriva de Em). */
  maxDrift: number;
  tolerance: number;
  withinTolerance: boolean;
  steps: number;
  method: FallMethod;
  drag: DragModel;
}

/** Parámetros del integrador: masa, gravedad, modelo de arrastre y su coeficiente k (b ó c). */
export interface FallParams { m: number; g: number; drag: DragModel; k: number; }

function dragForce(p: FallParams, v: number): number {
  if (p.drag === 'lineal') return p.k * v;
  if (p.drag === 'cuadratico') return p.k * v * Math.abs(v);
  return 0;
}

/** Derivadas del estado (dy/dt, dv/dt, dE_dis/dt). */
function deriv(p: FallParams, v: number): [number, number, number] {
  const f = dragForce(p, v);
  return [v, -p.g - f / p.m, f * v];
}

/** Un paso del integrador elegido. */
export function stepFall(s: FallState, dt: number, p: FallParams, method: FallMethod): FallState {
  if (method === 'euler') {
    const [dy, dv, de] = deriv(p, s.v);
    return { t: s.t + dt, y: s.y + dy * dt, v: s.v + dv * dt, edis: s.edis + de * dt };
  }
  const k1 = deriv(p, s.v);
  const k2 = deriv(p, s.v + (dt / 2) * k1[1]);
  const k3 = deriv(p, s.v + (dt / 2) * k2[1]);
  const k4 = deriv(p, s.v + dt * k3[1]);
  const w = (i: 0 | 1 | 2) => (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return { t: s.t + dt, y: s.y + w(0), v: s.v + w(1), edis: s.edis + w(2) };
}

/** Interpolación cúbica de Hermite de y(t) en [0, dt] con valores y derivadas (v) en ambos extremos; u ∈ [0, 1]. */
function hermite(a: FallState, b: FallState, dt: number, u: number): { y: number; v: number } {
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
  return {
    y: h00 * a.y + h10 * dt * a.v + h01 * b.y + h11 * dt * b.v,
    v: (d00 * a.y + d10 * dt * a.v + d01 * b.y + d11 * dt * b.v) / dt,
  };
}

function hermiteScalar(f0: number, d0: number, f1: number, d1: number, dt: number, u: number): number {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * f0 + (u3 - 2 * u2 + u) * dt * d0 + (-2 * u3 + 3 * u2) * f1 + (u3 - u2) * dt * d1;
}

/** Raíz de y(u) = 0 en [0, 1] sobre la cúbica de Hermite (bisección + secante; y(0) ≥ 0 > y(1)). */
function groundFraction(a: FallState, b: FallState, dt: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (hermite(a, b, dt, mid).y >= 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function validate(input: FallInput): FallParams & { method: FallMethod } {
  assertInRange('La masa', input.mass, ...FALL_LIMITS.mass);
  assertInRange('La altura inicial', input.height, ...FALL_LIMITS.height);
  assertInRange('La velocidad inicial', input.v0, ...FALL_LIMITS.v0);
  assertInRange('La gravedad', input.g, ...FALL_LIMITS.g);
  assertInRange('El paso de tiempo Δt', input.dt, ...FALL_LIMITS.dt);
  const drag = input.drag ?? 'ninguno';
  const method = input.method ?? 'rk4';
  if (method !== 'rk4' && method !== 'euler') throw new RangeError('El método debe ser «rk4» o «euler».');
  if (drag !== 'ninguno' && drag !== 'lineal' && drag !== 'cuadratico') throw new RangeError('El modelo de arrastre no es válido.');
  let k = 0;
  if (drag === 'lineal') { k = input.dragCoef ?? 0; assertInRange('El coeficiente de arrastre lineal b', k, ...FALL_LIMITS.linearDrag); }
  if (drag === 'cuadratico') { k = input.dragCoef ?? 0; assertInRange('El coeficiente de arrastre cuadrático c', k, ...FALL_LIMITS.quadraticDrag); }
  return { m: input.mass, g: input.g, drag, k, method };
}

const MAX_POINTS = 800;

export function simulateFall(input: FallInput): FallResult {
  const p = validate(input);
  const { m, g } = p;
  const dt = input.dt;
  const energy = (s: FallState): FallPoint => {
    const ek = 0.5 * m * s.v * s.v, ep = m * g * s.y;
    return { t: s.t, y: s.y, v: s.v, ek, ep, em: ek + ep, edis: s.edis };
  };
  let s: FallState = { t: 0, y: input.height, v: input.v0, edis: 0 };
  const first = energy(s);
  const em0 = first.em;
  const nMax = Math.ceil(FALL_T_MAX / dt);
  const stride = Math.max(1, Math.ceil(Math.min(nMax, estimateSteps(input) * 1.2) / MAX_POINTS));
  const points: FallPoint[] = [first];
  let maxDrift = 0;
  let apex: FallResult['apex'] = null;
  let tGround: number | null = null, vGround: number | null = null;
  let edisFinal = 0;
  let steps = 0;
  for (let n = 1; n <= nMax; n++) {
    const next = stepFall(s, dt, p, p.method);
    steps = n;
    if (apex === null && s.v > 0 && next.v <= 0) {
      // v cambia de signo: se interpola linealmente el instante y se evalúa y con Hermite.
      const u = s.v / (s.v - next.v);
      apex = { t: s.t + u * dt, y: hermite(s, next, dt, u).y };
    }
    if (next.y < 0) {
      const u = groundFraction(s, next, dt);
      const hv = hermite(s, next, dt, u);
      tGround = s.t + u * dt;
      vGround = Math.abs(hv.v);
      // E_dis también con Hermite: su derivada en cada extremo es la potencia del arrastre, F_aire·v.
      edisFinal = hermiteScalar(s.edis, deriv(p, s.v)[2], next.edis, deriv(p, next.v)[2], dt, u);
      const landing = energy({ t: tGround, y: 0, v: hv.v, edis: edisFinal });
      maxDrift = Math.max(maxDrift, Math.abs(landing.em + landing.edis - em0) / em0);
      points.push(landing);
      break;
    }
    s = next;
    const pt = energy(s);
    maxDrift = Math.max(maxDrift, Math.abs(pt.em + pt.edis - em0) / em0);
    if (n % stride === 0) points.push(pt);
    edisFinal = s.edis;
  }
  if (tGround === null && points[points.length - 1].t !== s.t) points.push(energy(s));
  return {
    points, ek0: first.ek, ep0: first.ep, em0,
    landed: tGround !== null, tGround, vGround, apex, edisFinal,
    maxDrift, tolerance: DRIFT_TOLERANCE, withinTolerance: maxDrift <= DRIFT_TOLERANCE,
    steps, method: p.method, drag: p.drag,
  };
}

/** Número de pasos aproximado (caso ideal) para elegir el submuestreo de los puntos guardados. */
function estimateSteps(input: FallInput): number {
  const t = idealFall(input).tGround;
  return Math.max(1, t / input.dt);
}

/** Solución exacta sin aire (sirve de referencia para comparar con la integración). */
export function idealFall(input: Pick<FallInput, 'mass' | 'height' | 'v0' | 'g'>): { ep0: number; em0: number; vGround: number; tGround: number; maxHeight: number } {
  const { mass: m, height: h, v0, g } = input;
  const vGround = Math.sqrt(v0 * v0 + 2 * g * h);
  return {
    ep0: m * g * h,
    em0: m * g * h + 0.5 * m * v0 * v0,
    vGround,
    tGround: (v0 + vGround) / g,
    maxHeight: v0 > 0 ? h + (v0 * v0) / (2 * g) : h,
  };
}

/** Solución exacta con arrastre lineal (y, v en el instante t), para comprobar la convergencia del integrador. */
export function linearDragExact(t: number, input: { mass: number; height: number; v0: number; g: number; b: number }): { y: number; v: number } {
  const { mass: m, height: h, v0, g, b } = input;
  const vt = (m * g) / b; // rapidez terminal
  const e = Math.exp((-b * t) / m);
  return { v: -vt + (v0 + vt) * e, y: h - vt * t + (m / b) * (v0 + vt) * (1 - e) };
}

export const energyTimeModelSpec: ModelSpec = {
  name: 'Caída y lanzamiento vertical con integración numérica en el tiempo',
  inputs: [
    { symbol: 'm', name: 'Masa de la pelota', unit: 'kg', range: FALL_LIMITS.mass, initial: 1 },
    { symbol: 'h₀', name: 'Altura inicial', unit: 'm', range: FALL_LIMITS.height, initial: 10 },
    { symbol: 'v₀', name: 'Velocidad vertical inicial (positiva hacia arriba)', unit: 'm/s', range: FALL_LIMITS.v0, initial: 0 },
    { symbol: 'g', name: 'Gravedad (Tierra 9,81; Luna 1,62; Marte 3,71)', unit: 'm/s²', range: FALL_LIMITS.g, initial: 9.81 },
    { symbol: 'Δt', name: 'Paso de tiempo', unit: 's', range: FALL_LIMITS.dt, initial: 0.01 },
    { symbol: 'b ó c', name: 'Coeficiente de arrastre del aire (lineal en kg/s o cuadrático en kg/m)', unit: '—', initial: 0 },
  ],
  outputs: [
    { symbol: 'Ec, Ep, Em, E_dis', name: 'Energías en cada instante', unit: 'J' },
    { symbol: 't_suelo, v_suelo', name: 'Instante y rapidez al llegar al suelo (interpolados)', unit: 's, m/s' },
    { symbol: 'deriva', name: 'Deriva relativa máxima de Em + E_dis', unit: '—' },
  ],
  equations: [
    'dy/dt = v;  dv/dt = −g − F_aire/m',
    'F_aire = b·v (lineal) ó c·v·|v| (cuadrático);  dE_dis/dt = F_aire·v',
    'Ec = ½·m·v²;  Ep = m·g·y;  Em = Ec + Ep;  Em + E_dis = Em₀',
    'Sin aire: v_suelo = √(v₀² + 2·g·h₀);  t_suelo = (v₀ + v_suelo)/g;  h_máx = h₀ + v₀²/(2g)',
  ],
  initialConditions: ['Pelota de 1 kg soltada desde el reposo a 10 m de altura en la Tierra (g = 9,81 m/s²), sin aire, Δt = 0,01 s, RK4.'],
  assumptions: [
    'Movimiento vertical de una partícula; g constante; suelo en y = 0.',
    'El arrastre lineal o cuadrático es un modelo simplificado con coeficiente constante; sin arrastre es el caso ideal.',
    'Integración RK4 de paso fijo (Euler explícito solo para comparar).',
  ],
  limits: [
    'No representa el rebote ni el viento; la simulación termina al llegar al suelo o a los 120 s.',
    'El instante de llegada se interpola entre dos pasos; con Euler, los valores dependen notablemente de Δt.',
  ],
  testCases: [
    'm = 1 kg, h = 10 m, g = 9,81 m/s², v₀ = 0: Ep₀ = 98,1 J; v_suelo = √(2gh) ≈ 14,007 m/s; t_suelo = √(2h/g) ≈ 1,4278 s.',
    'Sin aire y con RK4, la deriva relativa máxima de Em es menor que 1 × 10⁻⁶ para Δt entre 0,001 y 0,05 s.',
    'Con arrastre, Em disminuye y Em + E_dis se conserva.',
  ],
};

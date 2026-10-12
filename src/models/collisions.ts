import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Choques en una dimensión sobre un riel de aire (grado 10.º, nivel universitario introductorio).
 *
 *   v1' = ((m1 − e·m2)·v1 + (1 + e)·m2·v2)/(m1 + m2)
 *   v2' = ((m2 − e·m1)·v2 + (1 + e)·m1·v1)/(m1 + m2)
 *   p = m1·v1 + m2·v2 se conserva siempre;  ΔEc = ½·μ·(1 − e²)·(v1 − v2)²,  μ = m1·m2/(m1 + m2)
 *   Explosión desde el reposo con energía liberada E:  J = √(2·μ·E),  v1' = −J/m1,  v2' = +J/m2
 *
 * El contacto dura un tiempo τ breve; durante él el impulso crece como J(s) = J·(1 − cos(π·s/τ))/2
 * (perfil de fuerza de medio seno, típico de un parachoques de resorte). Así la cantidad de movimiento
 * total se conserva en cada instante y la energía cinética baja mientras el resorte se comprime.
 * Convención: el carrito 1 está a la izquierda, el 2 a la derecha; velocidad positiva hacia la derecha.
 */

export type CollisionType = 'elastico' | 'parcial' | 'inelastico' | 'explosion';

export const COLLISION_TYPES: { id: CollisionType; name: string; short: string }[] = [
  { id: 'elastico', name: 'Elástico (parachoques de resorte, e = 1)', short: 'Elástico' },
  { id: 'parcial', name: 'Inelástico parcial (0 ≤ e ≤ 1)', short: 'Parcial' },
  { id: 'inelastico', name: 'Perfectamente inelástico (velcro, e = 0)', short: 'Velcro' },
  { id: 'explosion', name: 'Explosión (resorte comprimido, desde el reposo)', short: 'Explosión' },
];

export const COLLISION_LIMITS = {
  mass: [0.1, 1.0] as [number, number], // kg (deslizador con pesas)
  velocity: [-1.0, 1.0] as [number, number], // m/s
  restitution: [0, 1] as [number, number],
  energy: [0.01, 0.2] as [number, number], // J liberados por el resorte en la explosión
};

/** Largo de la bandera que interrumpe el haz de la fotopuerta (m). */
export const FLAG_LENGTH = 0.1;
/** Resolución del temporizador de fotopuertas (s): 0,1 ms. */
export const TIMER_RES = 0.0001;
/** Tiempo máximo que registra el temporizador (s): un deslizador más lento se considera en reposo. */
export const TIMER_MAX = 10;
/** Resolución de la balanza (g). */
export const BALANCE_RES = 0.1;
/** Duración del contacto (s) según el tipo de interacción. */
export const CONTACT_TIME: Record<CollisionType, number> = { elastico: 0.04, parcial: 0.04, inelastico: 0.03, explosion: 0.05 };

/** Geometría del riel (m): longitud útil, punto de contacto, fotopuertas y largo de cada deslizador. */
export const RAIL = { length: 2.0, contact: 1.0, gate1: 0.6, gate2: 1.4, glider: 0.2, margin: 0.06 };

export function findCollisionType(id: string): CollisionType {
  const t = COLLISION_TYPES.find((c) => c.id === id);
  if (!t) throw new Error(`Tipo de choque desconocido: ${id}`);
  return t.id;
}

/** Coeficiente de restitución efectivo según el tipo de choque. */
export function restitutionFor(type: CollisionType, e: number): number {
  if (type === 'elastico') return 1;
  if (type === 'inelastico') return 0;
  if (type === 'parcial') return e;
  return NaN; // en la explosión no aplica
}

export const kineticEnergy = (m: number, v: number) => 0.5 * m * v * v;
export const reducedMass = (m1: number, m2: number) => (m1 * m2) / (m1 + m2);
export const centerOfMassVelocity = (m1: number, m2: number, v1: number, v2: number) => (m1 * v1 + m2 * v2) / (m1 + m2);

/** Velocidades después de un choque frontal en 1D con coeficiente de restitución e. */
export function finalVelocities(m1: number, m2: number, v1: number, v2: number, e: number): { v1f: number; v2f: number } {
  assertInRange('La masa del carrito 1', m1, ...COLLISION_LIMITS.mass);
  assertInRange('La masa del carrito 2', m2, ...COLLISION_LIMITS.mass);
  assertInRange('La velocidad del carrito 1', v1, ...COLLISION_LIMITS.velocity);
  assertInRange('La velocidad del carrito 2', v2, ...COLLISION_LIMITS.velocity);
  assertInRange('El coeficiente de restitución', e, ...COLLISION_LIMITS.restitution);
  return collide1D(m1, m2, v1, v2, e);
}

/** Fórmula general (sin los límites del montaje): útil para explorar casos extremos como m₂ ≫ m₁. */
export function collide1D(m1: number, m2: number, v1: number, v2: number, e: number): { v1f: number; v2f: number } {
  if (!(m1 > 0) || !(m2 > 0)) throw new RangeError('Las masas deben ser positivas.');
  assertInRange('El coeficiente de restitución', e, 0, 1);
  const M = m1 + m2;
  return {
    v1f: ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / M,
    v2f: ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / M,
  };
}

/** Energía cinética transformada en el choque (calor, sonido, deformación): ½·μ·(1 − e²)·(v1 − v2)². */
export function energyLost(m1: number, m2: number, v1: number, v2: number, e: number): number {
  return 0.5 * reducedMass(m1, m2) * (1 - e * e) * (v1 - v2) ** 2;
}

/** Velocidades después de una explosión desde el reposo que libera la energía E (J). */
export function explosionVelocities(m1: number, m2: number, energy: number): { v1f: number; v2f: number; impulse: number } {
  assertInRange('La masa del carrito 1', m1, ...COLLISION_LIMITS.mass);
  assertInRange('La masa del carrito 2', m2, ...COLLISION_LIMITS.mass);
  assertInRange('La energía del resorte', energy, ...COLLISION_LIMITS.energy);
  const J = Math.sqrt(2 * reducedMass(m1, m2) * energy);
  return { v1f: -J / m1, v2f: J / m2, impulse: J };
}

/** Lectura de la fotopuerta (s) para un deslizador con velocidad v; null si no pasa (o el temporizador se desborda). */
export function gateTime(v: number): number | null {
  if (!Number.isFinite(v) || Math.abs(v) * TIMER_MAX <= FLAG_LENGTH) return null;
  return roundToResolution(FLAG_LENGTH / Math.abs(v), TIMER_RES);
}

/** Velocidad calculada con la lectura de la fotopuerta (la fotopuerta de doble haz indica el sentido de paso). */
export function velocityFromGate(dt: number | null, direction: number): number {
  if (dt === null || dt <= 0) return 0;
  return (Math.sign(direction) || 1) * (FLAG_LENGTH / dt);
}

/** Lectura de la balanza (g) para una masa en kg. */
export function balanceReading(massKg: number): number {
  return roundToResolution(massKg * 1000, BALANCE_RES);
}

export interface CollisionInput {
  type: CollisionType;
  m1: number; m2: number; // kg
  v1: number; v2: number; // m/s (ignoradas en la explosión: parten del reposo)
  e: number; // usado solo en el choque inelástico parcial
  energy: number; // J, usado solo en la explosión
}

export interface GateReadings { before1: number | null; before2: number | null; after1: number | null; after2: number | null; }

export interface Totals { v1: number; v2: number; v1f: number; v2f: number; pBefore: number; pAfter: number; ecBefore: number; ecAfter: number; ecLost: number; }

export interface CollisionResult {
  type: CollisionType;
  /** false si los deslizadores no se alcanzan (v1 ≤ v2). */
  collides: boolean;
  m1: number; m2: number;
  /** Coeficiente de restitución efectivo (NaN en la explosión). */
  e: number;
  /** Valores del modelo (exactos). */
  model: Totals;
  /** Impulso que recibe el carrito 2 durante el contacto (N·s). */
  impulse: number;
  contactTime: number;
  vcm: number;
  /** Lecturas de los instrumentos. */
  balance1: number; balance2: number; // g
  gates: GateReadings; // s
  /** Valores calculados a partir de las lecturas (lo que el estudiante mide). */
  measured: Totals;
}

function totals(m1: number, m2: number, v1: number, v2: number, v1f: number, v2f: number): Totals {
  const ecBefore = kineticEnergy(m1, v1) + kineticEnergy(m2, v2);
  const ecAfter = kineticEnergy(m1, v1f) + kineticEnergy(m2, v2f);
  return { v1, v2, v1f, v2f, pBefore: m1 * v1 + m2 * v2, pAfter: m1 * v1f + m2 * v2f, ecBefore, ecAfter, ecLost: ecBefore - ecAfter };
}

export function simulateCollision(input: CollisionInput): CollisionResult {
  const type = findCollisionType(input.type);
  const { m1, m2 } = input;
  assertInRange('La masa del carrito 1', m1, ...COLLISION_LIMITS.mass);
  assertInRange('La masa del carrito 2', m2, ...COLLISION_LIMITS.mass);
  assertInRange('La velocidad del carrito 1', input.v1, ...COLLISION_LIMITS.velocity);
  assertInRange('La velocidad del carrito 2', input.v2, ...COLLISION_LIMITS.velocity);
  assertInRange('El coeficiente de restitución', input.e, ...COLLISION_LIMITS.restitution);
  assertInRange('La energía del resorte', input.energy, ...COLLISION_LIMITS.energy);

  let v1 = input.v1, v2 = input.v2, v1f: number, v2f: number, impulse: number, collides: boolean;
  const e = restitutionFor(type, input.e);
  if (type === 'explosion') {
    v1 = 0; v2 = 0;
    const r = explosionVelocities(m1, m2, input.energy);
    v1f = r.v1f; v2f = r.v2f; impulse = r.impulse; collides = true;
  } else if (v1 - v2 > 1e-12) {
    const r = finalVelocities(m1, m2, v1, v2, e);
    v1f = r.v1f; v2f = r.v2f; collides = true;
    impulse = reducedMass(m1, m2) * (1 + e) * (v1 - v2);
  } else {
    v1f = v1; v2f = v2; impulse = 0; collides = false;
  }

  const model = totals(m1, m2, v1, v2, v1f, v2f);
  const gates: GateReadings = { before1: gateTime(v1), before2: gateTime(v2), after1: collides ? gateTime(v1f) : null, after2: collides ? gateTime(v2f) : null };
  const balance1 = balanceReading(m1), balance2 = balanceReading(m2);
  const m1r = balance1 / 1000, m2r = balance2 / 1000;
  const mv1 = velocityFromGate(gates.before1, v1), mv2 = velocityFromGate(gates.before2, v2);
  const mv1f = collides ? velocityFromGate(gates.after1, v1f) : mv1;
  const mv2f = collides ? velocityFromGate(gates.after2, v2f) : mv2;
  return {
    type, collides, m1, m2, e, model, impulse,
    contactTime: collides ? CONTACT_TIME[type] : 0,
    vcm: centerOfMassVelocity(m1, m2, v1, v2),
    balance1, balance2, gates,
    measured: totals(m1r, m2r, mv1, mv2, mv1f, mv2f),
  };
}

/* ------------------------------------------------------------ evolución temporal (animación y gráficas) */

export interface Timeline { tContact: number; tau: number; tEnd: number; }

/** Instantes clave: inicio del contacto, duración del contacto y final del registro (s). */
export function timeline(r: CollisionResult): Timeline {
  const tau = r.contactTime;
  if (!r.collides) return { tContact: Infinity, tau: 0, tEnd: 2 };
  let tContact: number;
  if (r.type === 'explosion') tContact = 0.3;
  else {
    const vmax = Math.max(Math.abs(r.model.v1), Math.abs(r.model.v2));
    // El deslizador más rápido recorre 0,55 m antes del contacto (pasa por su fotopuerta).
    tContact = 0.55 / vmax;
  }
  const lo = RAIL.glider / 2 + RAIL.margin, hi = RAIL.length - RAIL.glider / 2 - RAIL.margin;
  const c1 = RAIL.contact - RAIL.glider / 2, c2 = RAIL.contact + RAIL.glider / 2;
  const toEnd = (x: number, v: number) => (Math.abs(v) < 1e-9 ? Infinity : v > 0 ? (hi - x) / v : (lo - x) / v);
  const vmaxF = Math.max(Math.abs(r.model.v1f), Math.abs(r.model.v2f));
  let post = vmaxF < 1e-6 ? 0.8 : Math.min(toEnd(c1, r.model.v1f), toEnd(c2, r.model.v2f), 0.9 / vmaxF);
  post = Math.max(0.3, post);
  return { tContact, tau, tEnd: tContact + tau + post };
}

export interface State { x1: number; x2: number; v1: number; v2: number; contact: boolean; }

/** Posiciones (centros de los deslizadores, m) y velocidades en el instante t (s). */
export function stateAt(r: CollisionResult, tl: Timeline, t: number): State {
  const { v1, v2, v1f, v2f } = r.model;
  const c1 = RAIL.contact - RAIL.glider / 2, c2 = RAIL.contact + RAIL.glider / 2;
  if (!r.collides) {
    // Sin choque: se mueven a velocidad constante desde posiciones separadas.
    return { x1: 0.4 + v1 * t, x2: 1.4 + v2 * t, v1, v2, contact: false };
  }
  const s = t - tl.tContact;
  if (s <= 0) return { x1: c1 + v1 * s, x2: c2 + v2 * s, v1, v2, contact: false };
  const tau = tl.tau, J = r.impulse;
  const sc = Math.min(s, tau);
  const Js = (J * (1 - Math.cos((Math.PI * sc) / tau))) / 2;
  const Is = (J / 2) * (sc - (tau / Math.PI) * Math.sin((Math.PI * sc) / tau)); // ∫ J ds
  const x1c = c1 + v1 * sc - Is / r.m1, x2c = c2 + v2 * sc + Is / r.m2;
  if (s <= tau) return { x1: x1c, x2: x2c, v1: v1 - Js / r.m1, v2: v2 + Js / r.m2, contact: true };
  const after = s - tau;
  return { x1: x1c + v1f * after, x2: x2c + v2f * after, v1: v1f, v2: v2f, contact: false };
}

export interface MomentumSample { t: number; p1: number; p2: number; p: number; ec1: number; ec2: number; ec: number; }

/** Muestras de p(t) y Ec(t) alrededor del contacto; t en milisegundos relativos al inicio del contacto. */
export function contactSamples(r: CollisionResult, n = 160): MomentumSample[] {
  if (!r.collides) return [];
  const tl = timeline(r);
  const from = Math.max(-tl.tContact, -0.06), to = Math.min(tl.tEnd - tl.tContact, tl.tau + 0.08);
  const out: MomentumSample[] = [];
  for (let i = 0; i <= n; i++) {
    const s = from + ((to - from) * i) / n;
    const st = stateAt(r, tl, tl.tContact + s);
    const p1 = r.m1 * st.v1, p2 = r.m2 * st.v2, ec1 = kineticEnergy(r.m1, st.v1), ec2 = kineticEnergy(r.m2, st.v2);
    out.push({ t: s * 1000, p1, p2, p: p1 + p2, ec1, ec2, ec: ec1 + ec2 });
  }
  return out;
}

export const collisionsModelSpec: ModelSpec = {
  name: 'Choques en una dimensión en un riel de aire (coeficiente de restitución)',
  inputs: [
    { symbol: 'tipo', name: 'Tipo de interacción', unit: '—', initial: 'elástico' },
    { symbol: 'm₁', name: 'Masa del deslizador 1 (con pesas)', unit: 'kg', range: COLLISION_LIMITS.mass, initial: 0.3 },
    { symbol: 'm₂', name: 'Masa del deslizador 2 (con pesas)', unit: 'kg', range: COLLISION_LIMITS.mass, initial: 0.2 },
    { symbol: 'v₁', name: 'Velocidad inicial del deslizador 1', unit: 'm/s', range: COLLISION_LIMITS.velocity, initial: 0.5 },
    { symbol: 'v₂', name: 'Velocidad inicial del deslizador 2', unit: 'm/s', range: COLLISION_LIMITS.velocity, initial: -0.3 },
    { symbol: 'e', name: 'Coeficiente de restitución (choque parcial)', unit: '—', range: COLLISION_LIMITS.restitution, initial: 0.5 },
    { symbol: 'E', name: 'Energía liberada por el resorte (explosión)', unit: 'J', range: COLLISION_LIMITS.energy, initial: 0.05 },
  ],
  outputs: [
    { symbol: 'Δt', name: 'Tiempos de paso de las banderas de 10,0 cm (antes y después)', unit: 's' },
    { symbol: "v₁', v₂'", name: 'Velocidades después de la interacción', unit: 'm/s' },
    { symbol: 'p', name: 'Cantidad de movimiento total antes y después', unit: 'kg·m/s' },
    { symbol: 'Ec', name: 'Energía cinética total antes y después, y energía transformada', unit: 'J' },
  ],
  equations: [
    'p = m₁·v₁ + m₂·v₂ (se conserva: no hay fuerza externa horizontal neta)',
    "e = −(v₂' − v₁')/(v₂ − v₁)",
    "v₁' = ((m₁ − e·m₂)·v₁ + (1 + e)·m₂·v₂)/(m₁ + m₂)",
    "v₂' = ((m₂ − e·m₁)·v₂ + (1 + e)·m₁·v₁)/(m₁ + m₂)",
    'ΔEc = ½·μ·(1 − e²)·(v₁ − v₂)²,  μ = m₁·m₂/(m₁ + m₂)',
    'v_cm = (m₁·v₁ + m₂·v₂)/(m₁ + m₂) = constante',
    "Explosión desde el reposo: J = √(2·μ·E),  v₁' = −J/m₁,  v₂' = J/m₂",
    'Fotopuerta: v = L/Δt con L = 0,100 m',
  ],
  initialConditions: ['Deslizadores de 0,30 kg y 0,20 kg que se acercan a 0,50 m/s y −0,30 m/s con parachoques de resorte (e = 1).'],
  assumptions: [
    'Riel de aire horizontal sin fricción ni resistencia del aire: la fuerza externa horizontal neta es cero.',
    'Choque frontal en una dimensión; el coeficiente de restitución no depende de la velocidad.',
    'El contacto dura unas decenas de milisegundos con una fuerza de perfil de medio seno.',
    'Cada fotopuerta es de doble haz: mide el tiempo de paso de la bandera (resolución 0,1 ms) y el sentido del movimiento; el temporizador asocia cada lectura al deslizador que la produjo.',
    'La balanza mide las masas con resolución de 0,1 g.',
  ],
  limits: [
    'Un deslizador más lento que 0,01 m/s no completa el paso antes de 10 s: el temporizador lo registra como en reposo.',
    'No incluye la fricción residual del riel, la inclinación ni la rotación de los deslizadores.',
    'En un choque real, e depende un poco de la velocidad de impacto y de la temperatura del material.',
    'Choques en dos dimensiones y masas variables quedan por fuera del modelo.',
  ],
  testCases: [
    'La cantidad de movimiento total se conserva en todos los tipos de interacción.',
    'Con e = 1 la energía cinética se conserva; con e = 0 ambos terminan con la misma velocidad.',
    'Masas iguales en choque elástico intercambian sus velocidades.',
    'Contra una masa mucho mayor en reposo, el deslizador rebota casi con −v.',
    'La energía perdida coincide con ½·μ·(1 − e²)·(v₁ − v₂)².',
    'Una explosión desde el reposo deja p total = 0 y libera la energía elegida.',
    'La velocidad del centro de masa es la misma antes, durante y después del contacto.',
    'Las entradas fuera de rango se rechazan.',
  ],
};

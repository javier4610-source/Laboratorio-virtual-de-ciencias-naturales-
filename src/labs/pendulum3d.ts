/**
 * Escena 3D del péndulo (piloto del kit src/three). Funciones PURAS: toman la MISMA corrida del modelo que usa el
 * laboratorio (`simulatePendulum`, θ(t) con `angleAt`) y la convierten en primitivas y en una descripción. No hay física
 * nueva: la velocidad sale de las muestras ω(t) de la integración RK4 y las fuerzas son el peso m·g y la tensión del hilo
 * de la segunda ley en la dirección radial, T = m·(g·cos θ + L·ω²).
 */
import { fmt } from '../lib/format';
import { arrowScale, physicalArrow, type SceneItem, type Vec3 } from '../three/scene';
import type { PendulumRun } from '../models/pendulum';

/** ω (rad/s) en el instante t: interpolación lineal entre las muestras de la integración (índices acotados). */
export function omegaAt(run: PendulumRun, time: number): number {
  const n = run.t.length;
  if (n < 2) return run.omega[0] ?? 0;
  const x = Math.max(0, Math.min(time, run.t[n - 1])) / run.dt;
  const i = Math.max(0, Math.min(n - 2, Math.floor(x)));
  const f = Math.min(1, Math.max(0, x - i));
  return run.omega[i] + (run.omega[i + 1] - run.omega[i]) * f;
}

export interface PendulumKinematics {
  /** Posición de la lenteja respecto al punto de suspensión (m). */
  position: Vec3;
  /** Velocidad (m/s), tangente a la trayectoria. */
  velocity: Vec3;
  speed: number;
  /** Peso (N) y tensión (N) como vectores. */
  weight: Vec3;
  tension: Vec3;
  tensionMagnitude: number;
  weightMagnitude: number;
}

/** Cinemática y fuerzas de la lenteja para θ (rad) y ω (rad/s). El péndulo oscila en el plano x–y; y hacia arriba. */
export function pendulumKinematics(length: number, massKg: number, g: number, theta: number, omega: number): PendulumKinematics {
  const s = Math.sin(theta), c = Math.cos(theta);
  const tensionMagnitude = massKg * (g * c + length * omega * omega);
  return {
    position: [length * s, -length * c, 0],
    velocity: [length * omega * c, length * omega * s, 0],
    speed: Math.abs(length * omega),
    weight: [0, -massKg * g, 0],
    tension: [-s * tensionMagnitude, c * tensionMagnitude, 0],
    tensionMagnitude,
    weightMagnitude: massKg * g,
  };
}

export interface PendulumSceneInput {
  run: PendulumRun;
  length: number;
  massG: number;
  amplitudeDeg: number;
  /** Ángulo actual (rad) y tiempo simulado (s); `released` = falso mientras la lenteja está sostenida en θ₀. */
  theta: number;
  t: number;
  released: boolean;
  bobRadiusM: number;
  bobColor: string;
  bobName: string;
  placeName: string;
  damped: boolean;
}

export interface PendulumScene { items: SceneItem[]; extent: number; target: Vec3; description: string; drawnRadius: number }

/** Longitud de la flecha más larga como fracción de L. */
const ARROW_FRACTION = 0.32;

export function pendulumScene(p: PendulumSceneInput): PendulumScene {
  const L = p.length, m = p.massG / 1000, g = p.run.g;
  const th0 = (p.amplitudeDeg * Math.PI) / 180;
  const omega = p.released ? omegaAt(p.run, p.t) : 0;
  const k = pendulumKinematics(L, m, g, p.theta, omega);
  // Escalas fijas en toda la corrida: la rapidez máxima (conservación de la energía desde θ₀) y la tensión máxima
  // en el punto más bajo, T = m·g·(3 − 2·cos θ₀), miden ARROW_FRACTION·L.
  const vScale = arrowScale(Math.sqrt(2 * g * L * (1 - Math.cos(th0))), ARROW_FRACTION * L);
  const fScale = arrowScale(m * g * (3 - 2 * Math.cos(th0)), ARROW_FRACTION * L);
  // La lenteja real mide pocos centímetros: se dibuja con un radio mínimo para que se vea (posición exacta).
  const drawnRadius = Math.max(p.bobRadiusM, 0.045 * L);
  const bob = k.position;
  const span = L + 0.2;
  // La mesa queda por debajo de la flecha más larga del peso en el punto más bajo.
  const benchY = -L * (1 + ARROW_FRACTION) - drawnRadius - 0.06;
  // Soporte universal a un lado y por detrás del plano de oscilación (no choca con la lenteja ni a 80°).
  const postX = -0.32 * span, postZ = -0.14 * span;

  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [postX / 2, benchY, postZ / 2], size: [1.15 * span, 0.55 * span], color: 'surface-3' },
    { id: 'soporte', kind: 'rod', from: [postX, benchY, postZ], to: [postX, 0.07, postZ], radius: 0.012 * span, color: 'series-8' },
    { id: 'brazo', kind: 'rod', from: [postX, 0.035, postZ], to: [0, 0.035, 0], radius: 0.008 * span, color: 'series-8' },
    // Trayectoria de θ₀ a −θ₀ (arco de radio L).
    { id: 'trayectoria', kind: 'particles', radius: 0.007 * span, color: 'ink-3',
      points: Array.from({ length: 31 }, (_, i) => { const a = -th0 + (2 * th0 * i) / 30; return [L * Math.sin(a), -L * Math.cos(a), 0] as Vec3; }) },
    { id: 'hilo', kind: 'rod', from: [0, 0, 0], to: bob, radius: 0.0025 * span, color: 'ink' },
    { id: 'lenteja', kind: 'sphere', center: bob, radius: drawnRadius, color: (/^#[0-9a-f]{6}$/i.test(p.bobColor) ? p.bobColor : 'series-8') as `#${string}` },
  ];
  const r = drawnRadius * 0.3;
  const weight = physicalArrow(bob, k.weight, fScale);
  if (weight) items.push({ id: 'peso', kind: 'arrow', ...weight, radius: r, color: 'series-1', label: `P = ${fmt(k.weightMagnitude, 2)} N` });
  if (p.released) {
    const tension = physicalArrow(bob, k.tension, fScale);
    if (tension) items.push({ id: 'tension', kind: 'arrow', ...tension, radius: r, color: 'series-3', label: `T = ${fmt(k.tensionMagnitude, 2)} N` });
    const vel = physicalArrow(bob, k.velocity, vScale, 0.01 * L);
    if (vel) items.push({ id: 'velocidad', kind: 'arrow', ...vel, radius: r, color: 'series-2', label: `v = ${fmt(k.speed, 2)} m/s` });
  }

  const deg = fmt((p.theta * 180) / Math.PI, 0);
  const description = !p.released
    ? `Péndulo en 3D: lenteja de ${p.bobName.toLowerCase()} de ${fmt(p.massG, 0)} g en un hilo de ${fmt(L, 2)} m, sostenida a ${fmt(p.amplitudeDeg, 0)}° de la vertical (${p.placeName}). Flecha del peso: ${fmt(k.weightMagnitude, 2)} N hacia abajo. El arco punteado es la trayectoria entre ${fmt(p.amplitudeDeg, 0)}° y −${fmt(p.amplitudeDeg, 0)}°.`
    : `Péndulo en 3D en t = ${fmt(p.t, 2)} s: ángulo ${deg}°, rapidez ${fmt(k.speed, 2)} m/s (flecha v, tangente al arco), tensión ${fmt(k.tensionMagnitude, 2)} N hacia el punto de suspensión y peso ${fmt(k.weightMagnitude, 2)} N hacia abajo.${p.damped ? ' Con la aleta en aceite la amplitud disminuye en cada oscilación.' : ''}`;
  const extent = 0.5 * (-benchY + 0.07) + 0.06;
  return { items, extent, target: [postX / 3, (benchY + 0.07) / 2, 0], description, drawnRadius };
}

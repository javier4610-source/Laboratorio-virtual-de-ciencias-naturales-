import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Movimiento circular uniforme y fuerza centrípeta (grado 10.º).
 *
 * Estación 1 — mesa de aire con un disco atado a una cuerda: el otro extremo de la cuerda pasa por el eje y llega a un
 * sensor de fuerza. El disco gira en un círculo horizontal de radio r con período T (sin rozamiento con la mesa):
 *   f = 1/T,  ω = 2π/T,  v = ω·r = 2πr/T,  a_c = v²/r = ω²·r,  F_c = m·v²/r  (= tensión de la cuerda).
 * Si la cuerda se corta en el instante t₀, ya no hay fuerza neta horizontal y el disco sigue en línea recta con la
 * velocidad que tenía: por la TANGENTE (primera ley de Newton), no hacia afuera en dirección radial.
 *
 * Estación 2 — carro en una curva plana: la fricción estática entre las llantas y la vía da la fuerza centrípeta;
 *   v_máx = √(μ_s·g·r)   (no depende de la masa).
 * Coeficientes: caucho sobre concreto seco μ_s = 1,0 (Serway y Jewett, tabla 5.1); los demás son valores típicos
 * ILUSTRATIVOS para comparar (mojado ≈ 0,5; gravilla ≈ 0,35; barro ≈ 0,2); hielo sobre hielo μ_s = 0,1 (misma tabla).
 * g = 9,78 m/s² (Apartadó, como en «Péndulo»). Este archivo no depende de React ni del navegador.
 */

export const G = 9.78; // m/s²
export const CM_LIMITS = {
  radius: [0.2, 1.0] as [number, number], // m
  mass: [50, 500] as [number, number], // g
  period: [0.4, 4] as [number, number], // s
  curveRadius: [10, 200] as [number, number], // m
  speed: [5, 120] as [number, number], // km/h
};
export const SENSOR = { resolution: 0.01, max: 50 }; // N
export const STOPWATCH = { resolution: 0.01 }; // s
export const RULER = { resolution: 0.001 }; // m (1 mm)

export interface Surface { id: string; name: string; mu: number; source: string }
export const SURFACES: Surface[] = [
  { id: 'seco', name: 'Concreto seco', mu: 1.0, source: 'Serway y Jewett, tabla 5.1 (caucho sobre concreto)' },
  { id: 'mojado', name: 'Concreto mojado (aguacero)', mu: 0.5, source: 'valor típico ilustrativo' },
  { id: 'gravilla', name: 'Gravilla suelta', mu: 0.35, source: 'valor típico ilustrativo' },
  { id: 'barro', name: 'Barro (vía destapada)', mu: 0.2, source: 'valor típico ilustrativo' },
  { id: 'hielo', name: 'Hielo', mu: 0.1, source: 'Serway y Jewett, tabla 5.1 (hielo sobre hielo)' },
];
export function findSurface(id: string): Surface {
  const s = SURFACES.find((x) => x.id === id);
  if (!s) throw new RangeError(`Superficie desconocida: ${id}`);
  return s;
}

export interface UcmInput { radius: number; massG: number; period: number }
export interface UcmResult { f: number; omega: number; v: number; ac: number; force: number; rpm: number; m: number }
export function ucm(i: UcmInput): UcmResult {
  assertInRange('El radio', i.radius, CM_LIMITS.radius[0], CM_LIMITS.radius[1]);
  assertInRange('La masa', i.massG, CM_LIMITS.mass[0], CM_LIMITS.mass[1]);
  assertInRange('El período', i.period, CM_LIMITS.period[0], CM_LIMITS.period[1]);
  const m = i.massG / 1000;
  const f = 1 / i.period;
  const omega = 2 * Math.PI * f;
  const v = omega * i.radius;
  const ac = (v * v) / i.radius;
  return { f, omega, v, ac, force: m * ac, rpm: 60 * f, m };
}

export interface DiskState {
  /** Posición (m) en la mesa, con el eje en el origen; x a la derecha, y hacia el fondo. */
  pos: [number, number];
  vel: [number, number];
  /** Aceleración (m/s²); cero después de cortar la cuerda. */
  acc: [number, number];
  angle: number; // rad
  cut: boolean;
  /** Distancia al eje (m). */
  dist: number;
}
/**
 * Estado del disco al tiempo t (s). Gira en sentido antihorario desde (r, 0). Si `cutAt` no es nulo, en ese instante la
 * cuerda se corta y desde entonces el disco sigue en línea recta con la velocidad tangencial que tenía.
 */
export function diskAt(i: UcmInput, t: number, cutAt: number | null = null): DiskState {
  const { omega, v } = ucm(i);
  const r = i.radius;
  const tc = cutAt !== null && t > cutAt ? cutAt : t;
  const th = omega * tc;
  const p0: [number, number] = [r * Math.cos(th), r * Math.sin(th)];
  const v0: [number, number] = [-v * Math.sin(th), v * Math.cos(th)];
  if (cutAt !== null && t > cutAt) {
    const dt = t - cutAt;
    const pos: [number, number] = [p0[0] + v0[0] * dt, p0[1] + v0[1] * dt];
    return { pos, vel: v0, acc: [0, 0], angle: th, cut: true, dist: Math.hypot(...pos) };
  }
  const a = omega * omega * r;
  return { pos: p0, vel: v0, acc: [-a * Math.cos(th), -a * Math.sin(th)], angle: th, cut: false, dist: r };
}

/** Velocidad máxima (m/s) con la que un carro toma una curva plana de radio r sin derrapar: v = √(μ·g·r). */
export const maxCurveSpeed = (mu: number, r: number, g = G) => Math.sqrt(mu * g * r);
export interface CurveInput { radius: number; surface: string; speedKmh: number; massKg: number }
export interface CurveResult { mu: number; vmax: number; vmaxKmh: number; v: number; needed: number; available: number; skids: boolean; ac: number }
export function carOnCurve(i: CurveInput): CurveResult {
  assertInRange('El radio de la curva', i.radius, CM_LIMITS.curveRadius[0], CM_LIMITS.curveRadius[1]);
  assertInRange('La rapidez', i.speedKmh, CM_LIMITS.speed[0], CM_LIMITS.speed[1]);
  const mu = findSurface(i.surface).mu;
  const v = i.speedKmh / 3.6;
  const vmax = maxCurveSpeed(mu, i.radius);
  const needed = (i.massKg * v * v) / i.radius;
  const available = mu * i.massKg * G;
  return { mu, vmax, vmaxKmh: vmax * 3.6, v, needed, available, skids: needed > available, ac: (v * v) / i.radius };
}

export interface CmCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function ucmConditions(i: UcmInput): CmCondition[] {
  const r = ucm(i);
  const out: CmCondition[] = [];
  if (r.force > SENSOR.max) out.push({ level: 'invalido', text: `La cuerda tendría que hacer ${r.force.toFixed(1).replace('.', ',')} N: el sensor de fuerza llega solo a ${SENSOR.max} N y la cuerda escolar podría reventarse.`, fix: 'Gira más despacio (período mayor), usa un disco más liviano o un radio menor.' });
  if (i.period < 0.6) out.push({ level: 'advertencia', text: `Con ${(r.rpm).toFixed(0)} vueltas por minuto es difícil contar las vueltas con un cronómetro de mano: el error de reacción (≈ 0,1 s) pesa mucho.`, fix: 'Mide el tiempo de 10 vueltas y divide entre 10, o gira más despacio.' });
  return out;
}
export function curveConditions(i: CurveInput): CmCondition[] {
  const c = carOnCurve(i);
  const out: CmCondition[] = [];
  if (c.skids) out.push({ level: 'invalido', text: `A ${i.speedKmh} km/h la curva pide ${c.needed.toFixed(0)} N hacia el centro y la fricción da como máximo ${c.available.toFixed(0)} N: el carro derrapa y sale por la tangente.`, fix: `Baja la rapidez a menos de ${Math.floor(c.vmaxKmh)} km/h (v_máx = √(μ·g·r)) o toma la curva por una vía seca.` });
  if (i.surface === 'mojado' && !c.skids) out.push({ level: 'nota', text: `Con la vía mojada la rapidez máxima baja a ${c.vmaxKmh.toFixed(0)} km/h (con la seca sería ${(maxCurveSpeed(1, i.radius) * 3.6).toFixed(0)} km/h).`, fix: 'Con lluvia, reduce la rapidez antes de entrar a la curva.' });
  return out;
}

export const circularMotionSpec: ModelSpec = {
  name: 'Movimiento circular uniforme: período, frecuencia, rapidez angular y tangencial, aceleración y fuerza centrípetas',
  inputs: [
    { symbol: 'r', name: 'Radio del círculo (largo de la cuerda hasta el centro del disco)', unit: 'm', range: CM_LIMITS.radius, initial: 0.5 },
    { symbol: 'm', name: 'Masa del disco', unit: 'g', range: CM_LIMITS.mass, initial: 200 },
    { symbol: 'T', name: 'Período (tiempo de una vuelta)', unit: 's', range: CM_LIMITS.period, initial: 1 },
    { symbol: 'μ_s, r_c, v', name: 'Curva: superficie, radio y rapidez del carro', unit: '—, m, km/h', initial: 'seco, 50 m, 60 km/h' },
  ],
  outputs: [
    { symbol: 'f, ω', name: 'Frecuencia y rapidez angular', unit: 'Hz, rad/s' },
    { symbol: 'v', name: 'Rapidez tangencial', unit: 'm/s' },
    { symbol: 'a_c', name: 'Aceleración centrípeta', unit: 'm/s²' },
    { symbol: 'F_c', name: 'Fuerza centrípeta (tensión que lee el sensor)', unit: 'N' },
    { symbol: 'v_máx', name: 'Rapidez máxima en la curva', unit: 'km/h' },
  ],
  equations: ['f = 1/T;   ω = 2π/T;   v = ω·r = 2πr/T', 'a_c = v²/r = ω²·r;   F_c = m·v²/r', 'Al cortar la cuerda: x(t) = x₀ + v⃗₀·(t − t₀) (por la tangente)', 'Curva plana: μ_s·m·g ≥ m·v²/r  ⇒  v_máx = √(μ_s·g·r)'],
  initialConditions: ['Disco de 200 g en una mesa de aire, cuerda de 0,50 m, una vuelta por segundo; carro de 1000 kg en una curva de 50 m de radio.'],
  assumptions: [
    'Mesa de aire: sin rozamiento entre el disco y la mesa; la cuerda es inextensible y de masa despreciable.',
    'Movimiento circular UNIFORME: el período no cambia mientras se mide.',
    'Curva plana (sin peralte); la fricción estática máxima es μ_s·m·g; g = 9,78 m/s².',
  ],
  limits: [
    'Con un tapón girado a mano la cuerda no queda horizontal (el peso la inclina) y el radio cambia; la mesa de aire evita ese problema.',
    'Los coeficientes de fricción reales dependen de la llanta, la temperatura y el desgaste; salvo los de la tabla de Serway, son ilustrativos.',
    'Las curvas de las carreteras tienen peralte, que ayuda a dar la fuerza centrípeta; el modelo no lo incluye.',
  ],
  testCases: [
    'r = 0,50 m, m = 200 g, T = 1,00 s: v = π = 3,1416 m/s, ω = 6,2832 rad/s, a_c = 2π² = 19,739 m/s², F = 3,948 N.',
    'F ∝ v² con r y m fijos; F ∝ 1/r con v fija; F ∝ m.',
    'Curva de 50 m: seco v_máx = √(1,0·9,78·50) = 22,11 m/s = 79,6 km/h; mojado 56,3 km/h.',
    'Después de cortar la cuerda la velocidad es perpendicular al radio del punto de corte y la distancia al eje crece como √(r² + v²·Δt²).',
  ],
};

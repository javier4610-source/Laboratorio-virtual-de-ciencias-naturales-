import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Reflexión y refracción de la luz (grado 8.º).
 *   Reflexión: θ_r = θ_i.   Refracción (Snell): n₁·sen θ₁ = n₂·sen θ₂.
 *   Ángulo crítico: θ_c = arcsen(n₂/n₁) si n₁ > n₂.
 *   Reflectancia (Fresnel, luz no polarizada): R = (R_s + R_p)/2.
 */

export interface Medium { id: string; name: string; n: number; hidden?: boolean; }

/** Índices de refracción aproximados para luz amarilla (≈ 589 nm). */
export const MEDIA: Medium[] = [
  { id: 'aire', name: 'Aire', n: 1.0003 },
  { id: 'agua', name: 'Agua', n: 1.333 },
  { id: 'aceite', name: 'Aceite vegetal', n: 1.47 },
  { id: 'vidrio', name: 'Vidrio común', n: 1.52 },
  { id: 'diamante', name: 'Diamante', n: 2.42 },
  { id: 'misterio', name: 'Material misterioso', n: 1.4, hidden: true },
];

export function findMedium(id: string): Medium {
  const m = MEDIA.find((x) => x.id === id);
  if (!m) throw new Error(`Medio desconocido: ${id}`);
  return m;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function criticalAngle(n1: number, n2: number): number | null {
  return n1 > n2 ? deg(Math.asin(n2 / n1)) : null;
}

export function fresnelReflectance(n1: number, n2: number, thetaI: number, thetaT: number | null): number {
  if (thetaT === null) return 1;
  const ci = Math.cos(rad(thetaI)), ct = Math.cos(rad(thetaT));
  const rs = ((n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)) ** 2;
  const rp = ((n1 * ct - n2 * ci) / (n1 * ct + n2 * ci)) ** 2;
  return (rs + rp) / 2;
}

export interface OpticsResult {
  n1: number; n2: number;
  incidence: number; reflection: number; refraction: number | null;
  totalInternalReflection: boolean; criticalAngle: number | null;
  reflectance: number; transmittance: number;
  bendsToward: 'la normal' | 'lejos de la normal' | 'no se desvía';
  speedInMedium2: number; // m/s
}

export const C_LIGHT = 299_792_458;

export function refract(medium1: string, medium2: string, incidenceDeg: number): OpticsResult {
  assertInRange('El ángulo de incidencia', incidenceDeg, 0, 89.9);
  const n1 = findMedium(medium1).n, n2 = findMedium(medium2).n;
  const s = (n1 / n2) * Math.sin(rad(incidenceDeg));
  const tir = s > 1;
  const refraction = tir ? null : deg(Math.asin(s));
  const R = fresnelReflectance(n1, n2, incidenceDeg, refraction);
  return {
    n1, n2, incidence: incidenceDeg, reflection: incidenceDeg, refraction,
    totalInternalReflection: tir, criticalAngle: criticalAngle(n1, n2),
    reflectance: R, transmittance: 1 - R,
    bendsToward: incidenceDeg === 0 || n1 === n2 ? 'no se desvía' : n2 > n1 ? 'la normal' : 'lejos de la normal',
    speedInMedium2: C_LIGHT / n2,
  };
}

export const opticsModelSpec: ModelSpec = {
  name: 'Reflexión, refracción (ley de Snell) y reflexión total interna',
  inputs: [
    { symbol: 'medio 1', name: 'Medio por donde llega la luz', unit: '—', initial: 'aire' },
    { symbol: 'medio 2', name: 'Medio al que pasa la luz', unit: '—', initial: 'agua' },
    { symbol: 'θ₁', name: 'Ángulo de incidencia (medido desde la normal)', unit: '°', range: [0, 89.9], initial: 40 },
  ],
  outputs: [
    { symbol: 'θ_r', name: 'Ángulo de reflexión', unit: '°' },
    { symbol: 'θ₂', name: 'Ángulo de refracción', unit: '°' },
    { symbol: 'θ_c', name: 'Ángulo crítico', unit: '°' },
    { symbol: 'R', name: 'Fracción de luz reflejada', unit: '%' },
  ],
  equations: [
    'Reflexión: θ_r = θ_i',
    'Snell: n₁·sen θ₁ = n₂·sen θ₂',
    'Índice de refracción: n = c / v',
    'Ángulo crítico: sen θ_c = n₂/n₁ (solo si n₁ > n₂)',
    'Fresnel (no polarizada): R = ½[(n₁cos θ₁ − n₂cos θ₂)²/(n₁cos θ₁ + n₂cos θ₂)² + (n₁cos θ₂ − n₂cos θ₁)²/(n₁cos θ₂ + n₂cos θ₁)²]',
  ],
  initialConditions: ['Luz que pasa del aire al agua con 40° de incidencia.'],
  assumptions: [
    'Rayo de luz monocromática (amarilla, ≈ 589 nm); los índices son aproximados.',
    'Superficie lisa y plana; medios transparentes, homogéneos y sin absorción.',
  ],
  limits: [
    'No representa la dispersión (el índice cambia con el color), la absorción ni la polarización por separado.',
    'El índice del material misterioso es un valor didáctico.',
  ],
  testCases: [
    'Aire → agua a 40°: θ₂ ≈ 28,8°.',
    'Ángulo crítico agua → aire ≈ 48,6°; vidrio → aire ≈ 41,2°.',
    'Incidencia normal aire → vidrio: R ≈ 4,3 %.',
    'Por encima del ángulo crítico hay reflexión total (R = 100 %).',
  ],
};

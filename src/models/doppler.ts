import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Efecto Doppler del sonido y barrera del sonido (grado 11.º).
 *
 * 1) Rapidez del sonido en aire seco como gas ideal: c(T) = 331,3·√(1 + T/273,15) m/s (T en °C; 331,3 m/s a 0 °C).
 *    Cerca de la temperatura ambiente equivale a c ≈ 331,3 + 0,606·T, la fórmula del modelo de «sonido».
 * 2) Fuente y observador sobre una misma recta, con el aire quieto (Doppler clásico, p. ej. Serway, cap. 17):
 *      f' = f·(c + v_o)/(c − v_s)
 *    con v_o > 0 si el observador se ACERCA a la fuente y v_s > 0 si la fuente se ACERCA al observador (negativos si se
 *    alejan). Si la fuente alcanza la rapidez del sonido (v_s ≥ c), delante de ella no llegan frentes de onda: se
 *    forma una onda de choque.
 * 3) Fuente que pasa frente a un observador quieto (una ambulancia por la calle): la frecuencia que se oye en cada
 *    instante corresponde al sonido emitido antes, cuando la fuente formaba un ángulo θ con la recta hacia el oído:
 *      f' = f/(1 − (v_s/c)·cos θ),   tiempo de llegada t_r = t_e + d(t_e)/c.
 * 4) Fuente supersónica: número de Mach M = v_s/c; los frentes forman un cono con semiángulo θ tal que sen θ = 1/M.
 * Este archivo no depende de React ni del navegador.
 */

export const C0 = 331.3; // m/s a 0 °C (aire seco)
export function soundSpeed(tempC: number): number {
  assertInRange('La temperatura', tempC, -50, 60);
  return C0 * Math.sqrt(1 + tempC / 273.15);
}

export const DOPPLER_LIMITS = { f: [100, 2000] as [number, number], vs: [-100, 100] as [number, number], vo: [-50, 50] as [number, number], T: [-10, 45] as [number, number] };

export interface LineDoppler { c: number; f: number; fObs: number; ratio: number; lambdaFront: number; lambdaBack: number; shock: boolean }
/** Doppler en una recta: vs > 0 si la fuente se acerca al observador; vo > 0 si el observador se acerca a la fuente. */
export function dopplerLine(f: number, vs: number, vo: number, tempC = 20): LineDoppler {
  assertInRange('La frecuencia', f, 1, 1e5);
  const c = soundSpeed(tempC);
  const shock = vs >= c;
  const fObs = shock ? NaN : (f * (c + vo)) / (c - vs);
  // Longitud de onda delante y detrás de la fuente (en el aire, no depende del observador).
  return { c, f, fObs, ratio: fObs / f, lambdaFront: (c - Math.abs(vs)) / f, lambdaBack: (c + Math.abs(vs)) / f, shock };
}

export interface PassBy { points: { t: number; f: number }[]; fApproach: number; fRecede: number; fAtClosest: number }
/**
 * Fuente con rapidez vs (< c) por una recta que pasa a `d` metros del observador; la fuente está frente al
 * observador en t_e = 0. Devuelve la frecuencia que se oye contra el tiempo de LLEGADA del sonido.
 */
export function passBy(f: number, vs: number, d: number, tempC = 20, span = 6): PassBy {
  assertInRange('La rapidez de la fuente', vs, 0, 330);
  assertInRange('La distancia a la calle', d, 0.5, 200);
  const c = soundSpeed(tempC);
  const points: { t: number; f: number }[] = [];
  for (let i = 0; i <= 240; i++) {
    const te = -span + (2 * span * i) / 240;
    const x = vs * te; // posición de la fuente (el observador está en (0, d))
    const dist = Math.hypot(x, d);
    const cos = -x / dist; // componente de la velocidad de la fuente hacia el observador / vs
    points.push({ t: te + dist / c, f: f / (1 - (vs / c) * cos) });
  }
  return { points, fApproach: f / (1 - vs / c), fRecede: f / (1 + vs / c), fAtClosest: f };
}

export interface Mach { c: number; M: number; angleDeg: number | null }
export function machCone(vs: number, tempC = 20): Mach {
  const c = soundSpeed(tempC);
  const M = Math.abs(vs) / c;
  return { c, M, angleDeg: M > 1 ? (Math.asin(1 / M) * 180) / Math.PI : null };
}

/** Frentes de onda emitidos cada `period` s por una fuente que avanza en x con rapidez vs (para la vista 3D y el 2D). */
export function wavefronts(vs: number, c: number, t: number, period: number, max = 10): { center: number; radius: number }[] {
  const out: { center: number; radius: number }[] = [];
  for (let k = 0; k < max; k++) {
    const te = t - k * period;
    if (te < 0) break;
    out.push({ center: vs * te, radius: c * (t - te) });
  }
  return out;
}

export interface DpCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function lineConditions(r: LineDoppler, vs: number, vo: number): DpCondition[] {
  const out: DpCondition[] = [];
  if (r.shock) out.push({ level: 'invalido', text: `La fuente va a ${Math.round(vs)} m/s, igual o más rápido que el sonido (${r.c.toFixed(1).replace('.', ',')} m/s): delante de ella no llega ningún frente de onda y la fórmula de Doppler no se aplica.`, fix: 'Usa una rapidez menor que la del sonido, o mira la onda de choque en «Barrera del sonido».' });
  if (vo < -0.99 * r.c) out.push({ level: 'invalido', text: 'El observador se aleja casi tan rápido como el sonido: el sonido apenas lo alcanza.', fix: 'Usa una rapidez del observador menor.' });
  if (!r.shock && Math.abs(vs) > 0.3 * r.c) out.push({ level: 'nota', text: 'A más de un tercio de la rapidez del sonido el cambio de tono es enorme y el aire alrededor de la fuente deja de comportarse como en el modelo lineal (ondas de amplitud pequeña).', fix: 'Para un carro o una ambulancia usa entre 10 y 40 m/s.' });
  return out;
}

export const dopplerSpec: ModelSpec = {
  name: 'Efecto Doppler del sonido en aire quieto, paso de una fuente frente a un observador y cono de Mach',
  inputs: [
    { symbol: 'f', name: 'Frecuencia que emite la fuente', unit: 'Hz', range: [100, 2000], initial: 700 },
    { symbol: 'v_s', name: 'Velocidad de la fuente (positiva si se acerca)', unit: 'm/s', range: [-100, 400], initial: 25 },
    { symbol: 'v_o', name: 'Velocidad del observador (positiva si se acerca)', unit: 'm/s', range: [-50, 50], initial: 0 },
    { symbol: 'T', name: 'Temperatura del aire', unit: '°C', range: [-10, 45], initial: 20 },
    { symbol: 'M', name: 'Número de Mach del avión', unit: '—', range: [0.5, 3], initial: 2 },
  ],
  outputs: [
    { symbol: 'c', name: 'Rapidez del sonido', unit: 'm/s' },
    { symbol: "f'", name: 'Frecuencia que oye el observador', unit: 'Hz' },
    { symbol: 'λ', name: 'Longitud de onda delante y detrás de la fuente', unit: 'm' },
    { symbol: 'θ', name: 'Semiángulo del cono de Mach', unit: '°' },
  ],
  equations: [
    'c = 331,3·√(1 + T/273,15) m/s',
    "f' = f·(c + v_o)/(c − v_s)  (v_o, v_s > 0 al acercarse)",
    'λ_delante = (c − v_s)/f;  λ_detrás = (c + v_s)/f',
    "Paso frente al observador: f' = f/(1 − (v_s/c)·cos θ)",
    'M = v_s/c;  sen θ = 1/M (si M > 1)',
  ],
  initialConditions: ['Ambulancia con sirena de 700 Hz (ilustrativa) que se acerca a 25 m/s (90 km/h) por aire a 20 °C; observador quieto.'],
  assumptions: [
    'Aire seco y quieto (sin viento), como un gas ideal; la humedad cambia c en menos del 0,5 %.',
    'Movimiento uniforme en línea recta; ondas de amplitud pequeña.',
    'La sirena emite un tono puro de frecuencia fija (las sirenas reales alternan tonos).',
  ],
  limits: [
    'Con viento, las velocidades se miden respecto al aire, no al suelo.',
    'Cerca de la rapidez del sonido las ondas dejan de ser de amplitud pequeña; el modelo solo muestra la geometría del cono.',
    'Para la luz se usa el Doppler relativista, no esta fórmula.',
  ],
  testCases: [
    'c(0 °C) = 331,3 m/s y c(20 °C) = 343,2 m/s.',
    '700 Hz que se acercan a 25 m/s con aire a 20 °C: f\' = 755,0 Hz; al alejarse, 652,5 Hz.',
    'Observador que se acerca a 25 m/s a una fuente quieta: f\' = 751,0 Hz (no es lo mismo que la fuente se mueva).',
    'Mach 2: semiángulo del cono 30°.',
  ],
};

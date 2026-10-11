import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Cinemática en una dimensión (grado 9.º): un ciclista en una ciclorruta recta de 0 a 50 m.
 *   Movimiento rectilíneo uniforme (a = 0) o uniformemente acelerado:
 *     x = x0 + v0·t + ½·a·t²,   v = v0 + a·t   (x0 = 0).
 *   Si frena (a < 0) se detiene cuando v = 0 (t = v0/|a|) y no retrocede.
 *   Si llega al final de la pista (50 m), el recorrido termina allí y el cronómetro se detiene.
 */

export const TRACK_LENGTH = 50; // m
export const STROBE_INTERVAL = 0.5; // s entre fotografías estroboscópicas
export const TAPE_RES = 0.01; // m (cinta métrica de resolución 1 cm)
export const TIMER_RES = 0.01; // s
export const MATCH_TOLERANCE = 0.5; // m: error cuadrático medio para «¡Coincide!»

export const KIN_LIMITS = {
  v0: [0, 10] as [number, number],
  acceleration: [-3, 3] as [number, number],
  duration: [1, 10] as [number, number],
};

export interface KinInput {
  v0: number; // m/s
  acceleration: number; // m/s²
  duration: number; // s que se deja correr el cronómetro
}

export type EndReason = 'tiempo' | 'frenado' | 'pista';

export interface StrobePoint { t: number; x: number; v: number; }

export interface KinResult {
  /** Lectura del cronómetro al terminar el recorrido (s). */
  time: number;
  /** Distancia recorrida medida con la cinta (m). */
  distance: number;
  /** Velocidad al final del recorrido (m/s). */
  finalSpeed: number;
  /** Velocidad media = d/t con las lecturas de los instrumentos (m/s). */
  meanSpeed: number;
  endReason: EndReason;
  /** Instante en que el ciclista quedó en reposo al frenar (s), o null si no se detuvo. */
  stopTime: number | null;
  /** Instante en que alcanzó el final de la pista (s), o null si no llegó. */
  trackEndTime: number | null;
  /** Fotografías estroboscópicas cada 0,5 s (posición leída con la cinta). */
  strobe: StrobePoint[];
  warnings: string[];
}

export function validateInput(input: KinInput): void {
  assertInRange('La velocidad inicial', input.v0, ...KIN_LIMITS.v0);
  assertInRange('La aceleración', input.acceleration, ...KIN_LIMITS.acceleration);
  assertInRange('La duración del recorrido', input.duration, ...KIN_LIMITS.duration);
}

/** Instante en que un móvil que frena llega a v = 0 (null si no frena hasta detenerse). */
export function brakingStopTime(v0: number, a: number): number | null {
  if (a >= 0) return null;
  return v0 / -a;
}

/** Instante en que el móvil alcanza el final de la pista (null si nunca llega). */
export function trackEndTime(v0: number, a: number, length = TRACK_LENGTH): number | null {
  if (a === 0) return v0 > 0 ? length / v0 : null;
  const disc = v0 * v0 + 2 * a * length;
  if (disc < 0) return null; // frena antes de llegar
  const t = (-v0 + Math.sqrt(disc)) / a;
  if (!(t >= 0)) return null;
  // Si frena, solo cuenta si llega antes de detenerse.
  const tStop = brakingStopTime(v0, a);
  if (tStop !== null && t > tStop + 1e-12) return null;
  return t;
}

/** Posición y velocidad en el instante t (con las restricciones de frenado y fin de pista). */
export function stateAt(v0: number, a: number, t: number): { x: number; v: number } {
  const tt = Math.max(0, t);
  const tEnd = trackEndTime(v0, a);
  if (tEnd !== null && tt > tEnd) return { x: TRACK_LENGTH, v: 0 };
  const tStop = brakingStopTime(v0, a);
  const tm = tStop !== null ? Math.min(tt, tStop) : tt;
  const x = v0 * tm + 0.5 * a * tm * tm;
  const v = tStop !== null && tt >= tStop ? 0 : v0 + a * tt;
  return { x: Math.min(TRACK_LENGTH, Math.max(0, x)), v: Math.max(0, v) };
}

/** Duración real de la observación (s): la elegida, o menos si llega al final de la pista. */
export function observationTime(input: KinInput): { tObs: number; endReason: EndReason; tStop: number | null; tEnd: number | null } {
  const tEnd = trackEndTime(input.v0, input.acceleration);
  const tStop = brakingStopTime(input.v0, input.acceleration);
  if (tEnd !== null && tEnd < input.duration) return { tObs: tEnd, endReason: 'pista', tStop: null, tEnd };
  if (tStop !== null && tStop < input.duration) return { tObs: input.duration, endReason: 'frenado', tStop, tEnd: null };
  return { tObs: input.duration, endReason: 'tiempo', tStop: null, tEnd: null };
}

export function simulateRun(input: KinInput): KinResult {
  validateInput(input);
  const { v0, acceleration: a } = input;
  const { tObs, endReason, tStop, tEnd } = observationTime(input);
  const end = endReason === 'pista' ? { x: TRACK_LENGTH, v: v0 + a * tObs } : stateAt(v0, a, tObs);
  const time = roundToResolution(tObs, TIMER_RES);
  const distance = roundToResolution(end.x, TAPE_RES);
  const strobe: StrobePoint[] = [];
  const n = Math.floor(tObs / STROBE_INTERVAL + 1e-9);
  for (let i = 0; i <= n; i++) {
    const t = i * STROBE_INTERVAL;
    const s = stateAt(v0, a, t);
    strobe.push({ t, x: roundToResolution(s.x, TAPE_RES), v: s.v });
  }
  const warnings: string[] = [];
  if (endReason === 'pista') {
    warnings.push(`El ciclista llegó al final de la pista (50 m) a los ${fmtEs(time)} s: el recorrido terminó allí y el cronómetro se detuvo.`);
  }
  if (endReason === 'frenado' && tStop !== null && v0 > 0) {
    warnings.push(`El ciclista se detuvo a los ${fmtEs(roundToResolution(tStop, TIMER_RES))} s y permaneció en reposo hasta terminar el tiempo (no retrocede).`);
  }
  if (v0 === 0 && a <= 0) warnings.push('Con velocidad inicial 0 y sin aceleración positiva, el ciclista no se mueve.');
  return {
    time, distance, finalSpeed: Math.max(0, end.v), meanSpeed: time > 0 ? distance / time : 0,
    endReason, stopTime: tStop, trackEndTime: tEnd, strobe, warnings,
  };
}

/** Puntos de una curva continua x(t) y v(t) entre 0 y la duración observada. */
export function sampleCurve(input: KinInput, step = 0.05): StrobePoint[] {
  validateInput(input);
  const { tObs, endReason } = observationTime(input);
  const pts: StrobePoint[] = [];
  const n = Math.max(1, Math.ceil(tObs / step - 1e-9));
  for (let i = 0; i <= n; i++) {
    const t = Math.min(tObs, i * step);
    const s = i === n && endReason === 'pista'
      ? { x: TRACK_LENGTH, v: input.v0 + input.acceleration * tObs }
      : stateAt(input.v0, input.acceleration, t);
    pts.push({ t, x: s.x, v: s.v });
  }
  return pts;
}

/* ---------- Reto de gráficas ---------- */

export interface Challenge { id: string; name: string; v0: number; acceleration: number; duration: number; }
export const CHALLENGES: Challenge[] = [
  { id: 'mru', name: 'Velocidad constante de 4 m/s durante 6 s', v0: 4, acceleration: 0, duration: 6 },
  { id: 'reposo', name: 'Arranca desde el reposo con 1,5 m/s² durante 6 s', v0: 0, acceleration: 1.5, duration: 6 },
  { id: 'frena', name: 'Frena desde 8 m/s con −2 m/s² durante 5 s', v0: 8, acceleration: -2, duration: 5 },
];

export function findChallenge(id: string): Challenge {
  const c = CHALLENGES.find((x) => x.id === id);
  if (!c) throw new Error(`Reto desconocido: ${id}`);
  return c;
}

/**
 * Error cuadrático medio (m) entre la curva x–t del estudiante y la del reto,
 * comparadas cada 0,1 s entre 0 y la duración del reto. Si el recorrido del
 * estudiante termina antes, su posición se mantiene en el último valor medido.
 */
export function challengeError(input: KinInput, challenge: Challenge, step = 0.1): number {
  validateInput(input);
  const { tObs } = observationTime(input);
  const target = { v0: challenge.v0, acceleration: challenge.acceleration, duration: challenge.duration };
  const tTarget = observationTime(target).tObs;
  const n = Math.round(tTarget / step);
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const t = Math.min(tTarget, i * step);
    const xs = stateAt(input.v0, input.acceleration, Math.min(t, tObs)).x;
    const xt = stateAt(target.v0, target.acceleration, t).x;
    sum += (xs - xt) ** 2;
  }
  return Math.sqrt(sum / (n + 1));
}

function fmtEs(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

export const kinematicsModelSpec: ModelSpec = {
  name: 'Movimiento rectilíneo uniforme y uniformemente acelerado en una pista de 50 m',
  inputs: [
    { symbol: 'v₀', name: 'Velocidad inicial', unit: 'm/s', range: KIN_LIMITS.v0, initial: 2 },
    { symbol: 'a', name: 'Aceleración (negativa = frenado)', unit: 'm/s²', range: KIN_LIMITS.acceleration, initial: 1 },
    { symbol: 't', name: 'Duración del recorrido', unit: 's', range: KIN_LIMITS.duration, initial: 5 },
  ],
  outputs: [
    { symbol: 'd', name: 'Distancia recorrida (cinta métrica, 1 cm)', unit: 'm' },
    { symbol: 'v', name: 'Velocidad final', unit: 'm/s' },
    { symbol: 'v̄', name: 'Velocidad media = d/t', unit: 'm/s' },
    { symbol: 'x(t)', name: 'Posiciones estroboscópicas cada 0,5 s', unit: 'm' },
  ],
  equations: [
    'x = x₀ + v₀·t + ½·a·t²  (x₀ = 0)',
    'v = v₀ + a·t',
    'MRU (a = 0): x = v₀·t, la gráfica x–t es una recta de pendiente v₀',
    'Velocidad media: v̄ = d/t',
    'Frenado: se detiene en t = v₀/|a| tras recorrer d = v₀²/(2|a|)',
    'Pendiente de x–t = velocidad; área bajo v–t = desplazamiento',
  ],
  initialConditions: ['Ciclista en x = 0 m con velocidad inicial de 2 m/s y aceleración de 1 m/s² durante 5 s.'],
  assumptions: [
    'El movimiento es en línea recta y la aceleración es constante durante todo el recorrido.',
    'Al frenar, el ciclista se detiene cuando su velocidad llega a cero y no retrocede.',
    'Si alcanza el final de la pista (50 m) el recorrido termina allí y el cronómetro se detiene.',
    'Cinta métrica con resolución de 1 cm, cronómetro de 0,01 s y fotografías estroboscópicas cada 0,5 s.',
  ],
  limits: [
    'No representa causas del movimiento (fuerzas); eso se estudia en la práctica de las leyes de Newton.',
    'La aceleración real de una bicicleta no es constante: depende del pedaleo, la pendiente y el viento.',
    'El paso de movimiento a reposo al frenar o al final de la pista se modela como instantáneo.',
  ],
  testCases: [
    'MRU: x crece linealmente y v es constante.',
    'Desde el reposo: d = ½·a·t² (1,5 m/s² y 4 s → 12 m).',
    'La pendiente numérica de x–t coincide con v en cada instante.',
    'El área bajo la gráfica v–t es igual al desplazamiento.',
    'Al frenar se detiene en t = v₀/|a| con d = v₀²/(2|a|).',
    'Al llegar a 50 m el recorrido termina y se avisa.',
    'Las lecturas respetan la resolución de 1 cm y 0,01 s; las entradas fuera de rango se rechazan.',
    'El error del reto es 0 cuando los parámetros coinciden con el objetivo.',
  ],
};

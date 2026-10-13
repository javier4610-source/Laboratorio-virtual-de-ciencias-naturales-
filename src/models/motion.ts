import { assertInRange, roundToResolution, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Movimiento y distancia recorrida (grado 6.º) en la cancha de la I.E. Campo Alegre (Apartadó).
 *
 * Pista recta de 40 m con marcas pintadas cada 5 m. El estudiante pone un cono de salida y una bandera
 * de meta, mide la distancia con una cinta métrica y el tiempo con un cronómetro (de mano o fotopuertas).
 *
 * Cada móvil cruza la línea de salida en t = 0 con su rapidez inicial («salida lanzada») y avanza en línea
 * recta. Los móviles de rapidez constante cumplen s = v·t; el balón rueda frenando con desaceleración
 * constante (resistencia a la rodadura): s = v₀·t − ½·a·t² hasta detenerse en t = v₀/a.
 *
 * Cronometraje a mano (compañero): empieza tarde por el tiempo de reacción a la señal de salida
 * (≈ 0,20 s ± 0,05 s) y se detiene casi a tiempo en la llegada porque el móvil se ve venir
 * (retraso medio ≈ 0 s ± 0,06 s, a veces se anticipa). Por eso los tiempos de mano son algo cortos y
 * cambian de una repetición a otra.
 */

export const TRACK_LENGTH = 40; // m: largo de la pista sobre la cancha
export const MARK_SPACING = 5; // m entre marcas pintadas (y entre fotopuertas intermedias)
export const MIN_GAP = 5; // m: separación mínima entre la salida y la meta
export const TAPE_RES = 0.01; // m (cinta métrica de 1 cm)
export const TIMER_RES = 0.01; // s (cronómetro y temporizador de fotopuertas)
export const MS_TO_KMH = 3.6; // 1 m/s = 3,6 km/h
export const SPEED_OF_SOUND = 343; // m/s a ≈ 20 °C (solo para la nota sobre el pitazo lejano)

export const MOTION_LIMITS = {
  start: [0, TRACK_LENGTH - MIN_GAP] as [number, number],
  finish: [MIN_GAP, TRACK_LENGTH] as [number, number],
  reaction: [0.1, 0.4] as [number, number],
};

/** Tiempos de reacción del cronometrador humano (s). */
export const REACTION = {
  startMean: 0.2, startSigma: 0.05, startMin: 0.1, startMax: 0.45,
  stopMean: 0, stopSigma: 0.06, stopMin: -0.15, stopMax: 0.3,
};

/** Ficha de los instrumentos (respaldo si la práctica no está en INSTRUMENTS; mismos campos que InstrumentSpec). */
export const MOTION_INSTRUMENTS = [
  { id: 'cinta', name: 'Cinta métrica de 50 m (fibra de vidrio)', quantity: 'Distancia entre la salida y la meta', unit: 'm', resolution: TAPE_RES, sigma: 0.02, nonNegative: true, note: 'La cinta no queda del todo templada ni recta sobre el piso y el cero no se alinea exactamente con el borde del cono.' },
  { id: 'fotopuerta', name: 'Fotopuertas con temporizador (0,01 s)', quantity: 'Tiempo entre la salida y la meta', unit: 's', resolution: TIMER_RES, sigma: 0.003, nonNegative: true, note: 'El haz se corta con la parte del móvil que va adelante (pecho, rueda o balón), no siempre con el mismo punto.' },
  { id: 'cronometro', name: 'Cronómetro de mano (0,01 s)', quantity: 'Tiempo entre la salida y la meta', unit: 's', resolution: TIMER_RES, sigma: 0.08, nonNegative: true, note: 'Tiempo de reacción humano: se arranca tarde (≈ 0,2 s) y se detiene casi a tiempo porque el móvil se ve llegar.' },
];

export type MoverId = 'caminante' | 'corredor' | 'bicicleta' | 'balon' | 'carrito';
export type MoverKind = 'persona' | 'bicicleta' | 'balon' | 'carrito';

export interface Mover {
  id: MoverId;
  name: string;
  /** Nombre corto para tablas y gráficas. */
  short: string;
  kind: MoverKind;
  /** Rapidez al cruzar la salida (m/s). */
  v0: number;
  /** Desaceleración constante (m/s², ≥ 0). 0 = rapidez constante. */
  decel: number;
  /** Longitud de un paso (personas) o perímetro de la rueda (m), para la animación y el sonido. */
  stride: number;
}

export const MOVERS: Mover[] = [
  { id: 'caminante', name: 'Estudiante caminando', short: 'Caminante', kind: 'persona', v0: 1.4, decel: 0, stride: 0.7 },
  { id: 'corredor', name: 'Estudiante corriendo', short: 'Corredor', kind: 'persona', v0: 4.5, decel: 0, stride: 1.5 },
  { id: 'bicicleta', name: 'Bicicleta', short: 'Bicicleta', kind: 'bicicleta', v0: 5.5, decel: 0, stride: 2.07 },
  { id: 'balon', name: 'Balón rodando (frena)', short: 'Balón', kind: 'balon', v0: 6, decel: 0.4, stride: 0.69 },
  { id: 'carrito', name: 'Carrito de juguete (pilas)', short: 'Carrito', kind: 'carrito', v0: 0.9, decel: 0, stride: 0.13 },
];

export function findMover(id: string): Mover {
  const m = MOVERS.find((x) => x.id === id);
  if (!m) throw new Error(`Móvil desconocido: ${id}`);
  return m;
}

export const isUniform = (m: Mover) => m.decel === 0;

/** Distancia en la que el móvil se detiene (m); Infinity si no frena. */
export function stopDistance(m: Mover): number {
  return m.decel > 0 ? (m.v0 * m.v0) / (2 * m.decel) : Infinity;
}

/** Distancia recorrida desde la salida en el instante t (s ≥ 0). */
export function positionAt(m: Mover, t: number): number {
  const tt = Math.max(0, t);
  if (m.decel === 0) return m.v0 * tt;
  const tm = Math.min(tt, m.v0 / m.decel);
  return m.v0 * tm - 0.5 * m.decel * tm * tm;
}

/** Rapidez en el instante t (m/s). */
export function speedAt(m: Mover, t: number): number {
  const tt = Math.max(0, t);
  return Math.max(0, m.v0 - m.decel * tt);
}

/** Instante en que el móvil ha recorrido s metros desde la salida, o null si se detiene antes. */
export function timeToReach(m: Mover, s: number): number | null {
  if (!(s >= 0)) throw new RangeError('La distancia debe ser un número no negativo.');
  if (s === 0) return 0;
  if (m.decel === 0) return m.v0 > 0 ? s / m.v0 : null;
  const disc = m.v0 * m.v0 - 2 * m.decel * s;
  if (disc < -1e-12) return null;
  // Forma estable de la raíz menor de ½·a·t² − v₀·t + s = 0.
  return (2 * s) / (m.v0 + Math.sqrt(Math.max(0, disc)));
}

export const toKmh = (v: number) => v * MS_TO_KMH;
export const toMs = (kmh: number) => kmh / MS_TO_KMH;

/** Rapidez media con las lecturas de los instrumentos (distancia ÷ tiempo). */
export function meanSpeed(distance: number, time: number): number {
  if (!(time > 0)) throw new RangeError('El tiempo debe ser mayor que cero.');
  return distance / time;
}

export type Trip = 'ida' | 'idavuelta';

export interface CourseInput {
  moverId: MoverId;
  /** Posición del cono de salida sobre la cancha (m). */
  start: number;
  /** Posición de la bandera de meta (m). */
  finish: number;
  trip: Trip;
}

export function validateCourse(input: { start: number; finish: number }): void {
  assertInRange('La posición del cono de salida', input.start, ...MOTION_LIMITS.start);
  assertInRange('La posición de la bandera de meta', input.finish, ...MOTION_LIMITS.finish);
  if (input.finish - input.start < MIN_GAP - 1e-9) {
    throw new RangeError(`La meta debe quedar al menos ${MIN_GAP} m después de la salida.`);
  }
}

/** Posición (m desde la salida) en el instante t durante un recorrido; en ida y vuelta regresa a la salida. */
export function tripPosition(m: Mover, d: number, trip: Trip, t: number): number {
  if (trip === 'ida') return positionAt(m, t);
  const half = d / m.v0;
  const tt = Math.max(0, t);
  return tt <= half ? m.v0 * tt : Math.max(0, 2 * d - m.v0 * tt);
}

/** Distancia total recorrida (camino) hasta el instante t. */
export function pathLengthAt(m: Mover, d: number, trip: Trip, t: number): number {
  if (trip === 'ida') return positionAt(m, t);
  return Math.min(2 * d, m.v0 * Math.max(0, t));
}

export interface Split {
  /** Instante (s) en que el móvil cruza la fotopuerta. */
  t: number;
  /** Posición de la fotopuerta medida desde la salida (m). */
  x: number;
  /** Distancia recorrida hasta ese instante (m). */
  path: number;
}

export interface MotionResult {
  mover: Mover;
  /** Distancia real entre el cono y la bandera (m). */
  d: number;
  /** Tiempo real del recorrido (s): de la salida a la meta, o de ida y vuelta. */
  time: number;
  /** Lectura ideal del temporizador de fotopuertas (resolución 0,01 s). */
  gateTime: number;
  /** Distancia recorrida (camino) y desplazamiento (m). */
  pathLength: number;
  displacement: number;
  /** Rapidez media = camino/tiempo y velocidad media = desplazamiento/tiempo (m/s), con el tiempo real. */
  meanSpeed: number;
  meanVelocity: number;
  /** Rapidez al cruzar la meta (ida) o al volver a la salida (m/s). */
  finalSpeed: number;
  /** Cruces por las fotopuertas cada 5 m (incluye la salida y la llegada). */
  splits: Split[];
  warnings: string[];
}

/** Recorrido completo de un móvil entre el cono de salida y la bandera de meta. */
export function simulateMotion(input: CourseInput): MotionResult {
  validateCourse(input);
  const m = findMover(input.moverId);
  const d = input.finish - input.start;
  if (input.trip === 'idavuelta' && !isUniform(m)) {
    throw new RangeError('El recorrido de ida y vuelta solo se modela con móviles de rapidez constante (el balón no regresa solo).');
  }
  const warnings: string[] = [];
  const gates: number[] = [];
  for (let k = 1; k * MARK_SPACING < d - 1e-9; k++) gates.push(k * MARK_SPACING);
  gates.push(d);
  const splits: Split[] = [{ t: 0, x: 0, path: 0 }];
  let time: number;
  if (input.trip === 'ida') {
    const tArr = timeToReach(m, d);
    if (tArr === null) throw new RangeError(`${m.name} se detiene antes de llegar a la meta.`);
    time = tArr;
    for (const g of gates) splits.push({ t: timeToReach(m, g) as number, x: g, path: g });
  } else {
    const half = d / m.v0;
    time = 2 * half;
    for (const g of gates) splits.push({ t: g / m.v0, x: g, path: g });
    const back = [...gates].reverse().slice(1).concat(0);
    for (const g of back) splits.push({ t: time - g / m.v0, x: g, path: 2 * d - g });
  }
  const pathLength = input.trip === 'ida' ? d : 2 * d;
  const displacement = input.trip === 'ida' ? d : 0;
  const finalSpeed = speedAt(m, time);
  if (!isUniform(m)) {
    warnings.push(`El balón frena: cruzó la salida a ${fmtEs(m.v0, 1)} m/s y llegó a la meta a ${fmtEs(finalSpeed, 1)} m/s. La rapidez media no es la rapidez en cada instante.`);
  }
  if (input.trip === 'idavuelta') {
    warnings.push('En ida y vuelta el móvil regresa al punto de partida: recorrió una distancia, pero su desplazamiento es 0 m.');
  }
  return {
    mover: m, d, time, gateTime: roundToResolution(time, TIMER_RES), pathLength, displacement,
    meanSpeed: pathLength / time, meanVelocity: displacement / time, finalSpeed, splits, warnings,
  };
}

/** Normal estándar a partir de dos uniformes (Box–Muller). */
function normal(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface HandTiming {
  /** Retraso al arrancar el cronómetro tras la señal de salida (s, > 0). */
  startDelay: number;
  /** Retraso al detenerlo cuando el móvil cruza la meta (s; negativo = se anticipó). */
  stopDelay: number;
  /** Lectura del cronómetro de mano (s, resolución 0,01 s). */
  reading: number;
  /** Error de la lectura respecto del tiempo real (s). */
  error: number;
}

/**
 * Lectura de un cronómetro manejado a mano por un compañero. `seed` identifica la repetición
 * (misma semilla → misma lectura) y `startMean` el tiempo de reacción medio a la señal de salida.
 */
export function handTiming(trueTime: number, seed: number, startMean: number = REACTION.startMean): HandTiming {
  assertInRange('El tiempo real del recorrido', trueTime, 0, 1000);
  assertInRange('El tiempo de reacción medio', startMean, ...MOTION_LIMITS.reaction);
  const rand = seededRandom(seed);
  const startDelay = clampN(startMean + REACTION.startSigma * normal(rand), REACTION.startMin, Math.max(REACTION.startMax, startMean + 0.2));
  const stopDelay = clampN(REACTION.stopMean + REACTION.stopSigma * normal(rand), REACTION.stopMin, REACTION.stopMax);
  const reading = roundToResolution(Math.max(0, trueTime - startDelay + stopDelay), TIMER_RES);
  return { startDelay, stopDelay, reading, error: reading - trueTime };
}

export type RaceWinner = 1 | 2 | 'empate';

export interface RaceResult {
  t1: number;
  t2: number;
  /** Lecturas de las fotopuertas de cada carril (0,01 s). */
  gate1: number;
  gate2: number;
  /** Ganador según las fotopuertas: empate si marcan lo mismo. */
  winner: RaceWinner;
  /** Punto en que un móvil alcanza al otro antes de la meta (si ocurre). */
  overtake: { t: number; x: number } | null;
}

/** Carrera de dos móviles que cruzan la salida a la vez, en carriles paralelos, hasta la misma meta. */
export function race(id1: MoverId, id2: MoverId, d: number): RaceResult {
  assertInRange('La distancia de la carrera', d, MIN_GAP, TRACK_LENGTH);
  const a = findMover(id1), b = findMover(id2);
  const t1 = timeToReach(a, d), t2 = timeToReach(b, d);
  if (t1 === null || t2 === null) throw new RangeError('Uno de los móviles se detiene antes de la meta.');
  const gate1 = roundToResolution(t1, TIMER_RES), gate2 = roundToResolution(t2, TIMER_RES);
  const winner: RaceWinner = gate1 === gate2 ? 'empate' : gate1 < gate2 ? 1 : 2;
  // Busca un cambio de signo de s₁ − s₂ (adelantamiento) entre la salida y la primera llegada.
  let overtake: RaceResult['overtake'] = null;
  const tEnd = Math.min(t1, t2);
  const f = (t: number) => positionAt(a, t) - positionAt(b, t);
  const n = 400;
  let prevT = 1e-6, prev = f(prevT);
  for (let i = 1; i <= n && !overtake; i++) {
    const t = (i / n) * tEnd;
    const cur = f(t);
    if (prev !== 0 && cur !== 0 && Math.sign(cur) !== Math.sign(prev)) {
      let lo = prevT, hi = t;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(mid)) === Math.sign(prev)) lo = mid; else hi = mid;
      }
      const tc = (lo + hi) / 2;
      const xc = positionAt(a, tc);
      if (xc > 0 && xc < d) overtake = { t: tc, x: xc };
    }
    prevT = t; prev = cur;
  }
  return { t1, t2, gate1, gate2, winner, overtake };
}

function fmtEs(v: number, decimals: number): string {
  return v.toFixed(decimals).replace('.', ',');
}

export const motionModelSpec: ModelSpec = {
  name: 'Movimiento rectilíneo en una pista de 40 m: rapidez media, distancia y desplazamiento',
  inputs: [
    { symbol: 'x_s', name: 'Posición del cono de salida', unit: 'm', range: MOTION_LIMITS.start, initial: 5 },
    { symbol: 'x_m', name: 'Posición de la bandera de meta', unit: 'm', range: MOTION_LIMITS.finish, initial: 25 },
    { symbol: '—', name: 'Móvil (caminante 1,4 m/s; corredor 4,5 m/s; bicicleta 5,5 m/s; balón 6 m/s que frena 0,4 m/s²; carrito 0,9 m/s)', unit: '—', initial: 'corredor' },
    { symbol: '—', name: 'Recorrido (ida, o ida y vuelta)', unit: '—', initial: 'ida' },
    { symbol: '—', name: 'Cronometraje (fotopuertas, tu cronómetro o el de un compañero)', unit: '—', initial: 'fotopuertas' },
    { symbol: 't_r', name: 'Tiempo de reacción medio del compañero al arrancar', unit: 's', range: MOTION_LIMITS.reaction, initial: REACTION.startMean },
  ],
  outputs: [
    { symbol: 'd', name: 'Distancia entre salida y meta (cinta métrica, 1 cm)', unit: 'm' },
    { symbol: 't', name: 'Tiempo del recorrido (cronómetro o fotopuertas, 0,01 s)', unit: 's' },
    { symbol: 'v̄', name: 'Rapidez media = distancia/tiempo', unit: 'm/s y km/h' },
    { symbol: 'Δx', name: 'Desplazamiento (ida y vuelta: 0 m)', unit: 'm' },
    { symbol: 'x(t)', name: 'Tiempos de paso por fotopuertas cada 5 m', unit: 's' },
  ],
  equations: [
    'Rapidez media: v̄ = d/t',
    'Rapidez constante: x = v·t (la gráfica x–t es una recta y su pendiente es v)',
    'Balón que frena: x = v₀·t − ½·a·t², hasta detenerse en t = v₀/a',
    'Conversión: 1 m/s = 3,6 km/h (1 km = 1000 m; 1 h = 3600 s)',
    'Ida y vuelta: distancia recorrida = 2·d; desplazamiento = 0; velocidad media = 0',
    'Cronómetro de mano: t_mano = t_real − t_arranque + t_parada (t_arranque ≈ 0,20 s ± 0,05 s; t_parada ≈ 0 s ± 0,06 s)',
  ],
  initialConditions: ['Estudiante corriendo a 4,5 m/s; cono de salida en 5 m, bandera de meta en 25 m y cinta métrica tendida 20 m; cronometraje con fotopuertas.'],
  assumptions: [
    'Salida lanzada: cada móvil cruza la línea de salida en t = 0 con su rapidez de marcha (no se modela el arranque desde el reposo).',
    'Movimiento en línea recta sobre la pista. Caminante, corredor, bicicleta y carrito mantienen la rapidez constante; el balón frena con desaceleración constante de 0,4 m/s² (resistencia a la rodadura en el piso de concreto).',
    'En ida y vuelta, el giro en la meta es instantáneo y la rapidez de regreso es igual a la de ida.',
    'Las fotopuertas registran el instante en que el móvil cruza cada línea con resolución de 0,01 s; la cinta métrica tiene resolución de 1 cm.',
    'El cronómetro de mano lo maneja un compañero que reacciona tarde a la señal de salida (≈ 0,20 s) y casi a tiempo en la llegada, porque ve venir al móvil; la lectura cambia de una repetición a otra. Con tu propio cronómetro, la reacción es la tuya.',
  ],
  limits: [
    'Las rapideces de cada móvil son valores típicos fijos; en la realidad una persona acelera, se cansa y cambia el ritmo.',
    'No considera el viento, la pendiente de la cancha ni los cambios del piso; el balón no rebota ni se desvía.',
    'Los dibujos de los móviles no están a escala (el balón y el carrito se dibujan más grandes para verlos).',
    'Si el pitazo se oye a 40 m, llega ≈ 0,12 s tarde (el sonido viaja a ≈ 343 m/s); el modelo del compañero supone que arranca al ver la señal.',
    'La animación usa el reloj del computador: con tu propio cronómetro, la pantalla y el teclado pueden añadir algunos milisegundos de retraso.',
  ],
  testCases: [
    'Rapidez constante: x = v·t; 20 m a 4,5 m/s → 4,44 s.',
    'La pendiente de x–t de las fotopuertas es igual a la rapidez del móvil.',
    'Conversión: 4,5 m/s = 16,2 km/h y 36 km/h = 10 m/s.',
    'El balón frena: el tiempo para 40 m es 10 s y llega a 2 m/s; su rapidez media disminuye con la distancia.',
    'Ida y vuelta: distancia 2·d, desplazamiento 0 y velocidad media 0.',
    'Carrera balón contra corredor: el balón gana en 20 m, el corredor en 35 m; el corredor lo alcanza en 33,75 m.',
    'Cronómetro de mano: lecturas que cambian con la semilla, sesgo medio ≈ −0,2 s y desviación ≈ 0,08 s; misma semilla → misma lectura.',
    'Las entradas fuera de rango y la meta a menos de 5 m de la salida se rechazan.',
  ],
};

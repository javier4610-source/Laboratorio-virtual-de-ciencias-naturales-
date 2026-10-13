import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Trabajo, potencia y plano inclinado (grado 9.º).
 *
 * Un bloque de madera (con pesas ranuradas encima) sube por una rampa de 1,00 m, jalado con un dinamómetro
 * PARALELO a la rampa y con velocidad constante. Fuerzas sobre el bloque (eje x a lo largo de la rampa):
 *   F − m·g·sen θ − f = 0,   N = m·g·cos θ,   f = μ·N   (rozamiento cinético)
 *   →  F = m·g·(sen θ + μ·cos θ)
 * El bloque recorre d = 0,60 m sobre la rampa (marcas de 10 cm y 70 cm) y sube h = d·sen θ.
 *   Trabajo de entrada:            W = F·d
 *   Trabajo para subirlo derecho:  W_útil = m·g·h  (= aumento de energía potencial)
 *   Calor por rozamiento:          Q = f·d = μ·m·g·cos θ·d,  y  W = m·g·h + Q  (conservación)
 *   Ventaja mecánica ideal:        VM_i = d/h = 1/sen θ;  real: VM = m·g/F
 *   Eficiencia:                    η = m·g·h/(F·d) = sen θ/(sen θ + μ·cos θ) = VM/VM_i
 *   Potencia:                      P = W/t = F·v   (v constante, t = d/v)
 * Con un torno de potencia nominal P_t la cuerda avanza a v = P_t/F, pero su caja de engranajes no supera 0,50 m/s.
 *
 * Bono: una persona sube la escalera del colegio en Apartadó: P = m·g·h/t con h = n·(altura de un escalón).
 */

/** Aceleración de la gravedad usada en la práctica (m/s²). */
export const G = 9.8;

/** Geometría de la rampa (m). El soporte está a 0,60 m (en horizontal) de la bisagra. */
export const RAMP = { length: 1.0, startMark: 0.1, endMark: 0.7, travel: 0.6, postDistance: 0.6 };

/** Bloque de madera con gancho y pesas ranuradas de 100 g que se le ponen encima. */
export const BLOCK = { mass: 0.3, slotMass: 0.1, maxSlots: 7 };

/** Altura de un escalón de la escalera del colegio (m). */
export const STEP_HEIGHT = 0.17;

/** Rapidez máxima de la cuerda del torno (m/s). */
export const MOTOR_MAX_SPEED = 0.5;

/** Capacidad del dinamómetro (N): por encima, la lectura se sale de la escala. */
export const DYNAMOMETER_MAX = 10;

export const WORK_LIMITS = {
  angle: [5, 45] as [number, number], // grados
  mass: [0.3, 1.0] as [number, number], // kg (bloque + pesas)
  handSpeed: [0.05, 0.5] as [number, number], // m/s
  motorPower: [0.5, 3] as [number, number], // W
  personMass: [30, 100] as [number, number], // kg
  steps: [5, 40] as [number, number], // escalones
  pace: [0.5, 4] as [number, number], // escalones por segundo
};

export type SurfaceId = 'madera' | 'lija' | 'teflon' | 'ruedas';

/** Tiras que se ponen sobre la rampa, con su coeficiente de rozamiento cinético (efectivo, en las ruedas). */
export const SURFACES: { id: SurfaceId; name: string; short: string; mu: number; note: string }[] = [
  { id: 'madera', name: 'Madera sobre madera', short: 'Madera', mu: 0.3, note: 'Rozamiento cinético típico de madera lijada sobre madera (0,25 a 0,40).' },
  { id: 'lija', name: 'Lija de grano grueso', short: 'Lija', mu: 0.6, note: 'La lija engancha las irregularidades de la madera: mucho rozamiento.' },
  { id: 'teflon', name: 'Lámina de teflón', short: 'Teflón', mu: 0.06, note: 'El teflón (PTFE) es de los materiales más resbalosos que existen.' },
  { id: 'ruedas', name: 'Ruedas (banda de rodillos)', short: 'Ruedas', mu: 0.02, note: 'Las ruedas casi no deslizan; queda una pequeña resistencia a la rodadura y el roce de los ejes.' },
];

export function findSurface(id: string) {
  const s = SURFACES.find((x) => x.id === id);
  if (!s) throw new Error(`Superficie desconocida: ${id}`);
  return s;
}

export type InstrumentId = 'dinamometro' | 'regla' | 'cronometro' | 'bascula';

export interface WorkInstrumentSpec {
  id: string; name: string; quantity: string; unit: string;
  resolution: number; sigma?: number; relSigma?: number; nonNegative?: boolean; note: string;
}

/** Ficha de los instrumentos (coincide con la entrada sugerida para src/labs/instruments.ts). */
export const WORK_INSTRUMENTS: Record<InstrumentId, WorkInstrumentSpec> = {
  dinamometro: { id: 'dinamometro', name: 'Dinamómetro de resorte (0 a 10 N)', quantity: 'Fuerza (peso del bloque y fuerza paralela a la rampa)', unit: 'N', resolution: 0.1, sigma: 0.06, relSigma: 0.015, nonNegative: true, note: 'El indicador oscila al jalar (no es fácil mantener la velocidad constante), paralaje y ajuste del cero.' },
  regla: { id: 'regla', name: 'Regla y cinta métrica graduadas en milímetros', quantity: 'Recorrido sobre la rampa, altura ganada y altura de un escalón', unit: 'cm', resolution: 0.1, sigma: 0.1, nonNegative: true, note: 'Alinear las marcas con el borde del bloque y paralaje al leer la regla vertical.' },
  cronometro: { id: 'cronometro', name: 'Cronómetro digital (0,01 s)', quantity: 'Tiempo de subida', unit: 's', resolution: 0.01, sigma: 0.12, nonNegative: true, note: 'Tiempo de reacción de quien pulsa al arrancar y al detener (≈ 0,1 a 0,2 s).' },
  bascula: { id: 'bascula', name: 'Báscula de piso (0,1 kg)', quantity: 'Masa de la persona', unit: 'kg', resolution: 0.1, sigma: 0.1, nonNegative: true, note: 'Postura sobre la báscula y ropa o zapatos.' },
};

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Fuerza paralela a la rampa para subir con velocidad constante: F = m·g·(sen θ + μ·cos θ). */
export function rampEffort(mass: number, angleDeg: number, mu: number): number {
  if (!(mass > 0)) throw new RangeError('La masa debe ser positiva.');
  if (!(mu >= 0)) throw new RangeError('El coeficiente de rozamiento no puede ser negativo.');
  if (!(angleDeg >= 0 && angleDeg < 90)) throw new RangeError('El ángulo debe estar entre 0° y 90°.');
  const t = rad(angleDeg);
  return mass * G * (Math.sin(t) + mu * Math.cos(t));
}

/** Eficiencia de la rampa: η = sen θ/(sen θ + μ·cos θ). */
export function rampEfficiency(angleDeg: number, mu: number): number {
  if (!(angleDeg > 0 && angleDeg < 90)) throw new RangeError('El ángulo debe estar entre 0° y 90° (sin incluirlos).');
  if (!(mu >= 0)) throw new RangeError('El coeficiente de rozamiento no puede ser negativo.');
  const t = rad(angleDeg);
  return Math.sin(t) / (Math.sin(t) + mu * Math.cos(t));
}

/** Ventaja mecánica ideal de la rampa: VM_i = d/h = 1/sen θ. */
export function idealAdvantage(angleDeg: number): number {
  if (!(angleDeg > 0 && angleDeg <= 90)) throw new RangeError('El ángulo debe estar entre 0° y 90°.');
  return 1 / Math.sin(rad(angleDeg));
}

/** Potencia media: P = W/t. */
export function averagePower(work: number, time: number): number {
  if (!(time > 0)) throw new RangeError('El tiempo debe ser positivo.');
  return work / time;
}

/** Ángulo de la rampa (grados) cuando la pinza del soporte está a una altura y (m) sobre la bisagra. */
export const angleFromSupport = (y: number) => (Math.atan2(y, RAMP.postDistance) * 180) / Math.PI;
/** Altura de la pinza del soporte (m) para un ángulo dado. */
export const supportHeight = (angleDeg: number) => RAMP.postDistance * Math.tan(rad(angleDeg));

/** Masa total del bloque con n pesas de 100 g. */
export function blockMass(slots: number): number {
  if (!Number.isInteger(slots) || slots < 0 || slots > BLOCK.maxSlots) throw new RangeError(`El número de pesas debe ser un entero entre 0 y ${BLOCK.maxSlots}.`);
  return Number((BLOCK.mass + slots * BLOCK.slotMass).toFixed(6));
}

export type Drive = 'mano' | 'torno';

export interface RampInput {
  angleDeg: number;
  mass: number; // kg (bloque + pesas)
  surface: SurfaceId;
  drive: Drive;
  handSpeed: number; // m/s (jalando con la mano)
  motorPower: number; // W (torno)
}

export interface RampResult {
  angleDeg: number;
  mu: number;
  weight: number; // N
  normal: number; // N
  friction: number; // N
  F: number; // N, fuerza paralela a la rampa
  d: number; h: number; // m
  workIn: number; // J, F·d
  workLift: number; // J, m·g·h
  heat: number; // J, f·d
  efficiency: number;
  vmIdeal: number; vm: number;
  speed: number; // m/s
  motorLimited: boolean; // el torno llegó a su rapidez máxima
  time: number; // s
  power: number; // W, F·v
  overload: boolean;
  /** Lecturas ideales con la resolución de cada instrumento. */
  weightReading: number | null; // N
  effortReading: number | null; // N (null: fuera de escala)
  distanceReading: number; heightReading: number; // cm
  timeReading: number; // s
}

export function simulateRamp(input: RampInput): RampResult {
  const { angleDeg, mass, drive } = input;
  assertInRange('El ángulo de la rampa', angleDeg, ...WORK_LIMITS.angle);
  assertInRange('La masa del bloque', mass, ...WORK_LIMITS.mass);
  if (drive !== 'mano' && drive !== 'torno') throw new Error(`Forma de jalar desconocida: ${drive}`);
  const { mu } = findSurface(input.surface);
  const t = rad(angleDeg);
  const weight = mass * G;
  const normal = weight * Math.cos(t);
  const friction = mu * normal;
  const F = weight * Math.sin(t) + friction;
  const d = RAMP.travel, h = d * Math.sin(t);
  const workIn = F * d, workLift = weight * h, heat = friction * d;

  let speed: number, motorLimited = false;
  if (drive === 'mano') {
    assertInRange('La rapidez con que se jala', input.handSpeed, ...WORK_LIMITS.handSpeed);
    speed = input.handSpeed;
  } else {
    assertInRange('La potencia del torno', input.motorPower, ...WORK_LIMITS.motorPower);
    speed = input.motorPower / F;
    if (speed > MOTOR_MAX_SPEED) { speed = MOTOR_MAX_SPEED; motorLimited = true; }
  }
  const time = d / speed;
  const overload = F > DYNAMOMETER_MAX;
  const ins = WORK_INSTRUMENTS;
  return {
    angleDeg, mu, weight, normal, friction, F, d, h, workIn, workLift, heat,
    efficiency: workLift / workIn,
    vmIdeal: d / h, vm: weight / F,
    speed, motorLimited, time, power: F * speed, overload,
    weightReading: weight > DYNAMOMETER_MAX ? null : roundToResolution(weight, ins.dinamometro.resolution),
    effortReading: overload ? null : roundToResolution(F, ins.dinamometro.resolution),
    distanceReading: roundToResolution(d * 100, ins.regla.resolution),
    heightReading: roundToResolution(h * 100, ins.regla.resolution),
    timeReading: roundToResolution(time, ins.cronometro.resolution),
  };
}

/** Cantidades que el estudiante calcula con sus lecturas (peso y fuerza en N, distancias en cm, tiempo en s). */
export function rampFromReadings(r: { weight: number; effort: number; dCm: number; hCm: number; t: number }) {
  if (!(r.effort > 0) || !(r.dCm > 0) || !(r.hCm > 0) || !(r.t > 0)) throw new RangeError('Las lecturas deben ser positivas.');
  const d = r.dCm / 100, h = r.hCm / 100;
  const workIn = r.effort * d, workLift = r.weight * h;
  return {
    workIn, workLift, heat: workIn - workLift,
    efficiency: workLift / workIn,
    vm: r.weight / r.effort, vmIdeal: d / h,
    speed: d / r.t, power: workIn / r.t,
  };
}

/* ------------------------------------------------------------------ bono: la escalera del colegio */

export interface StairsInput { personMass: number; steps: number; pace: number }

export interface StairsResult {
  height: number; // m
  time: number; // s
  work: number; // J
  power: number; // W
  verticalSpeed: number; // m/s
  massReading: number; stepReading: number; heightReading: number; timeReading: number; // kg, cm, cm, s
}

export function simulateStairs(input: StairsInput): StairsResult {
  assertInRange('La masa de la persona', input.personMass, ...WORK_LIMITS.personMass);
  assertInRange('El número de escalones', input.steps, ...WORK_LIMITS.steps);
  if (!Number.isInteger(input.steps)) throw new RangeError('El número de escalones debe ser entero.');
  assertInRange('El ritmo de subida', input.pace, ...WORK_LIMITS.pace);
  const height = input.steps * STEP_HEIGHT;
  const time = input.steps / input.pace;
  const work = input.personMass * G * height;
  const ins = WORK_INSTRUMENTS;
  return {
    height, time, work, power: work / time, verticalSpeed: height / time,
    massReading: roundToResolution(input.personMass, ins.bascula.resolution),
    stepReading: roundToResolution(STEP_HEIGHT * 100, ins.regla.resolution),
    heightReading: roundToResolution(height * 100, ins.regla.resolution),
    timeReading: roundToResolution(time, ins.cronometro.resolution),
  };
}

/** Potencia de una persona con sus lecturas: masa (kg), altura (m) y tiempo (s). */
export function humanPower(massKg: number, heightM: number, timeS: number): number {
  if (!(massKg > 0) || !(heightM >= 0)) throw new RangeError('La masa debe ser positiva y la altura no negativa.');
  return averagePower(massKg * G * heightM, timeS);
}

export const workPowerModelSpec: ModelSpec = {
  name: 'Trabajo, potencia y plano inclinado con rozamiento',
  inputs: [
    { symbol: 'θ', name: 'Ángulo de la rampa (altura de la pinza del soporte)', unit: '°', range: WORK_LIMITS.angle, initial: 30 },
    { symbol: 'm', name: 'Masa del bloque con sus pesas (bloque de 300 g + pesas de 100 g)', unit: 'kg', range: WORK_LIMITS.mass, initial: 0.5 },
    { symbol: 'μ', name: 'Coeficiente de rozamiento cinético de la tira (madera 0,30; lija 0,60; teflón 0,06; ruedas 0,02)', unit: '—', initial: 'madera (0,30)' },
    { symbol: 'tracción', name: 'Jalar con la mano o con un torno eléctrico', unit: '—', initial: 'mano' },
    { symbol: 'v', name: 'Rapidez con que se jala con la mano', unit: 'm/s', range: WORK_LIMITS.handSpeed, initial: 0.2 },
    { symbol: 'P_t', name: 'Potencia nominal del torno (cuerda a 0,50 m/s como máximo)', unit: 'W', range: WORK_LIMITS.motorPower, initial: 1.5 },
    { symbol: 'm_p', name: 'Masa de la persona (bono: escalera)', unit: 'kg', range: WORK_LIMITS.personMass, initial: 50 },
    { symbol: 'n', name: 'Escalones de 17 cm (bono: escalera)', unit: '—', range: WORK_LIMITS.steps, initial: 18 },
    { symbol: 'ritmo', name: 'Escalones por segundo (bono: escalera)', unit: '1/s', range: WORK_LIMITS.pace, initial: 2 },
  ],
  outputs: [
    { symbol: 'P = m·g', name: 'Peso del bloque (dinamómetro vertical, 0,1 N)', unit: 'N' },
    { symbol: 'F', name: 'Fuerza paralela a la rampa (dinamómetro, 0,1 N)', unit: 'N' },
    { symbol: 'd, h', name: 'Recorrido sobre la rampa y altura ganada (regla, 1 mm)', unit: 'cm' },
    { symbol: 't', name: 'Tiempo de subida (cronómetro, 0,01 s)', unit: 's' },
    { symbol: 'W, m·g·h, Q', name: 'Trabajo de entrada, energía potencial ganada y calor por rozamiento', unit: 'J' },
    { symbol: 'VM, η, P', name: 'Ventaja mecánica, eficiencia y potencia', unit: '—, %, W' },
  ],
  equations: [
    'Peso: P = m·g, con g = 9,8 m/s²',
    'Velocidad constante a lo largo de la rampa: F = m·g·sen θ + μ·m·g·cos θ',
    'Altura ganada: h = d·sen θ, con d = 0,60 m',
    'Trabajo de entrada: W = F·d;  trabajo para subirlo derecho: m·g·h',
    'Calor por rozamiento: Q = μ·m·g·cos θ·d;  W = m·g·h + Q',
    'Ventaja mecánica ideal: d/h = 1/sen θ;  real: VM = m·g/F',
    'Eficiencia: η = m·g·h/(F·d) = sen θ/(sen θ + μ·cos θ)',
    'Potencia: P = W/t = F·v;  con el torno, v = P_t/F (máximo 0,50 m/s)',
    'Escalera: P = m·g·h/t, con h = n·0,17 m y t = n/ritmo',
  ],
  initialConditions: [
    'Rampa a 30°, bloque de 500 g (300 g + 2 pesas de 100 g) sobre la tira de madera, jalado con la mano a 0,20 m/s.',
    'El bloque arranca en la marca de 10 cm y se detiene en la de 70 cm (d = 60 cm).',
    'Escalera: persona de 50 kg, 18 escalones de 17 cm, 2 escalones por segundo.',
  ],
  assumptions: [
    'El bloque sube con velocidad constante (sin aceleración): la fuerza neta a lo largo de la rampa es cero.',
    'El dinamómetro y la cuerda son paralelos a la rampa; la cuerda no tiene masa ni se estira.',
    'Rozamiento cinético de Coulomb: f = μ·N, independiente de la rapidez y del área de contacto. En las ruedas, μ es un coeficiente efectivo de rodadura.',
    'g = 9,8 m/s². La rampa es rígida y no se desliza sobre la mesa.',
    'Se ignoran el arranque y el frenado: el cronómetro mide el tramo a velocidad constante.',
    'El torno entrega exactamente su potencia nominal a la cuerda; su caja de engranajes limita la rapidez a 0,50 m/s.',
    'En la escalera solo se cuenta el trabajo para subir el cuerpo (m·g·h) a ritmo constante.',
  ],
  limits: [
    'El dinamómetro solo mide hasta 10 N: con fuerzas mayores la lectura se sale de la escala.',
    'μ real varía con la humedad, el desgaste y la rapidez; el rozamiento estático (para arrancar) es mayor que el cinético y no se modela.',
    'No incluye la resistencia del aire, la energía cinética del bloque ni el calor que se reparte entre el bloque y la rampa.',
    'Con μ grande y ángulos pequeños la rampa casi no ahorra fuerza; con ángulos de más de 45° el montaje no es estable.',
    'La potencia humana calculada es solo la mecánica útil: los músculos gastan unas cuatro veces más energía (eficiencia ≈ 25 %).',
  ],
  testCases: [
    'Caso inicial calculado a mano: 0,5 kg a 30° sobre madera: F = 4,9·(0,5 + 0,3·0,866) = 3,723 N (lectura 3,7 N); h = 30,0 cm; t = 3,00 s.',
    'Conservación: F·d = m·g·h + Q para muchas combinaciones de ángulo, masa y superficie.',
    'Sin rozamiento (límite μ → 0) la eficiencia tiende a 1 y la ventaja mecánica real tiende a d/h.',
    'La fuerza aumenta con el ángulo y con μ; la eficiencia aumenta con el ángulo y disminuye con μ.',
    'La eficiencia no depende de la masa; el trabajo y la fuerza son proporcionales a la masa.',
    'Potencia = F·v = W/t; con el torno la rapidez es P_t/F hasta 0,50 m/s.',
    'Escalera: 50 kg, 18 escalones de 17 cm en 9 s → W = 1 499,4 J y P = 166,6 W.',
    'Las fuerzas mayores que 10 N salen de la escala y las entradas fuera de rango se rechazan.',
  ],
};

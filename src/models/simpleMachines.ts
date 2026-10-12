import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Máquinas simples: palancas y poleas (grado 6.º).
 *
 * Palanca: barra rígida graduada de 1,00 m que gira alrededor de un fulcro. Todas las fuerzas son verticales.
 * Equilibrio de momentos respecto al fulcro (positivo = antihorario, arriba positivo):
 *   F·(xF − x₀) = R·(xR − x₀) + W_b·(x_cm − x₀)   →   sin barra: F·dF = R·dR  (ley de la palanca)
 * Ventaja mecánica VM = R/F (ideal: dF/dR). Al girar la barra un ángulo θ, cada punto sube o baja d·sen θ:
 *   s_F/s_R = dF/dR, de modo que F·s_F = R·s_R (el trabajo de entrada es igual al de salida en el caso ideal).
 *
 * Poleas: n tramos de cuerda sostienen el bloque móvil. Con rozamiento, cada polea que la cuerda recorre
 * multiplica la tensión por 1/η (al subir la carga). Si T₁ es la tensión del primer tramo:
 *   T_k = T₁/η^(k−1),   Σ T_k = R + W_bloque,   F = T_n/η^e   (e = 1 si el extremo libre pasa por una polea fija)
 * Ideal (η = 1, bloque sin masa): F = R/n y la carga sube h = s/n cuando se jala s de cuerda: F·s = R·h.
 */

/** Aceleración de la gravedad usada en la práctica (m/s²). */
export const G = 9.8;

/** Barra graduada: longitud (m), masa opcional (kg) y separación de los agujeros (m). */
export const BAR = { length: 1.0, mass: 0.2, pitch: 0.05 };

/** Ángulo que se gira la barra para medir los recorridos con la regla (grados). */
export const LEVER_TILT_DEG = 10;

export const MACHINE_LIMITS = {
  loadMass: [0.1, 1.0] as [number, number], // kg (portapesas con pesas ranuradas)
  armClass1: [0.05, 0.5] as [number, number], // m (fulcro en el centro de la barra)
  arm: [0.05, 1.0] as [number, number], // m (fulcro en el extremo izquierdo)
  blockMass: [0, 0.2] as [number, number], // kg (bloque o polea móvil)
  efficiency: [0.8, 1] as [number, number], // eficiencia de cada polea
  rope: [0.1, 0.5] as [number, number], // m de cuerda que se jala
  strands: [2, 6] as [number, number], // tramos que sostienen el bloque móvil del polipasto
};

/** Ficha de los instrumentos (coincide con la entrada sugerida para src/labs/instruments.ts). */
export interface MachineInstrumentSpec {
  id: string; name: string; quantity: string; unit: string;
  resolution: number; sigma?: number; relSigma?: number; nonNegative?: boolean; note: string;
}

export const MACHINE_INSTRUMENTS: Record<'dinamometro' | 'regla', MachineInstrumentSpec> = {
  dinamometro: { id: 'dinamometro', name: 'Dinamómetro de resorte (0 a 10 N)', quantity: 'Fuerza', unit: 'N', resolution: 0.1, sigma: 0.05, relSigma: 0.01, nonNegative: true, note: 'Paralaje al leer el indicador, ajuste del cero y rozamiento del resorte con el tubo.' },
  regla: { id: 'regla', name: 'Regla vertical graduada en milímetros', quantity: 'Recorrido de la cuerda o de la carga', unit: 'cm', resolution: 0.1, sigma: 0.08, nonNegative: true, note: 'Alinear la marca con el cero de la regla y paralaje al leer.' },
};

/** Capacidad del dinamómetro (N): por encima, la lectura se sale de la escala. */
export const DYNAMOMETER_MAX = 10;

/* ================================================================== palancas */

export type LeverClass = 1 | 2 | 3;

export const LEVER_CLASSES: { id: LeverClass; name: string; order: string; examples: string }[] = [
  { id: 1, name: '1.er género', order: 'El fulcro está entre la fuerza y la carga.', examples: 'Subibaja del parque, tijeras de podar y un machete apoyado en un tronco para levantar una piedra.' },
  { id: 2, name: '2.º género', order: 'La carga está entre el fulcro y la fuerza.', examples: 'Carretilla para sacar racimos o tierra, cascanueces y destapador de botellas.' },
  { id: 3, name: '3.er género', order: 'La fuerza está entre el fulcro y la carga.', examples: 'Pinzas para servir, el antebrazo al levantar un racimo y el brazo con el machete al dar un golpe.' },
];

export function findLeverClass(id: number): LeverClass {
  if (id !== 1 && id !== 2 && id !== 3) throw new Error(`Género de palanca desconocido: ${id}`);
  return id;
}

/** Posición del fulcro sobre la barra (m desde el extremo izquierdo). */
export const fulcrumPosition = (cls: LeverClass) => (cls === 1 ? BAR.length / 2 : 0);

/** Distancias posibles al fulcro (m) para cada género. */
export const armRange = (cls: LeverClass): [number, number] => (cls === 1 ? MACHINE_LIMITS.armClass1 : MACHINE_LIMITS.arm);

/** Mensaje si las distancias no corresponden al género elegido (o null si son válidas). */
export function leverOrderError(cls: LeverClass, dR: number, dF: number): string | null {
  if (cls === 2 && !(dF > dR + 1e-9)) return 'En una palanca de 2.º género la carga va entre el fulcro y la fuerza: la distancia de la fuerza debe ser mayor que la de la carga.';
  if (cls === 3 && !(dF < dR - 1e-9)) return 'En una palanca de 3.er género la fuerza va entre el fulcro y la carga: la distancia de la fuerza debe ser menor que la de la carga.';
  return null;
}

/** Ley de la palanca para una barra sin masa: F = R·dR/dF. */
export function leverEffort(R: number, dR: number, dF: number): number {
  if (!(R >= 0) || !(dR > 0) || !(dF > 0)) throw new RangeError('La carga no puede ser negativa y las distancias deben ser positivas.');
  return (R * dR) / dF;
}

export interface LeverInput {
  cls: LeverClass;
  loadMass: number; // kg
  dR: number; // m, distancia de la carga al fulcro
  dF: number; // m, distancia de la fuerza al fulcro
  barMass: boolean; // tener en cuenta la masa de la barra (200 g)
}

export interface LeverResult {
  cls: LeverClass;
  /** Posiciones sobre la barra (m desde el extremo izquierdo). */
  xFulcrum: number; xLoad: number; xEffort: number;
  R: number; // N, peso de la carga
  barWeight: number; // N (0 si se desprecia)
  /** Fuerza vertical con signo que hace el dinamómetro (positiva hacia arriba). */
  effortSigned: number;
  F: number; // N, magnitud de la fuerza
  direction: 'arriba' | 'abajo';
  /** Reacción del fulcro sobre la barra (N, hacia arriba). */
  fulcrumForce: number;
  torqueLoad: number; torqueEffort: number; // N·m, R·dR y F·dF
  vmIdeal: number; // dF/dR
  vm: number; // R/F
  /** Recorridos verticales al girar la barra LEVER_TILT_DEG (m). */
  sEffort: number; sLoad: number;
  workIn: number; workOut: number; // J
  efficiency: number; // workOut/workIn
  /** Lecturas ideales (resolución de los instrumentos). */
  loadReading: number; // N
  effortReading: number | null; // N (null: fuera de escala)
  sEffortReading: number; sLoadReading: number; // cm
  overload: boolean;
}

export function simulateLever(input: LeverInput): LeverResult {
  const cls = findLeverClass(input.cls);
  const { loadMass, dR, dF } = input;
  assertInRange('La masa de la carga', loadMass, ...MACHINE_LIMITS.loadMass);
  assertInRange('La distancia de la carga al fulcro', dR, ...armRange(cls));
  assertInRange('La distancia de la fuerza al fulcro', dF, ...armRange(cls));
  const err = leverOrderError(cls, dR, dF);
  if (err) throw new RangeError(err);

  const x0 = fulcrumPosition(cls);
  // 1.er género: carga a la izquierda del fulcro y fuerza a la derecha. 2.º y 3.er: ambas a la derecha del fulcro (extremo izquierdo).
  const xLoad = cls === 1 ? x0 - dR : x0 + dR;
  const xEffort = x0 + dF;
  const R = loadMass * G;
  const barWeight = input.barMass ? BAR.mass * G : 0;
  const uLoad = xLoad - x0, uEffort = xEffort - x0, uBar = BAR.length / 2 - x0;
  // Σ momentos = 0:  Fe·uE − R·uR − Wb·ub = 0
  const effortSigned = (R * uLoad + barWeight * uBar) / uEffort;
  const F = Math.abs(effortSigned);
  const fulcrumForce = R + barWeight - effortSigned;

  const sin = Math.sin((LEVER_TILT_DEG * Math.PI) / 180);
  const sEffort = dF * sin, sLoad = dR * sin;
  // El trabajo de entrada también levanta (o deja bajar) el centro de la barra cuando el fulcro no está en él.
  const workIn = F * sEffort, workOut = R * sLoad;

  const overload = F > DYNAMOMETER_MAX;
  const res = MACHINE_INSTRUMENTS.dinamometro.resolution, rul = MACHINE_INSTRUMENTS.regla.resolution;
  return {
    cls, xFulcrum: x0, xLoad, xEffort, R, barWeight, effortSigned, F,
    direction: effortSigned >= 0 ? 'arriba' : 'abajo',
    fulcrumForce,
    torqueLoad: R * dR, torqueEffort: F * dF,
    vmIdeal: dF / dR, vm: F > 0 ? R / F : Infinity,
    sEffort, sLoad, workIn, workOut, efficiency: workIn > 0 ? workOut / workIn : NaN,
    loadReading: roundToResolution(R, res),
    effortReading: overload ? null : roundToResolution(F, res),
    sEffortReading: roundToResolution(sEffort * 100, rul),
    sLoadReading: roundToResolution(sLoad * 100, rul),
    overload,
  };
}

/* ================================================================== poleas */

export type PulleySetup = 'fija' | 'movil' | 'polipasto';

export const PULLEY_SETUPS: { id: PulleySetup; name: string; short: string; examples: string }[] = [
  { id: 'fija', name: 'Polea fija', short: 'Fija', examples: 'La polea del pozo o aljibe de una finca y la de una bandera: no ahorran fuerza, pero permiten jalar hacia abajo.' },
  { id: 'movil', name: 'Polea móvil', short: 'Móvil', examples: 'Una garrucha que sube con la carga: cada uno de los dos tramos de cuerda sostiene la mitad del peso.' },
  { id: 'polipasto', name: 'Polipasto (aparejo)', short: 'Polipasto', examples: 'Aparejo de garruchas para subir racimos de banano al camión o levantar un motor en un taller.' },
];

export function findPulleySetup(id: string): PulleySetup {
  const s = PULLEY_SETUPS.find((p) => p.id === id);
  if (!s) throw new Error(`Montaje de poleas desconocido: ${id}`);
  return s.id;
}

/** Tramos de cuerda que sostienen la carga (o el bloque móvil). */
export function supportingStrands(setup: PulleySetup, strands: number): number {
  if (setup === 'fija') return 1;
  if (setup === 'movil') return 2;
  assertInRange('El número de tramos del polipasto', strands, ...MACHINE_LIMITS.strands);
  if (!Number.isInteger(strands)) throw new RangeError('El número de tramos del polipasto debe ser entero.');
  return strands;
}

/** 1 si el extremo libre pasa por una polea fija antes de llegar a la mano (fija y polipasto), 0 en la polea móvil sola. */
export const redirectSheaves = (setup: PulleySetup) => (setup === 'movil' ? 0 : 1);

/** Número de poleas en el bloque fijo y en el bloque móvil. */
export function sheaveCounts(setup: PulleySetup, n: number): { fixed: number; movable: number } {
  if (setup === 'fija') return { fixed: 1, movable: 0 };
  if (setup === 'movil') return { fixed: 0, movable: 1 };
  return { fixed: Math.ceil(n / 2), movable: Math.floor(n / 2) };
}

/**
 * Fuerza en el extremo libre para subir con velocidad constante un peso total W (carga + bloque móvil)
 * sostenido por n tramos, con eficiencia η por polea y e poleas de desvío.
 */
export function pulleyEffort(W: number, n: number, eta: number, redirect: number): number {
  if (!(W >= 0)) throw new RangeError('El peso no puede ser negativo.');
  if (!(n >= 1) || !Number.isInteger(n)) throw new RangeError('El número de tramos debe ser un entero positivo.');
  assertInRange('La eficiencia de cada polea', eta, ...MACHINE_LIMITS.efficiency);
  let sum = 0;
  for (let k = 0; k < n; k++) sum += eta ** -k;
  const T1 = W / sum;
  return T1 / eta ** (n - 1) / eta ** redirect;
}

export interface PulleyInput {
  setup: PulleySetup;
  strands: number; // solo para el polipasto
  loadMass: number; // kg
  blockMass: number; // kg (no aplica a la polea fija)
  efficiency: number; // por polea
  rope: number; // m de cuerda que se jala
}

export interface PulleyResult {
  setup: PulleySetup;
  n: number;
  R: number; // N
  blockWeight: number; // N (0 en la polea fija)
  F: number; // N
  direction: 'arriba' | 'abajo';
  vmIdeal: number; // n
  vm: number; // R/F
  rope: number; rise: number; // m
  workIn: number; workOut: number; // J
  efficiency: number;
  loadReading: number;
  effortReading: number | null;
  ropeReading: number; riseReading: number; // cm
  overload: boolean;
}

export function simulatePulley(input: PulleyInput): PulleyResult {
  const setup = findPulleySetup(input.setup);
  assertInRange('La masa de la carga', input.loadMass, ...MACHINE_LIMITS.loadMass);
  assertInRange('La masa del bloque móvil', input.blockMass, ...MACHINE_LIMITS.blockMass);
  assertInRange('La eficiencia de cada polea', input.efficiency, ...MACHINE_LIMITS.efficiency);
  assertInRange('La cuerda que se jala', input.rope, ...MACHINE_LIMITS.rope);
  const n = supportingStrands(setup, input.strands);
  const R = input.loadMass * G;
  const blockWeight = setup === 'fija' ? 0 : input.blockMass * G;
  const F = pulleyEffort(R + blockWeight, n, input.efficiency, redirectSheaves(setup));
  const rise = input.rope / n;
  const workIn = F * input.rope, workOut = R * rise;
  const overload = F > DYNAMOMETER_MAX;
  const res = MACHINE_INSTRUMENTS.dinamometro.resolution, rul = MACHINE_INSTRUMENTS.regla.resolution;
  return {
    setup, n, R, blockWeight, F,
    direction: setup === 'movil' ? 'arriba' : 'abajo',
    vmIdeal: n, vm: R / F,
    rope: input.rope, rise, workIn, workOut, efficiency: workOut / workIn,
    loadReading: roundToResolution(R, res),
    effortReading: overload ? null : roundToResolution(F, res),
    ropeReading: roundToResolution(input.rope * 100, rul),
    riseReading: roundToResolution(rise * 100, rul),
    overload,
  };
}

/** Cantidades calculadas con las lecturas de los instrumentos (lo que el estudiante obtiene). */
export function fromReadings(load: number, effort: number | null, sEffortCm: number, sLoadCm: number) {
  if (effort === null || effort <= 0) return { vm: null, workIn: null, workOut: load * (sLoadCm / 100), efficiency: null, distanceRatio: sLoadCm > 0 ? sEffortCm / sLoadCm : null };
  const workIn = effort * (sEffortCm / 100), workOut = load * (sLoadCm / 100);
  return { vm: load / effort, workIn, workOut, efficiency: workIn > 0 ? workOut / workIn : null, distanceRatio: sLoadCm > 0 ? sEffortCm / sLoadCm : null };
}

export const simpleMachinesModelSpec: ModelSpec = {
  name: 'Máquinas simples: ley de la palanca y sistemas de poleas',
  inputs: [
    { symbol: 'máquina', name: 'Palanca o poleas', unit: '—', initial: 'palanca' },
    { symbol: 'género', name: 'Género de la palanca (1.er, 2.º o 3.er)', unit: '—', initial: '1.er género' },
    { symbol: 'm', name: 'Masa de la carga (portapesas con pesas)', unit: 'kg', range: MACHINE_LIMITS.loadMass, initial: 0.4 },
    { symbol: 'dR', name: 'Distancia de la carga al fulcro', unit: 'm', range: MACHINE_LIMITS.arm, initial: 0.2 },
    { symbol: 'dF', name: 'Distancia de la fuerza al fulcro', unit: 'm', range: MACHINE_LIMITS.arm, initial: 0.4 },
    { symbol: 'm_barra', name: 'Masa de la barra (opcional; despreciable o 0,2 kg)', unit: 'kg', initial: 0 },
    { symbol: 'montaje', name: 'Polea fija, polea móvil o polipasto', unit: '—', initial: 'polea móvil' },
    { symbol: 'n', name: 'Tramos de cuerda que sostienen el bloque móvil (polipasto)', unit: '—', range: MACHINE_LIMITS.strands, initial: 4 },
    { symbol: 'm_p', name: 'Masa del bloque o polea móvil', unit: 'kg', range: MACHINE_LIMITS.blockMass, initial: 0 },
    { symbol: 'η', name: 'Eficiencia de cada polea (rozamiento)', unit: '—', range: MACHINE_LIMITS.efficiency, initial: 1 },
    { symbol: 's', name: 'Cuerda que se jala', unit: 'm', range: MACHINE_LIMITS.rope, initial: 0.4 },
  ],
  outputs: [
    { symbol: 'R', name: 'Peso de la carga (dinamómetro, 0,1 N)', unit: 'N' },
    { symbol: 'F', name: 'Fuerza necesaria (dinamómetro, 0,1 N)', unit: 'N' },
    { symbol: 'VM', name: 'Ventaja mecánica R/F', unit: '—' },
    { symbol: 's_F, s_R', name: 'Recorrido de la fuerza y subida de la carga (regla, 1 mm)', unit: 'cm' },
    { symbol: 'W', name: 'Trabajo de entrada F·s_F y de salida R·s_R; eficiencia', unit: 'J' },
  ],
  equations: [
    'R = m·g, con g = 9,8 m/s²',
    'Ley de la palanca (barra sin masa): F·dF = R·dR  →  F = R·dR/dF',
    'Con la masa de la barra (centro en 0,50 m): F·dF = R·dR + W_barra·d_barra',
    'Ventaja mecánica: VM = R/F; ideal en la palanca: dF/dR; ideal en las poleas: n',
    'Al girar la barra un ángulo θ: s_F = dF·sen θ y s_R = dR·sen θ, así que s_F/s_R = dF/dR',
    'Poleas ideales: F = (R + W_bloque)/n  y  h = s/n',
    'Con rozamiento: T_k = T₁/η^(k−1),  ΣT_k = R + W_bloque,  F = T_n/η^e',
    'Trabajo: W_entrada = F·s;  W_salida = R·h;  eficiencia = W_salida/W_entrada (= 1 en el caso ideal)',
  ],
  initialConditions: [
    'Palanca de 1.er género con el fulcro en el centro de la barra, carga de 400 g a 20 cm y dinamómetro a 40 cm.',
    'Polea móvil sin masa ni rozamiento con la misma carga de 400 g y 40 cm de cuerda jalada.',
  ],
  assumptions: [
    'Barra rígida y sin masa, salvo cuando se activa la opción de masa de la barra (200 g, uniforme, centro en la marca de 50 cm).',
    'Fulcro sin rozamiento; todas las fuerzas son verticales y la barra se mueve tan despacio que está siempre en equilibrio.',
    'Cuerda ideal: no se estira, no tiene masa y los tramos que sostienen el bloque móvil son verticales.',
    'g = 9,8 m/s². El dinamómetro (0 a 10 N, resolución 0,1 N) se ajusta a cero en la posición en que se usa.',
    'Con rozamiento, cada polea tiene la misma eficiencia η, independiente de la carga y de la velocidad.',
    'Se mide la fuerza necesaria para subir la carga con velocidad constante.',
  ],
  limits: [
    'El dinamómetro solo mide hasta 10 N: con fuerzas mayores la lectura se sale de la escala.',
    'No incluye la flexión de la barra, el rozamiento del fulcro ni la inercia al arrancar o frenar.',
    'En la palanca solo se mide un giro de 10°; giros grandes no cambian la ley de la palanca porque todas las fuerzas siguen verticales.',
    'El rozamiento real de una polea depende de la carga, del eje y de la rigidez de la cuerda; aquí se resume en un solo número η.',
    'Las máquinas no crean energía: con rozamiento o masa del bloque el trabajo de entrada es mayor que el de salida.',
  ],
  testCases: [
    'Palanca de 1.er género con 400 g a 20 cm y la fuerza a 40 cm: F = 1,96 N hacia abajo; el dinamómetro marca 2,0 N.',
    'F·dF = R·dR en los tres géneros para muchas combinaciones (barra sin masa).',
    'La palanca de 2.º género siempre tiene VM > 1 y la de 3.er género VM < 1.',
    'La masa de la barra no cambia la fuerza cuando el fulcro está en el centro y la aumenta en W_barra·0,5/dF con el fulcro en el extremo.',
    'Palanca y poleas ideales: trabajo de entrada igual al de salida (eficiencia 1).',
    'Poleas ideales: F = R/n y h = s/n; la polea fija solo cambia la dirección.',
    'Con rozamiento la fuerza aumenta y la eficiencia baja, más cuanto más poleas recorre la cuerda.',
    'Las fuerzas mayores que 10 N salen de la escala y las entradas fuera de rango se rechazan.',
  ],
};

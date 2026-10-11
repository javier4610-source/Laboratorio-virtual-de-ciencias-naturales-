import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Materiales conductores y aislantes (grado 7.º).
 * Circuito en serie: pila(s) con resistencia interna, bombillo, amperímetro y una muestra entre dos caimanes.
 *   Resistencia de la muestra: R = ρ·L/A.
 *   Corriente: I = V / (R_muestra + R_bombillo + n·r).
 *   Potencia en el bombillo: P = I²·R_bombillo; brillo relativo = P / P_nominal.
 */

/** Fuerza electromotriz de una pila AA (V). */
export const CELL_EMF = 1.5;
/** Resistencia interna de cada pila (Ω), valor típico de una pila alcalina nueva. */
export const CELL_R = 0.3;
/** Resistencia del filamento del bombillo (Ω), simplificada como constante. */
export const BULB_R = 10;
/** Resolución del amperímetro (mA) y su rango máximo (A). */
export const AMMETER_RES_MA = 0.1;
export const AMMETER_MAX_A = 2;
/** Resolución con que se informa el brillo relativo (%). */
export const BRIGHTNESS_RES = 0.1;
/** Por debajo de este porcentaje de la potencia nominal el filamento no se ve encendido. */
export const VISIBILITY_THRESHOLD = 1;

/** Geometría fija de las muestras. */
export const BAR = { length: 0.1, area: 0.002 * 0.002 }; // barra de 10 cm × 2 mm × 2 mm (m, m²)
export const CELL = { length: 0.1, area: 4e-4 }; // celda de 10 cm con electrodos de 4 cm² (m, m²)

/**
 * Potencia nominal del bombillo: la que recibe con las dos pilas (3,0 V) y los caimanes unidos
 * directamente (cortocircuito de la muestra). Es la referencia del 100 % de brillo.
 */
export const NOMINAL_POWER = (() => {
  const i = (2 * CELL_EMF) / (BULB_R + 2 * CELL_R);
  return i * i * BULB_R;
})();

/** Umbrales de clasificación según la fracción I/I_cc (corriente con la muestra / corriente con caimanes unidos, mismo voltaje). */
export const CLASS_THRESHOLDS = { conductor: 0.5, debil: 1e-4 };

export type ConductorClass = 'conductor' | 'debil' | 'aislante';
export const CLASS_LABELS: Record<ConductorClass, string> = {
  conductor: 'Conductor',
  debil: 'Conductor débil',
  aislante: 'Aislante',
};

export type SampleKind = 'barra' | 'liquido' | 'aire';
export interface Sample {
  id: string;
  name: string;
  kind: SampleKind;
  /** Resistividad típica a 20 °C (Ω·m). */
  rho: number;
  /** Intervalo típico de la resistividad, para explicar la variación real. */
  rhoNote: string;
  /** Color del material para la ilustración. */
  color: string;
}

export const SAMPLES: Sample[] = [
  { id: 'cobre', name: 'Cobre', kind: 'barra', rho: 1.68e-8, rhoNote: '1,68 × 10⁻⁸ Ω·m', color: '#c46f22' },
  { id: 'aluminio', name: 'Aluminio', kind: 'barra', rho: 2.65e-8, rhoNote: '2,65 × 10⁻⁸ Ω·m', color: '#c9ced3' },
  { id: 'hierro', name: 'Hierro', kind: 'barra', rho: 9.7e-8, rhoNote: '9,7 × 10⁻⁸ Ω·m', color: '#7a7f84' },
  { id: 'grafito', name: 'Grafito (mina de lápiz)', kind: 'barra', rho: 3e-5, rhoNote: 'mina de grafito y arcilla: ≈ 10⁻⁵ a 10⁻⁴ Ω·m', color: '#3d4144' },
  { id: 'destilada', name: 'Agua destilada', kind: 'liquido', rho: 5e4, rhoNote: '≈ 10⁴ a 10⁵ Ω·m', color: '#dff1fa' },
  { id: 'llave', name: 'Agua de la llave', kind: 'liquido', rho: 50, rhoNote: '≈ 20 a 200 Ω·m según los minerales disueltos', color: '#bfe2f2' },
  { id: 'salada', name: 'Agua con sal', kind: 'liquido', rho: 0.2, rhoNote: '≈ 0,2 Ω·m (salmuera parecida al agua de mar)', color: '#8fcbe8' },
  { id: 'madera', name: 'Madera seca', kind: 'barra', rho: 1e12, rhoNote: '≈ 10¹¹ a 10¹⁴ Ω·m (depende de la humedad)', color: '#b98a54' },
  { id: 'pvc', name: 'Plástico (PVC)', kind: 'barra', rho: 1e14, rhoNote: '≈ 10¹³ a 10¹⁵ Ω·m', color: '#e3e6e1' },
  { id: 'vidrio', name: 'Vidrio', kind: 'barra', rho: 1e12, rhoNote: '≈ 10¹⁰ a 10¹⁴ Ω·m', color: '#cfe6ef' },
  { id: 'caucho', name: 'Caucho', kind: 'barra', rho: 1e13, rhoNote: '≈ 10¹³ a 10¹⁵ Ω·m', color: '#2b2f31' },
  { id: 'aire', name: 'Aire (caimanes separados)', kind: 'aire', rho: 2e16, rhoNote: 'aire seco: ≈ 10¹⁶ Ω·m', color: '#ffffff' },
];

export function findSample(id: string): Sample {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) throw new Error(`Muestra desconocida: ${id}`);
  return s;
}

/** Geometría de la muestra según su tipo (los líquidos van en la celda; el aire ocupa el hueco entre caimanes). */
export function geometryOf(sample: Sample): { length: number; area: number } {
  return sample.kind === 'liquido' ? CELL : BAR;
}

/** R = ρ·L/A (Ω). */
export function sampleResistance(rho: number, length: number, area: number): number {
  assertInRange('La resistividad', rho, 1e-9, 1e18);
  assertInRange('La longitud de la muestra', length, 1e-3, 1);
  assertInRange('El área de la sección', area, 1e-8, 1e-2);
  return (rho * length) / area;
}

/** Corriente del circuito en serie (A) con n pilas y una resistencia de muestra (Ω). */
export function circuitCurrent(cells: number, rSample: number): number {
  assertInRange('El número de pilas', cells, 1, 2);
  if (!Number.isInteger(cells)) throw new RangeError('El número de pilas debe ser 1 o 2.');
  if (!(rSample >= 0) || !Number.isFinite(rSample)) throw new RangeError('La resistencia de la muestra debe ser un número no negativo.');
  return (cells * CELL_EMF) / (rSample + BULB_R + cells * CELL_R);
}

export function classifyByFraction(fraction: number): ConductorClass {
  if (fraction >= CLASS_THRESHOLDS.conductor) return 'conductor';
  if (fraction >= CLASS_THRESHOLDS.debil) return 'debil';
  return 'aislante';
}

export interface ConductorInput { sampleId: string; cells: number; }
export interface ConductorResult {
  sample: Sample;
  voltage: number; // V (fem de la fuente)
  sampleR: number; // Ω
  totalR: number; // Ω
  current: number; // A (valor del modelo)
  shortCircuitCurrent: number; // A, con los caimanes unidos y el mismo voltaje
  currentFraction: number; // I / I_cc
  /** Lectura del amperímetro en mA (resolución 0,1 mA); null si supera el rango. */
  currentReading: number | null;
  bulbPower: number; // W
  /** Brillo relativo a la potencia nominal (%), con resolución de 0,1 %. */
  brightness: number;
  visible: boolean;
  classification: ConductorClass;
  log10Rho: number;
  /** Caída de voltaje en cada elemento (V): muestra, bombillo, pilas. */
  drops: { sample: number; bulb: number; internal: number };
}

export function testSample(input: ConductorInput): ConductorResult {
  assertInRange('El número de pilas', input.cells, 1, 2);
  const sample = findSample(input.sampleId);
  const g = geometryOf(sample);
  const sampleR = sampleResistance(sample.rho, g.length, g.area);
  const cells = input.cells;
  const current = circuitCurrent(cells, sampleR);
  const shortCircuitCurrent = circuitCurrent(cells, 0);
  const currentFraction = current / shortCircuitCurrent;
  const bulbPower = current * current * BULB_R;
  const brightnessRaw = (100 * bulbPower) / NOMINAL_POWER;
  return {
    sample,
    voltage: cells * CELL_EMF,
    sampleR,
    totalR: sampleR + BULB_R + cells * CELL_R,
    current,
    shortCircuitCurrent,
    currentFraction,
    currentReading: current > AMMETER_MAX_A ? null : roundToResolution(current * 1000, AMMETER_RES_MA),
    bulbPower,
    brightness: roundToResolution(brightnessRaw, BRIGHTNESS_RES),
    visible: brightnessRaw >= VISIBILITY_THRESHOLD,
    classification: classifyByFraction(currentFraction),
    log10Rho: Math.log10(sample.rho),
    drops: { sample: current * sampleR, bulb: current * BULB_R, internal: current * cells * CELL_R },
  };
}

export const conductorsModelSpec: ModelSpec = {
  name: 'Circuito de prueba de conductividad: pila, bombillo, amperímetro y muestra en serie',
  inputs: [
    { symbol: 'muestra', name: 'Material colocado entre los caimanes', unit: '—', initial: 'cobre' },
    { symbol: 'V', name: 'Voltaje de la fuente (1 o 2 pilas de 1,5 V)', unit: 'V', range: [1.5, 3], initial: 1.5 },
  ],
  outputs: [
    { symbol: 'R', name: 'Resistencia de la muestra', unit: 'Ω' },
    { symbol: 'I', name: 'Corriente (lectura del amperímetro)', unit: 'mA' },
    { symbol: 'B', name: 'Brillo relativo del bombillo', unit: '%' },
    { symbol: 'clase', name: 'Clasificación esperada: conductor, conductor débil o aislante', unit: '—' },
  ],
  equations: [
    'R_muestra = ρ·L/A  (barra: L = 10 cm, A = 2 mm × 2 mm; celda de líquido: L = 10 cm, A = 4 cm²)',
    'I = V / (R_muestra + R_bombillo + n·r)  con R_bombillo = 10 Ω y r = 0,3 Ω por pila',
    'P_bombillo = I²·R_bombillo;  brillo = P / P_nominal × 100 %  (P_nominal: 3,0 V con los caimanes unidos ≈ 0,80 W)',
    'Clasificación por I/I_cc (I_cc: corriente con los caimanes unidos, mismo voltaje): conductor si ≥ 50 %; conductor débil si ≥ 0,01 %; aislante si es menor',
    'Conservación de la energía en el circuito: V = I·R_muestra + I·R_bombillo + I·n·r',
  ],
  initialConditions: ['Una pila de 1,5 V; barra de cobre entre los caimanes; circuito abierto hasta que el estudiante lo cierra.'],
  assumptions: [
    'Resistividades típicas a 20 °C; en los aislantes y en el agua el valor real varía varios órdenes de magnitud con la humedad, las impurezas y los minerales disueltos.',
    'El agua conduce por los iones disueltos (por ejemplo Na⁺ y Cl⁻ de la sal); el agua destilada casi no tiene iones.',
    'La resistencia del filamento es constante (en un bombillo real aumenta al calentarse).',
    'El amperímetro es ideal (resistencia despreciable), con resolución de 0,1 mA y rango de 0 a 2 A.',
    'La corriente en el líquido se trata como si la celda fuera un resistor óhmico; se ignoran la electrólisis y la polarización de los electrodos.',
  ],
  limits: [
    'No representa la dependencia de la resistencia con la temperatura ni los semiconductores reales (cuya conductividad cambia con la luz o el calor).',
    'Con el aire se usa la geometría de la barra solo como referencia: la corriente es nula a efectos prácticos; con voltajes muy altos el aire se ioniza (chispa), lo que este modelo no incluye.',
    'El umbral de visibilidad del brillo (1 % de la potencia nominal) es aproximado y depende de la iluminación del salón.',
  ],
  testCases: [
    'Barra de cobre: R ≈ 4,2 × 10⁻⁴ Ω; con 1,5 V el amperímetro marca 145,6 mA.',
    'Los metales dan más del 97 % de la corriente de cortocircuito y encienden el bombillo.',
    'Los aislantes y el aire dan 0,0 mA y brillo 0 %.',
    'El agua con sal conduce miles de veces más que el agua destilada.',
    'El grafito conduce menos que los metales, pero sigue siendo conductor.',
    'Con una muestra de gran resistencia, duplicar el voltaje duplica la corriente.',
    'Entradas fuera de rango (3 pilas, resistividad negativa, muestra inexistente) se rechazan.',
  ],
};

import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Modelo de medición de masa, volumen y densidad (grado 6.º).
 * Densidades de referencia aproximadas a 20 °C (g/cm³). Los materiales reales
 * varían según su composición y porosidad; se usan valores típicos de tablas.
 */
export interface Material {
  id: string;
  name: string;
  density: number; // g/cm³
  color: string;
  hidden?: boolean; // muestras "misteriosas"
}

export const MATERIALS: Material[] = [
  { id: 'corcho', name: 'Corcho', density: 0.24, color: '#b98a55' },
  { id: 'pino', name: 'Madera de pino', density: 0.5, color: '#d9b77e' },
  { id: 'hielo', name: 'Hielo (0 °C)', density: 0.917, color: '#cfe8f3' },
  { id: 'pvc', name: 'PVC rígido', density: 1.38, color: '#9aa7b4' },
  { id: 'vidrio', name: 'Vidrio común', density: 2.5, color: '#9fd4cf' },
  { id: 'aluminio', name: 'Aluminio', density: 2.7, color: '#c3c8cd' },
  { id: 'hierro', name: 'Hierro', density: 7.87, color: '#6f6f73' },
  { id: 'cobre', name: 'Cobre', density: 8.96, color: '#c9764a' },
  { id: 'plomo', name: 'Plomo', density: 11.34, color: '#59606b' },
];

/** Muestras misteriosas: su material está oculto; el estudiante debe identificarlo por su densidad. */
export const MYSTERY_SAMPLES: Material[] = [
  { id: 'misterio-a', name: 'Muestra misteriosa A', density: 2.7, color: '#8f9bb3', hidden: true },
  { id: 'misterio-b', name: 'Muestra misteriosa B', density: 8.96, color: '#8f9bb3', hidden: true },
  { id: 'misterio-c', name: 'Muestra misteriosa C', density: 0.5, color: '#8f9bb3', hidden: true },
];

export const ALL_SAMPLES = [...MATERIALS, ...MYSTERY_SAMPLES];

export const WATER_DENSITY = 0.998; // g/cm³ a 20 °C
export const BALANCE_RESOLUTION = 0.1; // g
export const BALANCE_CAPACITY = 600; // g
export const RULER_RESOLUTION = 0.1; // cm
export const CYLINDER_RESOLUTION = 0.5; // mL (probeta de 100 mL con divisiones de 1 mL; se estima media división)
export const CYLINDER_CAPACITY = 100; // mL

export const LIMITS = {
  side: [1, 3.4] as [number, number], // cm
  initialWater: [20, 70] as [number, number], // mL
};

export interface DensityInput {
  materialId: string;
  side: number; // arista del cubo, cm
  initialWater: number; // mL
  /** Si el objeto flota, se puede sumergir completamente con un alfiler (volumen del alfiler despreciable). */
  pushUnder: boolean;
}

export interface DensityResult {
  material: Material;
  trueVolume: number; // cm³
  trueMass: number; // g
  sideReading: number; // cm (lectura de la regla)
  geometricVolume: number; // cm³ calculado a partir de la lectura
  massReading: number | null; // g, null si se supera la capacidad
  floats: boolean;
  submergedFraction: number; // 0..1
  finalWaterReading: number | null; // mL, null si se desborda
  displacedVolume: number | null; // mL
  densityGeometric: number | null; // g/cm³
  densityDisplacement: number | null; // g/cm³
  warnings: string[];
}

export function findSample(id: string): Material {
  const m = ALL_SAMPLES.find((s) => s.id === id);
  if (!m) throw new Error(`Material desconocido: ${id}`);
  return m;
}

export function simulateDensity(input: DensityInput): DensityResult {
  assertInRange('La arista del cubo', input.side, LIMITS.side[0], LIMITS.side[1]);
  assertInRange('El volumen inicial de agua', input.initialWater, LIMITS.initialWater[0], LIMITS.initialWater[1]);
  const material = findSample(input.materialId);
  const warnings: string[] = [];

  const trueVolume = input.side ** 3;
  const trueMass = material.density * trueVolume;
  const sideReading = roundToResolution(input.side, RULER_RESOLUTION);
  const geometricVolume = sideReading ** 3;

  const massReading = trueMass > BALANCE_CAPACITY ? null : roundToResolution(trueMass, BALANCE_RESOLUTION);
  if (massReading === null) warnings.push(`La masa supera la capacidad de la balanza (${BALANCE_CAPACITY} g).`);

  const floats = material.density < WATER_DENSITY;
  // Principio de Arquímedes: un cuerpo que flota sumerge la fracción ρ_objeto/ρ_agua de su volumen.
  const submergedFraction = floats && !input.pushUnder ? material.density / WATER_DENSITY : 1;
  const submergedVolume = trueVolume * submergedFraction;
  const finalTrue = input.initialWater + submergedVolume;

  let finalWaterReading: number | null = null;
  let displacedVolume: number | null = null;
  if (finalTrue > CYLINDER_CAPACITY) {
    warnings.push('El agua se desborda de la probeta: usa menos agua inicial o una muestra más pequeña.');
  } else {
    finalWaterReading = roundToResolution(finalTrue, CYLINDER_RESOLUTION);
    const initialReading = roundToResolution(input.initialWater, CYLINDER_RESOLUTION);
    displacedVolume = roundToResolution(finalWaterReading - initialReading, CYLINDER_RESOLUTION);
  }
  if (floats && !input.pushUnder) {
    warnings.push('La muestra flota: solo una parte está sumergida, así que el agua desplazada no corresponde a su volumen total.');
  }

  const densityGeometric = massReading !== null && geometricVolume > 0 ? massReading / geometricVolume : null;
  const densityDisplacement = massReading !== null && displacedVolume !== null && displacedVolume > 0
    ? massReading / displacedVolume
    : null;

  return {
    material, trueVolume, trueMass, sideReading, geometricVolume, massReading, floats, submergedFraction,
    finalWaterReading, displacedVolume, densityGeometric, densityDisplacement, warnings,
  };
}

/** Identifica el material de tabla con densidad más cercana (para muestras misteriosas). */
export function closestMaterial(density: number): Material {
  return MATERIALS.reduce((best, m) => (Math.abs(m.density - density) < Math.abs(best.density - density) ? m : best));
}

export const densityModelSpec: ModelSpec = {
  name: 'Masa, volumen y densidad de sólidos regulares (cubos)',
  inputs: [
    { symbol: 'material', name: 'Material de la muestra', unit: '—', initial: 'aluminio' },
    { symbol: 'a', name: 'Arista del cubo', unit: 'cm', range: LIMITS.side, initial: 2 },
    { symbol: 'Vᵢ', name: 'Volumen inicial de agua en la probeta', unit: 'mL', range: LIMITS.initialWater, initial: 50 },
  ],
  outputs: [
    { symbol: 'm', name: 'Masa (lectura de la balanza)', unit: 'g' },
    { symbol: 'V', name: 'Volumen geométrico (a³) y volumen desplazado (V_f − V_i)', unit: 'cm³ = mL' },
    { symbol: 'ρ', name: 'Densidad', unit: 'g/cm³' },
  ],
  equations: [
    'ρ = m / V',
    'V_cubo = a³',
    'V_desplazado = V_final − V_inicial (1 mL = 1 cm³)',
    'Si ρ_objeto < ρ_agua, el objeto flota y sumerge la fracción ρ_objeto / ρ_agua (principio de Arquímedes)',
  ],
  initialConditions: ['Probeta con 50 mL de agua a 20 °C (ρ_agua = 0,998 g/cm³).', 'Balanza tarada en 0,0 g.'],
  assumptions: [
    'Las muestras son macizas, homogéneas y sin poros: su densidad es la de la tabla.',
    'La temperatura es constante (20 °C), por lo que el volumen del agua y de los sólidos no cambia.',
    'El alfiler usado para hundir los objetos que flotan tiene volumen despreciable.',
    'Las lecturas se redondean a la resolución del instrumento: balanza 0,1 g, regla 0,1 cm, probeta 0,5 mL.',
  ],
  limits: [
    'No se modelan errores aleatorios del observador, burbujas adheridas, absorción de agua (madera, corcho) ni la tensión superficial.',
    'Los valores de densidad son típicos; materiales reales (maderas, vidrios, aleaciones) presentan variaciones.',
    'Capacidad de la balanza: 600 g; capacidad de la probeta: 100 mL.',
  ],
  testCases: [
    'Cubo de aluminio de 2 cm → m = 21,6 g; V = 8 cm³; ρ = 2,70 g/cm³.',
    'La densidad calculada no depende del tamaño de la muestra (dentro de la resolución).',
    'El corcho sin alfiler desplaza menos agua que su volumen; con alfiler desplaza su volumen completo.',
    'Muestras pequeñas presentan mayor error relativo por la resolución de la probeta.',
    'Se detecta el desbordamiento de la probeta y la sobrecarga de la balanza.',
  ],
};

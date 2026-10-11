import { assertInRange, roundToResolution } from './math';
import { molarMass } from './chemistry';
import type { ModelSpec } from './types';

/**
 * Preparación de soluciones, dilución y colorimetría (grado 10.º).
 */

export interface SoluteInfo {
  id: string;
  name: string;
  formula: string;
  /** Solubilidad aproximada en agua a 20–25 °C, g de soluto por 100 mL de agua. */
  solubility: number;
  /** Color de la solución (solo visual). */
  color: [number, number, number] | null;
  /** Absortividad molar aproximada en la longitud de onda de trabajo (L·mol⁻¹·cm⁻¹). */
  epsilon: number | null;
  wavelength: number | null; // nm
  safety: string;
}

export const SOLUTES: SoluteInfo[] = [
  { id: 'nacl', name: 'Cloruro de sodio', formula: 'NaCl', solubility: 36, color: null, epsilon: null, wavelength: null, safety: 'Bajo riesgo. Sal de cocina.' },
  { id: 'glucosa', name: 'Glucosa', formula: 'C6H12O6', solubility: 90, color: null, epsilon: null, wavelength: null, safety: 'Bajo riesgo.' },
  { id: 'cuso4', name: 'Sulfato de cobre(II) pentahidratado', formula: 'CuSO4·5H2O', solubility: 32, color: [30, 110, 200], epsilon: 12, wavelength: 810, safety: 'Nocivo si se ingiere; irritante; tóxico para organismos acuáticos. Usar guantes y gafas.' },
  { id: 'kmno4', name: 'Permanganato de potasio', formula: 'KMnO4', solubility: 6.4, color: [140, 20, 120], epsilon: 2400, wavelength: 525, safety: 'Oxidante fuerte; mancha la piel; nocivo. Usar guantes y gafas.' },
];

export function findSolute(id: string): SoluteInfo {
  const s = SOLUTES.find((x) => x.id === id);
  if (!s) throw new Error(`Soluto desconocido: ${id}`);
  return s;
}

export const FLASK_VOLUMES = [50, 100, 250, 500]; // mL (balones aforados)
export const PIPETTE_VOLUMES = [1, 2, 5, 10, 25]; // mL (pipetas aforadas)
export const BALANCE_RES = 0.001; // g (balanza analítica escolar)
export const PATH_LENGTH_CM = 1;
export const ABSORBANCE_MAX = 2; // límite de lectura confiable del colorímetro escolar

export const SOLUTION_LIMITS = { mass: [0.001, 200] as [number, number] };

export interface SolutionInput {
  soluteId: string;
  mass: number; // g
  flaskVolume: number; // mL
  /** Dilución opcional: tomar `aliquot` mL de la solución madre y completar a `dilutionFlask` mL. */
  dilution?: { aliquot: number; dilutionFlask: number } | null;
}

export interface SolutionResult {
  solute: SoluteInfo;
  molarMass: number;
  massReading: number;
  dissolvedMass: number;
  saturated: boolean;
  moles: number;
  molarity: number; // mol/L de la solución madre
  percentMV: number; // % m/v
  gramsPerLiter: number;
  ppm: number; // mg/L
  dilutionFactor: number;
  finalMolarity: number;
  absorbance: number | null; // null si el soluto es incoloro
  absorbanceReading: string; // texto mostrado por el colorímetro
  transmittance: number | null; // %
  warnings: string[];
}

export function absorbance(epsilon: number, concentration: number, path = PATH_LENGTH_CM): number {
  return epsilon * path * concentration; // ley de Beer-Lambert
}

export function dilute(c1: number, v1: number, v2: number): number {
  if (v2 <= 0) throw new RangeError('El volumen final debe ser positivo.');
  if (v1 > v2) throw new RangeError('La alícuota no puede ser mayor que el volumen final.');
  return (c1 * v1) / v2;
}

export function prepareSolution(input: SolutionInput): SolutionResult {
  assertInRange('La masa de soluto', input.mass, ...SOLUTION_LIMITS.mass);
  if (!FLASK_VOLUMES.includes(input.flaskVolume)) throw new RangeError('Elige un balón aforado disponible.');
  const solute = findSolute(input.soluteId);
  const M = molarMass(solute.formula);
  const warnings: string[] = [];
  const massReading = roundToResolution(input.mass, BALANCE_RES);
  // Aproximación: el volumen de agua disponible ≈ volumen del balón.
  const maxDissolved = (solute.solubility * input.flaskVolume) / 100;
  const saturated = massReading > maxDissolved;
  const dissolvedMass = saturated ? maxDissolved : massReading;
  if (saturated) {
    warnings.push(`Se superó la solubilidad (≈ ${solute.solubility} g/100 mL): ${(massReading - maxDissolved).toFixed(2)} g quedan sin disolver en el fondo. La solución está saturada.`);
  }
  const V = input.flaskVolume / 1000; // L
  const moles = dissolvedMass / M;
  const molarity = moles / V;
  let dilutionFactor = 1;
  let finalMolarity = molarity;
  if (input.dilution) {
    const { aliquot, dilutionFlask } = input.dilution;
    if (!PIPETTE_VOLUMES.includes(aliquot)) throw new RangeError('Elige una pipeta disponible.');
    if (!FLASK_VOLUMES.includes(dilutionFlask)) throw new RangeError('Elige un balón aforado disponible para la dilución.');
    finalMolarity = dilute(molarity, aliquot, dilutionFlask);
    dilutionFactor = dilutionFlask / aliquot;
  }
  let abs: number | null = null;
  let reading = 'Solución incolora: no absorbe en el visible';
  let transmittance: number | null = null;
  if (solute.epsilon !== null) {
    abs = absorbance(solute.epsilon, finalMolarity);
    transmittance = 100 * 10 ** -abs;
    if (abs > ABSORBANCE_MAX) {
      reading = `> ${ABSORBANCE_MAX.toFixed(2)} (fuera de rango: diluye la muestra)`;
      warnings.push('La absorbancia supera el rango lineal del colorímetro. Diluye la solución para medir con confianza.');
    } else {
      reading = roundToResolution(abs, 0.001).toFixed(3);
    }
  }
  return {
    solute, molarMass: M, massReading, dissolvedMass, saturated, moles, molarity,
    percentMV: (dissolvedMass / input.flaskVolume) * 100,
    gramsPerLiter: dissolvedMass / V,
    ppm: (dissolvedMass * 1000) / V,
    dilutionFactor, finalMolarity, absorbance: abs, absorbanceReading: reading, transmittance, warnings,
  };
}

/** Muestra problema de KMnO₄ con concentración fija para el reto de la curva de calibración. */
export const UNKNOWN_SAMPLE = { soluteId: 'kmno4', molarity: 3.6e-4 };

export function unknownAbsorbance(): number {
  return roundToResolution(absorbance(findSolute('kmno4').epsilon!, UNKNOWN_SAMPLE.molarity), 0.001);
}

/** Color aproximado de la solución para la visualización (ley de Beer aplicada a cada canal). */
export function solutionColor(solute: SoluteInfo, molarity: number): string {
  if (!solute.color || solute.epsilon === null) return 'rgba(200, 225, 240, 0.35)';
  const A = Math.min(3, absorbance(solute.epsilon, molarity) * 2); // 2 cm de ancho visual del balón
  const t = 10 ** -A; // fracción transmitida
  const [r, g, b] = solute.color;
  const mix = (c: number) => Math.round(255 * t + c * (1 - t));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export const solutionsModelSpec: ModelSpec = {
  name: 'Concentración de soluciones, dilución y ley de Beer-Lambert',
  inputs: [
    { symbol: 'soluto', name: 'Soluto', unit: '—', initial: 'CuSO₄·5H₂O' },
    { symbol: 'm', name: 'Masa de soluto', unit: 'g', range: SOLUTION_LIMITS.mass, initial: 2.5 },
    { symbol: 'V', name: 'Volumen del balón aforado', unit: 'mL', initial: 100 },
    { symbol: 'V₁, V₂', name: 'Alícuota (pipeta) y volumen final de la dilución', unit: 'mL' },
  ],
  outputs: [
    { symbol: 'n', name: 'Cantidad de sustancia', unit: 'mol' },
    { symbol: 'M', name: 'Molaridad', unit: 'mol/L' },
    { symbol: '% m/v', name: 'Porcentaje masa/volumen', unit: 'g/100 mL' },
    { symbol: 'A', name: 'Absorbancia (soluciones coloreadas)', unit: 'adimensional' },
  ],
  equations: [
    'n = m / M_molar',
    'M = n / V(L)',
    '% m/v = m(g) / V(mL) × 100',
    'Dilución: C₁·V₁ = C₂·V₂',
    'Ley de Beer-Lambert: A = ε·l·c;  T = 10^(−A)',
  ],
  initialConditions: ['Balón de 100 mL, 2,500 g de sulfato de cobre pentahidratado, sin dilución.'],
  assumptions: [
    'El volumen final de la solución es exactamente el del balón aforado (aforo correcto).',
    'Para estimar la saturación, el volumen de agua se aproxima al volumen del balón.',
    'Las masas molares se calculan a partir de masas atómicas estándar (incluyendo el agua de hidratación).',
    'Las absortividades molares (ε) y las solubilidades son valores aproximados a 20–25 °C.',
    'Paso óptico de la celda: 1 cm. La ley de Beer se cumple solo en soluciones diluidas.',
  ],
  limits: [
    'No se modelan cambios de volumen al mezclar, efectos de la temperatura ni errores de aforo.',
    'El colorímetro solo mide de forma confiable absorbancias entre 0 y 2.',
    'El color mostrado en pantalla es aproximado y depende de la pantalla.',
  ],
  testCases: [
    '5,844 g de NaCl en 100 mL → 1,000 mol/L y 5,844 % m/v.',
    'Dilución de 10 mL a 100 mL → factor 10 y concentración 10 veces menor.',
    'La absorbancia es proporcional a la concentración (pendiente = ε·l).',
    'Al superar la solubilidad, la concentración deja de aumentar (saturación).',
    'La masa molar de CuSO₄·5H₂O ≈ 249,7 g/mol.',
  ],
};

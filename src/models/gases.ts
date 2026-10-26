import { assertInRange, celsiusToKelvin, R_GAS, roundToResolution } from './math';
import type { ModelSpec } from './types';
import { ceilTo, classifyWarnings, floorTo, num, type ModelCondition } from './conditions';

/**
 * Leyes de los gases (grado 10.º): gas ideal en una jeringa cerrada.
 *   P·V = n·R·T  →  Boyle (T constante), Charles (P constante), Gay-Lussac (V constante).
 */

export type GasLaw = 'boyle' | 'charles' | 'gay-lussac';

export const GAS_LIMITS = {
  volume: [20, 200] as [number, number], // mL
  temperature: [-20, 100] as [number, number], // °C
  pressure: [50, 300] as [number, number], // kPa
};

/** Condiciones iniciales: 100 mL de aire a 101,3 kPa y 25 °C. */
export const INITIAL = { volume: 100, pressure: 101.3, temperature: 25 };
export const MANOMETER_RES = 0.1; // kPa
export const SYRINGE_RES = 1; // mL
export const THERMO_RES = 0.5; // °C

/** Cantidad de gas (mol) en la jeringa con las condiciones iniciales. */
export function molesInSyringe(): number {
  return (INITIAL.pressure * 1000 * (INITIAL.volume * 1e-6)) / (R_GAS * celsiusToKelvin(INITIAL.temperature));
}

export interface GasInput { law: GasLaw; volume: number; temperature: number; pressure: number; /** Cantidad de gas (mol); por defecto la de las condiciones iniciales. Parámetro editable del modo avanzado. */ moles?: number; /** Presión exterior (kPa) que equilibra el émbolo en la ley de Charles; por defecto la del laboratorio. Parámetro del modo avanzado. */ externalPressure?: number; }
export interface GasResult {
  law: GasLaw;
  pressure: number; // kPa
  volume: number; // mL
  temperatureC: number; temperatureK: number;
  pressureReading: number; volumeReading: number;
  pv: number; // kPa·mL (constante en Boyle)
  vOverT: number; // mL/K (constante en Charles)
  pOverT: number; // kPa/K (constante en Gay-Lussac)
  warnings: string[];
}

export function simulateGas(input: GasInput): GasResult {
  const n = input.moles ?? molesInSyringe();
  let P: number, V: number, T: number;
  const warnings: string[] = [];
  if (input.law === 'boyle') {
    assertInRange('El volumen', input.volume, ...GAS_LIMITS.volume);
    T = celsiusToKelvin(INITIAL.temperature);
    V = input.volume;
    P = (n * R_GAS * T) / (V * 1e-6) / 1000;
  } else if (input.law === 'charles') {
    assertInRange('La temperatura', input.temperature, ...GAS_LIMITS.temperature);
    const pExt = input.externalPressure ?? INITIAL.pressure;
    assertInRange('La presión exterior', pExt, 50, 150);
    T = celsiusToKelvin(input.temperature);
    P = pExt; // a presión constante, el émbolo se equilibra con la presión exterior
    V = (n * R_GAS * T) / (P * 1000) * 1e6;
  } else {
    assertInRange('La temperatura', input.temperature, ...GAS_LIMITS.temperature);
    T = celsiusToKelvin(input.temperature);
    V = INITIAL.volume;
    P = (n * R_GAS * T) / (V * 1e-6) / 1000;
  }
  if (P > GAS_LIMITS.pressure[1]) warnings.push('La presión supera 300 kPa: en una jeringa real el émbolo podría salirse o la jeringa fugar.');
  if (input.law !== 'boyle' && input.temperature < 0) warnings.push('Por debajo de 0 °C el vapor de agua del aire podría condensarse; el modelo supone aire seco.');
  return {
    law: input.law, pressure: P, volume: V, temperatureC: T - 273.15, temperatureK: T,
    pressureReading: roundToResolution(P, MANOMETER_RES), volumeReading: roundToResolution(V, SYRINGE_RES),
    pv: P * V, vOverT: V / T, pOverT: P / T, warnings,
  };
}

export const gasesModelSpec: ModelSpec = {
  name: 'Gas ideal en una jeringa: leyes de Boyle, Charles y Gay-Lussac',
  inputs: [
    { symbol: 'ley', name: 'Variable que se mantiene constante (T, P o V)', unit: '—', initial: 'Boyle' },
    { symbol: 'V', name: 'Volumen de la jeringa (Boyle)', unit: 'mL', range: GAS_LIMITS.volume, initial: 100 },
    { symbol: 'T', name: 'Temperatura del baño (Charles y Gay-Lussac)', unit: '°C', range: GAS_LIMITS.temperature, initial: 25 },
  ],
  outputs: [
    { symbol: 'P', name: 'Presión (manómetro)', unit: 'kPa' },
    { symbol: 'V', name: 'Volumen (escala de la jeringa)', unit: 'mL' },
    { symbol: 'PV, V/T, P/T', name: 'Cantidades que se conservan en cada ley', unit: '—' },
  ],
  equations: [
    'P·V = n·R·T,  R = 8,314 J/(mol·K),  T(K) = T(°C) + 273,15',
    'Boyle (n, T constantes): P₁V₁ = P₂V₂',
    'Charles (n, P constantes): V₁/T₁ = V₂/T₂',
    'Gay-Lussac (n, V constantes): P₁/T₁ = P₂/T₂',
  ],
  initialConditions: ['100 mL de aire a 101,3 kPa y 25 °C (n ≈ 4,09 × 10⁻³ mol).'],
  assumptions: [
    'El aire se comporta como gas ideal (válido a presiones cercanas a la atmosférica).',
    'La jeringa no tiene fugas y el émbolo se mueve sin fricción.',
    'El gas alcanza la temperatura del baño antes de cada lectura.',
    'Lecturas con la resolución de cada instrumento: manómetro 0,1 kPa, jeringa 1 mL, termómetro 0,5 °C.',
  ],
  limits: [
    'A presiones altas o temperaturas bajas los gases reales se apartan del modelo ideal.',
    'No se modela el vapor de agua ni la expansión térmica de la jeringa.',
  ],
  testCases: [
    'Boyle: P·V es constante; a la mitad de volumen, el doble de presión.',
    'Charles: V/T es constante y la recta V contra T(°C) corta el eje en ≈ −273 °C.',
    'Gay-Lussac: P/T es constante.',
    'Cantidad de gas inicial ≈ 4,09 × 10⁻³ mol.',
  ],
};

/** Nivel y corrección de cada advertencia de `simulateGas`, con los mismos umbrales del modelo. */
export function gasConditions(warnings: readonly string[], input: GasInput): ModelCondition[] {
  const n = input.moles ?? molesInSyringe();
  const pMax = GAS_LIMITS.pressure[1];
  return classifyWarnings(warnings, [
    {
      match: 'La presión supera 300 kPa', level: 'invalido',
      fix: () => {
        if (input.law === 'boyle') {
          // P = nRT/V ≤ P_máx  →  V ≥ nRT/P_máx
          const vMin = ceilTo(((n * R_GAS * celsiusToKelvin(INITIAL.temperature)) / (pMax * 1000)) * 1e6, 10);
          return `Sube el «Volumen de la jeringa» a ${num(Math.max(vMin, GAS_LIMITS.volume[0]))} mL o más: a temperatura constante, más volumen es menos presión y la lectura queda por debajo de ${num(pMax)} kPa.`;
        }
        // Volumen constante: P = nRT/V ≤ P_máx  →  T ≤ P_máx·V/(nR)
        const tMax = floorTo((pMax * 1000 * INITIAL.volume * 1e-6) / (n * R_GAS) - 273.15, 5);
        return `Baja la «Temperatura del baño» a ${num(tMax)} °C o menos: a volumen constante la presión baja con la temperatura y queda por debajo de ${num(pMax)} kPa.`;
      },
    },
    { match: 'Por debajo de 0 °C', level: 'advertencia', fix: 'Sube la «Temperatura del baño» a 0 °C o más: así vale el supuesto de aire seco del modelo.' },
  ]);
}

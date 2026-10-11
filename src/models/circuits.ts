import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Circuitos de corriente continua (grado 11.º): ley de Ohm y leyes de Kirchhoff.
 * Configuraciones: serie, paralelo y mixta (R1 en serie con R2 ∥ R3).
 */

export type Topology = 'serie' | 'paralelo' | 'mixto';

export interface CircuitInput {
  topology: Topology;
  emf: number; // V
  internalResistance: number; // Ω
  resistances: [number, number, number]; // Ω
  closed: [boolean, boolean, boolean]; // interruptor de cada resistor/bombilla
  mainSwitch: boolean;
}

export interface ElementReading { id: number; resistance: number; current: number; voltage: number; power: number; active: boolean; }

export interface CircuitResult {
  equivalentResistance: number | null; // Ω (null: circuito abierto)
  totalCurrent: number; // A
  terminalVoltage: number; // V
  elements: ElementReading[];
  totalPower: number; // W entregada a los resistores externos
  internalLoss: number; // W disipada en la batería
  open: boolean;
  warnings: string[];
}

export const CIRCUIT_LIMITS = {
  emf: [1.5, 12] as [number, number],
  internalResistance: [0, 2] as [number, number],
  resistance: [1, 100] as [number, number],
};
export const MAX_SAFE_CURRENT = 3; // A (fusible del montaje)

const parallel = (rs: number[]) => (rs.length === 0 ? Infinity : 1 / rs.reduce((s, r) => s + 1 / r, 0));

export function solveCircuit(input: CircuitInput): CircuitResult {
  assertInRange('La fuerza electromotriz', input.emf, ...CIRCUIT_LIMITS.emf);
  assertInRange('La resistencia interna', input.internalResistance, ...CIRCUIT_LIMITS.internalResistance);
  input.resistances.forEach((r, i) => assertInRange(`R${i + 1}`, r, ...CIRCUIT_LIMITS.resistance));
  const [R1, R2, R3] = input.resistances;
  const [c1, c2, c3] = input.closed;
  const emf = input.emf, r = input.internalResistance;
  const zero = (i: number, R: number, active = false): ElementReading => ({ id: i + 1, resistance: R, current: 0, voltage: 0, power: 0, active });
  const warnings: string[] = [];

  let Req: number | null = null;
  // Corrientes por elemento como función de la corriente total I
  let split: (I: number) => number[] = () => [0, 0, 0];

  if (input.mainSwitch) {
    if (input.topology === 'serie') {
      if (c1 && c2 && c3) { Req = R1 + R2 + R3; split = (I) => [I, I, I]; }
    } else if (input.topology === 'paralelo') {
      const branches = [c1 && R1, c2 && R2, c3 && R3].filter((x): x is number => typeof x === 'number');
      if (branches.length > 0) {
        Req = parallel(branches);
        split = (I) => {
          const V = I * (Req as number);
          return [c1 ? V / R1 : 0, c2 ? V / R2 : 0, c3 ? V / R3 : 0];
        };
      }
    } else {
      const branches = [c2 && R2, c3 && R3].filter((x): x is number => typeof x === 'number');
      if (c1 && branches.length > 0) {
        const Rp = parallel(branches);
        Req = R1 + Rp;
        split = (I) => {
          const Vp = I * Rp;
          return [I, c2 ? Vp / R2 : 0, c3 ? Vp / R3 : 0];
        };
      }
    }
  }

  if (Req === null) {
    warnings.push('El circuito está abierto: no hay un camino cerrado para la corriente.');
    return {
      equivalentResistance: null, totalCurrent: 0, terminalVoltage: emf,
      elements: input.resistances.map((R, i) => zero(i, R)), totalPower: 0, internalLoss: 0, open: true, warnings,
    };
  }

  const I = emf / (Req + r);
  const currents = split(I);
  const elements = input.resistances.map((R, i) => ({
    id: i + 1, resistance: R, current: currents[i], voltage: currents[i] * R, power: currents[i] ** 2 * R, active: currents[i] > 0,
  }));
  if (I > MAX_SAFE_CURRENT) warnings.push(`La corriente total (${I.toFixed(2)} A) supera ${MAX_SAFE_CURRENT} A: en un montaje real se fundiría el fusible o se calentarían los cables.`);
  return {
    equivalentResistance: Req, totalCurrent: I, terminalVoltage: emf - I * r, elements,
    totalPower: elements.reduce((s, e) => s + e.power, 0), internalLoss: I * I * r, open: false, warnings,
  };
}

/** Brillo relativo de una bombilla (0–1) a partir de su potencia; 3 W equivale al brillo máximo mostrado. */
export function brightness(power: number): number {
  return Math.max(0, Math.min(1, power / 3));
}

export const circuitModelSpec: ModelSpec = {
  name: 'Circuitos de corriente continua con resistores óhmicos',
  inputs: [
    { symbol: 'configuración', name: 'Serie, paralelo o mixta', unit: '—', initial: 'serie' },
    { symbol: 'ε', name: 'Fuerza electromotriz de la batería', unit: 'V', range: CIRCUIT_LIMITS.emf, initial: 6 },
    { symbol: 'r', name: 'Resistencia interna', unit: 'Ω', range: CIRCUIT_LIMITS.internalResistance, initial: 0.5 },
    { symbol: 'R₁, R₂, R₃', name: 'Resistencias', unit: 'Ω', range: CIRCUIT_LIMITS.resistance, initial: 10 },
  ],
  outputs: [
    { symbol: 'I', name: 'Corriente', unit: 'A' },
    { symbol: 'V', name: 'Diferencia de potencial', unit: 'V' },
    { symbol: 'P', name: 'Potencia disipada', unit: 'W' },
    { symbol: 'R_eq', name: 'Resistencia equivalente', unit: 'Ω' },
  ],
  equations: [
    'Ley de Ohm: V = I·R',
    'Serie: R_eq = R₁ + R₂ + R₃ (misma corriente en todos)',
    'Paralelo: 1/R_eq = 1/R₁ + 1/R₂ + 1/R₃ (mismo voltaje en todas las ramas)',
    'Mixto: R_eq = R₁ + (R₂·R₃)/(R₂ + R₃)',
    'Circuito completo: I = ε / (R_eq + r);  V_bornes = ε − I·r',
    'Potencia: P = I²·R = V·I',
  ],
  initialConditions: ['Batería de 6 V con r = 0,5 Ω; tres resistores de 10 Ω en serie; interruptores cerrados.'],
  assumptions: [
    'Los resistores y las "bombillas" son óhmicos: su resistencia no cambia con la temperatura.',
    'Cables e instrumentos ideales: el amperímetro no tiene resistencia y el voltímetro no consume corriente.',
    'La batería se representa con una fem constante y una resistencia interna.',
  ],
  limits: [
    'Los filamentos reales aumentan mucho su resistencia al calentarse; el brillo mostrado es una aproximación a partir de la potencia.',
    'No se modelan corriente alterna, capacitores, inductores ni el desgaste de la batería.',
    'La advertencia de corriente excesiva (> 3 A) es un criterio didáctico de seguridad.',
  ],
  testCases: [
    '6 V, r = 0, 3 × 10 Ω en serie → R_eq = 30 Ω, I = 0,2 A, 2 V en cada resistor.',
    '6 V, r = 0, 3 × 10 Ω en paralelo → R_eq = 3,33 Ω, I = 1,8 A, 0,6 A por rama.',
    'Ley de mallas: la suma de caídas de voltaje más I·r es igual a ε.',
    'Ley de nodos: en paralelo, la suma de corrientes de rama es igual a la corriente total.',
    'Al abrir un interruptor en serie la corriente es cero; en paralelo, las otras ramas siguen funcionando.',
  ],
};

import { assertInRange } from './math';
import { molarMass, parseFormula, type Composition } from './chemistry';
import type { ModelSpec } from './types';

/**
 * Estequiometría y reactivo limitante (grado 11.º).
 */

export interface Species { formula: string; name: string; coef: number; }
export interface Reaction { id: string; name: string; context: string; reactants: Species[]; products: Species[]; }

export const REACTIONS: Reaction[] = [
  {
    id: 'bicarbonato-vinagre', name: 'Bicarbonato de sodio + ácido acético (vinagre)',
    context: 'Reacción casera que libera dióxido de carbono; se usa para hacer subir algunas masas y en "volcanes" escolares.',
    reactants: [{ formula: 'NaHCO3', name: 'bicarbonato de sodio', coef: 1 }, { formula: 'CH3COOH', name: 'ácido acético', coef: 1 }],
    products: [{ formula: 'CH3COONa', name: 'acetato de sodio', coef: 1 }, { formula: 'H2O', name: 'agua', coef: 1 }, { formula: 'CO2', name: 'dióxido de carbono', coef: 1 }],
  },
  {
    id: 'zinc-hcl', name: 'Zinc + ácido clorhídrico',
    context: 'Obtención de hidrógeno en el laboratorio escolar.',
    reactants: [{ formula: 'Zn', name: 'zinc', coef: 1 }, { formula: 'HCl', name: 'cloruro de hidrógeno', coef: 2 }],
    products: [{ formula: 'ZnCl2', name: 'cloruro de zinc', coef: 1 }, { formula: 'H2', name: 'hidrógeno', coef: 1 }],
  },
  {
    id: 'metano', name: 'Combustión completa del metano',
    context: 'Reacción del gas natural en las estufas domésticas.',
    reactants: [{ formula: 'CH4', name: 'metano', coef: 1 }, { formula: 'O2', name: 'oxígeno', coef: 2 }],
    products: [{ formula: 'CO2', name: 'dióxido de carbono', coef: 1 }, { formula: 'H2O', name: 'agua', coef: 2 }],
  },
  {
    id: 'amoniaco', name: 'Síntesis de amoníaco (Haber-Bosch)',
    context: 'Base de la producción industrial de fertilizantes nitrogenados.',
    reactants: [{ formula: 'N2', name: 'nitrógeno', coef: 1 }, { formula: 'H2', name: 'hidrógeno', coef: 3 }],
    products: [{ formula: 'NH3', name: 'amoníaco', coef: 2 }],
  },
  {
    id: 'agua', name: 'Formación de agua',
    context: 'Reacción de las celdas de combustible de hidrógeno.',
    reactants: [{ formula: 'H2', name: 'hidrógeno', coef: 2 }, { formula: 'O2', name: 'oxígeno', coef: 1 }],
    products: [{ formula: 'H2O', name: 'agua', coef: 2 }],
  },
];

export function findReaction(id: string): Reaction {
  const r = REACTIONS.find((x) => x.id === id);
  if (!r) throw new Error(`Reacción desconocida: ${id}`);
  return r;
}

/** Conteo de átomos de un lado de la ecuación con coeficientes dados. */
export function atomCount(species: { formula: string }[], coefs: number[]): Composition {
  const total: Composition = {};
  species.forEach((s, i) => {
    for (const [el, n] of Object.entries(parseFormula(s.formula))) total[el] = (total[el] ?? 0) + n * coefs[i];
  });
  return total;
}

export interface BalanceCheck { balanced: boolean; rows: { element: string; left: number; right: number }[]; }

export function checkBalance(reaction: Reaction, reactantCoefs: number[], productCoefs: number[]): BalanceCheck {
  const left = atomCount(reaction.reactants, reactantCoefs);
  const right = atomCount(reaction.products, productCoefs);
  const elements = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const rows = elements.map((element) => ({ element, left: left[element] ?? 0, right: right[element] ?? 0 }));
  const positive = [...reactantCoefs, ...productCoefs].every((c) => Number.isInteger(c) && c > 0);
  return { balanced: positive && rows.every((r) => r.left === r.right), rows };
}

export interface StoichInput { reactionId: string; massA: number; massB: number; yieldPercent: number; }

export interface StoichResult {
  reaction: Reaction;
  molarMasses: number[]; // reactivos y luego productos
  molesA: number; molesB: number;
  limiting: 0 | 1 | null; // índice del reactivo limitante; null si son proporciones exactas
  extent: number; // mol de "avance" de la reacción
  consumed: number[]; // g de cada reactivo consumido
  excess: number[]; // g sobrantes de cada reactivo
  theoreticalProducts: number[]; // g
  actualProducts: number[]; // g con rendimiento
  massBefore: number; massAfterTheoretical: number;
}

export const STOICH_LIMITS = { mass: [0, 200] as [number, number], yieldPercent: [1, 100] as [number, number] };

export function simulateStoichiometry(input: StoichInput): StoichResult {
  assertInRange('La masa del reactivo A', input.massA, ...STOICH_LIMITS.mass);
  assertInRange('La masa del reactivo B', input.massB, ...STOICH_LIMITS.mass);
  assertInRange('El rendimiento', input.yieldPercent, ...STOICH_LIMITS.yieldPercent);
  const reaction = findReaction(input.reactionId);
  const [A, B] = reaction.reactants;
  const mmR = reaction.reactants.map((s) => molarMass(s.formula));
  const mmP = reaction.products.map((s) => molarMass(s.formula));
  const molesA = input.massA / mmR[0];
  const molesB = input.massB / mmR[1];
  const xiA = molesA / A.coef;
  const xiB = molesB / B.coef;
  const extent = Math.min(xiA, xiB);
  let limiting: 0 | 1 | null = null;
  if (Math.abs(xiA - xiB) > 1e-12 * Math.max(xiA, xiB, 1)) limiting = xiA < xiB ? 0 : 1;
  const consumed = reaction.reactants.map((s, i) => extent * s.coef * mmR[i]);
  const excess = [input.massA - consumed[0], input.massB - consumed[1]].map((x) => Math.max(0, x));
  const theoreticalProducts = reaction.products.map((s, i) => extent * s.coef * mmP[i]);
  return {
    reaction, molarMasses: [...mmR, ...mmP], molesA, molesB, limiting, extent, consumed, excess,
    theoreticalProducts,
    actualProducts: theoreticalProducts.map((m) => (m * input.yieldPercent) / 100),
    massBefore: input.massA + input.massB,
    massAfterTheoretical: theoreticalProducts.reduce((a, b) => a + b, 0) + excess.reduce((a, b) => a + b, 0),
  };
}

export const stoichModelSpec: ModelSpec = {
  name: 'Relaciones estequiométricas, reactivo limitante y rendimiento',
  inputs: [
    { symbol: 'reacción', name: 'Ecuación química balanceada', unit: '—', initial: 'bicarbonato + vinagre' },
    { symbol: 'm_A, m_B', name: 'Masas de los reactivos', unit: 'g', range: STOICH_LIMITS.mass, initial: 10 },
    { symbol: '%R', name: 'Rendimiento porcentual', unit: '%', range: STOICH_LIMITS.yieldPercent, initial: 100 },
  ],
  outputs: [
    { symbol: 'n', name: 'Moles de cada reactivo', unit: 'mol' },
    { symbol: 'limitante', name: 'Reactivo limitante y reactivo en exceso', unit: '—' },
    { symbol: 'm_producto', name: 'Masa teórica y real de cada producto', unit: 'g' },
  ],
  equations: [
    'n = m / M',
    'Avance de reacción ξ = mín(n_A/ν_A, n_B/ν_B); el reactivo con menor n/ν es el limitante',
    'm_producto (teórica) = ξ·ν_producto·M_producto',
    'Rendimiento: m_real = m_teórica·%R/100',
    'Conservación de la masa: Σ m_reactivos = Σ m_productos + Σ m_exceso (con %R = 100)',
  ],
  initialConditions: ['10 g de NaHCO₃ y 10 g de CH₃COOH, rendimiento 100 %.'],
  assumptions: [
    'La reacción ocurre completamente en una sola dirección (sin equilibrio químico).',
    'Los reactivos son puros; en la realidad el vinagre es una solución acuosa diluida (≈ 4–5 % de ácido acético).',
    'El rendimiento menor al 100 % se aplica por igual a todos los productos.',
  ],
  limits: [
    'No se modelan reacciones secundarias, la velocidad de reacción ni las condiciones (temperatura, presión, catalizadores).',
    'La síntesis de amoníaco real es un equilibrio y nunca alcanza conversión completa.',
  ],
  testCases: [
    'Todas las ecuaciones del catálogo están balanceadas (átomos iguales a ambos lados).',
    'Con 100 % de rendimiento se conserva la masa total.',
    '4,032 g de H₂ + 32 g de O₂ → 36,03 g de H₂O, sin reactivo en exceso.',
    'Duplicar el reactivo en exceso no cambia la cantidad de producto.',
  ],
};

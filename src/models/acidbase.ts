import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Ácidos, bases, pH, dilución y neutralización (grado 11.º).
 * El pH se obtiene resolviendo exactamente el balance de cargas (a 25 °C):
 *   [H⁺] + [Na⁺] = [OH⁻] + [A⁻],   [OH⁻] = Kw/[H⁺],   [A⁻] = C_A·Ka/(Ka + [H⁺])
 * Para un ácido fuerte, Ka → ∞ y [A⁻] = C_A.
 */

export const KW = 1e-14;

export interface Acid { id: string; name: string; formula: string; ka: number | null; /** null = ácido fuerte */ }
export const ACIDS: Acid[] = [
  { id: 'hcl', name: 'Ácido clorhídrico', formula: 'HCl', ka: null },
  { id: 'acetico', name: 'Ácido acético (vinagre)', formula: 'CH3COOH', ka: 1.8e-5 },
];

export interface Indicator { id: string; name: string; low: number; high: number; acidColor: string; baseColor: string; }
export const INDICATORS: Indicator[] = [
  { id: 'fenolftaleina', name: 'Fenolftaleína', low: 8.2, high: 10.0, acidColor: 'rgba(255,255,255,0.15)', baseColor: '#d63384' },
  { id: 'azul-bromotimol', name: 'Azul de bromotimol', low: 6.0, high: 7.6, acidColor: '#e8c33a', baseColor: '#2f5fc4' },
  { id: 'rojo-metilo', name: 'Rojo de metilo', low: 4.4, high: 6.2, acidColor: '#d9342b', baseColor: '#e8c33a' },
];

export const ACIDBASE_LIMITS = {
  acidConc: [1e-4, 1] as [number, number], // mol/L
  acidVolume: [5, 50] as [number, number], // mL
  baseConc: [1e-4, 1] as [number, number],
  baseVolume: [0, 100] as [number, number],
};

export function findAcid(id: string): Acid {
  const a = ACIDS.find((x) => x.id === id);
  if (!a) throw new Error(`Ácido desconocido: ${id}`);
  return a;
}

/** pH de una mezcla con un ácido monoprótico (concentración analítica ca) y NaOH (cb), en mol/L. */
export function solvePH(ca: number, cb: number, ka: number | null): number {
  const f = (h: number) => h + cb - KW / h - (ka === null ? ca : (ca * ka) / (ka + h));
  // f es creciente en h: bisección sobre log10(h) entre pH 0 y 14 (ampliado).
  let lo = -16, hi = 1; // log10[H⁺]
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(10 ** mid) > 0) hi = mid; else lo = mid;
  }
  return -(lo + hi) / 2;
}

export interface TitrationInput { acidId: string; acidConc: number; acidVolume: number; baseConc: number; baseVolume: number; }
export interface TitrationResult {
  pH: number; pOH: number; hydrogen: number;
  equivalenceVolume: number; // mL de base
  equivalencePH: number;
  halfEquivalencePH: number | null; // = pKa para ácidos débiles
  state: 'antes de la equivalencia' | 'punto de equivalencia' | 'después de la equivalencia';
  totalVolume: number;
}

export function mixturePH(acidId: string, acidConc: number, acidVolume: number, baseConc: number, baseVolume: number): number {
  const acid = findAcid(acidId);
  const V = (acidVolume + baseVolume) / 1000;
  const ca = (acidConc * acidVolume) / 1000 / V;
  const cb = (baseConc * baseVolume) / 1000 / V;
  return solvePH(ca, cb, acid.ka);
}

export function titrate(input: TitrationInput): TitrationResult {
  assertInRange('La concentración del ácido', input.acidConc, ...ACIDBASE_LIMITS.acidConc);
  assertInRange('El volumen del ácido', input.acidVolume, ...ACIDBASE_LIMITS.acidVolume);
  assertInRange('La concentración de la base', input.baseConc, ...ACIDBASE_LIMITS.baseConc);
  assertInRange('El volumen de base añadido', input.baseVolume, ...ACIDBASE_LIMITS.baseVolume);
  const acid = findAcid(input.acidId);
  const pH = mixturePH(input.acidId, input.acidConc, input.acidVolume, input.baseConc, input.baseVolume);
  const veq = (input.acidConc * input.acidVolume) / input.baseConc;
  const eqPH = mixturePH(input.acidId, input.acidConc, input.acidVolume, input.baseConc, veq);
  const halfPH = acid.ka === null ? null : mixturePH(input.acidId, input.acidConc, input.acidVolume, input.baseConc, veq / 2);
  const rel = (input.baseVolume - veq) / veq;
  const state = Math.abs(rel) < 0.005 ? 'punto de equivalencia' : rel < 0 ? 'antes de la equivalencia' : 'después de la equivalencia';
  return { pH, pOH: 14 - pH, hydrogen: 10 ** -pH, equivalenceVolume: veq, equivalencePH: eqPH, halfEquivalencePH: halfPH, state, totalVolume: input.acidVolume + input.baseVolume };
}

export function titrationCurve(input: Omit<TitrationInput, 'baseVolume'>, maxVolume: number, points = 200): { v: number; pH: number }[] {
  return Array.from({ length: points + 1 }, (_, i) => {
    const v = (maxVolume * i) / points;
    return { v, pH: mixturePH(input.acidId, input.acidConc, input.acidVolume, input.baseConc, v) };
  });
}

/** Color del indicador: mezcla lineal en su intervalo de viraje. */
export function indicatorColor(ind: Indicator, pH: number): { color: string; label: string } {
  if (pH <= ind.low) return { color: ind.acidColor, label: 'color ácido' };
  if (pH >= ind.high) return { color: ind.baseColor, label: 'color básico' };
  return { color: `color-mix(in srgb, ${ind.baseColor} ${Math.round(((pH - ind.low) / (ind.high - ind.low)) * 100)}%, ${ind.acidColor})`, label: 'en viraje' };
}

/** Dilución de un ácido: pH tras diluir n veces (C/n). */
export function dilutedPH(acidId: string, conc: number, factor: number): number {
  if (factor < 1) throw new RangeError('El factor de dilución debe ser ≥ 1.');
  return solvePH(conc / factor, 0, findAcid(acidId).ka);
}

export const acidBaseModelSpec: ModelSpec = {
  name: 'pH de ácidos fuertes y débiles, dilución y curva de titulación con NaOH',
  inputs: [
    { symbol: 'ácido', name: 'Ácido (HCl fuerte o CH₃COOH débil, Ka = 1,8 × 10⁻⁵)', unit: '—', initial: 'HCl' },
    { symbol: 'C_A', name: 'Concentración del ácido', unit: 'mol/L', range: ACIDBASE_LIMITS.acidConc, initial: 0.1 },
    { symbol: 'V_A', name: 'Volumen de ácido en el erlenmeyer', unit: 'mL', range: ACIDBASE_LIMITS.acidVolume, initial: 25 },
    { symbol: 'C_B', name: 'Concentración de NaOH en la bureta', unit: 'mol/L', range: ACIDBASE_LIMITS.baseConc, initial: 0.1 },
    { symbol: 'V_B', name: 'Volumen de NaOH añadido', unit: 'mL', range: ACIDBASE_LIMITS.baseVolume, initial: 0 },
  ],
  outputs: [
    { symbol: 'pH', name: 'pH de la mezcla', unit: '—' },
    { symbol: 'V_eq', name: 'Volumen en el punto de equivalencia', unit: 'mL' },
    { symbol: 'color', name: 'Color del indicador', unit: '—' },
  ],
  equations: [
    'pH = −log[H⁺];  pH + pOH = 14 (25 °C)',
    'Balance de cargas: [H⁺] + [Na⁺] = [OH⁻] + [A⁻]',
    'Ácido débil: [A⁻] = C_A·Ka/(Ka + [H⁺]);  ácido fuerte: [A⁻] = C_A',
    'Equivalencia: C_A·V_A = C_B·V_eq',
    'En la semiequivalencia de un ácido débil: pH = pKa',
  ],
  initialConditions: ['25 mL de HCl 0,1 M con NaOH 0,1 M en la bureta, sin base añadida.'],
  assumptions: [
    'Soluciones diluidas e ideales: actividades iguales a concentraciones.',
    'Temperatura de 25 °C (Kw = 1,0 × 10⁻¹⁴).',
    'Volúmenes aditivos y mezcla instantánea.',
  ],
  limits: [
    'A concentraciones altas (> 0,1 M) las actividades se apartan de las concentraciones y el pH real difiere.',
    'No incluye ácidos polipróticos, soluciones amortiguadoras complejas ni la absorción de CO₂ del aire.',
    'Los colores de los indicadores son aproximados.',
  ],
  testCases: [
    'HCl 0,1 M → pH 1; diluido 10 veces → pH 2.',
    'HCl 1 × 10⁻⁸ M → pH ≈ 6,98 (nunca básico por diluir un ácido).',
    'Titulación fuerte-fuerte: pH 7 en la equivalencia.',
    'Ácido acético 0,1 M → pH ≈ 2,87; en la semiequivalencia pH = pKa ≈ 4,74; en la equivalencia pH ≈ 8,7.',
  ],
};

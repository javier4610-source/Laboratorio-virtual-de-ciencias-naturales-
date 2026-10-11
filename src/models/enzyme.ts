import { assertInRange, celsiusToKelvin, R_GAS } from './math';
import type { ModelSpec } from './types';

/**
 * Actividad enzimática (grado 10.º): Michaelis-Menten modulado por temperatura y pH.
 *
 *   v = V_max(T, pH, [E]) · [S] / (K_m + [S])
 *   V_max = k_cat·[E] · f_T(T) · f_pH(pH)
 *   f_T  = exp[−Eₐ/R·(1/T − 1/T_ref)] · 1/(1 + exp((T − T_m)/w))   (activación térmica × desnaturalización)
 *   f_pH = 1/(1 + 10^(pKa₁ − pH) + 10^(pH − pKa₂)), normalizado en el pH óptimo
 */

export interface EnzymeInfo {
  id: string;
  name: string;
  substrate: string;
  product: string;
  source: string;
  km: number; // mmol/L
  vmaxRef: number; // µmol/min con [E] relativa = 1, a T_ref y pH óptimo
  pHopt: number;
  pHwidth: number; // separación entre pKa y pH óptimo
  tm: number; // °C, temperatura de semidesnaturalización (para la duración del ensayo)
  w: number; // °C, anchura de la transición
  ea: number; // J/mol
}

/** Parámetros ilustrativos coherentes con rangos reportados en textos de bioquímica; no son mediciones de una enzima concreta. */
export const ENZYMES: EnzymeInfo[] = [
  { id: 'amilasa', name: 'Amilasa salival', substrate: 'almidón', product: 'maltosa', source: 'saliva humana', km: 5, vmaxRef: 20, pHopt: 6.8, pHwidth: 1.6, tm: 45, w: 2.5, ea: 50000 },
  { id: 'pepsina', name: 'Pepsina', substrate: 'proteínas', product: 'péptidos', source: 'jugo gástrico', km: 8, vmaxRef: 15, pHopt: 2, pHwidth: 1.4, tm: 47, w: 2.5, ea: 45000 },
  { id: 'catalasa', name: 'Catalasa', substrate: 'peróxido de hidrógeno', product: 'agua y oxígeno', source: 'hígado / papa', km: 12, vmaxRef: 40, pHopt: 7, pHwidth: 2.2, tm: 50, w: 3, ea: 30000 },
];

export const T_REF = 25;

export const ENZYME_LIMITS = {
  temperature: [0, 80] as [number, number],
  pH: [1, 13] as [number, number],
  substrate: [0, 50] as [number, number], // mmol/L
  enzyme: [0.25, 2] as [number, number], // concentración relativa
  duration: [1, 20] as [number, number], // min
};

export function findEnzyme(id: string): EnzymeInfo {
  const e = ENZYMES.find((x) => x.id === id);
  if (!e) throw new Error(`Enzima desconocida: ${id}`);
  return e;
}

export function temperatureFactor(e: EnzymeInfo, tempC: number): number {
  const T = celsiusToKelvin(tempC);
  const Tref = celsiusToKelvin(T_REF);
  const arrhenius = Math.exp((-e.ea / R_GAS) * (1 / T - 1 / Tref));
  const native = 1 / (1 + Math.exp((tempC - e.tm) / e.w));
  const nativeRef = 1 / (1 + Math.exp((T_REF - e.tm) / e.w));
  return (arrhenius * native) / nativeRef;
}

export function pHFactor(e: EnzymeInfo, pH: number): number {
  const pKa1 = e.pHopt - e.pHwidth;
  const pKa2 = e.pHopt + e.pHwidth;
  const f = (x: number) => 1 / (1 + 10 ** (pKa1 - x) + 10 ** (x - pKa2));
  return f(pH) / f(e.pHopt);
}

export function initialRate(e: EnzymeInfo, tempC: number, pH: number, substrate: number, enzymeRel: number): number {
  const vmax = e.vmaxRef * enzymeRel * temperatureFactor(e, tempC) * pHFactor(e, pH);
  return (vmax * substrate) / (e.km + substrate);
}

/** Temperatura óptima calculada numéricamente (paso de 0,1 °C). */
export function optimalTemperature(e: EnzymeInfo): number {
  let best = 0, bestV = -1;
  for (let t = 0; t <= 80; t += 0.1) {
    const v = temperatureFactor(e, t);
    if (v > bestV) { bestV = v; best = t; }
  }
  return Math.round(best * 10) / 10;
}

export interface EnzymeInput {
  enzymeId: string;
  temperature: number;
  pH: number;
  substrate: number; // mmol/L
  enzyme: number; // relativa
  duration: number; // min
}

export interface EnzymeResult {
  enzyme: EnzymeInfo;
  v0: number; // µmol/min (volumen de reacción de 1 mL → equivalente a mmol/L·min)
  fT: number;
  fpH: number;
  series: { t: number; product: number; substrate: number }[];
  productFinal: number; // mmol/L
  percentConverted: number;
  optimalT: number;
  warnings: string[];
}

export function simulateEnzyme(input: EnzymeInput): EnzymeResult {
  assertInRange('La temperatura', input.temperature, ...ENZYME_LIMITS.temperature);
  assertInRange('El pH', input.pH, ...ENZYME_LIMITS.pH);
  assertInRange('La concentración de sustrato', input.substrate, ...ENZYME_LIMITS.substrate);
  assertInRange('La concentración de enzima', input.enzyme, ...ENZYME_LIMITS.enzyme);
  assertInRange('El tiempo', input.duration, ...ENZYME_LIMITS.duration);
  const e = findEnzyme(input.enzymeId);
  const fT = temperatureFactor(e, input.temperature);
  const fpH = pHFactor(e, input.pH);
  const vmax = e.vmaxRef * input.enzyme * fT * fpH; // mmol/L·min en 1 mL de mezcla
  const v0 = (vmax * input.substrate) / (e.km + input.substrate);
  // Integración del consumo de sustrato: dS/dt = −v(S)
  const series: { t: number; product: number; substrate: number }[] = [];
  let S = input.substrate;
  const dt = 0.01;
  const steps = Math.round(input.duration / dt);
  series.push({ t: 0, product: 0, substrate: S });
  for (let i = 1; i <= steps; i++) {
    const rate = (s: number) => (vmax * s) / (e.km + s);
    const k1 = rate(S), k2 = rate(S - (dt * k1) / 2), k3 = rate(S - (dt * k2) / 2), k4 = rate(S - dt * k3);
    S = Math.max(0, S - (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
    if (i % 25 === 0) series.push({ t: i * dt, product: input.substrate - S, substrate: S });
  }
  const productFinal = input.substrate - S;
  const warnings: string[] = [];
  if (input.temperature > e.tm) warnings.push(`A ${input.temperature} °C la mayor parte de la ${e.name.toLowerCase()} está desnaturalizada.`);
  if (fpH < 0.2) warnings.push(`El pH ${input.pH} está lejos del óptimo (${e.pHopt}): la enzima pierde casi toda su actividad.`);
  if (input.substrate === 0) warnings.push('Sin sustrato no hay producto: la enzima no tiene sobre qué actuar.');
  return {
    enzyme: e, v0, fT, fpH, series, productFinal,
    percentConverted: input.substrate > 0 ? (productFinal / input.substrate) * 100 : 0,
    optimalT: optimalTemperature(e), warnings,
  };
}

export const enzymeModelSpec: ModelSpec = {
  name: 'Cinética enzimática de Michaelis-Menten con efectos de temperatura y pH',
  inputs: [
    { symbol: 'enzima', name: 'Enzima', unit: '—', initial: 'amilasa' },
    { symbol: 'T', name: 'Temperatura', unit: '°C', range: ENZYME_LIMITS.temperature, initial: 37 },
    { symbol: 'pH', name: 'pH del medio', unit: '—', range: ENZYME_LIMITS.pH, initial: 7 },
    { symbol: '[S]', name: 'Concentración inicial de sustrato', unit: 'mmol/L', range: ENZYME_LIMITS.substrate, initial: 10 },
    { symbol: '[E]', name: 'Concentración relativa de enzima', unit: '×', range: ENZYME_LIMITS.enzyme, initial: 1 },
  ],
  outputs: [
    { symbol: 'v₀', name: 'Velocidad inicial de reacción', unit: 'mmol/(L·min)' },
    { symbol: '[P](t)', name: 'Producto formado en el tiempo', unit: 'mmol/L' },
  ],
  equations: [
    'v = V_max·[S] / (K_m + [S])',
    'V_max = k·[E]·f_T·f_pH',
    'f_T = exp[−Eₐ/R·(1/T − 1/298 K)] / (1 + e^((T − T_m)/w))',
    'f_pH = 1 / (1 + 10^(pKa₁ − pH) + 10^(pH − pKa₂)) (normalizado en el pH óptimo)',
    'd[S]/dt = −v;  [P] = [S]₀ − [S]',
  ],
  initialConditions: ['Amilasa salival a 37 °C, pH 7, [S]₀ = 10 mmol/L, [E] = 1×, 5 min.'],
  assumptions: [
    'La enzima sigue la cinética de Michaelis-Menten (un sustrato, sin inhibición).',
    'La desnaturalización se representa como un equilibrio que depende de la temperatura durante un ensayo de pocos minutos.',
    'El pH modifica la ionización de dos grupos del sitio activo (modelo de dos pKa).',
    'Parámetros ilustrativos: el pH óptimo se basa en valores típicos (amilasa ≈ 6,8; pepsina ≈ 2; catalasa ≈ 7) y los demás valores son didácticos.',
  ],
  limits: [
    'No representa inhibidores, cofactores, inhibición por producto ni desnaturalización irreversible acumulada en el tiempo.',
    'La temperatura óptima real depende de la duración del ensayo y del organismo de origen.',
    'Las velocidades absolutas no corresponden a una preparación enzimática real.',
  ],
  testCases: [
    'Con [S] = K_m, la velocidad es la mitad de V_max.',
    'La velocidad aumenta con [S] y se satura a concentraciones altas.',
    'La amilasa tiene un óptimo de temperatura entre 35 y 45 °C y casi nula actividad a 70 °C.',
    'La pepsina es más activa a pH 2 que a pH 7; la amilasa, al contrario.',
    'Duplicar la concentración de enzima duplica la velocidad inicial.',
  ],
};

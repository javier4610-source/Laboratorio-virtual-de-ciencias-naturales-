import { assertInRange, celsiusToKelvin, R_GAS, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Equilibrio químico y principio de Le Châtelier (grado 11.º).
 *
 * Sistema A (disolución): Fe³⁺(ac) + SCN⁻(ac) ⇌ FeSCN²⁺(ac)   Kc = [FeSCN²⁺] / ([Fe³⁺][SCN⁻])
 *   El complejo FeSCN²⁺ es rojo sangre; su absorbancia a 450 nm se mide con un colorímetro.
 * Sistema B (gases en una jeringa sellada): 2 NO₂(g) ⇌ N₂O₄(g)   Kp = P(N₂O₄) / P(NO₂)²
 *   El NO₂ es marrón y el N₂O₄ es incoloro: la intensidad del color sigue a [NO₂].
 *
 * En cada estado el equilibrio se resuelve EXACTAMENTE con la fórmula cuadrática.
 * La relajación entre estados (animación) usa una cinética de primer orden aparente,
 * solo para mostrar el camino; los valores finales son siempre los del equilibrio exacto.
 */

/* ------------------------------------------------------------------ constantes */

/** Temperatura de referencia de las constantes, °C. */
export const T_REF_C = 25;

/**
 * Kc de formación de FeSCN²⁺ a 25 °C (L/mol). Valor de referencia aproximado:
 * los valores publicados varían mucho con la fuerza iónica (≈ 10² a 10³).
 */
export const KC_FESCN_25 = 110;
/** ΔH de formación de FeSCN²⁺ (J/mol): ligeramente exotérmica. Valor de referencia aproximado. */
export const DH_FESCN = -6000;
/** Absortividad molar del FeSCN²⁺ a 450 nm (L·mol⁻¹·cm⁻¹), valor de referencia aproximado. */
export const EPSILON_450 = 4700;
export const CUVETTE_CM = 1;
/** Resolución del colorímetro (unidades de absorbancia) y lectura máxima confiable. */
export const ABS_RES = 0.001;
export const ABS_MAX = 3;

/**
 * Kp de dimerización 2 NO₂ ⇌ N₂O₄ a 298,15 K (bar⁻¹), calculado con las energías de Gibbs de
 * formación de tablas termodinámicas (NO₂ ≈ 51,3 kJ/mol; N₂O₄ ≈ 97,9 kJ/mol): ΔG° ≈ −4,7 kJ/mol.
 */
export const KP_NO2_25 = 6.7;
/** ΔH de dimerización (J/mol), de las entalpías de formación tabuladas (2 × 33,2 → 9,2 kJ/mol). */
export const DH_NO2 = -57200;
/** Resolución del comparador de color para el sistema B (intensidad relativa). */
export const INTENSITY_RES = 1;

/** Preparación del tubo del sistema A. */
export const FE_SETUP = {
  baseVolumeML: 10, // 10,0 mL de mezcla inicial
  feMmol: 0.01, // Fe³⁺ 1,0 × 10⁻³ mol/L en la mezcla inicial
  scnMmol: 0.01, // SCN⁻ 1,0 × 10⁻³ mol/L en la mezcla inicial
  dropML: 0.05, // volumen de una gota
  dropConc: 0.2, // Fe(NO₃)₃ y KSCN de los goteros, mol/L
  agConc: 0.02, // AgNO₃ del gotero, mol/L
  waterStepML: 2, // cada adición de agua
};

export const FE_LIMITS = {
  drops: [0, 10] as [number, number],
  waterML: [0, 10] as [number, number],
  temperature: [5, 60] as [number, number], // °C
};

/**
 * Jeringa sellada del sistema B: 2,0 mmol de NO₂ «equivalente» (n(NO₂) + 2·n(N₂O₄)) mezclados
 * con 1,2 mmol de aire (inerte), para que la presión inicial sea cercana a 1 bar.
 */
export const NO2_SETUP = { n0Mmol: 2, airMmol: 1.2, volumeML: 60, temperature: 25 };
/** Presión de vapor del N₂O₄ (Clausius-Clapeyron): ebullición normal 21,15 °C, ΔHvap ≈ 38 kJ/mol. */
export function n2o4VaporPressure(tempC: number): number {
  return 1.01325 * Math.exp((-38000 / R_GAS) * (1 / celsiusToKelvin(tempC) - 1 / celsiusToKelvin(21.15)));
}
export const NO2_LIMITS = {
  volume: [20, 100] as [number, number], // mL
  temperature: [0, 80] as [number, number], // °C
};

/* ------------------------------------------------------------------ utilidades */

/** Van 't Hoff con ΔH constante: K(T) = K(T₀)·exp[−ΔH/R·(1/T − 1/T₀)]. */
export function vantHoff(kRef: number, deltaH: number, tempC: number, refC = T_REF_C): number {
  const T = celsiusToKelvin(tempC), T0 = celsiusToKelvin(refC);
  return kRef * Math.exp((-deltaH / R_GAS) * (1 / T - 1 / T0));
}

export function kFeSCN(tempC: number): number {
  assertInRange('La temperatura del baño', tempC, ...FE_LIMITS.temperature);
  return vantHoff(KC_FESCN_25, DH_FESCN, tempC);
}

export function kpNO2(tempC: number): number {
  assertInRange('La temperatura del baño', tempC, ...NO2_LIMITS.temperature);
  return vantHoff(KP_NO2_25, DH_NO2, tempC);
}

export type Direction = 'productos' | 'reactivos' | 'ninguno';

/** Compara Q con K (tolerancia relativa) y da el sentido en que se desplaza el sistema. */
export function shiftDirection(q: number, k: number): Direction {
  if (!Number.isFinite(q) && !Number.isNaN(q)) return 'reactivos'; // Q = ∞
  if (Number.isNaN(q)) return 'ninguno';
  if (Math.abs(q - k) <= 1e-9 * k) return 'ninguno';
  return q < k ? 'productos' : 'reactivos';
}

export const DIRECTION_TEXT: Record<Direction, string> = {
  productos: 'hacia los productos',
  reactivos: 'hacia los reactivos',
  ninguno: 'no se desplaza',
};

/** Texto «Q < K: se desplaza hacia productos». */
export function compareText(q: number, k: number): string {
  const d = shiftDirection(q, k);
  if (d === 'ninguno') return Number.isNaN(q) ? 'No hay reacción posible (falta un reactivo y no hay producto).' : 'Q = K: el sistema ya está en equilibrio.';
  return d === 'productos' ? 'Q < K: se desplaza hacia los productos.' : 'Q > K: se desplaza hacia los reactivos.';
}

/**
 * Progreso de la relajación (0 → 1) con cinética de primer orden aparente, normalizado para
 * terminar exactamente en 1 al cabo de `duration` segundos. Solo para la animación.
 */
export function relaxProgress(tSec: number, tau = 0.6, duration = 3): number {
  const t = Math.max(0, Math.min(duration, tSec));
  return (1 - Math.exp(-t / tau)) / (1 - Math.exp(-duration / tau));
}

/* ------------------------------------------------------------------ sistema A */

export interface FeState { gotasFe: number; gotasSCN: number; gotasAg: number; aguaML: number; temperatura: number; }

export const FE_INITIAL: FeState = { gotasFe: 0, gotasSCN: 0, gotasAg: 0, aguaML: 0, temperatura: T_REF_C };

export interface FeEquilibrium {
  state: FeState;
  volumeML: number;
  K: number;
  feTotal: number; scnTotal: number; agTotal: number; // mmol
  /** SCN⁻ precipitado como AgSCN y Ag⁺ sobrante (mmol). */
  precipitated: number; agExcess: number;
  /** Concentraciones en el equilibrio (mol/L). */
  fe: number; scn: number; complex: number;
  /** Q con las concentraciones de equilibrio (= K salvo si falta un reactivo). */
  Q: number;
  absorbance: number;
  /** Lectura del colorímetro (null si supera el rango). */
  absorbanceReading: number | null;
  warnings: string[];
}

function validateFe(s: FeState) {
  assertInRange('Las gotas de Fe³⁺', s.gotasFe, ...FE_LIMITS.drops);
  assertInRange('Las gotas de SCN⁻', s.gotasSCN, ...FE_LIMITS.drops);
  assertInRange('Las gotas de Ag⁺', s.gotasAg, ...FE_LIMITS.drops);
  assertInRange('El agua agregada', s.aguaML, ...FE_LIMITS.waterML);
  assertInRange('La temperatura del baño', s.temperatura, ...FE_LIMITS.temperature);
}

export function feVolumeML(s: FeState): number {
  return FE_SETUP.baseVolumeML + FE_SETUP.dropML * (s.gotasFe + s.gotasSCN + s.gotasAg) + s.aguaML;
}

/**
 * Resuelve K = x / ((a − x)(b − x)) para x (concentración del producto), con a y b totales.
 * Raíz menor de K·x² − (K(a + b) + 1)·x + K·a·b = 0, escrita en forma estable.
 */
export function solveComplex(K: number, a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  const B = K * (a + b) + 1;
  const disc = Math.max(0, B * B - 4 * K * K * a * b);
  return (2 * K * a * b) / (B + Math.sqrt(disc));
}

export function absorbanceOf(complex: number): number {
  return EPSILON_450 * CUVETTE_CM * complex;
}

export function solveFeSCN(s: FeState): FeEquilibrium {
  validateFe(s);
  const V = feVolumeML(s);
  const K = kFeSCN(s.temperatura);
  const feTotal = FE_SETUP.feMmol + s.gotasFe * FE_SETUP.dropML * FE_SETUP.dropConc;
  const scnTotal = FE_SETUP.scnMmol + s.gotasSCN * FE_SETUP.dropML * FE_SETUP.dropConc;
  const agTotal = s.gotasAg * FE_SETUP.dropML * FE_SETUP.agConc;
  // AgSCN es muy poco soluble (Kps ≈ 10⁻¹²): se supone precipitación completa del SCN⁻ disponible.
  const precipitated = Math.min(agTotal, scnTotal);
  const agExcess = agTotal - precipitated;
  const a = feTotal / V, b = (scnTotal - precipitated) / V; // mmol/mL = mol/L
  const x = solveComplex(K, a, b);
  const fe = a - x, scn = Math.max(0, b - x);
  const Q = fe > 0 && scn > 0 ? x / (fe * scn) : NaN;
  const A = absorbanceOf(x);
  const warnings: string[] = [];
  if (agTotal > 0) warnings.push(agExcess > 0
    ? 'Todo el SCN⁻ precipitó como AgSCN (sólido blanco): ya no puede formarse FeSCN²⁺.'
    : 'Se formó un precipitado blanco de AgSCN: el Ag⁺ retiró SCN⁻ de la disolución.');
  if (A > ABS_MAX) warnings.push('La absorbancia supera 3: fuera del intervalo útil del colorímetro. Diluye la muestra o usa menos gotas.');
  return {
    state: s, volumeML: V, K, feTotal, scnTotal, agTotal, precipitated, agExcess,
    fe, scn, complex: x, Q,
    absorbance: A, absorbanceReading: A > ABS_MAX ? null : roundToResolution(A, ABS_RES), warnings,
  };
}

export type FePerturbation =
  | { kind: 'fe' } | { kind: 'scn' } | { kind: 'ag' } | { kind: 'agua' } | { kind: 'temperatura'; value: number };

export const FE_PERTURBATION_TEXT: Record<FePerturbation['kind'], string> = {
  fe: 'Agregar Fe³⁺', scn: 'Agregar SCN⁻', ag: 'Agregar Ag⁺', agua: 'Diluir con agua', temperatura: 'Cambiar la temperatura',
};

/** Aplica una perturbación (una gota, 2 mL de agua o un nuevo baño) y valida los rangos. */
export function applyFePerturbation(s: FeState, p: FePerturbation): FeState {
  const n = { ...s };
  if (p.kind === 'fe') n.gotasFe += 1;
  else if (p.kind === 'scn') n.gotasSCN += 1;
  else if (p.kind === 'ag') n.gotasAg += 1;
  else if (p.kind === 'agua') n.aguaML += FE_SETUP.waterStepML;
  else n.temperatura = p.value;
  validateFe(n);
  return n;
}

export interface FeResponse {
  before: FeEquilibrium;
  after: FeEquilibrium;
  /** Concentraciones justo después de perturbar, antes de que el sistema responda (mol/L). */
  immediate: { fe: number; scn: number; complex: number };
  /** Q inmediatamente después de la perturbación y K a la nueva temperatura. */
  qImmediate: number;
  K: number;
  direction: Direction;
}

/**
 * Respuesta del sistema A al pasar del estado `prev` (en equilibrio) al estado `next`.
 * Solo se pueden agregar sustancias (gotas o agua); la temperatura puede subir o bajar.
 */
export function feResponse(prev: FeState, next: FeState): FeResponse {
  const before = solveFeSCN(prev);
  const after = solveFeSCN(next);
  const d = {
    fe: (next.gotasFe - prev.gotasFe) * FE_SETUP.dropML * FE_SETUP.dropConc,
    scn: (next.gotasSCN - prev.gotasSCN) * FE_SETUP.dropML * FE_SETUP.dropConc,
    ag: (next.gotasAg - prev.gotasAg) * FE_SETUP.dropML * FE_SETUP.agConc,
    water: next.aguaML - prev.aguaML,
  };
  if (d.fe < 0 || d.scn < 0 || d.ag < 0 || d.water < 0) throw new RangeError('Una vez agregadas, las gotas o el agua no se pueden retirar: prepara un tubo nuevo.');
  const V0 = before.volumeML, V1 = after.volumeML;
  const nFe = before.fe * V0 + d.fe;
  const nC = before.complex * V0;
  let nScn = before.scn * V0 + d.scn;
  // El Ag⁺ agregado (más el que sobraba) precipita de inmediato el SCN⁻ libre.
  const agAvail = before.agExcess + d.ag;
  nScn -= Math.min(agAvail, nScn);
  const immediate = { fe: nFe / V1, scn: nScn / V1, complex: nC / V1 };
  const denom = immediate.fe * immediate.scn;
  const qImmediate = denom > 0 ? immediate.complex / denom : immediate.complex > 0 ? Infinity : NaN;
  return { before, after, immediate, qImmediate, K: after.K, direction: shiftDirection(qImmediate, after.K) };
}

/* ------------------------------------------------------------------ sistema B */

export interface No2State { volumen: number; temperatura: number; }
export const NO2_INITIAL: No2State = { volumen: NO2_SETUP.volumeML, temperatura: NO2_SETUP.temperature };

export interface No2Equilibrium {
  state: No2State;
  K: number; // bar⁻¹
  nNO2: number; nN2O4: number; // mmol
  pNO2: number; pN2O4: number; /** Presión total, incluido el aire. */ pTotal: number; // bar
  cNO2: number; // mol/L
  fractionNO2: number; // fracción molar de NO₂
  Q: number;
  /** Intensidad del color relativa al estado inicial (60 mL, 25 °C) = 100. */
  intensity: number;
  intensityReading: number;
  warnings: string[];
}

/** bar por mmol de gas en la jeringa: R·T / V. */
function barPerMmol(volumeML: number, tempC: number): number {
  return (R_GAS * celsiusToKelvin(tempC)) / (volumeML * 1e-6) * 1e-3 / 1e5;
}

/** Moles de NO₂ (mmol) en equilibrio: 2·Kp·c·y² + y − n₀ = 0 (forma estable). */
function solveNO2Moles(K: number, c: number, n0: number): number {
  return (2 * n0) / (1 + Math.sqrt(1 + 8 * K * c * n0));
}

let refCNO2: number | null = null;
function referenceCNO2(): number {
  if (refCNO2 === null) {
    const c = barPerMmol(NO2_SETUP.volumeML, NO2_SETUP.temperature);
    refCNO2 = solveNO2Moles(KP_NO2_25, c, NO2_SETUP.n0Mmol) / NO2_SETUP.volumeML;
  }
  return refCNO2;
}

export function no2Intensity(cNO2: number): number {
  return (100 * cNO2) / referenceCNO2();
}

export function solveNO2(s: No2State): No2Equilibrium {
  assertInRange('El volumen de la jeringa', s.volumen, ...NO2_LIMITS.volume);
  const K = kpNO2(s.temperatura);
  const c = barPerMmol(s.volumen, s.temperatura);
  const n0 = NO2_SETUP.n0Mmol;
  const y = solveNO2Moles(K, c, n0);
  const x = (n0 - y) / 2;
  const pNO2 = y * c, pN2O4 = x * c;
  const cNO2 = y / s.volumen;
  const intensity = no2Intensity(cNO2);
  const pTotal = pNO2 + pN2O4 + NO2_SETUP.airMmol * c;
  const warnings: string[] = [];
  if (pTotal > 2.5) warnings.push('La presión supera 2,5 bar: el émbolo de una jeringa escolar podría fugar. Trabaja con volúmenes mayores.');
  if (pN2O4 > n2o4VaporPressure(s.temperatura)) warnings.push('La presión parcial del N₂O₄ supera su presión de vapor: en una jeringa real se condensarían gotitas de N₂O₄ líquido. El modelo supone que todo sigue en fase gaseosa.');
  return {
    state: s, K, nNO2: y, nN2O4: x, pNO2, pN2O4, pTotal, cNO2,
    fractionNO2: y / (x + y), Q: pN2O4 / (pNO2 * pNO2),
    intensity, intensityReading: roundToResolution(intensity, INTENSITY_RES), warnings,
  };
}

export interface No2Response {
  before: No2Equilibrium;
  after: No2Equilibrium;
  /** Justo después de cambiar volumen o temperatura, con los moles del estado anterior. */
  immediate: { nNO2: number; nN2O4: number; cNO2: number; intensity: number };
  qImmediate: number;
  K: number;
  direction: Direction;
}

export function no2Response(prev: No2State, next: No2State): No2Response {
  const before = solveNO2(prev);
  const after = solveNO2(next);
  const c1 = barPerMmol(next.volumen, next.temperatura);
  const qImmediate = (before.nN2O4 * c1) / (before.nNO2 * c1) ** 2;
  const cNO2 = before.nNO2 / next.volumen;
  return {
    before, after,
    immediate: { nNO2: before.nNO2, nN2O4: before.nN2O4, cNO2, intensity: no2Intensity(cNO2) },
    qImmediate, K: after.K, direction: shiftDirection(qImmediate, after.K),
  };
}

/** Q del sistema B para unos moles dados (útil en la animación). */
export function no2Q(nNO2: number, nN2O4: number, s: No2State): number {
  const c = barPerMmol(s.volumen, s.temperatura);
  return (nN2O4 * c) / (nNO2 * c) ** 2;
}

/* ------------------------------------------------------------------ ficha técnica */

export const equilibriumModelSpec: ModelSpec = {
  name: 'Equilibrio químico: Fe³⁺/SCN⁻/FeSCN²⁺ en disolución y 2 NO₂ ⇌ N₂O₄ en una jeringa',
  inputs: [
    { symbol: 'sistema', name: 'Sistema en equilibrio', unit: '—', initial: 'Fe³⁺ + SCN⁻ ⇌ FeSCN²⁺' },
    { symbol: 'gotas Fe³⁺', name: 'Gotas de Fe(NO₃)₃ 0,2 mol/L (0,05 mL cada una)', unit: 'gotas', range: FE_LIMITS.drops, initial: 0 },
    { symbol: 'gotas SCN⁻', name: 'Gotas de KSCN 0,2 mol/L', unit: 'gotas', range: FE_LIMITS.drops, initial: 0 },
    { symbol: 'gotas Ag⁺', name: 'Gotas de AgNO₃ 0,02 mol/L (retira SCN⁻ como AgSCN)', unit: 'gotas', range: FE_LIMITS.drops, initial: 0 },
    { symbol: 'agua', name: 'Agua agregada al tubo (en pasos de 2 mL)', unit: 'mL', range: FE_LIMITS.waterML, initial: 0 },
    { symbol: 'T (A)', name: 'Temperatura del baño, sistema A', unit: '°C', range: FE_LIMITS.temperature, initial: 25 },
    { symbol: 'V', name: 'Volumen de la jeringa sellada, sistema B', unit: 'mL', range: NO2_LIMITS.volume, initial: 60 },
    { symbol: 'T (B)', name: 'Temperatura del baño, sistema B', unit: '°C', range: NO2_LIMITS.temperature, initial: 25 },
  ],
  outputs: [
    { symbol: 'Q', name: 'Cociente de reacción justo después de la perturbación', unit: 'L/mol (A) · bar⁻¹ (B)' },
    { symbol: 'K', name: 'Constante de equilibrio a la temperatura del baño', unit: 'L/mol (A) · bar⁻¹ (B)' },
    { symbol: 'A', name: 'Absorbancia a 450 nm (colorímetro, resolución 0,001)', unit: '—' },
    { symbol: 'I', name: 'Intensidad del color marrón relativa (inicial = 100)', unit: '—' },
    { symbol: 'x(NO₂)', name: 'Fracción molar de NO₂ en la jeringa', unit: '—' },
  ],
  equations: [
    'A: Kc = [FeSCN²⁺] / ([Fe³⁺][SCN⁻]) ≈ 1,1 × 10² L/mol a 25 °C (valor de referencia aproximado)',
    'A: con totales a y b, Kc·x² − (Kc(a + b) + 1)·x + Kc·a·b = 0 → x = [FeSCN²⁺] (raíz menor)',
    'A: Ag⁺ + SCN⁻ → AgSCN(s) (se supone precipitación completa)',
    'A: Beer-Lambert: A = ε·b·[FeSCN²⁺], ε ≈ 4,7 × 10³ L·mol⁻¹·cm⁻¹, b = 1 cm',
    'B: Kp = P(N₂O₄) / P(NO₂)² ≈ 6,7 bar⁻¹ a 298 K; Pᵢ = nᵢ·R·T / V',
    'B: con n₀ = n(NO₂) + 2·n(N₂O₄): 2·Kp·(RT/V)·n(NO₂)² + n(NO₂) − n₀ = 0',
    'Van \'t Hoff: K(T) = K(298 K)·exp[−ΔH°/R·(1/T − 1/298,15)]; ΔH°(A) ≈ −6 kJ/mol, ΔH°(B) ≈ −57,2 kJ/mol',
    'Q < K: se desplaza hacia productos; Q > K: hacia reactivos; Q = K: equilibrio',
    'Animación: ξ(t) = ξ_final·(1 − e^(−t/τ)) normalizada, τ = 0,6 s (solo para mostrar el camino)',
  ],
  initialConditions: [
    'A: 10,0 mL con Fe³⁺ y SCN⁻ totales 1,0 × 10⁻³ mol/L a 25 °C → [FeSCN²⁺] = 9,09 × 10⁻⁵ mol/L, A = 0,427.',
    'B: jeringa de 60 mL a 25 °C con 2,0 mmol de NO₂ equivalente y 1,2 mmol de aire → n(NO₂) ≈ 0,52 mmol, n(N₂O₄) ≈ 0,74 mmol, P total ≈ 1,0 bar.',
  ],
  assumptions: [
    'Disoluciones ideales: se usan concentraciones en lugar de actividades y la fuerza iónica no cambia K.',
    'Solo se forma el complejo 1:1 FeSCN²⁺ y solo él absorbe a 450 nm; no se modela la hidrólisis del Fe³⁺.',
    'El AgSCN es tan poco soluble que todo el SCN⁻ que encuentra Ag⁺ precipita.',
    'ΔH° no cambia con la temperatura en el intervalo estudiado (Van \'t Hoff integrado).',
    'Los gases de la jeringa son ideales y permanecen en fase gaseosa; el aire es inerte y la jeringa no fuga.',
    'El estado final se alcanza después de cada perturbación; la animación de la relajación es ilustrativa.',
  ],
  limits: [
    'El valor de Kc del FeSCN²⁺ y su ΔH son aproximados: dependen del medio y la fuerza iónica. Las tendencias son confiables; los valores exactos, no.',
    'La ley de Beer-Lambert pierde linealidad a absorbancias altas; el colorímetro no lee por encima de 3.',
    'A temperaturas bajas y volúmenes pequeños el N₂O₄ puede condensarse (ebullición normal ≈ 21 °C); el simulador lo advierte comparando con su presión de vapor.',
    'La animación no representa la velocidad real de las reacciones.',
  ],
  testCases: [
    'Mezcla inicial: [FeSCN²⁺] = 1/11000 mol/L calculado a mano con la cuadrática; A = 0,427.',
    'Kc se conserva tras cada perturbación a temperatura constante.',
    'Agregar Fe³⁺ o SCN⁻ aumenta [FeSCN²⁺]; Q inmediato (≈ 52,6) < K.',
    'Agregar Ag⁺ disminuye la absorbancia; con exceso de Ag⁺ desaparece el color.',
    'Calentar una reacción exotérmica disminuye K y desplaza hacia reactivos.',
    'Comprimir la jeringa: el color se intensifica al instante, pero el sistema se desplaza hacia N₂O₄.',
    'Diluir: Q se duplica al duplicar el volumen y el sistema se desplaza hacia el lado con más partículas disueltas.',
    'Validación de rangos de todas las entradas.',
  ],
};

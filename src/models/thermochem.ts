import { assertInRange, linearRegression } from './math';
import type { ModelSpec } from './types';

/**
 * Termoquímica en un calorímetro de vaso (grado 10.º): calor de disolución y de neutralización, ley de Hess.
 *
 * 1) Calor absorbido por la solución y el vaso: q = (m·c + C_cal)·ΔT. Calor de la reacción: q_r = −q.
 *    Entalpía molar: ΔH = q_r/n = −(m·c + C_cal)·ΔT/n. Se supone que la solución tiene el calor específico del agua
 *    (c = 4,18 J/(g·°C)) y que 1 mL de solución pesa 1 g.
 * 2) Valores de referencia a 25 °C y dilución infinita:
 *    - Neutralización H⁺(aq) + OH⁻(aq) → H₂O(l): ΔH = ΔfH°(H₂O, l) − ΔfH°(OH⁻, aq) = −285,830 − (−230,015) = −55,815
 *      kJ/mol (CODATA Key Values for Thermodynamics, Cox, Wagman y Medvedev, 1989).
 *    - Disolución (CRC Handbook of Chemistry and Physics, «Enthalpy of solution of electrolytes»): NaOH −44,51; NH₄NO₃
 *      +25,69; CaCl₂ −81,33; NaCl +3,88 kJ/mol. En el vaso la solución no es infinitamente diluida: el valor real
 *      difiere un poco (el modelo usa el de dilución infinita).
 *    - Ley de Hess: NaOH(s) + HCl(aq) → ΔH₃ = ΔH(disolución de NaOH) + ΔH(neutralización) = −100,3 kJ/mol.
 * 3) Curva de temperatura con pérdidas (modelo ILUSTRATIVO): el calor se libera con una rapidez de primer orden
 *    (constante de tiempo τ: lo que tarda en disolverse o mezclarse) y el vaso intercambia calor con el aire según la
 *    ley de enfriamiento de Newton (constante k). Con T(0) = T_aire:
 *      T(t) − T_aire = ΔT_ad·(e^(−kt) − e^(−t/τ))/(1 − kτ),   ΔT_ad = q/(m·c + C_cal).
 *    El máximo medido es menor que ΔT_ad; extrapolar a t = 0 la recta del enfriamiento corrige buena parte de la pérdida.
 * Este archivo no depende de React ni del navegador.
 */

export const C_WATER = 4.18; // J/(g·°C)
export const DH_NEUT = -285.83 + 230.015; // kJ/mol = −55,815 (CODATA Key Values)
export const T_ROOM = 25; // °C
export const DURATION = 300; // s de medición
export const READ_EVERY = 10; // s entre lecturas del termómetro
export const THERMO_RES = 0.1; // °C

export interface Solute { id: string; name: string; formula: string; M: number; dH: number; tau: number; use: string }
/** CRC Handbook (entalpía de disolución a dilución infinita, 25 °C). τ (s) es ilustrativo. */
export const SOLUTES: Solute[] = [
  { id: 'naoh', name: 'Hidróxido de sodio', formula: 'NaOH', M: 39.997, dH: -44.51, tau: 25, use: 'Sus lentejas se calientan al disolverse: se maneja con guantes y gafas.' },
  { id: 'nh4no3', name: 'Nitrato de amonio', formula: 'NH₄NO₃', M: 80.043, dH: 25.69, tau: 20, use: 'Es el de las compresas frías instantáneas: absorbe calor al disolverse.' },
  { id: 'cacl2', name: 'Cloruro de calcio', formula: 'CaCl₂', M: 110.98, dH: -81.33, tau: 20, use: 'Se usa en compresas calientes y para secar: libera calor al disolverse.' },
  { id: 'nacl', name: 'Cloruro de sodio', formula: 'NaCl', M: 58.44, dH: 3.88, tau: 30, use: 'La sal de cocina casi no cambia la temperatura del agua al disolverse.' },
];
export function findSolute(id: string): Solute {
  const s = SOLUTES.find((x) => x.id === id);
  if (!s) throw new RangeError(`Sustancia desconocida: ${id}`);
  return s;
}

/** Vasos (constantes ilustrativas): capacidad calorífica y constante de enfriamiento. */
export const CUPS = [
  { id: 'icopor', name: 'Dos vasos de icopor con tapa', Ccal: 15, k: 0.0005 },
  { id: 'vidrio', name: 'Vaso de vidrio sin tapa', Ccal: 60, k: 0.003 },
];
export const findCup = (id: string) => CUPS.find((c) => c.id === id) ?? CUPS[0];

export const TQ_LIMITS = { water: [50, 200] as [number, number], solute: [0.5, 10] as [number, number], volume: [25, 100] as [number, number], conc: [0.25, 2] as [number, number] };

export interface Experiment { kind: 'disolucion' | 'neutralizacion' | 'hess'; label: string; n: number; mass: number; dHref: number; tau: number; note: string }
/** Disolver `grams` g de soluto en `water` g de agua. */
export function dissolution(soluteId: string, grams: number, water: number): Experiment {
  assertInRange('La masa del soluto', grams, 0.01, 100);
  assertInRange('La masa del agua', water, 10, 1000);
  const s = findSolute(soluteId);
  return { kind: 'disolucion', label: `Disolución de ${s.formula}`, n: grams / s.M, mass: water + grams, dHref: s.dH, tau: s.tau, note: s.use };
}
/** Mezclar `volume` mL de HCl y `volume` mL de NaOH, ambos de concentración `conc` mol/L. */
export function neutralization(conc: number, volume: number, concBase = conc): Experiment {
  assertInRange('La concentración', conc, 0.01, 6);
  assertInRange('El volumen', volume, 1, 1000);
  const n = Math.min(conc, concBase) * volume / 1000;
  return { kind: 'neutralizacion', label: 'HCl(aq) + NaOH(aq)', n, mass: 2 * volume, dHref: DH_NEUT, tau: 3, note: 'Se supone 1 g por mL de solución.' };
}
/** NaOH sólido (`grams` g) en 100 mL de HCl 1,0 M (en exceso): ΔH₃ = ΔH_disolución + ΔH_neutralización. */
export function hessSolidInAcid(grams: number): Experiment {
  const s = findSolute('naoh');
  const n = grams / s.M;
  if (n > 0.1) throw new RangeError('El HCl (0,1 mol) debe quedar en exceso');
  return { kind: 'hess', label: 'NaOH(s) + HCl(aq)', n, mass: 100 + grams, dHref: s.dH + DH_NEUT, tau: s.tau, note: 'Ley de Hess: es la suma de la disolución y la neutralización.' };
}

export interface CalRun {
  exp: Experiment; Ccal: number; k: number; Ctot: number;
  q: number; dTad: number;
  readings: { t: number; T: number }[];
  maxObs: { t: number; T: number };
  extrap: { dT: number; slope: number; intercept: number };
  dHideal: number; dHmax: number; dHextrap: number;
  errMaxPct: number; errExtrapPct: number;
}
/** Temperatura (°C) en el instante t con pérdidas de Newton. */
export function tempAt(dTad: number, tau: number, k: number, t: number, T0 = T_ROOM): number {
  if (t <= 0) return T0;
  const f = Math.abs(1 - k * tau) < 1e-9 ? (t / tau) * Math.exp(-t / tau) : (Math.exp(-k * t) - Math.exp(-t / tau)) / (1 - k * tau);
  return T0 + dTad * f;
}
/** Corre la medición completa con lecturas cada 10 s redondeadas a 0,1 °C. */
export function runCalorimeter(exp: Experiment, cupId: string): CalRun {
  const cup = findCup(cupId);
  const Ctot = exp.mass * C_WATER + cup.Ccal;
  const q = -exp.dHref * 1000 * exp.n; // J que gana la solución
  const dTad = q / Ctot;
  const readings: { t: number; T: number }[] = [];
  for (let t = 0; t <= DURATION; t += READ_EVERY) readings.push({ t, T: Math.round(tempAt(dTad, exp.tau, cup.k, t) / THERMO_RES) * THERMO_RES });
  // Lectura más alejada de la temperatura inicial (la más alta si es exotérmica, la más baja si es endotérmica).
  const maxObs = readings.reduce((m, r) => (Math.abs(r.T - T_ROOM) > Math.abs(m.T - T_ROOM) ? r : m), readings[0]);
  // Recta del enfriamiento (o calentamiento) desde t = 5τ hasta el final, extrapolada a t = 0.
  const tail = readings.filter((r) => r.t >= Math.max(5 * exp.tau, maxObs.t));
  const fit = linearRegression(tail.map((r) => r.t), tail.map((r) => r.T));
  const intercept = fit ? fit.intercept : maxObs.T;
  const dHof = (dT: number) => -(Ctot * dT) / exp.n / 1000;
  const dHmax = dHof(maxObs.T - T_ROOM), dHextrap = dHof(intercept - T_ROOM);
  const err = (x: number) => ((x - exp.dHref) / Math.abs(exp.dHref)) * 100;
  return {
    exp, Ccal: cup.Ccal, k: cup.k, Ctot, q, dTad, readings, maxObs,
    extrap: { dT: intercept - T_ROOM, slope: fit ? fit.slope : 0, intercept },
    dHideal: dHof(dTad), dHmax, dHextrap, errMaxPct: err(dHmax), errExtrapPct: err(dHextrap),
  };
}

export interface TqCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function calConditions(run: CalRun, cupId: string): TqCondition[] {
  const out: TqCondition[] = [];
  if (Math.abs(run.dTad) < 1) out.push({ level: 'advertencia', text: `El cambio de temperatura es muy pequeño (${run.dTad.toFixed(2).replace('.', ',')} °C): con un termómetro de 0,1 °C el error relativo es grande.`, fix: 'Usa más soluto o menos agua para que ΔT sea de varios grados.' });
  if (run.exp.n > 0 && run.exp.kind === 'disolucion' && run.exp.n / (run.exp.mass / 1000) > 3) out.push({ level: 'nota', text: 'La solución queda muy concentrada (más de 3 mol por kg de agua): el calor de disolución real se aleja del valor a dilución infinita que usa el modelo.', fix: 'Usa menos soluto o más agua.' });
  if (cupId === 'vidrio') out.push({ level: 'nota', text: 'El vaso de vidrio sin tapa pierde calor rápido y absorbe más calor él mismo: el máximo medido queda lejos del valor ideal.', fix: 'Usa dos vasos de icopor con tapa, o extrapola la recta del enfriamiento a t = 0.' });
  return out;
}

export const thermochemSpec: ModelSpec = {
  name: 'Calorimetría a presión constante: calor de disolución y de neutralización, ley de Hess y pérdidas de calor',
  inputs: [
    { symbol: 'm_s, m_agua', name: 'Masa del soluto y del agua', unit: 'g', range: [0.5, 200], initial: '2,00 g de NaOH en 100 g' },
    { symbol: 'C, V', name: 'Concentración y volumen del ácido y de la base', unit: 'mol/L, mL', range: [0.25, 100], initial: '1,0 M; 50 mL de cada uno' },
    { symbol: 'vaso', name: 'Icopor con tapa o vidrio sin tapa', unit: '—', initial: 'icopor' },
  ],
  outputs: [
    { symbol: 'T(t)', name: 'Lecturas del termómetro cada 10 s', unit: '°C' },
    { symbol: 'ΔT', name: 'Cambio de temperatura: ideal, máximo medido y extrapolado', unit: '°C' },
    { symbol: 'q, ΔH', name: 'Calor y entalpía molar', unit: 'J, kJ/mol' },
  ],
  equations: [
    'q = (m·c + C_cal)·ΔT;  c = 4,18 J/(g·°C)',
    'ΔH = −q/n  (exotérmico: ΔT > 0 y ΔH < 0; endotérmico: ΔT < 0 y ΔH > 0)',
    'H⁺(aq) + OH⁻(aq) → H₂O(l):  ΔH = −285,830 − (−230,015) = −55,8 kJ/mol',
    'Ley de Hess: ΔH[NaOH(s) + HCl(aq)] = ΔH_disolución(NaOH) + ΔH_neutralización = −100,3 kJ/mol',
    'Pérdidas (ilustrativo): T − T_aire = ΔT_ad·(e^(−kt) − e^(−t/τ))/(1 − kτ)',
  ],
  initialConditions: ['Todo a 25 °C; 2,00 g de NaOH en 100 g de agua en dos vasos de icopor con tapa (C_cal = 15 J/°C, ilustrativo).'],
  assumptions: [
    'La solución tiene el calor específico y la densidad del agua (4,18 J/(g·°C) y 1 g/mL).',
    'Los calores de disolución son los de dilución infinita a 25 °C (CRC); la neutralización, la de H⁺ + OH⁻ con los valores clave de CODATA.',
    'La capacidad calorífica de los vasos, la rapidez de disolución y la constante de enfriamiento son ilustrativas.',
  ],
  limits: [
    'Una solución de 1 mol/L tiene una densidad algo mayor que 1 g/mL y un calor específico algo menor que el del agua: el ΔH medido en un vaso real difiere unos pocos por ciento.',
    'El calor de disolución depende de la concentración final; el modelo usa el de dilución infinita.',
    'La extrapolación lineal del enfriamiento corrige solo una parte de las pérdidas.',
  ],
  testCases: [
    'Sin pérdidas, ΔH calculado = valor de referencia (−44,51; +25,69; −81,33; +3,88; −55,8 y −100,3 kJ/mol).',
    '2,00 g de NaOH en 100 g de agua: n = 0,0500 mol, q = 2226 J, ΔT_ad = 5,04 °C con C_cal = 15 J/°C.',
    '50 mL de HCl 1,0 M + 50 mL de NaOH 1,0 M: ΔT_ad = 6,45 °C; el máximo medido es menor y el valor extrapolado se acerca más al ideal.',
    'Ley de Hess: ΔH(NaOH(s) + HCl) = ΔH(disolución) + ΔH(neutralización).',
  ],
};

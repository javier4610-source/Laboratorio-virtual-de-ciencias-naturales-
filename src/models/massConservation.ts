import { assertInRange, celsiusToKelvin, R_GAS, roundToResolution } from './math';
import type { ModelSpec } from './types';
import { fmt } from '../lib/format';

/**
 * Conservación de la masa (grado 8.º): Lavoisier en el aula.
 * Se pesan reactivos y recipiente antes y después de una reacción química, en un sistema
 * abierto (Erlenmeyer o cápsula sin tapa), cerrado con globo o en un frasco sellado.
 *
 *   Sistema cerrado: m_final = m_inicial (la masa se conserva).
 *   Sistema abierto: m_final = m_inicial − m(gas que sale) + m(gas que entra).
 *   Globo: la masa se conserva, pero el aire desplazado por el globo empuja hacia arriba
 *          (E = ρ_aire·V_globo·g) y la balanza marca ρ_aire·V_globo menos.
 */

export type ReactionId = 'bicarbonato' | 'efervescente' | 'precipitacion' | 'oxidacion';
export type SystemId = 'abierto' | 'globo' | 'sellado';

/** Masas molares (g/mol), IUPAC. */
export const MOLAR_MASS = {
  NaHCO3: 84.007,
  CH3COOH: 60.052,
  CH3COONa: 82.034,
  H2O: 18.015,
  CO2: 44.01,
  C6H8O7: 192.123,
  Na3C6H5O7: 258.069,
  Na2CO3: 105.988,
  CaCl2: 110.98,
  CaCO3: 100.086,
  NaCl: 58.44,
  Fe: 55.845,
  O2: 31.998,
  Fe3O4: 231.533,
} as const;

/** Condiciones del aula: 25 °C y 1 atm. */
export const T_C = 25;
export const P_ATM = 101.325; // kPa
export const G = 9.8; // m/s²
/** Masa molar media del aire seco (g/mol) y fracción molar de O₂. */
export const M_AIR = 28.965;
export const X_O2 = 0.2095;
/** Resolución de la balanza digital del kit (g) y su capacidad. */
export const BALANCE_RES = 0.01;
export const BALANCE_MAX = 600;

/** Volumen molar de un gas ideal a 25 °C y 1 atm, en mL/mol (≈ 24 465 mL/mol). */
export function molarVolumeMl(): number {
  return (R_GAS * celsiusToKelvin(T_C)) / (P_ATM * 1000) * 1e6;
}

/** Densidad del aire seco a 25 °C y 1 atm, en g/mL (≈ 1,184 × 10⁻³ g/mL = 1,184 kg/m³). */
export function airDensity(): number {
  return (P_ATM * 1000 * M_AIR) / (R_GAS * celsiusToKelvin(T_C)) / 1e6;
}

/** Volumen (mL) que ocupan n moles de gas ideal a 25 °C y 1 atm. */
export function gasVolumeMl(moles: number): number {
  assertInRange('La cantidad de gas', moles, 0, 10);
  return moles * molarVolumeMl();
}

/** Empuje del aire sobre un globo de volumen V: fuerza (N) y masa aparente que «pierde» la balanza (g). */
export function balloonBuoyancy(volumeMl: number): { forceN: number; apparentLossG: number } {
  assertInRange('El volumen del globo', volumeMl, 0, 10000);
  const apparentLossG = airDensity() * volumeMl;
  return { forceN: (apparentLossG / 1000) * G, apparentLossG };
}

export interface ReactionDef {
  id: ReactionId;
  name: string;
  equation: string;
  /** Sólido que se agrega (masaReactivo). */
  solid: string;
  solidShort: string;
  /** Líquido del recipiente (volumenAcido); null si no hay líquido. */
  liquid: string | null;
  liquidDensity: number; // g/mL
  liquidColor: string;
  massRange: [number, number]; // g
  volumeRange: [number, number]; // mL
  initialMass: number;
  initialVolume: number;
  /** Intercambio de gas con el entorno en un sistema abierto. */
  gas: 'sale CO₂' | 'ninguno' | 'entra O₂';
  systems: SystemId[];
  products: string;
}

export const REACTIONS: ReactionDef[] = [
  {
    id: 'bicarbonato', name: 'Bicarbonato de sodio + vinagre',
    equation: 'NaHCO₃(s) + CH₃COOH(ac) → CH₃COONa(ac) + H₂O(l) + CO₂(g)',
    solid: 'Bicarbonato de sodio', solidShort: 'NaHCO₃', liquid: 'Vinagre (ácido acético al 5 % m/v)', liquidDensity: 1.006, liquidColor: '#f1e3b0',
    massRange: [0.5, 5], volumeRange: [10, 200], initialMass: 2, initialVolume: 50,
    gas: 'sale CO₂', systems: ['abierto', 'globo', 'sellado'], products: 'acetato de sodio, agua y dióxido de carbono',
  },
  {
    id: 'efervescente', name: 'Pastilla efervescente en agua',
    equation: '3 NaHCO₃(s) + C₆H₈O₇(s) → Na₃C₆H₅O₇(ac) + 3 H₂O(l) + 3 CO₂(g)',
    solid: 'Pastilla efervescente (45 % NaHCO₃, 35 % ácido cítrico)', solidShort: 'pastilla', liquid: 'Agua', liquidDensity: 0.997, liquidColor: '#cfe8f7',
    massRange: [1, 8], volumeRange: [50, 200], initialMass: 4, initialVolume: 100,
    gas: 'sale CO₂', systems: ['abierto', 'globo', 'sellado'], products: 'citrato de sodio, agua y dióxido de carbono',
  },
  {
    id: 'precipitacion', name: 'Cloruro de calcio + carbonato de sodio',
    equation: 'CaCl₂(ac) + Na₂CO₃(s) → CaCO₃(s) + 2 NaCl(ac)',
    solid: 'Carbonato de sodio', solidShort: 'Na₂CO₃', liquid: 'Solución de cloruro de calcio al 10 % m/v', liquidDensity: 1.08, liquidColor: '#e3eef2',
    massRange: [0.5, 5], volumeRange: [10, 200], initialMass: 2, initialVolume: 50,
    gas: 'ninguno', systems: ['abierto', 'globo', 'sellado'], products: 'carbonato de calcio (precipitado blanco) y cloruro de sodio',
  },
  {
    id: 'oxidacion', name: 'Lana de acero que arde en el aire',
    equation: '3 Fe(s) + 2 O₂(g) → Fe₃O₄(s)',
    solid: 'Lana de acero (hierro)', solidShort: 'Fe', liquid: null, liquidDensity: 0, liquidColor: '#000000',
    massRange: [0.2, 3], volumeRange: [0, 0], initialMass: 1, initialVolume: 0,
    gas: 'entra O₂', systems: ['abierto', 'sellado'], products: 'óxido ferroso-férrico (Fe₃O₄, sólido negro)',
  },
];

export function reactionById(id: ReactionId): ReactionDef {
  const r = REACTIONS.find((x) => x.id === id);
  if (!r) throw new RangeError(`Reacción desconocida: ${id}`);
  return r;
}

/** Composición de la pastilla efervescente (fracciones de masa) y concentraciones de los líquidos. */
export const TABLET = { NaHCO3: 0.45, C6H8O7: 0.35 };
export const VINEGAR_ACID = 0.05; // g de ácido acético por mL
export const CACL2_CONC = 0.1; // g de CaCl₂ por mL
/** Volumen del frasco sellado (mL) y del tubito interior que guarda el sólido. */
export const JAR_VOLUME = 500;
export const TUBE_VOLUME = 10;

export interface ContainerDef { id: SystemId; name: string; parts: { name: string; mass: number }[]; }

/** Recipientes y accesorios que también están sobre el plato de la balanza (masas típicas). */
export function containerFor(system: SystemId, reaction: ReactionId): ContainerDef {
  const ox = reaction === 'oxidacion';
  if (system === 'abierto') {
    return ox
      ? { id: system, name: 'Cápsula de porcelana (sistema abierto)', parts: [{ name: 'Cápsula de porcelana', mass: 42.3 }] }
      : { id: system, name: 'Erlenmeyer de 500 mL sin tapa (sistema abierto)', parts: [{ name: 'Erlenmeyer de 500 mL', mass: 165.4 }, { name: 'Papel de pesar', mass: 0.8 }] };
  }
  if (system === 'globo') {
    if (ox) throw new RangeError('La combustión de la lana de acero no se hace en una botella con globo: usa la cápsula o el frasco sellado.');
    return { id: system, name: 'Erlenmeyer de 500 mL con globo (sistema cerrado)', parts: [{ name: 'Erlenmeyer de 500 mL', mass: 165.4 }, { name: 'Globo de látex', mass: 3.1 }] };
  }
  return ox
    ? { id: system, name: 'Frasco de vidrio de 500 mL sellado con electrodos (sistema cerrado)', parts: [{ name: 'Frasco con tapa y electrodos', mass: 252.8 }] }
    : { id: system, name: 'Frasco de vidrio de 500 mL sellado (sistema cerrado)', parts: [{ name: 'Frasco con tapa hermética', mass: 248.6 }, { name: 'Tubito con el sólido', mass: 9.2 }] };
}

export interface LimitingResult {
  /** Nombre del reactivo limitante. */
  limiting: string;
  /** Avance de la reacción ξ (mol): moles de «reacción» según los coeficientes de la ecuación. */
  extent: number;
  excess: string;
  /** Masa del reactivo en exceso que sobra (g). */
  excessLeft: number;
}

/** Reactivo limitante: el que permite el menor avance ξ = n/coeficiente. */
export function limitingReagent(a: { name: string; moles: number; coef: number; molarMass: number }, b: { name: string; moles: number; coef: number; molarMass: number }): LimitingResult {
  const xa = a.moles / a.coef, xb = b.moles / b.coef;
  const [lim, exc] = xa <= xb ? [a, b] : [b, a];
  const extent = Math.min(xa, xb);
  return { limiting: lim.name, extent, excess: exc.name, excessLeft: Math.max(0, (exc.moles - extent * exc.coef) * exc.molarMass) };
}

export interface ConservationInput { reaction: ReactionId; system: SystemId; reactantMass: number; liquidVolume: number; }

export interface ConservationResult {
  reaction: ReactionDef;
  container: ContainerDef;
  limiting: LimitingResult;
  /** Masa de CO₂ producida (g); 0 si la reacción no produce gas. */
  gasProduced: number;
  /** Masa de O₂ que se fija en el óxido (g); 0 si no hay oxidación. */
  oxygenFixed: number;
  /** Masa de gas que sale (−) o entra (+) del sistema (g). */
  exchanged: number;
  /** Masa del producto sólido o principal (g). */
  productMass: number;
  productName: string;
  /** Masas verdaderas de todo lo que está sobre el plato (g). */
  massInitial: number;
  massFinal: number;
  /** Volumen del globo inflado (mL) y lo que deja de marcar la balanza por el empuje del aire (g). */
  balloonVolume: number;
  buoyancyLoss: number;
  buoyancyForce: number; // N
  /** Presión dentro del frasco sellado al final (kPa absolutos); null si no aplica. */
  jarPressure: number | null;
  /** Lecturas de la balanza (resolución 0,01 g). */
  readingInitial: number;
  readingFinal: number;
  difference: number;
  warnings: string[];
}

/** Simula la reacción completa en el sistema elegido. Función pura y determinista. */
export function simulateConservation(input: ConservationInput): ConservationResult {
  const r = reactionById(input.reaction);
  if (!r.systems.includes(input.system)) throw new RangeError(`El sistema «${input.system}» no está disponible para esta reacción.`);
  assertInRange(`La masa de ${r.solid.toLowerCase()}`, input.reactantMass, ...r.massRange);
  const liquidVolume = r.liquid ? input.liquidVolume : 0;
  if (r.liquid) assertInRange(`El volumen de ${r.liquid.toLowerCase()}`, liquidVolume, ...r.volumeRange);
  const container = containerFor(input.system, input.reaction);
  const warnings: string[] = [];
  const m = input.reactantMass;

  let limiting: LimitingResult;
  let gasProduced = 0, oxygenFixed = 0, productMass = 0, productName = '';
  let jarPressure: number | null = null;
  const T = celsiusToKelvin(T_C);

  if (r.id === 'bicarbonato') {
    limiting = limitingReagent(
      { name: 'bicarbonato de sodio', moles: m / MOLAR_MASS.NaHCO3, coef: 1, molarMass: MOLAR_MASS.NaHCO3 },
      { name: 'ácido acético del vinagre', moles: (liquidVolume * VINEGAR_ACID) / MOLAR_MASS.CH3COOH, coef: 1, molarMass: MOLAR_MASS.CH3COOH },
    );
    gasProduced = limiting.extent * MOLAR_MASS.CO2;
    productMass = limiting.extent * MOLAR_MASS.CH3COONa; productName = 'acetato de sodio (disuelto)';
  } else if (r.id === 'efervescente') {
    limiting = limitingReagent(
      { name: 'bicarbonato de la pastilla', moles: (m * TABLET.NaHCO3) / MOLAR_MASS.NaHCO3, coef: 3, molarMass: MOLAR_MASS.NaHCO3 },
      { name: 'ácido cítrico de la pastilla', moles: (m * TABLET.C6H8O7) / MOLAR_MASS.C6H8O7, coef: 1, molarMass: MOLAR_MASS.C6H8O7 },
    );
    gasProduced = 3 * limiting.extent * MOLAR_MASS.CO2;
    productMass = limiting.extent * MOLAR_MASS.Na3C6H5O7; productName = 'citrato de sodio (disuelto)';
  } else if (r.id === 'precipitacion') {
    limiting = limitingReagent(
      { name: 'carbonato de sodio', moles: m / MOLAR_MASS.Na2CO3, coef: 1, molarMass: MOLAR_MASS.Na2CO3 },
      { name: 'cloruro de calcio de la solución', moles: (liquidVolume * CACL2_CONC) / MOLAR_MASS.CaCl2, coef: 1, molarMass: MOLAR_MASS.CaCl2 },
    );
    productMass = limiting.extent * MOLAR_MASS.CaCO3; productName = 'carbonato de calcio (precipitado)';
  } else {
    // Oxidación: en sistema abierto el O₂ del aire es ilimitado; en el frasco sellado solo hay el O₂ de 500 mL de aire.
    const nFe = m / MOLAR_MASS.Fe;
    const nO2 = input.system === 'abierto' ? Infinity : (X_O2 * P_ATM * 1000 * ((JAR_VOLUME - m / 7.87) * 1e-6)) / (R_GAS * T);
    limiting = limitingReagent(
      { name: 'hierro de la lana de acero', moles: nFe, coef: 3, molarMass: MOLAR_MASS.Fe },
      { name: input.system === 'abierto' ? 'oxígeno del aire (ilimitado)' : 'oxígeno del aire del frasco', moles: nO2, coef: 2, molarMass: MOLAR_MASS.O2 },
    );
    if (!Number.isFinite(limiting.excessLeft)) limiting = { ...limiting, excessLeft: 0 };
    oxygenFixed = 2 * limiting.extent * MOLAR_MASS.O2;
    productMass = limiting.extent * MOLAR_MASS.Fe3O4; productName = 'Fe₃O₄ (óxido negro)';
    if (input.system === 'sellado') {
      const headspaceL = (JAR_VOLUME - m / 7.87) / 1000;
      jarPressure = P_ATM - (2 * limiting.extent * R_GAS * T) / headspaceL; // J/L = kPa
      if (limiting.limiting.startsWith('oxígeno')) warnings.push(`El oxígeno del frasco se agota: sobran ${fmt(limiting.excessLeft, 2)} g de hierro sin reaccionar.`);
    }
  }

  const liquidMass = liquidVolume * r.liquidDensity;
  const massInitial = container.parts.reduce((a, p) => a + p.mass, 0) + liquidMass + m;
  const exchanged = input.system === 'abierto' ? oxygenFixed - gasProduced : 0;
  const massFinal = massInitial + exchanged;

  let balloonVolume = 0;
  if (input.system === 'globo') balloonVolume = gasVolumeMl(gasProduced / MOLAR_MASS.CO2);
  const { apparentLossG: buoyancyLoss, forceN: buoyancyForce } = balloonBuoyancy(balloonVolume);

  if (input.system === 'sellado' && r.id !== 'oxidacion') {
    const headspaceL = (JAR_VOLUME - liquidVolume - TUBE_VOLUME) / 1000;
    jarPressure = P_ATM + ((gasProduced / MOLAR_MASS.CO2) * R_GAS * T) / headspaceL; // J/L = kPa
    if (jarPressure > 200) warnings.push('La presión dentro del frasco supera 200 kPa: en un aula real la tapa podría saltar o el vidrio romperse. Usa menos reactivo o un recipiente más grande.');
  }
  if (balloonVolume > 3000) warnings.push('El globo superaría 3 L: un globo escolar podría reventarse.');
  if (r.id === 'oxidacion' && input.system === 'abierto') warnings.push('La lana de acero arde con chispas: usa gafas, pinzas y una superficie que no se queme.');
  if (r.gas === 'sale CO₂' && limiting.excessLeft > 0.005) warnings.push(`Sobra ${limiting.excess}: ${fmtG(limiting.excessLeft)} g no reaccionan.`);
  if (r.id === 'precipitacion' && limiting.excessLeft > 0.005) warnings.push(`Sobra ${limiting.excess}: ${fmtG(limiting.excessLeft)} g no reaccionan.`);

  const readingInitial = roundToResolution(massInitial, BALANCE_RES);
  const readingFinal = roundToResolution(massFinal - buoyancyLoss, BALANCE_RES);
  return {
    reaction: r, container, limiting, gasProduced, oxygenFixed, exchanged, productMass, productName,
    massInitial, massFinal, balloonVolume, buoyancyLoss, buoyancyForce, jarPressure,
    readingInitial, readingFinal, difference: roundToResolution(readingFinal - readingInitial, BALANCE_RES), warnings,
  };
}

const fmtG = (v: number) => fmt(v, 2);

/** Fracción de avance de la reacción en el tiempo (0 a 1): rápida al principio y luego se frena. */
export function extentAt(t: number, duration: number): number {
  if (duration <= 0) return 1;
  const u = Math.max(0, Math.min(1, t / duration));
  return 1 - (1 - u) ** 3;
}

/** Lectura de la balanza cuando ha ocurrido una fracción f de la reacción (resolución 0,01 g). */
export function readingAt(res: ConservationResult, f: number): number {
  const p = Math.max(0, Math.min(1, f));
  return roundToResolution(res.massInitial + p * res.exchanged - p * res.buoyancyLoss, BALANCE_RES);
}

export const conservationModelSpec: ModelSpec = {
  name: 'Conservación de la masa en sistemas abiertos y cerrados (ley de Lavoisier)',
  inputs: [
    { symbol: 'reacción', name: 'Reacción química', unit: '—', initial: 'Bicarbonato de sodio + vinagre' },
    { symbol: 'sistema', name: 'Sistema: abierto, cerrado con globo o frasco sellado', unit: '—', initial: 'Abierto' },
    { symbol: 'm_s', name: 'Masa del sólido que se agrega (bicarbonato, pastilla, carbonato o lana de acero)', unit: 'g', range: [0.2, 8], initial: 2 },
    { symbol: 'V_l', name: 'Volumen del líquido (vinagre, agua o solución de CaCl₂)', unit: 'mL', range: [10, 200], initial: 50 },
  ],
  outputs: [
    { symbol: 'm_i, m_f', name: 'Lecturas de la balanza antes y después', unit: 'g' },
    { symbol: 'Δm', name: 'Diferencia m_f − m_i', unit: 'g' },
    { symbol: 'm(CO₂)', name: 'Masa de CO₂ producida (estequiometría)', unit: 'g' },
    { symbol: 'V_globo', name: 'Volumen del globo inflado', unit: 'mL' },
    { symbol: 'E', name: 'Empuje del aire sobre el globo', unit: 'N' },
    { symbol: 'P', name: 'Presión dentro del frasco sellado', unit: 'kPa' },
  ],
  equations: [
    'Ley de Lavoisier: en un sistema cerrado, Σ m(reactivos) = Σ m(productos).',
    'NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂;  3 NaHCO₃ + C₆H₈O₇ → Na₃C₆H₅O₇ + 3 H₂O + 3 CO₂',
    'CaCl₂ + Na₂CO₃ → CaCO₃↓ + 2 NaCl;  3 Fe + 2 O₂ → Fe₃O₄',
    'Reactivo limitante: el de menor n/coeficiente; ξ = mín(nᵢ/νᵢ).',
    'm(CO₂) = n(CO₂)·44,01 g/mol;  sistema abierto: Δm = m(O₂ fijado) − m(CO₂ liberado).',
    'V_globo = n·R·T/P (25 °C, 1 atm: ≈ 24,47 L/mol);  E = ρ_aire·V_globo·g, ρ_aire = P·M_aire/(R·T) ≈ 1,184 kg/m³.',
    'Lectura con globo = m_total − ρ_aire·V_globo.',
  ],
  initialConditions: [
    'Bicarbonato + vinagre, sistema abierto: 2,00 g de NaHCO₃ y 50 mL de vinagre al 5 % m/v en un Erlenmeyer de 500 mL (165,40 g) con papel de pesar (0,80 g).',
    'Aula a 25 °C y 1 atm (101,325 kPa).',
  ],
  assumptions: [
    'Las reacciones son completas: el reactivo limitante se consume todo.',
    'En el sistema abierto todo el CO₂ escapa (no queda disuelto) y no se evapora agua ni ácido acético.',
    'Vinagre: 5 g de ácido acético por 100 mL, densidad 1,006 g/mL. Solución de CaCl₂: 10 g por 100 mL, densidad 1,08 g/mL.',
    'Pastilla efervescente: 45 % de NaHCO₃ y 35 % de ácido cítrico en masa; el resto son excipientes que no reaccionan.',
    'La lana de acero es hierro puro que arde por completo formando Fe₃O₄; en el frasco sellado solo dispone del O₂ de 500 mL de aire (20,95 %).',
    'El gas del globo está a 25 °C y a la presión atmosférica (se desprecia la sobrepresión elástica del látex).',
    'Balanza digital de 600 g con resolución 0,01 g; las masas de los recipientes son típicas.',
  ],
  limits: [
    'En el aula, parte del CO₂ queda disuelto unos minutos y la reacción del vinagre enfría la mezcla; la pérdida medida suele ser algo menor que la calculada.',
    'La lana de acero real rara vez arde por completo y forma también Fe₂O₃; el aumento de masa medido suele ser menor que el teórico.',
    'No se modela la presión excesiva: si la tapa salta o el globo revienta, el sistema deja de estar cerrado.',
    'No incluye errores aleatorios de lectura ni corrientes de aire sobre la balanza.',
  ],
  testCases: [
    'Sistema cerrado (globo sin contar el empuje, o frasco sellado): la masa total es constante para las cuatro reacciones.',
    'Sistema abierto: la pérdida de masa es la masa de CO₂ calculada por estequiometría.',
    'Precipitación: la masa no cambia ni siquiera en el sistema abierto.',
    'Oxidación en sistema abierto: la masa aumenta en la del O₂ fijado (2/3 de los moles de Fe × 32,00 g/mol).',
    'Empuje del globo = ρ_aire·V·g; volumen del globo por gas ideal.',
    'Reactivo limitante correcto (bicarbonato o vinagre; O₂ del frasco con mucha lana de acero).',
    'Validación de rangos de entrada.',
  ],
};

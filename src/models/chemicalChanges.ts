import { assertInRange, R_GAS } from './math';
import { isaPressure, L_VAP } from './statesOfMatter';
import type { ModelSpec } from './types';

/**
 * Cambios físicos y químicos (grado 7.º): siete procesos de aula con sus evidencias calculadas.
 *
 *  Químicos: vinagre + bicarbonato (gas y enfriamiento), CaCl₂ + Na₂CO₃ (precipitado), lana de acero que se oxida
 *  (color, aumento de masa, consumo de O₂), vela que arde (luz, calor, CO₂ y agua) y azúcar que se carboniza (color negro,
 *  vapor de agua, sustancia nueva). Físicos: azúcar que se disuelve y agua que hierve (burbujas de la MISMA sustancia).
 *
 * Cantidades con la estequiometría de la ecuación balanceada (masas atómicas IUPAC), el gas con la ecuación de los gases
 * ideales a 28 °C y la presión ISA de Apartadó (≈ 30 m), y el CO₂ que queda disuelto con la ley de Henry
 * (H = 3,3 × 10⁻⁴ mol/(m³·Pa) a 25 °C; Sander, 2015). ΔT con entalpías de formación de las tablas del NBS (Wagman y
 * otros, 1982): vinagre + bicarbonato ΔH = +31,1 kJ/mol (endotérmica); CaCO₃ ΔH = +13,1 kJ/mol. Solubilidad de la
 * sacarosa: 200 g/100 mL de agua a 25 °C (ICSC, vía PubChem CID 5988, consulta 2026-11-03). O₂ del aire seco: 20,95 %.
 * Las rapideces (cuánto tarda cada proceso) son ILUSTRATIVAS: se eligieron para que cada uno dure lo que dura en el aula.
 * Este archivo no depende de React ni del navegador.
 */

/** Masas molares (g/mol) con las masas atómicas estándar de la IUPAC (C 12,011; H 1,008; O 15,999; Na 22,990; Ca 40,078; Cl 35,45; Fe 55,845). */
export const MOLAR = {
  NaHCO3: 84.006, CH3COOH: 60.052, CO2: 44.009, CaCl2: 110.978, Na2CO3: 105.986, CaCO3: 100.086, NaCl: 58.44,
  Fe: 55.845, O2: 31.998, Fe2O3: 159.687, C25H52: 352.691, H2O: 18.015, C12H22O11: 342.297, C: 12.011,
} as const;
export const ROOM_T = 28; // °C (Apartadó, como en «Calor»)
export const P_ROOM = isaPressure(30); // Pa
export const HENRY_CO2 = 3.3e-4; // mol/(m³·Pa)
export const O2_FRACTION = 0.2095;
export const VINEGAR_PERCENT = 5; // % m/v de ácido acético (vinagre blanco comercial; valor típico de etiqueta)
export const DH_VINEGAR = 31.1; // kJ/mol (NBS: −486,01 − 240,12 − 285,83 − 393,51 − (−950,81 − 485,76))
export const DH_CACO3 = 13.1; // kJ/mol (NBS: −1206,92 − (−542,83 − 677,14))
export const KSP_CACO3 = 3.36e-9; // calcita, 25 °C (CRC Handbook)
export const SUGAR_SOLUBILITY = 2.0; // g de sacarosa por mL de agua a 25 °C
export const CANDLE_RATE = 0.1; // g/min: vela de parafina de 2 cm de diámetro (valor típico, ilustrativo; se mide pesándola)
export const HOTPLATE_W = 500; // W
const C_SOLUTION = 4.18; // J/(g·°C): la mezcla diluida se toma como agua
export const BALANCE = { resolution: 0.001 }; // g
export const THERMOMETER = { resolution: 0.1 }; // °C
export const SYRINGE = { resolution: 1 }; // mL (globo medido con jeringa / probeta)

export type ChangeId = 'vinagre-bicarbonato' | 'precipitado' | 'oxidacion-hierro' | 'vela' | 'disolver-azucar' | 'quemar-azucar' | 'hervir-agua';
export type IronPrep = 'humeda' | 'vinagre' | 'seca';

export interface AmountSpec { key: 'a' | 'b'; label: string; unit: string; min: number; max: number; step: number; initial: number; decimals: number }
export interface ProcessDef {
  id: ChangeId; name: string; kind: 'fisico' | 'quimico';
  /** Qué hace el estudiante (frase corta). */
  action: string;
  equation: string;
  words: string;
  amounts: AmountSpec[];
  /** Duración de la observación y su unidad. */
  duration: number; timeUnit: 's' | 'min' | 'h';
  why: string;
}

export const PROCESSES: ProcessDef[] = [
  { id: 'vinagre-bicarbonato', name: 'Vinagre + bicarbonato de sodio (globo en la botella)', kind: 'quimico', action: 'Dejar caer el bicarbonato del globo al vinagre de la botella',
    equation: 'NaHCO₃(s) + CH₃COOH(ac) → CH₃COONa(ac) + H₂O(l) + CO₂(g)', words: 'bicarbonato de sodio + ácido acético → acetato de sodio + agua + dióxido de carbono',
    amounts: [{ key: 'a', label: 'Bicarbonato de sodio', unit: 'g', min: 0.5, max: 5, step: 0.1, initial: 2, decimals: 1 }, { key: 'b', label: 'Vinagre (5 % de ácido acético)', unit: 'mL', min: 10, max: 100, step: 5, initial: 50, decimals: 0 }],
    duration: 30, timeUnit: 's', why: 'Aparece un gas que no estaba (CO₂: apaga un fósforo y enturbia el agua de cal) y la mezcla se enfría: los átomos se reorganizaron en sustancias nuevas.' },
  { id: 'precipitado', name: 'Cloruro de calcio + carbonato de sodio', kind: 'quimico', action: 'Verter la solución de carbonato de sodio en la de cloruro de calcio',
    equation: 'CaCl₂(ac) + Na₂CO₃(ac) → CaCO₃(s)↓ + 2 NaCl(ac)', words: 'cloruro de calcio + carbonato de sodio → carbonato de calcio (sólido blanco) + cloruro de sodio',
    amounts: [{ key: 'a', label: 'CaCl₂ 0,10 mol/L', unit: 'mL', min: 5, max: 50, step: 1, initial: 20, decimals: 0 }, { key: 'b', label: 'Na₂CO₃ 0,10 mol/L', unit: 'mL', min: 5, max: 50, step: 1, initial: 10, decimals: 0 }],
    duration: 10, timeUnit: 's', why: 'Dos líquidos transparentes forman un sólido blanco que no estaba (precipitado de CaCO₃): es una sustancia nueva que no se separa filtrando de nuevo en los reactivos.' },
  { id: 'oxidacion-hierro', name: 'Lana de acero que se oxida en una probeta invertida', kind: 'quimico', action: 'Meter la lana de acero en la probeta e invertirla sobre agua',
    equation: '4 Fe(s) + 3 O₂(g) → 2 Fe₂O₃(s)', words: 'hierro + oxígeno → óxido de hierro(III) (herrumbre)',
    amounts: [{ key: 'a', label: 'Lana de acero', unit: 'g', min: 0.5, max: 3, step: 0.1, initial: 1, decimals: 1 }, { key: 'b', label: 'Aire encerrado en la probeta', unit: 'mL', min: 20, max: 100, step: 5, initial: 50, decimals: 0 }],
    duration: 72, timeUnit: 'h', why: 'El hierro gris se vuelve pardo rojizo, la lana gana masa y el agua sube en la probeta porque se consume el oxígeno: se formó óxido de hierro, una sustancia nueva.' },
  { id: 'vela', name: 'Vela de parafina que arde bajo un vaso frío', kind: 'quimico', action: 'Encender la vela y poner encima un vaso frío y luego agua de cal',
    equation: 'C₂₅H₅₂(s) + 38 O₂(g) → 25 CO₂(g) + 26 H₂O(g)', words: 'parafina + oxígeno → dióxido de carbono + agua (la cera derretida es un cambio físico)',
    amounts: [{ key: 'a', label: 'Tiempo encendida', unit: 'min', min: 1, max: 30, step: 1, initial: 10, decimals: 0 }],
    duration: 10, timeUnit: 'min', why: 'Hay luz y calor, el vaso frío se empaña con agua y el agua de cal se enturbia con el CO₂: la parafina se transformó. La cera que se derrite y se vuelve a endurecer es, en cambio, un cambio físico.' },
  { id: 'disolver-azucar', name: 'Azúcar que se disuelve en agua', kind: 'fisico', action: 'Agregar el azúcar al agua y agitar',
    equation: 'C₁₂H₂₂O₁₁(s) → C₁₂H₂₂O₁₁(ac)', words: 'sacarosa sólida → sacarosa disuelta (las moléculas solo se separan)',
    amounts: [{ key: 'a', label: 'Azúcar (sacarosa)', unit: 'g', min: 1, max: 250, step: 1, initial: 10, decimals: 0 }, { key: 'b', label: 'Agua', unit: 'mL', min: 50, max: 200, step: 10, initial: 100, decimals: 0 }],
    duration: 180, timeUnit: 's', why: 'El azúcar «desaparece», pero no hay gas, ni color, ni sólido nuevo, y al evaporar el agua se recupera el mismo azúcar: las moléculas no cambiaron, solo se separaron.' },
  { id: 'quemar-azucar', name: 'Azúcar que se calienta en una cuchara hasta carbonizarse', kind: 'quimico', action: 'Calentar el azúcar en la cuchara sobre el mechero',
    equation: 'C₁₂H₂₂O₁₁(s) → 12 C(s) + 11 H₂O(g)', words: 'sacarosa → carbono (residuo negro) + agua (simplificación: la carbonización forma también otras sustancias)',
    amounts: [{ key: 'a', label: 'Azúcar (sacarosa)', unit: 'g', min: 1, max: 10, step: 0.5, initial: 5, decimals: 1 }],
    duration: 8, timeUnit: 'min', why: 'El azúcar blanco se derrite (físico), luego se vuelve pardo y negro, huele a quemado y suelta vapor de agua; el residuo negro (carbono) ya no es azúcar ni se puede volver azúcar: sustancia nueva.' },
  { id: 'hervir-agua', name: 'Agua que hierve en un vaso sobre la parrilla', kind: 'fisico', action: 'Calentar el agua hasta que hierva y tapar el vaso con un vidrio frío',
    equation: 'H₂O(l) → H₂O(g)', words: 'agua líquida → vapor de agua (la misma sustancia)',
    amounts: [{ key: 'a', label: 'Agua (ya a la temperatura de ebullición)', unit: 'mL', min: 50, max: 250, step: 10, initial: 100, decimals: 0 }],
    duration: 5, timeUnit: 'min', why: 'Hay burbujas de gas, pero el gas es vapor de agua: en el vidrio frío se condensa otra vez en gotas de agua. Una sola evidencia (burbujas) no basta para decir que hubo reacción.' },
];
export function findProcess(id: string): ProcessDef {
  const p = PROCESSES.find((x) => x.id === id);
  if (!p) throw new RangeError(`Proceso desconocido: ${id}`);
  return p;
}

/** Tiempo característico ILUSTRATIVO de cada proceso (en su unidad): el avance es ξ = 1 − e^(−t/τ). */
export const IRON_TAU: Record<IronPrep, number> = { humeda: 15, vinagre: 5, seca: 2000 }; // h
const TAU: Partial<Record<ChangeId, number>> = { 'vinagre-bicarbonato': 4, precipitado: 0.8, 'disolver-azucar': 40, 'quemar-azucar': 2.5 };

export interface ChangeInput { id: ChangeId; a: number; b?: number; t: number; prep?: IronPrep }
export interface Quantity { key: string; label: string; value: number; unit: string; decimals: number }
export interface Evidence {
  gas: string | null; color: string | null; precipitate: string | null; light: boolean;
  /** Cambio de temperatura (°C) observado hasta ahora. */
  dT: number;
  /** Se formó al menos una sustancia nueva (propiedad del proceso: la que el estudiante debe deducir). */
  newSubstance: boolean;
  /** Cómo se comprueba si la sustancia original se recupera. */
  recover: string;
}
export interface ChangeResult {
  process: ProcessDef;
  /** Avance 0–1 al tiempo t. */
  progress: number;
  evidence: Evidence;
  quantities: Quantity[];
  /** Para la balanza y la vista: masa del sistema que se pesa (g), si aplica. */
  limiting?: string;
}

const xi = (t: number, tau: number) => (t <= 0 ? 0 : 1 - Math.exp(-t / tau));
const q = (key: string, label: string, value: number, unit: string, decimals: number): Quantity => ({ key, label, value, unit, decimals });
/** Volumen (mL) de n mol de gas ideal a la temperatura y presión del salón. */
export const gasVolumeML = (n: number) => ((n * R_GAS * (ROOM_T + 273.15)) / P_ROOM) * 1e6;

export function evaluateChange(i: ChangeInput): ChangeResult {
  const p = findProcess(i.id);
  for (const s of p.amounts) assertInRange(s.label, s.key === 'a' ? i.a : (i.b ?? NaN), s.min, s.max);
  assertInRange('El tiempo', i.t, 0, i.id === 'vela' ? i.a : p.duration);
  const t = i.t;
  switch (p.id) {
    case 'vinagre-bicarbonato': {
      const nB = i.a / MOLAR.NaHCO3;
      const nA = ((VINEGAR_PERCENT / 100) * (i.b as number)) / MOLAR.CH3COOH;
      const nMax = Math.min(nB, nA);
      const f = xi(t, TAU[p.id] as number);
      const n = f * nMax;
      const nDisMax = HENRY_CO2 * P_ROOM * ((i.b as number) * 1e-6);
      const nGas = Math.max(0, n - nDisMax);
      const dT = -(n * DH_VINEGAR * 1000) / (((i.b as number) + i.a) * C_SOLUTION);
      return {
        process: p, progress: f, limiting: nB <= nA ? 'el bicarbonato' : 'el ácido acético del vinagre',
        evidence: { gas: 'burbujas de CO₂ que inflan el globo', color: null, precipitate: null, light: false, dT, newSubstance: true, recover: 'Al evaporar el líquido queda acetato de sodio, no bicarbonato: los reactivos no se recuperan.' },
        quantities: [
          q('nCO2', 'CO₂ formado', n * 1000, 'mmol', 2), q('nDis', 'CO₂ que queda disuelto (Henry)', Math.min(n, nDisMax) * 1000, 'mmol', 2),
          q('vGas', 'Volumen de CO₂ en el globo (28 °C)', gasVolumeML(nGas), 'mL', 0), q('mCO2', 'Masa de CO₂ formada', n * MOLAR.CO2, 'g', 3),
          q('dT', 'Cambio de temperatura de la mezcla', dT, '°C', 1),
        ],
      };
    }
    case 'precipitado': {
      const nCa = 0.1 * ((i.a) / 1000), nCO3 = 0.1 * ((i.b as number) / 1000);
      const f = xi(t, TAU[p.id] as number);
      const n = f * Math.min(nCa, nCO3);
      const vol = i.a + (i.b as number);
      const dT = -(n * DH_CACO3 * 1000) / (vol * C_SOLUTION);
      return {
        process: p, progress: f, limiting: nCO3 <= nCa ? 'el carbonato de sodio' : 'el cloruro de calcio',
        evidence: { gas: null, color: 'el líquido transparente se vuelve blanco lechoso', precipitate: 'sólido blanco de CaCO₃ que se asienta en el fondo', light: false, dT, newSubstance: true, recover: 'Al filtrar queda un sólido blanco que no se disuelve en agua (CaCO₃): no es ninguno de los reactivos, que sí se disuelven.' },
        quantities: [q('mCaCO3', 'Masa de CaCO₃ (precipitado seco)', n * MOLAR.CaCO3, 'g', 3), q('nCaCO3', 'CaCO₃ formado', n * 1000, 'mmol', 2), q('dT', 'Cambio de temperatura de la mezcla', dT, '°C', 2)],
      };
    }
    case 'oxidacion-hierro': {
      const prep = i.prep ?? 'humeda';
      const nO2 = (O2_FRACTION * P_ROOM * ((i.b as number) * 1e-6)) / (R_GAS * (ROOM_T + 273.15));
      const nFe = i.a / MOLAR.Fe;
      const nO2max = Math.min(nO2, (3 / 4) * nFe);
      const f = xi(t, IRON_TAU[prep]);
      const used = f * nO2max;
      const rise = (used / nO2) * O2_FRACTION * (i.b as number);
      return {
        process: p, progress: f, limiting: nO2 <= (3 / 4) * nFe ? 'el oxígeno del aire' : 'el hierro',
        evidence: { gas: null, color: f > 0.05 ? 'el gris del hierro se vuelve pardo rojizo' : null, precipitate: null, light: false, dT: 0, newSubstance: true, recover: 'La herrumbre es un polvo pardo que no conduce la electricidad ni brilla como el hierro: es otra sustancia.' },
        quantities: [
          q('subida', 'Subida del agua en la probeta', rise, 'mL', 1), q('dm', 'Aumento de masa de la lana (oxígeno ganado)', used * MOLAR.O2, 'g', 3),
          q('feUsado', 'Hierro que se oxidó', (4 / 3) * used * MOLAR.Fe, 'g', 3), q('o2', 'Oxígeno consumido del aire encerrado', nO2 > 0 ? (used / nO2) * 100 : 0, '%', 1),
        ],
      };
    }
    case 'vela': {
      const burned = CANDLE_RATE * t; // g de parafina
      const n = burned / MOLAR.C25H52;
      return {
        process: p, progress: i.a > 0 ? t / i.a : 0,
        evidence: { gas: 'CO₂ y vapor de agua (invisibles): el agua de cal se enturbia', color: 'el agua de cal transparente se vuelve lechosa (se forma CaCO₃)', precipitate: 'CaCO₃ en el agua de cal', light: t > 0, dT: 0, newSubstance: true, recover: 'La parafina que se quemó no se recupera; la que solo se derritió se endurece otra vez (cambio físico).' },
        quantities: [
          q('mParafina', 'Parafina quemada (balanza)', burned, 'g', 3), q('mCO2', 'CO₂ producido', 25 * n * MOLAR.CO2, 'g', 3),
          q('vCO2', 'Volumen de CO₂ (28 °C)', gasVolumeML(25 * n), 'mL', 0), q('mH2O', 'Agua producida', 26 * n * MOLAR.H2O, 'g', 3), q('mO2', 'Oxígeno consumido', 38 * n * MOLAR.O2, 'g', 3),
        ],
      };
    }
    case 'disolver-azucar': {
      const max = SUGAR_SOLUBILITY * (i.b as number);
      const f = xi(t, TAU[p.id] as number);
      const dissolved = f * Math.min(i.a, max);
      return {
        process: p, progress: f,
        evidence: { gas: null, color: null, precipitate: i.a > max ? 'queda azúcar sin disolver en el fondo (solución saturada)' : null, light: false, dT: 0, newSubstance: false, recover: 'Al evaporar el agua se recupera la misma masa de azúcar: la sustancia no cambió.' },
        quantities: [
          q('disuelta', 'Azúcar disuelta', dissolved, 'g', 1), q('sinDisolver', 'Azúcar sin disolver', i.a - dissolved, 'g', 1),
          q('conc', 'Concentración', (dissolved / (i.b as number)) * 100, 'g/100 mL', 1), q('recuperable', 'Azúcar que se recupera al evaporar', i.a, 'g', 1),
        ],
      };
    }
    case 'quemar-azucar': {
      const f = xi(t, TAU[p.id] as number);
      const n = (f * i.a) / MOLAR.C12H22O11;
      const water = 11 * n * MOLAR.H2O;
      return {
        process: p, progress: f,
        evidence: { gas: 'vapor de agua y humo con olor a quemado', color: f < 0.15 ? 'el azúcar se derrite y queda transparente' : f < 0.6 ? 'pasa de dorado a pardo (caramelo)' : 'queda un residuo negro (carbón)', precipitate: null, light: false, dT: 0, newSubstance: f >= 0.15, recover: 'El residuo negro no se disuelve ni sabe dulce: no se puede volver a obtener azúcar.' },
        quantities: [q('residuo', 'Masa que queda en la cuchara', i.a - water, 'g', 3), q('agua', 'Agua que salió como vapor', water, 'g', 3), q('carbono', 'Carbono formado', 12 * n * MOLAR.C, 'g', 3)],
      };
    }
    default: { // hervir-agua
      const tS = t * 60;
      const evap = Math.min(i.a, (HOTPLATE_W * tS) / L_VAP); // 1 mL ≈ 1 g
      return {
        process: p, progress: evap / i.a,
        evidence: { gas: 'burbujas de vapor de agua', color: null, precipitate: null, light: false, dT: 0, newSubstance: false, recover: 'El vapor se condensa en el vidrio frío como gotas de agua: es la misma sustancia.' },
        quantities: [q('evaporada', 'Agua que pasó a vapor', evap, 'g', 1), q('queda', 'Agua que queda en el vaso', i.a - evap, 'g', 1), q('vapor', 'Volumen de ese vapor a 100 °C y 1 atm', ((evap / MOLAR.H2O) * R_GAS * 373.15) / 101325 * 1000, 'L', 1)],
      };
    }
  }
}

export interface ChangeCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function changeConditions(i: Omit<ChangeInput, 't'>): ChangeCondition[] {
  const out: ChangeCondition[] = [];
  const end = evaluateChange({ ...i, t: i.id === 'vela' ? i.a : findProcess(i.id).duration });
  if (i.id === 'vinagre-bicarbonato') {
    const v = end.quantities.find((x) => x.key === 'vGas')!.value;
    if (v > 1000) out.push({ level: 'advertencia', text: `Se formarían ${Math.round(v)} mL de CO₂: más de un litro; un globo pequeño se revienta o sale disparado de la botella.`, fix: 'Usa menos bicarbonato (2 g dan ≈ 0,5 L) o un globo más grande.' });
    if (end.limiting === 'el ácido acético del vinagre') out.push({ level: 'nota', text: 'Sobra bicarbonato: queda polvo blanco en el fondo porque se acabó el ácido acético del vinagre (reactivo límite).', fix: 'Agrega más vinagre si quieres que reaccione todo el bicarbonato.' });
  }
  if (i.id === 'oxidacion-hierro' && i.prep === 'seca') out.push({ level: 'advertencia', text: 'La lana de acero seca casi no se oxida en tres días: la herrumbre necesita agua además de oxígeno.', fix: 'Humedece la lana de acero (o lávala con vinagre para quitarle el aceite protector) antes de meterla en la probeta.' });
  if (i.id === 'disolver-azucar' && i.a > SUGAR_SOLUBILITY * (i.b as number)) out.push({ level: 'nota', text: `En ${i.b} mL de agua a 25 °C solo se disuelven ${Math.round(SUGAR_SOLUBILITY * (i.b as number))} g de azúcar: la solución está saturada y el resto queda en el fondo.`, fix: 'Agrega más agua o calienta (la solubilidad del azúcar aumenta con la temperatura).' });
  if (i.id === 'quemar-azucar' || i.id === 'vela') out.push({ level: 'nota', text: 'En el laboratorio real: cabello recogido, gafas, pinza de madera para la cuchara y lejos de papeles; el azúcar fundido quema la piel.', fix: 'Trabaja con el docente presente y ten a mano un recipiente con agua.' });
  return out;
}

/** Clasificación del estudiante frente a la del modelo, con la razón. */
export function checkClassification(id: ChangeId, answer: 'fisico' | 'quimico'): { correct: boolean; text: string } {
  const p = findProcess(id);
  return { correct: p.kind === answer, text: p.why };
}

export const chemicalChangesSpec: ModelSpec = {
  name: 'Cambios físicos y químicos: evidencias calculadas con estequiometría, gases ideales, Henry y entalpías de formación',
  inputs: [
    { symbol: 'proceso', name: 'Proceso de aula (7: cinco químicos y dos físicos)', unit: '—', initial: 'vinagre + bicarbonato' },
    { symbol: 'cantidades', name: 'Masa o volumen de cada reactivo (según el proceso)', unit: 'g o mL', initial: '2,0 g y 50 mL' },
    { symbol: 't', name: 'Tiempo de observación', unit: 's, min o h', initial: 0 },
  ],
  outputs: [
    { symbol: 'evidencias', name: 'Gas, cambio de color, precipitado, luz, cambio de temperatura y si se recupera la sustancia', unit: '—' },
    { symbol: 'V_gas', name: 'Volumen de gas (globo) a 28 °C', unit: 'mL' },
    { symbol: 'm', name: 'Masa de precipitado, de residuo o ganada', unit: 'g' },
    { symbol: 'ΔT', name: 'Cambio de temperatura', unit: '°C' },
  ],
  equations: [
    'n = m/M;   reactivo límite = el de menor n/coeficiente;   ξ(t) = 1 − e^(−t/τ) (rapidez ilustrativa)',
    'V = n·R·T/p con T = 301,15 K y p = 1009,7 hPa (Apartadó);   CO₂ disuelto = H·p·V_líquido (Henry)',
    'ΔT = −n·ΔH/(m·c);   vinagre + bicarbonato ΔH = +31,1 kJ/mol;   CaCO₃ ΔH = +13,1 kJ/mol (NBS)',
    'Subida del agua en la probeta = 0,2095 × V_aire × (O₂ consumido/O₂ inicial)',
  ],
  initialConditions: ['Vinagre blanco al 5 % m/v (50 mL) y 2,0 g de bicarbonato; salón a 28 °C en Apartadó.'],
  assumptions: [
    'La mezcla se comporta como agua (c = 4,18 J/(g·°C), 1 g/mL) y no intercambia calor con el ambiente durante la reacción.',
    'El CO₂ del globo está a la presión del salón; el que se disuelve sigue la ley de Henry con CO₂ puro.',
    'La parafina se representa como C₂₅H₅₂ y arde por completo; la carbonización del azúcar se simplifica a C₁₂H₂₂O₁₁ → 12 C + 11 H₂O.',
    'La rapidez de cada proceso (τ) es ilustrativa: se escogió para que dure lo que dura en el aula; no es una constante cinética medida.',
  ],
  limits: [
    'La herrumbre real es óxido de hierro hidratado (Fe₂O₃·xH₂O); el aumento de masa calculado es solo el del oxígeno.',
    'Una vela real produce también hollín y CO; el azúcar quemado forma muchas sustancias (caramelo) antes del carbón.',
    'La solubilidad del azúcar cambia con la temperatura; el modelo usa la de 25 °C.',
  ],
  testCases: [
    '2,0 g de NaHCO₃ y 50 mL de vinagre al 5 %: reactivo límite el bicarbonato; 23,81 mmol de CO₂ (1,048 g), 1,67 mmol disueltos y ≈ 549 mL en el globo; ΔT ≈ −3,4 °C.',
    '20 mL de CaCl₂ 0,10 M + 10 mL de Na₂CO₃ 0,10 M: 1,00 mmol = 0,100 g de CaCO₃.',
    'Lana de acero húmeda en 50 mL de aire: al terminar el agua sube 10,5 mL (20,95 %) y la lana gana 0,0135 g.',
    'Hervir: con 500 W se evaporan 500/2256 = 0,222 g/s (66,5 g en 5 min).',
  ],
};

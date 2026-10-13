import { assertInRange, celsiusToKelvin, R_GAS, roundToResolution } from './math';
import { findEnzyme, temperatureFactor } from './enzyme';
import type { ModelSpec } from './types';

/**
 * Factores que afectan la velocidad de reacción (grado 10.º).
 *
 * A) Mármol + ácido clorhídrico:  CaCO₃(s) + 2 HCl(aq) → CaCl₂(aq) + H₂O(l) + CO₂(g)
 *    dn/dt = −k(T)·F·n₀·f^(2/3)·[HCl]       (f = n/n₀, fracción de sólido restante)
 *    [HCl] = c₀ − 2·(n₀ − n)/V_ácido          (el ácido se consume, 2 mol por mol de CaCO₃)
 *    f^(2/3): el área de partículas que se encogen es proporcional a su volumen^(2/3).
 *
 * B) Descomposición del agua oxigenada:  2 H₂O₂(aq) → 2 H₂O(l) + O₂(g)
 *    d[H₂O₂]/dt = −k_cat(T)·[H₂O₂]  (primer orden)  →  V(t) = V_total·(1 − e^(−k·t))
 *
 * k(T) = k₂₅·exp[−Eₐ/R·(1/T − 1/298,15 K)]. El gas se recoge en una jeringa de 100 mL
 * y se lee a la temperatura del laboratorio (25 °C) y 101,3 kPa.
 */

export type Reaction = 'marmol' | 'peroxido';
export type Particle = 'trozos' | 'granulado' | 'polvo';
export type Catalyst = 'ninguno' | 'mno2' | 'catalasa';

export const KINETICS_LIMITS = {
  hcl: [0.5, 2] as [number, number], // mol/L
  h2o2: [1, 5] as [number, number], // % m/v
  tempMarmol: [10, 50] as [number, number], // °C
  tempPeroxido: [10, 60] as [number, number], // °C
  duration: [30, 3600] as [number, number], // s simulados
};

/** Datos del montaje. */
export const SETUP = {
  massCaCO3: 0.4, // g
  molarMassCaCO3: 100.09, // g/mol
  acidVolume: 0.05, // L (50 mL)
  peroxideVolume: 5, // mL
  peroxideDensity: 1.0, // g/mL (disolución diluida)
  molarMassH2O2: 34.01, // g/mol
  gasTemperature: 25, // °C: el gas se enfría a la temperatura del laboratorio antes de leerlo
  pressure: 101.3, // kPa
  syringeMax: 100, // mL
};

export const SYRINGE_RES = 1; // mL
export const STOPWATCH_RES = 1; // s (lectura del cronómetro al ojo)
export const DURATION = 180; // s
export const TARGET_VOLUME = 20; // mL para medir t₂₀
export const T_REF_C = 25;

export const PARTICLES: { id: Particle; name: string; areaFactor: number }[] = [
  { id: 'trozos', name: 'Trozos', areaFactor: 1 },
  { id: 'granulado', name: 'Granulado', areaFactor: 3 },
  { id: 'polvo', name: 'Polvo', areaFactor: 12 },
];

/** Constante de velocidad del mármol a 25 °C (fracción de sólido por s, por mol/L de HCl y por unidad de área relativa). Ilustrativa. */
export const K_MARBLE_25 = 1.5e-3; // s⁻¹·(mol/L)⁻¹
/** Energía de activación ilustrativa del ataque del ácido al mármol (≈ se duplica la velocidad cada 10 °C). */
export const EA_MARBLE = 45000; // J/mol

export interface CatalystInfo { id: Catalyst; name: string; k25: number; ea: number; enzyme: boolean; }
/** Constantes de primer orden a 25 °C y energías de activación ilustrativas (orden de magnitud de textos de química general). */
export const CATALYSTS: CatalystInfo[] = [
  { id: 'ninguno', name: 'Ninguno', k25: 2e-6, ea: 75000, enzyme: false },
  { id: 'mno2', name: 'Dióxido de manganeso (MnO₂)', k25: 0.025, ea: 58000, enzyme: false },
  // La catalasa reutiliza los parámetros térmicos (Eₐ y desnaturalización) del modelo de enzimas.
  { id: 'catalasa', name: 'Catalasa de papa', k25: 0.015, ea: findEnzyme('catalasa').ea, enzyme: true },
];

export function findParticle(id: Particle) {
  const p = PARTICLES.find((x) => x.id === id);
  if (!p) throw new Error(`Tamaño de partícula desconocido: ${id}`);
  return p;
}

export function findCatalyst(id: Catalyst): CatalystInfo {
  const c = CATALYSTS.find((x) => x.id === id);
  if (!c) throw new Error(`Catalizador desconocido: ${id}`);
  return c;
}

/** Factor de Arrhenius relativo a 25 °C. */
export function arrheniusFactor(ea: number, tempC: number): number {
  return Math.exp((-ea / R_GAS) * (1 / celsiusToKelvin(tempC) - 1 / celsiusToKelvin(T_REF_C)));
}

/** Volumen molar de un gas ideal, mL/mol. */
export function molarVolume(tempC: number, pressureKPa = SETUP.pressure): number {
  return ((R_GAS * celsiusToKelvin(tempC)) / (pressureKPa * 1000)) * 1e6;
}

export function marbleRateConstant(tempC: number, ea = EA_MARBLE): number {
  return K_MARBLE_25 * arrheniusFactor(ea, tempC);
}

/** Constante de primer orden de la descomposición del H₂O₂ con un catalizador (s⁻¹). */
export function peroxideRateConstant(catalyst: Catalyst, tempC: number): number {
  const c = findCatalyst(catalyst);
  if (c.enzyme) return c.k25 * temperatureFactor(findEnzyme('catalasa'), tempC);
  return c.k25 * arrheniusFactor(c.ea, tempC);
}

export const molesCaCO3 = () => SETUP.massCaCO3 / SETUP.molarMassCaCO3;
export const molesH2O2 = (percent: number) => (SETUP.peroxideVolume * SETUP.peroxideDensity * (percent / 100)) / SETUP.molarMassH2O2;

export interface KineticsInput {
  reaction: Reaction;
  /** HCl en mol/L (mármol) o H₂O₂ en % (agua oxigenada). */
  concentration: number;
  temperature: number; // °C
  particle?: Particle;
  catalyst?: Catalyst;
  /** Tiempo simulado en s (180 s por defecto). */
  duration?: number;
  /** Energía de activación del mármol (J/mol); por defecto EA_MARBLE. Parámetro editable del modo avanzado. */
  eaMarble?: number;
}

export interface KineticsResult {
  reaction: Reaction;
  duration: number;
  /** Volumen (mL) cada segundo, sin redondear (para la animación). */
  series: { t: number; v: number }[];
  /** Lecturas de la jeringa cada 10 s. */
  readings: { t: number; v: number }[];
  totalVolume: number; // mL si reacciona todo el reactivo limitante
  totalReading: number;
  v30: number; v30Reading: number;
  vFinal: number; vFinalReading: number;
  /** Velocidad promedio en los primeros 30 s a partir de la lectura de la jeringa (mL/s). */
  initialRate: number;
  /** Velocidad instantánea del modelo en t = 0 (mL/s). */
  instantRate: number;
  t20: number | null; // s, lectura del cronómetro
  rateConstant: number;
  areaFactor: number | null;
  catalystName: string | null;
  fractionReacted: number;
  limiting: string;
  warnings: string[];
}

/** Volumen interpolado linealmente en la serie (para la animación). */
export function volumeAt(series: { t: number; v: number }[], t: number): number {
  if (series.length === 0) return 0;
  if (t <= series[0].t) return series[0].v;
  const last = series[series.length - 1];
  if (t >= last.t) return last.v;
  const i = Math.min(series.length - 2, Math.max(0, Math.floor(t - series[0].t)));
  const a = series[i], b = series[i + 1];
  return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t || 1);
}

export function simulateKinetics(input: KineticsInput): KineticsResult {
  const duration = input.duration ?? DURATION;
  assertInRange('La duración', duration, ...KINETICS_LIMITS.duration);
  const Vm = molarVolume(SETUP.gasTemperature);
  const warnings: string[] = [];
  const fine: { t: number; v: number }[] = [];
  let totalVolume: number, rateConstant: number, instantRate: number, limiting: string;
  let areaFactor: number | null = null, catalystName: string | null = null;
  let volumeExact: (t: number) => number;

  if (input.reaction === 'marmol') {
    assertInRange('La concentración de HCl', input.concentration, ...KINETICS_LIMITS.hcl);
    assertInRange('La temperatura', input.temperature, ...KINETICS_LIMITS.tempMarmol);
    const p = findParticle(input.particle ?? 'granulado');
    areaFactor = p.areaFactor;
    const n0 = molesCaCO3();
    const acid0 = input.concentration * SETUP.acidVolume;
    limiting = acid0 >= 2 * n0 ? 'CaCO₃ (el HCl está en exceso)' : 'HCl';
    totalVolume = Math.min(n0, acid0 / 2) * Vm;
    rateConstant = marbleRateConstant(input.temperature, input.eaMarble);
    const k = rateConstant;
    // df/dt con f = fracción de CaCO₃ restante
    const dfdt = (f: number) => {
      const ff = Math.max(0, f);
      const acid = Math.max(0, input.concentration - (2 * n0 * (1 - ff)) / SETUP.acidVolume);
      return -k * p.areaFactor * ff ** (2 / 3) * acid;
    };
    instantRate = -dfdt(1) * n0 * Vm;
    const dt = 0.05;
    const steps = Math.round(duration / dt);
    let f = 1;
    const vols: number[] = [0];
    for (let i = 1; i <= steps; i++) {
      const k1 = dfdt(f), k2 = dfdt(f + (dt * k1) / 2), k3 = dfdt(f + (dt * k2) / 2), k4 = dfdt(f + dt * k3);
      f = Math.max(0, f + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
      vols.push((1 - f) * n0 * Vm);
    }
    volumeExact = (t: number) => {
      const x = Math.min(steps, Math.max(0, t / dt));
      const i = Math.min(steps - 1, Math.floor(x));
      return vols[i] + (vols[i + 1] - vols[i]) * (x - i);
    };
    for (let s = 0; s <= duration; s++) fine.push({ t: s, v: volumeExact(s) });
  } else {
    assertInRange('La concentración de H₂O₂', input.concentration, ...KINETICS_LIMITS.h2o2);
    assertInRange('La temperatura', input.temperature, ...KINETICS_LIMITS.tempPeroxido);
    const c = findCatalyst(input.catalyst ?? 'mno2');
    catalystName = c.name;
    limiting = 'H₂O₂ (único reactivo)';
    totalVolume = (molesH2O2(input.concentration) / 2) * Vm;
    rateConstant = peroxideRateConstant(c.id, input.temperature);
    const k = rateConstant;
    instantRate = k * totalVolume;
    volumeExact = (t: number) => totalVolume * (1 - Math.exp(-k * Math.max(0, t)));
    for (let s = 0; s <= duration; s++) fine.push({ t: s, v: volumeExact(s) });
    if (c.id === 'ninguno') warnings.push('Sin catalizador el agua oxigenada se descompone tan despacio que casi no se recoge gas en 3 minutos.');
    if (c.enzyme && input.temperature > findEnzyme('catalasa').tm) warnings.push(`A ${input.temperature} °C la catalasa de la papa se desnaturaliza y pierde gran parte de su actividad.`);
  }

  // t₂₀: primer instante en que el volumen alcanza 20 mL (búsqueda en pasos de 0,05 s)
  let t20: number | null = null;
  if (volumeExact(duration) >= TARGET_VOLUME) {
    let lo = 0, hi = duration;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (volumeExact(mid) >= TARGET_VOLUME) hi = mid; else lo = mid; }
    t20 = roundToResolution(hi, STOPWATCH_RES);
  }
  const v30 = volumeExact(Math.min(30, duration));
  const vFinal = volumeExact(duration);
  const v30Reading = roundToResolution(v30, SYRINGE_RES);
  const readings: { t: number; v: number }[] = [];
  for (let s = 0; s <= duration; s += 10) readings.push({ t: s, v: roundToResolution(volumeExact(s), SYRINGE_RES) });
  if (input.reaction === 'marmol' && v30 > 0.9 * totalVolume) warnings.push('La reacción casi termina antes de 30 s: el promedio de 0 a 30 s subestima la velocidad inicial real.');
  if (input.reaction === 'peroxido' && totalVolume < TARGET_VOLUME) warnings.push(`Con ${input.concentration} % de H₂O₂ solo se pueden producir unos ${Math.round(totalVolume)} mL de O₂: nunca se llega a 20 mL.`);
  return {
    reaction: input.reaction, duration, series: fine, readings,
    totalVolume, totalReading: roundToResolution(totalVolume, SYRINGE_RES),
    v30, v30Reading, vFinal, vFinalReading: roundToResolution(vFinal, SYRINGE_RES),
    initialRate: roundToResolution(v30Reading / Math.min(30, duration), 0.01),
    instantRate, t20, rateConstant, areaFactor, catalystName,
    fractionReacted: totalVolume > 0 ? vFinal / totalVolume : 0,
    limiting, warnings,
  };
}

export const kineticsModelSpec: ModelSpec = {
  name: 'Velocidad de reacción: mármol con HCl y descomposición catalizada del H₂O₂',
  inputs: [
    { symbol: 'reacción', name: 'Reacción estudiada', unit: '—', initial: 'Mármol + HCl' },
    { symbol: '[HCl]₀', name: 'Concentración del ácido clorhídrico (reacción A)', unit: 'mol/L', range: KINETICS_LIMITS.hcl, initial: 1 },
    { symbol: '%H₂O₂', name: 'Concentración del agua oxigenada (reacción B)', unit: '%', range: KINETICS_LIMITS.h2o2, initial: 3 },
    { symbol: 'T', name: 'Temperatura del baño (A: 10–50 °C; B: 10–60 °C)', unit: '°C', range: [10, 60], initial: 25 },
    { symbol: 'F', name: 'Factor de área por tamaño de partícula (trozos 1, granulado 3, polvo 12)', unit: '×', initial: 3 },
    { symbol: 'cat', name: 'Catalizador (ninguno, MnO₂, catalasa de papa)', unit: '—', initial: 'MnO₂' },
  ],
  outputs: [
    { symbol: 'V(t)', name: 'Volumen de gas recogido en la jeringa', unit: 'mL' },
    { symbol: 'V₃₀, V₁₈₀', name: 'Volumen a 30 s y a 180 s', unit: 'mL' },
    { symbol: 'v₀', name: 'Velocidad inicial (V₃₀/30 s)', unit: 'mL/s' },
    { symbol: 't₂₀', name: 'Tiempo para recoger 20 mL', unit: 's' },
  ],
  equations: [
    'A: CaCO₃ + 2 HCl → CaCl₂ + H₂O + CO₂;  dn/dt = −k(T)·F·n₀·(n/n₀)^(2/3)·[HCl]',
    '[HCl] = [HCl]₀ − 2·(n₀ − n)/0,050 L;  V(CO₂) = (n₀ − n)·V_m',
    'B: 2 H₂O₂ → 2 H₂O + O₂;  d[H₂O₂]/dt = −k_cat(T)·[H₂O₂]  →  V(t) = V_total·(1 − e^(−k·t))',
    'k(T) = k₂₅·exp[−Eₐ/R·(1/T − 1/298,15 K)]  (catalasa: además, fracción nativa 1/(1 + e^((T − 50 °C)/3 °C)))',
    'V_m = R·T/P = 24,47 L/mol a 25 °C y 101,3 kPa',
  ],
  initialConditions: [
    'A: 0,40 g de CaCO₃ (4,0 × 10⁻³ mol) y 50 mL de HCl 1,0 mol/L a 25 °C, granulado; CO₂ máximo ≈ 98 mL.',
    'B: 5 mL de H₂O₂ al 3 % (4,4 × 10⁻³ mol) con MnO₂ a 25 °C; O₂ máximo ≈ 54 mL.',
    'Medición durante 180 s con jeringa de 100 mL (1 mL) y cronómetro (1 s).',
  ],
  assumptions: [
    'El HCl está en exceso en todo el rango (necesita 8,0 × 10⁻³ mol y hay al menos 2,5 × 10⁻² mol): el CaCO₃ es el reactivo limitante.',
    'Las partículas de mármol se encogen sin romperse: su área es proporcional a (fracción restante)^(2/3) y al factor de área.',
    'Energías de activación ilustrativas: mármol 45 kJ/mol (la velocidad casi se duplica cada 10 °C), sin catalizador 75 kJ/mol, MnO₂ 58 kJ/mol, catalasa 30 kJ/mol con desnaturalización por encima de ≈ 50 °C (parámetros del modelo de enzimas).',
    'La descomposición del H₂O₂ es de primer orden; la catalasa se trata como primer orden porque el H₂O₂ está diluido.',
    'El gas se enfría hasta la temperatura del laboratorio (25 °C) en la manguera y la jeringa antes de leerlo, a 101,3 kPa; se desprecia el CO₂ que se disuelve en el agua.',
    'Densidad del agua oxigenada diluida: 1,00 g/mL.',
  ],
  limits: [
    'Las constantes de velocidad son didácticas: no reproducen un mármol, un MnO₂ ni una papa concretos.',
    'No se modela el calor liberado por la reacción, la agitación, la disolución del CO₂ ni la espuma.',
    'El tamaño de partícula se resume en un único factor de área; la superficie real depende de la forma y la porosidad.',
  ],
  testCases: [
    'El CO₂ total coincide con la estequiometría: 0,40 g de CaCO₃ → ≈ 98 mL a 25 °C; el volumen final siempre cabe en la jeringa.',
    'Más concentración, temperatura o área → más velocidad inicial; polvo frente a trozos ≈ 12× al inicio.',
    'Con k de Arrhenius y Eₐ = 45 kJ/mol la velocidad aumenta ≈ 1,8 veces de 25 a 35 °C.',
    'El volumen final no depende de la temperatura ni del tamaño de partícula (mismo reactivo limitante).',
    'Con catalizador la descomposición es más rápida, pero el O₂ total es el mismo; la catalasa pierde actividad a 60 °C y el MnO₂ la aumenta.',
    'La curva volumen–tiempo es creciente y se aplana; las entradas fuera de rango producen error.',
  ],
};

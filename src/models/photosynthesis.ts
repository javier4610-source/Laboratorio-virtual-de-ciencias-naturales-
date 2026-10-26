import { assertInRange, celsiusToKelvin, R_GAS } from './math';
import type { ModelSpec } from './types';
import { num, orList, type ModelCondition } from './conditions';

/**
 * Fotosíntesis en una planta acuática (Elodea) — grado 10.º.
 * Modelo educativo de factores limitantes:
 *   J  = α·φ·I                         (limitación por luz)
 *   Vc = Vmax(T)·C/(Kc + C)            (limitación por CO₂ y enzimas: RuBisCO)
 *   P_bruta = [J + Vc − √((J + Vc)² − 4θ·J·Vc)] / (2θ)   (colimitación, hipérbola no rectangular)
 *   P_neta  = P_bruta − R(T),  R(T) = R₂₅·Q₁₀^((T − 25)/10)
 */

export const LAMP_I0 = 800; // µmol fotones·m⁻²·s⁻¹ a 10 cm
export const LAMP_D0 = 10; // cm
export const ALPHA = 0.12; // µmol O₂·g⁻¹·h⁻¹ por µmol fotones·m⁻²·s⁻¹ (ilustrativo)
export const VMAX25 = 100; // µmol O₂·g⁻¹·h⁻¹
export const KC = 0.5; // mmol/L de carbono inorgánico disuelto
export const BASE_DIC = 0.05; // mmol/L de CO₂ disuelto en agua sin bicarbonato añadido (aprox.)
export const THETA = 0.9;
export const R25 = 8; // respiración a 25 °C, µmol O₂·g⁻¹·h⁻¹
export const Q10 = 2;
export const BUBBLES_PER_UNIT = 0.2; // burbujas/min por µmol O₂·g⁻¹·h⁻¹ (calibración ilustrativa)

export const LIGHT_COLORS = [
  { id: 'blanca', name: 'Blanca', factor: 0.9, color: '#f5f1d8' },
  { id: 'roja', name: 'Roja (≈ 660 nm)', factor: 1.0, color: '#e05252' },
  { id: 'azul', name: 'Azul (≈ 450 nm)', factor: 0.8, color: '#4a74d9' },
  { id: 'verde', name: 'Verde (≈ 530 nm)', factor: 0.55, color: '#4caf50' },
] as const;

export type LightColor = (typeof LIGHT_COLORS)[number]['id'];

export const PHOTO_LIMITS = {
  distance: [5, 100] as [number, number], // cm
  bicarbonate: [0, 5] as [number, number], // g/L de NaHCO₃
  temperature: [5, 45] as [number, number], // °C
};

/** Ley del inverso del cuadrado: I = I₀·(d₀/d)². */
export function irradiance(distanceCm: number): number {
  return LAMP_I0 * (LAMP_D0 / distanceCm) ** 2;
}

/** Carbono inorgánico disuelto (mmol/L) a partir del bicarbonato añadido (M = 84,01 g/mol). */
export function dissolvedCarbon(bicarbonateGPerL: number): number {
  return BASE_DIC + (bicarbonateGPerL / 84.007) * 1000;
}

export function vmaxAt(tempC: number): number {
  const T = celsiusToKelvin(tempC);
  const Tref = celsiusToKelvin(25);
  const arr = Math.exp((-60000 / R_GAS) * (1 / T - 1 / Tref));
  const active = 1 / (1 + Math.exp((tempC - 40) / 3));
  const activeRef = 1 / (1 + Math.exp((25 - 40) / 3));
  return VMAX25 * arr * (active / activeRef);
}

export function respiration(tempC: number): number {
  return R25 * Q10 ** ((tempC - 25) / 10);
}

export function grossRate(lightEff: number, carbon: number, tempC: number): number {
  const J = ALPHA * lightEff;
  const Vc = (vmaxAt(tempC) * carbon) / (KC + carbon);
  const s = J + Vc;
  return (s - Math.sqrt(Math.max(0, s * s - 4 * THETA * J * Vc))) / (2 * THETA);
}

export interface PhotoInput { distance: number; bicarbonate: number; temperature: number; color: LightColor; lampOn: boolean; }
export interface PhotoResult {
  irradiance: number; effectiveLight: number; carbon: number;
  gross: number; respiration: number; net: number; bubblesPerMin: number;
  limiting: 'luz' | 'CO₂ / enzimas' | 'ambos';
  compensationIrradiance: number | null;
}

export function simulatePhotosynthesis(input: PhotoInput): PhotoResult {
  assertInRange('La distancia de la lámpara', input.distance, ...PHOTO_LIMITS.distance);
  assertInRange('El bicarbonato', input.bicarbonate, ...PHOTO_LIMITS.bicarbonate);
  assertInRange('La temperatura', input.temperature, ...PHOTO_LIMITS.temperature);
  const colorFactor = LIGHT_COLORS.find((c) => c.id === input.color)?.factor ?? 1;
  const I = input.lampOn ? irradiance(input.distance) : 0;
  const Ieff = I * colorFactor;
  const C = dissolvedCarbon(input.bicarbonate);
  const gross = grossRate(Ieff, C, input.temperature);
  const R = respiration(input.temperature);
  const net = gross - R;
  const J = ALPHA * Ieff;
  const Vc = (vmaxAt(input.temperature) * C) / (KC + C);
  const limiting = J < 0.7 * Vc ? 'luz' : Vc < 0.7 * J ? 'CO₂ / enzimas' : 'ambos';
  // Punto de compensación lumínico (con este color, CO₂ y temperatura): P_bruta(I) = R.
  let comp: number | null = null;
  if (grossRate(10000 * colorFactor, C, input.temperature) > R) {
    let lo = 0, hi = 10000;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (grossRate(mid * colorFactor, C, input.temperature) > R) hi = mid; else lo = mid;
    }
    comp = (lo + hi) / 2;
  }
  return {
    irradiance: I, effectiveLight: Ieff, carbon: C, gross, respiration: R, net,
    bubblesPerMin: Math.max(0, net) * BUBBLES_PER_UNIT, limiting, compensationIrradiance: comp,
  };
}

export const photosynthesisModelSpec: ModelSpec = {
  name: 'Fotosíntesis neta con factores limitantes (luz, CO₂ y temperatura)',
  inputs: [
    { symbol: 'd', name: 'Distancia de la lámpara a la planta', unit: 'cm', range: PHOTO_LIMITS.distance, initial: 20 },
    { symbol: 'NaHCO₃', name: 'Bicarbonato de sodio añadido (fuente de CO₂)', unit: 'g/L', range: PHOTO_LIMITS.bicarbonate, initial: 1 },
    { symbol: 'T', name: 'Temperatura del agua', unit: '°C', range: PHOTO_LIMITS.temperature, initial: 25 },
    { symbol: 'color', name: 'Color de la luz (filtro)', unit: '—', initial: 'blanca' },
  ],
  outputs: [
    { symbol: 'I', name: 'Irradiancia sobre la planta', unit: 'µmol fotones·m⁻²·s⁻¹' },
    { symbol: 'P_neta', name: 'Producción neta de O₂', unit: 'µmol O₂·g⁻¹·h⁻¹' },
    { symbol: 'burbujas', name: 'Burbujas de O₂ por minuto', unit: 'burbujas/min' },
    { symbol: 'I_c', name: 'Punto de compensación lumínico', unit: 'µmol fotones·m⁻²·s⁻¹' },
  ],
  equations: [
    'I = I₀·(d₀/d)²  (ley del inverso del cuadrado; I₀ = 800 a 10 cm)',
    'J = α·φ_color·I ;  Vc = Vmax(T)·C/(Kc + C)',
    'P_bruta = [J + Vc − √((J + Vc)² − 4θJVc)]/(2θ), θ = 0,9',
    'Vmax(T) = Vmax₂₅·e^(−Eₐ/R·(1/T − 1/298)) · fracción activa(T)',
    'R(T) = R₂₅·2^((T − 25)/10)',
    'P_neta = P_bruta − R ;  burbujas/min ∝ P_neta (si P_neta > 0)',
  ],
  initialConditions: ['Elodea a 25 °C, lámpara blanca a 20 cm, 1 g/L de NaHCO₃.'],
  assumptions: [
    'La planta está aclimatada y el oxígeno producido se libera como burbujas de tamaño constante.',
    'El bicarbonato aporta carbono inorgánico disuelto de forma inmediata; se ignora el pH.',
    'La lámpara es una fuente puntual: no calienta el agua (se supone un filtro de calor).',
    'Los factores de color son ilustrativos: las plantas también aprovechan parte de la luz verde.',
    'Todos los parámetros (α, Vmax, Kc, R₂₅) son ilustrativos, del orden de magnitud de plantas acuáticas.',
  ],
  limits: [
    'No modela fotoinhibición, apertura de estomas, fotorrespiración detallada ni aclimatación.',
    'En un experimento real parte del O₂ se disuelve en el agua y el conteo de burbujas es impreciso.',
    'La desnaturalización por calor se trata como reversible durante el ensayo.',
  ],
  testCases: [
    'Reducir la distancia a la mitad cuadruplica la irradiancia.',
    'La fotosíntesis neta aumenta con la luz y se satura; en oscuridad es negativa (solo respiración).',
    'Con luz intensa, aumentar el CO₂ aumenta mucho la fotosíntesis; con luz débil casi no la cambia (factor limitante).',
    'Existe una temperatura óptima entre 25 y 35 °C.',
    'Existe un punto de compensación lumínico positivo.',
  ],
};

/** Temperatura (°C) desde la que el modelo considera que las enzimas de la fotosíntesis se desnaturalizan (vmaxAt). */
export const PHOTO_DENATURE_T = 40;

/** Advertencias de la práctica con su nivel y su corrección, con los mismos umbrales del modelo. */
export function photoConditions(input: PhotoInput, res: PhotoResult): ModelCondition[] {
  const out: ModelCondition[] = [];
  if (input.temperature >= PHOTO_DENATURE_T) {
    out.push({
      text: 'A esta temperatura las enzimas de la fotosíntesis empiezan a desnaturalizarse.', level: 'advertencia',
      fix: `Baja la «Temperatura del agua» por debajo de ${num(PHOTO_DENATURE_T)} °C.`,
    });
  }
  if (input.lampOn && res.net <= 0) {
    // Hay burbujas si la luz que llega supera el punto de compensación: I₀·(d₀/d)² > I_c  →  d < d₀·√(I₀/I_c).
    const comp = res.compensationIrradiance;
    const dMax = comp === null ? null : Math.ceil(LAMP_D0 * Math.sqrt(LAMP_I0 / comp)) - 1;
    const current = LIGHT_COLORS.find((c) => c.id === input.color)!;
    const better = LIGHT_COLORS.filter((c) => c.factor > current.factor).map((c) => c.name.replace(/ \(.*\)$/, '').toLowerCase());
    const color = better.length > 0 ? `, o usa luz ${orList(better)}` : '';
    out.push({
      text: 'La respiración supera a la fotosíntesis: no se liberan burbujas (por debajo del punto de compensación).', level: 'advertencia',
      fix: dMax !== null && dMax >= PHOTO_LIMITS.distance[0]
        ? `Acerca la lámpara: baja la «Distancia de la lámpara» a ${num(dMax)} cm o menos${color}, para que la luz supere el punto de compensación.`
        : `Ni con la lámpara a ${num(PHOTO_LIMITS.distance[0])} cm se supera el punto de compensación: sube el «Bicarbonato de sodio (CO₂)»${color}.`,
    });
  }
  return out;
}

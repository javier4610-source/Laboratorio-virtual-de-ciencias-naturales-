import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Balance de energía de la Tierra y efecto invernadero (grado 11.º).
 *
 * 1) Planeta sin atmósfera que absorba infrarrojo (cuerpo negro en el infrarrojo): recibe la irradiancia solar S sobre
 *    su sombra (un disco de área πR²) y emite por toda la esfera (4πR²):
 *      S·(1 − α)·πR² = σ·T⁴·4πR²   →   T_e = [S·(1 − α)/(4σ)]^¼
 *    Con S₀ = 1361 W/m² (Kopp y Lean, 2011) y α = 0,30: T_e = 254,6 K ≈ −18,6 °C.
 * 2) Modelo de una capa (Archer, Global Warming: Understanding the Forecast, cap. 3): una capa de atmósfera transparente
 *    a la luz solar que absorbe una fracción ε del infrarrojo de la superficie y emite ε·σ·T_a⁴ hacia arriba y hacia abajo.
 *      capa:        ε·σ·T_s⁴ = 2·ε·σ·T_a⁴          →  T_a = T_s/2^¼
 *      superficie:  S(1 − α)/4 + ε·σ·T_a⁴ = σ·T_s⁴  →  T_s = T_e·[2/(2 − ε)]^¼
 *    ε = 0 da T_e (255 K); ε = 1 (capa opaca) da 2^¼·T_e = 302,7 K; ε ≈ 0,78 da 288 K, la temperatura media observada.
 *    Con n capas opacas: T_s = T_e·(n + 1)^¼.
 * 3) Forzamiento radiativo del CO₂ con la fórmula simplificada de Myhre y otros (1998): ΔF = 5,35·ln(C/C₀) W/m²
 *    (duplicar el CO₂: 3,71 W/m²). Calentamiento de equilibrio ΔT = ECS·ΔF/ΔF₂ₓ con la sensibilidad climática de
 *    equilibrio del IPCC AR6 (GT I, cap. 7): mejor estimación 3 °C, rango probable 2,5–4 °C y muy probable 2–5 °C.
 *    C₀ = 278,3 ppm (1750) y 409,9 ppm en 2019 (IPCC AR6, GT I, cap. 2).
 * Constante de Stefan–Boltzmann: CODATA 2018. Planetas: NASA Planetary Fact Sheet (irradiancia solar, albedo de Bond,
 * temperatura de cuerpo negro y temperatura media de la superficie). Este archivo no depende de React ni del navegador.
 */

export const SIGMA = 5.670374419e-8; // W/(m²·K⁴), CODATA 2018 (exacta en el SI de 2019)
export const S0 = 1361; // W/m², Kopp y Lean (2011): 1360,8 ± 0,5
export const ALBEDO = 0.3;
export const EPS_288 = 0.78; // ε del modelo de una capa que da ≈ 288 K
export const T_OBS = 288; // K, temperatura media observada de la superficie (NASA Planetary Fact Sheet)
export const CO2 = { preindustrial: 278.3, y2019: 409.9, glacial: 185, doubled: 556.6 }; // ppm
export const MYHRE = 5.35; // W/m²
export const F2X = MYHRE * Math.log(2); // 3,708 W/m²
export const ECS = { best: 3, likely: [2.5, 4] as [number, number], veryLikely: [2, 5] as [number, number] }; // °C, IPCC AR6
export const GH_LIMITS = { S: [500, 2700] as [number, number], albedo: [0, 0.9] as [number, number], eps: [0, 1] as [number, number], co2: [150, 1200] as [number, number], ecs: [1.5, 6] as [number, number] };

export interface Planet { id: string; name: string; S: number; albedo: number; tBlackbody: number; tSurface: number; note: string }
/** NASA Planetary Fact Sheet (Williams, NASA Goddard): irradiancia solar media, albedo de Bond y temperaturas. */
export const PLANETS: Planet[] = [
  { id: 'tierra', name: 'Tierra', S: 1361, albedo: 0.3, tBlackbody: 254.0, tSurface: 288, note: 'La NASA usa α = 0,306 (T de cuerpo negro 254,0 K); con 0,30 sale 254,6 K.' },
  { id: 'marte', name: 'Marte', S: 586.2, albedo: 0.25, tBlackbody: 209.8, tSurface: 210, note: 'Atmósfera de CO₂ muy delgada (≈ 0,6 % de la presión de la Tierra): casi no hay efecto invernadero.' },
  { id: 'venus', name: 'Venus', S: 2601.3, albedo: 0.77, tBlackbody: 226.6, tSurface: 737, note: 'Refleja el 77 % de la luz y aun así es el planeta más caliente: en su superficie la atmósfera de CO₂ ejerce una presión 92 veces mayor que la del aire en la Tierra.' },
];
export function findPlanet(id: string): Planet {
  const p = PLANETS.find((x) => x.id === id);
  if (!p) throw new RangeError(`Planeta desconocido: ${id}`);
  return p;
}

/** Albedos aproximados de superficies (valores típicos de los textos; varían con el ángulo del Sol y el estado). */
export const SURFACES = [
  { id: 'oceano', name: 'Océano (golfo de Urabá)', albedo: 0.06 },
  { id: 'bosque', name: 'Bosque tropical', albedo: 0.13 },
  { id: 'pasto', name: 'Pastizal', albedo: 0.2 },
  { id: 'arena', name: 'Arena del desierto', albedo: 0.35 },
  { id: 'nubes', name: 'Nubes gruesas', albedo: 0.7 },
  { id: 'nieve', name: 'Nieve fresca', albedo: 0.85 },
];

export const absorbedSolar = (S: number, albedo: number) => (S * (1 - albedo)) / 4;
/** Temperatura de equilibrio sin efecto invernadero (K). */
export function effectiveTemp(S: number, albedo: number): number {
  assertInRange('La irradiancia solar', S, 1, 1e5);
  assertInRange('El albedo', albedo, 0, 1);
  return (absorbedSolar(S, albedo) / SIGMA) ** 0.25;
}
/** Potencia emitida por unidad de área de un cuerpo negro a la temperatura T (W/m²). */
export const blackbody = (T: number) => SIGMA * T ** 4;

export interface LayerInput { S: number; albedo: number; eps: number }
export interface LayerResult {
  Te: number; Ts: number; Ta: number | null;
  incoming: number; reflected: number; absorbed: number;
  surfaceIR: number; layerAbsorbs: number; window: number; layerUp: number; layerDown: number; olr: number;
  greenhouse: number; // T_s − T_e (K)
}
/** Modelo de una capa gris (ε entre 0 y 1). Todos los flujos son promedios por m² de superficie del planeta. */
export function layerModel(i: LayerInput): LayerResult {
  assertInRange('La absorción infrarroja de la capa (ε)', i.eps, 0, 1);
  const Te = effectiveTemp(i.S, i.albedo);
  const Ts = Te * (2 / (2 - i.eps)) ** 0.25;
  const Ta = i.eps > 0 ? Ts / 2 ** 0.25 : null;
  const surfaceIR = blackbody(Ts);
  const layerEmit = Ta === null ? 0 : i.eps * blackbody(Ta);
  return {
    Te, Ts, Ta,
    incoming: i.S / 4, reflected: (i.S * i.albedo) / 4, absorbed: absorbedSolar(i.S, i.albedo),
    surfaceIR, layerAbsorbs: i.eps * surfaceIR, window: (1 - i.eps) * surfaceIR, layerUp: layerEmit, layerDown: layerEmit,
    olr: (1 - i.eps) * surfaceIR + layerEmit, greenhouse: Ts - Te,
  };
}
/** n capas opacas al infrarrojo: T_s = T_e·(n + 1)^¼. */
export function opaqueLayers(S: number, albedo: number, n: number): number {
  assertInRange('El número de capas', n, 0, 20);
  return effectiveTemp(S, albedo) * (n + 1) ** 0.25;
}
/** ε que hace que el modelo de una capa dé la temperatura de superficie T_s. */
export function epsilonFor(S: number, albedo: number, Ts: number): number {
  const Te = effectiveTemp(S, albedo);
  return 2 - (2 * Te ** 4) / Ts ** 4;
}

/** Forzamiento radiativo del CO₂ respecto a C₀ (W/m²), Myhre y otros (1998). */
export function co2Forcing(C: number, C0 = CO2.preindustrial): number {
  assertInRange('La concentración de CO₂', C, 1, 1e5);
  return MYHRE * Math.log(C / C0);
}
export interface WarmingResult { forcing: number; lambda: number; dT: number; ratio: number; lnRatio: number }
/** Calentamiento de equilibrio con la sensibilidad climática ECS (°C por duplicación del CO₂). */
export function co2Warming(C: number, ecs: number, C0 = CO2.preindustrial): WarmingResult {
  assertInRange('La sensibilidad climática', ecs, 0.1, 10);
  const forcing = co2Forcing(C, C0);
  const lambda = ecs / F2X;
  return { forcing, lambda, dT: lambda * forcing, ratio: C / C0, lnRatio: Math.log(C / C0) };
}

export const kelvinToC = (k: number) => k - 273.15;

export interface GhCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function layerConditions(i: LayerInput): GhCondition[] {
  const out: GhCondition[] = [];
  if (i.albedo >= 0.6) out.push({ level: 'nota', text: `Con un albedo de ${String(i.albedo.toFixed(2)).replace('.', ',')} el planeta refleja la mayor parte de la luz, como una «Tierra bola de nieve» cubierta de hielo.`, fix: 'Vuelve al albedo de la Tierra actual (≈ 0,30) para comparar.' });
  if (i.eps >= 0.98) out.push({ level: 'nota', text: 'Con una capa opaca (ε = 1) la superficie llega a ≈ 303 K, más caliente que la Tierra real: la atmósfera real deja escapar parte del infrarrojo por la «ventana atmosférica».', fix: 'Busca el ε con el que la superficie queda en 288 K (≈ 0,78).' });
  if (i.eps === 0) out.push({ level: 'nota', text: 'Sin capa que absorba infrarrojo, la superficie queda a la temperatura de equilibrio T_e: es la Tierra sin efecto invernadero.', fix: 'Sube ε para ver cómo la capa devuelve energía a la superficie.' });
  return out;
}
export function co2Conditions(C: number, ecs: number): GhCondition[] {
  const out: GhCondition[] = [];
  if (ecs < ECS.veryLikely[0] || ecs > ECS.veryLikely[1]) out.push({ level: 'advertencia', text: `Una sensibilidad de ${String(ecs.toFixed(1)).replace('.', ',')} °C está fuera del rango muy probable del IPCC AR6 (2 a 5 °C).`, fix: 'Usa la mejor estimación (3 °C) o los extremos del rango probable (2,5 y 4 °C).' });
  if (C < 180) out.push({ level: 'nota', text: `${Math.round(C)} ppm es menos CO₂ que en las glaciaciones (≈ 180–190 ppm en los núcleos de hielo de la Antártida).`, fix: 'Compara con el valor preindustrial (278 ppm) y con el de 2019 (410 ppm).' });
  if (C > 1000) out.push({ level: 'nota', text: 'Más de 1000 ppm: la fórmula logarítmica de Myhre es una aproximación que pierde exactitud con concentraciones tan altas.', fix: 'Para comparar escenarios usa 2 × CO₂ (557 ppm) o 4 × CO₂ (1113 ppm).' });
  return out;
}

export const greenhouseSpec: ModelSpec = {
  name: 'Balance de energía de la Tierra: equilibrio radiativo, modelo de una capa y forzamiento del CO₂',
  inputs: [
    { symbol: 'S', name: 'Irradiancia solar (constante solar)', unit: 'W/m²', range: [500, 2700], initial: 1361 },
    { symbol: 'α', name: 'Albedo planetario', unit: '—', range: [0, 0.9], initial: 0.3 },
    { symbol: 'ε', name: 'Fracción del infrarrojo que absorbe la capa', unit: '—', range: [0, 1], initial: 0.78 },
    { symbol: 'C', name: 'Concentración de CO₂', unit: 'ppm', range: [150, 1200], initial: 409.9 },
    { symbol: 'ECS', name: 'Sensibilidad climática de equilibrio', unit: '°C', range: [1.5, 6], initial: 3 },
  ],
  outputs: [
    { symbol: 'T_e', name: 'Temperatura de equilibrio sin efecto invernadero', unit: 'K' },
    { symbol: 'T_s, T_a', name: 'Temperatura de la superficie y de la capa', unit: 'K' },
    { symbol: 'flujos', name: 'Luz reflejada y absorbida, infrarrojo de la superficie, de la capa y al espacio', unit: 'W/m²' },
    { symbol: 'ΔF, ΔT', name: 'Forzamiento del CO₂ y calentamiento de equilibrio', unit: 'W/m², °C' },
  ],
  equations: [
    'S·(1 − α)·πR² = σ·T_e⁴·4πR²  →  T_e = [S·(1 − α)/(4σ)]^¼;  σ = 5,670 × 10⁻⁸ W/(m²·K⁴)',
    'Capa: ε·σ·T_s⁴ = 2·ε·σ·T_a⁴;  superficie: S(1 − α)/4 + ε·σ·T_a⁴ = σ·T_s⁴  →  T_s = T_e·[2/(2 − ε)]^¼',
    'n capas opacas: T_s = T_e·(n + 1)^¼',
    'ΔF = 5,35·ln(C/C₀) W/m² (Myhre, 1998);  ΔT = ECS·ΔF/ΔF₂ₓ,  ΔF₂ₓ = 5,35·ln 2 = 3,71 W/m²',
  ],
  initialConditions: ['Tierra con S = 1361 W/m², α = 0,30 y una capa con ε = 0,78; CO₂ de 2019 (409,9 ppm) frente al preindustrial (278,3 ppm) con ECS = 3 °C.'],
  assumptions: [
    'El planeta tiene una sola temperatura de superficie (promedio de día y noche, polos y trópicos) y emite como cuerpo negro en el infrarrojo.',
    'La capa de atmósfera deja pasar toda la luz solar y absorbe la fracción ε del infrarrojo; no hay convección ni evaporación (que en la realidad llevan calor hacia arriba).',
    'El forzamiento es solo el del CO₂; la sensibilidad climática resume todas las retroalimentaciones (vapor de agua, hielo, nubes) y da el calentamiento cuando el clima ya se equilibró, no el de un año dado.',
  ],
  limits: [
    'El modelo de una capa explica el mecanismo pero no reproduce el perfil de temperatura real de la atmósfera ni los flujos medidos (p. ej., los 333 W/m² de infrarrojo que bajan hacia la superficie según Trenberth y otros).',
    'La fórmula de Myhre es una aproximación; el IPCC AR6 usa una más detallada (2,16 W/m² para el CO₂ de 1750 a 2019 frente a 2,07 W/m² con la de Myhre).',
    'No incluye otros gases (metano, óxido nitroso), aerosoles, ni el retraso del océano: el calentamiento observado (≈ 1,1 °C en 2011–2020) no es el de equilibrio.',
  ],
  testCases: [
    'S = 1361 W/m², α = 0,30: T_e = 254,58 K; con el albedo de la NASA (0,306) 254,0 K, y Marte 209,8 K y Venus 226,6 K como en la NASA Planetary Fact Sheet.',
    'Capa opaca: T_s = 2^¼·T_e = 302,7 K; ε = 0,78 → 288,1 K; n capas opacas: T_e·(n + 1)^¼.',
    'Equilibrio en la cima de la atmósfera: radiación saliente = solar absorbida (238,2 W/m²) para todo ε.',
    'Duplicar el CO₂: ΔF = 3,708 W/m² y ΔT = ECS; 409,9 ppm frente a 278,3 ppm: 2,07 W/m² y 1,68 °C con ECS = 3 °C.',
  ],
};

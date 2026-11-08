import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Ciclo del carbono: reservorios, flujos y un modelo de cajas (grado 7.º).
 *
 * 1) Reservorios (PgC = GtC = miles de millones de toneladas de carbono) y flujos naturales brutos (PgC/año) del IPCC
 *    AR5, GT I, cap. 6 (Ciais y otros, 2013, figura 6.1), redondeados; el AR6 (GT I, cap. 5, figura 5.12) los actualiza
 *    con cifras del mismo orden. Se muestran como rangos o con «≈»: el docente debe verificarlos con la figura a la vista.
 * 2) Atmósfera calculada con la concentración de CO₂ y el factor 2,124 PgC por ppm (Ballantyne y otros, 2012; usado por
 *    el Global Carbon Budget y el IPCC): 278,3 ppm en 1750 → 591 PgC; 409,9 ppm en 2019 → 871 PgC (IPCC AR6, cap. 2).
 * 3) Balance anual promedio 2010–2019 (IPCC AR6, GT I, cap. 5, tabla 5.1; Friedlingstein y otros, 2020): emisiones
 *    fósiles 9,6 ± 0,5 y por cambio de uso del suelo 1,6 ± 0,7 PgC/año; crecimiento de la atmósfera 5,1 ± 0,02;
 *    sumidero oceánico 2,5 ± 0,6 y terrestre 3,4 ± 0,9 PgC/año. Fracción que queda en el aire: 5,1/11,2 ≈ 46 %.
 * 4) Modelo de cajas PROPIO (simplificación, no del IPCC): el exceso de carbono del aire X = A − A₁₇₅₀ y los sumideros
 *    proporcionales a X, S = k·X, con k calibrado para que en la mitad de 2010–2019 den los 2,5 y 3,4 PgC/año de la tabla:
 *      dA/dt = E_fósil + E_suelo − R − (k_océano + k_tierra)·(A − A₁₇₅₀)    (R: reforestación adicional)
 *    Sirve para comparar escenarios hasta 2100; NO reproduce la saturación de los sumideros ni que una parte del CO₂
 *    emitido permanece en el aire miles de años.
 * Este archivo no depende de React ni del navegador.
 */

export const PGC_PER_PPM = 2.124;
export const PPM_1750 = 278.3;
export const PPM_2019 = 409.9;
export const A_1750 = PPM_1750 * PGC_PER_PPM; // 591,1 PgC
export const A_2019 = PPM_2019 * PGC_PER_PPM; // 870,6 PgC

/** Balance 2010–2019 (PgC/año), IPCC AR6, GT I, tabla 5.1. */
export const BUDGET = {
  fossil: { value: 9.6, unc: 0.5 },
  landUse: { value: 1.6, unc: 0.7 },
  atmosphere: { value: 5.1, unc: 0.02 },
  ocean: { value: 2.5, unc: 0.6 },
  land: { value: 3.4, unc: 0.9 },
};
export const EMISSIONS_2010s = BUDGET.fossil.value + BUDGET.landUse.value; // 11,2
export const SINKS_2010s = BUDGET.atmosphere.value + BUDGET.ocean.value + BUDGET.land.value; // 11,0
export const IMBALANCE = EMISSIONS_2010s - SINKS_2010s; // 0,2: lo que no se logra cerrar con las mediciones
export const AIRBORNE_FRACTION = BUDGET.atmosphere.value / EMISSIONS_2010s;

/** Atmósfera en la mitad de 2010–2019 (inicio de 2015), contando hacia atrás desde 2019 con 5,1 PgC/año. */
export const A_MID = A_2019 - 4.5 * BUDGET.atmosphere.value;
export const K_OCEAN = BUDGET.ocean.value / (A_MID - A_1750);
export const K_LAND = BUDGET.land.value / (A_MID - A_1750);

export interface Reservoir { id: string; name: string; low: number; high: number; mid: number; note: string }
/** IPCC AR5, GT I, figura 6.1 (preindustrial), redondeado; la atmósfera con 2,124 PgC/ppm. */
export const RESERVOIRS: Reservoir[] = [
  { id: 'atmosfera', name: 'Atmósfera (1750)', low: A_1750, high: A_1750, mid: A_1750, note: '278,3 ppm de CO₂ × 2,124 PgC/ppm. En 2019, con 409,9 ppm, eran ≈ 871 PgC.' },
  { id: 'vegetacion', name: 'Plantas (vegetación)', low: 450, high: 650, mid: 550, note: 'Bosques, pastos y cultivos; los manglares de Urabá guardan mucho carbono por hectárea.' },
  { id: 'suelos', name: 'Suelos', low: 1500, high: 2400, mid: 1950, note: 'Materia orgánica del suelo y hojarasca (sin el permafrost).' },
  { id: 'fosiles', name: 'Combustibles fósiles (reservas)', low: 1000, high: 1900, mid: 1450, note: 'Gas, petróleo y carbón que se considera posible extraer; la cifra depende de la tecnología y los precios.' },
  { id: 'oceano-superficie', name: 'Océano superficial', low: 900, high: 900, mid: 900, note: 'Los primeros cien metros del océano, en contacto con el aire.' },
  { id: 'oceano-profundo', name: 'Océano intermedio y profundo', low: 37100, high: 37100, mid: 37100, note: 'El reservorio más grande del ciclo rápido: el carbono tarda siglos en volver a la superficie.' },
];
export function findReservoir(id: string): Reservoir {
  const r = RESERVOIRS.find((x) => x.id === id);
  if (!r) throw new RangeError(`Reservorio desconocido: ${id}`);
  return r;
}
/** Flujos naturales brutos (PgC/año) redondeados del IPCC AR5, figura 6.1: se compensan entre sí antes de 1750. */
export const GROSS = { photosynthesis: 120, respiration: 120, oceanIn: 80, oceanOut: 80 };

/* ------------------------------------------------------------------ modelo de cajas */

export interface Scenario { fossil2050: number; landUse: number; reforest: number }
export const C_LIMITS = { fossil2050: [0, 20] as [number, number], landUse: [0, 3] as [number, number], reforest: [0, 3] as [number, number] };
export const START_YEAR = 2019, END_YEAR = 2100;
export const ppmOf = (A: number) => A / PGC_PER_PPM;

/** Emisiones fósiles del año t: cambian en línea recta de 9,6 (2019) al valor de 2050 y luego se mantienen. */
export const fossilAt = (s: Scenario, year: number) => BUDGET.fossil.value + (s.fossil2050 - BUDGET.fossil.value) * Math.min(1, Math.max(0, (year - START_YEAR) / (2050 - START_YEAR)));
/** Tasa de cambio de la atmósfera (PgC/año). */
export function atmosphereRate(A: number, s: Scenario, year: number) {
  const ocean = K_OCEAN * (A - A_1750), land = K_LAND * (A - A_1750);
  const emit = fossilAt(s, year) + s.landUse;
  return { emit, ocean, land, reforest: s.reforest, net: emit - s.reforest - ocean - land };
}

export interface CarbonPoint { year: number; A: number; ppm: number; fossil: number; ocean: number; land: number; growth: number }
export interface CarbonRun { points: CarbonPoint[]; ppm2050: number; ppm2100: number; peak: { year: number; ppm: number }; cumFossil: number; cumOcean: number; cumLand: number; cumAtm: number }
/** Integra de 2019 a 2100 con RK4 (paso de 0,25 años) desde A_2019. */
export function simulateCarbon(s: Scenario): CarbonRun {
  assertInRange('Las emisiones fósiles de 2050', s.fossil2050, ...C_LIMITS.fossil2050);
  assertInRange('Las emisiones por deforestación', s.landUse, ...C_LIMITS.landUse);
  assertInRange('La reforestación', s.reforest, ...C_LIMITS.reforest);
  const dt = 0.25;
  let A = A_2019, cumFossil = 0, cumOcean = 0, cumLand = 0;
  const f = (a: number, y: number) => atmosphereRate(a, s, y).net;
  const points: CarbonPoint[] = [];
  const push = (year: number) => { const r = atmosphereRate(A, s, year); points.push({ year, A, ppm: ppmOf(A), fossil: fossilAt(s, year), ocean: r.ocean, land: r.land, growth: r.net }); };
  push(START_YEAR);
  const steps = (END_YEAR - START_YEAR) / dt;
  for (let k = 0; k < steps; k++) {
    const y = START_YEAR + k * dt;
    const r0 = atmosphereRate(A, s, y);
    const k1 = f(A, y), k2 = f(A + (dt / 2) * k1, y + dt / 2), k3 = f(A + (dt / 2) * k2, y + dt / 2), k4 = f(A + dt * k3, y + dt);
    const r1 = atmosphereRate(A + dt * k1, s, y + dt);
    cumFossil += (dt / 2) * (fossilAt(s, y) + fossilAt(s, y + dt));
    cumOcean += (dt / 2) * (r0.ocean + r1.ocean);
    cumLand += (dt / 2) * (r0.land + r1.land);
    A += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    if ((k + 1) % 4 === 0) push(START_YEAR + (k + 1) * dt);
  }
  const at = (year: number) => points.find((p) => p.year === year)!.ppm;
  const peak = points.reduce((m, p) => (p.ppm > m.ppm ? { year: p.year, ppm: p.ppm } : m), { year: START_YEAR, ppm: ppmOf(A_2019) });
  return { points, ppm2050: at(2050), ppm2100: at(2100), peak, cumFossil, cumOcean, cumLand, cumAtm: A - A_2019 };
}

export const SCENARIOS: { id: string; name: string; s: Scenario }[] = [
  { id: 'igual', name: 'Todo sigue igual que en 2010–2019', s: { fossil2050: 9.6, landUse: 1.6, reforest: 0 } },
  { id: 'doble', name: 'Las emisiones fósiles se duplican para 2050', s: { fossil2050: 19.2, landUse: 1.6, reforest: 0 } },
  { id: 'mitad', name: 'Las emisiones fósiles bajan a la mitad para 2050', s: { fossil2050: 4.8, landUse: 1.6, reforest: 0 } },
  { id: 'cero', name: 'Cero emisiones fósiles en 2050, sin deforestación y con reforestación', s: { fossil2050: 0, landUse: 0, reforest: 1 } },
];

/* ------------------------------------------------------------------ avisos */

export interface CarbonCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function carbonConditions(s: Scenario, run: CarbonRun): CarbonCondition[] {
  const out: CarbonCondition[] = [];
  if (run.points.some((p) => p.growth < 0)) out.push({ level: 'nota', text: 'En este escenario el CO₂ del aire llega a bajar. En el modelo de cajas los sumideros siguen absorbiendo al mismo ritmo, pero en la realidad el océano y los bosques absorberían cada vez menos y el CO₂ bajaría mucho más despacio: el modelo es optimista.', fix: 'Lee la bajada como un límite superior de lo posible y compárala con el escenario «todo sigue igual».' });
  if (s.reforest > 2) out.push({ level: 'advertencia', text: `Reforestar para absorber ${s.reforest.toFixed(1).replace('.', ',')} PgC por año exigiría sembrar cada año bosques de muchos millones de hectáreas: es más de lo que hoy se considera realista.`, fix: 'Usa una reforestación de 0,5 a 1 PgC/año y combínala con menos emisiones.' });
  if (run.ppm2100 > 600) out.push({ level: 'nota', text: `Con ${Math.round(run.ppm2100)} ppm en 2100 los sumideros reales probablemente se debilitarían (océano más caliente y ácido, bosques bajo estrés): el modelo lineal subestima el CO₂.`, fix: 'Compara con escenarios de menos emisiones.' });
  return out;
}

export const carbonSpec: ModelSpec = {
  name: 'Ciclo global del carbono: reservorios, balance anual y modelo de cajas de la atmósfera',
  inputs: [
    { symbol: 'E_f(2050)', name: 'Emisiones fósiles en 2050 (cambio lineal desde 9,6 en 2019)', unit: 'PgC/año', range: C_LIMITS.fossil2050, initial: 9.6 },
    { symbol: 'E_s', name: 'Emisiones por deforestación y cambio de uso del suelo', unit: 'PgC/año', range: C_LIMITS.landUse, initial: 1.6 },
    { symbol: 'R', name: 'Reforestación adicional', unit: 'PgC/año', range: C_LIMITS.reforest, initial: 0 },
  ],
  outputs: [
    { symbol: 'A(t), ppm', name: 'Carbono en la atmósfera y concentración de CO₂ de 2019 a 2100', unit: 'PgC, ppm' },
    { symbol: 'S_o, S_t', name: 'Sumideros del océano y de la tierra', unit: 'PgC/año' },
    { symbol: 'f', name: 'Fracción de las emisiones que queda en el aire', unit: '%' },
  ],
  equations: [
    'A = 2,124 PgC/ppm × concentración de CO₂',
    'Balance 2010–2019: 9,6 + 1,6 = 5,1 + 2,5 + 3,4 + 0,2 (desbalance) PgC/año',
    'dA/dt = E_f + E_s − R − (k_o + k_t)·(A − A₁₇₅₀);  k_o = 2,5/(A₂₀₁₅ − A₁₇₅₀), k_t = 3,4/(A₂₀₁₅ − A₁₇₅₀)',
  ],
  initialConditions: ['Atmósfera de 2019: 409,9 ppm (870,6 PgC); emisiones y sumideros de 2010–2019.'],
  assumptions: [
    'Los sumideros del océano y de la tierra son proporcionales al exceso de carbono del aire sobre 1750 (calibrados con 2010–2019).',
    'Las emisiones fósiles cambian en línea recta hasta 2050 y luego quedan constantes; la deforestación y la reforestación son constantes.',
    'Reservorios y flujos brutos redondeados de la figura 6.1 del IPCC AR5 (el AR6 los actualiza en la figura 5.12): solo para comparar órdenes de magnitud.',
  ],
  limits: [
    'Los sumideros reales se debilitan al calentarse el planeta y al acidificarse el océano; el modelo lineal no lo incluye y es optimista.',
    'Si las emisiones paran, el modelo devuelve el CO₂ hacia 1750 en pocas décadas; en la realidad una parte importante permanece en el aire durante siglos y milenios (Archer y otros, 2009).',
    'No incluye el metano ni el carbono que se mueve en escalas de miles de años (rocas, sedimentos).',
  ],
  testCases: [
    'Atmósfera: 278,3 ppm × 2,124 = 591,1 PgC (1750); 409,9 ppm → 870,6 PgC (2019).',
    'Balance 2010–2019: emisiones 11,2 PgC/año, fracción en el aire 46 %, desbalance 0,2 PgC/año.',
    'Modelo calibrado: en 2015 los sumideros dan 2,5 y 3,4 PgC/año y el aire crece 11,2 − 5,9 = 5,3 PgC/año (2,50 ppm/año); lo medido fue 5,1 (2,40 ppm/año): la diferencia es el desbalance de 0,2 PgC/año.',
    'Más emisiones dan más CO₂ en 2100; con cero emisiones el CO₂ deja de subir.',
  ],
};

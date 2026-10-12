import { assertInRange, celsiusToKelvin, R_GAS, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Respiración celular y balance energético (grado 10.º, nivel universitario introductorio).
 *
 * Respirómetro volumétrico de tres tubos sumergidos en un baño termostatado (método clásico de
 * Ganong / respirómetro diferencial escolar):
 *   Tubo A: semillas + KOH (absorbe el CO₂)       → la gota del capilar mide el O₂ consumido.
 *   Tubo B: semillas + agua con azul de bromotimol → la gota mide (O₂ consumido − CO₂ producido).
 *   Tubo C: semillas hervidas + KOH (termobarómetro) → mide solo la deriva de temperatura y presión.
 *
 *   r_O₂(T) = r₂₅ · Q₁₀^((T − 25)/10) · f_nat(T)/f_nat(25),   f_nat(T) = 1/(1 + e^((T − T½)/w))
 *   V_O₂ = r_O₂ · m · t ;   V_CO₂ = CR_sustrato · V_O₂ (aerobiosis)
 *   Anoxia (N₂): V_O₂ = 0 ;  hexosa fermentada = P · r_O₂/6 ;  V_CO₂ = 2 · hexosa (fermentación alcohólica)
 *   Desplazamiento de la gota (hacia el tubo, positivo) = (gas que desaparece)/A_capilar
 *   CR = V_CO₂/V_O₂ = (d_A − d_B)/d_A  (lecturas corregidas con el termobarómetro)
 *
 * Balance de ATP con relaciones P/O modernas (NADH 2,5; FADH₂ 1,5; Hinkle, 2005) o clásicas (3 y 2).
 * Volúmenes de gas en µL a la temperatura del baño y 101,3 kPa (Urabá, casi al nivel del mar).
 */

export type SampleId = 'maiz' | 'mani' | 'hervido';
export type Atmosphere = 'aire' | 'n2';
export type Shuttle = 'malato' | 'glicerol';
export type Accounting = 'moderna' | 'clasica';
export type SubstrateId = 'carbohidrato' | 'lipido' | 'proteina';

export interface SubstrateInfo { id: SubstrateId; name: string; example: string; rq: number; }

/** CR = CO₂ producido / O₂ consumido para la oxidación completa de un compuesto CₐHₕOₒ: C/(C + H/4 − O/2). */
export function rqFromFormula(c: number, h: number, o: number): number {
  if (!(c > 0) || !(h >= 0) || !(o >= 0)) throw new RangeError('La fórmula debe tener átomos de carbono e hidrógeno.');
  const o2 = c + h / 4 - o / 2;
  if (!(o2 > 0)) throw new RangeError('La fórmula no requiere oxígeno para oxidarse.');
  return c / o2;
}

/** O₂ necesario para oxidar por completo un mol de CₐHₕOₒ. */
export const o2ForFormula = (c: number, h: number, o: number) => c + h / 4 - o / 2;

export const SUBSTRATES: Record<SubstrateId, SubstrateInfo> = {
  carbohidrato: { id: 'carbohidrato', name: 'Carbohidratos', example: 'glucosa, C₆H₁₂O₆', rq: rqFromFormula(6, 12, 6) },
  lipido: { id: 'lipido', name: 'Lípidos', example: 'trioleína, C₅₇H₁₀₄O₆', rq: rqFromFormula(57, 104, 6) },
  // Valor promedio de la oxidación de proteínas con el nitrógeno excretado como urea (Lusk; Frayn, 1983).
  proteina: { id: 'proteina', name: 'Proteínas', example: 'proteína promedio (N → urea)', rq: 0.8 },
};

export interface SampleInfo {
  id: SampleId;
  name: string;
  short: string;
  reserve: string;
  substrate: SubstrateId;
  /** Consumo de O₂ a 25 °C (µL O₂ por gramo de semilla embebida y por hora). 0: tejido muerto. */
  r25: number;
  alive: boolean;
  /** Color del tegumento para el dibujo. */
  color: string;
}

/** Valores ilustrativos del orden de los publicados para semillas en germinación (24–72 h de imbibición). */
export const SAMPLES: SampleInfo[] = [
  { id: 'maiz', name: 'Semillas de maíz en germinación (reserva de almidón)', short: 'Maíz', reserve: 'almidón', substrate: 'carbohidrato', r25: 120, alive: true, color: '#e8b923' },
  { id: 'mani', name: 'Semillas de maní en germinación (reserva de aceite)', short: 'Maní', reserve: 'aceite (triglicéridos)', substrate: 'lipido', r25: 110, alive: true, color: '#c98f5a' },
  { id: 'hervido', name: 'Semillas de maíz hervidas (control negativo)', short: 'Maíz hervido', reserve: 'almidón', substrate: 'carbohidrato', r25: 0, alive: false, color: '#ead9a4' },
];

export const ATMOSPHERES: { id: Atmosphere; name: string }[] = [
  { id: 'aire', name: 'Aire (21 % de O₂)' },
  { id: 'n2', name: 'Nitrógeno (anoxia)' },
];

export const RESP_LIMITS = {
  temperature: [5, 50] as [number, number], // °C del baño
  mass: [0.5, 5] as [number, number], // g de semillas por tubo
  minutes: [5, 30] as [number, number], // duración de la medición
};

/** Coeficiente de temperatura de la respiración (por cada 10 °C). */
export const Q10 = 2;
export const T_REF = 25;
/** Temperatura de semidesnaturalización (°C) y anchura de la transición (°C) de las enzimas respiratorias, para ensayos de pocos minutos. */
export const T_HALF = 40;
export const T_WIDTH = 2;
/** Efecto Pasteur: en anoxia el flujo glucolítico (hexosas/h) aumenta este factor respecto al aerobio. */
export const PASTEUR = 2;
/** Volumen de gas de cada tubo (µL), igualado con perlas de vidrio. */
export const HEADSPACE = 15000;
/** Diámetro interno del capilar (mm) y área de su sección (mm² = µL por mm de desplazamiento). */
export const CAPILLARY_DIAMETER = 2;
export const CAPILLARY_AREA = Math.PI * (CAPILLARY_DIAMETER / 2) ** 2;
/** Escala del capilar (mm): 0 es la posición inicial de la gota; positivo hacia el tubo. */
export const CAPILLARY_SCALE = [-150, 250] as [number, number];
/** Resolución de la lectura de la gota (mm): media división de la escala milimétrica. */
export const CAPILLARY_RES = 0.5;
/** Ficha del instrumento (misma forma que src/labs/instruments.ts). */
export const CAPILLARY_INSTRUMENT = {
  id: 'capilar', name: 'Manómetro capilar con escala milimétrica (Ø 2,0 mm)', quantity: 'Desplazamiento de la gota', unit: 'mm',
  resolution: CAPILLARY_RES, sigma: 0.4,
  note: 'Paralaje al leer el borde de la gota, adherencia de la gota al vidrio y pequeñas fugas en los tapones.',
};
/** Deriva del baño termostatado (°C por hora): calienta el gas de los tres tubos por igual. */
export const BATH_DRIFT = 0.2;
/** Presión atmosférica (kPa) en Urabá. */
export const PRESSURE = 101.325;
/** Azul de bromotimol en NaHCO₃ 0,5 mmol/L; pKa₁ del ácido carbónico y constante de Henry del CO₂ (25 °C). */
export const BTB_BICARBONATE = 5e-4; // mol/L
export const PKA1 = 6.35;
export const KH_CO2 = 0.034; // mol/(L·atm)
export const AIR_CO2 = 0.0004; // fracción molar de CO₂ en el aire
/** Energía libre estándar (kJ/mol) para eficiencias: oxidación de glucosa, fermentación alcohólica e hidrólisis del ATP. */
export const DG_GLUCOSE = 2870;
export const DG_FERMENTATION = 235;
export const DG_ATP = 30.5;

export function findSample(id: string): SampleInfo {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) throw new Error(`Muestra desconocida: ${id}`);
  return s;
}

/** Fracción de enzimas en estado nativo (equilibrio de desnaturalización durante el ensayo). */
export function nativeFraction(tempC: number): number {
  return 1 / (1 + Math.exp((tempC - T_HALF) / T_WIDTH));
}

/** Factor de temperatura relativo a 25 °C: Q₁₀ por la desnaturalización. Vale 1 a 25 °C. */
export function temperatureFactor(tempC: number): number {
  assertInRange('La temperatura', tempC, ...RESP_LIMITS.temperature);
  return Q10 ** ((tempC - T_REF) / 10) * (nativeFraction(tempC) / nativeFraction(T_REF));
}

/** Temperatura óptima del modelo (búsqueda con paso de 0,01 °C). */
export function optimalTemperature(): number {
  let best = RESP_LIMITS.temperature[0], bestV = -Infinity;
  for (let t = RESP_LIMITS.temperature[0]; t <= RESP_LIMITS.temperature[1] + 1e-9; t += 0.01) {
    const v = temperatureFactor(Math.min(t, RESP_LIMITS.temperature[1]));
    if (v > bestV) { bestV = v; best = t; }
  }
  return Math.round(best * 100) / 100;
}

/** Q₁₀ calculado a partir de dos tasas medidas a T₁ y T₂: (r₂/r₁)^(10/(T₂ − T₁)). */
export function q10From(r1: number, r2: number, t1: number, t2: number): number {
  if (!(r1 > 0) || !(r2 > 0)) throw new RangeError('Las tasas deben ser positivas.');
  if (t1 === t2) throw new RangeError('Las temperaturas deben ser distintas.');
  return (r2 / r1) ** (10 / (t2 - t1));
}

/** Tasas de intercambio de gases (µL por gramo y por hora) a la temperatura del baño. */
export function gasRates(sampleId: SampleId, atmosphere: Atmosphere, tempC: number): { o2: number; co2: number; hexose: number; fermentation: boolean } {
  const s = findSample(sampleId);
  const base = s.r25 * temperatureFactor(tempC);
  if (atmosphere === 'aire') {
    // Respiración aerobia; si el sustrato es un carbohidrato, cada hexosa consume 6 O₂.
    return { o2: base, co2: base * SUBSTRATES[s.substrate].rq, hexose: s.substrate === 'carbohidrato' ? base / 6 : 0, fermentation: false };
  }
  // Anoxia: glucólisis + fermentación alcohólica de los azúcares solubles (C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂).
  const hexose = (PASTEUR * base) / 6;
  return { o2: 0, co2: 2 * hexose, hexose, fermentation: true };
}

/** Cantidad de gas (µmol) que ocupa V µL a la temperatura del baño y 101,3 kPa (gas ideal). */
export function gasMicromoles(volumeUL: number, tempC: number): number {
  return (PRESSURE * 1000 * volumeUL * 1e-9) / (R_GAS * celsiusToKelvin(tempC)) * 1e6;
}

/** Volumen de dilatación del gas de un tubo (µL) por la deriva del baño en t minutos. */
export function driftVolume(tempC: number, minutes: number): number {
  return (HEADSPACE * BATH_DRIFT * (minutes / 60)) / celsiusToKelvin(tempC);
}

/** pH del azul de bromotimol (NaHCO₃ 0,5 mmol/L) en equilibrio con una fracción molar de CO₂ dada. */
export function indicatorPH(co2Fraction: number): number {
  const x = Math.max(1e-6, co2Fraction);
  return PKA1 + Math.log10(BTB_BICARBONATE / (KH_CO2 * x * (PRESSURE / 101.325)));
}

export type IndicatorColor = 'azul' | 'verde' | 'amarillo';
/** Color del azul de bromotimol (vira de azul, pH > 7,3, a amarillo, pH < 6,3). */
export function indicatorColor(pH: number): IndicatorColor {
  if (pH > 7.3) return 'azul';
  if (pH >= 6.3) return 'verde';
  return 'amarillo';
}

/** Lectura de la gota en la escala (mm, resolución 0,5 mm); null si se sale de la escala del capilar. */
export function capillaryReading(displacement: number): number | null {
  if (!Number.isFinite(displacement) || displacement < CAPILLARY_SCALE[0] || displacement > CAPILLARY_SCALE[1]) return null;
  const r = roundToResolution(displacement, CAPILLARY_RES);
  return Object.is(r, -0) ? 0 : r;
}

/* ------------------------------------------------------------------ balance de ATP */

export interface ElectronCounts {
  /** ATP o GTP por fosforilación a nivel de sustrato. */
  substrateLevel: number;
  /** NADH producido dentro de la mitocondria. */
  nadhMito: number;
  /** NADH citosólico (glucólisis): entra por una lanzadera. */
  nadhCyto: number;
  /** FADH₂ (ubiquinol) de la succinato deshidrogenasa y la β-oxidación. */
  fadh2: number;
  /** ATP invertido en la activación (ácidos grasos, glicerol). */
  activation: number;
  /** O₂ consumido por mol de sustrato. */
  o2: number;
}

/** Glucosa: glucólisis (2 ATP, 2 NADH citosólicos), piruvato deshidrogenasa (2 NADH) y ciclo de Krebs (2 GTP, 6 NADH, 2 FADH₂). */
export const GLUCOSE_COUNTS: ElectronCounts = { substrateLevel: 4, nadhMito: 8, nadhCyto: 2, fadh2: 2, activation: 0, o2: 6 };
/**
 * Trioleína (aceite de maní): 3 oleatos (β-oxidación: 8 NADH, 7 FADH₂ —el doble enlace se salta un paso—, 9 acetil-CoA;
 * activación 2 ATP cada uno) + glicerol (−1 ATP, 2 NADH citosólicos, 2 ATP y 1 NADH en la glucólisis baja, Krebs).
 */
export const TRIOLEIN_COUNTS: ElectronCounts = { substrateLevel: 30, nadhMito: 109, nadhCyto: 2, fadh2: 49, activation: 7, o2: 80 };

export const P_O: Record<Accounting, { nadh: number; fadh2: number }> = {
  moderna: { nadh: 2.5, fadh2: 1.5 },
  clasica: { nadh: 3, fadh2: 2 },
};

export interface AtpBreakdown { substrateLevel: number; fromNadhMito: number; fromNadhCyto: number; fromFadh2: number; activation: number; total: number; perO2: number; }

/** ATP por mol de sustrato con una contabilidad P/O y una lanzadera del NADH citosólico. */
export function atpBreakdown(c: ElectronCounts, shuttle: Shuttle, accounting: Accounting): AtpBreakdown {
  const po = P_O[accounting];
  const cyto = shuttle === 'malato' ? po.nadh : po.fadh2; // la lanzadera de glicerol-3-fosfato entrega los electrones a la ubiquinona
  const fromNadhMito = c.nadhMito * po.nadh, fromNadhCyto = c.nadhCyto * cyto, fromFadh2 = c.fadh2 * po.fadh2;
  const total = c.substrateLevel - c.activation + fromNadhMito + fromNadhCyto + fromFadh2;
  return { substrateLevel: c.substrateLevel, fromNadhMito, fromNadhCyto, fromFadh2, activation: c.activation, total, perO2: total / c.o2 };
}

/** ATP por glucosa en respiración aerobia: 32 o 30 (moderna) y 38 o 36 (clásica). */
export const atpPerGlucoseAerobic = (shuttle: Shuttle, accounting: Accounting) => atpBreakdown(GLUCOSE_COUNTS, shuttle, accounting).total;
/** ATP neto por glucosa en la fermentación (solo glucólisis). */
export const ATP_FERMENTATION = 2;

/** ATP por molécula de O₂ consumida según el sustrato oxidado (null para proteínas: no se modela). */
export function atpPerO2(substrate: SubstrateId, shuttle: Shuttle, accounting: Accounting): number | null {
  if (substrate === 'carbohidrato') return atpBreakdown(GLUCOSE_COUNTS, shuttle, accounting).perO2;
  if (substrate === 'lipido') return atpBreakdown(TRIOLEIN_COUNTS, shuttle, accounting).perO2;
  return null;
}

/* ------------------------------------------------------------------ simulación del respirómetro */

export interface RespInput {
  sample: SampleId;
  atmosphere: Atmosphere;
  temperature: number; // °C
  mass: number; // g
  minutes: number; // min
}

export interface TubeDisplacements { a: number; b: number; c: number; }

export interface RespModel {
  sample: SampleInfo;
  atmosphere: Atmosphere;
  temperature: number; mass: number; minutes: number;
  tempFactor: number;
  /** Tasas del modelo (µL·g⁻¹·h⁻¹). */
  rateO2: number; rateCO2: number;
  /** Volúmenes de gas del modelo en la medición (µL). */
  vO2: number; vCO2: number; vDrift: number;
  /** Desplazamientos verdaderos de las gotas (mm, positivo hacia el tubo). */
  displacement: TubeDisplacements;
  /** Fracción de CO₂ en el tubo B al final y estado del indicador. */
  co2FractionB: number;
  indicatorPH: number;
  indicator: IndicatorColor;
}

export function respirometerModel(input: RespInput): RespModel {
  const sample = findSample(input.sample);
  if (input.atmosphere !== 'aire' && input.atmosphere !== 'n2') throw new Error(`Atmósfera desconocida: ${input.atmosphere}`);
  assertInRange('La temperatura', input.temperature, ...RESP_LIMITS.temperature);
  assertInRange('La masa de semillas', input.mass, ...RESP_LIMITS.mass);
  assertInRange('La duración', input.minutes, ...RESP_LIMITS.minutes);
  const { temperature: T, mass, minutes } = input;
  const rates = gasRates(sample.id, input.atmosphere, T);
  const hours = minutes / 60;
  const vO2 = rates.o2 * mass * hours, vCO2 = rates.co2 * mass * hours;
  const vDrift = driftVolume(T, minutes);
  const A = CAPILLARY_AREA;
  // El gas que desaparece del tubo hala la gota hacia él (positivo); la dilatación térmica la empuja hacia afuera.
  const displacement = { a: (vO2 - vDrift) / A, b: (vO2 - vCO2 - vDrift) / A, c: -vDrift / A };
  const co2FractionB = AIR_CO2 * (input.atmosphere === 'aire' ? 1 : 0) + vCO2 / HEADSPACE;
  const pH = indicatorPH(co2FractionB);
  return {
    sample, atmosphere: input.atmosphere, temperature: T, mass, minutes, tempFactor: temperatureFactor(T),
    rateO2: rates.o2, rateCO2: rates.co2, vO2, vCO2, vDrift, displacement, co2FractionB, indicatorPH: pH, indicator: indicatorColor(pH),
  };
}

/** Lecturas ideales (sin ruido) de las tres gotas. */
export function idealReadings(m: RespModel): { a: number | null; b: number | null; c: number | null } {
  return { a: capillaryReading(m.displacement.a), b: capillaryReading(m.displacement.b), c: capillaryReading(m.displacement.c) };
}

export interface RespAnalysis {
  /** Lecturas corregidas con el termobarómetro (mm). */
  corrA: number | null; corrB: number | null;
  /** Volúmenes calculados desde las lecturas (µL). */
  vO2: number | null; vCO2: number | null;
  /** Tasa de consumo de O₂ (µL·g⁻¹·h⁻¹) y de producción de CO₂. */
  rateO2: number | null; rateCO2: number | null;
  /** Cociente respiratorio; null si el O₂ consumido es demasiado pequeño para calcularlo (< 2 mm). */
  rq: number | null;
  o2Umol: number | null; co2Umol: number | null;
  /** Glucosa usada (µmol), ATP producido (µmol), ATP por glucosa y eficiencia estándar. */
  glucoseUmol: number | null; atpUmol: number | null; atpPerGlucose: number | null; efficiency: number | null;
  /** Vía que dominó el balance. */
  pathway: 'aerobia' | 'fermentacion' | 'ninguna';
}

/** Mínimo desplazamiento corregido (mm) para calcular el CR con sentido (cuatro veces la resolución). */
export const MIN_RQ_DISPLACEMENT = 2;

/**
 * Análisis a partir de las lecturas (lo que el estudiante calcula): corrección con el termobarómetro,
 * volúmenes, tasas, CR y balance de ATP. Las lecturas pueden venir del modo ideal o del modo real.
 */
export function analyzeReadings(
  readings: { a: number | null; b: number | null; c: number | null },
  ctx: { sample: SampleId; atmosphere: Atmosphere; temperature: number; mass: number; minutes: number; shuttle: Shuttle; accounting: Accounting },
): RespAnalysis {
  const s = findSample(ctx.sample);
  const A = CAPILLARY_AREA, hours = ctx.minutes / 60;
  const corrA = readings.a === null || readings.c === null ? null : roundToResolution(readings.a - readings.c, CAPILLARY_RES);
  const corrB = readings.b === null || readings.c === null ? null : roundToResolution(readings.b - readings.c, CAPILLARY_RES);
  const vO2 = corrA === null ? null : Math.max(0, corrA) * A;
  const vCO2 = corrA === null || corrB === null ? null : Math.max(0, corrA - corrB) * A;
  const per = (v: number | null) => (v === null ? null : v / (ctx.mass * hours));
  const rq = corrA !== null && corrB !== null && corrA >= MIN_RQ_DISPLACEMENT ? (corrA - corrB) / corrA : null;
  const o2Umol = vO2 === null ? null : gasMicromoles(vO2, ctx.temperature);
  const co2Umol = vCO2 === null ? null : gasMicromoles(vCO2, ctx.temperature);
  let glucoseUmol: number | null = null, atpUmol: number | null = null, atpPerGlucose: number | null = null, efficiency: number | null = null;
  let pathway: RespAnalysis['pathway'] = 'ninguna';
  if (ctx.atmosphere === 'aire' && o2Umol !== null && corrA !== null && corrA >= MIN_RQ_DISPLACEMENT) {
    pathway = 'aerobia';
    const perO2 = atpPerO2(s.substrate, ctx.shuttle, ctx.accounting)!;
    atpUmol = o2Umol * perO2;
    if (s.substrate === 'carbohidrato') {
      glucoseUmol = o2Umol / 6;
      atpPerGlucose = atpPerGlucoseAerobic(ctx.shuttle, ctx.accounting);
      efficiency = (atpPerGlucose * DG_ATP) / DG_GLUCOSE;
    }
  } else if (ctx.atmosphere === 'n2' && co2Umol !== null && corrA !== null && corrB !== null && corrA - corrB >= MIN_RQ_DISPLACEMENT) {
    pathway = 'fermentacion';
    glucoseUmol = co2Umol / 2;
    atpUmol = glucoseUmol * ATP_FERMENTATION;
    atpPerGlucose = ATP_FERMENTATION;
    efficiency = (ATP_FERMENTATION * DG_ATP) / DG_FERMENTATION;
  } else if (corrA !== null && corrB !== null) {
    atpUmol = 0;
  }
  return { corrA, corrB, vO2, vCO2, rateO2: per(vO2), rateCO2: per(vCO2), rq, o2Umol, co2Umol, glucoseUmol, atpUmol, atpPerGlucose, efficiency, pathway };
}

/** Curvas de O₂ consumido y CO₂ producido (µL) a lo largo de la medición, cada minuto (modelo). */
export function gasTimeSeries(m: RespModel): { t: number; o2: number; co2: number }[] {
  const out: { t: number; o2: number; co2: number }[] = [];
  const steps = Math.round(m.minutes);
  for (let i = 0; i <= steps; i++) {
    const t = (m.minutes * i) / steps;
    out.push({ t, o2: m.rateO2 * m.mass * (t / 60), co2: m.rateCO2 * m.mass * (t / 60) });
  }
  return out;
}

export const respirationModelSpec: ModelSpec = {
  name: 'Respirómetro volumétrico de tres tubos: consumo de O₂, cociente respiratorio y balance de ATP',
  inputs: [
    { symbol: 'muestra', name: 'Material en los tubos A y B (maíz o maní en germinación, maíz hervido)', unit: '—', initial: 'maíz en germinación' },
    { symbol: 'atm', name: 'Atmósfera de los tubos (aire o nitrógeno)', unit: '—', initial: 'aire' },
    { symbol: 'T', name: 'Temperatura del baño', unit: '°C', range: RESP_LIMITS.temperature, initial: 25 },
    { symbol: 'm', name: 'Masa de semillas por tubo', unit: 'g', range: RESP_LIMITS.mass, initial: 3 },
    { symbol: 't', name: 'Duración de la medición', unit: 'min', range: RESP_LIMITS.minutes, initial: 20 },
    { symbol: 'P/O', name: 'Contabilidad del ATP (moderna 2,5/1,5 o clásica 3/2) y lanzadera del NADH citosólico', unit: '—', initial: 'moderna, malato-aspartato' },
  ],
  outputs: [
    { symbol: 'd_A, d_B, d_C', name: 'Desplazamiento de las gotas (KOH, agua, termobarómetro)', unit: 'mm' },
    { symbol: 'V_O₂, V_CO₂', name: 'O₂ consumido y CO₂ producido', unit: 'µL' },
    { symbol: 'r_O₂', name: 'Tasa de consumo de O₂', unit: 'µL·g⁻¹·h⁻¹' },
    { symbol: 'CR', name: 'Cociente respiratorio CO₂/O₂', unit: '—' },
    { symbol: 'ATP', name: 'ATP producido y ATP por glucosa', unit: 'µmol' },
    { symbol: 'pH', name: 'pH y color del azul de bromotimol del tubo B', unit: '—' },
  ],
  equations: [
    'C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O  (CR = 1,00)',
    'C₅₇H₁₀₄O₆ + 80 O₂ → 57 CO₂ + 52 H₂O  (trioleína, CR = 57/80 ≈ 0,71)',
    'CR = C/(C + H/4 − O/2) para CₐHₕOₒ;  proteínas ≈ 0,80 (N excretado como urea)',
    'r_O₂(T) = r₂₅ · Q₁₀^((T − 25)/10) · f_nat(T)/f_nat(25),  f_nat = 1/(1 + e^((T − 40 °C)/2 °C)),  Q₁₀ = 2',
    'Anoxia: C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂ (2 ATP);  flujo de hexosas = 2 · r_O₂/6 (efecto Pasteur)',
    'd = ΔV/A,  A = π·(1,0 mm)² = 3,14 µL/mm;  d corregida = d − d_termobarómetro',
    'V_O₂ = A·d_A;  V_CO₂ = A·(d_A − d_B);  CR = (d_A − d_B)/d_A',
    'n = P·V/(R·T) con P = 101,3 kPa',
    'ATP/glucosa = 4 + 10·(P/O)_NADH + 2·(P/O)_FADH₂ = 32 (malato-aspartato) o 30 (glicerol-fosfato) con 2,5 y 1,5;  38 o 36 con 3 y 2',
    'Eficiencia estándar = ATP·30,5 kJ/mol ÷ 2870 kJ/mol (aerobia) o ÷ 235 kJ/mol (fermentación alcohólica)',
  ],
  initialConditions: ['3,0 g de semillas de maíz en germinación por tubo, aire, baño a 25 °C, medición de 20 min; las tres gotas parten de la marca 0.'],
  assumptions: [
    'Los tres tubos tienen el mismo volumen de gas (15,0 mL), igualado con perlas de vidrio, y están a la temperatura del baño.',
    'El KOH absorbe todo el CO₂ en cuanto se produce; el agua del tubo B (0,5 mL) disuelve una fracción despreciable de CO₂.',
    'El termobarómetro (semillas hervidas) no respira y registra solo la deriva del baño (+0,2 °C por hora), que afecta por igual a los tres tubos.',
    'La tasa respiratoria es constante durante la medición y no depende del O₂ mientras este no baje de ~15 % (en 30 min se consume menos del 20 % del O₂ del tubo).',
    'Cada muestra oxida un único sustrato de reserva: almidón (maíz) o triglicéridos tipo trioleína (maní). En anoxia fermentan sus azúcares solubles.',
    'La temperatura actúa con Q₁₀ = 2 y la desnaturalización se trata como un equilibrio reversible durante ensayos de pocos minutos (óptimo ≈ 36 °C).',
    'El balance de ATP usa relaciones P/O de 2,5 (NADH) y 1,5 (FADH₂), propias de mitocondrias con complejo I y ~4 H⁺ por ATP sintetizado y exportado.',
    'Gas ideal a 101,3 kPa (Urabá, casi al nivel del mar). Las tasas r₂₅ son ilustrativas, del orden de las publicadas para semillas embebidas.',
  ],
  limits: [
    'No representa la oxidasa alternativa ni las NAD(P)H deshidrogenasas alternativas de las plantas, que bajan el rendimiento real de ATP.',
    'En Saccharomyces cerevisiae (levadura) falta el complejo I y aparece el efecto Crabtree: fermenta aun con O₂ y su rendimiento aerobio real es menor (~16–18 ATP por glucosa).',
    'El ATP por glucosa supone glucosa libre (hexocinasa); a partir de almidón por fosforilasa se ahorra 1 ATP por glucosa. Las fugas de protones y el costo de transporte varían entre tejidos.',
    'Las proteínas (CR ≈ 0,8) no se simulan en el respirómetro; las semillas reales usan mezclas de sustratos y su CR cambia durante la germinación.',
    'La desnaturalización real depende del tiempo de exposición: a más de 40 °C la tasa seguiría bajando con los minutos.',
    'La gota se sale de la escala del capilar (−150 a 250 mm) si el cambio de gas supera esos límites.',
  ],
  testCases: [
    'CR teórico: glucosa 1,00, trioleína 0,7125 y tripalmitina 51/72,5 a partir de la fórmula.',
    'ATP por glucosa: 32 y 30 (P/O modernas, malato-aspartato y glicerol-fosfato) y 38 y 36 (clásicas); fermentación, 2.',
    'Balance de pares de electrones: el O₂ consumido es la mitad de los NADH + FADH₂ (glucosa 6, trioleína 80).',
    'Valores calculados a mano para el caso inicial: V_O₂ = 120 µL; gotas 37,0; −1,0 y −1,0 mm; corregida 38,0 mm; CR = 1,00.',
    'Q₁₀ ≈ 2 entre 10 y 20 °C; la tasa tiene un máximo cerca de 36 °C y cae a menos de la mitad del óptimo a 45 °C.',
    'El maíz hervido y la anoxia con KOH no mueven la gota más que el termobarómetro; en anoxia la gota del tubo B se aleja del tubo.',
    'El O₂ consumido es proporcional a la masa y al tiempo; el CR no depende de la temperatura ni de la masa.',
    'El azul de bromotimol pasa de azul a verde y amarillo al acumularse CO₂ en el tubo B.',
    'Las entradas fuera de rango se rechazan.',
  ],
};

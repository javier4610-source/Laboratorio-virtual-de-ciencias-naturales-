import { assertInRange, roundToResolution, seededRandom } from './math';
import { doSaturation, streeterPhelps } from './waterQuality';
import { describe as describeStats, type Stats } from '../lib/measurement';
import { fitModel, type FitResult } from '../lib/fit';
import { fmt } from '../lib/format';
import type { ModelSpec } from './types';

/**
 * Reto de indagación con interpretación de datos (grado 11.º, ambiental).
 *
 * El estudiante elige una pregunta sobre un sistema ambiental de Urabá, diseña el muestreo
 * (niveles de la variable independiente, réplicas, manejo de una variable de confusión, semilla)
 * con un presupuesto limitado de muestras, y recibe DATOS SINTÉTICOS generados por un modelo
 * calculado más un ruido de medición gaussiano con desviación típica declarada.
 *
 * Nada de lo que produce este modelo es una medición real: los parámetros son ilustrativos y
 * plausibles, no datos de ninguna estación, río o finca concretos. La semilla hace que los
 * resultados sean reproducibles: misma semilla + mismo diseño ⇒ mismos datos.
 *
 * Generador: mulberry32 (seededRandom de math.ts); normales por Box–Muller.
 */

/* ------------------------------------------------------------------ sistemas de estudio */

export type SystemId = 'rio' | 'suelo' | 'lluvia';
/** Manejo de la variable de confusión. */
export type ConfoundMode = 'constante' | 'aleatorizado' | 'sin-control';

export interface NoiseSpec {
  /** Desviación típica absoluta (unidades de y). */
  sigma: number;
  /** Desviación típica relativa (fracción del valor verdadero), combinada en cuadratura. */
  relSigma?: number;
  /** Resolución con la que se registra la lectura. */
  resolution: number;
  nonNegative?: boolean;
  note: string;
}

export interface SystemDef {
  id: SystemId;
  name: string;
  question: string;
  /** Tipo de estudio: experimental (el estudiante asigna x) u observacional (elige dónde o cuándo medir). */
  study: 'experimental' | 'observacional';
  x: { key: string; label: string; unit: string; range: [number, number]; step: number; decimals: number };
  y: { key: string; label: string; unit: string; decimals: number };
  /** Variable de confusión que registra el diseño. */
  confound: { key: string; label: string; unit: string; decimals: number; description: Record<ConfoundMode, string> };
  /** Variables que el modelo mantiene fijas (no se pueden cambiar en el reto). */
  fixed: string[];
  /** Nivel de referencia (control): el diseño lo incluye si el mínimo es ≤ refMax. */
  reference: { refMax: number; text: string };
  noise: NoiseSpec;
  /** Mecanismo plausible que conecta x con y (para la reflexión sobre causalidad). */
  mechanism: string;
  /** Ruta de muestreo (para describir el orden secuencial). */
  orderText: string;
}

/** Presupuesto de muestras del reto (cada muestra cuesta 1). */
export const BUDGET = 20;
export const DESIGN_LIMITS = { levels: [2, 8] as [number, number], replicates: [1, 6] as [number, number], seed: [1, 999] as [number, number] };

export const SYSTEMS: Record<SystemId, SystemDef> = {
  rio: {
    id: 'rio', name: 'Río con un vertimiento orgánico',
    question: '¿Cómo cambia el oxígeno disuelto al aumentar la distancia aguas abajo de un vertimiento de aguas residuales?',
    study: 'observacional',
    x: { key: 'distancia', label: 'Distancia aguas abajo del vertimiento', unit: 'km', range: [-2, 30], step: 0.5, decimals: 1 },
    y: { key: 'od', label: 'Oxígeno disuelto', unit: 'mg/L', decimals: 2 },
    confound: {
      key: 'temperatura', label: 'Temperatura del agua', unit: '°C', decimals: 1,
      description: {
        constante: 'Todas las estaciones se miden a las 9:00 (varios equipos a la vez): la temperatura del agua es la misma.',
        aleatorizado: 'Un solo equipo recorre las estaciones entre las 7:00 y las 15:00 en orden aleatorio: el agua se calienta durante el día, pero sin relación con la distancia.',
        'sin-control': 'Un solo equipo baja por el río de 7:00 a 15:00: las estaciones lejanas se miden más tarde, con el agua más caliente.',
      },
    },
    fixed: ['Caudal del río y del vertimiento', 'Carga orgánica del vertimiento', 'Profundidad de toma de la muestra (30 cm)', 'Sensor óptico de oxígeno calibrado'],
    reference: { refMax: -0.5, text: 'una estación de referencia aguas arriba del vertimiento (distancia negativa)' },
    noise: { sigma: 0.15, resolution: 0.01, nonNegative: true, note: 'Variabilidad entre muestras de una misma estación más el error del sensor (σ = 0,15 mg/L, valor ilustrativo).' },
    mechanism: 'las bacterias consumen oxígeno al degradar la materia orgánica del vertimiento más rápido de lo que la superficie lo repone',
    orderText: 'de la estación más cercana a la más lejana',
  },
  suelo: {
    id: 'suelo', name: 'Suelo de una plantación de banano',
    question: '¿Cómo cambia la temperatura del suelo a 5 cm de profundidad al aumentar la cobertura de sombra?',
    study: 'experimental',
    x: { key: 'sombra', label: 'Cobertura de sombra (polisombra)', unit: '%', range: [0, 90], step: 5, decimals: 0 },
    y: { key: 'tempSuelo', label: 'Temperatura del suelo a 5 cm', unit: '°C', decimals: 1 },
    confound: {
      key: 'hora', label: 'Hora de la lectura', unit: 'h', decimals: 2,
      description: {
        constante: 'Todas las parcelas se leen a las 11:00 con varios termómetros a la vez.',
        aleatorizado: 'Un solo estudiante lee las parcelas entre las 7:00 y las 13:00 en orden aleatorio.',
        'sin-control': 'Un solo estudiante lee las parcelas de 7:00 a 13:00, de la menos sombreada a la más sombreada.',
      },
    },
    fixed: ['Tipo de suelo y humedad (sin riego el día de la medición)', 'Profundidad del termómetro (5 cm)', 'Día despejado', 'Tamaño de las parcelas'],
    reference: { refMax: 0, text: 'una parcela testigo a pleno sol (0 % de sombra)' },
    noise: { sigma: 0.5, resolution: 0.1, note: 'Heterogeneidad del suelo entre parcelas más el error del termómetro de suelo (σ = 0,5 °C, valor ilustrativo).' },
    mechanism: 'la sombra reduce la radiación solar que llega al suelo y, por tanto, la energía que lo calienta',
    orderText: 'de la parcela con menos sombra a la de más sombra',
  },
  lluvia: {
    id: 'lluvia', name: 'Quebrada después de un aguacero',
    question: '¿Cómo cambia la turbidez de una quebrada al aumentar la lluvia acumulada en las 24 horas previas?',
    study: 'observacional',
    x: { key: 'lluvia', label: 'Lluvia acumulada en 24 h', unit: 'mm', range: [0, 80], step: 5, decimals: 0 },
    y: { key: 'turbidez', label: 'Turbidez', unit: 'UNT', decimals: 1 },
    confound: {
      key: 'horasDesdeLluvia', label: 'Tiempo desde el fin de la lluvia', unit: 'h', decimals: 1,
      description: {
        constante: 'Cada muestra se toma 4 h después de que termina la lluvia.',
        aleatorizado: 'El momento de muestreo se sortea entre 2 y 12 h después de la lluvia.',
        'sin-control': 'Se muestrea cuando se puede llegar: después de los aguaceros fuertes el camino tarda más en ser transitable.',
      },
    },
    fixed: ['Punto de muestreo en la quebrada', 'Cobertura vegetal de la cuenca', 'Turbidímetro calibrado'],
    reference: { refMax: 0, text: 'días sin lluvia (0 mm) como línea base' },
    noise: { sigma: 1, relSigma: 0.08, resolution: 0.1, nonNegative: true, note: 'Variabilidad entre muestras y del turbidímetro: σ = √(1² + (0,08·turbidez)²) UNT (valores ilustrativos).' },
    mechanism: 'la escorrentía arrastra partículas de suelo hacia la quebrada y estas se sedimentan poco a poco cuando cesa la lluvia',
    orderText: 'de la lluvia más débil a la más fuerte',
  },
};

export const SYSTEM_IDS: SystemId[] = ['rio', 'suelo', 'lluvia'];
export const CONFOUND_LABEL: Record<ConfoundMode, string> = { constante: 'Mantener constante', aleatorizado: 'Aleatorizar', 'sin-control': 'No controlar' };

/* ------------------------------------------------------------------ parámetros de los modelos (ilustrativos) */

/** Río: Streeter–Phelps con parámetros fijos y saturación de Benson–Krause (30 m s. n. m.). */
export const RIVER = { L0: 10, D0: 0.8, kd: 0.5, ka: 1.5, u: 0.25, backgroundDeficit: 0.6, T7: 25.5, warming: 0.35 } as const;
/** Suelo: T_suelo = T_aire(h) + ΔT_sol·(1 − s/100)·I(h). */
export const SOIL = { Tair7: 24, airWarming: 0.8, dTsun: 10 } as const;
/** Quebrada: Turb = B + a·P·e^(−Δt/τ). */
export const CREEK = { base: 6, perMm: 2, tau: 10, constantDelay: 4, delayMin: 2, delayMax: 12, delayPerMm: 0.12 } as const;

/** Temperatura del agua del río según la hora (°C): calentamiento lineal de 0,35 °C/h desde las 7:00. */
export function riverTemperature(hour: number): number {
  assertInRange('La hora', hour, 0, 24);
  return RIVER.T7 + RIVER.warming * (hour - 7);
}

/** Oxígeno disuelto verdadero (mg/L) en el río a x km del vertimiento y temperatura T. */
export function riverOxygen(distanceKm: number, tempC: number): number {
  assertInRange('La distancia', distanceKm, ...SYSTEMS.rio.x.range);
  const cs = doSaturation(tempC);
  const t = distanceKm <= 0 ? 0 : distanceKm / (RIVER.u * 86.4);
  const deficit = distanceKm < 0 ? 0 : streeterPhelps(RIVER.L0, RIVER.D0, RIVER.kd, RIVER.ka, t);
  return Math.max(0, cs - RIVER.backgroundDeficit - deficit);
}

/** Fracción de la radiación solar máxima según la hora: I(h) = sen(π·(h − 6)/12), 0 fuera del día. */
export function irradiance(hour: number): number {
  assertInRange('La hora', hour, 0, 24);
  return Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12));
}

/** Temperatura del aire bajo el dosel (°C): 24 °C a las 7:00 y +0,8 °C/h. */
export function airTemperature(hour: number): number {
  assertInRange('La hora', hour, 0, 24);
  return SOIL.Tair7 + SOIL.airWarming * (hour - 7);
}

/** Temperatura verdadera del suelo a 5 cm (°C) con sombra s (%) a la hora h. */
export function soilTemperature(shadePercent: number, hour: number): number {
  assertInRange('La cobertura de sombra', shadePercent, 0, 100);
  return airTemperature(hour) + SOIL.dTsun * (1 - shadePercent / 100) * irradiance(hour);
}

/** Turbidez verdadera (UNT) con P mm de lluvia, medida Δt horas después del fin de la lluvia. */
export function creekTurbidity(rainMm: number, hoursAfter: number): number {
  assertInRange('La lluvia acumulada', rainMm, 0, 200);
  assertInRange('El tiempo desde la lluvia', hoursAfter, 0, 72);
  return CREEK.base + CREEK.perMm * rainMm * Math.exp(-hoursAfter / CREEK.tau);
}

/** Valor verdadero de y para un sistema dado x y el valor de la variable de confusión. */
export function trueResponse(system: SystemId, x: number, confound: number): number {
  switch (system) {
    case 'rio': return riverOxygen(x, confound);
    case 'suelo': return soilTemperature(x, confound);
    case 'lluvia': return creekTurbidity(x, confound);
  }
}

/* ------------------------------------------------------------------ azar reproducible */

/** Normal estándar por Box–Muller con un generador uniforme dado. */
export function gaussianFrom(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Desviación típica del ruido para un valor verdadero (absoluta y relativa en cuadratura). */
export function noiseSigma(noise: Pick<NoiseSpec, 'sigma' | 'relSigma'>, trueValue: number): number {
  const rel = (noise.relSigma ?? 0) * Math.abs(trueValue);
  return Math.sqrt(noise.sigma ** 2 + rel ** 2);
}

/** Lectura con ruido gaussiano (sin redondear) a partir de un generador. */
export function noisyValue(trueValue: number, noise: NoiseSpec, rng: () => number): number {
  const v = trueValue + noiseSigma(noise, trueValue) * gaussianFrom(rng);
  return noise.nonNegative ? Math.max(0, v) : v;
}

/** Desplazamiento de la semilla por sistema: la misma semilla da datos distintos (pero fijos) en cada sistema. */
const SYSTEM_SALT: Record<SystemId, number> = { rio: 0x51a7, suelo: 0x2c3d, lluvia: 0x7e11 };

/* ------------------------------------------------------------------ diseño y recolección */

export interface Design {
  system: SystemId;
  levels: number;
  min: number;
  max: number;
  replicates: number;
  confound: ConfoundMode;
  seed: number;
}

export interface Sample {
  /** Posición en el orden de muestreo (1, 2, …). */
  order: number;
  levelIndex: number;
  replicate: number;
  x: number;
  /** Valor de la variable de confusión registrado (temperatura, hora o tiempo desde la lluvia). */
  confound: number;
  /** Valor verdadero del modelo (no se muestra al estudiante). */
  trueY: number;
  /** Lectura con ruido, redondeada a la resolución. */
  y: number;
}

/** Niveles equiespaciados entre min y max, redondeados al paso del control. */
export function designLevels(d: Pick<Design, 'system' | 'levels' | 'min' | 'max'>): number[] {
  const sys = SYSTEMS[d.system];
  assertInRange('El número de niveles', d.levels, ...DESIGN_LIMITS.levels);
  assertInRange('El valor mínimo', d.min, ...sys.x.range);
  assertInRange('El valor máximo', d.max, ...sys.x.range);
  if (!(d.max > d.min)) throw new RangeError('El valor máximo debe ser mayor que el mínimo.');
  const out: number[] = [];
  for (let i = 0; i < d.levels; i++) {
    const v = roundToResolution(d.min + ((d.max - d.min) * i) / (d.levels - 1), sys.x.step);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export const sampleCount = (d: Pick<Design, 'levels' | 'replicates'>) => d.levels * d.replicates;

/** Valor de la variable de confusión para una muestra (posición en el orden, fracción de x en el rango). */
function confoundValue(system: SystemId, mode: ConfoundMode, orderFrac: number, x: number, rng: () => number): number {
  switch (system) {
    case 'rio': return riverTemperature(mode === 'constante' ? 9 : 7 + 8 * orderFrac);
    case 'suelo': return mode === 'constante' ? 11 : 7 + 6 * orderFrac;
    case 'lluvia':
      if (mode === 'constante') return CREEK.constantDelay;
      if (mode === 'aleatorizado') return CREEK.delayMin + (CREEK.delayMax - CREEK.delayMin) * rng();
      return CREEK.delayMin + CREEK.delayPerMm * x;
  }
}

/**
 * Genera los datos sintéticos de un diseño. Orden del consumo del generador (para reproducibilidad):
 * 1) si el diseño es aleatorizado, mezcla de Fisher–Yates del orden de muestreo;
 * 2) para cada muestra en ese orden: (solo quebrada aleatorizada) el retraso, y luego el ruido de y.
 */
export function collect(d: Design): Sample[] {
  const sys = SYSTEMS[d.system];
  assertInRange('El número de réplicas', d.replicates, ...DESIGN_LIMITS.replicates);
  assertInRange('La semilla', d.seed, ...DESIGN_LIMITS.seed);
  if (!Number.isInteger(d.seed)) throw new RangeError('La semilla debe ser un número entero.');
  const levels = designLevels(d);
  if (levels.length * d.replicates > BUDGET) throw new RangeError(`El diseño pide ${levels.length * d.replicates} muestras y el presupuesto es de ${BUDGET}.`);
  const rng = seededRandom((d.seed * 2654435761) ^ SYSTEM_SALT[d.system]);
  const plan: { levelIndex: number; replicate: number }[] = [];
  levels.forEach((_, li) => { for (let r = 1; r <= d.replicates; r++) plan.push({ levelIndex: li, replicate: r }); });
  if (d.confound === 'aleatorizado') {
    for (let i = plan.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [plan[i], plan[j]] = [plan[j], plan[i]];
    }
  }
  const n = plan.length;
  return plan.map((p, i) => {
    const x = levels[p.levelIndex];
    const orderFrac = n > 1 ? i / (n - 1) : 0;
    const c = confoundValue(d.system, d.confound, orderFrac, x, rng);
    const trueY = trueResponse(d.system, x, c);
    const y = roundToResolution(noisyValue(trueY, sys.noise, rng), sys.noise.resolution);
    return { order: i + 1, levelIndex: p.levelIndex, replicate: p.replicate, x, confound: roundToResolution(c, 10 ** -sys.confound.decimals), trueY, y };
  });
}

/* ------------------------------------------------------------------ análisis */

/** t de Student bilateral al 95 % para 1 a 30 grados de libertad; 1,96 para más. */
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export function tCritical95(dof: number): number {
  if (!(dof >= 1)) return NaN;
  return dof <= 30 ? T95[Math.floor(dof) - 1] : 1.96;
}

export interface LevelStats extends Stats { x: number; values: number[]; }

/** n, media, DE muestral (n − 1) y error estándar (DE/√n) de cada nivel. */
export function levelStats(samples: Sample[]): LevelStats[] {
  const map = new Map<number, number[]>();
  for (const s of samples) map.set(s.x, [...(map.get(s.x) ?? []), s.y]);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([x, values]) => ({ x, values, ...describeStats(values) }));
}

/** Coeficiente de correlación de Pearson (NaN si alguna variable no varía). */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (sxx <= 1e-12 || syy <= 1e-12) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

export interface InquiryAnalysis {
  n: number;
  levels: LevelStats[];
  fit: FitResult | null;
  slope: number; slopeSe: number; intercept: number; interceptSe: number;
  /** Semiancho del intervalo de 95 % de la pendiente (t·EE). */
  slopeCi95: number;
  r: number; r2: number;
  /** Correlación entre la variable de confusión y x en el diseño ejecutado. */
  confoundR: number;
  /** Correlación entre y y el orden de muestreo. */
  orderR: number;
  /** Ajuste cuadrático (para detectar curvatura) o null. */
  curvature: { A: number; se: number } | null;
}

export function analyze(samples: Sample[]): InquiryAnalysis {
  const xs = samples.map((s) => s.x), ys = samples.map((s) => s.y);
  const lin = fitModel('linear', xs, ys);
  const fit = lin.ok ? lin.fit : null;
  const m = fit?.params.find((p) => p.name === 'm'), b = fit?.params.find((p) => p.name === 'b');
  const quad = new Set(xs).size >= 3 && samples.length >= 4 ? fitModel('quadratic', xs, ys) : null;
  const A = quad && quad.ok ? quad.fit.params.find((p) => p.name === 'A')! : null;
  const r = pearson(xs, ys);
  return {
    n: samples.length,
    levels: levelStats(samples),
    fit,
    slope: m?.value ?? NaN, slopeSe: m?.se ?? NaN,
    intercept: b?.value ?? NaN, interceptSe: b?.se ?? NaN,
    slopeCi95: fit && fit.dof >= 1 && m ? tCritical95(fit.dof) * m.se : NaN,
    r, r2: Number.isFinite(r) ? r * r : NaN,
    confoundR: pearson(xs, samples.map((s) => s.confound)),
    orderR: pearson(samples.map((s) => s.order), ys),
    curvature: A ? { A: A.value, se: A.se } : null,
  };
}

/* ------------------------------------------------------------------ crítica del diseño */

export type CritiqueKind = 'replicas' | 'niveles' | 'rango' | 'confusion' | 'referencia' | 'curvatura' | 'pendiente' | 'presupuesto' | 'aleatorizado';
export interface CritiqueItem { kind: CritiqueKind; severity: 'ok' | 'warn' | 'bad' | 'info'; text: string; }

/** Fracción mínima del intervalo posible que debe cubrir el diseño para no considerarse estrecho. */
export const NARROW_FRACTION = 0.4;

const f = (v: number, d: number) => fmt(v, d).replace('-', '−');

/**
 * Retroalimentación sobre el diseño calculada a partir de las decisiones del estudiante y de sus datos
 * (no son mensajes fijos: cada uno cita los valores de su diseño).
 */
export function critiqueDesign(d: Design, samples: Sample[], a: InquiryAnalysis = analyze(samples)): CritiqueItem[] {
  const sys = SYSTEMS[d.system];
  const out: CritiqueItem[] = [];
  const nLevels = a.levels.length;
  const sds = a.levels.map((l) => l.sd).filter(Number.isFinite);

  if (d.replicates === 1) out.push({ kind: 'replicas', severity: 'bad', text: `Una sola réplica por nivel: no puedes calcular la desviación estándar ni el error estándar de cada nivel, y no sabes cuánto se repetiría cada valor.` });
  else if (d.replicates === 2) out.push({ kind: 'replicas', severity: 'warn', text: `Pocas réplicas (2 por nivel): cada desviación estándar se estima con 1 grado de libertad; en tus datos varía entre ${f(Math.min(...sds), sys.y.decimals)} y ${f(Math.max(...sds), sys.y.decimals)} ${sys.y.unit}, una estimación poco confiable. Con 3 o más réplicas sería más estable.` });
  else out.push({ kind: 'replicas', severity: 'ok', text: `${d.replicates} réplicas por nivel permiten estimar la variabilidad (DE entre ${f(Math.min(...sds), sys.y.decimals)} y ${f(Math.max(...sds), sys.y.decimals)} ${sys.y.unit}).` });

  if (nLevels < 3) out.push({ kind: 'niveles', severity: 'warn', text: `Solo ${nLevels} niveles de «${sys.x.label}»: dos puntos siempre caben en una recta, así que no puedes saber si la relación es lineal o curva.` });

  const span = d.max - d.min, full = sys.x.range[1] - sys.x.range[0];
  const frac = span / full;
  if (frac < NARROW_FRACTION) out.push({ kind: 'rango', severity: 'warn', text: `Rango estrecho: estudias de ${f(d.min, sys.x.decimals)} a ${f(d.max, sys.x.decimals)} ${sys.x.unit}, el ${Math.round(frac * 100)} % del intervalo posible (${f(sys.x.range[0], sys.x.decimals)} a ${f(sys.x.range[1], sys.x.decimals)} ${sys.x.unit}). Un efecto pequeño puede quedar oculto por el ruido y no puedes extrapolar fuera de ese rango.` });

  if (Number.isFinite(a.slope) && Number.isFinite(a.slopeSe) && Math.abs(a.slope) < 2 * a.slopeSe) {
    out.push({ kind: 'pendiente', severity: 'warn', text: `La pendiente (${f(a.slope, 3)} ± ${f(a.slopeSe, 3)} ${sys.y.unit}/${sys.x.unit}) es menor que dos veces su error estándar: con estos datos no se distingue de cero.` });
  }

  const cr = a.confoundR;
  if (d.confound === 'sin-control') {
    out.push(Number.isFinite(cr) && Math.abs(cr) >= 0.5
      ? { kind: 'confusion', severity: 'bad', text: `Variable de confusión sin controlar: la variable «${sys.confound.label}» cambió junto con «${sys.x.label}» (r = ${f(cr, 2)} entre ambas). No puedes separar su efecto del de la variable independiente.` }
      : { kind: 'confusion', severity: 'warn', text: `No controlaste «${sys.confound.label}»; en este diseño casi no se relacionó con x (r = ${f(cr, 2)}), pero eso fue casualidad del diseño, no control.` });
  } else if (d.confound === 'aleatorizado') {
    out.push(Number.isFinite(cr) && Math.abs(cr) >= 0.5
      ? { kind: 'aleatorizado', severity: 'warn', text: `Aleatorizaste, pero por azar «${sys.confound.label}» quedó relacionada con x (r = ${f(cr, 2)}). Con pocas muestras la aleatorización puede fallar: prueba otra semilla o más réplicas.` }
      : { kind: 'aleatorizado', severity: 'info', text: `Aleatorizaste: «${sys.confound.label}» varió sin relación fuerte con x (r = ${Number.isFinite(cr) ? f(cr, 2) : '—'}). Evitas el sesgo sistemático, pero esa variación se suma al ruido.` });
  } else {
    out.push({ kind: 'confusion', severity: 'ok', text: `«${sys.confound.label}» se mantuvo constante (${f(samples[0]?.confound ?? NaN, sys.confound.decimals)} ${sys.confound.unit}) en todas las muestras.` });
  }

  if (d.min > sys.reference.refMax) out.push({ kind: 'referencia', severity: 'warn', text: `Sin nivel de referencia: tu diseño no incluye ${sys.reference.text}, así que no tienes con qué comparar el estado sin perturbación.` });

  if (a.curvature && nLevels >= 3 && Math.abs(a.curvature.A) > 2.5 * a.curvature.se) {
    out.push({ kind: 'curvatura', severity: 'info', text: `Los datos muestran curvatura (término cuadrático ${f(a.curvature.A, 5)} ± ${f(a.curvature.se, 5)}): la recta resume la tendencia, pero la relación no es lineal en todo el rango.` });
  }

  const N = samples.length;
  if (N <= BUDGET / 2) out.push({ kind: 'presupuesto', severity: 'info', text: `Usaste ${N} de ${BUDGET} muestras del presupuesto: podrías agregar réplicas o niveles.` });
  return out;
}

/* ------------------------------------------------------------------ correlación y causalidad */

/** Reflexión calculada: intensidad de la correlación, tipo de estudio y manejo de la confusión. */
export function causalReflection(d: Design, a: InquiryAnalysis): string[] {
  const sys = SYSTEMS[d.system];
  const r = a.r;
  const abs = Math.abs(r);
  const strength = !Number.isFinite(r) ? 'no se puede calcular' : abs >= 0.8 ? 'fuerte' : abs >= 0.5 ? 'moderada' : abs >= 0.3 ? 'débil' : 'muy débil o nula';
  const sign = r < 0 ? 'negativa' : 'positiva';
  const lines: string[] = [];
  lines.push(Number.isFinite(r)
    ? `r = ${f(r, 2)}: asociación lineal ${strength}${abs >= 0.3 ? ` y ${sign}` : ''}; R² = ${f(a.r2, 2)} indica que la recta explica cerca del ${Math.round(a.r2 * 100)} % de la variación de «${sys.y.label}» en tus datos.`
    : 'No se puede calcular r: alguna de las variables no varió.');
  lines.push(sys.study === 'experimental'
    ? `Es un estudio experimental: tú asignaste «${sys.x.label}» a cada parcela. ${d.confound === 'constante' ? 'Con la otra variable constante, es probable que la diferencia se deba a la variable independiente, aunque la conclusión vale para estas condiciones.' : d.confound === 'aleatorizado' ? 'Al aleatorizar el orden, es poco probable que la confusión explique la tendencia, aunque con pocas muestras no se puede descartar.' : 'Pero dejaste sin controlar una variable que cambió junto con x: aun siendo un experimento, la asociación no basta para atribuir el efecto solo a x.'}`
    : `Es un estudio observacional: no asignaste «${sys.x.label}», elegiste dónde o cuándo medir. Otras variables que cambian con x (por ejemplo, «${sys.confound.label}»${Number.isFinite(a.confoundR) ? `, r = ${f(a.confoundR, 2)} con x en tu diseño` : ''}) podrían explicar parte de la asociación: una correlación, por fuerte que sea, no demuestra causalidad por sí sola.`);
  lines.push(`Un mecanismo plausible (${sys.mechanism}) hace más creíble una relación causal, pero la evidencia más sólida vendría de controlar o aleatorizar las variables de confusión y de repetir el estudio.`);
  if (Number.isFinite(a.orderR) && Math.abs(a.orderR) >= 0.5 && d.confound !== 'constante') {
    lines.push(`Ojo: «${sys.y.label}» también se correlaciona con el orden de muestreo (r = ${f(a.orderR, 2)}). Grafica y contra el orden para revisarlo.`);
  }
  return lines;
}

/* ------------------------------------------------------------------ ficha del modelo */

export const inquiryModelSpec: ModelSpec = {
  name: 'Generador de datos sintéticos para un reto de indagación: tres modelos ambientales calculados con ruido gaussiano reproducible',
  inputs: [
    { symbol: 'sistema', name: 'Sistema de estudio (río con vertimiento, suelo bajo sombra o quebrada después de la lluvia)', unit: '—', initial: 'Río con un vertimiento orgánico' },
    { symbol: 'k', name: 'Número de niveles de la variable independiente', unit: '—', range: DESIGN_LIMITS.levels, initial: 3 },
    { symbol: 'x_min, x_max', name: 'Valores mínimo y máximo de la variable independiente', unit: 'km, % o mm', range: [-2, 90], initial: '0 y 10 km' },
    { symbol: 'r', name: 'Réplicas por nivel', unit: '—', range: DESIGN_LIMITS.replicates, initial: 2 },
    { symbol: 'confusión', name: 'Manejo de la variable de confusión (constante, aleatorizada o sin control)', unit: '—', initial: 'No controlar' },
    { symbol: 'semilla', name: 'Semilla del generador pseudoaleatorio', unit: '—', range: DESIGN_LIMITS.seed, initial: 123 },
  ],
  outputs: [
    { symbol: 'yᵢ', name: 'Lecturas sintéticas (oxígeno disuelto, temperatura del suelo o turbidez) con ruido', unit: 'mg/L, °C o UNT' },
    { symbol: 'cᵢ', name: 'Valor registrado de la variable de confusión de cada muestra', unit: '°C, h' },
    { symbol: 'ȳ, s, EE', name: 'Media, desviación estándar muestral y error estándar de cada nivel', unit: 'unidades de y' },
    { symbol: 'm ± EE(m), b ± EE(b), r, R²', name: 'Ajuste lineal por mínimos cuadrados con incertidumbre', unit: '—' },
    { symbol: 'crítica', name: 'Retroalimentación del diseño (réplicas, niveles, rango, confusión, referencia, curvatura)', unit: '—' },
  ],
  equations: [
    'Niveles: xⱼ = x_min + (x_max − x_min)·j/(k − 1), j = 0…k − 1; N = k·r ≤ 20 muestras.',
    'Ruido: yᵢ = f(xᵢ, cᵢ) + σ·zᵢ, zᵢ ~ N(0, 1) por Box–Muller con mulberry32(semilla); σ = √(σ_abs² + (σ_rel·f)²).',
    'Río: OD = C_s(T) − 0,6 − D(t), D(t) = k_d·L₀/(k_a − k_d)·(e^(−k_d t) − e^(−k_a t)) + D₀·e^(−k_a t), t = x/(0,25 m/s); L₀ = 10 mg/L, D₀ = 0,8 mg/L, k_d = 0,5 d⁻¹, k_a = 1,5 d⁻¹; T = 25,5 + 0,35·(h − 7) °C; σ = 0,15 mg/L.',
    'Suelo: T_s = 24 + 0,8·(h − 7) + 10·(1 − s/100)·sen(π(h − 6)/12) °C; σ = 0,5 °C.',
    'Quebrada: Turb = 6 + 2·P·e^(−Δt/10 h) UNT; σ = √(1² + (0,08·Turb)²) UNT.',
    'Estadística por nivel: ȳ = Σyᵢ/n; s = √(Σ(yᵢ − ȳ)²/(n − 1)); EE = s/√n.',
    'Ajuste lineal: EE(m) = √(s²·n/(nΣx² − (Σx)²)), s² = Σresiduos²/(N − 2); IC 95 % = m ± t₀,₀₂₅;N−2·EE(m).',
    'r de Pearson = Σ(x − x̄)(y − ȳ)/√(Σ(x − x̄)²·Σ(y − ȳ)²).',
  ],
  initialConditions: [
    'Río con vertimiento; 3 niveles entre 0 y 10 km; 2 réplicas; variable de confusión sin controlar; semilla 123 (un primer diseño para mejorar).',
    'Presupuesto de 20 muestras por campaña.',
  ],
  assumptions: [
    'TODOS LOS DATOS SON SINTÉTICOS: los genera un modelo calculado con parámetros ilustrativos. No son mediciones de ningún río, finca o quebrada reales de Urabá ni de ninguna entidad.',
    'El ruido es gaussiano, independiente entre muestras y con la desviación típica declarada para cada sistema; representa la variabilidad entre muestras y el error del instrumento.',
    'Cada sistema tiene una sola variable de confusión explícita (temperatura del agua, hora de lectura o tiempo desde la lluvia); en la realidad hay muchas más.',
    'Río: Streeter–Phelps con caudal, velocidad y carga constantes; la temperatura solo cambia la saturación de oxígeno (no las constantes de velocidad).',
    'Suelo: la temperatura del suelo sigue a la del aire más un calentamiento solar proporcional a la radiación que atraviesa la sombra; sin retraso térmico del suelo.',
    'Quebrada: la turbidez sube en proporción a la lluvia y decae exponencialmente después; no se modela la intensidad de la lluvia ni el uso del suelo de la cuenca.',
    'La misma semilla con el mismo diseño reproduce exactamente los mismos datos.',
  ],
  limits: [
    'Los parámetros son plausibles pero no calibrados con datos reales: las conclusiones son sobre el método de indagación, no sobre un lugar concreto.',
    'La aproximación lineal es solo un resumen: el oxígeno del río tiene un mínimo cerca de 20 km y la turbidez puede no ser lineal con la lluvia real.',
    'El intervalo de confianza supone residuos independientes y normales con varianza constante; en la quebrada la varianza crece con la turbidez.',
    'La crítica del diseño usa reglas explícitas (p. ej., rango < 40 % del intervalo posible, |r| ≥ 0,5 entre confusión y x); son orientaciones, no reglas universales.',
    'Las lecturas negativas de oxígeno o turbidez se recortan a 0, lo que sesga un poco la media cerca de cero.',
  ],
  testCases: [
    'Determinismo: la misma semilla y el mismo diseño producen datos idénticos; otra semilla produce datos distintos.',
    'Estadística calculada a mano: media, desviación estándar muestral y error estándar de un conjunto pequeño.',
    'Ajuste lineal: pendiente, intercepto y sus errores estándar coinciden con el cálculo a mano.',
    'La desviación típica del ruido sobre 20 000 muestras coincide con σ declarada (±3 %), también la relativa de la quebrada.',
    'La crítica se activa con 1 o 2 réplicas, con 2 niveles, con rango estrecho, sin nivel de referencia y con la confusión sin controlar (r confusión–x ≥ 0,5).',
    'Modelos: el oxígeno baja aguas abajo (mínimo cerca de 20 km), la sombra enfría el suelo y la turbidez crece con la lluvia.',
    'Validación de rangos y del presupuesto de 20 muestras.',
  ],
};

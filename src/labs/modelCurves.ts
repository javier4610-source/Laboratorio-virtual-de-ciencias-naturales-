import type { TrialValue } from '../core/types';
import { ALL_SAMPLES, WATER_DENSITY } from '../models/density';
import { SURFACES, simulateCart, TRACK_LENGTH } from '../models/newton';
import { INITIAL as GAS_INITIAL, molesInSyringe } from '../models/gases';
import { celsiusToKelvin, R_GAS } from '../models/math';
import { exactPeriod, PLACES } from '../models/pendulum';
import { SPHERES, simulateShot } from '../models/projectile';
import { ROPES, ropeSpeed, soundSpeedAir } from '../models/waves';
import { MEDIA, refract } from '../models/optics';
import { simulateTrack } from '../models/energy';
import { stateAt } from '../models/kinematics';
import { CV_ORIFICE, jet, manometerRise, membraneGauge, RHO_MANOMETER, G as G_PRESSURE } from '../models/pressure';
import { simulateKinetics, type Catalyst } from '../models/kinetics';

/**
 * Curvas del modelo para el cuaderno (U6): para un conjunto de datos, la predicción y(x) del modelo
 * ideal (sin ruido ni resolución de los instrumentos) con las demás variables de entrada fijas.
 *
 * Cada conjunto declara `predict(entradas, parámetros)` → columnas numéricas que el modelo calcula y, si una
 * columna graficable en x no es una entrada directa (p. ej. 1/V o sen θ), cómo convertir ese valor en entradas.
 * Información pura (sin React): se prueba con Vitest y la comparten el cuaderno y el informe.
 */
export type Inputs = Record<string, TrialValue>;
export type Params = Record<string, number | undefined>;

export interface CurveModel {
  /** Nombre corto para la leyenda (p. ej. «m = ρ·V»). */
  name: string;
  /** Descripción breve del modelo que genera la curva. */
  description: string;
  /** Columnas de entrada que fijan las condiciones (además de x). */
  inputs: string[];
  predict: (inp: Inputs, p: Params) => Record<string, number> | null;
  /** Columnas de x que no son entradas directas: cómo se traduce el valor de x en entradas (null: no aplica). */
  xMap?: Record<string, (x: number, inp: Inputs, p: Params) => Inputs | null>;
}

const num = (v: TrialValue | undefined): number => (typeof v === 'number' ? v : NaN);
const byName = <T extends { name: string }>(list: T[], v: TrialValue | undefined) => list.find((x) => x.name === v);
/** Ejecuta un modelo que valida rangos: fuera del rango del laboratorio la curva se corta (NaN). */
const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/* ------------------------------------------------------------------ densidad */

const densityFraction = (inp: Inputs) => {
  const mat = byName(ALL_SAMPLES, inp.material);
  if (!mat) return null;
  const floats = mat.density < WATER_DENSITY;
  const pushed = typeof inp.flota === 'string' && inp.flota.includes('alfiler');
  return { rho: mat.density, frac: floats && !pushed ? mat.density / WATER_DENSITY : 1 };
};

const density: CurveModel = {
  name: 'm = ρ·V',
  description: 'm = ρ·V con la densidad de tabla del material; V desplazado = fracción sumergida · a³.',
  inputs: ['material', 'lado', 'vi'],
  predict: (inp) => {
    const d = densityFraction(inp);
    const a = num(inp.lado);
    if (!d || !(a > 0)) return null;
    const V = a ** 3, m = d.rho * V, vdesp = V * d.frac;
    return { lado: a, vgeo: V, masa: m, vdesp, vf: num(inp.vi) + vdesp, densidad: m / vdesp };
  },
  xMap: {
    vgeo: (x) => ({ lado: Math.cbrt(x) }),
    vdesp: (x, inp) => { const d = densityFraction(inp); return d ? { lado: Math.cbrt(x / d.frac) } : null; },
    masa: (x, inp) => { const d = densityFraction(inp); return d ? { lado: Math.cbrt(x / d.rho) } : null; },
  },
};

/* ------------------------------------------------------------------ segunda ley de Newton */

const newton: CurveModel = {
  name: 'a = (F − μ·m·g)/m',
  description: 'a = (F − μ_k·m·g)/m si F supera la fricción estática; t = √(2d/a) en d = 1,00 m.',
  inputs: ['superficie', 'masa', 'fuerza'],
  predict: (inp, p) => {
    const s = byName(SURFACES, inp.superficie);
    if (!s) return null;
    const r = safe(() => simulateCart({ mass: num(inp.masa), force: num(inp.fuerza), surfaceId: s.id, g: p.g }));
    if (!r) return null;
    return {
      aMedida: r.acceleration, friccion: r.friction, inversoMasa: 1 / num(inp.masa),
      tiempo: r.moves ? Math.sqrt((2 * TRACK_LENGTH) / r.acceleration) : NaN,
    };
  },
  xMap: { inversoMasa: (x) => ({ masa: 1 / x }) },
};

/* ------------------------------------------------------------------ gases */

const LAW_BY_TEXT = (t: TrialValue | undefined) =>
  typeof t !== 'string' ? null : t.includes('Boyle') ? 'boyle' : t.includes('Charles') ? 'charles' : t.includes('Gay') ? 'gay-lussac' : null;

const gases: CurveModel = {
  name: 'P·V = n·R·T',
  description: 'Gas ideal en la jeringa: P·V = n·R·T con la variable indicada constante.',
  inputs: ['ley', 'volumen', 'temperatura'],
  predict: (inp, p) => {
    const law = LAW_BY_TEXT(inp.ley);
    if (!law) return null;
    const n = p.n !== undefined ? p.n / 1000 : molesInSyringe();
    let P: number, V: number, T: number;
    if (law === 'boyle') { T = celsiusToKelvin(GAS_INITIAL.temperature); V = num(inp.volumen); P = (n * R_GAS * T) / (V * 1e-6) / 1000; }
    else if (law === 'charles') { T = celsiusToKelvin(num(inp.temperatura)); P = p.pext ?? GAS_INITIAL.pressure; V = ((n * R_GAS * T) / (P * 1000)) * 1e6; }
    else { T = celsiusToKelvin(num(inp.temperatura)); V = GAS_INITIAL.volume; P = (n * R_GAS * T) / (V * 1e-6) / 1000; }
    if (!(V > 0) || !(T > 0)) return null;
    return { presion: P, volumen: V, temperatura: T - 273.15, temperaturaK: T, inversoV: 1 / V, pv: P * V };
  },
  xMap: {
    inversoV: (x, inp) => (LAW_BY_TEXT(inp.ley) === 'boyle' ? { volumen: 1 / x } : null),
    temperaturaK: (x, inp) => (LAW_BY_TEXT(inp.ley) === 'boyle' ? null : { temperatura: x - 273.15 }),
    volumen: (x, inp, p): Inputs | null => {
      const law = LAW_BY_TEXT(inp.ley);
      if (law === 'boyle') return { volumen: x };
      if (law === 'charles') {
        const n = p.n !== undefined ? p.n / 1000 : molesInSyringe();
        return { temperatura: ((p.pext ?? GAS_INITIAL.pressure) * 1000 * x * 1e-6) / (n * R_GAS) - 273.15 };
      }
      return null;
    },
  },
};

/* ------------------------------------------------------------------ péndulo */

const pendulum: CurveModel = {
  name: 'T = 2π√(L/g) (exacto)',
  description: 'Período exacto del péndulo simple sin amortiguamiento: T = 2π√(L/g) / AGM(1, cos(θ₀/2)).',
  inputs: ['lugar', 'longitud', 'amplitud', 'masa', 'lenteja'],
  predict: (inp) => {
    const place = byName(PLACES, inp.lugar);
    const L = num(inp.longitud), A = num(inp.amplitud);
    if (!place || !(L > 0) || !(A >= 0)) return null;
    const T = exactPeriod(L, place.g, A);
    return { periodo: T, periodo2: T * T, t10: 10 * T, gCalculada: place.g };
  },
};

/* ------------------------------------------------------------------ proyectiles */

const projectile: CurveModel = {
  name: 'tiro parabólico',
  description: 'Tiro parabólico (sin aire) o con arrastre cuadrático (con aire), integrado numéricamente.',
  inputs: ['esfera', 'aire', 'v0', 'angulo', 'altura'],
  predict: (inp, p) => {
    const sphere = byName(SPHERES, inp.esfera);
    if (!sphere) return null;
    const air = typeof inp.aire === 'string' && inp.aire.startsWith('Con');
    const r = safe(() => simulateShot({ v0: num(inp.v0), angle: num(inp.angulo), height: num(inp.altura), sphereId: sphere.id, air, g: p.g }));
    if (!r) return null;
    return { alcance: r.range, alturaMax: r.maxHeight, tiempo: r.flightTime };
  },
};

/* ------------------------------------------------------------------ ondas */

const rope: CurveModel = {
  name: 'λ = √(T/μ)/f',
  description: 'Onda en una cuerda: v = √(T/μ), λ = v/f, período = 1/f.',
  inputs: ['cuerda', 'tension', 'frecuencia'],
  predict: (inp) => {
    const r = byName(ROPES, inp.cuerda);
    const T = num(inp.tension), f = num(inp.frecuencia);
    if (!r || !(T > 0)) return null;
    const v = ropeSpeed(T, r.mu);
    return { rapidez: v, lambda: v / f, lambdaMedida: v / f, periodo: 1 / f };
  },
};

const sound: CurveModel = {
  name: 'λ = v(T)/f',
  description: 'Sonido en el aire: v = 331,3 + 0,606·T (m/s), λ = v/f.',
  inputs: ['temperatura', 'frecuencia'],
  predict: (inp) => {
    const v = soundSpeedAir(num(inp.temperatura));
    return { rapidez: v, lambda: v / num(inp.frecuencia) };
  },
};

/* ------------------------------------------------------------------ óptica */

const optics: CurveModel = {
  name: 'ley de Snell',
  description: 'Ley de Snell n₁·sen θ₁ = n₂·sen θ₂ y reflectancia de Fresnel (luz no polarizada).',
  inputs: ['medio1', 'medio2', 'incidencia'],
  predict: (inp) => {
    const m1 = byName(MEDIA, inp.medio1), m2 = byName(MEDIA, inp.medio2);
    const a = num(inp.incidencia);
    if (!m1 || !m2) return null;
    const r = safe(() => refract(m1.id, m2.id, a));
    if (!r) return null;
    const t = r.refraction;
    return {
      reflexion: a, refraccion: t === null ? NaN : t, senoI: Math.sin(rad(a)),
      senoT: t === null ? NaN : Math.sin(rad(t)), reflejada: r.reflectance * 100,
    };
  },
  xMap: { senoI: (x) => (x >= 0 && x <= 1 ? { incidencia: deg(Math.asin(x)) } : null) },
};

/* ------------------------------------------------------------------ energía */

const energy: CurveModel = {
  name: 'conservación de la energía',
  description: 'Conservación de la energía con fricción: ½·k·m·v² = m·g·h₀ − μ·m·g·x (k = 7/5 si rueda).',
  inputs: ['masa', 'altura', 'colina', 'mu', 'rueda'],
  predict: (inp, p) => {
    const r = safe(() => simulateTrack({ mass: num(inp.masa), startHeight: num(inp.altura), hillHeight: num(inp.colina), mu: num(inp.mu), rolling: inp.rueda === 'sí', g: p.g }));
    if (!r) return null;
    const last = r.points[r.points.length - 1];
    return { vValle: r.speedBottom, disipada: last.ef };
  },
};

/* ------------------------------------------------------------------ cinemática */

const kinematics: CurveModel = {
  name: 'x = v₀·t + ½·a·t²',
  description: 'Movimiento rectilíneo uniformemente variado: x = v₀·t + ½·a·t² (el ciclista se detiene si frena hasta v = 0).',
  inputs: ['v0', 'aceleracion', 'tiempo'],
  predict: (inp) => {
    const v0 = num(inp.v0), a = num(inp.aceleracion), t = num(inp.tiempo);
    if (!(t > 0)) return null;
    const s = stateAt(v0, a, t);
    return { distancia: s.x, vFinal: s.v, vMedia: s.x / t };
  },
};

/* ------------------------------------------------------------------ presión */

const pressure: CurveModel = {
  name: 'p = ρ·g·h',
  description: 'Presión hidrostática p = ρ·g·h en la membrana; el manómetro de agua sube Δh = p/(ρ_m·g).',
  inputs: ['montaje', 'densidad', 'profundidad', 'orientacion'],
  predict: (inp, p) => {
    const g = p.g ?? G_PRESSURE;
    const rho = num(inp.densidad), h = num(inp.profundidad), o = num(inp.orientacion);
    if (!(rho > 0) || !(h >= 0)) return null;
    const probe = typeof inp.montaje === 'string' && inp.montaje.startsWith('Tanque');
    const gauge = probe ? membraneGauge(rho, h, Number.isFinite(o) ? o : 0, undefined, g) : rho * g * (h / 100);
    return { pMan: gauge, desnivel: manometerRise(gauge, RHO_MANOMETER, g) * 1000 };
  },
};

const jets: CurveModel = {
  name: 'Torricelli',
  description: 'Teorema de Torricelli: v = C_v·√(2·g·h) y alcance R = 2·C_v·√(h·y) sobre la bandeja.',
  inputs: ['agujero', 'nivel'],
  predict: (inp, p) => {
    const j = safe(() => jet(num(inp.agujero), num(inp.nivel), CV_ORIFICE, p.g ?? G_PRESSURE));
    if (!j || !j.flows) return null;
    return { carga: j.headCm, alcance: j.range, tCaida: j.tFall, vMedida: j.v, vTorricelli: j.vIdeal, alcanceIdeal: j.rangeIdeal };
  },
  xMap: { carga: (x, inp) => ({ nivel: num(inp.agujero) + x }) },
};

/* ------------------------------------------------------------------ cinética */

const kinetics: CurveModel = {
  name: 'Arrhenius',
  description: 'Ley de velocidad con la constante de Arrhenius k(T) = k₂₅·e^(−Eₐ/R·(1/T − 1/298 K)), integrada numéricamente.',
  inputs: ['reaccion', 'concentracion', 'temperatura', 'area', 'catalizador'],
  predict: (inp, p) => {
    const marble = inp.reaccion === 'Mármol + HCl';
    const particle = num(inp.area) === 12 ? 'polvo' : num(inp.area) === 1 ? 'trozos' : 'granulado';
    const cat = typeof inp.catalizador === 'string' && inp.catalizador.startsWith('Ninguno') ? 'ninguno'
      : typeof inp.catalizador === 'string' && inp.catalizador.startsWith('Catalasa') ? 'catalasa' : 'mno2';
    const r = safe(() => simulateKinetics({
      reaction: marble ? 'marmol' : 'peroxido', concentration: num(inp.concentracion), temperature: num(inp.temperatura),
      particle, catalyst: cat as Catalyst, eaMarble: p.ea !== undefined ? p.ea * 1000 : undefined,
    }));
    if (!r) return null;
    return { v30: r.v30, velocidad: r.v30 / 30, t20: r.t20 ?? NaN, vFinal: r.vFinal };
  },
};

/** Curvas registradas: práctica → conjunto de datos → modelo. */
export const CURVE_MODELS: Record<string, Record<string, CurveModel>> = {
  densidad: { medidas: density },
  newton: { carrito: newton },
  gases: { mediciones: gases },
  pendulo: { oscilaciones: pendulum },
  proyectiles: { disparos: projectile },
  ondas: { cuerda: rope, sonido: sound },
  optica: { rayos: optics },
  energia: { recorridos: energy },
  cinematica: { recorridos: kinematics },
  presion: { presion: pressure, chorros: jets },
  cinetica: { ensayos: kinetics },
};

export const hasModelCurve = (practiceId: string, datasetId: string) => !!CURVE_MODELS[practiceId]?.[datasetId];

/**
 * Curva del modelo y(x) para los ejes elegidos, con las demás entradas fijas (`fixed`, normalmente las del
 * último ensayo). Devuelve null si el modelo no relaciona esas columnas (p. ej. y no la calcula el modelo).
 */
export function modelCurve(practiceId: string, datasetId: string, xKey: string, yKey: string, fixed: Inputs, params: Params = {}): ((x: number) => number) | null {
  const m = CURVE_MODELS[practiceId]?.[datasetId];
  if (!m) return null;
  const mapX = m.xMap?.[xKey];
  if (!mapX && !m.inputs.includes(xKey)) return null;
  // El modelo debe calcular y para las condiciones fijas.
  const probe = safe(() => m.predict(fixed, params));
  if (!probe || !(yKey in probe) && !m.inputs.includes(yKey)) return null;
  return (x: number) => {
    if (!Number.isFinite(x)) return NaN;
    const patch = mapX ? safe(() => mapX(x, fixed, params)) : { [xKey]: x };
    if (!patch) return NaN;
    const inp = { ...fixed, ...patch };
    const out = safe(() => m.predict(inp, params));
    const y = out && yKey in out ? out[yKey] : out ? inp[yKey] : NaN;
    return typeof y === 'number' && Number.isFinite(y) ? y : NaN;
  };
}

/** Texto de las condiciones fijas (entradas del último ensayo, excepto la variable del eje x). */
export function fixedInputsText(practiceId: string, datasetId: string, xKey: string, fixed: Inputs, labels: Record<string, { label: string; unit?: string }>): string {
  const m = CURVE_MODELS[practiceId]?.[datasetId];
  if (!m) return '';
  return m.inputs
    .filter((k) => k !== xKey && fixed[k] !== undefined && fixed[k] !== null && labels[k])
    .map((k) => {
      const v = fixed[k];
      const c = labels[k];
      return `${c.label}: ${typeof v === 'number' ? String(v).replace('.', ',') : v}${c.unit && typeof v === 'number' ? ` ${c.unit}` : ''}`;
    })
    .join(' · ');
}

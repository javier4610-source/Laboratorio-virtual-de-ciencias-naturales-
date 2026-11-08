import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Gravitación universal, órbitas y leyes de Kepler (grado 10.º).
 *
 * 1) Ley de gravitación universal de Newton: F = G·m₁·m₂/r², con G = 6,674 30 × 10⁻¹¹ N·m²/kg² (CODATA 2018).
 *    Gravedad en la superficie de un cuerpo esférico: g = G·M/R².
 * 2) Órbita de dos cuerpos (problema de Kepler) con μ = G·(M + m): la órbita es una elipse con el cuerpo central en un
 *    foco. Energía por unidad de masa E = v²/2 − μ/r = −μ/(2a) (constante) → ecuación vis-viva v² = μ·(2/r − 1/a).
 *    Momento angular por unidad de masa h = r × v (constante) → la velocidad areolar dA/dt = h/2 es constante
 *    (segunda ley de Kepler). Período T = 2π·√(a³/μ) (tercera ley).
 *    La órbita se INTEGRA numéricamente con Runge–Kutta de 4.º orden en el plano de la órbita (unidades: UA y años
 *    julianos) a partir del perihelio r_p = a(1 − e) con v_p de la vis-viva; las pruebas verifican que la energía y el
 *    momento angular se conservan y que las áreas barridas en tiempos iguales son iguales.
 * 3) Satélites de la Tierra: r = (μ_T·T²/4π²)^⅓; órbita geoestacionaria con el día sidéreo (86 164,0905 s).
 *
 * Datos: G de CODATA 2018; GM del Sol de la IAU (2015, valor nominal) y de la Tierra del IERS (Conventions 2010);
 * planetas de las fichas de la NASA (Planetary Fact Sheets, D. R. Williams, NASA Goddard): semieje mayor, período
 * sideral, excentricidad, inclinación y masa. Este archivo no depende de React ni del navegador.
 */

export const G_CONST = 6.6743e-11; // N·m²/kg², CODATA 2018 (6,674 30(15) × 10⁻¹¹)
export const GM_SUN = 1.3271244e20; // m³/s², IAU 2015 (parámetro nominal de masa solar)
export const M_SUN = 1.9885e30; // kg, NASA Sun Fact Sheet (1 988 500 × 10²⁴ kg)
export const GM_EARTH = 3.986004418e14; // m³/s², IERS Conventions (2010)
export const M_EARTH = 5.9722e24; // kg, NASA Earth Fact Sheet
export const R_EARTH_EQ = 6378.137e3; // m, radio ecuatorial (WGS 84)
export const R_EARTH_MEAN = 6371.0e3; // m, radio medio volumétrico (NASA)
export const SIDEREAL_DAY = 86164.0905; // s (IERS)
export const AU = 1.495978707e11; // m, IAU 2012 (exacta)
export const YEAR = 365.25 * 86400; // s, año juliano
export const DAY = 86400;
/** μ del Sol en UA³/año² (≈ 4π² = 39,478; con el año juliano y la UA de la IAU sale 39,477). */
export const MU_SUN_AU = (GM_SUN * YEAR ** 2) / AU ** 3;
/** 1 UA/año en km/s. */
export const AU_PER_YEAR_KMS = AU / YEAR / 1000;

export interface Planet { id: string; name: string; a: number; period: number; e: number; incl: number; mass: number }
/**
 * NASA Planetary Fact Sheets (fichas individuales de cada planeta, D. R. Williams, NASA Goddard Space Flight Center):
 * semieje mayor a (10⁶ km), período sideral (días), excentricidad, inclinación sobre la eclíptica (°) y masa (10²⁴ kg).
 */
export const PLANETS: Planet[] = [
  { id: 'mercurio', name: 'Mercurio', a: 57.909, period: 87.969, e: 0.2056, incl: 7.0, mass: 0.3301 },
  { id: 'venus', name: 'Venus', a: 108.21, period: 224.701, e: 0.0068, incl: 3.39, mass: 4.8673 },
  { id: 'tierra', name: 'Tierra', a: 149.598, period: 365.256, e: 0.0167, incl: 0, mass: 5.9722 },
  { id: 'marte', name: 'Marte', a: 227.956, period: 686.98, e: 0.0935, incl: 1.85, mass: 0.64169 },
  { id: 'jupiter', name: 'Júpiter', a: 778.479, period: 4332.589, e: 0.0487, incl: 1.3, mass: 1898.13 },
  { id: 'saturno', name: 'Saturno', a: 1432.041, period: 10759.22, e: 0.052, incl: 2.49, mass: 568.32 },
  { id: 'urano', name: 'Urano', a: 2867.043, period: 30685.4, e: 0.0469, incl: 0.77, mass: 86.811 },
  { id: 'neptuno', name: 'Neptuno', a: 4514.953, period: 60189, e: 0.0097, incl: 1.77, mass: 102.409 },
];
export function findPlanet(id: string): Planet {
  const p = PLANETS.find((x) => x.id === id);
  if (!p) throw new RangeError(`Planeta desconocido: ${id}`);
  return p;
}
export const auOf = (p: Planet) => (p.a * 1e9) / AU;

export const GRAV_LIMITS = { a: [0.2, 40] as [number, number], e: [0, 0.9] as [number, number], rFactor: [0.25, 4] as [number, number], altitude: [200, 400000] as [number, number] };

/* ------------------------------------------------------------------ 1. ley de gravitación */

/** Fuerza gravitacional entre dos masas (N). */
export function gravForce(m1: number, m2: number, r: number): number {
  assertInRange('La distancia', r, 1e-6, 1e15);
  return (G_CONST * m1 * m2) / (r * r);
}
/** Gravedad en la superficie de un cuerpo de masa M y radio R (m/s²). */
export const surfaceGravity = (M: number, R: number) => (G_CONST * M) / (R * R);

export interface Pair { id: string; name: string; m1: number; m2: number; r: number; n1: string; n2: string; note: string }
/** Parejas de cuerpos con distancias de las fichas de la NASA; la del estudiante y las esferas son ilustrativas. */
export const PAIRS: Pair[] = [
  { id: 'tierra-luna', name: 'Tierra y Luna', m1: M_EARTH, m2: 7.346e22, r: 3.844e8, n1: 'Tierra', n2: 'Luna', note: 'Distancia media Tierra–Luna: 384 400 km (NASA Moon Fact Sheet).' },
  { id: 'sol-tierra', name: 'Sol y Tierra', m1: M_SUN, m2: M_EARTH, r: 1.49598e11, n1: 'Sol', n2: 'Tierra', note: 'Semieje mayor de la órbita de la Tierra: 149,6 millones de km (NASA).' },
  { id: 'tierra-estudiante', name: 'Tierra y un estudiante de 50 kg', m1: M_EARTH, m2: 50, r: R_EARTH_MEAN, n1: 'Tierra', n2: 'estudiante', note: 'Masa del estudiante ilustrativa; r es el radio medio de la Tierra (6371 km): la fuerza es su peso.' },
  { id: 'esferas', name: 'Dos esferas de plomo de 10 kg', m1: 10, m2: 10, r: 0.2, n1: 'esfera 1', n2: 'esfera 2', note: 'Valores ilustrativos, del orden de la balanza de torsión de Cavendish (1798): la fuerza es diminuta.' },
];
export function findPair(id: string): Pair {
  const p = PAIRS.find((x) => x.id === id);
  if (!p) throw new RangeError(`Pareja desconocida: ${id}`);
  return p;
}

/* ------------------------------------------------------------------ 2. órbita (UA, años) */

/** Período de Kepler (años) para el semieje a (UA) alrededor de μ (UA³/año²). */
export const keplerPeriod = (a: number, mu = MU_SUN_AU) => 2 * Math.PI * Math.sqrt(a ** 3 / mu);
/** Rapidez por la vis-viva (UA/año). */
export const visViva = (r: number, a: number, mu = MU_SUN_AU) => Math.sqrt(mu * (2 / r - 1 / a));

export interface OrbitSample { t: number; x: number; y: number; vx: number; vy: number }
export interface OrbitRun {
  a: number; e: number; mu: number; period: number; steps: number;
  rp: number; ra: number; vp: number; va: number; b: number;
  samples: OrbitSample[];
  energy: { start: number; maxRelDrift: number };
  angMom: { start: number; maxRelDrift: number };
  /** Áreas barridas (UA²) en 8 intervalos iguales del período, integradas desde la trayectoria. */
  areas: number[];
  ellipseArea: number;
}

type S4 = [number, number, number, number];
function deriv(s: S4, mu: number): S4 {
  const r3 = Math.hypot(s[0], s[1]) ** 3;
  return [s[2], s[3], (-mu * s[0]) / r3, (-mu * s[1]) / r3];
}
function rk4(s: S4, dt: number, mu: number): S4 {
  const k1 = deriv(s, mu);
  const k2 = deriv(s.map((v, i) => v + (dt / 2) * k1[i]) as S4, mu);
  const k3 = deriv(s.map((v, i) => v + (dt / 2) * k2[i]) as S4, mu);
  const k4 = deriv(s.map((v, i) => v + dt * k3[i]) as S4, mu);
  return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as S4;
}
const energyOf = (s: S4, mu: number) => (s[2] ** 2 + s[3] ** 2) / 2 - mu / Math.hypot(s[0], s[1]);
const angMomOf = (s: S4) => s[0] * s[3] - s[1] * s[2];

/**
 * Integra una órbita completa desde el perihelio (sobre +x, moviéndose hacia +y) con RK4 de paso fijo.
 * `steps` debe ser múltiplo de 8 (para repartir el período en 8 intervalos de áreas).
 */
export function integrateOrbit(a: number, e: number, mu = MU_SUN_AU, steps = 4000): OrbitRun {
  assertInRange('El semieje mayor', a, GRAV_LIMITS.a[0], GRAV_LIMITS.a[1]);
  assertInRange('La excentricidad', e, GRAV_LIMITS.e[0], GRAV_LIMITS.e[1]);
  if (steps % 8 !== 0) throw new RangeError('El número de pasos debe ser múltiplo de 8');
  const period = keplerPeriod(a, mu);
  const rp = a * (1 - e), ra = a * (1 + e);
  const vp = visViva(rp, a, mu), va = visViva(ra, a, mu);
  const dt = period / steps;
  let s: S4 = [rp, 0, 0, vp];
  const E0 = energyOf(s, mu), h0 = angMomOf(s);
  let dE = 0, dh = 0;
  const samples: OrbitSample[] = [{ t: 0, x: s[0], y: s[1], vx: s[2], vy: s[3] }];
  const areas = new Array<number>(8).fill(0);
  const per = steps / 8;
  for (let k = 0; k < steps; k++) {
    const n = rk4(s, dt, mu);
    // Área barrida en el paso: regla del trapecio con la velocidad areolar ½|r × v| de los dos extremos.
    areas[Math.floor(k / per)] += (dt / 4) * (Math.abs(angMomOf(s)) + Math.abs(angMomOf(n)));
    s = n;
    dE = Math.max(dE, Math.abs(energyOf(s, mu) - E0) / Math.abs(E0));
    dh = Math.max(dh, Math.abs(angMomOf(s) - h0) / Math.abs(h0));
    samples.push({ t: (k + 1) * dt, x: s[0], y: s[1], vx: s[2], vy: s[3] });
  }
  const b = a * Math.sqrt(1 - e * e);
  return { a, e, mu, period, steps, rp, ra, vp, va, b, samples, energy: { start: E0, maxRelDrift: dE }, angMom: { start: h0, maxRelDrift: dh }, areas, ellipseArea: Math.PI * a * b };
}

/** Estado interpolado de la órbita en el tiempo t (años, se envuelve con el período). */
export function orbitAt(run: OrbitRun, t: number): OrbitSample & { r: number; v: number } {
  const T = run.period;
  const tt = ((t % T) + T) % T;
  const f = (tt / T) * run.steps;
  const i = Math.min(run.steps - 1, Math.floor(f));
  const u = f - i;
  const p = run.samples[i], q = run.samples[i + 1];
  const lerp = (x: number, y: number) => x + (y - x) * u;
  const s = { t: tt, x: lerp(p.x, q.x), y: lerp(p.y, q.y), vx: lerp(p.vx, q.vx), vy: lerp(p.vy, q.vy) };
  return { ...s, r: Math.hypot(s.x, s.y), v: Math.hypot(s.vx, s.vy) };
}

/* ------------------------------------------------------------------ 3. planetas y satélites */

export interface KeplerRow { planet: Planet; aAU: number; Tyears: number; Tcalc: number; ratio: number; diffPct: number; logA: number; logT: number }
/** Tercera ley con los datos de la NASA: período calculado con μ = G(M_sol + m) frente al período medido. */
export function keplerTable(): KeplerRow[] {
  return PLANETS.map((p) => {
    const aM = p.a * 1e9;
    const mu = GM_SUN + G_CONST * p.mass * 1e24;
    const TcalcS = 2 * Math.PI * Math.sqrt(aM ** 3 / mu);
    const aAU = aM / AU, Tyears = (p.period * DAY) / YEAR;
    return { planet: p, aAU, Tyears, Tcalc: TcalcS / DAY, ratio: Tyears ** 2 / aAU ** 3, diffPct: ((TcalcS / DAY - p.period) / p.period) * 100, logA: Math.log10(aAU), logT: Math.log10(Tyears) };
  });
}

/** Período (s) de un satélite circular a la altitud h (m) sobre el radio ecuatorial de la Tierra. */
export function satellitePeriod(altitude: number): number {
  assertInRange('La altitud', altitude, 1, 1e10);
  const r = R_EARTH_EQ + altitude;
  return 2 * Math.PI * Math.sqrt(r ** 3 / GM_EARTH);
}
/** Rapidez orbital circular (m/s) a la altitud h. */
export const satelliteSpeed = (altitude: number) => Math.sqrt(GM_EARTH / (R_EARTH_EQ + altitude));
/** Radio de la órbita con período T (s) alrededor de la Tierra. */
export const orbitRadiusFor = (T: number, mu = GM_EARTH) => Math.cbrt((mu * T * T) / (4 * Math.PI ** 2));
/** Altitud de la órbita geoestacionaria (m): período = día sidéreo. */
export const geostationaryAltitude = () => orbitRadiusFor(SIDEREAL_DAY) - R_EARTH_EQ;

export const SATELLITES = [
  { id: 'iss', name: 'Estación Espacial Internacional (≈ 420 km, varía)', altitude: 420e3 },
  { id: 'gps', name: 'Satélites GPS (≈ 20 200 km)', altitude: 20200e3 },
  { id: 'geo', name: 'Geoestacionario (35 786 km)', altitude: 35786e3 },
];

/* ------------------------------------------------------------------ avisos */

export interface GravCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function orbitConditions(a: number, e: number): GravCondition[] {
  const out: GravCondition[] = [];
  const rp = a * (1 - e);
  if (rp < 0.0047) out.push({ level: 'invalido', text: `El perihelio queda a ${(rp * 149.6).toFixed(2).replace('.', ',')} millones de km: dentro del Sol (radio ≈ 0,7 millones de km). El planeta chocaría.`, fix: 'Baja la excentricidad o aumenta el semieje mayor.' });
  else if (rp < 0.1) out.push({ level: 'advertencia', text: 'El perihelio queda más cerca del Sol que cualquier planeta: el calor y las mareas lo destruirían; el modelo de dos puntos no lo describe.', fix: 'Usa un perihelio mayor que el de Mercurio (0,31 UA).' });
  if (e >= 0.7) out.push({ level: 'nota', text: 'Una órbita tan alargada es típica de los cometas (el cometa Halley tiene e ≈ 0,97), no de los planetas.', fix: 'Compara con las excentricidades de los planetas (todas menores que 0,21).' });
  return out;
}
export function forceConditions(rFactor: number, pairId: string): GravCondition[] {
  const out: GravCondition[] = [];
  if (rFactor < 1 && pairId === 'tierra-estudiante') out.push({ level: 'invalido', text: 'Con r menor que el radio de la Tierra el estudiante estaría dentro del planeta: allí F = G·M·m/r² no vale, porque solo atrae la masa que queda más adentro.', fix: 'Usa r de 1 radio terrestre en adelante.' });
  return out;
}

export const gravitationSpec: ModelSpec = {
  name: 'Gravitación universal de Newton, órbitas de dos cuerpos y leyes de Kepler',
  inputs: [
    { symbol: 'm₁, m₂, r', name: 'Masas y distancia entre centros', unit: 'kg, m' },
    { symbol: 'a', name: 'Semieje mayor de la órbita', unit: 'UA', range: GRAV_LIMITS.a, initial: 1 },
    { symbol: 'e', name: 'Excentricidad', unit: '—', range: GRAV_LIMITS.e, initial: 0.0167 },
    { symbol: 'h', name: 'Altitud de un satélite de la Tierra', unit: 'km', range: [200, 400000], initial: 420 },
  ],
  outputs: [
    { symbol: 'F, g', name: 'Fuerza gravitacional y gravedad en la superficie', unit: 'N, m/s²' },
    { symbol: 'T', name: 'Período de la órbita', unit: 'años, días, min' },
    { symbol: 'v_p, v_a', name: 'Rapidez en el perihelio y el afelio', unit: 'km/s' },
    { symbol: 'A_k', name: 'Áreas barridas en ocho intervalos iguales de tiempo', unit: 'UA²' },
  ],
  equations: [
    'F = G·m₁·m₂/r²;  G = 6,674 30 × 10⁻¹¹ N·m²/kg²;  g = G·M/R²',
    'v² = μ·(2/r − 1/a)  (vis-viva);  μ = G·(M + m)',
    'dA/dt = h/2 = constante  (segunda ley de Kepler)',
    'T = 2π·√(a³/μ)  →  T²/a³ = 4π²/μ  (tercera ley);  en UA y años, T² ≈ a³',
    'Satélite: r = (μ_T·T²/4π²)^⅓;  geoestacionario: T = 1 día sidéreo = 86 164 s',
  ],
  initialConditions: ['La Tierra alrededor del Sol (a = 1 UA, e = 0,0167) desde el perihelio; pareja Tierra–Luna para la fuerza; satélite a 420 km (la Estación Espacial).'],
  assumptions: [
    'Dos cuerpos puntuales (o esferas): no se incluyen las perturbaciones de los otros planetas ni la relatividad general.',
    'En la estación de la órbita el Sol se toma fijo (μ = G·M_sol); en la tabla de planetas se usa μ = G·(M_sol + m).',
    'La órbita se integra numéricamente con Runge–Kutta de 4.º orden (4000 pasos por vuelta); las áreas barridas se suman paso a paso con la velocidad areolar ½|r × v|.',
  ],
  limits: [
    'Los semiejes de las fichas de la NASA son elementos de una época dada: para Saturno, Urano y Neptuno el período calculado difiere hasta ≈ 0,6 % del medido porque los planetas se perturban entre sí.',
    'Los satélites reales sienten el roce del aire (la Estación Espacial pierde altura y la corrigen) y el achatamiento de la Tierra; aquí la órbita es circular y la Tierra esférica.',
    'La gravedad en la superficie calculada (9,82 m/s²) no incluye la rotación de la Tierra ni su achatamiento: en Apartadó se mide ≈ 9,78 m/s².',
  ],
  testCases: [
    'Tierra: T = 2π√(a³/GM) = 365,26 días; Mercurio 87,97 días; Marte 687,0 días (NASA 686,98); todos los planetas a menos de 1 % del período de la NASA.',
    'Órbita integrada con e = 0,6: la energía y el momento angular se conservan (deriva relativa < 10⁻⁸) y las ocho áreas barridas son iguales (diferencia relativa < 10⁻⁶) y suman πab.',
    'Rapidez de la Tierra: 29,78 km/s; vis-viva v_p/v_a = (1 + e)/(1 − e).',
    'Geoestacionario: altitud 35 786 km; Estación Espacial a 420 km: 93,0 min; F Tierra–Luna = 1,98 × 10²⁰ N.',
  ],
};

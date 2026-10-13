import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';
import { MATERIALS } from './density';
import { G, findLiquid } from './pressure';

/**
 * Empuje y flotación: principio de Arquímedes (grado 7.º, con rigor de física introductoria).
 *
 * 1. Un cuerpo sumergido (total o parcialmente) en un líquido en reposo recibe una fuerza vertical hacia arriba,
 *    el empuje, igual al peso del líquido que desaloja: E = ρ_líq·g·V_sum.
 * 2. Colgado de un dinamómetro, el cuerpo marca un peso aparente P_ap = P − E. Al bajarlo, V_sum crece y la lectura
 *    disminuye; cuando queda completamente sumergido, V_sum = V y la lectura ya no cambia con la profundidad.
 * 3. Si el empuje máximo (ρ_líq·g·V) supera al peso, el cuerpo flota: se hunde solo hasta que ρ_líq·V_sum = m. En un
 *    prisma o cilindro vertical de densidad uniforme, la fracción sumergida es ρ_obj/ρ_líq. El hilo queda flojo y el
 *    dinamómetro marca 0.
 * 4. El líquido desalojado se mide de dos formas: (a) vaso de rebose (de Arquímedes o de Eureka): el líquido que sale
 *    por el pico cae en un vaso colector puesto sobre una balanza tarada; (b) vaso sobre la balanza: por la tercera ley
 *    de Newton, el cuerpo empuja al líquido hacia abajo con una fuerza igual a E, y la balanza tarada marca E/g.
 * 5. Densímetro: un flotador de masa fija se hunde más en un líquido menos denso; la marca de la escala que queda a ras
 *    de la superficie indica la densidad del líquido.
 */

/* ------------------------------------------------------------------ constantes */

export { G };
/** Resoluciones: dinamómetro de 5 N (N), balanza (g), densímetro (g/cm³). */
export const DYNAMOMETER_MAX = 5;
export const DYNAMOMETER_RES = 0.05;
export const BALANCE_RES = 0.1;
export const HYDROMETER_RES = 0.002;

/** Recipientes: radio interior (cm) del vaso de rebose y del vaso de precipitados (iguales). */
export const VESSEL_RADIUS_CM = 5;
export const VESSEL_AREA_CM2 = Math.PI * VESSEL_RADIUS_CM ** 2;
/** Agua (o líquido) en el recipiente antes de disolver sal, mL. */
export const BASE_VOLUME_ML = 1000;
/** Masa de sal de cada cucharada medidora, g. */
export const SPOON_G = 10;

export const BUOYANCY_LIMITS = {
  /** Descenso de la base del objeto bajo la superficie inicial del líquido, cm. */
  descent: [0, 10] as [number, number],
  /** Cucharadas de sal (10 g) disueltas en 1 L de agua. */
  spoons: [0, 30] as [number, number],
};

/* ------------------------------------------------------------------ líquidos (datos de src/models/pressure.ts) */

export type BuoyLiquidId = 'dulce' | 'salada' | 'aceite' | 'alcohol';

/**
 * Densidad (g/cm³) de soluciones acuosas de cloruro de sodio a 20 °C contra el porcentaje en masa
 * (CRC Handbook, «Concentrative properties of aqueous solutions»).
 */
export const NACL_TABLE: [number, number][] = [
  [0, 0.9982], [1, 1.0053], [2, 1.0125], [4, 1.0268], [6, 1.0413], [8, 1.0559], [10, 1.0707], [12, 1.0857],
  [14, 1.1009], [16, 1.1162], [18, 1.1319], [20, 1.1478], [22, 1.164], [24, 1.1804], [26, 1.1972],
];

/** Fracción en masa de sal (0 a 1) al disolver `saltG` gramos en 1 L de agua dulce. */
export function saltMassFraction(saltG: number): number {
  if (!Number.isFinite(saltG) || saltG < 0) throw new RangeError('La masa de sal no puede ser negativa.');
  const water = findLiquid('dulce').rho * (BASE_VOLUME_ML / 1000); // g
  return saltG / (saltG + water);
}

/**
 * Densidad (kg/m³) del agua con `saltG` gramos de sal disueltos en 1 L: interpolación lineal en la tabla del CRC,
 * escalada para que sin sal coincida con el agua dulce del laboratorio (997 kg/m³ a 25 °C).
 */
export function brineDensity(saltG: number): number {
  const w = saltMassFraction(saltG) * 100;
  if (w > 26.4) throw new RangeError('La solución estaría sobresaturada (más de 26 % de sal).');
  const t = NACL_TABLE;
  let rho = t[t.length - 1][1];
  for (let i = 1; i < t.length; i++) {
    if (w <= t[i][0]) { const [w0, r0] = t[i - 1], [w1, r1] = t[i]; rho = r0 + ((r1 - r0) * (w - w0)) / (w1 - w0); break; }
  }
  return (rho / t[0][1]) * findLiquid('dulce').rho;
}

/** Densidad (kg/m³) del líquido elegido; el agua salada depende de las cucharadas de sal. */
export function liquidDensity(liquid: BuoyLiquidId, spoons = 0): number {
  if (liquid === 'dulce' || liquid === 'salada') return brineDensity(spoons * SPOON_G);
  if (liquid === 'aceite' || liquid === 'alcohol') return findLiquid(liquid).rho;
  throw new Error(`Líquido desconocido: ${liquid}`);
}

/** Volumen (mL) del líquido en el recipiente: 1 L de líquido más la sal disuelta. */
export function liquidVolume(liquid: BuoyLiquidId, spoons = 0): number {
  if (liquid === 'aceite' || liquid === 'alcohol') return BASE_VOLUME_ML;
  const salt = spoons * SPOON_G;
  return ((findLiquid('dulce').rho * BASE_VOLUME_ML) / 1000 + salt) / (brineDensity(salt) / 1000);
}

/* ------------------------------------------------------------------ objetos */

export type ShapeKind = 'cilindro' | 'prisma' | 'esfera' | 'elipsoide' | 'barco';

export interface BuoyObject {
  id: string;
  name: string;
  short: string;
  /** Densidad del material, g/cm³. */
  rho: number;
  /** Masa, g. */
  mass: number;
  shape: ShapeKind;
  /** Dimensiones (cm): cilindro {r, h}; prisma {a, b, h}; esfera {r}; elipsoide {a, c} (semiejes horizontal y vertical); barco {a, b, h} (casco exterior). */
  dims: Record<string, number>;
  color: string;
}

const matRho = (id: string) => MATERIALS.find((m) => m.id === id)!.density;
const CYL = { r: 1.5, h: 6 };
const CYL_V = Math.PI * CYL.r ** 2 * CYL.h;
const EGG = { rho: 1.07, mass: 60, a: 2.1 };
const EGG_C = EGG.mass / EGG.rho / ((4 / 3) * Math.PI * EGG.a ** 2);
const CLAY = { rho: 1.6, mass: 50 };
const CLAY_R = Math.cbrt((3 * (CLAY.mass / CLAY.rho)) / (4 * Math.PI));

/**
 * Objetos del laboratorio. Los cuatro cilindros tienen el mismo tamaño (r = 1,5 cm, h = 6 cm, V ≈ 42,4 cm³),
 * como los juegos escolares de cilindros de igual volumen. Densidades: aluminio, hierro y pino tomadas de la práctica
 * de densidad; acrílico 1,18; parafina 0,90; huevo fresco 1,07; icopor (poliestireno expandido) 0,02; plastilina 1,6 g/cm³.
 */
export const OBJECTS: BuoyObject[] = [
  { id: 'aluminio', name: 'Cilindro de aluminio', short: 'aluminio', rho: matRho('aluminio'), mass: matRho('aluminio') * CYL_V, shape: 'cilindro', dims: CYL, color: '#c3c8cd' },
  { id: 'hierro', name: 'Cilindro de hierro', short: 'hierro', rho: matRho('hierro'), mass: matRho('hierro') * CYL_V, shape: 'cilindro', dims: CYL, color: '#6f6f73' },
  { id: 'plastico', name: 'Cilindro de plástico (acrílico)', short: 'plástico', rho: 1.18, mass: 1.18 * CYL_V, shape: 'cilindro', dims: CYL, color: '#4f8fd6' },
  { id: 'cera', name: 'Cilindro de cera (parafina)', short: 'cera', rho: 0.9, mass: 0.9 * CYL_V, shape: 'cilindro', dims: CYL, color: '#efe3b8' },
  { id: 'madera', name: 'Bloque de madera de pino', short: 'madera', rho: matRho('pino'), mass: matRho('pino') * 5 * 5 * 6, shape: 'prisma', dims: { a: 5, b: 5, h: 6 }, color: '#d9b77e' },
  { id: 'huevo', name: 'Huevo fresco (en una malla)', short: 'huevo', rho: EGG.rho, mass: EGG.mass, shape: 'elipsoide', dims: { a: EGG.a, c: EGG_C }, color: '#e9d2b0' },
  { id: 'icopor', name: 'Bloque de icopor', short: 'icopor', rho: 0.02, mass: 0.02 * 6 * 6 * 4, shape: 'prisma', dims: { a: 6, b: 6, h: 4 }, color: '#f4f6f8' },
  { id: 'bola', name: 'Plastilina en bola', short: 'plastilina en bola', rho: CLAY.rho, mass: CLAY.mass, shape: 'esfera', dims: { r: CLAY_R }, color: '#d9534f' },
  { id: 'barco', name: 'Plastilina en forma de barco', short: 'plastilina en barco', rho: CLAY.rho, mass: CLAY.mass, shape: 'barco', dims: { a: 8, b: 5, h: 3 }, color: '#d9534f' },
];

export function findObject(id: string): BuoyObject {
  const o = OBJECTS.find((x) => x.id === id);
  if (!o) throw new Error(`Objeto desconocido: ${id}`);
  return o;
}

/** Altura total del objeto (cm). */
export function objectHeight(o: BuoyObject): number {
  const d = o.dims;
  if (o.shape === 'esfera') return 2 * d.r;
  if (o.shape === 'elipsoide') return 2 * d.c;
  return d.h;
}

/** Volumen de material del objeto (cm³) = m/ρ. En el barco, el casco encierra además aire. */
export const materialVolume = (o: BuoyObject) => o.mass / o.rho;

/** Volumen exterior (cm³): el del material, o el del casco completo en el barco. */
export function outerVolume(o: BuoyObject): number {
  return submergedVolume(o, objectHeight(o));
}

/**
 * Volumen sumergido (cm³) cuando la base del objeto está `d` cm bajo la superficie (objeto vertical, base horizontal).
 * Cilindro y prisma: A·d. Esfera: casquete π·d²·(3r − d)/3. Elipsoide vertical: π·a²·(d² − d³/(3c))/c.
 * Barco: casco exterior A·d hasta el borde; si el agua pasa el borde, se inunda y solo desaloja su material.
 */
export function submergedVolume(o: BuoyObject, d: number): number {
  if (!Number.isFinite(d)) throw new RangeError('La profundidad debe ser un número.');
  const H = objectHeight(o);
  const x = Math.max(0, Math.min(H, d));
  const k = o.dims;
  switch (o.shape) {
    case 'cilindro': return Math.PI * k.r ** 2 * x;
    case 'prisma': return k.a * k.b * x;
    case 'esfera': return (Math.PI * x * x * (3 * k.r - x)) / 3;
    case 'elipsoide': return (Math.PI * k.a ** 2 * (x * x - (x * x * x) / (3 * k.c))) / k.c;
    case 'barco': return d > H ? materialVolume(o) : k.a * k.b * x;
  }
}

/** Fracción sumergida de un objeto que flota: ρ_obj/ρ_líq (solo si es menor que 1; el barco usa su densidad media). */
export function floatingFraction(rhoObj: number, rhoLiq: number): number {
  if (!(rhoObj > 0) || !(rhoLiq > 0)) throw new RangeError('Las densidades deben ser positivas.');
  return Math.min(1, rhoObj / rhoLiq);
}

/** Densidad media (g/cm³) del objeto entero: masa / volumen exterior (en el barco incluye el aire del casco). */
export const meanDensity = (o: BuoyObject) => o.mass / outerVolume(o);

/** Empuje (N) = ρ_líq (kg/m³) · g · V_sum (cm³ → m³). */
export function buoyantForce(rhoLiq: number, vSubCm3: number, g = G): number {
  if (!(rhoLiq > 0)) throw new RangeError('La densidad del líquido debe ser positiva.');
  if (!(vSubCm3 >= 0)) throw new RangeError('El volumen sumergido no puede ser negativo.');
  return rhoLiq * g * vSubCm3 * 1e-6;
}

/** Peso (N) de una masa en gramos. */
export const weightN = (massG: number, g = G) => (massG / 1000) * g;

/** Profundidad de flotación (cm): la que hace ρ_líq·V_sum = m (bisección); null si el objeto se hunde. */
export function floatDepth(o: BuoyObject, rhoLiq: number): number | null {
  const H = objectHeight(o);
  const needed = o.mass / (rhoLiq / 1000); // cm³
  if (submergedVolume(o, H) <= needed) return null;
  let lo = 0, hi = H;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (submergedVolume(o, mid) < needed) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/* ------------------------------------------------------------------ montaje completo */

export type SetupId = 'rebose' | 'balanza';

export interface BuoyInput {
  objectId: string;
  liquid: BuoyLiquidId;
  /** Cucharadas de sal (solo agua). */
  spoons: number;
  /** Descenso de la base del objeto bajo la superficie inicial del líquido (lo fija la altura del dinamómetro), cm. */
  descent: number;
  setup: SetupId;
}

export interface BuoyResult {
  object: BuoyObject;
  rhoLiq: number; // kg/m³
  /** Profundidad real de la base bajo la superficie (cm) y volumen sumergido (cm³). */
  depth: number;
  vSub: number;
  /** Fracción del volumen exterior que queda bajo el líquido. */
  fraction: number;
  /** Peso en el aire, empuje y lectura verdadera del dinamómetro (N). */
  weight: number;
  buoyancy: number;
  apparent: number;
  /** El objeto flota (el hilo está flojo y el dinamómetro marca 0). */
  floating: boolean;
  /** ¿Flotaría si se soltara? (empuje máximo > peso). */
  floats: boolean;
  /** Totalmente sumergido. */
  submerged: boolean;
  /** Masa (g) que marca la balanza tarada: líquido desalojado (rebose) o reacción del empuje E/g (vaso sobre la balanza). */
  balanceMass: number;
  /** Subida del nivel en el vaso sobre la balanza (cm); 0 en el vaso de rebose. */
  levelRise: number;
  /** El dinamómetro se sale de la escala. */
  overload: boolean;
}

export function simulateBuoyancy(input: BuoyInput): BuoyResult {
  assertInRange('El descenso del objeto', input.descent, ...BUOYANCY_LIMITS.descent);
  assertInRange('Las cucharadas de sal', input.spoons, ...BUOYANCY_LIMITS.spoons);
  const o = findObject(input.objectId);
  const water = input.liquid === 'dulce' || input.liquid === 'salada';
  const rhoLiq = liquidDensity(input.liquid, water ? input.spoons : 0);
  const H = objectHeight(o);
  // Profundidad de la base cuando el hilo está tenso. En el vaso de rebose el nivel no cambia (el exceso sale por el pico);
  // en el vaso de precipitados el nivel sube V_sum/A: d = s + V_sum(d)/A (punto fijo, se resuelve por bisección).
  let dHung = input.descent;
  if (input.setup === 'balanza' && input.descent > 0) {
    let lo = input.descent, hi = input.descent + submergedVolume(o, H) / VESSEL_AREA_CM2 + 1e-9;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (mid - input.descent - submergedVolume(o, mid) / VESSEL_AREA_CM2 < 0) lo = mid; else hi = mid; }
    dHung = (lo + hi) / 2;
  }
  const dFloat = floatDepth(o, rhoLiq);
  const floating = dFloat !== null && dHung >= dFloat;
  const depth = floating ? dFloat! : dHung;
  const vSub = submergedVolume(o, depth);
  const weight = weightN(o.mass);
  const buoyancy = floating ? weight : buoyantForce(rhoLiq, vSub);
  const apparent = floating ? 0 : Math.max(0, weight - buoyancy);
  const displacedMass = (rhoLiq / 1000) * vSub;
  return {
    object: o, rhoLiq, depth, vSub, fraction: vSub / outerVolume(o), weight, buoyancy, apparent, floating,
    floats: dFloat !== null, submerged: depth >= H - 1e-9,
    balanceMass: displacedMass,
    levelRise: input.setup === 'balanza' ? vSub / VESSEL_AREA_CM2 : 0,
    overload: weight > DYNAMOMETER_MAX,
  };
}

/** Lecturas: dinamómetro (0,05 N), balanza (0,1 g) y densímetro (0,002 g/cm³). Sin −0. */
const noNegZero = (v: number) => (Object.is(v, -0) ? 0 : v);
export const dynamometerReading = (n: number) => noNegZero(roundToResolution(Math.max(0, n), DYNAMOMETER_RES));
export const balanceReading = (g: number) => noNegZero(roundToResolution(g, BALANCE_RES));
export const hydrometerReading = (rhoGcm3: number) => noNegZero(roundToResolution(rhoGcm3, HYDROMETER_RES));

/** Cálculos del estudiante con sus lecturas: E = P − P_ap y peso del líquido desalojado m·g. */
export function analyzeReadings(weightReading: number, apparentReading: number, balanceG: number, g = G) {
  return { buoyancy: weightReading - apparentReading, displacedWeight: weightN(balanceG, g) };
}

/* ------------------------------------------------------------------ densímetro */

/**
 * Densímetro de vidrio: bulbo lastrado de volumen V₀ y tallo de sección a. Diseñado para leer de 0,70 a 1,20 g/cm³ en
 * 16 cm de tallo: a 1,20 g/cm³ el tallo queda justo afuera (m = 1,20·V₀); a 0,70 g/cm³ se hunden 16 cm.
 */
export const HYDROMETER = { stemArea: 0.5, stemLength: 16, rhoMin: 0.7, rhoMax: 1.2 };
export const HYDROMETER_MASS = (HYDROMETER.stemArea * HYDROMETER.stemLength) / (1 / HYDROMETER.rhoMin - 1 / HYDROMETER.rhoMax);
export const HYDROMETER_BULB = HYDROMETER_MASS / HYDROMETER.rhoMax;

/** Longitud de tallo (cm) que queda bajo la superficie en un líquido de densidad ρ (g/cm³): (m/ρ − V₀)/a. */
export function hydrometerStemDepth(rhoGcm3: number): number {
  assertInRange('La densidad del líquido del densímetro', rhoGcm3, HYDROMETER.rhoMin, HYDROMETER.rhoMax);
  return (HYDROMETER_MASS / rhoGcm3 - HYDROMETER_BULB) / HYDROMETER.stemArea;
}

/** Densidad (g/cm³) que corresponde a una marca del tallo a `stemCm` del bulbo (la escala no es uniforme). */
export function hydrometerScale(stemCm: number): number {
  return HYDROMETER_MASS / (HYDROMETER_BULB + HYDROMETER.stemArea * stemCm);
}

/** Cucharadas mínimas de sal para que el objeto flote en 1 L de agua (null si no flota ni con el máximo). */
export function spoonsToFloat(objectId: string): number | null {
  const o = findObject(objectId);
  for (let n = BUOYANCY_LIMITS.spoons[0]; n <= BUOYANCY_LIMITS.spoons[1]; n++) if (floatDepth(o, liquidDensity('salada', n)) !== null) return n;
  return null;
}

/** Fichas de los instrumentos (misma forma que src/labs/instruments.ts), usadas como respaldo. */
export const BUOYANCY_INSTRUMENTS = [
  { id: 'dinamometro', name: 'Dinamómetro de resorte de 5 N', quantity: 'Peso y peso aparente', unit: 'N', resolution: DYNAMOMETER_RES, sigma: 0.02, nonNegative: true, note: 'Paralaje al leer el indicador, rozamiento del resorte con el tubo y oscilación del objeto colgado.' },
  { id: 'balanza', name: 'Balanza digital (2000 g, tarada)', quantity: 'Masa del líquido desalojado', unit: 'g', resolution: BALANCE_RES, sigma: 0.15, note: 'Gotas que quedan en el pico del vaso de rebose o en las paredes del colector, y corrientes de aire.' },
  { id: 'densimetro', name: 'Densímetro de vidrio (0,700 a 1,200 g/cm³)', quantity: 'Densidad del líquido', unit: 'g/cm³', resolution: HYDROMETER_RES, sigma: 0.001, note: 'Lectura del menisco sobre el tallo y burbujas adheridas al bulbo.' },
];

export const buoyancyModelSpec: ModelSpec = {
  name: 'Principio de Arquímedes: empuje E = ρ_líq·g·V_sum, peso aparente, flotación (fracción sumergida ρ_obj/ρ_líq) y densímetro',
  inputs: [
    { symbol: 'objeto', name: 'Objeto colgado del dinamómetro (cilindros de aluminio, hierro, acrílico y cera de igual volumen; bloque de pino; huevo; bloque de icopor; plastilina en bola o en barco)', unit: '—', initial: 'cilindro de aluminio' },
    { symbol: 'líquido', name: 'Líquido (agua dulce, agua salada, aceite de cocina, alcohol etílico)', unit: '—', initial: 'agua dulce' },
    { symbol: 'n_sal', name: 'Cucharadas de sal de 10 g disueltas en 1 L de agua', unit: '—', range: BUOYANCY_LIMITS.spoons, initial: 0 },
    { symbol: 's', name: 'Descenso de la base del objeto bajo la superficie inicial (altura del dinamómetro)', unit: 'cm', range: BUOYANCY_LIMITS.descent, initial: 0 },
    { symbol: 'montaje', name: 'Vaso de rebose con colector sobre la balanza, o vaso de precipitados sobre la balanza', unit: '—', initial: 'vaso de rebose' },
  ],
  outputs: [
    { symbol: 'P', name: 'Peso en el aire (dinamómetro de 5 N, resolución 0,05 N)', unit: 'N' },
    { symbol: 'P_ap', name: 'Peso aparente con el objeto en el líquido', unit: 'N' },
    { symbol: 'E', name: 'Empuje calculado con las lecturas, P − P_ap', unit: 'N' },
    { symbol: 'm_des', name: 'Masa del líquido desalojado (balanza tarada, 0,1 g) y su peso m·g', unit: 'g, N' },
    { symbol: 'ρ_líq', name: 'Densidad del líquido leída en el densímetro (0,002 g/cm³)', unit: 'g/cm³' },
    { symbol: 'f', name: 'Fracción sumergida de un objeto que flota', unit: '%' },
  ],
  equations: [
    'E = ρ_líq · g · V_sum   (peso del líquido desalojado)',
    'P_ap = P − E   mientras el hilo está tenso;   P_ap = 0 si el objeto flota (E = P)',
    'Flota si ρ_líq · V > m (densidad media menor que la del líquido); fracción sumergida f = ρ_obj / ρ_líq',
    'V_sum: cilindro y prisma A·d; esfera π·d²·(3r − d)/3; elipsoide vertical π·a²·(d² − d³/(3c))/c',
    'Vaso de rebose: m_colector = ρ_líq·V_sum.   Vaso sobre la balanza: lectura tarada = E/g; el nivel sube V_sum/A y d = s + V_sum(d)/A',
    'Agua con sal: ρ por interpolación en la tabla de NaCl del CRC (20 °C) según la fracción en masa w = m_sal/(m_sal + m_agua)',
    'Densímetro: m = ρ·(V₀ + a·L)  →  L = (m/ρ − V₀)/a; la escala se aprieta hacia las densidades altas',
  ],
  initialConditions: [
    'Cilindro de aluminio (r = 1,5 cm, h = 6 cm, 114,5 g) colgado de un dinamómetro de 5 N, con su base a ras del agua (s = 0).',
    'Vaso de rebose de 10 cm de diámetro lleno de agua dulce (997 kg/m³) hasta el pico; colector vacío sobre una balanza tarada.',
    'Sin sal disuelta; densímetro flotando en una probeta con el mismo líquido; g = 9,78 m/s² (Urabá).',
  ],
  assumptions: [
    'Líquidos en reposo, incompresibles y de densidad uniforme a 25 °C; mismos datos de la práctica de presión: agua dulce 997, aceite 918 y alcohol etílico 785 kg/m³. El agua salada se calcula con la sal disuelta (tabla de NaCl del CRC a 20 °C, escalada para que sin sal dé 997 kg/m³).',
    'El empuje es la resultante de las presiones ρ·g·h sobre la superficie del objeto (diferencia entre la cara de abajo y la de arriba); se desprecia el empuje del aire (≈ 0,1 % del peso del aluminio).',
    'El objeto cuelga vertical y quieto, sin tocar el fondo ni las paredes; el hilo y la malla del huevo no tienen masa ni volumen.',
    'Vaso de rebose lleno exactamente hasta el pico y colector tarado antes de cada inmersión: todo el líquido desalojado cae en el colector. En el vaso sobre la balanza, la balanza se tara con el vaso y el líquido.',
    'Los objetos son homogéneos e impermeables: la madera y el icopor no absorben agua y la plastilina no se disuelve; el barco de plastilina tiene paredes delgadas y no se inunda mientras el agua no pase el borde.',
    'Densidades de los objetos: aluminio 2,70; hierro 7,87; acrílico 1,18; parafina 0,90; pino 0,50; huevo fresco 1,07; icopor 0,02; plastilina 1,60 g/cm³ (valores típicos; cada muestra real varía).',
  ],
  limits: [
    'La densidad de un huevo depende de su frescura (fresco ≈ 1,07 a 1,09 g/cm³; al envejecer pierde agua, gana aire en la cámara y puede flotar en agua dulce): el número de cucharadas para que flote cambia de un huevo a otro.',
    'El dinamómetro de 5 N con divisiones de 0,1 N (lectura de 0,05 N) no distingue el empuje sobre objetos muy livianos: el icopor (≈ 0,03 N) marca prácticamente 0 aun antes de tocar el agua. Para ellos es mejor la balanza.',
    'No se modela la tensión superficial (un clip de acero puede quedarse sobre el agua), la capilaridad en el pico del vaso de rebose ni las gotas que quedan adheridas.',
    'La madera real absorbe agua con el tiempo y se hunde un poco más; la cera y el aceite tienen densidades parecidas y la cera puede quedar casi totalmente sumergida.',
    'En el vaso de precipitados el nivel sube cuando entra el objeto, así que la profundidad real de la base es algo mayor que el descenso del dinamómetro; el modelo lo calcula. No se consideran objetos que toquen el fondo.',
    'La sal no se disuelve en aceite ni en alcohol, por eso solo se agrega al agua; a más de ≈ 26 % en masa la solución se satura (el laboratorio llega a 23 %).',
  ],
  testCases: [
    'E a mano: cilindro de 42,41 cm³ en agua dulce → 997 · 9,78 · 42,41·10⁻⁶ ≈ 0,4135 N; peso del aluminio 114,5 g · 9,78 ≈ 1,120 N; aparente ≈ 0,706 N.',
    'El peso aparente baja en proporción al volumen sumergido mientras el objeto entra y es constante una vez sumergido (s = 6 cm y s = 10 cm dan lo mismo).',
    'Cilindros de igual volumen (aluminio, hierro, acrílico) reciben el mismo empuje aunque pesen distinto.',
    'Masa desalojada en el colector = E/g (conservación): el peso del líquido desalojado es igual al empuje.',
    'Flotación: el bloque de pino en agua dulce se hunde 6 · 0,5/0,997 ≈ 3,01 cm (fracción ρ_obj/ρ_líq) y el dinamómetro marca 0; en alcohol se hunde más.',
    'La plastilina en bola se hunde y la misma plastilina en barco flota (densidad media del casco ≈ 0,42 g/cm³).',
    'El huevo se hunde en agua dulce y en agua de mar y flota a partir de 12 cucharadas de sal (120 g en 1 L).',
    'Vaso sobre la balanza: la balanza marca E/g y el nivel sube V_sum/A; la base queda a s + subida.',
    'Densímetro: marca 1,200 en el tope del bulbo y 0,700 a 16 cm; lee la densidad del líquido con resolución 0,002 g/cm³.',
    'Las entradas fuera de rango se rechazan.',
  ],
};

import { assertInRange, clamp, roundToResolution } from './math';
import { C_LIGHT } from './optics';
import type { ModelSpec } from './types';
import { num, type ModelCondition } from './conditions';

/**
 * Interferencia y difracción de la luz en campo lejano (Fraunhofer), grado 11.º.
 *
 *   Rendija simple (ancho a):        I/I₀ = sinc²β,                β = π·a·sen θ/λ
 *   Doble rendija (d, a):            I/I₀ = cos²(π·d·sen θ/λ)·sinc²β
 *   Red de N rendijas (periodo d):   I/I₀ = sinc²β·[sen(N·φ/2)/(N·sen(φ/2))]²,  φ = 2π·d·sen θ/λ
 *   Abertura circular (diámetro D):  I/I₀ = [2·J₁(x)/x]²,          x = π·D·sen θ/λ
 *
 * Condiciones exactas (sin aproximación de ángulo pequeño):
 *   mínimos de una rendija  a·sen θ = m·λ;   máximos de una red  d·sen θ = m·λ;
 *   primer anillo oscuro de Airy  D·sen θ = 1,22·λ.   Sobre una pantalla plana: y = L·tan θ.
 * Con ángulo pequeño, la separación entre franjas de la doble rendija es Δy ≈ λ·L/d.
 *
 * Funciones puras y deterministas: longitudes en metros salvo que el nombre diga otra cosa
 * (_nm, _um, _mm, _cm). La intensidad está normalizada: 1 en el centro del patrón.
 */

/* ------------------------------------------------------------------ fuentes */

export type SourceId = 'rojo' | 'verde' | 'violeta' | 'desconocido' | 'blanca';
export interface LightSource { id: SourceId; name: string; /** nm; null = luz blanca (espectro continuo). */ wavelength: number | null; hidden?: boolean }

export const SOURCES: LightSource[] = [
  { id: 'rojo', name: 'Láser rojo (650 nm)', wavelength: 650 },
  { id: 'verde', name: 'Láser verde (532 nm)', wavelength: 532 },
  { id: 'violeta', name: 'Láser violeta (405 nm)', wavelength: 405 },
  { id: 'desconocido', name: 'Láser desconocido (λ por determinar)', wavelength: 635, hidden: true },
  { id: 'blanca', name: 'Luz blanca (lámpara con rendija colimadora)', wavelength: null },
];

export function findSource(id: string): LightSource {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`Fuente desconocida: ${id}`);
  return s;
}

/** Muestras del espectro visible para la luz blanca (espectro de energía igual, 400–700 nm cada 10 nm). */
export const WHITE_SAMPLES_NM: number[] = Array.from({ length: 31 }, (_, i) => 400 + 10 * i);

/* ------------------------------------------------------------------ diapositivas (elementos difractores) */

export type ElementKind = 'simple' | 'doble' | 'red' | 'circular';

export interface Grating { id: string; name: string; linesPerMm: number; hidden?: boolean }
export const GRATINGS: Grating[] = [
  { id: 'r100', name: 'Red de 100 líneas/mm', linesPerMm: 100 },
  { id: 'r300', name: 'Red de 300 líneas/mm', linesPerMm: 300 },
  { id: 'r600', name: 'Red de 600 líneas/mm', linesPerMm: 600 },
  // Pasos de pista estándar: CD 1,6 µm (≈ 625 líneas/mm), DVD 0,74 µm (≈ 1350 líneas/mm).
  { id: 'cd', name: 'Trozo de CD sin la capa metálica (paso desconocido)', linesPerMm: 1000 / 1.6, hidden: true },
  { id: 'dvd', name: 'Trozo de DVD sin la capa metálica (paso desconocido)', linesPerMm: 1000 / 0.74, hidden: true },
];

export function findGrating(id: string): Grating {
  const g = GRATINGS.find((x) => x.id === id);
  if (!g) throw new Error(`Red desconocida: ${id}`);
  return g;
}

/** Fracción transparente de cada periodo de las redes (a = d/4): ningún orden de 1 a 3 desaparece. */
export const GRATING_DUTY = 0.25;
/** Ancho del haz que ilumina la red (mm): fija el número de rendijas iluminadas N. */
export const BEAM_MM = 1;

export const INTERFERENCE_LIMITS = {
  slitWidth: [20, 200] as [number, number],    // µm (a)
  slitSeparation: [100, 500] as [number, number], // µm (d)
  aperture: [50, 500] as [number, number],     // µm (D)
  distance: [20, 200] as [number, number],     // cm (L)
  wavelength: [380, 780] as [number, number],  // nm
  screenHalfWidth: 400,                        // mm: la pantalla mide 80 cm de ancho
  film: [0, 1200] as [number, number],         // nm (espesor de la película de jabón)
};

/** Abertura en metros: a (ancho de cada rendija), d (periodo), D (diámetro), N (rendijas iluminadas). */
export interface Aperture { kind: ElementKind; a: number; d: number; D: number; N: number }

export interface ElementSelection { kind: ElementKind; a_um: number; d_um: number; D_um: number; gratingId: string }

export function apertureFor(sel: ElementSelection): Aperture {
  switch (sel.kind) {
    case 'simple':
      assertInRange('El ancho de la rendija', sel.a_um, ...INTERFERENCE_LIMITS.slitWidth);
      return { kind: 'simple', a: sel.a_um * 1e-6, d: 0, D: 0, N: 1 };
    case 'doble':
      assertInRange('El ancho de cada rendija', sel.a_um, ...INTERFERENCE_LIMITS.slitWidth);
      assertInRange('La separación entre rendijas', sel.d_um, ...INTERFERENCE_LIMITS.slitSeparation);
      if (sel.a_um >= sel.d_um) throw new RangeError('El ancho de cada rendija debe ser menor que la separación entre rendijas.');
      return { kind: 'doble', a: sel.a_um * 1e-6, d: sel.d_um * 1e-6, D: 0, N: 2 };
    case 'red': {
      const g = findGrating(sel.gratingId);
      const d = 1e-3 / g.linesPerMm;
      return { kind: 'red', a: GRATING_DUTY * d, d, D: 0, N: Math.round(g.linesPerMm * BEAM_MM) };
    }
    case 'circular':
      assertInRange('El diámetro del agujero', sel.D_um, ...INTERFERENCE_LIMITS.aperture);
      return { kind: 'circular', a: 0, d: 0, D: sel.D_um * 1e-6, N: 1 };
  }
}

/* ------------------------------------------------------------------ funciones de intensidad */

/** sinc(x) = sen x / x, con sinc(0) = 1. */
export function sinc(x: number): number {
  return Math.abs(x) < 1e-9 ? 1 - (x * x) / 6 : Math.sin(x) / x;
}

/** sen θ exacto para un punto de una pantalla plana a la distancia L (mismas unidades). */
export function sinThetaOnScreen(y: number, L: number): number {
  return y / Math.hypot(y, L);
}

/** Posición en la pantalla plana para un ángulo dado por su seno (|sen θ| < 1). */
export function screenPosition(sinTheta: number, L: number): number {
  return (L * sinTheta) / Math.sqrt(1 - sinTheta * sinTheta);
}

export function singleSlitIntensity(sinTheta: number, a: number, lambda: number): number {
  const b = (Math.PI * a * sinTheta) / lambda;
  const s = sinc(b);
  return s * s;
}

/** Factor de interferencia de N rendijas normalizado: [sen(Nφ/2)/(N·sen(φ/2))]². */
export function nSlitFactor(phi: number, N: number): number {
  const h = phi / 2;
  const den = N * Math.sin(h);
  if (Math.abs(den) < 1e-12 * N) return 1; // máximo principal (límite 0/0)
  const r = Math.sin(N * h) / den;
  return r * r;
}

export function doubleSlitIntensity(sinTheta: number, d: number, a: number, lambda: number): number {
  const c = Math.cos((Math.PI * d * sinTheta) / lambda);
  return c * c * singleSlitIntensity(sinTheta, a, lambda);
}

export function gratingIntensity(sinTheta: number, d: number, a: number, N: number, lambda: number): number {
  return singleSlitIntensity(sinTheta, a, lambda) * nSlitFactor((2 * Math.PI * d * sinTheta) / lambda, N);
}

/**
 * Función de Bessel J₁ (aproximaciones polinómicas de Abramowitz y Stegun 9.4.4 y 9.4.6; error < 1e-7).
 */
export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  let v: number;
  if (ax <= 3) {
    const t = (x / 3) ** 2;
    v = x * (0.5 + t * (-0.56249985 + t * (0.21093573 + t * (-0.03954289 + t * (0.00443319 + t * (-0.00031761 + t * 0.00001109))))));
    return v;
  }
  const u = 3 / ax;
  const f1 = 0.79788456 + u * (0.00000156 + u * (0.01659667 + u * (0.00017105 + u * (-0.00249511 + u * (0.00113653 - u * 0.00020033)))));
  const t1 = ax - 2.35619449 + u * (0.12499612 + u * (0.0000565 + u * (-0.00637879 + u * (0.00074348 + u * (0.00079824 - u * 0.00029166)))));
  v = (f1 * Math.cos(t1)) / Math.sqrt(ax);
  return x < 0 ? -v : v;
}

/** Ceros de [2J₁(x)/x]² expresados como D·sen θ/λ: 1,22; 2,23; 3,24 (= j₁,ₘ/π). */
export const AIRY_ZEROS = [3.831705970 / Math.PI, 7.015586670 / Math.PI, 10.173468135 / Math.PI];

export function airyIntensity(sinTheta: number, D: number, lambda: number): number {
  const x = (Math.PI * D * sinTheta) / lambda;
  if (Math.abs(x) < 1e-6) return 1;
  const r = (2 * besselJ1(x)) / x;
  return r * r;
}

/** Intensidad relativa (1 en el centro) de la abertura para luz monocromática de longitud de onda λ (m). */
export function intensity(ap: Aperture, sinTheta: number, lambda: number): number {
  switch (ap.kind) {
    case 'simple': return singleSlitIntensity(sinTheta, ap.a, lambda);
    case 'doble': return doubleSlitIntensity(sinTheta, ap.d, ap.a, lambda);
    case 'red': return gratingIntensity(sinTheta, ap.d, ap.a, ap.N, lambda);
    case 'circular': return airyIntensity(sinTheta, ap.D, lambda);
  }
}

/* ------------------------------------------------------------------ posiciones exactas */

export interface OrderPosition { m: number; sinTheta: number; thetaDeg: number; /** Posición en la pantalla (mm) o null si el haz no llega (θ ≥ 90°). */ y_mm: number }

const DEG = 180 / Math.PI;

/** Máximos de una red (o de la doble rendija): d·sen θ = m·λ, solo los órdenes con |sen θ| < 1. */
export function gratingOrders(d: number, lambda: number, L_m: number): OrderPosition[] {
  assertInRange('La longitud de onda (nm)', lambda * 1e9, ...INTERFERENCE_LIMITS.wavelength);
  if (!(d > 0)) throw new RangeError('El periodo de la red debe ser positivo.');
  const out: OrderPosition[] = [];
  const mMax = Math.floor((d / lambda) * (1 - 1e-12));
  for (let m = -mMax; m <= mMax; m++) {
    const s = (m * lambda) / d;
    out.push({ m, sinTheta: s, thetaDeg: Math.asin(s) * DEG, y_mm: screenPosition(s, L_m) * 1000 });
  }
  return out;
}

/** Mínimos de una rendija simple: a·sen θ = m·λ (m = ±1, ±2, …). */
export function singleSlitMinima(a: number, lambda: number, L_m: number, count = 5): OrderPosition[] {
  const out: OrderPosition[] = [];
  for (let m = 1; m <= count; m++) {
    const s = (m * lambda) / a;
    if (s >= 1) break;
    out.push({ m, sinTheta: s, thetaDeg: Math.asin(s) * DEG, y_mm: screenPosition(s, L_m) * 1000 });
  }
  return out;
}

/** Radio del m-ésimo anillo oscuro del patrón de Airy en la pantalla (mm). */
export function airyDarkRing(D: number, lambda: number, L_m: number, m = 1): number | null {
  const s = (AIRY_ZEROS[m - 1] * lambda) / D;
  return s < 1 ? screenPosition(s, L_m) * 1000 : null;
}

/** Separación entre franjas de la doble rendija con ángulo pequeño: Δy ≈ λ·L/d. */
export function fringeSpacingSmallAngle(lambda: number, L: number, d: number): number {
  return (lambda * L) / d;
}

/** Número de Fresnel N_F = (ancho/2)²/(λ·L): Fraunhofer es válido si N_F ≪ 1. */
export function fresnelNumber(ap: Aperture, lambda: number, L: number): number {
  const half = ap.kind === 'circular' ? ap.D / 2 : ap.kind === 'simple' ? ap.a / 2 : ap.kind === 'doble' ? (ap.d + ap.a) / 2 : (BEAM_MM * 1e-3) / 2;
  return (half * half) / (lambda * L);
}

/* ------------------------------------------------------------------ color: longitud de onda → sRGB */

const lobe = (x: number, mu: number, s1: number, s2: number) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };

/**
 * Funciones de igualación de color CIE 1931 (observador de 2°), aproximación analítica de varios lóbulos
 * gaussianos de Wyman, Sloan y Shirley (2013).
 */
export function cieXYZ(lambda_nm: number): [number, number, number] {
  const l = lambda_nm;
  const x = 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
  const y = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
  const z = 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);
  return [x, y, z];
}

/** XYZ → sRGB lineal (iluminante D65). Puede dar componentes negativas (colores fuera de la gama). */
export function xyzToLinearRgb([X, Y, Z]: [number, number, number]): [number, number, number] {
  return [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.204 * Y + 1.057 * Z,
  ];
}

/** Codificación gamma sRGB de una componente lineal en [0, 1]. */
export function srgbEncode(c: number): number {
  const v = clamp(c, 0, 1);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/**
 * Color de visualización (sRGB lineal, máximo 1) de una luz monocromática. Los colores espectrales están fuera
 * de la gama sRGB: las componentes negativas se recortan a cero (se conserva el tono) y se normaliza el brillo.
 * Fuera de 380–780 nm el color es negro (invisible).
 */
export function wavelengthLinearRgb(lambda_nm: number): [number, number, number] {
  if (lambda_nm < 380 || lambda_nm > 780) return [0, 0, 0];
  const d = xyzToLinearRgb(cieXYZ(lambda_nm)).map((c) => Math.max(0, c)) as [number, number, number];
  const mx = Math.max(...d);
  return mx > 0 ? (d.map((c) => c / mx) as [number, number, number]) : [0, 0, 0];
}

/** Color hexadecimal (#rrggbb) de una longitud de onda, con su brillo máximo. */
export function wavelengthToHex(lambda_nm: number): string {
  return `#${wavelengthLinearRgb(lambda_nm).map((c) => Math.round(srgbEncode(c) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const WHITE_XYZ: [number, number, number] = WHITE_SAMPLES_NM.reduce<[number, number, number]>((acc, l) => {
  const c = cieXYZ(l); return [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]];
}, [0, 0, 0]);
/** sRGB lineal de la luz blanca completa: se usa para equilibrar el blanco (el centro del patrón se ve blanco). */
const WHITE_RGB = xyzToLinearRgb(WHITE_XYZ);
const WHITE_Y = WHITE_XYZ[1];

export interface ScreenColor { rgb: [number, number, number]; /** Intensidad (luminancia) relativa al centro del patrón. */ lum: number }

/**
 * Color y luminancia en un punto de la pantalla (sen θ dado).
 * Monocromática: color del láser × I. Blanca: suma espectral con las funciones CIE y balance de blanco.
 */
export function screenColor(ap: Aperture, source: LightSource, sinTheta: number): ScreenColor {
  if (source.wavelength !== null) {
    const I = intensity(ap, sinTheta, source.wavelength * 1e-9);
    const c = wavelengthLinearRgb(source.wavelength);
    return { rgb: [c[0] * I, c[1] * I, c[2] * I], lum: I };
  }
  let X = 0, Y = 0, Z = 0;
  for (const l of WHITE_SAMPLES_NM) {
    const I = intensity(ap, sinTheta, l * 1e-9);
    if (I < 1e-7) continue;
    const c = cieXYZ(l);
    X += c[0] * I; Y += c[1] * I; Z += c[2] * I;
  }
  const rgb = xyzToLinearRgb([X, Y, Z]);
  return { rgb: [Math.max(0, rgb[0] / WHITE_RGB[0]), Math.max(0, rgb[1] / WHITE_RGB[1]), Math.max(0, rgb[2] / WHITE_RGB[2])], lum: Y / WHITE_Y };
}

/* ------------------------------------------------------------------ instrumentos */

/** Resoluciones: calibrador sobre la pantalla 0,05 mm; regla de la pantalla 1 mm; escala del riel 1 mm; sensor 0,1 %. */
export const CALIPER_RES = 0.05;
export const SCREEN_RULER_RES = 1;
export const RAIL_RES = 0.1;
export const SENSOR_RES = 0.1;
/** Ancho de la ventana del sensor de luz (mm): la lectura es el promedio de la intensidad sobre esa ventana. */
export const SENSOR_WINDOW_MM = 0.2;

export const INTERFERENCE_INSTRUMENTS = [
  { id: 'calibrador', name: 'Calibrador (pie de rey) apoyado en la pantalla', quantity: 'Posición de una franja', unit: 'mm', resolution: CALIPER_RES, sigma: 0.06, note: 'Las franjas no tienen bordes nítidos: decidir dónde está el centro de una franja (o de un mínimo) es la mayor fuente de error.' },
  { id: 'regla', name: 'Regla milimetrada pegada a la pantalla', quantity: 'Posición de un orden de la red', unit: 'mm', resolution: SCREEN_RULER_RES, sigma: 0.5, note: 'Grosor de la mancha de luz y paralaje al leer la regla.' },
  { id: 'riel', name: 'Escala del riel óptico', quantity: 'Distancia rendija–pantalla L', unit: 'cm', resolution: RAIL_RES, sigma: 0.15, note: 'Ubicar el plano de la diapositiva y de la pantalla sobre la escala del riel.' },
  { id: 'sensor', name: 'Sensor de luz (fotodiodo con ventana de 0,2 mm)', quantity: 'Intensidad relativa al máximo central', unit: '%', resolution: SENSOR_RES, sigma: 0.2, relSigma: 0.02, note: 'Luz ambiente, ruido electrónico y fluctuaciones de la potencia del láser.' },
];

/** Lectura ideal del sensor (%): promedio de la luminancia relativa sobre la ventana del sensor centrada en y. */
export function sensorIntensity(ap: Aperture, source: LightSource, L_cm: number, y_mm: number, window_mm = SENSOR_WINDOW_MM): number {
  assertInRange('La distancia L', L_cm, ...INTERFERENCE_LIMITS.distance);
  assertInRange('La posición del sensor', y_mm, -INTERFERENCE_LIMITS.screenHalfWidth, INTERFERENCE_LIMITS.screenHalfWidth);
  const n = 21, L = L_cm * 10;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const y = y_mm + window_mm * (i / (n - 1) - 0.5);
    s += screenColor(ap, source, sinThetaOnScreen(y, L)).lum;
  }
  return roundToResolution((100 * s) / n, 1e-4);
}

/* ------------------------------------------------------------------ análisis con los cursores */

export interface CursorInput {
  kind: ElementKind;
  /** Dimensión conocida del elemento (µm): a (simple), d (doble y red) o D (circular); null si se desconoce. */
  dim_um: number | null;
  /** Longitud de onda conocida (nm); null si se desconoce (láser desconocido o luz blanca). */
  lambda_nm: number | null;
  L_cm: number;
  yA_mm: number;
  yB_mm: number;
  /** Orden (o número de anillo) que marcan los cursores a cada lado del centro. */
  m: number;
}

export interface CursorResult {
  dy: number; y: number; sinTheta: number; thetaDeg: number;
  /** Coeficiente de la condición: m (rendijas, redes) o 1,22; 2,23; 3,24 (anillos de Airy). */
  k: number;
  lambdaCalc: number | null; dimCalc: number | null;
  /** Separación entre franjas con ángulo pequeño, y/m (mm). */
  spacing: number;
}

/**
 * Con los cursores sobre el m-ésimo mínimo (rendija simple, anillo oscuro) o el m-ésimo máximo (doble rendija,
 * red) a cada lado: y = Δy/2, sen θ = y/√(y² + L²) y dim·sen θ = k·λ, sin aproximar el ángulo.
 */
export function analyzeCursors(c: CursorInput): CursorResult {
  assertInRange('La distancia L', c.L_cm, ...INTERFERENCE_LIMITS.distance);
  assertInRange('El orden m', c.m, 1, c.kind === 'circular' ? 3 : 20);
  const dy = Math.abs(c.yB_mm - c.yA_mm);
  const y = dy / 2;
  const sinTheta = sinThetaOnScreen(y, c.L_cm * 10);
  const k = c.kind === 'circular' ? AIRY_ZEROS[c.m - 1] : c.m;
  const lambdaCalc = c.dim_um !== null && sinTheta > 0 ? (c.dim_um * 1000 * sinTheta) / k : null;
  const dimCalc = c.lambda_nm !== null && sinTheta > 0 ? (k * c.lambda_nm) / (1000 * sinTheta) : null;
  return { dy, y, sinTheta, thetaDeg: Math.asin(sinTheta) * DEG, k, lambdaCalc, dimCalc, spacing: y / c.m };
}

/** Frecuencia de la luz (Hz) a partir de su longitud de onda en el aire (nm). */
export const lightFrequency = (lambda_nm: number) => C_LIGHT / (lambda_nm * 1e-9);

/* ------------------------------------------------------------------ bonus: película delgada (pompa de jabón) */

export const SOAP_INDEX = 1.33;

/**
 * Reflectancia relativa de una película de jabón en el aire a incidencia normal (dos haces de igual amplitud,
 * con el cambio de fase de π en la primera cara): R ∝ sen²(2π·n·t/λ).
 */
export function thinFilmReflectance(lambda_nm: number, t_nm: number, n = SOAP_INDEX): number {
  assertInRange('El espesor de la película', t_nm, ...INTERFERENCE_LIMITS.film);
  const s = Math.sin((2 * Math.PI * n * t_nm) / lambda_nm);
  return s * s;
}

/** Longitudes de onda visibles (400–700 nm) reforzadas por la película: 2·n·t = (m + ½)·λ. */
export function thinFilmConstructive(t_nm: number, n = SOAP_INDEX): number[] {
  const out: number[] = [];
  for (let m = 0; m < 20; m++) {
    const l = (2 * n * t_nm) / (m + 0.5);
    if (l < 400) break;
    if (l <= 700) out.push(l);
  }
  return out;
}

/** Color (hex) reflejado por la película iluminada con luz blanca. */
export function thinFilmColor(t_nm: number, n = SOAP_INDEX): string {
  let X = 0, Y = 0, Z = 0;
  for (const l of WHITE_SAMPLES_NM) {
    const R = thinFilmReflectance(l, t_nm, n), c = cieXYZ(l);
    X += c[0] * R; Y += c[1] * R; Z += c[2] * R;
  }
  const rgb = xyzToLinearRgb([X, Y, Z]).map((v, i) => Math.max(0, v / WHITE_RGB[i]));
  return `#${rgb.map((c) => Math.round(srgbEncode(c) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/* ------------------------------------------------------------------ ficha del modelo */

export const interferenceModelSpec: ModelSpec = {
  name: 'Difracción e interferencia de Fraunhofer: rendija simple, doble rendija, red de difracción y abertura circular',
  inputs: [
    { symbol: 'λ', name: 'Longitud de onda del láser (rojo, verde, violeta, desconocido) o luz blanca', unit: 'nm', range: [405, 650], initial: 650 },
    { symbol: 'a', name: 'Ancho de cada rendija', unit: 'µm', range: INTERFERENCE_LIMITS.slitWidth, initial: 50 },
    { symbol: 'd', name: 'Separación entre rendijas (doble rendija)', unit: 'µm', range: INTERFERENCE_LIMITS.slitSeparation, initial: 250 },
    { symbol: '1/d', name: 'Líneas por milímetro de la red (100, 300, 600, CD ≈ 625, DVD ≈ 1350)', unit: 'líneas/mm', initial: 600 },
    { symbol: 'D', name: 'Diámetro del agujero circular', unit: 'µm', range: INTERFERENCE_LIMITS.aperture, initial: 100 },
    { symbol: 'L', name: 'Distancia de la diapositiva a la pantalla', unit: 'cm', range: INTERFERENCE_LIMITS.distance, initial: 100 },
  ],
  outputs: [
    { symbol: 'I/I₀', name: 'Intensidad relativa en la pantalla (sensor de luz)', unit: '%' },
    { symbol: 'y', name: 'Posición de un máximo o mínimo en la pantalla', unit: 'mm' },
    { symbol: 'θ', name: 'Ángulo de difracción', unit: '°' },
    { symbol: 'λ_calc', name: 'Longitud de onda calculada con los cursores', unit: 'nm' },
    { symbol: 'd_calc', name: 'Periodo (o ancho, o diámetro) calculado con los cursores', unit: 'µm' },
  ],
  equations: [
    'Rendija simple: I/I₀ = [sen β / β]², β = π·a·sen θ/λ; mínimos: a·sen θ = m·λ',
    'Doble rendija: I/I₀ = cos²(π·d·sen θ/λ)·[sen β / β]²; máximos: d·sen θ = m·λ; Δy ≈ λ·L/d',
    'Red de N rendijas: I/I₀ = [sen β / β]²·[sen(N·φ/2) / (N·sen(φ/2))]², φ = 2π·d·sen θ/λ; máximos: d·sen θ = m·λ (exacta)',
    'Abertura circular (Airy): I/I₀ = [2·J₁(x)/x]², x = π·D·sen θ/λ; primer anillo oscuro: D·sen θ = 1,22·λ',
    'Pantalla plana: y = L·tan θ  ⇔  sen θ = y/√(y² + L²)',
    'Color: funciones CIE 1931 (aproximación de Wyman–Sloan–Shirley) → XYZ → sRGB',
    'Bonus, película de jabón: R ∝ sen²(2π·n·t/λ); refuerzo cuando 2·n·t = (m + ½)·λ',
  ],
  initialConditions: [
    'Láser rojo de 650 nm, doble rendija con d = 250 µm y a = 50 µm, pantalla a L = 100 cm.',
    'Cursores del calibrador en −5,00 mm y +5,00 mm, orden m = 2; sensor de luz en el centro (y = 0).',
  ],
  assumptions: [
    'Campo lejano (Fraunhofer): la pantalla está lejos comparada con a²/λ (número de Fresnel ≪ 1); el laboratorio avisa cuando no se cumple.',
    'Láseres monocromáticos y coherentes, con frente de onda plano que ilumina toda la abertura por igual; la luz blanca se representa con 31 longitudes de onda (400–700 nm) de igual energía.',
    'Rendijas largas, rectangulares y de bordes perfectos; en las redes el haz de 1 mm ilumina N = (líneas/mm) × 1 mm rendijas y la parte transparente es un cuarto del periodo (a = d/4).',
    'El CD y el DVD sin capa metálica se tratan como redes de transmisión de pistas rectas y paralelas (pasos de 1,6 µm y 0,74 µm).',
    'Las posiciones en la pantalla usan la geometría exacta y = L·tan θ; la intensidad es la de Fraunhofer en función de θ.',
  ],
  limits: [
    'No incluye la difracción de Fresnel (pantalla muy cerca), la caída de intensidad por oblicuidad y por 1/r² en pantallas planas ni la polarización.',
    'El ancho finito de la rendija se modela con la envolvente sinc²: por eso algunos órdenes de la doble rendija desaparecen (cuando d/a es entero) y los órdenes altos de las redes son tenues.',
    'El brillo de la pantalla está comprimido (exposición ajustable) para ver los máximos débiles; las intensidades numéricas vienen del sensor, no del brillo de la imagen.',
    'Los colores son aproximados: los colores espectrales están fuera de la gama de una pantalla sRGB y se recortan a la gama; cerca de 700 nm la aproximación analítica de las funciones CIE pierde exactitud.',
    'La longitud de onda del láser desconocido y los pasos del CD y del DVD son valores didácticos típicos.',
  ],
  testCases: [
    'sinc²: ceros exactos en a·sen θ = λ, 2λ, 3λ; máximo secundario ≈ 4,72 %.',
    'Doble rendija (650 nm, d = 0,25 mm, L = 1 m): Δy ≈ 2,60 mm; máximos donde d·sen θ = m·λ.',
    'Red de 600 líneas/mm con 532 nm: θ₁ = arcsen(0,3192) ≈ 18,61° (exacto, no ángulo pequeño); con 650 nm solo hay dos órdenes a cada lado.',
    'Airy: J₁(3,8317) ≈ 0 y primer mínimo en D·sen θ = 1,22·λ.',
    'Color: 650 nm es rojo, 532 nm verde, 450 nm azul; fuera de 380–780 nm es negro.',
    'Cursores: con la pantalla a 1 m y el segundo máximo en ±5,20 mm, λ calculada ≈ 650 nm.',
  ],
};

/* ------------------------------------------------------------------ condiciones y correcciones */

/** Número de Fresnel máximo con el que el patrón se trata como de Fraunhofer (campo lejano). */
export const FRESNEL_MAX = 0.3;

export interface InterferenceSetup {
  ap: Aperture;
  /** Longitud de onda de la fuente (nm); null para la luz blanca. */
  wavelength: number | null;
  /** Distancia rendija–pantalla (cm). */
  L: number;
  /** Separación d y ancho a de la doble rendija (µm). */
  dUm: number;
  aUm: number;
}

const L_LABEL = '«Distancia rendija–pantalla L»';

/** Advertencias de la práctica con su nivel y su corrección, con los mismos umbrales del modelo. */
export function interferenceConditions(s: InterferenceSetup): ModelCondition[] {
  const { ap, L } = s;
  const out: ModelCondition[] = [];
  const lam = (s.wavelength ?? 550) * 1e-9;
  if (ap.kind !== 'red' && fresnelNumber(ap, lam, L / 100) > FRESNEL_MAX) {
    // N_F = (h²)/(λ·L) ≤ 0,3  →  L ≥ h²/(0,3·λ)
    const half = ap.kind === 'circular' ? ap.D / 2 : ap.kind === 'simple' ? ap.a / 2 : (ap.d + ap.a) / 2;
    const lMin = Math.ceil(((half * half) / (FRESNEL_MAX * lam)) * 100);
    const control = ap.kind === 'circular' ? '«Diámetro del agujero D»' : ap.kind === 'simple' ? '«Ancho de la rendija a»' : '«Separación entre rendijas d»';
    out.push({
      text: 'La pantalla está muy cerca para esta abertura (número de Fresnel > 0,3): el patrón real se aparta del de Fraunhofer. Aleja la pantalla.', level: 'invalido',
      fix: lMin <= INTERFERENCE_LIMITS.distance[1]
        ? `Sube la ${L_LABEL} a ${num(lMin)} cm o más.`
        : `Ni a ${num(INTERFERENCE_LIMITS.distance[1])} cm basta: baja el ${control} y aleja la pantalla.`,
    });
  }
  if (ap.kind === 'red' && s.wavelength !== null) {
    const s1 = (s.wavelength * 1e-9) / ap.d;
    // Redes con periodo mayor que λ (sí tienen primer orden), de menos a más líneas por milímetro.
    const ok = GRATINGS.filter((g) => !g.hidden && 1e-3 / g.linesPerMm > s.wavelength! * 1e-9).map((g) => g.name.toLowerCase());
    const fewer = ok.length > 0 ? `elige la ${ok[0]}` : 'elige una red con menos líneas por milímetro';
    if (s1 >= 1) {
      out.push({
        text: 'Con esta red y esta luz no existe el primer orden (d·sen θ = λ exigiría sen θ > 1).', level: 'invalido',
        fix: `En «Red de difracción», ${fewer}: su periodo d debe ser mayor que la longitud de onda (${num(s.wavelength)} nm).`,
      });
    } else {
      const tan = s1 / Math.sqrt(1 - s1 * s1);
      if (Math.abs(L * 10 * tan) > INTERFERENCE_LIMITS.screenHalfWidth) {
        // y = L·tan θ ≤ media pantalla  →  L ≤ (media pantalla)/tan θ
        const lMax = Math.floor(INTERFERENCE_LIMITS.screenHalfWidth / (10 * tan));
        out.push({
          text: 'El primer orden cae fuera de la pantalla: acerca la pantalla a la red.', level: 'invalido',
          fix: lMax >= INTERFERENCE_LIMITS.distance[0]
            ? `Baja la ${L_LABEL} a ${num(lMax)} cm o menos.`
            : `Ni con la pantalla a ${num(INTERFERENCE_LIMITS.distance[0])} cm cabe: en «Red de difracción», elige una red con menos líneas por milímetro.`,
        });
      }
    }
  }
  if (ap.kind === 'doble' && Number.isInteger(s.dUm / s.aUm)) {
    const k = num(s.dUm / s.aUm);
    out.push({
      text: `d/a = ${k} es entero: el máximo de orden ${k} coincide con un cero de la envolvente y desaparece (orden ausente).`, level: 'nota',
      fix: 'Si quieres ver ese máximo, cambia el «Ancho de la rendija a» o la «Separación entre rendijas d» para que d/a no sea un número entero.',
    });
  }
  return out;
}

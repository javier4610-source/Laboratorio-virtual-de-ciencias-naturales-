/**
 * Utilidades numéricas compartidas por los modelos científicos.
 * No dependen de React ni del navegador para que puedan probarse con Vitest.
 */

/** Constante de los gases ideales, J/(mol·K). */
export const R_GAS = 8.314462618;

export const celsiusToKelvin = (c: number) => c + 273.15;

/** Restringe un valor al intervalo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Redondea una lectura a la resolución de un instrumento
 * (p. ej. 0,1 g para una balanza escolar). Evita errores de coma flotante.
 */
export function roundToResolution(value: number, resolution: number): number {
  if (resolution <= 0) return value;
  const decimals = Math.max(0, Math.ceil(-Math.log10(resolution)) + 1);
  return Number((Math.round(value / resolution) * resolution).toFixed(decimals));
}

/** Valida que un número sea finito y esté dentro del rango; lanza un error explicativo si no. */
export function assertInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} debe ser un número válido.`);
  if (value < min || value > max) {
    throw new RangeError(`${name} debe estar entre ${min} y ${max} (valor recibido: ${value}).`);
  }
}

/** Generador pseudoaleatorio con semilla (mulberry32): resultados reproducibles. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integración Runge-Kutta de orden 4 para un sistema escalar dy/dt = f(t, y). */
export function rk4Step(f: (t: number, y: number) => number, t: number, y: number, dt: number): number {
  const k1 = f(t, y);
  const k2 = f(t + dt / 2, y + (dt * k1) / 2);
  const k3 = f(t + dt / 2, y + (dt * k2) / 2);
  const k4 = f(t + dt, y + dt * k3);
  return y + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

/** Regresión lineal por mínimos cuadrados. */
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number; r: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; syy += ys[i] * ys[i];
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const vy = n * syy - sy * sy;
  const r = vy <= 1e-12 ? 0 : (n * sxy - sx * sy) / Math.sqrt(denom * vy);
  return { slope, intercept, r2: r * r, r };
}

/** Logaritmo de la función gamma (aproximación de Lanczos). */
export function lnGamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Función gamma incompleta regularizada inferior P(a, x). */
export function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a, term = 1 / a;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  // Fracción continua para Q(a, x)
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Valor p de una prueba chi-cuadrado (cola superior). */
export function chiSquarePValue(chi2: number, df: number): number {
  if (df <= 0) return NaN;
  return 1 - regularizedGammaP(df / 2, chi2 / 2);
}

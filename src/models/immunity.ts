import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Sistema inmune, vacunas e inmunidad colectiva (grado 11.º).
 *
 * 1) Respuesta de anticuerpos primaria y secundaria (memoria inmunológica). Forma ILUSTRATIVA de los manuales de
 *    inmunología (Abbas, Lichtman y Pillai): en el primer contacto hay una fase de latencia de alrededor de una semana
 *    y un pico modesto, sobre todo de IgM; en un segundo contacto, gracias a las células de memoria, la latencia es de
 *    pocos días y el pico de IgG es mucho mayor y dura más. Se modela cada respuesta como una curva gamma; los días y
 *    las alturas son ilustrativos, no mediciones.
 * 2) Epidemia con el modelo SIR (Kermack y McKendrick, 1927) en una población cerrada:
 *      dS/dt = −β·S·I/N,  dI/dt = β·S·I/N − γ·I,  dR/dt = γ·I,  R₀ = β/γ
 *    integrado con Runge–Kutta de 4.º orden. Las personas vacunadas con éxito (cobertura × eficacia) empiezan en R.
 * 3) Umbral de inmunidad colectiva: H = 1 − 1/R₀ (Anderson y May, 1991); cobertura necesaria con una vacuna de
 *    eficacia e: V = H/e. Con R₀ entre 12 y 18 (sarampión, intervalo citado por Guerra y otros, 2017) H va de 92 % a
 *    94 %; con R₀ ≈ 1,3 (influenza estacional, mediana de Biggerstaff y otros, 2014) H ≈ 22 %. Eficacia de la vacuna
 *    contra el sarampión: ≈ 93 % con una dosis y ≈ 97 % con dos (CDC, Pink Book).
 * No es un modelo para tomar decisiones de salud: no reemplaza a los médicos ni a las autoridades de salud.
 * Este archivo no depende de React ni del navegador.
 */

/* ------------------------------------------------------------------ respuesta de anticuerpos */

export interface ResponseCurve { lagDays: number; peakDay: number; peak: number }
/** Formas ilustrativas: título relativo de anticuerpos (1 = pico de la respuesta primaria). */
export const PRIMARY: ResponseCurve = { lagDays: 5, peakDay: 12, peak: 1 };
export const SECONDARY: ResponseCurve = { lagDays: 1.5, peakDay: 6, peak: 20 };

/** Curva gamma que vale 0 antes de la latencia y tiene su máximo `peak` en `peakDay` días después del contacto. */
export function responseAt(c: ResponseCurve, days: number): number {
  const t = days - c.lagDays;
  if (t <= 0) return 0;
  const tp = c.peakDay - c.lagDays;
  const k = 3; // forma
  const theta = tp / (k - 1);
  return c.peak * (t / tp) ** (k - 1) * Math.exp(-(t - tp) / theta);
}

export interface Exposure { day: number; kind: 'vacuna' | 'infeccion' }
export interface AntibodyRun { points: { day: number; titer: number }[]; peaks: { day: number; titer: number; secondary: boolean }[] }
/**
 * Título de anticuerpos con uno o dos contactos con el mismo antígeno (vacuna o infección). El segundo contacto genera
 * la respuesta secundaria si ocurre después del pico de la primaria (ya hay células de memoria).
 */
export function antibodyResponse(exposures: Exposure[], horizon = 60): AntibodyRun {
  assertInRange('Los días', horizon, 10, 365);
  const sorted = [...exposures].sort((a, b) => a.day - b.day);
  const curves = sorted.map((e, i) => ({ start: e.day, c: i > 0 && e.day - sorted[0].day >= PRIMARY.peakDay ? SECONDARY : PRIMARY }));
  const points: { day: number; titer: number }[] = [];
  for (let d = 0; d <= horizon; d += 0.25) points.push({ day: d, titer: curves.reduce((s, x) => s + responseAt(x.c, d - x.start), 0) });
  const peaks = curves.map((x) => {
    const day = x.start + x.c.peakDay;
    return { day, titer: curves.reduce((s, y) => s + responseAt(y.c, day - y.start), 0), secondary: x.c === SECONDARY };
  });
  return { points, peaks };
}

/* ------------------------------------------------------------------ SIR */

export interface Disease { id: string; name: string; R0: [number, number]; infectiousDays: number; source: string }
/** R₀ con su fuente; los días infecciosos son valores redondeados e ilustrativos para el modelo. */
export const DISEASES: Disease[] = [
  { id: 'sarampion', name: 'Sarampión', R0: [12, 18], infectiousDays: 8, source: 'R₀ 12–18: intervalo citado comúnmente (Guerra y otros, 2017, Lancet Infectious Diseases).' },
  { id: 'influenza', name: 'Influenza estacional', R0: [1.19, 1.37], infectiousDays: 4, source: 'R₀ ≈ 1,28 (mediana; intercuartil 1,19–1,37) de la revisión de Biggerstaff y otros (2014), BMC Infectious Diseases.' },
  { id: 'imaginaria', name: 'Enfermedad imaginaria (elige R₀)', R0: [1, 20], infectiousDays: 7, source: 'Ilustrativa: no es una enfermedad real.' },
];
export function findDisease(id: string): Disease {
  const d = DISEASES.find((x) => x.id === id);
  if (!d) throw new RangeError(`Enfermedad desconocida: ${id}`);
  return d;
}
/** Eficacia de la vacuna contra el sarampión (CDC, Epidemiology and Prevention of Vaccine-Preventable Diseases). */
export const MEASLES_VACCINE = { oneDose: 0.93, twoDoses: 0.97 };

export const herdThreshold = (R0: number) => (R0 > 1 ? 1 - 1 / R0 : 0);
/** Cobertura de vacunación necesaria con una vacuna de eficacia e (puede ser > 1: inalcanzable). */
export const coverageNeeded = (R0: number, efficacy: number) => herdThreshold(R0) / efficacy;

export const SIR_LIMITS = { R0: [0.5, 20] as [number, number], coverage: [0, 1] as [number, number], efficacy: [0.5, 1] as [number, number], N: [100, 1e6] as [number, number] };

export interface SirInput { R0: number; infectiousDays: number; coverage: number; efficacy: number; N: number; I0: number; days: number }
export interface SirRun {
  input: SirInput;
  points: { day: number; S: number; I: number; R: number; V: number }[];
  peak: { day: number; I: number };
  totalInfected: number; attackRate: number;
  Reff0: number; protectedFraction: number; threshold: number; herd: boolean;
}

export function simulateSIR(input: SirInput): SirRun {
  const { R0, infectiousDays, coverage, efficacy, N, I0, days } = input;
  assertInRange('R₀', R0, ...SIR_LIMITS.R0);
  assertInRange('La cobertura', coverage, ...SIR_LIMITS.coverage);
  assertInRange('La eficacia', efficacy, 0, 1);
  assertInRange('La población', N, ...SIR_LIMITS.N);
  const gamma = 1 / infectiousDays, beta = R0 * gamma;
  const V = coverage * efficacy * (N - I0); // protegidos por la vacuna
  let S = N - I0 - V, I = I0, R = 0;
  const f = (s: number, i: number) => { const inf = (beta * s * i) / N; return [-inf, inf - gamma * i, gamma * i]; };
  const dt = 0.1;
  const points = [{ day: 0, S, I, R, V }];
  let peak = { day: 0, I };
  const steps = Math.round(days / dt);
  for (let k = 1; k <= steps; k++) {
    const a = f(S, I);
    const b = f(S + (dt / 2) * a[0], I + (dt / 2) * a[1]);
    const c = f(S + (dt / 2) * b[0], I + (dt / 2) * b[1]);
    const d = f(S + dt * c[0], I + dt * c[1]);
    S += (dt / 6) * (a[0] + 2 * b[0] + 2 * c[0] + d[0]);
    I += (dt / 6) * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    R += (dt / 6) * (a[2] + 2 * b[2] + 2 * c[2] + d[2]);
    if (I > peak.I) peak = { day: k * dt, I };
    if (k % 10 === 0) points.push({ day: k * dt, S, I, R, V });
  }
  const totalInfected = R + I - 0; // los que se infectaron (incluye los casos iniciales)
  const susceptible0 = N - V;
  const threshold = herdThreshold(R0);
  const protectedFraction = V / N;
  return {
    input, points, peak, totalInfected, attackRate: totalInfected / N,
    Reff0: (R0 * (N - I0 - V)) / N, protectedFraction, threshold, herd: protectedFraction >= threshold && susceptible0 > 0,
  };
}

/** Tamaño final de la epidemia sin vacunas (fracción z que se infecta): z = 1 − e^(−R₀·z) (ecuación del tamaño final). */
export function finalSize(R0: number): number {
  if (R0 <= 1) return 0;
  let z = 0.5;
  for (let i = 0; i < 200; i++) z = 1 - Math.exp(-R0 * z);
  return z;
}

export interface ImCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function sirConditions(run: SirRun, diseaseId: string): ImCondition[] {
  const out: ImCondition[] = [];
  const need = coverageNeeded(run.input.R0, run.input.efficacy);
  if (need > 1) out.push({ level: 'advertencia', text: `Con R₀ = ${run.input.R0.toFixed(1).replace('.', ',')} y una vacuna de eficacia ${Math.round(run.input.efficacy * 100)} % haría falta vacunar al ${Math.round(need * 100)} % de la población: imposible solo con esta vacuna.`, fix: 'Sube la eficacia (por ejemplo, con dos dosis) o combina la vacunación con otras medidas que bajen los contagios.' });
  else if (!run.herd && run.input.coverage > 0) out.push({ level: 'nota', text: `La cobertura de ${Math.round(run.input.coverage * 100)} % no alcanza el umbral: protege al ${Math.round(run.protectedFraction * 100)} % y haría falta ${Math.round(run.threshold * 100)} %; el brote igual crece entre los no protegidos.`, fix: `Sube la cobertura por encima de ${Math.round(need * 100)} %.` });
  if (diseaseId === 'sarampion' && run.input.R0 < 12) out.push({ level: 'nota', text: 'Para el sarampión se cita un R₀ entre 12 y 18; un valor menor subestima el brote.', fix: 'Usa un R₀ dentro del intervalo citado.' });
  out.push({ level: 'nota', text: 'Es un modelo SIR de una población cerrada y bien mezclada: no tiene edades, viajes, cuarentenas ni cambios de conducta. No sirve para tomar decisiones de salud.', fix: 'Para tu salud y la de tu familia sigue las indicaciones del personal de salud y el esquema de vacunación oficial.' });
  return out;
}

export const immunitySpec: ModelSpec = {
  name: 'Respuesta inmune primaria y secundaria (forma ilustrativa), epidemia SIR con vacunación e inmunidad colectiva',
  inputs: [
    { symbol: 'contactos', name: 'Días de la vacuna o de la infección', unit: 'día', range: [0, 60], initial: 'día 0 y día 30' },
    { symbol: 'R₀', name: 'Número reproductivo básico', unit: '—', range: [0.5, 20], initial: 15 },
    { symbol: 'c', name: 'Cobertura de vacunación', unit: '%', range: [0, 100], initial: 0 },
    { symbol: 'e', name: 'Eficacia de la vacuna', unit: '%', range: [50, 100], initial: 97 },
  ],
  outputs: [
    { symbol: 'título', name: 'Anticuerpos relativos al pico primario', unit: '—' },
    { symbol: 'S, I, R', name: 'Susceptibles, infectados y recuperados', unit: 'personas' },
    { symbol: 'H', name: 'Umbral de inmunidad colectiva', unit: '%' },
  ],
  equations: [
    'dS/dt = −β·S·I/N;  dI/dt = β·S·I/N − γ·I;  dR/dt = γ·I;  R₀ = β/γ',
    'Vacunados protegidos = cobertura × eficacia × población (empiezan inmunes)',
    'H = 1 − 1/R₀;  cobertura necesaria = H/eficacia',
    'Tamaño final sin vacunas: z = 1 − e^(−R₀·z)',
  ],
  initialConditions: ['Población de 10 000 personas (ilustrativa) con 5 casos iniciales; sarampión con R₀ = 15 y 8 días de contagio.'],
  assumptions: [
    'Población cerrada y bien mezclada; todos igual de susceptibles; la inmunidad dura toda la simulación.',
    'R₀ de fuentes citadas (sarampión 12–18; influenza ≈ 1,3) o de una enfermedad imaginaria rotulada; días de contagio redondeados.',
    'La forma de la respuesta de anticuerpos es ilustrativa (manual de Abbas y otros).',
  ],
  limits: [
    'No hay estructura por edades, escuelas, viajes, cuarentenas ni cambios de conducta: un brote real es distinto.',
    'La eficacia de una vacuna puede bajar con el tiempo; el modelo la supone constante.',
    'No es un modelo para decisiones de salud pública ni consejo médico.',
  ],
  testCases: [
    'Umbral: R₀ = 12 → 91,7 %; R₀ = 18 → 94,4 %; R₀ = 1,28 → 21,9 %.',
    'Sarampión con R₀ = 15 y vacuna de 97 %: cobertura necesaria 96,2 %.',
    'Sin vacunas y R₀ = 2, el SIR termina con ≈ 79,7 % de la población infectada, como la ecuación del tamaño final.',
    'La respuesta secundaria tiene un pico 20 veces mayor y llega antes que la primaria (forma ilustrativa).',
  ],
};

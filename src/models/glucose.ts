import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Homeostasis de la glucosa: insulina y glucagón (grado 10.º).
 *
 * Núcleo: modelo mínimo de Bergman (Bergman, Ider, Bowden y Cobelli, 1979) para la glucosa G (mg/dL) y la acción de la
 * insulina en un compartimento remoto X (1/min):
 *   dG/dt = −(p₁ + X + e(t))·G + p₁·G_b + R_a(t) + H(t)
 *   dX/dt = −p₂·X + p₃·(I − I_b)
 * con los parámetros de un sujeto normal de la literatura de control (Furler y otros, 1985, citados por Fisher, 1991):
 * p₁ = 0,028735 min⁻¹ (eficacia de la glucosa), p₂ = 0,028344 min⁻¹ y p₃ = 5,035 × 10⁻⁵ min⁻²·(µU/mL)⁻¹, y la depuración
 * de la insulina n = 5/54 min⁻¹ (vida media ≈ 7,5 min).
 * Extensiones EDUCATIVAS con parámetros ILUSTRATIVOS (no son de un artículo; se eligieron para que la persona sana tenga
 * una curva de tolerancia típica: pico ≈ 165 mg/dL hacia los 30 min y < 140 mg/dL a las 2 h):
 *   · secreción de insulina del páncreas proporcional al exceso de glucosa (como el modelo mínimo de la insulina de
 *     Toffolo y otros, 1980, sin su factor t): dI/dt = −n·(I − I_b) + β·γ·max(0, G − G_b) + k_a·D_sc/V_I
 *   · glucagón (pg/mL) que sube cuando la glucosa baja de 85 mg/dL y baja cuando sube de G_b; solo su EXCESO sobre el
 *     basal suma producción de glucosa en el hígado, H = k_N·max(0, N − N_b) (la supresión de la producción del hígado
 *     después de comer ya está dentro de p₁ y X).
 *   · absorción de la comida: R_a = f·k_abs·Q/(V_G·peso), con f = 0,9 y V_G = 1,88 dL/kg (Dalla Man y otros, 2007),
 *     y k_abs ilustrativo; ejercicio como captación extra de glucosa e(t), independiente de la insulina.
 *   · perfiles de ejemplo: diabetes tipo 2 (resistencia a la insulina: p₃ y p₁ menores y menos secreción) y tipo 1 (sin
 *     secreción de insulina; la insulina basal I_b la da una inyección lenta) con inyección de insulina rápida opcional.
 * Criterios de la American Diabetes Association (Standards of Care in Diabetes—2025, sección 2): en ayunas < 100 mg/dL
 * normal, 100–125 prediabetes, ≥ 126 diabetes; 2 h después de 75 g de glucosa < 140 normal, 140–199 prediabetes, ≥ 200
 * diabetes; < 70 mg/dL hipoglucemia (nivel 1) y < 54 mg/dL nivel 2. Este archivo no depende de React ni del navegador y
 * NO sirve para diagnosticar ni para decidir dosis de insulina.
 */

export const BERGMAN = { p1: 0.028735, p2: 0.028344, p3: 5.035e-5, n: 5 / 54 };
export const ABSORPTION = { f: 0.9, VG: 1.88, weight: 70 }; // f y V_G (dL/kg): Dalla Man y otros (2007); peso de referencia (kg)
export const ILLUSTRATIVE = { gamma: 0.04, kN: 0.03, sN: 0.5, sD: 0.02, kn: 0.05, Nb: 60, glucagonThreshold: 85, ka: 0.02, VI: 12000, exercise: 0.015 };
export const ADA = { fasting: [100, 126] as [number, number], ogtt2h: [140, 200] as [number, number], hypo1: 70, hypo2: 54 };
export const DT = 0.5; // min, paso de RK4
export const DURATION = 240; // min de simulación después del ayuno

export type ProfileId = 'normal' | 'tipo2' | 'tipo1';
export interface Profile { id: ProfileId; name: string; Gb: number; Ib: number; p1: number; p3: number; beta: number; note: string }
export const PROFILES: Profile[] = [
  { id: 'normal', name: 'Persona sana', Gb: 85, Ib: 10, p1: BERGMAN.p1, p3: BERGMAN.p3, beta: 1, note: 'Parámetros del modelo mínimo de un sujeto normal.' },
  { id: 'tipo2', name: 'Diabetes tipo 2 (ejemplo)', Gb: 140, Ib: 10, p1: 0.014, p3: 0.8e-5, beta: 0.3, note: 'Ejemplo ilustrativo: las células responden poco a la insulina (p₃ ÷ 6) y el páncreas secreta menos.' },
  { id: 'tipo1', name: 'Diabetes tipo 1 (ejemplo)', Gb: 150, Ib: 10, p1: 0.012, p3: BERGMAN.p3, beta: 0, note: 'Ejemplo ilustrativo: el páncreas no produce insulina; la insulina basal la da una inyección lenta.' },
];
export function findProfile(id: string): Profile {
  const p = PROFILES.find((x) => x.id === id);
  if (!p) throw new RangeError(`Perfil desconocido: ${id}`);
  return p;
}

export type MealId = 'ayuno' | 'ptog' | 'almuerzo';
export interface Meal { id: MealId; name: string; grams: number; kabs: number }
export const MEALS: Meal[] = [
  { id: 'ayuno', name: 'Sin comida (ayuno)', grams: 0, kabs: 0.012 },
  { id: 'ptog', name: 'Prueba de tolerancia: 75 g de glucosa disuelta', grams: 75, kabs: 0.012 },
  { id: 'almuerzo', name: 'Almuerzo con arroz y patacón (≈ 60 g de carbohidratos, absorción más lenta)', grams: 60, kabs: 0.007 },
];
export function findMeal(id: string): Meal {
  const m = MEALS.find((x) => x.id === id);
  if (!m) throw new RangeError(`Comida desconocida: ${id}`);
  return m;
}

export interface GlucoseInput {
  profile: ProfileId; meal: MealId;
  /** Ejercicio moderado de 45 min que empieza a los `exerciseStart` min (o null). */
  exerciseStart: number | null;
  /** Unidades de insulina rápida inyectadas con la comida (tipo 1). */
  bolus: number;
  insulinOn: boolean; glucagonOn: boolean;
  /** Glucosa inicial distinta de la basal (mg/dL), para comprobar el modelo con su solución exacta. */
  G0?: number;
}
export const GL_LIMITS = { bolus: [0, 12] as [number, number], exerciseStart: [0, 180] as [number, number], exerciseMin: 45 };

export interface GlucoseState { t: number; G: number; X: number; I: number; N: number; Q: number; S: number }
export interface GlucoseRun {
  points: GlucoseState[]; // cada 1 min
  profile: Profile; meal: Meal; input: GlucoseInput;
  fasting: number; at2h: number; peak: { t: number; G: number }; min: { t: number; G: number };
}

type D = Omit<GlucoseState, 't'>;
function derivatives(t: number, s: D, p: Profile, i: GlucoseInput, m: Meal): D {
  const { f, VG, weight } = ABSORPTION, k = ILLUSTRATIVE;
  const Ra = (f * m.kabs * s.Q) / (VG * weight);
  const ex = i.exerciseStart !== null && t >= i.exerciseStart && t < i.exerciseStart + GL_LIMITS.exerciseMin ? k.exercise : 0;
  const H = i.glucagonOn ? k.kN * Math.max(0, s.N - k.Nb) : 0;
  const X = i.insulinOn ? s.X : 0;
  return {
    Q: -m.kabs * s.Q,
    G: -(p.p1 + X + ex) * s.G + p.p1 * p.Gb + Ra + H,
    X: -BERGMAN.p2 * s.X + p.p3 * (s.I - p.Ib),
    I: -BERGMAN.n * (s.I - p.Ib) + p.beta * k.gamma * Math.max(0, s.G - p.Gb) + (k.ka * s.S) / k.VI,
    N: -k.kn * (s.N - k.Nb) + (i.glucagonOn ? k.sN : 0) * Math.max(0, k.glucagonThreshold - s.G) - k.sD * Math.max(0, s.G - p.Gb),
    S: -k.ka * s.S,
  };
}

/** Simula 240 min con RK4 (paso de 0,5 min); la comida y la inyección son en t = 0. */
export function simulateGlucose(i: GlucoseInput): GlucoseRun {
  assertInRange('La dosis de insulina', i.bolus, GL_LIMITS.bolus[0], GL_LIMITS.bolus[1]);
  if (i.exerciseStart !== null) assertInRange('El inicio del ejercicio', i.exerciseStart, GL_LIMITS.exerciseStart[0], GL_LIMITS.exerciseStart[1]);
  const p = findProfile(i.profile), m = findMeal(i.meal);
  let s: D = { G: i.G0 ?? p.Gb, X: 0, I: p.Ib, N: ILLUSTRATIVE.Nb, Q: m.grams * 1000, S: i.bolus * 1e6 };
  const points: GlucoseState[] = [{ t: 0, ...s }];
  const add = (a: D, b: D, h: number): D => ({ G: a.G + h * b.G, X: a.X + h * b.X, I: a.I + h * b.I, N: a.N + h * b.N, Q: a.Q + h * b.Q, S: a.S + h * b.S });
  const steps = Math.round(DURATION / DT);
  for (let k = 0; k < steps; k++) {
    const t = k * DT;
    const k1 = derivatives(t, s, p, i, m);
    const k2 = derivatives(t + DT / 2, add(s, k1, DT / 2), p, i, m);
    const k3 = derivatives(t + DT / 2, add(s, k2, DT / 2), p, i, m);
    const k4 = derivatives(t + DT, add(s, k3, DT), p, i, m);
    s = add(add(add(add(s, k1, DT / 6), k2, DT / 3), k3, DT / 3), k4, DT / 6);
    s.G = Math.max(1, s.G);
    s.N = Math.max(0.2 * ILLUSTRATIVE.Nb, s.N);
    s.I = Math.max(0, s.I);
    if ((k + 1) % Math.round(1 / DT) === 0) points.push({ t: (k + 1) * DT, ...s });
  }
  const at = (min: number) => points[Math.round(min)];
  let peak = points[0], low = points[0];
  for (const q of points) { if (q.G > peak.G) peak = q; if (q.G < low.G) low = q; }
  return { points, profile: p, meal: m, input: i, fasting: points[0].G, at2h: at(120).G, peak: { t: peak.t, G: peak.G }, min: { t: low.t, G: low.G } };
}
/** Estado interpolado en el minuto t (0–240). */
export function stateAt(run: GlucoseRun, t: number): GlucoseState {
  const tt = Math.max(0, Math.min(DURATION, t));
  const a = Math.floor(tt), b = Math.min(DURATION, a + 1), w = tt - a;
  const A = run.points[a], B = run.points[b];
  const mix = (x: number, y: number) => x + (y - x) * w;
  return { t: tt, G: mix(A.G, B.G), X: mix(A.X, B.X), I: mix(A.I, B.I), N: mix(A.N, B.N), Q: mix(A.Q, B.Q), S: mix(A.S, B.S) };
}

/** Flujos de glucosa en el instante (mg/dL por minuto): entrada desde el intestino y el hígado, captación de los tejidos. */
export function fluxesAt(run: GlucoseRun, s: GlucoseState) {
  const p = run.profile, m = run.meal, i = run.input, k = ILLUSTRATIVE;
  const ex = i.exerciseStart !== null && s.t >= i.exerciseStart && s.t < i.exerciseStart + GL_LIMITS.exerciseMin ? k.exercise : 0;
  const X = i.insulinOn ? s.X : 0;
  const gut = (ABSORPTION.f * m.kabs * s.Q) / (ABSORPTION.VG * ABSORPTION.weight);
  // Producción neta del hígado en el modelo mínimo: p₁·G_b (más el glucagón); captación de los tejidos: (p₁ + X + e)·G.
  const liver = p.p1 * p.Gb + (i.glucagonOn ? k.kN * Math.max(0, s.N - k.Nb) : 0);
  const uptake = (p.p1 + X + ex) * s.G;
  const secretion = p.beta * k.gamma * Math.max(0, s.G - p.Gb);
  return { gut, liver, uptake, secretion, exercising: ex > 0 };
}

export type Category = 'normal' | 'prediabetes' | 'diabetes';
export function fastingCategory(G: number): Category {
  return G >= ADA.fasting[1] ? 'diabetes' : G >= ADA.fasting[0] ? 'prediabetes' : 'normal';
}
export function ogttCategory(G2h: number): Category {
  return G2h >= ADA.ogtt2h[1] ? 'diabetes' : G2h >= ADA.ogtt2h[0] ? 'prediabetes' : 'normal';
}
export const CATEGORY_TEXT: Record<Category, string> = { normal: 'en el rango normal', prediabetes: 'en el rango de prediabetes', diabetes: 'en el rango de diabetes' };

export interface GlCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function glucoseConditions(run: GlucoseRun): GlCondition[] {
  const out: GlCondition[] = [];
  const i = run.input;
  if (run.min.G < ADA.hypo2) out.push({ level: 'advertencia', text: `La glucosa baja a ${Math.round(run.min.G)} mg/dL a los ${Math.round(run.min.t)} min: hipoglucemia de nivel 2 (< 54 mg/dL), peligrosa (mareo, confusión, convulsiones).`, fix: 'Baja la dosis de insulina, no hagas ejercicio justo después de inyectarte o come algo con azúcar.' });
  else if (run.min.G < ADA.hypo1) out.push({ level: 'advertencia', text: `La glucosa baja a ${Math.round(run.min.G)} mg/dL a los ${Math.round(run.min.t)} min: hipoglucemia (< 70 mg/dL).`, fix: i.bolus > 0 ? 'La dosis de insulina es alta para esta comida: bájala una o dos unidades.' : 'Activa el glucagón o come algo antes del ejercicio.' });
  if (i.bolus > 0 && run.profile.id !== 'tipo1') out.push({ level: 'invalido', text: 'En este laboratorio la inyección de insulina rápida es para el perfil con diabetes tipo 1; a una persona sana le causaría una hipoglucemia.', fix: 'Pon la dosis en 0 U o cambia al perfil «Diabetes tipo 1».' });
  if (i.meal === 'ayuno' && i.bolus > 0) out.push({ level: 'advertencia', text: 'Insulina rápida sin comida: no hay glucosa que entre y la glucosa baja.', fix: 'Inyecta la insulina rápida solo con una comida.' });
  if (!i.insulinOn) out.push({ level: 'nota', text: 'Con la acción de la insulina bloqueada, las células casi no captan la glucosa extra: el lazo de retroalimentación negativa está roto.', fix: 'Vuelve a activar la insulina y compara las dos curvas.' });
  if (run.peak.G > 250) out.push({ level: 'nota', text: `La glucosa llega a ${Math.round(run.peak.G)} mg/dL: por encima de ≈ 180 mg/dL el riñón ya no la reabsorbe toda y aparece glucosa en la orina.`, fix: run.profile.id === 'tipo1' ? 'Prueba con una inyección de insulina rápida con la comida.' : 'Compara con la persona sana o con el almuerzo, que se absorbe más despacio.' });
  return out;
}

export const glucoseSpec: ModelSpec = {
  name: 'Modelo mínimo de Bergman con secreción de insulina, glucagón, comida y ejercicio (extensiones ilustrativas)',
  inputs: [
    { symbol: 'perfil', name: 'Persona sana, diabetes tipo 2 o tipo 1 (ejemplos)', unit: '—', initial: 'persona sana' },
    { symbol: 'comida', name: 'Ayuno, 75 g de glucosa (prueba de tolerancia) o almuerzo', unit: 'g', initial: '75 g' },
    { symbol: 'e(t)', name: 'Ejercicio moderado de 45 min', unit: 'min', range: [0, 180], initial: 'no' },
    { symbol: 'D', name: 'Insulina rápida inyectada con la comida (tipo 1)', unit: 'U', range: [0, 12], initial: 0 },
  ],
  outputs: [
    { symbol: 'G', name: 'Glucosa en la sangre', unit: 'mg/dL' },
    { symbol: 'I', name: 'Insulina en el plasma', unit: 'µU/mL' },
    { symbol: 'N', name: 'Glucagón en el plasma (ilustrativo)', unit: 'pg/mL' },
    { symbol: 'X', name: 'Acción de la insulina en los tejidos', unit: '1/min' },
  ],
  equations: [
    'dG/dt = −(p₁ + X + e)·G + p₁·G_b + R_a + k_N·max(0, N − N_b)   (modelo mínimo de Bergman, 1979)',
    'dX/dt = −p₂·X + p₃·(I − I_b);   p₁ = 0,0287, p₂ = 0,0283 min⁻¹, p₃ = 5,0 × 10⁻⁵ min⁻²·(µU/mL)⁻¹',
    'dI/dt = −n·(I − I_b) + β·γ·max(0, G − G_b) + k_a·D_sc/V_I;   n = 0,0926 min⁻¹',
    'dN/dt = −k_n·(N − N_b) + s_N·max(0, 85 − G) − s_D·max(0, G − G_b);   R_a = f·k_abs·Q/(V_G·peso)',
  ],
  initialConditions: ['Ayuno de la noche: G = G_b, I = I_b, N = 60 pg/mL y X = 0; la comida y la inyección se dan en t = 0 y se simulan 4 h.'],
  assumptions: [
    'La sangre es un solo compartimento bien mezclado; la acción de la insulina se retrasa en un compartimento «remoto» (los tejidos).',
    'El páncreas responde al exceso de glucosa sobre el nivel basal y el glucagón solo actúa cuando la glucosa baja; el hígado, el músculo y el tejido adiposo se resumen en la captación (p₁ + X)·G.',
    'Los perfiles de diabetes, el glucagón, la absorción y el ejercicio son extensiones educativas con valores ilustrativos.',
  ],
  limits: [
    'No es un modelo clínico: no sirve para diagnosticar ni para calcular dosis de insulina.',
    'No representa el efecto de las incretinas, la secreción en dos fases del páncreas, el umbral renal ni el estrés.',
    'La glucemia en ayunas de los perfiles con diabetes es un dato de entrada de ejemplo, no un resultado del modelo.',
  ],
  testCases: [
    'Sin comida ni ejercicio la glucosa se queda en G_b (85 mg/dL) durante las 4 h.',
    'Con la insulina bloqueada, G − G_b decae como e^(−p₁·t): de 185 a 102,8 mg/dL en 60 min (solución exacta).',
    'Persona sana con 75 g: pico de ≈ 166 mg/dL hacia los 26 min y 91 mg/dL a las 2 h (normal según la ADA: < 140); tipo 2: ≥ 126 en ayunas y ≥ 200 a las 2 h.',
    'Ejercicio en ayunas: con glucagón la glucosa no baja de 70 mg/dL; sin glucagón baja más.',
  ],
};

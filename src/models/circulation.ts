import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Sistema circulatorio (grado 7.º): ciclo cardíaco, válvulas, gasto cardíaco y respuesta al ejercicio. Modelo EDUCATIVO
 * simplificado con relaciones de los manuales; no es un modelo clínico ni da consejos médicos.
 *
 *  - Gasto cardíaco = FC × VS (≈ 5 L/min en reposo en un adulto; Guyton y Hall).
 *  - FC máxima estimada = 208 − 0,7 × edad (Tanaka, Monahan y Seals, 2001; derivada en adultos).
 *  - FC con el esfuerzo (método de la reserva de Karvonen, 1957): FC = FC_reposo + I·(FC_máx − FC_reposo), I de 0 a 1.
 *  - Volumen sistólico: aumenta con el esfuerzo hasta cerca del 50 % y luego se estabiliza (Wilmore y Costill); el modelo
 *    usa un aumento de 50 % (valor supuesto).
 *  - Presión arterial: la sistólica sube con la intensidad y la diastólica casi no cambia (ACSM); el modelo usa
 *    PAS = 115 + 60·I y PAD = 75 − 5·I mmHg (valores ilustrativos de referencia).
 *  - Ciclo cardíaco: a 72 lpm la sístole ocupa cerca de 0,4 del ciclo y al triple de esa frecuencia cerca de 0,65
 *    (Guyton y Hall): se interpola de forma lineal.
 * Este archivo no depende de React ni del navegador.
 */

export const CIRC_LIMITS = { age: [10, 18] as [number, number], hrRest: [50, 100] as [number, number], svRest: [40, 100] as [number, number], intensity: [0, 100] as [number, number] };
export const BLOOD_VOLUME_L = 5; // adulto de referencia (Guyton y Hall)
export const SV_GAIN = 0.5;
export const RECOVERY_TAU_MIN = 1.5; // constante de recuperación del modelo (valor supuesto)

export const hrMax = (age: number) => 208 - 0.7 * age;
export const cardiacOutput = (hr: number, svML: number) => (hr * svML) / 1000; // L/min

export interface ExerciseInput { age: number; hrRest: number; svRest: number; intensity: number /** % */ }
export interface ExerciseState { hrMax: number; hr: number; sv: number; co: number; sbp: number; dbp: number; map: number; circulationS: number }
export function exercise(i: ExerciseInput): ExerciseState {
  assertInRange('La edad', i.age, CIRC_LIMITS.age[0], CIRC_LIMITS.age[1]);
  assertInRange('La FC en reposo', i.hrRest, CIRC_LIMITS.hrRest[0], CIRC_LIMITS.hrRest[1]);
  assertInRange('El volumen sistólico', i.svRest, CIRC_LIMITS.svRest[0], CIRC_LIMITS.svRest[1]);
  assertInRange('La intensidad', i.intensity, CIRC_LIMITS.intensity[0], CIRC_LIMITS.intensity[1]);
  const I = i.intensity / 100;
  const max = hrMax(i.age);
  const hr = i.hrRest + I * (max - i.hrRest);
  const sv = i.svRest * (1 + SV_GAIN * Math.min(1, I / 0.5));
  const co = cardiacOutput(hr, sv);
  const sbp = 115 + 60 * I, dbp = 75 - 5 * I;
  return { hrMax: max, hr, sv, co, sbp, dbp, map: dbp + (sbp - dbp) / 3, circulationS: (BLOOD_VOLUME_L / co) * 60 };
}
/** Recuperación después del ejercicio: FC(t) = FC_reposo + (FC_final − FC_reposo)·e^(−t/τ). */
export const recoveryHr = (hrRest: number, hrEnd: number, tMin: number) => hrRest + (hrEnd - hrRest) * Math.exp(-tMin / RECOVERY_TAU_MIN);
/** Pulso contado en 15 s → latidos por minuto. */
export const pulseFrom15s = (beats: number) => beats * 4;

/* ------------------------------------------------------------------ ciclo cardíaco */

export function systoleFraction(hr: number): number {
  const f = 0.4 + ((hr - 72) / (216 - 72)) * (0.65 - 0.4);
  return Math.min(0.7, Math.max(0.35, f));
}
export const ATRIAL_FRACTION = 0.12;
export type CyclePhase = 'sistole-ventricular' | 'diastole' | 'sistole-auricular';
export interface CycleState { phase: CyclePhase; name: string; avOpen: boolean; semilunarOpen: boolean; ventricle: number; atrium: number; periodS: number; systoleS: number }
/** Estado del corazón en la fracción φ (0–1) de un latido: válvulas y contracción (1 = relajado, < 1 = contraído). */
export function cycleAt(phi: number, hr: number): CycleState {
  const p = ((phi % 1) + 1) % 1;
  const fs = systoleFraction(hr);
  const periodS = 60 / hr;
  if (p < fs) {
    const s = Math.sin((Math.PI * p) / fs);
    return { phase: 'sistole-ventricular', name: 'Sístole ventricular: los ventrículos se contraen y expulsan la sangre', avOpen: false, semilunarOpen: true, ventricle: 1 - 0.28 * s, atrium: 1, periodS, systoleS: fs * periodS };
  }
  if (p < 1 - ATRIAL_FRACTION) return { phase: 'diastole', name: 'Diástole: el corazón se relaja y se llena de sangre', avOpen: true, semilunarOpen: false, ventricle: 1, atrium: 1, periodS, systoleS: fs * periodS };
  const s = Math.sin((Math.PI * (p - (1 - ATRIAL_FRACTION))) / ATRIAL_FRACTION);
  return { phase: 'sistole-auricular', name: 'Sístole auricular: las aurículas se contraen y terminan de llenar los ventrículos', avOpen: true, semilunarOpen: false, ventricle: 1, atrium: 1 - 0.3 * s, periodS, systoleS: fs * periodS };
}

export interface CircCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function circulationConditions(i: ExerciseInput, pulseBeats15: number | null): CircCondition[] {
  const out: CircCondition[] = [];
  if (i.intensity > 70) out.push({ level: 'advertencia', text: `Una intensidad del ${i.intensity} % es un esfuerzo fuerte. En el colegio esta práctica solo usa ejercicio suave (marchar en el puesto o subir y bajar un escalón durante 1 minuto); el modelo muestra intensidades altas solo para analizar la tendencia.`,
    fix: 'Para medir tu propio pulso usa un esfuerzo suave (hasta 50 %). Si sientes mareo, dolor en el pecho o falta de aire, detente y avisa al docente.' });
  if (pulseBeats15 !== null && (pulseBeats15 < 10 || pulseBeats15 > 50)) out.push({ level: 'nota', text: `Contaste ${pulseBeats15} latidos en 15 s (${pulseFrom15s(pulseBeats15)} lpm): el valor es poco común para un estudiante en clase; puede ser un error de conteo.`,
    fix: 'Vuelve a contar con dos dedos en la muñeca o en el cuello durante 15 s exactos con el cronómetro. Esto no es un diagnóstico; si tienes dudas sobre tu salud, consulta a un profesional.' });
  if (i.svRest < 50) out.push({ level: 'nota', text: 'Un volumen sistólico en reposo menor de 50 mL corresponde a personas pequeñas (como niños): el gasto cardíaco será menor.', fix: 'Para comparar con el valor de referencia del adulto (≈ 5 L/min) usa 70 mL.' });
  return out;
}

export const circulationSpec: ModelSpec = {
  name: 'Ciclo cardíaco, gasto cardíaco y respuesta al ejercicio (modelo educativo simplificado)',
  inputs: [
    { symbol: 'edad', name: 'Edad', unit: 'años', range: CIRC_LIMITS.age, initial: 14 },
    { symbol: 'FC₀', name: 'Frecuencia cardíaca en reposo', unit: 'lpm', range: CIRC_LIMITS.hrRest, initial: 72 },
    { symbol: 'VS₀', name: 'Volumen sistólico en reposo', unit: 'mL', range: CIRC_LIMITS.svRest, initial: 70 },
    { symbol: 'I', name: 'Intensidad del ejercicio (fracción de la reserva cardíaca)', unit: '%', range: CIRC_LIMITS.intensity, initial: 0 },
  ],
  outputs: [
    { symbol: 'FC', name: 'Frecuencia cardíaca', unit: 'lpm' },
    { symbol: 'VS', name: 'Volumen sistólico', unit: 'mL' },
    { symbol: 'GC', name: 'Gasto cardíaco', unit: 'L/min' },
    { symbol: 'PAS/PAD', name: 'Presión arterial sistólica y diastólica', unit: 'mmHg' },
    { symbol: 'fase', name: 'Fase del ciclo y estado de las válvulas', unit: '—' },
  ],
  equations: [
    'GC = FC × VS   (72 lpm × 70 mL = 5,04 L/min)',
    'FC_máx = 208 − 0,7 × edad (Tanaka, 2001);   FC = FC₀ + I·(FC_máx − FC₀) (Karvonen)',
    'VS = VS₀·(1 + 0,5·mín(1, I/0,5))   (aumento supuesto del 50 %)',
    'PAS = 115 + 60·I;  PAD = 75 − 5·I;  PAM = PAD + (PAS − PAD)/3   (valores ilustrativos)',
    'Fracción sistólica del ciclo: 0,4 a 72 lpm → 0,65 a 216 lpm (interpolación lineal)',
  ],
  initialConditions: [
    'Corazón de referencia en reposo: 72 lpm y 70 mL por latido; 5 L de sangre (adulto de referencia).',
    'Pulso propio contado durante 15 s (opcional; se queda en el equipo).',
  ],
  assumptions: [
    'Relaciones promedio de los manuales: cada persona responde distinto al ejercicio.',
    'La fórmula de Tanaka se obtuvo en adultos; en adolescentes es una aproximación.',
    'La presión arterial del modelo es ilustrativa: muestra la tendencia, no valores de una persona.',
  ],
  limits: [
    'No es un modelo clínico: no sirve para diagnosticar ni para decidir cuánto ejercicio puede hacer alguien.',
    'No incluye el entrenamiento, la temperatura, la deshidratación, la postura ni las emociones, que también cambian la FC.',
    'La vista 3D es un esquema del corazón (no la anatomía exacta) sincronizado con las fases del modelo.',
  ],
  testCases: [
    'Reposo: 72 lpm × 70 mL = 5,04 L/min; los 5 L de sangre dan una vuelta en unos 60 s.',
    'Edad 15 años: FC_máx = 208 − 10,5 = 197,5 lpm; al 50 % de la reserva con FC₀ = 72: 134,75 lpm.',
    'A 72 lpm el latido dura 0,833 s y la sístole 0,333 s; durante la sístole ventricular las válvulas AV están cerradas y las semilunares abiertas.',
  ],
};

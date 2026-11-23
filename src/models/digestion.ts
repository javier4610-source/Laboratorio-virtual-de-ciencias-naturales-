import { assertInRange } from './math';
import { pHBell } from './enzyme';
import type { ModelSpec } from './types';

/**
 * Digestión química a lo largo del tubo digestivo (grado 7.º): enzimas, su pH óptimo y el pH de cada tramo.
 *
 * 1) Actividad relativa de cada enzima contra el pH con la MISMA curva de dos grupos ionizables del modelo de «enzimas»
 *    (src/models/enzyme.ts, `pHBell`), normalizada a 1 en el óptimo. Los pH óptimos son valores redondeados de los
 *    manuales (amilasa salival ≈ 6,8; pepsina ≈ 2; amilasa pancreática ≈ 7; tripsina y lipasa pancreática ≈ 8); la
 *    ANCHURA de las curvas es ILUSTRATIVA.
 * 2) pH típico de cada tramo, redondeado: saliva ≈ 6,8 (6,2–7,4 según Guyton y Hall); contenido del estómago ya
 *    mezclado con el jugo gástrico ≈ 2; duodeno ≈ 6 y final del íleon ≈ 7,4 (Fallingborg, 1999).
 * 3) Digestión de cada nutriente en un tramo como un proceso de primer orden: fracción que queda = e^(−k·a(pH)·t),
 *    con a(pH) la actividad relativa y t el tiempo en el tramo. Las constantes k y los tiempos son ILUSTRATIVOS,
 *    calibrados para reproducir dos datos de Guyton y Hall: la amilasa salival alcanza a digerir ≈ 30–40 % del almidón
 *    (sobre todo en el fondo del estómago, antes de que el ácido la inactive) y la pepsina hace ≈ 10–20 % de la
 *    digestión de las proteínas; el resto lo hacen las enzimas del páncreas en el intestino delgado, con la bilis.
 * No es un modelo clínico ni sirve para diagnosticar ni tratar: ante un problema digestivo hay que consultar al médico.
 * Este archivo no depende de React ni del navegador.
 */

export type Nutrient = 'almidon' | 'proteina' | 'grasa';
export const NUTRIENTS: { id: Nutrient; name: string; product: string; color: string }[] = [
  { id: 'almidon', name: 'Almidón', product: 'maltosa y glucosa', color: 'series-2' },
  { id: 'proteina', name: 'Proteínas', product: 'péptidos y aminoácidos', color: 'series-1' },
  { id: 'grasa', name: 'Grasas', product: 'ácidos grasos y glicerol', color: 'series-6' },
];

export interface DigestiveEnzyme { id: string; name: string; where: string; nutrient: Nutrient; pHopt: number; width: number; k: number; pancreatic: boolean }
/** pH óptimos redondeados de los manuales; anchuras y constantes k (por minuto) ilustrativas. */
export const DIGESTIVE_ENZYMES: DigestiveEnzyme[] = [
  { id: 'amilasa-salival', name: 'Amilasa salival', where: 'boca (glándulas salivales)', nutrient: 'almidon', pHopt: 6.8, width: 1.6, k: 0.0078, pancreatic: false },
  { id: 'pepsina', name: 'Pepsina', where: 'estómago', nutrient: 'proteina', pHopt: 2, width: 1.4, k: 0.001354, pancreatic: false },
  { id: 'amilasa-pancreatica', name: 'Amilasa pancreática', where: 'intestino delgado (páncreas)', nutrient: 'almidon', pHopt: 7, width: 1.6, k: 0.0136, pancreatic: true },
  { id: 'tripsina', name: 'Tripsina', where: 'intestino delgado (páncreas)', nutrient: 'proteina', pHopt: 8, width: 1.5, k: 0.01436, pancreatic: true },
  { id: 'lipasa', name: 'Lipasa pancreática', where: 'intestino delgado (páncreas, con bilis)', nutrient: 'grasa', pHopt: 8, width: 1.5, k: 0.0129, pancreatic: true },
];
export function findDigestiveEnzyme(id: string): DigestiveEnzyme {
  const e = DIGESTIVE_ENZYMES.find((x) => x.id === id);
  if (!e) throw new RangeError(`Enzima desconocida: ${id}`);
  return e;
}

/** Actividad relativa (0–1) de una enzima a un pH. */
export function activity(enzymeId: string, pH: number): number {
  assertInRange('El pH', pH, 0, 14);
  const e = findDigestiveEnzyme(enzymeId);
  return pHBell(e.pHopt, e.width, pH);
}

export interface Segment { id: string; name: string; pH: number; minutes: number; enzymes: string[]; note: string }
/** Tramos del recorrido. pH típicos redondeados (ver arriba); tiempos ilustrativos. */
export const SEGMENTS: Segment[] = [
  { id: 'boca', name: 'Boca', pH: 6.8, minutes: 1, enzymes: ['amilasa-salival'], note: 'Se mastica y se mezcla con la saliva.' },
  { id: 'fondo', name: 'Estómago (bolo aún sin mezclar)', pH: 6, minutes: 60, enzymes: ['amilasa-salival'], note: 'El bolo tarda en mezclarse con el ácido: la amilasa de la saliva sigue actuando.' },
  { id: 'estomago', name: 'Estómago (mezclado con el jugo gástrico)', pH: 2, minutes: 120, enzymes: ['pepsina', 'amilasa-salival'], note: 'El ácido clorhídrico activa la pepsina y detiene a la amilasa salival.' },
  { id: 'duodeno', name: 'Duodeno', pH: 6, minutes: 30, enzymes: ['amilasa-pancreatica', 'tripsina', 'lipasa'], note: 'Llegan el jugo pancreático (con bicarbonato) y la bilis, que emulsiona las grasas.' },
  { id: 'delgado', name: 'Yeyuno e íleon', pH: 7.4, minutes: 240, enzymes: ['amilasa-pancreatica', 'tripsina', 'lipasa'], note: 'Termina la digestión y se absorben los nutrientes.' },
  { id: 'grueso', name: 'Intestino grueso', pH: 6.4, minutes: 0, enzymes: [], note: 'Se absorben agua y sales; las bacterias fermentan lo que no se digirió.' },
];

export type Situation = 'normal' | 'antiacido' | 'sin-bilis' | 'pancreas';
export const SITUATIONS: { id: Situation; name: string; note: string }[] = [
  { id: 'normal', name: 'Digestión típica', note: 'Valores típicos de los manuales.' },
  { id: 'antiacido', name: 'Con un antiácido (estómago a pH 4,5)', note: 'El pH 4,5 es ilustrativo.' },
  { id: 'sin-bilis', name: 'Sin bilis (conducto biliar tapado)', note: 'Sin emulsionar, la lipasa actúa sobre poca superficie; el factor 0,2 es ilustrativo.' },
  { id: 'pancreas', name: 'Páncreas que produce pocas enzimas', note: 'El factor 0,1 en las enzimas del páncreas es ilustrativo.' },
];

export interface MealInput { almidon: number; proteina: number; grasa: number; situation: Situation }
export const MEAL_LIMITS = { g: [0, 150] as [number, number] };
/** Un almuerzo típico de arroz, fríjoles y carne (gramos ilustrativos). */
export const DEFAULT_MEAL: MealInput = { almidon: 80, proteina: 30, grasa: 20, situation: 'normal' };

export interface SegmentResult { segment: Segment; pH: number; start: number; end: number; remaining: Record<Nutrient, number>; digestedHere: Record<Nutrient, number>; byEnzyme: Record<string, number> }
export interface MealResult { input: MealInput; segments: SegmentResult[]; totalMinutes: number; digestedPct: Record<Nutrient, number>; shareStomach: Record<Nutrient, number>; shareSaliva: number }

function segmentPH(s: Segment, sit: Situation): number {
  return sit === 'antiacido' && s.id === 'estomago' ? 4.5 : s.pH;
}
function factor(e: DigestiveEnzyme, sit: Situation): number {
  if (sit === 'pancreas' && e.pancreatic) return 0.1;
  if (sit === 'sin-bilis' && e.id === 'lipasa') return 0.2;
  return 1;
}

/** Recorre los tramos y devuelve cuánto queda (fracción 0–1) de cada nutriente al final de cada uno. */
export function digestMeal(input: MealInput): MealResult {
  for (const n of NUTRIENTS) assertInRange(`La masa de ${n.name.toLowerCase()}`, input[n.id], ...MEAL_LIMITS.g);
  const rem: Record<Nutrient, number> = { almidon: 1, proteina: 1, grasa: 1 };
  const segments: SegmentResult[] = [];
  let clock = 0;
  for (const s of SEGMENTS) {
    const pH = segmentPH(s, input.situation);
    const before = { ...rem };
    const byEnzyme: Record<string, number> = {};
    for (const n of NUTRIENTS) {
      const es = s.enzymes.map(findDigestiveEnzyme).filter((e) => e.nutrient === n.id);
      const rates = es.map((e) => e.k * factor(e, input.situation) * pHBell(e.pHopt, e.width, pH));
      const total = rates.reduce((a, b) => a + b, 0);
      const after = rem[n.id] * Math.exp(-total * s.minutes);
      const lost = rem[n.id] - after;
      // El nutriente digerido en el tramo se reparte entre las enzimas según su rapidez.
      es.forEach((e, i) => { byEnzyme[e.id] = total > 0 ? (lost * rates[i]) / total : 0; });
      rem[n.id] = after;
    }
    const digestedHere = { almidon: before.almidon - rem.almidon, proteina: before.proteina - rem.proteina, grasa: before.grasa - rem.grasa };
    segments.push({ segment: s, pH, start: clock, end: clock + s.minutes, remaining: { ...rem }, digestedHere, byEnzyme });
    clock += s.minutes;
  }
  const pct = (n: Nutrient) => (1 - rem[n]) * 100;
  const stomach = (n: Nutrient) => segments.filter((r) => r.segment.id === 'fondo' || r.segment.id === 'estomago').reduce((a, r) => a + r.digestedHere[n], 0) * 100;
  const shareSaliva = segments.reduce((a, r) => a + (r.byEnzyme['amilasa-salival'] ?? 0), 0) * 100;
  return { input, segments, totalMinutes: clock, digestedPct: { almidon: pct('almidon'), proteina: pct('proteina'), grasa: pct('grasa') }, shareStomach: { almidon: stomach('almidon'), proteina: stomach('proteina'), grasa: stomach('grasa') }, shareSaliva };
}

/** Estado en un instante del recorrido (minutos desde que se come): tramo en curso y fracción que queda. */
export function mealAt(r: MealResult, minute: number): { index: number; within: number; remaining: Record<Nutrient, number> } {
  const m = Math.max(0, Math.min(r.totalMinutes, minute));
  let index = r.segments.findIndex((s) => m < s.end);
  if (index < 0) index = r.segments.length - 1;
  const s = r.segments[index];
  const prev = index > 0 ? r.segments[index - 1].remaining : { almidon: 1, proteina: 1, grasa: 1 };
  const span = s.end - s.start;
  const within = span > 0 ? (m - s.start) / span : 1;
  // Dentro de un tramo la caída es exponencial: se interpola en el logaritmo.
  const interp = (n: Nutrient) => (prev[n] > 0 && s.remaining[n] > 0 ? prev[n] * (s.remaining[n] / prev[n]) ** within : s.remaining[n]);
  return { index, within, remaining: { almidon: interp('almidon'), proteina: interp('proteina'), grasa: interp('grasa') } };
}

export interface TubeResult { enzyme: DigestiveEnzyme; pH: number; a: number; remaining: number; minutes: number; lugol: 'azul oscuro' | 'violeta' | 'café rojizo' | 'amarillo' | null }
/** Tubo de ensayo a 37 °C con sustrato en exceso: fracción del sustrato que queda tras `minutes` (k ilustrativa ×10 para el tubo). */
export function testTube(enzymeId: string, pH: number, minutes: number): TubeResult {
  assertInRange('El tiempo', minutes, 0, 60);
  const e = findDigestiveEnzyme(enzymeId);
  const a = activity(enzymeId, pH);
  const remaining = Math.exp(-e.k * 10 * a * minutes);
  const lugol = e.nutrient !== 'almidon' ? null : remaining > 0.7 ? 'azul oscuro' : remaining > 0.35 ? 'violeta' : remaining > 0.1 ? 'café rojizo' : 'amarillo';
  return { enzyme: e, pH, a, remaining, minutes, lugol };
}

export interface DgCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function tubeConditions(r: TubeResult): DgCondition[] {
  const out: DgCondition[] = [];
  if (r.a < 0.05) out.push({ level: 'advertencia', text: `A pH ${r.pH.toFixed(1).replace('.', ',')} la ${r.enzyme.name.toLowerCase()} casi no trabaja (${Math.round(r.a * 100)} % de su actividad máxima): el tubo apenas cambia.`, fix: `Lleva el pH cerca de ${String(r.enzyme.pHopt).replace('.', ',')}, el del tramo donde actúa esta enzima.` });
  if (r.minutes === 0) out.push({ level: 'nota', text: 'Con 0 minutos no ha pasado tiempo para que la enzima actúe.', fix: 'Deja el tubo unos minutos a 37 °C.' });
  return out;
}
export function mealConditions(r: MealResult): DgCondition[] {
  const out: DgCondition[] = [];
  const left = (n: Nutrient) => 100 - r.digestedPct[n];
  if (left('grasa') > 20) out.push({ level: 'advertencia', text: `Llega sin digerir el ${Math.round(left('grasa'))} % de la grasa al intestino grueso: sin bilis o sin lipasa suficiente las grasas no se aprovechan.`, fix: 'Compara con la digestión típica: la bilis emulsiona la grasa y la lipasa del páncreas la digiere.' });
  if (left('proteina') > 20 || left('almidon') > 20) out.push({ level: 'advertencia', text: 'Llegan muchos nutrientes sin digerir al intestino grueso: las enzimas del páncreas hacen la mayor parte del trabajo.', fix: 'Vuelve a «Digestión típica» y mira qué tramo digiere más.' });
  if (r.input.situation !== 'normal') out.push({ level: 'nota', text: 'Esta situación es un modelo ilustrativo, no un diagnóstico. Ante dolor, acidez frecuente o diarrea hay que consultar al médico; no te automediques.', fix: 'Usa la simulación solo para comparar qué enzima deja de actuar.' });
  return out;
}

export const digestionSpec: ModelSpec = {
  name: 'Digestión química: actividad de las enzimas digestivas contra el pH y recorrido de un almuerzo por el tubo digestivo',
  inputs: [
    { symbol: 'enzima, pH, t', name: 'Enzima, pH del tubo de ensayo y tiempo a 37 °C', unit: '—, —, min', range: [0, 60], initial: 'amilasa salival, pH 6,8, 10 min' },
    { symbol: 'm', name: 'Almidón, proteínas y grasas del almuerzo', unit: 'g', range: [0, 150], initial: '80, 30 y 20 g' },
    { symbol: 'situación', name: 'Digestión típica, antiácido, sin bilis o páncreas con pocas enzimas', unit: '—', initial: 'típica' },
  ],
  outputs: [
    { symbol: 'a(pH)', name: 'Actividad relativa de la enzima', unit: '%' },
    { symbol: 'f', name: 'Fracción digerida de cada nutriente en cada tramo', unit: '%' },
    { symbol: 'lugol', name: 'Color del almidón con lugol en el tubo', unit: '—' },
  ],
  equations: [
    'a(pH) = g(pH)/g(pH_óptimo),  g(x) = 1/(1 + 10^(pH_ópt − w − x) + 10^(x − pH_ópt − w))  (misma curva del modelo de «enzimas»)',
    'Fracción que queda en un tramo = e^(−Σ k·a(pH)·t)',
    'pH óptimos: amilasa salival 6,8; pepsina 2; amilasa pancreática 7; tripsina y lipasa 8',
  ],
  initialConditions: ['Almuerzo con 80 g de almidón, 30 g de proteínas y 20 g de grasas (ilustrativo); tubo de ensayo a 37 °C con sustrato en exceso.'],
  assumptions: [
    'pH típicos redondeados: saliva 6,8; estómago 2; duodeno 6; íleon 7,4 (Guyton y Hall; Fallingborg, 1999).',
    'Las anchuras de las curvas, las constantes k y los tiempos en cada tramo son ilustrativos, calibrados con dos datos de Guyton y Hall (amilasa salival ≈ 30–40 % del almidón, pepsina ≈ 10–20 % de las proteínas).',
    'La temperatura es la del cuerpo (37 °C) y la enzima no se agota.',
  ],
  limits: [
    'Faltan otras enzimas reales (quimotripsina, carboxipeptidasas, disacaridasas y peptidasas del borde en cepillo, lipasa gástrica).',
    'El pH y los tiempos cambian mucho entre personas y comidas; las curvas de actividad son ilustrativas.',
    'No es un modelo clínico: no sirve para diagnosticar ni para decidir tratamientos.',
  ],
  testCases: [
    'Actividad 100 % en el pH óptimo de cada enzima; la pepsina a pH 7 y la amilasa salival a pH 2 quedan por debajo del 5 %.',
    'Almuerzo típico: la amilasa salival digiere ≈ 35 % del almidón y la pepsina ≈ 15 % de las proteínas; al final del íleon queda menos del 5 % de cada nutriente.',
    'Sin bilis, más del 20 % de la grasa llega sin digerir al intestino grueso.',
  ],
};

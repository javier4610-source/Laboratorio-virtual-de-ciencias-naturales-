import { assertInRange, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Sistema nervioso (grado 8.º): tiempo de reacción con la regla que cae, potencial de acción con un modelo de umbral
 * simplificado, conducción del impulso según el tipo de fibra y tiempo de un arco reflejo.
 *
 *  - Regla que cae (caída libre desde el reposo): d = ½·g·t²  →  t = √(2d/g), g = 9,8 m/s².
 *  - Potencial de acción (valores de los textos: Tortora y Derrickson): reposo −70 mV, umbral −55 mV, pico +30 mV,
 *    hiperpolarización hasta −80 mV. Todo o nada: si el estímulo no lleva la membrana al umbral, solo hay un potencial
 *    local que se apaga; si lo alcanza, el pico es siempre el mismo. La forma es una PLANTILLA (no Hodgkin–Huxley).
 *  - Velocidad de conducción (rangos de Kandel y otros, 2013): fibras Aα mielínicas gruesas 72–120 m/s, Aδ mielínicas
 *    delgadas 4–36 m/s, C amielínicas 0,4–2 m/s; se usa un valor representativo de cada rango.
 * Este archivo no depende de React ni del navegador.
 */

export const G = 9.8; // m/s²
export const RULER_CM = 30;
export const V_REST = -70, V_THRESHOLD = -55, V_PEAK = 30, V_UNDERSHOOT = -80; // mV
/** Límite de una salida en falso del atletismo: reaccionar en menos de 0,100 s se considera anticipación (World Athletics). */
export const ANTICIPATION_S = 0.1;

export const reactionTime = (dCm: number) => Math.sqrt((2 * dCm) / 100 / G);
export const dropDistance = (tS: number) => 0.5 * G * tS * tS * 100; // cm

export type Stimulus = 'visual' | 'auditivo' | 'distraido';
/**
 * Datos de EJEMPLO (no mediciones): tiempos de reacción normales con medias supuestas por el modelo, del orden de los
 * que reporta la literatura para reacciones simples (≈ 0,2 s; Kosinski, 2013): visual 0,22 s, auditivo 0,19 s y con una
 * tarea que distrae 0,28 s. Devuelve la distancia que caería la regla (cm, redondeada a 0,1 cm).
 */
export const EXAMPLE_MEAN: Record<Stimulus, { mean: number; sd: number }> = { visual: { mean: 0.22, sd: 0.03 }, auditivo: { mean: 0.19, sd: 0.03 }, distraido: { mean: 0.28, sd: 0.05 } };
export function exampleCatch(stim: Stimulus, seed: number): number {
  const r = seededRandom(seed);
  const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const t = Math.max(0.12, EXAMPLE_MEAN[stim].mean + EXAMPLE_MEAN[stim].sd * z);
  return Math.round(dropDistance(t) * 10) / 10;
}
export function stats(xs: number[]): { n: number; mean: number; sd: number } {
  const n = xs.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : NaN;
  return { n, mean, sd };
}

export interface NsCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function rulerConditions(dCm: number): NsCondition[] {
  if (dCm > RULER_CM) return [{ level: 'invalido', text: `La regla mide ${RULER_CM} cm: si cayó más de eso, se te escapó y no se puede calcular el tiempo.`, fix: 'Repite el ensayo; si se escapa a menudo, usa una regla de 50 cm o pon los dedos más cerca de la marca de 0 cm.' }];
  if (dCm <= 0) return [{ level: 'nota', text: 'Escribe la distancia (en cm) a la que atrapaste la regla, leída en el borde superior de tus dedos.', fix: 'Pide a un compañero que suelte la regla sin avisar y lee la marca donde la atrapaste.' }];
  if (reactionTime(dCm) < ANTICIPATION_S) return [{ level: 'advertencia', text: `Con ${dCm.toFixed(1).replace('.', ',')} cm el tiempo sería menor que 0,100 s: es probable que hayas anticipado la caída (en el atletismo eso es una salida en falso).`, fix: `Repite el ensayo: el compañero debe soltar la regla en un momento al azar. Una distancia menor que ${dropDistance(ANTICIPATION_S).toFixed(1).replace('.', ',')} cm no se considera reacción.` }];
  return [];
}

/* ------------------------------------------------------------------ potencial de acción (plantilla) */

export interface ApTrace { t: number[]; v: number[]; fired: boolean; peak: number; stimulus: number }
/**
 * Potencial de membrana durante 8 ms. En t = 1 ms un estímulo despolariza la membrana `stimulusMV` mV (0–40). Si llega al
 * umbral (−55 mV) se dispara el potencial de acción (subida a +30 mV en 0,5 ms, bajada a −80 mV y recuperación hacia
 * −70 mV con constante de 1 ms); si no, el potencial local decae con constante de 1,5 ms.
 */
export function actionPotential(stimulusMV: number, dt = 0.05): ApTrace {
  assertInRange('El estímulo', stimulusMV, 0, 40);
  const fired = V_REST + stimulusMV >= V_THRESHOLD - 1e-9;
  const t: number[] = [], v: number[] = [];
  for (let k = 0; k <= 8 / dt + 1e-9; k++) {
    const x = k * dt;
    let y = V_REST;
    if (x >= 1) {
      const s = x - 1;
      if (!fired) y = V_REST + stimulusMV * Math.exp(-s / 1.5);
      else if (s < 0.5) y = V_REST + stimulusMV + (V_PEAK - V_REST - stimulusMV) * Math.sin((Math.PI / 2) * (s / 0.5));
      else if (s < 1.6) y = V_PEAK + (V_UNDERSHOOT - V_PEAK) * (1 - Math.cos((Math.PI / 2) * ((s - 0.5) / 1.1)));
      else y = V_REST + (V_UNDERSHOOT - V_REST) * Math.exp(-(s - 1.6) / 1);
    }
    t.push(Number(x.toFixed(4))); v.push(y);
  }
  return { t, v, fired, peak: Math.max(...v), stimulus: stimulusMV };
}

/* ------------------------------------------------------------------ conducción y arco reflejo */

export interface Fiber { id: string; name: string; myelin: boolean; diameter: string; range: [number, number]; v: number; role: string }
export const FIBERS: Fiber[] = [
  { id: 'aa', name: 'Aα (mielínica gruesa)', myelin: true, diameter: '13–20 µm', range: [72, 120], v: 80, role: 'motoneuronas y receptores de los músculos' },
  { id: 'ad', name: 'Aδ (mielínica delgada)', myelin: true, diameter: '1–5 µm', range: [4, 36], v: 15, role: 'dolor agudo y temperatura' },
  { id: 'c', name: 'C (amielínica)', myelin: false, diameter: '0,2–1,5 µm', range: [0.4, 2], v: 1, role: 'dolor sordo y lento' },
];
export const fiber = (id: string) => {
  const f = FIBERS.find((x) => x.id === id);
  if (!f) throw new RangeError(`Fibra desconocida: ${id}`);
  return f;
};
export const conductionTimeMs = (lengthM: number, vMs: number) => (lengthM / vMs) * 1000;
/** Retardo supuesto por sinapsis química (modelo; del orden de 1 ms). */
export const SYNAPTIC_DELAY_MS = 1;

export interface ReflexResult { afferentMs: number; efferentMs: number; synapses: number; synapticMs: number; totalMs: number }
/** Arco reflejo de retirada: receptor → neurona sensitiva (fibra elegida) → interneurona en la médula → motoneurona (Aα) →
 * músculo. Dos sinapsis en la médula más la unión neuromuscular. */
export function reflexArc(pathM: number, sensory: string): ReflexResult {
  assertInRange('El recorrido', pathM, 0.1, 1.5);
  const afferentMs = conductionTimeMs(pathM, fiber(sensory).v);
  const efferentMs = conductionTimeMs(pathM, fiber('aa').v);
  const synapses = 3;
  const synapticMs = synapses * SYNAPTIC_DELAY_MS;
  return { afferentMs, efferentMs, synapses, synapticMs, totalMs: afferentMs + efferentMs + synapticMs };
}

export const nervousSystemSpec: ModelSpec = {
  name: 'Tiempo de reacción (caída libre de una regla), potencial de acción de umbral y conducción del impulso nervioso',
  inputs: [
    { symbol: 'd', name: 'Distancia que cae la regla antes de atraparla (dato propio o de ejemplo)', unit: 'cm', range: [0, RULER_CM], initial: 23.7 },
    { symbol: 'estímulo', name: 'Despolarización producida por el estímulo', unit: 'mV', range: [0, 40], initial: 20 },
    { symbol: 'fibra', name: 'Tipo de fibra nerviosa (Aα, Aδ o C)', unit: '—', initial: 'Aα' },
    { symbol: 'L', name: 'Longitud del recorrido del impulso', unit: 'm', range: [0.1, 1.5], initial: 0.8 },
  ],
  outputs: [
    { symbol: 't', name: 'Tiempo de reacción', unit: 's' },
    { symbol: 'V(t)', name: 'Potencial de membrana', unit: 'mV' },
    { symbol: 't_c', name: 'Tiempo de conducción y del arco reflejo', unit: 'ms' },
  ],
  equations: [
    't = √(2d/g),   g = 9,8 m/s²',
    'Disparo si −70 mV + estímulo ≥ −55 mV (todo o nada); pico +30 mV',
    't_c = L/v;   arco reflejo = L/v_sensitiva + L/v_motora + 3 × 1 ms (sinapsis)',
  ],
  initialConditions: [
    'La regla parte del reposo y cae libremente (sin rozamiento del aire apreciable en 30 cm).',
    'Neurona en reposo a −70 mV antes del estímulo.',
  ],
  assumptions: [
    'La forma del potencial de acción es una plantilla con los valores de los textos (reposo −70, umbral −55, pico +30 y −80 mV); no se calculan las corrientes de Na⁺ y K⁺.',
    'Cada tipo de fibra conduce con un valor representativo de su rango (Aα 80, Aδ 15 y C 1 m/s).',
    'Retardo de 1 ms por sinapsis (valor del modelo); la médula tiene una interneurona entre la neurona sensitiva y la motora.',
    'Los datos de ejemplo son tiempos de reacción generados con medias supuestas (visual 0,22 s, auditivo 0,19 s, con distracción 0,28 s).',
  ],
  limits: [
    'No modela el período refractario ni la suma de estímulos; la amplitud real varía entre neuronas.',
    'El tiempo de reacción medido con la regla incluye ver, decidir y mover los dedos: no es solo conducción.',
    'Contenido educativo: el laboratorio no evalúa la salud ni el desempeño de nadie.',
  ],
  testCases: [
    'd = 23,7 cm → t = √(2 · 0,237/9,8) = 0,220 s; d = 4,9 cm → t = 0,100 s (límite de anticipación).',
    'Estímulo de 10 mV: −60 mV, no llega al umbral (sin potencial de acción); de 15 o 30 mV: pico de +30 mV en los dos (todo o nada).',
    'Arco reflejo con 0,8 m y fibra Aδ: 0,8/15 + 0,8/80 + 3 ms = 53,3 + 10 + 3 = 66,3 ms.',
  ],
};

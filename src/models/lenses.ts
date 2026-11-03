import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Lentes delgadas, banco óptico y el ojo (grado 9.º).
 *
 * Convención «real es positivo» (Hecht, Óptica, cap. 5): el objeto está a la izquierda de la lente a la distancia
 * d_o > 0; la imagen está a la derecha si d_i > 0 (REAL: se recoge en una pantalla) y a la izquierda si d_i < 0
 * (VIRTUAL: solo se ve mirando a través de la lente). f > 0 en una lente convergente y f < 0 en una divergente.
 *   1/f = 1/d_o + 1/d_i;   M = h_i/h_o = −d_i/d_o;   P = 1/f (dioptrías, f en metros).
 * Pantalla a la distancia s de la lente: si la imagen real no cae en la pantalla, se ve una mancha borrosa de diámetro
 * b = D·|s − d_i|/d_i (óptica geométrica, abertura D = 4,0 cm).
 *
 * Ojo reducido (simplificación de los textos de física, p. ej. Serway y Jewett, cap. 36): una lente delgada
 * equivalente a 1,70 cm de la retina. Ojo normal: punto remoto en el infinito y punto próximo a 25 cm (amplitud de
 * acomodación 4 D, la convención de los textos; un joven de 15 años acomoda más, ≈ 12 D según Duane). Miopía de ejemplo:
 * punto remoto a 50 cm (se corrige con −2,0 D). Hipermetropía de ejemplo: punto próximo a 75 cm (+2,67 D para leer a
 * 25 cm). La lente correctora se pone pegada al ojo (sin distancia al vértice), así que las potencias se suman.
 * Este archivo no depende de React ni del navegador.
 */

export const BENCH = { length: 120, aperture: 4.0 }; // cm
export const RULER = { resolution: 0.1 }; // cm
export const SHARP_BLUR = 0.1; // cm: una mancha menor que 1 mm se ve nítida

export interface Lens { id: string; name: string; f: number; hidden?: boolean }
export const LENSES: Lens[] = [
  { id: 'c10', name: 'Convergente, f = +10 cm (+10 D)', f: 10 },
  { id: 'c15', name: 'Convergente, f = +15 cm (+6,7 D)', f: 15 },
  { id: 'c20', name: 'Convergente, f = +20 cm (lupa, +5 D)', f: 20 },
  { id: 'd15', name: 'Divergente, f = −15 cm (−6,7 D)', f: -15 },
  { id: 'x', name: 'Lente misteriosa (convergente, f por descubrir)', f: 12.5, hidden: true },
];
export function findLens(id: string): Lens {
  const l = LENSES.find((x) => x.id === id);
  if (!l) throw new RangeError(`Lente desconocida: ${id}`);
  return l;
}
export const power = (fCm: number) => 100 / fCm;

export interface ThinLensResult {
  di: number; // cm (Infinity si el objeto está en el foco)
  M: number;
  real: boolean;
  upright: boolean;
  atInfinity: boolean;
  kind: string;
}
export function thinLens(f: number, dO: number): ThinLensResult {
  if (!(dO > 0)) throw new RangeError('La distancia del objeto debe ser positiva.');
  if (f === 0) throw new RangeError('La distancia focal no puede ser cero.');
  const inv = 1 / f - 1 / dO;
  if (Math.abs(inv) < 1e-9) return { di: Infinity, M: Infinity, real: false, upright: false, atInfinity: true, kind: 'no se forma imagen: los rayos salen paralelos (objeto en el foco)' };
  const di = 1 / inv;
  const M = -di / dO;
  const real = di > 0;
  const size = Math.abs(M) > 1 + 1e-9 ? 'mayor' : Math.abs(M) < 1 - 1e-9 ? 'menor' : 'del mismo tamaño';
  return { di, M, real, upright: M > 0, atInfinity: false, kind: `${real ? 'real' : 'virtual'}, ${M > 0 ? 'derecha' : 'invertida'} y ${size}` };
}

export interface BenchInput { lens: string; objectX: number; lensX: number; screenX: number; objectH: number }
export interface BenchResult extends ThinLensResult {
  f: number; dO: number; s: number;
  /** Posición de la imagen en el banco (cm). */
  imageX: number;
  hi: number;
  /** Diámetro de la mancha en la pantalla (cm); null si no llega luz enfocable (imagen virtual o pantalla mal puesta). */
  blur: number | null;
  sharp: boolean;
}
export function bench(i: BenchInput): BenchResult {
  assertInRange('La posición de la vela', i.objectX, 0, BENCH.length);
  assertInRange('La posición de la lente', i.lensX, 0, BENCH.length);
  assertInRange('La posición de la pantalla', i.screenX, 0, BENCH.length);
  const f = findLens(i.lens).f;
  const dO = i.lensX - i.objectX;
  const s = i.screenX - i.lensX;
  const r = thinLens(f, Math.max(dO, 1e-6));
  const blur = r.real && !r.atInfinity && s > 0 ? (BENCH.aperture * Math.abs(s - r.di)) / r.di : null;
  return { ...r, f, dO, s, imageX: i.lensX + r.di, hi: r.M * i.objectH, blur, sharp: blur !== null && blur <= SHARP_BLUR };
}

/** Tres rayos principales desde la punta de la llama (en cm: x a lo largo del banco, y hacia arriba desde el eje). */
export interface Ray { name: string; pts: [number, number][]; /** Prolongación virtual hacia atrás (línea punteada), si la imagen es virtual. */ back?: [number, number][] }
export function principalRays(f: number, objectX: number, lensX: number, h: number, endX: number): Ray[] {
  const dO = lensX - objectX;
  const r = thinLens(f, dO);
  const top: [number, number] = [objectX, h];
  const out: Ray[] = [];
  const toEnd = (p: [number, number], slope: number): [number, number] => [endX, p[1] + slope * (endX - p[0])];
  // 1) paralelo al eje → por el foco imagen (F' a la derecha si f > 0; para f < 0 parece venir del foco de la izquierda)
  const a: [number, number] = [lensX, h];
  const s1 = -h / f;
  out.push({ name: 'paralelo al eje, sale por el foco', pts: [top, a, toEnd(a, s1)], back: r.real || r.atInfinity ? undefined : [a, [lensX + r.di, r.M * h]] });
  // 2) por el centro óptico: no se desvía
  const s2 = -h / dO;
  out.push({ name: 'por el centro de la lente, no se desvía', pts: [top, [lensX, 0], toEnd([lensX, 0], s2)], back: r.real || r.atInfinity ? undefined : [[lensX, 0], [lensX + r.di, r.M * h]] });
  // 3) hacia el foco objeto → sale paralelo al eje. Para f > 0 pasa por F (a la izquierda); para f < 0 apunta a F (a la derecha).
  if (Math.abs(dO - f) > 1e-6) {
    const yLens = h + ((0 - h) / (lensX - f - objectX)) * (lensX - objectX);
    const b: [number, number] = [lensX, yLens];
    out.push({ name: 'hacia el foco, sale paralelo al eje', pts: [top, b, [endX, yLens]], back: r.real || r.atInfinity ? undefined : [b, [lensX + r.di, yLens]] });
  }
  return out;
}

/* ------------------------------------------------------------------ el ojo */

export const EYE = { retina: 1.7, amplitude: 4, near: 25 }; // cm, D, cm
export type EyeType = 'normal' | 'miopia' | 'hipermetropia';
export interface EyeDef { id: EyeType; name: string; far: number; near: number; correction: number; explain: string }
const nearFrom = (far: number) => 100 / (100 / far + EYE.amplitude);
export const EYES: EyeDef[] = [
  { id: 'normal', name: 'Ojo normal (emétrope)', far: Infinity, near: EYE.near, correction: 0, explain: 'Enfoca desde el infinito hasta 25 cm acomodando el cristalino.' },
  { id: 'miopia', name: 'Miopía (punto remoto a 50 cm)', far: 50, near: nearFrom(50), correction: -2, explain: 'El ojo converge demasiado: la imagen de lo lejano cae DELANTE de la retina. Se corrige con una lente divergente de −1/(0,50 m) = −2,0 D.' },
  { id: 'hipermetropia', name: 'Hipermetropía (punto próximo a 75 cm)', far: -100 / (EYE.amplitude - 100 / 75), near: 75, correction: 100 / 25 - 100 / 75, explain: 'El ojo converge poco: la imagen de lo cercano cae DETRÁS de la retina. Se corrige con una lente convergente de 1/0,25 − 1/0,75 = +2,67 D.' },
];
export function findEye(id: string): EyeDef {
  const e = EYES.find((x) => x.id === id);
  if (!e) throw new RangeError(`Ojo desconocido: ${id}`);
  return e;
}
/** Potencia del ojo relajado (D): 1/retina + 1/punto remoto (un punto remoto negativo = «más allá del infinito»). */
export const relaxedPower = (e: EyeDef) => 100 / EYE.retina + (Number.isFinite(e.far) ? 100 / e.far : 0);

export interface EyeResult {
  needed: number; // potencia que necesitaría el ojo (D)
  used: number; // potencia que usa (D), dentro de su rango
  di: number; // cm: dónde se forma la imagen detrás del cristalino
  where: 'retina' | 'delante' | 'detras';
  accommodation: number; // D por encima de la potencia relajada
}
/** Imagen de un objeto a `dCm` (Infinity = muy lejos) en un ojo con una lente correctora de `lensD` dioptrías pegada. */
export function eyeImage(eyeId: string, dCm: number, lensD = 0): EyeResult {
  const e = findEye(eyeId);
  if (!(dCm > 0)) throw new RangeError('La distancia del objeto debe ser positiva.');
  const objV = Number.isFinite(dCm) ? 100 / dCm : 0;
  const pMin = relaxedPower(e), pMax = pMin + EYE.amplitude;
  const needed = 100 / EYE.retina + objV - lensD;
  const used = Math.min(pMax, Math.max(pMin, needed));
  const di = 100 / (used + lensD - objV);
  const where = Math.abs(used - needed) < 1e-9 ? 'retina' : needed < pMin ? 'delante' : 'detras';
  return { needed, used, di, where, accommodation: used - pMin };
}

export interface LensCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function benchConditions(i: BenchInput): LensCondition[] {
  const out: LensCondition[] = [];
  const b = bench(i);
  if (b.dO <= 0) { out.push({ level: 'invalido', text: 'La vela quedó a la derecha de la lente (o encima): la luz no la atraviesa en el sentido del banco.', fix: 'Pon la vela a la izquierda de la lente.' }); return out; }
  if (b.s <= 0) out.push({ level: 'invalido', text: 'La pantalla quedó del mismo lado que la vela: no recibe la luz que atraviesa la lente.', fix: 'Pon la pantalla a la derecha de la lente.' });
  if (b.atInfinity) out.push({ level: 'advertencia', text: 'La vela está justo en el foco: los rayos salen paralelos y la imagen se forma «en el infinito».', fix: 'Aleja la vela de la lente (más allá del foco) para obtener una imagen real en la pantalla.' });
  else if (!b.real) out.push({ level: 'nota', text: b.f < 0 ? 'Una lente divergente nunca forma una imagen real de una vela: la imagen es virtual, derecha y menor; la pantalla solo recibe una mancha de luz.' : 'La vela está entre la lente y el foco: la imagen es virtual (lupa). No se recoge en la pantalla; se ve mirando a través de la lente.', fix: b.f < 0 ? 'Cambia a una lente convergente para recoger la imagen en la pantalla.' : 'Aleja la vela más allá del foco o mira a través de la lente para ver la imagen aumentada.' });
  else if (b.imageX > BENCH.length) out.push({ level: 'advertencia', text: `La imagen se forma a ${b.di.toFixed(1).replace('.', ',')} cm de la lente: fuera del banco de ${BENCH.length} cm.`, fix: 'Aleja la vela de la lente: así la imagen se acerca.' });
  else if (!b.sharp && b.s > 0) out.push({ level: 'nota', text: `La imagen se ve borrosa: la pantalla está a ${b.s.toFixed(1).replace('.', ',')} cm y la imagen nítida se forma a ${b.di.toFixed(1).replace('.', ',')} cm de la lente.`, fix: 'Mueve la pantalla despacio hasta que el borde de la llama se vea nítido.' });
  return out;
}

export const lensesSpec: ModelSpec = {
  name: 'Lentes delgadas: ecuación de las lentes, aumento, imagen real o virtual y corrección del ojo',
  inputs: [
    { symbol: 'f', name: 'Lente (convergente +10, +15, +20 cm; divergente −15 cm; misteriosa)', unit: 'cm', initial: 10 },
    { symbol: 'x_vela, x_lente, x_pantalla', name: 'Posiciones en el banco óptico de 120 cm', unit: 'cm', range: [0, BENCH.length], initial: '10, 40, 55' },
    { symbol: 'h_o', name: 'Altura de la llama', unit: 'cm', initial: 3 },
    { symbol: 'ojo, d, P_lente', name: 'Ojo (normal, miope, hipermétrope), distancia del objeto y lente correctora', unit: '—, cm, D', initial: 'normal, ∞, 0' },
  ],
  outputs: [
    { symbol: 'd_i', name: 'Distancia de la imagen a la lente', unit: 'cm' },
    { symbol: 'M', name: 'Aumento (negativo: invertida)', unit: '—' },
    { symbol: 'b', name: 'Diámetro de la mancha en la pantalla', unit: 'cm' },
    { symbol: 'imagen en el ojo', name: 'Delante, sobre o detrás de la retina', unit: '—' },
  ],
  equations: ['1/f = 1/d_o + 1/d_i   (real es positivo)', 'M = h_i/h_o = −d_i/d_o;   P = 1/f (D)', 'b = D·|s − d_i|/d_i (mancha en la pantalla, D = 4,0 cm)', 'Ojo: P_ojo + P_lente = 1/1,7 cm + 1/d;   P_ojo entre P_relajado y P_relajado + 4 D'],
  initialConditions: ['Vela de 3,0 cm en x = 10 cm, lente de +10 cm en x = 40 cm (d_o = 30 cm) y pantalla en x = 55 cm.'],
  assumptions: [
    'Lente delgada y rayos paraxiales (cerca del eje): sin aberraciones.',
    'La imagen se ve nítida si la mancha mide menos de 1 mm.',
    'Ojo reducido de los textos: lente equivalente a 1,70 cm de la retina y 4 D de acomodación; lente correctora pegada al ojo.',
  ],
  limits: [
    'Una lente gruesa real tiene aberración esférica y cromática: la imagen tiene bordes de colores y no es nítida en todo el campo.',
    'El ojo real tiene córnea y cristalino separados, y la acomodación cambia con la edad; los valores son de un ojo esquemático simplificado.',
    'Las gafas reales están a ≈ 12 mm del ojo; la fórmula de la receta cambia un poco por esa distancia.',
  ],
  testCases: [
    'f = 10 cm, d_o = 30 cm: d_i = 15 cm, M = −0,5 (real, invertida y menor); con h_o = 3 cm, h_i = −1,5 cm.',
    'f = 10 cm, d_o = 20 cm: d_i = 20 cm, M = −1;   d_o = 5 cm: d_i = −10 cm, M = +2 (virtual, lupa).',
    'f = −15 cm, d_o = 30 cm: d_i = −10 cm, M = +1/3.',
    'Miopía (punto remoto 50 cm): sin lente, la imagen de lo lejano cae delante de la retina; con −2,0 D cae sobre ella. Hipermetropía: +2,67 D lleva el punto próximo a 25 cm.',
  ],
};

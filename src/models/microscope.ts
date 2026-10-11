import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Microscopio óptico compuesto (grado 6.º): células animales, vegetales y de hongos.
 *   Aumento total = aumento del ocular × aumento del objetivo.
 *   Diámetro del campo (µm) = número de campo del ocular (18 mm = 18 000 µm) / aumento del objetivo.
 *   Una estructura se ve si: tamaño real × aumento total ≥ 0,25 mm (poder de resolución del ojo),
 *   tiene contraste (pigmento natural o la tinción adecuada) y la muestra está enfocada.
 *   Tamaño estimado de una célula = diámetro del campo / número de células que caben en él.
 */

export const OCULAR = 10;
export const OBJECTIVES = [4, 10, 40] as const;
export type Objective = (typeof OBJECTIVES)[number];
/** Número de campo del ocular: diámetro (µm) del diafragma de campo que se ve a través de él. */
export const FIELD_NUMBER_UM = 18_000;
/** Tamaño mínimo (mm) que distingue el ojo humano a la distancia de lectura (≈ 25 cm). */
export const EYE_THRESHOLD_MM = 0.25;
export const FOCUS_RANGE: [number, number] = [0, 100];
/** Profundidad de campo expresada como tolerancia (± divisiones del tornillo micrométrico). */
export const FOCUS_TOLERANCE: Record<Objective, number> = { 4: 30, 10: 12, 40: 3 };
/** Un estudiante cuenta células enteras o medias células. */
export const COUNT_RESOLUTION = 0.5;
/** Por encima de este número de células en el diámetro, el conteo no es práctico. */
export const MAX_COUNT = 100;

export type StainId = 'ninguna' | 'lugol' | 'azul';
export type SampleId = 'cebolla' | 'elodea' | 'mucosa' | 'levadura';
export type Kingdom = 'vegetal' | 'animal' | 'hongo';

export interface Stain { id: StainId; name: string; }
export const STAINS: Stain[] = [
  { id: 'ninguna', name: 'Sin tinción' },
  { id: 'lugol', name: 'Lugol' },
  { id: 'azul', name: 'Azul de metileno' },
];

export interface Structure {
  id: 'pared' | 'membrana' | 'nucleo' | 'cloroplastos' | 'yemas';
  name: string;
  /** Tamaño característico con el que se reconoce (µm). Para pared y membrana, el ancho de la célula que delimitan. */
  sizeUm: number;
  /** Tiene contraste propio (pigmento o pared refringente) y se ve sin teñir. */
  natural: boolean;
  /** Tinciones que le dan contraste si no lo tiene naturalmente. */
  stains: StainId[];
  /** Es el contorno de la célula: si no se ve, las células no se distinguen y no se pueden contar. */
  outline?: boolean;
}

export interface Sample {
  id: SampleId;
  name: string;
  kingdom: Kingdom;
  /** Longitud de la célula a lo largo del diámetro del campo (µm). */
  lengthUm: number;
  /** Ancho de la célula (µm). */
  widthUm: number;
  /** Posición del tornillo micrométrico en la que la muestra queda enfocada. */
  focusPoint: number;
}

export const SAMPLES: Sample[] = [
  { id: 'cebolla', name: 'Epidermis de cebolla', kingdom: 'vegetal', lengthUm: 250, widthUm: 60, focusPoint: 42 },
  { id: 'elodea', name: 'Hoja de elodea', kingdom: 'vegetal', lengthUm: 60, widthUm: 25, focusPoint: 58 },
  { id: 'mucosa', name: 'Mucosa bucal (raspado de la mejilla)', kingdom: 'animal', lengthUm: 55, widthUm: 55, focusPoint: 47 },
  { id: 'levadura', name: 'Levadura de panadería', kingdom: 'hongo', lengthUm: 6, widthUm: 5, focusPoint: 53 },
];

export const STRUCTURES: Record<SampleId, Structure[]> = {
  cebolla: [
    { id: 'pared', name: 'Pared celular', sizeUm: 60, natural: true, stains: [], outline: true },
    { id: 'nucleo', name: 'Núcleo', sizeUm: 20, natural: false, stains: ['lugol', 'azul'] },
  ],
  elodea: [
    { id: 'pared', name: 'Pared celular', sizeUm: 25, natural: true, stains: [], outline: true },
    { id: 'cloroplastos', name: 'Cloroplastos', sizeUm: 5, natural: true, stains: [] },
  ],
  mucosa: [
    { id: 'membrana', name: 'Membrana celular', sizeUm: 55, natural: false, stains: ['azul'], outline: true },
    { id: 'nucleo', name: 'Núcleo', sizeUm: 8, natural: false, stains: ['azul'] },
  ],
  levadura: [
    { id: 'pared', name: 'Pared celular', sizeUm: 5, natural: true, stains: [], outline: true },
    { id: 'yemas', name: 'Yemas (gemación)', sizeUm: 2, natural: true, stains: [] },
    { id: 'nucleo', name: 'Núcleo', sizeUm: 1.5, natural: false, stains: [] },
  ],
};

export const KINGDOM_NAME: Record<Kingdom, string> = { vegetal: 'Célula vegetal', animal: 'Célula animal', hongo: 'Célula de hongo' };

export function findSample(id: string): Sample {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) throw new Error(`Muestra desconocida: ${id}`);
  return s;
}

export function findStain(id: string): Stain {
  const s = STAINS.find((x) => x.id === id);
  if (!s) throw new Error(`Tinción desconocida: ${id}`);
  return s;
}

function assertObjective(objective: number): asserts objective is Objective {
  if (!(OBJECTIVES as readonly number[]).includes(objective)) {
    throw new RangeError(`El objetivo debe ser de ${OBJECTIVES.join('×, ')}× (valor recibido: ${objective}).`);
  }
}

export function totalMagnification(objective: number): number {
  assertObjective(objective);
  return OCULAR * objective;
}

/** Diámetro del campo visual en micrómetros. */
export function fieldDiameterUm(objective: number): number {
  assertObjective(objective);
  return FIELD_NUMBER_UM / objective;
}

/** Tamaño aparente (mm) de un objeto real (µm) visto con cierto aumento total. */
export function apparentSizeMm(sizeUm: number, magnification: number): number {
  assertInRange('El tamaño real', sizeUm, 0, 10_000);
  assertInRange('El aumento total', magnification, 1, 2000);
  return (sizeUm / 1000) * magnification;
}

export interface FocusState {
  /** Distancia al punto de foco dividida por la tolerancia (≤ 1: enfocada). */
  defocus: number;
  inFocus: boolean;
  /** Desenfoque para la ilustración (desviación estándar del filtro gaussiano, px). */
  blurPx: number;
  /** Hacia dónde girar el tornillo para mejorar el foco. */
  direction: 'subir' | 'bajar' | 'ninguna';
}

export function focusState(sampleId: string, objective: number, focus: number): FocusState {
  assertObjective(objective);
  assertInRange('El tornillo micrométrico', focus, ...FOCUS_RANGE);
  const s = findSample(sampleId);
  const diff = focus - s.focusPoint;
  const defocus = Math.abs(diff) / FOCUS_TOLERANCE[objective];
  const inFocus = defocus <= 1;
  const blurPx = inFocus ? 0.8 * defocus * defocus : Math.min(10, 1.5 + 3 * (defocus - 1));
  return { defocus, inFocus, blurPx, direction: diff === 0 ? 'ninguna' : diff < 0 ? 'subir' : 'bajar' };
}

export type HiddenReason = 'muy pequeña a este aumento' | 'necesita tinción' | 'no se tiñe con las tinciones escolares' | 'fuera de foco';

export interface StructureView {
  structure: Structure;
  apparentMm: number;
  bigEnough: boolean;
  contrast: boolean;
  visible: boolean;
  /** Primer motivo por el que no se ve (tamaño → contraste → foco); null si se ve. */
  reason: HiddenReason | null;
  /** Texto para el estudiante, p. ej. «necesita tinción (lugol o azul de metileno)». */
  reasonText: string | null;
}

export function structureView(structure: Structure, stain: StainId, magnification: number, inFocus: boolean): StructureView {
  const apparentMm = apparentSizeMm(structure.sizeUm, magnification);
  const bigEnough = apparentMm >= EYE_THRESHOLD_MM - 1e-12;
  const contrast = structure.natural || structure.stains.includes(stain);
  let reason: HiddenReason | null = null;
  if (!bigEnough) reason = 'muy pequeña a este aumento';
  else if (!contrast) reason = structure.stains.length === 0 ? 'no se tiñe con las tinciones escolares' : 'necesita tinción';
  else if (!inFocus) reason = 'fuera de foco';
  const reasonText = reason === 'necesita tinción'
    ? `necesita tinción (${structure.stains.map((s) => findStain(s).name.toLowerCase()).join(' o ')})`
    : reason;
  return { structure, apparentMm, bigEnough, contrast, visible: reason === null, reason, reasonText };
}

export interface ObservationInput { sampleId: string; stain: string; objective: number; focus: number; }

export type CountResult =
  | { ok: true; count: number; estimatedSizeUm: number; relativeErrorPct: number }
  | { ok: false; reason: string };

export interface Observation {
  sample: Sample;
  stain: Stain;
  objective: Objective;
  magnification: number;
  fieldUm: number;
  focus: FocusState;
  structures: StructureView[];
  visibleCount: number;
  /** Se ve el contorno de las células (requisito para contarlas). */
  cellsDistinguishable: boolean;
  /** Número real (sin redondear) de células que caben en el diámetro. */
  cellsAcrossExact: number;
  count: CountResult;
}

export function observe(input: ObservationInput): Observation {
  const sample = findSample(input.sampleId);
  const stain = findStain(input.stain);
  assertObjective(input.objective);
  const objective = input.objective;
  const magnification = totalMagnification(objective);
  const fieldUm = fieldDiameterUm(objective);
  const focus = focusState(sample.id, objective, input.focus);
  const structures = STRUCTURES[sample.id].map((st) => structureView(st, stain.id, magnification, focus.inFocus));
  const outline = structures.find((v) => v.structure.outline)!;
  const cellsDistinguishable = outline.visible;
  const cellsAcrossExact = fieldUm / sample.lengthUm;
  return {
    sample, stain, objective, magnification, fieldUm, focus, structures,
    visibleCount: structures.filter((v) => v.visible).length,
    cellsDistinguishable, cellsAcrossExact,
    count: countCells(fieldUm, sample.lengthUm, outline),
  };
}

/** Conteo de células a lo largo del diámetro del campo, como lo haría un estudiante. */
function countCells(fieldUm: number, lengthUm: number, outline: StructureView): CountResult {
  if (outline.reason === 'fuera de foco') return { ok: false, reason: 'La imagen está borrosa: enfoca con el tornillo micrométrico antes de contar.' };
  if (outline.reason === 'necesita tinción') return { ok: false, reason: 'Las células son casi transparentes y no se distinguen sus bordes: aplica una tinción (azul de metileno).' };
  if (outline.reason === 'muy pequeña a este aumento') return { ok: false, reason: 'Las células se ven como puntos diminutos a este aumento: cambia a un objetivo de mayor aumento.' };
  const exact = fieldUm / lengthUm;
  const count = roundToResolution(exact, COUNT_RESOLUTION);
  if (count > MAX_COUNT) return { ok: false, reason: `Caben más de ${MAX_COUNT} células en el diámetro: son demasiadas para contarlas. Usa un objetivo de mayor aumento.` };
  if (count < COUNT_RESOLUTION) return { ok: false, reason: 'Ni siquiera media célula cabe en el campo: usa un objetivo de menor aumento.' };
  const estimatedSizeUm = fieldUm / count;
  return { ok: true, count, estimatedSizeUm, relativeErrorPct: (Math.abs(estimatedSizeUm - lengthUm) / lengthUm) * 100 };
}

export interface ClassificationCheck { correct: boolean; feedback: string; }

/** Revisa la clasificación del estudiante con las evidencias que da el microscopio. */
export function checkClassification(sampleId: string, choice: string): ClassificationCheck {
  const s = findSample(sampleId);
  if (choice !== 'vegetal' && choice !== 'animal' && choice !== 'hongo') {
    return { correct: false, feedback: 'No clasificaste la célula. Decide con base en las estructuras que observaste.' };
  }
  if (choice === s.kingdom) {
    const why: Record<Kingdom, string> = {
      vegetal: s.id === 'elodea' ? 'tiene pared celular y cloroplastos.' : 'tiene pared celular; las células de la epidermis del bulbo no reciben luz y por eso no tienen cloroplastos.',
      animal: 'solo tiene membrana celular, sin pared ni cloroplastos, y su forma es irregular.',
      hongo: 'tiene pared celular pero no cloroplastos, y se reproduce por gemación.',
    };
    return { correct: true, feedback: `Tu clasificación coincide con las evidencias: ${why[s.kingdom]}` };
  }
  const hints: Record<Kingdom, string> = {
    vegetal: 'Revisa: esta célula tiene pared celular y es de una planta. Que no tenga cloroplastos no la convierte en animal o en hongo.',
    animal: 'Revisa: esta célula no tiene pared celular (solo membrana) ni cloroplastos, por lo que no puede ser vegetal ni de hongo.',
    hongo: 'Revisa: esta célula tiene pared celular pero no cloroplastos, es diminuta y forma yemas; es un hongo unicelular, no una planta ni un animal.',
  };
  return { correct: false, feedback: hints[s.kingdom] };
}

export const microscopeModelSpec: ModelSpec = {
  name: 'Microscopio óptico compuesto: aumento, campo visual, visibilidad y tamaño de células',
  inputs: [
    { symbol: 'muestra', name: 'Preparación observada', unit: '—', initial: 'epidermis de cebolla' },
    { symbol: 'tinción', name: 'Colorante aplicado', unit: '—', initial: 'sin tinción' },
    { symbol: 'A_obj', name: 'Aumento del objetivo', unit: '×', range: [4, 40], initial: 4 },
    { symbol: 'f', name: 'Posición del tornillo micrométrico', unit: 'divisiones', range: FOCUS_RANGE, initial: 50 },
  ],
  outputs: [
    { symbol: 'A_total', name: 'Aumento total', unit: '×' },
    { symbol: 'D', name: 'Diámetro del campo visual', unit: 'µm' },
    { symbol: 'N', name: 'Células contadas a lo largo del diámetro', unit: 'células' },
    { symbol: 'L', name: 'Tamaño estimado de una célula', unit: 'µm' },
    { symbol: 'E', name: 'Número de estructuras visibles', unit: '—' },
  ],
  equations: [
    'A_total = A_ocular × A_objetivo (ocular 10×)',
    'D = número de campo / A_objetivo = 18 000 µm / A_objetivo',
    'Tamaño aparente (mm) = tamaño real (mm) × A_total; se ve si ≥ 0,25 mm',
    'Enfocada si |f − f₀| ≤ tolerancia (±30 a 4×, ±12 a 10×, ±3 a 40×)',
    'L ≈ D / N  (N redondeado a media célula)',
  ],
  initialConditions: ['Epidermis de cebolla sin teñir, objetivo de 4× (aumento total 40×) y tornillo micrométrico en 50.'],
  assumptions: [
    'Las células de una muestra tienen el mismo tamaño y están alineadas a lo largo del diámetro del campo.',
    'La pared o la membrana se reconocen cuando el ancho de la célula que delimitan supera el umbral del ojo (0,25 mm aparentes).',
    'Una estructura transparente solo se ve si la tinción adecuada le da contraste; la clorofila de los cloroplastos y la pared son visibles sin teñir.',
    'El microscopio es parafocal: al cambiar de objetivo, el punto de foco no cambia, pero la profundidad de campo se reduce.',
    'El estudiante cuenta hasta media célula y no cuenta más de 100 células.',
  ],
  limits: [
    'Los tamaños son valores típicos aproximados; en una preparación real varían de una célula a otra.',
    'No representa la resolución óptica del objetivo (apertura numérica, ≈ 0,2 µm con luz visible) ni la iluminación o el diafragma.',
    'En la práctica, el lugol también da algo de contraste a las células de la mucosa y el núcleo de la elodea puede verse con tinciones; el modelo los simplifica.',
    'No incluye el objetivo de inmersión (100×) ni el microscopio electrónico.',
  ],
  testCases: [
    'Aumento total 40×, 100× y 400×; campo de 4500, 1800 y 450 µm.',
    'Cebolla a 4×: 18 células en el diámetro → 250 µm; a 40×: 1,8 → 2 células → 225 µm (10 % de error).',
    'Levadura: no se cuenta a 4× (muy pequeña) ni a 10× (300 células); a 40× se cuentan 75 → 6 µm.',
    'Los cloroplastos de la elodea (5 µm) no se ven a 40× totales pero sí a 100×.',
    'El núcleo de la mucosa solo se ve con azul de metileno; sin tinción no se pueden contar las células.',
    'A 40× el foco tolera ±3 divisiones; fuera de foco no se puede contar.',
  ],
};

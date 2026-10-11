import type { ModelSpec } from './types';

/**
 * Dogma central (grado 9.º): replicación, transcripción, traducción y mutaciones.
 * Usa el código genético estándar (tabla 1 del NCBI).
 */

export type Base = 'A' | 'T' | 'G' | 'C';

const DNA_COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };

/** Limpia y valida una secuencia de ADN (solo A, T, G, C). */
export function cleanDNA(raw: string): string {
  return raw.toUpperCase().replace(/[\s\d\-·.]/g, '');
}

export function validateDNA(seq: string): string | null {
  if (seq.length === 0) return 'Escribe una secuencia de ADN.';
  const bad = seq.match(/[^ATGC]/);
  if (bad) return `"${bad[0]}" no es una base del ADN. Usa solo A, T, G y C.`;
  if (seq.length > 300) return 'La secuencia es demasiado larga para este laboratorio (máximo 300 bases).';
  return null;
}

/** Complemento base a base (sin invertir): útil para alinear la hebra molde bajo la codificante. */
export function complement(seq: string): string {
  return [...seq].map((b) => DNA_COMPLEMENT[b] ?? '?').join('');
}

export function reverseComplement(seq: string): string {
  return complement(seq).split('').reverse().join('');
}

/**
 * Replicación semiconservativa: cada molécula hija conserva una hebra parental
 * y una hebra nueva complementaria.
 */
export function replicate(codingStrand: string) {
  const template = complement(codingStrand);
  return {
    daughter1: { old: codingStrand, new: complement(codingStrand) },
    daughter2: { old: template, new: complement(template) },
  };
}

/** Transcripción: el ARNm se sintetiza complementario a la hebra molde (= hebra codificante con U en lugar de T). */
export function transcribeFromTemplate(templateAligned: string): string {
  const map: Record<string, string> = { A: 'U', T: 'A', G: 'C', C: 'G' };
  return [...templateAligned].map((b) => map[b] ?? '?').join('');
}

export function transcribe(codingStrand: string): string {
  return transcribeFromTemplate(complement(codingStrand));
}

// Código genético estándar. Orden de bases: U, C, A, G.
const AA_STRING = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
const ORDER = 'UCAG';
export const GENETIC_CODE: Record<string, string> = {};
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
  GENETIC_CODE[ORDER[i] + ORDER[j] + ORDER[k]] = AA_STRING[i * 16 + j * 4 + k];
}

export const AMINO_ACIDS: Record<string, { three: string; name: string; property: string }> = {
  A: { three: 'Ala', name: 'Alanina', property: 'no polar' },
  R: { three: 'Arg', name: 'Arginina', property: 'básica (+)' },
  N: { three: 'Asn', name: 'Asparagina', property: 'polar' },
  D: { three: 'Asp', name: 'Ácido aspártico', property: 'ácida (−)' },
  C: { three: 'Cys', name: 'Cisteína', property: 'polar' },
  Q: { three: 'Gln', name: 'Glutamina', property: 'polar' },
  E: { three: 'Glu', name: 'Ácido glutámico', property: 'ácida (−)' },
  G: { three: 'Gly', name: 'Glicina', property: 'no polar' },
  H: { three: 'His', name: 'Histidina', property: 'básica (+)' },
  I: { three: 'Ile', name: 'Isoleucina', property: 'no polar' },
  L: { three: 'Leu', name: 'Leucina', property: 'no polar' },
  K: { three: 'Lys', name: 'Lisina', property: 'básica (+)' },
  M: { three: 'Met', name: 'Metionina', property: 'no polar' },
  F: { three: 'Phe', name: 'Fenilalanina', property: 'no polar' },
  P: { three: 'Pro', name: 'Prolina', property: 'no polar' },
  S: { three: 'Ser', name: 'Serina', property: 'polar' },
  T: { three: 'Thr', name: 'Treonina', property: 'polar' },
  W: { three: 'Trp', name: 'Triptófano', property: 'no polar' },
  Y: { three: 'Tyr', name: 'Tirosina', property: 'polar' },
  V: { three: 'Val', name: 'Valina', property: 'no polar' },
  '*': { three: 'Stop', name: 'Codón de terminación', property: '—' },
};

export interface TranslatedCodon { codon: string; aa: string; index: number; }

export interface Translation {
  startIndex: number; // posición (0-based) del AUG en el ARNm; -1 si no hay
  codons: TranslatedCodon[];
  protein: string; // código de una letra, sin el codón de terminación
  stopFound: boolean;
}

/** Traduce desde el primer AUG hasta un codón de terminación o el final de la secuencia. */
export function translate(mrna: string): Translation {
  const start = mrna.indexOf('AUG');
  if (start < 0) return { startIndex: -1, codons: [], protein: '', stopFound: false };
  const codons: TranslatedCodon[] = [];
  let protein = '';
  let stopFound = false;
  for (let i = start; i + 3 <= mrna.length; i += 3) {
    const codon = mrna.slice(i, i + 3);
    const aa = GENETIC_CODE[codon] ?? '?';
    codons.push({ codon, aa, index: i });
    if (aa === '*') { stopFound = true; break; }
    protein += aa;
  }
  return { startIndex: start, codons, protein, stopFound };
}

export type MutationType = 'sustitucion' | 'insercion' | 'delecion';

export interface Mutation { type: MutationType; position: number; base?: Base; }

/** Aplica una mutación puntual a la hebra codificante (posición 1-based). */
export function mutate(seq: string, m: Mutation): string {
  const i = m.position - 1;
  if (!Number.isInteger(m.position) || i < 0 || i > seq.length - (m.type === 'insercion' ? 0 : 1)) {
    throw new RangeError(`La posición debe estar entre 1 y ${seq.length}.`);
  }
  if (m.type !== 'delecion' && !m.base) throw new Error('Indica la base nueva.');
  switch (m.type) {
    case 'sustitucion':
      if (seq[i] === m.base) throw new Error('La base nueva es igual a la original: no hay mutación.');
      return seq.slice(0, i) + m.base + seq.slice(i + 1);
    case 'insercion':
      return seq.slice(0, i) + m.base + seq.slice(i);
    case 'delecion':
      return seq.slice(0, i) + seq.slice(i + 1);
  }
}

export type MutationEffect = 'silenciosa' | 'de sentido erróneo' | 'sin sentido' | 'corrimiento del marco de lectura' | 'afecta el codón de inicio' | 'sin efecto en la región codificante';

export interface MutationAnalysis {
  effect: MutationEffect;
  original: Translation;
  mutated: Translation;
  changedPositions: number[]; // posiciones de aminoácidos (1-based) que difieren
  identityPercent: number;
  explanation: string;
}

export function compareProteins(a: string, b: string): { changed: number[]; identity: number } {
  const len = Math.max(a.length, b.length);
  const changed: number[] = [];
  let same = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) same++; else changed.push(i + 1);
  }
  return { changed, identity: len === 0 ? 100 : (same / len) * 100 };
}

export function analyzeMutation(coding: string, m: Mutation): MutationAnalysis {
  const original = translate(transcribe(coding));
  const mutatedSeq = mutate(coding, m);
  const mutated = translate(transcribe(mutatedSeq));
  const { changed, identity } = compareProteins(original.protein, mutated.protein);
  const start = original.startIndex;
  const end = start + original.codons.length * 3; // fin de la región traducida
  const pos0 = m.position - 1;
  let effect: MutationEffect;
  let explanation: string;

  if (start < 0) {
    effect = 'sin efecto en la región codificante';
    explanation = 'La secuencia original no tiene codón de inicio (AUG), por lo que no se traduce.';
  } else if (pos0 >= start && pos0 < start + 3) {
    effect = 'afecta el codón de inicio';
    explanation = 'La mutación cambia el codón de inicio AUG: el ribosoma iniciaría en otro AUG o no se produciría la proteína.';
  } else if (pos0 < start || pos0 >= end) {
    effect = 'sin efecto en la región codificante';
    explanation = 'La mutación está fuera de la región que se traduce, así que la secuencia de aminoácidos no cambia (en una célula real podría afectar la regulación).';
  } else if (m.type !== 'sustitucion') {
    if (mutated.protein === original.protein) {
      effect = 'silenciosa';
      explanation = 'Aunque se insertó o eliminó una base, la proteína resultante es igual en este fragmento.';
    } else {
      effect = 'corrimiento del marco de lectura';
      explanation = 'Al insertar o eliminar una base, todos los codones posteriores se leen agrupados de forma distinta; cambian muchos aminoácidos y puede aparecer un codón de terminación prematuro.';
    }
  } else if (mutated.protein === original.protein && mutated.stopFound === original.stopFound) {
    effect = 'silenciosa';
    explanation = 'El codón cambió, pero codifica el mismo aminoácido: el código genético es redundante (degenerado).';
  } else if (mutated.protein.length < original.protein.length && mutated.stopFound) {
    effect = 'sin sentido';
    explanation = 'La sustitución creó un codón de terminación prematuro: la proteína queda incompleta (truncada).';
  } else {
    effect = 'de sentido erróneo';
    explanation = 'La sustitución cambió un aminoácido por otro. El efecto depende de la propiedad química del nuevo aminoácido y de su lugar en la proteína.';
  }
  return { effect, original, mutated, changedPositions: changed, identityPercent: identity, explanation };
}

export interface DnaPreset { id: string; name: string; coding: string; note: string; }

export const DNA_PRESETS: DnaPreset[] = [
  {
    id: 'practica',
    name: 'Gen corto de práctica',
    coding: 'ATGGCCAAATTTGGCTGGCATTAA',
    note: 'Secuencia didáctica inventada: codifica Met-Ala-Lys-Phe-Gly-Trp-His y termina en TAA.',
  },
  {
    id: 'hbb',
    name: 'Fragmento inicial del gen de la β-globina humana (HBB)',
    coding: 'ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAGG',
    note: 'Primeros 31 codones de la región codificante de HBB (sin intrones). La sustitución A→T en la base 20 cambia el codón 7 (GAG→GTG) y produce Glu→Val: la mutación de la anemia falciforme (se denomina Glu6Val porque la metionina inicial se retira de la proteína madura). Es un fragmento, por eso no termina en codón de terminación.',
  },
];

export const dnaModelSpec: ModelSpec = {
  name: 'Dogma central: replicación, transcripción, traducción y mutaciones puntuales',
  inputs: [
    { symbol: 'ADN', name: 'Hebra codificante 5′→3′ (máximo 300 bases)', unit: 'bases', initial: 'ATGGCCAAATTTGGCTGGCATTAA' },
    { symbol: 'mutación', name: 'Tipo (sustitución, inserción, deleción), posición y base', unit: '—' },
  ],
  outputs: [
    { symbol: 'hebra molde', name: 'Hebra complementaria 3′→5′', unit: 'bases' },
    { symbol: 'ARNm', name: 'ARN mensajero 5′→3′', unit: 'nucleótidos' },
    { symbol: 'proteína', name: 'Secuencia de aminoácidos', unit: 'aminoácidos' },
    { symbol: 'identidad', name: 'Porcentaje de aminoácidos iguales entre proteína original y mutada', unit: '%' },
  ],
  equations: [
    'Complementariedad: A–T, G–C (ADN); en ARN, A–U.',
    'ARNm = hebra codificante con U en lugar de T (complementario a la hebra molde).',
    'Traducción desde el primer AUG, de a tres nucleótidos (codones), hasta UAA, UAG o UGA.',
    'Identidad = aminoácidos iguales en la misma posición / longitud de la proteína más larga × 100.',
  ],
  initialConditions: ['Gen corto de práctica de 24 pares de bases.'],
  assumptions: [
    'La secuencia corresponde a ADN codificante continuo (sin intrones ni procesamiento del ARN).',
    'Se usa el código genético estándar (el de la mayoría de los organismos y del núcleo humano).',
    'La traducción inicia en el primer AUG de la secuencia.',
  ],
  limits: [
    'No se modelan promotores, enzimas (helicasa, ARN polimerasa, ribosomas), fragmentos de Okazaki, ni plegamiento de proteínas.',
    'La clasificación del efecto se basa solo en la secuencia; el efecto real sobre la función de la proteína requiere información estructural y experimental.',
    'Una mutación "silenciosa" puede tener efectos reales (por ejemplo, en el empalme o la velocidad de traducción).',
  ],
  testCases: [
    'Complemento de ATGC = TACG; el ARNm de ATGGCC es AUGGCC.',
    'Las 64 entradas del código genético coinciden con la tabla estándar (AUG = Met; UAA, UAG, UGA = stop).',
    'HBB: GAG→GTG en el codón 7 (Glu→Val) se clasifica como de sentido erróneo.',
    'Una deleción dentro del gen produce corrimiento del marco de lectura.',
    'Una sustitución que genera un codón de terminación se clasifica como sin sentido.',
    'Una sustitución en la tercera posición GCC→GCA (Ala→Ala) es silenciosa.',
  ],
};

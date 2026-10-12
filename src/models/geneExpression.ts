import type { ModelSpec } from './types';
import { assertInRange, roundToResolution } from './math';
import { AMINO_ACIDS, compareProteins, transcribe, translate, type Base, type Translation } from './dna';

/**
 * Expresión génica en eucariotas (grado 11.º): promotor, transcripción, procesamiento del ARN
 * (caperuza 5′, cola de poli-A, empalme y empalme alternativo), traducción y efecto de mutaciones.
 *
 * Gen: fragmento del gen humano de la β-globina (HBB, cromosoma 11p15.4) en el sentido de la hebra
 * codificante. Promotor proximal, exón 1, intrón 1 (IVS-I, 130 nt), exón 2 (223 nt) y exón 3 completos;
 * el intrón 2 (IVS-II, 850 nt en el gen real) se ACORTA a sus primeros 40 y sus últimos 41 nucleótidos.
 * La región codificante empalmada traduce exactamente la β-globina humana (147 aminoácidos con la Met inicial).
 * Reutiliza el código genético, la transcripción y la traducción del modelo `dna` (tabla 1 del NCBI).
 */

export type SegmentId = 'prom' | 'ex1' | 'in1' | 'ex2' | 'in2' | 'ex3';
export type SegmentKind = 'promotor' | 'exon' | 'intron';
export interface GeneSegment { id: SegmentId; kind: SegmentKind; name: string; seq: string }

const PROMOTER = 'CCCTGTGGAGCCACACCCTAGGGTTGGCCAATCTACTCCCAGGAGCAGGGAGGGCAGGAGCCAGGGCTGGGCATAAAAGTCAGGGCAGAGCCATCTATTGCTT';
const UTR5 = 'ACATTTGCTTCTGACACAACTGTGTTCACTAGCAACCTCAAACAGACACC';
const EX1_CDS = 'ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAG';
const IVS1 = 'GTTGGTATCAAGGTTACAAGACAGGTTTAAGGAGACCAATAGAAACTGGGCATGTGGAGACAGAGAAGACTCTTGGGTTTCTGATAGGCACTGACTCTCTCTGCCTATTGGTCTATTTTCCCACCCTTAG';
const EX2 = 'GCTGCTGGTGGTCTACCCTTGGACCCAGAGGTTCTTTGAGTCCTTTGGGGATCTGTCCACTCCTGATGCTGTTATGGGCAACCCTAAGGTGAAGGCTCATGGCAAGAAAGTGCTCGGTGCCTTTAGTGATGGCCTGGCTCACCTGGACAACCTCAAGGGCACCTTTGCCACACTGAGTGAGCTGCACTGTGACAAGCTGCACGTGGATCCTGAGAACTTCAGG';
const IVS2_SHORT = 'GTGAGTCTATGGGACGCTTGATGTTTTCTTTCCCCTTCTT' + 'TTTTGCTAATCATGTTCATACCTCTTATCTTCCTCCCACAG';
const EX3 = 'CTCCTGGGCAACGTGCTGGTCTGTGTGCTGGCCCATCACTTTGGCAAAGAATTCACCCCACCAGTGCAGGCTGCCTATCAGAAAGTGGTGGCTGGTGTGGCTAATGCCCTGGCCCACAAGTATCACTAAGCTCGCTTTCTTGCTGTCCAATTTCTATTAAAGGTTCCTTTGTTCCCTAAGTCCAACTACTAAACTGGGGGATATTATGAAGGGCCTTGAGCATCTGGATTCTGCCTAATAAAAAACATTTATTTTCATTGC';

/** Gen silvestre (hebra codificante 5′→3′). */
export const HBB_SEGMENTS: readonly GeneSegment[] = [
  { id: 'prom', kind: 'promotor', name: 'Promotor', seq: PROMOTER },
  { id: 'ex1', kind: 'exon', name: 'Exón 1', seq: UTR5 + EX1_CDS },
  { id: 'in1', kind: 'intron', name: 'Intrón 1', seq: IVS1 },
  { id: 'ex2', kind: 'exon', name: 'Exón 2', seq: EX2 },
  { id: 'in2', kind: 'intron', name: 'Intrón 2 (acortado)', seq: IVS2_SHORT },
  { id: 'ex3', kind: 'exon', name: 'Exón 3', seq: EX3 },
];

export const GENE_SEQ = HBB_SEGMENTS.map((s) => s.seq).join('');
export const GENE_LENGTH = GENE_SEQ.length;

/** Coordenadas 1-based (inclusivas) de cada segmento en el fragmento silvestre. */
export const SEGMENT_RANGES: Record<SegmentId, { start: number; end: number }> = (() => {
  const out = {} as Record<SegmentId, { start: number; end: number }>;
  let p = 1;
  for (const s of HBB_SEGMENTS) { out[s.id] = { start: p, end: p + s.seq.length - 1 }; p += s.seq.length; }
  return out;
})();

/** Sitio de inicio de la transcripción (+1): primera base del exón 1. */
export const TSS = SEGMENT_RANGES.ex1.start;
/** Primera base del codón de inicio ATG y última del codón de terminación TAA (coordenadas del fragmento). */
export const CDS_START = SEGMENT_RANGES.ex1.start + UTR5.length;
/** Punto de unión entre la parte inicial y final del intrón 2 acortado. */
export const IVS2_JOIN = SEGMENT_RANGES.in2.start + 40;

export interface Element { id: string; name: string; start: number; end: number; consensus: string; /** Fracción de transcripción (o de procesamiento) que queda si el elemento se daña. */ residual: number }

const at = (motif: string, from = 0) => GENE_SEQ.indexOf(motif, from) + 1;

/** Elementos del promotor proximal de HBB (≈ −90, ≈ −75 y ≈ −30 respecto al inicio de la transcripción). */
export const PROMOTER_ELEMENTS: readonly Element[] = [
  { id: 'caccc', name: 'Caja CACCC', start: at('CCACACCCT'), end: at('CCACACCCT') + 8, consensus: 'CCACACCCT', residual: 0.3 },
  { id: 'ccaat', name: 'Caja CCAAT', start: at('CCAAT'), end: at('CCAAT') + 4, consensus: 'CCAAT', residual: 0.5 },
  { id: 'tata', name: 'Caja TATA', start: at('CATAAAA'), end: at('CATAAAA') + 6, consensus: 'CATAAAA', residual: 0.2 },
];
export const TATA = PROMOTER_ELEMENTS[2];

/** Señal de poliadenilación AATAAA del extremo 3′ no traducido. */
export const POLYA_SIGNAL: Element = (() => {
  const s = at('AATAAA', SEGMENT_RANGES.ex3.start - 1);
  return { id: 'polia', name: 'Señal de poliadenilación', start: s, end: s + 5, consensus: 'AATAAA', residual: 0.1 };
})();

/** Longitud típica de la cola de poli-A en el ARNm maduro (no se suma a la longitud informada). */
export const POLY_A_TAIL = 150;

export type MutationKind = 'sustitucion' | 'insercion' | 'delecion';
export interface GeneMutation { kind: MutationKind; position: number; base?: Base }
export type SplicingMode = 'constitutivo' | 'salto-exon2';

const BASES: Base[] = ['A', 'T', 'G', 'C'];

/** Posición relativa al inicio de la transcripción (+1), sin el 0 (convención de los promotores). */
export function relativeToTss(position: number): number {
  return position >= TSS ? position - TSS + 1 : position - TSS;
}

function segmentAt(position: number): SegmentId {
  for (const s of HBB_SEGMENTS) if (position >= SEGMENT_RANGES[s.id].start && position <= SEGMENT_RANGES[s.id].end) return s.id;
  return 'ex3';
}

export function validateMutation(m: GeneMutation): void {
  assertInRange('La posición', m.position, 1, GENE_LENGTH);
  if (!Number.isInteger(m.position)) throw new RangeError('La posición debe ser un número entero.');
  if (m.kind !== 'delecion') {
    if (!m.base || !BASES.includes(m.base)) throw new Error('Indica la base nueva (A, T, G o C).');
    if (m.kind === 'sustitucion' && GENE_SEQ[m.position - 1] === m.base) throw new Error('La base nueva es igual a la original: no hay mutación.');
  }
}

/**
 * Aplica la mutación a los segmentos. Una inserción en la frontera entre un exón y un intrón se cuenta
 * siempre del lado del exón (el exón gana una base y el sitio GT…AG del intrón no cambia).
 */
export function mutateSegments(m: GeneMutation): GeneSegment[] {
  validateMutation(m);
  const segs = HBB_SEGMENTS.map((s) => ({ ...s }));
  let id = segmentAt(m.position);
  let idx = segs.findIndex((s) => s.id === id);
  let local = m.position - SEGMENT_RANGES[id].start;
  if (m.kind === 'insercion' && local === 0 && idx > 0 && segs[idx].kind === 'intron' && segs[idx - 1].kind === 'exon') {
    idx -= 1; id = segs[idx].id; local = segs[idx].seq.length;
  }
  const s = segs[idx];
  if (m.kind === 'sustitucion') s.seq = s.seq.slice(0, local) + m.base + s.seq.slice(local + 1);
  else if (m.kind === 'insercion') s.seq = s.seq.slice(0, local) + m.base + s.seq.slice(local);
  else s.seq = s.seq.slice(0, local) + s.seq.slice(local + 1);
  return segs;
}

/** Secuencia que ocupa un elemento después de la mutación (null si una inserción o deleción lo altera). */
function mutatedMotif(el: Element, m: GeneMutation | null): string | null {
  const wt = GENE_SEQ.slice(el.start - 1, el.end);
  if (!m || m.position < el.start || m.position > el.end) return wt;
  if (m.kind === 'insercion' && m.position === el.start) return wt; // la base entra antes del elemento
  if (m.kind !== 'sustitucion') return null;
  const i = m.position - el.start;
  return wt.slice(0, i) + m.base + wt.slice(i + 1);
}

/** La caja TATA tolera las variantes del consenso TATAWAW (y CATAAAA de HBB). */
const TATA_OK = /^[CT]ATA[AT]A[AT]$/;
/** Variantes funcionales de la señal de poliadenilación y su eficiencia relativa. */
const POLYA_VARIANTS: Record<string, number> = { AATAAA: 1, ATTAAA: 0.7 };

export interface PromoterEffect { factor: number; element: string | null; note: string }

/** Fracción de la transcripción silvestre que se conserva con la mutación (efecto del promotor). */
export function promoterEffect(m: GeneMutation | null): PromoterEffect {
  if (!m || m.position >= TSS) return { factor: 1, element: null, note: 'Promotor intacto.' };
  for (const el of PROMOTER_ELEMENTS) {
    if (m.position < el.start || m.position > el.end) continue;
    const motif = mutatedMotif(el, m);
    const ok = motif === null ? false : el.id === 'tata' ? TATA_OK.test(motif) : motif === el.consensus;
    if (ok) return { factor: 1, element: el.name, note: `La ${el.name.toLowerCase()} cambió a ${motif}, que sigue siendo una variante funcional del consenso.` };
    return { factor: el.residual, element: el.name, note: `La ${el.name.toLowerCase()} quedó ${motif ? `como ${motif}` : 'interrumpida'}: los factores de transcripción se unen peor y la ARN polimerasa II inicia menos veces.` };
  }
  if (m.kind !== 'sustitucion' && m.position > TATA.end) {
    return { factor: 0.6, element: 'Espaciador TATA–inicio', note: 'Cambió la distancia entre la caja TATA y el sitio de inicio (+1): la polimerasa se posiciona peor.' };
  }
  return { factor: 1, element: null, note: 'La base cambiada está entre las cajas del promotor; en este modelo no altera la unión de los factores.' };
}

/** Fracción de pre-ARNm que se corta y poliadenila correctamente. */
export function polyAFactor(m: GeneMutation | null): number {
  const motif = mutatedMotif(POLYA_SIGNAL, m);
  if (motif === null) return POLYA_SIGNAL.residual;
  return POLYA_VARIANTS[motif] ?? POLYA_SIGNAL.residual;
}

export interface SplicingResult {
  /** Fragmentos incluidos en el ARNm maduro, en orden. */
  parts: SegmentId[];
  /** Patrón legible, p. ej. «E1-E2-E3». */
  pattern: string;
  donor1: boolean; acceptor1: boolean; donor2: boolean; acceptor2: boolean;
  /** Secuencia del ARNm maduro escrita con el alfabeto del ADN (sentido codificante). */
  matureDna: string;
}

const PART_LABEL: Record<SegmentId, string> = { prom: 'P', ex1: 'E1', in1: 'I1', ex2: 'E2', in2: 'I2', ex3: 'E3' };

/**
 * Empalme con un modelo de «definición del exón»: el exón 2 se reconoce solo si tiene un aceptor (AG al final
 * del intrón 1) y un donador (GT al inicio del intrón 2) funcionales. Si no se reconoce, el espliceosoma une
 * el donador del intrón 1 con el aceptor del intrón 2 (salto del exón 2). Un intrón cuyo sitio externo falla se retiene.
 */
export function splice(segs: GeneSegment[], mode: SplicingMode): SplicingResult {
  const get = (id: SegmentId) => segs.find((s) => s.id === id)!.seq;
  const in1 = get('in1'), in2 = get('in2');
  const donor1 = in1.startsWith('GT'), acceptor1 = in1.endsWith('AG');
  const donor2 = in2.startsWith('GT'), acceptor2 = in2.endsWith('AG');
  const exon2Defined = acceptor1 && donor2 && mode === 'constitutivo';
  let parts: SegmentId[];
  if (exon2Defined) parts = ['ex1', ...(donor1 ? [] : ['in1' as const]), 'ex2', ...(acceptor2 ? [] : ['in2' as const]), 'ex3'];
  else if (donor1 && acceptor2) parts = ['ex1', 'ex3'];
  else parts = ['ex1', 'in1', 'ex2', 'in2', 'ex3'];
  return { parts, pattern: parts.map((p) => PART_LABEL[p]).join('-'), donor1, acceptor1, donor2, acceptor2, matureDna: parts.map(get).join('') };
}

export interface GeneExpression {
  segments: GeneSegment[];
  splicing: SplicingResult;
  /** Pre-ARNm: del +1 al sitio de corte, con intrones (nt). */
  preMrnaLength: number;
  /** ARNm maduro con U (5′→3′), sin caperuza ni cola de poli-A. */
  mrna: string;
  mrnaLength: number;
  translation: Translation;
  protein: string;
  proteinLength: number;
  transcription: PromoterEffect;
  polyA: number;
  /** Expresión relativa a la del gen silvestre (0 a 1): transcripción × procesamiento del extremo 3′. */
  expression: number;
}

/** Expresa el gen (silvestre si m = null) en una célula con el modo de empalme indicado. */
export function expressGene(m: GeneMutation | null, mode: SplicingMode = 'constitutivo'): GeneExpression {
  if (mode !== 'constitutivo' && mode !== 'salto-exon2') throw new RangeError('Modo de empalme desconocido.');
  const segments = m ? mutateSegments(m) : HBB_SEGMENTS.map((s) => ({ ...s }));
  const splicing = splice(segments, mode);
  const pre = segments.filter((s) => s.kind !== 'promotor').map((s) => s.seq).join('');
  const mrna = transcribe(splicing.matureDna);
  const translation = translate(mrna);
  const transcription = promoterEffect(m);
  const polyA = polyAFactor(m);
  return {
    segments, splicing, preMrnaLength: pre.length, mrna, mrnaLength: mrna.length, translation,
    protein: translation.protein, proteinLength: translation.protein.length,
    transcription, polyA, expression: transcription.factor * polyA,
  };
}

export type Region = 'promotor' | 'utr5' | 'cds' | 'utr3' | 'intron' | 'sitio-donador' | 'sitio-aceptor' | 'exon-omitido';

export interface Location {
  position: number;
  segment: SegmentId;
  segmentName: string;
  region: Region;
  regionName: string;
  /** Posición respecto al inicio de la transcripción (negativa en el promotor). */
  relative: number;
  /** Número de codón (Met inicial = 1) y posición dentro del codón (1 a 3), si está en la región que se traduce. */
  codon: number | null;
  codonPos: number | null;
}

const REGION_NAME: Record<Region, string> = {
  promotor: 'promotor', utr5: 'región 5′ no traducida', cds: 'región codificante', utr3: 'región 3′ no traducida',
  intron: 'interior del intrón', 'exon-omitido': 'exón que no se incluye en esta isoforma', 'sitio-donador': 'sitio donador de empalme (GT)', 'sitio-aceptor': 'sitio aceptor de empalme (AG)',
};

const WILD_CACHE = new Map<SplicingMode, GeneExpression>();

/** Ubica una base del gen silvestre (región, codón) según el ARNm que produce la célula en el modo indicado. */
export function locate(position: number, mode: SplicingMode = 'constitutivo'): Location {
  assertInRange('La posición', position, 1, GENE_LENGTH);
  const segment = segmentAt(position);
  const seg = HBB_SEGMENTS.find((s) => s.id === segment)!;
  const r = SEGMENT_RANGES[segment];
  const base = { position, segment, segmentName: seg.name, relative: relativeToTss(position), codon: null as number | null, codonPos: null as number | null };
  if (seg.kind === 'promotor') return { ...base, region: 'promotor', regionName: REGION_NAME.promotor };
  if (seg.kind === 'intron') {
    const region: Region = position - r.start < 2 ? 'sitio-donador' : r.end - position < 2 ? 'sitio-aceptor' : 'intron';
    return { ...base, region, regionName: REGION_NAME[region] };
  }
  // Exón: índice en el ARNm maduro silvestre (si el exón está incluido en este modo).
  let wt = WILD_CACHE.get(mode);
  if (!wt) { wt = expressGene(null, mode); WILD_CACHE.set(mode, wt); }
  let offset = 0, idx = -1;
  for (const p of wt.splicing.parts) {
    if (p === segment) { idx = offset + position - r.start; break; }
    offset += HBB_SEGMENTS.find((s) => s.id === p)!.seq.length;
  }
  const t = wt.translation;
  const cdsEnd = t.startIndex + t.codons.length * 3;
  let region: Region;
  if (idx < 0) region = 'exon-omitido';
  else if (idx < t.startIndex) region = 'utr5';
  else if (idx < cdsEnd) region = 'cds';
  else region = 'utr3';
  if (idx >= 0 && region === 'cds') {
    const k = idx - t.startIndex;
    return { ...base, region, regionName: REGION_NAME[region], codon: Math.floor(k / 3) + 1, codonPos: (k % 3) + 1 };
  }
  return { ...base, region, regionName: REGION_NAME[region] };
}

/* ------------------------------------------------------------------ propiedades de los aminoácidos */

export type AaClass = 'hidrofóbico' | 'polar sin carga' | 'cargado (+)' | 'cargado (−)' | 'terminación';

/** Clasificación escolar de la cadena lateral (a partir de la tabla de `dna`). */
export function aaClass(aa: string): AaClass {
  const p = AMINO_ACIDS[aa]?.property ?? '—';
  if (aa === '*') return 'terminación';
  if (p.startsWith('no polar')) return 'hidrofóbico';
  if (p.startsWith('básica')) return 'cargado (+)';
  if (p.startsWith('ácida')) return 'cargado (−)';
  return 'polar sin carga';
}

/** Masa aproximada de una proteína: 0,110 kDa por residuo más una molécula de agua. */
export function proteinMassKDa(lengthAa: number): number {
  assertInRange('La longitud de la proteína', lengthAa, 0, 2000);
  return lengthAa === 0 ? 0 : (lengthAa * 110 + 18) / 1000;
}

/** Rango de masas que separa el gel simulado (SDS-PAGE al 15 %). */
export const GEL_RANGE_KDA: [number, number] = [2, 40];

/**
 * Migración relativa (Rf, 0 = pozo, 1 = frente) en una electroforesis desnaturalizante: lineal con el logaritmo
 * de la masa. Proteínas por debajo del rango salen del gel (Rf = 1); sin proteína, null.
 */
export function gelMigration(lengthAa: number): number | null {
  const m = proteinMassKDa(lengthAa);
  return m === 0 ? null : migrationForMass(m);
}

/** Migración relativa de una banda de masa conocida (marcador de peso molecular), en kDa. */
export function migrationForMass(kDa: number): number {
  assertInRange('La masa', kDa, 0.001, 1000);
  const [lo, hi] = GEL_RANGE_KDA;
  const rf = (Math.log10(hi) - Math.log10(kDa)) / (Math.log10(hi) - Math.log10(lo));
  return Math.min(1, Math.max(0, rf));
}

/* ------------------------------------------------------------------ clasificación de la mutación */

export type MutationClass =
  | 'silenciosa' | 'sentido-erroneo' | 'sin-sentido' | 'corrimiento' | 'empalme' | 'promotor' | 'poliA' | 'inicio' | 'terminacion' | 'no-codificante';

export const CLASS_LABEL: Record<MutationClass, string> = {
  silenciosa: 'Silenciosa',
  'sentido-erroneo': 'De sentido erróneo (cambio de aminoácido)',
  'sin-sentido': 'Sin sentido (codón de terminación prematuro)',
  corrimiento: 'Corrimiento del marco de lectura',
  empalme: 'De sitio de empalme',
  promotor: 'En el promotor',
  poliA: 'En la señal de poliadenilación',
  inicio: 'En el codón de inicio',
  terminacion: 'Pérdida del codón de terminación',
  'no-codificante': 'En una región no codificante (sin efecto en la proteína)',
};

export interface MutationAnalysis {
  mutation: GeneMutation;
  location: Location;
  cls: MutationClass;
  label: string;
  explanation: string;
  wild: GeneExpression;
  mutant: GeneExpression;
  /** Identidad con la proteína silvestre (%; resolución 0,1 %). */
  identity: number;
  changedAa: number;
  /** Expresión relativa en % (resolución 1 %). */
  expressionPercent: number;
  /** Cambio del codón afectado (sustituciones en la región codificante). */
  codonChange: { codon: number; from: string; to: string; aaFrom: string; aaTo: string; classFrom: AaClass; classTo: AaClass; propertyChanged: boolean } | null;
}

const three = (aa: string) => AMINO_ACIDS[aa]?.three ?? '?';

/** Compara el gen mutado con el silvestre expresado en la misma célula (mismo modo de empalme). */
export function analyzeGeneMutation(m: GeneMutation, mode: SplicingMode = 'constitutivo'): MutationAnalysis {
  const wild = expressGene(null, mode);
  const mutant = expressGene(m, mode);
  // Una inserción justo antes de un intrón queda al final del exón anterior (ver mutateSegments).
  const seg = segmentAt(m.position);
  const intoExon = m.kind === 'insercion' && seg !== 'prom' && HBB_SEGMENTS.find((s) => s.id === seg)!.kind === 'intron' && m.position === SEGMENT_RANGES[seg].start;
  const location = locate(intoExon ? m.position - 1 : m.position, mode);
  const { changed, identity } = compareProteins(wild.protein, mutant.protein);
  const sameProtein = wild.protein === mutant.protein && wild.translation.stopFound === mutant.translation.stopFound;
  let codonChange: MutationAnalysis['codonChange'] = null;
  if (m.kind === 'sustitucion' && location.region === 'cds' && location.codon !== null && location.codonPos !== null) {
    const k = location.codon - 1;
    const from = wild.translation.codons[k]?.codon ?? '';
    const to = from.slice(0, location.codonPos - 1) + transcribe(m.base!) + from.slice(location.codonPos);
    const aaFrom = wild.translation.codons[k]?.aa ?? '?';
    const aaTo = mutant.translation.codons[k]?.aa ?? '?';
    const classFrom = aaClass(aaFrom), classTo = aaClass(aaTo);
    codonChange = { codon: location.codon, from, to, aaFrom, aaTo, classFrom, classTo, propertyChanged: classFrom !== classTo };
  }

  let cls: MutationClass;
  let explanation: string;
  const wLen = wild.proteinLength, mLen = mutant.proteinLength;
  if (location.region === 'promotor') {
    cls = 'promotor';
    explanation = `${mutant.transcription.note} La proteína es la misma, pero la célula produce el ${roundToResolution(mutant.expression * 100, 1)} % del ARNm normal.`;
  } else if (mutant.splicing.pattern !== wild.splicing.pattern) {
    cls = 'empalme';
    const skip = mutant.splicing.pattern === 'E1-E3';
    explanation = skip
      ? `Se dañó un sitio de empalme del exón 2: el espliceosoma ya no lo reconoce y une el exón 1 con el exón 3 (salto del exón 2). El ARNm queda de ${mutant.mrnaLength} nt y la proteína de ${mLen} aminoácidos.`
      : `Se dañó un sitio de empalme: el intrón no se elimina (retención del intrón, patrón ${mutant.splicing.pattern}). Sus bases se leen como si fueran codones y aparece pronto un codón de terminación (${mLen} aminoácidos).`;
  } else if (mutant.polyA < 1) {
    cls = 'poliA';
    explanation = `La señal AATAAA cambió: el pre-ARNm se corta y poliadenila con menor eficiencia y la célula conserva el ${roundToResolution(mutant.expression * 100, 1)} % del ARNm maduro. La proteína no cambia.`;
  } else if (sameProtein) {
    cls = location.region === 'cds' ? 'silenciosa' : 'no-codificante';
    explanation = cls === 'silenciosa'
      ? `El codón ${codonChange ? `${codonChange.from} → ${codonChange.to}` : ''} sigue codificando ${codonChange ? AMINO_ACIDS[codonChange.aaTo]?.name.toLowerCase() : 'el mismo aminoácido'}: el código genético es redundante.`
      : `La base está en ${location.regionName}: no se traduce, así que la proteína no cambia (en una célula real podría influir en la estabilidad del ARN o en la regulación).`;
  } else if (location.region === 'cds' && location.codon === 1) {
    cls = 'inicio';
    explanation = `Se perdió el AUG de inicio: el ribosoma sigue explorando el ARNm y empieza en el siguiente AUG (base ${mutant.translation.startIndex + 1} del ARNm)${mLen ? `, lo que da una proteína de ${mLen} aminoácidos distinta de la normal` : ''}.`;
  } else if (location.region === 'utr5') {
    cls = 'inicio';
    explanation = 'La mutación creó un AUG antes del codón de inicio normal: el ribosoma empieza a traducir antes y en otro marco de lectura.';
  } else if (location.region === 'cds' && m.kind !== 'sustitucion') {
    cls = 'corrimiento';
    explanation = `Al ${m.kind === 'insercion' ? 'insertar' : 'eliminar'} una base en el codón ${location.codon}, todos los codones siguientes se leen agrupados de otra forma. Cambian ${changed.length} aminoácidos y la proteína queda de ${mLen} aminoácidos${mutant.translation.stopFound ? '' : ' (sin codón de terminación en el ARNm)'}.`;
  } else if (codonChange && codonChange.aaTo === '*') {
    cls = 'sin-sentido';
    explanation = `El codón ${codonChange.codon} (${codonChange.from}, ${three(codonChange.aaFrom)}) se volvió ${codonChange.to}, un codón de terminación: la proteína queda truncada en ${mLen} de ${wLen} aminoácidos.`;
  } else if (codonChange && codonChange.aaFrom === '*') {
    cls = 'terminacion';
    explanation = `El codón de terminación ${codonChange.from} se volvió ${codonChange.to} (${three(codonChange.aaTo)}): el ribosoma sigue leyendo la región 3′ no traducida y la proteína crece a ${mLen} aminoácidos.`;
  } else if (codonChange) {
    cls = 'sentido-erroneo';
    explanation = `El codón ${codonChange.codon} cambió de ${codonChange.from} (${three(codonChange.aaFrom)}, ${codonChange.classFrom}) a ${codonChange.to} (${three(codonChange.aaTo)}, ${codonChange.classTo}). ${codonChange.propertyChanged ? 'Cambia la propiedad química de la cadena lateral: puede alterar el plegamiento o la superficie de la proteína.' : 'La propiedad química se conserva (cambio conservador): el efecto suele ser menor.'}`;
  } else {
    cls = 'no-codificante';
    explanation = 'La mutación no cambia la proteína producida en esta célula.';
  }
  return {
    mutation: m, location, cls, label: CLASS_LABEL[cls], explanation, wild, mutant,
    identity: roundToResolution(identity, 0.1), changedAa: changed.length,
    expressionPercent: roundToResolution(mutant.expression * 100, 1), codonChange,
  };
}

/** Coordenadas útiles para navegar por el gen. */
export const LANDMARKS: { id: string; name: string; position: number }[] = [
  { id: 'caccc', name: 'Promotor: caja CACCC', position: PROMOTER_ELEMENTS[0].start },
  { id: 'tata', name: 'Promotor: caja TATA', position: TATA.start },
  { id: 'tss', name: 'Inicio de la transcripción (+1)', position: TSS },
  { id: 'atg', name: 'Codón de inicio ATG', position: CDS_START },
  { id: 'hbs', name: 'Codón 7 (GAG, anemia falciforme)', position: CDS_START + 19 },
  { id: 'd1', name: 'Sitio donador del intrón 1 (GT)', position: SEGMENT_RANGES.in1.start },
  { id: 'a1', name: 'Sitio aceptor del intrón 1 (AG)', position: SEGMENT_RANGES.in1.end - 1 },
  { id: 'ex2', name: 'Exón 2: codón 40 (CAG)', position: SEGMENT_RANGES.ex2.start + 25 },
  { id: 'd2', name: 'Sitio donador del intrón 2 (GT)', position: SEGMENT_RANGES.in2.start },
  { id: 'stop', name: 'Codón de terminación TAA', position: SEGMENT_RANGES.ex3.start + 126 },
  { id: 'polya', name: 'Señal de poliadenilación AATAAA', position: POLYA_SIGNAL.start },
];

export const geneExpressionModelSpec: ModelSpec = {
  name: 'Expresión de un gen eucariota (β-globina humana, HBB) y efecto de mutaciones',
  inputs: [
    { symbol: 'gen', name: `Fragmento del gen HBB (hebra codificante 5′→3′, ${GENE_LENGTH} pb)`, unit: 'pb', initial: 'silvestre' },
    { symbol: 'posición', name: 'Base mutada (1 = primera base del promotor mostrado)', unit: 'base', range: [1, GENE_LENGTH], initial: CDS_START + 19 },
    { symbol: 'mutación', name: 'Sustitución, inserción o deleción de una base', unit: '—', initial: 'ninguna' },
    { symbol: 'empalme', name: 'Modo de empalme de la célula (constitutivo o salto del exón 2)', unit: '—', initial: 'constitutivo' },
  ],
  outputs: [
    { symbol: 'L_pre', name: 'Longitud del pre-ARNm (del +1 al sitio de corte)', unit: 'nt' },
    { symbol: 'L_ARNm', name: 'Longitud del ARNm maduro sin caperuza ni cola de poli-A', unit: 'nt' },
    { symbol: 'L_prot', name: 'Longitud de la proteína (incluye la Met inicial)', unit: 'aminoácidos' },
    { symbol: 'identidad', name: 'Aminoácidos iguales en la misma posición respecto a la proteína silvestre', unit: '%' },
    { symbol: 'E', name: 'Expresión relativa (ARNm maduro respecto al gen silvestre)', unit: '%' },
    { symbol: 'clase', name: 'Clasificación de la mutación', unit: '—' },
  ],
  equations: [
    'Transcripción: ARN = hebra codificante con U en lugar de T, desde el +1 hasta el sitio de corte después de AATAAA.',
    'Empalme: un intrón se elimina si empieza en GT (donador) y termina en AG (aceptor); el exón 2 se define con su aceptor y su donador.',
    'Traducción: desde el primer AUG del ARNm maduro, de tres en tres nucleótidos, hasta UAA, UAG o UGA (código estándar).',
    'Identidad = aminoácidos iguales en la misma posición / longitud de la proteína más larga × 100.',
    'E = f_promotor × f_poliA (f = 1 si el elemento está intacto; caja TATA 0,2; caja CACCC 0,3; caja CCAAT 0,5; AATAAA 0,1; ATTAAA 0,7).',
    'Masa ≈ 0,110 kDa × aminoácidos; migración en el gel lineal con log(masa) entre 2 y 40 kDa.',
  ],
  initialConditions: [
    `Gen silvestre: 103 pb de promotor, exón 1 (50 nt no traducidos + 92 nt codificantes), intrón 1 de 130 nt, exón 2 de 223 nt, intrón 2 acortado a 81 nt y exón 3 de 261 nt.`,
    'ARNm maduro silvestre de 626 nt (50 + 444 + 132) y β-globina de 147 aminoácidos (146 en la proteína madura, que pierde la Met inicial).',
  ],
  assumptions: [
    'Secuencia del gen HBB humano (secuencia de referencia NG_000007 / NM_000518 del NCBI); el intrón 2 real (850 nt) se acorta a sus extremos.',
    'Una sola mutación de una base a la vez, comparada con el gen silvestre expresado en la misma célula.',
    'Sitios de empalme reducidos a las reglas GT…AG; el efecto de cada caja del promotor y de la señal AATAAA es un factor fijo semicuantitativo (del orden de lo descrito en talasemias β+).',
    'El ribosoma inicia en el primer AUG del ARNm maduro (modelo de exploración desde la caperuza 5′).',
    'La caperuza 5′ y la cola de poli-A se agregan siempre que el pre-ARNm se procese; la cola no se suma a la longitud del ARNm.',
  ],
  limits: [
    'No se modelan sitios crípticos de empalme (p. ej. IVS-I-110 G→A), potenciadores ni silenciadores del empalme, ni el punto de ramificación.',
    'No se modela la degradación del ARNm con codón de terminación prematuro (NMD), que en la célula reduce mucho la expresión de las mutaciones sin sentido tempranas.',
    'El empalme alternativo del exón 2 es didáctico: la β-globina normal no se empalma alternativamente.',
    'La función de la proteína (plegamiento, unión al hemo, polimerización de la HbS) no se calcula: la clase de aminoácido es solo una pista.',
    'La expresión depende también de potenciadores lejanos (región de control del locus), de la cromatina y del tipo de célula.',
  ],
  testCases: [
    'El ARNm empalmado silvestre mide 626 nt y traduce la β-globina humana completa (147 aa, MVHLTPEEK…KYH).',
    'GAG→GTG en el codón 7 (anemia falciforme) es de sentido erróneo: Glu (cargado −) → Val (hidrofóbico).',
    'CAG→TAG en el codón 40 (talasemia β0 «codón 39») es sin sentido: proteína de 39 aminoácidos.',
    'Una deleción en el exón 1 corre el marco; la identidad crece cuanto más tarde ocurre la deleción.',
    'Dañar el aceptor del intrón 1 o el donador del intrón 2 produce salto del exón 2; dañar el donador del intrón 1 retiene el intrón.',
    'Una sustitución en la caja TATA reduce la expresión al 20 %; una en la señal AATAAA, al 10 %.',
  ],
};

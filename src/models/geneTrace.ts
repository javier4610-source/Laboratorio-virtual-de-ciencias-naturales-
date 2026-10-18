import type { ModelSpec } from './types';
import { assertInRange, roundToResolution } from './math';
import { AMINO_ACIDS, GENETIC_CODE, compareProteins } from './dna';
import { ECO, GENES, GENES_RETRIEVED, type Excerpt, type GeneRecord, type Source } from '../data/genes';
import type { EpistemicStatus } from '../lib/provenance';
import { fmt } from '../lib/format';

/**
 * Rastreo génico (grado 11.º, programa v2, sección 10.2): del gen a la proteína y su función, con registros reales.
 *
 * Los datos NO se calculan aquí: vienen de registros de NCBI (Gene, RefSeq, ClinVar), UniProt y RCSB PDB guardados en
 * `src/data/genes.ts` (consulta del 2026-10-18; comparación automatizada en scripts/validacion/genes_fetch.mjs).
 * Este módulo solo (1) deriva medidas de esos registros (longitudes de exones e intrones, regiones no traducidas,
 * fracción exónica), (2) traduce la región codificante de referencia con el código genético estándar (tabla 1 del NCBI,
 * el mismo de `dna.ts`), (3) calcula la consecuencia de una variante sobre esa traducción y (4) clasifica cada
 * afirmación de la ruta según su tipo de evidencia: «demostrado» (código ECO experimental o secuencia medida),
 * «inferido» (códigos ECO no experimentales o asociación), «sin código de evidencia» o «calculado» en el laboratorio.
 */

export { ECO, GENES, GENES_RETRIEVED };
export type { GeneRecord, Excerpt, Source };

/* ------------------------------------------------------------------ nombres en español (redacción del equipo) */
export interface GeneInfoEs { name: string; organism: string; glossFor: string | null; gloss: string; perturbation: string; legacyNote?: string }

/**
 * Nombre y organismo en español, paráfrasis fiel de la cita de función de UniProt (`glossFor` repite la cita exacta:
 * si el registro cambia, la prueba unitaria lo detecta) e hipótesis conceptual de perturbación.
 */
export const GENE_INFO_ES: Record<string, GeneInfoEs> = {
  HBB: {
    name: 'β-globina (subunidad beta de la hemoglobina)', organism: 'ser humano',
    glossFor: 'Involved in oxygen transport from the lung to the various peripheral tissues',
    gloss: 'Participa en el transporte de oxígeno desde los pulmones hacia los demás tejidos del cuerpo.',
    perturbation: 'Si una célula precursora de glóbulos rojos no tuviera ninguna copia funcional de HBB, se esperaría que formara poca o ninguna hemoglobina A (α₂β₂). Cuánto afecta eso a una persona depende de la variante, de la otra copia del gen, de genes como los de la globina fetal y del ambiente; no se puede generalizar.',
    legacyNote: 'La numeración clásica de la hemoglobina no cuenta la metionina inicial, que se retira de la proteína madura (las cadenas β del PDB 2HHB van del residuo 2 al 147 de UniProt). Por eso p.Glu7Val se conoce también como «Glu6Val» o hemoglobina S.',
  },
  INS: {
    name: 'insulina', organism: 'ser humano',
    glossFor: 'Insulin decreases blood glucose concentration.',
    gloss: 'La insulina disminuye la concentración de glucosa en la sangre.',
    perturbation: 'Si las células beta del páncreas no produjeran insulina funcional, se esperaría que la glucosa en sangre aumentara. Es una hipótesis general: el resultado real depende de la variante, de la edad, de otros genes y del tratamiento.',
  },
  LCT: {
    name: 'lactasa (lactasa-florizina hidrolasa)', organism: 'ser humano',
    glossFor: 'Broad specificity glycosidase of the intestinal brush border membrane that hydrolyzes lactose, the main sugar in mammalian milk, to produce D-glucose and D-galactose (PubMed:12594539, PubMed:16400612, PubMed:3929764, PubMed:9762914).',
    gloss: 'Glucosidasa de amplia especificidad de la membrana en cepillo del intestino que hidroliza la lactosa, el principal azúcar de la leche de los mamíferos, en D-glucosa y D-galactosa.',
    perturbation: 'Si el intestino delgado produjera poca lactasa, se esperaría que parte de la lactosa de la leche no se digiriera allí. Los síntomas (o su ausencia) dependen de la cantidad de lactosa, de la microbiota y de cada persona; no es una regla universal.',
  },
  OCA2: {
    name: 'proteína OCA2 del melanosoma', organism: 'ser humano',
    glossFor: 'Contributes to a melanosome-specific anion (chloride) current that modulates melanosomal pH for optimal tyrosinase activity required for melanogenesis and the melanosome maturation (PubMed:11310796, PubMed:15262401, PubMed:22234890, PubMed:25513726).',
    gloss: 'Contribuye a una corriente de aniones (cloruro) propia del melanosoma que regula su pH para que la tirosinasa trabaje de forma óptima, algo necesario para fabricar melanina y para que el melanosoma madure.',
    perturbation: 'Si los melanocitos no tuvieran OCA2 funcional, se esperaría que produjeran menos melanina. El color de piel, pelo y ojos depende además de muchos otros genes y regiones reguladoras (como la de HERC2), así que un solo gen no lo determina.',
  },
  lacZ: {
    name: 'β-galactosidasa', organism: 'bacteria E. coli K-12',
    glossFor: null,
    gloss: 'Hidroliza los residuos terminales no reductores de β-D-galactosa de los β-galactósidos. Es la actividad catalítica que UniProt asigna con el número EC 3.2.1.23; el registro no le asocia un código de evidencia.',
    perturbation: 'Si una E. coli no tuviera β-galactosidasa funcional, se esperaría que no pudiera aprovechar la lactosa como fuente de carbono. El efecto depende de la cepa, del medio de cultivo y de otros genes; aquí es solo una hipótesis conceptual.',
  },
};

/* ------------------------------------------------------------------ búsqueda */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Texto en el que se busca: símbolo, nombres, organismo e identificadores del registro. */
export function searchText(g: GeneRecord): string {
  const es = GENE_INFO_ES[g.key];
  return norm([g.gene.symbol, g.gene.description, g.gene.organism, es?.name ?? '', es?.organism ?? '', String(g.gene.geneId), g.mrna?.accession ?? '',
    g.protein.accession, g.uniprot.accession, g.uniprot.proteinName ?? '', g.gene.genomic.accession].join(' '));
}

/** Busca en el conjunto curado (no en bases públicas): todas las palabras de la consulta deben aparecer. */
export function findGenes(query: string, genes: readonly GeneRecord[] = GENES): GeneRecord[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...genes];
  return genes.filter((g) => { const t = searchText(g); return words.every((w) => t.includes(w)); });
}

export function geneByKey(key: string): GeneRecord {
  const g = GENES.find((x) => x.key === key);
  if (!g) throw new RangeError(`Gen desconocido: ${key}`);
  return g;
}

/* ------------------------------------------------------------------ traducción */
/** Traduce una región codificante de ADN (hebra codificante) desde la base 1, codón a codón; «*» = terminación. */
export function translateCds(cds: string, stopAtFirst = false): string {
  let p = '';
  for (let i = 0; i + 3 <= cds.length; i += 3) {
    const aa = GENETIC_CODE[cds.slice(i, i + 3).replace(/T/g, 'U')] ?? '?';
    p += aa;
    if (stopAtFirst && aa === '*') break;
  }
  return p;
}

export const three = (aa: string) => (aa === '*' ? 'Ter' : AMINO_ACIDS[aa]?.three ?? 'Xaa');

/* ------------------------------------------------------------------ estructura del gen */
export interface Interval { n: number; start: number; end: number; length: number }
export interface GeneStructure {
  exons: Interval[]; introns: Interval[];
  /** Del inicio del primer exón al final del último, en el genoma (nt). */
  geneLength: number; exonicLength: number; intronicLength: number;
  /** Porcentaje de la longitud del gen que queda en el ARNm maduro (resolución 0,1 %). */
  exonicPercent: number;
  mrnaLength: number | null; utr5: number | null; utr3: number | null;
  cdsLength: number; codons: number; proteinLength: number;
}

export function geneStructure(g: GeneRecord): GeneStructure {
  const exons = g.genomicExons.map((e) => ({ n: e.n, start: e.geneStart, end: e.geneEnd, length: e.length }));
  const introns: Interval[] = [];
  for (let i = 1; i < exons.length; i++) {
    const start = exons[i - 1].end + 1, end = exons[i].start - 1;
    introns.push({ n: i, start, end, length: end - start + 1 });
  }
  const geneLength = exons[exons.length - 1].end - exons[0].start + 1;
  const exonicLength = exons.reduce((s, e) => s + e.length, 0);
  const cdsLength = g.cds.length;
  return {
    exons, introns, geneLength, exonicLength, intronicLength: geneLength - exonicLength,
    exonicPercent: roundToResolution((exonicLength / geneLength) * 100, 0.1),
    mrnaLength: g.mrna?.length ?? null,
    utr5: g.mrna ? g.mrna.cds.start - 1 : null,
    utr3: g.mrna ? g.mrna.length - g.mrna.cds.end : null,
    cdsLength, codons: cdsLength / 3, proteinLength: g.protein.length,
  };
}

/** Exón del ARNm que contiene la posición c.N de la región codificante (null en genes sin registro de ARNm). */
export function exonOfCds(g: GeneRecord, c: number): number | null {
  if (!g.mrna) return null;
  const m = g.mrna.cds.start + c - 1;
  return g.mrna.exons.find((e) => m >= e.start && m <= e.end)?.n ?? null;
}

/* ------------------------------------------------------------------ variantes */
export type VariantKind = 'sustitucion' | 'delecion' | 'insercion' | 'duplicacion';
export interface CodingVariant { kind: VariantKind; start: number; end: number; ref?: string; alt?: string; inserted?: string }
export type ParsedHgvs =
  | { coding: true; variant: CodingVariant }
  | { coding: false; region: 'corriente-arriba' | 'utr5' | 'utr3' | 'intron'; regionName: string };

/** Interpreta la notación HGVS c. de las formas usadas en el laboratorio (sustitución, deleción, duplicación, inserción). */
export function parseHgvsC(text: string, g?: GeneRecord): ParsedHgvs {
  const t = text.trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^c\.-(\d+)/))) {
    const n = Number(m[1]);
    const utr5 = g?.mrna ? g.mrna.cds.start - 1 : 0;
    return n > utr5
      ? { coding: false, region: 'corriente-arriba', regionName: `${n} nucleótidos antes del codón de inicio: fuera del ARNm de referencia, corriente arriba del gen` }
      : { coding: false, region: 'utr5', regionName: 'región 5′ no traducida del ARNm' };
  }
  if (/^c\.\*\d+/.test(t)) return { coding: false, region: 'utr3', regionName: 'región 3′ no traducida del ARNm' };
  if (/^c\.\d+[+-]\d+/.test(t)) return { coding: false, region: 'intron', regionName: 'intrón (no llega al ARNm maduro)' };
  if ((m = t.match(/^c\.(\d+)([ACGT])>([ACGT])$/))) return { coding: true, variant: { kind: 'sustitucion', start: +m[1], end: +m[1], ref: m[2], alt: m[3] } };
  if ((m = t.match(/^c\.(\d+)(?:_(\d+))?del([ACGT]*)$/))) return { coding: true, variant: { kind: 'delecion', start: +m[1], end: +(m[2] ?? m[1]) } };
  if ((m = t.match(/^c\.(\d+)(?:_(\d+))?dup([ACGT]*)$/))) return { coding: true, variant: { kind: 'duplicacion', start: +m[1], end: +(m[2] ?? m[1]) } };
  if ((m = t.match(/^c\.(\d+)_(\d+)ins([ACGT]+)$/))) {
    if (+m[2] !== +m[1] + 1) throw new RangeError('En una inserción, las dos posiciones deben ser vecinas (c.N_N+1ins…).');
    return { coding: true, variant: { kind: 'insercion', start: +m[1], end: +m[2], inserted: m[3] } };
  }
  throw new RangeError(`Notación HGVS no admitida en este laboratorio: ${text}`);
}

/** Escribe una variante de la región codificante en notación HGVS c. */
export function hgvsC(v: CodingVariant, cds: string): string {
  const pos = v.start === v.end ? `${v.start}` : `${v.start}_${v.end}`;
  if (v.kind === 'sustitucion') return `c.${v.start}${v.ref ?? cds[v.start - 1]}>${v.alt}`;
  if (v.kind === 'delecion') return `c.${pos}del`;
  if (v.kind === 'duplicacion') return `c.${pos}dup`;
  return `c.${v.start}_${v.end}ins${v.inserted}`;
}

export function validateVariant(cds: string, v: CodingVariant): void {
  assertInRange('La posición en la región codificante', v.start, 1, cds.length);
  assertInRange('La posición final', v.end, v.start, cds.length);
  if (!Number.isInteger(v.start) || !Number.isInteger(v.end)) throw new RangeError('Las posiciones deben ser números enteros.');
  if (v.kind === 'sustitucion') {
    if (!v.alt || !/^[ACGT]$/.test(v.alt)) throw new RangeError('Indica la base nueva (A, C, G o T).');
    if (v.ref && cds[v.start - 1] !== v.ref) throw new RangeError(`La base de referencia en c.${v.start} es ${cds[v.start - 1]}, no ${v.ref}.`);
    if (cds[v.start - 1] === v.alt) throw new RangeError('La base nueva es igual a la de referencia: no hay variante.');
  }
  if (v.kind === 'insercion' && !/^[ACGT]+$/.test(v.inserted ?? '')) throw new RangeError('Indica las bases insertadas.');
}

/** Región codificante con la variante aplicada. */
export function applyVariant(cds: string, v: CodingVariant): string {
  validateVariant(cds, v);
  const a = v.start - 1, b = v.end; // [a, b) en base 0
  switch (v.kind) {
    case 'sustitucion': return cds.slice(0, a) + v.alt + cds.slice(a + 1);
    case 'delecion': return cds.slice(0, a) + cds.slice(b);
    case 'duplicacion': return cds.slice(0, b) + cds.slice(a, b) + cds.slice(b);
    case 'insercion': return cds.slice(0, v.start) + v.inserted + cds.slice(v.start);
  }
}

export type Consequence = 'sinonima' | 'sentido-erroneo' | 'sin-sentido' | 'perdida-inicio' | 'perdida-terminacion' | 'cambio-marco' | 'en-marco' | 'no-codificante';
export const CONSEQUENCE_LABEL: Record<Consequence, string> = {
  sinonima: 'Sinónima (silenciosa)',
  'sentido-erroneo': 'De sentido erróneo',
  'sin-sentido': 'Sin sentido (terminación prematura)',
  'perdida-inicio': 'Pérdida del codón de inicio',
  'perdida-terminacion': 'Pérdida del codón de terminación',
  'cambio-marco': 'Cambio del marco de lectura',
  'en-marco': 'Inserción o deleción en el marco',
  'no-codificante': 'Fuera de la región codificante',
};

export interface VariantResult {
  hgvsC: string;
  consequence: Consequence;
  label: string;
  /** Notación de la proteína corta (como la usa ClinVar en el título) y larga (calculada). */
  hgvsP: string | null;
  hgvsPLong: string | null;
  /** Primer aminoácido que cambia (Met inicial = 1). */
  aaPosition: number | null;
  refAa: string | null; altAa: string | null;
  codon: number | null; refCodon: string | null; altCodon: string | null;
  refLength: number;
  /** Longitud de la proteína resultante, sin el codón de terminación (null si no hay terminación en la secuencia). */
  altLength: number | null;
  /** Identidad posición a posición con la proteína de referencia (resolución 0,1 %). */
  identity: number;
  exon: number | null;
  explanation: string;
}

function firstDiff(a: string, b: string): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return -1;
}

/** Consecuencia de una variante de la región codificante, por traducción de la secuencia de referencia y de la mutante. */
export function variantConsequence(g: GeneRecord, v: CodingVariant): VariantResult {
  const cds = g.cds;
  const alt = applyVariant(cds, v);
  const refP = translateCds(cds, true); // termina en «*»
  const altP = translateCds(alt, true);
  const refProt = refP.replace(/\*$/, '');
  const altStop = altP.endsWith('*');
  const altProt = altP.replace(/\*$/, '');
  const identity = roundToResolution(compareProteins(refProt, altProt).identity, 0.1);
  const name = hgvsC(v, cds);
  const exon = exonOfCds(g, v.start);
  const base = { hgvsC: name, refLength: refProt.length, altLength: altStop ? altProt.length : null, identity, exon };

  if (v.kind === 'sustitucion') {
    const codon = Math.floor((v.start - 1) / 3) + 1;
    const rc = cds.slice((codon - 1) * 3, codon * 3), ac = alt.slice((codon - 1) * 3, codon * 3);
    const ra = GENETIC_CODE[rc.replace(/T/g, 'U')], aa = GENETIC_CODE[ac.replace(/T/g, 'U')];
    const common = { ...base, aaPosition: codon, refAa: ra, altAa: aa, codon, refCodon: rc, altCodon: ac };
    if (codon === 1 && aa !== 'M') {
      return { ...common, consequence: 'perdida-inicio', label: CONSEQUENCE_LABEL['perdida-inicio'], hgvsP: 'p.Met1?', hgvsPLong: 'p.Met1?', explanation: `El codón de inicio ${rc} → ${ac} ya no codifica metionina: la traducción no puede empezar en el mismo punto. El efecto real depende de si el ribosoma encuentra otro codón de inicio.` };
    }
    if (ra === aa) {
      return { ...common, consequence: 'sinonima', label: CONSEQUENCE_LABEL.sinonima, hgvsP: `p.${three(ra)}${codon}=`, hgvsPLong: `p.${three(ra)}${codon}=`, explanation: `El codón ${rc} → ${ac} sigue codificando ${AMINO_ACIDS[ra].name.toLowerCase()}: el código genético es redundante. La secuencia de la proteína no cambia (en una célula, el cambio aún podría afectar el empalme o la regulación).` };
    }
    if (aa === '*') {
      return { ...common, consequence: 'sin-sentido', label: CONSEQUENCE_LABEL['sin-sentido'], hgvsP: `p.${three(ra)}${codon}Ter`, hgvsPLong: `p.${three(ra)}${codon}Ter`, explanation: `El codón ${rc} (${three(ra)}) pasa a ${ac}, un codón de terminación: la traducción se detiene y la proteína queda de ${codon - 1} aminoácidos en vez de ${refProt.length}.` };
    }
    if (ra === '*') {
      return { ...common, consequence: 'perdida-terminacion', label: CONSEQUENCE_LABEL['perdida-terminacion'], hgvsP: `p.Ter${codon}${three(aa)}ext*?`, hgvsPLong: `p.Ter${codon}${three(aa)}ext*?`, explanation: `El codón de terminación ${rc} pasa a ${ac} (${three(aa)}): el ribosoma seguiría leyendo la región 3′ no traducida, que no está en la región codificante guardada.` };
    }
    return { ...common, consequence: 'sentido-erroneo', label: CONSEQUENCE_LABEL['sentido-erroneo'], hgvsP: `p.${three(ra)}${codon}${three(aa)}`, hgvsPLong: `p.${three(ra)}${codon}${three(aa)}`, explanation: `El codón ${codon} cambia de ${rc} (${AMINO_ACIDS[ra].name}, ${AMINO_ACIDS[ra].property}) a ${ac} (${AMINO_ACIDS[aa].name}, ${AMINO_ACIDS[aa].property}). El efecto sobre la función depende del aminoácido nuevo y de su lugar en la proteína.` };
  }

  const delta = alt.length - cds.length;
  const i = firstDiff(refP, altP);
  const k = i + 1;
  const ra = i >= 0 ? refP[i] ?? null : null, aa = i >= 0 ? altP[i] ?? null : null;
  const common = { ...base, aaPosition: i >= 0 ? k : null, refAa: ra, altAa: aa, codon: i >= 0 ? k : null, refCodon: i >= 0 ? cds.slice(i * 3, i * 3 + 3) : null, altCodon: i >= 0 ? alt.slice(i * 3, i * 3 + 3) : null };
  if (delta % 3 !== 0) {
    const short = ra ? `p.${three(ra)}${k}fs` : null;
    const ter = altStop ? altP.length - i : null; // posición de la nueva terminación contando el primer aminoácido cambiado como 1
    const long = ra && aa ? (aa === '*' ? `p.${three(ra)}${k}Ter` : `p.${three(ra)}${k}${three(aa)}fsTer${ter ?? '?'}`) : null;
    return { ...common, consequence: 'cambio-marco', label: CONSEQUENCE_LABEL['cambio-marco'], hgvsP: short, hgvsPLong: long, explanation: `${Math.abs(delta) === 1 ? (delta > 0 ? 'Se añade 1 nucleótido' : 'Se pierde 1 nucleótido') : `Se ${delta > 0 ? 'añaden' : 'pierden'} ${Math.abs(delta)} nucleótidos`} (no es múltiplo de 3): desde el codón ${k} los codones se leen agrupados de otra forma${altStop ? ` y aparece una terminación tras ${ter} codones` : ''}. La proteína resultante tiene ${altStop ? `${altProt.length} aminoácidos` : 'una longitud que no se puede calcular con la región codificante guardada'}.` };
  }
  if (i < 0) {
    return { ...common, consequence: 'sinonima', label: CONSEQUENCE_LABEL.sinonima, hgvsP: 'p.=', hgvsPLong: 'p.=', explanation: 'La variante cambia la secuencia de ADN pero no la de la proteína.' };
  }
  return { ...common, consequence: 'en-marco', label: CONSEQUENCE_LABEL['en-marco'], hgvsP: `p.${three(ra ?? '?')}${k}${delta < 0 ? 'del' : 'ins'}`, hgvsPLong: null, explanation: `Se ${delta > 0 ? 'añaden' : 'pierden'} ${Math.abs(delta)} nucleótidos (múltiplo de 3): el marco de lectura se conserva y la proteína ${delta > 0 ? 'gana' : 'pierde'} ${Math.abs(delta) / 3} aminoácido${Math.abs(delta) === 3 ? '' : 's'} desde el codón ${k}.` };
}

/** Consecuencia de una variante escrita en HGVS c. (las no codificantes no se traducen). */
export function consequenceFromHgvs(g: GeneRecord, text: string): VariantResult {
  const p = parseHgvsC(text, g);
  if (p.coding) return variantConsequence(g, p.variant);
  return {
    hgvsC: text, consequence: 'no-codificante', label: CONSEQUENCE_LABEL['no-codificante'], hgvsP: null, hgvsPLong: null,
    aaPosition: null, refAa: null, altAa: null, codon: null, refCodon: null, altCodon: null, refLength: g.protein.length, altLength: g.protein.length,
    identity: 100, exon: null,
    explanation: `La variante está en la ${p.regionName}: no cambia los codones, así que la traducción de referencia no predice ningún cambio de aminoácido. Su posible efecto (por ejemplo, sobre cuánto se transcribe el gen) no se puede calcular con este modelo.`,
  };
}

/** Número de la HGVS c. escrito en un título de ClinVar, p. ej. «NM_000518.5(HBB):c.20A>T (p.Glu7Val)». */
export function clinvarHgvs(title: string): { transcript: string; c: string; p: string | null } | null {
  const m = title.match(/^(\S+?)\(([^)]+)\):(c\.\S+)(?: \((p\.[^)]+)\))?/);
  return m ? { transcript: m[1], c: m[3], p: m[4] ?? null } : null;
}

/* ------------------------------------------------------------------ evidencia */
export type EvidenceKind = 'demostrado' | 'inferido' | 'sin-codigo' | 'calculado' | 'sin-informacion';
export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  demostrado: 'Demostrado',
  inferido: 'Inferido',
  'sin-codigo': 'Sin código de evidencia',
  calculado: 'Calculado en el laboratorio',
  'sin-informacion': 'Sin información en los registros',
};
export const EVIDENCE_HELP: Record<EvidenceKind, string> = {
  demostrado: 'El registro cita evidencia experimental (código ECO que desciende de «experimental evidence», ECO:0000006) o es una secuencia medida.',
  inferido: 'El registro lo deduce por similitud, por inferencia del curador o por una asociación estadística, sin un experimento que lo pruebe directamente.',
  'sin-codigo': 'Es una anotación curada, pero el registro no indica con qué tipo de evidencia se sustenta.',
  calculado: 'Lo calcula este laboratorio a partir de los datos guardados (traducción, longitudes); no es una medición nueva.',
  'sin-informacion': 'Los registros consultados no traen este dato para este gen.',
};

export function ecoLabel(code: string): string { return ECO.terms[code]?.label ?? 'código no clasificado'; }
export function isExperimentalEco(code: string): boolean { return ECO.terms[code]?.experimental ?? false; }

/** Clase de evidencia de una afirmación según sus códigos ECO (al menos uno experimental → demostrado). */
export function classifyCodes(codes: readonly (string | null)[]): EvidenceKind {
  const c = codes.filter((x): x is string => !!x);
  if (c.length === 0) return 'sin-codigo';
  return c.some(isExperimentalEco) ? 'demostrado' : 'inferido';
}

/**
 * Estatus del sistema de procedencia (ADR 0002) que corresponde a cada clase de evidencia. «Inferido» por similitud
 * de secuencia o por análisis computacional → «Predicción computacional»; una inferencia del curador o una asociación
 * no encaja en ninguna de las cinco categorías y se muestra solo con su rótulo «Inferido» (null).
 */
export function statusOf(kind: EvidenceKind, codes: readonly (string | null)[] = []): EpistemicStatus | null {
  switch (kind) {
    case 'demostrado': return 'experimental';
    case 'calculado': return 'modelo';
    case 'sin-codigo':
    case 'sin-informacion': return 'sin-informacion';
    case 'inferido':
      return codes.some((c) => c && ECO.terms[c]?.roots.includes('computational evidence')) ? 'prediccion' : null;
  }
}

/* ------------------------------------------------------------------ ruta del gen a la función */
export type StepId = 'genoma' | 'gen' | 'regulacion' | 'transcripcion' | 'arn' | 'procesamiento' | 'traduccion' | 'proteina' | 'estructura' | 'funcion' | 'interacciones' | 'rutas' | 'fenotipo';
export const STEP_ORDER: StepId[] = ['genoma', 'gen', 'regulacion', 'transcripcion', 'arn', 'procesamiento', 'traduccion', 'proteina', 'estructura', 'funcion', 'interacciones', 'rutas', 'fenotipo'];
export const STEP_TITLE: Record<StepId, string> = {
  genoma: 'Genoma', gen: 'Gen', regulacion: 'Región reguladora', transcripcion: 'Transcripción', arn: 'ARN', procesamiento: 'Procesamiento (exones e intrones)',
  traduccion: 'Traducción', proteina: 'Proteína', estructura: 'Estructura', funcion: 'Función', interacciones: 'Interacciones', rutas: 'Rutas', fenotipo: 'Fenotipo',
};

export interface Claim {
  text: string;
  /** Cita textual del registro (en inglés), si la hay. */
  quote?: string;
  kind: EvidenceKind;
  status: EpistemicStatus | null;
  codes: string[];
  /** Por qué tiene esa clase de evidencia (en palabras). */
  basis: string;
  source: Source | null;
  links?: { label: string; href: string }[];
}
export interface TraceStep { id: StepId; title: string; claims: Claim[] }

const claim = (c: Omit<Claim, 'status'> & { status?: EpistemicStatus | null }): Claim => ({ ...c, status: c.status !== undefined ? c.status : statusOf(c.kind, c.codes) });
const codesOf = (e: Excerpt | null) => (e ? [...new Set(e.evidence.map((x) => x.code))] : []);
const pmids = (e: Excerpt | null) => (e ? e.evidence.filter((x) => x.source === 'PubMed' && x.id).map((x) => ({ label: `PubMed ${x.id}`, href: `https://pubmed.ncbi.nlm.nih.gov/${x.id}/` })) : []);
const ecoBasis = (codes: string[]) => (codes.length ? codes.map((c) => `${c} (${ecoLabel(c)})`).join('; ') : 'el registro no da código de evidencia');
const fromExcerpt = (text: string, e: Excerpt, source: Source): Claim => {
  const codes = codesOf(e);
  return claim({ text, quote: e.quote, kind: classifyCodes(codes), codes, basis: `UniProt: ${ecoBasis(codes)}.`, source, links: pmids(e) });
};
const nfmt = (n: number) => fmt(n, 0);

/** Las trece etapas de la ruta para un gen, cada afirmación con su fuente y su tipo de evidencia. */
export function traceSteps(g: GeneRecord): TraceStep[] {
  const st = geneStructure(g);
  const es = GENE_INFO_ES[g.key];
  const u = g.uniprot;
  const steps: Record<StepId, Claim[]> = {} as Record<StepId, Claim[]>;
  const none = (text: string, source: Source | null = null): Claim => claim({ text, kind: 'sin-informacion', codes: [], basis: 'No hay dato en los registros consultados.', source });

  steps.genoma = [claim({
    text: `${es.organism[0].toUpperCase()}${es.organism.slice(1)} (${g.gene.organism}, taxón ${g.gene.taxId}). El gen está en la secuencia de referencia ${g.gene.genomic.accession}${g.gene.chromosome ? `, cromosoma ${g.gene.chromosome}` : ''}${g.gene.mapLocation ? ` (banda ${g.gene.mapLocation})` : ''}.`,
    kind: 'demostrado', codes: [], basis: 'Secuencia genómica determinada experimentalmente (registro RefSeq de la secuencia ensamblada).', source: g.genomicSource,
  })];
  steps.gen = [claim({
    text: `NCBI Gene ${g.gene.geneId}: ${g.gene.symbol} («${g.gene.description}»), posiciones ${nfmt(g.gene.genomic.start)} a ${nfmt(g.gene.genomic.end)} de ${g.gene.genomic.accession}, hebra ${g.gene.genomic.strand === '-' ? 'complementaria (−)' : 'directa (+)'}.`,
    kind: 'sin-codigo', codes: [], basis: 'Anotación de NCBI Gene (ubicación por alineamiento del transcrito al genoma); el resumen del registro no da código de evidencia.', source: g.gene.source,
  })];

  const reg: Claim[] = g.regulatory.map((r) => {
    const codes = r.evidence.code ? [r.evidence.code] : [];
    const where = r.geneEnd < 0 ? `de la posición ${nfmt(r.geneStart)} a la ${nfmt(r.geneEnd)} (corriente arriba del inicio del gen)` : r.geneStart < 0 ? `de la posición ${nfmt(r.geneStart)} a la +${nfmt(r.geneEnd)}` : `de la posición +${nfmt(r.geneStart)} a la +${nfmt(r.geneEnd)} (dentro del gen)`;
    return claim({
      text: `${REG_CLASS_ES[r.regClass] ?? `Elemento «${r.regClass}»`} anotado ${where}. Que un ensayo demuestre actividad reguladora en un tipo de célula no basta para afirmar que regula este gen en todos los tejidos.`,
      quote: [r.note, r.function].filter(Boolean).join(' — '), kind: classifyCodes(codes), codes,
      basis: `RefSeq Functional Elements: ${r.evidence.text} (${ecoBasis(codes)}).`, source: g.genomicSource,
      links: r.evidence.pmids.map((id) => ({ label: `PubMed ${id}`, href: `https://pubmed.ncbi.nlm.nih.gov/${id}/` })),
    });
  });
  if (u.induction) reg.push(fromExcerpt(g.key === 'lacZ' ? 'UniProt indica que la expresión de lacZ se induce con alolactosa.' : 'UniProt indica de qué depende la expresión del gen.', u.induction, u.source));
  for (const v of g.variants) {
    const p = parseHgvsC(v.hgvsC ?? '', g);
    if (!p.coding && p.region === 'corriente-arriba') {
      reg.push(claim({
        text: `Variante ${v.dbSNP ?? ''} ${v.hgvsC} (${v.transcript}): ${p.regionName}. ClinVar la registra como «${v.classification}» con el rasgo «${v.traits.join(', ') || 'no indicado'}».`,
        kind: 'inferido', status: null, codes: [], basis: `ClinVar: clasificación «${v.classification}», estado de revisión «${v.reviewStatus}». Una asociación no demuestra el mecanismo.`, source: v.source,
      }));
    }
  }
  steps.regulacion = reg.length ? reg : [none('Los registros consultados (anotación RefSeq de la región y UniProt) no traen regiones reguladoras con evidencia experimental para este gen en la ventana revisada.', g.genomicSource)];

  steps.transcripcion = [claim({
    text: g.mrna
      ? `La ARN polimerasa copia ${nfmt(st.geneLength)} nucleótidos del genoma (del inicio del exón 1 al final del exón ${st.exons.length}) en un pre-ARNm; se usa como molde la hebra ${g.gene.genomic.strand === '-' ? 'directa (+), porque el gen está en la hebra −' : 'complementaria (−), porque el gen está en la hebra +'}.`
      : `En el genoma de E. coli la región codificante de lacZ ocupa ${nfmt(st.geneLength)} nucleótidos en la hebra ${g.gene.genomic.strand === '-' ? 'complementaria (−)' : 'directa (+)'}. El conjunto no incluye un registro del transcrito, así que su inicio exacto no se muestra.`,
    kind: 'calculado', codes: [], basis: 'Calculado con las coordenadas del transcrito en el genoma (registro RefSeq).', source: g.genomicSource,
  })];
  if (u.tissue) steps.transcripcion.push(fromExcerpt('UniProt indica dónde se expresa.', u.tissue, u.source));

  if (g.mrna) {
    steps.arn = [
      claim({
        text: `ARNm de referencia ${g.mrna.accession}: ${nfmt(g.mrna.length)} nucleótidos; estado RefSeq «${g.mrna.refseqStatus}»${g.mrna.mane ? ', transcrito MANE Select' : ''}.`,
        kind: 'demostrado', codes: [], basis: 'Secuencia derivada de ARNm y ADNc secuenciados (registro RefSeq revisado por el personal del NCBI).', source: g.mrna.source,
      }),
      claim({
        text: `Región 5′ no traducida: ${nfmt(st.utr5 ?? 0)} nt; región codificante: ${nfmt(st.cdsLength)} nt (posiciones ${g.mrna.cds.start} a ${g.mrna.cds.end}); región 3′ no traducida: ${nfmt(st.utr3 ?? 0)} nt.`,
        kind: 'calculado', codes: [], basis: 'Calculado con las coordenadas del CDS en el registro del ARNm.', source: g.mrna.source,
      }),
    ];
  } else {
    steps.arn = [none('No hay registro de ARNm de RefSeq para este gen bacteriano en el conjunto; en bacterias el ARNm no se procesa por empalme.', g.genomicSource)];
  }

  if (g.mrna) {
    const codes = g.mrna.evidenceCodes;
    steps.procesamiento = [
      claim({
        text: `${st.exons.length} exones y ${st.introns.length} intrones. Los exones suman ${nfmt(st.exonicLength)} nt (${fmtPct(st.exonicPercent)} del gen) y los intrones ${nfmt(st.intronicLength)} nt.`,
        kind: 'calculado', codes: [], basis: 'Calculado con las coordenadas de los exones en el genoma.', source: g.genomicSource,
      }),
      claim({
        text: 'La combinación de exones del transcrito y las posiciones de sus intrones están respaldadas por la evidencia que declara el registro.',
        kind: classifyCodes(codes), codes, basis: `RefSeq (Evidence-Data): ${ecoBasis(codes)}.`, source: g.mrna.source,
      }),
    ];
  } else {
    steps.procesamiento = [claim({ text: 'La anotación tiene un solo bloque codificante: el gen no tiene intrones, de modo que no hay empalme.', kind: 'sin-codigo', codes: [], basis: 'Anotación RefSeq del genoma (un solo intervalo en la característica CDS); sin código de evidencia.', source: g.genomicSource })];
  }

  const prot = translateCds(g.cds, true);
  steps.traduccion = [claim({
    text: `${nfmt(st.codons)} codones, del ATG inicial al codón de terminación ${g.cds.slice(-3)}. Al traducirlos con el código genético estándar se obtienen ${nfmt(prot.length - 1)} aminoácidos, ${prot.replace(/\*$/, '') === g.protein.sequence ? 'idénticos a' : 'DISTINTOS de'} la proteína ${g.protein.accession}.`,
    kind: 'calculado', codes: [], basis: 'Traducción calculada en el laboratorio (tabla 1 del NCBI) y comparada con la proteína guardada.', source: g.protein.source,
  })];

  const pe = u.proteinExistence ?? '';
  steps.proteina = [claim({
    text: `${g.protein.accession} y UniProt ${u.accession} (${u.reviewed ? 'entrada revisada, Swiss-Prot' : 'entrada sin revisar'}): «${u.proteinName}», ${nfmt(u.length)} aminoácidos${u.ec.length ? `, EC ${u.ec.join(', ')}` : ''}. Las dos secuencias ${u.sameSequenceAsRefSeq ? 'son idénticas' : 'difieren'}.`,
    quote: pe || undefined, kind: /^1:/.test(pe) || /^2:/.test(pe) ? 'demostrado' : pe ? 'inferido' : 'sin-codigo', codes: [],
    basis: `UniProt, existencia de la proteína: «${pe || 'no indicada'}».`, source: u.source,
  })];

  if (g.structure) {
    const s = g.structure;
    steps.estructura = [claim({
      text: `Estructura experimental PDB ${s.pdb} («${s.title}»): ${METHOD_ES[s.method ?? ''] ?? s.method}${s.resolution ? `, resolución ${fmtNum(s.resolution, 2)} Å` : ''}; publicada en el PDB el ${s.released}. UniProt indica que cubre los residuos ${s.chainsUniProt}. Es una de ${nfmt(u.pdbTotal)} entradas PDB referenciadas.`,
      kind: 'demostrado', codes: [], basis: `Método experimental según RCSB PDB (${s.method}).`, source: s.source,
    })];
  } else {
    steps.estructura = [none(`UniProt no referencia ninguna estructura experimental del PDB para ${u.accession}.`, u.source)];
    if (u.alphafold) steps.estructura.push(claim({ text: `Existe un modelo predicho en AlphaFold DB (${u.alphafold}). No es una estructura medida: es una predicción computacional con su propia confianza por residuo.`, kind: 'inferido', status: 'prediccion', codes: [], basis: 'Referencia cruzada de UniProt a AlphaFold DB (modelo predicho, no experimental).', source: u.source, links: [{ label: `AlphaFold DB ${u.alphafold}`, href: `https://alphafold.ebi.ac.uk/entry/${u.alphafold}` }] }));
  }

  const fn: Claim[] = [];
  if (u.function) fn.push(fromExcerpt(es.gloss, u.function, u.source));
  for (const c of u.catalytic) {
    const kind = classifyCodes(c.evidence);
    fn.push(claim({ text: u.function ? `Reacción catalizada: ${c.reaction}.` : es.gloss, quote: c.reaction, kind, codes: c.evidence, basis: `UniProt, actividad catalítica${c.ec ? ` (EC ${c.ec})` : ''}${c.rhea ? `, ${c.rhea}` : ''}: ${ecoBasis(c.evidence)}.`, source: u.source }));
  }
  steps.funcion = fn.length ? fn : [none('UniProt no trae un comentario de función para esta entrada.', u.source)];

  const inter: Claim[] = u.interactions.map((i) => claim({
    text: `${g.gene.symbol} con ${i.gene} (${i.partner}${i.partner === u.accession ? ', consigo misma' : ''}): ${i.experiments} experimento${i.experiments === 1 ? '' : 's'} registrado${i.experiments === 1 ? '' : 's'} en IntAct.`,
    kind: 'demostrado', codes: [], basis: 'UniProt, sección de interacciones binarias tomadas de IntAct, una base de datos de interacciones observadas en experimentos.', source: u.source,
    links: [{ label: `IntAct ${i.intact[0]}`, href: `https://www.ebi.ac.uk/intact/search?query=${encodeURIComponent(u.accession)}` }],
  }));
  if (u.subunit) inter.push(fromExcerpt('Composición de la proteína funcional (subunidades) según UniProt.', u.subunit, u.source));
  steps.interacciones = inter.length ? inter : [none('UniProt no registra interacciones binarias ni subunidades para esta entrada.', u.source)];

  steps.rutas = u.pathways.length
    ? u.pathways.map((p) => claim({ text: `Reactome ${p.id}: «${p.name}».`, kind: 'sin-codigo', codes: [], basis: 'Referencia cruzada de UniProt a Reactome (rutas curadas a partir de la literatura); la referencia no indica el tipo de evidencia de cada paso.', source: u.source, links: [{ label: `Reactome ${p.id}`, href: `https://reactome.org/content/detail/${p.id}` }] }))
    : [none(`UniProt no enlaza rutas de Reactome para ${u.accession}${u.otherPathwayXrefs.length ? `; solo tiene referencias cruzadas sin tipo de evidencia a ${u.otherPathwayXrefs.join(', ')}` : ''}.`, u.source)];
  if (u.pathways.length && u.pathwayTotal > u.pathways.length) steps.rutas.push(claim({ text: `UniProt enlaza ${u.pathwayTotal} rutas de Reactome; se muestran las ${u.pathways.length} primeras.`, kind: 'sin-codigo', codes: [], basis: 'Conteo de referencias cruzadas en UniProt.', source: u.source }));

  const phe: Claim[] = u.diseases.map((d) => claim({
    text: `${d.name}${d.acronym ? ` (${d.acronym})` : ''}${d.mim ? `, MIM ${d.mim}` : ''}.`, quote: d.note ?? undefined, kind: classifyCodes(d.evidence), codes: d.evidence,
    basis: `UniProt, enfermedad: ${ecoBasis(d.evidence)}.`, source: u.source, links: d.mim ? [{ label: `OMIM ${d.mim}`, href: `https://omim.org/entry/${d.mim}` }] : [],
  }));
  if (u.polymorphism) phe.push(fromExcerpt('Variación común asociada a un rasgo, según UniProt.', u.polymorphism, u.source));
  for (const v of g.variants) {
    const p = parseHgvsC(v.hgvsC ?? '', g);
    if (p.coding) phe.push(claim({ text: `${v.hgvsC} ${v.hgvsP ?? ''} (${v.dbSNP}): ClinVar «${v.classification}».`, kind: 'inferido', status: null, codes: [], basis: `ClinVar: clasificación clínica (estado de revisión «${v.reviewStatus}»), una interpretación de evidencias de laboratorios y publicaciones, no un experimento.`, source: v.source }));
  }
  steps.fenotipo = phe.length ? phe : [none(`UniProt no registra enfermedades ni rasgos asociados a ${g.gene.symbol} en ${g.gene.organism}.`, u.source)];

  return STEP_ORDER.map((id) => ({ id, title: STEP_TITLE[id], claims: steps[id] }));
}

const REG_CLASS_ES: Record<string, string> = {
  promoter: 'Promotor', TATA_box: 'Caja TATA', CAAT_signal: 'Caja CAAT', GC_signal: 'Caja GC', enhancer: 'Potenciador («enhancer»)', silencer: 'Silenciador',
  transcriptional_cis_regulatory_region: 'Región cis reguladora de la transcripción', locus_control_region: 'Región de control del locus', response_element: 'Elemento de respuesta',
  insulator: 'Aislador', enhancer_blocking_element: 'Elemento bloqueador de potenciadores',
};
const METHOD_ES: Record<string, string> = { 'X-RAY DIFFRACTION': 'difracción de rayos X', 'SOLUTION NMR': 'resonancia magnética nuclear en solución', 'ELECTRON MICROSCOPY': 'criomicroscopía electrónica' };
const fmtNum = (v: number, d: number) => fmt(v, d);
const fmtPct = (v: number) => `${fmt(v, 1)} %`;

/** Clase de evidencia que domina una etapa (la del primer enunciado). */
export function stepEvidence(step: TraceStep): EvidenceKind { return step.claims[0].kind; }

/* ------------------------------------------------------------------ registro de ensayos */
export interface VariantTrialInput { geneKey: string; kind: VariantKind; position: number; base?: string }

/** Variante de una base (sustitución, deleción, inserción o duplicación) en la posición c.N. */
export function singleBaseVariant(g: GeneRecord, input: VariantTrialInput): CodingVariant {
  const n = input.position;
  assertInRange('La posición en la región codificante', n, 1, g.cds.length);
  if (input.kind === 'sustitucion') return { kind: 'sustitucion', start: n, end: n, ref: g.cds[n - 1], alt: input.base };
  if (input.kind === 'insercion') {
    if (n >= g.cds.length) throw new RangeError('Para insertar, elige una posición antes de la última base.');
    return { kind: 'insercion', start: n, end: n + 1, inserted: input.base };
  }
  return { kind: input.kind, start: n, end: n };
}

export const MAX_CDS = Math.max(...GENES.map((g) => g.cds.length));

export const geneTraceModelSpec: ModelSpec = {
  name: 'Rastreo génico con registros reales: estructura del gen, traducción de referencia, consecuencia de variantes y tipo de evidencia',
  inputs: [
    { symbol: 'gen', name: 'Gen del conjunto curado (HBB, INS, LCT, OCA2 o lacZ)', unit: '—', initial: 'HBB' },
    { symbol: 'tipo', name: 'Tipo de variante (sustitución, deleción, inserción o duplicación de una base; o variante registrada en ClinVar)', unit: '—', initial: 'ClinVar' },
    { symbol: 'c', name: 'Posición en la región codificante (c.1 = A del ATG)', unit: 'nt', range: [1, MAX_CDS], initial: 20 },
    { symbol: 'b', name: 'Base nueva', unit: '—', initial: 'T' },
  ],
  outputs: [
    { symbol: 'Lₑ', name: 'Suma de las longitudes de los exones (= longitud del ARNm)', unit: 'nt' },
    { symbol: 'Lᵢ', name: 'Suma de las longitudes de los intrones', unit: 'nt' },
    { symbol: 'fₑ', name: 'Fracción exónica del gen', unit: '%' },
    { symbol: 'p.', name: 'Cambio en la proteína (notación HGVS) y clase de consecuencia', unit: '—' },
    { symbol: 'Lₚ', name: 'Longitud de la proteína resultante', unit: 'aa' },
    { symbol: 'I', name: 'Identidad con la proteína de referencia (posición a posición)', unit: '%' },
  ],
  equations: [
    'Intrón k: inicio = fin del exón k + 1; fin = inicio del exón k+1 − 1; Lᵢ = Σ (fin − inicio + 1)',
    'fₑ = Lₑ / (Lₑ + Lᵢ) × 100, redondeada a 0,1 %',
    'Codón de la posición c: ⌊(c − 1)/3⌋ + 1; aminoácido = código genético estándar (tabla 1 del NCBI)',
    'Sustitución: igual aminoácido → sinónima; otro aminoácido → sentido erróneo; codón de terminación → sin sentido; codón 1 sin Met → pérdida del inicio',
    'Inserción o deleción de n nt: n no múltiplo de 3 → cambio del marco (p.XxxNfs); múltiplo de 3 → en el marco',
    'I = (posiciones idénticas / longitud de la proteína más larga) × 100',
  ],
  initialConditions: [
    `Registros de NCBI Gene, RefSeq, ClinVar, UniProt y RCSB PDB consultados el ${GENES_RETRIEVED} (src/data/genes.ts).`,
    'Gen inicial: HBB humano; variante inicial: NM_000518.5(HBB):c.20A>T de ClinVar.',
  ],
  assumptions: [
    'La región codificante guardada es la del transcrito de referencia elegido (MANE Select en los genes humanos); otros transcritos pueden tener otros exones.',
    'La traducción empieza en c.1 y usa el código genético estándar; no se modelan el empalme alternativo, la degradación del ARNm por codones prematuros ni las modificaciones de la proteína.',
    'La consecuencia de una variante se predice solo para la secuencia de aminoácidos; su efecto en la célula o en la persona (fenotipo) no se calcula.',
    'La clase de evidencia se toma de los códigos ECO del registro (experimental si desciende de ECO:0000006 en la ontología); las interacciones de IntAct se cuentan como demostradas y las rutas de Reactome como «sin código de evidencia».',
  ],
  limits: [
    'Conjunto curado de cinco genes, no una búsqueda abierta en bases públicas; los registros cambian con nuevas versiones (por eso se guardan versión y fecha).',
    'Las variantes hipotéticas son de una sola base; las variantes no codificantes (promotor, intrones, regiones no traducidas) no se traducen.',
    'Las hipótesis de perturbación son conceptuales: el efecto depende del organismo, del contexto y del modelo, y nunca se presenta como universal.',
    'No incluye genes de virulencia de patógenos ni secuencias con riesgo de uso dual (sección 14.3).',
  ],
  testCases: [
    'Cada gen tiene identificadores, fuentes con URL y fecha de consulta 2026-10-18.',
    'La traducción de cada CDS guardado es idéntica a la proteína RefSeq guardada y termina en un codón de terminación.',
    'Los exones del ARNm son contiguos y suman su longitud; coinciden en longitud con los exones del genoma.',
    'HBB c.20A>T → p.Glu7Val (sentido erróneo), c.118C>T → p.Gln40Ter (sin sentido) y c.27dup → p.Ser10fs (cambio del marco), igual que ClinVar.',
    'HBB tiene 3 exones y 2 intrones (130 y 850 nt) y una fracción exónica de 39,1 %.',
    'Los códigos ECO se clasifican según la ontología: ECO:0000269 → demostrado; ECO:0000305 → inferido.',
  ],
};

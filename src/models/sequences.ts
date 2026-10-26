import type { ModelSpec } from './types';
import { assertInRange, roundToResolution } from './math';
import type { EpistemicStatus } from '../lib/provenance';
import { classifyWarnings, type ModelCondition } from './conditions';

/**
 * Secuencias biológicas (11.º; programa v2, sección 10.1, nivel 0: todo en el navegador).
 * Lectura de FASTA y GenBank, validación de alfabetos IUPAC, composición y %GC, complemento y reverso complementario,
 * transcripción, traducción con las tablas 1, 2 y 11 del NCBI, marcos de lectura abiertos (ORF) en los seis marcos y
 * alineamiento global (Needleman–Wunsch) y local (Smith–Waterman) con penalización afín de huecos (Gotoh).
 * Las salidas se validaron contra Biopython 1.85 (tests/fixtures/biopython-secuencias.json).
 * Funciones puras y deterministas: sin React ni red.
 */

export type SeqKind = 'adn' | 'arn' | 'proteina';
export const KIND_LABEL: Record<SeqKind, string> = { adn: 'ADN', arn: 'ARN', proteina: 'Proteína' };

/** Límites de entrada (sección 14.1: validación y límites de tamaño). */
export const SEQ_LIMITS = {
  /** Tamaño máximo del texto o del archivo cargado, en bytes (1 MiB). */
  maxBytes: 1_048_576,
  /** Número máximo de registros por archivo. */
  maxRecords: 50,
  /** Longitud máxima del encabezado que se conserva (caracteres). */
  maxHeader: 200,
  /** Longitud máxima de cada secuencia en el alineamiento. */
  maxAlignLength: 3000,
  /** Producto máximo de longitudes (celdas de la matriz de programación dinámica). */
  maxAlignCells: 4_000_000,
  /** Rango de la penalización de huecos (apertura y extensión, en unidades de puntaje). */
  gap: [0, 30] as [number, number],
  /** Rango del puntaje de coincidencia y de no coincidencia (ADN). */
  match: [1, 10] as [number, number],
  mismatch: [-10, 0] as [number, number],
  /** Longitud mínima de un ORF (aminoácidos, sin contar el codón de terminación). */
  minOrfAa: [1, 1000] as [number, number],
};

/* ------------------------------------------------------------------ alfabetos IUPAC */

/** Códigos IUPAC de nucleótidos con su expansión a bases (en alfabeto de ADN). */
export const IUPAC_NUC: Record<string, string> = {
  A: 'A', C: 'C', G: 'G', T: 'T', U: 'T',
  R: 'AG', Y: 'CT', S: 'CG', W: 'AT', K: 'GT', M: 'AC',
  B: 'CGT', D: 'AGT', H: 'ACT', V: 'ACG', N: 'ACGT',
};
export const AMBIGUOUS_NUC = 'RYSWKMBDHVN';
/** Complemento IUPAC (A↔T, C↔G, R↔Y, K↔M, B↔V, D↔H; S, W y N son su propio complemento). */
const COMPLEMENT: Record<string, string> = {
  A: 'T', T: 'A', U: 'A', G: 'C', C: 'G', R: 'Y', Y: 'R', S: 'S', W: 'W', K: 'M', M: 'K',
  B: 'V', V: 'B', D: 'H', H: 'D', N: 'N',
};
/** 20 aminoácidos estándar. */
export const STANDARD_AA = 'ACDEFGHIKLMNPQRSTVWY';
/** Otros símbolos IUPAC de proteína: B (D o N), Z (E o Q), J (I o L), X (cualquiera), U (selenocisteína), O (pirrolisina), * (terminación). */
export const EXTRA_AA = 'BZJXUO*';

export interface InvalidChar { position: number; char: string }
export interface Validation {
  ok: boolean;
  /** Primeros caracteres no válidos (posición 1-based). */
  invalid: InvalidChar[];
  invalidCount: number;
  /** Número de códigos ambiguos (nucleótidos: R, Y, …, N; proteína: B, Z, J, X). */
  ambiguous: number;
  messages: string[];
}

/** Limpia una secuencia escrita o pegada: mayúsculas, sin espacios ni números de posición (como en GenBank). */
export function cleanSequence(raw: string): string {
  return raw.toUpperCase().replace(/[\s\d]/g, '');
}

/** Valida el alfabeto según el tipo. Las letras ambiguas se aceptan, pero se cuentan y se avisa. */
export function validateSequence(seq: string, kind: SeqKind): Validation {
  const allowed = kind === 'adn' ? 'ACGT' + AMBIGUOUS_NUC : kind === 'arn' ? 'ACGU' + AMBIGUOUS_NUC : STANDARD_AA + EXTRA_AA;
  const ambig = kind === 'proteina' ? 'BZJX' : AMBIGUOUS_NUC;
  const invalid: InvalidChar[] = [];
  let invalidCount = 0, ambiguous = 0;
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (!allowed.includes(c)) { invalidCount++; if (invalid.length < 10) invalid.push({ position: i + 1, char: c }); }
    else if (ambig.includes(c)) ambiguous++;
  }
  const messages: string[] = [];
  if (seq.length === 0) messages.push('La secuencia está vacía.');
  if (invalidCount > 0) {
    const hint = kind === 'adn' && seq.includes('U') ? ' ¿Es ARN? El ADN usa T, no U.'
      : kind === 'arn' && seq.includes('T') ? ' ¿Es ADN? El ARN usa U, no T.' : '';
    messages.push(`${invalidCount} carácter(es) no válido(s) para ${KIND_LABEL[kind]}: ${invalid.map((x) => `«${x.char}» en ${x.position}`).join(', ')}${invalidCount > invalid.length ? '…' : ''}.${hint}`);
  }
  if (ambiguous > 0) {
    messages.push(kind === 'proteina'
      ? `${ambiguous} código(s) ambiguo(s) (B, Z, J o X): no se sabe con certeza qué aminoácido hay en esas posiciones.`
      : `${ambiguous} código(s) ambiguo(s) IUPAC (por ejemplo N = cualquier base): se excluyen del %GC y producen X al traducir si el codón no queda determinado.`);
  }
  if (kind === 'proteina') {
    const stop = seq.indexOf('*');
    if (stop >= 0 && stop < seq.length - 1) messages.push('Hay un «*» (terminación) dentro de la proteína.');
  }
  return { ok: seq.length > 0 && invalidCount === 0, invalid, invalidCount, ambiguous, messages };
}

/**
 * Detecta el tipo de una secuencia: nucleótido si todas las letras son IUPAC de nucleótidos y al menos la mitad son
 * A, C, G, T o U (si no, por ejemplo «NNNNA» sería ambiguo); ARN si tiene U y no T. En los demás casos, proteína.
 * Es una heurística: el estudiante puede corregir el tipo a mano.
 */
export function detectKind(seq: string): SeqKind {
  if (seq.length === 0) return 'adn';
  let nuc = 0, definite = 0, t = 0, u = 0;
  for (const c of seq) {
    if (c in IUPAC_NUC) nuc++;
    if ('ACGTU'.includes(c)) definite++;
    if (c === 'T') t++;
    if (c === 'U') u++;
  }
  if (nuc === seq.length && definite >= seq.length / 2 && !(t > 0 && u > 0)) return u > 0 ? 'arn' : 'adn';
  return 'proteina';
}

/* ------------------------------------------------------------------ lectura de FASTA y GenBank */

export interface CdsFeature {
  /** Inicio y fin 1-based sobre la secuencia del registro (inclusive). */
  start: number;
  end: number;
  strand: 1 | -1;
  /** Extremos incompletos (< o >) en la anotación. */
  partial: boolean;
  gene?: string;
  product?: string;
  proteinId?: string;
  table?: number;
  translation?: string;
}

export interface SeqRecord {
  id: string;
  description: string;
  sequence: string;
  kind: SeqKind;
  format: 'fasta' | 'genbank' | 'texto';
  accession?: string;
  version?: string;
  organism?: string;
  molType?: string;
  cds: CdsFeature[];
  /** Avisos de lectura (anotaciones que no se interpretan, etc.). */
  notes: string[];
}

export interface ParseResult { records: SeqRecord[]; errors: string[]; warnings: string[]; format: SeqRecord['format'] | null }

/** Bytes UTF-8 de un texto. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Quita caracteres de control y recorta un encabezado (sanitización). */
export function sanitizeHeader(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, SEQ_LIMITS.maxHeader);
}

/**
 * Lee texto pegado o un archivo: GenBank (empieza con LOCUS), FASTA (empieza con «>», admite varios registros) o una
 * secuencia sin encabezado. Rechaza archivos de más de 1 MiB, texto antes del primer «>», registros vacíos y
 * caracteres no válidos (con su posición).
 */
export function parseSequenceText(input: string, forcedKind?: SeqKind): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const size = byteLength(input);
  if (size > SEQ_LIMITS.maxBytes) {
    return { records: [], errors: [`El texto o archivo pesa ${size} bytes y el máximo es ${SEQ_LIMITS.maxBytes} bytes (1 MiB).`], warnings, format: null };
  }
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const trimmed = text.trim();
  if (trimmed.length === 0) return { records: [], errors: ['No hay ninguna secuencia.'], warnings, format: null };
  let records: SeqRecord[];
  let format: SeqRecord['format'];
  if (/^LOCUS\s/.test(trimmed)) { format = 'genbank'; records = parseGenBank(trimmed, errors, warnings); }
  else if (trimmed.startsWith('>') || /\n>/.test(trimmed)) { format = 'fasta'; records = parseFasta(trimmed, errors); }
  else {
    format = 'texto';
    const seq = cleanSequence(trimmed);
    records = [{ id: 'secuencia', description: 'Secuencia escrita o pegada', sequence: seq, kind: detectKind(seq), format, cds: [], notes: [] }];
  }
  if (records.length > SEQ_LIMITS.maxRecords) {
    errors.push(`El archivo tiene ${records.length} registros; el máximo es ${SEQ_LIMITS.maxRecords}.`);
    records = records.slice(0, SEQ_LIMITS.maxRecords);
  }
  const valid: SeqRecord[] = [];
  for (const r of records) {
    if (forcedKind) r.kind = forcedKind;
    if (r.sequence.length === 0) { errors.push(`El registro «${r.id}» no tiene secuencia.`); continue; }
    const v = validateSequence(r.sequence, r.kind);
    if (!v.ok) { errors.push(`Registro «${r.id}»: ${v.messages[0]}`); continue; }
    if (v.ambiguous > 0) warnings.push(`Registro «${r.id}»: ${v.messages[v.messages.length - 1]}`);
    valid.push(r);
  }
  return { records: errors.length > 0 ? [] : valid, errors, warnings, format };
}

function parseFasta(text: string, errors: string[]): SeqRecord[] {
  const lines = text.split('\n');
  const records: SeqRecord[] = [];
  let current: { header: string; parts: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const header = sanitizeHeader(current.header);
    const [id = '', ...rest] = header.split(' ');
    const seq = cleanSequence(current.parts.join(''));
    if (!id) errors.push(`El encabezado ${records.length + 1} está vacío: después de «>» debe ir un identificador.`);
    records.push({ id: id || `registro-${records.length + 1}`, description: rest.join(' '), sequence: seq, kind: detectKind(seq), format: 'fasta', cds: [], notes: [] });
  };
  for (const line of lines) {
    if (line.startsWith('>')) { flush(); current = { header: line.slice(1), parts: [] }; }
    else if (line.startsWith(';')) continue; // comentario del FASTA antiguo
    else if (!current) {
      if (line.trim()) { errors.push('Hay texto antes del primer encabezado «>»: un FASTA debe empezar con «>identificador».'); return []; }
    } else current.parts.push(line);
  }
  flush();
  return records;
}

/** Interpreta una ubicación simple de GenBank: 51..494, <1..>207, complement(10..90). join() y order() no se interpretan. */
export function parseLocation(loc: string): { start: number; end: number; strand: 1 | -1; partial: boolean } | null {
  const s = loc.replace(/\s/g, '');
  const comp = /^complement\((.*)\)$/.exec(s);
  const inner = comp ? comp[1] : s;
  const m = /^(<?)(\d+)\.\.(>?)(\d+)$/.exec(inner);
  if (!m) return null;
  const start = Number(m[2]), end = Number(m[4]);
  if (start < 1 || end < start) return null;
  return { start, end, strand: comp ? -1 : 1, partial: m[1] === '<' || m[3] === '>' };
}

function parseGenBank(text: string, errors: string[], warnings: string[]): SeqRecord[] {
  const chunks = text.split(/^\/\/\s*$/m).map((c) => c.trim()).filter(Boolean);
  const records: SeqRecord[] = [];
  chunks.forEach((chunk, idx) => {
    const lines = chunk.split('\n');
    const locus = lines.find((l) => l.startsWith('LOCUS'));
    if (!locus) { errors.push(`El registro GenBank ${idx + 1} no tiene línea LOCUS.`); return; }
    const originIdx = lines.findIndex((l) => l.startsWith('ORIGIN'));
    if (originIdx < 0) { errors.push(`El registro GenBank ${idx + 1} no tiene sección ORIGIN con la secuencia.`); return; }
    const field = (key: string): string | undefined => {
      const i = lines.findIndex((l) => l.startsWith(key + ' ') || l === key);
      if (i < 0) return undefined;
      const parts = [lines[i].slice(12).trim()];
      for (let k = i + 1; k < lines.length && /^ {12}\S/.test(lines[k]); k++) parts.push(lines[k].trim());
      return parts.join(' ');
    };
    const locusParts = locus.slice(5).trim().split(/\s+/);
    const molMatch = /\b(bp|aa)\s+(\S+)/.exec(locus);
    const isAa = /\saa\s/.test(locus + ' ');
    const accession = field('ACCESSION')?.split(/\s+/)[0];
    const version = field('VERSION')?.split(/\s+/)[0];
    const organism = lines.find((l) => l.startsWith('  ORGANISM'))?.slice(12).trim();
    const seqLines = lines.slice(originIdx + 1).filter((l) => !l.startsWith('//'));
    const bad = seqLines.find((l) => l.trim() && !/^\s*\d+(\s+[A-Za-z*-]+)+\s*$/.test(l));
    if (bad) { errors.push(`Registro GenBank ${idx + 1}: la sección ORIGIN tiene una línea mal formada («${sanitizeHeader(bad).slice(0, 40)}»).`); return; }
    const sequence = cleanSequence(seqLines.join(''));
    const notes: string[] = [];
    const cds = parseCdsFeatures(lines, sequence.length, notes);
    const id = version ?? accession ?? locusParts[0] ?? `registro-${idx + 1}`;
    const kind: SeqKind = isAa ? 'proteina' : detectKind(sequence);
    records.push({
      id: sanitizeHeader(id), description: sanitizeHeader(field('DEFINITION') ?? ''), sequence, kind, format: 'genbank',
      accession: accession && sanitizeHeader(accession), version: version && sanitizeHeader(version), organism: organism && sanitizeHeader(organism),
      molType: molMatch ? sanitizeHeader(molMatch[2]) : undefined, cds, notes,
    });
    notes.forEach((n) => warnings.push(`Registro «${sanitizeHeader(id)}»: ${n}`));
  });
  return records;
}

function parseCdsFeatures(lines: string[], seqLength: number, notes: string[]): CdsFeature[] {
  const fi = lines.findIndex((l) => l.startsWith('FEATURES'));
  if (fi < 0) return [];
  const out: CdsFeature[] = [];
  let cur: { loc: string; quals: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const q: Record<string, string> = {};
    for (const raw of cur.quals) {
      const m = /^\/(\w+)=?(.*)$/.exec(raw);
      if (m) q[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    const loc = parseLocation(cur.loc);
    if (!loc) notes.push(`CDS con ubicación «${sanitizeHeader(cur.loc).slice(0, 60)}» no se interpreta (join, order o formato no simple).`);
    else if (loc.end > seqLength) notes.push(`CDS ${loc.start}..${loc.end} sale de la secuencia (${seqLength}).`);
    else {
      out.push({
        ...loc, gene: q.gene && sanitizeHeader(q.gene), product: q.product && sanitizeHeader(q.product), proteinId: q.protein_id && sanitizeHeader(q.protein_id),
        table: q.transl_table ? Number(q.transl_table) : undefined, translation: q.translation ? q.translation.replace(/\s/g, '') : undefined,
      });
    }
    cur = null;
  };
  let inCds = false;
  for (let k = fi + 1; k < lines.length; k++) {
    const l = lines[k];
    if (/^\S/.test(l)) break; // ORIGIN u otra sección
    const key = /^ {5}(\S+)\s+(.*)$/.exec(l);
    if (key) {
      flush();
      inCds = key[1] === 'CDS';
      if (inCds) cur = { loc: key[2].trim(), quals: [] };
      continue;
    }
    if (!inCds || !cur) continue;
    const body = l.trim();
    if (body.startsWith('/')) cur.quals.push(body);
    else if (cur.quals.length === 0) cur.loc += body; // ubicación en varias líneas
    else cur.quals[cur.quals.length - 1] += (cur.quals[cur.quals.length - 1].includes('/translation') ? '' : ' ') + body;
  }
  flush();
  return out;
}

/** Escribe registros en FASTA con 60 caracteres por línea. */
export function toFasta(records: { id: string; description?: string; sequence: string }[]): string {
  return records.map((r) => {
    const head = `>${sanitizeHeader(r.id)}${r.description ? ' ' + sanitizeHeader(r.description) : ''}`;
    const body = r.sequence.match(/.{1,60}/g)?.join('\n') ?? '';
    return `${head}\n${body}`;
  }).join('\n') + '\n';
}

/* ------------------------------------------------------------------ composición */

export interface Composition {
  length: number;
  counts: Record<string, number>;
  /** %GC (solo nucleótidos): (G + C + S) / (A + C + G + T + U + S + W) × 100, como gc_fraction de Biopython (modo «remove»). */
  gcPercent: number | null;
  ambiguous: number;
}

export function composition(seq: string, kind: SeqKind): Composition {
  const counts: Record<string, number> = {};
  for (const c of seq) counts[c] = (counts[c] ?? 0) + 1;
  let gcPercent: number | null = null, ambiguous = 0;
  if (kind !== 'proteina') {
    const gc = (counts.G ?? 0) + (counts.C ?? 0) + (counts.S ?? 0);
    const den = gc + (counts.A ?? 0) + (counts.T ?? 0) + (counts.U ?? 0) + (counts.W ?? 0);
    gcPercent = den === 0 ? null : (gc / den) * 100;
    for (const c of AMBIGUOUS_NUC) ambiguous += counts[c] ?? 0;
  } else {
    for (const c of 'BZJX') ambiguous += counts[c] ?? 0;
  }
  return { length: seq.length, counts, gcPercent, ambiguous };
}

/** %GC en ventanas deslizantes (para el perfil del visor). */
export function gcWindows(seq: string, window: number, step: number): { start: number; gc: number | null }[] {
  assertInRange('La ventana', window, 1, 10000);
  assertInRange('El paso', step, 1, 10000);
  const out: { start: number; gc: number | null }[] = [];
  if (seq.length === 0) return out;
  const w = Math.min(window, seq.length);
  for (let i = 0; i + w <= seq.length; i += step) out.push({ start: i + 1, gc: composition(seq.slice(i, i + w), 'adn').gcPercent });
  return out;
}

/* ------------------------------------------------------------------ complemento y transcripción */

/** Complemento IUPAC base a base (sin invertir). En ARN, el complemento de A es U. */
export function complementSeq(seq: string, kind: SeqKind = 'adn'): string {
  if (kind === 'proteina') throw new Error('Una proteína no tiene hebra complementaria.');
  let out = '';
  for (const c of seq) {
    const k = COMPLEMENT[c];
    if (!k) throw new Error(`«${c}» no es un código IUPAC de nucleótido.`);
    out += kind === 'arn' && k === 'T' ? 'U' : k;
  }
  return out;
}

/** Reverso complementario: la otra hebra leída de 5′ a 3′. */
export function reverseComplementSeq(seq: string, kind: SeqKind = 'adn'): string {
  return [...complementSeq(seq, kind)].reverse().join('');
}

/** Transcripción de la hebra codificante (5′→3′): ARNm = misma secuencia con U en lugar de T. */
export function transcribeCoding(dna: string): string {
  return dna.replace(/T/g, 'U');
}

/** Retrotranscripción (ARN → ADN codificante). */
export function backTranscribe(rna: string): string {
  return rna.replace(/U/g, 'T');
}

/* ------------------------------------------------------------------ códigos genéticos del NCBI */

export type TableId = 1 | 2 | 11;

export interface GeneticCode { id: TableId; name: string; ncbieaa: string; sncbieaa: string }

/**
 * Tablas copiadas literalmente de las definiciones del NCBI (archivo gc.prt, versión 4.6, consultado el 2026-10-18,
 * https://ftp.ncbi.nlm.nih.gov/entrez/misc/data/gc.prt). Orden de los codones: base 1, 2 y 3 en el orden T, C, A, G.
 * ncbieaa: aminoácido de cada codón (* = terminación); sncbieaa: M marca los codones de inicio.
 */
export const GENETIC_CODES: Record<TableId, GeneticCode> = {
  1: {
    id: 1, name: 'Tabla 1: código estándar',
    ncbieaa: 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa: '---M------**--*----M---------------M----------------------------',
  },
  2: {
    id: 2, name: 'Tabla 2: mitocondrial de vertebrados',
    ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSS**VVVVAAAADDEEGGGG',
    sncbieaa: '----------**--------------------MMMM----------**---M------------',
  },
  11: {
    id: 11, name: 'Tabla 11: bacterias, arqueas y plastos',
    ncbieaa: 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa: '---M------**--*----M------------MMMM---------------M------------',
  },
};
export const TABLE_IDS: TableId[] = [1, 2, 11];

const BASE_INDEX: Record<string, number> = { T: 0, C: 1, A: 2, G: 3 };
const codonIdx = (c: string) => BASE_INDEX[c[0]] * 16 + BASE_INDEX[c[1]] * 4 + BASE_INDEX[c[2]];

/** Diccionario codón → aminoácido (codones de ADN) de una tabla. */
export function codonTable(table: TableId): Record<string, string> {
  const code = GENETIC_CODES[table];
  const out: Record<string, string> = {};
  const b = 'TCAG';
  for (let i = 0; i < 64; i++) out[b[i >> 4] + b[(i >> 2) & 3] + b[i & 3]] = code.ncbieaa[i];
  return out;
}

/** Codones de inicio de una tabla (ADN). */
export function startCodons(table: TableId): string[] {
  const t = codonTable(table);
  return Object.keys(t).filter((c) => GENETIC_CODES[table].sncbieaa[codonIdx(c)] === 'M');
}

function expand(c: string): string {
  return IUPAC_NUC[c === 'U' ? 'T' : c] ?? '';
}

/**
 * Traduce un codón (ADN o ARN, con códigos IUPAC). Si el codón es ambiguo, se prueban todas sus expansiones: si todas
 * dan el mismo resultado (p. ej. CTN → L o TAR → *), ese es el resultado; si no, X. Es la misma regla de Biopython.
 */
export function translateCodon(codon: string, table: TableId): string {
  if (codon.length !== 3) throw new Error('Un codón tiene tres nucleótidos.');
  const code = GENETIC_CODES[table].ncbieaa;
  const [e1, e2, e3] = [...codon].map(expand);
  if (!e1 || !e2 || !e3) return 'X';
  let aa = '';
  for (const a of e1) for (const b of e2) for (const c of e3) {
    const r = code[BASE_INDEX[a] * 16 + BASE_INDEX[b] * 4 + BASE_INDEX[c]];
    if (aa === '') aa = r; else if (aa !== r) return 'X';
  }
  return aa;
}

/** ¿Es un codón de inicio en la tabla? (solo codones sin ambigüedad). */
export function isStartCodon(codon: string, table: TableId): boolean {
  const c = codon.replace(/U/g, 'T');
  if (!/^[ACGT]{3}$/.test(c)) return false;
  return GENETIC_CODES[table].sncbieaa[codonIdx(c)] === 'M';
}

/** ¿Es con certeza un codón de terminación en la tabla? */
export function isStopCodon(codon: string, table: TableId): boolean {
  return translateCodon(codon, table) === '*';
}

/**
 * Traducción completa del marco 1 (como Seq.translate de Biopython): cada codón da un aminoácido, las terminaciones
 * se escriben «*» y los nucleótidos sobrantes al final (1 o 2) se ignoran.
 */
export function translateSeq(seq: string, table: TableId = 1): string {
  let out = '';
  for (let i = 0; i + 3 <= seq.length; i += 3) out += translateCodon(seq.slice(i, i + 3), table);
  return out;
}

export interface CdsTranslation { protein: string; problems: string[] }

/**
 * Traduce una región codificante completa (como translate(cds=True) de Biopython): el primer codón, si es de inicio en
 * la tabla, se traduce como M aunque sea GTG o TTG; se quita la terminación final. Los problemas se informan en vez de
 * lanzar un error, para que el estudiante los vea.
 */
export function translateCds(seq: string, table: TableId = 1): CdsTranslation {
  const problems: string[] = [];
  if (seq.length % 3 !== 0) problems.push(`La longitud (${seq.length}) no es múltiplo de 3.`);
  const first = seq.slice(0, 3);
  if (!isStartCodon(first, table)) problems.push(`El primer codón (${first}) no es de inicio en la ${GENETIC_CODES[table].name.toLowerCase()}.`);
  let protein = translateSeq(seq, table);
  if (protein.endsWith('*')) protein = protein.slice(0, -1);
  else problems.push('No termina en un codón de terminación.');
  if (protein.includes('*')) problems.push(`Hay ${[...protein].filter((c) => c === '*').length} codón(es) de terminación internos: ¿es la tabla correcta?`);
  if (isStartCodon(first, table)) protein = 'M' + protein.slice(1);
  return { protein, problems };
}

/* ------------------------------------------------------------------ marcos de lectura abiertos */

export type Frame = 1 | 2 | 3 | -1 | -2 | -3;
export const FRAMES: Frame[] = [1, 2, 3, -1, -2, -3];
export const frameLabel = (f: Frame) => (f > 0 ? `+${f}` : `−${-f}`);

export interface Orf {
  frame: Frame;
  /** Coordenadas 1-based sobre la hebra escrita (+), inclusive; en marcos negativos, start > end no ocurre: start ≤ end siempre. */
  start: number;
  end: number;
  lengthNt: number;
  lengthAa: number;
  protein: string;
  startCodon: string;
  hasStop: boolean;
}

export interface OrfOptions {
  table: TableId;
  /** Longitud mínima de la proteína (aminoácidos, sin la terminación). */
  minAa: number;
  /** 'atg': solo ATG inicia; 'tabla': todos los codones de inicio de la tabla (p. ej. GTG y TTG en la tabla 11). */
  starts: 'atg' | 'tabla';
  /** Incluir ORF que llegan al final de la secuencia sin terminación. */
  includePartial: boolean;
}

/**
 * Busca ORF en los seis marcos: desde el primer codón de inicio hasta la primera terminación en el mismo marco (el ORF
 * más largo para cada terminación; los inicios internos no abren ORF anidados). El primer codón se traduce M.
 */
export function findOrfs(dna: string, opts: OrfOptions): Orf[] {
  assertInRange('La longitud mínima del ORF', opts.minAa, SEQ_LIMITS.minOrfAa[0], SEQ_LIMITS.minOrfAa[1]);
  const seq = backTranscribe(dna);
  const n = seq.length;
  const rc = reverseComplementSeq(seq, 'adn');
  const out: Orf[] = [];
  for (const frame of FRAMES) {
    const s = frame > 0 ? seq : rc;
    const off = Math.abs(frame) - 1;
    let open = -1;
    const close = (endExcl: number, hasStop: boolean) => {
      const nt = s.slice(open, endExcl);
      const prot = 'M' + translateSeq(nt, opts.table).slice(1).replace(/\*$/, '');
      if (prot.length >= opts.minAa) {
        const a = open + 1, b = endExcl; // 1-based sobre s
        out.push({
          frame, start: frame > 0 ? a : n - b + 1, end: frame > 0 ? b : n - a + 1, lengthNt: nt.length, lengthAa: prot.length,
          protein: prot, startCodon: nt.slice(0, 3), hasStop,
        });
      }
      open = -1;
    };
    let i = off;
    for (; i + 3 <= n; i += 3) {
      const codon = s.slice(i, i + 3);
      if (open < 0) {
        if (opts.starts === 'atg' ? codon === 'ATG' : isStartCodon(codon, opts.table)) open = i;
      } else if (isStopCodon(codon, opts.table)) close(i + 3, true);
    }
    if (open >= 0) {
      if (opts.includePartial) close(i, false); else open = -1;
    }
  }
  return out.sort((x, y) => y.lengthAa - x.lengthAa || x.start - y.start || x.frame - y.frame);
}

/** Secuencia de un marco (para el visor): marcos negativos sobre el reverso complementario. */
export function frameCodons(dna: string, frame: Frame): { codons: string[]; offset: number } {
  const seq = backTranscribe(dna);
  const s = frame > 0 ? seq : reverseComplementSeq(seq, 'adn');
  const off = Math.abs(frame) - 1;
  const codons: string[] = [];
  for (let i = off; i + 3 <= s.length; i += 3) codons.push(s.slice(i, i + 3));
  return { codons, offset: off };
}

/* ------------------------------------------------------------------ matrices de sustitución */

/**
 * BLOSUM62 copiada literalmente del archivo del NCBI (https://ftp.ncbi.nlm.nih.gov/blast/matrices/BLOSUM62,
 * consultado el 2026-10-18; «Matrix made by matblas from blosum62.iij», unidades de 1/2 bit). Henikoff y Henikoff (1992).
 */
export const BLOSUM62_ALPHABET = 'ARNDCQEGHILKMFPSTWYVBZX*';
const BLOSUM62_ROWS = [
  ' 4 -1 -2 -2  0 -1 -1  0 -2 -1 -1 -1 -1 -2 -1  1  0 -3 -2  0 -2 -1  0 -4',
  '-1  5  0 -2 -3  1  0 -2  0 -3 -2  2 -1 -3 -2 -1 -1 -3 -2 -3 -1  0 -1 -4',
  '-2  0  6  1 -3  0  0  0  1 -3 -3  0 -2 -3 -2  1  0 -4 -2 -3  3  0 -1 -4',
  '-2 -2  1  6 -3  0  2 -1 -1 -3 -4 -1 -3 -3 -1  0 -1 -4 -3 -3  4  1 -1 -4',
  ' 0 -3 -3 -3  9 -3 -4 -3 -3 -1 -1 -3 -1 -2 -3 -1 -1 -2 -2 -1 -3 -3 -2 -4',
  '-1  1  0  0 -3  5  2 -2  0 -3 -2  1  0 -3 -1  0 -1 -2 -1 -2  0  3 -1 -4',
  '-1  0  0  2 -4  2  5 -2  0 -3 -3  1 -2 -3 -1  0 -1 -3 -2 -2  1  4 -1 -4',
  ' 0 -2  0 -1 -3 -2 -2  6 -2 -4 -4 -2 -3 -3 -2  0 -2 -2 -3 -3 -1 -2 -1 -4',
  '-2  0  1 -1 -3  0  0 -2  8 -3 -3 -1 -2 -1 -2 -1 -2 -2  2 -3  0  0 -1 -4',
  '-1 -3 -3 -3 -1 -3 -3 -4 -3  4  2 -3  1  0 -3 -2 -1 -3 -1  3 -3 -3 -1 -4',
  '-1 -2 -3 -4 -1 -2 -3 -4 -3  2  4 -2  2  0 -3 -2 -1 -2 -1  1 -4 -3 -1 -4',
  '-1  2  0 -1 -3  1  1 -2 -1 -3 -2  5 -1 -3 -1  0 -1 -3 -2 -2  0  1 -1 -4',
  '-1 -1 -2 -3 -1  0 -2 -3 -2  1  2 -1  5  0 -2 -1 -1 -1 -1  1 -3 -1 -1 -4',
  '-2 -3 -3 -3 -2 -3 -3 -3 -1  0  0 -3  0  6 -4 -2 -2  1  3 -1 -3 -3 -1 -4',
  '-1 -2 -2 -1 -3 -1 -1 -2 -2 -3 -3 -1 -2 -4  7 -1 -1 -4 -3 -2 -2 -1 -2 -4',
  ' 1 -1  1  0 -1  0  0  0 -1 -2 -2  0 -1 -2 -1  4  1 -3 -2 -2  0  0  0 -4',
  ' 0 -1  0 -1 -1 -1 -1 -2 -2 -1 -1 -1 -1 -2 -1  1  5 -2 -2  0 -1 -1  0 -4',
  '-3 -3 -4 -4 -2 -2 -3 -2 -2 -3 -2 -3 -1  1 -4 -3 -2 11  2 -3 -4 -3 -2 -4',
  '-2 -2 -2 -3 -2 -1 -2 -3  2 -1 -1 -2 -1  3 -3 -2 -2  2  7 -1 -3 -2 -1 -4',
  ' 0 -3 -3 -3 -1 -2 -2 -3 -3  3  1 -2  1 -1 -2 -2  0 -3 -1  4 -3 -2 -1 -4',
  '-2 -1  3  4 -3  0  1 -1  0 -3 -4  0 -3 -3 -2  0 -1 -4 -3 -3  4  1 -1 -4',
  '-1  0  0  1 -3  3  4 -2  0 -3 -3  1 -1 -3 -1  0 -1 -3 -2 -2  1  4 -1 -4',
  ' 0 -1 -1 -1 -2 -1 -1 -1 -1 -1 -1 -1 -1 -1 -2  0  0 -2 -1 -1 -1 -1 -1 -4',
  '-4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4  1',
];
export const BLOSUM62: number[][] = BLOSUM62_ROWS.map((r) => r.trim().split(/\s+/).map(Number));
const B62_INDEX: Record<string, number> = Object.fromEntries([...BLOSUM62_ALPHABET].map((c, i) => [c, i]));

/** Puntaje BLOSUM62 de dos residuos. J, U y O no están en la matriz: se puntúan como X. */
export function blosum62(a: string, b: string): number {
  const i = B62_INDEX[a] ?? B62_INDEX.X, j = B62_INDEX[b] ?? B62_INDEX.X;
  return BLOSUM62[i][j];
}

/* ------------------------------------------------------------------ alineamiento por parejas */

export type AlignMode = 'global' | 'local';
export interface Scoring {
  mode: AlignMode;
  matrix: 'simple' | 'blosum62';
  /** Puntaje de coincidencia y de no coincidencia (solo matriz simple). */
  match: number;
  mismatch: number;
  /** Penalizaciones positivas: un hueco de longitud L cuesta apertura + (L − 1) × extensión (convención de Biopython y EMBOSS). */
  gapOpen: number;
  gapExtend: number;
}

export interface Alignment {
  score: number;
  alignedA: string;
  alignedB: string;
  /** Marcas por columna: «|» idénticos, «:» parecidos (puntaje BLOSUM62 > 0), «.» distintos, « » hueco. */
  marks: string;
  /** Región alineada (1-based, inclusive) en cada secuencia; en el modo global cubre todo. */
  startA: number; endA: number; startB: number; endB: number;
  length: number;
  identities: number;
  similarities: number;
  mismatches: number;
  /** Columnas con hueco. */
  gaps: number;
  /** Huecos distintos (aperturas). */
  gapOpenings: number;
  identityPercent: number;
  similarityPercent: number;
}

/** Valida los parámetros de puntaje (lanza RangeError si alguno está fuera de rango). */
export function validateScoring(s: Scoring): void {
  assertInRange('La penalización por abrir un hueco', s.gapOpen, SEQ_LIMITS.gap[0], SEQ_LIMITS.gap[1]);
  assertInRange('La penalización por extender un hueco', s.gapExtend, SEQ_LIMITS.gap[0], s.gapOpen);
  if (s.matrix === 'simple') {
    assertInRange('El puntaje de coincidencia', s.match, SEQ_LIMITS.match[0], SEQ_LIMITS.match[1]);
    assertInRange('El puntaje de no coincidencia', s.mismatch, SEQ_LIMITS.mismatch[0], SEQ_LIMITS.mismatch[1]);
  }
}

const NEG = -Infinity;

/**
 * Alineamiento de dos secuencias con penalización afín de huecos (Gotoh, 1982): global (Needleman y Wunsch, 1970) o
 * local (Smith y Waterman, 1981). Matrices M (columna de pareja), X (letra de A frente a hueco) e Y (hueco frente a
 * letra de B). Los puntajes se calculan por filas (memoria lineal) y las flechas se guardan en 1 byte por celda.
 * Empates en la reconstrucción: diagonal antes que hueco en B y que hueco en A (determinista).
 */
export function align(a: string, b: string, s: Scoring): Alignment {
  validateScoring(s);
  const n = a.length, m = b.length;
  if (n === 0 || m === 0) throw new RangeError('Las dos secuencias deben tener al menos un residuo.');
  if (n > SEQ_LIMITS.maxAlignLength || m > SEQ_LIMITS.maxAlignLength) throw new RangeError(`Cada secuencia puede tener hasta ${SEQ_LIMITS.maxAlignLength} residuos para alinear en el navegador.`);
  if (n * m > SEQ_LIMITS.maxAlignCells) throw new RangeError(`El alineamiento necesitaría ${n * m} celdas; el máximo es ${SEQ_LIMITS.maxAlignCells}.`);
  const sub = s.matrix === 'blosum62' ? blosum62 : (x: string, y: string) => (x === y ? s.match : s.mismatch);
  const go = s.gapOpen, ge = s.gapExtend, local = s.mode === 'local';
  const W = m + 1;
  // flechas: bits 0-1 de M (0 M, 1 X, 2 Y, 3 inicio local), bits 2-3 de X, bits 4-5 de Y (0 M, 1 X, 2 Y)
  const tb = new Uint8Array((n + 1) * W);
  let pM = new Float64Array(W), pX = new Float64Array(W), pY = new Float64Array(W);
  let cM = new Float64Array(W), cX = new Float64Array(W), cY = new Float64Array(W);
  pM[0] = local ? NEG : 0; pX[0] = NEG; pY[0] = NEG;
  for (let j = 1; j <= m; j++) {
    pM[j] = NEG; pX[j] = NEG;
    pY[j] = local ? NEG : -go - (j - 1) * ge;
    tb[j] = (j === 1 ? 0 : 2) << 4;
  }
  let best = local ? 0 : NEG, bi = 0, bj = 0;
  for (let i = 1; i <= n; i++) {
    cM[0] = NEG; cY[0] = NEG;
    cX[0] = local ? NEG : -go - (i - 1) * ge;
    tb[i * W] = (i === 1 ? 0 : 1) << 2;
    const ai = a[i - 1];
    for (let j = 1; j <= m; j++) {
      // M
      let v = pM[j - 1], f = 0;
      if (pX[j - 1] > v) { v = pX[j - 1]; f = 1; }
      if (pY[j - 1] > v) { v = pY[j - 1]; f = 2; }
      if (local && v <= 0) { v = 0; f = 3; }
      const mv = v + sub(ai, b[j - 1]);
      // X: a_i frente a hueco (viene de la fila anterior, misma columna)
      let xv = pM[j] - go, fx = 0;
      if (pX[j] - ge > xv) { xv = pX[j] - ge; fx = 1; }
      if (pY[j] - go > xv) { xv = pY[j] - go; fx = 2; }
      // Y: hueco frente a b_j (misma fila, columna anterior)
      let yv = cM[j - 1] - go, fy = 0;
      if (cY[j - 1] - ge > yv) { yv = cY[j - 1] - ge; fy = 2; }
      if (cX[j - 1] - go > yv) { yv = cX[j - 1] - go; fy = 1; }
      cM[j] = mv; cX[j] = xv; cY[j] = yv;
      tb[i * W + j] = f | (fx << 2) | (fy << 4);
      if (local && mv > best) { best = mv; bi = i; bj = j; }
    }
    [pM, cM] = [cM, pM]; [pX, cX] = [cX, pX]; [pY, cY] = [cY, pY];
  }
  let state: number;
  let i: number, j: number;
  if (local) {
    i = bi; j = bj; state = 0;
  } else {
    i = n; j = m;
    best = pM[m]; state = 0;
    if (pX[m] > best) { best = pX[m]; state = 1; }
    if (pY[m] > best) { best = pY[m]; state = 2; }
  }
  const ra: string[] = [], rb: string[] = [];
  const endA = i, endB = j;
  if (!(local && best <= 0)) {
    while (i > 0 || j > 0) {
      const t = tb[i * W + j];
      if (state === 0) {
        if (i === 0 || j === 0) break;
        ra.push(a[i - 1]); rb.push(b[j - 1]);
        const prev = t & 3;
        i--; j--;
        if (prev === 3) break;
        state = prev;
      } else if (state === 1) {
        ra.push(a[i - 1]); rb.push('-');
        state = (t >> 2) & 3; i--;
      } else {
        ra.push('-'); rb.push(b[j - 1]);
        state = (t >> 4) & 3; j--;
      }
    }
  } else { best = 0; }
  const alignedA = ra.reverse().join(''), alignedB = rb.reverse().join('');
  return summarize(alignedA, alignedB, best, s, local ? i + 1 : 1, local ? endA : n, local ? j + 1 : 1, local ? endB : m);
}

function summarize(alignedA: string, alignedB: string, score: number, s: Scoring, startA: number, endA: number, startB: number, endB: number): Alignment {
  let identities = 0, similarities = 0, mismatches = 0, gaps = 0, gapOpenings = 0, marks = '';
  for (let k = 0; k < alignedA.length; k++) {
    const x = alignedA[k], y = alignedB[k];
    if (x === '-' || y === '-') {
      gaps++; marks += ' ';
      const prevGapSame = k > 0 && ((x === '-' && alignedA[k - 1] === '-') || (y === '-' && alignedB[k - 1] === '-'));
      if (!prevGapSame) gapOpenings++;
    } else if (x === y) { identities++; similarities++; marks += '|'; }
    else if (s.matrix === 'blosum62' && blosum62(x, y) > 0) { similarities++; mismatches++; marks += ':'; }
    else { mismatches++; marks += '.'; }
  }
  const length = alignedA.length;
  return {
    score, alignedA, alignedB, marks, startA, endA, startB, endB, length, identities, similarities, mismatches, gaps, gapOpenings,
    identityPercent: length === 0 ? 0 : (identities / length) * 100,
    similarityPercent: length === 0 ? 0 : (similarities / length) * 100,
  };
}

/** Recalcula el puntaje de un alineamiento dado (comprobación independiente de la programación dinámica). */
export function scoreAlignment(alignedA: string, alignedB: string, s: Scoring): number {
  const sub = s.matrix === 'blosum62' ? blosum62 : (x: string, y: string) => (x === y ? s.match : s.mismatch);
  let score = 0;
  for (let k = 0; k < alignedA.length; k++) {
    const x = alignedA[k], y = alignedB[k];
    if (x === '-') score -= k > 0 && alignedA[k - 1] === '-' ? s.gapExtend : s.gapOpen;
    else if (y === '-') score -= k > 0 && alignedB[k - 1] === '-' ? s.gapExtend : s.gapOpen;
    else score += sub(x, y);
  }
  return score;
}

/** Resolución con que se muestran y registran los porcentajes (0,1 %). */
export const PERCENT_RESOLUTION = 0.1;
export const roundPercent = (v: number) => roundToResolution(v, PERCENT_RESOLUTION);

/** Texto del alineamiento en bloques de 60 columnas (exportación TXT). */
export function alignmentText(al: Alignment, nameA: string, nameB: string, s: Scoring): string {
  const pad = Math.max(nameA.length, nameB.length, 6);
  const lines = [
    `# Alineamiento ${s.mode === 'global' ? 'global (Needleman–Wunsch)' : 'local (Smith–Waterman)'} con huecos afines (Gotoh)`,
    `# Matriz: ${s.matrix === 'blosum62' ? 'BLOSUM62' : `coincidencia ${s.match}, no coincidencia ${s.mismatch}`}; hueco: apertura ${s.gapOpen}, extensión ${s.gapExtend}`,
    `# Puntaje: ${al.score}; longitud: ${al.length}; identidad: ${al.identities}/${al.length} (${roundPercent(al.identityPercent)} %); huecos: ${al.gaps}/${al.length}`,
    '# Estatus: Modelo calculado (algoritmo determinista); la identidad alta no implica función idéntica.',
    '',
  ];
  let pa = al.startA - 1, pb = al.startB - 1;
  for (let k = 0; k < al.length; k += 60) {
    const sa = al.alignedA.slice(k, k + 60), sb = al.alignedB.slice(k, k + 60);
    const na = [...sa].filter((c) => c !== '-').length, nb = [...sb].filter((c) => c !== '-').length;
    lines.push(`${nameA.padEnd(pad)} ${String(pa + 1).padStart(5)} ${sa} ${pa + na}`);
    lines.push(`${''.padEnd(pad)}       ${al.marks.slice(k, k + 60)}`);
    lines.push(`${nameB.padEnd(pad)} ${String(pb + 1).padStart(5)} ${sb} ${pb + nb}`);
    lines.push('');
    pa += na; pb += nb;
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ catálogo de ejemplos reales (sección 14.3) */

export interface SequenceExample {
  id: string;
  label: string;
  kind: SeqKind;
  organism: string;
  /** Identificador con versión tal como lo devuelve la base de datos. */
  accession: string;
  database: 'NCBI Nucleotide (RefSeq)' | 'UniProtKB/Swiss-Prot';
  /** Página del registro y URL exacta de descarga usada. */
  recordUrl: string;
  sourceUrl: string;
  retrieved: string;
  status: EpistemicStatus;
  evidence: string;
  /** Tabla de traducción adecuada para este organismo/compartimento. */
  table: TableId;
  /** CDS anotada en el registro (1-based, inclusive), si la secuencia es de nucleótidos. */
  cds?: { start: number; end: number; proteinId: string; translation: string };
  note: string;
  sequence: string;
}

const RETRIEVED = '2026-10-18';
const EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&rettype=fasta&retmode=text';

/**
 * Ejemplos educativos curados: genes humanos de proteínas sanguíneas y metabólicas, un gen mitocondrial humano y un
 * gen regulador de Escherichia coli K-12 (cepa de laboratorio no patógena). Ninguno es un factor de virulencia ni una
 * toxina. Cada secuencia se descargó el 2026-10-18 y se verificó volviéndola a descargar (scripts/validacion).
 */
export const SEQUENCE_EXAMPLES: SequenceExample[] = [
  {
    id: 'hbb-arnm', label: 'β-globina humana (HBB), ARNm', kind: 'adn', organism: 'Homo sapiens',
    accession: 'NM_000518.5', database: 'NCBI Nucleotide (RefSeq)',
    recordUrl: 'https://www.ncbi.nlm.nih.gov/nuccore/NM_000518.5', sourceUrl: `${EFETCH}&id=NM_000518.5`, retrieved: RETRIEVED,
    status: 'experimental',
    evidence: 'RefSeq NM_ con estado REVIEWED (curada por el personal del NCBI), derivada de los ADNc secuenciados AK311825.1 y BU661647.1. Un registro XM_ sería un modelo predicho y se rotularía «Predicción computacional».',
    table: 1,
    cds: { start: 51, end: 494, proteinId: 'NP_000509.1', translation: 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH' },
    note: 'ARNm maduro escrito como ADNc (T en lugar de U). La región codificante (CDS) va de la base 51 a la 494.',
    sequence: 'ACATTTGCTTCTGACACAACTGTGTTCACTAGCAACCTCAAACAGACACCATGGTGCATCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAGGCTGCTGGTGGTCTACCCTTGGACCCAGAGGTTCTTTGAGTCCTTTGGGGATCTGTCCACTCCTGATGCTGTTATGGGCAACCCTAAGGTGAAGGCTCATGGCAAGAAAGTGCTCGGTGCCTTTAGTGATGGCCTGGCTCACCTGGACAACCTCAAGGGCACCTTTGCCACACTGAGTGAGCTGCACTGTGACAAGCTGCACGTGGATCCTGAGAACTTCAGGCTCCTGGGCAACGTGCTGGTCTGTGTGCTGGCCCATCACTTTGGCAAAGAATTCACCCCACCAGTGCAGGCTGCCTATCAGAAAGTGGTGGCTGGTGTGGCTAATGCCCTGGCCCACAAGTATCACTAAGCTCGCTTTCTTGCTGTCCAATTTCTATTAAAGGTTCCTTTGTTCCCTAAGTCCAACTACTAAACTGGGGGATATTATGAAGGGCCTTGAGCATCTGGATTCTGCCTAATAAAAAACATTTATTTTCATTGCAA',
  },
  {
    id: 'hbd-arnm', label: 'δ-globina humana (HBD), ARNm', kind: 'adn', organism: 'Homo sapiens',
    accession: 'NM_000519.4', database: 'NCBI Nucleotide (RefSeq)',
    recordUrl: 'https://www.ncbi.nlm.nih.gov/nuccore/NM_000519.4', sourceUrl: `${EFETCH}&id=NM_000519.4`, retrieved: RETRIEVED,
    status: 'experimental',
    evidence: 'RefSeq NM_ con estado REVIEWED, derivada de los ADNc secuenciados AY034468.1, BC070282.1 y BU664913.1.',
    table: 1,
    cds: { start: 51, end: 494, proteinId: 'NP_000510.1', translation: 'MVHLTPEEKTAVNALWGKVNVDAVGGEALGRLLVVYPWTQRFFESFGDLSSPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFSQLSELHCDKLHVDPENFRLLGNVLVCVLARNFGKEFTPQMQAAYQKVVAGVANALAHKYH' },
    note: 'Gen vecino de HBB en el cromosoma 11: forma la hemoglobina A₂, minoritaria en el adulto. CDS de la base 51 a la 494.',
    sequence: 'ACACTTTCTTCTGACATAACAGTGTTCACTAGCAACCTCAAACAGACACCATGGTGCATCTGACTCCTGAGGAGAAGACTGCTGTCAATGCCCTGTGGGGCAAAGTGAACGTGGATGCAGTTGGTGGTGAGGCCCTGGGCAGATTACTGGTGGTCTACCCTTGGACCCAGAGGTTCTTTGAGTCCTTTGGGGATCTGTCCTCTCCTGATGCTGTTATGGGCAACCCTAAGGTGAAGGCTCATGGCAAGAAGGTGCTAGGTGCCTTTAGTGATGGCCTGGCTCACCTGGACAACCTCAAGGGCACTTTTTCTCAGCTGAGTGAGCTGCACTGTGACAAGCTGCACGTGGATCCTGAGAACTTCAGGCTCTTGGGCAATGTGCTGGTGTGTGTGCTGGCCCGCAACTTTGGCAAGGAATTCACCCCACAAATGCAGGCTGCCTATCAGAAGGTGGTGGCTGGTGTGGCTAATGCCCTGGCTCACAAGTACCATTGAGATCCTGGACTGTTTCCTGATAACCATAAGAAGACCCTATTTCCCTAGATTCTATTTTCTGAACTTGGGAACACAATGCCTACTTCAAGGGTATGGCTTCTGCCTAATAAAGAATGTTCAGCTCAA',
  },
  {
    id: 'atp8', label: 'Gen mitocondrial humano MT-ATP8', kind: 'adn', organism: 'Homo sapiens (mitocondria)',
    accession: 'NC_012920.1 (bases 8366–8572)', database: 'NCBI Nucleotide (RefSeq)',
    recordUrl: 'https://www.ncbi.nlm.nih.gov/nuccore/NC_012920.1', sourceUrl: `${EFETCH}&id=NC_012920.1&seq_start=8366&seq_stop=8572`, retrieved: RETRIEVED,
    status: 'experimental',
    evidence: 'Secuencia de referencia de Cambridge revisada (rCRS). RefSeq con estado PROVISIONAL (anotación aún sin revisión final), derivada de la secuenciación J01415 y corregida por la resecuenciación del material original (Andrews et al., 1999).',
    table: 2,
    cds: { start: 1, end: 207, proteinId: 'YP_003024030.1', translation: 'MPQLNTTVWPTMITPMLLTLFLITQLKMLNTNYHLPPSPKPMKMKNYNKPWEPKWTKICSLHSLPPQS' },
    note: 'Las mitocondrias usan la tabla 2: TGA es triptófano (W) y ATA es metionina. Con la tabla 1 aparecen terminaciones falsas dentro del gen.',
    sequence: 'ATGCCCCAACTAAATACTACCGTATGGCCCACCATAATTACCCCCATACTCCTTACACTATTCCTCATCACCCAACTAAAAATATTAAACACAAACTACCACCTACCTCCCTCACCAAAGCCCATAAAAATAAAAAATTATAACAAACCCTGAGAACCAAAATGAACGAAAATCTGTTCGCTTCATTCATTGCCCCCACAATCCTAG',
  },
  {
    id: 'laci', label: 'Represor LacI de Escherichia coli K-12 (lacI)', kind: 'adn', organism: 'Escherichia coli str. K-12 substr. MG1655',
    accession: 'NC_000913.3 (complemento de 366428–367510)', database: 'NCBI Nucleotide (RefSeq)',
    recordUrl: 'https://www.ncbi.nlm.nih.gov/nuccore/NC_000913.3', sourceUrl: `${EFETCH}&id=NC_000913.3&seq_start=366428&seq_stop=367510&strand=2`, retrieved: RETRIEVED,
    status: 'experimental',
    evidence: 'RefSeq con estado REVIEWED, idéntica al genoma secuenciado U00096 de la cepa de laboratorio K-12 MG1655 (no patógena).',
    table: 11,
    cds: { start: 1, end: 1083, proteinId: 'NP_414879.3', translation: 'MKPVTLYDVAEYAGVSYQTVSRVVNQASHVSAKTREKVEAAMAELNYIPNRVAQQLAGKQSLLIGVATSSLALHAPSQIVAAIKSRADQLGASVVVSMVERSGVEACKAAVHNLLAQRVSGLIINYPLDDQDAIAVEAACTNVPALFLDVSDQTPINSIIFSHEDGTRLGVEHLVALGHQQIALLAGPLSSVSARLRLAGWHKYLTRNQIQPIAEREGDWSAMSGFQQTMQMLNEGIVPTAMLVANDQMALGAMRAITESGLRVGADISVVGYDDTEDSSCYIPPLTTIKQDFRLLGQTSVDRLLQLSQGQAVKGNQLLPVSLVKRKTTLAPNTQTASPRALADSLMQLARQVSRLESGQ' },
    note: 'El gen empieza con GTG, no con ATG: en la tabla 11 GTG también inicia y se traduce como metionina. Regula el operón lac (Jacob y Monod).',
    sequence: 'GTGAAACCAGTAACGTTATACGATGTCGCAGAGTATGCCGGTGTCTCTTATCAGACCGTTTCCCGCGTGGTGAACCAGGCCAGCCACGTTTCTGCGAAAACGCGGGAAAAAGTGGAAGCGGCGATGGCGGAGCTGAATTACATTCCCAACCGCGTGGCACAACAACTGGCGGGCAAACAGTCGTTGCTGATTGGCGTTGCCACCTCCAGTCTGGCCCTGCACGCGCCGTCGCAAATTGTCGCGGCGATTAAATCTCGCGCCGATCAACTGGGTGCCAGCGTGGTGGTGTCGATGGTAGAACGAAGCGGCGTCGAAGCCTGTAAAGCGGCGGTGCACAATCTTCTCGCGCAACGCGTCAGTGGGCTGATCATTAACTATCCGCTGGATGACCAGGATGCCATTGCTGTGGAAGCTGCCTGCACTAATGTTCCGGCGTTATTTCTTGATGTCTCTGACCAGACACCCATCAACAGTATTATTTTCTCCCATGAAGACGGTACGCGACTGGGCGTGGAGCATCTGGTCGCATTGGGTCACCAGCAAATCGCGCTGTTAGCGGGCCCATTAAGTTCTGTCTCGGCGCGTCTGCGTCTGGCTGGCTGGCATAAATATCTCACTCGCAATCAAATTCAGCCGATAGCGGAACGGGAAGGCGACTGGAGTGCCATGTCCGGTTTTCAACAAACCATGCAAATGCTGAATGAGGGCATCGTTCCCACTGCGATGCTGGTTGCCAACGATCAGATGGCGCTGGGCGCAATGCGCGCCATTACCGAGTCCGGGCTGCGCGTTGGTGCGGATATCTCGGTAGTGGGATACGACGATACCGAAGACAGCTCATGTTATATCCCGCCGTTAACCACCATCAAACAGGATTTTCGCCTGCTGGGGCAAACCAGCGTGGACCGCTTGCTGCAACTCTCTCAGGGCCAGGCGGTGAAGGGCAATCAGCTGTTGCCCGTCTCACTGGTGAAAAGAAAAACCACCCTGGCGCCCAATACGCAAACCGCCTCTCCCCGCGCGTTGGCCGATTCATTAATGCAGCTGGCACGACAGGTTTCCCGACTGGAAAGCGGGCAGTGA',
  },
  {
    id: 'ins-humana', label: 'Preproinsulina humana (INS)', kind: 'proteina', organism: 'Homo sapiens',
    accession: 'P01308 (versión de secuencia 1)', database: 'UniProtKB/Swiss-Prot',
    recordUrl: 'https://www.uniprot.org/uniprotkb/P01308/entry', sourceUrl: 'https://rest.uniprot.org/uniprotkb/P01308.fasta', retrieved: RETRIEVED,
    status: 'experimental',
    evidence: 'Entrada revisada de Swiss-Prot con «PE 1: Evidence at protein level» (existencia de la proteína comprobada experimentalmente). La secuencia completa se deduce en buena parte de genes y ADNc secuenciados.',
    table: 1,
    note: '110 aminoácidos: péptido señal, cadena B, péptido C y cadena A. La hormona madura es solo la cadena B unida a la A.',
    sequence: 'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN',
  },
  {
    id: 'ins-bovina', label: 'Preproinsulina bovina (INS)', kind: 'proteina', organism: 'Bos taurus',
    accession: 'P01317 (versión de secuencia 2)', database: 'UniProtKB/Swiss-Prot',
    recordUrl: 'https://www.uniprot.org/uniprotkb/P01317/entry', sourceUrl: 'https://rest.uniprot.org/uniprotkb/P01317.fasta', retrieved: RETRIEVED,
    status: 'experimental',
    evidence: 'Entrada revisada de Swiss-Prot con «PE 1: Evidence at protein level». La insulina bovina fue la primera proteína secuenciada (Sanger, década de 1950).',
    table: 1,
    note: '105 aminoácidos. Se usó durante décadas para tratar la diabetes en personas, antes de la insulina humana recombinante.',
    sequence: 'MALWTRLRPLLALLALWPPPPARAFVNQHLCGSHLVEALYLVCGERGFFYTPKARREVEGPQVGALELAGGPGAGGLEGPPQKRGIVEQCCASVCSLYQLENYCN',
  },
  {
    id: 'hbb-prot', label: 'β-globina humana (HBB), proteína', kind: 'proteina', organism: 'Homo sapiens',
    accession: 'P68871 (versión de secuencia 2)', database: 'UniProtKB/Swiss-Prot',
    recordUrl: 'https://www.uniprot.org/uniprotkb/P68871/entry', sourceUrl: 'https://rest.uniprot.org/uniprotkb/P68871.fasta', retrieved: RETRIEVED,
    status: 'experimental',
    evidence: 'Entrada revisada de Swiss-Prot con «PE 1: Evidence at protein level».',
    table: 1,
    note: '147 aminoácidos (con la metionina inicial, que se retira en la proteína madura).',
    sequence: 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH',
  },
  {
    id: 'hba-prot', label: 'α-globina humana (HBA1), proteína', kind: 'proteina', organism: 'Homo sapiens',
    accession: 'P69905 (versión de secuencia 2)', database: 'UniProtKB/Swiss-Prot',
    recordUrl: 'https://www.uniprot.org/uniprotkb/P69905/entry', sourceUrl: 'https://rest.uniprot.org/uniprotkb/P69905.fasta', retrieved: RETRIEVED,
    status: 'experimental',
    evidence: 'Entrada revisada de Swiss-Prot con «PE 1: Evidence at protein level».',
    table: 1,
    note: '142 aminoácidos. Se une a la β-globina para formar la hemoglobina A (α₂β₂).',
    sequence: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR',
  },
];

export function findExample(id: string): SequenceExample | undefined {
  return SEQUENCE_EXAMPLES.find((e) => e.id === id);
}

/** CDS de un ejemplo de nucleótidos (subcadena anotada en el registro). */
export function exampleCds(id: string): string {
  const e = findExample(id);
  if (!e?.cds) throw new Error(`El ejemplo ${id} no tiene CDS anotada.`);
  return e.sequence.slice(e.cds.start - 1, e.cds.end);
}

/** Parejas de comparación preparadas (todas con secuencias reales del catálogo). */
export interface ComparisonPreset { id: string; label: string; a: string; b: string; nameA: string; nameB: string; scoring: Scoring; note: string }

export const DNA_DEFAULT_SCORING: Scoring = { mode: 'global', matrix: 'simple', match: 1, mismatch: -1, gapOpen: 2, gapExtend: 1 };
export const PROTEIN_DEFAULT_SCORING: Scoring = { mode: 'global', matrix: 'blosum62', match: 1, mismatch: -1, gapOpen: 11, gapExtend: 1 };

export function comparisonPresets(): ComparisonPreset[] {
  const p = (id: string) => findExample(id)!.sequence;
  return [
    { id: 'ins', label: 'Insulina humana frente a bovina (proteína)', a: p('ins-humana'), b: p('ins-bovina'), nameA: 'P01308', nameB: 'P01317', scoring: PROTEIN_DEFAULT_SCORING, note: 'Misma función en dos mamíferos: la hormona madura difiere en solo 3 aminoácidos; el péptido C cambia más.' },
    { id: 'globinas', label: 'β-globina frente a α-globina humanas (proteína)', a: p('hbb-prot'), b: p('hba-prot'), nameA: 'P68871', nameB: 'P69905', scoring: PROTEIN_DEFAULT_SCORING, note: 'Dos genes del mismo organismo que se originaron por duplicación: identidad baja, plegamiento y función parecidos.' },
    { id: 'hbb-hbd', label: 'CDS de HBB frente a CDS de HBD (ADN)', a: exampleCds('hbb-arnm'), b: exampleCds('hbd-arnm'), nameA: 'NM_000518.5', nameB: 'NM_000519.4', scoring: DNA_DEFAULT_SCORING, note: 'Genes vecinos muy parecidos que se expresan en cantidades muy distintas: identidad alta no significa función idéntica.' },
  ];
}

/**
 * Estatus de una secuencia cargada por el estudiante según su identificador (ADR 0002). Los prefijos RefSeq XM_, XR_ y
 * XP_ son modelos predichos por la anotación computacional del NCBI; NM_, NR_ y NP_ son registros curados, pero el
 * laboratorio no puede comprobar que el texto pegado sea el registro original, así que todo lo que no viene del
 * catálogo verificado queda «Sin información disponible».
 */
export function sourceStatus(id: string | undefined): { status: EpistemicStatus; detail: string } {
  const acc = (id ?? '').trim();
  if (/^X[MRP]_\d/.test(acc)) {
    return { status: 'prediccion', detail: `${acc} es un registro RefSeq predicho (prefijo X): un modelo de la anotación computacional del NCBI, no una secuencia curada.` };
  }
  return { status: 'sin-informacion', detail: 'Secuencia escrita o cargada por ti: el laboratorio no puede verificar su origen. Anota de dónde la obtuviste (base de datos, número de acceso y fecha).' };
}

/* ------------------------------------------------------------------ ficha del modelo */

export const sequencesModelSpec: ModelSpec = {
  name: 'Análisis de secuencias: composición, traducción, marcos de lectura y alineamiento por parejas',
  inputs: [
    { symbol: 'secuencia', name: 'ADN, ARN o proteína (texto, FASTA o GenBank; hasta 1 MiB y 50 registros)', unit: 'residuos', initial: 'NM_000518.5 (ARNm de HBB)' },
    { symbol: 'tabla', name: 'Código genético del NCBI (1 estándar, 2 mitocondrial de vertebrados, 11 bacteriano)', unit: '—', initial: 1 },
    { symbol: 'L_min', name: 'Longitud mínima del ORF', unit: 'aminoácidos', range: SEQ_LIMITS.minOrfAa, initial: 30 },
    { symbol: 'g_a', name: 'Penalización por abrir un hueco', unit: 'puntos', range: SEQ_LIMITS.gap, initial: 11 },
    { symbol: 'g_e', name: 'Penalización por extender un hueco (≤ g_a)', unit: 'puntos', range: SEQ_LIMITS.gap, initial: 1 },
    { symbol: 's(a,b)', name: 'Matriz de sustitución: coincidencia/no coincidencia (ADN) o BLOSUM62 (proteína)', unit: 'puntos', initial: 'BLOSUM62' },
  ],
  outputs: [
    { symbol: 'n', name: 'Longitud y composición por residuo', unit: 'residuos' },
    { symbol: '%GC', name: 'Contenido de guanina + citosina', unit: '%' },
    { symbol: 'RC', name: 'Complemento y reverso complementario', unit: 'nt' },
    { symbol: 'proteína', name: 'Traducción con la tabla elegida y ORF en los seis marcos', unit: 'aminoácidos' },
    { symbol: 'S', name: 'Puntaje del alineamiento óptimo', unit: 'puntos' },
    { symbol: 'identidad', name: 'Columnas idénticas / longitud del alineamiento × 100', unit: '%' },
    { symbol: 'huecos', name: 'Columnas con hueco y número de aperturas', unit: 'columnas' },
  ],
  equations: [
    '%GC = (G + C + S) / (A + C + G + T/U + S + W) × 100 (los demás códigos ambiguos se excluyen).',
    'Complemento IUPAC: A↔T(U), C↔G, R↔Y, K↔M, B↔V, D↔H; S, W y N no cambian. Reverso complementario = complemento leído al revés (5′→3′).',
    'Traducción: cada codón se busca en la tabla del NCBI; un codón ambiguo da un aminoácido solo si todas sus expansiones coinciden; si no, X.',
    'ORF: desde un codón de inicio hasta la primera terminación en el mismo marco, en los marcos +1, +2, +3 y −1, −2, −3 (reverso complementario).',
    'Hueco de longitud L: costo = g_a + (L − 1)·g_e.',
    'M(i,j) = s(aᵢ,bⱼ) + máx[M, X, Y](i−1, j−1); X(i,j) = máx[M − g_a, X − g_e, Y − g_a](i−1, j); Y(i,j) = máx[M − g_a, Y − g_e, X − g_a](i, j−1).',
    'Local (Smith–Waterman): además, M puede empezar en 0 y el alineamiento termina en el máximo de M.',
  ],
  initialConditions: ['ARNm de la β-globina humana (NM_000518.5), tabla 1, ORF mínimo de 30 aminoácidos; comparación de la insulina humana y la bovina con BLOSUM62, apertura 11 y extensión 1.'],
  assumptions: [
    'Las secuencias se escriben de 5′ a 3′ (nucleótidos) o del extremo N al C (proteínas).',
    'La hebra escrita es la codificante: el ARNm tiene la misma secuencia con U en lugar de T.',
    'El alineamiento por parejas busca el puntaje óptimo con la matriz y los huecos elegidos; si hay varios alineamientos óptimos, se muestra uno (desempate determinista).',
    'Los ORF no consideran intrones, empalme ni señales de inicio (Kozak, Shine–Dalgarno): son candidatos, no genes demostrados.',
  ],
  limits: [
    'No es BLAST: no busca en bases de datos ni calcula valores E; la búsqueda de secuencias parecidas se integrará aparte.',
    'La identidad y el puntaje dependen de la matriz y de las penalizaciones elegidas; no hay un único «porcentaje de parecido».',
    'Una identidad alta no implica función idéntica, ni una identidad baja implica función distinta: la función se comprueba con experimentos.',
    'Alineamiento en el navegador limitado a 3000 residuos por secuencia y 4 millones de celdas.',
    'No se interpretan ubicaciones GenBank con join() u order(), ni otros formatos (EMBL, GFF).',
  ],
  testCases: [
    'ATG → M; TAA, TAG y TGA → terminación en la tabla 1; TGA → W y AGA → terminación en la tabla 2; GTG inicia en la tabla 11.',
    'Las 64 entradas de la tabla 1 coinciden con el código de la práctica «Del ADN a la proteína» (dna.ts).',
    '%GC de composiciones conocidas (ACGT = 50 %, GGCC = 100 %, ACTGN = 50 % al excluir N) y de los ejemplos, igual a Biopython.',
    'Reverso complementario IUPAC igual a Biopython; FASTA múltiple y GenBank se leen; entradas mal formadas y de más de 1 MiB se rechazan.',
    'ORF en una secuencia construida: posiciones, marcos (incluido uno negativo) y longitudes calculadas a mano.',
    'Puntajes global y local (ADN con coincidencia/no coincidencia, proteína con BLOSUM62) iguales a PairwiseAligner de Biopython 1.85; BLOSUM62 simétrica con W/W = 11.',
  ],
};

/* ------------------------------------------------------------------ condiciones y correcciones */

/** Nivel y corrección de cada advertencia de `parseSequenceText` (no impiden analizar el registro). */
export function parseConditions(warnings: readonly string[]): ModelCondition[] {
  return classifyWarnings(warnings, [
    { match: /código\(s\) ambiguo\(s\)/, level: 'nota' },
    { match: /Hay un «\*» \(terminación\) dentro de la proteína/, level: 'advertencia', fix: 'Revisa el registro: en una proteína el «*» solo debería ir al final; si pegaste varias proteínas juntas, sepáralas en registros FASTA distintos.' },
    { match: /: CDS con ubicación/, level: 'nota' },
    { match: /: CDS .* sale de la secuencia/, level: 'advertencia', fix: 'Revisa que el registro GenBank esté completo: la secuencia (ORIGIN) debe incluir todas las posiciones de la CDS.' },
  ]);
}

export const ALIGN_MATRIX_LABEL = { simple: 'Simple: coincidencia / no coincidencia (ADN)', blosum62: 'BLOSUM62 (proteínas)' } as const;

/** Avisos sobre la matriz de sustitución elegida para el tipo de secuencia, con su corrección. */
export function alignConditions(kind: SeqKind, matrix: 'simple' | 'blosum62'): ModelCondition[] {
  if (kind === 'proteina' && matrix === 'simple') {
    return [{
      text: 'Para proteínas conviene BLOSUM62: la matriz simple trata igual un cambio entre aminoácidos parecidos que entre muy distintos.',
      level: 'advertencia', fix: `En «Matriz de sustitución», elige «${ALIGN_MATRIX_LABEL.blosum62}».`,
    }];
  }
  if (kind !== 'proteina' && matrix === 'blosum62') {
    return [{
      text: 'BLOSUM62 es una matriz de aminoácidos: para ADN usa la matriz simple de coincidencia y no coincidencia.',
      level: 'invalido', fix: `En «Matriz de sustitución», elige «${ALIGN_MATRIX_LABEL.simple}».`,
    }];
  }
  return [];
}

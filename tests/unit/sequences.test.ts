import { describe, expect, it } from 'vitest';
import ref from '../fixtures/biopython-secuencias.json';
import {
  BLOSUM62, BLOSUM62_ALPHABET, SEQ_LIMITS, SEQUENCE_EXAMPLES, align, blosum62, codonTable, composition, comparisonPresets,
  detectKind, exampleCds, findOrfs, parseLocation, parseSequenceText, reverseComplementSeq, scoreAlignment, startCodons,
  sourceStatus, toFasta, transcribeCoding, translateCds, translateCodon, translateSeq, validateSequence,
  type Scoring, type TableId,
} from '../../src/models/sequences';
import { GENETIC_CODE } from '../../src/models/dna';

type RefAlignment = (typeof ref.alignments)[number] & { alignedA?: string; alignedB?: string; identities?: number; gaps?: number; startA?: number; endA?: number; startB?: number; endB?: number };
const seqs = ref.sequences as Record<string, string>;
const examples = ref.examples as Record<string, { length: number; gcPercent?: number; reverseComplement?: string; translations?: Record<string, string>; cdsTranslation?: string; cdsTable?: number }>;

describe('código genético (tablas del NCBI)', () => {
  it('ATG → M y TAA, TAG, TGA → terminación en la tabla estándar', () => {
    expect(translateCodon('ATG', 1)).toBe('M');
    expect(translateCodon('AUG', 1)).toBe('M');
    for (const c of ['TAA', 'TAG', 'TGA']) expect(translateCodon(c, 1)).toBe('*');
    expect(translateSeq('ATGGCCTAA', 1)).toBe('MA*');
    expect(translateSeq('ATGGCCTA', 1)).toBe('MA'); // el codón incompleto final se ignora
  });
  it('tabla 2: TGA = W, ATA = M, AGA y AGG = terminación; tabla 11: GTG y TTG inician', () => {
    expect(translateCodon('TGA', 2)).toBe('W');
    expect(translateCodon('ATA', 2)).toBe('M');
    expect(translateCodon('AGA', 2)).toBe('*');
    expect(translateCodon('AGG', 2)).toBe('*');
    expect(startCodons(11).sort()).toEqual(['ATA', 'ATC', 'ATG', 'ATT', 'CTG', 'GTG', 'TTG']);
    expect(startCodons(1).sort()).toEqual(['ATG', 'CTG', 'TTG']);
  });
  it('las 64 entradas, inicios y terminaciones de las tablas 1, 2 y 11 coinciden con Biopython', () => {
    for (const t of [1, 2, 11] as TableId[]) {
      const r = (ref.geneticCodes as Record<string, { codons: Record<string, string>; starts: string[]; stops: string[] }>)[String(t)];
      expect(codonTable(t)).toEqual(r.codons);
      expect(startCodons(t).sort()).toEqual(r.starts);
    }
  });
  it('la tabla 1 coincide con el código de la práctica «Del ADN a la proteína» (dna.ts)', () => {
    const t1 = codonTable(1);
    for (const [rna, aa] of Object.entries(GENETIC_CODE)) expect(t1[rna.replace(/U/g, 'T')]).toBe(aa);
  });
  it('codones ambiguos IUPAC: misma regla que Biopython (CTN → L, TAN → X, TRA → * solo en la tabla 1)', () => {
    for (const [t, map] of Object.entries(ref.ambiguousCodons)) {
      for (const [codon, aa] of Object.entries(map)) expect(translateCodon(codon, Number(t) as TableId), `${codon} tabla ${t}`).toBe(aa);
    }
  });
});

describe('composición, complemento y traducción de los ejemplos frente a Biopython', () => {
  it('%GC de composiciones conocidas', () => {
    expect(composition('ACGT', 'adn').gcPercent).toBe(50);
    expect(composition('GGCC', 'adn').gcPercent).toBe(100);
    expect(composition('AATT', 'adn').gcPercent).toBe(0);
    expect(composition('ACTGN', 'adn').gcPercent).toBe(50); // N se excluye del denominador
    for (const [s, gc] of Object.entries(ref.gc)) expect(composition(s, s.includes('U') ? 'arn' : 'adn').gcPercent).toBeCloseTo(gc, 10);
  });
  it('reverso complementario IUPAC (ADN y ARN)', () => {
    expect(reverseComplementSeq('GATTACA')).toBe('TGTAATC');
    for (const [s, rc] of Object.entries(ref.reverseComplement)) expect(reverseComplementSeq(s, 'adn')).toBe(rc);
    for (const [s, rc] of Object.entries(ref.reverseComplementRna)) expect(reverseComplementSeq(s, 'arn')).toBe(rc);
    expect(() => reverseComplementSeq('MKV', 'proteina')).toThrow();
  });
  it('los ejemplos del laboratorio son exactamente las secuencias usadas por la referencia', () => {
    for (const e of SEQUENCE_EXAMPLES) {
      expect(seqs[e.id]).toBe(e.sequence);
      expect(examples[e.id].length).toBe(e.sequence.length);
      expect(validateSequence(e.sequence, e.kind).ok).toBe(true);
      expect(detectKind(e.sequence)).toBe(e.kind);
      expect(e.retrieved).toBe('2026-10-18');
    }
  });
  it('%GC, reverso complementario y traducciones (tablas 1, 2 y 11) de cada ejemplo de nucleótidos', () => {
    for (const e of SEQUENCE_EXAMPLES.filter((x) => x.kind !== 'proteina')) {
      const r = examples[e.id];
      expect(composition(e.sequence, 'adn').gcPercent).toBeCloseTo(r.gcPercent!, 10);
      expect(reverseComplementSeq(e.sequence)).toBe(r.reverseComplement);
      for (const t of [1, 2, 11] as TableId[]) expect(translateSeq(e.sequence, t), `${e.id} tabla ${t}`).toBe(r.translations![String(t)]);
    }
  });
  it('la CDS anotada se traduce igual que Biopython (cds=True) y que la anotación del registro', () => {
    for (const e of SEQUENCE_EXAMPLES.filter((x) => x.cds)) {
      const t = translateCds(exampleCds(e.id), e.table);
      expect(t.problems).toEqual([]);
      expect(t.protein).toBe(examples[e.id].cdsTranslation);
      expect(t.protein).toBe(e.cds!.translation);
    }
    // con la tabla equivocada aparecen terminaciones internas (MT-ATP8 con la tabla 1)
    expect(translateCds(exampleCds('atp8'), 1).problems.some((p) => p.includes('internos'))).toBe(true);
    // lacI empieza con GTG: con la tabla 11 es M; con «solo ATG» no sería un inicio de la tabla 2
    expect(translateCds(exampleCds('laci'), 11).protein[0]).toBe('M');
  });
  it('transcripción: el ARNm repite la hebra codificante con U', () => {
    expect(transcribeCoding('ATGGCCTGA')).toBe('AUGGCCUGA');
  });
  it('estatus de procedencia: catálogo verificado, RefSeq predicha (XM_) y secuencia propia', () => {
    expect(SEQUENCE_EXAMPLES.every((e) => e.status === 'experimental' && e.sourceUrl.startsWith('https://'))).toBe(true);
    expect(sourceStatus('XM_000001.1').status).toBe('prediccion');
    expect(sourceStatus('NM_000518.5').status).toBe('sin-informacion');
    expect(sourceStatus(undefined).status).toBe('sin-informacion');
  });
});

describe('lectura de FASTA y GenBank', () => {
  it('lee un FASTA de varios registros y detecta el tipo', () => {
    const r = parseSequenceText('>sec1 ADN de prueba\nATGC\nATGC\n\n>sec2 ARN\nAUGGCU\n>p1 péptido\nMKVLAAGIW\n');
    expect(r.errors).toEqual([]);
    expect(r.format).toBe('fasta');
    expect(r.records.map((x) => [x.id, x.kind, x.sequence])).toEqual([['sec1', 'adn', 'ATGCATGC'], ['sec2', 'arn', 'AUGGCU'], ['p1', 'proteina', 'MKVLAAGIW']]);
    expect(r.records[0].description).toBe('ADN de prueba');
  });
  it('rechaza entradas mal formadas: texto antes del «>», registro vacío, caracteres no válidos', () => {
    expect(parseSequenceText('hola\n>x\nATG').errors[0]).toMatch(/antes del primer encabezado/);
    expect(parseSequenceText('>x\n>y\nATG').errors[0]).toMatch(/no tiene secuencia/);
    const bad = parseSequenceText('>x\nATGQ', 'adn');
    expect(bad.records).toEqual([]);
    expect(bad.errors[0]).toMatch(/«Q» en 4/);
    expect(validateSequence('AUGT', 'adn').messages[0]).toMatch(/¿Es ARN\?/);
  });
  it('rechaza archivos de más de 1 MiB y sanea los encabezados', () => {
    const big = '>grande\n' + 'A'.repeat(SEQ_LIMITS.maxBytes);
    expect(parseSequenceText(big).errors[0]).toMatch(/máximo es 1048576 bytes/);
    const r = parseSequenceText('>id1 <script>alert(1)</script>\u0007\nACGT');
    expect(r.records[0].description).not.toMatch(/[<>\u0007]/);
  });
  it('lee un registro GenBank con su CDS (registro de prueba construido, formato real)', () => {
    const gb = [
      'LOCUS       PRUEBA01                  30 bp    DNA     linear   SYN 18-OCT-2026',
      'DEFINITION  Registro construido para la prueba del lector, no es un registro',
      '            real.',
      'ACCESSION   PRUEBA01',
      'VERSION     PRUEBA01.1',
      'SOURCE      sintetico',
      '  ORGANISM  sintetico',
      'FEATURES             Location/Qualifiers',
      '     source          1..30',
      '     CDS             4..27',
      '                     /gene="demo"',
      '                     /transl_table=11',
      '                     /translation="MAKFGWH"',
      'ORIGIN      ',
      '        1 ccc atggccaaat ttggctggca ttaaggg',
      '//',
    ].join('\n');
    const r = parseSequenceText(gb);
    expect(r.errors).toEqual([]);
    const rec = r.records[0];
    expect(rec.format).toBe('genbank');
    expect(rec.version).toBe('PRUEBA01.1');
    expect(rec.description).toBe('Registro construido para la prueba del lector, no es un registro real.');
    expect(rec.sequence).toBe('CCCATGGCCAAATTTGGCTGGCATTAAGGG');
    expect(rec.cds).toEqual([{ start: 4, end: 27, strand: 1, partial: false, gene: 'demo', product: undefined, proteinId: undefined, table: 11, translation: 'MAKFGWH' }]);
    expect(translateCds(rec.sequence.slice(3, 27), 11).protein).toBe('MAKFGWH');
    expect(parseLocation('complement(<10..>90)')).toEqual({ start: 10, end: 90, strand: -1, partial: true });
    expect(parseLocation('join(1..5,8..20)')).toBeNull();
    expect(parseSequenceText('LOCUS  X 4 bp DNA\nACCESSION X\n//').errors[0]).toMatch(/ORIGIN/);
  });
  it('exporta FASTA con 60 caracteres por línea y se puede volver a leer', () => {
    const fa = toFasta([{ id: 'NM_000518.5', description: 'HBB', sequence: SEQUENCE_EXAMPLES[0].sequence }]);
    expect(fa.split('\n')[1].length).toBe(60);
    expect(parseSequenceText(fa).records[0].sequence).toBe(SEQUENCE_EXAMPLES[0].sequence);
  });
});

describe('marcos de lectura abiertos (ORF) en seis marcos', () => {
  // Construida a mano: ORF en +1 (bases 1–15, MKLF + TAA), ORF en +3 (bases 18–29, MPW + TGA) y,
  // en la otra hebra, ORF en −2 (reverso complementario de CAT…: bases 31–48 del reverso).
  const seq = 'ATGAAACTGTTTTAAccATGCCCTGGTGAcc'.toUpperCase() + reverseComplementSeq('ATGGGGCCCAAATTTTAG');
  it('encuentra cada ORF con su marco, posición y longitud', () => {
    const orfs = findOrfs(seq, { table: 1, minAa: 3, starts: 'atg', includePartial: false });
    const simple = orfs.map((o) => ({ frame: o.frame, start: o.start, end: o.end, aa: o.lengthAa, p: o.protein }));
    expect(simple).toContainEqual({ frame: 1, start: 1, end: 15, aa: 4, p: 'MKLF' });
    expect(simple).toContainEqual({ frame: 3, start: 18, end: 29, aa: 3, p: 'MPW' });
    const minus = simple.find((o) => o.p === 'MGPKF');
    expect(minus).toBeDefined();
    expect(minus!.frame).toBeLessThan(0);
    expect([minus!.start, minus!.end]).toEqual([32, 49]);
    expect(seq.length).toBe(49);
  });
  it('respeta la longitud mínima, la tabla y los inicios alternativos', () => {
    expect(findOrfs(seq, { table: 1, minAa: 5, starts: 'atg', includePartial: false }).map((o) => o.protein)).toEqual(['MGPKF']);
    // en la tabla 2, TGA es triptófano: el ORF de +3 no termina en la base 29, sigue hasta el TAA de las bases 33–35
    const t2 = findOrfs(seq, { table: 2, minAa: 3, starts: 'atg', includePartial: false }).find((o) => o.frame === 3)!;
    expect([t2.start, t2.end, t2.protein, t2.hasStop]).toEqual([18, 35, 'MPWWP', true]);
    // lacI: con «solo ATG» el ORF más largo empieza tarde; con los inicios de la tabla 11 empieza en el GTG de la base 1
    const laci = SEQUENCE_EXAMPLES.find((e) => e.id === 'laci')!;
    const tabla = findOrfs(laci.sequence, { table: 11, minAa: 100, starts: 'tabla', includePartial: false })[0];
    expect([tabla.frame, tabla.start, tabla.end, tabla.lengthAa, tabla.startCodon]).toEqual([1, 1, 1083, 360, 'GTG']);
    const atg = findOrfs(laci.sequence, { table: 11, minAa: 100, starts: 'atg', includePartial: false }).find((o) => o.frame === 1)!;
    expect(atg.start).toBeGreaterThan(1);
    expect(() => findOrfs(seq, { table: 1, minAa: 0, starts: 'atg', includePartial: false })).toThrow(RangeError);
  });
  it('el ORF más largo del ARNm de HBB es la CDS anotada (51..494, 147 aminoácidos)', () => {
    const hbb = SEQUENCE_EXAMPLES[0];
    const o = findOrfs(hbb.sequence, { table: 1, minAa: 30, starts: 'atg', includePartial: false })[0];
    expect([o.frame, o.start, o.end, o.lengthAa]).toEqual([3, 51, 494, 147]);
    expect(o.protein).toBe(hbb.cds!.translation);
  });
});

describe('alineamiento global y local frente a Biopython (PairwiseAligner)', () => {
  const toScoring = (c: RefAlignment): Scoring => ({ mode: c.mode as Scoring['mode'], matrix: c.matrix as Scoring['matrix'], match: c.match || 1, mismatch: c.mismatch, gapOpen: c.gapOpen, gapExtend: c.gapExtend });
  it('BLOSUM62: simétrica, igual a la de Biopython y con valores conocidos', () => {
    expect(BLOSUM62_ALPHABET).toBe(ref.blosum62.alphabet);
    expect(BLOSUM62).toEqual(ref.blosum62.rows);
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) expect(BLOSUM62[i][j]).toBe(BLOSUM62[j][i]);
    expect(blosum62('W', 'W')).toBe(11);
    expect(blosum62('C', 'C')).toBe(9);
    expect(blosum62('A', 'A')).toBe(4);
    expect(blosum62('A', 'R')).toBe(-1);
    expect(blosum62('I', 'V')).toBe(3);
    expect(blosum62('W', 'P')).toBe(-4);
    expect(blosum62('*', '*')).toBe(1);
  });
  for (const c of ref.alignments as RefAlignment[]) {
    it(`${c.name}: puntaje ${c.score}`, () => {
      const s = toScoring(c);
      const al = align(seqs[c.a], seqs[c.b], s);
      expect(al.score).toBe(c.score);
      // el alineamiento reconstruido es coherente: su puntaje recalculado es el óptimo y contiene las secuencias
      expect(scoreAlignment(al.alignedA, al.alignedB, s)).toBe(c.score);
      expect(al.alignedA.replace(/-/g, '')).toBe(seqs[c.a].slice(al.startA - 1, al.endA));
      expect(al.alignedB.replace(/-/g, '')).toBe(seqs[c.b].slice(al.startB - 1, al.endB));
      if (c.alignedA !== undefined) {
        // alineamiento óptimo único: debe ser idéntico al de Biopython, con las mismas cuentas
        expect([al.alignedA, al.alignedB]).toEqual([c.alignedA, c.alignedB]);
        expect([al.identities, al.gaps, al.startA, al.endA, al.startB, al.endB]).toEqual([c.identities, c.gaps, c.startA, c.endA, c.startB, c.endB]);
      }
    });
  }
  it('identidad, huecos y validación de parámetros', () => {
    const al = align('ACGTACGT', 'ACGTACGT', { mode: 'global', matrix: 'simple', match: 1, mismatch: -1, gapOpen: 2, gapExtend: 1 });
    expect([al.score, al.identityPercent, al.gaps, al.marks]).toEqual([8, 100, 0, '||||||||']);
    expect(() => align('ACGT', 'ACGT', { mode: 'global', matrix: 'simple', match: 1, mismatch: -1, gapOpen: 1, gapExtend: 2 })).toThrow(RangeError);
    expect(() => align('', 'ACGT', { mode: 'local', matrix: 'simple', match: 1, mismatch: -1, gapOpen: 2, gapExtend: 1 })).toThrow(RangeError);
  });
  it('subir la penalización por abrir huecos no aumenta el número de huecos (β frente a α-globina)', () => {
    const g = comparisonPresets().find((p) => p.id === 'globinas')!;
    const openings = [2, 5, 11, 20].map((go) => align(g.a, g.b, { ...g.scoring, gapOpen: go }).gapOpenings);
    for (let k = 1; k < openings.length; k++) expect(openings[k]).toBeLessThanOrEqual(openings[k - 1]);
    expect(openings[0]).toBeGreaterThan(openings[openings.length - 1]);
  });
});

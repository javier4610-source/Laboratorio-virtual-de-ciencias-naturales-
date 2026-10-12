import { describe, expect, it } from 'vitest';
import {
  CDS_START, GENE_LENGTH, GENE_SEQ, HBB_SEGMENTS, LANDMARKS, POLYA_SIGNAL, PROMOTER_ELEMENTS, SEGMENT_RANGES, TATA, TSS,
  aaClass, analyzeGeneMutation, expressGene, gelMigration, locate, mutateSegments, polyAFactor, promoterEffect, proteinMassKDa, relativeToTss,
} from '../../src/models/geneExpression';
import { GENETIC_CODE } from '../../src/models/dna';

const BETA_GLOBIN = 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH';
const HBS = CDS_START + 19; // segunda base del codón 7 (GAG)

describe('gen silvestre HBB: transcripción, procesamiento y traducción', () => {
  it('estructura del fragmento y elementos del promotor', () => {
    expect(GENE_LENGTH).toBe(103 + 142 + 130 + 223 + 81 + 261);
    expect(SEGMENT_RANGES.in1.end - SEGMENT_RANGES.in1.start + 1).toBe(130);
    expect(GENE_SEQ.slice(TATA.start - 1, TATA.end)).toBe('CATAAAA');
    expect(relativeToTss(TATA.start)).toBe(-32);
    expect(relativeToTss(TSS)).toBe(1);
    expect(relativeToTss(TSS - 1)).toBe(-1);
    expect(GENE_SEQ.slice(CDS_START - 1, CDS_START + 2)).toBe('ATG');
    expect(GENE_SEQ.slice(POLYA_SIGNAL.start - 1, POLYA_SIGNAL.end)).toBe('AATAAA');
    for (const el of PROMOTER_ELEMENTS) expect(GENE_SEQ.slice(el.start - 1, el.end)).toBe(el.consensus);
    // todos los intrones siguen la regla GT…AG
    for (const s of HBB_SEGMENTS.filter((x) => x.kind === 'intron')) { expect(s.seq.startsWith('GT')).toBe(true); expect(s.seq.endsWith('AG')).toBe(true); }
  });

  it('el ARNm maduro (626 nt) traduce exactamente la β-globina humana', () => {
    const wt = expressGene(null);
    expect(wt.splicing.pattern).toBe('E1-E2-E3');
    expect(wt.preMrnaLength).toBe(142 + 130 + 223 + 81 + 261);
    expect(wt.mrnaLength).toBe(50 + 444 + 132);
    expect(wt.mrna).not.toMatch(/T/);
    expect(wt.translation.startIndex).toBe(50);
    expect(wt.protein).toBe(BETA_GLOBIN);
    expect(wt.proteinLength).toBe(147);
    expect(wt.translation.stopFound).toBe(true);
    expect(wt.translation.codons.at(-1)?.codon).toBe('UAA');
    expect(wt.expression).toBe(1);
  });

  it('empalme alternativo: saltar el exón 2 (223 nt, no múltiplo de 3) corre el marco', () => {
    const skip = expressGene(null, 'salto-exon2');
    expect(skip.splicing.pattern).toBe('E1-E3');
    expect(skip.mrnaLength).toBe(626 - 223);
    expect(223 % 3).toBe(1);
    expect(skip.protein.slice(0, 30)).toBe(BETA_GLOBIN.slice(0, 30));
    expect(skip.proteinLength).toBeLessThan(147);
    expect(locate(SEGMENT_RANGES.ex2.start + 25, 'salto-exon2').region).toBe('exon-omitido');
  });

  it('ubica bases: codón, región y sitios de empalme', () => {
    expect(locate(HBS)).toMatchObject({ region: 'cds', codon: 7, codonPos: 2 });
    expect(locate(SEGMENT_RANGES.ex2.start + 25)).toMatchObject({ region: 'cds', codon: 40, codonPos: 1 });
    expect(locate(SEGMENT_RANGES.in1.start).region).toBe('sitio-donador');
    expect(locate(SEGMENT_RANGES.in1.end).region).toBe('sitio-aceptor');
    expect(locate(SEGMENT_RANGES.in1.start + 50).region).toBe('intron');
    expect(locate(TSS + 3).region).toBe('utr5');
    expect(locate(POLYA_SIGNAL.start).region).toBe('utr3');
    expect(locate(10).region).toBe('promotor');
    expect(() => locate(0)).toThrow(RangeError);
    expect(() => locate(GENE_LENGTH + 1)).toThrow(RangeError);
    expect(LANDMARKS.find((l) => l.id === 'stop')!.position).toBe(SEGMENT_RANGES.ex3.start + 126);
    expect(GENE_SEQ.slice(SEGMENT_RANGES.ex3.start + 125, SEGMENT_RANGES.ex3.start + 128)).toBe('TAA');
  });
});

describe('clasificación de mutaciones puntuales', () => {
  it('anemia falciforme: GAG→GTG en el codón 7 es de sentido erróneo y cambia la propiedad (cargado → hidrofóbico)', () => {
    const a = analyzeGeneMutation({ kind: 'sustitucion', position: HBS, base: 'T' });
    expect(a.cls).toBe('sentido-erroneo');
    expect(a.codonChange).toMatchObject({ codon: 7, from: 'GAG', to: 'GUG', aaFrom: 'E', aaTo: 'V', classFrom: 'cargado (−)', classTo: 'hidrofóbico', propertyChanged: true });
    expect(a.mutant.proteinLength).toBe(147);
    expect(a.changedAa).toBe(1);
    expect(a.identity).toBe(99.3); // 146/147
    expect(a.expressionPercent).toBe(100);
  });

  it('silenciosa (GAG→GAA sigue siendo Glu) y conservadora (Glu→Asp, ambos cargados −)', () => {
    const s = analyzeGeneMutation({ kind: 'sustitucion', position: HBS + 1, base: 'A' });
    expect(s.cls).toBe('silenciosa');
    expect(s.identity).toBe(100);
    const c = analyzeGeneMutation({ kind: 'sustitucion', position: HBS + 1, base: 'C' }); // GAC = Asp
    expect(c.cls).toBe('sentido-erroneo');
    expect(c.codonChange?.propertyChanged).toBe(false);
  });

  it('sin sentido: CAG→TAG en el codón 40 trunca la proteína a 39 aminoácidos', () => {
    const p = SEGMENT_RANGES.ex2.start + 25;
    expect(GENE_SEQ.slice(p - 1, p + 2)).toBe('CAG');
    const a = analyzeGeneMutation({ kind: 'sustitucion', position: p, base: 'T' });
    expect(a.cls).toBe('sin-sentido');
    expect(a.mutant.proteinLength).toBe(39);
    expect(a.mutant.mrnaLength).toBe(626); // el ARNm no cambia de longitud
    expect(a.identity).toBe(26.5); // 39/147
    expect(gelMigration(39)!).toBeGreaterThan(gelMigration(147)!);
  });

  it('corrimiento del marco: la identidad crece cuanto más tarde ocurre la deleción', () => {
    const positions = [CDS_START + 6, CDS_START + 40, SEGMENT_RANGES.ex2.start + 100, SEGMENT_RANGES.ex3.start + 60];
    const res = positions.map((p) => analyzeGeneMutation({ kind: 'delecion', position: p }));
    for (const r of res) { expect(r.cls).toBe('corrimiento'); expect(r.mutant.mrnaLength).toBe(625); }
    for (let i = 1; i < res.length; i++) {
      expect(res[i].identity).toBeGreaterThan(res[i - 1].identity);
      expect(res[i].changedAa).toBeLessThan(res[i - 1].changedAa);
    }
    const ins = analyzeGeneMutation({ kind: 'insercion', position: CDS_START + 6, base: 'A' });
    expect(ins.cls).toBe('corrimiento');
    expect(ins.mutant.mrnaLength).toBe(627);
  });

  it('sitios de empalme: aceptor del intrón 1 o donador del intrón 2 → salto del exón 2; donador del intrón 1 → retención', () => {
    const acc = analyzeGeneMutation({ kind: 'sustitucion', position: SEGMENT_RANGES.in1.end, base: 'A' }); // AG → AA
    expect(acc.cls).toBe('empalme');
    expect(acc.mutant.splicing.pattern).toBe('E1-E3');
    expect(acc.mutant.mrnaLength).toBe(403);
    const don2 = analyzeGeneMutation({ kind: 'sustitucion', position: SEGMENT_RANGES.in2.start + 1, base: 'C' }); // GT → GC
    expect(don2.mutant.splicing.pattern).toBe('E1-E3');
    expect(don2.mutant.protein).toBe(acc.mutant.protein);
    const don1 = analyzeGeneMutation({ kind: 'sustitucion', position: SEGMENT_RANGES.in1.start, base: 'A' }); // IVS-I-1 G→A
    expect(don1.cls).toBe('empalme');
    expect(don1.mutant.splicing.pattern).toBe('E1-I1-E2-E3');
    expect(don1.mutant.mrnaLength).toBe(626 + 130);
    expect(don1.mutant.proteinLength).toBeLessThan(147);
    // una base del interior del intrón no cambia nada
    const inner = analyzeGeneMutation({ kind: 'sustitucion', position: SEGMENT_RANGES.in1.start + 60, base: GENE_SEQ[SEGMENT_RANGES.in1.start + 59] === 'C' ? 'G' : 'C' });
    expect(inner.cls).toBe('no-codificante');
    expect(inner.identity).toBe(100);
    // insertar justo antes del GT alarga el exón (corrimiento), no rompe el donador
    const edge = analyzeGeneMutation({ kind: 'insercion', position: SEGMENT_RANGES.in1.start, base: 'C' });
    expect(edge.mutant.splicing.pattern).toBe('E1-E2-E3');
    expect(edge.cls).toBe('corrimiento');
  });

  it('promotor y señal de poliadenilación: reducen la expresión sin cambiar la proteína', () => {
    const tata = analyzeGeneMutation({ kind: 'sustitucion', position: TATA.start + 3, base: 'G' }); // CATAAAA → CATGAAA
    expect(tata.cls).toBe('promotor');
    expect(tata.expressionPercent).toBe(20);
    expect(tata.identity).toBe(100);
    expect(tata.mutant.protein).toBe(BETA_GLOBIN);
    expect(promoterEffect({ kind: 'sustitucion', position: TATA.start + 4, base: 'T' }).factor).toBe(1); // CATATAA: variante TATAWAW
    expect(promoterEffect({ kind: 'sustitucion', position: 5, base: 'A' }).factor).toBe(1); // fuera de las cajas
    expect(promoterEffect({ kind: 'delecion', position: PROMOTER_ELEMENTS[0].start + 4 }).factor).toBe(0.3);
    expect(promoterEffect({ kind: 'delecion', position: TATA.end + 5 }).factor).toBe(0.6);
    const pa = analyzeGeneMutation({ kind: 'sustitucion', position: POLYA_SIGNAL.start + 2, base: 'C' }); // AACAAA
    expect(pa.cls).toBe('poliA');
    expect(pa.expressionPercent).toBe(10);
    expect(polyAFactor({ kind: 'sustitucion', position: POLYA_SIGNAL.start + 1, base: 'T' })).toBe(0.7); // ATTAAA
    expect(polyAFactor(null)).toBe(1);
  });

  it('codón de inicio y de terminación', () => {
    const start = analyzeGeneMutation({ kind: 'sustitucion', position: CDS_START + 2, base: 'A' }); // ATG → ATA
    expect(start.cls).toBe('inicio');
    expect(start.mutant.translation.startIndex).not.toBe(50);
    const stop = analyzeGeneMutation({ kind: 'sustitucion', position: SEGMENT_RANGES.ex3.start + 126, base: 'C' }); // TAA → CAA
    expect(stop.cls).toBe('terminacion');
    expect(stop.mutant.proteinLength).toBeGreaterThan(147);
    const utr3 = analyzeGeneMutation({ kind: 'delecion', position: SEGMENT_RANGES.ex3.start + 140 });
    expect(utr3.cls).toBe('no-codificante');
  });

  it('valida las entradas y no modifica el gen silvestre', () => {
    const before = GENE_SEQ;
    mutateSegments({ kind: 'delecion', position: 300 });
    expect(HBB_SEGMENTS.map((s) => s.seq).join('')).toBe(before);
    expect(() => analyzeGeneMutation({ kind: 'sustitucion', position: HBS, base: 'A' })).toThrow(/igual a la original/);
    expect(() => analyzeGeneMutation({ kind: 'insercion', position: HBS })).toThrow(/base nueva/);
    expect(() => analyzeGeneMutation({ kind: 'delecion', position: 0 })).toThrow(RangeError);
    expect(() => analyzeGeneMutation({ kind: 'delecion', position: 2.5 })).toThrow(RangeError);
    expect(() => expressGene(null, 'otro' as never)).toThrow(RangeError);
  });
});

describe('propiedades de los aminoácidos y gel', () => {
  it('clases químicas a partir de la tabla del modelo dna', () => {
    expect(aaClass('V')).toBe('hidrofóbico');
    expect(aaClass('E')).toBe('cargado (−)');
    expect(aaClass('K')).toBe('cargado (+)');
    expect(aaClass('S')).toBe('polar sin carga');
    expect(aaClass('*')).toBe('terminación');
    expect(GENETIC_CODE.GUG).toBe('V');
  });

  it('masa y migración: más corta → más lejos; fuera del rango sale del gel', () => {
    expect(proteinMassKDa(147)).toBeCloseTo(16.188, 3);
    expect(proteinMassKDa(0)).toBe(0);
    expect(gelMigration(0)).toBeNull();
    expect(gelMigration(5)).toBe(1);
    const rf = [147, 100, 60, 30].map((n) => gelMigration(n)!);
    for (let i = 1; i < rf.length; i++) expect(rf[i]).toBeGreaterThan(rf[i - 1]);
    // lineal con log(masa): duplicar la masa resta siempre lo mismo
    expect(gelMigration(60)! - gelMigration(120)!).toBeCloseTo(gelMigration(100)! - gelMigration(200)!, 2);
  });
});

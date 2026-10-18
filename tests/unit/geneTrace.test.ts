import { describe, expect, it } from 'vitest';
import {
  CONSEQUENCE_LABEL, ECO, GENES, GENES_RETRIEVED, GENE_INFO_ES, STEP_ORDER, applyVariant, classifyCodes, clinvarHgvs, consequenceFromHgvs,
  exonOfCds, findGenes, geneByKey, geneStructure, geneTraceModelSpec, parseHgvsC, singleBaseVariant, statusOf, traceSteps, translateCds, variantConsequence,
} from '../../src/models/geneTrace';

const HBB = geneByKey('HBB');
const sources = (g: (typeof GENES)[number]) => [g.gene.source, g.genomicSource, g.protein.source, g.uniprot.source, ...(g.mrna ? [g.mrna.source] : []), ...(g.structure ? [g.structure.source] : []), ...g.variants.map((v) => v.source)];

describe('rastreo génico: integridad de los datos guardados', () => {
  it('el conjunto curado tiene 5 genes con identificadores completos y versionados', () => {
    expect(GENES.map((g) => g.key)).toEqual(['HBB', 'INS', 'LCT', 'OCA2', 'lacZ']);
    for (const g of GENES) {
      expect(g.gene.geneId).toBeGreaterThan(0);
      expect(g.gene.taxId).toBeGreaterThan(0);
      expect(g.gene.genomic.accession).toMatch(/^NC_\d+\.\d+$/);
      expect(g.protein.accession).toMatch(/^[NW]P_\d+\.\d+$/);
      expect(g.uniprot.accession).toMatch(/^[OPQ][0-9][A-Z0-9]{3}[0-9]$/);
      expect(g.uniprot.reviewed).toBe(true);
      if (g.mrna) expect(g.mrna.accession).toMatch(/^NM_\d+\.\d+$/);
      if (g.structure) expect(g.structure.pdb).toMatch(/^[0-9][A-Z0-9]{3}$/);
    }
  });

  it('cada sección declara su fuente (URL https) y la fecha de consulta 2026-10-18', () => {
    expect(GENES_RETRIEVED).toBe('2026-10-18');
    for (const g of GENES) for (const s of sources(g)) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.api).toMatch(/^https:\/\//);
      expect(s.retrieved).toBe('2026-10-18');
      expect(s.db.length).toBeGreaterThan(3);
    }
    expect(ECO.source.retrieved).toBe('2026-10-18');
  });

  it('la traducción de cada región codificante es idéntica a la proteína guardada y termina en un codón de terminación', () => {
    for (const g of GENES) {
      expect(g.cds.length % 3).toBe(0);
      expect(g.cds.slice(0, 3)).toBe('ATG');
      const p = translateCds(g.cds);
      expect(p.endsWith('*')).toBe(true);
      expect(p.slice(0, -1)).toBe(g.protein.sequence);
      expect(p.slice(0, -1)).not.toContain('*'); // sin terminaciones internas
      expect(g.protein.length).toBe(g.protein.sequence.length);
      expect(g.uniprot.length).toBe(g.protein.length);
    }
  });

  it('los exones del ARNm son contiguos, suman su longitud y coinciden con los del genoma', () => {
    for (const g of GENES) {
      if (!g.mrna) { expect(g.genomicExons).toHaveLength(1); continue; }
      const ex = g.mrna.exons;
      ex.forEach((e, i) => { expect(e.start).toBe(i === 0 ? 1 : ex[i - 1].end + 1); expect(e.length).toBe(e.end - e.start + 1); });
      expect(ex[ex.length - 1].end).toBe(g.mrna.length);
      expect(ex.map((e) => e.length)).toEqual(g.genomicExons.map((e) => e.length));
      expect(g.mrna.cds.end - g.mrna.cds.start + 1).toBe(g.cds.length);
      // Los exones del genoma están ordenados y no se solapan.
      g.genomicExons.forEach((e, i) => { if (i) expect(e.geneStart).toBeGreaterThan(g.genomicExons[i - 1].geneEnd); });
    }
  });

  it('la estructura de HBB coincide con el cálculo a mano: 3 exones (142, 223, 263 nt) e intrones de 130 y 850 nt', () => {
    const s = geneStructure(HBB);
    expect(s.exons.map((e) => e.length)).toEqual([142, 223, 263]);
    expect(s.introns.map((i) => i.length)).toEqual([130, 850]);
    expect(s.geneLength).toBe(1608);
    expect(s.exonicLength).toBe(628);
    expect(s.exonicPercent).toBe(39.1); // 628 / 1608 = 39,05 %
    expect(s.utr5).toBe(50);
    expect(s.utr3).toBe(134);
    expect(s.codons).toBe(148);
    // lacZ (bacteria): sin intrones, 100 % exónico.
    expect(geneStructure(geneByKey('lacZ')).exonicPercent).toBe(100);
    expect(geneStructure(geneByKey('lacZ')).introns).toHaveLength(0);
  });
});

describe('rastreo génico: variantes y traducción de referencia', () => {
  it('las variantes de ClinVar de HBB tienen la misma consecuencia proteica que la traducción de referencia', () => {
    const expected: Record<string, [string, string]> = {
      'c.20A>T': ['p.Glu7Val', 'sentido-erroneo'], 'c.118C>T': ['p.Gln40Ter', 'sin-sentido'], 'c.27dup': ['p.Ser10fs', 'cambio-marco'],
    };
    expect(HBB.variants).toHaveLength(3);
    for (const v of HBB.variants) {
      const parsed = clinvarHgvs(v.title)!;
      expect(parsed.transcript).toBe(HBB.mrna!.accession); // la HGVS de ClinVar usa el mismo transcrito NM_000518.5
      const r = consequenceFromHgvs(HBB, v.hgvsC!);
      expect(r.hgvsP).toBe(v.hgvsP);
      expect([r.hgvsP, r.consequence]).toEqual(expected[v.hgvsC!]);
    }
  });

  it('c.20A>T cambia el codón 7 de GAG a GTG (Glu → Val); en la numeración clásica es Glu6Val', () => {
    const r = consequenceFromHgvs(HBB, 'c.20A>T');
    expect([r.refCodon, r.altCodon, r.refAa, r.altAa, r.codon]).toEqual(['GAG', 'GTG', 'E', 'V', 7]);
    expect(HBB.protein.sequence[6]).toBe('E');
    expect(r.codon! - 1).toBe(6); // sin la Met inicial (cadena madura 2-147)
    expect(HBB.structure!.chainsUniProt).toMatch(/2-147/);
    expect(r.identity).toBe(99.3); // 146/147
    expect(r.exon).toBe(1);
    expect(GENE_INFO_ES.HBB.legacyNote).toMatch(/Glu6Val/);
  });

  it('la mutación sin sentido trunca la proteína y el cambio de marco calcula la nueva terminación', () => {
    const non = consequenceFromHgvs(HBB, 'c.118C>T');
    expect(non.altLength).toBe(39);
    expect(non.identity).toBe(26.5); // 39/147
    const fs = consequenceFromHgvs(HBB, 'c.27dup');
    expect(fs.hgvsPLong).toMatch(/^p\.Ser10ValfsTer\d+$/);
    const pv = parseHgvsC('c.27dup');
    if (!pv.coding) throw new Error('c.27dup debe ser codificante');
    const mut = translateCds(applyVariant(HBB.cds, pv.variant), true);
    expect(mut[9]).toBe('V');
    expect(fs.altLength).toBe(mut.length - 1);
  });

  it('clasifica sustituciones hipotéticas: sinónima, sentido erróneo, sin sentido y pérdida del inicio', () => {
    // Codón 2 de HBB: GTG (Val). GTG → GTC sigue siendo Val; GTG → GCG es Ala.
    expect(variantConsequence(HBB, singleBaseVariant(HBB, { geneKey: 'HBB', kind: 'sustitucion', position: 6, base: 'C' })).consequence).toBe('sinonima');
    expect(variantConsequence(HBB, singleBaseVariant(HBB, { geneKey: 'HBB', kind: 'sustitucion', position: 5, base: 'C' })).hgvsP).toBe('p.Val2Ala');
    // Codón 16 (TGG, Trp): TGG → TAG es terminación.
    expect(HBB.cds.slice(45, 48)).toBe('TGG');
    expect(variantConsequence(HBB, singleBaseVariant(HBB, { geneKey: 'HBB', kind: 'sustitucion', position: 47, base: 'A' })).consequence).toBe('sin-sentido');
    expect(variantConsequence(HBB, singleBaseVariant(HBB, { geneKey: 'HBB', kind: 'sustitucion', position: 1, base: 'G' })).consequence).toBe('perdida-inicio');
    for (const k of Object.keys(CONSEQUENCE_LABEL)) expect(CONSEQUENCE_LABEL[k as keyof typeof CONSEQUENCE_LABEL].length).toBeGreaterThan(5);
  });

  it('deleciones de 1 y 3 nucleótidos: cambio del marco frente a deleción en el marco', () => {
    const one = variantConsequence(HBB, { kind: 'delecion', start: 30, end: 30 });
    expect(one.consequence).toBe('cambio-marco');
    const three = variantConsequence(HBB, { kind: 'delecion', start: 28, end: 30 });
    expect(three.consequence).toBe('en-marco');
    expect(three.altLength).toBe(146);
    expect(() => variantConsequence(HBB, { kind: 'sustitucion', start: 20, end: 20, ref: 'G', alt: 'T' })).toThrow(/referencia/);
    expect(() => singleBaseVariant(HBB, { geneKey: 'HBB', kind: 'delecion', position: 0 })).toThrow(RangeError);
    expect(() => singleBaseVariant(HBB, { geneKey: 'HBB', kind: 'delecion', position: HBB.cds.length + 1 })).toThrow(RangeError);
  });

  it('una variante corriente arriba (LCT c.-13907C>T) no se traduce y se rotula como no codificante', () => {
    const lct = geneByKey('LCT');
    const v = lct.variants[0];
    expect(v.dbSNP).toBe('rs4988235');
    const r = consequenceFromHgvs(lct, v.hgvsC!);
    expect(r.consequence).toBe('no-codificante');
    expect(r.hgvsP).toBeNull();
    const p = parseHgvsC(v.hgvsC!, lct);
    expect(p.coding).toBe(false);
    if (!p.coding) expect(p.region).toBe('corriente-arriba');
    expect(exonOfCds(lct, 1)).toBe(1);
  });
});

describe('rastreo génico: tipo de evidencia y navegación', () => {
  it('clasifica los códigos ECO con la ontología: experimental → demostrado; inferencia del curador → inferido', () => {
    expect(ECO.terms['ECO:0000269'].experimental).toBe(true);
    expect(classifyCodes(['ECO:0000269'])).toBe('demostrado');
    expect(classifyCodes(['ECO:0000305'])).toBe('inferido');
    expect(classifyCodes(['ECO:0000332'])).toBe('inferido');
    expect(classifyCodes(['ECO:0000332', 'ECO:0000348'])).toBe('demostrado');
    expect(classifyCodes([])).toBe('sin-codigo');
    expect(statusOf('demostrado')).toBe('experimental');
    expect(statusOf('calculado')).toBe('modelo');
    expect(statusOf('inferido', ['ECO:0000332'])).toBe('prediccion');
    expect(statusOf('inferido', ['ECO:0000305'])).toBeNull();
    // Todo código ECO que aparece en los datos está clasificado.
    for (const code of new Set(JSON.stringify(GENES).match(/ECO:\d{7}/g))) expect(ECO.terms[code]).toBeDefined();
  });

  it('cada gen recorre las 13 etapas y cada afirmación tiene clase de evidencia y fuente (o se declara sin información)', () => {
    for (const g of GENES) {
      const steps = traceSteps(g);
      expect(steps.map((s) => s.id)).toEqual(STEP_ORDER);
      for (const s of steps) {
        expect(s.claims.length).toBeGreaterThan(0);
        for (const c of s.claims) {
          expect(['demostrado', 'inferido', 'sin-codigo', 'calculado', 'sin-informacion']).toContain(c.kind);
          if (c.kind === 'demostrado') expect(c.status).toBe('experimental');
          if (c.kind !== 'sin-informacion') expect(c.source?.url).toMatch(/^https:/);
          if (c.codes.length) expect(c.kind).toBe(classifyCodes(c.codes));
          expect(c.basis.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('la estructura solo se muestra como experimental si UniProt referencia la entrada PDB; si no, se dice «sin información»', () => {
    const est = (k: string) => traceSteps(geneByKey(k)).find((s) => s.id === 'estructura')!.claims;
    expect(est('HBB')[0]).toMatchObject({ kind: 'demostrado', status: 'experimental' });
    expect(geneByKey('HBB').structure).toMatchObject({ pdb: '2HHB', method: 'X-RAY DIFFRACTION', resolution: 1.74 });
    expect(est('LCT')[0].kind).toBe('sin-informacion');
    const af = est('LCT').find((c) => c.status === 'prediccion');
    expect(af?.text).toMatch(/predicción computacional/);
    // La función de INS no tiene código de evidencia en UniProt: no se presenta como demostrada.
    expect(traceSteps(geneByKey('INS')).find((s) => s.id === 'funcion')!.claims[0].kind).toBe('sin-codigo');
  });

  it('la paráfrasis en español corresponde a la cita vigente de UniProt y la perturbación es una hipótesis acotada', () => {
    for (const g of GENES) {
      const es = GENE_INFO_ES[g.key];
      expect(es).toBeDefined();
      expect(es.glossFor).toBe(g.uniprot.function?.quote ?? null);
      expect(es.perturbation).toMatch(/depende/);
      expect(es.perturbation).not.toMatch(/siempre|seguro|cura/i);
    }
  });

  it('la búsqueda funciona por nombre en español, símbolo, organismo e identificador', () => {
    expect(findGenes('').length).toBe(5);
    expect(findGenes('globina').map((g) => g.key)).toEqual(['HBB']);
    expect(findGenes('coli').map((g) => g.key)).toEqual(['lacZ']);
    expect(findGenes('homo sapiens').length).toBe(4);
    expect(findGenes('P01308').map((g) => g.key)).toEqual(['INS']);
    expect(findGenes('3938').map((g) => g.key)).toEqual(['LCT']);
    expect(findGenes('lactosa')).toEqual([]); // solo busca en nombres e identificadores, no en la función
    expect(findGenes('LACTASA').map((g) => g.key)).toEqual(['LCT']);
  });

  it('la ficha del modelo declara entradas con rango y casos de prueba', () => {
    const c = geneTraceModelSpec.inputs.find((i) => i.symbol === 'c')!;
    expect(c.range![1]).toBe(Math.max(...GENES.map((g) => g.cds.length)));
    expect(geneTraceModelSpec.testCases.length).toBeGreaterThanOrEqual(5);
    expect(geneTraceModelSpec.limits.join(' ')).toMatch(/14\.3/);
  });
});

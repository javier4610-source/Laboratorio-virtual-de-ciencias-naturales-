/**
 * Validación del motor de nomenclatura de funciones orgánicas (src/models/functionalNomenclature.ts) contra PubChem.
 * Referencia: «IUPACName» de PubChem, calculado por LexiChem TK (OpenEye), descargado con scripts/validacion/funcionales_pubchem.py
 * (tests/fixtures/funcionales-nomenclatura.json). El motor sigue las Recomendaciones IUPAC 2013; LexiChem usa otras convenciones en
 * algunos casos. Cada diferencia se clasifica con su motivo; una diferencia NO clasificada hace fallar la prueba.
 */
import { describe, expect, it } from 'vitest';
import fx from '../fixtures/funcionales-nomenclatura.json';
import lib from '../../src/data/quimica/funcionales-moleculas.json';
import { compareWithPubChem, nameFunctional, nameFunctionalSmiles } from '../../src/models/functionalNomenclature';
import { hillFormula, molFromMolfile, parseSmiles } from '../../src/models/organicGraph';

interface Fx { smilesEntrada: string; clase: string; cid: number; iupacPubChem: string; formula: string; smiles: string }
const ROWS = (fx as unknown as { estructuras: Fx[] }).estructuras;

const classify = compareWithPubChem;

describe('motor de nomenclatura de funciones frente a PubChem (LexiChem)', () => {
  it('nombra ≥ 100 estructuras con grupos funcionales y toda diferencia es una convención documentada', () => {
    const counts: Record<string, number> = {};
    const bad: string[] = [];
    const seen = new Set<number>();
    for (const r of ROWS) {
      if (seen.has(r.cid)) continue;
      seen.add(r.cid);
      const res = nameFunctionalSmiles(r.smiles);
      expect(res.ok, `${r.smiles}: ${res.ok ? '' : res.motivo}`).toBe(true);
      if (!res.ok) continue;
      const c = classify(r.iupacPubChem, res.en);
      counts[c] = (counts[c] ?? 0) + 1;
      if (c === 'NO CLASIFICADA') bad.push(`${r.smiles} → motor «${res.en}», PubChem «${r.iupacPubChem}»`);
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    console.log(`[nomenclatura funcional] ${total} estructuras distintas:`, counts);
    expect(total).toBeGreaterThanOrEqual(170);
    expect(bad, bad.join('\n')).toEqual([]);
    expect(counts['idéntico']).toBeGreaterThanOrEqual(155);
  });

  it('hay al menos 100 estructuras con O o N (grupos funcionales)', () => {
    const withON = ROWS.filter((r) => /[ON]/.test(r.formula));
    expect(new Set(withON.map((r) => r.cid)).size).toBeGreaterThanOrEqual(100);
  });

  it('la fórmula de Hill del grafo coincide con la de PubChem', () => {
    for (const r of ROWS) expect(hillFormula(parseSmiles(r.smiles)), r.smiles).toBe(r.formula);
  });

  it('el SMILES escrito a mano y el de PubChem dan el mismo nombre', () => {
    for (const r of ROWS) {
      const a = nameFunctionalSmiles(r.smilesEntrada), b = nameFunctionalSmiles(r.smiles);
      expect(a.ok && b.ok && a.en === b.en, r.smilesEntrada).toBe(true);
    }
  });

  it('el grafo leído del confórmero 3D de PubChem (H explícitos) da el mismo nombre que su SMILES', () => {
    const recs = (lib as unknown as { moleculas: { id: string; smiles: string; sdf: string | null }[] }).moleculas;
    let n = 0;
    for (const r of recs) {
      if (!r.sdf) continue;
      const fromSmiles = nameFunctionalSmiles(r.smiles);
      if (!fromSmiles.ok) continue;
      const from3d = nameFunctional(molFromMolfile(r.sdf).mol);
      expect(from3d.ok && from3d.en, r.id).toBe(fromSmiles.en);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(80);
  });
});

describe('nombres en español (Recomendaciones IUPAC 2013)', () => {
  const cases: [string, string][] = [
    ['CCO', 'etanol'], ['CC(C)O', 'propan-2-ol'], ['OCCO', 'etano-1,2-diol'], ['OCC(O)CO', 'propano-1,2,3-triol'], ['CC(C)(C)O', '2-metilpropan-2-ol'],
    ['Oc1ccccc1', 'fenol'], ['Cc1ccc(O)cc1', '4-metilfenol'], ['CCOCC', 'etoxietano'], ['COc1ccccc1', 'metoxibenceno'],
    ['C=O', 'formaldehído'], ['CCC=O', 'propanal'], ['O=Cc1ccccc1', 'benzaldehído'], ['CC(C)=O', 'propan-2-ona'], ['O=C1CCCCC1', 'ciclohexanona'],
    ['CC(=O)c1ccccc1', '1-feniletan-1-ona'], ['CC(O)=O', 'ácido acético'], ['CCC(O)=O', 'ácido propanoico'], ['OC(=O)c1ccccc1', 'ácido benzoico'],
    ['OC(=O)CCl', 'ácido cloroacético'], ['CC(O)C(O)=O', 'ácido 2-hidroxipropanoico'], ['OC(=O)CCCCC(O)=O', 'ácido hexanodioico'],
    ['CCOC(C)=O', 'acetato de etilo'], ['CC(C)CCOC(C)=O', 'acetato de 3-metilbutilo'], ['COC(=O)c1ccccc1O', '2-hidroxibenzoato de metilo'],
    ['CN', 'metanamina'], ['CNC', 'N-metilmetanamina'], ['CN(C)C', 'N,N-dimetilmetanamina'], ['CCCN', 'propan-1-amina'], ['Nc1ccccc1', 'anilina'],
    ['CC(N)=O', 'acetamida'], ['CN(C)C=O', 'N,N-dimetilformamida'], ['CC(=O)Nc1ccc(O)cc1', 'N-(4-hidroxifenil)acetamida'], ['NC(N)=O', 'urea'],
    ['NCC(O)=O', 'ácido aminoacético'], ['CC(N)C(O)=O', 'ácido 2-aminopropanoico'], ['NCCO', '2-aminoetan-1-ol'],
    ['CC(=O)Oc1ccccc1C(O)=O', 'ácido 2-(acetiloxi)benzoico'],
  ];
  for (const [smi, es] of cases) it(`${smi} → ${es}`, () => {
    const r = nameFunctionalSmiles(smi);
    expect(r.ok && r.es, smi).toBe(es);
  });
});

describe('prioridad del grupo principal y numeración', () => {
  it('el ácido manda sobre el alcohol y el amino (prefijos hidroxi-, amino-)', () => {
    const r = nameFunctionalSmiles('OCC(N)C(O)=O');
    expect(r.ok && r.en).toBe('2-amino-3-hydroxypropanoic acid');
    expect(r.ok && r.principal).toBe('acido');
  });
  it('el alcohol manda sobre la amina: 2-aminoetan-1-ol', () => {
    const r = nameFunctionalSmiles('NCCO');
    expect(r.ok && r.principal).toBe('alcohol');
  });
  it('el sufijo lleva el localizador más bajo aunque los prefijos queden altos: 4-methylpentan-2-ol', () => {
    expect((nameFunctionalSmiles('CC(C)CC(C)O') as { en: string }).en).toBe('4-methylpentan-2-ol');
  });
  it('desde 2013 la cadena principal es la más larga que lleva el grupo principal, aunque el C=C quede fuera', () => {
    const r = nameFunctionalSmiles('C=C(CC)CCO');
    expect(r.ok && r.en).toBe('3-methylidenepentan-1-ol');
  });
  it('fuera de alcance: anillos con heteroátomos y triglicéridos (explica el motivo)', () => {
    const a = nameFunctionalSmiles('C1CCOC1');
    expect(a.ok).toBe(false);
    const b = nameFunctionalSmiles('CC(=O)OCC(COC(C)=O)OC(C)=O');
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.motivo).toMatch(/éster/);
  });
});

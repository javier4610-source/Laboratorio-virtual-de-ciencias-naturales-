/**
 * Validación del motor de nomenclatura (src/models/organicNomenclature.ts) contra PubChem.
 * Referencia: «IUPACName» de PubChem, calculado por LexiChem TK (OpenEye), descargado con scripts/validacion/organica_pubchem.py
 * (tests/fixtures/pubchem-nomenclatura.json). El motor sigue las Recomendaciones IUPAC 2013; LexiChem sigue otras convenciones en
 * unos pocos casos. Cada diferencia se clasifica aquí con su motivo; cualquier diferencia NO clasificada hace fallar la prueba.
 */
import { describe, expect, it } from 'vitest';
import fx from '../fixtures/pubchem-nomenclatura.json';
import { nameMolecule, nameSmiles, normalizeName, cipCompare } from '../../src/models/organicNomenclature';
import { canonicalKey, hillFormula, mapHeavyAtoms, molFromMolfile, parseSmiles, stripHydrogens, toSmiles } from '../../src/models/organicGraph';
import conf from '../../src/data/quimica/organica-nomenclatura.json';
import { buildMolecule, emptyState, resizeState, type BuilderState } from '../../src/models/organicBuilder';

interface Fx { smilesEntrada: string; clase: string; cid: number; iupacPubChem: string; formula: string; smiles: string }
const ROWS = (fx as unknown as { estructuras: Fx[] }).estructuras;

/** Diferencias legítimas: el motor da el nombre sistemático de 2013; LexiChem usa un nombre retenido de uso general. */
const RETAINED_GENERAL: Record<string, string> = {
  acetylene: 'ethyne', cumene: '(propan-2-yl)benzene', '1,2-xylene': '1,2-dimethylbenzene', '1,3-xylene': '1,3-dimethylbenzene',
  '1,4-xylene': '1,4-dimethylbenzene', styrene: 'ethenylbenzene', chloroform: 'trichloromethane', cyclooctatetraene: 'cycloocta-1,3,5,7-tetraene',
};

type Clase = 'idéntico' | 'paréntesis (2013)' | 'nombre retenido (LexiChem)' | 'localizador 1 del cicloalqueno' | 'NO CLASIFICADA';

function classify(r: Fx, en: string): Clase {
  if (en === r.iupacPubChem) return 'idéntico';
  if (normalizeName(en, { dropParens: true }) === normalizeName(r.iupacPubChem, { dropParens: true })) return 'paréntesis (2013)';
  if (RETAINED_GENERAL[r.iupacPubChem] === en) return 'nombre retenido (LexiChem)';
  // LexiChem omite «-1-» en cicloalquenos sustituidos: «3-methylcyclohexene» frente a «3-methylcyclohex-1-ene»
  if (en.replace(/cyclo(\w+?)-1-ene$/, 'cyclo$1ene') === r.iupacPubChem) return 'localizador 1 del cicloalqueno';
  return 'NO CLASIFICADA';
}

describe('motor de nomenclatura frente a PubChem (LexiChem)', () => {
  it('nombra ≥ 100 estructuras y toda diferencia con PubChem es una convención documentada', () => {
    const counts: Record<string, number> = {};
    const bad: string[] = [];
    const seen = new Set<number>();
    for (const r of ROWS) {
      if (seen.has(r.cid)) continue; // la misma estructura escrita con otro SMILES (p. ej. 4-metilpent-2-ino)
      seen.add(r.cid);
      const res = nameSmiles(r.smiles);
      expect(res.ok, `${r.smiles}: ${res.ok ? '' : res.motivo}`).toBe(true);
      if (!res.ok) continue;
      const c = classify(r, res.en);
      counts[c] = (counts[c] ?? 0) + 1;
      if (c === 'NO CLASIFICADA') bad.push(`${r.smiles} → motor «${res.en}», PubChem «${r.iupacPubChem}»`);
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    console.log(`[nomenclatura] ${total} estructuras distintas:`, counts);
    expect(total).toBeGreaterThanOrEqual(100);
    expect(bad, bad.join('\n')).toEqual([]);
    expect(counts['idéntico']).toBeGreaterThanOrEqual(170);
  });

  it('la fórmula de Hill del grafo coincide con la de PubChem en todas las estructuras', () => {
    for (const r of ROWS) expect(hillFormula(parseSmiles(r.smiles)), r.smiles).toBe(r.formula);
  });

  it('el SMILES escrito por el docente y el de PubChem dan el mismo nombre (independencia de la escritura)', () => {
    for (const r of ROWS) {
      const a = nameSmiles(r.smilesEntrada), b = nameSmiles(r.smiles);
      expect(a.ok && b.ok && a.en === b.en, r.smilesEntrada).toBe(true);
    }
  });
});

describe('nombres en español (Recomendaciones IUPAC 2013, orden alfabético en español)', () => {
  const cases: [string, string][] = [
    ['CCC(C)C', '2-metilbutano'], ['CC(C)(C)C', '2,2-dimetilpropano'], ['CC=CC', 'but-2-eno'], ['C/C=C/C', '(E)-but-2-eno'],
    ['C/C=C\\C', '(Z)-but-2-eno'], ['C=CC=C', 'buta-1,3-dieno'], ['C=CCC#C', 'pent-1-en-4-ino'], ['C#CC=CC=C', 'hexa-1,3-dien-5-ino'],
    ['CCC(C)CI', '2-metil-1-yodobutano'], ['CCCC(CCC)C(C)C', '4-(propan-2-il)heptano'], ['CCCC(CCC)C(C)(C)C', '4-terc-butilheptano'],
    ['CCCCC(CC(C)C)CCCC', '5-(2-metilpropil)nonano'], ['CCC(CC)CC', '3-etilpentano'], ['CCC(C)C(CC)C(C)C', '3-etil-2,4-dimetilhexano'],
    ['CCCC(=C)CC', '3-metilidenhexano'], ['C=CC1CCCCC1', 'etenilciclohexano'], ['Cc1ccccc1', 'tolueno'], ['Cc1ccccc1C', '1,2-dimetilbenceno'],
    ['Clc1ccc(Br)cc1', '1-bromo-4-clorobenceno'], ['ClC(Cl)Cl', 'triclorometano'], ['CCl', 'clorometano'], ['BrCCBr', '1,2-dibromoetano'],
    ['C1CCCCC1', 'ciclohexano'], ['C1CCC=CC1', 'ciclohexeno'], ['C#C', 'etino'], ['C', 'metano'], ['C=C', 'eteno'], ['CC#C', 'prop-1-ino'],
    ['FC(F)(F)C(Cl)Br', '2-bromo-2-cloro-1,1,1-trifluoroetano'], ['c1ccc2ccccc2c1', 'naftaleno'],
  ];
  for (const [smi, es] of cases) it(`${smi} → ${es}`, () => {
    const r = nameSmiles(smi);
    expect(r.ok && r.es).toBe(es);
  });

  it('el orden alfabético depende del idioma: «iodo» va antes que «methyl» en inglés y «yodo» después de «metil» en español', () => {
    const r = nameSmiles('CC(I)C(C)CC');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.en).toBe('2-iodo-3-methylpentane');
    expect(r.es).toBe('3-metil-2-yodopentano');
  });

  it('elige la cadena más larga aunque no tenga el doble enlace (regla 2013) y lo explica', () => {
    const r = nameSmiles('C=C(CC)CCC');
    expect(r.ok && r.en).toBe('3-methylidenehexane');
    if (r.ok) expect(r.pasos.map((p) => p.texto).join(' ')).toMatch(/Desde 2013/);
  });

  it('fuera de alcance: devuelve un motivo en español, nunca un nombre inventado', () => {
    for (const s of ['CCO', 'CC(=O)O', 'c1ccncc1', 'C1CC2CCC1C2', '[CH3-]']) {
      const r = nameSmiles(s);
      expect(r.ok, s).toBe(false);
      if (!r.ok) expect(r.motivo.length).toBeGreaterThan(10);
    }
  });

  it('CIP: Br > Cl > C; en un doble enlace se duplican los átomos', () => {
    const m = parseSmiles('BrC(Cl)C');
    expect(cipCompare(m, 1, 0, 2)).toBeGreaterThan(0);
    const v = parseSmiles('C(C=C)C(C)C'); // en C0: rama vinilo (C1) frente a isopropilo (C3)
    // vinilo {C, C duplicado, H} e isopropilo {C, C, H} empatan en la 1.ª esfera; en la 2.ª, =CH₂ {C dup, H, H} > CH₃ {H, H, H}
    expect(cipCompare(v, 0, 1, 3)).toBeGreaterThan(0);
  });
});

describe('grafo, SMILES y huella canónica', () => {
  it('la huella distingue todas las estructuras distintas del conjunto de validación e iguala escrituras distintas', () => {
    const byCid = new Map<number, string>();
    for (const r of ROWS) {
      const k1 = canonicalKey(parseSmiles(r.smiles), true), k2 = canonicalKey(parseSmiles(r.smilesEntrada), true);
      expect(k1, r.smiles).toBe(k2);
      byCid.set(r.cid, k1);
    }
    expect(new Set(byCid.values()).size).toBe(byCid.size);
  });

  it('toSmiles → parseSmiles conserva la constitución y la configuración E/Z', () => {
    for (const r of ROWS) {
      const m = parseSmiles(r.smiles);
      const back = parseSmiles(toSmiles(m));
      expect(canonicalKey(back, true), `${r.smiles} → ${toSmiles(m)}`).toBe(canonicalKey(m, true));
      const n1 = nameMolecule(m), n2 = nameMolecule(back);
      expect(n1.ok && n2.ok && n1.en === n2.en, r.smiles).toBe(true);
    }
  });

  it('cada confórmero 3D del constructor se alinea átomo a átomo con su estructura (isomorfismo de grafos)', () => {
    const list = (conf as unknown as { conformeros: { cid: number; sdf: string; smiles: string }[] }).conformeros;
    expect(list.length).toBeGreaterThanOrEqual(150);
    for (const c of list) {
      const { mol } = molFromMolfile(c.sdf);
      const heavy = stripHydrogens(mol).mol;
      const target = parseSmiles(c.smiles);
      expect(mapHeavyAtoms(target, heavy), `CID ${c.cid}`).not.toBeNull();
      expect(canonicalKey(heavy), `CID ${c.cid}`).toBe(canonicalKey(target));
    }
  });
});

describe('constructor de moléculas', () => {
  const st = (f: (s: BuilderState) => void, s0 = emptyState({ kind: 'cadena', n: 5 })) => { const s = structuredClone(s0); f(s); return s; };
  it('cadena de 5 C con metilo en la posición 2 → 2-metilpentano', () => {
    const r = buildMolecule(st((s) => { s.subs[1] = ['metil']; }));
    const n = r.mol ? nameMolecule(r.mol) : null;
    expect(n?.ok && n.es).toBe('2-metilpentano');
  });
  it('«2-etilbutano» dibujado por el estudiante es en realidad 3-metilpentano (cadena más larga)', () => {
    const r = buildMolecule(st((s) => { s.subs[1] = ['etil']; }, emptyState({ kind: 'cadena', n: 4 })));
    const n = nameMolecule(r.mol!);
    expect(n.ok && n.es).toBe('3-metilpentano');
    if (n.ok) expect(n.parent.size).toBe(5);
  });
  it('rechaza un carbono con más de 4 enlaces', () => {
    const r = buildMolecule(st((s) => { s.bondOrders[1] = 3; s.subs[1] = ['metil']; }));
    expect(r.mol).toBeNull();
    expect(r.errors.join(' ')).toMatch(/5 enlaces/);
  });
  it('cis/trans en la cadena dibujada → Z/E', () => {
    const cis = buildMolecule(st((s) => { s.bondOrders[1] = 2; s.stereo[1] = 'cis'; }, emptyState({ kind: 'cadena', n: 4 })));
    const trans = buildMolecule(st((s) => { s.bondOrders[1] = 2; s.stereo[1] = 'trans'; }, emptyState({ kind: 'cadena', n: 4 })));
    expect(nameMolecule(cis.mol!).ok && (nameMolecule(cis.mol!) as { es: string }).es).toBe('(Z)-but-2-eno');
    expect((nameMolecule(trans.mol!) as { es: string }).es).toBe('(E)-but-2-eno');
  });
  it('benceno con Cl en 1 y metilo en 4 → 1-cloro-4-metilbenceno; resizeState conserva y poda', () => {
    const s = emptyState({ kind: 'benceno' });
    s.subs[0] = ['Cl']; s.subs[3] = ['metil'];
    expect((nameMolecule(buildMolecule(s).mol!) as { es: string }).es).toBe('1-cloro-4-metilbenceno');
    const c = st((x) => { x.subs[4] = ['metil', 'metil', 'metil']; });
    const r = resizeState(c, { kind: 'cadena', n: 5 });
    expect(r.subs[4].length).toBe(3);
    const r2 = resizeState(st((x) => { x.subs[3] = ['metil', 'metil']; }), { kind: 'cadena', n: 4 });
    expect(r2.subs[3].length).toBe(2); // C4 terminal con 2 metilos: 1 + 2 = 3 ≤ 4
  });
});

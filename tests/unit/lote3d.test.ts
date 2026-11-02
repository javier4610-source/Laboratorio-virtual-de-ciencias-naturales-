import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REACTIONS as BAL_REACTIONS, countSides, ATOMIC_MASS } from '../../src/models/balancing';
import { REACTIONS as STO_REACTIONS, simulateStoichiometry } from '../../src/models/stoichiometry';
import { limitingReagent, reactantAmounts, REACTIONS as CONS_REACTIONS, simulateConservation, type SystemId } from '../../src/models/massConservation';
import { SUBSTANCES, MOL_REACTIONS } from '../../src/models/mole';
import { SOLUTES } from '../../src/models/solutions';
import { analyzeGeneMutation, CDS_START, expressGene } from '../../src/models/geneExpression';
import { GENES, singleBaseVariant, variantConsequence } from '../../src/models/geneTrace';
import { AMINO_ACIDS as PROT_AA, parseStructure } from '../../src/models/protein';
import { AMINO_ACIDS as DNA_AA } from '../../src/models/dna';
import { ENZYMES, nativeFraction, temperatureFactor, T_REF } from '../../src/models/enzyme';
import { funcSpecies } from '../../src/data/quimica/funcionales';
import { moleculeSpecies } from '../../src/chem';
import { buildScene, sceneCounts } from '../../src/chem/sceneLayout';
import { mixHex } from '../../src/chem/SpeciesScene3D';
import { acetateFrom, dissolvedParticles, NO_GEOMETRY, speciesForFormula, type ExtraSpecies } from '../../src/labs/lote3d/formulaSpecies';
import {
  atomsMass, GENE_STRUCTURES, hbbResidue, INS_SEQ_DIFF, hydrationShell, insResidue, ionWaterDistance, matchesFormula, oca2Residue, packets,
  proteinMarks, unitsAt, unitsInBox, unitsWithYield, variantMarks,
} from '../../src/labs/lote3d/mappings';
import { balanceScene, balanceSceneCounts, conservationScene, hydrationScene, solutionBoxScene, stoichScene, type ConsTerm } from '../../src/labs/lote3d/scenes';

const EXTRA: ExtraSpecies = { aceticAcid: funcSpecies('acido-etanoico', 'Ácido acético') };
const sp = (f: string) => { const s = speciesForFormula(f, EXTRA); if (!s) throw new Error(`sin especie: ${f}`); return s; };
const three = (aa: string) => (aa === '*' ? 'Ter' : DNA_AA[aa]?.three ?? '?');

describe('especies 3D de las fórmulas del lote 1', () => {
  const formulas = new Set<string>([
    ...BAL_REACTIONS.flatMap((r) => [...r.reactants, ...r.products].map((s) => s.formula)),
    ...STO_REACTIONS.flatMap((r) => [...r.reactants, ...r.products].map((s) => s.formula)),
    ...MOL_REACTIONS.flatMap((r) => [...r.reaction.reactants, ...r.reaction.products].map((s) => s.formula)),
    ...SUBSTANCES.map((s) => s.formula),
    'CaCl2', 'Na2CO3', 'CaCO3', 'NaCl', 'Fe3O4',
  ]);
  it('cada fórmula tiene una especie con exactamente sus átomos (o está declarada sin geometría)', () => {
    for (const f of formulas) {
      if (NO_GEOMETRY[f]) { expect(speciesForFormula(f, EXTRA), f).toBeNull(); continue; }
      expect(matchesFormula(sp(f), f), f).toBe(true);
    }
  });
  it('el ácido acético y el acetato solo existen si se cargó la biblioteca orgánica (carga diferida)', () => {
    expect(speciesForFormula('CH3COOH')).toBeNull();
    expect(speciesForFormula('CH3COONa')).toBeNull();
  });
  it('acetato: el ácido sin el H del –COOH, carga −1 en un O y sus enlaces renumerados', () => {
    const a = acetateFrom(EXTRA.aceticAcid!);
    expect(matchesFormula(a, 'C2H3O2')).toBe(true);
    expect(a.charge).toBe(-1);
    expect(a.atoms.filter((x) => x.charge === -1).map((x) => x.el)).toEqual(['O']);
    expect(a.bonds.every((b) => b.a < a.atoms.length && b.b < a.atoms.length)).toBe(true);
    expect(a.bonds.length).toBe(EXTRA.aceticAcid!.bonds.length - 1);
    expect(a.geometryLabel).toMatch(/^Ilustración educativa/);
  });
  it('los solutos de la práctica de soluciones se separan en sus partículas', () => {
    for (const s of SOLUTES) {
      const parts = dissolvedParticles(s.formula)!;
      expect(parts, s.formula).not.toBeNull();
      const atoms = parts.flatMap((p) => Array.from({ length: p.per }, () => p.species.atoms)).flat();
      expect(matchesFormula({ ...parts[0].species, atoms }, s.formula), s.formula).toBe(true);
    }
  });
});

describe('balanceo: coeficientes → átomos de la escena 3D', () => {
  const sceneFor = (r: (typeof BAL_REACTIONS)[number], coefs: number[], mark: string | null = null) => {
    const all = [...r.reactants, ...r.products];
    return balanceScene(all.map((s) => sp(s.formula)), all.map((s) => s.formula), r.reactants.length, coefs, mark);
  };
  it('con la respuesta y con coeficientes cualesquiera, los átomos de cada lado son los de countSides', () => {
    const tries = (n: number) => [Array(n).fill(1), Array.from({ length: n }, (_, i) => (i % 3) + 1), Array.from({ length: n }, (_, i) => 12 - i)];
    for (const r of BAL_REACTIONS) {
      for (const coefs of [r.answer, ...tries(r.answer.length)]) {
        const c = balanceSceneCounts(sceneFor(r, coefs));
        for (const row of countSides(r, coefs)) {
          expect(c.left[row.element] ?? 0, `${r.id} ${coefs} ${row.element} izquierda`).toBe(row.left);
          expect(c.right[row.element] ?? 0, `${r.id} ${coefs} ${row.element} derecha`).toBe(row.right);
        }
      }
    }
  });
  it('cada coeficiente es el número de copias del bloque y el elemento de la pista se resalta', () => {
    const r = BAL_REACTIONS.find((x) => x.id === 'metano')!;
    const s = sceneFor(r, [1, 2, 1, 2], 'O');
    const copies = (b: number) => new Set(s.atoms.filter((a) => a.block === b).map((a) => a.copy)).size;
    expect([0, 1, 2, 3].map(copies)).toEqual([1, 2, 1, 2]);
    expect(s.atoms.filter((a) => a.mark).every((a) => a.el === 'O')).toBe(true);
    expect(s.atoms.filter((a) => a.mark).length).toBe(4 + 4);
    expect(s.labels.map((l) => l.text)).toEqual(['CH₄', '2 O₂', 'CO₂', '2 H₂O']);
  });
});

describe('paquetes de partículas y reactivo limitante', () => {
  it('el limitante de los paquetes es el del modelo de estequiometría y se consume entero', () => {
    for (const r of STO_REACTIONS) for (const mA of [0.5, 3, 10, 27.4, 60]) for (const mB of [0.5, 4, 10, 33, 60]) {
      const res = simulateStoichiometry({ reactionId: r.id, massA: mA, massB: mB, yieldPercent: 100 });
      const p = packets(res.molesA, r.reactants[0].coef, res.molesB, r.reactants[1].coef, 4);
      expect(p.limiting, `${r.id} ${mA} ${mB}`).toBe(res.limiting);
      expect(p.a - p.units * r.reactants[0].coef).toBe(p.leftA);
      expect(Math.min(p.leftA, p.leftB)).toBe(0);
      if (res.limiting === 0) expect(p.leftA).toBe(0);
      if (res.limiting === 1) expect(p.leftB).toBe(0);
      expect(p.units).toBeGreaterThanOrEqual(1);
      expect(Math.max(p.a / r.reactants[0].coef, p.b / r.reactants[1].coef)).toBeLessThanOrEqual(4.5);
    }
  });
  it('proporción exacta: no sobra nada; sin un reactivo: no hay reacción', () => {
    expect(packets(2, 1, 4, 2, 4)).toEqual({ a: 4, b: 8, units: 4, leftA: 0, leftB: 0, limiting: null });
    expect(packets(0, 1, 3, 1, 4).units).toBe(0);
    expect(packets(1, 3, Infinity, 2, 2)).toMatchObject({ a: 6, b: 4, units: 2, limiting: 0 });
  });
  it('avance y rendimiento en unidades enteras', () => {
    expect([0, 0.2, 0.5, 1].map((e) => unitsAt(4, e))).toEqual([0, 1, 2, 4]);
    expect(unitsWithYield(4, 100)).toBe(4);
    expect(unitsWithYield(4, 50)).toBe(2);
    expect(unitsWithYield(4, 1)).toBe(0);
  });
  it('estequiometría: los átomos de antes y de después son los mismos con cualquier rendimiento', () => {
    for (const r of STO_REACTIONS) for (const y of [100, 73, 30]) {
      const res = simulateStoichiometry({ reactionId: r.id, massA: 12, massB: 7, yieldPercent: y });
      const [A, B] = r.reactants.map((s) => ({ species: sp(s.formula), formula: s.formula, coef: s.coef }));
      const P = r.products.map((s) => ({ species: sp(s.formula), formula: s.formula, coef: s.coef }));
      const pk = packets(res.molesA, A.coef, res.molesB, B.coef, 4);
      const sc = stoichScene(A, B, P, pk, y);
      expect(sceneCounts(sc, sc.after), `${r.id} ${y}`).toEqual(sceneCounts(sc, sc.before));
      expect(sc.atoms.some((a) => a.dim)).toBe(sc.lostUnits > 0);
    }
  });
});

describe('conservación de la masa: recipiente con partículas', () => {
  const terms = (id: string): { A: ConsTerm; B: ConsTerm; P: ConsTerm[] } => {
    if (id === 'bicarbonato') return { A: { species: sp('NaHCO3'), formula: 'NaHCO3', coef: 1 }, B: { species: sp('CH3COOH'), formula: 'CH3COOH', coef: 1 }, P: [{ species: sp('CH3COONa'), formula: 'CH3COONa', coef: 1 }, { species: sp('H2O'), formula: 'H2O', coef: 1 }, { species: sp('CO2'), formula: 'CO2', coef: 1, gas: true }] };
    if (id === 'efervescente') return { A: { species: moleculeSpecies('hidrogenocarbonato'), formula: 'HCO3', coef: 1 }, B: { species: moleculeSpecies('hidronio'), formula: 'H3O', coef: 1 }, P: [{ species: sp('H2O'), formula: 'H2O', coef: 2 }, { species: sp('CO2'), formula: 'CO2', coef: 1, gas: true }] };
    if (id === 'precipitacion') return { A: { species: sp('Na2CO3'), formula: 'Na2CO3', coef: 1 }, B: { species: sp('CaCl2'), formula: 'CaCl2', coef: 1 }, P: [{ species: sp('CaCO3'), formula: 'CaCO3', coef: 1 }, { species: sp('NaCl'), formula: 'NaCl', coef: 2 }] };
    return { A: { species: sp('Fe'), formula: 'Fe', coef: 3 }, B: { species: sp('O2'), formula: 'O2', coef: 2, gas: true }, P: [{ species: sp('Fe3O4'), formula: 'Fe3O4', coef: 1 }] };
  };
  it('el limitante de los paquetes coincide con el del modelo de la práctica', () => {
    for (const r of CONS_REACTIONS) for (const sys of r.systems) for (const m of [r.massRange[0], r.initialMass, r.massRange[1]]) {
      const input = { reaction: r.id, system: sys as SystemId, reactantMass: m, liquidVolume: r.liquid ? r.initialVolume : 0 };
      const [a, b] = reactantAmounts(input);
      const model = simulateConservation(input).limiting;
      expect(limitingReagent(a, b).limiting).toBe(model.limiting);
      if (r.id === 'efervescente') continue; // se dibuja la ecuación iónica neta (otra escala de coeficientes)
      const p = packets(a.moles, a.coef, b.moles, b.coef, 4);
      if (p.limiting !== null) expect([a, b][p.limiting].name).toBe(model.limiting);
    }
  });
  it('sistema cerrado: la masa de adentro no cambia en ningún momento; abierto: baja lo del CO₂ o sube lo del O₂', () => {
    const co2 = ATOMIC_MASS.C + 2 * ATOMIC_MASS.O, o2 = 2 * ATOMIC_MASS.O;
    for (const r of CONS_REACTIONS) {
      const t = terms(r.id);
      const pk = packets(3, t.A.coef, r.id === 'oxidacion' ? Infinity : 2, t.B.coef, 4);
      for (const e of [0, 0.3, 0.7, 1]) {
        const closed = conservationScene(t.A, t.B, t.P, pk, e, true);
        expect(closed.massNow, `${r.id} cerrado ${e}`).toBeCloseTo(closed.massInitial, 9);
        expect(closed.gasOutside).toBe(0);
        const open = conservationScene(t.A, t.B, t.P, pk, e, false);
        const d = open.doneUnits;
        const expected = r.id === 'bicarbonato' || r.id === 'efervescente' ? -d * co2 : r.id === 'oxidacion' ? d * 2 * o2 : 0;
        expect(open.massNow - open.massInitial, `${r.id} abierto ${e}`).toBeCloseTo(expected, 9);
      }
    }
  });
  it('la masa de las partículas es la de las masas atómicas CIAAW de la práctica de balanceo', () => {
    expect(atomsMass(sp('CO2').atoms)).toBeCloseTo(44.009, 3);
    expect(atomsMass(sp('NaHCO3').atoms)).toBeCloseTo(84.006, 3);
  });
});

describe('soluciones: partículas en un volumen fijo y capa de hidratación', () => {
  it('N = c·N_A·V: 1 mol/L en un cubo de 5 nm son 75,3 unidades; al diluir 10 veces, una décima', () => {
    expect(unitsInBox(1)).toBeCloseTo(75.27675950, 6);
    expect(unitsInBox(0.1) / unitsInBox(1)).toBeCloseTo(0.1, 12);
    expect(unitsInBox(0)).toBe(0);
    expect(() => unitsInBox(-1)).toThrow(RangeError);
  });
  it('el cubo dibuja una partícula por ion (NaCl: 2 por unidad) dentro del cubo', () => {
    const s = solutionBoxScene(dissolvedParticles('NaCl')!, 8, 50);
    expect(sceneCounts(s)).toEqual({ Na: 8, Cl: 8 });
    expect(s.atoms.every((a) => Math.abs(a.x) < 25 && Math.abs(a.y) < 25 && Math.abs(a.z) < 25)).toBe(true);
    expect(s.lines).toHaveLength(12);
  });
  it('capa de hidratación: O a la distancia de los radios de Shannon; catión con el O hacia el ion, anión con un H hacia el ion', () => {
    const water = moleculeSpecies('agua');
    expect(ionWaterDistance('Na')).toBeCloseTo(1.02 + 1.36, 9);
    expect(ionWaterDistance('Cl')).toBeCloseTo(1.81 + 1.36, 9);
    for (const [el, q] of [['Na', 1], ['K', 1], ['Cl', -1]] as const) {
      const sh = hydrationShell(water, el, q, 6);
      expect(sh.atoms).toHaveLength(18);
      for (let w = 0; w < 6; w++) {
        const mol = sh.atoms.slice(w * 3, w * 3 + 3);
        const d = (a: { x: number; y: number; z: number }) => Math.hypot(a.x, a.y, a.z);
        const O = mol.find((a) => a.el === 'O')!, H = mol.filter((a) => a.el === 'H');
        expect(d(O)).toBeCloseTo(ionWaterDistance(el), 6);
        if (q > 0) expect(Math.min(...H.map(d))).toBeGreaterThan(d(O));
        else {
          const near = H.reduce((p, c) => (d(c) < d(p) ? c : p));
          expect(d(near)).toBeLessThan(d(O));
          // H alineado entre el O y el ion (puente de hidrógeno lineal)
          const u = [O.x / d(O), O.y / d(O), O.z / d(O)];
          expect((near.x * u[0] + near.y * u[1] + near.z * u[2]) / d(near)).toBeCloseTo(1, 6);
        }
      }
      // la geometría del agua no se deforma (O–H igual que en el confórmero)
      const O0 = water.atoms.find((a) => a.el === 'O')!, H0 = water.atoms.find((a) => a.el === 'H')!;
      const oh = Math.hypot(O0.x - H0.x, O0.y - H0.y, O0.z - H0.z);
      expect(Math.hypot(sh.atoms[0].x - sh.atoms[1].x, sh.atoms[0].y - sh.atoms[1].y, sh.atoms[0].z - sh.atoms[1].z)).toBeCloseTo(oh, 6);
    }
  });
  it('escena de hidratación: capa solo para iones monoatómicos con radio en el kit', () => {
    const water = moleculeSpecies('agua');
    const has = (s: { atoms: { el: string }[] }) => s.atoms.length === 1 && ['Na', 'K', 'Cl'].includes(s.atoms[0].el);
    expect(hydrationScene(dissolvedParticles('NaCl')!, water, has).shells).toBe(2);
    expect(hydrationScene(dissolvedParticles('KMnO4')!, water, has).shells).toBe(1);
    expect(hydrationScene(dissolvedParticles('CuSO4·5H2O')!, water, has).shells).toBe(0);
  });
});

describe('proteínas: del codón al residuo de la estructura incluida', () => {
  const struct = (file: string) => parseStructure(readFileSync(new URL(`../../src/data/proteinas/${file}`, import.meta.url), 'utf8'));
  const oneAt = (s: ReturnType<typeof struct>, chain: string, resSeq: number) => {
    const r = s.residues.find((x) => x.chain === chain && x.resSeq === resSeq && x.polymer);
    return r ? PROT_AA[r.resName]?.one ?? '?' : null;
  };
  it('HBB: el codón c es el residuo β(c − 1) de 2HHB en las cadenas B y D (la Met se retira)', () => {
    const s = struct('2HHB.cif');
    const prot = expressGene(null).protein.replace(/\*$/, '');
    expect(prot).toHaveLength(147);
    for (let c = 2; c <= 147; c++) {
      const r = hbbResidue(c);
      if (!('chains' in r)) throw new Error(`codón ${c}`);
      for (const ch of r.chains) expect(oneAt(s, ch, r.resSeq), `codón ${c} → ${ch}${r.resSeq}`).toBe(prot[c - 1]);
    }
    expect(hbbResidue(1)).toHaveProperty('missing');
    expect(hbbResidue(7)).toEqual({ chains: ['B', 'D'], resSeq: 6 });
  });
  it('INS: cadena B = codones 25–54 y cadena A = 90–110 de la preproinsulina (3I40)', () => {
    const s = struct('3I40.cif');
    const prot = GENES.find((g) => g.key === 'INS')!.protein.sequence;
    for (let c = 1; c <= prot.length; c++) {
      const r = insResidue(c);
      // B30: el archivo declara Ala en lugar de Thr (_struct_ref_seq_dif, «SEE REMARK 999»); está en INS_SEQ_DIFF.
      if ('chains' in r) expect(oneAt(s, r.chains[0], r.resSeq), `codón ${c}`).toBe(c === 54 ? 'A' : prot[c - 1]);
    }
    expect(prot[53]).toBe('T');
    expect(INS_SEQ_DIFF).toEqual([{ chain: 'B', resSeq: 30, note: expect.stringContaining('Ala') }]);
    expect(insResidue(10)).toHaveProperty('missing');
    expect(insResidue(70)).toHaveProperty('missing');
  });
  it('OCA2: el modelo de AlphaFold numera como UniProt (838 residuos)', () => {
    const s = struct('AF-Q04671-F1-model_v6.cif');
    const prot = GENES.find((g) => g.key === 'OCA2')!.protein.sequence;
    expect(prot).toHaveLength(838);
    for (let c = 1; c <= 838; c += 37) { const r = oca2Residue(c) as { chains: string[]; resSeq: number }; expect(oneAt(s, 'A', r.resSeq)).toBe(prot[c - 1]); }
  });
  it('LCT y lacZ no tienen estructura en el repositorio', () => {
    expect(GENE_STRUCTURES.LCT).toBeNull();
    expect(GENE_STRUCTURES.lacZ).toBeNull();
    for (const g of GENES) expect(g.key in GENE_STRUCTURES, g.key).toBe(true);
  });
  it('expresión: la anemia falciforme marca β6 Glu→Val en las dos cadenas β; una sin sentido atenúa lo que sigue', () => {
    const wild = expressGene(null).protein.replace(/\*$/, '');
    const a = analyzeGeneMutation({ kind: 'sustitucion', position: CDS_START + 19, base: 'T' });
    const m = proteinMarks(GENE_STRUCTURES.HBB!, wild, a.mutant.protein.replace(/\*$/, ''), a.location.codon, three, 'β');
    expect(m.marks).toEqual([{ chain: 'B', resSeq: 6, label: 'β6 Glu→Val' }, { chain: 'D', resSeq: 6, label: 'β6 Glu→Val' }]);
    expect(m.fadedFrom).toEqual([]);
    // Codón 7 GAG → TAG: terminación prematura.
    const n = analyzeGeneMutation({ kind: 'sustitucion', position: CDS_START + 18, base: 'T' });
    expect(n.cls).toBe('sin-sentido');
    const mn = proteinMarks(GENE_STRUCTURES.HBB!, wild, n.mutant.protein.replace(/\*$/, ''), n.location.codon, three, 'β');
    expect(mn.fadedFrom).toEqual([{ chain: 'B', resSeq: 6 }, { chain: 'D', resSeq: 6 }]);
    expect(mn.marks[0].label).toBe('β6: aquí termina');
    // Sin mutación: se marca el codón elegido.
    expect(proteinMarks(GENE_STRUCTURES.HBB!, wild, null, 7, three, 'β').marks.map((x) => x.label)).toEqual(['β6 Glu', 'β6 Glu']);
  });
  it('rastreo: las variantes calculadas se marcan en su residuo', () => {
    const HBB = GENES.find((g) => g.key === 'HBB')!;
    const v = variantConsequence(HBB, singleBaseVariant(HBB, { geneKey: 'HBB', kind: 'sustitucion', position: 20, base: 'T' }));
    expect(v.consequence).toBe('sentido-erroneo');
    expect(variantMarks(GENE_STRUCTURES.HBB!, v, three, 'β').marks).toEqual([{ chain: 'B', resSeq: 6, label: 'β6 Glu→Val' }, { chain: 'D', resSeq: 6, label: 'β6 Glu→Val' }]);
    const stop = variantConsequence(HBB, singleBaseVariant(HBB, { geneKey: 'HBB', kind: 'sustitucion', position: 47, base: 'A' }));
    expect(variantMarks(GENE_STRUCTURES.HBB!, stop, three, 'β').fadedFrom.length).toBe(2);
    expect(variantMarks(GENE_STRUCTURES.HBB!, null, three).marks).toEqual([]);
  });
});

describe('enzimas', () => {
  it('la fracción nativa es el término de desnaturalización del modelo (sin cambiar f_T)', () => {
    for (const e of ENZYMES) {
      expect(nativeFraction(e, e.tm)).toBeCloseTo(0.5, 12);
      expect(temperatureFactor(e, T_REF)).toBeCloseTo(1, 12);
      expect(nativeFraction(e, 80)).toBeLessThan(0.01);
    }
  });
  it('el sitio activo de 2LZM son Glu11 y Asp20 de la cadena A', () => {
    const s = parseStructure(readFileSync(new URL('../../src/data/proteinas/2LZM.cif', import.meta.url), 'utf8'));
    const res = (n: number) => s.residues.find((r) => r.chain === 'A' && r.resSeq === n)!.resName;
    expect([res(11), res(20)]).toEqual(['GLU', 'ASP']);
  });
});

describe('escenas: integridad', () => {
  it('lo atenuado mezcla el color con el fondo (sin transparencia de WebGL)', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#e0322b', '#ffffff', 0)).toBe('#e0322b');
    expect(mixHex('#e0322b', '#141c28', 1)).toBe('#141c28');
  });
  it('buildScene traslada sin deformar y cuenta copias', () => {
    const w = moleculeSpecies('agua');
    const s = buildScene([{ species: w, count: 5, center: [3, -2, 1] }]);
    expect(sceneCounts(s)).toEqual({ O: 5, H: 10 });
    expect(s.bonds).toHaveLength(10);
  });
});

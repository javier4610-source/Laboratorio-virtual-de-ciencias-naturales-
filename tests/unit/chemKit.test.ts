import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseSdf } from '../../src/models/geometry';
import { covalentBondLength } from '../../src/chem/elements';
import { getMolecule, MOLECULES, moleculeSpecies, atomSpecies, WITHOUT_GEOMETRY } from '../../src/chem/molecules';
import { PUBCHEM_RECORDS } from '../../src/data/quimica/molecules3d';
import { atomAngle, atomDistance, buildVsepr, elementCounts, hillFormulaOf, PUBCHEM_GEOMETRY_LABEL, speciesFromSdf, toSdf } from '../../src/chem/species';
import {
  calculatedDensity, cationAnionDistance, coordinationNumber, coordinationShell, CRYSTALS, densityDeviation, generateLattice, getCrystal, latticeFragment, shannonSum,
} from '../../src/chem/crystal';
import { bondChanges, buildReactionScene, checkBalanced, countsAt, equationText, frameBonds, framePositions, REACTION3D_LABEL, STEPS, type Reaction3DDef } from '../../src/chem/reactionScene';

const TETRA = (Math.acos(-1 / 3) * 180) / Math.PI;

describe('kit de química 3D · biblioteca de moléculas', () => {
  it('cada SDF de PubChem conserva su SHA-256, se lee con parseSdf y su fórmula de Hill coincide con la de PubChem', () => {
    expect(PUBCHEM_RECORDS.length).toBeGreaterThanOrEqual(30);
    for (const r of PUBCHEM_RECORDS) {
      expect(createHash('sha256').update(r.sdf).digest('hex'), r.id).toBe(r.sha256);
      const m = parseSdf(r.sdf);
      expect(m.is3D, r.id).toBe(true);
      expect(Number(m.props.PUBCHEM_COMPOUND_CID), r.id).toBe(r.cid);
      expect(hillFormulaOf(m.atoms.map((a) => ({ el: a.element }))), r.id).toBe(r.formula);
      expect(r.url).toBe(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${r.cid}/SDF?record_type=3d`);
    }
  });

  it('formato común y rótulos: las de PubChem dicen «Modelo calculado: confórmero 3D de PubChem (MMFF94s)»', () => {
    const ids = new Set<string>();
    for (const m of MOLECULES) {
      expect(ids.has(m.id), m.id).toBe(false); ids.add(m.id);
      expect(m.nombre && m.formula && m.smiles && m.sdf, m.id).toBeTruthy();
      expect(m.geometria.startsWith('Modelo calculado'), m.id).toBe(true);
      if (m.fuente) expect(m.geometria).toBe(PUBCHEM_GEOMETRY_LABEL);
      expect(() => parseSdf(m.sdf), m.id).not.toThrow();
    }
    expect(getMolecule('h2so4').cid).toBe(1118);
    expect(getMolecule('sulfato').fuente).toBeNull();
    // Cl₂O₇ no tiene confórmero 3D ni geometría del kit (enlace puente): se informa sin dibujarla.
    expect(WITHOUT_GEOMETRY.map((m) => m.id)).toContain('cl2o7');
  });

  it('el confórmero de agua de PubChem da O–H ≈ 0,96 Å y el de metano ángulos tetraédricos', () => {
    const w = moleculeSpecies('agua');
    expect(atomDistance(w, 0, 1)).toBeCloseTo(0.96, 1);
    const m = moleculeSpecies('metano');
    expect(atomAngle(m, 1, 0, 2)).toBeCloseTo(TETRA, 0);
  });

  it('VSEPR del kit: sulfato tetraédrico con S–O = r(S)+r(O) dobles; nitrato plano a 120°; amonio tetraédrico', () => {
    const s = moleculeSpecies('sulfato');
    expect(s.charge).toBe(-2);
    for (let i = 1; i <= 4; i++) expect(atomDistance(s, 0, i)).toBeCloseTo(0.94 + 0.57, 3);
    expect(atomAngle(s, 1, 0, 2)).toBeCloseTo(TETRA, 2);
    const n = moleculeSpecies('nitrato');
    expect(n.charge).toBe(-1);
    expect(atomAngle(n, 1, 0, 2)).toBeCloseTo(120, 2);
    expect(atomDistance(n, 0, 1)).toBeCloseTo((0.71 + 0.63 + 0.6 + 0.57) / 2, 3);
    const am = moleculeSpecies('amonio');
    expect(am.charge).toBe(1);
    expect(atomAngle(am, 1, 0, 3)).toBeCloseTo(TETRA, 2);
    // HClO₄: el H del grupo O–H forma 109,47° con el enlace Cl–O.
    const p = moleculeSpecies('hclo4');
    expect(elementCounts(p.atoms)).toEqual({ Cl: 1, O: 4, H: 1 });
    expect(atomAngle(p, 0, 4, 5)).toBeCloseTo(109.47, 1);
  });

  it('toSdf → parseSdf conserva átomos, enlaces y cargas', () => {
    const s = buildVsepr({ id: 'x', name: 'fosfato', label: 'PO₄³⁻', center: 'P', ligands: [{ el: 'O', order: 2 }, { el: 'O', order: 1, charge: -1 }, { el: 'O', order: 1, charge: -1 }, { el: 'O', order: 1, charge: -1 }], lonePairs: 0 });
    const back = speciesFromSdf(toSdf(s), { ...s });
    expect(back.atoms.length).toBe(5);
    expect(back.charge).toBe(-3);
    expect(back.bonds.map((b) => b.order)).toEqual([2, 1, 1, 1]);
    for (let i = 0; i < 5; i++) expect(back.atoms[i].x).toBeCloseTo(s.atoms[i].x, 4);
  });

  it('no inventa radios: un enlace sin radio tabulado lanza un error', () => {
    expect(() => covalentBondLength('Fr', 'O', 3)).toThrow(/Pyykkö/);
  });
});

describe('kit de química 3D · redes cristalinas', () => {
  it('NaCl (halita, a = 5,6402 Å): Na–Cl = a/2, coordinación 6:6 y densidad calculada ≈ publicada (2,17 g/cm³)', () => {
    const c = getCrystal('nacl');
    expect(cationAnionDistance(c)).toBeCloseTo(c.a / 2, 10);
    expect(coordinationNumber(c, 'cation')).toBe(6);
    expect(coordinationNumber(c, 'anion')).toBe(6);
    // ρ = 4 · 58,44 / (6,02214076e23 · (5,6402e-8 cm)³) = 2,1635 g/cm³
    expect(calculatedDensity(c)).toBeCloseTo(2.1635, 3);
    expect(Math.abs(densityDeviation(c))).toBeLessThan(1);
    // La suma de radios de Shannon (1,02 + 1,81 = 2,83 Å) coincide con a/2 = 2,820 Å dentro de 0,02 Å.
    expect(Math.abs(shannonSum(c) - c.a / 2)).toBeLessThan(0.02);
  });

  it('fluorita CaF₂: coordinación 8 (Ca) y 4 (F), Ca–F = a·√3/4; CsCl: 8:8 con Cs–Cl = a·√3/2', () => {
    const f = getCrystal('caf2');
    expect(coordinationNumber(f, 'cation')).toBe(8);
    expect(coordinationNumber(f, 'anion')).toBe(4);
    expect(cationAnionDistance(f)).toBeCloseTo((f.a * Math.sqrt(3)) / 4, 10);
    const cs = getCrystal('cscl');
    expect(coordinationNumber(cs, 'cation')).toBe(8);
    expect(cationAnionDistance(cs)).toBeCloseTo((cs.a * Math.sqrt(3)) / 2, 10);
  });

  it('todas las densidades calculadas están a menos de 1,5 % de las publicadas', () => {
    for (const c of CRYSTALS) expect(Math.abs(densityDeviation(c)), `${c.id}: ${calculatedDensity(c)}`).toBeLessThan(1.5);
  });

  it('la celda unidad de NaCl dibujada tiene 27 iones (14 Na⁺ y 13 Cl⁻) y 4 unidades fórmula netas', () => {
    const ions = generateLattice(getCrystal('nacl'), 1);
    expect(ions.length).toBe(27);
    expect(ions.filter((i) => i.el === 'Na').length).toBe(14);
    // Conteo por fracciones (vértice 1/8, arista 1/4, cara 1/2, interior 1).
    const share = (f: number[]) => f.reduce((p, v) => p * (v === 0 || v === 1 ? 0.5 : 1), 1);
    const na = ions.filter((i) => i.el === 'Na').reduce((s, i) => s + share(i.f), 0);
    const cl = ions.filter((i) => i.el === 'Cl').reduce((s, i) => s + share(i.f), 0);
    expect(na).toBeCloseTo(4, 10); expect(cl).toBeCloseTo(4, 10);
    const center = ions.findIndex((i) => i.f.every((v) => v === 0.5));
    expect(coordinationShell(ions, center)).toHaveLength(6);
  });

  it('el fragmento de red tiene la estequiometría pedida y es neutro', () => {
    const f = latticeFragment(getCrystal('mgo'), 2);
    expect(elementCounts(f.atoms)).toEqual({ Mg: 2, O: 2 });
    expect(f.charge).toBe(0);
    const g = latticeFragment(getCrystal('caf2'), 1);
    expect(elementCounts(g.atoms)).toEqual({ Ca: 1, F: 2 });
  });

  it('valida el tamaño del bloque', () => {
    expect(() => generateLattice(getCrystal('nacl'), 0)).toThrow();
    expect(() => generateLattice(getCrystal('nacl'), 5)).toThrow();
  });
});

describe('kit de química 3D · reacción en 3D', () => {
  const agua: Reaction3DDef = {
    id: 'agua', title: 'Síntesis del agua',
    reactants: [{ species: moleculeSpecies('hidrogeno'), coef: 2, formula: 'H2' }, { species: moleculeSpecies('oxigeno'), coef: 1, formula: 'O2' }],
    products: [{ species: moleculeSpecies('agua'), coef: 2, formula: 'H2O' }],
  };

  it('ecuación balanceada sincronizada con el texto y rótulo obligatorio', () => {
    expect(equationText(agua)).toBe('2 H₂ + O₂ → 2 H₂O');
    expect(checkBalanced(agua).balanced).toBe(true);
    expect(REACTION3D_LABEL).toBe('Ilustración educativa: interpolación entre geometrías calculadas de reactivos y productos; no representa el mecanismo ni la trayectoria real de la reacción');
    expect(STEPS.map((s) => s.t)).toEqual([0, 0.3, 0.5, 0.7, 1]);
  });

  it('el mapeo es una biyección que respeta los elementos y conserva el conteo en todo t', () => {
    const s = buildReactionScene(agua);
    expect(new Set(s.mapping).size).toBe(s.atoms.length);
    expect(s.atoms.length).toBe(6);
    for (const t of [0, 0.1, 0.3, 0.42, 0.5, 0.7, 0.9, 1]) {
      expect(countsAt(s, t)).toEqual({ H: 4, O: 2 });
      expect(framePositions(s, t)).toHaveLength(6);
      for (const p of framePositions(s, t)) expect(p.every(Number.isFinite)).toBe(true);
    }
    // 2 H–H y 1 O=O se rompen; se forman 4 O–H.
    expect(bondChanges(s)).toEqual({ broken: 3, formed: 4, kept: 0 });
  });

  it('en t = 0 y t = 1 las geometrías internas son exactamente las de partida (traslación rígida)', () => {
    const s = buildReactionScene(agua);
    const p0 = framePositions(s, 0), p1 = framePositions(s, 1);
    const w = moleculeSpecies('agua');
    const oh = atomDistance(w, 0, 1);
    // En t = 0 cada H₂ conserva su distancia H–H; en t = 1 cada agua su O–H (SDF con 4 decimales: tolerancia 10⁻³ Å).
    const dist = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    for (const b of s.rBonds) expect(dist(p0[b.a], p0[b.b])).toBeCloseTo(atomDistance(s.def.reactants[s.atoms[b.a].el === 'H' ? 0 : 1].species, 0, 1), 6);
    for (const b of s.pBonds) expect(dist(p1[b.a], p1[b.b])).toBeCloseTo(oh, 3);
    // Opacidades: al inicio solo enlaces de reactivos; al final solo de productos.
    expect(frameBonds(s, 0).every((b) => b.side === 'r')).toBe(true);
    expect(frameBonds(s, 1).every((b) => b.side === 'p')).toBe(true);
    expect(frameBonds(s, 1)).toHaveLength(4);
  });

  it('combustión del metano con fragmentos de PubChem: 1 C, 4 H, 4 O conservados y un mapeo explícito inválido se rechaza', () => {
    const def: Reaction3DDef = {
      id: 'metano', title: 'Combustión del metano',
      reactants: [{ species: moleculeSpecies('metano'), coef: 1, formula: 'CH4' }, { species: moleculeSpecies('oxigeno'), coef: 2, formula: 'O2' }],
      products: [{ species: moleculeSpecies('co2'), coef: 1, formula: 'CO2' }, { species: moleculeSpecies('agua'), coef: 2, formula: 'H2O' }],
    };
    const s = buildReactionScene(def);
    expect(s.counts).toEqual({ C: 1, H: 4, O: 4 });
    expect(equationText(def)).toBe('CH₄ + 2 O₂ → CO₂ + 2 H₂O');
    expect(() => buildReactionScene({ ...def, mapping: [0, 0, 1, 2, 3, 4, 5, 6, 7] })).toThrow(/biyección/);
  });

  it('sólido iónico como fragmento de red: 2 Mg + O₂ → 2 MgO', () => {
    const def: Reaction3DDef = {
      id: 'mgo', title: 'Combustión del magnesio',
      reactants: [{ species: atomSpecies('Mg', 'magnesio'), coef: 2, formula: 'Mg' }, { species: moleculeSpecies('oxigeno'), coef: 1, formula: 'O2' }],
      products: [{ species: latticeFragment(getCrystal('mgo'), 2), coef: 2, formula: 'MgO', perInstance: 2 }],
    };
    const s = buildReactionScene(def);
    expect(s.counts).toEqual({ Mg: 2, O: 2 });
    expect(s.pInstances).toHaveLength(1);
  });

  it('rechaza ecuaciones no balanceadas y especies que no coinciden con su fórmula', () => {
    const bad: Reaction3DDef = { ...agua, products: [{ species: moleculeSpecies('agua'), coef: 1, formula: 'H2O' }] };
    expect(checkBalanced(bad).balanced).toBe(false);
    expect(() => buildReactionScene(bad)).toThrow(/no se conservan/);
    expect(() => buildReactionScene({ ...agua, products: [{ species: moleculeSpecies('agua'), coef: 2, formula: 'H2O2' }] })).toThrow(/no tiene los átomos/);
  });
});

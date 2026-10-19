/**
 * Pruebas de los modelos de hidrocarburos y aromáticos y de la integridad de sus datos (PubChem).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ORGANIC_RECORDS, getOrganic } from '../../src/data/quimica/organica';
import { orgSpecies } from '../../src/data/quimica/organicaSpecies';
import {
  angleDeg, balanceCombustion, bondSummary, butaneConformation, carbonCount, combustionAtomBalance, combustionEnergy, combustionEquation,
  dihedralDeg, dist, ethaneConformation, hydrogenCount, liquidDensity, measureConformer, monohalogenation, phaseAt25, rotateAboutBond, SERIES,
  addToMultipleBond, unsaturationTest, type CombustionKind,
} from '../../src/models/hydrocarbons';
import { delocalizationEnergy, huckelAnalysis, orthoMetaPara, piEnergy, planarity, symmetricEigenvalues } from '../../src/models/aromaticity';
import { molFromMolfile, parseSmiles, stripHydrogens } from '../../src/models/organicGraph';
import { nameMolecule } from '../../src/models/organicNomenclature';

const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b), `${a} ≈ ${b}`).toBeLessThanOrEqual(tol);
const xyzOf = (id: string) => { const s = orgSpecies(id); return { atoms: s.atoms, bonds: s.bonds }; };

describe('datos de PubChem (integridad)', () => {
  it('cada SDF guardado coincide con su SHA-256 y es un registro 3D de su CID', () => {
    for (const r of ORGANIC_RECORDS) {
      if (!r.sdf) continue;
      expect(createHash('sha256').update(r.sdf).digest('hex'), r.id).toBe(r.sha256);
      expect(r.sdf.startsWith(String(r.cid)), r.id).toBe(true);
      expect(r.url).toBe(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${r.cid}/SDF?record_type=3d`);
    }
  });
  it('los 74 registros tienen confórmero 3D y propiedades con su fuente', () => {
    expect(ORGANIC_RECORDS.length).toBe(74);
    expect(ORGANIC_RECORDS.every((r) => r.sdf)).toBe(true);
    for (const r of ORGANIC_RECORDS) for (const p of Object.values(r.propiedades)) if (p) { expect(p.texto.length).toBeGreaterThan(0); expect(p.url).toMatch(/pug_view/); }
  });
  it('valores de referencia literales (CRC Handbook vía HSDB): Tₑb del pentano 36,06 °C, del metano −161,5 °C; ΔcH° del metano 890,8 kJ/mol', () => {
    expect(getOrganic('pentano').propiedades.tEb?.valor).toBe(36.06);
    expect(getOrganic('pentano').propiedades.tEb?.cita).toMatch(/CRC Handbook/);
    expect(getOrganic('metano').propiedades.tEb?.valor).toBe(-161.5);
    expect(getOrganic('metano').propiedades.dHc?.valor).toBe(890.8);
  });
  it('Tₑb de los alcanos C1–C10 crece con n y la ramificación la baja (pentano > 2-metilbutano > 2,2-dimetilpropano)', () => {
    const t = SERIES.alcano.map((id) => getOrganic(id).propiedades.tEb!.valor);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    const p = ['pentano', 'isopentano', 'neopentano'].map((id) => getOrganic(id).propiedades.tEb!.valor);
    expect(p[0]).toBeGreaterThan(p[1]); expect(p[1]).toBeGreaterThan(p[2]);
    expect(getOrganic('cis-but-2-eno').propiedades.tEb!.valor).toBeGreaterThan(getOrganic('trans-but-2-eno').propiedades.tEb!.valor);
    expect(getOrganic('trans-but-2-eno').propiedades.tFus!.valor).toBeGreaterThan(getOrganic('cis-but-2-eno').propiedades.tFus!.valor);
  });
  it('la densidad solo se compara entre líquidos a 15–30 °C y 1 atm', () => {
    expect(liquidDensity(getOrganic('metano')).ok).toBeNull(); // relativa al aire
    expect(liquidDensity(getOrganic('butano')).ok).toBeNull(); // a presión
    expect(liquidDensity(getOrganic('propano')).ok).toBeNull(); // hierve a −42 °C
    expect(liquidDensity(getOrganic('pentano')).ok?.value).toBe(0.6262);
    expect(phaseAt25(getOrganic('pentano'))).toBe('líquido');
    expect(phaseAt25(getOrganic('naftaleno'))).toBe('sólido');
  });
});

describe('combustión', () => {
  it('balanceo con enteros mínimos y conservación de átomos (C1–C10, tres tipos)', () => {
    expect(combustionEquation('CH₄', 1, 4, 'completa')).toBe('CH₄ + 2 O₂ → CO₂ + 2 H₂O');
    expect(combustionEquation('C₂H₆', 2, 6, 'completa')).toBe('2 C₂H₆ + 7 O₂ → 4 CO₂ + 6 H₂O');
    expect(combustionEquation('C₃H₈', 3, 8, 'co')).toBe('2 C₃H₈ + 7 O₂ → 6 CO + 8 H₂O');
    expect(combustionEquation('CH₄', 1, 4, 'hollin')).toBe('CH₄ + O₂ → C + 2 H₂O');
    for (const fam of Object.values(SERIES)) for (const id of fam) {
      const r = getOrganic(id);
      for (const k of ['completa', 'co', 'hollin'] as CombustionKind[]) {
        const bal = combustionAtomBalance(carbonCount(r), hydrogenCount(r), k);
        for (const [el, [a, b]] of Object.entries(bal)) expect(a, `${id} ${k} ${el}`).toBe(b);
        const c = balanceCombustion(carbonCount(r), hydrogenCount(r), k);
        expect(Object.values(c).every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
      }
    }
  });
  it('metano: 890,8 kJ/mol → 55,5 kJ/g y 49,4 g CO₂/MJ; el decano libera menos energía por gramo pero más por mol', () => {
    const e = combustionEnergy(getOrganic('metano'))!;
    close(e.kJg, 890.8 / 16.043, 1e-9); close(e.kJg, 55.53, 0.01); close(e.gCO2perMJ, 49.40, 0.01);
    const d = combustionEnergy(getOrganic('decano'))!;
    expect(d.kJmol).toBeGreaterThan(e.kJmol); expect(d.kJg).toBeLessThan(e.kJg);
    expect(combustionEnergy(getOrganic('etano'))).toBeNull(); // sin dato con fuente estándar: «Sin información»
  });
});

describe('geometría medida sobre los confórmeros de PubChem (modelo calculado)', () => {
  it('C–C, C=C y C≡C se acortan; ángulos ≈ 109,5°, 120° y 180°', () => {
    const e = xyzOf('etano'), en = xyzOf('eteno'), y = xyzOf('etino'), m = xyzOf('metano');
    const cc = (s: { atoms: { el: string }[]; bonds: { a: number; b: number; order: number }[] }) => s.bonds.filter((b) => s.atoms[b.a].el === 'C' && s.atoms[b.b].el === 'C');
    const L = (s: typeof e) => dist(s.atoms[cc(s)[0].a], s.atoms[cc(s)[0].b]);
    expect(L(e)).toBeGreaterThan(1.48); expect(L(e)).toBeLessThan(1.56);
    expect(L(en)).toBeGreaterThan(1.30); expect(L(en)).toBeLessThan(1.36);
    expect(L(y)).toBeGreaterThan(1.17); expect(L(y)).toBeLessThan(1.23);
    const ang = measureConformer(m.atoms, m.bonds).angles;
    for (const a of ang) close(a.angle, 109.47, 0.6);
    const yA = measureConformer(y.atoms, y.bonds).angles;
    for (const a of yA) close(a.angle, 180, 0.6);
    const s = bondSummary(measureConformer(en.atoms, en.bonds).bonds);
    expect(s.map((x) => x.kind).sort()).toEqual(['C=C', 'C–H']);
  });
  it('rotación rígida: conserva las distancias de enlace y cambia el diedro exactamente lo girado', () => {
    const e = xyzOf('etano');
    const c = e.atoms.map((a, i) => (a.el === 'C' ? i : -1)).filter((i) => i >= 0);
    const hA = e.bonds.find((b) => (b.a === c[0] && e.atoms[b.b].el === 'H') || (b.b === c[0] && e.atoms[b.a].el === 'H'))!;
    const hB = e.bonds.find((b) => (b.a === c[1] && e.atoms[b.b].el === 'H') || (b.b === c[1] && e.atoms[b.a].el === 'H'))!;
    const h1 = hA.a === c[0] ? hA.b : hA.a, h2 = hB.a === c[1] ? hB.b : hB.a;
    const d0 = dihedralDeg(e.atoms[h1], e.atoms[c[0]], e.atoms[c[1]], e.atoms[h2]);
    const rot = rotateAboutBond(e.atoms, e.bonds, c[0], c[1], 37);
    for (const b of e.bonds) close(dist(rot[b.a], rot[b.b]), dist(e.atoms[b.a], e.atoms[b.b]), 1e-9);
    const d1 = dihedralDeg(rot[h1], rot[c[0]], rot[c[1]], rot[h2]);
    close(Math.abs(((d1 - d0 + 540) % 360) - 180), 37, 1e-6);
    expect(ethaneConformation(60)).toBe('alternada');
    expect(ethaneConformation(0)).toBe('eclipsada');
    expect(butaneConformation(180)).toMatch(/^anti/);
    expect(butaneConformation(-60)).toMatch(/^gauche/);
    close(angleDeg({ el: 'H', x: 1, y: 0, z: 0 }, { el: 'C', x: 0, y: 0, z: 0 }, { el: 'H', x: 0, y: 1, z: 0 }), 90, 1e-12);
  });
});

describe('reacciones', () => {
  it('halogenación estadística: propano 75/25, butano 60/40, 2-metilpropano 90/10, con nombres del motor', () => {
    const p = monohalogenation('CCC', 'Cl');
    expect(p.map((x) => [x.nombre, Math.round(x.percent)])).toEqual([['1-cloropropano', 75], ['2-cloropropano', 25]]);
    expect(monohalogenation('CCCC', 'Cl').map((x) => Math.round(x.percent))).toEqual([60, 40]);
    expect(monohalogenation('CC(C)C', 'Br').map((x) => [x.nombre, Math.round(x.percent)])).toEqual([['1-bromo-2-metilpropano', 90], ['2-bromo-2-metilpropano', 10]]);
    expect(monohalogenation('C', 'Cl')[0].nombre).toBe('clorometano');
  });
  it('adición: eteno + Br₂ → 1,2-dibromoetano; propeno + HBr → 2-bromopropano (Markovnikov); etino + H₂ → eteno', () => {
    const nm = (smi: string, r: Parameters<typeof addToMultipleBond>[1]) => { const x = addToMultipleBond(parseSmiles(smi), r)!; const n = nameMolecule(x.product); return n.ok ? n.es : ''; };
    expect(nm('C=C', 'Br2')).toBe('1,2-dibromoetano');
    expect(nm('CC=C', 'HBr')).toBe('2-bromopropano');
    expect(nm('C#C', 'H2')).toBe('eteno');
    expect(nm('CC=CC', 'H2')).toBe('butano');
    expect(addToMultipleBond(parseSmiles('CC'), 'H2')).toBeNull();
  });
  it('pruebas de insaturación: positivas con C=C/C≡C; negativas con alcanos y benceno', () => {
    expect(unsaturationTest(parseSmiles('C=C'), 'bromo').positive).toBe(true);
    expect(unsaturationTest(parseSmiles('C#C'), 'permanganato').positive).toBe(true);
    expect(unsaturationTest(parseSmiles('CCCCCC'), 'bromo').positive).toBe(false);
    expect(unsaturationTest(parseSmiles('c1ccccc1'), 'bromo').positive).toBe(false);
    expect(unsaturationTest(parseSmiles('C=Cc1ccccc1'), 'bromo').positive).toBe(true);
    expect(unsaturationTest(parseSmiles('C1CCC=CC1'), 'permanganato').positive).toBe(true);
  });
});

describe('aromaticidad (Hückel)', () => {
  const ev = (smi: string) => { const m = parseSmiles(smi); return symmetricEigenvalues(m.atoms.map((_, i) => m.atoms.map((__, j) => (m.bonds.some((b) => (b.a === i && b.b === j) || (b.a === j && b.b === i)) ? 1 : 0)))); };
  it('valores propios HMO de referencia (Hückel)', () => {
    ev('c1ccccc1').forEach((x, i) => close(x, [2, 1, 1, -1, -1, -2][i], 1e-9));
    ev('C1=CC=C1').forEach((x, i) => close(x, [2, 0, 0, -2][i], 1e-9));
    const nap = ev('c1ccc2ccccc2c1');
    close(nap[4], (Math.sqrt(5) - 1) / 2, 1e-9); // HOMO del naftaleno: 0,618β
    const benz = huckelAnalysis(parseSmiles('c1ccccc1'));
    close(piEnergy(benz.levels!), 8, 1e-9); close(delocalizationEnergy(benz.levels!, 6), 2, 1e-9);
  });
  it('veredictos con planaridad medida sobre los confórmeros de PubChem', () => {
    const verdict = (id: string) => {
      const { mol, xyz } = molFromMolfile(getOrganic(id).sdf!);
      const { mol: heavy, index } = stripHydrogens(mol);
      const a = huckelAnalysis(heavy, index.map((k) => ({ x: xyz[k][0], y: xyz[k][1], z: xyz[k][2] })));
      return [a.piElectrons, a.verdict, a.planar, a.electronic, a.planarity?.max];
    };
    const v3 = (id: string) => verdict(id).slice(0, 3);
    expect(v3('benceno')).toEqual([6, 'aromático', true]);
    expect(v3('ciclobutadieno')).toEqual([4, 'antiaromático', true]);
    expect(v3('ciclooctatetraeno')).toEqual([8, 'no aromático', false]);
    expect(v3('ciclopentadienuro')).toEqual([6, 'aromático', true]);
    // Límite del confórmero: PubChem (MMFF94s, con la carga en un solo carbono) da un anillo de C₇H₇⁺ NO plano; el conteo
    // electrónico (6 e⁻ π) predice aromático. El laboratorio muestra ambos y lo discute.
    const t = verdict('tropilio');
    expect(t.slice(0, 4)).toEqual([6, 'no aromático', false, 'aromático']);
    console.log('[aromaticidad] desviación máxima del plano del C₇H₇⁺ (PubChem):', t[4]);
    expect(v3('ciclopentadieno')).toEqual([null, 'no aromático', true]);
    expect(v3('piridina')).toEqual([6, 'aromático', true]);
    expect(v3('pirrol')).toEqual([6, 'aromático', true]);
    expect(v3('furano')).toEqual([6, 'aromático', true]);
    expect(v3('naftaleno')).toEqual([10, 'aromático', true]);
  });
  it('benceno: seis C–C iguales (± 0,01 Å) entre el C–C y el C=C del ciclohexeno; planaridad de un plano exacto = 0', () => {
    const b = xyzOf('benceno');
    const cc = measureConformer(b.atoms, b.bonds).bonds.filter((x) => x.kind.startsWith('C') && !x.kind.endsWith('H'));
    expect(cc.length).toBe(6);
    const L = cc.map((x) => x.length);
    expect(Math.max(...L) - Math.min(...L)).toBeLessThan(0.01);
    const hx = xyzOf('ciclohexeno');
    const s = bondSummary(measureConformer(hx.atoms, hx.bonds).bonds);
    const single = s.find((x) => x.kind === 'C–C')!, dbl = s.find((x) => x.kind === 'C=C')!;
    expect(L[0]).toBeGreaterThan(dbl.mean); expect(L[0]).toBeLessThan(single.min);
    expect(planarity([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }]).max).toBeLessThan(1e-9);
    expect(orthoMetaPara(1, 2)).toBe('orto'); expect(orthoMetaPara(1, 3)).toBe('meta'); expect(orthoMetaPara(1, 4)).toBe('para');
  });
});

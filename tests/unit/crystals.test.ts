import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bridgeAngles, calculatedDensity, cationAnionDistance, cellContent, cellVolume, coordinationNumber, CRYSTALS, CRYSTALS_NOT_INCLUDED, crystalForComposition,
  densityDeviation, expandSites, generateLattice, getCrystal, latticeFragment, networkBonds, parseSymop, shannonSum, shellDistances, structureSites,
} from '../../src/chem/crystal';
import { hasIonicSpecies } from '../../src/chem/species';

/**
 * Redes cristalinas del kit (src/chem/crystal.ts) generadas a partir de estructuras PUBLICADAS: distancias,
 * coordinación y densidad calculada frente a la densidad publicada (src/data/quimica/cristales-pubchem.json, descargado
 * de PubChem por scripts/validacion/cristales_pubchem.mjs con la fuente original de cada valor).
 */
interface Pub { cristales: Record<string, { cid: number; elegido: { valor: number; fuente: string; referencia: string } | null; cristalografia: { texto: string }[] }>; fecha: string }
const pub: Pub = JSON.parse(readFileSync(new URL('../../src/data/quimica/cristales-pubchem.json', import.meta.url), 'utf8'));

describe('redes cristalinas · simetría', () => {
  it('lee las operaciones de simetría de los CIF y de las Tablas Internacionales', () => {
    expect(parseSymop('2/3+x-y,1/3+x,1/3-z')([0.1, 0.2, 0.3])).toEqual([expect.closeTo(2 / 3 - 0.1, 12), expect.closeTo(1 / 3 + 0.1, 12), expect.closeTo(1 / 3 - 0.3, 12)]);
    expect(parseSymop('-y,x-y,z+2/3')([0.4697, 0, 2 / 3])).toEqual([expect.closeTo(0, 12), expect.closeTo(0.4697, 12), expect.closeTo(4 / 3, 12)]);
    expect(() => parseSymop('x,y')).toThrow();
    // Una posición especial no se duplica: el Ti de 2a (0,0,0) con las 16 operaciones da solo 2 sitios.
    expect(expandSites(['x,y,z', '-x,-y,-z', '1/2+x,1/2+y,1/2+z'], [{ el: 'Ti', charge: 4, f: [0, 0, 0] }])).toHaveLength(2);
  });

  it('cada celda contiene Z unidades fórmula exactas (multiplicidades de Wyckoff)', () => {
    const expected: Record<string, Record<string, number>> = {
      li2o: { Li: 8, O: 4 }, na2o: { Na: 8, O: 4 }, k2o: { K: 8, O: 4 }, bao: { Ba: 4, O: 4 }, zns: { Zn: 4, S: 4 },
      tio2: { Ti: 2, O: 4 }, al2o3: { Al: 12, O: 18 }, sio2: { Si: 3, O: 6 },
    };
    for (const [id, cont] of Object.entries(expected)) expect(cellContent(getCrystal(id)), id).toEqual(cont);
    for (const c of CRYSTALS) {
      const total = structureSites(c).reduce((s, x) => s + x.charge, 0);
      expect(total, `${c.id}: la celda es neutra`).toBe(0);
    }
  });
});

describe('redes cristalinas · distancias y coordinación frente a lo publicado', () => {
  it('antifluoritas Li₂O, Na₂O y K₂O: catión 4 (tetraedro), anión 8 (cubo), M–O = a·√3/4 ≈ suma de radios de Shannon', () => {
    for (const id of ['li2o', 'na2o', 'k2o']) {
      const c = getCrystal(id);
      expect([coordinationNumber(c, 'cation'), coordinationNumber(c, 'anion')], id).toEqual([4, 8]);
      expect(cationAnionDistance(c), id).toBeCloseTo((c.a * Math.sqrt(3)) / 4, 10);
      expect(Math.abs(shannonSum(c)! - cationAnionDistance(c)), id).toBeLessThan(0.02);
    }
  });

  it('BaO (halita) 6:6 con Ba–O = a/2; ZnS (blenda) 4:4 con Zn–S = a·√3/4', () => {
    const b = getCrystal('bao');
    expect([coordinationNumber(b, 'cation'), coordinationNumber(b, 'anion')]).toEqual([6, 6]);
    expect(cationAnionDistance(b)).toBeCloseTo(b.a / 2, 10);
    expect(Math.abs(shannonSum(b)! - b.a / 2)).toBeLessThan(0.02);
    const z = getCrystal('zns');
    expect([coordinationNumber(z, 'cation'), coordinationNumber(z, 'anion')]).toEqual([4, 4]);
    expect(cationAnionDistance(z)).toBeCloseTo((z.a * Math.sqrt(3)) / 4, 10);
  });

  it('rutilo TiO₂: octaedro TiO₆ con 4 + 2 distancias (≈ 1,95 y 1,98 Å, Abrahams y Bernstein, 1971) y O triangular (3)', () => {
    const t = getCrystal('tio2');
    expect([coordinationNumber(t, 'cation'), coordinationNumber(t, 'anion')]).toEqual([6, 3]);
    const sh = shellDistances(t);
    expect(sh.map((x) => x.n)).toEqual([4, 2]);
    expect(sh[0].d).toBeCloseTo(1.949, 2);
    expect(sh[1].d).toBeCloseTo(1.98, 2);
    // Distancia apical = x·a·√2 (posición 4f (x, x, 0)).
    expect(sh[1].d).toBeCloseTo(t.pos!.xO * t.a * Math.SQRT2, 10);
  });

  it('corindón α-Al₂O₃ (AMCSD 0009325): octaedro AlO₆ con 3 + 3 distancias (≈ 1,86 y 1,97 Å) y O con 4 Al', () => {
    const a = getCrystal('al2o3');
    expect([coordinationNumber(a, 'cation'), coordinationNumber(a, 'anion')]).toEqual([6, 4]);
    const sh = shellDistances(a);
    expect(sh.map((x) => x.n)).toEqual([3, 3]);
    expect(sh[0].d).toBeCloseTo(1.855, 2);
    expect(sh[1].d).toBeCloseTo(1.972, 2);
  });

  it('cuarzo α SiO₂ (red covalente): tetraedros SiO₄, O puente, Si–O = 1,605 y 1,614 Å y Si–O–Si = 143,7° como en Levien y otros (1980)', () => {
    const q = getCrystal('sio2');
    expect(q.bonding).toBe('covalente');
    expect([coordinationNumber(q, 'cation'), coordinationNumber(q, 'anion')]).toEqual([4, 2]);
    const sh = shellDistances(q);
    expect(sh.map((x) => x.n)).toEqual([2, 2]);
    expect(sh[0].d).toBeCloseTo(1.605, 3);
    expect(sh[1].d).toBeCloseTo(1.614, 3);
    const ang = bridgeAngles(q);
    expect(ang).toHaveLength(1);
    expect(ang[0]).toBeCloseTo(143.7, 1);
    expect(shannonSum(q)).toBeNull();
    // En el bloque, cada Si interior tiene 4 enlaces y cada O interior 2.
    const atoms = generateLattice(q, 2);
    const bonds = networkBonds(q, atoms);
    const deg = atoms.map(() => 0);
    for (const b of bonds) { deg[b.a]++; deg[b.b]++; }
    expect(Math.max(...deg)).toBe(4);
    expect(deg.filter((d, i) => atoms[i].el === 'Si' && d === 4).length).toBeGreaterThan(5);
  });
});

describe('redes cristalinas · densidad calculada frente a la publicada', () => {
  it('la densidad publicada de cada cristal es el valor elegido en el archivo de PubChem (fuente original citada)', () => {
    for (const c of CRYSTALS) {
      const e = pub.cristales[c.id]?.elegido;
      expect(e, c.id).toBeTruthy();
      expect(c.densityPublished, c.id).toBe(e!.valor);
    }
    expect(pub.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Los parámetros del rutilo son los del texto del CRC (60.ª ed.) que trae PubChem.
    expect(pub.cristales.tio2.cristalografia[0].texto).toMatch(/AO= 4\.5937.*CO= 2\.9618/);
    const t = getCrystal('tio2');
    expect([t.a, t.c]).toEqual([4.5937, 2.9618]);
  });

  it('ρ = Z·M/(N_A·V): diferencia menor que 3 % salvo los óxidos con nota (Na₂O y BaO, medidos más bajos)', () => {
    const rows = CRYSTALS.map((c) => `${c.id} ${calculatedDensity(c).toFixed(3)}/${c.densityPublished} (${densityDeviation(c) >= 0 ? '+' : ''}${densityDeviation(c).toFixed(2)} %)`);
    console.log(`[cristales] densidad calculada/publicada: ${rows.join(' · ')}`);
    for (const c of CRYSTALS) {
      const dev = Math.abs(densityDeviation(c));
      if (c.densityNote) { expect(dev, c.id).toBeGreaterThan(3); expect(dev, c.id).toBeLessThan(7); expect(densityDeviation(c), `${c.id}: la medida es menor`).toBeGreaterThan(0); }
      else expect(dev, c.id).toBeLessThan(3);
    }
    expect(CRYSTALS.filter((c) => c.densityNote).map((c) => c.id).sort()).toEqual(['bao', 'na2o']);
    // Volúmenes de celda no cúbicos: tetragonal a²c y hexagonal (√3/2)a²c.
    expect(cellVolume(getCrystal('tio2'))).toBeCloseTo(4.5937 ** 2 * 2.9618, 10);
    expect(cellVolume(getCrystal('al2o3'))).toBeCloseTo(254.977, 2); // _cell_volume del CIF de la AMCSD
  });
});

describe('redes cristalinas · uso en el taller y fragmentos', () => {
  it('el taller encuentra el cristal por la composición (Li₂O, Al₂O₃, TiO₂, ZnS, SiO₂) y no inventa redes', () => {
    expect(crystalForComposition({ Li: 2, O: 1 })?.id).toBe('li2o');
    expect(crystalForComposition({ Al: 2, O: 3 })?.id).toBe('al2o3');
    expect(crystalForComposition({ Ti: 1, O: 2 })?.id).toBe('tio2');
    expect(crystalForComposition({ Zn: 1, S: 1 })?.id).toBe('zns');
    expect(crystalForComposition({ Si: 1, O: 2 })?.id).toBe('sio2');
    expect(crystalForComposition({ Ca: 1, S: 1, O: 4 })).toBeNull();
    expect(CRYSTALS_NOT_INCLUDED.map((x) => x.formula.split(' ')[0])).toEqual(['CaSO₄', 'SrO', 'NH₄Cl']);
  });

  it('fragmentos: iónicos sin enlaces y neutros; el del cuarzo lleva sus enlaces Si–O y no cuenta como iónico', () => {
    const al = latticeFragment(getCrystal('al2o3'), 1);
    expect(al.atoms.map((a) => a.el).sort()).toEqual(['Al', 'Al', 'O', 'O', 'O']);
    expect(al.charge).toBe(0);
    expect(al.bonds).toHaveLength(0);
    expect(hasIonicSpecies([al])).toBe(true);
    const si = latticeFragment(getCrystal('sio2'), 1);
    expect(si.atoms.map((a) => a.el).sort()).toEqual(['O', 'O', 'Si']);
    expect(si.bonds).toHaveLength(2);
    expect(hasIonicSpecies([si])).toBe(false);
  });
});

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  analyzeCenter, angleDeg, angleTable, bondTable, centralAtom, compareWithVsepr, describeMolecule, distance, firstCid,
  hillFormula, measureAngle, measureDistance, neighbors, parsePubChemQuery, parseSdf, pubchemSdf3dUrl, SDF_LIMITS,
  SdfError, TETRAHEDRAL, vseprAt, vseprShape, type Molecule,
} from '../../src/models/geometry';
import { BUNDLED_CONFORMERS, MISSING_3D, PUBCHEM3D_METHOD, RETRIEVED } from '../../src/data/conformers';

/** Molécula de prueba escrita a mano (no es un dato de PubChem): un «A» central con dos ligandos a 90° y una carga. */
const FIXTURE = [
  'prueba',
  '  PRUEBA  10182600003D',
  '',
  '  4  3  0     0  0  0  0  0  0999 V2000',
  '    0.0000    0.0000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0',
  '    3.0000    4.0000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0',
  '   -4.0000    3.0000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0',
  '    0.0000    0.0000    2.0000 O   0  5  0  0  0  0  0  0  0  0  0  0',
  '  1  2  1  0  0  0  0',
  '  1  3  1  0  0  0  0',
  '  1  4  2  0  0  0  0',
  'M  CHG  1   1   1',
  'M  END',
  '> <NOMBRE>',
  'valor de prueba',
  '',
  '$$$$',
  '',
].join('\n');

const mol = (id: string): Molecule => parseSdf(BUNDLED_CONFORMERS.find((c) => c.id === id)!.sdf);

describe('lector de SDF V2000', () => {
  it('lee átomos, enlaces, cargas M  CHG (que reemplazan las del bloque) y campos de datos', () => {
    const m = parseSdf(FIXTURE);
    expect(m.atoms.map((a) => a.label)).toEqual(['N1', 'H2', 'H3', 'O4']);
    expect(m.atoms[1]).toMatchObject({ x: 3, y: 4, z: 0 });
    expect(m.bonds).toEqual([{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 2 }]);
    expect(m.atoms[0].charge).toBe(1); // M  CHG
    expect(m.atoms[3].charge).toBe(0); // el código 5 (−1) del bloque queda reemplazado por M  CHG
    expect(m.props.NOMBRE).toBe('valor de prueba');
    expect(m.dimension).toBe('3D');
    expect(m.is3D).toBe(true);
    expect(neighbors(m, 0)).toEqual([1, 2, 3]);
    expect(hillFormula(m)).toBe('H2NO');
  });

  it('sin M  CHG usa el código de carga del bloque de átomos', () => {
    const m = parseSdf(FIXTURE.replace('M  CHG  1   1   1\n', ''));
    expect(m.atoms[3].charge).toBe(-1);
    expect(m.atoms[0].charge).toBe(0);
  });

  it('rechaza entradas mal formadas', () => {
    const bad = [
      '', 'hola', 42,
      FIXTURE.replace('V2000', 'V3000'),
      FIXTURE.replace('V2000', '     '),
      FIXTURE.replace('  4  3  0', '  0  3  0'),
      FIXTURE.replace('  4  3  0', '300  3  0'),
      FIXTURE.replace('    3.0000    4.0000', '    3.0x00    4.0000'),
      FIXTURE.replace('  1  3  1  0', '  1  9  1  0'),
      FIXTURE.replace('  1  3  1  0', '  1  1  1  0'),
      FIXTURE.replace('  1  3  1  0', '  1  3  7  0'),
      FIXTURE.replace('  1  3  1  0', '  1  2  1  0'),
      FIXTURE.replace(' N   0', ' 7   0'),
      FIXTURE.replace('    0.0000    0.0000    2.0000', ' 5000.0000    0.0000    2.0000'),
      FIXTURE.split('\n').slice(0, 6).join('\n'),
    ];
    for (const t of bad) expect(() => parseSdf(t), String(t).slice(0, 60)).toThrow(SdfError);
  });

  it('rechaza un archivo mayor que el límite de tamaño sin procesarlo', () => {
    const big = FIXTURE + 'x'.repeat(SDF_LIMITS.maxChars);
    expect(() => parseSdf(big)).toThrow(/límite/);
  });
});

describe('distancias y ángulos', () => {
  it('coinciden con el cálculo a mano', () => {
    expect(distance([0, 0, 0], [3, 4, 0])).toBe(5);
    expect(distance([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(angleDeg([1, 0, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(90, 10);
    expect(angleDeg([1, 0, 0], [0, 0, 0], [-2, 0, 0])).toBeCloseTo(180, 10);
    expect(angleDeg([1, 0, 0], [0, 0, 0], [1, 1, 0])).toBeCloseTo(45, 10);
    expect(() => angleDeg([0, 0, 0], [0, 0, 0], [1, 0, 0])).toThrow(RangeError);
    const m = parseSdf(FIXTURE);
    // (3,4,0) y (−4,3,0) son perpendiculares: 12 − 12 = 0
    expect(measureAngle(m, 1, 0, 2)).toBe(90);
    expect(measureDistance(m, 0, 1)).toBe(5);
    expect(measureDistance(m, 1, 2)).toBe(7.071); // √(7² + 1²) = √50 = 7,0711
  });

  it('valida los índices de los átomos', () => {
    const m = parseSdf(FIXTURE);
    expect(() => measureDistance(m, 0, 0)).toThrow(RangeError);
    expect(() => measureDistance(m, 0, 9)).toThrow(RangeError);
    expect(() => measureAngle(m, 1, 1, 2)).toThrow(RangeError);
    expect(() => measureAngle(m, 0.5, 1, 2)).toThrow(RangeError);
  });
});

describe('confórmeros de PubChem incluidos', () => {
  it('cada uno tiene CID, URL de origen, fecha y el CID del propio archivo; el SHA-256 coincide', () => {
    expect(BUNDLED_CONFORMERS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(BUNDLED_CONFORMERS.map((c) => c.cid)).size).toBe(BUNDLED_CONFORMERS.length);
    for (const c of BUNDLED_CONFORMERS) {
      expect(c.cid, c.id).toBeGreaterThan(0);
      expect(c.sourceUrl).toBe(pubchemSdf3dUrl(c.cid));
      expect(c.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.retrieved).toBe(RETRIEVED);
      const m = parseSdf(c.sdf);
      expect(Number(m.props.PUBCHEM_COMPOUND_CID), c.id).toBe(c.cid);
      expect(m.props.PUBCHEM_CONFORMER_ID).toBe(c.conformerId);
      expect(m.is3D, c.id).toBe(true);
      expect(hillFormula(m), c.id).toBe(c.formula);
      expect(createHash('sha256').update(c.sdf, 'ascii').digest('hex'), c.id).toBe(c.sha256);
      // PUBCHEM_COORDINATE_TYPE: 2 = 3D, 5 = calculadas, 10 = Å (especificación ASN.1 de PubChem)
      expect(m.props.PUBCHEM_COORDINATE_TYPE.split('\n').map(Number).sort((a, b) => a - b)).toEqual([2, 5, 10]);
    }
    expect(PUBCHEM3D_METHOD.quotes.join(' ')).toMatch(/MMFF94s/);
    expect(MISSING_3D.map((m) => m.formula)).toEqual(['BF3', 'Cl5P', 'F6S']);
  });

  it('metano: todos los ángulos H–C–H valen 109,5° ± 0,5°', () => {
    const m = mol('metano');
    const angles = angleTable(m).filter((r) => r.v === 0);
    expect(angles).toHaveLength(6);
    for (const r of angles) expect(Math.abs(r.angle - 109.5)).toBeLessThanOrEqual(0.5);
    expect(TETRAHEDRAL).toBeCloseTo(109.4712, 4);
  });

  it('CO₂, etino y HCN son lineales: 180° ± 0,5°', () => {
    for (const id of ['co2', 'etino', 'hcn']) {
      const m = mol(id);
      for (const r of angleTable(m)) expect(Math.abs(r.angle - 180), id).toBeLessThanOrEqual(0.5);
    }
  });

  it('centros trigonales (formaldehído, eteno): planos, suma 360° ± 0,5° y promedio 120° ± 0,5°', () => {
    for (const id of ['formaldehido', 'eteno']) {
      const m = mol(id);
      const a = analyzeCenter(m, centralAtom(m));
      expect(a.vsepr.ok && a.vsepr.notation, id).toBe('AX3');
      expect(Math.abs(a.angleSum3! - 360), id).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.meanAngle! - 120), id).toBeLessThanOrEqual(0.5);
    }
    // En el formaldehído el enlace doble abre los ángulos O=C–H por encima de 120° y cierra el H–C–H.
    const f = mol('formaldehido');
    const rows = angleTable(f).filter((r) => r.v === 1);
    const hch = rows.find((r) => f.atoms[r.a].element === 'H' && f.atoms[r.c].element === 'H')!;
    expect(hch.angle).toBeLessThan(120);
  });

  it('clasificación VSEPR de cada molécula incluida', () => {
    const expected: Record<string, [string, string, string]> = {
      agua: ['O', 'AX2E2', 'angular'],
      amoniaco: ['N', 'AX3E', 'piramidal trigonal'],
      metano: ['C', 'AX4', 'tetraédrica'],
      co2: ['C', 'AX2', 'lineal'],
      so2: ['S', 'AX2E', 'angular'],
      formaldehido: ['C', 'AX3', 'trigonal plana'],
      eteno: ['C', 'AX3', 'trigonal plana'],
      etino: ['C', 'AX2', 'lineal'],
      metanol: ['C', 'AX4', 'tetraédrica'],
      hcn: ['C', 'AX2', 'lineal'],
      h2s: ['S', 'AX2E2', 'angular'],
      fosfina: ['P', 'AX3E', 'piramidal trigonal'],
    };
    expect(Object.keys(expected).sort()).toEqual(BUNDLED_CONFORMERS.map((c) => c.id).sort());
    for (const [id, [el, notation, shape]] of Object.entries(expected)) {
      const m = mol(id);
      const c = centralAtom(m);
      const v = vseprAt(m, c);
      expect(m.atoms[c].element, id).toBe(el);
      expect(v.ok, id).toBe(true);
      if (v.ok) { expect(v.notation, id).toBe(notation); expect(v.molecularShape, id).toBe(shape); }
    }
    // El oxígeno del metanol también es un centro: AX2E2 (angular).
    const me = mol('metanol');
    const o = me.atoms.find((a) => a.element === 'O')!.index;
    const vo = vseprAt(me, o);
    expect(vo.ok && vo.notation).toBe('AX2E2');
    // Un hidrógeno terminal no es centro.
    expect(vseprAt(me, me.atoms.find((a) => a.element === 'H')!.index).ok).toBe(false);
  });

  it('agua: el ángulo calculado es menor que el ideal de 109,5°, como predice VSEPR', () => {
    const m = mol('agua');
    const theta = measureAngle(m, 1, 0, 2);
    expect(theta).toBe(104); // 103,98° redondeado a 0,1°
    const v = vseprAt(m, 0);
    if (!v.ok) throw new Error('debe clasificarse');
    const cmp = compareWithVsepr(theta, v);
    expect(cmp.ideal).toBeCloseTo(TETRAHEDRAL, 10);
    expect(cmp.difference).toBe(-5.5);
    expect(cmp.verdict).toMatch(/^Menor que el ideal/);
    expect(measureDistance(m, 0, 1)).toBe(0.969);
  });

  it('las longitudes siguen el orden triple < doble < sencillo para C–C (etino, eteno) y los enlaces vienen del archivo', () => {
    const cc = (id: string) => bondTable(mol(id)).find((b) => b.order > 1)!;
    expect(cc('etino').order).toBe(3);
    expect(cc('eteno').order).toBe(2);
    expect(cc('etino').length).toBeLessThan(cc('eteno').length);
    const so2 = mol('so2');
    expect(so2.bonds.every((b) => b.order === 2)).toBe(true);
  });
});

describe('VSEPR y consulta a PubChem', () => {
  it('formas e ideales de la tabla VSEPR', () => {
    expect(vseprShape(2, 0)!.idealAngles).toEqual([180]);
    expect(vseprShape(3, 0)!.idealAngles).toEqual([120]);
    expect(vseprShape(2, 1)!).toMatchObject({ notation: 'AX2E', molecularShape: 'angular', expectation: 'menor' });
    expect(vseprShape(4, 2)!).toMatchObject({ molecularShape: 'cuadrada plana', expectation: 'igual' });
    expect(vseprShape(2, 3)!).toMatchObject({ molecularShape: 'lineal', expectation: 'igual' });
    expect(vseprShape(5, 0)!.idealAngles).toEqual([90, 120, 180]);
    expect(vseprShape(1, 3)).toBeNull();
    expect(vseprShape(7, 0)).toBeNull();
  });

  it('valida lo que se busca y arma URL de PubChem sin inyectar texto', () => {
    expect(parsePubChemQuery(' 962 ')).toEqual({ kind: 'cid', cid: 962 });
    expect(parsePubChemQuery('CID 280')).toEqual({ kind: 'cid', cid: 280 });
    expect(parsePubChemQuery('carbon  tetrachloride')).toEqual({ kind: 'name', name: 'carbon tetrachloride' });
    for (const bad of ['', '   ', 'a/../../x', 'agua?x=1', 'x'.repeat(61), '<script>', 'CID 0']) expect(() => parsePubChemQuery(bad), bad).toThrow(RangeError);
    expect(firstCid('962\n')).toBe(962);
    expect(firstCid('Status: 404')).toBeNull();
  });

  it('la descripción textual no revela distancias ni ángulos', () => {
    const m = mol('agua');
    const d = describeMolecule(m, 'Agua', 962, 0);
    expect(d).toContain('PubChem CID 962');
    expect(d).toContain('AX2E2');
    expect(d).not.toMatch(/\d+[,.]\d/);
  });
});

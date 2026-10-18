import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  caCentroid, caTrace, cifDictionary, describeStructure, distance, distanceToCentroid, findAtom, ligands, measureDistance, paeBlocks, pairInfo,
  parseAlphaFoldPrediction, parseMmcif, parsePae, parsePdb, parsePdbId, parseRcsbEntry, parseStructure, parseUniProt, plddtBand,
  plddtSummary, secondaryFractions, STRUCTURE_LIMITS, StructureError, tokenizeCif, type ProteinStructure,
} from '../../src/models/protein';
import { BUNDLED_STRUCTURES, PROTEINS_RETRIEVED } from '../../src/data/proteins';

/** Tolerancia declarada para distancias y coordenadas frente a Biopython (que guarda las coordenadas en float32). */
const TOL_A = 1e-3;

interface FixAtom { chain: string; resSeq: number; resName: string; atom: string; altloc: string; bFactor: number }
interface FixStructure {
  file: string; sha256: string; bytes: number; models: number; atomSiteRecordsModel1: number; atoms: number;
  chains: { id: string; standard: number; hetero: number; water: number; heteroNames: string[]; atoms: number }[];
  polymerResidues: Record<string, number>;
  secondaryStructureRows: { structConfHelix: number; structConfStrand: number; structConfOther: number; sheetRange: number };
  caCentroid: number[]; caCount: number;
  centroidProbes: { chain: string; resSeq: number; resName: string; distance: number; bFactor: number }[];
  distances: { a: FixAtom; b: FixAtom; distance: number; note: string }[];
  centroidTrend: { bins: { min: number; max: number | null; n: number; meanB: number }[]; pearsonR: number } | null;
  plddt?: { meanFirst150: number; meanRest: number; residues: number; mean: number; counts: Record<string, number>; fractions: Record<string, number>; apiFractions: Record<string, number>; apiGlobalMetric: number };
}
const FIXTURE = JSON.parse(readFileSync(new URL('../fixtures/biopython-proteinas.json', import.meta.url), 'utf8')) as {
  biopython: string; numpy: string; python: string; structures: Record<string, FixStructure>;
};

const fileText = (name: string) => readFileSync(new URL(`../../src/data/proteinas/${name}`, import.meta.url));
const parsed = new Map<string, ProteinStructure>();
const structure = (id: string): ProteinStructure => {
  if (!parsed.has(id)) {
    const entry = BUNDLED_STRUCTURES.find((e) => e.id === id)!;
    parsed.set(id, parseStructure(fileText(entry.file).toString('utf8')));
  }
  return parsed.get(id)!;
};
const IDS = BUNDLED_STRUCTURES.map((e) => e.id);

describe('conjunto curado de estructuras (procedencia)', () => {
  it('cada archivo incluido coincide con su SHA-256, tamaño y fecha registrados, y con el archivo que leyó Biopython', () => {
    expect(IDS).toEqual(['3I40', '2HHB', '2LZM', '1EMA', 'AF-Q04671-F1']);
    expect(PROTEINS_RETRIEVED).toBe('2026-10-18');
    let total = 0;
    for (const e of BUNDLED_STRUCTURES) {
      const raw = fileText(e.file);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(e.sha256);
      expect(raw.length).toBe(e.bytes);
      expect(FIXTURE.structures[e.id].sha256).toBe(e.sha256);
      expect(e.retrieved).toBe('2026-10-18');
      expect(e.sourceUrl).toMatch(/^https:\/\/(files\.rcsb\.org\/download\/|alphafold\.ebi\.ac\.uk\/files\/)/);
      expect(e.kind === 'experimental' ? !!e.experimental : !!e.prediction).toBe(true);
      total += raw.length;
    }
    expect(total).toBeLessThan(1_900_000);
    expect(FIXTURE.biopython).toBe('1.85');
  });
});

describe('lector mmCIF frente a Biopython 1.85', () => {
  it('cadenas, residuos por tipo y átomos por cadena iguales a Bio.PDB.MMCIFParser', () => {
    for (const id of IDS) {
      const s = structure(id), f = FIXTURE.structures[id];
      expect(s.format).toBe('mmcif');
      expect(s.chains.map((c) => c.id)).toEqual(f.chains.map((c) => c.id));
      for (const fc of f.chains) {
        const c = s.chains.find((x) => x.id === fc.id)!;
        expect({ id, chain: c.id, standard: c.standard, hetero: c.hetero, water: c.water, atoms: c.atoms, het: c.heteroNames })
          .toEqual({ id, chain: fc.id, standard: fc.standard, hetero: fc.hetero, water: fc.water, atoms: fc.atoms, het: fc.heteroNames });
      }
      expect(s.atoms.length).toBe(f.atoms);
      expect(s.atomRecords).toBe(f.atomSiteRecordsModel1);
      expect(s.models).toBe(f.models);
    }
  });

  it('las posiciones alternativas cuentan una vez (3I40: 446 registros, 438 átomos) y se elige la primera si la ocupación empata', () => {
    const s = structure('3I40');
    expect(s.atomRecords).toBe(446);
    expect(s.atoms.length).toBe(438);
    const cg = findAtom(s, 'A', 14, 'CG')!;
    expect(cg.altloc).toBe('A');
    expect(cg.occupancy).toBe(0.5);
  });

  it('residuos del polímero y filas de estructura secundaria iguales a Bio.PDB.MMCIF2Dict', () => {
    for (const id of IDS) {
      const s = structure(id), f = FIXTURE.structures[id];
      expect(Object.fromEntries(s.chains.map((c) => [c.id, c.polymer]))).toEqual(f.polymerResidues);
      expect({ h: s.ss.helixRows, e: s.ss.strandRows, o: s.ss.otherRows, sh: s.ss.sheetRows }).toEqual({
        h: f.secondaryStructureRows.structConfHelix, e: f.secondaryStructureRows.structConfStrand, o: f.secondaryStructureRows.structConfOther, sh: f.secondaryStructureRows.sheetRange,
      });
    }
    // 1EMA: el cromóforo CRO66 y las selenometioninas son HETATM pero están dentro del polímero.
    const gfp = ligands(structure('1EMA'));
    expect(gfp.filter((l) => l.inPolymer).map((l) => l.resName)).toEqual(['CRO', 'MSE', 'MSE', 'MSE', 'MSE']);
    expect(ligands(structure('2HHB')).filter((l) => !l.inPolymer).map((l) => l.resName).sort()).toEqual(['HEM', 'HEM', 'HEM', 'HEM', 'PO4', 'PO4']);
  });

  it(`distancias entre átomos iguales a las de Biopython (tolerancia ${TOL_A} Å)`, () => {
    let n = 0;
    for (const id of IDS) {
      const s = structure(id);
      for (const d of FIXTURE.structures[id].distances) {
        const a = findAtom(s, d.a.chain, d.a.resSeq, d.a.atom), b = findAtom(s, d.b.chain, d.b.resSeq, d.b.atom);
        expect(a, `${id} ${d.note}`).not.toBeNull();
        expect(b, `${id} ${d.note}`).not.toBeNull();
        expect(s.residues[a!.residue].resName).toBe(d.a.resName);
        expect(s.residues[b!.residue].resName).toBe(d.b.resName);
        expect(Math.abs(measureDistance(s, a!.index, b!.index) - d.distance)).toBeLessThanOrEqual(TOL_A);
        expect(a!.b).toBeCloseTo(d.a.bFactor, 2);
        n++;
      }
    }
    expect(n).toBe(20);
    // Puente disulfuro A6–A11 de la insulina: el valor inicial del laboratorio.
    const s = structure('3I40');
    expect(measureDistance(s, findAtom(s, 'A', 6, 'SG')!.index, findAtom(s, 'A', 11, 'SG')!.index)).toBe(2.027);
  });

  it('centroide de los Cα y distancia de un Cα al centroide iguales a Biopython/NumPy', () => {
    for (const id of IDS) {
      const s = structure(id), f = FIXTURE.structures[id];
      const c = caCentroid(s);
      expect(c.n).toBe(f.caCount);
      expect(Math.abs(c.x - f.caCentroid[0]) + Math.abs(c.y - f.caCentroid[1]) + Math.abs(c.z - f.caCentroid[2])).toBeLessThan(TOL_A);
      for (const p of f.centroidProbes) {
        const ca = findAtom(s, p.chain, p.resSeq, 'CA')!;
        expect(Math.abs(distanceToCentroid(s, ca.residue, c)! - p.distance)).toBeLessThanOrEqual(TOL_A);
      }
    }
  });
});

describe('tendencias usadas en las preguntas (columna B frente a la distancia al centroide)', () => {
  it('promedios por intervalo de distancia iguales a Biopython/NumPy (2LZM, 2HHB y AF-Q04671-F1)', () => {
    for (const id of ['2LZM', '2HHB', 'AF-Q04671-F1']) {
      const s = structure(id), f = FIXTURE.structures[id].centroidTrend!;
      const c = caCentroid(s);
      const rows = s.residues.filter((r) => r.kind === 'estandar' && r.ca !== null).map((r) => ({ d: distance(s.atoms[r.ca!], c), b: s.atoms[r.ca!].b }));
      for (const bin of f.bins) {
        const sel = rows.filter((x) => x.d >= bin.min && (bin.max === null || x.d < bin.max));
        expect(sel.length).toBe(bin.n);
        expect(sel.reduce((t, x) => t + x.b, 0) / sel.length).toBeCloseTo(bin.meanB, 6);
      }
    }
    // 2LZM: el factor B medio crece del núcleo (14,4 Å²) a la superficie (23,3 Å²); en OCA2 el pLDDT medio cae de 89,0 a 46,9.
    expect(FIXTURE.structures['2LZM'].centroidTrend!.pearsonR).toBeGreaterThan(0);
    expect(FIXTURE.structures['AF-Q04671-F1'].centroidTrend!.pearsonR).toBeLessThan(0);
    const p = plddtSummary(structure('AF-Q04671-F1'));
    const first = p.values.slice(0, 150).reduce((t, v) => t + v.plddt, 0) / 150;
    expect(first).toBeCloseTo(FIXTURE.structures['AF-Q04671-F1'].plddt!.meanFirst150, 6);
  });
});

describe('confianza pLDDT del modelo de AlphaFold', () => {
  it('fracciones por banda iguales a Biopython y a la API de AlphaFold DB; media ≈ valor global declarado', () => {
    const s = structure('AF-Q04671-F1');
    const f = FIXTURE.structures['AF-Q04671-F1'].plddt!;
    const p = plddtSummary(s);
    expect(p.values.length).toBe(838);
    expect(p.counts).toEqual(f.counts);
    expect(p.fractions).toEqual(f.fractions);
    const api = BUNDLED_STRUCTURES.find((e) => e.id === 'AF-Q04671-F1')!.prediction!;
    expect(p.fractions).toEqual({ muyAlta: api.fractions.veryHigh, alta: api.fractions.confident, baja: api.fractions.low, muyBaja: api.fractions.veryLow });
    expect(Math.abs(p.mean - f.mean)).toBeLessThan(1e-6);
    expect(s.declaresPrediction).toBe(true);
    expect(s.globalPlddt).toBe(73.79);
    expect(Math.abs(p.mean - api.globalMetricValue!)).toBeLessThan(0.05);
    expect(s.license).toMatch(/CC-BY-4\.0/);
    expect(structure('3I40').declaresPrediction).toBe(false);
  });

  it('bordes de las bandas como en AlphaFold DB (90 y 70 pertenecen a la banda superior)', () => {
    expect(plddtBand(100)).toBe('muyAlta');
    expect(plddtBand(90)).toBe('muyAlta');
    expect(plddtBand(89.99)).toBe('alta');
    expect(plddtBand(70)).toBe('alta');
    expect(plddtBand(69.99)).toBe('baja');
    expect(plddtBand(50)).toBe('baja');
    expect(plddtBand(49.99)).toBe('muyBaja');
    expect(plddtBand(0)).toBe('muyBaja');
    expect(() => plddtBand(100.5)).toThrow(RangeError);
    expect(() => plddtBand(-1)).toThrow(RangeError);
    expect(() => plddtBand(Number.NaN)).toThrow(RangeError);
  });

  it('el resumen incluido de la PAE tiene la forma esperada y paeBlocks promedia por bloques', () => {
    const pae = BUNDLED_STRUCTURES.find((e) => e.id === 'AF-Q04671-F1')!.prediction!.pae!;
    expect(pae.n).toBe(838);
    expect(pae.blockSize).toBe(21);
    expect(pae.blocks.length).toBe(40);
    expect(pae.blocks.every((r) => r.length === 40)).toBe(true);
    expect(pae.blocks.flat().every((v) => v >= 0 && v <= pae.max!)).toBe(true);
    const m = [[0, 2, 10, 10, 9], [2, 0, 10, 10, 9], [10, 10, 0, 1, 3], [10, 10, 1, 0, 3], [9, 9, 3, 3, 0]];
    const r = paeBlocks(m, 2);
    expect(r.blockSize).toBe(3);
    // A mano: bloque (0,0) = 44/9 = 4,89 → 4,9; (0,1) = 42/6 = 7; (1,0) = 42/6 = 7; (1,1) = 6/4 = 1,5.
    expect(r.blocks).toEqual([[4.9, 7], [7, 1.5]]);
    expect(() => parsePae([{ predicted_aligned_error: [[0, 1], [1]] }])).toThrow(StructureError);
    expect(parsePae([{ predicted_aligned_error: [[0, 1], [1, 0]], max_predicted_aligned_error: 31.75 }]).max).toBe(31.75);
  });
});

describe('lector PDB (columnas fijas) con un archivo de prueba escrito a mano', () => {
  // No es un dato del PDB: es un archivo sintético para probar el lector (dos modelos, agua, ligando y altloc).
  const pad = (s: string) => s.padEnd(80, ' ');
  const PDB = [
    pad('HEADER    PRUEBA                                  18-OCT-26   9ZZZ'),
    pad('TITLE     ARCHIVO DE PRUEBA DEL LECTOR'),
    pad('EXPDTA    X-RAY DIFFRACTION'),
    pad('REMARK   2 RESOLUTION.    1.50 ANGSTROMS.'),
    pad('HELIX    1   1 ALA A    1  GLY A    2  1                                   2'),
    pad('MODEL        1'),
    'ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 10.00           N',
    'ATOM      2  CA  ALA A   1       3.000   4.000   0.000  1.00 11.00           C',
    'ATOM      3  CA AGLY A   2       6.000   4.000   0.000  0.40 12.00           C',
    'ATOM      4  CA BGLY A   2       6.500   4.000   0.000  0.60 13.00           C',
    'HETATM    5 FE   HEM A 101       0.000   0.000  12.000  1.00 20.00          FE',
    'HETATM    6  O   HOH A 201       1.000   1.000   1.000  1.00 30.00           O',
    'ENDMDL',
    'MODEL        2',
    'ATOM      7  N   ALA A   1       9.000   9.000   9.000  1.00 10.00           N',
    'ENDMDL',
    'END',
  ].join('\n');

  it('lee metadatos, primer modelo, altloc de mayor ocupación, agua, heterogrupo y hélice', () => {
    const s = parsePdb(PDB);
    expect(s.format).toBe('pdb');
    expect(s.id).toBe('9ZZZ');
    expect(s.depositDate).toBe('2026-10-18');
    expect(s.method).toBe('X-RAY DIFFRACTION');
    expect(s.resolution).toBe(1.5);
    expect(s.models).toBe(2);
    expect(s.atoms.length).toBe(5);
    expect(s.atomRecords).toBe(6);
    const c = s.chains[0];
    expect({ standard: c.standard, hetero: c.hetero, water: c.water, polymer: c.polymer }).toEqual({ standard: 2, hetero: 1, water: 1, polymer: 2 });
    const gly = findAtom(s, 'A', 2, 'CA')!;
    expect(gly.altloc).toBe('B');
    expect(gly.x).toBe(6.5);
    expect(findAtom(s, 'A', 101, 'FE')!.element).toBe('Fe');
    expect(s.residues.filter((r) => r.polymer).map((r) => r.ss)).toEqual(['helice', 'helice']);
    expect(secondaryFractions(s).helice).toBe(1);
    const n = findAtom(s, 'A', 1, 'N')!, ca = findAtom(s, 'A', 1, 'CA')!;
    expect(measureDistance(s, n.index, ca.index)).toBe(5); // triángulo 3-4-5
    expect(pairInfo(s, ca.index, gly.index)).toEqual({ kind: 'misma cadena', separation: 1 });
    expect(pairInfo(s, ca.index, findAtom(s, 'A', 101, 'FE')!.index).kind).toBe('con heterogrupo o agua');
    expect(() => measureDistance(s, n.index, n.index)).toThrow(RangeError);
    expect(() => measureDistance(s, 0, 99)).toThrow(RangeError);
    expect(parseStructure(PDB).format).toBe('pdb');
  });
});

describe('tokenizador CIF y entradas mal formadas', () => {
  it('lee comillas, campos de texto «;» y tablas loop_', () => {
    const cif = ["data_TEST", "_struct.title 'it''s a test'", '_exptl.method "X-RAY DIFFRACTION"', '_entry.id', ';', 'texto largo', 'en dos lineas', ';', 'loop_', '_a.x', '_a.y', "1 'dos tres'", '4 .', '# comentario', ''].join('\n');
    const d = cifDictionary(cif);
    expect(d.get('_struct.title')).toEqual(["it''s a test"]);
    expect(d.get('_exptl.method')).toEqual(['X-RAY DIFFRACTION']);
    expect(d.get('_entry.id')).toEqual(['texto largo\nen dos lineas']);
    expect(d.get('_a.x')).toEqual(['1', '4']);
    expect(d.get('_a.y')).toEqual(['dos tres', '.']);
    expect(tokenizeCif("_x 'a b' c").map((t) => t.v)).toEqual(['_x', 'a b', 'c']);
  });

  it('rechaza archivos vacíos, binarios, sin coordenadas, truncados o con valores imposibles', () => {
    const atomSite = (row: string) => ['data_X', 'loop_', '_atom_site.group_PDB', '_atom_site.id', '_atom_site.type_symbol', '_atom_site.label_atom_id', '_atom_site.label_comp_id',
      '_atom_site.auth_asym_id', '_atom_site.auth_seq_id', '_atom_site.Cartn_x', '_atom_site.Cartn_y', '_atom_site.Cartn_z', row].join('\n');
    expect(parseMmcif(atomSite('ATOM 1 C CA GLY A 1 1.0 2.0 3.0')).atoms.length).toBe(1);
    expect(() => parseStructure('')).toThrow(StructureError);
    expect(() => parseStructure('data_X\n_atom_site.id 1\u0000')).toThrow(/binarios/);
    expect(() => parseStructure('data_X\n_entry.id 1ABC\n')).toThrow(/_atom_site/);
    expect(() => parseStructure('hola, esto no es una proteína')).toThrow(/formato/);
    expect(() => parseMmcif(atomSite('ATOM 1 C CA GLY A 1 1.0 2.0'))).toThrow(/múltiplo/);
    expect(() => parseMmcif(atomSite('ATOM 1 C CA GLY A 1 1.0 abc 3.0'))).toThrow(/no numérico/);
    expect(() => parseMmcif(atomSite('ATOM 1 C CA GLY A 1 1.0 2.0 99999.0'))).toThrow(/fuera de rango/);
    expect(() => parseMmcif(atomSite("ATOM 1 C 'CA GLY A 1 1.0 2.0 3.0"))).toThrow(/Comillas/);
    expect(() => parseMmcif(atomSite('LINK 1 C CA GLY A 1 1.0 2.0 3.0'))).toThrow(/desconocido/);
    expect(() => parsePdb('ATOM      1  CA  GLY A   1       1.000')).toThrow(/corto/);
    expect(() => parseStructure('x'.repeat(STRUCTURE_LIMITS.maxChars + 1))).toThrow(/límite/);
  });
});

describe('consultas a los servicios (validación sin red)', () => {
  it('valida códigos PDB y accesiones de UniProt sin inventar identificadores', () => {
    expect(parsePdbId(' 2hhb ')).toBe('2HHB');
    expect(parsePdbId('1DP0')).toBe('1DP0');
    for (const bad of ['', 'HHB', '0ABC', '12345', '2HH*']) expect(() => parsePdbId(bad)).toThrow(RangeError);
    expect(parseUniProt('q04671')).toBe('Q04671');
    expect(parseUniProt('P09848')).toBe('P09848');
    expect(parseUniProt('A0A024R161')).toBe('A0A024R161');
    for (const bad of ['', 'P0984', 'HBB', '12345678', 'P09848; DROP']) expect(() => parseUniProt(bad)).toThrow(RangeError);
  });

  it('interpreta respuestas grabadas de RCSB y AlphaFold y rechaza URL de otros dominios', () => {
    const entry = { rcsb_id: '2HHB', struct: { title: 'T' }, exptl: [{ method: 'X-RAY DIFFRACTION' }], rcsb_entry_info: { resolution_combined: [1.74], deposited_atom_count: 4779 }, rcsb_accession_info: { deposit_date: '1984-03-07T00:00:00.000+00:00', initial_release_date: '1984-07-18T00:00:00.000+00:00' }, rcsb_entry_container_identifiers: { polymer_entity_ids: ['1', '2'] } };
    const m = parseRcsbEntry(entry, '2HHB');
    expect(m).toMatchObject({ id: '2HHB', method: 'X-RAY DIFFRACTION', resolution: 1.74, releaseDate: '1984-07-18', atomCount: 4779, entityIds: ['1', '2'] });
    expect(() => parseRcsbEntry(entry, '4HHB')).toThrow(StructureError);
    const af = [
      { modelEntityId: 'AF-Q04671-3-F1', cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-Q04671-3-F1-model_v6.cif' },
      { modelEntityId: 'AF-Q04671-F1', uniprotAccession: 'Q04671', latestVersion: 6, globalMetricValue: 73.81, cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-Q04671-F1-model_v6.cif', paeDocUrl: 'https://alphafold.ebi.ac.uk/files/AF-Q04671-F1-predicted_aligned_error_v6.json', modelCreatedDate: '2025-08-01T00:00:00Z' },
    ];
    expect(parseAlphaFoldPrediction(af, 'Q04671')).toMatchObject({ entryId: 'AF-Q04671-F1', version: 6, modelCreatedDate: '2025-08-01', globalMetricValue: 73.81 });
    expect(() => parseAlphaFoldPrediction([{ modelEntityId: 'AF-Q04671-F1', cifUrl: 'https://otro.example/x.cif' }], 'Q04671')).toThrow(/alphafold\.ebi\.ac\.uk/);
    expect(() => parseAlphaFoldPrediction([], 'Q04671')).toThrow(StructureError);
  });
});

describe('traza de Cα y descripción para lectores de pantalla', () => {
  it('la traza se corta donde faltan Cα (cromóforo de la GFP) y la descripción no revela distancias', () => {
    const gfp = caTrace(structure('1EMA'));
    expect(gfp.length).toBe(1);
    expect(gfp[0].segments.length).toBeGreaterThanOrEqual(2);
    const hb = caTrace(structure('2HHB'));
    expect(hb.map((t) => t.chain)).toEqual(['A', 'B', 'C', 'D']);
    const text = describeStructure(structure('3I40'), 'Insulina humana', 'Evidencia experimental');
    expect(text).toContain('438 átomos en 2 cadenas');
    expect(text).not.toMatch(/2,027|2\.027/);
  });
});

/**
 * Confórmeros 3D de PubChem (PubChem3D) incluidos en el laboratorio de geometría molecular.
 * GENERADO a partir de las descargas reales del 2026-10-18 con PUG REST:
 *   1) nombre → CID:  https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/<nombre>/cids/TXT
 *   2) CID → SDF 3D:  https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/<CID>/record/SDF?record_type=3d
 * El texto `sdf` es el archivo descargado SIN MODIFICAR (su SHA-256 se guarda para verificarlo).
 * Fórmula y título: https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/<CID>/property/MolecularFormula,Title/CSV
 * No edites las coordenadas a mano: si hay que actualizar, vuelve a descargar y regenera el archivo.
 */

export interface BundledConformer {
  /** Clave interna del laboratorio. */
  id: string;
  /** Identificador de compuesto de PubChem obtenido al buscar el nombre en inglés. */
  cid: number;
  name: string;
  /** Fórmula molecular tal como la reporta PubChem (orden de Hill). */
  formula: string;
  /** Título del registro en PubChem. */
  pubchemTitle: string;
  /** Nombre (en inglés) usado en la búsqueda nombre → CID. */
  queryName: string;
  /** URL exacta de la que se descargó el SDF. */
  sourceUrl: string;
  /** Página del compuesto en PubChem. */
  pageUrl: string;
  /** Fecha de descarga (AAAA-MM-DD). */
  retrieved: string;
  /** PUBCHEM_CONFORMER_ID del archivo. */
  conformerId: string;
  /** SHA-256 del archivo descargado (hex). */
  sha256: string;
  sdf: string;
}

export const RETRIEVED = '2026-10-18';

export const BUNDLED_CONFORMERS: BundledConformer[] = [
  {
    id: "agua", cid: 962, name: "Agua", formula: "H2O", pubchemTitle: "Water", queryName: "water",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/962/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/962',
    retrieved: RETRIEVED, conformerId: "000003C200000001",
    sha256: '90b110239e4235e3cff92fcc849de16eaad08709077c8bff98072276821bfca9',
    sdf: "962\n  -OEChem-10182605423D\n\n  3  2  0     0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n    0.2774    0.8929    0.2544 H   0  0  0  0  0  0  0  0  0  0  0  0\n    0.6068   -0.2383   -0.7169 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n962\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n3\n1 -0.86\n2 0.43\n3 0.43\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n2\n1 1 acceptor\n1 1 donor\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n1\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n000003C200000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n10.148\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n260 1 18410856563934756871\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n14.71\n0.49\n0.49\n0.49\n0\n0\n0\n0\n0\n0\n0\n0\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n14.042\n\n> <PUBCHEM_SHAPE_VOLUME>\n14.7\n\n> <PUBCHEM_COORDINATE_TYPE>\n10\n5\n2\n\n$$$$\n",
  },
  {
    id: "amoniaco", cid: 222, name: "Amoníaco", formula: "H3N", pubchemTitle: "Ammonia", queryName: "ammonia",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/222/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/222',
    retrieved: RETRIEVED, conformerId: "000000DE00000001",
    sha256: '5a7464e3486af14d9bd48aa925430526536bf9210d056ed07f4598e9db6b3120',
    sdf: "222\n  -OEChem-10182605423D\n\n  4  3  0     0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.4417    0.2906    0.8711 H   0  0  0  0  0  0  0  0  0  0  0  0\n    0.7256    0.6896   -0.1907 H   0  0  0  0  0  0  0  0  0  0  0  0\n    0.4875   -0.8701    0.2089 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\n  1  4  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n222\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n4\n1 -1.08\n2 0.36\n3 0.36\n4 0.36\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n1\n1 1 cation\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n1\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n000000DE00000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n5.074\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n260 1 18410856563934756871\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n15.6\n0.51\n0.51\n0.51\n0\n0\n0\n0\n0\n0\n0\n0\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n14.89\n\n> <PUBCHEM_SHAPE_VOLUME>\n15.6\n\n> <PUBCHEM_COORDINATE_TYPE>\n10\n5\n2\n\n$$$$\n",
  },
  {
    id: "metano", cid: 297, name: "Metano", formula: "CH4", pubchemTitle: "Methane", queryName: "methane",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/297/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/297',
    retrieved: RETRIEVED, conformerId: "0000012900000001",
    sha256: '466bfd8a53cbe20ce0a95361dd3d028305a0a28808bbc64870caa9a2eb907cca',
    sdf: "297\n  -OEChem-10182605423D\n\n  5  4  0     0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    0.5541    0.7996    0.4965 H   0  0  0  0  0  0  0  0  0  0  0  0\n    0.6833   -0.8134   -0.2536 H   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.7782   -0.3735    0.6692 H   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.4593    0.3874   -0.9121 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\n  1  4  1  0  0  0  0\n  1  5  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n297\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n0\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n0\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n1\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n0000012900000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0.0264\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n0\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n260 1 18410856563934756871\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n20.58\n0.62\n0.62\n0.62\n0\n0\n0\n0\n0\n0\n0\n0\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n19.645\n\n> <PUBCHEM_SHAPE_VOLUME>\n20.6\n\n> <PUBCHEM_COORDINATE_TYPE>\n10\n5\n2\n\n$$$$\n",
  },
  {
    id: "co2", cid: 280, name: "Dióxido de carbono", formula: "CO2", pubchemTitle: "Carbon Dioxide", queryName: "carbon dioxide",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/280/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/280',
    retrieved: RETRIEVED, conformerId: "0000011800000001",
    sha256: '5029a87419dfed9ba0d96a48ff13654816a278f9becb343b20a0d1a55260c8da',
    sdf: "280\n  -OEChem-10182605423D\n\n  3  2  0     0  0  0  0  0  0999 V2000\n   -1.1970    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n    1.1970    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n  1  3  2  0  0  0  0\n  2  3  2  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n280\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n3\n1 -0.78\n2 -0.78\n3 0.56\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n0\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n3\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n0000011800000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n0\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n139733 1 18410856559639900005\n21015797 1 18122625230005338150\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n50\n1.39\n0.54\n0.54\n0\n0\n0\n0\n0\n0\n0\n0\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n83.76\n\n> <PUBCHEM_SHAPE_VOLUME>\n31.9\n\n> <PUBCHEM_COORDINATE_TYPE>\n2\n5\n10\n\n$$$$\n",
  },
  {
    id: "so2", cid: 1119, name: "Dióxido de azufre", formula: "O2S", pubchemTitle: "Sulfur Dioxide", queryName: "sulfur dioxide",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/1119/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/1119',
    retrieved: RETRIEVED, conformerId: "0000045F00000001",
    sha256: '97bf39e6961d167c9ee993bdd3cb62c4f179bd61c1a3c847eb1c0ba89f4dbb31',
    sdf: "1119\n  -OEChem-10182605423D\n\n  3  2  0     0  0  0  0  0  0999 V2000\n    0.0000   -0.5774    0.0000 S   0  0  0  0  0  0  0  0  0  0  0  0\n    1.3091    0.2887    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.3091    0.2887    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  2  0  0  0  0\n  1  3  2  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n1119\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n3\n1 0.86\n2 -0.43\n3 -0.43\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n0\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n3\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n0000045F00000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n0\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n139733 1 18410856559639796069\n20096714 4 18410575101927532536\n21015797 1 18047474709763848527\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n53.85\n1.52\n0.77\n0.58\n0\n0.14\n0\n-0.33\n0\n0\n0\n0\n0.04\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n77.316\n\n> <PUBCHEM_SHAPE_VOLUME>\n41.3\n\n> <PUBCHEM_COORDINATE_TYPE>\n2\n5\n10\n\n$$$$\n",
  },
  {
    id: "formaldehido", cid: 712, name: "Formaldehído (metanal)", formula: "CH2O", pubchemTitle: "Formaldehyde", queryName: "formaldehyde",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/712/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/712',
    retrieved: RETRIEVED, conformerId: "000002C800000001",
    sha256: '635c13c6069a7ee2bfc631bd848df3ccab0e26f6b8a0c3d5bd2707f005cc862f',
    sdf: "712\n  -OEChem-10182605423D\n\n  4  3  0     0  0  0  0  0  0999 V2000\n    0.6123    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.6123    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.2000    0.2426   -0.8998 H   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.2000   -0.2424    0.8998 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  2  0  0  0  0\n  2  3  1  0  0  0  0\n  2  4  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n712\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n4\n1 -0.57\n2 0.45\n3 0.06\n4 0.06\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n1\n1 1 acceptor\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n2\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n000002C800000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0.0542\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n5.074\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n21015797 1 18338519741256598869\n260 1 18410856563976954887\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n35.29\n0.93\n0.56\n0.56\n0.04\n0\n0\n0\n0\n0.04\n0\n0.04\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n50.426\n\n> <PUBCHEM_SHAPE_VOLUME>\n26.8\n\n> <PUBCHEM_COORDINATE_TYPE>\n2\n5\n10\n\n$$$$\n",
  },
  {
    id: "eteno", cid: 6325, name: "Eteno (etileno)", formula: "C2H4", pubchemTitle: "Ethylene", queryName: "ethylene",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/6325/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/6325',
    retrieved: RETRIEVED, conformerId: "000018B500000001",
    sha256: '9a599f42a96b3d21ea12148358e6ef4e0a62041189f09c2e49fd689cdf593627',
    sdf: "6325\n  -OEChem-10182605423D\n\n  6  5  0     0  0  0  0  0  0999 V2000\n   -0.6672    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    0.6672    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.2213   -0.9290    0.0708 H   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.2212    0.9290   -0.0708 H   0  0  0  0  0  0  0  0  0  0  0  0\n    1.2213    0.9290   -0.0708 H   0  0  0  0  0  0  0  0  0  0  0  0\n    1.2213   -0.9290    0.0708 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  2  0  0  0  0\n  1  3  1  0  0  0  0\n  1  4  1  0  0  0  0\n  2  5  1  0  0  0  0\n  2  6  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n6325\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n6\n1 -0.3\n2 -0.3\n3 0.15\n4 0.15\n5 0.15\n6 0.15\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n2\n1 1 hydrophobe\n1 2 hydrophobe\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n2\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n000018B500000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0.1306\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n11.86\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n21015797 1 8574413327516572042\n260 1 8574713502780882945\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n41.16\n1.06\n0.62\n0.62\n0\n0\n0\n0\n0\n0\n0\n0\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n58.377\n\n> <PUBCHEM_SHAPE_VOLUME>\n31.7\n\n> <PUBCHEM_COORDINATE_TYPE>\n2\n5\n10\n\n$$$$\n",
  },
  {
    id: "etino", cid: 6326, name: "Etino (acetileno)", formula: "C2H2", pubchemTitle: "Acetylene", queryName: "acetylene",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/6326/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/6326',
    retrieved: RETRIEVED, conformerId: "000018B600000001",
    sha256: '16fe98c9ec7af4e7fa39b4a05cf887f800ee6def69912744004f1f18cb734a14',
    sdf: "6326\n  -OEChem-10182605423D\n\n  4  3  0     0  0  0  0  0  0999 V2000\n   -0.6000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    0.6000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.6650    0.0000   -0.0001 H   0  0  0  0  0  0  0  0  0  0  0  0\n    1.6650    0.0000    0.0001 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  3  0  0  0  0\n  1  3  1  0  0  0  0\n  2  4  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n6326\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n4\n1 -0.18\n2 -0.18\n3 0.18\n4 0.18\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n2\n1 1 hydrophobe\n1 2 hydrophobe\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n2\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n000018B600000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n-0.0155\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n12.553\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n21015797 1 18410575119022817310\n260 1 18410856563934756871\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n41.16\n0.98\n0.62\n0.62\n0\n0\n0\n0\n0\n0\n0\n0\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n61.201\n\n> <PUBCHEM_SHAPE_VOLUME>\n30.2\n\n> <PUBCHEM_COORDINATE_TYPE>\n2\n5\n10\n\n$$$$\n",
  },
  {
    id: "metanol", cid: 887, name: "Metanol", formula: "CH4O", pubchemTitle: "Methanol", queryName: "methanol",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/887/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/887',
    retrieved: RETRIEVED, conformerId: "0000037700000001",
    sha256: '464910839aa9d699b97ea0c958f841da72221f6055e09ed755a941d98d8a831e',
    sdf: "887\n  -OEChem-10182605423D\n\n  6  5  0     0  0  0  0  0  0999 V2000\n    0.7079    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.7079    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.0732   -0.7690    0.6852 H   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.0731   -0.1947   -1.0113 H   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.0632    0.9786    0.3312 H   0  0  0  0  0  0  0  0  0  0  0  0\n    0.9936   -0.8804   -0.2980 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  6  1  0  0  0  0\n  2  3  1  0  0  0  0\n  2  4  1  0  0  0  0\n  2  5  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n887\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n3\n1 -0.68\n2 0.28\n6 0.4\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n2\n1 1 acceptor\n1 1 donor\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n2\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n0000037700000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0.6658\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n10.148\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n21015797 1 18050288360093082877\n260 1 18410856563992779143\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n35.29\n1.05\n0.56\n0.56\n0.01\n0\n0\n0\n0\n0.04\n0\n0.04\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n47.013\n\n> <PUBCHEM_SHAPE_VOLUME>\n28.6\n\n> <PUBCHEM_COORDINATE_TYPE>\n2\n5\n10\n\n$$$$\n",
  },
  {
    id: "hcn", cid: 768, name: "Cianuro de hidrógeno", formula: "CHN", pubchemTitle: "Hydrogen Cyanide", queryName: "hydrogen cyanide",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/768/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/768',
    retrieved: RETRIEVED, conformerId: "0000030000000001",
    sha256: '6fed467eeeb7b0ca3dd931bfe969e1340761e3af9ece0397541aecf7322c1a93',
    sdf: "768\n  -OEChem-10182605423D\n\n  3  2  0     0  0  0  0  0  0999 V2000\n   -0.5800    0.0000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0\n    0.5800    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    1.6450    0.0000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  3  0  0  0  0\n  2  3  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n768\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n3\n1 -0.56\n2 0.38\n3 0.18\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n1\n1 1 acceptor\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n2\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n2\n\n> <PUBCHEM_CONFORMER_ID>\n0000030000000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n5.074\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n21015797 1 18410855481655752302\n260 1 18410856563966405382\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n36.18\n0.9\n0.57\n0.57\n0.04\n0\n0\n0\n0\n0.03\n0\n0.03\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n53.263\n\n> <PUBCHEM_SHAPE_VOLUME>\n26.7\n\n> <PUBCHEM_COORDINATE_TYPE>\n2\n5\n10\n\n$$$$\n",
  },
  {
    id: "h2s", cid: 402, name: "Sulfuro de hidrógeno", formula: "H2S", pubchemTitle: "Hydrogen Sulfide", queryName: "hydrogen sulfide",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/402/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/402',
    retrieved: RETRIEVED, conformerId: "0000019200000001",
    sha256: '1b693984d7f26fccbe6d35cd30b1b4f4a69b164a56ea549081aeb9a1426eb0f0',
    sdf: "402\n  -OEChem-10182605433D\n\n  3  2  0     0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 S   0  0  0  0  0  0  0  0  0  0  0  0\n    0.4855    1.2232    0.2576 H   0  0  0  0  0  0  0  0  0  0  0  0\n    0.8868   -0.2325   -0.9787 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n402\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n3\n1 -0.36\n2 0.18\n3 0.18\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n0\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n1\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n0000019200000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n0\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n260 1 18410856563934756871\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n24.43\n0.69\n0.69\n0.69\n0\n0\n0\n0\n0\n0\n0\n0\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n23.32\n\n> <PUBCHEM_SHAPE_VOLUME>\n24.4\n\n> <PUBCHEM_COORDINATE_TYPE>\n10\n5\n2\n\n$$$$\n",
  },
  {
    id: "fosfina", cid: 24404, name: "Fosfina (fosfano)", formula: "H3P", pubchemTitle: "Phosphine", queryName: "phosphine",
    sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/24404/record/SDF?record_type=3d',
    pageUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/24404',
    retrieved: RETRIEVED, conformerId: "00005F5400000001",
    sha256: 'a0d79395402eebc7c680a69c55ef85d6198120b401fc39d82c9d93ec8a1f4613',
    sdf: "24404\n  -OEChem-10182605433D\n\n  4  3  0     0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 P   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.6323    0.5130    1.1573 H   0  0  0  0  0  0  0  0  0  0  0  0\n    1.2032    0.7159    0.2052 H   0  0  0  0  0  0  0  0  0  0  0  0\n    0.4610   -1.1757    0.6383 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\n  1  4  1  0  0  0  0\nM  END\n> <PUBCHEM_COMPOUND_CID>\n24404\n\n> <PUBCHEM_CONFORMER_RMSD>\n0.4\n\n> <PUBCHEM_CONFORMER_DIVERSEORDER>\n1\n\n> <PUBCHEM_MMFF94_PARTIAL_CHARGES>\n4\n1 -0.29\n2 0.1\n3 0.1\n4 0.1\n\n> <PUBCHEM_EFFECTIVE_ROTOR_COUNT>\n0\n\n> <PUBCHEM_PHARMACOPHORE_FEATURES>\n0\n\n> <PUBCHEM_HEAVY_ATOM_COUNT>\n1\n\n> <PUBCHEM_ATOM_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ATOM_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_DEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_BOND_UDEF_STEREO_COUNT>\n0\n\n> <PUBCHEM_ISOTOPIC_ATOM_COUNT>\n0\n\n> <PUBCHEM_COMPONENT_COUNT>\n1\n\n> <PUBCHEM_CACTVS_TAUTO_COUNT>\n1\n\n> <PUBCHEM_CONFORMER_ID>\n00005F5400000001\n\n> <PUBCHEM_MMFF94_ENERGY>\n0\n\n> <PUBCHEM_FEATURE_SELFOVERLAP>\n0\n\n> <PUBCHEM_SHAPE_FINGERPRINT>\n260 1 18410856563934756871\n\n> <PUBCHEM_SHAPE_MULTIPOLES>\n24.43\n0.69\n0.69\n0.69\n0\n0\n0\n0\n0\n0\n0\n0\n0\n0\n\n> <PUBCHEM_SHAPE_SELFOVERLAP>\n23.32\n\n> <PUBCHEM_SHAPE_VOLUME>\n24.4\n\n> <PUBCHEM_COORDINATE_TYPE>\n10\n5\n2\n\n$$$$\n",
  },
];
/**
 * Cómo genera PubChem estos confórmeros. Citas textuales de las notas de la versión de PubChem3D
 * (archivo consultado el 2026-10-18; en él figura «2024 Aug 21 - PubChem3D version 2.2 release»).
 */
export const PUBCHEM3D_METHOD = {
  sourceUrl: 'https://ftp.ncbi.nlm.nih.gov/pubchem/Compound_3D/Release_notes.txt',
  retrieved: RETRIEVED,
  quotes: [
    'PubChem generates [1-3] a computed 3-D description of each compound in the PubChem Compound database that is not too large (<= 50 non-hydrogen atoms), is not too flexible (<= 15 rotatable bonds), consists of only organic elements (H, C, N, O, F, Si, P, S, Cl, Br, and I), has a single covalent unit (i.e., not a salt or a mixture), and contains only atom types recognized by the MMFF94s force field [4-5].',
    'Each computed 3-D conformer is not at an energy minimum and may not represent the lowest energetic form in vacuum, solvent, or a binding pocket.',
  ],
  /** Referencias [1-5] de esas notas: OMEGA (OpenEye) y el campo de fuerza MMFF94s (Halgren). */
  software: 'OEOmega 2.2–2.4 (OpenEye Scientific Software) y campo de fuerza MMFF94 / MMFF94s (Halgren, J. Comp. Chem. 1996;17:490-519 y 1999;20:720-729).',
  /** Traducción libre al español para la interfaz. */
  resumen: 'PubChem calcula (no mide) una descripción 3D de cada compuesto pequeño (hasta 50 átomos distintos del hidrógeno y 15 enlaces rotables) formado solo por H, C, N, O, F, Si, P, S, Cl, Br o I y con tipos de átomo reconocidos por el campo de fuerza MMFF94s. Según PubChem, cada confórmero calculado no está en un mínimo de energía y puede no representar la forma de menor energía en el vacío, en un solvente o en un sitio de unión.',
} as const;

/**
 * Moléculas clásicas de VSEPR que se buscaron el 2026-10-18 y NO tienen confórmero 3D en PubChem: la descarga
 * `record_type=3d` respondió «Status: 404 / PUGREST.NotFound». Se excluyen en lugar de dibujarlas a mano.
 * (El boro no está en la lista de elementos de PubChem3D; para PCl₅ y SF₆ la causa probable es que sus tipos de
 * átomo no están en MMFF94s; por verificar.)
 */
export const MISSING_3D: { name: string; formula: string; cid: number }[] = [
  { name: 'Trifluoruro de boro', formula: 'BF3', cid: 6356 },
  { name: 'Pentacloruro de fósforo', formula: 'Cl5P', cid: 24819 },
  { name: 'Hexafluoruro de azufre', formula: 'F6S', cid: 17358 },
];

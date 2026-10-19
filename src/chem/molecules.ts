/**
 * Biblioteca de moléculas e iones del kit de química 3D.
 *
 * Formato común (`ChemMolecule`): { id, nombre (es), nombreIupac, formula, cid, smiles, sdf (3D), fuente: { url, fecha, sha256 } }.
 *  - Moléculas con confórmero 3D en PubChem: SDF sin modificar descargado por scripts/validacion/quimica_fetch.mjs
 *    (src/data/quimica/molecules3d.ts). Rótulo: «Modelo calculado: confórmero 3D de PubChem (MMFF94s)».
 *  - Especies sin confórmero en PubChem (iones, H₂, NO, NO₂, HClO₂, HClO₃, HClO₄…): geometría VSEPR calculada por
 *    el kit (src/chem/species.ts) con método declarado; `cid` es el de PubChem cuando la especie neutra existe allí
 *    (obtenido por el mismo script), o null para iones; `fuente` es null porque el SDF lo escribe el kit.
 * Nunca se dibujan coordenadas a mano.
 */
import { PUBCHEM_MISSING_3D, PUBCHEM_RECORDS } from '../data/quimica/molecules3d';
import {
  buildVsepr, PUBCHEM_GEOMETRY_LABEL, singleAtom, speciesFromSdf, toSdf, VSEPR_METHOD, type Species3D, type VseprSpec,
} from './species';

export interface ChemMolecule {
  id: string;
  nombre: string;
  nombreIupac: string;
  /** Fórmula para mostrar (Unicode, como se escribe en clase: H₂SO₄, NH₄⁺). */
  formula: string;
  /** CID de PubChem (null si la especie no tiene registro propio en PubChem, p. ej. un ion). */
  cid: number | null;
  smiles: string;
  /** SDF V2000 con coordenadas 3D. */
  sdf: string;
  /** Procedencia del archivo: solo para los SDF descargados de PubChem. */
  fuente: { url: string; fecha: string; sha256: string } | null;
  /** Rótulo visible de la geometría. */
  geometria: string;
  categoria: 'inorganica' | 'organica' | 'ion';
}

/** Fórmulas como se escriben en clase (PubChem usa el orden de Hill: H2O4S, ClH…). */
const DISPLAY: Record<string, string> = {
  agua: 'H₂O', oxigeno: 'O₂', hidrogeno: 'H₂', nitrogeno: 'N₂', cloro: 'Cl₂', hcl: 'HCl', hf: 'HF', hbr: 'HBr', hi: 'HI',
  h2s: 'H₂S', amoniaco: 'NH₃', co: 'CO', co2: 'CO₂', so2: 'SO₂', so3: 'SO₃', no: 'NO', no2: 'NO₂', n2o: 'N₂O', n2o3: 'N₂O₃',
  n2o5: 'N₂O₅', h2o2: 'H₂O₂', hno3: 'HNO₃', hno2: 'HNO₂', h2so4: 'H₂SO₄', h2so3: 'H₂SO₃', h3po4: 'H₃PO₄', h2co3: 'H₂CO₃',
  hclo: 'HClO', hclo2: 'HClO₂', hclo3: 'HClO₃', hclo4: 'HClO₄', cl2o: 'Cl₂O', cl2o7: 'Cl₂O₇', p4o10: 'P₄O₁₀', p4o6: 'P₄O₆',
  metano: 'CH₄', etano: 'C₂H₆', propano: 'C₃H₈', butano: 'C₄H₁₀', eteno: 'C₂H₄', etino: 'C₂H₂', benceno: 'C₆H₆',
  metanol: 'CH₃OH', etanol: 'C₂H₅OH', glucosa: 'C₆H₁₂O₆',
};

const fromPubChem: ChemMolecule[] = PUBCHEM_RECORDS.map((r) => ({
  id: r.id, nombre: r.nombre, nombreIupac: r.nombreIupac, formula: DISPLAY[r.id] ?? r.formula, cid: r.cid, smiles: r.smiles,
  sdf: r.sdf, fuente: { url: r.url, fecha: r.fecha, sha256: r.sha256 }, geometria: PUBCHEM_GEOMETRY_LABEL,
  categoria: r.categoria,
}));

const missing = (id: string) => PUBCHEM_MISSING_3D.find((m) => m.id === id);

/* ------------------------------------------------------------------ especies VSEPR (sin confórmero en PubChem) */

const O = (order: 1 | 1.5 | 2 | 3, extra: Partial<VseprSpec['ligands'][number]> = {}) => ({ el: 'O', order, ...extra });

/** Especificaciones VSEPR. Los oxoaniones del 2.º período (C, N) usan el promedio sencillo/doble para la longitud
 *  X–O deslocalizada; los del 3.er período o mayor (P, S, Cl, Mn, Cr), la longitud de enlace doble. */
const VSEPR: (VseprSpec & { iupac: string; smiles: string; categoria: ChemMolecule['categoria'] })[] = [
  // Neutras sin confórmero 3D en PubChem (comprobado por el script: respuesta 404).
  { id: 'hidrogeno', name: 'Hidrógeno (dihidrógeno)', label: 'H₂', center: 'H', ligands: [{ el: 'H', order: 1 }], lonePairs: 0, iupac: 'dihidrógeno', smiles: '[HH]', categoria: 'inorganica' },
  { id: 'no', name: 'Monóxido de nitrógeno', label: 'NO', center: 'N', ligands: [O(2)], lonePairs: 1, iupac: 'monóxido de nitrógeno (radical)', smiles: '[N]=O', categoria: 'inorganica' },
  { id: 'no2', name: 'Dióxido de nitrógeno', label: 'NO₂', center: 'N', ligands: [O(2, { lengthOrder: 1.5 }), O(1, { lengthOrder: 1.5 })], lonePairs: 1, iupac: 'dióxido de nitrógeno (radical)', smiles: '[O-][N+]=O', categoria: 'inorganica' },
  { id: 'hclo2', name: 'Ácido cloroso', label: 'HClO₂', center: 'Cl', ligands: [O(2), O(1, { h: 1 })], lonePairs: 2, iupac: 'hidroxido(oxido)cloro', smiles: 'OCl=O', categoria: 'inorganica' },
  { id: 'hclo3', name: 'Ácido clórico', label: 'HClO₃', center: 'Cl', ligands: [O(2), O(2), O(1, { h: 1 })], lonePairs: 1, iupac: 'hidroxidodioxidocloro', smiles: 'OCl(=O)=O', categoria: 'inorganica' },
  { id: 'hclo4', name: 'Ácido perclórico', label: 'HClO₄', center: 'Cl', ligands: [O(2), O(2), O(2), O(1, { h: 1 })], lonePairs: 0, iupac: 'hidroxidotrioxidocloro', smiles: 'OCl(=O)(=O)=O', categoria: 'inorganica' },
  // Iones (no tienen confórmero propio en PubChem).
  { id: 'hidroxido', name: 'Ion hidróxido', label: 'OH⁻', center: 'O', centerCharge: -1, ligands: [{ el: 'H', order: 1 }], lonePairs: 3, iupac: 'hidróxido', smiles: '[OH-]', categoria: 'ion' },
  { id: 'hidronio', name: 'Ion oxonio (hidronio)', label: 'H₃O⁺', center: 'O', centerCharge: 1, ligands: [{ el: 'H', order: 1 }, { el: 'H', order: 1 }, { el: 'H', order: 1 }], lonePairs: 1, iupac: 'oxidanio', smiles: '[OH3+]', categoria: 'ion' },
  { id: 'amonio', name: 'Ion amonio', label: 'NH₄⁺', center: 'N', centerCharge: 1, ligands: [{ el: 'H', order: 1 }, { el: 'H', order: 1 }, { el: 'H', order: 1 }, { el: 'H', order: 1 }], lonePairs: 0, iupac: 'azanio', smiles: '[NH4+]', categoria: 'ion' },
  { id: 'sulfato', name: 'Ion sulfato', label: 'SO₄²⁻', center: 'S', ligands: [O(2), O(2), O(1, { charge: -1, lengthOrder: 2 }), O(1, { charge: -1, lengthOrder: 2 })], lonePairs: 0, iupac: 'tetraoxidosulfato(2−)', smiles: '[O-]S(=O)(=O)[O-]', categoria: 'ion' },
  { id: 'hidrogenosulfato', name: 'Ion hidrogenosulfato', label: 'HSO₄⁻', center: 'S', ligands: [O(2), O(2), O(1, { charge: -1, lengthOrder: 2 }), O(1, { h: 1 })], lonePairs: 0, iupac: 'hidrogeno(tetraoxidosulfato)(1−)', smiles: 'OS(=O)(=O)[O-]', categoria: 'ion' },
  { id: 'sulfito', name: 'Ion sulfito', label: 'SO₃²⁻', center: 'S', ligands: [O(2), O(1, { charge: -1, lengthOrder: 2 }), O(1, { charge: -1, lengthOrder: 2 })], lonePairs: 1, iupac: 'trioxidosulfato(2−)', smiles: '[O-]S(=O)[O-]', categoria: 'ion' },
  { id: 'nitrato', name: 'Ion nitrato', label: 'NO₃⁻', center: 'N', centerCharge: 1, ligands: [O(2, { lengthOrder: 1.5 }), O(1, { charge: -1, lengthOrder: 1.5 }), O(1, { charge: -1, lengthOrder: 1.5 })], lonePairs: 0, iupac: 'trioxidonitrato(1−)', smiles: '[O-][N+](=O)[O-]', categoria: 'ion' },
  { id: 'nitrito', name: 'Ion nitrito', label: 'NO₂⁻', center: 'N', ligands: [O(2, { lengthOrder: 1.5 }), O(1, { charge: -1, lengthOrder: 1.5 })], lonePairs: 1, iupac: 'dioxidonitrato(1−)', smiles: 'N(=O)[O-]', categoria: 'ion' },
  { id: 'carbonato', name: 'Ion carbonato', label: 'CO₃²⁻', center: 'C', ligands: [O(2, { lengthOrder: 1.5 }), O(1, { charge: -1, lengthOrder: 1.5 }), O(1, { charge: -1, lengthOrder: 1.5 })], lonePairs: 0, iupac: 'trioxidocarbonato(2−)', smiles: 'C(=O)([O-])[O-]', categoria: 'ion' },
  { id: 'hidrogenocarbonato', name: 'Ion hidrogenocarbonato (bicarbonato)', label: 'HCO₃⁻', center: 'C', ligands: [O(2), O(1, { charge: -1, lengthOrder: 1.5 }), O(1, { h: 1 })], lonePairs: 0, iupac: 'hidrogeno(trioxidocarbonato)(1−)', smiles: 'C(=O)(O)[O-]', categoria: 'ion' },
  { id: 'fosfato', name: 'Ion fosfato', label: 'PO₄³⁻', center: 'P', ligands: [O(2), O(1, { charge: -1, lengthOrder: 2 }), O(1, { charge: -1, lengthOrder: 2 }), O(1, { charge: -1, lengthOrder: 2 })], lonePairs: 0, iupac: 'tetraoxidofosfato(3−)', smiles: '[O-]P(=O)([O-])[O-]', categoria: 'ion' },
  { id: 'perclorato', name: 'Ion perclorato', label: 'ClO₄⁻', center: 'Cl', ligands: [O(2), O(2), O(2), O(1, { charge: -1, lengthOrder: 2 })], lonePairs: 0, iupac: 'tetraoxidoclorato(1−)', smiles: '[O-]Cl(=O)(=O)=O', categoria: 'ion' },
  { id: 'clorato', name: 'Ion clorato', label: 'ClO₃⁻', center: 'Cl', ligands: [O(2), O(2), O(1, { charge: -1, lengthOrder: 2 })], lonePairs: 1, iupac: 'trioxidoclorato(1−)', smiles: '[O-]Cl(=O)=O', categoria: 'ion' },
  { id: 'clorito', name: 'Ion clorito', label: 'ClO₂⁻', center: 'Cl', ligands: [O(2), O(1, { charge: -1, lengthOrder: 2 })], lonePairs: 2, iupac: 'dioxidoclorato(1−)', smiles: '[O-]Cl=O', categoria: 'ion' },
  { id: 'hipoclorito', name: 'Ion hipoclorito', label: 'ClO⁻', center: 'Cl', ligands: [O(1, { charge: -1 })], lonePairs: 3, iupac: 'oxidoclorato(1−)', smiles: '[O-]Cl', categoria: 'ion' },
  { id: 'permanganato', name: 'Ion permanganato', label: 'MnO₄⁻', center: 'Mn', ligands: [O(2), O(2), O(2), O(1, { charge: -1, lengthOrder: 2 })], lonePairs: 0, iupac: 'tetraoxidomanganato(1−)', smiles: '[O-][Mn](=O)(=O)=O', categoria: 'ion' },
  { id: 'cromato', name: 'Ion cromato', label: 'CrO₄²⁻', center: 'Cr', ligands: [O(2), O(2), O(1, { charge: -1, lengthOrder: 2 }), O(1, { charge: -1, lengthOrder: 2 })], lonePairs: 0, iupac: 'tetraoxidocromato(2−)', smiles: '[O-][Cr](=O)(=O)[O-]', categoria: 'ion' },
];

const fromVsepr: ChemMolecule[] = VSEPR.map((v) => {
  const s = buildVsepr(v);
  return {
    id: v.id, nombre: v.name, nombreIupac: v.iupac, formula: v.label, cid: missing(v.id)?.cid ?? null, smiles: v.smiles,
    sdf: toSdf(s), fuente: null, geometria: s.geometryLabel, categoria: v.categoria,
  };
});

/** Todas las moléculas e iones del kit (las de PubChem primero). */
export const MOLECULES: ChemMolecule[] = [...fromPubChem, ...fromVsepr.filter((v) => !fromPubChem.some((p) => p.id === v.id))];

/** Especies buscadas sin confórmero 3D en PubChem y sin geometría en el kit (se informan, no se dibujan). */
export const WITHOUT_GEOMETRY = PUBCHEM_MISSING_3D.filter((m) => !MOLECULES.some((x) => x.id === m.id));

export function getMolecule(id: string): ChemMolecule {
  const m = MOLECULES.find((x) => x.id === id);
  if (!m) throw new RangeError(`El kit no tiene la molécula «${id}».`);
  return m;
}

/** Convierte una molécula de la biblioteca en especie 3D (para Molecule3D y Reaction3D). */
export function moleculeSpecies(id: string): Species3D {
  const m = getMolecule(id);
  const pub = m.fuente !== null;
  return speciesFromSdf(m.sdf, {
    id: m.id, name: m.nombre, label: m.formula,
    geometry: pub ? 'pubchem' : 'vsepr',
    geometryLabel: m.geometria,
    method: pub ? 'Confórmero 3D calculado por PubChem3D (OMEGA y campo de fuerza MMFF94s); no es una estructura medida.' : VSEPR_METHOD,
    ...(pub ? { source: { cid: m.cid ?? undefined, url: m.fuente!.url, fecha: m.fuente!.fecha, sha256: m.fuente!.sha256 } } : {}),
  });
}

/** Átomos aislados de metales y no metales para las reacciones (Mg, Na, Ca, Fe, C, S…). */
export function atomSpecies(el: string, name: string): Species3D {
  return singleAtom(`atomo-${el}`, name, el);
}

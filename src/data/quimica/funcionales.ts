/**
 * Biblioteca de moléculas de las prácticas de funciones orgánicas (grupos-oxigenados, grupos-nitrogenados, reacciones-organicas).
 * Datos GENERADOS por scripts/validacion/funcionales_pubchem.py (PubChem PUG REST y PUG View); no se editan a mano.
 *  - Confórmero 3D: bloque molfile del SDF de PubChem (record_type=3d), con el SHA-256 del archivo completo descargado y el del bloque
 *    guardado (verificado en tests/unit/functionalData.test.ts).
 *  - Propiedades experimentales: texto literal de PubChem PUG View, la base de origen (sobre todo HSDB) y la obra que cita, con una
 *    regla de selección fija (ver el script).
 * Formato común del kit (src/chem/README.md: { id, nombre, nombreIupac, formula, cid, smiles, sdf, fuente }) + `propiedades`.
 */
import raw from './funcionales-moleculas.json';
import { PUBCHEM_GEOMETRY_LABEL, speciesFromSdf, type Species3D } from '../../chem/species';
import type { ChemMolecule } from '../../chem/molecules';

export interface FProp {
  valor: number; unidad: string; texto: string; cita: string; base: string; regla: number; url: string; fecha: string;
  temperatura?: number; estado?: string; nota?: string; conversion?: string;
}
export interface FSolubility {
  tipo: 'miscible' | 'valor'; valor?: number; unidad?: string; aprox?: string; temperatura?: number;
  texto: string; cita: string; base: string; regla: number; url: string; fecha: string;
}
export interface FPka {
  tipo: 'pKa' | 'pKb'; valor: number; valores?: number[]; acidoConjugado?: boolean; temperatura?: number;
  texto: string; cita: string; base: string; regla: number; url: string; fecha: string;
}

export interface FRecord {
  id: string; nombre: string; nombreIupac: string; formula: string; cid: number; smiles: string; masaMolar: number;
  grupo: string; categoria: 'organica'; sdf: string | null;
  fuente: { url: string; fecha: string; sha256: string | null; sha256Bloque: string | null };
  propiedades: { tEb: FProp | null; tFus: FProp | null; densidad: FProp | null; solubilidad: FSolubility | null; pKa: FPka | null; dHc: FProp | null };
}

const DATA = raw as unknown as { _generado: string; moleculas: FRecord[] };
export const FUNC_RECORDS: FRecord[] = DATA.moleculas;
export const FUNC_GENERATED = DATA._generado;
export const FUNC_DATE = FUNC_RECORDS[0]?.fuente.fecha ?? '';

export function getFunc(id: string): FRecord {
  const r = FUNC_RECORDS.find((x) => x.id === id);
  if (!r) throw new RangeError(`No hay datos de «${id}» en la biblioteca de funciones orgánicas.`);
  return r;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
/** Fórmula de Hill con subíndices Unicode («C2H6O» → «C₂H₆O»). */
export const prettyFormula = (f: string) => f.replace(/\d+/g, (d) => [...d].map((c) => SUB[Number(c)]).join(''));

export const FUNC_PUBCHEM_METHOD = 'Confórmero 3D calculado por PubChem3D (OMEGA y campo de fuerza MMFF94s); no es una estructura medida.';

/** Especie 3D del kit (Molecule3D, Reaction3D) a partir del confórmero de PubChem. */
export function funcSpecies(id: string, name?: string): Species3D {
  const r = getFunc(id);
  if (!r.sdf) throw new RangeError(`«${id}» no tiene confórmero 3D en PubChem.`);
  return speciesFromSdf(r.sdf, {
    id: `fn-${r.id}`, name: name ?? r.nombre, label: prettyFormula(r.formula), geometry: 'pubchem', geometryLabel: PUBCHEM_GEOMETRY_LABEL,
    method: FUNC_PUBCHEM_METHOD, source: { cid: r.cid, url: r.fuente.url, fecha: r.fuente.fecha, sha256: r.fuente.sha256 ?? undefined },
  });
}

/** El registro en el formato común `ChemMolecule` del kit. */
export function asChemMolecule(id: string): ChemMolecule {
  const r = getFunc(id);
  return {
    id: r.id, nombre: r.nombre, nombreIupac: r.nombreIupac, formula: prettyFormula(r.formula), cid: r.cid, smiles: r.smiles, sdf: r.sdf ?? '',
    fuente: r.fuente.sha256 ? { url: r.fuente.url, fecha: r.fuente.fecha, sha256: r.fuente.sha256 } : null, geometria: PUBCHEM_GEOMETRY_LABEL, categoria: 'organica',
  };
}

export const pubchemUrl = (cid: number) => `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;

/** Nombre corto de la base de origen para la interfaz. */
export const baseShort = (b: string) => (b.includes('Hazardous Substances') ? 'HSDB' : b.includes('Human Metabolome') ? 'HMDB' : b.includes('ILO-WHO') ? 'ICSC (OIT-OMS)' : b);

/** Cita corta de la obra que cita HSDB (para tablas): «CRC Handbook (95.ª ed.)», «Riddick et al.», «Ullmann». */
export function shortCite(cita: string): string {
  if (/CRC Handbook|Handbook of Chemistry and Physics/.test(cita)) { const m = cita.match(/(\d+)(?:st|nd|rd|th) (?:Edition|ed)/i); return `CRC Handbook${m ? ` (${m[1]}.ª ed.)` : ''}`; }
  if (/Riddick/.test(cita)) return 'Riddick et al. (Techniques of Chemistry)';
  if (/Ullmann/.test(cita)) return 'Ullmann\'s Encyclopedia';
  if (/Merck Index/.test(cita)) return 'Merck Index';
  if (/Perrin/i.test(cita)) return 'Perrin (IUPAC)';
  if (/Serjeant/i.test(cita)) return 'Serjeant y Dempsey (IUPAC)';
  return cita.split(/[.;]/)[0].slice(0, 40);
}

/**
 * Biblioteca de moléculas de las prácticas de química orgánica (hidrocarburos y aromáticos).
 * Datos GENERADOS por scripts/validacion/organica_pubchem.py (PubChem PUG REST y PUG View); no se editan a mano.
 *  - Confórmero 3D: SDF de PubChem sin modificar (SHA-256 verificado en tests/unit/organicData.test.ts).
 *  - Propiedades experimentales: texto literal de PubChem PUG View con la base de origen (sobre todo HSDB) y la obra que cita.
 * El formato de cada registro es el común del kit (src/chem/README.md: { id, nombre, nombreIupac, formula, cid, smiles, sdf,
 * fuente: { url, fecha, sha256 } }) más `propiedades`. `orgSpecies()` (organicaSpecies.ts) lo convierte en `Species3D` del kit.
 * Este módulo no depende del kit 3D: los modelos y las fichas pueden importarlo sin arrastrar componentes de interfaz.
 */
import raw from './organica-moleculas.json';

export interface PropValue {
  valor: number;
  unidad: string;
  /** Texto literal de PubChem. */
  texto: string;
  /** Obra citada por la base de datos (p. ej. CRC Handbook of Chemistry and Physics, 94.ª ed.). */
  cita: string;
  /** Base de datos de origen dentro de PubChem (p. ej. Hazardous Substances Data Bank). */
  base: string;
  /** Regla de selección aplicada (1 = HSDB con CRC; 2 = otra de HSDB; 3 = otra fuente). */
  regla: number;
  url: string;
  fecha: string;
  temperatura?: number;
  estado?: string;
  todos?: { kJmol: number; estado: string }[];
}

export interface OrganicRecord {
  id: string; nombre: string; nombreIupac: string; formula: string; cid: number; smiles: string; title: string; query: string;
  categoria: 'organica'; grupo: string; url: string; fecha: string; sha256: string | null; sdf: string | null;
  fuente: { url: string; fecha: string; sha256: string | null };
  propiedades: { tEb: PropValue | null; tFus: PropValue | null; densidad: PropValue | null; dHc: PropValue | null };
}

export const ORGANIC_RECORDS: OrganicRecord[] = (raw as unknown as { moleculas: OrganicRecord[] }).moleculas;
export const ORGANIC_GENERATED: string = (raw as unknown as { _generado: string })._generado;

export function getOrganic(id: string): OrganicRecord {
  const r = ORGANIC_RECORDS.find((x) => x.id === id);
  if (!r) throw new RangeError(`No hay datos de «${id}» en la biblioteca orgánica.`);
  return r;
}

const SUB: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
/** Fórmula de Hill de PubChem con subíndices y carga en Unicode («C5H5-» → «C₅H₅⁻»). */
export function prettyHill(f: string): string {
  return f.replace(/(\d+)/g, (d) => d.split('').map((c) => SUB[c]).join('')).replace(/\+$/, '⁺').replace(/-$/, '⁻');
}

export const pubchemPage = (cid: number) => `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;

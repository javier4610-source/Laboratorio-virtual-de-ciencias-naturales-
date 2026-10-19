/**
 * Puente entre la biblioteca orgánica (organica.ts) y el kit 3D (src/chem): especies para Molecule3D y Reaction3D y el formato
 * común `ChemMolecule`. Se separa para que los modelos y las fichas no importen el kit.
 */
import { PUBCHEM_GEOMETRY_LABEL, speciesFromSdf, type ChemMolecule, type Species3D } from '../../chem';
import { getOrganic, prettyHill } from './organica';

export const PUBCHEM_METHOD = 'Confórmero 3D calculado por PubChem3D (OMEGA y campo de fuerza MMFF94s); no es una estructura medida.';

/** Especie 3D del kit a partir de un registro (geometría «Modelo calculado: confórmero 3D de PubChem»). */
export function orgSpecies(id: string, name?: string): Species3D {
  const r = getOrganic(id);
  if (!r.sdf) throw new RangeError(`«${id}» no tiene confórmero 3D en PubChem.`);
  return speciesFromSdf(r.sdf, {
    id: `org-${r.id}`, name: name ?? r.nombre, label: prettyHill(r.formula), geometry: 'pubchem', geometryLabel: PUBCHEM_GEOMETRY_LABEL,
    method: PUBCHEM_METHOD, source: { cid: r.cid, url: r.url, fecha: r.fecha, sha256: r.sha256 ?? undefined },
  });
}

/** El registro en el formato común `ChemMolecule` del kit. */
export function asChemMolecule(id: string): ChemMolecule {
  const r = getOrganic(id);
  return {
    id: r.id, nombre: r.nombre, nombreIupac: r.nombreIupac, formula: prettyHill(r.formula), cid: r.cid, smiles: r.smiles, sdf: r.sdf ?? '',
    fuente: r.sha256 ? { url: r.url, fecha: r.fecha, sha256: r.sha256 } : null, geometria: PUBCHEM_GEOMETRY_LABEL, categoria: 'organica',
  };
}


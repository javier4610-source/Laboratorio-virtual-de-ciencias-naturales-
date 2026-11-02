/**
 * Especies 3D del kit (src/chem) para las fórmulas de las prácticas de química del lote 3D-1 (balanceo, conservación,
 * estequiometría, mol y soluciones). Solo usa lo que ya está en el repositorio:
 *  - confórmeros de PubChem de la biblioteca del kit (moleculeSpecies) y de la de funciones orgánicas (ácido acético);
 *  - iones VSEPR del kit (OH⁻, HCO₃⁻, CO₃²⁻, PO₄³⁻, MnO₄⁻, SO₄²⁻, H₃O⁺) e iones monoatómicos (singleAtom);
 *  - fragmentos de red del kit (Al₂O₃, corindón) y átomos aislados (Fe, Al, Zn, Cu).
 * Los compuestos iónicos se dibujan como iones separados (ionAssembly, rotulado como ilustración).
 *
 * Sin geometría en el repositorio (no se dibujan; la vista lo dice): sacarosa (C₁₂H₂₂O₁₁), ácido cítrico y citrato de
 * sodio. El ion acetato no tiene confórmero propio: se obtiene del confórmero de PubChem del ácido acético quitando el
 * H del grupo –COOH (ver `acetateFrom`), con un rótulo que lo dice.
 */
import { atomSpecies, getCrystal, ionAssembly, latticeFragment, moleculeSpecies, singleAtom, type Species3D } from '../../chem';

const ion = (id: string) => moleculeSpecies(id);
const mono = (el: string, q: number, name: string, label: string) => singleAtom(`${el.toLowerCase()}${q > 0 ? '+' : '-'}${Math.abs(q)}`, name, el, q, label);
const na = () => mono('Na', 1, 'Ion sodio', 'Na⁺');
const k = () => mono('K', 1, 'Ion potasio', 'K⁺');
const cl = () => mono('Cl', -1, 'Ion cloruro', 'Cl⁻');
const ca = () => mono('Ca', 2, 'Ion calcio', 'Ca²⁺');
const cu = () => mono('Cu', 2, 'Ion cobre(II)', 'Cu²⁺');
const fe2 = () => mono('Fe', 2, 'Ion hierro(II)', 'Fe²⁺');
const fe3 = () => mono('Fe', 3, 'Ion hierro(III)', 'Fe³⁺');
const zn = () => mono('Zn', 2, 'Ion cinc', 'Zn²⁺');
const ox = () => mono('O', -2, 'Ion óxido', 'O²⁻');

/** Rótulo del ion acetato derivado del ácido acético (no es un confórmero propio). */
export const ACETATE_LABEL = 'Ilustración educativa: ion acetato obtenido al quitar el H ácido (–COOH) del confórmero de PubChem del ácido acético, sin volver a optimizar la geometría';

/** Ion acetato a partir del confórmero del ácido acético: se quita el H unido a un O y ese O queda con carga −1. */
export function acetateFrom(acid: Species3D): Species3D {
  const hIdx = acid.atoms.findIndex((a, i) => a.el === 'H' && acid.bonds.some((b) => (b.a === i && acid.atoms[b.b].el === 'O') || (b.b === i && acid.atoms[b.a].el === 'O')));
  if (hIdx < 0) throw new RangeError('El ácido no tiene un H unido a O.');
  const bondO = acid.bonds.find((b) => b.a === hIdx || b.b === hIdx)!;
  const oIdx = bondO.a === hIdx ? bondO.b : bondO.a;
  const map = (i: number) => (i > hIdx ? i - 1 : i);
  const atoms = acid.atoms.filter((_, i) => i !== hIdx).map((a, i) => (map(oIdx) === i ? { ...a, charge: -1 } : { ...a }));
  const bonds = acid.bonds.filter((b) => b.a !== hIdx && b.b !== hIdx).map((b) => ({ ...b, a: map(b.a), b: map(b.b) }));
  return { id: 'acetato', name: 'Ion acetato', label: 'CH₃COO⁻', atoms, bonds, charge: -1, geometry: 'pubchem', geometryLabel: ACETATE_LABEL, method: `${acid.method} Se quitó el H del grupo carboxilo; las dos distancias C–O no se igualaron.`, ...(acid.source ? { source: acid.source } : {}) };
}

/** Datos que se cargan aparte (la biblioteca de funciones orgánicas pesa ≈ 470 KB y solo hace falta para el ácido acético). */
export interface ExtraSpecies { aceticAcid: Species3D | null }

/** Fórmulas que necesitan la biblioteca de funciones orgánicas (carga diferida). */
export const NEEDS_ORGANIC = new Set(['CH3COOH', 'CH3COONa']);

/** Carga diferida del ácido acético (confórmero de PubChem de la biblioteca de funciones orgánicas). */
export async function loadExtraSpecies(): Promise<ExtraSpecies> {
  const m = await import('../../data/quimica/funcionales');
  return { aceticAcid: m.funcSpecies('acido-etanoico', 'Ácido acético') };
}

/** Fórmulas sin geometría 3D en el repositorio (la vista lo explica en lugar de dibujarlas). */
export const NO_GEOMETRY: Record<string, string> = {
  C12H22O11: 'la sacarosa no tiene confórmero 3D en la biblioteca del repositorio',
  C6H8O7: 'el ácido cítrico no tiene confórmero 3D en la biblioteca del repositorio',
  Na3C6H5O7: 'el citrato de sodio no tiene geometría 3D en la biblioteca del repositorio',
};

/**
 * Especie 3D de una fórmula ASCII (la misma notación de los modelos: «H2O», «Ca(OH)2», «CH3COONa»).
 * Devuelve null si el repositorio no tiene geometría para ella (o si falta cargar `extra`).
 */
export function speciesForFormula(formula: string, extra: ExtraSpecies = { aceticAcid: null }): Species3D | null {
  const acid = extra.aceticAcid;
  switch (formula) {
    case 'H2': return moleculeSpecies('hidrogeno');
    case 'O2': return moleculeSpecies('oxigeno');
    case 'N2': return moleculeSpecies('nitrogeno');
    case 'H2O': return moleculeSpecies('agua');
    case 'H2O2': return moleculeSpecies('h2o2');
    case 'HCl': return moleculeSpecies('hcl');
    case 'CO2': return moleculeSpecies('co2');
    case 'CH4': return moleculeSpecies('metano');
    case 'C3H8': return moleculeSpecies('propano');
    case 'C6H12O6': return moleculeSpecies('glucosa');
    case 'H3PO4': return moleculeSpecies('h3po4');
    case 'NH3': return moleculeSpecies('amoniaco');
    case 'H2CO3': return moleculeSpecies('h2co3');
    case 'Fe': return atomSpecies('Fe', 'hierro');
    case 'Al': return atomSpecies('Al', 'aluminio');
    case 'Zn': return atomSpecies('Zn', 'cinc');
    case 'Cu': return atomSpecies('Cu', 'cobre');
    case 'NaCl': return ionAssembly('nacl', 'Cloruro de sodio (Na⁺ y Cl⁻)', 'NaCl', [na(), cl()]);
    case 'NaOH': return ionAssembly('naoh', 'Hidróxido de sodio (Na⁺ y OH⁻)', 'NaOH', [na(), ion('hidroxido')]);
    case 'FeCl2': return ionAssembly('fecl2', 'Cloruro de hierro(II) (Fe²⁺ y 2 Cl⁻)', 'FeCl₂', [cl(), fe2(), cl()]);
    case 'ZnCl2': return ionAssembly('zncl2', 'Cloruro de cinc (Zn²⁺ y 2 Cl⁻)', 'ZnCl₂', [cl(), zn(), cl()]);
    case 'CaCl2': return ionAssembly('cacl2', 'Cloruro de calcio (Ca²⁺ y 2 Cl⁻)', 'CaCl₂', [cl(), ca(), cl()]);
    case 'Al2O3': return latticeFragment(getCrystal('al2o3'), 1);
    case 'Fe2O3': return ionAssembly('fe2o3', 'Óxido de hierro(III) (2 Fe³⁺ y 3 O²⁻)', 'Fe₂O₃', [ox(), fe3(), ox(), fe3(), ox()]);
    case 'Fe3O4': return ionAssembly('fe3o4', 'Óxido de hierro(II, III) (Fe²⁺, 2 Fe³⁺ y 4 O²⁻)', 'Fe₃O₄', [ox(), fe3(), ox(), fe2(), ox(), fe3(), ox()]);
    case 'Ca(OH)2': return ionAssembly('caoh2', 'Hidróxido de calcio (Ca²⁺ y 2 OH⁻)', 'Ca(OH)₂', [ion('hidroxido'), ca(), ion('hidroxido')]);
    case 'Ca3(PO4)2': return ionAssembly('ca3po42', 'Fosfato de calcio (3 Ca²⁺ y 2 PO₄³⁻)', 'Ca₃(PO₄)₂', [ca(), ion('fosfato'), ca(), ion('fosfato'), ca()]);
    case 'NaHCO3': return ionAssembly('nahco3', 'Bicarbonato de sodio (Na⁺ y HCO₃⁻)', 'NaHCO₃', [na(), ion('hidrogenocarbonato')]);
    case 'Na2CO3': return ionAssembly('na2co3', 'Carbonato de sodio (2 Na⁺ y CO₃²⁻)', 'Na₂CO₃', [na(), ion('carbonato'), na()]);
    case 'CaCO3': return ionAssembly('caco3', 'Carbonato de calcio (Ca²⁺ y CO₃²⁻)', 'CaCO₃', [ca(), ion('carbonato')]);
    case 'KMnO4': return ionAssembly('kmno4', 'Permanganato de potasio (K⁺ y MnO₄⁻)', 'KMnO₄', [k(), ion('permanganato')]);
    case 'CuSO4': return ionAssembly('cuso4', 'Sulfato de cobre(II) (Cu²⁺ y SO₄²⁻)', 'CuSO₄', [cu(), ion('sulfato')]);
    case 'CH3COOH': return acid;
    case 'CH3COONa': return acid ? ionAssembly('ch3coona', 'Acetato de sodio (Na⁺ y CH₃COO⁻)', 'CH₃COONa', [na(), acetateFrom(acid)]) : null;
    default: return null;
  }
}

/** Partículas sueltas (iones o molécula) de un soluto al disolverse (para la práctica de soluciones). */
export function dissolvedParticles(formula: string): { species: Species3D; per: number }[] | null {
  switch (formula) {
    case 'NaCl': return [{ species: na(), per: 1 }, { species: cl(), per: 1 }];
    case 'KMnO4': return [{ species: k(), per: 1 }, { species: ion('permanganato'), per: 1 }];
    case 'CuSO4·5H2O': return [{ species: cu(), per: 1 }, { species: ion('sulfato'), per: 1 }];
    case 'C6H12O6': return [{ species: moleculeSpecies('glucosa'), per: 1 }];
    default: return null;
  }
}

export const ions = { na, k, cl, ca, cu };

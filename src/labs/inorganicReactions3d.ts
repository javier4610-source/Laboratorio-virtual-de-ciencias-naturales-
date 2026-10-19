/**
 * Reacciones 3D de las prácticas de química inorgánica (óxidos, hidróxidos, ácidos y sales), construidas con el kit
 * src/chem. Cada especie conserva su procedencia: confórmeros de PubChem, iones VSEPR del kit, fragmentos de red de
 * parámetros publicados o átomos aislados; la disposición de los iones se rotula como ilustración.
 */
import { atomSpecies, getCrystal, ionAssembly, latticeFragment, moleculeSpecies, singleAtom, type Reaction3DDef, type Species3D } from '../chem';

const ion = (id: string) => moleculeSpecies(id);
const na = () => singleAtom('na+', 'Ion sodio', 'Na', 1, 'Na⁺');
const ca2 = () => singleAtom('ca2+', 'Ion calcio', 'Ca', 2, 'Ca²⁺');
const o2m = () => singleAtom('o2-', 'Ion óxido', 'O', -2, 'O²⁻');
const cl = () => singleAtom('cl-', 'Ion cloruro', 'Cl', -1, 'Cl⁻');

let cache: Record<string, Reaction3DDef> | null = null;

function build(): Record<string, Reaction3DDef> {
  const naoh: Species3D = ionAssembly('naoh', 'Hidróxido de sodio (Na⁺ y OH⁻)', 'NaOH', [na(), ion('hidroxido')]);
  const na2o: Species3D = ionAssembly('na2o', 'Óxido de sodio (2 Na⁺ y O²⁻)', 'Na₂O', [na(), o2m(), na()]);
  const caoh2: Species3D = ionAssembly('caoh2', 'Hidróxido de calcio (Ca²⁺ y 2 OH⁻)', 'Ca(OH)₂', [ion('hidroxido'), ca2(), ion('hidroxido')]);
  const nacl: Species3D = ionAssembly('nacl-ion', 'Cloruro de sodio disuelto (Na⁺ y Cl⁻)', 'NaCl', [na(), cl()]);
  const na2so4: Species3D = ionAssembly('na2so4', 'Sulfato de sodio (2 Na⁺ y SO₄²⁻)', 'Na₂SO₄', [na(), ion('sulfato'), na()]);
  const s = atomSpecies('S', 'azufre');
  const c = atomSpecies('C', 'carbono');
  return {
    mgo: { id: 'mgo', title: 'Combustión del magnesio', reactants: [{ species: atomSpecies('Mg', 'magnesio'), coef: 2, formula: 'Mg', name: 'magnesio' }, { species: moleculeSpecies('oxigeno'), coef: 1, formula: 'O2', name: 'oxígeno' }], products: [{ species: latticeFragment(getCrystal('mgo'), 2), coef: 2, formula: 'MgO', perInstance: 2, name: 'óxido de magnesio' }] },
    co2: { id: 'co2', title: 'Combustión del carbono', reactants: [{ species: c, coef: 1, formula: 'C' }, { species: moleculeSpecies('oxigeno'), coef: 1, formula: 'O2' }], products: [{ species: moleculeSpecies('co2'), coef: 1, formula: 'CO2' }] },
    so2: { id: 'so2', title: 'Combustión del azufre', reactants: [{ species: s, coef: 1, formula: 'S' }, { species: moleculeSpecies('oxigeno'), coef: 1, formula: 'O2' }], products: [{ species: moleculeSpecies('so2'), coef: 1, formula: 'SO2' }] },
    h2co3: { id: 'h2co3', title: 'Dióxido de carbono + agua → ácido carbónico', reactants: [{ species: moleculeSpecies('co2'), coef: 1, formula: 'CO2' }, { species: moleculeSpecies('agua'), coef: 1, formula: 'H2O' }], products: [{ species: moleculeSpecies('h2co3'), coef: 1, formula: 'H2CO3' }] },
    h2so3: { id: 'h2so3', title: 'Dióxido de azufre + agua → ácido sulfuroso', reactants: [{ species: moleculeSpecies('so2'), coef: 1, formula: 'SO2' }, { species: moleculeSpecies('agua'), coef: 1, formula: 'H2O' }], products: [{ species: moleculeSpecies('h2so3'), coef: 1, formula: 'H2SO3' }] },
    h2so4: { id: 'h2so4', title: 'Trióxido de azufre + agua → ácido sulfúrico', reactants: [{ species: moleculeSpecies('so3'), coef: 1, formula: 'SO3' }, { species: moleculeSpecies('agua'), coef: 1, formula: 'H2O' }], products: [{ species: moleculeSpecies('h2so4'), coef: 1, formula: 'H2SO4' }] },
    h3po4: { id: 'h3po4', title: 'Decaóxido de tetrafósforo + agua → ácido fosfórico', reactants: [{ species: moleculeSpecies('p4o10'), coef: 1, formula: 'P4O10' }, { species: moleculeSpecies('agua'), coef: 6, formula: 'H2O' }], products: [{ species: moleculeSpecies('h3po4'), coef: 4, formula: 'H3PO4' }] },
    naoh: { id: 'naoh', title: 'Óxido de sodio + agua → hidróxido de sodio', reactants: [{ species: na2o, coef: 1, formula: 'Na2O' }, { species: moleculeSpecies('agua'), coef: 1, formula: 'H2O' }], products: [{ species: naoh, coef: 2, formula: 'NaOH' }] },
    caoh2: { id: 'caoh2', title: 'Óxido de calcio (cal viva) + agua → hidróxido de calcio (cal apagada)', reactants: [{ species: latticeFragment(getCrystal('cao'), 1), coef: 1, formula: 'CaO' }, { species: moleculeSpecies('agua'), coef: 1, formula: 'H2O' }], products: [{ species: caoh2, coef: 1, formula: 'Ca(OH)2' }] },
    hcl: { id: 'hcl', title: 'Hidrógeno + cloro → cloruro de hidrógeno', reactants: [{ species: moleculeSpecies('hidrogeno'), coef: 1, formula: 'H2' }, { species: moleculeSpecies('cloro'), coef: 1, formula: 'Cl2' }], products: [{ species: moleculeSpecies('hcl'), coef: 2, formula: 'HCl' }] },
    hno3: { id: 'hno3', title: 'Pentaóxido de dinitrógeno + agua → ácido nítrico', reactants: [{ species: moleculeSpecies('n2o5'), coef: 1, formula: 'N2O5' }, { species: moleculeSpecies('agua'), coef: 1, formula: 'H2O' }], products: [{ species: moleculeSpecies('hno3'), coef: 2, formula: 'HNO3' }] },
    neutralizacion: { id: 'neutralizacion', title: 'Neutralización: HCl + NaOH → NaCl + H₂O', reactants: [{ species: moleculeSpecies('hcl'), coef: 1, formula: 'HCl' }, { species: naoh, coef: 1, formula: 'NaOH' }], products: [{ species: nacl, coef: 1, formula: 'NaCl' }, { species: moleculeSpecies('agua'), coef: 1, formula: 'H2O' }] },
    sulfato: { id: 'sulfato', title: 'Neutralización: H₂SO₄ + 2 NaOH → Na₂SO₄ + 2 H₂O', reactants: [{ species: moleculeSpecies('h2so4'), coef: 1, formula: 'H2SO4' }, { species: naoh, coef: 2, formula: 'NaOH' }], products: [{ species: na2so4, coef: 1, formula: 'Na2SO4' }, { species: moleculeSpecies('agua'), coef: 2, formula: 'H2O' }] },
  };
}

/** Reacciones 3D por id (se construyen una vez, al primer uso). */
export function inorganicReaction(id: string): Reaction3DDef {
  if (!cache) cache = build();
  const r = cache[id];
  if (!r) throw new RangeError(`Reacción 3D desconocida: ${id}`);
  return r;
}
export const INORGANIC_REACTION_IDS = ['mgo', 'co2', 'so2', 'h2co3', 'h2so3', 'h2so4', 'h3po4', 'naoh', 'caoh2', 'hcl', 'hno3', 'neutralizacion', 'sulfato'] as const;

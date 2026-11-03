/**
 * Vistas 3D de «Cambios físicos y químicos» con el kit de química (src/chem):
 *  - Cambios QUÍMICOS: <Reaction3D> con la ecuación balanceada de cada proceso; los mismos átomos se reorganizan
 *    (se rompen y se forman enlaces) en sustancias nuevas.
 *  - Cambios FÍSICOS: <SpeciesScene3D> con copias de la MISMA molécula (sacarosa o agua) que solo se separan; la
 *    separación sigue el avance del modelo (azúcar disuelta o agua evaporada) y ningún enlace interno se rompe.
 * Las geometrías son confórmeros de PubChem (o del kit) con su procedencia; la disposición es solo de dibujo.
 */
import { atomSpecies, ionAssembly, moleculeSpecies, PUBCHEM_GEOMETRY_LABEL, singleAtom, speciesFromSdf, type Reaction3DDef, type Species3D } from '../chem';
import type { SceneAtom, SceneBond, SceneLabel } from '../chem/sceneLayout';
import { centroid } from '../chem/species';
import { ACETATE_SDF, ACETIC_SDF } from '../data/quimica/acetico-pubchem';
import { SUCROSE_SDF } from '../data/quimica/sacarosa-pubchem';
import { seededRandom } from '../models/math';
import type { ChangeId } from '../models/chemicalChanges';

const METHOD = 'Confórmero 3D calculado por PubChem3D (OMEGA y campo de fuerza MMFF94s); no es una estructura medida.';
const pub = (sdf: string, id: string, name: string, label: string, cid: number, fecha: string): Species3D =>
  speciesFromSdf(sdf, { id, name, label, geometry: 'pubchem', geometryLabel: PUBCHEM_GEOMETRY_LABEL, method: METHOD, source: { cid, url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`, fecha } });
export const sucrose = () => pub(SUCROSE_SDF, 'sacarosa', 'Sacarosa', 'C₁₂H₂₂O₁₁', 5988, '2026-11-01');
const acetic = () => pub(ACETIC_SDF, 'acido-acetico', 'Ácido acético', 'CH₃COOH', 176, '2026-11-03');
const acetate = () => pub(ACETATE_SDF, 'acetato', 'Ion acetato', 'CH₃COO⁻', 175, '2026-11-03');
const na = () => singleAtom('na+', 'Ion sodio', 'Na', 1, 'Na⁺');
const ca = () => singleAtom('ca2+', 'Ion calcio', 'Ca', 2, 'Ca²⁺');
const cl = () => singleAtom('cl-', 'Ion cloruro', 'Cl', -1, 'Cl⁻');
const fe3 = () => singleAtom('fe3+', 'Ion hierro(III)', 'Fe', 3, 'Fe³⁺');
const o2m = () => singleAtom('o2-', 'Ion óxido', 'O', -2, 'O²⁻');

/** Nota de cada reacción 3D (qué se dibuja y qué se simplifica). */
export const REACTION_NOTE: Partial<Record<ChangeId, string>> = {
  'vinagre-bicarbonato': 'El ácido acético cede su H al bicarbonato; el H₂CO₃ que se formaría se descompone enseguida en H₂O y CO₂ (aquí se dibuja la reacción global).',
  precipitado: 'Intercambio de iones: el Ca²⁺ se junta con el CO₃²⁻ y el Na⁺ con el Cl⁻ sin romper enlaces covalentes (el CO₃²⁻ queda entero). Se forma una sustancia nueva, el CaCO₃ sólido; los iones se dibujan por separado (en el sólido forman una red).',
  'oxidacion-hierro': 'Herrumbre simplificada a Fe₂O₃ anhidro (la real tiene agua) con sus iones dibujados por separado.',
  vela: 'La parafina es una mezcla de alcanos de cadena larga (≈ C₂₅H₅₂) sin confórmero 3D en PubChem: se dibuja la combustión del propano, un alcano de la misma familia que arde igual (C y H se unen al O).',
  'quemar-azucar': 'Carbonización simplificada: C₁₂H₂₂O₁₁ → 12 C + 11 H₂O; el carbono se dibuja como átomos sueltos (en el carbón forman capas).',
};

let cache: Partial<Record<ChangeId, Reaction3DDef>> | null = null;
function build(): Partial<Record<ChangeId, Reaction3DDef>> {
  const agua = moleculeSpecies('agua'), co2 = moleculeSpecies('co2'), o2 = moleculeSpecies('oxigeno');
  const nahco3 = ionAssembly('nahco3', 'Bicarbonato de sodio (Na⁺ y HCO₃⁻)', 'NaHCO₃', [na(), moleculeSpecies('hidrogenocarbonato')]);
  const naac = ionAssembly('naac', 'Acetato de sodio disuelto (Na⁺ y CH₃COO⁻)', 'CH₃COONa', [na(), acetate()]);
  const cacl2 = ionAssembly('cacl2', 'Cloruro de calcio disuelto (Ca²⁺ y 2 Cl⁻)', 'CaCl₂', [cl(), ca(), cl()]);
  const na2co3 = ionAssembly('na2co3', 'Carbonato de sodio disuelto (2 Na⁺ y CO₃²⁻)', 'Na₂CO₃', [na(), moleculeSpecies('carbonato'), na()]);
  const caco3 = ionAssembly('caco3', 'Carbonato de calcio (Ca²⁺ y CO₃²⁻)', 'CaCO₃', [ca(), moleculeSpecies('carbonato')]);
  const nacl = ionAssembly('nacl', 'Cloruro de sodio disuelto (Na⁺ y Cl⁻)', 'NaCl', [na(), cl()]);
  const fe2o3 = ionAssembly('fe2o3', 'Óxido de hierro(III) (2 Fe³⁺ y 3 O²⁻)', 'Fe₂O₃', [o2m(), fe3(), o2m(), fe3(), o2m()]);
  return {
    'vinagre-bicarbonato': { id: 'vinagre', title: 'Vinagre + bicarbonato de sodio', reactants: [{ species: nahco3, coef: 1, formula: 'NaHCO3', name: 'bicarbonato de sodio' }, { species: acetic(), coef: 1, formula: 'C2H4O2', name: 'ácido acético' }], products: [{ species: naac, coef: 1, formula: 'C2H3O2Na', name: 'acetato de sodio' }, { species: agua, coef: 1, formula: 'H2O', name: 'agua' }, { species: co2, coef: 1, formula: 'CO2', name: 'dióxido de carbono' }] },
    precipitado: { id: 'precipitado', title: 'Cloruro de calcio + carbonato de sodio', reactants: [{ species: cacl2, coef: 1, formula: 'CaCl2', name: 'cloruro de calcio' }, { species: na2co3, coef: 1, formula: 'Na2CO3', name: 'carbonato de sodio' }], products: [{ species: caco3, coef: 1, formula: 'CaCO3', name: 'carbonato de calcio' }, { species: nacl, coef: 2, formula: 'NaCl', name: 'cloruro de sodio' }] },
    'oxidacion-hierro': { id: 'herrumbre', title: 'Oxidación del hierro', reactants: [{ species: atomSpecies('Fe', 'hierro'), coef: 4, formula: 'Fe', name: 'hierro' }, { species: o2, coef: 3, formula: 'O2', name: 'oxígeno' }], products: [{ species: fe2o3, coef: 2, formula: 'Fe2O3', name: 'óxido de hierro(III)' }] },
    vela: { id: 'vela', title: 'Combustión de un alcano (propano en lugar de la parafina)', reactants: [{ species: moleculeSpecies('propano'), coef: 1, formula: 'C3H8', name: 'propano' }, { species: o2, coef: 5, formula: 'O2', name: 'oxígeno' }], products: [{ species: co2, coef: 3, formula: 'CO2', name: 'dióxido de carbono' }, { species: agua, coef: 4, formula: 'H2O', name: 'agua' }] },
    'quemar-azucar': { id: 'carbonizacion', title: 'Carbonización del azúcar', reactants: [{ species: sucrose(), coef: 1, formula: 'C12H22O11', name: 'sacarosa' }], products: [{ species: atomSpecies('C', 'carbono'), coef: 12, formula: 'C', name: 'carbono' }, { species: agua, coef: 11, formula: 'H2O', name: 'agua' }] },
  };
}
export function changeReaction(id: ChangeId): Reaction3DDef | null {
  if (!cache) cache = build();
  return cache[id] ?? null;
}

/* ------------------------------------------------------------------ cambio físico: las moléculas solo se separan */

export interface PhysicalScene { atoms: SceneAtom[]; bonds: SceneBond[]; labels: SceneLabel[]; description: string; frameKey: string; framePoints: [number, number, number][] }
/**
 * `count` copias de la MISMA molécula: juntas (cristal de azúcar o agua líquida) cuando f = 0 y separadas (disueltas o
 * en el vapor) cuando f = 1, con las posiciones intermedias interpoladas. Las moléculas se trasladan sin deformarse:
 * los enlaces internos (el conteo se informa) no cambian.
 */
export function physicalScene(kind: 'disolver-azucar' | 'hervir-agua', f: number): PhysicalScene {
  const s = kind === 'disolver-azucar' ? sucrose() : moleculeSpecies('agua');
  const count = kind === 'disolver-azucar' ? 4 : 8;
  const cell = kind === 'disolver-azucar' ? 9.5 : 3.1;
  const rnd = seededRandom(kind === 'disolver-azucar' ? 11 : 13);
  const c0 = centroid(s.atoms);
  const atoms: SceneAtom[] = [], bonds: SceneBond[] = [];
  const spread = kind === 'disolver-azucar' ? 2.6 : 3.2;
  const framePoints: [number, number, number][] = [];
  for (let k = 0; k < count; k++) {
    const gx = k % 2, gy = Math.floor(k / 2) % 2, gz = Math.floor(k / 4);
    const packed: [number, number, number] = [(gx - 0.5) * cell, (gy - 0.5) * cell, (gz - (count > 4 ? 0.5 : 0)) * cell];
    const dir: [number, number, number] = [packed[0] + (rnd() - 0.5) * cell, packed[1] + (kind === 'hervir-agua' ? cell * (0.8 + rnd()) : (rnd() - 0.5) * cell), packed[2] + (rnd() - 0.5) * cell];
    const free: [number, number, number] = [dir[0] * spread, dir[1] * spread, dir[2] * spread];
    const o: [number, number, number] = [packed[0] + f * (free[0] - packed[0]), packed[1] + f * (free[1] - packed[1]), packed[2] + f * (free[2] - packed[2])];
    framePoints.push(packed, free);
    const start = atoms.length;
    for (const a of s.atoms) atoms.push({ el: a.el, x: a.x - c0[0] + o[0], y: a.y - c0[1] + o[1], z: a.z - c0[2] + o[2], block: 0, copy: k });
    for (const b of s.bonds) bonds.push({ a: start + b.a, b: start + b.b, order: b.order });
  }
  const pct = Math.round(f * 100);
  const name = kind === 'disolver-azucar' ? 'moléculas de sacarosa' : 'moléculas de agua';
  const labels: SceneLabel[] = [{ text: kind === 'disolver-azucar' ? `sacarosa: ${pct} % disuelta` : `agua: ${pct} % pasó a vapor`, at: [0, cell * (1 + 2 * f) + 2, 0] }];
  const description = `${count} ${name} (${s.label}, confórmero de PubChem) que ${kind === 'disolver-azucar' ? 'se separan del cristal al disolverse en el agua (el agua no se dibuja)' : 'se separan del líquido y suben como vapor'}: ${pct} % del avance del modelo. ` +
    `Cada molécula conserva sus ${s.bonds.length} enlaces: se rompen 0 enlaces dentro de las moléculas y no se forma ninguna sustancia nueva; solo cambia la distancia entre moléculas.`;
  return { atoms, bonds, labels, description, frameKey: `${kind}`, framePoints };
}

/**
 * Convierte una reacción de la biblioteca (src/models/organicReactions.ts) en la definición que usa <Reaction3D> del kit:
 * cada término con su especie 3D (confórmero de PubChem de la biblioteca de funciones, especie del kit o átomo aislado), su
 * coeficiente calculado y su fórmula. Se memoriza por id para que el componente reciba siempre el mismo objeto.
 */
import { atomSpecies, moleculeSpecies, type Reaction3DDef, type Species3D } from '../../chem';
import { funcSpecies } from '../../data/quimica/funcionales';
import type { OrgReaction, RxSpecies } from '../../models/organicReactions';

const cache = new Map<string, Reaction3DDef>();

export function speciesOf(s: RxSpecies): Species3D {
  if (s.source.kind === 'func') return funcSpecies(s.source.id, s.name.charAt(0).toUpperCase() + s.name.slice(1));
  if (s.source.kind === 'kit') return moleculeSpecies(s.source.id);
  return atomSpecies(s.source.el, s.name);
}

export function reaction3dDef(r: OrgReaction): Reaction3DDef {
  const hit = cache.get(r.id);
  if (hit) return hit;
  const nR = r.reactants.length;
  const def: Reaction3DDef = {
    id: r.id, title: r.title,
    reactants: r.reactants.map((s, i) => ({ species: speciesOf(s), coef: r.coefs[i], formula: s.formula, name: s.name })),
    products: r.products.map((s, i) => ({ species: speciesOf(s), coef: r.coefs[nR + i], formula: s.formula, name: s.name })),
  };
  cache.set(r.id, def);
  return def;
}

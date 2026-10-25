/**
 * Resaltados para el visor 3D de grupos funcionales: a partir del confórmero (H explícitos) reconoce los grupos con
 * src/models/functionalGroups.ts y devuelve los átomos de cada uno (con sus H) y su color de dibujo.
 */
import { toSdf, type Species3D } from '../../chem';
import { degreeText, detectGroups, GROUP_LABEL, hBondSites, type FunctionalGroup, type GroupKind } from '../../models/functionalGroups';
import { molFromMolfile, neighbors, type OMolecule } from '../../models/organicGraph';
import type { Highlight } from './FunctionalViewer3D';

/** Colores de dibujo por clase (variables de tema con buen contraste en claro y oscuro). */
export const GROUP_COLOR: Record<GroupKind, string> = {
  acido: 'var(--bad)', ester: 'var(--series-3)', amida: 'var(--series-4)', aldehido: 'var(--warn)', cetona: 'var(--series-5)', alcohol: 'var(--data)',
  fenol: 'var(--series-2)', eter: 'var(--series-6)', amina: 'var(--fis)', nitro: 'var(--series-7)', halogeno: 'var(--ok)', urea: 'var(--series-4)',
};

export function speciesGraph(sp: Species3D): OMolecule {
  return molFromMolfile(toSdf(sp)).mol;
}

const withH = (m: OMolecule, atoms: number[]) => [...new Set([...atoms, ...atoms.flatMap((a) => (m.atoms[a].el === 'C' ? [] : neighbors(m, a).filter((v) => m.atoms[v].el === 'H')))])];

/** Grupos de la especie con los átomos que se resaltan (para el aldehído se incluye su H). */
export function groupsOf(sp: Species3D): { g: FunctionalGroup; atoms: number[] }[] {
  const m = speciesGraph(sp);
  return detectGroups(m).map((g) => {
    let atoms = withH(m, g.atoms);
    if (g.kind === 'aldehido') atoms = [...atoms, ...neighbors(m, g.center).filter((v) => m.atoms[v].el === 'H')];
    if ((g.kind === 'alcohol' || g.kind === 'fenol' || g.kind === 'amina') && g.carrier !== undefined) atoms = [...atoms];
    return { g, atoms };
  });
}

/** Un resaltado por grupo funcional (los halógenos se agrupan). */
export function groupHighlights(sp: Species3D, only?: GroupKind[]): Highlight[] {
  const out = new Map<string, Highlight>();
  for (const { g, atoms } of groupsOf(sp)) {
    if (only && !only.includes(g.kind)) continue;
    const label = GROUP_LABEL[g.kind] + (g.degree && ['alcohol', 'amina', 'amida'].includes(g.kind) && g.degree !== 'metanol' ? ` · ${degreeText(g.kind, g.degree).split(' ')[0]}` : '');
    const prev = out.get(label);
    if (prev) prev.atoms.push(...atoms); else out.set(label, { atoms: [...atoms], color: GROUP_COLOR[g.kind], label });
  }
  return [...out.values()];
}

/** Donadores (los H unidos a O o N) y aceptores (O y N con par libre) de puentes de hidrógeno. */
export function hBondHighlights(sp: Species3D): Highlight[] {
  const m = speciesGraph(sp);
  const s = hBondSites(m);
  const donorH = s.donorAtoms.flatMap((a) => neighbors(m, a).filter((v) => m.atoms[v].el === 'H'));
  const out: Highlight[] = [];
  if (donorH.length) out.push({ atoms: donorH, color: 'var(--data)', label: `Donadores: ${donorH.length} H unido(s) a O o N` });
  if (s.acceptorAtoms.length) out.push({ atoms: s.acceptorAtoms, color: 'var(--series-3)', label: `Aceptores: ${s.acceptorAtoms.length} átomo(s) de O o N con pares libres` });
  return out;
}

/**
 * «mendel» (lote 3D-2): los dos progenitores con sus pares de cromosomas homólogos y el locus de cada gen, y debajo los
 * gametos que forma cada uno (un cromosoma de cada par, con un solo alelo). Funciones PURAS a partir del MISMO estado del
 * laboratorio: los genotipos elegidos, los genes estudiados (uno o dos) y los gametos del modelo (`punnettGametes`, las
 * filas y columnas del cuadro de Punnett; `gametes` para sus probabilidades). En el dihíbrido cada gen está en un par de
 * cromosomas distinto (transmisión independiente, el supuesto del modelo). Formas y posiciones: dibujo.
 */
import { gametes, punnettGametes, type Gene, type Genotype } from '../../models/mendel';
import { fmt } from '../../lib/format';
import type { ColorToken } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';

/** Largo de cada par de cromosomas (el segundo gen está en un cromosoma distinto, más corto). */
const CHROM_LEN = [2.6, 1.8];
const CHROM_COLOR: ColorToken[] = ['series-8', 'series-7'];
export const DOMINANT_COLOR: ColorToken = 'data';
export const RECESSIVE_COLOR: ColorToken = 'series-5';
const PARENT_X = 6, PARENT_Y = 3.4, GAMETE_Y = -3.6;

export interface ParentLayout { x: number; gametes: { label: string; x: number }[] }

/** Centros x de los gametos de un progenitor (en fila bajo su célula). */
export function gameteXs(parentX: number, m: number): number[] {
  const step = m > 2 ? 1.95 : 2.6;
  return Array.from({ length: m }, (_, j) => parentX + (j - (m - 1) / 2) * step);
}

const isDominant = (allele: string, gene: Gene) => allele === gene.dominant;

export function mendelScene(g1: Genotype, g2: Genotype, genes: Gene[]): { items: SceneItem[]; extent: number; target: Vec3; description: string; gametes1: string[]; gametes2: string[] } {
  const items: SceneItem[] = [];
  const nG = genes.length;
  const parents: { g: Genotype; x: number; name: string }[] = [{ g: g1, x: -PARENT_X, name: 'Progenitor 1' }, { g: g2, x: PARENT_X, name: 'Progenitor 2' }];
  const gameteLists: string[][] = [];
  parents.forEach((par, pi) => {
    const tag = `p${pi + 1}`;
    items.push({ id: `${tag}-celula`, kind: 'sphere', center: [par.x, PARENT_Y, 0], radius: 3.1, color: 'bio', opacity: 0.12, label: `${par.name}: ${par.g.join(' ')}` });
    // Pares de homólogos: uno al lado del otro; cada gen en su propio par.
    genes.forEach((gene, gi) => {
      const L = CHROM_LEN[gi] ?? 1.8;
      const cx = par.x + (nG > 1 ? (gi === 0 ? -0.9 : 0.9) : 0);
      [0, 1].forEach((h) => {
        const x = cx + (h === 0 ? -0.32 : 0.32);
        const allele = par.g[gi][h];
        items.push({ id: `${tag}-g${gi}-h${h}`, kind: 'rod', from: [x, PARENT_Y - L / 2, 0], to: [x, PARENT_Y + L / 2, 0], radius: 0.2, color: CHROM_COLOR[gi] });
        items.push({ id: `${tag}-g${gi}-h${h}-locus`, kind: 'sphere', center: [x, PARENT_Y + L * 0.22, 0], radius: 0.3, color: isDominant(allele, gene) ? DOMINANT_COLOR : RECESSIVE_COLOR });
      });
    });
    // Gametos: las filas (o columnas) del cuadro de Punnett, con un cromosoma de cada par.
    const list = punnettGametes(par.g);
    gameteLists.push(list);
    const xs = gameteXs(par.x, list.length);
    list.forEach((gm, j) => {
      const gx = xs[j];
      items.push({ id: `${tag}-gam${j}`, kind: 'sphere', center: [gx, GAMETE_Y, 0], radius: 0.85, color: 'series-3', opacity: 0.16, label: gm });
      items.push({ id: `${tag}-flecha${j}`, kind: 'arrow', from: [par.x + (gx - par.x) * 0.25, PARENT_Y - 3.2, 0], vector: [(gx - par.x) * 0.7, GAMETE_Y + 1.1 - (PARENT_Y - 3.2), 0], radius: 0.05, color: 'ink-3' });
      genes.forEach((gene, gi) => {
        const L = (CHROM_LEN[gi] ?? 1.8) * 0.5;
        const x = gx + (nG > 1 ? (gi === 0 ? -0.25 : 0.25) : 0);
        items.push({ id: `${tag}-gam${j}-g${gi}`, kind: 'rod', from: [x, GAMETE_Y - L / 2, 0], to: [x, GAMETE_Y + L / 2, 0], radius: 0.13, color: CHROM_COLOR[gi] });
        items.push({ id: `${tag}-gam${j}-g${gi}-locus`, kind: 'sphere', center: [x, GAMETE_Y + L * 0.22, 0], radius: 0.2, color: isDominant(gm[gi], gene) ? DOMINANT_COLOR : RECESSIVE_COLOR });
      });
    });
  });

  const describeParent = (g: Genotype, name: string) => {
    const kinds = gametes(g);
    return `${name} (${g.join('')}) forma ${kinds.length === 1 ? 'un solo tipo de gameto' : `${kinds.length} tipos de gametos`}: ${kinds.map((k) => `${k.gamete} (${fmt(k.p * 100, 0)} %)`).join(', ')}.`;
  };
  const traits = genes.map((g) => g.trait.toLowerCase()).join(' y ');
  const description = `Dos células progenitoras con ${nG === 1 ? 'un par de cromosomas homólogos' : 'dos pares de cromosomas homólogos (uno por gen, en cromosomas distintos)'} para ${traits}; `
    + 'el locus de cada gen está marcado en los dos homólogos con su alelo (dominante en naranja, recesivo en celeste). '
    + 'Abajo, los gametos: en la meiosis los homólogos se separan y cada gameto lleva un solo cromosoma de cada par, con un solo alelo de cada gen. '
    + `${describeParent(g1, 'El progenitor 1')} ${describeParent(g2, 'El progenitor 2')}`
    + (nG > 1 ? ' Como los dos genes están en pares distintos, cada par se separa sin depender del otro (segregación independiente).' : '');
  return { items, extent: 10, target: [0, 0, 0], description, gametes1: gameteLists[0], gametes2: gameteLists[1] };
}

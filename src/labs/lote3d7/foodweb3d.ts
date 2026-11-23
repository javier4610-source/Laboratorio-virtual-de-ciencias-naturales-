/**
 * «redes» (lote 3D-7): la red trófica del potrero en niveles 3D y la pirámide de biomasa. Funciones PURAS con el MISMO
 * resultado del modelo (src/models/foodweb.ts → simulateFoodWeb) en el mismo año del banco:
 *   - cada especie es una esfera en la altura de su nivel trófico (productores abajo, el depredador tope arriba) cuyo
 *     VOLUMEN es ∝ su biomasa relativa al equilibrio base (radio ∝ ∛(B/B_base), con tope en 3 veces); por debajo del 2 %
 *     del equilibrio base (umbral del modelo) se dibuja gris: prácticamente desaparecida;
 *   - las varillas son los enlaces «es comido por» del modelo (LINKS), con la flecha en el sentido del flujo de energía;
 *   - la pirámide al lado apila los cuatro niveles con la biomasa por nivel del modelo; su lado sigue la misma escala
 *     logarítmica del banco (40 + 120·log₁₀(1 + B/0,1) px), porque entre el pasto y el gavilán hay cuatro órdenes de
 *     magnitud y unos volúmenes lineales dejarían el tope invisible;
 *   - «quitar una especie» es otra corrida del MISMO modelo con la misma lluvia, caza, pesticida y años, que empieza sin
 *     esa especie (biomasa inicial 0); cada esfera se colorea según suba o baje frente a la corrida del banco en el mismo
 *     año: así se ve la cascada.
 * Dibujo: posiciones de las esferas, colores y largo de las varillas.
 */
import { fmt } from '../../lib/format';
import { BASE_EQUILIBRIUM, EXTINCTION_FRACTION, LEVEL_NAMES, LINKS, SPECIES, type SpeciesId, type TrophicLevel } from '../../models/foodweb';
import type { SceneColor } from '../../three/colors';
import { normalize, scale, sub, type SceneItem, type Vec3 } from '../../three/scene';

export const LEVEL_Y: Record<TrophicLevel, number> = { productor: 0, herbivoro: 4, carnivoro: 8, tope: 12 };
const POS: Record<SpeciesId, [number, number]> = {
  pastos: [0, 0], saltamontes: [-4, 1.5], ratones: [4, -1], ranas: [-5, 2.5], serpientes: [1, -1.5], gavilanes: [4, 0.5],
};
export const LEVEL_COLOR: Record<TrophicLevel, SceneColor> = { productor: 'bio', herbivoro: 'amb', carnivoro: 'fis', tope: 'bad' };
const LEVELS: TrophicLevel[] = ['productor', 'herbivoro', 'carnivoro', 'tope'];
const PYR_X = 14.5;
/** Radio de la esfera con biomasa igual al equilibrio base, y tope de la biomasa relativa dibujada. */
export const R_BASE = 1.1;
export const REL_MAX = 3;

export const nodePos = (id: SpeciesId): Vec3 => {
  const s = SPECIES.find((x) => x.id === id)!;
  return [POS[id][0], LEVEL_Y[s.level], POS[id][1]];
};
/** Radio de una especie: volumen ∝ biomasa relativa al equilibrio base. */
export const nodeRadius = (b: number, id: SpeciesId) => R_BASE * Math.cbrt(Math.min(REL_MAX, Math.max(0, b) / BASE_EQUILIBRIUM[id]));
/** Lado de cada piso de la pirámide (escala logarítmica del banco, 40 px = 1 unidad de la escena). */
export const pyramidSide = (b: number) => (40 + 120 * Math.log10(1 + Math.max(0, b) / 0.1)) / 100;

export interface FoodWebSceneInput {
  /** Biomasa de cada especie en el año que muestra el banco (o en la corrida sin una especie). */
  biomass: Record<SpeciesId, number>;
  /** Biomasa de la corrida del banco en el mismo año (para comparar cuando se quita una especie). */
  benchBiomass: Record<SpeciesId, number>;
  removed: SpeciesId | null;
  year: number;
  started: boolean;
}

export function levelTotals(b: Record<SpeciesId, number>): Record<TrophicLevel, number> {
  const l: Record<TrophicLevel, number> = { productor: 0, herbivoro: 0, carnivoro: 0, tope: 0 };
  for (const s of SPECIES) l[s.level] += b[s.id];
  return l;
}

export function foodWebScene(inp: FoodWebSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; changes: { id: SpeciesId; ratio: number }[] } {
  const items: SceneItem[] = [
    { id: 'suelo', kind: 'plane', center: [5, -1.6, 0], size: [32, 14], color: '#9cc27a', opacity: 0.6 },
  ];
  for (const l of LEVELS) {
    items.push({ id: `nivel-${l}`, kind: 'box', center: [0, LEVEL_Y[l] - 1.4, 0.5], size: [13, 0.06, 8], color: LEVEL_COLOR[l], opacity: 0.1 });
  }
  const gone = (id: SpeciesId, b: number) => b < EXTINCTION_FRACTION * BASE_EQUILIBRIUM[id];
  for (const lk of LINKS) {
    const a = nodePos(lk.prey), b = nodePos(lk.predator);
    const u = normalize(sub(b, a));
    const ra = Math.max(0.25, nodeRadius(inp.biomass[lk.prey], lk.prey)), rb = Math.max(0.25, nodeRadius(inp.biomass[lk.predator], lk.predator));
    const from: Vec3 = [a[0] + u[0] * ra, a[1] + u[1] * ra, a[2] + u[2] * ra];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) - ra - rb - 0.1;
    const dead = gone(lk.prey, inp.biomass[lk.prey]) || gone(lk.predator, inp.biomass[lk.predator]);
    if (len > 0.3) items.push({ id: `enlace-${lk.prey}-${lk.predator}`, kind: 'arrow', from, vector: scale(u, len), radius: 0.07, color: dead ? 'line-strong' : 'ink-2', opacity: dead ? 0.5 : 1 });
  }
  const changes: { id: SpeciesId; ratio: number }[] = [];
  for (const s of SPECIES) {
    const b = inp.biomass[s.id];
    const rel = b / BASE_EQUILIBRIUM[s.id];
    let color: SceneColor = LEVEL_COLOR[s.level];
    if (inp.removed) {
      const ratio = inp.benchBiomass[s.id] > 1e-12 ? b / inp.benchBiomass[s.id] : (b > 1e-12 ? Infinity : 1);
      changes.push({ id: s.id, ratio });
      color = s.id === inp.removed ? 'line-strong' : ratio > 1.05 ? 'ok' : ratio < 0.95 ? 'bad' : 'ink-3';
    }
    const isGone = gone(s.id, b);
    if (isGone && !inp.removed) color = 'line-strong';
    const r = Math.max(isGone ? 0.18 : 0.25, nodeRadius(b, s.id));
    const pct = `${fmt(100 * rel, 0)} % del equilibrio base`;
    items.push({ id: `sp-${s.id}`, kind: 'sphere', center: nodePos(s.id), radius: r, color, opacity: isGone ? 0.55 : 1,
      label: `${s.name}: ${fmt(b, s.decimals)} kg/ha (${s.id === inp.removed ? 'quitada' : isGone ? 'prácticamente desaparecida' : pct})`, tag: s.name });
  }
  // Pirámide de biomasa por nivel (pisos cuadrados apilados).
  const lv = levelTotals(inp.biomass);
  LEVELS.forEach((l, i) => {
    const side = pyramidSide(lv[l]);
    items.push({ id: `piso-${l}`, kind: 'box', center: [PYR_X, -1.6 + 0.9 + i * 1.9, 0], size: [side, 1.7, side], color: LEVEL_COLOR[l], opacity: 0.85, edges: true,
      label: `Pirámide · ${LEVEL_NAMES[l]}: ${fmt(lv[l], l === 'tope' ? 3 : 1)} kg/ha`, tag: '' });
  });

  const when = inp.started ? `año ${fmt(inp.year, 1)}` : 'biomasa inicial, antes de simular';
  const spText = SPECIES.map((s) => `${s.name.toLowerCase()} ${fmt(inp.biomass[s.id], s.decimals)} kg/ha${gone(s.id, inp.biomass[s.id]) && s.id !== inp.removed ? ' (prácticamente desaparecida)' : ''}`).join('; ');
  let cascade = '';
  if (inp.removed) {
    const name = SPECIES.find((s) => s.id === inp.removed)!.name.toLowerCase();
    const up = changes.filter((c) => c.id !== inp.removed && c.ratio > 1.05).map((c) => SPECIES.find((s) => s.id === c.id)!.name.toLowerCase());
    const down = changes.filter((c) => c.id !== inp.removed && c.ratio < 0.95).map((c) => SPECIES.find((s) => s.id === c.id)!.name.toLowerCase());
    cascade = ` Corrida del mismo modelo sin ${name} desde el inicio, comparada con la del banco en el mismo año: ${up.length ? `suben (verde) ${up.join(', ')}` : 'ninguna especie sube más de un 5 %'}; ${down.length ? `bajan (rojo) ${down.join(', ')}` : 'ninguna baja más de un 5 %'}.`;
  }
  const description = `Red trófica en 3D por niveles (productores abajo, el gavilán arriba), ${when}. Volumen de cada esfera ∝ biomasa frente al equilibrio base: ${spText}. Las varillas con flecha van de la presa al depredador (flujo de energía). `
    + `A la derecha, la pirámide de biomasa: productores ${fmt(lv.productor, 1)}, herbívoros ${fmt(lv.herbivoro, 1)}, carnívoros ${fmt(lv.carnivoro, 1)} y depredador tope ${fmt(lv.tope, 3)} kg/ha (lado en escala logarítmica, como en el banco).${cascade}`;
  return { items, extent: 12, target: [5, 5, 0], narrow: { extent: 15, target: [5, 5, 0] }, description, changes };
}

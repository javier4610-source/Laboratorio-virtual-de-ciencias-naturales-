/**
 * «respiracion» (lote 3D-2): una mitocondria en 3D (membrana externa, matriz, crestas con ATP sintasa) y, al lado, el
 * citoplasma donde ocurre la glucólisis. Funciones PURAS a partir del MISMO estado del laboratorio:
 *   - el O₂ consumido y el CO₂ producido del respirómetro (`respirometerModel`), acumulados con el avance de la medición:
 *     cada esfera vale lo mismo en una corrida (la mayor de las dos cantidades finales = 12 esferas), así que su número
 *     compara O₂ y CO₂ (el cociente respiratorio) sin decir los µL antes de terminar, como el banco;
 *   - en anoxia (N₂) no entra O₂: la cadena se detiene y el CO₂ sale de la fermentación en el citoplasma;
 *   - el balance de ATP por etapa de la tabla de la práctica (`atpBreakdown` con la relación P/O y la lanzadera elegidas).
 * Formas y posiciones son dibujo.
 */
import { atpBreakdown, ATP_FERMENTATION, GLUCOSE_COUNTS, type Accounting, type Atmosphere, type Shuttle } from '../../models/respiration';
import { fmt } from '../../lib/format';
import type { SceneItem, Vec3 } from '../../three/scene';

export type MitoPart = 'glucolisis' | 'krebs' | 'cadena';
export const GAS_SPHERES = 12;

export interface RespSceneInput {
  atmosphere: Atmosphere;
  alive: boolean;
  /** 'carbohidrato' o 'lipido' (maní): lo que se oxida en la matriz. */
  substrate: string;
  sampleName: string;
  /** O₂ y CO₂ de toda la medición (µL, del modelo) y fracción ya transcurrida (0–1). */
  vO2: number;
  vCO2: number;
  progress: number;
  accounting: Accounting;
  shuttle: Shuttle;
  selected: MitoPart | null;
}

/** Esferas de O₂ y de CO₂ dibujadas hasta el avance dado (la mayor cantidad final = GAS_SPHERES). */
export function gasSpheres(vO2: number, vCO2: number, progress: number): { o2: number; co2: number } {
  const max = Math.max(vO2, vCO2);
  if (!(max > 0)) return { o2: 0, co2: 0 };
  const p = Math.min(1, Math.max(0, progress));
  return { o2: Math.round((GAS_SPHERES * vO2 * p) / max), co2: Math.round((GAS_SPHERES * vCO2 * p) / max) };
}

/** Texto de la ficha de cada compartimento con el balance de ATP de la tabla de la práctica. */
export function partInfo(part: MitoPart, inp: Pick<RespSceneInput, 'accounting' | 'shuttle' | 'substrate' | 'atmosphere'>): string {
  const b = atpBreakdown(GLUCOSE_COUNTS, inp.shuttle, inp.accounting);
  const shuttle = inp.shuttle === 'malato' ? 'malato-aspartato' : 'glicerol-3-fosfato';
  const po = inp.accounting === 'moderna' ? 'P/O modernas (2,5 por NADH y 1,5 por FADH₂)' : 'P/O clásicas (3 por NADH y 2 por FADH₂)';
  switch (part) {
    case 'glucolisis':
      return `Glucólisis, en el citoplasma: una glucosa se parte en 2 piruvatos y deja ${fmt(ATP_FERMENTATION, 0)} ATP netos (nivel de sustrato) y 2 NADH citosólicos; con la lanzadera ${shuttle} esos NADH rinden ${fmt(b.fromNadhCyto, 1)} ATP en la cadena.`
        + (inp.atmosphere === 'n2' ? ' Sin O₂ es lo único que funciona: el NADH se reoxida al formar etanol y CO₂ (fermentación), así que queda en 2 ATP por glucosa.' : '');
    case 'krebs':
      return `Matriz: la piruvato deshidrogenasa y el ciclo de Krebs oxidan los 2 piruvatos hasta CO₂ y dejan ${fmt(GLUCOSE_COUNTS.substrateLevel - ATP_FERMENTATION, 0)} GTP (nivel de sustrato), 8 NADH y 2 FADH₂ por glucosa.`
        + (inp.substrate === 'lipido' ? ' En el maní el combustible es sobre todo aceite: la β-oxidación de los ácidos grasos también ocurre en la matriz y alimenta el ciclo.' : '');
    case 'cadena':
      return `Crestas (membrana interna): la cadena de transporte pasa los electrones del NADH y del FADH₂ al O₂, que forma agua, y la ATP sintasa fabrica ATP. Con ${po}: ${fmt(b.fromNadhMito, 1)} ATP de los 8 NADH, ${fmt(b.fromFadh2, 1)} de los 2 FADH₂ y ${fmt(b.fromNadhCyto, 1)} de los NADH citosólicos; en total ${fmt(b.total, 1)} ATP por glucosa contando los ${fmt(b.substrateLevel, 0)} del nivel de sustrato.`
        + (inp.atmosphere === 'n2' ? ' En anoxia la cadena está detenida: sin O₂ no hay aceptor final de electrones.' : '');
  }
}

const MITO_C: Vec3 = [1.6, 0, 0];
const MITO_R: Vec3 = [5, 2.4, 2.4];
const INNER_R: Vec3 = [4.6, 2.05, 2.05];
const GLY_C: Vec3 = [-6.4, -0.6, 0];

export function respirationScene(inp: RespSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; gas: { o2: number; co2: number } } {
  const items: SceneItem[] = [];
  const anoxia = inp.atmosphere === 'n2';
  const sel = inp.selected;
  items.push({ id: 'glucolisis', kind: 'ellipsoid', center: GLY_C, radii: [1.9, 1.4, 1.4], color: 'series-6', opacity: sel === 'glucolisis' ? 0.5 : 0.28, label: 'Citoplasma: glucólisis', selectable: true });
  items.push({ id: 'membrana-externa', kind: 'ellipsoid', center: MITO_C, radii: MITO_R, color: 'series-1', opacity: 0.14, label: 'Membrana externa' });
  items.push({ id: 'krebs', kind: 'ellipsoid', center: MITO_C, radii: INNER_R, color: 'series-4', opacity: sel === 'krebs' ? 0.34 : 0.16, label: 'Matriz: ciclo de Krebs', selectable: true });
  // Crestas: pliegues de la membrana interna (placas que entran desde arriba y desde abajo).
  const synth: Vec3[] = [];
  const n = 7;
  for (let k = 0; k < n; k++) {
    const dx = -3.6 + (7.2 * k) / (n - 1);
    const f = Math.sqrt(Math.max(0, 1 - (dx / INNER_R[0]) ** 2));
    const H = 2 * INNER_R[1] * f, D = 2 * INNER_R[2] * f * 0.8;
    const s = k % 2 ? 1 : -1;
    const h = 0.68 * H;
    const cy = s * (H / 2 - h / 2);
    items.push({ id: `cadena-${k}`, kind: 'box', center: [MITO_C[0] + dx, cy, 0], size: [0.2, h, D], color: 'series-3', opacity: anoxia ? 0.35 : sel === 'cadena' ? 1 : 0.8, selectable: true, ...(k === 0 ? { label: 'Crestas: cadena de transporte' } : {}) });
    synth.push([MITO_C[0] + dx + 0.18, cy - s * (h / 2 - 0.25), D / 2 - 0.2], [MITO_C[0] + dx - 0.18, cy - s * (h / 2 - 0.25), -D / 2 + 0.2]);
  }
  items.push({ id: 'atp-sintasa', kind: 'particles', points: synth, radius: 0.2, color: 'ink-2', label: 'ATP sintasa' });

  // Gases acumulados durante la medición.
  const gas = gasSpheres(inp.vO2, inp.vCO2, inp.progress);
  const o2Pts: Vec3[] = Array.from({ length: gas.o2 }, (_, i) => [MITO_C[0] + 2.2 - (i % 6) * 0.75, 3.4 + Math.floor(i / 6) * 0.75, 0.5]);
  const co2From: Vec3 = anoxia ? GLY_C : [MITO_C[0] - 1.5, -2.9, 0];
  const co2Pts: Vec3[] = Array.from({ length: gas.co2 }, (_, i) => [co2From[0] + 1.6 - (i % 6) * 0.75, co2From[1] - (anoxia ? 2.2 : 0.8) - Math.floor(i / 6) * 0.75, -0.4]);
  if (o2Pts.length) {
    items.push({ id: 'o2', kind: 'particles', points: o2Pts, radius: 0.28, color: 'series-5', label: 'O₂ consumido' });
    items.push({ id: 'o2-flecha', kind: 'arrow', from: [MITO_C[0] + 0.6, 3.15, 0.5], vector: [0, -1.1, 0], radius: 0.07, color: 'series-5' });
  }
  if (co2Pts.length) {
    items.push({ id: 'co2', kind: 'particles', points: co2Pts, radius: 0.28, color: 'ink-2', label: anoxia ? 'CO₂ de la fermentación' : 'CO₂ producido' });
    items.push({ id: 'co2-flecha', kind: 'arrow', from: [co2From[0], co2From[1] - (anoxia ? 1.2 : 0), -0.4], vector: [0, -0.9, 0], radius: 0.07, color: 'ink-2' });
  }

  let description = `Mitocondria en 3D de las semillas (${inp.sampleName.toLowerCase()}): membrana externa, matriz con el ciclo de Krebs y crestas de la membrana interna con la cadena de transporte y la ATP sintasa; a la izquierda, el citoplasma donde ocurre la glucólisis. `;
  if (!inp.alive) description += 'Las semillas hervidas no respiran: no se consume O₂ ni se produce CO₂. ';
  else if (anoxia) description += 'Atmósfera de N₂ (anoxia): no entra O₂, la cadena de transporte está detenida y el CO₂ sale de la fermentación en el citoplasma. ';
  else description += `Mientras avanza la medición entra O₂ a las crestas y sale CO₂ de la matriz: ${gas.o2} esferas de O₂ y ${gas.co2} de CO₂ hasta ahora (cada esfera vale lo mismo, así se comparan las dos cantidades). `;
  description += `Avance de la medición: ${fmt(Math.min(1, Math.max(0, inp.progress)) * 100, 0)} %. `;
  description += sel ? `Elegido: ${partInfo(sel, inp)}` : 'Elige la glucólisis, la matriz o una cresta para ver su balance de ATP.';
  return { items, extent: 10, target: [-0.6, 0.3, 0], description, gas };
}

/** Compartimento al que pertenece una primitiva elegible. */
export function partFromId(id: string): MitoPart | null {
  if (id === 'glucolisis') return 'glucolisis';
  if (id === 'krebs') return 'krebs';
  if (id.startsWith('cadena')) return 'cadena';
  return null;
}

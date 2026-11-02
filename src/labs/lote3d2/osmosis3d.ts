/**
 * «osmosis» (lote 3D-2): la célula en 3D con su membrana, acuaporinas, moléculas de agua que cruzan y solutos a ambos
 * lados. Funciones PURAS a partir del MISMO estado del laboratorio (src/models/osmosis.ts → simulateOsmosis):
 *   - el volumen relativo V(t) del punto que muestra el banco (la célula escala con V^(1/3) en cada eje),
 *   - el sentido del flujo neto de agua del modelo (entra, sale o sin flujo neto),
 *   - la lisis del glóbulo rojo en el instante del modelo,
 *   - el número de solutos dibujados afuera ∝ osmolaridad externa (60 por Osm/L, como el campo del banco 2D) y adentro
 *     un número fijo (∝ CIN0): los solutos de la célula no salen; su concentración cambia porque cambia el agua.
 * El avance de las moléculas de agua por los canales sigue el tiempo del modelo (se detiene en pausa). Posiciones de
 * solutos, canales y forma de la célula: dibujo.
 */
import { CIN0, type CellType } from '../../models/osmosis';
import { seededRandom } from '../../models/math';
import { fmt } from '../../lib/format';
import type { SceneItem, Vec3 } from '../../three/scene';

export type WaterDirection = 'entra' | 'sale' | 'sin flujo neto';

export interface OsmosisSceneInput {
  cellType: CellType;
  /** Volumen relativo del punto actual del modelo (1 = inicial). */
  volume: number;
  /** Tiempo del modelo (s) y duración de la observación (s). */
  t: number;
  duration: number;
  waterDirection: WaterDirection;
  lysed: boolean;
  externalOsm: number;
  naclPercent: number;
  tonicity: string;
}

/** Partículas de soluto dibujadas por Osm/L (la misma densidad que el campo del banco 2D). */
export const SOLUTE_DOTS_PER_OSM = 60;
/** Canales de agua dibujados. */
export const CHANNELS = 10;
const EXTENT = 9;

/** Semiejes de la célula (µm de escena): glóbulo rojo aplanado o protoplasto vegetal, escalados con V^(1/3). */
export function cellRadii(cellType: CellType, volume: number): Vec3 {
  if (cellType === 'animal') {
    const k = Math.cbrt(Math.max(0.05, volume));
    return [3.6 * k, 1.3 * k, 3.6 * k];
  }
  // El protoplasto no puede crecer más allá de la pared: con V > 1 la presiona (turgencia), no se agranda.
  const k = Math.cbrt(Math.min(1, Math.max(0.05, volume)));
  return [4.2 * k, 2.6 * k, 2.6 * k];
}

/** Direcciones casi uniformes (espiral de Fibonacci) para los canales. */
export function channelDirections(n: number): Vec3[] {
  const g = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    return [r * Math.cos(g * i), y, r * Math.sin(g * i)] as Vec3;
  });
}

/** Distancia del centro a la superficie del elipsoide en la dirección unitaria d. */
export const radiusAlong = (radii: Vec3, d: Vec3) => 1 / Math.sqrt((d[0] / radii[0]) ** 2 + (d[1] / radii[1]) ** 2 + (d[2] / radii[2]) ** 2);

/**
 * Posición de la molécula de agua del canal k: avanza por el canal según el tiempo del modelo (una pasada por cada sexto
 * de la observación). Con flujo neto todas van en el sentido del modelo; sin flujo neto, la mitad entra y la mitad sale.
 * Devuelve también si esa molécula va hacia adentro.
 */
export function waterPosition(k: number, dir: Vec3, radii: Vec3, inp: Pick<OsmosisSceneInput, 't' | 'duration' | 'waterDirection'>): { p: Vec3; inward: boolean } {
  const period = Math.max(1, inp.duration / 6);
  const s = (((inp.t / period + k / CHANNELS) % 1) + 1) % 1;
  const inward = inp.waterDirection === 'entra' || (inp.waterDirection === 'sin flujo neto' && k % 2 === 0);
  const r = radiusAlong(radii, dir);
  const rOut = r * 1.55, rIn = r * 0.5;
  const rr = inward ? rOut + (rIn - rOut) * s : rIn + (rOut - rIn) * s;
  return { p: [dir[0] * rr, dir[1] * rr, dir[2] * rr], inward };
}

const PHRASE: Record<WaterDirection, string> = {
  entra: 'el agua entra: por los canales pasan más moléculas hacia adentro que hacia afuera',
  sale: 'el agua sale: por los canales pasan más moléculas hacia afuera que hacia adentro',
  'sin flujo neto': 'sin flujo neto: entran tantas moléculas de agua como salen',
};

export function osmosisScene(inp: OsmosisSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; outsideDots: number; insideDots: number } {
  const items: SceneItem[] = [];
  const radii = cellRadii(inp.cellType, inp.volume);
  const animal = inp.cellType === 'animal';
  const lysed = animal && inp.lysed;

  if (!animal) {
    items.push({ id: 'pared', kind: 'box', center: [0, 0, 0], size: [9, 5.8, 5.8], edges: true, color: 'bio', opacity: 0.12, label: 'Pared celular' });
    const vac = Math.pow(Math.cbrt(Math.min(1, inp.volume)), 1.6) * 0.72;
    items.push({ id: 'vacuola', kind: 'ellipsoid', center: [0, 0, 0], radii: [radii[0] * vac, radii[1] * vac, radii[2] * vac], color: 'series-5', opacity: 0.3, label: 'Vacuola' });
  }
  items.push({
    id: 'membrana', kind: 'ellipsoid', center: [0, 0, 0], radii, color: animal ? 'bad' : 'bio', opacity: lysed ? 0.12 : animal ? 0.42 : 0.28,
    label: lysed ? 'Membrana rota (lisis)' : animal ? 'Membrana del glóbulo rojo' : 'Membrana (protoplasto)',
  });

  // Canales (acuaporinas) que atraviesan la membrana y moléculas de agua que los cruzan.
  const dirs = channelDirections(CHANNELS);
  dirs.forEach((d, k) => {
    const r = radiusAlong(radii, d);
    items.push({ id: `canal-${k}`, kind: 'rod', from: [d[0] * r * 0.9, d[1] * r * 0.9, d[2] * r * 0.9], to: [d[0] * r * 1.1, d[1] * r * 1.1, d[2] * r * 1.1], radius: 0.2, color: 'series-4', ...(k === 0 ? { label: 'Acuaporinas (canales de agua)' } : {}) });
  });
  const water = dirs.map((d, k) => waterPosition(k, d, radii, inp));
  if (!lysed) items.push({ id: 'agua', kind: 'particles', points: water.map((w) => w.p), radius: 0.32, color: 'series-5', label: 'Moléculas de agua' });

  // Solutos: afuera ∝ osmolaridad externa; adentro un número fijo que se acerca o se separa con el volumen.
  const outsideDots = Math.min(240, Math.round(inp.externalOsm * SOLUTE_DOTS_PER_OSM));
  const insideDots = Math.round(CIN0 * SOLUTE_DOTS_PER_OSM);
  const rnd = seededRandom(11);
  const out: Vec3[] = [];
  for (let i = 0; i < outsideDots; i++) {
    const u = rnd() * 2 - 1, a = rnd() * 2 * Math.PI, rr = 6.4 + rnd() * 1.9;
    const s = Math.sqrt(1 - u * u);
    out.push([rr * s * Math.cos(a), rr * u * 0.75, rr * s * Math.sin(a)]);
  }
  const rin = seededRandom(23);
  const inn: Vec3[] = [];
  for (let i = 0; i < insideDots; i++) {
    const u = rin() * 2 - 1, a = rin() * 2 * Math.PI, f = 0.35 + 0.45 * Math.cbrt(rin());
    const s = Math.sqrt(1 - u * u);
    inn.push([radii[0] * f * s * Math.cos(a), radii[1] * f * u, radii[2] * f * s * Math.sin(a)]);
  }
  if (out.length) items.push({ id: 'soluto-fuera', kind: 'particles', points: out, radius: 0.2, color: 'series-2', label: 'Solutos del medio (Na⁺ y Cl⁻)' });
  if (lysed) {
    // Sin membrana íntegra, el contenido (hemoglobina y solutos) se dispersa en el medio.
    items.push({ id: 'contenido', kind: 'particles', points: inn.map((p) => [p[0] * 1.9, p[1] * 2.4, p[2] * 1.9] as Vec3), radius: 0.24, color: 'series-1', label: 'Contenido liberado' });
  } else items.push({ id: 'soluto-dentro', kind: 'particles', points: inn, radius: 0.24, color: 'series-1', label: 'Solutos de la célula' });

  const who = animal ? 'Glóbulo rojo' : 'Célula vegetal';
  let description = `${who} en 3D en NaCl al ${fmt(inp.naclPercent, 2)} % (medio ${inp.tonicity}). Tiempo ${fmt(inp.t, 0)} s de ${fmt(inp.duration, 0)} s. Volumen ${fmt(inp.volume * 100, 1)} % del inicial. `;
  if (lysed) description += 'La membrana se rompió (lisis): el contenido sale al medio y el agua ya no queda retenida. ';
  else {
    description += `Según el modelo, ${PHRASE[inp.waterDirection]}. `;
    if (!animal && inp.volume > 1.001) description += 'El protoplasto ya llena la célula y presiona la pared (turgencia): la pared impide que crezca más. ';
    if (!animal && inp.volume < 0.999) description += 'El protoplasto se encoge y se separa de la pared (plasmólisis). ';
  }
  description += `Afuera hay ${outsideDots} partículas de soluto dibujadas (proporcional a ${fmt(inp.externalOsm, 3)} Osm/L) y adentro ${insideDots}: los solutos de la célula no cruzan la membrana; lo que cambia es el agua.`;
  return { items, extent: EXTENT, target: [0, 0, 0], description, outsideDots, insideDots };
}

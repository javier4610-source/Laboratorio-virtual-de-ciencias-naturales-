/**
 * «descomposicion» (lote 3D-7): la compostera escolar en corte, en decímetros. Funciones PURAS con el MISMO resultado del
 * modelo (src/models/decomposition.ts → simulateDecomposition) y el mismo momento del banco:
 *   - el color del cuerpo de la pila sigue la humedad elegida (más húmeda, más oscura: dibujo) y el termómetro clavado en
 *     ella marca la temperatura de la pila del modelo, con la escala FIJA de color de temperatura del lote 3D-6;
 *   - las cinco bolsas enterradas son las del banco; la del material elegido sale de la pila y va a la balanza con el
 *     mismo avance del banco;
 *   - fuera de la pila, la bolsa lleva un trozo por cada gramo de masa seca que queda según el modelo (M = M₀·e^(−k·t);
 *     50 g al inicio), oscurecido según la masa perdida, y los hongos que registra el modelo; la balanza muestra su
 *     lectura solo cuando el banco termina de pesar (antes, «- - -» o «0,0 g» como el banco);
 *   - lombrices y vapor aparecen cuando el modelo los indica (lombrices; pila a 38 °C o más).
 * Dibujo: tablas, capas, lugar de cada trozo, forma de las bolsas y de las lombrices.
 */
import { fmt } from '../../lib/format';
import { DECOMP_MATERIALS, INITIAL_MASS, type DecompResult } from '../../models/decomposition';
import type { SceneItem, Vec3 } from '../../three/scene';
import { mixHex, polyRods } from '../lote3d5/common';
import { hash01, tempColor, TEMP_SCALE_TEXT } from '../lote3d6/common';

const HUMUS = '#3a2616';
export const SLOT_X = [-4, -2, 0, 2, 4];
const BAG: Vec3 = [1.3, 1.5, 0.7];
const BAG_Y = 2.2, BAG_Z = 2.25;
const SOIL_TOP = 4.6;
export const PLATE: Vec3 = [9, 2.35, 0.5];
const SHORT: Record<string, string> = { banano: 'Banano', hojas: 'Hojas', papel: 'Papel', aserrin: 'Aserrín', plastico: 'Plástico' };

/** Color de la tierra según la humedad (0–100 %): seca clara, húmeda oscura (dibujo). */
export const soilColor = (moisture: number) => mixHex('#b89466', '#3b2614', Math.max(0, Math.min(1, moisture / 100)));
/** Trozos que se dibujan: uno por gramo de masa seca que queda (redondeado). */
export const piecesFor = (grams: number) => Math.max(0, Math.round(grams));

export interface DecompSceneInput {
  res: DecompResult;
  materialId: string;
  weeks: number;
  temperature: number;
  moisture: number;
  aerated: boolean;
  chopped: boolean;
  /** Avance del traslado de la bolsa (0 en la pila, 1 en el plato: el mismo «ease» del banco) y fase del banco. */
  move: number;
  outOfPile: boolean;
  measured: boolean;
}

export function decompositionScene(inp: DecompSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; pieces: number } {
  const { res } = inp;
  const obs = res.observations;
  const slot = DECOMP_MATERIALS.findIndex((m) => m.id === inp.materialId);
  const items: SceneItem[] = [
    { id: 'suelo', kind: 'plane', center: [2.5, -0.02, 0], size: [26, 12], color: '#8fb871', opacity: 0.7 },
    // Tablas de la compostera (atrás y a los lados); el frente está cortado para ver adentro.
    { id: 'tabla-fondo', kind: 'box', center: [0, 2.8, -3.1], size: [10.8, 5.6, 0.25], color: '#8a6338' },
    { id: 'tabla-izq', kind: 'box', center: [-5.3, 2.8, 0], size: [0.25, 5.6, 6.2], color: '#a57a46' },
    { id: 'tabla-der', kind: 'box', center: [5.3, 2.8, 0], size: [0.25, 5.6, 6.2], color: '#a57a46' },
    { id: 'pila', kind: 'box', center: [0, SOIL_TOP / 2, -0.45], size: [10.3, SOIL_TOP, 5.1], color: soilColor(inp.moisture),
      label: `Pila en corte: humedad ${fmt(inp.moisture, 0)} %, ${inp.aerated ? 'con volteo' : 'sin volteo'}`, tag: `Pila · ${fmt(inp.moisture, 0)} % humedad` },
    { id: 'capa-restos', kind: 'box', center: [0, SOIL_TOP + 0.25, -0.45], size: [10.3, 0.5, 5.1], color: '#7f9a3a', label: 'Capa de restos frescos', tag: '' },
    // Termómetro de compost clavado en el centro de la pila: su bulbo con el color de la temperatura del modelo.
    { id: 'termometro', kind: 'rod', from: [3.2, 1.6, 0.6], to: [3.2, SOIL_TOP + 2.4, 0.6], radius: 0.08, color: '#c4cad0' },
    { id: 'bulbo', kind: 'sphere', center: [3.2, 1.6, 0.6], radius: 0.32, color: tempColor(obs.pileTemperature), label: `Termómetro de la pila: ${fmt(obs.pileTemperature, 0)} °C`, tag: `${fmt(obs.pileTemperature, 0)} °C` },
    { id: 'centro', kind: 'ellipsoid', center: [0, 2.2, -0.6], radii: [3.4, 1.4, 1.8], color: tempColor(obs.pileTemperature), opacity: 0.35, label: 'Centro de la pila (color de su temperatura)', tag: '' },
  ];
  DECOMP_MATERIALS.forEach((m, i) => {
    const lifted = i === slot && inp.outOfPile;
    if (lifted) {
      items.push({ id: `hueco-${m.id}`, kind: 'box', center: [SLOT_X[i], BAG_Y, BAG_Z], size: BAG, color: '#24170c', opacity: 0.8 });
      return;
    }
    items.push({ id: `bolsa-${m.id}`, kind: 'box', center: [SLOT_X[i], BAG_Y, BAG_Z], size: BAG, color: '#2f5a3c', edges: true,
      label: `Bolsa enterrada: ${m.name.toLowerCase()}`, tag: i === slot ? SHORT[m.id] : '' });
  });
  if (obs.worms) {
    [[-3.2, 1.0], [1.2, 0.6], [-0.8, 3.6]].forEach(([x, y], w) => {
      const pts = Array.from({ length: 7 }, (_, k) => [x + k * 0.22, y + 0.12 * Math.sin(k * 1.3 + w), 2.75] as Vec3);
      items.push(...polyRods(`lombriz-${w}`, pts, 0.07, '#c46a6a'));
    });
    items.push({ id: 'lombrices', kind: 'sphere', center: [-3.2, 1.0, 2.75], radius: 0.09, color: '#c46a6a', label: 'Lombrices en el suelo', tag: '' });
  }
  if (obs.pileTemperature >= 38) {
    const pts = Array.from({ length: 18 }, (_, i) => [-4 + 8 * hash01(i, 3), SOIL_TOP + 0.8 + 1.6 * hash01(i, 4), -2 + 3 * hash01(i, 5)] as Vec3);
    items.push({ id: 'vapor', kind: 'particles', points: pts, radius: 0.12, color: 'ink-3', opacity: 0.45, label: 'Vapor de la pila caliente', tag: '' });
  }
  // Mesa y balanza.
  items.push(
    { id: 'mesa', kind: 'box', center: [9, 1, 0.5], size: [5, 0.25, 3.4], color: '#b9c3c6' },
    { id: 'patas', kind: 'rod', from: [9, 0, 0.5], to: [9, 0.9, 0.5], radius: 0.25, color: '#8b989a' },
    { id: 'balanza', kind: 'box', center: [9, 1.5, 0.5], size: [3, 0.7, 2.4], color: '#2a3336' },
    { id: 'plato', kind: 'box', center: [9, 1.92, 0.5], size: [2.4, 0.12, 2], color: '#c4cad0',
      label: `Balanza (0,1 g): ${inp.measured ? `${fmt(res.massReading, 1)} g` : inp.outOfPile ? '- - -' : '0,0 g'}`, tag: inp.measured ? `${fmt(res.massReading, 1)} g` : inp.outOfPile ? '- - -' : '0,0 g' },
  );
  // Bolsa que sale de la pila y va al plato (mismo avance que el banco).
  let pieces = 0;
  if (inp.outOfPile && slot >= 0) {
    const e = Math.max(0, Math.min(1, inp.move));
    const from: Vec3 = [SLOT_X[slot], BAG_Y, BAG_Z], to: Vec3 = [PLATE[0], PLATE[1] + BAG[1] / 2 - 0.4, PLATE[2]];
    const c: Vec3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + 3 * Math.sin(Math.PI * e), from[2] + (to[2] - from[2]) * e];
    const m = res.material;
    const f = m.kRef > 0 ? Math.max(0, Math.min(1, res.lossPercent / 100)) : 0;
    items.push({ id: 'bolsa-pesada', kind: 'box', center: c, size: BAG, color: '#2f5a3c', opacity: 0.25, edges: true, label: `Bolsa de ${m.name.toLowerCase()}`, tag: SHORT[m.id] });
    pieces = piecesFor(res.trueMass);
    const pts = Array.from({ length: pieces }, (_, i) => [c[0] + (hash01(i, 61) - 0.5) * (BAG[0] - 0.3), c[1] - BAG[1] / 2 + 0.15 + (BAG[1] - 0.3) * hash01(i, 62) * 0.8, c[2] + (hash01(i, 63) - 0.5) * (BAG[2] - 0.2)] as Vec3);
    if (pts.length) items.push({ id: 'trozos', kind: 'particles', points: pts, radius: inp.chopped ? 0.1 : 0.13, color: mixHex(m.color, HUMUS, f * 0.9), label: `Restos de ${m.name.toLowerCase()} (1 trozo por gramo)`, tag: '' });
    if (obs.fungi !== 'no visibles') {
      const nf = obs.fungi === 'abundantes' ? 16 : 6;
      const fp = Array.from({ length: nf }, (_, i) => [c[0] + (hash01(i, 71) - 0.5) * BAG[0], c[1] - 0.2 + 0.9 * hash01(i, 72), c[2] + BAG[2] / 2 + 0.02] as Vec3);
      items.push({ id: 'hongos', kind: 'particles', points: fp, radius: 0.07, color: '#f4f1e6', label: `Hongos ${obs.fungi} (micelio blanco)`, tag: '' });
    }
  }

  const cond = `${fmt(inp.temperature, 0)} °C, humedad ${fmt(inp.moisture, 0)} %, ${inp.aerated ? 'con volteo' : 'sin volteo'}, trozos ${inp.chopped ? 'picados' : 'enteros'}, semana ${inp.weeks}`;
  const base = `Compostera escolar en corte, en 3D (${cond}). El termómetro de la pila marca ${fmt(obs.pileTemperature, 0)} °C (color del bulbo y del centro con la escala ${TEMP_SCALE_TEXT}). Cinco bolsas de malla enterradas: banano, hojas, papel, aserrín y plástico.${obs.worms ? ' Hay lombrices en el suelo.' : ''}${obs.pileTemperature >= 38 ? ' Sale vapor de la pila.' : ''} `;
  const mat = res.material.name.toLowerCase();
  const description = base + (inp.measured
    ? `La bolsa de ${mat} está en la balanza, que marca ${fmt(res.massReading, 1)} g de los ${fmt(INITIAL_MASS, 0)} g iniciales: se dibujan ${pieces} trozos, uno por gramo${obs.fungi !== 'no visibles' ? `, con hongos ${obs.fungi}` : ''}.`
    : inp.outOfPile ? `La bolsa de ${mat} va de la pila a la balanza.` : `La bolsa de ${mat} sigue enterrada; la balanza marca 0,0 g. Pulsa «Pesar las bolsas».`);
  return { items, extent: 8, target: [2.5, 2.8, 0], narrow: { extent: 10.5, target: [2.5, 2.8, 0] }, description, pieces };
}

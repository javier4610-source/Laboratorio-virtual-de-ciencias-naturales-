/**
 * «cinetica-potencial» (lote 3D-3): las tres estaciones en 3D con sus barras de energía. Funciones PURAS a partir del
 * MISMO estado que dibuja el banco (src/models/kineticPotential.ts → cartStateAt, dropStateAt, springStateAt) y de las
 * MISMAS energías de sus barras 2D:
 *   - Cinética: riel de aire, carrito en x(t), fotopuerta a 0,60 m de la salida y flecha de la velocidad.
 *   - Potencial gravitatoria: torre con el objeto a la altura y(t) sobre el haz de la fotopuerta (nivel de referencia).
 *   - Potencial elástica: resorte comprimido x que empuja al carrito hasta su largo natural; luego el carrito sigue solo.
 * Escalas FIJAS por corrida: la energía total de la corrida mide 0,9 m de barra (o 0,45 de la altura de la torre) y la
 * mayor rapidez posible de la corrida mide 0,35 m de flecha (0,25 de la torre).
 */
import { fmt, fmtSig } from '../../lib/format';
import { FLAG_WIDTH, GATE_DISTANCE } from '../../models/kineticPotential';
import { arrowScale, type SceneItem, type Vec3 } from '../../three/scene';
import { cart, cartTop, energyBars, photogate, xArrow, type EnergyBar } from './mech3d';

export type KpStation = 'cinetica' | 'gravitatoria' | 'elastica';

export interface KpSceneInput {
  station: KpStation;
  /** Cinética: distancia desde la salida (m). Elástica: q (m, 0 = largo natural; negativo = resorte comprimido). */
  position: number;
  /** Gravitatoria: altura del objeto sobre el haz (m) y altura de la torre (m). */
  objY: number;
  height: number;
  /** Rapidez actual (m/s) y la mayor de la corrida (fija la escala). */
  v: number;
  vMax: number;
  /** Energías de las barras del banco (J), y la total de la corrida. */
  ep: number;
  ek: number;
  heat: number;
  total: number;
  compression: number;
  /** Texto de lo que pasa (el mismo pie de las barras del banco). */
  caption: string;
  massKg: number;
}

const CART_L = 0.16;
const FLOOR = 0.02;
const SPRING_NAT = 0.15;

function trackItems(inp: KpSceneInput, elastic: boolean): { items: SceneItem[]; cx: number } {
  const size: Vec3 = [CART_L, 0.05 + 0.03 * inp.massKg, 0.1];
  const cx = inp.position; // centro del carrito: 0 = salida (cinética) o largo natural (elástica)
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0.45, -0.2, -0.2], size: [1.9, 1.0], color: 'surface-3' },
    { id: 'riel', kind: 'box', center: [0.45, FLOOR - 0.025, 0], size: [1.6, 0.05, 0.08], color: 'series-8', edges: true },
    { id: 'pata-1', kind: 'rod', from: [-0.25, -0.2, 0], to: [-0.25, FLOOR - 0.05, 0], radius: 0.014, color: 'ink-2' },
    { id: 'pata-2', kind: 'rod', from: [1.15, -0.2, 0], to: [1.15, FLOOR - 0.05, 0], radius: 0.014, color: 'ink-2' },
    ...photogate('fotopuerta', GATE_DISTANCE, FLOOR, 0.25, 0.1, 'Fotopuerta'),
    ...cart('carrito', cx, FLOOR, size, 'series-2'),
    { id: 'bandera', kind: 'box', center: [cx, cartTop(FLOOR, size) + 0.04, 0], size: [FLAG_WIDTH, 0.08, 0.004], color: 'ink' },
  ];
  const y = FLOOR + 0.05;
  if (elastic) {
    const mount = -CART_L / 2 - SPRING_NAT - 0.03;
    const end = Math.min(cx, 0) - CART_L / 2;
    items.push({ id: 'tope', kind: 'box', center: [mount - 0.015, y, 0], size: [0.03, 0.1, 0.1], color: 'series-7' });
    items.push({ id: 'resorte', kind: 'spring', from: [mount, y, 0], to: [end, y, 0], coils: 9, radius: 0.025, wire: 0.004, color: 'series-4', label: inp.compression > 0 && cx < -1e-4 ? `Resorte (x = ${fmt(-cx * 100, 1)} cm)` : 'Resorte' });
  } else {
    items.push({ id: 'lanzador', kind: 'box', center: [-CART_L / 2 - 0.06, y, 0], size: [0.1, 0.08, 0.1], color: 'series-7', label: 'Lanzador' });
  }
  const k = arrowScale(inp.vMax, 0.35);
  const top = cartTop(FLOOR, size);
  const a = xArrow('v', [cx + CART_L / 2, top - 0.02, 0], inp.v, k, 'series-1', 'v', 0.009, 0.01);
  if (a) items.push(a);
  return { items, cx };
}

function towerItems(inp: KpSceneInput): SceneItem[] {
  const H = inp.height;
  const r = Math.max(0.03, 0.025 * H);
  const items: SceneItem[] = [
    { id: 'piso', kind: 'plane', center: [0.15 * H, -0.12 * H, -0.1 * H], size: [0.9 * H + 0.8, 0.6 * H + 0.6], color: 'surface-3' },
    { id: 'mastil', kind: 'rod', from: [-0.25 - 0.02 * H, -0.12 * H, 0], to: [-0.25 - 0.02 * H, H + 0.15, 0], radius: Math.max(0.012, 0.008 * H), color: 'ink-2' },
    { id: 'electroiman', kind: 'box', center: [0, H + r + 0.03, 0], size: [2.4 * r, 0.05, 2.4 * r], color: 'series-7', label: `Altura h = ${fmt(H, 2)} m` },
    ...photogate('fotopuerta', 0, -0.06 * H, 0, Math.max(0.08, 0.05 * H), 'Fotopuerta'),
    { id: 'objeto', kind: 'sphere', center: [0, inp.objY, 0], radius: r, color: 'series-8' },
  ];
  const k = arrowScale(inp.vMax, 0.25 * H);
  if (inp.v * k > 0.01) items.push({ id: 'v', kind: 'arrow', from: [r * 1.4, inp.objY, 0], vector: [0, -inp.v * k, 0], radius: Math.max(0.008, r * 0.25), color: 'series-1', label: 'v' });
  return items;
}

export function kpScene(inp: KpSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const tower = inp.station === 'gravitatoria';
  const barsList: EnergyBar[] = [
    { id: 'ep', label: inp.station === 'elastica' ? 'Ep elástica' : 'Ep', value: inp.ep, color: inp.station === 'elastica' ? 'series-4' : 'series-2' },
    { id: 'ec', label: 'Ec', value: inp.ek, color: 'series-1' },
    { id: 'q', label: 'Disipada', value: inp.heat, color: 'series-7' },
  ];
  let items: SceneItem[];
  let extent: number, target: Vec3;
  if (tower) {
    const H = inp.height;
    const barH = 0.45 * H;
    items = [...towerItems(inp), ...energyBars([0.35 + 0.08 * H, -0.12 * H, -0.15 * H], barsList, inp.total, { maxHeight: barH, width: 0.07 * H + 0.04, gap: 0.08 * H + 0.05 })];
    extent = 0.62 * H + 0.35;
    target = [0.2 * H, 0.45 * H, 0];
  } else {
    items = [...trackItems(inp, inp.station === 'elastica').items, ...energyBars([0.15, FLOOR - 0.05, -0.5], barsList, inp.total, { maxHeight: 0.6, width: 0.1, gap: 0.16 })];
    extent = 0.95;
    target = [0.4, 0.15, -0.2];
  }
  const e = (v: number) => `${fmtSig(Math.max(0, v) < 1e-9 ? 0 : v, 3)} J`;
  const head = inp.station === 'cinetica'
    ? `Riel de aire en 3D: el carrito está a ${fmt(inp.position, 2)} m de la salida (la fotopuerta está a ${fmt(GATE_DISTANCE, 2)} m) con rapidez ${fmt(inp.v, 2)} m/s.`
    : inp.station === 'gravitatoria'
      ? `Torre de caída en 3D: el objeto está a ${fmt(inp.objY, 2)} m sobre el haz de la fotopuerta (nivel de referencia, Ep = 0) con rapidez ${fmt(inp.v, 2)} m/s.`
      : inp.position < -1e-4
        ? `Lanzador de resorte en 3D: el resorte está comprimido ${fmt(-inp.position * 100, 1)} cm y empuja al carrito (rapidez ${fmt(inp.v, 2)} m/s).`
        : `Lanzador de resorte en 3D: el carrito ya dejó el resorte en su largo natural y está a ${fmt(inp.position, 2)} m de él (la fotopuerta está a ${fmt(GATE_DISTANCE, 2)} m), con rapidez ${fmt(inp.v, 2)} m/s.`;
  const description = `${head} Barras de energía (${inp.caption}; la columna completa es la energía de la corrida, ${e(inp.total)}): ${barsList.map((b) => `${b.label} ${e(b.value)}`).join(', ')}.`;
  return { items, extent, target, description };
}

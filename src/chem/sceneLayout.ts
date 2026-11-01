/**
 * Escenas de varias especies (funciones puras, sin React): coloca N copias de cada especie del kit en bloques y las
 * junta en una sola lista de átomos y enlaces para <SpeciesScene3D>. Lo usan las vistas 3D del lote 1
 * (balanceo, conservación, estequiometría, mol, soluciones): las COPIAS y sus átomos salen del estado del laboratorio;
 * la disposición en el espacio (rejilla, separación) es solo de dibujo.
 *
 * Las geometrías internas de cada copia son las de la especie (PubChem, VSEPR, red cristalina o iones del kit), con
 * su procedencia; el bloque solo las traslada (nunca las deforma).
 */
import { centroid, elementCounts, extent, type Species3D, type V3 } from './species';

export interface SceneAtom {
  el: string; x: number; y: number; z: number;
  charge?: number;
  /** Índice del bloque al que pertenece el átomo. */
  block: number;
  /** Copia (0…count−1) dentro del bloque. */
  copy: number;
  /** Dibujar atenuado (p. ej., gas que ya salió del sistema o producto que no se formó por el rendimiento). */
  dim?: boolean;
  /** Resaltar (anillo de color de datos): átomos del elemento elegido, iones del ejemplo, etc. */
  mark?: boolean;
}
export interface SceneBond { a: number; b: number; order: number; dim?: boolean }
export interface SceneLine { p: V3; q: V3 }
export interface SceneLabel { text: string; at: V3; /** Tamaño de letra (px) para rótulos grandes sin fondo, como la flecha de la ecuación. */ size?: number }

export interface Block {
  species: Species3D;
  count: number;
  /** Centro del bloque (Å). */
  center: V3;
  /** Columnas de la rejilla (por defecto, según el número de copias). */
  cols?: number;
  dim?: boolean;
  /** Elemento cuyos átomos se resaltan. */
  markElement?: string | null;
  /** Etiqueta del bloque (se dibuja sobre él). */
  label?: string;
  /** Copias que se dibujan atenuadas (las últimas `dimCopies` del bloque). */
  dimCopies?: number;
}

export interface BuiltScene {
  atoms: SceneAtom[];
  bonds: SceneBond[];
  labels: SceneLabel[];
  /** Caja que ocupa cada bloque (para encuadrar y para rotular). */
  boxes: { min: V3; max: V3 }[];
}

/** Separación entre copias (Å) y columnas por defecto de un bloque con n copias. */
export const COPY_GAP = 1.1;
export const defaultCols = (n: number) => (n <= 3 ? 1 : n <= 8 ? 2 : 3);

/** Lado de la celda que ocupa cada copia de la especie (Å). */
export const cellOf = (s: Species3D) => 2 * (extent(s.atoms) + 0.6) + COPY_GAP;

/** Ancho (x) y alto (y) de un bloque de n copias. */
export function blockSize(s: Species3D, n: number, cols = defaultCols(n)): { w: number; h: number } {
  const c = cellOf(s), k = Math.max(1, Math.min(cols, n || 1));
  return { w: k * c, h: Math.max(1, Math.ceil((n || 1) / k)) * c };
}

/** Centros de bloques puestos en fila a lo largo de x, empezando en x0, con `gap` Å entre bloques. */
export function rowCenters(sizes: { w: number }[], x0: number, gap: number): number[] {
  const out: number[] = [];
  let x = x0;
  for (const s of sizes) { out.push(x + s.w / 2); x += s.w + gap; }
  return out;
}

/** Construye la escena: cada bloque con `count` copias en rejilla alrededor de su centro. */
export function buildScene(blocks: Block[]): BuiltScene {
  const atoms: SceneAtom[] = [];
  const bonds: SceneBond[] = [];
  const labels: SceneLabel[] = [];
  const boxes: BuiltScene['boxes'] = [];
  blocks.forEach((b, bi) => {
    if (!Number.isInteger(b.count) || b.count < 0) throw new RangeError(`El número de copias de ${b.species.label} debe ser un entero ≥ 0.`);
    const c0 = centroid(b.species.atoms);
    const cell = cellOf(b.species);
    const cols = Math.max(1, Math.min(b.cols ?? defaultCols(b.count), Math.max(1, b.count)));
    const rows = Math.max(1, Math.ceil(b.count / cols));
    const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < b.count; k++) {
      const r = Math.floor(k / cols), col = k % cols;
      const inRow = r === rows - 1 ? b.count - r * cols : cols;
      const ox = b.center[0] + (col - (inRow - 1) / 2) * cell;
      const oy = b.center[1] + ((rows - 1) / 2 - r) * cell;
      // Escalonado leve en z: las copias no quedan en un plano perfecto y se ven mejor al girar.
      const oz = b.center[2] + ((k % 2) - 0.5) * 0.6;
      const dim = !!b.dim || (b.dimCopies ? k >= b.count - b.dimCopies : false);
      const start = atoms.length;
      for (const a of b.species.atoms) {
        const p: V3 = [a.x - c0[0] + ox, a.y - c0[1] + oy, a.z - c0[2] + oz];
        atoms.push({ el: a.el, x: p[0], y: p[1], z: p[2], ...(a.charge ? { charge: a.charge } : {}), block: bi, copy: k, ...(dim ? { dim } : {}), ...(b.markElement && a.el === b.markElement ? { mark: true } : {}) });
        for (let j = 0; j < 3; j++) { min[j] = Math.min(min[j], p[j]); max[j] = Math.max(max[j], p[j]); }
      }
      for (const bd of b.species.bonds) bonds.push({ a: start + bd.a, b: start + bd.b, order: bd.order, ...(dim ? { dim } : {}) });
    }
    if (b.count === 0) { for (let j = 0; j < 3; j++) { min[j] = b.center[j]; max[j] = b.center[j]; } }
    boxes.push({ min, max });
    if (b.label) labels.push({ text: b.label, at: [b.center[0], (b.count ? max[1] : b.center[1]) + 1.6, b.center[2]] });
  });
  return { atoms, bonds, labels, boxes };
}

/** Átomos por elemento de los bloques indicados (o de toda la escena), opcionalmente sin los atenuados. */
export function sceneCounts(scene: { atoms: SceneAtom[] }, blocks?: number[], includeDim = true): Record<string, number> {
  const set = blocks ? new Set(blocks) : null;
  return elementCounts(scene.atoms.filter((a) => (!set || set.has(a.block)) && (includeDim || !a.dim)));
}

/** Radio (Å) de la esfera centrada en el origen que contiene toda la escena (encuadre fijo). */
export function sceneRadius(scene: { atoms: { x: number; y: number; z: number }[] }, center: V3 = [0, 0, 0]): number {
  return Math.max(2, ...scene.atoms.map((a) => Math.hypot(a.x - center[0], a.y - center[1], a.z - center[2]))) + 1.5;
}

/** Centro geométrico de la escena (para encuadrar). */
export function sceneCenter(scene: { atoms: { x: number; y: number; z: number }[] }): V3 {
  if (!scene.atoms.length) return [0, 0, 0];
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const a of scene.atoms) { const p = [a.x, a.y, a.z]; for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], p[j]); hi[j] = Math.max(hi[j], p[j]); } }
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
}

/** Aristas de una caja alineada con los ejes (12 segmentos); sin la cara de arriba si `open`. */
export function boxEdges(min: V3, max: V3, open = false): SceneLine[] {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const P = (x: number, y: number, z: number): V3 => [x, y, z];
  const bottom: SceneLine[] = [
    { p: P(x0, y0, z0), q: P(x1, y0, z0) }, { p: P(x1, y0, z0), q: P(x1, y0, z1) }, { p: P(x1, y0, z1), q: P(x0, y0, z1) }, { p: P(x0, y0, z1), q: P(x0, y0, z0) },
  ];
  const sides: SceneLine[] = [
    { p: P(x0, y0, z0), q: P(x0, y1, z0) }, { p: P(x1, y0, z0), q: P(x1, y1, z0) }, { p: P(x1, y0, z1), q: P(x1, y1, z1) }, { p: P(x0, y0, z1), q: P(x0, y1, z1) },
  ];
  const top: SceneLine[] = [
    { p: P(x0, y1, z0), q: P(x1, y1, z0) }, { p: P(x1, y1, z0), q: P(x1, y1, z1) }, { p: P(x1, y1, z1), q: P(x0, y1, z1) }, { p: P(x0, y1, z1), q: P(x0, y1, z0) },
  ];
  return [...bottom, ...sides, ...(open ? [] : top)];
}

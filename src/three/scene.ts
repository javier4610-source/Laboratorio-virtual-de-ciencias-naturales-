/**
 * Kit de escenas 3D (física, biología y ambiente): tipos y funciones PURAS, sin three.js ni DOM, para poder probarlas
 * con Vitest y para que la vista de respaldo en SVG use exactamente la misma geometría y la misma cámara que WebGL.
 * Ver docs/v2/KIT-3D.md.
 *
 * Convenciones: unidades de la escena libres (cada práctica elige m, µm…), eje y hacia arriba, mano derecha. La cámara
 * orbita alrededor de `target` con un giro horizontal (yaw), una inclinación (pitch) y un acercamiento (zoom).
 */
import type { SceneColor } from './colors';

export type Vec3 = readonly [number, number, number];

/* ------------------------------------------------------------------ primitivas */

interface ItemBase {
  /** Identificador único en la escena (también es la clave para reutilizar la malla entre cuadros). */
  id: string;
  color: SceneColor;
  /** 0–1 (por defecto 1). */
  opacity?: number;
  /** Rótulo visible (superpuesto en HTML) y entrada de la leyenda. */
  label?: string;
  /** Se puede elegir con clic o desde la leyenda (requiere `onSelect` en <Scene3D>). */
  selectable?: boolean;
}
/** Esfera (lenteja, partícula grande, núcleo…). */
export interface SphereItem extends ItemBase { kind: 'sphere'; center: Vec3; radius: number }
/** Elipsoide alineado con los ejes (organelos, células). */
export interface EllipsoidItem extends ItemBase { kind: 'ellipsoid'; center: Vec3; radii: Vec3 }
/** Caja alineada con los ejes; `edges` dibuja sus aristas (pared celular, recipientes). */
export interface BoxItem extends ItemBase { kind: 'box'; center: Vec3; size: Vec3; edges?: boolean }
/** Varilla o hilo: cilindro entre dos puntos. */
export interface RodItem extends ItemBase { kind: 'rod'; from: Vec3; to: Vec3; radius: number }
/** Vector: flecha desde `from` con la dirección y la longitud (en unidades de la escena) de `vector`. */
export interface ArrowItem extends ItemBase { kind: 'arrow'; from: Vec3; vector: Vec3; radius?: number }
/** Resorte: hélice entre dos puntos. */
export interface SpringItem extends ItemBase { kind: 'spring'; from: Vec3; to: Vec3; coils: number; radius: number; wire?: number }
/** Plano horizontal (mesa, superficie del agua) centrado en `center`, de `size` = [ancho en x, fondo en z]. */
export interface PlaneItem extends ItemBase { kind: 'plane'; center: Vec3; size: readonly [number, number] }
/** Nube de partículas iguales (moléculas de un gas, cloroplastos…). */
export interface ParticlesItem extends ItemBase { kind: 'particles'; points: readonly Vec3[]; radius: number }

export type SceneItem = SphereItem | EllipsoidItem | BoxItem | RodItem | ArrowItem | SpringItem | PlaneItem | ParticlesItem;

/* ------------------------------------------------------------------ vectores */

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => { const l = length(a); return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0]; };

/**
 * Escala para dibujar magnitudes físicas como flechas: la mayor magnitud esperada (`maxMagnitude`, en su unidad)
 * mide `targetLength` unidades de la escena. Se calcula UNA vez por corrida para que las flechas sean proporcionales
 * entre sí y entre cuadros (no se normaliza cada cuadro).
 */
export function arrowScale(maxMagnitude: number, targetLength: number): number {
  return maxMagnitude > 1e-12 && Number.isFinite(maxMagnitude) ? targetLength / maxMagnitude : 0;
}

/**
 * Convierte un vector físico (componentes en su unidad) en una flecha de la escena con la escala dada.
 * Devuelve `null` si la flecha mediría menos de `minLength` (no se dibuja una flecha de longitud cero).
 */
export function physicalArrow(from: Vec3, physical: Vec3, k: number, minLength = 1e-3): { from: Vec3; vector: Vec3; magnitude: number } | null {
  const magnitude = length(physical);
  const vector = scale(physical, k);
  if (length(vector) < minLength) return null;
  return { from, vector, magnitude };
}

/* ------------------------------------------------------------------ cámara (órbita) */

export interface Orbit {
  /** Giro alrededor del eje vertical (rad). */
  yaw: number;
  /** Inclinación sobre el plano horizontal (rad). */
  pitch: number;
  /** Acercamiento (1 = encuadre de `extent`). */
  zoom: number;
}
export const ORBIT_LIMITS = { pitch: [-1.4, 1.4] as const, zoom: [0.5, 4] as const };
export const DEFAULT_ORBIT: Orbit = { yaw: 0.45, pitch: 0.3, zoom: 1 };
/** Paso de las flechas del teclado y de los botones de giro. */
export const ROTATE_STEP = Math.PI / 12; // 15°
export const ZOOM_STEP = 1.25;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (a: number) => { const t = 2 * Math.PI; return ((((a + Math.PI) % t) + t) % t) - Math.PI; };

export function clampOrbit(o: Orbit): Orbit {
  return { yaw: wrap(o.yaw), pitch: clamp(o.pitch, ...ORBIT_LIMITS.pitch), zoom: clamp(o.zoom, ...ORBIT_LIMITS.zoom) };
}
export const rotateOrbit = (o: Orbit, dYaw: number, dPitch: number) => clampOrbit({ ...o, yaw: o.yaw + dYaw, pitch: o.pitch + dPitch });
export const zoomOrbit = (o: Orbit, factor: number) => clampOrbit({ ...o, zoom: o.zoom * factor });

/**
 * Teclado de la escena (pura, para probarla): flechas ← → giran, ↑ ↓ inclinan, + y − acercan y alejan, Inicio o 0
 * restablecen la vista. Devuelve la órbita nueva o `null` si la tecla no es de la escena.
 */
export function orbitFromKey(o: Orbit, key: string, initial: Orbit): Orbit | null {
  switch (key) {
    case 'ArrowLeft': return rotateOrbit(o, -ROTATE_STEP, 0);
    case 'ArrowRight': return rotateOrbit(o, ROTATE_STEP, 0);
    case 'ArrowUp': return rotateOrbit(o, 0, ROTATE_STEP);
    case 'ArrowDown': return rotateOrbit(o, 0, -ROTATE_STEP);
    case '+': case '=': case 'Add': return zoomOrbit(o, ZOOM_STEP);
    case '-': case '_': case 'Subtract': return zoomOrbit(o, 1 / ZOOM_STEP);
    case 'Home': case '0': return clampOrbit(initial);
    default: return null;
  }
}

/** Ejes de la cámara: `back` apunta del objetivo hacia la cámara; `right` y `up` son los ejes de la pantalla. */
export function viewBasis(o: Orbit): { right: Vec3; up: Vec3; back: Vec3 } {
  const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
  const back: Vec3 = [cp * Math.sin(o.yaw), sp, cp * Math.cos(o.yaw)];
  const right: Vec3 = [Math.cos(o.yaw), 0, -Math.sin(o.yaw)];
  const up = cross(back, right);
  return { right, up, back };
}

/** Campo visual vertical de la cámara en perspectiva (grados). */
export const FOV_DEG = 40;

/** Distancia de la cámara para que una esfera de radio `extent` quepa en un lienzo de proporción `aspect` = ancho/alto. */
export function cameraDistance(extent: number, aspect: number, zoom: number): number {
  const half = (FOV_DEG * Math.PI) / 360;
  const vertical = extent / Math.sin(half);
  const horizontal = extent / Math.sin(Math.atan(Math.tan(half) * Math.max(0.2, aspect)));
  return Math.max(vertical, horizontal) / zoom;
}

export function cameraPosition(o: Orbit, target: Vec3, extent: number, aspect: number): Vec3 {
  return add(target, scale(viewBasis(o).back, cameraDistance(extent, aspect, o.zoom)));
}

/**
 * Proyección ortográfica de la vista de respaldo (SVG) y de los rótulos sin WebGL: píxeles con el origen arriba a la
 * izquierda; `depth` crece hacia la cámara.
 */
export function projectOrtho(p: Vec3, o: Orbit, target: Vec3, extent: number, width: number, height: number) {
  const { right, up, back } = viewBasis(o);
  const d = sub(p, target);
  const k = pixelsPerUnit(o, extent, width, height);
  return { x: width / 2 + dot(d, right) * k, y: height / 2 - dot(d, up) * k, depth: dot(d, back) };
}
/**
 * Proyección en perspectiva idéntica a la cámara de three.js del kit (misma posición, `lookAt` al objetivo, FOV_DEG):
 * así los rótulos HTML se colocan sin preguntarle nada al motor. `visible` es falso si el punto queda detrás.
 */
export function projectPerspective(p: Vec3, o: Orbit, target: Vec3, extent: number, width: number, height: number) {
  const aspect = width / Math.max(1, height);
  const cam = cameraPosition(o, target, extent, aspect);
  const { right, up, back } = viewBasis(o);
  const d = sub(p, cam);
  const z = -dot(d, back);
  const t = Math.tan((FOV_DEG * Math.PI) / 360);
  if (z <= 1e-9) return { x: NaN, y: NaN, depth: -Infinity, visible: false };
  const nx = dot(d, right) / (z * t * aspect), ny = dot(d, up) / (z * t);
  return { x: ((nx + 1) / 2) * width, y: ((1 - ny) / 2) * height, depth: -z, visible: Math.abs(nx) <= 1.05 && Math.abs(ny) <= 1.05 };
}
export const pixelsPerUnit = (o: Orbit, extent: number, width: number, height: number) => ((Math.min(width, height) / 2 - 8) / Math.max(1e-9, extent)) * o.zoom;

/* ------------------------------------------------------------------ rótulos y descripción */

/** Punto donde se ancla el rótulo de cada primitiva (arriba del objeto o en la punta de la flecha). */
export function labelAnchor(it: SceneItem): Vec3 {
  switch (it.kind) {
    case 'sphere': return add(it.center, [0, it.radius * 1.15, 0]);
    case 'ellipsoid': return add(it.center, [0, it.radii[1] * 1.1, 0]);
    case 'box': return add(it.center, [0, it.size[1] / 2, 0]);
    case 'rod': case 'spring': return scale(add(it.from, it.to), 0.5);
    case 'arrow': return add(it.from, it.vector);
    case 'plane': return it.center;
    case 'particles': return it.points.length ? it.points[0] : [0, 0, 0];
  }
}

/**
 * Coloca los rótulos HTML sin que se tapen ni se salgan del lienzo: cada rótulo es una caja de `charWidth`·letras de
 * ancho y `lineHeight` de alto cuyo borde inferior izquierdo queda 6 px a la derecha del ancla. Si choca con otro ya
 * colocado, baja una línea. Devuelve `left` (borde izquierdo) y `bottom` (borde inferior), en px.
 */
export function spreadLabels<T extends { x: number; y: number; text: string }>(labels: readonly T[], width: number, height: number, charWidth = 7, lineHeight = 20) {
  const placed: { left: number; bottom: number; w: number; item: T }[] = [];
  for (const item of [...labels].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const w = item.text.length * charWidth + 14;
    const left = Math.max(2, Math.min(width - w - 2, item.x + 6));
    let bottom = Math.max(lineHeight + 2, Math.min(height - 2, item.y));
    for (let guard = 0; guard < labels.length; guard++) {
      const hit = placed.find((p) => left < p.left + p.w && p.left < left + w && Math.abs(p.bottom - bottom) < lineHeight);
      if (!hit) break;
      bottom = hit.bottom + lineHeight;
    }
    placed.push({ left, bottom: Math.min(height - 2, bottom), w, item });
  }
  return placed.map(({ left, bottom, item }) => ({ item, left, bottom }));
}

/** Texto de la cámara para la descripción accesible: «vista girada 26° e inclinada 17°, acercamiento 1,0×». */
export function describeOrbit(o: Orbit): string {
  const deg = (r: number) => Math.round((r * 180) / Math.PI);
  const n = (v: number) => v.toFixed(1).replace('.', ',');
  return `vista girada ${deg(o.yaw)}° e inclinada ${deg(o.pitch)}°, acercamiento ${n(o.zoom)}×`;
}

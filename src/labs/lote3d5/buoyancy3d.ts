/**
 * «flotacion» (lote 3D-5): el recipiente, el objeto colgado del dinamómetro y el densímetro en 3D, en centímetros reales.
 * Funciones PURAS con el MISMO resultado del modelo (src/models/buoyancy.ts → simulateBuoyancy, hydrometerStemDepth):
 *   - el objeto con sus dimensiones reales y su base a la profundidad del modelo bajo la superficie (que sube en el vaso
 *     sobre la balanza); la línea de flotación es la superficie del líquido sobre el objeto;
 *   - flechas Peso P, Empuje E y Tensión del hilo T (= lo que marca el dinamómetro) con los valores del modelo, a la misma
 *     escala (1 N = 2 cm): cuando flota, E = P y no hay T;
 *   - en el vaso de rebose, el colector con el volumen desalojado del modelo (V_sum) y en la probeta, el densímetro hundido
 *     la longitud de tallo del modelo para la densidad del líquido.
 * Dibujo: formas simplificadas, el resorte del dinamómetro y la probeta del densímetro.
 */
import { fmt } from '../../lib/format';
import { HYDROMETER, VESSEL_AREA_CM2, VESSEL_RADIUS_CM, objectHeight, type BuoyObject, type SetupId } from '../../models/buoyancy';
import type { SceneItem, Vec3 } from '../../three/scene';

export const N_ARROW = 3; // cm por newton
export const CUP_R = 3.2; // cm (colector del vaso de rebose)
const PER_N = 2.33; // cm de resorte por newton (dibujo)
const HYD_X = -15, HYD_SURF = 22;

export interface BuoyancySceneInput {
  obj: BuoyObject;
  liquidName: string;
  liquidColor: string;
  liquidOpacity: number;
  rhoLiq: number; // kg/m³
  setup: SetupId;
  /** Volumen de líquido del recipiente (mL) y descenso del dinamómetro (cm), los del banco. */
  volume: number;
  descent: number;
  /** Resultado del modelo. */
  depth: number;
  vSub: number;
  fraction: number;
  weight: number;
  buoyancy: number;
  apparent: number;
  floating: boolean;
  submerged: boolean;
  levelRise: number;
  /** Tallo sumergido del densímetro (cm) del modelo. */
  stemDepth: number;
  done: boolean;
}

/** Altura (cm) de la superficie del líquido: inicial (rebose: 1 L en el vaso; balanza: volumen/área) + subida. */
export function surfaceHeights(setup: SetupId, volume: number, levelRise: number): { initial: number; now: number } {
  const initial = setup === 'rebose' ? 1000 / VESSEL_AREA_CM2 : volume / VESSEL_AREA_CM2;
  return { initial, now: initial + levelRise };
}

/** Semiancho horizontal (cm) del objeto a la altura `h` sobre su base (para la línea de flotación). */
export function halfWidthAt(o: BuoyObject, h: number): number {
  const d = o.dims;
  switch (o.shape) {
    case 'cilindro': return d.r;
    case 'esfera': return Math.sqrt(Math.max(0, d.r ** 2 - (h - d.r) ** 2));
    case 'elipsoide': return d.a * Math.sqrt(Math.max(0, 1 - ((h - d.c) / d.c) ** 2));
    default: return d.a / 2;
  }
}

function objectItems(o: BuoyObject, base: number): SceneItem[] {
  const d = o.dims, H = objectHeight(o), col = o.color as `#${string}`;
  const label = o.name.split(' (')[0];
  switch (o.shape) {
    case 'cilindro': return [{ id: 'objeto', kind: 'rod', from: [0, base, 0], to: [0, base + H, 0], radius: d.r, color: col, label }];
    case 'prisma': return [{ id: 'objeto', kind: 'box', center: [0, base + H / 2, 0], size: [d.a, H, d.b], color: col, label }];
    case 'esfera': return [{ id: 'objeto', kind: 'sphere', center: [0, base + d.r, 0], radius: d.r, color: col, label }];
    case 'elipsoide': return [{ id: 'objeto', kind: 'ellipsoid', center: [0, base + d.c, 0], radii: [d.a, d.c, d.a], color: col, label }];
    case 'barco': return [
      { id: 'objeto', kind: 'box', center: [0, base + 0.25, 0], size: [d.a, 0.5, d.b], color: col, label },
      { id: 'casco-1', kind: 'box', center: [0, base + H / 2, d.b / 2 - 0.2], size: [d.a, H, 0.4], color: col },
      { id: 'casco-2', kind: 'box', center: [0, base + H / 2, -d.b / 2 + 0.2], size: [d.a, H, 0.4], color: col },
      { id: 'casco-3', kind: 'box', center: [d.a / 2 - 0.2, base + H / 2, 0], size: [0.4, H, d.b], color: col },
      { id: 'casco-4', kind: 'box', center: [-d.a / 2 + 0.2, base + H / 2, 0], size: [0.4, H, d.b], color: col },
    ];
  }
}

export function buoyancyScene(inp: BuoyancySceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; base: number; surface: number } {
  const o = inp.obj, H = objectHeight(o);
  const surf = surfaceHeights(inp.setup, inp.volume, inp.levelRise);
  const base = surf.now - inp.depth;
  const top = base + H;
  const vesselH = inp.setup === 'rebose' ? surf.initial + 2.2 : 16.9;
  const halfZ = o.shape === 'prisma' || o.shape === 'barco' ? o.dims.b / 2 : halfWidthAt(o, H / 2) || 1;
  const front = halfZ + 0.5;
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [-2, -2.05, 0], size: [44, 20], color: 'surface-3' },
    { id: 'vaso', kind: 'rod', from: [0, 0, 0], to: [0, vesselH, 0], radius: VESSEL_RADIUS_CM + 0.15, color: 'line-strong', opacity: 0.14, label: inp.setup === 'rebose' ? 'Vaso de rebose' : 'Vaso' },
    { id: 'liquido', kind: 'rod', from: [0, 0.05, 0], to: [0, surf.now, 0], radius: VESSEL_RADIUS_CM, color: inp.liquidColor as `#${string}`, opacity: Math.min(0.6, inp.liquidOpacity + 0.05) },
    ...objectItems(o, base),
  ];
  // Línea de flotación: donde la superficie del líquido corta el objeto.
  if (inp.depth > 0.02 && !inp.submerged) {
    const w = halfWidthAt(o, inp.depth) + 0.12;
    items.push(o.shape === 'prisma' || o.shape === 'barco'
      ? { id: 'flotacion', kind: 'box', center: [0, surf.now, 0], size: [o.dims.a + 0.24, 0.08, o.dims.b + 0.24], color: 'data', label: 'Línea de flotación' }
      : { id: 'flotacion', kind: 'rod', from: [0, surf.now - 0.04, 0], to: [0, surf.now + 0.04, 0], radius: w, color: 'data', label: 'Línea de flotación' });
  }
  // Fuerzas a la misma escala, dibujadas delante del objeto.
  const mid = base + H / 2;
  items.push({ id: 'P', kind: 'arrow', from: [0.5, mid, front], vector: [0, -inp.weight * N_ARROW, 0], radius: 0.16, color: 'series-1', label: 'Peso P' });
  if (inp.buoyancy * N_ARROW > 0.05) items.push({ id: 'E', kind: 'arrow', from: [-0.5, base + Math.min(inp.depth, H) / 2, front], vector: [0, inp.buoyancy * N_ARROW, 0], radius: 0.16, color: 'series-2', label: 'Empuje E' });
  // Dinamómetro: el gancho baja con el soporte; si el objeto flota, el hilo queda flojo y el gancho llega hasta él.
  const tautBase = surf.initial - inp.descent;
  const hook = Math.max(tautBase + H + 1.5, top + 0.45);
  const spring = 3 + inp.apparent * PER_N;
  const body = hook + spring;
  items.push(
    { id: 'hilo', kind: 'rod', from: [0, hook, 0], to: [0, top, 0], radius: 0.05, color: 'ink-2' },
    { id: 'resorte', kind: 'spring', from: [0, hook, 0], to: [0, body, 0], coils: 9, radius: 0.55, wire: 0.08, color: 'ink-3' },
    { id: 'dinamometro', kind: 'rod', from: [0, body, 0], to: [0, body + 7, 0], radius: 0.9, color: '#e9edef', opacity: 0.9, label: 'Dinamómetro' },
  );
  if (inp.apparent * N_ARROW > 0.05) items.push({ id: 'T', kind: 'arrow', from: [0, top, front * 0.3], vector: [0, inp.apparent * N_ARROW, 0], radius: 0.13, color: 'ink-2', label: 'Tensión T' });
  // Colector del vaso de rebose (sobre la balanza) o balanza bajo el vaso.
  if (inp.setup === 'rebose') {
    const vol = inp.vSub, h = vol / (Math.PI * CUP_R ** 2);
    items.push(
      { id: 'pico', kind: 'rod', from: [VESSEL_RADIUS_CM, surf.initial + 0.3, 0], to: [VESSEL_RADIUS_CM + 3, surf.initial - 1.5, 0], radius: 0.4, color: 'line-strong', opacity: 0.35 },
      { id: 'balanza', kind: 'box', center: [11, -1.2, 0], size: [9, 1.6, 8], color: 'ink-3' },
      { id: 'colector', kind: 'rod', from: [11, -0.4, 0], to: [11, 5.6, 0], radius: CUP_R + 0.12, color: 'line-strong', opacity: 0.16, label: 'Colector' },
    );
    if (h > 0.02) items.push({ id: 'desalojado', kind: 'rod', from: [11, -0.35, 0], to: [11, -0.35 + h, 0], radius: CUP_R, color: inp.liquidColor as `#${string}`, opacity: 0.7, label: 'Líquido desalojado' });
  } else {
    items.push({ id: 'balanza', kind: 'box', center: [0, -1.2, 0], size: [13, 1.6, 12], color: 'ink-3', label: 'Balanza' });
  }
  // Probeta con el densímetro (tallo de 16 cm; el modelo da cuánto tallo se hunde).
  const stemBottom = HYD_SURF - inp.stemDepth;
  items.push(
    { id: 'probeta', kind: 'rod', from: [HYD_X, -2, 0], to: [HYD_X, 26, 0], radius: 2.6, color: 'line-strong', opacity: 0.14 },
    { id: 'probeta-liquido', kind: 'rod', from: [HYD_X, -1.95, 0], to: [HYD_X, HYD_SURF, 0], radius: 2.45, color: inp.liquidColor as `#${string}`, opacity: Math.min(0.55, inp.liquidOpacity) },
    { id: 'bulbo', kind: 'ellipsoid', center: [HYD_X, stemBottom - 2.4, 0], radii: [1.1, 2.4, 1.1], color: '#e9edef', opacity: 0.9 },
    { id: 'lastre', kind: 'sphere', center: [HYD_X, stemBottom - 4.6, 0], radius: 0.7, color: '#59606b' },
    { id: 'tallo', kind: 'rod', from: [HYD_X, stemBottom, 0], to: [HYD_X, stemBottom + HYDROMETER.stemLength, 0], radius: 0.28, color: '#f6f1d8', label: 'Densímetro' },
  );
  const state = inp.floating
    ? `flota con el ${fmt(inp.fraction * 100, 1)} % de su volumen bajo la superficie (línea de flotación) y el hilo está flojo: el empuje E iguala al peso P y no hay tensión`
    : inp.depth <= 0 ? 'cuelga en el aire, sobre el líquido: no hay empuje y el hilo sostiene todo el peso'
      : inp.submerged ? 'cuelga totalmente sumergido: el empuje E es menor que el peso P y el hilo sostiene la diferencia (T = P − E)'
        : `cuelga con ${fmt(inp.depth, 1)} cm de su altura sumergidos: el empuje E es menor que el peso P y el hilo sostiene la diferencia (T = P − E)`;
  const desal = inp.setup === 'rebose'
    ? `El líquido desalojado (tanto como el volumen sumergido${inp.done ? `: ${fmt(inp.vSub, 1)} cm³` : ''}) cae al colector.`
    : 'El nivel del vaso sube porque el objeto ocupa el lugar del líquido.';
  const vals = inp.done ? ` En el modelo: P = ${fmt(inp.weight, 2)} N, E = ${fmt(inp.buoyancy, 2)} N, T = ${fmt(inp.apparent, 2)} N.` : '';
  const description = `${inp.setup === 'rebose' ? 'Vaso de rebose' : 'Vaso sobre la balanza'} en 3D con ${inp.liquidName.toLowerCase()}${inp.done ? ` (${fmt(inp.rhoLiq / 1000, 3)} g/cm³)` : ''}. ${o.name}: ${state}. ${desal}${vals} `
    + `Las flechas P, E y T tienen la misma escala (1 N = 3 cm). En la probeta, el densímetro se hunde ${fmt(inp.stemDepth, 1)} cm de tallo: cuanto más denso el líquido, menos se hunde.`;
  return { items, extent: 20, target: [-2, 10, 0], description, base, surface: surf.now };
}

/**
 * «densidad» (lote 3D-5): la mesa con la balanza, la probeta y la muestra en 3D, en centímetros reales. Funciones PURAS
 * con el MISMO resultado del modelo (src/models/density.ts → simulateDensity) y el mismo estado del banco:
 *   - el cubo mide la arista elegida y está donde lo puso el estudiante (mesa, plato de la balanza o probeta);
 *   - la probeta se dibuja A ESCALA en volumen (radio interior 2,5 cm: 1 mL = 1 cm³ sube el agua 1/19,6 cm), con el nivel
 *     que muestra el banco; si la muestra flota, sumerge la fracción ρ/ρ_agua del modelo (o entera con el alfiler);
 *   - detrás, una fila de cubos de 50 g de cada material de la tabla, con arista ∛(50 g / ρ): a igual masa, el material
 *     menos denso ocupa más volumen. (La masa común de 50 g es una elección del dibujo.)
 */
import { fmt } from '../../lib/format';
import { CYLINDER_CAPACITY, MATERIALS, type Material } from '../../models/density';
import type { SceneItem, Vec3 } from '../../three/scene';

export const CYL_R = 2.5; // cm (radio interior)
export const CYL_AREA = Math.PI * CYL_R ** 2; // cm²
export const ROW_MASS = 50; // g (dibujo)
const BAL_X = -9, CYL_X = 7, BASE = 0.3, PAN_Y = 1.9;

/** Altura (cm) del agua en la probeta para un volumen en mL (1 mL = 1 cm³). */
export const waterHeight = (mL: number) => mL / CYL_AREA;
/** Arista (cm) de un cubo de masa `m` (g) de densidad ρ (g/cm³). */
export const equalMassSide = (m: number, rho: number) => Math.cbrt(m / rho);

export interface DensitySceneInput {
  material: Material;
  side: number; // cm
  /** 0 mesa, 1 balanza, 2 probeta (el mismo lugar del banco). */
  station: 0 | 1 | 2;
  weighed: boolean;
  massReading: number | null;
  /** Nivel que muestra la probeta del banco (mL). */
  level: number;
  overflow: boolean;
  floats: boolean;
  pushUnder: boolean;
  submergedFraction: number;
  initialWater: number;
}

export function densityScene(inp: DensitySceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; cubeBottom: number; water: number } {
  const a = inp.side;
  const water = BASE + waterHeight(Math.min(CYLINDER_CAPACITY, inp.level));
  const cylH = BASE + waterHeight(CYLINDER_CAPACITY) + 0.8;
  const floating = inp.floats && !inp.pushUnder;
  let cube: Vec3, cubeBottom: number;
  if (inp.station === 2) {
    cubeBottom = floating ? water - a * inp.submergedFraction : BASE;
    cube = [CYL_X, cubeBottom + a / 2, 0];
  } else if (inp.station === 1) {
    cubeBottom = PAN_Y;
    cube = [BAL_X, PAN_Y + a / 2, 0];
  } else {
    cubeBottom = 0;
    cube = [-1, a / 2, 2.5];
  }
  const reading = inp.weighed ? (inp.massReading === null ? 'Err' : `${fmt(inp.massReading, 1)} g`) : '0,0 g';
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0, -0.02, -3], size: [36, 18], color: 'surface-3' },
    { id: 'balanza', kind: 'box', center: [BAL_X, 0.7, 0], size: [8, 1.4, 7], color: '#3a4448', label: `Balanza: ${reading}` },
    { id: 'plato', kind: 'rod', from: [BAL_X, 1.4, 0], to: [BAL_X, PAN_Y, 0], radius: 3, color: '#b9c3c6' },
    { id: 'probeta', kind: 'rod', from: [CYL_X, 0, 0], to: [CYL_X, cylH, 0], radius: CYL_R + 0.12, color: 'line-strong', opacity: 0.16, label: 'Probeta (100 mL)' },
    { id: 'base-probeta', kind: 'rod', from: [CYL_X, 0, 0], to: [CYL_X, BASE, 0], radius: CYL_R + 0.6, color: 'line-strong', opacity: 0.5 },
    { id: 'agua', kind: 'rod', from: [CYL_X, BASE, 0], to: [CYL_X, water, 0], radius: CYL_R, color: '#5aa9de', opacity: 0.45, label: `Agua: ${fmt(inp.level, 1)} mL` },
    { id: 'cubo', kind: 'box', center: cube, size: [a, a, a], color: inp.material.color as `#${string}`, opacity: inp.station === 2 ? 0.94 : 1, label: inp.material.name },
  ];
  // Marcas de la probeta cada 10 mL.
  for (let v = 10; v <= CYLINDER_CAPACITY; v += 10) {
    const y = BASE + waterHeight(v);
    items.push({ id: `marca-${v}`, kind: 'rod', from: [CYL_X - 0.6, y, CYL_R + 0.14], to: [CYL_X + (v % 50 === 0 ? 0.8 : 0.4), y, CYL_R + 0.14], radius: 0.03, color: 'ink-2' });
  }
  if (inp.station === 2 && inp.floats && inp.pushUnder) items.push({ id: 'alfiler', kind: 'rod', from: [CYL_X, cubeBottom + a, 0], to: [CYL_X, cylH + 2, 0], radius: 0.05, color: 'ink' });
  // Fila de cubos de igual masa (50 g) ordenados por densidad.
  const row = [...MATERIALS].sort((p, q) => p.density - q.density);
  let x = -16.2;
  row.forEach((m, i) => {
    const s = equalMassSide(ROW_MASS, m.density);
    items.push({ id: `fila-${m.id}`, kind: 'box', center: [x + s / 2, s / 2, -8], size: [s, s, s], color: m.color as `#${string}`,
      ...(i === 0 || i === row.length - 1 ? { label: `${ROW_MASS} g de ${m.name.toLowerCase()}` } : {}) });
    x += s + 0.5;
  });
  const where = inp.station === 0 ? 'sobre la mesa'
    : inp.station === 1 ? `en el plato de la balanza, que marca ${reading}`
      : inp.overflow ? 'dentro de la probeta: el agua se desborda'
        : floating ? `flotando en la probeta con el ${fmt(inp.submergedFraction * 100, 0)} % de su volumen bajo el agua, que subió de ${fmt(inp.initialWater, 1)} a ${fmt(inp.level, 1)} mL`
          : `en el fondo de la probeta${inp.floats ? ' (hundido con el alfiler)' : ''}: el agua subió de ${fmt(inp.initialWater, 1)} a ${fmt(inp.level, 1)} mL, tanto como el volumen del cubo`;
  const description = `Mesa en 3D con la balanza, la probeta (dibujada a escala: el agua sube 1 cm por cada ${fmt(CYL_AREA, 1)} mL) y la muestra: ${inp.material.name.toLowerCase()}, cubo de ${fmt(a, 1)} cm de arista, ${where}. `
    + `Detrás, cubos de ${ROW_MASS} g de cada material de la tabla, del menos denso al más denso: ${row.map((m) => `${m.name.toLowerCase()} ${fmt(equalMassSide(ROW_MASS, m.density), 1)} cm`).join(', ')} de arista. A igual masa, el material más denso ocupa menos volumen.`;
  return { items, extent: 14.5, target: [-0.5, 2, -3], description, cubeBottom, water };
}

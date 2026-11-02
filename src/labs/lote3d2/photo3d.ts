/**
 * «fotosintesis» (lote 3D-2): un cloroplasto de la elodea en 3D (envoltura, estroma y grana de tilacoides) con flechas
 * de luz, CO₂ y O₂ y burbujas de O₂. Funciones PURAS a partir del MISMO modelo del laboratorio
 * (src/models/photosynthesis.ts → simulatePhotosynthesis):
 *   - la flecha de luz mide la luz efectiva (irradiancia × factor del color) sobre la mayor posible en la práctica;
 *   - las flechas de CO₂ (fotosíntesis bruta: el CO₂ que fija el ciclo de Calvin, 1 CO₂ por O₂) y de O₂ (fotosíntesis neta;
 *     hacia adentro si es negativa) comparten una escala fija: la mayor tasa bruta posible en los rangos de la práctica;
 *   - las burbujas suben con la MISMA fase de animación que el banco 2D (su ritmo es el de las burbujas por minuto).
 * Las escalas se calculan una vez con el propio modelo (no se normaliza cada cuadro). Forma y tamaño: dibujo.
 */
import { dissolvedCarbon, grossRate, irradiance, LIGHT_COLORS, PHOTO_LIMITS, type LightColor, type PhotoResult } from '../../models/photosynthesis';
import { fmt } from '../../lib/format';
import { arrowScale, physicalArrow, type SceneItem, type Vec3 } from '../../three/scene';
import type { SceneColor } from '../../three/colors';

/** Mayor luz efectiva posible (lámpara a la distancia mínima con el color de mayor factor). */
export const MAX_LIGHT = irradiance(PHOTO_LIMITS.distance[0]) * Math.max(...LIGHT_COLORS.map((c) => c.factor));
/** Mayor tasa bruta posible en los rangos de la práctica (µmol O₂/g·h), barriendo la temperatura de grado en grado. */
export const MAX_GROSS = (() => {
  let m = 0;
  for (let T = PHOTO_LIMITS.temperature[0]; T <= PHOTO_LIMITS.temperature[1]; T++) m = Math.max(m, grossRate(MAX_LIGHT, dissolvedCarbon(PHOTO_LIMITS.bicarbonate[1]), T));
  return m;
})();
/** Largo (unidades de escena) de la flecha de la mayor magnitud. */
export const ARROW_MAX = 4.5;

export interface PhotoSceneInput {
  res: Pick<PhotoResult, 'effectiveLight' | 'gross' | 'net' | 'bubblesPerMin' | 'limiting'>;
  lampOn: boolean;
  color: LightColor;
  /** Fase de la animación de burbujas del banco 2D. */
  phase: number;
  /** El estudiante ya contó las burbujas (antes de eso no se dicen los valores del modelo). */
  counted: boolean;
}

/** Posiciones de las 6 burbujas (las mismas fases que el banco 2D: (fase + i/6) mod 1). */
export function bubblePositions(phase: number, bubblesPerMin: number): Vec3[] {
  if (!(bubblesPerMin > 0)) return [];
  return Array.from({ length: 6 }, (_, i) => {
    const prog = (((phase + i / 6) % 1) + 1) % 1;
    return [(i % 2 ? 0.5 : -0.5) + (i % 3) * 0.3, 2.6 + prog * 5.2, (i % 3 - 1) * 0.5] as Vec3;
  });
}

export function photoScene(inp: PhotoSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; arrows: { light: number; co2: number; o2: number } } {
  const { res } = inp;
  const items: SceneItem[] = [];
  items.push({ id: 'envoltura', kind: 'ellipsoid', center: [0, 0, 0], radii: [5, 2.3, 3], color: 'bio', opacity: 0.18, label: 'Cloroplasto (doble membrana)' });
  items.push({ id: 'estroma', kind: 'ellipsoid', center: [0, 0, 0], radii: [4.7, 2.05, 2.75], color: 'series-3', opacity: 0.1, label: 'Estroma (ciclo de Calvin: fija el CO₂)' });
  const granaX = [-3.1, -1.55, 0, 1.55, 3.1];
  granaX.forEach((x, g) => {
    const z = g % 2 ? 0.7 : -0.6, y0 = -0.75;
    const discs = 7 - Math.abs(g - 2);
    for (let k = 0; k < discs; k++) {
      items.push({ id: `tilacoide-${g}-${k}`, kind: 'rod', from: [x, y0 + k * 0.26, z], to: [x, y0 + k * 0.26 + 0.16, z], radius: 0.62, color: 'series-3', ...(g === 2 && k === 0 ? { label: 'Tilacoides en grana (captan la luz)' } : {}) });
    }
    if (g > 0) items.push({ id: `lamela-${g}`, kind: 'rod', from: [granaX[g - 1], y0 + 0.4, g % 2 ? -0.6 : 0.7], to: [x, y0 + 0.4, z], radius: 0.07, color: 'series-3', opacity: 0.7 });
  });

  const kLight = arrowScale(MAX_LIGHT, ARROW_MAX);
  const kRate = arrowScale(MAX_GROSS, ARROW_MAX);
  const lightHex = LIGHT_COLORS.find((c) => c.id === inp.color)?.color ?? '#f5f1d8';
  const lightColor: SceneColor = inp.color === 'blanca' ? 'warn' : (lightHex as `#${string}`);
  const light = inp.lampOn ? physicalArrow([0, 0, 0], [res.effectiveLight * 0.6, -res.effectiveLight * 0.8, 0], kLight, 0.15) : null;
  if (light) items.push({ id: 'luz', kind: 'arrow', from: [-light.vector[0] - 2.2, -light.vector[1] + 1.6, 0], vector: light.vector, radius: 0.16, color: lightColor, label: 'Luz' });
  const co2 = physicalArrow([0, 0, 0], [0, 0, -res.gross], kRate, 0.15);
  if (co2) items.push({ id: 'co2', kind: 'arrow', from: [2.4, -0.4, 3.2 - co2.vector[2]], vector: co2.vector, radius: 0.16, color: 'series-2', label: 'CO₂ que entra (se fija)' });
  const o2 = physicalArrow([0, 0, 0], [0, Math.abs(res.net), 0], kRate, 0.15);
  if (o2) {
    if (res.net >= 0) items.push({ id: 'o2', kind: 'arrow', from: [2.6, 2.1, 0], vector: o2.vector, radius: 0.16, color: 'series-5', label: 'O₂ que sale' });
    else items.push({ id: 'o2', kind: 'arrow', from: [2.6, 2.1 + o2.vector[1] + 0.3, 0], vector: [0, -o2.vector[1], 0], radius: 0.16, color: 'series-5', label: 'O₂ que entra (respiración)' });
  }
  const bubbles = bubblePositions(inp.phase, res.bubblesPerMin);
  if (bubbles.length) items.push({ id: 'burbujas', kind: 'particles', points: bubbles, radius: 0.3, color: 'series-5', opacity: 0.55, label: 'Burbujas de O₂' });

  let description = 'Cloroplasto de la elodea en 3D: doble membrana, estroma y grana de tilacoides. ';
  description += inp.lampOn ? `Flecha de luz: ${fmt(res.effectiveLight / MAX_LIGHT * 100, 0)} % de la mayor luz efectiva posible en la práctica. ` : 'Lámpara apagada: no llega luz a los tilacoides. ';
  description += 'Las flechas de CO₂ (lo que fija el ciclo de Calvin) y de O₂ (lo que sale) usan la misma escala. ';
  if (res.net < 0) description += 'La respiración supera a la fotosíntesis: la flecha de O₂ apunta hacia adentro y no salen burbujas. ';
  else if (bubbles.length) description += 'Las burbujas de O₂ suben al mismo ritmo que en el tubo del banco. ';
  description += inp.counted
    ? `Modelo: fotosíntesis bruta ${fmt(res.gross, 1)} y neta ${fmt(res.net, 1)} µmol O₂/g·h; factor limitante: ${inp.lampOn ? res.limiting : 'luz (apagada)'}.`
    : 'Cuenta las burbujas durante 1 minuto para ver los valores del modelo.';
  return { items, extent: 8.5, target: [0, 0.8, 0], description, arrows: { light: light ? Math.hypot(...light.vector) : 0, co2: co2 ? Math.abs(co2.vector[2]) : 0, o2: o2 ? o2.vector[1] * Math.sign(res.net || 1) : 0 } };
}

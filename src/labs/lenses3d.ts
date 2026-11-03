/**
 * Banco óptico y ojo en 3D (kit src/three). Funciones PURAS con el MISMO modelo del laboratorio (ecuación de las lentes
 * delgadas): la vela, la lente, la pantalla, los focos F y F′, los tres rayos principales trazados por `principalRays`
 * y la imagen (nítida, borrosa o virtual) que da `bench`. 1 unidad = 10 cm a lo largo del banco; las alturas se
 * exageran ×5 (una transformación afín: los rayos siguen siendo rectas y se cruzan en el mismo punto de la imagen).
 */
import { fmt } from '../lib/format';
import { bench, EYE, eyeImage, findEye, principalRays, type BenchInput } from '../models/lenses';
import type { SceneItem, Vec3 } from '../three/scene';

export const X = 0.1; // unidades por cm a lo largo del banco
export const Y = 0.5; // unidades por cm en altura (×5)
const p = (x: number, y: number, z = 0): Vec3 => [x * X - 6, y * Y, z];

export function benchScene(i: BenchInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const b = bench(i);
  const items: SceneItem[] = [
    { id: 'riel', kind: 'box', center: [0, -1.75, 0], size: [12.2, 0.12, 0.5], color: 'ink-3' },
    { id: 'eje-optico', kind: 'rod', from: p(0, 0), to: p(120, 0), radius: 0.012, color: 'line-strong' },
  ];
  // vela
  items.push({ id: 'vela', kind: 'rod', from: [p(i.objectX, 0)[0], -1.7, 0], to: p(i.objectX, i.objectH * 0.6), radius: 0.12, color: '#f2efe6' });
  items.push({ id: 'llama', kind: 'ellipsoid', center: p(i.objectX, i.objectH * 0.85), radii: [0.07, 0.22, 0.07], color: '#f2a32b', label: `vela (objeto) de ${fmt(i.objectH, 1)} cm` });
  // lente y soporte
  const lx = p(i.lensX, 0)[0];
  items.push({ id: 'soporte-lente', kind: 'rod', from: [lx, -1.7, 0], to: [lx, -1.05, 0], radius: 0.04, color: 'ink-2' });
  if (b.f > 0) items.push({ id: 'lente', kind: 'ellipsoid', center: [lx, 0, 0], radii: [0.09, 1.0, 1.0], color: 'series-5', opacity: 0.45, label: `lente convergente f = ${fmt(b.f, 1)} cm` });
  else items.push({ id: 'lente', kind: 'box', center: [lx, 0, 0], size: [0.1, 2.0, 2.0], color: 'series-5', opacity: 0.4, label: `lente divergente f = ${fmt(b.f, 1)} cm` });
  for (const [k, xf] of [['F', i.lensX - b.f], ['F′', i.lensX + b.f]] as [string, number][]) {
    if (xf >= 0 && xf <= 120) items.push({ id: `foco-${k}`, kind: 'sphere', center: p(xf, 0), radius: 0.07, color: 'ink', label: k });
  }
  // pantalla
  const sx = p(i.screenX, 0)[0];
  items.push({ id: 'pantalla', kind: 'box', center: [sx, 0, 0], size: [0.05, 2.6, 2.4], color: 'surface', opacity: 0.85, label: 'pantalla' });
  items.push({ id: 'soporte-pantalla', kind: 'rod', from: [sx, -1.7, 0], to: [sx, -1.3, 0], radius: 0.04, color: 'ink-2' });
  // rayos (hasta la pantalla si está a la derecha de la lente; si no, hasta el final del banco)
  const endX = b.s > 0 ? i.screenX : 120;
  const rays = b.dO > 0 ? principalRays(b.f, i.objectX, i.lensX, i.objectH * 0.85, endX) : [];
  const colors: SceneItem['color'][] = ['series-1', 'series-2', 'series-3'];
  rays.forEach((r, k) => {
    for (let s = 0; s + 1 < r.pts.length; s++) items.push({ id: `rayo${k}-${s}`, kind: 'rod', from: p(...r.pts[s]), to: p(...r.pts[s + 1]), radius: 0.02, color: colors[k], ...(s === 0 ? { label: `rayo ${k + 1}: ${r.name}` } : {}) });
    if (r.back) items.push({ id: `rayo${k}-virtual`, kind: 'rod', from: p(...r.back[0]), to: p(...r.back[1]), radius: 0.012, color: colors[k], opacity: 0.4 });
  });
  // imagen
  let imageTxt = '';
  if (b.dO <= 0) imageTxt = 'La vela no está a la izquierda de la lente.';
  else if (b.atInfinity) imageTxt = 'La vela está en el foco: los rayos salen paralelos y no se forma imagen.';
  else if (b.real) {
    if (b.s > 0 && b.blur !== null) {
      if (b.sharp) {
        items.push({ id: 'imagen', kind: 'arrow', from: [sx - 0.04, 0, 0], vector: [0, b.hi * 0.85 * Y, 0], radius: 0.05, color: 'data', label: `imagen nítida: ${fmt(Math.abs(b.hi), 2)} cm, invertida` });
      } else {
        const rad = Math.min(1.2, (b.blur / 2) * Y);
        // la mancha se centra donde el rayo central (que no se desvía) toca la pantalla
        const yc = ((-i.objectH * 0.85 * b.s) / b.dO) * Y;
        const disc = Array.from({ length: 24 }, (_, k): Vec3 => [sx - 0.04, yc + rad * Math.cos((k / 24) * 2 * Math.PI), rad * Math.sin((k / 24) * 2 * Math.PI)]);
        items.push({ id: 'mancha', kind: 'particles', points: disc, radius: 0.04, color: 'data', opacity: 0.8, label: `mancha borrosa de ${fmt(b.blur, 1)} cm` });
      }
    }
    if (b.imageX <= 125) items.push({ id: 'imagen-posicion', kind: 'sphere', center: p(Math.min(124, b.imageX), b.hi * 0.85), radius: 0.06, color: 'data', opacity: b.sharp ? 1 : 0.7 });
    imageTxt = `Imagen ${b.kind} a ${fmt(b.di, 1)} cm de la lente (aumento ${fmt(b.M, 2)}). ${b.sharp ? 'La pantalla está en el lugar justo: se ve nítida.' : b.s > 0 ? `En la pantalla, a ${fmt(b.s, 1)} cm, solo hay una mancha borrosa de ${fmt(b.blur ?? 0, 1)} cm.` : ''}`;
  } else {
    items.push({ id: 'imagen-virtual', kind: 'arrow', from: p(b.imageX, 0), vector: [0, b.hi * 0.85 * Y, 0], radius: 0.05, color: 'data', opacity: 0.5, label: `imagen virtual, derecha: ${fmt(b.hi, 2)} cm` });
    imageTxt = `Imagen virtual, derecha, a ${fmt(Math.abs(b.di), 1)} cm a la IZQUIERDA de la lente (aumento ${fmt(b.M, 2)}): los rayos salen separándose y sus prolongaciones (tenues) se cruzan allí. No se recoge en la pantalla.`;
  }
  const description = `Banco óptico de 120 cm: vela en ${fmt(i.objectX, 1)} cm, lente de f = ${fmt(b.f, 1)} cm en ${fmt(i.lensX, 1)} cm (d_o = ${fmt(b.dO, 1)} cm) y pantalla en ${fmt(i.screenX, 1)} cm. ${imageTxt} Se dibujan los tres rayos principales desde la punta de la llama.`;
  return { items, extent: 6.6, target: [0, -0.3, 0], description };
}

/** Ojo reducido en corte: lente equivalente en x = 0 y retina a 1,7 cm; 1 unidad = 1 cm, alturas sin exagerar. */
export function eyeScene(eyeId: string, dCm: number, lensD: number): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const e = findEye(eyeId);
  const r = eyeImage(eyeId, dCm, lensD);
  const items: SceneItem[] = [
    { id: 'globo', kind: 'sphere', center: [0.85, 0, 0], radius: 1.2, color: 'surface-2', opacity: 0.25 },
    { id: 'cristalino', kind: 'ellipsoid', center: [0, 0, 0], radii: [0.12, 0.45, 0.45], color: 'series-5', opacity: 0.6, label: `cristalino (${fmt(r.used, 1)} D)` },
    { id: 'retina', kind: 'ellipsoid', center: [EYE.retina + 0.02, 0, 0], radii: [0.03, 0.75, 0.75], color: 'bad', opacity: 0.7, label: 'retina' },
  ];
  if (lensD !== 0) items.push({ id: 'gafas', kind: lensD > 0 ? 'ellipsoid' : 'box', center: [-0.9, 0, 0], ...(lensD > 0 ? { radii: [0.08, 0.6, 0.6] as Vec3 } : { size: [0.08, 1.2, 1.2] as Vec3 }), color: 'series-3', opacity: 0.5, label: `lente correctora ${lensD > 0 ? '+' : '−'}${fmt(Math.abs(lensD), 2)} D` } as SceneItem);
  // rayos de un punto del eje: entran a la lente a ±0,35 cm y convergen en x = d_i
  const xi = Math.min(3.2, r.di);
  for (const [k, h] of [[0, 0.35], [1, -0.35], [2, 0.2], [3, -0.2]] as [number, number][]) {
    const startX = -2.6;
    const slope = Number.isFinite(dCm) ? h / dCm : 0; // pendiente al llegar desde el objeto
    const y0 = h - slope * (0 - startX);
    items.push({ id: `rayo-in-${k}`, kind: 'rod', from: [startX, y0, 0], to: [0, h, 0], radius: 0.012, color: 'series-1' });
    items.push({ id: `rayo-out-${k}`, kind: 'rod', from: [0, h, 0], to: [xi, h * (1 - xi / r.di), 0], radius: 0.012, color: 'series-1' });
  }
  items.push({ id: 'foco-imagen', kind: 'sphere', center: [r.di <= 3.2 ? r.di : 3.2, 0, 0], radius: 0.05, color: 'data', label: r.where === 'retina' ? 'imagen sobre la retina' : r.where === 'delante' ? 'imagen delante de la retina' : 'imagen detrás de la retina' });
  const where = r.where === 'retina' ? 'SOBRE la retina: se ve nítido' : r.where === 'delante' ? `DELANTE de la retina (a ${fmt(r.di * 10, 2)} mm): se ve borroso` : `DETRÁS de la retina (a ${fmt(r.di * 10, 2)} mm): se ve borroso`;
  const description = `${e.name}. Objeto ${Number.isFinite(dCm) ? `a ${fmt(dCm, 0)} cm` : 'muy lejano (infinito)'}${lensD !== 0 ? ` con una lente correctora de ${fmt(lensD, 2)} D` : ' sin gafas'}. El cristalino usa ${fmt(r.used, 1)} D (acomoda ${fmt(r.accommodation, 1)} D) y los rayos se juntan ${where}; la retina está a ${fmt(EYE.retina * 10, 0)} mm.`;
  return { items, extent: 3.1, target: [0.4, 0, 0], description };
}

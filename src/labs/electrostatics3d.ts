/**
 * Campo eléctrico en 3D (kit src/three). Funciones PURAS con el MISMO modelo y las MISMAS cargas del laboratorio:
 * líneas de campo integradas en el espacio (salen en todas las direcciones, no solo en el plano de la mesa), una
 * superficie equipotencial como nube de puntos (V = constante forma superficies, no líneas), la carga de prueba en su
 * posición con la flecha de la fuerza (escala fija por configuración) y la del campo.
 */
import { fmt } from '../lib/format';
import { arrowScale, physicalArrow, type SceneItem, type Vec3 } from '../three/scene';
import { equipotentialPoints, fieldAt, fieldLines, potentialAt, type PointCharge } from '../models/electrostatics';

/** 1 unidad de la escena = 10 cm. El plano z = 0 del modelo (la mesa, con x a la derecha e y hacia el fondo) es el plano
 * horizontal de la escena; la z del modelo es la vertical de la escena. */
export const S = 10;
export const toScene = (p: readonly number[]): Vec3 => [p[0] * S, p[2] * S, -p[1] * S];
const vecToScene = (v: readonly number[]): Vec3 => [v[0], v[2], -v[1]];

export interface FieldSceneInput {
  charges: PointCharge[];
  /** Posición de la carga de prueba (m) y su carga (C). */
  probe: [number, number, number];
  q0: number;
  showLines: boolean;
  showSurface: boolean;
  /** Potencial (V) de la superficie equipotencial dibujada; null = el de la carga de prueba. */
  level?: number | null;
  /** Rótulo de la carga de prueba (por defecto «q₀ = … nC»). */
  probeLabel?: string;
  /** Carga (C) con la que se fija la escala de la flecha de la fuerza (por defecto 50 nC, la máxima de la carga de prueba). */
  forceRef?: number;
  /** Distancia de referencia (m) de esa escala: la fuerza a esa distancia mide 1,2 unidades (por defecto 10 cm). */
  forceRefDistance?: number;
}
export interface FieldScene { items: SceneItem[]; extent: number; target: Vec3; description: string; level: number | null }

/** Escala fija de la flecha del campo para una configuración: |E| a 25 cm de la carga mayor mide 1,2 unidades. */
export function fieldArrowScale(charges: readonly PointCharge[]): number {
  const qmax = Math.max(...charges.map((c) => Math.abs(c.q)));
  return arrowScale((8.99e9 * qmax) / 0.0625, 1.2);
}

export function fieldScene(p: FieldSceneInput): FieldScene {
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0, -0.02, 0], size: [8.4, 8.4], color: 'surface-3', opacity: 0.6 },
  ];
  p.charges.forEach((c, i) => {
    const uc = c.q * 1e6;
    items.push({ id: `carga-${i}`, kind: 'sphere', center: toScene(c.pos), radius: 0.22 + 0.04 * Math.abs(uc), color: c.q > 0 ? 'series-1' : 'series-2', label: `q${i + 1} = ${uc > 0 ? '+' : '−'}${fmt(Math.abs(uc), 1)} µC` });
  });
  if (p.showLines) {
    const lines = fieldLines(p.charges, { perCharge: 10, step: 0.008, box: 0.42, maxSteps: 200, dims: 3 });
    lines.forEach((l, k) => {
      // Se dibuja cada 4.º punto para aligerar la escena (la línea sigue el campo calculado).
      const pts = l.filter((_, i) => i % 4 === 0 || i === l.length - 1);
      for (let i = 0; i + 1 < pts.length; i++) items.push({ id: `l${k}-${i}`, kind: 'rod', from: toScene(pts[i]), to: toScene(pts[i + 1]), radius: 0.018, color: 'ink-2', opacity: 0.7 });
      // Punta de flecha a la mitad de la línea: sentido del campo.
      const m = Math.floor(l.length / 2);
      if (l.length > 4) {
        const a = l[m], b = l[m + 1];
        const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const L = Math.hypot(...d) || 1;
        items.push({ id: `l${k}-punta`, kind: 'arrow', from: toScene(a), vector: vecToScene([(d[0] / L) * 0.32, (d[1] / L) * 0.32, (d[2] / L) * 0.32]), radius: 0.03, color: 'ink-2' });
      }
    });
  }
  const V0 = potentialAt(p.charges, p.probe);
  const level = p.level ?? (Number.isFinite(V0) && Math.abs(V0) > 1 ? V0 : null);
  if (p.showSurface && level !== null) {
    const pts = equipotentialPoints(p.charges, level, 0.6, 260);
    if (pts.length) items.push({ id: 'equipotencial', kind: 'particles', points: pts.map(toScene), radius: 0.05, color: 'series-3', opacity: 0.85, label: `superficie equipotencial V = ${fmt(level / 1000, 1)} kV` });
  }
  const E = fieldAt(p.charges, p.probe);
  const ok = E.every(Number.isFinite);
  const at = toScene(p.probe);
  items.push({ id: 'prueba', kind: 'sphere', center: at, radius: 0.16, color: p.q0 >= 0 ? 'series-4' : 'series-5', label: p.probeLabel ?? `q₀ = ${p.q0 >= 0 ? '+' : '−'}${fmt(Math.abs(p.q0) * 1e9, 0)} nC` });
  const kE = fieldArrowScale(p.charges);
  let Fmag = 0, Emag = 0;
  if (ok) {
    Emag = Math.hypot(...E);
    // La flecha del campo se acota a 2,5 unidades para que no atraviese la escena cerca de una carga.
    const cap = Math.min(1, 2.5 / Math.max(1e-9, Emag * kE));
    const ea = physicalArrow(at, vecToScene([E[0] * cap, E[1] * cap, E[2] * cap]), kE, 0.05);
    if (ea) items.push({ id: 'campo', kind: 'arrow', ...ea, radius: 0.05, color: 'series-6', label: `E = ${fmt(Emag / 1000, 1)} kN/C${cap < 1 ? ' (flecha acortada)' : ''}` });
    const F: Vec3 = [E[0] * p.q0, E[1] * p.q0, E[2] * p.q0];
    Fmag = Math.hypot(...F);
    // Sin referencia propia, la fuerza usa la escala del campo para q₀ = 50 nC (la carga de prueba máxima): F⃗ = q₀·E⃗.
    const kF = p.forceRef === undefined ? kE / 50e-9 : arrowScale((8.99e9 * Math.max(...p.charges.map((c) => Math.abs(c.q))) * p.forceRef) / (p.forceRefDistance ?? 0.1) ** 2, 1.2);
    const fcap = Math.min(1, 2.5 / Math.max(1e-9, Fmag * kF));
    const fa = physicalArrow(at, vecToScene([F[0] * fcap, F[1] * fcap, F[2] * fcap]), kF, 0.05);
    if (fa) items.push({ id: 'fuerza', kind: 'arrow', ...fa, radius: 0.07, color: 'data', label: `${Fmag >= 0.1 ? `F = ${fmt(Fmag, 3)} N` : `F = ${fmt(Fmag * 1000, 2)} mN`}${fcap < 1 ? ' (flecha acortada)' : ''}` });
  }
  const dirTxt = ok && Emag > 0 ? `forma ${fmt((Math.atan2(E[1], E[0]) * 180) / Math.PI, 0)}° con el eje x sobre la mesa` : '';
  return {
    items, extent: 5.2, target: [0, 0.4, 0], level,
    description: `Campo eléctrico en 3D de ${p.charges.length} carga${p.charges.length > 1 ? 's' : ''} sobre la mesa.${p.showLines ? ' Las líneas de campo salen de las cargas positivas y llegan a las negativas en todas las direcciones del espacio, no solo sobre la mesa.' : ''}` +
      (p.showSurface && level !== null ? ` La nube verde es la superficie equipotencial de ${fmt(level / 1000, 1)} kV que pasa por la carga de prueba: es una superficie cerrada alrededor de las cargas, perpendicular a las líneas.` : '') +
      (ok ? ` ${p.probeLabel ? `Carga ${p.probeLabel}` : `Carga de prueba de ${fmt(p.q0 * 1e9, 0)} nC`} en (${fmt(p.probe[0] * 100, 1)}; ${fmt(p.probe[1] * 100, 1)}) cm: campo ${fmt(Emag / 1000, 2)} kN/C que ${dirTxt}; fuerza ${Fmag >= 0.1 ? `${fmt(Fmag, 3)} N` : `${fmt(Fmag * 1000, 2)} mN`}.` : ' La carga de prueba está encima de una carga: allí el campo no está definido.'),
  };
}

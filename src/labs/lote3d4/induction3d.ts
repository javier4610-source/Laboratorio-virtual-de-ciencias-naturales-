/**
 * «induccion» (lote 3D-4): imán, bobina y líneas de campo en 3D para la ley de Faraday. Funciones PURAS con el MISMO
 * estado del laboratorio (posición del imán xm, polo, vueltas y la aguja del galvanómetro = fem del modelo en ese
 * instante, src/models/induction.ts → simulateFaraday / coilLinkage):
 *   - Líneas de campo del dipolo r = r₀·sin²θ en seis semiplanos alrededor del eje. Los r₀ se eligen con 1/r₀ igualmente
 *     espaciados: así el número de líneas que cruzan la espira central de la bobina es PROPORCIONAL al flujo del dipolo
 *     por ella (propiedad exacta del dipolo: la función de flujo es sin²θ/r). Las que la cruzan se resaltan.
 *   - Corriente inducida: flechas tangentes a la bobina cuyo sentido sigue el signo de la fem (positiva = giro de mano
 *     derecha alrededor de +x, el sentido en que el modelo mide el flujo) y cuya longitud es |fem| a escala fija
 *     (1000 mV, el fondo de escala del galvanómetro = 2,2 cm). Una flecha en el eje muestra el campo de esa corriente.
 * Unidades de la escena: centímetros. La bobina está centrada en x = 0 y el imán se mueve por el eje x.
 */
import { fmt } from '../../lib/format';
import { COIL, MAGNETS, type MagnetId, type Pole } from '../../models/induction';
import type { SceneItem, Vec3 } from '../../three/scene';

export const LINES_PER_PLANE = 8;
export const PLANES = 6;
export const GALV_FULL_MV = 1000;
export const EMF_ARROW_CM = 2.2;
const A = COIL.radius * 100; // radio de la bobina (cm)
/** Paso de 1/r₀ (cm⁻¹): con el imán en el centro, las 8 líneas de cada semiplano cruzan la espira central. */
export const PSI_STEP = 1 / A / LINES_PER_PLANE;

/** Función de flujo del dipolo en el borde de la espira central (cm⁻¹) con el imán a `d` cm de ella. */
export const loopPsi = (d: number) => (A * A) / (A * A + d * d) ** 1.5;
/** Líneas de cada semiplano que cruzan la espira central (proporcional al flujo). */
export const threadingLines = (dCm: number) => Math.min(LINES_PER_PLANE, Math.floor(loopPsi(dCm) / PSI_STEP + 1e-9));

/** Puntos de una línea de campo r = r₀ sin²θ del dipolo en xc, en el semiplano de ángulo φ; recortada a la escena. */
export function fieldLine(xc: number, r0: number, phi: number, skip: (p: Vec3) => boolean): Vec3[] {
  const pts: Vec3[] = [];
  const n = 44;
  for (let i = 1; i < n; i++) {
    const th = (i / n) * Math.PI;
    const r = r0 * Math.sin(th) ** 2;
    const rho = r * Math.sin(th);
    const p: Vec3 = [xc + r * Math.cos(th), rho * Math.cos(phi), rho * Math.sin(phi)];
    if (p[0] < -32 || p[0] > 12 || rho > 9 || skip(p)) continue;
    pts.push(p);
  }
  return pts;
}

export interface InductionSceneInput {
  magnet: MagnetId;
  pole: Pole;
  turns: number;
  /** Centro del imán (m): −0,20 fuera, 0 en el centro de la bobina. */
  xm: number;
  /** Aguja del galvanómetro (mV, con signo) en el mismo instante del banco. */
  emfMv: number;
  /** Flujo enlazado del modelo en esa posición (Wb). */
  linkage: number;
  moving: boolean;
}

export function inductionScene(inp: InductionSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; threading: number; arrowLength: number } {
  const xc = inp.xm * 100;
  const mag = MAGNETS[inp.magnet];
  const half = (mag.length * 100) / 2, w = mag.width * 100;
  const nRight = inp.pole === 'N';
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [-10, -4, 0], size: [46, 16], color: 'surface-3' },
    { id: 'tubo', kind: 'rod', from: [-30, 0, 0], to: [7, 0, 0], radius: 1.1, color: 'line-strong', opacity: 0.16 },
    { id: 'polo-der', kind: 'box', center: [xc + half / 2, 0, 0], size: [half, w, w], color: nRight ? '#c62828' : '#1f5fae', label: nRight ? 'N' : 'S' },
    { id: 'polo-izq', kind: 'box', center: [xc - half / 2, 0, 0], size: [half, w, w], color: nRight ? '#1f5fae' : '#c62828', label: nRight ? 'S' : 'N' },
    { id: 'bobina', kind: 'spring', from: [-A, 0, 0], to: [A, 0, 0], coils: Math.min(30, Math.round(6 + Math.sqrt(inp.turns) * 1.1)), radius: A, wire: 0.16, color: '#b87333', label: 'Bobina' },
  ];
  // Líneas de campo: k = 1…8 → r₀ = 1/(k·Δ). Las de k ≤ n cruzan la espira central.
  const d = Math.abs(xc);
  const n = threadingLines(d);
  const inside = (p: Vec3) => Math.abs(p[0] - xc) < half * 0.98 && Math.hypot(p[1], p[2]) < w * 0.5;
  for (let s = 0; s < PLANES; s++) {
    const phi = (s * 2 * Math.PI) / PLANES + 0.3;
    for (let k = 1; k <= LINES_PER_PLANE; k++) {
      const pts = fieldLine(xc, 1 / (k * PSI_STEP), phi, inside);
      if (pts.length < 2) continue;
      const thr = k <= n;
      items.push({ id: `linea-${s}-${k}`, kind: 'particles', points: pts, radius: thr ? 0.17 : 0.12, color: thr ? 'data' : 'ink-3', opacity: thr ? 1 : 0.55, ...(s === 0 && k === 1 ? { label: 'Líneas de campo' } : {}) });
    }
  }
  // Galvanómetro y cables.
  const g: Vec3 = [8, -2.6, 3];
  items.push({ id: 'galvanometro', kind: 'box', center: g, size: [3.6, 2.6, 1.2], color: 'surface-2', edges: true, label: 'G' });
  const ang = Math.max(-1, Math.min(1, inp.emfMv / GALV_FULL_MV)) * (Math.PI / 3);
  items.push({ id: 'aguja', kind: 'rod', from: [g[0], g[1] - 0.9, g[2] + 0.65], to: [g[0] + 1.6 * Math.sin(ang), g[1] - 0.9 + 1.6 * Math.cos(ang), g[2] + 0.65], radius: 0.07, color: 'bad' });
  items.push({ id: 'cable-1', kind: 'rod', from: [-A, -A, 0], to: [g[0] - 1.2, g[1] - 1, g[2]], radius: 0.08, color: '#b71c1c' });
  items.push({ id: 'cable-2', kind: 'rod', from: [A, -A, 0], to: [g[0] + 1.2, g[1] - 1, g[2]], radius: 0.08, color: '#263238' });

  // Corriente inducida (sentido = signo de la fem) y su campo en el eje.
  const len = Math.min(1.15, Math.abs(inp.emfMv) / GALV_FULL_MV) * EMF_ARROW_CM;
  const sg = Math.sign(inp.emfMv);
  if (Math.abs(inp.emfMv) >= 1 && len > 0.05) {
    for (let j = 0; j < 4; j++) {
      const phi = (j * Math.PI) / 2 + Math.PI / 4;
      const R = A + 0.6;
      const p: Vec3 = [0, R * Math.cos(phi), R * Math.sin(phi)];
      const t: Vec3 = [0, -Math.sin(phi) * sg, Math.cos(phi) * sg];
      items.push({ id: `I-${j}`, kind: 'arrow', from: [p[0] - (t[0] * len) / 2, p[1] - (t[1] * len) / 2, p[2] - (t[2] * len) / 2], vector: [t[0] * len, t[1] * len, t[2] * len], radius: 0.16, color: 'series-2', ...(j === 0 ? { label: 'I inducida' } : {}) });
    }
    items.push({ id: 'B-inducido', kind: 'arrow', from: [sg > 0 ? 2.6 : 2.6 + len * 1.4, 2.8, 0], vector: [sg * len * 1.4, 0, 0], radius: 0.14, color: 'series-5', label: 'B inducido' });
  }

  const poleName = inp.pole === 'N' ? 'norte' : 'sur';
  let description = `Imán de ${mag.short.toLowerCase()} en 3D con el polo ${poleName} hacia una bobina de ${inp.turns} vueltas; su centro está a ${fmt(d, 1)} cm del centro de la bobina. Líneas de campo del imán en seis planos alrededor del eje: ${n === 0 ? 'ninguna cruza todavía la espira central de la bobina' : `${n * PLANES} de ${LINES_PER_PLANE * PLANES} cruzan la espira central (resaltadas)`}; su número es proporcional al flujo. Flujo enlazado del modelo: ${fmt(Math.abs(inp.linkage) * 1000, 3)} mWb. `;
  if (Math.abs(inp.emfMv) >= 1) {
    const face = inp.emfMv < 0 ? 'norte' : 'sur';
    description += `El galvanómetro marca ${inp.emfMv < 0 ? '−' : ''}${fmt(Math.abs(inp.emfMv), 0)} mV: la corriente inducida (flechas azules) gira ${sg > 0 ? 'en un sentido' : 'en el sentido contrario'} y su campo (flecha B inducido) apunta ${sg > 0 ? 'hacia la derecha, alejándose del imán' : 'hacia la izquierda, hacia el imán'}; la cara de la bobina que mira al imán se comporta como un polo ${face}. Así se opone al cambio del flujo (ley de Lenz).`;
  } else description += inp.moving ? 'En este instante casi no cambia el flujo: la fem es casi cero.' : 'El imán está quieto: el flujo no cambia y no hay corriente inducida.';
  return { items, extent: 15, target: [-9, 0, 0], description, threading: n, arrowLength: len };
}

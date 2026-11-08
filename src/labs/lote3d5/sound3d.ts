/**
 * «sonido» (lote 3D-5): el tubo de resonancia del banco en 3D, con las capas de aire que vibran y la presión coloreada.
 * Funciones PURAS con el MISMO resultado del modelo (src/models/soundResonance.ts → tubeResponse: número de onda k y
 * refuerzo del tubo) y la misma onda estacionaria que dibuja el banco (StandingWave):
 *   - cerrado: desplazamiento S(y) = sen(k·d), d = distancia al agua (nodo de desplazamiento en el agua);
 *   - abierto: S(y) = cos(k·(distancia a la boca superior + corrección de extremo)) (vientres cerca de las bocas);
 *   - presión ∝ −dS/dy: donde el aire casi no se mueve (nodo de desplazamiento) la presión cambia más (vientre de presión);
 *   - la amplitud dibujada es la del banco: refuerzo del tubo (min(1, respuesta/25)) × envolvente de la fuente en vivo
 *     (1 con el generador; e^(−t/τ) tras golpear el diapasón; 0 en silencio).
 * Dibujo: el aire vibra cientos de veces por segundo; aquí, con «Mover el aire», 1 vez por segundo; el desplazamiento
 * máximo de las capas se dibuja de 1,5 cm y el diámetro del tubo se dibuja ampliado.
 */
import { fmt } from '../../lib/format';
import type { TubeType } from '../../models/soundResonance';
import type { SceneItem, Vec3 } from '../../three/scene';
import { mixHex } from './common';

export const XI_MAX = 1.5; // cm de dibujo
export const LAYER_STEP = 2.5; // cm
export const SLICE_STEP = 5; // cm
export const DRAWN_HZ = 1;
const NEUTRAL = '#c9d6df', HIGH = '#d9534f', LOW = '#3f86d6';

export interface SoundSceneInput {
  type: TubeType;
  /** Longitud de la columna de aire (cm). */
  lengthCm: number;
  diameterCm: number;
  /** Número de onda del modelo (rad/m). */
  k: number;
  /** Corrección de extremo 0,6·r (cm), la del banco. */
  endCm: number;
  /** Refuerzo del tubo del modelo (factor de la onda estacionaria). */
  response: number;
  /** Envolvente de la fuente en este instante (0–1), la misma del banco. */
  env: number;
  f: number;
  tempC: number;
  source: 'diapason' | 'generador';
  /** Segundos de la animación propia de la vista (FlowControls). */
  t: number;
}

/** Extremos de la columna de aire (cm sobre el fondo del tubo): cerrado [100 − L, 100]; abierto [0, L]. */
export function airColumn(type: TubeType, L: number): [number, number] {
  return type === 'cerrado' ? [100 - L, 100] : [0, L];
}

/** Forma del desplazamiento S(y) (−1…1) y de la presión P(y) = −(dS/dy)/k (−1…1) a la altura y (cm). */
export function standingShape(type: TubeType, y: number, L: number, k: number, endCm: number): { s: number; p: number } {
  const [y0, y1] = airColumn(type, L);
  if (type === 'cerrado') {
    const d = (y - y0) / 100;
    return { s: Math.sin(k * d), p: -Math.cos(k * d) };
  }
  const u = (y1 - y + endCm) / 100;
  return { s: Math.cos(k * u), p: -Math.sin(k * u) };
}

/** Alturas (cm) de los nodos y vientres de DESPLAZAMIENTO dentro de la columna de aire. */
export function nodesAndAntinodes(type: TubeType, L: number, k: number, endCm: number): { nodes: number[]; antinodes: number[] } {
  const [y0, y1] = airColumn(type, L);
  const half = (Math.PI / k) * 100; // λ/2 en cm
  const nodes: number[] = [], antinodes: number[] = [];
  const inside = (y: number) => y >= y0 - 1e-6 && y <= y1 + 1e-6;
  for (let n = 0; n < 400; n++) {
    if (type === 'cerrado') {
      const yn = y0 + n * half, ya = y0 + (n + 0.5) * half;
      if (inside(yn)) nodes.push(yn);
      if (inside(ya)) antinodes.push(ya);
      if (yn > y1) break;
    } else {
      const ya = y1 + endCm - n * half, yn = y1 + endCm - (n + 0.5) * half;
      if (inside(ya)) antinodes.push(ya);
      if (inside(yn)) nodes.push(yn);
      if (yn < y0) break;
    }
  }
  return { nodes, antinodes };
}

/** Amplitud dibujada (0–1): la del banco = refuerzo del tubo (tope 1 a 25 veces) × envolvente de la fuente. */
export const drawnAmplitude = (response: number, env: number) => Math.min(1, response / 25) * Math.max(0, env);

export function soundScene(inp: SoundSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; amp: number; layers: { y: number; dy: number }[] } {
  const { type, lengthCm: L, k, endCm } = inp;
  const [y0, y1] = airColumn(type, L);
  const R = 4 + 1.6 * inp.diameterCm; // radio dibujado (ampliado)
  const amp = drawnAmplitude(inp.response, inp.env);
  const phase = Math.cos(2 * Math.PI * DRAWN_HZ * inp.t);
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0, -1, 0], size: [70, 40], color: 'surface-3' },
    { id: 'soporte', kind: 'rod', from: [-R - 14, -1, -6], to: [-R - 14, 112, -6], radius: 0.8, color: 'line-strong' },
  ];
  // Tubo de vidrio (y tubo exterior del telescópico).
  if (type === 'cerrado') {
    items.push({ id: 'tubo', kind: 'rod', from: [0, 0, 0], to: [0, 100, 0], radius: R, color: 'line-strong', opacity: 0.16, label: 'Tubo de vidrio' });
    items.push({ id: 'agua', kind: 'rod', from: [0, 0.2, 0], to: [0, Math.max(0.4, y0), 0], radius: R * 0.94, color: '#5aa9de', opacity: 0.6, label: 'Agua' });
  } else {
    items.push({ id: 'tubo', kind: 'rod', from: [0, 0, 0], to: [0, L, 0], radius: R * 0.9, color: 'line-strong', opacity: 0.16, label: 'Tubo deslizante' });
    items.push({ id: 'tubo-exterior', kind: 'rod', from: [0, 0, 0], to: [0, 20, 0], radius: R, color: 'line-strong', opacity: 0.12 });
    items.push({ id: 'borde', kind: 'rod', from: [0, L - 0.3, 0], to: [0, L + 0.3, 0], radius: R * 0.95, color: 'fis', opacity: 0.8 });
  }
  // Rebanadas de aire coloreadas por la presión del instante: rojo = comprimido, azul = enrarecido.
  for (let ya = y0; ya < y1 - 0.5; ya += SLICE_STEP) {
    const yb = Math.min(y1, ya + SLICE_STEP);
    const p = standingShape(type, (ya + yb) / 2, L, k, endCm).p * amp * phase;
    const color = p >= 0 ? mixHex(NEUTRAL, HIGH, p) : mixHex(NEUTRAL, LOW, -p);
    items.push({ id: `presion-${Math.round(ya * 10)}`, kind: 'rod', from: [0, ya + 0.15, 0], to: [0, yb - 0.15, 0], radius: R * 0.86, color, opacity: 0.45 });
  }
  // Capas de aire: 7 «partículas» por capa que suben y bajan con S(y).
  const layers: { y: number; dy: number }[] = [];
  const pts: Vec3[] = [];
  const ring: [number, number][] = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * 0.55 * R, Math.sin((i * Math.PI) / 3) * 0.55 * R] as [number, number])];
  for (let y = y0 + LAYER_STEP / 2; y < y1; y += LAYER_STEP) {
    const dy = standingShape(type, y, L, k, endCm).s * amp * XI_MAX * phase;
    layers.push({ y, dy });
    for (const [x, z] of ring) pts.push([x, y + dy, z]);
  }
  items.push({ id: 'aire', kind: 'particles', points: pts, radius: 0.75, color: 'ink-2', label: 'Capas de aire' });
  // Nodos (N) y vientres (V) de desplazamiento, mientras suena.
  const nv = nodesAndAntinodes(type, L, k, endCm);
  if (amp > 0.01) {
    nv.nodes.forEach((y, i) => items.push({ id: `nodo-${i}`, kind: 'sphere', center: [-R - 4, y, 0], radius: 1.4, color: 'ink', ...(i === 0 ? { label: 'Nodo' } : {}) }));
    nv.antinodes.forEach((y, i) => items.push({ id: `vientre-${i}`, kind: 'sphere', center: [-R - 4, y, 0], radius: 1.8, color: 'data', ...(i === 0 ? { label: 'Vientre' } : {}) }));
  }
  // Regla junto al tubo (0 en la boca del cerrado, o en el fondo del abierto) con una marca cada 10 cm.
  items.push({ id: 'regla', kind: 'box', center: [R + 2.6, 50, 0], size: [2.4, 100, 0.4], color: '#d9b77e' });
  for (let c = 0; c <= 100; c += 10) items.push({ id: `marca-${c}`, kind: 'rod', from: [R + 1.4, c, 0.25], to: [R + (c % 50 === 0 ? 3.6 : 2.6), c, 0.25], radius: 0.18, color: '#4d3b1c' });
  // Fuente sobre la boca.
  const mouth = type === 'cerrado' ? 100 : L;
  if (inp.source === 'diapason') {
    items.push({ id: 'diapason-mango', kind: 'rod', from: [0, mouth + 22, 0], to: [0, mouth + 12, 0], radius: 0.7, color: '#8d989c' });
    items.push({ id: 'diapason-a', kind: 'rod', from: [-1.6, mouth + 12, 0], to: [-1.6, mouth + 3, 0], radius: 0.55, color: '#b9c3c6', label: 'Diapasón' });
    items.push({ id: 'diapason-b', kind: 'rod', from: [1.6, mouth + 12, 0], to: [1.6, mouth + 3, 0], radius: 0.55, color: '#b9c3c6' });
  } else {
    items.push({ id: 'parlante', kind: 'rod', from: [0, mouth + 9, 0], to: [0, mouth + 3, 0], radius: R * 0.9, color: '#2a2f32', label: 'Parlante' });
  }
  const shapeText = type === 'cerrado'
    ? 'En el agua el aire no se puede mover: allí hay un nodo de desplazamiento (y un vientre de presión).'
    : 'Cerca de las dos bocas el aire se mueve libremente: allí hay vientres de desplazamiento (y la presión casi no cambia).';
  const soundText = amp <= 0.01
    ? `La fuente está en silencio: las capas de aire están quietas y la presión es la misma en todo el tubo. ${inp.source === 'diapason' ? 'Golpea el diapasón' : 'Enciende el generador'} para ver la onda estacionaria.`
    : `Sonando: la amplitud dibujada es el ${fmt(amp * 100, 0)} % de la máxima (refuerzo del tubo × intensidad de la fuente, como en el banco)${amp > 0.9 ? ', el tubo está reforzando mucho el sonido' : ''}. `
      + `Se ven ${nv.nodes.length} ${nv.nodes.length === 1 ? 'nodo' : 'nodos'} y ${nv.antinodes.length} ${nv.antinodes.length === 1 ? 'vientre' : 'vientres'} de desplazamiento en la columna. ${shapeText} `
      + 'Las rebanadas rojas son aire comprimido y las azules, aire enrarecido; con «Mover el aire» se alternan una vez por segundo (el aire real lo hace cientos de veces por segundo).';
  const description = `Tubo de resonancia en 3D, ${type === 'cerrado' ? `cerrado por el agua, con ${fmt(L, 1)} cm de columna de aire` : `abierto en los dos extremos, de ${fmt(L, 1)} cm`}; `
    + `diámetro interno ${fmt(inp.diameterCm, 1)} cm (dibujado más ancho), aire a ${fmt(inp.tempC, 1)} °C, ${inp.source === 'diapason' ? 'diapasón' : 'parlante con el generador'} de ${fmt(inp.f, 0)} Hz sobre la boca. ${soundText}`;
  return { items, extent: 56, target: [0, 55, 0], description, amp, layers };
}

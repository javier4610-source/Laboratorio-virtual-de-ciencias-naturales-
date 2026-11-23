/**
 * Frentes de onda de una fuente en movimiento, en 3D (kit src/three), con el MISMO modelo del laboratorio
 * (src/models/doppler.ts). Cada frente es una esfera transparente centrada donde estaba la fuente al emitirlo y con
 * radio c·(t − t_e): se apiñan delante y se separan detrás. Para que se vean, la escena usa un tiempo ADIMENSIONAL
 * (un frente por unidad de tiempo y el sonido avanza 1 unidad por unidad de tiempo, escaladas por K_LEN), así que
 * la separación entre frentes NO es la longitud de onda real, pero la razón entre la rapidez de la fuente y la del
 * sonido (v_s/c) sí es la del modelo, y con ella la proporción λ_delante/λ_detrás y el ángulo del cono de Mach.
 */
import { fmt } from '../lib/format';
import { wavefronts } from '../models/doppler';
import type { SceneItem, Vec3 } from '../three/scene';

export const K_LEN = 0.32; // unidades de la escena por unidad adimensional de recorrido del sonido (hasta Mach 1)
/** Escala de la escena: con fuentes supersónicas se aleja la cámara (todo se achica en la misma proporción). */
export const sceneScale = (M: number) => K_LEN / Math.max(1, Math.abs(M));
export const N_FRONTS = 9;
export const T_SCENE = 9; // duración del recorrido en tiempo adimensional

export interface DopplerSceneInput { M: number; t: number; observerX: number; showCone: boolean; label: string }

export function dopplerScene({ M, t, observerX, showCone, label }: DopplerSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; fronts: { center: number; radius: number }[] } {
  // La fuente sale de x0 para que el recorrido quede centrado.
  const x0 = -(M * T_SCENE) / 2;
  const fronts = wavefronts(M, 1, t, 1, N_FRONTS).map((f) => ({ center: x0 + f.center, radius: f.radius }));
  const xs = x0 + M * t;
  const k = sceneScale(M);
  const items: SceneItem[] = [
    { id: 'suelo', kind: 'plane', center: [0, -1.2, 0], size: [7, 3], color: 'surface-3', opacity: 0.6, label: 'calle (esquema)', tag: '' },
  ];
  fronts.forEach((f, i) => {
    if (f.radius <= 0) return;
    items.push({ id: `frente-${i}`, kind: 'sphere', center: [f.center * k, 0, 0], radius: f.radius * k, color: 'series-2', opacity: 0.07, label: i === 0 ? 'frentes de onda (un frente por unidad de tiempo, sin escala)' : undefined, tag: i === 0 ? '' : undefined });
  });
  items.push({ id: 'fuente', kind: 'sphere', center: [xs * k, 0, 0], radius: 0.12, color: 'data', label: 'fuente (sirena o avión)', tag: 'fuente' });
  if (Math.abs(M) > 1e-6) items.push({ id: 'velocidad', kind: 'arrow', from: [xs * k + Math.sign(M) * 0.14, 0, 0], vector: [Math.sign(M) * (0.25 + 0.5 * Math.min(1.5, Math.abs(M))), 0, 0], radius: 0.04, color: 'data', label: `velocidad de la fuente: ${fmt(Math.abs(M), 2)} veces la del sonido`, tag: 'v_s' });
  items.push({ id: 'observador', kind: 'sphere', center: [observerX, -0.9, 0.9], radius: 0.13, color: 'series-3', label: 'observador', tag: 'observador' });
  let angleDeg: number | null = null;
  if (showCone && M > 1 && t > 0) {
    // Tangentes al frente más antiguo desde la fuente: semiángulo θ con sen θ = 1/M.
    const th = Math.asin(1 / M);
    angleDeg = (th * 180) / Math.PI;
    // Longitud de la tangente hasta el frente más antiguo: d·cos θ, con d = M·(edad del frente).
    const age = fronts[fronts.length - 1].radius;
    const L = M * age * Math.cos(th) * k;
    for (const s of [1, -1]) {
      items.push({ id: `cono-${s > 0 ? 'arriba' : 'abajo'}`, kind: 'rod', from: [xs * k, 0, 0], to: [xs * k - L * Math.cos(th), s * L * Math.sin(th), 0], radius: 0.025, color: 'bad', label: s > 0 ? `cono de Mach: semiángulo ${fmt(angleDeg, 1)}°` : undefined, tag: s > 0 ? 'cono de Mach' : '' });
    }
  }
  // Separación entre frentes consecutivos en el sentido del movimiento (delante) y en el contrario (detrás).
  const right = fronts.length > 1 ? Math.abs((fronts[0].center + fronts[0].radius) - (fronts[1].center + fronts[1].radius)) : 0;
  const left = fronts.length > 1 ? Math.abs((fronts[0].center - fronts[0].radius) - (fronts[1].center - fronts[1].radius)) : 0;
  const [ahead, behind] = M >= 0 ? [right, left] : [left, right];
  const description = `${label}: la fuente avanza a ${fmt(Math.abs(M), 2)} veces la rapidez del sonido y ha emitido ${fronts.length} frentes. `
    + (Math.abs(M) >= 1
      ? `Va más rápido que sus propios frentes: delante no llega sonido${angleDeg !== null ? ` y los frentes forman un cono con semiángulo de ${fmt(angleDeg, 1)}°` : ''}.`
      : fronts.length > 1 ? `Delante de ella los frentes quedan separados ${fmt(ahead, 2)} unidades y detrás ${fmt(behind, 2)}: la razón ${fmt(ahead / behind, 3)} es (1 − v_s/c)/(1 + v_s/c).` : 'Pulsa «Emitir sonido» para ver los frentes.')
    + ' Las esferas son los frentes de onda en el aire; el tiempo y las distancias de la escena no están a escala.';
  return { items, extent: Math.abs(M) > 1 ? 2.2 : 3.2, target: [0, 0, 0], description, fronts };
}

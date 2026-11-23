/**
 * «poblacion» (lote 3D-7): superficie 3D del crecimiento neto en función del tamaño de la población N y de la tasa de
 * pesca h, con el rendimiento sostenible. Funciones PURAS con el MISMO modelo de la práctica (src/models/population.ts):
 *   - la altura de la malla es el crecimiento neto dN/dt del modelo elegido: logístico r·N·(1 − N/K) − h·N, o exponencial
 *     (r − h)·N, en individuos por año; verde donde la población crece, rojo donde decrece (corte con el plano: dN/dt = 0);
 *   - con el modelo logístico, la línea negra del plano es el equilibrio N*(h) = K·(1 − h/r) de `simulatePopulation`, y
 *     sobre ella cada poste mide la captura sostenible h·N* (individuos por año, la MISMA escala vertical: en el equilibrio
 *     lo que se pesca es igual a lo que la población repone); el poste más alto es el rendimiento máximo sostenible;
 *   - la trayectoria es la serie N(t) del banco (con la h elegida), dibujada sobre la malla, y la esfera es N final.
 * Escala FIJA por condición (no cambia con h ni con el tiempo): N de 0 a 1,3·K en 12 unidades, h de 0 a 1 por año en 8
 * unidades y la altura r·K/4 (el mayor crecimiento logístico sin pesca) en 3,5 unidades; lo que pasa de +5 o de −2,5 se recorta.
 * Dibujo: la malla es un muestreo (11 filas de h, 24 tramos de N).
 */
import { fmt } from '../../lib/format';
import { POPULATION_LIMITS, simulatePopulation, type PopulationInput, type PopulationResult } from '../../models/population';
import type { SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';

export const N_LEN = 12;
export const H_LEN = 8;
export const Y_LEN = 3.5;
export const Y_CAP = 5;
/** Recorte de la parte negativa (la población decrece): basta para ver el signo sin tapar la parte de arriba. */
export const Y_FLOOR = -2.5;
const H_MAX = POPULATION_LIMITS.h[1];
const ROWS = 11, SEGS = 24, COLS = 7;

/** Crecimiento neto del modelo (individuos/año) para un tamaño N y una tasa de pesca h. */
export function netGrowth(model: PopulationInput['model'], N: number, r: number, k: number, h: number): number {
  return model === 'exponencial' ? (r - h) * N : r * N * (1 - N / k) - h * N;
}

export interface PopSceneInput { model: PopulationInput['model']; n0: number; r: number; k: number; h: number; years: number; res: PopulationResult }

/** Captura sostenible h·N* del modelo para varias tasas de pesca (equilibrio de `simulatePopulation`). */
export function yieldCurve(inp: Omit<PopSceneInput, 'res' | 'h'>, hs: readonly number[]): { h: number; eq: number; catch: number }[] {
  return hs.map((h) => {
    const eq = simulatePopulation({ model: inp.model, n0: inp.n0, r: inp.r, k: inp.k, h, years: inp.years }).equilibrium;
    return { h, eq, catch: Number.isFinite(eq) ? h * eq : NaN };
  });
}

export function populationScene(inp: PopSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; scale: { nx: number; hz: number; gy: number }; best: { h: number; catch: number } | null } {
  const { model, r, k, h } = inp;
  const nx = N_LEN / (1.3 * k), hz = H_LEN / H_MAX, gy = Y_LEN / ((r * k) / 4);
  const clipY = (v: number) => Math.max(Y_FLOOR, Math.min(Y_CAP, v * gy));
  const P = (N: number, hh: number, y: number): Vec3 => [N * nx, y, hh * hz];
  const colorOf = (g: number): SceneColor => (g > 1e-9 ? 'ok' : g < -1e-9 ? 'bad' : 'ink-3');
  const items: SceneItem[] = [
    { id: 'plano', kind: 'plane', center: [N_LEN / 2, 0, H_LEN / 2], size: [N_LEN, H_LEN], color: 'surface-3', opacity: 0.55 },
    { id: 'eje-n', kind: 'arrow', from: [0, 0, H_LEN + 0.6], vector: [N_LEN + 0.6, 0, 0], radius: 0.05, color: 'ink-2', label: `Tamaño de la población N (0 a ${fmt(1.3 * k, 0)})`, tag: 'N' },
    { id: 'eje-h', kind: 'arrow', from: [-0.6, 0, 0], vector: [0, 0, H_LEN + 0.6], radius: 0.05, color: 'ink-2', label: 'Tasa de pesca h (0 a 1 por año)', tag: 'h' },
    { id: 'eje-y', kind: 'arrow', from: [-0.6, 0, 0], vector: [0, Y_LEN + 0.6, 0], radius: 0.05, color: 'ink-2', label: `Crecimiento neto dN/dt (r·K/4 = ${fmt((r * k) / 4, 0)} individuos por año arriba)`, tag: 'dN/dt' },
  ];
  // Malla: filas de h constante (tramos coloreados por el signo) y columnas de N constante.
  for (let i = 0; i < ROWS; i++) {
    const hh = (H_MAX * i) / (ROWS - 1);
    for (let s = 0; s < SEGS; s++) {
      const N0 = (1.3 * k * s) / SEGS, N1 = (1.3 * k * (s + 1)) / SEGS;
      const g0 = netGrowth(model, N0, r, k, hh), g1 = netGrowth(model, N1, r, k, hh);
      items.push({ id: `fila-${i}-${s}`, kind: 'rod', from: P(N0, hh, clipY(g0)), to: P(N1, hh, clipY(g1)), radius: 0.035, color: colorOf((g0 + g1) / 2), opacity: 0.8,
        ...(i === 0 && s === 0 ? { label: 'Malla: verde crece, rojo decrece', tag: '' } : {}) });
    }
  }
  for (let c = 1; c < COLS; c++) {
    const N = (1.3 * k * c) / COLS;
    for (let s = 0; s < ROWS - 1; s++) {
      const h0 = (H_MAX * s) / (ROWS - 1), h1 = (H_MAX * (s + 1)) / (ROWS - 1);
      const g0 = netGrowth(model, N, r, k, h0), g1 = netGrowth(model, N, r, k, h1);
      items.push({ id: `col-${c}-${s}`, kind: 'rod', from: P(N, h0, clipY(g0)), to: P(N, h1, clipY(g1)), radius: 0.025, color: colorOf((g0 + g1) / 2), opacity: 0.6 });
    }
  }
  // Equilibrio y captura sostenible (solo logístico).
  let best: { h: number; catch: number } | null = null;
  if (model === 'logistico') {
    const fine = yieldCurve(inp, Array.from({ length: 101 }, (_, i) => (H_MAX * i) / 100));
    const eqPts = fine.filter((p) => p.eq > 0).map((p) => P(p.eq, p.h, 0.02));
    for (let i = 1; i < eqPts.length; i++) items.push({ id: `eq-${i}`, kind: 'rod', from: eqPts[i - 1], to: eqPts[i], radius: 0.06, color: 'ink',
      ...(i === 1 ? { label: 'Equilibrio N* = K·(1 − h/r): dN/dt = 0', tag: 'N*' } : {}) });
    best = fine.reduce<{ h: number; catch: number } | null>((b, p) => (Number.isFinite(p.catch) && (!b || p.catch > b.catch) ? { h: p.h, catch: p.catch } : b), null);
    yieldCurve(inp, Array.from({ length: ROWS }, (_, i) => (H_MAX * i) / (ROWS - 1))).forEach((p, i) => {
      if (!(p.catch > 1e-9)) return;
      items.push({ id: `poste-${i}`, kind: 'rod', from: P(p.eq, p.h, 0), to: P(p.eq, p.h, clipY(p.catch)), radius: 0.07, color: 'data', opacity: 0.9,
        ...(i === 1 ? { label: 'Postes: captura sostenible h·N* (individuos por año)', tag: '' } : {}) });
    });
    if (best && best.catch > 0) {
      const eqB = k * (1 - best.h / r);
      items.push({ id: 'maximo', kind: 'sphere', center: P(eqB, best.h, clipY(best.catch)), radius: 0.2, color: 'data',
        label: `Rendimiento máximo sostenible: ${fmt(best.catch, 0)} por año con h = ${fmt(best.h, 2)}`, tag: 'Máximo' });
    }
    if (h > 0 && Number.isFinite(inp.res.equilibrium) && inp.res.equilibrium > 0) {
      items.push({ id: 'captura', kind: 'rod', from: P(inp.res.equilibrium, h, 0), to: P(inp.res.equilibrium, h, clipY(h * inp.res.equilibrium)), radius: 0.12, color: 'accent',
        label: `Tu pesca: h = ${fmt(h, 2)} → captura en equilibrio ${fmt(h * inp.res.equilibrium, 0)} por año`, tag: 'Tu pesca' });
    }
  }
  // Trayectoria del banco: N(t) con la h elegida, sobre la malla.
  const path = inp.res.series.filter((p) => p.n <= 1.3 * k).map((p) => P(p.n, h, clipY(netGrowth(model, p.n, r, k, h)) + 0.05));
  for (let i = 1; i < path.length; i++) {
    if (Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) < 0.02) continue;
    items.push({ id: `tray-${i}`, kind: 'rod', from: path[i - 1], to: path[i], radius: 0.07, color: 'series-2' });
  }
  const fN = inp.res.finalN;
  const fin: Vec3 = fN <= 1.3 * k ? P(fN, h, clipY(netGrowth(model, fN, r, k, h)) + 0.05) : P(1.3 * k, h, clipY(netGrowth(model, 1.3 * k, r, k, h)) + 0.05);
  items.push({ id: 'final', kind: 'sphere', center: fin, radius: 0.22, color: 'series-2', label: `Tu población: de N₀ = ${fmt(inp.n0, 0)} a ${fmt(fN, 0)} en ${inp.years} años${fN > 1.3 * k ? ' (fuera de la malla)' : ''}`, tag: `N = ${fmt(fN, 0)}` });

  const scaleTxt = `La malla va de N = 0 a ${fmt(1.3 * k, 0)} y de h = 0 a 1 por año; la altura es el crecimiento neto dN/dt del modelo ${model === 'logistico' ? 'logístico' : 'exponencial'} (verde, crece; rojo, decrece).`;
  let txt: string;
  if (model === 'logistico') {
    const eq = inp.res.equilibrium;
    const over = best && h > best.h + 1e-9;
    txt = ` La línea negra del plano es el equilibrio N* = K·(1 − h/r) y los postes, la captura sostenible h·N*: crece con h hasta un máximo de ${best ? `${fmt(best.catch, 0)} individuos por año con h = ${fmt(best.h, 2)}` : '0'} y luego baja hasta 0 cuando h llega a r = ${fmt(r, 2)}. `
      + (h <= 0 ? `Sin pesca, la población tiende a K = ${fmt(k, 0)}.` : eq > 0 ? `Con tu h = ${fmt(h, 2)} el equilibrio es ${fmt(eq, 0)} y la captura ${fmt(h * eq, 0)} por año${over ? ': hay sobreexplotación (pescando menos se capturaría más a largo plazo)' : ''}.` : `Con tu h = ${fmt(h, 2)} (h ≥ r) no hay equilibrio positivo: la población colapsa.`);
  } else {
    txt = ` En el modelo exponencial no hay capacidad de carga: si h < r la población crece sin límite y si h > r decrece; no hay rendimiento sostenible máximo.`;
  }
  const description = `Superficie en 3D. ${scaleTxt}${txt} Tu trayectoria va de N₀ = ${fmt(inp.n0, 0)} a ${fmt(fN, 0)} en ${inp.years} años sobre la fila de h = ${fmt(h, 2)}.`;
  return { items, extent: 8.6, target: [N_LEN / 2, 1.2, H_LEN / 2], narrow: { extent: 10.5, target: [N_LEN / 2, 1.2, H_LEN / 2] }, description, scale: { nx, hz, gy }, best };
}

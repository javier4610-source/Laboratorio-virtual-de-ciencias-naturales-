/**
 * «maquinas» (lote 3D-3): la palanca y las poleas en 3D. Funciones PURAS a partir del MISMO resultado del modelo
 * (src/models/simpleMachines.ts → simulateLever / simulatePulley) y del mismo avance de la medición que anima el banco:
 *   - Palanca: barra de 1,00 m que gira alrededor del fulcro hasta LEVER_TILT_DEG; la carga y el dinamómetro en los
 *     agujeros del modelo; brazos dR y dF marcados sobre la barra; fuerzas R (peso de la carga) y F (dinamómetro, con su
 *     sentido) con la misma escala.
 *   - Poleas: bloque fijo y bloque móvil con los n tramos de cuerda que sostienen la carga; al jalar s de cuerda la carga
 *     sube h = s/n (la del modelo). Flechas de distancia s y h en metros (1:1) y fuerzas F y R con la misma escala.
 * Escala de fuerzas FIJA por corrida: la mayor fuerza de la corrida (carga o esfuerzo) mide 0,40 m.
 */
import { fmt } from '../../lib/format';
import { BAR, LEVER_TILT_DEG, type LeverResult, type PulleyResult } from '../../models/simpleMachines';
import { add, arrowScale, rotateZ, type SceneItem, type Vec3 } from '../../three/scene';

export const FORCE_ARROW = 0.4;
const PIVOT_Y = 0.42;

/** Inclinación de la barra (rad) con el avance suavizado de la medición (0–1): la misma que dibuja el banco. */
export const leverAngle = (cls: 1 | 2 | 3, ease: number) => ((cls === 1 ? -1 : 1) * LEVER_TILT_DEG * Math.PI * Math.max(0, Math.min(1, ease))) / 180;

export interface LeverSceneInput {
  lever: LeverResult;
  ease: number;
  measured: boolean;
  dRcm: number;
  dFcm: number;
  massG: number;
  className: string;
}

export function leverScene(inp: LeverSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; k: number; alpha: number } {
  const L = inp.lever;
  const alpha = leverAngle(L.cls, inp.ease);
  const pivot: Vec3 = [0, PIVOT_Y, 0];
  const at = (xBar: number, up = 0): Vec3 => add(pivot, rotateZ([xBar - L.xFulcrum, up, 0], alpha));
  const k = arrowScale(Math.max(L.R, L.F, 1e-6), FORCE_ARROW);
  const x0 = -L.xFulcrum, x1 = BAR.length - L.xFulcrum;
  const loadPt = at(L.xLoad), effPt = at(L.xEffort);
  const box = 0.05 + 0.05 * Math.cbrt(inp.massG / 1000);
  const loadTop: Vec3 = [loadPt[0], loadPt[1] - 0.14, 0];

  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [(x0 + x1) / 2, 0, -0.1], size: [BAR.length + 0.5, 0.6], color: 'surface-3' },
    { id: 'soporte', kind: 'box', center: [0, (PIVOT_Y - 0.03) / 2, -0.06], size: [0.05, PIVOT_Y - 0.03, 0.05], color: 'ink-2' },
    { id: 'fulcro', kind: 'sphere', center: pivot, radius: 0.03, color: 'series-7', label: 'Fulcro' },
    { id: 'barra', kind: 'box', center: at(BAR.length / 2), size: [BAR.length, 0.025, 0.04], rotationZ: alpha, color: 'series-6' },
    // Brazos: del fulcro a la carga (dR) y del fulcro a la fuerza (dF), delante de la barra.
    { id: 'brazo-R', kind: 'rod', from: add(pivot, [0, 0, 0.035]), to: add(at(L.xLoad), [0, 0, 0.035]), radius: 0.008, color: 'series-1', label: `dR = ${fmt(inp.dRcm, 0)} cm` },
    { id: 'brazo-F', kind: 'rod', from: add(pivot, [0, 0, 0.06]), to: add(at(L.xEffort), [0, 0, 0.06]), radius: 0.008, color: 'series-2', label: `dF = ${fmt(inp.dFcm, 0)} cm` },
    // Carga colgada del agujero.
    { id: 'hilo-carga', kind: 'rod', from: loadPt, to: loadTop, radius: 0.003, color: 'ink' },
    { id: 'carga', kind: 'box', center: [loadTop[0], loadTop[1] - box / 2, 0], size: [box, box, box], color: 'series-8', edges: true },
  ];
  items.push({ id: 'R', kind: 'arrow', from: [loadTop[0], loadTop[1] - box, 0], vector: [0, -L.R * k, 0], radius: 0.01, color: 'series-1', label: 'R (carga)' });
  // Dinamómetro: la fuerza sale del agujero hacia arriba o hacia abajo (signo del modelo).
  const sgn = L.effortSigned >= 0 ? 1 : -1;
  items.push({ id: 'F', kind: 'arrow', from: effPt, vector: [0, sgn * L.F * k, 0], radius: 0.01, color: 'series-2', label: 'F' });
  if (L.barWeight > 0) items.push({ id: 'Pb', kind: 'arrow', from: at(BAR.length / 2), vector: [0, -L.barWeight * k, 0], radius: 0.007, color: 'ink-3', label: 'P barra' });

  const deg = (Math.abs(alpha) * 180) / Math.PI;
  let description = `Palanca de ${inp.className.toLowerCase()} en 3D: barra de 1,00 m con el fulcro ${L.xFulcrum > 0 ? 'en el centro' : 'en el extremo izquierdo'}, carga de ${fmt(inp.massG, 0)} g a dR = ${fmt(inp.dRcm, 0)} cm del fulcro y dinamómetro a dF = ${fmt(inp.dFcm, 0)} cm. La flecha R es el peso de la carga (${fmt(L.R, 2)} N, hacia abajo) y la flecha F, con la misma escala, es la fuerza del dinamómetro (${L.direction === 'arriba' ? 'hacia arriba' : 'hacia abajo'}); el brazo más largo necesita la fuerza más pequeña.`;
  if (deg > 0.05) description += ` La barra está girada ${fmt(deg, 1)}°: cada punto se mueve en proporción a su brazo.`;
  if (inp.measured) description += ` Según el modelo: F = ${fmt(L.F, 2)} N, R·dR = ${fmt(L.torqueLoad, 3)} N·m y F·dF = ${fmt(L.torqueEffort, 3)} N·m; al girar ${fmt(LEVER_TILT_DEG, 0)}°, la fuerza recorre ${fmt(L.sEffort * 100, 1)} cm y la carga ${fmt(L.sLoad * 100, 1)} cm.`;
  return { items, extent: 0.72, target: [(x0 + x1) / 2, PIVOT_Y - 0.05, 0], description, k, alpha };
}

export interface PulleySceneInput {
  pulley: PulleyResult;
  ease: number;
  measured: boolean;
  setupName: string;
  fixedSheaves: number;
  movableSheaves: number;
}

const CEIL = 1.35;
const FIXED_Y = 1.22;
const MOV_Y0 = 0.62;
const SHEAVE_R = 0.045;

export function pulleyScene(inp: PulleySceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; k: number; ropeNow: number; riseNow: number } {
  const P = inp.pulley;
  const e = Math.max(0, Math.min(1, inp.ease));
  const ropeNow = P.rope * e, riseNow = P.rise * e;
  const k = arrowScale(Math.max(P.R + P.blockWeight, P.F, 1e-6), FORCE_ARROW);
  const fija = P.setup === 'fija', movil = P.setup === 'movil';
  const n = P.n;
  const gapX = 0.06;
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gapX);
  const movY = MOV_Y0 + riseNow; // centro del bloque móvil (o el gancho de la carga en la polea fija)

  const items: SceneItem[] = [
    { id: 'piso', kind: 'plane', center: [0.1, 0, 0], size: [1.0, 0.6], color: 'surface-3' },
    { id: 'viga', kind: 'box', center: [0.05, CEIL, 0], size: [0.7, 0.04, 0.12], color: 'series-6' },
  ];
  const disc = (id: string, x: number, y: number, label?: string): SceneItem => ({ id, kind: 'ellipsoid', center: [x, y, 0], radii: [SHEAVE_R, SHEAVE_R, 0.016], color: 'series-8', ...(label ? { label } : {}) });

  let freeTop: Vec3, freeDir: 1 | -1;
  if (fija) {
    // Una polea fija: la carga cuelga del lado izquierdo y la mano jala hacia abajo por el derecho.
    items.push(disc('polea-fija', 0, FIXED_Y, 'Polea fija'), { id: 'eje', kind: 'rod', from: [0, FIXED_Y, 0], to: [0, CEIL, 0], radius: 0.006, color: 'ink-2' });
    items.push({ id: 'tramo-0', kind: 'rod', from: [-SHEAVE_R, FIXED_Y, 0], to: [-SHEAVE_R, movY, 0], radius: 0.004, color: 'amb' });
    freeTop = [SHEAVE_R, FIXED_Y, 0]; freeDir = -1;
  } else if (movil) {
    // Polea móvil: un tramo amarrado a la viga y el otro sube a la mano.
    items.push(disc('polea-movil', 0, movY, 'Polea móvil'));
    items.push({ id: 'tramo-0', kind: 'rod', from: [-SHEAVE_R, movY, 0], to: [-SHEAVE_R, CEIL, 0], radius: 0.004, color: 'amb' });
    freeTop = [SHEAVE_R, movY, 0]; freeDir = 1;
  } else {
    // Polipasto: n tramos entre el bloque fijo y el móvil; el extremo libre baja desde el bloque fijo.
    items.push({ id: 'bloque-fijo', kind: 'box', center: [0, FIXED_Y, 0], size: [Math.max(0.08, (n - 1) * gapX + 0.07), 0.05, 0.05], color: 'series-8', edges: true, label: `${inp.fixedSheaves} poleas fijas` });
    items.push({ id: 'bloque-movil', kind: 'box', center: [0, movY, 0], size: [Math.max(0.08, (n - 1) * gapX + 0.07), 0.05, 0.05], color: 'series-8', edges: true, label: `${inp.movableSheaves} móviles` });
    items.push({ id: 'eje', kind: 'rod', from: [0, FIXED_Y, 0], to: [0, CEIL, 0], radius: 0.006, color: 'ink-2' });
    xs.forEach((x, i) => items.push({ id: `tramo-${i}`, kind: 'rod', from: [x, FIXED_Y, 0], to: [x, movY, 0], radius: 0.004, color: 'amb' }));
    freeTop = [xs[n - 1] + gapX, FIXED_Y, 0]; freeDir = -1;
  }
  // Carga colgada.
  const hook: Vec3 = fija ? [-SHEAVE_R, movY, 0] : [0, movY - (movil ? SHEAVE_R : 0.025), 0];
  const box = 0.09;
  items.push({ id: 'gancho', kind: 'rod', from: hook, to: [hook[0], hook[1] - 0.06, 0], radius: 0.004, color: 'ink' });
  items.push({ id: 'carga', kind: 'box', center: [hook[0], hook[1] - 0.06 - box / 2, 0], size: [box, box, box], color: 'series-6', edges: true });
  const loadBottom: Vec3 = [hook[0], hook[1] - 0.06 - box, 0];
  items.push({ id: 'R', kind: 'arrow', from: loadBottom, vector: [0, -P.R * k, 0], radius: 0.009, color: 'series-1', label: 'R (carga)' });

  // Extremo libre: sale de la polea y llega a la mano; se mueve s = cuerda jalada.
  const handY0 = freeDir < 0 ? 0.78 : 1.05;
  const handY = handY0 + freeDir * ropeNow;
  const hand: Vec3 = [freeTop[0], handY, 0];
  items.push({ id: 'cuerda-libre', kind: 'rod', from: freeTop, to: hand, radius: 0.004, color: 'amb' });
  items.push({ id: 'mano', kind: 'sphere', center: hand, radius: 0.022, color: 'series-4' });
  items.push({ id: 'F', kind: 'arrow', from: [hand[0] + 0.02, hand[1], 0], vector: [0, freeDir * P.F * k, 0], radius: 0.009, color: 'series-2', label: 'F' });

  // Distancias: cuerda jalada s (junto al extremo libre) y subida h de la carga (junto a la carga), 1:1 en metros.
  if (ropeNow > 0.003) {
    items.push({ id: 's', kind: 'arrow', from: [hand[0] + 0.1, handY0, 0.05], vector: [0, freeDir * ropeNow, 0], radius: 0.006, color: 'series-5', label: 's (cuerda)' });
    items.push({ id: 'h', kind: 'arrow', from: [hook[0] - 0.12, MOV_Y0 - 0.15, 0.05], vector: [0, riseNow, 0], radius: 0.006, color: 'series-4', label: 'h (carga)' });
  }

  let description = `${inp.setupName} en 3D: ${n} ${n === 1 ? 'tramo de cuerda sostiene' : 'tramos de cuerda sostienen'} la carga de ${fmt(P.R, 2)} N. Flechas con la misma escala: R, el peso de la carga, hacia abajo, y F, la fuerza en el extremo libre, ${freeDir < 0 ? 'hacia abajo' : 'hacia arriba'}.`;
  if (ropeNow > 0.003) description += ` Se han jalado s = ${fmt(ropeNow * 100, 1)} cm de cuerda y la carga subió h = ${fmt(riseNow * 100, 1)} cm: la cuerda recorre ${n} veces lo que sube la carga.`;
  else description += ' Al medir, la mano jala la cuerda y la carga sube.';
  if (inp.measured) description += ` Según el modelo: F = ${fmt(P.F, 2)} N; ventaja mecánica ideal ${n} y real ${fmt(P.vm, 2)}.`;
  return { items, extent: 0.85, target: [0.05, 0.75, 0], description, k, ropeNow, riseNow };
}

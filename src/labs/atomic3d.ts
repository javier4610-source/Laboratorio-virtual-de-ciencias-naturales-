/**
 * Escenas 3D de la práctica de modelos atómicos (kit src/three). Funciones PURAS que leen el MISMO estado del
 * laboratorio: la lámina, la energía, el ángulo del detector, la corrida de conteo y la transición de Bohr elegidas.
 *  - «experimento»: montaje de Geiger y Marsden; las alfas salen de la lámina en 3D (θ y azimut φ) con las
 *    desviaciones muestreadas del modelo (pocas grandes, ∝ 1/sen⁴(θ/2), y el resto casi rectas).
 *  - «nucleo»: trayectorias hiperbólicas exactas alrededor de un núcleo para varios parámetros de impacto (en unidades
 *    de la distancia de máximo acercamiento d), cada una en su propio plano: la dispersión tiene simetría de giro.
 *  - «modelos»: los cuatro modelos lado a lado (ilustración, sin escala) y la transición de Bohr con su fotón.
 */
import { fmt } from '../lib/format';
import type { SceneItem, Vec3 } from '../three/scene';
import {
  rutherfordAngle, rutherfordTrajectory, sampleDeflections, transition, wavelengthColor, type RutherfordSetup,
} from '../models/atomicModels';

export type AtomView = 'experimento' | 'nucleo' | 'modelos';
export interface AtomScene { items: SceneItem[]; extent: number; target: Vec3; description: string; status: 'modelo' | 'ilustracion'; note: string }

export const FOIL_COLOR: Record<string, `#${string}`> = { oro: '#d4a017', plata: '#b8bcc4', cobre: '#b87333', aluminio: '#c4c9ce' };
const rad = (d: number) => (d * Math.PI) / 180;

export interface ExperimentSceneInput {
  setup: RutherfordSetup;
  thetaDeg: number;
  /** 0–1: avance de la corrida de conteo (cuántas trayectorias de la muestra se dibujan). */
  progress: number;
  counts: number;
  seed: number;
}

/** Número de trayectorias de la muestra dibujada y factor de realce de las desviaciones grandes (declarado en la nota). */
export const SAMPLE_PATHS = 48;
export const LARGE_BOOST = 4000;

export function experimentScene(p: ExperimentSceneInput): AtomScene {
  const R = 2.4; // radio del riel del detector
  const th = rad(p.thetaDeg);
  const det: Vec3 = [R * Math.cos(th), 0, R * Math.sin(th)];
  const foil = p.setup.foil;
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0, -0.9, 0], size: [7.4, 5.6], color: 'surface-3' },
    { id: 'fuente', kind: 'box', center: [-3.1, 0, 0], size: [0.8, 0.7, 0.7], color: 'series-8', label: 'Fuente de alfas (blindaje de plomo)' },
    { id: 'colimador', kind: 'box', center: [-2.35, 0, 0], size: [0.5, 0.36, 0.36], color: 'ink-3' },
    { id: 'haz', kind: 'rod', from: [-2.1, 0, 0], to: [-0.02, 0, 0], radius: 0.045, color: 'series-2', opacity: 0.7, label: 'Haz de partículas alfa' },
    { id: 'lamina', kind: 'box', center: [0, 0, 0], size: [0.03, 1.5, 1.5], color: FOIL_COLOR[foil.id] ?? 'series-6', label: `Lámina de ${foil.name.toLowerCase()}` },
    { id: 'riel', kind: 'particles', radius: 0.025, color: 'ink-3', points: Array.from({ length: 72 }, (_, i) => { const a = (2 * Math.PI * i) / 72; return [R * Math.cos(a), -0.45, R * Math.sin(a)] as Vec3; }) },
    { id: 'visual', kind: 'rod', from: [0, 0, 0], to: det, radius: 0.012, color: 'ink-3', opacity: 0.6 },
    { id: 'detector', kind: 'box', center: det, size: [0.34, 0.5, 0.34], color: 'data', label: `Detector a θ = ${fmt(p.thetaDeg, 1)}° · ${p.counts} centelleos` },
  ];
  const shown = Math.round(Math.max(0, Math.min(1, p.progress)) * SAMPLE_PATHS);
  const sample = sampleDeflections(p.setup, SAMPLE_PATHS, p.seed, 10, LARGE_BOOST).slice(0, shown);
  let large = 0, back = 0;
  sample.forEach((s, i) => {
    const L = 2.1;
    const dir: Vec3 = [Math.cos(s.theta), Math.sin(s.theta) * Math.cos(s.phi), Math.sin(s.theta) * Math.sin(s.phi)];
    if (s.large) { large++; if (s.theta > Math.PI / 2) back++; }
    items.push({ id: `alfa-${i}`, kind: 'rod', from: [0, 0, 0], to: [L * dir[0], L * dir[1], L * dir[2]], radius: s.large ? 0.022 : 0.012, color: s.large ? 'series-1' : 'series-2', opacity: s.large ? 1 : 0.55 });
  });
  const description = `Montaje de Geiger y Marsden en 3D: la fuente lanza un haz de partículas alfa contra una lámina de ${foil.name.toLowerCase()} (Z = ${foil.Z}); el detector está a ${fmt(p.thetaDeg, 1)}° del haz y lleva ${p.counts} centelleos contados. ` +
    (shown ? `Se dibujan ${shown} alfas a la salida de la lámina: ${shown - large} siguen casi rectas y ${large} se desvían más de 10° (${back} hacia atrás), en todas las direcciones alrededor del haz.` : 'Aún no se ha disparado el haz.');
  return {
    items, extent: 3.6, target: [-0.3, -0.2, 0], description, status: 'modelo',
    note: `Direcciones de salida muestreadas del modelo (θ con la ley 1/sen⁴(θ/2), azimut al azar). Para que se vean en ${SAMPLE_PATHS} trayectorias, las desviaciones grandes se dibujan ${LARGE_BOOST.toLocaleString('es-CO')} veces más frecuentes que en la realidad; el conteo del detector sí es el del modelo. Montaje sin escala.`,
  };
}

/** Parámetros de impacto (en unidades de d) de las trayectorias alrededor del núcleo. */
export const IMPACTS = [0.12, 0.3, 0.6, 1.2, 2.5];

export function nucleusScene(setup: RutherfordSetup): AtomScene {
  const items: SceneItem[] = [
    { id: 'nucleo', kind: 'sphere', center: [0, 0, 0], radius: 0.16, color: 'series-1', label: `Núcleo de ${setup.foil.sym} (+${setup.foil.Z})` },
  ];
  const tokens = ['series-2', 'series-3', 'series-4', 'series-5', 'series-7'] as const;
  IMPACTS.forEach((b, k) => {
    const phi = (2 * Math.PI * k) / IMPACTS.length;
    const pts = rutherfordTrajectory(b, 1, 6.5, 90);
    const P = pts.map(({ x, y }) => [x, y * Math.cos(phi), y * Math.sin(phi)] as Vec3);
    for (let i = 0; i + 1 < P.length; i++) items.push({ id: `tray-${k}-${i}`, kind: 'rod', from: P[i], to: P[i + 1], radius: 0.035, color: tokens[k] });
    const th = (rutherfordAngle(b, 1) * 180) / Math.PI;
    const end = P[P.length - 1];
    items.push({ id: `fin-${k}`, kind: 'sphere', center: end, radius: 0.09, color: tokens[k], label: `b = ${fmt(b, 2)}·d → θ = ${fmt(th, 0)}°` });
  });
  const d = setup.d_fm;
  return {
    items, extent: 5.2, target: [0.4, 0, 0], status: 'modelo',
    description: `Acercamiento a un núcleo de ${setup.foil.name.toLowerCase()}: cinco alfas llegan desde la izquierda con parámetros de impacto de 0,12 a 2,5 veces d (d = ${fmt(d, 1)} fm) y siguen hipérbolas, cada una en su propio plano alrededor del haz. Cuanto más cerca pasan del núcleo, más se desvían: con b = 0,12·d rebotan a ${fmt((rutherfordAngle(0.12, 1) * 180) / Math.PI, 0)}°; con b = 2,5·d apenas ${fmt((rutherfordAngle(2.5, 1) * 180) / Math.PI, 0)}°.`,
    note: `Trayectorias exactas de la ley de Coulomb (tan(θ/2) = d/2b), en unidades de d = ${fmt(d, 1)} fm. El núcleo se dibuja más grande para que se vea.`,
  };
}

export interface ModelsSceneInput { nUpper: number; nLower: number; emitted: boolean }

export function modelsScene(p: ModelsSceneInput): AtomScene {
  const xs = [-4.8, -1.6, 1.6, 4.8];
  const items: SceneItem[] = [
    { id: 'dalton', kind: 'sphere', center: [xs[0], 0, 0], radius: 1, color: 'series-8', label: 'Dalton: esfera maciza' },
    { id: 'thomson', kind: 'sphere', center: [xs[1], 0, 0], radius: 1, color: 'series-1', opacity: 0.32, label: 'Thomson: carga + repartida' },
    { id: 'thomson-e', kind: 'particles', radius: 0.11, color: 'series-2', points: [[0.4, 0.3, 0.2], [-0.4, 0.2, -0.3], [0.1, -0.5, 0.3], [-0.2, -0.2, 0.55], [0.3, 0.55, -0.25], [-0.55, -0.35, -0.1]].map(([x, y, z]) => [xs[1] + x, y, z] as Vec3) },
    { id: 'rutherford-borde', kind: 'sphere', center: [xs[2], 0, 0], radius: 1, color: 'ink-3', opacity: 0.1 },
    { id: 'rutherford-n', kind: 'sphere', center: [xs[2], 0, 0], radius: 0.08, color: 'series-1', label: 'Rutherford: núcleo diminuto' },
    { id: 'rutherford-e', kind: 'particles', radius: 0.09, color: 'series-2', points: [[0.9, 0.2, 0.3], [-0.7, 0.6, -0.2], [0.1, -0.95, 0.2], [-0.3, 0.1, 0.92], [0.4, 0.5, -0.75], [-0.6, -0.5, -0.5]].map(([x, y, z]) => [xs[2] + x, y, z] as Vec3) },
    { id: 'bohr-n', kind: 'sphere', center: [xs[3], 0, 0], radius: 0.08, color: 'series-1', label: 'Bohr: órbitas con energía fija' },
  ];
  const rOf = (n: number) => (1.2 * n * n) / 16; // radios ∝ n² (rₙ = n²·a₀), n = 4 mide 1,2
  for (let n = 1; n <= 4; n++) {
    items.push({ id: `orbita-${n}`, kind: 'particles', radius: 0.022, color: n === p.nUpper || n === p.nLower ? 'ink-2' : 'ink-3',
      points: Array.from({ length: 24 + 12 * n }, (_, i) => { const a = (2 * Math.PI * i) / (24 + 12 * n); return [xs[3] + rOf(n) * Math.cos(a), 0, rOf(n) * Math.sin(a)] as Vec3; }) });
  }
  const shown = Math.min(4, p.emitted ? p.nLower : p.nUpper);
  const eAt: Vec3 = [xs[3] + rOf(Math.max(1, shown)) * Math.cos(0.6), 0, rOf(Math.max(1, shown)) * Math.sin(0.6)];
  const t = transition(p.nUpper, p.nLower);
  const upTxt = p.nUpper > 4 ? ` (el nivel ${p.nUpper} queda fuera del dibujo)` : '';
  items.push({ id: 'bohr-e', kind: 'sphere', center: eAt, radius: 0.1, color: 'series-2', label: `electrón en n = ${p.emitted ? p.nLower : p.nUpper}` });
  if (p.emitted) {
    const color = t.region === 'visible' ? wavelengthColor(t.lambdaAirNm) as `#${string}` : 'ink-2';
    items.push({ id: 'foton', kind: 'arrow', from: eAt, vector: [0.9, 1.1, 0.4], radius: 0.05, color, label: `fotón de ${fmt(t.lambdaAirNm, 1)} nm (${t.colorName})` });
  }
  return {
    items, extent: 6.6, target: [0, 0, 0], status: 'ilustracion',
    description: `Los cuatro modelos lado a lado: Dalton, una esfera maciza; Thomson, una esfera de carga positiva con electrones incrustados; Rutherford, un núcleo diminuto con los electrones lejos y mucho espacio vacío; Bohr, órbitas circulares de radios proporcionales a n². ` +
      (p.emitted ? `El electrón bajó del nivel ${p.nUpper} al ${p.nLower}${upTxt} y emitió un fotón de ${fmt(t.lambdaAirNm, 1)} nm (${t.colorName}, ${fmt(t.energyEV, 2)} eV).` : `El electrón está en el nivel ${p.nUpper}${upTxt}, listo para bajar al ${p.nLower}.`),
    note: 'Ilustración sin escala (el núcleo real es unas 10 000 veces más pequeño que el átomo); en Bohr los radios de las órbitas sí guardan la proporción n² y el color del fotón sale de su longitud de onda.',
  };
}

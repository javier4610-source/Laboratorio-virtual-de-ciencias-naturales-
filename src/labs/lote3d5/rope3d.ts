/**
 * «ondas» (lote 3D-5): la cuerda del banco en 3D. Funciones PURAS con el MISMO modelo del laboratorio
 * (src/models/waves.ts → ropeWave y displacement) y el mismo instante t del generador (su SimControls):
 *   - eje x = posición a lo largo de la cuerda, en metros reales (los 12 m de la regla del banco);
 *   - eje y = desplazamiento transversal y(x, t) del modelo, AMPLIADO: 1 cm de desplazamiento = 0,2 m de dibujo (×20);
 *   - la regla está sobre la mesa, debajo de la cuerda, con los marcadores A y B del banco;
 *   - la flecha v (propagación, a lo largo de la cuerda) mide ∝ la rapidez del modelo (40 m/s = 3 m de dibujo); la flecha
 *     del punto marcado a 3 m es vertical: el punto sube y baja (transversal), no avanza.
 * La longitud de onda queda oculta en la descripción hasta que el estudiante escribe su medida (igual que el banco).
 */
import { fmt } from '../../lib/format';
import { displacement } from '../../models/waves';
import type { SceneItem, Vec3 } from '../../three/scene';
import { polyRods } from './common';

export const ROPE_VIEW_M = 12;
/** Metros de dibujo por centímetro de desplazamiento (ampliación ×20). */
export const Y_PER_CM = 0.2;
/** Metros de dibujo por m/s de la flecha de propagación. */
export const V_ARROW = 3 / 40;
export const MARK_X = 3;
const SEGMENTS = 96;
const TABLE_Y = -2.3;

export interface RopeSceneInput {
  ropeId: string;
  ropeName: string;
  tension: number;
  frequency: number;
  amplitude: number; // cm
  wavelength: number; // m (modelo)
  speed: number; // m/s (modelo)
  t: number; // s (reloj del generador del banco)
  markA: number;
  markB: number;
  /** El estudiante ya escribió su medida: la descripción puede decir λ del modelo. */
  revealed: boolean;
}

const ROPE_COLOR: Record<string, `#${string}`> = { liviana: '#e9edef', media: '#c9a468', pesada: '#8d989c' };
const ROPE_R: Record<string, number> = { liviana: 0.035, media: 0.05, pesada: 0.07 };

/** Puntos de la cuerda (x en m, y en m de dibujo) en el instante t. */
export function ropePoints(A: number, lambda: number, f: number, t: number, n = SEGMENTS): Vec3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = (ROPE_VIEW_M * i) / n;
    return [x, displacement(x, t, A, lambda, f) * Y_PER_CM, 0] as Vec3;
  });
}

/** Posiciones de las crestas visibles (y = +A) en [0, 12] m: x = λ·(n + ¼ + f·t). */
export function crestPositions(lambda: number, f: number, t: number): number[] {
  const out: number[] = [];
  const n0 = Math.ceil(-0.25 - f * t - 1e-9);
  for (let n = n0; ; n++) {
    const x = lambda * (n + 0.25 + f * t);
    if (x > ROPE_VIEW_M + 1e-9) break;
    if (x >= -1e-9) out.push(x);
  }
  return out;
}

export function ropeScene(inp: RopeSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; points: Vec3[]; markY: number } {
  const { amplitude: A, wavelength: lam, frequency: f, t } = inp;
  const points = ropePoints(A, lam, f, t);
  const yAt = (x: number) => displacement(x, t, A, lam, f) * Y_PER_CM;
  const markY = yAt(MARK_X);
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [6, TABLE_Y - 0.02, 0.6], size: [14.5, 3.2], color: 'surface-3' },
    { id: 'generador', kind: 'box', center: [-0.45, -0.1, 0], size: [0.6, 4.4, 0.8], color: '#2f393c', label: 'Generador' },
    { id: 'polea', kind: 'rod', from: [ROPE_VIEW_M + 0.35, 0, -0.12], to: [ROPE_VIEW_M + 0.35, 0, 0.12], radius: 0.28, color: 'line-strong' },
    { id: 'pesas', kind: 'rod', from: [ROPE_VIEW_M + 0.63, -0.3, 0], to: [ROPE_VIEW_M + 0.63, -0.3 - Math.min(1.6, 0.2 + inp.tension / 50), 0], radius: 0.16, color: 'ink-3' },
    { id: 'equilibrio', kind: 'rod', from: [0, 0, 0], to: [ROPE_VIEW_M, 0, 0], radius: 0.008, color: 'line-strong', opacity: 0.7 },
    ...polyRods('cuerda', points, ROPE_R[inp.ropeId] ?? 0.05, ROPE_COLOR[inp.ropeId] ?? '#c9a468'),
    // Tramo final hacia la polea.
    { id: 'cuerda-polea', kind: 'rod', from: points[points.length - 1], to: [ROPE_VIEW_M + 0.35, 0.28, 0], radius: ROPE_R[inp.ropeId] ?? 0.05, color: ROPE_COLOR[inp.ropeId] ?? '#c9a468' },
    { id: 'punto', kind: 'sphere', center: [MARK_X, markY, 0], radius: 0.13, color: 'fis', label: 'Punto a 3 m' },
    // Recorrido del punto marcado: ±A (sube y baja en su sitio).
    { id: 'recorrido', kind: 'rod', from: [MARK_X, -A * Y_PER_CM, -0.02], to: [MARK_X, A * Y_PER_CM, -0.02], radius: 0.018, color: 'fis', opacity: 0.45 },
    { id: 'v', kind: 'arrow', from: [0.4, 2.5, 0], vector: [inp.speed * V_ARROW, 0, 0], radius: 0.05, color: 'data', label: 'v (propagación)' },
    // Regla de 12 m sobre la mesa, con una marca por metro.
    { id: 'regla', kind: 'box', center: [6, TABLE_Y + 0.04, 1.1], size: [12.3, 0.08, 0.5], color: '#d9b77e', label: 'Regla (m)' },
  ];
  for (let m = 0; m <= ROPE_VIEW_M; m++) {
    items.push({ id: `marca-${m}`, kind: 'rod', from: [m, TABLE_Y + 0.09, 0.86], to: [m, TABLE_Y + 0.09, m % 6 === 0 ? 1.3 : 1.1], radius: 0.012, color: '#4d3b1c' });
  }
  for (const [name, x] of [['A', inp.markA], ['B', inp.markB]] as const) {
    items.push({ id: `marcador-${name}`, kind: 'rod', from: [x, TABLE_Y + 0.1, 1.1], to: [x, 2.1, 0], radius: 0.02, color: 'accent', opacity: 0.85 });
    items.push({ id: `pestana-${name}`, kind: 'sphere', center: [x, TABLE_Y + 0.12, 1.1], radius: 0.1, color: 'accent', label: `Marcador ${name}` });
  }
  const crests = crestPositions(lam, f, t);
  const dist = Math.abs(inp.markB - inp.markA);
  const lambdaText = inp.revealed
    ? `La longitud de onda del modelo es ${fmt(lam, 2)} m.`
    : 'La longitud de onda queda oculta hasta que escribas tu medida: pon A y B sobre dos crestas consecutivas.';
  const description = `Cuerda de ${fmt(ROPE_VIEW_M, 0)} m en 3D (${inp.ropeName.toLowerCase()}, ${fmt(inp.tension, 0)} N) movida por el generador a ${fmt(f, 2)} Hz con amplitud ${fmt(A, 1)} cm, en t = ${fmt(t, 2)} s. `
    + `El desplazamiento se dibuja 20 veces mayor para que se vea. La onda avanza a lo largo de la cuerda (flecha v, ${fmt(inp.speed, 2)} m/s) mientras cada punto sube y baja en dirección perpendicular: el punto azul a 3 m está ahora ${markY > 0.005 ? 'por encima' : markY < -0.005 ? 'por debajo' : 'a la altura'} de la posición de equilibrio (${fmt(markY / Y_PER_CM, 1)} cm) y no avanza. `
    + `Se ven ${crests.length} crestas sobre la regla. Marcadores A en ${fmt(inp.markA, 2)} m y B en ${fmt(inp.markB, 2)} m: distancia ${fmt(dist, 2)} m. ${lambdaText}`;
  return { items, extent: 6.1, target: [6, -0.1, 0.3], description, points, markY };
}

/**
 * Tubo de Venturi en 3D (kit src/three). Funciones PURAS con el MISMO modelo del laboratorio (continuidad y Bernoulli,
 * src/models/bernoulli.ts): un tubo transparente cuyo radio sigue el diámetro elegido (entrada, cono convergente,
 * garganta, cono divergente y salida), partículas trazadoras en tres líneas de corriente colocadas a INTERVALOS
 * IGUALES DE TIEMPO (su separación es proporcional a la rapidez local, v = Q/A), flechas de velocidad en la entrada y
 * en la garganta (longitud proporcional a v) y tres piezómetros cuya columna de agua mide la altura de presión del
 * modelo (entrada h₁, garganta h₂ = h₁ − Δh y salida, que en el fluido ideal vuelve a h₁).
 * Escala: 25 mm de diámetro = 0,9 unidades; 10 cm de columna = 0,25 unidades; 1 m/s = 0,6 unidades.
 */
import { fmt } from '../lib/format';
import { venturi, type VenturiResult } from '../models/bernoulli';
import { arrowScale, type SceneItem, type Vec3 } from '../three/scene';

export const K_RADIUS = 0.45 / 12.5; // unidades por mm de radio
export const K_HEAD = 2.5; // unidades por metro de columna
export const K_VEL = arrowScale(1, 0.6);
const X0 = -2.5, X1 = 2.5;
/** Perfil del tubo: x de los tramos (entrada, convergente, garganta, divergente, salida). */
export const PROFILE = { inEnd: -1.2, throatStart: -0.5, throatEnd: 0.5, outStart: 1.7 };
export const PIEZO_X = { entrada: -1.85, garganta: 0, salida: 2.1 };

/** Diámetro (mm) del tubo en la posición x de la escena. */
export function diameterAt(x: number, d1: number, d2: number): number {
  const { inEnd, throatStart, throatEnd, outStart } = PROFILE;
  if (x <= inEnd || x >= outStart) return d1;
  if (x >= throatStart && x <= throatEnd) return d2;
  const u = x < throatStart ? (x - inEnd) / (throatStart - inEnd) : (outStart - x) / (outStart - throatEnd);
  return d1 + (d2 - d1) * u;
}

/** Posiciones x de trazadores separados por el mismo tiempo: dx/dτ ∝ v(x) = Q/A(x); en la entrada quedan a `gap`. */
export function tracerXs(d1: number, d2: number, gap = 0.25, phase = 0): number[] {
  const out: number[] = [];
  const v = (x: number) => (d1 / diameterAt(x, d1, d2)) ** 2; // rapidez relativa a la de la entrada
  let x = X0 + gap * phase;
  const h = 0.002;
  let tau = 0;
  let next = 0;
  while (x <= X1) {
    if (tau >= next - 1e-12) { out.push(x); next += gap; }
    // RK2 del recorrido en «tiempo» τ (unidades de longitud de la entrada).
    const k1 = v(x), k2 = v(x + (h / 2) * k1);
    x += h * k2;
    tau += h;
  }
  return out;
}

export function venturiScene(qLs: number, d1: number, d2: number): { items: SceneItem[]; extent: number; target: Vec3; description: string; result: VenturiResult } {
  const r = venturi(qLs, d1, d2);
  const items: SceneItem[] = [];
  // Tubo: 40 tramos cilíndricos translúcidos.
  const N = 40;
  for (let k = 0; k < N; k++) {
    const xa = X0 + ((X1 - X0) * k) / N, xb = X0 + ((X1 - X0) * (k + 1)) / N;
    const d = diameterAt((xa + xb) / 2, d1, d2);
    items.push({ id: `tubo-${k}`, kind: 'rod', from: [xa, 0, 0], to: [xb, 0, 0], radius: (d / 2) * K_RADIUS, color: 'info', opacity: 0.16 });
  }
  items[0] = { ...items[0], label: 'tubo de Venturi (agua)', tag: '' };
  // Trazadores en tres líneas de corriente (fracción del radio local).
  const xs = tracerXs(d1, d2);
  const lines: [number, number][] = [[0, 0], [0.55, 0], [-0.3, 0.45]];
  lines.forEach(([fy, fz], i) => {
    const pts: Vec3[] = xs.map((x) => { const R = (diameterAt(x, d1, d2) / 2) * K_RADIUS; return [x, fy * R, fz * R]; });
    items.push({ id: `trazadores-${i}`, kind: 'particles', points: pts, radius: 0.045, color: 'series-1', ...(i === 0 ? { label: 'trazadores cada mismo intervalo de tiempo', tag: '' } : {}) });
  });
  // Flechas de velocidad.
  const R1 = (d1 / 2) * K_RADIUS, R2 = (d2 / 2) * K_RADIUS;
  items.push({ id: 'v-entrada', kind: 'arrow', from: [-2.4, -R1 - 0.25, 0], vector: [r.v1 * K_VEL, 0, 0], radius: 0.035, color: 'data', label: `v₁ = ${fmt(r.v1, 2)} m/s`, tag: 'v₁' });
  items.push({ id: 'v-garganta', kind: 'arrow', from: [-0.5, -R1 - 0.25, 0], vector: [Math.min(2.9, r.v2 * K_VEL), 0, 0], radius: 0.035, color: 'data', label: `v₂ = ${fmt(r.v2, 2)} m/s`, tag: 'v₂' });
  // Piezómetros: tubo de vidrio y columna de agua.
  const piezo = (id: string, x: number, h: number, name: string, tag: string, Rtube: number) => {
    const top = Rtube + 1.9;
    items.push({ id: `vidrio-${id}`, kind: 'rod', from: [x, Rtube, 0], to: [x, top, 0], radius: 0.07, color: 'line-strong', opacity: 0.3 });
    const hh = Math.max(0, h) * K_HEAD;
    if (hh > 0.005) items.push({ id: `columna-${id}`, kind: 'rod', from: [x, Rtube, 0], to: [x, Rtube + hh, 0], radius: 0.055, color: 'series-2', opacity: 0.9, label: `${name}: ${fmt(Math.max(0, h) * 100, 1)} cm`, tag });
  };
  piezo('entrada', PIEZO_X.entrada, r.h1, 'columna en la entrada', 'h₁', R1);
  piezo('garganta', PIEZO_X.garganta, r.h2, 'columna en la garganta', 'h₂', R2);
  piezo('salida', PIEZO_X.salida, r.h3, 'columna en la salida (ideal = entrada)', 'h₃', R1);
  const description = `Tubo de Venturi de ${fmt(d1, 1)} mm con garganta de ${fmt(d2, 1)} mm y ${fmt(qLs, 2)} L/s de agua. `
    + `En la entrada el agua va a ${fmt(r.v1, 2)} m/s y en la garganta a ${fmt(r.v2, 2)} m/s: los trazadores, marcados cada mismo intervalo de tiempo, se separan ${fmt((d1 / d2) ** 2, 2)} veces más en la garganta. `
    + `La columna del piezómetro baja de ${fmt(r.h1 * 100, 1)} cm en la entrada a ${fmt(r.h2 * 100, 1)} cm en la garganta (Δh = ${fmt(r.dh * 100, 1)} cm, Δp = ${fmt(r.dp, 0)} Pa) y en el fluido ideal vuelve a ${fmt(r.h3 * 100, 1)} cm a la salida.`;
  return { items, extent: 2.7, target: [0, 0.8, 0], description, result: r };
}

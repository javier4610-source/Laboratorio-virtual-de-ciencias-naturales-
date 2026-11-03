/**
 * «gases» (lote 3D-4): la jeringa del banco en 3D como caja de partículas con émbolo. Funciones PURAS con el MISMO
 * resultado del modelo (src/models/gases.ts → simulateGas) y el mismo reloj de la animación del laboratorio (cuadros
 * de «Animar las partículas»):
 *   - el largo del gas es el volumen del modelo (200 mL = 6 unidades) y el émbolo está en ese punto;
 *   - 40 partículas (dibujo; la cantidad de gas no cambia) rebotan dentro con una rapidez ∝ √T (la energía cinética media
 *     es proporcional a la temperatura absoluta); a 25 °C miden 1,6 unidades por segundo;
 *   - la flecha sobre el émbolo es la fuerza del gas, proporcional a la presión del modelo (300 kPa = 1,6 unidades).
 * Con partículas que rebotan, los choques por segundo contra el émbolo son ∝ v/L y cada choque empuja ∝ v, así que la
 * presión que «da el dibujo» es ∝ (T/T₀)·(V₀/V): la misma razón que la ecuación del gas ideal del modelo.
 */
import { fmt } from '../../lib/format';
import { INITIAL, type GasLaw } from '../../models/gases';
import type { SceneItem, Vec3 } from '../../three/scene';
import { boxParticles, seeds } from './elec3d';

export const SYRINGE_CAP = 200; // mL (la del banco)
export const SYRINGE_LEN = 6; // unidades para 200 mL
export const SPEED_25C = 1.6;
export const P_ARROW = 1.6 / 300; // unidades por kPa
const T0 = INITIAL.temperature + 273.15;
const HALF = 0.55;
const PARTS = seeds(40, 3);

/** Largo del gas en la escena para un volumen (mL). */
export const gasLength = (volumeMl: number) => (SYRINGE_LEN * volumeMl) / SYRINGE_CAP;
/** Rapidez dibujada de las partículas (unidades/s) a la temperatura absoluta T. */
export const particleSpeed = (tK: number) => SPEED_25C * Math.sqrt(tK / T0);
/** Choques por segundo contra el émbolo (relativos a 25 °C y 100 mL) y presión relativa que da el dibujo. */
export function drawnPressure(tK: number, volumeMl: number) {
  const hits = Math.sqrt(tK / T0) * (INITIAL.volume / volumeMl);
  return { hits, pressure: hits * Math.sqrt(tK / T0) };
}

export interface GasSceneInput {
  law: GasLaw;
  volume: number; // mL (modelo)
  pressure: number; // kPa (modelo)
  temperatureK: number;
  temperatureC: number;
  /** Segundos de la animación del laboratorio (cuadros / 60). */
  t: number;
}

export function gasScene(inp: GasSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; length: number; speed: number; points: Vec3[] } {
  const L = gasLength(inp.volume);
  const speed = particleSpeed(inp.temperatureK);
  const points = boxParticles(PARTS, [0.08, -HALF, -HALF], [Math.max(0.2, L - 0.1), HALF, HALF], speed, inp.t);
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [3, -1.6, 0], size: [10, 4], color: 'surface-3' },
    { id: 'barril', kind: 'rod', from: [0, 0, 0], to: [SYRINGE_LEN + 0.3, 0, 0], radius: 0.9, color: 'line-strong', opacity: 0.18 },
    { id: 'boquilla', kind: 'rod', from: [-1.0, 0, 0], to: [0, 0, 0], radius: 0.14, color: 'ink-3' },
    { id: 'manometro', kind: 'sphere', center: [-1.5, 0.3, 0], radius: 0.55, color: 'surface-2', label: 'Manómetro' },
    { id: 'embolo', kind: 'rod', from: [L, 0, 0], to: [L + 0.18, 0, 0], radius: 0.86, color: '#3a4448', label: 'Émbolo' },
    { id: 'vastago', kind: 'rod', from: [L + 0.18, 0, 0], to: [L + 2.2, 0, 0], radius: 0.12, color: 'ink-3' },
    { id: 'particulas', kind: 'particles', points, radius: 0.09, color: 'fis', label: 'Partículas' },
    { id: 'P', kind: 'arrow', from: [L + 0.2, 1.2, 0], vector: [inp.pressure * P_ARROW, 0, 0], radius: 0.07, color: 'data', label: 'P' },
  ];
  // Marcas de la escala cada 20 mL.
  for (let v = 20; v <= SYRINGE_CAP; v += 20) items.push({ id: `marca-${v}`, kind: 'rod', from: [gasLength(v), 0.9, 0.05], to: [gasLength(v), v % 100 === 0 ? 1.15 : 1.02, 0.05], radius: 0.02, color: 'ink-2' });
  if (inp.law !== 'boyle') {
    const warm = inp.temperatureC > 25;
    items.push({ id: 'bano', kind: 'box', center: [SYRINGE_LEN / 2 + 0.3, -0.25, 0], size: [SYRINGE_LEN + 1.6, 2.4, 2.4], color: warm ? 'series-1' : 'series-5', opacity: Math.min(0.28, 0.08 + Math.abs(inp.temperatureC - 25) / 300), label: `Baño ${fmt(inp.temperatureC, 0)} °C` });
  }
  const rel = drawnPressure(inp.temperatureK, inp.volume);
  const lawText = inp.law === 'boyle' ? 'temperatura constante (Boyle)' : inp.law === 'charles' ? 'presión constante (Charles)' : 'volumen constante (Gay-Lussac)';
  const description = `Jeringa en 3D a ${lawText}: el gas ocupa ${fmt(inp.volume, 1)} mL (el émbolo está en esa marca), a ${fmt(inp.temperatureC, 1)} °C = ${fmt(inp.temperatureK, 1)} K y ${fmt(inp.pressure, 1)} kPa. `
    + `Las 40 partículas dibujadas (siempre las mismas: la cantidad de gas no cambia) se mueven con una rapidez ${fmt(Math.sqrt(inp.temperatureK / T0), 2)} veces la de 25 °C, porque la rapidez crece con √T. `
    + `Con ese volumen y esa rapidez chocan contra el émbolo ${fmt(rel.hits, 2)} veces más por segundo que a 25 °C y 100 mL, y cada choque empuja ${fmt(Math.sqrt(inp.temperatureK / T0), 2)} veces más fuerte: la presión debería ser ${fmt(rel.pressure, 2)} veces la inicial. El manómetro del modelo marca ${fmt(inp.pressure / INITIAL.pressure, 2)} veces la inicial (101,3 kPa). La flecha P mide la fuerza del gas sobre el émbolo.`;
  return { items, extent: 4.4, target: [2.8, 0, 0], description, length: L, speed, points };
}

/**
 * «calor» (lote 3D-6): el calorímetro de mezclas en 3D, en centímetros, con partículas cuya agitación sigue la
 * temperatura. Funciones PURAS con el MISMO resultado del modelo (src/models/heat.ts → simulate, temperaturesAt,
 * heatFlows) en el mismo instante del banco:
 *   - las temperaturas de la muestra (agua caliente o metal) y del agua del calorímetro son las del modelo de dos nodos en
 *     el tiempo simulado del banco; antes de mezclar, las iniciales;
 *   - cada partícula oscila alrededor de su lugar con amplitud ∝ √T (T absoluta, en kelvin): la rapidez media de las
 *     moléculas es ∝ √T. Entre 20 °C y 60 °C la amplitud solo crece un 7 %; por eso el color (escala fija de
 *     temperatura) también la indica;
 *   - la flecha de calor de la muestra al agua mide ∝ el flujo G·(T₁ − T₂) del modelo (escala fija por corrida: el flujo
 *     inicial mide FLOW_LEN) y desaparece en el equilibrio; las del vaso al aire, ∝ L·(T₂ − T_salón);
 *   - el nivel del agua sube con el volumen vertido (1 mL por cada π·r² del vaso, como el banco) y el metal es un
 *     cilindro de altura igual al diámetro con el volumen m/ρ del modelo.
 * Dibujo: partículas (1 por cada 5 g de agua; la red del metal, 27 sitios), el ritmo de la oscilación, las formas y la
 * tapa.
 */
import { fmt } from '../../lib/format';
import type { ContainerId } from '../../models/heat';
import type { SceneItem, Vec3 } from '../../three/scene';
import { cylinderPoints, hash01, tempColor } from './common';

export const CUP_R = 4; // cm (radio interior; ≈ 450 mL en 9 cm)
export const CUP_H = 9;
export const CUP_AREA = Math.PI * CUP_R * CUP_R;
const BATH_X = -13, BATH_R = 3.4, BATH_H = 8;
const BATH_AREA = Math.PI * BATH_R * BATH_R;
/** Amplitud de la oscilación a 0 °C (cm, dibujo) y su ritmo (oscilaciones por segundo de animación). */
export const AMP_0C = 0.16;
export const JIGGLE_HZ = 1.6;
/** Gramos de agua por partícula dibujada. */
export const G_PER_PARTICLE = 5;
export const FLOW_LEN = 4; // cm del flujo inicial muestra → agua
export const AIR_LEN = 2.2; // cm del mayor flujo posible vaso → aire

/** Amplitud de agitación (cm) para una temperatura en °C: ∝ √T absoluta. */
export const agitation = (T: number) => AMP_0C * Math.sqrt(Math.max(0, T + 273.15) / 273.15);

const WALL: Record<ContainerId, { color: `#${string}` | 'line-strong'; opacity: number; name: string }> = {
  icopor: { color: '#f3f2ea', opacity: 0.34, name: 'Vaso de icopor' },
  vidrio: { color: 'line-strong', opacity: 0.16, name: 'Vaso de vidrio' },
  lata: { color: '#c4cad0', opacity: 0.3, name: 'Lata de aluminio' },
};

export interface HeatSceneInput {
  isMetal: boolean;
  metalName: string;
  metalColor: string;
  /** Densidad del metal (g/cm³). */
  density: number;
  container: ContainerId;
  sampleMass: number;
  waterMass: number;
  /** Avance del traslado (0–1) y tiempo simulado (s), los del banco. */
  transfer: number;
  simT: number;
  /** Agua caliente ya vertida (g), la del banco. */
  poured: number;
  /** Temperaturas del modelo en este instante (°C): muestra y agua del calorímetro. */
  sampleT: number;
  waterT: number;
  /** Flujos de calor del modelo en este instante (W). */
  toWater: number;
  toAir: number;
  /** Conductancias del modelo (W/K) e intervalos iniciales, para fijar la escala de las flechas por corrida. */
  G: number;
  L: number;
  sampleTemp0: number;
  waterTemp0: number;
  ambient: number;
  /** Lectura del termómetro del banco (°C). */
  lcd: number;
  /** Segundos de animación del banco (las partículas se mueven solo mientras corre el registro). */
  clock: number;
  done: boolean;
}

/** Desplazamiento de agitación de la partícula i en el instante τ (cm), con amplitud `amp`. */
export function jiggle(i: number, seed: number, amp: number, tau: number): Vec3 {
  const w = 2 * Math.PI * JIGGLE_HZ;
  const ph = (k: number) => 2 * Math.PI * hash01(i, seed + k);
  // En reposo (τ = 0) la partícula ya está desplazada: la imagen quieta también muestra la agitación.
  return [amp * Math.sin(w * tau * (0.8 + 0.4 * hash01(i, seed + 7)) + ph(1)), amp * Math.sin(w * tau * (0.8 + 0.4 * hash01(i, seed + 8)) + ph(2)), amp * Math.sin(w * tau * (0.8 + 0.4 * hash01(i, seed + 9)) + ph(3))];
}

const ease = (q: number) => (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function heatScene(inp: HeatSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; amps: { sample: number; water: number }; metalD: number } {
  const mixed = inp.transfer >= 1;
  const metalIn = inp.isMetal && inp.transfer >= 0.85;
  const metalV = inp.sampleMass / inp.density;
  const metalD = Math.cbrt((4 * metalV) / Math.PI);
  const cupVolume = inp.waterMass + (inp.isMetal ? 0 : inp.poured) + (metalIn ? metalV : 0);
  const level = 0.3 + cupVolume / CUP_AREA;
  const wall = WALL[inp.container];
  const ampS = agitation(inp.sampleT), ampW = agitation(inp.waterT);
  const tau = inp.clock;
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [-4, -0.02, -2], size: [44, 26], color: 'surface-3' },
    { id: 'vaso', kind: 'rod', from: [0, 0, 0], to: [0, CUP_H + 0.6, 0], radius: CUP_R + 0.35, color: wall.color, opacity: wall.opacity, label: `${wall.name} (calorímetro)` },
    { id: 'tapa', kind: 'rod', from: [0, CUP_H + 0.6, 0], to: [0, CUP_H + 1.4, 0], radius: CUP_R + 0.5, color: '#f3f2ea', opacity: 0.5 },
    { id: 'agua', kind: 'rod', from: [0, 0.3, 0], to: [0, level, 0], radius: CUP_R, color: '#7fbfe0', opacity: 0.22 },
    { id: 'termometro', kind: 'rod', from: [2.2, 0.8, 1], to: [2.2, CUP_H + 4, 1], radius: 0.16, color: 'ink-2', label: `Termómetro: ${fmt(inp.lcd, 1)} °C` },
    { id: 'agitador', kind: 'rod', from: [-2.2, 0.8, -1], to: [-2.2, CUP_H + 3.5, -1], radius: 0.12, color: '#b9c3c6' },
    // Parrilla con el baño o el vaso de agua caliente.
    { id: 'parrilla', kind: 'box', center: [BATH_X, 0.6, 0], size: [9, 1.2, 8], color: '#3a4448' },
    { id: 'bano', kind: 'rod', from: [BATH_X, 1.2, 0], to: [BATH_X, 1.2 + BATH_H, 0], radius: BATH_R + 0.15, color: 'line-strong', opacity: 0.16, label: inp.isMetal ? 'Baño de agua hirviendo' : 'Vaso de agua caliente' },
  ];
  // Agua del calorímetro: partículas en su lugar ± agitación.
  const nW = Math.max(6, Math.round(inp.waterMass / G_PER_PARTICLE));
  const nS = inp.isMetal ? 27 : Math.max(4, Math.round(inp.sampleMass / G_PER_PARTICLE));
  const nPoured = inp.isMetal ? 0 : Math.round((nS * inp.poured) / inp.sampleMass);
  const r = CUP_R - 0.45;
  const top = Math.max(0.9, level - 0.3);
  const base = cylinderPoints(nW + nPoured, [0, 0, 0], r, 0.6, 1, 3);
  const inCup = (p: Vec3): Vec3 => [p[0], 0.6 + (top - 0.6) * ((p[1] - 0.6) / 0.4), p[2]];
  const waterPts = base.slice(0, nW).map((p, i) => { const j = jiggle(i, 5, ampW, tau); return [inCup(p)[0] + j[0], inCup(p)[1] + j[1], inCup(p)[2] + j[2]] as Vec3; });
  items.push({ id: 'p-agua', kind: 'particles', points: waterPts, radius: 0.32, color: tempColor(inp.waterT), label: 'Partículas del agua del calorímetro' });
  // Muestra.
  const sampleLabel = inp.isMetal ? `${inp.metalName}: partículas de su red` : 'Partículas del agua caliente';
  if (inp.isMetal) {
    const mq = ease(clamp01((inp.transfer - 0.1) / 0.75));
    const home: Vec3 = [BATH_X, 1.6 + metalD / 2, 0], cup: Vec3 = [0.4, 0.3 + metalD / 2, 0];
    const c: Vec3 = metalIn ? cup : [home[0] + (cup[0] - home[0]) * mq, home[1] + (cup[1] - home[1]) * mq + Math.sin(Math.PI * mq) * 9, 0];
    items.push({ id: 'metal', kind: 'rod', from: [c[0], c[1] - metalD / 2, c[2]], to: [c[0], c[1] + metalD / 2, c[2]], radius: metalD / 2, color: inp.metalColor as `#${string}`, opacity: 0.45, label: `Pieza de ${inp.metalName.toLowerCase()} (${fmt(inp.sampleMass, 0)} g)` });
    if (!metalIn && inp.transfer < 0.12) items.push({ id: 'hilo', kind: 'rod', from: [c[0], c[1] + metalD / 2, 0], to: [c[0], 1.2 + BATH_H + 3, 0], radius: 0.04, color: 'ink-2' });
    const pts: Vec3[] = [];
    let i = 0;
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const k of [-1, 0, 1]) {
      const s = 0.3 * metalD;
      const j = jiggle(i, 61, ampS * 0.6, tau);
      pts.push([c[0] + a * s + j[0], c[1] + b * s + j[1], c[2] + k * s + j[2]]);
      i++;
    }
    items.push({ id: 'p-muestra', kind: 'particles', points: pts, radius: Math.min(0.3, 0.12 * metalD), color: tempColor(inp.sampleT), label: sampleLabel });
    items.push({ id: 'agua-bano', kind: 'rod', from: [BATH_X, 1.4, 0], to: [BATH_X, 1.4 + 0.72 * BATH_H, 0], radius: BATH_R, color: '#7fbfe0', opacity: 0.25 });
  } else {
    const left = inp.sampleMass - inp.poured;
    const bathLevel = 1.4 + left / BATH_AREA;
    if (left > 0.5) items.push({ id: 'agua-bano', kind: 'rod', from: [BATH_X, 1.4, 0], to: [BATH_X, bathLevel, 0], radius: BATH_R, color: '#7fbfe0', opacity: 0.25 });
    const inBath = cylinderPoints(nS - nPoured, [BATH_X, 0, 0], BATH_R - 0.4, 1.7, Math.max(1.9, bathLevel - 0.3), 81);
    const pts: Vec3[] = [
      ...base.slice(nW).map((p) => inCup(p)),
      ...inBath,
    ].map((p, i) => { const j = jiggle(i, 71, ampS, tau); return [p[0] + j[0], p[1] + j[1], p[2] + j[2]] as Vec3; });
    if (pts.length) items.push({ id: 'p-muestra', kind: 'particles', points: pts, radius: 0.32, color: tempColor(inp.sampleT), label: sampleLabel });
    if (inp.transfer > 0.42 && inp.transfer < 0.75) items.push({ id: 'chorro', kind: 'rod', from: [-4, CUP_H + 5, 0], to: [-1.5, level, 0], radius: 0.35, color: '#7fbfe0', opacity: 0.6 });
  }
  // Flechas de calor (escala fija por corrida).
  const flow0 = Math.abs(inp.G * (inp.sampleTemp0 - inp.waterTemp0));
  const air0 = inp.L * Math.max(Math.abs(inp.sampleTemp0 - inp.ambient), Math.abs(inp.waterTemp0 - inp.ambient));
  const lenW = mixed && flow0 > 0 ? (FLOW_LEN * Math.abs(inp.toWater)) / flow0 : 0;
  const equilibrium = mixed && Math.abs(inp.sampleT - inp.waterT) < 0.05;
  if (lenW > 0.05 && !equilibrium) {
    const dir = Math.sign(inp.toWater) || 1;
    const from: Vec3 = inp.isMetal ? [0.4 + dir * (metalD / 2 + 0.1), 0.3 + metalD / 2, 1.6] : [-dir * 2.2, (0.6 + top) / 2, 1.8];
    items.push({ id: 'calor', kind: 'arrow', from, vector: [dir * lenW, 0, 0], radius: 0.22, color: 'bad', label: dir > 0 ? (inp.isMetal ? 'Calor: metal → agua' : 'Calor: caliente → fría') : 'Calor: agua → muestra' });
  }
  const lenA = mixed && air0 > 0 ? (AIR_LEN * Math.abs(inp.toAir)) / air0 : 0;
  if (lenA > 0.05) {
    const out = inp.toAir > 0;
    const y = Math.min(level, CUP_H) * 0.6;
    items.push({ id: 'aire-1', kind: 'arrow', from: [out ? CUP_R + 0.5 : CUP_R + 0.5 + lenA, y, 0], vector: [out ? lenA : -lenA, 0, 0], radius: 0.16, color: 'warn', label: out ? 'Calor al aire del salón' : 'Calor desde el aire del salón' });
    items.push({ id: 'aire-2', kind: 'arrow', from: [0, y, out ? -(CUP_R + 0.5) : -(CUP_R + 0.5 + lenA)], vector: [0, 0, out ? -lenA : lenA], radius: 0.16, color: 'warn' });
  }
  // Resistencia de la parrilla: roja mientras calienta (antes de mezclar), como en el banco.
  items.push({ id: 'resistencia', kind: 'rod', from: [BATH_X, 1.18, 0], to: [BATH_X, 1.26, 0], radius: BATH_R + 0.6, color: inp.transfer === 0 ? '#d9534f' : '#5b6568' });

  const who = inp.isMetal ? `la pieza de ${inp.metalName.toLowerCase()}` : 'el agua caliente';
  const pct = (ampS / ampW - 1) * 100;
  const state = !mixed
    ? inp.transfer > 0
      ? `Se está agregando ${who} al calorímetro.`
      : `Antes de mezclar: ${who} está en la parrilla (${fmt(inp.sampleTemp0, 0)} °C) y el calorímetro tiene ${fmt(inp.waterMass, 0)} g de agua; el termómetro marca ${fmt(inp.lcd, 1)} °C.`
    : equilibrium
      ? `${inp.done ? 'Registro terminado' : `Tiempo ${fmt(inp.simT, 0)} s`}: la muestra y el agua ya tienen la misma temperatura (equilibrio térmico), así que no pasa calor entre ellas y las partículas tienen el mismo color y la misma agitación. El termómetro marca ${fmt(inp.lcd, 1)} °C${lenA > 0.05 ? `; el vaso sigue ${inp.toAir > 0 ? 'cediendo' : 'recibiendo'} un poco de calor ${inp.toAir > 0 ? 'al' : 'del'} aire del salón (${fmt(inp.ambient, 0)} °C)` : ''}.`
      : `Tiempo ${fmt(inp.simT, 0)} s: el termómetro marca ${fmt(inp.lcd, 1)} °C. Las partículas de ${who} están más ${inp.sampleT > inp.waterT ? 'calientes' : 'frías'} (color más ${inp.sampleT > inp.waterT ? 'rojo' : 'azul'}) y se agitan ${fmt(Math.abs(pct), 1)} % ${pct >= 0 ? 'más' : 'menos'} que las del agua del calorímetro; la flecha roja muestra el calor que pasa ${inp.toWater > 0 ? `de ${who} al agua` : `del agua a ${who}`}, y se acorta a medida que las temperaturas se acercan.`;
  const description = `Calorímetro en 3D (${wall.name.toLowerCase()} con tapa, visto a través de la pared) sobre la mesa, con ${fmt(inp.waterMass, 0)} g de agua, el termómetro y el agitador; a la izquierda, la parrilla. ${state} La agitación de cada partícula es proporcional a la raíz cuadrada de su temperatura absoluta, y su color sigue la escala fija de 20 °C (azul) a 100 °C (rojo).`;
  return { items, extent: 15, target: [-5, 5, 0], description, amps: { sample: ampS, water: ampW }, metalD };
}

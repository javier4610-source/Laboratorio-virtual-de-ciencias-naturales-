/**
 * «cinetica» (lote 3D-4): el erlenmeyer y la jeringa en 3D con las partículas que reaccionan. Funciones PURAS con el
 * MISMO estado del laboratorio (src/models/kinetics.ts → simulateKinetics y volumeAt, con el tiempo simulado del banco):
 *   - partículas del reactivo disuelto (H⁺ del HCl o moléculas de H₂O₂), tantas como la concentración (dibujo: 12 por
 *     mol/L de HCl o 6 por % de H₂O₂), que se mueven con una rapidez ∝ √T mientras corre el cronómetro del laboratorio;
 *   - el sólido (mármol en trozos, granulado o polvo, o el catalizador) que se gasta como en el banco;
 *   - el gas producido en la jeringa: 1 punto por cada mL que marca el modelo en ese instante (los choques efectivos);
 *   - el perfil de energía con la barrera Eₐ del modelo a escala fija (80 kJ/mol = 1,2 unidades) y, con catalizador, la
 *     barrera sin catalizador, tenue, para comparar. La fracción de choques con energía suficiente, e^(−Eₐ/RT), sale de la
 *     misma Eₐ y la misma temperatura.
 */
import { fmt, fmtSig } from '../../lib/format';
import { R_GAS } from '../../models/math';
import { SETUP, type Catalyst, type Particle } from '../../models/kinetics';
import type { SceneItem, Vec3 } from '../../three/scene';
import { boxParticles, seeds, wireRods } from './elec3d';

export const E_SCALE = 1.2 / 80000; // unidades por J/mol
export const SPEED_25C = 0.6;
const LIQ = { x0: -1.5, x1: 1.5, y0: 0.05, y1: 1.5, z0: -0.9, z1: 0.9 };
const SY = { x0: 2.3, len: 3 }; // jeringa: 100 mL = 3 unidades
const REACT = seeds(60, 31);
const GAS = seeds(100, 37);
const T0 = 298.15;

/** Fracción de choques con energía ≥ Eₐ a la temperatura T (°C). */
export const effectiveFraction = (ea: number, tempC: number) => Math.exp(-ea / (R_GAS * (tempC + 273.15)));
/** Partículas de reactivo dibujadas. */
export const reactantCount = (marble: boolean, conc: number) => Math.min(60, Math.round(marble ? 12 * conc : 6 * conc));

export interface KineticsSceneInput {
  marble: boolean;
  concentration: number;
  temperature: number; // °C (la del modelo)
  particle: Particle;
  catalyst: Catalyst;
  /** Energía de activación en uso (J/mol) y, si hay catalizador, la de la reacción sin él. */
  ea: number;
  eaUncatalyzed: number | null;
  rateConstant: number;
  /** Tiempo simulado (s), volumen de gas en ese instante (mL) y fracción de sólido que queda. */
  simT: number;
  volume: number;
  remaining: number;
  /** Segundos simulados por segundo de animación (el del banco). */
  speedUp: number;
}

function profile(id: string, ea: number, z: number, color: SceneItem['color'], opacity?: number): SceneItem[] {
  const pts: Vec3[] = [];
  const y0 = 2.0, xs = -1.5, xe = 1.5;
  for (let i = 0; i <= 24; i++) {
    const x = xs + (i / 24) * (xe - xs);
    const bump = Math.exp(-(((x - 0) / 0.42) ** 2));
    const end = 1 / (1 + Math.exp(-(x - 0.3) / 0.12)); // los productos quedan un poco más abajo (dibujo)
    pts.push([x, y0 + ea * E_SCALE * bump - 0.3 * end, z]);
  }
  return wireRods(id, pts, 0.03, color, opacity);
}

export function kineticsScene(inp: KineticsSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; reactants: number; gasDots: number; fraction: number } {
  const n = reactantCount(inp.marble, inp.concentration);
  const tReal = inp.simT / inp.speedUp;
  const speed = SPEED_25C * Math.sqrt((inp.temperature + 273.15) / T0);
  const pts = boxParticles(REACT.slice(0, n), [LIQ.x0 + 0.1, LIQ.y0 + 0.25, LIQ.z0 + 0.1], [LIQ.x1 - 0.1, LIQ.y1 - 0.1, LIQ.z1 - 0.1], speed, tReal);
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [1.6, -0.02, 0], size: [8, 3], color: 'surface-3' },
    { id: 'liquido', kind: 'box', center: [0, (LIQ.y0 + LIQ.y1) / 2, 0], size: [LIQ.x1 - LIQ.x0, LIQ.y1 - LIQ.y0, LIQ.z1 - LIQ.z0], color: 'series-5', opacity: 0.14, label: inp.marble ? 'HCl' : 'H₂O₂' },
  ];
  if (pts.length) items.push({ id: 'reactivo', kind: 'particles', points: pts, radius: 0.07, color: 'series-2', label: inp.marble ? 'H⁺' : 'H₂O₂' });

  // Sólido en el fondo.
  const g = Math.cbrt(Math.max(0, inp.remaining));
  if (inp.marble && inp.remaining > 0.002) {
    const solid: Vec3[] = [];
    const cfg = inp.particle === 'trozos' ? { n: 3, r: 0.22 } : inp.particle === 'granulado' ? { n: 10, r: 0.11 } : { n: 30, r: 0.05 };
    for (let i = 0; i < cfg.n; i++) solid.push([-1.1 + (2.2 * (i + 0.5)) / cfg.n, LIQ.y0 + cfg.r * g, ((i * 7) % 5) * 0.25 - 0.5]);
    items.push({ id: 'marmol', kind: 'particles', points: solid, radius: cfg.r * g, color: '#ece8df', label: 'Mármol' });
  } else if (!inp.marble && inp.catalyst !== 'ninguno') {
    const nc = inp.catalyst === 'mno2' ? 24 : 6;
    const cat: Vec3[] = Array.from({ length: nc }, (_, i): Vec3 => [-1.2 + (2.4 * (i + 0.5)) / nc, LIQ.y0 + 0.05, ((i * 3) % 4) * 0.3 - 0.45]);
    items.push({ id: 'catalizador', kind: 'particles', points: cat, radius: inp.catalyst === 'mno2' ? 0.05 : 0.11, color: inp.catalyst === 'mno2' ? '#3b3430' : '#e2cd8c', label: inp.catalyst === 'mno2' ? 'MnO₂' : 'Catalasa' });
  }

  // Jeringa: el émbolo en el volumen del modelo y 1 punto por mL de gas.
  const vol = Math.max(0, Math.min(SETUP.syringeMax, inp.volume));
  const xp = SY.x0 + (SY.len * vol) / SETUP.syringeMax;
  items.push({ id: 'manguera', kind: 'rod', from: [0, LIQ.y1 + 0.1, 0], to: [SY.x0, 1.0, 0], radius: 0.05, color: '#c98a4b' });
  items.push({ id: 'jeringa', kind: 'rod', from: [SY.x0, 1.0, 0], to: [SY.x0 + SY.len + 0.2, 1.0, 0], radius: 0.36, color: 'line-strong', opacity: 0.18 });
  items.push({ id: 'embolo', kind: 'rod', from: [xp, 1.0, 0], to: [xp + 0.08, 1.0, 0], radius: 0.34, color: '#3a4448', label: `${fmt(Math.floor(vol), 0)} mL` });
  const dots = Math.floor(vol);
  if (dots > 0) {
    const gp = GAS.slice(0, dots).map(({ p }) => [SY.x0 + 0.04 + p[0] * Math.max(0.02, xp - SY.x0 - 0.08), 1.0 + (p[1] - 0.5) * 0.44, (p[2] - 0.5) * 0.44] as Vec3);
    items.push({ id: 'gas', kind: 'particles', points: gp, radius: 0.045, color: 'series-3', label: inp.marble ? 'CO₂' : 'O₂' });
  }

  // Perfil de energía detrás del recipiente.
  const zb = LIQ.z0 - 0.5;
  if (inp.eaUncatalyzed !== null) items.push(...profile('sin-catalizador', inp.eaUncatalyzed, zb, 'ink-3', 0.5));
  items.push(...profile('perfil', inp.ea, zb, 'data'));
  items.push({ id: 'Ea', kind: 'arrow', from: [-0.55, 2.0, zb], vector: [0, inp.ea * E_SCALE, 0], radius: 0.035, color: 'data', label: 'Eₐ' });

  const f = effectiveFraction(inp.ea, inp.temperature);
  const f25 = effectiveFraction(inp.ea, 25);
  const rel = f / f25;
  let description = `Erlenmeyer y jeringa en 3D: ${inp.marble ? `HCl ${fmt(inp.concentration, 1)} mol/L con mármol en ${inp.particle}` : `agua oxigenada al ${fmt(inp.concentration, 1)} %${inp.catalyst === 'ninguno' ? ' sin catalizador' : ` con ${inp.catalyst === 'mno2' ? 'dióxido de manganeso' : 'catalasa'}`}`} a ${fmt(inp.temperature, 0)} °C. `
    + `Se dibujan ${n} partículas de reactivo (más concentración, más partículas y más choques); se mueven ${fmt(Math.sqrt((inp.temperature + 273.15) / T0), 2)} veces más rápido que a 25 °C. `
    + `Solo reaccionan los choques con energía de al menos Eₐ = ${fmt(inp.ea / 1000, 0)} kJ/mol (la altura de la barrera del perfil): una fracción e^(−Eₐ/RT) = ${fmtSig(f, 2)}, ${fmt(rel, 2)} veces la de 25 °C. `;
  if (inp.eaUncatalyzed !== null) description += `Sin catalizador la barrera sería de ${fmt(inp.eaUncatalyzed / 1000, 0)} kJ/mol (línea tenue): el catalizador la baja. `;
  description += inp.simT > 0
    ? `A los ${fmt(Math.floor(inp.simT), 0)} s la jeringa tiene ${fmt(vol, 1)} mL de ${inp.marble ? 'CO₂' : 'O₂'} (un punto verde por mL): son el resultado de los choques efectivos. Constante de velocidad k = ${fmtSig(inp.rateConstant, 3)}.`
    : 'La reacción no ha comenzado: inicia el cronómetro del laboratorio para ver cómo se llena la jeringa.';
  return { items, extent: 3.4, target: [1.5, 1.1, 0], description, reactants: n, gasDots: dots, fraction: f };
}

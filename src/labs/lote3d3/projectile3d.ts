/**
 * «proyectiles» (lote 3D-3): el lanzamiento en 3D con la trayectoria, la sombra en el suelo y los vectores de velocidad
 * v, vx y vy. Funciones PURAS a partir de la MISMA corrida que dibuja el banco (src/models/projectile.ts → simulateShot):
 *   - la posición es la de la trayectoria muestreada del modelo en el mismo instante t (interpolación lineal, como el banco),
 *   - la velocidad sin aire es la exacta del modelo ideal (idealState); con aire, la derivada central de las muestras de la
 *     integración RK4 (cada 0,01 s),
 *   - la escala de las flechas es FIJA por corrida: la rapidez máxima posible √(v₀² + 2·g·h) mide 0,22 del tamaño de la escena.
 * No revela el alcance antes de medirlo (la descripción calla la distancia hasta «Medir el alcance con la cinta»).
 */
import { fmt } from '../../lib/format';
import { idealState, type TrajPoint } from '../../models/projectile';
import { arrowScale, physicalArrow, type SceneItem, type Vec3 } from '../../three/scene';
import { compact } from './mech3d';

export interface ProjectileSceneInput {
  path: readonly TrajPoint[];
  strobe: readonly TrajPoint[];
  flightTime: number;
  /** Tiempo simulado del banco (s). */
  t: number;
  fired: boolean;
  landed: boolean;
  measured: boolean;
  v0: number;
  angle: number;
  height: number;
  g: number;
  air: boolean;
  /** Ancho y alto del encuadre del banco (m): dependen de v₀, h y el blanco, no del ángulo. */
  spanX: number;
  spanY: number;
  sphereName: string;
  sphereColor: string;
  sphereDiameter: number;
  target: number | null;
  /** Alcance medido (cinta) para la descripción después de medir. */
  rangeReading: number;
  /** Trayectoria ideal de referencia (con aire, después de medir). */
  idealPath?: readonly TrajPoint[] | null;
}

/** Posición en el instante t: interpolación lineal en la trayectoria muestreada (la misma que usa el banco). */
export function positionAt(path: readonly TrajPoint[], t: number): TrajPoint {
  if (!path.length) return { t: 0, x: 0, y: 0 };
  if (t <= path[0].t) return path[0];
  const last = path[path.length - 1];
  if (t >= last.t) return last;
  let i = Math.min(path.length - 2, Math.max(0, Math.floor(t / 0.01)));
  while (i > 0 && path[i].t > t) i--;
  while (i < path.length - 2 && path[i + 1].t < t) i++;
  const a = path[i], b = path[i + 1];
  const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
  return { t, x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) };
}

/** Velocidad (m/s) en el instante t: exacta sin aire; con aire, derivada central de las muestras del modelo. */
export function velocityAt(inp: Pick<ProjectileSceneInput, 'path' | 'air' | 'v0' | 'angle' | 'height' | 'g' | 'flightTime'>, t: number): { vx: number; vy: number } {
  const tt = Math.max(0, Math.min(t, inp.flightTime));
  if (!inp.air) { const s = idealState(inp.v0, inp.angle, inp.height, tt, inp.g); return { vx: s.vx, vy: s.vy }; }
  const p = inp.path;
  if (p.length < 2) { const a = (inp.angle * Math.PI) / 180; return { vx: inp.v0 * Math.cos(a), vy: inp.v0 * Math.sin(a) }; }
  if (tt <= 0) { const a = (inp.angle * Math.PI) / 180; return { vx: inp.v0 * Math.cos(a), vy: inp.v0 * Math.sin(a) }; }
  let i = 1;
  while (i < p.length - 1 && p[i].t < tt) i++;
  const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i)];
  const dt = b.t - a.t;
  return dt > 0 ? { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt } : { vx: 0, vy: 0 };
}

/** Escala fija de las flechas de velocidad (m de escena por m/s) para una corrida. */
export function projectileArrowScale(v0: number, height: number, g: number, span: number) {
  return arrowScale(Math.sqrt(v0 * v0 + 2 * g * height), 0.22 * span);
}

export function projectileScene(inp: ProjectileSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; k: number; velocity: { vx: number; vy: number }; position: TrajPoint } {
  const span = Math.max(inp.spanX, inp.spanY, 1);
  const tNow = !inp.fired ? 0 : inp.landed ? inp.flightTime : Math.min(inp.t, inp.flightTime);
  const pos = !inp.fired ? inp.path[0] ?? { t: 0, x: 0, y: inp.height } : positionAt(inp.path, tNow);
  const vel = velocityAt(inp, tNow);
  const k = projectileArrowScale(inp.v0, inp.height, inp.g, span);
  const r = Math.max(inp.sphereDiameter / 2, 0.018 * span);
  const th = (inp.angle * Math.PI) / 180;
  const u: Vec3 = [Math.cos(th), Math.sin(th), 0];
  const muzzle: Vec3 = [0, inp.height, 0];
  const tableTop = inp.height - 0.12;
  const zW = 0.22 * span;

  const items: SceneItem[] = [
    { id: 'piso', kind: 'plane', center: [inp.spanX / 2 - 0.1 * span, 0, 0], size: [inp.spanX + 0.45 * span, 2 * zW], color: 'surface-3' },
  ];
  if (tableTop > 0.03) {
    items.push({ id: 'mesa', kind: 'box', center: [-0.12 * span, tableTop / 2, 0], size: [0.26 * span, tableTop, 0.2 * span], color: 'series-6', opacity: 0.85 });
  }
  // Soporte, lanzador (tubo a lo largo de la dirección de salida, por detrás de la boca) y plomada.
  items.push({ id: 'soporte', kind: 'rod', from: [0, Math.max(0, tableTop), 0], to: muzzle, radius: 0.008 * span, color: 'ink-2' });
  items.push({ id: 'lanzador', kind: 'rod', from: [-u[0] * 0.13 * span, inp.height - u[1] * 0.13 * span, 0], to: muzzle, radius: Math.max(r * 1.2, 0.02 * span), color: 'series-8', label: `Lanzador ${fmt(inp.angle, 1)}°` });

  if (inp.target !== null) {
    items.push({ id: 'blanco', kind: 'box', center: [inp.target, 0.02 * span, 0], size: [0.07 * span, 0.04 * span, 0.07 * span], color: 'series-5', edges: true, opacity: 0.8, label: 'Blanco' });
  }

  // Trayectoria recorrida (cada 0,05 s, como la fotografía estroboscópica) y su sombra en el suelo.
  const shown = inp.fired ? inp.strobe.filter((p) => p.t <= tNow + 1e-9) : [];
  if (shown.length > 1) {
    items.push({ id: 'trayectoria', kind: 'particles', points: shown.map((p) => [p.x, p.y, 0] as Vec3), radius: r * 0.55, color: 'fis', opacity: 0.55 });
    items.push({ id: 'sombra-trayectoria', kind: 'particles', points: shown.map((p) => [p.x, 0.002, 0] as Vec3), radius: r * 0.45, color: 'ink-3', opacity: 0.45 });
  }
  if (inp.measured && inp.idealPath && inp.idealPath.length > 1) {
    items.push({ id: 'ideal', kind: 'particles', points: inp.idealPath.filter((_, i) => i % 5 === 0).map((p) => [p.x, p.y, 0] as Vec3), radius: r * 0.3, color: 'ink-3', opacity: 0.6, label: 'Sin aire' });
  }
  items.push({ id: 'sombra', kind: 'ellipsoid', center: [pos.x, 0.003, 0], radii: [r * 1.1, r * 0.08, r * 1.1], color: 'ink', opacity: 0.35, label: 'Sombra' });
  items.push({ id: 'esfera', kind: 'sphere', center: [pos.x, pos.y, 0], radius: r, color: (/^#[0-9a-f]{6}$/i.test(inp.sphereColor) ? inp.sphereColor : 'series-8') as `#${string}` });
  if (inp.landed) items.push({ id: 'marca', kind: 'ellipsoid', center: [pos.x, 0.002, 0], radii: [r * 0.5, 0.001, r * 0.5], color: 'ink' });

  // Vectores de velocidad: v y sus componentes, desde el centro de la esfera (al caer, la esfera ya no tiene velocidad).
  if (!inp.landed) {
    const c: Vec3 = [pos.x, pos.y, 0];
    const ar = Math.max(r * 0.32, 0.005 * span);
    const v = physicalArrow(c, [vel.vx, vel.vy, 0], k);
    const vx = physicalArrow(c, [vel.vx, 0, 0], k);
    const vy = physicalArrow(c, [0, vel.vy, 0], k);
    items.push(...compact<SceneItem>([
      v && { id: 'v', kind: 'arrow', ...v, radius: ar, color: 'series-2', label: 'v' },
      vx && { id: 'vx', kind: 'arrow', ...vx, radius: ar * 0.8, color: 'series-1', label: 'vx' },
      vy && { id: 'vy', kind: 'arrow', ...vy, radius: ar * 0.8, color: 'series-3', label: 'vy' },
    ]));
  }

  const where = inp.air ? 'con resistencia del aire' : 'sin aire';
  const comp = (vy: number) => (Math.abs(vy) < 0.005 ? 'vy es casi nula (punto más alto)' : `vy = ${fmt(Math.abs(vy), 2)} m/s ${vy > 0 ? 'hacia arriba' : 'hacia abajo'}`);
  let description = `Lanzamiento en 3D: esfera de ${inp.sphereName.toLowerCase()} lanzada a ${fmt(inp.angle, 1)}° desde ${fmt(inp.height, 2)} m de altura, ${where}. `;
  if (!inp.fired) {
    description += `La esfera está en el lanzador. Las flechas muestran la velocidad de salida y sus componentes: vx = ${fmt(vel.vx, 2)} m/s hacia adelante y ${comp(vel.vy)}.`;
  } else if (!inp.landed) {
    description += `En t = ${fmt(tNow, 2)} s la esfera está a ${fmt(pos.y, 2)} m del piso. Velocidad del modelo: vx = ${fmt(vel.vx, 2)} m/s hacia adelante (${inp.air ? 'el aire la va frenando' : 'constante: no hay fuerza horizontal'}) y ${comp(vel.vy)} (la gravedad la cambia). La sombra en el suelo avanza con vx.`;
  } else if (!inp.measured) {
    description += 'La esfera cayó y dejó la marca en el papel carbón; falta medir el alcance con la cinta. La trayectoria punteada es la de la fotografía estroboscópica y su sombra en el suelo.';
  } else {
    description += `La esfera cayó a ${fmt(inp.rangeReading, 3)} m de la plomada (cinta métrica).${inp.idealPath ? ' Los puntos grises son la trayectoria sin aire para comparar.' : ''}`;
  }
  if (inp.target !== null) description += ` El blanco está a ${fmt(inp.target, 2)} m.`;

  const extent = 0.5 * Math.hypot(inp.spanX + 0.45 * span, Math.max(inp.spanY, inp.height + 0.1)) + 0.05 * span;
  const target: Vec3 = [inp.spanX / 2 - 0.1 * span, Math.max(inp.spanY, inp.height) / 2, 0];
  return { items, extent, target, description, k, velocity: vel, position: pos };
}

/**
 * «circuitos-simples» (lote 3D-4): la mesa de bornes en 3D con las MISMAS piezas, cables y conexiones que el banco 2D
 * (la netlist del laboratorio) y el MISMO resultado del modelo (src/models/simpleCircuits.ts → solveSimpleCircuit):
 *   - cada pieza entre sus dos bornes (pila con su polo + de cobre, bombillos, LED, interruptores abiertos o cerrados…);
 *   - los bombillos brillan según P/Pₙ del modelo (color de la ampolla y halo);
 *   - electrones (puntos) en cada conductor por el que pasa corriente, en sentido contrario a la corriente convencional,
 *     con una rapidez proporcional a la corriente del modelo en ESE tramo (escala fija: 0,3 A = 1 casilla por segundo,
 *     muchísimo más rápido que la deriva real). La densidad de puntos es igual en todos los tramos, así que en un nudo
 *     entran tantos electrones por segundo como salen.
 */
import { fmt } from '../../lib/format';
import type { NetPart, SimpleCircuitResult } from '../../models/simpleCircuits';
import type { SceneItem, Vec3 } from '../../three/scene';
import { bulb, compact, electronsAlong } from './elec3d';

export const COLS = 8, ROWS = 5;
/** Corriente que se dibuja a 1 casilla por segundo (la nominal del bombillo de linterna). */
export const DRIFT_CURRENT = 0.3;
/** Rapidez máxima dibujada (casillas/s): en un cortocircuito los electrones no se vuelven una mancha. */
export const DRIFT_CAP = 4;
/** Corriente mínima para dibujar electrones en movimiento (A), la misma con que el modelo da un circuito por cerrado. */
export const MIN_CURRENT = 1e-4;
const WIRE_COLORS = ['#c62828', '#1f2a30', '#d9a400', '#2e7d32', '#1565c0'];
const MATERIAL: Record<string, `#${string}`> = { clip: '#aab3b9', moneda: '#c9a24a', grafito: '#3d4144', borrador: '#e57a8a', plastico: '#7fb3d5' };

/** Borne «r1c0» → posición en la mesa 3D (x a lo largo de las columnas, z de las filas, y hacia arriba). */
export function nodePos(node: string): Vec3 {
  const m = /^r(\d+)c(\d+)$/.exec(node);
  if (!m) return [0, 0, 0];
  return [Number(m[2]) - (COLS - 1) / 2, 0, Number(m[1]) - (ROWS - 1) / 2];
}

/** Rapidez dibujada de los electrones (casillas/s) para una corriente del modelo (A). */
export const driftSpeed = (current: number) => Math.min(DRIFT_CAP, Math.abs(current) / DRIFT_CURRENT);

export interface SimpleCircuitSceneInput {
  netlist: readonly NetPart[];
  res: SimpleCircuitResult;
  /** Color de cada cable de la mesa (índice de la paleta del banco). */
  wireColor: Record<string, number>;
  /** Segundos de animación de los electrones (0 = quietos). */
  t: number;
}

const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const up = (p: Vec3, y: number): Vec3 => [p[0], p[1] + y, p[2]];

/** Camino 3D de un conductor de a hacia b: los cables hacen un arco; las piezas van rectas a la altura de su cuerpo. */
export function conductorPath(p: NetPart): Vec3[] {
  const a = nodePos(p.a), b = nodePos(p.b);
  if (p.kind === 'cable') {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    return [up(a, 0.06), up(lerp3(a, b, 0.25), 0.06 + 0.12 * Math.min(1, L / 2)), up(lerp3(a, b, 0.5), 0.06 + 0.17 * Math.min(1, L / 2)), up(lerp3(a, b, 0.75), 0.06 + 0.12 * Math.min(1, L / 2)), up(b, 0.06)];
  }
  const h = p.kind === 'pila' ? 0.22 : 0.1;
  return [up(a, 0.06), up(lerp3(a, b, 0.2), h), up(lerp3(a, b, 0.8), h), up(b, 0.06)];
}

function partItems(p: NetPart, res: SimpleCircuitResult, wireColor: Record<string, number>): SceneItem[] {
  const a = nodePos(p.a), b = nodePos(p.b), mid = lerp3(a, b, 0.5);
  const along: Vec3 = [b[0] - a[0], 0, b[2] - a[2]];
  const alongX = Math.abs(along[0]) >= Math.abs(along[2]);
  const sz = (l: number, h: number, w: number): Vec3 => (alongX ? [l, h, w] : [w, h, l]);
  const r = res.parts[p.id];
  switch (p.kind) {
    case 'cable': {
      const path = conductorPath(p);
      const col = WIRE_COLORS[(wireColor[p.id] ?? 0) % WIRE_COLORS.length] as `#${string}`;
      return path.slice(1).map((q, i) => ({ id: `${p.id}-${i}`, kind: 'rod' as const, from: path[i], to: q, radius: 0.045, color: col }));
    }
    case 'pila':
      // Polo + (b, según el modelo) con el capuchón de cobre.
      return [
        { id: p.id, kind: 'rod', from: up(lerp3(a, b, 0.1), 0.22), to: up(lerp3(a, b, 0.72), 0.22), radius: 0.2, color: '#2b3133', label: p.id },
        { id: `${p.id}-mas`, kind: 'rod', from: up(lerp3(a, b, 0.72), 0.22), to: up(lerp3(a, b, 0.9), 0.22), radius: 0.2, color: '#c46f22' },
        { id: `${p.id}-borne`, kind: 'rod', from: up(lerp3(a, b, 0.9), 0.22), to: up(lerp3(a, b, 0.95), 0.22), radius: 0.07, color: 'series-8' },
      ];
    case 'bombillo':
      return [
        { id: `${p.id}-base`, kind: 'box', center: up(mid, 0.05), size: sz(0.62, 0.1, 0.34), color: '#3a4448' },
        ...bulb(p.id, up(mid, 0.1), 0.3, r?.brightness ?? 0, p.id),
      ];
    case 'led': {
      const on = !!r?.on, g = Math.min(1.5, r?.brightness ?? 0);
      return compact<SceneItem>([
        { id: `${p.id}-base`, kind: 'box', center: up(mid, 0.05), size: sz(0.5, 0.1, 0.26), color: '#3a4448' },
        { id: p.id, kind: 'sphere', center: up(mid, 0.28), radius: 0.13, color: on ? '#ff4a3d' : '#7a2a24', label: p.id },
        on && g > 0.02 ? { id: `${p.id}-halo`, kind: 'sphere', center: up(mid, 0.28), radius: 0.18 + 0.2 * Math.sqrt(g), color: '#ff6b5f', opacity: Math.min(0.4, 0.1 + 0.25 * g) } : null,
      ]);
    }
    case 'resistor':
      return [{ id: p.id, kind: 'box', center: up(mid, 0.1), size: sz(0.5, 0.16, 0.16), color: '#d8c7a0', label: p.id }];
    case 'interruptor': {
      const closed = !!p.closed;
      const hinge = up(lerp3(a, b, 0.15), 0.12);
      const tip = closed ? up(lerp3(a, b, 0.85), 0.12) : up(lerp3(a, b, 0.72), 0.45);
      return [
        { id: `${p.id}-base`, kind: 'box', center: up(mid, 0.05), size: sz(0.8, 0.1, 0.3), color: '#e9ecef', edges: true },
        { id: p.id, kind: 'rod', from: hinge, to: tip, radius: 0.04, color: 'series-8', label: p.id },
        { id: `${p.id}-mango`, kind: 'sphere', center: tip, radius: 0.07, color: closed ? 'ok' : 'bad' },
      ];
    }
    case 'motor':
      return [
        { id: p.id, kind: 'box', center: up(mid, 0.2), size: sz(0.4, 0.34, 0.34), color: '#9aa3a8', label: p.id },
        { id: `${p.id}-eje`, kind: 'rod', from: up(mid, 0.37), to: up(mid, 0.6), radius: 0.03, color: 'ink-2' },
      ];
    case 'zumbador':
      return [{ id: p.id, kind: 'rod', from: up(mid, 0.02), to: up(mid, 0.26), radius: 0.22, color: '#1f2628', label: p.id }];
    case 'multimetro':
      return [{ id: p.id, kind: 'box', center: up(mid, 0.12), size: sz(0.5, 0.18, 0.42), color: '#f2b300', label: `${p.id} (${p.mode ?? 'V'})` }];
    default:
      return [{ id: p.id, kind: 'box', center: up(mid, 0.06), size: sz(0.62, 0.08, 0.16), color: MATERIAL[p.kind] ?? 'ink-3', label: p.id }];
  }
}

export function simpleCircuitScene(inp: SimpleCircuitSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; electrons: number; flowing: { id: string; current: number; speed: number }[] } {
  const { netlist, res } = inp;
  const bornes: Vec3[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bornes.push(nodePos(`r${r}c${c}`));
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'box', center: [0, -0.06, 0], size: [COLS + 0.4, 0.1, ROWS + 0.4], color: '#c8a46a' },
    { id: 'bornes', kind: 'particles', points: bornes, radius: 0.06, color: 'series-8' },
  ];
  for (const p of netlist) items.push(...partItems(p, res, inp.wireColor));

  // Electrones: un punto cada 0,25 casillas en cada conductor con corriente; sentido contrario a la corriente convencional.
  const flowing: { id: string; current: number; speed: number }[] = [];
  const pts: Vec3[] = [];
  for (const p of netlist) {
    const i = res.parts[p.id]?.current ?? 0;
    if (Math.abs(i) <= MIN_CURRENT) continue;
    const speed = driftSpeed(i);
    flowing.push({ id: p.id, current: i, speed });
    const path = conductorPath(p);
    const conv = i >= 0 ? path : [...path].reverse();
    pts.push(...electronsAlong(conv, speed * inp.t, 0.25, [0, 0.06, 0]));
  }
  if (pts.length) items.push({ id: 'electrones', kind: 'particles', points: pts, radius: 0.055, color: 'info' });

  const lamps = netlist.filter((p) => p.kind === 'bombillo');
  const cells = netlist.filter((p) => p.kind === 'pila');
  const status = { vacio: 'La mesa está vacía', 'sin-pila': 'No hay pila en la mesa: no hay corriente', abierto: 'El circuito está abierto: ningún electrón se mueve', cerrado: 'El circuito está cerrado', corto: '¡Cortocircuito!' }[res.status];
  let description = `Mesa de bornes en 3D con ${netlist.length - netlist.filter((p) => p.kind === 'cable').length} piezas y ${netlist.filter((p) => p.kind === 'cable').length} cables, las mismas del banco. ${status}.`;
  if (lamps.length) description += ` ${lamps.map((l) => { const r = res.parts[l.id]; return `${l.id} ${r?.on ? `brilla al ${fmt(Math.min(999, (r.brightness ?? 0) * 100), 0)} % de su potencia nominal` : 'apagado'}`; }).join('; ')}.`;
  if (flowing.length) {
    const cell = cells.map((c) => res.parts[c.id]).find((r) => r && Math.abs(r.current) > MIN_CURRENT);
    const imax = Math.max(...flowing.map((f) => Math.abs(f.current)));
    description += ` Los puntos azules son electrones: salen del polo − de la pila, recorren el circuito y vuelven por el polo + (al revés de la corriente convencional).${cell ? ` La pila entrega ${fmt(Math.abs(cell.current), 3)} A.` : ''} Su rapidez en cada tramo es proporcional a la corriente del modelo en ese tramo: la mayor es ${fmt(imax, 3)} A${imax / DRIFT_CURRENT > DRIFT_CAP ? ' (dibujada con la rapidez máxima)' : ''}.`;
  } else if (res.status !== 'vacio') description += ' No circula corriente: los electrones libres de los cables no avanzan.';
  return { items, extent: 4.3, target: [0, 0.2, 0], description, electrons: pts.length, flowing };
}

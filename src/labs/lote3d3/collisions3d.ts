/**
 * «choques» (lote 3D-3): riel de aire 3D con los dos deslizadores y sus vectores de cantidad de movimiento p₁ = m₁·v₁,
 * p₂ = m₂·v₂ y p total, sincronizados con la animación del banco. Funciones PURAS a partir del MISMO modelo
 * (src/models/collisions.ts → simulateCollision, timeline, stateAt): posiciones y velocidades del mismo instante t, también
 * durante el contacto (impulso con perfil suave del modelo). Escala FIJA por corrida: la mayor cantidad de movimiento de la
 * corrida (antes o después, de un deslizador o del total) mide 0,45 m. Después del choque se dejan, tenues, las flechas de
 * antes para comparar. El centro de masa se marca con una varilla vertical.
 */
import { fmt } from '../../lib/format';
import { RAIL, type CollisionResult, type State } from '../../models/collisions';
import { arrowScale, type SceneItem, type Vec3 } from '../../three/scene';
import { cart, cartTop, compact, photogate, sense, xArrow } from './mech3d';

export const P_ARROW_LENGTH = 0.45;
const CART_SIZE = (m: number): Vec3 => [RAIL.glider, 0.05 + 0.04 * m, 0.1];
const FLOOR = 0.02;

/** Mayor |p| de la corrida (kg·m/s): fija la escala de las flechas. */
export function maxMomentum(r: CollisionResult): number {
  const { m1, m2, model: md } = r;
  return Math.max(Math.abs(m1 * md.v1), Math.abs(m2 * md.v2), Math.abs(m1 * md.v1f), Math.abs(m2 * md.v2f), Math.abs(md.pBefore), Math.abs(md.pAfter), 1e-6);
}

export interface CollisionsSceneInput {
  res: CollisionResult;
  st: State;
  /** ¿Ya empezó el contacto en el instante del banco? */
  pastContact: boolean;
  done: boolean;
  typeName: string;
}

export function collisionsScene(inp: CollisionsSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; k: number; p1: number; p2: number } {
  const { res, st } = inp;
  const k = arrowScale(maxMomentum(res), P_ARROW_LENGTH);
  const p1 = res.m1 * st.v1, p2 = res.m2 * st.v2, p = p1 + p2;
  const s1 = CART_SIZE(res.m1), s2 = CART_SIZE(res.m2);
  const t1 = cartTop(FLOOR, s1), t2 = cartTop(FLOOR, s2);
  const xcm = (res.m1 * st.x1 + res.m2 * st.x2) / (res.m1 + res.m2);
  const yP1 = Math.max(t1, t2) + 0.07, yP2 = yP1 + 0.09, yP = yP2 + 0.11;
  const r = 0.011;

  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [RAIL.length / 2, -0.25, 0], size: [RAIL.length + 0.5, 0.7], color: 'surface-3' },
    { id: 'riel', kind: 'box', center: [RAIL.length / 2, FLOOR - 0.025, 0], size: [RAIL.length, 0.05, 0.08], color: 'series-8', edges: true },
    { id: 'pata-1', kind: 'rod', from: [0.15, -0.25, 0], to: [0.15, FLOOR - 0.05, 0], radius: 0.015, color: 'ink-2' },
    { id: 'pata-2', kind: 'rod', from: [RAIL.length - 0.15, -0.25, 0], to: [RAIL.length - 0.15, FLOOR - 0.05, 0], radius: 0.015, color: 'ink-2' },
    ...photogate('fotopuerta-1', RAIL.gate1, FLOOR, 0.24, 0.1),
    ...photogate('fotopuerta-2', RAIL.gate2, FLOOR, 0.24, 0.1),
    ...cart('carrito-1', st.x1, FLOOR, s1, 'series-1', 'Deslizador 1'),
    ...cart('carrito-2', st.x2, FLOOR, s2, 'series-2', 'Deslizador 2'),
    { id: 'cm', kind: 'rod', from: [xcm, FLOOR, 0], to: [xcm, yP, 0], radius: 0.005, color: 'ink-3', opacity: 0.8 },
  ];
  // Después del choque: las flechas de antes, tenues, a la altura de las de ahora (para comparar).
  if (inp.pastContact && res.collides) {
    const before = compact<SceneItem>([
      xArrow('p1-antes', [st.x1, yP1, -0.06], res.m1 * res.model.v1, k, 'series-1', '', r * 0.7),
      xArrow('p2-antes', [st.x2, yP2, -0.06], res.m2 * res.model.v2, k, 'series-2', '', r * 0.7),
      xArrow('p-antes', [xcm, yP, -0.06], res.model.pBefore, k, 'ink-3', '', r * 0.7),
    ]).map((it) => ({ ...it, label: undefined, opacity: 0.3 }));
    items.push(...before);
  }
  items.push(...compact<SceneItem>([
    xArrow('p1', [st.x1, yP1, 0], p1, k, 'series-1', 'p₁', r),
    xArrow('p2', [st.x2, yP2, 0], p2, k, 'series-2', 'p₂', r),
    xArrow('p', [xcm, yP, 0], p, k, 'ink', 'p total', r * 1.2),
  ]));

  const kg = (v: number) => `${fmt(Math.abs(v), 3)} kg·m/s`;
  const phase = !inp.pastContact ? 'antes del choque' : st.contact ? 'durante el contacto' : 'después del choque';
  let description = `Riel de aire en 3D, choque ${inp.typeName.toLowerCase()}: deslizador 1 de ${fmt(res.m1, 2)} kg y deslizador 2 de ${fmt(res.m2, 2)} kg, ${phase}. Cada flecha mide m·v (la misma escala para todas): p₁ ${sense(p1)}, p₂ ${sense(p2)}; la flecha negra es la suma, p total ${sense(p)}, sobre el centro de masa. `;
  if (!res.collides) description += 'Los deslizadores no se alcanzan: no hay choque y cada uno conserva su cantidad de movimiento.';
  else if (!inp.pastContact) description += 'Durante el choque se intercambian cantidad de movimiento; observa si la flecha del total cambia.';
  else if (!inp.done) description += 'Las flechas tenues son las de antes del choque. La del total no cambia: el impulso que recibe un deslizador lo pierde el otro.';
  else description += `Según el modelo: antes ${kg(res.model.pBefore)} y después ${kg(res.model.pAfter)} en total (se conserva); p₁ pasó de ${fmt(res.m1 * res.model.v1, 3)} a ${fmt(res.m1 * res.model.v1f, 3)} kg·m/s y p₂ de ${fmt(res.m2 * res.model.v2, 3)} a ${fmt(res.m2 * res.model.v2f, 3)} kg·m/s (positivo = hacia la derecha). Las flechas tenues son las de antes.`;
  return { items, extent: 1.2, target: [RAIL.length / 2, 0.1, 0], description, k, p1, p2 };
}

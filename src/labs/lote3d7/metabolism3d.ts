/**
 * «metabolismo» (lote 3D-7): la red del metabolismo central de E. coli dentro de una célula esquemática, con los flujos
 * del FBA. Funciones PURAS con el MISMO resultado del modelo que dibuja el mapa del banco (src/models/metabolism.ts →
 * runFba sobre e_coli_core, validado con COBRApy): la condición actual o la de referencia, según elija el banco.
 *   - el mapa del banco queda acostado en el piso de la célula (40 px del mapa = 1 unidad); cada reacción dibujada es una
 *     flecha en el sentido de su flujo (punta según el signo, como en el banco) con grosor ∝ √|v| (la misma regla del
 *     banco: 1,6 + 6·√(min(|v|, 40)/20) px, 40 px = 1 unidad);
 *   - sobre la mitad de cada flecha se levanta una columna cuya ALTURA es |v| en escala lineal (10 mmol/gDW/h = 2,5
 *     unidades; tope en 40): así se comparan flujos que en el grosor (raíz) se parecen; las reacciones de energía del
 *     panel del banco (NADH16, CYTBD, ATPS4r, THD2, ATPM) van como columnas en una fila aparte con la misma escala;
 *   - los cosustratos y coproductos unidos al punto medio en el banco (líneas finas de unión) no se dibujan en 3D;
 *   - las reacciones sin flujo son varillas finas y las apagadas por las eliminaciones (regla GPR) son rojas;
 *   - los metabolitos de afuera (intercambios) quedan fuera de la membrana; los valores con signo (captación o
 *     secreción) van en el texto.
 * Dibujo: la célula, la membrana y la posición de los nodos (el diagrama del banco, no la ubicación real en la célula).
 */
import { fmt } from '../../lib/format';
import { BIOMASS_ID, MAP_EDGES, MAP_ENERGY, MAP_NODES, pathwayOf, roundFlux, roundGrowth } from '../../models/metabolism';
import type { SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';

/** Flujo «visible»: por debajo se considera cero (ruido numérico), como en el banco. */
export const ZERO = 1e-6;
export const PX = 40;
/** Altura de las columnas: 10 mmol/gDW/h = 2,5 unidades (tope en 40). */
export const COL_PER_FLUX = 0.25;
export const COL_CAP = 40;
const PLANE_Y = 0.3;
const ENERGY_LABEL: Record<string, string> = { NADH16: 'NADH deshidrogenasa', CYTBD: 'Citocromo oxidasa', ATPS4r: 'ATP sintasa', THD2: 'Transhidrogenasa', ATPM: 'ATP de mantenimiento' };

export const mapPoint = (x: number, y: number, h = PLANE_Y): Vec3 => [(x - 520) / PX, h, (y - 386) / PX];
/** Grosor (radio, en unidades) con la regla del banco. */
export const fluxRadius = (v: number) => Math.min(10, 1.6 + 6 * Math.sqrt(Math.min(Math.abs(v), 40) / 20)) / PX / 2;
export const columnHeight = (v: number) => Math.min(Math.abs(v), COL_CAP) * COL_PER_FLUX;

export interface MetabolismSceneInput {
  /** Flujos de la solución que muestra el banco (null si no se calculó o no es factible). */
  fluxes: Record<string, number> | null;
  computed: boolean;
  disabled: readonly string[];
  view: 'actual' | 'referencia';
  carbonLabel: string;
}

export function metabolismScene(inp: MetabolismSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; active: { r: string; v: number }[] } {
  const off = new Set(inp.disabled);
  const items: SceneItem[] = [
    { id: 'membrana', kind: 'box', center: mapPoint(520, 380, 0.75), size: [884 / PX, 1.5, 664 / PX], color: 'bio', opacity: 0.12, edges: true, label: 'Membrana y citoplasma de E. coli (esquema)', tag: '' },
    { id: 'citoplasma', kind: 'plane', center: mapPoint(520, 380, 0.02), size: [872 / PX, 652 / PX], color: 'surface-2', opacity: 0.8 },
  ];
  const fx = inp.fluxes;
  const active: { r: string; v: number }[] = [];
  for (const e of MAP_EDGES) {
    const A = MAP_NODES[e.from], B = MAP_NODES[e.to];
    const v = fx ? fx[e.r] ?? 0 : 0;
    const isOff = off.has(e.r);
    const on = inp.computed && fx !== null && Math.abs(v) > ZERO && !isOff;
    // Desplazamiento lateral de las reacciones paralelas (como el banco).
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, o = e.off ?? 0;
    const pad = 16;
    const a = mapPoint(A.x + (dx / L) * pad + nx * o, A.y + (dy / L) * pad + ny * o);
    const b = mapPoint(B.x - (dx / L) * pad + nx * o, B.y - (dy / L) * pad + ny * o);
    const transport = pathwayOf(e.r) === 'transporte';
    const color: SceneColor = isOff ? 'bad' : on ? (transport ? 'fis' : 'bio') : 'line-strong';
    if (on) {
      active.push({ r: e.r, v });
      const [s, t] = v > 0 ? [a, b] : [b, a];
      items.push({ id: `rx-${e.r}`, kind: 'arrow', from: s, vector: [t[0] - s[0], 0, t[2] - s[2]], radius: fluxRadius(v), color });
      const mid: Vec3 = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2];
      const hgt = columnHeight(v);
      items.push({ id: `col-${e.r}`, kind: 'box', center: [mid[0], PLANE_Y + hgt / 2, mid[2]], size: [0.22, hgt, 0.22], color, opacity: 0.85 });
    } else {
      items.push({ id: `rx-${e.r}`, kind: 'rod', from: a, to: b, radius: isOff ? 0.06 : 0.025, color, opacity: isOff ? 1 : 0.6 });
    }
  }
  // Metabolitos: internos en el piso; de afuera, fuera de la membrana.
  const inner: Vec3[] = [], outer: Vec3[] = [];
  for (const [id, n] of Object.entries(MAP_NODES)) (id.endsWith('_e') ? outer : inner).push(mapPoint(n.x, n.y));
  items.push({ id: 'metabolitos', kind: 'particles', points: inner, radius: 0.16, color: 'ink-3', label: 'Metabolitos del citoplasma (nodos del mapa)', tag: '' });
  items.push({ id: 'externos', kind: 'particles', points: outer, radius: 0.18, color: 'ink-2', label: 'Metabolitos del medio externo (intercambios)', tag: '' });
  // Columnas de energía (fila aparte, misma escala de altura).
  MAP_ENERGY.forEach((id, i) => {
    const v = fx ? fx[id] ?? 0 : 0;
    const p = mapPoint(760 + i * 40, 150);
    const isOff = off.has(id);
    if (inp.computed && fx && Math.abs(v) > ZERO && !isOff) {
      const hgt = columnHeight(v);
      items.push({ id: `en-${id}`, kind: 'box', center: [p[0], PLANE_Y + hgt / 2, p[2]], size: [0.5, hgt, 0.5], color: 'accent', opacity: 0.9,
        ...(i === 0 ? { label: 'Columnas de energía: NADH16, CYTBD, ATPS4r, THD2 y ATPM (misma escala)', tag: '' } : {}) });
    } else {
      items.push({ id: `en-${id}`, kind: 'box', center: [p[0], PLANE_Y + 0.03, p[2]], size: [0.5, 0.06, 0.5], color: isOff ? 'bad' : 'line-strong', ...(i === 0 ? { label: 'Columnas de energía: NADH16, CYTBD, ATPS4r, THD2 y ATPM (misma escala)', tag: '' } : {}) });
    }
  });
  const mu = fx ? roundGrowth(fx[BIOMASS_ID] ?? 0) : 0;
  items.push({ id: 'biomasa', kind: 'sphere', center: mapPoint(900, 150, 0.9), radius: 0.35 + Math.min(1, mu) * 0.5, color: inp.computed && fx && mu > 0 ? 'ok' : 'line-strong',
    label: inp.computed ? (fx ? `Biomasa: μ = ${fmt(mu, 3)} h⁻¹ (esfera: radio con μ, escala propia)` : 'Biomasa: sin solución factible') : 'Biomasa: sin calcular', tag: inp.computed && fx ? `μ ${fmt(mu, 3)}` : 'μ' });
  // Rótulos de los cinco mayores flujos del mapa.
  const top = [...active].sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).slice(0, 5);
  top.forEach((t, i) => {
    const col = items.find((it) => it.id === `col-${t.r}`);
    if (col && col.kind === 'box') Object.assign(col, { label: `${t.r}: ${fmt(Math.abs(roundFlux(t.v)), 2)} mmol/gDW/h${i === 0 ? ' (el mayor del mapa)' : ''}`, tag: `${t.r} ${fmt(Math.abs(roundFlux(t.v)), 1)}` });
  });

  const n = MAP_EDGES.length;
  let description: string;
  if (!inp.computed) {
    description = `Célula esquemática de E. coli en 3D con el mapa del metabolismo central (${n} reacciones del modelo e_coli_core) acostado en el piso. Aún no hay flujos: pulsa «Calcular el óptimo».`;
  } else if (!fx) {
    description = `Célula esquemática de E. coli en 3D: la condición no tiene solución factible, así que no hay flujos ni crecimiento. Las reacciones rojas son las apagadas por las eliminaciones${inp.disabled.length ? ` (${inp.disabled.join(', ')})` : ''}.`;
  } else {
    const ex = (id: string) => fx[id] ?? 0;
    const exTxt = Object.keys(MAP_NODES).filter((m) => m.endsWith('_e')).map((m) => ({ m, v: ex(`EX_${m}`) })).filter((x) => Math.abs(x.v) > 1e-3)
      .map((x) => `${MAP_NODES[x.m].label.toLowerCase()} ${x.v < 0 ? 'entra' : 'sale'} ${fmt(Math.abs(roundFlux(x.v)), 2)}`);
    const energy = MAP_ENERGY.map((id) => `${ENERGY_LABEL[id]} ${fmt(Math.abs(roundFlux(fx[id] ?? 0)), 1)}`).join(', ');
    description = `Célula esquemática de E. coli en 3D con los flujos del FBA ${inp.view === 'referencia' ? 'de la condición de referencia' : 'de la condición actual'} (fuente de carbono: ${inp.carbonLabel.toLowerCase()}; flujos en mmol/gDW/h): crecimiento μ = ${fmt(mu, 4)} h⁻¹. `
      + `${active.length} de ${n} reacciones del mapa llevan flujo; flechas con grosor ∝ √|flujo| y columnas con altura ∝ |flujo|. Los mayores: ${top.map((t) => `${t.r} ${fmt(Math.abs(roundFlux(t.v)), 2)}`).join(', ')}. `
      + `${exTxt.length ? `Intercambios: ${exTxt.join('; ')}. ` : ''}Energía: ${energy}.`
      + (inp.disabled.length ? ` Apagadas por las eliminaciones (rojas): ${inp.disabled.join(', ')}.` : '');
  }
  return { items, extent: 11.5, target: [0, 1.2, 0], narrow: { extent: 14, target: [0, 1.2, 0] }, description, active };
}

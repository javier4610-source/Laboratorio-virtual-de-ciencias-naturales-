/**
 * «mezclas» (lote 3D-6): el montaje de separación en 3D, en centímetros. Funciones PURAS con el MISMO estado del modelo
 * (src/models/mixtures.ts → applyMethod, el `MixtureState` del banco):
 *   - el vaso principal con lo que sigue en la mezcla (`vessel`) y su agua (`water`): la sal se dibuja disuelta en toda el
 *     agua cuando el modelo dice que se agregó agua; lo que flota (aserrín, aceite) arriba y lo que se hunde (arena,
 *     hierro) en el fondo, con las mismas propiedades de COMPONENTS;
 *   - cada fracción separada (`separated`, en el mismo orden del banco) en la herramienta de su técnica: el imán con lo que
 *     atrajo, el embudo con papel filtro con el residuo, el embudo de decantación con la capa separada y la cápsula de
 *     evaporación con el residuo sólido;
 *   - el número de partículas de cada componente es proporcional a su masa en ese lugar (PER_G partículas por gramo).
 * Dibujo: formas de las herramientas, alturas de las capas y posición de cada partícula.
 */
import { fmt } from '../../lib/format';
import { COMPONENTS, type ComponentId, type Masses, type MethodId, type MixtureState } from '../../models/mixtures';
import type { SceneItem, Vec3 } from '../../three/scene';
import { cylinderPoints, stackedCone } from './common';

/** Partículas dibujadas por gramo de componente (tope MAX_P por lugar). */
export const PER_G = 3;
export const MAX_P = 60;
/** Radio interior del vaso principal (cm); el agua sube 1 cm por cada π·r² ≈ 50 g (1 g de agua ≈ 1 cm³, dibujo). */
export const BEAKER_R = 4;
const BX = -20, BEAKER_H = 11, FLOOR = 0.3;
/** Fracciones que se dibujan (las últimas); la descripción las nombra todas. */
export const MAX_SLOTS = 8;

const P_RADIUS: Record<ComponentId, number> = { hierro: 0.2, arena: 0.2, sal: 0.15, aserrin: 0.26, aceite: 0.22 };
const SHORT: Record<ComponentId, string> = { hierro: 'hierro', arena: 'arena', sal: 'sal', aserrin: 'aserrín', aceite: 'aceite' };
const TOOL: Record<MethodId, string> = { iman: 'Imán', filtracion: 'Papel filtro', decantacion: 'Embudo de decantación', evaporacion: 'Cápsula de evaporación', agua: 'Agua' };

/** Partículas que se dibujan para `mass` gramos. */
export const particleCount = (mass: number) => (mass > 0.005 ? Math.min(MAX_P, Math.max(1, Math.round(mass * PER_G))) : 0);

/** Altura (cm) del agua en el vaso principal para `water` gramos. */
export const waterLevel = (water: number) => (water > 0 ? FLOOR + water / (Math.PI * BEAKER_R * BEAKER_R) : FLOOR);

/** Posición de la fracción número `slot` (0, 1, 2…) entre las que se dibujan. */
export function slotCenter(slot: number): Vec3 {
  return [-7 + (slot % 4) * 8.5, 0, slot < 4 ? 1 : -9];
}

export interface MixturesSceneInput {
  state: MixtureState;
  /** Último método aplicado (para la llama de la evaporación). */
  last: MethodId | null;
}

const massText = (m: Masses) => COMPONENTS.filter((c) => m[c.id] > 0.005).map((c) => `${SHORT[c.id]} ${fmt(m[c.id], 1)} g`).join(', ');

export function mixturesScene({ state, last }: MixturesSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; counts: { where: string; id: ComponentId; n: number }[] } {
  const v = state.vessel;
  const wet = state.water > 0;
  const hw = waterLevel(state.water);
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [-2, -0.02, -3], size: [62, 34], color: 'surface-3' },
    { id: 'vaso', kind: 'rod', from: [BX, 0, 0], to: [BX, BEAKER_H, 0], radius: BEAKER_R + 0.15, color: 'line-strong', opacity: 0.16, label: 'Vaso con la mezcla' },
  ];
  if (wet) items.push({ id: 'agua', kind: 'rod', from: [BX, FLOOR, 0], to: [BX, hw, 0], radius: BEAKER_R, color: '#5aa9de', opacity: v.sal > 0.005 ? 0.42 : 0.32, label: `Agua: ${fmt(state.water, 0)} g` });
  const counts: { where: string; id: ComponentId; n: number }[] = [];
  const labelled = new Set<ComponentId>();
  const push = (where: string, id: ComponentId, mass: number, pts: (n: number) => Vec3[], extraLabel?: string) => {
    const n = particleCount(mass);
    counts.push({ where, id, n });
    if (!n) return;
    const c = COMPONENTS.find((x) => x.id === id)!;
    const label = extraLabel ?? (labelled.has(id) ? undefined : c.name);
    if (!extraLabel) labelled.add(id);
    items.push({ id: `${where}-${id}`, kind: 'particles', points: pts(n), radius: P_RADIUS[id], color: c.color as `#${string}`, ...(label ? { label } : {}) });
  };
  // Vaso principal: lo que se hunde abajo, lo que flota arriba, la sal disuelta en toda el agua.
  const r = BEAKER_R - 0.4;
  const bottomTop = FLOOR + 0.9;
  push('vaso', 'arena', v.arena, (n) => cylinderPoints(n, [BX, 0, 0], r, FLOOR + 0.1, bottomTop - 0.2, 11));
  push('vaso', 'hierro', v.hierro, (n) => cylinderPoints(n, [BX, 0, 0], r, FLOOR + 0.2, bottomTop, 21));
  if (wet) push('vaso', 'sal', v.sal, (n) => cylinderPoints(n, [BX, 0, 0], r, FLOOR + 0.3, hw - 0.2, 31), labelled.has('sal') ? undefined : 'Sal disuelta');
  else push('vaso', 'sal', v.sal, (n) => cylinderPoints(n, [BX, 0, 0], r, FLOOR + 0.1, bottomTop, 31));
  const oilTop = hw + (v.aceite > 0.005 ? 0.7 : 0);
  if (wet) {
    push('vaso', 'aceite', v.aceite, (n) => cylinderPoints(n, [BX, 0, 0], r, hw + 0.05, oilTop, 41));
    push('vaso', 'aserrin', v.aserrin, (n) => cylinderPoints(n, [BX, 0, 0], r, oilTop - 0.15, oilTop + 0.15, 51));
  } else {
    push('vaso', 'aceite', v.aceite, (n) => cylinderPoints(n, [BX, 0, 0], r, FLOOR + 0.1, bottomTop, 41));
    push('vaso', 'aserrin', v.aserrin, (n) => cylinderPoints(n, [BX, 0, 0], r, bottomTop - 0.2, bottomTop + 0.4, 51));
  }

  // Fracciones separadas, cada una en la herramienta de su técnica.
  const first = Math.max(0, state.separated.length - MAX_SLOTS);
  state.separated.slice(first).forEach((f, k) => {
    const i = first + k;
    const [x, , z] = slotCenter(k);
    const id = `f${i}`;
    const name = `${i + 1}. ${TOOL[f.method]}`;
    let zone: { y0: number; y1: number; r: number; at: Vec3 }[];
    if (f.method === 'iman') {
      items.push({ id: `${id}-a`, kind: 'rod', from: [x - 1.1, 3.6, z], to: [x - 1.1, 7.2, z], radius: 0.42, color: '#d23c35', label: name });
      items.push({ id: `${id}-b`, kind: 'rod', from: [x + 1.1, 3.6, z], to: [x + 1.1, 7.2, z], radius: 0.42, color: '#d23c35' });
      items.push({ id: `${id}-c`, kind: 'rod', from: [x - 1.1, 7.2, z], to: [x + 1.1, 7.2, z], radius: 0.42, color: '#d23c35' });
      items.push({ id: `${id}-pa`, kind: 'rod', from: [x - 1.1, 3, z], to: [x - 1.1, 3.6, z], radius: 0.44, color: '#b9c3c6' });
      items.push({ id: `${id}-pb`, kind: 'rod', from: [x + 1.1, 3, z], to: [x + 1.1, 3.6, z], radius: 0.44, color: '#b9c3c6' });
      zone = [{ y0: 2.4, y1: 3.1, r: 0.55, at: [x - 1.1, 0, z] }, { y0: 2.4, y1: 3.1, r: 0.55, at: [x + 1.1, 0, z] }];
    } else if (f.method === 'filtracion') {
      items.push({ id: `${id}-soporte`, kind: 'rod', from: [x + 3, 0, z], to: [x + 3, 8.5, z], radius: 0.18, color: 'line-strong' });
      items.push({ id: `${id}-aro`, kind: 'rod', from: [x + 3, 7.4, z], to: [x + 2.2, 7.4, z], radius: 0.12, color: 'line-strong' });
      items.push(...stackedCone(`${id}-embudo`, x, z, 4, 7.6, 0.3, 2.4, 'line-strong', 6, 0.18));
      items.push({ id: `${id}-tubo`, kind: 'rod', from: [x, 2.2, z], to: [x, 4, z], radius: 0.25, color: 'line-strong', opacity: 0.25 });
      items.push(...stackedCone(`${id}-papel`, x, z, 4.6, 7.3, 0.3, 2.1, '#f6f3ea', 4, 0.75).map((it, j) => (j === 0 ? { ...it, label: name } : it)));
      zone = [{ y0: 4.8, y1: 5.9, r: 0.7, at: [x, 0, z] }];
    } else if (f.method === 'decantacion') {
      items.push({ id: `${id}-soporte`, kind: 'rod', from: [x + 3, 0, z], to: [x + 3, 10, z], radius: 0.18, color: 'line-strong' });
      items.push({ id: `${id}-bulbo`, kind: 'ellipsoid', center: [x, 7, z], radii: [1.9, 2.4, 1.9], color: 'line-strong', opacity: 0.18, label: name });
      items.push({ id: `${id}-tallo`, kind: 'rod', from: [x, 2.4, z], to: [x, 4.8, z], radius: 0.2, color: 'line-strong', opacity: 0.3 });
      items.push({ id: `${id}-llave`, kind: 'box', center: [x, 3.6, z], size: [1.2, 0.3, 0.3], color: '#3a7bd5' });
      zone = [{ y0: 5.6, y1: 7.6, r: 1.2, at: [x, 0, z] }];
    } else {
      items.push({ id: `${id}-pata1`, kind: 'rod', from: [x - 1.8, 0, z - 1], to: [x - 1.5, 2.8, z - 0.8], radius: 0.1, color: '#4a5356' });
      items.push({ id: `${id}-pata2`, kind: 'rod', from: [x + 1.8, 0, z - 1], to: [x + 1.5, 2.8, z - 0.8], radius: 0.1, color: '#4a5356' });
      items.push({ id: `${id}-pata3`, kind: 'rod', from: [x, 0, z + 1.9], to: [x, 2.8, z + 1.6], radius: 0.1, color: '#4a5356' });
      items.push({ id: `${id}-capsula`, kind: 'ellipsoid', center: [x, 3.2, z], radii: [2.1, 0.5, 2.1], color: '#efeae0', label: name });
      if (last === 'evaporacion' && i === state.separated.length - 1) items.push(...stackedCone(`${id}-llama`, x, z, 0.6, 2.4, 0.5, 0.05, '#4d7dff', 4, 0.7));
      zone = [{ y0: 3.55, y1: 3.85, r: 1.4, at: [x, 0, z] }];
    }
    COMPONENTS.forEach((c, ci) => {
      push(id, c.id, f.masses[c.id], (n) => {
        // Reparte las partículas entre las zonas de la herramienta (los dos polos del imán).
        const per = Math.ceil(n / zone.length);
        return zone.flatMap((zz, zi) => cylinderPoints(Math.min(per, n - zi * per), zz.at, zz.r, zz.y0, zz.y1, 100 + i * 17 + ci * 5 + zi));
      });
    });
  });

  const inVessel = massText(v);
  const fractions = state.separated.map((f, i) => `${i + 1}) ${f.label.toLowerCase()}: ${massText(f.masses) || 'nada'}${f.water > 0 ? ` y ${fmt(f.water, 1)} g de agua` : ''}`);
  const description = `Montaje de separación en 3D. Vaso principal: ${inVessel ? inVessel : 'sin sólidos'}${wet ? `, con ${fmt(state.water, 0)} g de agua${v.sal > 0.005 ? ' (la sal está disuelta, repartida en toda el agua)' : ''}${v.aceite > 0.005 || v.aserrin > 0.005 ? '; arriba flota lo menos denso' : ''}${v.arena > 0.005 || v.hierro > 0.005 ? '; en el fondo, lo que se hunde' : ''}` : ', sin agua'}. `
    + (state.separated.length
      ? `Fracciones separadas (${state.separated.length}${state.separated.length > MAX_SLOTS ? `; se dibujan las últimas ${MAX_SLOTS}` : ''}): ${fractions.join('; ')}.`
      : 'Aún no se ha separado nada: aplica una técnica y su herramienta aparecerá con lo que separó.')
    + ` Cada partícula representa ${fmt(1 / PER_G, 2)} g.`;
  return { items, extent: 13, target: [-6, 4, -3], description, counts };
}

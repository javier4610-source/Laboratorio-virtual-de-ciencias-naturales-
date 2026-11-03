/**
 * «conductores» (lote 3D-4): vista ampliada de la muestra que está entre los caimanes. Funciones PURAS con el MISMO
 * resultado del modelo (src/models/conductors.ts → testSample): material, clasificación (conductor, conductor débil,
 * aislante), fracción de corriente I/I_cc y brillo del bombillo.
 *   - Sólidos: red de iones del material (color real). Si el modelo lo clasifica como conductor, hay electrones LIBRES
 *     (uno por ion, dibujo) que, con el circuito cerrado, avanzan hacia el caimán conectado al polo +; si es aislante, los
 *     electrones están LIGADOS a sus iones y no avanzan.
 *   - Líquidos: agua (puntos tenues) con iones positivos y negativos en las MISMAS cantidades ilustrativas del banco
 *     (0, 6 o 28); con el circuito cerrado, los positivos van hacia el electrodo − y los negativos hacia el +.
 *   - Rapidez de las cargas proporcional a I/I_cc del modelo (1 = caimanes unidos = 0,8 unidades por segundo): en el agua de
 *     la llave es unas mil veces menor y no se nota, que es justo lo que dice la medición.
 */
import { fmt, fmtSig } from '../../lib/format';
import { CLASS_LABELS, type ConductorResult } from '../../models/conductors';
import type { SceneItem, Vec3 } from '../../three/scene';
import { bulb, seeds, wireRods } from './elec3d';

export const FULL_SPEED = 0.8;
/** Iones dibujados en cada líquido: los mismos del banco 2D (solo como idea, no la cantidad real). */
export const LIQUID_IONS: Record<string, number> = { destilada: 0, llave: 6, salada: 28 };
const BOX = { x0: -1.3, x1: 1.9, y0: 0.25, y1: 1.15, z0: -0.45, z1: 0.45 };
const CX = (BOX.x0 + BOX.x1) / 2, CY = (BOX.y0 + BOX.y1) / 2;

/** Rapidez dibujada de las cargas libres (unidades/s). */
export const chargeSpeed = (r: Pick<ConductorResult, 'currentFraction'>) => FULL_SPEED * Math.max(0, Math.min(1, r.currentFraction));

const wrap = (x: number, lo: number, hi: number) => { const L = hi - lo; return lo + ((((x - lo) % L) + L) % L); };

export interface ConductorSceneInput {
  res: ConductorResult;
  /** Circuito cerrado (midiendo o medido). */
  closed: boolean;
  /** Brillo del bombillo que dibuja el banco (0–1). */
  glow: number;
  t: number;
}

export function conductorScene(inp: ConductorSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; free: number; bound: number; speed: number } {
  const { res, closed } = inp;
  const s = res.sample;
  const speed = closed ? chargeSpeed(res) : 0;
  const drift = speed * inp.t;
  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [0, -0.01, 0.3], size: [6.4, 2.4], color: 'surface-3' },
    { id: 'lupa', kind: 'box', center: [CX, CY, 0], size: [BOX.x1 - BOX.x0, BOX.y1 - BOX.y0, BOX.z1 - BOX.z0], color: 'line-strong', opacity: 0.12, edges: true },
  ];
  let free = 0, bound = 0;
  const conductor = res.classification === 'conductor';
  if (s.kind === 'barra') {
    const ions: Vec3[] = [];
    const nx = 9, ny = 3, nz = 3;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
      ions.push([BOX.x0 + 0.18 + (i * (BOX.x1 - BOX.x0 - 0.36)) / (nx - 1), BOX.y0 + 0.15 + (j * (BOX.y1 - BOX.y0 - 0.3)) / (ny - 1), BOX.z0 + 0.15 + (k * (BOX.z1 - BOX.z0 - 0.3)) / (nz - 1)]);
    }
    items.push({ id: 'iones', kind: 'particles', points: ions, radius: 0.1, color: s.color as `#${string}`, label: conductor ? 'iones' : 'átomos' });
    if (conductor) {
      // Electrones libres: uno por ion, en posiciones estables entre los iones; con el circuito cerrado avanzan hacia +x.
      const pts = seeds(ions.length, 21).map(({ p }) => [wrap(BOX.x0 + p[0] * (BOX.x1 - BOX.x0) + drift, BOX.x0, BOX.x1), BOX.y0 + 0.05 + p[1] * (BOX.y1 - BOX.y0 - 0.1), BOX.z0 + 0.05 + p[2] * (BOX.z1 - BOX.z0 - 0.1)] as Vec3);
      free = pts.length;
      items.push({ id: 'electrones', kind: 'particles', points: pts, radius: 0.045, color: 'info', label: 'e⁻ libres' });
    } else {
      // Electrones ligados: dos junto a cada átomo, siempre en su lugar.
      const pts: Vec3[] = [];
      ions.forEach((p, i) => { const a = i * 2.4; pts.push([p[0] + 0.13 * Math.cos(a), p[1] + 0.13 * Math.sin(a), p[2]], [p[0] - 0.13 * Math.cos(a), p[1] - 0.13 * Math.sin(a), p[2]]); });
      bound = pts.length;
      items.push({ id: 'electrones', kind: 'particles', points: pts, radius: 0.04, color: 'info', label: 'e⁻ ligados' });
    }
  } else if (s.kind === 'liquido') {
    items.push({ id: 'agua', kind: 'particles', points: seeds(40, 5).map(({ p }) => [BOX.x0 + 0.1 + p[0] * (BOX.x1 - BOX.x0 - 0.2), BOX.y0 + 0.05 + p[1] * (BOX.y1 - BOX.y0 - 0.1), BOX.z0 + 0.05 + p[2] * (BOX.z1 - BOX.z0 - 0.1)] as Vec3), radius: 0.06, color: 'series-5', opacity: 0.35 });
    const n = LIQUID_IONS[s.id] ?? 0;
    const ss = seeds(n, 9);
    const cat: Vec3[] = [], an: Vec3[] = [];
    ss.forEach(({ p }, i) => {
      const base = BOX.x0 + 0.25 + p[0] * (BOX.x1 - BOX.x0 - 0.5);
      const pos = i % 2 === 0;
      // Los positivos van hacia el electrodo − (x0) y los negativos hacia el + (x1).
      const x = wrap(base + (pos ? -drift : drift), BOX.x0 + 0.2, BOX.x1 - 0.2);
      (pos ? cat : an).push([x, BOX.y0 + 0.08 + p[1] * (BOX.y1 - BOX.y0 - 0.16), BOX.z0 + 0.08 + p[2] * (BOX.z1 - BOX.z0 - 0.16)]);
    });
    free = n;
    if (cat.length) items.push({ id: 'iones-pos', kind: 'particles', points: cat, radius: 0.08, color: 'series-4', label: 'iones +' });
    if (an.length) items.push({ id: 'iones-neg', kind: 'particles', points: an, radius: 0.08, color: 'series-3', label: 'iones −' });
    items.push({ id: 'electrodo-neg', kind: 'box', center: [BOX.x0 + 0.06, CY, 0], size: [0.06, BOX.y1 - BOX.y0, 0.6], color: 'series-8' });
    items.push({ id: 'electrodo-pos', kind: 'box', center: [BOX.x1 - 0.06, CY, 0], size: [0.06, BOX.y1 - BOX.y0, 0.6], color: 'series-8' });
  } else {
    items.push({ id: 'aire', kind: 'particles', points: seeds(10, 7).map(({ p }) => [BOX.x0 + 0.2 + p[0] * (BOX.x1 - BOX.x0 - 0.4), BOX.y0 + 0.1 + p[1] * 0.7, BOX.z0 + 0.1 + p[2] * 0.7] as Vec3), radius: 0.07, color: 'ink-3', opacity: 0.6, label: 'aire' });
  }

  // Caimanes en los extremos y el resto del circuito (pila y bombillo) delante, en la mesa.
  const L: Vec3 = [BOX.x0 - 0.12, CY, 0], R: Vec3 = [BOX.x1 + 0.12, CY, 0];
  const clipR: Vec3 = closed ? R : [R[0] + 0.35, CY + 0.3, 0];
  items.push({ id: 'caiman-neg', kind: 'box', center: L, size: [0.24, 0.16, 0.22], color: '#263238', label: '−' });
  items.push({ id: 'caiman-pos', kind: 'box', center: clipR, size: [0.24, 0.16, 0.22], color: '#d32f2f', label: '+' });
  items.push(...wireRods('cable-neg', [L, [L[0], 0.03, 0], [L[0], 0.03, 1.0], [-1.6, 0.03, 1.0]], 0.03, '#263238'));
  items.push({ id: 'pila', kind: 'rod', from: [-1.6, 0.14, 1.0], to: [0.0, 0.14, 1.0], radius: 0.13, color: '#2b3133', label: res.voltage > 2 ? 'Pilas' : 'Pila' });
  items.push({ id: 'pila-mas', kind: 'rod', from: [0.0, 0.14, 1.0], to: [0.25, 0.14, 1.0], radius: 0.135, color: '#c46f22' });
  items.push(...wireRods('cable-pos', [[0.25, 0.03, 1.0], [1.0, 0.03, 1.0]], 0.03, '#d32f2f'));
  items.push(...bulb('bombillo', [1.15, 0, 1.0], 0.22, inp.glow, 'Bombillo'));
  items.push(...wireRods('cable-bombillo', [[1.3, 0.03, 1.0], [clipR[0], 0.03, 1.0], [clipR[0], 0.03, 0], clipR], 0.03, '#d32f2f'));

  const kindText = s.kind === 'barra' ? 'barra' : s.kind === 'liquido' ? 'celda con el líquido' : 'separación de aire';
  let description = `Vista ampliada (dibujo) de la ${kindText}: ${s.name.toLowerCase()} entre los caimanes, con ${fmt(res.voltage, 1)} V. Según el modelo es ${CLASS_LABELS[res.classification].toLowerCase()}. `;
  if (s.kind === 'barra') description += conductor
    ? 'Entre sus iones hay electrones libres (puntos azules) que se pueden mover por todo el material. '
    : 'Sus electrones están ligados a los átomos (puntos azules junto a cada uno): no tiene cargas libres que avancen. ';
  else if (s.kind === 'liquido') description += (LIQUID_IONS[s.id] ?? 0) > 0 ? `El agua tiene iones disueltos (${LIQUID_IONS[s.id]} dibujados, solo como idea): positivos (morados) y negativos (verdes). ` : 'El agua destilada casi no tiene iones disueltos: no hay cargas que se muevan. ';
  else description += 'El aire casi no tiene cargas libres. ';
  if (!closed) description += 'Circuito abierto: ninguna carga avanza.';
  else if (speed <= 0 || res.currentFraction < 1e-6) description += 'Circuito cerrado, pero la corriente es prácticamente nula: nada avanza y el bombillo no se enciende.';
  else description += `Circuito cerrado: ${s.kind === 'liquido' ? 'los iones positivos avanzan hacia el electrodo − y los negativos hacia el +' : 'los electrones avanzan hacia el caimán del polo +'} con una rapidez proporcional a la corriente: ${fmtSig(res.currentFraction * 100, 2)} % de la que pasaría con los caimanes unidos${res.currentFraction < 0.01 ? ', tan lenta que no se nota' : ''}. El bombillo ${res.visible ? `brilla al ${fmt(res.brightness, 1)} %` : 'no se ve encendido'}.`;
  return { items, extent: 2.3, target: [0.2, 0.5, 0.35], description, free, bound, speed };
}

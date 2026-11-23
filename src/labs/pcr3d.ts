/**
 * PCR y electroforesis en 3D (kit src/three), con el MISMO modelo del laboratorio (src/models/pcr.ts).
 *
 * - Ciclo de la PCR: un tramo de doble hélice (esferas en dos hebras y peldaños entre ellas) que en la
 *   DESNATURALIZACIÓN se separa, en el ALINEAMIENTO recibe los dos cebadores en sus extremos (cada uno en la hebra
 *   que le es complementaria) y en la EXTENSIÓN copia cada hebra desde el cebador; el contador muestra las copias del
 *   modelo. Es un tramo corto y sin escala: no se dibujan los cientos de pares de bases del producto.
 * - Gel de agarosa: carriles con el marcador de tamaños (escalera de 100 pb de NEB) y el producto; cada banda baja
 *   la distancia del modelo d = a − b·log₁₀(pb) multiplicada por el avance de la corrida. El brillo de las bandas es
 *   ilustrativo.
 */
import { fmt, fmtSig } from '../lib/format';
import { LADDER_100BP, migration, GEL } from '../models/pcr';
import type { SceneItem, Vec3 } from '../three/scene';

export const N_BP = 16; // pares de bases dibujados (tramo ilustrativo)
const RISE = 0.17, R_HELIX = 0.28, TURN = (2 * Math.PI) / 10;

export type PcrPhase = 'nativo' | 'desnaturalizacion' | 'alineamiento' | 'extension';
export interface HelixInput { phase: PcrPhase; extension: number; primersBind: boolean; cycle: number; copies: number }

/** Posición de la base i de la hebra s (0 arriba, 1 abajo) con una separación vertical `gap`. */
function base(i: number, s: 0 | 1, gap: number): Vec3 {
  const a = i * TURN + (s ? Math.PI : 0);
  const x = (i - (N_BP - 1) / 2) * RISE;
  return [x, R_HELIX * Math.cos(a) + (s ? -gap : gap), R_HELIX * Math.sin(a)];
}

export function helixScene({ phase, extension, primersBind, cycle, copies }: HelixInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const open = phase !== 'nativo';
  const gap = open ? 0.55 : 0;
  const top: Vec3[] = [], bottom: Vec3[] = [];
  for (let i = 0; i < N_BP; i++) { top.push(base(i, 0, gap)); bottom.push(base(i, 1, gap)); }
  const items: SceneItem[] = [
    { id: 'hebra-arriba', kind: 'particles', points: top, radius: 0.07, color: 'series-2', label: 'hebra molde de arriba (5′ → 3′)', tag: 'hebra molde' },
    { id: 'hebra-abajo', kind: 'particles', points: bottom, radius: 0.07, color: 'series-5', label: 'hebra molde de abajo (3′ → 5′)', tag: '' },
  ];
  if (!open) for (let i = 0; i < N_BP; i += 1) items.push({ id: `par-${i}`, kind: 'rod', from: top[i], to: bottom[i], radius: 0.025, color: 'line-strong', opacity: 0.8, label: i === 0 ? 'pares de bases (puentes de hidrógeno)' : undefined, tag: '' });
  const P = 4; // nucleótidos de cada cebador dibujados
  const newTop: Vec3[] = [], newBottom: Vec3[] = [];
  if (open && phase !== 'desnaturalizacion' && primersBind) {
    // Cebador directo: se une a la hebra de abajo en el extremo izquierdo y se extiende hacia la derecha.
    // Cebador reverso: se une a la hebra de arriba en el extremo derecho y se extiende hacia la izquierda.
    const len = phase === 'extension' ? P + Math.round((N_BP - P) * extension) : P;
    for (let i = 0; i < len; i++) {
      const b = base(i, 1, gap); newBottom.push([b[0], b[1] + 0.22, b[2]]);
      const t = base(N_BP - 1 - i, 0, gap); newTop.push([t[0], t[1] - 0.22, t[2]]);
    }
    items.push({ id: 'cebador-directo', kind: 'particles', points: newBottom.slice(0, P), radius: 0.075, color: 'data', label: 'cebadores unidos', tag: 'cebador' });
    items.push({ id: 'cebador-reverso', kind: 'particles', points: newTop.slice(0, P), radius: 0.075, color: 'data', tag: '' });
    if (newBottom.length > P) {
      items.push({ id: 'copia-abajo', kind: 'particles', points: newBottom.slice(P), radius: 0.065, color: 'series-3', label: 'hebras nuevas que copia la polimerasa Taq', tag: 'hebra nueva' });
      items.push({ id: 'copia-arriba', kind: 'particles', points: newTop.slice(P), radius: 0.065, color: 'series-3', tag: '' });
      const tip = newBottom[newBottom.length - 1];
      items.push({ id: 'polimerasa', kind: 'sphere', center: [tip[0] + 0.12, tip[1] + 0.05, tip[2]], radius: 0.14, color: 'series-4', opacity: 0.55, label: 'ADN polimerasa Taq', tag: 'Taq' });
    }
  }
  const T = phase === 'desnaturalizacion' ? '95 °C' : phase === 'alineamiento' ? 'alineamiento' : phase === 'extension' ? '72 °C' : 'antes de empezar';
  const what = phase === 'nativo' ? 'La doble hélice está unida por los pares de bases.'
    : phase === 'desnaturalizacion' ? 'Las dos hebras se separan.'
    : !primersBind ? 'Los cebadores no se unen: la temperatura de alineamiento es demasiado alta o el cebador no es complementario.'
    : phase === 'alineamiento' ? 'Cada cebador se une al extremo de la hebra que le es complementaria.'
    : `La polimerasa copia cada hebra desde el cebador (${fmt(extension * 100, 0)} % del tramo).`;
  const description = `Ciclo ${cycle} de la PCR, ${T}: ${what} Copias del producto en el tubo según el modelo: ${fmtSig(copies, 3)}. El tramo dibujado tiene ${N_BP} pares de bases y no está a escala.`;
  return { items, extent: 1.8, target: [0, 0, 0], description };
}

export interface GelInput { product: number | null; extraBand: number | null; progress: number; productBrightness: number }
/** Gel en el plano horizontal: los pozos están en z = Z0 y las bandas bajan hacia +z. */
export const Z0 = -0.85;
export const K_GEL = 1.6 / GEL.length; // unidades de la escena por mm de gel

export function gelScene({ product, extraBand, progress, productBrightness }: GelInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; bands: { lane: string; bp: number; z: number }[] } {
  const lanes = [{ id: 'marcador', x: -0.6, name: 'marcador de 100 pb' }, { id: 'producto', x: 0.1, name: 'producto de la PCR' }, { id: 'control', x: 0.8, name: 'control sin molde' }];
  const items: SceneItem[] = [
    { id: 'gel', kind: 'box', center: [0.1, -0.06, 0.02], size: [2.2, 0.1, 1.9], color: 'surface-3', opacity: 0.5, label: 'gel de agarosa al 1,5 % (esquema)', tag: '' },
    { id: 'electrodo-neg', kind: 'rod', from: [-1.05, 0.02, Z0 - 0.08], to: [1.25, 0.02, Z0 - 0.08], radius: 0.03, color: 'ink', label: 'polo negativo (los pozos)', tag: '−' },
    { id: 'electrodo-pos', kind: 'rod', from: [-1.05, 0.02, 0.95], to: [1.25, 0.02, 0.95], radius: 0.03, color: 'bad', label: 'polo positivo: el ADN, con carga negativa, avanza hacia él', tag: '+' },
  ];
  for (const l of lanes) items.push({ id: `pozo-${l.id}`, kind: 'box', center: [l.x, 0.0, Z0], size: [0.36, 0.06, 0.06], color: 'ink-3', label: l.id === 'marcador' ? 'pozos' : undefined, tag: l.id === 'marcador' ? 'pozos' : '' });
  const bands: { lane: string; bp: number; z: number }[] = [];
  const addBand = (lane: typeof lanes[number], bp: number, color: SceneItem['color'], opacity: number, label?: string, tag?: string) => {
    const z = Z0 + migration(bp) * K_GEL * progress;
    bands.push({ lane: lane.id, bp, z });
    items.push({ id: `banda-${lane.id}-${bp}`, kind: 'box', center: [lane.x, 0.01, z], size: [0.34, 0.03, 0.035], color, opacity, label, tag });
  };
  if (progress > 0) {
    LADDER_100BP.forEach((bp, i) => addBand(lanes[0], bp, 'info', bp === 500 || bp === 1000 ? 0.95 : 0.7, i === 0 ? 'bandas del marcador (100 a 1517 pb)' : undefined, bp === 500 || bp === 1000 ? `${bp} pb` : ''));
    if (product) addBand(lanes[1], product, 'series-3', Math.max(0.25, Math.min(1, productBrightness)), `producto: ${product} pb`, 'producto');
    if (extraBand) addBand(lanes[1], extraBand, 'series-3', 0.3, `banda inespecífica (ilustrativa): ${extraBand} pb`, 'inespecífica');
  }
  const prod = bands.find((b) => b.lane === 'producto' && b.bp === product);
  const description = progress <= 0
    ? 'Gel de agarosa con tres pozos: marcador de tamaños, producto de la PCR y un control sin molde. Pulsa «Correr el gel» para aplicar el voltaje.'
    : `Gel al ${fmt(progress * 100, 0)} % de la corrida: el ADN, con carga negativa, avanza hacia el polo positivo; las bandas pequeñas avanzan más. `
      + (prod ? `El producto (${product} pb) ha avanzado ${fmt(migration(product!) * progress, 1)} mm.` : 'El carril del producto no tiene bandas: no hubo amplificación.')
      + ' El control sin molde no tiene bandas. El brillo de las bandas es ilustrativo.';
  return { items, extent: 1.6, target: [0.1, 0, 0.05], description, bands };
}

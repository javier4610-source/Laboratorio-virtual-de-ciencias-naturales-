/**
 * Neurona y arco reflejo en 3D (kit src/three). Funciones PURAS con el MISMO estado del laboratorio: el impulso recorre el
 * axón según el avance de la simulación; en una fibra mielínica salta de nodo en nodo de Ranvier (conducción saltatoria) y
 * en una amielínica avanza de forma continua. En el arco reflejo, el impulso avanza con los tiempos del modelo (la fibra
 * sensitiva elegida es la parte lenta). Ilustración sin escala: la neurona real mide de micrómetros a un metro.
 */
import { fmt } from '../lib/format';
import { fiber, reflexArc } from '../models/nervousSystem';
import type { SceneItem, Vec3 } from '../three/scene';

export type NervousView = 'neurona' | 'arco';
const AX0 = -3.5, AX1 = 4.3;
const INTERNODE = 1.18;
/** Nodos de Ranvier dibujados (x de la escena). */
export const NODES = Array.from({ length: Math.floor((AX1 - AX0) / INTERNODE) + 1 }, (_, i) => AX0 + i * INTERNODE);

/** Posición x del frente del impulso: continua (amielínica) o en el último nodo alcanzado (mielínica, saltatoria). */
export function impulseX(progress: number, myelin: boolean): number {
  const x = AX0 + Math.min(1, Math.max(0, progress)) * (AX1 - AX0);
  if (!myelin) return x;
  return NODES.filter((n) => n <= x + 1e-9).pop() ?? AX0;
}

export interface NeuronSceneInput { fiberId: string; progress: number; active: boolean; fired: boolean }
export function neuronScene({ fiberId, progress, active, fired }: NeuronSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const f = fiber(fiberId);
  const items: SceneItem[] = [
    { id: 'soma', kind: 'sphere', center: [-4.2, 0, 0], radius: 0.7, color: 'bio', opacity: 0.85, label: 'cuerpo celular (soma)' },
    { id: 'nucleo', kind: 'sphere', center: [-4.25, 0.1, 0.25], radius: 0.25, color: 'ink-2' },
  ];
  const dirs: Vec3[] = [[-0.6, 0.8, 0.2], [-0.9, 0.1, 0.5], [-0.5, -0.8, -0.3], [-0.2, 0.9, -0.6], [-0.7, -0.4, 0.8], [0.1, -0.9, 0.5]];
  dirs.forEach((d, i) => {
    const a: Vec3 = [-4.2 + d[0] * 0.6, d[1] * 0.6, d[2] * 0.6], b: Vec3 = [-4.2 + d[0] * 1.8, d[1] * 1.8, d[2] * 1.8];
    items.push({ id: `dendrita-${i}`, kind: 'rod', from: a, to: b, radius: 0.07, color: 'bio', label: i === 0 ? 'dendritas' : undefined });
    items.push({ id: `rama-${i}`, kind: 'rod', from: b, to: [b[0] + d[1] * 0.4 - 0.2, b[1] + d[0] * 0.3 + 0.2, b[2] + 0.3], radius: 0.04, color: 'bio' });
  });
  items.push({ id: 'axon', kind: 'rod', from: [AX0 - 0.1, 0, 0], to: [AX1, 0, 0], radius: f.myelin ? 0.09 : 0.06, color: 'ink-3', label: 'axón' });
  if (f.myelin) NODES.slice(0, -1).forEach((x, i) => items.push({ id: `mielina-${i}`, kind: 'ellipsoid', center: [x + INTERNODE / 2, 0, 0], radii: [0.5, 0.24, 0.24], color: '#e8d48b', opacity: 0.9, label: i === 0 ? 'vaina de mielina' : undefined }));
  [[0.6, 0.5, 0.2], [0.7, -0.1, -0.4], [0.6, -0.5, 0.3]].forEach((d, i) => {
    const end: Vec3 = [AX1 + d[0], d[1], d[2]];
    items.push({ id: `terminal-${i}`, kind: 'rod', from: [AX1, 0, 0], to: end, radius: 0.04, color: 'ink-3' });
    items.push({ id: `boton-${i}`, kind: 'sphere', center: end, radius: 0.12, color: 'ink-2', label: i === 0 ? 'terminales (sinapsis)' : undefined });
  });
  items.push({ id: 'musculo', kind: 'ellipsoid', center: [5.6, 0, 0], radii: [0.45, 1.3, 0.7], color: 'series-1', opacity: 0.6, label: 'fibra muscular (efector)' });
  const x = impulseX(progress, f.myelin);
  if (active && fired) {
    if (!f.myelin) items.push({ id: 'zona', kind: 'rod', from: [Math.max(AX0, x - 0.7), 0, 0], to: [x, 0, 0], radius: 0.1, color: 'data', opacity: 0.6 });
    items.push({ id: 'impulso', kind: 'sphere', center: [x, 0, 0], radius: 0.26, color: 'data', label: `impulso (+30 mV)${f.myelin ? ' en un nodo de Ranvier' : ''}` });
  }
  const where = !active ? 'La neurona está en reposo (−70 mV).' : !fired ? 'El estímulo no alcanzó el umbral: no hay impulso que viaje por el axón.'
    : progress >= 1 ? 'El impulso llegó a las terminales y pasa a la fibra muscular por la sinapsis.'
      : `El impulso va al ${fmt(progress * 100, 0)} % del axón${f.myelin ? ', saltando de un nodo de Ranvier al siguiente' : ', avanzando de forma continua'}.`;
  return {
    items, extent: 6.2, target: [0.6, 0, 0],
    description: `Neurona motora con fibra ${f.name} (${f.myelin ? 'con' : 'sin'} vaina de mielina, unos ${fmt(f.v, f.v < 2 ? 1 : 0)} m/s). Dendritas y soma a la izquierda, axón hacia la derecha y fibra muscular al final. ${where}`,
  };
}

/* ------------------------------------------------------------------ arco reflejo */

const P = {
  receptor: [-5, -2.6, 0.4] as Vec3, ganglio: [-1.0, 1.3, 0.7] as Vec3, astaDorsal: [0.2, 1.5, 0.35] as Vec3, inter: [0.5, 1.0, 0] as Vec3,
  astaVentral: [0.2, 0.6, -0.4] as Vec3, salida: [-1.0, 0.4, -0.7] as Vec3, musculo: [-4.2, -1.4, -0.7] as Vec3,
};
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Posición del impulso en el arco reflejo para una fracción del tiempo total (sensitiva, sinapsis, motora). */
export function arcPosition(frac: number, pathM: number, sensory: string): { pos: Vec3; part: 'sensitiva' | 'medula' | 'motora' } {
  const r = reflexArc(pathM, sensory);
  const t = Math.min(1, Math.max(0, frac)) * r.totalMs;
  if (t <= r.afferentMs) {
    const u = t / r.afferentMs;
    return { pos: u < 0.85 ? lerp3(P.receptor, P.ganglio, u / 0.85) : lerp3(P.ganglio, P.astaDorsal, (u - 0.85) / 0.15), part: 'sensitiva' };
  }
  if (t <= r.afferentMs + r.synapticMs) {
    const u = (t - r.afferentMs) / r.synapticMs;
    return { pos: u < 0.5 ? lerp3(P.astaDorsal, P.inter, u * 2) : lerp3(P.inter, P.astaVentral, (u - 0.5) * 2), part: 'medula' };
  }
  const u = (t - r.afferentMs - r.synapticMs) / r.efferentMs;
  return { pos: u < 0.15 ? lerp3(P.astaVentral, P.salida, u / 0.15) : lerp3(P.salida, P.musculo, (u - 0.15) / 0.85), part: 'motora' };
}

export interface ArcSceneInput { pathM: number; sensory: string; progress: number; active: boolean }
export function arcScene({ pathM, sensory, progress, active }: ArcSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const r = reflexArc(pathM, sensory);
  const items: SceneItem[] = [
    { id: 'medula', kind: 'box', center: [0.3, 1.0, 0], size: [1.6, 3.6, 1.8], color: 'ink-3', opacity: 0.18, edges: true, label: 'médula espinal' },
    { id: 'encefalo', kind: 'ellipsoid', center: [0.3, 4.6, 0], radii: [1.4, 0.9, 1.1], color: 'ink-3', opacity: 0.2, label: 'encéfalo' },
    { id: 'via-encefalo', kind: 'rod', from: P.astaDorsal, to: [0.3, 3.8, 0.2], radius: 0.03, color: 'line-strong', opacity: 0.8, label: 'vía hacia el encéfalo (sensación)' },
    { id: 'receptor', kind: 'sphere', center: P.receptor, radius: 0.22, color: 'series-5', label: 'receptor en la piel' },
    { id: 'estimulo', kind: 'arrow', from: [P.receptor[0] - 0.9, P.receptor[1] - 0.9, P.receptor[2]], vector: [0.6, 0.6, 0], radius: 0.05, color: 'data', label: 'estímulo (calor)' },
    { id: 'sensitiva-1', kind: 'rod', from: P.receptor, to: P.ganglio, radius: 0.06, color: 'series-2', label: `neurona sensitiva (${fiber(sensory).name})` },
    { id: 'ganglio', kind: 'sphere', center: P.ganglio, radius: 0.28, color: 'series-2', opacity: 0.8 },
    { id: 'sensitiva-2', kind: 'rod', from: P.ganglio, to: P.astaDorsal, radius: 0.06, color: 'series-2' },
    { id: 'interneurona', kind: 'rod', from: P.astaDorsal, to: P.inter, radius: 0.06, color: 'series-4', label: 'interneurona' },
    { id: 'interneurona-2', kind: 'rod', from: P.inter, to: P.astaVentral, radius: 0.06, color: 'series-4' },
    { id: 'motora-soma', kind: 'sphere', center: P.astaVentral, radius: 0.2, color: 'series-1' },
    { id: 'motora-1', kind: 'rod', from: P.astaVentral, to: P.salida, radius: 0.06, color: 'series-1', label: 'neurona motora (Aα)' },
    { id: 'motora-2', kind: 'rod', from: P.salida, to: P.musculo, radius: 0.06, color: 'series-1' },
    { id: 'musculo', kind: 'ellipsoid', center: [P.musculo[0] - 0.3, P.musculo[1] - 0.3, P.musculo[2]], radii: [0.9, 0.45, 0.45], color: 'series-1', opacity: 0.55, label: 'músculo (retira la mano)' },
  ];
  let state = 'Arco en reposo.';
  if (active) {
    const { pos, part } = arcPosition(progress, pathM, sensory);
    items.push({ id: 'impulso', kind: 'sphere', center: pos, radius: 0.22, color: 'data', label: 'impulso nervioso' });
    state = progress >= 1 ? 'El impulso llegó al músculo, que se contrae y retira la mano.' : `El impulso va por la ${part === 'sensitiva' ? 'neurona sensitiva hacia la médula' : part === 'medula' ? 'médula (sinapsis con la interneurona y la motoneurona)' : 'neurona motora hacia el músculo'}.`;
  }
  return {
    items, extent: 5.6, target: [-1.2, 0.8, 0],
    description: `Arco reflejo de retirada: receptor en la piel, neurona sensitiva (${fiber(sensory).name}) hasta la médula espinal, interneurona, neurona motora y músculo. Con un recorrido de ${fmt(pathM, 2)} m el reflejo tarda ${fmt(r.totalMs, 1)} ms (${fmt(r.afferentMs, 1)} ms de ida, ${fmt(r.synapticMs, 0)} ms en sinapsis y ${fmt(r.efferentMs, 1)} ms de vuelta); la señal también sube al encéfalo, donde se siente el dolor después. ${state}`,
  };
}

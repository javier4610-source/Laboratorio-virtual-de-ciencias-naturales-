/**
 * «Reacción en 3D»: escena de reactivos → productos con átomos mapeados (función pura, sin React).
 *
 * ILUSTRACIÓN EDUCATIVA: la animación interpola entre geometrías calculadas de reactivos y productos; no representa el
 * mecanismo ni la trayectoria real de la reacción (no hay estado de transición, energía ni tiempos reales).
 *
 * Lo que SÍ se calcula y se prueba:
 *  1. La ecuación está balanceada (conteo por elemento con src/models/balancing.ts) y cada término 3D tiene
 *     exactamente los átomos de su fórmula multiplicada por su coeficiente.
 *  2. El mapeo de átomos es una biyección que respeta el elemento: cada átomo de los reactivos es uno y solo uno de
 *     los productos (conservación de los átomos en todo momento de la animación).
 *  3. Las posiciones en t = 0 y t = 1 son exactamente las geometrías de partida (confórmeros, VSEPR o red cristalina),
 *     trasladadas rígidamente para colocarlas lado a lado.
 * Fases (t de 0 a 1): acercamiento de los fragmentos (0–0,3), reorganización de los átomos por interpolación lineal
 * (0,3–0,7; los enlaces de los reactivos se desvanecen y aparecen los de los productos) y separación de los productos (0,7–1).
 */
import { countSides, parseFormula, prettyFormula, type ReactionDef } from '../models/balancing';
import { centroid, elementCounts, extent, type Bond3D, type Species3D, type V3 } from './species';

export const REACTION3D_LABEL = 'Ilustración educativa: interpolación entre geometrías calculadas de reactivos y productos; no representa el mecanismo ni la trayectoria real de la reacción';

export interface ReactionTerm {
  species: Species3D;
  /** Coeficiente estequiométrico de la ecuación balanceada. */
  coef: number;
  /** Fórmula simple (ASCII) del término, p. ej. «H2O» o «MgO». */
  formula: string;
  /** Unidades fórmula que contiene cada copia 3D de la especie (p. ej., 2 si es un fragmento de red con 2 MgO). */
  perInstance?: number;
  /** Nombre en español (para la ecuación leída en voz alta). */
  name?: string;
}

export interface Reaction3DDef {
  id: string;
  title: string;
  reactants: ReactionTerm[];
  products: ReactionTerm[];
  /** Mapeo explícito opcional: mapping[i] = índice del átomo de los productos que corresponde al átomo i de los reactivos. */
  mapping?: number[];
}

interface Instance { term: number; side: 'r' | 'p'; offset: V3; atomStart: number; nAtoms: number }

export interface SceneAtom { el: string; charge: number; /** posición local respecto del centroide de su fragmento */ rLocal: V3; pLocal: V3; rInst: number; pInst: number }

export interface ReactionScene {
  def: Reaction3DDef;
  atoms: SceneAtom[];
  rInstances: Instance[];
  pInstances: Instance[];
  /** Enlaces de los reactivos y de los productos con índices de la escena (numeración de los reactivos). */
  rBonds: Bond3D[];
  pBonds: Bond3D[];
  /** mapping[i] = índice del átomo i dentro de la lista de átomos de los productos. */
  mapping: number[];
  counts: Record<string, number>;
  /** Radio que contiene la escena en t = 0 y t = 1 (Å), para encuadrar el visor. */
  radius: number;
}

/** Fases de la animación y nombres de los pasos discretos (movimiento reducido). */
export const PHASES = { approachEnd: 0.3, rearrangeEnd: 0.7, compress: 0.55 } as const;
export const STEPS: { t: number; name: string }[] = [
  { t: 0, name: 'Reactivos separados' },
  { t: 0.3, name: 'Reactivos juntos' },
  { t: 0.5, name: 'Reorganización de los átomos (ilustrativa)' },
  { t: 0.7, name: 'Productos juntos' },
  { t: 1, name: 'Productos separados' },
];

export function phaseName(t: number): string {
  if (t <= 0) return STEPS[0].name;
  if (t < PHASES.approachEnd) return 'Acercamiento de los reactivos';
  if (t < PHASES.rearrangeEnd) return STEPS[2].name;
  if (t < 1) return 'Separación de los productos';
  return STEPS[4].name;
}

/* ------------------------------------------------------------------ ecuación */

/** ReactionDef de balancing.ts con los coeficientes del término 3D. */
export function toReactionDef(def: Reaction3DDef): ReactionDef {
  const sp = (t: ReactionTerm) => ({ formula: t.formula, name: t.name ?? t.species.name, kind: 'molecula' as const });
  return { id: def.id, name: def.title, level: 1, context: '', reactants: def.reactants.map(sp), products: def.products.map(sp), answer: [...def.reactants, ...def.products].map((t) => t.coef) };
}

/** Comprueba la ecuación (conteo por elemento de balancing.ts). */
export function checkBalanced(def: Reaction3DDef): { balanced: boolean; rows: ReturnType<typeof countSides> } {
  const r = toReactionDef(def);
  const rows = countSides(r, r.answer);
  return { balanced: rows.every((x) => x.diff === 0), rows };
}

/** Texto de la ecuación con coeficientes y subíndices Unicode: «2 H₂ + O₂ → 2 H₂O». */
export function equationText(def: Reaction3DDef): string {
  const side = (ts: ReactionTerm[]) => ts.map((t) => `${t.coef === 1 ? '' : `${t.coef} `}${prettyFormula(t.formula)}`).join(' + ');
  return `${side(def.reactants)} → ${side(def.products)}`;
}

/* ------------------------------------------------------------------ escena */

function instancesOf(terms: ReactionTerm[], side: 'r' | 'p'): { inst: Instance[]; atoms: { el: string; charge: number; local: V3 }[]; bonds: Bond3D[] } {
  const inst: Instance[] = [];
  const atoms: { el: string; charge: number; local: V3 }[] = [];
  const bonds: Bond3D[] = [];
  terms.forEach((t, ti) => {
    const per = t.perInstance ?? 1;
    if (!Number.isInteger(t.coef) || t.coef < 1) throw new RangeError(`El coeficiente de ${t.formula} debe ser un entero positivo.`);
    if (t.coef % per !== 0) throw new RangeError(`El coeficiente de ${t.formula} (${t.coef}) no es múltiplo de las ${per} unidades de cada copia 3D.`);
    // Cada copia 3D debe tener exactamente los átomos de per × fórmula.
    const want = parseFormula(t.formula), have = elementCounts(t.species.atoms);
    const keys = new Set([...Object.keys(want), ...Object.keys(have)]);
    for (const k of keys) if ((want[k] ?? 0) * per !== (have[k] ?? 0)) throw new RangeError(`La especie 3D «${t.species.name}» no tiene los átomos de ${per} × ${t.formula} (${k}: ${have[k] ?? 0} en lugar de ${(want[k] ?? 0) * per}).`);
    const c = centroid(t.species.atoms);
    for (let k = 0; k < t.coef / per; k++) {
      const start = atoms.length;
      for (const a of t.species.atoms) atoms.push({ el: a.el, charge: a.charge ?? 0, local: [a.x - c[0], a.y - c[1], a.z - c[2]] });
      for (const b of t.species.bonds) bonds.push({ a: start + b.a, b: start + b.b, order: b.order });
      inst.push({ term: ti, side, offset: [0, 0, 0], atomStart: start, nAtoms: t.species.atoms.length });
    }
  });
  // Disposición: en fila (hasta 4 copias) o en rejilla, con 1,6 Å de separación entre las esferas que las contienen.
  const radii = inst.map((i) => extent(atoms.slice(i.atomStart, i.atomStart + i.nAtoms).map((a) => ({ x: a.local[0], y: a.local[1], z: a.local[2] }))) + 1.0);
  const cols = inst.length <= 4 ? inst.length : Math.ceil(Math.sqrt(inst.length * 1.6));
  const cell = Math.max(...radii, 1.2) * 2 + 1.6;
  const rows = Math.ceil(inst.length / cols);
  inst.forEach((it, i) => {
    const r = Math.floor(i / cols), col = i % cols;
    const inRow = r === rows - 1 ? inst.length - r * cols : cols;
    it.offset = [(col - (inRow - 1) / 2) * cell, ((rows - 1) / 2 - r) * cell, 0];
  });
  return { inst, atoms, bonds };
}

const d2 = (p: V3, q: V3) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

/** Construye la escena 3D de la reacción con mapeo de átomos (lanza RangeError si no se conservan los átomos). */
export function buildReactionScene(def: Reaction3DDef): ReactionScene {
  const R = instancesOf(def.reactants, 'r');
  const P = instancesOf(def.products, 'p');
  const cr = elementCounts(R.atoms), cp = elementCounts(P.atoms);
  const els = [...new Set([...Object.keys(cr), ...Object.keys(cp)])];
  for (const el of els) if ((cr[el] ?? 0) !== (cp[el] ?? 0)) throw new RangeError(`Los átomos no se conservan: ${el} aparece ${cr[el] ?? 0} veces en los reactivos y ${cp[el] ?? 0} en los productos.`);
  const rPos = R.atoms.map((a, i) => { const it = R.inst.find((x) => i >= x.atomStart && i < x.atomStart + x.nAtoms)!; return [it.offset[0] * PHASES.compress + a.local[0], it.offset[1] * PHASES.compress + a.local[1], a.local[2]] as V3; });
  const pPos = P.atoms.map((a, i) => { const it = P.inst.find((x) => i >= x.atomStart && i < x.atomStart + x.nAtoms)!; return [it.offset[0] * PHASES.compress + a.local[0], it.offset[1] * PHASES.compress + a.local[1], a.local[2]] as V3; });

  let mapping: number[];
  if (def.mapping) {
    mapping = def.mapping;
    if (mapping.length !== R.atoms.length || new Set(mapping).size !== mapping.length || mapping.some((j, i) => !P.atoms[j] || P.atoms[j].el !== R.atoms[i].el)) throw new RangeError('El mapeo explícito no es una biyección que respete los elementos.');
  } else {
    // Mapeo por elemento en orden y mejora local por intercambios (menor desplazamiento total). Determinista.
    mapping = new Array(R.atoms.length).fill(-1);
    for (const el of els) {
      const ri = R.atoms.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0);
      const pj = P.atoms.map((a, j) => (a.el === el ? j : -1)).filter((j) => j >= 0);
      ri.forEach((i, k) => { mapping[i] = pj[k]; });
      for (let pass = 0; pass < 60; pass++) {
        let improved = false;
        for (let x = 0; x < ri.length; x++) for (let y = x + 1; y < ri.length; y++) {
          const i = ri[x], k = ri[y];
          const now = d2(rPos[i], pPos[mapping[i]]) + d2(rPos[k], pPos[mapping[k]]);
          const swp = d2(rPos[i], pPos[mapping[k]]) + d2(rPos[k], pPos[mapping[i]]);
          if (swp < now - 1e-9) { const t = mapping[i]; mapping[i] = mapping[k]; mapping[k] = t; improved = true; }
        }
        if (!improved) break;
      }
    }
  }
  const inv = new Array(P.atoms.length).fill(-1);
  mapping.forEach((j, i) => { inv[j] = i; });
  const instOf = (list: Instance[], i: number) => list.findIndex((x) => i >= x.atomStart && i < x.atomStart + x.nAtoms);
  const atoms: SceneAtom[] = R.atoms.map((a, i) => ({ el: a.el, charge: a.charge, rLocal: a.local, pLocal: P.atoms[mapping[i]].local, rInst: instOf(R.inst, i), pInst: instOf(P.inst, mapping[i]) }));
  const pBonds = P.bonds.map((b) => ({ a: inv[b.a], b: inv[b.b], order: b.order }));
  const scene: ReactionScene = { def, atoms, rInstances: R.inst, pInstances: P.inst, rBonds: R.bonds, pBonds, mapping, counts: cr, radius: 0 };
  const all = [...framePositions(scene, 0), ...framePositions(scene, 1)].map(([x, y, z]) => ({ x, y, z }));
  scene.radius = Math.max(...all.map((p) => Math.hypot(p.x, p.y, p.z))) + 1.5;
  return scene;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

/** Posiciones de los átomos de la escena (numeración de los reactivos) en el instante t ∈ [0, 1]. */
export function framePositions(scene: ReactionScene, t: number): V3[] {
  const tt = clamp01(Number.isFinite(t) ? t : 0);
  const { approachEnd: a, rearrangeEnd: b, compress: k } = PHASES;
  const place = (inst: Instance, local: V3, s: number): V3 => [inst.offset[0] * s + local[0], inst.offset[1] * s + local[1], inst.offset[2] * s + local[2]];
  return scene.atoms.map((at) => {
    const rI = scene.rInstances[at.rInst], pI = scene.pInstances[at.pInst];
    if (tt <= a) return place(rI, at.rLocal, 1 + (k - 1) * smooth(tt / a));
    if (tt >= b) return place(pI, at.pLocal, k + (1 - k) * smooth((tt - b) / (1 - b)));
    const u = smooth((tt - a) / (b - a));
    const p = place(rI, at.rLocal, k), q = place(pI, at.pLocal, k);
    return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
  });
}

export interface FrameBond extends Bond3D { opacity: number; side: 'r' | 'p' }

/** Enlaces visibles en t con su opacidad: los de los reactivos se desvanecen y aparecen los de los productos. */
export function frameBonds(scene: ReactionScene, t: number): FrameBond[] {
  const tt = clamp01(t);
  const mid = (PHASES.approachEnd + PHASES.rearrangeEnd) / 2;
  const rOp = tt <= PHASES.approachEnd ? 1 : tt >= mid ? 0 : 1 - (tt - PHASES.approachEnd) / (mid - PHASES.approachEnd);
  const pOp = tt <= mid ? 0 : tt >= PHASES.rearrangeEnd ? 1 : (tt - mid) / (PHASES.rearrangeEnd - mid);
  const key = (x: Bond3D) => `${Math.min(x.a, x.b)}-${Math.max(x.a, x.b)}-${x.order}`;
  const pKeys = new Set(scene.pBonds.map(key));
  const rKeys = new Set(scene.rBonds.map(key));
  const out: FrameBond[] = [];
  // Un enlace presente en ambos lados (se conserva) se dibuja siempre opaco.
  for (const x of scene.rBonds) out.push({ ...x, side: 'r', opacity: pKeys.has(key(x)) ? 1 : rOp });
  for (const x of scene.pBonds) if (!rKeys.has(key(x))) out.push({ ...x, side: 'p', opacity: pOp });
  return out.filter((x) => x.opacity > 0.01);
}

/** Conteo de átomos por elemento en el instante t (siempre igual: los átomos solo se reorganizan). */
export function countsAt(scene: ReactionScene, t: number): Record<string, number> {
  const pos = framePositions(scene, t);
  return elementCounts(scene.atoms.filter((_, i) => pos[i].every(Number.isFinite)));
}

/** Enlaces que se rompen y que se forman (para el texto y la descripción accesible). */
export function bondChanges(scene: ReactionScene): { broken: number; formed: number; kept: number } {
  const key = (x: Bond3D) => `${Math.min(x.a, x.b)}-${Math.max(x.a, x.b)}`;
  const r = new Set(scene.rBonds.map(key)), p = new Set(scene.pBonds.map(key));
  let kept = 0;
  for (const k of r) if (p.has(k)) kept++;
  return { broken: r.size - kept, formed: p.size - kept, kept };
}

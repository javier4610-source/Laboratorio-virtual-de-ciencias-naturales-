/**
 * Grafo molecular para química orgánica (módulo reutilizable; API documentada en docs/organica/README.md).
 *
 * Representa una molécula como átomos pesados (los hidrógenos son implícitos y se calculan por valencia), enlaces con orden
 * 1, 2 o 3 (los anillos aromáticos se kekulizan al leer) y, opcionalmente, la configuración de los dobles enlaces (cis/trans
 * respecto de dos vecinos de referencia), que es lo que codifican los «/» y «\» de SMILES.
 *
 * Incluye:
 *  - parseSmiles(): lector de SMILES (subconjunto orgánico, átomos entre corchetes con carga e hidrógenos, anillos, ramas,
 *    aromáticos en minúscula con kekulización, estereoquímica de dobles enlaces). No lee quiralidad de centros (@, @@): la ignora
 *    y lo avisa en `warnings`.
 *  - toSmiles(): escritor de SMILES (no canónico) para consultar PubChem.
 *  - hillFormula(), implicitH(), ringInfo(), canonicalKey() (huella invariante para comparar constituciones) y
 *    mapHeavyAtoms() (isomorfismo de grafos para alinear una estructura con los átomos de un SDF).
 * Es un modelo calculado: no consulta servicios ni usa geometría.
 */

export type ElementSymbol = 'C' | 'H' | 'N' | 'O' | 'F' | 'Cl' | 'Br' | 'I' | 'S' | 'P' | 'B' | 'Si';

export interface OAtom {
  el: ElementSymbol;
  /** Carga formal (0 por defecto). */
  charge?: number;
  /** Hidrógenos explícitos (átomos entre corchetes); si falta, se calculan por valencia. */
  hCount?: number;
  /** Pertenecía a un anillo aromático en la entrada (minúsculas en SMILES). */
  aromatic?: boolean;
}

export interface OBond { a: number; b: number; order: 1 | 2 | 3; aromatic?: boolean }

/** Configuración de un doble enlace a=b: el vecino `x` de `a` y el vecino `y` de `b` están del mismo lado (cis) u opuestos (trans). */
export interface DoubleBondStereo { a: number; b: number; x: number; y: number; relation: 'cis' | 'trans' }

export interface OMolecule { atoms: OAtom[]; bonds: OBond[]; stereo: DoubleBondStereo[] }

export class SmilesError extends Error {}

export const ATOMIC_NUMBER: Record<ElementSymbol, number> = { H: 1, B: 5, C: 6, N: 7, O: 8, F: 9, Si: 14, P: 15, S: 16, Cl: 17, Br: 35, I: 53 };
const DEFAULT_VALENCE: Partial<Record<ElementSymbol, number[]>> = { B: [3], C: [4], N: [3, 5], O: [2], F: [1], Cl: [1], Br: [1], I: [1], S: [2, 4, 6], P: [3, 5], Si: [4] };

/* ------------------------------------------------------------------ utilidades del grafo */

export function neighbors(m: OMolecule, i: number): number[] {
  const out: number[] = [];
  for (const b of m.bonds) { if (b.a === i) out.push(b.b); else if (b.b === i) out.push(b.a); }
  return out;
}

export function bondBetween(m: OMolecule, i: number, j: number): OBond | undefined {
  return m.bonds.find((b) => (b.a === i && b.b === j) || (b.a === j && b.b === i));
}

export function bondOrderSum(m: OMolecule, i: number): number {
  let s = 0;
  for (const b of m.bonds) if (b.a === i || b.b === i) s += b.order;
  return s;
}

/** Hidrógenos implícitos de un átomo (los explícitos de los corchetes tienen prioridad). */
export function implicitH(m: OMolecule, i: number): number {
  const at = m.atoms[i];
  if (at.hCount !== undefined) return at.hCount;
  if (at.el === 'H') return 0;
  const used = bondOrderSum(m, i);
  const q = at.charge ?? 0;
  const vals = DEFAULT_VALENCE[at.el] ?? [0];
  // C con carga ±1 usa valencia 3; N⁺ usa 4; O⁻ usa 1.
  const adj = at.el === 'C' ? -Math.abs(q) : at.el === 'N' || at.el === 'P' ? q : at.el === 'O' || at.el === 'S' ? q : -Math.abs(q);
  for (const v of vals) { const h = v + adj - used; if (h >= 0) return h; }
  return 0;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).split('').map((d) => SUB[Number(d)]).join('');

/** Fórmula molecular en orden de Hill (C, H y luego alfabético), como la de PubChem; con `pretty` usa subíndices. */
export function hillFormula(m: OMolecule, pretty = false): string {
  const count: Record<string, number> = {};
  let charge = 0;
  m.atoms.forEach((a, i) => {
    count[a.el] = (count[a.el] ?? 0) + 1;
    const h = implicitH(m, i);
    if (h) count.H = (count.H ?? 0) + h;
    charge += a.charge ?? 0;
  });
  const order = count.C ? ['C', 'H', ...Object.keys(count).filter((e) => e !== 'C' && e !== 'H').sort()] : Object.keys(count).sort();
  const f = order.filter((e) => count[e]).map((e) => e + (count[e] > 1 ? (pretty ? sub(count[e]) : String(count[e])) : '')).join('');
  const q = charge === 0 ? '' : charge > 0 ? (charge > 1 ? `${charge}+` : '+') : (charge < -1 ? `${-charge}-` : '-');
  return f + (pretty ? q.replace('+', '⁺').replace('-', '⁻') : q);
}

/** Anillos simples: base de ciclos (de un árbol de expansión) y pertenencia de átomos y enlaces a algún anillo. */
export function ringInfo(m: OMolecule): { rings: number[][]; atomInRing: boolean[]; bondInRing: boolean[] } {
  const n = m.atoms.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  m.bonds.forEach((b) => { adj[b.a].push(b.b); adj[b.b].push(b.a); });
  const parent = new Array(n).fill(-2);
  const depth = new Array(n).fill(0);
  const rings: number[][] = [];
  const seenEdge = new Set<string>();
  for (let s = 0; s < n; s++) {
    if (parent[s] !== -2) continue;
    parent[s] = -1;
    const stack = [s];
    const order: number[] = [];
    while (stack.length) {
      const u = stack.pop()!;
      order.push(u);
      for (const v of adj[u]) {
        if (parent[v] === -2) { parent[v] = u; depth[v] = depth[u] + 1; stack.push(v); }
      }
    }
    for (const u of order) for (const v of adj[u]) {
      if (parent[v] === u || parent[u] === v) continue;
      const k = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (seenEdge.has(k)) continue;
      seenEdge.add(k);
      // ciclo fundamental: camino u→ancestro común←v
      let a = u, b = v;
      const pa: number[] = [a], pb: number[] = [b];
      while (depth[a] > depth[b]) { a = parent[a]; pa.push(a); }
      while (depth[b] > depth[a]) { b = parent[b]; pb.push(b); }
      while (a !== b) { a = parent[a]; pa.push(a); b = parent[b]; pb.push(b); }
      pb.pop();
      rings.push([...pa, ...pb.reverse()]);
    }
  }
  const atomInRing = new Array(n).fill(false);
  const bondInRing = m.bonds.map(() => false);
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      atomInRing[r[i]] = true;
      const j = r[(i + 1) % r.length];
      const bi = m.bonds.findIndex((b) => (b.a === r[i] && b.b === j) || (b.a === j && b.b === r[i]));
      if (bi >= 0) bondInRing[bi] = true;
    }
  }
  return { rings, atomInRing, bondInRing };
}

export function isConnected(m: OMolecule): boolean {
  if (m.atoms.length === 0) return false;
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) { const u = stack.pop()!; for (const v of neighbors(m, u)) if (!seen.has(v)) { seen.add(v); stack.push(v); } }
  return seen.size === m.atoms.length;
}

/* ------------------------------------------------------------------ lector de SMILES */

const ORGANIC = ['Cl', 'Br', 'B', 'C', 'N', 'O', 'P', 'S', 'F', 'I'];
const AROMATIC_ORGANIC = ['b', 'c', 'n', 'o', 'p', 's'];

export interface ParsedSmiles extends OMolecule { warnings: string[] }

/** Lee un SMILES. Lanza SmilesError con un mensaje en español si la cadena no es válida. */
export function parseSmiles(smiles: string): ParsedSmiles {
  const s = smiles.trim();
  if (!s) throw new SmilesError('El SMILES está vacío.');
  if (s.length > 400) throw new SmilesError('El SMILES es demasiado largo (máximo 400 caracteres).');
  if (s.includes('.')) throw new SmilesError('El SMILES tiene varios fragmentos («.»): escribe una sola molécula.');
  const atoms: OAtom[] = [];
  const bonds: (OBond & { dir?: '/' | '\\'; dirFrom?: number })[] = [];
  const warnings: string[] = [];
  const stack: number[] = [];
  const ringOpen = new Map<number, { atom: number; order?: number; dir?: '/' | '\\'; aromatic?: boolean }>();
  let prev = -1;
  let pendingOrder: number | undefined;
  let pendingDir: '/' | '\\' | undefined;
  let i = 0;
  const addBond = (a: number, b: number, order: number | undefined, dir?: '/' | '\\') => {
    const aromatic = order === undefined && !!atoms[a].aromatic && !!atoms[b].aromatic;
    bonds.push({ a, b, order: (order ?? 1) as 1 | 2 | 3, aromatic: aromatic || order === 4 ? true : undefined, dir, dirFrom: a });
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '(') { if (prev < 0) throw new SmilesError('Rama «(» sin átomo anterior.'); stack.push(prev); i++; continue; }
    if (c === ')') { if (!stack.length) throw new SmilesError('Paréntesis «)» sin abrir.'); prev = stack.pop()!; i++; continue; }
    if (c === '-' ) { pendingOrder = 1; i++; continue; }
    if (c === '=') { pendingOrder = 2; i++; continue; }
    if (c === '#') { pendingOrder = 3; i++; continue; }
    if (c === ':') { pendingOrder = 4; i++; continue; }
    if (c === '/' || c === '\\') { pendingDir = c; pendingOrder = pendingOrder ?? 1; i++; continue; }
    if (/[0-9%]/.test(c)) {
      let num: number;
      if (c === '%') { num = Number(s.slice(i + 1, i + 3)); if (!Number.isFinite(num)) throw new SmilesError('Cierre de anillo «%» mal escrito.'); i += 3; }
      else { num = Number(c); i++; }
      if (prev < 0) throw new SmilesError('Número de anillo sin átomo anterior.');
      const open = ringOpen.get(num);
      if (open) {
        const order = pendingOrder === 4 ? undefined : pendingOrder ?? open.order;
        if (pendingDir || open.dir) warnings.push('Se ignora la dirección «/» o «\\» escrita en un cierre de anillo.');
        addBond(open.atom, prev, order);
        ringOpen.delete(num);
      } else {
        ringOpen.set(num, { atom: prev, order: pendingOrder === 4 ? undefined : pendingOrder, dir: pendingDir });
      }
      pendingOrder = undefined; pendingDir = undefined;
      continue;
    }
    // átomo
    let atom: OAtom | null = null;
    if (c === '[') {
      const end = s.indexOf(']', i);
      if (end < 0) throw new SmilesError('Corchete «[» sin cerrar.');
      const inner = s.slice(i + 1, end);
      const m = /^(\d+)?([A-Z][a-z]?|[bcnops])(@{0,2})(H\d?)?([+-]\d*|[+]{1,3}|[-]{1,3})?(:\d+)?$/.exec(inner);
      if (!m) throw new SmilesError(`No se entiende el átomo [${inner}].`);
      if (m[1]) warnings.push('Se ignoran los isótopos.');
      if (m[3]) warnings.push('Se ignora la quiralidad de los centros (@/@@): el motor no la nombra todavía.');
      const sym = m[2];
      const aromatic = sym === sym.toLowerCase();
      const el = (aromatic ? sym.toUpperCase() : sym) as ElementSymbol;
      if (!(el in ATOMIC_NUMBER)) throw new SmilesError(`Elemento no admitido: ${sym}.`);
      const h = m[4] ? (m[4].length > 1 ? Number(m[4].slice(1)) : 1) : 0;
      let q = 0;
      if (m[5]) { const sign = m[5][0] === '+' ? 1 : -1; const rest = m[5].slice(1); q = sign * (rest === '' ? 1 : /^\d+$/.test(rest) ? Number(rest) : m[5].length); }
      atom = { el, hCount: h, charge: q || undefined, aromatic: aromatic || undefined };
      i = end + 1;
    } else {
      const two = s.slice(i, i + 2);
      if (ORGANIC.includes(two) && two.length === 2) { atom = { el: two as ElementSymbol }; i += 2; }
      else if (ORGANIC.includes(c)) { atom = { el: c as ElementSymbol }; i++; }
      else if (AROMATIC_ORGANIC.includes(c)) { atom = { el: c.toUpperCase() as ElementSymbol, aromatic: true }; i++; }
      else throw new SmilesError(`Carácter inesperado «${c}» en la posición ${i + 1}.`);
    }
    if (atom.el === 'H' && atom.hCount === 0) atom.hCount = 0;
    atoms.push(atom);
    const idx = atoms.length - 1;
    if (prev >= 0) addBond(prev, idx, pendingOrder === 4 ? undefined : pendingOrder, pendingDir);
    pendingOrder = undefined; pendingDir = undefined;
    prev = idx;
  }
  if (stack.length) throw new SmilesError('Falta cerrar un paréntesis.');
  if (ringOpen.size) throw new SmilesError('Hay un anillo sin cerrar.');

  // hidrógenos explícitos como átomos [H] unidos a un pesado → se convierten en hCount
  const mol: OMolecule = { atoms, bonds: bonds.map(({ a, b, order, aromatic }) => ({ a, b, order, aromatic })), stereo: [] };
  kekulize(mol);
  mol.stereo = readStereo(mol, bonds);
  return { ...mol, warnings: [...new Set(warnings)] };
}

/** Asigna dobles enlaces alternos a los átomos aromáticos (emparejamiento perfecto por búsqueda con retroceso). */
function kekulize(m: OMolecule) {
  const arom = m.atoms.map((a) => !!a.aromatic);
  if (!arom.some(Boolean)) return;
  // un átomo aromático necesita doble enlace si su valencia lo permite (C sin carga y con un H o un sustituyente; N piridínico…)
  const needs = m.atoms.map((a, i) => {
    if (!a.aromatic) return false;
    const deg = neighbors(m, i).length;
    const h = a.hCount ?? 0;
    if (a.el === 'C') return (a.charge ?? 0) === 0 && deg + (a.hCount !== undefined ? h : 0) <= 3;
    if (a.el === 'N' || a.el === 'P') return (a.hCount ?? 0) === 0 && (a.charge ?? 0) === 0 ? deg === 2 : (a.charge ?? 0) === 1 && deg + h === 3;
    if (a.el === 'B') return false;
    return false; // o, s: aportan un par
  });
  const aromBonds = m.bonds.map((b, k) => (b.aromatic ? k : -1)).filter((k) => k >= 0);
  const matched = new Set<number>();
  const used = new Array(m.atoms.length).fill(false);
  const atomsToMatch = needs.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  const solve = (idx: number): boolean => {
    while (idx < atomsToMatch.length && used[atomsToMatch[idx]]) idx++;
    if (idx >= atomsToMatch.length) return true;
    const u = atomsToMatch[idx];
    for (const k of aromBonds) {
      const b = m.bonds[k];
      const v = b.a === u ? b.b : b.b === u ? b.a : -1;
      if (v < 0 || used[v] || !needs[v]) continue;
      used[u] = used[v] = true; matched.add(k);
      if (solve(idx + 1)) return true;
      used[u] = used[v] = false; matched.delete(k);
    }
    return false;
  };
  if (!solve(0)) throw new SmilesError('No se pudo kekulizar el anillo aromático (revisa los hidrógenos de los átomos entre corchetes, p. ej. [nH]).');
  for (const k of aromBonds) m.bonds[k].order = matched.has(k) ? 2 : 1;
  // los átomos aromáticos sin H explícitos ahora tienen la valencia correcta; se fija su hCount si venían entre corchetes
}

function readStereo(m: OMolecule, raw: { a: number; b: number; order: number; dir?: '/' | '\\'; dirFrom?: number }[]): DoubleBondStereo[] {
  const out: DoubleBondStereo[] = [];
  // dirección de cada enlace con «/» o «\» vista desde cada extremo, según el orden de escritura
  // Convención de Daylight: en F/C=C/F los dos F están en trans. Para un enlace escrito X/Y (X antes que Y): «Y está "arriba" de X».
  const dirs = raw.filter((b) => b.dir);
  if (!dirs.length) return out;
  const sideOf = (center: number, nb: number): number | null => {
    // devuelve +1 / −1: posición «arriba/abajo» del vecino nb respecto del átomo central del doble enlace
    for (const b of dirs) {
      if (b.a === center && b.b === nb) return b.dir === '/' ? 1 : -1; // escrito center/nb → nb arriba
      if (b.b === center && b.a === nb) return b.dir === '/' ? -1 : 1; // escrito nb/center → nb abajo
    }
    return null;
  };
  m.bonds.forEach((db) => {
    if (db.order !== 2) return;
    const na = neighbors(m, db.a).filter((x) => x !== db.b);
    const nb = neighbors(m, db.b).filter((x) => x !== db.a);
    let x = -1, sx: number | null = null, y = -1, sy: number | null = null;
    for (const c of na) { const v = sideOf(db.a, c); if (v !== null) { x = c; sx = v; break; } }
    for (const c of nb) { const v = sideOf(db.b, c); if (v !== null) { y = c; sy = v; break; } }
    if (x < 0 || y < 0 || sx === null || sy === null) return;
    // a precede a b en la cadena: para «x/a=b/y», sx(x desde a) = −1 (x abajo) y sy = +1 (y arriba) → trans
    out.push({ a: db.a, b: db.b, x, y, relation: sx === sy ? 'cis' : 'trans' });
  });
  return out;
}

/* ------------------------------------------------------------------ escritor de SMILES (no canónico) */

/** Escribe un SMILES con dobles enlaces explícitos (Kekulé), útil para consultar PubChem. Incluye «/» «\» de los dobles enlaces con configuración. */
export function toSmiles(m: OMolecule): string {
  const n = m.atoms.length;
  if (!n) return '';
  const adj: number[][] = Array.from({ length: n }, () => []);
  m.bonds.forEach((b) => { adj[b.a].push(b.b); adj[b.b].push(b.a); });
  const visited = new Array(n).fill(false);
  const ringBonds = new Map<string, number>();
  const parent = new Array(n).fill(-1);
  const treeEdges = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  // DFS para el árbol y los cierres
  const order: number[] = [];
  const dfs = (u: number) => {
    visited[u] = true; order.push(u);
    for (const v of adj[u]) {
      if (!visited[v]) { parent[v] = u; treeEdges.add(key(u, v)); dfs(v); }
    }
  };
  dfs(0);
  let nextRing = 1;
  const closures = new Map<number, { label: number; other: number }[]>();
  m.bonds.forEach((b) => {
    const k = key(b.a, b.b);
    if (treeEdges.has(k)) return;
    const label = nextRing++;
    ringBonds.set(k, label);
    const first = order.indexOf(b.a) < order.indexOf(b.b) ? b.a : b.b;
    const second = first === b.a ? b.b : b.a;
    closures.set(first, [...(closures.get(first) ?? []), { label, other: second }]);
    closures.set(second, [...(closures.get(second) ?? []), { label, other: first }]);
  });
  // direcciones: para cada doble enlace con configuración, marca x y y
  const dirMark = new Map<string, '/' | '\\'>(); // clave "desde>hacia" en orden de escritura
  for (const st of m.stereo) {
    // escritura: parent(a)…a=b…y. Elegimos que el enlace hacia/desde x lleve «/» y el de y lleve «/» (trans) o «\» (cis),
    // tomando en cuenta el orden de escritura de cada enlace.
    const aFirst = order.indexOf(st.a) < order.indexOf(st.b);
    const [A, B, X, Y] = aFirst ? [st.a, st.b, st.x, st.y] : [st.b, st.a, st.y, st.x];
    // lado de X respecto de A: si X se escribe antes que A (X/A) → «/» significa X abajo; si después (A/X) → X arriba.
    const xBefore = order.indexOf(X) < order.indexOf(A);
    const yBefore = order.indexOf(Y) < order.indexOf(B);
    const kx = xBefore ? `${X}>${A}` : `${A}>${X}`;
    const ky = yBefore ? `${Y}>${B}` : `${B}>${Y}`;
    // «/» en «P/Q» significa: Q arriba de P (o P abajo de Q). side = +1 arriba respecto del átomo del doble enlace.
    const sideFromMark = (mark: '/' | '\\', before: boolean) => (before ? (mark === '/' ? -1 : 1) : (mark === '/' ? 1 : -1));
    const markFromSide = (side: number, before: boolean): '/' | '\\' => (before ? (side === 1 ? '\\' : '/') : (side === 1 ? '/' : '\\'));
    const ex = dirMark.get(kx), ey = dirMark.get(ky);
    let sideX = ex ? sideFromMark(ex, xBefore) : 1;
    const want = (sx: number) => (st.relation === 'cis' ? sx : -sx);
    if (!ex && ey) sideX = st.relation === 'cis' ? sideFromMark(ey, yBefore) : -sideFromMark(ey, yBefore);
    if (!ex) dirMark.set(kx, markFromSide(sideX, xBefore));
    if (!ey) dirMark.set(ky, markFromSide(want(sideX), yBefore));
  }
  const bondSym = (u: number, v: number) => {
    const b = bondBetween(m, u, v)!;
    const d = dirMark.get(`${u}>${v}`);
    if (d) return d;
    return b.order === 2 ? '=' : b.order === 3 ? '#' : '';
  };
  const atomSym = (i: number) => {
    const a = m.atoms[i];
    const q = a.charge ?? 0;
    const needsBracket = q !== 0 || !['C', 'N', 'O', 'F', 'Cl', 'Br', 'I', 'S', 'P', 'B'].includes(a.el) || (a.hCount !== undefined && a.hCount !== implicitHNoExplicit(m, i));
    if (!needsBracket) return a.el;
    const h = implicitH(m, i);
    return `[${a.el}${h ? 'H' + (h > 1 ? h : '') : ''}${q > 0 ? '+'.repeat(1) + (q > 1 ? q : '') : q < 0 ? '-' + (q < -1 ? -q : '') : ''}]`;
  };
  const write = (u: number): string => {
    let out = atomSym(u);
    for (const c of closures.get(u) ?? []) {
      const first = order.indexOf(u) < order.indexOf(c.other);
      const b = bondBetween(m, u, c.other)!;
      out += (first ? (b.order === 2 ? '=' : b.order === 3 ? '#' : '') : '') + (c.label < 10 ? c.label : `%${c.label}`);
    }
    const kids = adj[u].filter((v) => parent[v] === u);
    kids.forEach((v, k) => {
      const part = bondSym(u, v) + write(v);
      out += k < kids.length - 1 ? `(${part})` : part;
    });
    return out;
  };
  return write(0);
}

function implicitHNoExplicit(m: OMolecule, i: number): number {
  const a = m.atoms[i];
  const copy = { ...a, hCount: undefined };
  const mm: OMolecule = { ...m, atoms: m.atoms.map((x, k) => (k === i ? copy : x)) };
  return implicitH(mm, i);
}

/* ------------------------------------------------------------------ huella canónica e isomorfismo */

/**
 * Huella invariante de la constitución (refinamiento de colores de Weisfeiler-Lehman sobre elemento, carga, H y órdenes de enlace,
 * más la configuración E/Z si `withStereo`). Dos constituciones iguales dan la misma huella; para las moléculas del laboratorio
 * (árboles y monociclos con sustituyentes) distinciones distintas dan huellas distintas (comprobado en las pruebas).
 */
/**
 * Enlaces de anillo «conjugados alternos»: en un sistema de anillos donde cada átomo tiene exactamente un doble enlace dentro del
 * sistema (benceno, naftaleno, piridina, ciclooctatetraeno…). Su orden depende de la estructura de Kekulé elegida, así que la
 * huella canónica los trata como un solo tipo de enlace.
 */
export function alternatingRingBonds(m: OMolecule): boolean[] {
  const { bondInRing, atomInRing } = ringInfo(m);
  const out = m.bonds.map(() => false);
  // componentes conexas de átomos de anillo unidos por enlaces de anillo
  const comp = new Array(m.atoms.length).fill(-1);
  let c = 0;
  for (let s = 0; s < m.atoms.length; s++) {
    if (!atomInRing[s] || comp[s] >= 0) continue;
    const st = [s]; comp[s] = c;
    while (st.length) {
      const u = st.pop()!;
      m.bonds.forEach((b, k) => {
        if (!bondInRing[k]) return;
        const v = b.a === u ? b.b : b.b === u ? b.a : -1;
        if (v >= 0 && comp[v] < 0) { comp[v] = c; st.push(v); }
      });
    }
    c++;
  }
  for (let k = 0; k < c; k++) {
    const atoms = comp.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0);
    const ok = atoms.every((i) => m.bonds.filter((b, bi) => bondInRing[bi] && (b.a === i || b.b === i) && b.order === 2 && comp[b.a] === k && comp[b.b] === k).length === 1);
    if (ok) m.bonds.forEach((b, bi) => { if (bondInRing[bi] && comp[b.a] === k && comp[b.b] === k) out[bi] = true; });
  }
  return out;
}

export function canonicalKey(m: OMolecule, withStereo = false): string {
  const n = m.atoms.length;
  const adj: { v: number; o: number }[][] = Array.from({ length: n }, () => []);
  const alt = alternatingRingBonds(m);
  m.bonds.forEach((b, k) => { const o = alt[k] ? 4 : b.order; adj[b.a].push({ v: b.b, o }); adj[b.b].push({ v: b.a, o }); });
  let color = m.atoms.map((a, i) => `${a.el}${a.charge ?? 0}h${implicitH(m, i)}`);
  const rounds: string[] = [];
  let classes = new Set(color).size;
  for (let it = 0; it <= n; it++) {
    const sigs = color.map((c, i) => c + '(' + adj[i].map(({ v, o }) => o + ':' + color[v]).sort().join(',') + ')');
    const sorted = [...new Set(sigs)].sort();
    rounds.push(hash(sigs.slice().sort().join(';')));
    const rank = new Map(sorted.map((x, k) => [x, `c${k}`]));
    color = sigs.map((x) => rank.get(x)!);
    const now = new Set(color).size;
    if (now === classes && it > 0) break;
    classes = now;
  }
  let st = '';
  if (withStereo && m.stereo.length) {
    st = '|' + m.stereo.map((s) => [color[s.a], color[s.b]].sort().join('=') + ':' + s.relation).sort().join(',');
  }
  return `${hillFormula(m)}|${hash(rounds.join('/'))}${st}`;
}

function hash(s: string): string {
  // FNV-1a de 64 bits en dos mitades (suficiente para distinguir huellas; no es criptográfico)
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (c + 31 * i), 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + s.length.toString(36);
}

/**
 * Isomorfismo entre los átomos pesados de dos moléculas (p. ej. la estructura del constructor y el SDF de PubChem).
 * Devuelve map[i] = índice en `b` del átomo i de `a`, o null si no son isómeros constitucionales idénticos.
 * Compara elemento, carga y órdenes de enlace (los aromáticos ya están kekulizados en ambos; se acepta cualquier kekulización
 * si `ignoreBondOrderInRings`).
 */
export function mapHeavyAtoms(a: OMolecule, b: OMolecule, ignoreBondOrderInRings = true): number[] | null {
  const heavyA = a.atoms.map((x, i) => (x.el !== 'H' ? i : -1)).filter((i) => i >= 0);
  const heavyB = b.atoms.map((x, i) => (x.el !== 'H' ? i : -1)).filter((i) => i >= 0);
  if (heavyA.length !== heavyB.length) return null;
  const ringA = ringInfo(a).bondInRing, ringB = ringInfo(b).bondInRing;
  const order = (m: OMolecule, rings: boolean[], i: number, j: number) => {
    const k = m.bonds.findIndex((x) => (x.a === i && x.b === j) || (x.a === j && x.b === i));
    if (k < 0) return 0;
    return ignoreBondOrderInRings && rings[k] && m.bonds[k].order !== 3 ? 9 : m.bonds[k].order;
  };
  const heavyNb = (m: OMolecule, i: number) => neighbors(m, i).filter((v) => m.atoms[v].el !== 'H');
  const label = (m: OMolecule, i: number) => `${m.atoms[i].el}${m.atoms[i].charge ?? 0}d${heavyNb(m, i).length}`;
  const map = new Array(a.atoms.length).fill(-1);
  const used = new Set<number>();
  // orden de búsqueda: BFS desde el átomo pesado de mayor grado
  const start = heavyA.slice().sort((x, y) => heavyNb(a, y).length - heavyNb(a, x).length)[0];
  const seq: number[] = [];
  const seen = new Set([start]);
  const q = [start];
  while (q.length) { const u = q.shift()!; seq.push(u); for (const v of heavyNb(a, u)) if (!seen.has(v)) { seen.add(v); q.push(v); } }
  if (seq.length !== heavyA.length) return null;
  const go = (k: number): boolean => {
    if (k === seq.length) return true;
    const u = seq[k];
    for (const cand of heavyB) {
      if (used.has(cand) || label(b, cand) !== label(a, u)) continue;
      let ok = true;
      for (const v of heavyNb(a, u)) {
        if (map[v] < 0) continue;
        if (order(a, ringA, u, v) !== order(b, ringB, cand, map[v])) { ok = false; break; }
      }
      if (!ok) continue;
      map[u] = cand; used.add(cand);
      if (go(k + 1)) return true;
      map[u] = -1; used.delete(cand);
    }
    return false;
  };
  return go(0) ? map : null;
}

/** Quita los átomos de hidrógeno explícitos (como los de un SDF) y los convierte en conteos implícitos. */
export function stripHydrogens(m: OMolecule): { mol: OMolecule; index: number[] } {
  const keep = m.atoms.map((a, i) => (a.el !== 'H' ? i : -1)).filter((i) => i >= 0);
  const newIndex = new Array(m.atoms.length).fill(-1);
  keep.forEach((old, k) => { newIndex[old] = k; });
  const atoms = keep.map((old) => {
    const hs = neighbors(m, old).filter((v) => m.atoms[v].el === 'H').length;
    return { ...m.atoms[old], hCount: hs };
  });
  const bonds = m.bonds.filter((b) => newIndex[b.a] >= 0 && newIndex[b.b] >= 0).map((b) => ({ ...b, a: newIndex[b.a], b: newIndex[b.b] }));
  const stereo = m.stereo.filter((s) => [s.a, s.b, s.x, s.y].every((i) => newIndex[i] >= 0)).map((s) => ({ ...s, a: newIndex[s.a], b: newIndex[s.b], x: newIndex[s.x], y: newIndex[s.y] }));
  return { mol: { atoms, bonds, stereo }, index: keep };
}

/** Lee el bloque de átomos y enlaces de un molfile V2000 (SDF) como grafo, sin geometría. Sirve para alinear el SDF con una estructura. */
export function molFromMolfile(sdf: string): { mol: OMolecule; xyz: [number, number, number][] } {
  const lines = sdf.split(/\r?\n/);
  const counts = lines[3] ?? '';
  const na = Number(counts.slice(0, 3)), nb = Number(counts.slice(3, 6));
  if (!Number.isFinite(na) || !Number.isFinite(nb) || na <= 0) throw new SmilesError('Molfile sin bloque de recuento válido.');
  const atoms: OAtom[] = [];
  const xyz: [number, number, number][] = [];
  const CHG: Record<number, number> = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };
  for (let k = 0; k < na; k++) {
    const l = lines[4 + k];
    xyz.push([Number(l.slice(0, 10)), Number(l.slice(10, 20)), Number(l.slice(20, 30))]);
    const el = l.slice(31, 34).trim() as ElementSymbol;
    const ccc = Number(l.slice(36, 39)) || 0;
    atoms.push({ el, charge: CHG[ccc] || undefined, hCount: el === 'H' ? 0 : undefined });
  }
  const bonds: OBond[] = [];
  for (let k = 0; k < nb; k++) {
    const l = lines[4 + na + k];
    const a = Number(l.slice(0, 3)) - 1, b = Number(l.slice(3, 6)) - 1, o = Number(l.slice(6, 9));
    bonds.push({ a, b, order: (o === 4 ? 1 : Math.min(3, Math.max(1, o))) as 1 | 2 | 3, aromatic: o === 4 || undefined });
  }
  // cargas de las líneas «M  CHG»
  for (const l of lines.slice(4 + na + nb)) {
    if (!l.startsWith('M  CHG')) continue;
    const parts = l.slice(6).trim().split(/\s+/).map(Number);
    for (let k = 1; k + 1 < parts.length; k += 2) atoms[parts[k] - 1].charge = parts[k + 1] || undefined;
  }
  // con hidrógenos explícitos, cada pesado lleva H explícitos: hCount = 0 extra (los H están como átomos)
  atoms.forEach((a, i) => { if (a.el !== 'H') a.hCount = 0; void i; });
  return { mol: { atoms, bonds, stereo: [] }, xyz };
}

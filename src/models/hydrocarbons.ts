/**
 * Modelo de la práctica «Hidrocarburos: alcanos, alquenos y alquinos» (reutilizable; ver docs/organica/README.md).
 *
 * - Propiedades experimentales con su fuente (src/data/quimica/organica.ts) y reglas explícitas para no comparar datos que no son
 *   comparables (densidad de un gas, de un líquido a presión o a otra temperatura; calor de combustión en otro estado).
 * - Combustión completa e incompleta balanceada para CₓHᵧ (coeficientes enteros mínimos) y energía con ΔcH° experimental.
 * - Hibridación (sp³/sp²/sp) de cada carbono a partir del grafo y longitudes/ángulos medidos sobre el confórmero de PubChem.
 * - Conformaciones: rotación rígida de un grupo alrededor de un enlace sencillo y ángulo diedro (ILUSTRACIÓN: no se reoptimiza).
 * - Halogenación por radicales: productos monohalogenados distintos (con nombre IUPAC del motor) y distribución estadística
 *   (supone que todos los H reaccionan igual; es un modelo, no la selectividad real).
 * - Adición a dobles y triples enlaces (H₂, X₂, HX) con regla de Markovnikov para HX.
 * - Pruebas de insaturación (agua de bromo, permanganato): resultado esperado según la presencia de C=C o C≡C (ilustración).
 */
import { getOrganic, type OrganicRecord, type PropValue } from '../data/quimica/organica';
import { canonicalKey, hillFormula, implicitH, neighbors, parseSmiles, ringInfo, type OMolecule } from './organicGraph';
import { nameMolecule } from './organicNomenclature';
import type { ModelSpec } from './types';

/* ------------------------------------------------------------------ series */

export type Family = 'alcano' | 'alqueno' | 'alquino';
export const SERIES: Record<Family, string[]> = {
  alcano: ['metano', 'etano', 'propano', 'butano', 'pentano', 'hexano', 'heptano', 'octano', 'nonano', 'decano'],
  alqueno: ['eteno', 'propeno', 'but-1-eno', 'pent-1-eno', 'hex-1-eno', 'hept-1-eno', 'oct-1-eno', 'non-1-eno', 'dec-1-eno'],
  alquino: ['etino', 'propino', 'but-1-ino', 'pent-1-ino', 'hex-1-ino', 'hept-1-ino', 'oct-1-ino', 'non-1-ino', 'dec-1-ino'],
};
export const GENERAL_FORMULA: Record<Family, string> = { alcano: 'CₙH₂ₙ₊₂', alqueno: 'CₙH₂ₙ (un C=C)', alquino: 'CₙH₂ₙ₋₂ (un C≡C)' };
export const FAMILY_LABEL: Record<Family, string> = { alcano: 'Alcanos', alqueno: 'Alquenos (1-alquenos)', alquino: 'Alquinos (1-alquinos)' };

export function carbonCount(rec: { formula: string }): number {
  const m = /^C(\d*)/.exec(rec.formula);
  return m ? (m[1] ? Number(m[1]) : 1) : 0;
}
export function hydrogenCount(rec: { formula: string }): number {
  const m = /H(\d*)/.exec(rec.formula);
  return m ? (m[1] ? Number(m[1]) : 1) : 0;
}

/** Fase a 25 °C y 1 atm según los puntos de fusión y ebullición experimentales (null si faltan datos). */
export function phaseAt25(rec: OrganicRecord): 'gas' | 'líquido' | 'sólido' | null {
  const b = rec.propiedades.tEb?.valor, f = rec.propiedades.tFus?.valor;
  if (b === undefined || b === null) return null;
  if (b < 25) return 'gas';
  if (f !== undefined && f !== null && f > 25) return 'sólido';
  return 'líquido';
}

export interface ExpProp { value: number; unit: string; text: string; source: string; url: string; date: string; note?: string }

const asExp = (p: PropValue, note?: string): ExpProp => ({
  value: p.valor, unit: p.unidad, text: p.texto, source: `${p.base}${p.cita ? `, que cita: ${p.cita}` : ''}`, url: p.url, date: p.fecha, note,
});

export function boilingPoint(rec: OrganicRecord): ExpProp | null { return rec.propiedades.tEb ? asExp(rec.propiedades.tEb) : null; }
export function meltingPoint(rec: OrganicRecord): ExpProp | null { return rec.propiedades.tFus ? asExp(rec.propiedades.tFus) : null; }

/**
 * Densidad del LÍQUIDO entre 15 y 30 °C, comparable entre compuestos. Se rechaza (con motivo) la densidad relativa de un gas
 * («air = 1»), la de un líquido a presión (sustancia que hierve por debajo de esa temperatura) y la medida a otra temperatura.
 */
export function liquidDensity(rec: OrganicRecord): { ok: ExpProp | null; motivo?: string } {
  const p = rec.propiedades.densidad;
  if (!p) return { ok: null, motivo: 'Sin dato de densidad en PubChem.' };
  if (/air\s*=\s*1|relative gas|vapor/i.test(p.texto)) return { ok: null, motivo: `Gas a 25 °C: el dato de PubChem («${p.texto}») es una densidad relativa al aire, no comparable.` };
  const T = p.temperatura;
  if (T === undefined || T < 15 || T > 30) return { ok: null, motivo: `Medida a ${T ?? '¿?'} °C: no comparable con las de 20–25 °C.` };
  const b = rec.propiedades.tEb?.valor;
  if (/p\s*>\s*1\s*atm|pressure\s*>\s*1/i.test(p.texto) || (b !== undefined && b < T)) return { ok: null, motivo: `Hierve a ${b} °C: a ${T} °C solo es líquido a presión; no se compara con los líquidos a 1 atm.` };
  return { ok: asExp(p) };
}

/**
 * Entalpía de combustión estándar (kJ/mol, como energía liberada) del estado de la sustancia a 25 °C. Solo hay valores cuando
 * PubChem/HSDB cita el CRC Handbook o Riddick et al. (entalpías estándar); ver scripts/validacion/organica_pubchem.py.
 */
export function combustionEnthalpy(rec: OrganicRecord): ExpProp | null {
  const p = rec.propiedades.dHc;
  if (!p) return null;
  const phase = phaseAt25(rec);
  const want = phase === 'gas' ? /gas/i : phase === 'sólido' ? /solid/i : /liq/i;
  const all = p.todos ?? [{ kJmol: p.valor, estado: p.estado ?? '' }];
  const match = all.find((x) => want.test(x.estado)) ?? all.find((x) => !x.estado) ?? null;
  if (!match) return null;
  return { ...asExp({ ...p, valor: match.kJmol }), note: match.estado ? `estado: ${match.estado}` : phase ? `sin estado declarado (a 25 °C es ${phase})` : undefined };
}

/* ------------------------------------------------------------------ combustión */

export const ATOMIC_WEIGHT: Record<string, number> = { H: 1.008, C: 12.011, O: 15.999, F: 18.998, Cl: 35.45, Br: 79.904, I: 126.90, N: 14.007 };

export function molarMassOf(formula: string): number {
  let m = 0;
  for (const [, el, n] of formula.replace(/[+-]$/, '').matchAll(/([A-Z][a-z]?)(\d*)/g)) m += (ATOMIC_WEIGHT[el] ?? NaN) * (n ? Number(n) : 1);
  return m;
}

export type CombustionKind = 'completa' | 'co' | 'hollin';
export const COMBUSTION_LABEL: Record<CombustionKind, string> = {
  completa: 'Completa (mucho O₂): CO₂ y H₂O',
  co: 'Incompleta (poco O₂): CO y H₂O',
  hollin: 'Incompleta (muy poco O₂): C (hollín) y H₂O',
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** Coeficientes enteros mínimos de la combustión de CₓHᵧ. */
export function balanceCombustion(C: number, H: number, kind: CombustionKind): { fuel: number; o2: number; co2: number; co: number; c: number; h2o: number } {
  // por mol de combustible: O₂ = x + y/4 (completa), x/2 + y/4 (CO), y/4 (hollín); se multiplica por 4 y se simplifica
  const o2x4 = kind === 'completa' ? 4 * C + H : kind === 'co' ? 2 * C + H : H;
  let fuel = 4, o2 = o2x4, prod = 4 * C, h2o = 2 * H;
  const g = [fuel, o2, prod, h2o].reduce(gcd);
  fuel /= g; o2 /= g; prod /= g; h2o /= g;
  return { fuel, o2, co2: kind === 'completa' ? prod : 0, co: kind === 'co' ? prod : 0, c: kind === 'hollin' ? prod : 0, h2o };
}

const coef = (n: number) => (n === 1 ? '' : `${n} `);
export function combustionEquation(formulaPretty: string, C: number, H: number, kind: CombustionKind): string {
  const b = balanceCombustion(C, H, kind);
  const prod = kind === 'completa' ? `${coef(b.co2)}CO₂` : kind === 'co' ? `${coef(b.co)}CO` : `${coef(b.c)}C`;
  return `${coef(b.fuel)}${formulaPretty} + ${coef(b.o2)}O₂ → ${prod} + ${coef(b.h2o)}H₂O`;
}

/** Conservación de átomos de la ecuación (para pruebas). */
export function combustionAtomBalance(C: number, H: number, kind: CombustionKind) {
  const b = balanceCombustion(C, H, kind);
  return {
    C: [b.fuel * C, b.co2 + b.co + b.c], H: [b.fuel * H, 2 * b.h2o], O: [2 * b.o2, 2 * b.co2 + b.co + b.h2o],
  };
}

export interface CombustionEnergy { kJmol: number; kJg: number; molO2: number; gCO2perMJ: number; source: ExpProp }

/** Energía de la combustión completa con ΔcH° experimental (null si no hay dato). gCO₂/MJ: emisión por energía liberada. */
export function combustionEnergy(rec: OrganicRecord): CombustionEnergy | null {
  const h = combustionEnthalpy(rec);
  if (!h) return null;
  const C = carbonCount(rec), H = hydrogenCount(rec);
  const M = molarMassOf(rec.formula);
  return { kJmol: h.value, kJg: h.value / M, molO2: C + H / 4, gCO2perMJ: (C * 44.009) / (h.value / 1000), source: h };
}

/* ------------------------------------------------------------------ geometría medida e hibridación */

export type Hybrid = 'sp3' | 'sp2' | 'sp';
export const HYBRID_LABEL: Record<Hybrid, string> = { sp3: 'sp³', sp2: 'sp²', sp: 'sp' };
export const IDEAL_ANGLE: Record<Hybrid, number> = { sp3: 109.47, sp2: 120, sp: 180 };

export interface XYZAtom { el: string; x: number; y: number; z: number }
export interface XYZBond { a: number; b: number; order: number }

export function hybridOf(bonds: XYZBond[], i: number): Hybrid {
  const mine = bonds.filter((b) => b.a === i || b.b === i);
  const triple = mine.some((b) => b.order === 3);
  const doubles = mine.filter((b) => b.order === 2).length;
  if (triple || doubles >= 2) return 'sp';
  if (doubles === 1 || mine.some((b) => b.order === 4)) return 'sp2';
  return 'sp3';
}

export const dist = (p: XYZAtom, q: XYZAtom) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
export function angleDeg(p: XYZAtom, v: XYZAtom, q: XYZAtom): number {
  const a = [p.x - v.x, p.y - v.y, p.z - v.z], b = [q.x - v.x, q.y - v.y, q.z - v.z];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const c = dot / (Math.hypot(...a) * Math.hypot(...b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
/** Ángulo diedro a–b–c–d en grados (−180, 180]. */
export function dihedralDeg(a: XYZAtom, b: XYZAtom, c: XYZAtom, d: XYZAtom): number {
  const sub = (p: XYZAtom, q: XYZAtom) => [p.x - q.x, p.y - q.y, p.z - q.z];
  const cross = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const b1 = sub(b, a), b2 = sub(c, b), b3 = sub(d, c);
  const n1 = cross(b1, b2), n2 = cross(b2, b3);
  const u2 = b2.map((x) => x / Math.hypot(...b2));
  return (Math.atan2(dot(cross(n1, n2), u2), dot(n1, n2)) * 180) / Math.PI;
}

export interface BondMeasure { kind: string; a: number; b: number; length: number; order: number }
export interface AngleMeasure { center: number; hybrid: Hybrid; a: number; b: number; angle: number; ideal: number }

/** Mediciones de un confórmero: longitudes C–C, C=C, C≡C y C–H, y ángulos alrededor de cada carbono (Modelo calculado). */
export function measureConformer(atoms: XYZAtom[], bonds: XYZBond[]) {
  const label = (o: number) => (o === 3 ? '≡' : o === 2 ? '=' : o === 4 ? '⋯' : '–');
  const bl: BondMeasure[] = bonds.map((b) => {
    const [p, q] = [atoms[b.a].el, atoms[b.b].el].sort((x, y) => (x === 'C' ? -1 : y === 'C' ? 1 : x < y ? -1 : 1));
    return { kind: `${p}${label(b.order)}${q}`, a: b.a, b: b.b, length: dist(atoms[b.a], atoms[b.b]), order: b.order };
  });
  const ang: AngleMeasure[] = [];
  atoms.forEach((at, i) => {
    if (at.el !== 'C') return;
    const nb = bonds.filter((b) => b.a === i || b.b === i).map((b) => (b.a === i ? b.b : b.a));
    const h = hybridOf(bonds, i);
    for (let x = 0; x < nb.length; x++) for (let y = x + 1; y < nb.length; y++) ang.push({ center: i, hybrid: h, a: nb[x], b: nb[y], angle: angleDeg(atoms[nb[x]], at, atoms[nb[y]]), ideal: IDEAL_ANGLE[h] });
  });
  return { bonds: bl, angles: ang };
}

/** Resumen por tipo de enlace: promedio, mínimo y máximo (Å). */
export function bondSummary(bl: BondMeasure[]): { kind: string; n: number; mean: number; min: number; max: number }[] {
  const g = new Map<string, number[]>();
  for (const b of bl) g.set(b.kind, [...(g.get(b.kind) ?? []), b.length]);
  return [...g.entries()].map(([kind, v]) => ({ kind, n: v.length, mean: v.reduce((s, x) => s + x, 0) / v.length, min: Math.min(...v), max: Math.max(...v) }))
    .sort((p, q) => p.kind.localeCompare(q.kind));
}

/* ------------------------------------------------------------------ conformaciones (ilustración) */

/** Átomos del lado de `j` al cortar el enlace i–j. */
export function sideOf(bonds: XYZBond[], n: number, i: number, j: number): number[] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  bonds.forEach((b) => { adj[b.a].push(b.b); adj[b.b].push(b.a); });
  const seen = new Set([i, j]);
  const out = [j];
  const st = [j];
  while (st.length) { const u = st.pop()!; for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); out.push(v); st.push(v); } }
  return out;
}

/** Gira rígidamente el lado de j alrededor del eje i→j un ángulo (grados). Devuelve coordenadas nuevas; no reoptimiza nada. */
export function rotateAboutBond(atoms: XYZAtom[], bonds: XYZBond[], i: number, j: number, deg: number): XYZAtom[] {
  const moving = new Set(sideOf(bonds, atoms.length, i, j));
  const o = atoms[j];
  const ax = [atoms[j].x - atoms[i].x, atoms[j].y - atoms[i].y, atoms[j].z - atoms[i].z];
  const L = Math.hypot(...ax); const k = ax.map((v) => v / L);
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return atoms.map((a, idx) => {
    if (!moving.has(idx) || idx === j) return { ...a };
    const v = [a.x - o.x, a.y - o.y, a.z - o.z];
    const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    const cr = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    const r = [0, 1, 2].map((d) => v[d] * c + cr[d] * s + k[d] * kv * (1 - c));
    return { ...a, x: o.x + r[0], y: o.y + r[1], z: o.z + r[2] };
  });
}

/** Nombre de la conformación del etano según el menor diedro H–C–C–H. */
export function ethaneConformation(minHCCH: number): string {
  const d = Math.abs(((minHCCH % 120) + 120) % 120);
  const e = Math.min(d, 120 - d);
  if (e < 5) return 'eclipsada';
  if (Math.abs(e - 60) < 5) return 'alternada';
  return 'intermedia (sesgada)';
}
/** Nombre de la conformación del butano según el diedro C1–C2–C3–C4. */
export function butaneConformation(phi: number): string {
  const a = Math.abs(((phi + 540) % 360) - 180); // 0..180
  if (a > 175) return 'anti (alternada, metilos opuestos)';
  if (Math.abs(a - 60) < 5) return 'gauche (alternada, metilos a 60°)';
  if (a < 5) return 'totalmente eclipsada (metilos superpuestos)';
  if (Math.abs(a - 120) < 5) return 'eclipsada (metilo frente a H)';
  return 'intermedia';
}

/* ------------------------------------------------------------------ halogenación por radicales (modelo estadístico) */

export interface HalogenationProduct { smilesKey: string; name: string; nombre: string; hydrogens: number; percent: number; type: string; mol: OMolecule }

/**
 * Productos monohalogenados distintos de un alcano y su proporción ESTADÍSTICA (número de H equivalentes / total).
 * Supuesto: todos los H son igual de reactivos (falso en la realidad: los H de carbonos más sustituidos reaccionan más rápido).
 */
export function monohalogenation(alkaneSmiles: string, halogen: 'Cl' | 'Br'): HalogenationProduct[] {
  const m = parseSmiles(alkaneSmiles);
  const groups = new Map<string, HalogenationProduct>();
  let totalH = 0;
  m.atoms.forEach((a, i) => {
    if (a.el !== 'C') return;
    const h = implicitH(m, i);
    if (!h) return;
    totalH += h;
    const p: OMolecule = { atoms: [...m.atoms.map((x) => ({ ...x, hCount: undefined })), { el: halogen }], bonds: [...m.bonds, { a: i, b: m.atoms.length, order: 1 }], stereo: [] };
    const key = canonicalKey(p);
    const deg = neighbors(m, i).filter((v) => m.atoms[v].el === 'C').length;
    const type = deg <= 1 ? (deg === 0 ? 'metano' : 'primario') : deg === 2 ? 'secundario' : 'terciario';
    const g = groups.get(key);
    if (g) g.hydrogens += h;
    else {
      const nm = nameMolecule(p);
      groups.set(key, { smilesKey: key, name: nm.ok ? nm.en : '—', nombre: nm.ok ? nm.es : '—', hydrogens: h, percent: 0, type, mol: p });
    }
  });
  const list = [...groups.values()];
  list.forEach((g) => { g.percent = (100 * g.hydrogens) / totalH; });
  return list.sort((a, b) => b.percent - a.percent);
}

/* ------------------------------------------------------------------ adición (alquenos y alquinos) */

export type Reagent = 'H2' | 'Br2' | 'Cl2' | 'HBr' | 'HCl';
export const REAGENT_LABEL: Record<Reagent, string> = { H2: 'H₂ (catalizador de Ni, Pd o Pt)', Br2: 'Br₂', Cl2: 'Cl₂', HBr: 'HBr', HCl: 'HCl' };

/** Adición a un enlace múltiple (primero el de menor localizador). Para HX aplica Markovnikov (el H va al C con más H). */
export function addToMultipleBond(m: OMolecule, reagent: Reagent): { product: OMolecule; note: string } | null {
  const { bondInRing } = ringInfo(m);
  const k = m.bonds.findIndex((b, idx) => b.order > 1 && !bondInRing[idx]) >= 0
    ? m.bonds.findIndex((b, idx) => b.order > 1 && !bondInRing[idx])
    : m.bonds.findIndex((b) => b.order > 1);
  if (k < 0) return null;
  const atoms: OMolecule['atoms'] = m.atoms.map((a) => ({ ...a, hCount: undefined }));
  const bonds = m.bonds.map((b) => ({ ...b }));
  bonds[k].order = (bonds[k].order - 1) as 1 | 2 | 3;
  const { a, b } = bonds[k];
  let note = '';
  if (reagent === 'H2') note = 'Hidrogenación: se agrega un H a cada carbono del enlace múltiple.';
  else if (reagent === 'Br2' || reagent === 'Cl2') {
    const X = reagent === 'Br2' ? 'Br' : 'Cl';
    atoms.push({ el: X }, { el: X });
    bonds.push({ a, b: atoms.length - 2, order: 1 }, { a: b, b: atoms.length - 1, order: 1 });
    note = `Halogenación por adición: un ${X} en cada carbono del enlace múltiple.`;
  } else {
    const X = reagent === 'HBr' ? 'Br' : 'Cl';
    const ha = implicitH(m, a), hb = implicitH(m, b);
    const target = ha >= hb ? b : a; // el X va al carbono con menos H
    atoms.push({ el: X });
    bonds.push({ a: target, b: atoms.length - 1, order: 1 });
    note = ha === hb ? `Los dos carbonos tienen los mismos H: la regla de Markovnikov no distingue.` : `Regla de Markovnikov: el H se une al carbono que ya tenía más hidrógenos y el ${X} al otro.`;
  }
  return { product: { atoms, bonds, stereo: [] }, note };
}

/* ------------------------------------------------------------------ pruebas de insaturación (ilustración) */

export type UnsatTest = 'bromo' | 'permanganato';
export interface UnsatResult { positive: boolean; observation: string; explanation: string }

export function hasNonAromaticMultipleBond(m: OMolecule): boolean {
  const { rings, bondInRing } = ringInfo(m);
  const benzeneBond = new Set<number>();
  for (const r of rings) {
    if (r.length !== 6) continue;
    const idx = r.map((x, i) => m.bonds.findIndex((b) => (b.a === x && b.b === r[(i + 1) % 6]) || (b.b === x && b.a === r[(i + 1) % 6])));
    if (idx.every((k) => k >= 0) && idx.filter((k) => m.bonds[k].order === 2).length === 3) idx.forEach((k) => benzeneBond.add(k));
  }
  void bondInRing;
  return m.bonds.some((b, k) => b.order > 1 && !benzeneBond.has(k));
}

export function unsaturationTest(m: OMolecule, test: UnsatTest): UnsatResult {
  const pos = hasNonAromaticMultipleBond(m);
  if (test === 'bromo') {
    return pos
      ? { positive: true, observation: 'El color pardo-anaranjado del bromo desaparece en segundos, a temperatura ambiente y sin luz.', explanation: 'El Br₂ se adiciona al enlace doble o triple (C=C o C≡C) y forma un dibromuro incoloro.' }
      : { positive: false, observation: 'El color pardo-anaranjado se mantiene (en la oscuridad).', explanation: 'Sin enlaces C=C ni C≡C no hay adición rápida. Un alcano solo reacciona con Br₂ con luz o calor (sustitución por radicales, lenta), y el benceno necesita un catalizador (FeBr₃).' };
  }
  return pos
    ? { positive: true, observation: 'El violeta del permanganato desaparece y aparece un sólido pardo (MnO₂).', explanation: 'El MnO₄⁻ oxida el enlace C=C o C≡C (prueba de Baeyer); el manganeso se reduce a MnO₂.' }
    : { positive: false, observation: 'El color violeta se mantiene.', explanation: 'Los alcanos y el anillo del benceno no se oxidan con permanganato diluido y frío.' };
}

/* ------------------------------------------------------------------ ficha del modelo */

export const hydrocarbonsModelSpec: ModelSpec = {
  name: 'Hidrocarburos: datos experimentales de PubChem, confórmeros 3D, estequiometría de la combustión y reglas de reactividad',
  inputs: [
    { symbol: 'familia', name: 'Familia (alcano, alqueno, alquino)', unit: '—', initial: 'alcano' },
    { symbol: 'n', name: 'Número de carbonos de la serie homóloga', unit: '—', range: [1, 10], initial: 1 },
    { symbol: 'tipo', name: 'Tipo de combustión (completa, CO, hollín)', unit: '—', initial: 'completa' },
    { symbol: 'φ', name: 'Ángulo de giro alrededor del enlace C–C (ilustración)', unit: '°', range: [0, 360], initial: 0 },
  ],
  outputs: [
    { symbol: 'Tₑb, T_fus, ρ', name: 'Propiedades experimentales citadas (PubChem/HSDB)', unit: '°C, g/cm³' },
    { symbol: 'd, θ', name: 'Longitudes y ángulos medidos sobre el confórmero de PubChem', unit: 'Å, °' },
    { symbol: 'ΔcH°', name: 'Entalpía de combustión experimental y energía por gramo', unit: 'kJ/mol, kJ/g' },
    { symbol: 'coeficientes', name: 'Ecuación balanceada de la combustión', unit: '—' },
  ],
  equations: [
    'Combustión completa: CₓHᵧ + (x + y/4) O₂ → x CO₂ + (y/2) H₂O (se multiplica por 4 y se simplifica al mínimo entero)',
    'Incompleta: CₓHᵧ + (x/2 + y/4) O₂ → x CO + (y/2) H₂O; con hollín: CₓHᵧ + (y/4) O₂ → x C + (y/2) H₂O',
    'Energía por gramo = ΔcH° / M;  emisión = 44,009 g/mol · x / (ΔcH° en MJ/mol) g CO₂ por MJ',
    'Distancia d = √(Δx² + Δy² + Δz²);  ángulo θ = arccos(u·v/|u||v|);  diedro por el método de los vectores normales',
    'Halogenación estadística: % de un producto = (H equivalentes que lo forman) / (H totales) × 100',
  ],
  initialConditions: ['Metano (n = 1), combustión completa, etano en conformación alternada (confórmero de PubChem).'],
  assumptions: [
    'Las propiedades son datos experimentales tomados de PubChem (PUG View, sobre todo HSDB) con la obra que citan; se eligen con una regla fija y documentada.',
    'Las geometrías son confórmeros calculados por PubChem3D (OMEGA + MMFF94s): predicción computacional, no estructuras medidas.',
    'La rotación de conformaciones gira rígidamente un grupo: no se recalculan la energía ni la geometría (ilustración educativa).',
    'La halogenación estadística supone que todos los H reaccionan igual; las pruebas de insaturación muestran el resultado esperado por la presencia de C=C o C≡C.',
  ],
  limits: [
    'Hay huecos honestos: PubChem no trae Tₑb de los 1-alquinos de 4 a 10 carbonos ni ΔcH° de varios alcanos con fuente estándar; se muestran como «Sin información disponible».',
    'Los datos de distintas obras pueden diferir en algunas décimas; el laboratorio no promedia ni corrige valores.',
    'La animación de reacciones en 3D interpola entre geometrías de reactivos y productos: no es un mecanismo ni una trayectoria real.',
    'La energía real de las conformaciones (barreras de rotación) no se calcula aquí; la curva es cualitativa.',
  ],
  testCases: [
    'Balanceo: CH₄ + 2 O₂ → CO₂ + 2 H₂O; 2 C₂H₆ + 7 O₂ → 4 CO₂ + 6 H₂O; conservación de C, H y O en las tres combustiones de C₁–C₁₀.',
    'Metano: ΔcH° = 890,8 kJ/mol (CRC 94.ª ed., vía HSDB) → 55,5 kJ/g; 49,4 g CO₂/MJ.',
    'Propano + Cl₂ (estadística): 1-cloropropano 75 %, 2-cloropropano 25 %; butano: 60 % / 40 %; 2-metilpropano: 90 % / 10 %.',
    'Confórmeros: C–C del etano ≈ 1,5 Å, C=C del eteno ≈ 1,33 Å, C≡C del etino ≈ 1,20 Å; H–C–H del metano ≈ 109,5°, ángulo H–C≡C 180°.',
    'Rotación rígida: conserva todas las distancias de enlace; el diedro cambia exactamente el ángulo girado.',
  ],
};

export { getOrganic, hillFormula };

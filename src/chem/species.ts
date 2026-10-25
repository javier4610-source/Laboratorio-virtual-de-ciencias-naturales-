/**
 * Especie química en 3D del kit (molécula, ion, átomo aislado o fragmento de cristal) y sus constructores.
 *
 * Toda especie declara de dónde salen sus coordenadas (`geometry`):
 *  - 'pubchem': confórmero 3D calculado por PubChem (OMEGA + MMFF94s), archivo SDF sin modificar, con CID, URL,
 *    fecha y SHA-256 (src/data/quimica/molecules3d.ts).
 *  - 'vsepr': geometría calculada en el kit con las direcciones ideales del modelo VSEPR y longitudes de enlace
 *    estimadas como suma de radios covalentes de Pyykkö (para iones y moléculas sin confórmero en PubChem).
 *  - 'cristal': posiciones generadas a partir de un parámetro de red publicado (src/chem/crystal.ts).
 *  - 'atomo': un átomo aislado (sin geometría que calcular).
 * Funciones puras y deterministas (sin React ni navegador).
 */
import { parseSdf, type Molecule } from '../models/geometry';
import { covalentBondLength, PYYKKO_REF } from './elements';

export type GeometrySource = 'pubchem' | 'vsepr' | 'cristal' | 'atomo';

export interface Atom3D { el: string; x: number; y: number; z: number; charge?: number }
export interface Bond3D { a: number; b: number; order: 1 | 2 | 3 | 4 }

export interface SourceRef { cid?: number; url: string; fecha: string; sha256?: string }

export interface Species3D {
  id: string;
  /** Nombre en español para la interfaz. */
  name: string;
  /** Fórmula para mostrar (con subíndices y carga en Unicode, p. ej. «SO₄²⁻»). */
  label: string;
  atoms: Atom3D[];
  bonds: Bond3D[];
  /** Carga neta de la especie. */
  charge: number;
  geometry: GeometrySource;
  /** Rótulo visible de procedencia de la geometría (empieza por el estatus epistémico). */
  geometryLabel: string;
  /** Método y supuestos, en una frase. */
  method: string;
  source?: SourceRef;
}

export const PUBCHEM_GEOMETRY_LABEL = 'Modelo calculado: confórmero 3D de PubChem (MMFF94s)';
export const VSEPR_GEOMETRY_LABEL = 'Modelo calculado: geometría VSEPR ideal con longitudes de enlace de radios covalentes (Pyykkö)';
export const ATOM_GEOMETRY_LABEL = 'Ilustración educativa: átomo aislado (sin geometría que calcular)';
export const VSEPR_METHOD = `Direcciones ideales del poliedro VSEPR (180°, 120°, 109,47°, 90°) y longitud de enlace = suma de radios covalentes (${PYYKKO_REF}); aproximación que puede diferir hasta ≈ 0,1 Å de las longitudes experimentales y no reproduce la reducción de ángulos por pares libres.`;

/* ------------------------------------------------------------------ conversión desde y hacia SDF */

/** Especie a partir de una molécula leída con parseSdf (el SDF no se modifica). */
export function speciesFromMolecule(mol: Molecule, meta: Omit<Species3D, 'atoms' | 'bonds' | 'charge'>): Species3D {
  const atoms = mol.atoms.map((a) => ({ el: a.element, x: a.x, y: a.y, z: a.z, ...(a.charge ? { charge: a.charge } : {}) }));
  const bonds = mol.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order }));
  return { ...meta, atoms, bonds, charge: atoms.reduce((s, a) => s + (a.charge ?? 0), 0) };
}

const f4 = (v: number) => v.toFixed(4).padStart(10);
const i3 = (v: number) => String(v).padStart(3);

/** Escribe la especie como un SDF V2000 válido (para 3Dmol.js y para releerla con parseSdf). */
export function toSdf(s: Species3D): string {
  if (s.atoms.length > 999 || s.bonds.length > 999) throw new RangeError('Demasiados átomos para un SDF V2000.');
  const lines = [s.id, '  kit-quimica-3D', s.method.slice(0, 80)];
  lines.push(`${i3(s.atoms.length)}${i3(s.bonds.length)}  0     0  0  0  0  0  0999 V2000`);
  for (const a of s.atoms) lines.push(`${f4(a.x)}${f4(a.y)}${f4(a.z)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
  for (const b of s.bonds) lines.push(`${i3(b.a + 1)}${i3(b.b + 1)}${i3(b.order)}  0  0  0  0`);
  const charged = s.atoms.map((a, i) => [i + 1, a.charge ?? 0] as const).filter(([, c]) => c !== 0);
  for (let k = 0; k < charged.length; k += 8) {
    const chunk = charged.slice(k, k + 8);
    lines.push(`M  CHG${i3(chunk.length)}${chunk.map(([i, c]) => ` ${i3(i)} ${i3(c)}`).join('')}`);
  }
  lines.push('M  END', '$$$$', '');
  return lines.join('\n');
}

/** Formato XYZ (para depuración y exportación). */
export function toXyz(s: Species3D): string {
  return [String(s.atoms.length), `${s.name} (${s.geometryLabel})`, ...s.atoms.map((a) => `${a.el} ${a.x.toFixed(4)} ${a.y.toFixed(4)} ${a.z.toFixed(4)}`)].join('\n');
}

/* ------------------------------------------------------------------ geometría vectorial */

export type V3 = [number, number, number];
const add = (p: V3, q: V3): V3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const sub = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const scale = (p: V3, k: number): V3 => [p[0] * k, p[1] * k, p[2] * k];
const dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const norm = (p: V3) => Math.hypot(p[0], p[1], p[2]);
const unit = (p: V3): V3 => scale(p, 1 / (norm(p) || 1));

/** Direcciones ideales de n dominios electrónicos (n = 1…6), en el orden de llenado del modelo VSEPR. */
export function domainDirections(n: number): V3[] {
  const c = Math.sqrt(3) / 2;
  switch (n) {
    case 0: return [];
    case 1: return [[1, 0, 0]];
    case 2: return [[1, 0, 0], [-1, 0, 0]];
    case 3: return [[0, 1, 0], [c, -0.5, 0], [-c, -0.5, 0]];
    case 4: { const k = 1 / Math.sqrt(3); return [[k, k, k], [-k, -k, k], [-k, k, -k], [k, -k, -k]]; }
    // Bipirámide trigonal: primero las tres ecuatoriales (allí van los pares libres) y luego las dos axiales.
    case 5: return [[0, 1, 0], [c, -0.5, 0], [-c, -0.5, 0], [0, 0, 1], [0, 0, -1]];
    // Octaedro: pares en posiciones opuestas (trans) cuando hay dos.
    case 6: return [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
    default: throw new RangeError('El modelo VSEPR del kit admite de 0 a 6 dominios electrónicos.');
  }
}

export interface VseprLigand {
  el: string;
  /** Orden de enlace con el átomo central; 1,5 = enlace deslocalizado (p. ej., en el ion nitrato). */
  order: 1 | 1.5 | 2 | 3;
  /** Orden con que se estima la longitud (si difiere del orden dibujado). */
  lengthOrder?: 1 | 1.5 | 2 | 3;
  /** Carga formal del ligando (p. ej., −1 en cada O del ion sulfato con enlaces deslocalizados repartidos). */
  charge?: number;
  /** Hidrógenos unidos a este ligando (p. ej., 1 para un grupo O–H). */
  h?: number;
}

export interface VseprSpec {
  id: string; name: string; label: string;
  center: string;
  centerCharge?: number;
  ligands: VseprLigand[];
  lonePairs: number;
}

/**
 * Construye una geometría VSEPR ideal: los ligandos ocupan las direcciones del poliedro de (ligandos + pares libres)
 * dominios, que no ocupan los pares libres; los H de los grupos X–H se colocan formando 109,47° con el enlace
 * central–X, girados hacia fuera. Los enlaces deslocalizados (1,5) se escriben como sencillos en el SDF.
 */
export function buildVsepr(spec: VseprSpec): Species3D {
  const nDomains = spec.ligands.length + spec.lonePairs;
  const dirs = domainDirections(nDomains);
  // Los pares libres van primero en las posiciones de llenado (ecuatoriales en la bipirámide; trans en el octaedro).
  let ligandDirs: V3[];
  if (nDomains === 5 || nDomains === 6) ligandDirs = dirs.slice(spec.lonePairs);
  else ligandDirs = dirs.slice(0, spec.ligands.length);
  if (nDomains === 6 && spec.lonePairs === 1) ligandDirs = dirs.slice(1);
  if (nDomains === 6 && spec.lonePairs === 2) ligandDirs = dirs.slice(2);
  const atoms: Atom3D[] = [{ el: spec.center, x: 0, y: 0, z: 0, ...(spec.centerCharge ? { charge: spec.centerCharge } : {}) }];
  const bonds: Bond3D[] = [];
  spec.ligands.forEach((lig, i) => {
    const d = ligandDirs[i];
    const p = scale(d, covalentBondLength(spec.center, lig.el, lig.lengthOrder ?? lig.order));
    atoms.push({ el: lig.el, x: p[0], y: p[1], z: p[2], ...(lig.charge ? { charge: lig.charge } : {}) });
    const li = atoms.length - 1;
    bonds.push({ a: 0, b: li, order: lig.order === 1.5 ? 1 : lig.order });
    for (let k = 0; k < (lig.h ?? 0); k++) {
      // Perpendicular a d que se aleja de los demás ligandos.
      const others = ligandDirs.filter((_, j) => j !== i);
      const away = others.length ? unit(scale(others.reduce((s, o) => add(s, o), [0, 0, 0] as V3), -1)) : ([0, 1, 0] as V3);
      let perp = sub(away, scale(d, dot(away, d)));
      if (norm(perp) < 1e-6) perp = cross(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
      perp = unit(perp);
      if (k > 0) perp = unit(cross(d, perp));
      const ang = (180 - 109.47) * (Math.PI / 180); // ángulo con la prolongación del enlace central–X
      const hd = unit(add(scale(d, Math.cos(ang)), scale(perp, Math.sin(ang))));
      const hp = add(p, scale(hd, covalentBondLength(lig.el, 'H', 1)));
      atoms.push({ el: 'H', x: hp[0], y: hp[1], z: hp[2] });
      bonds.push({ a: li, b: atoms.length - 1, order: 1 });
    }
  });
  const charge = atoms.reduce((s, a) => s + (a.charge ?? 0), 0);
  return {
    id: spec.id, name: spec.name, label: spec.label, atoms, bonds, charge,
    geometry: spec.ligands.length ? 'vsepr' : 'atomo',
    geometryLabel: spec.ligands.length ? VSEPR_GEOMETRY_LABEL : ATOM_GEOMETRY_LABEL,
    method: spec.ligands.length ? VSEPR_METHOD : 'Átomo aislado.',
  };
}

/** Átomo o ion monoatómico aislado (p. ej., Mg o Na⁺), en el origen. */
export function singleAtom(id: string, name: string, el: string, charge = 0, label?: string): Species3D {
  return buildVsepr({ id, name, label: label ?? el, center: el, centerCharge: charge, ligands: [], lonePairs: 0 });
}

/* ------------------------------------------------------------------ utilidades */

/** Conteo de átomos por elemento. */
export function elementCounts(atoms: { el: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of atoms) out[a.el] = (out[a.el] ?? 0) + 1;
  return out;
}

/** Centroide geométrico. */
export function centroid(atoms: { x: number; y: number; z: number }[]): V3 {
  const n = atoms.length || 1;
  return [atoms.reduce((s, a) => s + a.x, 0) / n, atoms.reduce((s, a) => s + a.y, 0) / n, atoms.reduce((s, a) => s + a.z, 0) / n];
}

/** Radio de la esfera que contiene la especie centrada en su centroide (Å). */
export function extent(atoms: { x: number; y: number; z: number }[]): number {
  const c = centroid(atoms);
  return Math.max(0, ...atoms.map((a) => Math.hypot(a.x - c[0], a.y - c[1], a.z - c[2])));
}

/** Distancia entre dos átomos (Å). */
export function atomDistance(s: { atoms: Atom3D[] }, i: number, j: number): number {
  const p = s.atoms[i], q = s.atoms[j];
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
}

/** Ángulo i–v–k (grados). */
export function atomAngle(s: { atoms: Atom3D[] }, i: number, v: number, k: number): number {
  const P = (n: number): V3 => [s.atoms[n].x, s.atoms[n].y, s.atoms[n].z];
  const u = sub(P(i), P(v)), w = sub(P(k), P(v));
  const c = dot(u, w) / (norm(u) * norm(w));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Fórmula de Hill (C, H y luego alfabético; sin C, todo alfabético). */
export function hillFormulaOf(atoms: { el: string }[]): string {
  const c = elementCounts(atoms);
  const keys = Object.keys(c).sort();
  const order = c.C ? ['C', ...(c.H ? ['H'] : []), ...keys.filter((k) => k !== 'C' && k !== 'H')] : keys;
  return order.map((k) => `${k}${c[k] > 1 ? c[k] : ''}`).join('');
}

/** Lee un SDF (texto sin modificar) y lo convierte en especie. */
export function speciesFromSdf(sdf: string, meta: Omit<Species3D, 'atoms' | 'bonds' | 'charge'>): Species3D {
  return speciesFromMolecule(parseSdf(sdf), meta);
}

/** Descripción textual de una especie (para lectores de pantalla). */
export function describeSpecies(s: Species3D): string {
  const counts = elementCounts(s.atoms);
  const comp = Object.entries(counts).map(([el, n]) => `${n} ${el}`).join(', ');
  const bondTxt = s.bonds.length ? `${s.bonds.length} enlaces dibujados` : 'sin enlaces dibujados';
  return `${s.name} (${s.label}): ${s.atoms.length} átomos (${comp}), ${bondTxt}${s.charge ? `, carga neta ${s.charge > 0 ? '+' : '−'}${Math.abs(s.charge)}` : ''}. ${s.geometryLabel}.`;
}

export const ION_ASSEMBLY_LABEL = 'Ilustración educativa: iones dibujados por separado; su disposición no es la del sólido ni la de la disolución';

/**
 * Agrupa varias especies (por ejemplo, Na⁺ y OH⁻) en una sola, colocadas en fila sin enlaces entre ellas. Sirve para
 * mostrar compuestos iónicos dentro de una reacción. La disposición es una ILUSTRACIÓN; las geometrías internas de
 * cada ion conservan su procedencia (VSEPR o PubChem).
 */
export function ionAssembly(id: string, name: string, label: string, parts: Species3D[], gap = 0.9): Species3D {
  const atoms: Atom3D[] = [];
  const bonds: Bond3D[] = [];
  const radii = parts.map((p) => extent(p.atoms) + 0.9);
  const total = radii.reduce((s, r) => s + 2 * r, 0) + gap * (parts.length - 1);
  let x = -total / 2;
  parts.forEach((p, k) => {
    const c = centroid(p.atoms);
    const cx = x + radii[k];
    const start = atoms.length;
    for (const a of p.atoms) atoms.push({ ...a, x: a.x - c[0] + cx, y: a.y - c[1], z: a.z - c[2] });
    for (const b of p.bonds) bonds.push({ a: start + b.a, b: start + b.b, order: b.order });
    x += 2 * radii[k] + gap;
  });
  return {
    id, name, label, atoms, bonds, charge: atoms.reduce((s, a) => s + (a.charge ?? 0), 0),
    geometry: 'atomo', geometryLabel: ION_ASSEMBLY_LABEL,
    method: `Iones: ${[...new Set(parts.map((p) => `${p.label} (${p.geometryLabel.split(':')[0].toLowerCase()})`))].join(', ')}; el kit los coloca en fila (posición ilustrativa).`,
  };
}

/** ¿La escena tiene sólidos iónicos (iones en fila o fragmento de red), que no llevan palitos entre iones? */
export const hasIonicSpecies = (species: Species3D[]): boolean => species.some((s) => s.geometry === 'cristal' || s.geometryLabel === ION_ASSEMBLY_LABEL);
/** Leyenda: por qué no hay palitos entre iones y sí dentro de los iones poliatómicos. */
export const IONIC_STICKS_NOTE = 'Sin palitos entre iones: en un compuesto iónico (Na⁺, Ca²⁺, O²⁻, Cl⁻…) cada ion atrae a los de carga contraria en todas las direcciones, no a un átomo concreto, así que no hay un enlace que dibujar entre dos iones. Dentro de los iones poliatómicos (OH⁻, SO₄²⁻, NO₃⁻, CO₃²⁻…) sí hay palitos: sus átomos están unidos por enlaces covalentes.';

/**
 * Redes cristalinas iónicas cúbicas simples generadas a partir de parámetros de red publicados (modelo calculado).
 *
 * Cada cristal declara su tipo de estructura (posiciones fraccionarias de la celda unidad convencional), el parámetro
 * de red a medido por difracción de rayos X y la densidad publicada, con sus fuentes. Con esos datos el kit CALCULA
 * las posiciones de los iones (r = a·(f + n)), la distancia catión–anión más corta, el número de coordinación y la
 * densidad teórica ρ = Z·M/(N_A·a³), que se compara con la densidad medida publicada.
 * Supuestos: cristal perfecto (sin defectos ni vibración térmica) a temperatura ambiente; los iones son puntos.
 */
import { MASS, ionicRadius, SHANNON_REF } from './elements';
import { type Atom3D, type Species3D } from './species';

export const AVOGADRO = 6.02214076e23; // mol⁻¹ (valor exacto del SI desde 2019)

export type StructureType = 'halita' | 'fluorita' | 'cloruro-cesio';

export interface IonSite { el: string; charge: number; f: [number, number, number] }

const FCC: [number, number, number][] = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];

/** Posiciones fraccionarias de la celda unidad convencional de cada tipo de estructura. */
export function structureSites(type: StructureType, cation: [string, number], anion: [string, number]): IonSite[] {
  const C = (f: [number, number, number]) => ({ el: cation[0], charge: cation[1], f });
  const A = (f: [number, number, number]) => ({ el: anion[0], charge: anion[1], f });
  switch (type) {
    case 'halita': // Fm-3m: cationes en la red fcc y aniones desplazados (½, 0, 0)
      return [...FCC.map(C), ...FCC.map(([x, y, z]) => A([(x + 0.5) % 1, y, z] as [number, number, number]))];
    case 'fluorita': { // Fm-3m: cationes fcc y aniones en los 8 huecos tetraédricos (¼, ¼, ¼)…
      const t: [number, number, number][] = [];
      for (const x of [0.25, 0.75]) for (const y of [0.25, 0.75]) for (const z of [0.25, 0.75]) t.push([x, y, z]);
      return [...FCC.map(C), ...t.map(A)];
    }
    case 'cloruro-cesio': // Pm-3m: catión en (0,0,0) y anión en el centro del cubo
      return [C([0, 0, 0]), A([0.5, 0.5, 0.5])];
  }
}

export interface CrystalDef {
  id: string;
  nombre: string;
  mineral?: string;
  /** Fórmula para mostrar. */
  formula: string;
  /** Fórmula para calcular la masa molar. */
  formulaPlain: string;
  type: StructureType;
  cation: [string, number];
  anion: [string, number];
  /** Parámetro de red a (Å). */
  a: number;
  /** Unidades fórmula por celda convencional. */
  z: number;
  /** Densidad publicada (g/cm³). */
  densityPublished: number;
  sources: { lattice: string; density: string };
}

const WYCKOFF = 'Wyckoff, R. W. G. (1963). Crystal Structures, vol. 1 (2.ª ed.). Nueva York: Interscience (Wiley), capítulo III';
const CRC = 'Haynes, W. M. (ed.) (2016). CRC Handbook of Chemistry and Physics (97.ª ed.). Boca Raton: CRC Press, sección 4 («Physical Constants of Inorganic Compounds»)';

export const CRYSTALS: CrystalDef[] = [
  { id: 'nacl', nombre: 'Cloruro de sodio', mineral: 'halita', formula: 'NaCl', formulaPlain: 'NaCl', type: 'halita', cation: ['Na', 1], anion: ['Cl', -1], a: 5.6402, z: 4, densityPublished: 2.17, sources: { lattice: WYCKOFF, density: CRC } },
  { id: 'kcl', nombre: 'Cloruro de potasio', mineral: 'silvita', formula: 'KCl', formulaPlain: 'KCl', type: 'halita', cation: ['K', 1], anion: ['Cl', -1], a: 6.2931, z: 4, densityPublished: 1.988, sources: { lattice: WYCKOFF, density: CRC } },
  { id: 'mgo', nombre: 'Óxido de magnesio', mineral: 'periclasa', formula: 'MgO', formulaPlain: 'MgO', type: 'halita', cation: ['Mg', 2], anion: ['O', -2], a: 4.2112, z: 4, densityPublished: 3.6, sources: { lattice: WYCKOFF, density: CRC } },
  { id: 'cao', nombre: 'Óxido de calcio', mineral: 'cal viva', formula: 'CaO', formulaPlain: 'CaO', type: 'halita', cation: ['Ca', 2], anion: ['O', -2], a: 4.8105, z: 4, densityPublished: 3.34, sources: { lattice: WYCKOFF, density: CRC } },
  { id: 'caf2', nombre: 'Fluoruro de calcio', mineral: 'fluorita', formula: 'CaF₂', formulaPlain: 'CaF2', type: 'fluorita', cation: ['Ca', 2], anion: ['F', -1], a: 5.4626, z: 4, densityPublished: 3.18, sources: { lattice: WYCKOFF, density: CRC } },
  { id: 'cscl', nombre: 'Cloruro de cesio', formula: 'CsCl', formulaPlain: 'CsCl', type: 'cloruro-cesio', cation: ['Cs', 1], anion: ['Cl', -1], a: 4.123, z: 1, densityPublished: 3.988, sources: { lattice: WYCKOFF, density: CRC } },
];

export const CRYSTAL_GEOMETRY_LABEL = 'Modelo calculado: red generada a partir del parámetro de red publicado (difracción de rayos X)';
export const STRUCTURE_NAME: Record<StructureType, string> = { halita: 'tipo halita (NaCl), cúbica centrada en las caras', fluorita: 'tipo fluorita (CaF₂), cúbica centrada en las caras', 'cloruro-cesio': 'tipo cloruro de cesio, cúbica simple con un ion en el centro' };

export function getCrystal(id: string): CrystalDef {
  const c = CRYSTALS.find((x) => x.id === id);
  if (!c) throw new RangeError(`El kit no tiene el cristal «${id}».`);
  return c;
}

export interface Ion extends Atom3D { charge: number; f: [number, number, number] }

/**
 * Iones de un bloque de n × n × n celdas, incluidos los de las caras, aristas y vértices del borde (para que el
 * bloque se vea completo). Coordenadas en Å con el origen en un vértice del bloque.
 */
export function generateLattice(c: CrystalDef, n = 1): Ion[] {
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new RangeError('El bloque debe tener entre 1 y 4 celdas por arista.');
  const sites = structureSites(c.type, c.cation, c.anion);
  const out: Ion[] = [];
  const seen = new Set<string>();
  const eps = 1e-9;
  for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) for (let k = -1; k <= n; k++) {
    for (const s of sites) {
      const f: [number, number, number] = [s.f[0] + i, s.f[1] + j, s.f[2] + k];
      if (f.some((v) => v < -eps || v > n + eps)) continue;
      const key = f.map((v) => v.toFixed(4)).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ el: s.el, charge: s.charge, f, x: f[0] * c.a, y: f[1] * c.a, z: f[2] * c.a });
    }
  }
  return out;
}

/** Distancias de un ion de la celda central a todos los iones de las celdas vecinas (red periódica). */
function neighborDistances(c: CrystalDef, siteIndex: number): { d: number; el: string; charge: number }[] {
  const sites = structureSites(c.type, c.cation, c.anion);
  const o = sites[siteIndex].f;
  const out: { d: number; el: string; charge: number }[] = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
    sites.forEach((s, idx) => {
      if (idx === siteIndex && i === 0 && j === 0 && k === 0) return;
      const d = c.a * Math.hypot(s.f[0] + i - o[0], s.f[1] + j - o[1], s.f[2] + k - o[2]);
      out.push({ d, el: s.el, charge: s.charge });
    });
  }
  return out.sort((p, q) => p.d - q.d);
}

/** Distancia catión–anión más corta (Å), calculada sobre la red periódica. */
export function cationAnionDistance(c: CrystalDef): number {
  const sites = structureSites(c.type, c.cation, c.anion);
  const ci = sites.findIndex((s) => s.charge > 0);
  return neighborDistances(c, ci).find((x) => x.charge < 0)!.d;
}

/** Número de coordinación: iones de signo contrario a la distancia mínima (tolerancia relativa 1 %). */
export function coordinationNumber(c: CrystalDef, which: 'cation' | 'anion'): number {
  const sites = structureSites(c.type, c.cation, c.anion);
  const idx = sites.findIndex((s) => (which === 'cation' ? s.charge > 0 : s.charge < 0));
  const opp = neighborDistances(c, idx).filter((x) => (which === 'cation' ? x.charge < 0 : x.charge > 0));
  const dmin = opp[0].d;
  return opp.filter((x) => x.d <= dmin * 1.01).length;
}

/** Masa molar de la unidad fórmula (g/mol). */
export function formulaMass(c: CrystalDef): number {
  const sites = structureSites(c.type, c.cation, c.anion);
  const perCell: Record<string, number> = {};
  for (const s of sites) perCell[s.el] = (perCell[s.el] ?? 0) + 1;
  return Object.entries(perCell).reduce((t, [el, n]) => t + (n / c.z) * MASS[el], 0);
}

/** Densidad calculada ρ = Z·M/(N_A·a³) en g/cm³ (a en Å; 1 Å³ = 10⁻²⁴ cm³). */
export function calculatedDensity(c: CrystalDef): number {
  return (c.z * formulaMass(c)) / (AVOGADRO * c.a ** 3 * 1e-24);
}

/** Desviación relativa (%) entre la densidad calculada y la publicada. */
export function densityDeviation(c: CrystalDef): number {
  return ((calculatedDensity(c) - c.densityPublished) / c.densityPublished) * 100;
}

/** Suma de radios iónicos de Shannon para la coordinación calculada (Å). */
export function shannonSum(c: CrystalDef): number {
  return ionicRadius(c.cation[0], coordinationNumber(c, 'cation')) + ionicRadius(c.anion[0], coordinationNumber(c, 'anion'));
}

/** Vecinos de signo contrario más cercanos de un ion del bloque (índices), para dibujar el poliedro de coordinación. */
export function coordinationShell(ions: Ion[], index: number): number[] {
  const o = ions[index];
  const opp = ions.map((q, i) => ({ i, d: Math.hypot(q.x - o.x, q.y - o.y, q.z - o.z), q })).filter((x) => x.i !== index && Math.sign(x.q.charge) !== Math.sign(o.charge));
  if (!opp.length) return [];
  const dmin = Math.min(...opp.map((x) => x.d));
  return opp.filter((x) => x.d <= dmin * 1.01).map((x) => x.i);
}

/**
 * Fragmento de la red con `units` unidades fórmula (iones más cercanos a un catión central), para mostrar un sólido
 * iónico dentro de una reacción. Es una ILUSTRACIÓN: el sólido real continúa en las tres direcciones.
 */
export function latticeFragment(c: CrystalDef, units: number): Species3D {
  const sites = structureSites(c.type, c.cation, c.anion);
  const nCat = sites.filter((s) => s.charge > 0).length / c.z, nAn = sites.filter((s) => s.charge < 0).length / c.z;
  const ions = generateLattice(c, 2);
  const center = ions.filter((x) => x.charge > 0).sort((p, q) => Math.hypot(p.f[0] - 1, p.f[1] - 1, p.f[2] - 1) - Math.hypot(q.f[0] - 1, q.f[1] - 1, q.f[2] - 1))[0];
  const byDist = [...ions].sort((p, q) => Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z) - Math.hypot(q.x - center.x, q.y - center.y, q.z - center.z) || p.x - q.x || p.y - q.y || p.z - q.z);
  const cats = byDist.filter((x) => x.charge > 0).slice(0, units * nCat);
  const ans = byDist.filter((x) => x.charge < 0).slice(0, units * nAn);
  const atoms = [...cats, ...ans].map((x) => ({ el: x.el, charge: x.charge, x: x.x - center.x, y: x.y - center.y, z: x.z - center.z }));
  return {
    id: `fragmento-${c.id}-${units}`, name: `${c.nombre} (fragmento de la red)`, label: units > 1 ? `${units} ${c.formula}` : c.formula,
    atoms, bonds: [], charge: atoms.reduce((s, a) => s + (a.charge ?? 0), 0),
    geometry: 'cristal',
    geometryLabel: `Modelo calculado: fragmento de la red de ${c.formula} (a = ${String(c.a).replace('.', ',')} Å); en el sólido la red continúa`,
    method: `Posiciones r = a·(f + n) de la estructura ${STRUCTURE_NAME[c.type]}; parámetro de red de ${c.sources.lattice}.`,
  };
}

export const CRYSTAL_REFS = { wyckoff: WYCKOFF, crc: CRC, shannon: SHANNON_REF };

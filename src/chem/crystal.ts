/**
 * Redes cristalinas generadas a partir de estructuras PUBLICADAS (modelo calculado).
 *
 * Cada cristal declara su tipo de estructura (grupo espacial, posiciones de Wyckoff y, si las hay, coordenadas libres),
 * los parámetros de red medidos por difracción (a y, en las celdas no cúbicas, c), la densidad publicada y sus fuentes.
 * Con esos datos el kit CALCULA:
 *  - las posiciones de todos los átomos de la celda aplicando las operaciones de simetría del grupo espacial a la unidad
 *    asimétrica (r = f·M, con M la matriz de los vectores de la celda), sin coordenadas a mano;
 *  - las distancias catión–anión, el número de coordinación (vecinos de signo contrario hasta 1,10 × la distancia
 *    mínima, la misma ventana para todos) y la densidad teórica ρ = Z·M/(N_A·V), que se compara con la publicada.
 * Supuestos: cristal perfecto (sin defectos ni vibración térmica) a temperatura ambiente; los átomos son puntos.
 *
 * Fuentes de las estructuras (ver CRYSTALS): Wyckoff (1963) para las cúbicas; para el rutilo, a y c del CRC Handbook
 * (60.ª ed., citado en PubChem) y x(O) de Abrahams y Bernstein (1971); para el corindón, el CIF de la AMCSD 0009325
 * (Lewis, Schwarzenbach y Flack, 1982); para el cuarzo α, Levien, Prewitt y Weidner (1980). Densidades publicadas:
 * src/data/quimica/cristales-pubchem.json (scripts/validacion/cristales_pubchem.mjs), con la fuente original de cada valor.
 * No se incluyen el CaSO₄ (anhidrita), el SrO ni las sales de amonio: ver CRYSTALS_NOT_INCLUDED.
 */
import { MASS, ionicRadius, SHANNON_REF } from './elements';
import { type Atom3D, type Bond3D, type Species3D } from './species';

export const AVOGADRO = 6.02214076e23; // mol⁻¹ (valor exacto del SI desde 2019)

export type StructureType = 'halita' | 'fluorita' | 'antifluorita' | 'cloruro-cesio' | 'blenda' | 'rutilo' | 'corindon' | 'cuarzo';
export type LatticeSystem = 'cubica' | 'tetragonal' | 'hexagonal';
export type Bonding = 'ionico' | 'covalente';
type F3 = [number, number, number];

export interface IonSite { el: string; charge: number; f: F3 }

export interface CrystalDef {
  id: string;
  nombre: string;
  mineral?: string;
  /** Fórmula para mostrar. */
  formula: string;
  /** Fórmula para calcular la masa molar y para buscar el cristal de un compuesto. */
  formulaPlain: string;
  type: StructureType;
  /** Catión (o átomo menos electronegativo en una red covalente) y su carga formal. */
  cation: [string, number];
  anion: [string, number];
  /** Parámetro de red a (Å). */
  a: number;
  /** Parámetro de red c (Å) de las celdas tetragonales y hexagonales. */
  c?: number;
  /** Coordenadas libres de las posiciones de Wyckoff (fracciones de la celda). */
  pos?: Record<string, number>;
  /** Unidades fórmula por celda convencional. */
  z: number;
  /** Red iónica (sin palitos entre iones) o red covalente (enlaces dibujados). */
  bonding: Bonding;
  /** Densidad publicada (g/cm³): la elegida en src/data/quimica/cristales-pubchem.json. */
  densityPublished: number;
  /** Explicación cuando la densidad calculada y la publicada difieren más de un 3 %. */
  densityNote?: string;
  sources: {
    /** Referencia completa de la estructura (parámetros de red y posiciones). */
    lattice: string;
    /** Cita corta para el rótulo del visor. */
    short: string;
    /** Referencia de la densidad publicada (la fuente original, vía PubChem). */
    density: string;
  };
}

/* ------------------------------------------------------------------ simetría */

/** Operación de simetría «x,y,z» (notación de los CIF y de las Tablas Internacionales) → función afín. */
export function parseSymop(op: string): (f: F3) => F3 {
  const rows = op.replace(/\s+/g, '').split(',');
  if (rows.length !== 3) throw new RangeError(`Operación de simetría mal escrita: «${op}»`);
  const parsed = rows.map((row) => {
    const coef = { x: 0, y: 0, z: 0 } as Record<'x' | 'y' | 'z', number>;
    let k = 0;
    for (const t of row.replace(/-/g, '+-').split('+').filter(Boolean)) {
      const m = /^(-?)(\d+(?:\/\d+)?)?([xyz])?$/.exec(t);
      if (!m) throw new RangeError(`Término no reconocido «${t}» en «${op}»`);
      const sign = m[1] ? -1 : 1;
      const num = m[2] ? m[2].split('/').map(Number).reduce((p, q) => p / q) : 1;
      if (m[3]) coef[m[3] as 'x' | 'y' | 'z'] += sign * num; else k += sign * num;
    }
    return { ...coef, k };
  });
  return ([x, y, z]) => parsed.map((p) => p.x * x + p.y * y + p.z * z + p.k) as F3;
}

const mod1 = (v: number) => { const r = v - Math.floor(v); return r > 1 - 1e-6 || r < 1e-6 ? 0 : r; };

/** Aplica las operaciones a la unidad asimétrica y devuelve las posiciones distintas de la celda (fracciones en [0, 1)). */
export function expandSites(ops: string[], asym: IonSite[]): IonSite[] {
  const fns = ops.map(parseSymop);
  const out: IonSite[] = [];
  for (const s of asym) {
    for (const fn of fns) {
      const f = fn(s.f).map(mod1) as F3;
      const dup = out.some((o) => o.el === s.el && o.f.every((v, i) => { const d = Math.abs(v - f[i]); return Math.min(d, 1 - d) < 1e-5; }));
      if (!dup) out.push({ ...s, f });
    }
  }
  return out;
}

/** Grupo P4₂/mnm (n.º 136), posiciones generales (Tablas Internacionales de Cristalografía, vol. A). */
const OPS_P42MNM = ['x,y,z', '-x,-y,z', '1/2-y,1/2+x,1/2+z', '1/2+y,1/2-x,1/2+z', '1/2-x,1/2+y,1/2-z', '1/2+x,1/2-y,1/2-z', 'y,x,-z', '-y,-x,-z',
  '-x,-y,-z', 'x,y,-z', '1/2+y,1/2-x,1/2-z', '1/2-y,1/2+x,1/2-z', '1/2+x,1/2-y,1/2+z', '1/2-x,1/2+y,1/2+z', '-y,-x,z', 'y,x,z'];
/** Grupo R-3c (n.º 167, ejes hexagonales): las 36 operaciones del CIF de la AMCSD 0009325 (corindón). */
const OPS_R3C = ['x,y,z', '2/3+x,1/3+y,1/3+z', '1/3+x,2/3+y,2/3+z', 'x,x-y,1/2+z', '2/3+x,1/3+x-y,5/6+z', '1/3+x,2/3+x-y,1/6+z', 'y,x,1/2-z',
  '2/3+y,1/3+x,5/6-z', '1/3+y,2/3+x,1/6-z', '-x+y,y,1/2+z', '2/3-x+y,1/3+y,5/6+z', '1/3-x+y,2/3+y,1/6+z', '-x,-x+y,1/2-z', '2/3-x,1/3-x+y,5/6-z',
  '1/3-x,2/3-x+y,1/6-z', '-y,-x,1/2+z', '2/3-y,1/3-x,5/6+z', '1/3-y,2/3-x,1/6+z', 'x-y,-y,1/2-z', '2/3+x-y,1/3-y,5/6-z', '1/3+x-y,2/3-y,1/6-z',
  'y,-x+y,-z', '2/3+y,1/3-x+y,1/3-z', '1/3+y,2/3-x+y,2/3-z', '-x+y,-x,z', '2/3-x+y,1/3-x,1/3+z', '1/3-x+y,2/3-x,2/3+z', '-x,-y,-z', '2/3-x,1/3-y,1/3-z',
  '1/3-x,2/3-y,2/3-z', '-y,x-y,z', '2/3-y,1/3+x-y,1/3+z', '1/3-y,2/3+x-y,2/3+z', 'x-y,x,-z', '2/3+x-y,1/3+x,1/3-z', '1/3+x-y,2/3+x,2/3-z'];
/** Grupo P3₂21 (n.º 154), posición general 6c (Tablas Internacionales, vol. A). */
const OPS_P3221 = ['x,y,z', '-y,x-y,z+2/3', '-x+y,-x,z+1/3', 'y,x,-z', 'x-y,-y,-z+1/3', '-x,-x+y,-z+2/3'];

const FCC: F3[] = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
const TET8: F3[] = [];
for (const x of [0.25, 0.75]) for (const y of [0.25, 0.75]) for (const z of [0.25, 0.75]) TET8.push([x, y, z]);

export const SPACE_GROUP: Record<StructureType, string> = {
  halita: 'Fm3̄m (n.º 225)', fluorita: 'Fm3̄m (n.º 225)', antifluorita: 'Fm3̄m (n.º 225)', 'cloruro-cesio': 'Pm3̄m (n.º 221)',
  blenda: 'F4̄3m (n.º 216)', rutilo: 'P4₂/mnm (n.º 136)', corindon: 'R3̄c (n.º 167, ejes hexagonales)', cuarzo: 'P3₂21 (n.º 154)',
};

export const SYSTEM_OF: Record<StructureType, LatticeSystem> = {
  halita: 'cubica', fluorita: 'cubica', antifluorita: 'cubica', 'cloruro-cesio': 'cubica', blenda: 'cubica', rutilo: 'tetragonal', corindon: 'hexagonal', cuarzo: 'hexagonal',
};

/** Posiciones fraccionarias de la celda unidad convencional de un cristal. */
export function structureSites(c: CrystalDef): IonSite[] {
  const C = (f: F3): IonSite => ({ el: c.cation[0], charge: c.cation[1], f });
  const A = (f: F3): IonSite => ({ el: c.anion[0], charge: c.anion[1], f });
  const p = (k: string) => {
    const v = c.pos?.[k];
    if (v === undefined) throw new RangeError(`Falta la coordenada «${k}» del cristal ${c.id}.`);
    return v;
  };
  switch (c.type) {
    case 'halita': // 4a (0,0,0) y 4b (½,½,½) de Fm3̄m: cationes fcc y aniones desplazados (½, 0, 0)
      return [...FCC.map(C), ...FCC.map(([x, y, z]) => A([(x + 0.5) % 1, y, z]))];
    case 'fluorita': // 4a + 8c: cationes fcc y aniones en los 8 huecos tetraédricos (¼, ¼, ¼)…
      return [...FCC.map(C), ...TET8.map(A)];
    case 'antifluorita': // la misma red con los papeles invertidos: aniones fcc (4a) y cationes en los huecos tetraédricos (8c)
      return [...TET8.map(C), ...FCC.map(A)];
    case 'blenda': // F4̄3m: 4a (0,0,0) y 4c (¼,¼,¼): cationes fcc y aniones en la MITAD de los huecos tetraédricos
      return [...FCC.map(C), ...FCC.map(([x, y, z]) => A([x + 0.25, y + 0.25, z + 0.25]))];
    case 'cloruro-cesio': // Pm3̄m: 1a (0,0,0) y 1b (½,½,½)
      return [C([0, 0, 0]), A([0.5, 0.5, 0.5])];
    case 'rutilo': // P4₂/mnm: Ti en 2a (0,0,0); O en 4f (x,x,0)
      return expandSites(OPS_P42MNM, [C([0, 0, 0]), A([p('xO'), p('xO'), 0])]);
    case 'corindon': // R3̄c: Al en 12c (0,0,z); O en 18e (x,0,¼)
      return expandSites(OPS_R3C, [C([0, 0, p('zAl')]), A([p('xO'), 0, 0.25])]);
    case 'cuarzo': // P3₂21: Si en 3a (x,0,⅔); O en 6c (x,y,z)
      return expandSites(OPS_P3221, [C([p('xSi'), 0, 2 / 3]), A([p('xO'), p('yO'), p('zO')])]);
  }
}

/** Matriz de la celda: filas = vectores a, b, c en Å (c sobre z; en la hexagonal, γ = 120°). */
export function cellMatrix(c: CrystalDef): [F3, F3, F3] {
  const sys = SYSTEM_OF[c.type];
  const cc = c.c ?? c.a;
  if (sys === 'cubica') return [[c.a, 0, 0], [0, c.a, 0], [0, 0, c.a]];
  if (sys === 'tetragonal') return [[c.a, 0, 0], [0, c.a, 0], [0, 0, cc]];
  return [[c.a, 0, 0], [-c.a / 2, (c.a * Math.sqrt(3)) / 2, 0], [0, 0, cc]];
}

export const toCart = (M: [F3, F3, F3], f: F3): F3 => [0, 1, 2].map((j) => f[0] * M[0][j] + f[1] * M[1][j] + f[2] * M[2][j]) as F3;

/** Volumen de la celda convencional (Å³). */
export function cellVolume(c: CrystalDef): number {
  const sys = SYSTEM_OF[c.type];
  const cc = c.c ?? c.a;
  return sys === 'cubica' ? c.a ** 3 : sys === 'tetragonal' ? c.a * c.a * cc : (Math.sqrt(3) / 2) * c.a * c.a * cc;
}

/* ------------------------------------------------------------------ catálogo */

const WYCKOFF = 'Wyckoff, R. W. G. (1963). Crystal Structures, vol. 1 (2.ª ed.). Nueva York: Interscience (Wiley), capítulos III y IV';
/** Parámetros añadidos en la versión 2.8.0 sin poder consultar la obra desde el entorno de desarrollo: se muestran como «por verificar». */
const WYCKOFF_PV = `${'Wyckoff, R. W. G. (1963). Crystal Structures, vol. 1 (2.ª ed.)'}; valor por verificar contra la fuente (no se pudo consultar al incorporarlo)`;
const CRC = 'Haynes, W. M. (ed.) (2016). CRC Handbook of Chemistry and Physics (97.ª ed.). Boca Raton: CRC Press, sección 4 («Physical Constants of Inorganic Compounds»)';
const viaPubChem = (cita: string, cid: number) => `${cita}; valor citado en PubChem (CID ${cid}), consulta del 2026-10-26 (scripts/validacion/cristales_pubchem.mjs)`;
const PAC = (cid: number) => viaPubChem('PAC Chemical Database (U.S. Department of Energy)', cid);
const LOW_MEASURED = 'La densidad tabulada procede de una medición macroscópica y es menor que la calculada con la red. Una explicación posible (no comprobada aquí) es que la muestra medida tenía poros o había reaccionado en parte con la humedad y el CO₂ del aire, a los que este óxido es muy sensible; la calculada es la del cristal ideal.';

export const CRYSTALS: CrystalDef[] = [
  { id: 'nacl', nombre: 'Cloruro de sodio', mineral: 'halita', formula: 'NaCl', formulaPlain: 'NaCl', type: 'halita', cation: ['Na', 1], anion: ['Cl', -1], a: 5.6402, z: 4, bonding: 'ionico', densityPublished: 2.17, sources: { lattice: WYCKOFF, short: 'Wyckoff, 1963', density: CRC } },
  { id: 'kcl', nombre: 'Cloruro de potasio', mineral: 'silvita', formula: 'KCl', formulaPlain: 'KCl', type: 'halita', cation: ['K', 1], anion: ['Cl', -1], a: 6.2931, z: 4, bonding: 'ionico', densityPublished: 1.988, sources: { lattice: WYCKOFF, short: 'Wyckoff, 1963', density: CRC } },
  { id: 'mgo', nombre: 'Óxido de magnesio', mineral: 'periclasa', formula: 'MgO', formulaPlain: 'MgO', type: 'halita', cation: ['Mg', 2], anion: ['O', -2], a: 4.2112, z: 4, bonding: 'ionico', densityPublished: 3.6, sources: { lattice: WYCKOFF, short: 'Wyckoff, 1963', density: CRC } },
  { id: 'cao', nombre: 'Óxido de calcio', mineral: 'cal viva', formula: 'CaO', formulaPlain: 'CaO', type: 'halita', cation: ['Ca', 2], anion: ['O', -2], a: 4.8105, z: 4, bonding: 'ionico', densityPublished: 3.34, sources: { lattice: WYCKOFF, short: 'Wyckoff, 1963', density: CRC } },
  { id: 'caf2', nombre: 'Fluoruro de calcio', mineral: 'fluorita', formula: 'CaF₂', formulaPlain: 'CaF2', type: 'fluorita', cation: ['Ca', 2], anion: ['F', -1], a: 5.4626, z: 4, bonding: 'ionico', densityPublished: 3.18, sources: { lattice: WYCKOFF, short: 'Wyckoff, 1963', density: CRC } },
  { id: 'cscl', nombre: 'Cloruro de cesio', formula: 'CsCl', formulaPlain: 'CsCl', type: 'cloruro-cesio', cation: ['Cs', 1], anion: ['Cl', -1], a: 4.123, z: 1, bonding: 'ionico', densityPublished: 3.988, sources: { lattice: WYCKOFF, short: 'Wyckoff, 1963', density: CRC } },
  // v2.8.0: más sólidos iónicos con estructura publicada.
  { id: 'li2o', nombre: 'Óxido de litio', formula: 'Li₂O', formulaPlain: 'Li2O', type: 'antifluorita', cation: ['Li', 1], anion: ['O', -2], a: 4.619, z: 4, bonding: 'ionico', densityPublished: 2.013, sources: { lattice: WYCKOFF_PV, short: 'Wyckoff, 1963 (por verificar)', density: PAC(166630) } },
  { id: 'na2o', nombre: 'Óxido de sodio', formula: 'Na₂O', formulaPlain: 'Na2O', type: 'antifluorita', cation: ['Na', 1], anion: ['O', -2], a: 5.55, z: 4, bonding: 'ionico', densityPublished: 2.27, densityNote: LOW_MEASURED, sources: { lattice: WYCKOFF_PV, short: 'Wyckoff, 1963 (por verificar)', density: PAC(73971) } },
  { id: 'k2o', nombre: 'Óxido de potasio', formula: 'K₂O', formulaPlain: 'K2O', type: 'antifluorita', cation: ['K', 1], anion: ['O', -2], a: 6.436, z: 4, bonding: 'ionico', densityPublished: 2.3, sources: { lattice: WYCKOFF_PV, short: 'Wyckoff, 1963 (por verificar)', density: viaPubChem('International Chemical Safety Cards (ILO-OMS), ficha del óxido de potasio (valor con 2 cifras)', 9989219) } },
  { id: 'bao', nombre: 'Óxido de bario', formula: 'BaO', formulaPlain: 'BaO', type: 'halita', cation: ['Ba', 2], anion: ['O', -2], a: 5.523, z: 4, bonding: 'ionico', densityPublished: 5.72, densityNote: LOW_MEASURED, sources: { lattice: WYCKOFF_PV, short: 'Wyckoff, 1963 (por verificar)', density: PAC(62392) } },
  { id: 'zns', nombre: 'Sulfuro de cinc', mineral: 'blenda (esfalerita)', formula: 'ZnS', formulaPlain: 'ZnS', type: 'blenda', cation: ['Zn', 2], anion: ['S', -2], a: 5.4093, z: 4, bonding: 'ionico', densityPublished: 4.04,
    sources: { lattice: WYCKOFF_PV, short: 'Wyckoff, 1963 (por verificar)', density: viaPubChem('Lide, D. R. (ed.) (2005). CRC Handbook of Chemistry and Physics (86.ª ed.), p. 4-96 (esfalerita), citado por la HSDB', 9833931) } },
  { id: 'tio2', nombre: 'Óxido de titanio(IV)', mineral: 'rutilo', formula: 'TiO₂', formulaPlain: 'TiO2', type: 'rutilo', cation: ['Ti', 4], anion: ['O', -2], a: 4.5937, c: 2.9618, pos: { xO: 0.30478 }, z: 2, bonding: 'ionico', densityPublished: 4.23,
    sources: {
      lattice: `a y c: Weast, R. C. (ed.) (1979). CRC Handbook of Chemistry and Physics (60.ª ed.), p. B-200 (rutilo, P4₂/mnm; ${viaPubChem('texto de la HSDB', 26042)}); coordenada x(O) = 0,30478: Abrahams, S. C. y Bernstein, J. L. (1971). Rutile: normal probability plot analysis and accurate measurement of crystal structure. Journal of Chemical Physics, 55, 3206–3211`,
      short: 'CRC 60.ª ed. y Abrahams y Bernstein, 1971',
      density: viaPubChem('Lide, D. R. (ed.) (2000). CRC Handbook of Chemistry and Physics (81.ª ed.), p. 4-94, citado por la HSDB (el registro no nombra el polimorfo; para la brookita el CRC da 4,17)', 26042),
    } },
  { id: 'al2o3', nombre: 'Óxido de aluminio', mineral: 'corindón (α-alúmina)', formula: 'Al₂O₃', formulaPlain: 'Al2O3', type: 'corindon', cation: ['Al', 3], anion: ['O', -2], a: 4.7602, c: 12.9933, pos: { zAl: 0.35216, xO: 0.30624 }, z: 6, bonding: 'ionico', densityPublished: 3.99,
    sources: {
      lattice: 'Lewis, J., Schwarzenbach, D. y Flack, H. D. (1982). Electric field gradients and charge density in corundum, α-Al₂O₃. Acta Crystallographica A, 38, 733–739; CIF de la American Mineralogist Crystal Structure Database (AMCSD 0009325), leído del paquete Dans_Diffraction 3.4.0 (PyPI) porque el sitio de la AMCSD no era accesible desde el entorno de desarrollo',
      short: 'Lewis y otros, 1982 (AMCSD 0009325)',
      density: PAC(9989226),
    } },
  { id: 'sio2', nombre: 'Dióxido de silicio', mineral: 'cuarzo α', formula: 'SiO₂', formulaPlain: 'SiO2', type: 'cuarzo', cation: ['Si', 4], anion: ['O', -2], a: 4.916, c: 5.4054, pos: { xSi: 0.4697, xO: 0.4135, yO: 0.2669, zO: 0.1191 + 2 / 3 }, z: 3, bonding: 'covalente', densityPublished: 2.648,
    sources: {
      lattice: 'Levien, L., Prewitt, C. T. y Weidner, D. J. (1980). Structure and elastic properties of quartz at pressure. American Mineralogist, 65, 920–930 (a = 4,9160 Å, c = 5,4054 Å; Si x = 0,4697; O 0,4135, 0,2669, 0,1191), escritas en el origen de las Tablas Internacionales para P3₂21 (Si en 3a = (x, 0, ⅔), por eso z(O) = 0,1191 + ⅔); los mismos valores figuran en xrayutilities 1.8.0. Comprobación: Si–O = 1,605 y 1,614 Å y Si–O–Si = 143,7°, como en el artículo',
      short: 'Levien y otros, 1980',
      density: viaPubChem('IARC Monographs (Silica), tabla de polimorfos (cuarzo α), citado por la HSDB', 24261),
    } },
];

/** Sólidos pedidos que el kit NO dibuja todavía, con el motivo (se muestran en la documentación y en las pruebas). */
export const CRYSTALS_NOT_INCLUDED: { formula: string; motivo: string }[] = [
  { formula: 'CaSO₄ (anhidrita)', motivo: 'Su celda (Cmcm/Amma, 24 átomos) necesita las coordenadas de tres oxígenos y del S de un artículo de refinamiento (p. ej., Hawthorne y Ferguson, 1975) que no se pudo consultar desde el entorno (AMCSD, COD e ICSD bloqueados). No se construye de memoria.' },
  { formula: 'SrO', motivo: 'Tiene estructura de halita, pero PubChem no trae una densidad publicada con la que comparar la calculada.' },
  { formula: 'NH₄Cl y demás sales de amonio', motivo: 'El NH₄⁺ gira o se desordena en el cristal (fases del NH₄Cl): dibujarlo como una esfera, o con una orientación fija, sería engañoso. El taller muestra el ion NH₄⁺ con sus cuatro enlaces N–H.' },
];

export const CRYSTAL_GEOMETRY_LABEL = 'Modelo calculado: red generada a partir de la estructura publicada (difracción de rayos X)';
export const STRUCTURE_NAME: Record<StructureType, string> = {
  halita: 'tipo halita (NaCl), cúbica centrada en las caras',
  fluorita: 'tipo fluorita (CaF₂), cúbica centrada en las caras',
  antifluorita: 'tipo antifluorita: los aniones forman la red cúbica centrada en las caras y los cationes ocupan los 8 huecos tetraédricos',
  'cloruro-cesio': 'tipo cloruro de cesio, cúbica simple con un ion en el centro',
  blenda: 'tipo blenda (ZnS), cúbica centrada en las caras con la mitad de los huecos tetraédricos ocupados',
  rutilo: 'tipo rutilo (TiO₂), tetragonal: octaedros TiO₆ que comparten aristas',
  corindon: 'tipo corindón (α-Al₂O₃), trigonal (romboédrica): O casi hexagonal compacto con Al en 2/3 de los huecos octaédricos',
  cuarzo: 'cuarzo α, trigonal: red covalente de tetraedros SiO₄ unidos por los vértices, en hélices',
};

export function getCrystal(id: string): CrystalDef {
  const c = CRYSTALS.find((x) => x.id === id);
  if (!c) throw new RangeError(`El kit no tiene el cristal «${id}».`);
  return c;
}

/* ------------------------------------------------------------------ red y distancias */

export interface Ion extends Atom3D { charge: number; f: F3 }

/** Ventana de coordinación: vecinos de signo contrario hasta 1,10 × la distancia mínima (Ti–O 1,949/1,980; Al–O 1,855/1,972). */
export const CN_WINDOW = 1.1;

/**
 * Átomos de un bloque de n × n × n celdas, incluidos los de las caras, aristas y vértices del borde (para que el
 * bloque se vea completo). Coordenadas en Å con el origen en un vértice del bloque.
 */
export function generateLattice(c: CrystalDef, n = 1): Ion[] {
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new RangeError('El bloque debe tener entre 1 y 4 celdas por arista.');
  const sites = structureSites(c);
  const M = cellMatrix(c);
  const out: Ion[] = [];
  const seen = new Set<string>();
  const eps = 1e-6;
  for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) for (let k = -1; k <= n; k++) {
    for (const s of sites) {
      const f: F3 = [s.f[0] + i, s.f[1] + j, s.f[2] + k];
      if (f.some((v) => v < -eps || v > n + eps)) continue;
      const key = f.map((v) => v.toFixed(4)).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const [x, y, z] = toCart(M, f);
      out.push({ el: s.el, charge: s.charge, f, x, y, z });
    }
  }
  return out;
}

/** Distancias de un sitio de la celda central a todos los átomos de las celdas vecinas (red periódica). */
function neighborDistances(c: CrystalDef, siteIndex: number): { d: number; el: string; charge: number; v: F3 }[] {
  const sites = structureSites(c);
  const M = cellMatrix(c);
  const o = toCart(M, sites[siteIndex].f);
  const out: { d: number; el: string; charge: number; v: F3 }[] = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
    sites.forEach((s, idx) => {
      if (idx === siteIndex && i === 0 && j === 0 && k === 0) return;
      const p = toCart(M, [s.f[0] + i, s.f[1] + j, s.f[2] + k]);
      const v: F3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
      out.push({ d: Math.hypot(...v), el: s.el, charge: s.charge, v });
    });
  }
  return out.sort((p, q) => p.d - q.d);
}

const firstSite = (c: CrystalDef, which: 'cation' | 'anion') => structureSites(c).findIndex((s) => (which === 'cation' ? s.charge > 0 : s.charge < 0));
const oppositeShell = (c: CrystalDef, which: 'cation' | 'anion') => {
  const opp = neighborDistances(c, firstSite(c, which)).filter((x) => (which === 'cation' ? x.charge < 0 : x.charge > 0));
  const dmin = opp[0].d;
  return opp.filter((x) => x.d <= dmin * CN_WINDOW);
};

/** Distancia catión–anión más corta (Å), calculada sobre la red periódica. */
export function cationAnionDistance(c: CrystalDef): number {
  return oppositeShell(c, 'cation')[0].d;
}

/** Número de coordinación: átomos de signo contrario hasta CN_WINDOW × la distancia mínima. */
export function coordinationNumber(c: CrystalDef, which: 'cation' | 'anion'): number {
  return oppositeShell(c, which).length;
}

/** Distancias distintas del poliedro de coordinación (agrupadas a 0,001 Å) con cuántos vecinos hay a cada una. */
export function shellDistances(c: CrystalDef, which: 'cation' | 'anion' = 'cation'): { d: number; n: number }[] {
  const out: { d: number; n: number }[] = [];
  for (const x of oppositeShell(c, which)) {
    const g = out.find((o) => Math.abs(o.d - x.d) < 1e-3);
    if (g) g.n++; else out.push({ d: x.d, n: 1 });
  }
  return out;
}

/** Ángulos (°) catión–anión–catión en torno a un anión (p. ej., Si–O–Si en el cuarzo). */
export function bridgeAngles(c: CrystalDef): number[] {
  const sh = oppositeShell(c, 'anion');
  const out: number[] = [];
  for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) {
    const [p, q] = [sh[i].v, sh[j].v];
    out.push((Math.acos((p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / (sh[i].d * sh[j].d)) * 180) / Math.PI);
  }
  return out;
}

/** Contenido de la celda por elemento (cuenta los sitios distintos). */
export function cellContent(c: CrystalDef): Record<string, number> {
  const perCell: Record<string, number> = {};
  for (const s of structureSites(c)) perCell[s.el] = (perCell[s.el] ?? 0) + 1;
  return perCell;
}

/** Masa molar de la unidad fórmula (g/mol). */
export function formulaMass(c: CrystalDef): number {
  return Object.entries(cellContent(c)).reduce((t, [el, n]) => t + (n / c.z) * MASS[el], 0);
}

/** Densidad calculada ρ = Z·M/(N_A·V) en g/cm³ (V en Å³; 1 Å³ = 10⁻²⁴ cm³). */
export function calculatedDensity(c: CrystalDef): number {
  return (c.z * formulaMass(c)) / (AVOGADRO * cellVolume(c) * 1e-24);
}

/** Desviación relativa (%) entre la densidad calculada y la publicada. */
export function densityDeviation(c: CrystalDef): number {
  return ((calculatedDensity(c) - c.densityPublished) / c.densityPublished) * 100;
}

/** Suma de radios iónicos de Shannon para la coordinación calculada (Å); null en las redes covalentes. */
export function shannonSum(c: CrystalDef): number | null {
  if (c.bonding === 'covalente') return null;
  return ionicRadius(c.cation[0], coordinationNumber(c, 'cation')) + ionicRadius(c.anion[0], coordinationNumber(c, 'anion'));
}

/** Expresión de la distancia más corta en función de a, para las redes cúbicas. */
export const DISTANCE_EXPR: Partial<Record<StructureType, string>> = { halita: 'a/2', fluorita: 'a·√3/4', antifluorita: 'a·√3/4', blenda: 'a·√3/4', 'cloruro-cesio': 'a·√3/2' };

/** Vecinos de signo contrario más cercanos de un átomo del bloque (índices), para dibujar el poliedro de coordinación. */
export function coordinationShell(ions: Ion[], index: number): number[] {
  const o = ions[index];
  const opp = ions.map((q, i) => ({ i, d: Math.hypot(q.x - o.x, q.y - o.y, q.z - o.z), q })).filter((x) => x.i !== index && Math.sign(x.q.charge) !== Math.sign(o.charge));
  if (!opp.length) return [];
  const dmin = Math.min(...opp.map((x) => x.d));
  return opp.filter((x) => x.d <= dmin * CN_WINDOW).map((x) => x.i);
}

/**
 * Poliedro de coordinación COMPLETO de un átomo del bloque, calculado en la red periódica: devuelve los vecinos de
 * signo contrario (hasta CN_WINDOW × la distancia mínima) con su índice en el bloque si están dibujados, o con sus
 * coordenadas si caen en una celda contigua (en celdas estrechas, como la del corindón, parte del octaedro queda fuera
 * del bloque y no se debe mostrar un poliedro incompleto).
 */
export function periodicShell(c: CrystalDef, ions: Ion[], index: number): { index: number | null; ion: Ion }[] {
  const o = ions[index];
  const sites = structureSites(c);
  const M = cellMatrix(c);
  const base = o.f.map(Math.floor) as F3;
  const cand: Ion[] = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
    for (const s of sites) {
      if (Math.sign(s.charge) === Math.sign(o.charge)) continue;
      const f: F3 = [s.f[0] + base[0] + i, s.f[1] + base[1] + j, s.f[2] + base[2] + k];
      const [x, y, z] = toCart(M, f);
      cand.push({ el: s.el, charge: s.charge, f, x, y, z });
    }
  }
  const d = (q: Ion) => Math.hypot(q.x - o.x, q.y - o.y, q.z - o.z);
  const dmin = Math.min(...cand.map(d).filter((v) => v > 1e-6));
  return cand.filter((q) => d(q) > 1e-6 && d(q) <= dmin * CN_WINDOW).map((q) => {
    const at = ions.findIndex((p) => Math.abs(p.x - q.x) < 1e-4 && Math.abs(p.y - q.y) < 1e-4 && Math.abs(p.z - q.z) < 1e-4);
    return { index: at >= 0 ? at : null, ion: q };
  });
}

/** Enlaces de una red covalente dentro del bloque: pares de signo contrario a menos de CN_WINDOW × la distancia mínima. */
export function networkBonds(c: CrystalDef, atoms: { x: number; y: number; z: number; charge?: number }[]): Bond3D[] {
  const cut = cationAnionDistance(c) * CN_WINDOW;
  const out: Bond3D[] = [];
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
    const p = atoms[i], q = atoms[j];
    if (Math.sign(p.charge ?? 0) === Math.sign(q.charge ?? 0)) continue;
    if (Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) <= cut) out.push({ a: i, b: j, order: 1 });
  }
  return out;
}

/**
 * Fragmento de la red con `units` unidades fórmula (átomos más cercanos a un catión central), para mostrar un sólido
 * dentro de una reacción. Es una ILUSTRACIÓN: el sólido real continúa en las tres direcciones. En las redes covalentes
 * el fragmento lleva sus enlaces y los átomos no llevan carga (no son iones).
 */
export function latticeFragment(c: CrystalDef, units: number): Species3D {
  const sites = structureSites(c);
  const nCat = sites.filter((s) => s.charge > 0).length / c.z, nAn = sites.filter((s) => s.charge < 0).length / c.z;
  const ions = generateLattice(c, 2);
  const center = ions.filter((x) => x.charge > 0).sort((p, q) => Math.hypot(p.f[0] - 1, p.f[1] - 1, p.f[2] - 1) - Math.hypot(q.f[0] - 1, q.f[1] - 1, q.f[2] - 1))[0];
  const byDist = [...ions].sort((p, q) => Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z) - Math.hypot(q.x - center.x, q.y - center.y, q.z - center.z) || p.x - q.x || p.y - q.y || p.z - q.z);
  const cats = byDist.filter((x) => x.charge > 0).slice(0, units * nCat);
  const ans = byDist.filter((x) => x.charge < 0).slice(0, units * nAn);
  const cov = c.bonding === 'covalente';
  const raw = [...cats, ...ans].map((x) => ({ el: x.el, charge: x.charge, x: x.x - center.x, y: x.y - center.y, z: x.z - center.z }));
  const bonds = cov ? networkBonds(c, raw) : [];
  const atoms = cov ? raw.map(({ el, x, y, z }) => ({ el, x, y, z })) : raw;
  const fmtA = (v: number) => String(v).replace('.', ',');
  return {
    id: `fragmento-${c.id}-${units}`, name: `${c.nombre} (fragmento de la red)`, label: units > 1 ? `${units} ${c.formula}` : c.formula,
    atoms, bonds, charge: cov ? 0 : raw.reduce((s, a) => s + (a.charge ?? 0), 0),
    geometry: 'cristal',
    geometryLabel: `Modelo calculado: fragmento de la red de ${c.formula} (a = ${fmtA(c.a)} Å${c.c ? `, c = ${fmtA(c.c)} Å` : ''}); en el sólido la red continúa`,
    method: `Posiciones r = f·M de la estructura ${STRUCTURE_NAME[c.type]} (grupo ${SPACE_GROUP[c.type]}); estructura de ${c.sources.short}.`,
  };
}

/** Cristal del kit cuya fórmula coincide con la composición dada (fórmula de Hill), o null. */
export function crystalForComposition(comp: Record<string, number>): CrystalDef | null {
  const norm = (o: Record<string, number>) => Object.entries(o).sort(([p], [q]) => p.localeCompare(q)).map(([k, v]) => `${k}${v}`).join('');
  const target = norm(comp);
  return CRYSTALS.find((k) => {
    const parsed: Record<string, number> = {};
    for (const m of k.formulaPlain.matchAll(/([A-Z][a-z]?)(\d*)/g)) parsed[m[1]] = (parsed[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1);
    return norm(parsed) === target;
  }) ?? null;
}

/** Nombre corto de la fuente de la densidad publicada, para la ficha del visor. */
export function densitySourceShort(c: CrystalDef): string {
  const s = c.sources.density;
  if (/CRC Handbook/.test(s)) return 'CRC Handbook';
  if (/PAC Chemical Database/.test(s)) return 'base PAC del DOE, vía PubChem';
  if (/Chemical Safety Cards/.test(s)) return 'fichas ICSC, vía PubChem';
  if (/IARC/.test(s)) return 'monografía de la IARC, vía PubChem';
  return 'fuente publicada';
}

export const CRYSTAL_REFS ={ wyckoff: WYCKOFF, crc: CRC, shannon: SHANNON_REF };

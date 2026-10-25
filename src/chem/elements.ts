/**
 * Datos de elementos del kit de química 3D: colores de dibujo, radios covalentes y radios iónicos.
 *
 * Fuentes (todas publicadas y verificables):
 *  - Radios covalentes de enlace sencillo: Pyykkö, P. y Atsumi, M. (2009). Molecular single-bond covalent radii
 *    for elements 1–118. Chemistry – A European Journal, 15, 186–197.
 *  - Radios de enlace doble: Pyykkö, P. y Atsumi, M. (2009). Molecular double-bond covalent radii for elements
 *    Li–E112. Chemistry – A European Journal, 15, 12770–12779.
 *  - Radios de enlace triple: Pyykkö, P., Riedel, S. y Patzschke, M. (2005). Triple-bond covalent radii.
 *    Chemistry – A European Journal, 11, 3511–3520.
 *    Las tres tablas (Z = 1–86) se transcribieron de la base de datos abierta «mendeleev» 1.3.0 (Mentel, Ł., 2014–,
 *    https://github.com/lmmentel/mendeleev, columnas covalent_radius_pyykko, _double y _triple, que citan esos
 *    artículos) y se cotejaron con los valores que el kit ya usaba (sin cambios en ninguno).
 *  - Radios iónicos efectivos: Shannon, R. D. (1976). Revised effective ionic radii and systematic studies of
 *    interatomic distances in halides and chalcogenides. Acta Crystallographica A, 32, 751–767.
 *  - Colores: convención CPK/Jmol (solo de dibujo; no tienen significado físico). Los que el proyecto no ajustó son
 *    los colores de Jmol (también de «mendeleev», columna jmol_color).
 *  - Masas atómicas: las de src/models/balancing.ts (CIAAW/IUPAC, abreviadas).
 */
import { ATOMIC_MASS, CPK } from '../models/balancing';

/** Colores de dibujo por elemento (CPK del proyecto + Jmol para los que faltan). */
export const ELEMENT_COLOR: Record<string, string> = {
  // Jmol (base) …
  He: '#d9ffff', Ne: '#b3e3f5', Ar: '#80d1e3', Sc: '#e6e6e6', V: '#a6a6ab', Fe: '#e06633', Ga: '#c28f8f', Ge: '#668f8f',
  As: '#bd80e3', Se: '#ffa100', Kr: '#5cb8d1', Rb: '#702eb0', Y: '#94ffff', Zr: '#94e0e0', Nb: '#73c2c9', Mo: '#54b5b5',
  Tc: '#3b9e9e', Ru: '#248f8f', Rh: '#0a7d8c', Pd: '#006985', Cd: '#ffd98f', In: '#a67573', Sb: '#9e63b5', Te: '#d47a00',
  Xe: '#429eb0', La: '#70d4ff', Ce: '#e8e8a8', Pr: '#c4e8a8', Nd: '#a8e0a8', Pm: '#a3ffc7', Sm: '#7fe8b4', Eu: '#55e0b0',
  Gd: '#3ed8b0', Tb: '#2ccfb0', Dy: '#1cc8b0', Ho: '#00d890', Er: '#00c86c', Tm: '#00b84a', Yb: '#00a834', Lu: '#009a22',
  Hf: '#4dc2ff', Ta: '#4da6ff', W: '#2194d6', Re: '#267dab', Os: '#266696', Ir: '#175487', Tl: '#a6544d', Bi: '#9e4fb5',
  Po: '#ab5c00', At: '#754f45', Rn: '#428296',
  // … con los ajustes de contraste del proyecto (los lantánidos de Jmol, casi blancos, se oscurecieron un poco).
  ...CPK,
  Li: '#b07fe0', Be: '#9fd400', B: '#e8a0a0', F: '#7fcf50', Si: '#d8b088',
  Ti: '#a8acb0', Cr: '#8a99c7', Mn: '#9c7ac7', Co: '#e08896', Ni: '#4fae4f', Zn: '#7d80b0', Br: '#a62929',
  Ag: '#b8bcc0', Sn: '#668080', I: '#940094', Cs: '#57178f', Ba: '#2fa52f', Au: '#e0b020', Hg: '#a8a8c8',
  Pb: '#575961', Sr: '#3fae3f', Pt: '#c8c8d8',
};
export const elementColor = (el: string) => ELEMENT_COLOR[el] ?? '#b0b8bf';

/** Masas atómicas (g/mol): las de balancing.ts (CIAAW, abreviadas). */
export const MASS: Record<string, number> = { ...ATOMIC_MASS };

/** Radios covalentes de enlace sencillo (Å), Pyykkö y Atsumi (2009a). */
export const R_SINGLE: Record<string, number> = {
  H: 0.32, He: 0.46, Li: 1.33, Be: 1.02, B: 0.85, C: 0.75, N: 0.71, O: 0.63, F: 0.64, Ne: 0.67, Na: 1.55, Mg: 1.39,
  Al: 1.26, Si: 1.16, P: 1.11, S: 1.03, Cl: 0.99, Ar: 0.96, K: 1.96, Ca: 1.71, Sc: 1.48, Ti: 1.36, V: 1.34, Cr: 1.22,
  Mn: 1.19, Fe: 1.16, Co: 1.11, Ni: 1.10, Cu: 1.12, Zn: 1.18, Ga: 1.24, Ge: 1.21, As: 1.21, Se: 1.16, Br: 1.14,
  Kr: 1.17, Rb: 2.10, Sr: 1.85, Y: 1.63, Zr: 1.54, Nb: 1.47, Mo: 1.38, Tc: 1.28, Ru: 1.25, Rh: 1.25, Pd: 1.20,
  Ag: 1.28, Cd: 1.36, In: 1.42, Sn: 1.40, Sb: 1.40, Te: 1.36, I: 1.33, Xe: 1.31, Cs: 2.32, Ba: 1.96, La: 1.80,
  Ce: 1.63, Pr: 1.76, Nd: 1.74, Pm: 1.73, Sm: 1.72, Eu: 1.68, Gd: 1.69, Tb: 1.68, Dy: 1.67, Ho: 1.66, Er: 1.65,
  Tm: 1.64, Yb: 1.70, Lu: 1.62, Hf: 1.52, Ta: 1.46, W: 1.37, Re: 1.31, Os: 1.29, Ir: 1.22, Pt: 1.23, Au: 1.24,
  Hg: 1.33, Tl: 1.44, Pb: 1.44, Bi: 1.51, Po: 1.45, At: 1.47, Rn: 1.42,
};
/** Radios covalentes de enlace doble (Å), Pyykkö y Atsumi (2009b). */
export const R_DOUBLE: Record<string, number> = {
  Li: 1.24, Be: 0.90, B: 0.78, C: 0.67, N: 0.60, O: 0.57, F: 0.59, Ne: 0.96, Na: 1.60, Mg: 1.32, Al: 1.13, Si: 1.07,
  P: 1.02, S: 0.94, Cl: 0.95, Ar: 1.07, K: 1.93, Ca: 1.47, Sc: 1.16, Ti: 1.17, V: 1.12, Cr: 1.11, Mn: 1.05, Fe: 1.09,
  Co: 1.03, Ni: 1.01, Cu: 1.15, Zn: 1.20, Ga: 1.17, Ge: 1.11, As: 1.14, Se: 1.07, Br: 1.09, Kr: 1.21, Rb: 2.02,
  Sr: 1.57, Y: 1.30, Zr: 1.27, Nb: 1.25, Mo: 1.21, Tc: 1.20, Ru: 1.14, Rh: 1.10, Pd: 1.17, Ag: 1.39, Cd: 1.44,
  In: 1.36, Sn: 1.30, Sb: 1.33, Te: 1.28, I: 1.29, Xe: 1.35, Cs: 2.09, Ba: 1.61, La: 1.39, Ce: 1.37, Pr: 1.38,
  Nd: 1.37, Pm: 1.35, Sm: 1.34, Eu: 1.34, Gd: 1.35, Tb: 1.35, Dy: 1.33, Ho: 1.33, Er: 1.33, Tm: 1.31, Yb: 1.29,
  Lu: 1.31, Hf: 1.28, Ta: 1.26, W: 1.20, Re: 1.19, Os: 1.16, Ir: 1.15, Pt: 1.12, Au: 1.21, Hg: 1.42, Tl: 1.42,
  Pb: 1.35, Bi: 1.41, Po: 1.35, At: 1.38, Rn: 1.45,
};
/** Radios covalentes de enlace triple (Å), Pyykkö, Riedel y Patzschke (2005). */
export const R_TRIPLE: Record<string, number> = {
  Be: 0.85, B: 0.73, C: 0.60, N: 0.54, O: 0.53, F: 0.53, Mg: 1.27, Al: 1.11, Si: 1.02, P: 0.94, S: 0.95, Cl: 0.93,
  Ar: 0.96, Ca: 1.33, Sc: 1.14, Ti: 1.08, V: 1.06, Cr: 1.03, Mn: 1.03, Fe: 1.02, Co: 0.96, Ni: 1.01, Cu: 1.20,
  Ga: 1.21, Ge: 1.14, As: 1.06, Se: 1.07, Br: 1.10, Kr: 1.08, Sr: 1.39, Y: 1.24, Zr: 1.21, Nb: 1.16, Mo: 1.13,
  Tc: 1.10, Ru: 1.03, Rh: 1.06, Pd: 1.12, Ag: 1.37, In: 1.46, Sn: 1.32, Sb: 1.27, Te: 1.21, I: 1.25, Xe: 1.22,
  Ba: 1.49, La: 1.39, Ce: 1.31, Pr: 1.28, Gd: 1.32, Lu: 1.31, Hf: 1.22, Ta: 1.19, W: 1.15, Re: 1.10, Os: 1.09,
  Ir: 1.07, Pt: 1.10, Au: 1.23, Tl: 1.50, Pb: 1.37, Bi: 1.35, Po: 1.29, At: 1.38, Rn: 1.33,
};

/**
 * Longitud de enlace estimada como suma de radios covalentes (Å). `order` 1, 2 o 3; 1,5 = enlace deslocalizado
 * (promedio de sencillo y doble). Lanza un error si falta un radio (nunca se inventa).
 */
export function covalentBondLength(a: string, b: string, order: 1 | 1.5 | 2 | 3 = 1): number {
  const r = (el: string, o: 1 | 2 | 3) => {
    const t = o === 1 ? R_SINGLE : o === 2 ? R_DOUBLE : R_TRIPLE;
    // El hidrógeno no forma enlaces múltiples: se usa siempre su radio sencillo.
    const v = el === 'H' ? R_SINGLE.H : t[el];
    if (v === undefined) throw new RangeError(`No hay radio covalente de orden ${o} para ${el} en la tabla de Pyykkö.`);
    return v;
  };
  if (order === 1.5) return (covalentBondLength(a, b, 1) + covalentBondLength(a, b, 2)) / 2;
  return r(a, order) + r(b, order);
}

/** Radios iónicos efectivos de Shannon (1976), en Å, para el número de coordinación indicado. */
export const SHANNON: Record<string, { charge: number; cn: number; r: number }[]> = {
  Li: [{ charge: 1, cn: 4, r: 0.59 }, { charge: 1, cn: 6, r: 0.76 }],
  Na: [{ charge: 1, cn: 4, r: 0.99 }, { charge: 1, cn: 6, r: 1.02 }],
  K: [{ charge: 1, cn: 6, r: 1.38 }, { charge: 1, cn: 8, r: 1.51 }],
  Cs: [{ charge: 1, cn: 6, r: 1.67 }, { charge: 1, cn: 8, r: 1.74 }],
  Mg: [{ charge: 2, cn: 6, r: 0.72 }],
  Ca: [{ charge: 2, cn: 6, r: 1.0 }, { charge: 2, cn: 8, r: 1.12 }],
  O: [{ charge: -2, cn: 4, r: 1.38 }, { charge: -2, cn: 6, r: 1.4 }],
  F: [{ charge: -1, cn: 4, r: 1.31 }, { charge: -1, cn: 6, r: 1.33 }],
  Cl: [{ charge: -1, cn: 6, r: 1.81 }],
};

/** Radio iónico de Shannon más cercano al número de coordinación pedido (Å). */
export function ionicRadius(el: string, cn: number): number {
  const list = SHANNON[el];
  if (!list) throw new RangeError(`No hay radio iónico de Shannon para ${el} en la tabla del kit.`);
  return [...list].sort((p, q) => Math.abs(p.cn - cn) - Math.abs(q.cn - cn))[0].r;
}

/** Radio de dibujo (Å) de un átomo en una molécula: proporcional al radio covalente. */
export function drawRadius(el: string): number {
  return R_SINGLE[el] ?? 0.9;
}

/**
 * Modelo de «esferas y palitos» común a TODOS los visores del kit (3Dmol, reacción 3D y vista de respaldo SVG).
 *
 * Antes cada visor 3Dmol dejaba que la biblioteca eligiera la esfera: 0,28 × radio de van der Waals de Bondi. Esos
 * radios son 2,4–3,8 veces los covalentes (H: 1,20 frente a 0,32 Å), de modo que en los enlaces con H las dos esferas
 * tapaban el 70–90 % del enlace (N–H, O–H, H–H) y, al girar la molécula, el «palito» desaparecía. Ahora la esfera es
 * proporcional al radio COVALENTE (el mismo que fija la longitud de enlace), con un mínimo para que el H se vea:
 *   radio de la esfera = máx(BALL_MIN, BALL_SCALE × r_cov)
 * Como la longitud de un enlace A–B es ≈ r_cov(A) + r_cov(B), las esferas ocupan ≈ 42 % del enlace y siempre queda a
 * la vista más de un tercio del palito (lo comprueba tests/unit/chemBonds.test.ts para todas las especies).
 */
export const BALL_SCALE = 0.42;
export const BALL_MIN = 0.2;
/** Radio del palito (Å) en «esferas y palitos» y en «palitos». */
export const STICK_RADIUS = { bs: 0.14, pal: 0.2 } as const;

/** Radio de la esfera (Å) en el estilo «esferas y palitos». */
export function ballRadius(el: string): number {
  return Math.max(BALL_MIN, BALL_SCALE * drawRadius(el));
}

/** Fracción visible (0–1) de un palito de longitud L entre dos esferas del estilo «esferas y palitos». */
export function visibleStickFraction(a: string, b: string, length: number): number {
  return length > 0 ? Math.max(0, length - ballRadius(a) - ballRadius(b)) / length : 0;
}

export const PYYKKO_REF = 'Pyykkö y Atsumi (2009), Chem. Eur. J. 15, 186–197 y 12770–12779; Pyykkö, Riedel y Patzschke (2005), Chem. Eur. J. 11, 3511–3520';
export const SHANNON_REF = 'Shannon (1976), Acta Crystallographica A 32, 751–767';

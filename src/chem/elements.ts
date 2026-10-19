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
 *  - Radios iónicos efectivos: Shannon, R. D. (1976). Revised effective ionic radii and systematic studies of
 *    interatomic distances in halides and chalcogenides. Acta Crystallographica A, 32, 751–767.
 *  - Colores: convención CPK/Jmol (solo de dibujo; no tienen significado físico).
 *  - Masas atómicas: las de src/models/balancing.ts (CIAAW/IUPAC, abreviadas) más las que faltan aquí.
 */
import { ATOMIC_MASS, CPK } from '../models/balancing';

/** Colores de dibujo por elemento (CPK del proyecto + Jmol para los que faltan). */
export const ELEMENT_COLOR: Record<string, string> = {
  ...CPK,
  Li: '#b07fe0', Be: '#9fd400', B: '#e8a0a0', F: '#7fcf50', Ne: '#9fd8e8', Si: '#d8b088', Ar: '#80c8d8',
  Ti: '#a8acb0', Cr: '#8a99c7', Mn: '#9c7ac7', Co: '#e08896', Ni: '#4fae4f', Zn: '#7d80b0', Br: '#a62929',
  Ag: '#b8bcc0', Sn: '#668080', I: '#940094', Cs: '#57178f', Ba: '#2fa52f', Au: '#e0b020', Hg: '#a8a8c8',
  Pb: '#575961', Sr: '#3fae3f', Pt: '#c8c8d8',
};
export const elementColor = (el: string) => ELEMENT_COLOR[el] ?? '#b0b8bf';

/** Masas atómicas (g/mol): las de balancing.ts y las adicionales (CIAAW, abreviadas). */
export const MASS: Record<string, number> = {
  ...ATOMIC_MASS, Cs: 132.91, Sr: 87.62, Li: 6.94, Au: 196.97, Hg: 200.59, Pt: 195.08, Ti: 47.867, Se: 78.971, As: 74.922,
};

/** Radios covalentes de enlace sencillo (Å), Pyykkö y Atsumi (2009a). */
export const R_SINGLE: Record<string, number> = {
  H: 0.32, Li: 1.33, Be: 1.02, B: 0.85, C: 0.75, N: 0.71, O: 0.63, F: 0.64, Na: 1.55, Mg: 1.39, Al: 1.26, Si: 1.16,
  P: 1.11, S: 1.03, Cl: 0.99, K: 1.96, Ca: 1.71, Cr: 1.22, Mn: 1.19, Fe: 1.16, Co: 1.11, Ni: 1.10, Cu: 1.12, Zn: 1.18,
  Br: 1.14, Ag: 1.28, Sn: 1.40, I: 1.33, Ba: 1.96, Hg: 1.33, Pb: 1.44,
};
/** Radios covalentes de enlace doble (Å), Pyykkö y Atsumi (2009b). */
export const R_DOUBLE: Record<string, number> = {
  B: 0.78, C: 0.67, N: 0.60, O: 0.57, F: 0.59, Si: 1.07, P: 1.02, S: 0.94, Cl: 0.95, Br: 1.09, I: 1.29, Cr: 1.11, Mn: 1.05,
};
/** Radios covalentes de enlace triple (Å), Pyykkö, Riedel y Patzschke (2005). */
export const R_TRIPLE: Record<string, number> = { C: 0.60, N: 0.54, O: 0.53, P: 0.94, S: 0.95 };

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

export const PYYKKO_REF = 'Pyykkö y Atsumi (2009), Chem. Eur. J. 15, 186–197 y 12770–12779; Pyykkö, Riedel y Patzschke (2005), Chem. Eur. J. 11, 3511–3520';
export const SHANNON_REF = 'Shannon (1976), Acta Crystallographica A 32, 751–767';

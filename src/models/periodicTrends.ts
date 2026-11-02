import DATA from '../data/quimica/tabla-periodica-pubchem.json';
import { R_SINGLE } from '../chem/elements';
import { PT_ELEMENTS, type PtCategory, type PtElement } from './periodicTable';
import type { ModelSpec } from './types';

/**
 * Propiedades periódicas (grado 8.º) con datos REALES y con su procedencia:
 *  - Electronegatividad (escala de Pauling), primera energía de ionización (eV, NIST), radio de van der Waals (pm) y masa
 *    atómica (IUPAC/CIAAW): tabla periódica de PubChem (src/data/quimica/tabla-periodica-pubchem.json, generado por
 *    scripts/validacion/tabla_periodica_pubchem.mjs, con la fecha de consulta). Lo que PubChem deja vacío queda vacío.
 *  - Radio covalente de enlace sencillo (pm): Pyykkö y Atsumi (2009), los mismos del kit de química (src/chem/elements.ts).
 *  - Carga nuclear efectiva sobre un electrón de la capa de valencia (s o p) de los elementos de los grupos principales:
 *    reglas de Slater (1930), calculada aquí a partir de la configuración electrónica (principio de construcción).
 *
 * Reglas de Slater para un electrón ns o np:  Z_ef = Z − S, con S = 0,35 por cada otro electrón del mismo grupo (n s, n p)
 * (0,30 si es el 1s), 0,85 por cada electrón de la capa n − 1 y 1,00 por cada electrón de las capas n − 2 o más internas.
 * Los electrones (n−1)d y (n−2)f cuentan como capas internas: 0,85 los d de la capa n − 1 y 1,00 los f de la n − 2.
 *
 * Este archivo no depende de React ni del navegador.
 */

export type PeriodicProperty = 'radioCov' | 'radioVdW' | 'en' | 'ei' | 'zef' | 'masa';

export interface PeriodicElement extends PtElement {
  masa: number | null;
  en: number | null;
  ei: number | null;
  radioVdW: number | null;
  radioCov: number | null;
  zef: number | null;
  configuracion: string;
  estado: string;
  bloque: 's' | 'p' | 'd' | 'f';
}

interface RawElement { z: number; simbolo: string; masa: number | null; configuracion: string; electronegatividad: number | null; radioVdW: number | null; ionizacion: number | null; estado: string }
const RAW = (DATA as unknown as { elementos: RawElement[] }).elementos;
export const PERIODIC_SOURCE = { fuente: (DATA as { fuente: string }).fuente, fecha: (DATA as { fecha: string }).fecha };

export const PROPERTY_INFO: Record<PeriodicProperty, { label: string; short: string; unit: string; decimals: number; source: string }> = {
  radioCov: { label: 'Radio atómico (covalente)', short: 'radio covalente', unit: 'pm', decimals: 0, source: 'Pyykkö y Atsumi (2009), radios covalentes de enlace sencillo' },
  radioVdW: { label: 'Radio de van der Waals', short: 'radio de van der Waals', unit: 'pm', decimals: 0, source: 'PubChem (radio atómico de van der Waals)' },
  en: { label: 'Electronegatividad (Pauling)', short: 'electronegatividad', unit: '', decimals: 2, source: 'PubChem (escala de Pauling)' },
  ei: { label: '1.ª energía de ionización', short: 'energía de ionización', unit: 'eV', decimals: 3, source: 'PubChem (NIST Atomic Spectra Database)' },
  zef: { label: 'Carga nuclear efectiva (Slater)', short: 'carga nuclear efectiva', unit: '', decimals: 2, source: 'Calculada con las reglas de Slater (1930) para el electrón de valencia' },
  masa: { label: 'Masa atómica', short: 'masa atómica', unit: 'u', decimals: 3, source: 'PubChem (pesos atómicos estándar de la IUPAC/CIAAW)' },
};

/* ------------------------------------------------------------------ configuración y Slater */

/** Orden de llenado de Madelung (n + l, luego n). */
const SUBSHELLS: { n: number; l: number; cap: number }[] = (() => {
  const out: { n: number; l: number; cap: number }[] = [];
  for (let n = 1; n <= 7; n++) for (let l = 0; l < Math.min(n, 4); l++) out.push({ n, l, cap: 2 * (2 * l + 1) });
  return out.sort((a, b) => a.n + a.l - (b.n + b.l) || a.n - b.n);
})();
const L_LETTER = 'spdf';

/** Configuración del estado fundamental según el principio de construcción (Madelung), sin las excepciones (Cr, Cu…). */
export function aufbauConfiguration(z: number): { n: number; l: number; e: number }[] {
  let left = z;
  const out: { n: number; l: number; e: number }[] = [];
  for (const s of SUBSHELLS) {
    if (left <= 0) break;
    const e = Math.min(s.cap, left);
    out.push({ n: s.n, l: s.l, e });
    left -= e;
  }
  return out;
}
export const configText = (cfg: { n: number; l: number; e: number }[]) =>
  [...cfg].sort((a, b) => a.n - b.n || a.l - b.l).map((s) => `${s.n}${L_LETTER[s.l]}${String(s.e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])}`).join(' ');

/** Elementos de los grupos principales (bloques s y p), donde el electrón de valencia es ns o np. */
export const isMainGroup = (e: Pick<PtElement, 'group'>) => e.group !== null && (e.group <= 2 || e.group >= 13);

export interface SlaterBreakdown { z: number; n: number; same: number; inner1: number; inner2: number; shielding: number; zef: number }

/**
 * Carga nuclear efectiva de Slater sobre un electrón de la capa de valencia (ns/np) de un elemento de los grupos
 * principales. Lanza un error para los metales de transición y los de transición interna (su electrón de valencia
 * más externo sigue siendo ns, pero las reglas para d y f no se enseñan aquí y el resultado no se compara).
 */
export function slaterZeff(z: number): SlaterBreakdown {
  const el = PT_ELEMENTS[z - 1];
  if (!el || !isMainGroup(el)) throw new RangeError(`Las reglas de Slater de esta práctica son para los grupos principales (Z = ${z}).`);
  const cfg = aufbauConfiguration(z);
  const n = Math.max(...cfg.map((s) => s.n));
  const valence = cfg.filter((s) => s.n === n && s.l <= 1).reduce((t, s) => t + s.e, 0);
  const same = valence - 1;
  // Capa n − 1: s, p y d (los d de la capa n−1 están por debajo del electrón ns/np y cuentan 0,85).
  const inner1 = cfg.filter((s) => s.n === n - 1).reduce((t, s) => t + s.e, 0);
  const inner2 = cfg.filter((s) => s.n <= n - 2).reduce((t, s) => t + s.e, 0);
  const shielding = same * (n === 1 ? 0.3 : 0.35) + inner1 * 0.85 + inner2 * 1.0;
  return { z, n, same, inner1, inner2, shielding, zef: z - shielding };
}

/* ------------------------------------------------------------------ tabla con datos */

const blockOf = (e: PtElement): 's' | 'p' | 'd' | 'f' => {
  if (e.group === null) return 'f';
  if (e.z === 2) return 's';
  if (e.group <= 2) return 's';
  if (e.group >= 13) return 'p';
  return 'd';
};

export const PERIODIC: PeriodicElement[] = PT_ELEMENTS.map((e, i) => {
  const r = RAW[i];
  if (r.z !== e.z || r.simbolo !== e.sym) throw new Error(`Los datos de PubChem no coinciden con la tabla en Z = ${e.z}.`);
  const cov = R_SINGLE[e.sym];
  return {
    ...e,
    masa: r.masa, en: r.electronegatividad, ei: r.ionizacion, radioVdW: r.radioVdW,
    radioCov: cov === undefined ? null : Math.round(cov * 100),
    zef: isMainGroup(e) ? slaterZeff(e.z).zef : null,
    configuracion: r.configuracion, estado: r.estado, bloque: blockOf(e),
  };
});

export function periodicElement(symOrZ: string | number): PeriodicElement {
  const e = typeof symOrZ === 'number' ? PERIODIC[symOrZ - 1] : PERIODIC.find((x) => x.sym === symOrZ);
  if (!e) throw new RangeError(`Elemento desconocido: ${symOrZ}`);
  return e;
}
export const propertyValue = (e: PeriodicElement, p: PeriodicProperty): number | null => e[p];

/** Máximo y mínimo de una propiedad entre los elementos con dato (para escalas de color y de altura). */
export function propertyRange(p: PeriodicProperty): { min: number; max: number } {
  const v = PERIODIC.map((e) => e[p]).filter((x): x is number => x !== null);
  return { min: Math.min(...v), max: Math.max(...v) };
}

/** Elementos de un período (1–7, sin el bloque f) o de un grupo (1–18), ordenados por Z. */
export function periodMembers(period: number): PeriodicElement[] {
  return PERIODIC.filter((e) => e.period === period && e.group !== null);
}
export function groupMembers(group: number): PeriodicElement[] {
  return PERIODIC.filter((e) => e.group === group);
}

export type TrendDirection = 'aumenta' | 'disminuye' | 'irregular' | 'sin datos';
/**
 * Tendencia de una propiedad en una serie (por Z): pendiente de mínimos cuadrados frente al índice y fracción de pasos
 * que siguen el signo de esa pendiente. «Irregular» si menos del 60 % de los pasos van en la dirección general.
 */
export function trend(series: PeriodicElement[], p: PeriodicProperty): { direction: TrendDirection; points: { sym: string; z: number; v: number }[]; consistency: number; exceptions: string[] } {
  const points = series.filter((e) => e[p] !== null).map((e) => ({ sym: e.sym, z: e.z, v: e[p] as number }));
  if (points.length < 3) return { direction: 'sin datos', points, consistency: 0, exceptions: [] };
  const n = points.length;
  const mx = (n - 1) / 2, my = points.reduce((s, q) => s + q.v, 0) / n;
  const slope = points.reduce((s, q, i) => s + (i - mx) * (q.v - my), 0);
  const steps = points.slice(1).map((q, i) => ({ d: q.v - points[i].v, from: points[i].sym, to: q.sym }));
  const sign = Math.sign(slope);
  const along = steps.filter((s) => Math.sign(s.d) === sign).length / steps.length;
  const exceptions = steps.filter((s) => Math.sign(s.d) === -sign).map((s) => `${s.from} → ${s.to}`);
  return { direction: along < 0.6 ? 'irregular' : sign > 0 ? 'aumenta' : 'disminuye', points, consistency: along, exceptions };
}

/** Comparación de dos elementos (qué tiene más de la propiedad). */
export function compareElements(a: string, b: string, p: PeriodicProperty): { larger: string | null; diff: number | null } {
  const va = periodicElement(a)[p], vb = periodicElement(b)[p];
  if (va === null || vb === null) return { larger: null, diff: null };
  return { larger: va === vb ? null : va > vb ? a : b, diff: Math.abs(va - vb) };
}

export const CATEGORY_TOKEN: Record<PtCategory, string> = {
  alcalino: 'series-1', alcalinoterreo: 'series-6', transicion: 'series-2', postransicion: 'series-5', metaloide: 'series-3',
  nometal: 'series-4', halogeno: 'series-4', 'gas-noble': 'series-7', lantanido: 'series-8', actinido: 'series-8',
};

export const periodicTrendsSpec: ModelSpec = {
  name: 'Propiedades periódicas con datos reales y carga nuclear efectiva de Slater',
  inputs: [
    { symbol: 'Z', name: 'Número atómico del elemento elegido', unit: '—', range: [1, 118], initial: 11 },
    { symbol: 'P', name: 'Propiedad: radio covalente, radio de van der Waals, electronegatividad, energía de ionización, Z_ef o masa', unit: '—', initial: 'radio covalente' },
    { symbol: 'serie', name: 'Período (1–7) o grupo (1–18) para ver la tendencia', unit: '—', initial: 'período 3' },
  ],
  outputs: [
    { symbol: 'r_cov', name: 'Radio covalente (Pyykkö y Atsumi, 2009)', unit: 'pm' },
    { symbol: 'χ', name: 'Electronegatividad de Pauling (PubChem)', unit: '—' },
    { symbol: 'EI₁', name: 'Primera energía de ionización (PubChem/NIST)', unit: 'eV' },
    { symbol: 'Z_ef', name: 'Carga nuclear efectiva sobre el electrón de valencia (Slater)', unit: '—' },
  ],
  equations: [
    'Z_ef = Z − S   (reglas de Slater)',
    'S = 0,35·(otros electrones ns, np) + 0,85·(electrones de la capa n − 1) + 1,00·(capas n − 2 y más internas)   (0,30 entre los dos 1s)',
    'Tendencia: pendiente de mínimos cuadrados de la propiedad frente a la posición en el período o el grupo',
  ],
  initialConditions: [
    `Datos de PubChem consultados el ${PERIODIC_SOURCE.fecha}; radios covalentes de Pyykkö y Atsumi (2009) para Z = 1–86.`,
    'Configuraciones por el principio de construcción (Madelung); en los grupos principales no hay excepciones.',
  ],
  assumptions: [
    'Las propiedades son datos medidos o recomendados (no salen de este modelo); Z_ef de Slater es una estimación de manual, no una medición.',
    'El «radio atómico» se representa con el radio covalente de enlace sencillo; el radio de van der Waals (átomos que no se enlazan) es otra medida y por eso es mayor.',
    'Los gases nobles no tienen electronegatividad de Pauling en la tabla de PubChem (salvo Kr y Xe, que forman compuestos): quedan sin dato.',
  ],
  limits: [
    'Las reglas de Slater no distinguen s de p ni explican las pequeñas excepciones (la energía de ionización del O es menor que la del N; la del Al, menor que la del Mg).',
    'Los elementos superpesados (Z > 103) casi no tienen datos medidos: aparecen sin valor.',
    'Los radios dependen del método de medida; comparar solo radios del mismo tipo.',
  ],
  testCases: [
    'Datos: Na χ = 0,93, EI₁ = 5,139 eV; Cl χ = 3,16, EI₁ = 12,968 eV; F es el más electronegativo (3,98).',
    'Slater: Z_ef(Na, 3s) = 2,20; Z_ef(Cl, 3p) = 6,10; Z_ef(K, 4s) = 2,20; Z_ef(Br, 4p) = 7,60; Z_ef(O, 2p) = 4,55.',
    'Tendencias: en el período 3 el radio covalente disminuye y la EI₁ y Z_ef aumentan; en el grupo 1 el radio aumenta y la EI₁ disminuye.',
  ],
};

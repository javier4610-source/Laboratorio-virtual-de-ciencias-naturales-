/**
 * PROPIEDADES Y PRUEBAS DE LAS FUNCIONES ORGÁNICAS (prácticas «grupos-oxigenados» y «grupos-nitrogenados»).
 *
 *  - Series homólogas y comparaciones a masa molar parecida con datos EXPERIMENTALES citados (PubChem PUG View, sobre todo HSDB):
 *    temperatura de ebullición, solubilidad en agua, pKa.
 *  - Acidez y basicidad: fracción ionizada con la ecuación de Henderson-Hasselbalch (MODELO CALCULADO con pKa experimentales);
 *    pKa del ácido conjugado de una base a partir de su pKb (pKa = pKw − pKb, pKw = 14,00 a 25 °C); pH de una disolución de una
 *    base débil (equilibrio con Kb, ecuación cuadrática).
 *  - Pruebas clásicas de laboratorio (Tollens, Fehling, FeCl₃, Lucas, NaHCO₃): ILUSTRACIÓN del resultado esperado según la
 *    bibliografía de análisis orgánico cualitativo (Shriner et al., 2004; Vogel, 1989; Lucas, 1930), deducido del grupo funcional.
 *  - Geometría de amidas y aminas medida sobre los confórmeros de PubChem (MODELO CALCULADO: coordenadas MMFF94s).
 *  - Control de calidad de los datos de combustión de una serie homóloga (residuo de un ajuste lineal sin el punto evaluado).
 */
import { atomAngle, atomDistance, type Species3D } from '../chem/species';
import { aromaticAtoms, carbonylO, detectGroups, hBondSites, type FunctionalGroup } from './functionalGroups';
import { molFromMolfile, neighbors, parseSmiles, type OMolecule } from './organicGraph';
import { getFunc, type FRecord } from '../data/quimica/funcionales';

/* ------------------------------------------------------------------ series y comparaciones */

export type FamilyO = 'alcano' | 'alcohol' | 'eter' | 'aldehido' | 'cetona' | 'acido' | 'ester';
export const FAMILY_O_LABEL: Record<FamilyO, string> = {
  alcano: 'Alcanos', alcohol: 'Alcoholes (1-alcanoles)', eter: 'Éteres', aldehido: 'Aldehídos', cetona: 'Cetonas', acido: 'Ácidos carboxílicos', ester: 'Ésteres metílicos/etílicos',
};
/** Series homólogas (ids de la biblioteca), ordenadas por número de carbonos. */
export const SERIES_O: Record<FamilyO, string[]> = {
  alcano: ['metano', 'etano', 'propano', 'butano', 'pentano', 'hexano', 'heptano', 'octano'],
  alcohol: ['metanol', 'etanol', 'propan-1-ol', 'butan-1-ol', 'pentan-1-ol', 'hexan-1-ol', 'heptan-1-ol', 'octan-1-ol'],
  eter: ['metoximetano', 'metoxietano', 'etoxietano'],
  aldehido: ['metanal', 'etanal', 'propanal', 'butanal', 'pentanal'],
  cetona: ['propanona', 'butanona', 'pentan-2-ona'],
  acido: ['acido-metanoico', 'acido-etanoico', 'acido-propanoico', 'acido-butanoico', 'acido-pentanoico', 'acido-hexanoico'],
  ester: ['metanoato-de-metilo', 'acetato-de-metilo', 'acetato-de-etilo'],
};

/** Compuestos de masa molar parecida (≈ 58–60 g/mol): la diferencia de Tₑb la explican las fuerzas intermoleculares. */
export const SIMILAR_MASS_O = ['butano', 'metoxietano', 'propanal', 'propanona', 'metanoato-de-metilo', 'propan-1-ol', 'propan-2-ol', 'acido-etanoico'];
export const SIMILAR_MASS_N = ['butano', 'trimetilamina', 'n-metiletanamina', 'propan-1-amina', 'propan-1-ol', 'acetamida'];
/** Isómeros C₄H₁₀O: mismo tamaño y masa, distinta función y ramificación. */
export const ISOMERS_C4H10O = ['butan-1-ol', 'butan-2-ol', '2-metilpropan-1-ol', '2-metilpropan-2-ol', 'etoxietano', '1-metoxipropano'];
/** Isómeros C₃H₉N: amina primaria, secundaria y terciaria. */
export const ISOMERS_C3H9N = ['propan-1-amina', 'n-metiletanamina', 'trimetilamina'];

export function carbonsOf(formula: string): number {
  const m = formula.match(/^C(\d*)/);
  return m ? (m[1] ? Number(m[1]) : 1) : 0;
}

export function molOf(rec: FRecord): OMolecule { return parseSmiles(rec.smiles); }

/** Donadores y aceptores de puentes de hidrógeno del compuesto. */
export function hBondsOf(rec: FRecord) { return hBondSites(molOf(rec)); }

export type SolubilityClass = 'miscible' | 'muy soluble' | 'soluble' | 'poco soluble' | 'insoluble';
/** Categoría de solubilidad para describir el dato (convención de clase: > 100 g/L muy soluble, 10–100 soluble, 0,1–10 poco soluble). */
export function solubilityClass(rec: FRecord): SolubilityClass | null {
  const s = rec.propiedades.solubilidad;
  if (!s) return null;
  if (s.tipo === 'miscible') return 'miscible';
  const v = s.valor ?? 0;
  return v > 100 ? 'muy soluble' : v >= 10 ? 'soluble' : v >= 0.1 ? 'poco soluble' : 'insoluble';
}

/* ------------------------------------------------------------------ acidez y basicidad */

export const PKW_25 = 14.0;

export interface AcidityInfo { value: number; kind: 'pKa' | 'pKaH (de pKb)' | 'pKaH'; calculated: boolean; text: string }

/** pKa del compuesto como ÁCIDO (alcoholes, fenoles, ácidos); null si el dato es de un ácido conjugado o no hay dato. */
export function pKaAsAcid(rec: FRecord): AcidityInfo | null {
  const p = rec.propiedades.pKa;
  if (!p || p.tipo !== 'pKa' || p.acidoConjugado) return null;
  return { value: p.valor, kind: 'pKa', calculated: false, text: p.texto };
}

/** pKa del ácido conjugado (BH⁺) de una base nitrogenada: dato directo o pKw − pKb (cálculo declarado). */
export function pKaH(rec: FRecord): AcidityInfo | null {
  const p = rec.propiedades.pKa;
  if (!p) return null;
  if (p.tipo === 'pKb') return { value: Math.round((PKW_25 - p.valor) * 1000) / 1000, kind: 'pKaH (de pKb)', calculated: true, text: p.texto };
  if (rec.grupo === 'amina' || p.acidoConjugado) return { value: p.valor, kind: 'pKaH', calculated: false, text: p.texto };
  return null;
}

/** Fracción ionizada (A⁻) de un ácido a un pH dado (Henderson-Hasselbalch). */
export function ionizedFraction(pKa: number, pH: number): number {
  return 1 / (1 + 10 ** (pKa - pH));
}
/** Fracción protonada (BH⁺) de una base cuyo ácido conjugado tiene pKaH. */
export function protonatedFraction(pKaH_: number, pH: number): number {
  return 1 / (1 + 10 ** (pH - pKaH_));
}

/** pH de una disolución de una base débil B de concentración c (mol/L) a 25 °C: x²/(c − x) = Kb, x = [OH⁻]. */
export function weakBasePH(pKaH_: number, c: number): { pH: number; pOH: number; ionized: number } {
  if (!(c > 0)) throw new RangeError('La concentración debe ser positiva.');
  const Kb = 10 ** -(PKW_25 - pKaH_);
  const x = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * c)) / 2;
  const pOH = -Math.log10(x);
  return { pH: PKW_25 - pOH, pOH, ionized: x / c };
}

/** pH de una disolución de un ácido débil HA (para comparar): x²/(c − x) = Ka. */
export function weakAcidPH(pKa: number, c: number): { pH: number; ionized: number } {
  if (!(c > 0)) throw new RangeError('La concentración debe ser positiva.');
  const Ka = 10 ** -pKa;
  const x = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * c)) / 2;
  return { pH: -Math.log10(x), ionized: x / c };
}

/** Aminoácido diprótico H₂A⁺ ⇌ HA± ⇌ A⁻: fracciones de catión, ion dipolar (zwitterión) y anión a un pH; pI = (pKa₁ + pKa₂)/2. */
export function aminoAcidSpecies(pKa1: number, pKa2: number, pH: number): { cation: number; zwitterion: number; anion: number; pI: number } {
  const h = 10 ** -pH, K1 = 10 ** -pKa1, K2 = 10 ** -pKa2;
  const D = 1 + K1 / h + (K1 * K2) / (h * h);
  return { cation: 1 / D, zwitterion: K1 / h / D, anion: (K1 * K2) / (h * h) / D, pI: (pKa1 + pKa2) / 2 };
}

export const ACIDS_O = ['etanol', 'metanol', 'fenol', '4-metilfenol', '4-clorofenol', '4-nitrofenol', 'acido-propanoico', 'acido-etanoico', 'acido-metanoico', 'acido-benzoico', 'acido-cloroacetico', 'acido-dicloroacetico', 'acido-tricloroacetico'];
export const BASES_N = ['amoniaco', 'metanamina', 'etanamina', 'dimetilamina', 'trimetilamina', 'dietilamina', 'trietilamina', 'ciclohexanamina', 'fenilmetanamina', 'anilina', '4-metilanilina', '4-nitroanilina', 'acetamida', 'urea', 'dmf'];

/* ------------------------------------------------------------------ pruebas de laboratorio (ilustración del resultado esperado) */

export type LabTest = 'tollens' | 'fehling' | 'fecl3' | 'lucas' | 'bicarbonato';
export const LAB_TEST_LABEL: Record<LabTest, string> = {
  tollens: 'Reactivo de Tollens ([Ag(NH₃)₂]⁺)', fehling: 'Reactivo de Fehling (Cu²⁺ en tartrato, con calor)', fecl3: 'Cloruro de hierro(III) al 1 %',
  lucas: 'Reactivo de Lucas (ZnCl₂ en HCl concentrado)', bicarbonato: 'Bicarbonato de sodio al 5 %',
};
export const LAB_TEST_FOR: Record<LabTest, string> = {
  tollens: 'aldehídos (y otros reductores)', fehling: 'aldehídos alifáticos y azúcares reductores', fecl3: 'fenoles', lucas: 'alcoholes 1.º, 2.º y 3.º', bicarbonato: 'ácidos carboxílicos',
};
/** Compuestos del banco de pruebas. */
export const TEST_BANK = ['etanol', 'propan-2-ol', '2-metilpropan-2-ol', 'fenol', 'acido-salicilico', 'aspirina', 'propanal', 'benzaldehido', 'propanona', 'acido-etanoico', 'acetato-de-etilo', 'glucosa'];

export interface TestOutcome {
  positive: boolean;
  /** Lo que se espera observar. */
  observation: string;
  /** Explicación química (con la ecuación cuando aplica). */
  explanation: string;
  /** Aspecto del tubo para el dibujo. */
  look: { liquid: string; mirror?: boolean; precipitate?: string; turbid?: boolean; bubbles?: boolean; layer?: boolean };
  /** Tiempo hasta la observación (Lucas), en texto. */
  time?: string;
}

const REDUCING_SUGARS = new Set(['glucosa']);

/** Resultado esperado de una prueba clásica según el grupo funcional (Ilustración educativa con fuente bibliográfica). */
export function labTest(rec: FRecord, test: LabTest): TestOutcome {
  const m = molOf(rec);
  const groups = detectGroups(m);
  const has = (k: FunctionalGroup['kind']) => groups.some((g) => g.kind === k);
  const aldehydes = groups.filter((g) => g.kind === 'aldehido');
  const arom = aromaticAtoms(m);
  const aromaticAld = aldehydes.length > 0 && aldehydes.every((g) => neighbors(m, g.center).some((v) => arom.has(v)));
  const sugar = REDUCING_SUGARS.has(rec.id);
  switch (test) {
    case 'tollens': {
      const pos = aldehydes.length > 0 || sugar;
      return pos
        ? { positive: true, observation: 'Se forma un espejo de plata en la pared del tubo (o un precipitado gris oscuro).', explanation: `El ${sugar ? 'azúcar reductor (su forma abierta tiene un grupo aldehído)' : 'aldehído'} se oxida a ion carboxilato y reduce el Ag⁺ a plata metálica: R–CHO + 2 [Ag(NH₃)₂]⁺ + 3 OH⁻ → R–COO⁻ + 2 Ag(s) + 4 NH₃ + 2 H₂O.`, look: { liquid: '#a7b0b4', mirror: true } }
        : { positive: false, observation: 'La disolución sigue incolora; no aparece plata.', explanation: has('cetona') ? 'Las cetonas no tienen H en el carbonilo y no se oxidan con un oxidante suave como el Ag⁺.' : 'No hay grupo aldehído (ni otro reductor) que reduzca el Ag⁺.', look: { liquid: '#eef2f3' } };
    }
    case 'fehling': {
      const pos = (aldehydes.length > 0 && !aromaticAld) || sugar;
      if (pos) return { positive: true, observation: 'El azul intenso desaparece y se forma un precipitado rojo ladrillo (Cu₂O).', explanation: `El ${sugar ? 'azúcar reductor' : 'aldehído alifático'} reduce el Cu²⁺ (azul) a óxido de cobre(I) rojo: R–CHO + 2 Cu²⁺ + 5 OH⁻ → R–COO⁻ + Cu₂O(s) + 3 H₂O.`, look: { liquid: '#5b8fd1', precipitate: '#b5452a' } };
      return { positive: false, observation: 'La disolución conserva su color azul; no hay precipitado rojo.', explanation: aromaticAld ? 'Los aldehídos aromáticos como el benzaldehído reducen el reactivo de Tollens pero, en general, no el de Fehling (Vogel, 1989; Shriner et al., 2004).' : has('cetona') ? 'Las cetonas no se oxidan con Cu²⁺.' : 'No hay grupo aldehído ni azúcar reductor.', look: { liquid: '#2f6fc7' } };
    }
    case 'fecl3': {
      const pos = has('fenol');
      if (pos) return { positive: true, observation: 'Aparece de inmediato una coloración violeta (azul-violeta según el fenol).', explanation: 'El grupo –OH unido al anillo aromático (fenol) forma con Fe³⁺ un complejo coloreado (fenóxido de hierro(III)).', look: { liquid: '#6b3f9e' } };
      return { positive: false, observation: 'La disolución queda amarilla pálida (el color del propio FeCl₃).', explanation: rec.id === 'aspirina' ? 'El ácido acetilsalicílico no tiene el –OH fenólico libre (está esterificado). Si la aspirina está vieja y se hidrolizó, aparece ácido salicílico y el ensayo da violeta: es una prueba de pureza.' : has('alcohol') ? 'Los alcoholes (OH en un carbono sp³) no forman el complejo coloreado.' : 'No hay grupo fenol.', look: { liquid: '#f2d675' } };
    }
    case 'lucas': {
      const alc = groups.filter((g) => g.kind === 'alcohol');
      if (!alc.length) return { positive: false, observation: 'No se forma turbidez.', explanation: has('fenol') ? 'La prueba de Lucas es para alcoholes; los fenoles no forman haluros de arilo con HCl.' : 'La prueba de Lucas solo distingue alcoholes.', look: { liquid: '#f3f3ee' } };
      if (carbonsOf(rec.formula) > 6) return { positive: false, observation: 'El alcohol no se disuelve en el reactivo: la prueba no es válida.', explanation: 'Solo sirve para alcoholes solubles en el reactivo (hasta unos 6 carbonos).', look: { liquid: '#f3f3ee', layer: true } };
      const d = alc[0].degree;
      if (d === 'terciario') return { positive: true, time: 'de inmediato (menos de 1 min)', observation: 'La mezcla se enturbia de inmediato y luego se separa una capa (cloruro de alquilo).', explanation: 'Alcohol terciario: forma rápido un carbocatión terciario (estable) y el Cl⁻ lo captura: R₃C–OH + HCl → R₃C–Cl + H₂O (catalizado por ZnCl₂).', look: { liquid: '#f3f3ee', turbid: true, layer: true } };
      if (d === 'secundario') return { positive: true, time: 'en unos 5 minutos', observation: 'La mezcla se enturbia lentamente (en unos minutos).', explanation: 'Alcohol secundario: el carbocatión secundario se forma más despacio, por eso la turbidez tarda.', look: { liquid: '#f3f3ee', turbid: true } };
      return { positive: false, time: 'no se enturbia a temperatura ambiente', observation: 'La disolución sigue transparente a temperatura ambiente.', explanation: d === 'metanol' ? 'Metanol: no forma carbocatión; no reacciona a temperatura ambiente.' : 'Alcohol primario: el carbocatión primario es muy inestable; a temperatura ambiente no hay reacción visible.', look: { liquid: '#f3f3ee' } };
    }
    case 'bicarbonato': {
      const pos = has('acido');
      if (pos) return { positive: true, observation: 'Burbujeo (efervescencia) de CO₂.', explanation: 'El ácido carboxílico es más ácido que el ácido carbónico y desplaza el CO₂: R–COOH + HCO₃⁻ → R–COO⁻ + H₂O + CO₂(g).', look: { liquid: '#eef4f6', bubbles: true } };
      return { positive: false, observation: 'No hay burbujeo.', explanation: has('fenol') ? 'Los fenoles comunes son ácidos más débiles que el ácido carbónico: no desprenden CO₂ con bicarbonato (sí se disuelven en NaOH).' : 'No hay un ácido carboxílico que reaccione con el bicarbonato.', look: { liquid: '#eef4f6' } };
    }
  }
}

export const LAB_TEST_STATUS = 'Ilustración educativa: resultado esperado según la bibliografía de análisis orgánico cualitativo (Shriner et al., 2004; Vogel, 1989; Lucas, 1930), deducido del grupo funcional; no es una medición';

/* ------------------------------------------------------------------ geometría de amidas y aminas (sobre el confórmero) */

export interface AmideGeometry {
  /** Índices en la especie 3D. */
  c: number; o: number; n: number;
  dCO: number; dCN: number;
  /** Suma de los tres ángulos alrededor del N (360° = plano; ≈ 330° = pirámide). */
  sumN: number;
  /** Suma de ángulos alrededor del C del carbonilo. */
  sumC: number;
  /** Desviación máxima (Å) de los 6 átomos O, C, N y sus sustituyentes respecto de su plano medio. */
  planarity: number;
}

function graphOf(sp: Species3D) {
  return molFromMolfile(toV2000(sp)).mol;
}
function toV2000(sp: Species3D): string {
  const f4 = (v: number) => v.toFixed(4).padStart(10);
  const i3 = (v: number) => String(v).padStart(3);
  const lines = [sp.id, '', '', `${i3(sp.atoms.length)}${i3(sp.bonds.length)}  0     0  0  0  0  0  0999 V2000`];
  for (const a of sp.atoms) lines.push(`${f4(a.x)}${f4(a.y)}${f4(a.z)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
  for (const b of sp.bonds) lines.push(`${i3(b.a + 1)}${i3(b.b + 1)}${i3(b.order)}  0  0  0  0`);
  lines.push('M  END');
  return lines.join('\n');
}

const angleSum = (sp: Species3D, center: number, nb: number[]) => {
  let s = 0;
  for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) s += atomAngle(sp, nb[i], center, nb[j]);
  return s;
};

/** Mide el grupo amida de un confórmero (primera amida que encuentra). */
export function amideGeometry(sp: Species3D): AmideGeometry | null {
  const m = graphOf(sp);
  const g = detectGroups(m).find((x) => x.kind === 'amida' || x.kind === 'urea');
  if (!g) return null;
  const c = g.center, o = carbonylO(m, c)!, n = g.atoms.find((a) => m.atoms[a].el === 'N')!;
  const nbN = neighbors(m, n), nbC = neighbors(m, c);
  const pts = [...new Set([c, o, n, ...nbN, ...nbC])].map((i) => sp.atoms[i]);
  return { c, o, n, dCO: atomDistance(sp, c, o), dCN: atomDistance(sp, c, n), sumN: nbN.length === 3 ? angleSum(sp, n, nbN) : NaN, sumC: angleSum(sp, c, nbC), planarity: planeDeviation(pts) };
}

export interface AmineGeometry { n: number; dCN: number; sumN: number }
/** Mide el N de una amina (primera amina que encuentra): longitud C–N y suma de ángulos (pirámide). */
export function amineGeometry(sp: Species3D): AmineGeometry | null {
  const m = graphOf(sp);
  const g = detectGroups(m).find((x) => x.kind === 'amina');
  if (!g) return null;
  const n = g.center;
  const nb = neighbors(m, n);
  const cN = nb.find((v) => m.atoms[v].el === 'C')!;
  return { n, dCN: atomDistance(sp, n, cN), sumN: angleSum(sp, n, nb) };
}

/** Desviación máxima respecto del plano de mínimos cuadrados (vía la normal de menor varianza, iteración de potencia). */
export function planeDeviation(pts: { x: number; y: number; z: number }[]): number {
  const n = pts.length;
  const c = [pts.reduce((s, p) => s + p.x, 0) / n, pts.reduce((s, p) => s + p.y, 0) / n, pts.reduce((s, p) => s + p.z, 0) / n];
  const q = pts.map((p) => [p.x - c[0], p.y - c[1], p.z - c[2]]);
  const C = [0, 1, 2].map((i) => [0, 1, 2].map((j) => q.reduce((s, v) => s + v[i] * v[j], 0)));
  // la normal es el vector propio de menor valor propio: iteración inversa con desplazamiento 0 (C + εI)
  const inv = invert3(C.map((r, i) => r.map((v, j) => v + (i === j ? 1e-9 : 0))));
  let v = [1, 0.3, 0.2];
  for (let k = 0; k < 60; k++) {
    const w = [0, 1, 2].map((i) => inv[i][0] * v[0] + inv[i][1] * v[1] + inv[i][2] * v[2]);
    const norm = Math.hypot(w[0], w[1], w[2]) || 1;
    v = w.map((x) => x / norm);
  }
  return Math.max(...q.map((p) => Math.abs(p[0] * v[0] + p[1] * v[1] + p[2] * v[2])));
}
function invert3(a: number[][]): number[][] {
  const [[a0, a1, a2], [b0, b1, b2], [c0, c1, c2]] = a;
  const det = a0 * (b1 * c2 - b2 * c1) - a1 * (b0 * c2 - b2 * c0) + a2 * (b0 * c1 - b1 * c0);
  const d = det || 1e-12;
  return [
    [(b1 * c2 - b2 * c1) / d, (a2 * c1 - a1 * c2) / d, (a1 * b2 - a2 * b1) / d],
    [(b2 * c0 - b0 * c2) / d, (a0 * c2 - a2 * c0) / d, (a2 * b0 - a0 * b2) / d],
    [(b0 * c1 - b1 * c0) / d, (a1 * c0 - a0 * c1) / d, (a0 * b1 - a1 * b0) / d],
  ];
}

/** Valores experimentales de referencia del enlace peptídico (Corey y Pauling, 1953, cristales de aminoácidos y péptidos). */
export const PEPTIDE_REF = { dCN: 1.32, dCO: 1.24, dNCa: 1.47, cita: 'Corey, R. B. y Pauling, L. (1953). Fundamental dimensions of polypeptide chains. Proc. R. Soc. Lond. B, 141, 10–20.' };

/* ------------------------------------------------------------------ control de calidad de datos de combustión */

export interface ConsistencyRow { id: string; n: number; value: number; predicted: number; residual: number; flagged: boolean }

/**
 * Para una serie homóloga con ΔcH° publicados ajusta una recta ROBUSTA (Theil-Sen: mediana de las pendientes entre pares de puntos y
 * mediana de las ordenadas) y marca los residuos mayores que `tol` kJ/mol. En una serie homóloga cada CH₂ añade casi la misma
 * energía, así que un dato mal transcrito queda lejos de la recta sin arrastrarla (la mediana no se deja llevar por un valor atípico).
 */
export function homologousCheck(ids: string[], tol = 15): ConsistencyRow[] & { slope?: number; intercept?: number } {
  const pts = ids.map((id) => { const r = getFunc(id); return r.propiedades.dHc ? { id, n: carbonsOf(r.formula), value: r.propiedades.dHc.valor } : null; }).filter((x): x is { id: string; n: number; value: number } => !!x);
  const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
  const slopes: number[] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (pts[j].n !== pts[i].n) slopes.push((pts[j].value - pts[i].value) / (pts[j].n - pts[i].n));
  const b = med(slopes), a = med(pts.map((p) => p.value - b * p.n));
  const rows = pts.map((p) => { const predicted = a + b * p.n; return { ...p, predicted, residual: p.value - predicted, flagged: Math.abs(p.value - predicted) > tol }; }) as ConsistencyRow[] & { slope?: number; intercept?: number };
  rows.slope = b; rows.intercept = a;
  return rows;
}
export const ALCOHOL_COMBUSTION_SERIES = ['metanol', 'etanol', 'propan-1-ol', 'hexan-1-ol', 'heptan-1-ol'];

/* ------------------------------------------------------------------ fichas de los modelos */



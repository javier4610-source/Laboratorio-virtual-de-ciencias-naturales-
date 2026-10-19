import { INDICATORS, indicatorColor } from './acidbase';
import { HENRY_CO2, hydroxide2Solubility, KSP, mixturePHGeneral, SOLUTES, strongBasePH, type Solute } from './aqueousEquilibria';
import { ATOMIC_MASS } from './balancing';
import { buildCompound, parseFormula, type Compound, type Spec } from './inorganicNomenclature';
import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Óxidos e hidróxidos (grado 10.º): combustión de metales y no metales, reacción de los óxidos con agua y carácter
 * ácido-base de la disolución con indicadores.
 *
 * 1. Combustión completa en exceso de O₂ con la ecuación balanceada: n(óxido) = n(elemento)·(ν_óxido/ν_elemento) y
 *    m(óxido) = n(óxido)·M(óxido) (ley de las proporciones definidas). Balanza de 0,01 g.
 * 2. Óxido + agua: óxido básico soluble → hidróxido (base fuerte, limitada por su Kps si es poco soluble);
 *    óxido ácido → oxácido (CO₂ limitado por la ley de Henry a 1 atm); óxidos insolubles (CuO, Al₂O₃, Fe₂O₃) no
 *    reaccionan con el agua y el pH queda en 7.
 * 3. pH por balance de cargas (src/models/aqueousEquilibria.ts, que generaliza src/models/acidbase.ts) y color de
 *    fenolftaleína (src/models/acidbase.ts), papel tornasol e indicador universal (colores aproximados).
 */

export type SubstanceKind = 'metal' | 'nometal' | 'oxido';

export interface Substance {
  id: string;
  name: string;
  /** Símbolo o fórmula del reactivo. */
  formula: string;
  kind: SubstanceKind;
  /** Óxido que se forma (o que hay en el frasco). */
  oxide: Spec;
  /** Coeficientes de la combustión: ν·elemento + ν·O₂ → ν·óxido. */
  burn?: { el: number; o2: number; ox: number; oxideFormula: string };
  /** Producto con agua (null si el óxido no reacciona con el agua). */
  water: null | { product: Spec; perOxide: number; waters: number; productFormula: string };
  flame?: string;
  note?: string;
}

export const SUBSTANCES: Substance[] = [
  { id: 'mg', name: 'Magnesio (cinta)', formula: 'Mg', kind: 'metal', oxide: { kind: 'oxido', el: 'Mg', ox: 2 }, burn: { el: 2, o2: 1, ox: 2, oxideFormula: 'MgO' },
    water: { product: { kind: 'hidroxido', el: 'Mg', ox: 2 }, perOxide: 1, waters: 1, productFormula: 'Mg(OH)2' }, flame: 'luz blanca muy brillante (no mires directamente)' },
  { id: 'ca', name: 'Calcio (granallas)', formula: 'Ca', kind: 'metal', oxide: { kind: 'oxido', el: 'Ca', ox: 2 }, burn: { el: 2, o2: 1, ox: 2, oxideFormula: 'CaO' },
    water: { product: { kind: 'hidroxido', el: 'Ca', ox: 2 }, perOxide: 1, waters: 1, productFormula: 'Ca(OH)2' }, flame: 'llama rojo anaranjada' },
  { id: 'cu', name: 'Cobre (lámina, calentada)', formula: 'Cu', kind: 'metal', oxide: { kind: 'oxido', el: 'Cu', ox: 2 }, burn: { el: 2, o2: 1, ox: 2, oxideFormula: 'CuO' },
    water: null, flame: 'no arde: se cubre de una capa negra al calentarlo', note: 'El CuO es un óxido básico insoluble: no forma hidróxido con el agua, pero sí reacciona con los ácidos.' },
  { id: 'al', name: 'Aluminio (polvo)', formula: 'Al', kind: 'metal', oxide: { kind: 'oxido', el: 'Al', ox: 3 }, burn: { el: 4, o2: 3, ox: 2, oxideFormula: 'Al2O3' },
    water: null, flame: 'chispas blancas', note: 'El Al₂O₃ es anfótero e insoluble en agua: reacciona con ácidos y con bases fuertes, no con el agua.' },
  { id: 'c', name: 'Carbono (carbón vegetal)', formula: 'C', kind: 'nometal', oxide: { kind: 'oxido', el: 'C', ox: 4 }, burn: { el: 1, o2: 1, ox: 1, oxideFormula: 'CO2' },
    water: { product: { kind: 'oxacido', el: 'C', ox: 4 }, perOxide: 1, waters: 1, productFormula: 'H2CO3' }, flame: 'brasa naranja sin llama' },
  { id: 's', name: 'Azufre (polvo)', formula: 'S', kind: 'nometal', oxide: { kind: 'oxido', el: 'S', ox: 4 }, burn: { el: 1, o2: 1, ox: 1, oxideFormula: 'SO2' },
    water: { product: { kind: 'oxacido', el: 'S', ox: 4 }, perOxide: 1, waters: 1, productFormula: 'H2SO3' }, flame: 'llama azul pálida; gas de olor picante (usa campana de extracción)',
    note: 'Al arder en el aire el azufre forma SO₂, no SO₃: para obtener SO₃ hace falta un catalizador (proceso de contacto).' },
  { id: 'p', name: 'Fósforo rojo', formula: 'P', kind: 'nometal', oxide: { kind: 'oxido', el: 'P', ox: 5 }, burn: { el: 4, o2: 5, ox: 1, oxideFormula: 'P4O10' },
    water: { product: { kind: 'oxacido', el: 'P', ox: 5 }, perOxide: 4, waters: 6, productFormula: 'H3PO4' }, flame: 'llama amarilla brillante y humo blanco de P₄O₁₀' },
  { id: 'na2o', name: 'Óxido de sodio (frasco)', formula: 'Na2O', kind: 'oxido', oxide: { kind: 'oxido', el: 'Na', ox: 1 },
    water: { product: { kind: 'hidroxido', el: 'Na', ox: 1 }, perOxide: 2, waters: 1, productFormula: 'NaOH' },
    note: 'El sodio que arde en el aire forma sobre todo peróxido (Na₂O₂); por eso aquí el óxido de sodio se toma de un frasco.' },
  { id: 'fe2o3', name: 'Óxido de hierro(III) (herrumbre)', formula: 'Fe2O3', kind: 'oxido', oxide: { kind: 'oxido', el: 'Fe', ox: 3 }, water: null,
    note: 'La herrumbre es un óxido básico insoluble: el agua no la disuelve y el pH no cambia.' },
];

export function substanceById(id: string): Substance {
  const s = SUBSTANCES.find((x) => x.id === id);
  if (!s) throw new RangeError(`Sustancia desconocida: ${id}`);
  return s;
}

/** Masa molar con las masas atómicas de balancing.ts (CIAAW abreviadas). */
export function molar(formula: string): number {
  return Object.entries(parseFormula(formula)).reduce((t, [el, n]) => {
    const m = ATOMIC_MASS[el];
    if (m === undefined) throw new RangeError(`Falta la masa atómica de ${el}.`);
    return t + m * n;
  }, 0);
}

export const LIMITS = { mass: [0.05, 2] as [number, number], water: [50, 250] as [number, number] };
export const BALANCE_RES = 0.01; // g
export const PH_RES = 0.01;

export interface BurnResult {
  substance: Substance;
  oxide: Compound;
  equation: string;
  molesElement: number;
  molesOxide: number;
  massOxide: number;
  /** Lectura de la balanza (0,01 g); para los gases no se pesa (null). */
  massReading: number | null;
  ratio: number;
  gas: boolean;
}

const sub = (f: string) => f.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
const coef = (n: number) => (n === 1 ? '' : `${n} `);

/** Combustión completa de `mass` gramos del elemento en exceso de oxígeno. */
export function burn(id: string, mass: number): BurnResult {
  const s = substanceById(id);
  if (!s.burn) throw new RangeError(`${s.name} no se quema en esta práctica: está en un frasco.`);
  assertInRange('La masa del reactivo', mass, ...LIMITS.mass);
  const M = ATOMIC_MASS[s.formula];
  const n = mass / M;
  const nOx = (n * s.burn.ox) / s.burn.el;
  const Mox = molar(s.burn.oxideFormula);
  const massOxide = nOx * Mox;
  const gas = s.id === 'c' || s.id === 's';
  return {
    substance: s, oxide: buildCompound(s.oxide),
    equation: `${coef(s.burn.el)}${s.formula} + ${coef(s.burn.o2)}O₂ → ${coef(s.burn.ox)}${sub(s.burn.oxideFormula)}`,
    molesElement: n, molesOxide: nOx, massOxide, massReading: gas ? null : roundToResolution(massOxide, BALANCE_RES), ratio: massOxide / mass, gas,
  };
}

export type Character = 'ácido' | 'básico' | 'neutro';

export interface IndicatorReading { name: string; color: string; text: string }

export interface DissolveResult {
  substance: Substance;
  oxide: Compound;
  product: Compound | null;
  equation: string | null;
  /** Moles de óxido que entran al agua. */
  molesOxide: number;
  /** Concentración nominal del producto (mol/L) y la que realmente queda disuelta. */
  nominal: number;
  dissolved: number;
  limitedBy: 'nada' | 'Kps' | 'Henry' | 'insoluble';
  pH: number;
  pHReading: number;
  character: Character;
  indicators: IndicatorReading[];
  note: string;
}

/** Papel tornasol: rojo por debajo de 4,5 y azul por encima de 8,3 (intervalo aproximado de uso escolar). */
export function litmus(pH: number): IndicatorReading {
  if (pH < 4.5) return { name: 'Papel tornasol', color: '#d0384a', text: 'papel rojo' };
  if (pH > 8.3) return { name: 'Papel tornasol', color: '#3d5fc4', text: 'papel azul' };
  return { name: 'Papel tornasol', color: '#8a5aa8', text: 'papel morado (sin viraje claro)' };
}

/** Indicador universal: escala de colores aproximada (varía según el fabricante). */
export const UNIVERSAL_SCALE: { max: number; color: string; text: string }[] = [
  { max: 2.5, color: '#d1242f', text: 'rojo' }, { max: 4.5, color: '#ef6c1a', text: 'naranja' }, { max: 6.5, color: '#e8c419', text: 'amarillo' },
  { max: 7.5, color: '#3fa34d', text: 'verde' }, { max: 8.5, color: '#1f8f8a', text: 'verde azulado' }, { max: 10.5, color: '#2f5fc4', text: 'azul' },
  { max: 15, color: '#6a3fb0', text: 'violeta' },
];
export function universal(pH: number): IndicatorReading {
  const s = UNIVERSAL_SCALE.find((x) => pH <= x.max)!;
  return { name: 'Indicador universal', color: s.color, text: s.text };
}
export function phenolphthalein(pH: number): IndicatorReading {
  const ind = INDICATORS.find((i) => i.id === 'fenolftaleina')!;
  const c = indicatorColor(ind, pH);
  return { name: 'Fenolftaleína', color: c.color, text: pH <= ind.low ? 'incolora' : pH >= ind.high ? 'fucsia' : 'rosada pálida' };
}
export const characterOf = (pH: number): Character => (pH < 6.5 ? 'ácido' : pH > 7.5 ? 'básico' : 'neutro');

/** El óxido (`molesOxide` mol) reacciona con `waterMl` mL de agua destilada sin CO₂; pH al equilibrio. */
export function dissolve(id: string, molesOxide: number, waterMl: number): DissolveResult {
  const s = substanceById(id);
  assertInRange('El volumen de agua', waterMl, ...LIMITS.water);
  if (!(molesOxide > 0)) throw new RangeError('No hay óxido para disolver.');
  const oxide = buildCompound(s.oxide);
  const V = waterMl / 1000;
  if (!s.water) {
    const pH = 7;
    return { substance: s, oxide, product: null, equation: null, molesOxide, nominal: 0, dissolved: 0, limitedBy: 'insoluble', pH, pHReading: roundToResolution(pH, PH_RES), character: 'neutro',
      indicators: [phenolphthalein(pH), litmus(pH), universal(pH)], note: s.note ?? 'El óxido no reacciona con el agua.' };
  }
  const product = buildCompound(s.water.product);
  const oxF = s.burn?.oxideFormula ?? s.formula;
  const equation = `${sub(oxF)} + ${coef(s.water.waters)}H₂O → ${coef(s.water.perOxide)}${sub(s.water.productFormula)}`;
  const nominal = (molesOxide * s.water.perOxide) / V;
  let dissolved = nominal, limitedBy: DissolveResult['limitedBy'] = 'nada', pH: number, note = '';
  if (s.id === 'mg' || s.id === 'ca') {
    const sat = hydroxide2Solubility(s.id === 'mg' ? KSP.MgOH2 : KSP.CaOH2);
    if (nominal > sat) { dissolved = sat; limitedBy = 'Kps'; note = `Solo se disuelven ${sat.toExponential(2).replace('.', ',')} mol/L de ${s.id === 'mg' ? 'Mg(OH)₂' : 'Ca(OH)₂'} (Kps); el resto queda como sólido en el fondo.`; }
    pH = strongBasePH(2 * dissolved);
  } else if (s.id === 'na2o') {
    pH = strongBasePH(dissolved);
  } else {
    let sol: Solute;
    if (s.id === 'c') {
      if (nominal > HENRY_CO2) { dissolved = HENRY_CO2; limitedBy = 'Henry'; note = 'El agua solo disuelve unos 0,034 mol/L de CO₂ a 1 atm (ley de Henry); el resto del gas queda en el matraz.'; }
      sol = SOLUTES.H2CO3(dissolved);
    } else if (s.id === 's') sol = SOLUTES.H2SO3(dissolved);
    else sol = SOLUTES.H3PO4(dissolved);
    pH = mixturePHGeneral({ solutes: [sol] });
  }
  return { substance: s, oxide, product, equation, molesOxide, nominal, dissolved, limitedBy, pH, pHReading: roundToResolution(pH, PH_RES), character: characterOf(pH),
    indicators: [phenolphthalein(pH), litmus(pH), universal(pH)], note: note || (s.note ?? '') };
}

export const oxidesModelSpec: ModelSpec = {
  name: 'Combustión de metales y no metales, óxidos + agua y carácter ácido-base de la disolución',
  inputs: [
    { symbol: 'reactivo', name: 'Elemento que se quema (Mg, Ca, Cu, Al, C, S, P) u óxido del frasco (Na₂O, Fe₂O₃)', unit: '—', initial: 'Mg' },
    { symbol: 'm', name: 'Masa del reactivo', unit: 'g', range: LIMITS.mass, initial: 0.5 },
    { symbol: 'V', name: 'Volumen de agua destilada', unit: 'mL', range: LIMITS.water, initial: 100 },
  ],
  outputs: [
    { symbol: 'm(óxido)', name: 'Masa del óxido (balanza de 0,01 g)', unit: 'g' },
    { symbol: 'pH', name: 'pH de la disolución (pH-metro de 0,01)', unit: '—' },
    { symbol: 'indicadores', name: 'Color de fenolftaleína, papel tornasol e indicador universal', unit: '—' },
  ],
  equations: [
    'n = m/M;  n(óxido) = n(elemento)·ν(óxido)/ν(elemento);  m(óxido) = n(óxido)·M(óxido)',
    'Óxido básico + H₂O → hidróxido;  óxido ácido + H₂O → oxácido',
    'M(OH)₂ poco soluble: s = (Kps/4)^(1/3), [OH⁻] = 2s;  CO₂: [H₂CO₃] ≤ Kᴴ·p(CO₂)',
    'Balance de cargas: [H⁺] + Σ cationes = [OH⁻] + Σ C·Σ αⱼ·j;  pH = −log[H⁺]',
  ],
  initialConditions: ['0,50 g de cinta de magnesio que arde en el aire; el óxido se agita con 100 mL de agua destilada.'],
  assumptions: [
    'Combustión completa en exceso de oxígeno, sin pérdidas de masa (no escapa humo de óxido).',
    'Agua destilada sin CO₂ disuelto, a 25 °C; se alcanza el equilibrio (disolución saturada si el hidróxido es poco soluble).',
    'Actividades iguales a concentraciones; el volumen no cambia al disolver el óxido.',
    'pKa de Harris (2010, apéndice G), Kps del CRC Handbook (2016) y constante de Henry del CO₂ de Sander (2015).',
  ],
  limits: [
    'El sodio arde formando peróxido; el hierro (lana de acero) forma Fe₃O₄; por eso no se queman en el modelo.',
    'El SO₂ y el P₄O₁₀ se suponen totalmente absorbidos por el agua; en la realidad parte del gas escapa.',
    'Los colores del papel tornasol y del indicador universal son aproximados (dependen del fabricante); la fenolftaleína usa el intervalo 8,2–10,0.',
  ],
  testCases: [
    '2 Mg + O₂ → 2 MgO: m(MgO)/m(Mg) = 40,304/24,305 = 1,6583; 0,50 g de Mg → 0,83 g de MgO.',
    'Mg(OH)₂ saturado (Kps = 5,61 × 10⁻¹²) → pH 10,35; Ca(OH)₂ saturado (Kps = 5,02 × 10⁻⁶) → pH 12,33.',
    '0,310 g de Na₂O en 100 mL → NaOH 0,100 M → pH 13,00; CuO y Fe₂O₃ → pH 7,00.',
    'El solucionador poliprótico coincide con solvePH de acidbase.ts para un ácido monoprótico con NaOH.',
  ],
};

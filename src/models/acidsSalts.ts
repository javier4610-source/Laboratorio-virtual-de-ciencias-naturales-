import { titrate } from './acidbase';
import { mixturePHGeneral, PKA, SOLUTES, strongBasePH, type Mixture } from './aqueousEquilibria';
import { buildCompound, type Compound, type Spec } from './inorganicNomenclature';
import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Ácidos y sales (grado 10.º): formación de hidrácidos y oxácidos, neutralización ácido + hidróxido → sal + agua con
 * curva de titulación, y carácter ácido-base de las disoluciones de sales.
 *
 * - HCl y CH₃COOH con NaOH: se usa directamente titrate() de src/models/acidbase.ts (modelo existente del laboratorio).
 * - HNO₃, H₂SO₄ y H₃PO₄: balance de cargas general (src/models/aqueousEquilibria.ts), que reproduce a acidbase.ts en el
 *   caso monoprótico. Una sal MₐXᵦ se trata como su ácido totalmente protonado más los cationes espectadores
 *   (NaHCO₃ = H₂CO₃ + Na⁺): el balance de cargas es el mismo.
 * - Supuestos: 25 °C, actividades = concentraciones, volúmenes aditivos, sin CO₂ del aire.
 */

export interface AcidDef { id: string; name: string; formula: string; protons: number; /** Especificación para el motor de nomenclatura (null: ácido orgánico). */ spec: Spec | null; note: string }

export const TITRATION_ACIDS: AcidDef[] = [
  { id: 'hcl', name: 'Ácido clorhídrico', formula: 'HCl', protons: 1, spec: { kind: 'hidracido', el: 'Cl' }, note: 'Hidrácido fuerte: se disocia por completo.' },
  { id: 'hno3', name: 'Ácido nítrico', formula: 'HNO3', protons: 1, spec: { kind: 'oxacido', el: 'N', ox: 5 }, note: 'Oxácido fuerte.' },
  { id: 'h2so4', name: 'Ácido sulfúrico', formula: 'H2SO4', protons: 2, spec: { kind: 'oxacido', el: 'S', ox: 6 }, note: 'Diprótico: la primera disociación es fuerte y la segunda (HSO₄⁻, pKa = 1,99) es parcial.' },
  { id: 'acetico', name: 'Ácido acético (vinagre)', formula: 'CH3COOH', protons: 1, spec: null, note: 'Ácido orgánico débil (Ka = 1,8 × 10⁻⁵): la sal que forma (acetato) es básica.' },
  { id: 'h3po4', name: 'Ácido fosfórico', formula: 'H3PO4', protons: 3, spec: { kind: 'oxacido', el: 'P', ox: 5 }, note: 'Triprótico débil: con NaOH se ven dos saltos de pH; el tercero (pKa = 12,4) no se distingue.' },
];
export const acidDef = (id: string) => { const a = TITRATION_ACIDS.find((x) => x.id === id); if (!a) throw new RangeError(`Ácido desconocido: ${id}`); return a; };

export const TITRATION_LIMITS = { acidConc: [0.01, 0.5] as [number, number], acidVolume: [10, 50] as [number, number], baseConc: [0.01, 0.5] as [number, number], baseVolume: [0, 100] as [number, number] };

function acidMixture(acidId: string, ca: number, cb: number): Mixture {
  switch (acidId) {
    case 'hno3': return { solutes: [SOLUTES.HNO3(ca)], cations: cb };
    case 'h2so4': return { solutes: [SOLUTES.H2SO4(ca)], cations: cb };
    case 'h3po4': return { solutes: [SOLUTES.H3PO4(ca)], cations: cb };
    case 'hcl': return { solutes: [SOLUTES.HCl(ca)], cations: cb };
    case 'acetico': return { solutes: [SOLUTES.CH3COOH(ca)], cations: cb };
    default: throw new RangeError(`Ácido desconocido: ${acidId}`);
  }
}

/** pH de la mezcla: ácido (Ca, Va en mL) + NaOH (Cb, Vb en mL). HCl y acético se calculan con acidbase.titrate. */
export function titrationPH(acidId: string, ca: number, va: number, cb: number, vb: number): number {
  assertInRange('La concentración del ácido', ca, ...TITRATION_LIMITS.acidConc);
  assertInRange('El volumen del ácido', va, ...TITRATION_LIMITS.acidVolume);
  assertInRange('La concentración del NaOH', cb, ...TITRATION_LIMITS.baseConc);
  assertInRange('El volumen de NaOH', vb, ...TITRATION_LIMITS.baseVolume);
  if (acidId === 'hcl' || acidId === 'acetico') return titrate({ acidId, acidConc: ca, acidVolume: va, baseConc: cb, baseVolume: vb }).pH;
  const V = va + vb;
  return mixturePHGeneral(acidMixture(acidId, (ca * va) / V, (cb * vb) / V));
}

/** Volúmenes de NaOH en los puntos de equivalencia (mL): k·Ca·Va/Cb para k = 1…protones. */
export function equivalenceVolumes(acidId: string, ca: number, va: number, cb: number): number[] {
  const a = acidDef(acidId);
  return Array.from({ length: a.protons }, (_, k) => ((k + 1) * ca * va) / cb);
}

export function titrationCurve(acidId: string, ca: number, va: number, cb: number, vmax: number, points = 160): { v: number; pH: number }[] {
  return Array.from({ length: points + 1 }, (_, i) => { const v = (vmax * i) / points; return { v, pH: titrationPH(acidId, ca, va, cb, v) }; });
}

export interface Neutralization { equation: string; salt: { formula: string; names: { sistematica: string; stock: string | null; tradicional: string | null }; compound: Compound | null }; ratio: number }

/** Neutralización completa con NaOH: ecuación balanceada y sal formada (nombres del motor de nomenclatura). */
export function neutralization(acidId: string): Neutralization {
  const sub = (f: string) => f.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
  const salts: Record<string, [string, Spec | null, number, string]> = {
    hcl: ['NaCl', { kind: 'sal-binaria', cation: { el: 'Na', ox: 1 }, anion: 'Cl' }, 1, 'HCl + NaOH → NaCl + H₂O'],
    hno3: ['NaNO3', { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'N', ox: 5 } }, 1, 'HNO₃ + NaOH → NaNO₃ + H₂O'],
    h2so4: ['Na2SO4', { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'S', ox: 6 } }, 2, 'H₂SO₄ + 2 NaOH → Na₂SO₄ + 2 H₂O'],
    h3po4: ['Na3PO4', { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'P', ox: 5 } }, 3, 'H₃PO₄ + 3 NaOH → Na₃PO₄ + 3 H₂O'],
    acetico: ['CH3COONa', null, 1, 'CH₃COOH + NaOH → CH₃COONa + H₂O'],
  };
  const [formula, spec, ratio, equation] = salts[acidId];
  if (!spec) return { equation, ratio, salt: { formula: sub(formula), names: { sistematica: 'etanoato de sodio', stock: 'acetato de sodio', tradicional: 'acetato sódico' }, compound: null } };
  const c = buildCompound(spec);
  return { equation, ratio, salt: { formula: c.formulaPretty, names: { sistematica: c.names.sistematica, stock: c.names.stock, tradicional: c.names.tradicional }, compound: c } };
}

/* ------------------------------------------------------------------ disoluciones de sales */

export interface SaltDef {
  id: string; spec: Spec | null; formula: string; label: string;
  /** Mezcla equivalente: ácido totalmente protonado + cationes/aniones espectadores, por mol/L de sal. */
  mix: (c: number) => Mixture;
  origin: string;
}
const k = (p: number) => 10 ** -p;
export const SALTS: SaltDef[] = [
  { id: 'nacl', spec: { kind: 'sal-binaria', cation: { el: 'Na', ox: 1 }, anion: 'Cl' }, formula: 'NaCl', label: 'Cloruro de sodio (sal de cocina)', mix: (c) => ({ solutes: [], cations: c, anions: c }), origin: 'ácido fuerte (HCl) + base fuerte (NaOH)' },
  { id: 'kno3', spec: { kind: 'oxisal', cation: { el: 'K', ox: 1 }, acid: { el: 'N', ox: 5 } }, formula: 'KNO3', label: 'Nitrato de potasio (fertilizante)', mix: (c) => ({ solutes: [], cations: c, anions: c }), origin: 'ácido fuerte (HNO₃) + base fuerte (KOH)' },
  { id: 'na2so4', spec: { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'S', ox: 6 } }, formula: 'Na2SO4', label: 'Sulfato de sodio', mix: (c) => ({ solutes: [SOLUTES.H2SO4(c)], cations: 2 * c }), origin: 'ácido fuerte (H₂SO₄) + base fuerte (NaOH)' },
  { id: 'nh4cl', spec: { kind: 'sal-binaria', cation: { el: 'NH4' }, anion: 'Cl' }, formula: 'NH4Cl', label: 'Cloruro de amonio', mix: (c) => ({ solutes: [SOLUTES.NH4(c)], anions: c }), origin: 'ácido fuerte (HCl) + base débil (NH₃)' },
  { id: 'nh42so4', spec: { kind: 'oxisal', cation: { el: 'NH4' }, acid: { el: 'S', ox: 6 } }, formula: '(NH4)2SO4', label: 'Sulfato de amonio (fertilizante del banano)', mix: (c) => ({ solutes: [SOLUTES.NH4(2 * c), SOLUTES.H2SO4(c)] }), origin: 'ácido fuerte (H₂SO₄) + base débil (NH₃)' },
  { id: 'nahso4', spec: { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'S', ox: 6 }, hLeft: 1 }, formula: 'NaHSO4', label: 'Hidrogenosulfato de sodio', mix: (c) => ({ solutes: [SOLUTES.H2SO4(c)], cations: c }), origin: 'neutralización parcial del H₂SO₄' },
  { id: 'nahco3', spec: { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'C', ox: 4 }, hLeft: 1 }, formula: 'NaHCO3', label: 'Hidrogenocarbonato de sodio (bicarbonato)', mix: (c) => ({ solutes: [SOLUTES.H2CO3(c)], cations: c }), origin: 'neutralización parcial del H₂CO₃ (ácido débil)' },
  { id: 'na2co3', spec: { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'C', ox: 4 } }, formula: 'Na2CO3', label: 'Carbonato de sodio', mix: (c) => ({ solutes: [SOLUTES.H2CO3(c)], cations: 2 * c }), origin: 'ácido débil (H₂CO₃) + base fuerte (NaOH)' },
  { id: 'kh2po4', spec: { kind: 'oxisal', cation: { el: 'K', ox: 1 }, acid: { el: 'P', ox: 5 }, hLeft: 2 }, formula: 'KH2PO4', label: 'Dihidrogenofosfato de potasio', mix: (c) => ({ solutes: [SOLUTES.H3PO4(c)], cations: c }), origin: 'neutralización parcial del H₃PO₄' },
  { id: 'na3po4', spec: { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'P', ox: 5 } }, formula: 'Na3PO4', label: 'Fosfato de sodio', mix: (c) => ({ solutes: [SOLUTES.H3PO4(c)], cations: 3 * c }), origin: 'ácido débil (H₃PO₄) + base fuerte (NaOH)' },
  { id: 'naclo', spec: { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'Cl', ox: 1 } }, formula: 'NaClO', label: 'Hipoclorito de sodio (blanqueador)', mix: (c) => ({ solutes: [SOLUTES.HClO(c)], cations: c }), origin: 'ácido débil (HClO) + base fuerte (NaOH)' },
  { id: 'ch3coona', spec: null, formula: 'CH3COONa', label: 'Acetato de sodio', mix: (c) => ({ solutes: [SOLUTES.CH3COOH(c)], cations: c }), origin: 'ácido débil (CH₃COOH) + base fuerte (NaOH)' },
];
export const saltDef = (id: string) => { const s = SALTS.find((x) => x.id === id); if (!s) throw new RangeError(`Sal desconocida: ${id}`); return s; };
export const SALT_LIMITS = { conc: [0.001, 0.5] as [number, number] };

export interface SaltSolution { salt: SaltDef; compound: Compound | null; pH: number; pHReading: number; character: 'ácida' | 'básica' | 'neutra'; saltClass: string; explanation: string }

export function saltSolution(id: string, c: number): SaltSolution {
  assertInRange('La concentración de la sal', c, ...SALT_LIMITS.conc);
  const s = saltDef(id);
  const pH = mixturePHGeneral(s.mix(c));
  const character = pH < 6.5 ? 'ácida' : pH > 7.5 ? 'básica' : 'neutra';
  const compound = s.spec ? buildCompound(s.spec) : null;
  const saltClass = compound ? (compound.fn === 'sal-acida' ? 'sal ácida (conserva H del ácido)' : compound.fn === 'sal-haloidea' ? 'sal haloidea neutra' : 'oxisal neutra') : 'sal orgánica neutra';
  const explanation = character === 'neutra'
    ? `Proviene de ${s.origin}: sus iones casi no reaccionan con el agua.`
    : character === 'básica'
      ? `Proviene de ${s.origin}: el anión toma H⁺ del agua y deja OH⁻ libres (hidrólisis básica).`
      : `Proviene de ${s.origin}: un ion cede H⁺ al agua (hidrólisis ácida o disociación del anión ácido).`;
  return { salt: s, compound, pH, pHReading: roundToResolution(pH, 0.01), character, saltClass, explanation };
}

/** Formación de un hidrácido: H₂ + Cl₂ → 2 HCl y su disolución (n mol de HCl en V mL). */
export function hydracidSolution(molesHCl: number, waterMl: number): number {
  if (!(molesHCl > 0)) throw new RangeError('No hay HCl.');
  return mixturePHGeneral({ solutes: [SOLUTES.HCl(molesHCl / (waterMl / 1000))] });
}

export { strongBasePH, PKA, k as kaFromPka };

export const acidsSaltsModelSpec: ModelSpec = {
  name: 'Neutralización ácido + NaOH con curva de titulación y pH de disoluciones de sales por balance de cargas',
  inputs: [
    { symbol: 'ácido', name: 'Ácido del erlenmeyer (HCl, HNO₃, H₂SO₄, CH₃COOH, H₃PO₄)', unit: '—', initial: 'HCl' },
    { symbol: 'C_A', name: 'Concentración del ácido', unit: 'mol/L', range: TITRATION_LIMITS.acidConc, initial: 0.1 },
    { symbol: 'V_A', name: 'Volumen del ácido', unit: 'mL', range: TITRATION_LIMITS.acidVolume, initial: 25 },
    { symbol: 'C_B', name: 'Concentración del NaOH de la bureta', unit: 'mol/L', range: TITRATION_LIMITS.baseConc, initial: 0.1 },
    { symbol: 'V_B', name: 'Volumen de NaOH añadido', unit: 'mL', range: TITRATION_LIMITS.baseVolume, initial: 0 },
    { symbol: 'C_sal', name: 'Concentración de la sal disuelta', unit: 'mol/L', range: SALT_LIMITS.conc, initial: 0.1 },
  ],
  outputs: [
    { symbol: 'pH', name: 'pH de la mezcla o de la disolución de la sal (pH-metro de 0,01)', unit: '—' },
    { symbol: 'V_eq', name: 'Volumen de NaOH en cada punto de equivalencia', unit: 'mL' },
    { symbol: 'sal', name: 'Sal formada, con sus nombres en los tres sistemas', unit: '—' },
  ],
  equations: [
    'Ácido + hidróxido → sal + agua;  H⁺ + OH⁻ → H₂O',
    'Equivalencias: V_eq,k = k·C_A·V_A/C_B (k = 1…n protones)',
    'Balance de cargas: [H⁺] + [Na⁺] = [OH⁻] + Σ C·Σ αⱼ·j  (αⱼ con Ka₁…Kaₙ)',
    'Sal MₐHₖX = ácido HₙX + (n − k) cationes espectadores por unidad de sal',
  ],
  initialConditions: ['25,00 mL de HCl 0,100 M con NaOH 0,100 M en la bureta, sin base añadida.'],
  assumptions: [
    '25 °C, Kw = 1,0 × 10⁻¹⁴, actividades iguales a concentraciones, volúmenes aditivos y mezcla instantánea.',
    'pKa de Harris (2010), apéndice G; Ka del acético 1,8 × 10⁻⁵ (modelo de la práctica de pH).',
    'Sin CO₂ del aire disuelto (en el laboratorio real el agua destilada suele tener pH ≈ 5,6).',
  ],
  limits: [
    'A concentraciones mayores de 0,1 M el pH real se aparta del calculado (actividades).',
    'No se incluyen sales de cationes metálicos que se hidrolizan (Fe³⁺, Al³⁺), cuyo pH depende de complejos con el agua.',
    'Los colores de los indicadores son aproximados.',
  ],
  testCases: [
    'HCl 0,100 M (25,00 mL) + 25,00 mL de NaOH 0,100 M → pH 7,00; H₂SO₄ 0,0500 M (25,00 mL) con NaOH 0,100 M: V_eq = 12,50 y 25,00 mL.',
    'NaHCO₃ 0,100 M → pH ≈ (pKa₁ + pKa₂)/2 = 8,34; NH₄Cl 0,100 M → pH ≈ 5,12; CH₃COONa 0,100 M → pH ≈ 8,87.',
    'El balance de cargas general coincide con acidbase.solvePH en el caso monoprótico.',
  ],
};

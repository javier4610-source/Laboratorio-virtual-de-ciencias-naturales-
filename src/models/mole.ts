import { assertInRange, R_GAS, roundToResolution } from './math';
import { ATOMIC_MASS, ELEMENT_NAME, molarMass, parseFormula, type Composition } from './balancing';
import { checkBalance, findReaction, simulateStoichiometry, type Reaction } from './stoichiometry';
import { reactionById as conservationReaction, VINEGAR_ACID } from './massConservation';
import type { ModelSpec } from './types';

/**
 * El mol y los cálculos estequiométricos básicos (grado 9.º): contar entidades pesando.
 *
 *   Masa molar:            M = Σ nᵢ·Ar(Eᵢ)                          (g/mol, a partir de la fórmula)
 *   Cantidad de sustancia: n = m / M                                 (mol)
 *   Número de entidades:   N = n·N_A,  N_A = 6,022 140 76 × 10²³ mol⁻¹ (valor exacto desde el SI de 2019)
 *   Átomos del elemento E: N_E = N·(subíndice de E en la fórmula)
 *   Masa de una entidad:   m₁ = M / N_A
 *   Gas ideal:             V = n·R·T / P  (22,414 L/mol a 273,15 K y 101,325 kPa)
 *
 * Reutiliza el analizador de fórmulas y las masas atómicas de `balancing.ts` (práctica «balanceo») y el
 * cálculo de reactivo limitante de `stoichiometry.ts` (práctica «estequiometria»), para que todas las
 * prácticas de química usen las mismas masas atómicas.
 */

/* ------------------------------------------------------------------ constantes */

/** Constante de Avogadro (mol⁻¹): valor exacto por definición desde la revisión del SI de 2019. */
export const AVOGADRO = 6.02214076e23;

/** Condiciones normales de referencia de la IUPAC anterior a 1982 (0 °C y 1 atm) y condiciones del aula. */
export const STP = { T: 273.15, P: 101.325 } as const; // K, kPa
export const ROOM = { T: 298.15, P: 101.325 } as const; // K, kPa

/**
 * Decimales con los que se conoce cada masa atómica estándar abreviada usada aquí (CIAAW/IUPAC).
 * El cloro se publica abreviado como 35,45 (dos decimales), por eso la masa molar del NaCl se informa con dos.
 */
export const ATOMIC_MASS_DECIMALS: Record<string, number> = { H: 3, C: 3, N: 3, O: 3, Na: 3, Al: 3, S: 2, Cl: 2, Ca: 3, Fe: 3, Cu: 3 };

/** Balanza de precisión del laboratorio: resolución 0,001 g, capacidad 220 g. */
export const BALANCE = { resolution: 0.001, capacity: 220 } as const;

/** Masas de los recipientes (g). Valores típicos ilustrativos, no de un modelo comercial concreto. */
export const BOAT_MASS = 1.274; // navecilla de pesaje de plástico
export const BEAKER_MASS = 68.215; // vaso de precipitados de 150 mL
export const PAPER_MASS = 0.412; // papel de pesar
export const CRUCIBLE_MASS = 21.364; // crisol de porcelana con tapa

export const MOLE_LIMITS = {
  portions: [0, 10] as [number, number],
  mass: [0, 1000] as [number, number],
  solid: [0.5, 5] as [number, number],
  vinegar: [10, 100] as [number, number],
};

/* ------------------------------------------------------------------ sustancias */

export type EntityKind = 'unidades fórmula' | 'moléculas' | 'átomos';
export type SubstanceId = 'sal' | 'azucar' | 'agua' | 'tiza' | 'bicarbonato' | 'hierro' | 'cobre' | 'aluminio';

export interface Substance {
  id: SubstanceId;
  name: string;
  formula: string;
  /** Qué se cuenta: unidades fórmula (sólidos iónicos), moléculas o átomos (metales). */
  entity: EntityKind;
  /** Cómo se toma una porción en el laboratorio. */
  portion: string;
  /** Masa nominal de una porción (g). Ilustrativa salvo cuando se indica cómo se calculó. */
  portionMass: number;
  /** Color del material (para el dibujo). */
  color: string;
  form: 'polvo' | 'liquido' | 'trozo' | 'puntilla' | 'alambre' | 'lamina';
  note: string;
}

export const SUBSTANCES: Substance[] = [
  { id: 'sal', name: 'Sal de cocina (cloruro de sodio)', formula: 'NaCl', entity: 'unidades fórmula', portion: 'una porción con la espátula', portionMass: 1.25, color: '#f4f6f7', form: 'polvo', note: 'La sal de cocina yodada tiene trazas de yodato de potasio y antiaglomerantes; se trata como NaCl puro.' },
  { id: 'azucar', name: 'Azúcar de mesa (sacarosa)', formula: 'C12H22O11', entity: 'moléculas', portion: 'una porción con la espátula', portionMass: 1.13, color: '#fbf3dc', form: 'polvo', note: 'El azúcar blanco refinado es casi sacarosa pura (más del 99 %).' },
  { id: 'agua', name: 'Agua destilada', formula: 'H2O', entity: 'moléculas', portion: '1 mL con la pipeta', portionMass: 0.997, color: '#cfe8f7', form: 'liquido', note: '1 mL de agua a 25 °C tiene una masa de 0,997 g (densidad 0,997 g/mL).' },
  { id: 'tiza', name: 'Tiza de carbonato de calcio', formula: 'CaCO3', entity: 'unidades fórmula', portion: 'un trozo de tiza', portionMass: 2.47, color: '#f7f7f2', form: 'trozo', note: 'Muchas tizas escolares son de yeso (sulfato de calcio) y no de carbonato: con unas gotas de vinagre, el carbonato hace efervescencia y el yeso no.' },
  { id: 'bicarbonato', name: 'Bicarbonato de sodio', formula: 'NaHCO3', entity: 'unidades fórmula', portion: 'una porción con la espátula', portionMass: 1.05, color: '#fdfdfb', form: 'polvo', note: 'Bicarbonato de uso doméstico (repostería), prácticamente puro.' },
  { id: 'hierro', name: 'Puntilla de acero (hierro)', formula: 'Fe', entity: 'átomos', portion: 'una puntilla de 2 pulgadas', portionMass: 2.613, color: '#8a9297', form: 'puntilla', note: 'Las puntillas son de acero: alrededor del 99 % de hierro con algo de carbono y manganeso; se tratan como hierro puro.' },
  { id: 'cobre', name: 'Alambre de cobre', formula: 'Cu', entity: 'átomos', portion: 'un trozo de 5 cm de alambre calibre 12 (Ø 2,05 mm)', portionMass: 1.483, color: '#c8743a', form: 'alambre', note: 'Masa calculada: V = π·(0,1026 cm)²·5 cm ≈ 0,166 cm³ y ρ = 8,96 g/cm³ → ≈ 1,48 g.' },
  { id: 'aluminio', name: 'Papel aluminio', formula: 'Al', entity: 'átomos', portion: 'un cuadro de 10 cm × 10 cm', portionMass: 0.432, color: '#cfd6da', form: 'lamina', note: 'Masa calculada para un espesor de 16 µm: V = 100 cm² × 0,0016 cm = 0,16 cm³ y ρ = 2,70 g/cm³ → 0,432 g.' },
];

export function findSubstance(id: string): Substance {
  const s = SUBSTANCES.find((x) => x.id === id);
  if (!s) throw new RangeError(`Sustancia desconocida: ${id}`);
  return s;
}

/* ------------------------------------------------------------------ masa molar y conteo */

export interface MolarMassInfo {
  formula: string;
  composition: Composition;
  /** Aporte de cada elemento: subíndice × masa atómica. */
  contributions: { element: string; name: string; count: number; atomicMass: number; subtotal: number }[];
  value: number;
  /** Decimales significativos (los del término menos preciso). */
  decimals: number;
}

/** Masa molar a partir de la fórmula, con el aporte de cada elemento y los decimales que se pueden informar. */
export function molarMassInfo(formula: string): MolarMassInfo {
  const composition = parseFormula(formula);
  const contributions = Object.entries(composition).map(([element, count]) => ({
    element, name: ELEMENT_NAME[element] ?? element, count, atomicMass: ATOMIC_MASS[element], subtotal: count * ATOMIC_MASS[element],
  }));
  const decimals = Math.min(...contributions.map((c) => ATOMIC_MASS_DECIMALS[c.element] ?? 2));
  return { formula, composition, contributions, value: molarMass(formula), decimals };
}

export interface EntityCount {
  mass: number;
  molarMass: number;
  moles: number;
  /** Número de entidades (unidades fórmula, moléculas o átomos). */
  entities: number;
  /** Átomos de cada elemento. */
  atoms: Record<string, number>;
  totalAtoms: number;
  /** Masa de una entidad (g). */
  massPerEntity: number;
}

/** Cantidad de sustancia, número de entidades y de átomos en una masa dada de una sustancia. */
export function countEntities(mass: number, formula: string): EntityCount {
  assertInRange('La masa de la muestra', mass, ...MOLE_LIMITS.mass);
  const info = molarMassInfo(formula);
  const moles = mass / info.value;
  const entities = moles * AVOGADRO;
  const atoms: Record<string, number> = {};
  let totalAtoms = 0;
  for (const [el, k] of Object.entries(info.composition)) { atoms[el] = entities * k; totalAtoms += entities * k; }
  return { mass, molarMass: info.value, moles, entities, atoms, totalAtoms, massPerEntity: info.value / AVOGADRO };
}

/** Masa (g) de n moles de una sustancia. */
export function massFromMoles(moles: number, formula: string): number {
  assertInRange('La cantidad de sustancia', moles, 0, 1000);
  return moles * molarMass(formula);
}

/** Volumen molar de un gas ideal (L/mol) a T (K) y P (kPa). */
export function molarVolumeL(T: number, P: number): number {
  assertInRange('La temperatura', T, 1, 2000);
  assertInRange('La presión', P, 1, 10000);
  return (R_GAS * T) / P; // J/mol ÷ kPa = L/mol
}

/** Volumen (L) que ocupan n moles de gas ideal a T (K) y P (kPa). */
export function gasVolumeL(moles: number, T: number = STP.T, P: number = STP.P): number {
  assertInRange('La cantidad de gas', moles, 0, 1000);
  return moles * molarVolumeL(T, P);
}

/** Cifras significativas de una lectura de balanza (los ceros a la izquierda no cuentan). */
export function readingSigFigs(value: number, resolution: number = BALANCE.resolution): number {
  if (!(value > 0)) return 1;
  const decimals = Math.max(0, Math.round(-Math.log10(resolution)));
  const units = Math.round(value * 10 ** decimals);
  return Math.max(1, String(units).length);
}

/* ------------------------------------------------------------------ pesada con navecilla y tara */

export type TareStatus = 'correcta' | 'sin tarar' | 'tarada con muestra' | 'sin navecilla';

export interface WeighingInput { substanceId: SubstanceId; portions: number; boatOnPan: boolean; /** Masa verdadera sobre el plato cuando se pulsó TARA (g). */ tare: number; }

export interface WeighingResult {
  substance: Substance;
  /** Masa verdadera de la muestra en la navecilla (g). */
  sampleMass: number;
  /** Masa verdadera sobre el plato (g). */
  gross: number;
  /** Indicación ideal de la balanza (g), sin cuantizar. */
  net: number;
  /** Indicación ideal cuantizada a 0,001 g. */
  reading: number;
  tareStatus: TareStatus;
}

/** Lo que indica la balanza: masa sobre el plato menos la tara, redondeada a 0,001 g. */
export function weigh(input: WeighingInput): WeighingResult {
  assertInRange('El número de porciones', input.portions, ...MOLE_LIMITS.portions);
  assertInRange('La tara', input.tare, 0, BALANCE.capacity);
  const substance = findSubstance(input.substanceId);
  const sampleMass = roundToResolution(Math.round(input.portions) * substance.portionMass, 1e-6);
  const gross = input.boatOnPan ? BOAT_MASS + sampleMass : 0;
  const net = gross - input.tare;
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const tareStatus: TareStatus = !input.boatOnPan ? 'sin navecilla'
    : eq(input.tare, BOAT_MASS) ? 'correcta'
      : input.tare < BOAT_MASS - 1e-9 ? 'sin tarar' : 'tarada con muestra';
  return { substance, sampleMass, gross, net, reading: roundToResolution(net, BALANCE.resolution), tareStatus };
}

/* ------------------------------------------------------------------ reacciones sobre la balanza */

export type MolReactionId = 'vinagre' | 'calor';

export interface MolReactionDef {
  id: MolReactionId;
  name: string;
  equation: string;
  reaction: Reaction;
  container: string;
}

/** Descomposición térmica del bicarbonato de sodio (≈ 100–200 °C). */
export const THERMAL_DECOMPOSITION: Reaction = {
  id: 'bicarbonato-calor', name: 'Descomposición térmica del bicarbonato de sodio',
  context: 'Al hornear, el bicarbonato libera CO₂ y vapor de agua que esponjan la masa.',
  reactants: [{ formula: 'NaHCO3', name: 'bicarbonato de sodio', coef: 2 }],
  products: [{ formula: 'Na2CO3', name: 'carbonato de sodio', coef: 1 }, { formula: 'H2O', name: 'agua', coef: 1 }, { formula: 'CO2', name: 'dióxido de carbono', coef: 1 }],
};

/** Bicarbonato + ácido acético: la misma ecuación de la práctica «estequiometria» (se reutiliza su catálogo). */
export const VINEGAR_REACTION: Reaction = findReaction('bicarbonato-vinagre');

export const MOL_REACTIONS: MolReactionDef[] = [
  { id: 'vinagre', name: 'Bicarbonato + vinagre (vaso abierto)', equation: 'NaHCO₃(s) + CH₃COOH(ac) → CH₃COONa(ac) + H₂O(l) + CO₂(g)', reaction: VINEGAR_REACTION, container: 'Vaso de 150 mL con vinagre y papel de pesar con el bicarbonato, todo sobre el plato' },
  { id: 'calor', name: 'Bicarbonato calentado (crisol)', equation: '2 NaHCO₃(s) → Na₂CO₃(s) + H₂O(g) + CO₂(g)', reaction: THERMAL_DECOMPOSITION, container: 'Crisol de porcelana con tapa' },
];

export function findMolReaction(id: MolReactionId): MolReactionDef {
  const r = MOL_REACTIONS.find((x) => x.id === id);
  if (!r) throw new RangeError(`Reacción desconocida: ${id}`);
  return r;
}

/** Densidad del vinagre (g/mL) y ácido acético por mL: los mismos de la práctica de conservación de la masa. */
export const VINEGAR_DENSITY = conservationReaction('bicarbonato').liquidDensity;
export const VINEGAR_ACID_PER_ML = VINEGAR_ACID;

export interface MolReactionInput { reaction: MolReactionId; solidMass: number; vinegarMl: number; }

export interface MolReactionResult {
  def: MolReactionDef;
  molesSolid: number;
  molesAcid: number;
  /** Reactivo limitante (solo con vinagre); null en la descomposición o con proporciones exactas. */
  limiting: string | null;
  /** Avance de la reacción ξ (mol). */
  extent: number;
  /** Masas consumidas de cada reactivo y formadas de cada producto (g), en el orden de la ecuación. */
  consumed: number[];
  produced: number[];
  /** Masa de reactivo sobrante (g) en el orden de los reactivos. */
  excess: number[];
  co2Mass: number;
  /** Vapor de agua que sale del crisol (g); 0 con vinagre (el agua queda en la solución). */
  vaporMass: number;
  /** Masa de gases que sale del recipiente abierto (g). */
  gasLost: number;
  massInitial: number;
  massFinal: number;
  /** Indicaciones ideales de la balanza (0,001 g). */
  readingInitial: number;
  readingFinal: number;
  /** Suma de masas de reactivos consumidos y de productos formados (conservación). */
  reactantsMass: number;
  productsMass: number;
  co2VolumeStpL: number;
  co2VolumeRoomL: number;
  /** Fracción de la masa del bicarbonato que se pierde al calentarlo (solo «calor»). */
  lossFraction: number;
}

export function runMolReaction(input: MolReactionInput): MolReactionResult {
  assertInRange('La masa de bicarbonato', input.solidMass, ...MOLE_LIMITS.solid);
  const def = findMolReaction(input.reaction);
  const mNa = molarMass('NaHCO3');
  const co2M = molarMass('CO2');
  if (input.reaction === 'vinagre') {
    assertInRange('El volumen de vinagre', input.vinegarMl, ...MOLE_LIMITS.vinegar);
    const acid = input.vinegarMl * VINEGAR_ACID_PER_ML;
    const s = simulateStoichiometry({ reactionId: 'bicarbonato-vinagre', massA: input.solidMass, massB: acid, yieldPercent: 100 });
    const co2Mass = s.theoreticalProducts[2];
    const massInitial = BEAKER_MASS + PAPER_MASS + input.vinegarMl * VINEGAR_DENSITY + input.solidMass;
    const massFinal = massInitial - co2Mass;
    const nCO2 = co2Mass / co2M;
    return {
      def, molesSolid: s.molesA, molesAcid: s.molesB,
      limiting: s.limiting === null ? null : s.reaction.reactants[s.limiting].name,
      extent: s.extent, consumed: s.consumed, produced: s.theoreticalProducts, excess: s.excess,
      co2Mass, vaporMass: 0, gasLost: co2Mass, massInitial, massFinal,
      readingInitial: roundToResolution(massInitial, BALANCE.resolution), readingFinal: roundToResolution(massFinal, BALANCE.resolution),
      reactantsMass: s.consumed.reduce((a, b) => a + b, 0), productsMass: s.theoreticalProducts.reduce((a, b) => a + b, 0),
      co2VolumeStpL: gasVolumeL(nCO2, STP.T, STP.P), co2VolumeRoomL: gasVolumeL(nCO2, ROOM.T, ROOM.P), lossFraction: co2Mass / input.solidMass,
    };
  }
  // Descomposición térmica completa (calentamiento hasta masa constante).
  const r = THERMAL_DECOMPOSITION;
  const molesSolid = input.solidMass / mNa;
  const extent = molesSolid / r.reactants[0].coef;
  const produced = r.products.map((p) => extent * p.coef * molarMass(p.formula));
  const [na2co3, vaporMass, co2Mass] = produced;
  const massInitial = CRUCIBLE_MASS + input.solidMass;
  const massFinal = CRUCIBLE_MASS + na2co3;
  const nCO2 = co2Mass / co2M;
  return {
    def, molesSolid, molesAcid: 0, limiting: null, extent, consumed: [input.solidMass], produced, excess: [0],
    co2Mass, vaporMass, gasLost: vaporMass + co2Mass, massInitial, massFinal,
    readingInitial: roundToResolution(massInitial, BALANCE.resolution), readingFinal: roundToResolution(massFinal, BALANCE.resolution),
    reactantsMass: input.solidMass, productsMass: produced.reduce((a, b) => a + b, 0),
    co2VolumeStpL: gasVolumeL(nCO2, STP.T, STP.P), co2VolumeRoomL: gasVolumeL(nCO2, ROOM.T, ROOM.P),
    lossFraction: (vaporMass + co2Mass) / input.solidMass,
  };
}

/** Indicación de la balanza durante la reacción (fracción f del gas ya salió). La evolución temporal es ilustrativa. */
export function readingDuring(res: MolReactionResult, f: number): number {
  const q = Math.max(0, Math.min(1, f));
  return roundToResolution(res.massInitial - q * res.gasLost, BALANCE.resolution);
}

/** Las dos ecuaciones de la práctica están balanceadas (átomos iguales a los dos lados). */
export function reactionsBalanced(): boolean {
  return MOL_REACTIONS.every(({ reaction: r }) => checkBalance(r, r.reactants.map((s) => s.coef), r.products.map((s) => s.coef)).balanced);
}

/* ------------------------------------------------------------------ instrumentos */

export const MOLE_INSTRUMENTS = [
  { id: 'balanza', name: 'Balanza de precisión (220 g × 0,001 g) con cámara antiviento', quantity: 'Masa', unit: 'g', resolution: BALANCE.resolution, sigma: 0.0015, note: 'Corrientes de aire, vibraciones de la mesa, electricidad estática de la navecilla de plástico y objetos aún tibios.' },
];

/* ------------------------------------------------------------------ ficha del modelo */

export const moleModelSpec: ModelSpec = {
  name: 'El mol: masa molar a partir de la fórmula, n = m/M, N = n·N_A y estequiometría masa–masa con conservación de la masa',
  inputs: [
    { symbol: 'sustancia', name: 'Sustancia de la muestra (NaCl, C₁₂H₂₂O₁₁, H₂O, CaCO₃, NaHCO₃, Fe, Cu, Al)', unit: '—', initial: 'NaCl' },
    { symbol: 'porciones', name: 'Porciones de muestra en la navecilla', unit: '—', range: MOLE_LIMITS.portions, initial: 0 },
    { symbol: 'tara', name: 'Masa sobre el plato al pulsar TARA', unit: 'g', range: [0, BALANCE.capacity], initial: 0 },
    { symbol: 'm(NaHCO₃)', name: 'Masa de bicarbonato que reacciona', unit: 'g', range: MOLE_LIMITS.solid, initial: 2 },
    { symbol: 'V_vinagre', name: 'Volumen de vinagre (5 % m/v de ácido acético)', unit: 'mL', range: MOLE_LIMITS.vinegar, initial: 50 },
  ],
  outputs: [
    { symbol: 'M', name: 'Masa molar', unit: 'g/mol' },
    { symbol: 'n', name: 'Cantidad de sustancia', unit: 'mol' },
    { symbol: 'N', name: 'Número de entidades (unidades fórmula, moléculas o átomos)', unit: '—' },
    { symbol: 'N_E', name: 'Átomos de cada elemento', unit: '—' },
    { symbol: 'Δm', name: 'Masa perdida en la balanza (gases que escapan)', unit: 'g' },
    { symbol: 'V(CO₂)', name: 'Volumen del CO₂ como gas ideal', unit: 'L' },
  ],
  equations: [
    'M = Σ nᵢ·Arᵢ (masas atómicas estándar abreviadas, IUPAC/CIAAW)',
    'n = m / M',
    'N = n·N_A, con N_A = 6,022 140 76 × 10²³ mol⁻¹ (exacto desde 2019)',
    'N_E = N·(subíndice de E en la fórmula)',
    'Masa de una entidad: m₁ = M / N_A',
    'Lectura de la balanza = masa sobre el plato − tara, redondeada a 0,001 g',
    'Avance ξ = mín(n_A/ν_A, n_B/ν_B); m_producto = ξ·ν·M',
    'Conservación: Σ m(reactivos consumidos) = Σ m(productos); m_antes − m_después = m(gases que salen)',
    'Gas ideal: V = n·R·T/P (22,414 L/mol a 273,15 K y 101,325 kPa; 24,465 L/mol a 298,15 K)',
  ],
  initialConditions: [
    'Contar pesando: sal de cocina, navecilla en la mesa, balanza en cero, sin muestra.',
    'Reacción: 2,00 g de bicarbonato y 50 mL de vinagre al 5 % m/v (2,5 g de ácido acético) en un vaso abierto.',
  ],
  assumptions: [
    'Las sustancias son puras (la sal, el azúcar, el bicarbonato y los metales del hogar lo son casi por completo).',
    'Masas de las porciones: ilustrativas para los polvos y la tiza; calculadas con la geometría y la densidad para el alambre de cobre y el papel aluminio.',
    'Con vinagre, todo el CO₂ formado sale del vaso y el agua formada queda en la solución.',
    'En el crisol se calienta hasta masa constante: la descomposición es completa y se pesa el crisol ya frío.',
    'El CO₂ se comporta como gas ideal.',
    'En modo «Instrumento real» la balanza suma un error aleatorio típico (σ ≈ 0,0015 g); en modo ideal solo redondea a 0,001 g.',
  ],
  limits: [
    'Parte del CO₂ queda disuelto en el vinagre: en un experimento real es probable medir una pérdida algo menor que la calculada.',
    'Un crisol caliente se pesa de menos por las corrientes de aire que sube; el modelo supone que se enfría antes de pesar.',
    'No se modela la velocidad de las reacciones: la animación del burbujeo y del calentamiento es ilustrativa.',
    'Las masas atómicas abreviadas limitan la precisión de M (por ejemplo, NaCl con dos decimales por el cloro, 35,45).',
  ],
  testCases: [
    'Masas molares calculadas a mano: NaCl 58,44 g/mol; H₂O 18,015 g/mol; C₁₂H₂₂O₁₁ 342,30 g/mol (tolerancia ± 0,005 g/mol).',
    'N_A·(1 mol) = 6,02214076 × 10²³ entidades; los átomos de cada elemento son N × subíndice.',
    '1 mol de gas ideal a 273,15 K y 101,325 kPa ocupa 22,414 L (± 0,001 L).',
    'Conservación de la masa: Σ reactivos consumidos = Σ productos, y m_antes − m_después = gas que sale, en las dos reacciones.',
    'Bicarbonato calentado: pierde el 36,92 % de su masa (H₂O + CO₂).',
    'La tara: sin tarar, la lectura incluye la navecilla (1,274 g).',
    'Las entradas fuera de rango se rechazan con un mensaje en español.',
  ],
};

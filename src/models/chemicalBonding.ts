import { periodicElement, PERIODIC_SOURCE } from './periodicTrends';
import { isMetalCategory } from './periodicTable';
import type { ModelSpec } from './types';

/**
 * Enlace químico (grado 9.º): tipo de enlace por la diferencia de electronegatividad, estructuras de Lewis, polaridad de
 * las moléculas y propiedades de sustancias reales.
 *
 *  - Electronegatividades de Pauling: tabla de PubChem (src/data/quimica/tabla-periodica-pubchem.json).
 *  - Criterio orientativo (convención de los textos escolares, NO una frontera física): entre no metales, ΔEN < 0,4 →
 *    covalente no polar y ΔEN ≥ 0,4 → covalente polar; metal con no metal y ΔEN > 1,7 → iónico (si no, covalente polar);
 *    metal con metal → metálico. Así el HF (ΔEN = 1,78, dos no metales) queda covalente polar, como es.
 *  - Carácter iónico de Pauling (1960): % = 100·(1 − e^(−ΔEN²/4)).
 *  - Estructuras de Lewis: electrones de valencia de los grupos principales (grupo 1–2 → 1–2; grupo 13–18 → 3–8; H → 1)
 *    y regla del octeto (dueto para el H). El modelo comprueba que los electrones dibujados suman los de valencia.
 *  - Polaridad de la molécula: suma vectorial de los dipolos de enlace, cada uno dirigido hacia el átomo más electronegativo
 *    con módulo proporcional a ΔEN, sobre la geometría 3D de PubChem (o VSEPR del kit). Es una estimación cualitativa
 *    (ignora los pares libres y la polarizabilidad), suficiente para decidir si la molécula es polar o no polar.
 *
 * Este archivo no depende de React ni del navegador.
 */

export type BondType = 'covalente no polar' | 'covalente polar' | 'iónico' | 'metálico';

export const EN_THRESHOLDS = { nonPolar: 0.4, ionic: 1.7 };

export function electronegativity(sym: string): number {
  const v = periodicElement(sym).en;
  if (v === null) throw new RangeError(`PubChem no tiene electronegatividad de Pauling para ${sym}.`);
  return v;
}
export const isMetal = (sym: string) => isMetalCategory(periodicElement(sym).category);

/** Carácter iónico de Pauling (%). */
export const ionicCharacter = (dEN: number) => 100 * (1 - Math.exp(-(dEN * dEN) / 4));

export interface BondClassification { a: string; b: string; enA: number; enB: number; dEN: number; type: BondType; ionicPct: number; negative: string | null; note: string }

export function classifyBond(a: string, b: string): BondClassification {
  const enA = electronegativity(a), enB = electronegativity(b);
  const dEN = Math.round(Math.abs(enA - enB) * 100) / 100;
  const ma = isMetal(a), mb = isMetal(b);
  let type: BondType;
  let note = '';
  if (ma && mb) { type = 'metálico'; note = 'Dos metales: los átomos ceden sus electrones de valencia a un «mar» de electrones compartido por todos.'; }
  else if (!ma && !mb) {
    type = dEN < EN_THRESHOLDS.nonPolar ? 'covalente no polar' : 'covalente polar';
    note = dEN > EN_THRESHOLDS.ionic ? 'Aunque ΔEN pasa de 1,7, los dos son no metales y comparten electrones: el enlace es covalente muy polar (como en el HF).' : 'Dos no metales comparten pares de electrones.';
  } else if (dEN > EN_THRESHOLDS.ionic) { type = 'iónico'; note = 'El metal cede electrones al no metal: se forman iones de carga opuesta que se atraen.'; }
  else { type = 'covalente polar'; note = 'Metal y no metal con ΔEN ≤ 1,7: el enlace tiene bastante carácter covalente (por ejemplo, en el AlCl₃).'; }
  const negative = enA === enB ? null : enA > enB ? a : b;
  return { a, b, enA, enB, dEN, type, ionicPct: ionicCharacter(dEN), negative, note };
}

/* ------------------------------------------------------------------ Lewis */

/** Electrones de valencia de un elemento de los grupos principales. */
export function valenceElectrons(sym: string): number {
  const e = periodicElement(sym);
  if (e.group === null || (e.group > 2 && e.group < 13)) throw new RangeError(`${sym} no es de los grupos principales.`);
  if (e.z === 2) return 2;
  return e.group <= 2 ? e.group : e.group - 10;
}

export interface LewisAtom { el: string; x: number; y: number; lone: number }
export interface LewisMolecule {
  id: string; formula: string; name: string;
  /** Id de la especie 3D del kit de química (src/chem/molecules.ts). */
  speciesId: string;
  atoms: LewisAtom[];
  bonds: { a: number; b: number; order: 1 | 2 | 3 }[];
  geometry: string;
}

/** Siete moléculas sencillas (coordenadas 2D de dibujo; la geometría real es la 3D de PubChem). */
export const LEWIS: LewisMolecule[] = [
  { id: 'h2', formula: 'H₂', name: 'Hidrógeno', speciesId: 'hidrogeno', geometry: 'lineal', atoms: [{ el: 'H', x: -0.5, y: 0, lone: 0 }, { el: 'H', x: 0.5, y: 0, lone: 0 }], bonds: [{ a: 0, b: 1, order: 1 }] },
  { id: 'cl2', formula: 'Cl₂', name: 'Cloro', speciesId: 'cloro', geometry: 'lineal', atoms: [{ el: 'Cl', x: -0.6, y: 0, lone: 3 }, { el: 'Cl', x: 0.6, y: 0, lone: 3 }], bonds: [{ a: 0, b: 1, order: 1 }] },
  { id: 'hcl', formula: 'HCl', name: 'Cloruro de hidrógeno', speciesId: 'hcl', geometry: 'lineal', atoms: [{ el: 'H', x: -0.6, y: 0, lone: 0 }, { el: 'Cl', x: 0.6, y: 0, lone: 3 }], bonds: [{ a: 0, b: 1, order: 1 }] },
  { id: 'h2o', formula: 'H₂O', name: 'Agua', speciesId: 'agua', geometry: 'angular (≈ 104,5°)', atoms: [{ el: 'O', x: 0, y: 0.3, lone: 2 }, { el: 'H', x: -0.8, y: -0.4, lone: 0 }, { el: 'H', x: 0.8, y: -0.4, lone: 0 }], bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }] },
  { id: 'co2', formula: 'CO₂', name: 'Dióxido de carbono', speciesId: 'co2', geometry: 'lineal', atoms: [{ el: 'C', x: 0, y: 0, lone: 0 }, { el: 'O', x: -1.1, y: 0, lone: 2 }, { el: 'O', x: 1.1, y: 0, lone: 2 }], bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }] },
  { id: 'nh3', formula: 'NH₃', name: 'Amoníaco', speciesId: 'amoniaco', geometry: 'pirámide trigonal (≈ 107°)', atoms: [{ el: 'N', x: 0, y: 0.35, lone: 1 }, { el: 'H', x: -0.9, y: -0.35, lone: 0 }, { el: 'H', x: 0, y: -0.75, lone: 0 }, { el: 'H', x: 0.9, y: -0.35, lone: 0 }], bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }] },
  { id: 'ch4', formula: 'CH₄', name: 'Metano', speciesId: 'metano', geometry: 'tetraédrica (109,5°)', atoms: [{ el: 'C', x: 0, y: 0, lone: 0 }, { el: 'H', x: 0, y: 0.9, lone: 0 }, { el: 'H', x: -0.9, y: 0, lone: 0 }, { el: 'H', x: 0.9, y: 0, lone: 0 }, { el: 'H', x: 0, y: -0.9, lone: 0 }], bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 }] },
];
export const lewisById = (id: string): LewisMolecule => {
  const m = LEWIS.find((x) => x.id === id);
  if (!m) throw new RangeError(`Molécula desconocida: ${id}`);
  return m;
};

export interface LewisCheck {
  valenceTotal: number; drawn: number; bondingPairs: number; lonePairs: number;
  /** Electrones alrededor de cada átomo (pares de enlace × 2 + pares libres × 2). */
  shells: { el: string; electrons: number; full: boolean }[];
  ok: boolean;
}
export function checkLewis(m: LewisMolecule): LewisCheck {
  const valenceTotal = m.atoms.reduce((s, a) => s + valenceElectrons(a.el), 0);
  const bondingPairs = m.bonds.reduce((s, b) => s + b.order, 0);
  const lonePairs = m.atoms.reduce((s, a) => s + a.lone, 0);
  const drawn = 2 * bondingPairs + 2 * lonePairs;
  const shells = m.atoms.map((a, i) => {
    const bonded = m.bonds.filter((b) => b.a === i || b.b === i).reduce((s, b) => s + b.order, 0);
    const electrons = 2 * bonded + 2 * a.lone;
    return { el: a.el, electrons, full: electrons === (a.el === 'H' ? 2 : 8) };
  });
  return { valenceTotal, drawn, bondingPairs, lonePairs, shells, ok: drawn === valenceTotal && shells.every((s) => s.full) };
}

/* ------------------------------------------------------------------ polaridad 3D */

type V3 = [number, number, number];
export interface PolarityAtom { el: string; x: number; y: number; z: number }
export interface PolarityResult {
  /** Dipolo de cada enlace: desde el átomo menos electronegativo hacia el más electronegativo, módulo = ΔEN (u. a.). */
  bondDipoles: { a: number; b: number; from: V3; vector: V3; dEN: number }[];
  net: V3; netMagnitude: number; polar: boolean;
  /** Carga parcial cualitativa de cada átomo: suma de ±ΔEN/2 de sus enlaces (negativa = δ−). */
  partial: number[];
}

/**
 * Polaridad de una molécula a partir de su geometría 3D: suma vectorial de los dipolos de enlace (∝ ΔEN). Es polar si
 * el dipolo neto supera el 5 % de la suma de los módulos (tolerancia para geometrías calculadas, no idealmente simétricas).
 */
export function moleculePolarity(atoms: PolarityAtom[], bonds: { a: number; b: number }[]): PolarityResult {
  const partial = atoms.map(() => 0);
  const bondDipoles = bonds.map(({ a, b }) => {
    const ea = electronegativity(atoms[a].el), eb = electronegativity(atoms[b].el);
    const [lo, hi] = ea <= eb ? [a, b] : [b, a];
    const dEN = Math.abs(ea - eb);
    const dir: V3 = [atoms[hi].x - atoms[lo].x, atoms[hi].y - atoms[lo].y, atoms[hi].z - atoms[lo].z];
    const L = Math.hypot(...dir) || 1;
    partial[hi] -= dEN / 2;
    partial[lo] += dEN / 2;
    return { a, b, from: [atoms[lo].x, atoms[lo].y, atoms[lo].z] as V3, vector: dir.map((c) => (c / L) * dEN) as V3, dEN };
  });
  const net = bondDipoles.reduce<V3>((s, d) => [s[0] + d.vector[0], s[1] + d.vector[1], s[2] + d.vector[2]], [0, 0, 0]);
  const netMagnitude = Math.hypot(...net);
  const total = bondDipoles.reduce((s, d) => s + d.dEN, 0);
  return { bondDipoles, net, netMagnitude, polar: total > 0 && netMagnitude > 0.05 * total, partial };
}

/* ------------------------------------------------------------------ sustancias reales */

export type TestId = 'calentar' | 'agua' | 'conduceSolido' | 'conduceAgua';
export interface Substance {
  id: string; name: string; formula: string; bond: BondType | 'covalente (red)' | 'covalente (moléculas)';
  structure: 'red iónica' | 'red covalente' | 'moléculas' | 'red metálica';
  /** Punto de fusión (°C) y el texto de PubChem del que sale, con su fuente. */
  meltingC: number; meltingText: string; meltingSource: string; decomposes?: boolean;
  /** Solubilidad en agua a 25 °C (g por 100 g de agua; 0 si es insoluble) y su texto/fuente. */
  solubility: number; solubilityText: string; solubilitySource: string;
  conductsSolid: boolean; conductsInWater: boolean | null;
  /** Mayor ΔEN entre átomos enlazados de la sustancia (orientativo). */
  dEN: number;
  cid: number;
  note: string;
}

/**
 * Las cinco sustancias de la estación de propiedades. Puntos de fusión y solubilidades: textos de PubChem (PUG View)
 * guardados en src/data/quimica/tabla-periodica-pubchem.json con su fuente (la prueba comprueba que cada texto está allí).
 * La conductividad es el resultado esperado según la bibliografía (no se mide aquí).
 */
export const SUBSTANCES: Substance[] = [
  { id: 'nacl', name: 'Sal de cocina', formula: 'NaCl', bond: 'iónico', structure: 'red iónica', meltingC: 800.7, meltingText: '800.7 °C', meltingSource: 'CRC Handbook of Chemistry and Physics, 94.ª ed. (vía HSDB en PubChem, CID 5234)',
    solubility: 36.0, solubilityText: '36.0 g/100 g of water at 25 °C', solubilitySource: 'CRC Handbook, 94.ª ed. (vía HSDB)', conductsSolid: false, conductsInWater: true, dEN: 2.23, cid: 5234,
    note: 'Los iones Na⁺ y Cl⁻ están fijos en la red: el sólido no conduce. Disuelta o fundida, los iones se mueven y conduce.' },
  { id: 'sacarosa', name: 'Azúcar de mesa (sacarosa)', formula: 'C₁₂H₂₂O₁₁', bond: 'covalente (moléculas)', structure: 'moléculas', meltingC: 185.5, meltingText: '185.5 °C', meltingSource: 'CRC Handbook, 79.ª ed. (vía HSDB en PubChem, CID 5988); se descompone (carameliza)', decomposes: true,
    solubility: 200, solubilityText: 'Solubility in water, g/100ml at 25 °C: 200', solubilitySource: 'Fichas internacionales de seguridad química ICSC (OIT-OMS), vía PubChem', conductsSolid: false, conductsInWater: false, dEN: 1.24, cid: 5988,
    note: 'Se disuelve porque sus grupos O–H forman puentes de hidrógeno con el agua, pero las moléculas no se rompen en iones: la disolución no conduce.' },
  { id: 'cobre', name: 'Cobre', formula: 'Cu', bond: 'metálico', structure: 'red metálica', meltingC: 1084.62, meltingText: '1084.62 °C', meltingSource: 'PAC Chemical Database, Departamento de Energía de EE. UU. (vía PubChem, CID 23978)',
    solubility: 0, solubilityText: 'Solubility in water: none', solubilitySource: 'ICSC (OIT-OMS), vía PubChem', conductsSolid: true, conductsInWater: null, dEN: 0, cid: 23978,
    note: 'Los electrones de valencia se mueven libremente por toda la red («mar de electrones»): conduce en estado sólido.' },
  { id: 'cuarzo', name: 'Arena de cuarzo (dióxido de silicio)', formula: 'SiO₂', bond: 'covalente (red)', structure: 'red covalente', meltingC: 1713, meltingText: '1713 °C', meltingSource: 'ICSC (OIT-OMS), vía PubChem (CID 24261)',
    solubility: 0, solubilityText: 'Solubility in water: none', solubilitySource: 'ICSC (OIT-OMS), vía PubChem', conductsSolid: false, conductsInWater: null, dEN: 1.54, cid: 24261,
    note: 'Cada Si se une a 4 O y cada O a 2 Si con enlaces covalentes en una red gigante: para fundirlo hay que romper muchos enlaces fuertes.' },
  { id: 'parafina', name: 'Parafina (modelo: n-eicosano)', formula: 'C₂₀H₄₂', bond: 'covalente (moléculas)', structure: 'moléculas', meltingC: 36.48, meltingText: '36.48 °C', meltingSource: 'CRC Handbook, 95.ª ed. (vía HSDB en PubChem, CID 8222); la parafina comercial es una mezcla de alcanos y funde en un intervalo',
    solubility: 0, solubilityText: 'Solubility in water: none', solubilitySource: 'HSDB en PubChem: 1,9 × 10⁻³ mg/L a 25 °C (Mackay y Shiu); se toma como insoluble', conductsSolid: false, conductsInWater: null, dEN: 0.35, cid: 8222,
    note: 'Moléculas no polares unidas por fuerzas débiles de London: funde con poco calor y no se mezcla con el agua (polar).' },
];
export const substanceById = (id: string): Substance => {
  const s = SUBSTANCES.find((x) => x.id === id);
  if (!s) throw new RangeError(`Sustancia desconocida: ${id}`);
  return s;
};

/** Temperatura máxima de la placa calefactora del laboratorio escolar (°C). */
export const HOT_PLATE_MAX_C = 300;

export interface TestResult { test: TestId; positive: boolean | null; text: string }
export function runTest(s: Substance, test: TestId): TestResult {
  switch (test) {
    case 'calentar': {
      const melts = s.meltingC <= HOT_PLATE_MAX_C;
      return { test, positive: melts, text: melts ? (s.decomposes ? `Funde cerca de ${fmtC(s.meltingC)} y se oscurece (se descompone: carameliza).` : `Funde a ${fmtC(s.meltingC)}.`) : `No funde en la placa (hasta ${HOT_PLATE_MAX_C} °C); su punto de fusión es ${fmtC(s.meltingC)}.` };
    }
    case 'agua': {
      const dissolves = s.solubility > 1;
      return { test, positive: dissolves, text: dissolves ? `1 g se disuelve en 10 mL de agua (solubilidad ${fmtNum(s.solubility)} g por 100 g de agua a 25 °C).` : 'No se disuelve: queda en el fondo o flota.' };
    }
    case 'conduceSolido':
      return { test, positive: s.conductsSolid, text: s.conductsSolid ? 'El LED del conductímetro se enciende: el sólido conduce.' : 'El LED no se enciende: el sólido no conduce.' };
    case 'conduceAgua':
      if (s.conductsInWater === null) return { test, positive: null, text: 'No se disuelve: el agua destilada sola no conduce (la prueba no aplica).' };
      return { test, positive: s.conductsInWater, text: s.conductsInWater ? 'El LED se enciende: la disolución conduce (hay iones que se mueven).' : 'El LED no se enciende: la disolución no conduce (moléculas sin carga).' };
  }
}
const fmtNum = (v: number) => String(v).replace('.', ',');
const fmtC = (v: number) => `${fmtNum(v)} °C`;

/** Clasificación esperada a partir de las cuatro pruebas (lo que el estudiante debe concluir). */
export function inferStructure(results: Record<TestId, boolean | null>): Substance['structure'] | 'indeterminado' {
  if (results.conduceSolido) return 'red metálica';
  if (results.conduceAgua) return 'red iónica';
  if (results.calentar) return 'moléculas';
  if (results.agua) return 'moléculas';
  if (results.calentar === false && results.agua === false) return 'red covalente';
  return 'indeterminado';
}

export const chemicalBondingSpec: ModelSpec = {
  name: 'Tipo de enlace por diferencia de electronegatividad, estructuras de Lewis, polaridad y propiedades',
  inputs: [
    { symbol: 'A, B', name: 'Elementos que se enlazan', unit: '—', initial: 'Na y Cl' },
    { symbol: 'molécula', name: 'H₂, Cl₂, HCl, H₂O, CO₂, NH₃ o CH₄', unit: '—', initial: 'H₂O' },
    { symbol: 'sustancia', name: 'NaCl, sacarosa, cobre, cuarzo o parafina', unit: '—', initial: 'NaCl' },
  ],
  outputs: [
    { symbol: 'ΔEN', name: 'Diferencia de electronegatividad (Pauling)', unit: '—' },
    { symbol: '%I', name: 'Carácter iónico de Pauling', unit: '%' },
    { symbol: 'μ', name: 'Dipolo neto estimado (suma de dipolos de enlace ∝ ΔEN)', unit: 'u. a.' },
    { symbol: 'Tf', name: 'Punto de fusión (PubChem)', unit: '°C' },
  ],
  equations: [
    'ΔEN = |χ_A − χ_B|',
    'No metal–no metal: ΔEN < 0,4 → covalente no polar; ΔEN ≥ 0,4 → covalente polar. Metal–no metal: ΔEN > 1,7 → iónico. Metal–metal → metálico',
    '% carácter iónico = 100·(1 − e^(−ΔEN²/4))   (Pauling)',
    'Electrones de la estructura de Lewis: 2·(pares de enlace) + 2·(pares libres) = Σ electrones de valencia',
    'μ⃗ ≈ Σ ΔEN·û(menos → más electronegativo)',
  ],
  initialConditions: [
    `Electronegatividades de la tabla de PubChem (consulta ${PERIODIC_SOURCE.fecha}).`,
    'Geometrías 3D: confórmeros de PubChem (MMFF94s) y, para el H₂, geometría del kit con radios de Pyykkö.',
    'Prueba de fusión en una placa calefactora de hasta 300 °C; prueba de solubilidad con 1 g en 10 mL de agua; conductímetro con LED.',
  ],
  assumptions: [
    'Los límites 0,4 y 1,7 son una convención de manual para orientar, no una frontera exacta: el carácter iónico cambia de forma continua.',
    'El dipolo neto se estima solo con los dipolos de enlace; ignora los pares libres (que en el H₂O y el NH₃ lo aumentan) y no da valores en debyes.',
    'Las propiedades de las sustancias son datos publicados (PubChem); los resultados de las pruebas (LED, disolución) son la ilustración del resultado esperado.',
  ],
  limits: [
    'No incluye enlaces con metales de transición en complejos ni la resonancia (por ejemplo, el ion carbonato).',
    'La parafina comercial es una mezcla; se usa el n-eicosano como sustancia modelo.',
    'El cuarzo no funde de forma simple: cambia de fase antes de fundir; se usa el valor de la ficha ICSC.',
  ],
  testCases: [
    'ΔEN(Na–Cl) = 2,23 → iónico (71 % de carácter iónico); ΔEN(H–Cl) = 0,96 → covalente polar; ΔEN(H–H) = 0 → no polar; H–F (1,78) sigue siendo covalente polar.',
    'Lewis: H₂O 8 electrones (2 pares de enlace y 2 libres), CO₂ 16 (4 de enlace y 4 libres), NH₃ 8, CH₄ 8: todos cumplen el octeto (dueto en H).',
    'Polaridad sobre la geometría de PubChem: H₂O, NH₃ y HCl polares; CO₂, CH₄, H₂ y Cl₂ no polares.',
    'Propiedades: NaCl funde a 800,7 °C y su disolución conduce; la parafina funde a 36,48 °C; solo el cobre conduce en estado sólido.',
  ],
};

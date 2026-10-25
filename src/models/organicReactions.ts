/**
 * REACCIONES ORGÁNICAS (práctica «reacciones-organicas», 11.º). Funciones puras y deterministas.
 *
 *  - Biblioteca de reacciones con especies reales (confórmeros de PubChem o especies del kit) y COEFICIENTES CALCULADOS con el
 *    método algebraico de src/models/balancing.ts (espacio nulo de la matriz de composición): no se escriben a mano.
 *  - Estequiometría con masas molares (masas atómicas estándar abreviadas CIAAW/IUPAC de balancing.ts).
 *  - Entalpía de reacción por la ley de Hess a partir de ENTALPÍAS DE COMBUSTIÓN experimentales citadas (PubChem/HSDB, que citan
 *    el CRC Handbook, Riddick et al. o Ullmann): ΔrH° = Σ ν·ΔcH°(reactivos) − Σ ν·ΔcH°(productos), con ΔcH° = 0 para O₂, CO₂, H₂O(l)
 *    y N₂ (productos de la combustión). Si falta un dato, el resultado es «Sin información disponible» (no se estima).
 *  - Equilibrio de la esterificación de Fischer: K = [éster][agua] / ([ácido][alcohol]) con K ≈ 4 (Berthelot y Péan de
 *    Saint-Gilles, 1862: con cantidades equimolares de ácido acético y etanol se alcanza ≈ 2/3 de conversión).
 *  - Reglas: Markovnikov (adición de HX y de agua a alquenos) y oxidación de alcoholes según su clase, aplicadas sobre el grafo y
 *    nombradas con el motor de nomenclatura del laboratorio.
 */
import { molarMass, solveBalance, type ReactionDef } from './balancing';
import { bondBetween, hillFormula, implicitH, neighbors, parseSmiles, type OMolecule } from './organicGraph';
import { detectGroups } from './functionalGroups';
import { nameFunctional } from './functionalNomenclature';
import { getFunc, type FProp } from '../data/quimica/funcionales';

/* ------------------------------------------------------------------ especies */

export type SpeciesSource = { kind: 'func'; id: string } | { kind: 'kit'; id: string } | { kind: 'atomo'; el: string };

export interface RxSpecies {
  /** Fórmula para el balanceo (ASCII, como la escribe balancing.ts). */
  formula: string;
  name: string;
  source: SpeciesSource;
  /** id de la biblioteca de funciones con el dato de ΔcH° (si existe). */
  dataId?: string;
  /** Producto de combustión completa: ΔcH° = 0 por definición. */
  combustionProduct?: boolean;
}

const f = (id: string, formula: string, name: string): RxSpecies => ({ formula, name, source: { kind: 'func', id }, dataId: id });
const k = (id: string, formula: string, name: string, extra: Partial<RxSpecies> = {}): RxSpecies => ({ formula, name, source: { kind: 'kit', id }, ...extra });

export const SP = {
  O2: k('oxigeno', 'O2', 'oxígeno', { combustionProduct: true }),
  CO2: k('co2', 'CO2', 'dióxido de carbono', { combustionProduct: true }),
  H2O: k('agua', 'H2O', 'agua', { combustionProduct: true }),
  CO: k('co', 'CO', 'monóxido de carbono', { dataId: 'monoxido-de-carbono' }),
  H2: k('hidrogeno', 'H2', 'hidrógeno', { dataId: 'hidrogeno' }),
  Cl2: k('cloro', 'Cl2', 'cloro'),
  HCl: k('hcl', 'HCl', 'cloruro de hidrógeno'),
  HBr: k('hbr', 'HBr', 'bromuro de hidrógeno'),
  HNO3: k('hno3', 'HNO3', 'ácido nítrico'),
  NH3: k('amoniaco', 'NH3', 'amoníaco', { dataId: 'amoniaco' }),
  C: { formula: 'C', name: 'carbono (hollín)', source: { kind: 'atomo', el: 'C' } } as RxSpecies,
  Br2: f('bromo', 'Br2', 'bromo'),
  metano: f('metano', 'CH4', 'metano'), metanol: f('metanol', 'CH4O', 'metanol'), etanol: f('etanol', 'C2H6O', 'etanol'),
  eteno: f('eteno', 'C2H4', 'eteno'), etano: f('etano', 'C2H6', 'etano'), propeno: f('propeno', 'C3H6', 'propeno'),
  clorometano: f('clorometano', 'CH3Cl', 'clorometano'), dibromoetano: f('1,2-dibromoetano', 'C2H4Br2', '1,2-dibromoetano'),
  bromopropano2: f('2-bromopropano', 'C3H7Br', '2-bromopropano'), bromopropano1: f('1-bromopropano', 'C3H7Br', '1-bromopropano'),
  propan2ol: f('propan-2-ol', 'C3H8O', 'propan-2-ol'), propan1ol: f('propan-1-ol', 'C3H8O', 'propan-1-ol'), metilpropan2ol: f('2-metilpropan-2-ol', 'C4H10O', '2-metilpropan-2-ol'),
  metanal: f('metanal', 'CH2O', 'metanal'), etanal: f('etanal', 'C2H4O', 'etanal'), propanal: f('propanal', 'C3H6O', 'propanal'), propanona: f('propanona', 'C3H6O', 'propanona'),
  acFormico: f('acido-metanoico', 'CH2O2', 'ácido metanoico'), acAcetico: f('acido-etanoico', 'C2H4O2', 'ácido etanoico'),
  acetatoEtilo: f('acetato-de-etilo', 'C4H8O2', 'acetato de etilo'), acetamida: f('acetamida', 'C2H5NO', 'acetamida'),
  glicina: f('glicina', 'C2H5NO2', 'glicina'), glicilglicina: f('glicilglicina', 'C4H8N2O3', 'glicilglicina'),
  benceno: f('benceno', 'C6H6', 'benceno'), nitrobenceno: f('nitrobenceno', 'C6H5NO2', 'nitrobenceno'), glucosa: f('glucosa', 'C6H12O6', 'glucosa'),
  ciclohexeno: f('ciclohexeno', 'C6H10', 'ciclohexeno'), ciclohexano: f('ciclohexano', 'C6H12', 'ciclohexano'),
} satisfies Record<string, RxSpecies>;

/* ------------------------------------------------------------------ biblioteca */

export type RxType = 'combustion' | 'sustitucion' | 'adicion' | 'oxidacion' | 'condensacion' | 'hidrolisis' | 'sustitucion-aromatica' | 'fermentacion';
export const RX_TYPE_LABEL: Record<RxType, string> = {
  combustion: 'Combustión (oxidación total)', sustitucion: 'Sustitución por radicales libres', adicion: 'Adición al doble enlace', oxidacion: 'Oxidación',
  condensacion: 'Condensación (se elimina agua)', hidrolisis: 'Hidrólisis', 'sustitucion-aromatica': 'Sustitución electrofílica aromática', fermentacion: 'Fermentación (vía metabólica)',
};

export interface OrgReaction {
  id: string;
  title: string;
  type: RxType;
  /** Familia del reactivo orgánico (para el menú). */
  group: string;
  conditions: string;
  reactants: RxSpecies[];
  products: RxSpecies[];
  /** Coeficientes calculados por balancing.solveBalance (reactivos y luego productos). */
  coefs: number[];
  reversible?: boolean;
  /** Qué enlaces se rompen y se forman, en palabras. */
  bonds: string;
  /** Idea clave para el estudiante. */
  idea: string;
  /** Reactivo cuya masa elige el estudiante en la estequiometría (índice en reactants). */
  keyReactant: number;
  /** Producto de interés (índice en products). */
  keyProduct: number;
  /** Advertencia de seguridad o de alcance (nunca un protocolo de síntesis). */
  note?: string;
}

interface RawReaction extends Omit<OrgReaction, 'coefs'> { _?: never }

function balance(r: RawReaction): number[] {
  const def: ReactionDef = {
    id: r.id, name: r.title, level: 3, context: '',
    reactants: r.reactants.map((s) => ({ formula: s.formula, name: s.name, kind: 'molecula' })),
    products: r.products.map((s) => ({ formula: s.formula, name: s.name, kind: 'molecula' })), answer: [],
  };
  const sol = solveBalance(def);
  if (!sol.unique || !sol.coefficients) throw new RangeError(`La reacción «${r.title}» no tiene un balanceo único.`);
  return sol.coefficients;
}

const RAW: RawReaction[] = [
  { id: 'combustion-metano', title: 'Combustión completa del metano', type: 'combustion', group: 'Alcanos', conditions: 'Exceso de oxígeno (llama azul), chispa o llama para iniciar.', reactants: [SP.metano, SP.O2], products: [SP.CO2, SP.H2O], bonds: 'Se rompen los 4 enlaces C–H y los O=O; se forman los C=O del CO₂ y los O–H del agua.', idea: 'Todo el carbono termina como CO₂ y todo el hidrógeno como agua; se libera mucha energía.', keyReactant: 0, keyProduct: 0 },
  { id: 'combustion-metanol', title: 'Combustión completa del metanol', type: 'combustion', group: 'Alcoholes', conditions: 'Exceso de oxígeno.', reactants: [SP.metanol, SP.O2], products: [SP.CO2, SP.H2O], bonds: 'Se rompen C–H, C–O, O–H y O=O; se forman C=O y O–H.', idea: 'Un alcohol ya está parcialmente oxidado: libera menos energía por mol de C que el alcano del mismo número de carbonos.', keyReactant: 0, keyProduct: 0 },
  { id: 'combustion-etanol', title: 'Combustión completa del etanol', type: 'combustion', group: 'Alcoholes', conditions: 'Exceso de oxígeno (alcohol antiséptico, gasolina con etanol).', reactants: [SP.etanol, SP.O2], products: [SP.CO2, SP.H2O], bonds: 'Se rompen C–C, C–H, C–O, O–H y O=O; se forman C=O y O–H.', idea: 'El etanol de la caña de azúcar se mezcla con la gasolina en Colombia; su combustión completa da CO₂ y agua.', keyReactant: 0, keyProduct: 0 },
  { id: 'combustion-incompleta', title: 'Combustión incompleta del metano (monóxido de carbono)', type: 'combustion', group: 'Alcanos', conditions: 'Poco oxígeno (llama amarilla, estufa mal ventilada).', reactants: [SP.metano, SP.O2], products: [SP.CO, SP.H2O], bonds: 'Como en la completa, pero el carbono solo llega a C≡O.', idea: 'Con poco oxígeno se forma CO, un gas tóxico sin olor: por eso las estufas y calentadores deben estar en lugares ventilados.', keyReactant: 0, keyProduct: 0, note: 'El CO es tóxico: nunca se produce a propósito en el aula.' },
  { id: 'combustion-hollin', title: 'Combustión incompleta con hollín', type: 'combustion', group: 'Alcanos', conditions: 'Muy poco oxígeno (llama fuliginosa).', reactants: [SP.metano, SP.O2], products: [SP.C, SP.H2O], bonds: 'Solo se oxida el hidrógeno; el carbono queda como hollín (C).', idea: 'El hollín negro de una llama amarilla es carbono que no se oxidó.', keyReactant: 0, keyProduct: 0 },
  { id: 'halogenacion', title: 'Cloración del metano (sustitución por radicales)', type: 'sustitucion', group: 'Alcanos', conditions: 'Luz ultravioleta o calor; mecanismo en cadena por radicales libres (iniciación, propagación, terminación).', reactants: [SP.metano, SP.Cl2], products: [SP.clorometano, SP.HCl], bonds: 'Se rompen un C–H y el Cl–Cl; se forman C–Cl y H–Cl.', idea: 'Un átomo de H se sustituye por Cl. Con más cloro siguen CH₂Cl₂, CHCl₃ y CCl₄: la reacción es poco selectiva.', keyReactant: 0, keyProduct: 0, note: 'El cloro y el HCl son tóxicos: solo se estudia en el simulador.' },
  { id: 'hidrogenacion-eteno', title: 'Hidrogenación del eteno', type: 'adicion', group: 'Alquenos', conditions: 'Catalizador de Ni, Pd o Pt; calor y presión moderados.', reactants: [SP.eteno, SP.H2], products: [SP.etano], bonds: 'Se rompe el enlace π del C=C y el H–H; se forman dos C–H.', idea: 'Un alqueno insaturado se convierte en alcano saturado (así se endurecen los aceites vegetales).', keyReactant: 0, keyProduct: 0 },
  { id: 'hidrogenacion-ciclohexeno', title: 'Hidrogenación del ciclohexeno', type: 'adicion', group: 'Alquenos', conditions: 'Catalizador de Ni, Pd o Pt.', reactants: [SP.ciclohexeno, SP.H2], products: [SP.ciclohexano], bonds: 'Se rompe el enlace π del C=C y el H–H; se forman dos C–H.', idea: 'La entalpía de hidrogenación mide la energía del enlace π (se calcula aquí con la ley de Hess).', keyReactant: 0, keyProduct: 0 },
  { id: 'bromacion-eteno', title: 'Adición de bromo al eteno', type: 'adicion', group: 'Alquenos', conditions: 'Temperatura ambiente, en la oscuridad; el agua de bromo (pardo-rojiza) se decolora.', reactants: [SP.eteno, SP.Br2], products: [SP.dibromoetano], bonds: 'Se rompe el enlace π y el Br–Br; se forman dos C–Br en carbonos vecinos.', idea: 'Es la prueba de insaturación: el color del bromo desaparece porque el Br₂ se adiciona al doble enlace.', keyReactant: 0, keyProduct: 0, note: 'El bromo es corrosivo y tóxico: en el colegio se usa, si acaso, agua de bromo muy diluida bajo supervisión.' },
  { id: 'hbr-markovnikov', title: 'Adición de HBr al propeno (regla de Markovnikov)', type: 'adicion', group: 'Alquenos', conditions: 'Sin peróxidos; mecanismo iónico con carbocatión.', reactants: [SP.propeno, SP.HBr], products: [SP.bromopropano2], bonds: 'Se rompe el enlace π y el H–Br; el H va al C con más H y el Br al C central.', idea: 'Regla de Markovnikov: el H se une al carbono del doble enlace que ya tiene más hidrógenos, porque se forma el carbocatión más estable (secundario).', keyReactant: 0, keyProduct: 0 },
  { id: 'hbr-antimarkovnikov', title: 'Adición de HBr al propeno con peróxidos (anti-Markovnikov)', type: 'adicion', group: 'Alquenos', conditions: 'Con peróxidos (ROOR) y luz: mecanismo por radicales.', reactants: [SP.propeno, SP.HBr], products: [SP.bromopropano1], bonds: 'Se rompe el enlace π y el H–Br; el Br va al C terminal.', idea: 'Con peróxidos el Br• se une primero al C terminal (radical secundario más estable) y el producto es el contrario: 1-bromopropano.', keyReactant: 0, keyProduct: 0 },
  { id: 'hidratacion', title: 'Hidratación del propeno', type: 'adicion', group: 'Alquenos', conditions: 'Ácido como catalizador (H₂SO₄ o H₃PO₄ diluido), calor.', reactants: [SP.propeno, SP.H2O], products: [SP.propan2ol], bonds: 'Se rompe el enlace π y un O–H del agua; se forman C–H y C–OH.', idea: 'También sigue la regla de Markovnikov: el –OH queda en el carbono central (propan-2-ol, no propan-1-ol).', keyReactant: 0, keyProduct: 0 },
  { id: 'oxidacion-metanol', title: 'Oxidación del metanol a metanal', type: 'oxidacion', group: 'Alcoholes', conditions: 'Industrial: aire sobre catalizador de plata u óxidos metálicos, en caliente.', reactants: [SP.metanol, SP.O2], products: [SP.metanal, SP.H2O], bonds: 'Se pierden el H del O–H y un H del C: el C–O pasa a C=O.', idea: 'Un alcohol primario se oxida a aldehído (y, si sigue, a ácido carboxílico).', keyReactant: 0, keyProduct: 0 },
  { id: 'oxidacion-metanal', title: 'Oxidación del metanal a ácido metanoico', type: 'oxidacion', group: 'Aldehídos', conditions: 'Oxidantes (O₂ con catalizador, KMnO₄, K₂Cr₂O₇ en ácido).', reactants: [SP.metanal, SP.O2], products: [SP.acFormico], bonds: 'El C–H del aldehído pasa a C–OH.', idea: 'Los aldehídos se oxidan con facilidad: por eso dan positivas las pruebas de Tollens y Fehling.', keyReactant: 0, keyProduct: 0 },
  { id: 'oxidacion-etanol', title: 'Oxidación del etanol a etanal', type: 'oxidacion', group: 'Alcoholes', conditions: 'En el hígado (enzima alcohol deshidrogenasa) o en el laboratorio con K₂Cr₂O₇/H₂SO₄ (naranja → verde).', reactants: [SP.etanol, SP.O2], products: [SP.etanal, SP.H2O], bonds: 'Se pierden el H del O–H y un H del C unido al O.', idea: 'Alcohol primario → aldehído. El etanal sigue oxidándose a ácido acético (así se avinagra el vino, por bacterias del género Acetobacter).', keyReactant: 0, keyProduct: 0 },
  { id: 'oxidacion-etanal', title: 'Oxidación del etanal a ácido acético', type: 'oxidacion', group: 'Aldehídos', conditions: 'O₂ con catalizador (industrial) o bacterias acéticas (vinagre).', reactants: [SP.etanal, SP.O2], products: [SP.acAcetico], bonds: 'El C–H del grupo aldehído pasa a C–OH.', idea: 'Aldehído → ácido carboxílico: segundo paso de la oxidación de un alcohol primario.', keyReactant: 0, keyProduct: 0 },
  { id: 'oxidacion-propan1ol', title: 'Oxidación del propan-1-ol a propanal', type: 'oxidacion', group: 'Alcoholes', conditions: 'K₂Cr₂O₇/H₂SO₄, destilando el aldehído a medida que se forma.', reactants: [SP.propan1ol, SP.O2], products: [SP.propanal, SP.H2O], bonds: 'C–O pasa a C=O en el C terminal.', idea: 'Alcohol primario (OH en un C unido a un solo C) → aldehído.', keyReactant: 0, keyProduct: 0 },
  { id: 'oxidacion-propan2ol', title: 'Oxidación del propan-2-ol a propanona', type: 'oxidacion', group: 'Alcoholes', conditions: 'K₂Cr₂O₇/H₂SO₄ o catalizador de cobre en caliente.', reactants: [SP.propan2ol, SP.O2], products: [SP.propanona, SP.H2O], bonds: 'Se pierden el H del O–H y el único H del C central.', idea: 'Alcohol secundario → cetona; la cetona ya no tiene H en el C del carbonilo y no sigue oxidándose con facilidad.', keyReactant: 0, keyProduct: 0 },
  { id: 'esterificacion', title: 'Esterificación de Fischer: ácido acético + etanol', type: 'condensacion', group: 'Ácidos y alcoholes', conditions: 'Unas gotas de H₂SO₄ concentrado como catalizador y calentamiento a reflujo; llega a un equilibrio.', reactants: [SP.acAcetico, SP.etanol], products: [SP.acetatoEtilo, SP.H2O], reversible: true, bonds: 'Se rompe el C–OH del ácido y el O–H del alcohol; se forman el enlace C–O del éster y el agua.', idea: 'Es reversible: con cantidades iguales solo se convierte ≈ 2/3 (K ≈ 4). Un exceso de alcohol o retirar el agua desplazan el equilibrio hacia el éster (Le Châtelier).', keyReactant: 0, keyProduct: 0 },
  { id: 'hidrolisis', title: 'Hidrólisis del acetato de etilo', type: 'hidrolisis', group: 'Ésteres', conditions: 'Agua con ácido como catalizador (inversa de la esterificación); con NaOH es la saponificación (irreversible).', reactants: [SP.acetatoEtilo, SP.H2O], products: [SP.acAcetico, SP.etanol], reversible: true, bonds: 'Se rompe el enlace C–O del éster; el agua aporta el –OH al ácido y el –H al alcohol.', idea: 'La hidrólisis ácida es el mismo equilibrio que la esterificación, recorrido al revés. Con una base fuerte (saponificación) se forma la sal del ácido y la reacción va hasta el final: así se hace el jabón con grasas.', keyReactant: 0, keyProduct: 0 },
  { id: 'amida', title: 'Formación de acetamida (ácido acético + amoníaco)', type: 'condensacion', group: 'Ácidos y amidas', conditions: 'Primero se forma la sal acetato de amonio; al calentarla fuerte pierde agua.', reactants: [SP.acAcetico, SP.NH3], products: [SP.acetamida, SP.H2O], bonds: 'Se rompe el C–OH del ácido y un N–H del amoníaco; se forma el enlace C–N de la amida.', idea: 'Ácido + amina (o amoníaco) → amida + agua: es el mismo tipo de enlace que une los aminoácidos en las proteínas.', keyReactant: 0, keyProduct: 0 },
  { id: 'enlace-peptidico', title: 'Enlace peptídico: glicina + glicina → glicilglicina', type: 'condensacion', group: 'Aminoácidos', conditions: 'En la célula, en el ribosoma, con energía del ATP y del GTP (no ocurre solo con calentar).', reactants: [SP.glicina], products: [SP.glicilglicina, SP.H2O], bonds: 'Se rompe el C–OH de una glicina y un N–H de la otra; se forma el enlace peptídico C(=O)–N.', idea: 'Una proteína es una cadena de aminoácidos unidos por enlaces amida (peptídicos); la hidrólisis los rompe en la digestión.', keyReactant: 0, keyProduct: 0 },
  { id: 'nitracion', title: 'Nitración del benceno', type: 'sustitucion-aromatica', group: 'Aromáticos', conditions: 'Mezcla de HNO₃ y H₂SO₄ concentrados (genera el ion nitronio NO₂⁺); temperatura controlada.', reactants: [SP.benceno, SP.HNO3], products: [SP.nitrobenceno, SP.H2O], bonds: 'Un C–H del anillo se reemplaza por C–NO₂; el anillo conserva su sistema aromático.', idea: 'El benceno no adiciona como un alqueno: sustituye un H y conserva la estabilidad aromática.', keyReactant: 0, keyProduct: 0, note: 'Mezcla nitrante: reacción peligrosa que no se hace en el colegio; solo se estudia su ecuación.' },
  { id: 'fermentacion', title: 'Fermentación alcohólica de la glucosa', type: 'fermentacion', group: 'Carbohidratos', conditions: 'Levaduras (Saccharomyces cerevisiae) sin oxígeno, ≈ 30 °C; es una vía metabólica de muchas enzimas.', reactants: [SP.glucosa], products: [SP.etanol, SP.CO2], bonds: 'La glucosa se divide: se rompen enlaces C–C y C–O y se forman los de etanol y CO₂ (en 12 pasos enzimáticos).', idea: 'Así se produce el etanol de la caña y el CO₂ que hace subir el pan; la ecuación resume una vía metabólica, no un solo paso.', keyReactant: 0, keyProduct: 0 },
];

/** Biblioteca de reacciones con coeficientes calculados. */
export const ORG_REACTIONS: OrgReaction[] = RAW.map((r) => ({ ...r, coefs: balance(r) }));

export function reactionById(id: string): OrgReaction {
  const r = ORG_REACTIONS.find((x) => x.id === id);
  if (!r) throw new RangeError(`No existe la reacción «${id}».`);
  return r;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const pretty = (formula: string) => formula.replace(/(?<=[A-Za-z)])(\d+)/g, (d) => [...d].map((c) => SUB[Number(c)]).join(''));

/** Ecuación con coeficientes y subíndices: «CH₄ + 2 O₂ → CO₂ + 2 H₂O». */
export function equationOf(r: OrgReaction): string {
  const nR = r.reactants.length;
  const side = (list: RxSpecies[], cs: number[]) => {
    const merged: { sp: RxSpecies; c: number }[] = [];
    list.forEach((s, i) => { const m = merged.find((x) => x.sp === s); if (m) m.c += cs[i]; else merged.push({ sp: s, c: cs[i] }); });
    return merged.map((x) => `${x.c === 1 ? '' : `${x.c} `}${pretty(x.sp.formula)}`).join(' + ');
  };
  return `${side(r.reactants, r.coefs.slice(0, nR))} ${r.reversible ? '⇌' : '→'} ${side(r.products, r.coefs.slice(nR))}`;
}

/* ------------------------------------------------------------------ estequiometría */

export interface StoichRow { name: string; formula: string; coef: number; M: number; mol: number; mass: number; side: 'r' | 'p' }

/**
 * A partir de la masa (g) del reactivo clave (los demás en la cantidad estequiométrica o en exceso) y un rendimiento (%),
 * calcula moles y masas de todas las especies. El balance de masa se cumple exactamente con rendimiento 100 %.
 */
export function stoichiometry(r: OrgReaction, keyMass: number, yieldPct = 100): { rows: StoichRow[]; massIn: number; massOut: number; actualProduct: number } {
  if (!(keyMass > 0)) throw new RangeError('La masa debe ser positiva.');
  if (!(yieldPct >= 0 && yieldPct <= 100)) throw new RangeError('El rendimiento va de 0 % a 100 %.');
  const nR = r.reactants.length;
  const key = r.reactants[r.keyReactant];
  const nKey = keyMass / molarMass(key.formula);
  const extent = nKey / r.coefs[r.keyReactant];
  const rows: StoichRow[] = [...r.reactants.map((s, i) => ({ s, c: r.coefs[i], side: 'r' as const })), ...r.products.map((s, i) => ({ s, c: r.coefs[nR + i], side: 'p' as const }))]
    .map(({ s, c, side }) => { const M = molarMass(s.formula); const mol = extent * c; return { name: s.name, formula: s.formula, coef: c, M, mol, mass: mol * M, side }; });
  const massIn = rows.filter((x) => x.side === 'r').reduce((t, x) => t + x.mass, 0);
  const massOut = rows.filter((x) => x.side === 'p').reduce((t, x) => t + x.mass, 0);
  const keyP = rows.filter((x) => x.side === 'p')[r.keyProduct];
  return { rows, massIn, massOut, actualProduct: keyP.mass * yieldPct / 100 };
}

/* ------------------------------------------------------------------ ley de Hess con entalpías de combustión */

export interface HessTerm { name: string; formula: string; coef: number; dHc: number | null; state?: string; source?: FProp; zeroByDefinition?: boolean }
export interface HessResult { available: boolean; dH: number | null; terms: { reactants: HessTerm[]; products: HessTerm[] }; missing: string[]; text: string }

function termOf(s: RxSpecies, coef: number): HessTerm {
  if (s.combustionProduct) return { name: s.name, formula: s.formula, coef, dHc: 0, zeroByDefinition: true };
  if (!s.dataId) return { name: s.name, formula: s.formula, coef, dHc: null };
  const p = getFunc(s.dataId).propiedades.dHc;
  return { name: s.name, formula: s.formula, coef, dHc: p ? -p.valor : null, state: p?.estado, source: p ?? undefined };
}

/** ΔrH° (kJ por la ecuación tal como está escrita) = Σ ν·ΔcH°(reactivos) − Σ ν·ΔcH°(productos). */
export function hessEnthalpy(r: OrgReaction): HessResult {
  const nR = r.reactants.length;
  const reactants = r.reactants.map((s, i) => termOf(s, r.coefs[i]));
  const products = r.products.map((s, i) => termOf(s, r.coefs[nR + i]));
  if (r.reactants.concat(r.products).some((s) => /Cl|Br/.test(s.formula))) {
    return { available: false, dH: null, terms: { reactants, products }, missing: ['compuestos halogenados'], text: 'Sin información disponible: con halógenos la combustión no da solo CO₂ y H₂O, y PubChem no trae ΔcH° comparables para estas especies.' };
  }
  const missing = [...reactants, ...products].filter((t) => t.dHc === null).map((t) => t.name);
  if (missing.length) return { available: false, dH: null, terms: { reactants, products }, missing: [...new Set(missing)], text: `Sin información disponible: PubChem (HSDB con una obra de referencia) no tiene ΔcH° de ${[...new Set(missing)].join(', ')}; no se estima.` };
  const sum = (ts: HessTerm[]) => ts.reduce((t, x) => t + x.coef * (x.dHc as number), 0);
  const dH = sum(reactants) - sum(products);
  return { available: true, dH, terms: { reactants, products }, missing: [], text: `ΔrH° = ${dH.toFixed(1)} kJ` };
}

/* ------------------------------------------------------------------ equilibrio de esterificación */

/** Constante de equilibrio de la esterificación ácido acético + etanol (Berthelot y Péan de Saint-Gilles, 1862). */
export const K_ESTER = 4;
export const K_ESTER_SOURCE = 'Berthelot, M. y Péan de Saint-Gilles, L. (1862). Recherches sur les affinités. Annales de Chimie et de Physique, 3.ª serie, 65, 385–422: con cantidades equimolares de ácido acético y etanol se esterifican ≈ 2/3, lo que corresponde a K ≈ 4.';

export interface EsterEq { x: number; acid: number; alcohol: number; ester: number; water: number; conversion: number; Q0: number; direction: 'hacia el éster' | 'hacia los reactivos' | 'en equilibrio' }

/**
 * Equilibrio ácido + alcohol ⇌ éster + agua (mol; el volumen se cancela porque Δn = 0): (e₀ + x)(w₀ + x) = K (a − x)(b − x).
 * Resuelve x por bisección en el intervalo físico (−min(e₀, w₀), min(a, b)); la función es monótona creciente en ese intervalo.
 */
export function esterEquilibrium(a: number, b: number, e0 = 0, w0 = 0, K = K_ESTER): EsterEq {
  if ([a, b, e0, w0].some((v) => !(v >= 0)) || !(K > 0)) throw new RangeError('Cantidades no negativas y K positiva.');
  const lo0 = -Math.min(e0, w0), hi0 = Math.min(a, b);
  const fx = (x: number) => (e0 + x) * (w0 + x) - K * (a - x) * (b - x);
  let lo = lo0, hi = hi0;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (fx(mid) > 0) hi = mid; else lo = mid; }
  const x = (lo + hi) / 2;
  const Q0 = a * b === 0 ? Infinity : (e0 * w0) / (a * b);
  const lim = Math.min(a, b);
  return {
    x, acid: a - x, alcohol: b - x, ester: e0 + x, water: w0 + x, conversion: lim > 0 ? x / lim : 0, Q0,
    direction: Math.abs(Q0 - K) < 1e-12 ? 'en equilibrio' : Q0 < K ? 'hacia el éster' : 'hacia los reactivos',
  };
}

/* ------------------------------------------------------------------ reglas sobre el grafo */

function cloneMol(m: OMolecule): OMolecule { return { atoms: m.atoms.map((a) => ({ ...a })), bonds: m.bonds.map((b) => ({ ...b })), stereo: [] }; }

export interface AdditionProduct { major: { smiles: string; mol: OMolecule; name: string; formula: string }; minor: { smiles: string; mol: OMolecule; name: string; formula: string } | null; rule: string }

/**
 * Adición de HX (X = Br, Cl) o de agua a un alqueno con un solo C=C según Markovnikov: el H va al carbono del doble enlace con más
 * H; X (u OH) al otro. Si ambos carbonos tienen los mismos H, hay un solo producto (o mezcla equivalente).
 */
export function markovnikovAddition(alkeneSmiles: string, reagent: 'HBr' | 'HCl' | 'H2O'): AdditionProduct {
  const m = parseSmiles(alkeneSmiles);
  const db = m.bonds.filter((b) => b.order === 2 && m.atoms[b.a].el === 'C' && m.atoms[b.b].el === 'C');
  if (db.length !== 1) throw new RangeError('El alqueno debe tener exactamente un doble enlace C=C.');
  const { a, b } = db[0];
  const hA = implicitH(m, a), hB = implicitH(m, b);
  const build = (hTo: number, xTo: number) => {
    const p = cloneMol(m);
    bondBetween(p, hTo, xTo)!.order = 1;
    const el = reagent === 'H2O' ? 'O' : reagent === 'HBr' ? 'Br' : 'Cl';
    p.atoms.push({ el });
    p.bonds.push({ a: xTo, b: p.atoms.length - 1, order: 1 });
    const nm = nameFunctional(p);
    return { smiles: '', mol: p, name: nm.ok ? nm.es : '—', formula: hillFormula(p) };
  };
  const major = hA >= hB ? build(a, b) : build(b, a);
  const minor = hA === hB ? null : hA >= hB ? build(b, a) : build(a, b);
  return { major, minor: minor && minor.name !== major.name ? minor : null, rule: hA === hB ? 'Los dos carbonos del doble enlace tienen los mismos H: la regla no distingue (un producto o una mezcla equivalente).' : `El H se une al carbono con ${Math.max(hA, hB)} H; el ${reagent === 'H2O' ? '–OH' : reagent.slice(1)} al carbono con ${Math.min(hA, hB)} H (carbocatión más sustituido).` };
}

export interface OxidationStep { mol: OMolecule; name: string; formula: string; kind: 'aldehido' | 'acido' | 'cetona' }
export interface OxidationPath { degree: string; steps: OxidationStep[]; text: string }

/** Oxidación de un alcohol según su clase: 1.º → aldehído → ácido; 2.º → cetona; 3.º → no se oxida en condiciones suaves. */
export function oxidizeAlcohol(smiles: string): OxidationPath {
  const m = parseSmiles(smiles);
  const g = detectGroups(m).find((x) => x.kind === 'alcohol');
  if (!g) throw new RangeError('La molécula no tiene un grupo alcohol (–OH en un carbono sp³).');
  const c = g.carrier!, o = g.center;
  const toNamed = (p: OMolecule, kind: OxidationStep['kind']): OxidationStep => { const nm = nameFunctional(p); return { mol: p, name: nm.ok ? nm.es : '—', formula: hillFormula(p), kind }; };
  const hC = implicitH(m, c);
  if (g.degree === 'terciario' || hC === 0) return { degree: 'terciario', steps: [], text: 'Alcohol terciario: el carbono del –OH no tiene H; no se oxida con dicromato o permanganato en condiciones suaves (la solución naranja de dicromato no cambia).' };
  const carb = cloneMol(m);
  bondBetween(carb, c, o)!.order = 2;
  if (g.degree === 'secundario') return { degree: 'secundario', steps: [toNamed(carb, 'cetona')], text: 'Alcohol secundario → cetona; la cetona no se sigue oxidando en condiciones suaves.' };
  const ald = toNamed(carb, 'aldehido');
  const acid = cloneMol(carb);
  acid.atoms.push({ el: 'O' });
  acid.bonds.push({ a: c, b: acid.atoms.length - 1, order: 1 });
  void neighbors;
  return { degree: g.degree === 'metanol' ? 'metanol' : 'primario', steps: [ald, toNamed(acid, 'acido')], text: 'Alcohol primario → aldehído → ácido carboxílico (si el oxidante sigue actuando).' };
}

/* ------------------------------------------------------------------ ficha del modelo */


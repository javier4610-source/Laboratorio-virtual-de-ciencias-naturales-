import { periodicElement } from './periodicTrends';
import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Pila electroquímica (grado 11.º): celda galvánica de dos semiceldas metal/ion metálico unidas por un puente salino.
 *
 *   E (reducción, 25 °C) = E° − (0,05916 V/n)·log₁₀(1/[Mⁿ⁺]) = E° + (0,05916/n)·log₁₀[Mⁿ⁺]       (Nernst)
 *   E_celda = E_cátodo − E_ánodo   (cátodo = la semicelda con mayor E: allí se reduce el ion; ánodo: se oxida el metal)
 *         = E°_celda − (0,05916/N)·log₁₀ Q,  N = mcm(n_ánodo, n_cátodo)
 *   Faraday: m = I·t·M/(n·F), F = 96 485,33 C/mol (CODATA 2018)
 *
 * Potenciales estándar de reducción a 25 °C: Vanýsek, P., «Electrochemical series», CRC Handbook of Chemistry and Physics
 * (Haynes, W. M., ed.), sección 5. Masas molares y densidades: tabla periódica de PubChem del laboratorio (2026-11-01).
 * 0,05916 V = R·T·ln(10)/F a 298,15 K. Actividades ≈ concentraciones molares (soluciones diluidas; aproximación escolar).
 * Este archivo no depende de React ni del navegador.
 */

export const FARADAY = 96485.33212; // C/mol
export const NERNST_SLOPE = (8.314462618 * 298.15 * Math.LN10) / FARADAY; // 0,059159 V

export interface HalfCell { id: string; metal: string; ion: string; n: number; E0: number; name: string; ionColor: string; molar: number; density: number }

const RAW: Omit<HalfCell, 'molar' | 'density'>[] = [
  { id: 'zn', metal: 'Zn', ion: 'Zn²⁺', n: 2, E0: -0.7618, name: 'cinc', ionColor: '#eceff1' },
  { id: 'fe', metal: 'Fe', ion: 'Fe²⁺', n: 2, E0: -0.447, name: 'hierro', ionColor: '#c5e1a5' },
  { id: 'ni', metal: 'Ni', ion: 'Ni²⁺', n: 2, E0: -0.257, name: 'níquel', ionColor: '#81c784' },
  { id: 'pb', metal: 'Pb', ion: 'Pb²⁺', n: 2, E0: -0.1262, name: 'plomo', ionColor: '#eceff1' },
  { id: 'cu', metal: 'Cu', ion: 'Cu²⁺', n: 2, E0: 0.3419, name: 'cobre', ionColor: '#4fa3e0' },
  { id: 'ag', metal: 'Ag', ion: 'Ag⁺', n: 1, E0: 0.7996, name: 'plata', ionColor: '#eceff1' },
];
/** Masa molar (g/mol) y densidad (g/cm³) de cada metal, de la tabla periódica de PubChem guardada en el laboratorio. */
const DENS: Record<string, number> = { Zn: 7.134, Fe: 7.874, Ni: 8.912, Pb: 11.342, Cu: 8.933, Ag: 10.501 };
export const HALF_CELLS: HalfCell[] = RAW.map((h) => ({ ...h, molar: periodicElement(h.metal).masa as number, density: DENS[h.metal] }));
export const halfCell = (id: string): HalfCell => {
  const h = HALF_CELLS.find((x) => x.id === id);
  if (!h) throw new RangeError(`Semicelda desconocida: ${id}`);
  return h;
};

export const PC_LIMITS = {
  conc: [0.001, 2] as [number, number], // mol/L
  volume: [50, 250] as [number, number], // mL de cada solución
  current: [0, 100] as [number, number], // mA (carga electrónica de corriente constante)
  time: [0, 300] as [number, number], // min
};
/** Láminas de 5,0 cm × 2,0 cm × 1,0 mm sumergidas hasta la mitad: volumen 1,000 cm³. */
export const ELECTRODE_VOLUME_CM3 = 1;
export const VOLTMETER = { resolution: 0.001 }; // V
export const BALANCE = { resolution: 0.001 }; // g

/** Potencial de reducción de una semicelda con Nernst (25 °C). */
export function electrodePotential(h: HalfCell, c: number): number {
  if (c <= 0) return -Infinity;
  return h.E0 + (NERNST_SLOPE / h.n) * Math.log10(c);
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

export interface CellInput { left: string; right: string; cLeft: number; cRight: number; bridge: 'KNO3' | 'KCl' | 'ninguno' }
export interface CellResult {
  ELeft: number; ERight: number;
  /** fem de la pila (siempre ≥ 0) y E° de la pila. */
  E: number; E0: number;
  anode: 'left' | 'right' | null; cathode: 'left' | 'right' | null;
  /** Lectura del voltímetro con el borne rojo (+) a la derecha y el COM a la izquierda: E_der − E_izq (0 sin puente). */
  voltmeter: number;
  N: number; Q: number;
  reaction: string; anodeHalf: string; cathodeHalf: string;
  closed: boolean;
}
export function cell(i: CellInput): CellResult {
  assertInRange('La concentración izquierda', i.cLeft, PC_LIMITS.conc[0], PC_LIMITS.conc[1]);
  assertInRange('La concentración derecha', i.cRight, PC_LIMITS.conc[0], PC_LIMITS.conc[1]);
  const L = halfCell(i.left), R = halfCell(i.right);
  const ELeft = electrodePotential(L, i.cLeft), ERight = electrodePotential(R, i.cRight);
  const diff = ERight - ELeft;
  const zero = Math.abs(diff) < 1e-12;
  const anode = zero ? null : diff > 0 ? 'left' : 'right';
  const cathode = zero ? null : diff > 0 ? 'right' : 'left';
  const A = anode === 'right' ? R : L, C = anode === 'right' ? L : R;
  const cA = anode === 'right' ? i.cRight : i.cLeft, cC = anode === 'right' ? i.cLeft : i.cRight;
  const N = lcm(A.n, C.n);
  const Q = cA ** (N / A.n) / cC ** (N / C.n);
  const E0 = C.E0 - A.E0;
  const closed = i.bridge !== 'ninguno';
  const coefA = N / A.n, coefC = N / C.n;
  const k = (c: number, s: string) => (c === 1 ? s : `${c} ${s}`);
  return {
    ELeft, ERight, E: Math.abs(diff), E0: zero ? 0 : E0, anode, cathode, voltmeter: closed ? diff : 0, N, Q,
    anodeHalf: `${A.metal}(s) → ${A.ion}(ac) + ${A.n === 1 ? '' : `${A.n} `}e⁻`,
    cathodeHalf: `${C.ion}(ac) + ${C.n === 1 ? '' : `${C.n} `}e⁻ → ${C.metal}(s)`,
    reaction: zero ? 'sin reacción neta' : `${k(coefA, `${A.metal}(s)`)} + ${k(coefC, `${C.ion}(ac)`)} → ${k(coefA, `${A.ion}(ac)`)} + ${k(coefC, `${C.metal}(s)`)}`,
    closed,
  };
}
/** fem con la forma E°_celda − (0,05916/N)·log Q (debe coincidir con E_cátodo − E_ánodo). */
export function nernstCell(E0: number, N: number, Q: number): number { return E0 - (NERNST_SLOPE / N) * Math.log10(Q); }

/** Masa (g) que se disuelve o se deposita con una corriente I (A) durante t (s): m = I·t·M/(n·F). */
export function faradayMass(I: number, tS: number, h: HalfCell): number { return (I * tS * h.molar) / (h.n * FARADAY); }

export interface DischargeInput extends CellInput { volumeML: number; currentMA: number; timeMin: number }
export interface DischargeState {
  t: number; // min
  charge: number; // C
  electronsMol: number;
  massLeft: number; massRight: number; // g
  dLeft: number; dRight: number; // g (cambio)
  cLeft: number; cRight: number; // mol/L
  E: number; // fem en ese instante (V)
  /** El ion del cátodo se agotó antes de este tiempo (la corriente no se puede mantener). */
  depleted: boolean;
  tDepleteMin: number | null;
}
export const initialMass = (h: HalfCell) => h.density * ELECTRODE_VOLUME_CM3;
/** Estado de la pila al descargarse con corriente constante durante t minutos (el ánodo se disuelve, el cátodo engorda). */
export function discharge(i: DischargeInput, tMin = i.timeMin): DischargeState {
  assertInRange('La corriente', i.currentMA, PC_LIMITS.current[0], PC_LIMITS.current[1]);
  assertInRange('El volumen', i.volumeML, PC_LIMITS.volume[0], PC_LIMITS.volume[1]);
  const c0 = cell(i);
  const L = halfCell(i.left), R = halfCell(i.right);
  const I = c0.closed && c0.anode ? i.currentMA / 1000 : 0;
  const V = i.volumeML / 1000;
  const cathodeHC = c0.cathode === 'right' ? R : L;
  const cCath0 = c0.cathode === 'right' ? i.cRight : i.cLeft;
  // tiempo en que se agota el ion del cátodo: n_ion·n_e·F / I
  const tDepleteMin = I > 0 ? (cCath0 * V * cathodeHC.n * FARADAY) / I / 60 : null;
  const tEff = tDepleteMin !== null ? Math.min(tMin, tDepleteMin) : tMin;
  const charge = I * tEff * 60;
  const ne = charge / FARADAY;
  const sign = (side: 'left' | 'right') => (c0.anode === side ? -1 : c0.cathode === side ? 1 : 0);
  const dLeft = sign('left') * (ne / L.n) * L.molar, dRight = sign('right') * (ne / R.n) * R.molar;
  const cLeft = Math.max(0, i.cLeft - (sign('left') * ne) / L.n / V), cRight = Math.max(0, i.cRight - (sign('right') * ne) / R.n / V);
  const depleted = tDepleteMin !== null && tMin >= tDepleteMin - 1e-9;
  const E = depleted ? 0 : Math.abs(electrodePotential(R, cRight) - electrodePotential(L, cLeft));
  return { t: tMin, charge, electronsMol: ne, massLeft: initialMass(L) + dLeft, massRight: initialMass(R) + dRight, dLeft, dRight, cLeft, cRight, E, depleted, tDepleteMin };
}

export interface PcCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function cellConditions(i: DischargeInput): PcCondition[] {
  const out: PcCondition[] = [];
  const c = cell(i);
  const L = halfCell(i.left), R = halfCell(i.right);
  if (!c.closed) out.push({ level: 'invalido', text: 'Sin puente salino el circuito está abierto: los iones no pueden pasar de un vaso a otro, la carga se acumula y no hay corriente ni voltaje medible.', fix: 'Coloca el puente salino de KNO₃ entre los dos vasos.' });
  if (c.closed && i.bridge === 'KCl' && [L, R].some((h) => h.metal === 'Ag' || h.metal === 'Pb')) {
    const m = [L, R].find((h) => h.metal === 'Ag' || h.metal === 'Pb')!;
    out.push({ level: 'invalido', text: `Los iones Cl⁻ del puente de KCl precipitan con el ${m.ion} (${m.metal === 'Ag' ? 'AgCl, muy poco soluble' : 'PbCl₂, poco soluble'}): el sólido tapa el puente y cambia la concentración del ion.`, fix: 'Usa un puente salino de KNO₃: el nitrato no precipita con ningún ion metálico de esta pila.' });
  }
  if (c.closed && c.voltmeter < -1e-9) out.push({ level: 'advertencia', text: `El voltímetro marca un valor negativo (${c.voltmeter.toFixed(3).replace('.', ',')} V): el borne rojo (+) está conectado al ánodo.`, fix: 'Intercambia los cables del voltímetro: el borne rojo va al cátodo (el electrodo positivo, el de mayor potencial de reducción).' });
  if (c.closed && !c.anode) out.push({ level: 'nota', text: 'Las dos semiceldas son iguales (mismo metal y misma concentración): no hay diferencia de potencial ni reacción neta.', fix: 'Cambia el metal de una semicelda, o deja el mismo metal con concentraciones distintas para armar una pila de concentración.' });
  if (i.left === 'fe' || i.right === 'fe') out.push({ level: 'nota', text: 'El Fe²⁺ se oxida lentamente a Fe³⁺ con el oxígeno del aire; en el laboratorio real la solución de FeSO₄ se prepara el mismo día.', fix: 'Prepara la solución de FeSO₄ justo antes de la práctica (el modelo supone que no se oxida).' });
  const d = discharge(i, i.timeMin);
  if (c.closed && c.anode && i.currentMA > 0 && d.depleted) out.push({ level: 'invalido', text: `Con ${i.currentMA} mA el ion del cátodo se agota a los ${(d.tDepleteMin as number).toFixed(1).replace('.', ',')} min: después la pila ya no puede mantener la corriente.`, fix: `Baja la corriente, acorta el tiempo a menos de ${Math.floor(d.tDepleteMin as number)} min o usa una solución más concentrada en el cátodo.` });
  return out;
}

export const electrochemicalCellSpec: ModelSpec = {
  name: 'Pila galvánica: potenciales estándar, ecuación de Nernst (25 °C) y ley de Faraday',
  inputs: [
    { symbol: 'semiceldas', name: 'Metal y solución de cada vaso (Zn, Fe, Ni, Pb, Cu, Ag)', unit: '—', initial: 'Zn | Cu' },
    { symbol: '[Mⁿ⁺]', name: 'Concentración del ion metálico en cada vaso', unit: 'mol/L', range: PC_LIMITS.conc, initial: 1 },
    { symbol: 'puente', name: 'Puente salino (KNO₃, KCl o ninguno)', unit: '—', initial: 'KNO₃' },
    { symbol: 'I', name: 'Corriente de la carga electrónica (constante)', unit: 'mA', range: PC_LIMITS.current, initial: 50 },
    { symbol: 't', name: 'Tiempo de funcionamiento', unit: 'min', range: PC_LIMITS.time, initial: 120 },
  ],
  outputs: [
    { symbol: 'E', name: 'Fuerza electromotriz de la pila (voltímetro en circuito abierto)', unit: 'V' },
    { symbol: 'Δm', name: 'Cambio de masa de cada electrodo', unit: 'g' },
    { symbol: '[Mⁿ⁺](t)', name: 'Concentraciones al cabo del tiempo', unit: 'mol/L' },
  ],
  equations: [
    'E°celda = E°cátodo − E°ánodo;   Daniell: 0,3419 − (−0,7618) = 1,1037 V',
    'E = E°celda − (0,05916 V/N)·log₁₀ Q   (25 °C; Q = [ion del ánodo]^(N/nₐ)/[ion del cátodo]^(N/n_c))',
    'm = I·t·M/(n·F),   F = 96 485,33 C/mol',
  ],
  initialConditions: [
    'Láminas metálicas de 1,000 cm³ (5 cm × 2 cm × 1 mm) con la densidad de PubChem; 25 °C; voltímetro de alta impedancia (0,001 V); balanza de 0,001 g.',
    'Potenciales estándar de reducción del CRC Handbook (Vanýsek): Zn²⁺/Zn −0,7618 V; Fe²⁺/Fe −0,447 V; Ni²⁺/Ni −0,257 V; Pb²⁺/Pb −0,1262 V; Cu²⁺/Cu +0,3419 V; Ag⁺/Ag +0,7996 V.',
  ],
  assumptions: [
    'Actividad ≈ concentración molar (soluciones diluidas); temperatura constante de 25 °C.',
    'Una carga electrónica mantiene la corriente constante; el voltímetro mide en circuito abierto (sin caída por la resistencia interna).',
    'Todo el metal que se oxida pasa a la solución y todo el ion que se reduce se deposita (eficiencia de corriente del 100 %).',
  ],
  limits: [
    'Una pila real con puente salino tiene resistencia interna: su voltaje con carga es menor que la fem; el modelo no la incluye.',
    'Con concentraciones altas las actividades difieren de las concentraciones y la ecuación de Nernst con molaridades es aproximada.',
    'No modela reacciones secundarias (oxidación del Fe²⁺ por el aire, desprendimiento de hidrógeno ni pasivación).',
  ],
  testCases: [
    'Pila de Daniell con Zn²⁺ y Cu²⁺ 1,0 mol/L: E = 1,104 V; el Zn es el ánodo (−) y el Cu el cátodo (+).',
    '[Cu²⁺] = 0,010 mol/L y [Zn²⁺] = 1,0 mol/L: E = 1,1037 − 0,02958·log(100) = 1,045 V.',
    'I = 50 mA durante 120 min: Q = 360 C; el ánodo de Zn pierde 360·65,4/(2·96 485) = 0,1220 g y el cátodo de Cu gana 0,1186 g.',
  ],
};

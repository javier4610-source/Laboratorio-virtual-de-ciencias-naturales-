import { assertInRange, R_GAS } from './math';
import type { ModelSpec } from './types';

/**
 * Primera ley de la termodinámica y máquinas térmicas (grado 11.º), con un gas ideal en un cilindro con émbolo.
 *
 * Convención de signos (la de la mayoría de los textos de física, p. ej. Serway y Sears–Zemansky):
 *   ΔU = Q − W,  Q > 0 si el gas RECIBE calor y W > 0 si el gas HACE trabajo sobre el émbolo (se expande).
 *   (La IUPAC y muchos textos de química escriben ΔU = Q + W con W el trabajo hecho SOBRE el gas: es la misma ley.)
 * Gas ideal: P·V = n·R·T con R = 8,314 462 618 J/(mol·K) (CODATA 2018, exacto). Energía interna U = n·C_v·T con
 * calores específicos constantes: monoatómico C_v = 3R/2 (γ = 5/3); diatómico (aire) C_v = 5R/2 (γ = 7/5).
 * Procesos cuasiestáticos (el émbolo se mueve despacio y el gas está en equilibrio en cada instante):
 *   isotérmico  W = n·R·T·ln(V₂/V₁), ΔU = 0, Q = W
 *   isobárico   W = P·(V₂ − V₁),     ΔU = n·C_v·ΔT, Q = n·C_p·ΔT
 *   isocórico   W = 0,               Q = ΔU = n·C_v·ΔT
 *   adiabático  P·V^γ = constante,   Q = 0, W = (P₁V₁ − P₂V₂)/(γ − 1) = −ΔU
 * El trabajo es el área bajo la curva en el diagrama P–V; en un ciclo, el trabajo neto es el área encerrada.
 * Ciclos ideales (aire estándar): Otto η = 1 − 1/r^(γ−1) con r = V_máx/V_mín; Carnot η = 1 − T_f/T_c.
 * Este archivo no depende de React ni del navegador.
 */

export const R = R_GAS;
export type GasKind = 'diatomico' | 'monoatomico';
export const GASES: { id: GasKind; name: string; cv: number; gamma: number }[] = [
  { id: 'diatomico', name: 'Aire (diatómico, γ = 1,4)', cv: 2.5, gamma: 1.4 },
  { id: 'monoatomico', name: 'Helio (monoatómico, γ = 5/3)', cv: 1.5, gamma: 5 / 3 },
];
export function findGas(id: string) {
  const g = GASES.find((x) => x.id === id);
  if (!g) throw new RangeError(`Gas desconocido: ${id}`);
  return g;
}

/** Estado inicial del cilindro: 100 kPa, 1,00 L y 300 K (≈ 27 °C), así n = P·V/(R·T) ≈ 0,0401 mol. */
export const P0 = 100_000; // Pa
export const V0 = 1e-3; // m³
export const T0 = 300; // K
export const N0 = (P0 * V0) / (R * T0);

export interface GasState { P: number; V: number; T: number }
export type ProcessKind = 'isotermico' | 'isobarico' | 'isocorico' | 'adiabatico';
export const PROCESSES: { id: ProcessKind; name: string; param: string }[] = [
  { id: 'isotermico', name: 'Isotérmico (T constante)', param: 'V₂/V₁' },
  { id: 'isobarico', name: 'Isobárico (P constante)', param: 'V₂/V₁' },
  { id: 'isocorico', name: 'Isocórico (V constante)', param: 'T₂/T₁' },
  { id: 'adiabatico', name: 'Adiabático (sin intercambio de calor)', param: 'V₂/V₁' },
];

export interface Process {
  kind: ProcessKind;
  s1: GasState; s2: GasState;
  /** Trabajo hecho POR el gas (J), calor recibido por el gas (J) y cambio de energía interna (J). */
  W: number; Q: number; dU: number;
  /** Curva en el diagrama P–V (V en m³, P en Pa), de s1 a s2. */
  path: { V: number; P: number }[];
}

const SAMPLES = 60;

/**
 * Proceso cuasiestático de n moles desde s1. `ratio` es V₂/V₁ (isotérmico, isobárico, adiabático) o T₂/T₁ (isocórico).
 */
export function gasProcess(kind: ProcessKind, n: number, gasId: string, s1: GasState, ratio: number): Process {
  assertInRange('La relación', ratio, 0.05, 20);
  const g = findGas(gasId);
  const cv = g.cv * R;
  const path: { V: number; P: number }[] = [];
  let s2: GasState, W: number;
  if (kind === 'isocorico') {
    const T2 = s1.T * ratio;
    s2 = { V: s1.V, T: T2, P: (n * R * T2) / s1.V };
    W = 0;
    for (let i = 0; i <= SAMPLES; i++) path.push({ V: s1.V, P: s1.P + ((s2.P - s1.P) * i) / SAMPLES });
  } else {
    const V2 = s1.V * ratio;
    if (kind === 'isotermico') {
      s2 = { V: V2, T: s1.T, P: (n * R * s1.T) / V2 };
      W = n * R * s1.T * Math.log(ratio);
    } else if (kind === 'isobarico') {
      s2 = { V: V2, P: s1.P, T: (s1.P * V2) / (n * R) };
      W = s1.P * (V2 - s1.V);
    } else {
      const P2 = s1.P * (s1.V / V2) ** g.gamma;
      s2 = { V: V2, P: P2, T: (P2 * V2) / (n * R) };
      W = (s1.P * s1.V - P2 * V2) / (g.gamma - 1);
    }
    for (let i = 0; i <= SAMPLES; i++) {
      const V = s1.V + ((V2 - s1.V) * i) / SAMPLES;
      const P = kind === 'isotermico' ? (n * R * s1.T) / V : kind === 'isobarico' ? s1.P : s1.P * (s1.V / V) ** g.gamma;
      path.push({ V, P });
    }
  }
  const dU = n * cv * (s2.T - s1.T);
  const Q = kind === 'adiabatico' ? 0 : dU + W;
  return { kind, s1, s2, W, Q, dU, path };
}

export const initialState = (): GasState => ({ P: P0, V: V0, T: T0 });

/** Área encerrada por una curva cerrada en el diagrama P–V (fórmula del agrimensor), positiva si se recorre en sentido horario. */
export function enclosedArea(points: { V: number; P: number }[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    a += p.V * q.P - q.V * p.P;
  }
  return -a / 2;
}

export interface Cycle {
  kind: 'otto' | 'carnot';
  legs: Process[];
  Wnet: number; Qin: number; Qout: number;
  /** Rendimiento calculado con los calores (W_neto/Q_entra) y con la fórmula cerrada del ciclo ideal. */
  eta: number; etaFormula: number;
  /** Rendimiento de Carnot entre la temperatura máxima y la mínima del ciclo (el techo para cualquier máquina). */
  etaCarnotLimit: number;
  area: number;
  Tmax: number; Tmin: number;
}

function summarize(kind: Cycle['kind'], legs: Process[], etaFormula: number): Cycle {
  const Wnet = legs.reduce((s, l) => s + l.W, 0);
  const Qin = legs.reduce((s, l) => s + Math.max(0, l.Q), 0);
  const Qout = legs.reduce((s, l) => s + Math.min(0, l.Q), 0);
  const Ts = legs.flatMap((l) => [l.s1.T, l.s2.T]);
  const Tmax = Math.max(...Ts), Tmin = Math.min(...Ts);
  const area = enclosedArea(legs.flatMap((l) => l.path.slice(0, -1)));
  return { kind, legs, Wnet, Qin, Qout, eta: Wnet / Qin, etaFormula, etaCarnotLimit: 1 - Tmin / Tmax, area, Tmax, Tmin };
}

export const OTTO_LIMITS = { r: [2, 14] as [number, number], Tmax: [800, 2500] as [number, number] };
/**
 * Ciclo de Otto ideal con aire: 1→2 compresión adiabática de V₀ a V₀/r, 2→3 calentamiento a volumen constante hasta
 * `Tmax` (la chispa y la combustión), 3→4 expansión adiabática hasta V₀, 4→1 enfriamiento a volumen constante.
 */
export function ottoCycle(r: number, Tmax: number, gasId: string = 'diatomico'): Cycle {
  assertInRange('La relación de compresión', r, 1.1, 30);
  const g = findGas(gasId);
  const n = N0;
  const c12 = gasProcess('adiabatico', n, gasId, initialState(), 1 / r);
  if (Tmax <= c12.s2.T) throw new RangeError('La temperatura máxima debe superar la del final de la compresión');
  const c23 = gasProcess('isocorico', n, gasId, c12.s2, Tmax / c12.s2.T);
  const c34 = gasProcess('adiabatico', n, gasId, c23.s2, r);
  const c41 = gasProcess('isocorico', n, gasId, c34.s2, T0 / c34.s2.T);
  return summarize('otto', [c12, c23, c34, c41], 1 - r ** (1 - g.gamma));
}

export const CARNOT_LIMITS = { Th: [350, 1500] as [number, number], Tc: [250, 400] as [number, number], ratio: [1.5, 4] as [number, number] };
/**
 * Ciclo de Carnot con gas ideal entre Th y Tc: 1→2 expansión isotérmica a Th (V₁ → ratio·V₁, recibe Q de la fuente
 * caliente), 2→3 expansión adiabática hasta Tc, 3→4 compresión isotérmica a Tc (cede calor a la fuente fría), 4→1
 * compresión adiabática hasta Th. Empieza en V₀ = 1,00 L con P = n·R·Th/V₀.
 */
export function carnotCycle(Th: number, Tc: number, ratio = 2, gasId: string = 'diatomico'): Cycle {
  if (Tc >= Th) throw new RangeError('La fuente fría debe estar más fría que la caliente');
  const g = findGas(gasId);
  const n = N0;
  const s1: GasState = { V: V0, T: Th, P: (n * R * Th) / V0 };
  const c12 = gasProcess('isotermico', n, gasId, s1, ratio);
  const kAd = (Th / Tc) ** (1 / (g.gamma - 1)); // V₃/V₂
  const c23 = gasProcess('adiabatico', n, gasId, c12.s2, kAd);
  const c34 = gasProcess('isotermico', n, gasId, c23.s2, 1 / ratio);
  const c41 = gasProcess('adiabatico', n, gasId, c34.s2, 1 / kAd);
  return summarize('carnot', [c12, c23, c34, c41], 1 - Tc / Th);
}

/** Estado del gas a lo largo de un recorrido (fracción 0–1 de las etapas, cada una con la misma duración). */
export function stateAlong(legs: Process[], frac: number): { leg: number; s: GasState; dQsign: number; dWsign: number } {
  const f = Math.min(1, Math.max(0, frac)) * legs.length;
  const leg = Math.min(legs.length - 1, Math.floor(f));
  const u = f - leg;
  const l = legs[leg];
  const k = u * (l.path.length - 1);
  const i = Math.min(l.path.length - 2, Math.floor(k));
  const a = l.path[i], b = l.path[i + 1], w = k - i;
  const V = a.V + (b.V - a.V) * w, P = a.P + (b.P - a.P) * w;
  const n = (l.s1.P * l.s1.V) / (R * l.s1.T);
  return { leg, s: { V, P, T: (P * V) / (n * R) }, dQsign: Math.sign(Math.abs(l.Q) < 1e-9 ? 0 : l.Q), dWsign: Math.sign(Math.abs(l.W) < 1e-9 ? 0 : l.W) };
}

export interface TdCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function processConditions(p: Process): TdCondition[] {
  const out: TdCondition[] = [];
  const Tmax = Math.max(p.s1.T, p.s2.T), Tmin = Math.min(p.s1.T, p.s2.T);
  if (Tmax > 2500) out.push({ level: 'advertencia', text: `El gas llega a ${Math.round(Tmax)} K: a esa temperatura los calores específicos ya no son constantes y el aire empieza a disociarse; el modelo de gas ideal con C_v fijo se aleja de la realidad.`, fix: 'Usa una relación más cercana a 1 para que la temperatura no pase de unos 2500 K.' });
  if (Tmin < 50) out.push({ level: 'advertencia', text: `El gas baja a ${Math.round(Tmin)} K: el aire real se licúa mucho antes (≈ 80 K a 1 atm) y deja de ser un gas ideal.`, fix: 'Usa una relación más cercana a 1 para que la temperatura no baje tanto.' });
  if (p.kind === 'adiabatico') out.push({ level: 'nota', text: 'Un proceso adiabático real necesita paredes aislantes o ser tan rápido que no alcance a pasar calor; el modelo lo supone perfecto.', fix: 'Para comparar, repite con el proceso isotérmico: con la misma relación de volúmenes el trabajo es distinto.' });
  return out;
}
export function cycleConditions(c: Cycle, r?: number): TdCondition[] {
  const out: TdCondition[] = [];
  if (c.kind === 'otto' && r !== undefined && r > 10) out.push({ level: 'nota', text: `Con r = ${String(r).replace('.', ',')} un motor de gasolina real tendría detonación (la mezcla se enciende sola antes de la chispa); según Çengel y Boles, los de gasolina usan r ≈ 7 a 10 y los diésel 12 a 24.`, fix: 'Baja r a 10 o menos para un motor de gasolina, o piensa en un diésel, que no usa chispa.' });
  if (c.Tmax > 2500) out.push({ level: 'advertencia', text: `El ciclo llega a ${Math.round(c.Tmax)} K: con calores específicos constantes el modelo exagera el rendimiento a temperaturas tan altas.`, fix: 'Baja la temperatura máxima.' });
  out.push({ level: 'nota', text: 'Es un ciclo ideal: sin fricción, sin pérdidas de calor por las paredes y con procesos cuasiestáticos. Un motor real rinde bastante menos que este valor.', fix: 'Compara el rendimiento con el de Carnot entre las mismas temperaturas: ninguna máquina real lo alcanza.' });
  return out;
}

export const thermodynamicsSpec: ModelSpec = {
  name: 'Primera ley de la termodinámica con un gas ideal: procesos en un cilindro, diagrama P–V y ciclos de Otto y de Carnot',
  inputs: [
    { symbol: 'proceso', name: 'Isotérmico, isobárico, isocórico o adiabático', unit: '—', initial: 'isotérmico' },
    { symbol: 'V₂/V₁ o T₂/T₁', name: 'Relación final/inicial', unit: '—', range: [0.25, 4], initial: 2 },
    { symbol: 'gas', name: 'Aire (γ = 1,4) o helio (γ = 5/3)', unit: '—', initial: 'aire' },
    { symbol: 'r, T_máx', name: 'Relación de compresión y temperatura máxima del ciclo de Otto', unit: '—, K', range: [2, 2500], initial: '8; 1800 K' },
    { symbol: 'T_c, T_f', name: 'Temperaturas de las fuentes del ciclo de Carnot', unit: 'K', range: [250, 1500], initial: '600 K y 300 K' },
  ],
  outputs: [
    { symbol: 'P, V, T', name: 'Estado del gas', unit: 'kPa, L, K' },
    { symbol: 'Q, W, ΔU', name: 'Calor recibido, trabajo hecho por el gas y cambio de energía interna', unit: 'J' },
    { symbol: 'η', name: 'Rendimiento del ciclo', unit: '%' },
  ],
  equations: [
    'ΔU = Q − W  (Q > 0: el gas recibe calor; W > 0: el gas hace trabajo al expandirse)',
    'P·V = n·R·T;  U = n·C_v·T;  C_v = 5R/2 (aire) o 3R/2 (helio)',
    'Isotérmico: W = n·R·T·ln(V₂/V₁);  isobárico: W = P·ΔV;  isocórico: W = 0;  adiabático: P·V^γ = cte, W = (P₁V₁ − P₂V₂)/(γ − 1)',
    'W = área bajo la curva en el diagrama P–V; en un ciclo, W_neto = área encerrada = Q_entra − |Q_sale|',
    'Otto: η = 1 − 1/r^(γ−1);  Carnot: η = 1 − T_f/T_c',
  ],
  initialConditions: ['Cilindro con 1,00 L de aire a 100 kPa y 300 K (n = 0,0401 mol).'],
  assumptions: [
    'Gas ideal con calores específicos constantes; procesos cuasiestáticos y sin fricción.',
    'R = 8,314 462 618 J/(mol·K) (CODATA 2018).',
    'Los ciclos son ideales de aire estándar: la combustión se reemplaza por un calentamiento a volumen constante.',
  ],
  limits: [
    'A temperaturas muy altas los calores específicos crecen y el aire se disocia: el rendimiento real es menor.',
    'Un motor real tiene fricción, pérdidas de calor, mezcla de combustible y gases de escape: rinde mucho menos que el ciclo ideal.',
    'La temperatura mínima físicamente posible es 0 K; el gas real se licúa mucho antes.',
  ],
  testCases: [
    'Isotérmico, V₂ = 2V₁ desde 100 kPa y 1 L: W = Q = 100·ln 2 = 69,31 J y ΔU = 0.',
    'Isobárico, V₂ = 2V₁: W = 100 J, T₂ = 600 K, ΔU = 250 J y Q = 350 J (aire).',
    'Adiabático: Q = 0 y ΔU = −W; P·V^γ se conserva.',
    'Otto con r = 8 y aire: η = 1 − 8^(−0,4) = 56,5 %; Carnot entre 600 K y 300 K: η = 50 %; el área encerrada coincide con ΣW.',
  ],
};

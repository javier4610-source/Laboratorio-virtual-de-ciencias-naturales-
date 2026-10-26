import { assertInRange, roundToResolution } from './math';
import { MAX_SAFE_CURRENT } from './circuits';
import { fmt } from '../lib/format';
import type { ModelSpec } from './types';
import { classifyWarnings, num, type ModelCondition } from './conditions';

/**
 * Circuitos simples (grado 7.º): pilas AA, interruptores, bombillos, LED, resistor, motor, zumbador,
 * materiales de prueba y un multímetro, conectados con cables sobre una mesa de bornes.
 *
 * El montaje se describe como una lista de piezas de dos terminales (netlist) y se resuelve con
 * ANÁLISIS NODAL MODIFICADO (MNA): incógnitas = voltajes de los nodos + corriente de cada fuente.
 * Los elementos no lineales se tratan así:
 * - Bombillo (filamento de tungsteno): resistencia secante que depende de la temperatura, R = Rₙ·(T/Tₙ)^1,2,
 *   con la temperatura fijada por el balance radiativo P = Pₙ·(T/Tₙ)⁴. Se itera la resistencia (punto fijo,
 *   contractivo) hasta la convergencia.
 * - LED, motor y zumbador: modelos lineales por tramos (encendido/apagado, girando/detenido) cuyo estado se
 *   itera hasta que es coherente con la solución.
 */

export type PartKind =
  | 'pila' | 'cable' | 'interruptor' | 'bombillo' | 'led' | 'resistor' | 'motor' | 'zumbador'
  | 'clip' | 'moneda' | 'grafito' | 'borrador' | 'plastico' | 'multimetro';

export type MeterMode = 'V' | 'A';

/** Pieza de dos terminales. Convenciones de polaridad: pila (a = −, b = +); LED (a = ánodo, b = cátodo);
 *  motor y zumbador (a = borne rojo «+»); multímetro (a = punta roja «VΩA», b = punta negra «COM»). */
export interface NetPart {
  id: string;
  kind: PartKind;
  a: string;
  b: string;
  /** Interruptor: cerrado (true) o abierto. */
  closed?: boolean;
  /** Multímetro: voltímetro (en paralelo) o amperímetro (en serie). */
  mode?: MeterMode;
}

export const PART_INFO: Record<PartKind, { name: string; plural: string; test?: boolean }> = {
  pila: { name: 'Pila AA (1,5 V)', plural: 'pilas' },
  cable: { name: 'Cable', plural: 'cables' },
  interruptor: { name: 'Interruptor', plural: 'interruptores' },
  bombillo: { name: 'Bombillo de linterna (2,5 V; 0,3 A)', plural: 'bombillos' },
  led: { name: 'LED rojo', plural: 'LED' },
  resistor: { name: 'Resistor de 100 Ω', plural: 'resistores' },
  motor: { name: 'Motor pequeño de juguete', plural: 'motores' },
  zumbador: { name: 'Zumbador (buzzer)', plural: 'zumbadores' },
  clip: { name: 'Clip metálico', plural: 'clips', test: true },
  moneda: { name: 'Moneda', plural: 'monedas', test: true },
  grafito: { name: 'Mina de lápiz (grafito)', plural: 'minas', test: true },
  borrador: { name: 'Borrador de caucho', plural: 'borradores', test: true },
  plastico: { name: 'Regla de plástico', plural: 'reglas', test: true },
  multimetro: { name: 'Multímetro', plural: 'multímetros' },
};

/** Parámetros del modelo (valores típicos de componentes escolares; ver supuestos). */
export const SC = {
  cell: { emf: 1.5, r: 0.2 },
  wireR: 0.01,
  switchR: 0.02,
  lamp: { vRated: 2.5, iRated: 0.3, tRated: 2700, tRoom: 300, alpha: 1.2 },
  led: { vOn: 1.8, rS: 15, iMax: 0.03, iFull: 0.02, iVisible: 0.0005 },
  resistor: 100,
  // Motor 130 de juguete: Ra, constante k (V·s/rad), fricción viscosa b (N·m·s/rad) y torque de fricción seca.
  motor: { rA: 1.4, k: 0.00296, b: 2.51e-7, tauF: 0.00296 * 0.07 },
  buzzer: { vOn: 0.7, rS: 130, iSound: 0.004 },
  materials: { clip: 0.05, moneda: 0.005, grafito: 3, borrador: 1e12, plastico: 1e12 } as Record<'clip' | 'moneda' | 'grafito' | 'borrador' | 'plastico', number>,
  meter: { rV: 1e7, rA: 0.1 },
  gmin: 1e-12,
  /** Corriente de una pila a partir de la cual se considera cortocircuito (A). Mismo criterio que la práctica de circuitos. */
  shortCurrent: MAX_SAFE_CURRENT,
  /** Corriente mínima de una pila para considerar el circuito cerrado (A). */
  closedCurrent: 1e-4,
  maxParts: 80,
};

export const SIMPLE_CIRCUIT_LIMITS = {
  emf: [1.0, 1.6] as [number, number],
  internalR: [0.05, 2] as [number, number],
};

/** Ficha de los instrumentos (coincide con la entrada sugerida para INSTRUMENTS). */
export const SIMPLE_CIRCUIT_INSTRUMENTS = {
  voltimetro: { id: 'voltimetro', name: 'Multímetro escolar: voltímetro (rango 20 V)', quantity: 'Voltaje', unit: 'V', resolution: 0.01, sigma: 0.01, relSigma: 0.005, note: 'Contacto de las puntas con los bornes y exactitud del rango (± 0,5 % de la lectura).' },
  amperimetro: { id: 'amperimetro', name: 'Multímetro escolar: amperímetro (rango 10 A)', quantity: 'Corriente', unit: 'A', resolution: 0.001, sigma: 0.002, relSigma: 0.01, note: 'Resistencia de contacto de las puntas y exactitud del rango de 10 A (± 1 % de la lectura).' },
};

/* ------------------------------------------------------------------ bombillo de filamento */

const LAMP_RN = SC.lamp.vRated / SC.lamp.iRated; // 8,33 Ω en caliente
const LAMP_PN = SC.lamp.vRated * SC.lamp.iRated; // 0,75 W
const LAMP_BETA = SC.lamp.alpha / 4; // R ∝ P^β
const T_RATIO = SC.lamp.tRoom / SC.lamp.tRated;
/** Resistencia del filamento frío (a temperatura ambiente). */
export const LAMP_R_COLD = LAMP_RN * T_RATIO ** SC.lamp.alpha;
const LAMP_P_COLD = LAMP_PN * T_RATIO ** 4;

/** Potencia de régimen de un bombillo sometido a un voltaje V (W). */
export function lampPowerAt(v: number): number {
  const v2 = v * v;
  if (v2 / LAMP_R_COLD <= LAMP_P_COLD) return v2 / LAMP_R_COLD;
  return (v2 * LAMP_PN ** LAMP_BETA / LAMP_RN) ** (1 / (1 + LAMP_BETA));
}

/** Resistencia secante del filamento con el voltaje V (Ω). */
export function lampResistanceAt(v: number): number {
  const p = lampPowerAt(v);
  return p <= 0 || v === 0 ? LAMP_R_COLD : (v * v) / p;
}

/** Temperatura del filamento (K) que disipa la potencia P. */
export function filamentTemperature(p: number): number {
  return Math.max(SC.lamp.tRoom, SC.lamp.tRated * Math.max(0, p / LAMP_PN) ** 0.25);
}

/* ------------------------------------------------------------------ álgebra lineal */

/** Eliminación gaussiana con pivoteo parcial. Devuelve null si la matriz es singular. */
export function solveLinear(A: number[][], z: number[]): number[] | null {
  const n = z.length;
  const M = A.map((row, i) => [...row, z[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-30) return null;
    if (piv !== col) [M[piv], M[col]] = [M[col], M[piv]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

/* ------------------------------------------------------------------ resolución del circuito */

export interface PartResult {
  id: string;
  kind: PartKind;
  /** Corriente que atraviesa la pieza de a hacia b (A). En una pila: positiva cuando se descarga. */
  current: number;
  /** Diferencia de potencial Va − Vb (V). */
  voltage: number;
  /** Potencia absorbida (W); en una pila, la potencia que entrega al circuito externo. */
  power: number;
  /** La pieza funciona: bombillo/LED encendido, motor girando, zumbador sonando, pila entregando corriente. */
  on: boolean;
  /** Brillo relativo (bombillo: P/Pₙ; LED: I/20 mA). */
  brightness: number;
  resistance?: number;
  temperature?: number;
  rpm?: number;
  /** Calor disipado dentro de la pila (W). */
  heating?: number;
  /** Voltaje en los bornes de la pila, V+ − V− (V). */
  terminalVoltage?: number;
}

export type CircuitStatus = 'vacio' | 'sin-pila' | 'abierto' | 'cerrado' | 'corto';

export interface MeterResult { id: string; mode: MeterMode; value: number; unit: 'V' | 'A'; connected: boolean }

export interface SimpleCircuitResult {
  status: CircuitStatus;
  short: boolean;
  parts: Record<string, PartResult>;
  nodes: Record<string, number>;
  meter: MeterResult | null;
  cellsInUse: number;
  lampsOn: number;
  warnings: string[];
  iterations: number;
  converged: boolean;
}

export interface SolveOptions { emf?: number; internalR?: number }

type Branch = { g: number; i0: number };

export function solveSimpleCircuit(parts: NetPart[], opts: SolveOptions = {}): SimpleCircuitResult {
  const emf = opts.emf ?? SC.cell.emf;
  const rInt = opts.internalR ?? SC.cell.r;
  assertInRange('La fem de cada pila', emf, ...SIMPLE_CIRCUIT_LIMITS.emf);
  assertInRange('La resistencia interna de cada pila', rInt, ...SIMPLE_CIRCUIT_LIMITS.internalR);
  assertInRange('El número de piezas', parts.length, 0, SC.maxParts);
  const ids = new Set<string>();
  for (const p of parts) {
    if (!(p.kind in PART_INFO)) throw new RangeError(`Tipo de pieza desconocido: ${p.kind}.`);
    if (p.a === p.b) throw new RangeError(`La pieza ${p.id} tiene sus dos terminales en el mismo punto.`);
    if (ids.has(p.id)) throw new RangeError(`Identificador repetido: ${p.id}.`);
    ids.add(p.id);
  }
  if (parts.filter((p) => p.kind === 'multimetro').length > 1) throw new RangeError('Solo hay un multímetro en la mesa.');

  const cells = parts.filter((p) => p.kind === 'pila');
  const empty: SimpleCircuitResult = {
    status: parts.length === 0 ? 'vacio' : 'sin-pila', short: false, parts: {}, nodes: {}, meter: null,
    cellsInUse: 0, lampsOn: 0, warnings: [], iterations: 0, converged: true,
  };
  if (cells.length === 0) return empty;

  // Nodos: los bornes de la mesa más un nodo interno por pila (entre su fem y su resistencia interna).
  const names: string[] = [];
  const index = new Map<string, number>();
  const addNode = (n: string) => { if (!index.has(n)) { index.set(n, names.length); names.push(n); } };
  for (const p of parts) { addNode(p.a); addNode(p.b); }
  for (const c of cells) addNode(`${c.id}#int`);
  const N = names.length - 1; // el primer nodo es la referencia (0 V)
  const M = cells.length;
  const row = (n: string) => (index.get(n) as number) - 1; // −1 = referencia

  // Estados de los elementos no lineales
  const lampR = new Map<string, number>();
  const ledOn = new Map<string, boolean>();
  const motorState = new Map<string, -1 | 0 | 1>();
  const buzzOn = new Map<string, boolean>();
  for (const p of parts) {
    if (p.kind === 'bombillo') lampR.set(p.id, LAMP_RN);
    if (p.kind === 'led') ledOn.set(p.id, false);
    if (p.kind === 'motor') motorState.set(p.id, 0);
    if (p.kind === 'zumbador') buzzOn.set(p.id, false);
  }
  const { motor: mo, led, buzzer } = SC;
  const mRun = mo.rA + (mo.k * mo.k) / mo.b; // resistencia aparente del motor girando
  const mV0 = (mo.k * mo.tauF) / mo.b;
  const mStart = (mo.rA * mo.tauF) / mo.k; // voltaje de arranque

  const branch = (p: NetPart): Branch | null => {
    switch (p.kind) {
      case 'cable': return { g: 1 / SC.wireR, i0: 0 };
      case 'interruptor': return p.closed ? { g: 1 / SC.switchR, i0: 0 } : null;
      case 'bombillo': return { g: 1 / (lampR.get(p.id) as number), i0: 0 };
      case 'resistor': return { g: 1 / SC.resistor, i0: 0 };
      case 'led': return ledOn.get(p.id) ? { g: 1 / led.rS, i0: -led.vOn / led.rS } : null;
      case 'zumbador': return buzzOn.get(p.id) ? { g: 1 / buzzer.rS, i0: -buzzer.vOn / buzzer.rS } : null;
      case 'motor': {
        const s = motorState.get(p.id) as number;
        return s === 0 ? { g: 1 / mo.rA, i0: 0 } : { g: 1 / mRun, i0: (s * mV0) / mRun };
      }
      case 'multimetro': return { g: p.mode === 'A' ? 1 / SC.meter.rA : 1 / SC.meter.rV, i0: 0 };
      case 'clip': case 'moneda': case 'grafito': case 'borrador': case 'plastico':
        return { g: 1 / SC.materials[p.kind], i0: 0 };
      default: return null; // pila: se trata aparte
    }
  };

  let x: number[] = new Array(N + M).fill(0);
  const volt = (n: string) => { const r = row(n); return r < 0 ? 0 : x[r]; };
  let iterations = 0;
  let converged = false;
  {
    for (iterations = 1; iterations <= 300; iterations++) {
      const A = Array.from({ length: N + M }, () => new Array<number>(N + M).fill(0));
      const z = new Array<number>(N + M).fill(0);
      const stampG = (a: string, b: string, g: number) => {
        const ra = row(a), rb = row(b);
        if (ra >= 0) A[ra][ra] += g;
        if (rb >= 0) A[rb][rb] += g;
        if (ra >= 0 && rb >= 0) { A[ra][rb] -= g; A[rb][ra] -= g; }
      };
      const stampI = (a: string, b: string, i0: number) => {
        const ra = row(a), rb = row(b);
        if (ra >= 0) z[ra] -= i0;
        if (rb >= 0) z[rb] += i0;
      };
      for (let k = 0; k < N; k++) A[k][k] += SC.gmin; // gmin: fija los nodos aislados
      for (const p of parts) {
        const br = branch(p);
        if (br) { stampG(p.a, p.b, br.g); stampI(p.a, p.b, br.i0); }
      }
      cells.forEach((c, k) => {
        const int = `${c.id}#int`;
        const rp = row(int), rq = row(c.a), j = N + k;
        if (rp >= 0) { A[rp][j] += 1; A[j][rp] += 1; }
        if (rq >= 0) { A[rq][j] -= 1; A[j][rq] -= 1; }
        z[j] = emf;
        stampG(int, c.b, 1 / rInt);
      });
      const sol = solveLinear(A, z);
      if (!sol) break;
      x = sol;
      // Actualiza los estados y comprueba la coherencia
      let changed = false;
      for (const p of parts) {
        const v = volt(p.a) - volt(p.b);
        if (p.kind === 'bombillo') {
          const old = lampR.get(p.id) as number;
          const target = lampResistanceAt(v);
          const next = old ** 0.2 * target ** 0.8; // amortiguamiento suave (media geométrica ponderada)
          if (Math.abs(next / old - 1) > 1e-11) changed = true;
          lampR.set(p.id, next);
        } else if (p.kind === 'led') {
          const on = v > led.vOn;
          if (on !== ledOn.get(p.id)) { ledOn.set(p.id, on); changed = true; }
        } else if (p.kind === 'zumbador') {
          const on = v > buzzer.vOn;
          if (on !== buzzOn.get(p.id)) { buzzOn.set(p.id, on); changed = true; }
        } else if (p.kind === 'motor') {
          const s: -1 | 0 | 1 = v > mStart ? 1 : v < -mStart ? -1 : 0;
          if (s !== motorState.get(p.id)) { motorState.set(p.id, s); changed = true; }
        }
      }
      if (!changed) { converged = true; break; }
    }
    iterations = Math.min(iterations, 300);
  }

  const nodes: Record<string, number> = {};
  for (const n of names) if (!n.endsWith('#int')) nodes[n] = volt(n);
  const results: Record<string, PartResult> = {};
  const warnings: string[] = [];
  let lampsOn = 0;
  for (const p of parts) {
    const v = volt(p.a) - volt(p.b);
    const base: PartResult = { id: p.id, kind: p.kind, current: 0, voltage: v, power: 0, on: false, brightness: 0 };
    if (p.kind === 'pila') {
      const i = (volt(`${p.id}#int`) - volt(p.b)) / rInt;
      const vt = -v;
      results[p.id] = { ...base, current: i, power: vt * i, on: Math.abs(i) > SC.closedCurrent, heating: i * i * rInt, terminalVoltage: vt, resistance: rInt };
      continue;
    }
    const br = branch(p);
    const i = br ? br.g * v + br.i0 : 0;
    const r: PartResult = { ...base, current: i, power: v * i };
    if (p.kind === 'bombillo') {
      r.resistance = lampR.get(p.id);
      r.temperature = filamentTemperature(r.power);
      r.brightness = r.power / LAMP_PN;
      r.on = r.brightness > 0.02;
      if (r.on) lampsOn++;
      if (Math.abs(v) > SC.lamp.vRated * 1.3) warnings.push(`El bombillo ${p.id} recibe ${fmt(Math.abs(v), 2)} V, mucho más que sus 2,5 V nominales: en un montaje real su filamento se fundiría pronto.`);
    } else if (p.kind === 'led') {
      r.brightness = Math.max(0, i / led.iFull);
      r.on = i > led.iVisible;
      if (i > led.iMax) warnings.push(`Por el ${p.id} pasan ${fmt(i * 1000, 0)} mA (máximo 30 mA): un LED real se dañaría. Conecta un resistor en serie.`);
      if (!r.on && -v > led.vOn) warnings.push(`El ${p.id} está conectado al revés (patica larga hacia el lado negativo): un LED solo conduce en un sentido. Gíralo.`);
    } else if (p.kind === 'motor') {
      const s = motorState.get(p.id) as number;
      const omega = s === 0 ? 0 : (mo.k * i - s * mo.tauF) / mo.b;
      r.rpm = (omega * 60) / (2 * Math.PI);
      r.on = s !== 0;
      r.brightness = 0;
    } else if (p.kind === 'zumbador') {
      r.on = i > buzzer.iSound;
      r.brightness = Math.max(0, i / 0.02);
      if (!r.on && -v > buzzer.vOn) warnings.push(`El zumbador ${p.id} está al revés: tiene polaridad (+ y −) y no suena así. Gíralo.`);
    } else if (p.kind === 'interruptor') {
      r.on = !!p.closed;
    } else {
      r.on = Math.abs(i) > SC.closedCurrent;
    }
    if (br) r.resistance ??= p.kind === 'motor' ? undefined : 1 / br.g;
    results[p.id] = r;
  }

  let cellsInUse = 0, short = false, anyClosed = false;
  for (const c of cells) {
    const res = results[c.id];
    if (res.on) cellsInUse++;
    if (Math.abs(res.current) > SC.closedCurrent) anyClosed = true;
    if (Math.abs(res.current) > SC.shortCurrent) short = true;
    if (res.current < -0.01 && Math.abs(res.current) <= SC.shortCurrent) warnings.push(`La pila ${c.id} está siendo forzada en sentido contrario (está al revés respecto a las demás): se resta en vez de sumar y se puede dañar.`);
  }
  if (short) {
    const worst = Math.max(...cells.map((c) => Math.abs(results[c.id].current)));
    warnings.unshift(`¡Cortocircuito! Una pila entrega ${fmt(worst, 1)} A por un camino casi sin resistencia: se calienta, se descarga en minutos y puede derramar su electrolito. Desconecta el cable que une sus bornes.`);
    const meter = parts.find((p) => p.kind === 'multimetro' && p.mode === 'A');
    if (meter && Math.abs(results[meter.id].current) > SC.shortCurrent) warnings.push('El amperímetro está conectado en paralelo con la fuente: tiene muy poca resistencia y produce un cortocircuito. El amperímetro siempre va en serie.');
  }

  let meter: MeterResult | null = null;
  const mp = parts.find((p) => p.kind === 'multimetro');
  if (mp) {
    const touches = (n: string) => parts.some((q) => q.id !== mp.id && (q.a === n || q.b === n));
    const mode = mp.mode ?? 'V';
    meter = { id: mp.id, mode, unit: mode, value: mode === 'V' ? results[mp.id].voltage : results[mp.id].current, connected: touches(mp.a) && touches(mp.b) };
  }

  const status: CircuitStatus = short ? 'corto' : anyClosed ? 'cerrado' : 'abierto';
  if (status === 'abierto') warnings.push('El circuito está abierto: no hay un camino cerrado de un borne de la pila al otro.');
  if (!converged) warnings.push('El cálculo no terminó de converger; los valores son aproximados.');
  return { status, short, parts: results, nodes, meter, cellsInUse, lampsOn, warnings, iterations, converged };
}

export type LampArrangement = 'sin bombillos' | 'serie' | 'paralelo' | 'mixta';

/**
 * Conexión de los bombillos entre sí. Los bornes unidos por cables, interruptores cerrados o el amperímetro
 * forman un mismo nodo eléctrico. Un solo bombillo cuenta como «serie» (está en serie con la pila).
 */
export function lampArrangement(parts: NetPart[]): LampArrangement {
  const parent = new Map<string, string>();
  const find = (n: string): string => { let r = n; while (parent.has(r)) r = parent.get(r) as string; return r; };
  const join = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const p of parts) if (p.kind === 'cable' || (p.kind === 'interruptor' && p.closed) || (p.kind === 'multimetro' && p.mode === 'A')) join(p.a, p.b);
  const lamps = parts.filter((p) => p.kind === 'bombillo').map((p) => [find(p.a), find(p.b)].sort());
  if (lamps.length === 0) return 'sin bombillos';
  if (lamps.length === 1) return 'serie';
  if (lamps.every((l) => l[0] === lamps[0][0] && l[1] === lamps[0][1])) return 'paralelo';
  // Serie: los bombillos forman una cadena y en cada nodo intermedio solo se tocan dos bombillos (nada más).
  const deg = new Map<string, number>();
  for (const l of lamps) for (const n of l) deg.set(n, (deg.get(n) ?? 0) + 1);
  const others = parts.filter((p) => p.kind !== 'bombillo' && p.kind !== 'cable' && !(p.kind === 'interruptor' && p.closed) && !(p.kind === 'multimetro' && p.mode === 'A'));
  const touched = new Set(others.flatMap((p) => [find(p.a), find(p.b)]));
  const ends = [...deg.values()].filter((d) => d === 1).length;
  const inner = [...deg.entries()].filter(([, d]) => d === 2);
  const chain = ends === 2 && inner.length === lamps.length - 1 && [...deg.values()].every((d) => d <= 2) && inner.every(([n]) => !touched.has(n));
  return chain ? 'serie' : 'mixta';
}

/** Lectura del multímetro redondeada a su resolución (0,01 V o 0,001 A). */
export function meterReading(m: MeterResult): number {
  const spec = m.mode === 'V' ? SIMPLE_CIRCUIT_INSTRUMENTS.voltimetro : SIMPLE_CIRCUIT_INSTRUMENTS.amperimetro;
  return roundToResolution(m.value, spec.resolution);
}

export const simpleCircuitModelSpec: ModelSpec = {
  name: 'Circuitos simples de corriente continua resueltos por análisis nodal modificado',
  inputs: [
    { symbol: 'montaje', name: 'Piezas y cables colocados en la mesa de bornes (netlist)', unit: '—', initial: 'una pila, un interruptor abierto y un bombillo' },
    { symbol: 'ε', name: 'fem de cada pila AA', unit: 'V', range: SIMPLE_CIRCUIT_LIMITS.emf, initial: SC.cell.emf },
    { symbol: 'r', name: 'Resistencia interna de cada pila', unit: 'Ω', range: SIMPLE_CIRCUIT_LIMITS.internalR, initial: SC.cell.r },
    { symbol: 'S', name: 'Estado de cada interruptor', unit: '—', initial: 'abierto' },
  ],
  outputs: [
    { symbol: 'V', name: 'Voltaje entre dos bornes (voltímetro)', unit: 'V' },
    { symbol: 'I', name: 'Corriente en serie (amperímetro)', unit: 'A' },
    { symbol: 'P', name: 'Potencia de cada bombillo (brillo)', unit: 'W' },
    { symbol: 'T', name: 'Temperatura del filamento', unit: 'K' },
    { symbol: 'n', name: 'Rapidez del motor', unit: 'rpm' },
  ],
  equations: [
    'Análisis nodal modificado: [G B; Bᵀ 0]·[v; j] = [i; ε] (ley de nodos en cada borne + ecuación de cada pila)',
    'Pila real: V_bornes = ε − I·r',
    'Ley de Ohm en resistores, cables (0,01 Ω), interruptor cerrado (0,02 Ω) y materiales: I = V/R',
    'Bombillo: R = Rₙ·(T/Tₙ)^1,2 y P = Pₙ·(T/Tₙ)⁴  ⇒  R = Rₙ·(P/Pₙ)^0,3, con Rₙ = 8,33 Ω, Pₙ = 0,75 W, Tₙ = 2700 K',
    'LED: I = (V − 1,8 V)/15 Ω si V > 1,8 V; I = 0 en otro caso (no conduce al revés)',
    'Motor: V = I·Rₐ + k·ω;  k·I = b·ω + τ_f  (ω = 0 si k·|I| < τ_f)',
    'Multímetro: voltímetro de 10 MΩ en paralelo; amperímetro de 0,1 Ω en serie',
    'Cortocircuito: corriente de una pila mayor que 3 A',
  ],
  initialConditions: ['Una pila AA de 1,5 V (r = 0,2 Ω), un interruptor abierto, un bombillo de linterna y el multímetro como amperímetro en serie.'],
  assumptions: [
    'Corriente continua en régimen estacionario: los bombillos ya alcanzaron su temperatura y el motor su rapidez final.',
    'Cada pila es una fuente de fem constante con resistencia interna constante; no se modela su descarga ni su calentamiento progresivo.',
    'El filamento se enfría solo por radiación (P ∝ T⁴) y su resistencia crece como T^1,2 (tungsteno); el brillo se toma proporcional a la potencia.',
    'El LED y el zumbador se describen con un voltaje umbral y una resistencia en serie (modelo lineal por tramos); al revés no conducen.',
    'El motor es de imán permanente: fuerza contraelectromotriz proporcional a la rapidez, fricción seca y viscosa constantes, sin carga en el eje.',
    'Los cables, los contactos del interruptor y los materiales metálicos tienen resistencias pequeñas pero no nulas; los aislantes, 10¹² Ω.',
  ],
  limits: [
    'No se simulan transitorios: el encendido del bombillo (pico de corriente en frío), el arranque del motor ni la carga de capacitores.',
    'Las pilas no se agotan ni se dañan, y los bombillos o LED sobrecargados no se funden: solo se advierte.',
    'El brillo real de un bombillo crece más rápido que su potencia (la eficiencia luminosa depende de la temperatura); el brillo mostrado es una aproximación.',
    'La clasificación de materiales en conductores y aislantes usa resistencias típicas; el grafito real varía mucho según la mina.',
    'Los valores de los componentes son típicos de equipos escolares, no de un modelo comercial concreto.',
  ],
  testCases: [
    'Una pila (1,5 V; 0,2 Ω) y un resistor de 100 Ω: I = 1,5/(100 + 0,2 + cables) coincide con la ley de Ohm.',
    'Dos bombillos en serie: la misma corriente en ambos y menos brillo que uno solo; en paralelo: el mismo voltaje y más brillo.',
    'Al quitar un bombillo en serie el circuito se abre; en paralelo el otro sigue encendido.',
    'Un cable entre los bornes de una pila: cortocircuito con I ≈ ε/(r + 0,01 Ω) ≈ 7,1 A.',
    'LED con resistor de 100 Ω y dos pilas: ≈ 10 mA; al revés: 0 A.',
    'Interruptor abierto: corriente nula y el voltímetro sobre el interruptor lee la fem.',
    'Ley de nodos: la suma de corrientes en cada borne es cero.',
  ],
};

/* ------------------------------------------------------------------ condiciones y correcciones */

/** Nivel y corrección de cada advertencia de `solveSimpleCircuit`, con los mismos umbrales del modelo. */
export function simpleCircuitConditions(warnings: readonly string[]): ModelCondition[] {
  const id = (text: string, re: RegExp) => re.exec(text)?.[1] ?? '';
  const flip = (pid: string) => `Selecciona el ${pid} en la mesa y pulsa «Girar ${pid} (invertir polaridad)».`;
  return classifyWarnings(warnings, [
    {
      match: /^¡Cortocircuito!/, level: 'invalido',
      fix: 'Quita el cable que une directamente los bornes de la pila, o pon en ese camino un bombillo, un resistor u otro elemento que limite la corriente.',
    },
    {
      match: /^El bombillo (\S+) recibe/, level: 'invalido',
      fix: (t) => `Quita una pila o conecta otro bombillo en serie con el ${id(t, /^El bombillo (\S+)/)}: así recibe como máximo ${num(SC.lamp.vRated * 1.3, 2)} V (nominal ${num(SC.lamp.vRated, 1)} V).`,
    },
    {
      match: /^Por el (\S+) pasan .* mA \(máximo 30 mA\)/, level: 'invalido',
      fix: (t) => `Conecta un resistor en serie con el ${id(t, /^Por el (\S+)/)} (o quita una pila) hasta que pasen ${num(SC.led.iMax * 1000)} mA o menos.`,
    },
    { match: /^El (\S+) está conectado al revés/, level: 'advertencia', fix: (t) => flip(id(t, /^El (\S+)/)) },
    { match: /^El zumbador (\S+) está al revés/, level: 'advertencia', fix: (t) => flip(id(t, /^El zumbador (\S+)/)) },
    {
      match: /^La pila (\S+) está siendo forzada/, level: 'advertencia',
      fix: (t) => `${flip(id(t, /^La pila (\S+)/))} Así su borne + queda del mismo lado que el de las demás pilas.`,
    },
    {
      match: 'El amperímetro está conectado en paralelo', level: 'invalido',
      fix: 'Pon el multímetro en serie: abre el circuito en un punto y conecta sus dos puntas allí, para que toda la corriente pase por él. Para medir voltaje entre dos puntos, cambia el modo a voltímetro.',
    },
    { match: 'El circuito está abierto', level: 'advertencia', fix: 'Cierra el interruptor y revisa que los cables formen un camino continuo de un borne de la pila al otro.' },
    { match: 'El cálculo no terminó de converger', level: 'nota' },
  ]);
}

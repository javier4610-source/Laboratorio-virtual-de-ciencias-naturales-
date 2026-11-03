import { assertInRange, R_GAS, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Estados de la materia y curva de calentamiento del agua (grado 6.º).
 *
 * Una masa m de agua (hielo al empezar si T₀ < 0 °C) se calienta con una potencia constante P. Toda la energía va al
 * agua (sin pérdidas), así que la energía entregada es Q = P·t y la curva T(Q) tiene cinco tramos:
 *   hielo:   Q = m·c_hielo·(0 − T₀)             fusión:   Q = m·L_f   (meseta a 0 °C)
 *   líquido: Q = m·c_agua·(T_eb − 0)            ebullición: Q = m·L_v (meseta a T_eb)
 *   vapor:   Q = m·c_vapor·(T − T_eb)
 * Calores específicos (Serway y Jewett, Física para ciencias e ingeniería, tabla 20.1): hielo 2090, agua 4186 → 4,18 (el
 * mismo valor que la práctica «Calor»), vapor 2010 J/(kg·°C). Calores latentes a partir de las entalpías molares del NIST
 * Chemistry WebBook (agua, CAS 7732-18-5): ΔfusH = 6,01 kJ/mol y ΔvapH(100 °C) = 40,65 kJ/mol, con M = 18,015 g/mol:
 * L_f = 334 J/g y L_v = 2256 J/g (las tablas de vapor dan 2256,4 J/g a 100 °C; la tabla 20.2 de Serway, 3,33 × 10⁵ y
 * 2,26 × 10⁶ J/kg; el plan curricular decía 2257 J/g y se corrigió a 2256 al verificar la cifra).
 *
 * Temperatura de ebullición según la presión: ecuación de saturación de la IAPWS-IF97 (ecuación 31, T_s(p)), válida de
 * 611 Pa a 22,064 MPa. Presión con la altitud: atmósfera estándar internacional (ISA, ISO 2533), como en «Presión».
 * La temperatura de fusión casi no cambia con la presión (−0,0074 °C por atmósfera): el modelo la deja en 0 °C.
 * Este archivo no depende de React ni del navegador.
 */

export const C_ICE = 2.09; // J/(g·°C)
export const C_WATER = 4.18; // J/(g·°C)
export const C_STEAM = 2.01; // J/(g·°C)
export const M_WATER = 18.015; // g/mol
export const DH_FUS = 6.01; // kJ/mol (NIST WebBook)
export const DH_VAP = 40.65; // kJ/mol a 100 °C (NIST WebBook)
export const L_FUS = Math.round((DH_FUS * 1000) / M_WATER); // 334 J/g
export const L_VAP = Math.round((DH_VAP * 1000) / M_WATER); // 2256 J/g
export const T_MELT = 0; // °C

export const SM_LIMITS = {
  mass: [50, 500] as [number, number], // g
  power: [100, 1000] as [number, number], // W
  t0: [-30, 25] as [number, number], // °C
  tEnd: [60, 150] as [number, number], // °C
};
export const THERMOMETER = { resolution: 0.1 }; // °C
export const STOPWATCH = { resolution: 1 }; // s
export const BALANCE = { resolution: 0.1 }; // g

/* ------------------------------------------------------------------ presión y ebullición */

/** Coeficientes n₁…n₁₀ de la región 4 de la IAPWS-IF97 (línea de saturación). */
const N = [0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2, 0.12020824702470e5, -0.32325550322333e7, 0.14915108613530e2,
  -0.48232657361591e4, 0.40511340542057e6, -0.23855557567849, 0.65017534844798e3];
/** Temperatura de saturación del agua (K) a la presión p (Pa). IAPWS-IF97, ecuación 31. */
export function saturationTemperatureK(pPa: number): number {
  assertInRange('La presión', pPa, 611.213, 22.064e6);
  const b = (pPa / 1e6) ** 0.25;
  const E = b * b + N[2] * b + N[5];
  const F = N[0] * b * b + N[3] * b + N[6];
  const G = N[1] * b * b + N[4] * b + N[7];
  const D = (2 * G) / (-F - Math.sqrt(F * F - 4 * E * G));
  return (N[9] + D - Math.sqrt((N[9] + D) ** 2 - 4 * (N[8] + N[9] * D))) / 2;
}
export const boilingPointC = (pPa: number) => saturationTemperatureK(pPa) - 273.15;

/** Presión de la atmósfera estándar (ISA, troposfera) a la altitud h (m): p = p₀·(1 − L·h/T₀)^(g·M/(R·L)). */
export const ISA = { p0: 101325, T0: 288.15, L: 0.0065, g: 9.80665, M: 0.0289644, R: 8.3144598 };
export function isaPressure(hM: number): number {
  assertInRange('La altitud', hM, -400, 11000);
  return ISA.p0 * (1 - (ISA.L * hM) / ISA.T0) ** ((ISA.g * ISA.M) / (ISA.R * ISA.L));
}

export interface Place { id: string; name: string; altitude: number | null; /** Presión absoluta fija (olla a presión). */ pressure?: number }
/** Altitudes aproximadas de las cabeceras municipales (IGAC); la olla a presión suma ≈ 1 bar manométrico (valor típico de etiqueta). */
export const PLACES: Place[] = [
  { id: 'apartado', name: 'Apartadó (≈ 30 m)', altitude: 30 },
  { id: 'medellin', name: 'Medellín (≈ 1495 m)', altitude: 1495 },
  { id: 'bogota', name: 'Bogotá (≈ 2640 m)', altitude: 2640 },
  { id: 'nevado', name: 'Nevado del Ruiz, cumbre (≈ 5300 m)', altitude: 5300 },
  { id: 'olla', name: 'Olla a presión en Apartadó (≈ 1 bar sobre la atmósfera)', altitude: null, pressure: isaPressure(30) + 1.0e5 },
];
export function findPlace(id: string): Place {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new RangeError(`Lugar desconocido: ${id}`);
  return p;
}
export const placePressure = (p: Place) => p.pressure ?? isaPressure(p.altitude ?? 0);

/* ------------------------------------------------------------------ curva de calentamiento */

export type Phase = 'solido' | 'fusion' | 'liquido' | 'ebullicion' | 'vapor';
export const PHASE_NAME: Record<Phase, string> = {
  solido: 'hielo (sólido) que se calienta', fusion: 'fusión: hielo y agua líquida a la vez', liquido: 'agua líquida que se calienta',
  ebullicion: 'ebullición: agua líquida y vapor a la vez', vapor: 'vapor (gas) que se calienta',
};

export interface CurveInput { mass: number; power: number; t0: number; tEnd: number; place: string }
export interface Segment { phase: Phase; q0: number; q1: number; tA: number; tB: number }
export interface Curve {
  input: CurveInput;
  pressure: number; // Pa
  tBoil: number; // °C
  segments: Segment[];
  qTotal: number; // J
  timeTotal: number; // s
}

export function heatingCurve(i: CurveInput): Curve {
  assertInRange('La masa', i.mass, SM_LIMITS.mass[0], SM_LIMITS.mass[1]);
  assertInRange('La potencia', i.power, SM_LIMITS.power[0], SM_LIMITS.power[1]);
  assertInRange('La temperatura inicial', i.t0, SM_LIMITS.t0[0], SM_LIMITS.t0[1]);
  assertInRange('La temperatura final', i.tEnd, SM_LIMITS.tEnd[0], SM_LIMITS.tEnd[1]);
  const pressure = placePressure(findPlace(i.place));
  const tBoil = boilingPointC(pressure);
  const m = i.mass;
  const segs: Segment[] = [];
  let q = 0;
  const push = (phase: Phase, dq: number, tA: number, tB: number) => { if (dq > 0) segs.push({ phase, q0: q, q1: q + dq, tA, tB }); q += dq; };
  if (i.t0 < T_MELT) {
    push('solido', m * C_ICE * (T_MELT - i.t0), i.t0, T_MELT);
    push('fusion', m * L_FUS, T_MELT, T_MELT);
  }
  const tLiq0 = Math.max(i.t0, T_MELT);
  const tTop = Math.min(i.tEnd, tBoil);
  if (tTop > tLiq0) push('liquido', m * C_WATER * (tTop - tLiq0), tLiq0, tTop);
  if (i.tEnd > tBoil) {
    push('ebullicion', m * L_VAP, tBoil, tBoil);
    push('vapor', m * C_STEAM * (i.tEnd - tBoil), tBoil, i.tEnd);
  }
  return { input: i, pressure, tBoil, segments: segs, qTotal: q, timeTotal: q / i.power };
}

export interface CurveState {
  q: number; t: number; T: number; phase: Phase;
  /** Fracciones de la masa en cada estado (suman 1). */
  solid: number; liquid: number; gas: number;
}
/** Estado del agua cuando se han entregado Q julios (o al tiempo t = Q/P). */
export function stateAtQ(c: Curve, qIn: number): CurveState {
  const q = Math.min(Math.max(0, qIn), c.qTotal);
  const t = q / c.input.power;
  const first = c.segments[0];
  const base = (phase: Phase, T: number, solid: number, liquid: number, gas: number): CurveState => ({ q, t, T, phase, solid, liquid, gas });
  if (!first) return base('liquido', c.input.t0, 0, 1, 0);
  for (const s of c.segments) {
    if (q <= s.q1 + 1e-9) {
      const f = s.q1 > s.q0 ? (q - s.q0) / (s.q1 - s.q0) : 1;
      const T = s.tA + f * (s.tB - s.tA);
      switch (s.phase) {
        case 'solido': return base('solido', T, 1, 0, 0);
        case 'fusion': return base('fusion', T, 1 - f, f, 0);
        case 'liquido': return base('liquido', T, 0, 1, 0);
        case 'ebullicion': return base('ebullicion', T, 0, 1 - f, f);
        default: return base('vapor', T, 0, 0, 1);
      }
    }
  }
  const last = c.segments[c.segments.length - 1];
  return stateAtQ(c, last.q1);
}
export const stateAtTime = (c: Curve, tS: number) => stateAtQ(c, tS * c.input.power);

/** Duración (s) de la meseta de un cambio de estado, y el calor latente que se deduce de ella: L = P·Δt/m. */
export function plateau(c: Curve, phase: 'fusion' | 'ebullicion'): { duration: number; latent: number } | null {
  const s = c.segments.find((x) => x.phase === phase);
  if (!s) return null;
  const duration = (s.q1 - s.q0) / c.input.power;
  return { duration, latent: (c.input.power * duration) / c.input.mass };
}

/** Rapidez cuadrática media de las moléculas de agua: v = √(3RT/M) (teoría cinética; m/s). */
export const vRms = (tC: number) => Math.sqrt((3 * R_GAS * (tC + 273.15)) / (M_WATER / 1000));

/* ------------------------------------------------------------------ partículas (vista 3D y banco) */

export const BOX = 4; // lado de la caja de partículas (unidades de la escena)
export const LATTICE_N = 3; // red de 3 × 3 × 3 = 27 partículas
export const N_PARTICLES = LATTICE_N ** 3;

/**
 * Posiciones de las 27 partículas de la caja para el estado `s` y la fase de animación `phase` (s reales), puras y
 * reproducibles. Cada partícula tiene un «destino»: las primeras ⌈solid·N⌉ siguen en la red; las siguientes se sueltan
 * al líquido (amontonadas en el fondo) y las últimas ⌈gas·N⌉ vuelan libres por la caja. La amplitud de la vibración y la
 * rapidez del movimiento crecen con √T (absoluta): en una meseta la temperatura no cambia, así que la agitación tampoco;
 * lo que cambia es cuántas partículas dejaron la red o el líquido. Ilustración: tamaños y rapideces no están a escala.
 */
export function particlePositions(s: Pick<CurveState, 'T' | 'solid' | 'gas'>, phase: number): { pos: [number, number, number][]; kind: ('red' | 'liquido' | 'gas')[]; amplitude: number } {
  const rnd = seededRandom(7);
  const seeds = Array.from({ length: N_PARTICLES }, () => [rnd(), rnd(), rnd(), rnd(), rnd(), rnd()]);
  const nSolid = Math.round(s.solid * N_PARTICLES);
  const nGas = Math.round(s.gas * N_PARTICLES);
  const kT = Math.sqrt((s.T + 273.15) / 273.15); // 1 a 0 °C
  const amplitude = 0.09 * kT;
  const h = BOX / 2;
  const pos: [number, number, number][] = [];
  const kind: ('red' | 'liquido' | 'gas')[] = [];
  const sp = 1.05; // separación de la red
  const liquidLayers = Math.ceil((N_PARTICLES - nSolid - nGas) / 16) * (nSolid > 0 ? 1 : 0);
  for (let k = 0; k < N_PARTICLES; k++) {
    const [a, b, c, d, e, f] = seeds[k];
    const ix = k % 3, iy = Math.floor(k / 3) % 3, iz = Math.floor(k / 9);
    // las partículas de arriba de la red son las primeras en soltarse: orden por altura (iz alto primero en fundirse)
    const rank = iz * 9 + iy * 3 + ix; // 0 = la más baja: las de arriba se sueltan primero
    const w = (x: number, y: number) => Math.sin(phase * (5 + 3 * x) + 6.28 * y);
    if (rank < nSolid) {
      // el hielo flota: la red queda encima de las capas de líquido que ya se formaron
      pos.push([(ix - 1) * sp + amplitude * w(a, b), -h + 0.55 + liquidLayers * 0.9 + iz * sp + amplitude * w(c, d), (iy - 1) * sp + amplitude * w(e, f)]);
      kind.push('red');
    } else if (rank >= N_PARTICLES - nGas) {
      // gas: rebota en las paredes con rapidez ∝ √T (trayectoria triangular = rebote elástico)
      const v = 0.9 * kT;
      const tri = (x0: number, vel: number) => { const L = BOX - 0.4; const u = (((x0 * L + vel * phase) % (2 * L)) + 2 * L) % (2 * L); return (u < L ? u : 2 * L - u) - L / 2; };
      pos.push([tri(a, v * (0.6 + b)), tri(c, v * (0.5 + d)), tri(e, v * (0.7 + f))]);
      kind.push('gas');
    } else {
      // líquido: amontonado en el fondo, desordenado y deslizándose (sin red)
      const m = rank - nSolid;
      const cols = 4;
      const lx = ((m % cols) - 1.5) * 0.95 + 0.25 * (a - 0.5);
      const lz = ((Math.floor(m / cols) % cols) - 1.5) * 0.95 + 0.25 * (b - 0.5);
      const ly = -h + 0.5 + Math.floor(m / (cols * cols)) * 0.9 + 0.2 * c;
      const drift = 1.6 * amplitude;
      pos.push([lx + drift * w(d, e), ly + 0.5 * drift * Math.abs(w(e, f)), lz + drift * w(f, a)]);
      kind.push('liquido');
    }
  }
  return { pos, kind, amplitude };
}

/* ------------------------------------------------------------------ avisos */

export interface SmCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function curveConditions(i: CurveInput): SmCondition[] {
  const c = heatingCurve(i);
  const out: SmCondition[] = [];
  if (i.tEnd > c.tBoil && i.place !== 'olla') out.push({ level: 'nota', text: `Por encima de ${c.tBoil.toFixed(1).replace('.', ',')} °C el agua de un vaso abierto se escapa como vapor: el último tramo supone que el vapor se calienta en un recipiente cerrado con salida (no se puede hacer con el vaso del colegio).`, fix: `Baja la temperatura final hasta la de ebullición (${c.tBoil.toFixed(1).replace('.', ',')} °C) para trabajar con el vaso abierto, o lee el último tramo como una predicción del modelo.` });
  if (i.t0 >= T_MELT) out.push({ level: 'nota', text: 'Empiezas con agua líquida: la curva no tiene la meseta de la fusión.', fix: 'Pon la temperatura inicial bajo 0 °C (hielo del congelador, unos −18 °C) para ver las dos mesetas.' });
  if (i.place === 'olla') out.push({ level: 'nota', text: `En la olla a presión el agua soporta ≈ ${(c.pressure / 1e5).toFixed(2).replace('.', ',')} bar y hierve a ${c.tBoil.toFixed(1).replace('.', ',')} °C: por eso cocina más rápido.`, fix: 'Nunca abras una olla a presión caliente: espera a que salga todo el vapor por la válvula.' });
  if (c.timeTotal > 3600) out.push({ level: 'advertencia', text: `Con ${i.power} W calentar ${i.mass} g tardaría ${(c.timeTotal / 60).toFixed(0)} min: más que una clase.`, fix: 'Usa menos agua o una parrilla de más potencia.' });
  return out;
}

export const statesOfMatterSpec: ModelSpec = {
  name: 'Curva de calentamiento del agua: calor sensible, calores latentes y ebullición con la presión',
  inputs: [
    { symbol: 'm', name: 'Masa de agua (hielo al empezar si T₀ < 0 °C)', unit: 'g', range: SM_LIMITS.mass, initial: 200 },
    { symbol: 'P', name: 'Potencia de la parrilla (toda llega al agua)', unit: 'W', range: SM_LIMITS.power, initial: 500 },
    { symbol: 'T₀', name: 'Temperatura inicial', unit: '°C', range: SM_LIMITS.t0, initial: -20 },
    { symbol: 'T_f', name: 'Temperatura final', unit: '°C', range: SM_LIMITS.tEnd, initial: 110 },
    { symbol: 'lugar', name: 'Lugar (altitud) u olla a presión', unit: '—', initial: 'Apartadó' },
  ],
  outputs: [
    { symbol: 'T(t)', name: 'Temperatura del agua en el tiempo', unit: '°C' },
    { symbol: 'Δt', name: 'Duración de cada meseta', unit: 's' },
    { symbol: 'T_eb', name: 'Temperatura de ebullición a la presión del lugar', unit: '°C' },
    { symbol: 'fracciones', name: 'Fracción de sólido, líquido y gas', unit: '—' },
  ],
  equations: [
    'Q = P·t;   Q = m·c·ΔT (calor sensible);   Q = m·L (cambio de estado, a temperatura constante)',
    'c_hielo = 2,09; c_agua = 4,18; c_vapor = 2,01 J/(g·°C);   L_f = 334 J/g;   L_v = 2256 J/g',
    'T_eb = T_s(p) (IAPWS-IF97, ec. 31);   p(h) = 101 325 Pa·(1 − 0,0065·h/288,15)^5,256 (ISA)',
    'v_rms = √(3RT/M) (rapidez media de las moléculas)',
  ],
  initialConditions: ['200 g de hielo a −20 °C en un vaso sobre una parrilla de 500 W, en Apartadó (≈ 30 m: 1009,7 hPa).'],
  assumptions: [
    'Toda la potencia de la parrilla llega al agua (sin pérdidas al aire ni al vaso) y el agua se mezcla bien (una sola temperatura).',
    'Los calores específicos se toman constantes en cada estado; la temperatura de fusión es 0 °C a cualquier presión de la práctica.',
    'Las partículas de la vista 3D son una ilustración: 27 partículas, tamaños y rapideces sin escala; su agitación sigue a √T.',
  ],
  limits: [
    'En un vaso abierto el vapor se escapa: el tramo del vapor que se calienta supone un recipiente cerrado.',
    'Una parrilla real pierde calor: el tiempo medido es mayor que el calculado y las mesetas se ven algo redondeadas.',
    'El hielo del congelador puede tener aire y sales; el agua de la llave tiene sales que suben un poco la temperatura de ebullición.',
  ],
  testCases: [
    '200 g de hielo a −20 °C, 500 W, Apartadó: 8 360 J (16,7 s) para llegar a 0 °C; meseta de fusión 66 800 J = 133,6 s; meseta de ebullición 451 200 J = 902,4 s.',
    'T_eb(101 325 Pa) = 99,97 °C (IAPWS-IF97); a 1 bar, 99,61 °C; Apartadó (1009,7 hPa) 99,87 °C; Bogotá (2640 m, 733,8 hPa) 91,2 °C.',
    'L = P·Δt/m reproduce 334 J/g y 2256 J/g a partir de la duración de las mesetas.',
  ],
};

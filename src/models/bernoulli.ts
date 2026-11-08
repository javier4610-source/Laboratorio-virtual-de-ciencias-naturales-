import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Fluidos en movimiento: continuidad y Bernoulli (grado 10.º).
 *
 * Fluido IDEAL: incompresible, sin viscosidad, flujo estacionario y a lo largo de una línea de corriente.
 * 1) Continuidad (conservación de la masa): Q = A₁·v₁ = A₂·v₂  →  v₂ = v₁·(D₁/D₂)².
 * 2) Bernoulli (conservación de la energía por unidad de volumen): p + ½ρv² + ρgh = constante.
 *    Tubo de Venturi horizontal: Δp = p₁ − p₂ = ½ρ(v₂² − v₁²); en los piezómetros (tubos abiertos) la columna baja
 *    Δh = (v₂² − v₁²)/(2g). Medidor de caudal: Q = A₂·√[2gΔh / (1 − (A₂/A₁)²)].
 * 3) Atomizador: el aire que pasa rápido sobre la boca de un pitillo baja la presión ½ρ_aire·v²; el líquido sube
 *    h = ½ρ_aire·v²/(ρ_líquido·g).
 * Número de Reynolds Re = ρvD/μ (solo para avisar si el flujo real sería turbulento: Bernoulli ideal no lo incluye).
 *
 * Datos (20 °C): agua ρ = 998,2 kg/m³ y μ = 1,002 mPa·s; etanol ρ = 789,3 kg/m³ (CRC Handbook of Chemistry and
 * Physics); aire seco a 101,325 kPa ρ = 1,204 kg/m³. g = 9,78 m/s² en Urabá. Este archivo no depende de React.
 */

export const RHO_WATER = 998.2; // kg/m³, 20 °C (CRC)
export const MU_WATER = 1.002e-3; // Pa·s, 20 °C (CRC)
export const RHO_ETHANOL = 789.3; // kg/m³, 20 °C (CRC)
export const RHO_AIR = 1.204; // kg/m³, aire seco a 20 °C y 101,325 kPa
export const G = 9.78; // m/s², Urabá
export const HOSE_D = 12.7; // mm, manguera de ½ pulgada (diámetro interno típico, ilustrativo)
export const VENTURI_D1 = 25; // mm, tubo de entrada del Venturi (ilustrativo)
export const H1 = 0.6; // m, columna del piezómetro de entrada (ilustrativa: depende de la presión del sistema)

export const FL_LIMITS = { bucketTime: [10, 120] as [number, number], nozzle: [2, 12.7] as [number, number], throat: [6, 25] as [number, number], flow: [0.05, 1] as [number, number], air: [0, 40] as [number, number], straw: [0.5, 10] as [number, number] };

export const area = (dMm: number) => Math.PI * (dMm / 2000) ** 2; // m²

/* ------------------------------------------------------------------ continuidad */

export interface HoseResult { Q: number; A1: number; A2: number; v1: number; v2: number; ratio: number }
/** Manguera: se llena un balde de `liters` L en `seconds` s; la boquilla tiene diámetro `nozzleMm`. */
export function hose(liters: number, seconds: number, nozzleMm: number, hoseMm = HOSE_D): HoseResult {
  assertInRange('El tiempo de llenado', seconds, 1, 1e4);
  assertInRange('El diámetro de la boquilla', nozzleMm, 0.5, hoseMm);
  const Q = liters / 1000 / seconds;
  const A1 = area(hoseMm), A2 = area(nozzleMm);
  return { Q, A1, A2, v1: Q / A1, v2: Q / A2, ratio: A1 / A2 };
}

/* ------------------------------------------------------------------ Venturi */

export interface VenturiResult {
  Q: number; A1: number; A2: number; v1: number; v2: number;
  dp: number; dh: number; h1: number; h2: number; h3: number;
  re1: number; re2: number; flowFromDh: number;
  energy1: number; energy2: number;
}
/** Tubo de Venturi horizontal con agua: caudal `qLs` (L/s), entrada `d1` y garganta `d2` (mm). */
export function venturi(qLs: number, d1: number, d2: number, h1 = H1, rho = RHO_WATER, mu = MU_WATER): VenturiResult {
  assertInRange('El caudal', qLs, 1e-4, 100);
  assertInRange('El diámetro de la garganta', d2, 0.5, d1);
  const Q = qLs / 1000;
  const A1 = area(d1), A2 = area(d2);
  const v1 = Q / A1, v2 = Q / A2;
  const dp = 0.5 * rho * (v2 ** 2 - v1 ** 2);
  const dh = (v2 ** 2 - v1 ** 2) / (2 * G);
  const h2 = h1 - dh;
  const flowFromDh = dh > 0 ? A2 * Math.sqrt((2 * G * dh) / (1 - (A2 / A1) ** 2)) : 0;
  // Energía por unidad de volumen (presión manométrica + cinética), en Pa: debe ser igual en 1 y en 2.
  const p1 = rho * G * h1, p2 = rho * G * h2;
  return { Q, A1, A2, v1, v2, dp, dh, h1, h2, h3: h1, re1: (rho * v1 * d1) / 1000 / mu, re2: (rho * v2 * d2) / 1000 / mu, flowFromDh, energy1: p1 + 0.5 * rho * v1 ** 2, energy2: p2 + 0.5 * rho * v2 ** 2 };
}

/* ------------------------------------------------------------------ atomizador */

export const LIQUIDS = [
  { id: 'agua', name: 'Agua', rho: RHO_WATER },
  { id: 'etanol', name: 'Alcohol (etanol)', rho: RHO_ETHANOL },
];
export interface SprayResult { dp: number; rise: number; sprays: boolean }
/** Aire a `v` m/s sobre un pitillo cuya boca está `strawCm` cm por encima del líquido de densidad `rhoLiq`. */
export function atomizer(v: number, strawCm: number, rhoLiq: number): SprayResult {
  assertInRange('La rapidez del aire', v, 0, 340);
  const dp = 0.5 * RHO_AIR * v * v;
  const rise = dp / (rhoLiq * G);
  return { dp, rise, sprays: rise * 100 >= strawCm };
}
/** Rapidez mínima del aire para que el líquido llegue a la boca del pitillo (m/s). */
export const minAirSpeed = (strawCm: number, rhoLiq: number) => Math.sqrt((2 * rhoLiq * G * strawCm) / 100 / RHO_AIR);

/* ------------------------------------------------------------------ avisos */

export interface FluidCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function venturiConditions(r: VenturiResult): FluidCondition[] {
  const out: FluidCondition[] = [];
  if (r.h2 < 0) out.push({ level: 'invalido', text: `En la garganta la presión queda por debajo de la atmosférica (la columna bajaría a ${(r.h2 * 100).toFixed(1).replace('.', ',')} cm): el piezómetro se vaciaría y aspiraría aire.`, fix: 'Baja el caudal o usa una garganta más ancha hasta que la columna de la garganta quede por encima de cero.' });
  if (r.re2 > 4000) out.push({ level: 'nota', text: `Número de Reynolds en la garganta ≈ ${Math.round(r.re2).toLocaleString('es-CO')}: un flujo real de agua así es turbulento y pierde algo de energía; Bernoulli ideal no lo incluye.`, fix: 'Lee el resultado como el de un fluido ideal; en un medidor real se corrige con un coeficiente de descarga.' });
  return out;
}
export function hoseConditions(h: HoseResult): FluidCondition[] {
  const out: FluidCondition[] = [];
  if (h.v2 > 25) out.push({ level: 'advertencia', text: `Un chorro de ${h.v2.toFixed(0)} m/s pide más presión de la que da un grifo de casa (unos 2 a 4 bar alcanzan para ≈ 20 a 28 m/s sin pérdidas).`, fix: 'Usa una boquilla más ancha o llena el balde más despacio.' });
  return out;
}

export const bernoulliSpec: ModelSpec = {
  name: 'Fluido ideal en movimiento: continuidad, Bernoulli, tubo de Venturi y atomizador',
  inputs: [
    { symbol: 't, D₂', name: 'Tiempo para llenar 10 L y diámetro de la boquilla', unit: 's, mm', range: [10, 120], initial: 30 },
    { symbol: 'Q', name: 'Caudal en el Venturi', unit: 'L/s', range: FL_LIMITS.flow, initial: 0.3 },
    { symbol: 'D₂', name: 'Diámetro de la garganta (entrada de 25 mm)', unit: 'mm', range: FL_LIMITS.throat, initial: 12.5 },
    { symbol: 'v_aire', name: 'Rapidez del aire en el atomizador', unit: 'm/s', range: FL_LIMITS.air, initial: 20 },
  ],
  outputs: [
    { symbol: 'v₁, v₂', name: 'Rapidez en la parte ancha y en la angosta', unit: 'm/s' },
    { symbol: 'Δp, Δh', name: 'Caída de presión y desnivel de los piezómetros', unit: 'Pa, cm' },
    { symbol: 'Re', name: 'Número de Reynolds', unit: '—' },
    { symbol: 'h', name: 'Altura que sube el líquido en el atomizador', unit: 'cm' },
  ],
  equations: [
    'Q = A₁·v₁ = A₂·v₂;  A = π·D²/4',
    'p + ½·ρ·v² + ρ·g·h = constante (flujo ideal, a lo largo de una línea de corriente)',
    'Venturi: Δp = ½·ρ·(v₂² − v₁²);  Δh = (v₂² − v₁²)/(2g);  Q = A₂·√[2gΔh/(1 − (A₂/A₁)²)]',
    'Atomizador: h = ½·ρ_aire·v²/(ρ_líquido·g)',
    'Re = ρ·v·D/μ',
  ],
  initialConditions: ['Balde de 10 L lleno en 30 s con una manguera de ½ in (12,7 mm); Venturi de 25 mm con garganta de 12,5 mm y 0,3 L/s de agua a 20 °C; aire a 20 m/s sobre un pitillo de 2 cm con agua.'],
  assumptions: [
    'Fluido ideal: incompresible y sin viscosidad; flujo estacionario; la rapidez es la misma en toda la sección.',
    'El Venturi es horizontal: no cambia la altura del eje; la columna del piezómetro de entrada (60 cm) es ilustrativa.',
    'Agua a 20 °C (ρ = 998,2 kg/m³, μ = 1,002 mPa·s, CRC); aire seco a 20 °C (1,204 kg/m³); g = 9,78 m/s².',
  ],
  limits: [
    'El agua real tiene viscosidad: con números de Reynolds altos el flujo es turbulento y se pierde energía; a la salida del Venturi la columna no vuelve del todo a la altura de la entrada, y los medidores reales usan un coeficiente de descarga.',
    'Si la presión en la garganta baja demasiado, el agua puede hervir a temperatura ambiente (cavitación); el modelo solo avisa cuando la columna llega a cero.',
    'El atomizador real también depende de la tensión superficial y de cómo se forma el chorro; los diámetros de la manguera y del Venturi son ilustrativos.',
  ],
  testCases: [
    'Continuidad: 10 L en 30 s por una manguera de 12,7 mm → 0,333 L/s y 2,63 m/s; con boquilla de 6,35 mm (la mitad) la rapidez se cuadruplica: 10,53 m/s.',
    'Venturi 25/12,5 mm con 0,3 L/s: v₁ = 0,611 m/s, v₂ = 2,445 m/s, Δp = 2796 Pa y Δh = 28,6 cm; el caudal calculado con Δh devuelve 0,3 L/s; p + ½ρv² es igual en la entrada y en la garganta.',
    'Atomizador: aire a 20 m/s → Δp = 240,8 Pa y el agua sube 2,47 cm (el etanol, 3,12 cm).',
  ],
};

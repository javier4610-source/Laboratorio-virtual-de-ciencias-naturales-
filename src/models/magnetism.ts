import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Imanes, brújula y campo magnético (grado 7.º).
 *
 * Imán de barra: modelo de dos polos magnéticos puntuales (Gilbert) en los extremos, de «carga magnética» ±q_m con
 * q_m = m/L (m = momento dipolar, L = largo). El campo es analítico:
 *   B⃗(r⃗) = (μ₀·q_m/4π)·[(r⃗ − r⃗_N)/|r⃗ − r⃗_N|³ − (r⃗ − r⃗_S)/|r⃗ − r⃗_S|³]
 * y lejos del imán coincide con el de un dipolo puntual B⃗ = (μ₀/4π)·[3(m⃗·r̂)r̂ − m⃗]/r³ (las pruebas lo verifican).
 * Momento de cada imán: m = B_r·V/μ₀ con la remanencia típica de fabricante (ferrita ≈ 0,39 T; neodimio N35 ≈ 1,2 T;
 * valores aproximados) y el volumen del imán.
 * Campo de la Tierra en Apartadó (7,88° N; 76,63° O; 30 m) para noviembre de 2026 con el Modelo Magnético Mundial
 * WMM2025 (NOAA NCEI y BGS; coeficientes oficiales evaluados con pygeomag): componente horizontal H = 26 967 nT, vertical
 * Z = 16 836 nT hacia abajo, total 31 791 nT, inclinación 32,0° y declinación −7,5° (el norte magnético está 7,5° al oeste
 * del norte geográfico). La brújula sigue la componente HORIZONTAL del campo total (imán + Tierra).
 * Corriente: cable recto (ley de Biot-Savart) B = μ₀·I/(2π·d); bobina de N espiras en su eje (solenoide finito).
 * Ejes de la mesa: +x hacia el este, +y hacia el norte geográfico, +z hacia arriba. Este archivo no depende de React.
 */

export const MU0 = 4e-7 * Math.PI;
export const EARTH = { H: 26967e-9, Z: 16836e-9, F: 31791e-9, inclination: 31.98, declination: -7.48, model: 'WMM2025', date: '2026-11' };
/** Componente horizontal de la Tierra en la mesa (T): x = este, y = norte geográfico. */
export const EARTH_H: [number, number] = [EARTH.H * Math.sin((EARTH.declination * Math.PI) / 180), EARTH.H * Math.cos((EARTH.declination * Math.PI) / 180)];

export interface MagnetDef { id: string; name: string; length: number; width: number; height: number; br: number; moment: number }
const mk = (id: string, name: string, L: number, w: number, h: number, br: number): MagnetDef => ({ id, name, length: L, width: w, height: h, br, moment: (br * L * w * h) / MU0 });
export const MAGNETS: MagnetDef[] = [
  mk('ferrita', 'Imán de barra de ferrita (6 × 1,5 × 0,7 cm)', 0.06, 0.015, 0.007, 0.39),
  mk('neodimio', 'Imán de neodimio (4 × 1 × 0,5 cm)', 0.04, 0.01, 0.005, 1.2),
];
export function findMagnet(id: string): MagnetDef {
  const m = MAGNETS.find((x) => x.id === id);
  if (!m) throw new RangeError(`Imán desconocido: ${id}`);
  return m;
}

export type V3 = [number, number, number];
/** Imán colocado en la mesa: centro, ángulo del eje S→N medido desde +x (rad, antihorario visto desde arriba). */
export interface PlacedMagnet { magnet: MagnetDef; center: V3; angle: number }
export function poles(p: PlacedMagnet): { N: V3; S: V3; q: number } {
  const h = p.magnet.length / 2;
  const ux = Math.cos(p.angle), uy = Math.sin(p.angle);
  return { N: [p.center[0] + h * ux, p.center[1] + h * uy, p.center[2]], S: [p.center[0] - h * ux, p.center[1] - h * uy, p.center[2]], q: p.magnet.moment / p.magnet.length };
}

/** Campo (T) de un imán de barra en el punto r (m), modelo de dos polos. */
export function magnetField(p: PlacedMagnet, r: V3): V3 {
  const { N, S, q } = poles(p);
  const k = (MU0 / (4 * Math.PI)) * q;
  const out: V3 = [0, 0, 0];
  for (const [pole, sgn] of [[N, 1], [S, -1]] as [V3, number][]) {
    const d: V3 = [r[0] - pole[0], r[1] - pole[1], r[2] - pole[2]];
    const r2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    if (!(r2 > 1e-10)) throw new RangeError('El campo de un polo puntual no está definido en el polo.');
    const f = (sgn * k) / (r2 * Math.sqrt(r2));
    out[0] += f * d[0]; out[1] += f * d[1]; out[2] += f * d[2];
  }
  return out;
}
/** Campo (T) de un dipolo puntual de momento m⃗ (A·m²) en el origen. */
export function dipoleField(m: V3, r: V3): V3 {
  const rr = Math.hypot(...r);
  if (!(rr > 1e-9)) throw new RangeError('El campo de un dipolo puntual no está definido en su centro.');
  const u: V3 = [r[0] / rr, r[1] / rr, r[2] / rr];
  const mu = m[0] * u[0] + m[1] * u[1] + m[2] * u[2];
  const k = MU0 / (4 * Math.PI * rr ** 3);
  return [k * (3 * mu * u[0] - m[0]), k * (3 * mu * u[1] - m[1]), k * (3 * mu * u[2] - m[2])];
}

const norm = (v: V3) => Math.hypot(v[0], v[1], v[2]);
/** ¿El punto está dentro del volumen del imán (con un margen)? */
export function insideMagnet(p: PlacedMagnet, r: V3, margin = 0): boolean {
  const dx = r[0] - p.center[0], dy = r[1] - p.center[1];
  const a = dx * Math.cos(p.angle) + dy * Math.sin(p.angle), b = -dx * Math.sin(p.angle) + dy * Math.cos(p.angle);
  return Math.abs(a) <= p.magnet.length / 2 + margin && Math.abs(b) <= p.magnet.width / 2 + margin && Math.abs(r[2] - p.center[2]) <= p.magnet.height / 2 + margin;
}

/** Brújula en el punto (x, y) de la mesa: ángulo de la aguja (grados desde el norte geográfico, positivo hacia el este). */
export interface CompassReading { angle: number; Bmag: V3; Bh: [number, number]; magnetToEarth: number; deflection: number }
export function compassAt(p: PlacedMagnet | null, x: number, y: number, extra: [number, number] = [0, 0]): CompassReading {
  const Bm: V3 = p ? magnetField(p, [x, y, 0]) : [0, 0, 0];
  const Bh: [number, number] = [Bm[0] + EARTH_H[0] + extra[0], Bm[1] + EARTH_H[1] + extra[1]];
  const angle = (Math.atan2(Bh[0], Bh[1]) * 180) / Math.PI;
  const earthAngle = (Math.atan2(EARTH_H[0], EARTH_H[1]) * 180) / Math.PI;
  let deflection = angle - earthAngle;
  if (deflection > 180) deflection -= 360;
  if (deflection < -180) deflection += 360;
  return { angle, Bmag: Bm, Bh, magnetToEarth: Math.hypot(Bm[0] + extra[0], Bm[1] + extra[1]) / EARTH.H, deflection };
}

/**
 * Línea de campo que sale del polo norte en la dirección `dir` (vector unitario) y sigue B⃗ con pasos de RK4 de
 * longitud fija hasta llegar cerca del polo sur o salir de la caja. Solo el campo del imán (la Tierra es ~1000 veces
 * más débil cerca del imán). Devuelve puntos en metros.
 */
export function fieldLine(p: PlacedMagnet, dir: V3, opts: { step?: number; box?: number; maxSteps?: number } = {}): V3[] {
  const step = opts.step ?? 0.002, box = opts.box ?? 0.2, maxSteps = opts.maxSteps ?? 600;
  const { N, S } = poles(p);
  const r0 = 0.004;
  let r: V3 = [N[0] + r0 * dir[0], N[1] + r0 * dir[1], N[2] + r0 * dir[2]];
  const pts: V3[] = [r];
  const unit = (q: V3): V3 => { const b = magnetField(p, q); const n = norm(b) || 1; return [b[0] / n, b[1] / n, b[2] / n]; };
  for (let k = 0; k < maxSteps; k++) {
    const k1 = unit(r);
    const k2 = unit([r[0] + 0.5 * step * k1[0], r[1] + 0.5 * step * k1[1], r[2] + 0.5 * step * k1[2]]);
    const k3 = unit([r[0] + 0.5 * step * k2[0], r[1] + 0.5 * step * k2[1], r[2] + 0.5 * step * k2[2]]);
    const k4 = unit([r[0] + step * k3[0], r[1] + step * k3[1], r[2] + step * k3[2]]);
    r = [r[0] + (step / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), r[1] + (step / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), r[2] + (step / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])];
    pts.push(r);
    if (Math.hypot(r[0] - S[0], r[1] - S[1], r[2] - S[2]) < 0.005) { pts.push(S); break; }
    if (Math.abs(r[0]) > box || Math.abs(r[1]) > box || Math.abs(r[2]) > box) break;
  }
  return pts;
}
/** Direcciones de salida repartidas: en el plano de la mesa (n) o en todo el espacio (anillos alrededor del eje). */
export function startDirections(angle: number, n: number, space: boolean): V3[] {
  const out: V3[] = [];
  const ax: V3 = [Math.cos(angle), Math.sin(angle), 0], pe: V3 = [-Math.sin(angle), Math.cos(angle), 0], up: V3 = [0, 0, 1];
  const cones = [0.35, 0.8, 1.3];
  const rings = space ? [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] : [0, Math.PI];
  out.push(ax);
  for (const c of cones.slice(0, Math.max(1, Math.round(n / rings.length)))) {
    for (const phi of rings) {
      const s = Math.sin(c), co = Math.cos(c);
      const side: V3 = [pe[0] * Math.cos(phi) + up[0] * Math.sin(phi), pe[1] * Math.cos(phi) + up[1] * Math.sin(phi), pe[2] * Math.cos(phi) + up[2] * Math.sin(phi)];
      out.push([co * ax[0] + s * side[0], co * ax[1] + s * side[1], co * ax[2] + s * side[2]]);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ dos imanes y materiales */

/**
 * Fuerza (N) entre dos imanes iguales alineados en un eje con una separación d (m) entre sus extremos enfrentados,
 * con el modelo de polos (cuatro pares de polos, F = μ₀·q₁·q₂/(4π·r²)). Positiva = repulsión.
 */
export function magnetsForce(m: MagnetDef, gap: number, facing: 'NN' | 'NS' | 'SS'): number {
  assertInRange('La separación', gap, 0.002, 0.2);
  const q = m.moment / m.length, L = m.length, k = (MU0 / (4 * Math.PI)) * q * q;
  // imán 1: polos en −L y 0; imán 2: polos en gap y gap + L. El polo de 1 en 0 es el que mira al imán 2.
  const s1Near = facing === 'SS' ? -1 : 1; // signo del polo de 1 que mira a 2
  const s2Near = facing === 'NS' ? -1 : facing === 'SS' ? -1 : 1;
  const pairs: [number, number, number][] = [[s1Near, s2Near, gap], [s1Near, -s2Near, gap + L], [-s1Near, s2Near, gap + L], [-s1Near, -s2Near, gap + 2 * L]];
  return pairs.reduce((acc, [a, b, r]) => acc + (k * a * b) / (r * r), 0);
}

export interface Material { id: string; name: string; magnetic: boolean; why: string }
export const MATERIALS: Material[] = [
  { id: 'clavo', name: 'Puntilla de hierro', magnetic: true, why: 'El hierro es ferromagnético: el imán lo imanta y lo atrae.' },
  { id: 'clip', name: 'Clip de acero', magnetic: true, why: 'El acero es casi todo hierro: se atrae y hasta se vuelve un imán débil.' },
  { id: 'tapa', name: 'Tapa de lata de atún (hojalata: acero con estaño)', magnetic: true, why: 'La hojalata es acero recubierto: se atrae aunque el estaño de afuera no.' },
  { id: 'niquel', name: 'Lámina de níquel', magnetic: true, why: 'El níquel, como el hierro y el cobalto, es ferromagnético.' },
  { id: 'aluminio', name: 'Lata de gaseosa (aluminio)', magnetic: false, why: 'El aluminio es un metal, pero no es ferromagnético: la atracción es tan débil que no se nota.' },
  { id: 'cobre', name: 'Alambre de cobre', magnetic: false, why: 'El cobre conduce muy bien la electricidad, pero no se atrae con un imán.' },
  { id: 'oro', name: 'Anillo de oro', magnetic: false, why: 'El oro no es ferromagnético. «Ser metal» no basta para ser atraído.' },
  { id: 'plastico', name: 'Regla de plástico', magnetic: false, why: 'Los plásticos no tienen hierro, níquel ni cobalto.' },
  { id: 'madera', name: 'Lápiz de madera', magnetic: false, why: 'La madera no se atrae.' },
  { id: 'vidrio', name: 'Vaso de vidrio', magnetic: false, why: 'El vidrio no se atrae; el campo magnético sí lo atraviesa.' },
];
export function findMaterial(id: string): Material {
  const m = MATERIALS.find((x) => x.id === id);
  if (!m) throw new RangeError(`Material desconocido: ${id}`);
  return m;
}

/* ------------------------------------------------------------------ corriente: cable y bobina */

export const COIL = { length: 0.05, radius: 0.01 }; // m
export const EM_LIMITS = { turns: [10, 200] as [number, number], current: [0, 3] as [number, number], distance: [2, 30] as [number, number] };
/** Campo (T) de un cable recto largo a la distancia d (m): B = μ₀·I/(2π·d). */
export const wireField = (I: number, d: number) => (MU0 * I) / (2 * Math.PI * d);
/** Campo (T) en el eje de un solenoide de N espiras, largo L y radio a, a la distancia x (m) de su centro. */
export function solenoidAxis(N: number, I: number, x: number, L = COIL.length, a = COIL.radius): number {
  const n = N / L;
  const u = x + L / 2, w = x - L / 2;
  return ((MU0 * n * I) / 2) * (u / Math.hypot(u, a) - w / Math.hypot(w, a));
}
/** Campo en el centro de un solenoide ideal (largo): B = μ₀·N·I/L. */
export const idealSolenoid = (N: number, I: number, L = COIL.length) => (MU0 * N * I) / L;

export interface EmInput { source: 'cable' | 'bobina'; turns: number; current: number; distanceCm: number }
export interface EmResult { B: number; deflection: number; tan: number; inside: number | null }
/**
 * Experimento de Oersted: el cable va de sur a norte por encima de la brújula (o la bobina apunta al este con la
 * brújula en su eje). El campo de la corriente es perpendicular al de la Tierra: tan θ = B/H.
 */
export function electromagnet(i: EmInput): EmResult {
  assertInRange('El número de espiras', i.turns, EM_LIMITS.turns[0], EM_LIMITS.turns[1]);
  assertInRange('La corriente', i.current, EM_LIMITS.current[0], EM_LIMITS.current[1]);
  assertInRange('La distancia', i.distanceCm, EM_LIMITS.distance[0], EM_LIMITS.distance[1]);
  const d = i.distanceCm / 100;
  const B = i.source === 'cable' ? wireField(i.current, d) : solenoidAxis(i.turns, i.current, d);
  const tan = B / EARTH.H;
  return { B, tan, deflection: (Math.atan(tan) * 180) / Math.PI, inside: i.source === 'bobina' ? solenoidAxis(i.turns, i.current, 0) : null };
}

export interface MagCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function compassConditions(p: PlacedMagnet, x: number, y: number): MagCondition[] {
  const out: MagCondition[] = [];
  if (insideMagnet(p, [x, y, 0], 0.012)) out.push({ level: 'invalido', text: 'La brújula está encima del imán (o pegada a él): la aguja se queda pegada al polo y la lectura no sirve.', fix: 'Aleja la brújula al menos 2 cm del borde del imán.' });
  else {
    const r = compassAt(p, x, y);
    if (r.magnetToEarth < 0.2) out.push({ level: 'nota', text: `Aquí el campo del imán es solo el ${(r.magnetToEarth * 100).toFixed(0)} % del de la Tierra: la aguja casi apunta al norte magnético.`, fix: 'Acerca la brújula al imán para ver cómo la aguja sigue sus líneas de campo.' });
  }
  return out;
}
export function emConditions(i: EmInput): MagCondition[] {
  const out: MagCondition[] = [];
  if (i.current > 2) out.push({ level: 'advertencia', text: `Con ${String(i.current).replace('.', ',')} A el alambre delgado se calienta y la pila se agota en minutos.`, fix: 'Usa corrientes de 1 A o menos y desconecta entre medidas; el electroimán funciona igual con más espiras.' });
  if (i.source === 'bobina' && i.distanceCm < (COIL.length / 2) * 100 + 1.5) out.push({ level: 'invalido', text: `A ${i.distanceCm} cm del centro la brújula quedaría dentro de la bobina (mide ${COIL.length * 100} cm de largo): no cabe y la aguja no gira libre.`, fix: 'Pon la brújula a 4 cm o más del centro de la bobina, sobre su eje.' });
  if (i.current === 0) out.push({ level: 'nota', text: 'Sin corriente no hay campo magnético: la brújula apunta al norte magnético.', fix: 'Sube la corriente y observa hacia dónde gira la aguja.' });
  return out;
}

export const magnetismSpec: ModelSpec = {
  name: 'Imán de barra (modelo de dos polos), brújula con el campo de la Tierra (WMM2025) y campo de una corriente',
  inputs: [
    { symbol: 'imán', name: 'Imán de ferrita o de neodimio, con su orientación', unit: '—', initial: 'ferrita, N hacia el este' },
    { symbol: 'x, y', name: 'Posición de la brújula en la mesa', unit: 'cm', range: [-15, 15], initial: '8, 4' },
    { symbol: 'd, polos', name: 'Separación entre dos imanes y polos enfrentados', unit: 'cm', initial: '2 cm, N–N' },
    { symbol: 'N, I, d', name: 'Espiras de la bobina, corriente y distancia a la brújula', unit: '—, A, cm', initial: '50, 1 A, 10 cm' },
  ],
  outputs: [
    { symbol: 'B⃗', name: 'Campo magnético del imán', unit: 'µT' },
    { symbol: 'θ', name: 'Dirección de la aguja (desde el norte geográfico)', unit: '°' },
    { symbol: 'F', name: 'Fuerza entre dos imanes (+ repulsión)', unit: 'N' },
    { symbol: 'B_corriente, θ', name: 'Campo de la corriente y desviación de la brújula', unit: 'µT, °' },
  ],
  equations: [
    'B⃗ = (μ₀q_m/4π)·[(r⃗ − r⃗_N)/|r⃗ − r⃗_N|³ − (r⃗ − r⃗_S)/|r⃗ − r⃗_S|³],  q_m = m/L,  m = B_r·V/μ₀',
    'Lejos del imán: B⃗ = (μ₀/4π)·[3(m⃗·r̂)r̂ − m⃗]/r³ (dipolo)',
    'Aguja: dirección de B⃗_imán,h + B⃗_Tierra,h;   H = 26 967 nT, D = −7,5° (WMM2025, Apartadó)',
    'Cable: B = μ₀I/(2πd);   bobina en su eje: B = (μ₀nI/2)·[u/√(u² + a²) − w/√(w² + a²)];   tan θ = B/H',
  ],
  initialConditions: ['Imán de ferrita de 6 cm (B_r ≈ 0,39 T, m ≈ 1,96 A·m²) en el centro de la mesa, polo norte hacia el este; brújula en (8; 4) cm.'],
  assumptions: [
    'Los polos son puntuales y están en los extremos del imán; el imán no se debilita.',
    'La brújula solo gira en el plano horizontal (sigue la componente horizontal del campo); su propio campo no perturba al imán.',
    'El campo de la Tierra es uniforme en la mesa; no hay objetos de hierro cerca (pupitres, varillas del piso).',
  ],
  limits: [
    'Cerca de los polos (a menos de ≈ 1 cm) el modelo de polos puntuales sobrestima el campo y la fuerza entre imanes.',
    'Las remanencias son valores típicos: cada imán real es distinto y se debilita con golpes y calor.',
    'El electroimán con núcleo de hierro tiene un campo cientos de veces mayor, que el modelo no calcula (solo lo describe).',
  ],
  testCases: [
    'Lejos del imán (≥ 10 veces su largo) el campo de los dos polos coincide con el del dipolo (< 1 %).',
    'En el eje, a 10 cm del centro del imán de ferrita: B = 4,7 × 10⁻⁴ T con los dos polos (el dipolo puntual da 3,9 × 10⁻⁴ T: a esa distancia el largo del imán aún importa).',
    'Sin imán la aguja apunta 7,5° al oeste del norte geográfico (declinación de Apartadó).',
    'Cable con 1 A a 2 cm: B = 1,0 × 10⁻⁵ T; tan θ = 10,0/26,97 → θ = 20,3°.',
  ],
};

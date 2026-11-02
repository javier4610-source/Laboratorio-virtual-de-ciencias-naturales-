import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Electrostática (grado 11.º): ley de Coulomb, campo y potencial eléctrico de cargas puntuales.
 *
 *   F⃗ sobre q₀ = k·q₀·Σ qᵢ·(r⃗ − r⃗ᵢ)/|r⃗ − r⃗ᵢ|³      (superposición)
 *   E⃗ = F⃗/q₀ = k·Σ qᵢ·(r⃗ − r⃗ᵢ)/|r⃗ − r⃗ᵢ|³          V = k·Σ qᵢ/|r⃗ − r⃗ᵢ|
 *   con k = 8,99 × 10⁹ N·m²/C² (valor de los textos escolares; CODATA: 8,9875517862 × 10⁹).
 *
 * Unidades internas del SI (C, m, N); la interfaz usa µC, nC y cm. Las líneas de campo se trazan integrando la dirección
 * de E⃗ con Runge–Kutta de orden 4 (paso fijo en longitud de arco); las equipotenciales 2D con «cuadrados marchantes»
 * sobre una rejilla de V. Este archivo no depende de React ni del navegador.
 */

export const K_COULOMB = 8.99e9;
export const K_CODATA = 8.9875517862e9;

export type V3 = [number, number, number];
export interface PointCharge { id: string; q: number; /** C */ pos: V3; /** m */ }

export const ES_LIMITS = {
  charge: [-10, 10] as [number, number], // µC
  testCharge: [-50, 50] as [number, number], // nC
  distance: [2, 50] as [number, number], // cm (estación de Coulomb)
  coord: [-40, 40] as [number, number], // cm (estación del campo)
};
/** Dinamómetro digital (sensor de fuerza) de la estación de Coulomb: ±20 N, resolución 0,001 N. */
export const FORCE_SENSOR = { max: 20, resolution: 0.001 };
/** Regla del riel (cm): resolución 0,1 cm. */
export const RULER_RES_CM = 0.1;
/** Radio de las esferas cargadas (cm): a menos de 2 radios de centro a centro se tocan y se redistribuye la carga. */
export const SPHERE_RADIUS_CM = 1.0;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/** Fuerza de Coulomb entre dos cargas (N), con signo: positiva = repulsión. */
export function coulombForce(q1: number, q2: number, r: number): number {
  if (r <= 0) throw new RangeError('La distancia debe ser positiva.');
  return (K_COULOMB * q1 * q2) / (r * r);
}

/** Campo eléctrico (N/C) en un punto debido a un conjunto de cargas. */
export function fieldAt(charges: readonly PointCharge[], p: V3): V3 {
  const E: V3 = [0, 0, 0];
  for (const c of charges) {
    const d = sub(p, c.pos);
    const r = norm(d);
    if (r < 1e-9) return [NaN, NaN, NaN];
    const k = (K_COULOMB * c.q) / (r * r * r);
    E[0] += k * d[0]; E[1] += k * d[1]; E[2] += k * d[2];
  }
  return E;
}
/** Potencial eléctrico (V) en un punto (referencia: V = 0 en el infinito). */
export function potentialAt(charges: readonly PointCharge[], p: V3): number {
  let V = 0;
  for (const c of charges) {
    const r = norm(sub(p, c.pos));
    if (r < 1e-9) return NaN;
    V += (K_COULOMB * c.q) / r;
  }
  return V;
}
/** Fuerza (N) sobre una carga de prueba q₀ (C) en p. */
export function forceOnTest(charges: readonly PointCharge[], q0: number, p: V3): V3 {
  const E = fieldAt(charges, p);
  return [E[0] * q0, E[1] * q0, E[2] * q0];
}
/** Energía potencial eléctrica del sistema de cargas fijas (J): U = k·Σ_{i<j} qᵢ·qⱼ/rᵢⱼ. */
export function systemEnergy(charges: readonly PointCharge[]): number {
  let U = 0;
  for (let i = 0; i < charges.length; i++) for (let j = i + 1; j < charges.length; j++) U += (K_COULOMB * charges[i].q * charges[j].q) / norm(sub(charges[i].pos, charges[j].pos));
  return U;
}

/* ------------------------------------------------------------------ estación 1: Coulomb */

export interface CoulombInput { q1uC: number; q2uC: number; rCm: number }
export interface CoulombResult { F: number; magnitude: number; kind: 'repulsión' | 'atracción' | 'ninguna'; overRange: boolean; touching: boolean; invR2: number; warnings: string[] }
export function coulombStation(i: CoulombInput): CoulombResult {
  assertInRange('La carga q₁', i.q1uC, ES_LIMITS.charge[0], ES_LIMITS.charge[1]);
  assertInRange('La carga q₂', i.q2uC, ES_LIMITS.charge[0], ES_LIMITS.charge[1]);
  assertInRange('La distancia', i.rCm, ES_LIMITS.distance[0], ES_LIMITS.distance[1]);
  const r = i.rCm / 100;
  const F = coulombForce(i.q1uC * 1e-6, i.q2uC * 1e-6, r);
  const magnitude = Math.abs(F);
  const overRange = magnitude > FORCE_SENSOR.max;
  const touching = i.rCm < 2 * SPHERE_RADIUS_CM + 1e-9;
  const warnings: string[] = [];
  if (overRange) warnings.push(`La fuerza (${magnitude.toFixed(1)} N) supera el alcance del dinamómetro (${FORCE_SENSOR.max} N).`);
  if (i.q1uC === 0 || i.q2uC === 0) warnings.push('Una de las esferas está descargada: no hay fuerza eléctrica entre ellas.');
  if (i.rCm < 5 && !touching) warnings.push('A menos de 5 cm las esferas (de 1 cm de radio) ya no se comportan como cargas puntuales: la carga se redistribuye en su superficie.');
  return { F, magnitude, kind: F > 0 ? 'repulsión' : F < 0 ? 'atracción' : 'ninguna', overRange, touching, invR2: 1 / (r * r), warnings };
}

/** Distancia mínima (cm, múltiplo de 0,5) para que la fuerza quepa en el dinamómetro. */
export function minDistanceForSensor(q1uC: number, q2uC: number): number {
  const r = Math.sqrt((K_COULOMB * Math.abs(q1uC * q2uC) * 1e-12) / FORCE_SENSOR.max) * 100;
  return Math.ceil(r * 2 - 1e-9) / 2;
}

/* ------------------------------------------------------------------ estación 2: campo */

export type PresetId = 'positiva' | 'negativa' | 'dipolo' | 'iguales' | 'tres';
export const PRESETS: { id: PresetId; name: string; charges: { q: number; x: number; y: number }[] }[] = [
  { id: 'positiva', name: 'Una carga positiva', charges: [{ q: 2, x: 0, y: 0 }] },
  { id: 'negativa', name: 'Una carga negativa', charges: [{ q: -2, x: 0, y: 0 }] },
  { id: 'dipolo', name: 'Dipolo (+q y −q)', charges: [{ q: 2, x: -10, y: 0 }, { q: -2, x: 10, y: 0 }] },
  { id: 'iguales', name: 'Dos cargas iguales (+q y +q)', charges: [{ q: 2, x: -10, y: 0 }, { q: 2, x: 10, y: 0 }] },
  { id: 'tres', name: 'Tres cargas en triángulo', charges: [{ q: 2, x: -12, y: -7 }, { q: 2, x: 12, y: -7 }, { q: -3, x: 0, y: 14 }] },
];
/** Cargas (SI) a partir de µC y cm en el plano z = 0. */
export function chargesFrom(list: { q: number; x: number; y: number }[]): PointCharge[] {
  return list.map((c, i) => ({ id: `q${i + 1}`, q: c.q * 1e-6, pos: [c.x / 100, c.y / 100, 0] }));
}

export interface ProbeReading { E: V3; Emag: number; angleDeg: number; V: number; F: V3; Fmag: number; nearest: number; /** cm */ warnings: string[] }
export function probe(charges: readonly PointCharge[], q0nC: number, pCm: V3): ProbeReading {
  const p: V3 = [pCm[0] / 100, pCm[1] / 100, pCm[2] / 100];
  const nearest = Math.min(...charges.map((c) => norm(sub(p, c.pos)))) * 100;
  const warnings: string[] = [];
  if (nearest < 2 * SPHERE_RADIUS_CM) {
    warnings.push('La carga de prueba está encima de una de las cargas: el campo de una carga puntual no está definido allí.');
    return { E: [NaN, NaN, NaN], Emag: NaN, angleDeg: NaN, V: NaN, F: [NaN, NaN, NaN], Fmag: NaN, nearest, warnings };
  }
  const E = fieldAt(charges, p);
  const V = potentialAt(charges, p);
  const q0 = q0nC * 1e-9;
  const F: V3 = [E[0] * q0, E[1] * q0, E[2] * q0];
  if (q0nC === 0) warnings.push('La carga de prueba es cero: el dinamómetro no marca fuerza, aunque el campo exista.');
  return { E, Emag: norm(E), angleDeg: (Math.atan2(E[1], E[0]) * 180) / Math.PI, V, F, Fmag: norm(F), nearest, warnings };
}

/** Campo en el eje de un dipolo (punto a distancia x del centro, |x| > a): E = 2·k·q·(2·a·x)/(x² − a²)²... forma exacta. */
export function dipoleAxisField(q: number, a: number, x: number): number {
  return K_COULOMB * q * (1 / (x - a) ** 2 - 1 / (x + a) ** 2);
}
/** Campo en la mediatriz de un dipolo (+q en −a, −q en +a), a distancia y: E = 2·k·q·a/(a² + y²)^(3/2), dirigido de + a −. */
export function dipoleBisectorField(q: number, a: number, y: number): number {
  return (2 * K_COULOMB * q * a) / (a * a + y * y) ** 1.5;
}

/* ------------------------------------------------------------------ líneas de campo y equipotenciales */

/**
 * Líneas de campo: salen de las cargas positivas (o, si no hay, llegan a las negativas, integrando al revés) desde
 * `perCharge` puntos repartidos en una circunferencia (2D) o en una esfera (3D, espiral de Fibonacci). Integración RK4
 * de la dirección de E⃗ con paso `step` (m); se detiene al llegar a otra carga o al salir de la caja |x|,|y|,|z| < box.
 */
export function fieldLines(charges: readonly PointCharge[], opts: { perCharge: number; step: number; box: number; maxSteps: number; dims: 2 | 3; start?: number }): V3[][] {
  const pos = charges.filter((c) => c.q > 0);
  const sources = pos.length ? pos : charges.filter((c) => c.q < 0);
  const sign = pos.length ? 1 : -1;
  const qmax = Math.max(...sources.map((c) => Math.abs(c.q)));
  const lines: V3[][] = [];
  const r0 = opts.start ?? opts.step * 1.5;
  const dir = (p: V3): V3 | null => {
    const E = fieldAt(charges, p);
    const m = norm(E);
    if (!Number.isFinite(m) || m < 1e-12) return null;
    return [(sign * E[0]) / m, (sign * E[1]) / m, (sign * E[2]) / m];
  };
  for (const c of sources) {
    // Número de líneas proporcional a la carga (densidad de líneas ∝ |q|).
    const n = Math.max(2, Math.round((opts.perCharge * Math.abs(c.q)) / qmax));
    for (let k = 0; k < n; k++) {
      let u: V3;
      if (opts.dims === 2) { const a = (2 * Math.PI * (k + 0.5)) / n; u = [Math.cos(a), Math.sin(a), 0]; }
      else { const y = 1 - (2 * (k + 0.5)) / n; const rr = Math.sqrt(1 - y * y); const a = k * Math.PI * (3 - Math.sqrt(5)); u = [rr * Math.cos(a), y, rr * Math.sin(a)]; }
      let p: V3 = [c.pos[0] + r0 * u[0], c.pos[1] + r0 * u[1], c.pos[2] + r0 * u[2]];
      const line: V3[] = [c.pos, p];
      for (let s = 0; s < opts.maxSteps; s++) {
        const h = opts.step;
        const k1 = dir(p); if (!k1) break;
        const k2 = dir([p[0] + (h / 2) * k1[0], p[1] + (h / 2) * k1[1], p[2] + (h / 2) * k1[2]]); if (!k2) break;
        const k3 = dir([p[0] + (h / 2) * k2[0], p[1] + (h / 2) * k2[1], p[2] + (h / 2) * k2[2]]); if (!k3) break;
        const k4 = dir([p[0] + h * k3[0], p[1] + h * k3[1], p[2] + h * k3[2]]); if (!k4) break;
        p = [0, 1, 2].map((j) => p[j] + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) as V3;
        const hit = charges.find((o) => o !== c && norm(sub(p, o.pos)) < r0);
        if (hit) { line.push(hit.pos); break; }
        if (Math.abs(p[0]) > opts.box || Math.abs(p[1]) > opts.box || Math.abs(p[2]) > opts.box) { line.push(p); break; }
        line.push(p);
      }
      lines.push(sign > 0 ? line : line.reverse());
    }
  }
  return lines;
}

/**
 * Equipotenciales 2D (plano z = 0) por cuadrados marchantes sobre una rejilla de `n`×`n` en [−box, box]²: segmentos
 * [p, q] de cada nivel. Los niveles se reparten de forma simétrica en ±niveles en escala de V.
 */
export function equipotentialSegments(charges: readonly PointCharge[], levels: number[], box: number, n = 60): { level: number; segs: [V3, V3][] }[] {
  const h = (2 * box) / n;
  const V: number[][] = [];
  for (let i = 0; i <= n; i++) { V.push([]); for (let j = 0; j <= n; j++) V[i].push(potentialAt(charges, [-box + j * h, -box + i * h, 0])); }
  return levels.map((level) => {
    const segs: [V3, V3][] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const c = [V[i][j], V[i][j + 1], V[i + 1][j + 1], V[i + 1][j]];
      if (c.some((v) => !Number.isFinite(v))) continue;
      const P: V3[] = [[-box + j * h, -box + i * h, 0], [-box + (j + 1) * h, -box + i * h, 0], [-box + (j + 1) * h, -box + (i + 1) * h, 0], [-box + j * h, -box + (i + 1) * h, 0]];
      const cross: V3[] = [];
      for (let e = 0; e < 4; e++) {
        const a = c[e], b = c[(e + 1) % 4];
        if ((a - level) * (b - level) < 0) {
          const t = (level - a) / (b - a);
          const pa = P[e], pb = P[(e + 1) % 4];
          cross.push([pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1]), 0]);
        }
      }
      if (cross.length === 2) segs.push([cross[0], cross[1]]);
      else if (cross.length === 4) { segs.push([cross[0], cross[1]]); segs.push([cross[2], cross[3]]); }
    }
    return { level, segs };
  });
}

/**
 * Puntos de una superficie equipotencial 3D: en cada dirección de una esfera de Fibonacci alrededor de cada carga se
 * busca, por bisección sobre el radio, el punto donde V = nivel (si existe dentro de rMax). Sirve para dibujar la
 * superficie como una nube de puntos y comprobar que es una superficie (no una línea).
 */
export function equipotentialPoints(charges: readonly PointCharge[], level: number, rMax: number, directions = 90): V3[] {
  const pts: V3[] = [];
  for (const c of charges) {
    if (Math.sign(c.q) !== Math.sign(level)) continue;
    for (let k = 0; k < directions; k++) {
      const y = 1 - (2 * (k + 0.5)) / directions; const rr = Math.sqrt(1 - y * y); const a = k * Math.PI * (3 - Math.sqrt(5));
      const u: V3 = [rr * Math.cos(a), y, rr * Math.sin(a)];
      const at = (r: number) => potentialAt(charges, [c.pos[0] + r * u[0], c.pos[1] + r * u[1], c.pos[2] + r * u[2]]) - level;
      let lo = 1e-4, hi = rMax;
      const flo = at(lo), fhi = at(hi);
      if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) continue;
      for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (at(lo) * at(m) <= 0) hi = m; else lo = m; }
      const r = (lo + hi) / 2;
      const p: V3 = [c.pos[0] + r * u[0], c.pos[1] + r * u[1], c.pos[2] + r * u[2]];
      // Solo el punto de la superficie que «pertenece» a esta carga (la más cercana), para no duplicar.
      const own = charges.every((o) => o === c || Math.sign(o.q) !== Math.sign(c.q) || norm(sub(p, o.pos)) >= r - 1e-9);
      if (own) pts.push(p);
    }
  }
  return pts;
}

export interface EsCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix?: string }
export function coulombConditions(i: CoulombInput): EsCondition[] {
  const res = coulombStation(i);
  return res.warnings.map((w): EsCondition => {
    if (w.includes('supera el alcance')) return { text: w, level: 'invalido', fix: `Aleja las esferas a ${String(minDistanceForSensor(i.q1uC, i.q2uC)).replace('.', ',')} cm o más, o reduce una de las cargas.` };
    if (w.includes('descargada')) return { text: w, level: 'advertencia', fix: 'Carga las dos esferas (q₁ y q₂ distintas de 0 µC) con el generador de Van de Graaff.' };
    return { text: w, level: 'nota', fix: 'Para comparar con la ley de Coulomb usa distancias de 5 cm o más.' };
  });
}

export const electrostaticsSpec: ModelSpec = {
  name: 'Ley de Coulomb, campo eléctrico y potencial de cargas puntuales (superposición)',
  inputs: [
    { symbol: 'q₁, q₂', name: 'Cargas de las esferas (estación de Coulomb)', unit: 'µC', range: ES_LIMITS.charge, initial: 2 },
    { symbol: 'r', name: 'Distancia entre los centros de las esferas', unit: 'cm', range: ES_LIMITS.distance, initial: 30 },
    { symbol: 'configuración', name: 'Una carga, dipolo, dos cargas iguales o tres cargas', unit: '—', initial: 'dipolo' },
    { symbol: 'q₀', name: 'Carga de prueba', unit: 'nC', range: ES_LIMITS.testCharge, initial: 10 },
    { symbol: 'x, y', name: 'Posición de la carga de prueba', unit: 'cm', range: ES_LIMITS.coord, initial: 0 },
  ],
  outputs: [
    { symbol: 'F', name: 'Fuerza eléctrica medida con el dinamómetro', unit: 'N' },
    { symbol: 'E', name: 'Intensidad del campo eléctrico', unit: 'N/C' },
    { symbol: 'V', name: 'Potencial eléctrico (V = 0 en el infinito)', unit: 'V' },
  ],
  equations: [
    'F = k·q₁·q₂/r²,   k = 8,99 × 10⁹ N·m²/C²',
    'E⃗ = F⃗/q₀ = k·Σ qᵢ·(r⃗ − r⃗ᵢ)/|r⃗ − r⃗ᵢ|³',
    'V = k·Σ qᵢ/|r⃗ − r⃗ᵢ|',
    'Líneas de campo: dr⃗/ds = E⃗/|E⃗| (RK4); equipotenciales: V(x, y) = constante (cuadrados marchantes)',
  ],
  initialConditions: [
    'Esferas de 1 cm de radio cargadas con un generador de Van de Graaff y medidas con un electrómetro (la carga se elige).',
    'Dinamómetro digital de ±20 N con resolución de 0,001 N; regla de 0,1 cm.',
    'Las cargas del campo están en el plano z = 0; la carga de prueba se mueve en ese plano (y en 3D se ve el espacio alrededor).',
  ],
  assumptions: [
    'Cargas puntuales en el vacío (o en aire seco, con permitividad casi igual a la del vacío).',
    'La carga de prueba es pequeña y no mueve ni redistribuye las demás cargas.',
    'Las cargas están en reposo (electrostática): no hay corrientes ni campos magnéticos.',
  ],
  limits: [
    'Con esferas a menos de 5 cm la carga se redistribuye por inducción y la ley de cargas puntuales deja de ser exacta.',
    'En el aire real la carga se pierde poco a poco por la humedad (el clima de Apartadó es muy húmedo); el modelo no lo incluye.',
    'Cerca de cada carga puntual el campo crece sin límite: la carga de prueba no puede ponerse encima de otra carga.',
  ],
  testCases: [
    'q₁ = 2 µC, q₂ = −3 µC, r = 30 cm: F = 8,99 × 10⁹ · 6 × 10⁻¹² / 0,09 = 0,599 N de atracción.',
    'Duplicar r divide F entre 4 (ley del inverso del cuadrado); duplicar q₁ duplica F.',
    'Dos cargas iguales: E = 0 en el punto medio; dipolo: E en la mediatriz = 2·k·q·a/(a² + y²)^(3/2), dirigido de + a −.',
    'Superposición: E⃗ total = suma de los campos de cada carga; V es la suma escalar de los potenciales.',
  ],
};

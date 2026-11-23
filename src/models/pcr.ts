import { assertInRange, linearRegression, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Biotecnología: PCR y electroforesis en gel de agarosa (grado 10.º).
 *
 * 1) Amplificación: en cada ciclo cada copia se duplica con una eficiencia E (0–1): N = N₀·(1 + E)ⁿ. Con E = 1, 30
 *    ciclos dan 2³⁰ ≈ 1,07 × 10⁹ copias por molde. Al acabarse los cebadores y los nucleótidos la reacción se satura
 *    (meseta): se modela con un tope ILUSTRATIVO de copias (crecimiento logístico discreto), no medido.
 * 2) Temperatura de fusión de un cebador corto con la regla de Wallace (Wallace y otros, 1979; Thein y Wallace, 1986):
 *    Tm = 2 °C·(A + T) + 4 °C·(G + C). Es una aproximación para oligonucleótidos de unos 14 a 20 nucleótidos en las
 *    condiciones salinas de la hibridación; para cebadores más largos o en otras sales hay que usar el método del
 *    vecino más cercano (SantaLucia, 1998). Temperatura de alineamiento sugerida: Ta ≈ Tm(menor) − 5 °C.
 * 3) Electroforesis: en el intervalo de separación del gel la distancia recorrida es aproximadamente lineal con el
 *    logaritmo del tamaño (Green y Sambrook, Molecular Cloning, 4.ª ed., 2012): d = a − b·log₁₀(pb). Los coeficientes a y b
 *    (gel de agarosa al 1,5 %, 100 V, 40 min) son ILUSTRATIVOS. El tamaño de una banda desconocida se estima con la
 *    recta de calibración que se ajusta a un marcador de tamaños reales (escalera de 100 pb de New England Biolabs).
 * La secuencia molde es ILUSTRATIVA (escrita para la práctica; no es de un organismo real).
 * Este archivo no depende de React ni del navegador.
 */

/**
 * Molde ilustrativo de 600 pb: secuencia ALEATORIA reproducible (semilla fija, 50 % de probabilidad de G o C por
 * posición), escrita para la práctica. No es de ningún organismo ni de ningún gen real.
 */
export const TEMPLATE = (() => {
  const rnd = seededRandom(2026);
  let s = '';
  for (let i = 0; i < 600; i++) s += 'ACGT'[Math.floor(rnd() * 4)];
  return s;
})();

export const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
export const revComp = (s: string) => s.split('').reverse().map((b) => COMPLEMENT[b] ?? 'N').join('');

export function wallaceTm(primer: string): number {
  const s = primer.toUpperCase();
  if (!/^[ACGT]+$/.test(s)) throw new RangeError('El cebador solo puede tener A, C, G y T');
  let at = 0, gc = 0;
  for (const b of s) { if (b === 'A' || b === 'T') at++; else gc++; }
  return 2 * at + 4 * gc;
}
export const gcPercent = (s: string) => (s.split('').filter((b) => b === 'G' || b === 'C').length / s.length) * 100;

export interface PrimerPair { id: string; name: string; forward: string; reverse: string; note: string }
/** Pares de cebadores de 20 nt sobre el molde ilustrativo: tres bien diseñados (productos de tamaño distinto) y uno con un error. */
export const PRIMER_PAIRS: PrimerPair[] = [
  { id: 'p1', name: 'Par 1 (producto corto)', forward: TEMPLATE.slice(40, 60), reverse: revComp(TEMPLATE.slice(240, 260)), note: 'Cebadores de 20 nt con Tm parecidas.' },
  { id: 'p2', name: 'Par 2 (producto mediano)', forward: TEMPLATE.slice(100, 120), reverse: revComp(TEMPLATE.slice(430, 450)), note: 'Cebadores de 20 nt.' },
  { id: 'p3', name: 'Par 3 (producto largo)', forward: TEMPLATE.slice(10, 30), reverse: revComp(TEMPLATE.slice(560, 580)), note: 'Cebadores de 20 nt.' },
  { id: 'p4', name: 'Par 4 (reverso mal diseñado)', forward: TEMPLATE.slice(40, 60), reverse: TEMPLATE.slice(240, 260), note: 'El reverso se copió igual a la hebra de arriba, sin el complemento inverso.' },
];
export function findPair(id: string): PrimerPair {
  const p = PRIMER_PAIRS.find((x) => x.id === id);
  if (!p) throw new RangeError(`Par de cebadores desconocido: ${id}`);
  return p;
}

export interface PrimerCheck { pair: PrimerPair; fPos: number; rPos: number; product: number | null; tmF: number; tmR: number; ta: number; problems: string[] }
/** Ubica los cebadores en el molde (el directo en la hebra de arriba; el reverso como complemento inverso) y calcula el producto. */
export function checkPrimers(pairId: string, template = TEMPLATE): PrimerCheck {
  const pair = findPair(pairId);
  const fPos = template.indexOf(pair.forward);
  const rSite = revComp(pair.reverse);
  const rPos = template.indexOf(rSite);
  const tmF = wallaceTm(pair.forward), tmR = wallaceTm(pair.reverse);
  const problems: string[] = [];
  if (fPos < 0) problems.push('El cebador directo no encuentra su secuencia en el molde.');
  if (rPos < 0) problems.push('El cebador reverso no se une a la hebra de abajo: debe ser el complemento inverso del final del fragmento.');
  if (Math.abs(tmF - tmR) > 5) problems.push('Las temperaturas de fusión difieren más de 5 °C: a una sola temperatura de alineamiento uno de los dos se une mal.');
  const product = fPos >= 0 && rPos >= 0 && rPos > fPos ? rPos + rSite.length - fPos : null;
  return { pair, fPos, rPos, product, tmF, tmR, ta: Math.min(tmF, tmR) - 5, problems };
}

export const PCR_LIMITS = { cycles: [0, 40] as [number, number], E: [0.5, 1] as [number, number], N0: [1, 1e6] as [number, number] };
/** Tope ilustrativo de copias de un tubo de 25 µL (los cebadores y los nucleótidos se agotan). */
export const PLATEAU = 1e12;

export interface PcrRun { points: { n: number; ideal: number; real: number }[]; final: number; finalIdeal: number; cyclesToThreshold: number | null }
/** Copias tras cada ciclo: ideal N₀(1 + E)ⁿ y con meseta (logístico discreto con tope PLATEAU). */
export function amplify(N0: number, E: number, cycles: number, threshold = 1e10): PcrRun {
  assertInRange('Las copias iniciales', N0, ...PCR_LIMITS.N0);
  assertInRange('La eficiencia', E, 0, 1);
  assertInRange('El número de ciclos', cycles, ...PCR_LIMITS.cycles);
  const points = [{ n: 0, ideal: N0, real: N0 }];
  let real = N0;
  let ct: number | null = N0 >= threshold ? 0 : null;
  for (let n = 1; n <= cycles; n++) {
    real = real + E * real * (1 - real / PLATEAU);
    const ideal = N0 * (1 + E) ** n;
    points.push({ n, ideal, real });
    if (ct === null && real >= threshold) ct = n;
  }
  return { points, final: real, finalIdeal: N0 * (1 + E) ** cycles, cyclesToThreshold: ct };
}

/** Etapas de un ciclo (temperaturas típicas de un protocolo con Taq; los tiempos son ilustrativos). */
export const CYCLE_STEPS = [
  { id: 'desnaturalizacion', name: 'Desnaturalización', T: 95, s: 30, what: 'Las dos hebras del ADN se separan.' },
  { id: 'alineamiento', name: 'Alineamiento', T: null as number | null, s: 30, what: 'Los cebadores se unen a sus secuencias complementarias (Ta ≈ Tm − 5 °C).' },
  { id: 'extension', name: 'Extensión', T: 72, s: 45, what: 'La ADN polimerasa Taq copia cada hebra a partir del cebador.' },
];

/**
 * Escalera de 100 pb de New England Biolabs (N3231): 100, 200, 300, 400, 500/517, 600, 700, 800, 900, 1000, 1200 y
 * 1517 pb. La banda doble 500/517 se dibuja como una sola de 500 pb.
 */
export const LADDER_100BP = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1517];
/** Gel de agarosa al 1,5 % (ilustrativo): distancia en mm desde el pozo. */
export const GEL = { a: 118, b: 32, length: 70 };
export function migration(bp: number): number {
  assertInRange('El tamaño', bp, 10, 20000);
  return Math.min(GEL.length, Math.max(0, GEL.a - GEL.b * Math.log10(bp)));
}

export interface GelFit { slope: number; intercept: number; r2: number; estimate: (d: number) => number }
/** Recta de calibración log₁₀(pb) contra distancia con el marcador, y su inversa para estimar tamaños. */
export function calibrate(distances: number[] = LADDER_100BP.map(migration), sizes: number[] = LADDER_100BP): GelFit {
  const fit = linearRegression(distances, sizes.map((s) => Math.log10(s)));
  if (!fit) throw new RangeError('Hacen falta al menos dos bandas del marcador');
  return { slope: fit.slope, intercept: fit.intercept, r2: fit.r2, estimate: (d: number) => 10 ** (fit.intercept + fit.slope * d) };
}

export interface PcrCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function pcrConditions(chk: PrimerCheck, Ta: number, cycles: number): PcrCondition[] {
  const out: PcrCondition[] = [];
  for (const p of chk.problems) out.push({ level: chk.product === null ? 'invalido' : 'advertencia', text: p, fix: chk.product === null ? 'Escribe el reverso como el complemento inverso de los últimos 20 nucleótidos del fragmento (lee la hebra de abajo de 5′ a 3′).' : 'Rediseña un cebador para que las dos Tm queden a menos de 5 °C.' });
  if (Ta > Math.min(chk.tmF, chk.tmR) + 2) out.push({ level: 'advertencia', text: `A ${Ta} °C los cebadores casi no se unen (su Tm es ${Math.min(chk.tmF, chk.tmR)} °C): poco o ningún producto.`, fix: `Baja la temperatura de alineamiento a ≈ ${chk.ta} °C (Tm − 5 °C).` });
  else if (Ta < Math.min(chk.tmF, chk.tmR) - 12) out.push({ level: 'advertencia', text: `A ${Ta} °C los cebadores se unen también donde no coinciden del todo: aparecen bandas inespecíficas.`, fix: `Sube la temperatura de alineamiento a ≈ ${chk.ta} °C.` });
  if (cycles > 35) out.push({ level: 'nota', text: 'Después de unos 30–35 ciclos la reacción ya está en la meseta: más ciclos no dan más producto y sí más bandas inespecíficas.', fix: 'Usa entre 25 y 35 ciclos.' });
  const len = Math.max(chk.pair.forward.length, chk.pair.reverse.length);
  if (len > 20 || len < 14) out.push({ level: 'nota', text: 'La regla de Wallace es una aproximación para cebadores de unos 14 a 20 nucleótidos.', fix: 'Para otros tamaños usa el método del vecino más cercano (SantaLucia, 1998).' });
  return out;
}

/**
 * Fracción de moldes en los que se unen los cebadores según la temperatura de alineamiento (ILUSTRATIVA): completa
 * hasta Tm − 3 °C, baja en línea recta y es nula desde Tm + 2 °C. Multiplica la eficiencia de cada ciclo.
 */
export function bindingFraction(Ta: number, Tm: number): number {
  if (Ta <= Tm - 3) return 1;
  return Math.max(0, (Tm + 2 - Ta) / 5);
}

export const pcrSpec: ModelSpec = {
  name: 'PCR: amplificación con eficiencia, temperatura de fusión de los cebadores (regla de Wallace) y electroforesis en gel con un marcador de tamaños',
  inputs: [
    { symbol: 'par', name: 'Par de cebadores sobre el molde ilustrativo', unit: '—', initial: 'par 2' },
    { symbol: 'n', name: 'Número de ciclos', unit: '—', range: [0, 40], initial: 30 },
    { symbol: 'E', name: 'Eficiencia de cada ciclo', unit: '—', range: [0.5, 1], initial: 0.9 },
    { symbol: 'N₀', name: 'Copias iniciales del molde', unit: 'copias', range: [1, 1e6], initial: 1000 },
    { symbol: 'Ta', name: 'Temperatura de alineamiento', unit: '°C', range: [40, 72], initial: 55 },
  ],
  outputs: [
    { symbol: 'N', name: 'Copias del producto', unit: 'copias' },
    { symbol: 'Tm', name: 'Temperatura de fusión de cada cebador', unit: '°C' },
    { symbol: 'pb', name: 'Tamaño del producto y tamaño estimado en el gel', unit: 'pb' },
  ],
  equations: [
    'N = N₀·(1 + E)ⁿ  (ideal);  con meseta: N_(k+1) = N_k + E·N_k·(1 − N_k/N_máx)',
    'Regla de Wallace: Tm = 2·(A + T) + 4·(G + C) °C;  Ta ≈ Tm − 5 °C',
    'Gel: d = a − b·log₁₀(pb);  calibración con el marcador: log₁₀(pb) = m·d + c',
  ],
  initialConditions: ['1000 copias del molde, eficiencia 0,9, 30 ciclos, alineamiento a 55 °C; gel de agarosa al 1,5 % con la escalera de 100 pb de NEB.'],
  assumptions: [
    'La eficiencia es la misma en todos los ciclos hasta que la reacción se acerca a la meseta (tope ilustrativo de 10¹² copias).',
    'La regla de Wallace vale para cebadores cortos (≈ 14–20 nt); la Tm real depende de la sal y de la concentración del cebador.',
    'La migración es lineal con log₁₀(pb) en el intervalo del marcador; los coeficientes del gel son ilustrativos.',
    'El molde es una secuencia ilustrativa escrita para la práctica.',
  ],
  limits: [
    'Fuera del intervalo del marcador (menos de 100 o más de 1517 pb) la recta de calibración extrapola y pierde exactitud.',
    'No modela dímeros de cebadores, estructuras secundarias ni errores de la polimerasa.',
    'La meseta real depende de la reacción; el tope es ilustrativo.',
  ],
  testCases: [
    'Con E = 1 y 30 ciclos: 2³⁰ = 1 073 741 824 copias por molde; con E = 0,9, 1,9³⁰ ≈ 2,3 × 10⁸.',
    'Regla de Wallace: ATGCATGCATGCATGCATGC (10 A + T y 10 G + C) → Tm = 60 °C.',
    'La recta de calibración con la escalera de 100 pb recupera el tamaño de cada producto con menos del 2 % de error.',
    'El reverso sin complemento inverso no da producto.',
  ],
};

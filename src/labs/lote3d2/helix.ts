/**
 * Doble hélice de ADN-B generada geométricamente (lote 3D-2: «adn» y «extraccion-adn»). Funciones PURAS.
 *
 * No hay en el repositorio coordenadas atómicas de un ADN-B, así que la hélice se construye con los parámetros estándar
 * del modelo de fibra del ADN-B (Watson y Crick, 1953; Arnott y Hukins, 1972):
 *   - 10,5 pares de bases por vuelta (giro de 360°/10,5 ≈ 34,3° por par),
 *   - 3,4 Å de subida por par (paso de la hélice ≈ 35,7 Å),
 *   - fosfatos a unos 10 Å del eje (diámetro ≈ 20 Å).
 * El desfase angular entre las dos columnas de un mismo par (≈ 140°) es una APROXIMACIÓN esquemática para que se vean el
 * surco menor (lado del ángulo pequeño) y el surco mayor (el resto de la vuelta); no es geometría atómica. Las bases se
 * dibujan como varillas desde la columna hasta el centro del par: es un modelo de palitos, no la forma de los anillos.
 * La secuencia y los apareamientos (A–T con 2 puentes de hidrógeno, G–C con 3) salen del modelo de cada práctica.
 */
import { fmt } from '../../lib/format';
import type { ColorToken } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';

export const BDNA = {
  /** Pares de bases por vuelta. */
  bpPerTurn: 10.5,
  /** Subida por par de bases (Å). */
  risePerBp: 3.4,
  /** Radio de los fosfatos (Å). */
  phosphateRadius: 10,
  /** Radio donde la base se une al azúcar (Å): la base sale de aquí hacia el centro del par. */
  sugarRadius: 8,
  /** Desfase angular entre las dos columnas de un par (grados): aproximación para mostrar los surcos. */
  minorGrooveDeg: 140,
} as const;

/** Giro por par de bases (grados): 360/10,5 ≈ 34,29°. */
export const TWIST_DEG = 360 / BDNA.bpPerTurn;
/** Paso de la hélice (Å): 10,5 × 3,4 = 35,7 Å. */
export const PITCH = BDNA.bpPerTurn * BDNA.risePerBp;

export type DnaBase = 'A' | 'T' | 'G' | 'C';
/** Colores de las bases: los mismos tonos que el laboratorio 2D (A rojo, T ámbar, G verde, C azul), como tokens. */
export const BASE_COLOR: Record<DnaBase, ColorToken> = { A: 'series-1', T: 'series-6', G: 'series-3', C: 'series-2' };
export const BASE_NAME: Record<DnaBase, string> = { A: 'adenina', T: 'timina', G: 'guanina', C: 'citosina' };
const PAIR: Record<DnaBase, DnaBase> = { A: 'T', T: 'A', G: 'C', C: 'G' };
/** Puentes de hidrógeno de un par: A–T 2, G–C 3; 0 si no son complementarias. */
export const hBondsOf = (a: DnaBase, b: DnaBase) => (PAIR[a] !== b ? 0 : a === 'A' || a === 'T' ? 2 : 3);
export const isBase = (c: string | null | undefined): c is DnaBase => c === 'A' || c === 'T' || c === 'G' || c === 'C';

const rad = (d: number) => (d * Math.PI) / 180;
const onCircle = (r: number, angleDeg: number, y: number): Vec3 => [r * Math.cos(rad(angleDeg)), y, -r * Math.sin(rad(angleDeg))];

export interface HelixStep {
  /** Altura del par sobre el centro de la hélice (Å). */
  y: number;
  /** Ángulo (grados) de la columna 1 y de la columna 2. */
  angle1: number;
  angle2: number;
  /** Fosfatos de cada columna. */
  p1: Vec3; p2: Vec3;
  /** Unión base–azúcar de cada columna. */
  s1: Vec3; s2: Vec3;
  /** Centro del par de bases (donde están los puentes de hidrógeno). */
  mid: Vec3;
}

/** Geometría de n pares de bases, centrada en y = 0 (el par 0 abajo). */
export function helixSteps(n: number): HelixStep[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const y = (i - (n - 1) / 2) * BDNA.risePerBp;
    const angle1 = i * TWIST_DEG;
    const angle2 = angle1 + BDNA.minorGrooveDeg;
    const s1 = onCircle(BDNA.sugarRadius, angle1, y), s2 = onCircle(BDNA.sugarRadius, angle2, y);
    return {
      y, angle1, angle2,
      p1: onCircle(BDNA.phosphateRadius, angle1, y), p2: onCircle(BDNA.phosphateRadius, angle2, y),
      s1, s2, mid: [(s1[0] + s2[0]) / 2, y, (s1[2] + s2[2]) / 2],
    };
  });
}

export type PairStatus = 'correcto' | 'error' | 'vacio';

export interface HelixInput {
  /** Prefijo de ids. */
  id: string;
  /** Hebra 1, leída 5′→3′ de abajo hacia arriba. */
  strand1: string;
  /** Base frente a cada base de la hebra 1 (null = espacio vacío). */
  strand2: readonly (string | null)[];
  /** Nombres de las hebras para los rótulos y la descripción. */
  name1: string;
  name2: string;
  /** Sentido de la hebra 2: antiparalela (5′ arriba) o paralela (5′ abajo, como la hebra 1). */
  orientation?: 'antiparalela' | 'paralela';
  /** Dibuja los puentes de hidrógeno y marca los pares que no son complementarios. */
  showPairing?: boolean;
  /** Par resaltado (p. ej., la mutación) y par elegido. */
  highlight?: number | null;
  highlightLabel?: string;
  selected?: number | null;
  /** Máximo de pares dibujados (el resto se informa en la descripción). */
  maxBp?: number;
  /** Color de la columna de la hebra 2 (p. ej., «data» para la hebra nueva). */
  color2?: ColorToken;
}

export interface HelixScene {
  items: SceneItem[];
  extent: number;
  target: Vec3;
  /** Pares dibujados. */
  n: number;
  /** Pares de la secuencia completa. */
  total: number;
  status: PairStatus[];
  hBonds: number;
  description: string;
}

/** Id del par al que pertenece una primitiva elegible (o null). */
export function pairFromId(prefix: string, id: string): number | null {
  const m = new RegExp(`^${prefix}-b(\\d+)-[12]$`).exec(id);
  return m ? Number(m[1]) : null;
}

/**
 * Doble hélice de la secuencia: columnas azúcar-fosfato (varillas entre fosfatos), bases como medias varillas de color
 * hacia el centro del par, extremos 5′ y 3′ rotulados y, si se pide, los puentes de hidrógeno (2 o 3 puntos por par
 * correcto) y los pares que no son complementarios.
 */
export function helixScene(input: HelixInput): HelixScene {
  const max = input.maxBp ?? 24;
  const total = input.strand1.length;
  const n = Math.min(total, max);
  const steps = helixSteps(n);
  const p = input.id;
  const antiparallel = (input.orientation ?? 'antiparalela') === 'antiparalela';
  const items: SceneItem[] = [];
  const status: PairStatus[] = [];
  let hBonds = 0;
  const bondPts: Vec3[] = [];
  const badPts: Vec3[] = [];

  // Columnas azúcar-fosfato.
  const col2 = input.color2 ?? 'series-7';
  for (let i = 0; i + 1 < n; i++) {
    items.push({ id: `${p}-c1-${i}`, kind: 'rod', from: steps[i].p1, to: steps[i + 1].p1, radius: 0.55, color: 'series-8' });
    const has2 = input.strand2[i] != null && input.strand2[i + 1] != null;
    items.push({ id: `${p}-c2-${i}`, kind: 'rod', from: steps[i].p2, to: steps[i + 1].p2, radius: has2 ? 0.55 : 0.25, color: col2, opacity: has2 ? 1 : 0.5 });
  }
  items.push({ id: `${p}-f1`, kind: 'particles', points: steps.map((s) => s.p1), radius: 1.0, color: 'series-8', label: `Columna azúcar-fosfato: ${input.name1}` });
  items.push({ id: `${p}-f2`, kind: 'particles', points: steps.filter((_, i) => input.strand2[i] != null).map((s) => s.p2), radius: 1.0, color: col2, label: `Columna azúcar-fosfato: ${input.name2}` });

  // Bases y apareamiento.
  for (let i = 0; i < n; i++) {
    const s = steps[i];
    const b1 = input.strand1[i] as DnaBase;
    const b2 = input.strand2[i] ?? null;
    const gap = 0.9; // Å: hueco en el centro del par donde se dibujan los puentes de hidrógeno
    const toward = (a: Vec3, b: Vec3, d: number): Vec3 => {
      const v: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [b[0] - (v[0] / l) * d, b[1] - (v[1] / l) * d, b[2] - (v[2] / l) * d];
    };
    const sel = input.selected === i;
    if (isBase(b1)) items.push({ id: `${p}-b${i}-1`, kind: 'rod', from: s.s1, to: toward(s.s1, s.mid, gap), radius: sel ? 0.95 : 0.75, color: BASE_COLOR[b1], selectable: true });
    let st: PairStatus = 'vacio';
    if (isBase(b2)) {
      items.push({ id: `${p}-b${i}-2`, kind: 'rod', from: s.s2, to: toward(s.s2, s.mid, gap), radius: sel ? 0.95 : 0.75, color: BASE_COLOR[b2], selectable: true });
      const hb = isBase(b1) ? hBondsOf(b1, b2) : 0;
      st = hb > 0 ? 'correcto' : 'error';
      if (hb > 0) {
        hBonds += hb;
        // Puntos sobre la línea que une las dos bases, en el centro del par.
        const dir: Vec3 = [s.s2[0] - s.s1[0], 0, s.s2[2] - s.s1[2]];
        const l = Math.hypot(dir[0], dir[2]) || 1;
        const perp: Vec3 = [-dir[2] / l, 0, dir[0] / l];
        for (let k = 0; k < hb; k++) {
          const o = (k - (hb - 1) / 2) * 0.75;
          bondPts.push([s.mid[0] + perp[0] * o, s.y, s.mid[2] + perp[2] * o]);
        }
      } else badPts.push(s.mid);
    }
    status.push(st);
  }
  if (input.showPairing && bondPts.length) items.push({ id: `${p}-hb`, kind: 'particles', points: bondPts, radius: 0.28, color: 'ink', label: 'Puentes de hidrógeno' });
  if (input.showPairing && badPts.length) items.push({ id: `${p}-mal`, kind: 'particles', points: badPts, radius: 0.9, color: 'bad', label: 'Par no complementario' });
  if (input.highlight != null && input.highlight >= 0 && input.highlight < n) {
    const s = steps[input.highlight];
    items.push({ id: `${p}-hl`, kind: 'sphere', center: s.mid, radius: 2.2, color: 'data', opacity: 0.35, label: input.highlightLabel ?? 'Par marcado' });
  }

  // Extremos 5′ y 3′ de cada hebra (la hebra 1 va 5′→3′ de abajo hacia arriba).
  if (n > 0) {
    const bottom = steps[0], top = steps[n - 1];
    const lift = (v: Vec3, dy: number): Vec3 => [v[0] * 1.12, v[1] + dy, v[2] * 1.12];
    items.push({ id: `${p}-e1a`, kind: 'sphere', center: lift(bottom.p1, -1.6), radius: 1.2, color: 'series-8', label: `5′ ${input.name1}` });
    items.push({ id: `${p}-e1b`, kind: 'sphere', center: lift(top.p1, 1.6), radius: 1.2, color: 'series-8', label: `3′ ${input.name1}` });
    if (input.strand2[0] != null) items.push({ id: `${p}-e2a`, kind: 'sphere', center: lift(bottom.p2, -1.6), radius: 1.2, color: col2, label: `${antiparallel ? '3′' : '5′'} ${input.name2}` });
    if (input.strand2[n - 1] != null) items.push({ id: `${p}-e2b`, kind: 'sphere', center: lift(top.p2, 1.6), radius: 1.2, color: col2, label: `${antiparallel ? '5′' : '3′'} ${input.name2}` });
  }

  const length = n * BDNA.risePerBp;
  const extent = Math.max(16, length / 2 + 6, BDNA.phosphateRadius + 6);
  const correct = status.filter((x) => x === 'correcto').length;
  const bad = status.filter((x) => x === 'error').length;
  const empty = status.filter((x) => x === 'vacio').length;
  const shown = n < total ? `los primeros ${n} de ${total} pares de bases` : `${n} pares de bases`;
  let description = `Doble hélice de ADN-B con ${shown}: ${fmt(n / BDNA.bpPerTurn, 1)} vueltas (10,5 pares por vuelta) y ${fmt(length, 0)} Å de largo (3,4 Å por par). `
    + `La ${input.name1} va de 5′ (abajo) a 3′ (arriba); la ${input.name2} ${antiparallel ? 'va en sentido contrario (antiparalela)' : 'va en el mismo sentido (paralela: así no se forma la doble hélice real)'}. `
    + 'Al girar la hélice se ven el surco mayor y el surco menor. ';
  if (input.showPairing) {
    description += `Pares A–T y G–C bien formados: ${correct}, con ${hBonds} puentes de hidrógeno en total (2 por A–T y 3 por G–C).`;
    if (bad) description += ` ${bad} ${bad === 1 ? 'par no es complementario' : 'pares no son complementarios'} (marcados en rojo).`;
    if (empty) description += ` ${empty} ${empty === 1 ? 'espacio está vacío' : 'espacios están vacíos'}.`;
  } else if (empty) description += `${empty} ${empty === 1 ? 'espacio de la segunda hebra está vacío' : 'espacios de la segunda hebra están vacíos'}.`;
  if (input.highlight != null && input.highlight >= 0) {
    description += input.highlight < n ? ` ${input.highlightLabel ?? 'Par marcado'}: par ${input.highlight + 1}.` : ` ${input.highlightLabel ?? 'El par marcado'} (par ${input.highlight + 1}) queda fuera de los pares dibujados.`;
  }
  return { items, extent, target: [0, 0, 0], n, total, status, hBonds, description };
}

/** Ficha del par elegido. */
export function pairInfo(strand1: string, strand2: readonly (string | null)[], i: number): string {
  const a = strand1[i], b = strand2[i] ?? null;
  if (!isBase(a)) return '';
  const na = `${a} (${BASE_NAME[a]})`;
  if (!isBase(b)) return `Par ${i + 1}: ${na} sin base enfrente.`;
  const hb = hBondsOf(a, b);
  return hb
    ? `Par ${i + 1}: ${na} con ${b} (${BASE_NAME[b]}), unidas por ${hb} puentes de hidrógeno. ${a === 'A' || a === 'G' ? 'La purina' : 'La pirimidina'} ${a} se aparea con ${a === 'A' || a === 'G' ? 'una pirimidina' : 'una purina'}: así el ancho de la hélice es constante.`
    : `Par ${i + 1}: ${na} frente a ${b} (${BASE_NAME[b]}): no son complementarias, no forman puentes de hidrógeno.`;
}

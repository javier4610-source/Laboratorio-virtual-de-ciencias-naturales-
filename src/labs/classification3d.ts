/**
 * Ejemplares 3D simplificados para usar y construir claves dicotómicas (kit src/three). Funciones PURAS: cada organismo
 * del modelo (`ORGANISMS`) se dibuja con primitivas según su plan corporal, y los caracteres que la clave pregunta salen
 * de los MISMOS datos del modelo: el número de patas (`legs`), las antenas, las aletas, las flores, los conos, los
 * soros con esporas, la concha, los anillos o el núcleo. Las formas, los colores y los tamaños son ilustrativos: todos
 * los ejemplares se muestran del mismo tamaño en pantalla (una bacteria mide unas micras; un perezoso, más de medio metro).
 */
import { has, type Organism } from '../models/classification';
import type { SceneItem, Vec3 } from '../three/scene';

type Col = SceneItem['color'];
interface Frame { c: Vec3; s: number; id: string; fade: number; labels: boolean }

function maker(f: Frame) {
  const items: SceneItem[] = [];
  const P = (p: Vec3): Vec3 => [f.c[0] + f.s * p[0], f.c[1] + f.s * p[1], f.c[2] + f.s * p[2]];
  const op = (o = 1) => o * f.fade;
  const L = (label?: string) => (f.labels && label ? { label } : {});
  let n = 0;
  const id = (k: string) => `${f.id}-${k}-${n++}`;
  return {
    items,
    sphere: (p: Vec3, r: number, color: Col, label?: string, o?: number) => items.push({ id: id('e'), kind: 'sphere', center: P(p), radius: r * f.s, color, opacity: op(o), ...L(label) }),
    ell: (p: Vec3, r: Vec3, color: Col, label?: string, o?: number) => items.push({ id: id('l'), kind: 'ellipsoid', center: P(p), radii: [r[0] * f.s, r[1] * f.s, r[2] * f.s], color, opacity: op(o), ...L(label) }),
    rod: (a: Vec3, b: Vec3, r: number, color: Col, label?: string, o?: number) => items.push({ id: id('r'), kind: 'rod', from: P(a), to: P(b), radius: r * f.s, color, opacity: op(o), ...L(label) }),
    box: (p: Vec3, size: Vec3, color: Col, rot = 0, label?: string) => items.push({ id: id('b'), kind: 'box', center: P(p), size: [size[0] * f.s, size[1] * f.s, size[2] * f.s], rotationZ: rot, color, opacity: op(), ...L(label) }),
    dots: (pts: Vec3[], r: number, color: Col, label?: string) => items.push({ id: id('p'), kind: 'particles', points: pts.map(P), radius: r * f.s, color, opacity: op(), ...L(label) }),
  };
}

const ring = (n: number, r: number, y = 0, phase = 0): Vec3[] => Array.from({ length: n }, (_, k) => [r * Math.cos(phase + (k / n) * 2 * Math.PI), y, r * Math.sin(phase + (k / n) * 2 * Math.PI)]);

/** Patas articuladas: `pairs` pares repartidos a lo largo del tramo [x0, x1] del cuerpo, con rodilla. */
function legs(m: ReturnType<typeof maker>, pairs: number, x0: number, x1: number, y: number, color: Col, total: number) {
  for (let k = 0; k < pairs; k++) {
    const x = pairs === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * k) / (pairs - 1);
    for (const side of [-1, 1]) {
      const knee: Vec3 = [x + (k - (pairs - 1) / 2) * 0.12, y + 0.18, side * 0.55];
      m.rod([x, y, side * 0.12], knee, 0.035, color, k === 0 && side === -1 ? `${total} patas articuladas` : undefined);
      m.rod(knee, [x + (k - (pairs - 1) / 2) * 0.25, -0.45, side * 0.85], 0.03, color);
    }
  }
}

/** Primitivas de un organismo centrado en `c` con tamaño de pantalla `s` (≈ 2·s de ancho). */
export function specimenItems(o: Organism, c: Vec3, s: number, opts: { id?: string; fade?: number; labels?: boolean } = {}): SceneItem[] {
  const m = maker({ c, s, id: opts.id ?? o.id, fade: opts.fade ?? 1, labels: opts.labels ?? true });
  const col = o.color;
  switch (o.body) {
    case 'insecto':
      m.sphere([0.75, 0, 0], 0.2, col, 'cabeza');
      m.ell([0.3, 0, 0], [0.25, 0.18, 0.17], col, 'tórax');
      m.ell([-0.4, 0, 0], [0.45, 0.25, 0.24], col, 'abdomen');
      legs(m, 3, 0.15, 0.45, -0.05, col, o.legs);
      for (const side of [-1, 1]) { m.rod([0.85, 0.12, side * 0.06], [1.1, 0.5, side * 0.3], 0.02, col, side === -1 ? 'antenas' : undefined); m.rod([1.1, 0.5, side * 0.3], [1.3, 0.45, side * 0.45], 0.02, col); }
      break;
    case 'aracnido':
      m.ell([0.35, 0, 0], [0.3, 0.2, 0.25], col, 'cefalotórax (sin antenas)');
      m.ell([-0.4, 0.05, 0], [0.45, 0.35, 0.35], col, 'abdomen');
      m.dots(ring(6, 0.03, 0.2, 0).map(([x, y, z]): Vec3 => [0.6 + x, y, z * 4]), 0.03, 'ink');
      legs(m, 4, 0.15, 0.55, -0.05, col, o.legs);
      break;
    case 'crustaceo':
      m.ell([0, 0, 0], [0.55, 0.25, 0.45], col, 'caparazón');
      legs(m, 4, -0.35, 0.25, -0.05, col, o.legs);
      for (const side of [-1, 1]) { m.rod([0.4, 0, side * 0.3], [0.75, 0.05, side * 0.6], 0.06, col); m.ell([0.85, 0.08, side * 0.7], [0.18, 0.1, 0.12], col, side === -1 ? 'pinzas (el primer par de patas)' : undefined); }
      for (const side of [-1, 1]) { m.rod([0.5, 0.15, side * 0.1], [0.95, 0.35, side * 0.25], 0.015, 'ink-2', side === -1 ? 'dos pares de antenas' : undefined); m.rod([0.5, 0.12, side * 0.05], [0.8, 0.25, side * 0.08], 0.012, 'ink-2'); }
      break;
    case 'anelido':
      m.dots(Array.from({ length: 16 }, (_, k): Vec3 => [-0.95 + k * 0.125, 0.12 * Math.sin(k * 0.7), 0.25 * Math.sin(k * 0.35)]), 0.09, col, 'cuerpo blando en anillos');
      break;
    case 'molusco':
      m.ell([-0.1, -0.25, 0], [0.75, 0.13, 0.2], col, 'cuerpo blando');
      for (let k = 0; k < 5; k++) m.sphere([-0.1 + 0.07 * k, 0.05 + 0.13 * k, 0], 0.38 - 0.07 * k, '#c9a36a', k === 0 ? 'concha (sin anillos)' : undefined);
      m.rod([0.55, -0.2, 0.05], [0.8, 0.15, 0.1], 0.02, col);
      m.rod([0.55, -0.2, -0.05], [0.8, 0.15, -0.1], 0.02, col);
      break;
    case 'pez':
      m.ell([0, 0, 0], [0.75, 0.32, 0.16], col, 'cuerpo con escamas húmedas');
      m.box([-0.9, 0, 0], [0.04, 0.55, 0.04], col, 0, 'aletas');
      m.box([-0.95, 0, 0], [0.3, 0.04, 0.04], col, 0.6);
      m.box([-0.95, 0, 0], [0.3, 0.04, 0.04], col, -0.6);
      m.box([0.05, 0.36, 0], [0.4, 0.12, 0.03], col, 0.2);
      m.ell([0.35, -0.12, 0.17], [0.15, 0.05, 0.02], col);
      m.sphere([0.55, 0.08, 0.13], 0.05, 'ink');
      m.ell([0.4, 0, 0.15], [0.03, 0.18, 0.02], 'ink-2', 'opérculo (cubre las branquias)');
      break;
    case 'anfibio':
      m.ell([0, 0, 0], [0.5, 0.25, 0.4], col, 'piel húmeda, sin escamas');
      m.ell([0.5, 0.05, 0], [0.25, 0.18, 0.3], col);
      for (const side of [-1, 1]) {
        m.sphere([0.6, 0.22, side * 0.15], 0.07, 'ink');
        m.rod([0.3, -0.1, side * 0.3], [0.45, -0.4, side * 0.5], 0.06, col, side === -1 ? '4 patas' : undefined);
        m.rod([-0.35, -0.1, side * 0.3], [-0.6, -0.4, side * 0.65], 0.08, col);
      }
      break;
    case 'reptil':
      m.ell([0, 0, 0], [0.55, 0.18, 0.22], col, 'piel seca con escamas');
      m.ell([0.7, 0.05, 0], [0.22, 0.12, 0.13], col);
      m.rod([-0.5, 0, 0], [-1.25, -0.1, 0], 0.07, col, 'cola');
      m.dots(Array.from({ length: 8 }, (_, k): Vec3 => [0.45 - k * 0.13, 0.2, 0]), 0.035, col);
      for (const side of [-1, 1]) { m.rod([0.3, -0.05, side * 0.18], [0.35, -0.4, side * 0.45], 0.05, col, side === -1 ? '4 patas' : undefined); m.rod([-0.35, -0.05, side * 0.18], [-0.4, -0.4, side * 0.45], 0.05, col); }
      break;
    case 'ave':
      m.ell([0, 0.1, 0], [0.45, 0.25, 0.22], col, 'cuerpo cubierto de plumas');
      m.rod([0.35, 0.2, 0], [0.55, 0.75, 0], 0.06, col);
      m.sphere([0.6, 0.82, 0], 0.11, col);
      m.rod([0.68, 0.82, 0], [1.05, 0.75, 0], 0.03, '#e3a008', 'pico sin dientes');
      m.box([-0.15, 0.2, 0.2], [0.6, 0.05, 0.02], col, -0.2, 'alas');
      m.box([-0.15, 0.2, -0.2], [0.6, 0.05, 0.02], col, -0.2);
      for (const side of [-1, 1]) m.rod([0, -0.1, side * 0.08], [0.05, -0.9, side * 0.12], 0.025, 'ink', side === -1 ? '2 patas' : undefined);
      break;
    case 'mamifero':
      m.rod([-1.2, 0.75, 0], [1.2, 0.75, 0], 0.06, '#6b4a2b', 'rama');
      m.ell([0, 0.25, 0], [0.5, 0.28, 0.3], col, 'cuerpo cubierto de pelo');
      m.sphere([0.6, 0.15, 0], 0.18, col);
      for (const [x, side] of [[0.35, -1], [0.35, 1], [-0.35, -1], [-0.35, 1]] as [number, number][]) m.rod([x, 0.35, side * 0.2], [x + 0.1, 0.75, side * 0.12], 0.05, col, x > 0 && side === -1 ? '4 patas con garras' : undefined);
      break;
    case 'musgo':
      m.box([0, -0.55, 0], [1.8, 0.3, 1.2], '#7d7468', 0, 'piedra húmeda');
      for (let k = 0; k < 14; k++) { const a = k * 2.4, r = 0.15 + 0.05 * (k % 6); m.rod([r * Math.cos(a), -0.4, r * Math.sin(a) * 1.5], [r * Math.cos(a), -0.05 - 0.03 * (k % 3), r * Math.sin(a) * 1.5], 0.025, col, k === 0 ? 'plantas pequeñas sin vasos' : undefined); }
      m.dots(Array.from({ length: 6 }, (_, k): Vec3 => [0.15 * Math.cos(k), 0.25, 0.2 * Math.sin(k * 1.3)]), 0.035, '#8a6a3b', 'cápsulas con esporas');
      break;
    case 'helecho':
      m.rod([0, -0.9, 0], [0, 0.2, 0], 0.08, '#5b4630', 'tallo con vasos');
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 2 * Math.PI, end: Vec3 = [0.85 * Math.cos(a), 0.05, 0.85 * Math.sin(a)];
        m.rod([0, 0.2, 0], end, 0.025, col, k === 0 ? 'frondas (hojas)' : undefined);
        m.dots(Array.from({ length: 5 }, (_, j): Vec3 => [end[0] * (0.3 + 0.14 * j), 0.2 - 0.03 * j - 0.02, end[2] * (0.3 + 0.14 * j)]), 0.025, '#8a5a2b', k === 0 ? 'soros con esporas (sin semillas)' : undefined);
      }
      break;
    case 'conifera':
      m.rod([0, -0.95, 0], [0, 0.95, 0], 0.07, '#5b4630', 'tronco con vasos');
      for (let k = 0; k < 4; k++) m.ell([0, -0.35 + k * 0.38, 0], [0.62 - 0.13 * k, 0.24, 0.62 - 0.13 * k], col, k === 0 ? 'hojas en aguja' : undefined);
      m.ell([0.45, -0.45, 0.2], [0.07, 0.13, 0.07], '#8a5a2b', 'conos con semillas desnudas (sin flores)');
      m.ell([-0.35, -0.1, -0.3], [0.07, 0.13, 0.07], '#8a5a2b');
      break;
    case 'monocot':
      m.rod([0, -0.95, 0], [0, 0.35, 0], 0.12, '#7a8a3a', 'pseudotallo');
      for (let k = 0; k < 5; k++) { const a = (k / 5) * 2 * Math.PI; m.ell([0.5 * Math.cos(a), 0.55, 0.5 * Math.sin(a)], [0.5 * Math.abs(Math.cos(a)) + 0.08, 0.04, 0.5 * Math.abs(Math.sin(a)) + 0.08], col, k === 0 ? 'hojas con nervaduras paralelas' : undefined); }
      m.dots(Array.from({ length: 9 }, (_, k): Vec3 => [0.2 + 0.05 * (k % 3), -0.05 - 0.1 * Math.floor(k / 3), 0.06 * ((k % 3) - 1)]), 0.06, '#e8cf4a', 'racimo (frutos)');
      m.ell([0.22, -0.42, 0], [0.07, 0.13, 0.07], '#7b2d4a', 'flor (bellota)');
      break;
    case 'dicot':
      m.rod([0, -0.95, 0], [0, 0.2, 0], 0.09, '#5b4630', 'tronco con vasos');
      m.ell([0, 0.5, 0], [0.75, 0.45, 0.75], col, 'hojas con nervaduras en red', 0.9);
      m.ell([0.13, -0.3, 0.05], [0.07, 0.16, 0.07], '#c98a2b', 'frutos (mazorcas) con semillas');
      m.ell([-0.12, -0.55, -0.05], [0.07, 0.16, 0.07], '#c98a2b');
      m.dots([[0.1, -0.05, 0.1], [-0.1, 0.0, 0.08]], 0.03, '#f2efe6', 'flores');
      break;
    case 'mangle':
      m.rod([0, -0.3, 0], [0, 0.3, 0], 0.08, '#5b4630', 'tronco');
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 2 * Math.PI; m.rod([0, -0.2, 0], [0.7 * Math.cos(a), -0.95, 0.7 * Math.sin(a)], 0.035, '#5b4630', k === 0 ? 'raíces en zancos' : undefined); }
      m.ell([0, 0.6, 0], [0.7, 0.35, 0.7], col, 'hojas con nervaduras en red', 0.9);
      m.rod([0.3, 0.3, 0.2], [0.32, -0.15, 0.22], 0.025, '#4f6a2e', 'propágulo (semilla que germina en el árbol)');
      break;
    case 'seta':
      m.rod([0, -0.9, 0], [0, 0.15, 0], 0.13, col, 'pie');
      m.ell([0, 0.25, 0], [0.7, 0.28, 0.7], col, 'sombrero (cuerpo fructífero)');
      m.dots(ring(16, 0.45, 0.06), 0.03, '#6b4a3b', 'láminas con esporas');
      break;
    case 'moho':
      m.ell([0, 0, 0], [1.0, 0.03, 0.5], '#5a9a3a', 'hoja de banano');
      m.dots(Array.from({ length: 18 }, (_, k): Vec3 => [-0.75 + (k % 9) * 0.18, 0.04, -0.2 + 0.35 * Math.floor(k / 9) + 0.05 * Math.sin(k)]), 0.06, col, 'rayas negras: el hongo (hifas)');
      break;
    case 'levadura':
      m.ell([0, 0, 0], [0.45, 0.38, 0.38], col, 'célula con núcleo y pared de quitina', 0.85);
      m.sphere([0.05, 0, 0], 0.13, 'series-4', 'núcleo');
      m.ell([0.55, 0.25, 0], [0.2, 0.17, 0.17], col, 'yema (célula hija)', 0.85);
      break;
    case 'ciliado':
      m.ell([0, 0, 0], [0.85, 0.3, 0.28], col, 'una sola célula con núcleo', 0.75);
      m.ell([0.05, 0, 0], [0.2, 0.12, 0.12], 'series-4', 'núcleo');
      m.dots([...ring(14, 0.32, 0.0), ...Array.from({ length: 12 }, (_, k): Vec3 => [-0.75 + k * 0.14, 0.31, 0])], 0.025, 'ink-2', 'cilios');
      break;
    case 'parasito':
      for (const [x, z] of [[-0.45, -0.2], [0.45, 0.15], [0, 0.45]] as [number, number][]) m.ell([x, 0, z], [0.38, 0.12, 0.38], '#b4232c', x === -0.45 ? 'glóbulos rojos de la sangre' : undefined, 0.85);
      m.dots(ring(8, 0.12, 0.14).map(([x, y, z]): Vec3 => [x + 0.45, y, z + 0.15]), 0.03, col, 'el parásito dentro de un glóbulo (una célula con núcleo)');
      break;
    case 'bacilo':
      for (const [x, y, a] of [[-0.5, 0.2, 0], [0.4, -0.1, 0.5], [0, -0.45, -0.3], [0.55, 0.45, 0.2]] as [number, number, number][]) m.box([x, y, 0], [0.55, 0.18, 0.18], col, a, x === -0.5 ? 'células sin núcleo (bacilos)' : undefined);
      break;
    case 'arquea':
      for (const [x, y, a] of [[-0.5, 0.2, 0.2], [0.4, -0.1, -0.4], [0, -0.45, 0.1], [0.5, 0.45, 0.6]] as [number, number, number][]) m.box([x, y, 0], [0.5, 0.2, 0.06], col, a, x === -0.5 ? 'células sin núcleo (arqueas)' : undefined);
      break;
  }
  return m.items;
}

/** Un ejemplar grande, con sus rótulos, para usar la clave. */
export function specimenScene(o: Organism): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const items: SceneItem[] = [{ id: 'base', kind: 'plane', center: [0, -1.0, 0], size: [2.8, 2.8], color: 'surface-3', opacity: 0.9 }, ...specimenItems(o, [0, 0, 0], 1)];
  const feats: string[] = [];
  if (o.legs) feats.push(`${o.legs} patas`);
  if (has(o, 'antenas')) feats.push('antenas');
  if (o.body === 'bacilo' || o.body === 'arquea') feats.push('células sin núcleo');
  const description = `Ejemplar: ${o.common} (${o.scientific}). ${feats.length ? `Se ve: ${feats.join(', ')}. ` : ''}Gíralo para observar el carácter que pide la clave. Forma simplificada, sin escala.`;
  return { items, extent: 1.55, target: [0, 0, 0], description };
}

/** Bandeja con todos los ejemplares de un grupo; los del grupo que falta separar se ven opacos y el resto tenue. */
export function trayScene(members: Organism[], active: Set<string>): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const cols = members.length <= 6 ? 3 : 4;
  const rows = Math.ceil(members.length / cols);
  const gap = 2.1;
  const items: SceneItem[] = [{ id: 'bandeja', kind: 'plane', center: [0, -0.9, 0], size: [cols * gap + 0.4, rows * gap + 0.4], color: 'surface-3', opacity: 0.8 }];
  members.forEach((o, k) => {
    const x = ((k % cols) - (cols - 1) / 2) * gap, z = (Math.floor(k / cols) - (rows - 1) / 2) * gap;
    const on = active.has(o.id);
    const parts = specimenItems(o, [x, 0, z], 0.8, { id: `b-${o.id}`, fade: on ? 1 : 0.25, labels: false });
    parts[0] = { ...parts[0], label: o.common };
    items.push(...parts);
  });
  const act = members.filter((o) => active.has(o.id)).map((o) => o.common);
  const description = `Bandeja con ${members.length} ejemplares: ${members.map((o) => o.common).join(', ')}. ${act.length > 1 ? `Falta separar (se ven opacos): ${act.join(', ')}.` : 'Tu clave ya separa a todos.'} Formas simplificadas, sin escala.`;
  return { items, extent: Math.max(cols, rows) * gap * 0.42 + 0.5, target: [0, -0.3, 0], description };
}

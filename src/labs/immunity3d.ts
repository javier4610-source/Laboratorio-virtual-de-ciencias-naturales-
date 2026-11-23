/**
 * Sistema inmune en 3D (kit src/three), con el MISMO modelo del laboratorio (src/models/immunity.ts).
 *
 * - Población: una cuadrícula de 20 × 20 personas (esferas) repartidas entre susceptibles, infectadas, recuperadas y
 *   protegidas por la vacuna en la MISMA proporción que el modelo SIR en el día elegido (cada esfera es 1/400 de la
 *   población; la posición de cada persona es un esquema, no una red de contactos).
 * - Anticuerpos: anticuerpos en forma de Y (dos brazos con los sitios de unión y un tallo) en número proporcional al
 *   título de anticuerpos del modelo, unidos a los antígenos del microbio; la forma es un ESQUEMA (no es la estructura
 *   de una IgG del PDB) y la curva de la respuesta es ilustrativa.
 */
import { fmt } from '../lib/format';
import { seededRandom } from '../models/math';
import type { SceneItem, Vec3 } from '../three/scene';

export const GRID = 20;
export interface PopulationInput { S: number; I: number; R: number; V: number; day: number }

/** Número de esferas de cada grupo (suman GRID²) con el método del mayor resto. */
export function splitCounts(f: Record<'S' | 'I' | 'R' | 'V', number>, total = GRID * GRID): Record<'S' | 'I' | 'R' | 'V', number> {
  const keys = ['V', 'R', 'I', 'S'] as const;
  const sum = keys.reduce((s, k) => s + Math.max(0, f[k]), 0) || 1;
  const raw = keys.map((k) => (Math.max(0, f[k]) / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return { V: out[0], R: out[1], I: out[2], S: out[3] };
}

export function populationScene({ S, I, R, V, day }: PopulationInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; counts: Record<'S' | 'I' | 'R' | 'V', number> } {
  const counts = splitCounts({ S, I, R, V });
  // Orden fijo y mezclado por semilla: cada posición de la cuadrícula tiene siempre el mismo rango.
  const rnd = seededRandom(9);
  const order = Array.from({ length: GRID * GRID }, (_, i) => i).map((i) => [rnd(), i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const pos = (i: number): Vec3 => [((i % GRID) - (GRID - 1) / 2) * 0.16, 0, (Math.floor(i / GRID) - (GRID - 1) / 2) * 0.16];
  const groups: { key: 'V' | 'R' | 'I' | 'S'; color: SceneItem['color']; label: string; tag: string }[] = [
    { key: 'V', color: 'info', label: 'protegidas por la vacuna', tag: 'vacunadas' },
    { key: 'R', color: 'ok', label: 'recuperadas (inmunes)', tag: 'recuperadas' },
    { key: 'I', color: 'bad', label: 'infectadas (contagian)', tag: 'infectadas' },
    { key: 'S', color: 'line-strong', label: 'susceptibles', tag: 'susceptibles' },
  ];
  const items: SceneItem[] = [{ id: 'suelo', kind: 'plane', center: [0, -0.08, 0], size: [3.4, 3.4], color: 'surface-3', opacity: 0.5, label: 'población (esquema)', tag: '' }];
  let k = 0;
  for (const g of groups) {
    const pts: Vec3[] = [];
    for (let j = 0; j < counts[g.key]; j++) { const p = pos(order[k++]); pts.push([p[0], g.key === 'I' ? 0.06 : 0, p[2]]); }
    if (pts.length) items.push({ id: `grupo-${g.key}`, kind: 'particles', points: pts, radius: g.key === 'I' ? 0.07 : 0.055, color: g.color, label: `${g.label}: ${counts[g.key]} de 400`, tag: '' });
  }
  const pct = (n: number) => fmt((n / (GRID * GRID)) * 100, 0);
  const description = `Día ${fmt(day, 0)}: de cada 400 personas, ${counts.S} son susceptibles (${pct(counts.S)} %), ${counts.I} están infectadas, ${counts.R} se recuperaron y ${counts.V} están protegidas por la vacuna. Cada esfera es 1/400 de la población del modelo; la posición es un esquema.`;
  return { items, extent: 1.9, target: [0, 0, 0], description, counts };
}

export const MAX_ANTIBODIES = 14;
/** Anticuerpos en Y alrededor de un microbio, en número proporcional al título (1 = pico primario → 2 anticuerpos; 20 → 14). */
export function antibodyScene(titer: number, day: number, maxTiter = 20): { items: SceneItem[]; extent: number; target: Vec3; description: string; n: number } {
  const n = Math.min(MAX_ANTIBODIES, Math.round((titer / maxTiter) * MAX_ANTIBODIES + (titer > 0.05 ? 1 : 0)));
  const items: SceneItem[] = [
    { id: 'microbio', kind: 'sphere', center: [0, 0, 0], radius: 0.45, color: 'series-6', opacity: 0.85, label: 'microbio (esquema)', tag: 'microbio' },
  ];
  // Antígenos: 14 salientes en la superficie del microbio (los mismos sitios para los anticuerpos).
  const sites: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < MAX_ANTIBODIES; i++) {
    const y = 1 - (2 * (i + 0.5)) / MAX_ANTIBODIES, r = Math.sqrt(1 - y * y), a = i * golden;
    sites.push([r * Math.cos(a), y, r * Math.sin(a)]);
  }
  items.push({ id: 'antigenos', kind: 'particles', points: sites.map((d) => [d[0] * 0.52, d[1] * 0.52, d[2] * 0.52] as Vec3), radius: 0.07, color: 'series-1', label: 'antígenos del microbio', tag: '' });
  for (let i = 0; i < n; i++) {
    const d = sites[i];
    const tip: Vec3 = [d[0] * 0.6, d[1] * 0.6, d[2] * 0.6];
    const fork: Vec3 = [d[0] * 0.95, d[1] * 0.95, d[2] * 0.95];
    const end: Vec3 = [d[0] * 1.35, d[1] * 1.35, d[2] * 1.35];
    // Perpendicular para abrir los brazos.
    const p: Vec3 = Math.abs(d[1]) < 0.9 ? [-d[2], 0, d[0]] : [1, 0, 0];
    const pl = Math.hypot(...p);
    const off: Vec3 = [(p[0] / pl) * 0.16, (p[1] / pl) * 0.16, (p[2] / pl) * 0.16];
    const armA: Vec3 = [tip[0] + off[0], tip[1] + off[1], tip[2] + off[2]];
    const armB: Vec3 = [tip[0] - off[0], tip[1] - off[1], tip[2] - off[2]];
    items.push({ id: `ac-${i}-a`, kind: 'rod', from: fork, to: armA, radius: 0.035, color: 'info', label: i === 0 ? 'anticuerpos (forma de Y, esquema)' : undefined, tag: i === 0 ? 'anticuerpo' : '' });
    items.push({ id: `ac-${i}-b`, kind: 'rod', from: fork, to: armB, radius: 0.035, color: 'info', tag: '' });
    items.push({ id: `ac-${i}-tallo`, kind: 'rod', from: fork, to: end, radius: 0.04, color: 'info', tag: '' });
  }
  const description = `Día ${fmt(day, 0)}: título de anticuerpos ${fmt(titer, 2)} veces el pico de la respuesta primaria; ${n} anticuerpos dibujados unidos a los antígenos del microbio. Cada anticuerpo se une solo a su antígeno complementario por los extremos de sus brazos. La forma y la curva son ilustrativas.`;
  return { items, extent: 1.6, target: [0, 0, 0], description, n };
}

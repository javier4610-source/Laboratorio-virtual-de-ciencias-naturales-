/**
 * Meiosis en 3D (kit src/three). Funciones PURAS con el MISMO modelo del laboratorio (src/models/meiosis.ts): cada
 * cromátida es una varilla vertical (eje y de la escena) con sus segmentos de color materno (series-1) o paterno (series-2) y los
 * alelos marcados en sus loci. Las posiciones de cada etapa se calculan a partir del destino de cada cromátida en la
 * meiosis concreta (orientación, entrecruzamiento y no disyunción); las anafases interpolan entre la metafase y la
 * telofase con el avance de la simulación. Ilustración sin escala.
 */
import { fmt } from '../lib/format';
import { chromatidsOf, LOCI, meiosisGametes, STAGES, stageCounts, type Chromatid, type MeiosisConfig } from '../models/meiosis';
import type { SceneItem, Vec3 } from '../three/scene';

export const CHROM_LENGTH = [2.6, 2.0, 1.5];
const CX = [-2.75, 2.75];
const SIS = 0.13;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const chromKey = (c: Chromatid) => `${c.pair}${c.homolog}`;

interface Dest { cell: 0 | 1; gamete: number }
/** Célula de la meiosis I y gameto final de cada cromátida (igual que meiosisGametes). */
export function destinations(cfg: MeiosisConfig): Map<string, Dest> {
  const out = new Map<string, Dest>();
  meiosisGametes(cfg).forEach((g) => g.chromatids.forEach((c) => out.set(`${chromKey(c)}${c.sister}`, { cell: (g.index < 2 ? 0 : 1) as 0 | 1, gamete: g.index })));
  return out;
}

/** Posición (x, profundidad z) del centrómero de una cromátida en una etapa estática; la cromátida es vertical. */
export function staticPosition(c: Chromatid, stageId: string, cfg: MeiosisConfig, dest: Map<string, Dest>): [number, number] {
  const P = cfg.pairs;
  const yk = (c.pair - (P - 1) / 2) * 1.5;
  const sd = c.sister === 0 ? -SIS : SIS;
  const d = dest.get(`${chromKey(c)}${c.sister}`)!;
  // ranura del cromosoma dentro de su célula de la meiosis I
  const inCell = [...new Set([...dest.entries()].filter(([, v]) => v.cell === d.cell).map(([k]) => k.slice(0, 2)))].sort();
  const slot = inCell.indexOf(chromKey(c));
  const xoff = (slot - (inCell.length - 1) / 2) * 0.75;
  const left = c.homolog === (cfg.orientation[c.pair] ? 'm' : 'p');
  switch (stageId) {
    case 'g1': return [(c.homolog === 'm' ? -1.1 : 1.1) + c.pair * 0.25, yk + (c.homolog === 'm' ? 0.3 : -0.3)];
    case 's': return [(c.homolog === 'm' ? -1.1 : 1.1) + c.pair * 0.25 + sd, yk + (c.homolog === 'm' ? 0.3 : -0.3)];
    case 'profase1': case 'metafase1': return [(left ? -0.38 : 0.38) + sd, yk];
    case 'telofase1': case 'profase2': return [CX[d.cell] + sd, xoff];
    case 'metafase2': case 'telofase2': {
      const up = d.gamete % 2 === 0;
      const together = [...dest.entries()].filter(([k, v]) => k.slice(0, 2) === chromKey(c) && v.gamete === d.gamete).length > 1;
      const dx = together ? sd : 0;
      return stageId === 'metafase2' ? [CX[d.cell] + (together ? -0.16 + dx : up ? -0.16 : 0.16), xoff] : [CX[d.cell] + (up ? -1.5 : 1.5) + dx, xoff];
    }
    default: return [0, 0];
  }
}

export interface MeiosisSceneInput { cfg: MeiosisConfig; stage: number; progress: number }
export function meiosisScene({ cfg, stage, progress }: MeiosisSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const st = STAGES[stage].id;
  const dest = destinations(cfg);
  const chs = chromatidsOf(cfg, stage >= 2).filter((c) => st !== 'g1' || c.sister === 0);
  const items: SceneItem[] = [];
  // membranas
  if (stage <= 4) items.push({ id: 'celula', kind: 'ellipsoid', center: [0, 0, 0], radii: [4.3, 2.4, 3.0], color: 'bio', opacity: 0.1, label: 'célula 2n' });
  else if (stage <= 8) CX.forEach((x, i) => items.push({ id: `celula-${i}`, kind: 'ellipsoid', center: [x, 0, 0], radii: [2.6, 2.2, 2.4], color: 'bio', opacity: 0.1, label: `célula ${i + 1} (n)` }));
  else {
    const gam = meiosisGametes(cfg);
    gam.forEach((g) => items.push({ id: `gameto-${g.index}`, kind: 'ellipsoid', center: [CX[g.index < 2 ? 0 : 1] + (g.index % 2 === 0 ? -1.5 : 1.5), 0, 0], radii: [1.35, 1.7, 1.7], color: 'bio', opacity: 0.12,
      label: `gameto ${g.index + 1}: ${g.genotype}${g.chromosomeCount !== cfg.pairs ? ` (n ${g.chromosomeCount > cfg.pairs ? '+' : '−'} 1)` : ''}${g.recombinant ? ' · recombinante' : ''}` }));
  }
  // huso en las metafases y anafases
  const poles: Vec3[] | null = st === 'metafase1' || st === 'anafase1' ? [[-3.9, 0, 0], [3.9, 0, 0]] : null;
  if (poles) poles.forEach((p, i) => items.push({ id: `polo-${i}`, kind: 'sphere', center: p, radius: 0.14, color: 'ink-3' }));
  const pos = (c: Chromatid): [number, number] => {
    if (st === 'anafase1') { const a = staticPosition(c, 'metafase1', cfg, dest), b = staticPosition(c, 'telofase1', cfg, dest); return [lerp(a[0], b[0], progress), lerp(a[1], b[1], progress)]; }
    if (st === 'anafase2') { const a = staticPosition(c, 'metafase2', cfg, dest), b = staticPosition(c, 'telofase2', cfg, dest); return [lerp(a[0], b[0], progress), lerp(a[1], b[1], progress)]; }
    return staticPosition(c, st, cfg, dest);
  };
  for (const c of chs) {
    const [x, y] = pos(c);
    const L = CHROM_LENGTH[c.pair];
    const id = `${chromKey(c)}${c.sister}`;
    c.segments.forEach((s, i) => items.push({ id: `cr-${id}-${i}`, kind: 'rod', from: [x, -L / 2 + L * s.from, y], to: [x, -L / 2 + L * s.to, y], radius: 0.12, color: s.origin === 'm' ? 'series-1' : 'series-2' }));
    items.push({ id: `cen-${id}`, kind: 'sphere', center: [x, 0, y], radius: 0.15, color: 'ink-3' });
    for (const l of LOCI.filter((q) => q.pair === c.pair)) items.push({ id: `loc-${id}-${l.gene}`, kind: 'sphere', center: [x, -L / 2 + L * l.pos, y], radius: 0.15, color: 'ink' });
    if (poles && c.sister === 0) {
      const pole = poles[x < 0 ? 0 : 1];
      items.push({ id: `huso-${id}`, kind: 'rod', from: pole, to: [x, 0, y], radius: 0.02, color: 'line-strong', opacity: 0.8 });
    }
  }
  if (cfg.crossover !== null && (st === 'profase1' || st === 'metafase1')) {
    const L = CHROM_LENGTH[0];
    const m = chs.find((c) => c.pair === 0 && c.homolog === 'm' && c.sister === 1)!, p = chs.find((c) => c.pair === 0 && c.homolog === 'p' && c.sister === 0)!;
    const a = pos(m), b = pos(p);
    items.push({ id: 'quiasma', kind: 'sphere', center: [(a[0] + b[0]) / 2, -L / 2 + L * cfg.crossover, (a[1] + b[1]) / 2], radius: 0.2, color: 'data', label: 'quiasma (entrecruzamiento)' });
  }
  // rótulos de los alelos del par 1 (una sola vez, en el homólogo materno y el paterno)
  if (stage >= 1 && stage <= 3) {
    for (const h of ['m', 'p'] as const) {
      const c = chs.find((q) => q.pair === 0 && q.homolog === h && q.sister === 0)!;
      const [x, y] = pos(c);
      items.push({ id: `rot-${h}`, kind: 'sphere', center: [x, CHROM_LENGTH[0] / 2 + 0.3, y], radius: 0.01, color: h === 'm' ? 'series-1' : 'series-2', label: h === 'm' ? 'materno (A, B)' : 'paterno (a, b)' });
    }
  }
  const n2 = cfg.pairs * 2;
  const k = stageCounts(stage, n2);
  const gam = meiosisGametes(cfg);
  const description = `${STAGES[stage].name}${st.startsWith('anafase') ? ` (${fmt(progress * 100, 0)} % del movimiento)` : ''}: ${STAGES[stage].text} ${k.cells === 1 ? 'Una célula' : `${k.cells} células`} con ${k.chromosomes} cromosomas y ${k.chromatids} cromátidas cada una (${k.dnaC}c de ADN).` +
    ` Rojo: segmentos de origen materno; azul: paterno.${cfg.crossover !== null && stage >= 2 ? ` Hay un entrecruzamiento en el par 1 a ${fmt(cfg.crossover * 100, 0)} % de su longitud.` : ''}` +
    (stage === 9 ? ` Gametos: ${gam.map((g) => g.genotype).join('; ')}.` : '');
  return { items, extent: 5.8, target: [0, 0, 0], description };
}

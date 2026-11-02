/**
 * «mitosis» (lote 3D-2): célula del meristemo de raíz de cebolla en 3D con sus 16 cromosomas (2n = 16, 8 pares de
 * homólogos del mismo color), el huso y la placa celular, en la etapa del ciclo que eligió el estudiante. Funciones PURAS
 * a partir del MISMO estado del laboratorio: `cycleState(t)` (etapa, ADN en valores C, número de cromosomas, cromátidas
 * por cromosoma y núcleos) y las duraciones del tejido (avance dentro de la etapa). Lo que se replica en S sigue el ADN
 * del modelo (2C → 4C). Formas, tamaños y posiciones son ilustrativos (no hay medidas de cromosomas en la práctica).
 */
import { CYCLE_STAGES, cycleState, ONION_2N, PHASE_INFO, TISSUES, type CycleState, type Tissue } from '../../models/mitosis';
import { seededRandom } from '../../models/math';
import { fmt } from '../../lib/format';
import type { ColorToken } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';

export type Stage = CycleState['stage'];

/** Etapa del ciclo y avance (0–1) dentro de ella en el tiempo t (h), con las duraciones del tejido. */
export function stageProgress(tHours: number, tissue: Tissue = TISSUES[0]): { state: CycleState; progress: number } {
  const T = tissue.cycleHours;
  const t = ((tHours % T) + T) % T;
  const d = tissue.durations;
  const bounds: [Stage, number][] = [['G1', CYCLE_STAGES.G1], ['S', CYCLE_STAGES.S], ['G2', CYCLE_STAGES.G2], ['profase', d.profase], ['metafase', d.metafase], ['anafase', d.anafase], ['telofase', d.telofase]];
  const state = cycleState(tHours, tissue);
  let start = 0;
  for (const [stage, len] of bounds) {
    if (stage === state.stage) return { state, progress: len > 0 ? Math.min(1, Math.max(0, (t - start) / len)) : 0 };
    start += len;
  }
  return { state, progress: 0 };
}

/** Una cromátida: dos brazos que salen del centrómero (e1 ← c → e2). */
export interface Chromatid { c: Vec3; e1: Vec3; e2: Vec3 }
export interface Chromosome { pair: number; chromatids: Chromatid[]; condensed: number }

/** Posición x de los polos del huso. */
export const POLE_X = 9;
const PLATE_R = 5.5;
const NUCLEUS_R = 5.2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
/** Largo de un brazo condensado del par k (los pares van de mayor a menor, como en un cariotipo). */
export const armLength = (pair: number) => 1.9 - 0.12 * pair;

/**
 * Cromosomas de la etapa: posiciones y forma. `replicated` (0–1) es la fracción del ADN ya copiada ((C − 2)/2 del modelo):
 * en G1 cada cromosoma tiene una cromátida; en S la segunda crece con el ADN; de G2 a metafase hay dos cromátidas
 * hermanas; en anafase se separan hacia los polos y en telofase quedan en dos núcleos.
 */
export function chromosomeLayout(stage: Stage, progress: number, replicated: number): Chromosome[] {
  const rnd = seededRandom(5);
  const list: Chromosome[] = [];
  for (let i = 0; i < ONION_2N; i++) {
    const pair = Math.floor(i / 2);
    const a = armLength(pair);
    // Posición en el núcleo (interfase y profase) y en la placa ecuatorial (metafase y después).
    const u0 = rnd() * 2 - 1, th = rnd() * 2 * Math.PI, rr = NUCLEUS_R * 0.75 * Math.cbrt(rnd());
    const sq = Math.sqrt(1 - u0 * u0);
    const inNucleus: Vec3 = [rr * sq * Math.cos(th), rr * u0, rr * sq * Math.sin(th)];
    const dirA = rnd() * 2 * Math.PI, dirB = rnd() * 2 - 1;
    const sqb = Math.sqrt(1 - dirB * dirB);
    const axisN: Vec3 = [sqb * Math.cos(dirA), dirB, sqb * Math.sin(dirA)];
    const pr = PLATE_R * Math.sqrt((i + 0.5) / ONION_2N), pt = i * GOLDEN;
    const radial: Vec3 = [0, Math.cos(pt), Math.sin(pt)];
    const onPlate: Vec3 = [0, pr * Math.cos(pt), pr * Math.sin(pt)];
    const gap = 0.32; // separación entre cromátidas hermanas
    if (stage === 'G1' || stage === 'S' || stage === 'G2' || stage === 'interfase' || stage === 'profase') {
      // Cromatina descondensada (larga y delgada) que en la profase se acorta y engruesa.
      const condensed = stage === 'profase' ? progress : 0;
      const half = a * (2.2 - 1.2 * condensed);
      const side: Vec3 = Math.abs(axisN[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const off = mul(side, gap);
      const r2 = stage === 'G1' ? 0 : stage === 'S' ? replicated : 1;
      const chromatids: Chromatid[] = [{ c: inNucleus, e1: add(inNucleus, mul(axisN, half)), e2: add(inNucleus, mul(axisN, -half)) }];
      if (r2 > 0.001) {
        const c2 = add(inNucleus, off);
        chromatids.push({ c: c2, e1: add(c2, mul(axisN, half * r2)), e2: add(c2, mul(axisN, -half * r2)) });
      }
      list.push({ pair, chromatids, condensed });
    } else if (stage === 'metafase') {
      const sis = [-1, 1].map((s) => { const c = add(onPlate, [s * gap, 0, 0]); return { c, e1: add(c, mul(radial, a)), e2: add(c, mul(radial, -a)) }; });
      list.push({ pair, chromatids: sis, condensed: 1 });
    } else if (stage === 'anafase') {
      // Cada cromátida (ahora un cromosoma) va hacia su polo con los brazos atrás, en forma de V.
      for (const s of [-1, 1]) {
        const x = s * (gap + progress * (POLE_X - 2.2 - gap));
        const c: Vec3 = [x, onPlate[1] * (1 - 0.35 * progress), onPlate[2] * (1 - 0.35 * progress)];
        const back: Vec3 = [-s * 0.8, 0, 0];
        list.push({ pair, chromatids: [{ c, e1: add(c, mul(add(back, mul(radial, 0.6)), a)), e2: add(c, mul(add(back, mul(radial, -0.6)), a)) }], condensed: 1 });
      }
    } else {
      // Telofase: dos núcleos hijos; los cromosomas se descondensan.
      for (const s of [-1, 1]) {
        const c: Vec3 = [s * (POLE_X - 2.4) + inNucleus[0] * 0.25, inNucleus[1] * 0.6, inNucleus[2] * 0.6];
        const half = a * (1 + 0.8 * progress);
        list.push({ pair, chromatids: [{ c, e1: add(c, mul(axisN, half)), e2: add(c, mul(axisN, -half)) }], condensed: 1 - progress });
      }
    }
  }
  return list;
}

const PAIR_COLORS: ColorToken[] = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-7', 'series-8'];
const STAGE_NAME: Record<Stage, string> = { interfase: 'interfase', G1: 'interfase (G1)', S: 'interfase (S, replicación del ADN)', G2: 'interfase (G2)', profase: 'profase', metafase: 'metafase', anafase: 'anafase', telofase: 'telofase' };
const STAGE_TEXT: Record<Stage, string> = {
  interfase: PHASE_INFO.interfase.description,
  G1: 'La cromatina está descondensada dentro del núcleo: cada cromosoma tiene una sola cromátida (largas y delgadas, no se distinguen al microscopio).',
  S: 'Se copia el ADN: junto a cada cromátida crece la copia (cromátida hermana) al ritmo del contenido de ADN del modelo.',
  G2: 'El ADN ya se copió (4C): cada cromosoma tiene dos cromátidas hermanas, todavía descondensadas.',
  profase: PHASE_INFO.profase.description,
  metafase: `${PHASE_INFO.metafase.description} Gira la célula: de frente la placa es un disco con los 16 cromosomas; de perfil, una línea.`,
  anafase: PHASE_INFO.anafase.description,
  telofase: PHASE_INFO.telofase.description,
};

export function mitosisScene(tHours: number, tissue: Tissue = TISSUES[0]): { items: SceneItem[]; extent: number; target: Vec3; description: string; stage: Stage; progress: number; state: CycleState; chromatidBodies: number } {
  const { state, progress } = stageProgress(tHours, tissue);
  const stage = state.stage;
  const replicated = Math.min(1, Math.max(0, (state.dnaC - 2) / 2));
  const chroms = chromosomeLayout(stage, progress, replicated);
  const items: SceneItem[] = [];
  items.push({ id: 'pared', kind: 'box', center: [0, 0, 0], size: [24, 18, 18], edges: true, color: 'amb', opacity: 0.06, label: 'Pared celular' });

  const interphase = stage === 'G1' || stage === 'S' || stage === 'G2' || stage === 'interfase';
  if (interphase || stage === 'profase') {
    const env = interphase ? 0.22 : 0.22 * (1 - 0.8 * progress);
    items.push({ id: 'nucleo', kind: 'sphere', center: [0, 0, 0], radius: NUCLEUS_R, color: 'series-4', opacity: env, label: interphase ? 'Núcleo (envoltura nuclear)' : 'Envoltura nuclear (se desarma)' });
    if (interphase || progress < 0.5) items.push({ id: 'nucleolo', kind: 'sphere', center: [1.4, 0.8, -0.6], radius: interphase ? 1.3 : 1.3 * (1 - progress), color: 'series-7', label: 'Nucléolo' });
  }
  if (stage === 'telofase') {
    for (const s of [-1, 1]) items.push({ id: `nucleo-${s > 0 ? 'b' : 'a'}`, kind: 'sphere', center: [s * (POLE_X - 2.4), 0, 0], radius: 4, color: 'series-4', opacity: 0.06 + 0.16 * progress, ...(s < 0 ? { label: 'Núcleos hijos (se rearma la envoltura)' } : {}) });
    items.push({ id: 'placa-celular', kind: 'box', center: [0, 0, 0], size: [0.35, 18 * Math.max(0.15, progress), 18 * Math.max(0.15, progress)], color: 'amb', opacity: 0.55, label: 'Placa celular (citocinesis)' });
  }

  // Huso mitótico: desde la profase tardía hasta la anafase. Las plantas no tienen centríolos: los polos son anchos.
  const spindle = (stage === 'profase' && progress >= 0.5) || stage === 'metafase' || stage === 'anafase';
  if (spindle || stage === 'telofase') {
    items.push({ id: 'polos', kind: 'particles', points: [[-POLE_X, 0, 0], [POLE_X, 0, 0]], radius: 0.6, color: 'ink-2', label: 'Polos del huso' });
  }
  if (stage === 'metafase') items.push({ id: 'plano', kind: 'box', center: [0, 0, 0], size: [0.06, 13, 13], color: 'ink-3', opacity: 0.1, label: 'Plano ecuatorial (placa metafásica)' });

  const centromeres: Vec3[] = [];
  let fiber = 0;
  chroms.forEach((ch, i) => {
    const color = PAIR_COLORS[ch.pair % PAIR_COLORS.length];
    const thin = ch.condensed < 0.5 && (interphase || stage === 'telofase');
    const radius = 0.1 + 0.26 * ch.condensed;
    ch.chromatids.forEach((cd, k) => {
      const lab = i === 0 && k === 0 ? { label: interphase ? 'Cromatina (cromosomas descondensados)' : stage === 'anafase' || stage === 'telofase' ? 'Cromosomas hijos (una cromátida)' : 'Cromosoma (dos cromátidas hermanas)' } : {};
      items.push({ id: `cr${i}-${k}-a`, kind: 'rod', from: cd.c, to: cd.e1, radius, color, opacity: thin ? 0.75 : 1, ...lab });
      items.push({ id: `cr${i}-${k}-b`, kind: 'rod', from: cd.c, to: cd.e2, radius, color, opacity: thin ? 0.75 : 1 });
      if (!thin) centromeres.push(cd.c);
      if (spindle && (stage !== 'profase')) {
        const pole: Vec3 = [cd.c[0] < 0 || (stage === 'metafase' && k === 0) ? -POLE_X : POLE_X, 0, 0];
        items.push({ id: `fibra-${fiber++}`, kind: 'rod', from: pole, to: cd.c, radius: 0.05, color: 'ink-3', opacity: 0.8, ...(fiber === 1 ? { label: 'Huso mitótico (fibras)' } : {}) });
      }
    });
  });
  if (stage === 'profase' && spindle) {
    // Huso en formación: fibras entre los polos que todavía no se unen a los cromosomas.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 2 * Math.PI;
      items.push({ id: `fibra-p${k}`, kind: 'rod', from: [-POLE_X, 0, 0], to: [POLE_X, 3.2 * Math.cos(a) * (progress - 0.4), 3.2 * Math.sin(a) * (progress - 0.4)], radius: 0.05, color: 'ink-3', opacity: 0.7, ...(k === 0 ? { label: 'Huso mitótico (se forma)' } : {}) });
    }
  }
  if (centromeres.length) items.push({ id: 'centromeros', kind: 'particles', points: centromeres, radius: 0.34, color: 'ink', label: 'Centrómeros' });

  const chromatidBodies = chroms.reduce((n, c) => n + c.chromatids.length, 0);
  const nuclei = state.nuclei;
  const description = `Célula del meristemo de raíz de cebolla (2n = ${ONION_2N}) en ${STAGE_NAME[stage]}, ${fmt(progress * 100, 0)} % de esa etapa (t = ${fmt(tHours, 2)} h del ciclo). `
    + `Según el modelo: ${state.chromosomes} cromosomas, ${state.chromatidsPerChromosome} ${state.chromatidsPerChromosome === 1 ? 'cromátida' : 'cromátidas'} por cromosoma, ${nuclei} ${nuclei === 1 ? 'núcleo' : 'núcleos'} y ${fmt(state.dnaC, 2)} C de ADN. `
    + `${STAGE_TEXT[stage]} Los dos cromosomas de cada par de homólogos tienen el mismo color (8 pares).`;
  return { items, extent: 15, target: [0, 0, 0], description, stage, progress, state, chromatidBodies };
}

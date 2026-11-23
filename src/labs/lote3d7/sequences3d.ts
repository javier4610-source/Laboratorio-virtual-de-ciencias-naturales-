/**
 * «secuencias» (lote 3D-7): el alineamiento del banco en 3D. Funciones PURAS con el MISMO resultado del banco
 * (src/models/sequences.ts → align: columnas, marcas «|», «:», «.» y huecos):
 *   - si las secuencias alineadas son proteínas y una cadena de una estructura incluida en el repositorio es un tramo
 *     EXACTO de alguna de ellas (hemoglobina 2HHB para las globinas; insulina 3I40 para la insulina humana), cada residuo
 *     de esa cadena (traza de Cα del archivo) se colorea con la marca de SU columna en el alineamiento: idéntico,
 *     parecido (BLOSUM62 > 0), distinto, frente a un hueco, o fuera de la región alineada. La coincidencia se busca por
 *     texto (la secuencia de la cadena dentro de la secuencia alineada), no por una numeración fija. Con el archivo se
 *     calcula además la distancia media de cada grupo al centro de su cadena (Å);
 *   - si no hay estructura para esas secuencias (ADN, insulina bovina sola, secuencias propias), la vista mínima honesta
 *     es la «escalera» del alineamiento: las columnas en filas de 40, con la secuencia A arriba, la B abajo y el peldaño
 *     del color de la marca; no añade forma 3D, solo ordena las coincidencias reales para girarlas y contarlas.
 * Dibujo: grosor de la traza, tamaño de las esferas, disposición de la escalera.
 */
import { fmt } from '../../lib/format';
import { AMINO_ACIDS, caTrace, distance, type ProteinStructure } from '../../models/protein';
import type { Alignment } from '../../models/sequences';
import type { SceneColor } from '../../three/colors';
import type { SceneItem, Vec3 } from '../../three/scene';

export type ResClass = 'id' | 'sim' | 'diff' | 'gap' | 'out';
export const CLASS_COLOR: Record<ResClass, SceneColor> = { id: 'ok', sim: 'series-5', diff: 'bad', gap: 'ink-3', out: 'line-strong' };
export const CLASS_NAME: Record<ResClass, string> = {
  id: 'idénticos («|»)', sim: 'parecidos («:», BLOSUM62 > 0)', diff: 'distintos («.»)', gap: 'frente a un hueco', out: 'fuera de la región alineada',
};
const ORDER: ResClass[] = ['id', 'sim', 'diff', 'gap', 'out'];
const ROW = 40;

/** Clase de cada residuo de A y de B según su columna en el alineamiento (índices 0-based en cada secuencia). */
export function residueClasses(al: Alignment, lenA: number, lenB: number): { a: ResClass[]; b: ResClass[] } {
  const a: ResClass[] = Array(lenA).fill('out'), b: ResClass[] = Array(lenB).fill('out');
  let ia = al.startA - 1, ib = al.startB - 1;
  const kind = (m: string): ResClass => (m === '|' ? 'id' : m === ':' ? 'sim' : 'diff');
  for (let c = 0; c < al.alignedA.length; c++) {
    const ca = al.alignedA[c], cb = al.alignedB[c], m = al.marks[c];
    if (ca !== '-') { if (ia < lenA) a[ia] = cb === '-' ? 'gap' : kind(m); ia++; }
    if (cb !== '-') { if (ib < lenB) b[ib] = ca === '-' ? 'gap' : kind(m); ib++; }
  }
  return { a, b };
}

/** Secuencia de una letra de los residuos del polímero con Cα de una cadena. */
export function chainSequence(s: ProteinStructure, chain: string): { seq: string; residues: number[] } {
  const c = s.chains.find((x) => x.id === chain);
  const residues: number[] = [];
  let seq = '';
  for (const ri of c?.residues ?? []) {
    const r = s.residues[ri];
    if (!r.polymer || r.ca === null || r.kind !== 'estandar') continue;
    const one = AMINO_ACIDS[r.resName]?.one;
    if (!one) continue;
    seq += one;
    residues.push(ri);
  }
  return { seq, residues };
}

export interface ChainMatch { chain: string; which: 'A' | 'B'; offset: number; residues: number[] }

/** Cadenas de la estructura cuya secuencia es un tramo exacto de la secuencia A o B (se prueba A primero). */
export function matchChains(s: ProteinStructure, seqA: string, seqB: string): ChainMatch[] {
  const out: ChainMatch[] = [];
  for (const c of s.chains) {
    const { seq, residues } = chainSequence(s, c.id);
    if (seq.length < 10) continue;
    const ia = seqA.indexOf(seq), ib = seqB.indexOf(seq);
    if (ia >= 0) out.push({ chain: c.id, which: 'A', offset: ia, residues });
    else if (ib >= 0) out.push({ chain: c.id, which: 'B', offset: ib, residues });
  }
  return out;
}

export interface SequenceSceneInput {
  al: Alignment | null;
  nameA: string;
  nameB: string;
  seqA: string;
  seqB: string;
  /** Estructura cargada y su código (o null si no hay una que corresponda). */
  structure: { id: string; s: ProteinStructure } | null;
  /** true mientras se busca o se lee la estructura. */
  loading: boolean;
}

type SceneOut = { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; mode: 'vacio' | 'estructura' | 'escalera'; counts: Record<ResClass, number> };

export function sequenceScene(inp: SequenceSceneInput): SceneOut {
  const counts: Record<ResClass, number> = { id: 0, sim: 0, diff: 0, gap: 0, out: 0 };
  if (!inp.al) {
    return { items: [{ id: 'base', kind: 'plane', center: [0, -1, 0], size: [10, 6], color: 'surface-3', opacity: 0.6 }], extent: 6, target: [0, 0, 0], narrow: { extent: 7, target: [0, 0, 0] },
      description: 'Vista 3D del alineamiento: aún no hay alineamiento. Elige dos secuencias y pulsa «Alinear».', mode: 'vacio', counts };
  }
  const al = inp.al;
  const cls = residueClasses(al, inp.seqA.length, inp.seqB.length);
  const head = `Alineamiento ${inp.nameA} frente a ${inp.nameB}: ${al.length} columnas, identidad ${fmt(al.identityPercent, 1)} % (${al.identities}), ${al.similarities - al.identities} parecidos, ${al.mismatches - (al.similarities - al.identities)} distintos y ${al.gaps} columnas con hueco.`;
  const matches = inp.structure ? matchChains(inp.structure.s, inp.seqA, inp.seqB) : [];
  if (inp.structure && matches.length) {
    const s = inp.structure.s;
    const items: SceneItem[] = [];
    const byClass: Record<ResClass, Vec3[]> = { id: [], sim: [], diff: [], gap: [], out: [] };
    const dist: Record<ResClass, number[]> = { id: [], sim: [], diff: [], gap: [], out: [] };
    // Centro de todos los Cα coloreados (para centrar la escena).
    const all = matches.flatMap((m) => m.residues.map((ri) => s.atoms[s.residues[ri].ca!]));
    const cx = all.reduce((a, p) => a + p.x, 0) / all.length, cy = all.reduce((a, p) => a + p.y, 0) / all.length, cz = all.reduce((a, p) => a + p.z, 0) / all.length;
    const P = (p: { x: number; y: number; z: number }): Vec3 => [p.x - cx, p.y - cy, p.z - cz];
    let radius = 0;
    const traceSegs = new Map(caTrace(s).map((t) => [t.chain, t.segments]));
    for (const m of matches) {
      const klass = m.which === 'A' ? cls.a : cls.b;
      const caOf = new Map(m.residues.map((ri, k) => [s.residues[ri].ca!, klass[m.offset + k] ?? 'out']));
      const pts = m.residues.map((ri) => s.atoms[s.residues[ri].ca!]);
      const cc = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length, z: pts.reduce((a, p) => a + p.z, 0) / pts.length };
      m.residues.forEach((ri, k) => {
        const at = s.atoms[s.residues[ri].ca!];
        const c = klass[m.offset + k] ?? 'out';
        byClass[c].push(P(at));
        dist[c].push(distance(at, cc));
        counts[c]++;
        radius = Math.max(radius, Math.hypot(...P(at)));
      });
      // Traza de Cα: cada tramo con el color del residuo de donde sale.
      for (const seg of traceSegs.get(m.chain) ?? []) {
        for (let i = 1; i < seg.length; i++) {
          const a = s.atoms[seg[i - 1]], b = s.atoms[seg[i]];
          const c = caOf.get(seg[i - 1]) ?? 'out';
          items.push({ id: `tr-${m.chain}-${i}-${seg[0]}`, kind: 'rod', from: P(a), to: P(b), radius: 0.35, color: CLASS_COLOR[c], opacity: c === 'out' ? 0.5 : 1 });
        }
      }
    }
    for (const c of ORDER) if (byClass[c].length) items.push({ id: `cls-${c}`, kind: 'particles', points: byClass[c], radius: c === 'id' ? 0.75 : 0.6, color: CLASS_COLOR[c], label: `Residuos ${CLASS_NAME[c]}: ${byClass[c].length}`, tag: '' });
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    const chainsTxt = matches.map((m) => `${m.chain} (secuencia ${m.which === 'A' ? inp.nameA : inp.nameB}, desde el residuo ${m.offset + 1})`).join(', ');
    const distTxt = ORDER.filter((c) => dist[c].length && c !== 'out').map((c) => `${CLASS_NAME[c].split(' (')[0]} ${fmt(mean(dist[c]), 1)} Å`).join(', ');
    const description = `${head} Se colorea la estructura ${inp.structure.id} del PDB (traza de Cα del archivo): cadenas ${chainsTxt}. Residuos coloreados: ${counts.id} idénticos, ${counts.sim} parecidos, ${counts.diff} distintos, ${counts.gap} frente a un hueco${counts.out ? ` y ${counts.out} fuera de la región alineada` : ''}. `
      + `Distancia media al centro de su cadena (calculada con el archivo): ${distTxt}. Si los idénticos quedan más cerca del centro, lo conservado está sobre todo en el interior.`;
    const ext = Math.max(10, radius * 0.95);
    return { items, extent: ext, target: [0, 0, 0], narrow: { extent: ext * 1.05, target: [0, 0, 0] }, description, mode: 'estructura', counts };
  }
  // Escalera del alineamiento (sin estructura que corresponda).
  const rows = Math.ceil(al.alignedA.length / ROW);
  const step = 0.5, rowGap = 1.6;
  const A: Vec3[] = [], B: Vec3[] = [];
  const rung: Record<ResClass, Vec3[]> = { id: [], sim: [], diff: [], gap: [], out: [] };
  for (let c = 0; c < al.alignedA.length; c++) {
    const row = Math.floor(c / ROW), col = c % ROW;
    const x = (col - (ROW - 1) / 2) * step, y = ((rows - 1) / 2 - row) * rowGap;
    const ca = al.alignedA[c], cb = al.alignedB[c];
    if (ca !== '-') A.push([x, y, 0.55]);
    if (cb !== '-') B.push([x, y, -0.55]);
    const k: ResClass = ca === '-' || cb === '-' ? 'gap' : al.marks[c] === '|' ? 'id' : al.marks[c] === ':' ? 'sim' : 'diff';
    rung[k].push([x, y, 0]);
    counts[k]++;
  }
  const items: SceneItem[] = [
    { id: 'sec-a', kind: 'particles', points: A, radius: 0.16, color: 'ink-2', label: `Secuencia A (${inp.nameA}): adelante`, tag: '' },
    { id: 'sec-b', kind: 'particles', points: B, radius: 0.16, color: 'ink-3', label: `Secuencia B (${inp.nameB}): atrás`, tag: '' },
  ];
  for (const c of ORDER) if (rung[c].length) items.push({ id: `pel-${c}`, kind: 'particles', points: rung[c], radius: 0.2, color: CLASS_COLOR[c], label: `Columnas ${c === 'gap' ? 'con hueco' : CLASS_NAME[c]}: ${rung[c].length}`, tag: '' });
  const halfW = (ROW * step) / 2, halfH = (rows * rowGap) / 2;
  const ext = Math.max(6, Math.hypot(halfW, halfH) * 0.75);
  const description = `${head} No hay en el repositorio una estructura 3D que corresponda a estas secuencias, así que la vista muestra la escalera del alineamiento: ${rows} filas de hasta ${ROW} columnas, la secuencia A adelante, la B atrás y cada peldaño con el color de su marca (${counts.id} idénticos, ${counts.sim} parecidos, ${counts.diff} distintos, ${counts.gap} con hueco). Es el mismo alineamiento del banco ordenado en 3D; no representa la forma de la molécula.`;
  return { items, extent: ext, target: [0, 0, 0], narrow: { extent: Math.max(ext, halfW * 1.05), target: [0, 0, 0] }, description, mode: 'escalera', counts };
}

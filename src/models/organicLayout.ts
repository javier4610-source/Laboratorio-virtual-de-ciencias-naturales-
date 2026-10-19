/**
 * Coordenadas 2D para dibujar fórmulas de esqueleto (módulo reutilizable; ver docs/organica/README.md).
 *
 * Es un dibujo, no una geometría: la estructura 2D se rotula siempre «Ilustración educativa (fórmula estructural)». Algoritmo:
 * 1) si hay anillos, cada anillo se dibuja como polígono regular (los fusionados comparten arista); si no, la cadena más larga
 *    (o la cadena principal que se indique) se dibuja en zigzag horizontal con ángulos de 120°;
 * 2) el resto de átomos se coloca por anchura desde lo ya dibujado eligiendo, entre 24 direcciones, la que más se aleja de los
 *    enlaces existentes y de los demás átomos; los carbonos con triple enlace o con dos dobles enlaces quedan lineales (180°).
 * Longitud de enlace = 1 (unidades de dibujo).
 */
import { bondBetween, neighbors, ringInfo, type OMolecule } from './organicGraph';

export interface P2 { x: number; y: number }

const TAU = Math.PI * 2;

function longestPath(m: OMolecule, nodes: number[]): number[] {
  const set = new Set(nodes);
  const bfs = (s: number) => {
    const prev = new Map<number, number>([[s, -1]]);
    const q = [s];
    let last = s;
    while (q.length) { const u = q.shift()!; last = u; for (const v of neighbors(m, u)) if (set.has(v) && !prev.has(v)) { prev.set(v, u); q.push(v); } }
    return { last, prev };
  };
  const a = bfs(nodes[0]).last;
  const { last: b, prev } = bfs(a);
  const path: number[] = [];
  for (let x = b; x !== -1; x = prev.get(x)!) path.push(x);
  return path;
}

function isLinearCenter(m: OMolecule, i: number): boolean {
  const nb = neighbors(m, i);
  if (nb.length !== 2) return false;
  const o = nb.map((v) => bondBetween(m, i, v)!.order);
  return o.includes(3) || (o[0] === 2 && o[1] === 2);
}

export function layout2D(m: OMolecule, opts: { mainChain?: number[] } = {}): P2[] {
  const n = m.atoms.length;
  const pos: (P2 | null)[] = new Array(n).fill(null);
  if (!n) return [];
  const { rings } = ringInfo(m);
  const placeRing = (ring: number[], start?: { a: number; b: number }) => {
    const k = ring.length;
    const R = 1 / (2 * Math.sin(Math.PI / k));
    if (!start) {
      ring.forEach((a, i) => { const t = -Math.PI / 2 + (TAU * i) / k + Math.PI / k; pos[a] = { x: R * Math.cos(t), y: R * Math.sin(t) }; });
      return;
    }
    // anillo fusionado: comparte la arista a–b ya dibujada; el centro va del lado opuesto al otro anillo
    const pa = pos[start.a]!, pb = pos[start.b]!;
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    let nx = -(pb.y - pa.y), ny = pb.x - pa.x;
    const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    const apo = R * Math.cos(Math.PI / k);
    const placedNb = [...new Set(neighbors(m, start.a).concat(neighbors(m, start.b)))].filter((v) => pos[v] && v !== start.a && v !== start.b);
    const side = placedNb.length ? Math.sign((pos[placedNb[0]]!.x - mx) * nx + (pos[placedNb[0]]!.y - my) * ny) || 1 : 1;
    const cx = mx - side * nx * apo, cy = my - side * ny * apo;
    const ia = ring.indexOf(start.a), ib = ring.indexOf(start.b);
    const dir = (ib - ia + k) % k === 1 ? 1 : -1;
    const t0 = Math.atan2(pa.y - cy, pa.x - cx);
    const t1 = Math.atan2(pb.y - cy, pb.x - cx);
    let step = t1 - t0;
    while (step > Math.PI) step -= TAU;
    while (step < -Math.PI) step += TAU;
    for (let i = 0; i < k; i++) {
      const a = ring[(ia + dir * i + k * 2) % k];
      if (pos[a]) continue;
      const t = t0 + step * i;
      pos[a] = { x: cx + R * Math.cos(t), y: cy + R * Math.sin(t) };
    }
  };
  if (rings.length) {
    const sorted = [...rings].sort((a, b) => b.length - a.length);
    placeRing(sorted[0]);
    const done = new Set([0]);
    let progress = true;
    while (progress) {
      progress = false;
      sorted.forEach((r, k) => {
        if (done.has(k)) return;
        const shared = r.filter((a) => pos[a]);
        if (shared.length >= 2) {
          const a = shared.find((x) => shared.includes(r[(r.indexOf(x) + 1) % r.length]))!;
          const b = r[(r.indexOf(a) + 1) % r.length];
          placeRing(r, { a, b }); done.add(k); progress = true;
        }
      });
    }
  } else {
    const heavy = m.atoms.map((_, i) => i);
    const chain = opts.mainChain && opts.mainChain.length ? opts.mainChain : longestPath(m, heavy);
    const dx = Math.cos(Math.PI / 6), dy = Math.sin(Math.PI / 6);
    let x = 0, y = 0, prevAngle = 0;
    chain.forEach((a, i) => {
      if (i === 0) { pos[a] = { x: 0, y: 0 }; return; }
      const linear = isLinearCenter(m, chain[i - 1]) && i > 1;
      let ang: number;
      if (linear) ang = prevAngle;
      else ang = i % 2 === 1 ? -Math.PI / 6 : Math.PI / 6;
      x += Math.cos(ang); y += Math.sin(ang);
      prevAngle = ang;
      pos[a] = { x, y };
      void dx; void dy;
    });
  }
  // colocación del resto
  const queue = m.atoms.map((_, i) => i).filter((i) => pos[i]);
  const seen = new Set(queue);
  // si quedaron átomos sin conexión con lo dibujado (no debería), se colocan aparte
  while (queue.length) {
    const u = queue.shift()!;
    const pu = pos[u]!;
    const kids = neighbors(m, u).filter((v) => !pos[v]);
    for (const v of kids) {
      const placedNb = neighbors(m, u).filter((w) => pos[w] && w !== v);
      let best: P2 | null = null, bestScore = -Infinity;
      const linear = isLinearCenter(m, u) && placedNb.length === 1;
      const cands = linear
        ? [Math.atan2(pu.y - pos[placedNb[0]]!.y, pu.x - pos[placedNb[0]]!.x)]
        : Array.from({ length: 24 }, (_, k) => (TAU * k) / 24);
      for (const t of cands) {
        const c = { x: pu.x + Math.cos(t), y: pu.y + Math.sin(t) };
        let score = 0;
        for (const w of placedNb) {
          const tw = Math.atan2(pos[w]!.y - pu.y, pos[w]!.x - pu.x);
          let d = Math.abs(t - tw) % TAU; if (d > Math.PI) d = TAU - d;
          score += Math.min(d, 2.1) * 3; // preferir ≈120° y no más
          if (placedNb.length === 1) score -= Math.abs(d - (2 * Math.PI) / 3) * 2;
        }
        for (let k = 0; k < n; k++) {
          const p = pos[k];
          if (!p || k === u) continue;
          const dd = Math.hypot(p.x - c.x, p.y - c.y);
          if (dd < 1.6) score -= (1.6 - dd) * 12;
        }
        if (score > bestScore) { bestScore = score; best = c; }
      }
      pos[v] = best!;
      if (!seen.has(v)) { seen.add(v); queue.push(v); }
    }
  }
  return pos.map((p) => p ?? { x: 0, y: 0 });
}

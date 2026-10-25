import { useId, useMemo, type ReactElement } from 'react';
import { implicitH, neighbors, ringInfo, type OMolecule } from '../../models/organicGraph';
import { layout2D, type P2 } from '../../models/organicLayout';

/**
 * Fórmula estructural 2D para funciones orgánicas (Ilustración educativa: no es la geometría).
 * Usa las coordenadas de layout2D (src/models/organicLayout.ts, del módulo de química orgánica, sin modificarlo) y dibuja como se
 * escribe en clase: los heteroátomos llevan sus hidrógenos (–OH, –NH₂, –NH–, «HO–» si el enlace llega por la derecha) y, en modo
 * condensado, cada carbono sus H (CH₃, CH₂, CH). Resalta los átomos del grupo principal y escribe los localizadores del progenitor.
 * (StructureSvg del módulo orgánico rotula los heteroátomos sin H; se pidió el cambio en scratchpad/chem-kit-pedidos.md.)
 */
export interface FormulaSvgProps {
  mol: OMolecule;
  mode?: 'esqueleto' | 'condensada';
  highlight?: number[];
  locants?: Map<number, number>;
  mainChain?: number[];
  title: string;
  desc?: string;
  width?: number;
  height?: number;
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const subN = (n: number) => (n > 1 ? String(n).split('').map((d) => SUBS[Number(d)]).join('') : '');
const EL_COLOR: Record<string, string> = { O: 'var(--bad)', N: 'var(--fis)', Cl: 'var(--ok)', Br: '#a5432a', I: '#7048a8', F: 'var(--ok)', S: 'var(--warn)' };

export function FormulaSvg({ mol, mode = 'condensada', highlight = [], locants, mainChain, title, desc, width = 520, height = 220 }: FormulaSvgProps) {
  const uid = useId().replace(/:/g, '');
  const pts = useMemo(() => layout2D(mol, { mainChain }), [mol, mainChain]);
  const rings = useMemo(() => ringInfo(mol).rings, [mol]);
  const hl = new Set(highlight);
  if (!mol.atoms.length) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 1.0;
  const scale = Math.min(60, (width - 20) / (maxX - minX + 2 * pad), (height - 20) / (maxY - minY + 2 * pad));
  const vw = Math.min(width, (maxX - minX + 2 * pad) * scale + 30), vh = Math.min(height, (maxY - minY + 2 * pad) * scale + 20);
  const ox = vw / 2 - ((minX + maxX) / 2) * scale, oy = vh / 2 - ((minY + maxY) / 2) * scale;
  const P = (p: P2) => ({ x: ox + p.x * scale, y: oy + p.y * scale });
  const fs = Math.max(12, Math.min(18, scale * 0.32));
  const sw = Math.max(1.6, scale * 0.045);

  /** Rótulo y anclaje: los H del heteroátomo se escriben del lado contrario a sus enlaces. */
  const label = (i: number): { text: string; anchor: 'middle' | 'start' | 'end'; core: number } | null => {
    const a = mol.atoms[i];
    const h = implicitH(mol, i);
    const q = a.charge ? (a.charge > 0 ? '⁺' : '⁻') : '';
    if (a.el === 'C' && !q && !(mode === 'condensada' || mol.atoms.length === 1)) return null;
    if (!h) return { text: `${a.el}${q}`, anchor: 'middle', core: 0 };
    const nb = neighbors(mol, i);
    const meanDx = nb.reduce((s, j) => s + (pts[j].x - pts[i].x), 0) / (nb.length || 1);
    const hPart = `H${subN(h)}`;
    // enlace que llega por la derecha → «HO»; por la izquierda (o sin vecinos) → «OH»
    if (meanDx > 0.2 && a.el !== 'C') return { text: `${hPart}${a.el}${q}`, anchor: 'end', core: a.el.length };
    return { text: `${a.el}${hPart}${q}`, anchor: a.el === 'C' ? 'middle' : 'start', core: a.el.length };
  };
  const labels = mol.atoms.map((_, i) => label(i));
  const ringCenter = (i: number, j: number) => {
    const r = rings.find((rr) => rr.includes(i) && rr.includes(j));
    if (!r) return null;
    const c = r.reduce((s, k) => ({ x: s.x + pts[k].x, y: s.y + pts[k].y }), { x: 0, y: 0 });
    return { x: c.x / r.length, y: c.y / r.length };
  };
  const trim = (i: number, j: number) => {
    const A = P(pts[i]), B = P(pts[j]);
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const t = (k: number) => (labels[k] ? Math.min(0.4, (fs * 0.62) / L) : 0);
    return { x1: A.x + dx * t(i), y1: A.y + dy * t(i), x2: B.x - dx * t(j), y2: B.y - dy * t(j), nx: -dy / L, ny: dx / L };
  };
  const bonds = mol.bonds.map((b, k) => {
    const s = trim(b.a, b.b);
    const on = hl.has(b.a) && hl.has(b.b);
    const stroke = on ? 'var(--data)' : 'var(--ink)';
    const w = on ? sw * 1.5 : sw;
    const off = scale * 0.15;
    const out: ReactElement[] = [];
    if (b.order === 1) out.push(<line key="a" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={stroke} strokeWidth={w} strokeLinecap="round" />);
    else if (b.order === 2) {
      const rc = ringCenter(b.a, b.b);
      if (rc) {
        out.push(<line key="a" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={stroke} strokeWidth={w} strokeLinecap="round" />);
        const mid = { x: (pts[b.a].x + pts[b.b].x) / 2, y: (pts[b.a].y + pts[b.b].y) / 2 };
        const side = Math.sign((rc.x - mid.x) * s.nx + (rc.y - mid.y) * s.ny) || 1;
        const sh = 0.15;
        const x1 = s.x1 + (s.x2 - s.x1) * sh, y1 = s.y1 + (s.y2 - s.y1) * sh, x2 = s.x2 - (s.x2 - s.x1) * sh, y2 = s.y2 - (s.y2 - s.y1) * sh;
        out.push(<line key="b" x1={x1 + s.nx * off * side} y1={y1 + s.ny * off * side} x2={x2 + s.nx * off * side} y2={y2 + s.ny * off * side} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />);
      } else for (const g of [-0.6, 0.6]) out.push(<line key={g} x1={s.x1 + s.nx * off * g} y1={s.y1 + s.ny * off * g} x2={s.x2 + s.nx * off * g} y2={s.y2 + s.ny * off * g} stroke={stroke} strokeWidth={w} strokeLinecap="round" />);
    } else for (const g of [-1, 0, 1]) out.push(<line key={g} x1={s.x1 + s.nx * off * g} y1={s.y1 + s.ny * off * g} x2={s.x2 + s.nx * off * g} y2={s.y2 + s.ny * off * g} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />);
    return <g key={k}>{out}</g>;
  });
  const atoms = mol.atoms.map((a, i) => {
    const p = P(pts[i]);
    const lab = labels[i];
    const on = hl.has(i);
    const loc = locants?.get(i);
    const color = on ? 'var(--data)' : EL_COLOR[a.el] ?? 'var(--ink)';
    const angs = neighbors(mol, i).map((j) => Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x)).sort((x, y) => x - y);
    let ux = 0, uy = -1;
    if (angs.length === 1) { ux = -Math.cos(angs[0]); uy = -Math.sin(angs[0]); }
    else if (angs.length > 1) {
      let best = -1, mid = 0;
      for (let k = 0; k < angs.length; k++) { const a0 = angs[k], a1 = k + 1 < angs.length ? angs[k + 1] : angs[0] + 2 * Math.PI; if (a1 - a0 > best) { best = a1 - a0; mid = (a0 + a1) / 2; } }
      ux = Math.cos(mid); uy = Math.sin(mid);
    }
    // el texto se ancla para que la letra del elemento quede sobre el punto del átomo
    const charW = fs * 0.62;
    const tx = lab?.anchor === 'start' ? p.x - charW * 0.5 * lab.core : lab?.anchor === 'end' ? p.x + charW * 0.5 * lab.core : p.x;
    const len = lab ? [...lab.text].length : 0;
    const rx0 = lab?.anchor === 'start' ? tx - 3 : lab?.anchor === 'end' ? tx - charW * len - 3 : tx - (charW * len) / 2 - 3;
    return (
      <g key={i}>
        {lab && <rect x={rx0} y={p.y - fs * 0.62} width={charW * len + 6} height={fs * 1.24} rx={4} fill={on ? 'color-mix(in srgb, var(--data) 14%, var(--surface))' : 'var(--surface)'} opacity={0.95} />}
        {lab && <text x={tx} y={p.y + fs * 0.36} textAnchor={lab.anchor} style={{ fontSize: fs, fontWeight: 700, fill: color, fontFamily: 'var(--font-data)' }}>{lab.text}</text>}
        {!lab && on && <circle cx={p.x} cy={p.y} r={sw * 1.6} fill="var(--data)" />}
        {loc !== undefined && (
          <text x={p.x + ux * fs * 1.25} y={p.y + uy * fs * 1.25 + fs * 0.3} textAnchor="middle"
            style={{ fontSize: fs * 0.78, fontWeight: 800, fill: 'var(--accent)', fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{loc}</text>
        )}
      </g>
    );
  });
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} role="img" aria-labelledby={`${uid}-t ${uid}-d`} style={{ width: '100%', maxWidth: vw * 1.2, height: 'auto', display: 'block', margin: '0 auto' }}>
      <title id={`${uid}-t`}>{title}</title>
      <desc id={`${uid}-d`}>{desc ?? 'Fórmula estructural dibujada en 2D (ilustración educativa; las longitudes y ángulos del dibujo no son los reales).'}</desc>
      {bonds}
      {atoms}
    </svg>
  );
}

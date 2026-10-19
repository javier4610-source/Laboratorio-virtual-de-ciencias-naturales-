import { useId, useMemo, type ReactElement } from 'react';
import { bondBetween, implicitH, ringInfo, type OMolecule } from '../../models/organicGraph';
import { layout2D, type P2 } from '../../models/organicLayout';

/**
 * Fórmula estructural 2D (componente reutilizable; ver docs/organica/README.md).
 * Dibuja el esqueleto con las coordenadas de layout2D (ilustración, no geometría). Opciones:
 *  - mode 'esqueleto': líneas en zigzag, solo se rotulan los heteroátomos (y el carbono si la molécula tiene uno solo);
 *    mode 'condensada': cada carbono se rotula con sus hidrógenos (CH₃, CH₂, CH, C).
 *  - highlight: átomos resaltados (p. ej. la cadena principal); locants: número de cada átomo (localizadores IUPAC).
 * Accesible: role="img" con título y descripción.
 */
export interface StructureSvgProps {
  mol: OMolecule;
  mode?: 'esqueleto' | 'condensada';
  highlight?: Set<number> | number[];
  locants?: Map<number, number>;
  /** Etiqueta pequeña adicional por átomo (p. ej. la posición del constructor). */
  tags?: Map<number, string>;
  title: string;
  desc?: string;
  width?: number;
  height?: number;
  mainChain?: number[];
  /** Átomo con el foco (se marca con un anillo). */
  focus?: number;
  onPick?: (atom: number) => void;
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const subN = (n: number) => (n > 1 ? String(n).split('').map((d) => SUBS[Number(d)]).join('') : '');

export function StructureSvg({ mol, mode = 'esqueleto', highlight, locants, tags, title, desc, width = 520, height = 260, mainChain, focus, onPick }: StructureSvgProps) {
  const uid = useId().replace(/:/g, '');
  const pts = useMemo(() => layout2D(mol, { mainChain }), [mol, mainChain]);
  const hl = useMemo(() => new Set(highlight ?? []), [highlight]);
  const rings = useMemo(() => ringInfo(mol).rings, [mol]);
  if (!mol.atoms.length) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${uid}-t`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <title id={`${uid}-t`}>{title}</title>
        <text x={width / 2} y={height / 2} textAnchor="middle" style={{ fill: 'var(--ink-2)', fontSize: 14 }}>Sin estructura</text>
      </svg>
    );
  }
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 1.0;
  const scale = Math.min(64, (width - 20) / (maxX - minX + 2 * pad), (height - 20) / (maxY - minY + 2 * pad));
  // el lienzo se ajusta al dibujo: así una molécula pequeña no queda diminuta en pantallas angostas
  const vw = Math.min(width, (maxX - minX + 2 * pad) * scale + 20), vh = Math.min(height, (maxY - minY + 2 * pad) * scale + 20);
  const ox = vw / 2 - ((minX + maxX) / 2) * scale, oy = vh / 2 - ((minY + maxY) / 2) * scale;
  const P = (p: P2) => ({ x: ox + p.x * scale, y: oy + p.y * scale });
  const labelOf = (i: number): string | null => {
    const a = mol.atoms[i];
    const q = a.charge ? (a.charge > 0 ? '⁺' : '⁻') : '';
    if (q) return `${a.el}${a.el === 'C' && implicitH(mol, i) ? 'H' + subN(implicitH(mol, i)) : ''}${q}`;
    if (a.el !== 'C') return a.el;
    if (mode === 'condensada' || mol.atoms.length === 1) { const h = implicitH(mol, i); return `C${h ? 'H' + subN(h) : ''}`; }
    return null;
  };
  const labelled = mol.atoms.map((_, i) => labelOf(i));
  const ringCenter = (i: number, j: number) => {
    const r = rings.find((rr) => rr.includes(i) && rr.includes(j));
    if (!r) return null;
    const c = r.reduce((s, k) => ({ x: s.x + pts[k].x, y: s.y + pts[k].y }), { x: 0, y: 0 });
    return { x: c.x / r.length, y: c.y / r.length };
  };
  const sw = Math.max(1.6, scale * 0.045);
  const fs = Math.max(11, Math.min(18, scale * 0.3));
  const trim = (a: P2, b: P2, i: number, j: number) => {
    // acorta la línea si el átomo lleva rótulo
    const A = P(a), B = P(b);
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const ta = labelled[i] ? Math.min(0.42, (fs * (labelled[i]!.length > 1 ? 0.95 : 0.7)) / L) : 0;
    const tb = labelled[j] ? Math.min(0.42, (fs * (labelled[j]!.length > 1 ? 0.95 : 0.7)) / L) : 0;
    return { x1: A.x + dx * ta, y1: A.y + dy * ta, x2: B.x - dx * tb, y2: B.y - dy * tb, nx: -dy / L, ny: dx / L };
  };
  const bondsSvg = mol.bonds.map((b, k) => {
    const s = trim(pts[b.a], pts[b.b], b.a, b.b);
    const isHl = hl.has(b.a) && hl.has(b.b);
    const stroke = isHl ? 'var(--data)' : 'var(--ink)';
    const lines: ReactElement[] = [<line key="m" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={stroke} strokeWidth={isHl ? sw * 1.5 : sw} strokeLinecap="round" />];
    const off = scale * 0.16;
    if (b.order === 2) {
      const rc = ringCenter(b.a, b.b);
      let side = 1;
      if (rc) {
        const mid = { x: (pts[b.a].x + pts[b.b].x) / 2, y: (pts[b.a].y + pts[b.b].y) / 2 };
        side = Math.sign((rc.x - mid.x) * s.nx + (rc.y - mid.y) * s.ny) || 1;
        const sh = 0.14;
        const x1 = s.x1 + (s.x2 - s.x1) * sh, y1 = s.y1 + (s.y2 - s.y1) * sh, x2 = s.x2 - (s.x2 - s.x1) * sh, y2 = s.y2 - (s.y2 - s.y1) * sh;
        lines.push(<line key="d" x1={x1 + s.nx * off * side} y1={y1 + s.ny * off * side} x2={x2 + s.nx * off * side} y2={y2 + s.ny * off * side} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />);
      } else {
        // doble enlace de cadena: líneas centradas
        lines.length = 0;
        for (const sgn of [-0.5, 0.5]) lines.push(<line key={sgn} x1={s.x1 + s.nx * off * sgn * 1.2} y1={s.y1 + s.ny * off * sgn * 1.2} x2={s.x2 + s.nx * off * sgn * 1.2} y2={s.y2 + s.ny * off * sgn * 1.2} stroke={stroke} strokeWidth={isHl ? sw * 1.3 : sw} strokeLinecap="round" />);
      }
    }
    if (b.order === 3) {
      for (const sgn of [-1, 1]) lines.push(<line key={sgn} x1={s.x1 + s.nx * off * sgn} y1={s.y1 + s.ny * off * sgn} x2={s.x2 + s.nx * off * sgn} y2={s.y2 + s.ny * off * sgn} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />);
    }
    return <g key={k}>{lines}</g>;
  });
  const atomsSvg = mol.atoms.map((a, i) => {
    const p = P(pts[i]);
    const lab = labelled[i];
    const isHl = hl.has(i);
    const loc = locants?.get(i);
    const tag = tags?.get(i);
    const color = a.el === 'C' ? (isHl ? 'var(--data)' : 'var(--ink)') : a.el === 'Cl' ? '#2f9e44' : a.el === 'Br' ? '#a5432a' : a.el === 'I' ? '#7048a8' : a.el === 'F' ? '#2b8a3e' : 'var(--ink)';
    // posición del localizador: en la bisectriz del mayor hueco angular entre los enlaces del átomo
    const angs = mol.bonds.filter((b) => b.a === i || b.b === i).map((b) => { const j = b.a === i ? b.b : b.a; return Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x); }).sort((p, q) => p - q);
    let ux = 0, uy = -1;
    if (angs.length === 1) { ux = -Math.cos(angs[0]); uy = -Math.sin(angs[0]); }
    else if (angs.length > 1) {
      let best = -1, mid = 0;
      for (let k = 0; k < angs.length; k++) {
        const a0 = angs[k], a1 = k + 1 < angs.length ? angs[k + 1] : angs[0] + 2 * Math.PI;
        if (a1 - a0 > best) { best = a1 - a0; mid = (a0 + a1) / 2; }
      }
      ux = Math.cos(mid); uy = Math.sin(mid);
    }
    return (
      <g key={i} onClick={onPick ? () => onPick(i) : undefined} style={onPick ? { cursor: 'pointer' } : undefined}>
        {focus === i && <circle cx={p.x} cy={p.y} r={fs * 1.1} fill="none" stroke="var(--focus)" strokeWidth={2.5} />}
        {lab && (
          <>
            <rect x={p.x - fs * 0.38 * lab.length} y={p.y - fs * 0.62} width={fs * 0.76 * lab.length} height={fs * 1.24} rx={3} fill="var(--surface)" opacity={0.92} />
            <text x={p.x} y={p.y + fs * 0.36} textAnchor="middle" style={{ fontSize: fs, fontWeight: 600, fill: color, fontFamily: 'var(--font-data)' }}>{lab}</text>
          </>
        )}
        {!lab && isHl && <circle cx={p.x} cy={p.y} r={sw * 1.4} fill="var(--data)" />}
        {loc !== undefined && (
          <text x={p.x + ux * fs * 1.15} y={p.y + uy * fs * 1.15 + fs * 0.3} textAnchor="middle"
            style={{ fontSize: fs * 0.82, fontWeight: 700, fill: 'var(--data)', fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{loc}</text>
        )}
        {tag !== undefined && (
          <text x={p.x - ux * fs * 1.0} y={p.y - uy * fs * 1.0 + fs * 0.3} textAnchor="middle"
            style={{ fontSize: fs * 0.7, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{tag}</text>
        )}
      </g>
    );
  });
  void bondBetween;
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} role="img" aria-labelledby={`${uid}-t ${uid}-d`} style={{ width: '100%', maxWidth: vw * 1.15, height: 'auto', display: 'block', margin: '0 auto' }}>
      <title id={`${uid}-t`}>{title}</title>
      <desc id={`${uid}-d`}>{desc ?? 'Fórmula estructural dibujada en 2D (ilustración; las longitudes y ángulos del dibujo no son los reales).'}</desc>
      {bondsSvg}
      {atomsSvg}
    </svg>
  );
}

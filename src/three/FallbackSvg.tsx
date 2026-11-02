import { memo, type ReactNode } from 'react';
import { paletteColor, type Palette } from './colors';
import { add, labelAnchor, rotateZ, length, pixelsPerUnit, projectOrtho, scale, spreadLabels, sub, viewBasis, type Orbit, type SceneItem, type Vec3 } from './scene';

/**
 * Vista de respaldo del kit (sin WebGL o sin el fragmento de three.js): dibuja LAS MISMAS primitivas con la misma cámara
 * (giro, inclinación y acercamiento) en proyección ortográfica, ordenadas por profundidad. No es un «no disponible»:
 * conserva posiciones, vectores, rótulos y selección. El contenedor (<Scene3D>) se encarga del teclado y del arrastre.
 */
export interface FallbackSvgProps {
  items: readonly SceneItem[];
  orbit: Orbit;
  target: Vec3;
  extent: number;
  width: number;
  height: number;
  palette: Palette;
  selectedId: string | null;
}

interface Drawable { depth: number; node: ReactNode }

function hull(pts: { x: number; y: number }[]) {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const crossZ = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof p = [], upper: typeof p = [];
  for (const q of p) { while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const pts = (list: { x: number; y: number }[]) => list.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');

export const FallbackSvg = memo(function FallbackSvg({ items, orbit, target, extent, width, height, palette, selectedId }: FallbackSvgProps) {
  const P = (p: Vec3) => projectOrtho(p, orbit, target, extent, width, height);
  const k = pixelsPerUnit(orbit, extent, width, height);
  const { right, up } = viewBasis(orbit);
  const outline = palette.ink;
  const draw: Drawable[] = [];
  const labels: { x: number; y: number; text: string; id: string; sel: boolean }[] = [];

  for (const it of items) {
    const color = paletteColor(palette, it.color);
    const op = it.opacity ?? 1;
    const sel = it.id === selectedId;
    const stroke = sel ? palette.data : outline;
    const sw = sel ? 3 : 0.8;
    const common = { 'data-id': it.selectable ? it.id : undefined, style: it.selectable ? { cursor: 'pointer' } : undefined };
    switch (it.kind) {
      case 'sphere': {
        const c = P(it.center);
        draw.push({ depth: c.depth, node: <g key={it.id} {...common}><circle cx={c.x} cy={c.y} r={Math.max(1.5, it.radius * k)} fill={color} fillOpacity={op} stroke={stroke} strokeOpacity={sel ? 1 : 0.45} strokeWidth={sw} /><circle cx={c.x - it.radius * k * 0.3} cy={c.y - it.radius * k * 0.3} r={it.radius * k * 0.35} fill="#fff" opacity={0.25 * op} /></g> });
        break;
      }
      case 'ellipsoid': {
        const c = P(it.center);
        // Contorno exacto de un elipsoide en proyección ortográfica: S = Σ aᵢ aᵢᵀ con aᵢ = radioᵢ · (ejeᵢ en pantalla).
        let a = 0, b = 0, d = 0;
        for (let i = 0; i < 3; i++) { const sx = it.radii[i] * right[i] * k, sy = -it.radii[i] * up[i] * k; a += sx * sx; b += sx * sy; d += sy * sy; }
        const m = (a + d) / 2, r = Math.sqrt(((a - d) / 2) ** 2 + b * b);
        const ang = (0.5 * Math.atan2(2 * b, a - d) * 180) / Math.PI;
        // Un elipsoide grande (célula, membrana) contiene a otros: se ordena por su punto más lejano.
        draw.push({ depth: c.depth - Math.max(...it.radii) * (op < 1 ? 1 : 0), node: <ellipse key={it.id} {...common} cx={c.x} cy={c.y} rx={Math.max(1, Math.sqrt(m + r))} ry={Math.max(1, Math.sqrt(Math.max(0, m - r)))} transform={`rotate(${ang.toFixed(2)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})`} fill={color} fillOpacity={op} stroke={stroke} strokeOpacity={sel ? 1 : 0.5} strokeWidth={sw} /> });
        break;
      }
      case 'box': {
        const h = scale(it.size, 0.5);
        const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => P(add(it.center, rotateZ([n & 1 ? h[0] : -h[0], n & 2 ? h[1] : -h[1], n & 4 ? h[2] : -h[2]], it.rotationZ ?? 0))));
        const edges = it.edges ? [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]] : [];
        // Una caja suele ser un recipiente (pared celular, pecera): se dibuja detrás de lo que contiene.
        draw.push({ depth: Math.min(...corners.map((q) => q.depth)), node: (
          <g key={it.id} {...common}>
            <polygon points={pts(hull(corners))} fill={color} fillOpacity={op} stroke={sel ? stroke : color} strokeWidth={sel ? 3 : 1} />
            {edges.map(([p, q]) => <line key={`${p}-${q}`} x1={corners[p].x} y1={corners[p].y} x2={corners[q].x} y2={corners[q].y} stroke={color} strokeWidth={1.2} />)}
          </g>
        ) });
        break;
      }
      case 'plane': {
        const [w, dz] = [it.size[0] / 2, it.size[1] / 2];
        const c4 = [[-w, -dz], [w, -dz], [w, dz], [-w, dz]].map(([x, z]) => P(add(it.center, [x, 0, z])));
        draw.push({ depth: -Infinity, node: <polygon key={it.id} {...common} points={pts(c4)} fill={color} fillOpacity={op} stroke={sel ? stroke : 'none'} strokeWidth={sw} /> });
        break;
      }
      case 'rod': {
        const p = P(it.from), q = P(it.to);
        draw.push({ depth: (p.depth + q.depth) / 2, node: <line key={it.id} {...common} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={sel ? palette.data : color} strokeOpacity={op} strokeWidth={Math.max(1.5, 2 * it.radius * k)} strokeLinecap="round" /> });
        break;
      }
      case 'arrow': {
        if (length(it.vector) < 1e-9) break;
        const p = P(it.from), q = P(add(it.from, it.vector));
        const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
        const w = Math.max(2, 2 * (it.radius ?? extent * 0.012) * k);
        if (L < 1) { draw.push({ depth: q.depth + 1e-3, node: <circle key={it.id} cx={q.x} cy={q.y} r={w * 1.6} fill={color} /> }); break; }
        const ux = dx / L, uy = dy / L, head = Math.min(L * 0.45, w * 4.5);
        const bx = q.x - ux * head, by = q.y - uy * head;
        draw.push({ depth: Math.max(p.depth, q.depth) + 1e-3, node: (
          <g key={it.id} {...common}>
            <line x1={p.x} y1={p.y} x2={bx} y2={by} stroke={color} strokeWidth={w} strokeLinecap="round" />
            <polygon points={pts([{ x: q.x, y: q.y }, { x: bx - uy * w * 1.6, y: by + ux * w * 1.6 }, { x: bx + uy * w * 1.6, y: by - ux * w * 1.6 }])} fill={color} />
          </g>
        ) });
        break;
      }
      case 'spring': {
        const axis = sub(it.to, it.from), L = length(axis);
        const u = L > 0 ? scale(axis, 1 / L) : ([0, 1, 0] as Vec3);
        const helper: Vec3 = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        const e1 = (() => { const c: Vec3 = [u[1] * helper[2] - u[2] * helper[1], u[2] * helper[0] - u[0] * helper[2], u[0] * helper[1] - u[1] * helper[0]]; const l = length(c); return scale(c, 1 / l); })();
        const e2: Vec3 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
        const n = Math.max(12, Math.round(it.coils * 16));
        const list = Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * it.coils * 2 * Math.PI; return P(add(add(it.from, scale(axis, i / n)), add(scale(e1, it.radius * Math.cos(a)), scale(e2, it.radius * Math.sin(a))))); });
        draw.push({ depth: (P(it.from).depth + P(it.to).depth) / 2, node: <polyline key={it.id} {...common} points={pts(list)} fill="none" stroke={sel ? palette.data : color} strokeWidth={Math.max(1.5, 2 * (it.wire ?? it.radius * 0.12) * k)} strokeLinejoin="round" /> });
        break;
      }
      case 'particles': {
        it.points.forEach((pt, i) => {
          const c = P(pt);
          draw.push({ depth: c.depth, node: <circle key={`${it.id}-${i}`} {...common} cx={c.x} cy={c.y} r={Math.max(1.2, it.radius * k)} fill={color} fillOpacity={op} stroke={sel ? palette.data : outline} strokeOpacity={sel ? 1 : 0.35} strokeWidth={sel ? 2 : 0.6} /> });
        });
        break;
      }
    }
    if (it.label) labels.push({ ...P(labelAnchor(it)), text: it.label, id: it.id, sel });
  }
  draw.sort((a, b) => a.depth - b.depth);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      {draw.map((d) => d.node)}
      {spreadLabels(labels, width, height).map(({ item, left, bottom }) => (
        <text key={`l-${item.id}`} x={left + 4} y={bottom - 5} className="scene3d-svg-label" style={{ fill: palette.ink, stroke: palette.surface, fontWeight: item.sel ? 800 : 700 }}>{item.text}</text>
      ))}
    </svg>
  );
});

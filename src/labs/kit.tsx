import type { ReactNode } from 'react';

/**
 * Kit de instrumentos de laboratorio en SVG.
 * Las definiciones (degradados de vidrio, metal, plástico y pantallas; sombras) se montan
 * una sola vez por página con <KitDefs /> y los instrumentos las usan con url(#kit-…).
 * Todos los instrumentos se dibujan en unidades del viewBox del laboratorio que los usa.
 */

export function KitDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        {/* Vidrio: luz principal desde la izquierda (reflejo fuerte), banda de refracción a la derecha con un leve tinte verdoso. */}
        <linearGradient id="kit-glass" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.05" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="0.14" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#d9f2ee" stopOpacity="0.1" />
          <stop offset="0.9" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="0.96" stopColor="#7fa7a3" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="kit-glass-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#bcdbe4" stopOpacity="0.42" />
          <stop offset="0.18" stopColor="#dcedf2" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#e8f4f8" stopOpacity="0.1" />
          <stop offset="0.82" stopColor="#d4e9ee" stopOpacity="0.18" />
          <stop offset="1" stopColor="#b3d3dc" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="kit-liquid-shade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.2" />
          <stop offset="0.12" stopColor="#000" stopOpacity="0.04" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="0.9" stopColor="#000" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        {/* Profundidad del líquido: más oscuro hacia el fondo, con una franja de luz bajo la superficie. */}
        <linearGradient id="kit-liquid-depth" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.08" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id="kit-metal" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f7f9fa" />
          <stop offset="0.22" stopColor="#dde4e7" />
          <stop offset="0.48" stopColor="#c3cdd1" />
          <stop offset="0.52" stopColor="#adb8bd" />
          <stop offset="0.8" stopColor="#d4dcdf" />
          <stop offset="1" stopColor="#eef2f3" />
        </linearGradient>
        <linearGradient id="kit-metal-h" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#9da8ad" />
          <stop offset="0.18" stopColor="#d8dfe2" />
          <stop offset="0.35" stopColor="#f4f7f8" />
          <stop offset="0.5" stopColor="#d2dadd" />
          <stop offset="0.72" stopColor="#bcc6ca" />
          <stop offset="1" stopColor="#8e999e" />
        </linearGradient>
        <linearGradient id="kit-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.12" stopColor="#f6f8f8" />
          <stop offset="1" stopColor="#d0d8da" />
        </linearGradient>
        <linearGradient id="kit-body-dark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4a5659" />
          <stop offset="0.08" stopColor="#3b4648" />
          <stop offset="1" stopColor="#1f2729" />
        </linearGradient>
        <linearGradient id="kit-lcd" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#132a24" />
          <stop offset="0.5" stopColor="#0d1f1b" />
          <stop offset="1" stopColor="#081310" />
        </linearGradient>
        <linearGradient id="kit-wood" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f8e8bb" />
          <stop offset="0.5" stopColor="#efd595" />
          <stop offset="1" stopColor="#e0bd74" />
        </linearGradient>
        <radialGradient id="kit-bulb" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffa39b" />
          <stop offset="0.5" stopColor="#e53935" />
          <stop offset="1" stopColor="#b71c1c" />
        </radialGradient>
        {/* Sombra de contacto bajo los instrumentos apoyados en la mesa. */}
        <radialGradient id="kit-contact" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b1f1c" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#0b1f1c" stopOpacity="0.14" />
          <stop offset="1" stopColor="#0b1f1c" stopOpacity="0" />
        </radialGradient>
        {/* Mesa: brillo frontal y veta muy sutil (laminado). */}
        <linearGradient id="kit-bench-sheen" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="kit-bench-drop" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0b1f1c" stopOpacity="0.18" />
          <stop offset="1" stopColor="#0b1f1c" stopOpacity="0" />
        </linearGradient>
        <pattern id="kit-bench-grain" patternUnits="userSpaceOnUse" width="46" height="10">
          <path d="M0 2.5 Q12 1.6 23 2.8 T46 2.4 M0 6.5 Q15 7.4 27 6.2 T46 6.8" fill="none" stroke="#000" strokeOpacity="0.07" strokeWidth="0.6" />
          <path d="M5 4.6 h9 M30 8.4 h7" stroke="#fff" strokeOpacity="0.12" strokeWidth="0.5" />
        </pattern>
        <filter id="kit-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0b1f1c" floodOpacity="0.22" />
        </filter>
        <filter id="kit-shadow-soft" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0b1f1c" floodOpacity="0.18" />
        </filter>
      </defs>
    </svg>
  );
}

/* ---------------------------------------------------------------- utilidades de color */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Aclara (amount > 0) u oscurece (amount < 0) un color hexadecimal. Otros formatos se devuelven igual. */
export function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `rgb(${f(rgb[0])}, ${f(rgb[1])}, ${f(rgb[2])})`;
}

/* ---------------------------------------------------------------- piezas */

/** Superficie de la mesa de trabajo sobre la que se apoyan los instrumentos. */
export function BenchTop({ y, x = 0, width }: { y: number; x?: number; width: number }) {
  return (
    <g aria-hidden="true" className="kit-bench">
      <rect x={x} y={y} width={width} height={10} rx={2} fill="var(--bench-top, #c9d3d1)" />
      <rect x={x} y={y} width={width} height={10} rx={2} fill="url(#kit-bench-grain)" />
      <rect x={x} y={y} width={width} height={10} rx={2} fill="url(#kit-bench-sheen)" />
      <line x1={x + 2} x2={x + width - 2} y1={y + 0.6} y2={y + 0.6} stroke="#fff" strokeOpacity="0.45" strokeWidth="1" />
      <rect x={x} y={y + 10} width={width} height={4} fill="var(--bench-edge, #9eaaa8)" opacity="0.85" />
      <rect x={x} y={y + 14} width={width} height={8} fill="url(#kit-bench-drop)" />
    </g>
  );
}

/** Sombra de contacto suave (elipse difusa) bajo un instrumento apoyado en la mesa; (x, y) es el borde izquierdo de la base. */
export function ContactShadow({ x, y, w, h = 9, opacity = 1 }: { x: number; y: number; w: number; h?: number; opacity?: number }) {
  return <ellipse aria-hidden="true" cx={x + w / 2} cy={y + 0.5} rx={w / 2 + 4} ry={h / 2} fill="url(#kit-contact)" opacity={opacity} />;
}

/** Tamaño de letra que cabe en la pantalla (dígitos monoespaciados ≈ 0,62 em + 1 px de espaciado). */
function lcdFont(text: string, available: number, h: number) {
  return Math.max(9, Math.min(18, h * 0.58, available / Math.max(1, text.length * 0.62 + text.length / 18)));
}

/** Pantalla de cristal líquido con dígitos verdes. */
export function Lcd({ x, y, w, h, text, unit }: { x: number; y: number; w: number; h: number; text: string; unit?: string }) {
  return (
    <g>
      <rect x={x - 1} y={y - 1} width={w + 2} height={h + 2} rx={5} fill="none" stroke="#fff" strokeOpacity="0.14" />
      <rect x={x} y={y} width={w} height={h} rx={4} fill="url(#kit-lcd)" stroke="#05100d" strokeWidth="1" />
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} rx={3} fill="none" stroke="#000" strokeOpacity="0.45" />
      <path d={`M${x + 3} ${y + 2.5} H${x + w - 3} L${x + w * 0.62} ${y + h * 0.42} H${x + 3} Z`} fill="#ffffff" opacity="0.05" />
      <text x={x + w - (unit ? 26 : 8)} y={y + h / 2 + 6} textAnchor="end" fill="#7CFFB2" style={{ fontFamily: 'var(--font-data)', fontSize: lcdFont(text, w - (unit ? 34 : 16), h), letterSpacing: 1 }}>{text}</text>
      {unit && <text x={x + w - 8} y={y + h / 2 + 6} textAnchor="end" fill="#7CFFB2" opacity="0.8" style={{ fontFamily: 'var(--font-data)', fontSize: 11 }}>{unit}</text>}
    </g>
  );
}

/** Balanza digital con plato metálico, pantalla y teclas. El plato queda en y (cara superior). */
export function DigitalBalance({ x, y, w = 230, reading, unit = 'g', children }: { x: number; y: number; w?: number; reading: string; unit?: string; children?: ReactNode }) {
  const bodyTop = y + 14, bodyH = 62;
  return (
    <g>
      <ContactShadow x={x - 6} y={bodyTop + bodyH} w={w + 12} h={10} />
      <g filter="url(#kit-shadow)">
        <path d={`M${x + 8} ${bodyTop} L${x + w - 8} ${bodyTop} Q${x + w} ${bodyTop} ${x + w} ${bodyTop + 10} L${x + w + 6} ${bodyTop + bodyH} L${x - 6} ${bodyTop + bodyH} L${x} ${bodyTop + 10} Q${x} ${bodyTop} ${x + 8} ${bodyTop} Z`} fill="url(#kit-body)" stroke="#a9b4b6" />
        <rect x={x + w / 2 - 14} y={y + 4} width={28} height={12} fill="url(#kit-metal-h)" />
        <rect x={x + 18} y={y - 2} width={w - 36} height={8} rx={3} fill="url(#kit-metal)" stroke="#9aa5a9" />
      </g>
      {children}
      <rect x={x + 6} y={bodyTop + bodyH - 6} width={w - 12} height={6} fill="#000" opacity="0.06" />
      <Lcd x={x + w / 2 - 58} y={bodyTop + 14} w={116} h={30} text={reading} unit={unit} />
      {[['TARA', x + 22], ['ON', x + w - 40]].map(([label, bx]) => (
        <g key={label as string}>
          <rect x={bx as number} y={bodyTop + 22} width={20} height={14} rx={3} fill="url(#kit-body-dark)" />
          <text x={(bx as number) + 10} y={bodyTop + 48} textAnchor="middle" style={{ fontSize: 7, fill: '#55605f', fontWeight: 700 }}>{label}</text>
        </g>
      ))}
    </g>
  );
}

/** Escala de una probeta: y en el viewBox para un volumen dado. */
export function cylinderScale({ y, h, capacity }: { y: number; h: number; capacity: number }) {
  const top = y + 14, bottom = y + h - 18;
  const per = (bottom - top) / capacity;
  return { top, bottom, yAt: (v: number) => bottom - v * per, pxPerUnit: per };
}

/**
 * Probeta graduada de vidrio con líquido y menisco. `children` se dibuja dentro del líquido
 * (objetos sumergidos), entre el líquido y el brillo del vidrio.
 */
export function GraduatedCylinder({ x, y, w, h, capacity, level, liquid = '#4f9fe0', major = 10, minor = 2, unit = 'mL', label, children }: {
  x: number; y: number; w: number; h: number; capacity: number; level: number; liquid?: string; major?: number; minor?: number; unit?: string; label?: string; children?: ReactNode;
}) {
  const sc = cylinderScale({ y, h, capacity });
  const ly = Math.max(sc.top - 6, sc.yAt(Math.min(level, capacity * 1.05)));
  const inner = { l: x + 3, r: x + w - 3 };
  const ticks: number[] = [];
  for (let v = minor; v <= capacity + 1e-9; v += minor) ticks.push(Math.round(v * 1000) / 1000);
  return (
    <g>
      {/* pie hexagonal */}
      <ContactShadow x={x - 16} y={y + h} w={w + 32} h={8} />
      <path d={`M${x - 16} ${y + h} L${x + w + 16} ${y + h} L${x + w + 8} ${y + h - 8} L${x - 8} ${y + h - 8} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" filter="url(#kit-shadow-soft)" />
      {/* cuerpo */}
      <path d={`M${x} ${y} L${x} ${y + h - 10} Q${x} ${y + h - 8} ${x + 4} ${y + h - 8} L${x + w - 4} ${y + h - 8} Q${x + w} ${y + h - 8} ${x + w} ${y + h - 10} L${x + w} ${y}`} fill="url(#kit-glass-fill)" />
      {level > 0 && (
        <g className="kit-liquid">
          <path d={`M${inner.l} ${ly + 3} Q${(inner.l + inner.r) / 2} ${ly + 8} ${inner.r} ${ly + 3} L${inner.r} ${y + h - 11} L${inner.l} ${y + h - 11} Z`} fill={liquid} opacity="0.55" />
          <path d={`M${inner.l} ${ly + 3} Q${(inner.l + inner.r) / 2} ${ly + 8} ${inner.r} ${ly + 3} L${inner.r} ${y + h - 11} L${inner.l} ${y + h - 11} Z`} fill="url(#kit-liquid-shade)" />
          <path d={`M${inner.l} ${ly} Q${inner.l + 2} ${ly + 3} ${inner.l + 6} ${ly + 4} Q${(inner.l + inner.r) / 2} ${ly + 9} ${inner.r - 6} ${ly + 4} Q${inner.r - 2} ${ly + 3} ${inner.r} ${ly}`} fill="none" stroke={shade(liquid, -0.35)} strokeWidth="1.6" />
        </g>
      )}
      {children}
      {/* graduaciones impresas en el vidrio */}
      {ticks.map((v) => {
        const ty = sc.yAt(v);
        const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        const isMid = !isMajor && Math.abs((v * 2) / major - Math.round((v * 2) / major)) < 1e-6;
        return (
          <g key={v}>
            <line x1={x + 4} x2={x + 4 + (isMajor ? w * 0.42 : isMid ? w * 0.3 : w * 0.18)} y1={ty} y2={ty} stroke="var(--glass-print, #24454a)" strokeWidth={isMajor ? 1.3 : 0.8} opacity="0.85" />
            {isMajor && <text x={x + 6 + w * 0.42} y={ty + 3.5} style={{ fontSize: 9, fill: 'var(--glass-print, #24454a)', fontFamily: 'var(--font-data)' }}>{v}</text>}
          </g>
        );
      })}
      {/* vidrio: contorno, pico y brillo */}
      <path d={`M${x} ${y} L${x} ${y + h - 10} Q${x} ${y + h - 8} ${x + 4} ${y + h - 8} L${x + w - 4} ${y + h - 8} Q${x + w} ${y + h - 8} ${x + w} ${y + h - 10} L${x + w} ${y}`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <path d={`M${x - 5} ${y - 2} Q${x} ${y} ${x} ${y + 4} M${x + w} ${y + 4} Q${x + w} ${y} ${x + w + 3} ${y - 1}`} fill="none" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <rect x={x + 5} y={y + 8} width={3} height={h - 30} rx={1.5} fill="#fff" opacity="0.45" />
      {label && <text x={x + w / 2} y={y - 10} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{label} · {unit}</text>}
    </g>
  );
}

/** Vaso de precipitados con líquido. */
export function Beaker({ x, y, w, h, fill = 0, liquid = '#4f9fe0', liquidOpacity = 0.5, label, children }: {
  x: number; y: number; w: number; h: number; fill?: number; liquid?: string; liquidOpacity?: number; label?: string; children?: ReactNode;
}) {
  const ly = y + h - 6 - (h - 16) * Math.max(0, Math.min(1, fill));
  return (
    <g>
      <ContactShadow x={x} y={y + h} w={w} h={8} />
      <path d={`M${x} ${y} L${x} ${y + h - 8} Q${x} ${y + h} ${x + 8} ${y + h} L${x + w - 8} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 8} L${x + w} ${y}`} fill="url(#kit-glass-fill)" />
      {fill > 0 && (
        <g className="kit-liquid">
          <path d={`M${x + 2} ${ly - 2.5} Q${x + 3} ${ly} ${x + 8} ${ly} L${x + w - 8} ${ly} Q${x + w - 3} ${ly} ${x + w - 2} ${ly - 2.5} L${x + w - 2} ${y + h - 8} Q${x + w - 2} ${y + h - 2} ${x + w - 8} ${y + h - 2} L${x + 8} ${y + h - 2} Q${x + 2} ${y + h - 2} ${x + 2} ${y + h - 8} Z`} fill={liquid} opacity={liquidOpacity} />
          <path d={`M${x + 2} ${ly} L${x + w - 2} ${ly} L${x + w - 2} ${y + h - 8} L${x + 2} ${y + h - 8} Z`} fill="url(#kit-liquid-shade)" />
          <path d={`M${x + 2} ${ly} L${x + w - 2} ${ly} L${x + w - 2} ${y + h - 3} L${x + 2} ${y + h - 3} Z`} fill="url(#kit-liquid-depth)" />
          {/* menisco cóncavo: el agua sube por la pared */}
          <path d={`M${x + 2} ${ly - 2.5} Q${x + 3} ${ly} ${x + 8} ${ly} L${x + w - 8} ${ly} Q${x + w - 3} ${ly} ${x + w - 2} ${ly - 2.5}`} fill="none" stroke={shade(liquid, -0.3)} strokeWidth="1.4" opacity="0.85" />
          <line x1={x + 10} x2={x + w - 10} y1={ly + 1.8} y2={ly + 1.8} stroke="#fff" strokeWidth="1" opacity="0.35" />
        </g>
      )}
      {children}
      <path d={`M${x - 4} ${y - 3} Q${x} ${y - 1} ${x} ${y + 4} L${x} ${y + h - 8} Q${x} ${y + h} ${x + 8} ${y + h} L${x + w - 8} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 8} L${x + w} ${y}`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <rect x={x + 6} y={y + 8} width={3} height={h - 22} rx={1.5} fill="#fff" opacity="0.4" />
      <rect x={x + w - 8} y={y + 14} width={1.6} height={h - 34} rx={0.8} fill="#fff" opacity="0.22" />
      <path d={`M${x + 1} ${y + 0.8} L${x + w - 1} ${y + 0.8}`} stroke="#fff" strokeWidth="1" opacity="0.5" />
      {label && <text x={x + w / 2} y={y + h + 16} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{label}</text>}
    </g>
  );
}

/** Regla de madera con divisiones en milímetros. */
export function Ruler({ x, y, cm, pxPerCm, labelEvery = 1 }: { x: number; y: number; cm: number; pxPerCm: number; labelEvery?: number }) {
  const w = cm * pxPerCm + 34;
  return (
    <g filter="url(#kit-shadow-soft)">
      <rect x={x} y={y} width={w} height={32} rx={3} fill="url(#kit-wood)" stroke="#b8975a" />
      {Array.from({ length: cm * 10 + 1 }, (_, i) => (
        <line key={i} x1={x + 10 + (i * pxPerCm) / 10} x2={x + 10 + (i * pxPerCm) / 10} y1={y} y2={y + (i % 10 === 0 ? 13 : i % 5 === 0 ? 9 : 5)} stroke="#4d3b1c" strokeWidth={i % 10 === 0 ? 1.1 : 0.7} />
      ))}
      {Array.from({ length: Math.floor(cm / labelEvery) + 1 }, (_, i) => i * labelEvery).map((c) => (
        <text key={c} x={x + 10 + c * pxPerCm} y={y + 26} textAnchor="middle" style={{ fontSize: 10, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{c}</text>
      ))}
      <text x={x + w - 5} y={y + 26} textAnchor="end" style={{ fontSize: 8, fill: '#7a6334' }}>cm</text>
    </g>
  );
}

/** Cubo con perspectiva (cara frontal, superior y lateral sombreadas). (x, y) es la esquina inferior izquierda de la cara frontal. */
export function Cube({ x, y, size, color, finish = 'mate', opacity = 1 }: { x: number; y: number; size: number; color: string; finish?: 'mate' | 'metal' | 'vidrio' | 'madera'; opacity?: number }) {
  const d = Math.max(3, size * 0.28);
  const front = color, top = shade(color, 0.28), side = shade(color, -0.22);
  return (
    <g opacity={opacity}>
      <path d={`M${x} ${y - size} L${x + d} ${y - size - d} L${x + size + d} ${y - size - d} L${x + size} ${y - size} Z`} fill={top} stroke={shade(color, -0.45)} strokeWidth="0.8" />
      <path d={`M${x + size} ${y - size} L${x + size + d} ${y - size - d} L${x + size + d} ${y - d} L${x + size} ${y} Z`} fill={side} stroke={shade(color, -0.45)} strokeWidth="0.8" />
      <rect x={x} y={y - size} width={size} height={size} fill={front} stroke={shade(color, -0.45)} strokeWidth="0.8" />
      {finish === 'metal' && <rect x={x} y={y - size} width={size} height={size} fill="url(#kit-metal-h)" opacity="0.35" />}
      {finish === 'vidrio' && <rect x={x + size * 0.12} y={y - size * 0.9} width={size * 0.12} height={size * 0.7} fill="#fff" opacity="0.45" />}
      {finish === 'madera' && [0.3, 0.55, 0.8].map((f) => <path key={f} d={`M${x} ${y - size * f} Q${x + size / 2} ${y - size * f - 2} ${x + size} ${y - size * f + 1}`} fill="none" stroke={shade(color, -0.25)} strokeWidth="0.7" opacity="0.7" />)}
    </g>
  );
}

/** Termómetro de bulbo con escala. */
export function Thermometer({ x, y, h, min, max, value, label = '°C' }: { x: number; y: number; h: number; min: number; max: number; value: number; label?: string }) {
  const top = y + 6, bottom = y + h - 16;
  const level = bottom - ((Math.max(min, Math.min(max, value)) - min) / (max - min)) * (bottom - top);
  return (
    <g>
      <rect x={x - 6} y={y} width={12} height={h - 10} rx={6} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" />
      <rect className="kit-column" x={x - 2} y={level} width={4} height={bottom - level + 4} fill="#d32f2f" />
      <rect x={x - 4} y={y + 5} width={1.6} height={h - 26} rx={0.8} fill="#fff" opacity="0.55" />
      <circle cx={x} cy={y + h - 8} r={9} fill="url(#kit-bulb)" stroke="#9b1b1b" />
      <ellipse cx={x - 3} cy={y + h - 11} rx={2.6} ry={1.8} fill="#fff" opacity="0.55" />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const ty = bottom - f * (bottom - top);
        return <line key={f} x1={x + 6} x2={x + 11} y1={ty} y2={ty} stroke="var(--ink-2)" strokeWidth="0.8" />;
      })}
      <text x={x + 14} y={top + 4} style={{ fontSize: 8, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{max}</text>
      <text x={x + 14} y={bottom + 3} style={{ fontSize: 8, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{min} {label}</text>
    </g>
  );
}

/** Matraz Erlenmeyer con líquido (fill de 0 a 1 respecto a la parte cónica). */
export function Erlenmeyer({ x, y, w, h, fill = 0, liquid = '#4f9fe0', liquidOpacity = 0.5, children }: {
  x: number; y: number; w: number; h: number; fill?: number; liquid?: string; liquidOpacity?: number; children?: ReactNode;
}) {
  const neckW = w * 0.28, neckH = h * 0.3, cx = x + w / 2;
  const body = `M${cx - neckW / 2} ${y} L${cx - neckW / 2} ${y + neckH} L${x + 4} ${y + h - 10} Q${x} ${y + h} ${x + 10} ${y + h} L${x + w - 10} ${y + h} Q${x + w} ${y + h} ${x + w - 4} ${y + h - 10} L${cx + neckW / 2} ${y + neckH} L${cx + neckW / 2} ${y}`;
  const f = Math.max(0, Math.min(1, fill));
  const ly = y + h - 3 - (h - neckH - 6) * f;
  const halfAt = (yy: number) => (neckW / 2) + ((w / 2 - 4 - neckW / 2) * (yy - (y + neckH))) / (h - 10 - neckH);
  return (
    <g>
      <ContactShadow x={x} y={y + h} w={w} h={8} />
      <path d={body} fill="url(#kit-glass-fill)" />
      {f > 0 && (
        <g className="kit-liquid">
          <path d={`M${cx - halfAt(ly)} ${ly} L${cx + halfAt(ly)} ${ly} L${x + w - 5} ${y + h - 9} Q${x + w - 2} ${y + h - 2} ${x + w - 10} ${y + h - 2} L${x + 10} ${y + h - 2} Q${x + 2} ${y + h - 2} ${x + 5} ${y + h - 9} Z`} fill={liquid} opacity={liquidOpacity} />
          <path d={`M${cx - halfAt(ly)} ${ly} L${cx + halfAt(ly)} ${ly} L${x + w - 5} ${y + h - 9} Q${x + w - 2} ${y + h - 2} ${x + w - 10} ${y + h - 2} L${x + 10} ${y + h - 2} Q${x + 2} ${y + h - 2} ${x + 5} ${y + h - 9} Z`} fill="url(#kit-liquid-depth)" />
          <path d={`M${cx - halfAt(ly)} ${ly - 2} Q${cx - halfAt(ly) + 3} ${ly} ${cx - halfAt(ly) + 7} ${ly} L${cx + halfAt(ly) - 7} ${ly} Q${cx + halfAt(ly) - 3} ${ly} ${cx + halfAt(ly)} ${ly - 2}`} fill="none" stroke={shade(liquid, -0.3)} strokeWidth="1.3" opacity="0.85" />
        </g>
      )}
      {children}
      <path d={body} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <path d={`M${cx - neckW / 2 - 3} ${y} L${cx + neckW / 2 + 3} ${y}`} stroke="var(--glass-edge, #8fa9b3)" strokeWidth="3" strokeLinecap="round" />
      <path d={`M${cx - neckW / 2 + 4} ${y + neckH + 6} L${x + 14} ${y + h - 16}`} stroke="#fff" strokeWidth="3" opacity="0.4" strokeLinecap="round" />
    </g>
  );
}

/** Jeringa de gas horizontal. `fraction` (0–1) es la fracción de la capacidad ocupada; el émbolo se desplaza a la derecha. */
export function GasSyringe({ x, y, length, height = 46, fraction, capacity, unit = 'mL', major, gas = 'rgba(120,180,230,0.22)', children }: {
  x: number; y: number; length: number; height?: number; fraction: number; capacity: number; unit?: string; major: number; gas?: string; children?: ReactNode;
}) {
  const f = Math.max(0, Math.min(1.02, fraction));
  const px = x + f * length;
  const ticks = Math.round(capacity / major);
  return (
    <g>
      <rect x={x} y={y} width={length + 6} height={height} rx={4} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
      <rect x={x + 1} y={y + 2} width={Math.max(0, px - x - 1)} height={height - 4} fill={gas} />
      {children}
      {Array.from({ length: ticks + 1 }, (_, i) => (
        <g key={i}>
          <line x1={x + (i * length) / ticks} x2={x + (i * length) / ticks} y1={y + height} y2={y + height - 9} stroke="var(--glass-print, #24454a)" strokeWidth="1" />
          <text x={x + (i * length) / ticks} y={y + height + 12} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{i * major}</text>
        </g>
      ))}
      <text x={x + length + 10} y={y + height + 12} style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{unit}</text>
      {/* émbolo y vástago */}
      <rect x={px - 3} y={y + 2} width={8} height={height - 4} rx={2} fill="#3b4648" />
      <rect x={px + 5} y={y + height / 2 - 4} width={Math.max(0, x + length + 60 - px)} height={8} fill="url(#kit-metal)" stroke="#9aa5a9" />
      <rect x={x + length + 58} y={y + 4} width={8} height={height - 8} rx={2} fill="url(#kit-metal-h)" stroke="#9aa5a9" />
      <rect x={x} y={y} width={length + 6} height={height} rx={4} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
      <rect x={x - 14} y={y + height / 2 - 5} width={14} height={10} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" />
    </g>
  );
}

/** Bureta vertical con llave; `level` en mL leídos desde arriba (0 arriba). */
export function Burette({ x, y, h, capacity, level, liquid = '#e7f0f7', liquidOpacity = 0.55, major = 5 }: {
  x: number; y: number; h: number; capacity: number; level: number; liquid?: string; liquidOpacity?: number; major?: number;
}) {
  const w = 18, top = y + 10, bottom = y + h - 30;
  const per = (bottom - top) / capacity;
  const ly = top + Math.max(0, Math.min(capacity, level)) * per;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h - 26} rx={3} fill="url(#kit-glass-fill)" />
      <rect x={x + 2} y={ly} width={w - 4} height={bottom - ly + 8} fill={liquid} opacity={liquidOpacity} />
      <path d={`M${x + 2} ${ly} Q${x + w / 2} ${ly + 4} ${x + w - 2} ${ly}`} fill="none" stroke={shade(liquid.startsWith('#') ? liquid : '#4f9fe0', -0.4)} strokeWidth="1.2" />
      {Array.from({ length: Math.round(capacity / major) + 1 }, (_, i) => (
        <g key={i}>
          <line x1={x + w} x2={x + w + (i % 2 === 0 ? 9 : 5)} y1={top + i * major * per} y2={top + i * major * per} stroke="var(--glass-print, #24454a)" strokeWidth="0.9" />
          {i % 2 === 0 && <text x={x + w + 11} y={top + i * major * per + 3} style={{ fontSize: 8, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{i * major}</text>}
        </g>
      ))}
      <rect x={x} y={y} width={w} height={h - 26} rx={3} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
      <rect x={x - 8} y={y + h - 26} width={w + 16} height={7} rx={3} fill="url(#kit-body-dark)" />
      <path d={`M${x + w / 2 - 3} ${y + h - 19} L${x + w / 2 + 3} ${y + h - 19} L${x + w / 2 + 1} ${y + h} L${x + w / 2 - 1} ${y + h} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" />
    </g>
  );
}

/** Tubo de ensayo vertical con líquido (fill 0–1). */
export function TestTube({ x, y, w = 22, h, fill = 0, liquid = '#4f9fe0', liquidOpacity = 0.55, children }: {
  x: number; y: number; w?: number; h: number; fill?: number; liquid?: string; liquidOpacity?: number; children?: ReactNode;
}) {
  const r = w / 2;
  const path = `M${x} ${y} L${x} ${y + h - r} A${r} ${r} 0 0 0 ${x + w} ${y + h - r} L${x + w} ${y}`;
  const ly = y + h - (h - 6) * Math.max(0, Math.min(1, fill));
  return (
    <g>
      <path d={path} fill="url(#kit-glass-fill)" />
      {fill > 0 && (
        <g className="kit-liquid">
          <path d={`M${x + 1.5} ${ly - 1.5} Q${x + 2.5} ${ly} ${x + 5} ${ly} L${x + w - 5} ${ly} Q${x + w - 2.5} ${ly} ${x + w - 1.5} ${ly - 1.5} L${x + w - 1.5} ${y + h - r} A${r - 1.5} ${r - 1.5} 0 0 1 ${x + 1.5} ${y + h - r} Z`} fill={liquid} opacity={liquidOpacity} />
          <path d={`M${x + 1.5} ${ly} L${x + w - 1.5} ${ly} L${x + w - 1.5} ${y + h - r} A${r - 1.5} ${r - 1.5} 0 0 1 ${x + 1.5} ${y + h - r} Z`} fill="url(#kit-liquid-shade)" />
          <path d={`M${x + 1.5} ${ly - 1.5} Q${x + 2.5} ${ly} ${x + 5} ${ly} L${x + w - 5} ${ly} Q${x + w - 2.5} ${ly} ${x + w - 1.5} ${ly - 1.5}`} fill="none" stroke={shade(liquid.startsWith('#') ? liquid : '#6f8f9c', -0.35)} strokeWidth="1" opacity="0.7" />
        </g>
      )}
      {children}
      <path d={path} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
      <rect x={x + Math.max(2, w * 0.14)} y={y + 6} width={Math.max(1.6, w * 0.09)} height={Math.max(0, h - r - 14)} rx={1} fill="#fff" opacity="0.42" />
      <line x1={x - 2} x2={x + w + 2} y1={y} y2={y} stroke="var(--glass-edge, #8fa9b3)" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}

/** Cronómetro digital. */
export function Stopwatch({ x, y, text, label = 'cronómetro' }: { x: number; y: number; text: string; label?: string }) {
  return (
    <g filter="url(#kit-shadow-soft)">
      <rect x={x + 44} y={y - 8} width={16} height={8} rx={2} fill="url(#kit-metal)" />
      <rect x={x} y={y} width={104} height={56} rx={14} fill="url(#kit-body-dark)" />
      <Lcd x={x + 8} y={y + 8} w={88} h={28} text={text} />
      <text x={x + 52} y={y + 49} textAnchor="middle" style={{ fontSize: 8, fill: '#c9d2d5', letterSpacing: 1 }}>{label.toUpperCase()}</text>
    </g>
  );
}

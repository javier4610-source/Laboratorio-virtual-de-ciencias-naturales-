import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { fmt } from '../lib/format';

/**
 * Manipulación directa de instrumentos en las escenas SVG de los laboratorios (U5).
 *
 * Cada control es un `role="slider"` enfocable con Tab que se maneja con el puntero (ratón, lápiz o dedo)
 * y con el teclado (flechas, RePág/AvPág, Inicio/Fin). El control NO guarda estado propio: recibe el valor
 * y llama a `onChange` con el nuevo valor, de modo que el laboratorio mantiene una única fuente de verdad
 * compartida con los deslizadores del panel lateral.
 *
 * Las escenas con `role="img"` no pueden contener controles (sus hijos son presentacionales), así que los
 * controles se dibujan en una capa SVG superpuesta (<ManipScene>) con el mismo viewBox.
 */

export type Pt = { x: number; y: number };
export interface RangeSpec { min: number; max: number; step: number; pageStep?: number }

/* ------------------------------------------------------------------ matemática pura (con pruebas unitarias) */

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Quita el ruido de coma flotante (0,1 + 0,2 → 0,3). */
const tidy = (v: number) => Number(v.toFixed(10));

/** Ajusta v a la rejilla origin + k·step más cercana. */
export function snap(v: number, step: number, origin = 0): number {
  if (!(step > 0)) return v;
  return tidy(origin + Math.round((v - origin) / step) * step);
}

/** Ajusta a la rejilla del rango (contada desde min) y limita a [min, max]. */
export function quantize(v: number, { min, max, step }: RangeSpec): number {
  return clamp(snap(clamp(v, min, max), step, min), min, max);
}

/** Paso de RePág/AvPág: el indicado o una décima del rango (como mínimo un paso). */
export function pageStepOf({ min, max, step, pageStep }: RangeSpec): number {
  if (pageStep && pageStep > 0) return pageStep;
  return Math.max(step, snap((max - min) / 10, step) || step);
}

/** Nuevo valor tras pulsar una tecla, o null si la tecla no corresponde al control (patrón ARIA «slider»). */
export function keyboardValue(key: string, value: number, range: RangeSpec): number | null {
  const page = pageStepOf(range);
  let next: number;
  switch (key) {
    case 'ArrowRight': case 'ArrowUp': next = value + range.step; break;
    case 'ArrowLeft': case 'ArrowDown': next = value - range.step; break;
    case 'PageUp': next = value + page; break;
    case 'PageDown': next = value - page; break;
    case 'Home': return range.min;
    case 'End': return range.max;
    default: return null;
  }
  return quantize(next, range);
}

/** Limita un punto a un rectángulo. */
export function clampPoint(p: Pt, b: { x0: number; y0: number; x1: number; y1: number }): Pt {
  return { x: clamp(p.x, Math.min(b.x0, b.x1), Math.max(b.x0, b.x1)), y: clamp(p.y, Math.min(b.y0, b.y1), Math.max(b.y0, b.y1)) };
}

/** Proyección de p sobre el segmento a→b como fracción t (sin limitar). */
export function projectT(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

/** Interpolación lineal entre dos puntos. */
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Valor equivalente a desplazar el puntero de `start` a `p` a lo largo del eje a→b (a = min, b = max). */
export function axisDragValue(p: Pt, start: Pt, startValue: number, a: Pt, b: Pt, range: RangeSpec): number {
  const dt = projectT(p, a, b) - projectT(start, a, b);
  return quantize(startValue + dt * (range.max - range.min), range);
}

const DEG = 180 / Math.PI;

/**
 * Ángulo (grados) de p visto desde el centro c en coordenadas SVG (y hacia abajo), medido en sentido
 * horario desde las 12 en punto: arriba = 0°, derecha = 90°, abajo = ±180°, izquierda = −90°. Rango (−180, 180].
 */
export function clockAngle(c: Pt, p: Pt): number {
  return Math.atan2(p.x - c.x, -(p.y - c.y)) * DEG;
}

/** Diferencia angular más corta b − a, en (−180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Perilla: ángulo (horario desde las 12) que indica un valor; el recorrido es simétrico, de −sweep/2 a +sweep/2. */
export function valueToKnobAngle(v: number, { min, max }: RangeSpec, sweep = 270): number {
  const f = max === min ? 0 : (clamp(v, min, max) - min) / (max - min);
  return -sweep / 2 + f * sweep;
}

/** Perilla: valor que corresponde a un ángulo (horario desde las 12). Fuera del recorrido se limita al extremo. */
export function knobAngleToValue(angle: number, range: RangeSpec, sweep = 270): number {
  const a = clamp(angleDelta(0, angle), -sweep / 2, sweep / 2);
  return quantize(range.min + ((a + sweep / 2) / sweep) * (range.max - range.min), range);
}

/** Perilla girada desde `startAngle` hasta `angle` (arrastre circular, relativo al valor inicial). */
export function knobRotateValue(startValue: number, startAngle: number, angle: number, range: RangeSpec, sweep = 270): number {
  return quantize(startValue + (angleDelta(startAngle, angle) / sweep) * (range.max - range.min), range);
}

/** Perilla arrastrada en vertical: subir aumenta. `travel` = unidades de pantalla para recorrer todo el rango. */
export function verticalDragValue(startValue: number, dy: number, range: RangeSpec, travel = 160): number {
  return quantize(startValue - (dy / travel) * (range.max - range.min), range);
}

/** Índice de la zona (intervalos sobre x) donde cae un punto: zonas ordenadas por su borde izquierdo. */
export function zoneAt(x: number, edges: number[]): number {
  let i = 0;
  while (i < edges.length && x >= edges[i]) i++;
  return i;
}

/** Radio de toque mínimo en unidades del viewBox para que el blanco mida ≥ 44 px de diámetro en pantalla. */
export function minHitRadius(pxPerUnit: number, minPx = 44): number {
  return pxPerUnit > 0 ? minPx / 2 / pxPerUnit : minPx / 2;
}

/* ------------------------------------------------------------------ utilidades de DOM */

/** Convierte coordenadas de pantalla a unidades de usuario del SVG (tiene en cuenta escala y desplazamiento). */
export function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Pt {
  const m = svg.getScreenCTM();
  if (!m) return { x: clientX, y: clientY };
  const inv = m.inverse();
  return { x: inv.a * clientX + inv.c * clientY + inv.e, y: inv.b * clientX + inv.d * clientY + inv.f };
}

/** Píxeles de pantalla por unidad del viewBox del SVG que contiene al elemento (se actualiza al redimensionar). */
function useSvgScale(ref: RefObject<SVGElement | null>): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg) return;
    const update = () => { const m = svg.getScreenCTM(); if (m && m.a > 0) setScale(m.a); };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

interface DragInfo { start: Pt; point: Pt }

/**
 * Arrastre con eventos de puntero sobre un elemento SVG: captura el puntero (el arrastre sigue aunque salga
 * del elemento) y entrega los puntos ya convertidos a unidades del viewBox.
 */
export function useSvgDrag<E extends SVGGraphicsElement>({ disabled, onStart, onMove, onEnd }: {
  disabled?: boolean;
  onStart?: (p: Pt) => void;
  onMove: (d: DragInfo) => void;
  onEnd?: (d: DragInfo) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [point, setPoint] = useState<Pt | null>(null);
  const state = useRef<{ id: number; start: Pt; point: Pt } | null>(null);
  const pt = (e: PointerEvent<E>) => {
    const svg = e.currentTarget.ownerSVGElement;
    return svg ? toSvgPoint(svg, e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
  };
  const finish = (e: PointerEvent<E>, commit: boolean) => {
    const s = state.current;
    if (!s || s.id !== e.pointerId) return;
    state.current = null;
    setDragging(false);
    setPoint(null);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (commit) onEnd?.({ start: s.start, point: s.point });
  };
  const handlers = {
    onPointerDown: (e: PointerEvent<E>) => {
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const p = pt(e);
      state.current = { id: e.pointerId, start: p, point: p };
      setDragging(true);
      setPoint(p);
      onStart?.(p);
    },
    onPointerMove: (e: PointerEvent<E>) => {
      const s = state.current;
      if (!s || s.id !== e.pointerId) return;
      s.point = pt(e);
      setPoint(s.point);
      onMove({ start: s.start, point: s.point });
    },
    onPointerUp: (e: PointerEvent<E>) => finish(e, true),
    onPointerCancel: (e: PointerEvent<E>) => finish(e, false),
  };
  return { dragging, point, handlers };
}

/* ------------------------------------------------------------------ componentes */

/**
 * Escena con capa de manipulación: `scene` es el SVG del laboratorio (puede ser role="img") y `children` son
 * los controles, que se dibujan en un SVG superpuesto con el mismo viewBox y role="group".
 */
export function ManipScene({ viewBox, label, scene, children }: { viewBox: string; label: string; scene: ReactNode; children: ReactNode }) {
  return (
    <div className="manip-scene">
      {scene}
      <svg className="manip-layer" viewBox={viewBox} role="group" aria-label={label}>{children}</svg>
    </div>
  );
}

/** Pista breve bajo la escena (mismo estilo de aviso informativo que el resto de la app). */
export function ManipHint({ children }: { children: ReactNode }) {
  return (
    <p className="notice info manip-hint no-print">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path d="M6 9V3.5a1.3 1.3 0 0 1 2.6 0V8m0-1.2a1.3 1.3 0 0 1 2.6 0V8.6m0-.8a1.3 1.3 0 0 1 2.6 0v.9m0 0a1.3 1.3 0 0 1 2.6 0v3.4c0 2.6-1.9 4.4-4.5 4.4H10c-1.6 0-2.7-.7-3.6-1.9L3.6 11a1.3 1.3 0 0 1 2.1-1.5L6 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

type Hit = { cx: number; cy: number; r: number } | { x: number; y: number; w: number; h: number };

export interface SvgSliderProps extends RangeSpec {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** Valor para el punto actual del puntero; `start`/`startValue` permiten arrastres relativos. */
  valueFromPoint: (d: { point: Pt; start: Pt; startValue: number }) => number;
  /** 'move' actualiza mientras se arrastra; 'end' solo al soltar (soltar una muestra en un lugar). */
  commit?: 'move' | 'end';
  hit: Hit;
  unit?: string;
  decimals?: number;
  valueText?: (v: number) => string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  /** Dibujo adicional del instrumento; recibe el estado del arrastre (p. ej., para seguir al puntero). */
  children?: ReactNode | ((s: { dragging: boolean; point: Pt | null }) => ReactNode);
  onDragChange?: (dragging: boolean) => void;
  /** Rueda del ratón cuando el control tiene el foco (perillas). */
  wheel?: boolean;
  /** Mostrar el anillo punteado que indica que la pieza se puede arrastrar. */
  affordance?: boolean;
}

/** Control deslizante genérico dibujado en SVG: base de DragHandle, Plunger y Knob. */
export function SvgSlider(props: SvgSliderProps) {
  const { label, value, onChange, valueFromPoint, commit = 'move', hit, unit, decimals = 1, valueText, disabled, orientation, children, onDragChange, wheel, affordance = true } = props;
  const range: RangeSpec = { min: props.min, max: props.max, step: props.step, pageStep: props.pageStep };
  const ref = useRef<SVGGElement>(null);
  const scale = useSvgScale(ref);
  const startValue = useRef(value);
  const latest = useRef({ value, onChange, range });
  latest.current = { value, onChange, range };
  const emit = (v: number) => { const q = quantize(v, latest.current.range); if (q !== latest.current.value) latest.current.onChange(q); };

  const { dragging, point, handlers } = useSvgDrag<SVGGElement>({
    disabled,
    onStart: () => { startValue.current = value; onDragChange?.(true); },
    onMove: (d) => { if (commit === 'move') emit(valueFromPoint({ ...d, startValue: startValue.current })); },
    onEnd: (d) => { onDragChange?.(false); if (commit === 'end') emit(valueFromPoint({ ...d, startValue: startValue.current })); },
  });
  // Si el arrastre se cancela (p. ej., el sistema toma el gesto), avisa igualmente que terminó.
  const wasDragging = useRef(false);
  useEffect(() => { if (wasDragging.current && !dragging) onDragChange?.(false); wasDragging.current = dragging; }, [dragging, onDragChange]);

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (disabled) return;
    const next = keyboardValue(e.key, value, range);
    if (next === null) return;
    e.preventDefault();
    emit(next);
  };

  const onWheel = useCallback((e: WheelEvent) => {
    const el = ref.current;
    if (!el || document.activeElement !== el) return;
    e.preventDefault();
    const { value: v, range: r } = latest.current;
    emit(v + (e.deltaY < 0 ? r.step : -r.step));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!wheel || !el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wheel, onWheel]);

  const text = valueText ? valueText(value) : `${fmt(value, decimals)}${unit ? ` ${unit}` : ''}`;
  const minR = minHitRadius(scale);
  const shape = 'r' in hit
    ? { kind: 'c' as const, cx: hit.cx, cy: hit.cy, r: Math.max(hit.r, minR) }
    : (() => {
      const w = Math.max(hit.w, 2 * minR), h = Math.max(hit.h, 2 * minR);
      return { kind: 'r' as const, x: hit.x - (w - hit.w) / 2, y: hit.y - (h - hit.h) / 2, w, h };
    })();
  const ringPad = 4 / Math.max(scale, 0.1);
  const drawShape = (cls: string, pad: number) => shape.kind === 'c'
    ? <circle className={cls} cx={shape.cx} cy={shape.cy} r={shape.r + pad} vectorEffect="non-scaling-stroke" />
    : <rect className={cls} x={shape.x - pad} y={shape.y - pad} width={shape.w + 2 * pad} height={shape.h + 2 * pad} rx={6 + pad} vectorEffect="non-scaling-stroke" />;

  return (
    <g
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      aria-valuenow={value}
      aria-valuetext={text}
      aria-orientation={orientation}
      aria-disabled={disabled || undefined}
      className={`manip${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      onKeyDown={onKeyDown}
      {...handlers}
    >
      {typeof children === 'function' ? children({ dragging, point }) : children}
      {affordance && !disabled && drawShape('manip-affordance', 0)}
      {drawShape('manip-hit', 0)}
      {drawShape('manip-ring', ringPad)}
    </g>
  );
}

/** Pieza que se arrastra libremente; el laboratorio decide qué valor corresponde a cada posición. */
export function DragHandle(props: SvgSliderProps) {
  return <SvgSlider {...props} />;
}

/**
 * Émbolo o corredera: se desplaza a lo largo del eje `from` (valor mínimo) → `to` (valor máximo).
 * El arrastre es relativo, así que agarrar el émbolo por cualquier punto no lo hace saltar.
 */
export function Plunger({ from, to, size = 44, children, ...rest }: Omit<SvgSliderProps, 'valueFromPoint' | 'hit'> & { from: Pt; to: Pt; size?: number }) {
  const range: RangeSpec = { min: rest.min, max: rest.max, step: rest.step, pageStep: rest.pageStep };
  const t = rest.max === rest.min ? 0 : (clamp(rest.value, rest.min, rest.max) - rest.min) / (rest.max - rest.min);
  const at = lerpPt(from, to, t);
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  return (
    <SvgSlider
      {...rest}
      orientation={horizontal ? 'horizontal' : 'vertical'}
      hit={{ x: at.x - size / 2, y: at.y - size / 2, w: size, h: size }}
      valueFromPoint={({ point, start, startValue }) => axisDragValue(point, start, startValue, from, to, range)}
    >
      {children}
    </SvgSlider>
  );
}

/**
 * Perilla giratoria: se gira arrastrando alrededor del centro (o en vertical si se agarra por el eje),
 * con la rueda del ratón cuando tiene el foco y con el teclado.
 */
export function Knob({ cx, cy, r = 14, sweep = 270, caption, ...rest }: Omit<SvgSliderProps, 'valueFromPoint' | 'hit' | 'children'> & { cx: number; cy: number; r?: number; sweep?: number; caption?: string }) {
  const range: RangeSpec = { min: rest.min, max: rest.max, step: rest.step, pageStep: rest.pageStep };
  const c = { x: cx, y: cy };
  const angle = valueToKnobAngle(rest.value, range, sweep);
  const rad = (a: number) => (a * Math.PI) / 180;
  const polar = (a: number, rr: number) => ({ x: cx + rr * Math.sin(rad(a)), y: cy - rr * Math.cos(rad(a)) });
  const ticks = Array.from({ length: 11 }, (_, i) => -sweep / 2 + (i * sweep) / 10);
  const p0 = polar(-sweep / 2, r + 4), p1 = polar(angle, r + 4);
  return (
    <SvgSlider
      {...rest}
      wheel
      affordance={false}
      hit={{ cx, cy, r: r + 6 }}
      valueFromPoint={({ point, start, startValue }) => {
        const near = Math.hypot(start.x - cx, start.y - cy) < r * 0.45;
        return near
          ? verticalDragValue(startValue, point.y - start.y, range)
          : knobRotateValue(startValue, clockAngle(c, start), clockAngle(c, point), range, sweep);
      }}
    >
      <g aria-hidden="true">
        {ticks.map((a) => { const q0 = polar(a, r + 7), q1 = polar(a, r + 10); return <line key={a} x1={q0.x} y1={q0.y} x2={q1.x} y2={q1.y} stroke="var(--ink-2)" strokeWidth="1" />; })}
        <path d={`M${p0.x} ${p0.y} A${r + 4} ${r + 4} 0 ${angle + sweep / 2 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`} fill="none" stroke="var(--fis)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx={cx} cy={cy + 1.5} r={r} fill="#000" opacity="0.18" />
        <circle cx={cx} cy={cy} r={r} fill="url(#kit-body-dark)" stroke="#11181a" strokeWidth="0.8" />
        {Array.from({ length: 12 }, (_, i) => { const a = i * 30, q0 = polar(a, r - 1.5), q1 = polar(a, r - 4); return <line key={i} x1={q0.x} y1={q0.y} x2={q1.x} y2={q1.y} stroke="#5d6b70" strokeWidth="1" />; })}
        <circle cx={cx} cy={cy} r={r * 0.62} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.6" />
        <line x1={polar(angle, r * 0.15).x} y1={polar(angle, r * 0.15).y} x2={polar(angle, r * 0.9).x} y2={polar(angle, r * 0.9).y} stroke="#c62828" strokeWidth="2.4" strokeLinecap="round" />
        {caption && <text x={cx} y={cy + r + 22} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>{caption}</text>}
      </g>
    </SvgSlider>
  );
}

/**
 * «interferencia» (lote 3D-5): el riel con el láser, la diapositiva y la pantalla en 3D. Funciones PURAS con el MISMO
 * modelo del laboratorio (src/models/interference.ts):
 *   - la pantalla muestra el patrón del modelo (screenColor con sen θ = y/√(y² + L²), la misma exposición del banco) en la
 *     misma ventana que la vista frontal (±15, ±60 o ±400 mm), AMPLIADA para que se vea: 5,2 unidades de ancho. Así la
 *     separación entre franjas de la doble rendija es la del modelo, ≈ λ·L/d (no hay otra fórmula en la escena);
 *   - la posición de la pantalla sobre el riel es la distancia L del banco (escala del riel: 1 unidad = 20 cm);
 *   - cerca de la diapositiva, crestas de las ondas que salen de cada rendija (DIBUJO: λ y la separación de las rendijas
 *     no están a escala —λ real ≈ 0,0005 mm—; se dibujan para ver la superposición). Se mueven con «Mover las ondas».
 */
import { fmt } from '../../lib/format';
import {
  intensity, screenColor, sinThetaOnScreen, srgbEncode, wavelengthToHex, type Aperture, type ElementKind, type LightSource,
} from '../../models/interference';
import type { SceneItem, Vec3 } from '../../three/scene';
import { arcPoints, rgbHex } from './common';

export const RAIL_UNIT_CM = 20;
export const SLIDE_X = 1; // 20 cm del riel
export const SCREEN_HALF = 2.6; // unidades de dibujo para la mitad de la ventana de la pantalla
export const STRIPS = 96;
export const RINGS = 48;
export const CREST_STEP = 0.32; // λ dibujada
const CREST_MAX = 1.7;
const AMB = 0.012;

/** Tono de la pantalla con la exposición del banco (misma curva que su imagen). */
export const tone = (c: number, exposure: number) => srgbEncode(AMB + (1 - AMB) * (1 - Math.exp(-exposure * c)));

export interface ScreenSample { y_mm: number; lum: number; rgb: [number, number, number] }

/**
 * Perfil de la pantalla en `n` franjas verticales entre −half y +half (mm), con 5 submuestras por franja (promedio; en
 * las redes, el máximo, como el banco, para que los órdenes muy estrechos no desaparezcan).
 */
export function screenProfile(ap: Aperture, source: LightSource, L_cm: number, half: number, n = STRIPS): ScreenSample[] {
  const L = L_cm * 10;
  const w = (2 * half) / n, sub = 5;
  return Array.from({ length: n }, (_, i) => {
    let best: ScreenSample | null = null;
    const sum: [number, number, number] = [0, 0, 0];
    let lum = 0;
    for (let s = 0; s < sub; s++) {
      const y = -half + (i + (s + 0.5) / sub) * w;
      const c = screenColor(ap, source, sinThetaOnScreen(y, L));
      sum[0] += c.rgb[0] / sub; sum[1] += c.rgb[1] / sub; sum[2] += c.rgb[2] / sub; lum += c.lum / sub;
      if (!best || c.lum > best.lum) best = { y_mm: y, lum: c.lum, rgb: c.rgb };
    }
    const y_mm = -half + (i + 0.5) * w;
    return ap.kind === 'red' ? { y_mm, lum: best!.lum, rgb: best!.rgb } : { y_mm, lum, rgb: sum };
  });
}

/** Posiciones (mm) de los máximos locales del perfil por encima de `min` (relativo al centro). */
export function brightFringes(profile: readonly ScreenSample[], min = 0.05): number[] {
  const out: number[] = [];
  for (let i = 1; i < profile.length - 1; i++) {
    const a = profile[i - 1].lum, b = profile[i].lum, c = profile[i + 1].lum;
    if (b >= min && b > a && b >= c) out.push(profile[i].y_mm);
  }
  return out;
}

/** Posiciones (en unidades de dibujo, eje z) de las rendijas dibujadas. */
export function drawnSlits(kind: ElementKind): number[] {
  if (kind === 'doble') return [-0.35, 0.35];
  if (kind === 'red') return [-0.6, -0.3, 0, 0.3, 0.6];
  return [0];
}

export interface InterferenceSceneInput {
  on: boolean;
  kind: ElementKind;
  kindName: string;
  source: LightSource;
  ap: Aperture;
  L_cm: number;
  half_mm: number;
  viewName: string;
  exposure: number;
  /** Segundos de la animación propia de la vista (FlowControls). */
  t: number;
}

export function interferenceScene(inp: InterferenceSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; profile: ScreenSample[] } {
  const xs = SLIDE_X + inp.L_cm / RAIL_UNIT_CM;
  const beamHex = (inp.source.wavelength === null ? '#fff6dc' : wavelengthToHex(inp.source.wavelength)) as `#${string}`;
  const circular = inp.kind === 'circular';
  const items: SceneItem[] = [
    { id: 'riel', kind: 'box', center: [5.75, -1.35, 0], size: [11.7, 0.22, 0.6], color: 'line-strong' },
    { id: 'laser', kind: 'box', center: [0.05, 0, 0], size: [0.9, 0.5, 0.5], color: '#2f393c', label: inp.source.wavelength === null ? 'Lámpara' : 'Láser' },
    { id: 'diapositiva', kind: 'box', center: [SLIDE_X, -0.3, 0], size: [0.06, 1.7, 2.2], color: '#3a4448', opacity: 0.7, label: inp.kindName },
    { id: 'pantalla', kind: 'box', center: [xs + 0.06, circular ? 0.6 : -0.1, 0], size: [0.06, circular ? 5.8 : 2.4, 2 * SCREEN_HALF + 0.4], color: '#15191b', label: `Pantalla (ampliada, ${inp.viewName})` },
    { id: 'pie-pantalla', kind: 'rod', from: [xs + 0.06, -1.3, 0], to: [xs + 0.06, -1.1, 0], radius: 0.3, color: 'ink-3' },
  ];
  // Aberturas de la diapositiva (dibujo).
  for (const [i, z] of drawnSlits(inp.kind).entries()) {
    items.push(circular
      ? { id: `abertura-${i}`, kind: 'rod', from: [SLIDE_X - 0.04, 0, z], to: [SLIDE_X + 0.04, 0, z], radius: 0.12, color: inp.on ? beamHex : '#c9d1d6' }
      : { id: `abertura-${i}`, kind: 'box', center: [SLIDE_X, 0, z], size: [0.08, 0.9, 0.07], color: inp.on ? beamHex : '#c9d1d6' });
  }
  const profile = inp.on ? screenProfile(inp.ap, inp.source, inp.L_cm, inp.half_mm, circular ? RINGS : STRIPS) : [];
  if (inp.on) {
    items.push({ id: 'haz', kind: 'rod', from: [0.5, 0, 0], to: [SLIDE_X - 0.05, 0, 0], radius: 0.05, color: beamHex, opacity: 0.9 });
    // Crestas que salen de cada rendija (dibujo, λ no a escala) y avanzan hacia la pantalla.
    const shift = ((inp.t * 0.5 * CREST_STEP) % CREST_STEP + CREST_STEP) % CREST_STEP;
    for (const [i, z] of drawnSlits(inp.kind).entries()) {
      const pts: Vec3[] = [];
      for (let r = shift + CREST_STEP * 0.5; r <= Math.min(CREST_MAX, 0.85 * (xs - SLIDE_X)); r += CREST_STEP) {
        pts.push(...arcPoints([SLIDE_X + 0.05, 0, z], r, [1, 0, 0], [0, 0, 1], -1.25, 1.25, Math.max(6, Math.round(r * 9))));
      }
      items.push({ id: `crestas-${i}`, kind: 'particles', points: pts, radius: 0.045, color: beamHex, opacity: 0.9, ...(i === 0 ? { label: 'Crestas (dibujo)' } : {}) });
    }
    const k = SCREEN_HALF / inp.half_mm; // unidades por mm en la pantalla ampliada
    if (circular) {
      // Anillos concéntricos: discos (elipsoides aplanados) de mayor a menor radio, cada uno un poco más cerca de la diapositiva.
      for (let i = profile.length - 1; i >= 0; i--) {
        const r = ((i + 1) / profile.length) * SCREEN_HALF;
        const c = profile[i].rgb;
        items.push({ id: `anillo-${i}`, kind: 'ellipsoid', center: [xs - 0.003 * (profile.length - i), 0.6, 0], radii: [0.001, r, r], color: rgbHex([tone(c[0], inp.exposure), tone(c[1], inp.exposure), tone(c[2], inp.exposure)]) });
      }
    } else {
      const w = (2 * inp.half_mm) / profile.length;
      for (const [i, p] of profile.entries()) {
        const c = p.rgb;
        items.push({ id: `franja-${i}`, kind: 'box', center: [xs, -0.1, p.y_mm * k], size: [0.02, 1.5, w * k * 1.02], color: rgbHex([tone(c[0], inp.exposure), tone(c[1], inp.exposure), tone(c[2], inp.exposure)]) });
      }
    }
  }
  const fringes = inp.on && !circular ? brightFringes(profile) : [];
  const col = inp.source.wavelength === null ? 'luz blanca' : inp.source.hidden ? 'el láser desconocido' : `el ${inp.source.name.split(' (')[0].toLowerCase()}`;
  const patternText = !inp.on
    ? 'La fuente está apagada: no hay ondas y la pantalla está oscura. Enciéndela en el banco.'
    : circular
      ? 'En la pantalla se ve un disco central brillante rodeado de anillos tenues: el patrón del modelo para un agujero circular.'
      : `En la pantalla, ampliada ${inp.viewName} alrededor del centro, se ven ${fringes.length} ${fringes.length === 1 ? 'zona brillante' : 'zonas brillantes'} con el patrón del modelo (el mismo de la vista frontal del banco)${inp.kind === 'doble' ? ': franjas equidistantes; su separación es λ·L/d' : inp.kind === 'simple' ? ': la central es el doble de ancha que las demás' : ''}.`;
  const description = `Banco óptico en 3D: ${inp.source.wavelength === null ? 'lámpara de luz blanca' : col.replace(/^el /, '')}, ${inp.kindName.toLowerCase()} a 20 cm del inicio del riel y pantalla a L = ${fmt(inp.L_cm, 1)} cm de la diapositiva. `
    + `${inp.on ? `Desde ${inp.kind === 'doble' ? 'cada una de las dos rendijas' : inp.kind === 'red' ? 'cada rendija de la red' : inp.kind === 'circular' ? 'el agujero' : 'la rendija'} salen ondas (crestas dibujadas sin escala) que se superponen: donde coinciden dos crestas la luz se refuerza y donde una cresta llega con un valle se anula. ` : ''}${patternText}`;
  // Encuadre: del láser a la pantalla (cambia solo cuando el estudiante mueve la pantalla por el riel, no cada cuadro).
  return { items, extent: Math.max(3.4, xs / 2 + 1.4), target: [xs / 2, 0.2, 0], description, profile };
}

/** Intensidad relativa del modelo en el centro de la pantalla (siempre 1): utilidad de prueba. */
export const centerIntensity = (ap: Aperture, lambda: number) => intensity(ap, 0, lambda);

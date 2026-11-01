/**
 * Colores de las escenas 3D tomados de los tokens de diseño (src/tokens.css): las primitivas guardan el NOMBRE del token
 * y se resuelven al pintar, así que la escena cambia con el tema claro/oscuro y el alto contraste sin rehacerla.
 * Funciones puras: `read` es quien lee la variable CSS (en el navegador, getComputedStyle; en las pruebas, un objeto).
 */
export const COLOR_TOKENS = [
  'ink', 'ink-2', 'ink-3', 'line', 'line-strong', 'surface', 'surface-2', 'surface-3', 'accent', 'data',
  'ok', 'warn', 'bad', 'info', 'bio', 'fis', 'qui', 'amb',
  'series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-7', 'series-8',
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
/** Un token de diseño o un color fijo «#rrggbb» (solo para colores reales del objeto, p. ej. un material). */
export type SceneColor = ColorToken | `#${string}`;

/** Valores del tema claro (respaldo si no se puede leer la hoja de estilos, p. ej. en pruebas). */
export const TOKEN_FALLBACK: Record<ColorToken, string> = {
  ink: '#0f1b2d', 'ink-2': '#4a586b', 'ink-3': '#66758a', line: '#d5dde6', 'line-strong': '#8796a8',
  surface: '#ffffff', 'surface-2': '#eef2f6', 'surface-3': '#e2e8ef', accent: '#0a5a73', data: '#b23a0a',
  ok: '#13703c', warn: '#8a5300', bad: '#b42318', info: '#1d4fa8', bio: '#256d2a', fis: '#1e5fae', qui: '#8b3aa3', amb: '#7a5800',
  'series-1': '#c2410c', 'series-2': '#2554c7', 'series-3': '#117a4b', 'series-4': '#99307d', 'series-5': '#0b87a8',
  'series-6': '#6b4200', 'series-7': '#1b2b4d', 'series-8': '#64748b',
};

export const isToken = (c: string): c is ColorToken => (COLOR_TOKENS as readonly string[]).includes(c);

/** «#abc», «#aabbcc» o «rgb(r, g, b)» → «#aabbcc»; `null` si no se reconoce (p. ej. una variable sin resolver). */
export function normalizeHex(value: string): string | null {
  const s = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return `#${[...m[1]].map((c) => c + c).join('')}`;
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) return `#${m[1]}`;
  const r = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/.exec(s);
  if (r) return `#${r.slice(1, 4).map((x) => Math.max(0, Math.min(255, Math.round(Number(x)))).toString(16).padStart(2, '0')).join('')}`;
  return null;
}

/** Resuelve un color de la escena con el lector de variables CSS (`read('--data')`). */
export function resolveColor(c: SceneColor, read: (cssVar: string) => string): string {
  if (!isToken(c)) return normalizeHex(c) ?? TOKEN_FALLBACK.ink;
  return normalizeHex(read(`--${c}`)) ?? TOKEN_FALLBACK[c];
}

export type Palette = Record<ColorToken, string>;
export function readPalette(read: (cssVar: string) => string): Palette {
  return Object.fromEntries(COLOR_TOKENS.map((t) => [t, resolveColor(t, read)])) as Palette;
}
export const paletteColor = (p: Palette, c: SceneColor) => (isToken(c) ? p[c] : normalizeHex(c) ?? p.ink);

/** Luminancia relativa (WCAG) de «#rrggbb»: sirve para saber si el fondo del tema es oscuro. */
export function luminance(hex: string): number {
  const h = normalizeHex(hex) ?? '#000000';
  const ch = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Lector de variables CSS del documento (navegador). */
export function documentReader(): (cssVar: string) => string {
  let style: CSSStyleDeclaration | null = null;
  try { style = getComputedStyle(document.documentElement); } catch { style = null; }
  return (v) => { try { return style?.getPropertyValue(v).trim() ?? ''; } catch { return ''; } };
}

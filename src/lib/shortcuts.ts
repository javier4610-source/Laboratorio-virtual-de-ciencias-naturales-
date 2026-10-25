import { useEffect, useRef } from 'react';

/**
 * Atajos de teclado de la plataforma (rediseño 2026-10). Son de una sola tecla y solo actúan cuando el foco NO
 * está en un campo, un control con teclado propio (deslizadores, interruptores, objetos manipulables del
 * laboratorio) ni dentro de la escena del laboratorio, para no interferir con los atajos de cada práctica
 * (WCAG 2.1.4: se pueden desactivar en «Ayuda y accesibilidad»).
 */
export interface ShortcutDef { keys: string; text: string; scope: 'global' | 'practica' }

export const SHORTCUTS: ShortcutDef[] = [
  { keys: '?', text: 'Mostrar u ocultar esta lista de atajos', scope: 'global' },
  { keys: '/', text: 'Buscar una práctica en el catálogo', scope: 'global' },
  { keys: '1 … 5', text: 'Ir a la etapa 1 a 5 de la práctica (Preparación … Modelo y referencias)', scope: 'practica' },
  { keys: 'C', text: 'Ir al cuaderno de datos (en el experimento)', scope: 'practica' },
  { keys: 'F', text: 'Pantalla completa del área de trabajo (en el experimento)', scope: 'practica' },
  { keys: 'I', text: 'Abrir el informe de la práctica', scope: 'practica' },
  { keys: 'N / P', text: 'Siguiente o anterior práctica del grado', scope: 'practica' },
];

const OFF_KEY = 'lvcn:atajos-apagados';

let focusSearchPending = false;
/** El atajo «/» pide que el catálogo enfoque su búsqueda cuando termine de abrir. */
export function requestCatalogSearchFocus(): void { focusSearchPending = true; }
export function takeCatalogSearchFocus(): boolean { const v = focusSearchPending; focusSearchPending = false; return v; }

export function shortcutsEnabled(): boolean {
  try { return localStorage.getItem(OFF_KEY) !== '1'; } catch { return true; }
}
export function setShortcutsEnabled(on: boolean): void {
  try { if (on) localStorage.removeItem(OFF_KEY); else localStorage.setItem(OFF_KEY, '1'); } catch { /* sin almacenamiento: queda activo en esta sesión */ }
}

// Los botones y enlaces no usan letras ni cifras, así que no bloquean los atajos; el laboratorio completo
// (.lab-layout), las gráficas (teclas propias) y los diálogos sí.
const INTERACTIVE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="slider"], [role="spinbutton"], [role="application"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="grid"], .lab-layout, .chart, .logger, dialog';

/** ¿La tecla debe ignorarse porque la persona escribe o maneja un control con teclado propio? */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return !!el.closest(INTERACTIVE);
}

/** Normaliza la tecla de un evento (minúscula; «?» y «/» tal cual). */
export function shortcutKey(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (isTypingTarget(e.target)) return null;
  if (!e.key || e.key.length !== 1) return null;
  return e.key.toLowerCase();
}

/** Registra atajos mientras el componente está montado. `map` puede cambiar en cada render. */
export function useShortcuts(map: Record<string, () => void>, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !shortcutsEnabled()) return;
      const k = shortcutKey(e);
      if (k === null) return;
      const fn = ref.current[k];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

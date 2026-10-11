import { useEffect, useState } from 'react';
import { loadJSON, saveJSON } from './storage';

export interface Prefs { theme: 'auto' | 'claro' | 'oscuro'; fontScale: 1 | 1.15 | 1.3; contrast: boolean; reduceMotion: boolean; }
const KEY = 'lvcn:preferencias';
const DEFAULT: Prefs = { theme: 'auto', fontScale: 1, contrast: false, reduceMotion: false };

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULT, ...loadJSON<Partial<Prefs>>(KEY, {}) }));
  useEffect(() => {
    saveJSON(KEY, prefs);
    const root = document.documentElement;
    if (prefs.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', prefs.theme === 'oscuro' ? 'dark' : 'light');
    root.style.setProperty('--font-scale', String(prefs.fontScale));
    root.toggleAttribute('data-contrast', prefs.contrast);
    root.toggleAttribute('data-reduce-motion', prefs.reduceMotion);
  }, [prefs]);
  return [prefs, setPrefs] as const;
}

export function prefersReducedMotion(): boolean {
  if (document.documentElement.hasAttribute('data-reduce-motion')) return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

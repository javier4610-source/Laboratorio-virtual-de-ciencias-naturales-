import { useSyncExternalStore } from 'react';

/**
 * Aplicación instalable y sin conexión.
 * El service worker (dist/sw.js, generado por scripts/build-sw.mjs) guarda toda la
 * aplicación en el primer uso; después las prácticas abren sin internet.
 */

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

export interface PwaState {
  /** El navegador ofrece instalar la aplicación (Chrome, Edge, Android). */
  canInstall: boolean;
  /** La aplicación ya quedó guardada para usarse sin conexión. */
  offlineReady: boolean;
  /** Hay una versión nueva descargada esperando para activarse. */
  updateAvailable: boolean;
  /** Se está ejecutando como aplicación instalada. */
  installed: boolean;
}

let state: PwaState = { canInstall: false, offlineReady: false, updateAvailable: false, installed: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

let deferred: InstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let reloading = false;

export function usePwa(): PwaState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  set({ canInstall: false });
  return outcome === 'accepted';
}

/** Activa la versión nueva y recarga (los datos del estudiante están en localStorage y se conservan). */
export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) { location.reload(); return; }
  reloading = true;
  waiting.postMessage('SKIP_WAITING');
}

export function dismissOfflineReady() { set({ offlineReady: false }); }

function watchInstalling(sw: ServiceWorker, firstInstall: boolean) {
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed' && !firstInstall) set({ updateAvailable: true });
    if (sw.state === 'activated' && firstInstall) set({ offlineReady: true });
  });
}

export function initPwa() {
  if (typeof window === 'undefined') return;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  set({ installed: !!standalone });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPromptEvent; set({ canInstall: true }); });
  window.addEventListener('appinstalled', () => { deferred = null; set({ canInstall: false, installed: true }); });

  if (!import.meta.env.PROD || import.meta.env.MODE === 'single' || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const sw = navigator.serviceWorker;
  sw.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
  window.addEventListener('load', async () => {
    try {
      const firstInstall = !sw.controller;
      const reg = await sw.register('./sw.js');
      registration = reg;
      if (reg.waiting && sw.controller) set({ updateAvailable: true });
      if (reg.installing) watchInstalling(reg.installing, firstInstall);
      reg.addEventListener('updatefound', () => { if (reg.installing) watchInstalling(reg.installing, !sw.controller); });
      // Buscar versiones nuevas al volver a la pestaña (sin costo si no hay cambios).
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    } catch {
      /* Sin service worker la aplicación sigue funcionando en línea. */
    }
  });
}

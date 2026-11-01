import { defineConfig } from '@playwright/test';

/**
 * Pruebas de regresión visual (docs/v2/REGRESION-VISUAL.md): capturas de pantalla comparadas con imágenes de
 * referencia guardadas en el repositorio. Configuración APARTE de playwright.config.ts para que la suite principal
 * (tests/e2e) no las recoja: se corren con «npm run test:visual» y se actualizan con «npm run test:visual:update».
 *
 * Usa sus propios puertos (por defecto 4386) para poder correr a la vez que la suite principal. Sirve la versión
 * compilada (dist/): primero «npm run build». No necesita el servidor institucional.
 *
 * Las imágenes dependen del sistema (tipografía y dibujo del navegador): se guardan por plataforma ({platform}) y
 * las de Linux se generaron con Playwright 1.56.1. No forman parte de la integración continua (ver el documento).
 */
const WEB_PORT = process.env.VISUAL_WEB_PORT ?? '4386';
const WEB_URL = `http://localhost:${WEB_PORT}`;

const base = { deviceScaleFactor: 1, colorScheme: 'light' as const };
const desktop = { ...base, viewport: { width: 1280, height: 800 } };
const mobile = { ...base, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: 'tests/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list']],
  expect: {
    // Las capturas de página completa largas (hasta ~8000 px en el celular) tardan más que los 5 s por defecto.
    timeout: 20_000,
    toHaveScreenshot: {
      // Tolerancia pequeña y FIJA en píxeles: entre dos ejecuciones en el mismo equipo cambian, como mucho, unas
      // decenas de píxeles (suavizado de bordes y desenfoques). Una proporción como 0,01 de una captura de página
      // completa (1280 × 4000 px) dejaría pasar más de 50 000 píxeles distintos, y el umbral de color por defecto
      // (0,2) no ve un cambio del color de acento: se comprobó que ambos dejaban pasar un cambio de token.
      maxDiffPixels: 250,
      threshold: 0.05,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      stylePath: 'tests/visual/estable.css',
    },
  },
  use: {
    baseURL: WEB_URL,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    contextOptions: { reducedMotion: 'reduce' },
    // Sin service worker: no aparecen los avisos «ya funciona sin conexión» ni «versión nueva».
    serviceWorkers: 'block',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: 'escritorio-claro', use: { ...desktop } },
    { name: 'escritorio-oscuro', use: { ...desktop, colorScheme: 'dark' } },
    { name: 'movil-claro', use: { ...mobile } },
    { name: 'movil-oscuro', use: { ...mobile, colorScheme: 'dark' } },
  ],
  webServer: {
    command: `npx vite preview --port ${WEB_PORT} --strictPort`,
    url: WEB_URL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

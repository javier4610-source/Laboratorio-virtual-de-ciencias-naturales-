import { defineConfig } from '@playwright/test';

/**
 * Puertos de la vista previa (vite preview) y del servidor institucional de pruebas. Por defecto 4173 y 8787;
 * se pueden cambiar con E2E_WEB_PORT y E2E_API_PORT para correr dos suites a la vez sin choques de puertos.
 * Las pruebas leen la dirección del servidor de E2E_SERVER_URL (ver tests/e2e/env.ts).
 */
const WEB_PORT = process.env.E2E_WEB_PORT ?? '4173';
const API_PORT = process.env.E2E_API_PORT ?? '8787';
const WEB_URL = `http://localhost:${WEB_PORT}`;
process.env.E2E_SERVER_URL ??= `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: WEB_URL,
    locale: 'es-CO',
    // El service worker solo se activa en la prueba sin conexión (offline.spec.ts).
    serviceWorkers: 'block',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: [
    {
      command: `npx vite preview --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Servidor institucional con base de datos en memoria, solo para las pruebas.
      command: 'node server/index.mjs',
      url: `http://localhost:${API_PORT}/api/salud`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { PORT: API_PORT, DB_PATH: ':memory:', REGISTRATION_CODE: 'PRUEBA-E2E', ALLOWED_ORIGINS: WEB_URL },
    },
  ],
});

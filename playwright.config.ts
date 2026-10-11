import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'es-CO',
    // El service worker solo se activa en la prueba sin conexión (offline.spec.ts).
    serviceWorkers: 'block',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: [
    {
      command: 'npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Servidor institucional con base de datos en memoria, solo para las pruebas.
      command: 'node server/index.mjs',
      url: 'http://localhost:8787/api/salud',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { PORT: '8787', DB_PATH: ':memory:', REGISTRATION_CODE: 'PRUEBA-E2E', ALLOWED_ORIGINS: 'http://localhost:4173' },
    },
  ],
});

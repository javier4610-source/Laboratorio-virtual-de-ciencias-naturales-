/** Dirección del servidor institucional de pruebas (la fija playwright.config.ts; por defecto el puerto 8787). */
export const SERVER = process.env.E2E_SERVER_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? '8787'}`;

/** Dirección del servidor institucional de pruebas (la fija playwright.config.ts; por defecto el puerto 8787). */
export const SERVER = process.env.E2E_SERVER_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? '8787'}`;

/** Reglas de axe: WCAG 2.0, 2.1 y 2.2 nivel A y AA (el prompt maestro v2 exige WCAG 2.2 AA). */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

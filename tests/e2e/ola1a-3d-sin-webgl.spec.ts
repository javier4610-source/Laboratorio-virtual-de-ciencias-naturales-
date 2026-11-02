import { expect, test, type Page } from '@playwright/test';
import { axe, openFree } from './organica-comun';
import { description, figureOf, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 1a SIN WebGL (--disable-webgl, como escenas-3d-sin-webgl.spec.ts): la vista de respaldo en SVG
 * dibuja la misma escena, gira con el teclado, no descarga three.js y es accesible.
 */
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({ launchOptions: { ...exe, args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] } });

function threeRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (r) => { if (/\/renderer-[^/]*\.js$/.test(r.url())) urls.push(r.url()); });
  return urls;
}

async function fallbackChecks(page: Page, prefix: string, where: string) {
  await waitEngine(page, prefix, 'sin-webgl');
  const fig = figureOf(page, prefix);
  await expect(fig.getByText('Vista de respaldo en 2D:')).toBeVisible();
  const svg = fig.locator('svg').first();
  const before = await svg.innerHTML();
  expect(before.length).toBeGreaterThan(500);
  await view(page, prefix).focus();
  await page.keyboard.press('ArrowRight');
  expect(await svg.innerHTML()).not.toBe(before);
  expect(await description(view(page, prefix))).toContain('vista girada');
  await fig.getByRole('button', { name: 'Restablecer vista' }).click();
  expect(await svg.innerHTML()).toBe(before);
  expect(await axe(page, `${where} sin WebGL`)).toEqual([]);
}

test('ola 1a sin WebGL: respaldo SVG en las cuatro prácticas y sin descargar three.js', async ({ page }) => {
  test.setTimeout(120_000);
  const loaded = threeRequests(page);
  await openFree(page, 'modelos-atomicos');
  await fallbackChecks(page, 'ato', 'modelos-atomicos');
  await expect(figureOf(page, 'ato').locator('svg text', { hasText: /^Lámina de oro$/ })).toBeVisible();

  await openFree(page, 'tabla-periodica');
  await fallbackChecks(page, 'tpe', 'tabla-periodica');
  // Las 118 columnas están en el respaldo (elegibles por su data-id) y la tabla 2D mueve la selección de la escena.
  await expect(figureOf(page, 'tpe').locator('svg [data-id^="el-"]')).toHaveCount(118);
  await page.locator('button[data-sym="Cl"]').click();
  expect(await description(view(page, 'tpe'))).toContain('Elegido: Cl (cloro)');

  await openFree(page, 'enlace-quimico');
  await page.getByRole('button', { name: '2. Moléculas y Lewis' }).click();
  await fallbackChecks(page, 'enl', 'enlace-quimico');

  await openFree(page, 'electrostatica');
  await fallbackChecks(page, 'ele', 'electrostatica');
  await expect(figureOf(page, 'ele').locator('svg text', { hasText: /^F = 0,599 N/ })).toBeVisible();
  expect(loaded, 'three.js no se descarga sin WebGL').toEqual([]);
});

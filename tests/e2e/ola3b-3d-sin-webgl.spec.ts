import { expect, test, type Page } from '@playwright/test';
import { axe, openFree } from './organica-comun';
import { description, figureOf, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 3b SIN WebGL (--disable-webgl, como ola3a-3d-sin-webgl.spec.ts): la vista de respaldo en SVG
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
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await axe(page, `${where} sin WebGL`)).toEqual([]);
}

test('ola 3b sin WebGL: respaldo SVG en las cinco prácticas y sin descargar three.js', async ({ page }) => {
  test.setTimeout(120_000);
  const loaded = threeRequests(page);
  await openFree(page, 'termodinamica');
  await fallbackChecks(page, 'td', 'termodinamica');
  await expect(figureOf(page, 'td').locator('svg text', { hasText: /^fuente caliente$/ })).toBeVisible();

  await openFree(page, 'efecto-doppler');
  await fallbackChecks(page, 'dp', 'efecto-doppler');
  await expect(figureOf(page, 'dp').locator('svg text', { hasText: /^observador$/ })).toBeVisible();

  await openFree(page, 'nutricion-digestion');
  await fallbackChecks(page, 'dg', 'nutricion-digestion');
  await expect(figureOf(page, 'dg').locator('svg text', { hasText: /^páncreas$/ })).toBeVisible();

  await openFree(page, 'biotecnologia-pcr');
  await fallbackChecks(page, 'pcr', 'biotecnologia-pcr');
  await expect(figureOf(page, 'pcr').locator('svg text', { hasText: /^cebador$/ })).toBeVisible();

  await openFree(page, 'sistema-inmune');
  await fallbackChecks(page, 'inm', 'sistema-inmune');
  await expect(figureOf(page, 'inm').locator('svg text', { hasText: /^microbio$/ })).toBeVisible();
  expect(loaded, 'three.js no se descarga sin WebGL').toEqual([]);
});

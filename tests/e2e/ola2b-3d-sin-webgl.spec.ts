import { expect, test, type Page } from '@playwright/test';
import { axe, openFree } from './organica-comun';
import { description, figureOf, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 2b SIN WebGL (--disable-webgl, como ola2a-3d-sin-webgl.spec.ts): la vista de respaldo en SVG
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

test('ola 2b sin WebGL: respaldo SVG en las tres prácticas y sin descargar three.js', async ({ page }) => {
  test.setTimeout(150_000);
  const loaded = threeRequests(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await openFree(page, 'clasificacion-seres-vivos');
  await fallbackChecks(page, 'cla', 'clasificacion-seres-vivos');
  await expect(figureOf(page, 'cla').locator('svg text', { hasText: /^6 patas articuladas/ })).toBeVisible();

  await openFree(page, 'homeostasis-glucosa');
  await page.getByRole('group', { name: 'Prueba de glucosa', exact: true }).getByRole('button', { name: 'Iniciar la prueba' }).click();
  await fallbackChecks(page, 'glu', 'homeostasis-glucosa');
  expect(await description(view(page, 'glu'))).toContain('Minuto 240');

  await openFree(page, 'efecto-invernadero');
  await fallbackChecks(page, 'inv', 'efecto-invernadero');
  await expect(figureOf(page, 'inv').locator('svg text', { hasText: /^sombra: un disco/ })).toBeVisible();
  expect(loaded, 'three.js no se descarga sin WebGL').toEqual([]);
});

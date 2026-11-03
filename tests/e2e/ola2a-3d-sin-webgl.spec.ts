import { expect, test, type Page } from '@playwright/test';
import { axe, openFree } from './organica-comun';
import { description, figureOf, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 2a SIN WebGL (--disable-webgl, como ola1b-3d-sin-webgl.spec.ts): la vista de respaldo en SVG
 * dibuja la misma escena, gira con el teclado, no descarga three.js y es accesible. La reacción 3D de
 * «cambios-quimicos» (kit de química) también cae a su respaldo SVG.
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

test('ola 2a sin WebGL: respaldo SVG en las cinco prácticas y sin descargar three.js', async ({ page }) => {
  test.setTimeout(150_000);
  const loaded = threeRequests(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await openFree(page, 'estados-de-la-materia');
  await page.getByRole('group', { name: 'Calentamiento del agua', exact: true }).getByRole('button', { name: 'Calentar' }).click();
  await fallbackChecks(page, 'est', 'estados-de-la-materia');
  expect(await description(view(page, 'est'))).toContain('27 en el vapor');

  await openFree(page, 'cambios-quimicos');
  await expect(page.getByText(/Vista de respaldo:.*este equipo no ofrece WebGL/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('img', { name: /vista de respaldo con las mismas posiciones/ }).first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await axe(page, 'cambios-quimicos sin WebGL')).toEqual([]);

  await openFree(page, 'movimiento-circular');
  await fallbackChecks(page, 'mcu', 'movimiento-circular');
  await expect(figureOf(page, 'mcu').locator('svg text', { hasText: /^v = 3,14 m\/s/ })).toBeVisible();

  await openFree(page, 'lentes');
  await fallbackChecks(page, 'len', 'lentes');
  await expect(figureOf(page, 'len').locator('svg text', { hasText: /^imagen nítida/ })).toBeVisible();

  await openFree(page, 'magnetismo-imanes');
  await fallbackChecks(page, 'mag', 'magnetismo-imanes');
  await expect(figureOf(page, 'mag').locator('svg text', { hasText: /^tu brújula/ })).toBeVisible();
  expect(loaded, 'three.js no se descarga sin WebGL').toEqual([]);
});

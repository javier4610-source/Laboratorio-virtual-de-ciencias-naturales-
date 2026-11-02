import { expect, test, type Page } from '@playwright/test';
import { axe, openFree } from './organica-comun';
import { description, figureOf, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 1b SIN WebGL (--disable-webgl, como ola1a-3d-sin-webgl.spec.ts): la vista de respaldo en SVG
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

test('ola 1b sin WebGL: respaldo SVG en las cinco prácticas y sin descargar three.js', async ({ page }) => {
  test.setTimeout(150_000);
  const loaded = threeRequests(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await openFree(page, 'configuracion-electronica');
  await page.getByRole('group', { name: 'Llenado electrón por electrón', exact: true }).getByRole('button', { name: 'Llenar paso a paso' }).click();
  await fallbackChecks(page, 'cfg', 'configuracion-electronica');
  expect(await description(view(page, 'cfg'))).toContain('2pz con 1 electrón');

  await openFree(page, 'pila-electroquimica');
  await fallbackChecks(page, 'pil', 'pila-electroquimica');
  await expect(figureOf(page, 'pil').locator('svg text', { hasText: /^Zn: 7,134 g/ })).toBeVisible();

  await openFree(page, 'meiosis');
  for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'Etapa siguiente' }).click();
  await fallbackChecks(page, 'mei', 'meiosis');
  await expect(figureOf(page, 'mei').locator('svg text', { hasText: /^gameto 1: AB D/ })).toBeVisible();

  await openFree(page, 'sistema-nervioso');
  await fallbackChecks(page, 'ner', 'sistema-nervioso');

  await openFree(page, 'sistema-circulatorio');
  await fallbackChecks(page, 'cir', 'sistema-circulatorio');
  await expect(figureOf(page, 'cir').locator('svg text', { hasText: /^válvula mitral \(cerrada\)/ })).toBeVisible();
  expect(loaded, 'three.js no se descarga sin WebGL').toEqual([]);
});

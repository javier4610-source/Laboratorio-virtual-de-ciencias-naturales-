import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';
import { description, figureOf, view, waitEngine } from './escenas-3d-comun';

/**
 * Kit de escenas 3D SIN WebGL (--disable-webgl, como quimica-inorganica-sin-webgl.spec.ts): la vista de respaldo en SVG
 * dibuja la misma escena (posiciones, vectores, rótulos y selección), gira con el teclado, no descarga three.js y es
 * accesible. Además se comprueba el gancho de prueba `window.__lvSinWebgl`.
 */
const SHOTS = process.env.KIT3D_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({ launchOptions: { ...exe, args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] } });

async function threeRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (r) => { if (/\/renderer-[^/]*\.js$/.test(r.url())) urls.push(r.url()); });
  return urls;
}

test('péndulo y célula sin WebGL: respaldo SVG con la misma escena, teclado, selección y axe', async ({ page }) => {
  const loaded = await threeRequests(page);
  await openFree(page, 'pendulo');
  await waitEngine(page, 'pen', 'sin-webgl');
  const pen = figureOf(page, 'pen');
  await expect(pen.getByText('Vista de respaldo en 2D:')).toBeVisible();
  await expect(pen.getByText(/este equipo no ofrece WebGL/)).toBeVisible();
  await expect(page.getByRole('img', { name: /^Péndulo en 3D con los vectores.*vista de respaldo en 2D/ })).toBeVisible();
  const svg = pen.locator('svg').first();
  expect(await svg.locator('circle').count(), 'lenteja y trayectoria').toBeGreaterThan(20);
  await expect(svg.locator('text', { hasText: 'P = 0,98 N' })).toBeVisible();
  // Al soltar y pausar aparecen las flechas v y T en el respaldo (mismo estado del laboratorio).
  const sim = page.getByRole('group', { name: 'Péndulo', exact: true });
  await sim.getByRole('button', { name: 'Soltar el péndulo', exact: true }).click();
  await page.waitForTimeout(400);
  await sim.getByRole('button', { name: 'Pausar' }).click();
  await expect(svg.locator('text', { hasText: /^v = \d+,\d\d m\/s$/ })).toBeVisible();
  await expect(svg.locator('text', { hasText: /^T = / })).toBeVisible();
  const v = view(page, 'pen');
  const before = await svg.innerHTML();
  await v.focus();
  await page.keyboard.press('ArrowRight');
  expect(await svg.innerHTML()).not.toBe(before);
  expect(await description(v)).toContain('vista girada 38°');
  await pen.getByRole('button', { name: 'Restablecer vista' }).click();
  expect(await svg.innerHTML()).toBe(before);
  expect(await axe(page, 'pendulo sin WebGL')).toEqual([]);
  if (SHOTS) { await pen.evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `${SHOTS}/pendulo-3d-sin-webgl-1280.png` }); }

  await openFree(page, 'celulas');
  await waitEngine(page, 'cel', 'sin-webgl');
  const cel = figureOf(page, 'cel');
  const legend = page.getByRole('list', { name: /Elementos de la escena/ });
  await legend.getByRole('button', { name: 'Núcleo' }).click();
  await expect(page.getByText(/^Núcleo\.$/)).toBeVisible();
  expect(await description(view(page, 'cel'))).toContain('Elegida: Núcleo.');
  // Tocar una estructura del dibujo también la elige (atributo data-id del SVG).
  const nucleus = cel.locator('svg [data-id="nucleo"]');
  await expect(nucleus).toHaveCount(1);
  await legend.getByRole('button', { name: 'Núcleo' }).click();
  const nb = (await nucleus.boundingBox())!;
  await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
  await expect(legend.getByRole('button', { name: 'Núcleo' })).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await axe(page, 'celulas sin WebGL (oscuro)')).toEqual([]);
  expect(loaded, 'sin WebGL no se descarga three.js').toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await openFree(page, 'celulas');
  await waitEngine(page, 'cel', 'sin-webgl');
  await noOverflow(page, 390);
  if (SHOTS) { await figureOf(page, 'cel').evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `${SHOTS}/celulas-3d-sin-webgl-oscuro-390.png` }); }
});

test('gancho de prueba window.__lvSinWebgl: fuerza el respaldo aunque haya WebGL', async ({ browser }) => {
  // Contexto con WebGL (SwiftShader): el respaldo se debe SOLO al gancho.
  const b = await browser.browserType().launch({ ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ baseURL: test.info().project.use.baseURL, locale: 'es-CO', serviceWorkers: 'block' });
  await page.addInitScript(() => { (window as { __lvSinWebgl?: boolean }).__lvSinWebgl = true; });
  await openFree(page, 'pendulo');
  await waitEngine(page, 'pen', 'sin-webgl');
  await expect(figureOf(page, 'pen').locator('canvas')).toHaveCount(0);
  await expect(figureOf(page, 'pen').locator('svg').first()).toBeVisible();
  await b.close();
});

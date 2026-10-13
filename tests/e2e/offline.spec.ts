import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'allow' });

test('sin conexión: después de la primera visita la aplicación y las prácticas abren sin internet', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 });
  await expect(page.getByText('ya funciona sin conexión')).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Laboratorio Virtual de Ciencias Naturales' })).toBeVisible();

  // Una práctica que no se había abierto: su código se cargó en la precarga.
  await page.goto('/#/practica/newton');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await page.getByRole('button', { name: 'Soltar el carrito' }).click();
  await expect(page.locator('.readout').getByText('0,707 s')).toBeVisible();

  // Las fuentes vienen de la propia aplicación, no de Google.
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family); });
  expect(fonts.join(' ')).toContain('Atkinson Hyperlegible');
});

test('manifiesto de la aplicación instalable', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of m.icons) expect((await request.get(`/${icon.src}`)).ok()).toBeTruthy();
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toContain('./index.html');
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS } from './env';

/**
 * El visor 3D de la geometría molecular debe funcionar siempre: si no hay WebGL o no se puede descargar 3Dmol.js
 * (por ejemplo, sin conexión), aparece la vista de respaldo en SVG con las mismas coordenadas, que se gira y mide.
 */
test.use({ serviceWorkers: 'block' });

test('geometría: sin el visor 3D aparece la vista de respaldo, se gira con el teclado y permite elegir átomos y medir', async ({ page }) => {
  await page.route('**/*', (r) => (/3dmol/i.test(r.request().url()) ? r.abort() : r.continue()));
  await page.goto('/#/practica/geometria');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();

  const svg = page.getByRole('img', { name: /modelo de esferas y palitos/ });
  await expect(svg).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Vista de respaldo:')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar el visor 3D' })).toBeVisible();

  const before = await svg.screenshot();
  await svg.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  expect(Buffer.compare(before, await svg.screenshot())).not.toBe(0);

  await page.getByRole('button', { name: 'Medir ángulo' }).click();
  await expect(page.locator('.readout').getByText('104,0°').first()).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

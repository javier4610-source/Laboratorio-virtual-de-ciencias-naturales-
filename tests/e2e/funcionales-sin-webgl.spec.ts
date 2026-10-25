import { expect, test, type Page } from '@playwright/test';

// Vista de respaldo del kit sin WebGL: Chromium con WebGL desactivado (opción a nivel de archivo porque obliga a un proceso nuevo).
test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--disable-webgl', '--disable-3d-apis'] } });
const SHOTS = process.env.QF_SHOTS ?? '';

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

test('reacciones-organicas sin WebGL: el visor de reacciones usa la vista de respaldo SVG con las mismas posiciones', async ({ page }) => {
  await openFree(page, 'reacciones-organicas');
  await expect(page.getByText(/Vista de respaldo:/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('svg[aria-label*="vista de respaldo"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Paso siguiente' }).click();
  await expect(page.getByText('Sí: los átomos solo se reorganizan')).toBeVisible();
  if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/rxo-sin-webgl.png` });
});

test('grupos-oxigenados sin WebGL: el visor de grupos dibuja el confórmero en SVG con los átomos resaltados', async ({ page }) => {
  await openFree(page, 'grupos-oxigenados');
  await expect(page.getByText(/Vista de respaldo:/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('svg[aria-label*="vista de respaldo"]').first()).toBeVisible();
  if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/gox-sin-webgl.png` });
});

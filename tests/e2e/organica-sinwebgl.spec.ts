import { expect, test } from '@playwright/test';
import { openFree } from './organica-comun';

const SHOTS = process.env.ORG_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

test.use({ launchOptions: { ...exe, args: ['--disable-webgl', '--disable-3d-apis'] } });
test('visores orgánicos: respaldo SVG con las mismas coordenadas y localizadores', async ({ page }) => {
  await openFree(page, 'nomenclatura-organica');
  await page.getByRole('button', { name: 'Ver en 3D' }).click();
  await expect(page.getByText(/Este equipo no tiene WebGL/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: /Modelo 3D de 2-metilpentano.*vista de respaldo/ })).toBeVisible();
  if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/sinwebgl-nomenclatura.png` });
  await openFree(page, 'hidrocarburos');
  await page.getByRole('button', { name: '4 · Conformaciones' }).click();
  await expect(page.getByRole('img', { name: /Modelo 3D del etano.*vista de respaldo/ })).toBeVisible();
});

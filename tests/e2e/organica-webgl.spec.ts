import { expect, test } from '@playwright/test';
import { openFree } from './organica-comun';

const SHOTS = process.env.ORG_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
test('visores orgánicos: 3Dmol dibuja en un lienzo WebGL (conformaciones, nomenclatura y Molecule3D del kit)', async ({ page }) => {
  await openFree(page, 'hidrocarburos');
  await page.getByRole('button', { name: '4 · Conformaciones' }).click();
  await expect(page.locator('#hcb-conf-3d canvas')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText(/vista de respaldo en SVG/)).toHaveCount(0);
  if (SHOTS) await page.locator('#hcb-conf-3d').screenshot({ path: `${SHOTS}/webgl-conformaciones.png` });
  await openFree(page, 'nomenclatura-organica');
  await page.getByRole('button', { name: 'Ver en 3D' }).click();
  await expect(page.locator('[id="nom-c-3d-3d"] canvas')).toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  if (SHOTS) await page.locator('[id="nom-c-3d-3d"]').screenshot({ path: `${SHOTS}/webgl-nomenclatura-localizadores.png` });
});

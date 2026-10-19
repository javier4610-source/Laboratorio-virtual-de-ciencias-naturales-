import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS } from './env';

/** Sin WebGL (--disable-webgl): los visores del kit de química usan la vista de respaldo SVG con las mismas coordenadas. */
test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2'], ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) } });
const SHOTS = process.env.QI_SHOTS ?? '';

test('acidos-sales sin WebGL: reacción, molécula y red cristalina en respaldo SVG, accesibles', async ({ page }) => {
  await page.goto('/#/practica/acidos-sales');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await expect(page.getByText(/este equipo no ofrece WebGL/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: /Cloruro de hidrógeno: vista de respaldo/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Reacción H₂ \+ Cl₂ → 2 HCl: vista de respaldo/ })).toBeVisible();
  await page.getByRole('button', { name: '3 · Sales' }).click();
  const crystal = page.getByRole('img', { name: /Red de Cloruro de sodio: vista de respaldo/ });
  await expect(crystal).toBeVisible();
  const before = await crystal.screenshot();
  await crystal.focus();
  await page.keyboard.press('ArrowRight');
  expect(Buffer.compare(before, await crystal.screenshot())).not.toBe(0);
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/acidos-sales-sin-webgl-1280.png` });
});

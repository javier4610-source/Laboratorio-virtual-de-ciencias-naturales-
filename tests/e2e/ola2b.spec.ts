import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';

/**
 * Ola 2b de prácticas nuevas (clasificacion-seres-vivos, homeostasis-glucosa, efecto-invernadero): flujo de cada
 * práctica, valor dorado visible en la interfaz, avisos con su corrección, guardar ensayos, ideas erróneas, axe en claro
 * y oscuro (esperando 800 ms a que terminen las transiciones del tema) y sin desbordamiento a 390 px. Las vistas 3D
 * están en ola2b-3d-webgl.spec.ts y ola2b-3d-sin-webgl.spec.ts.
 */
const ro = (page: Page, k: string) => page.locator('.readout .item').filter({ has: page.locator('.k', { hasText: k }) });
const setSlider = async (page: Page, label: string, unit: string, v: string) => {
  const f = page.getByLabel(`${label} (valor exacto${unit ? ` en ${unit}` : ''})`);
  await f.fill(v);
  await f.press('Enter');
};
const saved = (page: Page, n: number) => expect(page.getByText(`Ensayo guardado (${n} en esta sesión).`).last()).toBeVisible();
const cond = (page: Page, text: string | RegExp) => page.locator('.condition').filter({ hasText: text });
const station = (page: Page, name: string) => page.getByRole('group', { name: 'Estación' }).getByRole('button', { name, exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

async function a11yAndMobile(page: Page, id: string) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await axe(page, `${id} (${scheme})`)).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await noOverflow(page, 390);
}

test('efecto-invernadero: 255 K sin atmósfera, la capa que da 288 K y el forzamiento del CO₂', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'efecto-invernadero');
  // Valor dorado: T_e = (1361·0,7/(4σ))^¼ = 254,58 K.
  await expect(ro(page, 'Temperatura de equilibrio T_e')).toContainText('254,6 K (-18,6 °C)');
  await expect(ro(page, 'Luz absorbida S(1 − α)/4')).toContainText('238,2 W/m²');
  await page.getByRole('button', { name: 'Guardar el equilibrio en la tabla' }).click();
  await saved(page, 1);
  await page.getByLabel('Planeta', { exact: true }).selectOption('venus');
  await expect(ro(page, 'Temperatura de equilibrio T_e')).toContainText('226,6 K');
  await expect(ro(page, 'Diferencia (efecto invernadero)')).toContainText('510,4 K');
  await page.getByLabel('Planeta', { exact: true }).selectOption('tierra');
  await setSlider(page, 'Albedo α', '', '0,7');
  await expect(cond(page, 'bola de nieve')).toContainText('Cómo corregirlo');
  await setSlider(page, 'Albedo α', '', '0,3');
  await station(page, 'Capa de atmósfera');
  await expect(ro(page, 'Temperatura de la superficie T_s')).toContainText('288,1 K');
  await expect(ro(page, 'Sale al espacio = luz absorbida')).toContainText('238,2 = 238,2 W/m²');
  await page.getByRole('button', { name: 'Guardar la capa en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Absorción infrarroja de la capa ε', '', '1');
  await expect(ro(page, 'Temperatura de la superficie T_s')).toContainText('302,7 K');
  await expect(cond(page, 'capa opaca')).toContainText('Cómo corregirlo');
  await station(page, 'CO₂ y calentamiento');
  await page.getByRole('button', { name: '2 × CO₂ (556,6)' }).click();
  await expect(ro(page, 'Forzamiento ΔF = 5,35·ln(C/C₀)')).toContainText('3,71 W/m²');
  await expect(ro(page, 'Calentamiento de equilibrio')).toContainText('3,00 °C');
  await page.getByRole('button', { name: 'Guardar el forzamiento en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Sensibilidad climática de equilibrio', '°C', '6');
  await expect(cond(page, 'fuera del rango muy probable')).toContainText('Cómo corregirlo');
  await page.getByRole('group', { name: /Tu respuesta: Duplicar el CO₂ duplica/ }).getByRole('button', { name: 'Es falso' }).click();
  await expect(page.getByText(/Bien\. La idea es falsa\./)).toBeVisible();
  await a11yAndMobile(page, 'efecto-invernadero');
});

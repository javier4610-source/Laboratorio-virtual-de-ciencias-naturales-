import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';

/**
 * Ola 3b de prácticas nuevas (termodinamica, efecto-doppler, nutricion-digestion, biotecnologia-pcr, sistema-inmune):
 * flujo de cada práctica, valor dorado visible en la interfaz, avisos con su corrección, guardar ensayos, ideas
 * erróneas, axe en claro y oscuro (esperando 800 ms a que terminen las transiciones del tema) y sin desbordamiento a
 * 390 px. Las vistas 3D están en ola3b-3d-webgl.spec.ts y ola3b-3d-sin-webgl.spec.ts.
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
const idea = async (page: Page, start: string, answer: 'Es cierto' | 'Es falso') => {
  await page.getByRole('group', { name: new RegExp(`Tu respuesta: ${start}`) }).getByRole('button', { name: answer }).click();
  await expect(page.getByText(answer === 'Es falso' ? /Bien\. La idea es falsa\./ : /Bien\. La idea es cierta\./)).toBeVisible();
};

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

test('termodinamica: primera ley en los cuatro procesos, ciclo de Otto (56,5 %) y de Carnot (50 %)', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'termodinamica');
  // Valor dorado: isotérmico al doble desde 100 kPa y 1 L → W = Q = 100·ln 2 = 69,31 J y ΔU = 0.
  await expect(ro(page, 'Trabajo hecho por el gas W')).toContainText('69,31 J');
  await expect(ro(page, 'Calor recibido Q')).toContainText('69,31 J');
  await expect(ro(page, 'Cambio de energía interna ΔU = Q − W')).toContainText('0,00 J');
  await page.getByRole('button', { name: 'Guardar el proceso en la tabla' }).click();
  await saved(page, 1);
  await page.getByLabel('Proceso', { exact: true }).selectOption('isobarico');
  await expect(ro(page, 'Trabajo hecho por el gas W')).toContainText('100,00 J');
  await expect(ro(page, 'Calor recibido Q')).toContainText('350,00 J');
  await expect(ro(page, 'Cambio de energía interna ΔU = Q − W')).toContainText('250,00 J');
  await page.getByRole('button', { name: 'Guardar el proceso en la tabla' }).click();
  await saved(page, 2);
  await page.getByLabel('Proceso', { exact: true }).selectOption('adiabatico');
  await expect(ro(page, 'Calor recibido Q')).toContainText('0,00 J');
  await expect(cond(page, 'adiabático real')).toContainText('Cómo corregirlo');
  await station(page, 'Ciclo de Otto');
  // Valor dorado: η = 1 − 8^(−0,4) = 56,5 %, con los calores y con la fórmula.
  await expect(ro(page, 'Rendimiento η = W/Q_entra')).toContainText('56,5 %');
  await expect(ro(page, 'Fórmula del ciclo')).toContainText('56,5 %');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Recorrido', exact: true });
  await sim.getByRole('button', { name: 'Recorrer el ciclo' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada');
  await page.getByRole('button', { name: 'Guardar el ciclo en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Relación de compresión r', '', '12');
  await expect(cond(page, 'detonación')).toContainText('Cómo corregirlo');
  await station(page, 'Ciclo de Carnot');
  await expect(ro(page, 'Rendimiento η = W/Q_entra')).toContainText('50,0 %');
  await setSlider(page, 'Temperatura de la fuente caliente T_c', 'K', '350');
  await setSlider(page, 'Temperatura de la fuente fría T_f', 'K', '400');
  await expect(cond(page, 'no hay máquina térmica posible')).toContainText('Cómo corregirlo');
  await setSlider(page, 'Temperatura de la fuente caliente T_c', 'K', '600');
  await setSlider(page, 'Temperatura de la fuente fría T_f', 'K', '300');
  await idea(page, 'Una máquina térmica bien hecha', 'Es falso');
  await a11yAndMobile(page, 'termodinamica');
});

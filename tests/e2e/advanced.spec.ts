import { expect, test, type Page } from '@playwright/test';

/** Modo avanzado (U6): ecuaciones con valores actuales, parámetros editables y curva del modelo en el cuaderno. */

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

const toggle = (page: Page) => page.getByRole('switch', { name: 'Modo avanzado' });
const save = (page: Page) => page.getByRole('button', { name: 'Guardar ensayo en la tabla' });

async function weighAndSubmerge(page: Page) {
  await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
  await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
}

test('densidad: el modo avanzado muestra la ecuación con los valores actuales y se recuerda', async ({ page }) => {
  await openFree(page, 'densidad');
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('heading', { name: 'Ecuaciones del modelo' })).toHaveCount(0);
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  const panel = page.locator('.adv-panel');
  await expect(panel.getByRole('heading', { name: 'Ecuaciones del modelo' })).toBeVisible();
  // Antes de medir, solo la forma simbólica.
  await expect(panel.locator('[data-eq-text]').first()).toHaveAttribute('data-eq-text', 'ρ = m / V_desp');
  await expect(panel.locator('math').first()).toBeVisible();
  await weighAndSubmerge(page);
  await expect(panel.locator('[data-eq-text]').first()).toHaveAttribute('data-eq-text', 'ρ = m / V_desp = 21,6 g / 8,0 cm³ = 2,70 g/cm³');
  await expect(panel.locator('[data-eq-text]').nth(1)).toHaveAttribute('data-eq-text', 'V_desp = V_f − Vᵢ = 58,0 mL − 50,0 mL = 8,0 cm³');
  // Cambiar un control del laboratorio actualiza la sustitución en vivo.
  const side = page.getByLabel('Arista del cubo (valor exacto en cm)');
  await side.fill('3'); await side.press('Enter');
  await weighAndSubmerge(page);
  await expect(panel.locator('[data-eq-text]').first()).toHaveAttribute('data-eq-text', 'ρ = m / V_desp = 72,9 g / 27,0 cm³ = 2,70 g/cm³');
  // La preferencia se recuerda en este navegador.
  await page.reload();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
  await toggle(page).click();
  await expect(page.locator('.adv-panel')).toHaveCount(0);
});

test('newton: cambiar g en el modelo cambia las lecturas y se puede restablecer', async ({ page }) => {
  await openFree(page, 'newton');
  await page.getByLabel('Superficie').selectOption('madera');
  const readout = page.locator('.readout');
  await expect(readout.getByText('0,98 N')).toBeVisible();
  await expect(readout.getByText('1,27 N')).toBeVisible();
  await toggle(page).click();
  const g = page.getByLabel('Aceleración de la gravedad (g) (valor exacto en m/s²)');
  await g.fill('1,62'); await g.press('Enter');
  await expect(page.getByText('Parámetro del modelo modificado · referencia 9,80 m/s²')).toBeVisible();
  await expect(readout.getByText('0,16 N')).toBeVisible();
  await expect(readout.getByText('1,88 N')).toBeVisible();
  await expect(page.locator('.adv-panel [data-eq-text]').first()).toHaveAttribute('data-eq-text', 'N = m · g = 0,50 kg · 1,62 m/s² = 0,81 N');
  // El ensayo guardado queda marcado con el parámetro modificado.
  await page.getByRole('button', { name: 'Soltar el carrito' }).click();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByLabel('Observación del ensayo 1')).toHaveValue(/Parámetro del modelo modificado: g = 1,62 m\/s²/);
  await page.getByRole('button', { name: 'Restablecer g' }).click();
  await expect(readout.getByText('0,98 N')).toBeVisible();
  // Al apagar el modo avanzado el modelo vuelve a sus valores de referencia.
  await g.fill('3'); await g.press('Enter');
  await expect(readout.getByText('0,30 N')).toBeVisible();
  await toggle(page).click();
  await expect(readout.getByText('0,98 N')).toBeVisible();
});

test('cuaderno: superponer la curva del modelo con residuos y tabla accesible', async ({ page }) => {
  await openFree(page, 'densidad');
  await toggle(page).click();
  const side = page.getByLabel('Arista del cubo (valor exacto en cm)');
  for (const a of ['1,5', '2', '2,5']) {
    await side.fill(a); await side.press('Enter');
    await weighAndSubmerge(page);
    await save(page).click();
  }
  const nb = page.locator('#cuaderno');
  const overlay = nb.getByLabel('Superponer la curva del modelo');
  await expect(overlay).not.toBeChecked();
  await overlay.check();
  await expect(nb.locator('.legend')).toContainText('Modelo: m = ρ·V');
  await expect(nb.locator('path.model-curve')).toHaveCount(1);
  await expect(nb.getByRole('group', { name: 'Curva del modelo' })).toContainText('Condiciones fijas (último ensayo): Muestra: Aluminio');
  await expect(nb.getByRole('img', { name: 'Residuos respecto al modelo' })).toBeVisible();
  await nb.getByRole('button', { name: 'Ver los datos de la gráfica como tabla' }).click();
  await expect(nb.getByRole('columnheader', { name: 'y del modelo' })).toBeVisible();
  await expect(nb.locator('table.curve-table caption')).toContainText('Curva del modelo (m = ρ·V)');
  // Ejes que el modelo no relaciona: se explica en lugar de dibujar una curva falsa.
  await nb.getByLabel('Eje horizontal (x)').selectOption('densidad');
  await expect(nb.getByText(/El modelo no calcula/)).toBeVisible();
  await expect(nb.locator('path.model-curve')).toHaveCount(0);
});

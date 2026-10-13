import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

/** Pesa, sumerge y guarda la misma muestra (aluminio, 2 cm, 50 mL) `times` veces. */
async function repeatSample(page: Page, times: number) {
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: 'Reiniciar medición' }).click();
    await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
    await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
    await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  }
}

/** Texto de las columnas medidas (V geométrico, masa, V inicial, V final, V desplazado, densidad) de cada fila. */
async function readings(page: Page) {
  const rows = page.locator('#cuaderno table').first().locator('tbody tr');
  const n = await rows.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const cells = await rows.nth(i).locator('td').allInnerTexts();
    out.push(cells.slice(3, 9).join(' | '));
  }
  return out;
}

test('densidad con instrumento real: repetir la misma medición da lecturas distintas y el cuaderno calcula media y DE', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();

  const ideal = page.getByRole('button', { name: 'Instrumento ideal' });
  const real = page.getByRole('button', { name: 'Instrumento real' });
  await expect(ideal).toHaveAttribute('aria-pressed', 'true'); // modo por defecto
  await real.click();
  await expect(real).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/cada lectura incluye el error aleatorio típico del instrumento/)).toBeVisible();

  await repeatSample(page, 3);
  const values = await readings(page);
  expect(values).toHaveLength(3);
  expect(new Set(values).size, values.join('\n')).toBeGreaterThan(1);

  // El cuaderno agrupa los tres ensayos (mismas variables de entrada) y muestra la estadística.
  const stats = page.getByRole('region', { name: 'Estadística: Aluminio · Arista 2,0 cm · V inicial 50,0 mL' });
  await expect(stats).toBeVisible();
  await expect(stats.getByRole('columnheader', { name: 'Media' })).toBeVisible();
  await expect(stats.getByRole('columnheader', { name: 'DE' })).toBeVisible();
  const massRow = stats.getByRole('row', { name: /^Masa \(g\)/ });
  await expect(massRow.getByRole('cell').first()).toHaveText('3');
  const sd = await massRow.getByRole('cell').nth(2).innerText();
  const density = await stats.getByRole('row', { name: /^Densidad/ }).getByRole('cell').nth(2).innerText();
  expect(sd !== '0,00' || density !== '0,000', `DE masa ${sd}, DE densidad ${density}`).toBe(true);

  // Promedios con barras de error en la gráfica.
  await page.getByLabel('Graficar promedios con barras de error (±1 DE o ±EE)').check();
  await expect(page.getByRole('button', { name: '±EE' })).toBeVisible();

  // El modo se guarda en la sesión de la práctica.
  await page.reload();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await expect(page.getByRole('button', { name: 'Instrumento real' })).toHaveAttribute('aria-pressed', 'true');
});

test('densidad con instrumento ideal: repetir la misma medición da lecturas idénticas', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await repeatSample(page, 2);
  const values = await readings(page);
  expect(values).toHaveLength(2);
  expect(values[0]).toBe(values[1]);
  await expect(page.getByRole('cell', { name: '21,6' }).first()).toBeVisible();
});

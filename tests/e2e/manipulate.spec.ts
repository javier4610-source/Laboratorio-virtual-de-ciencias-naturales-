import { expect, test, type Page } from '@playwright/test';

/** Manipulación directa (U5): los controles dibujados en la escena y los del panel comparten el mismo estado. */

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

test('gases: el émbolo se empuja con el teclado y el deslizador del panel lo sigue', async ({ page }) => {
  await openFree(page, 'gases');
  const plunger = page.getByRole('slider', { name: 'Émbolo de la jeringa' });
  await expect(plunger).toHaveAttribute('aria-valuenow', '100');
  await plunger.focus();
  for (let i = 0; i < 5; i++) await plunger.press('ArrowLeft');
  await expect(plunger).toHaveAttribute('aria-valuenow', '50');
  await expect(page.getByRole('slider', { name: 'Volumen de la jeringa', exact: true })).toHaveValue('50');
  await expect(page.getByLabel('Volumen de la jeringa (valor exacto en mL)')).toHaveValue('50');
  await expect(page.locator('.readout').getByText('202,6 kPa')).toBeVisible();
  // y al revés: el deslizador del panel mueve el émbolo
  const exact = page.getByLabel('Volumen de la jeringa (valor exacto en mL)');
  await exact.fill('200'); await exact.press('Enter');
  await expect(plunger).toHaveAttribute('aria-valuenow', '200');
  await plunger.press('Home');
  await expect(exact).toHaveValue('20');
});

test('óptica: el puntero láser cambia el ángulo de incidencia con las flechas', async ({ page }) => {
  await openFree(page, 'optica');
  const laser = page.getByRole('slider', { name: 'Puntero láser: ángulo de incidencia' });
  await laser.focus();
  await laser.press('ArrowRight');
  await laser.press('ArrowRight');
  await expect(laser).toHaveAttribute('aria-valuetext', '42° desde la normal');
  await expect(page.getByLabel('Ángulo de incidencia (valor exacto en °)')).toHaveValue('42');
  await expect(page.locator('.readout').getByText('42,0°')).toBeVisible();
  await laser.press('End');
  await expect(page.getByLabel('Ángulo de incidencia (valor exacto en °)')).toHaveValue('89');
});

test('circuitos: la perilla de la fuente cambia la fem y la corriente', async ({ page }) => {
  await openFree(page, 'circuitos');
  const knob = page.getByRole('slider', { name: 'Perilla de la fuente: fem' });
  const current = page.locator('.readout .item').filter({ hasText: 'Corriente total' }).locator('.v');
  const before = await current.textContent();
  await knob.focus();
  await knob.press('ArrowRight');
  await expect(page.getByLabel('fem de la batería (ε) (valor exacto en V)')).toHaveValue('6,5');
  await knob.press('PageDown');
  await expect(knob).toHaveAttribute('aria-valuenow', '5.5');
  await expect(current).not.toHaveText(before ?? '');
});

test('arrastre con el puntero: el émbolo de la jeringa y la muestra de densidad', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openFree(page, 'gases');
  const plunger = page.getByRole('slider', { name: 'Émbolo de la jeringa' });
  await plunger.scrollIntoViewIfNeeded();
  const box = (await plunger.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y, { steps: 4 });
  await page.mouse.move(x - 120, y + 10, { steps: 6 });
  await page.mouse.up();
  const now = Number(await plunger.getAttribute('aria-valuenow'));
  expect(now).toBeLessThan(100);
  expect(now).toBeGreaterThanOrEqual(20);
  await expect(page.getByRole('slider', { name: 'Volumen de la jeringa', exact: true })).toHaveValue(String(now));

  // densidad: soltar el cubo sobre la balanza equivale a «1. Pesar en la balanza»
  await openFree(page, 'densidad');
  const cube = page.getByRole('slider', { name: /Muestra \(cubo\)/ });
  await cube.scrollIntoViewIfNeeded();
  const cb = (await cube.boundingBox())!;
  const balance = page.locator('.manip-layer').first();
  const lb = (await balance.boundingBox())!;
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(lb.x + lb.width * (155 / 640), lb.y + lb.height * (240 / 364), { steps: 8 });
  await page.mouse.up();
  await expect(cube).toHaveAttribute('aria-valuenow', '1');
  await expect(page.getByRole('button', { name: '1. Pesar en la balanza' })).toBeDisabled();
  await expect(page.locator('.readout').getByText('21,6 g')).toBeVisible(); // aluminio de 2 cm
  // con el teclado pasa a la probeta
  await cube.press('ArrowRight');
  await expect(page.getByRole('button', { name: '2. Sumergir en la probeta' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Guardar ensayo/ })).toBeEnabled();
});

test('péndulo y proyectiles: la lenteja y el lanzador responden al teclado', async ({ page }) => {
  await openFree(page, 'pendulo');
  const bob = page.getByRole('slider', { name: 'Lenteja del péndulo: ángulo de liberación' });
  await bob.focus();
  await bob.press('PageUp');
  await expect(page.getByLabel('Amplitud inicial (valor exacto en °)')).not.toHaveValue('10');
  await openFree(page, 'proyectiles');
  const tube = page.getByRole('slider', { name: 'Tubo del lanzador: ángulo de lanzamiento' });
  await tube.focus();
  await tube.press('ArrowUp');
  await expect(page.getByLabel('Ángulo de lanzamiento (valor exacto en °)')).toHaveValue('30,5');
  await openFree(page, 'newton');
  const ring = page.getByRole('slider', { name: 'Anillo del dinamómetro: fuerza aplicada' });
  await ring.focus();
  await ring.press('ArrowRight');
  await expect(page.getByLabel('Fuerza aplicada (valor exacto en N)')).toHaveValue('2,1');
});

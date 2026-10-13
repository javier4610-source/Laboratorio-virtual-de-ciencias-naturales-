import { expect, test, type Page } from '@playwright/test';

/** Manipulación directa (U5): los controles dibujados en la escena y los del panel comparten el mismo estado. */

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
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

/* ------------------------------------------------------------------ U5b: más laboratorios con manipulación directa */

test('enzimas: la perilla del termostato y los tubos (agregar, meter al baño, quitar) con el teclado', async ({ page }) => {
  await openFree(page, 'enzimas');
  const knob = page.getByRole('slider', { name: 'Perilla del termostato del baño' });
  await knob.focus();
  await knob.press('ArrowRight');
  await expect(page.getByLabel('Temperatura (valor exacto en °C)')).toHaveValue('38');
  await knob.press('PageUp');
  await expect(knob).toHaveAttribute('aria-valuenow', '43');
  await expect(page.getByLabel('Temperatura (valor exacto en °C)')).toHaveValue('43');
  // segundo tubo: se prepara en la gradilla con otro tampón y se mete al baño con las flechas
  await page.getByRole('button', { name: 'Agregar tubo' }).click();
  const tube2 = page.getByRole('slider', { name: /^Tubo 2 \(pH 9,0\)/ });
  await expect(tube2).toHaveAttribute('aria-valuenow', '0');
  await expect(tube2).toHaveAttribute('aria-valuetext', 'En la gradilla de la mesa');
  await expect(page.getByLabel('pH (valor exacto)')).toHaveValue('9,0');
  await expect(page.getByRole('button', { name: /Guardar ensayo/ })).toBeDisabled();
  await tube2.focus();
  await tube2.press('ArrowRight');
  await expect(tube2).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'Iniciar reacción' }).click();
  await expect(page.locator('.readout .item').first().locator('.v')).not.toHaveText('—');
  await expect(page.getByRole('button', { name: /Guardar ensayo/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Quitar tubo 2' }).click();
  await expect(page.getByRole('slider', { name: /^Tubo 2/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Agregar tubo' })).toBeEnabled();
});

test('ondas y agua: la perilla del generador, el marcador B y el punto de muestreo responden al teclado', async ({ page }) => {
  await openFree(page, 'ondas');
  const knob = page.getByRole('slider', { name: 'Perilla del generador: frecuencia' });
  await knob.focus();
  await knob.press('ArrowRight');
  await expect(page.getByLabel('Frecuencia (valor exacto en Hz)')).toHaveValue('2,25');
  const markB = page.getByRole('slider', { name: 'Marcador B sobre la regla' });
  await markB.focus();
  await markB.press('PageUp');
  await expect(page.getByLabel('Marcador B (valor exacto en m)')).toHaveValue('6,50');
  await openFree(page, 'agua');
  const point = page.getByRole('slider', { name: 'Punto de muestreo en el río: distancia al vertimiento' });
  await point.focus();
  await point.press('ArrowLeft');
  await expect(page.getByLabel('Distancia al vertimiento (valor exacto en km)')).toHaveValue('4,5');
  await expect(point).toHaveAttribute('aria-valuetext', '4,5 km aguas abajo del vertimiento');
});

test('calor y máquinas: soltar la muestra en el calorímetro mide; el colgador se desliza por la barra', async ({ page }) => {
  await openFree(page, 'calor');
  const sample = page.getByRole('slider', { name: 'Vaso con el agua caliente: llevar de la parrilla al calorímetro' });
  await sample.focus();
  await sample.press('ArrowRight');
  await expect(page.locator('.readout').getByText('39,8 °C')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Guardar ensayo/ })).toBeEnabled();
  const plate = page.getByRole('slider', { name: 'Perilla de la parrilla: temperatura de la muestra' });
  await plate.focus();
  await plate.press('ArrowDown');
  await expect(page.getByLabel('Temperatura del agua caliente (valor exacto en °C)')).toHaveValue('59');
  await expect(sample).toHaveAttribute('aria-valuenow', '0'); // cambiar la temperatura reinicia la mezcla

  await openFree(page, 'maquinas');
  const hanger = page.getByRole('slider', { name: 'Colgador de la carga: distancia al fulcro' });
  await hanger.focus();
  await hanger.press('ArrowRight');
  await expect(page.getByLabel('Distancia de la carga al fulcro (valor exacto en cm)')).toHaveValue('25');
  const dyn = page.getByRole('slider', { name: 'Dinamómetro: distancia al fulcro' });
  await dyn.focus();
  await dyn.press('End');
  await expect(page.getByLabel('Distancia de la fuerza al fulcro (valor exacto en cm)')).not.toHaveValue('40');
});

test('arrastre con el puntero: el tubo sale del baño a la gradilla y la lámpara se acerca por el riel', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openFree(page, 'enzimas');
  const tube = page.getByRole('slider', { name: /^Tubo 1 \(pH 7,0\)/ });
  await expect(tube).toHaveAttribute('aria-valuenow', '1');
  await tube.scrollIntoViewIfNeeded();
  const tb = (await tube.boundingBox())!;
  const layer = (await page.locator('.manip-layer').first().boundingBox())!;
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.mouse.move(layer.x + layer.width * (300 / 720), tb.y + tb.height / 2, { steps: 6 });
  await page.mouse.move(layer.x + layer.width * (362 / 720), layer.y + layer.height * (150 / 304), { steps: 6 });
  await page.mouse.up();
  await expect(tube).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByRole('button', { name: 'Iniciar reacción' })).toBeDisabled();
  await expect(page.getByText('El tubo 1 está en la gradilla: mételo al baño para que reaccione.')).toBeVisible();

  await openFree(page, 'fotosintesis');
  const lamp = page.getByRole('slider', { name: 'Lámpara sobre el riel: distancia al tubo' });
  await lamp.scrollIntoViewIfNeeded();
  const lb = (await lamp.boundingBox())!;
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.mouse.down();
  await page.mouse.move(lb.x + lb.width / 2 + 30, lb.y + lb.height / 2, { steps: 4 });
  await page.mouse.move(lb.x + lb.width / 2 + 60, lb.y + lb.height / 2, { steps: 4 });
  await page.mouse.up();
  const d = Number(await lamp.getAttribute('aria-valuenow'));
  expect(d).toBeLessThan(20);
  expect(d).toBeGreaterThanOrEqual(5);
  await expect(page.getByLabel('Distancia de la lámpara (valor exacto en cm)')).toHaveValue(String(d));
});

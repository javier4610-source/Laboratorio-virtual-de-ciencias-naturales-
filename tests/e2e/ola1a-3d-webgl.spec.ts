import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 1a con WebGL real (SwiftShader, como escenas-3d-webgl.spec.ts): cada escena dibuja en un lienzo,
 * sigue el estado del laboratorio, gira con el teclado y se restablece, cambia con el tema y pasa axe.
 * Capturas opcionales: OLA1A_SHOTS=<carpeta> (claro y oscuro a 1280 y 390 px).
 */
const SHOTS = process.env.OLA1A_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

async function keyboardAndTheme(page: Page, prefix: string, where: string) {
  const v = view(page, prefix);
  const rest = await pixels(v);
  expect(rest.painted / rest.total, `${where}: pinta una parte visible`).toBeGreaterThan(0.01);
  expect(rest.colors, `${where}: varios colores`).toBeGreaterThan(8);
  await v.focus();
  await page.keyboard.press('ArrowRight');
  const d0 = await description(v);
  await page.keyboard.press('+');
  expect((await pixels(v)).uri).not.toBe(rest.uri);
  expect(await description(v)).not.toBe(d0);
  expect(await description(v)).toMatch(/vista girada \d+° e inclinada \d+°, acercamiento \d,\d×/);
  await figureOf(page, prefix).getByRole('button', { name: 'Restablecer vista' }).click();
  expect((await pixels(v)).uri).toBe(rest.uri);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(250);
  const dark = await pixels(v);
  expect(dark.uri, `${where}: el tema oscuro cambia los colores`).not.toBe(rest.uri);
  expect(await axe(page, `${where} (oscuro)`)).toEqual([]);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(250);
  expect(await axe(page, `${where} (claro)`)).toEqual([]);
}

async function shots(page: Page, prefix: string, name: string) {
  if (!SHOTS) return;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const w of [1280, 390]) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.waitForTimeout(400);
      await figureOf(page, prefix).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/${name}-${scheme === 'light' ? 'claro' : 'oscuro'}-${w}.png` });
      if (w === 390) await noOverflow(page, 390);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 720 });
}

test('modelos-atomicos 3D: el montaje sigue el conteo; núcleo y modelos con su estatus', async ({ page }) => {
  await openFree(page, 'modelos-atomicos');
  await waitEngine(page, 'ato', 'disponible');
  const v = view(page, 'ato');
  await expect(figureOf(page, 'ato').locator('canvas')).toHaveCount(1);
  expect(await description(v)).toContain('Aún no se ha disparado el haz');
  await keyboardAndTheme(page, 'ato', 'modelos-atomicos 3D');
  // Mismo estado que el banco: al contar aparecen las alfas y el número de centelleos coincide con el contador.
  const f = page.getByLabel('Tiempo de conteo (valor exacto en s)');
  await f.fill('10'); await f.press('Enter');
  const before = await pixels(v);
  const sim = page.getByRole('group', { name: 'Detector de centelleo', exact: true });
  await sim.getByRole('button', { name: 'Contar centelleos' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada', { timeout: 15_000 });
  const d = await description(v);
  expect(d).toMatch(/Se dibujan 48 alfas/);
  const n = /lleva (\d+) centelleos/.exec(d)![1];
  await expect(page.locator('.readout .item').filter({ hasText: 'Centelleos contados N' })).toContainText(n);
  expect((await pixels(v)).uri).not.toBe(before.uri);
  await shots(page, 'ato', 'modelos-atomicos-3d-montaje');
  await page.getByRole('button', { name: 'Cerca del núcleo' }).click();
  await expect(figureOf(page, 'ato').locator('.scene3d-label', { hasText: /b = 0,12·d → θ = 153°/ })).toBeVisible();
  await page.getByRole('button', { name: 'Los cuatro modelos' }).click();
  await expect(figureOf(page, 'ato').getByText('Escena 3D: Ilustración educativa')).toBeVisible();
  await shots(page, 'ato', 'modelos-atomicos-3d-modelos');
});

test('tabla-periodica 3D: relieve con selección enlazada a la tabla', async ({ page }) => {
  await openFree(page, 'tabla-periodica');
  await waitEngine(page, 'tpe', 'disponible');
  const v = view(page, 'tpe');
  expect(await description(v)).toContain('Elegido: Na (sodio)');
  await keyboardAndTheme(page, 'tpe', 'tabla-periodica 3D');
  // Elegir en la tabla 2D cambia la escena 3D (mismo estado).
  const before = await pixels(v);
  await page.locator('button[data-sym="Cs"]').click();
  expect(await description(v)).toContain('Elegido: Cs (cesio)');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  // Elegir tocando una columna 3D cambia la tabla: se toca el centro de la columna del Cs proyectada (rótulo encima).
  await page.getByLabel('Propiedad que se muestra').selectOption('ei');
  expect(await description(v)).toContain('energía de ionización');
  await expect(figureOf(page, 'tpe').locator('.scene3d-label', { hasText: 'Cs (cesio): 3,894 eV' })).toBeVisible();
  await shots(page, 'tpe', 'tabla-periodica-3d');
});

test('enlace-quimico 3D: cargas parciales sobre la geometría de PubChem y mar de electrones del cobre', async ({ page }) => {
  await openFree(page, 'enlace-quimico');
  await page.getByRole('button', { name: '2. Moléculas y Lewis' }).click();
  await waitEngine(page, 'enl', 'disponible');
  const v = view(page, 'enl');
  expect(await description(v)).toContain('Molécula polar');
  await expect(figureOf(page, 'enl').locator('.scene3d-label', { hasText: /^O δ−/ })).toBeVisible();
  await keyboardAndTheme(page, 'enl', 'enlace-quimico 3D');
  await page.getByLabel('Molécula', { exact: true }).selectOption('co2');
  await expect.poll(() => description(v)).toContain('se cancelan');
  await shots(page, 'enl', 'enlace-quimico-3d-polaridad');
  await page.getByRole('button', { name: '3. Propiedades' }).click();
  await page.getByLabel('Sustancia', { exact: true }).selectOption('cobre');
  await waitEngine(page, 'enlcu', 'disponible');
  expect(await description(view(page, 'enlcu'))).toContain('mar');
  await shots(page, 'enlcu', 'enlace-quimico-3d-cobre');
});

test('electrostatica 3D: líneas, superficie equipotencial y fuerza siguen la carga de prueba', async ({ page }) => {
  await openFree(page, 'electrostatica');
  await waitEngine(page, 'ele', 'disponible');
  const v = view(page, 'ele');
  await expect(figureOf(page, 'ele').locator('.scene3d-label', { hasText: /^F = 0,599 N/ })).toBeVisible();
  await page.getByRole('button', { name: '2. Campo y potencial' }).click();
  // En la mediatriz del dipolo V = 0: no hay superficie; con una carga positiva sí (esfera).
  await expect.poll(() => description(v)).not.toContain('superficie equipotencial');
  await page.getByLabel('Configuración de cargas').selectOption('positiva');
  await expect.poll(() => description(v)).toContain('superficie equipotencial');
  await keyboardAndTheme(page, 'ele', 'electrostatica 3D');
  const before = await pixels(v);
  const x = page.getByLabel('Posición x de la carga de prueba (valor exacto en cm)');
  await x.fill('20'); await x.press('Enter');
  expect(await description(v)).toContain('(20,0; 15,0) cm');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  const toggles = page.getByRole('group', { name: 'Qué mostrar en 3D' });
  await toggles.getByRole('button', { name: 'Líneas de campo' }).click();
  expect(await description(v)).not.toContain('Las líneas de campo salen');
  await toggles.getByRole('button', { name: 'Líneas de campo' }).click();
  await shots(page, 'ele', 'electrostatica-3d');
});

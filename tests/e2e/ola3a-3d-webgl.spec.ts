import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 3a con WebGL real (SwiftShader, como ola2a-3d-webgl.spec.ts): cada escena dibuja en un lienzo,
 * sigue el estado del laboratorio, gira con el teclado y se restablece, cambia con el tema y pasa axe (esperando
 * 800 ms a que terminen las transiciones del tema).
 * Capturas opcionales: OLA3A_SHOTS=<carpeta> (claro y oscuro a 1280 y 390 px).
 */
const SHOTS = process.env.OLA3A_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
// SwiftShader dibuja sin GPU: las capturas y axe en dos temas tardan; margen amplio.
test.setTimeout(150_000);

const setSlider = async (page: Page, label: string, unit: string, v: string) => {
  const f = page.getByLabel(`${label} (valor exacto${unit ? ` en ${unit}` : ''})`);
  await f.fill(v);
  await f.press('Enter');
};

async function themeAxe(page: Page, where: string) {
  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await axe(page, `${where} (${scheme})`)).toEqual([]);
  }
}

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
  await page.waitForTimeout(800);
  expect((await pixels(v)).uri, `${where}: el tema oscuro cambia los colores`).not.toBe(rest.uri);
  await themeAxe(page, where);
}

async function shots(page: Page, target: () => ReturnType<Page['locator']>, name: string) {
  if (!SHOTS) return;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const w of [1280, 390]) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.waitForTimeout(800);
      await target().evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/${name}-${scheme === 'light' ? 'claro' : 'oscuro'}-${w}.png` });
      if (w === 390) await noOverflow(page, 390);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 720 });
}

test('gravitacion-orbitas 3D: el planeta recorre la órbita integrada, la velocidad cambia y en pausa no se mueve', async ({ page }) => {
  await openFree(page, 'gravitacion-orbitas');
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Órbita y leyes de Kepler', exact: true }).click();
  await waitEngine(page, 'grav', 'disponible');
  const v = view(page, 'grav');
  expect(await description(v)).toContain('Tierra en una órbita de semieje 1,000 UA');
  await keyboardAndTheme(page, 'grav', 'gravitacion-orbitas 3D');
  await page.emulateMedia({ colorScheme: 'light' });
  await setSlider(page, 'Excentricidad e', '', '0,6');
  await expect.poll(() => description(v)).toContain('va a 59,6 km/s');
  await expect(figureOf(page, 'grav').locator('.scene3d-label', { hasText: 'área 2' })).toBeVisible();
  const before = await pixels(v);
  const sim = page.getByRole('group', { name: 'Órbita', exact: true });
  await sim.getByRole('button', { name: 'Recorrer una vuelta' }).click();
  await page.waitForTimeout(2500);
  await sim.getByRole('button', { name: 'Pausar' }).click();
  await expect(sim.getByRole('status')).toHaveText('En pausa');
  const paused = await description(v);
  expect(paused).not.toContain('va a 59,6 km/s');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  const still = (await pixels(v)).uri;
  await page.waitForTimeout(600);
  expect((await pixels(v)).uri).toBe(still);
  expect(await description(v)).toBe(paused);
  await shots(page, () => figureOf(page, 'grav'), 'gravitacion-3d');
});

test('fluidos-bernoulli 3D: el Venturi sigue el caudal y la garganta, y la columna de la garganta baja', async ({ page }) => {
  await openFree(page, 'fluidos-bernoulli');
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Tubo de Venturi', exact: true }).click();
  await waitEngine(page, 'ven', 'disponible');
  const v = view(page, 'ven');
  expect(await description(v)).toContain('Δh = 28,6 cm');
  await keyboardAndTheme(page, 'ven', 'fluidos-bernoulli 3D');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(figureOf(page, 'ven').locator('.scene3d-label', { hasText: 'h₂' })).toBeVisible();
  await shots(page, () => figureOf(page, 'ven'), 'bernoulli-3d');
  const before = await pixels(v);
  await setSlider(page, 'Caudal de agua', 'L/s', '0,1');
  await expect.poll(() => description(v)).toContain('Δh = 3,2 cm');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  await setSlider(page, 'Diámetro de la garganta', 'mm', '25');
  await expect.poll(() => description(v)).toContain('Δh = 0,0 cm');
});

test('termoquimica 3D: los iones se disuelven, el termómetro sube y en pausa nada cambia; NH₄NO₃ invierte la flecha', async ({ page }) => {
  await openFree(page, 'termoquimica');
  await waitEngine(page, 'tq', 'disponible');
  const v = view(page, 'tq');
  expect(await description(v)).toContain('ha reaccionado el 0 %');
  await keyboardAndTheme(page, 'tq', 'termoquimica 3D');
  await page.emulateMedia({ colorScheme: 'light' });
  const before = await pixels(v);
  const sim = page.getByRole('group', { name: 'Medición', exact: true });
  await sim.getByRole('button', { name: 'Iniciar la medición' }).click();
  await page.waitForTimeout(2500);
  await sim.getByRole('button', { name: 'Pausar' }).click();
  await expect(sim.getByRole('status')).toHaveText('En pausa');
  const paused = await description(v);
  expect(paused).toContain('Es exotérmico');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  const still = (await pixels(v)).uri;
  await page.waitForTimeout(600);
  expect((await pixels(v)).uri).toBe(still);
  expect(await description(v)).toBe(paused);
  await shots(page, () => figureOf(page, 'tq'), 'termoquimica-3d');
  await page.getByLabel('Sustancia', { exact: true }).selectOption('nh4no3');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sim.getByRole('button', { name: 'Iniciar la medición' }).click();
  await expect.poll(() => description(v)).toContain('Es endotérmico');
  await expect(figureOf(page, 'tq').locator('.scene3d-label', { hasText: '← calor' })).toBeVisible();
});

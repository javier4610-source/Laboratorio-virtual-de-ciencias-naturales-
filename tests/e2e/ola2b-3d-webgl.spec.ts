import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 2b con WebGL real (SwiftShader, como ola2a-3d-webgl.spec.ts): cada escena dibuja en un lienzo,
 * sigue el estado del laboratorio, gira con el teclado y se restablece, cambia con el tema y pasa axe (esperando
 * 800 ms a que terminen las transiciones del tema).
 * Capturas opcionales: OLA2B_SHOTS=<carpeta> (claro y oscuro a 1280 y 390 px).
 */
const SHOTS = process.env.OLA2B_SHOTS ?? '';
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

test('efecto-invernadero 3D: la sombra es un disco y las flechas siguen los flujos del modelo', async ({ page }) => {
  await openFree(page, 'efecto-invernadero');
  await waitEngine(page, 'inv', 'disponible');
  const v = view(page, 'inv');
  expect(await description(v)).toContain('No hay capa que absorba infrarrojo');
  await keyboardAndTheme(page, 'inv', 'efecto-invernadero 3D');
  await page.emulateMedia({ colorScheme: 'light' });
  await shots(page, () => figureOf(page, 'inv'), 'efecto-invernadero-3d-sin-atmosfera');
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Capa de atmósfera', exact: true }).click();
  await expect.poll(() => description(v)).toContain('La capa absorbe el 78 %');
  const before = await pixels(v);
  await setSlider(page, 'Absorción infrarroja de la capa ε', '', '1');
  await expect.poll(() => description(v)).toContain('302,7 K');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  await setSlider(page, 'Absorción infrarroja de la capa ε', '', '0,78');
  await expect(figureOf(page, 'inv').locator('.scene3d-label', { hasText: 'capa hacia abajo' })).toBeVisible();
  await shots(page, () => figureOf(page, 'inv'), 'efecto-invernadero-3d-capa');
});

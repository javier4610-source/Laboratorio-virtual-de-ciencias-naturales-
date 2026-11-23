import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 3b con WebGL real (SwiftShader, como ola3a-3d-webgl.spec.ts): cada escena dibuja en un lienzo,
 * sigue el estado del laboratorio, gira con el teclado y se restablece, cambia con el tema y pasa axe (esperando
 * 800 ms a que terminen las transiciones del tema).
 * Capturas opcionales: OLA3B_SHOTS=<carpeta> (claro y oscuro a 1280 y 390 px).
 */
const SHOTS = process.env.OLA3B_SHOTS ?? '';
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

/** Inicia un recorrido, lo pausa y comprueba que la escena cambió y que en pausa queda quieta. */
async function pauseIsStill(page: Page, prefix: string, group: string, start: string, wait = 2000) {
  const v = view(page, prefix);
  const before = await pixels(v);
  const sim = page.getByRole('group', { name: group, exact: true });
  await sim.getByRole('button', { name: start }).click();
  await page.waitForTimeout(wait);
  await sim.getByRole('button', { name: 'Pausar' }).click();
  await expect(sim.getByRole('status')).toHaveText('En pausa');
  const paused = await description(v);
  expect((await pixels(v)).uri).not.toBe(before.uri);
  const still = (await pixels(v)).uri;
  await page.waitForTimeout(600);
  expect((await pixels(v)).uri).toBe(still);
  expect(await description(v)).toBe(paused);
  return paused;
}

test('termodinamica 3D: el émbolo sigue el volumen del ciclo, las flechas de calor y trabajo cambian y en pausa no se mueve', async ({ page }) => {
  await openFree(page, 'termodinamica');
  await waitEngine(page, 'td', 'disponible');
  const v = view(page, 'td');
  expect(await description(v)).toContain('el gas ocupa 1,00 L a 100,0 kPa y 300 K');
  await keyboardAndTheme(page, 'td', 'termodinamica 3D');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Ciclo de Otto', exact: true }).click();
  await expect.poll(() => description(v)).toContain('1 → 2: compresión adiabática');
  const paused = await pauseIsStill(page, 'td', 'Recorrido', 'Recorrer el ciclo', 2500);
  expect(paused).toMatch(/2 → 3|3 → 4/);
  await shots(page, () => figureOf(page, 'td'), 'termodinamica-3d');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('group', { name: 'Recorrido', exact: true }).getByRole('button', { name: 'Reiniciar' }).click();
  await setSlider(page, 'Relación de compresión r', '', '4');
  await expect.poll(() => description(v)).toContain('el gas ocupa 1,00 L');
});

test('efecto-doppler 3D: los frentes se apiñan delante de la fuente, en pausa quedan quietos y a Mach 2 aparece el cono', async ({ page }) => {
  await openFree(page, 'efecto-doppler');
  await waitEngine(page, 'dp', 'disponible');
  const v = view(page, 'dp');
  expect(await description(v)).toContain('Pulsa «Emitir sonido»');
  const paused = await pauseIsStill(page, 'dp', 'Frentes de onda', 'Emitir sonido', 3000);
  expect(paused).toMatch(/Delante de ella los frentes quedan separados/);
  await keyboardAndTheme(page, 'dp', 'efecto-doppler 3D');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Barrera del sonido', exact: true }).click();
  await page.getByRole('group', { name: 'Frentes de onda', exact: true }).getByRole('button', { name: 'Emitir sonido' }).click();
  await expect.poll(() => description(v)).toContain('semiángulo de 30,0°');
  await expect(figureOf(page, 'dp').locator('.scene3d-label', { hasText: 'cono de Mach' })).toBeVisible();
  await shots(page, () => figureOf(page, 'dp'), 'doppler-3d-mach');
});

test('nutricion-digestion 3D: el bolo recorre el tubo coloreado por pH, pierde nutrientes y en pausa queda quieto', async ({ page }) => {
  await openFree(page, 'nutricion-digestion');
  await waitEngine(page, 'dg', 'disponible');
  const v = view(page, 'dg');
  expect(await description(v)).toContain('A los 0 minutos de comer, el alimento está en boca (pH 6,8)');
  await keyboardAndTheme(page, 'dg', 'nutricion-digestion 3D');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(figureOf(page, 'dg').locator('.scene3d-label', { hasText: 'estómago pH 2,0' })).toBeVisible();
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Recorrido del almuerzo', exact: true }).click();
  const paused = await pauseIsStill(page, 'dg', 'Recorrido', 'Comer el almuerzo', 6000);
  expect(paused).toMatch(/el alimento está en (estómago|duodeno|yeyuno)/);
  await shots(page, () => figureOf(page, 'dg'), 'digestion-3d');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('group', { name: 'Recorrido', exact: true }).getByRole('button', { name: 'Reanudar' }).click();
  await expect.poll(() => description(v)).toContain('Queda sin digerir el 2 % del almidón, el 3 % de las proteínas y el 5 % de las grasas');
});

import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 2a con WebGL real (SwiftShader, como ola1b-3d-webgl.spec.ts): cada escena dibuja en un lienzo,
 * sigue el estado del laboratorio, gira con el teclado y se restablece, cambia con el tema y pasa axe (esperando
 * 800 ms a que terminen las transiciones del tema). La reacción 3D de «cambios-quimicos» usa el kit de química (3Dmol).
 * Capturas opcionales: OLA2A_SHOTS=<carpeta> (claro y oscuro a 1280 y 390 px).
 */
const SHOTS = process.env.OLA2A_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
// SwiftShader dibuja sin GPU: las capturas y axe en dos temas tardan; margen amplio.
test.setTimeout(150_000);

const setSlider = async (page: Page, label: string, unit: string, v: string) => {
  const f = page.getByLabel(`${label} (valor exacto en ${unit})`);
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

test('estados-de-la-materia 3D: red del hielo, meseta y vapor sincronizados con la curva', async ({ page }) => {
  await openFree(page, 'estados-de-la-materia');
  await waitEngine(page, 'est', 'disponible');
  const v = view(page, 'est');
  expect(await description(v)).toContain('27 en la red del hielo');
  await keyboardAndTheme(page, 'est', 'estados-de-la-materia 3D');
  const before = await pixels(v);
  await setSlider(page, 'Temperatura inicial', '°C', '-1');
  await setSlider(page, 'Temperatura final', '°C', '60');
  const sim = page.getByRole('group', { name: 'Calentamiento del agua', exact: true });
  await sim.getByRole('button', { name: 'Calentar' }).click();
  // Se pausa durante la meseta de fusión: con hielo a −1 °C y final a 60 °C la meseta ocupa ≈ 57 % de la corrida.
  await expect.poll(() => description(v), { intervals: [100] }).toContain('fusión: hielo y agua líquida a la vez');
  await sim.getByRole('button', { name: 'Pausar' }).click();
  expect(await description(v)).toMatch(/Meseta: la energía de la parrilla separa partículas sin aumentar su agitación/);
  expect((await pixels(v)).uri).not.toBe(before.uri);
  const paused = await pixels(v);
  await page.waitForTimeout(500);
  expect((await pixels(v)).uri, 'en pausa la escena queda quieta').toBe(paused.uri);
  await shots(page, () => figureOf(page, 'est'), 'estados-de-la-materia-3d');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sim.getByRole('button', { name: 'Reiniciar' }).click();
  await setSlider(page, 'Temperatura final', '°C', '110');
  await sim.getByRole('button', { name: 'Calentar' }).click();
  await expect.poll(() => description(v)).toContain('27 en el vapor');
});

test('cambios-quimicos 3D: reacción con átomos conservados y moléculas que solo se separan', async ({ page }) => {
  await openFree(page, 'cambios-quimicos');
  const card = page.locator('section.card').filter({ has: page.getByRole('heading', { name: /Vista 3D: los átomos se reorganizan/ }) });
  await expect(card.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole('region', { name: 'Conteo de átomos de la reacción' })).toContainText('Na');
  await themeAxe(page, 'cambios-quimicos 3D (reacción)');
  await shots(page, () => card, 'cambios-quimicos-3d-reaccion');
  await page.getByLabel('Proceso', { exact: true }).selectOption('disolver-azucar');
  const phys = page.getByRole('img', { name: /Azúcar que se disuelve en 3D: escena 3D/ });
  await expect(phys).toBeVisible({ timeout: 20_000 });
  const d0 = await description(phys);
  expect(d0).toContain('se rompen 0 enlaces');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('group', { name: 'Observación del proceso', exact: true }).getByRole('button', { name: 'Iniciar el proceso' }).click();
  await expect.poll(() => description(phys)).toContain('99 % del avance del modelo');
  await themeAxe(page, 'cambios-quimicos 3D (físico)');
  await shots(page, () => page.locator('section.card').filter({ has: page.getByRole('heading', { name: /las moléculas solo se separan/ }) }), 'cambios-quimicos-3d-disolver');
});

test('movimiento-circular 3D: v tangente, a hacia el centro y salida por la tangente', async ({ page }) => {
  await openFree(page, 'movimiento-circular');
  await waitEngine(page, 'mcu', 'disponible');
  const v = view(page, 'mcu');
  expect(await description(v)).toContain('La velocidad (3,14 m/s) es tangente');
  await keyboardAndTheme(page, 'mcu', 'movimiento-circular 3D');
  const sim = page.getByRole('group', { name: 'Disco girando', exact: true });
  await sim.getByRole('button', { name: 'Hacer girar 10 vueltas' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Cortar la cuerda' }).click();
  await expect.poll(() => description(v)).toContain('por la TANGENTE');
  await expect(figureOf(page, 'mcu').locator('.scene3d-label', { hasText: 'recta tangente' })).toBeVisible();
  await shots(page, () => figureOf(page, 'mcu'), 'movimiento-circular-3d');
});

test('lentes 3D: los tres rayos forman la imagen en la pantalla; el ojo miope', async ({ page }) => {
  await openFree(page, 'lentes');
  await waitEngine(page, 'len', 'disponible');
  const v = view(page, 'len');
  expect(await description(v)).toContain('La pantalla está en el lugar justo');
  await keyboardAndTheme(page, 'len', 'lentes 3D');
  const before = await pixels(v);
  await setSlider(page, 'Posición de la pantalla', 'cm', '70');
  await expect.poll(() => description(v)).toContain('mancha borrosa');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  await setSlider(page, 'Posición de la pantalla', 'cm', '55');
  await shots(page, () => figureOf(page, 'len'), 'lentes-3d-banco');
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'El ojo y las gafas' }).click();
  await page.getByLabel('Ojo', { exact: true }).selectOption('miopia');
  await waitEngine(page, 'len', 'disponible');
  await expect.poll(() => description(view(page, 'len'))).toContain('DELANTE de la retina');
  await shots(page, () => figureOf(page, 'len'), 'lentes-3d-ojo');
});

test('magnetismo-imanes 3D: líneas en el espacio y brújulas alineadas', async ({ page }) => {
  await openFree(page, 'magnetismo-imanes');
  await waitEngine(page, 'mag', 'disponible');
  const v = view(page, 'mag');
  expect(await description(v)).toContain('también por encima y por debajo de la mesa');
  await keyboardAndTheme(page, 'mag', 'magnetismo-imanes 3D');
  const before = await pixels(v);
  await setSlider(page, 'Brújula: posición este (x)', 'cm', '-10');
  await expect.poll(() => description(v)).toContain('(-10,0; 4,0) cm');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  await shots(page, () => figureOf(page, 'mag'), 'magnetismo-imanes-3d');
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Corriente y electroimán' }).click();
  await expect.poll(() => description(view(page, 'mag'))).toContain('Bobina de 50 espiras');
});

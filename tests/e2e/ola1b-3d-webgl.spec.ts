import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Vistas 3D de la ola 1b con WebGL real (SwiftShader, como ola1a-3d-webgl.spec.ts): cada escena dibuja en un lienzo,
 * sigue el estado del laboratorio, gira con el teclado y se restablece, cambia con el tema y pasa axe.
 * Capturas opcionales: OLA1B_SHOTS=<carpeta> (claro y oscuro a 1280 y 390 px).
 */
const SHOTS = process.env.OLA1B_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

const setSlider = async (page: Page, label: string, unit: string, v: string) => {
  const f = page.getByLabel(`${label} (valor exacto en ${unit})`);
  await f.fill(v);
  await f.press('Enter');
};

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
  expect((await pixels(v)).uri, `${where}: el tema oscuro cambia los colores`).not.toBe(rest.uri);
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

test('configuracion-electronica 3D: los orbitales aparecen al agregar electrones', async ({ page }) => {
  await openFree(page, 'configuracion-electronica');
  await waitEngine(page, 'cfg', 'disponible');
  const v = view(page, 'cfg');
  expect(await description(v)).toContain('Solo el núcleo');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('group', { name: 'Llenado electrón por electrón', exact: true }).getByRole('button', { name: 'Llenar paso a paso' }).click();
  await expect.poll(() => description(v)).toContain('2pz con 1 electrón');
  await keyboardAndTheme(page, 'cfg', 'configuracion-electronica 3D');
  const before = await pixels(v);
  await page.getByLabel('Elemento (Z = 1 a 54)').selectOption('26');
  await page.getByRole('group', { name: 'Llenado electrón por electrón', exact: true }).getByRole('button', { name: 'Llenar paso a paso' }).click();
  await expect.poll(() => description(v)).toContain('3dxy');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  await shots(page, 'cfg', 'configuracion-electronica-3d');
});

test('pila-electroquimica 3D: electrones por el cable, iones por el puente y masas del modelo', async ({ page }) => {
  await openFree(page, 'pila-electroquimica');
  await waitEngine(page, 'pil', 'disponible');
  const v = view(page, 'pil');
  expect(await description(v)).toContain('El cinc es el ánodo');
  await keyboardAndTheme(page, 'pil', 'pila-electroquimica 3D');
  const before = await pixels(v);
  const sim = page.getByRole('group', { name: 'Pila conectada a la carga', exact: true });
  await sim.getByRole('button', { name: 'Conectar la carga' }).click();
  await page.waitForTimeout(1200);
  await sim.getByRole('button', { name: 'Pausar' }).click();
  const d = await description(v);
  expect(d).toContain('Los electrones van por el cable del ánodo al cátodo');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  // En pausa la escena queda quieta.
  const paused = await pixels(v);
  await page.waitForTimeout(500);
  expect((await pixels(v)).uri).toBe(paused.uri);
  await shots(page, 'pil', 'pila-electroquimica-3d');
});

test('meiosis 3D: quiasma en la profase I y cuatro gametos al final', async ({ page }) => {
  await openFree(page, 'meiosis');
  await waitEngine(page, 'mei', 'disponible');
  const v = view(page, 'mei');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Etapa siguiente' }).click();
  await expect.poll(() => description(v)).toContain('Profase I');
  await expect(figureOf(page, 'mei').locator('.scene3d-label', { hasText: 'quiasma (entrecruzamiento)' })).toBeVisible();
  await keyboardAndTheme(page, 'mei', 'meiosis 3D');
  await shots(page, 'mei', 'meiosis-3d-profase');
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Etapa siguiente' }).click();
  await expect.poll(() => description(v)).toContain('Gametos: AB D; Ab D; aB d; ab d');
  await expect(figureOf(page, 'mei').locator('.scene3d-label', { hasText: /gameto 2: Ab D · recombinante/ })).toBeVisible();
  await shots(page, 'mei', 'meiosis-3d-gametos');
});

test('sistema-nervioso 3D: impulso saltatorio en la neurona y arco reflejo', async ({ page }) => {
  await openFree(page, 'sistema-nervioso');
  await waitEngine(page, 'ner', 'disponible');
  const v = view(page, 'ner');
  expect(await description(v)).toContain('en reposo');
  await keyboardAndTheme(page, 'ner', 'sistema-nervioso 3D');
  const sim = page.getByRole('group', { name: 'Impulso nervioso', exact: true });
  await sim.getByRole('button', { name: 'Estimular' }).click();
  await page.waitForTimeout(1200);
  await sim.getByRole('button', { name: 'Pausar' }).click();
  expect(await description(v)).toContain('saltando de un nodo de Ranvier');
  await shots(page, 'ner', 'sistema-nervioso-3d-neurona');
  await page.getByRole('button', { name: 'Arco reflejo' }).click();
  await waitEngine(page, 'ner', 'disponible');
  expect(await description(view(page, 'ner'))).toContain('Arco reflejo de retirada');
  await shots(page, 'ner', 'sistema-nervioso-3d-arco');
});

test('sistema-circulatorio 3D: válvulas y sangre siguen el ciclo del modelo', async ({ page }) => {
  await openFree(page, 'sistema-circulatorio');
  await waitEngine(page, 'cir', 'disponible');
  const v = view(page, 'cir');
  expect(await description(v)).toContain('Válvulas tricúspide y mitral cerradas');
  await keyboardAndTheme(page, 'cir', 'sistema-circulatorio 3D');
  await setSlider(page, 'Intensidad del ejercicio', '%', '50');
  await expect.poll(() => description(v)).toContain('a 135 latidos por minuto');
  await shots(page, 'cir', 'sistema-circulatorio-3d');
});

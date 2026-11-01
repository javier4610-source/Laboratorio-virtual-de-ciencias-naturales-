import { expect, test } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Kit de escenas 3D con WebGL real (SwiftShader en Chromium sin pantalla, como organica-webgl.spec.ts): los pilotos del
 * péndulo y de la célula dibujan en un lienzo (píxeles pintados), siguen el estado del laboratorio, giran con el
 * teclado y se restablecen, y pasan axe en tema claro y oscuro sin desbordar a 390 px.
 * Capturas opcionales: KIT3D_SHOTS=<carpeta>.
 */
const SHOTS = process.env.KIT3D_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

test('péndulo 3D: three.js dibuja, sigue la simulación (pausa incluida) y responde al teclado', async ({ page }) => {
  await openFree(page, 'pendulo');
  await waitEngine(page, 'pen', 'disponible');
  const v = view(page, 'pen');
  await expect(figureOf(page, 'pen').locator('canvas')).toHaveCount(1);
  await expect(page.getByText('Vista de respaldo en 2D')).toHaveCount(0);
  const rest = await pixels(v);
  expect(rest.painted / rest.total, 'la escena pinta una parte visible del lienzo').toBeGreaterThan(0.03);
  expect(rest.colors, 'varios colores: mesa, soporte, hilo, lenteja y flecha del peso').toBeGreaterThan(20);
  expect(await description(v)).toContain('sostenida a 10° de la vertical');
  await expect(figureOf(page, 'pen').locator('.scene3d-label', { hasText: /^P = 0,98 N$/ })).toBeVisible();

  // Teclado: → gira (cambian la imagen y la descripción); «Restablecer vista» vuelve a la imagen inicial.
  await v.focus();
  await expect(v).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('+');
  const turned = await pixels(v);
  expect(turned.uri).not.toBe(rest.uri);
  expect(await description(v)).toMatch(/vista girada 38° e inclinada 28°, acercamiento 1,3×/);
  await page.getByRole('button', { name: 'Restablecer vista' }).click();
  expect((await pixels(v)).uri).toBe(rest.uri);
  // Con el ratón: arrastrar gira.
  const box = (await v.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  expect((await pixels(v)).uri).not.toBe(rest.uri);
  await page.getByRole('button', { name: 'Restablecer vista' }).click();

  // La escena usa el MISMO estado que el banco: al soltar aparecen v y T; con «Pausar» queda congelada.
  const sim = page.getByRole('group', { name: 'Péndulo', exact: true });
  await sim.getByRole('button', { name: 'Soltar el péndulo', exact: true }).click();
  await page.waitForTimeout(450);
  await sim.getByRole('button', { name: 'Pausar' }).click();
  await expect(sim.getByRole('status')).toHaveText('En pausa');
  const paused = await description(v);
  expect(paused).toMatch(/^Péndulo en 3D en t = \d+,\d\d s: ángulo -?\d+°, rapidez \d+,\d\d m\/s/);
  await expect(figureOf(page, 'pen').locator('.scene3d-label', { hasText: /^T = / })).toBeVisible();
  const frozen = await pixels(v);
  await page.waitForTimeout(700);
  expect(await description(v), 'en pausa la escena no avanza').toBe(paused);
  expect((await pixels(v)).uri).toBe(frozen.uri);
  // El instante del banco y el de la escena coinciden: la descripción 2D da el mismo ángulo.
  const deg = /ángulo (-?\d+)°/.exec(paused)![1];
  await expect(page.locator('#pen-d')).toContainText(`ángulo ${deg}°`);
  await sim.getByRole('button', { name: 'Reanudar' }).click();
  await page.waitForTimeout(300);
  expect(await description(v)).not.toBe(paused);
  await sim.getByRole('button', { name: 'Reiniciar' }).click();

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(200);
    expect(await axe(page, `pendulo 3D (${scheme})`)).toEqual([]);
  }
  // El tema cambia los colores de la escena (tokens): la imagen en oscuro es distinta de la clara.
  const dark = await pixels(v);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(200);
  expect((await pixels(v)).uri).not.toBe(dark.uri);
});

test('célula 3D: organelos elegibles enlazados con la práctica y con la observación', async ({ page }) => {
  await openFree(page, 'celulas');
  await waitEngine(page, 'cel', 'disponible');
  const v = view(page, 'cel');
  const px = await pixels(v);
  expect(px.painted / px.total).toBeGreaterThan(0.05);
  expect(await description(v)).toContain('«Epidermis de cebolla»');
  const legend = page.getByRole('list', { name: /Elementos de la escena: Modelo 3D de una célula/ });
  await expect(legend.getByRole('button')).toHaveText(['Pared celular', 'Membrana celular', 'Núcleo']);
  await legend.getByRole('button', { name: 'Núcleo' }).click();
  await expect(legend.getByRole('button', { name: 'Núcleo' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^Núcleo\.$/)).toBeVisible();
  await expect(page.getByText(/no se ve: .*tinci/)).toBeVisible();
  expect(await description(v)).toContain('Elegida: Núcleo.');
  const selected = await pixels(v);
  expect(selected.uri, 'el núcleo elegido se resalta').not.toBe(px.uri);
  // Con lugol el núcleo se ve: la ficha lo dice (el mismo modelo de observación del microscopio).
  await page.getByLabel('Tinción', { exact: true }).selectOption({ label: 'Lugol' });
  await expect(page.getByText(/con esta preparación \(40×, lugol\), se ve\./)).toBeVisible();
  // Clic en la escena: elige la estructura que está bajo el puntero (rayo de three.js).
  await legend.getByRole('button', { name: 'Núcleo' }).click();
  await expect(legend.getByRole('button', { name: 'Núcleo' })).toHaveAttribute('aria-pressed', 'false');
  await v.click();
  await expect(legend.getByRole('button', { pressed: true })).toHaveCount(1);
  // Otra muestra: elodea tiene cloroplastos (nube de partículas).
  await page.getByLabel('Muestra', { exact: true }).selectOption({ label: 'Hoja de elodea' });
  await expect(legend.getByRole('button', { name: 'Cloroplastos' })).toBeVisible();
  await legend.getByRole('button', { name: 'Cloroplastos' }).click();
  await expect(page.getByText(/clorofila/).first()).toBeVisible();
  // Teclado
  const before = await pixels(v);
  await v.focus();
  await page.keyboard.press('ArrowLeft');
  expect((await pixels(v)).uri).not.toBe(before.uri);
  await page.keyboard.press('Home');
  expect((await pixels(v)).uri).toBe(before.uri);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(200);
    expect(await axe(page, `celulas 3D (${scheme})`)).toEqual([]);
  }
});

test('escenas 3D a 390 px: sin desbordamiento, giro con los botones y capturas', async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const [id, prefix] of [['pendulo', 'pen'], ['celulas', 'cel']] as const) {
        await openFree(page, id);
        await waitEngine(page, prefix, 'disponible');
        await noOverflow(page, width);
        const fig = figureOf(page, prefix);
        const box = (await fig.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        if (prefix === 'pen') {
          const sim = page.getByRole('group', { name: 'Péndulo', exact: true });
          await sim.getByRole('button', { name: 'Soltar el péndulo', exact: true }).click();
          await page.waitForTimeout(350);
          await sim.getByRole('button', { name: 'Pausar' }).click();
        } else {
          await page.getByLabel('Muestra', { exact: true }).selectOption({ label: 'Hoja de elodea' });
          await page.getByRole('list', { name: /Elementos de la escena/ }).getByRole('button', { name: 'Cloroplastos' }).click();
        }
        const v = view(page, prefix);
        const a = await pixels(v);
        await fig.getByRole('button', { name: 'Girar a la derecha' }).click();
        expect((await pixels(v)).uri).not.toBe(a.uri);
        await fig.getByRole('button', { name: 'Girar a la izquierda' }).click();
        if (SHOTS) {
          await fig.evaluate((el) => el.scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${SHOTS}/${id}-3d-${scheme}-${width}.png` });
        }
      }
    }
  }
});

test('giro automático: lo inicia la persona, se pausa (WCAG 2.2.2) y no existe con movimiento reducido', async ({ page }) => {
  await openFree(page, 'celulas');
  await waitEngine(page, 'cel', 'disponible');
  const fig = figureOf(page, 'cel');
  const v = view(page, 'cel');
  const a = await pixels(v);
  await page.waitForTimeout(400);
  expect((await pixels(v)).uri, 'quieta al abrir: nada se mueve solo').toBe(a.uri);
  await fig.getByRole('button', { name: 'Girar sola' }).click();
  await page.waitForTimeout(400);
  await fig.getByRole('button', { name: 'Pausar el giro' }).click();
  const b = await pixels(v);
  expect(b.uri).not.toBe(a.uri);
  await page.waitForTimeout(400);
  expect((await pixels(v)).uri, 'en pausa no gira').toBe(b.uri);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFree(page, 'celulas');
  await waitEngine(page, 'cel', 'disponible');
  await expect(figureOf(page, 'cel').getByRole('button', { name: 'Girar sola' })).toBeDisabled();
});

import { expect, test, type Page } from '@playwright/test';
import { figureOf, waitEngine } from './escenas-3d-comun';
import { axe } from './organica-comun';

/**
 * Reintento sin recargar tras un import() fallido (src/lib/importar.ts, docs/v2/RENDIMIENTO.md). Chromium guarda en su
 * mapa de módulos el error de un import() y no vuelve a pedir la misma dirección hasta recargar; el reintento pide el
 * fragmento con «?reintento=n». Cada prueba corta la red del archivo (page.route + abort), la devuelve y comprueba que
 * «Reintentar» lo descarga sin recargar la página (la marca puesta en window sigue ahí). Si el reintento también
 * falla, aparece «Recargar la página», que recarga y recupera la sección.
 *
 * Capturas opcionales: REINTENTO_SHOTS=/ruta npx playwright test tests/e2e/reintento-descarga.spec.ts
 */
const SHOTS = process.env.REINTENTO_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

// WebGL por software (SwiftShader) para las pruebas de la vista 3D; el resto no lo necesita.
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

/**
 * Corta la red de los archivos que coinciden hasta llamar a `restore()` (como quedarse sin conexión y recuperarla).
 * No basta con cortar una sola petición: Vite pide antes el mismo archivo con <link rel="modulepreload">.
 */
async function cut(page: Page, pattern: RegExp) {
  const pedidos: string[] = [];
  let offline = true;
  await page.route(pattern, (route) => {
    pedidos.push(route.request().url());
    return offline ? route.abort() : route.continue();
  });
  return { pedidos, restore: () => { offline = false; } };
}

/** Marca la página: si sigue después del reintento, no hubo recarga. */
const mark = (page: Page) => page.evaluate(() => { (window as { __sinRecargar?: boolean }).__sinRecargar = true; });
const notReloaded = (page: Page) => page.evaluate(() => (window as { __sinRecargar?: boolean }).__sinRecargar === true);

async function shots(page: Page, name: string) {
  if (!SHOTS) return;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()!.width}-${scheme === 'light' ? 'claro' : 'oscuro'}.png` });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

async function axeBoth(page: Page, where: string) {
  const errors: string[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(800);
    errors.push(...(await axe(page, `${where} ${scheme}`)));
  }
  await page.emulateMedia({ colorScheme: 'light' });
  return errors;
}

test('práctica: sin red al abrirla, «Reintentar» la descarga sin recargar la página', async ({ page }) => {
  const { pedidos, restore } = await cut(page, /\/assets\/densidad-[\w-]+\.js(\?.*)?$/);
  await page.goto('/');
  await mark(page);
  await page.goto('/#/practica/densidad');
  const alerta = page.getByRole('alert').filter({ hasText: 'No se pudo cargar la práctica' });
  await expect(alerta).toBeVisible({ timeout: 20_000 });
  // Aún no se ha reintentado: solo «Reintentar».
  await expect(alerta.getByRole('button', { name: 'Recargar la página' })).toHaveCount(0);
  expect(await axeBoth(page, 'práctica sin red')).toEqual([]);
  for (const w of [1280, 390]) { await page.setViewportSize({ width: w, height: 800 }); await shots(page, 'reintento-practica'); }
  await page.setViewportSize({ width: 1280, height: 800 });
  restore();
  await alerta.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /densidad/i })).toBeVisible({ timeout: 20_000 });
  expect(await notReloaded(page)).toBe(true);
  expect(pedidos.at(-1)).toMatch(/\?reintento=1$/);
});

test('banco Saber 11: un grado sin red se recupera con «Reintentar» sin recargar', async ({ page }) => {
  const { pedidos, restore } = await cut(page, /\/assets\/grado8-[\w-]+\.js(\?.*)?$/);
  const otros = new Set<string>();
  page.on('requestfinished', (r) => { const m = r.url().match(/\/grado(6|7|9|10|11)-/); if (m) otros.add(m[1]); });
  await page.goto('/#/banco');
  await mark(page);
  const alerta = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar las preguntas del banco' });
  // Cada grado que llega vuelve a pedir los que faltan (8.º, aún sin red): se espera a que lleguen los otros cinco para
  // devolver la red justo antes de pulsar «Reintentar» (si no, un pedido automático lo recupera antes del clic).
  await expect.poll(() => otros.size, { timeout: 20_000 }).toBe(5);
  await expect(alerta).toBeVisible({ timeout: 20_000 });
  restore();
  await alerta.getByRole('button', { name: 'Reintentar' }).click();
  await expect(alerta).toHaveCount(0);
  const origen = page.getByLabel('Origen');
  await expect(origen.locator('option').first()).toHaveText(/^Banco tipo Saber \(\d+\)$/);
  await page.getByLabel('Grado recomendado').selectOption('8');
  expect(Number(await page.locator('.kpi').filter({ hasText: 'preguntas con estos filtros' }).locator('.v').textContent())).toBeGreaterThan(0);
  expect(await notReloaded(page)).toBe(true);
  expect(pedidos.at(-1)).toMatch(/\/grado8-[\w-]+\.js\?reintento=\d+$/);
});

test('banco avanzado: un bloque sin red se recupera con «Reintentar» sin recargar', async ({ page }) => {
  const { restore } = await cut(page, /\/assets\/bloqueC-[\w-]+\.js(\?.*)?$/);
  await page.goto('/#/banco/avanzado');
  await mark(page);
  const alerta = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar las preguntas del banco avanzado' });
  await expect(alerta).toBeVisible({ timeout: 20_000 });
  restore();
  await alerta.getByRole('button', { name: 'Reintentar' }).click();
  await expect(alerta).toHaveCount(0);
  await expect(page.getByText(/· 180 de 180 preguntas\./)).toBeVisible({ timeout: 20_000 });
  expect(await notReloaded(page)).toBe(true);
});

test('si el reintento también falla aparece «Recargar la página», que recarga y recupera la práctica', async ({ page }) => {
  const { restore } = await cut(page, /\/assets\/densidad-[\w-]+\.js(\?.*)?$/);
  await page.goto('/');
  await mark(page);
  await page.goto('/#/practica/densidad');
  const alerta = page.getByRole('alert').filter({ hasText: 'No se pudo cargar la práctica' });
  await alerta.getByRole('button', { name: 'Reintentar' }).click();
  const recargar = alerta.getByRole('button', { name: 'Recargar la página' });
  await expect(recargar).toBeVisible({ timeout: 20_000 });
  for (const w of [1280, 390]) { await page.setViewportSize({ width: w, height: 800 }); await shots(page, 'reintento-recargar'); }
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await axeBoth(page, 'práctica tras un reintento fallido')).toEqual([]);
  restore();
  await recargar.click();
  await expect(page.getByRole('heading', { level: 1, name: /densidad/i })).toBeVisible({ timeout: 20_000 });
  expect(await notReloaded(page)).toBe(false);
});

test.describe('vista 3D (WebGL por software)', () => {
  async function openWater(page: Page) {
    await page.goto('/');
    await mark(page);
    await page.goto('/#/practica/agua');
    await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
    await page.getByRole('tab', { name: /Experimento/ }).click();
    const card = page.locator('section.lote3d');
    await expect(card).toHaveCount(1, { timeout: 20_000 });
    await card.getByRole('button', { name: 'Abrir la vista 3D' }).click();
    return card;
  }

  test('la tarjeta «Vista 3D» sin red: «Reintentar» descarga la vista sin recargar', async ({ page }) => {
    const { pedidos, restore } = await cut(page, /\/assets\/AguaView3D-[\w-]+\.js(\?.*)?$/);
    const card = await openWater(page);
    const alerta = card.getByRole('alert').filter({ hasText: 'No se pudo descargar esta sección' });
    await expect(alerta).toBeVisible({ timeout: 20_000 });
    await card.scrollIntoViewIfNeeded();
    expect(await axeBoth(page, 'vista 3D sin red')).toEqual([]);
    for (const w of [1280, 390]) { await page.setViewportSize({ width: w, height: 800 }); await card.scrollIntoViewIfNeeded(); await shots(page, 'reintento-vista3d'); }
    await page.setViewportSize({ width: 1280, height: 800 });
    restore();
    await alerta.getByRole('button', { name: 'Reintentar' }).click();
    await waitEngine(page, 'agu3d', 'disponible');
    expect(await notReloaded(page)).toBe(true);
    expect(pedidos.at(-1)).toMatch(/\?reintento=1$/);
  });

  test('el motor 3D sin red: «Reintentar la vista 3D» pasa del respaldo SVG a WebGL sin recargar', async ({ page }) => {
    const { pedidos, restore } = await cut(page, /\/assets\/renderer-[\w-]+\.js(\?.*)?$/);
    await openWater(page);
    const fig = figureOf(page, 'agu3d');
    await expect(fig).toHaveAttribute('data-engine', 'no-disponible', { timeout: 20_000 });
    await expect(fig.getByText('no se pudo cargar el motor 3D')).toBeVisible();
    restore();
    await fig.getByRole('button', { name: 'Reintentar la vista 3D' }).click();
    await waitEngine(page, 'agu3d', 'disponible');
    expect(await notReloaded(page)).toBe(true);
    expect(pedidos.at(-1)).toMatch(/\?reintento=1$/);
  });
});

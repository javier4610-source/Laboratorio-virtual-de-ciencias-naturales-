import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

const SHOTS = process.env.ECP_SHOTS ?? '';

async function openFree(page: Page) {
  await page.goto('/#/practica/cinetica-potencial');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}
const ro = (page: Page, text: string) => page.locator('.readout').getByText(text, { exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('cinetica-potencial: Ec del carrito, caso de referencia 1 kg desde 10 m (98,1 J, 14,0 m/s) y resorte', async ({ page }) => {
  await openFree(page);
  const save1 = page.getByRole('button', { name: 'Guardar lanzamiento en la tabla' });
  await expect(save1).toBeDisabled();
  await page.getByRole('button', { name: 'Lanzar el carrito' }).click();
  await expect(ro(page, '100,00 ms')).toBeVisible({ timeout: 10_000 });
  await expect(ro(page, '0,500 m/s')).toBeVisible();
  await expect(ro(page, '0,0625 J')).toBeVisible();
  await save1.click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();

  await page.getByRole('button', { name: '2 · Gravitatoria' }).click();
  const h = page.getByLabel('Altura sobre la fotopuerta (valor exacto en m)');
  await h.fill('10');
  await h.press('Enter');
  await expect(ro(page, '10,000 m')).toBeVisible();
  await expect(ro(page, '98,1 J')).toBeVisible();
  await expect(ro(page, '14,007 m/s')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Soltar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Subir con el torno' }).click();
  await expect(ro(page, '9,81 N')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Soltar', exact: true })).toBeEnabled({ timeout: 10_000 });
  await expect(ro(page, '98,1 J')).toHaveCount(2); // F·h y m·g·h
  await page.getByRole('button', { name: 'Soltar', exact: true }).click();
  await expect(ro(page, '3,57 ms')).toBeVisible({ timeout: 10_000 });
  await expect(ro(page, '14,0 m/s')).toBeVisible();
  await expect(ro(page, '98,1 J')).toHaveCount(3); // F·h, m·g·h y ½·m·v²
  await page.getByRole('button', { name: 'Guardar caída en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/e2e-torre.png` });

  await page.getByRole('button', { name: '3 · Elástica' }).click();
  await expect(ro(page, '2,50 N')).toBeVisible();
  await page.getByRole('button', { name: 'Soltar el pestillo' }).click();
  await expect(ro(page, '100,00 ms')).toBeVisible({ timeout: 10_000 });
  await expect(ro(page, '0,0625 J')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar disparo en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
});

test('cinetica-potencial: ideas erróneas con retroalimentación y manipulación con teclado', async ({ page }) => {
  await openFree(page);
  await page.getByRole('group', { name: /Si la rapidez se duplica/ }).getByRole('button', { name: 'Es cierto' }).click();
  await expect(page.getByText(/Revisa: la idea es falsa\./)).toBeVisible();
  await expect(page.getByText(/cuatro veces más/)).toBeVisible();
  const knob = page.getByRole('slider', { name: 'Perilla del lanzador: rapidez de salida' });
  await knob.focus();
  await knob.press('ArrowUp');
  await expect(page.getByLabel('Rapidez del lanzador (valor exacto en m/s)')).toHaveValue('0,55');
  const pesas = page.getByRole('slider', { name: /Pesas de 100 g sobre el carrito \(arrastra/ });
  await pesas.focus();
  await pesas.press('ArrowUp');
  await expect(pesas).toHaveAttribute('aria-valuetext', '4 pesas: 600 g');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`cinetica-potencial: axe WCAG 2.2 AA y capturas (${scheme})`, async ({ page }) => {
    test.setTimeout(400_000);
    await page.emulateMedia({ colorScheme: scheme });
    await openFree(page);
    const found: string[] = [];
    for (const st of ['1 · Cinética', '2 · Gravitatoria', '3 · Elástica']) {
      await page.getByRole('button', { name: st }).click();
      await page.waitForTimeout(300);
      const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      found.push(...r.violations.map((v) => `${st} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
    }
    await page.getByRole('tab', { name: /Evaluación/ }).click();
    const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    found.push(...r.violations.map((v) => `evaluación · ${v.id}: ${v.help}`));
    expect(found, found.join('\n')).toEqual([]);
    if (!SHOTS) return;
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openFree(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `desbordamiento horizontal a ${width} px`).toBeLessThanOrEqual(0);
      await page.getByRole('button', { name: '1 · Cinética' }).click();
      await page.getByRole('button', { name: 'Lanzar el carrito' }).click();
      await page.waitForTimeout(2500);
      await page.screenshot({ fullPage: true, path: `${SHOTS}/cinetica-${scheme}-${width}.png` });
      await page.getByRole('button', { name: '2 · Gravitatoria' }).click();
      const h = page.getByLabel('Altura sobre la fotopuerta (valor exacto en m)');
      await h.fill('10'); await h.press('Enter');
      await page.getByRole('button', { name: 'Subir con el torno' }).click();
      await page.getByRole('button', { name: 'Soltar', exact: true }).click({ timeout: 10_000 });
      await page.waitForTimeout(800); // a mitad de la caída
      await page.locator('.bench').screenshot({ path: `${SHOTS}/gravitatoria-caida-${scheme}-${width}.png` });
      await expect(ro(page, '3,57 ms')).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ fullPage: true, path: `${SHOTS}/gravitatoria-${scheme}-${width}.png` });
      const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow2).toBeLessThanOrEqual(0);
      await page.getByRole('button', { name: '3 · Elástica' }).click();
      await page.getByRole('button', { name: 'Soltar el pestillo' }).click();
      await page.waitForTimeout(3800);
      await page.screenshot({ fullPage: true, path: `${SHOTS}/elastica-${scheme}-${width}.png` });
    }
  });
}

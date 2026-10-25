import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

const SHOTS = process.env.QF_SHOTS ?? '';

async function openFree(page: Page) {
  await page.goto('/#/practica/grupos-nitrogenados');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}
const ro = (page: Page, text: string) => page.locator('.readout').getByText(text, { exact: true });
const STATIONS = ['1 · Clasificar', '2 · Nombrar', '3 · Basicidad', '4 · Amida plana', '5 · Propiedades', '6 · Biomoléculas'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('grupos-nitrogenados: clasificación, nombre, basicidad, amida plana y biomoléculas', async ({ page }) => {
  await openFree(page);
  await expect(ro(page, 'amina secundaria (2.ª)')).toBeVisible();
  await page.getByLabel('Compuesto nitrogenado').selectOption({ label: 'N,N-Dimetilmetanamina (trimetilamina)' });
  await expect(ro(page, 'amina terciaria (3.ª)')).toBeVisible();

  await page.getByRole('button', { name: '2 · Nombrar' }).click();
  await page.getByLabel('Compuesto de ejemplo').selectOption({ label: 'N-(4-Hidroxifenil)acetamida (paracetamol)' });
  await expect(page.getByRole('heading', { name: 'N-(4-hidroxifenil)acetamida', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '3 · Basicidad' }).click();
  await expect(ro(page, '10,660')).toBeVisible();
  await expect(ro(page, '11,82')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar el cálculo en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByLabel('Base', { exact: true }).selectOption({ label: 'anilina' });
  await expect(ro(page, '8,80')).toBeVisible();

  await page.getByRole('button', { name: '4 · Amida plana' }).click();
  await expect(ro(page, '1,375 Å')).toBeVisible();
  await expect(ro(page, '360,0°')).toBeVisible();
  await expect(ro(page, '1,431 Å')).toBeVisible();
  await expect(ro(page, '326,0°')).toBeVisible();

  await page.getByRole('button', { name: '6 · Biomoléculas' }).click();
  await expect(ro(page, '6,02')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir la reacción' })).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`grupos-nitrogenados: axe WCAG 2.2 AA, sin desbordamiento y capturas (${scheme})`, async ({ page }) => {
    test.setTimeout(400_000);
    await page.emulateMedia({ colorScheme: scheme });
    await openFree(page);
    const found: string[] = [];
    for (const st of STATIONS) {
      await page.getByRole('button', { name: st }).click();
      await page.waitForTimeout(600);
      const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      found.push(...r.violations.map((v) => `${st} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
    }
    expect(found, found.join('\n')).toEqual([]);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openFree(page);
      for (const [k, st] of STATIONS.entries()) {
        await page.getByRole('button', { name: st }).click();
        await page.waitForTimeout(st.startsWith('1') ? 2500 : 900);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desbordamiento horizontal a ${width} px en ${st}`).toBeLessThanOrEqual(0);
        if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/gnt-${k + 1}-${scheme}-${width}.png` });
      }
    }
  });
}

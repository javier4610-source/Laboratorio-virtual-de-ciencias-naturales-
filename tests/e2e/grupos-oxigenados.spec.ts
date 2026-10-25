import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

const SHOTS = process.env.QF_SHOTS ?? '';

async function openFree(page: Page) {
  await page.goto('/#/practica/grupos-oxigenados');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}
const ro = (page: Page, text: string) => page.locator('.readout').getByText(text, { exact: true });
const STATIONS = ['1 · Identificar', '2 · Nombrar', '3 · Propiedades', '4 · Acidez', '5 · Pruebas de laboratorio'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('grupos-oxigenados: clasificación, nombre IUPAC, Tₑb citada, pH del ácido acético y pruebas', async ({ page }) => {
  await openFree(page);
  await expect(ro(page, 'primario (1.º)')).toBeVisible();
  await page.getByLabel('Compuesto', { exact: true }).selectOption({ label: '2-Metilpropan-2-ol (terc-butanol)' });
  await expect(ro(page, 'terciario (3.º)')).toBeVisible();

  await page.getByRole('button', { name: '2 · Nombrar' }).click();
  await page.getByLabel('Compuesto de ejemplo').selectOption({ label: 'Ácido 2-hidroxipropanoico (láctico)' });
  await expect(page.getByRole('heading', { name: 'ácido 2-hidroxipropanoico', exact: true })).toBeVisible();
  const smi = page.getByLabel('O escribe un SMILES');
  await smi.fill('CC(C)CC(C)O');
  await smi.press('Enter');
  await expect(page.getByRole('heading', { name: '4-metilpentan-2-ol', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '3 · Propiedades' }).click();
  await expect(ro(page, '97,2 °C')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar el compuesto en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();

  await page.getByRole('button', { name: '4 · Acidez' }).click();
  await expect(ro(page, '2,88')).toBeVisible();
  await expect(ro(page, '99,43 %')).toBeVisible();

  await page.getByRole('button', { name: '5 · Pruebas de laboratorio' }).click();
  await page.getByRole('button', { name: 'Agregar el reactivo' }).click();
  await expect(page.getByText('Prueba positiva.')).toBeVisible();
  await page.getByLabel('Sustancia del tubo').selectOption({ label: 'benzaldehído' });
  await page.getByLabel('Prueba', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Agregar el reactivo' }).click();
  await expect(page.getByText('Prueba negativa.')).toBeVisible();
});

test('grupos-oxigenados: ideas erróneas con retroalimentación', async ({ page }) => {
  await openFree(page);
  await page.getByRole('group', { name: /pesa más/ }).getByRole('button', { name: 'Es cierto' }).click();
  await expect(page.getByText(/La idea es falsa\. El butano/)).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`grupos-oxigenados: axe WCAG 2.2 AA, sin desbordamiento y capturas (${scheme})`, async ({ page }) => {
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
        if (st.startsWith('5')) await page.getByRole('button', { name: 'Agregar el reactivo' }).click();
        await page.waitForTimeout(st.startsWith('1') ? 2500 : 900);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desbordamiento horizontal a ${width} px en ${st}`).toBeLessThanOrEqual(0);
        if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/gox-${k + 1}-${scheme}-${width}.png` });
      }
    }
  });
}

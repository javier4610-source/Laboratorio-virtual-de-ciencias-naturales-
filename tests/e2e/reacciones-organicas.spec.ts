import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

const SHOTS = process.env.QF_SHOTS ?? '';

async function openFree(page: Page) {
  await page.goto('/#/practica/reacciones-organicas');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}
const ro = (page: Page, text: string) => page.locator('.readout').getByText(text, { exact: true });
const STATIONS = ['1 · Reacciones en 3D', '2 · Esterificación', '3 · Markovnikov', '4 · Oxidación de alcoholes'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('reacciones-organicas: ecuación, conservación de átomos, estequiometría, Hess, equilibrio, Markovnikov y oxidación', async ({ page }) => {
  await openFree(page);
  await expect(ro(page, 'CH₄ + 2 O₂ → CO₂ + 2 H₂O')).toBeVisible();
  await expect(page.getByText(/ΔrH° = [−-]890,8 kJ/).first()).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Paso siguiente' }).click();
  await expect(page.getByText('Sí: los átomos solo se reorganizan')).toBeVisible();
  await expect(ro(page, '44,01 g')).toHaveCount(2); // masa teórica y real (100 %)
  await page.getByRole('button', { name: 'Guardar la estequiometría en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByLabel('Reacción', { exact: true }).selectOption({ label: 'Fermentación alcohólica de la glucosa' });
  await expect(ro(page, 'C₆H₁₂O₆ → 2 C₂H₆O + 2 CO₂')).toBeVisible();
  await expect(page.getByText(/Sin información disponible: PubChem/)).toBeVisible();

  await page.getByRole('button', { name: '2 · Esterificación' }).click();
  await expect(ro(page, '66,7 %')).toBeVisible();
  const et = page.getByLabel('Etanol inicial (valor exacto en mol)');
  await et.fill('3'); await et.press('Enter');
  await expect(ro(page, '90,3 %')).toBeVisible();

  await page.getByRole('button', { name: '3 · Markovnikov' }).click();
  await expect(page.locator('p').filter({ hasText: 'Producto principal: 2-bromopropano' })).toBeVisible();
  await page.getByLabel('Con peróxidos (solo HBr)').check();
  await expect(page.locator('p').filter({ hasText: 'Producto principal: 1-bromopropano' })).toBeVisible();

  await page.getByRole('button', { name: '4 · Oxidación de alcoholes' }).click();
  await page.getByLabel('Alcohol', { exact: true }).selectOption({ label: '2-Metilpropan-2-ol (terc-butanol)' });
  await page.getByRole('button', { name: 'Agregar el dicromato y calentar' }).click();
  await expect(page.getByText('No se oxida.')).toBeVisible();
});

test('reacciones-organicas: visor 3D con WebGL (3Dmol.js) disponible', async ({ page }) => {
  await openFree(page);
  await expect(page.locator('.chem3d canvas').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Vista de respaldo:/)).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`reacciones-organicas: axe WCAG 2.2 AA, sin desbordamiento y capturas (${scheme})`, async ({ page }) => {
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
        if (st.startsWith('1')) { await page.getByRole('button', { name: 'Paso siguiente' }).click(); await page.getByRole('button', { name: 'Paso siguiente' }).click(); }
        await page.waitForTimeout(st.startsWith('1') ? 2500 : 900);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desbordamiento horizontal a ${width} px en ${st}`).toBeLessThanOrEqual(0);
        if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/rxo-${k + 1}-${scheme}-${width}.png` });
      }
    }
  });
}

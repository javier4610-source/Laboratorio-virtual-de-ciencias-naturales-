import { expect, test } from '@playwright/test';
import { axe, noOverflow, openFree, ro } from './organica-comun';

const SHOTS = process.env.ORG_SHOTS ?? '';
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.evaluate(() => localStorage.clear()); });

test('aromáticos: longitudes del benceno, Hückel, orto/meta/para y mecanismo', async ({ page }) => {
  await openFree(page, 'aromaticos');
  await expect(ro(page, 'C–C del benceno (6 enlaces)')).toContainText('1,395 Å');
  await expect(ro(page, 'C–C sencillo del ciclohexano')).toContainText('1,526 Å');
  await expect(ro(page, 'C=C del ciclohexeno')).toContainText('1,340 Å');
  await page.getByRole('button', { name: 'Guardar las longitudes en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();

  await page.getByRole('button', { name: '2 · Regla de Hückel' }).click();
  await expect(ro(page, 'Electrones π')).toContainText('6');
  await expect(ro(page, 'Veredicto')).toContainText('aromático');
  await page.getByLabel('Anillo', { exact: true }).selectOption('ciclooctatetraeno');
  await expect(ro(page, 'Electrones π')).toContainText('8');
  await expect(ro(page, 'Veredicto')).toHaveText(/no aromático/);
  await page.getByLabel('Anillo', { exact: true }).selectOption('tropilio');
  await expect(page.getByText(/El conteo de electrones \(4n \+ 2\) predice «aromático»/)).toBeVisible();

  await page.getByRole('button', { name: '3 · Derivados y nombres' }).click();
  await expect(page.locator('strong', { hasText: /^1,4-dimetilbenceno$/ })).toBeVisible();
  await expect(ro(page, 'Relación')).toContainText('para');
  await page.getByRole('button', { name: '2 (orto)' }).click();
  await expect(page.locator('strong', { hasText: /^1,2-dimetilbenceno$/ })).toBeVisible();

  await page.getByRole('button', { name: '4 · Sustitución electrofílica' }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await expect(page.getByText(/complejo σ/).first()).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`aromáticos: axe WCAG 2.2 AA y capturas (${scheme})`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ colorScheme: scheme });
    await openFree(page, 'aromaticos');
    const found: string[] = [];
    for (const st of ['1 · Benceno y resonancia', '2 · Regla de Hückel', '3 · Derivados y nombres', '4 · Sustitución electrofílica']) {
      await page.getByRole('button', { name: st }).click();
      await page.waitForTimeout(1200);
      found.push(...await axe(page, st));
    }
    expect(found, found.join('\n')).toEqual([]);
    if (!SHOTS) return;
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openFree(page, 'aromaticos');
      for (const [st, f] of [['1 · Benceno y resonancia', 'benceno'], ['2 · Regla de Hückel', 'huckel'], ['3 · Derivados y nombres', 'derivados'], ['4 · Sustitución electrofílica', 'sustitucion']] as const) {
        await page.getByRole('button', { name: st }).click();
        await page.waitForTimeout(2500);
        await noOverflow(page, width);
        await page.screenshot({ fullPage: true, path: `${SHOTS}/aro-${f}-${scheme}-${width}.png` });
      }
    }
  });
}

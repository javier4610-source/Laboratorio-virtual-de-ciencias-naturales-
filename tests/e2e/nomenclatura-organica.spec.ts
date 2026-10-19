import { expect, test } from '@playwright/test';
import { axe, noOverflow, openFree, ro } from './organica-comun';

const SHOTS = process.env.ORG_SHOTS ?? '';
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.evaluate(() => localStorage.clear()); });

test('nomenclatura: constructor, cadena más larga, 3D incluido sin red, ejercicio inverso y comparación con PubChem', async ({ page }) => {
  await page.route(/pubchem\.ncbi\.nlm\.nih\.gov/, (r) => r.abort());
  await openFree(page, 'nomenclatura-organica');
  const name = page.locator('#nom-c-nombre');
  await expect(name).toHaveText('2-metilpentano');
  await page.getByRole('button', { name: 'Guardar el nombre en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByLabel('Sustituyente para el carbono 2').selectOption('etil');
  await page.getByRole('button', { name: 'Quitar metil (–CH₃) del carbono 2' }).click();
  await page.getByRole('button', { name: 'Agregar al carbono 2' }).click();
  await expect(name).toHaveText('3-metilhexano');
  await page.getByRole('button', { name: 'Ver en 3D' }).click();
  await expect(page.getByRole('link', { name: 'CID 11507' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: '2 · Del nombre a la estructura' }).click();
  await expect(page.locator('#nom-objetivo')).toHaveText('3-metilpentano');
  await page.getByRole('button', { name: 'Comprobar mi estructura' }).click();
  await expect(page.getByText('Tu estructura se llama «pentano».')).toBeVisible();
  await page.getByLabel('Posición del constructor').selectOption('2');
  await page.getByRole('button', { name: 'Agregar al carbono 3' }).click();
  await page.getByRole('button', { name: 'Comprobar mi estructura' }).click();
  await expect(page.getByText(/Correcto: tu estructura es 3-metilpentano\./)).toBeVisible();

  await page.getByRole('button', { name: '4 · Comparación con PubChem' }).click();
  await expect(ro(page, 'idéntico')).toContainText('171 (91,9 %)', { timeout: 15_000 });
  await expect(ro(page, 'nombre retenido')).toContainText('8 (4,3 %)');
  await expect(ro(page, 'otra convención')).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`nomenclatura: axe WCAG 2.2 AA y capturas (${scheme})`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ colorScheme: scheme });
    await openFree(page, 'nomenclatura-organica');
    const found: string[] = [];
    await page.getByRole('button', { name: 'Ver en 3D' }).click();
    await page.waitForTimeout(2000);
    for (const st of ['1 · Constructor', '2 · Del nombre a la estructura', '3 · Errores frecuentes', '4 · Comparación con PubChem']) {
      await page.getByRole('button', { name: st }).click();
      await page.waitForTimeout(1200);
      found.push(...await axe(page, st));
    }
    expect(found, found.join('\n')).toEqual([]);
    if (!SHOTS) return;
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openFree(page, 'nomenclatura-organica');
      await page.getByRole('button', { name: '1 · Constructor' }).click();
      await page.getByRole('button', { name: 'Ver en 3D' }).click();
      await page.waitForTimeout(2500);
      for (const [st, f] of [['1 · Constructor', 'constructor'], ['2 · Del nombre a la estructura', 'ejercicio'], ['3 · Errores frecuentes', 'errores'], ['4 · Comparación con PubChem', 'validacion']] as const) {
        await page.getByRole('button', { name: st }).click();
        await page.waitForTimeout(1500);
        await noOverflow(page, width);
        await page.screenshot({ fullPage: true, path: `${SHOTS}/nom-${f}-${scheme}-${width}.png` });
      }
    }
  });
}

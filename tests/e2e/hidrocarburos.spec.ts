import { expect, test } from '@playwright/test';
import { axe, noOverflow, openFree, ro } from './organica-comun';

const SHOTS = process.env.ORG_SHOTS ?? '';
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.evaluate(() => localStorage.clear()); });

test('hidrocarburos: datos experimentales del metano, combustión balanceada, halogenación, pruebas y conformaciones', async ({ page }) => {
  await openFree(page, 'hidrocarburos');
  await expect(ro(page, 'Fórmula molecular')).toContainText('CH₄');
  await expect(ro(page, 'Tₑb (experimental)')).toContainText('-161,5 °C');
  await expect(ro(page, 'T de fusión (experimental)')).toContainText('-182,6 °C');
  await expect(ro(page, 'Estado a 25 °C y 1 atm')).toContainText('gas');
  await expect(ro(page, 'Densidad del líquido (20–25 °C)')).toContainText('No comparable');
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();

  await page.getByRole('button', { name: '5 · Combustión' }).click();
  await expect(ro(page, 'Energía liberada (−ΔcH°)')).toContainText('890,8 kJ/mol');
  await expect(ro(page, 'Energía por gramo')).toContainText('55,5 kJ/g');
  await expect(ro(page, 'CO₂ emitido por energía')).toContainText('49,4 g CO₂/MJ');
  await page.getByLabel('Combustible').selectOption('propano');
  await page.getByRole('button', { name: 'Poca (CO)' }).click();
  await expect(page.getByText('2 C₃H₈ + 7 O₂ → 6 CO + 8 H₂O')).toBeVisible();

  await page.getByRole('button', { name: '6 · Reacciones' }).click();
  const row = page.getByRole('row').filter({ hasText: '1-cloropropano' });
  await expect(row).toContainText('75,0 %');
  await page.getByRole('button', { name: 'Agregar 5 gotas del reactivo' }).click();
  await expect(page.getByText('Prueba positiva.')).toBeVisible();
  await page.getByLabel('Sustancia del tubo').selectOption('hexano');
  await page.getByRole('button', { name: 'Agregar 5 gotas del reactivo' }).click();
  await expect(page.getByText('Prueba negativa.')).toBeVisible();

  await page.getByRole('button', { name: '4 · Conformaciones' }).click();
  await page.getByRole('button', { name: 'Eclipsada', exact: true }).click();
  await expect(ro(page, 'Conformación')).toContainText('eclipsada');
  await page.getByRole('button', { name: 'Alternada', exact: true }).click();
  await expect(ro(page, 'Conformación')).toContainText('alternada');
});

test('hidrocarburos: el visor 3D tiene respaldo SVG sin 3Dmol', async ({ page }) => {
  await page.route('**/*', (r) => (/3dmol/i.test(r.request().url()) ? r.abort() : r.continue()));
  await openFree(page, 'hidrocarburos');
  await page.getByRole('button', { name: '4 · Conformaciones' }).click();
  await expect(page.getByText(/vista de respaldo en SVG/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: /Modelo 3D del etano/ })).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`hidrocarburos: axe WCAG 2.2 AA en las 6 estaciones y capturas (${scheme})`, async ({ page }) => {
    test.setTimeout(400_000);
    await page.emulateMedia({ colorScheme: scheme });
    await openFree(page, 'hidrocarburos');
    const found: string[] = [];
    for (const st of ['1 · Series homólogas', '2 · Hibridación', '3 · Isomería', '4 · Conformaciones', '5 · Combustión', '6 · Reacciones']) {
      await page.getByRole('button', { name: st }).click();
      await page.waitForTimeout(1200);
      found.push(...await axe(page, st));
    }
    expect(found, found.join('\n')).toEqual([]);
    if (!SHOTS) return;
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openFree(page, 'hidrocarburos');
      for (const [st, f] of [['1 · Series homólogas', 'series'], ['2 · Hibridación', 'hibridacion'], ['3 · Isomería', 'isomeria'], ['4 · Conformaciones', 'conformaciones'], ['5 · Combustión', 'combustion'], ['6 · Reacciones', 'reacciones']] as const) {
        await page.getByRole('button', { name: st }).click();
        await page.waitForTimeout(2500);
        await noOverflow(page, width);
        await page.screenshot({ fullPage: true, path: `${SHOTS}/hcb-${f}-${scheme}-${width}.png` });
      }
    }
  });
}

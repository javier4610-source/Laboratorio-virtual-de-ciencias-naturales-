import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/** Prácticas de química inorgánica (10.º): óxidos e hidróxidos, ácidos y sales, y nomenclatura. */
const SHOTS = process.env.QI_SHOTS ?? '';

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}
const ro = (page: Page, text: string) => page.locator('.readout').getByText(text, { exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('oxidos-hidroxidos: combustión del magnesio (0,83 g), pH 10,35 con indicadores, nombres y azufre ácido', async ({ page }) => {
  await openFree(page, 'oxidos-hidroxidos');
  await expect(page.getByRole('button', { name: 'Añadir agua y medir el pH' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Guardar ensayo en la tabla' })).toBeDisabled();
  await page.getByRole('button', { name: 'Quemar en el aire' }).click();
  await expect(ro(page, '0,83 g')).toBeVisible({ timeout: 10_000 });
  await expect(ro(page, 'MgO')).toBeVisible();
  await expect(page.getByText('2 Mg + O₂ → 2 MgO', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Añadir agua y medir el pH' }).click();
  await expect(ro(page, '10,35')).toBeVisible();
  await expect(ro(page, 'básico')).toBeVisible();
  await expect(ro(page, 'Mg(OH)₂')).toBeVisible();
  for (const t of ['fucsia', 'papel azul', 'azul']) await expect(ro(page, t)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'dihidróxido de magnesio' })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();

  await page.getByLabel('Reactivo', { exact: true }).selectOption('s');
  await page.getByRole('button', { name: 'Quemar en el aire' }).click();
  await expect(ro(page, 'SO₂')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Añadir agua y medir el pH' }).click();
  await expect(ro(page, 'ácido')).toBeVisible();
  await expect(ro(page, 'H₂SO₃')).toBeVisible();
  await expect(ro(page, 'papel rojo')).toBeVisible();
  // Reacción en 3D: rótulo obligatorio y conteo conservado.
  await expect(page.getByText(/interpolación entre geometrías calculadas de reactivos y productos/).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Conteo de átomos de la reacción' })).toBeVisible();
});

test('oxidos-hidroxidos: sin 3Dmol la reacción 3D usa la vista de respaldo y avanza por pasos', async ({ page }) => {
  await page.route('**/*', (r) => (/3dmol/i.test(r.request().url()) ? r.abort() : r.continue()));
  await openFree(page, 'oxidos-hidroxidos');
  await expect(page.getByText('Vista de respaldo:').first()).toBeVisible({ timeout: 15_000 });
  const svg = page.getByRole('img', { name: /vista de respaldo con las mismas posiciones/ });
  await expect(svg).toBeVisible();
  const before = await svg.screenshot();
  await page.getByRole('button', { name: 'Paso siguiente' }).click();
  await page.getByRole('button', { name: 'Paso siguiente' }).click();
  await expect(page.getByRole('slider', { name: 'Avance de la reacción' })).toHaveValue('50');
  expect(Buffer.compare(before, await svg.screenshot())).not.toBe(0);
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('acidos-sales: HCl 0,010 M pH 2,00; titulación en la equivalencia pH 7,00; NaHCO₃ sal ácida con disolución básica', async ({ page }) => {
  await openFree(page, 'acidos-sales');
  await page.getByRole('button', { name: 'Disolver y medir el pH' }).click();
  await expect(ro(page, '2,00')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'cloruro de hidrógeno' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ácido clorhídrico' })).toBeVisible();

  await page.getByRole('button', { name: '2 · Neutralización' }).click();
  await expect(page.getByRole('button', { name: 'Guardar ensayo en la tabla' })).toBeDisabled();
  const vb = page.getByLabel('Volumen de NaOH añadido (valor exacto en mL)');
  await vb.fill('25');
  await vb.press('Enter');
  await page.getByRole('button', { name: 'Medir el pH' }).click();
  await expect(ro(page, '7,00')).toBeVisible();
  await expect(ro(page, 'punto de equivalencia')).toBeVisible();
  await expect(ro(page, 'NaCl · cloruro de sodio')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();

  await page.getByRole('button', { name: '3 · Sales' }).click();
  await page.getByLabel('Sal', { exact: true }).selectOption('nahco3');
  await page.getByRole('button', { name: 'Disolver y medir el pH' }).click();
  await expect(ro(page, '8,34')).toBeVisible();
  await expect(ro(page, 'básica')).toBeVisible();
  await expect(ro(page, 'sal ácida (conserva H del ácido)')).toBeVisible();
  await expect(page.getByText('2,820 Å').first()).toBeVisible();
});

test('nomenclatura-inorganica: Fe₂O₃ y FeO con tres nombres; retos con retroalimentación y aciertos', async ({ page }) => {
  await openFree(page, 'nomenclatura-inorganica');
  await expect(page.getByRole('button', { name: 'hierro (Fe), metal' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Guardar el compuesto en la tabla' })).toBeDisabled();
  await page.getByRole('button', { name: 'Formar el compuesto' }).click();
  for (const t of ['Fe₂O₃', 'trióxido de dihierro', 'óxido de hierro(III)', 'óxido férrico']) await expect(ro(page, t)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar el compuesto en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByRole('button', { name: '+2 (II)' }).click();
  await page.getByRole('button', { name: 'Formar el compuesto' }).click();
  for (const t of ['FeO', 'monóxido de hierro', 'óxido de hierro(II)', 'óxido ferroso']) await expect(ro(page, t)).toBeVisible();

  await expect(page.getByText('Escribe el nombre en la nomenclatura tradicional de Fe₂O₃')).toBeVisible();
  await page.getByLabel('Tu respuesta', { exact: true }).fill('oxido ferrico');
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByText('Correcto, pero revisa las tildes: se escribe «óxido férrico».')).toBeVisible();
  await expect(page.getByText(/Aciertos: 1 de 1 respondidos/)).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente reto' }).click();
  await expect(page.getByText('Escribe la fórmula de «hidrogeno(dioxidonitrato)»')).toBeVisible();
  await page.getByLabel('Tu respuesta', { exact: true }).fill('HNO3');
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByText(/El número de átomos no cuadra/)).toBeVisible();
});

const FLOWS: Record<string, (page: Page) => Promise<void>> = {
  'oxidos-hidroxidos': async (page) => {
    await page.getByRole('button', { name: 'Quemar en el aire' }).click();
    await expect(ro(page, '0,83 g')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Añadir agua y medir el pH' }).click();
    await expect(ro(page, '10,35')).toBeVisible();
  },
  'acidos-sales': async (page) => {
    await page.getByRole('button', { name: '2 · Neutralización' }).click();
    for (const v of ['0', '10', '20', '24', '25', '26', '30', '40']) {
      const vb = page.getByLabel('Volumen de NaOH añadido (valor exacto en mL)');
      await vb.fill(v); await vb.press('Enter');
      await page.getByRole('button', { name: 'Medir el pH' }).click();
    }
    await page.getByLabel('Mostrar la curva del modelo y los puntos de equivalencia').check();
  },
  'nomenclatura-inorganica': async (page) => {
    await page.getByRole('button', { name: 'Formar el compuesto' }).click();
    await expect(ro(page, 'Fe₂O₃')).toBeVisible();
  },
};

for (const id of Object.keys(FLOWS)) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${id}: axe WCAG 2.2 AA y capturas (${scheme})`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: scheme });
      await openFree(page, id);
      await FLOWS[id](page);
      await page.waitForTimeout(1500);
      const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      await page.getByRole('tab', { name: /Evaluación/ }).click();
      const r2 = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(r2.violations.map((v) => `evaluación · ${v.id}: ${v.help}`)).toEqual([]);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await openFree(page, id);
        await FLOWS[id](page);
        await page.waitForTimeout(2500);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desbordamiento horizontal a ${width} px`).toBeLessThanOrEqual(0);
        if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/${id}-${scheme}-${width}.png` });
      }
    });
  }
}

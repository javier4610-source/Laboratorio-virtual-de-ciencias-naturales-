import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/**
 * Pista de control de variables al guardar un ensayo: aparece si cambian dos variables de entrada a la vez respecto al
 * ensayo anterior, no aparece si cambia una sola, no bloquea el registro, no se repite para la misma combinación y se
 * cierra con «Entendido». Se comprueba en densidad, en claro y oscuro, con axe WCAG 2.2 AA y sin desbordamiento a 390 px.
 * Con CONTROL_SHOTS=<carpeta> guarda capturas claro/oscuro a 1280 y 390 px.
 */

const SHOTS = process.env.CONTROL_SHOTS ?? '';

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

async function setSlider(page: Page, label: string, unit: string, value: string) {
  const box = page.getByLabel(`${label} (valor exacto en ${unit})`, { exact: true });
  await box.fill(value);
  await box.press('Enter');
}

/** Mide la muestra elegida y guarda el ensayo. */
async function measureAndSave(page: Page, material: string, side: string) {
  await page.getByLabel('Material', { exact: true }).selectOption(material);
  await setSlider(page, 'Arista del cubo', 'cm', side);
  await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
  await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
}

const rows = (page: Page) => page.locator('#cuaderno table').first().locator('tbody tr');

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`pista de control de variables (tema ${scheme === 'light' ? 'claro' : 'oscuro'})`, () => {
    test.use({ colorScheme: scheme });

    test('densidad: pista al cambiar dos variables, nada al cambiar una; no bloquea ni se repite; axe y 390 px', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.setViewportSize({ width: 1280, height: 900 });
      await openFree(page, 'densidad');
      const hint = page.locator('.control-hint');

      // Primer ensayo: nunca hay pista.
      await measureAndSave(page, 'aluminio', '2');
      await expect(rows(page)).toHaveCount(1);
      await expect(hint).toHaveCount(0);

      // Cambia solo la arista: comparación justa, sin pista.
      await measureAndSave(page, 'aluminio', '3');
      await expect(rows(page)).toHaveCount(2);
      await expect(hint).toHaveCount(0);

      // Cambian la muestra y la arista a la vez: pista, y el ensayo se guarda igual.
      await measureAndSave(page, 'hierro', '2.5');
      await expect(rows(page)).toHaveCount(3);
      await expect(hint).toBeVisible();
      const note = hint.locator('.condition');
      await expect(note).toHaveAttribute('role', 'note');
      await expect(note).toContainText('cambiaste dos variables a la vez');
      await expect(note.locator('.condition-cause')).toContainText('Respecto al ensayo 2 cambiaron muestra (de «Aluminio» a «Hierro») y arista (de 3,0 cm a 2,5 cm)');
      await expect(note.locator('.condition-cause')).toContainText('prueba justa');
      await expect(note).toContainText('Sugerencia:');
      await expect(note).toContainText('El ensayo sí quedó guardado');
      // Sin regiones de estado nuevas: el anuncio va en la región del botón.
      await expect(hint.locator('[role="status"]')).toHaveCount(0);
      await expect(page.locator('.record-block [aria-live="polite"]')).toContainText('Pista: cambiaste varias variables a la vez');

      const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      const found = r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(found, found.join('\n')).toEqual([]);

      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await hint.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desbordamiento horizontal a ${width} px`).toBeLessThanOrEqual(0);
        const box = await hint.boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= width + 1, `la pista cabe a ${width} px`).toBeTruthy();
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/densidad-${scheme === 'light' ? 'claro' : 'oscuro'}-${width}.png` });
      }
      await page.setViewportSize({ width: 1280, height: 900 });

      // «Entendido» la cierra y devuelve el foco al botón de registro.
      await hint.getByRole('button', { name: 'Entendido' }).click();
      await expect(hint).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Guardar ensayo en la tabla' })).toBeFocused();

      // La misma combinación (muestra + arista) no se vuelve a señalar en esta visita.
      await measureAndSave(page, 'cobre', '4');
      await expect(rows(page)).toHaveCount(4);
      await expect(hint).toHaveCount(0);
    });
  });
}

test('gases: cambiar solo el volumen nunca muestra la pista', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openFree(page, 'gases');
  for (const v of ['100', '120', '80']) {
    await setSlider(page, 'Volumen de la jeringa', 'mL', v);
    await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  }
  await expect(page.locator('#cuaderno table').first().locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('.control-hint')).toHaveCount(0);
});

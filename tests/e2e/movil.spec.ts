import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { CATALOG } from '../../src/curriculum/catalog';
import { AXE_TAGS } from './env';

/**
 * Línea base de navegación y carga en un teléfono (Fase 1 del programa v2): cada práctica abre su laboratorio
 * en 390 × 844 px sin errores en la consola, sin desbordamiento horizontal de la página y sin fallos de axe.
 */
const ERROR_TEXT = 'Ocurrió un error inesperado en esta sección.';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('móvil: inicio y catálogo sin desbordamiento horizontal', async ({ page }) => {
  for (const route of ['/', '/#/catalogo']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(1);
  }
});

test('móvil: cada práctica carga su laboratorio sin errores', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()} · ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()} · ${m.text()}`); });
  const problems: string[] = [];
  for (const { id } of CATALOG) {
    await page.goto(`/#/practica/${id}`);
    await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
    await page.getByRole('tab', { name: /Experimento/ }).click();
    await expect(page.getByText('Cargando el laboratorio…'), id).toHaveCount(0, { timeout: 15_000 });
    if (await page.getByText(ERROR_TEXT).count()) problems.push(`${id}: el laboratorio mostró la pantalla de error`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) problems.push(`${id}: la página se desborda ${overflow} px a lo ancho`);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    for (const v of axe.violations) problems.push(`${id} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  }
  expect([...problems, ...errors], [...problems, ...errors].join('\n')).toEqual([]);
});

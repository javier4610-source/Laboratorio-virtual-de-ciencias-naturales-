import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/**
 * Banco avanzado tipo Saber 11 (#/banco/avanzado): práctica guiada, simulacro sin claves hasta terminar y refuerzo.
 *
 * Mientras no haya bloques registrados en src/assessment/avanzado/bloques.ts, las pruebas que necesitan preguntas se
 * OMITEN con un mensaje claro (la página muestra el estado vacío, que sí se audita). Para probar la interfaz con la
 * muestra de pruebas sin publicar nada, se puede correr contra el servidor de desarrollo, que acepta «?muestra=1»:
 *   npx vite --port 4394 --strictPort &   E2E_WEB_PORT=4394 E2E_BANCO_MUESTRA=1 npx playwright test banco-avanzado
 * (en la versión compilada «?muestra=1» no hace nada: la muestra no entra al paquete de producción).
 */
const QUERY = process.env.E2E_BANCO_MUESTRA === '1' ? '?muestra=1' : '';
const pageUrl = (modo?: string) => `/#/banco/avanzado${QUERY}${modo ? `${QUERY ? '&' : '?'}modo=${modo}` : ''}`;
const EMPTY_MSG = 'El banco avanzado no tiene bloques registrados todavía (src/assessment/avanzado/bloques.ts): se omite. Vuelve a correr esta prueba al incorporar el bloque A.';

/** Abre la página y dice si hay preguntas (pestañas de modalidades) o solo el estado vacío. */
async function open(page: Page, modo?: string): Promise<boolean> {
  await page.goto(pageUrl(modo));
  await expect(page.getByRole('heading', { level: 1, name: /Banco avanzado/ })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Modalidades de uso del banco' });
  const empty = page.getByTestId('banco-avanzado-vacio');
  await expect(tabs.or(empty)).toBeVisible();
  if (QUERY) await expect(tabs).toBeVisible(); // la muestra carga después del primer pintado
  return tabs.isVisible();
}

async function audit(page: Page, label: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return r.violations.map((v) => `${label} · ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Responde todas las preguntas del simulacro con la primera opción y lo termina. */
async function runSimulacro(page: Page) {
  await page.getByRole('tab', { name: /Simulacro/ }).click();
  // Diez preguntas si el banco lo permite (con 180 publicadas, «todas» haría la prueba muy lenta).
  const count = page.getByLabel('Número de preguntas');
  const values = await count.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  await count.selectOption(values.includes('10') ? '10' : 'todas');
  await page.getByRole('button', { name: /Empezar simulacro/ }).click();
  const items = page.locator('[data-simulacro-item]');
  await expect(items.first()).toBeVisible();
  return items;
}

test('el banco Saber 11 enlaza al banco avanzado, que muestra el aviso de material no oficial', async ({ page }) => {
  await page.goto('/#/banco');
  await page.getByRole('link', { name: 'Abrir el banco avanzado' }).click();
  await expect(page).toHaveURL(/#\/banco\/avanzado/);
  await expect(page.getByRole('heading', { level: 1, name: /Banco avanzado/ })).toBeVisible();
  await expect(page.getByText(/No es material oficial del ICFES/)).toBeVisible();
  await expect(page.getByText(/no está validado psicométricamente/)).toBeVisible();
  // El banco de siempre sigue funcionando.
  await page.goto('/#/banco');
  await expect(page.locator('article.question').first()).toBeVisible();
});

test('práctica guiada: responde una pregunta y muestra la retroalimentación comentada', async ({ page }) => {
  test.skip(!(await open(page)), EMPTY_MSG);
  const card = page.locator('article.adv-item').first();
  await expect(card.getByRole('button', { name: 'Comprobar respuesta' })).toBeDisabled();
  await card.locator('label.adv-option').first().click();
  await card.getByRole('button', { name: 'Comprobar respuesta' }).click();
  const fb = card.locator('.adv-feedback');
  await expect(fb).toBeVisible();
  await expect(fb).toContainText(/Respuesta (correcta|incorrecta)/);
  await expect(fb).toContainText('Por qué las otras opciones no lo son');
  await expect(fb.locator('.adv-distractors li')).toHaveCount(3);
  await expect(fb).toContainText('Error que conviene evitar');
  await expect(fb).toContainText('Estrategia');
  await card.getByRole('button', { name: 'Intentar de nuevo' }).click();
  await expect(card.locator('.adv-feedback')).toHaveCount(0);
});

test('simulacro: no muestra claves hasta terminar; luego puntaje, tabla por competencia y solucionario', async ({ page }) => {
  test.skip(!(await open(page)), EMPTY_MSG);
  const items = await runSimulacro(page);
  const n = await items.count();
  await expect(page.locator('.adv-feedback, .adv-mark, .option.correct, .option.incorrect')).toHaveCount(0);
  await expect(page.getByText('Respuesta correcta')).toHaveCount(0);
  await expect(page.getByText(/no oficial|No es el tiempo oficial/).first()).toBeVisible();
  for (let i = 0; i < n; i++) await items.nth(i).locator('label.adv-option').nth(i % 4).click();
  await expect(page.locator('.adv-feedback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Terminar simulacro y ver resultados' }).click();
  await expect(page.getByRole('heading', { name: 'Resultados del simulacro' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Aciertos por competencia y bloque' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver el solucionario' }).click();
  const sol = page.locator('details.adv-sol');
  await expect(sol).toHaveCount(n);
  // Solo el resumen propio del solucionario: el ítem puede traer además el desplegable de su gráfica.
  await sol.first().locator(':scope > summary').click();
  await expect(sol.first().locator('.adv-feedback')).toContainText('Por qué las otras opciones no lo son');
  // El refuerzo propone preguntas a partir del simulacro.
  await page.getByRole('button', { name: 'Practicar lo sugerido (refuerzo)' }).click();
  await expect(page.getByRole('tab', { name: /Refuerzo/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Sugerencia según tu último simulacro' })).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`accesibilidad (axe, tema ${scheme === 'light' ? 'claro' : 'oscuro'}) en las tres modalidades`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const found: string[] = [];
    const hasItems = await open(page);
    found.push(...(await audit(page, hasItems ? 'guiada' : 'vacío')));
    if (hasItems) {
      const card = page.locator('article.adv-item').first();
      await card.locator('label.adv-option').first().click();
      await card.getByRole('button', { name: 'Comprobar respuesta' }).click();
      await card.locator('details.adv-chart-text').evaluateAll((ds) => ds.forEach((d) => d.setAttribute('open', '')));
      found.push(...(await audit(page, 'guiada/retroalimentación')));
      const items = await runSimulacro(page);
      found.push(...(await audit(page, 'simulacro/en curso')));
      const n = await items.count();
      for (let i = 0; i < n; i++) await items.nth(i).locator('label.adv-option').first().click();
      await page.getByRole('button', { name: 'Terminar simulacro y ver resultados' }).click();
      await page.locator('details.adv-sol').evaluateAll((ds) => ds.forEach((d) => d.setAttribute('open', '')));
      found.push(...(await audit(page, 'simulacro/resultados')));
      await page.getByRole('tab', { name: /Refuerzo/ }).click();
      found.push(...(await audit(page, 'refuerzo')));
    }
    await page.goto('/#/docente?seccion=exportar');
    await expect(page.getByRole('heading', { name: 'Banco avanzado tipo Saber 11' })).toBeVisible();
    found.push(...(await audit(page, 'docente/banco avanzado')));
    expect(found, found.join('\n')).toEqual([]);
  });
}

test.describe('móvil 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('sin desbordamiento horizontal en las tres modalidades', async ({ page }) => {
    const hasItems = await open(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    if (!hasItems) return;
    const card = page.locator('article.adv-item').first();
    await card.locator('label.adv-option').first().click();
    await card.getByRole('button', { name: 'Comprobar respuesta' }).click();
    await page.locator('details.adv-chart-text').evaluateAll((ds) => ds.forEach((d) => d.setAttribute('open', '')));
    expect(await overflow(page), 'guiada').toBeLessThanOrEqual(0);
    const items = await runSimulacro(page);
    expect(await overflow(page), 'simulacro').toBeLessThanOrEqual(0);
    const n = await items.count();
    for (let i = 0; i < n; i++) await items.nth(i).locator('label.adv-option').first().click();
    await page.getByRole('button', { name: 'Terminar simulacro y ver resultados' }).click();
    await page.locator('details.adv-sol').evaluateAll((ds) => ds.forEach((d) => d.setAttribute('open', '')));
    expect(await overflow(page), 'resultados').toBeLessThanOrEqual(0);
    await page.getByRole('tab', { name: /Refuerzo/ }).click();
    expect(await overflow(page), 'refuerzo').toBeLessThanOrEqual(0);
  });
});

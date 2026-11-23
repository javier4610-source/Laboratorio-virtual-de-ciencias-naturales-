import { expect, test } from '@playwright/test';

/**
 * Banco tipo Saber 11 cargado por grado (src/assessment/banco/cargar.ts, ola 3b): la página pinta encabezado y filtros
 * y descarga las preguntas con import(); con un grado elegido basta su archivo. Ver docs/v2/RENDIMIENTO.md.
 */
const kpi = (page: import('@playwright/test').Page) => page.locator('.kpi').filter({ hasText: 'preguntas con estos filtros' }).locator('.v');

test('banco Saber: carga los seis grados y filtra por grado', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (r) => { const m = r.url().match(/\/grado(\d+)-[\w-]+\.js$/); if (m) pedidos.push(m[1]); });
  await page.goto('/#/banco');
  await expect(page.locator('article.question').first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /^Cargando/ })).toHaveCount(0);
  const origen = page.getByLabel('Origen');
  await expect(origen.locator('option').first()).toHaveText(/^Banco tipo Saber \(\d+\)$/);
  const total = Number((await origen.locator('option').first().textContent())!.match(/\((\d+)\)/)![1]);
  await expect(kpi(page)).toHaveText(String(total));
  expect([...new Set(pedidos)].sort((a, b) => +a - +b)).toEqual(['6', '7', '8', '9', '10', '11']);
  // Ordenado por grado: la primera pregunta es de 6.º.
  await page.getByLabel('Grado recomendado').selectOption('6');
  const seis = Number(await kpi(page).textContent());
  expect(seis).toBeGreaterThan(0);
  expect(seis).toBeLessThan(total);
  await page.getByLabel('Grado recomendado').selectOption('11');
  expect(Number(await kpi(page).textContent())).toBeGreaterThan(0);
  // «Todas» suma las de las prácticas (currículo completo, bajo demanda).
  await page.getByLabel('Grado recomendado').selectOption('');
  await origen.selectOption('todas');
  await expect(origen.locator('option').nth(1)).toHaveText(/\(\d+\)$/, { timeout: 20_000 });
  expect(Number(await kpi(page).textContent())).toBeGreaterThan(total);
});

test('banco Saber: cada grado llega por separado; si uno no descarga, avisa y los demás siguen disponibles', async ({ page }) => {
  const pedidos: string[] = [];
  // Sin red para todos los grados salvo 8.º. (Un import() que falló queda en la caché de módulos del navegador hasta
  // recargar la página, así que aquí no se prueba un reintento con éxito del mismo archivo.)
  await page.route(/\/grado\d+-[\w-]+\.js$/, (route) => {
    const g = route.request().url().match(/\/grado(\d+)-/)![1];
    pedidos.push(g);
    return g === '8' ? route.continue() : route.abort();
  });
  await page.goto('/#/banco');
  await expect(page.getByRole('heading', { level: 1, name: 'Banco de preguntas tipo Saber 11' })).toBeVisible();
  const alerta = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar las preguntas del banco' });
  await expect(alerta).toBeVisible();
  await expect(alerta.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  // Las de 8.º sí llegaron y se muestran; el origen no anuncia un total que aún no conoce.
  await expect(page.locator('article.question').first()).toBeVisible();
  await expect(page.getByLabel('Origen').locator('option').first()).toHaveText('Banco tipo Saber');
  await page.getByLabel('Grado recomendado').selectOption('8');
  await expect(alerta).toHaveCount(0);
  expect(Number(await kpi(page).textContent())).toBeGreaterThan(0);
  expect(pedidos.filter((g) => g === '8')).toHaveLength(1);
});

test('práctica: las preguntas de transferencia llegan con la ficha (solo el banco de su grado)', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (r) => { const m = r.url().match(/\/grado(\d+)-[\w-]+\.js$/); if (m) pedidos.push(m[1]); });
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Evaluación/ }).click();
  await expect(page.getByRole('heading', { name: 'Preguntas de transferencia tipo Saber 11' })).toBeVisible();
  await expect(page.getByText('no es una pregunta oficial del ICFES').first()).toBeVisible();
  expect([...new Set(pedidos)]).toEqual(['6']);
});

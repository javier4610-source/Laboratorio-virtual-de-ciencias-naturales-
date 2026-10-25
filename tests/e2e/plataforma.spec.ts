import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/** Rediseño 2026-10 (ADR 0007): inicio por perfiles, catálogo con filtros en la dirección, espacio de trabajo y componentes experimentales. */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return r.violations.map((v) => `${where} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function densityTrials(page: Page, sides: string[]) {
  for (const side of sides) {
    const input = page.getByLabel('Arista del cubo (valor exacto en cm)');
    await input.fill(side); await input.press('Enter');
    await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
    await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
    await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  }
}

test('inicio por perfiles: tareas del estudiante, del docente y continuar la práctica empezada', async ({ page }) => {
  await page.goto('/');
  const perfil = page.getByRole('tablist', { name: 'Perfil' });
  await expect(perfil.getByRole('tab', { name: 'Estudiante' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /Empezar por mi grado/ })).toBeVisible();
  // El inicio ya no repite el catálogo completo: una práctica por grado.
  await expect(page.locator('.pcard')).toHaveCount(6);
  await perfil.getByRole('tab', { name: 'Docente' }).click();
  await page.getByRole('link', { name: /Recibir y revisar informes/ }).click();
  await expect(page.getByRole('tab', { name: /Informes/ })).toHaveAttribute('aria-selected', 'true');
  // El perfil elegido se recuerda.
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Docente' })).toHaveAttribute('aria-selected', 'true');
  // Tras trabajar en una práctica, el estudiante la retoma desde el inicio.
  await page.getByRole('tab', { name: 'Estudiante' }).click();
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.goto('/');
  await page.getByRole('link', { name: /Continuar mi práctica/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Medición de masa, volumen y densidad');
});

test('catálogo: los filtros viajan en la dirección, se quitan uno a uno y el estado vacío ofrece salida', async ({ page }) => {
  await page.goto('/#/catalogo?area=fisica&grado=10');
  await expect(page.getByRole('combobox', { name: 'Asignatura' })).toHaveValue('fisica');
  await expect(page.getByRole('combobox', { name: 'Grado' })).toHaveValue('10');
  const n = await page.locator('.pcard:not(.planned)').count();
  expect(n).toBeGreaterThan(0);
  await page.getByLabel('Buscar').fill('péndulo');
  await expect(page).toHaveURL(/q=p%C3%A9ndulo|q=péndulo/);
  await expect(page.locator('.pcard:not(.planned)')).toHaveCount(1);
  await page.getByRole('button', { name: 'Quitar el filtro 10.º' }).click();
  await expect(page.getByRole('combobox', { name: 'Grado' })).toHaveValue('');
  await page.getByLabel('Buscar').fill('zzzz');
  await expect(page.getByText('No hay prácticas con esos filtros')).toBeVisible();
  await page.getByRole('button', { name: 'Quitar todos los filtros' }).click();
  await expect(page.locator('.pcard:not(.planned)')).toHaveCount(65);
});

test('atajos de teclado: «?» abre la lista, «/» busca y los números cambian de etapa', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.locator('h1').click();
  await page.keyboard.press('2');
  await expect(page.getByRole('tab', { name: /Experimento/ })).toHaveAttribute('aria-selected', 'true');
  await page.locator('h1').click();
  await page.keyboard.press('5');
  await expect(page.getByRole('tab', { name: /Modelo y referencias/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Atajos de teclado' });
  await expect(dialog).toBeVisible();
  expect(await axe(page, 'atajos')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  // Escribir en un campo no dispara atajos.
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/#\/catalogo/);
  await expect(page.getByLabel('Buscar')).toBeFocused();
  await page.keyboard.type('12');
  await expect(page.getByLabel('Buscar')).toHaveValue('12');
});

test('práctica: navegación entre prácticas del grado y migas con área', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  const crumbs = page.getByRole('navigation', { name: 'Ruta de navegación' });
  await expect(crumbs.getByRole('link', { name: 'Física' })).toHaveAttribute('href', '#/catalogo?area=fisica');
  const pager = page.getByRole('navigation', { name: 'Otras prácticas del grado' });
  await expect(pager).toContainText('Práctica 1 de 8');
  await pager.getByRole('link', { name: /Siguiente/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Separación de mezclas');
});

test('cuaderno: comparar dos ensayos y descargar los datos en JSON', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await densityTrials(page, ['2,0', '3,0']);
  const nb = page.locator('#cuaderno');
  await nb.getByText('Comparar ensayos').click();
  const table = nb.getByRole('table', { name: /Ensayo 1 frente al ensayo 2/ });
  await expect(table.getByRole('row', { name: /Masa/ })).toContainText('+51,3 g');
  await expect(nb.getByText(/Solo cambió arista/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), nb.getByRole('button', { name: 'Descargar JSON' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^densidad-.+\.json$/);
  expect(await axe(page, 'cuaderno con comparación')).toEqual([]);
});

test('simulación: barra de control común con estado en texto (ósmosis y ondas)', async ({ page }) => {
  await page.goto('/#/practica/osmosis');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  const sim = page.getByRole('group', { name: 'Observación al microscopio' });
  await expect(sim.getByRole('status')).toHaveText('Lista para iniciar');
  await sim.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada', { timeout: 10_000 });
  await expect(sim.getByRole('button', { name: 'Repetir' })).toBeVisible();
  await expect(sim.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await page.goto('/#/practica/ondas');
  await page.getByRole('tab', { name: /Experimento/ }).click();
  const gen = page.getByRole('group', { name: 'Generador de ondas' });
  await gen.getByRole('button', { name: 'Pausar' }).click();
  await expect(gen.getByRole('status')).toHaveText('En pausa');
  await gen.getByRole('button', { name: 'Reanudar' }).click();
  await expect(gen.getByRole('status')).toHaveText('En curso');
});

test('análisis: explicación de la relación entre variables a partir de los datos', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await densityTrials(page, ['1,5', '2,0', '2,5']);
  await page.getByRole('tab', { name: /Análisis/ }).click();
  await expect(page.locator('.relation-text')).toContainText(/cuando el volumen .* aumenta, la masa aumenta/);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(500); // las transiciones de color terminan antes de medir el contraste
    expect(await axe(page, `análisis (${scheme})`)).toEqual([]);
  }
});

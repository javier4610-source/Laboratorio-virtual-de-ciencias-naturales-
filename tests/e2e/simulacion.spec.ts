import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/**
 * Barra común de simulación (SimControls, ADR 0007) en una muestra representativa de prácticas con dinámica
 * temporal: iniciar → pausar (el tiempo se congela) → reanudar → reiniciar, con el estado dicho en texto
 * (role="status"), teclado, movimiento reducido y axe WCAG 2.2 AA en pausa.
 * Con SIMC_SHOTS=<carpeta> guarda capturas claro/oscuro a 1280 y 390 px.
 */

const SHOTS = process.env.SIMC_SHOTS ?? '';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return r.violations.map((v) => `${where} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

interface Case {
  id: string;
  /** Nombre del grupo (título de la barra). */
  group: string;
  /** Rótulo del botón de inicio (se conserva el que ya usaban las pruebas). */
  start: string;
  /** Lectura que debe quedar congelada durante la pausa (además del estado). */
  frozen?: (page: Page, sim: Locator) => Locator;
}

const progress = (_page: Page, sim: Locator) => sim.getByRole('progressbar');

const CASES: Case[] = [
  { id: 'conduccion', group: 'Calentamiento de la varilla', start: 'Encender y medir', frozen: progress },
  { id: 'calor', group: 'Calorímetro', start: 'Mezclar y medir', frozen: progress },
  { id: 'cinetica', group: 'Reacción y cronómetro', start: 'Iniciar reacción y cronómetro', frozen: progress },
  { id: 'cinematica', group: 'Recorrido del ciclista', start: 'Iniciar recorrido',
    frozen: (page) => page.locator('.readout .item').filter({ hasText: 'Tiempo (cronómetro)' }).locator('.v') },
  { id: 'pendulo', group: 'Péndulo', start: 'Soltar el péndulo' },
  { id: 'ecosistema', group: 'Acuario', start: 'Simular y medir' },
];

for (const c of CASES) {
  test(`simulación ${c.id}: iniciar → pausar → reanudar → reiniciar con estado anunciado y axe`, async ({ page }) => {
    await openFree(page, c.id);
    const sim = page.getByRole('group', { name: c.group, exact: true });
    const status = sim.getByRole('status');
    await expect(status).toHaveText('Lista para iniciar');
    await expect(sim.getByRole('button', { name: 'Reiniciar' })).toBeDisabled();

    await sim.getByRole('button', { name: c.start, exact: true }).click();
    await expect(status).toHaveText('En curso');
    await page.waitForTimeout(300);
    await sim.getByRole('button', { name: 'Pausar' }).click();
    await expect(status).toHaveText('En pausa');
    await expect(sim.getByRole('button', { name: 'Reanudar' })).toBeVisible();

    if (c.frozen) {
      const reading = c.frozen(page, sim);
      const read = async () => (await reading.getAttribute('aria-valuetext')) ?? (await reading.textContent());
      const before = await read();
      await page.waitForTimeout(700);
      expect(await read(), 'la lectura no avanza en pausa').toBe(before);
    }
    expect(await axe(page, `${c.id} en pausa`)).toEqual([]);

    await sim.getByRole('button', { name: 'Reanudar' }).click();
    await expect(status).toHaveText(/En curso|Terminada/);
    await sim.getByRole('button', { name: 'Reiniciar' }).click();
    await expect(status).toHaveText('Lista para iniciar');
    await expect(sim.getByRole('button', { name: c.start, exact: true })).toBeEnabled();
  });
}

test('simulación: el botón principal conserva el foco y responde al teclado (Enter y espacio)', async ({ page }) => {
  await openFree(page, 'conduccion');
  const sim = page.getByRole('group', { name: 'Calentamiento de la varilla', exact: true });
  const status = sim.getByRole('status');
  await sim.getByRole('button', { name: 'Encender y medir' }).focus();
  await page.keyboard.press('Enter');
  await expect(status).toHaveText('En curso');
  await expect(sim.getByRole('button', { name: 'Pausar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(status).toHaveText('En pausa');
  await expect(sim.getByRole('button', { name: 'Reanudar' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(status).toHaveText('En curso');
  // La corrida termina con los mismos valores de siempre (valor dorado de la prueba de conducción).
  await expect(page.locator('.readout').getByText('82,2 °C')).toBeVisible({ timeout: 20_000 });
  await expect(status).toHaveText('Terminada');
  await expect(sim.getByRole('button', { name: 'Medir de nuevo' })).toBeVisible();
});

test('simulación: pausar no cambia el resultado (proyectil y choque con pausa a mitad de camino)', async ({ page }) => {
  await openFree(page, 'proyectiles');
  const lanzador = page.getByRole('group', { name: 'Lanzador', exact: true });
  await lanzador.getByRole('button', { name: 'Disparar' }).click();
  await lanzador.getByRole('button', { name: 'Pausar' }).click();
  await expect(lanzador.getByRole('status')).toHaveText(/En pausa|Terminada/);
  if (await lanzador.getByRole('button', { name: 'Reanudar' }).isVisible()) await lanzador.getByRole('button', { name: 'Reanudar' }).click();
  await page.getByRole('button', { name: 'Medir el alcance con la cinta' }).click({ timeout: 8000 });
  await expect(page.locator('.readout').getByText('2,870 m')).toBeVisible();
  await expect(page.locator('.readout').getByText('resolución 0,001 m')).toBeVisible();

  await openFree(page, 'choques');
  const riel = page.getByRole('group', { name: 'Riel de aire', exact: true });
  await riel.getByRole('button', { name: 'Lanzar' }).click();
  await riel.getByRole('button', { name: 'Pausar' }).click();
  await expect(riel.getByRole('status')).toHaveText(/En pausa|Terminada/);
  if (await riel.getByRole('button', { name: 'Reanudar' }).isVisible()) await riel.getByRole('button', { name: 'Reanudar' }).click();
  await expect(page.locator('.readout').getByText('0,660 m/s')).toBeVisible({ timeout: 10_000 });
  await expect(riel.getByRole('status')).toHaveText('Terminada');
  // Condición imposible: ConditionAlert con cómo corregirlo y el inicio bloqueado.
  const v2 = page.getByLabel(/Velocidad inicial del deslizador 2 \(valor exacto/);
  await v2.fill('0,8'); await v2.press('Enter');
  await expect(page.getByText('Cómo corregirlo:')).toBeVisible();
  await expect(riel.getByRole('button', { name: 'Lanzar' })).toBeDisabled();
});

test('simulación: animaciones continuas (gases y fotosíntesis) se pausan y reanudan', async ({ page }) => {
  for (const [id, group] of [['gases', 'Movimiento de las partículas'], ['fotosintesis', 'Burbujeo de la elodea']] as const) {
    await openFree(page, id);
    const sim = page.getByRole('group', { name: group, exact: true });
    await expect(sim.getByRole('status')).toHaveText('En curso');
    await sim.getByRole('button', { name: 'Pausar' }).click();
    await expect(sim.getByRole('status')).toHaveText('En pausa');
    await sim.getByRole('button', { name: 'Reanudar' }).click();
    await expect(sim.getByRole('status')).toHaveText('En curso');
  }
});

test('simulación con movimiento reducido: la corrida salta al resultado y lo continuo arranca detenido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFree(page, 'calor');
  const cal = page.getByRole('group', { name: 'Calorímetro', exact: true });
  await cal.getByRole('button', { name: 'Mezclar y medir' }).click();
  await expect(cal.getByRole('status')).toHaveText('Terminada');
  await expect(page.locator('.readout').getByText('39,8 °C')).toBeVisible();
  await expect(cal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

  await openFree(page, 'gases');
  const gas = page.getByRole('group', { name: 'Movimiento de las partículas', exact: true });
  await expect(gas.getByRole('status')).toHaveText('Lista para iniciar');
  await gas.getByRole('button', { name: 'Animar las partículas' }).click();
  await expect(gas.getByRole('status')).toHaveText('En curso');
});

test('simulación: capturas claro/oscuro a 1280 y 390 px', async ({ page }) => {
  test.skip(!SHOTS, 'Solo con SIMC_SHOTS=<carpeta>.');
  test.setTimeout(300_000);
  const shots: [string, string, string][] = [
    ['conduccion', 'Calentamiento de la varilla', 'Encender y medir'],
    ['pendulo', 'Péndulo', 'Soltar el péndulo'],
    ['cinetica', 'Reacción y cronómetro', 'Iniciar reacción y cronómetro'],
    ['choques', 'Riel de aire', 'Lanzar'],
  ];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const [id, group, start] of shots) {
        await openFree(page, id);
        const sim = page.getByRole('group', { name: group, exact: true });
        await sim.getByRole('button', { name: start, exact: true }).click();
        await page.waitForTimeout(600);
        if (await sim.getByRole('button', { name: 'Pausar' }).isVisible()) await sim.getByRole('button', { name: 'Pausar' }).click();
        await sim.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/${id}-${scheme}-${width}.png` });
      }
    }
  }
});

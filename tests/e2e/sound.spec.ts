import { expect, test, type Page } from '@playwright/test';

/**
 * Sonidos sintetizados: se cuenta la actividad real de la Web Audio API (osciladores y fuentes creados)
 * envolviendo AudioContext antes de cargar la página, y se exige que no haya errores en la consola.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __audio: { contexts: number; nodes: number }; AudioContext: typeof AudioContext };
    w.__audio = { contexts: 0, nodes: 0 };
    const Orig = w.AudioContext;
    if (!Orig) return;
    class Counted extends Orig {
      constructor(opts?: AudioContextOptions) { super(opts); w.__audio.contexts++; }
      createOscillator() { w.__audio.nodes++; return super.createOscillator(); }
      createBufferSource() { w.__audio.nodes++; return super.createBufferSource(); }
    }
    w.AudioContext = Counted;
  });
});

function trackConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

const audio = (page: Page) => page.evaluate(() => (window as unknown as { __audio: { contexts: number; nodes: number } }).__audio);

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

test('sonido: el botón del encabezado silencia, recuerda la preferencia y no hay audio antes de un gesto', async ({ page }) => {
  const problems = trackConsole(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  expect((await audio(page)).contexts).toBe(0);
  const toggle = page.getByRole('button', { name: 'Sonido', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sonido', exact: true })).toHaveAttribute('aria-pressed', 'false');
  // Silenciado: las acciones del laboratorio no crean nodos de audio.
  await openFree(page, 'circuitos');
  await page.getByRole('button', { name: 'R2: cerrado', exact: true }).click();
  expect((await audio(page)).nodes).toBe(0);
  await page.getByRole('button', { name: 'Sonido', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sonido', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

test('sonido: las acciones de varias prácticas generan sonido sin errores', async ({ page }) => {
  const problems = trackConsole(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  await openFree(page, 'circuitos');
  const before = (await audio(page)).nodes;
  await page.getByRole('button', { name: 'R2: cerrado', exact: true }).click();
  await expect.poll(async () => (await audio(page)).nodes).toBeGreaterThan(before);
  expect((await audio(page)).contexts).toBe(1);

  await openFree(page, 'densidad');
  let n = (await audio(page)).nodes;
  await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
  await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
  await expect.poll(async () => (await audio(page)).nodes).toBeGreaterThan(n);
  n = (await audio(page)).nodes;
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await expect.poll(async () => (await audio(page)).nodes).toBeGreaterThan(n);

  await openFree(page, 'choques');
  n = (await audio(page)).nodes;
  await page.getByRole('button', { name: 'Lanzar' }).click();
  await expect(page.locator('.readout').getByText('0,660 m/s')).toBeVisible({ timeout: 10_000 });
  // Soplador + choque + fotopuertas.
  expect((await audio(page)).nodes).toBeGreaterThan(n + 5);

  await openFree(page, 'ph');
  n = (await audio(page)).nodes;
  await page.getByRole('button', { name: '+0,1 mL' }).click();
  await expect.poll(async () => (await audio(page)).nodes).toBeGreaterThan(n);

  await openFree(page, 'proyectiles');
  await page.getByRole('button', { name: 'Disparar' }).click();
  await openFree(page, 'gases');
  const v = page.getByLabel('Volumen de la jeringa (valor exacto en mL)');
  await v.fill('50'); await v.press('Enter');
  await v.fill('900'); await v.press('Enter'); // fuera de rango: tono de error + mensaje visible
  await expect(page.getByText(/Usa un valor entre/)).toBeVisible();
  await openFree(page, 'newton');
  await page.getByRole('button', { name: 'Soltar el carrito' }).click();
  await expect(page.locator('.readout').getByText('0,707 s')).toBeVisible();
  expect((await audio(page)).contexts).toBe(1);
  expect(problems).toEqual([]);
});

test('sonido: volumen ajustable en Ayuda y accesibilidad', async ({ page }) => {
  const problems = trackConsole(page);
  await page.goto('/#/ayuda');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const slider = page.getByLabel(/Volumen de los sonidos/);
  await expect(slider).toHaveValue('60');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('65');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lvcn:sonido') ?? '{}'));
  expect(saved.volume).toBeCloseTo(0.65);
  await page.getByLabel('Sonidos de laboratorio').uncheck();
  await expect(slider).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Sonido', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(problems).toEqual([]);
});

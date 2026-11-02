import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Lote 3D-2 «biología invisible» (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas src/three: ósmosis,
 * mitosis, ADN, extracción de ADN (tubo y doble hélice), Mendel, fotosíntesis y respiración. Para cada vista: se abre a
 * pedido (tarjeta cerrada que carga el código al abrir), dibuja en WebGL (píxeles pintados en el lienzo) o, sin WebGL,
 * en la vista de respaldo SVG; se gira con el teclado; axe sin violaciones en tema claro y oscuro; sin desbordamiento a
 * 390 px. Además, la escena sigue el estado del laboratorio (descripción que cambia con los controles).
 *
 * Capturas opcionales: LOTE3D_SHOTS=/ruta npx playwright test tests/e2e/visor3d-lote2.spec.ts
 */
const SHOTS = process.env.LOTE3D_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

interface Case { name: string; id: string; prefix: string; title: RegExp; prepare?: (page: Page) => Promise<void> }
const CASES: Case[] = [
  { name: 'osmosis', id: 'osmosis', prefix: 'osm3d', title: /la membrana y el agua que la cruza/ },
  {
    name: 'mitosis', id: 'mitosis', prefix: 'mit3d', title: /cromosomas y huso/,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Ciclo celular y ADN' }).click();
      await page.getByRole('button', { name: 'Metafase', exact: true }).click();
    },
  },
  { name: 'adn', id: 'adn', prefix: 'adn3d', title: /la doble hélice de tu secuencia/ },
  {
    name: 'extraccion-adn', id: 'extraccion-adn', prefix: 'xad3d', title: /el tubo y el ADN precipitado/,
    prepare: async (page) => {
      for (const b of ['Verter el tampón de lisis', 'Filtrar el extracto', 'Verter el alcohol frío']) await page.getByRole('button', { name: b }).click();
    },
  },
  {
    name: 'extraccion-adn-helice', id: 'extraccion-adn', prefix: 'xadh3d', title: /la doble hélice que construyes/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Doble hebra y complementariedad' }).click(); },
  },
  {
    name: 'mendel', id: 'mendel', prefix: 'mdl3d', title: /cromosomas homólogos y gametos/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Dos (dihíbrido)' }).click(); },
  },
  {
    name: 'fotosintesis', id: 'fotosintesis', prefix: 'fot3d', title: /dentro del cloroplasto/,
    // Se detiene la animación de las burbujas para comparar imágenes estables.
    prepare: async (page) => {
      const sim = page.locator('.sim-controls').filter({ hasText: 'Burbujeo de la elodea' });
      await sim.getByRole('button', { name: 'Pausar' }).click();
      await expect(sim.getByRole('button', { name: 'Reanudar' })).toBeVisible();
    },
  },
  { name: 'respiracion', id: 'respiracion', prefix: 'res3d', title: /la mitocondria y el balance de ATP/ },
];

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

/** Abre la tarjeta «Vista 3D» de la práctica y devuelve la sección. */
async function open3D(page: Page, c: Case): Promise<Locator> {
  const card = page.locator('section.lote3d');
  await expect(card).toHaveCount(1, { timeout: 20_000 });
  await expect(card.getByRole('heading', { name: c.title })).toBeVisible();
  // Cerrada no descarga nada: no hay escena en la página.
  await expect(view(page, c.prefix)).toHaveCount(0);
  await card.getByRole('button', { name: 'Abrir la vista 3D' }).click();
  await expect(card.getByRole('button', { name: 'Cerrar la vista 3D' })).toHaveAttribute('aria-expanded', 'true');
  await card.scrollIntoViewIfNeeded();
  return card;
}

/** Píxeles distintos entre dos imágenes del lienzo. */
async function diffPixels(page: Page, u1: string, u2: string): Promise<number> {
  return page.evaluate(async ([a, b]) => {
    const load = async (u: string) => {
      const i = new Image();
      await new Promise((ok) => { i.onload = ok; i.src = u; });
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const g = c.getContext('2d')!; g.drawImage(i, 0, 0);
      return g.getImageData(0, 0, c.width, c.height).data;
    };
    const x = await load(a), y = await load(b);
    let n = 0;
    for (let k = 0; k < x.length; k += 4) if (x[k] !== y[k] || x[k + 1] !== y[k + 1] || x[k + 2] !== y[k + 2] || x[k + 3] !== y[k + 3]) n++;
    return n;
  }, [u1, u2] as const);
}

async function noOverflow(page: Page, w: number) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o, `desbordamiento horizontal a ${w} px`).toBeLessThanOrEqual(0);
}

async function axe(page: Page, where: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return r.violations.map((v) => `${where} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function axeBoth(page: Page, where: string) {
  const errors: string[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(250);
    errors.push(...(await axe(page, `${where} ${scheme}`)));
  }
  await page.emulateMedia({ colorScheme: 'light' });
  return errors;
}

// WebGL por software (SwiftShader). Los casos «sin WebGL» fuerzan el respaldo con el gancho __lvSinWebgl del kit.
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

test.describe('con WebGL (SwiftShader)', () => {
  for (const c of CASES) {
    test(`${c.name}: la vista 3D dibuja en el lienzo, se gira con el teclado, accesible en claro y oscuro, sin desbordar a 390 px`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      await openFree(page, c.id);
      await c.prepare?.(page);
      const card = await open3D(page, c);
      await waitEngine(page, c.prefix, 'disponible');
      const v = view(page, c.prefix);
      await page.waitForTimeout(300);
      const a = await pixels(v);
      console.log(`[lote3d-2] ${c.name}: ${a.painted} píxeles pintados, ${a.colors} colores`);
      expect(a.painted, `${c.name}: lienzo 3D vacío`).toBeGreaterThan(1500);
      expect((await description(v)).length).toBeGreaterThan(80);
      // Estatus epistémico visible.
      await expect(figureOf(page, c.prefix).getByText(/Escena 3D/).first()).toBeVisible();
      // Teclado: → gira (cambia la imagen); Inicio la devuelve idéntica.
      await v.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
      const b = await pixels(v);
      expect(await diffPixels(page, a.uri, b.uri)).toBeGreaterThan(0.1 * a.painted);
      await page.keyboard.press('Home');
      await page.waitForTimeout(150);
      // Vuelve a la misma vista. Con WebGL por software, el orden de las piezas translúcidas que coinciden en
      // profundidad puede cambiar unos pocos píxeles de borde: se tolera menos del 3 % de lo pintado.
      expect(await diffPixels(page, a.uri, (await pixels(v)).uri)).toBeLessThan(0.03 * a.painted);
      if (SHOTS) {
        await card.screenshot({ path: `${SHOTS}/${c.name}-claro-1280.png` });
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForTimeout(300);
        await card.screenshot({ path: `${SHOTS}/${c.name}-oscuro-1280.png` });
        await page.emulateMedia({ colorScheme: 'light' });
      }
      expect(await axeBoth(page, c.name)).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);
      await noOverflow(page, 390);
      if (SHOTS) {
        await card.scrollIntoViewIfNeeded();
        await card.screenshot({ path: `${SHOTS}/${c.name}-claro-390.png` });
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForTimeout(300);
        await card.screenshot({ path: `${SHOTS}/${c.name}-oscuro-390.png` });
      }
    });
  }
});

test.describe('sin WebGL', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { (window as { __lvSinWebgl?: boolean }).__lvSinWebgl = true; });
  });
  for (const c of CASES) {
    test(`${c.name}: sin WebGL usa el respaldo SVG, se gira con el teclado y es accesible a 390 px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 390, height: 844 });
      await openFree(page, c.id);
      await c.prepare?.(page);
      const card = await open3D(page, c);
      await waitEngine(page, c.prefix, 'sin-webgl');
      await expect(card.getByText(/este equipo no ofrece WebGL/).first()).toBeVisible();
      const svg = figureOf(page, c.prefix).locator('svg').first();
      await expect(svg).toBeVisible();
      const marks = await svg.evaluate((s) => s.querySelectorAll('circle, ellipse, line, polygon, path').length);
      expect(marks, `${c.name}: respaldo SVG vacío`).toBeGreaterThan(5);
      const v = view(page, c.prefix);
      const before = await svg.innerHTML();
      await v.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => svg.innerHTML()).not.toBe(before);
      if (SHOTS) await card.screenshot({ path: `${SHOTS}/${c.name}-sinwebgl-390.png` });
      expect(await axeBoth(page, `${c.name} sin WebGL`)).toEqual([]);
      await noOverflow(page, 390);
    });
  }

  // La escena sigue el estado del laboratorio (sin WebGL basta: la descripción y las primitivas son las mismas).
  test('mitosis: la escena sigue la fase elegida (cromosomas y núcleos del modelo)', async ({ page }) => {
    await openFree(page, 'mitosis');
    await CASES[1].prepare!(page);
    await open3D(page, CASES[1]);
    const v = view(page, 'mit3d');
    await expect.poll(() => description(v)).toContain('metafase');
    expect(await description(v)).toContain('16 cromosomas, 2 cromátidas por cromosoma, 1 núcleo');
    await page.getByRole('button', { name: 'Anafase', exact: true }).click();
    await expect.poll(() => description(v)).toContain('32 cromosomas, 1 cromátida por cromosoma');
    await page.getByRole('button', { name: 'Telofase', exact: true }).click();
    await expect.poll(() => description(v)).toContain('2 núcleos');
  });

  test('adn: la hélice usa la secuencia escrita (pares, vueltas y puentes de hidrógeno)', async ({ page }) => {
    await openFree(page, 'adn');
    await open3D(page, CASES[2]);
    await page.getByLabel('Hebra codificante 5′ → 3′').fill('ATGGCC');
    const v = view(page, 'adn3d');
    // 6 pares: 2 A–T (2 puentes) y 4 G–C (3 puentes) = 16; 6 × 3,4 Å = 20 Å.
    await expect.poll(() => description(v)).toContain('6 pares de bases');
    expect(await description(v)).toContain('16 puentes de hidrógeno');
    expect(await description(v)).toContain('20 Å de largo');
    await page.getByLabel('Par de bases que quieres ver').selectOption('3');
    await expect(page.getByText(/Par 4: G \(guanina\) con C \(citosina\), unidas por 3 puentes de hidrógeno/).first()).toBeVisible();
  });

  test('extraccion-adn: el tubo sigue los pasos del protocolo', async ({ page }) => {
    await openFree(page, 'extraccion-adn');
    await open3D(page, CASES[3]);
    const v = view(page, 'xad3d');
    await expect.poll(() => description(v)).toContain('todavía está vacío');
    for (const b of ['Verter el tampón de lisis', 'Filtrar el extracto']) await page.getByRole('button', { name: b }).click();
    await expect.poll(() => description(v)).toContain('falta el alcohol');
    await page.getByRole('button', { name: 'Verter el alcohol frío' }).click();
    await expect.poll(() => description(v)).toContain('hebras blancas dibujadas');
    await page.getByRole('button', { name: 'Enrollar el ADN con la varilla' }).click();
    await expect.poll(() => description(v)).toContain('ovillo');
  });

  test('mendel: los gametos son los del cuadro de Punnett', async ({ page }) => {
    await openFree(page, 'mendel');
    await CASES[5].prepare!(page);
    await open3D(page, CASES[5]);
    const v = view(page, 'mdl3d');
    await expect.poll(() => description(v)).toContain('4 tipos de gametos');
    await expect(page.locator('section.lote3d').getByText('YR, Yr, yR, yr').first()).toBeVisible();
  });

  test('osmosis y respiracion: la escena sigue a la simulación', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'osmosis');
    await open3D(page, CASES[0]);
    const v = view(page, 'osm3d');
    await page.getByRole('slider', { name: 'NaCl en el medio' }).fill('0.3');
    await expect.poll(() => description(v)).toContain('solución hipotónica');
    await page.getByRole('button', { name: 'Iniciar' }).first().click();
    await expect.poll(() => description(v)).toContain('el agua entra');
    const vol = (await page.locator('.readout .item').filter({ hasText: 'Volumen celular' }).locator('.v').textContent())!.trim();
    await expect.poll(() => description(v)).toContain(`Volumen ${vol}`);

    await openFree(page, 'respiracion');
    await open3D(page, CASES[7]);
    const r = view(page, 'res3d');
    await expect.poll(() => description(r)).toContain('0 esferas de O₂');
    await page.getByRole('button', { name: 'Iniciar medición' }).click();
    await expect.poll(() => description(r)).toContain('12 esferas de O₂');
    await page.getByRole('button', { name: /Crestas: cadena de transporte/ }).click();
    await expect(page.getByText(/la ATP sintasa fabrica ATP/).first()).toBeVisible();
  });
});

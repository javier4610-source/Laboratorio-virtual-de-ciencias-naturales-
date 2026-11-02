import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Lote 3D-3 «mecánica» (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas src/three: proyectiles, newton,
 * choques, energia, trabajo, maquinas (palanca y poleas) y cinetica-potencial (riel y resorte). Para cada vista: se abre
 * a pedido (tarjeta cerrada que carga el código al abrir), dibuja en WebGL (píxeles pintados en el lienzo) o, sin WebGL,
 * en la vista de respaldo SVG; se gira con el teclado; axe sin violaciones en tema claro y oscuro; sin desbordamiento a
 * 390 px y sin rótulos encimados. Además, la escena sigue el estado del laboratorio (descripción que cambia con los
 * controles y con la simulación).
 *
 * Capturas opcionales: LOTE3D_SHOTS=/ruta npx playwright test tests/e2e/visor3d-lote3.spec.ts
 */
const SHOTS = process.env.LOTE3D_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

interface Case { name: string; id: string; prefix: string; title: RegExp; prepare?: (page: Page) => Promise<void> }
const CASES: Case[] = [
  { name: 'proyectiles', id: 'proyectiles', prefix: 'pry3d', title: /trayectoria y vectores de velocidad/ },
  { name: 'newton', id: 'newton', prefix: 'nwt3d', title: /diagrama de cuerpo libre y aceleración/ },
  { name: 'choques', id: 'choques', prefix: 'cho3d', title: /cantidad de movimiento antes y después/ },
  { name: 'energia', id: 'energia', prefix: 'ene3d', title: /la montaña rusa y sus energías/ },
  { name: 'trabajo', id: 'trabajo', prefix: 'trb3d', title: /fuerzas, desplazamiento y trabajo en la rampa/ },
  { name: 'maquinas', id: 'maquinas', prefix: 'maq3d', title: /la palanca, sus fuerzas y sus brazos/ },
  {
    name: 'maquinas-poleas', id: 'maquinas', prefix: 'maq3d', title: /las poleas, la cuerda y la carga/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Poleas', exact: true }).click(); },
  },
  { name: 'cinetica-potencial', id: 'cinetica-potencial', prefix: 'ecp3d', title: /el movimiento y las energías/ },
  {
    name: 'cinetica-potencial-resorte', id: 'cinetica-potencial', prefix: 'ecp3d', title: /el movimiento y las energías/,
    prepare: async (page) => { await page.getByRole('button', { name: '3 · Elástica' }).click(); },
  },
];

/** Los rótulos HTML superpuestos no se encima entre sí ni se salen del lienzo. */
async function labelsApart(page: Page, prefix: string) {
  const boxes = await figureOf(page, prefix).locator('.scene3d-label').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect(), p = e.parentElement!.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, pl: p.left, pr: p.right, pt: p.top, pb: p.bottom, text: e.textContent };
  }));
  for (const a of boxes) {
    expect(a.l, `rótulo «${a.text}» fuera del lienzo`).toBeGreaterThanOrEqual(a.pl - 1);
    expect(a.r, `rótulo «${a.text}» fuera del lienzo`).toBeLessThanOrEqual(a.pr + 1);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    expect(ox > 2 && oy > 2, `rótulos encimados: «${a.text}» y «${b.text}»`).toBe(false);
  }
}

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
      console.log(`[lote3d-3] ${c.name}: ${a.painted} píxeles pintados, ${a.colors} colores`);
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
      await labelsApart(page, c.prefix);
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
  // Con movimiento reducido cada simulación salta a su resultado, así se comparan estados estables.
  const byName = (n: string) => CASES.find((c) => c.name === n)!;

  test('proyectiles: el ángulo, el disparo y la medición llegan a la escena', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'proyectiles');
    await open3D(page, byName('proyectiles'));
    const v = view(page, 'pry3d');
    await page.getByRole('slider', { name: 'Ángulo de lanzamiento', exact: true }).fill('45');
    await expect.poll(() => description(v)).toContain('lanzada a 45,0°');
    expect(await description(v)).toContain('La esfera está en el lanzador');
    await page.getByRole('button', { name: 'Disparar', exact: true }).click();
    await expect.poll(() => description(v)).toContain('falta medir el alcance');
    // No revela el alcance antes de medirlo.
    expect(await description(v)).not.toMatch(/cayó a \d/);
    await page.getByRole('button', { name: 'Medir el alcance con la cinta' }).click();
    const range = (await page.locator('.readout .item').filter({ hasText: 'Alcance (cinta métrica)' }).locator('.v').textContent())!.trim();
    await expect.poll(() => description(v)).toContain(`cayó a ${range} de la plomada`);
  });

  test('newton: la fuerza y la masa cambian las flechas; al soltar, el carrito llega a la fotopuerta 2', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'newton');
    await open3D(page, byName('newton'));
    const v = view(page, 'nwt3d');
    await page.getByRole('slider', { name: 'Fuerza aplicada', exact: true }).fill('5');
    await expect.poll(() => description(v)).toContain('aplicada 5,0 N');
    await page.getByRole('slider', { name: 'Masa del carrito', exact: true }).fill('1');
    await expect.poll(() => description(v)).toContain('peso 9,80 N');
    await page.getByRole('button', { name: 'Soltar el carrito' }).click();
    await expect.poll(() => description(v)).toContain('llegó a la fotopuerta 2');
    expect(await description(v)).toContain('a = F neta / m = 5,00 m/s²');
  });

  test('choques: las flechas de cantidad de movimiento siguen el ensayo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'choques');
    await open3D(page, byName('choques'));
    const v = view(page, 'cho3d');
    await expect.poll(() => description(v)).toContain('antes del choque');
    await page.getByRole('button', { name: 'Lanzar', exact: true }).click();
    await expect.poll(() => description(v)).toContain('después del choque');
    // m₁v₁ + m₂v₂ = 0,3·0,5 + 0,2·(−0,3) = 0,090 kg·m/s antes y después.
    expect(await description(v)).toContain('antes 0,090 kg·m/s y después 0,090 kg·m/s');
  });

  test('energia: la esfera y las barras siguen el recorrido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'energia');
    await open3D(page, byName('energia'));
    const v = view(page, 'ene3d');
    await expect.poll(() => description(v)).toContain('a 0,00 m del inicio');
    expect(await description(v)).toMatch(/Ep 4,90 J \(100 %\), Ec 0,00 J \(0 %\)/);
    await page.getByRole('button', { name: 'Soltar la esfera' }).click();
    await expect.poll(() => description(v)).toContain('superó la colina');
    expect(await description(v)).toContain('a 4,00 m del inicio');
  });

  test('trabajo: al medir aparecen F, d, h y las áreas del trabajo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'trabajo');
    await open3D(page, byName('trabajo'));
    const v = view(page, 'trb3d');
    await expect.poll(() => description(v)).toContain('Al medir aparecen la fuerza F');
    await page.getByRole('button', { name: 'Medir subida por la rampa' }).click();
    await expect.poll(() => description(v)).toContain('recorrió d = 60 cm');
    expect(await description(v)).toContain('subió h = 30,0 cm');
    expect(await description(v)).toContain('Según el modelo: F·d =');
  });

  test('maquinas: la palanca gira al medir y las poleas muestran s = n·h', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'maquinas');
    await open3D(page, byName('maquinas'));
    const v = view(page, 'maq3d');
    await expect.poll(() => description(v)).toContain('dR = 20 cm');
    await page.getByRole('button', { name: 'Medir fuerza y recorridos' }).click();
    await expect.poll(() => description(v)).toContain('La barra está girada 10,0°');
    expect(await description(v)).toContain('F = 1,96 N');
    await page.getByRole('button', { name: 'Poleas', exact: true }).click();
    await expect.poll(() => description(v)).toContain('2 tramos de cuerda sostienen');
    await page.getByRole('button', { name: 'Medir fuerza y recorridos' }).click();
    await expect.poll(() => description(v)).toContain('s = 40,0 cm de cuerda y la carga subió h = 20,0 cm');
  });

  test('cinetica-potencial: las tres estaciones siguen al banco', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'cinetica-potencial');
    await open3D(page, byName('cinetica-potencial'));
    const v = view(page, 'ecp3d');
    await expect.poll(() => description(v)).toContain('a 0,00 m de la salida');
    await page.getByRole('button', { name: 'Lanzar el carrito' }).click();
    await expect.poll(() => description(v)).toContain('a 0,60 m de la salida');
    await page.getByRole('button', { name: '3 · Elástica' }).click();
    await expect.poll(() => description(v)).toContain('el resorte está comprimido 5,0 cm');
    await page.getByRole('button', { name: 'Soltar el pestillo' }).click();
    await expect.poll(() => description(v)).toContain('ya dejó el resorte');
    await page.getByRole('button', { name: '2 · Gravitatoria' }).click();
    await expect.poll(() => description(v)).toContain('Torre de caída en 3D');
  });
});

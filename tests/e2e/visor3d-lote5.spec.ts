import { expect, test, type Locator, type Page } from '@playwright/test';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';
import { axe } from './organica-comun';

/**
 * Lote 3D-5 «ondas, luz y fluidos» (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas src/three: ondas,
 * sonido, optica, interferencia, presion (sonda y botella con agujeros), flotacion y densidad. Para cada vista: se abre a
 * pedido (tarjeta cerrada que carga el código al abrir), dibuja en WebGL (píxeles pintados en el lienzo) o, sin WebGL,
 * en la vista de respaldo SVG; se gira con el teclado y «Restablecer vista» devuelve la misma imagen; axe sin
 * violaciones en tema claro y oscuro (tras 800 ms); sin desbordamiento a 390 px y sin rótulos encimados. Además, la
 * escena sigue el estado del laboratorio y las animaciones propias de la vista se pausan.
 *
 * Capturas opcionales: LOTE3D_SHOTS=/ruta npx playwright test tests/e2e/visor3d-lote5.spec.ts
 */
const SHOTS = process.env.LOTE3D_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

interface Case { name: string; id: string; prefix: string; title: RegExp; prepare?: (page: Page) => Promise<void> }
const CASES: Case[] = [
  {
    name: 'ondas', id: 'ondas', prefix: 'ond3d', title: /la cuerda, la regla y la dirección de la vibración/,
    // El generador arranca solo (sin movimiento reducido): se pausa para comparar imágenes estables.
    prepare: async (page) => { await page.getByRole('button', { name: 'Pausar', exact: true }).click(); },
  },
  {
    name: 'sonido', id: 'sonido', prefix: 'son3d', title: /las capas de aire dentro del tubo/,
    // Generador encendido (amplitud constante) y una columna cercana a la resonancia de 512 Hz.
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Generador y parlante', exact: true }).click();
      await page.getByRole('slider', { name: 'Longitud de la columna de aire', exact: true }).fill('49');
      await page.getByRole('button', { name: 'Encender el generador' }).click();
    },
  },
  {
    name: 'optica', id: 'optica', prefix: 'opt3d', title: /los rayos y el plano de incidencia/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Medir con el transportador' }).click(); },
  },
  {
    name: 'interferencia', id: 'interferencia', prefix: 'int3d', title: /ondas de las rendijas y patrón en la pantalla/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Encender la fuente de luz' }).click(); },
  },
  {
    name: 'presion', id: 'presion', prefix: 'pre3d', title: /la presión del líquido por capas y la sonda/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Leer el manómetro' }).click(); },
  },
  {
    name: 'presion-chorros', id: 'presion', prefix: 'pre3d', title: /la botella, la presión y los chorros/,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Botella con agujeros', exact: true }).click();
      await page.getByRole('button', { name: 'Destapar los agujeros y medir' }).click();
      await page.waitForTimeout(2000);
    },
  },
  {
    name: 'flotacion', id: 'flotacion', prefix: 'flo3d', title: /línea de flotación, peso y empuje/,
    prepare: async (page) => {
      await page.getByLabel('Objeto colgado del gancho').selectOption('madera');
      await page.getByRole('slider', { name: 'Descenso del objeto', exact: true }).fill('6');
      await page.waitForTimeout(1600);
    },
  },
  {
    name: 'densidad', id: 'densidad', prefix: 'den3d', title: /la balanza, la probeta y cubos de igual masa/,
    prepare: async (page) => {
      await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
      await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
    },
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

async function axeBoth(page: Page, where: string) {
  const errors: string[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // Espera a que terminen las transiciones de color del tema: axe con colores a medio camino da falsos contrastes.
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
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
      console.log(`[lote3d-5] ${c.name}: ${a.painted} píxeles pintados, ${a.colors} colores`);
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
      // Vuelve a la misma vista; margen mínimo (0,5 % de lo pintado) por el WebGL por software.
      const back = await diffPixels(page, a.uri, (await pixels(v)).uri);
      console.log(`[lote3d-5] ${c.name}: ${back} píxeles distintos tras restablecer`);
      expect(back).toBeLessThan(0.005 * a.painted);
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
  const byName = (n: string) => CASES.find((c) => c.name === n)!;
  const svgOf = (page: Page, prefix: string) => figureOf(page, prefix).locator('svg').first();

  test('ondas: la cuerda sigue la frecuencia del generador y λ aparece solo después de medir', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'ondas');
    await open3D(page, byName('ondas'));
    const v = view(page, 'ond3d');
    await expect.poll(() => description(v)).toContain('movida por el generador a 2,00 Hz');
    expect(await description(v)).toContain('La longitud de onda queda oculta');
    await page.getByRole('slider', { name: 'Frecuencia', exact: true }).fill('4');
    await expect.poll(() => description(v)).toContain('movida por el generador a 4,00 Hz');
    await page.getByLabel('λ medida (m):').fill('2,5');
    await expect.poll(() => description(v)).toContain('La longitud de onda del modelo es 2,50 m');
  });

  test('sonido: el aire vibra solo mientras suena la fuente, y «Mover el aire» se pausa', async ({ page }) => {
    await openFree(page, 'sonido');
    await page.getByRole('button', { name: 'Generador y parlante', exact: true }).click();
    await open3D(page, byName('sonido'));
    const v = view(page, 'son3d');
    await expect.poll(() => description(v)).toContain('La fuente está en silencio');
    await page.getByRole('button', { name: 'Encender el generador' }).click();
    await expect.poll(() => description(v)).toContain('Sonando: la amplitud dibujada');
    const svg = svgOf(page, 'son3d');
    const card = page.locator('section.lote3d');
    await card.getByRole('button', { name: 'Mover el aire' }).click();
    const s0 = await svg.innerHTML();
    await expect.poll(() => svg.innerHTML()).not.toBe(s0);
    await card.getByRole('button', { name: /^Pausar/ }).click();
    const s1 = await svg.innerHTML();
    await page.waitForTimeout(400);
    expect(await svg.innerHTML()).toBe(s1);
  });

  test('sonido: con movimiento reducido «Mover el aire» está desactivado', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'sonido');
    const card = await open3D(page, byName('sonido'));
    await expect(card.getByRole('button', { name: 'Mover el aire' })).toBeDisabled();
  });

  test('optica: los ángulos aparecen al medir y hay reflexión total del agua al aire a 60°', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'optica');
    await open3D(page, byName('optica'));
    const v = view(page, 'opt3d');
    await expect.poll(() => description(v)).toContain('Los ángulos aún no se han medido');
    await page.getByRole('button', { name: 'Medir con el transportador' }).click();
    await expect.poll(() => description(v)).toContain('refracción 28,8°');
    await page.getByRole('button', { name: 'Invertir medios' }).click();
    await page.getByRole('slider', { name: 'Ángulo de incidencia', exact: true }).fill('60');
    await expect.poll(() => description(v)).toContain('Reflexión total interna');
  });

  test('interferencia: al encender la fuente aparece el patrón y las ondas se pausan', async ({ page }) => {
    await openFree(page, 'interferencia');
    await open3D(page, byName('interferencia'));
    const v = view(page, 'int3d');
    await expect.poll(() => description(v)).toContain('La fuente está apagada');
    await page.getByRole('button', { name: 'Encender la fuente de luz' }).click();
    await expect.poll(() => description(v)).toMatch(/se ven \d+ zonas brillantes/);
    const svg = svgOf(page, 'int3d');
    const card = page.locator('section.lote3d');
    await card.getByRole('button', { name: 'Mover las ondas' }).click();
    const s0 = await svg.innerHTML();
    await expect.poll(() => svg.innerHTML()).not.toBe(s0);
    await card.getByRole('button', { name: /^Pausar/ }).click();
    const s1 = await svg.innerHTML();
    await page.waitForTimeout(400);
    expect(await svg.innerHTML()).toBe(s1);
  });

  test('presion: la sonda baja con el banco y los chorros llegan a la cinta al medir', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'presion');
    await open3D(page, byName('presion'));
    const v = view(page, 'pre3d');
    await expect.poll(() => description(v)).toContain('a 10,0 cm de profundidad');
    await page.getByRole('slider', { name: 'Profundidad de la sonda', exact: true }).fill('20');
    await expect.poll(() => description(v)).toContain('a 20,0 cm de profundidad');
    await page.getByRole('button', { name: 'Botella con agujeros', exact: true }).click();
    await open3D(page, byName('presion-chorros'));
    await expect.poll(() => description(v)).toContain('siguen tapados con cinta');
    await page.getByRole('button', { name: 'Destapar los agujeros y medir' }).click();
    await expect.poll(() => description(v)).toContain('la cinta marca');
  });

  test('flotacion: la madera flota con su línea de flotación; el hierro cuelga', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'flotacion');
    await open3D(page, byName('flotacion'));
    const v = view(page, 'flo3d');
    await expect.poll(() => description(v)).toContain('cuelga en el aire');
    await page.getByLabel('Objeto colgado del gancho').selectOption('madera');
    await page.getByRole('slider', { name: 'Descenso del objeto', exact: true }).fill('6');
    await expect.poll(() => description(v)).toMatch(/flota con el [\d,]+ % de su volumen/);
    await page.getByLabel('Objeto colgado del gancho').selectOption('hierro');
    await page.getByRole('slider', { name: 'Descenso del objeto', exact: true }).fill('8');
    await expect.poll(() => description(v)).toContain('cuelga totalmente sumergido');
  });

  test('densidad: la muestra pasa de la mesa a la balanza y a la probeta', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'densidad');
    await open3D(page, byName('densidad'));
    const v = view(page, 'den3d');
    await expect.poll(() => description(v)).toContain('sobre la mesa');
    await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
    await expect.poll(() => description(v)).toContain('en el plato de la balanza, que marca 21,6 g');
    await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
    await expect.poll(() => description(v)).toContain('el agua subió de 50,0 a 58,0 mL');
  });
});

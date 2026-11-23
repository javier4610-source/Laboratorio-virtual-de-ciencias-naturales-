import { expect, test, type Locator, type Page } from '@playwright/test';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';
import { axe } from './organica-comun';

/**
 * Lote 3D-7 «ecología, ambiente y datos» (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas src/three:
 * ecosistema, redes, descomposicion, agua, poblacion, reto, metabolismo y secuencias. Para cada vista: se abre a pedido
 * (tarjeta cerrada que carga el código al abrir), dibuja en WebGL (píxeles pintados en el lienzo) o, sin WebGL, en la
 * vista de respaldo SVG; se gira con el teclado y «Restablecer vista» devuelve la misma imagen; axe sin violaciones en
 * tema claro y oscuro (tras 800 ms); sin desbordamiento a 390 px y sin rótulos encimados. Además, la escena sigue el
 * estado del laboratorio y las animaciones siguen el reloj del banco (quietas en pausa).
 *
 * Capturas opcionales: LOTE3D_SHOTS=/ruta npx playwright test tests/e2e/visor3d-lote7.spec.ts
 */
const SHOTS = process.env.LOTE3D_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

/** Con movimiento reducido el banco salta al resultado: imágenes estables para comparar. */
const reduce = (page: Page) => page.emulateMedia({ reducedMotion: 'reduce' });

/** `ready`: espera, ya abierta la vista, a que termine de cargar lo que la escena lee aparte (la estructura del PDB). */
interface Case { name: string; id: string; prefix: string; title: RegExp; prepare?: (page: Page) => Promise<void>; ready?: (page: Page) => Promise<void> }
const CASES: Case[] = [
  {
    name: 'ecosistema', id: 'ecosistema', prefix: 'eco3d', title: /el frasco con sus flujos de materia y energía/,
    prepare: async (page) => { await reduce(page); await page.getByRole('button', { name: 'Simular y medir' }).click(); },
  },
  {
    name: 'redes', id: 'redes', prefix: 'red3d', title: /la red por niveles, la pirámide y la cascada/,
    prepare: async (page) => { await reduce(page); await page.getByRole('button', { name: 'Simular', exact: true }).click(); },
  },
  {
    name: 'descomposicion', id: 'descomposicion', prefix: 'des3d', title: /la compostera en corte y la bolsa que se pesa/,
    prepare: async (page) => { await reduce(page); await page.getByRole('button', { name: 'Pesar las bolsas' }).click(); },
  },
  {
    name: 'agua', id: 'agua', prefix: 'agu3d', title: /el río coloreado por su oxígeno/,
    prepare: async (page) => { await reduce(page); await page.getByRole('button', { name: 'Tomar muestra y medir' }).click(); },
  },
  { name: 'poblacion', id: 'poblacion', prefix: 'pob3d', title: /la superficie del rendimiento sostenible/ },
  {
    name: 'reto', id: 'reto', prefix: 'ret3d', title: /la nube de datos que se puede girar/,
    prepare: async (page) => { await reduce(page); await page.getByRole('button', { name: 'Recolectar datos' }).click(); },
  },
  {
    name: 'metabolismo', id: 'metabolismo', prefix: 'met3d', title: /la célula con los flujos del FBA/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Calcular el óptimo' }).click(); },
  },
  {
    name: 'secuencias', id: 'secuencias', prefix: 'seq3d', title: /la conservación sobre la estructura de la proteína/,
    prepare: async (page) => {
      await page.getByLabel('Herramienta').getByRole('button', { name: 'Alineamiento' }).click();
      await page.getByLabel('Comparación preparada').selectOption('globinas');
      await page.getByRole('button', { name: 'Alinear', exact: true }).click();
    },
    ready: async (page) => { await expect.poll(() => description(view(page, 'seq3d')), { timeout: 20_000 }).toContain('estructura 2HHB'); },
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
      await c.ready?.(page);
      const v = view(page, c.prefix);
      await page.waitForTimeout(300);
      const a = await pixels(v);
      console.log(`[lote3d-7] ${c.name}: ${a.painted} píxeles pintados, ${a.colors} colores`);
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
      console.log(`[lote3d-7] ${c.name}: ${back} píxeles distintos tras restablecer`);
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
      await c.ready?.(page);
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

  test('ecosistema: quieto en pausa durante la cámara rápida y los valores del día solo al medir', async ({ page }) => {
    await openFree(page, 'ecosistema');
    await open3D(page, byName('ecosistema'));
    const v = view(page, 'eco3d');
    await expect.poll(() => description(v)).toContain('Aún no corre la simulación');
    await page.getByRole('button', { name: 'Simular y medir' }).click();
    // La cámara rápida del banco dura poco más de 1 s para 7 días: se pausa a mitad de camino.
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
    const svg = svgOf(page, 'eco3d');
    const s1 = await svg.innerHTML();
    const d1 = await description(v);
    expect(d1).toContain('los valores aparecen al terminar la medición');
    expect(d1).not.toContain('Lecturas:');
    await page.waitForTimeout(500);
    expect(await svg.innerHTML()).toBe(s1);
    expect(await description(v)).toBe(d1);
    await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
    await expect.poll(() => description(v), { timeout: 10_000 }).toContain('Lecturas: oxígeno');
  });

  test('ecosistema: con movimiento reducido salta a la lectura del día', async ({ page }) => {
    await reduce(page);
    await openFree(page, 'ecosistema');
    await open3D(page, byName('ecosistema'));
    await page.getByRole('button', { name: 'Simular y medir' }).click();
    await expect.poll(() => description(view(page, 'eco3d'))).toContain('Balance del día 7 según el modelo');
  });

  test('redes: sigue el año del banco y muestra la cascada al quitar una especie', async ({ page }) => {
    await openFree(page, 'redes');
    const card = await open3D(page, byName('redes'));
    const v = view(page, 'red3d');
    await expect.poll(() => description(v)).toContain('biomasa inicial, antes de simular');
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
    const d1 = await description(v);
    expect(d1).toMatch(/año \d+,\d/);
    await page.waitForTimeout(500);
    expect(await description(v)).toBe(d1);
    await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
    await expect.poll(() => description(v), { timeout: 10_000 }).toContain('año 30,0');
    await card.getByLabel('Quitar una especie (vista 3D)').selectOption('gavilanes');
    await expect.poll(() => description(v)).toContain('sin gavilanes desde el inicio');
  });

  test('descomposicion: la bolsa enterrada no se pesa hasta que el banco la pesa', async ({ page }) => {
    await reduce(page);
    await openFree(page, 'descomposicion');
    await open3D(page, byName('descomposicion'));
    const v = view(page, 'des3d');
    await expect.poll(() => description(v)).toContain('sigue enterrada; la balanza marca 0,0 g');
    await page.getByRole('button', { name: 'Pesar las bolsas' }).click();
    await expect.poll(() => description(v)).toMatch(/está en la balanza, que marca \d+,\d g de los 50 g iniciales: se dibujan \d+ trozos/);
  });

  test('agua: el oxígeno del tramo y las familias aparecen solo después de medir', async ({ page }) => {
    await reduce(page);
    await openFree(page, 'agua');
    await open3D(page, byName('agua'));
    const v = view(page, 'agu3d');
    await expect.poll(() => description(v)).toContain('Aún no hay medición');
    expect(await description(v)).not.toContain('familias');
    await page.getByRole('button', { name: 'Tomar muestra y medir' }).click();
    await expect.poll(() => description(v)).toContain('Punto crítico a');
    expect(await description(v)).toMatch(/la bandeja tiene \d+ familias de macroinvertebrados/);
  });

  test('poblacion: la pesca por encima del máximo sostenible es sobreexplotación', async ({ page }) => {
    await openFree(page, 'poblacion');
    await open3D(page, byName('poblacion'));
    const v = view(page, 'pob3d');
    await expect.poll(() => description(v)).toContain('Sin pesca, la población tiende a K = 1.000');
    await page.getByRole('slider', { name: 'Tasa de pesca h' }).fill('0.4');
    await expect.poll(() => description(v)).toContain('hay sobreexplotación');
    expect(await description(v)).toContain('máximo de 125 individuos por año con h = 0,25');
  });

  test('reto: los puntos aparecen con la recolección, quietos en pausa, y la recta al terminar', async ({ page }) => {
    await openFree(page, 'reto');
    await open3D(page, byName('reto'));
    const v = view(page, 'ret3d');
    await expect.poll(() => description(v)).toContain('Gráfico de dispersión 3D vacío');
    await page.getByRole('button', { name: 'Recolectar datos' }).click();
    await expect.poll(() => description(v)).toMatch(/[1-5] de 6 muestras/);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    const d1 = await description(v);
    await page.waitForTimeout(600);
    expect(await description(v)).toBe(d1);
    expect(d1).not.toContain('Análisis del banco');
    await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
    await expect.poll(() => description(v), { timeout: 10_000 }).toContain('Análisis del banco: pendiente');
  });

  test('metabolismo: sin flujos hasta calcular; luego los del FBA', async ({ page }) => {
    await openFree(page, 'metabolismo');
    await open3D(page, byName('metabolismo'));
    const v = view(page, 'met3d');
    await expect.poll(() => description(v)).toContain('Aún no hay flujos');
    await page.getByRole('button', { name: 'Calcular el óptimo' }).click();
    await expect.poll(() => description(v)).toContain('crecimiento μ = 0,8739 h⁻¹');
    expect(await description(v)).toMatch(/\d+ de \d+ reacciones del mapa llevan flujo/);
  });

  test('secuencias: insulina sobre 3I40 y, en ADN, la escalera', async ({ page }) => {
    await openFree(page, 'secuencias');
    await page.getByLabel('Herramienta').getByRole('button', { name: 'Alineamiento' }).click();
    await open3D(page, byName('secuencias'));
    const v = view(page, 'seq3d');
    await expect.poll(() => description(v)).toContain('aún no hay alineamiento');
    await page.getByRole('button', { name: 'Alinear', exact: true }).click();
    await expect.poll(() => description(v), { timeout: 20_000 }).toContain('estructura 3I40');
    await page.getByLabel('Comparación preparada').selectOption('hbb-hbd');
    await page.getByRole('button', { name: 'Alinear', exact: true }).click();
    await expect.poll(() => description(v), { timeout: 20_000 }).toContain('escalera del alineamiento');
  });
});

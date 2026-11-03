import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';
import { description, figureOf, pixels, view, waitEngine } from './escenas-3d-comun';

/**
 * Lote 3D-4 «electricidad, campos y partículas» (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas src/three:
 * circuitos-simples, circuitos, conductores, induccion (ley de Faraday), gases, cinetica, equilibrio (sistemas A y B) y
 * ph (titulación y dilución). Para cada vista: se abre a pedido (tarjeta cerrada que carga el código al abrir), dibuja en
 * WebGL (píxeles pintados en el lienzo) o, sin WebGL, en la vista de respaldo SVG; se gira con el teclado y «Restablecer
 * vista» devuelve la misma imagen; axe sin violaciones en tema claro y oscuro; sin desbordamiento a 390 px y sin rótulos
 * encimados. Además, la escena sigue el estado del laboratorio y la animación de cargas se pausa.
 *
 * Capturas opcionales: LOTE3D_SHOTS=/ruta npx playwright test tests/e2e/visor3d-lote4.spec.ts
 */
const SHOTS = process.env.LOTE3D_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

interface Case { name: string; id: string; prefix: string; title: RegExp; prepare?: (page: Page) => Promise<void> }
const CASES: Case[] = [
  { name: 'circuitos-simples', id: 'circuitos-simples', prefix: 'csi3d', title: /los electrones recorren el circuito/ },
  { name: 'circuitos', id: 'circuitos', prefix: 'cir3d', title: /paisaje de potencial y electrones/ },
  { name: 'conductores', id: 'conductores', prefix: 'con3d', title: /las cargas dentro de la muestra/ },
  {
    name: 'induccion', id: 'induccion', prefix: 'ind3d', title: /líneas de campo y corriente inducida/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Ley de Faraday', exact: true }).click(); },
  },
  { name: 'gases', id: 'gases', prefix: 'gas3d', title: /las partículas dentro de la jeringa/ },
  { name: 'cinetica', id: 'cinetica', prefix: 'cin3d', title: /choques, barrera de energía y gas producido/ },
  { name: 'equilibrio', id: 'equilibrio', prefix: 'equ3d', title: /los iones del tubo en equilibrio/ },
  {
    name: 'equilibrio-no2', id: 'equilibrio', prefix: 'equ3d', title: /las moléculas de NO₂ y N₂O₄/,
    prepare: async (page) => { await page.getByRole('button', { name: '2 NO₂ ⇌ N₂O₄', exact: true }).click(); },
  },
  { name: 'ph', id: 'ph', prefix: 'ph3d', title: /los iones H₃O⁺ y OH⁻ del erlenmeyer/ },
  {
    name: 'ph-dilucion', id: 'ph', prefix: 'ph3d', title: /los iones H₃O⁺ y OH⁻ al diluir/,
    prepare: async (page) => { await page.getByRole('button', { name: 'Dilución y pH', exact: true }).click(); },
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
    // Espera a que terminen las transiciones de color del tema: axe con colores a medio camino da falsos contrastes.
    await page.waitForTimeout(800);
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
      console.log(`[lote3d-4] ${c.name}: ${a.painted} píxeles pintados, ${a.colors} colores`);
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
      const back = await diffPixels(page, a.uri, (await pixels(v)).uri);
      console.log(`[lote3d-4] ${c.name}: ${back} píxeles distintos tras restablecer`);
      expect(back).toBeLessThan(0.03 * a.painted);
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

  test('circuitos-simples: el interruptor enciende el circuito y los electrones se mueven y se pausan', async ({ page }) => {
    await openFree(page, 'circuitos-simples');
    await open3D(page, byName('circuitos-simples'));
    const v = view(page, 'csi3d');
    await expect.poll(() => description(v)).toContain('El circuito está abierto');
    await page.getByRole('button', { name: 'Interruptor S1: abierto', exact: true }).click();
    await expect.poll(() => description(v)).toContain('El circuito está cerrado');
    expect(await description(v)).toMatch(/B1 brilla al \d+ % de su potencia nominal/);
    const svg = figureOf(page, 'csi3d').locator('svg').first();
    const card = page.locator('section.lote3d');
    await card.getByRole('button', { name: 'Mover los electrones' }).click();
    const s0 = await svg.innerHTML();
    await expect.poll(() => svg.innerHTML()).not.toBe(s0);
    await card.getByRole('button', { name: /^Pausar/ }).click();
    const s1 = await svg.innerHTML();
    await page.waitForTimeout(400);
    expect(await svg.innerHTML()).toBe(s1);
  });

  test('circuitos-simples: con movimiento reducido el botón de animar está desactivado', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'circuitos-simples');
    const card = await open3D(page, byName('circuitos-simples'));
    await expect(card.getByRole('button', { name: 'Mover los electrones' })).toBeDisabled();
    await expect(card.getByText(/Movimiento reducido: los electrones se muestran quietos/)).toBeVisible();
  });

  test('circuitos: la configuración y el interruptor general cambian el paisaje', async ({ page }) => {
    await openFree(page, 'circuitos');
    await open3D(page, byName('circuitos'));
    const v = view(page, 'cir3d');
    await expect.poll(() => description(v)).toContain('Circuito en serie');
    await page.getByRole('button', { name: 'Paralelo', exact: true }).click();
    await expect.poll(() => description(v)).toContain('Circuito en paralelo');
    await page.getByRole('button', { name: 'General: cerrado', exact: true }).click();
    await expect.poll(() => description(v)).toContain('El circuito está abierto');
  });

  test('conductores: al cerrar el circuito avanzan los electrones libres; el PVC los tiene ligados', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'conductores');
    await open3D(page, byName('conductores'));
    const v = view(page, 'con3d');
    await expect.poll(() => description(v)).toContain('Circuito abierto');
    await page.getByLabel('Tu predicción antes de medir').selectOption('conductor');
    await page.getByRole('button', { name: 'Cerrar el circuito y medir' }).click();
    await expect.poll(() => description(v)).toContain('los electrones avanzan hacia el caimán del polo +');
    await page.getByLabel('Muestra entre los caimanes').selectOption('pvc');
    await expect.poll(() => description(v)).toContain('ligados');
  });

  test('induccion: al introducir el imán las líneas cruzan la bobina y la fem llega a la escena', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'induccion');
    await byName('induccion').prepare!(page);
    await open3D(page, byName('induccion'));
    const v = view(page, 'ind3d');
    await expect.poll(() => description(v)).toContain('a 20,0 cm del centro');
    expect(await description(v)).toContain('ninguna cruza todavía');
    await page.getByRole('button', { name: 'Introducir el imán a velocidad constante' }).click();
    await expect.poll(() => description(v)).toContain('a 0,0 cm del centro');
    expect(await description(v)).toContain('48 de 48 cruzan la espira central');
  });

  test('gases: el émbolo y la presión siguen al modelo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'gases');
    await open3D(page, byName('gases'));
    const v = view(page, 'gas3d');
    await expect.poll(() => description(v)).toContain('el gas ocupa 100,0 mL');
    await page.getByRole('slider', { name: 'Volumen de la jeringa', exact: true }).fill('50');
    await expect.poll(() => description(v)).toContain('el gas ocupa 50,0 mL');
    expect(await description(v)).toContain('la presión debería ser 2,00 veces la inicial. El manómetro del modelo marca 2,00 veces');
  });

  test('cinetica: al terminar la reacción la jeringa tiene el gas del modelo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'cinetica');
    await open3D(page, byName('cinetica'));
    const v = view(page, 'cin3d');
    await expect.poll(() => description(v)).toContain('La reacción no ha comenzado');
    await page.getByRole('button', { name: 'Iniciar reacción y cronómetro' }).click();
    await expect.poll(() => description(v)).toContain('A los 180 s');
    const vol = (await page.locator('.readout .item').filter({ hasText: 'Volumen a 180 s' }).locator('.v').textContent())!.trim();
    expect(await description(v)).toContain(`${vol.replace(' mL', '')}`);
  });

  test('equilibrio: una gota de Fe³⁺ desplaza el equilibrio hacia los productos', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'equilibrio');
    await open3D(page, byName('equilibrio'));
    const v = view(page, 'equ3d');
    await expect.poll(() => description(v)).toContain('Reactivos y producto coexisten');
    const before = Number(/(\d+) de FeSCN²⁺/.exec(await description(v))![1]);
    await page.getByRole('button', { name: 'Agregar 1 gota de Fe³⁺' }).click();
    await expect.poll(() => description(v)).toContain('se desplazó hacia los productos');
    const after = Number(/(\d+) de FeSCN²⁺/.exec(await description(v))![1]);
    expect(after).toBeGreaterThan(before);
  });

  test('ph: la bureta cambia los iones de la escena', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFree(page, 'ph');
    await open3D(page, byName('ph'));
    const v = view(page, 'ph3d');
    await expect.poll(() => description(v)).toContain('se han añadido 0,00 mL de NaOH');
    expect(await description(v)).toContain('39 puntos rojos de H₃O⁺ y 3 azules de OH⁻');
    await page.getByRole('button', { name: '+5 mL' }).click();
    await page.getByRole('button', { name: '+5 mL' }).click();
    await page.getByRole('button', { name: '+5 mL' }).click();
    await page.getByRole('button', { name: '+5 mL' }).click();
    await page.getByRole('button', { name: '+5 mL' }).click();
    await expect.poll(() => description(v)).toContain('se han añadido 25,00 mL de NaOH');
    expect(await description(v)).toContain('(iguales: neutra)');
  });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/**
 * Lote 3D-1 (docs/v2/ANALISIS-CURRICULAR.md, §6.3): las 8 prácticas con vista 3D hecha con el kit químico y 3Dmol.
 * Para cada una: la vista se abre a pedido, dibuja en WebGL (lienzo con píxeles pintados) o, sin WebGL, en su
 * respaldo SVG; axe sin violaciones en tema claro y oscuro; sin desbordamiento horizontal a 390 px.
 *
 * Capturas opcionales: LOTE3D_SHOTS=/ruta npx playwright test tests/e2e/visor3d-lote1.spec.ts
 */
const SHOTS = process.env.LOTE3D_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

interface Case { id: string; title: RegExp; prepare?: (page: Page) => Promise<void>; protein?: boolean }
const CASES: Case[] = [
  { id: 'balanceo', title: /moléculas y conteo de átomos/ },
  { id: 'conservacion', title: /partículas dentro y fuera del sistema/ },
  { id: 'estequiometria', title: /reactivo limitante en moléculas/ },
  { id: 'mol', title: /la entidad que se cuenta/ },
  { id: 'soluciones', title: /iones y agua/ },
  { id: 'enzimas', title: /sitio activo/, protein: true },
  { id: 'expresion', title: /la proteína plegada/, protein: true },
  { id: 'rastreo', title: /la proteína del gen/, protein: true },
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
  await card.getByRole('button', { name: 'Abrir la vista 3D' }).click();
  await expect(card.getByRole('button', { name: 'Cerrar la vista 3D' })).toHaveAttribute('aria-expanded', 'true');
  await card.scrollIntoViewIfNeeded();
  return card;
}

async function noOverflow(page: Page, w: number) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o, `desbordamiento horizontal a ${w} px`).toBeLessThanOrEqual(0);
}

async function axe(page: Page, where: string) {
  // Arriba de la página: la barra fija de etapas no tapa ningún control (axe «target-size» cuenta lo que queda debajo
  // de un elemento fijo en la posición de desplazamiento actual).
  await page.evaluate(() => window.scrollTo(0, 0));
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return r.violations.map((v) => `${where} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Píxeles pintados (alfa > 0) en la imagen del lienzo de 3Dmol: el fondo es transparente. */
async function paintedPixels(card: Locator): Promise<number> {
  return card.evaluate(async (el) => {
    type V = { render: () => void; pngURI: () => string };
    const host = [...el.querySelectorAll('div')].find((d) => (d as HTMLElement & { __lv3d?: V | null }).__lv3d) as (HTMLElement & { __lv3d?: V }) | undefined;
    if (!host?.__lv3d) return -1;
    host.__lv3d.render();
    const uri = host.__lv3d.pngURI();
    const img = await new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = uri; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let k = 3; k < d.length; k += 4) if (d[k] > 30) n++;
    return n;
  });
}

// WebGL por software (SwiftShader), como tests/e2e/visores-palitos.spec.ts. El caso «sin WebGL» lo simula quitando los
// contextos webgl/webgl2 del lienzo antes de cargar la página (lo que detecta webglAvailable() del kit).
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

test.describe('con WebGL (SwiftShader)', () => {
  for (const c of CASES) {
    test(`${c.id}: la vista 3D dibuja en el lienzo, accesible en claro y oscuro, sin desbordar a 390 px`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      await openFree(page, c.id);
      const card = await open3D(page, c);
      await expect(card.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
      await expect(card.getByRole('status').filter({ hasText: /^Cargando/ })).toHaveCount(0, { timeout: 30_000 });
      await page.waitForTimeout(800);
      const px = await paintedPixels(card);
      console.log(`[lote3d] ${c.id}: ${px} píxeles pintados en el lienzo 3D`);
      expect(px, `${c.id}: lienzo 3D vacío`).toBeGreaterThan(c.protein ? 4000 : 1500);
      // Descripción textual de la escena y control por teclado del lienzo.
      const canvasHost = card.locator('[role="img"][aria-describedby]').first();
      const descId = await canvasHost.getAttribute('aria-describedby');
      expect((await page.locator(`[id="${descId}"]`).textContent())?.length ?? 0).toBeGreaterThan(40);
      await canvasHost.focus();
      await page.keyboard.press('ArrowRight');
      if (SHOTS) await card.screenshot({ path: `${SHOTS}/${c.id}-webgl-1280.png` });
      const errors: string[] = [];
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.waitForTimeout(300);
        errors.push(...(await axe(page, `${c.id} ${scheme}`)));
      }
      expect(errors).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);
      await noOverflow(page, 390);
    });
  }
});

test.describe('sin WebGL', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof orig;
    });
  });
  for (const c of CASES) {
    test(`${c.id}: sin WebGL la vista 3D usa el respaldo SVG con las mismas posiciones`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 390, height: 844 });
      await openFree(page, c.id);
      const card = await open3D(page, c);
      const svg = c.protein
        ? card.getByRole('img', { name: /traza de los carbonos alfa/ })
        : card.getByRole('img', { name: /vista de respaldo con las mismas posiciones/ }).first();
      await expect(svg).toBeVisible({ timeout: 30_000 });
      await expect(card.getByText(/este equipo no ofrece WebGL/).first()).toBeVisible();
      const marks = await svg.evaluate((s) => s.querySelectorAll('circle, line').length);
      expect(marks, `${c.id}: respaldo SVG vacío`).toBeGreaterThan(c.protein ? 50 : 3);
      // El respaldo se gira con el teclado.
      const before = await svg.screenshot();
      await svg.focus();
      await page.keyboard.press('ArrowRight');
      expect(Buffer.compare(before, await svg.screenshot())).not.toBe(0);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${c.id}-sinwebgl-390.png`, fullPage: false });
      const errors: string[] = [];
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.waitForTimeout(300);
        errors.push(...(await axe(page, `${c.id} sin WebGL ${scheme}`)));
      }
      expect(errors).toEqual([]);
      await noOverflow(page, 390);
    });
  }
});

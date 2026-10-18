import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { AXE_TAGS } from './env';
import { CATALOG } from '../../src/curriculum/catalog';
import { PUBLIC_BASE, practicePermalink } from '../../src/lib/permalink';

/** Programa v2, 8.4: el QR de cada práctica codifica su enlace permanente y abre la práctica correcta en el celular. */

const JSQR_PATH = createRequire(import.meta.url).resolve('jsqr/dist/jsQR.js');

/** Decodifica con jsQR, dentro de la página, una captura PNG (la imagen que ve el usuario). */
async function decodeInPage(page: Page, png: Buffer): Promise<string | null> {
  await page.addScriptTag({ path: JSQR_PATH });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const jsQR = (window as unknown as { jsQR: (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null }).jsQR;
    return jsQR(data.data, data.width, data.height)?.data ?? null;
  }, png.toString('base64'));
}

for (const id of ['densidad', 'calor']) {
  test(`QR de «${id}»: codifica el enlace permanente y abre la práctica en móvil`, async ({ page, browser, baseURL }) => {
    const meta = CATALOG.find((p) => p.id === id)!;
    await page.goto(`/#/practica/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: meta.title })).toBeVisible();

    const open = page.getByRole('button', { name: 'Compartir (QR)' });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Compartir la práctica' });
    await expect(dialog).toBeVisible();
    const qr = dialog.getByRole('img', { name: /Código QR que abre la práctica/ });
    await expect(qr).toHaveAttribute('aria-label', new RegExp(practicePermalink(id).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
    await expect(qr.locator('svg')).toBeVisible();
    await expect(dialog.getByText(practicePermalink(id), { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();

    // Accesibilidad del diálogo abierto.
    const axe = await new AxeBuilder({ page }).include('dialog[open]').withTags(AXE_TAGS).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // Descarga del SVG.
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Descargar QR (SVG)' }).click()]);
    expect(download.suggestedFilename()).toBe(`qr-${id}.svg`);

    // Decodificar el QR que ve el usuario (captura del elemento) con jsQR.
    const decoded = await decodeInPage(page, await qr.screenshot());
    expect(decoded).toBe(practicePermalink(id));

    // Escape cierra el diálogo y devuelve el foco al botón.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();

    // En un celular (390×844), abrir la URL decodificada en el servidor local (misma ruta hash).
    const local = decoded!.replace(PUBLIC_BASE, `${baseURL}/`);
    expect(new URL(local).hash).toBe(`#/practica/${id}`);
    const mobile = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-CO', serviceWorkers: 'block' });
    try {
      const phone = await mobile.newPage();
      await phone.goto(local);
      await expect(phone.getByRole('heading', { level: 1, name: meta.title })).toBeVisible();
      expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    } finally {
      await mobile.close();
    }
  });
}

test('el botón «Compartir (QR)» se oculta con el indicador qrPracticas apagado', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('lvcn:flags', JSON.stringify({ qrPracticas: false })));
  await page.goto('/#/practica/densidad');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver informe' }).or(page.getByRole('link', { name: 'Ver informe' }))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compartir (QR)' })).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem('lvcn:flags'));
});

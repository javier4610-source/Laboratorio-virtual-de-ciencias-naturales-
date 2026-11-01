// Utilidades de los E2E del kit de escenas 3D (src/three, docs/v2/KIT-3D.md).
import { expect, type Locator, type Page } from '@playwright/test';

/** Contenedor accesible de la escena (role="img") por su prefijo de ids. */
export const view = (page: Page, prefix: string) => page.locator(`#${prefix}-s3d`);
export const figureOf = (page: Page, prefix: string) => page.locator('figure.scene3d').filter({ has: view(page, prefix) });

/** Texto de la descripción accesible (aria-describedby) de la escena. */
export async function description(v: Locator): Promise<string> {
  return v.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? '');
}

/**
 * Dibuja la escena WebGL y cuenta sus píxeles pintados (alfa > 16; el fondo del lienzo es transparente) y los colores
 * distintos (cuantizados). Devuelve también la imagen para comparar dos estados.
 */
export async function pixels(v: Locator): Promise<{ painted: number; total: number; colors: number; uri: string }> {
  return v.evaluate(async (el) => {
    const hook = (el as HTMLElement & { __lvScene3D?: { snapshot: () => string | null } }).__lvScene3D;
    const uri = hook?.snapshot();
    if (!uri) throw new Error('la escena no tiene lienzo WebGL');
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = uri; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    const colors = new Set<number>();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 16) { painted++; colors.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)); }
    }
    return { painted, total: d.length / 4, colors: colors.size, uri };
  });
}

export async function waitEngine(page: Page, prefix: string, engine: 'disponible' | 'sin-webgl') {
  await expect(figureOf(page, prefix)).toHaveAttribute('data-engine', engine, { timeout: 20_000 });
}

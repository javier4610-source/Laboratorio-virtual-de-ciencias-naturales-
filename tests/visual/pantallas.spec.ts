import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Regresión visual (docs/v2/REGRESION-VISUAL.md): nueve pantallas representativas, cada una en los cuatro proyectos de
 * playwright.visual.config.ts (escritorio 1280×800 y móvil 390×844, tema claro y oscuro) = 36 capturas.
 *
 * Para que las capturas sean repetibles:
 * - hora fija (page.clock.setFixedTime) y Math.random con semilla fija (generador determinista inyectado antes de
 *   cargar la página; la aplicación solo lo usa para barajar el simulacro y en los sonidos, pero así no depende de eso);
 * - movimiento reducido, animaciones y transiciones desactivadas, cursor de texto oculto (tests/visual/estable.css);
 * - se espera a que carguen las tipografías (document.fonts.ready), las imágenes y las secciones diferidas;
 * - sin service worker (no hay avisos de «ya funciona sin conexión» ni de versión nueva);
 * - el visor 3D (3Dmol.js, WebGL) se bloquea para que siempre aparezca la vista de respaldo, y además se ENMASCARA:
 *   su dibujo depende de la tarjeta gráfica y del motor de WebGL disponible.
 */

const FIXED_TIME = new Date('2026-03-02T10:00:00-05:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.addInitScript(() => {
    // mulberry32 con semilla fija: la misma secuencia «aleatoria» en cada ejecución.
    let s = 0x5eed1234;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  // 3Dmol.js no se descarga: el visor usa la vista de respaldo en SVG, igual en cualquier equipo.
  await page.route(/3dmol/i, (r) => r.abort());
});

/** Espera a que la página quede quieta: tipografías, imágenes y un cuadro de animación más. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
    // Arriba del todo: así la cabecera fija queda en su sitio en la captura de página completa.
    window.scrollTo(0, 0);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

/**
 * Captura de página completa, salvo en las listas muy largas (catálogo y banco), donde basta la primera pantalla:
 * en una imagen de decenas de miles de píxeles la tolerancia del 1 % dejaría pasar cambios locales.
 */
async function shot(page: Page, name: string, { mask = [], fullPage = true }: { mask?: Locator[]; fullPage?: boolean } = {}) {
  // Nada a medio cargar (secciones diferidas: «Cargando el banco avanzado…», «Cargando el visor 3D…»).
  await expect(page.getByRole('status').filter({ hasText: /^Cargando/ })).toHaveCount(0, { timeout: 15_000 });
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage, mask });
}

async function openPractice(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

async function openGuided(page: Page) {
  await page.goto('/#/banco/avanzado');
  await expect(page.getByRole('tablist', { name: 'Modalidades de uso del banco' })).toBeVisible();
  await page.getByLabel('Ir a la pregunta').selectOption('SN-A-003');
  const card = page.locator('article.adv-item').first();
  await expect(card).toContainText('ruta de las proteínas de secreción');
  await expect(card.locator('svg').first()).toBeVisible();
  return card;
}

test('inicio', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, 'inicio');
});

test('catálogo de prácticas', async ({ page }) => {
  await page.goto('/#/catalogo');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, 'catalogo', { fullPage: false });
});

test('banco Saber 11', async ({ page }) => {
  await page.goto('/#/banco');
  await expect(page.locator('article.question').first()).toBeVisible();
  await shot(page, 'banco', { fullPage: false });
});

test('banco avanzado: pregunta guiada con gráfica (SN-A-003)', async ({ page }) => {
  await openGuided(page);
  await shot(page, 'banco-avanzado-guiada');
});

test('banco avanzado: retroalimentación de una pregunta', async ({ page }) => {
  const card = await openGuided(page);
  await card.locator('label.adv-option').first().click();
  await card.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(card.locator('.adv-feedback')).toBeVisible();
  await shot(page, 'banco-avanzado-retroalimentacion');
});

test('práctica 2D: densidad en la etapa de experimento', async ({ page }) => {
  await openPractice(page, 'densidad');
  await expect(page.getByRole('button', { name: '1. Pesar en la balanza' })).toBeVisible();
  await shot(page, 'practica-densidad-experimento');
});

test('práctica de química con visor 3D (enmascarado): geometría molecular', async ({ page }) => {
  await openPractice(page, 'geometria');
  await expect(page.getByText('Vista de respaldo:').first()).toBeVisible({ timeout: 15_000 });
  // Se enmascara el recuadro del visor (vista 3D o de respaldo): solo se compara lo que lo rodea.
  await shot(page, 'practica-geometria-experimento', { mask: [page.locator('.bench > div:first-child').first()] });
});

test('panel docente: Moodle y Classroom', async ({ page }) => {
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: 'Moodle y Classroom' }).click();
  await expect(page.getByRole('heading', { name: 'Preguntas para Moodle' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Banco avanzado tipo Saber 11' })).toBeVisible();
  await shot(page, 'docente-lms');
});

test('ayuda y accesibilidad', async ({ page }) => {
  await page.goto('/#/ayuda');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, 'ayuda');
});

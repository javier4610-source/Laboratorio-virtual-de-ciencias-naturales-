import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/**
 * Avisos de condición por modelo (rediseño, paso siguiente; ADR 0007): cada advertencia muestra su causa, su nivel
 * («Condición no válida» o «Atención») y un «Cómo corregirlo» concreto, todo dentro de UNA sola región de estado.
 * Se comprueba en cuatro prácticas, en claro y oscuro, con axe WCAG 2.2 AA y sin desbordamiento a 390 px.
 * Con AVISOS_SHOTS=<carpeta> guarda capturas claro/oscuro a 1280 y 390 px.
 */

const SHOTS = process.env.AVISOS_SHOTS ?? '';

async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

/** Escribe un valor exacto en un control deslizante (campo de texto que lo acompaña). */
async function setSlider(page: Page, label: string, unit: string, value: string) {
  const box = page.getByLabel(`${label} (valor exacto en ${unit})`, { exact: true });
  await box.fill(value);
  await box.press('Enter');
}

interface Case {
  id: string;
  /** Lleva la práctica a una condición que dispara el aviso. */
  trigger: (page: Page) => Promise<void>;
  level: 'Condición no válida' | 'Atención';
  /** Texto que debe aparecer en «Cómo corregirlo». */
  fix: RegExp;
}

const CASES: Case[] = [
  {
    id: 'gases', level: 'Condición no válida', fix: /Sube el «Volumen de la jeringa» a 40 mL o más/,
    trigger: async (page) => setSlider(page, 'Volumen de la jeringa', 'mL', '30'),
  },
  {
    id: 'enzimas', level: 'Atención', fix: /baja la «Temperatura» a 45 °C o menos/,
    trigger: async (page) => {
      await setSlider(page, 'Temperatura', '°C', '60');
      await page.getByRole('button', { name: 'Iniciar reacción' }).click();
    },
  },
  {
    id: 'densidad', level: 'Condición no válida', fix: /Hundir la muestra con un alfiler si flota/,
    trigger: async (page) => {
      await page.getByLabel('Material', { exact: true }).selectOption('corcho');
      await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
      await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
    },
  },
  {
    id: 'circuitos', level: 'Condición no válida', fix: /R equivalente \+ r debe superar 4,0 Ω/,
    trigger: async (page) => {
      await setSlider(page, 'fem de la batería (ε)', 'V', '12');
      await setSlider(page, 'Resistencia interna (r)', 'Ω', '0');
      for (const r of ['R1', 'R2', 'R3']) await setSlider(page, r, 'Ω', '1');
    },
  },
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`avisos de condición (tema ${scheme === 'light' ? 'claro' : 'oscuro'})`, () => {
    test.use({ colorScheme: scheme });

    for (const c of CASES) {
      test(`${c.id}: causa, nivel y «Cómo corregirlo» en una sola región, axe y 390 px`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await openFree(page, c.id);
        await c.trigger(page);
        const region = page.locator('.conditions');
        await expect(region).toBeVisible();
        // Una sola región de estado para todos los avisos (no una por aviso).
        await expect(region).toHaveAttribute('role', 'status');
        await expect(region.locator('[role="status"]')).toHaveCount(0);
        const alert = region.locator('.condition').filter({ hasText: c.level }).first();
        await expect(alert).toBeVisible();
        await expect(alert.locator('.condition-cause')).not.toBeEmpty();
        await expect(alert.locator('.condition-fix')).toContainText('Cómo corregirlo:');
        await expect(alert.locator('.condition-fix')).toContainText(c.fix);

        const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        const found = r.violations.map((v) => `${c.id} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(found, found.join('\n')).toEqual([]);

        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
          await region.evaluate((el) => el.scrollIntoView({ block: 'center' }));
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `desbordamiento horizontal a ${width} px`).toBeLessThanOrEqual(0);
          const box = await region.boundingBox();
          expect(box && box.x >= 0 && box.x + box.width <= width + 1, `el aviso cabe a ${width} px`).toBeTruthy();
          if (SHOTS) {
            await page.screenshot({ path: `${SHOTS}/${c.id}-${scheme === 'light' ? 'claro' : 'oscuro'}-${width}.png` });
          }
        }
      });
    }
  });
}

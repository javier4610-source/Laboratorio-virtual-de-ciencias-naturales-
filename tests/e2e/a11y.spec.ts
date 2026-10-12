import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PRACTICES = ['densidad', 'osmosis', 'mitosis', 'mendel', 'ondas', 'adn', 'soluciones', 'enzimas', 'fotosintesis', 'circuitos', 'estequiometria', 'ph', 'poblacion', 'popgen', 'mezclas', 'optica', 'newton', 'gases', 'energia', 'celulas', 'redes', 'seleccion', 'cinematica', 'cinetica', 'conductores', 'descomposicion', 'equilibrio', 'proyectiles', 'pendulo'];

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => `${label} · ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  return summary;
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accesibilidad WCAG 2.1 AA (tema ${scheme === 'light' ? 'claro' : 'oscuro'})`, () => {
    test.use({ colorScheme: scheme });

    test('páginas generales', async ({ page }) => {
      const found: string[] = [];
      for (const route of ['/', '/#/catalogo', '/#/grado/8', '/#/banco', '/#/ayuda', '/#/docente']) {
        await page.goto(route);
        await page.waitForTimeout(400);
        found.push(...(await audit(page, route)));
      }
      for (const tab of ['Validación curricular', 'Asignaciones', 'Listas por unidad', 'Informes', 'Servidor', 'Rúbrica']) {
        await page.getByRole('tab', { name: new RegExp(tab) }).click();
        found.push(...(await audit(page, `docente/${tab}`)));
      }
      expect(found, found.join('\n')).toEqual([]);
    });

    test('todas las prácticas en sus etapas', async ({ page }) => {
      test.setTimeout(300_000);
      const found: string[] = [];
      for (const id of PRACTICES) {
        await page.goto(`/#/practica/${id}`);
        await page.getByRole('button', { name: 'Exploración libre' }).click();
        found.push(...(await audit(page, `${id}/preparación`)));
        await page.getByRole('tab', { name: /Experimento/ }).click();
        await page.waitForTimeout(400);
        found.push(...(await audit(page, `${id}/experimento`)));
        await page.getByRole('tab', { name: /Evaluación/ }).click();
        found.push(...(await audit(page, `${id}/evaluación`)));
      }
      await page.goto('/#/practica/densidad/informe');
      found.push(...(await audit(page, 'informe')));
      expect(found, found.join('\n')).toEqual([]);
    });
  });
}

import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/**
 * Panel docente → «Moodle y Classroom»: descarga del Moodle XML filtrado por práctica (bien formado según el
 * DOMParser del navegador, una opción correcta por pregunta), enlace oficial de Classroom, CSV de enlaces,
 * accesibilidad (axe) y sin desborde a 390 px en ambos temas. Con SCREENSHOTS=carpeta guarda capturas.
 */
const SHOTS = process.env.SCREENSHOTS;

async function openTab(page: Page) {
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: 'Moodle y Classroom' }).click();
  await expect(page.getByRole('heading', { name: 'Preguntas para Moodle' })).toBeVisible();
}

test('Moodle XML de una práctica: bien formado, con la opción correcta marcada y la retroalimentación', async ({ page }) => {
  await openTab(page);
  const moodle = page.getByRole('region', { name: 'Preguntas para Moodle' });
  await moodle.getByLabel('Grado').selectOption('6');
  await moodle.getByLabel('Práctica').selectOption('densidad');
  const count = Number(await moodle.locator('.lms-count strong').textContent());
  expect(count).toBeGreaterThan(3);

  const [download] = await Promise.all([page.waitForEvent('download'), moodle.getByRole('button', { name: 'Descargar Moodle XML' }).click()]);
  expect(download.suggestedFilename()).toBe('lvcn-densidad-moodle.xml');
  const xml = await readFile((await download.path())!, 'utf8');
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(xml).toContain('<idnumber>saber-den-1</idnumber>');
  expect(xml).toContain('Medición de masa, volumen y densidad'); // tildes en UTF-8
  await expect(moodle.getByRole('status')).toContainText(`${count} preguntas`);

  const parsed = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const qs = [...doc.querySelectorAll('quiz > question[type="multichoice"]')];
    return {
      error: doc.querySelector('parsererror')?.textContent ?? null,
      root: doc.documentElement.nodeName,
      n: qs.length,
      correctPerQuestion: qs.map((q) => q.querySelectorAll(':scope > answer[fraction="100"]').length),
      withFeedback: qs.every((q) => [...q.querySelectorAll(':scope > answer')].every((a) => (a.querySelector('feedback > text')?.textContent ?? '').length > 0)),
      general: qs.every((q) => (q.querySelector('generalfeedback > text')?.textContent ?? '').includes('#/practica/densidad')),
      categories: [...doc.querySelectorAll('quiz > question[type="category"] category > text')].map((t) => t.textContent),
    };
  }, xml);
  expect(parsed.error).toBeNull();
  expect(parsed.root).toBe('quiz');
  expect(parsed.n).toBe(count);
  expect(parsed.correctPerQuestion.every((c) => c === 1)).toBe(true);
  expect(parsed.withFeedback).toBe(true);
  expect(parsed.general).toBe(true);
  expect(parsed.categories.every((c) => c?.startsWith('$course$/top/Laboratorio Virtual de Ciencias Naturales/'))).toBe(true);

  const [gift] = await Promise.all([page.waitForEvent('download'), moodle.getByRole('button', { name: 'Descargar GIFT' }).click()]);
  const giftText = await readFile((await gift.path())!, 'utf8');
  expect(giftText).toContain('$CATEGORY: $course$/top/');
  expect((giftText.match(/^::/gm) ?? []).length).toBe(count);
});

test('Classroom: enlace oficial de compartir, texto de la tarea y CSV de enlaces por grado', async ({ page }) => {
  await openTab(page);
  const cr = page.getByRole('region', { name: 'Google Classroom' });
  await cr.getByLabel('Práctica').selectOption('osmosis');
  await cr.getByLabel('Curso (opcional)').fill('7-2');
  const link = cr.getByRole('link', { name: /Compartir en Classroom/ });
  const hrefValue = (await link.getAttribute('href'))!;
  const u = new URL(hrefValue);
  expect(u.origin + u.pathname).toBe('https://classroom.google.com/share');
  expect(u.searchParams.get('url')).toBe('https://javier4610-source.github.io/Laboratorio-virtual-de-ciencias-naturales-/#/practica/osmosis');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(cr.getByLabel(/Texto de la tarea/)).toHaveValue(/Curso: 7-2/);

  const [txt] = await Promise.all([page.waitForEvent('download'), cr.getByRole('button', { name: 'Descargar texto de la tarea' }).click()]);
  expect(txt.suggestedFilename()).toBe('tarea-osmosis.txt');
  expect(await readFile((await txt.path())!, 'utf8')).toContain('#/practica/osmosis');

  await cr.getByLabel('Grado de la tabla').selectOption('8');
  const [csv] = await Promise.all([page.waitForEvent('download'), cr.getByRole('button', { name: 'Descargar enlaces (CSV)' }).click()]);
  expect(csv.suggestedFilename()).toBe('lvcn-enlaces-grado-8.csv');
  const lines = (await readFile((await csv.path())!, 'utf8')).replace(/^﻿/, '').trim().split('\n');
  expect(lines[0]).toContain('Compartir en Classroom');
  expect(lines.slice(1).every((l) => l.startsWith('8;'))).toBe(true);
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`tema ${scheme === 'light' ? 'claro' : 'oscuro'}`, () => {
  test.use({ colorScheme: scheme });
  test('«Moodle y Classroom» accesible y sin desborde', async ({ page }) => {
    const found: string[] = [];
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openTab(page);
      await page.getByText('Ver las preguntas seleccionadas').click();
      await page.getByText('Cómo publicarlo paso a paso').click();
      await page.waitForTimeout(300);
      const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      found.push(...res.violations.map((v) => `${width} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `desborde a ${width}px`).toBeLessThanOrEqual(0);
      if (SHOTS) {
        await page.getByText('Ver las preguntas seleccionadas').click(); // cerrar la lista larga para la captura
        await page.screenshot({ path: `${SHOTS}/exportar-lms-${scheme}-${width}.png`, fullPage: true });
      }
    }
    expect(found, found.join('\n')).toEqual([]);
  });
  });
}

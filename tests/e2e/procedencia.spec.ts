import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

/** Programa v2 · Fase 2: procedencia visible y registro reproducible (exportar, borrar, importar y recuperar). */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('procedencia visible y registro del experimento: exportar e importar reproduce los ensayos', async ({ page }) => {
  await page.goto('/#/practica/movimiento');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();

  const strip = page.getByRole('note', { name: 'Procedencia de los resultados' });
  await expect(strip).toContainText('Lecturas y datos: Modelo calculado');
  await expect(strip).toContainText('Escena: Ilustración educativa');
  await expect(strip).toContainText('no son mediciones reales');

  await expect(page.getByRole('button', { name: 'Exportar registro (JSON)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Acelerada ×4' }).click();
  await page.getByRole('button', { name: 'Dar la salida' }).click();
  await expect(page.locator('.readout').getByText('4,44 s')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await expect(page.locator('#cuaderno')).toContainText('Datos: Modelo calculado');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar registro (JSON)' }).click(),
  ]);
  const path = await download.path();
  const rec = JSON.parse((await readFile(path!, 'utf8')).replace(/^﻿/, ''));
  expect(rec.formato).toBe('lvcn-registro-experimento/1');
  expect(rec.practica.id).toBe('movimiento');
  expect(rec.procedencia.datos).toBe('Modelo calculado');
  expect(rec.conjuntos[0].ensayos).toHaveLength(1);
  expect(rec.conjuntos[0].ensayos[0].estatus).toBe('Modelo calculado');
  await expect(page.getByText(/Registro descargado \(1 ensayo, versión \d+\.\d+\.\d+\)/)).toBeVisible();

  // Se borra la tabla y se recupera el ensayo importando el registro.
  await page.getByRole('button', { name: 'Borrar tabla' }).click();
  await page.getByRole('button', { name: /Sí|Confirmar|Borrar/ }).last().click();
  await expect(page.getByRole('button', { name: 'Exportar registro (JSON)' })).toBeDisabled();
  await page.getByLabel('Archivo de registro del experimento').setInputFiles(path!);
  await expect(page.getByText('Se agregó 1 ensayo del registro.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar registro (JSON)' })).toBeEnabled();

  // Un archivo de otra práctica se rechaza con un mensaje claro.
  await page.getByLabel('Archivo de registro del experimento').setInputFiles({ name: 'otro.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...rec, practica: { ...rec.practica, id: 'densidad', titulo: 'Densidad' } })) });
  await expect(page.getByText('El registro es de otra práctica («Densidad»).')).toBeVisible();
});

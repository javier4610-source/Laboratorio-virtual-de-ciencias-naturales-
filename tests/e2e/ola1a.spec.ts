import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';

/**
 * Ola 1a de prácticas nuevas (modelos-atomicos, tabla-periodica, enlace-quimico, electrostatica): flujo de cada
 * práctica, valor dorado visible en la interfaz, guardar ensayos, axe en claro y oscuro y sin desbordamiento a 390 px.
 * Las vistas 3D con y sin WebGL están en ola1a-3d-webgl.spec.ts y ola1a-3d-sin-webgl.spec.ts.
 */
const ro = (page: Page, k: string) => page.locator('.readout .item').filter({ hasText: k });
const setSlider = async (page: Page, label: string, unit: string, v: string) => {
  const f = page.getByLabel(`${label} (valor exacto en ${unit})`);
  await f.fill(v);
  await f.press('Enter');
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

async function a11yAndMobile(page: Page, id: string) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(150);
    expect(await axe(page, `${id} (${scheme})`)).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await noOverflow(page, 390);
}

test('modelos-atomicos: conteo con el detector, Thomson ≈ 0, gráfica y línea Hα del NIST', async ({ page }) => {
  await openFree(page, 'modelos-atomicos');
  // Valor dorado: oro, 5 MeV → d = 45,5 fm; rebota > 90° 1 de cada ~26 000.
  await expect(ro(page, 'Distancia de máximo acercamiento d')).toContainText('45,5 fm');
  await expect(ro(page, 'Thomson predice (por minuto)')).toContainText('≈ 0');
  const save = page.getByRole('button', { name: 'Guardar ensayo en la tabla' });
  await expect(save).toBeDisabled();
  await setSlider(page, 'Ángulo del detector', '°', '90');
  await setSlider(page, 'Tiempo de conteo', 's', '10');
  const sim = page.getByRole('group', { name: 'Detector de centelleo', exact: true });
  await sim.getByRole('button', { name: 'Contar centelleos' }).click();
  await expect(sim.getByRole('status')).toHaveText(/Terminad/, { timeout: 15_000 });
  await expect(ro(page, 'Centelleos por minuto')).not.toContainText('—');
  await save.click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await expect(page.locator('#ato-g-d')).toContainText('1 conteos guardados');
  // Estación de Bohr: 3 → 2 = 656,3 nm (NIST 656,279 nm en aire).
  await page.getByRole('button', { name: '2. Átomo de Bohr y espectro' }).click();
  await page.getByRole('button', { name: 'Emitir el fotón' }).click();
  await expect(ro(page, 'Longitud de onda (aire)')).toContainText('656,3 nm');
  await expect(ro(page, 'Línea medida (NIST)')).toContainText('656,3 nm');
  await expect(ro(page, 'Región y color')).toContainText('rojo');
  // Idea errónea con retroalimentación.
  await page.getByRole('group', { name: /Tu respuesta: Si el átomo fuera como lo imaginó Thomson/ }).getByRole('button', { name: 'Es falso' }).click();
  await expect(page.getByText(/Bien\. La idea es falsa\. En el átomo de Thomson/)).toBeVisible();
  await a11yAndMobile(page, 'modelos-atomicos');
});

test('modelos-atomicos: aviso de la fuerza nuclear con su corrección', async ({ page }) => {
  await openFree(page, 'modelos-atomicos');
  await page.getByLabel('Lámina metálica', { exact: true }).selectOption('aluminio');
  await setSlider(page, 'Energía de las alfas', 'MeV', '9');
  const alert = page.locator('.condition').filter({ hasText: 'el núcleo deja de ser un punto con carga' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Cómo corregirlo');
  await setSlider(page, 'Energía de las alfas', 'MeV', '5');
  await expect(alert).toHaveCount(0);
});

test('tabla-periodica: datos reales, Slater del Na, teclado en la tabla y tendencia del período 3', async ({ page }) => {
  await openFree(page, 'tabla-periodica');
  await expect(ro(page, 'Electronegatividad (Pauling)')).toContainText('0,93');
  await expect(ro(page, '1.ª energía de ionización')).toContainText('5,139 eV');
  await expect(ro(page, 'Z efectiva (Slater)')).toContainText('2,20');
  await expect(page.getByText(/Z_ef = 11 − \(0 × 0,35 \+ 8 × 0,85 \+ 2 × 1,00\) = 2,20/)).toBeVisible();
  // Flechas del teclado: del Na a la derecha → Mg; abajo → Ca.
  const na = page.locator('button[data-sym="Na"]');
  await na.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('button[data-sym="Mg"]')).toBeFocused();
  await expect(page.locator('button[data-sym="Mg"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('button[data-sym="Ca"]')).toBeFocused();
  await page.locator('button[data-sym="Cl"]').click();
  await expect(ro(page, 'Z efectiva (Slater)')).toContainText('6,10');
  await expect(page.locator('figcaption').filter({ hasText: 'Tendencia en tus datos reales' })).toContainText('disminuye');
  await page.getByLabel('Propiedad que se muestra').selectOption('ei');
  await expect(page.locator('figcaption').filter({ hasText: 'Tendencia en tus datos reales' })).toContainText('Mg → Al, P → S');
  await page.getByRole('button', { name: 'Guardar el elemento en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  // Sin dato: no se inventa.
  await page.locator('button[data-sym="He"]').click();
  await page.getByLabel('Propiedad que se muestra').selectOption('en');
  await expect(page.locator('.condition').filter({ hasText: 'He no tiene dato de electronegatividad' })).toBeVisible();
  await a11yAndMobile(page, 'tabla-periodica');
});

test('enlace-quimico: ΔEN del NaCl, Lewis y polaridad, pruebas de las sustancias', async ({ page }) => {
  await openFree(page, 'enlace-quimico');
  await expect(ro(page, 'Diferencia ΔEN')).toContainText('2,23');
  await expect(ro(page, 'Tipo de enlace (criterio orientativo)')).toContainText('iónico');
  await expect(ro(page, 'Carácter iónico (Pauling)')).toContainText('71 %');
  await page.getByLabel('Elemento A').selectOption('H');
  await page.getByLabel('Elemento B').selectOption('F');
  await expect(ro(page, 'Tipo de enlace (criterio orientativo)')).toContainText('covalente polar');
  await page.getByRole('button', { name: 'Guardar el par en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();

  await page.getByRole('button', { name: '2. Moléculas y Lewis' }).click();
  await page.getByLabel('Molécula', { exact: true }).selectOption('co2');
  await expect(ro(page, 'Electrones de valencia (suma)')).toContainText('16');
  await expect(ro(page, 'La molécula es')).toContainText('no polar');
  await page.getByLabel('Molécula', { exact: true }).selectOption('h2o');
  await expect(ro(page, 'La molécula es')).toContainText('polar (dipolo');

  await page.getByRole('button', { name: '3. Propiedades' }).click();
  for (const t of ['Calentar en la placa (hasta 300 °C)', 'Agitar 1 g en 10 mL de agua', 'Conductímetro en el sólido', 'Conductímetro en la mezcla con agua']) {
    await page.getByRole('button', { name: t }).click();
  }
  await expect(page.getByText('El LED se enciende: la disolución conduce (hay iones que se mueven).')).toBeVisible();
  await expect(ro(page, 'Punto de fusión')).toContainText('800,7 °C');
  await page.getByLabel('Según tus pruebas, la sustancia está formada por…').selectOption('red iónica');
  await expect(page.getByText(/Correcto\. Los iones Na⁺ y Cl⁻ están fijos/)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar la sustancia en la tabla' }).click();
  await a11yAndMobile(page, 'enlace-quimico');
});

test('electrostatica: caso de referencia 0,599 N, aviso del dinamómetro y campo del dipolo', async ({ page }) => {
  await openFree(page, 'electrostatica');
  await page.getByRole('button', { name: 'Medir la fuerza' }).click();
  await expect(ro(page, 'Fuerza en el dinamómetro')).toContainText('0,599 N');
  await expect(ro(page, 'Tipo de interacción')).toContainText('atracción');
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  // Inverso del cuadrado: a 60 cm no cabe en el riel (máx. 50); a 15 cm la fuerza es 4 veces la de 30 cm.
  await setSlider(page, 'Distancia entre centros', 'cm', '15');
  await page.getByRole('button', { name: 'Medir la fuerza' }).click();
  await expect(ro(page, 'Fuerza en el dinamómetro')).toContainText('2,397 N');
  // Fuera de escala → aviso no válido con su corrección.
  await setSlider(page, 'Carga q₁', 'µC', '10');
  await setSlider(page, 'Carga q₂', 'µC', '10');
  await setSlider(page, 'Distancia entre centros', 'cm', '5');
  const alert = page.locator('.condition').filter({ hasText: 'supera el alcance del dinamómetro' });
  await expect(alert).toContainText('Cómo corregirlo: Aleja las esferas a 21,5 cm o más');

  await page.getByRole('button', { name: '2. Campo y potencial' }).click();
  await page.getByLabel('Configuración de cargas').selectOption('iguales');
  await setSlider(page, 'Posición y de la carga de prueba', 'cm', '0');
  await expect(ro(page, 'Campo eléctrico E')).toContainText('0,00 kN/C');
  await expect(ro(page, 'Potencial V')).toContainText('359,60 kV');
  await a11yAndMobile(page, 'electrostatica');
});

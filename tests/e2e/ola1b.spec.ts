import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';

/**
 * Ola 1b de prácticas nuevas (configuracion-electronica, pila-electroquimica, meiosis, sistema-nervioso,
 * sistema-circulatorio): flujo de cada práctica, valor dorado visible en la interfaz, avisos con su corrección, guardar
 * ensayos, axe en claro y oscuro y sin desbordamiento a 390 px. Las vistas 3D están en ola1b-3d-webgl.spec.ts y
 * ola1b-3d-sin-webgl.spec.ts.
 */
const ro = (page: Page, k: string) => page.locator('.readout .item').filter({ hasText: k });
const setSlider = async (page: Page, label: string, unit: string, v: string) => {
  const f = page.getByLabel(`${label} (valor exacto${unit ? ` en ${unit}` : ''})`);
  await f.fill(v);
  await f.press('Enter');
};
const saved = (page: Page, n: number) => expect(page.getByText(`Ensayo guardado (${n} en esta sesión).`)).toBeVisible();

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

test('configuracion-electronica: llenado del hierro, excepción del cromo y aviso de Pauli', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'configuracion-electronica');
  await page.getByLabel('Elemento (Z = 1 a 54)').selectOption('26');
  const sim = page.getByRole('group', { name: 'Llenado electrón por electrón', exact: true });
  await sim.getByRole('button', { name: 'Llenar paso a paso' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada', { timeout: 25_000 });
  // Valor dorado: Fe = [Ar] 4s² 3d⁶, 4 desapareados, período 4, grupo 8.
  await expect(ro(page, 'Tu configuración')).toContainText('1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶');
  await expect(ro(page, 'Notación abreviada')).toContainText('[Ar] 4s² 3d⁶');
  await expect(ro(page, 'Electrones desapareados')).toContainText('4 (paramagnético)');
  await expect(ro(page, 'Período, grupo y bloque')).toContainText('período 4, grupo 8, bloque d');
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await saved(page, 1);

  // Cromo: con movimiento reducido el llenado salta al final; el dato medido no sigue la regla.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByLabel('Elemento (Z = 1 a 54)').selectOption('24');
  await sim.getByRole('button', { name: 'Llenar paso a paso' }).click();
  await expect(ro(page, 'Notación abreviada')).toContainText('[Ar] 4s² 3d⁴');
  await page.getByRole('button', { name: 'Comparar con el dato medido' }).click();
  await expect(ro(page, 'Estado fundamental medido (PubChem)')).toContainText('[Ar] 4s¹ 3d⁵');
  await expect(ro(page, '¿Coinciden?')).toContainText('no: es una excepción');
  // Mover un electrón del 4s al 3d vacío.
  await page.getByRole('group', { name: 'Herramienta' }).getByRole('button', { name: 'Quitar' }).click();
  await page.locator('button[data-box="4s0"]').click();
  await page.getByRole('group', { name: 'Herramienta' }).getByRole('button', { name: 'Agregar ↑' }).click();
  await page.locator('button[data-box="3d4"]').click();
  await expect(page.getByText(/coincide con el estado fundamental MEDIDO del cromo/)).toBeVisible();
  await expect(ro(page, 'Electrones desapareados')).toContainText('6');
  // Pauli: dos ↑ en el mismo orbital.
  await page.locator('button[data-box="4s0"]').click();
  const pauli = page.locator('.condition').filter({ hasText: 'principio de exclusión de Pauli' });
  await expect(pauli).toContainText('Cómo corregirlo');
  await page.getByRole('group', { name: /Tu respuesta: Con la regla de las diagonales/ }).getByRole('button', { name: 'Es falso' }).click();
  await expect(page.getByText(/Bien\. La idea es falsa\./)).toBeVisible();
  await a11yAndMobile(page, 'configuracion-electronica');
});

test('pila-electroquimica: Daniell 1,104 V, Nernst, puente salino y Faraday con la balanza', async ({ page }) => {
  await openFree(page, 'pila-electroquimica');
  await page.getByRole('button', { name: 'Medir el voltaje' }).click();
  await expect(ro(page, 'Voltímetro (circuito abierto)')).toContainText('1,104 V');
  await expect(ro(page, 'Reacción global')).toContainText('Zn(s) + Cu²⁺(ac) → Zn²⁺(ac) + Cu(s)');
  await page.getByRole('button', { name: 'Guardar el voltaje en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Concentración de Cu²⁺ (derecha)', 'mol/L', '0,01');
  await page.getByRole('button', { name: 'Medir el voltaje' }).click();
  await expect(ro(page, 'Voltímetro (circuito abierto)')).toContainText('1,045 V');
  await page.getByRole('group', { name: 'Puente salino' }).getByRole('button', { name: 'Ninguno' }).click();
  const open = page.locator('.condition').filter({ hasText: 'Sin puente salino' });
  await expect(open).toContainText('Cómo corregirlo: Coloca el puente salino de KNO₃');
  await page.getByRole('group', { name: 'Puente salino' }).getByRole('button', { name: 'KNO₃' }).click();
  await expect(open).toHaveCount(0);
  await setSlider(page, 'Concentración de Cu²⁺ (derecha)', 'mol/L', '1');
  // Faraday: 50 mA durante 120 min (valores iniciales); con movimiento reducido la descarga salta al final.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Pila conectada a la carga', exact: true });
  await sim.getByRole('button', { name: 'Conectar la carga' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada');
  await page.getByRole('button', { name: 'Lavar, secar y pesar los electrodos' }).click();
  await expect(ro(page, 'Masa del electrodo de cinc')).toContainText('7,012 g (antes 7,134 g)');
  await expect(ro(page, 'Masa del electrodo de cobre')).toContainText('9,052 g (antes 8,933 g)');
  await expect(ro(page, 'Carga Q = I·t')).toContainText('360,0 C');
  await page.getByRole('button', { name: 'Guardar la descarga en la tabla' }).click();
  await saved(page, 2);
  await a11yAndMobile(page, 'pila-electroquimica');
});

test('meiosis: etapas hasta los gametos, recombinantes, 2²³ y no disyunción', async ({ page }) => {
  await openFree(page, 'meiosis');
  await expect(ro(page, 'ADN por célula')).toContainText('2c');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Etapa siguiente' }).click();
  await expect(ro(page, 'Cromosomas por célula')).toContainText('2 (n)');
  await expect(ro(page, 'Cromátidas por célula')).toContainText('4');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Etapa siguiente' }).click();
  await expect(ro(page, 'Células')).toContainText('4');
  await expect(ro(page, 'ADN por célula')).toContainText('1c');
  const table = page.getByRole('region', { name: 'Gametos de esta meiosis' });
  await expect(table.getByRole('row')).toHaveCount(5);
  await expect(table.getByRole('row', { name: /Ab D/ })).toContainText('recombinante');
  await page.getByRole('button', { name: 'Guardar la etapa en la tabla' }).click();
  await saved(page, 1);
  await page.getByLabel('No disyunción en el par 1').selectOption('meiosis1');
  await expect(page.locator('.condition').filter({ hasText: 'trisomía' })).toContainText('Cómo corregirlo');
  await expect(table).toContainText('(n + 1)');
  await page.getByLabel('No disyunción en el par 1').selectOption('ninguna');

  await page.getByRole('button', { name: '2. Variabilidad de los gametos' }).click();
  await expect(ro(page, 'Combinaciones con n = 23 pares (2ⁿ)')).toContainText(/8.388.608/);
  await page.getByRole('button', { name: 'Simular las meiosis' }).click();
  await expect(ro(page, 'Gametos recombinantes (Ab + aB)')).toContainText('%');
  await expect(ro(page, 'Esperado (d/100)')).toContainText('20 %');
  await page.getByRole('button', { name: 'Guardar la muestra en la tabla' }).click();
  await saved(page, 2);
  await a11yAndMobile(page, 'meiosis');
});

test('sistema-nervioso: tiempo de reacción con dato propio, avisos de la regla y potencial de acción todo o nada', async ({ page }) => {
  await openFree(page, 'sistema-nervioso');
  await setSlider(page, 'Distancia a la que atrapaste la regla', 'cm', '23,7');
  await expect(ro(page, 'Tiempo de reacción t = √(2d/g)')).toContainText('0,220 s');
  await expect(ro(page, 'Distancia de caída d')).toContainText('dato tuyo');
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Distancia a la que atrapaste la regla', 'cm', '3');
  await expect(page.locator('.condition').filter({ hasText: 'anticipado' })).toContainText('Cómo corregirlo');
  await setSlider(page, 'Distancia a la que atrapaste la regla', 'cm', '32');
  await expect(page.locator('.condition').filter({ hasText: 'se te escapó' })).toBeVisible();
  await page.getByRole('button', { name: 'Ensayo de ejemplo (modelo)' }).click();
  await expect(ro(page, 'Distancia de caída d')).toContainText('dato de ejemplo');

  await page.getByRole('button', { name: '2. Impulso nervioso y reflejo' }).click();
  await setSlider(page, 'Despolarización del estímulo', 'mV', '10');
  await expect(ro(page, '¿Se dispara el potencial de acción?')).toContainText('no');
  await expect(page.locator('.condition').filter({ hasText: 'no hay potencial de acción' })).toContainText('Cómo corregirlo');
  await setSlider(page, 'Despolarización del estímulo', 'mV', '35');
  await expect(ro(page, 'Pico')).toContainText('30,0 mV');
  await page.getByLabel('Tipo de fibra (sensitiva)').selectOption('ad');
  await expect(ro(page, 'Arco reflejo (ida + 3 sinapsis + vuelta)')).toContainText('66,3 ms');
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await saved(page, 2);
  await a11yAndMobile(page, 'sistema-nervioso');
});

test('sistema-circulatorio: gasto cardíaco de referencia, ejercicio, aviso prudente y latidos contados', async ({ page }) => {
  await openFree(page, 'sistema-circulatorio');
  await page.getByRole('button', { name: 'Medir pulso y presión' }).click();
  await expect(ro(page, 'Frecuencia cardíaca (pulsioxímetro)')).toContainText('72 lpm');
  await expect(ro(page, 'Gasto cardíaco = FC × VS')).toContainText('5,04 L/min');
  await expect(ro(page, 'FC máxima estimada')).toContainText('197,5 lpm');
  await page.getByRole('button', { name: 'Guardar ensayo en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Intensidad del ejercicio', '%', '50');
  await page.getByRole('button', { name: 'Medir pulso y presión' }).click();
  await expect(ro(page, 'Frecuencia cardíaca (pulsioxímetro)')).toContainText('135 lpm');
  await setSlider(page, 'Intensidad del ejercicio', '%', '90');
  await expect(page.locator('.condition').filter({ hasText: 'esfuerzo fuerte' })).toContainText('avisa al docente');
  await setSlider(page, 'Intensidad del ejercicio', '%', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Latido y medición del pulso', exact: true });
  await sim.getByRole('button', { name: 'Hacer latir y contar 15 s' }).click();
  await expect(ro(page, 'Latidos contados')).toContainText('18 en 15,0 s → 72 lpm');
  await setSlider(page, 'Latidos contados en 15 s', '', '20');
  await page.getByRole('button', { name: 'Guardar mi pulso en la tabla' }).click();
  await saved(page, 2);
  await a11yAndMobile(page, 'sistema-circulatorio');
});

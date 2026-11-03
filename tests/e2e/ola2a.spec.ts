import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';

/**
 * Ola 2a de prácticas nuevas (estados-de-la-materia, cambios-quimicos, movimiento-circular, lentes, magnetismo-imanes):
 * flujo de cada práctica, valor dorado visible en la interfaz, avisos con su corrección, guardar ensayos, ideas
 * erróneas, axe en claro y oscuro (esperando 800 ms a que terminen las transiciones del tema) y sin desbordamiento a
 * 390 px. Las vistas 3D están en ola2a-3d-webgl.spec.ts y ola2a-3d-sin-webgl.spec.ts.
 */
const ro = (page: Page, k: string) => page.locator('.readout .item').filter({ has: page.locator('.k', { hasText: k }) });
const setSlider = async (page: Page, label: string, unit: string, v: string) => {
  const f = page.getByLabel(`${label} (valor exacto${unit ? ` en ${unit}` : ''})`);
  await f.fill(v);
  await f.press('Enter');
};
const saved = (page: Page, n: number) => expect(page.getByText(`Ensayo guardado (${n} en esta sesión).`).last()).toBeVisible();
const cond = (page: Page, text: string | RegExp) => page.locator('.condition').filter({ hasText: text });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

async function a11yAndMobile(page: Page, id: string) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(800);
    // Arriba de la página: la barra fija de etapas no tapa controles (axe «target-size» mira la posición actual).
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await axe(page, `${id} (${scheme})`)).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await noOverflow(page, 390);
}

test('estados-de-la-materia: curva con dos mesetas, calores latentes, ebullición en Bogotá y avisos', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'estados-de-la-materia');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Calentamiento del agua', exact: true });
  await sim.getByRole('button', { name: 'Calentar' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada');
  await expect(ro(page, 'Termómetro')).toContainText('110,0 °C');
  await expect(ro(page, 'Ebullición en este lugar')).toContainText('99,9 °C a 1.009,7 hPa');
  // Valor dorado: mesetas de 133,6 s y 902,4 s (cronómetro de 1 s) → 335 y 2255 J/g.
  await expect(ro(page, 'Meseta de fusión (cronómetro)')).toContainText('134 s → L_f = P·Δt/m = 335 J/g');
  await expect(ro(page, 'Meseta de ebullición (cronómetro)')).toContainText('902 s → L_v = P·Δt/m = 2.255 J/g');
  await page.getByRole('button', { name: 'Medir y guardar las mesetas' }).click();
  await expect(page.getByText('Mesetas guardadas en la tabla «Mesetas de la curva».')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar el punto de la curva' }).click();
  await expect(page.getByText(/Ensayo guardado \(\d+ en esta sesión\)\./).last()).toBeVisible();
  await expect(cond(page, 'recipiente cerrado')).toContainText('Cómo corregirlo');
  await page.getByLabel('Lugar').selectOption('bogota');
  await expect(ro(page, 'Ebullición en este lugar')).toContainText('91,2 °C');
  await setSlider(page, 'Temperatura inicial', '°C', '20');
  await expect(cond(page, 'no tiene la meseta de la fusión')).toContainText('Cómo corregirlo');
  await page.getByRole('group', { name: /Tu respuesta: Mientras el hielo se derrite/ }).getByRole('button', { name: 'Es falso' }).click();
  await expect(page.getByText(/Bien\. La idea es falsa\./)).toBeVisible();
  await a11yAndMobile(page, 'estados-de-la-materia');
});

test('cambios-quimicos: CO₂ del globo, enfriamiento, clasificación y burbujas que no son reacción', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'cambios-quimicos');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Observación del proceso', exact: true });
  await sim.getByRole('button', { name: 'Iniciar el proceso' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada');
  // Valor dorado: 2,0 g de NaHCO₃ → 23,8 mmol de CO₂; 549 mL en el globo a 28 °C; la mezcla se enfría 3,4 °C.
  await expect(ro(page, 'Volumen de CO₂ en el globo (28 °C)')).toContainText('549 mL');
  await expect(ro(page, 'Termómetro de la mezcla')).toContainText('24,6 °C');
  await expect(ro(page, 'Cambio de temperatura')).toContainText('se enfría 3,4 °C');
  await expect(page.getByLabel(/Ecuación: NaHCO₃ \+ C₂H₄O₂/)).toBeVisible();
  await page.getByRole('group', { name: '¿Qué tipo de cambio es?' }).getByRole('button', { name: 'Cambio químico' }).click();
  await expect(page.getByText(/^Bien: Aparece un gas/)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar las evidencias en la tabla' }).click();
  await saved(page, 1);
  await page.getByRole('button', { name: 'Guardar el volumen de gas' }).click();
  await saved(page, 1);
  await setSlider(page, 'Bicarbonato de sodio', 'g', '5');
  await expect(cond(page, 'reactivo límite')).toContainText('Cómo corregirlo');

  await page.getByLabel('Proceso', { exact: true }).selectOption('hervir-agua');
  await sim.getByRole('button', { name: 'Iniciar el proceso' }).click();
  await expect(ro(page, 'Gas')).toContainText('vapor de agua');
  await page.getByRole('group', { name: '¿Qué tipo de cambio es?' }).getByRole('button', { name: 'Cambio químico' }).click();
  await expect(page.getByText(/^Revisa las evidencias: Hay burbujas/)).toBeVisible();
  await page.getByRole('button', { name: 'Intentar recuperar la sustancia' }).click();
  await expect(ro(page, 'Prueba de recuperación')).toContainText('misma sustancia');
  await expect(page.getByRole('img', { name: /Agua que hierve en 3D/ })).toBeVisible();

  await page.getByLabel('Proceso', { exact: true }).selectOption('oxidacion-hierro');
  await page.getByLabel('Preparación de la lana de acero').selectOption('seca');
  await expect(cond(page, 'necesita agua')).toContainText('Cómo corregirlo: Humedece');
  await page.getByLabel('Preparación de la lana de acero').selectOption('humeda');
  await sim.getByRole('button', { name: 'Iniciar el proceso' }).click();
  await expect(ro(page, 'Subida del agua en la probeta')).toContainText('10,5 mL');
  await a11yAndMobile(page, 'cambios-quimicos');
});

test('movimiento-circular: caso de referencia, cuerda cortada y curva mojada', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'movimiento-circular');
  const sim = page.getByRole('group', { name: 'Disco girando', exact: true });
  // Cortar la cuerda mientras gira.
  await sim.getByRole('button', { name: 'Hacer girar 10 vueltas' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Cortar la cuerda' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada', { timeout: 10_000 });
  await expect(ro(page, 'Vueltas y estado')).toContainText('cuerda cortada');
  await expect(ro(page, 'Sensor de fuerza (tensión)')).toContainText('0,00 N');
  // Valor dorado: r = 0,50 m, 200 g, T = 1,00 s → v = 3,142 m/s, a = 19,739 m/s², F = 3,95 N.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sim.getByRole('button', { name: 'Girar otra vez' }).click();
  await expect(ro(page, 'Cronómetro: 10 vueltas')).toContainText('10,00 s → T = 1,000 s');
  await expect(ro(page, 'Sensor de fuerza (tensión)')).toContainText('3,95 N');
  await expect(ro(page, 'Aceleración centrípeta a_c = v²/r')).toContainText('19,739 m/s²');
  await expect(ro(page, 'Rapidez tangencial v = 2πr/T')).toContainText('3,142 m/s');
  await page.getByRole('button', { name: 'Guardar el giro en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Período (tiempo de una vuelta)', 's', '0,4');
  await setSlider(page, 'Masa del disco', 'g', '500');
  await setSlider(page, 'Radio del círculo', 'm', '1');
  await expect(cond(page, 'sensor de fuerza llega solo')).toContainText('Cómo corregirlo');

  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Carro en una curva' }).click();
  await expect(ro(page, 'Rapidez máxima v = √(μ·g·r)')).toContainText('79,6 km/h');
  await page.getByLabel('Estado de la vía').selectOption('mojado');
  await expect(cond(page, 'derrapa')).toContainText('Cómo corregirlo: Baja la rapidez a menos de 56 km/h');
  await page.getByRole('button', { name: 'Guardar la curva en la tabla' }).click();
  await saved(page, 1);
  await a11yAndMobile(page, 'movimiento-circular');
});

test('lentes: imagen nítida de referencia, pantalla fuera de foco, lupa y ojo miope corregido', async ({ page }) => {
  await openFree(page, 'lentes');
  // Valor dorado: f = 10 cm, d_o = 30 cm → d_i = 15 cm, imagen invertida de 1,5 cm.
  await expect(ro(page, 'En la pantalla')).toContainText('imagen nítida');
  await expect(ro(page, 'Imagen (ecuación de las lentes)')).toContainText('d_i = 15,0 cm');
  await expect(ro(page, 'Altura de la imagen (regla)')).toContainText('1,5 cm, invertida');
  await page.getByRole('button', { name: 'Guardar la imagen nítida en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Posición de la pantalla', 'cm', '70');
  await expect(cond(page, 'se ve borrosa')).toContainText('Cómo corregirlo: Mueve la pantalla');
  await setSlider(page, 'Posición de la vela', 'cm', '35');
  await expect(cond(page, 'imagen es virtual')).toContainText('Cómo corregirlo');
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'El ojo y las gafas' }).click();
  await page.getByLabel('Ojo', { exact: true }).selectOption('miopia');
  await expect(ro(page, 'Dónde se forma la imagen')).toContainText('delante de la retina');
  await page.getByRole('button', { name: 'Poner la lente recomendada' }).click();
  await expect(ro(page, 'Dónde se forma la imagen')).toContainText('sobre la retina');
  await page.getByRole('button', { name: 'Guardar el caso del ojo en la tabla' }).click();
  await saved(page, 1);
  await page.getByRole('group', { name: /Tu respuesta: Las personas miopes/ }).getByRole('button', { name: 'Es falso' }).click();
  await expect(page.getByText(/Bien\. La idea es falsa\./)).toBeVisible();
  await a11yAndMobile(page, 'lentes');
});

test('magnetismo-imanes: brújula junto al imán, materiales y experimento de Oersted', async ({ page }) => {
  await openFree(page, 'magnetismo-imanes');
  await expect(ro(page, 'Brújula (dirección de la aguja)')).toContainText('desde el norte geográfico');
  await expect(ro(page, 'Campo de la Tierra en Apartadó (WMM2025)')).toContainText('7,5° al oeste');
  await page.getByRole('button', { name: 'Guardar la lectura de la brújula' }).click();
  await saved(page, 1);
  await setSlider(page, 'Brújula: posición este (x)', 'cm', '2');
  await setSlider(page, 'Brújula: posición norte (y)', 'cm', '0');
  await expect(cond(page, 'encima del imán')).toContainText('Cómo corregirlo: Aleja la brújula');
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Dos imanes y materiales' }).click();
  await expect(ro(page, 'Fuerza entre los imanes')).toContainText('se repelen');
  await page.getByRole('group', { name: 'Polos enfrentados' }).getByRole('button', { name: 'N con S' }).click();
  await expect(ro(page, 'Fuerza entre los imanes')).toContainText('se atraen');
  await page.getByLabel('Material', { exact: true }).selectOption('aluminio');
  await page.getByRole('button', { name: 'Acercar el imán' }).click();
  await expect(ro(page, 'Material de prueba')).toContainText('no lo atrae');
  await page.getByRole('button', { name: 'Guardar el material en la tabla' }).click();
  await saved(page, 1);
  await page.getByRole('group', { name: 'Estación' }).getByRole('button', { name: 'Corriente y electroimán' }).click();
  await page.getByRole('group', { name: 'Fuente del campo' }).getByRole('button', { name: 'Cable recto (Oersted)' }).click();
  await setSlider(page, 'Distancia del cable a la brújula', 'cm', '2');
  // Valor dorado: 1 A a 2 cm → 10 µT; tan θ = 10/26,967 → 20°.
  await expect(ro(page, 'Campo de la corriente en la brújula')).toContainText('10,00 µT');
  await expect(ro(page, 'Brújula: desviación de la aguja')).toContainText('20°');
  await page.getByRole('button', { name: 'Guardar la desviación en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Corriente', 'A', '2,5');
  await expect(cond(page, 'se calienta')).toContainText('Cómo corregirlo');
  await a11yAndMobile(page, 'magnetismo-imanes');
});

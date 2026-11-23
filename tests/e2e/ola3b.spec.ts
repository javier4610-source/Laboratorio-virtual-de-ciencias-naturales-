import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';

/**
 * Ola 3b de prácticas nuevas (termodinamica, efecto-doppler, nutricion-digestion, biotecnologia-pcr, sistema-inmune):
 * flujo de cada práctica, valor dorado visible en la interfaz, avisos con su corrección, guardar ensayos, ideas
 * erróneas, axe en claro y oscuro (esperando 800 ms a que terminen las transiciones del tema) y sin desbordamiento a
 * 390 px. Las vistas 3D están en ola3b-3d-webgl.spec.ts y ola3b-3d-sin-webgl.spec.ts.
 */
const ro = (page: Page, k: string) => page.locator('.readout .item').filter({ has: page.locator('.k', { hasText: k }) });
const setSlider = async (page: Page, label: string, unit: string, v: string) => {
  const f = page.getByLabel(`${label} (valor exacto${unit ? ` en ${unit}` : ''})`);
  await f.fill(v);
  await f.press('Enter');
};
const saved = (page: Page, n: number) => expect(page.getByText(`Ensayo guardado (${n} en esta sesión).`).last()).toBeVisible();
const cond = (page: Page, text: string | RegExp) => page.locator('.condition').filter({ hasText: text });
const station = (page: Page, name: string) => page.getByRole('group', { name: 'Estación' }).getByRole('button', { name, exact: true }).click();
const idea = async (page: Page, start: string, answer: 'Es cierto' | 'Es falso') => {
  await page.getByRole('group', { name: new RegExp(`Tu respuesta: ${start}`) }).getByRole('button', { name: answer }).click();
  await expect(page.getByText(answer === 'Es falso' ? /Bien\. La idea es falsa\./ : /Bien\. La idea es cierta\./)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

async function a11yAndMobile(page: Page, id: string) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await axe(page, `${id} (${scheme})`)).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await noOverflow(page, 390);
}

test('termodinamica: primera ley en los cuatro procesos, ciclo de Otto (56,5 %) y de Carnot (50 %)', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'termodinamica');
  // Valor dorado: isotérmico al doble desde 100 kPa y 1 L → W = Q = 100·ln 2 = 69,31 J y ΔU = 0.
  await expect(ro(page, 'Trabajo hecho por el gas W')).toContainText('69,31 J');
  await expect(ro(page, 'Calor recibido Q')).toContainText('69,31 J');
  await expect(ro(page, 'Cambio de energía interna ΔU = Q − W')).toContainText('0,00 J');
  await page.getByRole('button', { name: 'Guardar el proceso en la tabla' }).click();
  await saved(page, 1);
  await page.getByLabel('Proceso', { exact: true }).selectOption('isobarico');
  await expect(ro(page, 'Trabajo hecho por el gas W')).toContainText('100,00 J');
  await expect(ro(page, 'Calor recibido Q')).toContainText('350,00 J');
  await expect(ro(page, 'Cambio de energía interna ΔU = Q − W')).toContainText('250,00 J');
  await page.getByRole('button', { name: 'Guardar el proceso en la tabla' }).click();
  await saved(page, 2);
  await page.getByLabel('Proceso', { exact: true }).selectOption('adiabatico');
  await expect(ro(page, 'Calor recibido Q')).toContainText('0,00 J');
  await expect(cond(page, 'adiabático real')).toContainText('Cómo corregirlo');
  await station(page, 'Ciclo de Otto');
  // Valor dorado: η = 1 − 8^(−0,4) = 56,5 %, con los calores y con la fórmula.
  await expect(ro(page, 'Rendimiento η = W/Q_entra')).toContainText('56,5 %');
  await expect(ro(page, 'Fórmula del ciclo')).toContainText('56,5 %');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Recorrido', exact: true });
  await sim.getByRole('button', { name: 'Recorrer el ciclo' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada');
  await page.getByRole('button', { name: 'Guardar el ciclo en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Relación de compresión r', '', '12');
  await expect(cond(page, 'detonación')).toContainText('Cómo corregirlo');
  await station(page, 'Ciclo de Carnot');
  await expect(ro(page, 'Rendimiento η = W/Q_entra')).toContainText('50,0 %');
  await setSlider(page, 'Temperatura de la fuente caliente T_c', 'K', '350');
  await setSlider(page, 'Temperatura de la fuente fría T_f', 'K', '400');
  await expect(cond(page, 'no hay máquina térmica posible')).toContainText('Cómo corregirlo');
  await setSlider(page, 'Temperatura de la fuente caliente T_c', 'K', '600');
  await setSlider(page, 'Temperatura de la fuente fría T_f', 'K', '300');
  await idea(page, 'Una máquina térmica bien hecha', 'Es falso');
  await a11yAndMobile(page, 'termodinamica');
});

test('efecto-doppler: sirena que se acerca (755,0 Hz) y se aleja, observador en movimiento, paso de la ambulancia y cono de Mach', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'efecto-doppler');
  await expect(ro(page, 'Rapidez del sonido')).toContainText('343,2 m/s');
  // Valor dorado: 700 Hz que se acercan a 25 m/s con aire a 20 °C → f' = 700·343,215/318,215 = 755,0 Hz.
  await expect(ro(page, "Frecuencia que se oye f'")).toContainText('755,0 Hz');
  await page.getByRole('button', { name: 'Guardar la frecuencia en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Velocidad de la fuente (positiva si se acerca)', 'm/s', '-25');
  await expect(ro(page, "Frecuencia que se oye f'")).toContainText('652,5 Hz');
  await setSlider(page, 'Velocidad de la fuente (positiva si se acerca)', 'm/s', '0');
  await setSlider(page, 'Velocidad del observador (positiva si se acerca)', 'm/s', '25');
  await expect(ro(page, "Frecuencia que se oye f'")).toContainText('751,0 Hz');
  await setSlider(page, 'Velocidad de la fuente (positiva si se acerca)', 'm/s', '400');
  await expect(cond(page, 'la fórmula de Doppler no se aplica')).toContainText('Cómo corregirlo');
  await station(page, 'Paso de la ambulancia');
  await expect(ro(page, 'Se oye al acercarse y al alejarse')).toContainText('755,0 Hz y 652,5 Hz');
  await page.getByRole('button', { name: 'Guardar el paso en la tabla' }).click();
  await saved(page, 1);
  await station(page, 'Barrera del sonido');
  await expect(ro(page, 'Semiángulo del cono de Mach')).toContainText('30,0°');
  await page.getByRole('button', { name: 'Guardar el cono en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Número de Mach del avión', '', '0,9');
  await expect(cond(page, 'no alcanza a sus propios frentes')).toContainText('Cómo corregirlo');
  await idea(page, 'El sonido viaja más rápido en el aire caliente', 'Es cierto');
  await a11yAndMobile(page, 'efecto-doppler');
});

test('nutricion-digestion: amilasa a pH 6,8 y a pH 2 con lugol, recorrido del almuerzo (saliva 35 %, pepsina 15 %) y sin bilis', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'nutricion-digestion');
  await expect(ro(page, 'Actividad relativa de la enzima')).toContainText('100,0 %');
  await setSlider(page, 'pH del tubo', '', '2');
  await expect(ro(page, 'Actividad relativa de la enzima')).toContainText('0,1 %');
  await expect(ro(page, 'Prueba con lugol')).toContainText('azul oscuro');
  await expect(cond(page, 'casi no trabaja')).toContainText('Cómo corregirlo');
  await page.getByRole('button', { name: 'Guardar el tubo en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'pH del tubo', '', '6,8');
  await setSlider(page, 'Tiempo a 37 °C', 'min', '30');
  await expect(ro(page, 'Prueba con lugol')).toContainText('amarillo');
  await page.getByRole('button', { name: 'Guardar el tubo en la tabla' }).click();
  await saved(page, 2);
  await station(page, 'Recorrido del almuerzo');
  // Valor dorado: la saliva digiere 35,0 % del almidón y la pepsina 15,0 % de las proteínas (calibración con Guyton y Hall).
  await expect(ro(page, 'Almidón digerido por la amilasa de la saliva')).toContainText('35,0 %');
  await expect(ro(page, 'Proteínas digeridas en el estómago (pepsina)')).toContainText('15,0 %');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Recorrido', exact: true });
  await sim.getByRole('button', { name: 'Comer el almuerzo' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada');
  await expect(ro(page, 'Lugar del alimento')).toContainText('Intestino grueso');
  await page.getByRole('button', { name: 'Guardar el recorrido en la tabla' }).click();
  await saved(page, 1);
  await page.getByLabel('Situación', { exact: true }).selectOption('sin-bilis');
  await expect(cond(page, 'de la grasa al intestino grueso')).toContainText('Cómo corregirlo');
  await expect(cond(page, 'consultar al médico')).toBeVisible();
  await idea(page, 'La bilis es una enzima', 'Es falso');
  await a11yAndMobile(page, 'nutricion-digestion');
});

test('biotecnologia-pcr: cebadores con la regla de Wallace, 30 ciclos (1000·1,9³⁰ = 2,30 × 10¹¹) y gel con la escalera de 100 pb', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'biotecnologia-pcr');
  await expect(ro(page, 'Tamaño del producto')).toContainText('350 pb');
  await expect(ro(page, 'Cebador directo (5′ → 3′)')).toContainText('Tm = 56 °C');
  await expect(ro(page, 'Temperatura de alineamiento sugerida')).toContainText('51 °C');
  await page.getByRole('button', { name: 'Guardar los cebadores en la tabla' }).click();
  await saved(page, 1);
  await page.getByLabel('Par de cebadores', { exact: true }).selectOption('p4');
  await expect(ro(page, 'Tamaño del producto')).toContainText('sin producto');
  await expect(cond(page, 'debe ser el complemento inverso')).toContainText('Cómo corregirlo');
  await page.getByLabel('Par de cebadores', { exact: true }).selectOption('p2');
  await setSlider(page, 'Temperatura de alineamiento', '°C', '70');
  await expect(cond(page, 'casi no se unen')).toContainText('Cómo corregirlo');
  await setSlider(page, 'Temperatura de alineamiento', '°C', '51');
  await station(page, 'Ciclos de la PCR');
  // Valor dorado: 1000 copias, E = 0,9, 30 ciclos → 1000·1,9³⁰ = 2,30 × 10¹¹ sin meseta.
  await expect(ro(page, 'Copias si cada ciclo duplicara')).toContainText('2,30 × 10¹¹');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Termociclador', exact: true });
  await sim.getByRole('button', { name: 'Correr la PCR' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada');
  await page.getByRole('button', { name: 'Guardar la PCR en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Número de ciclos', '', '38');
  await expect(cond(page, 'ya está en la meseta')).toContainText('Cómo corregirlo');
  await station(page, 'Electroforesis en gel');
  await expect(ro(page, 'Distancia del producto en el gel')).toContainText('36,6 mm');
  await expect(ro(page, 'Tamaño estimado con la recta del marcador')).toContainText('350 pb (real: 350 pb)');
  const gel = page.getByRole('group', { name: 'Electroforesis', exact: true });
  await gel.getByRole('button', { name: 'Correr el gel' }).click();
  await expect(gel.getByRole('status')).toHaveText('Terminada');
  await page.getByRole('button', { name: 'Guardar el gel en la tabla' }).click();
  await saved(page, 1);
  await idea(page, 'Con 30 ciclos de PCR se obtienen 30 copias', 'Es falso');
  await a11yAndMobile(page, 'biotecnologia-pcr');
});

test('sistema-inmune: respuesta secundaria 20 veces mayor, brote de sarampión con y sin vacuna y umbral 1 − 1/R₀', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'sistema-inmune');
  await expect(page.getByText('Modelo para aprender, no consejo médico')).toBeVisible();
  await expect(ro(page, 'Primer pico')).toContainText('día 12: 1,00');
  await expect(ro(page, 'Segundo pico (respuesta secundaria)')).toContainText('día 36: 20,0 (20 veces el primero)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sim = page.getByRole('group', { name: 'Días', exact: true });
  await sim.getByRole('button', { name: 'Avanzar los días' }).click();
  await expect(sim.getByRole('status')).toHaveText('Terminada');
  await page.getByRole('button', { name: 'Guardar la respuesta en la tabla' }).click();
  await saved(page, 1);
  await station(page, 'Epidemia y vacunación');
  // Valor dorado: sarampión con R₀ = 15 → umbral 1 − 1/15 = 93,3 %.
  await expect(ro(page, 'Umbral de inmunidad colectiva H = 1 − 1/R₀')).toContainText('93,3 %');
  await expect(ro(page, 'Personas infectadas en total')).toContainText('100,0 %');
  await page.getByRole('button', { name: 'Guardar la epidemia en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Cobertura de vacunación', '%', '80');
  await expect(cond(page, 'no alcanza el umbral')).toContainText('Cómo corregirlo');
  await expect(ro(page, 'Personas infectadas en total')).toContainText('21,6 %');
  await setSlider(page, 'Cobertura de vacunación', '%', '98');
  await expect(ro(page, 'Número reproductivo al empezar')).toContainText('el brote se apaga');
  await setSlider(page, 'Eficacia de la vacuna', '%', '60');
  await expect(cond(page, 'imposible solo con esta vacuna')).toContainText('Cómo corregirlo');
  await expect(cond(page, 'No sirve para tomar decisiones de salud')).toBeVisible();
  await station(page, 'Inmunidad colectiva');
  await expect(page.getByRole('table', { name: /Umbral de inmunidad colectiva/ })).toContainText('91,7 a 94,4 %');
  await idea(page, 'Si yo estoy vacunado, no importa', 'Es falso');
  await a11yAndMobile(page, 'sistema-inmune');
});

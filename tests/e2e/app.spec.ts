import { expect, test, type Page } from '@playwright/test';
import { SERVER } from './env';

/** Abre una práctica en modo libre y va a la etapa de experimento. */
async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}

async function tableRows(page: Page) {
  return page.locator('section.card table').first().locator('tbody tr').count();
}

const save = (page: Page) => page.getByRole('button', { name: 'Guardar ensayo en la tabla' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('inicio: navega a los seis grados', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Laboratorio Virtual de Ciencias Naturales' })).toBeVisible();
  for (const g of [6, 7, 8, 9, 10, 11]) {
    await page.goto('/');
    await page.locator(`a.grade-tile[href="#/grado/${g}"]`).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sexto|Séptimo|Octavo|Noveno|Décimo|Undécimo/);
    await expect(page.locator('.pcard:not(.planned)').first()).toBeVisible();
  }
});

test('catálogo: búsqueda y filtros', async ({ page }) => {
  await page.goto('/#/catalogo');
  await page.getByLabel('Buscar').fill('adn');
  await expect(page.locator('.pcard:not(.planned)')).toHaveCount(3);
  await page.getByLabel('Buscar').fill('');
  await page.getByLabel('Asignatura').selectOption('quimica');
  await expect(page.locator('.pcard:not(.planned)')).toHaveCount(10);
});

test('densidad (guiada): hipótesis obligatoria, medición, cálculo, tabla y análisis', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await expect(page.getByRole('heading', { name: 'Antes de experimentar, formula tu hipótesis' })).toBeVisible();
  await page.getByRole('button', { name: 'Formular mi hipótesis' }).click();
  await page.getByLabel('Mi predicción', { exact: false }).selectOption('aumenta');
  await page.getByLabel('Hipótesis completa').fill('Si aumento el volumen, entonces la masa aumenta, porque hay más material.');
  await page.getByRole('button', { name: /Guardar hipótesis/ }).click();
  await expect(page.getByRole('button', { name: '1. Pesar en la balanza' })).toBeVisible();
  for (const side of ['1,5', '2,0', '2,5', '3,0']) {
    const input = page.getByLabel('Arista del cubo (valor exacto en cm)');
    await input.fill(side);
    await input.press('Enter');
    await page.getByRole('button', { name: '1. Pesar en la balanza' }).click();
    await page.getByRole('button', { name: '2. Sumergir en la probeta' }).click();
    await save(page).click();
  }
  await expect(page.getByRole('cell', { name: '21,6' })).toBeVisible(); // aluminio 2 cm → 21,6 g
  await page.getByLabel(/Calcula la densidad/).fill('2,7');
  await page.getByRole('button', { name: 'Comprobar cálculo' }).click();
  await expect(page.getByText(/¡Bien!/)).toBeVisible();
  await page.getByRole('button', { name: 'Ir al análisis' }).click();
  await expect(page.locator('.readout .v.data').first()).toHaveText('aumenta');
  await expect(page.getByText('Tus datos muestran la tendencia que predijiste.', { exact: false })).toBeVisible();
});

test('ósmosis: agua destilada produce lisis y se registra', async ({ page }) => {
  await openFree(page, 'osmosis');
  const nacl = page.getByLabel('NaCl en el medio (valor exacto en % m/v)');
  await nacl.fill('0'); await nacl.press('Enter');
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(page.getByText('Lisis', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByRole('button', { name: 'Difusión en bolsa de diálisis' }).click();
  await save(page).click();
});

test('mendel: cuadro de Punnett, siembra y chi-cuadrado', async ({ page }) => {
  await openFree(page, 'mendel');
  await expect(page.getByText('3 : 1')).toBeVisible();
  await page.getByRole('button', { name: 'Dos (dihíbrido)' }).click();
  await expect(page.getByText('9 : 3 : 3 : 1')).toBeVisible();
  await page.getByRole('button', { name: 'Sembrar y contar' }).click();
  await expect(page.getByText('χ²').first()).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('ADN: complementariedad, traducción y mutación falciforme', async ({ page }) => {
  await openFree(page, 'adn');
  await page.getByLabel(/Escribe la hebra complementaria/).fill('TACCGGTTTAAACCGACCGTAATT');
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByText(/¡Correcto!/)).toBeVisible();
  await page.getByRole('button', { name: '2. Transcripción y traducción' }).click();
  await expect(page.getByText('MAKFGWH')).toBeVisible();
  await page.getByLabel('Secuencia', { exact: true }).selectOption('hbb');
  await page.getByRole('button', { name: '3. Mutaciones' }).click();
  await page.getByRole('button', { name: 'Aplicar mutación' }).click();
  await expect(page.getByRole('heading', { name: 'Efecto: mutación de sentido erróneo' })).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('soluciones: molaridad, absorbancia y validación de entrada', async ({ page }) => {
  await openFree(page, 'soluciones');
  await page.getByLabel('Masa de soluto (g)').fill('abc');
  await expect(page.getByText('Escribe una masa válida')).toBeVisible();
  await page.getByLabel('Soluto', { exact: true }).selectOption('nacl');
  await page.getByLabel('Masa de soluto (g)').fill('5,844');
  await expect(page.getByText('1,000 mol/L').first()).toBeVisible();
  await page.getByRole('button', { name: 'Medir absorbancia' }).click();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('enzimas: la velocidad cambia con la temperatura', async ({ page }) => {
  await openFree(page, 'enzimas');
  await page.getByRole('button', { name: 'Iniciar reacción' }).click();
  const v37 = await page.locator('.readout .item').first().locator('.v').textContent();
  const t = page.getByLabel('Temperatura (valor exacto en °C)');
  await t.fill('70'); await t.press('Enter');
  await page.getByRole('button', { name: 'Iniciar reacción' }).click();
  const v70 = await page.locator('.readout .item').first().locator('.v').textContent();
  expect(v37).not.toBe(v70);
  await save(page).click();
});

test('circuitos: serie 6 V y 3 × 10 Ω, interruptor abierto', async ({ page }) => {
  await openFree(page, 'circuitos');
  const r = page.getByLabel('Resistencia interna (r) (valor exacto en Ω)');
  await r.fill('0'); await r.press('Enter');
  await expect(page.locator('.readout').getByText('0,200 A').first()).toBeVisible();
  await page.getByRole('button', { name: 'R2: cerrado', exact: true }).click();
  await expect(page.locator('.readout').getByText('circuito abierto')).toBeVisible();
  await page.getByRole('button', { name: 'Paralelo' }).click();
  await expect(page.locator('.readout').getByText('1,200 A').first()).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('estequiometría y población registran ensayos', async ({ page }) => {
  await openFree(page, 'estequiometria');
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await openFree(page, 'poblacion');
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('evaluación: retroalimentación, reintento y puntaje', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Evaluación/ }).click();
  const first = page.locator('article.question').first();
  await first.getByRole('button', { name: /Se reduce a la mitad/ }).click();
  await first.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(first.getByText('✗ Respuesta incorrecta')).toBeVisible();
  await expect(first.getByText('Recomendación de repaso:')).toBeVisible();
  await first.getByRole('button', { name: 'Intentar de nuevo' }).click();
  await first.getByRole('button', { name: /Es la misma del bloque completo/ }).click();
  await first.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(first.getByText('✓ Respuesta correcta')).toBeVisible();
  await expect(page.locator('.kpi').nth(1)).toContainText('0 %'); // el primer intento cuenta
});

test('docente: asignación por código y lectura del estudiante', async ({ page }) => {
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: /Asignaciones/ }).click();
  await page.getByLabel('Curso o grupo').fill('8-1');
  await page.getByLabel('Práctica').selectOption('mendel');
  await page.getByRole('button', { name: /Crear asignación/ }).click();
  const code = await page.getByLabel('Código para compartir').inputValue();
  expect(code.startsWith('LVCN-A:')).toBe(true);
  await page.goto('/');
  await page.getByLabel('Código de asignación o lista').fill(code);
  await page.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.getByText('Asignación para 8-1')).toBeVisible();
});

test('informe del estudiante se importa en el panel docente', async ({ page }) => {
  await openFree(page, 'poblacion');
  await save(page).click();
  await page.goto('/#/practica/poblacion/informe');
  await page.getByLabel('Nombre o alias del estudiante').fill('Ana Prueba');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar archivo para el docente/ }).click()]);
  const path = await download.path();
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: /Informes/ }).click();
  await page.getByLabel(/Archivos de informe/).setInputFiles(path!);
  await expect(page.getByText('informe de Ana Prueba importado')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Ana Prueba', exact: true })).toBeVisible();
});

test('banco Saber: etiqueta de pregunta no oficial', async ({ page }) => {
  await page.goto('/#/banco');
  await expect(page.getByText('no es una pregunta oficial del ICFES').first()).toBeVisible();
});

test('móvil: sin desplazamiento horizontal en una práctica', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openFree(page, 'circuitos');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('mitosis: clasificar células, comprobar y registrar el conteo', async ({ page }) => {
  await openFree(page, 'mitosis');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Interfase', exact: true }).click();
  await expect(page.getByText('3 de 100 clasificadas')).toBeVisible();
  await page.getByRole('button', { name: 'Comprobar mis clasificaciones' }).click();
  await expect(page.getByText(/Acertaste \d de 3/)).toBeVisible();
  await expect(page.getByText('Índice mitótico del campo')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByRole('button', { name: 'Ciclo celular y ADN' }).click();
  await page.getByRole('button', { name: 'G2', exact: true }).click();
  await expect(page.locator('.readout').getByText('4,00 C')).toBeVisible();
});

test('ondas: medir λ con la regla y comprobar v = λ·f', async ({ page }) => {
  await openFree(page, 'ondas');
  await page.getByRole('button', { name: 'Pausar' }).click();
  const b = page.getByLabel('Marcador B (valor exacto en m)');
  await b.fill('6'); await b.press('Enter');
  await page.getByRole('button', { name: 'Usar distancia A–B' }).click();
  await expect(page.getByText('¡Buena medición!')).toBeVisible(); // λ = 10 m/s ÷ 2 Hz = 5 m
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('fotosíntesis: contar burbujas habilita el registro; en oscuridad no hay burbujas', async ({ page }) => {
  await openFree(page, 'fotosintesis');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Contar burbujas durante 1 minuto' }).click();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByLabel('Lámpara encendida', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Contar burbujas durante 1 minuto' }).click();
  await expect(page.locator('.readout').getByText('0', { exact: true })).toBeVisible();
});

test('pH: titulación fuerte-fuerte alcanza pH 7 en 25 mL', async ({ page }) => {
  await openFree(page, 'ph');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '+5 mL' }).click();
  await expect(page.locator('.readout').getByText('punto de equivalencia')).toBeVisible();
  await expect(page.locator('.readout .v.data').first()).toHaveText('7,00');
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('genética de poblaciones: escenario de malaria muestra equilibrio y se registra', async ({ page }) => {
  await openFree(page, 'popgen');
  await page.getByLabel('Escenario', { exact: true }).selectOption('malaria');
  await expect(page.getByText(/equilibrio p\* = 0,84/)).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('mezclas: imán → agua → filtración → evaporación recupera la sal; el registro exige un paso', async ({ page }) => {
  await openFree(page, 'mezclas');
  await expect(save(page)).toBeDisabled();
  for (const m of ['Imantación', 'Agregar agua y agitar', 'Filtración', 'Evaporación']) await page.getByRole('button', { name: m, exact: true }).click();
  await expect(page.getByRole('row', { name: /Sal de cocina/ })).toContainText('97,0 %');
  await expect(page.getByRole('row', { name: /Limaduras de hierro/ })).toContainText('100,0 %');
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('óptica: aire→agua refracta 28,8° y vidrio→aire a 45° da reflexión total', async ({ page }) => {
  await openFree(page, 'optica');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Medir con el transportador' }).click();
  await expect(page.locator('.readout').getByText('28,8°')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByLabel('Medio 1 (de donde viene la luz)').selectOption('vidrio');
  await page.getByLabel('Medio 2', { exact: true }).selectOption('aire');
  const a = page.getByLabel('Ángulo de incidencia (valor exacto en °)');
  await a.fill('45'); await a.press('Enter');
  await page.getByRole('button', { name: 'Medir con el transportador' }).click();
  await expect(page.locator('.readout').getByText('no hay (reflexión total)')).toBeVisible();
});

test('Newton: 2 N sobre 0,5 kg recorre 1 m en 0,707 s; en lija la fricción estática lo frena', async ({ page }) => {
  await openFree(page, 'newton');
  await page.getByRole('button', { name: 'Soltar el carrito' }).click();
  await expect(page.locator('.readout').getByText('0,707 s')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByLabel('Superficie', { exact: true }).selectOption('lija');
  await page.getByRole('button', { name: 'Soltar el carrito' }).click();
  await expect(page.locator('.readout').getByText('no se movió')).toBeVisible();
});

test('gases: a temperatura constante, la mitad del volumen duplica la presión', async ({ page }) => {
  await openFree(page, 'gases');
  const v = page.getByLabel('Volumen de la jeringa (valor exacto en mL)');
  await v.fill('50'); await v.press('Enter');
  await expect(page.locator('.readout').getByText('202,6 kPa')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('energía: desde 1 m llega al valle a 4,43 m/s; una colina más alta no se supera', async ({ page }) => {
  await openFree(page, 'energia');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Soltar la esfera' }).click();
  await expect(page.locator('.readout').getByText('4,43 m/s').first()).toBeVisible({ timeout: 8000 });
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  const h = page.getByLabel('Altura de la colina (valor exacto en m)');
  await h.fill('1,2'); await h.press('Enter');
  await page.getByRole('button', { name: 'Soltar la esfera' }).click();
  await expect(page.locator('.readout').getByText('no', { exact: true })).toBeVisible({ timeout: 8000 });
});

test('microscopio: contar células de cebolla a 4× y a 40× (con enfoque fino)', async ({ page }) => {
  await openFree(page, 'celulas');
  await expect(save(page)).toBeDisabled();
  await expect(page.locator('.readout').getByText('4.500 µm')).toBeVisible();
  const count = page.getByRole('button', { name: 'Contar células a lo largo del diámetro' });
  await count.click();
  await expect(page.locator('.readout').getByText('250,0 µm')).toBeVisible();
  await page.getByRole('group', { name: 'Objetivo' }).getByRole('button', { name: '40×' }).click();
  await count.click();
  await expect(page.getByText('La imagen está borrosa: enfoca con el tornillo micrométrico antes de contar.')).toBeVisible();
  const focus = page.getByLabel('Tornillo micrométrico (enfoque) (valor exacto)');
  await focus.fill('42'); await focus.press('Enter');
  await count.click();
  await expect(page.locator('.readout').getByText('225,0 µm')).toBeVisible();
  await page.getByLabel('Clasificación de la célula').selectOption({ label: 'Célula vegetal' });
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('redes alimentarias: la caza de gavilanes aumenta los ratones (+21,4 %)', async ({ page }) => {
  await openFree(page, 'redes');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.locator('.readout').getByText('0,300 kg/ha')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  const caza = page.getByLabel('Caza de gavilanes (% por año) (valor exacto en %/año)');
  await caza.fill('100'); await caza.press('Enter');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.locator('.readout').getByText('+21,4 %')).toBeVisible();
});

test('selección natural: 10 generaciones sobre suelo volcánico oscurecen la población', async ({ page }) => {
  await openFree(page, 'seleccion');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Avanzar 10 generaciones' }).click();
  await expect(page.locator('.readout').getByText('0,457')).toBeVisible();
  await expect(page.locator('.readout').getByText('0,157')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('cinemática: 2 m/s y 1 m/s² durante 5 s recorren 22,50 m; reto de MRU superado', async ({ page }) => {
  await openFree(page, 'cinematica');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('group', { name: 'Velocidad de la animación' }).getByRole('button', { name: 'Acelerada ×4' }).click();
  await page.getByRole('button', { name: 'Iniciar recorrido' }).click();
  await expect(page.locator('.readout').getByText('22,50 m')).toBeVisible();
  await expect(page.locator('.readout').getByText('4,50 m/s')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByLabel('Reto', { exact: true }).selectOption({ label: 'Velocidad constante de 4 m/s durante 6 s' });
  for (const [label, v] of [['Velocidad inicial (valor exacto en m/s)', '4'], ['Aceleración (valor exacto en m/s²)', '0'], ['Duración del recorrido (valor exacto en s)', '6']]) {
    const input = page.getByLabel(label); await input.fill(v); await input.press('Enter');
  }
  await page.getByRole('button', { name: 'Iniciar recorrido' }).click();
  await expect(page.getByText('¡Coincide!')).toBeVisible({ timeout: 10_000 });
});

test('velocidad de reacción: el mármol en polvo reacciona más rápido que granulado', async ({ page }) => {
  await openFree(page, 'cinetica');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Iniciar reacción y cronómetro' }).click();
  await expect(page.locator('.readout').getByText('0,40 mL/s')).toBeVisible({ timeout: 15_000 });
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByRole('group', { name: 'Partícula' }).getByRole('button', { name: 'Polvo' }).click();
  await page.getByRole('button', { name: 'Iniciar reacción y cronómetro' }).click();
  await expect(page.locator('.readout').getByText('1,43 mL/s')).toBeVisible({ timeout: 15_000 });
});

test('conductores: el cobre conduce (145,6 mA) y se clasifica con la predicción', async ({ page }) => {
  await openFree(page, 'conductores');
  await expect(save(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cerrar el circuito y medir' })).toBeDisabled();
  await page.getByLabel('Tu predicción antes de medir').selectOption({ label: 'Conductor' });
  await page.getByRole('button', { name: 'Cerrar el circuito y medir' }).click();
  await expect(page.locator('.readout').getByText('145,6 mA')).toBeVisible();
  await expect(page.getByText(/coincide con la medición/)).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('descomposición: la cáscara de banano pierde 45,2 % en 4 semanas; el plástico no cambia', async ({ page }) => {
  await openFree(page, 'descomposicion');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Pesar las bolsas' }).click();
  await expect(page.locator('.readout').getByText('45,2 %')).toBeVisible();
  await expect(page.locator('.readout').getByText('27,4 g')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByLabel('Material de la bolsa').selectOption({ label: 'Plástico (control)' });
  await page.getByRole('button', { name: 'Pesar las bolsas' }).click();
  await expect(page.locator('.readout').getByText('50,0 g')).toBeVisible();
});

test('equilibrio: agregar Fe³⁺ da Q < K y aumenta la absorbancia de 0,427 a 0,781', async ({ page }) => {
  await openFree(page, 'equilibrio');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Medir absorbancia' }).click();
  await expect(page.locator('.readout').getByText('0,427')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByRole('button', { name: 'Agregar 1 gota de Fe³⁺' }).click();
  await expect(page.locator('.notice').getByText(/Q < K: se desplaza hacia los productos/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Medir absorbancia' })).toBeEnabled({ timeout: 8000 });
  await page.getByRole('button', { name: 'Medir absorbancia' }).click();
  await expect(page.locator('.readout').getByText('0,781')).toBeVisible();
});

test('proyectiles: 4,5 m/s a 30° desde 1,00 m caen a 2,870 m', async ({ page }) => {
  await openFree(page, 'proyectiles');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Disparar' }).click();
  const medir = page.getByRole('button', { name: 'Medir el alcance con la cinta' });
  await expect(medir).toBeEnabled({ timeout: 8000 });
  await medir.click();
  await expect(page.locator('.readout').getByText('2,870 m')).toBeVisible();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('péndulo: la fotopuerta mide T = 2,013 s con L = 1,00 m', async ({ page }) => {
  await openFree(page, 'pendulo');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Medir con la fotopuerta' }).click();
  await expect(page.locator('.readout').getByText('2,013 s')).toBeVisible({ timeout: 10_000 });
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('choques: choque elástico conserva p = 0,0900 kg·m/s y Ec', async ({ page }) => {
  await openFree(page, 'choques');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Lanzar' }).click();
  await expect(page.locator('.readout').getByText('0,660 m/s')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('151,5 ms')).toBeVisible();
  await expect(page.locator('.readout').getByText('0,0900 kg·m/s').first()).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('conservación: en sistema abierto la balanza pierde 1,05 g (el CO₂ que escapa)', async ({ page }) => {
  await openFree(page, 'conservacion');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: '1. Pesar el sistema inicial' }).click();
  await expect(page.locator('.readout').getByText('218,50 g')).toBeVisible();
  await page.getByRole('button', { name: '2. Mezclar los reactivos' }).click();
  await expect(page.locator('.readout').getByText('217,45 g')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('CO₂: 1,048 g')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('respiración: el respirómetro mide 119,4 µL de O₂ y CR = 1,00 con maíz', async ({ page }) => {
  await openFree(page, 'respiracion');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Iniciar medición' }).click();
  await expect(page.locator('.readout').getByText('119,4 µL', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('verde (pH ≈ 6,6)')).toBeVisible();
  await expect(page.locator('.readout').getByText('26,0 µmol')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('agua: aguas abajo del vertimiento el oxígeno baja a 5,31 mg/L', async ({ page }) => {
  await openFree(page, 'agua');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Tomar muestra y medir' }).click();
  await expect(page.locator('.readout').getByText('5,31 mg/L')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('22 · clase IV (Crítica)')).toBeVisible();
  await expect(page.locator('.readout').getByText('59 · Regular')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('máquinas: palanca de 1.er género con 400 g a 20 cm se equilibra con 2,0 N a 40 cm', async ({ page }) => {
  await openFree(page, 'maquinas');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Medir fuerza y recorridos' }).click();
  await expect(page.locator('.readout').getByText('1,95', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('0,780 N·m')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByRole('button', { name: 'Poleas', exact: true }).click();
  await page.getByRole('button', { name: 'Polipasto', exact: true }).click();
  await page.getByRole('button', { name: 'Medir fuerza y recorridos' }).click();
  await expect(page.locator('.readout').getByText('4,00', { exact: true })).toBeVisible({ timeout: 10_000 });
});

test('calor: 100 g a 60 °C con 100 g a 20 °C en icopor llegan a 39,8 °C', async ({ page }) => {
  await openFree(page, 'calor');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Mezclar y medir' }).click();
  await expect(page.locator('.readout').getByText('39,8 °C')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.readout').getByText('8.444 J')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('presión: a 10 cm de agua el manómetro marca 100 mm y 975 Pa; la sonda se baja con el teclado', async ({ page }) => {
  await openFree(page, 'presion');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Leer el manómetro' }).click();
  await expect(page.locator('.readout').getByText('975 Pa')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('1.019,5 hPa')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  const sonda = page.getByRole('slider', { name: 'Sonda del manómetro: subir o bajar' });
  await sonda.focus();
  for (let i = 0; i < 4; i++) await sonda.press('ArrowDown');
  await page.getByRole('button', { name: 'Leer el manómetro' }).click();
  await expect(page.locator('.readout').getByText('1.170 Pa')).toBeVisible({ timeout: 10_000 });
});

test('ecosistema: el frasco con luz amanece con 8,0 mg/L de oxígeno y en oscuridad muere', async ({ page }) => {
  await openFree(page, 'ecosistema');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Simular y medir' }).click();
  await expect(page.locator('.readout').getByText('8,0 mg/L')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('7,0 g')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  await page.getByLabel('Horas de luz por día (valor exacto en h)').fill('0');
  await page.getByLabel('Horas de luz por día (valor exacto en h)').press('Tab');
  await page.getByRole('button', { name: 'Simular y medir' }).click();
  await expect(page.locator('.readout').getByText('0,0 mg/L').first()).toBeVisible({ timeout: 10_000 });
});

test('balanceo: 2 H₂ + O₂ → 2 H₂O conserva 36,03 g', async ({ page }) => {
  await openFree(page, 'balanceo');
  await page.getByRole('button', { name: 'Aumentar el coeficiente de H₂', exact: true }).click();
  await page.getByRole('button', { name: 'Aumentar el coeficiente de H₂O', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar la ecuación' }).click();
  await expect(page.locator('.readout').getByText('Balanceada con los menores enteros')).toBeVisible();
  await expect(page.locator('.readout').getByText('36,03 g').first()).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('expresión: la mutación de la anemia falciforme cambia Glu por Val', async ({ page }) => {
  await openFree(page, 'expresion');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Aplicar mutación' }).click();
  await page.getByRole('button', { name: 'Expresar el gen' }).click();
  await page.getByRole('button', { name: 'Omitir la animación' }).click();
  await expect(page.locator('.readout').getByText('Glu → Val (cargado (−) → hidrofóbico)')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('99,3 %')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
});

test('conducción: en la varilla de cobre caen las 9 tachuelas y q = 2,157 W', async ({ page }) => {
  await openFree(page, 'conduccion');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Encender y medir' }).click();
  await expect(page.locator('.readout').getByText('2,157 W')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.readout').getByText('82,2 °C')).toBeVisible();
  await expect(page.locator('.readout').getByText('9 de 9')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
});

test('sonido: el osciloscopio mide 512,8 Hz y la resonancia satura la pantalla', async ({ page }) => {
  await openFree(page, 'sonido');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Medir con la regla y el osciloscopio' }).click();
  await expect(page.locator('.readout').getByText('512,8 Hz')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('14 mV')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  expect(await tableRows(page)).toBe(1);
  const largo = page.getByLabel('Longitud de la columna de aire (valor exacto en cm)');
  await largo.fill('15,9');
  await largo.press('Enter');
  await page.getByRole('button', { name: 'Medir con la regla y el osciloscopio' }).click();
  await expect(page.locator('.readout').getByText('fuera de la pantalla: aumenta los mV/div')).toBeVisible({ timeout: 10_000 });
});

test('trabajo: subir 500 g por la rampa de 30° cuesta 2,220 J con 66,2 % de eficiencia', async ({ page }) => {
  await openFree(page, 'trabajo');
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Medir subida por la rampa' }).click();
  await expect(page.locator('.readout').getByText('2,220 J')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('66,2 %')).toBeVisible();
  await expect(page.locator('.readout').getByText('1,470 J')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
});

test('flotación: el cilindro de aluminio sumergido 8 cm recibe 0,40 N de empuje', async ({ page }) => {
  await openFree(page, 'flotacion');
  await expect(save(page)).toBeDisabled();
  const descenso = page.getByLabel('Descenso del objeto (valor exacto en cm)');
  await descenso.fill('8');
  await descenso.press('Enter');
  await page.getByRole('button', { name: 'Leer los instrumentos' }).click();
  await expect(page.locator('.readout').getByText('0,40 N')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.readout').getByText('42,3 g')).toBeVisible();
  await expect(page.locator('.readout').getByText('Se hundiría si se soltara')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
});

test('movimiento: el corredor recorre 20 m en 4,44 s (4,50 m/s = 16,2 km/h)', async ({ page }) => {
  await openFree(page, 'movimiento');
  await expect(save(page)).toBeDisabled();
  await expect(page.locator('.readout').getByText('20,00 m')).toBeVisible();
  await page.getByRole('button', { name: 'Acelerada ×4' }).click();
  await page.getByRole('button', { name: 'Dar la salida' }).click();
  await expect(page.locator('.readout').getByText('4,44 s')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.readout').getByText('16,2 km/h')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
});

test('interferencia: doble rendija, Δy de 10,40 mm entre cursores da λ = 650 nm', async ({ page }) => {
  await openFree(page, 'interferencia');
  await page.getByRole('button', { name: 'Encender la fuente de luz' }).click();
  await expect(page.locator('.readout').getByText('99,5 %')).toBeVisible();
  await page.getByRole('button', { name: 'Leer el calibrador' }).click();
  await expect(page.locator('.readout').getByText('10,00 mm', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.readout').getByText('625,0 nm')).toBeVisible();
  await page.getByLabel('Cursor B del calibrador (valor exacto en mm)').fill('5,20');
  await page.getByLabel('Cursor B del calibrador (valor exacto en mm)').press('Enter');
  await page.getByLabel('Cursor A del calibrador (valor exacto en mm)').fill('-5,20');
  await page.getByLabel('Cursor A del calibrador (valor exacto en mm)').press('Enter');
  await page.getByRole('button', { name: 'Leer el calibrador' }).click();
  await expect(page.locator('.readout').getByText('10,40 mm')).toBeVisible();
  await expect(page.locator('.readout').getByText('650,0 nm')).toBeVisible();
  await expect(page.locator('.readout').getByText('250,0 µm')).toBeVisible();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
});

test('inducción: el imán de ferrita entra a 0,50 m/s y la bobina da un pico de −86 mV (∫ε dt = −5,32 mV·s)', async ({ page }) => {
  await openFree(page, 'induccion');
  await page.getByLabel('Actividad del laboratorio').getByRole('button', { name: 'Ley de Faraday' }).click();
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Introducir el imán a velocidad constante' }).click();
  await expect(page.locator('.readout').getByText('−86 mV')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.readout').getByText('−5,32 mV·s')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByLabel('Actividad del laboratorio').getByRole('button', { name: 'Transformador' }).click();
  await page.getByRole('button', { name: 'Medir con los multímetros' }).click();
  await expect(page.locator('.readout').getByText('6,00 V', { exact: true })).toBeVisible();
});

test('circuitos simples: dos bombillos en serie llevan 0,223 A y en paralelo 0,621 A', async ({ page }) => {
  await openFree(page, 'circuitos-simples');
  await expect(page.locator('.readout').getByText('0,000 A').first()).toBeVisible();
  await page.getByRole('button', { name: 'Cargar circuito: dos bombillos en serie' }).click();
  await expect(page.locator('.readout').getByText('0,223 A').first()).toBeVisible();
  await expect(page.locator('.readout').getByText('2 de 2').first()).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByRole('button', { name: 'Cargar circuito: dos bombillos en paralelo' }).click();
  await expect(page.locator('.readout').getByText('0,621 A').first()).toBeVisible();
});

test('extracción de ADN: fresa con 1,5 g de sal y alcohol a 4 °C da 43 u.a.; la doble hebra de GATTACAGGA tiene 24 puentes y Tm = 28 °C', async ({ page }) => {
  await openFree(page, 'extraccion-adn');
  for (const step of ['Verter el tampón de lisis', 'Filtrar el extracto', 'Verter el alcohol frío', 'Enrollar el ADN con la varilla']) {
    await page.getByRole('button', { name: step }).click();
  }
  await expect(page.locator('.readout').getByText('43 u.a.').first()).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByLabel('Actividad del laboratorio').getByRole('button', { name: 'Doble hebra y complementariedad' }).click();
  for (const b of 'CTAATGTCCT') await page.getByRole('button', { name: `Colocar ${b}`, exact: true }).click();
  await page.getByRole('button', { name: 'Verificar la doble hebra' }).click();
  await expect(page.locator('.readout').getByText('10 de 10')).toBeVisible();
  await expect(page.locator('.readout').getByText('24', { exact: true })).toBeVisible();
  await expect(page.locator('.readout').getByText('28 °C').first()).toBeVisible();
});

test('mol: 1,250 g de sal son 0,02139 mol; con vinagre se pierden 1,048 g de CO₂', async ({ page }) => {
  await openFree(page, 'mol');
  await page.getByRole('button', { name: 'Colocar la navecilla en el plato' }).click();
  await page.getByRole('button', { name: 'Tarar la balanza' }).click();
  await page.getByRole('button', { name: 'Agregar una porción' }).click();
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Leer la balanza' }).click();
  await expect(page.locator('.readout').getByText('1,250 g').first()).toBeVisible();
  await expect(page.locator('.readout').getByText('0,02139 mol')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByRole('button', { name: 'Reacción en la balanza' }).click();
  await page.getByRole('button', { name: 'Pesar antes' }).click();
  await expect(page.locator('.readout').getByText('120,927 g').first()).toBeVisible();
  await page.getByRole('button', { name: 'Agregar el bicarbonato al vinagre' }).click();
  await page.getByRole('button', { name: 'Pesar después' }).click({ timeout: 15_000 });
  await expect(page.locator('.readout').getByText('1,048 g').first()).toBeVisible({ timeout: 15_000 });
});

test('reto: el río con semilla 123 da una pendiente de −0,135 ± 0,024 mg/L por km y la crítica señala la confusión', async ({ page }) => {
  await openFree(page, 'reto');
  await page.getByRole('button', { name: 'Recolectar datos' }).click();
  await expect(page.locator('.readout').getByText('−0,135 ± 0,024 mg/L por km')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Datos sintéticos generados por un modelo calculado \(semilla 123\)/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crítica de tu diseño' })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar las 6 muestras en la tabla' }).click();
});

test('energía (integración en el tiempo): m = 1 kg desde 10 m da 98,10 J, 14,007 m/s y 1,4278 s; Euler supera la tolerancia', async ({ page }) => {
  await openFree(page, 'energia');
  await page.getByLabel('Actividad del laboratorio').getByRole('button', { name: 'Caída y lanzamiento vertical (integración en el tiempo)' }).click();
  await expect(page.locator('.readout').getByText('98,10 J').first()).toBeVisible();
  await expect(save(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Soltar la pelota' }).click();
  await expect(page.locator('.readout').getByText('14,007 m/s').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('.readout').getByText('1,4278 s').first()).toBeVisible();
  await expect(page.getByText(/es menor que la tolerancia declarada \(1 × 10⁻⁶\)/).first()).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();
  await page.getByLabel('Método de integración').getByRole('button', { name: 'Euler explícito (para comparar)' }).click();
  await page.getByRole('button', { name: 'Soltar la pelota' }).click();
  await expect(page.getByText(/supera la tolerancia declarada/).first()).toBeVisible({ timeout: 8_000 });
});

test('energía: con el indicador apagado el laboratorio queda como antes', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('lvcn:flags', JSON.stringify({ energiaTemporal: false })));
  await openFree(page, 'energia');
  await expect(page.getByRole('button', { name: 'Soltar la esfera' })).toBeVisible();
  await expect(page.getByLabel('Actividad del laboratorio')).toHaveCount(0);
});

test('servidor: el docente crea un curso, el estudiante envía su informe y el docente lo recibe', async ({ page }) => {
  // Docente
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: 'Servidor' }).click();
  await page.getByLabel('Dirección del servidor').fill(SERVER);
  await page.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.getByText('Conexión correcta con el servidor.')).toBeVisible();
  await page.getByRole('button', { name: 'Crear cuenta' }).first().click();
  await page.getByLabel('Nombre', { exact: true }).fill('Docente de Prueba');
  await page.getByLabel('Código de registro institucional').fill('PRUEBA-E2E');
  await page.getByLabel('Correo').fill(`docente${Date.now()}@colegio.edu.co`);
  await page.getByLabel('Contraseña').fill('clave-muy-segura');
  await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Sesión iniciada como')).toBeVisible();
  await page.getByLabel('Nombre del curso').fill('11-1 Biología');
  await page.getByRole('button', { name: 'Crear curso' }).click();
  const code = (await page.locator('td.mono').first().textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Estudiante
  await openFree(page, 'popgen');
  await save(page).click();
  await page.goto('/#/practica/popgen/informe');
  await page.getByLabel('Nombre o alias del estudiante').fill('Valentina Mosquera');
  await page.locator('summary', { hasText: 'Enviar a mi docente por internet' }).click();
  await page.locator('#srv-url').fill(SERVER);
  await page.getByLabel('Código del curso').fill(code);
  await page.getByRole('button', { name: 'Enviar informe' }).click();
  await expect(page.getByText('Informe recibido en el curso «11-1 Biología».')).toBeVisible();

  // Docente recibe
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: 'Servidor' }).click();
  await page.getByRole('button', { name: 'Traer informes' }).click();
  await expect(page.getByText(/Se descargaron 1 informes de «11-1 Biología» \(1 nuevos\)/)).toBeVisible();
  await page.getByRole('tab', { name: /Informes/ }).click();
  await expect(page.getByRole('cell', { name: 'Valentina Mosquera', exact: true })).toBeVisible();
});

test('teclado: las pestañas de etapas se recorren con flechas', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Preparación/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Hipótesis/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Hipótesis/ })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: /Modelo y referencias/ })).toHaveAttribute('aria-selected', 'true');
});

test('validación curricular: registrar un DBA verificado y verlo en el resumen', async ({ page }) => {
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: 'Validación curricular' }).click();
  await page.getByRole('row', { name: /Genética de poblaciones/ }).getByRole('button', { name: 'Revisar' }).click();
  await page.getByLabel('Estado de la validación').selectOption('validado');
  await page.getByLabel('DBA verificado (número y grado)').fill('DBA 4, grado 11.º');
  await page.getByLabel('Validado por').fill('Área de Ciencias');
  await expect(page.getByRole('row', { name: /Genética de poblaciones/ })).toContainText('DBA 4, grado 11.º');
  await page.reload();
  await page.getByRole('tab', { name: 'Validación curricular' }).click();
  await expect(page.locator('.kpi').first()).toContainText('1/50');
});

test('encuesta de opinión viaja en el informe', async ({ page }) => {
  await openFree(page, 'ondas');
  await page.getByRole('tab', { name: /Evaluación/ }).click();
  await page.getByRole('radiogroup', { name: 'El laboratorio fue fácil de usar.' }).getByRole('radio', { name: '4' }).click();
  await page.goto('/#/practica/ondas/informe');
  await expect(page.getByText(/fácil de usar 4/)).toBeVisible();
});

test('seguimiento: el estudiante se une con código y PIN, y el docente ve su avance y puntaje', async ({ page }) => {
  // Docente crea el curso.
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: 'Servidor' }).click();
  await page.getByLabel('Dirección del servidor').fill(SERVER);
  await page.getByRole('button', { name: 'Crear cuenta' }).first().click();
  await page.getByLabel('Nombre', { exact: true }).fill('Docente Seguimiento');
  await page.getByLabel('Código de registro institucional').fill('PRUEBA-E2E');
  await page.getByLabel('Correo').fill(`seguimiento${Date.now()}@colegio.edu.co`);
  await page.getByLabel('Contraseña').fill('clave-muy-segura');
  await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre del curso').fill('9-2 Ciencias');
  await page.getByRole('button', { name: 'Crear curso' }).click();
  const code = (await page.locator('td.mono').first().textContent())!.trim();

  // Estudiante se une desde el encabezado.
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Unirme a mi curso' }).click();
  const dialog = page.getByRole('dialog', { name: 'Unirme a mi curso' });
  await dialog.getByLabel('Servidor del colegio').fill(SERVER);
  await dialog.getByLabel('Código de tu curso').fill(code);
  await dialog.getByLabel('Tu alias o código de estudiante').fill('11A-07');
  await dialog.getByLabel('PIN de 4 dígitos').fill('2468');
  await expect(dialog.getByText('Qué se envía y a quién.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Unirme al curso' }).click();
  await expect(page.getByText('¡Listo! Te uniste al curso.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: /11A-07, 9-2 Ciencias: mi curso/ })).toBeVisible();

  // Hace una medición y responde una pregunta.
  await openFree(page, 'popgen');
  await save(page).click();
  await page.getByRole('tab', { name: /Evaluación/ }).click();
  const first = page.locator('article.question').first();
  await first.getByRole('button', { name: /: 48 %$/ }).click();
  await first.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(first.getByText('✓ Respuesta correcta')).toBeVisible();
  await expect(page.locator('.sync-chip')).toHaveText(/Sincronizado/, { timeout: 15_000 });

  // El docente ve al estudiante, su avance y su puntaje.
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: 'Seguimiento del curso' }).click();
  await expect(page.locator('.kpi', { hasText: 'Inscritos' })).toContainText('1');
  await expect(page.locator('.kpi', { hasText: 'Activos hoy' })).toContainText('1');
  const row = page.getByRole('row', { name: /11A-07/ });
  await expect(row).toBeVisible();
  await expect(row.locator('td.heat').first()).toContainText('1/1');
  await expect(row.getByText('100 %')).toBeVisible(); // puntaje: 1 de 1 al primer intento
  await row.getByRole('button', { name: /11A-07/ }).click();
  await expect(page.getByRole('heading', { name: '11A-07' })).toBeVisible();
  await expect(page.getByText('Acierto al 1.er intento')).toBeVisible();
  await expect(page.getByText('Se unió al curso')).toBeVisible();
});

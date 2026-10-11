import { expect, test, type Page } from '@playwright/test';

/** Abre una práctica en modo libre y va a la etapa de experimento. */
async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByRole('button', { name: 'Exploración libre' }).click();
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
  await expect(page.locator('.pcard:not(.planned)')).toHaveCount(1);
  await page.getByLabel('Buscar').fill('');
  await page.getByLabel('Asignatura').selectOption('quimica');
  await expect(page.locator('.pcard:not(.planned)')).toHaveCount(5);
});

test('densidad (guiada): hipótesis obligatoria, medición, cálculo, tabla y análisis', async ({ page }) => {
  await page.goto('/#/practica/densidad');
  await expect(page.getByRole('tab', { name: /Experimento/ })).toBeDisabled();
  await page.getByRole('button', { name: /Entendido/ }).click();
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
  await page.getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Evaluación/ }).click();
  const first = page.locator('article.question').first();
  await first.getByRole('button', { name: /Opción A/ }).click();
  await first.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(first.getByText('✗ Respuesta incorrecta')).toBeVisible();
  await expect(first.getByText('Recomendación de repaso:')).toBeVisible();
  await first.getByRole('button', { name: 'Intentar de nuevo' }).click();
  await first.getByRole('button', { name: /Opción B/ }).click();
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
  await page.getByLabel('Nombre del estudiante').fill('Ana Prueba');
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

test('servidor: el docente crea un curso, el estudiante envía su informe y el docente lo recibe', async ({ page }) => {
  // Docente
  await page.goto('/#/docente');
  await page.getByRole('tab', { name: 'Servidor' }).click();
  await page.getByLabel('Dirección del servidor').fill('http://localhost:8787');
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
  await page.getByLabel('Nombre del estudiante').fill('Valentina Mosquera');
  await page.locator('summary', { hasText: 'Enviar a mi docente por internet' }).click();
  await page.locator('#srv-url').fill('http://localhost:8787');
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
  await page.getByRole('button', { name: 'Exploración libre' }).click();
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
  await expect(page.locator('.kpi').first()).toContainText('1/19');
});

test('encuesta de opinión viaja en el informe', async ({ page }) => {
  await openFree(page, 'ondas');
  await page.getByRole('tab', { name: /Evaluación/ }).click();
  await page.getByRole('radiogroup', { name: 'El laboratorio fue fácil de usar.' }).getByRole('radio', { name: '4' }).click();
  await page.goto('/#/practica/ondas/informe');
  await expect(page.getByText(/fácil de usar 4/)).toBeVisible();
});

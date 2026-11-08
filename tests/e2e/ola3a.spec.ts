import { expect, test, type Page } from '@playwright/test';
import { axe, noOverflow, openFree } from './organica-comun';

/**
 * Ola 3a de prácticas nuevas (gravitacion-orbitas, fluidos-bernoulli, termoquimica, ciclo-del-carbono): flujo de cada
 * práctica, valor dorado visible en la interfaz, avisos con su corrección, guardar ensayos, ideas erróneas, axe en claro
 * y oscuro (esperando 800 ms a que terminen las transiciones del tema) y sin desbordamiento a 390 px. Las vistas 3D
 * están en ola3a-3d-webgl.spec.ts y ola3a-3d-sin-webgl.spec.ts.
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

test('gravitacion-orbitas: fuerza Tierra–Luna, órbita con áreas iguales, planetas de la NASA y satélite geoestacionario', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'gravitacion-orbitas');
  // Valor dorado: F = G·M_T·M_L/r² = 1,982 × 10²⁰ N.
  await expect(ro(page, 'Fuerza gravitacional F = G·m₁·m₂/r²')).toContainText('1,982 × 10²⁰ N');
  await page.getByRole('button', { name: 'Guardar la fuerza en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Distancia (veces la original)', '', '2');
  await expect(ro(page, 'F comparada con la distancia original')).toContainText('0,2500 veces');
  await page.getByLabel('Pareja de cuerpos').selectOption('tierra-estudiante');
  await setSlider(page, 'Distancia (veces la original)', '', '0,5');
  await expect(cond(page, 'dentro del planeta')).toContainText('Cómo corregirlo');
  await station(page, 'Órbita y leyes de Kepler');
  // Valor dorado: T = 2π√(a³/GM) de la Tierra = 365,3 días (NASA: 365,256).
  await expect(ro(page, 'Período T = 2π·√(a³/μ)')).toContainText('365,3 días');
  await setSlider(page, 'Excentricidad e', '', '0,6');
  await expect(ro(page, 'Perihelio')).toContainText('0,400 UA; 59,57 km/s');
  await expect(ro(page, 'Afelio')).toContainText('1,600 UA; 14,89 km/s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('group', { name: 'Órbita', exact: true }).getByRole('button', { name: 'Recorrer una vuelta' }).click();
  await expect(page.getByRole('group', { name: 'Órbita', exact: true }).getByRole('status')).toHaveText('Terminada');
  await page.getByRole('button', { name: 'Guardar la órbita en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Semieje mayor a', 'UA', '0,2');
  await setSlider(page, 'Excentricidad e', '', '0,9');
  await expect(cond(page, 'más cerca del Sol que cualquier planeta')).toContainText('Cómo corregirlo');
  await station(page, 'Planetas y satélites');
  await expect(page.getByRole('region', { name: 'Tercera ley de Kepler con los planetas' })).toContainText('Neptuno');
  await page.getByRole('button', { name: 'Guardar los 8 planetas en la tabla' }).click();
  await saved(page, 1);
  await expect(page.getByRole('tab', { name: 'Planetas (NASA) y tercera ley (8)' })).toBeVisible();
  await page.getByRole('button', { name: 'Geoestacionario (35 786 km)' }).click();
  await expect(ro(page, 'Satélite de la Tierra: período')).toContainText('23,93 h');
  await expect(ro(page, 'Órbita geoestacionaria')).toContainText('35.786 km');
  await page.getByRole('group', { name: /Tu respuesta: Si se duplica la distancia/ }).getByRole('button', { name: 'Es falso' }).click();
  await expect(page.getByText(/Bien\. La idea es falsa\./)).toBeVisible();
  await a11yAndMobile(page, 'gravitacion-orbitas');
});

test('fluidos-bernoulli: continuidad en la manguera, Venturi con piezómetros y atomizador', async ({ page }) => {
  test.setTimeout(90_000);
  await openFree(page, 'fluidos-bernoulli');
  await expect(ro(page, 'Rapidez en la boquilla v₂ = Q/A₂')).toContainText('2,63 m/s');
  await setSlider(page, 'Diámetro de la boquilla', 'mm', '6,35');
  // Valor dorado: la mitad del diámetro → cuatro veces la rapidez (10,53 m/s).
  await expect(ro(page, 'Rapidez en la boquilla v₂ = Q/A₂')).toContainText('10,53 m/s');
  await page.getByRole('button', { name: 'Guardar la boquilla en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Tiempo para llenar el balde', 's', '10');
  await setSlider(page, 'Diámetro de la boquilla', 'mm', '2');
  await expect(cond(page, 'pide más presión')).toContainText('Cómo corregirlo');
  await station(page, 'Tubo de Venturi');
  // Valor dorado: Venturi 25/12,5 mm con 0,3 L/s → Δp = 2796 Pa y Δh = 28,6 cm.
  await expect(ro(page, 'Caída de presión Δp = ½ρ(v₂² − v₁²)')).toContainText('2.796 Pa');
  await expect(ro(page, 'Desnivel Δh = (v₂² − v₁²)/(2g)')).toContainText('28,6 cm');
  await expect(ro(page, 'Caudal calculado con Δh (medidor)')).toContainText('0,300 L/s');
  await page.getByRole('button', { name: 'Guardar el Venturi en la tabla' }).click();
  await saved(page, 1);
  await setSlider(page, 'Caudal de agua', 'L/s', '1');
  await setSlider(page, 'Diámetro de la garganta', 'mm', '8');
  await expect(cond(page, 'por debajo de la atmosférica')).toContainText('Cómo corregirlo: Baja el caudal');
  await station(page, 'Atomizador');
  await expect(ro(page, 'Altura que sube el agua')).toContainText('2,47 cm');
  await page.getByRole('button', { name: 'Guardar el atomizador en la tabla' }).click();
  await saved(page, 1);
  await page.getByRole('group', { name: /Tu respuesta: Donde el tubo se angosta/ }).getByRole('button', { name: 'Es falso' }).click();
  await expect(page.getByText(/Bien\. La idea es falsa\./)).toBeVisible();
  await a11yAndMobile(page, 'fluidos-bernoulli');
});

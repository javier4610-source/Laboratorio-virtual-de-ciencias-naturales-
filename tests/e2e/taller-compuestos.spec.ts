import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

/** Taller de formación de compuestos en las tres prácticas de química inorgánica (v2.4.0). */
const SHOTS = process.env.TC_SHOTS ?? '';

async function openForge(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await page.getByRole('button', { name: 'Taller de formación de compuestos' }).click();
  await expect(page.getByRole('heading', { name: 'Taller de formación de compuestos' })).toBeVisible({ timeout: 15_000 });
}
const forgeRoot = (page: Page) => page.locator('.forge-panel');
const ro = (page: Page, text: string) => forgeRoot(page).locator('.readout').getByText(text, { exact: true });
const element = (page: Page, name: string, sym: string) => forgeRoot(page).getByRole('button', { name: new RegExp(`^${name} \\(${sym}\\)`) });
const route = (page: Page, id: string) => forgeRoot(page).getByLabel('Ruta de formación', { exact: true }).selectOption(id);
const formar = (page: Page) => forgeRoot(page).getByRole('button', { name: 'Formar el compuesto' }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('oxidos-hidroxidos: Ca + O₂ → CaO «óxido de calcio» (registrado en PubChem) y CaO + H₂O → Ca(OH)₂; reto y cuaderno', async ({ page }) => {
  await openForge(page, 'oxidos-hidroxidos');
  // El banco original sigue ahí, oculto, y vuelve intacto.
  await expect(page.getByRole('button', { name: 'Quemar en el aire' })).toBeHidden();
  await expect(forgeRoot(page).getByRole('button', { name: 'Guardar en el cuaderno' })).toBeDisabled();
  await element(page, 'calcio', 'Ca').click();
  await expect(element(page, 'calcio', 'Ca')).toHaveAttribute('aria-pressed', 'true');
  await formar(page);
  await expect(ro(page, 'CaO')).toBeVisible();
  await expect(ro(page, '2 Ca + O₂ → 2 CaO')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'óxido de calcio', exact: true }).first()).toBeVisible();
  await expect(forgeRoot(page).getByText(/^Compuesto registrado en PubChem \(CID \d+\)/)).toBeVisible();
  await expect(forgeRoot(page).getByText('Reacción directa conocida.')).toBeVisible();
  await forgeRoot(page).getByRole('button', { name: 'Guardar en el cuaderno' }).click();
  await expect(forgeRoot(page).getByText('Ensayo guardado (1 en esta sesión).')).toBeVisible();

  await route(page, 'oxido-agua');
  await formar(page);
  await expect(ro(page, 'Ca(OH)₂')).toBeVisible();
  await expect(ro(page, 'CaO + H₂O → Ca(OH)₂')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'hidróxido de calcio', exact: true }).first()).toBeVisible();
  await expect(forgeRoot(page).getByText(/Logrados: 1 de 13/)).toBeVisible();
  // Visor 3D: la reacción se anima con su rótulo obligatorio y el conteo de átomos.
  await forgeRoot(page).getByRole('button', { name: 'Reacción en 3D' }).click();
  await expect(forgeRoot(page).getByText(/interpolación entre geometrías calculadas de reactivos y productos/).first()).toBeVisible();
  await expect(forgeRoot(page).getByRole('region', { name: 'Conteo de átomos de la reacción' })).toBeVisible();

  await page.getByRole('button', { name: 'Banco de trabajo' }).click();
  await expect(page.getByRole('button', { name: 'Quemar en el aire' })).toBeVisible();
});

test('acidos-sales: S(+6) + O₂ → SO₃; SO₃ + H₂O → H₂SO₄ «ácido sulfúrico»; H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2 H₂O «sulfato de calcio»', async ({ page }) => {
  await openForge(page, 'acidos-sales');
  await expect(forgeRoot(page).getByLabel('Ruta de formación', { exact: true })).toHaveValue('neutralizacion');
  await route(page, 'nometal-o2');
  await element(page, 'azufre', 'S').click();
  await forgeRoot(page).getByLabel('Número de oxidación del azufre (casilla 1)').selectOption('6');
  await formar(page);
  await expect(ro(page, 'SO₃')).toBeVisible();
  await expect(ro(page, '2 S + 3 O₂ → 2 SO₃')).toBeVisible();
  await expect(forgeRoot(page).getByText(/proceso de contacto/)).toBeVisible();

  await route(page, 'anhidrido-agua');
  await formar(page);
  await expect(ro(page, 'H₂SO₄')).toBeVisible();
  await expect(ro(page, 'SO₃ + H₂O → H₂SO₄')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'ácido sulfúrico', exact: true }).first()).toBeVisible();

  await route(page, 'neutralizacion');
  await element(page, 'calcio', 'Ca').click();
  await forgeRoot(page).getByRole('button', { name: /^Usar H₂SO₄/ }).click();
  await formar(page);
  await expect(ro(page, 'CaSO₄')).toBeVisible();
  await expect(ro(page, 'H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2 H₂O')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'sulfato de calcio', exact: true }).first()).toBeVisible();
  await expect(forgeRoot(page).getByText(/^Compuesto registrado en PubChem \(CID \d+\)/)).toBeVisible();
  await expect(forgeRoot(page).getByText(/Logrados: 2 de 13/)).toBeVisible();
});

test('nomenclatura-inorganica: el helio se rechaza con explicación; 2 Na + Cl₂ → 2 NaCl; la tabla se recorre con el teclado', async ({ page }) => {
  await openForge(page, 'nomenclatura-inorganica');
  await element(page, 'helio', 'He').click();
  await formar(page);
  await expect(forgeRoot(page).getByText(/El helio es un gas noble/)).toBeVisible();
  await expect(forgeRoot(page).getByText(/capa de valencia completa/)).toBeVisible();
  await expect(ro(page, 'combinación no válida')).toBeVisible();

  // Tras elegir la casilla 1 la tabla pasa sola a la casilla 2; se vuelve a la 1 para cambiar el metal.
  await forgeRoot(page).getByRole('button', { name: '1 · Metal', exact: true }).click();
  await element(page, 'sodio', 'Na').click();
  await element(page, 'cloro', 'Cl').click();
  await formar(page);
  await expect(ro(page, 'NaCl')).toBeVisible();
  await expect(ro(page, '2 Na + Cl₂ → 2 NaCl')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'cloruro de sodio', exact: true }).first()).toBeVisible();

  // Dos metales: explicación de la aleación.
  await element(page, 'cobre', 'Cu').click();
  await formar(page);
  await expect(forgeRoot(page).getByText(/aleación/)).toBeVisible();

  // Teclado: flechas dentro de la tabla (tabindex móvil).
  await element(page, 'cobre', 'Cu').focus();
  await page.keyboard.press('ArrowRight');
  await expect(element(page, 'cinc', 'Zn')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(element(page, 'aluminio', 'Al')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(element(page, 'aluminio', 'Al')).toHaveAttribute('aria-pressed', 'true');
});

test('taller ampliado (v2.5.0): 77 elementos; Ba, Sn(IV) «óxido estánnico», Ti(IV), Ce(IV), HIO₄, KMnO₄, Zn(OH)₂, Na₂SeO₄ y el uranio explicado', async ({ page }) => {
  test.setTimeout(240_000);
  await openForge(page, 'oxidos-hidroxidos');
  await expect(forgeRoot(page).getByText(/Elementos del taller: 77 \(resaltados\)/)).toBeVisible();
  // Antes fuera del taller; ahora habilitados (sin la marca «fuera del taller»).
  for (const [n, s] of [['titanio', 'Ti'], ['estroncio', 'Sr'], ['wolframio', 'W'], ['selenio', 'Se'], ['cerio', 'Ce'], ['bismuto', 'Bi']]) {
    await expect(element(page, n, s)).not.toHaveAccessibleName(/fuera del taller/);
  }
  await expect(element(page, 'uranio', 'U')).toHaveAccessibleName(/fuera del taller/);
  await expect(element(page, 'neón', 'Ne')).toHaveAccessibleName(/fuera del taller/);

  const ox = (name: string) => forgeRoot(page).getByLabel(`Número de oxidación del ${name} (casilla 1)`);
  await element(page, 'bario', 'Ba').click();
  await formar(page);
  await expect(ro(page, '2 Ba + O₂ → 2 BaO')).toBeVisible();
  await element(page, 'estaño', 'Sn').click();
  await ox('estaño').selectOption('4');
  await formar(page);
  await expect(ro(page, 'SnO₂')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'óxido estánnico', exact: true }).first()).toBeVisible();
  await element(page, 'titanio', 'Ti').click();
  await ox('titanio').selectOption('4');
  await formar(page);
  await expect(ro(page, 'Ti + O₂ → TiO₂')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'óxido de titanio(IV)', exact: true }).first()).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'óxido titánico', exact: true }).first()).toBeVisible();
  await element(page, 'cerio', 'Ce').click();
  await ox('cerio').selectOption('4');
  await formar(page);
  await expect(ro(page, 'CeO₂')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'óxido cérico', exact: true }).first()).toBeVisible();
  // Estado que el titanio no presenta: explicación por grupo.
  await element(page, 'titanio', 'Ti').click();
  await ox('titanio').selectOption('5');
  await formar(page);
  await expect(forgeRoot(page).getByText(/En los grupos 4 a 7 el número de oxidación máximo es el número del grupo/)).toBeVisible();

  await route(page, 'oxido-agua');
  await element(page, 'cinc', 'Zn').click();
  await formar(page);
  await expect(ro(page, 'ZnO + H₂O → Zn(OH)₂')).toBeVisible();

  await route(page, 'anhidrido-agua');
  await element(page, 'yodo', 'I').click();
  await ox('yodo').selectOption('7');
  await formar(page);
  await expect(ro(page, 'HIO₄')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'ácido peryódico', exact: true }).first()).toBeVisible();

  await route(page, 'neutralizacion');
  await forgeRoot(page).getByRole('button', { name: '1 · Metal del hidróxido', exact: true }).click();
  await element(page, 'potasio', 'K').click();
  await element(page, 'manganeso', 'Mn').click();
  await forgeRoot(page).getByLabel('Número de oxidación del manganeso (casilla 2)').selectOption('7');
  await formar(page);
  await expect(ro(page, 'KMnO₄')).toBeVisible();
  await forgeRoot(page).getByRole('button', { name: '1 · Metal del hidróxido', exact: true }).click();
  await element(page, 'sodio', 'Na').click();
  await element(page, 'selenio', 'Se').click();
  await forgeRoot(page).getByLabel('Número de oxidación del selenio (casilla 2)').selectOption('6');
  await formar(page);
  await expect(ro(page, 'H₂SeO₄ + 2 NaOH → Na₂SeO₄ + 2 H₂O')).toBeVisible();
  await expect(forgeRoot(page).getByRole('cell', { name: 'seleniato de sodio', exact: true }).first()).toBeVisible();

  // Elemento que sigue fuera: explicación concreta.
  await route(page, 'metal-o2');
  await element(page, 'uranio', 'U').click();
  await formar(page);
  await expect(forgeRoot(page).getByText(/uranilo/)).toBeVisible();
  await expect(ro(page, 'combinación no válida')).toBeVisible();
});

const FLOWS: Record<string, (page: Page) => Promise<void>> = {
  'oxidos-hidroxidos': async (page) => {
    await element(page, 'calcio', 'Ca').click();
    await formar(page);
    await expect(ro(page, 'CaO')).toBeVisible();
  },
  'acidos-sales': async (page) => {
    await element(page, 'calcio', 'Ca').click();
    await element(page, 'azufre', 'S').click();
    await forgeRoot(page).getByLabel('Número de oxidación del azufre (casilla 2)').selectOption('6');
    await formar(page);
    await expect(ro(page, 'CaSO₄')).toBeVisible();
  },
  'nomenclatura-inorganica': async (page) => {
    await element(page, 'hierro', 'Fe').click();
    await forgeRoot(page).getByLabel('Número de oxidación del hierro (casilla 1)').selectOption('3');
    await element(page, 'cloro', 'Cl').click();
    await formar(page);
    await expect(ro(page, 'FeCl₃')).toBeVisible();
  },
};

for (const id of Object.keys(FLOWS)) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${id} · taller: axe WCAG 2.2 AA, sin desbordamiento a 390 px y capturas (${scheme})`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: scheme });
      await openForge(page, id);
      await FLOWS[id](page);
      await page.waitForTimeout(1200);
      const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      await forgeRoot(page).getByRole('button', { name: 'Reacción en 3D' }).click();
      await page.waitForTimeout(800);
      const r2 = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(r2.violations.map((v) => `reacción 3D · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      // Rechazo explicado también accesible.
      await element(page, 'helio', 'He').click();
      await formar(page);
      const r3 = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(r3.violations.map((v) => `rechazo · ${v.id}: ${v.help}`)).toEqual([]);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await openForge(page, id);
        await FLOWS[id](page);
        await page.waitForTimeout(2000);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desbordamiento horizontal a ${width} px`).toBeLessThanOrEqual(0);
        if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/${id}-taller-${scheme}-${width}.png` });
      }
    });
  }
}

/* ---------------------------------------------------------------- siguiente paso del taller (v2.6.x) */

const NEW_FLOWS: Record<string, { lab: string; run: (page: Page) => Promise<void> }> = {
  'nitrato-amonio': {
    lab: 'acidos-sales',
    run: async (page) => {
      await route(page, 'amoniaco-acido');
      await element(page, 'nitrógeno', 'N').click();
      await forgeRoot(page).getByLabel('Número de oxidación del nitrógeno (casilla 1)').selectOption('5');
      await formar(page);
      await expect(ro(page, 'NH₃ + HNO₃ → NH₄NO₃')).toBeVisible();
      await expect(forgeRoot(page).getByRole('cell', { name: 'nitrato de amonio', exact: true }).first()).toBeVisible();
      // Los dos iones poliatómicos, cada uno en su visor y con sus enlaces covalentes (N–H en el NH₄⁺).
      await expect(forgeRoot(page).getByText(/en el cristal el NH₄⁺ gira o se desordena/)).toBeVisible();
      await expect(forgeRoot(page).locator('.forge-ions figure')).toHaveCount(2);
    },
  },
  'tricloruro-fosforo': {
    lab: 'nomenclatura-inorganica',
    run: async (page) => {
      await route(page, 'nometal-nometal');
      await element(page, 'fósforo', 'P').click();
      await element(page, 'cloro', 'Cl').click();
      await formar(page);
      await expect(ro(page, '2 P + 3 Cl₂ → 2 PCl₃')).toBeVisible();
      await expect(ro(page, 'Compuesto binario entre no metales')).toBeVisible();
      await expect(forgeRoot(page).getByRole('cell', { name: 'tricloruro de fósforo', exact: true }).first()).toBeVisible();
      await expect(forgeRoot(page).getByText(/Logrados: 1 de 13/)).toBeVisible();
    },
  },
  corindon: {
    lab: 'oxidos-hidroxidos',
    run: async (page) => {
      await element(page, 'aluminio', 'Al').click();
      await formar(page);
      await expect(ro(page, '4 Al + 3 O₂ → 2 Al₂O₃')).toBeVisible();
      await expect(forgeRoot(page).getByText('R3̄c (n.º 167, ejes hexagonales) · celda hexagonal con Z = 6')).toBeVisible();
      await expect(forgeRoot(page).getByText('1,855 Å (×3) y 1,972 Å (×3)', { exact: true })).toBeVisible();
    },
  },
  cuarzo: {
    lab: 'oxidos-hidroxidos',
    run: async (page) => {
      await route(page, 'nometal-o2');
      await element(page, 'silicio', 'Si').click();
      await formar(page);
      await expect(ro(page, 'Si + O₂ → SiO₂')).toBeVisible();
      await expect(forgeRoot(page).getByText(/es un sólido de red covalente \(cuarzo α\)/)).toBeVisible();
      await expect(forgeRoot(page).getByText(/^143,7° \(calculado; red covalente/)).toBeVisible();
    },
  },
};

for (const [name, flow] of Object.entries(NEW_FLOWS)) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`taller v2.6.x · ${name}: resultado, axe WCAG 2.2 AA y sin desbordamiento a 390 px (${scheme})`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: scheme });
      await openForge(page, flow.lab);
      await flow.run(page);
      await page.waitForTimeout(1200);
      const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await openForge(page, flow.lab);
        await flow.run(page);
        await page.waitForTimeout(2000);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desbordamiento horizontal a ${width} px`).toBeLessThanOrEqual(0);
        if (SHOTS) await page.screenshot({ fullPage: true, path: `${SHOTS}/v26-${name}-${scheme}-${width}.png` });
      }
    });
  }
}

// Utilidades compartidas por los E2E de química orgánica (copiar junto a los specs en tests/e2e/).
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { AXE_TAGS } from './env';

export async function openFree(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
}
export const ro = (page: Page, k: string) => page.locator('.readout .item').filter({ hasText: k });
export async function axe(page: Page, where: string): Promise<string[]> {
  // PENDIENTE DEL KIT (scratchpad/chem-kit-pedidos.md, pedido 6): en tema claro, el lado inactivo de la ecuación de <Reaction3D>
  // usa opacity 0.6 y queda en 4,46:1 (< 4,5:1). Se excluye SOLO ese span del kit hasta que se corrija allí; el resto se analiza.
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return r.violations.map((v) => `${where} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}
export async function noOverflow(page: Page, w: number) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o, `desbordamiento horizontal a ${w} px`).toBeLessThanOrEqual(0);
}

import { expect, test, type Locator, type Page } from '@playwright/test';
import { openFree } from './organica-comun';

/**
 * Palitos (enlaces) de los visores 3D: se comprueba EN EL NAVEGADOR, con 3Dmol.js y WebGL (SwiftShader), que los
 * palitos se dibujan y se ven entre las esferas.
 *
 * Método (por píxeles): para cada enlace se calcula el punto medio del tramo de palito que queda entre las dos esferas,
 * se proyecta a la pantalla con viewer.modelToScreen y se lee el píxel en dos imágenes del mismo lienzo:
 *  1) la imagen real (estilo de la aplicación) → el píxel debe estar pintado (alfa alto; el fondo es transparente);
 *  2) una máscara con SOLO las esferas (mismos radios) → el píxel debe estar vacío (no lo tapa una esfera).
 * Un enlace cuenta como «palito visible» si cumple ambas cosas. Se exige que lo sean casi todos (algunos pueden quedar
 * de frente a la cámara o detrás de otro átomo, como en cualquier molécula).
 */
const SHOTS = process.env.PAL_SHOTS ?? '';
const exe = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
test.use({ launchOptions: { ...exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

type Measure = { bonds: number; visible: number; drawn: number };

/** Mide los palitos del visor (Molecule3D: modelo de 3Dmol; Reaction3D: escena de formas) dentro de `root`. */
async function measure(root: Locator, legacy = false): Promise<Measure> {
  return root.evaluate(async (el, legacyStyle) => {
    type V = { render: () => void; pngURI: () => string; modelToScreen: (p: { x: number; y: number; z: number }) => { x: number; y: number }; getCanvas: () => HTMLCanvasElement;
      getModel: () => { selectedAtoms: (s: object) => { index: number; x: number; y: number; z: number; elem: string; bonds: number[]; style: Record<string, { radius?: number; scale?: number }> }[] } | null;
      setStyle: (s: object, st: object) => void; removeAllShapes: () => void; addSphere: (o: object) => void };
    type Host = HTMLElement & { __lv3d?: V | null; __lv3dScene?: { atoms: { x: number; y: number; z: number; r: number }[]; bonds: { a: number; b: number; opacity: number }[] } };
    const host = [...el.querySelectorAll('div')].find((d) => (d as Host).__lv3d) as Host | undefined;
    if (!host?.__lv3d) throw new Error('sin visor 3Dmol');
    const v = host.__lv3d;
    const load = (uri: string) => new Promise<ImageData>((ok) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d')!; g.drawImage(img, 0, 0); ok(g.getImageData(0, 0, c.width, c.height)); };
      img.src = uri;
    });
    const canvas = v.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const pts: { x: number; y: number; z: number }[] = [];
    const model = host.__lv3dScene ? null : v.getModel();
    if (model) {
      const atoms = model.selectedAtoms({});
      if (legacyStyle) { v.setStyle({}, { stick: { radius: 0.14 }, sphere: { scale: 0.28 } }); }
      const radius = (a: (typeof atoms)[number]) => {
        const s = a.style.sphere;
        if (!s) return 0;
        if (s.radius !== undefined) return s.radius;
        const BONDI: Record<string, number> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, S: 1.8, Cl: 1.75, P: 1.8, Ca: 2.31, Na: 2.27 };
        return (BONDI[a.elem] ?? 1.5) * (s.scale ?? 1);
      };
      for (const a of atoms) for (const j of a.bonds) if (a.index < j) {
        const b = atoms[j];
        const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        const t = (radius(a) + (L - radius(a) - radius(b)) / 2) / L;
        pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      }
      v.render();
      const full = await load(v.pngURI());
      const saved = atoms.map((a) => JSON.parse(JSON.stringify(a.style)));
      for (const a of atoms) v.setStyle({ index: a.index }, a.style.sphere ? { sphere: { radius: radius(a) } } : {});
      v.render();
      const mask = await load(v.pngURI());
      atoms.forEach((a, i) => v.setStyle({ index: a.index }, saved[i]));
      v.render();
      return count(full, mask);
    }
    const sc = host.__lv3dScene!;
    for (const b of sc.bonds) if (b.opacity > 0.99) {
      const p = sc.atoms[b.a], q = sc.atoms[b.b];
      const L = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      const t = (p.r + (L - p.r - q.r) / 2) / L;
      pts.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t });
    }
    v.render();
    const full = await load(v.pngURI());
    v.removeAllShapes();
    for (const a of sc.atoms) v.addSphere({ center: { x: a.x, y: a.y, z: a.z }, radius: a.r, color: 'white' });
    v.render();
    const mask = await load(v.pngURI());
    return count(full, mask);

    function count(full: ImageData, mask: ImageData) {
      const sx = full.width / rect.width, sy = full.height / rect.height;
      let visible = 0, drawn = 0;
      for (const p of pts) {
        const s = v.modelToScreen(p);
        const px = Math.round((s.x - rect.left - window.scrollX) * sx), py = Math.round((s.y - rect.top - window.scrollY) * sy);
        if (px < 0 || py < 0 || px >= full.width || py >= full.height) continue;
        // Ventana de 15 × 15 píxeles: los enlaces dobles y triples son dos o tres cilindros paralelos con hueco en el eje.
        let on = false, free = false;
        for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
          const x = px + dx, y = py + dy;
          if (x < 0 || y < 0 || x >= full.width || y >= full.height) continue;
          const k = (y * full.width + x) * 4 + 3;
          if (full.data[k] > 150) { on = true; if (mask.data[k] < 40) free = true; }
        }
        if (on) drawn++;
        if (free) visible++;
      }
      return { bonds: pts.length, visible, drawn };
    }
  }, legacy);
}

async function openForge(page: Page, id: string) {
  await page.goto(`/#/practica/${id}`);
  await page.getByLabel('Modo de trabajo').getByRole('button', { name: 'Exploración libre' }).click();
  await page.getByRole('tab', { name: /Experimento/ }).click();
  await page.getByRole('button', { name: 'Taller de formación de compuestos' }).click();
  await expect(page.getByRole('heading', { name: 'Taller de formación de compuestos' })).toBeVisible({ timeout: 15_000 });
}
const F = (page: Page) => page.locator('.forge-panel');
const card3d = (page: Page) => F(page).locator('section', { has: page.getByRole('heading', { name: 'Visor 3D' }) });
async function form(page: Page, route: string, a: [string, string, string], b?: [string, string, string]) {
  await F(page).getByLabel('Ruta de formación', { exact: true }).selectOption(route);
  if (b) await F(page).getByRole('button', { name: '1 · Metal del hidróxido', exact: true }).click();
  await F(page).getByRole('button', { name: new RegExp(`^${a[0]} \\(${a[1]}\\)`) }).click();
  await F(page).getByLabel(/Número de oxidación .*\(casilla 1\)/).selectOption(a[2]);
  if (b) {
    await F(page).getByRole('button', { name: new RegExp(`^${b[0]} \\(${b[1]}\\)`) }).click();
    await F(page).getByLabel(/Número de oxidación .*\(casilla 2\)/).selectOption(b[2]);
  }
  await F(page).getByRole('button', { name: 'Formar el compuesto' }).click();
}
async function ready(root: Locator) {
  await expect(root.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
  await root.page().waitForTimeout(700);
}
/** Casi todos los palitos se ven (≥ 75 %) y al menos uno. */
function expectSticks(m: Measure, what: string, min = 0.75) {
  console.log(`[palitos] ${what}: ${m.visible}/${m.bonds} palitos visibles (${m.drawn} dibujados)`);
  expect(m.bonds, what).toBeGreaterThan(0);
  expect(m.visible / m.bonds, `${what}: ${m.visible}/${m.bonds}`).toBeGreaterThanOrEqual(min);
}

const CASES: { tag: string; route: string; a: [string, string, string]; b?: [string, string, string]; formula: string }[] = [
  { tag: 'h2so4', route: 'anhidrido-agua', a: ['azufre', 'S', '6'], formula: 'H₂SO₄' },
  { tag: 'caso4', route: 'neutralizacion', a: ['calcio', 'Ca', '2'], b: ['azufre', 'S', '6'], formula: 'CaSO₄' },
  { tag: 'caoh2', route: 'oxido-agua', a: ['calcio', 'Ca', '2'], formula: 'Ca(OH)₂' },
  { tag: 'nano3', route: 'neutralizacion', a: ['sodio', 'Na', '1'], b: ['nitrógeno', 'N', '5'], formula: 'NaNO₃' },
  { tag: 'h2o2', route: 'peroxido', a: ['hidrógeno', 'H', '1'], formula: 'H₂O₂' },
  { tag: 'co2', route: 'nometal-o2', a: ['carbono', 'C', '4'], formula: 'CO₂' },
  { tag: 'hclo4', route: 'anhidrido-agua', a: ['cloro', 'Cl', '7'], formula: 'HClO₄' },
  { tag: 'nh3', route: 'h2-nometal', a: ['nitrógeno', 'N', '-3'], formula: 'NH₃' },
];

test('taller: los palitos se dibujan y se ven en «esferas y palitos» y «palitos» (compuesto) y en la reacción 3D al inicio, durante y al final', async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openForge(page, 'acidos-sales');
  for (const c of CASES) {
    await form(page, c.route, c.a, c.b);
    await expect(F(page).locator('.readout').getByText(c.formula, { exact: true })).toBeVisible();
    const card = card3d(page);
    const fig = card.locator('figure.chem3d').first();
    await ready(fig);
    if (SHOTS) await card.screenshot({ path: `${SHOTS}/${c.tag}-compuesto.png` });
    const bs = await measure(fig);
    expectSticks(bs, `${c.formula} · compuesto · esferas y palitos`);
    if (c.tag === 'nh3' || c.tag === 'h2o2') {
      // Con la esfera por defecto de 3Dmol (0,28 × van der Waals) estos palitos quedaban tapados: se mide para comparar.
      const old = await measure(fig, true);
      console.log(`[palitos] ${c.formula} · estilo anterior (0,28 × vdW): ${old.visible}/${old.bonds} visibles`);
      expect(bs.visible).toBeGreaterThan(old.visible);
    }
    await card.getByRole('button', { name: 'Palitos', exact: true }).click();
    await page.waitForTimeout(400);
    expectSticks(await measure(fig), `${c.formula} · compuesto · palitos`, 0.85);
    await card.getByRole('button', { name: 'Esferas y palitos', exact: true }).click();
    await card.getByRole('button', { name: 'Reacción en 3D' }).click();
    if (c.tag === 'hclo4') {
      // El Cl₂O₇ no tiene confórmero ni geometría VSEPR fiable (dos átomos centrales): la reacción no se anima y se explica.
      await expect(card.getByText(/No hay geometría fiable para Cl₂O₇/)).toBeVisible();
      await card.getByRole('button', { name: 'Compuesto en 3D' }).click();
      continue;
    }
    const rfig = card.locator('figure.chem3d').first();
    await ready(rfig);
    for (const t of ['0', '30', '70', '100']) {
      await rfig.getByRole('slider', { name: 'Avance de la reacción' }).fill(t);
      await page.waitForTimeout(350);
      if (SHOTS && (t === '0' || t === '100')) await card.screenshot({ path: `${SHOTS}/${c.tag}-reaccion-${t}.png` });
      // (la medición deja en el lienzo la máscara de esferas; el siguiente cambio del deslizador vuelve a dibujar la escena)
      expectSticks(await measure(rfig), `${c.formula} · reacción ${t} %`, 0.7);
    }
    if (c.tag === 'caso4' || c.tag === 'caoh2' || c.tag === 'nano3') await expect(rfig.getByText(/Sin palitos entre iones/)).toBeVisible();
    await card.getByRole('button', { name: 'Compuesto en 3D' }).click();
  }
});

test('orgánica: el visor Molecule3D de hidrocarburos dibuja los palitos C–C y C–H', async ({ page }) => {
  test.setTimeout(240_000);
  await openFree(page, 'hidrocarburos');
  const fig = page.locator('figure.chem3d').first();
  await ready(fig);
  if (SHOTS) await fig.screenshot({ path: `${SHOTS}/organica-serie.png` });
  expectSticks(await measure(fig), 'hidrocarburo (serie) · esferas y palitos');
});

test('sin WebGL: la vista de respaldo SVG dibuja los palitos por encima del fondo y entre las esferas', async ({ page }) => {
  test.setTimeout(240_000);
  await page.route('**/*', (r) => (/3dmol/i.test(r.request().url()) ? r.abort() : r.continue()));
  await openForge(page, 'acidos-sales');
  await form(page, 'anhidrido-agua', ['azufre', 'S', '6']);
  const svg = card3d(page).getByRole('img', { name: /vista de respaldo dibujada con las coordenadas del modelo/ });
  await expect(svg).toBeVisible({ timeout: 20_000 });
  await svg.scrollIntoViewIfNeeded();
  const r = await svg.evaluate((s) => {
    const groups = [...s.querySelectorAll('g[opacity] > g > line:first-child')] as SVGLineElement[];
    let visible = 0;
    for (const l of groups) {
      const b = l.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (hit && hit.tagName.toLowerCase() === 'line') visible++;
    }
    return { bonds: groups.length, visible };
  });
  console.log(`[palitos] respaldo SVG H₂SO₄: ${r.visible}/${r.bonds} trazos de palito visibles en su punto medio`);
  expect(r.bonds).toBeGreaterThanOrEqual(6);
  expect(r.visible / r.bonds).toBeGreaterThanOrEqual(0.6);
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Seguimiento del curso con datos de ejemplo: accesibilidad (axe) en ambos temas,
 * sin desborde horizontal a 390 px. Con SCREENSHOTS=carpeta guarda capturas.
 */
import { SERVER } from './env';
const SHOTS = process.env.SCREENSHOTS;

async function post(request: APIRequestContext, method: 'post' | 'put', path: string, data: unknown, token?: string) {
  const res = await request[method](SERVER + path, { data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  expect(res.ok(), `${path}: ${res.status()}`).toBeTruthy();
  return res.json();
}

function summary(over: Record<string, unknown>) {
  const now = Date.now();
  return {
    version: now, mode: 'guiada', stages: ['preparacion', 'hipotesis', 'experimento'], percent: 60, trialsCount: 3,
    trials: [0, 1, 2].map((i) => ({ id: `t${i}`, d: 'medidas', t: now - (3 - i) * 600_000, v: { material: ['Hierro', 'Aluminio', 'Madera'][i], lado: 2 + i, vgeo: 8, masa: [62.9, 21.6, 4.8][i], vi: 50, vf: 58, vdesp: 8, densidad: [7.86, 2.7, 0.6][i], flota: i === 2 ? 'Sí' : 'No' } })),
    hypothesis: { text: 'Si el material es más denso, la muestra se hunde aunque tenga el mismo volumen.', trend: 'aumenta', pairIndex: 0, savedAt: now - 3_600_000 },
    comparison: { verdict: 'apoya', justification: 'El hierro y el aluminio se hunden; la madera flota.' },
    conclusion: { claim: 'La densidad decide si un objeto flota.', evidence: 'La madera (0,60 g/cm³) flota y el hierro (7,86 g/cm³) se hunde.', reasoning: 'El agua tiene 1 g/cm³.' },
    interpretations: {}, visited: ['preparacion'], stepsDone: [0, 1],
    answers: { 'den-1': { chosen: 'b', correct: true, firstTryCorrect: false, attempts: 2, firstChosen: 'a', at: now - 300_000 } },
    score: { answered: 1, total: 6, correct: 0, byCompetency: { uso: { answered: 1, correct: 0 }, explicacion: { answered: 0, correct: 0 }, indagacion: { answered: 0, correct: 0 } } },
    fits: [{ d: 'medidas', x: 'vdesp', y: 'masa', model: 'proportional' }], activeMs: 1_500_000, lastActivity: now,
    ...over,
  };
}

async function seed(page: Page) {
  const request = page.request;
  const t = await post(request, 'post', '/api/docentes', { registrationCode: 'PRUEBA-E2E', name: 'Docente Capturas', email: `capturas${Date.now()}${Math.random().toString(36).slice(2, 6)}@colegio.edu.co`, password: 'clave-muy-segura' });
  const { course } = await post(request, 'post', '/api/cursos', { name: '10-1 Química' }, t.token);
  const names = ['Sofía Rojas Mena', 'Mateo Díaz', 'Valentina Mosquera', 'Juan Esteban Palacios'];
  let student = null;
  for (const [i, name] of names.entries()) {
    const s = await post(request, 'post', '/api/estudiantes', { joinCode: course.joinCode, name, pin: '1234' });
    if (i === 0) student = s;
    if (i < 3) await post(request, 'put', '/api/estudiante/progreso/densidad', summary({ percent: [60, 100, 20][i], ...(i === 2 ? { answers: {}, score: { answered: 0, total: 6, correct: 0, byCompetency: {} } } : {}) }), s.token);
    if (i === 1) await post(request, 'put', '/api/estudiante/progreso/ph', summary({ percent: 40, trials: [], trialsCount: 0, fits: [] }), s.token);
  }
  await page.goto('/');
  await page.evaluate(([session, enrollment]) => {
    localStorage.setItem('lvcn:servidor-sesion', JSON.stringify(session));
    localStorage.setItem('lvcn:mi-curso', JSON.stringify(enrollment));
  }, [{ token: t.token, teacher: t.teacher, server: SERVER }, { server: SERVER, token: student.token, expiresAt: student.expiresAt, student: student.student, course: student.course, joinedAt: Date.now() }]);
  await page.reload();
  return course;
}

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.map((v) => `${label} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function noOverflow(page: Page, label: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, `${label}: desborde horizontal`).toBeLessThanOrEqual(0);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`seguimiento del curso (tema ${scheme === 'light' ? 'claro' : 'oscuro'})`, () => {
    test.use({ colorScheme: scheme });

    test('panel docente y diálogo del estudiante: accesibles y sin desborde', async ({ page }) => {
      await seed(page);
      const found: string[] = [];
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/#/docente');
        await page.getByRole('tab', { name: 'Seguimiento del curso' }).click();
        await expect(page.getByRole('row', { name: /Sofía Rojas Mena/ })).toBeVisible();
        await page.waitForTimeout(300);
        found.push(...(await audit(page, `seguimiento ${width}`)));
        await noOverflow(page, `seguimiento ${width}`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/seguimiento-${scheme}-${width}.png`, fullPage: true });
        await page.getByRole('row', { name: /Sofía Rojas Mena/ }).getByRole('button', { name: /Sofía Rojas Mena/ }).click();
        await expect(page.getByRole('heading', { name: 'Sofía Rojas Mena' })).toBeVisible();
        await expect(page.getByText('Primero eligió')).toBeVisible();
        found.push(...(await audit(page, `detalle ${width}`)));
        await noOverflow(page, `detalle ${width}`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/detalle-${scheme}-${width}.png`, fullPage: true });

        await page.goto('/#/practica/densidad');
        await page.getByRole('button', { name: /Sofía Rojas Mena, 10-1 Química: mi curso/ }).click();
        await expect(page.getByRole('dialog', { name: 'Mi curso' })).toBeVisible();
        found.push(...(await audit(page, `mi curso ${width}`)));
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/mi-curso-${scheme}-${width}.png` });
        await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
        await page.evaluate(() => localStorage.removeItem('lvcn:mi-curso'));
        await page.reload();
        await page.getByRole('button', { name: 'Unirme a mi curso' }).click();
        found.push(...(await audit(page, `unirme ${width}`)));
        await noOverflow(page, `unirme ${width}`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/unirme-${scheme}-${width}.png` });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await seed(page);
      }
      expect(found, found.join('\n')).toEqual([]);
    });
  });
}

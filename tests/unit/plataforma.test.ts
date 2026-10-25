import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PRACTICES, questionById } from '../../src/curriculum';
import { transferQuestions } from '../../src/assessment/lookup';
import { practiceQuestions } from '../../src/lib/report';

describe('preguntas de transferencia sin el currículo completo', () => {
  it('cada práctica resuelve las mismas preguntas (mismo objeto) que questionById', () => {
    for (const p of PRACTICES) {
      const expected = p.transferQuestionIds.map((id) => questionById(id)).filter((q) => !!q);
      expect(transferQuestions(p), p.id).toEqual(expected);
      expect(transferQuestions(p).every((q, i) => q === expected[i]), p.id).toBe(true);
      expect(practiceQuestions(p).length, p.id).toBe(p.assessment.length + expected.length);
    }
  });
  it('ninguna pregunta de transferencia queda sin resolver', () => {
    for (const p of PRACTICES) expect(transferQuestions(p).length, p.id).toBe(p.transferQuestionIds.length);
  });
});

describe('tokens del sistema de diseño (src/tokens.css)', () => {
  const css = readFileSync(new URL('../../src/tokens.css', import.meta.url), 'utf8');
  const block = (re: RegExp) => {
    const m = css.match(re);
    if (!m) throw new Error(`bloque no encontrado: ${re}`);
    return m[1].split('\n').map((l) => l.trim()).filter(Boolean);
  };
  const light = block(/^:root \{\n([\s\S]*?)\n\}/m);
  const darkMedia = block(/:root:not\(\[data-theme="light"\]\) \{\n([\s\S]*?)\n {2}\}/);
  const darkManual = block(/^:root\[data-theme="dark"\] \{\n([\s\S]*?)\n\}/m);
  const names = (lines: string[]) => new Set(lines.flatMap((l) => [...l.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1])));

  it('los dos bloques del tema oscuro son idénticos', () => {
    expect(darkMedia.length).toBeGreaterThan(30);
    expect(darkMedia).toEqual(darkManual);
  });
  it('todo token redefinido en oscuro existe en claro, y los colores semánticos tienen versión oscura', () => {
    const l = names(light);
    for (const n of names(darkManual)) expect(l.has(n), n).toBe(true);
    const d = names(darkManual);
    for (const n of ['--bg', '--surface', '--surface-2', '--surface-3', '--ink', '--ink-2', '--line', '--line-strong', '--accent', '--accent-ink', '--accent-soft',
      '--secondary', '--secondary-soft', '--ok', '--ok-soft', '--warn', '--warn-soft', '--bad', '--bad-soft', '--info', '--info-soft', '--data', '--data-soft', '--focus',
      '--bio', '--qui', '--fis', '--amb', ...Array.from({ length: 8 }, (_, i) => `--series-${i + 1}`)]) expect(d.has(n), n).toBe(true);
  });
  it('los laboratorios y componentes encuentran todos los tokens que usan', () => {
    // Tokens globales más los locales de componente declarados en las hojas de estilo (p. ej. --logger-screen).
    const local = ['styles.css', 'theme-2026.css'].map((f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8').split('\n'));
    const defined = new Set([...names(light), ...local.flatMap((lines) => [...names(lines)])]);
    const used = new Map<string, string>();
    for (const dir of ['labs', 'components', 'pages']) {
      for (const f of readdirSync(new URL(`../../src/${dir}/`, import.meta.url))) {
        if (!/\.tsx?$/.test(f)) continue;
        for (const m of readFileSync(new URL(`../../src/${dir}/${f}`, import.meta.url), 'utf8').matchAll(/var\((--[a-z0-9-]+)\)/g)) used.set(m[1], `${dir}/${f}`);
      }
    }
    const missing = [...used].filter(([n]) => !defined.has(n)).map(([n, f]) => `${n} (${f})`);
    expect(missing).toEqual([]);
  });
});

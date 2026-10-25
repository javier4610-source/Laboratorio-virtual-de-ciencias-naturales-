import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PRACTICES, questionById } from '../../src/curriculum';
import { transferQuestions } from '../../src/assessment/lookup';
import { practiceQuestions } from '../../src/lib/report';
import { CATALOG } from '../../src/curriculum/catalog';
import { filterCatalog, filtersFromQuery, filtersToQuery } from '../../src/pages/CatalogPages';
import { changedInputs, compareTrials, trialsToJSON } from '../../src/lib/compare';
import { shortcutKey } from '../../src/lib/shortcuts';
import type { Dataset, Trial } from '../../src/core/types';

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
    const local = ['styles.css', 'theme-2026.css', 'plataforma.css'].map((f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8').split('\n'));
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

describe('catálogo: filtros en la dirección, búsqueda y orden', () => {
  it('lee y escribe los filtros válidos e ignora los desconocidos', () => {
    const f = filtersFromQuery(new URLSearchParams('area=quimica&grado=10&competencia=uso&estado=en-curso&orden=titulo&q=ph'));
    expect(f).toEqual({ q: 'ph', grado: '10', area: 'quimica', competencia: 'uso', estado: 'en-curso', orden: 'titulo' });
    expect(filtersFromQuery(new URLSearchParams('area=magia&grado=13&estado=x&orden=y'))).toEqual({ q: '', grado: '', area: '', competencia: '', estado: '', orden: '' });
    expect(filtersFromQuery(new URLSearchParams(filtersToQuery(f).slice(1)))).toEqual(f);
  });
  it('mantiene los conteos de siempre (adn → 3; química → 20) y filtra por avance', () => {
    const base = { q: '', grado: '', area: '', competencia: '', estado: '', orden: '' };
    expect(filterCatalog(CATALOG, { ...base, q: 'adn' }, {}).length).toBe(3);
    expect(filterCatalog(CATALOG, { ...base, area: 'quimica' }, {}).length).toBe(20);
    expect(filterCatalog(CATALOG, { ...base, estado: 'en-curso' }, { densidad: 50, mendel: 100 }).map((p) => p.id)).toEqual(['densidad']);
    expect(filterCatalog(CATALOG, { ...base, estado: 'completada' }, { densidad: 50, mendel: 100 }).map((p) => p.id)).toEqual(['mendel']);
    expect(filterCatalog(CATALOG, { ...base, estado: 'sin-iniciar' }, { densidad: 50 }).length).toBe(CATALOG.length - 1);
    const byTitle = filterCatalog(CATALOG, { ...base, orden: 'titulo' }, {}).map((p) => p.title);
    expect(byTitle).toEqual([...byTitle].sort((a, b) => a.localeCompare(b, 'es')));
    // Varias palabras: basta con una (búsqueda amplia desde el inicio).
    expect(filterCatalog(CATALOG, { ...base, q: 'secuencias proteínas metabolismo' }, {}).map((p) => p.id)).toEqual(expect.arrayContaining(['secuencias', 'proteinas', 'metabolismo']));
  });
});

describe('comparación de ensayos y exportación JSON', () => {
  const ds: Dataset = { id: 'd', label: 'D', defaultX: 'l', defaultY: 'm', columns: [
    { key: 'mat', label: 'Material', numeric: false, input: true },
    { key: 'l', label: 'Arista', unit: 'cm', numeric: true, input: true, decimals: 1 },
    { key: 'm', label: 'Masa', unit: 'g', numeric: true, decimals: 1, resolution: 0.1 },
  ] };
  const t = (id: string, values: Trial['values']): Trial => ({ id, datasetId: 'd', createdAt: 0, values });
  it('resta B − A, calcula la variación relativa y detecta las entradas que cambiaron', () => {
    const rows = compareTrials(ds, t('a', { mat: 'Al', l: 2, m: 21.6 }), t('b', { mat: 'Al', l: 3, m: 72.9 }));
    expect(rows.find((r) => r.key === 'm')!.diff).toBeCloseTo(51.3, 10);
    expect(rows.find((r) => r.key === 'l')!.relPercent).toBeCloseTo(50, 10);
    expect(rows.find((r) => r.key === 'mat')!.same).toBe(true);
    expect(changedInputs(rows).map((r) => r.key)).toEqual(['l']);
    const zero = compareTrials(ds, t('a', { mat: 'Al', l: 0, m: null }), t('b', { mat: 'Fe', l: 1, m: 3 }));
    expect(zero.find((r) => r.key === 'l')!.relPercent).toBeNull();
    expect(zero.find((r) => r.key === 'm')!.diff).toBeNull();
  });
  it('el JSON de datos lleva formato, columnas con unidad y ensayos numerados', () => {
    const j = JSON.parse(trialsToJSON('densidad', 'Densidad', ds, [t('a', { mat: 'Al', l: 2, m: 21.6 })], '9.9.9'));
    expect(j.formato).toBe('lvcn-datos-v1');
    expect(j.columnas[2]).toEqual({ clave: 'm', nombre: 'Masa', unidad: 'g', numerica: true, entrada: false, resolucion: 0.1 });
    expect(j.ensayos[0]).toMatchObject({ n: 1, valores: { mat: 'Al', l: 2, m: 21.6 }, medicion: 'ideal' });
  });
});

describe('atajos de teclado', () => {
  const ev = (key: string, target: unknown = null, mods: Partial<KeyboardEvent> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, target, ...mods }) as unknown as KeyboardEvent;
  const el = (matches: boolean) => ({ closest: () => (matches ? {} : null) });
  it('responde a una sola tecla fuera de campos y del laboratorio', () => {
    expect(shortcutKey(ev('C'))).toBe('c');
    expect(shortcutKey(ev('?'))).toBe('?');
    expect(shortcutKey(ev('c', el(true)))).toBeNull();
    expect(shortcutKey(ev('c', el(false)))).toBe('c');
    expect(shortcutKey(ev('c', null, { ctrlKey: true }))).toBeNull();
    expect(shortcutKey(ev('ArrowLeft'))).toBeNull();
  });
});

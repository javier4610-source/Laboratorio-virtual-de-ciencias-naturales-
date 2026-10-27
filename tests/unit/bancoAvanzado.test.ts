import { describe, expect, it } from 'vitest';
import { ADVANCED_BANK, blocksIn, scoreAnswers, suggestReinforcement, weakest } from '../../src/assessment/avanzado';
import { BLOQUES } from '../../src/assessment/avanzado/bloques';
import { advancedToExportItem, crossTable, resultsCsv, studentTemplateCsv } from '../../src/assessment/avanzado/instruments';
import { claveMd, cuadernilloMd, renderDocs, solucionarioMd, instrumentosMd } from '../../src/assessment/avanzado/markdown';
import { BLOCK_TARGET, BLOCKS, type AdvancedItem, type BlockId, type Key } from '../../src/assessment/avanzado/types';
import { findKeyCycle, formatProblems, keyIsLongest, keyStats, normalizeText, validateBank, validateBlock, validateItem } from '../../src/assessment/avanzado/validate';
import { PRACTICES } from '../../src/curriculum/index';
import { toGift, toMoodleXml } from '../../src/lib/lmsExport';
import { MUESTRA_AVANZADO } from '../fixtures/avanzado-muestra';

const clone = <T>(x: T): T => structuredClone(x);
const codes = (ps: { code: string }[]) => ps.map((p) => p.code);
const errorsOf = (it: AdvancedItem) => validateItem(it).filter((p) => p.severity === 'error');

/* ----------------------------- Banco publicado ----------------------------- */
describe('banco avanzado publicado (lo que haya registrado en bloques.ts)', () => {
  const report = validateBank(ADVANCED_BANK, { practiceIds: new Set(PRACTICES.map((p) => p.id)) });

  it('no tiene errores de validación', () => {
    const errors = report.problems.filter((p) => p.severity === 'error');
    expect(errors, formatProblems(errors)).toEqual([]);
  });

  it('cada bloque registrado está completo (30 ítems) y es de un único bloque', () => {
    for (const block of BLOQUES) {
      const ids = new Set(block.map((it) => it.block));
      expect(ids.size).toBe(1);
      const b = [...ids][0] as BlockId;
      expect(block).toHaveLength(BLOCKS[b].range[1] - BLOCKS[b].range[0] + 1);
    }
  });

  it('el banco está ordenado por número y no incluye la muestra de pruebas', () => {
    expect(ADVANCED_BANK.map((it) => it.n)).toEqual([...ADVANCED_BANK.map((it) => it.n)].sort((a, b) => a - b));
    for (const m of MUESTRA_AVANZADO) expect(ADVANCED_BANK.find((it) => it.id === m.id && it.context === m.context)).toBeUndefined();
  });

  it('los documentos se generan sin claves en el cuadernillo', () => {
    const docs = renderDocs(ADVANCED_BANK);
    expect(docs['02-CUADERNILLO.md']).not.toMatch(/Clave|Justificación/);
  });
});

/* ------------------------------ Validador: ítem ----------------------------- */
describe('validador · ítems', () => {
  it('la muestra es válida ítem por ítem (sin errores)', () => {
    for (const it of MUESTRA_AVANZADO) expect(errorsOf(it), formatProblems(errorsOf(it))).toEqual([]);
  });

  it('detecta id mal formado, id que no coincide con el número o el bloque y número fuera de rango', () => {
    const a = clone(MUESTRA_AVANZADO[0]);
    a.id = 'SN-A-1';
    expect(codes(errorsOf(a))).toContain('id-formato');
    const b = clone(MUESTRA_AVANZADO[0]);
    b.id = 'SN-A-002';
    expect(codes(errorsOf(b))).toContain('id-numero');
    const c = clone(MUESTRA_AVANZADO[0]);
    c.id = 'SN-B-001';
    expect(codes(errorsOf(c))).toEqual(expect.arrayContaining(['id-bloque']));
    const d = clone(MUESTRA_AVANZADO[0]);
    d.n = 45; d.id = 'SN-A-045';
    expect(codes(errorsOf(d))).toContain('rango');
  });

  it('detecta campos vacíos, opciones repetidas o vacías, opciones prohibidas y clave inválida', () => {
    const a = clone(MUESTRA_AVANZADO[0]);
    a.stem = '  '; a.pitfall = '';
    expect(codes(errorsOf(a)).filter((c) => c === 'campo-vacio')).toHaveLength(2);
    const b = clone(MUESTRA_AVANZADO[0]);
    b.options.C = b.options.A.toUpperCase();
    expect(codes(errorsOf(b))).toContain('opciones-repetidas');
    const c = clone(MUESTRA_AVANZADO[0]);
    c.options.D = '';
    expect(codes(errorsOf(c))).toContain('opcion-vacia');
    const d = clone(MUESTRA_AVANZADO[0]);
    d.options.D = 'Todas las anteriores.';
    expect(codes(errorsOf(d))).toContain('opcion-prohibida');
    const e = clone(MUESTRA_AVANZADO[0]);
    e.options.A = 'Ninguna de las anteriores';
    expect(codes(errorsOf(e))).toContain('opcion-prohibida');
    const f = clone(MUESTRA_AVANZADO[0]);
    (f as { key: string }).key = 'E';
    expect(codes(errorsOf(f))).toContain('clave');
  });

  it('exige explicar exactamente los tres distractores', () => {
    const a = clone(MUESTRA_AVANZADO[0]);
    delete a.distractors.A;
    expect(codes(errorsOf(a))).toContain('distractores');
    const b = clone(MUESTRA_AVANZADO[0]);
    b.distractors.B = { why: 'x', misconception: 'y' }; // la clave no lleva análisis de distractor
    expect(codes(errorsOf(b))).toContain('distractores');
    const c = clone(MUESTRA_AVANZADO[0]);
    c.distractors.C = { why: '', misconception: 'algo' };
    expect(codes(errorsOf(c))).toContain('distractor-vacio');
  });

  it('exige 15 valoraciones de calidad y marca «No cumple» como error y «Requiere ajuste» como aviso', () => {
    const a = clone(MUESTRA_AVANZADO[0]);
    a.qa = a.qa.slice(0, 14);
    expect(codes(errorsOf(a))).toContain('qa');
    const b = clone(MUESTRA_AVANZADO[0]);
    b.qa[3] = 'No cumple'; b.qa[4] = 'Requiere ajuste';
    const ps = validateItem(b);
    expect(ps.find((p) => p.code === 'qa-no-cumple')?.severity).toBe('error');
    expect(ps.find((p) => p.code === 'qa-ajuste')?.severity).toBe('aviso');
  });

  it('exige rotular los datos ficticios en el contexto o en el título de la tabla o gráfica', () => {
    const a = clone(MUESTRA_AVANZADO[1]);
    a.context = 'Un técnico prepara soluciones de cloruro de sodio a partir de una solución madre de 2,0 mol/L.';
    a.table!.caption = 'Preparación de diluciones de NaCl';
    expect(codes(errorsOf(a))).toContain('datos-sin-rotulo');
  });

  it('revisa la coherencia de tablas y gráficas', () => {
    const a = clone(MUESTRA_AVANZADO[1]);
    a.table!.rows[1] = ['2', 50];
    expect(codes(errorsOf(a))).toContain('tabla-columnas');
    const b = clone(MUESTRA_AVANZADO[2]);
    b.chart!.series[0].points[1] = [20, Number.NaN];
    expect(codes(errorsOf(b))).toContain('grafica-finito');
    const c = clone(MUESTRA_AVANZADO[2]);
    c.chart!.kind = 'barras';
    expect(codes(errorsOf(c))).toContain('grafica-categorias');
    const d = clone(MUESTRA_AVANZADO[2]);
    delete d.chart;
    expect(codes(errorsOf(d))).toContain('recurso-grafica');
    const e = clone(MUESTRA_AVANZADO[1]);
    delete e.table;
    expect(codes(errorsOf(e))).toContain('recurso-tabla');
  });

  it('verifica la práctica relacionada cuando se dan los ids', () => {
    const a = clone(MUESTRA_AVANZADO[0]);
    a.practiceId = 'no-existe';
    expect(codes(validateItem(a, { practiceIds: new Set(['densidad']) }))).toContain('practica');
  });

  it('normaliza textos para comparar duplicados', () => {
    expect(normalizeText('¿Cuál   es la ÓSMOSIS?')).toBe('cual es la osmosis');
  });
});

/* ----------------------------- Validador: bloque ---------------------------- */
/** Bloque sintético de 30 ítems a partir del ítem de muestra del bloque A, con la matriz pedida. */
function syntheticBlock(): AdvancedItem[] {
  const base = MUESTRA_AVANZADO[0];
  const keys: Key[] = ['B', 'D', 'A', 'C', 'C', 'A', 'D', 'B', 'A', 'C', 'B', 'D', 'D', 'A', 'C', 'B', 'A', 'D', 'C', 'B', 'C', 'A', 'B', 'D', 'A', 'C', 'D', 'B', 'C', 'A'];
  const comps = ['uso', 'explicacion', 'indagacion'] as const;
  const levels = [...Array(10).fill(1), ...Array(12).fill(2), ...Array(8).fill(3)];
  return keys.map((key, i) => {
    const it = clone(base);
    const n = i + 1;
    it.n = n;
    it.id = `SN-A-${String(n).padStart(3, '0')}`;
    it.competency = comps[i % 3];
    it.level = levels[i];
    it.context = `${base.context} Variante ${n}.`;
    it.stem = `${base.stem} (caso ${n})`;
    it.resource = i < 8 ? 'experimento' : 'texto';
    // Reubica la opción correcta en la letra `key` intercambiando textos y distractores.
    const opts = { ...it.options };
    [opts[key], opts[base.key]] = [base.options[base.key], base.options[key]];
    it.options = opts;
    it.key = key;
    it.distractors = Object.fromEntries((['A', 'B', 'C', 'D'] as Key[]).filter((k) => k !== key).map((k) => [k, { why: `Incorrecta (${k}).`, misconception: 'Error típico.' }]));
    return it;
  });
}

describe('validador · bloque y banco', () => {
  it('un bloque sintético con la matriz exacta no tiene errores', () => {
    const block = syntheticBlock();
    const errs = validateBlock('A', block).filter((p) => p.severity === 'error');
    expect(errs, formatProblems(errs)).toEqual([]);
    const report = validateBank(block);
    const all = report.problems.filter((p) => p.severity === 'error');
    expect(all, formatProblems(all)).toEqual([]);
    expect(report.complete).toBe(false);
  });

  it('detecta bloque incompleto, matriz de competencias y niveles, pocos ítems de datos y claves desbalanceadas', () => {
    const block = syntheticBlock();
    expect(codes(validateBlock('A', block.slice(0, 29)))).toEqual(expect.arrayContaining(['bloque-tamano', 'bloque-faltantes']));
    const b = syntheticBlock();
    b[0].competency = 'explicacion';
    b[0].level = 3;
    b[0].resource = 'texto';
    expect(codes(validateBlock('A', b))).toEqual(expect.arrayContaining(['matriz-competencia', 'matriz-nivel', 'matriz-datos']));
    const c = syntheticBlock();
    // Tres claves C pasan a A: A queda con 10 y C con 5.
    let moved = 0;
    for (const it of c) if (it.key === 'C' && moved < 3) { it.key = 'A'; moved++; }
    expect(codes(validateBlock('A', c))).toContain('claves-balance');
  });

  it('detecta más de tres claves iguales seguidas y ciclos mecánicos', () => {
    const b = syntheticBlock();
    ['A', 'A', 'A', 'A'].forEach((k, i) => { b[10 + i].key = k as Key; });
    const ps = validateBlock('A', b);
    expect(codes(ps)).toContain('claves-racha');
    expect(keyStats(b.slice(10, 14)).longestRun.length).toBe(4);
    const cyc = syntheticBlock().slice(0, 10).map((it, i) => ({ ...it, key: (['A', 'B', 'C', 'D'] as Key[])[i % 4] }));
    expect(findKeyCycle(cyc)).toBe(1);
    expect(findKeyCycle(syntheticBlock())).toBeNull();
  });

  it('avisa cuando la clave es la opción más larga en más del 40 % de los ítems', () => {
    const b = syntheticBlock().map((it) => ({ ...it, options: { ...it.options, [it.key]: `${it.options[it.key]} con un agregado que la hace la más extensa de todas las opciones` } }));
    expect(b.every(keyIsLongest)).toBe(true);
    const p = validateBlock('A', b).find((x) => x.code === 'pista-longitud');
    expect(p?.severity).toBe('aviso');
  });

  it('detecta ids, números y contextos repetidos en el banco; los enunciados repetidos solo como aviso', () => {
    const a = clone(MUESTRA_AVANZADO);
    a[1] = { ...a[1], id: a[0].id };
    expect(codes(validateBank(a).problems)).toContain('id-repetido');
    const b = clone(MUESTRA_AVANZADO);
    b.push({ ...clone(b[0]), id: 'SN-A-002', n: 2 });
    const rb = validateBank(b);
    expect(codes(rb.problems)).toContain('contexto-repetido');
    expect(rb.problems.find((p) => p.code === 'enunciado-repetido')?.severity).toBe('aviso');
    const c = clone(MUESTRA_AVANZADO);
    c.push({ ...clone(c[0]), id: 'SN-A-001', context: 'Otro contexto.' });
    expect(codes(validateBank(c).problems)).toEqual(expect.arrayContaining(['id-repetido', 'numero-repetido']));
  });

  it('la muestra (tres bloques incompletos) reporta los bloques incompletos y no aplica las metas globales', () => {
    const r = validateBank(MUESTRA_AVANZADO);
    expect(r.complete).toBe(false);
    expect(r.global).toEqual([]);
    expect(Object.keys(r.byBlock).sort()).toEqual(['A', 'C', 'F']);
    expect(codes(r.byBlock.A!)).toContain('bloque-tamano');
    expect(Object.values(r.byItem).flat().filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('aplica las metas globales cuando están los seis bloques', () => {
    const items = (['A', 'B', 'C', 'D', 'E', 'F'] as BlockId[]).map((b, i) => {
      const it = clone(MUESTRA_AVANZADO[0]);
      it.block = b; it.n = BLOCKS[b].range[0]; it.id = `SN-${b}-${String(it.n).padStart(3, '0')}`; it.context = `Contexto ${i}`;
      return it;
    });
    const r = validateBank(items);
    expect(r.complete).toBe(true);
    expect(codes(r.global)).toEqual(expect.arrayContaining(['banco-tamano', 'banco-competencia', 'banco-nivel', 'banco-datos']));
    expect(BLOCK_TARGET.perCompetency * 3).toBe(30);
  });
});

/* -------------------------- Puntaje, refuerzo y CSV ------------------------- */
describe('puntaje, refuerzo e instrumentos', () => {
  const items = MUESTRA_AVANZADO;
  const answers = { 'SN-A-001': 'B', 'SN-C-061': 'A', 'SN-F-151': 'A' } as const;

  it('calcula aciertos por competencia y bloque y el punto más débil', () => {
    const s = scoreAnswers(items, answers);
    expect(s).toMatchObject({ total: 3, correct: 2, answered: 3 });
    expect(s.byCompetency.uso).toEqual({ total: 1, correct: 0 });
    expect(s.byBlock.C).toEqual({ total: 1, correct: 0 });
    expect(weakest(s)).toEqual({ competency: 'uso', block: 'C' });
    expect(suggestReinforcement(items, s, answers).map((it) => it.id)).toEqual(['SN-C-061']);
    expect(blocksIn(items)).toEqual(['A', 'C', 'F']);
  });

  it('la tabla cruzada y el CSV de resultados suman bien', () => {
    const x = crossTable(items, answers);
    expect(x.total).toEqual({ total: 3, correct: 2 });
    expect(x.cells.indagacion.F).toEqual({ total: 1, correct: 1 });
    const csv = resultsCsv(items, answers, { student: 'Ana', course: '11-1', date: '2026-10-27' });
    expect(csv).toContain('Competencia;Bloque A;Bloque C;Bloque F;Total');
    expect(csv).toContain('Total;1/1 (100 %);0/1 (0 %);1/1 (100 %);2/3 (67 %)');
    expect(csv.split('\n').filter((l) => /^\d+;SN-/.test(l))).toHaveLength(3);
  });

  it('la plantilla CSV trae una fila por pregunta con las columnas del estudiante en blanco', () => {
    const lines = studentTemplateCsv(items).trim().split('\n');
    expect(lines[0]).toMatch(/^Estudiante;Curso;Fecha;N\.º;Id;/);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^;;;1;SN-A-001;A;/);
  });

  it('exporta a Moodle XML y GIFT con la justificación y el análisis de distractores', () => {
    const ex = items.map(advancedToExportItem);
    const xml = toMoodleXml(ex, new Date('2026-10-27'));
    expect(xml).toContain('Banco avanzado tipo Saber 11');
    expect(xml).toContain('<idnumber>SN-C-061</idnumber>');
    expect(xml).toContain('Análisis de distractores');
    expect(xml).toContain('bloque-F');
    expect((xml.match(/fraction="100"/g) ?? []).length).toBe(3);
    const gift = toGift(ex, new Date('2026-10-27'));
    expect(gift).toContain('$CATEGORY: $course$/top/Laboratorio Virtual de Ciencias Naturales/Banco avanzado tipo Saber 11/Bloque A');
    expect(gift).toContain('=0,50 mol/L#');
    expect(gift).toContain('Datos ficticios con finalidad didáctica');
  });
});

/* ---------------------------------- Markdown -------------------------------- */
describe('documentos Markdown', () => {
  const at = new Date('2026-10-27');
  it('el cuadernillo trae los ítems numerados sin claves ni justificaciones', () => {
    const md = cuadernilloMd(MUESTRA_AVANZADO, at);
    expect(md).toContain('### Pregunta 61');
    expect(md).toContain('Datos ficticios con finalidad didáctica');
    expect(md).toContain('| Solución | Volumen tomado de la solución madre (mL) | Volumen final (mL) |');
    expect(md).toContain('Gráfica: Semillas germinadas');
    expect(md).not.toMatch(/Clave|Justificación|ósmosis el agua atraviesa/);
  });

  it('la clave consolida respuestas y la distribución por bloque', () => {
    const md = claveMd(MUESTRA_AVANZADO, at);
    expect(md).toContain('1: B');
    expect(md).toContain('61: D');
    expect(md).toMatch(/\| Bloque C \| 0 \| 0 \| 0 \| 1 \|/);
  });

  it('el solucionario y los instrumentos traen lo pedido', () => {
    const sol = solucionarioMd(MUESTRA_AVANZADO, at);
    expect(sol).toContain('### Pregunta 151 · Clave A');
    expect(sol).toContain('Razonamiento que origina el error');
    expect(sol).toContain('Error conceptual que conviene evitar');
    const ins = instrumentosMd(MUESTRA_AVANZADO, undefined, at);
    expect(ins).toContain('Matriz de trazabilidad curricular');
    expect(ins).toContain('| N.º | C1 | C2 |');
    expect(ins).toContain('no está validado psicométricamente');
    const docs = renderDocs(MUESTRA_AVANZADO, at);
    expect(Object.keys(docs)).toEqual(['02-CUADERNILLO.md', '03-CLAVE.md', '04-SOLUCIONARIO.md', '05-INSTRUMENTOS.md', '06-REFERENCIAS-DATOS.md']);
    expect(docs['06-REFERENCIAS-DATOS.md']).toContain('SN-F-151');
  });
});

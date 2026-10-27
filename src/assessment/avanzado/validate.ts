/**
 * Validador puro del banco avanzado (sin DOM ni dependencias del currículo). Revisa cada ítem, cada bloque registrado
 * y, cuando están los seis bloques, el banco completo. Devuelve problemas con gravedad:
 *  - «error»: incumple el esquema, la matriz del bloque o una regla de construcción (el banco no se debe publicar así).
 *  - «aviso»: conviene revisarlo (posible pista por longitud de opciones, enunciado genérico repetido, etc.).
 * Las metas por bloque vienen de BLOCK_TARGET (types.ts); son decisiones metodológicas del banco, no reglas del ICFES.
 */
import type { Competency } from '../../core/types';
import { BLOCK_TARGET, BLOCKS, QA_CRITERIA, type AdvancedItem, type BlockId, type Key, type Level } from './types';
import { BLOCK_IDS, COMPETENCIES, CONTEXT_NAME, KEYS, LEVELS, RESOURCE_NAME } from './labels';

export type Severity = 'error' | 'aviso';
export interface Problem {
  severity: Severity;
  /** Ítem («SN-A-001»), bloque («Bloque A») o «Banco». */
  ref: string;
  code: string;
  message: string;
}

export interface BankReport {
  problems: Problem[];
  byItem: Record<string, Problem[]>;
  byBlock: Partial<Record<BlockId, Problem[]>>;
  global: Problem[];
  errors: number;
  warnings: number;
  /** true si están los seis bloques y se aplicaron las metas globales. */
  complete: boolean;
}

export interface ValidateOptions {
  /** Ids de prácticas existentes, para verificar `practiceId` (si se omite, no se verifica). */
  practiceIds?: ReadonlySet<string>;
}

/** Metas globales del banco completo (decisión metodológica del banco). */
export const GLOBAL_TARGET = { total: 180, perCompetency: 60, levels: { 1: 60, 2: 72, 3: 48 } as Record<Level, number>, minData: 45 };

const ID_RE = /^SN-([A-F])-(\d{3})$/;
const FORBIDDEN_OPTION = /\b(todas|ninguna)\s+(de\s+)?las\s+(anteriores|opciones\s+anteriores)\b/i;
const SIMULATED_MARK = /ficticio|ficticia|didáctic|didactic|simulad/i;
const CHECKS = new Set(['Cumple', 'Requiere ajuste', 'No cumple']);

/** Texto normalizado para comparar duplicados: sin tildes, sin signos y con espacios simples. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
}

const blank = (s: unknown) => typeof s !== 'string' || s.trim() === '';

/** Problemas de un ítem aislado (esquema, opciones, distractores, datos, gráfica y tabla, revisión de calidad). */
export function validateItem(it: AdvancedItem, opts: ValidateOptions = {}): Problem[] {
  const out: Problem[] = [];
  const ref = it.id || `n=${it.n}`;
  const err = (code: string, message: string) => out.push({ severity: 'error', ref, code, message });
  const warn = (code: string, message: string) => out.push({ severity: 'aviso', ref, code, message });

  // Identificador, número y bloque.
  const m = ID_RE.exec(it.id ?? '');
  if (!m) err('id-formato', `El id «${it.id}» no tiene el formato SN-<bloque>-<nnn>.`);
  if (!BLOCK_IDS.includes(it.block)) err('bloque', `Bloque «${it.block}» desconocido.`);
  if (!Number.isInteger(it.n)) err('numero', `El número «${it.n}» no es entero.`);
  if (m && m[1] !== it.block) err('id-bloque', `El id dice bloque ${m[1]} pero el ítem es del bloque ${it.block}.`);
  if (m && Number(m[2]) !== it.n) err('id-numero', `El id dice ${Number(m[2])} pero el número del ítem es ${it.n}.`);
  if (BLOCKS[it.block]) {
    const [lo, hi] = BLOCKS[it.block].range;
    if (it.n < lo || it.n > hi) err('rango', `El número ${it.n} está fuera del rango del bloque ${it.block} (${lo}–${hi}).`);
  }

  // Campos obligatorios.
  for (const f of ['topic', 'affirmation', 'evidence', 'context', 'stem', 'justification', 'pitfall', 'strategy'] as const) {
    if (blank(it[f])) err('campo-vacio', `Falta el campo «${f}».`);
  }
  if (!COMPETENCIES.includes(it.competency as Competency)) err('competencia', `Competencia «${it.competency}» desconocida.`);
  if (!LEVELS.includes(it.level)) err('nivel', `Nivel «${it.level}» fuera de 1–3.`);
  if (!(it.contextType in CONTEXT_NAME)) err('tipo-contexto', `Tipo de contexto «${it.contextType}» desconocido.`);
  if (!(it.resource in RESOURCE_NAME)) err('recurso', `Recurso «${it.resource}» desconocido.`);
  if (typeof it.simulatedData !== 'boolean') err('datos-simulados', 'Falta indicar si los datos son simulados (simulatedData).');

  // Opciones y clave.
  const opts4 = it.options ?? ({} as Record<Key, string>);
  const keysPresent = Object.keys(opts4);
  if (keysPresent.length !== 4 || !KEYS.every((k) => k in opts4)) err('opciones', 'Debe haber exactamente cuatro opciones A, B, C y D.');
  const texts = KEYS.map((k) => opts4[k]);
  if (texts.some(blank)) err('opcion-vacia', 'Hay opciones vacías.');
  const norm = texts.filter((t) => !blank(t)).map(normalizeText);
  if (new Set(norm).size !== norm.length) err('opciones-repetidas', 'Hay opciones repetidas.');
  for (const k of KEYS) if (typeof opts4[k] === 'string' && FORBIDDEN_OPTION.test(opts4[k])) err('opcion-prohibida', `La opción ${k} usa «todas/ninguna de las anteriores».`);
  if (!KEYS.includes(it.key)) err('clave', `La clave «${it.key}» no es A, B, C ni D.`);

  // Distractores: exactamente las tres letras distintas de la clave, con explicación y error de razonamiento.
  const dKeys = Object.keys(it.distractors ?? {}).sort();
  const expected = KEYS.filter((k) => k !== it.key);
  if (dKeys.join() !== expected.join()) err('distractores', `Los distractores explicados deben ser ${expected.join(', ')} (hay: ${dKeys.join(', ') || 'ninguno'}).`);
  for (const k of expected) {
    const d = it.distractors?.[k];
    if (d && (blank(d.why) || blank(d.misconception))) err('distractor-vacio', `El distractor ${k} no explica por qué es incorrecto o qué razonamiento lo origina.`);
  }

  // Revisión de calidad (15 criterios).
  if (!Array.isArray(it.qa) || it.qa.length !== QA_CRITERIA.length) err('qa', `La revisión de calidad debe tener ${QA_CRITERIA.length} valoraciones (tiene ${Array.isArray(it.qa) ? it.qa.length : 0}).`);
  else {
    it.qa.forEach((c, i) => {
      if (!CHECKS.has(c)) err('qa-valor', `Valoración desconocida «${c}» en «${QA_CRITERIA[i]}».`);
      else if (c === 'No cumple') err('qa-no-cumple', `No cumple: «${QA_CRITERIA[i]}».`);
      else if (c === 'Requiere ajuste') warn('qa-ajuste', `Requiere ajuste: «${QA_CRITERIA[i]}».`);
    });
  }

  // Recurso y representaciones.
  if (it.resource === 'tabla' && !it.table) err('recurso-tabla', 'El recurso es «tabla» pero el ítem no trae tabla.');
  if (it.resource === 'grafica' && !it.chart) err('recurso-grafica', 'El recurso es «gráfica» pero el ítem no trae gráfica.');
  if (it.resource === 'esquema' && !it.schemeDescription && !it.chart && !it.table) warn('recurso-esquema', 'El recurso es «esquema» pero no hay descripción del esquema.');
  if (it.table) {
    const t = it.table;
    if (blank(t.caption)) err('tabla-titulo', 'La tabla no tiene título.');
    if (!t.headers?.length || t.headers.some(blank)) err('tabla-encabezados', 'La tabla tiene encabezados vacíos o no tiene encabezados.');
    if (!t.rows?.length) err('tabla-filas', 'La tabla no tiene filas.');
    t.rows?.forEach((r, i) => {
      if (r.length !== t.headers.length) err('tabla-columnas', `La fila ${i + 1} de la tabla tiene ${r.length} celdas y hay ${t.headers.length} encabezados.`);
      if (r.some((c) => typeof c === 'number' && !Number.isFinite(c))) err('tabla-numero', `La fila ${i + 1} de la tabla tiene un número no finito.`);
    });
  }
  if (it.chart) {
    const c = it.chart;
    if (!['linea', 'barras', 'dispersion'].includes(c.kind)) err('grafica-tipo', `Tipo de gráfica «${c.kind}» desconocido.`);
    for (const f of ['title', 'xLabel', 'yLabel', 'description'] as const) if (blank(c[f])) err('grafica-campo', `La gráfica no tiene «${f}».`);
    if (!c.series?.length) err('grafica-series', 'La gráfica no tiene series.');
    c.series?.forEach((s) => {
      if (blank(s.name)) err('grafica-serie', 'Hay una serie sin nombre.');
      if (!s.points?.length) err('grafica-puntos', `La serie «${s.name}» no tiene puntos.`);
      if (s.points?.some((p) => p.length !== 2 || !p.every(Number.isFinite))) err('grafica-finito', `La serie «${s.name}» tiene puntos no finitos.`);
      if (c.kind === 'barras' && (!c.categories || c.categories.length !== s.points.length)) err('grafica-categorias', `La serie «${s.name}» no tiene una categoría por barra.`);
    });
    if (!blank(c.yLabel) && !/\(.+\)/.test(c.yLabel)) warn('grafica-unidad', `El eje vertical «${c.yLabel}» no indica unidad entre paréntesis.`);
    if (c.kind !== 'barras' && !blank(c.xLabel) && !/\(.+\)/.test(c.xLabel)) warn('grafica-unidad', `El eje horizontal «${c.xLabel}» no indica unidad entre paréntesis.`);
  }

  // Datos simulados rotulados; datos reales con fuente.
  if (it.simulatedData) {
    const where = [it.context, it.table?.caption, it.chart?.title, it.chart?.description].filter(Boolean).join(' ');
    if (!SIMULATED_MARK.test(where)) err('datos-sin-rotulo', 'Los datos son simulados pero el contexto o el título de la tabla/gráfica no dice que son ficticios o didácticos.');
  } else if ((it.table || it.chart) && blank(it.source)) {
    warn('datos-sin-fuente', 'Hay datos que no se declaran ficticios y el ítem no cita una fuente.');
  }

  if (it.practiceId && opts.practiceIds && !opts.practiceIds.has(it.practiceId)) err('practica', `La práctica relacionada «${it.practiceId}» no existe.`);
  return out;
}

/** Recuento de claves y la racha más larga (en el orden dado). */
export function keyStats(items: readonly AdvancedItem[]): { counts: Record<Key, number>; longestRun: { key: Key | null; length: number; startN: number | null } } {
  const counts: Record<Key, number> = { A: 0, B: 0, C: 0, D: 0 };
  let best = { key: null as Key | null, length: 0, startN: null as number | null };
  let run = 0;
  items.forEach((it, i) => {
    if (it.key in counts) counts[it.key]++;
    run = i > 0 && items[i - 1].key === it.key ? run + 1 : 1;
    if (run > best.length) best = { key: it.key, length: run, startN: items[i - run + 1].n };
  });
  return { counts, longestRun: best };
}

/** Ciclo mecánico de claves (p. ej. ABCDABCD): devuelve el número donde empieza o null. */
export function findKeyCycle(items: readonly AdvancedItem[]): number | null {
  const k = items.map((it) => it.key);
  for (const p of [2, 3, 4]) {
    const len = 2 * p + 2;
    for (let i = 0; i + len <= k.length; i++) {
      const head = k.slice(i, i + p);
      if (new Set(head).size !== p) continue;
      let cyc = true;
      for (let j = i + p; j < i + len; j++) if (k[j] !== k[j - p]) { cyc = false; break; }
      if (cyc) return items[i].n;
    }
  }
  return null;
}

/** ¿La clave es la opción estrictamente más larga? (pista involuntaria si pasa muy a menudo). */
export function keyIsLongest(it: AdvancedItem): boolean {
  const len = (k: Key) => (it.options?.[k] ?? '').trim().length;
  return KEYS.every((k) => k === it.key || len(it.key) > len(k));
}

const countBy = <T extends string | number>(items: readonly AdvancedItem[], f: (it: AdvancedItem) => T) => {
  const m = new Map<T, number>();
  for (const it of items) m.set(f(it), (m.get(f(it)) ?? 0) + 1);
  return m;
};
const isData = (it: AdvancedItem) => it.resource !== 'texto';

/** Matriz del bloque (30 ítems, competencias, niveles, datos, claves, rachas, ciclos y pistas por longitud). */
export function validateBlock(block: BlockId, blockItems: readonly AdvancedItem[]): Problem[] {
  const out: Problem[] = [];
  const ref = `Bloque ${block}`;
  const err = (code: string, message: string) => out.push({ severity: 'error', ref, code, message });
  const warn = (code: string, message: string) => out.push({ severity: 'aviso', ref, code, message });
  const items = [...blockItems].sort((a, b) => a.n - b.n);
  const [lo, hi] = BLOCKS[block].range;
  const size = hi - lo + 1;

  if (items.length !== size) err('bloque-tamano', `El bloque tiene ${items.length} ítems y deben ser ${size}.`);
  const missing: number[] = [];
  for (let n = lo; n <= hi; n++) if (!items.some((it) => it.n === n)) missing.push(n);
  if (missing.length && missing.length < size) err('bloque-faltantes', `Faltan los números ${missing.join(', ')}.`);

  const comp = countBy(items, (it) => it.competency);
  for (const c of COMPETENCIES) {
    const v = comp.get(c) ?? 0;
    if (v !== BLOCK_TARGET.perCompetency) err('matriz-competencia', `Competencia «${c}»: ${v} ítems (meta ${BLOCK_TARGET.perCompetency}).`);
  }
  const lev = countBy(items, (it) => it.level);
  for (const l of LEVELS) {
    const v = lev.get(l) ?? 0;
    if (v !== BLOCK_TARGET.levels[l]) err('matriz-nivel', `Nivel ${l}: ${v} ítems (meta ${BLOCK_TARGET.levels[l]}).`);
  }
  const data = items.filter(isData).length;
  if (data < BLOCK_TARGET.minData) err('matriz-datos', `Solo ${data} ítems exigen interpretar datos, tablas, gráficas, esquemas, experimentos o modelos (mínimo ${BLOCK_TARGET.minData}).`);

  const { counts, longestRun } = keyStats(items);
  for (const k of KEYS) {
    if (counts[k] < BLOCK_TARGET.keyMin || counts[k] > BLOCK_TARGET.keyMax) err('claves-balance', `La clave ${k} aparece ${counts[k]} veces (debe estar entre ${BLOCK_TARGET.keyMin} y ${BLOCK_TARGET.keyMax}).`);
  }
  if (longestRun.length > BLOCK_TARGET.maxRun) err('claves-racha', `Hay ${longestRun.length} claves ${longestRun.key} seguidas desde el ítem ${longestRun.startN} (máximo ${BLOCK_TARGET.maxRun}).`);
  const cyc = findKeyCycle(items);
  if (cyc !== null) warn('claves-ciclo', `Las claves siguen un ciclo mecánico desde el ítem ${cyc}.`);

  const longest = items.filter(keyIsLongest).length;
  if (items.length && longest / items.length > 0.4) warn('pista-longitud', `La clave es la opción más larga en ${longest} de ${items.length} ítems (${Math.round((longest / items.length) * 100)} %; conviene ≤ 40 %).`);
  return out;
}

/** Valida todo lo que haya: cada ítem, los duplicados, cada bloque presente y, si están los seis, el banco completo. */
export function validateBank(items: readonly AdvancedItem[], opts: ValidateOptions = {}): BankReport {
  const byItem: Record<string, Problem[]> = {};
  const byBlock: Partial<Record<BlockId, Problem[]>> = {};
  const global: Problem[] = [];
  const sorted = [...items].sort((a, b) => a.n - b.n);
  const addItem = (p: Problem) => { (byItem[p.ref] ??= []).push(p); };

  for (const it of sorted) {
    byItem[it.id] ??= [];
    validateItem(it, opts).forEach(addItem);
  }

  // Unicidad de ids y números; duplicados de contexto (error) y de enunciado (aviso: un enunciado genérico puede repetirse).
  const dup = <T>(f: (it: AdvancedItem) => T, onDup: (it: AdvancedItem, first: AdvancedItem) => void) => {
    const seen = new Map<T, AdvancedItem>();
    for (const it of sorted) {
      const v = f(it);
      const first = seen.get(v);
      if (first) onDup(it, first); else seen.set(v, it);
    }
  };
  dup((it) => it.id, (it) => addItem({ severity: 'error', ref: it.id, code: 'id-repetido', message: `El id ${it.id} está repetido.` }));
  dup((it) => it.n, (it, first) => addItem({ severity: 'error', ref: it.id, code: 'numero-repetido', message: `El número ${it.n} ya lo usa ${first.id}.` }));
  dup((it) => normalizeText(it.context ?? ''), (it, first) => addItem({ severity: 'error', ref: it.id, code: 'contexto-repetido', message: `El contexto repite el de ${first.id}.` }));
  dup((it) => normalizeText(it.stem ?? ''), (it, first) => addItem({ severity: 'aviso', ref: it.id, code: 'enunciado-repetido', message: `El enunciado es igual al de ${first.id}; revisa que la tarea sea distinta.` }));

  for (const b of BLOCK_IDS) {
    const bi = sorted.filter((it) => it.block === b);
    if (bi.length) byBlock[b] = validateBlock(b, bi);
  }

  const complete = BLOCK_IDS.every((b) => byBlock[b]);
  if (complete) {
    const err = (code: string, message: string) => global.push({ severity: 'error', ref: 'Banco', code, message });
    if (sorted.length !== GLOBAL_TARGET.total) err('banco-tamano', `El banco tiene ${sorted.length} ítems (meta ${GLOBAL_TARGET.total}).`);
    const comp = countBy(sorted, (it) => it.competency);
    for (const c of COMPETENCIES) if ((comp.get(c) ?? 0) !== GLOBAL_TARGET.perCompetency) err('banco-competencia', `Competencia «${c}»: ${comp.get(c) ?? 0} (meta ${GLOBAL_TARGET.perCompetency}).`);
    const lev = countBy(sorted, (it) => it.level);
    for (const l of LEVELS) if ((lev.get(l) ?? 0) !== GLOBAL_TARGET.levels[l]) err('banco-nivel', `Nivel ${l}: ${lev.get(l) ?? 0} (meta ${GLOBAL_TARGET.levels[l]}).`);
    const data = sorted.filter(isData).length;
    if (data < GLOBAL_TARGET.minData) err('banco-datos', `Solo ${data} ítems con datos o representaciones (mínimo ${GLOBAL_TARGET.minData}).`);
    const { longestRun } = keyStats(sorted);
    if (longestRun.length > BLOCK_TARGET.maxRun) err('banco-racha', `Hay ${longestRun.length} claves ${longestRun.key} seguidas desde el ítem ${longestRun.startN}, cruzando bloques.`);
  }

  const problems = [...Object.values(byItem).flat(), ...Object.values(byBlock).flat(), ...global] as Problem[];
  return {
    problems, byItem, byBlock, global, complete,
    errors: problems.filter((p) => p.severity === 'error').length,
    warnings: problems.filter((p) => p.severity === 'aviso').length,
  };
}

/** Resumen legible de los problemas (para la consola del generador y los mensajes de las pruebas). */
export function formatProblems(problems: readonly Problem[]): string {
  return problems.map((p) => `[${p.severity}] ${p.ref} · ${p.code}: ${p.message}`).join('\n');
}

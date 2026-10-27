/**
 * Documentos Markdown del banco avanzado (partes II a VI del encargo): cuadernillo sin claves, clave consolidada,
 * solucionario, instrumentos para el docente y referencias de datos. Funciones puras: las usa scripts/banco-avanzado.mjs
 * para escribir docs/banco-saber11/ y las pruebas unitarias para revisar el contenido.
 * La Parte I (01-FUNDAMENTACION.md) la escribe el docente a mano y este módulo no la genera.
 */
import type { Competency } from '../../core/types';
import { BLOCKS, QA_CRITERIA, type AdvancedItem, type BlockId, type Check, type ItemChart, type ItemTable } from './types';
import { BLOCK_IDS, COMPETENCIES, COMPETENCY_NAME, CONTEXT_NAME, DISCLAIMER, KEYS, LEVEL_NAME, RESOURCE_NAME, TIMER_NOTE } from './labels';
import { findKeyCycle, keyStats, validateBank, type BankReport } from './validate';

export const DOC_FILES = ['02-CUADERNILLO.md', '03-CLAVE.md', '04-SOLUCIONARIO.md', '05-INSTRUMENTOS.md', '06-REFERENCIAS-DATOS.md'] as const;
export type DocFile = (typeof DOC_FILES)[number];

const cell = (v: string | number) => (typeof v === 'number' ? fmtNum(v) : v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
/** Número con coma decimal y signo menos tipográfico, como en la interfaz. */
export const fmtNum = (v: number) => String(v).replace('.', ',').replace(/^-/, '−');
const mdTable = (headers: string[], rows: (string | number)[][]) => [
  `| ${headers.map(cell).join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
].join('\n');

const blockTitle = (b: BlockId) => `Bloque ${b}. ${BLOCKS[b].name} (preguntas ${BLOCKS[b].range[0]}–${BLOCKS[b].range[1]})`;
const SIM_LABEL = '> *Datos ficticios con finalidad didáctica.*';

function tableMd(t: ItemTable): string {
  return `**${t.caption}**\n\n${mdTable(t.headers, t.rows)}`;
}

/** La gráfica en papel: título, descripción completa y los datos de cada serie en tabla (sin perder información). */
export function chartMd(c: ItemChart): string {
  const parts = [`**Gráfica: ${c.title}**`, '', `*Descripción:* ${c.description}`, ''];
  for (const s of c.series) {
    const rows = s.points.map(([x, y], i) => [c.kind === 'barras' && c.categories ? c.categories[i] ?? fmtNum(x) : x, y]);
    parts.push(`*${s.name}*`, '', mdTable([c.kind === 'barras' ? c.xLabel || 'Categoría' : c.xLabel, c.yLabel], rows), '');
  }
  return parts.join('\n').trimEnd();
}

/** Bloque del ítem tal como lo ve el estudiante (sin clave ni metadatos de evaluación). */
export function itemStudentMd(it: AdvancedItem): string {
  const parts = [`### Pregunta ${it.n}`, ''];
  if (it.simulatedData) parts.push(SIM_LABEL, '');
  parts.push(it.context, '');
  if (it.table) parts.push(tableMd(it.table), '');
  if (it.chart) parts.push(chartMd(it.chart), '');
  if (it.schemeDescription) parts.push(`*Esquema:* ${it.schemeDescription}`, '');
  parts.push(`**${it.stem}**`, '');
  for (const k of KEYS) parts.push(`- **${k}.** ${it.options[k]}`);
  return parts.join('\n');
}

const header = (title: string, generatedAt: Date) => [
  `# ${title}`,
  '',
  `> ${DISCLAIMER}`,
  '',
  `*Documento generado con \`npm run banco\` el ${generatedAt.toISOString().slice(0, 10)} a partir de src/assessment/avanzado. No lo edites a mano: cambia los ítems y vuelve a generarlo.*`,
  '',
].join('\n');

const byBlock = (items: readonly AdvancedItem[]) => BLOCK_IDS.map((b) => [b, items.filter((it) => it.block === b)] as const).filter(([, l]) => l.length > 0);
const coverage = (items: readonly AdvancedItem[]) => {
  const present = byBlock(items).map(([b, l]) => `${b} (${l.length})`);
  return `Bloques incluidos: ${present.join(', ') || 'ninguno'}. Total: ${items.length} de 180 preguntas.`;
};

/* ------------------------------ 02 Cuadernillo ------------------------------ */
export function cuadernilloMd(items: readonly AdvancedItem[], generatedAt = new Date()): string {
  const out = [header('Parte II. Cuadernillo de práctica tipo Saber 11 · Ciencias Naturales', generatedAt), coverage(items), ''];
  out.push(
    '## Instrucciones para el estudiante',
    '',
    '1. Cada pregunta tiene cuatro opciones (A, B, C y D) y **una sola** respuesta correcta.',
    '2. Lee primero el contexto completo: tablas, gráficas y esquemas traen la información necesaria para responder.',
    '3. Marca tu respuesta en la hoja de respuestas. Si dudas, descarta las opciones que contradicen los datos.',
    '4. Las claves y el solucionario están en documentos aparte (03-CLAVE.md y 04-SOLUCIONARIO.md); no los consultes hasta terminar.',
    `5. Si tu docente fija un tiempo, respétalo. ${TIMER_NOTE}`,
    '6. Cuando una pregunta dice que los datos son ficticios, son datos inventados con finalidad didáctica, coherentes y plausibles, pero no provienen de una investigación real.',
    '',
  );
  for (const [b, list] of byBlock(items)) {
    out.push(`## ${blockTitle(b)}`, '');
    for (const it of list) out.push(itemStudentMd(it), '', '---', '');
  }
  return out.join('\n').trimEnd() + '\n';
}

/* --------------------------------- 03 Clave --------------------------------- */
export function claveMd(items: readonly AdvancedItem[], generatedAt = new Date()): string {
  const out = [header('Parte III. Clave de respuestas', generatedAt), coverage(items), ''];
  out.push('## Tabla consolidada', '');
  // Diez columnas de pares «número: clave» por fila para que la tabla de 180 quepa en pocas páginas.
  const per = 10;
  const rows: string[][] = [];
  for (let i = 0; i < items.length; i += per) rows.push(items.slice(i, i + per).map((it) => `${it.n}: ${it.key}`));
  for (const r of rows) while (r.length < per) r.push('');
  out.push(mdTable(Array.from({ length: per }, () => 'N.º: clave'), rows), '');
  out.push('## Detalle por pregunta', '', mdTable(['N.º', 'Id', 'Bloque', 'Competencia', 'Nivel', 'Clave'], items.map((it) => [it.n, it.id, it.block, COMPETENCY_NAME[it.competency], it.level, it.key])), '');
  out.push('## Distribución de claves y revisión de patrones', '');
  const dist = byBlock(items).map(([b, list]) => {
    const s = keyStats(list);
    const cyc = findKeyCycle(list);
    return [`Bloque ${b}`, ...KEYS.map((k) => s.counts[k]), `${s.longestRun.length} (${s.longestRun.key ?? '—'} desde ${s.longestRun.startN ?? '—'})`, cyc === null ? 'No' : `Sí, desde ${cyc}`];
  });
  const all = keyStats(items);
  dist.push(['Total', ...KEYS.map((k) => all.counts[k]), `${all.longestRun.length} (${all.longestRun.key ?? '—'} desde ${all.longestRun.startN ?? '—'})`, findKeyCycle(items) === null ? 'No' : 'Sí']);
  out.push(mdTable(['Bloque', 'A', 'B', 'C', 'D', 'Racha más larga', '¿Ciclo mecánico?'], dist), '');
  out.push('Criterio del banco (decisión metodológica, no regla oficial): en cada bloque, cada letra entre 6 y 9 veces y nunca más de 3 claves iguales seguidas. La calidad científica del ítem prevalece sobre la distribución de claves.');
  return out.join('\n') + '\n';
}

/* ------------------------------ 04 Solucionario ----------------------------- */
export function itemSolutionMd(it: AdvancedItem): string {
  const parts = [
    `### Pregunta ${it.n} · Clave ${it.key}`,
    '',
    `*${it.id} · ${COMPETENCY_NAME[it.competency]} · ${it.topic} · ${LEVEL_NAME[it.level]}*`,
    '',
    `**Respuesta correcta (${it.key}):** ${it.options[it.key]}`,
    '',
    `**Justificación:** ${it.justification}`,
    '',
    '**Análisis de distractores:**',
    '',
  ];
  for (const k of KEYS) {
    const d = it.distractors[k];
    if (k !== it.key && d) parts.push(`- **${k}.** ${d.why} *Razonamiento que origina el error:* ${d.misconception}`);
  }
  parts.push('', `**Error conceptual que conviene evitar:** ${it.pitfall}`, '', `**Estrategia:** ${it.strategy}`);
  if (it.source) parts.push('', `**Fuente:** ${it.source}`);
  return parts.join('\n');
}

export function solucionarioMd(items: readonly AdvancedItem[], generatedAt = new Date()): string {
  const out = [header('Parte IV. Solucionario pedagógico', generatedAt), coverage(items), ''];
  for (const [b, list] of byBlock(items)) {
    out.push(`## ${blockTitle(b)}`, '');
    for (const it of list) out.push(itemSolutionMd(it), '', '---', '');
  }
  return out.join('\n').trimEnd() + '\n';
}

/* ------------------------------ 05 Instrumentos ----------------------------- */
const QA_SHORT: Record<Check, string> = { Cumple: 'C', 'Requiere ajuste': 'RA', 'No cumple': 'NC' };

export function instrumentosMd(items: readonly AdvancedItem[], report: BankReport = validateBank(items), generatedAt = new Date()): string {
  const out = [header('Parte V. Instrumentos para el docente', generatedAt), coverage(items), ''];
  out.push('## 1. Matriz de trazabilidad curricular', '');
  out.push('Las afirmaciones y evidencias son formulaciones operativas propias del banco, no transcripciones de documentos oficiales.', '');
  out.push(mdTable(
    ['N.º', 'Bloque', 'Tema', 'Competencia', 'Afirmación', 'Evidencia', 'Nivel', 'Contexto', 'Recurso', 'Clave'],
    items.map((it) => [it.n, it.block, it.topic, COMPETENCY_NAME[it.competency], it.affirmation, it.evidence, it.level, CONTEXT_NAME[it.contextType], RESOURCE_NAME[it.resource], it.key]),
  ), '');

  out.push('## 2. Lista de control de calidad', '');
  out.push('Valoración interna por criterio: C = Cumple, RA = Requiere ajuste, NC = No cumple.', '');
  out.push(mdTable(['N.º', 'Criterio'], QA_CRITERIA.map((c, i) => [`C${i + 1}`, c])), '');
  out.push(mdTable(['N.º', ...QA_CRITERIA.map((_, i) => `C${i + 1}`)], items.map((it) => [it.n, ...QA_CRITERIA.map((_, i) => QA_SHORT[it.qa[i]] ?? '—')])), '');
  out.push(`Revisión automática (npm run banco): ${report.errors} errores y ${report.warnings} avisos${report.complete ? ', con las metas globales del banco completo' : '; las metas globales se revisan cuando estén los seis bloques'}.`, '');
  out.push('El banco está revisado con criterios técnicos, pero **no está validado psicométricamente**: no hay aplicación piloto, ni índices de dificultad, discriminación o confiabilidad. Esos indicadores solo pueden obtenerse con datos reales de aplicación.', '');

  out.push('## 3. Tabla de resultados por competencia y componente', '');
  out.push('Escribe aciertos / preguntas aplicadas en cada celda (o el porcentaje). La aplicación web genera esta tabla al terminar un simulacro y la descarga en CSV.', '');
  const blocks = byBlock(items).map(([b]) => b);
  out.push(mdTable(['Competencia', ...blocks.map((b) => `Bloque ${b}`), 'Total'], [...COMPETENCIES.map((c: Competency) => [COMPETENCY_NAME[c], ...blocks.map(() => ''), '']), ['Total', ...blocks.map(() => ''), '']]), '');

  out.push('## 4. Plantilla para registrar aciertos, errores y dificultades', '');
  out.push('Una fila por estudiante y pregunta. Respuesta: la letra marcada; Acierto: 1 o 0; Dificultad observada: lo que se vio al revisar (p. ej. «confunde correlación con causalidad»). La misma plantilla se descarga en CSV desde el Panel docente → Moodle y Classroom → Banco avanzado.', '');
  out.push(mdTable(['Estudiante', 'Curso', 'Fecha', 'N.º', 'Bloque', 'Competencia', 'Nivel', 'Clave', 'Respuesta', 'Acierto (1/0)', 'Dificultad observada'],
    items.slice(0, 3).map((it) => ['', '', '', it.n, it.block, COMPETENCY_NAME[it.competency], it.level, it.key, '', '', ''])), '');

  out.push('## 5. Recomendaciones para planes de mejoramiento', '');
  out.push(mdTable(['Competencia o bloque con dificultad', 'Evidencia (preguntas y errores frecuentes)', 'Acción de mejora', 'Preguntas de refuerzo sugeridas', 'Responsable', 'Fecha de seguimiento'], [['', '', '', '', '', ''], ['', '', '', '', '', '']]), '');
  out.push('Sugerencias generales: retomar el error conceptual señalado en el solucionario de las preguntas falladas; practicar en modo «Práctica guiada» las preguntas de la competencia más débil; trabajar la lectura de tablas y gráficas con las prácticas del laboratorio relacionadas; y volver a aplicar un simulacro corto con otras preguntas para comparar.');
  return out.join('\n') + '\n';
}

/* --------------------------- 06 Referencias y datos -------------------------- */
export function referenciasMd(items: readonly AdvancedItem[], generatedAt = new Date()): string {
  const out = [header('Parte VI. Referencias y datos didácticos simulados', generatedAt), coverage(items), ''];
  out.push('Los documentos oficiales consultados (ICFES y Ministerio de Educación Nacional) y sus fechas de consulta están en 01-FUNDAMENTACION.md.', '');
  const sim = items.filter((it) => it.simulatedData);
  out.push('## Preguntas con datos ficticios (finalidad didáctica)', '');
  out.push(sim.length
    ? mdTable(['N.º', 'Id', 'Tema', 'Recurso', 'Representación'], sim.map((it) => [it.n, it.id, it.topic, RESOURCE_NAME[it.resource], it.table?.caption ?? it.chart?.title ?? 'Datos en el contexto']))
    : 'Ninguna.', '');
  out.push('Los datos ficticios son internamente coherentes y plausibles, pero no provienen de investigaciones reales ni deben citarse como tales.', '');
  const withSource = items.filter((it) => it.source && it.source.trim());
  out.push('## Fuentes por pregunta', '');
  out.push(withSource.length ? mdTable(['N.º', 'Id', 'Tema', 'Fuente'], withSource.map((it) => [it.n, it.id, it.topic, it.source!])) : 'Ninguna pregunta cita fuentes externas específicas.', '');
  return out.join('\n') + '\n';
}

/** Los cinco documentos generados, por nombre de archivo. */
export function renderDocs(items: readonly AdvancedItem[], generatedAt = new Date()): Record<DocFile, string> {
  const sorted = [...items].sort((a, b) => a.n - b.n);
  const report = validateBank(sorted);
  return {
    '02-CUADERNILLO.md': cuadernilloMd(sorted, generatedAt),
    '03-CLAVE.md': claveMd(sorted, generatedAt),
    '04-SOLUCIONARIO.md': solucionarioMd(sorted, generatedAt),
    '05-INSTRUMENTOS.md': instrumentosMd(sorted, report, generatedAt),
    '06-REFERENCIAS-DATOS.md': referenciasMd(sorted, generatedAt),
  };
}

/**
 * Instrumentos para el docente del banco avanzado (Parte V): tabla de resultados por competencia y bloque, plantilla
 * CSV para registrar aciertos y errores por estudiante, y adaptación a Moodle XML/GIFT reutilizando src/lib/lmsExport.ts.
 * Funciones puras (sin DOM).
 */
import type { Competency, Question, SaberComponent } from '../../core/types';
import { escapeHtml, ROOT_CATEGORY, type ExportItem } from '../../lib/lmsExport';
import { BLOCKS, type AdvancedItem, type BlockId } from './types';
import { BLOCK_IDS, COMPETENCIES, COMPETENCY_NAME, KEYS } from './labels';
import type { Answers, Tally } from './index';
import { fmtNum } from './markdown';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** CSV con «;» (como lo abre Excel en español). */
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(';')).join('\n') + '\n';

/** Tabla cruzada competencia × bloque (aciertos / preguntas), con totales por fila y columna. */
export interface CrossTable {
  blocks: BlockId[];
  cells: Record<Competency, Partial<Record<BlockId, Tally>>>;
  rowTotals: Record<Competency, Tally>;
  colTotals: Partial<Record<BlockId, Tally>>;
  total: Tally;
}

export function crossTable(items: readonly AdvancedItem[], answers: Answers): CrossTable {
  const blocks = BLOCK_IDS.filter((b) => items.some((it) => it.block === b));
  const cells = Object.fromEntries(COMPETENCIES.map((c) => [c, {}])) as CrossTable['cells'];
  const rowTotals = Object.fromEntries(COMPETENCIES.map((c) => [c, { total: 0, correct: 0 }])) as CrossTable['rowTotals'];
  const colTotals: CrossTable['colTotals'] = {};
  const total = { total: 0, correct: 0 };
  for (const it of items) {
    const ok = answers[it.id] === it.key ? 1 : 0;
    for (const t of [(cells[it.competency][it.block] ??= { total: 0, correct: 0 }), rowTotals[it.competency], (colTotals[it.block] ??= { total: 0, correct: 0 }), total]) {
      t.total++;
      t.correct += ok;
    }
  }
  return { blocks, cells, rowTotals, colTotals, total };
}

const tallyText = (t?: Tally) => (t && t.total ? `${t.correct}/${t.total} (${Math.round((t.correct / t.total) * 100)} %)` : '—');

/** Resultados de un simulacro en CSV: tabla competencia × bloque y, debajo, el detalle por pregunta. */
export function resultsCsv(items: readonly AdvancedItem[], answers: Answers, meta: { student?: string; course?: string; date?: string } = {}): string {
  const x = crossTable(items, answers);
  const rows: (string | number)[][] = [
    ['Banco avanzado tipo Saber 11 · resultados del simulacro (material de práctica, no oficial del ICFES)'],
    ['Estudiante', meta.student ?? '', 'Curso', meta.course ?? '', 'Fecha', meta.date ?? ''],
    [],
    ['Competencia', ...x.blocks.map((b) => `Bloque ${b}`), 'Total'],
    ...COMPETENCIES.map((c) => [COMPETENCY_NAME[c], ...x.blocks.map((b) => tallyText(x.cells[c][b])), tallyText(x.rowTotals[c])]),
    ['Total', ...x.blocks.map((b) => tallyText(x.colTotals[b])), tallyText(x.total)],
    [],
    ['N.º', 'Id', 'Bloque', 'Competencia', 'Nivel', 'Tema', 'Clave', 'Respuesta', 'Acierto (1/0)'],
    ...items.map((it) => [it.n, it.id, it.block, COMPETENCY_NAME[it.competency], it.level, it.topic, it.key, answers[it.id] ?? '', answers[it.id] === it.key ? 1 : 0]),
  ];
  return toCsv(rows);
}

/** Plantilla CSV para registrar aciertos, errores y dificultades: una fila por pregunta, columnas del estudiante en blanco. */
export function studentTemplateCsv(items: readonly AdvancedItem[]): string {
  return toCsv([
    ['Estudiante', 'Curso', 'Fecha', 'N.º', 'Id', 'Bloque', 'Competencia', 'Nivel', 'Tema', 'Clave', 'Respuesta del estudiante', 'Acierto (1/0)', 'Dificultad observada'],
    ...items.map((it) => ['', '', '', it.n, it.id, it.block, COMPETENCY_NAME[it.competency], it.level, it.topic, it.key, '', '', '']),
  ]);
}

/* ------------------------------ Moodle y GIFT ------------------------------ */
const BLOCK_COMPONENT: Record<BlockId, SaberComponent> = { A: 'biologico', B: 'biologico', C: 'quimico', D: 'fisico', E: 'fisico', F: 'cts' };
const LEVEL_DIFFICULTY = { 1: 'baja', 2: 'media', 3: 'alta' } as const;
export const ADVANCED_CATEGORY = 'Banco avanzado tipo Saber 11';

/** Contexto en texto: rótulo de datos ficticios, contexto, gráfica (descripción y datos) y esquema. */
function contextText(it: AdvancedItem): string {
  const parts: string[] = [];
  if (it.simulatedData) parts.push('[Datos ficticios con finalidad didáctica]');
  parts.push(it.context);
  if (it.chart) {
    const c = it.chart;
    const data = c.series.map((s) => `${s.name}: ${s.points.map(([x, y], i) => `(${c.kind === 'barras' && c.categories ? c.categories[i] : fmtNum(x)}; ${fmtNum(y)})`).join(', ')}`).join(' · ');
    parts.push(`Gráfica «${c.title}» (eje horizontal: ${c.xLabel}; eje vertical: ${c.yLabel}). ${c.description} Datos: ${data}.`);
  }
  if (it.schemeDescription) parts.push(`Esquema: ${it.schemeDescription}`);
  return parts.join(' ');
}

/** Retroalimentación general: justificación, análisis de distractores, error a evitar y estrategia. */
export function advancedFeedbackHtml(it: AdvancedItem): string {
  const ds = KEYS.filter((k) => k !== it.key && it.distractors[k]).map((k) => `<li><strong>${k}.</strong> ${escapeHtml(it.distractors[k]!.why)} <em>Razonamiento que origina el error:</em> ${escapeHtml(it.distractors[k]!.misconception)}</li>`);
  return [
    `<p><strong>Respuesta correcta: ${it.key}.</strong> ${escapeHtml(it.justification)}</p>`,
    `<p><strong>Análisis de distractores:</strong></p><ul>${ds.join('')}</ul>`,
    `<p><strong>Error que conviene evitar:</strong> ${escapeHtml(it.pitfall)}</p>`,
    `<p><strong>Estrategia:</strong> ${escapeHtml(it.strategy)}</p>`,
    `<p><em>Material original de práctica; no es un ítem oficial del ICFES.</em></p>`,
  ].join('');
}

/** Convierte un ítem avanzado al formato de exportación común (Moodle XML y GIFT de src/lib/lmsExport.ts). */
export function advancedToExportItem(it: AdvancedItem): ExportItem {
  const q: Question = {
    id: it.id,
    grade: 11,
    topic: it.topic,
    competency: it.competency,
    component: BLOCK_COMPONENT[it.block],
    skill: it.evidence,
    difficulty: LEVEL_DIFFICULTY[it.level],
    context: contextText(it),
    table: it.table,
    stem: it.stem,
    options: KEYS.map((k) => ({
      id: k,
      text: it.options[k],
      feedback: k === it.key ? `Correcta. ${it.justification}` : `Incorrecta. ${it.distractors[k]?.why ?? ''} Razonamiento que origina el error: ${it.distractors[k]?.misconception ?? ''}`,
    })),
    correct: it.key,
    explanation: it.justification,
    review: it.strategy,
  };
  return {
    question: q,
    origin: 'banco',
    area: it.block === 'C' ? 'quimica' : it.block === 'D' || it.block === 'E' ? 'fisica' : it.block === 'B' ? 'ambiental' : 'biologia',
    category: [ROOT_CATEGORY, ADVANCED_CATEGORY, `Bloque ${it.block} · ${BLOCKS[it.block].name}`],
    tags: ['banco-avanzado', `bloque-${it.block}`, `competencia-${it.competency}`, `nivel-${it.level}`, `contexto-${it.contextType}`, `recurso-${it.resource}`],
    name: `${it.n}. ${it.topic} (${it.id})`,
    generalFeedbackHtml: advancedFeedbackHtml(it),
  };
}

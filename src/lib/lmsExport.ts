import type { Area, GradeId, PracticeDef, Question, SaberComponent } from '../core/types';
import { AREA_LABEL, COMPETENCY_SHORT } from '../curriculum/grades';
import { practicePermalink } from './permalink';

/**
 * Exportación para plataformas de aprendizaje (LMS), sin servidor: todo se genera en el navegador.
 *
 * - Moodle: preguntas de selección múltiple en formato Moodle XML (recomendado) o GIFT, con la opción correcta
 *   marcada, la retroalimentación de cada opción y la explicación como retroalimentación general.
 * - Google Classroom: no tiene importación de cuestionarios por archivo. Lo que sí funciona es el enlace oficial
 *   «Compartir en Classroom» (https://classroom.google.com/share?url=…&title=…), un texto de tarea para pegar y una
 *   tabla CSV con los enlaces permanentes del catálogo.
 *
 * Funciones puras (sin DOM): las pruebas unitarias verifican el escape, la respuesta correcta y la estructura.
 */

export type QuestionSource = 'todas' | 'banco' | 'practicas';

export interface QuestionFilter {
  source: QuestionSource;
  grade?: GradeId | null;
  area?: Area | null;
  /** Solo las preguntas de esta práctica (su evaluación, sus preguntas de transferencia y las del banco asociadas). */
  practiceId?: string | null;
}

export interface ExportItem {
  question: Question;
  origin: 'banco' | 'practica';
  practice?: PracticeDef;
  area: Area;
  /** Opcionales para otros bancos (p. ej. el banco avanzado): reemplazan la categoría, las etiquetas, el nombre y la retroalimentación general. */
  category?: string[];
  tags?: string[];
  name?: string;
  generalFeedbackHtml?: string;
}

/** Área de una pregunta del banco que no está ligada a una práctica, según su componente de Saber 11. */
export const COMPONENT_AREA: Record<SaberComponent, Area> = { biologico: 'biologia', quimico: 'quimica', fisico: 'fisica', cts: 'ambiental' };

export const ROOT_CATEGORY = 'Laboratorio Virtual de Ciencias Naturales';

/** Reúne las preguntas que cumplen el filtro, sin repetir ids (una pregunta del banco puede estar en varias prácticas). */
export function selectQuestions(filter: QuestionFilter, practices: PracticeDef[], bank: Question[]): ExportItem[] {
  const byId = new Map(practices.map((p) => [p.id, p]));
  const items: ExportItem[] = [];
  const seen = new Set<string>();
  const push = (it: ExportItem) => { if (!seen.has(it.question.id)) { seen.add(it.question.id); items.push(it); } };
  const target = filter.practiceId ? byId.get(filter.practiceId) : undefined;
  if (filter.practiceId && !target) return [];

  if (filter.source !== 'banco') {
    for (const p of target ? [target] : practices) {
      for (const q of p.assessment) push({ question: { ...q, practiceId: p.id }, origin: 'practica', practice: p, area: p.area });
    }
  }
  if (filter.source !== 'practicas') {
    const transfer = new Set(target?.transferQuestionIds ?? []);
    for (const q of bank) {
      if (target && q.practiceId !== target.id && !transfer.has(q.id)) continue;
      const p = target && transfer.has(q.id) ? target : q.practiceId ? byId.get(q.practiceId) : undefined;
      push({ question: q, origin: 'banco', practice: p, area: p?.area ?? COMPONENT_AREA[q.component] });
    }
  }
  return items.filter((it) => (!filter.grade || it.question.grade === filter.grade) && (!filter.area || it.area === filter.area));
}

/* ------------------------------- Escapes -------------------------------- */

/** Quita los caracteres de control que XML 1.0 no admite (dejan el archivo mal formado). */
export function stripInvalidXmlChars(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const ok = c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || c >= 0x10000;
    if (ok) out += ch;
  }
  return out;
}

/** Escape para el contenido y los atributos de XML (los cinco caracteres reservados). */
export function escapeXml(s: string): string {
  return stripInvalidXmlChars(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Escape para texto que va dentro de HTML. */
export function escapeHtml(s: string): string {
  return stripInvalidXmlChars(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Escape de GIFT: la barra invertida y los caracteres especiales ~ = # { } : se anteponen con «\».
 * Los saltos de línea se cambian por espacios porque una línea en blanco termina la pregunta.
 */
export function escapeGift(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/[\\~=#{}:]/g, (c) => `\\${c}`);
}

/** Nombre de categoría de Moodle: una «/» dentro del nombre se escribe «//» (si no, crearía una subcategoría). */
export function categoryPath(parts: string[]): string {
  return ['$course$', 'top', ...parts.map((p) => p.trim().replace(/\//g, '//'))].join('/');
}

/* --------------------------- Contenido común ---------------------------- */

const num = (v: string | number) => (typeof v === 'number' ? String(v).replace('.', ',').replace(/^-/, '−') : v);

/** Enunciado en HTML: contexto, tabla de datos (si la hay) y pregunta. */
export function questionHtml(q: Question): string {
  const parts: string[] = [];
  if (q.context) parts.push(`<p>${escapeHtml(q.context)}</p>`);
  if (q.table) {
    const t = q.table;
    parts.push(
      `<table border="1" cellpadding="4"><caption>${escapeHtml(t.caption)}</caption>`
      + `<thead><tr>${t.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
      + `<tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(num(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
    );
  }
  parts.push(`<p><strong>${escapeHtml(q.stem)}</strong></p>`);
  return parts.join('');
}

/** Retroalimentación general en HTML: explicación, repaso y enlace a la práctica del laboratorio. */
export function generalFeedbackHtml(it: ExportItem): string {
  if (it.generalFeedbackHtml) return it.generalFeedbackHtml;
  const q = it.question;
  const parts = [`<p>${escapeHtml(q.explanation)}</p>`];
  if (q.review) parts.push(`<p><strong>Repaso:</strong> ${escapeHtml(q.review)}</p>`);
  if (it.practice) parts.push(`<p>Practícalo en el laboratorio: <a href="${escapeHtml(practicePermalink(it.practice.id))}">${escapeHtml(it.practice.title)}</a></p>`);
  return parts.join('');
}

export function questionName(q: Question): string {
  return `${q.grade}.º · ${q.topic} (${q.id})`;
}

export function itemCategory(it: ExportItem): string[] {
  if (it.category) return it.category;
  const g = `Grado ${it.question.grade}`;
  return it.origin === 'banco'
    ? [ROOT_CATEGORY, 'Banco tipo Saber 11', g, AREA_LABEL[it.area]]
    : [ROOT_CATEGORY, 'Evaluaciones de las prácticas', g, it.practice?.title ?? 'Sin práctica'];
}

/** Etiquetas sin espacios ni comas, útiles para filtrar en el banco de preguntas de Moodle. */
export function itemTags(it: ExportItem): string[] {
  if (it.tags) return it.tags;
  const q = it.question;
  return [`grado-${q.grade}`, `area-${it.area}`, `competencia-${q.competency}`, `componente-${q.component}`, `dificultad-${q.difficulty}`, ...(it.practice ? [`practica-${it.practice.id}`] : [])];
}

function groupByCategory(items: ExportItem[]): [string, ExportItem[]][] {
  const groups = new Map<string, ExportItem[]>();
  for (const it of items) {
    const key = categoryPath(itemCategory(it));
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return [...groups];
}

/* ------------------------------ Moodle XML ------------------------------ */

/** Comentario XML seguro: no puede contener «--» ni terminar en «-». */
const comment = (s: string) => `<!-- ${stripInvalidXmlChars(s).replace(/-{2,}/g, '-')} -->`;
const text = (s: string) => `<text>${escapeXml(s)}</text>`;
const htmlField = (tag: string, html: string, indent = '    ') => `${indent}<${tag} format="html">\n${indent}  ${text(html)}\n${indent}</${tag}>`;

function moodleQuestion(it: ExportItem): string {
  const q = it.question;
  const correct = q.options.find((o) => o.id === q.correct);
  if (!correct) throw new Error(`La pregunta ${q.id} no tiene la opción correcta «${q.correct}».`);
  const answers = q.options.map((o) => [
    `    <answer fraction="${o.id === q.correct ? '100' : '0'}" format="html">`,
    `      ${text(escapeHtml(o.text))}`,
    `      <feedback format="html">`,
    `        ${text(escapeHtml(o.feedback))}`,
    `      </feedback>`,
    `    </answer>`,
  ].join('\n'));
  return [
    `  ${comment(q.id)}`,
    `  <question type="multichoice">`,
    `    <name>`,
    `      ${text(it.name ?? questionName(q))}`,
    `    </name>`,
    htmlField('questiontext', questionHtml(q)),
    htmlField('generalfeedback', generalFeedbackHtml(it)),
    `    <defaultgrade>1</defaultgrade>`,
    `    <penalty>0.3333333</penalty>`,
    `    <hidden>0</hidden>`,
    `    <idnumber>${escapeXml(q.id)}</idnumber>`,
    `    <single>true</single>`,
    // El orden de las opciones ya está balanceado (src/assessment/balance.ts) y algunas citan casos «A y C».
    `    <shuffleanswers>false</shuffleanswers>`,
    `    <answernumbering>ABCD</answernumbering>`,
    `    <showstandardinstruction>0</showstandardinstruction>`,
    htmlField('correctfeedback', '<p>Respuesta correcta.</p>'),
    htmlField('partiallycorrectfeedback', '<p>Respuesta parcialmente correcta.</p>'),
    htmlField('incorrectfeedback', '<p>Respuesta incorrecta. Lee la retroalimentación de la opción que elegiste.</p>'),
    ...answers,
    `    <tags>`,
    ...itemTags(it).map((t) => `      <tag>${text(t)}</tag>`),
    `    </tags>`,
    `  </question>`,
  ].join('\n');
}

/** Archivo Moodle XML (Banco de preguntas → Importar → «Formato Moodle XML»), en UTF-8. */
export function toMoodleXml(items: ExportItem[], generatedAt = new Date()): string {
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    comment(`${ROOT_CATEGORY}. Preguntas originales de práctica, no son ítems oficiales del ICFES. Generado el ${generatedAt.toISOString().slice(0, 10)}.`),
    '<quiz>',
  ];
  for (const [path, group] of groupByCategory(items)) {
    out.push(
      '  <question type="category">',
      '    <category>',
      `      ${text(path)}`,
      '    </category>',
      '  </question>',
      ...group.map(moodleQuestion),
    );
  }
  out.push('</quiz>', '');
  return out.join('\n');
}

/* --------------------------------- GIFT --------------------------------- */

function giftQuestion(it: ExportItem): string {
  const q = it.question;
  if (!q.options.some((o) => o.id === q.correct)) throw new Error(`La pregunta ${q.id} no tiene la opción correcta «${q.correct}».`);
  const g = (html: string) => escapeGift(html);
  const lines = [
    `// ${q.id}`,
    `::${g(it.name ?? questionName(q))}::[html]${g(questionHtml(q))} {`,
    ...q.options.map((o) => `\t${o.id === q.correct ? '=' : '~'}${g(escapeHtml(o.text))}#${g(escapeHtml(o.feedback))}`),
    `\t####${g(generalFeedbackHtml(it))}`,
    '}',
  ];
  return lines.join('\n');
}

/** Archivo GIFT (Banco de preguntas → Importar → «Formato GIFT»), en UTF-8 y sin BOM. */
export function toGift(items: ExportItem[], generatedAt = new Date()): string {
  const out = [`// ${ROOT_CATEGORY}. Preguntas originales de práctica, no son ítems oficiales del ICFES. Generado el ${generatedAt.toISOString().slice(0, 10)}.`, ''];
  for (const [path, group] of groupByCategory(items)) {
    out.push(`$CATEGORY: ${path}`, '');
    for (const it of group) out.push(giftQuestion(it), '');
  }
  return out.join('\n');
}

/* ---------------------------- Google Classroom --------------------------- */

export const CLASSROOM_SHARE = 'https://classroom.google.com/share';

/** Enlace oficial «Compartir en Classroom»: abre Classroom para elegir la clase y crear la tarea o el material. */
export function classroomShareUrl(p: Pick<PracticeDef, 'id' | 'title'>): string {
  return `${CLASSROOM_SHARE}?url=${encodeURIComponent(practicePermalink(p.id))}&title=${encodeURIComponent(p.title)}`;
}

export interface AssignmentOptions { course?: string; due?: string; }

/** Texto de la tarea para pegar en Classroom (o en cualquier LMS): instrucciones, objetivos, enlace y grado. */
export function assignmentText(p: PracticeDef, opts: AssignmentOptions = {}): string {
  const lines = [
    `Práctica de laboratorio virtual: ${p.title}`,
    `Grado ${p.grade}.º · ${AREA_LABEL[p.area]} · ${p.topic}`,
    `Duración aproximada: ${p.durationMin} minutos`,
    ...(opts.course?.trim() ? [`Curso: ${opts.course.trim()}`] : []),
    ...(opts.due?.trim() ? [`Fecha de entrega: ${opts.due.trim()}`] : []),
    '',
    `Pregunta problema: ${p.problemQuestion}`,
    '',
    'Objetivos:',
    ...p.objectives.map((o) => `- ${o}`),
    '',
    'Instrucciones:',
    `1. Abre la práctica en el Laboratorio Virtual: ${practicePermalink(p.id)}`,
    '2. Lee la preparación y elige el modo «Guiada» si es tu primera vez.',
    '3. Haz el experimento, guarda tus ensayos en la tabla y analiza tus datos.',
    '4. Responde la evaluación y escribe tu conclusión con evidencia de tus datos.',
    '5. Abre «Informe», descarga el archivo para el docente (.json) o guarda el informe en PDF, y adjúntalo en esta tarea.',
    '',
    `Competencias: ${p.competencies.map((c) => COMPETENCY_SHORT[c]).join(', ')}.`,
    `Enlace: ${practicePermalink(p.id)}`,
    '',
  ];
  return lines.join('\n');
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (separador «;», como lo abre Excel en español) con los enlaces del catálogo, opcionalmente de un grado. */
export function catalogLinksCsv(practices: PracticeDef[], grade?: GradeId | null): string {
  const rows: (string | number)[][] = [
    ['Grado', 'Área', 'Práctica', 'Tema', 'Duración (min)', 'Enlace de la práctica', 'Compartir en Classroom'],
    ...practices.filter((p) => !grade || p.grade === grade)
      .map((p) => [p.grade, AREA_LABEL[p.area], p.title, p.topic, p.durationMin, practicePermalink(p.id), classroomShareUrl(p)]),
  ];
  return rows.map((r) => r.map(csvCell).join(';')).join('\n') + '\n';
}

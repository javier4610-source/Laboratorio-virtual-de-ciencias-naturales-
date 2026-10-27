import { describe, expect, it } from 'vitest';
import type { PracticeDef, Question } from '../../src/core/types';
import { SABER_BANK } from '../../src/assessment/bank';
import { PRACTICES } from '../../src/curriculum/index';
import { parseHash } from '../../src/lib/router';
import { practicePermalink, PUBLIC_BASE } from '../../src/lib/permalink';
import {
  assignmentText, catalogLinksCsv, categoryPath, classroomShareUrl, escapeGift, escapeXml, selectQuestions,
  stripInvalidXmlChars, toGift, toMoodleXml, type ExportItem,
} from '../../src/lib/lmsExport';

/* ---------------------------------------------------------------------------------------------
 * Analizador XML mínimo y estricto (el entorno de pruebas es Node, sin DOMParser): recorre el texto
 * carácter a carácter, exige etiquetas bien anidadas, atributos entre comillas, solo las cinco
 * entidades predefinidas o referencias numéricas, y ningún «<» o «&» suelto. Devuelve el árbol.
 * La prueba E2E (tests/e2e/exportar-lms.spec.ts) analiza además el archivo con el DOMParser del navegador.
 * ------------------------------------------------------------------------------------------- */
interface XNode { name: string; attrs: Record<string, string>; children: (XNode | string)[]; }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s: string, at: number): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '<') throw new Error(`«<» sin escapar cerca de ${at + i}`);
    if (c !== '&') { out += c; continue; }
    const end = s.indexOf(';', i);
    if (end < 0) throw new Error(`«&» sin escapar cerca de ${at + i}`);
    const name = s.slice(i + 1, end);
    if (name.startsWith('#x')) out += String.fromCodePoint(parseInt(name.slice(2), 16));
    else if (name.startsWith('#')) out += String.fromCodePoint(parseInt(name.slice(1), 10));
    else if (name in ENT) out += ENT[name];
    else throw new Error(`Entidad desconocida &${name}; cerca de ${at + i}`);
    i = end;
  }
  return out;
}
const isNameChar = (c: string) => /[A-Za-z0-9_.:-]/.test(c);

function parseXml(src: string): XNode {
  let i = 0;
  if (src.startsWith('<?xml')) { i = src.indexOf('?>') + 2; if (i < 2) throw new Error('Prólogo sin cerrar'); }
  const stack: XNode[] = [];
  let root: XNode | null = null;
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end < 0) throw new Error('Comentario sin cerrar');
      if (src.slice(i + 4, end).includes('--')) throw new Error('«--» dentro de un comentario');
      i = end + 3;
    } else if (src.startsWith('<![CDATA[', i) || src.startsWith('<!', i) || src.startsWith('<?', i)) {
      throw new Error(`Construcción no esperada en ${i}`);
    } else if (src.startsWith('</', i)) {
      let j = i + 2; while (isNameChar(src[j])) j++;
      const name = src.slice(i + 2, j);
      while (src[j] === ' ' || src[j] === '\n') j++;
      if (src[j] !== '>') throw new Error(`Cierre mal formado en ${i}`);
      const top = stack.pop();
      if (!top || top.name !== name) throw new Error(`Cierre </${name}> no corresponde a <${top?.name}> en ${i}`);
      if (!stack.length) root = top;
      i = j + 1;
    } else if (src[i] === '<') {
      let j = i + 1; while (isNameChar(src[j])) j++;
      const node: XNode = { name: src.slice(i + 1, j), attrs: {}, children: [] };
      if (!node.name) throw new Error(`Etiqueta sin nombre en ${i}`);
      for (;;) {
        while (/\s/.test(src[j])) j++;
        if (src[j] === '>' || src.startsWith('/>', j)) break;
        let k = j; while (isNameChar(src[k])) k++;
        const an = src.slice(j, k);
        if (!an || src[k] !== '=' || (src[k + 1] !== '"' && src[k + 1] !== "'")) throw new Error(`Atributo mal formado en ${j}`);
        const q = src[k + 1];
        const end = src.indexOf(q, k + 2);
        if (an in node.attrs) throw new Error(`Atributo repetido ${an}`);
        node.attrs[an] = decode(src.slice(k + 2, end), k + 2);
        j = end + 1;
      }
      if (stack.length) stack[stack.length - 1].children.push(node);
      else if (root) throw new Error('Más de un elemento raíz');
      if (src.startsWith('/>', j)) { if (!stack.length) root = node; i = j + 2; } else { stack.push(node); i = j + 1; }
    } else {
      const end = src.indexOf('<', i);
      const raw = src.slice(i, end < 0 ? src.length : end);
      const t = decode(raw, i);
      if (stack.length) stack[stack.length - 1].children.push(t);
      else if (t.trim()) throw new Error(`Texto fuera del elemento raíz en ${i}`);
      i = end < 0 ? src.length : end;
    }
  }
  if (stack.length) throw new Error(`Elemento <${stack[stack.length - 1].name}> sin cerrar`);
  if (!root) throw new Error('Sin elemento raíz');
  return root;
}
const kids = (n: XNode, name: string) => n.children.filter((c): c is XNode => typeof c !== 'string' && c.name === name);
const kid = (n: XNode, name: string) => kids(n, name)[0];
const textOf = (n: XNode | undefined): string => (n ? n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('') : '');
const txt = (n: XNode, name: string) => textOf(kid(kid(n, name), 'text'));

/* ---------------------------------------------------------------------------------------------
 * Lector GIFT mínimo con las reglas de Moodle (question/format/gift): preguntas separadas por líneas
 * en blanco, comentarios «//» al inicio de línea, «\» escapa ~ = # { } : y la propia barra.
 * ------------------------------------------------------------------------------------------- */
const unescapeGift = (s: string) => s.replace(/\\([\\~=#{}:])/g, '$1');
/** Divide en el primer carácter especial NO escapado. */
function splitUnescaped(s: string, chars: string): string[] {
  const parts: string[] = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { cur += s[i] + (s[i + 1] ?? ''); i++; continue; }
    if (chars.includes(s[i])) { parts.push(cur); cur = s[i]; continue; }
    cur += s[i];
  }
  parts.push(cur);
  return parts;
}
interface GiftQ { category: string; name: string; text: string; answers: { correct: boolean; text: string; feedback: string }[]; general: string; }
function parseGift(src: string): GiftQ[] {
  let category = '';
  const out: GiftQ[] = [];
  for (const block of src.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').trim();
    if (!lines) continue;
    if (lines.startsWith('$CATEGORY:')) { category = lines.slice(10).trim(); continue; }
    const nameEnd = lines.indexOf('::', 2);
    expect(lines.startsWith('::')).toBe(true);
    const name = lines.slice(2, nameEnd);
    const rest = lines.slice(nameEnd + 2);
    const open = splitUnescaped(rest, '{');
    expect(open.length, `una sola «{» sin escapar en ${name}`).toBe(2);
    const body = open[1].slice(1);
    const close = splitUnescaped(body, '}');
    expect(close.length, `una sola «}» sin escapar en ${name}`).toBe(2);
    expect(close[1].trim(), 'nada después de «}»').toBe('}');
    const [answersPart, general = ''] = close[0].split('####');
    const answers = splitUnescaped(answersPart, '=~').filter((a) => /^[=~]/.test(a)).map((a) => {
      const [t, fb = ''] = splitUnescaped(a.slice(1), '#');
      return { correct: a[0] === '=', text: unescapeGift(t.trim()), feedback: unescapeGift(fb.slice(1).trim()) };
    });
    expect(open[0].startsWith('[html]')).toBe(true);
    out.push({ category, name: unescapeGift(name), text: unescapeGift(open[0].slice(6).trim()), answers, general: unescapeGift(general.trim()) });
  }
  return out;
}

const unhtml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* --------------------------------------- Pruebas --------------------------------------- */

const ALL = selectQuestions({ source: 'todas' }, PRACTICES, SABER_BANK);

const tricky: Question = {
  id: 'prueba-1', grade: 9, topic: 'Escapes <&> "comillas" y \'apóstrofos\'', competency: 'uso', component: 'quimico', skill: 's', difficulty: 'baja',
  context: 'Usa ~ = # { } : \\ y también ]]> y -- en el texto; ñ, á, é, í, ó, ú, ü, °C, ⇌, H₂O.\u0001',
  table: { caption: 'Datos <A & B>', headers: ['x {m}', 'y = f(x)'], rows: [[0.5, -2], ['a#b', 'c:d']] },
  stem: '¿Cuál es «la» respuesta? 2 < 3 && 5 > 4',
  options: [
    { id: 'a', text: 'Opción ~a~ con = igual', feedback: 'No: #numeral' },
    { id: 'b', text: 'Opción {b} con <b>etiqueta</b>', feedback: 'Correcto: dos puntos' },
    { id: 'c', text: 'Opción c\\barra', feedback: 'Tampoco & menos' },
  ],
  correct: 'b', explanation: 'Porque sí: A & B < C.', review: 'Repasa la práctica.',
};
const trickyPractice = { ...PRACTICES[0], id: 'densidad', title: 'Título con / barra y : dos puntos' } as PracticeDef;
const trickyItem: ExportItem = { question: tricky, origin: 'banco', practice: trickyPractice, area: 'quimica' };

describe('selección de preguntas para exportar', () => {
  it('reúne todo el banco y todas las evaluaciones de las prácticas, sin ids repetidos', () => {
    const ids = ALL.map((x) => x.question.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of SABER_BANK) expect(ids).toContain(q.id);
    for (const p of PRACTICES) for (const q of p.assessment) expect(ids).toContain(q.id);
  });

  it('filtra por origen, grado y área', () => {
    const bank = selectQuestions({ source: 'banco' }, PRACTICES, SABER_BANK);
    expect(bank.length).toBe(new Set(SABER_BANK.map((q) => q.id)).size);
    expect(bank.every((x) => x.origin === 'banco')).toBe(true);
    const prac = selectQuestions({ source: 'practicas', grade: 8 }, PRACTICES, SABER_BANK);
    expect(prac.length).toBeGreaterThan(0);
    expect(prac.every((x) => x.origin === 'practica' && x.question.grade === 8)).toBe(true);
    const bio = selectQuestions({ source: 'todas', area: 'biologia' }, PRACTICES, SABER_BANK);
    expect(bio.length).toBeGreaterThan(0);
    expect(bio.every((x) => x.area === 'biologia')).toBe(true);
  });

  it('por práctica: su evaluación, sus preguntas de transferencia y las del banco asociadas', () => {
    for (const p of PRACTICES) {
      const sel = selectQuestions({ source: 'todas', practiceId: p.id }, PRACTICES, SABER_BANK);
      const ids = sel.map((x) => x.question.id);
      for (const q of p.assessment) expect(ids).toContain(q.id);
      for (const id of p.transferQuestionIds) if (SABER_BANK.some((q) => q.id === id)) expect(ids, `${p.id}/${id}`).toContain(id);
      expect(sel.every((x) => x.practice?.id === p.id)).toBe(true);
    }
    expect(selectQuestions({ source: 'todas', practiceId: 'no-existe' }, PRACTICES, SABER_BANK)).toEqual([]);
  });
});

describe('escapes', () => {
  it('XML: los cinco caracteres reservados y los caracteres de control', () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
    expect(stripInvalidXmlChars('a\u0000b\u0008c\td\ne￾f😀')).toBe('abc\td\nef😀');
  });
  it('GIFT: ~ = # { } : y la barra invertida; sin saltos de línea', () => {
    expect(escapeGift('a~b=c#d{e}f:g\\h')).toBe('a\\~b\\=c\\#d\\{e\\}f\\:g\\\\h');
    expect(escapeGift('uno\ndos')).toBe('uno dos');
    expect(unescapeGift(escapeGift('~=#{}:\\ á'))).toBe('~=#{}:\\ á');
  });
  it('categorías de Moodle: «/» dentro de un nombre se duplica', () => {
    expect(categoryPath(['A/B', 'C'])).toBe('$course$/top/A//B/C');
  });
});

describe('Moodle XML', () => {
  const xml = toMoodleXml(ALL, new Date('2026-10-27T00:00:00Z'));
  const quiz = parseXml(xml);
  const qs = kids(quiz, 'question').filter((q) => q.attrs.type === 'multichoice');

  it('el analizador de la prueba rechaza XML mal formado (control de la propia prueba)', () => {
    for (const bad of ['<a><b></a>', '<a>&foo;</a>', '<a>x & y</a>', '<a>1 < 2</a>', '<a><!-- x--y --></a>', '<a x=1></a>', '<a></a><b></b>', '<a>']) {
      expect(() => parseXml(bad), bad).toThrow();
    }
  });

  it('es XML bien formado en UTF-8 con raíz <quiz>', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(quiz.name).toBe('quiz');
    expect(xml).not.toContain('﻿');
  });

  it('exporta todas las preguntas, cada una con exactamente una opción correcta (fracción 100) y su retroalimentación', () => {
    expect(qs.length).toBe(ALL.length);
    const byId = new Map(ALL.map((x) => [x.question.id, x.question]));
    for (const node of qs) {
      const id = textOf(kid(node, 'idnumber'));
      const q = byId.get(id)!;
      expect(q, id).toBeDefined();
      expect(textOf(kid(node, 'single'))).toBe('true');
      const answers = kids(node, 'answer');
      expect(answers.length).toBe(q.options.length);
      const correct = answers.filter((a) => a.attrs.fraction === '100');
      expect(correct.length, id).toBe(1);
      expect(answers.filter((a) => a.attrs.fraction === '0').length).toBe(q.options.length - 1);
      const right = q.options.find((o) => o.id === q.correct)!;
      expect(unhtml(textOf(kid(correct[0], 'text')))).toBe(right.text);
      answers.forEach((a, i) => {
        expect(unhtml(textOf(kid(a, 'text')))).toBe(q.options[i].text);
        expect(unhtml(txt(a, 'feedback'))).toBe(q.options[i].feedback);
      });
      expect(unhtml(txt(node, 'generalfeedback'))).toContain(q.explanation);
      expect(unhtml(txt(node, 'questiontext'))).toContain(q.stem);
    }
  });

  it('cada pregunta va precedida de su categoría (grado y práctica o área)', () => {
    const cats = kids(quiz, 'question').filter((q) => q.attrs.type === 'category').map((q) => txt(q, 'category'));
    expect(cats.length).toBeGreaterThan(1);
    for (const c of cats) expect(c.startsWith('$course$/top/Laboratorio Virtual de Ciencias Naturales/')).toBe(true);
    expect(quiz.children.find((c) => typeof c !== 'string')).toMatchObject({ attrs: { type: 'category' } });
  });

  it('conserva tildes y símbolos, y escapa el contenido difícil sin romper el XML', () => {
    const one = toMoodleXml([trickyItem]);
    const node = kids(parseXml(one), 'question').find((q) => q.attrs.type === 'multichoice')!;
    const html = txt(node, 'questiontext');
    expect(html).toContain('<table');
    expect(html).toContain('<caption>Datos &lt;A &amp; B&gt;</caption>');
    expect(html).toContain('<td>0,5</td><td>−2</td>');
    expect(unhtml(html)).toContain('ñ, á, é, í, ó, ú, ü, °C, ⇌, H₂O.');
    expect(html).not.toContain('\u0001');
    expect(unhtml(html)).toContain('2 < 3 && 5 > 4');
    expect(one).toContain('ñ, á'); // UTF-8 literal, sin convertir a entidades
    const correct = kids(node, 'answer').find((a) => a.attrs.fraction === '100')!;
    expect(unhtml(textOf(kid(correct, 'text')))).toBe('Opción {b} con <b>etiqueta</b>');
    expect(txt(kid(parseXml(one), 'question'), 'category')).toBe('$course$/top/Laboratorio Virtual de Ciencias Naturales/Banco tipo Saber 11/Grado 9/Química');
    expect(txt(node, 'generalfeedback')).toContain(`<a href="${practicePermalink('densidad')}">`);
  });
});

describe('GIFT', () => {
  const gift = toGift(ALL);
  const parsed = parseGift(gift);

  it('exporta todas las preguntas con una sola respuesta correcta «=» y retroalimentación «#»', () => {
    expect(parsed.length).toBe(ALL.length);
    const byId = new Map(parsed.map((g) => [/\(([^()]+)\)$/.exec(g.name)![1], g]));
    expect(byId.size).toBe(ALL.length);
    ALL.forEach((it) => {
      const q = it.question;
      const g = byId.get(q.id)!;
      expect(g, q.id).toBeDefined();
      expect(g.answers.length, q.id).toBe(q.options.length);
      expect(g.answers.filter((a) => a.correct).length, q.id).toBe(1);
      g.answers.forEach((a, j) => {
        expect(unhtml(a.text)).toBe(q.options[j].text);
        expect(a.correct).toBe(q.options[j].id === q.correct);
        expect(unhtml(a.feedback)).toBe(q.options[j].feedback);
      });
      expect(unhtml(g.general)).toContain(q.explanation);
      expect(g.category.startsWith('$course$/top/')).toBe(true);
    });
  });

  it('escapa los caracteres especiales de GIFT y conserva las tildes', () => {
    const [g] = parseGift(toGift([trickyItem]));
    expect(unhtml(g.text)).toContain('Usa ~ = # { } : \\ y también ]]> y -- en el texto; ñ, á');
    expect(g.answers.map((a) => [a.correct, unhtml(a.text), unhtml(a.feedback)])).toEqual([
      [false, 'Opción ~a~ con = igual', 'No: #numeral'],
      [true, 'Opción {b} con <b>etiqueta</b>', 'Correcto: dos puntos'],
      [false, 'Opción c\\barra', 'Tampoco & menos'],
    ]);
  });
});

describe('Google Classroom', () => {
  it('enlace oficial de compartir con la URL permanente y el título codificados', () => {
    for (const p of PRACTICES) {
      const u = new URL(classroomShareUrl(p));
      expect(u.origin + u.pathname).toBe('https://classroom.google.com/share');
      expect(u.searchParams.get('url')).toBe(practicePermalink(p.id));
      expect(u.searchParams.get('title')).toBe(p.title);
      const target = new URL(u.searchParams.get('url')!);
      expect(target.origin + target.pathname).toBe(PUBLIC_BASE);
      expect(parseHash(target.hash).path).toEqual(['practica', p.id]);
    }
  });

  it('texto de la tarea con objetivos, enlace, grado, curso y fecha', () => {
    const p = PRACTICES.find((x) => x.id === 'densidad')!;
    const t = assignmentText(p, { course: '6-2', due: '2026-11-05' });
    expect(t).toContain(`Práctica de laboratorio virtual: ${p.title}`);
    expect(t).toContain(`Grado ${p.grade}.º`);
    expect(t).toContain('Curso: 6-2');
    expect(t).toContain('Fecha de entrega: 2026-11-05');
    expect(t).toContain(practicePermalink(p.id));
    for (const o of p.objectives) expect(t).toContain(`- ${o}`);
    expect(assignmentText(p)).not.toContain('Curso:');
  });

  it('CSV del catálogo filtrado por grado, con «;» y comillas cuando hacen falta', () => {
    const csv = catalogLinksCsv(PRACTICES, 8);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Grado;Área;Práctica;Tema;Duración (min);Enlace de la práctica;Compartir en Classroom');
    const grade8 = PRACTICES.filter((p) => p.grade === 8);
    expect(lines.length).toBe(grade8.length + 1);
    for (const p of grade8) expect(csv).toContain(practicePermalink(p.id));
    expect(catalogLinksCsv(PRACTICES).trim().split('\n').length).toBe(PRACTICES.length + 1);
    const odd = catalogLinksCsv([{ ...grade8[0], title: 'Uno; "dos"' }]);
    expect(odd).toContain('"Uno; ""dos"""');
  });
});

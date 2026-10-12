import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
// @ts-expect-error módulo JavaScript sin tipos
import { createApp, csvCell, dayOf, nameKey, validateProgress } from '../../server/app.mjs';

/** Seguimiento del curso: inscripción con PIN, sincronización de avance y vistas del docente. */
let base = '';
let close: () => Promise<void>;
let clock = Date.UTC(2026, 9, 5, 15, 0, 0); // 5 de octubre de 2026, 10:00 en Colombia
const DAY = 86_400_000;

beforeAll(async () => {
  const app = createApp({ dbPath: ':memory:', registrationCode: 'COLEGIO-2026', now: () => clock, limits: { auth: 100, join: 200, sync: 40, pin: 3, studentsPerCourse: 6 } });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  close = app.close;
});
afterAll(async () => { await close(); });

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const type = res.headers.get('content-type') ?? '';
  const json = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, json, headers: res.headers };
}

function summary(version: number, over: Record<string, unknown> = {}) {
  return {
    version, mode: 'guiada', stages: ['preparacion', 'hipotesis'], percent: 40, trialsCount: 2,
    trials: [{ id: 't1', d: 'medidas', t: version - 1000, v: { material: 'Hierro', lado: 2, masa: 62.9 } }],
    hypothesis: { text: 'Si aumenta el volumen, aumenta la masa.', trend: 'aumenta', pairIndex: 0, savedAt: version - 5000 },
    comparison: { verdict: '', justification: '' },
    conclusion: { claim: '', evidence: '', reasoning: '' },
    interpretations: {}, visited: ['preparacion'], stepsDone: [0],
    answers: { 'den-1': { chosen: 'b', correct: false, firstTryCorrect: false, attempts: 1, firstChosen: 'b' }, 'den-2': { chosen: 'a', correct: true, firstTryCorrect: true, attempts: 1 } },
    score: { answered: 2, total: 6, correct: 1, byCompetency: { uso: { answered: 1, correct: 1 }, explicacion: { answered: 1, correct: 0 }, indagacion: { answered: 0, correct: 0 } } },
    fits: [{ d: 'medidas', x: 'vdesp', y: 'masa', model: 'proportional' }],
    activeMs: 120_000, lastActivity: version,
    ...over,
  };
}

const login = async (email: string, password: string) => (await api('POST', '/api/sesion', { email, password })).json.token as string;
/** Las sesiones docentes duran 12 horas: tras adelantar el reloj se inicia sesión de nuevo. */
const relogin = async () => {
  teacherA = await login('ana@colegio.edu.co', 'clave-segura-1');
  teacherB = await login('beto@colegio.edu.co', 'clave-segura-2');
};

let teacherA = '', teacherB = '', courseA = 0, codeA = '', courseA2 = 0, codeA2 = '', courseB = 0, codeB = '';
let sofia = '', sofiaId = 0, mateo = '', mateoId = 0, otherCourseStudent = '';

describe('utilidades del seguimiento', () => {
  it('normaliza nombres, fechas y celdas CSV', () => {
    expect(nameKey('  Sofía   ROJAS ')).toBe('sofia rojas');
    expect(dayOf(Date.UTC(2026, 9, 6, 3, 0))).toBe('2026-10-05'); // 22:00 en Colombia
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a;b')).toBe('"a;b"');
  });
  it('valida y limpia el resumen de avance', () => {
    const clean = validateProgress({ ...summary(clock), extra: 'no se guarda' }, clock);
    expect(clean.extra).toBeUndefined();
    expect(clean.percent).toBe(40);
    expect(() => validateProgress(summary(clock, { percent: 140 }), clock)).toThrow(/avance/);
    expect(() => validateProgress(summary(clock, { hypothesis: { text: 'x'.repeat(2001) } }), clock)).toThrow(/hipótesis/);
    expect(() => validateProgress(summary(clock, { trials: Array.from({ length: 31 }, (_, i) => ({ id: `t${i}`, d: 'm', t: 1, v: {} })) }), clock)).toThrow(/ensayos/);
    expect(() => validateProgress(summary(clock, { answers: { '../x': { chosen: 'a', correct: true, firstTryCorrect: true } } }), clock)).toThrow(/clave/);
    expect(() => validateProgress(summary(clock, { stages: ['hackeo'] }), clock)).toThrow(/etapa/);
    expect(() => validateProgress(summary(clock, { score: { answered: 1, correct: 3 } }), clock)).toThrow(/aciertos/);
    expect(() => validateProgress({ ...summary(clock), version: undefined }, clock)).toThrow(/versión/);
    // Una versión muy en el futuro (reloj del equipo adelantado) se acota a un día.
    expect(validateProgress(summary(clock + 30 * DAY), clock).version).toBe(clock + DAY);
  });
});

describe('inscripción del estudiante', () => {
  it('prepara docentes y cursos', async () => {
    teacherA = (await api('POST', '/api/docentes', { registrationCode: 'COLEGIO-2026', name: 'Ana Pérez', email: 'ana@colegio.edu.co', password: 'clave-segura-1' })).json.token;
    teacherB = (await api('POST', '/api/docentes', { registrationCode: 'COLEGIO-2026', name: 'Beto Ruiz', email: 'beto@colegio.edu.co', password: 'clave-segura-2' })).json.token;
    ({ id: courseA, joinCode: codeA } = (await api('POST', '/api/cursos', { name: '10-1 Química' }, teacherA)).json.course);
    ({ id: courseA2, joinCode: codeA2 } = (await api('POST', '/api/cursos', { name: '10-2 Química' }, teacherA)).json.course);
    ({ id: courseB, joinCode: codeB } = (await api('POST', '/api/cursos', { name: '11-1 Física' }, teacherB)).json.course);
    expect(codeA).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('valida código, nombre y PIN', async () => {
    expect((await api('POST', '/api/estudiantes', { joinCode: 'ZZZZZZ', name: 'Sofía Rojas', pin: '4321' })).status).toBe(404);
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'So', pin: '4321' })).status).toBe(400);
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA, name: '12345', pin: '4321' })).status).toBe(400);
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Sofía Rojas', pin: '12a4' })).status).toBe(400);
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Sofía Rojas', pin: 4321 })).status).toBe(400);
  });

  it('inscribe con nombre y PIN, y permite volver desde otro equipo', async () => {
    const r = await api('POST', '/api/estudiantes', { joinCode: codeA.toLowerCase(), name: 'Sofía  Rojas', pin: '4321' });
    expect(r.status).toBe(201);
    expect(r.json.created).toBe(true);
    expect(r.json.course.name).toBe('10-1 Química');
    expect(r.json.expiresAt - clock).toBe(120 * DAY);
    sofia = r.json.token; sofiaId = r.json.student.id;
    // Otro equipo: el mismo nombre (sin tildes ni mayúsculas) y el mismo PIN devuelven la misma cuenta.
    const again = await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'sofia rojas', pin: '4321' });
    expect(again.status).toBe(200);
    expect(again.json.student.id).toBe(sofiaId);
    expect(again.json.token).not.toBe(sofia);
    const me = await api('GET', '/api/estudiante', undefined, again.json.token);
    expect(me.json.student.name).toBe('Sofía Rojas');
    mateo = (await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Mateo Díaz', pin: '9876' })).json.token;
    mateoId = (await api('GET', '/api/estudiante', undefined, mateo)).json.student.id;
    otherCourseStudent = (await api('POST', '/api/estudiantes', { joinCode: codeB, name: 'Lucía Mena', pin: '1111' })).json.token;
  });

  it('el PIN se guarda con hash y los intentos fallidos se limitan', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Mateo Díaz', pin: '000' + i })).status);
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);
    // Ni siquiera el PIN correcto entra mientras dura el bloqueo; después de 15 minutos sí.
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Mateo Díaz', pin: '9876' })).status).toBe(429);
    clock += 16 * 60 * 1000;
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Mateo Díaz', pin: '9876' })).status).toBe(200);
  });

  it('un token de estudiante no sirve en rutas docentes, ni uno docente en rutas de estudiante', async () => {
    expect((await api('GET', '/api/cursos', undefined, sofia)).status).toBe(401);
    expect((await api('GET', `/api/cursos/${courseA}/seguimiento`, undefined, sofia)).status).toBe(401);
    expect((await api('GET', '/api/estudiante', undefined, teacherA)).status).toBe(401);
    expect((await api('PUT', '/api/estudiante/progreso/densidad', summary(clock), teacherA)).status).toBe(401);
  });

  it('un curso cerrado no admite nuevas inscripciones, pero sí el regreso', async () => {
    await api('PATCH', `/api/cursos/${courseA2}`, { open: false }, teacherA);
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA2, name: 'Nuevo Estudiante', pin: '2222' })).status).toBe(403);
    await api('PATCH', `/api/cursos/${courseA2}`, { open: true }, teacherA);
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA2, name: 'Nuevo Estudiante', pin: '2222' })).status).toBe(201);
    await api('PATCH', `/api/cursos/${courseA2}`, { open: false }, teacherA);
    const back = await api('POST', '/api/estudiantes', { joinCode: codeA2, name: 'Nuevo Estudiante', pin: '2222' });
    expect(back.status).toBe(200);
    expect((await api('PUT', '/api/estudiante/progreso/densidad', summary(clock), back.json.token)).status).toBe(403);
  });

  it('limita el número de estudiantes por curso', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await api('POST', '/api/estudiantes', { joinCode: codeB, name: `Estudiante ${'ABCDEF'[i]}`, pin: '5555' })).status);
    expect(statuses).toContain(403);
  });
});

describe('sincronización del avance', () => {
  it('guarda (upsert), es idempotente y no acepta versiones más viejas', async () => {
    const v1 = clock - 60_000;
    const first = await api('PUT', '/api/estudiante/progreso/densidad', summary(v1), sofia);
    expect(first.status).toBe(201);
    const dup = await api('PUT', '/api/estudiante/progreso/densidad', summary(v1), sofia);
    expect(dup.json.duplicate).toBe(true);
    const v2 = clock;
    expect((await api('PUT', '/api/estudiante/progreso/densidad', summary(v2, { percent: 60, stages: ['preparacion', 'hipotesis', 'experimento'], trialsCount: 3 }), sofia)).status).toBe(200);
    const old = await api('PUT', '/api/estudiante/progreso/densidad', summary(v1 - 1, { percent: 0, stages: [] }), sofia);
    expect(old.json.stale).toBe(true);
    const mine = await api('GET', '/api/estudiante/progreso', undefined, sofia);
    expect(mine.json.progress).toHaveLength(1);
    expect(mine.json.progress[0].summary.percent).toBe(60);
    expect(mine.json.progress[0].version).toBe(v2);
  });

  it('rechaza datos inválidos o demasiado grandes', async () => {
    expect((await api('PUT', '/api/estudiante/progreso/..%2Fetc', summary(clock), sofia)).status).toBe(400);
    expect((await api('PUT', '/api/estudiante/progreso/densidad', { ...summary(clock + 1), percent: 'mucho' }, sofia)).status).toBe(400);
    const big = summary(clock + 2, { interpretations: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, 'x'.repeat(2000)])), conclusion: { claim: 'x'.repeat(2000), evidence: 'x'.repeat(2000), reasoning: 'x'.repeat(2000) }, hypothesis: { text: 'x'.repeat(2000), trend: '' }, comparison: { verdict: '', justification: 'x'.repeat(2000) }, trials: Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, d: 'm', t: 1, v: Object.fromEntries('abcdefghijklmn'.split('').map((k) => [k, k.repeat(80)])) })) });
    expect(JSON.stringify(big).length).toBeGreaterThan(64 * 1024);
    expect((await api('PUT', '/api/estudiante/progreso/densidad', big, sofia)).status).toBe(413);
    expect((await api('PUT', '/api/estudiante/progreso/densidad', '{roto', sofia)).status).toBe(400);
  });

  it('un estudiante solo escribe y lee su propio avance', async () => {
    await api('PUT', '/api/estudiante/progreso/ph', summary(clock, { percent: 20, stages: ['preparacion'], answers: {}, score: { answered: 0, total: 6, correct: 0, byCompetency: {} } }), mateo);
    const sofiaData = await api('GET', '/api/estudiante/progreso', undefined, sofia);
    expect(sofiaData.json.progress.map((p: { practiceId: string }) => p.practiceId)).toEqual(['densidad']);
    // No hay rutas para leer a otro estudiante con un token de estudiante.
    expect((await api('GET', `/api/cursos/${courseA}/estudiantes/${sofiaId}`, undefined, mateo)).status).toBe(401);
    expect((await api('GET', `/api/estudiante/progreso/${sofiaId}`, undefined, mateo)).status).toBe(404);
  });

  it('registra aperturas de práctica sin duplicar recargas', async () => {
    expect((await api('POST', '/api/estudiante/eventos', { kind: 'practica', practiceId: 'densidad' }, sofia)).json.recorded).toBe(true);
    expect((await api('POST', '/api/estudiante/eventos', { kind: 'practica', practiceId: 'densidad' }, sofia)).json.recorded).toBe(false);
    expect((await api('POST', '/api/estudiante/eventos', { kind: 'otro', practiceId: 'densidad' }, sofia)).status).toBe(400);
    expect((await api('POST', '/api/estudiante/eventos', { kind: 'practica' })).status).toBe(401);
  });

  it('limita las sincronizaciones seguidas de un estudiante', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 45; i++) statuses.push((await api('PUT', '/api/estudiante/progreso/ondas', summary(clock + i + 10, { stages: [] }), otherCourseStudent)).status);
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 429).length).toBeLessThan(45);
  });
});

describe('seguimiento del docente', () => {
  it('resumen del curso: inscritos, activos, avance y puntaje', async () => {
    const r = await api('GET', `/api/cursos/${courseA}/resumen`, undefined, teacherA);
    expect(r.status).toBe(200);
    const s = r.json.summary;
    expect(s.enrolled).toBe(2);
    expect(s.activeToday).toBe(2);
    expect(s.active7).toBe(2);
    expect(s.avgPercent).toBe(40); // (60 + 20) / 2
    expect(s.avgScore).toBe(50);
    expect(s.practices.map((p: { practiceId: string }) => p.practiceId).sort()).toEqual(['densidad', 'ph']);
    expect(s.daily).toHaveLength(14);
    expect(s.daily[13].active).toBe(2);
    expect(s.daily[13].logins).toBeGreaterThanOrEqual(2);
    const courses = await api('GET', '/api/cursos', undefined, teacherA);
    expect(courses.json.courses.find((c: { id: number }) => c.id === courseA).studentCount).toBe(2);
  });

  it('lista de estudiantes y detalle con línea de tiempo', async () => {
    const list = await api('GET', `/api/cursos/${courseA}/estudiantes`, undefined, teacherA);
    const s = list.json.students.find((x: { name: string }) => x.name === 'Sofía Rojas');
    expect(s.practices.densidad.percent).toBe(60);
    expect(s.score).toEqual({ answered: 2, correct: 1 });
    const d = await api('GET', `/api/cursos/${courseA}/estudiantes/${sofiaId}`, undefined, teacherA);
    expect(d.json.practices[0].hypothesis.text).toMatch(/volumen/);
    expect(d.json.practices[0].fits[0].model).toBe('proportional');
    const kinds = d.json.timeline.map((e: { kind: string }) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['ingreso', 'practica', 'etapa', 'respuestas']));
    expect(d.json.timeline.filter((e: { kind: string; detail: string }) => e.kind === 'etapa').map((e: { detail: string }) => e.detail).sort()).toEqual(['experimento', 'hipotesis', 'preparacion']);
  });

  it('análisis por pregunta: acierto al primer intento y opción errada más elegida', async () => {
    const r = await api('GET', `/api/cursos/${courseA}/preguntas`, undefined, teacherA);
    const q1 = r.json.questions.find((x: { questionId: string }) => x.questionId === 'den-1');
    expect(q1).toMatchObject({ answered: 1, firstTryCorrect: 0, percent: 0, topWrong: { option: 'b', count: 1 } });
    expect(r.json.competencies.explicacion).toEqual({ answered: 1, correct: 0 });
  });

  it('alertas: inactividad de 7 días, práctica estancada y puntaje bajo', async () => {
    await api('PUT', '/api/estudiante/progreso/gases', summary(clock + 100, {
      answers: {}, score: { answered: 4, total: 6, correct: 1, byCompetency: { uso: { answered: 0, correct: 0 }, explicacion: { answered: 0, correct: 0 }, indagacion: { answered: 4, correct: 1 } } },
    }), mateo);
    clock += 8 * DAY;
    await api('GET', '/api/estudiante', undefined, sofia); // Sofía vuelve; Mateo no.
    await relogin();
    const r = await api('GET', `/api/cursos/${courseA}/alertas`, undefined, teacherA);
    const of = (kind: string) => r.json.alerts.filter((a: { kind: string }) => a.kind === kind);
    expect(of('inactivo').map((a: { name: string }) => a.name)).toEqual(['Mateo Díaz']);
    expect(of('puntaje-bajo')[0]).toMatchObject({ name: 'Mateo Díaz', competency: 'indagacion' });
    expect(of('estancada').map((a: { name: string; practiceId: string }) => `${a.name}:${a.practiceId}`)).toContain('Sofía Rojas:densidad');
    const s = (await api('GET', `/api/cursos/${courseA}/resumen`, undefined, teacherA)).json.summary;
    expect(s.activeToday).toBe(1);
    expect(s.active7).toBe(1);
  });

  it('exporta CSV seguro', async () => {
    const r = await api('GET', `/api/cursos/${courseA}/seguimiento.csv`, undefined, teacherA);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/text\/csv/);
    expect(r.json).toMatch(/Estudiante;Inscripción/);
    expect(r.json).toMatch(/Sofía Rojas;.*;densidad;60/);
  });

  it('aislamiento: otro docente no ve ni borra estudiantes de cursos ajenos', async () => {
    for (const path of ['seguimiento', 'resumen', 'estudiantes', 'preguntas', 'alertas', 'seguimiento.csv', `estudiantes/${sofiaId}`]) {
      expect((await api('GET', `/api/cursos/${courseA}/${path}`, undefined, teacherB)).status).toBe(404);
    }
    expect((await api('DELETE', `/api/cursos/${courseA}/estudiantes/${sofiaId}`, undefined, teacherB)).status).toBe(404);
    // Aislamiento entre cursos del mismo docente: el estudiante no aparece en otro curso.
    expect((await api('GET', `/api/cursos/${courseA2}/estudiantes/${sofiaId}`, undefined, teacherA)).status).toBe(404);
    const b = (await api('GET', `/api/cursos/${courseB}/estudiantes`, undefined, teacherB)).json.students;
    expect(b.map((s: { name: string }) => s.name)).not.toContain('Sofía Rojas');
  });

  it('eliminar un estudiante borra sus datos y su sesión', async () => {
    expect((await api('DELETE', `/api/cursos/${courseA}/estudiantes/${mateoId}`, undefined, teacherA)).status).toBe(200);
    expect((await api('GET', '/api/estudiante', undefined, mateo)).status).toBe(401);
    const s = (await api('GET', `/api/cursos/${courseA}/resumen`, undefined, teacherA)).json.summary;
    expect(s.enrolled).toBe(1);
    expect(s.practices.map((p: { practiceId: string }) => p.practiceId)).toEqual(['densidad']);
    // Puede volver a inscribirse con un PIN nuevo.
    expect((await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Mateo Díaz', pin: '1357' })).status).toBe(201);
  });

  it('la sesión del estudiante se cierra y expira a los 120 días', async () => {
    const t = (await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Sofía Rojas', pin: '4321' })).json.token;
    expect((await api('DELETE', '/api/estudiante/sesion', undefined, t)).status).toBe(200);
    expect((await api('GET', '/api/estudiante', undefined, t)).status).toBe(401);
    clock += 121 * DAY;
    expect((await api('GET', '/api/estudiante', undefined, sofia)).status).toBe(401);
    await relogin();
  });

  it('borrar el curso elimina a sus estudiantes', async () => {
    const before = (await api('POST', '/api/estudiantes', { joinCode: codeA, name: 'Sofía Rojas', pin: '4321' })).json.token;
    await api('DELETE', `/api/cursos/${courseA}`, undefined, teacherA);
    expect((await api('GET', '/api/estudiante', undefined, before)).status).toBe(401);
  });
});

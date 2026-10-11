import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
// @ts-expect-error módulo JavaScript sin tipos
import { createApp, createRateLimiter, hashPassword, verifyPassword } from '../../server/app.mjs';

let base = '';
let close: () => Promise<void>;
let clock = Date.now();

beforeAll(async () => {
  const app = createApp({ dbPath: ':memory:', registrationCode: 'COLEGIO-2026', allowedOrigins: ['http://localhost:4173'], now: () => clock, limits: { auth: 50, submit: 8 } });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  close = app.close;
});
afterAll(async () => { await close(); });

async function api(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const json = res.status === 204 ? null : await res.json();
  return { status: res.status, json, headers: res.headers };
}

const report = (name: string, generatedAt = 1000) => ({
  format: 'lvcn-informe-v1', generatedAt, student: { name, course: '10-2' },
  practice: { id: 'ph', title: 'pH', grade: 11, area: 'quimica' },
  session: { trials: [], answers: {} }, score: { answered: 0, total: 0, firstTryCorrect: 0, percent: 0, byCompetency: {} },
});

describe('contraseñas', () => {
  it('scrypt con sal: verifica la correcta y rechaza la incorrecta', () => {
    const h = hashPassword('una clave larga 123');
    expect(h).toMatch(/^scrypt\$/);
    expect(hashPassword('una clave larga 123')).not.toBe(h);
    expect(verifyPassword('una clave larga 123', h)).toBe(true);
    expect(verifyPassword('otra clave', h)).toBe(false);
  });
  it('limitador de solicitudes', () => {
    let t = 0;
    const lim = createRateLimiter(2, 1000, () => t);
    expect([lim('a'), lim('a'), lim('a')]).toEqual([true, true, false]);
    t = 2000;
    expect(lim('a')).toBe(true);
  });
});

describe('API del servidor', () => {
  let tokenA = '', tokenB = '', courseId = 0, joinCode = '';

  it('exige el código institucional para registrar docentes', async () => {
    const bad = await api('POST', '/api/docentes', { registrationCode: 'otro', name: 'Ana', email: 'ana@colegio.edu.co', password: 'clave-segura-1' });
    expect(bad.status).toBe(403);
    const ok = await api('POST', '/api/docentes', { registrationCode: 'COLEGIO-2026', name: 'Ana Pérez', email: 'Ana@Colegio.edu.co', password: 'clave-segura-1' });
    expect(ok.status).toBe(201);
    tokenA = ok.json.token;
    const dup = await api('POST', '/api/docentes', { registrationCode: 'COLEGIO-2026', name: 'Ana', email: 'ana@colegio.edu.co', password: 'clave-segura-1' });
    expect(dup.status).toBe(409);
    const short = await api('POST', '/api/docentes', { registrationCode: 'COLEGIO-2026', name: 'Luis', email: 'luis@colegio.edu.co', password: 'corta' });
    expect(short.status).toBe(400);
  });

  it('inicio de sesión: rechaza contraseña incorrecta y emite token válido', async () => {
    expect((await api('POST', '/api/sesion', { email: 'ana@colegio.edu.co', password: 'mala-clave-00' })).status).toBe(401);
    const ok = await api('POST', '/api/sesion', { email: 'ana@colegio.edu.co', password: 'clave-segura-1' });
    expect(ok.status).toBe(200);
    const me = await api('GET', '/api/yo', undefined, ok.json.token);
    expect(me.json.teacher.email).toBe('ana@colegio.edu.co');
    expect((await api('GET', '/api/cursos')).status).toBe(401);
  });

  it('crea cursos con código de 6 caracteres', async () => {
    const r = await api('POST', '/api/cursos', { name: '10-2 Química' }, tokenA);
    expect(r.status).toBe(201);
    courseId = r.json.course.id;
    joinCode = r.json.course.joinCode;
    expect(joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('el estudiante envía su informe con el código; se rechazan informes inválidos y duplicados', async () => {
    const ok = await api('POST', '/api/informes', { joinCode: joinCode.toLowerCase(), report: report('Sofía Rojas') });
    expect(ok.status).toBe(201);
    const dup = await api('POST', '/api/informes', { joinCode, report: report('Sofía Rojas') });
    expect(dup.json.duplicate).toBe(true);
    expect((await api('POST', '/api/informes', { joinCode: 'ZZZZZZ', report: report('X') })).status).toBe(404);
    expect((await api('POST', '/api/informes', { joinCode, report: { format: 'otro' } })).status).toBe(400);
    expect((await api('POST', '/api/informes', { joinCode, report: { ...report('X'), practice: { id: '../etc' } } })).status).toBe(400);
    expect((await api('POST', '/api/informes', '{no es json', undefined)).status).toBe(400);
  });

  it('el docente ve los informes de su curso; otro docente no puede verlos', async () => {
    const list = await api('GET', `/api/cursos/${courseId}/informes`, undefined, tokenA);
    expect(list.status).toBe(200);
    expect(list.json.reports).toHaveLength(1);
    expect(list.json.reports[0].report.student.name).toBe('Sofía Rojas');
    const b = await api('POST', '/api/docentes', { registrationCode: 'COLEGIO-2026', name: 'Beto', email: 'beto@colegio.edu.co', password: 'clave-segura-2' });
    tokenB = b.json.token;
    expect((await api('GET', `/api/cursos/${courseId}/informes`, undefined, tokenB)).status).toBe(404);
    expect((await api('DELETE', `/api/informes/${list.json.reports[0].id}`, undefined, tokenB)).status).toBe(404);
  });

  it('un curso cerrado no recibe informes', async () => {
    await api('PATCH', `/api/cursos/${courseId}`, { open: false }, tokenA);
    expect((await api('POST', '/api/informes', { joinCode, report: report('Tarde', 2000) })).status).toBe(403);
    await api('PATCH', `/api/cursos/${courseId}`, { open: true }, tokenA);
  });

  it('limita los envíos repetidos desde la misma conexión', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await api('POST', '/api/informes', { joinCode, report: report(`E${i}`, 3000 + i) })).status);
    expect(statuses).toContain(429);
  });

  it('cerrar sesión invalida el token y la sesión expira tras 12 horas', async () => {
    expect((await api('DELETE', '/api/sesion', undefined, tokenB)).status).toBe(200);
    expect((await api('GET', '/api/yo', undefined, tokenB)).status).toBe(401);
    clock += 13 * 3600 * 1000;
    expect((await api('GET', '/api/yo', undefined, tokenA)).status).toBe(401);
  });

  it('CORS solo para orígenes permitidos', async () => {
    const ok = await api('GET', '/api/salud', undefined, undefined, { Origin: 'http://localhost:4173' });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:4173');
    const no = await api('GET', '/api/salud', undefined, undefined, { Origin: 'https://sitio-ajeno.com' });
    expect(no.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('exige un código de registro al crear la aplicación', () => {
    expect(() => createApp({ dbPath: ':memory:', registrationCode: '' })).toThrow(/REGISTRATION_CODE/);
  });
});

import { loadJSON, saveJSON } from './storage';
import type { StudentReport } from './report';

/**
 * Cliente del servidor institucional opcional (carpeta server/).
 * Sin servidor configurado, la aplicación sigue funcionando con archivos y códigos.
 */
const SERVER_KEY = 'lvcn:servidor';
const TOKEN_KEY = 'lvcn:servidor-sesion';

export function defaultServerUrl(): string {
  return loadJSON<string>(SERVER_KEY, (import.meta.env.VITE_API_URL as string | undefined) ?? '');
}
export function saveServerUrl(url: string) { saveJSON(SERVER_KEY, url.trim().replace(/\/+$/, '')); }

export interface TeacherSession { token: string; teacher: { id: number; name: string; email: string }; server: string; }
export function loadTeacherSession(): TeacherSession | null { return loadJSON<TeacherSession | null>(TOKEN_KEY, null); }
export function saveTeacherSession(s: TeacherSession | null) { saveJSON(TOKEN_KEY, s); }

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export function normalizeServerUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/.test(u)) throw new ApiError(0, 'Escribe la dirección completa del servidor, por ejemplo https://laboratorio.micolegio.edu.co');
  return u;
}

async function call<T>(server: string, method: string, path: string, body?: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(normalizeServerUrl(server) + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa la dirección y tu conexión a internet.');
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string } | null)?.error ?? `Error ${res.status} del servidor.`);
  return json as T;
}

export const api = {
  health: (server: string) => call<{ ok: boolean }>(server, 'GET', '/api/salud'),
  register: (server: string, data: { registrationCode: string; name: string; email: string; password: string }) =>
    call<{ token: string; teacher: TeacherSession['teacher'] }>(server, 'POST', '/api/docentes', data),
  login: (server: string, email: string, password: string) =>
    call<{ token: string; teacher: TeacherSession['teacher'] }>(server, 'POST', '/api/sesion', { email, password }),
  logout: (s: TeacherSession) => call(s.server, 'DELETE', '/api/sesion', undefined, s.token),
  courses: (s: TeacherSession) => call<{ courses: ServerCourse[] }>(s.server, 'GET', '/api/cursos', undefined, s.token),
  createCourse: (s: TeacherSession, name: string) => call<{ course: ServerCourse }>(s.server, 'POST', '/api/cursos', { name }, s.token),
  setCourseOpen: (s: TeacherSession, id: number, open: boolean) => call(s.server, 'PATCH', `/api/cursos/${id}`, { open }, s.token),
  deleteCourse: (s: TeacherSession, id: number) => call(s.server, 'DELETE', `/api/cursos/${id}`, undefined, s.token),
  reports: (s: TeacherSession, id: number) => call<{ reports: ServerReport[] }>(s.server, 'GET', `/api/cursos/${id}/informes`, undefined, s.token),
  submitReport: (server: string, joinCode: string, report: StudentReport) =>
    call<{ ok: boolean; duplicate: boolean; course: string }>(server, 'POST', '/api/informes', { joinCode, report }),
};

export interface ServerCourse { id: number; name: string; joinCode: string; open: number; reportCount: number; createdAt?: number; }
export interface ServerReport { id: number; studentName: string; studentCourse: string; practiceId: string; generatedAt: number; receivedAt: number; report: StudentReport; }

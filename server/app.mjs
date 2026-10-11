// Servidor del Laboratorio Virtual: cuentas docentes, cursos y recepción de informes.
// Sin dependencias externas: node:http, node:sqlite (Node ≥ 22.13) y node:crypto.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export const REPORT_FORMAT = 'lvcn-informe-v1';
const MAX_BODY = 512 * 1024; // bytes
const SESSION_HOURS = 12;
const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para evitar confusiones

const SCHEMA = `
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  open INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_course TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  body TEXT NOT NULL,
  UNIQUE (course_id, student_name, practice_id, generated_at)
);
`;

// ---------------------------------------------------------------- utilidades

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [alg, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, actual);
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function newJoinCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)];
  return code;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const isEmail = (s) => typeof s === 'string' && s.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const text = (v, field, max, min = 1) => {
  if (typeof v !== 'string') throw new HttpError(400, `Falta el campo «${field}».`);
  const t = v.trim();
  if (t.length < min || t.length > max) throw new HttpError(400, `«${field}» debe tener entre ${min} y ${max} caracteres.`);
  return t;
};

/** Valida la estructura mínima de un informe enviado por un estudiante. */
export function validateIncomingReport(r) {
  if (!r || typeof r !== 'object') throw new HttpError(400, 'El informe no es un objeto JSON.');
  if (r.format !== REPORT_FORMAT) throw new HttpError(400, 'Formato de informe desconocido.');
  if (!r.student || typeof r.student !== 'object') throw new HttpError(400, 'Faltan los datos del estudiante.');
  const name = text(r.student.name, 'nombre del estudiante', 80);
  const course = typeof r.student.course === 'string' ? r.student.course.trim().slice(0, 30) : '';
  if (!r.practice || typeof r.practice.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(r.practice.id)) throw new HttpError(400, 'Práctica no válida.');
  if (!r.session || !Array.isArray(r.session.trials) || typeof r.session.answers !== 'object') throw new HttpError(400, 'Faltan los datos de la sesión.');
  if (r.session.trials.length > 500) throw new HttpError(400, 'El informe tiene demasiados ensayos.');
  if (!Number.isFinite(r.generatedAt)) throw new HttpError(400, 'Falta la fecha del informe.');
  return { name, course, practiceId: r.practice.id, generatedAt: Math.trunc(r.generatedAt) };
}

/** Limitador de solicitudes por clave (IP + ruta) con ventana fija, en memoria. */
export function createRateLimiter(limit, windowMs, now = () => Date.now()) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const e = hits.get(key);
    if (!e || t - e.start > windowMs) { hits.set(key, { start: t, count: 1 }); return true; }
    e.count++;
    return e.count <= limit;
  };
}

// ---------------------------------------------------------------- aplicación

/**
 * Crea la aplicación. Opciones:
 *  dbPath: ruta del archivo SQLite (':memory:' para pruebas)
 *  registrationCode: código que deben conocer los docentes para crear su cuenta (obligatorio)
 *  allowedOrigins: lista de orígenes permitidos (CORS) del sitio del laboratorio
 *  now: reloj inyectable para pruebas
 */
export function createApp({ dbPath = 'laboratorio.db', registrationCode, allowedOrigins = [], now = () => Date.now(), limits = {} } = {}) {
  if (!registrationCode || registrationCode.length < 6) throw new Error('Define REGISTRATION_CODE (al menos 6 caracteres) para proteger el registro de docentes.');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  const authLimiter = createRateLimiter(limits.auth ?? 10, 15 * 60 * 1000, now);
  const submitLimiter = createRateLimiter(limits.submit ?? 120, 10 * 60 * 1000, now);

  const q = {
    insertTeacher: db.prepare('INSERT INTO teachers (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)'),
    teacherByEmail: db.prepare('SELECT * FROM teachers WHERE email = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, teacher_id, expires_at) VALUES (?, ?, ?)'),
    sessionTeacher: db.prepare('SELECT t.id, t.name, t.email FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE s.token_hash = ? AND s.expires_at > ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    insertCourse: db.prepare('INSERT INTO courses (teacher_id, name, join_code, created_at) VALUES (?, ?, ?, ?)'),
    coursesOf: db.prepare(`SELECT c.id, c.name, c.join_code AS joinCode, c.open, c.created_at AS createdAt,
      (SELECT COUNT(*) FROM reports r WHERE r.course_id = c.id) AS reportCount FROM courses c WHERE c.teacher_id = ? ORDER BY c.created_at DESC`),
    courseOwned: db.prepare('SELECT * FROM courses WHERE id = ? AND teacher_id = ?'),
    courseByCode: db.prepare('SELECT * FROM courses WHERE join_code = ?'),
    setOpen: db.prepare('UPDATE courses SET open = ? WHERE id = ?'),
    deleteCourse: db.prepare('DELETE FROM courses WHERE id = ?'),
    insertReport: db.prepare('INSERT OR IGNORE INTO reports (course_id, student_name, student_course, practice_id, generated_at, received_at, body) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    reportsOf: db.prepare('SELECT id, student_name AS studentName, student_course AS studentCourse, practice_id AS practiceId, generated_at AS generatedAt, received_at AS receivedAt, body FROM reports WHERE course_id = ? ORDER BY received_at DESC'),
    reportOwned: db.prepare('SELECT r.id FROM reports r JOIN courses c ON c.id = r.course_id WHERE r.id = ? AND c.teacher_id = ?'),
    deleteReport: db.prepare('DELETE FROM reports WHERE id = ?'),
  };

  function authTeacher(req) {
    const h = req.headers.authorization ?? '';
    const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(h);
    if (!m) throw new HttpError(401, 'Inicia sesión como docente.');
    const t = q.sessionTeacher.get(sha256(m[1]), now());
    if (!t) throw new HttpError(401, 'La sesión expiró o no es válida. Inicia sesión de nuevo.');
    return { teacher: t, tokenHash: sha256(m[1]) };
  }

  function issueSession(teacherId) {
    q.purgeSessions.run(now());
    const token = randomBytes(32).toString('base64url');
    q.insertSession.run(sha256(token), teacherId, now() + SESSION_HOURS * 3600 * 1000);
    return token;
  }

  function createCourse(teacherId, name) {
    for (let i = 0; i < 10; i++) {
      const code = newJoinCode();
      if (q.courseByCode.get(code)) continue;
      const info = q.insertCourse.run(teacherId, name, code, now());
      return { id: Number(info.lastInsertRowid), name, joinCode: code, open: 1, reportCount: 0 };
    }
    throw new HttpError(500, 'No se pudo generar un código de curso. Intenta de nuevo.');
  }

  /** Enrutador: devuelve [status, body]. */
  async function route(method, path, body, req, ip) {
    if (method === 'GET' && path === '/api/salud') return [200, { ok: true, version: 1 }];

    if (method === 'POST' && path === '/api/docentes') {
      if (!authLimiter(`${ip}:auth`)) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
      if (typeof body.registrationCode !== 'string' || sha256(body.registrationCode) !== sha256(registrationCode)) throw new HttpError(403, 'El código de registro institucional no es correcto.');
      const name = text(body.name, 'nombre', 80, 2);
      if (!isEmail(body.email)) throw new HttpError(400, 'Escribe un correo electrónico válido.');
      const email = body.email.trim().toLowerCase();
      const password = text(body.password, 'contraseña', 200, 10);
      if (q.teacherByEmail.get(email)) throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
      const info = q.insertTeacher.run(name, email, hashPassword(password), now());
      const id = Number(info.lastInsertRowid);
      return [201, { token: issueSession(id), teacher: { id, name, email } }];
    }

    if (method === 'POST' && path === '/api/sesion') {
      if (!authLimiter(`${ip}:auth`)) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const t = q.teacherByEmail.get(email);
      const ok = t ? verifyPassword(String(body.password ?? ''), t.password_hash) : (hashPassword('x'), false); // tiempo similar si no existe
      if (!ok) throw new HttpError(401, 'Correo o contraseña incorrectos.');
      return [200, { token: issueSession(t.id), teacher: { id: t.id, name: t.name, email: t.email } }];
    }

    if (method === 'DELETE' && path === '/api/sesion') {
      const { tokenHash } = authTeacher(req);
      q.deleteSession.run(tokenHash);
      return [200, { ok: true }];
    }

    if (method === 'GET' && path === '/api/yo') return [200, { teacher: authTeacher(req).teacher }];

    if (method === 'GET' && path === '/api/cursos') {
      const { teacher } = authTeacher(req);
      return [200, { courses: q.coursesOf.all(teacher.id) }];
    }

    if (method === 'POST' && path === '/api/cursos') {
      const { teacher } = authTeacher(req);
      return [201, { course: createCourse(teacher.id, text(body.name, 'nombre del curso', 60)) }];
    }

    let m = /^\/api\/cursos\/(\d+)$/.exec(path);
    if (m && (method === 'DELETE' || method === 'PATCH')) {
      const { teacher } = authTeacher(req);
      const c = q.courseOwned.get(Number(m[1]), teacher.id);
      if (!c) throw new HttpError(404, 'Curso no encontrado.');
      if (method === 'DELETE') { q.deleteCourse.run(c.id); return [200, { ok: true }]; }
      q.setOpen.run(body.open ? 1 : 0, c.id);
      return [200, { ok: true }];
    }

    m = /^\/api\/cursos\/(\d+)\/informes$/.exec(path);
    if (m && method === 'GET') {
      const { teacher } = authTeacher(req);
      const c = q.courseOwned.get(Number(m[1]), teacher.id);
      if (!c) throw new HttpError(404, 'Curso no encontrado.');
      const reports = q.reportsOf.all(c.id).map((r) => ({ ...r, report: JSON.parse(r.body), body: undefined }));
      return [200, { course: { id: c.id, name: c.name, joinCode: c.join_code }, reports }];
    }

    m = /^\/api\/informes\/(\d+)$/.exec(path);
    if (m && method === 'DELETE') {
      const { teacher } = authTeacher(req);
      if (!q.reportOwned.get(Number(m[1]), teacher.id)) throw new HttpError(404, 'Informe no encontrado.');
      q.deleteReport.run(Number(m[1]));
      return [200, { ok: true }];
    }

    // Envío público de informes: el estudiante solo necesita el código del curso.
    if (method === 'POST' && path === '/api/informes') {
      if (!submitLimiter(`${ip}:submit`)) throw new HttpError(429, 'Se enviaron demasiados informes desde esta conexión. Espera unos minutos.');
      const code = typeof body.joinCode === 'string' ? body.joinCode.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{6}$/.test(code)) throw new HttpError(400, 'El código del curso tiene 6 caracteres.');
      const c = q.courseByCode.get(code);
      if (!c) throw new HttpError(404, 'No existe un curso con ese código. Verifícalo con tu docente.');
      if (!c.open) throw new HttpError(403, 'Este curso ya no recibe informes.');
      const meta = validateIncomingReport(body.report);
      const info = q.insertReport.run(c.id, meta.name, meta.course, meta.practiceId, meta.generatedAt, now(), JSON.stringify(body.report));
      return [info.changes ? 201 : 200, { ok: true, duplicate: !info.changes, course: c.name }];
    }

    throw new HttpError(404, 'Ruta no encontrada.');
  }

  function corsHeaders(origin) {
    const h = {};
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      h['Access-Control-Allow-Origin'] = allowedOrigins.includes('*') ? '*' : origin;
      h['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
      h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      h['Access-Control-Max-Age'] = '600';
      h.Vary = 'Origin';
    }
    return h;
  }

  async function handler(req, res) {
    const origin = req.headers.origin;
    const base = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    };
    const send = (status, obj) => { res.writeHead(status, base); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, base); res.end(); return; }
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let body = {};
      if (req.method === 'POST' || req.method === 'PATCH') {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) throw new HttpError(413, 'El envío es demasiado grande.');
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        try { body = raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, 'El cuerpo no es JSON válido.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'El cuerpo debe ser un objeto JSON.');
      }
      const ip = req.socket.remoteAddress ?? 'desconocida';
      const [status, out] = await route(req.method, url.pathname, body, req, ip);
      send(status, out);
    } catch (e) {
      if (e instanceof HttpError) send(e.status, { error: e.message });
      else { console.error(e); send(500, { error: 'Error interno del servidor.' }); }
    }
  }

  const server = createServer(handler);
  return { server, db, close: () => new Promise((r) => server.close(() => { db.close(); r(); })) };
}

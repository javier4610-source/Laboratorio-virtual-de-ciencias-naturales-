// Servidor del Laboratorio Virtual: cuentas docentes, cursos y recepción de informes.
// Sin dependencias externas: node:http, node:sqlite (Node ≥ 22.13) y node:crypto.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { createBlastService, blastOptionsFromEnv } from './blast.mjs';

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
-- Seguimiento del curso: estudiantes inscritos con nombre + PIN (sin correo ni otros datos).
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  UNIQUE (course_id, name_key)
);
CREATE TABLE IF NOT EXISTS student_sessions (
  token_hash TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  practice_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  percent INTEGER NOT NULL,
  answered INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  trials INTEGER NOT NULL,
  active_ms INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (student_id, practice_id)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  practice_id TEXT,
  detail TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_student ON events (student_id, at);
CREATE TABLE IF NOT EXISTS activity_days (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  PRIMARY KEY (student_id, day)
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

// ---------------------------------------------------------------- seguimiento del curso

export const MAX_PROGRESS_BYTES = 64 * 1024;
export const MAX_SYNC_TRIALS = 30;
export const STUDENT_SESSION_DAYS = 120;
// «hipotesis» ya no la envía el cliente (ADR 0006); se sigue aceptando para no rechazar avances de versiones anteriores.
const STAGE_IDS = ['preparacion', 'hipotesis', 'experimento', 'analisis', 'evaluacion', 'modelo'];
const MODES = ['guiada', 'libre', 'evaluacion'];
const VERDICTS = ['', 'apoya', 'refuta', 'no concluyente'];
const TRENDS = ['', 'aumenta', 'disminuye', 'no cambia', 'máximo', 'se estabiliza'];
const COMPETENCIES = ['uso', 'explicacion', 'indagacion'];
const KEY_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const OPTION_RE = /^[A-Za-z0-9]{1,4}$/;
const PRACTICE_RE = /^[a-z0-9-]{1,40}$/;
const TEXT_MAX = 2000;
const DAY_MS = 86_400_000;

/** Normaliza un nombre para compararlo (sin tildes, espacios repetidos ni mayúsculas). */
export function nameKey(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const invalid = (m) => { throw new HttpError(400, `Avance no válido: ${m}.`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const vStr = (v, max, field) => {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') invalid(`«${field}» debe ser texto`);
  if (v.length > max) invalid(`«${field}» supera ${max} caracteres`);
  return v;
};
const vInt = (v, min, max, field) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) invalid(`«${field}» fuera de rango`);
  return Math.round(v);
};
const vTime = (v, field, now) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) invalid(`«${field}» no es una fecha`);
  return Math.min(Math.round(v), now + DAY_MS);
};
const vBool = (v, field) => { if (typeof v !== 'boolean') invalid(`«${field}» debe ser verdadero o falso`); return v; };
const vEnum = (v, list, field) => { if (!list.includes(v ?? '')) invalid(`«${field}» no es válido`); return v ?? ''; };
const vKey = (v, field) => { const k = vStr(v, 40, field); if (!KEY_RE.test(k)) invalid(`«${field}» no es válido`); return k; };
const vMap = (v, maxKeys, field, fn) => {
  if (v === undefined || v === null) return {};
  if (!isObj(v)) invalid(`«${field}» debe ser un objeto`);
  const entries = Object.entries(v);
  if (entries.length > maxKeys) invalid(`«${field}» tiene demasiados elementos`);
  const out = {};
  for (const [k, x] of entries) { if (!KEY_RE.test(k)) invalid(`clave no válida en «${field}»`); out[k] = fn(x, k); }
  return out;
};
const vArr = (v, max, field, fn) => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) invalid(`«${field}» debe ser una lista`);
  if (v.length > max) invalid(`«${field}» tiene demasiados elementos`);
  return v.map(fn);
};

/**
 * Valida el resumen de avance de una práctica y devuelve una copia limpia: solo los
 * campos conocidos, con tamaños acotados. Lanza HttpError 400 si algo no es válido.
 */
export function validateProgress(body, now = Date.now()) {
  if (!isObj(body)) invalid('se esperaba un objeto');
  const version = body.version;
  if (typeof version !== 'number' || !Number.isFinite(version) || version <= 0) invalid('falta la versión');
  if (!isObj(body.score)) invalid('falta el puntaje');
  const sc = body.score;
  // `hypothesis` y `comparison` son obsoletos (ADR 0006): el cliente actual no los envía; se validan si llegan de una versión anterior.
  const h = isObj(body.hypothesis) ? body.hypothesis : {};
  const cmp = isObj(body.comparison) ? body.comparison : {};
  const con = isObj(body.conclusion) ? body.conclusion : {};
  const out = {
    version: Math.min(Math.round(version), now + DAY_MS),
    mode: vEnum(body.mode, MODES, 'modo'),
    stages: [...new Set(vArr(body.stages, STAGE_IDS.length, 'etapas', (x) => vEnum(x, STAGE_IDS, 'etapa')))],
    percent: vInt(body.percent, 0, 100, 'avance'),
    trialsCount: vInt(body.trialsCount ?? 0, 0, 100_000, 'número de ensayos'),
    trials: vArr(body.trials, MAX_SYNC_TRIALS, 'ensayos', (t) => {
      if (!isObj(t)) invalid('ensayo no válido');
      const tr = {
        id: vStr(t.id, 40, 'id del ensayo'), d: vKey(t.d, 'conjunto de datos'), t: vTime(t.t, 'fecha del ensayo', now) ?? 0,
        v: vMap(t.v, 24, 'valores', (x) => {
          if (x === null) return null;
          if (typeof x === 'number') { if (!Number.isFinite(x)) invalid('valor no finito'); return x; }
          return vStr(x, 80, 'valor');
        }),
      };
      if (t.n) tr.n = vStr(t.n, 300, 'observación');
      return tr;
    }),
    hypothesis: { text: vStr(h.text, TEXT_MAX, 'hipótesis'), trend: vEnum(h.trend, TRENDS, 'tendencia'), pairIndex: vInt(h.pairIndex ?? 0, 0, 20, 'variables de la hipótesis'), savedAt: vTime(h.savedAt, 'fecha de la hipótesis', now) },
    comparison: { verdict: vEnum(cmp.verdict, VERDICTS, 'comparación'), justification: vStr(cmp.justification, TEXT_MAX, 'justificación') },
    conclusion: { claim: vStr(con.claim, TEXT_MAX, 'afirmación'), evidence: vStr(con.evidence, TEXT_MAX, 'evidencia'), reasoning: vStr(con.reasoning, TEXT_MAX, 'razonamiento') },
    interpretations: vMap(body.interpretations, 12, 'interpretaciones', (x) => vStr(x, TEXT_MAX, 'interpretación')),
    answers: vMap(body.answers, 60, 'respuestas', (a) => {
      if (!isObj(a)) invalid('respuesta no válida');
      const chosen = vStr(a.chosen, 4, 'opción');
      if (!OPTION_RE.test(chosen)) invalid('opción no válida');
      const r = { chosen, correct: vBool(a.correct, 'correcta'), firstTryCorrect: vBool(a.firstTryCorrect, 'acierto al primer intento'), attempts: vInt(a.attempts ?? 1, 1, 99, 'intentos') };
      if (a.firstChosen !== undefined) { const f = vStr(a.firstChosen, 4, 'primera opción'); if (!OPTION_RE.test(f)) invalid('primera opción no válida'); r.firstChosen = f; }
      const at = vTime(a.at, 'fecha de la respuesta', now);
      if (at) r.at = at;
      return r;
    }),
    visited: vArr(body.visited, 12, 'etapas visitadas', (x) => vKey(x, 'etapa visitada')),
    stepsDone: vArr(body.stepsDone, 40, 'pasos', (x) => vInt(x, 0, 99, 'paso')),
    score: {
      answered: vInt(sc.answered, 0, 200, 'respondidas'),
      total: vInt(sc.total ?? 0, 0, 200, 'total de preguntas'),
      correct: vInt(sc.correct, 0, 200, 'aciertos'),
      byCompetency: Object.fromEntries(COMPETENCIES.map((c) => {
        const x = isObj(sc.byCompetency) && isObj(sc.byCompetency[c]) ? sc.byCompetency[c] : { answered: 0, correct: 0 };
        return [c, { answered: vInt(x.answered, 0, 200, 'respondidas por competencia'), correct: vInt(x.correct, 0, 200, 'aciertos por competencia') }];
      })),
    },
    fits: vArr(body.fits, 8, 'ajustes', (f) => {
      if (!isObj(f)) invalid('ajuste no válido');
      const r = { d: vKey(f.d, 'ajuste'), x: vKey(f.x, 'ajuste'), y: vKey(f.y, 'ajuste'), model: vKey(f.model, 'modelo de ajuste') };
      if (f.xT !== undefined) r.xT = vKey(f.xT, 'ajuste');
      if (f.yT !== undefined) r.yT = vKey(f.yT, 'ajuste');
      return r;
    }),
    activeMs: vInt(body.activeMs ?? 0, 0, 90 * DAY_MS, 'tiempo activo'),
    lastActivity: vTime(body.lastActivity, 'última actividad', now) ?? Math.round(version),
  };
  if (out.score.correct > out.score.answered) invalid('hay más aciertos que respuestas');
  return out;
}

/** Celda CSV segura (separador «;», sin inyección de fórmulas al abrirla en una hoja de cálculo). */
export function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Fecha local (AAAA-MM-DD) con un desfase fijo en minutos (Colombia: −300, sin horario de verano). */
export function dayOf(ts, tzOffsetMinutes = -300) {
  return new Date(ts + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
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
export function createApp({ dbPath = 'laboratorio.db', registrationCode, allowedOrigins = [], now = () => Date.now(), limits = {}, tzOffsetMinutes = -300, blast: blastOptions } = {}) {
  if (!registrationCode || registrationCode.length < 6) throw new Error('Define REGISTRATION_CODE (al menos 6 caracteres) para proteger el registro de docentes.');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  const authLimiter = createRateLimiter(limits.auth ?? 10, 15 * 60 * 1000, now);
  const submitLimiter = createRateLimiter(limits.submit ?? 120, 10 * 60 * 1000, now);
  // Inscripción: un salón entero suele compartir la misma IP del colegio.
  const joinLimiter = createRateLimiter(limits.join ?? 90, 15 * 60 * 1000, now);
  // Sincronización y eventos: por estudiante (el cliente agrupa cambios con antirrebote).
  const syncLimiter = createRateLimiter(limits.sync ?? 240, 10 * 60 * 1000, now);
  // PIN incorrecto: máximo de fallos por estudiante (curso + nombre) en 15 minutos.
  const pinFailures = new Map();
  const PIN_MAX_FAILS = limits.pin ?? 5;
  const PIN_WINDOW = 15 * 60 * 1000;
  const MAX_STUDENTS = limits.studentsPerCourse ?? 300;
  const MAX_PRACTICES = 80;
  const today = () => dayOf(now(), tzOffsetMinutes);
  // Proxy de NCBI BLAST (server/blast.mjs): se activa con NCBI_EMAIL o con la opción `blast`.
  const blast = createBlastService(blastOptions ?? blastOptionsFromEnv());

  const q = {
    insertTeacher: db.prepare('INSERT INTO teachers (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)'),
    teacherByEmail: db.prepare('SELECT * FROM teachers WHERE email = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, teacher_id, expires_at) VALUES (?, ?, ?)'),
    sessionTeacher: db.prepare('SELECT t.id, t.name, t.email FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE s.token_hash = ? AND s.expires_at > ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    insertCourse: db.prepare('INSERT INTO courses (teacher_id, name, join_code, created_at) VALUES (?, ?, ?, ?)'),
    coursesOf: db.prepare(`SELECT c.id, c.name, c.join_code AS joinCode, c.open, c.created_at AS createdAt,
      (SELECT COUNT(*) FROM reports r WHERE r.course_id = c.id) AS reportCount,
      (SELECT COUNT(*) FROM students st WHERE st.course_id = c.id) AS studentCount FROM courses c WHERE c.teacher_id = ? ORDER BY c.created_at DESC`),
    courseOwned: db.prepare('SELECT * FROM courses WHERE id = ? AND teacher_id = ?'),
    courseByCode: db.prepare('SELECT * FROM courses WHERE join_code = ?'),
    setOpen: db.prepare('UPDATE courses SET open = ? WHERE id = ?'),
    deleteCourse: db.prepare('DELETE FROM courses WHERE id = ?'),
    insertReport: db.prepare('INSERT OR IGNORE INTO reports (course_id, student_name, student_course, practice_id, generated_at, received_at, body) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    reportsOf: db.prepare('SELECT id, student_name AS studentName, student_course AS studentCourse, practice_id AS practiceId, generated_at AS generatedAt, received_at AS receivedAt, body FROM reports WHERE course_id = ? ORDER BY received_at DESC'),
    reportOwned: db.prepare('SELECT r.id FROM reports r JOIN courses c ON c.id = r.course_id WHERE r.id = ? AND c.teacher_id = ?'),
    deleteReport: db.prepare('DELETE FROM reports WHERE id = ?'),
    // Seguimiento
    studentByKey: db.prepare('SELECT * FROM students WHERE course_id = ? AND name_key = ?'),
    countStudents: db.prepare('SELECT COUNT(*) AS n FROM students WHERE course_id = ?'),
    insertStudent: db.prepare('INSERT INTO students (course_id, name, name_key, pin_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)'),
    insertStudentSession: db.prepare('INSERT INTO student_sessions (token_hash, student_id, expires_at) VALUES (?, ?, ?)'),
    purgeStudentSessions: db.prepare('DELETE FROM student_sessions WHERE expires_at <= ?'),
    deleteStudentSession: db.prepare('DELETE FROM student_sessions WHERE token_hash = ?'),
    sessionStudent: db.prepare(`SELECT s.id, s.name, s.course_id AS courseId, c.name AS courseName, c.join_code AS joinCode, c.open, ss.expires_at AS expiresAt
      FROM student_sessions ss JOIN students s ON s.id = ss.student_id JOIN courses c ON c.id = s.course_id WHERE ss.token_hash = ? AND ss.expires_at > ?`),
    touchStudent: db.prepare('UPDATE students SET last_seen_at = ? WHERE id = ?'),
    insertDay: db.prepare('INSERT OR IGNORE INTO activity_days (student_id, day) VALUES (?, ?)'),
    insertEvent: db.prepare('INSERT INTO events (student_id, kind, practice_id, detail, at) VALUES (?, ?, ?, ?, ?)'),
    lastEvent: db.prepare('SELECT at FROM events WHERE student_id = ? AND kind = ? AND (practice_id IS ? OR practice_id = ?) ORDER BY at DESC LIMIT 1'),
    progressOne: db.prepare('SELECT version, body FROM progress WHERE student_id = ? AND practice_id = ?'),
    countProgress: db.prepare('SELECT COUNT(*) AS n FROM progress WHERE student_id = ?'),
    upsertProgress: db.prepare(`INSERT INTO progress (student_id, practice_id, version, updated_at, percent, answered, correct, trials, active_ms, last_activity, body)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (student_id, practice_id) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at, percent = excluded.percent,
        answered = excluded.answered, correct = excluded.correct, trials = excluded.trials, active_ms = excluded.active_ms, last_activity = excluded.last_activity, body = excluded.body
      WHERE excluded.version > progress.version`),
    progressOfStudent: db.prepare('SELECT practice_id AS practiceId, version, updated_at AS updatedAt, body FROM progress WHERE student_id = ? ORDER BY last_activity DESC'),
    studentsOf: db.prepare('SELECT id, name, created_at AS createdAt, last_seen_at AS lastSeenAt FROM students WHERE course_id = ? ORDER BY name COLLATE NOCASE'),
    studentInCourse: db.prepare('SELECT id, name, created_at AS createdAt, last_seen_at AS lastSeenAt FROM students WHERE id = ? AND course_id = ?'),
    deleteStudent: db.prepare('DELETE FROM students WHERE id = ?'),
    progressOfCourse: db.prepare(`SELECT p.student_id AS studentId, p.practice_id AS practiceId, p.version, p.updated_at AS updatedAt, p.percent, p.answered, p.correct,
      p.trials, p.active_ms AS activeMs, p.last_activity AS lastActivity, p.body FROM progress p JOIN students s ON s.id = p.student_id WHERE s.course_id = ?`),
    daysOfCourse: db.prepare('SELECT a.student_id AS studentId, a.day FROM activity_days a JOIN students s ON s.id = a.student_id WHERE s.course_id = ? AND a.day >= ?'),
    loginsOfCourse: db.prepare(`SELECT e.at FROM events e JOIN students s ON s.id = e.student_id WHERE s.course_id = ? AND e.kind = 'ingreso' AND e.at >= ?`),
    timelineOf: db.prepare('SELECT kind, practice_id AS practiceId, detail, at FROM events WHERE student_id = ? ORDER BY at DESC, id DESC LIMIT 300'),
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

  // ------------------------------------------------------------ estudiantes

  /** Sesión de estudiante: tokens distintos de los del docente (no sirven en rutas docentes). */
  function authStudent(req) {
    const h = req.headers.authorization ?? '';
    const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(h);
    if (!m) throw new HttpError(401, 'Únete a tu curso para sincronizar tu avance.');
    const tokenHash = sha256(m[1]);
    const s = q.sessionStudent.get(tokenHash, now());
    if (!s) throw new HttpError(401, 'Tu sesión del curso expiró. Vuelve a unirte con tu nombre y PIN.');
    q.touchStudent.run(now(), s.id);
    q.insertDay.run(s.id, today());
    return { student: s, tokenHash };
  }

  function issueStudentSession(studentId) {
    q.purgeStudentSessions.run(now());
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now() + STUDENT_SESSION_DAYS * DAY_MS;
    q.insertStudentSession.run(sha256(token), studentId, expiresAt);
    return { token, expiresAt };
  }

  /** Registra un evento si no hay otro igual en la ventana indicada (evita duplicados por recargas). */
  function logEvent(studentId, kind, practiceId = null, detail = null, dedupeMs = 0) {
    if (dedupeMs > 0) {
      const last = q.lastEvent.get(studentId, kind, practiceId, practiceId);
      if (last && now() - last.at < dedupeMs) return false;
    }
    q.insertEvent.run(studentId, kind, practiceId, detail, now());
    return true;
  }

  function pinBlocked(key) {
    const e = pinFailures.get(key);
    if (!e) return false;
    if (now() - e.start > PIN_WINDOW) { pinFailures.delete(key); return false; }
    return e.count >= PIN_MAX_FAILS;
  }
  function pinFailed(key) {
    const e = pinFailures.get(key);
    if (!e || now() - e.start > PIN_WINDOW) pinFailures.set(key, { start: now(), count: 1 });
    else e.count++;
  }

  // ------------------------------------------------------------ analítica del curso

  const INACTIVE_DAYS = 7;
  const STALLED_DAYS = 3;
  const LOW_SCORE = 0.5;
  const LOW_SCORE_MIN_ANSWERS = 3;
  const DAILY_WINDOW = 14;

  function courseOwnedBy(teacher, id) {
    const c = q.courseOwned.get(Number(id), teacher.id);
    if (!c) throw new HttpError(404, 'Curso no encontrado.');
    return c;
  }

  /** Calcula indicadores, estudiantes, preguntas y alertas de un curso en una sola pasada. */
  function analytics(c) {
    const t = now();
    const todayStr = today();
    const since7 = dayOf(t - 6 * DAY_MS, tzOffsetMinutes);
    const sinceDaily = dayOf(t - (DAILY_WINDOW - 1) * DAY_MS, tzOffsetMinutes);
    const students = q.studentsOf.all(c.id).map((s) => ({
      ...s, practices: {}, avgPercent: null, score: { answered: 0, correct: 0 }, trials: 0, activeMs: 0, lastActivity: null,
      byCompetency: { uso: { answered: 0, correct: 0 }, explicacion: { answered: 0, correct: 0 }, indagacion: { answered: 0, correct: 0 } },
    }));
    const byId = new Map(students.map((s) => [s.id, s]));
    const practices = new Map();
    const questions = new Map();
    const competencies = { uso: { answered: 0, correct: 0 }, explicacion: { answered: 0, correct: 0 }, indagacion: { answered: 0, correct: 0 } };
    const alerts = [];

    for (const row of q.progressOfCourse.all(c.id)) {
      const st = byId.get(row.studentId);
      if (!st) continue;
      let body;
      try { body = JSON.parse(row.body); } catch { continue; }
      st.practices[row.practiceId] = {
        percent: row.percent, answered: row.answered, correct: row.correct, trials: row.trials, activeMs: row.activeMs,
        lastActivity: row.lastActivity, stages: body.stages ?? [], total: body.score?.total ?? 0,
      };
      st.score.answered += row.answered; st.score.correct += row.correct;
      st.trials += row.trials; st.activeMs += row.activeMs;
      st.lastActivity = Math.max(st.lastActivity ?? 0, row.lastActivity);
      for (const k of COMPETENCIES) {
        const v = body.score?.byCompetency?.[k];
        if (!v) continue;
        st.byCompetency[k].answered += v.answered; st.byCompetency[k].correct += v.correct;
        competencies[k].answered += v.answered; competencies[k].correct += v.correct;
      }
      const p = practices.get(row.practiceId) ?? { practiceId: row.practiceId, students: 0, percentSum: 0, answered: 0, correct: 0, trials: 0, activeMs: 0 };
      p.students++; p.percentSum += row.percent; p.answered += row.answered; p.correct += row.correct; p.trials += row.trials; p.activeMs += row.activeMs;
      practices.set(row.practiceId, p);
      for (const [qid, a] of Object.entries(body.answers ?? {})) {
        const e = questions.get(qid) ?? { questionId: qid, practiceIds: [], answered: 0, firstTryCorrect: 0, wrong: {} };
        if (!e.practiceIds.includes(row.practiceId)) e.practiceIds.push(row.practiceId);
        e.answered++;
        if (a.firstTryCorrect) e.firstTryCorrect++;
        else {
          const w = a.firstChosen ?? (!a.correct ? a.chosen : null);
          if (w) e.wrong[w] = (e.wrong[w] ?? 0) + 1;
        }
        questions.set(qid, e);
      }
      if (row.percent > 0 && row.percent < 100 && t - row.lastActivity > STALLED_DAYS * DAY_MS) {
        const days = Math.floor((t - row.lastActivity) / DAY_MS);
        alerts.push({ kind: 'estancada', studentId: st.id, name: st.name, practiceId: row.practiceId, since: row.lastActivity, message: `Lleva ${days} días sin avanzar en la práctica (avance ${row.percent} %).` });
      }
    }

    let percentSum = 0, percentN = 0, scoreSum = 0, scoreN = 0;
    for (const st of students) {
      const ps = Object.values(st.practices);
      if (ps.length) { st.avgPercent = Math.round(ps.reduce((a, p) => a + p.percent, 0) / ps.length); percentSum += st.avgPercent; percentN++; }
      if (st.score.answered) { scoreSum += st.score.correct / st.score.answered; scoreN++; }
      const lastSeen = Math.max(st.lastSeenAt, st.lastActivity ?? 0);
      if (t - lastSeen > INACTIVE_DAYS * DAY_MS) {
        alerts.push({ kind: 'inactivo', studentId: st.id, name: st.name, since: lastSeen, message: `Sin actividad desde hace ${Math.floor((t - lastSeen) / DAY_MS)} días.` });
      }
      for (const k of COMPETENCIES) {
        const v = st.byCompetency[k];
        if (v.answered >= LOW_SCORE_MIN_ANSWERS && v.correct / v.answered < LOW_SCORE) {
          alerts.push({ kind: 'puntaje-bajo', studentId: st.id, name: st.name, competency: k, message: `Acierta ${v.correct} de ${v.answered} preguntas al primer intento en esta competencia.` });
        }
      }
    }

    const dayRows = q.daysOfCourse.all(c.id, sinceDaily);
    const daily = [];
    for (let i = DAILY_WINDOW - 1; i >= 0; i--) daily.push({ day: dayOf(t - i * DAY_MS, tzOffsetMinutes), active: 0, logins: 0 });
    const dayIndex = new Map(daily.map((d, i) => [d.day, i]));
    for (const r of dayRows) { const i = dayIndex.get(r.day); if (i !== undefined) daily[i].active++; }
    for (const r of q.loginsOfCourse.all(c.id, t - DAILY_WINDOW * DAY_MS)) { const i = dayIndex.get(dayOf(r.at, tzOffsetMinutes)); if (i !== undefined) daily[i].logins++; }
    const activeToday = new Set(dayRows.filter((r) => r.day === todayStr).map((r) => r.studentId)).size;
    const active7 = new Set(dayRows.filter((r) => r.day >= since7).map((r) => r.studentId)).size;

    const practiceList = [...practices.values()].map((p) => ({
      practiceId: p.practiceId, students: p.students, avgPercent: Math.round(p.percentSum / p.students),
      avgScore: p.answered ? Math.round((p.correct / p.answered) * 100) : null, trials: p.trials, activeMs: p.activeMs,
    })).sort((a, b) => b.students - a.students || b.trials - a.trials);

    const questionList = [...questions.values()].map((e) => {
      const top = Object.entries(e.wrong).sort((a, b) => b[1] - a[1])[0];
      return { questionId: e.questionId, practiceIds: e.practiceIds, answered: e.answered, firstTryCorrect: e.firstTryCorrect,
        percent: Math.round((e.firstTryCorrect / e.answered) * 100), wrong: e.wrong, topWrong: top ? { option: top[0], count: top[1] } : null };
    }).sort((a, b) => a.percent - b.percent || b.answered - a.answered);

    const order = { inactivo: 0, 'puntaje-bajo': 1, estancada: 2 };
    alerts.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, 'es'));

    const summary = {
      course: { id: c.id, name: c.name, joinCode: c.join_code, open: c.open },
      generatedAt: t, today: todayStr,
      enrolled: students.length, activeToday, active7,
      avgPercent: percentN ? Math.round(percentSum / percentN) : null,
      avgScore: scoreN ? Math.round((scoreSum / scoreN) * 100) : null,
      totalTrials: students.reduce((a, s) => a + s.trials, 0),
      practices: practiceList, daily, competencies, alertCount: alerts.length,
    };
    const studentList = students.map(({ byCompetency, ...s }) => ({ ...s, byCompetency }));
    return { summary, students: studentList, questions: questionList, alerts };
  }

  function courseCsv(c) {
    const { students } = analytics(c);
    const day = (ts) => (ts ? dayOf(ts, tzOffsetMinutes) : '');
    const rows = [['Estudiante', 'Inscripción', 'Última actividad', 'Práctica', 'Avance (%)', 'Etapas completas', 'Ensayos', 'Respondidas', 'Aciertos 1.er intento', 'Puntaje (%)', 'Tiempo activo (min)', 'Conclusión']];
    for (const s of students) {
      const progress = q.progressOfStudent.all(s.id);
      if (progress.length === 0) rows.push([s.name, day(s.createdAt), day(s.lastSeenAt), '', '', '', '', '', '', '', '', '']);
      for (const p of progress) {
        const b = JSON.parse(p.body);
        rows.push([s.name, day(s.createdAt), day(Math.max(s.lastSeenAt, b.lastActivity ?? 0)), p.practiceId, b.percent, (b.stages ?? []).join(', '), b.trialsCount,
          b.score.answered, b.score.correct, b.score.answered ? Math.round((b.score.correct / b.score.answered) * 100) : '',
          Math.round((b.activeMs ?? 0) / 60000), b.conclusion?.claim ?? '']);
      }
    }
    return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  }

  /** Enrutador: devuelve [status, body]. */
  async function route(method, path, body, req, ip) {
    if (method === 'GET' && path === '/api/salud') return [200, { ok: true, version: 1 }];

    const blastRoute = await blast.handle(method, path, body, ip);
    if (blastRoute) return blastRoute;

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

    // ---------------------------------------------------------- estudiante

    // Inscripción o regreso: código del curso + nombre + PIN de 4 dígitos.
    if (method === 'POST' && path === '/api/estudiantes') {
      if (!joinLimiter(`${ip}:join`)) throw new HttpError(429, 'Demasiados intentos desde esta conexión. Espera unos minutos.');
      const code = typeof body.joinCode === 'string' ? body.joinCode.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{6}$/.test(code)) throw new HttpError(400, 'El código del curso tiene 6 caracteres.');
      const name = text(body.name, 'nombre', 60, 3).replace(/\s+/g, ' ');
      if (!/\p{L}/u.test(name)) throw new HttpError(400, 'Escribe tu nombre con letras.');
      const pin = typeof body.pin === 'string' ? body.pin : '';
      if (!/^\d{4}$/.test(pin)) throw new HttpError(400, 'El PIN debe tener exactamente 4 dígitos.');
      const c = q.courseByCode.get(code);
      if (!c) throw new HttpError(404, 'No existe un curso con ese código. Verifícalo con tu docente.');
      const key = nameKey(name);
      const failKey = `${c.id}:${key}`;
      if (pinBlocked(failKey)) throw new HttpError(429, 'Demasiados intentos con un PIN incorrecto. Espera 15 minutos o pide ayuda a tu docente.');
      const existing = q.studentByKey.get(c.id, key);
      let student, created = false;
      if (existing) {
        if (!verifyPassword(pin, existing.pin_hash)) {
          pinFailed(failKey);
          throw new HttpError(401, 'Ese nombre ya está inscrito en el curso y el PIN no coincide. Si eres tú, revisa tu PIN; si no, agrega tu segundo apellido o una inicial.');
        }
        pinFailures.delete(failKey);
        student = { id: existing.id, name: existing.name };
      } else {
        if (!c.open) throw new HttpError(403, 'Este curso no admite nuevas inscripciones. Pregúntale a tu docente.');
        if (q.countStudents.get(c.id).n >= MAX_STUDENTS) throw new HttpError(403, 'El curso alcanzó el número máximo de estudiantes.');
        const info = q.insertStudent.run(c.id, name, key, hashPassword(pin), now(), now());
        student = { id: Number(info.lastInsertRowid), name };
        created = true;
      }
      const session = issueStudentSession(student.id);
      q.touchStudent.run(now(), student.id);
      q.insertDay.run(student.id, today());
      logEvent(student.id, 'ingreso', null, created ? 'inscripcion' : null);
      return [created ? 201 : 200, { ...session, created, student, course: { name: c.name, joinCode: c.join_code } }];
    }

    if (method === 'GET' && path === '/api/estudiante') {
      const { student: s } = authStudent(req);
      logEvent(s.id, 'ingreso', null, null, 3 * 3600 * 1000);
      return [200, { student: { id: s.id, name: s.name }, course: { name: s.courseName, joinCode: s.joinCode, open: s.open }, expiresAt: s.expiresAt }];
    }

    if (method === 'DELETE' && path === '/api/estudiante/sesion') {
      const { tokenHash } = authStudent(req);
      q.deleteStudentSession.run(tokenHash);
      return [200, { ok: true }];
    }

    // Avance guardado (para continuar desde otro equipo).
    if (method === 'GET' && path === '/api/estudiante/progreso') {
      const { student: s } = authStudent(req);
      return [200, { progress: q.progressOfStudent.all(s.id).map((p) => ({ practiceId: p.practiceId, version: p.version, summary: JSON.parse(p.body) })) }];
    }

    if (method === 'POST' && path === '/api/estudiante/eventos') {
      const { student: s } = authStudent(req);
      if (!syncLimiter(`est:${s.id}`)) throw new HttpError(429, 'Demasiadas solicitudes. Se reintentará más tarde.');
      if (body.kind !== 'practica') throw new HttpError(400, 'Tipo de evento no válido.');
      if (typeof body.practiceId !== 'string' || !PRACTICE_RE.test(body.practiceId)) throw new HttpError(400, 'Práctica no válida.');
      const recorded = logEvent(s.id, 'practica', body.practiceId, null, 15 * 60 * 1000);
      return [recorded ? 201 : 200, { ok: true, recorded }];
    }

    m = /^\/api\/estudiante\/progreso\/([^/]+)$/.exec(path);
    if (m && method === 'PUT') {
      const { student: s } = authStudent(req);
      if (!syncLimiter(`est:${s.id}`)) throw new HttpError(429, 'Demasiadas sincronizaciones seguidas. Se reintentará más tarde.');
      const practiceId = decodeURIComponent(m[1]);
      if (!PRACTICE_RE.test(practiceId)) throw new HttpError(400, 'Práctica no válida.');
      if (!s.open) throw new HttpError(403, 'Este curso está cerrado y no recibe avances.');
      if ((req.rawSize ?? 0) > MAX_PROGRESS_BYTES) throw new HttpError(413, 'El resumen de avance es demasiado grande.');
      const p = validateProgress(body, now());
      const prev = q.progressOne.get(s.id, practiceId);
      if (prev && prev.version > p.version) return [200, { ok: true, stale: true, version: prev.version }];
      if (prev && prev.version === p.version) return [200, { ok: true, duplicate: true, version: prev.version }];
      if (!prev && q.countProgress.get(s.id).n >= MAX_PRACTICES) throw new HttpError(403, 'Se alcanzó el número máximo de prácticas.');
      q.upsertProgress.run(s.id, practiceId, p.version, now(), p.percent, p.score.answered, p.score.correct, p.trialsCount, p.activeMs, p.lastActivity, JSON.stringify(p));
      // Línea de tiempo: etapas recién completadas y nuevas respuestas.
      const old = prev ? JSON.parse(prev.body) : { stages: [], score: { answered: 0 } };
      for (const st of p.stages) if (!old.stages.includes(st)) logEvent(s.id, 'etapa', practiceId, st);
      if (p.score.answered > (old.score?.answered ?? 0)) logEvent(s.id, 'respuestas', practiceId, `${p.score.answered}/${p.score.total}`);
      return [prev ? 200 : 201, { ok: true, version: p.version }];
    }

    // ---------------------------------------------------------- seguimiento (docente)

    m = /^\/api\/cursos\/(\d+)\/(seguimiento|resumen|estudiantes|preguntas|alertas)$/.exec(path);
    if (m && method === 'GET') {
      const { teacher } = authTeacher(req);
      const data = analytics(courseOwnedBy(teacher, m[1]));
      if (m[2] === 'seguimiento') return [200, data];
      if (m[2] === 'resumen') return [200, { summary: data.summary }];
      if (m[2] === 'estudiantes') return [200, { students: data.students }];
      if (m[2] === 'preguntas') return [200, { questions: data.questions, competencies: data.summary.competencies }];
      return [200, { alerts: data.alerts }];
    }

    m = /^\/api\/cursos\/(\d+)\/seguimiento\.csv$/.exec(path);
    if (m && method === 'GET') {
      const { teacher } = authTeacher(req);
      const c = courseOwnedBy(teacher, m[1]);
      return [200, courseCsv(c), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="seguimiento-${c.join_code}.csv"` }];
    }

    m = /^\/api\/cursos\/(\d+)\/estudiantes\/(\d+)$/.exec(path);
    if (m && (method === 'GET' || method === 'DELETE')) {
      const { teacher } = authTeacher(req);
      const c = courseOwnedBy(teacher, m[1]);
      const st = q.studentInCourse.get(Number(m[2]), c.id);
      if (!st) throw new HttpError(404, 'Estudiante no encontrado.');
      if (method === 'DELETE') { q.deleteStudent.run(st.id); return [200, { ok: true }]; }
      const practices = q.progressOfStudent.all(st.id).map((p) => ({ practiceId: p.practiceId, updatedAt: p.updatedAt, ...JSON.parse(p.body) }));
      return [200, { student: st, practices, timeline: q.timelineOf.all(st.id) }];
    }

    throw new HttpError(404, 'Ruta no encontrada.');
  }

  function corsHeaders(origin) {
    const h = {};
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      h['Access-Control-Allow-Origin'] = allowedOrigins.includes('*') ? '*' : origin;
      h['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
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
    const send = (status, obj, headers) => {
      if (typeof obj === 'string') { res.writeHead(status, { ...base, ...headers }); res.end(obj); return; }
      res.writeHead(status, base); res.end(JSON.stringify(obj));
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, base); res.end(); return; }
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let body = {};
      if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) throw new HttpError(413, 'El envío es demasiado grande.');
          chunks.push(chunk);
        }
        req.rawSize = size;
        const raw = Buffer.concat(chunks).toString('utf8');
        try { body = raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, 'El cuerpo no es JSON válido.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'El cuerpo debe ser un objeto JSON.');
      }
      const ip = req.socket.remoteAddress ?? 'desconocida';
      const [status, out, headers] = await route(req.method, url.pathname, body, req, ip);
      send(status, out, headers);
    } catch (e) {
      if (e instanceof HttpError) send(e.status, { error: e.message });
      else { console.error(e); send(500, { error: 'Error interno del servidor.' }); }
    }
  }

  const server = createServer(handler);
  return { server, db, close: () => new Promise((r) => server.close(() => { db.close(); r(); })) };
}

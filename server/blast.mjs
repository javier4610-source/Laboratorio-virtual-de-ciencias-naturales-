// Proxy de Nivel 1 para NCBI BLAST (Common URL API, Blast.cgi). Sin dependencias externas.
//
// Reglas del NCBI verificadas el 2026-10-18 (ver docs/v2/BLAST.md):
//  - «Do not contact the server more often than once every 10 seconds.»  → una sola cola global; TODO contacto
//    (envío o consulta) espera ≥ 10 s desde el anterior.
//  - «Do not poll for any single RID more often than once a minute.»      → ≥ 60 s entre consultas del mismo RID.
//  - «Use the URL parameter email and tool»                               → NCBI_TOOL y NCBI_EMAIL (entorno).
//  - Más de 100 búsquedas en 24 h pasan a una cola lenta                  → tope diario global (100 por defecto).
// Los navegadores consultan este servidor (estado en memoria); nunca disparan contactos extra con el NCBI.
import { randomBytes, createHash } from 'node:crypto';

export const NCBI_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi';
export const MIN_CONTACT_INTERVAL_MS = 10_000;
export const MIN_POLL_INTERVAL_MS = 60_000;

/** Programas permitidos y tipo de secuencia de consulta / de base de datos. */
export const PROGRAMS = {
  blastn: { query: 'nucleotide', db: 'nucleotide' },
  blastp: { query: 'protein', db: 'protein' },
  blastx: { query: 'nucleotide', db: 'protein' },
  tblastn: { query: 'protein', db: 'nucleotide' },
};

/**
 * Bases de datos permitidas (nombres tomados de las opciones del formulario oficial de BLAST, consultado el
 * 2026-10-18). Se excluyen nt/nr por su tamaño: las búsquedas tardan más y cargan más al servicio compartido.
 */
export const DATABASES = {
  core_nt: { type: 'nucleotide', label: 'Core nucleotide database (core_nt)' },
  refseq_select_rna: { type: 'nucleotide', label: 'RefSeq Select RNA sequences (refseq_select)' },
  refseq_rna: { type: 'nucleotide', label: 'Reference RNA sequences (refseq_rna)' },
  swissprot: { type: 'protein', label: 'UniProtKB/Swiss-Prot (swissprot)' },
  refseq_select_prot: { type: 'protein', label: 'RefSeq Select proteins (refseq_select)' },
  refseq_protein: { type: 'protein', label: 'Reference proteins (refseq_protein)' },
};

export const QUERY_LIMITS = { min: 15, max: 1000 };
export const HITLIST = { min: 1, max: 50, default: 20 };
const NUC_RE = /^[ACGTUNRYKMSWBDHV]+$/;
const PROT_RE = /^[ACDEFGHIKLMNPQRSTVWYBZXUOJ*]+$/;
export const STATES = ['en-cola', 'ejecutando', 'completado', 'fallido', 'cancelado'];

class BlastError extends Error { constructor(status, message) { super(message); this.status = status; } }

// ---------------------------------------------------------------- validación

/** Limpia una consulta (texto plano o FASTA de un solo registro) y devuelve solo los residuos en mayúsculas. */
export function cleanQuery(raw) {
  if (typeof raw !== 'string') throw new BlastError(400, 'Falta la secuencia de consulta.');
  if (raw.length > 20_000) throw new BlastError(413, 'La consulta es demasiado larga.');
  const lines = raw.replace(/\r/g, '').split('\n');
  const headers = lines.filter((l) => l.trim().startsWith('>'));
  if (headers.length > 1) throw new BlastError(400, 'Envía una sola secuencia (un solo registro FASTA).');
  if (headers.length === 1 && !lines[0].trim().startsWith('>')) throw new BlastError(400, 'El encabezado FASTA debe ir en la primera línea.');
  return lines.filter((l) => !l.trim().startsWith('>')).join('').replace(/[\s\d]/g, '').toUpperCase();
}

/** Valida una solicitud del navegador. Devuelve los parámetros limpios o lanza BlastError(400). */
export function validateBlastRequest(body, limits = QUERY_LIMITS) {
  if (!body || typeof body !== 'object') throw new BlastError(400, 'Solicitud no válida.');
  const program = body.program;
  if (typeof program !== 'string' || !Object.hasOwn(PROGRAMS, program)) throw new BlastError(400, `Programa no permitido. Usa uno de: ${Object.keys(PROGRAMS).join(', ')}.`);
  const database = body.database;
  if (typeof database !== 'string' || !Object.hasOwn(DATABASES, database)) throw new BlastError(400, 'Base de datos no permitida.');
  if (DATABASES[database].type !== PROGRAMS[program].db) {
    throw new BlastError(400, `${program} busca en bases de ${PROGRAMS[program].db === 'protein' ? 'proteínas' : 'nucleótidos'}; ${database} no corresponde.`);
  }
  const query = cleanQuery(body.query);
  const kind = PROGRAMS[program].query;
  if (query.length < limits.min) throw new BlastError(400, `La secuencia debe tener al menos ${limits.min} residuos.`);
  if (query.length > limits.max) throw new BlastError(400, `La secuencia supera el máximo de ${limits.max} residuos de este servidor.`);
  if (kind === 'nucleotide' && !NUC_RE.test(query)) throw new BlastError(400, `${program} espera una secuencia de nucleótidos (A, C, G, T/U y códigos IUPAC).`);
  if (kind === 'protein' && !PROT_RE.test(query)) throw new BlastError(400, `${program} espera una secuencia de proteína (código de una letra).`);
  if (kind === 'protein' && NUC_RE.test(query) && /^[ACGTUN]+$/.test(query)) throw new BlastError(400, `La secuencia parece de nucleótidos; ${program} espera una proteína.`);
  let hitlistSize = HITLIST.default;
  if (body.hitlistSize !== undefined) {
    if (!Number.isInteger(body.hitlistSize) || body.hitlistSize < HITLIST.min || body.hitlistSize > HITLIST.max) throw new BlastError(400, `El número de resultados debe estar entre ${HITLIST.min} y ${HITLIST.max}.`);
    hitlistSize = body.hitlistSize;
  }
  let expect = 10; // valor por defecto documentado por el NCBI
  if (body.expect !== undefined) {
    if (typeof body.expect !== 'number' || !Number.isFinite(body.expect) || body.expect <= 0 || body.expect > 1000) throw new BlastError(400, 'El umbral de valor E debe ser un número mayor que 0 y como máximo 1000.');
    expect = body.expect;
  }
  return { program, database, query, hitlistSize, expect };
}

// ---------------------------------------------------------------- análisis de respuestas del NCBI

/** Extrae el bloque QBlastInfo de una respuesta HTML de Blast.cgi. */
export function parseQBlastInfo(text) {
  const m = /QBlastInfoBegin([\s\S]*?)QBlastInfoEnd/.exec(String(text));
  if (!m) return null;
  const rid = /RID\s*=\s*([A-Za-z0-9]+)/.exec(m[1])?.[1] ?? null;
  const rtoe = /RTOE\s*=\s*(\d+)/.exec(m[1]);
  const status = /Status\s*=\s*([A-Z]+)/.exec(m[1])?.[1] ?? null;
  return { rid, rtoe: rtoe ? Number(rtoe[1]) : null, status };
}

/** Respuesta de CMD=Put: RID y tiempo estimado (s). Lanza si el NCBI no devolvió un RID. */
export function parseSubmitResponse(text) {
  const info = parseQBlastInfo(text);
  if (!info?.rid) throw new BlastError(502, 'El NCBI no aceptó la búsqueda (no devolvió un identificador RID).');
  return { rid: info.rid, rtoeSeconds: info.rtoe };
}

/** Unión de intervalos [from, to] (para la cobertura de la consulta con varios HSP). */
function coveredLength(ranges) {
  const r = ranges.map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((x, y) => x[0] - y[0]);
  let total = 0, cs = -1, ce = -2;
  for (const [a, b] of r) {
    if (a > ce + 1) { if (ce >= cs && cs >= 0) total += ce - cs + 1; cs = a; ce = b; } else ce = Math.max(ce, b);
  }
  if (cs >= 0) total += ce - cs + 1;
  return total;
}

const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/**
 * Convierte el informe JSON2 (FORMAT_TYPE=JSON2_S) en una lista de aciertos. Identidad = identidades / longitud del
 * alineamiento del mejor HSP; cobertura = posiciones de la consulta cubiertas por todos los HSP / longitud de la consulta.
 */
export function parseJson2(json) {
  const obj = typeof json === 'string' ? JSON.parse(json) : json;
  const report = obj?.BlastOutput2?.[0]?.report;
  if (!report) throw new BlastError(502, 'El resultado del NCBI no tiene el formato JSON2 esperado.');
  const search = report.results?.search ?? {};
  const queryLength = Number(search.query_len) || 0;
  const dbType = DATABASES[report.search_target?.db]?.type ?? (report.program === 'blastp' || report.program === 'blastx' ? 'protein' : 'nucleotide');
  const hits = (search.hits ?? []).map((h) => {
    const d = h.description?.[0] ?? {};
    const hsps = h.hsps ?? [];
    const best = hsps[0] ?? {};
    // `accession` llega sin versión (p. ej. NM_000518); la versión está en `id` (gi|…|ref|NM_000518.5|).
    const accessionVersion = /(?:^|\|)([A-Za-z0-9_]+\.\d+)(?:\||$)/.exec(d.id ?? '')?.[1] ?? null;
    const accession = d.accession ?? accessionVersion ?? d.id ?? '';
    const linkId = accessionVersion ?? accession;
    return {
      num: h.num,
      accession,
      accessionVersion,
      description: d.title ?? '',
      organism: d.sciname ?? null,
      taxid: d.taxid ?? null,
      subjectLength: h.len ?? null,
      identityPct: best.align_len ? round((100 * best.identity) / best.align_len) : null,
      coveragePct: queryLength ? round((100 * coveredLength(hsps.map((s) => [s.query_from, s.query_to]))) / queryLength) : null,
      bitScore: best.bit_score ?? null,
      score: best.score ?? null,
      evalue: best.evalue ?? null,
      hspCount: hsps.length,
      alignment: best.qseq ? {
        alignLength: best.align_len, identities: best.identity, gaps: best.gaps ?? 0,
        queryFrom: best.query_from, queryTo: best.query_to, hitFrom: best.hit_from, hitTo: best.hit_to,
        queryStrand: best.query_strand ?? null, hitStrand: best.hit_strand ?? null,
        qseq: best.qseq, midline: best.midline ?? '', hseq: best.hseq,
      } : null,
      url: linkId ? `https://www.ncbi.nlm.nih.gov/${dbType === 'protein' ? 'protein' : 'nuccore'}/${encodeURIComponent(linkId)}` : null,
    };
  });
  return {
    program: report.program ?? null,
    version: report.version ?? null,
    reference: report.reference ?? null,
    database: report.search_target?.db ?? null,
    queryTitle: search.query_title ?? null,
    queryLength,
    dbSequences: search.stat?.db_num ?? null,
    dbLetters: search.stat?.db_len ?? null,
    expect: report.params?.expect ?? null,
    message: search.message ?? null,
    hits,
  };
}

/**
 * Clasifica una respuesta de CMD=Get&FORMAT_TYPE=JSON2_S: 'waiting' (sigue en curso), 'failed', 'unknown'
 * (RID desconocido o vencido), 'ready' (con el resultado analizado) o 'unexpected'.
 */
export function classifyGetResponse(text) {
  const info = parseQBlastInfo(text);
  if (info?.status === 'WAITING') return { kind: 'waiting' };
  if (info?.status === 'FAILED') return { kind: 'failed' };
  if (info?.status === 'UNKNOWN') return { kind: 'unknown' };
  const t = String(text).trim();
  if (t.startsWith('{')) {
    try { return { kind: 'ready', result: parseJson2(t) }; } catch { return { kind: 'unexpected' }; }
  }
  return { kind: 'unexpected' };
}

// ---------------------------------------------------------------- configuración

/** Lee la configuración desde variables de entorno. BLAST queda desactivado si falta NCBI_EMAIL. */
export function blastOptionsFromEnv(env = process.env) {
  const int = (v, d) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : d);
  return {
    email: env.NCBI_EMAIL?.trim() || '',
    tool: env.NCBI_TOOL?.trim() || 'lvcn-laboratorio',
    dailyLimit: int(env.BLAST_DAILY_LIMIT, 100),
    maxQueue: int(env.BLAST_MAX_QUEUE, 30),
  };
}

// ---------------------------------------------------------------- servicio

/**
 * Crea el servicio BLAST. Opciones (todas inyectables para pruebas):
 *  email, tool          identificación ante el NCBI (sin email el servicio queda «no disponible»)
 *  fetch, now           red y reloj
 *  setTimer, clearTimer temporizadores (setTimeout/clearTimeout)
 *  contactIntervalMs    ≥ 10 000 (se fuerza el mínimo)   pollIntervalMs ≥ 60 000 (se fuerza el mínimo)
 *  requestTimeoutMs, maxRetries, jobTimeoutMs, resultTtlMs, maxQueue, dailyLimit
 *  limits: { submit: [n, ventanaMs], status: [n, ventanaMs] } por cliente (IP)
 */
export function createBlastService(opts = {}) {
  const email = typeof opts.email === 'string' ? opts.email.trim() : '';
  const tool = (typeof opts.tool === 'string' && opts.tool.trim()) || 'lvcn-laboratorio';
  const doFetch = opts.fetch ?? globalThis.fetch;
  const now = opts.now ?? (() => Date.now());
  const setTimer = opts.setTimer ?? ((fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; });
  const clearTimer = opts.clearTimer ?? ((t) => clearTimeout(t));
  const baseUrl = opts.baseUrl ?? NCBI_BLAST_URL;
  const contactInterval = Math.max(MIN_CONTACT_INTERVAL_MS, opts.contactIntervalMs ?? MIN_CONTACT_INTERVAL_MS);
  const pollInterval = Math.max(MIN_POLL_INTERVAL_MS, opts.pollIntervalMs ?? MIN_POLL_INTERVAL_MS);
  const requestTimeout = opts.requestTimeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 2;
  const jobTimeout = opts.jobTimeoutMs ?? 120 * 60_000; // la búsqueda grabada el 2026-10-18 tardó más de 43 min
  const resultTtl = opts.resultTtlMs ?? 24 * 3600_000;
  const maxQueue = opts.maxQueue ?? 30;
  const dailyLimit = opts.dailyLimit ?? 100;
  const queryLimits = { ...QUERY_LIMITS, ...(opts.queryLimits ?? {}) };
  const [submitN, submitW] = opts.limits?.submit ?? [20, 3600_000];
  const [statusN, statusW] = opts.limits?.status ?? [600, 10 * 60_000];
  const available = !!email;

  const jobs = new Map(); // id → job
  const byKey = new Map(); // clave de la consulta → id (caché de búsquedas idénticas)
  const queue = []; // ids pendientes de enviar (FIFO)
  let lastContact = -Infinity;
  let busy = false;
  let timer = null;
  let timerAt = Infinity;
  const submits24h = []; // marcas de tiempo de envíos al NCBI
  const hits = new Map();

  const limiter = (key, n, w) => {
    const t = now();
    const e = hits.get(key);
    if (!e || t - e.start > w) { hits.set(key, { start: t, count: 1 }); return true; }
    e.count++;
    return e.count <= n;
  };

  function publicJob(job) {
    const out = {
      id: job.id, state: job.state, rid: job.rid ?? null, program: job.params.program, database: job.params.database,
      queryLength: job.params.query.length, hitlistSize: job.params.hitlistSize, expect: job.params.expect,
      createdAt: job.createdAt, submittedAt: job.submittedAt ?? null, finishedAt: job.finishedAt ?? null, updatedAt: job.updatedAt,
      nextCheckAt: job.state === 'ejecutando' ? job.nextPollAt : null,
      queuePosition: job.state === 'en-cola' ? queue.indexOf(job.id) + 1 : null,
      error: job.error ?? null, result: job.result ?? null, cached: false,
    };
    return out;
  }

  function setState(job, state, extra = {}) {
    Object.assign(job, extra, { state, updatedAt: now() });
    if (state === 'completado' || state === 'fallido' || state === 'cancelado') {
      job.finishedAt = now();
      if (state !== 'completado' && byKey.get(job.key) === job.id) byKey.delete(job.key);
    }
  }

  function purge() {
    const t = now();
    for (const [id, j] of jobs) {
      if (j.finishedAt && t - j.finishedAt > resultTtl) { jobs.delete(id); if (byKey.get(j.key) === id) byKey.delete(j.key); }
    }
    while (submits24h.length && t - submits24h[0] > 24 * 3600_000) submits24h.shift();
  }

  /** Próximo trabajo a atender: primero las consultas de RID vencidas (para terminar trabajos), luego envíos. */
  function nextTask() {
    const t = now();
    let poll = null;
    for (const j of jobs.values()) if (j.state === 'ejecutando' && (!poll || j.nextPollAt < poll.nextPollAt)) poll = j;
    if (poll && poll.nextPollAt <= t) return { job: poll, at: t };
    if (queue.length) return { job: jobs.get(queue[0]), at: t };
    if (poll) return { job: poll, at: poll.nextPollAt };
    return null;
  }

  function schedule() {
    if (busy) return;
    const task = nextTask();
    if (!task) { if (timer) clearTimer(timer); timer = null; timerAt = Infinity; return; }
    const at = Math.max(task.at, lastContact + contactInterval);
    if (timer && timerAt <= at) return;
    if (timer) clearTimer(timer);
    timerAt = at;
    timer = setTimer(() => { timer = null; timerAt = Infinity; void pump(); }, Math.max(0, at - now()));
  }

  async function ncbi(url, init) {
    const ctrl = new AbortController();
    const to = setTimer(() => ctrl.abort(), requestTimeout);
    lastContact = now();
    try {
      const res = await doFetch(url, { ...init, signal: ctrl.signal });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    } finally { clearTimer(to); }
  }

  const ident = () => ({ tool, email });

  async function submit(job) {
    const p = job.params;
    const form = new URLSearchParams({
      CMD: 'Put', PROGRAM: p.program, DATABASE: p.database, QUERY: p.query,
      HITLIST_SIZE: String(p.hitlistSize), EXPECT: String(p.expect), ...ident(),
    });
    try {
      const r = await ncbi(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
      if (!r.ok) throw new BlastError(502, `El NCBI respondió con el código ${r.status}.`);
      const { rid, rtoeSeconds } = parseSubmitResponse(r.text);
      submits24h.push(now());
      if (job.state !== 'en-cola') return; // cancelada mientras se enviaba: el NCBI la ejecuta, pero no se consulta
      dequeue(job.id);
      const wait = Math.max(pollInterval, (rtoeSeconds ?? 0) * 1000);
      setState(job, 'ejecutando', { rid, submittedAt: now(), lastPollAt: now(), nextPollAt: now() + wait, retries: 0 });
    } catch (e) {
      if (job.state !== 'en-cola') return;
      job.retries = (job.retries ?? 0) + 1;
      if (job.retries > maxRetries) {
        dequeue(job.id);
        setState(job, 'fallido', { error: e instanceof BlastError ? e.message : 'No se pudo contactar al NCBI (red o tiempo de espera agotado).' });
      }
      // si quedan reintentos, el trabajo sigue primero en la cola y se reintenta tras el intervalo global
    }
  }

  async function poll(job) {
    if (now() - job.submittedAt > jobTimeout) { setState(job, 'fallido', { error: 'Se superó el tiempo máximo de espera de la búsqueda.' }); return; }
    const q = new URLSearchParams({ CMD: 'Get', RID: job.rid, FORMAT_TYPE: 'JSON2_S', ...ident() });
    job.lastPollAt = now();
    job.nextPollAt = now() + pollInterval; // nunca antes de 1 min para el mismo RID
    try {
      const r = await ncbi(`${baseUrl}?${q}`, { method: 'GET' });
      if (!r.ok) throw new BlastError(502, `El NCBI respondió con el código ${r.status}.`);
      const c = classifyGetResponse(r.text);
      if (job.state !== 'ejecutando') return; // cancelada mientras se consultaba
      if (c.kind === 'waiting') { job.retries = 0; job.updatedAt = now(); return; }
      if (c.kind === 'ready') { setState(job, 'completado', { result: { ...c.result, retrievedAt: now() } }); return; }
      if (c.kind === 'failed') { setState(job, 'fallido', { error: 'El NCBI informó que la búsqueda falló.' }); return; }
      if (c.kind === 'unknown') { setState(job, 'fallido', { error: 'El NCBI no reconoce el identificador de la búsqueda (pudo vencer).' }); return; }
      throw new BlastError(502, 'Respuesta inesperada del NCBI.');
    } catch (e) {
      if (job.state !== 'ejecutando') return;
      job.retries = (job.retries ?? 0) + 1;
      if (job.retries > maxRetries) setState(job, 'fallido', { error: e instanceof BlastError ? e.message : 'No se pudo contactar al NCBI (red o tiempo de espera agotado).' });
    }
  }

  async function pump() {
    if (busy) return;
    const task = nextTask();
    if (!task || task.at > now() || lastContact + contactInterval > now()) { schedule(); return; }
    busy = true;
    try {
      if (task.job.state === 'en-cola') await submit(task.job);
      else if (task.job.state === 'ejecutando') await poll(task.job);
    } finally {
      busy = false;
      schedule();
    }
  }

  function enqueue(params, ip) {
    purge();
    const key = createHash('sha256').update(JSON.stringify([params.program, params.database, params.query, params.hitlistSize, params.expect])).digest('hex');
    const prevId = byKey.get(key);
    const prev = prevId && jobs.get(prevId);
    if (prev && prev.state !== 'fallido' && prev.state !== 'cancelado') return [200, { job: { ...publicJob(prev), cached: true } }];
    if (!limiter(`${ip}:submit`, submitN, submitW)) throw new BlastError(429, 'Se enviaron demasiadas búsquedas desde esta conexión. Espera un momento.');
    if (queue.length >= maxQueue) throw new BlastError(503, 'La cola de búsquedas está llena. Intenta de nuevo en unos minutos.');
    if (submits24h.length + queue.length >= dailyLimit) throw new BlastError(429, 'Se alcanzó el límite diario de búsquedas de este servidor (para respetar las condiciones del NCBI).');
    const id = randomBytes(16).toString('hex');
    const job = { id, key, params, state: 'en-cola', createdAt: now(), updatedAt: now(), retries: 0 };
    jobs.set(id, job);
    byKey.set(key, id);
    queue.push(id);
    schedule();
    return [202, { job: publicJob(job) }];
  }

  function dequeue(id) { const i = queue.indexOf(id); if (i >= 0) queue.splice(i, 1); }

  function cancel(job) {
    if (job.state === 'en-cola') { dequeue(job.id); setState(job, 'cancelado'); }
    else if (job.state === 'ejecutando') setState(job, 'cancelado'); // la URL API no documenta cancelar: solo dejamos de consultar
    schedule();
  }

  const info = () => ({
    available,
    reason: available ? null : 'El servidor no tiene configurado NCBI_EMAIL; BLAST no está disponible.',
    programs: Object.fromEntries(Object.entries(PROGRAMS).map(([k, v]) => [k, { ...v, databases: Object.keys(DATABASES).filter((d) => DATABASES[d].type === v.db) }])),
    databases: DATABASES,
    limits: { query: queryLimits, hitlist: HITLIST, pollIntervalMs: pollInterval, contactIntervalMs: contactInterval, dailyLimit },
    queueLength: queue.length,
  });

  /** Enrutador: devuelve [status, cuerpo] para /api/blast y /api/blast/:id, o null si la ruta no es de BLAST. */
  async function handle(method, path, body, ip = 'desconocida') {
    if (path !== '/api/blast' && !path.startsWith('/api/blast/')) return null;
    try {
      if (path === '/api/blast' && method === 'GET') return [200, info()];
      if (!available) throw new BlastError(503, 'Servicio no disponible: BLAST no está configurado en este servidor.');
      if (path === '/api/blast' && method === 'POST') return enqueue(validateBlastRequest(body, queryLimits), ip);
      const m = /^\/api\/blast\/([a-f0-9]{32})$/.exec(path);
      if (m && (method === 'GET' || method === 'DELETE')) {
        if (!limiter(`${ip}:status`, statusN, statusW)) throw new BlastError(429, 'Demasiadas consultas de estado. Espera un momento.');
        purge();
        const job = jobs.get(m[1]);
        if (!job) throw new BlastError(404, 'Búsqueda no encontrada (pudo vencer: los resultados se guardan 24 horas).');
        if (method === 'DELETE') cancel(job);
        return [200, { job: publicJob(job) }];
      }
      throw new BlastError(404, 'Ruta no encontrada.');
    } catch (e) {
      if (e instanceof BlastError) return [e.status, { error: e.message }];
      throw e;
    }
  }

  return {
    available, handle, info,
    stop: () => { if (timer) clearTimer(timer); timer = null; },
    /** Solo para pruebas: estado interno. */
    _debug: () => ({ queue: [...queue], lastContact, submits24h: [...submits24h] }),
  };
}

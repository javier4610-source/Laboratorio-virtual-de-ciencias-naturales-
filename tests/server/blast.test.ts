import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
// @ts-expect-error módulo JavaScript sin tipos
import { createBlastService, validateBlastRequest, parseSubmitResponse, parseQBlastInfo, classifyGetResponse, parseJson2, cleanQuery, blastOptionsFromEnv, DATABASES, PROGRAMS, MIN_CONTACT_INTERVAL_MS, MIN_POLL_INTERVAL_MS } from '../../server/blast.mjs';
// @ts-expect-error módulo JavaScript sin tipos
import { createApp } from '../../server/app.mjs';
import summary from '../../src/data/blast/registro-hbb-refseq_select_rna.json';

// Respuestas reales grabadas el 2026-10-18 (meta.json y docs/v2/BLAST.md). Ninguna prueba usa la red.
// Además, para casos que la búsqueda real no cubre (varios HSP, proteínas), se usa una ESTRUCTURA SINTÉTICA mínima
// (SYNTH), construida a mano con los nombres de campo de JSON2 y valores inventados: no es un resultado de BLAST.
const FIX = new URL('../fixtures/blast/2026-10-18-hbb-blastn-refseq_select_rna/', import.meta.url);
const fx = (name: string) => readFileSync(new URL(name, FIX), 'utf8');
const META = JSON.parse(fx('meta.json'));
const SUBMIT = fx('submit.html');
const WAITING = fx('status-waiting.html');
const REAL = fx('result.json');
const REAL_TEXT = fx('result.txt');
/** Estructura sintética (no es un resultado real): una consulta de 90 nt y dos aciertos ficticios «SINT_1» y «SINT_2». */
const SYNTH = {
  BlastOutput2: [{ report: {
    program: 'blastn', version: 'SINTETICO', reference: 'sintético', search_target: { db: 'refseq_select_rna' }, params: { expect: 10 },
    results: { search: { query_id: 'Query_1', query_title: 'prueba', query_len: 90, stat: { db_num: 1, db_len: 1 }, hits: [
      { num: 1, description: [{ id: 'ref|SINT_1|', accession: 'SINT_1', title: 'secuencia ficticia 1', taxid: 0, sciname: 'ficticia' }], len: 300, hsps: [
        { num: 1, bit_score: 100, score: 50, evalue: 1e-20, identity: 90, align_len: 90, gaps: 0, query_from: 1, query_to: 90, hit_from: 11, hit_to: 100, query_strand: 'Plus', hit_strand: 'Plus', qseq: 'QQQ', midline: '|||', hseq: 'QQQ' },
      ] },
      { num: 2, description: [{ id: 'ref|SINT_2|', accession: 'SINT_2', title: 'secuencia ficticia 2' }], len: 200, hsps: [
        { num: 1, bit_score: 40, score: 20, evalue: 0.001, identity: 40, align_len: 45, gaps: 1, query_from: 46, query_to: 90, hit_from: 1, hit_to: 44 },
      ] },
    ] } },
  } }],
};
const RESULT = JSON.stringify(SYNTH);

const QUERY = META.query as string;

describe('validación de la solicitud', () => {
  it('acepta blastn con una base de nucleótidos y limpia FASTA', () => {
    const r = validateBlastRequest({ program: 'blastn', database: 'refseq_select_rna', query: `>prueba\n${QUERY.slice(0, 45)}\n${QUERY.slice(45).toLowerCase()} 12` });
    expect(r).toEqual({ program: 'blastn', database: 'refseq_select_rna', query: QUERY, hitlistSize: 20, expect: 10 });
  });
  it('lista de programas y bases permitidas', () => {
    expect(Object.keys(PROGRAMS)).toEqual(['blastn', 'blastp', 'blastx', 'tblastn']);
    for (const db of Object.keys(DATABASES)) expect(['nucleotide', 'protein']).toContain(DATABASES[db].type);
    expect(() => validateBlastRequest({ program: 'tblastx', database: 'core_nt', query: QUERY })).toThrow(/Programa no permitido/);
    expect(() => validateBlastRequest({ program: 'blastn', database: 'nt', query: QUERY })).toThrow(/no permitida/);
    expect(() => validateBlastRequest({ program: 'blastn', database: 'constructor', query: QUERY })).toThrow(/no permitida/);
  });
  it('rechaza combinaciones programa/base incompatibles', () => {
    expect(() => validateBlastRequest({ program: 'blastn', database: 'swissprot', query: QUERY })).toThrow(/no corresponde/);
    expect(() => validateBlastRequest({ program: 'blastp', database: 'core_nt', query: 'MVHLTPEEKSAVTALWGKV' })).toThrow(/no corresponde/);
    expect(validateBlastRequest({ program: 'blastx', database: 'swissprot', query: QUERY }).database).toBe('swissprot');
    expect(validateBlastRequest({ program: 'tblastn', database: 'refseq_rna', query: 'MVHLTPEEKSAVTALWGKV' }).query).toBe('MVHLTPEEKSAVTALWGKV');
  });
  it('alfabeto, longitud, tamaño de lista y valor E', () => {
    expect(() => validateBlastRequest({ program: 'blastn', database: 'core_nt', query: 'ACGTACGTXXACGTACGT' })).toThrow(/nucleótidos/);
    expect(() => validateBlastRequest({ program: 'blastp', database: 'swissprot', query: 'ACGTACGTACGTACGTACGT' })).toThrow(/parece de nucleótidos/);
    expect(() => validateBlastRequest({ program: 'blastn', database: 'core_nt', query: 'ACGTACGT' })).toThrow(/al menos 15/);
    expect(() => validateBlastRequest({ program: 'blastn', database: 'core_nt', query: 'A'.repeat(1001) })).toThrow(/máximo de 1000/);
    expect(() => validateBlastRequest({ program: 'blastn', database: 'core_nt', query: QUERY, hitlistSize: 51 })).toThrow(/entre 1 y 50/);
    expect(() => validateBlastRequest({ program: 'blastn', database: 'core_nt', query: QUERY, hitlistSize: 2.5 })).toThrow(/entre 1 y 50/);
    expect(() => validateBlastRequest({ program: 'blastn', database: 'core_nt', query: QUERY, expect: 0 })).toThrow(/valor E/);
    expect(() => validateBlastRequest({ program: 'blastn', database: 'core_nt', query: 42 })).toThrow(/Falta la secuencia/);
    expect(() => cleanQuery('>a\nACGT\n>b\nACGT')).toThrow(/una sola secuencia/);
  });
});

describe('análisis de respuestas grabadas del NCBI', () => {
  it('envío (CMD=Put): RID y RTOE', () => {
    expect(parseSubmitResponse(SUBMIT)).toEqual({ rid: META.rid, rtoeSeconds: META.rtoeSeconds });
    expect(() => parseSubmitResponse('<html>Error</html>')).toThrow(/RID/);
  });
  it('estado en espera (CMD=Get): WAITING', () => {
    expect(parseQBlastInfo(WAITING)?.status).toBe('WAITING');
    expect(classifyGetResponse(WAITING)).toEqual({ kind: 'waiting' });
    expect(classifyGetResponse('QBlastInfoBegin\n Status=FAILED\nQBlastInfoEnd')).toEqual({ kind: 'failed' });
    expect(classifyGetResponse('QBlastInfoBegin\n Status=UNKNOWN\nQBlastInfoEnd')).toEqual({ kind: 'unknown' });
    expect(classifyGetResponse('<html>otra cosa</html>')).toEqual({ kind: 'unexpected' });
    expect(classifyGetResponse('{"no": "json2"}')).toEqual({ kind: 'unexpected' });
  });
  it('resultado JSON2 (estructura sintética): accesión, descripción, identidad, cobertura, puntuación, valor E y alineamiento', () => {
    expect(classifyGetResponse(RESULT).kind).toBe('ready');
    const r = parseJson2(RESULT);
    expect(r).toMatchObject({ program: 'blastn', version: 'SINTETICO', database: 'refseq_select_rna', queryLength: 90, dbSequences: 1 });
    expect(r.hits).toHaveLength(2);
    expect(r.hits[0]).toMatchObject({ accession: 'SINT_1', description: 'secuencia ficticia 1', identityPct: 100, coveragePct: 100, bitScore: 100, score: 50, evalue: 1e-20, hspCount: 1 });
    expect(r.hits[0].alignment).toMatchObject({ queryFrom: 1, queryTo: 90, hitFrom: 11, hitTo: 100, qseq: 'QQQ', midline: '|||', hseq: 'QQQ' });
    expect(r.hits[0].url).toBe('https://www.ncbi.nlm.nih.gov/nuccore/SINT_1');
    expect(r.hits[1]).toMatchObject({ identityPct: 88.9, coveragePct: 50, alignment: null, organism: null });
    const prot = parseJson2({ BlastOutput2: [{ report: { ...SYNTH.BlastOutput2[0].report, program: 'blastp', search_target: { db: 'swissprot' } } }] });
    expect(prot.hits[0].url).toBe('https://www.ncbi.nlm.nih.gov/protein/SINT_1');
  });
  it('cobertura: une los HSP solapados', () => {
    const r = parseJson2({ BlastOutput2: [{ report: { program: 'blastn', search_target: { db: 'core_nt' }, results: { search: { query_len: 100, hits: [{ num: 1, description: [{ accession: 'X' }], len: 500, hsps: [
      { bit_score: 50, score: 40, evalue: 1e-5, identity: 18, align_len: 20, query_from: 1, query_to: 20, qseq: 'A', hseq: 'A' },
      { bit_score: 40, score: 30, evalue: 1e-3, identity: 20, align_len: 20, query_from: 11, query_to: 30 },
      { bit_score: 30, score: 20, evalue: 1e-2, identity: 10, align_len: 10, query_from: 60, query_to: 51 },
    ] }] } } } }] });
    expect(r.hits[0].coveragePct).toBe(40); // 1–30 y 51–60
    expect(r.hits[0].identityPct).toBe(90);
    expect(() => parseJson2({})).toThrow(/JSON2/);
  });
  it('resultado real grabado (JSON2): HBB humano primero, 100 % de identidad y cobertura', () => {
    expect(classifyGetResponse(REAL).kind).toBe('ready');
    const r = parseJson2(REAL);
    expect(r).toMatchObject({ program: 'blastn', version: META.blastVersion, database: META.database, queryLength: 90, dbSequences: META.databaseSequences, dbLetters: META.databaseLetters });
    expect(r.hits).toHaveLength(10);
    const top = r.hits[0];
    expect(top).toMatchObject({
      accession: META.topHit.accession, accessionVersion: META.topHit.accessionVersion, description: META.topHit.description,
      identityPct: META.topHit.identityPct, coveragePct: META.topHit.coveragePct, bitScore: META.topHit.bitScore, evalue: META.topHit.evalue,
      url: 'https://www.ncbi.nlm.nih.gov/nuccore/NM_000518.5',
    });
    // El alineamiento cae en la CDS del registro (51..494): posiciones 51-140 del ARNm.
    expect(top.alignment).toMatchObject({ hitFrom: META.topHit.hitFrom, hitTo: META.topHit.hitTo, qseq: QUERY, hseq: QUERY });
    for (let i = 1; i < r.hits.length; i++) expect(r.hits[i].evalue).toBeGreaterThanOrEqual(r.hits[i - 1].evalue);
    for (const h of r.hits) { expect(h.identityPct).toBeGreaterThan(0); expect(h.identityPct).toBeLessThanOrEqual(100); expect(h.coveragePct).toBeLessThanOrEqual(100); }
  });
  it('el informe de texto grabado confirma base de datos, fecha de publicación y versión', () => {
    expect(REAL_TEXT).toContain(META.blastVersion);
    expect(REAL_TEXT).toContain(`RID: ${META.rid}`);
    expect(REAL_TEXT).toContain(`Database: ${META.databaseTitle}`);
    expect(REAL_TEXT).toContain(`Posted date:  ${META.databasePostedDate}`);
    expect(parseQBlastInfo(REAL_TEXT)?.status).toBe('READY');
  });
  it('el resumen que muestra la interfaz coincide con el análisis del archivo grabado', () => {
    const r = parseJson2(REAL);
    expect(summary.rid).toBe(META.rid);
    expect(summary.recordedAt).toBe(META.resultRetrievedAt);
    expect(summary.query).toBe(QUERY);
    expect(summary.databasePostedDate).toBe(META.databasePostedDate);
    expect({ ...summary.result, retrievedAt: undefined }).toEqual({ ...r, retrievedAt: undefined });
  });
  it('la consulta grabada es el segmento 1-90 de la CDS de NM_000518.5', () => {
    expect(QUERY).toHaveLength(90);
    expect(QUERY.startsWith('ATG')).toBe(true);
    expect(SUBMIT).toContain('REDACTADO');
  });
});

// ---------------------------------------------------------------- cola, intervalos y límites (reloj simulado)

function harness(responses: (url: string, init: RequestInit) => string | Error, extra: Record<string, unknown> = {}) {
  let clock = 1_000_000;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const calls: { at: number; method: string; url: string; body: string }[] = [];
  const svc = createBlastService({
    email: 'docente@example.org', tool: 'prueba',
    now: () => clock,
    setTimer: (fn: () => void, ms: number) => { const id = nextId++; timers.push({ at: clock + ms, fn, id }); return id; },
    clearTimer: (id: number) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    fetch: async (url: string, init: RequestInit) => {
      calls.push({ at: clock, method: init.method ?? 'GET', url, body: String(init.body ?? '') });
      const r = responses(url, init);
      if (r instanceof Error) throw r;
      return new Response(r, { status: 200 });
    },
    ...extra,
  });
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
  async function advance(ms: number) {
    const end = clock + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > end) break;
      timers.shift();
      clock = Math.max(clock, t.at);
      t.fn();
      await flush();
    }
    clock = end;
    await flush();
  }
  return { svc, calls, advance, flush, get clock() { return clock; } };
}

const submitHtml = (rid: string) => `QBlastInfoBegin\n    RID = ${rid}\n    RTOE = 5\nQBlastInfoEnd`;
const req = (q = QUERY) => ({ program: 'blastn', database: 'refseq_select_rna', query: q, hitlistSize: 10 });
const seqs = ['ACGTTGCAACGTTGCAACGT', 'TTTTGGGGCCCCAAAATTTT', 'GATTACAGATTACAGATTACA', 'CCCGGGAAATTTCCCGGGAAA'];

describe('cola global y reglas de frecuencia', () => {
  it('respeta ≥ 10 s entre contactos y ≥ 60 s entre consultas del mismo RID; completa con el resultado grabado', async () => {
    let n = 0; let polls = 0;
    const h = harness((url) => {
      if (!url.includes('CMD=Get')) return submitHtml(`RID${++n}`);
      polls++;
      return polls <= 4 ? WAITING : RESULT;
    });
    const jobs = [];
    for (const s of seqs.slice(0, 3)) {
      const [st, body] = await h.svc.handle('POST', '/api/blast', req(s), '1.1.1.1');
      expect(st).toBe(202);
      expect(body.job.state).toBe('en-cola');
      jobs.push(body.job.id);
    }
    await h.advance(10 * 60_000);
    expect(h.calls.length).toBe(3 + 4 + 3); // 3 envíos, 4 respuestas WAITING y 3 resultados
    // Intervalo global
    for (let i = 1; i < h.calls.length; i++) expect(h.calls[i].at - h.calls[i - 1].at).toBeGreaterThanOrEqual(MIN_CONTACT_INTERVAL_MS);
    // Intervalo por RID
    const byRid = new Map<string, number[]>();
    for (const c of h.calls) { const rid = /RID=([A-Z0-9]+)/.exec(c.url)?.[1]; if (rid) byRid.set(rid, [...(byRid.get(rid) ?? []), c.at]); }
    expect(byRid.size).toBe(3);
    for (const times of byRid.values()) for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(MIN_POLL_INTERVAL_MS);
    // Primera consulta ≥ 60 s después del envío
    const submits = h.calls.filter((c) => c.method === 'POST');
    expect(submits).toHaveLength(3);
    expect(byRid.get('RID1')![0] - submits[0].at).toBeGreaterThanOrEqual(MIN_POLL_INTERVAL_MS);
    // tool y email en cada contacto
    for (const c of h.calls) { const p = c.method === 'POST' ? c.body : c.url; expect(p).toContain('tool=prueba'); expect(p).toContain('email=docente%40example.org'); }
    const [, done] = await h.svc.handle('GET', `/api/blast/${jobs[0]}`, {}, '1.1.1.1');
    expect(done.job.state).toBe('completado');
    expect(done.job.result.hits[0].accession).toBe('SINT_1');
  });

  it('los intervalos no pueden configurarse por debajo del mínimo', async () => {
    let n = 0;
    const h = harness((url) => (url.includes('CMD=Get') ? WAITING : submitHtml(`R${++n}`)), { contactIntervalMs: 1, pollIntervalMs: 1 });
    await h.svc.handle('POST', '/api/blast', req(seqs[0]), 'a');
    await h.svc.handle('POST', '/api/blast', req(seqs[1]), 'a');
    await h.advance(200_000);
    for (let i = 1; i < h.calls.length; i++) expect(h.calls[i].at - h.calls[i - 1].at).toBeGreaterThanOrEqual(10_000);
    expect(h.svc.info().limits).toMatchObject({ contactIntervalMs: 10_000, pollIntervalMs: 60_000 });
  });

  it('consultar el estado desde el navegador no genera contactos con el NCBI y la búsqueda idéntica usa la caché', async () => {
    const h = harness((url) => (url.includes('CMD=Get') ? RESULT : submitHtml('RIDX')));
    const [, a] = await h.svc.handle('POST', '/api/blast', req(), 'a');
    await h.advance(1000);
    for (let i = 0; i < 30; i++) await h.svc.handle('GET', `/api/blast/${a.job.id}`, {}, 'a');
    expect(h.calls).toHaveLength(1);
    await h.advance(120_000);
    expect(h.calls).toHaveLength(2);
    const [st, b] = await h.svc.handle('POST', '/api/blast', req(), 'b');
    expect(st).toBe(200);
    expect(b.job.cached).toBe(true);
    expect(b.job.state).toBe('completado');
    expect(h.calls).toHaveLength(2);
  });
});

describe('estados de error, cancelación y límites', () => {
  it('reintentos acotados: un error de red repetido deja la búsqueda en «fallido»', async () => {
    const h = harness(() => new Error('red caída'), { maxRetries: 2 });
    const [, a] = await h.svc.handle('POST', '/api/blast', req(), 'a');
    await h.advance(120_000);
    expect(h.calls).toHaveLength(3); // 1 intento + 2 reintentos
    const [, s] = await h.svc.handle('GET', `/api/blast/${a.job.id}`, {}, 'a');
    expect(s.job.state).toBe('fallido');
    expect(s.job.error).toMatch(/No se pudo contactar/);
  });
  it('NCBI informa FAILED o UNKNOWN → «fallido»; tiempo máximo → «fallido»', async () => {
    const h = harness((url) => (url.includes('CMD=Get') ? 'QBlastInfoBegin\n Status=FAILED\nQBlastInfoEnd' : submitHtml('RF')));
    const [, a] = await h.svc.handle('POST', '/api/blast', req(), 'a');
    await h.advance(70_000);
    expect((await h.svc.handle('GET', `/api/blast/${a.job.id}`, {}, 'a'))[1].job).toMatchObject({ state: 'fallido', rid: 'RF' });

    const h2 = harness((url) => (url.includes('CMD=Get') ? WAITING : submitHtml('RT')), { jobTimeoutMs: 3 * 60_000 });
    const [, b] = await h2.svc.handle('POST', '/api/blast', req(), 'a');
    await h2.advance(10 * 60_000);
    const s = (await h2.svc.handle('GET', `/api/blast/${b.job.id}`, {}, 'a'))[1].job;
    expect(s.state).toBe('fallido');
    expect(s.error).toMatch(/tiempo máximo/);
  });
  it('cancelar en cola y en ejecución', async () => {
    const h = harness((url) => (url.includes('CMD=Get') ? WAITING : submitHtml('RC')));
    const [, a] = await h.svc.handle('POST', '/api/blast', req(seqs[0]), 'a');
    const [, b] = await h.svc.handle('POST', '/api/blast', req(seqs[1]), 'a');
    expect(b.job.queuePosition).toBe(2);
    expect((await h.svc.handle('DELETE', `/api/blast/${b.job.id}`, {}, 'a'))[1].job.state).toBe('cancelado');
    await h.advance(5_000);
    expect((await h.svc.handle('GET', `/api/blast/${a.job.id}`, {}, 'a'))[1].job.state).toBe('ejecutando');
    expect((await h.svc.handle('DELETE', `/api/blast/${a.job.id}`, {}, 'a'))[1].job.state).toBe('cancelado');
    await h.advance(10 * 60_000);
    expect(h.calls).toHaveLength(1); // solo el envío de «a»; nada después de cancelar
  });
  it('límite por cliente, cola llena y tope diario', async () => {
    const h = harness(() => submitHtml('RL'), { limits: { submit: [2, 3600_000] }, maxQueue: 3, dailyLimit: 3 });
    expect((await h.svc.handle('POST', '/api/blast', req(seqs[0]), 'ip1'))[0]).toBe(202);
    expect((await h.svc.handle('POST', '/api/blast', req(seqs[1]), 'ip1'))[0]).toBe(202);
    const [st, body] = await h.svc.handle('POST', '/api/blast', req(seqs[2]), 'ip1');
    expect(st).toBe(429); expect(body.error).toMatch(/demasiadas búsquedas/);
    expect((await h.svc.handle('POST', '/api/blast', req(seqs[2]), 'ip2'))[0]).toBe(202);
    const [st2, b2] = await h.svc.handle('POST', '/api/blast', req(seqs[3]), 'ip3');
    expect(st2).toBe(503); expect(b2.error).toMatch(/cola/);
  });
  it('tope diario de envíos al NCBI', async () => {
    const h = harness(() => submitHtml('RD'), { dailyLimit: 1 });
    expect((await h.svc.handle('POST', '/api/blast', req(seqs[0]), 'a'))[0]).toBe(202);
    const [st, b] = await h.svc.handle('POST', '/api/blast', req(seqs[1]), 'b');
    expect(st).toBe(429); expect(b.error).toMatch(/límite diario/);
  });
  it('identificador desconocido o mal formado', async () => {
    const h = harness(() => '');
    expect((await h.svc.handle('GET', `/api/blast/${'a'.repeat(32)}`, {}, 'a'))[0]).toBe(404);
    expect((await h.svc.handle('GET', '/api/blast/../../etc', {}, 'a'))[0]).toBe(404);
    expect(await h.svc.handle('GET', '/api/otra', {}, 'a')).toBeNull();
  });
  it('sin NCBI_EMAIL el servicio queda «no disponible» y no contacta al NCBI', async () => {
    let called = false;
    const svc = createBlastService({ email: '', fetch: async () => { called = true; return new Response(''); } });
    const [st, info] = await svc.handle('GET', '/api/blast', {}, 'a');
    expect(st).toBe(200); expect(info.available).toBe(false);
    const [st2, e] = await svc.handle('POST', '/api/blast', req(), 'a');
    expect(st2).toBe(503); expect(e.error).toMatch(/Servicio no disponible/);
    expect(called).toBe(false);
  });
  it('configuración desde el entorno (sin correo escrito en el código)', () => {
    expect(blastOptionsFromEnv({})).toMatchObject({ email: '', tool: 'lvcn-laboratorio', dailyLimit: 100 });
    expect(blastOptionsFromEnv({ NCBI_EMAIL: ' x@y.org ', NCBI_TOOL: 'mi-colegio', BLAST_DAILY_LIMIT: '50' })).toMatchObject({ email: 'x@y.org', tool: 'mi-colegio', dailyLimit: 50 });
  });
});

describe('integración con el servidor (CORS y rutas)', () => {
  it('rutas /api/blast montadas en createApp con CORS restringido', async () => {
    const app = createApp({ dbPath: ':memory:', registrationCode: 'COLEGIO-2026', allowedOrigins: ['http://localhost:4173'], blast: { email: '' } });
    await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()));
    const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    try {
      const ok = await fetch(`${base}/api/blast`, { headers: { Origin: 'http://localhost:4173' } });
      expect(ok.status).toBe(200);
      expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:4173');
      expect((await ok.json()).available).toBe(false);
      const other = await fetch(`${base}/api/blast`, { headers: { Origin: 'https://otro.example' } });
      expect(other.headers.get('access-control-allow-origin')).toBeNull();
      const post = await fetch(`${base}/api/blast`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req()) });
      expect(post.status).toBe(503);
      expect((await fetch(`${base}/api/salud`)).status).toBe(200);
    } finally { await app.close(); }
  });
});

describe('carreras con la cancelación', () => {
  it('cancelar mientras se envía no saca de la cola otra búsqueda ni reanuda las consultas', async () => {
    let release: (v: string) => void = () => undefined;
    let pending = 0;
    const h = harness(() => '', {
      fetch: () => { pending++; return new Promise<Response>((r) => { release = (v) => r(new Response(v)); }); },
    });
    const [, a] = await h.svc.handle('POST', '/api/blast', req(seqs[0]), 'x');
    const [, b] = await h.svc.handle('POST', '/api/blast', req(seqs[1]), 'x');
    await h.advance(1);
    expect(pending).toBe(1); // envío de «a» en curso
    await h.svc.handle('DELETE', `/api/blast/${a.job.id}`, {}, 'x');
    release(submitHtml('RIDA'));
    await h.advance(1);
    expect((await h.svc.handle('GET', `/api/blast/${a.job.id}`, {}, 'x'))[1].job.state).toBe('cancelado');
    expect((await h.svc.handle('GET', `/api/blast/${b.job.id}`, {}, 'x'))[1].job.state).toBe('en-cola');
    expect(h.svc._debug().queue).toEqual([b.job.id]);
    await h.advance(15_000);
    expect(pending).toBe(2); // ahora se envía «b», ≥ 10 s después
    h.svc.stop();
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  BlastRun, DATABASE_INFO, POLL_INTERVAL_MS, PROGRAM_INFO, checkBlastService, cleanSequence, databasesFor, guessKind,
  ncbiBlastFormUrl, ncbiRecordUrl, sortHits, type BlastClientState, type BlastHit, type BlastJob,
} from '../../src/lib/blast';
// @ts-expect-error módulo JavaScript sin tipos
import { DATABASES, PROGRAMS } from '../../server/blast.mjs';

const job = (state: BlastJob['state'], extra: Partial<BlastJob> = {}): BlastJob => ({
  id: 'a'.repeat(32), state, rid: state === 'en-cola' ? null : 'RID1', program: 'blastn', database: 'refseq_select_rna',
  queryLength: 90, hitlistSize: 10, expect: 10, createdAt: 0, submittedAt: null, finishedAt: null, updatedAt: 0,
  nextCheckAt: null, queuePosition: null, error: null, result: null, cached: false, ...extra,
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** fetch simulado: responde en orden y registra las llamadas. */
function mockFetch(responses: (Response | Error)[]) {
  const calls: { url: string; method: string }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    const r = responses.shift();
    if (!r) throw new Error('sin respuesta');
    if (r instanceof Error) throw r;
    return r;
  });
  return { fn, calls };
}

describe('catálogo coherente con el servidor', () => {
  it('programas y bases del cliente = allow-list del proxy', () => {
    expect(Object.keys(PROGRAM_INFO)).toEqual(Object.keys(PROGRAMS));
    for (const p of Object.keys(PROGRAMS)) expect({ query: PROGRAM_INFO[p as 'blastn'].query, db: PROGRAM_INFO[p as 'blastn'].db }).toEqual(PROGRAMS[p]);
    expect(DATABASE_INFO).toEqual(DATABASES);
    expect(databasesFor('blastp')).toEqual(['swissprot', 'refseq_select_prot', 'refseq_protein']);
  });
});

describe('utilidades', () => {
  it('limpieza y tipo de secuencia', () => {
    expect(cleanSequence('>x desc\nacgt 1\nACGU\n')).toBe('ACGTACGU');
    expect(guessKind('ACGTN')).toBe('nucleotide');
    expect(guessKind('MVHLTPEEK')).toBe('protein');
    expect(guessKind('ACG#T')).toBeNull();
  });
  it('enlaces al NCBI', () => {
    const u = new URL(ncbiBlastFormUrl('blastn', 'ACGT'));
    expect(u.origin + u.pathname).toBe('https://blast.ncbi.nlm.nih.gov/Blast.cgi');
    expect(u.searchParams.get('PROGRAM')).toBe('blastn');
    expect(u.searchParams.get('PAGE_TYPE')).toBe('BlastSearch');
    expect(u.searchParams.get('QUERY')).toBe('ACGT');
    expect(new URL(ncbiBlastFormUrl('blastp', 'A'.repeat(2000))).searchParams.get('QUERY')).toBeNull();
    expect(ncbiRecordUrl('NM_000518.5', 'nucleotide')).toBe('https://www.ncbi.nlm.nih.gov/nuccore/NM_000518.5');
    expect(ncbiRecordUrl('P68871.2', 'protein')).toBe('https://www.ncbi.nlm.nih.gov/protein/P68871.2');
  });
  it('ordenar aciertos', () => {
    const h = (num: number, evalue: number | null, identityPct: number) => ({ num, evalue, identityPct, accession: `A${num}` }) as BlastHit;
    const list = [h(1, 1e-40, 100), h(2, 1e-10, 90), h(3, null, 95)];
    expect(sortHits(list, 'evalue', 'asc').map((x) => x.num)).toEqual([1, 2, 3]);
    expect(sortHits(list, 'identityPct', 'desc').map((x) => x.num)).toEqual([1, 3, 2]);
    expect(list.map((x) => x.num)).toEqual([1, 2, 3]);
  });
});

describe('servicio disponible o no', () => {
  it('sin servidor configurado: no disponible, sin red', async () => {
    const { fn } = mockFetch([]);
    expect(await checkBlastService('', fn)).toEqual({ available: false, reason: 'No hay un servidor institucional configurado.' });
    expect(fn).not.toHaveBeenCalled();
  });
  it('servidor caído, servidor sin la ruta y servidor con BLAST', async () => {
    expect((await checkBlastService('https://s', mockFetch([new TypeError('fail')]).fn)).available).toBe(false);
    expect((await checkBlastService('https://s', mockFetch([json(404, { error: 'Ruta no encontrada.' })]).fn)).reason).toMatch(/no tiene el servicio/);
    expect(await checkBlastService('https://s', mockFetch([json(200, { available: true, reason: null })]).fn)).toEqual({ available: true, reason: null });
  });
});

describe('máquina de estados de BlastRun', () => {
  const req = { program: 'blastn' as const, database: 'refseq_select_rna', query: 'ACGT'.repeat(10) };

  it('enviando → en-cola → ejecutando → completado, consultando cada ≥ 60 s', async () => {
    vi.useFakeTimers();
    try {
      const { fn, calls } = mockFetch([
        json(202, { job: job('en-cola', { queuePosition: 1 }) }),
        json(200, { job: job('ejecutando') }),
        json(200, { job: job('completado', { result: { hits: [] } as never }) }),
      ]);
      const states: BlastClientState[] = [];
      const run = new BlastRun(req, { server: 'https://s/', fetch: fn, pollIntervalMs: 5, onUpdate: (s) => states.push(s.state) });
      await vi.advanceTimersByTimeAsync(0);
      expect(states).toEqual(['enviando', 'en-cola']);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1);
      expect(calls).toHaveLength(1); // pollIntervalMs=5 se eleva a 60 s
      await vi.advanceTimersByTimeAsync(1);
      expect(calls).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      const final = await run.done;
      expect(final.state).toBe('completado');
      expect(states).toEqual(['enviando', 'en-cola', 'ejecutando', 'completado']);
      expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
        'POST https://s/api/blast', `GET https://s/api/blast/${'a'.repeat(32)}`, `GET https://s/api/blast/${'a'.repeat(32)}`,
      ]);
    } finally { vi.useRealTimers(); }
  });

  it('resultado en caché: completado sin consultar el estado', async () => {
    const { fn, calls } = mockFetch([json(200, { job: job('completado', { cached: true }) })]);
    const run = new BlastRun(req, { server: 'https://s', fetch: fn, onUpdate: () => undefined });
    expect((await run.done).state).toBe('completado');
    expect(calls).toHaveLength(1);
  });

  it('cancelar: aborta la espera y avisa al servidor', async () => {
    vi.useFakeTimers();
    try {
      const { fn, calls } = mockFetch([json(202, { job: job('en-cola') }), json(200, { job: job('cancelado') })]);
      const run = new BlastRun(req, { server: 'https://s', fetch: fn, onUpdate: () => undefined });
      await vi.advanceTimersByTimeAsync(0);
      run.cancel();
      const final = await run.done;
      expect(final.state).toBe('cancelado');
      await vi.advanceTimersByTimeAsync(0);
      expect(calls.map((c) => c.method)).toEqual(['POST', 'DELETE']);
      await vi.advanceTimersByTimeAsync(5 * POLL_INTERVAL_MS);
      expect(calls).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it('errores: validación → fallido; servidor caído o 503 → no-disponible; sin servidor → no-disponible', async () => {
    const r1 = new BlastRun(req, { server: 'https://s', fetch: mockFetch([json(400, { error: 'Base de datos no permitida.' })]).fn, onUpdate: () => undefined });
    expect(await r1.done).toMatchObject({ state: 'fallido', message: 'Base de datos no permitida.' });
    const r2 = new BlastRun(req, { server: 'https://s', fetch: mockFetch([new TypeError('fail')]).fn, onUpdate: () => undefined });
    expect((await r2.done).state).toBe('no-disponible');
    const r3 = new BlastRun(req, { server: 'https://s', fetch: mockFetch([json(503, { error: 'Servicio no disponible: BLAST no está configurado en este servidor.' })]).fn, onUpdate: () => undefined });
    expect(await r3.done).toMatchObject({ state: 'no-disponible' });
    const r4 = new BlastRun(req, { server: '', fetch: mockFetch([]).fn, onUpdate: () => undefined });
    expect((await r4.done).state).toBe('no-disponible');
    const r5 = new BlastRun(req, { server: 'https://s', fetch: mockFetch([json(429, { error: 'Demasiadas' })]).fn, onUpdate: () => undefined });
    expect((await r5.done).state).toBe('fallido');
  });

  it('fallo del NCBI informado por el proxy y pérdida de conexión durante la espera', async () => {
    vi.useFakeTimers();
    try {
      const a = new BlastRun(req, { server: 'https://s', fetch: mockFetch([json(202, { job: job('ejecutando') }), json(200, { job: job('fallido', { error: 'El NCBI informó que la búsqueda falló.' }) })]).fn, onUpdate: () => undefined });
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(await a.done).toMatchObject({ state: 'fallido', message: 'El NCBI informó que la búsqueda falló.' });
      const b = new BlastRun(req, { server: 'https://s', fetch: mockFetch([json(202, { job: job('ejecutando') }), new TypeError('x'), new TypeError('x'), new TypeError('x')]).fn, onUpdate: () => undefined });
      await vi.advanceTimersByTimeAsync(3 * POLL_INTERVAL_MS);
      expect((await b.done).state).toBe('no-disponible');
    } finally { vi.useRealTimers(); }
  });
});

describe('vista de resultados (render en el servidor, sin red)', () => {
  it('muestra los mensajes obligatorios, la procedencia y enlaces a los registros del NCBI', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { BlastResultView, BlastPanel } = await import('../../src/components/BlastPanel');
    const rec = (await import('../../src/data/blast/registro-hbb-refseq_select_rna.json')).default;
    const html = renderToStaticMarkup(createElement(BlastResultView, {
      result: rec.result as never, rid: rec.rid, program: rec.program, postedDate: rec.databasePostedDate, dbTitle: rec.databaseTitle,
    }));
    expect(html).toContain('depende de la base de datos elegida y de la fecha');
    expect(html).toContain('Una identidad alta no implica que la función sea idéntica');
    expect(html).toContain('Anota la fecha, la base de datos y su versión');
    expect(html).toContain('href="https://www.ncbi.nlm.nih.gov/nuccore/NM_000518.5"');
    expect(html).toContain('D9HJG79C016');
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain('Predicción computacional');
    // El panel respeta el indicador «blast»: apagado → no se muestra nada.
    const { flag } = await import('../../src/lib/flags');
    if (!flag('blast' as never)) expect(renderToStaticMarkup(createElement(BlastPanel, { sequence: 'ACGT' }))).toBe('');
  });
});

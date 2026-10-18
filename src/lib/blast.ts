/**
 * Cliente del proxy BLAST del servidor institucional (server/blast.mjs). El navegador no puede llamar a
 * Blast.cgi directamente (el NCBI no envía cabeceras CORS; docs/v2/DIAGNOSTICO-FASE0.md), así que toda búsqueda
 * real pasa por el servidor, que respeta las reglas del NCBI (docs/v2/BLAST.md).
 *
 * Máquina de estados: inactivo → enviando → en-cola → ejecutando → completado | fallido | cancelado,
 * y no-disponible si no hay servidor o no responde. La consulta de estado al proxy se hace cada ≥ 60 s.
 */
import { defaultServerUrl } from './api';

export type BlastProgram = 'blastn' | 'blastp' | 'blastx' | 'tblastn';
export type SeqKind = 'nucleotide' | 'protein';
export type BlastJobState = 'en-cola' | 'ejecutando' | 'completado' | 'fallido' | 'cancelado';
export type BlastClientState = 'inactivo' | 'enviando' | BlastJobState | 'no-disponible';

export const POLL_INTERVAL_MS = 60_000;

export const PROGRAM_INFO: Record<BlastProgram, { query: SeqKind; db: SeqKind; label: string }> = {
  blastn: { query: 'nucleotide', db: 'nucleotide', label: 'blastn: nucleótidos contra nucleótidos' },
  blastp: { query: 'protein', db: 'protein', label: 'blastp: proteína contra proteínas' },
  blastx: { query: 'nucleotide', db: 'protein', label: 'blastx: nucleótidos traducidos contra proteínas' },
  tblastn: { query: 'protein', db: 'nucleotide', label: 'tblastn: proteína contra nucleótidos traducidos' },
};

/** Debe coincidir con DATABASES de server/blast.mjs (lo comprueba tests/unit/blastClient.test.ts). */
export const DATABASE_INFO: Record<string, { type: SeqKind; label: string }> = {
  core_nt: { type: 'nucleotide', label: 'Core nucleotide database (core_nt)' },
  refseq_select_rna: { type: 'nucleotide', label: 'RefSeq Select RNA sequences (refseq_select)' },
  refseq_rna: { type: 'nucleotide', label: 'Reference RNA sequences (refseq_rna)' },
  swissprot: { type: 'protein', label: 'UniProtKB/Swiss-Prot (swissprot)' },
  refseq_select_prot: { type: 'protein', label: 'RefSeq Select proteins (refseq_select)' },
  refseq_protein: { type: 'protein', label: 'Reference proteins (refseq_protein)' },
};

export const STATE_LABEL: Record<BlastClientState, string> = {
  inactivo: 'Sin búsqueda',
  enviando: 'Enviando al servidor',
  'en-cola': 'En cola',
  ejecutando: 'Ejecutando en el NCBI',
  completado: 'Completado',
  fallido: 'Fallido',
  cancelado: 'Cancelado',
  'no-disponible': 'Servicio no disponible',
};

export interface BlastAlignment {
  alignLength: number; identities: number; gaps: number;
  queryFrom: number; queryTo: number; hitFrom: number; hitTo: number;
  queryStrand: string | null; hitStrand: string | null;
  qseq: string; midline: string; hseq: string;
}
export interface BlastHit {
  num: number; accession: string; accessionVersion: string | null; description: string; organism: string | null; taxid: number | null;
  subjectLength: number | null; identityPct: number | null; coveragePct: number | null;
  bitScore: number | null; score: number | null; evalue: number | null; hspCount: number;
  alignment: BlastAlignment | null; url: string | null;
}
export interface BlastResult {
  program: string | null; version: string | null; reference: string | null; database: string | null;
  queryTitle: string | null; queryLength: number; dbSequences: number | null; dbLetters: number | null;
  expect: number | null; message: string | null; hits: BlastHit[]; retrievedAt?: number;
}
export interface BlastJob {
  id: string; state: BlastJobState; rid: string | null; program: BlastProgram; database: string;
  queryLength: number; hitlistSize: number; expect: number; createdAt: number; submittedAt: number | null;
  finishedAt: number | null; updatedAt: number; nextCheckAt: number | null; queuePosition: number | null;
  error: string | null; result: BlastResult | null; cached: boolean;
}
export interface BlastRequest { program: BlastProgram; database: string; query: string; hitlistSize?: number; expect?: number; }
export interface BlastSnapshot { state: BlastClientState; job: BlastJob | null; message: string | null; }

// ---------------------------------------------------------------- utilidades de secuencia

/** Quita encabezado FASTA, espacios y números; devuelve mayúsculas. */
export function cleanSequence(raw: string): string {
  return raw.replace(/\r/g, '').split('\n').filter((l) => !l.trim().startsWith('>')).join('').replace(/[\s\d]/g, '').toUpperCase();
}

/** Tipo probable de una secuencia limpia (solo A, C, G, T, U, N → nucleótidos). */
export function guessKind(seq: string): SeqKind | null {
  if (!seq) return null;
  if (/^[ACGTUN]+$/.test(seq)) return 'nucleotide';
  if (/^[ACDEFGHIKLMNPQRSTVWYBZXUOJ*]+$/.test(seq)) return 'protein';
  return null;
}

export function databasesFor(program: BlastProgram): string[] {
  return Object.keys(DATABASE_INFO).filter((d) => DATABASE_INFO[d].type === PROGRAM_INFO[program].db);
}

/**
 * Enlace al formulario web oficial de BLAST. PROGRAM y PAGE_TYPE=BlastSearch aparecen en los enlaces de la página
 * de inicio del NCBI. QUERY no está documentado para el formulario web: se observó el 2026-10-18 que rellena el
 * cuadro de la consulta, pero puede dejar de hacerlo; por eso el panel ofrece además «Copiar secuencia».
 */
export function ncbiBlastFormUrl(program: BlastProgram, query?: string): string {
  const p = new URLSearchParams({ PROGRAM: program, PAGE_TYPE: 'BlastSearch', LINK_LOC: 'blasthome' });
  if (query && query.length <= 1500) p.set('QUERY', query);
  return `https://blast.ncbi.nlm.nih.gov/Blast.cgi?${p}`;
}

/** Página del registro original en el NCBI (Nucleotide o Protein). */
export function ncbiRecordUrl(accession: string, type: SeqKind): string {
  return `https://www.ncbi.nlm.nih.gov/${type === 'protein' ? 'protein' : 'nuccore'}/${encodeURIComponent(accession)}`;
}

// ---------------------------------------------------------------- cliente HTTP

export class BlastClientError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function call<T>(fetchFn: FetchLike, server: string, method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(server.replace(/\/+$/, '') + path, {
      method, signal, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    throw new BlastClientError(0, 'No se pudo conectar con el servidor.');
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* sin cuerpo JSON */ }
  if (!res.ok) throw new BlastClientError(res.status, (json as { error?: string } | null)?.error ?? `Error ${res.status} del servidor.`);
  return json as T;
}

export interface BlastServiceInfo { available: boolean; reason: string | null; }

/** Comprueba si el servidor configurado ofrece BLAST. Nunca lanza: devuelve available=false con el motivo. */
export async function checkBlastService(server = defaultServerUrl(), fetchFn: FetchLike = fetch): Promise<BlastServiceInfo> {
  if (!server) return { available: false, reason: 'No hay un servidor institucional configurado.' };
  try {
    const info = await call<{ available: boolean; reason: string | null }>(fetchFn, server, 'GET', '/api/blast');
    return { available: !!info.available, reason: info.reason ?? null };
  } catch (e) {
    return { available: false, reason: e instanceof BlastClientError && e.status === 404 ? 'El servidor no tiene el servicio BLAST.' : 'El servidor no responde.' };
  }
}

export interface RunOptions {
  server?: string;
  fetch?: FetchLike;
  onUpdate: (s: BlastSnapshot) => void;
  /** Intervalo de consulta de estado; nunca menor que 60 s. */
  pollIntervalMs?: number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const defaultSleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Cancelado', 'AbortError')); }, { once: true });
});

/** Ejecución de una búsqueda: envía, consulta el estado cada ≥ 60 s y permite cancelar. */
export class BlastRun {
  private ctrl = new AbortController();
  private snapshot: BlastSnapshot = { state: 'inactivo', job: null, message: null };
  readonly done: Promise<BlastSnapshot>;
  private readonly server: string;
  private readonly fetchFn: FetchLike;
  private readonly interval: number;
  private readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;

  constructor(private request: BlastRequest, private opts: RunOptions) {
    this.server = opts.server ?? defaultServerUrl();
    this.fetchFn = opts.fetch ?? ((i, init) => fetch(i, init));
    this.interval = Math.max(POLL_INTERVAL_MS, opts.pollIntervalMs ?? POLL_INTERVAL_MS);
    this.sleep = opts.sleep ?? defaultSleep;
    this.done = this.run();
  }

  get current(): BlastSnapshot { return this.snapshot; }

  private set(s: Partial<BlastSnapshot>) {
    this.snapshot = { ...this.snapshot, ...s };
    this.opts.onUpdate(this.snapshot);
  }

  private fromJob(job: BlastJob) { this.set({ state: job.state, job, message: job.error }); }

  private async run(): Promise<BlastSnapshot> {
    if (!this.server) { this.set({ state: 'no-disponible', message: 'No hay un servidor institucional configurado.' }); return this.snapshot; }
    const signal = this.ctrl.signal;
    try {
      this.set({ state: 'enviando', message: null });
      const { job } = await call<{ job: BlastJob }>(this.fetchFn, this.server, 'POST', '/api/blast', this.request, signal);
      this.fromJob(job);
      let failures = 0;
      while (this.snapshot.state === 'en-cola' || this.snapshot.state === 'ejecutando') {
        await this.sleep(this.interval, signal);
        try {
          const r = await call<{ job: BlastJob }>(this.fetchFn, this.server, 'GET', `/api/blast/${this.snapshot.job!.id}`, undefined, signal);
          failures = 0;
          this.fromJob(r.job);
        } catch (e) {
          if ((e as { name?: string })?.name === 'AbortError') throw e;
          if (e instanceof BlastClientError && e.status === 404) { this.set({ state: 'fallido', message: e.message }); break; }
          if (++failures > 2) { this.set({ state: 'no-disponible', message: 'Se perdió la conexión con el servidor.' }); break; }
        }
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') {
        this.set({ state: 'cancelado', message: 'Búsqueda cancelada.' });
      } else if (e instanceof BlastClientError) {
        const down = e.status === 0 || e.status === 404 || e.status === 503 || e.status >= 500;
        this.set({ state: down ? 'no-disponible' : 'fallido', message: e.message });
      } else {
        this.set({ state: 'fallido', message: 'Error inesperado.' });
      }
    }
    return this.snapshot;
  }

  /** Cancela: deja de consultar y avisa al servidor (que deja la búsqueda como cancelada). */
  cancel() {
    const job = this.snapshot.job;
    const active = this.snapshot.state === 'en-cola' || this.snapshot.state === 'ejecutando' || this.snapshot.state === 'enviando';
    if (!active) return;
    this.ctrl.abort();
    if (job) void call(this.fetchFn, this.server, 'DELETE', `/api/blast/${job.id}`).catch(() => undefined);
  }
}

/** Ordena aciertos por una columna (copia nueva). */
export type HitSortKey = 'num' | 'identityPct' | 'coveragePct' | 'bitScore' | 'evalue' | 'accession';
export function sortHits(hits: BlastHit[], key: HitSortKey, dir: 'asc' | 'desc'): BlastHit[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...hits].sort((a, b) => {
    const x = a[key], y = b[key];
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    if (typeof x === 'string' && typeof y === 'string') return sign * x.localeCompare(y);
    return sign * ((x as number) - (y as number));
  });
}

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { flag } from '../lib/flags';
import { defaultServerUrl } from '../lib/api';
import {
  BlastRun, DATABASE_INFO, PROGRAM_INFO, STATE_LABEL, checkBlastService, cleanSequence, databasesFor, guessKind,
  ncbiBlastFormUrl, sortHits, type BlastClientState, type BlastHit, type BlastJob, type BlastProgram, type BlastResult,
  type HitSortKey, type SeqKind,
} from '../lib/blast';
import { Notice, Select } from './ui';
import { StatusChip } from './Provenance';

/** Indicador de característica del panel. Debe declararse en FLAG_DEFAULTS (src/lib/flags.ts). */
export const BLAST_FLAG = 'blast';

export interface BlastPanelProps {
  /** Secuencia inicial (texto o FASTA). El estudiante puede editarla. */
  sequence?: string;
  /** Tipo de la secuencia; si se omite se estima con el alfabeto. */
  kind?: SeqKind;
  /** Programa inicial; por defecto blastn para nucleótidos y blastp para proteínas. */
  program?: BlastProgram;
  /** Servidor institucional; por defecto el guardado en Panel docente → Servidor o VITE_API_URL. */
  server?: string;
}

/** Resultado grabado de referencia (generado desde tests/fixtures/blast con el mismo analizador; docs/v2/BLAST.md). */
interface RecordedReference {
  recordedAt: string; rid: string; program: BlastProgram; database: string; databaseTitle: string | null;
  databasePostedDate: string | null; query: string; queryLabel: string; result: BlastResult;
}

const NCBI_POLICIES = 'https://www.ncbi.nlm.nih.gov/home/about/policies/';
const fmtE = (e: number | null) => (e === null ? '—' : e === 0 ? '0' : e < 0.001 ? e.toExponential(1) : String(Number(e.toPrecision(3))));
const fmtPct = (x: number | null) => (x === null ? '—' : `${x.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`);
const fmtDate = (t: number | string | null | undefined) => (t ? new Date(t).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : '—');

export function BlastPanel(props: BlastPanelProps) {
  if (!flag(BLAST_FLAG)) return null;
  return <BlastPanelInner {...props} />;
}

function BlastPanelInner({ sequence = '', kind, program: initialProgram, server: serverProp }: BlastPanelProps) {
  const server = serverProp ?? defaultServerUrl();
  const seqId = useId();
  const [raw, setRaw] = useState(sequence);
  const clean = useMemo(() => cleanSequence(raw), [raw]);
  const seqKind: SeqKind | null = kind ?? guessKind(clean);
  const programs = (Object.keys(PROGRAM_INFO) as BlastProgram[]).filter((p) => !seqKind || PROGRAM_INFO[p].query === seqKind);
  const [program, setProgram] = useState<BlastProgram>(initialProgram ?? (seqKind === 'protein' ? 'blastp' : 'blastn'));
  const effProgram = programs.includes(program) ? program : programs[0] ?? 'blastn';
  const dbs = databasesFor(effProgram);
  const [database, setDatabase] = useState<string>(dbs[0]);
  const effDb = dbs.includes(database) ? database : dbs[0];
  const [hitlist, setHitlist] = useState('20');

  const [service, setService] = useState<{ checked: boolean; available: boolean; reason: string | null }>({ checked: false, available: false, reason: null });
  const [state, setState] = useState<BlastClientState>('inactivo');
  const [job, setJob] = useState<BlastJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const runRef = useRef<BlastRun | null>(null);
  const [recorded, setRecorded] = useState<RecordedReference | null>(null);

  useEffect(() => {
    let alive = true;
    void checkBlastService(server).then((r) => { if (alive) setService({ checked: true, ...r }); });
    return () => { alive = false; runRef.current?.cancel(); };
  }, [server]);

  const busy = state === 'enviando' || state === 'en-cola' || state === 'ejecutando';
  const unavailable = service.checked && (!service.available || state === 'no-disponible');
  const seqError = !clean ? 'Escribe o pega una secuencia.' : !seqKind ? 'La secuencia tiene caracteres que no son de ADN, ARN ni proteína.' : clean.length < 15 ? 'La secuencia debe tener al menos 15 residuos.' : clean.length > 1000 ? 'El servidor acepta hasta 1000 residuos.' : null;

  function start() {
    if (seqError || busy) return;
    setJob(null); setMessage(null);
    runRef.current = new BlastRun({ program: effProgram, database: effDb, query: clean, hitlistSize: Number(hitlist) }, {
      server,
      onUpdate: (s) => { setState(s.state); setJob(s.job); setMessage(s.message); },
    });
  }

  async function loadRecorded() {
    // Carga diferida: el archivo solo se descarga si el estudiante lo pide.
    const mod = await import('../data/blast/registro-hbb-refseq_select_rna.json');
    setRecorded(mod.default as unknown as RecordedReference);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(clean); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  }

  return (
    <section className="card" aria-labelledby={`${seqId}-t`}>
      <h3 id={`${seqId}-t`}>Búsqueda BLAST en el NCBI</h3>
      <p className="small muted">
        Compara la secuencia con una base de datos pública del NCBI. La búsqueda se ejecuta de verdad en los servidores
        del NCBI a través del servidor institucional, y puede tardar varios minutos.
      </p>

      <div className="field">
        <label htmlFor={seqId}>Secuencia (texto o FASTA)</label>
        <textarea id={seqId} rows={5} value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false}
          aria-describedby={`${seqId}-h`} aria-invalid={!!seqError && raw.length > 0} style={{ fontFamily: 'var(--font-mono, monospace)', width: '100%' }} />
        <span className="hint" id={`${seqId}-h`}>
          {clean.length} residuos{seqKind ? ` · ${seqKind === 'protein' ? 'proteína' : 'nucleótidos'}` : ''}{seqError && raw ? ` · ${seqError}` : ''}
        </span>
      </div>

      <div className="btn-row" style={{ alignItems: 'flex-end' }}>
        <Select label="Programa" value={effProgram} onChange={(v) => setProgram(v as BlastProgram)}
          options={programs.map((p) => ({ value: p, label: PROGRAM_INFO[p].label }))} />
        <Select label="Base de datos" value={effDb} onChange={setDatabase}
          options={dbs.map((d) => ({ value: d, label: DATABASE_INFO[d].label }))} />
        <Select label="Máximo de resultados" value={hitlist} onChange={setHitlist}
          options={['10', '20', '50'].map((n) => ({ value: n, label: n }))} />
      </div>

      {!service.checked && <p className="small" role="status">Comprobando el servicio…</p>}

      {service.checked && !unavailable && (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn primary" onClick={start} disabled={!!seqError || busy}>Buscar en el NCBI</button>
          {busy && <button type="button" className="btn" onClick={() => runRef.current?.cancel()}>Cancelar</button>}
        </div>
      )}

      {state !== 'inactivo' && state !== 'no-disponible' && (
        <div style={{ marginTop: 12 }}>
          <p role="status" aria-live="polite">
            <strong>Estado: {STATE_LABEL[state]}</strong>
            {job?.queuePosition ? ` · posición ${job.queuePosition} en la cola` : ''}
            {job?.rid ? ` · RID ${job.rid}` : ''}
            {job?.cached && state === 'completado' ? ' · resultado guardado de una búsqueda idéntica reciente' : ''}
          </p>
          {busy && (
            <>
              {/* Indicador indeterminado: el NCBI no informa el avance real. */}
              <progress aria-label={STATE_LABEL[state]} style={{ width: '100%' }} />
              <p className="small muted">El estado se consulta cada minuto, como exige el NCBI. No cierres esta página.</p>
            </>
          )}
          {message && (state === 'fallido' || state === 'cancelado') && <Notice kind={state === 'fallido' ? 'bad' : 'info'}>{message}</Notice>}
        </div>
      )}

      {unavailable && (
        <div style={{ marginTop: 12 }}>
          <Notice kind="warn">
            <strong>Servicio no disponible.</strong> {message ?? service.reason ?? ''} No se muestran resultados en vivo.
          </Notice>
          <p className="small">Alternativa: hacer la búsqueda en el formulario oficial del NCBI.</p>
          <div className="btn-row">
            <a className="btn" href={ncbiBlastFormUrl(effProgram, clean || undefined)} target="_blank" rel="noopener noreferrer">
              Abrir BLAST del NCBI (nueva pestaña)
            </a>
            <button type="button" className="btn" onClick={copy} disabled={!clean}>{copied ? 'Secuencia copiada' : 'Copiar secuencia'}</button>
            {!recorded && <button type="button" className="btn ghost" onClick={() => void loadRecorded()}>Ver un resultado grabado de ejemplo</button>}
          </div>
          <p className="small muted">Si el formulario se abre vacío, pega la secuencia copiada y elige la base de datos {effDb}.</p>
        </div>
      )}

      {state === 'completado' && job?.result && <BlastResultView result={job.result} rid={job.rid} program={job.program} />}

      {recorded && (
        <div style={{ marginTop: 16 }}>
          <Notice kind="info">
            <strong>Resultado grabado el {fmtDate(recorded.recordedAt)} (no es una búsqueda en vivo).</strong>{' '}
            Consulta: {recorded.queryLabel} ({recorded.query.length} nt); programa {recorded.program}; base {recorded.database}.
            No corresponde a la secuencia escrita arriba.
          </Notice>
          <BlastResultView result={recorded.result} rid={recorded.rid} program={recorded.program} postedDate={recorded.databasePostedDate} dbTitle={recorded.databaseTitle} />
        </div>
      )}

      <p className="small muted" style={{ marginTop: 12 }}>
        Fuente: NCBI BLAST (National Center for Biotechnology Information, EE. UU.).{' '}
        <a href={NCBI_POLICIES} target="_blank" rel="noopener noreferrer">Políticas, aviso legal y derechos de autor del NCBI</a>.
      </p>
    </section>
  );
}

const COLS: { key: HitSortKey; label: string }[] = [
  { key: 'num', label: '#' },
  { key: 'accession', label: 'Accesión' },
  { key: 'identityPct', label: 'Identidad' },
  { key: 'coveragePct', label: 'Cobertura' },
  { key: 'bitScore', label: 'Puntuación (bits)' },
  { key: 'evalue', label: 'Valor E' },
];

export function BlastResultView({ result, rid, program, postedDate, dbTitle }: { result: BlastResult; rid: string | null; program: string; postedDate?: string | null; dbTitle?: string | null }) {
  const [sort, setSort] = useState<{ key: HitSortKey; dir: 'asc' | 'desc' }>({ key: 'num', dir: 'asc' });
  const rows = useMemo(() => sortHits(result.hits, sort.key, sort.dir), [result.hits, sort]);
  const toggle = (key: HitSortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'evalue' || key === 'num' || key === 'accession' ? 'asc' : 'desc' }));

  return (
    <div style={{ marginTop: 12 }}>
      <div className="btn-row small">
        <StatusChip status="prediccion" prefix="Similitud calculada por BLAST" />
      </div>
      <dl className="small" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
        <dt>Programa</dt><dd>{result.program ?? program}{result.version ? ` (${result.version})` : ''}</dd>
        <dt>Base de datos</dt><dd>{dbTitle ?? result.database ?? '—'}{result.dbSequences !== null ? ` · ${result.dbSequences.toLocaleString('es-CO')} secuencias` : ''}{postedDate ? ` · publicada: ${postedDate}` : ''}</dd>
        <dt>RID</dt><dd>{rid ?? '—'}</dd>
        <dt>Obtenido</dt><dd>{fmtDate(result.retrievedAt)}</dd>
      </dl>
      <Notice kind="warn">
        <ul className="list">
          <li>El resultado depende de la base de datos elegida y de la fecha: las bases del NCBI cambian con el tiempo.</li>
          <li>Una identidad alta no implica que la función sea idéntica.</li>
          <li>Anota la fecha, la base de datos y su versión (o fecha de publicación) y el RID en tu informe.</li>
        </ul>
      </Notice>
      {rows.length === 0 ? (
        <p>{result.message ?? 'BLAST no encontró secuencias similares con estos parámetros.'}</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table>
            <caption className="small" style={{ textAlign: 'left', padding: 6 }}>Aciertos de BLAST ({rows.length}). Pulsa un encabezado para ordenar.</caption>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="btn ghost small" onClick={() => toggle(c.key)}>
                      {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  </th>
                ))}
                <th scope="col">Descripción y alineamiento</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => <HitRow key={`${h.num}-${h.accession}`} h={h} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HitRow({ h }: { h: BlastHit }) {
  return (
    <tr>
      <td>{h.num}</td>
      <td>{h.url ? <a href={h.url} target="_blank" rel="noopener noreferrer">{h.accessionVersion ?? h.accession}</a> : h.accessionVersion ?? h.accession}</td>
      <td>{fmtPct(h.identityPct)}</td>
      <td>{fmtPct(h.coveragePct)}</td>
      <td>{h.bitScore ?? '—'}</td>
      <td>{fmtE(h.evalue)}</td>
      <td>
        <span>{h.description}</span>
        {h.alignment && (
          <details>
            <summary className="small">Alineamiento ({h.alignment.identities}/{h.alignment.alignLength} idénticos, {h.alignment.gaps} huecos)</summary>
            <pre className="small" style={{ overflowX: 'auto' }} aria-label="Alineamiento: consulta, coincidencias y secuencia encontrada">
{`Consulta ${String(h.alignment.queryFrom).padStart(5)} ${h.alignment.qseq} ${h.alignment.queryTo}
               ${h.alignment.midline}
Sujeto   ${String(h.alignment.hitFrom).padStart(5)} ${h.alignment.hseq} ${h.alignment.hitTo}`}
            </pre>
          </details>
        )}
      </td>
    </tr>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { defaultServerUrl } from '../lib/api';
import { joinCourse, leaveCourse, SYNC_TEXT, syncNow, useClassroom, type JoinResult, type SyncState } from '../lib/classroom';
import { href } from '../lib/router';
import { ConfirmButton } from './ui';
import { Icon } from './icons';

const BUILD_SERVER = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function timeAgo(ts: number | null, now = Date.now()): string {
  if (!ts) return 'aún no';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const STATE_TONE: Record<SyncState, 'ok' | 'warn' | 'bad' | 'info'> = {
  inactivo: 'info', pendiente: 'info', enviando: 'info', sincronizado: 'ok', 'sin-conexion': 'warn', error: 'bad',
};

/** Aviso de privacidad: qué se envía y quién lo ve. */
export function PrivacyNote() {
  return (
    <div className="privacy-note small">
      <Icon name="escudo" size={18} />
      <p>
        <strong>Qué se envía y a quién.</strong> Al unirte, el servidor de tu colegio guarda tu nombre, el código del curso y el avance de cada práctica
        (etapas, ensayos, hipótesis, conclusión, respuestas, puntaje y tiempo aproximado). Solo lo ve el docente de tu curso. Tu PIN se guarda cifrado.
        Puedes salir cuando quieras; para borrar tus datos, pídeselo a tu docente.
      </p>
    </div>
  );
}

/** Estado de sincronización (texto visible y anunciado por lectores de pantalla). */
export function SyncChip({ withCourse = false }: { withCourse?: boolean }) {
  const { enrollment, status } = useClassroom();
  if (!enrollment) return null;
  const tone = STATE_TONE[status.state];
  return (
    <span className={`sync-chip ${tone}`} role="status" title={status.message || undefined}>
      <span className="sync-dot" aria-hidden="true" />
      {SYNC_TEXT[status.state]}{withCourse ? ` · ${enrollment.course.name}` : ''}
    </span>
  );
}

/** Frase al pie de la práctica cuando el estudiante está unido a un curso. */
export function CourseNote() {
  const { enrollment, status } = useClassroom();
  if (!enrollment) return null;
  return (
    <p className="small muted no-print">
      Tu avance también se envía a tu docente del curso «{enrollment.course.name}» (última sincronización: {timeAgo(status.lastSyncAt)}).
      {status.state === 'error' && status.message ? ` ${status.message}` : ''}
    </p>
  );
}

/** Formulario para unirse a un curso con código + nombre + PIN (encabezado y página /#/unirme). */
export function JoinForm({ initialCode = '', initialServer = '', onJoined }: { initialCode?: string; initialServer?: string; onJoined?: (r: JoinResult) => void }) {
  const id = useId();
  const [server, setServer] = useState(() => initialServer || defaultServerUrl() || BUILD_SERVER);
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0, 6));
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!server.trim()) { setError('Escribe la dirección del servidor de tu colegio.'); return; }
    if (!/^[A-Za-z0-9]{6}$/.test(code.trim())) { setError('El código del curso tiene 6 caracteres (letras y números).'); return; }
    if (name.trim().length < 3) { setError('Escribe tu nombre y apellido (o el alias que acordaste con tu docente).'); return; }
    if (!/^\d{4}$/.test(pin)) { setError('El PIN debe tener exactamente 4 dígitos.'); return; }
    setBusy(true); setError('');
    try {
      const r = await joinCourse(server, code, name, pin);
      setPin('');
      onJoined?.(r);
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  };
  return (
    <form className="stack-sm join-form" onSubmit={submit} noValidate>
      {!BUILD_SERVER && (
        <div className="field">
          <label htmlFor={`${id}-srv`}>Servidor del colegio</label>
          <input id={`${id}-srv`} type="url" inputMode="url" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://laboratorio.micolegio.edu.co" autoComplete="url" />
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-code`}>Código de tu curso</label>
        <input id={`${id}-code`} type="text" className="code-input" value={code} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC123" aria-describedby={`${id}-code-h`} />
        <span className="hint" id={`${id}-code-h`}>Te lo da tu docente: 6 letras y números.</span>
      </div>
      <div className="field">
        <label htmlFor={`${id}-name`}>Tu nombre y apellido</label>
        <input id={`${id}-name`} type="text" value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} aria-describedby={`${id}-name-h`} />
        <span className="hint" id={`${id}-name-h`}>O el alias que acordaste con tu docente. Escríbelo igual cada vez.</span>
      </div>
      <div className="field">
        <label htmlFor={`${id}-pin`}>PIN de 4 dígitos</label>
        <input id={`${id}-pin`} type="password" className="pin-input" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-describedby={`${id}-pin-h`} />
        <span className="hint" id={`${id}-pin-h`}>Invéntalo y recuérdalo: con tu nombre y este PIN vuelves a entrar desde otro equipo.</span>
      </div>
      {error && <p className="notice bad" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Conectando…' : 'Unirme al curso'}</button>
      </div>
      <PrivacyNote />
    </form>
  );
}

/** Panel del estudiante ya unido: curso, estado de sincronización y salida. */
function JoinedPanel({ onLeft, result }: { onLeft?: () => void; result?: JoinResult | null }) {
  const { enrollment, status } = useClassroom();
  if (!enrollment) return null;
  return (
    <div className="stack">
      {result && (
        <p className="notice ok" role="status">
          {result.created ? '¡Listo! Te uniste al curso.' : '¡Bienvenido de nuevo!'}
          {result.restored > 0 ? ` Se recuperó tu avance de ${result.restored} ${result.restored === 1 ? 'práctica' : 'prácticas'}.` : ''}
          {result.uploaded > 0 ? ` Se enviará el avance de ${result.uploaded} ${result.uploaded === 1 ? 'práctica' : 'prácticas'} de este equipo.` : ''}
        </p>
      )}
      <div className="joined-card">
        <span className="avatar" aria-hidden="true">{initials(enrollment.student.name)}</span>
        <div>
          <div className="joined-name">{enrollment.student.name}</div>
          <div className="small muted">Curso <strong>{enrollment.course.name}</strong> · código <span className="mono">{enrollment.course.joinCode}</span></div>
        </div>
      </div>
      <div className="stack-sm">
        <div className="btn-row"><SyncChip /><span className="small muted">Última sincronización: {timeAgo(status.lastSyncAt)}{status.pending ? ` · ${status.pending} pendiente${status.pending === 1 ? '' : 's'}` : ''}</span></div>
        {status.message && <p className="small" style={{ margin: 0 }}>{status.message}</p>}
        <p className="small muted" style={{ margin: 0 }}>Tu avance se envía solo mientras trabajas en las prácticas. Si no hay internet, se guarda en este equipo y se envía cuando vuelva la conexión.</p>
      </div>
      <div className="btn-row">
        <button type="button" className="btn small" onClick={syncNow}><Icon name="reiniciar" size={16} />Sincronizar ahora</button>
        <ConfirmButton label="Salir del curso" confirmLabel="¿Salir del curso en este equipo? Tu avance queda guardado." onConfirm={() => { void leaveCourse(); onLeft?.(); }} />
      </div>
      <PrivacyNote />
    </div>
  );
}

/** Botón del encabezado: «Unirme a mi curso» o la insignia con curso y nombre. Abre un diálogo modal. */
export function CourseButton() {
  const { enrollment, status } = useClassroom();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<JoinResult | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } }
    if (!open && d.open) d.close();
  }, [open]);
  const label = enrollment
    ? `${enrollment.student.name}, ${enrollment.course.name}: mi curso (${SYNC_TEXT[status.state].toLowerCase()})`
    : 'Unirme a mi curso';
  return (
    <>
      <button type="button" className={`course-btn${enrollment ? ' joined' : ''}`} aria-haspopup="dialog" aria-label={label} onClick={() => { setResult(null); setOpen(true); }}>
        {enrollment ? (
          <>
            <span className="avatar small" aria-hidden="true">{initials(enrollment.student.name)}<span className={`sync-dot ${STATE_TONE[status.state]}`} /></span>
            <span className="course-btn-text" aria-hidden="true"><strong>{enrollment.student.name}</strong><small>{enrollment.course.name}</small></span>
          </>
        ) : (
          <><Icon name="grado" size={18} /><span className="course-btn-text" aria-hidden="true">Unirme a mi curso</span></>
        )}
      </button>
      <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        {open && (
          <div className="dialog-body stack">
            <div className="dialog-head">
              <h2 id={titleId}>{enrollment ? 'Mi curso' : 'Unirme a mi curso'}</h2>
              <button type="button" className="btn small ghost" onClick={() => setOpen(false)} aria-label="Cerrar"><Icon name="cerrar" size={18} /></button>
            </div>
            {enrollment
              ? <JoinedPanel result={result} onLeft={() => setResult(null)} />
              : (
                <>
                  <p className="small muted" style={{ margin: 0 }}>Únete con el código que te dio tu docente. Así podrá acompañar tu proceso: verá tu avance, tus datos y tus respuestas en cada práctica.</p>
                  <JoinForm onJoined={setResult} />
                </>
              )}
          </div>
        )}
      </dialog>
    </>
  );
}

/** Página /#/unirme?codigo=ABC123&servidor=https://… (enlace que comparte el docente). */
export function JoinPage({ code, server }: { code?: string; server?: string }) {
  const { enrollment } = useClassroom();
  const [result, setResult] = useState<JoinResult | null>(null);
  useEffect(() => { document.title = 'Unirme a mi curso · Laboratorio Virtual'; }, []);
  return (
    <div className="stack join-page">
      <h1>Unirme a mi curso</h1>
      <div className="card stack">
        {enrollment ? (
          <>
            <JoinedPanel result={result} />
            <div className="btn-row"><a className="btn primary" href={href('catalogo')}>Ir a las prácticas</a></div>
          </>
        ) : <JoinForm initialCode={code} initialServer={server} onJoined={setResult} />}
      </div>
    </div>
  );
}

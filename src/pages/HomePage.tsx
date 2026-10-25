import { lazy, Suspense, useEffect, useState } from 'react';
import { CATALOG as PRACTICES, metaById as practiceById } from '../curriculum/catalog';
import { AREA_LABEL, GRADES } from '../curriculum/grades';
import type { Area } from '../core/types';
import { href } from '../lib/router';
import { recentPractices, storedProgress } from '../lib/progress';
import { onTabListKeyDown } from '../lib/a11y';
import { decodeCode, type Decoded } from '../lib/codes';
import { loadJSON, saveJSON } from '../lib/storage';
import { PracticeCard } from '../components/PracticeCard';
import { Notice } from '../components/ui';
import { InstallButton } from '../components/PwaUi';
import { AREA_ICON, Icon, type IconName } from '../components/icons';

// La escena ilustrada del héroe usa el kit de instrumentos (34 kB): se descarga después del primer pintado.
const HeroScene = lazy(() => import('./HeroScene'));

const AREAS = Object.keys(AREA_LABEL) as Area[];
const CODES_KEY = 'lvcn:codigos-recibidos';

const AREA_BLURB: Record<Area, string> = {
  biologia: 'Células, herencia, evolución y metabolismo',
  quimica: 'Mezclas, soluciones, reacciones y equilibrio',
  fisica: 'Medición, ondas, fuerzas, energía y circuitos',
  ambiental: 'Ecosistemas, ciclos de la materia y poblaciones',
};

/**
 * Motivo científico decorativo del héroe: un átomo con tres órbitas (los electrones con los colores de las áreas),
 * una molécula hexagonal y una onda. Solo SVG y CSS; se anima en giro lento y se detiene con «reducir movimiento».
 */
function HeroBackdrop() {
  const orbits = [0, 60, 120];
  const electrons = ['var(--fis)', 'var(--qui)', 'var(--bio)'];
  const hex = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; return [Math.round(Math.cos(a) * 34 * 10) / 10, Math.round(Math.sin(a) * 34 * 10) / 10]; });
  return (
    <div className="hero-backdrop" aria-hidden="true">
      <svg className="hero-atom" viewBox="0 0 520 520" focusable="false">
        <defs>
          <radialGradient id="hero-nucleus" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="var(--hero-nucleus-hi)" />
            <stop offset="1" stopColor="var(--accent)" />
          </radialGradient>
          <radialGradient id="hero-halo" r="0.5">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="260" cy="260" r="200" fill="url(#hero-halo)" />
        <g className="hero-atom-spin">
          {orbits.map((r, i) => (
            <g key={r} transform={`rotate(${r} 260 260)`}>
              <ellipse cx="260" cy="260" rx="230" ry="84" className="hero-orbit" />
              <ellipse cx="260" cy="260" rx="230" ry="84" className="hero-orbit-flow" style={{ animationDelay: `${-i * 2.2}s` }} />
              <circle cx={30} cy="260" r="7" fill={electrons[i]} className="hero-electron" />
            </g>
          ))}
        </g>
        <circle cx="260" cy="260" r="22" fill="url(#hero-nucleus)" />
        <circle cx="253" cy="252" r="6" fill="#ffffff" fillOpacity="0.35" />
      </svg>
      <svg className="hero-molecule" viewBox="-60 -60 120 120" focusable="false">
        <polygon points={hex.map((p) => p.join(',')).join(' ')} className="hero-mol-ring" />
        <polygon points={hex.map(([x, y]) => `${x * 0.72},${y * 0.72}`).join(' ')} className="hero-mol-inner" />
        {hex.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 4 : 5.5} className={i % 2 ? 'hero-mol-h' : 'hero-mol-c'} />)}
      </svg>
      <svg className="hero-wave" viewBox="0 0 400 60" preserveAspectRatio="none" focusable="false">
        <path d="M0 30 C 25 5, 50 5, 75 30 S 125 55, 150 30 S 200 5, 225 30 S 275 55, 300 30 S 350 5, 375 30 S 400 42, 400 42" />
      </svg>
    </div>
  );
}

function CodeEntry() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<Decoded[]>(() => loadJSON<Decoded[]>(CODES_KEY, []));
  useEffect(() => { saveJSON(CODES_KEY, received); }, [received]);
  const submit = () => {
    try {
      const d = decodeCode(code);
      setReceived((r) => [d, ...r.filter((x) => x.value.id !== d.value.id)]);
      setCode(''); setError(null);
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <section className="card feature-card stack-sm" aria-labelledby="code-h">
      <div className="feature-head">
        <span className="feature-icon"><Icon name="codigo" size={22} /></span>
        <div>
          <h2 id="code-h">Tengo un código de mi docente</h2>
          <p className="small muted">Pega el código de asignación o de lista que te compartió tu docente.</p>
        </div>
      </div>
      <div className="btn-row">
        <label htmlFor="code-in" className="sr-only">Código de asignación o lista</label>
        <input id="code-in" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="LVCN-A:…" style={{ flex: '1 1 220px', fontFamily: 'var(--font-data)' }} aria-invalid={error ? true : undefined} aria-describedby={error ? 'code-err' : undefined} />
        <button type="button" className="btn primary" onClick={submit} disabled={!code.trim()}>Abrir</button>
      </div>
      {received.length === 0 && (
        <ul className="code-hints small muted">
          <li><Icon name="informe" size={16} />Una <strong>asignación</strong> abre la práctica con los objetivos y la fecha de entrega.</li>
          <li><Icon name="preparacion" size={16} />Una <strong>lista</strong> reúne varias prácticas de una unidad.</li>
          <li><Icon name="escudo" size={16} />Lo que abras queda guardado solo en este equipo.</li>
        </ul>
      )}
      {error && <p id="code-err" className="small" style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      {received.map((d) => d.kind === 'asignacion' ? (
        <div key={d.value.id} className="notice info stack-sm">
          <strong>Asignación para {d.value.course}{d.value.due ? ` · entrega ${d.value.due}` : ''}</strong>
          <a href={href('practica', d.value.practiceId)}>{practiceById(d.value.practiceId)?.title ?? 'Práctica'}</a>
          {d.value.objectives && <span className="small"><strong>Objetivos:</strong> {d.value.objectives}</span>}
          {d.value.activities && <span className="small"><strong>Actividades:</strong> {d.value.activities}</span>}
          <button type="button" className="btn small ghost" onClick={() => setReceived((r) => r.filter((x) => x.value.id !== d.value.id))}>Quitar</button>
        </div>
      ) : (
        <div key={d.value.id} className="notice info stack-sm">
          <strong>Lista: {d.value.name}{d.value.unit ? ` · ${d.value.unit}` : ''}</strong>
          <ol className="list small">{d.value.practiceIds.map((id) => <li key={id}><a href={href('practica', id)}>{practiceById(id)?.title ?? id}</a></li>)}</ol>
          {d.value.notes && <span className="small">{d.value.notes}</span>}
          <button type="button" className="btn small ghost" onClick={() => setReceived((r) => r.filter((x) => x.value.id !== d.value.id))}>Quitar</button>
        </div>
      ))}
    </section>
  );
}

const STAGES: { icon: IconName; name: string; text: string }[] = [
  { icon: 'preparacion', name: 'Preparación', text: 'Pregunta problema, objetivos, fundamento y variables.' },
  { icon: 'experimento', name: 'Experimento', text: 'Cambias variables, mides con instrumentos y guardas ensayos.' },
  { icon: 'analisis', name: 'Análisis y conclusión', text: 'Gráficas, tendencia de tus datos, control de variables y conclusión con evidencia.' },
  { icon: 'evaluacion', name: 'Evaluación', text: 'Preguntas por competencias con retroalimentación y reintentos.' },
  { icon: 'modelo', name: 'Modelo y referencias', text: 'Ecuaciones, supuestos, límites y fuentes del modelo.' },
];

const MODES: { icon: IconName; name: string; text: string }[] = [
  { icon: 'guiada', name: 'Práctica guiada', text: 'Paso a paso: primero te preparas y guardas ensayos antes de analizar.' },
  { icon: 'libre', name: 'Exploración libre', text: 'Todos los controles abiertos para indagar a tu ritmo.' },
  { icon: 'evaluacion', name: 'Evaluación', text: 'Preguntas tipo Saber 11 con retroalimentación por opción.' },
];

type ProfileId = 'estudiante' | 'docente' | 'investigador';
interface Task { icon: IconName; title: string; text: string; href?: string; onClick?: () => void }
const PROFILE_KEY = 'lvcn:perfil-inicio';

const focusCode = () => { const el = document.getElementById('code-in'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus({ preventScroll: true }); };
const focusGrades = () => { const el = document.getElementById('grados'); el?.scrollIntoView({ behavior: 'smooth' }); el?.focus({ preventScroll: true }); };

function profileTasks(id: ProfileId, recent: ReturnType<typeof recentPractices>): Task[] {
  if (id === 'estudiante') {
    const last = recent[0] && practiceById(recent[0].id);
    return [
      last
        ? { icon: 'continuar', title: 'Continuar mi práctica', text: `${last.title} · ${recent[0].progress} % · ${recent[0].trials} ${recent[0].trials === 1 ? 'ensayo' : 'ensayos'}`, href: href('practica', last.id) }
        : { icon: 'grado', title: 'Empezar por mi grado', text: 'Las prácticas de tu malla curricular, de 6.º a 11.º.', onClick: focusGrades },
      { icon: 'buscar', title: 'Buscar una práctica', text: 'Por tema, instrumento o concepto (tecla /).', href: href('catalogo') },
      { icon: 'codigo', title: 'Usar el código de mi docente', text: 'Asignaciones y listas de una unidad.', onClick: focusCode },
      { icon: 'banco', title: 'Practicar para Saber 11', text: 'Preguntas por competencia con retroalimentación.', href: href('banco') },
    ];
  }
  if (id === 'docente') {
    return [
      { icon: 'informe', title: 'Asignar una práctica', text: 'Crea un código con objetivos y fecha de entrega.', href: `${href('docente')}?seccion=asignaciones` },
      { icon: 'datos', title: 'Recibir y revisar informes', text: 'Importa los archivos de tus estudiantes y exporta notas.', href: `${href('docente')}?seccion=informes` },
      { icon: 'analisis', title: 'Seguir el avance del curso', text: 'Con el servidor del colegio, en tiempo real.', href: `${href('docente')}?seccion=seguimiento` },
      { icon: 'escudo', title: 'Validar la alineación curricular', text: 'Revisa los DBA propuestos práctica por práctica.', href: `${href('docente')}?seccion=validacion` },
    ];
  }
  return [
    { icon: 'lupa', title: 'Prácticas de indagación', text: 'Diseña, mide y analiza con control de variables.', href: `${href('catalogo')}?competencia=indagacion` },
    { icon: 'modelo', title: 'Modelos con supuestos declarados', text: 'Cada práctica muestra sus ecuaciones, límites y fuentes.', href: `${href('practica', 'cinetica-potencial')}` },
    { icon: 'biologia', title: 'Bioinformática y biología de sistemas', text: 'Secuencias, BLAST, proteínas en 3D y metabolismo (FBA).', href: `${href('catalogo')}?q=secuencias proteínas metabolismo` },
    { icon: 'descargar', title: 'Datos reproducibles', text: 'Exporta CSV, JSON y el registro del experimento con su semilla.', href: href('ayuda') },
  ];
}

const PROFILES: { id: ProfileId; label: string; icon: IconName; lead: string }[] = [
  { id: 'estudiante', label: 'Estudiante', icon: 'estudiante', lead: 'Experimenta, registra tus datos y entrega tu informe.' },
  { id: 'docente', label: 'Docente', icon: 'docente', lead: 'Asigna prácticas, recibe informes y sigue el avance del curso.' },
  { id: 'investigador', label: 'Investigador o curioso', icon: 'lupa', lead: 'Explora los modelos, cambia sus supuestos y exporta los datos.' },
];

/** Inicio orientado a tareas: la persona elige su perfil y ve lo que puede hacer ahora. */
function ProfileTasks() {
  const [profile, setProfile] = useState<ProfileId>(() => {
    const v = loadJSON<string>(PROFILE_KEY, 'estudiante');
    return v === 'docente' || v === 'investigador' ? v : 'estudiante';
  });
  const recent = recentPractices(3);
  const tasks = profileTasks(profile, recent);
  const choose = (id: ProfileId) => { setProfile(id); saveJSON(PROFILE_KEY, id); };
  const current = PROFILES.find((x) => x.id === profile)!;
  return (
    <section className="home-section tasks" aria-labelledby="tareas-h">
      <div className="section-head row">
        <div>
          <h2 id="tareas-h">¿Qué quieres hacer hoy?</h2>
          <p className="muted">{current.lead}</p>
        </div>
        <div className="seg profile-switch" role="tablist" aria-label="Perfil" onKeyDown={onTabListKeyDown}>
          {PROFILES.map((x) => (
            <button key={x.id} type="button" role="tab" id={`perfil-${x.id}`} aria-controls="perfil-panel" aria-selected={profile === x.id} tabIndex={profile === x.id ? 0 : -1} onClick={() => choose(x.id)}>
              <Icon name={x.icon} size={17} />{x.label}
            </button>
          ))}
        </div>
      </div>
      <div id="perfil-panel" role="tabpanel" aria-labelledby={`perfil-${profile}`} className="task-grid">
        {tasks.map((t) => {
          const body = (<><span className="task-icon" aria-hidden="true"><Icon name={t.icon} size={22} /></span><span className="task-text"><strong>{t.title}</strong><span className="small muted">{t.text}</span></span><Icon name="flecha" size={18} className="task-go" /></>);
          return t.href
            ? <a key={t.title} className="task" href={t.href}>{body}</a>
            : <button key={t.title} type="button" className="task" onClick={t.onClick}>{body}</button>;
        })}
      </div>
      {profile === 'estudiante' && recent.length > 1 && (
        <div className="recent">
          <h3 className="small eyebrow">También empezaste</h3>
          <ul>
            {recent.slice(1).map((r) => { const m = practiceById(r.id); return m ? <li key={r.id}><a href={href('practica', r.id)}>{m.title}</a><span className="progress-mini" aria-hidden="true"><span style={{ width: `${r.progress}%` }} /></span><span className="small muted">{r.progress} %</span></li> : null; })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Una práctica destacada por grado (la primera de cada grado en el catálogo), para no repetir el catálogo entero. */
const FEATURED = GRADES.map((g) => PRACTICES.find((p) => p.grade === g.id)).filter((p): p is NonNullable<typeof p> => !!p);

export function HomePage() {
  const progress = storedProgress();
  useEffect(() => { document.title = 'Laboratorio Virtual de Ciencias Naturales'; }, []);
  const stats: [string | number, string][] = [
    [PRACTICES.length, 'prácticas interactivas'],
    [GRADES.length, 'grados, de 6.º a 11.º'],
    [3, 'competencias Saber 11'],
    [AREAS.length, 'áreas de las ciencias'],
  ];
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-h">
        <HeroBackdrop />
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><span className="pulse" aria-hidden="true" />Grados 6.º a 11.º · Biología · Química · Física · Ambiente</span>
          <h1 id="hero-h">Laboratorio Virtual de <span className="hero-accent">Ciencias Naturales</span></h1>
          <p className="lead">Cambia variables, mide con instrumentos, grafica y concluye con evidencia. Cada práctica calcula sus resultados con un modelo científico declarado, con sus supuestos y sus límites.</p>
          <div className="btn-row hero-actions">
            <a className="btn primary large" href={href('catalogo')}><Icon name="buscar" size={18} />Explorar prácticas</a>
            <button type="button" className="btn large" onClick={focusGrades}>Elegir mi grado</button>
            <InstallButton className="btn ghost large" />
          </div>
          <dl className="stats">
            {stats.map(([v, k]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
        <div className="hero-figure"><div className="hero-stage"><Suspense fallback={<div className="hero-scene-placeholder" aria-hidden="true" />}><HeroScene /></Suspense></div></div>
      </section>

      <ProfileTasks />

      <section aria-labelledby="grados" className="home-section">
        <div className="section-head">
          <h2 id="grados" tabIndex={-1}>Elige tu grado</h2>
          <p className="muted">Cada grado reúne las prácticas de su malla curricular, alineadas con los estándares y los DBA.</p>
        </div>
        <div className="grade-grid">
          {GRADES.map((g) => {
            const list = PRACTICES.filter((p) => p.grade === g.id);
            const n = list.length;
            const done = list.filter((p) => (progress[p.id] ?? 0) >= 100).length;
            return (
              <a key={g.id} className="grade-tile" href={href('grado', g.id)}>
                <span className="g">{g.id}.º</span>
                <span className="t">{g.name}</span>
                <span className="d">{g.title}</span>
                <span className="grade-mix" aria-hidden="true">
                  {AREAS.map((a) => { const k = list.filter((p) => p.area === a).length; return k ? <i key={a} className={`area-${a}`} style={{ flexGrow: k }} /> : null; })}
                </span>
                <span className="d count">{n} {n === 1 ? 'práctica disponible' : 'prácticas disponibles'}{done > 0 ? ` · ${done} completada${done === 1 ? '' : 's'}` : ''}<Icon name="flecha" size={16} /></span>
              </a>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="areas" className="home-section">
        <div className="section-head">
          <h2 id="areas">Explora por asignatura</h2>
        </div>
        <div className="area-grid">
          {AREAS.map((a) => {
            const n = PRACTICES.filter((p) => p.area === a).length;
            return (
              <a key={a} className={`area-tile area-${a}`} href={`${href('catalogo')}?area=${a}`}>
                <span className="area-icon"><Icon name={AREA_ICON[a]} size={24} /></span>
                <span className="area-text"><span className="area-name">{AREA_LABEL[a]}</span><span className="small muted">{AREA_BLURB[a]}</span></span>
                <span className="area-count">{n}<span className="sr-only"> prácticas</span></span>
              </a>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="destacadas" className="home-section">
        <div className="section-head row">
          <div>
            <h2 id="destacadas">Una práctica para empezar en cada grado</h2>
            <p className="muted">Tu progreso se guarda en este navegador. El catálogo completo tiene {PRACTICES.length} prácticas con búsqueda y filtros.</p>
          </div>
          <a className="btn" href={href('catalogo')}><Icon name="buscar" size={18} />Ver las {PRACTICES.length} prácticas</a>
        </div>
        <div className="practice-grid">
          {FEATURED.map((p) => <PracticeCard key={p.id} p={p} progress={progress[p.id]} />)}
        </div>
      </section>

      <section aria-labelledby="ciclo" className="home-section">
        <div className="section-head">
          <h2 id="ciclo">Así trabajas en cada práctica</h2>
          <p className="muted">El mismo ciclo de indagación en todas las prácticas, como en un laboratorio de verdad.</p>
        </div>
        <ol className="cycle">
          {STAGES.map((s, i) => (
            <li key={s.name}>
              <span className="cycle-icon"><Icon name={s.icon} size={22} /></span>
              <span className="cycle-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <strong>{s.name}</strong>
              <span className="small muted">{s.text}</span>
            </li>
          ))}
        </ol>
        <div className="grid-2">
          <section className="card feature-card stack-sm" aria-labelledby="modos-h">
            <div className="feature-head">
              <span className="feature-icon"><Icon name="competencia" size={22} /></span>
              <div><h2 id="modos-h">Tres modos de trabajo</h2><p className="small muted">Elige el modo al abrir cualquier práctica.</p></div>
            </div>
            <ul className="mode-list">
              {MODES.map((m) => <li key={m.name}><Icon name={m.icon} size={20} /><span><strong>{m.name}.</strong> <span className="muted">{m.text}</span></span></li>)}
            </ul>
          </section>
          <CodeEntry />
        </div>
      </section>

      <Notice>
        <strong>Simulaciones educativas.</strong> Los resultados provienen de modelos simplificados y deterministas (salvo el azar justificado de la herencia genética). No reemplazan el trabajo en un laboratorio real. Las preguntas tipo Saber 11 son originales de esta plataforma y no son preguntas oficiales del ICFES.
      </Notice>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { CATALOG as PRACTICES, metaById as practiceById } from '../curriculum/catalog';
import { AREA_LABEL, GRADES } from '../curriculum/grades';
import type { Area } from '../core/types';
import { href } from '../lib/router';
import { storedProgress } from '../lib/progress';
import { decodeCode, type Decoded } from '../lib/codes';
import { loadJSON, saveJSON } from '../lib/storage';
import { PracticeCard } from '../components/PracticeCard';
import { Notice } from '../components/ui';
import { InstallButton } from '../components/PwaUi';
import { AREA_ICON, Icon, type IconName } from '../components/icons';
import { BenchTop, Beaker, Burette, Cube, DigitalBalance, Erlenmeyer, GraduatedCylinder, TestTube, Thermometer } from '../labs/kit';

const AREAS = Object.keys(AREA_LABEL) as Area[];
const CODES_KEY = 'lvcn:codigos-recibidos';

const AREA_BLURB: Record<Area, string> = {
  biologia: 'Células, herencia, evolución y metabolismo',
  quimica: 'Mezclas, soluciones, reacciones y equilibrio',
  fisica: 'Medición, ondas, fuerzas, energía y circuitos',
  ambiental: 'Ecosistemas, ciclos de la materia y poblaciones',
};

/** Escena de laboratorio de la portada: instrumentos del kit con burbujas y una gota en movimiento suave. */
function HeroScene() {
  const bubbles: [number, number, number][] = [[266, 0, 3.2], [280, 1.1, 2.4], [294, 2.2, 2.8], [272, 3.1, 2], [300, 0.6, 1.8], [286, 2.7, 2.2]];
  return (
    <svg viewBox="0 0 614 340" className="hero-scene" role="img" aria-label="Ilustración: mesa de laboratorio con probeta graduada, bureta sobre un matraz Erlenmeyer, vaso de precipitados con burbujas, termómetro, balanza digital, gradilla con tubos de ensayo y una gráfica de datos.">
      <defs>
        <linearGradient id="hero-screen" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--surface)" /><stop offset="1" stopColor="var(--surface-2)" /></linearGradient>
        <linearGradient id="hero-plot-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient>
      </defs>

      {/* Tarjeta de datos flotante */}
      <g transform="translate(392 22)"><g className="hero-float">
        <rect width="206" height="128" rx="12" fill="url(#hero-screen)" stroke="var(--line)" filter="url(#kit-shadow)" />
        <circle cx="16" cy="16" r="3.5" fill="var(--bad)" /><circle cx="28" cy="16" r="3.5" fill="var(--warn)" /><circle cx="40" cy="16" r="3.5" fill="var(--ok)" />
        <rect x="132" y="10" width="62" height="13" rx="6.5" fill="var(--accent-soft)" />
        <g transform="translate(18 34)">
          {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="170" y1={i * 22} y2={i * 22} stroke="var(--line)" />)}
          <path d="M0 0V66H170" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" />
          <path d="M0 62 C30 60 50 52 70 38 S120 8 170 4 V66 H0Z" fill="url(#hero-plot-fill)" />
          <path className="hero-trace" d="M0 62 C30 60 50 52 70 38 S120 8 170 4" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
          {[[14, 60], [42, 54], [70, 38], [100, 22], [134, 11], [164, 5]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.2" fill="var(--data)" stroke="var(--surface)" strokeWidth="1.2" />)}
        </g>
      </g></g>

      {/* Soporte universal con bureta sobre el matraz */}
      <rect x="140" y="58" width="7" height="262" rx="2" fill="url(#kit-metal-h)" />
      <rect x="118" y="314" width="76" height="10" rx="3" fill="url(#kit-body-dark)" />
      <rect x="143" y="112" width="52" height="7" rx="2.5" fill="#78909c" />
      <Burette x={182} y={78} h={162} capacity={50} level={14} major={10} />
      <circle className="hero-drop" cx="191" cy="246" r="2.6" fill="#f48fb1" />
      <Erlenmeyer x={150} y={242} w={84} h={82} fill={0.42} liquid="#ec407a" liquidOpacity={0.5} />

      {/* Probeta graduada */}
      <GraduatedCylinder x={46} y={134} w={38} h={190} capacity={100} level={62} major={20} minor={10} liquid="#4f9fe0" />

      {/* Vaso con burbujas y termómetro */}
      <Beaker x={252} y={214} w={76} h={110} fill={0.62} liquid="#7fc7a8" liquidOpacity={0.55}>
        <g className="hero-bubbles">{bubbles.map(([x, d, r]) => <circle key={`${x}-${d}`} cx={x} cy={312} r={r} fill="#ffffff" fillOpacity="0.7" stroke="#2e7d5b" strokeOpacity="0.4" style={{ animationDelay: `${d}s` }} />)}</g>
      </Beaker>
      <g transform="rotate(8 312 260)"><Thermometer x={312} y={178} h={130} min={0} max={100} value={37} /></g>

      {/* Gradilla con tubos de ensayo */}
      <rect x="346" y="258" width="6" height="64" rx="1.5" fill="#c9a76a" />
      <rect x="430" y="258" width="6" height="64" rx="1.5" fill="#c9a76a" />
      {[['#fbc02d', 0.6], ['#7e57c2', 0.45], ['#26a69a', 0.7]].map(([c, f], i) => <TestTube key={i} x={358 + i * 26} y={232} w={16} h={82} fill={f as number} liquid={c as string} liquidOpacity={0.6} />)}
      <rect x="340" y="256" width="102" height="9" rx="2.5" fill="url(#kit-wood)" stroke="#b8975a" />
      <rect x="340" y="312" width="102" height="9" rx="2.5" fill="url(#kit-wood)" stroke="#b8975a" />

      {/* Balanza con muestra */}
      <DigitalBalance x={454} y={248} w={150} reading="21.60" />
      <Cube x={517} y={248} size={24} color="#b9c3c9" finish="metal" />

      <BenchTop y={324} width={614} />
    </svg>
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
  { icon: 'hipotesis', name: 'Hipótesis', text: 'Predices antes de experimentar.' },
  { icon: 'experimento', name: 'Experimento', text: 'Cambias variables y guardas ensayos en la tabla.' },
  { icon: 'analisis', name: 'Análisis', text: 'Gráficas, comparación con tu hipótesis y conclusión con evidencia.' },
  { icon: 'evaluacion', name: 'Evaluación', text: 'Preguntas por competencias con retroalimentación y reintentos.' },
];

const MODES: { icon: IconName; name: string; text: string }[] = [
  { icon: 'guiada', name: 'Práctica guiada', text: 'Paso a paso, con la hipótesis obligatoria antes de medir.' },
  { icon: 'libre', name: 'Exploración libre', text: 'Todos los controles abiertos para indagar a tu ritmo.' },
  { icon: 'evaluacion', name: 'Evaluación', text: 'Preguntas tipo Saber 11 con retroalimentación por opción.' },
];

export function HomePage() {
  const progress = storedProgress();
  useEffect(() => { document.title = 'Laboratorio Virtual de Ciencias Naturales'; }, []);
  const started = Object.keys(progress).length;
  const stats: [string | number, string][] = [
    [PRACTICES.length, 'prácticas interactivas'],
    [GRADES.length, 'grados, de 6.º a 11.º'],
    [3, 'competencias Saber 11'],
    [AREAS.length, 'áreas de las ciencias'],
  ];
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-h">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><span className="pulse" aria-hidden="true" />Grados 6.º a 11.º · Biología · Química · Física · Ambiente</span>
          <h1 id="hero-h">Laboratorio Virtual de Ciencias Naturales</h1>
          <p className="lead">Formula hipótesis, cambia variables, mide, grafica y concluye. Cada práctica calcula sus resultados con un modelo científico declarado, con sus supuestos y sus límites.</p>
          <div className="btn-row hero-actions">
            <button type="button" className="btn primary large" onClick={() => { const el = document.getElementById('grados'); el?.scrollIntoView({ behavior: 'smooth' }); el?.focus({ preventScroll: true }); }}>Elegir mi grado</button>
            <a className="btn large" href={href('catalogo')}>Ver todas las prácticas</a>
            <a className="btn ghost large" href={href('docente')}><Icon name="docente" size={18} />Soy docente</a>
            <InstallButton className="btn ghost large" />
          </div>
          <dl className="stats">
            {stats.map(([v, k]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
        <div className="hero-figure"><HeroScene /></div>
      </section>

      <section aria-labelledby="grados" className="home-section">
        <div className="section-head">
          <h2 id="grados" tabIndex={-1}>Elige tu grado</h2>
          <p className="muted">Cada grado reúne las prácticas de su malla curricular, alineadas con los estándares y los DBA.</p>
        </div>
        <div className="grade-grid">
          {GRADES.map((g) => {
            const list = PRACTICES.filter((p) => p.grade === g.id);
            const n = list.length;
            return (
              <a key={g.id} className="grade-tile" href={href('grado', g.id)}>
                <span className="g">{g.id}.º</span>
                <span className="t">{g.name}</span>
                <span className="d">{g.title}</span>
                <span className="grade-mix" aria-hidden="true">
                  {AREAS.map((a) => { const k = list.filter((p) => p.area === a).length; return k ? <i key={a} className={`area-${a}`} style={{ flexGrow: k }} /> : null; })}
                </span>
                <span className="d count">{n} {n === 1 ? 'práctica disponible' : 'prácticas disponibles'}<Icon name="flecha" size={16} /></span>
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

      <section aria-labelledby="destacadas" className="home-section">
        <div className="section-head row">
          <div>
            <h2 id="destacadas">Prácticas disponibles</h2>
            <p className="muted">{started ? `Llevas ${started} ${started === 1 ? 'práctica iniciada' : 'prácticas iniciadas'} en este equipo.` : 'Tu progreso se guarda en este navegador.'}</p>
          </div>
          <a className="btn" href={href('catalogo')}><Icon name="buscar" size={18} />Buscar y filtrar</a>
        </div>
        <div className="practice-grid">
          {PRACTICES.map((p) => <PracticeCard key={p.id} p={p} progress={progress[p.id]} />)}
        </div>
      </section>

      <Notice>
        <strong>Simulaciones educativas.</strong> Los resultados provienen de modelos simplificados y deterministas (salvo el azar justificado de la herencia genética). No reemplazan el trabajo en un laboratorio real. Las preguntas tipo Saber 11 son originales de esta plataforma y no son preguntas oficiales del ICFES.
      </Notice>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { PRACTICES, practiceById } from '../curriculum';
import { AREA_LABEL, GRADES } from '../curriculum/grades';
import type { Area } from '../core/types';
import { href } from '../lib/router';
import { storedProgress } from '../lib/progress';
import { decodeCode, type Decoded } from '../lib/codes';
import { loadJSON, saveJSON } from '../lib/storage';
import { PracticeCard } from '../components/PracticeCard';
import { Notice } from '../components/ui';

const AREA_COLOR: Record<Area, string> = { biologia: 'var(--bio)', quimica: 'var(--qui)', fisica: 'var(--fis)', ambiental: 'var(--amb)' };
const CODES_KEY = 'lvcn:codigos-recibidos';

function HeroFigure() {
  return (
    <svg viewBox="0 0 420 260" role="img" aria-label="Ilustración: probeta, matraz con solución, molécula de ADN y gráfica de datos sobre papel milimetrado">
      <path d="M40 40 L40 220 Q40 230 50 230 L80 230 Q90 230 90 220 L90 40" fill="rgba(70,150,220,0.22)" stroke="var(--ink-2)" strokeWidth="2" />
      <rect x="41" y="120" width="48" height="109" fill="rgba(70,150,220,0.35)" />
      {[60, 80, 100, 120, 140, 160, 180, 200].map((y) => <line key={y} x1="90" x2="100" y1={y} y2={y} stroke="var(--ink-2)" />)}
      <path d="M150 90 L150 140 L118 220 Q114 232 128 232 L202 232 Q216 232 212 220 L180 140 L180 90" fill="none" stroke="var(--ink-2)" strokeWidth="2" />
      <path d="M128 200 L202 200 L212 222 Q214 232 202 232 L128 232 Q116 232 118 222 Z" fill="rgba(140,20,120,0.45)" />
      <g transform="translate(240 30)" fill="none" strokeWidth="3">
        {Array.from({ length: 9 }, (_, i) => {
          const y = i * 14; const x = Math.sin(i * 0.8) * 22;
          return <g key={i}><line x1={30 + x} y1={y} x2={30 - x} y2={y} stroke="var(--line)" strokeWidth="2" /><circle cx={30 + x} cy={y} r="4" fill="var(--bio)" stroke="none" /><circle cx={30 - x} cy={y} r="4" fill="var(--fis)" stroke="none" /></g>;
        })}
      </g>
      <g transform="translate(300 150)">
        <line x1="0" y1="80" x2="100" y2="80" stroke="var(--ink-2)" /><line x1="0" y1="0" x2="0" y2="80" stroke="var(--ink-2)" />
        <path d="M0 78 Q30 75 45 45 T100 8" fill="none" stroke="var(--data)" strokeWidth="3" />
        {[[10, 76], [30, 64], [45, 45], [62, 26], [84, 14]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4" fill="var(--data)" />)}
      </g>
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
    <section className="card stack-sm" aria-labelledby="code-h">
      <h2 id="code-h" style={{ fontSize: '1.2rem' }}>Tengo un código de mi docente</h2>
      <div className="btn-row">
        <label htmlFor="code-in" className="sr-only">Código de asignación o lista</label>
        <input id="code-in" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="LVCN-A:…" style={{ flex: '1 1 240px', fontFamily: 'var(--font-data)' }} aria-invalid={error ? true : undefined} aria-describedby={error ? 'code-err' : undefined} />
        <button type="button" className="btn primary" onClick={submit} disabled={!code.trim()}>Abrir</button>
      </div>
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

export function HomePage() {
  const progress = storedProgress(PRACTICES);
  useEffect(() => { document.title = 'Laboratorio Virtual de Ciencias Naturales'; }, []);
  return (
    <div className="stack" style={{ gap: 36 }}>
      <section className="hero">
        <div className="stack-sm">
          <span className="eyebrow">Grados 6.º a 11.º · Biología · Química · Física · Ambiente</span>
          <h1>Laboratorio Virtual de Ciencias Naturales</h1>
          <p className="lead">Formula hipótesis, cambia variables, mide, grafica y concluye. Cada práctica calcula sus resultados con un modelo científico declarado, con sus supuestos y sus límites.</p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { const el = document.getElementById('grados'); el?.scrollIntoView({ behavior: 'smooth' }); el?.focus({ preventScroll: true }); }}>Elegir mi grado</button>
            <a className="btn" href={href('catalogo')}>Ver todas las prácticas</a>
            <a className="btn ghost" href={href('docente')}>Soy docente</a>
          </div>
        </div>
        <div className="hero-figure"><HeroFigure /></div>
      </section>

      <section aria-labelledby="grados" className="stack-sm">
        <h2 id="grados" tabIndex={-1}>Elige tu grado</h2>
        <div className="grade-grid">
          {GRADES.map((g) => {
            const n = PRACTICES.filter((p) => p.grade === g.id).length;
            return (
              <a key={g.id} className="grade-tile" href={href('grado', g.id)}>
                <span className="g">{g.id}.º</span>
                <span className="t">{g.name}</span>
                <span className="d">{g.title}</span>
                <span className="d">{n} {n === 1 ? 'práctica disponible' : 'prácticas disponibles'}</span>
              </a>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="areas" className="stack-sm">
        <h2 id="areas">Explora por asignatura</h2>
        <div className="area-grid">
          {(Object.keys(AREA_LABEL) as Area[]).map((a) => (
            <a key={a} className="area-tile" href={`${href('catalogo')}?area=${a}`}>
              <span className="dot" style={{ background: AREA_COLOR[a] }} aria-hidden="true" />
              {AREA_LABEL[a]}
              <span className="small muted" style={{ marginLeft: 'auto', fontWeight: 400 }}>{PRACTICES.filter((p) => p.area === a).length}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="card stack-sm" aria-labelledby="ciclo">
          <h2 id="ciclo" style={{ fontSize: '1.2rem' }}>Así trabajas en cada práctica</h2>
          <ol className="list">
            <li><strong>Preparación:</strong> pregunta problema, objetivos, fundamento y variables.</li>
            <li><strong>Hipótesis:</strong> predices antes de experimentar.</li>
            <li><strong>Experimento:</strong> cambias variables y guardas ensayos en la tabla.</li>
            <li><strong>Análisis:</strong> gráficas, comparación con tu hipótesis y conclusión con evidencia.</li>
            <li><strong>Evaluación:</strong> preguntas por competencias con retroalimentación y reintentos.</li>
          </ol>
          <p className="small muted">Modos: práctica guiada, exploración libre y evaluación.</p>
        </section>
        <CodeEntry />
      </div>

      <section aria-labelledby="destacadas" className="stack-sm">
        <h2 id="destacadas">Prácticas disponibles</h2>
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

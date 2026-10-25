import { useEffect, useState } from 'react';
import type { Area, Competency, GradeId, PracticeMeta } from '../core/types';
import { CATALOG as PRACTICES } from '../curriculum/catalog';
import { AREA_LABEL, COMPETENCY_LABEL, GRADES, gradeInfo, PLANNED } from '../curriculum/grades';
import { href } from '../lib/router';
import { takeCatalogSearchFocus } from '../lib/shortcuts';
import { storedProgress } from '../lib/progress';
import { PlannedCard, PracticeCard } from '../components/PracticeCard';
import { Select } from '../components/ui';
import { AREA_ICON, Icon } from '../components/icons';

const AREAS = Object.keys(AREA_LABEL) as Area[];

export function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function GradePage({ grade }: { grade: GradeId }) {
  const g = gradeInfo(grade);
  const list = PRACTICES.filter((p) => p.grade === grade);
  const planned = PLANNED.filter((p) => p.grade === grade);
  const progress = storedProgress();
  const minutes = list.reduce((t, p) => t + p.durationMin, 0);
  useEffect(() => { document.title = `Grado ${grade}.º · Laboratorio Virtual`; }, [grade]);
  return (
    <div className="stack-lg">
      <nav aria-label="Ruta de navegación" className="crumbs small"><a href={href()}>Inicio</a><span aria-hidden="true">/</span><span>Grado {grade}.º</span></nav>
      <header className="page-hero grade-hero">
        <span className="grade-badge" aria-hidden="true">{grade}.º</span>
        <div className="stack-sm">
          <span className="eyebrow">Grado {grade}.º · Estándares del grupo {g.standardsGroup}</span>
          <h1>{g.name}: {g.title}</h1>
          <p className="lead muted">{g.description}</p>
          <ul className="hero-facts">
            <li><Icon name="experimento" size={18} /><span><strong>{list.length}</strong> {list.length === 1 ? 'práctica' : 'prácticas'}</span></li>
            <li><Icon name="reloj" size={18} /><span><strong>{Math.round(minutes / 60 * 10) / 10}</strong> h de trabajo</span></li>
            {AREAS.filter((a) => list.some((p) => p.area === a)).map((a) => (
              <li key={a} className={`fact-area area-${a}`}><Icon name={AREA_ICON[a]} size={18} /><span>{AREA_LABEL[a]}</span></li>
            ))}
          </ul>
        </div>
      </header>
      <section className="stack" aria-labelledby="disp">
        <h2 id="disp">Prácticas disponibles</h2>
        <div className="practice-grid">{list.map((p) => <PracticeCard key={p.id} p={p} progress={progress[p.id]} />)}</div>
      </section>
      {planned.length > 0 && (
        <section className="stack" aria-labelledby="plan">
          <div className="section-head">
            <h2 id="plan">Próximas prácticas de este grado</h2>
            <p className="muted">Están en la hoja de ruta; todavía no se pueden abrir.</p>
          </div>
          <div className="practice-grid">{planned.map((p) => <PlannedCard key={p.title} p={p} />)}</div>
        </section>
      )}
      <details className="card">
        <summary>Temáticas de la malla curricular propuesta para {grade}.º</summary>
        <ul className="list topic-list">{g.topics.map((t) => <li key={t}>{t}</li>)}</ul>
        <p className="small muted">Propuesta de organización curricular. Debe adaptarse al plan de área institucional, a los DBA aplicables y a la secuencia real de enseñanza de cada colegio.</p>
      </details>
      <nav className="grade-switch" aria-label="Otros grados">
        {GRADES.filter((x) => x.id !== grade).map((x) => <a key={x.id} className="btn small" href={href('grado', x.id)}>Ir a {x.id}.º</a>)}
      </nav>
    </div>
  );
}

/** Filtros del catálogo que viajan en la dirección (#/catalogo?q=…&grado=…): se pueden compartir y sobreviven a recargar. */
export interface CatalogFilters { q: string; grado: string; area: string; competencia: string; estado: string; orden: string }
const EMPTY: CatalogFilters = { q: '', grado: '', area: '', competencia: '', estado: '', orden: '' };
const COMPETENCIES = ['uso', 'explicacion', 'indagacion'] as const;
const STATES: { value: string; label: string }[] = [
  { value: '', label: 'Todas' }, { value: 'sin-iniciar', label: 'Sin iniciar' }, { value: 'en-curso', label: 'En curso' }, { value: 'completada', label: 'Completadas' },
];
const ORDERS: { value: string; label: string }[] = [
  { value: '', label: 'Grado y malla curricular' }, { value: 'titulo', label: 'Título (A–Z)' }, { value: 'duracion', label: 'Duración (más corta primero)' }, { value: 'progreso', label: 'Mi progreso (más avanzada primero)' },
];

export function filtersFromQuery(query: URLSearchParams): CatalogFilters {
  const f = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof CatalogFilters)[]) f[k] = query.get(k) ?? '';
  if (f.area && !(f.area in AREA_LABEL)) f.area = '';
  if (f.grado && !GRADES.some((g) => String(g.id) === f.grado)) f.grado = '';
  if (f.competencia && !(COMPETENCIES as readonly string[]).includes(f.competencia)) f.competencia = '';
  if (!STATES.some((s) => s.value === f.estado)) f.estado = '';
  if (!ORDERS.some((o) => o.value === f.orden)) f.orden = '';
  return f;
}

export function filtersToQuery(f: CatalogFilters): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Aplica búsqueda, filtros y orden (función pura: la usan la página y las pruebas unitarias). */
export function filterCatalog(list: PracticeMeta[], f: CatalogFilters, progress: Record<string, number>): PracticeMeta[] {
  const words = normalize(f.q).split(/\s+/).filter(Boolean);
  const out = list.filter((p) => {
    if (f.grado && String(p.grade) !== f.grado) return false;
    if (f.area && p.area !== f.area) return false;
    if (f.competencia && !p.competencies.includes(f.competencia as Competency)) return false;
    const pr = progress[p.id];
    if (f.estado === 'sin-iniciar' && pr !== undefined) return false;
    if (f.estado === 'en-curso' && !(pr !== undefined && pr < 100)) return false;
    if (f.estado === 'completada' && !(pr !== undefined && pr >= 100)) return false;
    if (words.length === 0) return true;
    // Varias palabras: basta con que la práctica contenga alguna (búsqueda amplia: «secuencias proteínas metabolismo»).
    const text = normalize([p.title, p.topic, p.summary, ...p.keywords].join(' '));
    return words.length === 1 ? text.includes(words[0]) : words.some((w) => text.includes(w));
  });
  if (f.orden === 'titulo') out.sort((a, b) => a.title.localeCompare(b.title, 'es'));
  if (f.orden === 'duracion') out.sort((a, b) => a.durationMin - b.durationMin || a.grade - b.grade);
  if (f.orden === 'progreso') out.sort((a, b) => (progress[b.id] ?? -1) - (progress[a.id] ?? -1));
  return out;
}

export function CatalogPage({ query }: { query: URLSearchParams }) {
  const [f, setF] = useState<CatalogFilters>(() => filtersFromQuery(query));
  const [showPlanned, setShowPlanned] = useState(true);
  useEffect(() => { document.title = 'Catálogo de prácticas · Laboratorio Virtual'; }, []);
  useEffect(() => {
    if (!takeCatalogSearchFocus()) return;
    // Después del enfoque del contenido principal que hace el enrutador al cambiar de ruta.
    const t = setTimeout(() => document.getElementById('cat-q')?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  // Si la dirección cambia desde fuera (enlace «Química» del inicio), se adoptan sus filtros.
  const queryText = query.toString();
  useEffect(() => { setF(filtersFromQuery(new URLSearchParams(queryText))); }, [queryText]);
  const set = (patch: Partial<CatalogFilters>) => setF((prev) => {
    const next = { ...prev, ...patch };
    // replaceState no dispara «hashchange»: la página no salta al inicio mientras se escribe.
    try { window.history.replaceState(null, '', `#/catalogo${filtersToQuery(next)}`); } catch { /* entornos sin historial */ }
    return next;
  });
  const progress = storedProgress();
  const list = filterCatalog(PRACTICES, f, progress);
  const nq = normalize(f.q);
  const planned = showPlanned && !f.competencia && !f.estado ? PLANNED.filter((p) => (!f.grado || String(p.grade) === f.grado) && (!f.area || p.area === f.area) && (!nq || normalize(p.title).includes(nq))) : [];
  const active: { key: keyof CatalogFilters; label: string }[] = [
    ...(f.q ? [{ key: 'q' as const, label: `«${f.q}»` }] : []),
    ...(f.grado ? [{ key: 'grado' as const, label: `${f.grado}.º` }] : []),
    ...(f.area ? [{ key: 'area' as const, label: AREA_LABEL[f.area as Area] }] : []),
    ...(f.competencia ? [{ key: 'competencia' as const, label: COMPETENCY_LABEL[f.competencia as Competency] }] : []),
    ...(f.estado ? [{ key: 'estado' as const, label: STATES.find((s) => s.value === f.estado)!.label }] : []),
  ];
  const started = Object.keys(progress).length;
  return (
    <div className="stack-lg catalog">
      <header className="page-hero catalog-hero">
        <div className="stack-sm">
          <nav aria-label="Ruta de navegación" className="crumbs small"><a href={href()}>Inicio</a><span aria-hidden="true">/</span><span aria-current="page">Catálogo</span></nav>
          <span className="eyebrow">{PRACTICES.length} prácticas · 6 grados · 4 áreas{started ? ` · ${started} con trabajo guardado` : ''}</span>
          <h1>Catálogo de prácticas</h1>
          <p className="lead muted">Busca por tema, instrumento o concepto, y filtra por grado, asignatura, competencia o tu avance.</p>
        </div>
        <div className="area-filter" role="group" aria-label="Filtro rápido por área">
          <button type="button" aria-pressed={f.area === ''} onClick={() => set({ area: '' })}>Todas</button>
          {AREAS.map((a) => (
            <button key={a} type="button" className={`area-${a}`} aria-pressed={f.area === a} onClick={() => set({ area: f.area === a ? '' : a })}>
              <Icon name={AREA_ICON[a]} size={16} strokeWidth={2} />{AREA_LABEL[a]}
            </button>
          ))}
        </div>
      </header>
      <div className="filters-panel">
        <div className="filters" role="search">
          <div className="field search-field">
            <label htmlFor="cat-q">Buscar</label>
            <span className="input-icon">
              <Icon name="buscar" size={18} />
              <input id="cat-q" type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="ADN, densidad, circuito…" aria-describedby="cat-q-hint" />
            </span>
            <span id="cat-q-hint" className="hint">Atajo: tecla <kbd>/</kbd> desde cualquier página.</span>
          </div>
          <Select label="Grado" value={f.grado} onChange={(v) => set({ grado: v })} options={[{ value: '', label: 'Todos los grados' }, ...GRADES.map((g) => ({ value: String(g.id), label: `${g.id}.º · ${g.name}` }))]} />
          <Select label="Asignatura" value={f.area} onChange={(v) => set({ area: v })} options={[{ value: '', label: 'Todas' }, ...AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))]} />
          <Select label="Competencia" value={f.competencia} onChange={(v) => set({ competencia: v })} options={[{ value: '', label: 'Todas' }, ...COMPETENCIES.map((c) => ({ value: c, label: COMPETENCY_LABEL[c] }))]} />
          <Select label="Mi avance" value={f.estado} onChange={(v) => set({ estado: v })} options={STATES} />
          <Select label="Ordenar por" value={f.orden} onChange={(v) => set({ orden: v })} options={ORDERS} />
        </div>
        <div className="filters-foot">
          <label className="check"><input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} /> Mostrar también las prácticas planificadas (no disponibles aún)</label>
          <div className="results-row">
            <p className="small results" aria-live="polite"><strong>{list.length}</strong> {list.length === 1 ? 'práctica disponible' : 'prácticas disponibles'}{planned.length ? ` y ${planned.length} planificadas` : ''}.</p>
            {active.length > 0 && <button type="button" className="btn small ghost" onClick={() => set({ ...EMPTY, orden: f.orden })}><Icon name="reiniciar" size={16} />Quitar filtros</button>}
          </div>
        </div>
        {active.length > 0 && (
          <ul className="active-filters" aria-label="Filtros activos">
            {active.map((a) => (
              <li key={a.key}><button type="button" className="chip filter-chip" onClick={() => set({ [a.key]: '' })} aria-label={`Quitar el filtro ${a.label}`}>{a.label}<Icon name="cerrar" size={13} strokeWidth={2.2} /></button></li>
            ))}
          </ul>
        )}
      </div>
      {list.length + planned.length > 0 && (
        <div className="practice-grid">
          {list.map((p) => <PracticeCard key={p.id} p={p} progress={progress[p.id]} />)}
          {planned.map((p) => <PlannedCard key={p.title} p={p} />)}
        </div>
      )}
      {list.length === 0 && planned.length === 0 && (
        <div className="empty-state" role="status">
          <Icon name="buscar" size={32} />
          <p className="empty-title">No hay prácticas con esos filtros</p>
          <p>Prueba con otra palabra (por ejemplo, el nombre de un instrumento) o quita algún filtro.</p>
          <button type="button" className="btn" onClick={() => set({ ...EMPTY })}><Icon name="reiniciar" size={16} />Quitar todos los filtros</button>
        </div>
      )}
    </div>
  );
}

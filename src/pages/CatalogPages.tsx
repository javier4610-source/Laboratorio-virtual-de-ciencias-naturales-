import { useEffect, useState } from 'react';
import type { Area, Competency, GradeId } from '../core/types';
import { CATALOG as PRACTICES } from '../curriculum/catalog';
import { AREA_LABEL, COMPETENCY_LABEL, GRADES, gradeInfo, PLANNED } from '../curriculum/grades';
import { href } from '../lib/router';
import { storedProgress } from '../lib/progress';
import { PlannedCard, PracticeCard } from '../components/PracticeCard';
import { Select } from '../components/ui';
import { AREA_ICON, Icon } from '../components/icons';

const AREAS = Object.keys(AREA_LABEL) as Area[];

function normalize(s: string) {
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

export function CatalogPage({ initialArea }: { initialArea?: string }) {
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [area, setArea] = useState(initialArea && initialArea in AREA_LABEL ? initialArea : '');
  const [comp, setComp] = useState('');
  const [showPlanned, setShowPlanned] = useState(true);
  useEffect(() => { document.title = 'Catálogo de prácticas · Laboratorio Virtual'; }, []);
  useEffect(() => { if (initialArea && initialArea in AREA_LABEL) setArea(initialArea); }, [initialArea]);
  const nq = normalize(q);
  const list = PRACTICES.filter((p) =>
    (!grade || String(p.grade) === grade) && (!area || p.area === area) && (!comp || p.competencies.includes(comp as Competency)) &&
    (!nq || normalize([p.title, p.topic, p.summary, ...p.keywords].join(' ')).includes(nq)));
  const planned = showPlanned && !comp ? PLANNED.filter((p) => (!grade || String(p.grade) === grade) && (!area || p.area === area) && (!nq || normalize(p.title).includes(nq))) : [];
  const progress = storedProgress();
  const filtered = !!(q || grade || area || comp);
  return (
    <div className="stack-lg">
      <header className="page-hero catalog-hero">
        <div className="stack-sm">
          <span className="eyebrow">{PRACTICES.length} prácticas · 6 grados · 4 áreas</span>
          <h1>Catálogo de prácticas</h1>
          <p className="lead muted">Busca por tema, instrumento o concepto, y filtra por grado, asignatura o competencia.</p>
        </div>
        <div className="area-filter" role="group" aria-label="Filtro rápido por área">
          <button type="button" aria-pressed={area === ''} onClick={() => setArea('')}>Todas</button>
          {AREAS.map((a) => (
            <button key={a} type="button" className={`area-${a}`} aria-pressed={area === a} onClick={() => setArea(area === a ? '' : a)}>
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
              <input id="cat-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ADN, densidad, circuito…" />
            </span>
          </div>
          <Select label="Grado" value={grade} onChange={setGrade} options={[{ value: '', label: 'Todos los grados' }, ...GRADES.map((g) => ({ value: String(g.id), label: `${g.id}.º · ${g.name}` }))]} />
          <Select label="Asignatura" value={area} onChange={setArea} options={[{ value: '', label: 'Todas' }, ...AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))]} />
          <Select label="Competencia" value={comp} onChange={setComp} options={[{ value: '', label: 'Todas' }, ...(['uso', 'explicacion', 'indagacion'] as const).map((c) => ({ value: c, label: COMPETENCY_LABEL[c] }))]} />
        </div>
        <div className="filters-foot">
          <label className="check"><input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} /> Mostrar también las prácticas planificadas (no disponibles aún)</label>
          <div className="results-row">
            <p className="small results" aria-live="polite"><strong>{list.length}</strong> {list.length === 1 ? 'práctica disponible' : 'prácticas disponibles'}{planned.length ? ` y ${planned.length} planificadas` : ''}.</p>
            {filtered && <button type="button" className="btn small ghost" onClick={() => { setQ(''); setGrade(''); setArea(''); setComp(''); }}><Icon name="reiniciar" size={16} />Quitar filtros</button>}
          </div>
        </div>
      </div>
      <div className="practice-grid">
        {list.map((p) => <PracticeCard key={p.id} p={p} progress={progress[p.id]} />)}
        {planned.map((p) => <PlannedCard key={p.title} p={p} />)}
      </div>
      {list.length === 0 && planned.length === 0 && (
        <div className="empty-state">
          <Icon name="buscar" size={32} />
          <p>No hay prácticas con esos filtros. Prueba con otra palabra o quita algún filtro.</p>
        </div>
      )}
    </div>
  );
}

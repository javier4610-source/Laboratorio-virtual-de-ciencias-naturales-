import { useEffect, useState } from 'react';
import type { Area, Competency, GradeId } from '../core/types';
import { PRACTICES } from '../curriculum';
import { AREA_LABEL, COMPETENCY_LABEL, GRADES, gradeInfo, PLANNED } from '../curriculum/grades';
import { href } from '../lib/router';
import { storedProgress } from '../lib/progress';
import { PlannedCard, PracticeCard } from '../components/PracticeCard';
import { Select } from '../components/ui';

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function GradePage({ grade }: { grade: GradeId }) {
  const g = gradeInfo(grade);
  const list = PRACTICES.filter((p) => p.grade === grade);
  const planned = PLANNED.filter((p) => p.grade === grade);
  const progress = storedProgress(list);
  useEffect(() => { document.title = `Grado ${grade}.º · Laboratorio Virtual`; }, [grade]);
  return (
    <div className="stack">
      <nav aria-label="Ruta de navegación" className="small muted"><a href={href()}>Inicio</a> / Grado {grade}.º</nav>
      <div className="stack-sm">
        <span className="eyebrow">Grado {grade}.º · Estándares del grupo {g.standardsGroup}</span>
        <h1>{g.name}: {g.title}</h1>
        <p className="lead muted" style={{ maxWidth: '70ch' }}>{g.description}</p>
      </div>
      <section className="stack-sm" aria-labelledby="disp">
        <h2 id="disp">Prácticas disponibles</h2>
        <div className="practice-grid">{list.map((p) => <PracticeCard key={p.id} p={p} progress={progress[p.id]} />)}</div>
      </section>
      <section className="stack-sm" aria-labelledby="plan">
        <h2 id="plan">Próximas prácticas de este grado</h2>
        <div className="practice-grid">{planned.map((p) => <PlannedCard key={p.title} p={p} />)}</div>
      </section>
      <details className="card">
        <summary>Temáticas de la malla curricular propuesta para {grade}.º</summary>
        <ul className="list">{g.topics.map((t) => <li key={t}>{t}</li>)}</ul>
        <p className="small muted">Propuesta de organización curricular. Debe adaptarse al plan de área institucional, a los DBA aplicables y a la secuencia real de enseñanza de cada colegio.</p>
      </details>
      <div className="btn-row">
        {GRADES.filter((x) => x.id !== grade).map((x) => <a key={x.id} className="btn small" href={href('grado', x.id)}>Ir a {x.id}.º</a>)}
      </div>
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
  const progress = storedProgress(list);
  return (
    <div className="stack">
      <h1>Catálogo de prácticas</h1>
      <div className="filters" role="search">
        <div className="field"><label htmlFor="cat-q">Buscar</label><input id="cat-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ADN, densidad, circuito…" /></div>
        <Select label="Grado" value={grade} onChange={setGrade} options={[{ value: '', label: 'Todos los grados' }, ...GRADES.map((g) => ({ value: String(g.id), label: `${g.id}.º · ${g.name}` }))]} />
        <Select label="Asignatura" value={area} onChange={setArea} options={[{ value: '', label: 'Todas' }, ...(Object.keys(AREA_LABEL) as Area[]).map((a) => ({ value: a, label: AREA_LABEL[a] }))]} />
        <Select label="Competencia" value={comp} onChange={setComp} options={[{ value: '', label: 'Todas' }, ...(['uso', 'explicacion', 'indagacion'] as const).map((c) => ({ value: c, label: COMPETENCY_LABEL[c] }))]} />
      </div>
      <label className="check"><input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} /> Mostrar también las prácticas planificadas (no disponibles aún)</label>
      <p className="small muted" aria-live="polite">{list.length} {list.length === 1 ? 'práctica disponible' : 'prácticas disponibles'}{planned.length ? ` y ${planned.length} planificadas` : ''}.</p>
      <div className="practice-grid">
        {list.map((p) => <PracticeCard key={p.id} p={p} progress={progress[p.id]} />)}
        {planned.map((p) => <PlannedCard key={p.title} p={p} />)}
      </div>
      {list.length === 0 && planned.length === 0 && <p>No hay prácticas con esos filtros. Prueba con otra palabra o quita algún filtro.</p>}
    </div>
  );
}

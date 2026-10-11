import type { PlannedPractice, PracticeDef } from '../core/types';
import { AREA_LABEL, COMPETENCY_SHORT } from '../curriculum/grades';
import { href } from '../lib/router';

export function PracticeCard({ p, progress }: { p: PracticeDef; progress?: number }) {
  return (
    <article className={`pcard area-${p.area}`}>
      <div className="meta">
        <span className={`chip area-${p.area}`}>{AREA_LABEL[p.area]}</span>
        <span>{p.grade}.º</span><span aria-hidden="true">·</span><span>{p.durationMin} min</span>
      </div>
      <h3><a href={href('practica', p.id)}>{p.title}</a></h3>
      <p>{p.summary}</p>
      <div className="stack-sm">
        <div className="chips">{p.competencies.map((c) => <span key={c} className="chip">{COMPETENCY_SHORT[c]}</span>)}</div>
        {progress !== undefined && (
          <div className="small muted">
            <div className="progress-mini" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso en ${p.title}`}><span style={{ width: `${progress}%` }} /></div>
            Progreso guardado: {progress} %
          </div>
        )}
      </div>
    </article>
  );
}

export function PlannedCard({ p }: { p: PlannedPractice }) {
  return (
    <article className="pcard planned" aria-label={`${p.title} (planificada, aún no disponible)`}>
      <div className="meta"><span className={`chip area-${p.area}`}>{AREA_LABEL[p.area]}</span><span>{p.grade}.º</span></div>
      <h3 style={{ color: 'var(--ink-2)' }}>{p.title}</h3>
      <p>Planificada para una próxima fase. Aún no está implementada.</p>
      <div><span className="chip warn">Próximamente</span></div>
    </article>
  );
}

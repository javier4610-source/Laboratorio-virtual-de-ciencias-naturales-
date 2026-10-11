import { lazy, Suspense } from 'react';
import type { Area, PlannedPractice, PracticeMeta } from '../core/types';
import { AREA_LABEL, COMPETENCY_SHORT } from '../curriculum/grades';
import { href } from '../lib/router';
import { AREA_ICON, Icon } from './icons';

// Las miniaturas ilustradas viven en un módulo aparte que se descarga después del primer pintado.
const Thumbnail = lazy(() => import('./Thumbnails'));

function Thumb({ id, area }: { id: string; area: Area }) {
  return (
    <div className={`pcard-thumb area-${area}`} aria-hidden="true">
      <Suspense fallback={<span className="thumb-fallback"><Icon name={AREA_ICON[area]} size={40} strokeWidth={1.4} /></span>}>
        <Thumbnail id={id} area={area} />
      </Suspense>
    </div>
  );
}

export function AreaChip({ area }: { area: Area }) {
  return <span className={`chip area-${area}`}><Icon name={AREA_ICON[area]} size={14} strokeWidth={2} />{AREA_LABEL[area]}</span>;
}

function Status({ progress, title }: { progress?: number; title: string }) {
  if (progress === undefined) return <span className="pstatus new">Sin iniciar</span>;
  if (progress >= 100) return <span className="pstatus done"><Icon name="check" size={14} strokeWidth={2.4} />Completada</span>;
  return (
    <span className="pstatus going">
      <span className="progress-mini" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso en ${title}`}><span style={{ width: `${progress}%` }} /></span>
      En curso · {progress} %
    </span>
  );
}

export function PracticeCard({ p, progress }: { p: PracticeMeta; progress?: number }) {
  return (
    <article className={`pcard area-${p.area}`}>
      <Thumb id={p.id} area={p.area} />
      <div className="pcard-body">
        <div className="meta">
          <AreaChip area={p.area} />
          <span className="meta-item"><Icon name="grado" size={15} />{p.grade}.º</span>
          <span className="meta-item"><Icon name="reloj" size={15} />{p.durationMin} min</span>
        </div>
        <h3><a href={href('practica', p.id)}>{p.title}</a></h3>
        <p>{p.summary}</p>
        <div className="pcard-foot">
          <div className="chips">{p.competencies.map((c) => <span key={c} className="chip comp">{COMPETENCY_SHORT[c]}</span>)}</div>
          <div className="pcard-status">
            <Status progress={progress} title={p.title} />
            <span className="go" aria-hidden="true"><Icon name="flecha" size={18} /></span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function PlannedCard({ p }: { p: PlannedPractice }) {
  return (
    <article className={`pcard planned area-${p.area}`} aria-label={`${p.title} (planificada, aún no disponible)`}>
      <div className={`pcard-thumb planned-thumb area-${p.area}`} aria-hidden="true">
        <span className="thumb-fallback"><Icon name={AREA_ICON[p.area]} size={40} strokeWidth={1.4} /></span>
      </div>
      <div className="pcard-body">
        <div className="meta"><AreaChip area={p.area} /><span className="meta-item"><Icon name="grado" size={15} />{p.grade}.º</span></div>
        <h3>{p.title}</h3>
        <p>Planificada para una próxima fase. Aún no está implementada.</p>
        <div className="pcard-foot"><span className="chip soon"><Icon name="proximamente" size={14} strokeWidth={2} />Próximamente</span></div>
      </div>
    </article>
  );
}

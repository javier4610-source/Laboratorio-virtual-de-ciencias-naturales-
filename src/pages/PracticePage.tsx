import { Suspense, useEffect, useState } from 'react';
import type { Mode, PracticeDef } from '../core/types';
import { usePracticeSession } from '../lib/session';
import { progressPercent, saveProgress, stageDone, STAGES, MIN_TRIALS, type StageId } from '../lib/progress';
import { AREA_LABEL, COMPETENCY_SHORT, gradeInfo } from '../curriculum/grades';
import { LAB_COMPONENTS } from '../labs/registry';
import { DATASETS } from '../labs/datasets';
import { DataPanel } from '../components/DataPanel';
import { AnalysisSection, EvaluationSection, HypothesisSection, ModelSection, PreparationSection } from '../components/PracticeSections';
import { ConfirmButton, Segmented } from '../components/ui';
import { ProcedureCoach, SavedToast, useFullscreen } from '../components/Workspace';
import { href } from '../lib/router';
import { onTabListKeyDown } from '../lib/a11y';

const MODE_HELP: Record<Mode, string> = {
  guiada: 'Práctica guiada: avanzas por etapas. Debes formular una hipótesis antes de experimentar y guardar ensayos antes de analizar.',
  libre: 'Exploración libre: todas las etapas están abiertas y puedes experimentar sin hipótesis. Nada se califica.',
  evaluacion: 'Modo evaluación: las preguntas cuentan solo el primer intento. Puedes reintentar para aprender.',
};

export function PracticePage({ practice: p }: { practice: PracticeDef }) {
  const api = usePracticeSession(p.id);
  const s = api.session;
  const [stage, setStage] = useState<StageId>(() => (s.hypothesis.savedAt ? 'experimento' : 'preparacion'));
  const done = stageDone(p, s);
  const progress = progressPercent(p, s);
  const Lab = LAB_COMPONENTS[p.id];
  const grade = gradeInfo(p.grade);

  useEffect(() => { document.title = `${p.title} · Laboratorio Virtual`; }, [p.title]);
  useEffect(() => { saveProgress(p.id, progress); }, [p.id, progress]);
  useEffect(() => {
    if (stage === 'modelo' && !s.visited.includes('modelo')) api.update((x) => ({ ...x, visited: [...x.visited, 'modelo'] }));
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = (id: StageId): string | null => {
    if (s.mode !== 'guiada') return null;
    if (id === 'experimento' && !done.hipotesis) return 'Primero guarda tu hipótesis.';
    if (id === 'analisis' && s.trials.length === 0) return 'Primero guarda al menos un ensayo.';
    return null;
  };
  const go = (id: StageId) => { if (!locked(id)) { setStage(id); window.scrollTo({ top: 0 }); } };

  const fs = useFullscreen<HTMLDivElement>();
  const compact = stage !== 'preparacion';
  const showNotebook = () => {
    const el = document.getElementById('cuaderno');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };

  return (
    <div className="practice">
      <header className={`practice-head${compact ? ' compact' : ''}`}>
        <nav aria-label="Ruta de navegación" className="small muted crumbs">
          <a href={href()}>Inicio</a> / <a href={href('grado', p.grade)}>{grade.name}</a> / <span>{p.title}</span>
        </nav>
        <div className="title-row">
          <div className="title-block">
            <div className="chips" hidden={compact}>
              <span className={`chip area-${p.area}`}>{AREA_LABEL[p.area]}</span>
              <span className="chip">Grado {p.grade}.º</span>
              <span className="chip">{p.durationMin} min</span>
              {p.competencies.map((c) => <span key={c} className="chip">{COMPETENCY_SHORT[c]}</span>)}
            </div>
            <h1 title={compact ? p.title : undefined}>{p.title}</h1>
          </div>
          <div className="head-actions no-print">
            <Segmented<Mode> label="Modo de trabajo" value={s.mode} onChange={(m) => api.update((x) => ({ ...x, mode: m }))}
              options={[{ value: 'guiada', label: 'Práctica guiada' }, { value: 'libre', label: 'Exploración libre' }, { value: 'evaluacion', label: 'Evaluación' }]} />
            <div className="btn-row">
              <a className="btn" href={href('practica', p.id, 'informe')}>Ver informe</a>
              <ConfirmButton label="Reiniciar práctica" confirmLabel="¿Borrar hipótesis, datos y respuestas de esta práctica?" onConfirm={() => { api.reset(); setStage('preparacion'); }} />
            </div>
          </div>
        </div>
        {!compact && <p className="muted topic"><strong>Tema curricular:</strong> {p.topic}</p>}
        <p className="problem"><span className="problem-label">Pregunta problema</span>{p.problemQuestion}</p>
        {!compact && <p className="small muted mode-help">{MODE_HELP[s.mode]}</p>}
      </header>

      <div className="stage-bar">
        <div className="stage-nav" role="tablist" aria-label="Etapas de la práctica" onKeyDown={onTabListKeyDown}>
          {STAGES.map((st, i) => {
            const lock = locked(st.id);
            return (
              <button key={st.id} type="button" role="tab" id={`tab-${st.id}`} aria-controls={`panel-${st.id}`} aria-selected={stage === st.id} tabIndex={stage === st.id ? 0 : -1}
                disabled={!!lock} title={lock ?? undefined} onClick={() => go(st.id)}>
                <span className={`badge${done[st.id] ? ' done' : ''}`} aria-hidden="true">{done[st.id] ? '✓' : i + 1}</span>
                {st.label}{lock && <span className="sr-only"> (bloqueada: {lock})</span>}
              </button>
            );
          })}
        </div>
        <div className="stage-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de la práctica">
          <span className="track"><span style={{ width: `${progress}%` }} /></span>
          <span className="num">{progress} %</span>
        </div>
      </div>

      <div role="tabpanel" id={`panel-${stage}`} aria-labelledby={`tab-${stage}`}>
        {stage === 'preparacion' && <PreparationSection practice={p} api={api} onNext={() => go('hipotesis')} />}
        {stage === 'hipotesis' && <HypothesisSection practice={p} api={api} onNext={() => { setStage('experimento'); window.scrollTo({ top: 0 }); }} />}
        {stage === 'experimento' && (
          <div className="stack">
            <div ref={fs.ref} className={`workspace stack${fs.active ? ' is-fullscreen' : ''}`}>
              <ProcedureCoach
                steps={p.procedure} done={s.stepsDone}
                onToggle={(i, checked) => api.update((x) => ({ ...x, stepsDone: checked ? [...new Set([...x.stepsDone, i])] : x.stepsDone.filter((k) => k !== i) }))}
                extra={fs.supported && <button type="button" className="btn small ghost" onClick={fs.toggle} aria-pressed={fs.active}>{fs.active ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>}
              />
              <Suspense fallback={<p role="status">Cargando el laboratorio…</p>}>
                <Lab api={api} practice={p} />
              </Suspense>
            </div>
            <DataPanel practiceId={p.id} datasets={DATASETS[p.id]} api={api} />
            <div className="btn-row">
              <button type="button" className="btn primary" disabled={!!locked('analisis')} onClick={() => go('analisis')}>Ir al análisis</button>
              {s.trials.length < MIN_TRIALS && <span className="small muted">Se recomiendan al menos {MIN_TRIALS} ensayos para identificar una tendencia.</span>}
            </div>
            <SavedToast count={s.trials.length} onShow={showNotebook} />
          </div>
        )}
        {stage === 'analisis' && <AnalysisSection practice={p} api={api} />}
        {stage === 'evaluacion' && <EvaluationSection practice={p} api={api} mode={s.mode} />}
        {stage === 'modelo' && <ModelSection practice={p} />}
      </div>
      <p className="small muted no-print">Tu trabajo se guarda automáticamente en este navegador. Para entregarlo, abre «Ver informe» y descarga o copia el archivo para tu docente.</p>
    </div>
  );
}

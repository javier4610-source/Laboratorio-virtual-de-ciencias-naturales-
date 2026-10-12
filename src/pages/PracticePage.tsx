import { Suspense, useEffect, useRef, useState } from 'react';
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
import { queuePracticeOpen, queueProgress, getEnrollment, useClassroom } from '../lib/classroom';
import { buildSyncSummary, useActiveTime } from '../lib/syncSummary';
import { CourseNote, SyncChip } from '../components/ClassroomUi';
import { MeasurementPanel, MeasurementProvider } from '../components/Measurement';

const MODE_HELP: Record<Mode, string> = {
  guiada: 'Práctica guiada: avanzas por etapas. Debes formular una hipótesis antes de experimentar y guardar ensayos antes de analizar.',
  libre: 'Exploración libre: todas las etapas están abiertas y puedes experimentar sin hipótesis. Nada se califica.',
  evaluacion: 'Modo evaluación: las preguntas cuentan solo el primer intento. Puedes reintentar para aprender.',
};

function LockIcon() {
  return <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="6" rx="1.2" fill="currentColor" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
}

/** Etapa que requiere un paso previo: explica por qué y ofrece cómo continuar (nunca un botón muerto). */
function StageGate({ title, text, primary, secondary }: { title: string; text: string; primary: { label: string; onClick: () => void }; secondary?: { label: string; onClick: () => void } }) {
  return (
    <section className="gate card" aria-labelledby="gate-title">
      <div className="gate-icon" aria-hidden="true"><LockIcon /></div>
      <h2 id="gate-title">{title}</h2>
      <p>{text}</p>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={primary.onClick}>{primary.label}</button>
        {secondary && <button type="button" className="btn" onClick={secondary.onClick}>{secondary.label}</button>}
      </div>
    </section>
  );
}

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

  // Seguimiento del curso: si el estudiante se unió a un curso, se envía un resumen del avance.
  const activeMs = useActiveTime(p.id);
  const { enrollment } = useClassroom();
  const joined = !!enrollment;
  useEffect(() => { if (joined) queuePracticeOpen(p.id); }, [p.id, joined]);
  const lastSent = useRef(s.updatedAt);
  useEffect(() => {
    if (s.updatedAt === lastSent.current || !getEnrollment()) return;
    lastSent.current = s.updatedAt;
    try { queueProgress(p.id, buildSyncSummary(p, s, activeMs())); } catch { /* el laboratorio nunca se bloquea por la sincronización */ }
  }, [s, p, activeMs]);
  useEffect(() => {
    if (stage === 'modelo' && !s.visited.includes('modelo')) api.update((x) => ({ ...x, visited: [...x.visited, 'modelo'] }));
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = (id: StageId): string | null => {
    if (s.mode !== 'guiada') return null;
    if (id === 'experimento' && !done.hipotesis) return 'Primero guarda tu hipótesis.';
    if (id === 'analisis' && s.trials.length === 0) return 'Primero guarda al menos un ensayo.';
    return null;
  };
  const go = (id: StageId) => { setStage(id); window.scrollTo({ top: 0 }); };

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
              <SyncChip />
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
                data-locked={lock ? 'true' : undefined} title={lock ?? undefined} onClick={() => go(st.id)}>
                <span className={`badge${done[st.id] ? ' done' : ''}`} aria-hidden="true">{done[st.id] ? '✓' : lock ? <LockIcon /> : i + 1}</span>
                {st.label}{lock && <span className="sr-only"> (requiere un paso previo: {lock})</span>}
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
        {stage === 'experimento' && locked('experimento') && (
          <StageGate
            title="Antes de experimentar, formula tu hipótesis"
            text="En la práctica guiada, el experimento se abre cuando guardas tu predicción: así podrás comparar lo que esperabas con lo que mides. Toma un minuto."
            primary={{ label: 'Formular mi hipótesis', onClick: () => go('hipotesis') }}
            secondary={{ label: 'Explorar sin hipótesis', onClick: () => api.update((x) => ({ ...x, mode: 'libre' })) }}
          />
        )}
        {stage === 'analisis' && locked('analisis') && (
          <StageGate
            title="Primero guarda al menos un ensayo"
            text="El análisis usa los datos de tu cuaderno de laboratorio. Realiza una medición en el experimento y guárdala en la tabla."
            primary={{ label: 'Ir al experimento', onClick: () => go('experimento') }}
          />
        )}
        {stage === 'experimento' && !locked('experimento') && (
          <div className="stack">
            <div ref={fs.ref} className={`workspace stack${fs.active ? ' is-fullscreen' : ''}`}>
              <ProcedureCoach
                steps={p.procedure} done={s.stepsDone}
                onToggle={(i, checked) => api.update((x) => ({ ...x, stepsDone: checked ? [...new Set([...x.stepsDone, i])] : x.stepsDone.filter((k) => k !== i) }))}
                extra={fs.supported && <button type="button" className="btn small ghost" onClick={fs.toggle} aria-pressed={fs.active}>{fs.active ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>}
              />
              <MeasurementPanel api={api} practiceId={p.id} />
              <MeasurementProvider api={api} practiceId={p.id}>
                <Suspense fallback={<p role="status">Cargando el laboratorio…</p>}>
                  <Lab api={api} practice={p} />
                </Suspense>
              </MeasurementProvider>
            </div>
            <DataPanel practiceId={p.id} datasets={DATASETS[p.id]} api={api} />
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={() => go('analisis')}>Ir al análisis</button>
              {s.trials.length < MIN_TRIALS && <span className="small muted">Se recomiendan al menos {MIN_TRIALS} ensayos para identificar una tendencia.</span>}
            </div>
            <SavedToast count={s.trials.length} onShow={showNotebook} />
          </div>
        )}
        {stage === 'analisis' && !locked('analisis') && <AnalysisSection practice={p} api={api} />}
        {stage === 'evaluacion' && <EvaluationSection practice={p} api={api} mode={s.mode} />}
        {stage === 'modelo' && <ModelSection practice={p} />}
      </div>
      <p className="small muted no-print">Tu trabajo se guarda automáticamente en este navegador. Para entregarlo, abre «Ver informe» y descarga o copia el archivo para tu docente.</p>
      <CourseNote />
    </div>
  );
}

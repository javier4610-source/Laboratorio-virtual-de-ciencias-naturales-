import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Competency } from '../core/types';
import { practiceById, questionById } from '../curriculum';
import { COMPETENCY_LABEL, COMPETENCY_SHORT } from '../curriculum/grades';
import { DATASETS } from '../labs/datasets';
import { api, ApiError, loadTeacherSession, saveTeacherSession, type CourseTracking, type ServerCourse, type StudentDetail, type TeacherSession, type TrackedStudent, type TrackingAlert } from '../lib/api';
import { FIT_LABEL, type FitModel } from '../lib/fit';
import { fmt, fmtDate } from '../lib/format';
import { STAGES } from '../lib/progress';
import { copyText, downloadText, slug } from '../lib/report';
import { loadJSON, saveJSON } from '../lib/storage';
import { niceTicks } from '../components/Chart';
import { ConfirmButton, Notice, Select } from '../components/ui';
import { Icon } from '../components/icons';
import { initials, timeAgo } from '../components/ClassroomUi';

const COURSE_KEY = 'lvcn:seguimiento-curso';
const REFRESH_MS = 30_000;
const COMPS: Competency[] = ['uso', 'explicacion', 'indagacion'];
const MAIN_STAGES = STAGES.filter((s) => s.id !== 'modelo');

const practiceTitle = (id: string) => practiceById(id)?.title ?? id;
const pct = (correct: number, answered: number) => (answered ? Math.round((correct / answered) * 100) : null);
const minutes = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
/** Fondo del mapa de calor: mezcla del acento según el avance (8 % a 45 %, con contraste AA en ambos temas). */
const heatBg = (p: number) => `color-mix(in srgb, var(--accent) ${Math.round(8 + p * 0.37)}%, var(--surface))`;
const scoreTone = (p: number | null) => (p === null ? '' : p >= 70 ? 'ok' : p >= 50 ? 'warn' : 'bad');
const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) => {
  try { return new Date(`${day}T12:00:00`).toLocaleDateString('es-CO', opts); } catch { return day; }
};

/* --------------------------------------------------------------- gráfica de ingresos */
function DailyChart({ daily, enrolled }: { daily: CourseTracking['summary']['daily']; enrolled: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(280, width || 560);
  const H = 200;
  const m = { l: 34, r: 8, t: 18, b: 34 };
  const max = Math.max(1, enrolled, ...daily.map((d) => d.active));
  const ticks = niceTicks(0, max, 4).filter((t) => Number.isInteger(t));
  const top = Math.max(max, ticks[ticks.length - 1] ?? max);
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const bw = iw / daily.length;
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const narrow = W < 460;
  const total = daily.reduce((a, d) => a + d.active, 0);
  const desc = `Estudiantes activos por día en los últimos ${daily.length} días. Hoy: ${daily[daily.length - 1]?.active ?? 0}. Máximo: ${Math.max(...daily.map((d) => d.active))}.`;
  return (
    <figure className="daily-chart" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{desc}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="axis-text">{t}</text>
          </g>
        ))}
        {daily.map((d, i) => {
          const h = (d.active / top) * ih;
          const x = m.l + i * bw + bw * 0.18;
          const today = i === daily.length - 1;
          return (
            <g key={d.day}>
              {d.active > 0 && <rect x={x} y={y(d.active)} width={bw * 0.64} height={h} rx={Math.min(4, bw * 0.15)} fill={today ? 'var(--data)' : 'var(--accent)'} />}
              {d.active > 0 && <text x={x + bw * 0.32} y={y(d.active) - 5} textAnchor="middle" className="value-text">{d.active}</text>}
              {(!narrow || i % 2 === 1 || today) && (
                <text x={x + bw * 0.32} y={H - m.b + 16} textAnchor="middle" className={`axis-text${today ? ' strong' : ''}`}>{today ? 'Hoy' : dayLabel(d.day, { day: 'numeric' })}</text>
              )}
            </g>
          );
        })}
        <text x={m.l} y={H - 4} className="axis-text">{dayLabel(daily[0].day, { month: 'short' })}</text>
      </svg>
      <figcaption className="small muted">{total === 0 ? 'Aún no hay ingresos registrados en estos días.' : 'Cada barra cuenta estudiantes distintos que abrieron el laboratorio ese día.'}</figcaption>
      <details className="data-table-toggle">
        <summary>Ver los datos en una tabla</summary>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Ingresos por día">
          <table>
            <thead><tr><th>Día</th><th className="n">Estudiantes activos</th><th className="n">Ingresos</th></tr></thead>
            <tbody>{daily.map((d) => <tr key={d.day}><td>{dayLabel(d.day, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td className="n">{d.active}</td><td className="n">{d.logins}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/* --------------------------------------------------------------- alertas */
const ALERT_META: Record<TrackingAlert['kind'], { label: string; tone: string }> = {
  inactivo: { label: 'Sin actividad', tone: 'warn' },
  'puntaje-bajo': { label: 'Puntaje bajo', tone: 'bad' },
  estancada: { label: 'Práctica estancada', tone: 'warn' },
};

function Alerts({ alerts, onOpen }: { alerts: TrackingAlert[]; onOpen: (id: number) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? alerts : alerts.slice(0, 6);
  return (
    <section className="card stack-sm" aria-labelledby="trk-alerts">
      <div className="panel-title"><h3 id="trk-alerts">Alertas</h3><span className="small muted">{alerts.length === 0 ? 'Todo en orden' : `${alerts.length} para revisar`}</span></div>
      {alerts.length === 0 ? (
        <p className="small muted empty-line"><Icon name="check" size={18} /> Nadie lleva 7 días sin entrar, no hay prácticas detenidas ni puntajes bajos por competencia.</p>
      ) : (
        <ul className="alert-list">
          {shown.map((a, i) => (
            <li key={`${a.kind}-${a.studentId}-${a.practiceId ?? a.competency ?? ''}-${i}`}>
              <span className={`chip ${ALERT_META[a.kind].tone}`}>{ALERT_META[a.kind].label}</span>
              <div>
                <button type="button" className="link-btn" onClick={() => onOpen(a.studentId)}>{a.name}</button>
                <span className="small muted">
                  {a.practiceId ? ` · ${practiceTitle(a.practiceId)}` : ''}{a.competency ? ` · ${COMPETENCY_SHORT[a.competency]}` : ''}
                </span>
                <div className="small">{a.message}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > 6 && <button type="button" className="btn small ghost" onClick={() => setAll(!all)} aria-expanded={all}>{all ? 'Ver menos' : `Ver las ${alerts.length} alertas`}</button>}
      <p className="small muted" style={{ margin: 0 }}>Criterios: 7 días sin entrar; práctica iniciada sin avances en 3 días; menos de 50 % de aciertos al primer intento en una competencia (mínimo 3 preguntas).</p>
    </section>
  );
}

/* --------------------------------------------------------------- mapa de calor */
function Heatmap({ students, practiceIds, onOpen }: { students: TrackedStudent[]; practiceIds: string[]; onOpen: (id: number) => void }) {
  const [sort, setSort] = useState<'nombre' | 'avance' | 'puntaje' | 'actividad'>('nombre');
  const rows = useMemo(() => {
    const score = (s: TrackedStudent) => pct(s.score.correct, s.score.answered) ?? -1;
    const last = (s: TrackedStudent) => Math.max(s.lastSeenAt, s.lastActivity ?? 0);
    const list = [...students];
    if (sort === 'avance') list.sort((a, b) => (b.avgPercent ?? -1) - (a.avgPercent ?? -1));
    if (sort === 'puntaje') list.sort((a, b) => score(b) - score(a));
    if (sort === 'actividad') list.sort((a, b) => last(b) - last(a));
    return list;
  }, [students, sort]);
  return (
    <section className="card stack-sm" aria-labelledby="trk-heat">
      <div className="panel-title">
        <h3 id="trk-heat">Avance por estudiante y práctica</h3>
        <div className="heat-legend small" aria-hidden="true"><span>0 %</span><span className="heat-scale" /><span>100 %</span></div>
      </div>
      <div className="filters">
        <Select label="Ordenar por" value={sort} onChange={(v) => setSort(v as typeof sort)} options={[
          { value: 'nombre', label: 'Nombre' }, { value: 'avance', label: 'Avance promedio' }, { value: 'puntaje', label: 'Puntaje' }, { value: 'actividad', label: 'Actividad más reciente' },
        ]} />
      </div>
      {students.length === 0 ? <p className="muted small">Aún no hay estudiantes inscritos. Comparte el código o el enlace del curso.</p> : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de avance por estudiante (desplazamiento horizontal)">
          <table className="heatmap">
            <caption className="sr-only">Avance (porcentaje de etapas) y aciertos al primer intento de cada estudiante en cada práctica</caption>
            <thead>
              <tr>
                <th scope="col">Estudiante</th>
                <th scope="col" className="n">Avance</th>
                <th scope="col" className="n">Puntaje</th>
                <th scope="col">Última actividad</th>
                {practiceIds.map((id) => <th key={id} scope="col" className="practice-col"><span>{practiceTitle(id)}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const sc = pct(s.score.correct, s.score.answered);
                const last = Math.max(s.lastSeenAt, s.lastActivity ?? 0);
                return (
                  <tr key={s.id}>
                    <th scope="row" className="student-cell">
                      <button type="button" className="link-btn student-link" onClick={() => onOpen(s.id)}>
                        <span className="avatar small" aria-hidden="true">{initials(s.name)}</span>{s.name}
                      </button>
                    </th>
                    <td className="n">{s.avgPercent === null ? '—' : `${s.avgPercent} %`}</td>
                    <td className="n">{sc === null ? '—' : <span className={`chip ${scoreTone(sc)}`}>{sc} %</span>}</td>
                    <td className="small nowrap">{timeAgo(last)}</td>
                    {practiceIds.map((id) => {
                      const p = s.practices[id];
                      if (!p) return <td key={id} className="heat empty"><span aria-hidden="true">·</span><span className="sr-only">sin iniciar</span></td>;
                      const ps = pct(p.correct, p.answered);
                      return (
                        <td key={id} className="heat" style={{ background: heatBg(p.percent) }} title={`${practiceTitle(id)}: ${p.percent} % de avance, ${p.trials} ensayos${ps === null ? '' : `, ${p.correct}/${p.answered} aciertos`}`}>
                          <span className="heat-v">{p.percent} %</span>
                          <span className="heat-s">{ps === null ? `${p.trials} ens.` : `${p.correct}/${p.answered}`}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>En cada celda: porcentaje de avance (etapas completas) y aciertos al primer intento sobre preguntas respondidas (o número de ensayos si aún no responde).</p>
    </section>
  );
}

/* --------------------------------------------------------------- preguntas y competencias */
function CompetencyBars({ comps }: { comps: CourseTracking['summary']['competencies'] }) {
  return (
    <section className="card stack-sm" aria-labelledby="trk-comp">
      <h3 id="trk-comp">Aciertos por competencia</h3>
      <ul className="bar-list">
        {COMPS.map((c) => {
          const v = comps[c];
          const p = pct(v.correct, v.answered);
          return (
            <li key={c}>
              <div className="bar-head"><span>{COMPETENCY_LABEL[c]}</span><strong className="num">{p === null ? '—' : `${p} %`}</strong></div>
              <div className="bar-track" role="img" aria-label={p === null ? `${COMPETENCY_LABEL[c]}: sin respuestas` : `${COMPETENCY_LABEL[c]}: ${p} % de aciertos al primer intento`}><span style={{ width: `${p ?? 0}%` }} className={scoreTone(p)} /></div>
              <div className="small muted">{v.answered ? `${v.correct} de ${v.answered} respuestas al primer intento` : 'Sin respuestas todavía'}</div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function QuestionsTable({ questions }: { questions: CourseTracking['questions'] }) {
  const [comp, setComp] = useState('');
  const list = questions.filter((s) => !comp || questionById(s.questionId)?.competency === comp);
  return (
    <section className="card stack-sm" aria-labelledby="trk-q">
      <div className="panel-title"><h3 id="trk-q">Análisis por pregunta</h3><span className="small muted">Ordenadas de menor a mayor acierto</span></div>
      <div className="filters">
        <Select label="Competencia" value={comp} onChange={setComp} options={[{ value: '', label: 'Todas' }, ...COMPS.map((c) => ({ value: c, label: COMPETENCY_SHORT[c] }))]} />
      </div>
      {list.length === 0 ? <p className="muted small">Cuando los estudiantes respondan preguntas, verás aquí cuáles se les dificultan y qué opción errada eligen más.</p> : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de análisis por pregunta (desplazamiento horizontal)">
          <table>
            <caption className="sr-only">Porcentaje de acierto al primer intento y opción errada más elegida por pregunta</caption>
            <thead><tr><th scope="col">Pregunta</th><th scope="col">Competencia</th><th scope="col" className="n">Respondieron</th><th scope="col">Acierto 1.er intento</th><th scope="col">Opción errada más elegida</th></tr></thead>
            <tbody>
              {list.map((s) => {
                const q = questionById(s.questionId);
                const wrongOpt = s.topWrong ? q?.options.find((o) => o.id === s.topWrong!.option) : undefined;
                return (
                  <tr key={s.questionId}>
                    <td className="q-cell">
                      <div>{q ? (q.stem.length > 130 ? `${q.stem.slice(0, 130)}…` : q.stem) : s.questionId}</div>
                      <div className="small muted">{s.practiceIds.map(practiceTitle).join(', ')}</div>
                    </td>
                    <td className="small">{q ? COMPETENCY_SHORT[q.competency] : '—'}</td>
                    <td className="n">{s.answered}</td>
                    <td>
                      <div className="pct-cell"><span className="num">{s.percent} %</span><span className="progress-mini" aria-hidden="true"><span className={`fill-${scoreTone(s.percent)}`} style={{ width: `${s.percent}%` }} /></span></div>
                    </td>
                    <td className="small">
                      {s.topWrong ? (
                        <><strong className="opt-letter">{s.topWrong.option.toUpperCase()}</strong> · {s.topWrong.count} {s.topWrong.count === 1 ? 'estudiante' : 'estudiantes'}
                          {wrongOpt && <div className="muted">{wrongOpt.text.length > 90 ? `${wrongOpt.text.slice(0, 90)}…` : wrongOpt.text}</div>}</>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PracticesTable({ practices }: { practices: CourseTracking['summary']['practices'] }) {
  return (
    <section className="card stack-sm" aria-labelledby="trk-pr">
      <h3 id="trk-pr">Prácticas más trabajadas</h3>
      {practices.length === 0 ? <p className="muted small">Aún no hay avances sincronizados.</p> : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de prácticas más trabajadas">
          <table className="practices-table">
            <thead><tr><th scope="col">Práctica</th><th scope="col" className="n">Estudiantes</th><th scope="col" className="n">Avance</th><th scope="col" className="n">Puntaje</th><th scope="col" className="n">Ensayos</th><th scope="col" className="n">Tiempo</th></tr></thead>
            <tbody>{practices.slice(0, 10).map((p) => (
              <tr key={p.practiceId}><td>{practiceTitle(p.practiceId)}</td><td className="n">{p.students}</td><td className="n">{p.avgPercent} %</td><td className="n">{p.avgScore === null ? '—' : `${p.avgScore} %`}</td><td className="n">{p.trials}</td><td className="n">{minutes(p.activeMs)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- detalle del estudiante */
type TimelineItem = { at: number; text: string; icon: 'inicio' | 'experimento' | 'check' | 'evaluacion' | 'docente' };
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

function buildTimeline(d: StudentDetail): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const e of d.timeline) {
    const pt = e.practiceId ? `«${practiceTitle(e.practiceId)}»` : '';
    if (e.kind === 'ingreso') items.push({ at: e.at, icon: e.detail === 'inscripcion' ? 'docente' : 'inicio', text: e.detail === 'inscripcion' ? 'Se unió al curso' : 'Ingresó al laboratorio' });
    else if (e.kind === 'practica') items.push({ at: e.at, icon: 'experimento', text: `Abrió la práctica ${pt}` });
    // La etapa «hipotesis» se retiró (ADR 0006): sus eventos antiguos no se muestran.
    else if (e.kind === 'etapa' && e.detail !== 'hipotesis') items.push({ at: e.at, icon: 'check', text: `Completó la etapa «${STAGE_LABEL[e.detail ?? ''] ?? e.detail}» en ${pt}` });
    else if (e.kind === 'respuestas') items.push({ at: e.at, icon: 'evaluacion', text: `Respondió preguntas en ${pt} (${(e.detail ?? '').replace('/', ' de ')})` });
  }
  for (const p of d.practices) {
    const pt = `«${practiceTitle(p.practiceId)}»`;
    for (const t of p.trials) items.push({ at: t.t, icon: 'experimento', text: `Registró un ensayo en ${pt}` });
  }
  return items.sort((a, b) => b.at - a.at);
}

function TrialsTable({ practiceId, trials }: { practiceId: string; trials: StudentDetail['practices'][number]['trials'] }) {
  const groups = new Map<string, typeof trials>();
  for (const t of trials) groups.set(t.d, [...(groups.get(t.d) ?? []), t]);
  return (
    <>
      {[...groups.entries()].map(([dsId, list]) => {
        const ds = DATASETS[practiceId]?.find((d) => d.id === dsId);
        const cols = ds?.columns ?? Object.keys(list[0]?.v ?? {}).map((k) => ({ key: k, label: k, numeric: typeof list[0].v[k] === 'number', unit: undefined as string | undefined, decimals: 2 }));
        return (
          <div className="table-wrap" tabIndex={0} role="region" aria-label={`Datos: ${ds?.label ?? dsId}`} key={dsId}>
            <table>
              <caption>{ds?.label ?? dsId} · últimos {list.length} ensayos</caption>
              <thead><tr><th scope="col" className="n">#</th>{cols.map((c) => <th key={c.key} scope="col" className={c.numeric ? 'n' : undefined}>{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}</tr></thead>
              <tbody>{list.map((t, i) => (
                <tr key={t.id || i}><td className="n">{i + 1}</td>{cols.map((c) => {
                  const v = t.v[c.key];
                  return <td key={c.key} className={c.numeric ? 'n' : undefined}>{typeof v === 'number' ? fmt(v, c.decimals ?? 2) : v ?? '—'}</td>;
                })}</tr>
              ))}</tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

function PracticeDetail({ p, open }: { p: StudentDetail['practices'][number]; open: boolean }) {
  const sc = pct(p.score.correct, p.score.answered);
  const colLabel = (key: string) => DATASETS[p.practiceId]?.flatMap((d) => d.columns).find((c) => c.key === key)?.label ?? key;
  const answers = Object.entries(p.answers);
  return (
    <details className="card practice-detail" open={open}>
      <summary>
        <span className="pd-title">{practiceTitle(p.practiceId)}</span>
        <span className="pd-meta">
          <span className="chip" style={{ background: heatBg(p.percent), color: 'var(--ink)' }}>{p.percent} % de avance</span>
          {sc !== null && <span className={`chip ${scoreTone(sc)}`}>{p.score.correct}/{p.score.answered} aciertos</span>}
          <span className="chip">{p.trialsCount} ensayos</span>
        </span>
      </summary>
      <div className="stack">
        <ol className="stage-steps" aria-label="Etapas">
          {MAIN_STAGES.map((st) => {
            const done = p.stages.includes(st.id);
            return <li key={st.id} className={done ? 'done' : ''}><span className="dot" aria-hidden="true">{done ? <Icon name="check" size={13} strokeWidth={2.5} /> : null}</span>{st.label}<span className="sr-only">{done ? ': completa' : ': pendiente'}</span></li>;
          })}
        </ol>
        <p className="small muted" style={{ margin: 0 }}>
          Modo {p.mode === 'guiada' ? 'práctica guiada' : p.mode === 'libre' ? 'exploración libre' : 'evaluación'} · tiempo activo aproximado {minutes(p.activeMs)} · última actividad {fmtDate(p.lastActivity)}
        </p>
        <div className="text-block">
          <h4>Conclusión (afirmación, evidencia y razonamiento)</h4>
          {p.conclusion.claim.trim() ? (
            <dl className="cer">
              <dt>Afirmación</dt><dd>{p.conclusion.claim}</dd>
              {p.conclusion.evidence.trim() && <><dt>Evidencia</dt><dd>{p.conclusion.evidence}</dd></>}
              {p.conclusion.reasoning.trim() && <><dt>Razonamiento</dt><dd>{p.conclusion.reasoning}</dd></>}
            </dl>
          ) : <p className="muted">Sin conclusión todavía.</p>}
        </div>
        {Object.values(p.interpretations).some((t) => t.trim()) && (
          <div className="text-block">
            <h4>Interpretación de los datos</h4>
            {Object.values(p.interpretations).filter((t) => t.trim()).map((t, i) => <p key={i}>{t}</p>)}
          </div>
        )}
        <div className="stack-sm">
          <h4 style={{ margin: 0 }}>Datos registrados</h4>
          {p.trials.length === 0 ? <p className="muted small">Sin ensayos.</p> : <TrialsTable practiceId={p.practiceId} trials={p.trials} />}
          {p.trialsCount > p.trials.length && <p className="small muted">Se muestran los últimos {p.trials.length} de {p.trialsCount} ensayos.</p>}
          {p.fits.length > 0 && <p className="small"><strong>Ajuste elegido en el análisis:</strong> {p.fits.map((f) => `${FIT_LABEL[f.model as FitModel] ?? f.model} de ${colLabel(f.y)} frente a ${colLabel(f.x)}`).join('; ')}.</p>}
        </div>
        <div className="stack-sm">
          <h4 style={{ margin: 0 }}>Respuestas ({p.score.answered} de {p.score.total})</h4>
          {answers.length === 0 ? <p className="muted small">Aún no responde preguntas.</p> : (
            <ul className="answer-list">
              {answers.map(([qid, a]) => {
                const q = questionById(qid);
                const first = a.firstChosen ?? (a.firstTryCorrect ? a.chosen : undefined);
                return (
                  <li key={qid}>
                    <span className={`chip ${a.firstTryCorrect ? 'ok' : 'bad'}`}>{a.firstTryCorrect ? 'Acierto al 1.er intento' : 'Error al 1.er intento'}</span>
                    <div>
                      <div className="small">{q ? (q.stem.length > 150 ? `${q.stem.slice(0, 150)}…` : q.stem) : qid}</div>
                      <div className="small muted">
                        {q && <>{COMPETENCY_SHORT[q.competency]} · </>}
                        {first && !a.firstTryCorrect ? <>Primero eligió <strong>{first.toUpperCase()}</strong> · </> : null}
                        Respuesta final <strong>{a.chosen.toUpperCase()}</strong>{a.correct ? ' (correcta)' : ' (incorrecta)'}
                        {q && !a.correct ? <> · correcta: {q.correct.toUpperCase()}</> : null} · {a.attempts} {a.attempts === 1 ? 'intento' : 'intentos'}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}

function StudentView({ session, courseId, studentId, summary, onBack, onDeleted, onExpired }: {
  session: TeacherSession; courseId: number; studentId: number; summary?: TrackedStudent; onBack: () => void; onDeleted: () => void; onExpired: (e: ApiError) => void;
}) {
  const [d, setD] = useState<StudentDetail | null>(null);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(25);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { backRef.current?.focus(); }, []);
  useEffect(() => {
    let alive = true;
    api.trackingStudent(session, courseId, studentId).then((x) => { if (alive) setD(x); }).catch((e: ApiError) => { if (e.status === 401) onExpired(e); else if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [session, courseId, studentId, onExpired]);
  const timeline = useMemo(() => (d ? buildTimeline(d) : []), [d]);
  const sc = summary ? pct(summary.score.correct, summary.score.answered) : null;
  return (
    <div className="stack">
      <div><button type="button" ref={backRef} className="btn small" onClick={onBack}><Icon name="flecha" size={16} className="flip" />Volver al curso</button></div>
      {error && <Notice kind="bad">{error}</Notice>}
      {!d && !error && <p role="status" className="muted">Cargando el detalle del estudiante…</p>}
      {d && (
        <>
          <div className="student-head">
            <span className="avatar large" aria-hidden="true">{initials(d.student.name)}</span>
            <div>
              <h2>{d.student.name}</h2>
              <p className="small muted" style={{ margin: 0 }}>Inscrito el {fmtDate(d.student.createdAt)} · última conexión {timeAgo(d.student.lastSeenAt)}</p>
            </div>
          </div>
          <div className="kpis">
            <div className="kpi"><div className="v">{d.practices.length}</div><div className="k">prácticas iniciadas</div></div>
            <div className="kpi"><div className="v">{summary?.avgPercent ?? '—'}{summary?.avgPercent != null ? ' %' : ''}</div><div className="k">avance promedio</div></div>
            <div className="kpi"><div className="v">{sc === null ? '—' : `${sc} %`}</div><div className="k">aciertos al primer intento</div></div>
            <div className="kpi"><div className="v">{minutes(d.practices.reduce((a, p) => a + p.activeMs, 0))}</div><div className="k">tiempo activo aproximado</div></div>
          </div>
          {summary && summary.score.answered > 0 && (
            <div className="chips" aria-label="Aciertos por competencia">
              {COMPS.map((c) => { const v = summary.byCompetency[c]; const p = pct(v.correct, v.answered); return <span key={c} className={`chip ${scoreTone(p)}`}>{COMPETENCY_SHORT[c]}: {p === null ? 'sin respuestas' : `${v.correct}/${v.answered}`}</span>; })}
            </div>
          )}
          <div className="detail-layout">
            <div className="stack">
              <h3 style={{ margin: 0 }}>Prácticas</h3>
              {d.practices.length === 0 ? <p className="muted">Aún no tiene avances sincronizados.</p> : d.practices.map((p, i) => <PracticeDetail key={p.practiceId} p={p} open={i === 0} />)}
            </div>
            <section className="card stack-sm timeline-card" aria-labelledby="trk-tl" tabIndex={0}>
              <h3 id="trk-tl">Línea de tiempo</h3>
              {timeline.length === 0 ? <p className="muted small">Sin actividad registrada.</p> : (
                <ol className="timeline">
                  {timeline.slice(0, limit).map((t, i) => (
                    <li key={i}><span className="tl-icon" aria-hidden="true"><Icon name={t.icon} size={15} /></span><div><div className="small">{t.text}</div><time className="small muted" dateTime={new Date(t.at).toISOString()}>{fmtDate(t.at)}</time></div></li>
                  ))}
                </ol>
              )}
              {timeline.length > limit && <button type="button" className="btn small ghost" onClick={() => setLimit(limit + 50)}>Ver más actividad</button>}
            </section>
          </div>
          <section className="card stack-sm danger-zone">
            <h3>Datos del estudiante</h3>
            <p className="small" style={{ margin: 0 }}>Si el estudiante o su acudiente lo solicitan, o al terminar el año, puedes eliminar su inscripción y todo su avance del servidor. No se puede deshacer.</p>
            <div><ConfirmButton label="Eliminar estudiante y sus datos" confirmLabel={`¿Eliminar a ${d.student.name} y todo su avance?`} onConfirm={() => {
              api.deleteStudent(session, courseId, studentId).then(onDeleted).catch((e: ApiError) => setError(e.message));
            }} /></div>
          </section>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- pestaña */
export function TrackingTab({ initialCourseId, onGoServer }: { initialCourseId?: number | null; onGoServer: () => void }) {
  const [session, setSession] = useState<TeacherSession | null>(() => loadTeacherSession());
  const [courses, setCourses] = useState<ServerCourse[] | null>(null);
  const [courseId, setCourseId] = useState<number | null>(() => initialCourseId ?? loadJSON<number | null>(COURSE_KEY, null));
  const [data, setData] = useState<CourseTracking | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [student, setStudent] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);

  const expired = useCallback((e: ApiError) => { saveTeacherSession(null); setSession(null); setError(e.message); }, []);

  useEffect(() => {
    if (!session) return;
    api.courses(session).then(({ courses: cs }) => {
      setCourses(cs);
      setCourseId((cur) => (cur && cs.some((c) => c.id === cur) ? cur : cs[0]?.id ?? null));
    }).catch((e: ApiError) => (e.status === 401 ? expired(e) : setError(e.message)));
  }, [session, expired]);

  const load = useCallback(async (quiet = false) => {
    if (!session || !courseId) return;
    if (!quiet) setLoading(true);
    try {
      setData(await api.tracking(session, courseId));
      setError('');
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) expired(err); else setError(err.message);
    } finally { setLoading(false); }
  }, [session, courseId, expired]);

  useEffect(() => { if (courseId) { saveJSON(COURSE_KEY, courseId); setData(null); setStudent(null); void load(); } }, [courseId, load]);
  useEffect(() => {
    if (!auto || !courseId) return;
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto, courseId, load]);
  // Reloj para «actualizado hace…».
  useEffect(() => { const id = window.setInterval(() => setTick((t) => t + 1), 15_000); return () => window.clearInterval(id); }, []);

  if (!session) {
    return (
      <div className="stack">
        {error && <Notice kind="warn">{error}</Notice>}
        <section className="card stack tracking-empty">
          <Icon name="analisis" size={32} />
          <h2>Sigue el proceso de tus estudiantes</h2>
          <p>Con el servidor del colegio, cada estudiante se une a tu curso con el código y un PIN, y su avance llega aquí automáticamente: quién ingresa, qué etapas completa, sus datos, interpretaciones, conclusiones y respuestas.</p>
          <div className="btn-row"><button type="button" className="btn primary" onClick={onGoServer}>Iniciar sesión en el servidor</button></div>
        </section>
      </div>
    );
  }

  if (courses && courses.length === 0) {
    return (
      <div className="stack">
        <Notice>Aún no tienes cursos en el servidor. Crea uno en la pestaña «Servidor» y comparte su código con tus estudiantes.</Notice>
        <div className="btn-row"><button type="button" className="btn primary" onClick={onGoServer}>Crear un curso</button></div>
      </div>
    );
  }

  const course = courses?.find((c) => c.id === courseId);
  const s = data?.summary;
  const joinLink = course ? `${window.location.origin}${window.location.pathname}#/unirme?codigo=${course.joinCode}&servidor=${encodeURIComponent(session.server)}` : '';
  const practiceIds = s ? s.practices.map((p) => p.practiceId) : [];
  void tick;

  if (student !== null && courseId) {
    return (
      <StudentView session={session} courseId={courseId} studentId={student} summary={data?.students.find((x) => x.id === student)}
        onBack={() => setStudent(null)} onExpired={expired}
        onDeleted={() => { setStudent(null); setMsg('Se eliminaron el estudiante y sus datos.'); void load(); }} />
    );
  }

  return (
    <div className="stack tracking">
      <div className="tracking-bar">
        {courses && <Select label="Curso" value={String(courseId ?? '')} onChange={(v) => setCourseId(Number(v))} options={courses.map((c) => ({ value: String(c.id), label: `${c.name} (${c.joinCode})` }))} />}
        <div className="btn-row tracking-actions">
          <button type="button" className="btn small" onClick={() => void load()} disabled={loading}><Icon name="reiniciar" size={16} />{loading ? 'Actualizando…' : 'Actualizar'}</button>
          <label className="check small"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Actualizar cada 30 s</label>
          <button type="button" className="btn small" disabled={!course} onClick={async () => {
            try {
              const csv = (await api.trackingCsv(session, courseId!)).replace(/^﻿/, '');
              setMsg(downloadText(`seguimiento-${slug(course!.name)}.csv`, csv, 'text/csv') ? 'Seguimiento exportado (CSV).' : 'Este entorno no permite descargas.');
            } catch (e) { setMsg((e as Error).message); }
          }}><Icon name="instalar" size={16} />Exportar CSV</button>
        </div>
      </div>
      <p className="small muted" aria-live="off" style={{ margin: 0 }}>{s ? `Actualizado ${timeAgo(s.generatedAt)} (${fmtDate(s.generatedAt)}).` : ''}</p>
      {msg && <p className="notice ok" role="status">{msg}</p>}
      {error && <Notice kind="bad">{error}</Notice>}
      {!data && !error && <p role="status" className="muted">Cargando el seguimiento del curso…</p>}

      {course && (
        <section className="card join-share" aria-labelledby="trk-share">
          <div>
            <h3 id="trk-share">Invita a tus estudiantes</h3>
            <p className="small muted" style={{ margin: 0 }}>Cada estudiante usa «Unirme a mi curso» (arriba a la derecha) con este código, su nombre y un PIN de 4 dígitos que inventa. {course.open ? '' : 'El curso está cerrado: no admite nuevas inscripciones ni avances.'}</p>
          </div>
          <div className="join-code" aria-label={`Código del curso: ${course.joinCode.split('').join(' ')}`}>{course.joinCode}</div>
          <div className="btn-row">
            <button type="button" className="btn small" onClick={async () => setMsg((await copyText(joinLink)) ? 'Enlace de inscripción copiado.' : `Copia este enlace: ${joinLink}`)}>Copiar enlace de inscripción</button>
          </div>
        </section>
      )}

      {s && data && (
        <>
          <div className="kpis kpis-5">
            <div className="kpi"><div className="k">Inscritos</div><div className="v">{s.enrolled}</div></div>
            <div className="kpi"><div className="k">Activos hoy</div><div className="v">{s.activeToday}</div></div>
            <div className="kpi"><div className="k">Activos en 7 días</div><div className="v">{s.active7}</div></div>
            <div className="kpi"><div className="k">Avance promedio</div><div className="v">{s.avgPercent === null ? '—' : `${s.avgPercent} %`}</div></div>
            <div className="kpi"><div className="k">Puntaje promedio</div><div className="v">{s.avgScore === null ? '—' : `${s.avgScore} %`}</div><div className="k">aciertos al 1.er intento</div></div>
          </div>
          <div className="grid-2 tracking-grid">
            <section className="card stack-sm" aria-labelledby="trk-daily">
              <div className="panel-title"><h3 id="trk-daily">Ingresos por día</h3><span className="small muted">Últimos 14 días</span></div>
              <DailyChart daily={s.daily} enrolled={s.enrolled} />
            </section>
            <Alerts alerts={data.alerts} onOpen={setStudent} />
          </div>
          <Heatmap students={data.students} practiceIds={practiceIds} onOpen={setStudent} />
          <div className="grid-2 tracking-grid">
            <PracticesTable practices={s.practices} />
            <CompetencyBars comps={s.competencies} />
          </div>
          <QuestionsTable questions={data.questions} />
          <p className="small muted">Promedios: el avance es el porcentaje de etapas completas de cada práctica iniciada; el puntaje es el porcentaje de preguntas acertadas al primer intento. Total de ensayos registrados: {fmt(s.totalTrials, 0)}.</p>
        </>
      )}
    </div>
  );
}

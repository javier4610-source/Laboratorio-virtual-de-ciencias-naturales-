import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react';
import {
  advance, createSampler, decimalsFor, rangeStats, runToCSV, snapToSample, startAcquisition,
  type Acquisition, type LoggerChannel, type LoggerMarker, type LoggerRun, type TriggerEdge,
} from '../lib/logger';
import { fmt, parseLocaleNumber } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { copyText, downloadText, slug } from '../lib/report';
import { Lcd } from '../labs/kit';
import type { FitModel } from '../lib/fit';
import { Chart, niceTicks } from './Chart';

/**
 * Registrador de datos en tiempo real (sensores virtuales, al estilo de Vernier LabQuest o PASCO Capstone).
 * Muestrea las funciones del modelo a una frecuencia fija en tiempo simulado, con ruido gaussiano con semilla
 * y cuantización por la resolución del instrumento; dibuja el trazo en vivo con un solo <path> por canal.
 */

export interface DataLoggerProps {
  /** Nombre del equipo, p. ej. «Interfaz de sensores · cinética». */
  title: string;
  channels: LoggerChannel[];
  /** Duración máxima de la corrida (s de tiempo simulado). */
  duration: number;
  /** Frecuencias de muestreo elegibles (muestras por segundo de tiempo simulado). */
  rates?: number[];
  defaultRate?: number;
  /** Segundos simulados por segundo real. */
  speed?: number;
  /** Ancho de la ventana de tiempo visible mientras se registra (s); por defecto, toda la corrida. */
  window?: number;
  /** Escala fija del eje vertical por canal (si falta, se ajusta a los datos). */
  ranges?: ([number, number] | undefined)[];
  /** Cambia cuando cambian las condiciones del montaje: la corrida en curso se borra. */
  resetKey?: string;
  /** Condiciones del montaje (se guardan con la corrida). */
  runLabel?: string;
  seed?: number;
  onUseRun?: (run: LoggerRun) => void;
}

type Status = 'listo' | 'armado' | 'registrando' | 'detenido' | 'completo';
const STATUS_TEXT: Record<Status, string> = {
  listo: 'Listo', armado: 'Esperando disparo', registrando: 'Registrando', detenido: 'Detenido', completo: 'Corrida completa',
};
const DEFAULT_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
const rateLabel = (r: number) => `${fmt(r, 0)} muestra${r === 1 ? '' : 's'}/s`;

/** Lecturas de un canal con los decimales de su resolución. */
const reading = (v: number | undefined, c: LoggerChannel, ideal: boolean) =>
  v === undefined || !Number.isFinite(v) ? '—' : fmt(v, decimalsFor(c.resolution) + (ideal ? 1 : 0));

export function DataLogger({
  title, channels, duration, rates = [1, 2, 5, 10, 20], defaultRate, speed = 1, window: win, ranges, resetKey, runLabel, seed = 20261, onUseRun,
}: DataLoggerProps) {
  const id = useId();
  const [rate, setRate] = useState(defaultRate ?? rates[Math.min(2, rates.length - 1)]);
  const [ideal, setIdeal] = useState(false);
  const [trigOn, setTrigOn] = useState(false);
  const [trigCh, setTrigCh] = useState(0);
  const [trigEdge, setTrigEdge] = useState<TriggerEdge>('subida');
  const [trigText, setTrigText] = useState('');
  const [status, setStatus] = useState<Status>('listo');
  const [, setFrame] = useState(0);
  const [simT, setSimT] = useState(0);
  const [markers, setMarkers] = useState<LoggerMarker[]>([]);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [selText, setSelText] = useState<[string, string]>(['', '']);
  const [live, setLive] = useState('');
  const [msg, setMsg] = useState('');
  const [showTable, setShowTable] = useState(false);
  const [runIndex, setRunIndex] = useState(0);
  const acq = useRef<Acquisition | null>(null);
  const chRef = useRef(channels);
  chRef.current = channels;
  const raf = useRef(0);
  const lastLive = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clear = () => {
    cancelAnimationFrame(raf.current);
    acq.current = null;
    setStatus('listo'); setSimT(0); setMarkers([]); setSel(null); setSelText(['', '']); setMsg('');
  };
  // Si cambian las condiciones del montaje, la corrida anterior ya no corresponde.
  const firstKey = useRef(true);
  useEffect(() => {
    if (firstKey.current) { firstKey.current = false; return; }
    if (acq.current) { clear(); setLive('Cambiaron las condiciones del montaje: se borró la corrida del registrador.'); }
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const trigLevel = parseLocaleNumber(trigText);
  const trigInvalid = trigOn && !Number.isFinite(trigLevel);

  const describe = (a: Acquisition) => {
    const l = a.last;
    if (!l) return '';
    return `t = ${fmt(l.t, decimalsFor(1 / a.rate))} s. ` + chRef.current.map((c, i) => `${c.name}: ${reading(l.values[i], c, ideal)} ${c.unit}`).join('; ') + '.';
  };

  const finish = (a: Acquisition, how: 'completo' | 'detenido') => {
    cancelAnimationFrame(raf.current);
    playSound('beep', { freq: 2050 });
    setStatus(how);
    setFrame((f) => f + 1);
    const n = a.samples.length;
    setLive(n === 0
      ? `Registro ${how === 'completo' ? 'terminado' : 'detenido'} sin muestras: el disparo no se cumplió.`
      : `Registro ${how === 'completo' ? 'completo' : 'detenido'}: ${n} muestras${a.triggerTime !== null ? `, disparo en t = ${fmt(a.triggerTime, decimalsFor(1 / a.rate))} s` : ''}. ${describe(a)}`);
  };

  const start = () => {
    if (trigInvalid) return;
    cancelAnimationFrame(raf.current);
    playSound('beep');
    const trigger = trigOn ? { channel: trigCh, level: trigLevel, edge: trigEdge } : null;
    const a = startAcquisition(rate, duration, trigger);
    const sampler = createSampler(chRef.current, seed + runIndex * 7919, ideal);
    acq.current = a;
    setRunIndex((n) => n + 1);
    setMarkers([]); setSel(null); setSelText(['', '']); setMsg(''); setShowTable(false);
    if (prefersReducedMotion()) {
      advance(a, sampler, duration);
      setSimT(duration);
      finish(a, 'completo');
      return;
    }
    setStatus(trigger ? 'armado' : 'registrando');
    setLive(trigger ? `Disparo armado: el registro empieza cuando ${chRef.current[trigger.channel].name.toLowerCase()} ${trigger.edge === 'subida' ? 'suba por encima de' : 'baje por debajo de'} ${fmt(trigger.level, 2)} ${chRef.current[trigger.channel].unit}.` : 'Registro iniciado.');
    lastLive.current = performance.now();
    let t = 0;
    let prev = performance.now();
    advance(a, sampler, 0);
    const tick = (now: number) => {
      // Tiempo transcurrido acotado: si la pestaña estuvo oculta, no se salta la corrida.
      const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000));
      prev = now;
      t = Math.min(duration, t + dt * speed);
      const wasArmed = a.trigger !== null && a.triggerTime === null;
      advance(a, sampler, t);
      setSimT(t);
      if (wasArmed && a.triggerTime !== null) { setStatus('registrando'); setLive(`Disparo cumplido en t = ${fmt(a.triggerTime, decimalsFor(1 / a.rate))} s: registrando.`); lastLive.current = now; }
      else if (now - lastLive.current > 4000) { setLive(describe(a)); lastLive.current = now; }
      if (a.done) { finish(a, 'completo'); return; }
      setFrame((f) => f + 1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const stop = () => { if (acq.current) finish(acq.current, 'detenido'); };
  const recording = status === 'registrando' || status === 'armado';
  const a = acq.current;
  const samples = a?.samples ?? [];
  const hasData = samples.length > 0;
  const tDec = decimalsFor(1 / rate);

  const run: LoggerRun | null = a && !recording && hasData ? {
    rate: a.rate, ideal, triggerTime: a.triggerTime, markers, label: runLabel,
    channels: channels.map((c, ci) => ({ id: c.id, name: c.name, unit: c.unit, resolution: c.resolution, color: c.color ?? DEFAULT_COLORS[ci % DEFAULT_COLORS.length] })),
    samples,
  } : null;

  /* ---------------- geometría del registrador */
  const W = Math.max(280, Math.min(1000, width || 640));
  const narrow = W < 480;
  const laneH = channels.length === 1 ? (narrow ? 190 : 230) : (narrow ? 130 : 150);
  const m = { l: narrow ? 46 : 58, r: 14, t: 10, b: 30 };
  const lanesTop = m.t;
  const H = lanesTop + channels.length * laneH + m.b;
  const plotW = W - m.l - m.r;
  const winS = Math.min(duration, win ?? duration);
  const lastT = hasData ? samples[samples.length - 1].t : 0;
  const tHead = recording ? simT : lastT;
  const xDom: [number, number] = recording && winS < duration
    ? [Math.max(0, tHead - winS), Math.max(winS, tHead)]
    : [0, hasData || recording ? Math.max(winS, Math.min(duration, Math.max(lastT, simT))) : duration];
  const xs = (t: number) => m.l + ((t - xDom[0]) / (xDom[1] - xDom[0] || 1)) * plotW;
  const tOfX = (px: number) => xDom[0] + ((px - m.l) / plotW) * (xDom[1] - xDom[0]);
  const xTicks = niceTicks(xDom[0], xDom[1], narrow ? 4 : 8).filter((v) => v >= xDom[0] - 1e-9 && v <= xDom[1] + 1e-9);

  const lanes = channels.map((c, ci) => {
    const top = lanesTop + ci * laneH + (ci > 0 ? 8 : 0), bottom = lanesTop + (ci + 1) * laneH - 8;
    let lo = Infinity, hi = -Infinity;
    for (const s of samples) { const v = s.values[ci]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const fixed = ranges?.[ci];
    let y0: number, y1: number;
    if (fixed) { y0 = Math.min(fixed[0], lo); y1 = Math.max(fixed[1], hi); }
    else if (Number.isFinite(lo)) { const pad = Math.max((hi - lo) * 0.12, c.resolution * 4, Math.abs(hi) * 0.02, 1e-6); y0 = lo - pad; y1 = hi + pad; }
    else { y0 = 0; y1 = 1; }
    let ticks = niceTicks(y0, y1, laneH > 160 ? 5 : 4);
    if (ticks.length < 3) ticks = niceTicks(y0, y1, 6);
    y0 = Math.min(y0, ticks[0]); y1 = Math.max(y1, ticks[ticks.length - 1]);
    const ys = (v: number) => bottom - ((v - y0) / (y1 - y0 || 1)) * (bottom - top);
    return { c, ci, top, bottom, ys, ticks, color: c.color ?? DEFAULT_COLORS[ci % DEFAULT_COLORS.length] };
  });

  // Un solo <path> por canal; solo los puntos dentro de la ventana visible.
  const paths = lanes.map(({ ci, ys }) => {
    let d = '';
    let started = false;
    for (const s of samples) {
      if (s.t < xDom[0] - 1 / rate || s.t > xDom[1] + 1 / rate) continue;
      d += `${started ? 'L' : 'M'}${xs(s.t).toFixed(1)} ${ys(s.values[ci]).toFixed(1)}`;
      started = true;
    }
    return d;
  });

  /* ---------------- selección con el puntero */
  const svgRef = useRef<SVGSVGElement>(null);
  const dragFrom = useRef<number | null>(null);
  const pxToT = (e: RPointerEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    return Math.max(0, Math.min(lastT, tOfX(px)));
  };
  const setSelection = (s: [number, number] | null) => {
    setSel(s);
    setSelText(s ? [fmt(Math.min(...s), tDec), fmt(Math.max(...s), tDec)] : ['', '']);
  };
  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (!hasData || recording) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragFrom.current = pxToT(e);
    setSelection([dragFrom.current, dragFrom.current]);
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (dragFrom.current === null) return;
    setSelection([dragFrom.current, pxToT(e)]);
  };
  const onUp = () => {
    if (dragFrom.current === null) return;
    dragFrom.current = null;
    if (sel && Math.abs(sel[1] - sel[0]) < 1e-9) setSelection(null);
  };
  const commitSelText = (txt: [string, string]) => {
    const a0 = parseLocaleNumber(txt[0]), a1 = parseLocaleNumber(txt[1]);
    if (txt[0].trim() === '' && txt[1].trim() === '') { setSel(null); return; }
    if (Number.isFinite(a0) && Number.isFinite(a1) && a0 !== a1) setSel([Math.max(0, a0), Math.max(0, a1)]);
  };

  /* ---------------- marcadores */
  const addMarker = () => {
    if (!a) return;
    const t = recording ? (a.last?.t ?? null) : sel ? snapToSample(samples, Math.min(...sel)) : snapToSample(samples, lastT);
    if (t === null || (recording && a.trigger && a.triggerTime === null)) return;
    const label = `M${markers.length + 1}`;
    setMarkers((ms) => [...ms.filter((mk) => Math.abs(mk.t - t) > 1e-9), { t, label }].sort((p, q) => p.t - q.t));
    setLive(`Marcador ${label} en t = ${fmt(t, tDec)} s.`);
  };

  /* ---------------- estadísticas */
  const stats = useMemo(() => (hasData && !recording
    ? channels.map((_, ci) => rangeStats(samples, ci, sel ? sel[0] : -Infinity, sel ? sel[1] : Infinity))
    : []), // eslint-disable-next-line react-hooks/exhaustive-deps
  [hasData, recording, samples.length, sel, channels.length, runIndex]);

  const fileBase = slug(`corrida ${title}`);
  const exportCSV = async () => {
    if (!run) return;
    const csv = runToCSV(run);
    if (downloadText(`${fileBase}.csv`, csv, 'text/csv')) { setMsg('Corrida descargada en CSV.'); return; }
    setMsg((await copyText(csv)) ? 'No se pudo descargar: se copió la corrida al portapapeles.' : 'No se pudo descargar ni copiar la corrida.');
  };
  const copyRun = async () => {
    if (!run) return;
    setMsg((await copyText(runToCSV(run).replace(/;/g, '\t'))) ? 'Corrida copiada: pégala en una hoja de cálculo.' : 'El navegador no permitió copiar.');
  };
  const useRun = () => {
    if (!run || !onUseRun) return;
    onUseRun(run);
    setMsg(`Corrida enviada al laboratorio (${run.samples.length} muestras).`);
  };

  const latest = a?.last?.values;
  const tShown = recording ? simT : a?.last?.t ?? 0;
  const selLabel = sel ? `de ${fmt(Math.min(...sel), tDec)} s a ${fmt(Math.max(...sel), tDec)} s` : 'toda la corrida';

  return (
    <div className="logger">
      <div className="logger-head">
        <div className="logger-brand">
          <span className="logger-led" data-status={status} aria-hidden="true" />
          <span className="logger-title">{title}</span>
        </div>
        <div className="logger-state">
          <span className="logger-pill" data-status={status}>{STATUS_TEXT[status]}</span>
          <span className="logger-clock">t = {fmt(tShown, Math.max(1, tDec))} s</span>
          <span className="logger-rate">{rateLabel(rate)}</span>
        </div>
      </div>

      <div className="logger-meters">
        {channels.map((c, ci) => {
          const txt = reading(latest?.[ci], c, ideal);
          const shortUnit = c.unit.length <= 3;
          return (
            <div className="logger-meter" key={c.id}>
              <div className="logger-meter-k"><span className="logger-swatch" style={{ background: c.color ?? DEFAULT_COLORS[ci % DEFAULT_COLORS.length] }} aria-hidden="true" />{c.name}{shortUnit ? '' : ` (${c.unit})`}</div>
              <svg viewBox="0 0 170 40" className="logger-lcd" role="img" aria-label={`${c.name}: ${txt} ${c.unit}`}>
                <Lcd x={0.5} y={0.5} w={169} h={39} text={txt} unit={shortUnit ? c.unit : undefined} />
              </svg>
              <div className="logger-meter-res">resolución {fmt(c.resolution, decimalsFor(c.resolution))} {c.unit}{c.noise && !ideal ? ` · ruido σ = ${fmt(c.noise, decimalsFor(c.resolution) + 1)}` : ''}</div>
            </div>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">{live}</p>

      <div className="logger-scope" ref={wrapRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-labelledby={`${id}-gt ${id}-gd`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ touchAction: hasData && !recording ? 'none' : 'auto', cursor: hasData && !recording ? 'crosshair' : 'default' }}>
          <title id={`${id}-gt`}>Registrador gráfico: {channels.map((c) => c.name.toLowerCase()).join(' y ')} en función del tiempo</title>
          <desc id={`${id}-gd`}>{hasData ? `${samples.length} muestras desde ${fmt(samples[0].t, tDec)} s hasta ${fmt(lastT, tDec)} s. La tabla de la corrida tiene los mismos datos.` : 'Sin datos: inicia el registro.'}</desc>
          <rect x={m.l} y={lanesTop} width={plotW} height={channels.length * laneH} fill="var(--logger-screen)" rx="4" />
          {xTicks.map((v) => <line key={`gx${v}`} x1={xs(v)} x2={xs(v)} y1={lanesTop} y2={lanesTop + channels.length * laneH} stroke="var(--logger-grid)" />)}
          {sel && hasData && (
            <rect x={xs(Math.max(xDom[0], Math.min(...sel)))} y={lanesTop} width={Math.max(1, xs(Math.min(xDom[1], Math.max(...sel))) - xs(Math.max(xDom[0], Math.min(...sel))))} height={channels.length * laneH}
              fill="var(--accent)" fillOpacity="0.12" stroke="var(--accent)" strokeOpacity="0.5" strokeDasharray="4 3" />
          )}
          {lanes.map(({ c, ci, top, bottom, ys, ticks, color }) => (
            <g key={c.id}>
              {ci > 0 && <line x1={m.l} x2={m.l + plotW} y1={top - 8} y2={top - 8} stroke="var(--line-strong)" />}
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={m.l} x2={m.l + plotW} y1={ys(v)} y2={ys(v)} stroke="var(--logger-grid)" />
                  <text x={m.l - 6} y={ys(v) + 3.5} textAnchor="end" className="logger-tick">{fmt(v, Math.max(0, Math.min(4, -Math.floor(Math.log10(Math.abs(ticks[1] - ticks[0]) || 1)))))}</text>
                </g>
              ))}
              <text x={m.l + 8} y={top + 13} className="logger-lane-label" fill={color}>{c.name} ({c.unit})</text>
              {a?.trigger && a.trigger.channel === ci && ys(a.trigger.level) >= top && ys(a.trigger.level) <= bottom && (
                <g>
                  <line x1={m.l} x2={m.l + plotW} y1={ys(a.trigger.level)} y2={ys(a.trigger.level)} stroke="var(--data)" strokeDasharray="6 4" />
                  <text x={m.l + plotW - 4} y={ys(a.trigger.level) - 4} textAnchor="end" className="logger-tick" fill="var(--data)">disparo</text>
                </g>
              )}
              <path d={paths[ci]} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {recording && latest && a?.last && a.last.t >= xDom[0] && (
                <circle cx={xs(a.last.t)} cy={ys(latest[ci])} r="4" fill={color} stroke="var(--logger-screen)" strokeWidth="1.5" />
              )}
            </g>
          ))}
          {markers.filter((mk) => mk.t >= xDom[0] && mk.t <= xDom[1]).map((mk) => (
            <g key={mk.label}>
              <line x1={xs(mk.t)} x2={xs(mk.t)} y1={lanesTop} y2={lanesTop + channels.length * laneH} stroke="var(--ink-2)" strokeDasharray="2 3" />
              <rect x={xs(mk.t) - 11} y={lanesTop + channels.length * laneH - 15} width="22" height="14" rx="3" fill="var(--ink)" />
              <text x={xs(mk.t)} y={lanesTop + channels.length * laneH - 4.5} textAnchor="middle" className="logger-marker-text">{mk.label}</text>
            </g>
          ))}
          {recording && <line x1={xs(simT)} x2={xs(simT)} y1={lanesTop} y2={lanesTop + channels.length * laneH} stroke="var(--accent)" strokeOpacity="0.6" />}
          <rect x={m.l} y={lanesTop} width={plotW} height={channels.length * laneH} fill="none" stroke="var(--line-strong)" rx="4" />
          {xTicks.map((v) => <text key={`tx${v}`} x={xs(v)} y={H - m.b + 16} textAnchor="middle" className="logger-tick">{fmt(v, Math.max(0, -Math.floor(Math.log10((xTicks[1] - xTicks[0]) || 1))))}</text>)}
          <text x={m.l + plotW} y={H - 2} textAnchor="end" className="logger-axis">Tiempo (s)</text>
          {!hasData && !recording && <text x={m.l + plotW / 2} y={lanesTop + (channels.length * laneH) / 2} textAnchor="middle" className="logger-axis">Pulsa «Iniciar» para registrar</text>}
          {status === 'armado' && <text x={m.l + plotW / 2} y={lanesTop + (channels.length * laneH) / 2} textAnchor="middle" className="logger-axis">Esperando el disparo…</text>}
        </svg>
      </div>

      <div className="logger-toolbar">
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={start} disabled={recording || trigInvalid}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2l9 5-9 5z" fill="currentColor" /></svg>Iniciar
          </button>
          <button type="button" className="btn" onClick={stop} disabled={!recording}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor" /></svg>Detener
          </button>
          <button type="button" className="btn" onClick={() => { clear(); setLive('Registro borrado.'); }} disabled={recording || !a}>Borrar</button>
          <button type="button" className="btn" onClick={addMarker} disabled={!hasData}>Marcar instante</button>
        </div>
      </div>

      <div className="logger-settings">
        <div className="field">
          <label htmlFor={`${id}-rate`}>Frecuencia de muestreo</label>
          <select id={`${id}-rate`} value={rate} disabled={recording} onChange={(e) => setRate(Number(e.target.value))}>
            {rates.map((r) => <option key={r} value={r}>{rateLabel(r)}</option>)}
          </select>
        </div>
        <label className="check"><input type="checkbox" checked={ideal} disabled={recording} onChange={(e) => setIdeal(e.target.checked)} /> Sensor ideal (sin ruido ni resolución)</label>
        <fieldset className="logger-trigger">
          <legend>Disparo</legend>
          <label className="check"><input type="checkbox" checked={trigOn} disabled={recording} onChange={(e) => {
            setTrigOn(e.target.checked);
            if (e.target.checked && trigText === '') {
              const c = channels[trigCh];
              const v = c.sample(duration * 0.1);
              setTrigText(fmt(v, decimalsFor(c.resolution)));
            }
          }} /> Empezar a registrar al cruzar un umbral</label>
          {trigOn && (
            <div className="logger-trigger-grid">
              {channels.length > 1 && (
                <div className="field">
                  <label htmlFor={`${id}-tch`}>Canal</label>
                  <select id={`${id}-tch`} value={trigCh} disabled={recording} onChange={(e) => setTrigCh(Number(e.target.value))}>
                    {channels.map((c, i) => <option key={c.id} value={i}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor={`${id}-ted`}>Flanco</label>
                <select id={`${id}-ted`} value={trigEdge} disabled={recording} onChange={(e) => setTrigEdge(e.target.value as TriggerEdge)}>
                  <option value="subida">De subida (sube y cruza)</option>
                  <option value="bajada">De bajada (baja y cruza)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${id}-tlv`}>Umbral ({channels[trigCh].unit})</label>
                <input id={`${id}-tlv`} type="text" inputMode="decimal" value={trigText} disabled={recording}
                  aria-invalid={trigInvalid || undefined} aria-describedby={trigInvalid ? `${id}-tle` : undefined}
                  onChange={(e) => setTrigText(e.target.value)} />
                {trigInvalid && <span id={`${id}-tle`} className="small" style={{ color: 'var(--bad)' }}>Escribe un número.</span>}
              </div>
            </div>
          )}
        </fieldset>
      </div>

      {markers.length > 0 && (
        <ul className="logger-markers" aria-label="Marcadores">
          {markers.map((mk) => (
            <li key={mk.label}>
              <span className="logger-chip"><strong>{mk.label}</strong> t = {fmt(mk.t, tDec)} s</span>
              <button type="button" className="btn small ghost" aria-label={`Quitar el marcador ${mk.label}`} onClick={() => setMarkers((ms) => ms.filter((x) => x !== mk))}>×</button>
            </li>
          ))}
        </ul>
      )}

      {run && (
        <div className="logger-analysis stack-sm">
          <div className="logger-sel">
            <span className="small" style={{ fontWeight: 700 }}>Selección para las estadísticas</span>
            <div className="logger-sel-row">
              <div className="field">
                <label htmlFor={`${id}-s0`}>Desde (s)</label>
                <input id={`${id}-s0`} type="text" inputMode="decimal" value={selText[0]} placeholder={fmt(samples[0].t, tDec)}
                  onChange={(e) => setSelText([e.target.value, selText[1]])} onBlur={() => commitSelText(selText)} onKeyDown={(e) => { if (e.key === 'Enter') commitSelText(selText); }} />
              </div>
              <div className="field">
                <label htmlFor={`${id}-s1`}>Hasta (s)</label>
                <input id={`${id}-s1`} type="text" inputMode="decimal" value={selText[1]} placeholder={fmt(lastT, tDec)}
                  onChange={(e) => setSelText([selText[0], e.target.value])} onBlur={() => commitSelText(selText)} onKeyDown={(e) => { if (e.key === 'Enter') commitSelText(selText); }} />
              </div>
              <button type="button" className="btn small ghost" onClick={() => setSelection(null)} disabled={!sel}>Toda la corrida</button>
            </div>
            <span className="small muted">También puedes arrastrar sobre el registrador para seleccionar un intervalo.</span>
          </div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Estadísticas de la corrida">
            <table>
              <caption className="sr-only">Estadísticas de {selLabel}</caption>
              <thead>
                <tr><th scope="col">Canal</th><th scope="col" className="n">n</th><th scope="col" className="n">Mín.</th><th scope="col" className="n">Máx.</th><th scope="col" className="n">Media</th><th scope="col" className="n">Pendiente</th></tr>
              </thead>
              <tbody>
                {channels.map((c, ci) => {
                  const st = stats[ci];
                  const d = decimalsFor(c.resolution) + (ideal ? 1 : 0);
                  return (
                    <tr key={c.id}>
                      <th scope="row">{c.name} ({c.unit})</th>
                      <td className="n">{st ? st.n : 0}</td>
                      <td className="n">{st ? fmt(st.min, d) : '—'}</td>
                      <td className="n">{st ? fmt(st.max, d) : '—'}</td>
                      <td className="n">{st ? fmt(st.mean, d + 1) : '—'}</td>
                      <td className="n">{st && st.slope !== null ? `${fmt(st.slope, d + 2)} ${c.unit}/s` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Intervalo: {selLabel}{run.triggerTime !== null ? ` · disparo en t = ${fmt(run.triggerTime, tDec)} s` : ''} · {run.ideal ? 'sensor ideal' : 'con ruido y resolución del sensor'}.</p>
          <div className="btn-row">
            {onUseRun && <button type="button" className="btn data" onClick={useRun}>Usar esta corrida</button>}
            <button type="button" className="btn small" onClick={exportCSV}>Descargar CSV</button>
            <button type="button" className="btn small ghost" onClick={copyRun}>Copiar datos</button>
            <button type="button" className="btn small ghost" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>{showTable ? 'Ocultar' : 'Ver'} la tabla de la corrida</button>
          </div>
          <p className="small muted" aria-live="polite" style={{ margin: 0 }}>{msg}</p>
          {showTable && (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de la corrida" style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table>
                <caption className="sr-only">Corrida registrada: {samples.length} muestras a {rateLabel(run.rate)}</caption>
                <thead>
                  <tr><th scope="col" className="n">t (s)</th>{channels.map((c) => <th key={c.id} scope="col" className="n">{c.name} ({c.unit})</th>)}{markers.length > 0 && <th scope="col">Marcador</th>}</tr>
                </thead>
                <tbody>
                  {samples.map((s) => (
                    <tr key={s.t}>
                      <td className="n">{fmt(s.t, tDec)}</td>
                      {channels.map((c, ci) => <td key={c.id} className="n">{reading(s.values[ci], c, ideal)}</td>)}
                      {markers.length > 0 && <td>{markers.find((mk) => Math.abs(mk.t - s.t) < 1e-9)?.label ?? ''}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {a && !recording && !hasData && (
        <p className="notice warn" role="status" style={{ margin: 0 }}>No se registraron muestras: el canal nunca cruzó el umbral del disparo. Cambia el umbral o el flanco.</p>
      )}
    </div>
  );
}

/**
 * Tarjeta plegable «Sensores en tiempo real». El contenido se monta solo al abrirla,
 * para no añadir controles ni tablas ocultas a la página del laboratorio.
 */
export function SensorCard({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="card sensor-card" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="sensor-card-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M2 14h4l2-6 3 11 3-14 2 9h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="sensor-card-title">Sensores en tiempo real</span>
        <span className="sensor-card-sub">registrador de datos</span>
      </summary>
      {open && <div className="stack sensor-card-body">{intro && <p className="small muted" style={{ margin: 0 }}>{intro}</p>}{children}</div>}
    </details>
  );
}

/** Gráfica de la corrida devuelta al laboratorio (reutiliza Chart: cursor, ajuste, exportación y tabla). */
export function LoggerRunCharts({ run, channels, fits }: { run: LoggerRun; channels?: number[]; fits?: Record<string, FitModel> }) {
  const list = channels ?? run.channels.map((_, i) => i);
  return (
    <div className="stack">
      {list.map((ci) => {
        const c = run.channels[ci];
        return (
          <Chart key={c.id} title={`Corrida del sensor: ${c.name.toLowerCase()} en función del tiempo`} xLabel="Tiempo (s)" yLabel={`${c.name} (${c.unit})`}
            xUnit="s" yUnit={c.unit} height={240} fit={fits?.[c.id]} exportName={`corrida-${c.id}`}
            series={[{ label: `${c.name} (${run.samples.length} muestras)`, color: c.color ?? DEFAULT_COLORS[ci % DEFAULT_COLORS.length], kind: run.samples.length > 60 ? 'line' : 'both', points: run.samples.map((s) => ({ x: s.t, y: s.values[ci] })) }]} />
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt } from '../lib/format';
import { StatusChip } from '../components/Provenance';
import { Segmented } from '../components/ui';
import { drawRadius, elementColor } from './elements';
import { ProjectedSvg } from './ProjectedSvg';
import { bondChanges, buildReactionScene, checkBalanced, countsAt, equationText, frameBonds, framePositions, phaseName, PHASES, REACTION3D_LABEL, STEPS, type Reaction3DDef } from './reactionScene';
import { prettyFormula } from '../models/balancing';
import { reducedMotion, use3DViewer, useThemeVersion } from './engine3d';
import type { V3 } from './species';

type RStyle = 'bs' | 'esf';
const R_OF: Record<RStyle, (el: string) => number> = { bs: (el) => drawRadius(el) * 0.5, esf: (el) => drawRadius(el) * 1.25 };
const BASE_SECONDS = 6;

function perpendicular(d: V3): V3 {
  const a: V3 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const c: V3 = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]];
  const n = Math.hypot(...c) || 1;
  return [c[0] / n, c[1] / n, c[2] / n];
}

export interface Reaction3DProps {
  def: Reaction3DDef;
  idPrefix: string;
  height?: number;
  /** Texto que distingue los controles si hay más de un visor de reacción en la misma página. */
  labelSuffix?: string;
}

/**
 * «Reacción en 3D»: reactivos → productos con átomos mapeados. Animación por interpolación entre las geometrías
 * (acercamiento, reorganización y separación), reproducir/pausa, deslizador de avance, velocidad, pasos discretos
 * (obligatorios con movimiento reducido), rotación libre, conteo de átomos conservado y ecuación balanceada
 * sincronizada. Rótulo obligatorio de ilustración educativa.
 */
export function Reaction3D({ def, idPrefix, height = 320, labelSuffix = '' }: Reaction3DProps) {
  const scene = useMemo(() => buildReactionScene(def), [def]);
  const balance = useMemo(() => checkBalanced(def), [def]);
  const changes = useMemo(() => bondChanges(scene), [scene]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<'0.5' | '1' | '2'>('1');
  const [style, setStyle] = useState<RStyle>('bs');
  const reduced = reducedMotion();
  const tRef = useRef(0);
  tRef.current = t;
  useEffect(() => { setT(0); setPlaying(false); }, [def]);

  // Reproducción: continua (requestAnimationFrame con tiempo acotado) o por pasos discretos si se prefiere menos movimiento.
  useEffect(() => {
    if (!playing) return;
    if (reduced) {
      const id = setInterval(() => {
        const next = STEPS.find((s) => s.t > tRef.current + 1e-9);
        if (!next) { setPlaying(false); return; }
        setT(next.t);
      }, 1400 / Number(speed));
      return () => clearInterval(id);
    }
    let raf = 0;
    const t0 = performance.now();
    const from = tRef.current >= 1 ? 0 : tRef.current;
    const tick = (now: number) => {
      const el = Math.max(0, now - t0) / 1000;
      const v = Math.min(1, from + (el * Number(speed)) / BASE_SECONDS);
      setT(v);
      if (v >= 1) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, reduced]);

  const pos = useMemo(() => framePositions(scene, t), [scene, t]);
  const bonds = useMemo(() => frameBonds(scene, t), [scene, t]);
  const nowCounts = useMemo(() => countsAt(scene, t), [scene, t]);

  /* ---------- visor 3D */
  const hostRef = useRef<HTMLDivElement>(null);
  const { viewerRef, engine, retry, fail } = use3DViewer(hostRef, `reacción 3D ${idPrefix}`);
  const theme = useThemeVersion();
  const framed = useRef('');
  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      if (framed.current !== def.id) {
        framed.current = def.id;
        v.removeAllModels();
        // Modelo auxiliar diminuto con las posiciones extremas, solo para encuadrar la escena completa.
        const ext = [...framePositions(scene, 0), ...framePositions(scene, 1)];
        v.addModel(`${ext.length}\nencuadre\n${ext.map((p) => `H ${p[0].toFixed(3)} ${p[1].toFixed(3)} ${p[2].toFixed(3)}`).join('\n')}`, 'xyz');
        v.setStyle({}, { sphere: { radius: 0.01, opacity: 0.01 } });
        v.resize(); v.zoomTo(); v.zoom(1.5);
      }
      v.removeAllShapes();
      scene.atoms.forEach((a, i) => v.addSphere({ center: { x: pos[i][0], y: pos[i][1], z: pos[i][2] }, radius: R_OF[style](a.el), color: elementColor(a.el) }));
      if (style === 'bs') for (const b of bonds) {
        const p = pos[b.a], q = pos[b.b];
        const d: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
        const len = Math.hypot(...d) || 1;
        const n = perpendicular([d[0] / len, d[1] / len, d[2] / len]);
        const offs = b.order === 2 ? [-0.11, 0.11] : b.order === 3 ? [-0.16, 0, 0.16] : [0];
        for (const k of offs) v.addCylinder({ start: { x: p[0] + n[0] * k, y: p[1] + n[1] * k, z: p[2] + n[2] * k }, end: { x: q[0] + n[0] * k, y: q[1] + n[1] * k, z: q[2] + n[2] * k }, radius: b.order > 1 ? 0.07 : 0.11, color: '#8d989c', opacity: b.opacity, fromCap: 1, toCap: 1 });
      }
      v.render();
    } catch (e) { fail(e); }
  }, [engine, pos, bonds, style, scene, def.id, theme, viewerRef, fail]);

  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const counts = Object.entries(scene.counts);
  const step = (dir: 1 | -1) => {
    setPlaying(false);
    const target = dir > 0 ? STEPS.find((s) => s.t > t + 1e-9) : [...STEPS].reverse().find((s) => s.t < t - 1e-9);
    if (target) setT(target.t);
  };
  const side = t < PHASES.approachEnd ? 'r' : t > PHASES.rearrangeEnd ? 'p' : 'm';
  const eqTerm = (ts: Reaction3DDef['reactants'], on: boolean) => ts.map((x, i) => (
    <span key={i}>{i > 0 && ' + '}<span style={{ fontWeight: on ? 800 : 500, color: on ? 'var(--ink)' : 'var(--ink-2)' }}>{x.coef > 1 ? `${x.coef} ` : ''}{prettyFormula(x.formula)}</span></span>
  ));
  const descId = `${idPrefix}-r3d-desc`;
  const desc = `Reacción ${equationText(def)}. ${phaseName(t)} (avance ${fmt(t * 100, 0)} %). Átomos en todo momento: ${counts.map(([el, n]) => `${n} de ${el}`).join(', ')}. Se rompen ${changes.broken} enlaces y se forman ${changes.formed}. ${REACTION3D_LABEL}.`;
  const sfx = labelSuffix ? ` ${labelSuffix}` : '';

  return (
    <figure className="chem3d" style={{ margin: 0, minWidth: 0, maxWidth: "100%" }}>
      <p className="r3d-equation" style={{ margin: '0 0 8px', fontFamily: 'var(--font-data)', fontSize: '1.15rem', textAlign: 'center' }} aria-label={`Ecuación: ${equationText(def)}`}>
        {eqTerm(def.reactants, side !== 'p')} <span aria-hidden="true" style={{ color: 'var(--accent)', fontWeight: 800 }}>→</span> {eqTerm(def.products, side !== 'r')}
        {balance.balanced ? <span className="small" style={{ marginLeft: 10, color: 'var(--ok)', fontFamily: 'var(--font-body)' }}>✓ balanceada</span> : <span className="small" style={{ marginLeft: 10, color: 'var(--bad)' }}>no balanceada</span>}
      </p>
      <div style={{ position: 'relative', width: '100%', height, borderRadius: 12, background: 'radial-gradient(120% 90% at 30% 20%, var(--surface), var(--surface-2))', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div ref={hostRef} role="img" aria-label={`Reacción en 3D: ${equationText(def)}; arrastra para girar`} aria-describedby={descId}
          style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
        {engine === 'cargando' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><p role="status" className="small">Cargando el visor 3D (3Dmol.js)…</p></div>}
        {fallback && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ProjectedSvg ariaLabel={`Reacción ${equationText(def)}: vista de respaldo con las mismas posiciones; arrastra o usa las flechas para girarla`}
              atoms={scene.atoms.map((a, i) => ({ el: a.el, x: pos[i][0], y: pos[i][1], z: pos[i][2], r: R_OF[style](a.el), charge: a.charge }))}
              bonds={style === 'bs' ? bonds : []} extentHint={scene.radius} height={height} width={Math.round(height * 1.9)} showCharges />
          </div>
        )}
        <span className="small" style={{ position: 'absolute', left: 10, bottom: 8, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--surface) 88%, transparent)', border: '1px solid var(--line)' }} aria-hidden="true">{phaseName(t)}</span>
      </div>
      <p id={descId} className="sr-only">{desc}</p>
      <figcaption className="small" style={{ marginTop: 6 }}>
        <StatusChip status="ilustracion" prefix="Animación" /> <span className="muted">{REACTION3D_LABEL.replace(/^[^:]+:\s*/, '')}.</span>
      </figcaption>
      {fallback && (
        <div className="notice small" role="status" style={{ marginTop: 6 }}>
          <strong>Vista de respaldo:</strong> {engine === 'sin-webgl' ? 'este equipo no ofrece WebGL;' : 'no se pudo cargar el visor 3D;'} la reacción se dibuja con las mismas posiciones. Gírala con las flechas del teclado.
          {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={retry}>Reintentar el visor 3D</button></>}
        </div>
      )}
      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
        <div className="btn-row">
          <button type="button" className="btn primary small" onClick={() => { if (t >= 1) setT(0); setPlaying((p) => !p); }}>{playing ? `Pausar la reacción${sfx}` : `Reproducir la reacción${sfx}`}</button>
          <button type="button" className="btn small" onClick={() => step(-1)} disabled={t <= 0}>Paso anterior</button>
          <button type="button" className="btn small" onClick={() => step(1)} disabled={t >= 1}>Paso siguiente</button>
          <button type="button" className="btn small ghost" onClick={() => { setPlaying(false); setT(0); }}>Reiniciar</button>
        </div>
        <div className="slider">
          <div className="slider-head"><label htmlFor={`${idPrefix}-r3d-t`}>Avance de la reacción{sfx}</label><output htmlFor={`${idPrefix}-r3d-t`}>{fmt(t * 100, 0)} %</output></div>
          <input id={`${idPrefix}-r3d-t`} type="range" min={0} max={100} step={1} value={Math.round(t * 100)} aria-valuetext={`${fmt(t * 100, 0)} %: ${phaseName(t)}`}
            onChange={(e) => { setPlaying(false); setT(Number(e.target.value) / 100); }} />
        </div>
        <div className="btn-row" style={{ alignItems: 'flex-end', gap: '10px 28px', flexWrap: 'wrap' }}>
          <Segmented label={`Velocidad de la animación${sfx}`} value={speed} options={[{ value: '0.5', label: '0,5×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }]} onChange={setSpeed} />
          <Segmented label={`Estilo de la reacción 3D${sfx}`} value={style} options={[{ value: 'bs', label: 'Esferas y palitos' }, { value: 'esf', label: 'Espacio lleno' }]} onChange={setStyle} />
        </div>
        {reduced && <p className="small muted" style={{ margin: 0 }}>Movimiento reducido activo: la reproducción avanza por pasos ({STEPS.map((s) => s.name.toLowerCase()).join(' → ')}).</p>}
        <div className="table-wrap" tabIndex={0} role="region" aria-label={`Conteo de átomos de la reacción${sfx}`}>
          <table className="small">
            <caption className="sr-only">Conteo de átomos por elemento en los reactivos, en este instante y en los productos</caption>
            <thead><tr><th>Átomos</th>{balance.rows.map((r) => <th key={r.element} className="n">{r.element}</th>)}<th>¿Se conservan?</th></tr></thead>
            <tbody>
              <tr><td>Reactivos</td>{balance.rows.map((r) => <td key={r.element} className="n">{r.left}</td>)}<td rowSpan={3} style={{ color: balance.balanced ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{balance.balanced ? 'Sí: los átomos solo se reorganizan' : 'No'}</td></tr>
              <tr><td>En este instante</td>{balance.rows.map((r) => <td key={r.element} className="n">{nowCounts[r.element] ?? 0}</td>)}</tr>
              <tr><td>Productos</td>{balance.rows.map((r) => <td key={r.element} className="n">{r.right}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Enlaces que se rompen: {changes.broken} · que se forman: {changes.formed}. Geometrías de partida: {[...new Set([...def.reactants, ...def.products].map((x) => `${x.species.label}: ${x.species.geometryLabel.split(':')[0].toLowerCase()}`))].join('; ')}.</p>
      </div>
    </figure>
  );
}

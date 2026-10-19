import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt } from '../lib/format';
import { StatusChip } from '../components/Provenance';
import { Segmented } from '../components/ui';
import { elementColor, ionicRadius } from './elements';
import { ProjectedSvg, type SvgLine3D } from './ProjectedSvg';
import {
  calculatedDensity, cationAnionDistance, coordinationNumber, coordinationShell, CRYSTAL_GEOMETRY_LABEL, densityDeviation, formulaMass,
  generateLattice, shannonSum, STRUCTURE_NAME, type CrystalDef,
} from './crystal';
import { reducedMotion, use3DViewer, useThemeVersion, cssVar } from './engine3d';

type Size = 'shannon' | 'pequenas';

const ionText = (el: string, q: number) => `${el}${Math.abs(q) > 1 ? Math.abs(q) : ''}${q > 0 ? '⁺' : '⁻'}`.replace('2⁺', '²⁺').replace('2⁻', '²⁻');

/** Aristas de los cubos de un bloque de n × n × n celdas (Å). */
function cellEdges(a: number, n: number): SvgLine3D[] {
  const out: SvgLine3D[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    out.push({ p: [0, i * a, j * a], q: [n * a, i * a, j * a] });
    out.push({ p: [i * a, 0, j * a], q: [i * a, n * a, j * a] });
    out.push({ p: [i * a, j * a, 0], q: [i * a, j * a, n * a] });
  }
  return out;
}

export interface Crystal3DProps { crystal: CrystalDef; idPrefix: string; height?: number; labelSuffix?: string }

/**
 * Red cristalina iónica generada a partir del parámetro de red publicado (modelo calculado): bloque de 1 o 2 celdas
 * por arista, radios iónicos de Shannon o esferas pequeñas, celda unidad, poliedro de coordinación y datos
 * calculados (distancia catión–anión, número de coordinación y densidad comparada con la publicada).
 */
export function Crystal3D({ crystal, idPrefix, height = 320, labelSuffix = '' }: Crystal3DProps) {
  const [n, setN] = useState<'1' | '2'>('1');
  const [size, setSize] = useState<Size>('pequenas');
  const [who, setWho] = useState<'cation' | 'anion'>('cation');
  const [showCell, setShowCell] = useState(true);
  const [spin, setSpin] = useState(false);
  const sfx = labelSuffix ? ` ${labelSuffix}` : '';
  const N = Number(n);
  const ions = useMemo(() => generateLattice(crystal, N), [crystal, N]);
  const cnC = useMemo(() => coordinationNumber(crystal, 'cation'), [crystal]);
  const cnA = useMemo(() => coordinationNumber(crystal, 'anion'), [crystal]);
  const radius = (el: string, q: number) => {
    const r = ionicRadius(el, q > 0 ? cnC : cnA);
    return size === 'shannon' ? r : r * 0.38;
  };
  // Ion central del tipo elegido (el más cercano al centro del bloque) y sus vecinos de signo contrario.
  const focus = useMemo(() => {
    const mid = (N * crystal.a) / 2;
    const cand = ions.map((x, i) => ({ i, x })).filter(({ x }) => (who === 'cation' ? x.charge > 0 : x.charge < 0))
      .sort((p, q) => Math.hypot(p.x.x - mid, p.x.y - mid, p.x.z - mid) - Math.hypot(q.x.x - mid, q.x.y - mid, q.x.z - mid))[0];
    return { center: cand.i, shell: coordinationShell(ions, cand.i) };
  }, [ions, who, N, crystal.a]);
  const d = cationAnionDistance(crystal);
  const rho = calculatedDensity(crystal);
  const dev = densityDeviation(crystal);
  const edges = useMemo(() => (showCell ? cellEdges(crystal.a, N) : []), [showCell, crystal.a, N]);

  const hostRef = useRef<HTMLDivElement>(null);
  const { viewerRef, engine, retry, fail } = use3DViewer(hostRef, `cristal 3D ${idPrefix}`);
  const theme = useThemeVersion();
  const framedFor = useRef('');
  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      const key = `${crystal.id}-${N}`;
      if (framedFor.current !== key) {
        framedFor.current = key;
        v.removeAllModels();
        v.addModel(`${ions.length}\nencuadre\n${ions.map((p) => `H ${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)}`).join('\n')}`, 'xyz');
        v.setStyle({}, { sphere: { radius: 0.01, opacity: 0.01 } });
        v.resize(); v.zoomTo(); v.zoom(0.85);
      }
      v.removeAllShapes();
      const data = cssVar('--data', '#b23a0a'), line = cssVar('--ink-2', '#44524f');
      const inShell = new Set([focus.center, ...focus.shell]);
      ions.forEach((x, i) => v.addSphere({ center: { x: x.x, y: x.y, z: x.z }, radius: radius(x.el, x.charge), color: elementColor(x.el), opacity: inShell.has(i) || size === 'pequenas' ? 1 : 0.55 }));
      for (const j of focus.shell) { const p = ions[focus.center], q = ions[j]; v.addCylinder({ start: { x: p.x, y: p.y, z: p.z }, end: { x: q.x, y: q.y, z: q.z }, radius: 0.07, color: data, fromCap: 1, toCap: 1 }); }
      for (const e of edges) v.addCylinder({ start: { x: e.p[0], y: e.p[1], z: e.p[2] }, end: { x: e.q[0], y: e.q[1], z: e.q[2] }, radius: 0.03, color: line, dashed: true, dashLength: 0.25, gapLength: 0.18 });
      if (spin && !reducedMotion()) v.spin('y', 0.4); else v.spin(false);
      v.render();
    } catch (e) { fail(e); }
  }, [engine, ions, focus, size, edges, spin, theme, crystal.id, N, viewerRef, fail]);

  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const descId = `${idPrefix}-c3d-desc`;
  const cat = ionText(...crystal.cation), an = ionText(...crystal.anion);
  const desc = `Red de ${crystal.nombre} (${crystal.formula}), estructura ${STRUCTURE_NAME[crystal.type]}, a = ${fmt(crystal.a, 4)} Å; bloque de ${N}×${N}×${N} celdas con ${ions.length} iones. Cada ${cat} tiene ${cnC} ${an} vecinos y cada ${an} tiene ${cnA} ${cat}; distancia ${cat}–${an} ${fmt(d, 3)} Å. Resaltado: un ${who === 'cation' ? cat : an} y sus ${focus.shell.length} vecinos.`;

  return (
    <figure className="chem3d" style={{ margin: 0, minWidth: 0, maxWidth: "100%" }}>
      <div style={{ position: 'relative', width: '100%', height, borderRadius: 12, background: 'radial-gradient(120% 90% at 30% 20%, var(--surface), var(--surface-2))', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div ref={hostRef} role="img" aria-label={`Red cristalina 3D de ${crystal.nombre}; arrastra para girar`} aria-describedby={descId}
          style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
        {engine === 'cargando' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><p role="status" className="small">Cargando el visor 3D (3Dmol.js)…</p></div>}
        {fallback && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ProjectedSvg ariaLabel={`Red de ${crystal.nombre}: vista de respaldo con las posiciones calculadas; arrastra o usa las flechas para girarla`}
              atoms={ions.map((x) => ({ el: x.el, x: x.x, y: x.y, z: x.z, r: radius(x.el, x.charge), charge: x.charge }))}
              bonds={focus.shell.map((j) => ({ a: focus.center, b: j, order: 1 }))} lines={edges} height={height} width={Math.round(height * 1.6)} selection={[focus.center]} showCharges={size === 'shannon'} />
          </div>
        )}
        <div className="small" aria-hidden="true" style={{ position: 'absolute', right: 10, top: 8, display: 'flex', gap: 8, padding: '3px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--surface) 88%, transparent)', border: '1px solid var(--line)' }}>
          {[crystal.cation, crystal.anion].map(([el, q]) => <span key={el}><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill={elementColor(el)} /></svg> {ionText(el, q)}</span>)}
        </div>
      </div>
      <p id={descId} className="sr-only">{desc}</p>
      <figcaption className="small" style={{ marginTop: 6 }}>
        <StatusChip status="modelo" prefix="Red cristalina" /> <span className="muted">{CRYSTAL_GEOMETRY_LABEL.replace(/^[^:]+:\s*/, '')}: a = {fmt(crystal.a, 4)} Å ({crystal.sources.lattice.split(',')[0]}, 1963).</span>
      </figcaption>
      {fallback && (
        <div className="notice small" role="status" style={{ marginTop: 6 }}>
          <strong>Vista de respaldo:</strong> {engine === 'sin-webgl' ? 'este equipo no ofrece WebGL;' : 'no se pudo cargar el visor 3D;'} la red se dibuja con las mismas posiciones.
          {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={retry}>Reintentar el visor 3D</button></>}
        </div>
      )}
      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
        <div className="btn-row" style={{ alignItems: 'flex-end', gap: '10px 28px', flexWrap: 'wrap' }}>
          <Segmented label={`Bloque de celdas${sfx}`} value={n} options={[{ value: '1', label: '1 celda' }, { value: '2', label: '2 × 2 × 2' }]} onChange={setN} />
          <Segmented label={`Tamaño de los iones${sfx}`} value={size} options={[{ value: 'pequenas', label: 'Esferas pequeñas' }, { value: 'shannon', label: 'Radios de Shannon' }]} onChange={setSize} />
          <Segmented label={`Coordinación de${sfx}`} value={who} options={[{ value: 'cation', label: `un ${cat}` }, { value: 'anion', label: `un ${an}` }]} onChange={setWho} />
        </div>
        <div className="btn-row">
          <label className="check small"><input type="checkbox" checked={showCell} onChange={(e) => setShowCell(e.target.checked)} /> Mostrar las aristas de la celda</label>
          {!fallback && <button type="button" className="btn small" aria-pressed={spin} disabled={engine !== 'disponible' || reducedMotion()} onClick={() => setSpin((s) => !s)}>{spin ? 'Detener el giro' : 'Girar continuamente'}</button>}
        </div>
        <dl className="small chem-dl" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)', gap: '3px 12px' }}>
          <dt>Estructura</dt><dd style={{ margin: 0 }}>{STRUCTURE_NAME[crystal.type]}{crystal.mineral ? ` (mineral: ${crystal.mineral})` : ''}</dd>
          <dt>Parámetro de red a</dt><dd style={{ margin: 0 }}>{fmt(crystal.a, 4)} Å (medido por difracción de rayos X)</dd>
          <dt>Distancia {cat}–{an}</dt><dd style={{ margin: 0 }}><strong>{fmt(d, 3)} Å</strong> {crystal.type === 'halita' ? '= a/2' : crystal.type === 'fluorita' ? '= a·√3/4' : '= a·√3/2'} (calculada)</dd>
          <dt>Suma de radios de Shannon</dt><dd style={{ margin: 0 }}>{fmt(shannonSum(crystal), 2)} Å</dd>
          <dt>Coordinación</dt><dd style={{ margin: 0 }}>{cat}: {cnC} · {an}: {cnA} (contada en la red)</dd>
          <dt>Densidad calculada</dt><dd style={{ margin: 0 }}><strong>{fmt(rho, 3)} g/cm³</strong> = {crystal.z} · {fmt(formulaMass(crystal), 2)} g/mol / (N_A · a³)</dd>
          <dt>Densidad publicada</dt><dd style={{ margin: 0 }}>{String(crystal.densityPublished).replace('.', ',')} g/cm³ (CRC Handbook) · diferencia {dev >= 0 ? '+' : '−'}{fmt(Math.abs(dev), 1)} %</dd>
        </dl>
      </div>
    </figure>
  );
}
